export const dynamic = 'force-dynamic';
// 유튜버 협찬 리스트(oa-youtubers) 프록시 — 키는 서버에만
export async function GET() {
  const k = process.env.YT_LIST_KEY;
  if (!k) return Response.json({ error: "YT_LIST_KEY 없음" }, { status: 500 });
  try {
    const r = await fetch(`https://oa-youtubers.vercel.app/api/leads?k=${k}`, { cache: "no-store" });
    const d = await r.json();
    const rows = Array.isArray(d) ? d : d.leads || d.rows || d.items || [];
    return Response.json({ rows });
  } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}
export async function PATCH(request) {
  const k = process.env.YT_LIST_KEY;
  const body = await request.json();
  const r = await fetch(`https://oa-youtubers.vercel.app/api/leads`, { method: "PATCH", headers: { "Content-Type": "application/json", "x-key": k }, body: JSON.stringify(body) });
  return Response.json(await r.json().catch(() => ({ ok: r.ok })), { status: r.status });
}
