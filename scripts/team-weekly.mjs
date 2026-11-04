// 부스터즈팀 월요일 주간 요약(1): 이번 주 일정(담당별) + 지난주 공구·행사 성과 + 요청함 + 회고 → 웍스
// 기본 드라이런(출력만). --send=채널 : 팀 채널, --send=me : 경은 개인. --team : 담당자별 개인 발송
import { env, MEMBER_EMAIL, supa, sendToChannel, sendToUser, kst } from './nworks-lib.mjs';
const SEND = (process.argv.find(a => a.startsWith('--send=')) || '').split('=')[1];
const TEAM = process.argv.includes('--team');
const DB = '32964cd9-cb02-81a5-82ce-f06d2b2fe959';
const H = { Authorization: `Bearer ${env.NOTION_TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' };
const d0 = new Date(Date.now() + 9 * 3600e3); const dow = d0.getUTCDay() || 7; const mon = new Date(d0); mon.setUTCDate(d0.getUTCDate() - dow + 1);
const ds = d => d.toISOString().slice(0, 10); const addD = (d, n) => { const t = new Date(d); t.setUTCDate(t.getUTCDate() + n); return t; };
const W0 = ds(mon), W1 = ds(addD(mon, 6)), P0 = ds(addD(mon, -7)), P1 = ds(addD(mon, -1));
let cursor, items = [];
do { const r = await fetch(`https://api.notion.com/v1/databases/${DB}/query`, { method: 'POST', headers: H, body: JSON.stringify({ filter: { and: [{ property: '날짜', date: { on_or_after: P0 } }, { property: '날짜', date: { on_or_before: W1 } }] }, page_size: 100, start_cursor: cursor }) }); const j = await r.json(); items.push(...(j.results || []).map(p => { const pr = p.properties; return { id: p.id, t: pr['이름']?.title?.map(x => x.plain_text).join(''), ty: pr['유형']?.select?.name || '기타', a: pr['담당자']?.select?.name || '', s: pr['날짜']?.date?.start, e: pr['날짜']?.date?.end || pr['날짜']?.date?.start, done: pr['완료']?.checkbox, memo: pr['메모']?.rich_text?.map(x => x.plain_text).join('') }; })); cursor = j.has_more ? j.next_cursor : null; } while (cursor);
const thisW = items.filter(i => i.s <= W1 && i.e >= W0 && !i.done && i.ty !== '휴무');
const lastEv = items.filter(i => ['공구', '행사'].includes(i.ty) && i.e >= P0 && i.e <= P1 && !/^\[공구 D|^\[공구 오픈|^★원복|^\[행사 준비|^\[행사 오픈/.test(i.t));
const md = s => s.slice(5).replace('-', '/');
const L = [`📋 부스터즈팀 주간 요약 · ${md(W0)}~${md(W1)}`, ''];
L.push('■ 지난주 공구·행사 성과');
if (!lastEv.length) L.push('  (없음)');
for (const i of lastEv) { const m = (i.memo || '').match(/\[성과\]([^\n]*)/); L.push(`  · ${i.t} (${md(i.s)}~${md(i.e)})${m ? ' → ' + m[1].replace(' (자동 기록)', '').trim() : ' → 성과 집계 대기'}`); }
L.push('', '■ 이번 주 일정');
const by = {}; thisW.forEach(i => (by[i.a || '담당 없음'] = by[i.a || '담당 없음'] || []).push(i));
for (const [a, list] of Object.entries(by).sort()) { L.push(`  [${a}]`); list.sort((x, y) => x.s.localeCompare(y.s)).forEach(i => L.push(`   ${md(i.s)}${i.e !== i.s ? '~' + md(i.e) : ''} ${i.ty} · ${i.t}`)); }
try { const [rq] = await supa('settings?key=eq.oa_requests_v1&select=value'); const open = (rq?.value || []).filter(x => x.status !== '완료'); if (open.length) { L.push('', `■ 요청함 미완료 ${open.length}건`); open.slice(0, 8).forEach(x => L.push(`  · [${x.kind}] ${x.product || ''} ${x.note}${x.assignee ? ' → ' + x.assignee : ''}${x.due ? ' (' + md(x.due) + ')' : ''}`)); } } catch {}
try { const [rt] = await supa('settings?key=eq.oa_retro_v1&select=value'); const r = rt?.value?.[P0]; if (r) { L.push('', '■ 지난주 회고'); Object.entries(r).forEach(([m, v]) => L.push(`  ${m}: 잘됨 ${v.good || '—'} / 안됨 ${v.bad || '—'} / 다음 ${v.next || '—'}`)); } } catch {}
L.push('', '대시보드: https://oa-dashboard2.vercel.app');
const text = L.join('\n'); console.log(text);
if (SEND === '채널') await sendToChannel(text);
else if (SEND === 'me') await sendToUser(MEMBER_EMAIL['경은'], text);
if (TEAM) for (const [a, list] of Object.entries(by)) { if (!MEMBER_EMAIL[a]) continue; const t = [`📌 ${a}님 이번 주 일정 (${md(W0)}~${md(W1)})`, ...list.sort((x, y) => x.s.localeCompare(y.s)).map(i => ` ${md(i.s)}${i.e !== i.s ? '~' + md(i.e) : ''} ${i.ty} · ${i.t}`)].join('\n'); console.log('\n--- ' + a + '\n' + t); if (SEND) await sendToUser(MEMBER_EMAIL[a], t); }
