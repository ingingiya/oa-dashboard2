export const dynamic = 'force-dynamic';
export const maxDuration = 60;
// 키워드 입찰 가이드(8): 우리 파워링크 그룹(플렌티·프리온)의 키워드별 현재 입찰가·평균 순위·최근 7일 성과 + 1/3/5위 예상 입찰가
import crypto from 'node:crypto';
const BASE = 'https://api.searchad.naver.com';
function hdr(method, path) { const ts = String(Date.now()); const sig = crypto.createHmac('sha256', process.env.NAVER_SECRET_KEY).update(`${ts}.${method}.${path}`).digest('base64'); return { 'X-API-KEY': process.env.NAVER_API_KEY, 'X-Customer': process.env.NAVER_CUSTOMER_ID, 'X-Timestamp': ts, 'X-Signature': sig, 'Content-Type': 'application/json; charset=UTF-8' }; }
async function get(path, q = {}) { const qs = new URLSearchParams(q).toString(); const r = await fetch(`${BASE}${path}${qs ? '?' + qs : ''}`, { headers: hdr('GET', path) }); if (!r.ok) throw new Error(`${path} ${r.status}`); return r.json(); }
async function post(path, body) { const r = await fetch(`${BASE}${path}`, { method: 'POST', headers: hdr('POST', path), body: JSON.stringify(body) }); if (!r.ok) throw new Error(`${path} ${r.status}`); return r.json(); }
export async function GET() {
  try {
    const camps = await get('/ncc/campaigns'); const out = [];
    const d = new Date(Date.now() + 9 * 3600e3); const until = new Date(d); until.setUTCDate(d.getUTCDate() - 1); const since = new Date(d); since.setUTCDate(d.getUTCDate() - 7);
    const tr = JSON.stringify({ since: since.toISOString().slice(0, 10), until: until.toISOString().slice(0, 10) });
    for (const c of camps) {
      if (c.campaignTp !== 'WEB_SITE') continue;
      for (const g of await get('/ncc/adgroups', { nccCampaignId: c.nccCampaignId })) {
        if (!/플렌티플렛|프리온/.test(g.name) || g.userLock) continue;
        const kws = (await get('/ncc/keywords', { nccAdgroupId: g.nccAdgroupId })).filter((k) => !k.userLock);
        if (!kws.length) continue;
        const ids = kws.map((k) => k.nccKeywordId);
        const st = await get('/stats', { ids: ids.join(','), fields: JSON.stringify(['impCnt', 'clkCnt', 'salesAmt', 'purchaseCcnt', 'purchaseConvAmt', 'avgRnk']), timeRange: tr });
        const sm = {}; for (const row of st.data || []) sm[row.id] = row;
        const est = await post('/estimate/average-position-bid/keyword', { device: 'MOBILE', items: kws.flatMap((k) => [1, 3, 5].map((position) => ({ key: k.keyword, position }))) }).catch(() => ({ estimate: [] }));
        const em = {}; for (const e of est.estimate || []) (em[e.keyword] = em[e.keyword] || {})[e.position] = e.bid;
        for (const k of kws) { const s = sm[k.nccKeywordId] || {}; const bid = k.useGroupBidAmt ? g.bidAmt : k.bidAmt; out.push({ group: g.name, keyword: k.keyword, bid, groupBid: !!k.useGroupBidAmt, imp: +s.impCnt || 0, clk: +s.clkCnt || 0, cost: +s.salesAmt || 0, buy: +s.purchaseCcnt || 0, rev: +s.purchaseConvAmt || 0, rank: s.avgRnk ? +(+s.avgRnk).toFixed(1) : null, est: em[k.keyword] || {} }); }
      }
    }
    return Response.json({ at: new Date().toISOString(), rows: out });
  } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}
