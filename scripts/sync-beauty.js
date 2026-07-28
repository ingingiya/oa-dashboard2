#!/usr/bin/env node
// 이미용 판매 데이터 MySQL → Supabase 동기화
// 실행: node scripts/sync-beauty.js
// 크론: 매일 오전 7시 자동 실행

// 2026-07-27: 전산이 MySQL 직접 접속 차단 → 원격 MCP(mcp-mysql.oa-corp.com) 경유로 전환
const MCP_URL = 'https://mcp-mysql.oa-corp.com/mcp';
const MCP_TOKEN = '256f737e3a5ce9c35588c698ee84b38759c852ac56ce631507110d3f4229ad21';

const SUPA_URL = 'https://lugqeflqusqsyotdiaxg.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1Z3FlZmxxdXNxc3lvdGRpYXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxOTkzMzksImV4cCI6MjA4ODc3NTMzOX0.ls7CN3iISLM_JcGEaVRV_JDSvm4BFqYMU6m4iBGiRA0';

const BEAUTY_IDS = ['DRY','STR','MSG','GVN','ETB','ORL','TBS','SCA','MUM'];
// 기본 30일 (과거분은 이미 동기화됨). 백필: node scripts/sync-beauty.js --days 400
const daysArg = process.argv.indexOf('--days');
const SYNC_DAYS = daysArg > -1 ? Number(process.argv[daysArg + 1]) || 30 : 30;

async function mcpQuery(sql, limit = 200) {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MCP_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'run_query', arguments: { sql, limit } } }),
  });
  const text = await res.text();
  const line = text.split('\n').find(l => l.startsWith('data: '));
  const json = JSON.parse(line ? line.slice(6) : text);
  const content = json?.result?.content?.[0]?.text;
  if (json?.result?.isError) throw new Error(`MCP 쿼리 오류: ${content}`);
  const parsed = JSON.parse(content);
  return parsed.rows || [];
}

// MCP 서버가 결과를 200행으로 하드캡 → OFFSET 페이지네이션
async function fetchBeautySales() {
  const ids = BEAUTY_IDS.map(id => `'${id}'`).join(',');
  const PAGE = 200;
  const all = [];
  for (let offset = 0; ; offset += PAGE) {
    const rows = await mcpQuery(`
      SELECT
        제품명 as name,
        카테고리코드 as cat_id,
        매출처명 as channel,
        DATE_FORMAT(판매날짜, '%Y-%m-%d') as date,
        SUM(판매수량) as qty,
        SUM(총매출액) as revenue,
        SUM(총매출이익) as profit
      FROM db_for_ai_sm.v_daily_sales_detail
      WHERE 판매날짜 >= DATE_SUB(CURDATE(), INTERVAL ${SYNC_DAYS} DAY)
        AND 카테고리코드 IN (${ids})
      GROUP BY 제품명, 카테고리코드, 매출처명, DATE(판매날짜)
      ORDER BY date DESC, 제품명, 매출처명
      LIMIT ${PAGE} OFFSET ${offset}
    `);
    all.push(...rows);
    process.stdout.write(`\r  조회 중... ${all.length}건`);
    if (rows.length < PAGE) break;
  }
  console.log('');
  return all;
}

async function upsertToSupabase(rows) {
  const BATCH = 500;
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map(r => ({
      name: r.name,
      cat_id: r.cat_id, // 'DRY','STR' 등 문자열 코드 (Number 변환 시 null 오염됐었음)
      channel: r.channel || '',
      date: String(r.date),
      qty: Number(r.qty) || 0,
      revenue: Number(r.revenue) || 0,
      profit: Number(r.profit) || 0,
      synced_at: new Date().toISOString(),
    }));

    const res = await fetch(`${SUPA_URL}/rest/v1/beauty_sales?on_conflict=name,cat_id,channel,date`, {
      method: 'POST',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(batch),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Supabase upsert 실패: ${err}`);
    }
    total += batch.length;
    console.log(`  ↑ ${total}/${rows.length}건 완료`);
  }
}

async function main() {
  console.log(`[${new Date().toLocaleString('ko-KR')}] 이미용 동기화 시작 (MCP 경유, 최근 ${SYNC_DAYS}일)`);
  try {
    console.log('MySQL(MCP) 조회 중...');
    const rows = await fetchBeautySales();
    console.log(`  → ${rows.length}건 조회됨`);

    console.log('Supabase 업로드 중...');
    await upsertToSupabase(rows);

    console.log('✅ 동기화 완료!');
  } catch (e) {
    console.error('❌ 오류:', e.message);
    process.exit(1);
  }
}

main();
