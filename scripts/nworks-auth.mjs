// 네이버웍스 Service Account JWT 인증 → access token 발급
import { readFileSync } from 'fs';
import { createSign } from 'crypto';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// .env.local 직접 파싱 (dotenv-expand의 $ 변형 방지)
const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '../.env.local');
const env = {};
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
}

const CID = env.NAVER_WORKS_CLIENT_ID;
const CSECRET = env.NAVER_WORKS_CLIENT_SECRET;
const SA = env.NAVER_WORKS_SERVICE_ACCOUNT;
const KEY = readFileSync(env.NAVER_WORKS_PRIVATE_KEY_PATH, 'utf8');

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

export async function getToken(scope = 'mail mail.read') {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url({ alg: 'RS256', typ: 'JWT' });
  const payload = b64url({ iss: CID, sub: SA, iat: now, exp: now + 3600 });
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  const sig = signer.sign(KEY).toString('base64url');
  const assertion = `${header}.${payload}.${sig}`;

  const r = await fetch('https://auth.worksmobile.com/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      assertion,
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      client_id: CID,
      client_secret: CSECRET,
      scope,
    }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`토큰 실패 ${r.status}: ${JSON.stringify(j)}`);
  return j.access_token;
}

// 직접 실행 시 테스트
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const scope = process.argv[2] || 'mail mail.read';
  getToken(scope)
    .then((t) => console.log('OK, token:', t.slice(0, 20) + '...'))
    .catch((e) => { console.error(e.message); process.exit(1); });
}
