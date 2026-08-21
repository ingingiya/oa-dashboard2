// 부스터즈 광고 리포트 (메타 + GFA 성과형 DA) → 네이버웍스 발송
// 평일: 어제 하루 / 월요일: 지난 7일(주간) 데이터
// 사용법:
//   node scripts/daily-ad-report.mjs --dry-run          # 발송 없이 미리보기
//   node scripts/daily-ad-report.mjs --weekly           # 주간 모드 강제 (테스트용)
//   node scripts/daily-ad-report.mjs --to kkeim@oa-world.com
//   node scripts/daily-ad-report.mjs --since 2026-08-19 --until 2026-08-20  # 놓친 기간 수동 발송
//   node scripts/daily-ad-report.mjs                    # env DAILY_REPORT_TO 로 발송
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { env, sendToUser, telegram } from './nworks-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const TO = args.includes('--to') ? args[args.indexOf('--to') + 1] : env.DAILY_REPORT_TO;

const kstNow = () => new Date(Date.now() + 9 * 3600000);
const kstDate = (offsetDays = 0) =>
  new Date(Date.now() + 9 * 3600000 - offsetDays * 86400000).toISOString().slice(0, 10);
const argOf = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const CUSTOM_SINCE = argOf('--since');
const WEEKLY = !CUSTOM_SINCE && (args.includes('--weekly') || kstNow().getUTCDay() === 1); // 월요일(KST)
const SINCE = CUSTOM_SINCE || (WEEKLY ? kstDate(7) : kstDate(1));
const UNTIL = argOf('--until') || CUSTOM_SINCE || kstDate(1);
const DAYS = Math.round((new Date(UNTIL) - new Date(SINCE)) / 86400000) + 1;
const dShift = (d, n) =>
  new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);

const manwon = (n) => n >= 10000
  ? `${(n / 10000).toLocaleString(undefined, { maximumFractionDigits: 1 })}만원`
  : `${Math.round(n).toLocaleString()}원`;
const roasOf = (t) => (t.cost > 0 ? Math.round(t.rev / t.cost * 100) : 0);
const md = (d) => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`;
const dayKo = (d) => '일월화수목금토'[new Date(`${d}T00:00:00+09:00`).getDay()];

// ── 메타 (뷰티 캠페인 필터) ──────────────────────────
const PURCHASE = ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase', 'web_in_store_purchase', 'website_purchase'];
const actOf = (arr, types) => {
  for (const t of types) { const a = (arr || []).find(x => x.action_type === t); if (a) return parseFloat(a.value) || 0; }
  return 0;
};
const CONV_OBJECTIVES = ['OUTCOME_SALES', 'OUTCOME_ENGAGEMENT', 'CONVERSIONS', 'SALES', 'WEBSITE_CONVERSIONS', 'PRODUCT_CATALOG_SALES'];
async function metaRange(since, until) {
  const filters = (env.META_CAMPAIGN_FILTER || '뷰티,부스터').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  const matches = (n) => filters.some(f => (n || '').toLowerCase().includes(f));
  const tr = encodeURIComponent(JSON.stringify({ since, until }));
  let url = `https://graph.facebook.com/v19.0/${env.META_AD_ACCOUNT_ID}/insights?level=campaign&fields=campaign_name,objective,spend,inline_link_clicks,actions,action_values&time_range=${tr}&action_attribution_windows=%5B%221d_view%22%2C%227d_click%22%5D&use_unified_attribution_setting=true&limit=200&access_token=${env.META_ACCESS_TOKEN}`;
  const zero = () => ({ cost: 0, buy: 0, rev: 0, clk: 0, lpv: 0 });
  const conv = zero(), traf = zero();
  while (url) {
    const d = await (await fetch(url)).json();
    if (d.error) throw new Error(`메타: ${d.error.message}`);
    for (const r of d.data || []) {
      const name = r.campaign_name || '';
      if (!matches(name)) continue;
      const isConv = CONV_OBJECTIVES.includes((r.objective || '').toUpperCase()) || /전환/.test(name);
      const t = isConv ? conv : traf;
      t.cost += parseFloat(r.spend) || 0;
      t.buy += actOf(r.actions, PURCHASE);
      t.rev += actOf(r.action_values, PURCHASE);
      t.clk += parseInt(r.inline_link_clicks) || 0;
      t.lpv += actOf(r.actions, ['landing_page_view', 'omni_landing_page_view']);
    }
    url = d.paging?.next || null;
  }
  return { conv, traf };
}

// 신규 광고 기준일: 평일=오늘 생성, 월요일(주간)=최근 7일, 수동 기간=시작일 이후
const NEW_SINCE = CUSTOM_SINCE || (WEEKLY ? kstDate(7) : kstDate(0));

// 일회성 스킵: scripts/.report-skip 에 적힌 날짜(KST)가 오늘이면 정기 발송 생략 (--since 수동 실행은 무시)
if (!CUSTOM_SINCE) {
  try {
    const skip = readFileSync(resolve(HERE, '.report-skip'), 'utf8').trim();
    if (skip === kstDate(0)) { console.log(`.report-skip ${skip} — 오늘 발송 생략`); process.exit(0); }
  } catch {}
}

