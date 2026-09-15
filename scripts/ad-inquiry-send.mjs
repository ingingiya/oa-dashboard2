// 광고 매체 문의 메일 자동 발송기 — settings.oa_ad_inquiries_v1 의 pending 을 10분마다 발송
// 발송 경로: (1) 네이버웍스 API (scope 'mail' 필요) → (2) SMTP(.env.local MAIL_SMTP_HOST/PORT/USER/PASS, MAIL_FROM) 순으로 시도
import { env } from './nworks-lib.mjs';
import { getToken } from './nworks-auth.mjs';
import { createTransport } from 'nodemailer';
const KEY = 'oa_ad_inquiries_v1';
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/settings?key=eq.${KEY}&select=value`, { headers: H });
const rows = await r.json(); const items = rows[0]?.value?.items || [];
const pending = items.filter((i) => i.status === 'pending');
if (!pending.length) { console.log('pending 0'); process.exit(0); }
const DRY = process.argv.includes('--dry');
async function sendWorks(m) {
  const token = await getToken('mail');
  const res = await fetch('https://www.worksapis.com/v1.0/users/me/mail', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ to: [{ email: m.to_email }], cc: m.cc_email ? m.cc_email.split(',').map((e) => ({ email: e.trim() })) : [], subject: m.subject, body: m.body, contentType: 'text' }) });
  if (!res.ok) throw new Error('works ' + res.status + ' ' + (await res.text()).slice(0, 150));
}
async function sendSmtp(m) {
  if (!env.MAIL_SMTP_HOST) throw new Error('SMTP 미설정');
  const t = createTransport({ host: env.MAIL_SMTP_HOST, port: +(env.MAIL_SMTP_PORT || 465), secure: (env.MAIL_SMTP_PORT || '465') === '465', auth: { user: env.MAIL_SMTP_USER, pass: env.MAIL_SMTP_PASS } });
  await t.sendMail({ from: `"${m.sender_name || '오아 마케팅팀'}" <${env.MAIL_FROM || env.MAIL_SMTP_USER}>`, to: m.to_email, cc: m.cc_email || undefined, replyTo: m.sender_email || undefined, subject: m.subject, text: m.body });
}
let sent = 0;
for (const m of pending) {
  if (DRY) { console.log('DRY', m.id, m.to_email, m.subject); continue; }
  try {
    try { await sendWorks(m); m.via = 'works'; } catch (e1) { await sendSmtp(m); m.via = 'smtp'; }
    m.status = 'sent'; m.sent_at = new Date().toISOString(); m.error = null; sent++; console.log('sent', m.id, m.to_email, m.via);
  } catch (e) { m.status = 'failed'; m.error = String(e.message).slice(0, 200); console.log('FAIL', m.id, m.to_email, m.error); }
  await new Promise((s) => setTimeout(s, 1500));
}
if (!DRY) await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/settings?on_conflict=key`, { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ key: KEY, value: { items, updated: new Date().toISOString() } }) });
console.log('done sent', sent, 'of', pending.length);
