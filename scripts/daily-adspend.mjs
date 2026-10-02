// 일별 광고비 리포트 — 부스터즈팀이 직접 집행하는 매체(메타·X)의 날짜별 광고비를 웍스 개인 메시지로 (10-02 사용자 요청)
//   node scripts/daily-adspend.mjs [--dry-run] [--days 14] [--to email]
// 메타: 계정 전체 중 캠페인명에 META_CAMPAIGN_FILTER(기본 "뷰티,부스터") 포함분, level=campaign·time_increment=1
// X: scripts/xads/xads_stats.py --all --raw (광고관리자 세션, 계정 전체 캠페인)
import { execFileSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { env, sendToUser, sendImageToUser, sendFileToUser, telegram } from './nworks-lib.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2); const DRY = args.includes('--dry-run');
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const TO = opt('--to', 'kkeim@oa-world.com'); const DAYS = +opt('--days', 14);
const kst = (off = 0) => new Date(Date.now() + 9 * 3600000 - off * 86400000).toISOString().slice(0, 10);
const UNTIL = kst(1), SINCE = kst(DAYS); const MONTH0 = UNTIL.slice(0, 8) + '01';
const START = SINCE < MONTH0 ? SINCE : MONTH0;
const won = (n) => Math.round(n).toLocaleString('ko-KR') + '원';
const md = (d) => `${+d.slice(5, 7)}/${+d.slice(8, 10)}(${'일월화수목금토'[new Date(d + 'T00:00:00Z').getUTCDay()]})`;
const clean = (v) => String(v || '').replace(/^"|"$/g, '');

async function meta() {
  const FILTER = clean(env.META_CAMPAIGN_FILTER || '뷰티,부스터').split(',').map((s) => s.trim()).filter(Boolean);
  const tr = encodeURIComponent(JSON.stringify({ since: START, until: UNTIL }));
  let url = `https://graph.facebook.com/v19.0/${clean(env.META_AD_ACCOUNT_ID)}/insights?level=campaign&fields=campaign_name,spend,impressions,inline_link_clicks,actions,action_values&time_range=${tr}&time_increment=1&limit=500&access_token=${clean(env.META_ACCESS_TOKEN)}`;
  const byDay = {}, byCamp = {}, eff = {}; let all = 0, kept = 0;
  const PUR = ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase', 'web_in_store_purchase', 'website_purchase'];
  const act = (arr) => { for (const t of PUR) { const a = (arr || []).find((x) => x.action_type === t); if (a) return parseFloat(a.value) || 0; } return 0; };
  while (url) {
    const j = await (await fetch(url)).json(); if (j.error) throw new Error('메타: ' + j.error.message);
    for (const r of j.data || []) {
      all++; if (FILTER.length && !FILTER.some((f) => r.campaign_name.includes(f))) continue; kept++;
      const c = +r.spend || 0; if (!c) continue;
      const e = (eff[r.date_start] ||= { imp: 0, clk: 0, buy: 0, rev: 0 }); e.imp += +r.impressions || 0; e.clk += +r.inline_link_clicks || 0; e.buy += act(r.actions); e.rev += act(r.action_values);
      const ce = ((eff._camp ||= {})[r.date_start] ||= {}); const cc = (ce[r.campaign_name] ||= { imp: 0, clk: 0, buy: 0, rev: 0 }); cc.imp += +r.impressions || 0; cc.clk += +r.inline_link_clicks || 0; cc.buy += act(r.actions); cc.rev += act(r.action_values);
      byDay[r.date_start] = (byDay[r.date_start] || 0) + c;
      (byCamp[r.date_start] ||= {})[r.campaign_name] = ((byCamp[r.date_start] || {})[r.campaign_name] || 0) + c;
    }
    url = j.paging?.next || null;
  }
  return { byDay, byCamp, eff, note: `캠페인명 필터 ${FILTER.join('·')} (${kept}/${all}행)` };
}
function x() {
  const out = execFileSync('/usr/bin/python3', [resolve(HERE, 'xads/xads_stats.py'), START, UNTIL, '--all', '--raw'], { encoding: 'utf8', timeout: 600000, stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('\n').pop();
  const j = JSON.parse(out); if (j.error) throw new Error('X: ' + j.error);
  const byDay = {}, byCamp = {}, eff = { _camp: {} };
  for (const [name, days] of Object.entries(j)) for (const [d, v] of Object.entries(days)) { byDay[d] = (byDay[d] || 0) + v.cost; (byCamp[d] ||= {})[name] = v.cost; const e = (eff[d] ||= { imp: 0, clk: 0, buy: 0, rev: 0 }); e.imp += v.imp; e.clk += v.clk; (eff._camp[d] ||= {})[name] = { imp: v.imp, clk: v.clk, buy: 0, rev: 0 }; }
  return { byDay, byCamp, eff };
}
const res = {}; const errs = [];
try { res['메타'] = await meta(); } catch (e) { errs.push(String(e.message || e).slice(0, 160)); }
try { res['X'] = x(); } catch (e) { errs.push(String(e.message || e).slice(0, 160)); }
const chans = Object.keys(res);
const days = []; for (let d = new Date(SINCE + 'T00:00:00Z'); d.toISOString().slice(0, 10) <= UNTIL; d = new Date(d.getTime() + 86400000)) days.push(d.toISOString().slice(0, 10));
const tot = (d) => chans.reduce((a, c) => a + (res[c].byDay[d] || 0), 0);
const E = (c, d) => res[c]?.eff?.[d] || { imp: 0, clk: 0, buy: 0, rev: 0 };
const effLine = (c, d) => { const e = E(c, d), cost = res[c].byDay[d] || 0; if (!cost) return ''; return `노출 ${Math.round(e.imp).toLocaleString('ko-KR')} · 클릭 ${Math.round(e.clk).toLocaleString('ko-KR')} · CPM ${e.imp ? won(cost / e.imp * 1000) : '-'} · CPC ${e.clk ? won(cost / e.clk) : '-'} · CTR ${e.imp ? (e.clk / e.imp * 100).toFixed(2) : '-'}%` + (c === '메타' ? ` · 구매 ${Math.round(e.buy)}건` : ''); };
const L = [`[일별 광고비 · ${md(UNTIL)}까지]`, ''];
L.push(`■ 어제 ${md(UNTIL)}: ${won(tot(UNTIL))}`);
for (const c of chans) { L.push(`  ${c} ${won(res[c].byDay[UNTIL] || 0)}`); const el = effLine(c, UNTIL); if (el) L.push(`    ${el}`); }
const prev = days[days.length - 2]; if (prev) { const a = tot(UNTIL), b = tot(prev); L.push(`  전일 대비 ${a >= b ? '+' : '−'}${won(Math.abs(a - b))}${b ? ` (${a >= b ? '+' : '−'}${Math.abs(Math.round((a - b) / b * 100))}%)` : ''}`); }
L.push('', `■ 최근 ${days.length}일 (합계 / ${chans.join(' / ')})`);
for (const d of [...days].reverse()) L.push(`${md(d)}  ${won(tot(d))}  /  ${chans.map((c) => won(res[c].byDay[d] || 0)).join(' / ')}`);
const sumCh = (ds) => Object.fromEntries(chans.map((c) => [c, ds.reduce((x, d) => x + (res[c].byDay[d] || 0), 0)]));
const sum14 = { total: days.reduce((x, d) => x + tot(d), 0), ch: sumCh(days) };
L.push(`총 금액 (${days.length}일)  ${won(sum14.total)}  /  ${chans.map((c) => won(sum14.ch[c])).join(' / ')}`, `일평균 ${won(sum14.total / days.length)}`);
const mdays = Object.keys(Object.assign({}, ...chans.map((c) => res[c].byDay))).filter((d) => d >= MONTH0 && d <= UNTIL);
L.push('', `■ ${+UNTIL.slice(5, 7)}월 누적 (${+MONTH0.slice(8)}일~${+UNTIL.slice(8)}일): ${won(mdays.reduce((a, d) => a + tot(d), 0))}`);
for (const c of chans) L.push(`  ${c} ${won(mdays.reduce((a, d) => a + (res[c].byDay[d] || 0), 0))}`);
L.push('', `■ 어제 캠페인별`);
for (const c of chans) { const m = Object.entries(res[c].byCamp[UNTIL] || {}).sort((a, b) => b[1] - a[1]); if (!m.length) { L.push(`[${c}] 집행 없음`); continue; } L.push(`[${c}]`); for (const [n, v] of m.slice(0, 12)) { const e = res[c].eff?._camp?.[UNTIL]?.[n]; L.push(`  ${won(v)} · ${n}` + (e ? (c === '메타' && !/트래픽/.test(n) ? ` · 구매 ${Math.round(e.buy)}건 · 구매당 ${e.buy ? won(v / e.buy) : '-'}` : ` · 클릭당 ${e.clk ? won(v / e.clk) : '-'}`) + ` · CPM ${e.imp ? won(v / e.imp * 1000) : '-'} · 노출 ${Math.round(e.imp || 0).toLocaleString('ko-KR')}` : '')); } if (m.length > 12) L.push(`  외 ${m.length - 12}개 ${won(m.slice(12).reduce((a, [, v]) => a + v, 0))}`); }
if (res['메타']?.note) L.push('', `※ 메타는 ${res['메타'].note}. X는 계정 전체.`);
if (errs.length) L.push('', '⚠️ ' + errs.join(' / '));
// 표 이미지(PNG) — scripts/daily-adspend-table.py → Supabase 업로드 후 웍스 이미지 메시지로 발송(실패 시 파일 첨부)
let png = null;
try {
  const a = tot(UNTIL), bb = prev ? tot(prev) : 0;
  const payload = { until_label: md(UNTIL), yday_total: a, yday_ch: Object.fromEntries(chans.map((c) => [c, res[c].byDay[UNTIL] || 0])), delta: prev && bb ? `${a >= bb ? '+' : '−'}${Math.round(Math.abs(a - bb)).toLocaleString('ko-KR')}원 (${a >= bb ? '+' : '−'}${Math.abs(Math.round((a - bb) / bb * 100))}%)` : '', chans,
    days: [...days].reverse().map((d) => ({ label: md(d), total: tot(d), ch: Object.fromEntries(chans.map((c) => [c, res[c].byDay[d] || 0])), eff: Object.fromEntries(chans.map((c) => [c, { imp: E(c, d).imp, clk: E(c, d).clk }])), clk: chans.reduce((x, c) => x + E(c, d).clk, 0), imp: chans.reduce((x, c) => x + E(c, d).imp, 0), buy: E('메타', d).buy, rev: E('메타', d).rev, mcost: res['메타']?.byDay[d] || 0 })), sum14,
    month: { label: `${+UNTIL.slice(5, 7)}월 누적 (${+MONTH0.slice(8)}~${+UNTIL.slice(8)}일)`, total: mdays.reduce((x, d) => x + tot(d), 0), ch: sumCh(mdays) },
    camps: Object.fromEntries(chans.map((c) => [c, Object.entries(res[c].byCamp[UNTIL] || {}).sort((x, y) => y[1] - x[1]).map(([n, v]) => { const e = res[c].eff?._camp?.[UNTIL]?.[n] || {}; const conv = c === '메타' && !/트래픽/.test(n); return [n, v, conv ? (e.buy ? `구매 ${Math.round(e.buy)}건 · 구매당 ${Math.round(v / e.buy).toLocaleString('ko-KR')}` : '구매 0건') : (e.clk ? `클릭당 ${Math.round(v / e.clk).toLocaleString('ko-KR')}` : ''), e.imp ? v / e.imp * 1000 : 0, e.imp || 0]; })])), note: `메타: 캠페인명 ${clean(env.META_CAMPAIGN_FILTER || '뷰티,부스터')} 포함분 · X: 계정 전체 · 광고 관리자 집행액 기준 · ${kst(0)} 작성` };
  png = execFileSync('/usr/bin/python3', [resolve(HERE, 'daily-adspend-table.py'), `/tmp/daily-adspend-${UNTIL}.png`], { input: JSON.stringify(payload), encoding: 'utf8', timeout: 60000 }).trim().split('\n').pop();
} catch (e) { errs.push('표 이미지 실패: ' + String(e.message || e).slice(0, 100)); }
let sheet = null;
try { sheet = execFileSync('/usr/bin/python3', [resolve(HERE, 'daily-adspend-creatives.py'), UNTIL, `/tmp/daily-adspend-creatives-${UNTIL}.png`], { encoding: 'utf8', timeout: 240000, stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('\n').pop(); if (!sheet.endsWith('.png')) sheet = null; } catch (e) { errs.push('소재 이미지 실패: ' + String(e.message || e).slice(0, 100)); }
const text = L.join('\n');
console.log(text);
if (!DRY) { const parts = []; let cur = ''; for (const ln of text.split('\n')) { if ((cur + ln).length > 1700) { parts.push(cur); cur = ''; } cur += ln + '\n'; } if (cur.trim()) parts.push(cur); for (const p of parts) await sendToUser(TO, p.trim()); const SB = clean(env.NEXT_PUBLIC_SUPABASE_URL), SK = clean(env.SUPABASE_SERVICE_ROLE_KEY);
  const sendPng = async (file, name) => { try { const path = `reports/adspend/${name}.png`;
      const up = await fetch(`${SB}/storage/v1/object/detail-assets/${path}`, { method: 'POST', headers: { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'image/png', 'x-upsert': 'true' }, body: readFileSync(file) });
      if (!up.ok) throw new Error('upload ' + up.status);
      await sendImageToUser(TO, `${SB}/storage/v1/object/public/detail-assets/${path}?v=${Date.now()}`);
    } catch (e) { await sendFileToUser(TO, file, `${name}.png`).catch(() => errs.push('이미지 발송 실패')); } };
  if (png) await sendPng(png, UNTIL);
  if (sheet) await sendPng(sheet, `${UNTIL}-creatives`);
  console.error('sent', parts.length, png || ''); if (errs.length) await telegram('일별 광고비 리포트 오류: ' + errs.join(' / ')).catch(() => {}); }
