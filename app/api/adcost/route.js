export const dynamic = "force-dynamic";
// 광고 단가 지도 데이터 — scripts/ad-cost-map-sync.py 가 settings.oa_ad_cost_map_v1 에 매일 09:40 푸시
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const r = await fetch(`${url}/rest/v1/settings?key=eq.oa_ad_cost_map_v1&select=value`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" });
  const rows = await r.json();
  const v = Array.isArray(rows) && rows[0] ? rows[0].value : null;
  return Response.json(v || { error: "no data" }, { headers: { "Cache-Control": "no-store" } });
}
