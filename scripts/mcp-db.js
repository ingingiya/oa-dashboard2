// 전산 원격 MySQL MCP(mcp-mysql.oa-corp.com) 쿼리 헬퍼
// 2026-07-27: 전산이 MySQL 직접 접속 차단 → 모든 로컬 동기화 스크립트가 이 헬퍼 사용
// 서버가 결과를 200행으로 하드캡 → queryAll()이 LIMIT/OFFSET 페이지네이션 자동 처리
// ⚠️ 페이지네이션 일관성을 위해 SQL에 결정적 ORDER BY 필수 (LIMIT/OFFSET는 헬퍼가 붙임)

const MCP_URL = 'https://mcp-mysql.oa-corp.com/mcp';
const MCP_TOKEN = '256f737e3a5ce9c35588c698ee84b38759c852ac56ce631507110d3f4229ad21';
const PAGE = 200;

async function rawQuery(sql, attempt = 0) {
  try {
    return await rawQueryOnce(sql);
  } catch (e) {
    if (attempt >= 3) throw e;
    await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    return rawQuery(sql, attempt + 1);
  }
}

async function rawQueryOnce(sql) {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MCP_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'run_query', arguments: { sql, limit: PAGE } } }),
  });
  const text = await res.text();
  const line = text.split('\n').find(l => l.startsWith('data: '));
  const json = JSON.parse(line ? line.slice(6) : text);
  const content = json?.result?.content?.[0]?.text;
  if (!json?.result || json.result.isError) throw new Error(`MCP 쿼리 오류: ${content || text.slice(0, 300)}`);
  return JSON.parse(content).rows || [];
}

// 전체 행 조회 (200행씩 자동 페이지네이션). sql엔 LIMIT/OFFSET 넣지 말 것
async function queryAll(sql, { quiet = false } = {}) {
  const base = sql.trim().replace(/;$/, '');
  const all = [];
  for (let offset = 0; ; offset += PAGE) {
    const rows = await rawQuery(`${base} LIMIT ${PAGE} OFFSET ${offset}`);
    all.push(...rows);
    if (!quiet) process.stdout.write(`\r  조회 중... ${all.length}행`);
    if (rows.length < PAGE) break;
  }
  if (!quiet && all.length) process.stdout.write('\n');
  return all;
}

module.exports = { queryAll, rawQuery };
