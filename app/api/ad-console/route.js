export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 🎛 광고 관제 — 캠페인→세트 트리 + 룰 판정 + 실행(예산/온오프) + 조치 로그
// GET  → { kpi, campaigns:[{name, adsets:[{... judgment}]}], gfa, log }
// GET ?adset=ID → { ads:[{name,status,thumb,spend,ctr,purchases,cpa}] }  (소재 드릴다운)
// POST { action:"budget"|"pause"|"resume", adsetId, budget?, note? } → 실행 + 로그

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// 네이버 검색광고 (쇼핑검색 포함) — 라이브 API
async function naverYesterday() {
  const key = process.env.NAVER_API_KEY, cust = process.env.NAVER_CUSTOMER_ID, sec = process.env.NAVER_SECRET_KEY;
  if (!key) return null;
  const nh = (path) => {
    const ts = Date.now().toString();
    return { "X-API-KEY": key, "X-Customer": cust, "X-Timestamp": ts,
      "X-Signature": crypto.createHmac("sha256", sec).update(`${ts}.GET.${path}`).digest("base64") };
  };
  const nget = async (path, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const r = await fetch(`https://api.searchad.naver.com${path}${qs ? "?" + qs : ""}`, { headers: nh(path) });
    if (!r.ok) throw new Error(`네이버 ${path} ${r.status}`);
    return r.json();
  };
  const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const camps = await nget("/ncc/campaigns");
  const rows = [];
  for (const c of camps) {
    if (!["ELIGIBLE", "PAUSED"].includes(c.status)) continue;
    const st = await nget("/stats", { id: c.nccCampaignId,
      fields: JSON.stringify(["salesAmt", "ccnt", "convAmt"]),
      timeRange: JSON.stringify({ since: y, until: y }) });
    const d = st.data?.[0] || {};
    const sp = Number(d.salesAmt || 0);
    if (sp < 1000) continue;
    rows.push({ name: c.name, spend: sp, conv: Number(d.ccnt || 0), rev: Number(d.convAmt || 0) });
  }
  rows.sort((a, b) => b.spend - a.spend);
  const tot = rows.reduce((a, r) => ({ spend: a.spend + r.spend, conv: a.conv + r.conv, rev: a.rev + r.rev }),
    { spend: 0, conv: 0, rev: 0 });
  return { date: y, tot, camps: rows };
}

const GRAPH = "https://graph.facebook.com/v19.0";
const PURCHASE_TYPES = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase",
  "website_purchase", "web_in_store_purchase"];
const LOG_KEY = "oa_ad_actions_log_v1";

