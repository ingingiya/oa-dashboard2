// 카카오선물하기 트래픽 캠페인 일일 리포트 (메타 + X) → 네이버웍스 봇 개인 메시지(경은에게만), 실패 시 텔레그램
// 평일 17:30 크론. 제품(광고세트)별 총광고비 / 노출 / 링크클릭 / CPM(노출당 단가) / CPC(클릭당 단가)
// 사용법:
//   node scripts/kakao-traffic-report.mjs --dry-run     # 발송 없이 출력
//   node scripts/kakao-traffic-report.mjs --morning     # 아침 8:30 모드 (랭킹 am 슬롯, 신규소재=어제)
//   node scripts/kakao-traffic-report.mjs               # 웍스 발송 (KAKAO_REPORT_TO 또는 --to 이메일)
// 환경(.env.local): META_ACCESS_TOKEN, META_AD_ACCOUNT_ID
//   X: scripts/xads/.xads_profile 로그인 세션 (Ads API 미개통이라 광고관리자 내부 API 사용), 캠페인 필터 X_CAMPAIGN_FILTER(기본 트래픽,카카오)
//   캠페인 필터: KAKAO_CAMPAIGN_FILTER (기본 "카카오")
import { execFileSync } from 'child_process';
import { unlinkSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { env, sendFileToUser, sendImageToUser, sendToUser, telegram } from './nworks-lib.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
const TO = process.argv.includes('--to') ? process.argv[process.argv.indexOf('--to') + 1] : (env.KAKAO_REPORT_TO || 'kkeim@oa-world.com'); // 네이버웍스 개인 발송(나에게만)

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const MORNING = args.includes('--morning'); // 8:30 발송: 랭킹 am 슬롯(08:00 갱신분, 전일 am과 비교), 신규 소재는 어제 등록분
const TIME_LABEL = MORNING ? '08:30' : '17:30';
const FILTER = (env.KAKAO_CAMPAIGN_FILTER || '카카오').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const START = env.KAKAO_CAMPAIGN_START || '2026-09-08'; // 누적 기준일
const matches = (n) => FILTER.some(f => (n || '').toLowerCase().includes(f));

const kstDate = (off = 0) => new Date(Date.now() + 9 * 3600000 - off * 86400000).toISOString().slice(0, 10);
const TODAY = kstDate(0), YDAY = kstDate(1);
const NEWADS_DATE = MORNING ? YDAY : TODAY;
const won = (n) => `${Math.round(n).toLocaleString()}원`;
const md = (d) => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`;
const dShift = (d, n) => new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
const dayKo = (d) => '일월화수목금토'[new Date(`${d}T00:00:00+09:00`).getDay()];
const clean = (n) => (n || '').replace(/^\[.*?\]\s*/, '').split('_')[0].replace(/\s*(복사|copy)\s*\d*$/i, '').trim(); // "[트래픽] 듀얼포켓건_영상전용" / "듀얼포켓건_세트2" → "듀얼포켓건" (광고세트는 제품_용도 규칙으로 묶음)

// ── 메타: 카카오 캠페인 → 광고세트(제품)별 ─────────────────
async function metaRange(since, until) {
  const tr = encodeURIComponent(JSON.stringify({ since, until }));
  let url = `https://graph.facebook.com/v19.0/${env.META_AD_ACCOUNT_ID}/insights?level=adset&fields=campaign_name,adset_name,spend,inline_link_clicks,impressions&time_range=${tr}&time_increment=1&limit=500&access_token=${env.META_ACCESS_TOKEN}`;
  const out = {};
  while (url) {
    const d = await (await fetch(url)).json();
    if (d.error) throw new Error(`메타: ${d.error.message}`);
    for (const r of d.data || []) {
      if (!matches(r.campaign_name)) continue;
      const k = clean(r.adset_name);
      const t = (out[k] ||= {})[r.date_start] ||= { cost: 0, clk: 0, imp: 0 };
      t.cost += parseFloat(r.spend) || 0;
      t.clk += parseInt(r.inline_link_clicks) || 0;
      t.imp += parseInt(r.impressions) || 0;
    }
    url = d.paging?.next || null;
  }
  return out;
}

