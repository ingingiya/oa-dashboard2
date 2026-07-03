#!/usr/bin/env node
// 검색어 순위 MySQL -> Supabase 동기화

const mysql = require('mysql2/promise');

const SUPA_URL = 'https://lugqeflqusqsyotdiaxg.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1Z3FlZmxxdXNxc3lvdGRpYXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxOTkzMzksImV4cCI6MjA4ODc3NTMzOX0.ls7CN3iISLM_JcGEaVRV_JDSvm4BFqYMU6m4iBGiRA0';
const sH = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' };

async function main() {
  console.log(`[${new Date().toLocaleString('ko-KR')}] 검색순위 동기화 시작`);

  const pool = mysql.createPool({
    host: '52.78.125.230', port: 3306,
    user: 'user_for_ai_sm', password: '1234',
    database: 'db_for_ai_sm',
    waitForConnections: true, connectionLimit: 3,
  });

  try {
    // Supabase에서 연동된 제품명 가져오기
    const projRes = await fetch(`${SUPA_URL}/rest/v1/projects?select=products`, { headers: sH });
    const projects = await projRes.json();
    const prodNames = [...new Set((Array.isArray(projects)?projects:[]).flatMap(p=>(p.products||[]).map(pr=>pr.name)).filter(Boolean))];
    if (!prodNames.length) { console.log('연동된 제품 없음'); return; }
    // 제품명에서 핵심 키워드 추출 (브랜드+모델명, 색상/옵션 제거)
    const keywords = [...new Set(prodNames.map(n => {
      // "오아소닉플로우-베이지" → "소닉플로우"
      return n.replace(/^(오아|보아르|삼대오백|뉴트리커먼)/, '').replace(/[-_](화이트|블랙|베이지|그레이|핑크|실버|크림|노즐|파우치|공용).*$/, '').trim();
    }).filter(k => k.length >= 2))];
    console.log(`  연동 제품 ${prodNames.length}개 → 검색 키워드: ${keywords.join(', ')}`);

    const likeConds = keywords.map(() => '채널상품명 COLLATE utf8mb4_unicode_ci LIKE ?').join(' OR ');
    const likeParams = keywords.map(n => `%${n}%`);
    console.log('검색순위 조회 중 (연동 제품만)...');
    const [rows] = await pool.query(`
      SELECT
        검색어 as keyword,
        채널명 as channel,
        검색브랜드 as brand,
        채널상품명 as product_name,
        MIN(순위) as rank_pos,
        MIN(페이지) as page,
        상품타입 as product_type,
        DATE(랭킹등록일시) as date
      FROM v_analyze_search_ranking
      WHERE 랭킹등록일시 >= DATE_SUB(CURDATE(), INTERVAL 400 DAY)
        AND (${likeConds})
      GROUP BY 검색어, 채널명, 검색브랜드, 채널상품명, 상품타입, DATE(랭킹등록일시)
      ORDER BY date DESC
    `, likeParams);
    console.log(`  -> ${rows.length}건`);

    // 중복 제거
    const seen = new Set();
    const deduped = rows.filter(r => {
      const key = `${r.keyword}|${r.channel}|${r.product_name}|${r.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    console.log(`  -> 중복 제거 후 ${deduped.length}건`);

    const data = deduped.map(r => ({
      keyword: r.keyword,
      channel: r.channel,
      brand: r.brand,
      product_name: r.product_name,
      rank_pos: r.rank_pos,
      page: r.page,
      product_type: r.product_type,
      date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
      synced_at: new Date().toISOString(),
    }));

    console.log('Supabase 업로드 중...');
    const BATCH = 500;
    let total = 0;
    for (let i = 0; i < data.length; i += BATCH) {
      const batch = data.slice(i, i + BATCH);
      const res = await fetch(`${SUPA_URL}/rest/v1/search_rankings?on_conflict=keyword,channel,product_name,date`, {
        method: 'POST',
        headers: { ...sH, Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify(batch),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`upsert 실패: ${err}`);
      }
      total += batch.length;
      if (total % 10000 === 0 || total === data.length) console.log(`  ${total}/${data.length}건`);
    }
    console.log('완료!');
  } catch (e) {
    console.error('오류:', e.message);
    process.exit(1);
  } finally {
    await pool.end().catch(() => {});
  }
}

main();
