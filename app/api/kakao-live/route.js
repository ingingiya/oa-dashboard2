export const dynamic = "force-dynamic";
// 🟢 카카오 선물하기 실시간 배지 모니터 — settings.oa_kakao_live_v1 (kakao_live_monitor.py, 10분 간격, 카카오톡 인앱 UA)
export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const r = await fetch(`${url}/rest/v1/settings?key=eq.oa_kakao_live_v1&select=value`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" });
    const rows = await r.json(); const v = rows?.[0]?.value; if (!v) return Response.json({ ok: false, error: "데이터 없음 (모니터 미실행)" });
    const day = Date.now() - 86400e3; const products = v.targets.map(t => { const id = String(t.id); const s = v.samples.map(x => ({ t: x.t, h: x.hl?.[id] || "" }));
      const last = s[s.length - 1]; const on24 = s.filter(x => new Date(x.t) > day && x.h && !x.h.startsWith("ERR"));
      // 시간대별(0~23시) 배지 켜짐 횟수 — 어떤 시간대에 켜지는지
      const byHour = Array(24).fill(0); for (const x of on24) byHour[new Date(x.t).getHours()]++;
      return { id: t.id, name: t.name, now: last?.h || "", nowAt: last?.t || null, on24: on24.length, samples24: s.filter(x => new Date(x.t) > day).length, byHour, lastOn: on24.length ? on24[on24.length - 1] : null, shot: v.shots?.[id]?.url ? { url: v.shots[id].url + "?t=" + encodeURIComponent(v.shots[id].t || ""), t: v.shots[id].t } : null, onShots: v.shots?.[id]?.on || [] }; });
    return Response.json({ ok: true, updated: v.updated, interval: v.interval_min, ua: v.ua, total: v.samples.length, products }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 }); }
}