// ── X(트위터): 광고관리자 로그인 세션으로 내부 통계 API 호출 (scripts/xads/xads_stats.py) ──
//   세션 만료 시 `python3 scripts/xads/xads_autologin.py` (X_USER/X_PASS env) 재실행
async function xRange(since, until) {
  const out = execFileSync('/usr/bin/python3', [resolve(HERE, 'xads/xads_stats.py'), since, until, '--with-status', '--filter', env.X_CAMPAIGN_FILTER || '트래픽,카카오'],
    { encoding: 'utf8', timeout: 180000, stdio: ['ignore', 'pipe', 'pipe'] });
  const d = JSON.parse(out.trim().split('\n').pop());
  if (d.error) throw new Error(d.error);
  return d; // {data, status}
}

// ── 메타: 카카오 캠페인 광고세트 상태 → 제품별 집행중 여부 (하나라도 ACTIVE면 켜짐) ──
async function metaStatus() {
  const filtering = encodeURIComponent(JSON.stringify([{ field: 'campaign.name', operator: 'CONTAIN', value: '카카오' }]));
  let url = `https://graph.facebook.com/v19.0/${env.META_AD_ACCOUNT_ID}/adsets?fields=name,effective_status,campaign{name}&filtering=${filtering}&limit=200&access_token=${env.META_ACCESS_TOKEN}`;
  const st = {};
  while (url) {
    const d = await (await fetch(url)).json();
    if (d.error) throw new Error(`메타 광고세트: ${d.error.message}`);
    for (const a of d.data || []) { if (!matches(a.campaign?.name)) continue; const k = clean(a.name); st[k] = st[k] || a.effective_status === 'ACTIVE'; }
    url = d.paging?.next || null;
  }
  return st;
}
// 꺼진 제품 목록: 상태를 알면 그 기준, 모르면(상태 조회 실패) 기준일 집행 0원 = 꺼짐으로 간주
const offList = (data, status, refDay) => Object.keys(data).filter(n => status && n in status ? !status[n] : !(data[n][refDay]?.cost > 0));

// ── 랭킹 대상: 메타 카카오 캠페인 ACTIVE 광고의 gift.kakao.com 상품 ──
async function activeKakaoTargets() {
  const filtering = encodeURIComponent(JSON.stringify([{ field: 'campaign.name', operator: 'CONTAIN', value: '카카오' }]));
  let url = `https://graph.facebook.com/v19.0/${env.META_AD_ACCOUNT_ID}/ads?fields=effective_status,adset{name},creative{object_story_spec}&filtering=${filtering}&limit=200&access_token=${env.META_ACCESS_TOKEN}`;
  const map = new Map();
  while (url) {
    const d = await (await fetch(url)).json();
    if (d.error) throw new Error(`메타 광고 목록: ${d.error.message}`);
    for (const a of d.data || []) {
      if (a.effective_status !== 'ACTIVE') continue;
      const s = a.creative?.object_story_spec; const link = s?.link_data?.link || s?.video_data?.call_to_action?.value?.link || '';
      const m = link.match(/gift\.kakao\.com\/product\/(\d+)/); if (!m) continue;
      const id = +m[1]; if (!map.has(id)) map.set(id, { id, name: clean(a.adset?.name) });
    }
    url = d.paging?.next || null;
  }
  return [...map.values()];
}

