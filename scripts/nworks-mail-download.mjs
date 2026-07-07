// 네이버웍스 메일에서 일일판매량 엑셀 첨부 자동 다운로드 → ~/Downloads
// 사전조건: scripts/nworks-login.mjs로 1회 로그인 (refresh token 저장)
// 크론: 매일 8:50 (9:00 sync-channel-daily.py 전)
import { readFileSync, writeFileSync, createWriteStream } from 'fs';
import { homedir } from 'os';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '../.env.local');
const env = {};
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const CID = env.NAVER_WORKS_CLIENT_ID;
const CSECRET = env.NAVER_WORKS_CLIENT_SECRET;
const TOKEN_PATH = resolve(homedir(), '.naverworks/token.json');
const API = 'https://www.worksapis.com/v1.0';
const DOWNLOADS = resolve(homedir(), 'Downloads');

// 다운로드 대상 첨부파일명 패턴
const TARGETS = [/쿠팡.*일일판매량/, /지그재그.*일일판매량/];

async function getAccessToken() {
  const saved = JSON.parse(readFileSync(TOKEN_PATH, 'utf8'));
  // access token 유효시간 내(발급 후 20시간 이내)면 재사용 대신 항상 refresh (하루 1회 실행이라 단순화)
  const r = await fetch('https://auth.worksmobile.com/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token', refresh_token: saved.refresh_token,
      client_id: CID, client_secret: CSECRET,
    }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`토큰 갱신 실패: ${JSON.stringify(j).slice(0, 200)} — nworks-login.mjs로 재로그인 필요`);
  // 새 refresh token이 오면 갱신 저장 (90일 연장)
  writeFileSync(TOKEN_PATH, JSON.stringify({
    access_token: j.access_token,
    refresh_token: j.refresh_token || saved.refresh_token,
    obtained_at: Date.now(),
    expires_in: j.expires_in,
  }, null, 2), { mode: 0o600 });
  return j.access_token;
}

async function api(token, path, opts = {}) {
  const r = await fetch(`${API}${path}`, {
    ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  if (!r.ok) throw new Error(`${path} ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r;
}

async function telegram(msg) {
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

async function main() {
  const token = await getAccessToken();

  // 받은메일함 폴더 ID
  const folders = await (await api(token, '/users/me/mail/mailfolders')).json();
  const list = folders.mailFolders || folders.folders || [];
  const inbox = list.find((f) => f.folderType === 'INBOX' || f.folderName === '받은메일함') || list[0];
  if (!inbox) throw new Error(`받은메일함 못 찾음: ${JSON.stringify(folders).slice(0, 300)}`);
  const folderId = inbox.folderId ?? inbox.id;

  // 최근 메일 목록 (최신순)
  const mails = await (await api(token, `/users/me/mail/mailfolders/${folderId}/mails?count=30`)).json();
  const items = mails.mails || mails.mailList || [];
  if (!items.length) throw new Error(`메일 목록 비어있음: ${JSON.stringify(mails).slice(0, 300)}`);

  const saved = [];
  const cutoff = Date.now() - 2 * 86400000; // 최근 2일치만
  for (const m of items) {
    const t = new Date(m.receivedTime || m.receivedDate || 0).getTime();
    if (t && t < cutoff) continue;
    const mailId = m.mailId ?? m.id;
    // 첨부 여부 힌트 없어도 상세 조회로 확인
    const detail = await (await api(token, `/users/me/mail/${mailId}`)).json();
    const atts = detail.attachments || detail.attachmentList || [];
    for (const a of atts) {
      const fname = a.fileName || a.name || '';
      if (!TARGETS.some((re) => re.test(fname))) continue;
      const attId = a.attachmentId ?? a.id;
      const dl = await api(token, `/users/me/mail/attachments/${attId}?mailId=${mailId}`);
      const safe = basename(fname);
      const dest = resolve(DOWNLOADS, safe);
      await pipeline(Readable.fromWeb(dl.body), createWriteStream(dest));
      saved.push(safe);
      console.log('저장:', dest);
    }
  }

  if (!saved.length) {
    console.log('대상 첨부파일 없음 (최근 2일)');
    await telegram('⚠️ 웍스 메일: 일일판매량 엑셀 첨부를 못 찾음 (최근 2일)');
  } else {
    console.log(`완료: ${saved.length}개 저장`);
  }
}

main().catch(async (e) => {
  console.error('실패:', e.message);
  await telegram(`❌ 웍스 메일 다운로드 실패\n${e.message.slice(0, 300)}`);
  process.exit(1);
});
