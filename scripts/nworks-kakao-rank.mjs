// 카카오 선물하기 순위 리포트 → 네이버웍스 팀 채널
// 데이터: Supabase settings oa_kakao_rank_v1 (추적기가 매일 07시 슬롯으로 갱신). 실행: node scripts/nworks-kakao-rank.mjs [--dry]
import { supa, sendToChannel, telegram } from './nworks-lib.mjs';

const arrow = (p, t) => {
  if (t == null && p == null) return '—';
  if (p == null) return `신규 ${t}위`;
  if (t == null) return `${p}위→권외`;
  const d = p - t;
  return `${p}→${t}위 ${d > 0 ? '▲' + d : d < 0 ? '▼' + -d : '＝'}`;
};
const fmt = (n) => (n == null ? '—' : n.toLocaleString());
const delta = (a, b) => (a == null || b == null ? '' : `(${a - b >= 0 ? '+' : ''}${(a - b).toLocaleString()})`);

export function buildReport(r) {
  const L = [`📊 카카오 선물하기 순위 리포트 · ${r.date} ${r.slot === 'h07' ? '07:00' : r.slot} (전일 ${r.prevDate} 대비)`, ''];
  const up = [], down = [];
  for (const p of r.products) {
    const g = p.goal || {}; const gl = g.list; const gt = g.min ? `${g.min}~${g.max}위` : '미정';
    const main = p.ranks?.[gl] || {}; const t = main.today, pv = main.prev;
    const status = t && g.max && t <= g.max ? '🎯' : t && g.max && t <= g.max * 1.5 ? '🔺' : '▫️';
    const other = Object.entries(p.ranks || {}).filter(([k, v]) => k !== gl && (v.prev != null || v.today != null)).map(([k, v]) => `${k} ${arrow(v.prev, v.today)}`);
    L.push(`${status} ${p.name} — 목표 ${gl} ${gt}`);
    L.push(`   ${gl} ${arrow(pv, t)}${other.length ? '  |  ' + other.join(' · ') : ''}`);
    L.push(`   찜 ${fmt(p.wish?.today)}${delta(p.wish?.today, p.wish?.prev)} · 리뷰 ${fmt(p.review?.today)}${delta(p.review?.today, p.review?.prev)}${p.memo ? '  📝' + p.memo : ''}`);
    if (pv != null && t != null && t < pv) up.push(`${p.name}(${gl} ${pv}→${t})`);
    if (pv != null && (t == null || t > pv)) down.push(`${p.name}(${gl} ${pv}→${t ?? '권외'})`);
  }
  L.push('', `상승: ${up.join(' · ') || '없음'}`, `하락: ${down.join(' · ') || '없음'}`);
  return L.join('\n');
}

const [row] = await supa('settings?key=eq.oa_kakao_rank_v1&select=value');
if (!row) throw new Error('oa_kakao_rank_v1 없음');
const text = buildReport(row.value);
if (process.argv.includes('--dry')) { console.log(text); process.exit(0); }
try { await sendToChannel(text); console.log('웍스 채널 발송 완료', row.value.date); }
catch (e) { await telegram('❌ 카카오 순위 웍스 발송 실패: ' + e.message).catch(() => {}); throw e; }