// ── 행동 제안 (규칙 기반) ─────────────────────────────
//  기준: 목표 CPC KAKAO_TARGET_CPC(기본 150원), 일 계획 예산 KAKAO_DAILY_PLAN(기본 140,000원 = 300만원/3주)
const TARGET_CPC = +(env.KAKAO_TARGET_CPC || 150), DAILY_PLAN = +(env.KAKAO_DAILY_PLAN || 140000);
function actions(media, rk, newAds) {
  const out = []; // {level:'🔴'|'🟡'|'🟢', text}
  const refDay = MORNING ? YDAY : TODAY; // 판단 기준일
  const prevDay = dShift(refDay, -1);
  const per = {}; // 제품 → {매체: {ref, prev, total}}
  for (const m of media) if (!m.error) for (const [prod, days] of Object.entries(m.data)) {
    const t = tot(days); per[prod] ||= {}; per[prod][m.name] = { ref: days[refDay] || z(), prev: days[prevDay] || z(), total: t };
  }
  // 전체 페이싱
  const spendRef = Object.values(per).reduce((a, p) => a + Object.values(p).reduce((b, v) => b + v.ref.cost, 0), 0);
  if (spendRef > 0) {
    const pct = Math.round(spendRef / DAILY_PLAN * 100);
    if (pct < 50) out.push({ level: '🟡', text: `${md(refDay)} 총 집행 ${won(spendRef)} = 일 계획(${won(DAILY_PLAN)})의 ${pct}% → 예산 소진 부진, 세트별 일예산 상향 또는 소재 추가 검토` });
    else if (pct > 130) out.push({ level: '🟡', text: `${md(refDay)} 총 집행 ${won(spendRef)} = 일 계획의 ${pct}% → 초과 페이싱, 3주 총액(300만) 기준 재배분` });
    else out.push({ level: '🟢', text: `${md(refDay)} 총 집행 ${won(spendRef)} = 일 계획의 ${pct}% → 페이싱 정상` });
  }
  // 제품별
  const rankOf = (name) => rk?.products?.find(p => p.name.replace(/\s/g, '') === name.replace(/\s/g, ''));
  for (const [prod, byMedia] of Object.entries(per)) {
    const entries = Object.entries(byMedia).filter(([, v]) => v.total.cost > 0);
    const active = entries.filter(([, v]) => v.ref.cost > 0);
    // 매체 간 CPC 비교
    if (active.length >= 2) {
      const sorted = active.map(([m, v]) => [m, v.ref.cost / Math.max(v.ref.clk, 1)]).sort((a, b) => a[1] - b[1]);
      const [cheap, exp] = [sorted[0], sorted[sorted.length - 1]];
      if (exp[1] > cheap[1] * 1.25) out.push({ level: '🟡', text: `${prod}: ${exp[0]} CPC ${won(exp[1])} vs ${cheap[0]} ${won(cheap[1])} → ${cheap[0]} 비중 확대(예산 20~30% 이동)` });
    }
    for (const [m, v] of active) {
      const cpcRef = v.ref.cost / Math.max(v.ref.clk, 1), cpcPrev = v.prev.clk > 0 ? v.prev.cost / v.prev.clk : null;
      if (cpcPrev && cpcRef > cpcPrev * 1.2 && v.ref.clk < v.prev.clk) out.push({ level: '🔴', text: `${prod} ${m}: CPC ${won(cpcPrev)}→${won(cpcRef)} 상승+클릭 감소 → 소재 피로, 신규 소재로 교체/추가` });
      if (cpcRef > TARGET_CPC * 1.5) out.push({ level: '🟡', text: `${prod} ${m}: CPC ${won(cpcRef)} (목표 ${won(TARGET_CPC)}의 ${Math.round(cpcRef / TARGET_CPC * 100)}%) → 타겟 넓히기·입찰 상한 점검·저CPC 소재만 남기기` });
      else if (cpcRef <= TARGET_CPC) out.push({ level: '🟢', text: `${prod} ${m}: CPC ${won(cpcRef)} 목표 달성 → 일예산 +20~30% 증액 후보` });
    }
    // 랭킹 연동
    const r = rankOf(prod); const h = r?.ranks?.['건강가전'] || r?.ranks?.['뷰티가전'] || r?.ranks?.['충전기'] || {};
    const best = r ? Object.entries(r.ranks).filter(([k, v]) => v.today != null && !['가전·디지털', '전체'].includes(k)).sort((a, b) => a[1].today - b[1].today)[0] : null;
    if (r && best) {
      const [list, v] = best;
      if (v.prev != null && v.prev - v.today >= 5) out.push({ level: '🟢', text: `${prod}: ${list} ${v.prev}→${v.today}위 상승 → 유입이 랭킹에 반영 중, 현 예산 유지 또는 증액` });
      else if (v.prev != null && v.today - v.prev >= 10 && active.length) out.push({ level: '🔴', text: `${prod}: 광고 집행 중인데 ${list} ${v.prev}→${v.today}위 하락 → 클릭이 구매/위시로 안 이어짐, 상세·가격·증정 혜택 점검` });
    } else if (r && active.length && entries.reduce((a, [, v]) => a + v.total.cost, 0) >= 30000) out.push({ level: '🔴', text: `${prod}: 누적 ${won(entries.reduce((a, [, v]) => a + v.total.cost, 0))} 집행에도 소분류 500위 밖 → 랜딩·상품 경쟁력 점검, 예산 재배분 검토` });
    if (!active.length && entries.length) out.push({ level: '🟡', text: `${prod}: ${md(refDay)} 집행 0원 (이전엔 집행) → 광고 꺼짐/검토 대기 확인` });
  }
  // 랭킹은 있는데 광고 데이터 없는 제품 (광고 켜져 있으나 지출 0)
  for (const p of rk?.products || []) if (!per[p.name] && !Object.keys(per).some(k => k.replace(/\s/g, '') === p.name.replace(/\s/g, ''))) out.push({ level: '🟡', text: `${p.name}: 광고 ACTIVE인데 집행 데이터 없음 → 검토중 승인 대기 또는 예산 미배정 확인` });
  if (newAds) out.push({ level: '🟡', text: `${MORNING ? '어제' : '오늘'} 신규 소재 ${newAds}건 → 승인 후 2~3일 CPC 비교, 상위 30%만 남기고 정리` });
  const order = { '🔴': 0, '🟡': 1, '🟢': 2 };
  return out.sort((a, b) => order[a.level] - order[b.level]).slice(0, 12);
}