// 메타 신규 광고 (뷰티 캠페인, NEW_SINCE 이후 생성)
async function metaNewAds() {
  const filters = (env.META_CAMPAIGN_FILTER || '뷰티,부스터').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  const matches = (n) => filters.some(f => (n || '').toLowerCase().includes(f));
  const sinceTs = Math.floor(new Date(`${NEW_SINCE}T00:00:00+09:00`).getTime() / 1000);
  const filtering = encodeURIComponent(JSON.stringify(
    [{ field: 'ad.created_time', operator: 'GREATER_THAN', value: sinceTs }]));
  let url = `https://graph.facebook.com/v19.0/${env.META_AD_ACCOUNT_ID}/ads?fields=name,created_time,campaign{name}&filtering=${filtering}&limit=100&access_token=${env.META_ACCESS_TOKEN}`;
  const names = [];
  while (url) {
    const d = await (await fetch(url)).json();
    if (d.error) throw new Error(`메타 신규광고: ${d.error.message}`);
    for (const a of d.data || []) {
      // 신규 광고는 campaign 확장이 null로 오는 경우가 있음 — 캠페인명 있을 때만 필터 적용
      const cn = a.campaign?.name || '';
      if (!cn || matches(cn)) names.push(a.name);
    }
    url = d.paging?.next || null;
  }
  return [...new Set(names)];
}

// ── GFA (python 헬퍼, 세션 쿠키) ─────────────────────
function gfaRange(since, until) {
  const out = execFileSync('/usr/bin/python3',
    [resolve(HERE, 'gfa/gfa_daily.py'), since, until, NEW_SINCE], { timeout: 300000 }).toString();
  const g = JSON.parse(out.trim().split('\n').pop());
  if (g.error) throw new Error(`GFA: ${g.error}`);
  return g;
}

const newLine = (label, names) => {
  if (!names.length) return `${label}: 없음`;
  const shown = names.slice(0, 4).join(', ');
  return `${label}: ${shown}${names.length > 4 ? ` 외 ${names.length - 4}개` : ''}`;
};

async function main() {
  const [{ conv, traf }, { conv: convP, traf: trafP }] = await Promise.all([
    metaRange(SINCE, UNTIL), metaRange(dShift(SINCE, -7), dShift(SINCE, -1)),
  ]);
  const g = gfaRange(SINCE, UNTIL);
  const gfa = g.tot;
  let metaNew = [];
  try { metaNew = await metaNewAds(); } catch { /* 신규 조회 실패는 리포트 발송을 막지 않음 */ }
  const totCost = conv.cost + traf.cost + gfa.cost;
  // 평소 = 직전 7일(주간은 직전 주) — 일간 비교는 일평균 기준
  const vsDaily = (cur, prev7) => {
    const avg = prev7 / 7 * DAYS;
    if (!avg) return '';
    const p = Math.round((cur / avg - 1) * 100);
    return `  (평소 ${p >= 0 ? '+' : ''}${p}%)`;
  };

  const title = WEEKLY
    ? `📊 부스터즈 주간 광고 리포트 (${md(SINCE)}~${md(UNTIL)})`
    : SINCE !== UNTIL
      ? `📊 부스터즈 광고 리포트 (${md(SINCE)}~${md(UNTIL)})`
      : `📊 부스터즈 광고 리포트 (${md(UNTIL)} ${dayKo(UNTIL)})`;
  const lpvPct = (t) => (t.clk > 0 ? `랜딩 ${Math.round(t.lpv / t.clk * 100)}%` : '랜딩 -');
  const cpa = (t) => (t.buy > 0 ? `구매당 ${manwon(t.cost / t.buy)}` : '구매당 -');
  const cpc = (t) => (t.clk > 0 ? `CPC ${Math.round(t.cost / t.clk).toLocaleString()}원` : 'CPC -');
  const top3 = g.camps.filter(c => c.cost > 0).slice(0, 3);
  const msg = [
    title,
    `총 광고비 ${manwon(totCost)}`,
    ``,
    `── 메타 전환 ──`,
    `${manwon(conv.cost)}${vsDaily(conv.cost, convP.cost)}`,
    `클릭 ${conv.clk.toLocaleString()} · ${lpvPct(conv)} · ${cpc(conv)}`,
    ``,
    `── 메타 트래픽 ──`,
    `${manwon(traf.cost)}${vsDaily(traf.cost, trafP.cost)}`,
    `클릭 ${traf.clk.toLocaleString()} · ${lpvPct(traf)} · ${cpc(traf)}`,
    ``,
    `── GFA ──`,
    `${manwon(gfa.cost)}${vsDaily(gfa.cost, g.prev.cost)}`,
    `클릭 ${gfa.clk.toLocaleString()} · 구매 ${Math.round(gfa.buy)}건 · ${cpa(gfa)} · ROAS ${roasOf(gfa)}%`,
    ``,
    `── GFA 캠페인 TOP${top3.length} ──`,
    ...top3.map((c, i) => `${i + 1}. ${c.name}  ${manwon(c.cost)} · ROAS ${roasOf(c)}%`),
    ``,
    `── 신규 광고 (${WEEKLY ? '최근 7일' : CUSTOM_SINCE ? `${md(NEW_SINCE)}~` : '오늘'}) ──`,
    newLine('메타', metaNew),
    newLine('GFA', g.newCreatives || []),
  ].join('\n');

  console.log('──── 미리보기 ────\n' + msg + '\n─────────────────');
  if (DRY) { console.log('(dry-run — 발송 안 함)'); return; }
  if (!TO) { console.error('수신자 없음 — --to <이메일> 또는 .env.local DAILY_REPORT_TO='); process.exit(1); }
  for (const to of TO.split(',').map(s => s.trim()).filter(Boolean)) {
    await sendToUser(to, msg);
    console.log(`발송 완료 → ${to}`);
  }
}

main().catch(async (e) => {
  console.error('daily-ad-report 실패:', e.message || e);
  await telegram(`⚠️ 부스터즈 광고 리포트 발송 실패: ${String(e.message || e).slice(0, 200)}`);
  process.exit(1);
});
