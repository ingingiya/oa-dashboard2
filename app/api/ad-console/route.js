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

    // ── 인사카드(세트 상세) — 14일 일별 추이 + 누적 지표 ──
    const detailId = url.searchParams.get("detail");
    if (detailId) {
      const AW0 = JSON.stringify(["7d_click", "1d_view"]);
      const isCamp = url.searchParams.get("kind") === "camp";
      const [meta, daily, tot] = await Promise.all([
        g(detailId, { fields: isCamp ? "name,effective_status,created_time" : "name,daily_budget,effective_status,optimization_goal,created_time" }),
        g(`${detailId}/insights`, { date_preset: "last_14d", time_increment: "1",
          fields: "date_start,spend,impressions,clicks,actions,catalog_segment_actions",
          action_attribution_windows: AW0, limit: "20" }),
        g(`${detailId}/insights`, { date_preset: "last_14d",
          fields: "spend,impressions,reach,clicks,ctr,cpc,frequency,actions,action_values,catalog_segment_actions,catalog_segment_value",
          action_attribution_windows: AW0 }),
      ]);
      const t = tot.data?.[0] || {};
      const sp = Number(t.spend || 0), pu = purchasesOf(t), vw = viewOf(t), rev = revenueOf(t);
      const w = pu + 0.3 * vw;
      // 소재별 + 제품별(CPAS product_id 브레이크다운) — 세트일 때만, 실패해도 개요는 응답
      let adsList = [], products = [];
      if (!isCamp) {
        try {
          const adsR = await g(`${detailId}/ads`, {
            fields: "name,effective_status,creative{thumbnail_url,image_url},insights.date_preset(last_14d).action_attribution_windows(['7d_click','1d_view']){spend,ctr,actions,catalog_segment_actions,action_values,catalog_segment_value}",
            limit: "50" });
          adsList = (adsR.data || []).map((a) => {
            const i = a.insights?.data?.[0] || {};
            const asp = Number(i.spend || 0), apu = purchasesOf(i), avw = viewOf(i), arev = revenueOf(i);
            const aw = apu + 0.3 * avw;
            return { id: a.id, name: a.name, status: a.effective_status,
              thumb: a.creative?.image_url || a.creative?.thumbnail_url || "",
              spend: Math.round(asp), ctr: Number(i.ctr || 0), purchases: apu, views: avw,
              revenue: Math.round(arev), roas: asp ? +(arev / asp).toFixed(2) : 0,
              cpa: aw >= 1 ? Math.round(asp / aw) : null };
          }).sort((x, y) => y.spend - x.spend);
        } catch {}
        try {
          const pr = await g(`${detailId}/insights`, { date_preset: "last_14d", breakdowns: "product_id",
            fields: "spend,actions,catalog_segment_actions,action_values,catalog_segment_value",
            action_attribution_windows: AW0, limit: "50" });
          products = (pr.data || []).map((r) => {
            const psp = Number(r.spend || 0), ppu = purchasesOf(r), pvw = viewOf(r), prev = revenueOf(r);
            return { productId: r.product_id || "", spend: Math.round(psp), purchases: ppu, views: pvw,
              revenue: Math.round(prev), roas: psp ? +(prev / psp).toFixed(2) : 0 };
          }).filter((p) => p.spend > 0 || p.purchases > 0).sort((x, y) => y.revenue - x.revenue).slice(0, 20);
          // 제품명 해석 시도 (파트너 카탈로그면 실패 — id 그대로 표시)
          await Promise.all(products.slice(0, 20).map(async (p) => {
            if (!p.productId) return;
            try { const pm = await g(p.productId, { fields: "name" }); p.name = pm.name || ""; } catch {}
          }));
        } catch {}
      }
      return Response.json({ ok: true, detail: {
        ads: adsList, products,
        id: detailId, name: meta.name, status: meta.effective_status, budget: Number(meta.daily_budget || 0),
        goal: meta.optimization_goal || "", created: (meta.created_time || "").slice(0, 10),
        days: (daily.data || []).map((d) => ({ date: (d.date_start || "").slice(5), spend: Math.round(Number(d.spend || 0)),
          purchases: purchasesOf(d), views: viewOf(d), clicks: Number(d.clicks || 0), impressions: Number(d.impressions || 0) })),
        tot: { spend: Math.round(sp), impressions: Number(t.impressions || 0), reach: Number(t.reach || 0),
          clicks: Number(t.clicks || 0), ctr: Number(t.ctr || 0), cpc: Math.round(Number(t.cpc || 0)),
          freq: Number(t.frequency || 0), purchases: pu, views: vw, revenue: Math.round(rev),
          roas: sp ? +(rev / sp).toFixed(2) : 0, cpa: w >= 1 ? Math.round(sp / w) : null },
      } });
    }

    // ── 소재 드릴다운 ──
    const adsetId = url.searchParams.get("adset");
    if (adsetId) {
      const ads = await g(`${adsetId}/ads`, {
        fields: "name,status,effective_status,creative{thumbnail_url,image_url},insights.date_preset(last_7d).action_attribution_windows(['7d_click','1d_view']){spend,ctr,frequency,actions,catalog_segment_actions}",
        limit: "50",
      });
      return Response.json({
        ok: true,
        ads: (ads.data || []).map((a) => {
          const i = a.insights?.data?.[0] || {};
          const sp = Number(i.spend || 0), pu = purchasesOf(i), w = purchasesOf(i) + 0.3 * viewOf(i);
          return { id: a.id, name: a.name, status: a.effective_status,
            thumb: a.creative?.image_url || a.creative?.thumbnail_url || "",
            spend: Math.round(sp), ctr: Number(i.ctr || 0), freq: Number(i.frequency || 0), purchases: pu,
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
    const d60 = new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10);
    const dToday = new Date().toISOString().slice(0, 10);
    const [camps, kpiY, kpi7, kpi30, kpiDaily] = await Promise.all([
      g(`act_${acct}/campaigns`, { fields: "id,name,effective_status", limit: "200" }),
      g(`act_${acct}/insights`, { date_preset: "yesterday", fields: KPI_FIELDS, action_attribution_windows: AW }),
      g(`act_${acct}/insights`, { date_preset: "last_7d", fields: KPI_FIELDS, action_attribution_windows: AW }),
      g(`act_${acct}/insights`, { date_preset: "last_30d", fields: KPI_FIELDS, action_attribution_windows: AW }),
      // 월말 결산용 — 60일 일별 (이번 달 vs 지난 달 + 30일 추이 차트)
      g(`act_${acct}/insights`, { time_increment: "1", limit: "100", fields: "date_start," + KPI_FIELDS,
        time_range: JSON.stringify({ since: d60, until: dToday }), action_attribution_windows: AW }),
    ]);
    const active = (camps.data || []).filter((c) => c.effective_status === "ACTIVE");
    const kpi = {};
    for (const [k, r] of [["yesterday", kpiY.data?.[0]], ["week", kpi7.data?.[0]], ["month", kpi30.data?.[0]]]) {
      const sp = Number(r?.spend || 0), pu = purchasesOf(r), vw = viewOf(r), rev = revenueOf(r);
      const w = pu + 0.3 * vw;
      kpi[k] = { spend: Math.round(sp), purchases: pu, views: vw, roas: sp ? +(rev / sp).toFixed(2) : 0,
        cpa: w >= 1 ? Math.round(sp / w) : null };
    }

    // 📅 월말 결산 — 이번 달 vs 지난 달 + 최근 30일 일별 추이
    const dailyRows = (kpiDaily.data || []).map((r) => ({ d: r.date_start, spend: Math.round(Number(r.spend || 0)),
      buy: purchasesOf(r), rev: revenueOf(r) }));
    const curMon = dToday.slice(0, 7);
    const prevMon = new Date(new Date(dToday).getFullYear(), new Date(dToday).getMonth() - 1, 15).toISOString().slice(0, 7);
    const monSum = (mon) => dailyRows.filter((x) => x.d.startsWith(mon))
      .reduce((a, x) => ({ spend: a.spend + x.spend, buy: a.buy + x.buy, rev: a.rev + x.rev }), { spend: 0, buy: 0, rev: 0 });
    const monthly = { cur: { mon: curMon, ...monSum(curMon) }, prev: { mon: prevMon, ...monSum(prevMon) },
      days30: dailyRows.slice(-30).map(({ d, spend, buy, rev }) => ({ d, spend, buy, rev: Math.round(rev) })),
      // 📆 요일별 성과 히트맵용 — 60일 전체 (요일당 샘플 8~9개)
      days60: dailyRows.map(({ d, spend, buy, rev }) => ({ d, spend, buy, rev: Math.round(rev) })) };

    // 세트 + 성과 (7일/3일/오늘) — 인사이트는 계정 단위 한 번에
    const [ins7, ins3, insT] = await Promise.all(["last_7d", "last_3d", "today"].map((p) =>
      g(`act_${acct}/insights`, { level: "adset", date_preset: p, limit: "300",
        fields: "adset_id,campaign_id,spend,ctr,cpm,actions,catalog_segment_actions,action_values,catalog_segment_value",
        action_attribution_windows: JSON.stringify(["7d_click", "1d_view"]) })));
    const by7 = Object.fromEntries((ins7.data || []).map((r) => [r.adset_id, r]));
    const by3 = Object.fromEntries((ins3.data || []).map((r) => [r.adset_id, r]));
    const byT = Object.fromEntries((insT.data || []).map((r) => [r.adset_id, r]));
    // 🔥 오늘 실황 KPI — 실시간 계약 체결 연출용
    kpi.today = (insT.data || []).reduce((a, r) => ({
      spend: a.spend + Math.round(Number(r.spend || 0)), purchases: a.purchases + purchasesOf(r),
      rev: a.rev + Math.round(revenueOf(r)) }), { spend: 0, purchases: 0, rev: 0 });

    const campaigns = [];
    for (const c of active) {
      const sets = await g(`${c.id}/adsets`, {
        fields: "id,name,daily_budget,effective_status,optimization_goal,created_time,ads.limit(15){effective_status,creative{image_url,thumbnail_url}}", limit: "100" });
      const tgt = targetFor(conf, c.name);
      const rows = (sets.data || []).filter((s) => s.effective_status !== "DELETED").map((s) => {
        const r7 = by7[s.id] || {}, r3 = by3[s.id] || {}, rT = byT[s.id] || {};
        const sp7 = Number(r7.spend || 0), pu7 = weightedOf(r7);
        const sp3 = Number(r3.spend || 0), pu3 = weightedOf(r3);
        const cpa7 = pu7 >= 1 ? sp7 / pu7 : null, cpa3 = pu3 >= 1 ? sp3 / pu3 : null;
        const adsArr = s.ads?.data || [];
        const bestAd = adsArr.find((a) => a.effective_status === "ACTIVE") || adsArr[0];
        const thumb = bestAd?.creative?.image_url || bestAd?.creative?.thumbnail_url || "";
        const goal = (s.optimization_goal || "").toUpperCase();
        const isTraffic = /LANDING|LINK_CLICK|TRAFFIC/.test(goal);
        // ★CPAS 세트는 세트 단위 OFF 불가 → 소재 전체 OFF로 퇴근 처리하는데, 세트 status는 ACTIVE로 남음
        //   → 소재가 전부 꺼진 세트는 "퇴근"으로 간주 (결재함/책상에 살아 돌아오는 사고 픽스, 08-28)
        const effStatus = s.effective_status === "ACTIVE" && adsArr.length > 0
          && !adsArr.some((a) => a.effective_status === "ACTIVE") ? "PAUSED" : s.effective_status;
        let judge = "";
        if (!isTraffic && effStatus === "ACTIVE" && sp7 > 0) {
          if (pu7 >= 8 && cpa7 && cpa7 <= tgt && (!cpa3 || cpa3 <= tgt * 1.5)) judge = "scale";
          else if ((sp7 >= tgt * 3 && pu7 === 0) || (cpa7 && cpa7 >= tgt * 3 && sp7 >= 100000)) judge = "kill";
          else if (cpa7 && cpa7 >= tgt * 2 && sp7 >= 100000) judge = "watch";
        }
        // 🏅 성과등급 규정표 — 목표 CPA 대비: S=70%↓ / A=목표 이내 / B=1.5배 이내 / C=초과·무구매 과지출
        let grade = null;
        if (!isTraffic && effStatus === "ACTIVE" && sp7 > 0) {
          if (cpa7 == null) grade = sp7 >= tgt * 2 ? "C" : "B";
          else grade = cpa7 <= tgt * 0.7 ? "S" : cpa7 <= tgt ? "A" : cpa7 <= tgt * 1.5 ? "B" : "C";
        }
        return { id: s.id, name: s.name, status: effStatus, view7: viewOf(r7), thumb, created: (s.created_time || "").slice(0, 10), grade,
          budget: Number(s.daily_budget || 0), goal: isTraffic ? "트래픽" : "전환",
          spend7: Math.round(sp7), purchases7: purchasesOf(r7), cpa7: cpa7 ? Math.round(cpa7) : null,
          spend3: Math.round(sp3), cpa3: cpa3 ? Math.round(cpa3) : null,
          cpm7: Math.round(Number(r7.cpm || 0)), cpm3: Math.round(Number(r3.cpm || 0)),
          ctr7: Number(r7.ctr || 0), judge, target: tgt,
          buyToday: purchasesOf(rT), spendToday: Math.round(Number(rT.spend || 0)) };
      }).filter((s) => s.status === "ACTIVE" || s.spend7 > 0)
        .sort((a, b) => b.spend7 - a.spend7);
      if (rows.length) campaigns.push({ id: c.id, name: c.name, target: tgt, adsets: rows });
    }
    campaigns.sort((a, b) => b.adsets.reduce((s, x) => s + x.spend7, 0) - a.adsets.reduce((s, x) => s + x.spend7, 0));

    // 🏅 상벌 이력 — 등급 일일 기록 (S=표창, C=경고, 하루 1회 dedup), 14일 창 집계
    let hall = [];
    try {
      const s1 = sb();
      const { data: hrRow } = await s1.from("settings").select("value").eq("key", "oa_ads_hr_v1").maybeSingle();
      const hrStore = hrRow?.value || {};
      const cutoff = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
      const d14 = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
      for (const c of campaigns) for (const s of c.adsets) {
        if (s.grade === "S" || s.grade === "C") {
          const e = hrStore[s.id] || { recs: [] };
          if (!e.recs.some((r) => r.d === dToday)) e.recs.push({ d: dToday, t: s.grade });
          e.name = s.name;
          e.recs = e.recs.filter((r) => r.d >= cutoff).slice(-30);
          hrStore[s.id] = e;
        }
        const recs = hrStore[s.id]?.recs || [];
        s.hr = { s: recs.filter((r) => r.t === "S" && r.d >= d14).length,
          c: recs.filter((r) => r.t === "C" && r.d >= d14).length };
      }
      await s1.from("settings").upsert({ key: "oa_ads_hr_v1", value: hrStore }, { onConflict: "key" });

      // 🏆 주간 MVP 명예의전당 — 주(월요일 기준)당 1명, 주중엔 계속 갱신
      const { data: hallRow } = await s1.from("settings").select("value").eq("key", "oa_ads_hall_v1").maybeSingle();
      const weeks = hallRow?.value?.weeks || [];
      const mon = (() => { const d = new Date(); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d.toISOString().slice(0, 10); })();
      const top = [...campaigns.flatMap((c) => c.adsets).filter((s) => s.status === "ACTIVE")]
        .sort((a, b) => (b.purchases7 || 0) - (a.purchases7 || 0))[0];
      if (top && top.purchases7 > 0) {
        const rec = { w: mon, id: top.id, name: top.name, buy: top.purchases7, spend: top.spend7 };
        const i = weeks.findIndex((h) => h.w === mon);
        if (i >= 0) weeks[i] = rec; else weeks.push(rec);
        await s1.from("settings").upsert({ key: "oa_ads_hall_v1", value: { weeks: weeks.slice(-12) } }, { onConflict: "key" });
      }
      hall = weeks.slice(-8).reverse();
    } catch {}

    // 네이버 검색광고 — 라이브 (실패해도 나머지는 응답)
    let naver = null;
    try { naver = await naverYesterday(); } catch { }

    // GFA — 로컬 크론이 적재한 최신 스냅샷 (없으면 생략)
    const { data: gfaRow } = await sb().from("settings").select("value").eq("key", "oa_gfa_daily_v1").maybeSingle();
    // AD부스터(ADVoost) — 아침 브리핑 크롤러가 적재 (7일)
    const { data: advRow } = await sb().from("settings").select("value").eq("key", "oa_advoost_v1").maybeSingle();

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

    const payload = { ok: true, kpi, monthly, hall, campaigns, naver, gfa: gfaRow?.value || null, advoost: advRow?.value || null, log, targets: conf };
    await sb().from("settings").upsert({ key: CACHE_KEY, value: { at: Date.now(), payload } }, { onConflict: "key" });
    return Response.json({ ...payload, cachedAt: Date.now() });
  } catch (e) {
    const msg = String(e.message || e);
    // ★메타 호출 제한 등 일시 오류 — 마지막 성공 스냅샷이 있으면 그걸로 버틴다 (나이 무관)
    try {
      const { data: cRow } = await sb().from("settings").select("value").eq("key", "oa_ad_console_cache_v1").maybeSingle();
      const c = cRow?.value;
      if (c?.payload)
        return Response.json({ ...c.payload, cachedAt: c.at, stale: true,
          staleReason: /request limit/i.test(msg) ? "메타 호출 제한 — 잠시 후 자동 회복" : msg });
    } catch {}
    // 스냅샷조차 없으면 — 메타만 빼고 부분 렌더 (네이버 라이브·GFA·AD부스터·기록은 산다)
    try {
      let naver = null; try { naver = await naverYesterday(); } catch {}
      const s2 = sb();
      const [gfaRow, advRow, logRow] = await Promise.all([
        s2.from("settings").select("value").eq("key", "oa_gfa_daily_v1").maybeSingle(),
        s2.from("settings").select("value").eq("key", "oa_advoost_v1").maybeSingle(),
        s2.from("settings").select("value").eq("key", LOG_KEY).maybeSingle(),
      ]);
      return Response.json({ ok: true, metaDown: true,
        metaDownReason: /request limit/i.test(msg) ? "메타 호출 제한 (1시간 내 자동 해제)" : msg,
        kpi: { yesterday: {}, week: {}, month: {} }, campaigns: [],
        naver, gfa: gfaRow.data?.value || null, advoost: advRow.data?.value || null,
        log: (logRow.data?.value?.items || []).slice(0, 30), targets: null });
    } catch {}
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

// 캐시 만료 — payload는 남기고 at만 0으로 (제한/오류 시 stale 폴백용)
async function expireCache(s) {
  try {
    const { data } = await s.from("settings").select("value").eq("key", "oa_ad_console_cache_v1").maybeSingle();
    await s.from("settings").upsert({ key: "oa_ad_console_cache_v1",
      value: { at: 0, payload: data?.value?.payload || null } }, { onConflict: "key" });
  } catch {}
}

export async function POST(req) {
  try {
    const { action, adsetId, adId, budget, note, name, before, by, targets: tgtBody } = await req.json();
    const signer = String(by || "").slice(0, 10); // 🖊 결재 도장 — 진행자 이름 (영서/경은/지원/소리/혜영)
    // 🎯 목표 CPA 설정 저장 — 등급/판정/브리핑 전부 이 기준
    if (action === "targets") {
      const def = Math.round(Number(tgtBody?.default));
      if (!def || def < 1000) throw new Error("기본 목표는 1,000원 이상");
      const rules = (tgtBody?.rules || [])
        .map((r) => ({ match: String(r.match || "").slice(0, 30), cpa: Math.round(Number(r.cpa)) }))
        .filter((r) => r.match && r.cpa >= 1000).slice(0, 30);
      const monthCap = Math.max(0, Math.round(Number(tgtBody?.monthCap)) || 0); // 💳 월 예산 한도 (0=미설정)
      const s0 = sb();
      await s0.from("settings").upsert({ key: "oa_ad_targets_v1", value: { default: def, rules, monthCap } }, { onConflict: "key" });
      await expireCache(s0);
      return Response.json({ ok: true });
    }
    // 개별 소재(광고) ON/OFF — 부진 소재만 끄는 "소재 교체" 절반
    if (action === "adPause" || action === "adResume") {
      if (!adId) throw new Error("adId 필요");
      await g(adId, { status: action === "adPause" ? "PAUSED" : "ACTIVE" }, "POST");
      const s0 = sb();
      await expireCache(s0);
      const { data: d0 } = await s0.from("settings").select("value").eq("key", LOG_KEY).maybeSingle();
      const items0 = d0?.value?.items || [];
      items0.unshift({ at: new Date().toISOString(), adsetId: adsetId || "", name: name || adId, by: signer,
        desc: action === "adPause" ? "소재 OFF" : "소재 ON", note: note || "", before: before || null });
      await s0.from("settings").upsert({ key: LOG_KEY, value: { items: items0.slice(0, 100) } }, { onConflict: "key" });
      return Response.json({ ok: true });
    }
    if (!adsetId) throw new Error("adsetId 필요");
    let desc = "";
    if (action === "budget") {
      const b = Math.round(Number(budget));
      if (!b || b < 5000) throw new Error("예산은 5,000원 이상");
      await g(adsetId, { daily_budget: String(b) }, "POST"); // KRW 제로데시멀
      desc = `예산 변경 → ₩${b.toLocaleString()}`;
    } else if (action === "pause" || action === "resume") {
      const st = action === "pause" ? "PAUSED" : "ACTIVE";
      try {
        await g(adsetId, { status: st }, "POST");
        desc = action === "pause" ? "세트 OFF" : "세트 ON";
      } catch (e) {
        // CPAS(카탈로그) 세트 — 파트너 소유 제품세트 검증에 걸려 세트 단위 변경 불가(subcode 1487831)
        // → 안의 광고를 전부 끄고/켜서 같은 효과 (실측 검증 08-28)
        if (!/1487831|제품 세트|product set|Invalid parameter/i.test(String(e.message || e))) throw e;
        const ads = await g(`${adsetId}/ads`, { fields: "id,effective_status", limit: "50" });
        const targets = (ads.data || []).filter((a) =>
          action === "pause" ? a.effective_status === "ACTIVE" : a.effective_status !== "ACTIVE" && a.effective_status !== "DELETED");
        if (!targets.length && action === "pause") { desc = "세트 OFF(이미 전 소재 꺼짐)"; }
        else {
          for (const a of targets) await g(a.id, { status: st }, "POST");
          desc = action === "pause"
            ? `세트 OFF — CPAS 세트라 소재 ${targets.length}개 전체 OFF로 처리`
            : `세트 ON — 소재 ${targets.length}개 ON으로 처리`;
        }
      }
    } else throw new Error("지원하지 않는 액션");

    // 조치 성공 → 캐시 만료 (★스냅샷은 보존 — 날리면 제한 중 폴백이 사라짐)
    const s = sb();
    await expireCache(s);
    // 로그
    const { data } = await s.from("settings").select("value").eq("key", LOG_KEY).maybeSingle();
    const items = data?.value?.items || [];
    items.unshift({ at: new Date().toISOString(), adsetId, name: String(name || "").slice(0, 50), by: signer,
      desc, note: String(note || "").slice(0, 80), before: before || null });
    await s.from("settings").upsert({ key: LOG_KEY, value: { items: items.slice(0, 200) } }, { onConflict: "key" });
    return Response.json({ ok: true, desc });
  } catch (e) {
    return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