// ── 포맷 ─────────────────────────────────────────────
const z = () => ({ cost: 0, clk: 0, imp: 0 });
const add = (s, t) => { s.cost += t.cost; s.clk += t.clk; s.imp += t.imp; };
const tot = (o) => { const s = z(); for (const t of Object.values(o)) add(s, t); return s; };
const cpc = (t) => (t.clk > 0 ? won(t.cost / t.clk) : '-');
const cpm = (t) => (t.imp > 0 ? won(t.cost / t.imp * 1000) : '-'); // 노출 1,000회당
const dayLine = (d, t) => `${md(d)}(${dayKo(d)})  ${won(t.cost)} · ${t.clk.toLocaleString()}클릭 · CPC ${cpc(t)} · CPM ${cpm(t)}`;
const sumLine = (label, t) => `${label} ${won(t.cost)} · ${t.clk.toLocaleString()}클릭 · CPC ${cpc(t)}\n노출 ${t.imp.toLocaleString()} · CPM ${cpm(t)}`;

function block(title, data, off = []) { // data = { 제품: { 'YYYY-MM-DD': {cost,clk,imp} } }, off = 꺼진 제품(맨 아래로)
  const isOff = (n) => off.includes(n);
  const names = Object.keys(data).sort((a, b) => (isOff(a) - isOff(b)) || (tot(data[b]).cost - tot(data[a]).cost));
  if (!names.length) return `${title}\n집행 데이터 없음`;
  const parts = [];
  for (const n of names) {
    const lines = [`${isOff(n) ? '▫️ ' + n + ' (꺼짐)' : '🔹 ' + n}`];
    for (const d of Object.keys(data[n]).sort()) {
      const t = data[n][d];
      if (t.cost === 0 && t.imp === 0) continue;
      lines.push(dayLine(d, t));
    }
    lines.push(sumLine('▶ 누적', tot(data[n])));
    parts.push(lines.join('\n'));
  }
  const all = tot(Object.fromEntries(names.map(n => [n, tot(data[n])])));
  return [`${title}  ${won(all.cost)} · ${all.clk.toLocaleString()}클릭 · CPC ${cpc(all)}`, ...parts].join('\n\n');
}

