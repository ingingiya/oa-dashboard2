// 🏆 월간 광고상사 시상식 — 지난달 결산+부서장/결재왕/명중왕/직급 현황을 웍스 채널에
// 크론: 매월 1일 아침. 지난달 결산은 payload monthly.prev(1일엔 cur이 새 달) 기준
// 사용법: node scripts/nworks-ad-awards.mjs [--dry-run]
import { sendToChannel, telegram } from './nworks-lib.mjs';

const DRY = process.argv.includes('--dry-run');
const URL = 'https://oa-dashboard2.vercel.app/api/ad-console?fresh=1';
const w = (n) => `₩${Math.round(n || 0).toLocaleString()}`;
// ★/ads page.jsx RANKS와 동일해야 함
const RANKS = [[0, '인턴'], [2, '사원'], [5, '주임'], [10, '대리'], [18, '과장'], [30, '차장'], [45, '부장'], [70, '상무'], [100, '전무'], [140, '부사장']];
const rankOf = (pts) => { let r = RANKS[0][1]; for (const [th, nm] of RANKS) if (pts >= th) r = nm; return r; };

async function main() {
  const j = await (await fetch(URL)).json();
  if (!j.campaigns?.length) throw new Error(`콘솔 데이터 없음: ${j.error || j.metaDownReason || ''}`);

  const prev = j.monthly?.prev; // 결산 대상 = 지난달
  const mon = prev?.mon ? +prev.mon.slice(5, 7) : null;
  const roas = prev?.spend ? Math.round((prev.rev / prev.spend) * 100) / 100 : null;

  // 🥇 이달의 부서장 — 담당 부서 최근 7일 계약 합 1위 (월별 담당 분해 데이터가 없어 7일 스냅샷 기준)
  const owners = j.owners || {};
  const byOwner = {};
  for (const c of j.campaigns) {
    const nm = owners[c.id];
    if (!nm) continue;
    const o = (byOwner[nm] = byOwner[nm] || { buy: 0, spend: 0 });
    for (const s of c.adsets || []) if (s.status === 'ACTIVE') { o.buy += s.purchases7 || 0; o.spend += s.spend7 || 0; }
  }
  const bestOwner = Object.entries(byOwner).sort((a, b) => b[1].buy - a[1].buy)[0];

  // 🖊 결재왕 / 🎯 명중왕 — 최근 결재 기록(30건) 기준
  const stamps = {}, wins = {};
  for (const l of j.log || []) {
    if (!l.by) continue;
    stamps[l.by] = (stamps[l.by] || 0) + 1;
    if (l.verdict === 'win') wins[l.by] = (wins[l.by] || 0) + 1;
  }
  const kingStamp = Object.entries(stamps).sort((a, b) => b[1] - a[1])[0];
  const kingWin = Object.entries(wins).sort((a, b) => b[1] - a[1])[0];

  // 🎖 직급 현황 — career pts 내림차순
  const ranks = Object.entries(j.career || {}).sort((a, b) => (b[1].pts || 0) - (a[1].pts || 0))
    .map(([nm, c]) => `${nm} ${rankOf(c.pts || 0)}(${c.pts || 0}pt)`);

  const lines = [
    `🏆 월간 광고상사 시상식${mon ? ` — ${mon}월 결산` : ''}`,
    '',
    prev ? `💰 전사 결산: 지출 ${w(prev.spend)} · 매출 ${w(prev.rev)} · 계약 ${(prev.buy || 0).toLocaleString()}건${roas ? ` · ROAS ${roas}` : ''}` : '💰 전사 결산: 데이터 없음',
    '',
  ];
  if (bestOwner) lines.push(`🥇 이달의 부서장: ${bestOwner[0]}님 — 담당 계약 ${bestOwner[1].buy}건 · 집행 ${w(bestOwner[1].spend)} (최근 7일 기준)`);
  if (kingStamp) lines.push(`🖊 결재왕: ${kingStamp[0]}님 — 도장 ${kingStamp[1]}회`);
  if (kingWin) lines.push(`🎯 명중왕: ${kingWin[0]}님 — 성공 판정 ${kingWin[1]}회`);
  if (!bestOwner && !kingStamp) lines.push('…이달은 수상자가 없습니다. 다음 달 주인공은 여러분! 🖊');
  if (ranks.length) lines.push('', `🎖 임직원 직급 현황: ${ranks.join(' · ')}`);
  lines.push('', '박수 한 번 부탁드립니다 👏', '👉 oa-dashboard2.vercel.app/ads');

  const msg = lines.join('\n');
  console.log('──── 미리보기 ────\n' + msg + '\n─────────────────');
  if (DRY) { console.log('(dry-run — 발송 안 함)'); return; }
  await sendToChannel(msg);
  console.log('채널 발송 완료');
}

main().catch(async (e) => {
  console.error('nworks-ad-awards 실패:', e.message || e);
  await telegram(`⚠️ 월간 광고상사 시상식 실패: ${String(e.message || e).slice(0, 200)}`);
  process.exit(1);
});
