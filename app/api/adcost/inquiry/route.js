export const dynamic = "force-dynamic";
// 광고 매체 문의 메일 대기열 — settings.oa_ad_inquiries_v1 {items:[{id,created_at,media_name,to_email,product,subject,body,sender_name,sender_email,status,sent_at,error}]}
// 정적 현황판(oa-adcost.vercel.app)이 ?k=ADCOST_KEY 로 호출. 실제 발송은 로컬 scripts/ad-inquiry-send.mjs 가 10분마다.
const KEY = "oa_ad_inquiries_v1";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS", "Access-Control-Allow-Headers": "content-type,x-adcost-key", "Cache-Control": "no-store" };
const sb = () => { const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY; return { url, h: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" } }; };
async function load() { const { url, h } = sb(); const r = await fetch(`${url}/rest/v1/settings?key=eq.${KEY}&select=value`, { headers: h, cache: "no-store" }); const rows = await r.json(); return (Array.isArray(rows) && rows[0]?.value?.items) || []; }
async function save(items) { const { url, h } = sb(); const r = await fetch(`${url}/rest/v1/settings?on_conflict=key`, { method: "POST", headers: { ...h, Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ key: KEY, value: { items, updated: new Date().toISOString() } }) }); if (!r.ok) throw new Error("supabase " + r.status + " " + (await r.text()).slice(0, 200)); }
const auth = (req) => { const k = req.headers.get("x-adcost-key") || new URL(req.url).searchParams.get("k"); return k && k === process.env.ADCOST_KEY; };
export async function OPTIONS() { return new Response(null, { headers: CORS }); }
export async function GET(req) { if (!auth(req)) return Response.json({ error: "unauthorized" }, { status: 401, headers: CORS }); return Response.json({ items: await load() }, { headers: CORS }); }
export async function POST(req) {
  if (!auth(req)) return Response.json({ error: "unauthorized" }, { status: 401, headers: CORS });
  const body = await req.json(); const add = Array.isArray(body.items) ? body.items : [];
  if (!add.length || add.length > 50) return Response.json({ error: "items 1~50" }, { status: 400, headers: CORS });
  const items = await load(); const now = new Date().toISOString(); let seq = items.reduce((m, i) => Math.max(m, i.id || 0), 0);
  for (const a of add) {
    if (!a.to_email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.to_email)) continue;
    items.push({ id: ++seq, created_at: now, media_name: String(a.media_name || "").slice(0, 120), to_email: a.to_email.trim(), cc_email: String(a.cc_email || "").slice(0, 200), product: String(a.product || "").slice(0, 120), subject: String(a.subject || "").slice(0, 200), body: String(a.body || "").slice(0, 6000), sender_name: String(a.sender_name || "").slice(0, 60), sender_email: String(a.sender_email || "").slice(0, 120), status: ["pending", "opened"].includes(a.status) ? a.status : "pending", sent_at: null, error: null });
  }
  await save(items); return Response.json({ ok: true, count: items.length }, { headers: CORS });
}
export async function PATCH(req) {
  if (!auth(req)) return Response.json({ error: "unauthorized" }, { status: 401, headers: CORS });
  const { id, status, error, sent_at, remove } = await req.json(); let items = await load();
  if (remove) items = items.filter((i) => i.id !== id); else for (const i of items) if (i.id === id) { if (status) i.status = status; if (error !== undefined) i.error = error; if (sent_at) i.sent_at = sent_at; }
  await save(items); return Response.json({ ok: true }, { headers: CORS });
}
