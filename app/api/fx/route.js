export const dynamic = 'force-dynamic';
// 환율 (KRW 기준 1단위 외화 가격) — 해외 판매가 계산기용
export async function GET() {
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/KRW", { next: { revalidate: 3600 } });
    const d = await r.json(); const x = d.rates || {};
    const inv = (c) => x[c] ? Math.round(1 / x[c] * 100) / 100 : null;
    return Response.json({ at: d.time_last_update_utc, JPY: inv("JPY"), TWD: inv("TWD"), USD: inv("USD"), SGD: inv("SGD"), THB: inv("THB") });
  } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}
