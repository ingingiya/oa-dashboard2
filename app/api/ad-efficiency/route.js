export const dynamic = "force-dynamic";
// 📊 광고 효율 요약 — 독립 관제판(oa-adcost.vercel.app/data.json)의 latest.summary(채널×목표×카테고리, 최근 30일)를
// 홈 카드용으로 정리: 채널별 평균 CPC/CPM/ROAS, 카테고리별 합산, 이번 달 결론(actions). 서버에서 fetch → CORS 회피.
const SRC = "https://oa-adcost.vercel.app/data.json";
const CH_LABEL = { meta: "메타", adboost: "네이버(AD부스터)", esm: "G마켓·옥션", ably: "에이블리", zigzag: "지그재그", coupang: "쿠팡", x: "X(트위터)", gfa: "네이버 GFA" };
const agg = (rows) => { const s = { spend: 0, clicks: 0, imp: 0, rev: 0, tracked: false }; for (const r of rows) { s.spend += r.spend || 0; s.clicks += r.clicks || 0; s.imp += r.imp || 0; s.rev += r.rev || 0; if (r.roas != null) s.tracked = true; } return { ...s, cpc: s.clicks ? Math.round(s.spend / s.clicks) : null, cpm: s.imp ? Math.round(s.spend / s.imp * 1000) : null, roas: s.tracked && s.spend ? Math.round(s.rev / s.spend * 10) / 10 : null }; };
// 인메모리 캐시: data.json(1.2MB) 매 요청 fetch가 간헐 타임아웃 → 카드가 떴다 안 떴다 (09-21). 15분 캐시 + 실패 시 마지막 성공값
let CACHE = { t: 0, body: null };
async function loadSrc() {
  if (CACHE.body && Date.now() - CACHE.t < 15 * 60 * 1000) return CACHE.body;
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 8000);
  try { const d = await (await fetch(SRC + "?t=" + Math.floor(Date.now() / 60000), { cache: "no-store", signal: ctl.signal })).json(); CACHE = { t: Date.now(), body: d }; return d; }
  catch (e) { if (CACHE.body) return CACHE.body; throw e; } finally { clearTimeout(tm); }
}
export async function GET() {
  try {
    const d = await loadSrc();
    const sum = d.latest?.summary || {}, periods = d.latest?.channels || {};
    const byChannel = [], catMap = {};
    for (const [ch, v] of Object.entries(sum)) {
      const goals = Object.entries(v.by_goal || {}).filter(([, r]) => r && r.spend > 0).map(([goal, r]) => ({ goal, spend: r.spend, clicks: r.clicks, imp: r.imp, rev: r.rev, cpc: r.cpc, cpm: r.cpm, roas: r.roas, n: r.n }));
      if (goals.length) byChannel.push({ id: ch, channel: CH_LABEL[ch] || ch, period: periods[ch]?.period || null, error: periods[ch]?.error || null, total: agg(goals), goals: goals.sort((a, b) => b.spend - a.spend) });
      // by_cat 키는 "카테고리 | 목표" 평탄 구조 (값이 바로 행). 중첩형도 함께 허용
      for (const [key, val] of Object.entries(v.by_cat || {})) {
        if (!val) continue;
        if (typeof val.spend === "number") { const [cat, goal] = key.split(" | "); if (val.spend > 0) (catMap[cat.trim()] ||= []).push({ channel: CH_LABEL[ch] || ch, goal: (goal || "").trim(), ...val }); }
        else for (const [goal, r] of Object.entries(val)) { if (!r || typeof r !== "object" || !(r.spend > 0)) continue; (catMap[key] ||= []).push({ channel: CH_LABEL[ch] || ch, goal, ...r }); }
      }
    }
    for (const [ch, p] of Object.entries(periods)) if (p?.error && !byChannel.some(c => c.id === ch)) byChannel.push({ id: ch, channel: CH_LABEL[ch] || ch, period: null, error: p.error, total: null, goals: [] });
    const byCategory = Object.entries(catMap).map(([cat, rows]) => ({ cat, total: agg(rows), rows: rows.sort((a, b) => b.spend - a.spend).map(r => ({ channel: r.channel, goal: r.goal, spend: r.spend, cpc: r.cpc, cpm: r.cpm, roas: r.roas })) })).sort((a, b) => b.total.spend - a.total.spend);
    const all = agg(byChannel.flatMap(c => c.goals));
    // 효율 하이라이트: ROAS 추적되는 것 중 최고/최저, 트래픽(랜딩) 목적은 CPC 최저
    const tracked = byChannel.flatMap(c => c.goals.filter(g => g.roas != null && g.spend >= 200000).map(g => ({ ...g, channel: c.channel })));
    const traffic = byChannel.flatMap(c => c.goals.filter(g => g.roas == null && g.clicks >= 500).map(g => ({ ...g, channel: c.channel })));
    const highlights = { bestRoas: tracked.sort((a, b) => b.roas - a.roas).slice(0, 3), worstRoas: tracked.filter(g => g.roas < 2).sort((a, b) => a.roas - b.roas).slice(0, 3), cheapestClick: traffic.sort((a, b) => a.cpc - b.cpc).slice(0, 3) };
    return Response.json({ ok: true, updated: d.updated, all, byChannel: byChannel.sort((a, b) => (b.total?.spend || 0) - (a.total?.spend || 0)), byCategory, highlights, actions: d.actions || [], links: { board: "https://oa-adcost.vercel.app/", report: "https://oa-adcost.vercel.app/report.html", proposals: "https://oa-adcost.vercel.app/proposals.html" } }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 }); }
}
