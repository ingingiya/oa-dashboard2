export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// 공구·행사 성과: 기간 중 자사 채널(스마트스토어+자사몰 결제) 판매를 직전 7일·작년 같은 날짜와 비교
// 데이터 = 전산 MySQL 원격 MCP (v_daily_order_detail, 주문등록일 기준)
const MCP_URL = 'https://mcp-mysql.oa-corp.com/mcp';
const CHANNELS = "('스마트스토어','네이버페이','토스페이먼츠','카카오페이')";

async function mcpQuery(sql) {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MCP_MYSQL_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'run_query', arguments: { sql, limit: 200 } } }),
  });
  const text = await res.text();
  const line = text.split('\n').find(l => l.startsWith('data: '));
  const json = JSON.parse(line ? line.slice(6) : text);
  const content = json?.result?.content?.[0]?.text;
  if (json?.result?.isError) throw new Error(content);
  return JSON.parse(content).rows || [];
}

const addDays = (d, n) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const lastYear = d => `${Number(d.slice(0, 4)) - 1}${d.slice(4)}`;
const okDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
const esc = s => String(s).replace(/['\\%_]/g, '');

export async function POST(request) {
  try {
    const { items } = await request.json();
    if (!Array.isArray(items) || !items.length) return Response.json({ results: {} });
    const todayKST = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    const results = {};
    for (const it of items.slice(0, 20)) {
      const { id, product, start } = it;
      let end = it.end || it.start;
      if (!id || !product || !okDate(start) || !okDate(end)) continue;
      const endCut = end > todayKST ? todayKST : end; // 진행 중이면 오늘까지
      if (start > todayKST) {
        const ly0 = lastYear(start), ly1 = lastYear(end); const p0 = esc(product);
        try { const [r] = await mcpQuery(`SELECT SUM(수량) ly_q, SUM(판매금액) ly_amt FROM db_for_ai_sm.v_daily_order_detail WHERE 매출처명 IN ${CHANNELS} AND 제품명 LIKE '${p0}' AND 주문등록일시 BETWEEN '${ly0}' AND '${ly1} 23:59:59'`);
          results[id] = { upcoming: true, lyQ: Number(r?.ly_q || 0), lyAmt: Math.round(Number(r?.ly_amt || 0)) };
        } catch (e) { results[id] = { upcoming: true, error: String(e.message || e).slice(0, 120) }; }
        continue;
      }
      const days = Math.round((new Date(endCut) - new Date(start)) / 864e5) + 1;
      const pre0 = addDays(start, -7), pre1 = addDays(start, -1);
      const ly0 = lastYear(start), ly1 = lastYear(endCut);
      const p = esc(product);
      const sql = `SELECT
        SUM(CASE WHEN DATE(주문등록일시) BETWEEN '${start}' AND '${endCut}' THEN 수량 ELSE 0 END) q,
        SUM(CASE WHEN DATE(주문등록일시) BETWEEN '${start}' AND '${endCut}' THEN 판매금액 ELSE 0 END) amt,
        SUM(CASE WHEN DATE(주문등록일시) BETWEEN '${pre0}' AND '${pre1}' THEN 수량 ELSE 0 END) pre_q,
        SUM(CASE WHEN DATE(주문등록일시) BETWEEN '${ly0}' AND '${ly1}' THEN 수량 ELSE 0 END) ly_q,
        SUM(CASE WHEN DATE(주문등록일시) BETWEEN '${ly0}' AND '${ly1}' THEN 판매금액 ELSE 0 END) ly_amt
        FROM db_for_ai_sm.v_daily_order_detail
        WHERE 매출처명 IN ${CHANNELS} AND 제품명 LIKE '${p}'
          AND ((주문등록일시 BETWEEN '${pre0}' AND '${endCut} 23:59:59') OR (주문등록일시 BETWEEN '${ly0}' AND '${ly1} 23:59:59'))`;
      try {
        const [r] = await mcpQuery(sql);
        const q = Number(r?.q || 0), preQ = Number(r?.pre_q || 0);
        results[id] = {
          days, endCut, live: end > todayKST,
          q, amt: Math.round(Number(r?.amt || 0)),
          perDay: q / days, prePerDay: preQ / 7,
          lyQ: Number(r?.ly_q || 0), lyAmt: Math.round(Number(r?.ly_amt || 0)),
        };
      } catch (e) { results[id] = { error: String(e.message || e).slice(0, 120) }; }
    }
    return Response.json({ results });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
