export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import mysql from 'mysql2/promise';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sH = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' };

export async function GET(req) {
  // 간단한 보안 체크
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  if (secret !== process.env.ERP_SYNC_SECRET && req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    // 1. Supabase에서 프로젝트에 연결된 제품 ID 가져오기
    const projRes = await fetch(`${SUPA_URL}/rest/v1/projects?select=products`, { headers: sH });
    const projects = await projRes.json();
    const ids = [...new Set(projects.flatMap(p => (p.products || []).map(pr => pr.id)).filter(Boolean))];
    if (!ids.length) return Response.json({ ok: true, msg: 'no products', synced: 0 });

    // 2. MySQL에서 최근 7일 데이터 조회
    const pool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT) || 3306,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASS,
      database: process.env.MYSQL_DB,
      connectionLimit: 3,
    });

    const [rows] = await pool.query(`
      SELECT 제품번호 as product_id, 제품명 as product_name, 브랜드명 as brand, 매출처명 as channel,
        DATE(판매날짜) as date, SUM(판매수량) as qty, SUM(총매출액) as revenue, SUM(총매출이익) as profit
      FROM v_daily_sales_detail
      WHERE 제품번호 IN (?) AND 판매날짜 >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY 제품번호, 제품명, 브랜드명, 매출처명, DATE(판매날짜)
    `, [ids]);

    await pool.end().catch(() => {});

    // 3. Supabase에 upsert
    const data = rows.map(r => ({
      product_id: r.product_id,
      product_name: r.product_name,
      brand: r.brand,
      channel: r.channel || '',
      date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
      qty: Number(r.qty) || 0,
      revenue: Number(r.revenue) || 0,
      profit: Number(r.profit) || 0,
      synced_at: new Date().toISOString(),
    }));

    if (data.length) {
      const BATCH = 500;
      for (let i = 0; i < data.length; i += BATCH) {
        const res = await fetch(`${SUPA_URL}/rest/v1/project_product_data?on_conflict=product_id,date,channel`, {
          method: 'POST',
          headers: { ...sH, Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify(data.slice(i, i + BATCH)),
        });
        if (!res.ok) throw new Error(await res.text());
      }
    }

    // 4. 검색순위 동기화
    const prodNames = [...new Set(projects.flatMap(p => (p.products || []).map(pr => pr.name)).filter(Boolean))];
    let rankSynced = 0;
    if (prodNames.length) {
      const keywords = [...new Set(prodNames.flatMap(n => {
        const base = n.replace(/^(오아|보아르|삼대오백|뉴트리커먼)/, '').replace(/[-_](화이트|블랙|베이지|그레이|핑크|실버|크림|노즐|파우치|공용).*$/, '').trim();
        const parts = [base];
        if (base.length > 4) {
          const sub = base.replace(/(드라이기|선풍기|마사지기|가습기|세정기)$/, '').trim();
          if (sub.length >= 2 && sub !== base) parts.push(sub);
        }
        return parts;
      }).filter(k => k.length >= 2))];

      const pool2 = mysql.createPool({
        host: process.env.MYSQL_HOST,
        port: Number(process.env.MYSQL_PORT) || 3306,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB,
        connectionLimit: 3,
      });

      const likeConds = keywords.map(() => '채널상품명 COLLATE utf8mb4_unicode_ci LIKE ?').join(' OR ');
      const likeParams = keywords.map(n => `%${n}%`);
      const [rankRows] = await pool2.query(`
        SELECT 검색어 as keyword, 채널명 as channel, 검색브랜드 as brand, 채널상품명 as product_name,
          MIN(순위) as rank_pos, MIN(페이지) as page, 상품타입 as product_type, DATE(랭킹등록일시) as date
        FROM v_analyze_search_ranking
        WHERE 랭킹등록일시 >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND (${likeConds})
        GROUP BY 검색어, 채널명, 검색브랜드, 채널상품명, 상품타입, DATE(랭킹등록일시)
      `, likeParams);
      await pool2.end().catch(() => {});

      const seen = new Set();
      const rankData = rankRows.filter(r => {
        const key = `${r.keyword}|${r.channel}|${r.product_name}|${r.date}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).map(r => ({
        keyword: r.keyword, channel: r.channel, brand: r.brand, product_name: r.product_name,
        rank_pos: r.rank_pos, page: r.page, product_type: r.product_type,
        date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
        synced_at: new Date().toISOString(),
      }));

      for (let i = 0; i < rankData.length; i += 500) {
        const res = await fetch(`${SUPA_URL}/rest/v1/search_rankings?on_conflict=keyword,channel,product_name,date`, {
          method: 'POST',
          headers: { ...sH, Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify(rankData.slice(i, i + 500)),
        });
        if (!res.ok) throw new Error(await res.text());
      }
      rankSynced = rankData.length;
    }

    return Response.json({ ok: true, sales: data.length, rankings: rankSynced });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
