export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

export async function GET() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/musinsa_links?select=*&order=id.asc`, { headers });
  const data = await res.json();
  return Response.json(data);
}

export async function POST(req) {
  const body = await req.json();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/musinsa_links`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}

export async function PATCH(req) {
  const { id, ...updates } = await req.json();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/musinsa_links?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}

export async function DELETE(req) {
  const { id } = await req.json();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/musinsa_links?id=eq.${id}`, {
    method: "DELETE",
    headers,
  });
  return Response.json({ ok: res.ok });
}
