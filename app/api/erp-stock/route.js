export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET() {
  try {
    console.log('[erp-stock] SUPA_URL:', SUPA_URL?.slice(0,40), 'KEY exists:', !!SUPA_KEY);
    const res = await fetch(
      `${SUPA_URL}/rest/v1/beauty_stock?select=name,model,cost,stock_qty,order_pending,production_qty,ship_qty,transport_qty&order=name.asc`,
      {
        headers: {
          apikey: SUPA_KEY,
          Authorization: `Bearer ${SUPA_KEY}`,
        },
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: err }, { status: 500 });
    }

    const data = await res.json();
    console.log('[erp-stock] count:', Array.isArray(data) ? data.length : data);
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
