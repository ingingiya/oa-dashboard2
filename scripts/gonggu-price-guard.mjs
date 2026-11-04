// 공구 기간 가격 감시(7): 오늘 진행 중인 공구(노션)가 있을 때만 price-watch 실행 → 변동 시 텔레그램(기존 방식). 아니면 아무것도 안 함
// launchd com.oa.gongguguard 매 2시간(09~21시). 상시 감시(com.oa.pricewatch)는 10/29 사용자 요청으로 꺼진 상태 유지
import { env } from './nworks-lib.mjs';
import { execFileSync } from 'node:child_process';
const DB = '32964cd9-cb02-81a5-82ce-f06d2b2fe959';
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const r = await fetch(`https://api.notion.com/v1/databases/${DB}/query`, { method: 'POST', headers: { Authorization: `Bearer ${env.NOTION_TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' }, body: JSON.stringify({ filter: { and: [{ property: '유형', select: { equals: '공구' } }, { property: '날짜', date: { on_or_before: today } }] }, page_size: 50 }) });
const live = ((await r.json()).results || []).map(p => { const pr = p.properties; return { t: pr['이름']?.title?.map(x => x.plain_text).join(''), s: pr['날짜']?.date?.start, e: pr['날짜']?.date?.end || pr['날짜']?.date?.start }; }).filter(i => i.e >= today && !/^\[공구 D|^\[공구 오픈|^★원복/.test(i.t));
if (!live.length) { console.log(today, '진행 중 공구 없음 → 감시 안 함'); process.exit(0); }
console.log(today, '진행 중 공구:', live.map(i => i.t).join(' / '));
try { console.log(execFileSync('node', ['scripts/price-watch/price-watch.mjs'], { cwd: '/Users/kirby/oa-dashboard2', encoding: 'utf8', timeout: 600000 })); } catch (e) { console.log('price-watch 실패', String(e.message).slice(0, 200)); }
