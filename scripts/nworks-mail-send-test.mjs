import { getToken } from './nworks-auth.mjs';
const token = await getToken('mail');
const to = process.argv[2] || 'kkeim@oa-world.com';
for (const [path, body] of [
  ['/users/me/mail', { to: [{ email: to }], subject: '[테스트] 광고 문의 자동발송 점검', body: '자동 발송 테스트입니다. 무시하셔도 됩니다.', contentType: 'text' }],
  ['/users/me/mail/send', { to: [{ email: to }], subject: '[테스트] 광고 문의 자동발송 점검', body: '자동 발송 테스트입니다.', contentType: 'text' }],
]) {
  const r = await fetch('https://www.worksapis.com/v1.0' + path, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  console.log(path, r.status, (await r.text()).slice(0, 300));
  if (r.ok) break;
}