async function main() {
  const media = [];
  const errs = [];
  const REF = MORNING ? YDAY : TODAY;
  for (const [name, fn] of [['메타', async () => { const data = await metaRange(START, TODAY); let st = null; try { st = await metaStatus(); } catch (e) { errs.push(`메타 상태: ${e.message}`); } return { data, off: offList(data, st, REF) }; }],
    ['X (트위터)', async () => { const r = await xRange(START, TODAY); const data = r.data || r; return { data, off: offList(data, r.status || null, REF) }; }]]) {
    try { const { data, off } = await fn();
      // 사용자(09-18): 꺼진 광고는 리포트에서 제외 — 지금 집행 중인 광고비만. 제외 목록은 텍스트에 한 줄로만 표기
      const excluded = off.filter(n => n in data); for (const n of excluded) delete data[n];
      media.push({ name, data, off: [], excluded }); }
    catch (e) { errs.push(`${name}: ${e.message}`); media.push({ name, data: {}, off: [], error: `⚠️ ${e.message}` }); }
  }
  // 텍스트 요약 (매체별 합계 한 줄)
  const summary = media.map(m => {
    if (m.error) return `${m.name}: ${m.error}`;
    const t = tot(Object.fromEntries(Object.keys(m.data).map(n => [n, tot(m.data[n])])));
    return `${m.name}: ${won(t.cost)} · ${t.clk.toLocaleString()}클릭 · CPC ${cpc(t)} · CPM ${cpm(t)}`;
  }).join('\n');
  const exNote = media.flatMap(m => (m.excluded || []).map(n => `${n}(${m.name})`));
  const text = `📊 카카오선물하기 트래픽 ${md(START)}~${md(TODAY)} (${md(TODAY)} ${TIME_LABEL} 기준) · 집행 중 광고만\n${summary}${exNote.length ? `\n⏸ 꺼진 광고 제외: ${exNote.join(', ')}` : ''}`;
  console.log(text);
  // 표 이미지
  let imgUrl = null;
  try {
    imgUrl = execFileSync('/usr/bin/python3', [resolve(HERE, 'kakao-traffic-table.py')], {
      input: JSON.stringify({ title: '카카오선물하기 트래픽 리포트', sub: `${md(START)}~${md(TODAY)} 일자별 · ${md(TODAY)} ${TIME_LABEL} 기준 · 집행 중인 광고만 (꺼진 광고 제외)`, date: TODAY, media }),
      encoding: 'utf8', timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'],
    }).trim().split('\n').pop();
    console.log('표 이미지:', imgUrl);
  } catch (e) { errs.push(`표 렌더: ${e.message}`); console.error('표 렌더 실패', e.message); }
  // 카카오 선물하기 랭킹 (스냅샷 저장 + 전일 비교 → 표 이미지)
  let rankUrl = null, rankText = '', rk = null;
  try {
    // 대상 = 지금 메타 카카오 캠페인에서 실제 집행중(ACTIVE)인 광고의 선물하기 상품 (사용자: "지금 광고하고 있는 것만")
    const targets = await activeKakaoTargets();
    writeFileSync(resolve(HERE, 'kakao-rank/targets.json'), JSON.stringify(targets, null, 1));
    const rankJson = execFileSync('/usr/bin/python3', [resolve(HERE, 'kakao-rank/kakao_rank.py'), '--slot', MORNING ? 'am' : 'pm'], { encoding: 'utf8', timeout: 300000, stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('\n').pop();
    rk = JSON.parse(rankJson);
    const moves = rk.products.map(p => { const L = p.goal?.list || '건강가전'; const r = p.ranks[L] || {}; const t = r.today, pv = r.prev; if (t == null) return null; const g = p.goal ? (t <= p.goal.max ? ' ✓' : `/목표${p.goal.max}`) : ''; return `${p.name} ${L} ${t}위${g}${pv != null && pv !== t ? (pv > t ? ` ▲${pv - t}` : ` ▼${t - pv}`) : ''}`; }).filter(Boolean);
    rankText = `🏆 선물하기 랭킹${rk.prevDate ? ' (전일 대비)' : ' (첫 수집)'}: ` + (moves.join(' · ') || '500위 내 없음');
    rankUrl = execFileSync('/usr/bin/python3', [resolve(HERE, 'kakao-rank-table.py')], { input: rankJson, encoding: 'utf8', timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] }).trim().split('\n').pop();
    console.log(rankText); console.log('랭킹 표:', rankUrl);
  } catch (e) { errs.push(`랭킹: ${e.message}`); rankText = `🏆 선물하기 랭킹 수집 실패: ${e.message.slice(0, 120)}`; console.error(rankText); }
  if (DRY) console.log('\n' + media.map(m => m.error ? `[${m.name}]\n${m.error}` : block(`[${m.name}]`, m.data, m.off)).join('\n\n'));
  // 오늘 신규 소재 콘택트시트 (없으면 생략)
  let newAds = 0;
  try { unlinkSync('/tmp/kakao-newads.png'); } catch {}
  try { newAds = +(execFileSync('/usr/bin/python3', [resolve(HERE, 'kakao-newads.py'), NEWADS_DATE], { encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] }).trim() || 0); }
  catch (e) { errs.push(`신규소재: ${e.message}`); }
  // 행동 제안
  let actText = '';
  try {
    const acts = actions(media, rk, newAds);
    actText = acts.length ? '📌 행동 제안\n' + acts.map(a => `${a.level} ${a.text}`).join('\n') : '';
    console.log(actText);
  } catch (e) { errs.push(`행동제안: ${e.message}`); console.error('행동제안 실패', e.message); }
  // 한 장으로 합쳐 발송 (사용자: "원했던 거 다 한 장에")
  let allUrl = null;
  try { allUrl = execFileSync('/usr/bin/python3', [resolve(HERE, 'kakao-combine.py'), TODAY], { encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('\n').pop(); }
  catch (e) { errs.push(`합치기: ${e.message}`); }
  if (DRY) { console.log('(dry-run: 발송 생략)'); return; }
  await sendToUser(TO, [text, rankText, newAds ? `🖼 ${MORNING ? '어제' : '오늘'} 신규 소재 ${newAds}건 (표 아래)` : '', actText ? '\n' + actText : ''].filter(Boolean).join('\n'));
  if (allUrl) { // 이미지 메시지는 웍스가 리사이즈해 긴 표가 깨짐(사용자 09-16) → PNG 원본 파일로, 실패 시 이미지 폴백
    try { await sendFileToUser(TO, '/tmp/kakao-report-all.png', `카카오트래픽_${TODAY.replace(/-/g, '').slice(2)}_${TIME_LABEL.replace(':', '')}.png`); }
    catch (e) { errs.push(`파일 발송: ${e.message}`); console.error('파일 발송 실패, 이미지로 폴백', e.message); await sendImageToUser(TO, allUrl); }
  } else {
    if (imgUrl) await sendImageToUser(TO, imgUrl);
    else await sendToUser(TO, media.map(m => m.error ? `[${m.name}]\n${m.error}` : block(`[${m.name}]`, m.data, m.off)).join('\n\n━━━━━━━━━━━━\n\n'));
    if (rankUrl) await sendImageToUser(TO, rankUrl);
  }
  console.log(`→ 웍스 발송: ${TO}`);
  if (errs.length) process.exitCode = 1;
}
main().catch(async (e) => { console.error(e); if (!DRY) await telegram(`⚠️ 카카오 트래픽 리포트(웍스) 실패: ${e.message}`); process.exit(1); });
