#!/usr/bin/env node
// 메타 트래픽 캠페인 자동 생성 (초안=PAUSED) — 캠페인 1 + 제품별 광고세트 + 소재별 광고
// 사용: node scripts/launch/meta-traffic-create.mjs <config.json> [--live]  (--live 없으면 드라이런: 생성 계획만 출력)
// config 예시:
// { "campaignName": "260909_뷰티팀_카카오선물하기_트래픽", "pageId": "1066383793215061",
//   "dailyBudget": 20000, "ageMin": 18, "ageMax": 49, "optimization": "LINK_CLICKS",
//   "bidCap": 0,               // >0이면 COST_CAP(원, KRW 제로데시멀). 0=최고 볼륨
//   "products": [ { "name": "히트스팟S", "url": "https://gift.kakao.com/product/...", "headline": "…",
//                   "message": "…", "images": [ { "label": "meme", "url": "https://…png" } ] } ] }
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "../..");
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; }));
const TOKEN = env.META_ACCESS_TOKEN;
const ACT = env.META_AD_ACCOUNT_ID || "act_561422496378510";
const G = "https://graph.facebook.com/v21.0/";

const [cfgPath, ...flags] = process.argv.slice(2);
if (!cfgPath) { console.error("사용: node meta-traffic-create.mjs <config.json> [--live]"); process.exit(1); }
const LIVE = flags.includes("--live");
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));

async function post(pathname, body) {
  const fd = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) fd.set(k, typeof v === "string" ? v : JSON.stringify(v));
  fd.set("access_token", TOKEN);
  const r = await fetch(G + pathname, { method: "POST", body: fd });
  const j = await r.json();
  if (j.error) throw new Error(`${pathname}: ${j.error.error_user_msg || j.error.message} (code ${j.error.code}${j.error.error_subcode ? "/" + j.error.error_subcode : ""})`);
  return j;
}

const out = { campaign: null, adsets: [] };
const log = (...a) => console.log(...a);

log(`${LIVE ? "🟢 LIVE" : "⚪ DRY-RUN"} — 계정 ${ACT} / 캠페인 "${cfg.campaignName}"`);
log(`  최적화 ${cfg.optimization || "LINK_CLICKS"} · 일예산 ${cfg.dailyBudget}원 · 연령 ${cfg.ageMin}-${cfg.ageMax} · 입찰 ${cfg.bidCap > 0 ? `비용상한 ${cfg.bidCap}원` : "최고 볼륨"}`);
for (const p of cfg.products) log(`  - 광고세트 [${p.name}] → ${p.url}  소재 ${p.images.length}개`);
if (!LIVE) { log("\n--live 를 붙이면 실제로 생성돼요 (전부 PAUSED 초안)"); process.exit(0); }

// 1) 캠페인
// campaignId가 있으면 기존 캠페인에 광고세트만 추가 (재실행/이어붙이기)
const camp = cfg.campaignId ? { id: cfg.campaignId } : await post(`${ACT}/campaigns`, {
  name: cfg.campaignName, objective: "OUTCOME_TRAFFIC", status: "PAUSED",
  buying_type: "AUCTION", special_ad_categories: [], is_adset_budget_sharing_enabled: "false",
});
out.campaign = camp.id;
log(`✅ 캠페인 ${camp.id}`);

const targeting = {
  geo_locations: { countries: ["KR"], location_types: ["home", "recent"] },
  // ★어드밴티지+ 타겟에선 age_max 상한(65 미만)이 거부됨(1870189) → age_range로 "권장 연령"만 전달
  age_min: 18, age_max: 65, age_range: [cfg.ageMin || 18, cfg.ageMax || 65],
  targeting_automation: { advantage_audience: 1 },
};

for (const p of cfg.products) {
  // 2) 광고세트
  const adsetBody = {
    name: `[트래픽] ${p.name}`, campaign_id: camp.id, status: "PAUSED",
    daily_budget: String(cfg.dailyBudget), billing_event: "IMPRESSIONS",
    optimization_goal: cfg.optimization || "LINK_CLICKS",
    bid_strategy: cfg.bidCap > 0 ? "COST_CAP" : "LOWEST_COST_WITHOUT_CAP",
    targeting,
  };
  if (cfg.bidCap > 0) adsetBody.bid_amount = String(cfg.bidCap);
  // 같은 이름 광고세트가 이미 있으면 재사용 (중간 실패 후 재실행 시 중복 방지)
  const exist = await (await fetch(`${G}${camp.id}/adsets?fields=name&limit=200&access_token=${TOKEN}`)).json();
  const dup = (exist.data || []).find((a) => a.name === adsetBody.name);
  const adset = dup ? dup : await post(`${ACT}/adsets`, adsetBody);
  log(`  ✅ 광고세트 [${p.name}] ${adset.id}`);
  const rec = { name: p.name, id: adset.id, ads: [] };

  for (const img of p.images) {
    // 3) 이미지 업로드 → 4) 크리에이티브 → 5) 광고
    // ★adimages는 url 파라미터가 앱 권한(#3)으로 막혀 바이트 직접 업로드(bytes=base64)
    const bin = Buffer.from(await (await fetch(img.url)).arrayBuffer());
    const up = await post(`${ACT}/adimages`, { bytes: bin.toString("base64") });
    const hash = Object.values(up.images || {})[0]?.hash;
    if (!hash) throw new Error("이미지 해시 없음: " + img.url);
    const cr = await post(`${ACT}/adcreatives`, {
      name: `${p.name}_${img.label}`,
      object_story_spec: {
        page_id: cfg.pageId,
        link_data: {
          link: p.url, message: img.message || p.message, name: img.headline || p.headline,
          image_hash: hash, call_to_action: { type: cfg.cta || "SHOP_NOW", value: { link: p.url } },
        },
      },
      // standard_enhancements 묶음은 지원 중단(3858504) → 개별 기능 옵트아웃 (소재 원본 그대로 노출)
      degrees_of_freedom_spec: { creative_features_spec: {
        image_templates: { enroll_status: "OPT_OUT" }, image_touchups: { enroll_status: "OPT_OUT" },
        image_brightness_and_contrast: { enroll_status: "OPT_OUT" }, text_optimizations: { enroll_status: "OPT_OUT" },
        enhance_cta: { enroll_status: "OPT_OUT" }, inline_comment: { enroll_status: "OPT_OUT" },
      } },
    });
    const ad = await post(`${ACT}/ads`, {
      name: `${p.name}_${img.label}`, adset_id: adset.id, creative: { creative_id: cr.id }, status: "PAUSED",
    });
    rec.ads.push({ label: img.label, id: ad.id, creative: cr.id });
    log(`     ✅ 광고 ${p.name}_${img.label} ${ad.id}`);
  }
  out.adsets.push(rec);
}

const resPath = cfgPath.replace(/\.json$/, "") + `.result-${new Date().toISOString().slice(0, 10)}.json`;
fs.writeFileSync(resPath, JSON.stringify(out, null, 2));
log(`\n완료 — 결과 ${resPath}\n광고 관리자: https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${ACT.replace("act_", "")}`);
