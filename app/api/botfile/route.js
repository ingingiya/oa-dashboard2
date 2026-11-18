// 경은이복사봇 결과 HTML 보기 — 스토리지는 HTML을 text/plain으로만 내줘서 여기서 text/html로 다시 내줌 (globalbot/ 경로만)
export const dynamic = "force-dynamic";
const SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
export async function GET(req) {
  const p = new URL(req.url).searchParams.get("p") || "";
  if (!/^globalbot\/[a-z0-9]+\/[\w.-]+\.html$/i.test(p)) return new Response("bad path", { status: 400 });
  const r = await fetch(`${SB}/storage/v1/object/public/ad-images/${p}`, { cache: "no-store" });
  if (!r.ok) return new Response("not found", { status: 404 });
  return new Response(await r.text(), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
