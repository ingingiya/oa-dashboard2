#!/usr/bin/env node
// 전제품 검색순위 동기화: v_analyze_search_ranking(사내 크롤러, 네이버쇼핑 707개 키워드)
// → 검색브랜드='오아' 키워드×일자 최고순위 90일 → Supabase settings.oa_searchrank_v1
// 실행: node scripts/sync-search-rank-all.js  · 크론: 매일 9:10 (크롤러는 매일 ~17시 갱신)

const mysql = require('mysql2/promise');

const SUPA_URL = 'https://lugqeflqusqsyotdiaxg.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1Z3FlZmxxdXNxc3lvdGRpYXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxOTkzMzksImV4cCI6MjA4ODc3NTMzOX0.ls7CN3iISLM_JcGEaVRV_JDSvm4BFqYMU6m4iBGiRA0';

async function main() {
  console.log(`[${new Date().toLocaleString('ko-KR')}] 전제품 검색순위 동기화 시작`);
  const pool = mysql.createPool({
    host: '52.78.125.230',
    port: 3306,
    user: 'user_for_ai_sm',
    password: '1234',
    database: 'db_for_ai_sm',
    connectionLimit: 2,
  });
  try {
    // 1) 키워드×일자 오아 최고순위 (90일)
    const [rows] = await pool.query(`
      SELECT \`검색어\` AS kw, DATE_FORMAT(\`랭킹등록일시\`,'%Y-%m-%d') AS date, MIN(\`순위\`) AS r
      FROM v_analyze_search_ranking
      WHERE \`검색브랜드\` = '오아'
        AND \`랭킹등록일시\` >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
      GROUP BY 1, 2
    `);
    const ranks = {}; // kw → [[date, rank], ...]
    for (const row of rows) (ranks[row.kw] = ranks[row.kw] || []).push([row.date, Number(row.r)]);
    for (const kw of Object.keys(ranks)) ranks[kw].sort((a, b) => a[0] < b[0] ? -1 : 1);
    console.log(`  → 키워드 ${Object.keys(ranks).length}개 · ${rows.length}행 (90일)`);

    // 2) 최근 2일 내 최고순위 상품명 (키워드별 대표 제품)
    const [pRows] = await pool.query(`
      SELECT \`검색어\` AS kw, \`채널상품명\` AS name, \`순위\` AS r
      FROM v_analyze_search_ranking
      WHERE \`검색브랜드\` = '오아'
        AND \`랭킹등록일시\` >= DATE_SUB(CURDATE(), INTERVAL 2 DAY)
    `);
    const prods = {}; // kw → 상품명 (최고순위 기준)
    const best = {};
    for (const row of pRows) {
      if (best[row.kw] == null || Number(row.r) < best[row.kw]) { best[row.kw] = Number(row.r); prods[row.kw] = row.name; }
    }

    const value = { updated: new Date().toISOString(), ranks, prods };
    console.log(`  → payload ${(JSON.stringify(value).length / 1024).toFixed(0)}KB`);
    const res = await fetch(`${SUPA_URL}/rest/v1/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ key: 'oa_searchrank_v1', value, updated_at: new Date().toISOString() }),
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
