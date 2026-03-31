export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return Response.json({ error: "Supabase 설정 없음" }, { status: 500 });
  }
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/musinsa_prices?select=*&order=brand.asc,name.asc`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    if (!res.ok) return Response.json({ error: `Supabase ${res.status}` }, { status: res.status });
    const data = await res.json();
    return Response.json({ items: data });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
