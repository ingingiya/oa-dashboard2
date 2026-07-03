export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import mysql from 'mysql2/promise';

function getPool() {
  return mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    database: process.env.MYSQL_DB,
    waitForConnections: true,
    connectionLimit: 5,
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const productIds = (searchParams.get('product_ids') || '').split(',').filter(Boolean).map(Number);
  const days = Number(searchParams.get('days') || 30);
  const keyword = searchParams.get('keyword') || '';

  let pool;
  try {
    pool = getPool();

    // 제품 검색
    if (action === 'search') {
      const [rows] = await pool.query(`
        SELECT DISTINCT p.제품ID as id, p.제품명 as name, p.브랜드명 as brand, p.카테고리 as category
        FROM v_daily_sales_detail p
        WHERE p.제품명 LIKE ? OR p.브랜드명 LIKE ?
        ORDER BY p.브랜드명, p.제품명
        LIMIT 30
      `, [`%${keyword}%`, `%${keyword}%`]);
      return Response.json({ rows });
    }

    if (!productIds.length) return Response.json({ error: 'product_ids 필요' }, { status: 400 });
    const ph = productIds.map(() => '?').join(',');

    // 매출 추이
    if (action === 'sales') {
      const [rows] = await pool.query(`
        SELECT 제품명 as name, DATE(판매날짜) as date,
          SUM(판매수량) as qty, SUM(총매출액) as revenue, SUM(총매출이익) as profit
        FROM v_daily_sales_detail
        WHERE 제품번호 IN (${ph}) AND 판매날짜 >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY 제품명, DATE(판매날짜)
        ORDER BY date DESC
      `, [...productIds, days]);
      return Response.json({ rows });
    }

    // 주문 현황
    if (action === 'orders') {
      const [rows] = await pool.query(`
        SELECT 제품명 as name, 주문유형 as order_type, 주문상태 as status,
          DATE(주문등록일시) as date, SUM(수량) as qty, SUM(매출액) as amount
        FROM v_daily_order_detail
        WHERE 제품ID IN (${ph}) AND 주문등록일시 >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY 제품명, 주문유형, 주문상태, DATE(주문등록일시)
        ORDER BY date DESC
      `, [...productIds, days]);
      return Response.json({ rows });
    }

    // 배송 현황
    if (action === 'delivery') {
      const [rows] = await pool.query(`
        SELECT 제품명 as name, 송장상태 as status, 배송유형 as type,
          COUNT(*) as cnt, SUM(수량) as qty
        FROM v_delivery_tracking_detail
        WHERE 제품ID IN (${ph}) AND 주문등록일시 >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY 제품명, 송장상태, 배송유형
        ORDER BY cnt DESC
      `, [...productIds, days]);
      return Response.json({ rows });
    }

    // 재고/발주
    if (action === 'stock') {
      const [rows] = await pool.query(`
        SELECT 제품명 as name, 모델명 as model,
          CAST(현재고수량 AS SIGNED) as stock,
          CAST(COALESCE(NULLIF(생산수량,''),0) AS SIGNED) as producing,
          CAST(COALESCE(NULLIF(출하수량,''),0) AS SIGNED) as shipping,
          CAST(COALESCE(NULLIF(운송수량,''),0) AS SIGNED) as transit
        FROM v_purchase_status
        WHERE 제품번호 IN (${ph})
      `, [...productIds]);
      return Response.json({ rows });
    }

    // 검색 순위
    if (action === 'ranking') {
      const brands = (searchParams.get('brands') || '').split(',').filter(Boolean);
      if (!brands.length) return Response.json({ rows: [] });
      const bph = brands.map(() => '?').join(',');
      const [rows] = await pool.query(`
        SELECT 검색어 as keyword, 채널명 as channel, 채널상품명 as product_name,
          순위 as rank_pos, 페이지 as page, 상품타입 as product_type,
          DATE(랭킹등록일시) as date
        FROM v_analyze_search_ranking
        WHERE 검색브랜드 IN (${bph})
          AND 랭킹등록일시 >= DATE_SUB(NOW(), INTERVAL ? DAY)
        ORDER BY 랭킹등록일시 DESC, 순위 ASC
      `, [...brands, days]);
      return Response.json({ rows });
    }

    // 광고비
    if (action === 'ads') {
      const [rows] = await pool.query(`
        SELECT DATE(stat_date) as date, campaign_name,
          SUM(imp_cnt) as impressions, SUM(clk_cnt) as clicks,
          SUM(sales_amt) as spend, SUM(conv_cnt) as conversions, SUM(conv_amt) as conv_amount
        FROM ad_daily_campaign
        WHERE stat_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY DATE(stat_date), campaign_name
        ORDER BY date DESC
      `, [days]);
      return Response.json({ rows });
    }

    return Response.json({ error: 'unknown action' }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  } finally {
    if (pool) await pool.end().catch(() => {});
  }
}
