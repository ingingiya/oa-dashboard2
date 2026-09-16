export const dynamic = "force-dynamic";
// 📨 광고 매체 제안 비교 — settings.oa_media_proposals_v1 {items:[...], updated}
// /ads 「매체 제안」 탭이 GET 으로 읽고, 메모·상태·일정은 PATCH 로 갱신한다. 비어 있으면 docs/media-proposals.seed.json 으로 시작.
import { readFileSync } from "fs";
import { resolve } from "path";
const KEY = "oa_media_proposals_v1";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,PATCH,OPTIONS", "Access-Control-Allow-Headers": "content-type,x-adcost-key", "Cache-Control": "no-store" };
const auth = (req) => { const k = req.headers.get("x-adcost-key") || new URL(req.url).searchParams.get("k"); return k && k === process.env.ADCOST_KEY; };
export async function OPTIONS() { return new Response(null, { headers: CORS }); }
const sb = () => { const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY; return { url, h: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" } }; };
async function load() {
  const { url, h } = sb();
  const r = await fetch(`${url}/rest/v1/settings?key=eq.${KEY}&select=value`, { headers: h, cache: "no-store" });
  const rows = await r.json();
  if (Array.isArray(rows) && rows[0]?.value?.items?.length) return rows[0].value;
  try { return JSON.parse(readFileSync(resolve(process.cwd(), "docs/media-proposals.seed.json"), "utf8")); } catch { return { items: [] }; }
}
async function save(v) {
  const { url, h } = sb();
  const r = await fetch(`${url}/rest/v1/settings?on_conflict=key`, { method: "POST", headers: { ...h, Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ key: KEY, value: { ...v, updated: new Date().toISOString() } }) });
  if (!r.ok) throw new Error("supabase " + r.status + " " + (await r.text()).slice(0, 200));
}
export async function GET(req) { const same = !new URL(req.url).searchParams.has("k") && !req.headers.get("x-adcost-key"); if (!same && !auth(req)) return Response.json({ error: "unauthorized" }, { status: 401, headers: CORS }); return Response.json(await load(), { headers: CORS }); }
export async function PATCH(req) {
  const b = await req.json(); const v = await load();
  if ((new URL(req.url).searchParams.has("k") || req.headers.get("x-adcost-key")) && !auth(req)) return Response.json({ error: "unauthorized" }, { status: 401, headers: CORS });
  if (typeof b.comment === "string" && !b.id) { v.comment = String(b.comment).slice(0, 6000); await save(v); return Response.json({ ok: true, comment: v.comment }, { headers: CORS }); }
  const it = v.items.find((i) => i.id === b.id); if (!it) return Response.json({ error: "no item" }, { status: 404, headers: CORS });
  for (const k of ["status", "memo", "decision", "next_action", "budget_plan"]) if (b[k] !== undefined) it[k] = String(b[k]).slice(0, 2000);
  if (Array.isArray(b.products)) it.products = b.products.slice(0, 40).map((r) => ({ name: String(r.name || "").slice(0, 60), price: String(r.price || "").slice(0, 60), ctr: String(r.ctr || "").slice(0, 40), cpc: r.cpc == null ? null : Number(r.cpc), note: String(r.note || "").slice(0, 120), pick: !!r.pick }));
  if (Array.isArray(b.timeline_add)) for (const t of b.timeline_add) it.timeline.push({ date: String(t.date).slice(0, 10), what: String(t.what).slice(0, 200), dir: t.dir === "in" ? "in" : "out" });
  await save(v); return Response.json({ ok: true, item: it }, { headers: CORS });
}