const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function g(path, params = {}, method = "GET") {
  const token = process.env.META_ACCESS_TOKEN;
  const body = new URLSearchParams({ ...params, access_token: token });
  const r = method === "GET"
    ? await fetch(`${GRAPH}/${path}?${body}`)
    : await fetch(`${GRAPH}/${path}`, { method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j;
}

// ★뷰스루 과대귀속 방지 — 판정·표시는 클릭 귀속(7d_click) 기준, 뷰스루는 별도 표기
const purchasesOf = (row, win = "7d_click") => {
  for (const key of ["catalog_segment_actions", "actions"])
    for (const a of row?.[key] || [])
      if (PURCHASE_TYPES.includes(a.action_type))
        return Math.round(Number(win === "value" ? a.value : a[win]) || 0);
  return 0;
};
const viewOf = (row) => purchasesOf(row, "1d_view");
const weightedOf = (row) => purchasesOf(row) + 0.3 * viewOf(row); // 판정용 가중 구매
const revenueOf = (row) => {
  for (const key of ["catalog_segment_value", "action_values"])
    for (const a of row?.[key] || [])
      if (PURCHASE_TYPES.includes(a.action_type)) return Number(a.value) || 0;
  return 0;
};

async function targets() {
  // 캠페인별 목표 CPA — settings KV (없으면 기본 1만)
  const { data } = await sb().from("settings").select("value").eq("key", "oa_ad_targets_v1").maybeSingle();
  return data?.value || { default: 10000, rules: [{ match: "부스터", cpa: 10000 }] };
}
const targetFor = (conf, campName) => {
  for (const r of conf.rules || []) if (r.match && (campName || "").includes(r.match)) return Number(r.cpa) || conf.default;
  return Number(conf.default) || 10000;
};

export async function GET(req) {
  try {
    const acct = (process.env.META_AD_ACCOUNT_ID || "").replace("act_", "");
    const url = new URL(req.url);

    // ── 소재 드릴다운 ──
    const adsetId = url.searchParams.get("adset");
    if (adsetId) {
      const ads = await g(`${adsetId}/ads`, {
        fields: "name,status,effective_status,creative{thumbnail_url,image_url},insights.date_preset(last_7d).action_attribution_windows(['7d_click','1d_view']){spend,ctr,actions,catalog_segment_actions}",
        limit: "50",
      });
      return Response.json({
        ok: true,
        ads: (ads.data || []).map((a) => {
          const i = a.insights?.data?.[0] || {};
          const sp = Number(i.spend || 0), pu = purchasesOf(i), w = purchasesOf(i) + 0.3 * viewOf(i);
          return { id: a.id, name: a.name, status: a.effective_status,
            thumb: a.creative?.image_url || a.creative?.thumbnail_url || "",
            spend: Math.round(sp), ctr: Number(i.ctr || 0), purchases: pu,
            cpa: w >= 1 ? Math.round(sp / w) : null };
        }).sort((x, y) => y.spend - x.spend),
      });
    }

    // ── 전체 트리 ──
    // ★5분 KV 캐시 — 열 때마다 Graph API 풀호출하면 메타 사용자 호출 제한(User request limit)에 걸림 (08-28 실측)
    //   순찰 버튼·조치 직후는 ?fresh=1로 강제 갱신
    const CACHE_KEY = "oa_ad_console_cache_v1";
    const fresh = url.searchParams.get("fresh") === "1";
    if (!fresh) {
      const { data: cRow } = await sb().from("settings").select("value").eq("key", CACHE_KEY).maybeSingle();
      const c = cRow?.value;
      if (c?.at && Date.now() - c.at < 5 * 60_000 && c.payload)
        return Response.json({ ...c.payload, cachedAt: c.at });
    }
    const conf = await targets();
    const KPI_FIELDS = "spend,actions,action_values,catalog_segment_actions,catalog_segment_value";
    const AW = JSON.stringify(["7d_click", "1d_view"]);
    const [camps, kpiY, kpi7, kpi30] = await Promise.all([
      g(`act_${acct}/campaigns`, { fields: "id,name,effective_status", limit: "200" }),
      g(`act_${acct}/insights`, { date_preset: "yesterday", fields: KPI_FIELDS, action_attribution_windows: AW }),
      g(`act_${acct}/insights`, { date_preset: "last_7d", fields: KPI_FIELDS, action_attribution_windows: AW }),
      g(`act_${acct}/insights`, { date_preset: "last_30d", fields: KPI_FIELDS, action_attribution_windows: AW }),
    ]);
    const active = (camps.data || []).filter((c) => c.effective_status === "ACTIVE");
    const kpi = {};
    for (const [k, r] of [["yesterday", kpiY.data?.[0]], ["week", kpi7.data?.[0]], ["month", kpi30.data?.[0]]]) {
      const sp = Number(r?.spend || 0), pu = purchasesOf(r), vw = viewOf(r), rev = revenueOf(r);
      const w = pu + 0.3 * vw;
      kpi[k] = { spend: Math.round(sp), purchases: pu, views: vw, roas: sp ? +(rev / sp).toFixed(2) : 0,
        cpa: w >= 1 ? Math.round(sp / w) : null };
    }

    // 세트 + 성과 (7일/3일) — 인사이트는 계정 단위 한 번에
    const [ins7, ins3] = await Promise.all(["last_7d", "last_3d"].map((p) =>
      g(`act_${acct}/insights`, { level: "adset", date_preset: p, limit: "300",
        fields: "adset_id,campaign_id,spend,ctr,actions,catalog_segment_actions",
        action_attribution_windows: JSON.stringify(["7d_click", "1d_view"]) })));
    const by7 = Object.fromEntries((ins7.data || []).map((r) => [r.adset_id, r]));
    const by3 = Object.fromEntries((ins3.data || []).map((r) => [r.adset_id, r]));

    const campaigns = [];
    for (const c of active) {
      const sets = await g(`${c.id}/adsets`, {
        fields: "id,name,daily_budget,effective_status,optimization_goal", limit: "100" });
      const tgt = targetFor(conf, c.name);
      const rows = (sets.data || []).filter((s) => s.effective_status !== "DELETED").map((s) => {
        const r7 = by7[s.id] || {}, r3 = by3[s.id] || {};
        const sp7 = Number(r7.spend || 0), pu7 = weightedOf(r7);
        const sp3 = Number(r3.spend || 0), pu3 = weightedOf(r3);
        const cpa7 = pu7 >= 1 ? sp7 / pu7 : null, cpa3 = pu3 >= 1 ? sp3 / pu3 : null;
        const goal = (s.optimization_goal || "").toUpperCase();
        const isTraffic = /LANDING|LINK_CLICK|TRAFFIC/.test(goal);
        let judge = "";
        if (!isTraffic && s.effective_status === "ACTIVE" && sp7 > 0) {
          if (pu7 >= 8 && cpa7 && cpa7 <= tgt && (!cpa3 || cpa3 <= tgt * 1.5)) judge = "scale";
          else if ((sp7 >= tgt * 3 && pu7 === 0) || (cpa7 && cpa7 >= tgt * 3 && sp7 >= 100000)) judge = "kill";
          else if (cpa7 && cpa7 >= tgt * 2 && sp7 >= 100000) judge = "watch";
        }
        return { id: s.id, name: s.name, status: s.effective_status, view7: viewOf(r7),
          budget: Number(s.daily_budget || 0), goal: isTraffic ? "트래픽" : "전환",
          spend7: Math.round(sp7), purchases7: purchasesOf(r7), cpa7: cpa7 ? Math.round(cpa7) : null,
          spend3: Math.round(sp3), cpa3: cpa3 ? Math.round(cpa3) : null,
          ctr7: Number(r7.ctr || 0), judge, target: tgt };
      }).filter((s) => s.status === "ACTIVE" || s.spend7 > 0)
        .sort((a, b) => b.spend7 - a.spend7);
      if (rows.length) campaigns.push({ id: c.id, name: c.name, target: tgt, adsets: rows });
    }
    campaigns.sort((a, b) => b.adsets.reduce((s, x) => s + x.spend7, 0) - a.adsets.reduce((s, x) => s + x.spend7, 0));

    // 네이버 검색광고 — 라이브 (실패해도 나머지는 응답)
    let naver = null;
    try { naver = await naverYesterday(); } catch { }

    // GFA — 로컬 크론이 적재한 최신 스냅샷 (없으면 생략)
    const { data: gfaRow } = await sb().from("settings").select("value").eq("key", "oa_gfa_daily_v1").maybeSingle();

    // 조치 로그 (최근 30) — "손댄 건 성공했나" 추적: 조치한 세트의 현재 3일 성과로 판정
    const { data: logRow } = await sb().from("settings").select("value").eq("key", LOG_KEY).maybeSingle();
    const setIndex = {};
    for (const c of campaigns) for (const s of c.adsets) setIndex[s.id] = s;
    const log = (logRow?.value?.items || []).slice(0, 30).map((l) => {
      const s = setIndex[l.adsetId];
      if (!s) return l;
      const hours = (Date.now() - new Date(l.at).getTime()) / 3.6e6;
      let verdict = null;
      if (l.desc?.includes("예산") && hours >= 24) {
        // 증액(버프)의 성공 = 조치 후 3일 CPA가 목표 이내 유지
        verdict = s.cpa3 == null ? (s.spend3 > 0 ? "fail" : null) : s.cpa3 <= s.target ? "win" : "fail";
      }
      return { ...l, now: { cpa3: s.cpa3, spend3: s.spend3, target: s.target, status: s.status }, verdict };
    });

    const payload = { ok: true, kpi, campaigns, naver, gfa: gfaRow?.value || null, log, targets: conf };
    await sb().from("settings").upsert({ key: CACHE_KEY, value: { at: Date.now(), payload } }, { onConflict: "key" });
    return Response.json({ ...payload, cachedAt: Date.now() });
  } catch (e) {
    return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { action, adsetId, budget, note, name } = await req.json();
    if (!adsetId) throw new Error("adsetId 필요");
    let desc = "";
    if (action === "budget") {
      const b = Math.round(Number(budget));
      if (!b || b < 5000) throw new Error("예산은 5,000원 이상");
      await g(adsetId, { daily_budget: String(b) }, "POST"); // KRW 제로데시멀
      desc = `예산 변경 → ₩${b.toLocaleString()}`;
    } else if (action === "pause" || action === "resume") {
      await g(adsetId, { status: action === "pause" ? "PAUSED" : "ACTIVE" }, "POST");
      desc = action === "pause" ? "세트 OFF" : "세트 ON";
    } else throw new Error("지원하지 않는 액션");

    // 조치 성공 → 캐시 무효화
    const s = sb();
    await s.from("settings").upsert({ key: "oa_ad_console_cache_v1", value: { at: 0 } }, { onConflict: "key" });
    // 로그
    const { data } = await s.from("settings").select("value").eq("key", LOG_KEY).maybeSingle();
    const items = data?.value?.items || [];
    items.unshift({ at: new Date().toISOString(), adsetId, name: String(name || "").slice(0, 50),
      desc, note: String(note || "").slice(0, 80) });
    await s.from("settings").upsert({ key: LOG_KEY, value: { items: items.slice(0, 200) } }, { onConflict: "key" });
    return Response.json({ ok: true, desc });
  } catch (e) {
    return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
