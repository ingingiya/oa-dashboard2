#!/usr/bin/env node
// 제품 프로젝트 보드(oa_projects_v1) 주간 요약 → 웍스 발송
// 사용: node project-board-weekly.mjs            (드라이런: 콘솔 출력만)
//       node project-board-weekly.mjs --send     (사장님 kkeim@oa-world.com 발송)
//       node project-board-weekly.mjs --send --team  (+ 팀 담당자별 자기 항목 발송)
import { env, sendToUser, supa, kst, MEMBER_EMAIL } from './nworks-lib.mjs';

const SEND = process.argv.includes('--send');
const TEAM = process.argv.includes('--team');
const OWNER_EMAIL = 'kkeim@oa-world.com';
const BOARD_URL = 'https://oa-dashboard2.vercel.app';
const TEAM_LABEL = { plan:'상품기획', dev:'개발·QC', scm:'구매·물류', design:'디자인', mkt:'마케팅', cs:'CS·운영' };

const today = kst();
const weekAgo = new Date(Date.now() + 9*3600000 - 7*86400000).toISOString();
const days = d => Math.ceil((new Date(d + 'T00:00:00+09:00') - Date.now()) / 86400000);

const rows = await supa('settings?key=eq.oa_projects_v1&select=value');
const projects = rows?.[0]?.value?.projects || [];
if (!projects.length) { console.log('프로젝트 없음'); process.exit(0); }

function items(p) {
  return Object.entries(p.teams || {}).flatMap(([k, t]) => (t.items || []).map(it => ({ ...it, team: TEAM_LABEL[k] || k })));
}
const line = it => `  - [${it.team}] ${it.text}${it.owner ? ` (${it.owner})` : ''}${it.due ? ` · ${it.due.slice(5)}` : ''}`;

let out = `📋 제품 프로젝트 주간 요약 · ${today.slice(5)}(월)\n`;
const perOwner = {};
for (const p of projects) {
  if (p.status === '완료' || p.status === '보류') continue;
  const all = items(p);
  const open = all.filter(i => i.status !== '완료');
  const late = open.filter(i => i.due && i.due < today);
  const week = open.filter(i => i.due && i.due >= today && days(i.due) <= 7);
  const blocked = open.filter(i => i.status === '차단');
  const decide = open.filter(i => i.needsDecision);
  const doneWeek = all.filter(i => i.status === '완료' && i.updatedAt && i.updatedAt >= weekAgo);
  const dd = p.targetDate ? days(p.targetDate) : null;
  out += `\n■ ${p.name} · 진행 ${all.length - open.length}/${all.length}${dd !== null ? ` · 목표 ${p.targetDate.slice(5)} (D-${dd})` : ''}\n`;
  if (decide.length) out += `🔴 사장님 결정 대기 ${decide.length}건\n${decide.map(line).join('\n')}\n`;
  if (late.length) out += `⚠️ 지연 ${late.length}건\n${late.map(i => line(i) + ` (D+${-days(i.due)})`).join('\n')}\n`;
  if (week.length) out += `📅 이번 주 마감 ${week.length}건\n${week.map(line).join('\n')}\n`;
  if (blocked.length) out += `⛔ 차단 ${blocked.length}건\n${blocked.map(i => line(i) + (i.memo ? ` — ${i.memo}` : '')).join('\n')}\n`;
  if (doneWeek.length) out += `✅ 지난주 완료 ${doneWeek.length}건\n${doneWeek.map(line).join('\n')}\n`;
  if (!decide.length && !late.length && !week.length && !blocked.length) out += `  이번 주 마감·지연 없음\n`;
  for (const it of [...late, ...week, ...blocked]) {
    if (!it.owner || !MEMBER_EMAIL[it.owner]) continue;
    (perOwner[it.owner] ||= []).push(`[${p.name}] ${line(it).trim()}${it.due && it.due < today ? ' (지연)' : ''}`);
  }
}
out += `\n${BOARD_URL} → 프로젝트 탭`;

console.log(out);
if (SEND) {
  await sendToUser(OWNER_EMAIL, out);
  console.log(`→ 발송: ${OWNER_EMAIL}`);
  if (TEAM) {
    for (const [name, list] of Object.entries(perOwner)) {
      const txt = `📋 ${name}님 이번 주 프로젝트 항목 (${today.slice(5)})\n${[...new Set(list)].map(l => '  - ' + l.replace(/^- /, '')).join('\n')}\n\n${BOARD_URL} → 프로젝트 탭에서 상태·메모 업데이트 부탁드려요`;
      await sendToUser(MEMBER_EMAIL[name], txt);
      console.log(`→ 발송: ${name} ${MEMBER_EMAIL[name]} (${list.length}건)`);
    }
  }
}
