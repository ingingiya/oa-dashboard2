// 런칭 자동화 공용 라이브러리
// - env 로더 (.env.local)
// - oa_launch_v1 상태 read-modify-write (getLaunches / patchStage)
// - 텔레그램 알림
// - 커머스 API OAuth (bcrypt 서명) / 검색광고 API HMAC 서명 (모든 메서드)
import fs from 'fs';
import crypto from 'crypto';
import { homedir } from 'os';
import { resolve } from 'path';
import bcrypt from '/Users/kirby/oa-dashboard2/node_modules/bcryptjs/index.js';

export const ROOT = '/Users/kirby/oa-dashboard2';

export const env = {};
for (const line of fs.readFileSync(`${ROOT}/.env.local`, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)="?([^"\n]*)"?\s*$/);
  if (m) env[m[1]] = m[2];
}

const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sH = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' };

export const LAUNCH_KEY = 'oa_launch_v1';
export const STAGES = ['creative', 'detail', 'store', 'ads', 'seeding'];
export const STATUSES = ['대기', '진행', '완료', '차단'];

// ── Supabase settings key/value ──
export async function getSetting(key) {
  const r = await fetch(`${SUPA_URL}/rest/v1/settings?key=eq.${key}&select=value`, { headers: sH });
  if (!r.ok) throw new Error(`settings 조회 ${key} ${r.status}`);
  const rows = await r.json();
  return rows[0]?.value ?? null;
}

export async function setSetting(key, value) {
  const r = await fetch(`${SUPA_URL}/rest/v1/settings?on_conflict=key`, {
    method: 'POST',
    headers: { ...sH, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ key, value }),
  });
  if (!r.ok) throw new Error(`settings 저장 ${key} ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

// ── 런칭 상태 ──
export async function getLaunches() {
  const v = await getSetting(LAUNCH_KEY);
  return v?.launches ?? [];
}

export function findLaunch(launches, idOrName) {
  const q = String(idOrName).trim();
  return launches.find(l => l.id === q)
    || launches.find(l => l.name === q)
    || launches.find(l => (l.name || '').includes(q));
}

// 단계 상태 패치 — 쓰기 직전 재fetch (read-modify-write)
// patch: { status?, checklist?: {key:bool 병합}, artifacts?: [추가할 항목], set?: {productNo 등 최상위 필드 병합} }
export async function patchStage(idOrName, stage, patch = {}) {
  if (!STAGES.includes(stage)) throw new Error(`알 수 없는 단계: ${stage}`);
  const cur = (await getSetting(LAUNCH_KEY)) || { launches: [] };
  const launches = cur.launches || [];
  const launch = findLaunch(launches, idOrName);
  if (!launch) throw new Error(`런칭 없음: ${idOrName}`);
  const st = launch.stages?.[stage];
  if (!st) throw new Error(`런칭 "${launch.name}"에 ${stage} 단계 없음`);

  if (patch.status) {
    if (!STATUSES.includes(patch.status)) throw new Error(`잘못된 status: ${patch.status}`);
    st.status = patch.status;
  }
  if (patch.checklist) Object.assign(st.checklist = st.checklist || {}, patch.checklist);
  if (patch.artifacts?.length) {
    st.artifacts = st.artifacts || [];
    for (const a of patch.artifacts) {
      if (!st.artifacts.some(x => x.url === a.url)) st.artifacts.push(a);
    }
  }
  if (patch.set) Object.assign(st, patch.set);

  await setSetting(LAUNCH_KEY, { launches, updated: new Date().toISOString() });
  return launch;
}

// ── 텔레그램 알림 (nworks-lib 패턴) ──
export async function telegram(msg) {
  try {
    const tg = {};
    for (const line of fs.readFileSync(resolve(homedir(), '.claude/channels/telegram/.env'), 'utf8').split('\n')) {
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

// ── 네이버 커머스 API OAuth (IP 화이트리스트 — 로컬 전용) ──
export const COMMERCE_HOST = 'https://api.commerce.naver.com';
let _cToken = null, _cTokenAt = 0;
export async function commerceToken() {
  if (_cToken && Date.now() - _cTokenAt < 40 * 60 * 1000) return _cToken;
  const CID = env.NAVER_COMMERCE_CLIENT_ID, CSECRET = env.NAVER_COMMERCE_CLIENT_SECRET;
  const ts = Date.now();
  const sign = Buffer.from(bcrypt.hashSync(`${CID}_${ts}`, CSECRET)).toString('base64');
  const r = await fetch(`${COMMERCE_HOST}/external/v1/oauth2/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CID, timestamp: String(ts), client_secret_sign: sign, grant_type: 'client_credentials', type: 'SELF' }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`커머스 토큰 실패: ${JSON.stringify(j).slice(0, 200)}`);
  _cToken = j.access_token; _cTokenAt = Date.now();
  return _cToken;
}

// ── 네이버 검색광고 API HMAC 서명 (GET/POST/PUT/DELETE 공통) ──
export const SEARCHAD_HOST = 'https://api.naver.com';
export function searchAdHeaders(method, path) {
  const ts = Date.now().toString();
  return {
    'X-API-KEY': env.NAVER_API_KEY,
    'X-Customer': env.NAVER_CUSTOMER_ID,
    'X-Timestamp': ts,
    'X-Signature': crypto.createHmac('sha256', env.NAVER_SECRET_KEY)
      .update(`${ts}.${method.toUpperCase()}.${path}`).digest('base64'),
    'Content-Type': 'application/json',
  };
}

export async function searchAdFetch(method, path, { query, body } = {}) {
  const qs = query ? `?${new URLSearchParams(query)}` : '';
  const r = await fetch(`${SEARCHAD_HOST}${path}${qs}`, {
    method, headers: searchAdHeaders(method, path),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  if (!r.ok) throw new Error(`searchad ${method} ${path} ${r.status}: ${text.slice(0, 500)}`);
  return json;
}
