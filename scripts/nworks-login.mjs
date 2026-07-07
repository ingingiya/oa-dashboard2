// 네이버웍스 사용자 OAuth 1회 로그인 → refresh token 저장 (~/.naverworks/token.json)
// 사전조건: Developer Console 앱의 Redirect URL에 http://localhost:3210/callback 등록
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { createServer } from 'http';
import { homedir } from 'os';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '../.env.local');
const env = {};
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const CID = env.NAVER_WORKS_CLIENT_ID;
const CSECRET = env.NAVER_WORKS_CLIENT_SECRET;
const REDIRECT = 'http://localhost:3210/callback';
const TOKEN_PATH = resolve(homedir(), '.naverworks/token.json');

const authUrl = 'https://auth.worksmobile.com/oauth2/v2.0/authorize?' + new URLSearchParams({
  client_id: CID, redirect_uri: REDIRECT, scope: 'mail.read',
  response_type: 'code', state: 'oa' + Date.now(),
});

const server = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost:3210');
  if (u.pathname !== '/callback') { res.writeHead(404).end(); return; }
  const code = u.searchParams.get('code');
  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('code 없음: ' + u.search);
    return;
  }
  try {
    const r = await fetch('https://auth.worksmobile.com/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code', code,
        client_id: CID, client_secret: CSECRET,
      }),
    });
    const j = await r.json();
    if (!j.access_token) throw new Error(JSON.stringify(j));
    mkdirSync(dirname(TOKEN_PATH), { recursive: true });
    writeFileSync(TOKEN_PATH, JSON.stringify({
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      obtained_at: Date.now(),
      expires_in: j.expires_in,
    }, null, 2), { mode: 0o600 });
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('✅ 로그인 완료! 이 창은 닫아도 됩니다.');
    console.log('토큰 저장 완료:', TOKEN_PATH);
    setTimeout(() => process.exit(0), 500);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('토큰 교환 실패: ' + e.message);
    console.error('실패:', e.message);
  }
});

server.listen(3210, () => {
  console.log('아래 URL을 브라우저에서 열어 네이버웍스 계정으로 로그인하세요:\n');
  console.log(authUrl + '\n');
});
