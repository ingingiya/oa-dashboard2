// [오아 대시보드] 아침 브리핑 → 네이버웍스 그룹방 (크론: 매일 9:20, beauty_sales 동기화 9:12 이후)
// 내용: 이미용 매출 급등급락(±40%만) + 메타 소재 검토 + 오늘의 가설/담당 + (월요일) 지난주 실행률
// 테스트: node nworks-briefing.mjs --dry-run
import { kst, fmtW, supa, sendToChannel, sendImageToChannel, telegram } from './nworks-lib.mjs';

const BEAUTY_CODES = ['DRY', 'STR', 'GVN', 'MUM']; // 드라이기, 고데기, 갈바닉, 화장거울

// ── 이미용 매출: 어제 vs 직전 7일 평균, 급등/급락(±40%)일 때만 라인
async function beautyAnomaly(yday) {
  const by = {};
  // 날짜별 개별 조회 (Supabase 1,000행 제한)
  await Promise.all(Array.from({ length: 8 }, (_, i) => i + 1).map(async (d) => {
    const rows = await supa(`beauty_sales?date=eq.${kst(d)}&cat_id=in.(${BEAUTY_CODES.join(',')})&select=revenue`);
    by[kst(d)] = rows.reduce((s, r) => s + Number(r.revenue || 0), 0);
  }));
  const y = by[yday] || 0;
  const prior = [];
  for (let d = 2; d <= 8; d++) { const v = by[kst(d)]; if (v > 0) prior.push(v); }
  const avg = prior.length ? prior.reduce((s, v) => s + v, 0) / prior.length : 0;
  let line = null;
  if (y > 0 && avg > 0) {
    const dev = (y - avg) / avg;
    if (Math.abs(dev) >= 0.4)
      line = `${dev > 0 ? '📈 이미용 매출 급등' : '📉 이미용 매출 급락'} — 어제 ${fmtW(y)} (7일 평균 ${fmtW(avg)}, ${dev > 0 ? '+' : ''}${Math.round(dev * 100)}%)`;
  }
  return { line, missing: y === 0 };
}

