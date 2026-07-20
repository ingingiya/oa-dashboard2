#!/usr/bin/env node
// 우선순위 탭 동기화: 품목별 최근30일 vs 이전30일 매출 (보아르 제외) → Supabase settings.oa_priority_v1
// Vercel에서 MySQL 직접 접속 불가(ETIMEDOUT)라 로컬 크론으로 동기화
// 실행: node scripts/sync-priority.js  · 크론: 매일 9:15

const mysql = require('mysql2/promise');

const SUPA_URL = 'https://lugqeflqusqsyotdiaxg.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1Z3FlZmxxdXNxc3lvdGRpYXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxOTkzMzksImV4cCI6MjA4ODc3NTMzOX0.ls7CN3iISLM_JcGEaVRV_JDSvm4BFqYMU6m4iBGiRA0';

async function main() {
  console.log(`[${new Date().toLocaleString('ko-KR')}] 우선순위 동기화 시작`);
  const pool = mysql.createPool({
    host: '52.78.125.230',
    port: 3306,
    user: 'user_for_ai_sm',
    password: '1234',
    database: 'db_for_ai_sm',
    connectionLimit: 2,
  });
  try {
    // 1) 품목 카탈로그 (보아르 제외)
    const [cats] = await pool.query(`
      SELECT \`카테고리1\` AS cat1, \`카테고리2\` AS cat2, \`품목명\` AS product
      FROM v_sales_category
      WHERE \`품목명\` NOT LIKE '%보아르%'
        AND \`카테고리1\` NOT IN ('식품')
    `);
    console.log(`  → 품목 ${cats.length}개`);

    // 2) 상품명 단위 매출 집계 (최근 60일, MySQL에서 그룹핑만 — 품목 매칭은 JS)
    const [sales] = await pool.query(`
      SELECT \`상품명\` AS name,
        SUM(CASE WHEN \`매출일자\` >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN \`판매액\` ELSE 0 END) AS s30,
        SUM(CASE WHEN \`매출일자\` <  DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN \`판매액\` ELSE 0 END) AS p30,
        SUM(CASE WHEN \`매출일자\` >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN \`수량\` ELSE 0 END) AS q30
      FROM v_daily_sales_management
      WHERE \`매출일자\` >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)
        AND \`상품명\` NOT LIKE '%보아르%'
      GROUP BY \`상품명\`
    `);
    console.log(`  → 판매 상품명 ${sales.length}개`);

    // 3) JS 매칭: 상품명에 품목명이 포함되면 해당 품목으로 귀속 (가장 긴 품목명 우선)
    const sorted = [...cats].sort((a, b) => b.product.length - a.product.length);
    const agg = {}; // product → {cat1,cat2,s30,p30,q30}
    let unmatched = 0;
    for (const row of sales) {
      const hit = sorted.find(c => row.name && row.name.includes(c.product));
      if (!hit) { unmatched++; continue; }
      const a = agg[hit.product] = agg[hit.product] || { cat1: hit.cat1, cat2: hit.cat2, s30: 0, p30: 0, q30: 0 };
      a.s30 += Number(row.s30) || 0;
      a.p30 += Number(row.p30) || 0;
      a.q30 += Number(row.q30) || 0;
    }

    const items = Object.entries(agg)
      .map(([product, a]) => ({ product, ...a, s30: Math.round(a.s30), p30: Math.round(a.p30) }))
      .filter(a => a.s30 > 0 || a.p30 > 0)
      .sort((a, b) => b.s30 - a.s30);
    console.log(`  → 품목 매칭 ${items.length}개 (미매칭 상품명 ${unmatched}개)`);

    // 4) 카테고리별 월 광고비 (오아 브랜드, 최근 2개월)
    const [ads] = await pool.query(`
      SELECT \`집행월\` AS month, \`카테고리\` AS cat, ROUND(SUM(\`금액\`)) AS spend
      FROM v_sales_ad_cost
      WHERE \`브랜드\` = '오아'
        AND \`집행월\` >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 2 MONTH), '%Y-%m')
      GROUP BY 1, 2
    `);

    const value = {
      updated: new Date().toISOString(),
      items,
      adSpend: ads.map(r => ({ month: r.month, cat: r.cat, spend: Number(r.spend) })),
    };
    const res = await fetch(`${SUPA_URL}/rest/v1/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ key: 'oa_priority_v1', value, updated_at: new Date().toISOString() }),
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
