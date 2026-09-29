// 네이버웍스 스크립트 공용: env, 날짜, Supabase, 봇 발송, 텔레그램 실패알림
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getToken } from './nworks-auth.mjs';

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '../.env.local');
export const env = {};
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const sH = { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` };
export const BOT = env.NAVER_WORKS_BOT_ID;
export const CHANNEL = env.NAVER_WORKS_CHANNEL_ID;

// 팀원 이름 → 웍스 계정
export const MEMBER_EMAIL = {
  지원: 'jwsong@oa-world.com',
  경은: 'kkeim@oa-world.com',
  혜영: 'hyyoon@oa-world.com',
  소리: 'srahn@oa-world.com',
  영서: 'bread22@oa-world.com',
  // 혜영(윤혜영) hyyoon@oa-world.com — 09-21 지수→혜영 담당자 교체 (메모리 project_pkg_automation_test 기준)
};

export const kst = (offsetDays = 0) =>
  new Date(Date.now() + 9 * 3600000 - offsetDays * 86400000).toISOString().slice(0, 10);
export const fmtW = (n) => n >= 10000 ? `${Math.round(n / 10000).toLocaleString()}만원` : `${Math.round(n).toLocaleString()}원`;

export async function supa(path) {
  const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, { headers: sH });
  if (!r.ok) throw new Error(`supabase ${path} ${r.status}`);
  return r.json();
}

async function botSend(path, text) {
  const token = await getToken('bot.message');
  const r = await fetch(`https://www.worksapis.com/v1.0/bots/${BOT}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: { type: 'text', text } }),
  });
  if (!r.ok) throw new Error(`웍스 발송 ${path} ${r.status}: ${(await r.text()).slice(0, 200)}`);
}
export const sendToChannel = (text) => botSend(`/channels/${CHANNEL}/messages`, text);
export const sendToUser = (email, text) => botSend(`/users/${email}/messages`, text);

export async function sendImageToUser(email, url) {
  const token = await getToken('bot.message');
  const r = await fetch(`https://www.worksapis.com/v1.0/bots/${BOT}/users/${email}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: { type: 'image', previewImageUrl: url, resourceUrl: url } }),
  });
  if (!r.ok) throw new Error(`웍스 이미지 발송(user) ${r.status}: ${(await r.text()).slice(0, 200)}`);
}
// PNG/PDF 원본 파일 그대로 전송 (이미지 메시지는 웍스가 리사이즈해 긴 표가 깨짐 → 파일로)
export async function sendFileToUser(email, localPath, fileName) {
  const token = await getToken('bot.message');
  const { readFileSync } = await import('fs');
  const buf = readFileSync(localPath); const name = fileName || localPath.split('/').pop();
  const a = await fetch(`https://www.worksapis.com/v1.0/bots/${BOT}/attachments`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: name }) });
  if (!a.ok) throw new Error(`웍스 첨부 생성 ${a.status}: ${(await a.text()).slice(0, 200)}`);
  const { fileId, uploadUrl } = await a.json();
  const fd = new FormData(); fd.append('Filedata', new Blob([buf], { type: name.endsWith('.png') ? 'image/png' : 'application/octet-stream' }), name);
  const u = await fetch(uploadUrl, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
  if (!u.ok) throw new Error(`웍스 파일 업로드 ${u.status}: ${(await u.text()).slice(0, 200)}`);
  const r = await fetch(`https://www.worksapis.com/v1.0/bots/${BOT}/users/${email}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ content: { type: 'file', fileId } }) });
  if (!r.ok) throw new Error(`웍스 파일 발송(user) ${r.status}: ${(await r.text()).slice(0, 200)}`);
}
export async function sendImageToChannel(url) {
  const token = await getToken('bot.message');
  const r = await fetch(`https://www.worksapis.com/v1.0/bots/${BOT}/channels/${CHANNEL}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: { type: 'image', previewImageUrl: url, resourceUrl: url } }),
  });
  if (!r.ok) throw new Error(`웍스 이미지 발송 ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

export async function telegram(msg) {
  try {
    const tg = {};
    for (const line of readFileSync(resolve(homedir(), '.claude/channels/telegram/.env'), 'utf8').split('\n')) {
      const i = line.indexOf('=');
      if (i > 0) tg[line.slice(0, i)] = line.slice(i + 1).trim().replace(/^"|"$/g, '');
    }
    if (!tg.TELEGRAM_BOT_TOKEN) return;
    await fetch(`https://api.telegram.org/bot${tg.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: '8704535307', text: msg }),
    });
  } catch {}
}
