#!/usr/bin/env node
// 제품 프로젝트 보드 CLI (텔레그램/터미널 세션에서 클로드가 사용)
//  node project-board.mjs list [프로젝트명]                     — 결정 대기·지연·이번주 요약
//  node project-board.mjs decide "<항목 키워드>" "<결정 내용>" [--by 사장님]  — 결정 기록 + 항목 플래그 해제 + 메모
//  node project-board.mjs flag "<항목 키워드>"                   — 결정 필요 표시
//  node project-board.mjs done "<항목 키워드>" [--by 이름]         — 완료 처리
//  node project-board.mjs add <팀키 plan|dev|scm|design|mkt|cs> "<할 일>" [YYYY-MM-DD] [담당]
//  node project-board.mjs note "<항목 키워드>" "<메모>"
//  --project "<이름 일부>" 로 프로젝트 지정(기본: 첫 번째 진행 중 프로젝트)
import { env } from './nworks-lib.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const BY = opt('--by', '클로드');
const PROJ = opt('--project', '');
const [cmd, a1, a2, a3, a4] = args;

const H = { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' };
const URL_ = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/settings`;
const now = () => new Date().toISOString();
const today = new Date(Date.now() + 9*3600000).toISOString().slice(0, 10);
const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const rows = await (await fetch(`${URL_}?key=eq.oa_projects_v1&select=value`, { headers: H })).json();
const value = rows?.[0]?.value || { projects: [] };
const p = value.projects.find(x => PROJ ? x.name.includes(PROJ) : x.status !== '완료') || value.projects[0];
if (!p) { console.log('프로젝트 없음'); process.exit(1); }

const all = () => Object.entries(p.teams).flatMap(([k, t]) => t.items.map(it => ({ it, teamKey: k })));
function find(kw) {
  const hits = all().filter(({ it }) => it.text.includes(kw));
  if (hits.length !== 1) { console.log(hits.length ? `여러 개 일치(${hits.length}): \n` + hits.map(h => ' - ' + h.it.text).join('\n') : `일치 항목 없음: ${kw}`); process.exit(1); }
  return hits[0];
}
const log = t => { p.log = [{ at: now(), by: BY, text: t }, ...(p.log || [])].slice(0, 200); };
const stamp = it => { it.updatedAt = now(); it.updatedBy = BY; };
async function save() {
  value.updated = now();
  const r = await fetch(`${URL_}?key=eq.oa_projects_v1`, { method: 'PATCH', headers: H, body: JSON.stringify({ value }) });
  if (!r.ok) throw new Error('저장 실패 ' + r.status);
}

if (cmd === 'list' || !cmd) {
  const open = all().filter(({ it }) => it.status !== '완료');
  const dec = open.filter(({ it }) => it.needsDecision);
  const late = open.filter(({ it }) => it.due && it.due < today);
  console.log(`■ ${p.name} (${all().length - open.length}/${all().length})`);
  if (dec.length) console.log('🔴 결정 대기\n' + dec.map(({ it }) => ` - ${it.text}`).join('\n'));
  if (late.length) console.log('⚠️ 지연\n' + late.map(({ it }) => ` - ${it.text} (${it.due})`).join('\n'));
  console.log('📝 결정 사항 최근 5\n' + (p.decisions || []).slice(-5).map(d => ` - ${d.date} ${d.by}: ${d.text}`).join('\n'));
} else if (cmd === 'decide') {
  const { it } = find(a1);
  (p.decisions ||= []).push({ id: id(), date: today, by: BY === '클로드' ? '사장님' : BY, text: a2 });
  it.needsDecision = false; it.memo = `결정: ${a2}`.slice(0, 200); stamp(it);
  log(`결정 기록: ${a2.slice(0, 40)} (항목: ${it.text.slice(0, 30)})`);
  await save(); console.log(`✓ 결정 기록 → ${it.text}\n   ${a2}`);
} else if (cmd === 'flag') {
  const { it } = find(a1); it.needsDecision = true; stamp(it); log(`결정 필요 표시: ${it.text.slice(0, 30)}`);
  await save(); console.log(`✓ 결정 필요 표시 → ${it.text}`);
} else if (cmd === 'done') {
  const { it } = find(a1); it.status = '완료'; stamp(it); log(`완료: ${it.text.slice(0, 30)}`);
  await save(); console.log(`✓ 완료 → ${it.text}`);
} else if (cmd === 'note') {
  const { it } = find(a1); it.memo = a2; stamp(it); log(`메모: ${it.text.slice(0, 30)}`);
  await save(); console.log(`✓ 메모 → ${it.text}`);
} else if (cmd === 'add') {
  if (!p.teams[a1]) { console.log('팀키: plan|dev|scm|design|mkt|cs'); process.exit(1); }
  const it = { id: id(), text: a2, status: '대기', owner: a4 || '', due: a3 || '', memo: '', updatedAt: now(), updatedBy: BY };
  p.teams[a1].items.push(it); log(`항목 추가: ${a2.slice(0, 30)}`);
  await save(); console.log(`✓ 추가 → [${a1}] ${a2}`);
} else {
  console.log('명령: list | decide | flag | done | note | add');
}
