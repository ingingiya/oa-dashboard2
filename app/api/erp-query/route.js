export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function callAgg(p_from, p_to, p_cats) {
  const res = await fetch(`${SUPA_URL}/rest/v1/rpc/beauty_agg`, {
    method: 'POST',
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_from, p_to, p_cats }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { p_from, p_to, p_cats, p_from2, p_to2 } = body;

    if (!p_from || !p_to || !Array.isArray(p_cats)) {
      return Response.json({ error: '파라미터 오류' }, { status: 400 });
    }

    // p_from2/p_to2가 있으면 두 기간을 병렬로 조회해서 한 번에 반환
    if (p_from2 && p_to2) {
      const [cur, prev] = await Promise.all([
        callAgg(p_from, p_to, p_cats),
        callAgg(p_from2, p_to2, p_cats),
      ]);
      return Response.json({ cur, prev });
    }

    const data = await callAgg(p_from, p_to, p_cats);
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
