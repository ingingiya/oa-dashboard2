export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const H = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform");
  const filter = platform ? `&platform=eq.${platform}` : "";
  const res = await fetch(`${SUPABASE_URL}/rest/v1/market_prices?select=*${filter}&order=brand.asc,name.asc`, { headers: H, cache: "no-store" });
  return Response.json(await res.json(), { status: res.status });
}

export async function POST(request) {
  const body = await request.json();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/market_prices`, {
    method: "POST",
    headers: { ...H, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return Response.json(text ? JSON.parse(text) : { ok: res.ok }, { status: res.ok ? 200 : res.status });
}
