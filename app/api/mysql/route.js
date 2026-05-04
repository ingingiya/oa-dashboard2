export const dynamic = 'force-dynamic';

import mysql from 'mysql2/promise';

// 이미용 카테고리 ID (44=이미용, 70=헤어, 71=피부미용, 72=이미용잡화, 73=기타이미용류 및 하위)
const BEAUTY_CATEGORY_IDS = [44,70,71,72,73,74,75,76,77,78,80,82,200,201,202,203,204,205,206,207,208,209];

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
  const action = searchParams.get('action') || 'tables';

  let pool;
  try {
    pool = getPool();

    // 테이블 목록
    if (action === 'tables') {
      const [rows] = await pool.query('SHOW TABLES');
      const key = Object.keys(rows[0] || {})[0];
      return Response.json({ tables: rows.map(r => r[key]) });
    }

    // 이미용 7일 판매 (제품별 일별)
    if (action === 'beauty_sales7') {
      const days = Number(searchParams.get('days') || 7);
      const catId = searchParams.get('catId'); // 특정 하위카테고리 필터 (optional)
      const catIds = catId ? [Number(catId)] : BEAUTY_CATEGORY_IDS;
      const placeholders = catIds.map(() => '?').join(',');

      const [rows] = await pool.query(`
        SELECT
          제품명 as name,
          DATE(판매날짜) as date,
          SUM(판매수량) as qty,
          SUM(총매출액) as revenue,
          SUM(총매출이익) as profit
        FROM v_daily_sales_detail
        WHERE 판매날짜 >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
          AND 카테고리코드 IN (${placeholders})
        GROUP BY 제품명, DATE(판매날짜)
        ORDER BY date DESC, revenue DESC
      `, [days, ...catIds]);

      return Response.json({ rows });
    }

    // 이미용 급등/급락 (전주 vs 이번주)
    if (action === 'beauty_trend') {
      const catId = searchParams.get('catId');
      const catIds = catId ? [Number(catId)] : BEAUTY_CATEGORY_IDS;
      const placeholders = catIds.map(() => '?').join(',');

      const [rows] = await pool.query(`
        SELECT
          제품명 as name,
          SUM(CASE WHEN 판매날짜 >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 판매수량 ELSE 0 END) as this_week,
          SUM(CASE WHEN 판매날짜 >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
                    AND 판매날짜 < DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 판매수량 ELSE 0 END) as last_week,
          SUM(CASE WHEN 판매날짜 >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 총매출액 ELSE 0 END) as this_revenue,
          SUM(CASE WHEN 판매날짜 >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
                    AND 판매날짜 < DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 총매출액 ELSE 0 END) as last_revenue
        FROM v_daily_sales_detail
        WHERE 판매날짜 >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
          AND 카테고리코드 IN (${placeholders})
        GROUP BY 제품명
        HAVING this_week > 0 OR last_week > 0
        ORDER BY (this_week - last_week) DESC
      `, [...catIds]);

      return Response.json({ rows });
    }

    // 이미용 카테고리 목록 (필터용)
    if (action === 'beauty_categories') {
      const [rows] = await pool.query(`
        SELECT 제품카테고리ID as id, category_name as name, parent_category_id as parent
        FROM v_product_category
        WHERE 카테고리코드 IN (44,70,71,72,73,74,75,76,77,78,80,82,200,201,202,203,204,205,206,207,208,209)
          AND is_active = 'Y'
        ORDER BY parent_category_id, sequence
      `);
      return Response.json({ rows });
    }

    // 이미용 상품별 합산 (기간 선택)
    if (action === 'beauty_summary') {
      const days = Number(searchParams.get('days') || 7);
      const catId = searchParams.get('catId');
      const catIds = catId ? [Number(catId)] : BEAUTY_CATEGORY_IDS;
      const placeholders = catIds.map(() => '?').join(',');

      const [rows] = await pool.query(`
        SELECT
          제품명 as name,
          SUM(판매수량) as qty,
          SUM(총매출액) as revenue,
          SUM(총매출이익) as profit
        FROM v_daily_sales_detail
        WHERE 판매날짜 >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
          AND 카테고리코드 IN (${placeholders})
        GROUP BY 제품명
        ORDER BY revenue DESC
        LIMIT 50
      `, [days, ...catIds]);

      return Response.json({ rows });
    }

    // 400일치 전체 데이터 (ERP 대시보드용)
    if (action === 'beauty_sales_all') {
      const days = Number(searchParams.get('days') || 400);
      const catId = searchParams.get('catId');
      const catIds = catId ? [Number(catId)] : BEAUTY_CATEGORY_IDS;
      const placeholders = catIds.map(() => '?').join(',');

      const [rows] = await pool.query(`
        SELECT
          제품명 as name,
          카테고리코드 as cat_id,
          거래처명 as channel,
          DATE(판매날짜) as date,
          SUM(판매수량) as qty,
          SUM(총매출액) as revenue,
          SUM(총매출이익) as profit
        FROM v_daily_sales_detail
        WHERE 판매날짜 >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
          AND 카테고리코드 IN (${placeholders})
        GROUP BY 제품명, 카테고리코드, 거래처명, DATE(판매날짜)
        ORDER BY date DESC, revenue DESC
      `, [days, ...catIds]);

      return Response.json({ rows });
    }

    // 제품명 검색 (진단용)
    if (action === 'search_product') {
      const keyword = searchParams.get('keyword') || '';
      const [rows] = await pool.query(`
        SELECT DISTINCT
          제품명 as name,
          브랜드명 as brand,
          카테고리코드 as cat_id
        FROM v_daily_sales_detail
        WHERE 제품명 LIKE ?
        ORDER BY 브랜드명, 카테고리코드, 제품명
        LIMIT 50
      `, [`%${keyword}%`]);
      return Response.json({ rows });
    }

    return Response.json({ error: '알 수 없는 action' }, { status: 400 });

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  } finally {
    if (pool) await pool.end().catch(() => {});
  }
}
