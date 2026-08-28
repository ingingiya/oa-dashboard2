// 🎉 광고상사 속보 봇 — 담당 부서 계약 마일스톤 속보 + 🎖 승진 인사발령을 웍스 채널에
// 크론: 평일 낮 정시(12~18시). 상태는 scripts/.flash-state.json (날짜별 발표 이력)
// 사용법: node scripts/nworks-ad-flash.mjs [--dry-run]
import { readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { sendToChannel, telegram, kst } from './nworks-lib.mjs';
import { RANKS, rankOf, weekWindow, questGoal } from '../lib/ad-ranks.mjs'; // ★공유 모듈 — /ads page.jsx와 단일 소스

const DRY = process.argv.includes('--dry-run');
const URL = 'https://oa-dashboard2.vercel.app/api/ad-console';
const STATE = resolve(dirname(fileURLToPath(import.meta.url)), '.flash-state.json');
const MILESTONES = [3, 5, 10, 20, 30, 50];

async function main() {
  const j = await (await fetch(URL)).json();
  if (!j.campaigns?.length) throw new Error(`콘솔 데이터 없음: ${j.error || j.metaDownReason || ''}`);

  let st = {};
  try { st = JSON.parse(readFileSync(STATE, 'utf8')); } catch {}
  const today = kst(0);
  if (st.date !== today) st = { date: today, hit: {}, ranks: st.ranks || {}, quest: st.quest || null, planSeen: st.planSeen || {} }; // hit: {adsetId:[마일스톤]}, ranks·quest·planSeen은 날짜 무관 유지
  st.planSeen = st.planSeen || {};
  // 🧹 planSeen 무한 누적 방지 — 현재 payload에 없는(cap 40 밀려난) 기획서 id는 정리
  st.planSeen = Object.fromEntries(Object.entries(st.planSeen).filter(([id]) => (j.plans || []).some((p) => p.id === id)));

  const owners = j.owners || {};
  const lines = [];

  // ① 계약 마일스톤 속보 — 담당 있는 부서만 (담당자 실명 칭찬이 목적)
  for (const c of j.campaigns) {
    const nm = owners[c.id];
    if (!nm) continue;
    for (const s of c.adsets || []) {
      const buy = s.buyToday || 0;
      if (!buy) continue;
      const done = st.hit[s.id] || [];
      const crossed = MILESTONES.filter((m) => buy >= m && !done.includes(m));
      if (!crossed.length) continue;
      st.hit[s.id] = [...done, ...crossed];
      const top = Math.max(...crossed);
      lines.push(`🎉 속보 — ${nm}님 담당 [${c.name}] "${s.name}" 오늘 계약 ${buy}건 돌파! (${top}건 고지 점령)`);
    }
  }

  // ② 승진 인사발령 — career pts로 직급이 올랐으면 공고
  for (const [nm, cc] of Object.entries(j.career || {})) {
    const rank = rankOf(cc.pts || 0);
    const prev = st.ranks[nm];
    if (prev && prev !== rank) {
      const wasIdx = RANKS.findIndex(([, r]) => r === prev), nowIdx = RANKS.findIndex(([, r]) => r === rank);
      if (nowIdx > wasIdx) lines.push(`🎖 인사발령 — ${nm} ${prev}, 금일부로 ${rank} 승진을 명함 (커리어 ${cc.pts}pt). 축하 도장 부탁드립니다 🖊`);
    }
    st.ranks[nm] = rank;
  }

  // ③ 신규 채용 기획서 공고 — 제출/채택을 각 1회만 공고 (planSeen: {planId: 마지막 공고 status})
  for (const p of j.plans || []) {
    const seen = st.planSeen[p.id];
    if (!seen && p.status === "pending") {
      st.planSeen[p.id] = "pending";
      lines.push(`📝 신규 채용 기획서 — ${p.by}님이 [${p.product}] 기획서를 올렸습니다. 사장 결재 대기 중 🖊`);
    } else if (seen !== "approved" && p.status === "approved") {
      st.planSeen[p.id] = "approved";
      lines.push(`🎉 기획 채택 — ${p.by}님의 [${p.product}] 기획이 채택됐습니다! 소재 제작 들어갑니다 🎨 (커리어 +3pt)`);
    } else if (!seen && p.status === "rejected") {
      st.planSeen[p.id] = "rejected"; // 반려는 공고 없이 조용히 마킹
    }
  }

  // ④ 전사 협력 퀘스트 달성 — 산식은 lib/ad-ranks.mjs 공유 (지난주 +5%, 최소 10)
  const days = j.monthly?.days30 || [];
  if (days.length) {
    const { monS, pmonS } = weekWindow();
    const cur = days.filter((d) => d.d >= monS).reduce((a, d) => a + (d.buy || 0), 0);
    const prevW = days.filter((d) => d.d >= pmonS && d.d < monS).reduce((a, d) => a + (d.buy || 0), 0);
    if (prevW) {
      const goal = questGoal(prevW);
      if (cur >= goal && st.quest !== monS) {
        st.quest = monS; // 주당 1회만 공고
        lines.push(`🎯 전사 퀘스트 달성 — 이번 주 계약 ${cur}건, 목표 ${goal}건(지난주 +5%) 돌파! 전 부서 협력의 승리입니다 👏`);
      }
    }
  }

  if (!lines.length) { console.log('발표할 소식 없음'); if (!DRY) writeFileSync(STATE, JSON.stringify(st)); return; }
  const msg = lines.join('\n\n') + '\n\n👉 oa-dashboard2.vercel.app/ads';
  console.log('──── 미리보기 ────\n' + msg + '\n─────────────────');
  if (DRY) { console.log('(dry-run — 발송·상태저장 안 함)'); return; }
  await sendToChannel(msg);
  console.log('채널 발송 완료');
  writeFileSync(STATE, JSON.stringify(st));
}

main().catch(async (e) => {
  console.error('nworks-ad-flash 실패:', e.message || e);
  await telegram(`⚠️ 광고상사 속보 봇 실패: ${String(e.message || e).slice(0, 200)}`);
  process.exit(1);
});
