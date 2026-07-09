#!/usr/bin/env node
// 랭킹 탭 실판매 동기화: v_daily_order_detail(위탁 주문=채널 실판매) → Supabase settings.oa_rank_sales_v1
// Vercel에서 MySQL 직접 접속 불가(ETIMEDOUT)라 로컬 크론으로 동기화
// 실행: node scripts/sync-rank-sales.js  · 크론: 매일 9:05

const mysql = require('mysql2/promise');

const SUPA_URL = 'https://lugqeflqusqsyotdiaxg.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1Z3FlZmxxdXNxc3lvdGRpYXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxOTkzMzksImV4cCI6MjA4ODc3NTMzOX0.ls7CN3iISLM_JcGEaVRV_JDSvm4BFqYMU6m4iBGiRA0';

async function main() {
  console.log(`[${new Date().toLocaleString('ko-KR')}] 랭킹 실판매 동기화 시작`);
  const pool = mysql.createPool({
    host: '52.78.125.230',
    port: 3306,
    user: 'user_for_ai_sm',
    password: '1234',
    database: 'db_for_ai_sm',
    connectionLimit: 2,
  });
  try {
    const [rows] = await pool.query(`
      SELECT
        CASE WHEN 매출처명='스마트스토어' THEN '네이버'
             WHEN 매출처명='쿠팡' THEN '쿠팡'
             WHEN 매출처명 LIKE '%지그재그%' THEN '지그재그'
             WHEN 매출처명='에이블리' THEN '에이블리'
             WHEN 매출처명='무신사' THEN '무신사' END AS channel,
        CASE WHEN 제품명 LIKE '%프리온%' THEN '프리온 고데기' ELSE '드라이기' END AS product,
        SUM(CASE WHEN 주문등록일시 >= DATE_SUB(CURDATE(), INTERVAL 14 DAY) THEN 수량 ELSE 0 END) AS cur,
        SUM(CASE WHEN 주문등록일시 <  DATE_SUB(CURDATE(), INTERVAL 14 DAY) THEN 수량 ELSE 0 END) AS prv
      FROM v_daily_order_detail
      WHERE 브랜드='오아'
        AND CAST(주문유형 AS BINARY) LIKE CAST('위탁%' AS BINARY)
        AND 주문등록일시 >= DATE_SUB(CURDATE(), INTERVAL 28 DAY)
        AND (제품명 LIKE '%프리온%' OR 제품명 LIKE '%드라이%' OR 제품명 LIKE '%에어리%' OR 제품명 LIKE '%소닉%')
      GROUP BY channel, product
      HAVING channel IS NOT NULL
    `);
    console.log(`  → ${rows.length}행 조회`);
    const value = {
      updated: new Date().toISOString(),
      rows: rows.map(r => ({ channel: r.channel, product: r.product, cur: Number(r.cur), prv: Number(r.prv) })),
    };
    const res = await fetch(`${SUPA_URL}/rest/v1/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ key: 'oa_rank_sales_v1', value, updated_at: new Date().toISOString() }),
    });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
    console.log('✅ 동기화 완료');
  } catch (e) {
    console.error('❌ 오류:', e.message);
    process.exit(1);
  } finally {
    await pool.end().catch(() => {});
  }
}

main();
