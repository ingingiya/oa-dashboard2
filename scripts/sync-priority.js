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
    // 1) 품목별 매출 집계 (v_daily_sales_detail = 전 채널 ERP 매출, 품목명 직접 제공)
    //    ⚠️ 이전엔 v_daily_sales_management를 썼는데 그 뷰는 쿠팡만 들어있어 금액이 틀렸음 (2026-07-20 수정)
    const [rows] = await pool.query(`
      SELECT d.\`품목명\` AS product,
        COALESCE(c.\`카테고리1\`, d.\`카테고리\`) AS cat1,
        COALESCE(c.\`카테고리2\`, d.\`카테고리\`) AS cat2,
        SUM(CASE WHEN d.\`판매날짜\` >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN d.\`총매출액\` ELSE 0 END) AS s30,
        SUM(CASE WHEN d.\`판매날짜\` <  DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN d.\`총매출액\` ELSE 0 END) AS p30,
        SUM(CASE WHEN d.\`판매날짜\` >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN d.\`판매수량\` ELSE 0 END) AS q30
      FROM v_daily_sales_detail d
      LEFT JOIN v_sales_category c ON c.\`품목명\` = d.\`품목명\`
      WHERE d.\`판매날짜\` >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)
        AND d.\`브랜드명\` = '오아'
        AND (c.\`카테고리1\` IS NULL OR c.\`카테고리1\` <> '식품')
      GROUP BY 1, 2, 3
    `);
    const items = rows
      .map(r => ({ product: r.product, cat1: r.cat1, cat2: r.cat2,
        s30: Math.round(Number(r.s30) || 0), p30: Math.round(Number(r.p30) || 0), q30: Number(r.q30) || 0 }))
      .filter(a => a.s30 > 0 || a.p30 > 0)
      .sort((a, b) => b.s30 - a.s30);
    console.log(`  → 품목 ${items.length}개 (전 채널)`);

    // 3.5) 네이버 제품별 광고비 — 광고그룹이 제품 단위 ("선풍기_아이스볼트미스트(상품형)")
    const [navGroups] = await pool.query(`
      SELECT adgroup_name AS name,
        ROUND(SUM(sales_amt)) AS spend, SUM(imp_cnt) AS imp, SUM(clk_cnt) AS clk, SUM(conv_cnt) AS conv
      FROM ad_daily_adgroup
      WHERE stat_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY adgroup_name
    `);
    // 광고그룹명 정규화: "(상품형)" 등 괄호 제거, "카테고리_" 접두 제거, 공백 제거
    const tokenOf = (n) => (n || '').replace(/\(.*?\)/g, '').split('_').pop().replace(/\s/g, '').trim();
    // 제품 키 = 품목명에서 '오아' 접두 제거
    const keys = items.map(it => ({ it, k: it.product.replace(/^오아/, '') })).filter(x => x.k.length >= 2);
    let navMatched = 0;
    for (const g of navGroups) {
      const token = tokenOf(g.name);
      if (token.length < 2) continue;
      // 1순위 완전일치 → 2순위 토큰이 키 포함(긴 키 우선) → 3순위 키가 토큰 포함(짧은 키 우선)
      const exact = keys.find(x => x.k === token);
      const hit = exact
        || [...keys].sort((a, b) => b.k.length - a.k.length).find(x => token.includes(x.k))
        || [...keys].sort((a, b) => a.k.length - b.k.length).find(x => x.k.includes(token));
      if (!hit) continue;
      const it = hit.it;
      it.nav30 = (it.nav30 || 0) + Number(g.spend);
      it.navImp = (it.navImp || 0) + Number(g.imp);
      it.navClk = (it.navClk || 0) + Number(g.clk);
      it.navConv = (it.navConv || 0) + Number(g.conv);
      navMatched++;
    }
    console.log(`  → 네이버 광고그룹 ${navGroups.length}개 중 ${navMatched}개 제품 매칭`);

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
