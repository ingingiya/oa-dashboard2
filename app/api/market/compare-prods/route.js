export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const H = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

export async function GET() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/mkt_compare_prods?select=*&order=category.asc,name.asc`, { headers: H, cache: "no-store" });
  return Response.json(await res.json(), { status: res.status });
}

export async function POST(request) {
  const body = await request.json();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/mkt_compare_prods`, {
    method: "POST",
    headers: { ...H, Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  return Response.json(await res.json(), { status: res.status });
}

export async function PATCH(request) {
  const { id, ...updates } = await request.json();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/mkt_compare_prods?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...H, Prefer: "return=representation" },
    body: JSON.stringify(updates),
  });
  return Response.json(await res.json(), { status: res.status });
}

export async function DELETE(request) {
  const { id } = await request.json();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/mkt_compare_prods?id=eq.${id}`, { method: "DELETE", headers: H });
  return Response.json({ ok: res.ok });
}
