// D-3 알림(2): 3일 뒤 시작하는 공구·행사·PPL·광고 일정을 담당자에게 웍스 개인 메시지. 기본 드라이런, --send 로 발송
import { env, MEMBER_EMAIL, sendToUser, sendToChannel } from './nworks-lib.mjs';
const SEND = process.argv.includes('--send');
const DB = '32964cd9-cb02-81a5-82ce-f06d2b2fe959';
const H = { Authorization: `Bearer ${env.NOTION_TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' };
const t = new Date(Date.now() + 9 * 3600e3); t.setUTCDate(t.getUTCDate() + 3); const D3 = t.toISOString().slice(0, 10);
const r = await fetch(`https://api.notion.com/v1/databases/${DB}/query`, { method: 'POST', headers: H, body: JSON.stringify({ filter: { and: [{ property: '날짜', date: { equals: D3 } }, { property: '완료', checkbox: { equals: false } }] }, page_size: 100 }) });
const items = ((await r.json()).results || []).map(p => { const pr = p.properties; return { t: pr['이름']?.title?.map(x => x.plain_text).join(''), ty: pr['유형']?.select?.name || '기타', a: pr['담당자']?.select?.name || '', e: pr['날짜']?.date?.end, memo: pr['메모']?.rich_text?.map(x => x.plain_text).join('') }; }).filter(i => ['공구', '행사', '광고', '시딩', '이벤트', '촬영'].includes(i.ty) && !/^\[공구 D|^★원복|^\[행사 준비/.test(i.t));
if (!items.length) { console.log('D-3 해당 없음', D3); process.exit(0); }
const by = {}; items.forEach(i => (by[i.a || '담당 없음'] = by[i.a || '담당 없음'] || []).push(i));
for (const [a, list] of Object.entries(by)) {
  const txt = [`⏰ D-3 · ${D3.slice(5).replace('-', '/')} 시작`, ...list.map(i => ` · ${i.ty} ${i.t}${i.e && i.e !== D3 ? ' (~' + i.e.slice(5).replace('-', '/') + ')' : ''}${i.memo ? '\n   메모: ' + i.memo.slice(0, 80) : ''}`), '', '준비 체크: 가격 세팅 · 1인 구매제한 · 재고 · 링크/소재 전달'].join('\n');
  console.log('--- ' + a + (MEMBER_EMAIL[a] ? '' : ' (메일 없음 → 채널)') + '\n' + txt + '\n');
  if (SEND) { if (MEMBER_EMAIL[a]) await sendToUser(MEMBER_EMAIL[a], `${a}님,\n` + txt); else await sendToChannel(`[${a}] ` + txt); }
}
