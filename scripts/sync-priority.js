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
    // 1) 품목×일자 매출 (v_daily_sales_detail = 전 채널 ERP 매출, 오아 브랜드만)
    //    일별로 저장해 대시보드에서 기간 자유 선택 (기본 30일 vs 이전 30일)
    //    ⚠️ v_daily_sales_management는 쿠팡만 들어있는 뷰 — 매출 소스로 쓰지 말 것 (2026-07-20 발견)
    const [rows] = await pool.query(`
      SELECT d.\`품목명\` AS product,
        COALESCE(c.\`카테고리1\`, d.\`카테고리\`) AS cat1,
        COALESCE(c.\`카테고리2\`, d.\`카테고리\`) AS cat2,
        DATE_FORMAT(d.\`판매날짜\`, '%Y-%m-%d') AS date,
        ROUND(SUM(d.\`총매출액\`)) AS amt,
        SUM(d.\`판매수량\`) AS qty
      FROM v_daily_sales_detail d
      LEFT JOIN v_sales_category c ON c.\`품목명\` = d.\`품목명\`
      WHERE d.\`판매날짜\` >= DATE_SUB(CURDATE(), INTERVAL 180 DAY)
        AND d.\`브랜드명\` = '오아'
        AND (c.\`카테고리1\` IS NULL OR c.\`카테고리1\` <> '식품')
      GROUP BY 1, 2, 3, 4
    `);
    const itemMap = {}; // product → {product,cat1,cat2}
    const daily = {};   // product → [[date,amt,qty],...]
    for (const r of rows) {
      itemMap[r.product] = itemMap[r.product] || { product: r.product, cat1: r.cat1, cat2: r.cat2 };
      (daily[r.product] = daily[r.product] || []).push([r.date, Number(r.amt) || 0, Number(r.qty) || 0]);
    }
    const items = Object.values(itemMap);
    console.log(`  → 품목 ${items.length}개 · 일별 ${rows.length}행 (180일)`);

    // 2) 네이버 제품별 일별 광고비 — 광고그룹이 제품 단위 ("선풍기_아이스볼트미스트(상품형)")
    const [navRows] = await pool.query(`
      SELECT adgroup_name AS name, DATE_FORMAT(stat_date, '%Y-%m-%d') AS date,
        ROUND(SUM(sales_amt)) AS spend, SUM(imp_cnt) AS imp, SUM(clk_cnt) AS clk, SUM(conv_cnt) AS conv
      FROM ad_daily_adgroup
      WHERE stat_date >= DATE_SUB(CURDATE(), INTERVAL 180 DAY)
      GROUP BY 1, 2
    `);
    // 광고그룹명 정규화: "(상품형)" 등 괄호 제거, "카테고리_" 접두 제거, 공백 제거
    const tokenOf = (n) => (n || '').replace(/\(.*?\)/g, '').split('_').pop().replace(/\s/g, '').trim();
    // 제품 키 = 품목명에서 '오아' 접두 제거. 광고그룹명→제품 매칭은 이름당 1회만 계산(캐시)
    const keys = items.map(it => ({ p: it.product, k: it.product.replace(/^오아/, '') })).filter(x => x.k.length >= 2);
    const byLenDesc = [...keys].sort((a, b) => b.k.length - a.k.length);
    const byLenAsc = [...keys].sort((a, b) => a.k.length - b.k.length);
    const matchCache = {};
    const matchName = (name) => {
      if (name in matchCache) return matchCache[name];
      const token = tokenOf(name);
      let hit = null;
      if (token.length >= 2) {
        // 1순위 완전일치 → 2순위 토큰이 키 포함(긴 키 우선) → 3순위 키가 토큰 포함(짧은 키 우선)
        hit = keys.find(x => x.k === token)
          || byLenDesc.find(x => token.includes(x.k))
          || byLenAsc.find(x => x.k.includes(token));
      }
      return (matchCache[name] = hit ? hit.p : null);
    };
    const navDaily = {}; // product → {date: [spend,imp,clk,conv]}
    for (const g of navRows) {
      const p = matchName(g.name);
      if (!p) continue;
      const m = navDaily[p] = navDaily[p] || {};
      const a = m[g.date] = m[g.date] || [0, 0, 0, 0];
      a[0] += Number(g.spend) || 0; a[1] += Number(g.imp) || 0; a[2] += Number(g.clk) || 0; a[3] += Number(g.conv) || 0;
    }
    // {date:[...]} → [[date,...],...]
    for (const p of Object.keys(navDaily)) navDaily[p] = Object.entries(navDaily[p]).map(([d, a]) => [d, ...a]);
    const navMatched = Object.values(matchCache).filter(Boolean).length;
    console.log(`  → 네이버 광고그룹 ${Object.keys(matchCache).length}개 중 ${navMatched}개 제품 매칭`);

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
      daily,
      navDaily,
      adSpend: ads.map(r => ({ month: r.month, cat: r.cat, spend: Number(r.spend) })),
    };
    console.log(`  → payload ${(JSON.stringify(value).length / 1024).toFixed(0)}KB`);
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