// ── 메타 소재 검토: 최근 7일 소재별 지출·클릭 → 지출 10만원↑ & CTR이 전체 평균의 절반 미만
function parseCSV(text) {
  const rows = []; let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += c; }
    else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row);
  return rows;
}
const num = (v) => { const n = parseFloat(String(v || '').replace(/,/g, '').replace(/[^0-9.-]/g, '')); return isNaN(n) ? 0 : n; };
const normDate = (v) => {
  const s = String(v || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const ko = s.match(/^(\d{4})[.\s]+(\d{1,2})[.\s]+(\d{1,2})/);
  if (ko) return `${ko[1]}-${ko[2].padStart(2, '0')}-${ko[3].padStart(2, '0')}`;
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  return '';
};

async function creativeReview(yday) {
  const set = await supa('settings?key=eq.oa_conv_sheet_url_v1&select=value');
  let url = set?.[0]?.value;
  if (typeof url === 'string') url = url.replace(/^"|"$/g, '');
  if (!url) return null;
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (m) {
    const gid = (url.match(/[#&?]gid=(\d+)/) || [])[1] || '0';
    url = `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${gid}&t=${Date.now()}`;
  }
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' });
  if (!r.ok) return null;
  const rows = parseCSV(await r.text());
  if (rows.length < 2) return null;
  const header = rows[0].map((h) => h.trim());
  const idx = (...names) => header.findIndex((h) => names.some((n) => h.replace(/\s/g, '') === n.replace(/\s/g, '')));
  const iDate = idx('일', '날짜', '보고 시작');
  const iCamp = idx('캠페인 이름'), iAd = idx('광고 이름');
  const iSpend = idx('지출 금액 (KRW)', '지출 금액');
  const iImp = idx('노출');
  const iClick = idx('링크 클릭', '클릭(전체)', '클릭 (전체)');
  if (iDate < 0 || iSpend < 0 || iAd < 0 || iImp < 0 || iClick < 0) return null;

  const from = kst(7);
  const byAd = {}; // 광고 이름 -> {spend, imp, click}
  let ydaySpend = 0;
  for (const r2 of rows.slice(1)) {
    const d = normDate(r2[iDate]);
    if (!d || d < from || d > yday) continue;
    const name = String(r2[iAd] || '').trim();
    if (!name || ((r2[iCamp] || '') + name).includes('Instagram 게시물')) continue;
    byAd[name] = byAd[name] || { spend: 0, imp: 0, click: 0 };
    byAd[name].spend += num(r2[iSpend]);
    byAd[name].imp += num(r2[iImp]);
    byAd[name].click += num(r2[iClick]);
    if (d === yday) ydaySpend += num(r2[iSpend]);
  }
  const all = Object.values(byAd);
  const totImp = all.reduce((s, v) => s + v.imp, 0);
  const avgCtr = totImp > 0 ? all.reduce((s, v) => s + v.click, 0) / totImp : 0;
  const pct = (x) => (x * 100).toFixed(2) + '%';
  const flaggedAds = Object.entries(byAd)
    .filter(([, v]) => v.spend >= 100000 && v.imp > 0 && v.click / v.imp < avgCtr * 0.5)
    .sort((a, b) => b[1].spend - a[1].spend);
  const flagged = flaggedAds.map(([name, v]) =>
    `${name}\n   ㄴ 7일 ${fmtW(v.spend)} · CTR ${pct(v.click / v.imp)}\n   ㄴ 재제작: oa-dashboard2.vercel.app/?recreate=${encodeURIComponent(name)}`);
  return { flagged, names: flaggedAds.map(([name]) => name), avgCtr: pct(avgCtr), missing: ydaySpend === 0 };
}

// ── 소재 썸네일 매칭 (oa_meta_thumbs_v1: {광고명: url}, Dashboard.jsx matchMetaThumb와 동일 로직)
async function matchThumbs(names) {
  if (!names?.length) return [];
  const set = await supa('settings?key=eq.oa_meta_thumbs_v1&select=value');
  let thumbs = set?.[0]?.value;
  if (typeof thumbs === 'string') { try { thumbs = JSON.parse(thumbs); } catch { thumbs = null; } }
  if (!thumbs || typeof thumbs !== 'object') return [];
  const norm = (s) => s.toLowerCase().replace(/[\s_\-.]+/g, '');
  return names.map((name) => {
    if (thumbs[name]) return { name, url: thumbs[name] };
    const nn = norm(name);
    const k = Object.keys(thumbs).find((t) => { const nt = norm(t); return nt.includes(nn) || nn.includes(nt); });
    return k ? { name, url: thumbs[k] } : null;
  }).filter(Boolean);
}

// ── 오늘의 가설 + 담당 현황
async function todayHypos(today) {
  const hypos = await supa(`daily_hypotheses?date=eq.${today}&select=id,type,product,assignee&order=id.asc`);
  return hypos.map((h, i) => {
    const who = h.assignee ? `담당 ${h.assignee}` : '담당 미지정❗';
    return `${i + 1}. ${h.product}\n   ㄴ ${h.type} · ${who}`;
  });
}

// ── 확인할 것 (마감 지남/임박 + 데이터 누락)
async function checkItems(beautyMissing, metaMissing) {
  const today = kst(0);
  const hypos = await supa(`daily_hypotheses?status=eq.open&select=assignee,due_date,executed`);
  const overdue = hypos.filter((h) => h.due_date && !h.executed && h.due_date < today).length;
  const dueSoon = hypos.filter((h) => h.due_date && !h.executed && h.due_date >= today
    && (new Date(h.due_date) - new Date(today)) / 86400000 <= 1).length;
  const items = [];
  if (overdue) items.push(`마감 지난 가설 ${overdue}`);
  if (dueSoon) items.push(`마감 임박 가설 ${dueSoon}`);
  if (beautyMissing) items.push('이미용 매출데이터 누락');
  if (metaMissing) items.push('메타광고 데이터 누락');
  return items;
}

// ── 월요일: 지난주 팀원별 실행률
async function weeklyScoreboard(today) {
  const dow = new Date(today + 'T00:00:00+09:00').getDay();
  if (dow !== 1) return null; // 월요일만
  const monAgo = kst(7), sunday = kst(1);
  const hypos = await supa(`daily_hypotheses?date=gte.${monAgo}&date=lte.${sunday}&select=assignee,executed`);
  const by = {};
  for (const h of hypos) {
    const k = h.assignee || '미지정';
    by[k] = by[k] || { total: 0, done: 0 };
    by[k].total++;
    if (h.executed) by[k].done++;
  }
  const parts = Object.entries(by)
    .sort((a, b) => b[1].done - a[1].done)
    .map(([k, v]) => `${k} ${v.done}/${v.total}`);
  return parts.length ? `🏆 지난주 실행률: ${parts.join(' · ')}` : null;
}

async function main() {
  const yday = kst(1), today = kst(0);
  const dow = '일월화수목금토'[new Date(today + 'T00:00:00+09:00').getDay()];

  const [beauty, creative, hypoLines, score] = await Promise.all([
    beautyAnomaly(yday), creativeReview(yday), todayHypos(today), weeklyScoreboard(today),
  ]);
  const checks = await checkItems(beauty.missing, creative?.missing);

  const lines = [`📋 ${Number(today.slice(5, 7))}/${Number(today.slice(8, 10))}(${dow}) 아침 브리핑`];
  if (beauty.line) lines.push(``, beauty.line);
  if (creative?.flagged?.length) {
    lines.push(``, `🎨 소재 검토 ${creative.flagged.length}건 (평균 CTR ${creative.avgCtr})`);
    creative.flagged.slice(0, 5).forEach((f, i) => lines.push(`${i + 1}. ${f}`));
  }
  if (hypoLines.length) {
    lines.push(``, `🎯 오늘의 가설 ${hypoLines.length}건`);
    lines.push(...hypoLines);
  }
  if (checks.length) lines.push(``, `⚠️ 확인: ${checks.join(' · ')}`);
  if (score) lines.push(``, score);
  lines.push(``, `👉 oa-dashboard2.vercel.app`);

  const thumbs = await matchThumbs(creative?.names?.slice(0, 5));

  if (process.argv.includes('--dry-run')) {
    console.log('[dry-run] 발송 안 함:\n' + lines.join('\n'));
    console.log(`[dry-run] 썸네일 ${thumbs.length}장:`, thumbs.map((t) => t.name).join(', ') || '없음');
    return;
  }
  await sendToChannel(lines.join('\n'));
  // 소재 썸네일: 리스트 순서대로 이미지 발송 (실패해도 브리핑은 이미 나갔으므로 무시)
  for (const t of thumbs) {
    await sendImageToChannel(t.url).catch((e) => console.error(`썸네일 실패 (${t.name}):`, e.message));
  }
  console.log(`발송 완료 (썸네일 ${thumbs.length}장):\n` + lines.join('\n'));
}

main().catch(async (e) => {
  console.error('실패:', e.message);
  await telegram(`❌ 웍스 아침 브리핑 실패\n${e.message.slice(0, 300)}`);
  process.exit(1);
});
