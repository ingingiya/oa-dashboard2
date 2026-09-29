export const dynamic = "force-dynamic";
// 🕵️ 타사 광고 모니터 — ad_monitor_ads(메타 광고 라이브러리 스크랩, scripts/competitor/adlib_monitor.py)에서 게재 중 광고를 검색어별로 반환
const sb = () => { const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY; return { url, h: { apikey: key, Authorization: `Bearer ${key}` } }; };
export async function GET(req) {
  try {
    const { url, h } = sb(); const q = new URL(req.url).searchParams; const all = q.get("all") === "1";
    const r = await fetch(`${url}/rest/v1/ad_monitor_ads?select=id,page_name,creative_body,link_title,link_url,snapshot_url,platforms,started_at,first_seen,last_seen,search_term,is_active${all ? "" : "&is_active=eq.true"}&order=first_seen.desc&limit=2000`, { headers: h, cache: "no-store" });
    const rows = await r.json(); if (!Array.isArray(rows)) throw new Error(JSON.stringify(rows).slice(0, 200));
    const rep = await (await fetch(`${url}/rest/v1/ad_monitor_reports?select=created_at,total_active,new_count,gone_count&order=created_at.desc&limit=1`, { headers: h, cache: "no-store" })).json();
    const byTerm = {}; for (const a of rows) (byTerm[a.search_term || "기타"] ||= []).push(a);
    const week = Date.now() - 7 * 86400e3;
    const terms = Object.entries(byTerm).map(([term, ads]) => ({ term, count: ads.length, newCount: ads.filter(a => new Date(a.first_seen) > week).length, advertisers: [...new Set(ads.map(a => a.page_name))].slice(0, 12), ads })).sort((a, b) => b.count - a.count);
    return Response.json({ ok: true, updated: rep?.[0]?.created_at || null, total: rows.length, newThisWeek: rows.filter(a => new Date(a.first_seen) > week).length, terms }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 }); }
}
