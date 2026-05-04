export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SYNC_SECRET = process.env.ERP_SYNC_SECRET;

export async function POST(request) {
  const auth = request.headers.get('x-sync-secret');
  if (!SYNC_SECRET || auth !== SYNC_SECRET) {
    return Response.json({ error: '인증 실패' }, { status: 401 });
  }

  try {
    const { rows } = await request.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return Response.json({ error: '데이터 없음' }, { status: 400 });
    }

    const res = await fetch(`${SUPA_URL}/rest/v1/beauty_stock?on_conflict=name`, {
      method: 'POST',
      headers: {
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(rows),
    });

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: err }, { status: 500 });
    }

    return Response.json({ ok: true, count: rows.length, synced_at: new Date().toISOString() });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
