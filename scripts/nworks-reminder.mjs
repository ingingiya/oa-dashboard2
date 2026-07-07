// 오후 리마인드 → 네이버웍스 (크론: 매일 16:00)
// 1) 오늘 가설 중 담당 미지정 남아있으면 그룹방 리마인드
// 2) 마감 오늘/내일인데 미실행이면 담당자에게 1:1 알림
// 보낼 게 없으면 침묵. 테스트: node nworks-reminder.mjs --dry-run
import { kst, supa, sendToChannel, sendToUser, telegram, MEMBER_EMAIL } from './nworks-lib.mjs';

async function main() {
  const today = kst(0);
  const dry = process.argv.includes('--dry-run');
  const tomorrow = new Date(Date.now() + 9 * 3600000 + 86400000).toISOString().slice(0, 10);

  // 1) 오늘 가설 담당 미지정
  const todays = await supa(`daily_hypotheses?date=eq.${today}&select=id,type,product,assignee&order=id.asc`);
  const unassigned = todays.filter((h) => !h.assignee);
  if (unassigned.length) {
    const lines = [
      `⏰ 담당자 없는 가설 ${unassigned.length}건!`,
      ``,
      ...unassigned.map((h) => `· ${h.product}\n   ㄴ ${h.type}`),
      ``, `👉 oa-dashboard2.vercel.app`,
    ];
    if (dry) console.log('[dry-run] 그룹방:\n' + lines.join('\n'));
    else await sendToChannel(lines.join('\n'));
  }

  // 2) 마감 임박 1:1
  const due = await supa(`daily_hypotheses?status=eq.open&executed=eq.false&due_date=lte.${tomorrow}&assignee=neq.&select=id,type,product,assignee,due_date`);
  const byMember = {};
  for (const h of due) {
    if (!MEMBER_EMAIL[h.assignee]) continue;
    (byMember[h.assignee] = byMember[h.assignee] || []).push(h);
  }
  for (const [name, items] of Object.entries(byMember)) {
    const lines = [
      `⏰ ${name}님, 마감 임박 가설 ${items.length}건`,
      ``,
      ...items.map((h) => `· ${h.product}\n   ㄴ ${h.type} · 마감 ${h.due_date === today ? '오늘❗' : '내일'}`),
      ``, `실행하셨으면 대시보드에서 실행일 입력!`, `👉 oa-dashboard2.vercel.app`,
    ];
    if (dry) console.log(`[dry-run] 1:1 → ${name}:\n` + lines.join('\n'));
    else await sendToUser(MEMBER_EMAIL[name], lines.join('\n'));
  }

  if (!unassigned.length && !Object.keys(byMember).length) console.log('리마인드 대상 없음');
  else if (!dry) console.log(`발송: 미지정 ${unassigned.length}건${Object.keys(byMember).length ? `, 1:1 ${Object.keys(byMember).join(',')}` : ''}`);
}

main().catch(async (e) => {
  console.error('실패:', e.message);
  await telegram(`❌ 웍스 리마인드 실패\n${e.message.slice(0, 300)}`);
  process.exit(1);
});
