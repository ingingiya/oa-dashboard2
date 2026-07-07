// 스마트스토어 실판매 동기화 (로컬 crontab 매일 9:25)
// DISPATCHED+PAYED+PURCHASE_DECIDED 유니온 → paymentDate 집계 → channel_daily_sales 업서트
// 주의: 커머스 API는 IP 화이트리스트라 Vercel에서 실행 불가 → 로컬 전용
// 사용: node scripts/sync-smartstore.mjs [days=3]
import fs from 'fs';
import bcrypt from '/Users/kirby/oa-dashboard2/node_modules/bcryptjs/index.js';

const env = {};
for (const line of fs.readFileSync('/Users/kirby/oa-dashboard2/.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)="?([^"\n]*)"?\s*$/);
  if (m) env[m[1]] = m[2];
}
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sH = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' };
const HOST = 'https://api.commerce.naver.com';
const CID = env.NAVER_COMMERCE_CLIENT_ID;
const CSECRET = env.NAVER_COMMERCE_CLIENT_SECRET;
const DAYS = Number(process.argv[2]) || 3;
const TG_TOKEN = env.TELEGRAM_BOT_TOKEN, TG_CHAT = env.TELEGRAM_CHAT_ID;

async function getToken() {
  const ts = Date.now();
  const sign = Buffer.from(bcrypt.hashSync(`${CID}_${ts}`, CSECRET)).toString('base64');
  const r = await fetch(`${HOST}/external/v1/oauth2/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CID, timestamp: String(ts), client_secret_sign: sign, grant_type: 'client_credentials', type: 'SELF' }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`토큰 실패: ${JSON.stringify(j).slice(0, 200)}`);
  return j.access_token;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function fetchRetry(url, opts) {
  for (let a = 0; a < 8; a++) {
    const r = await fetch(url, opts);
    if (r.status !== 429) return r;
    await sleep(2000 * (a + 1));
  }
  throw new Error('429 재시도 초과');
}

let token = null;
let tokenAt = 0;
async function auth() {
  if (Date.now() - tokenAt > 40 * 60 * 1000) { token = await getToken(); tokenAt = Date.now(); }
  return { Authorization: `Bearer ${token}` };
}

async function idsForDay(dayStr, type, ids) {
  let more = null, moreFrom = null, n = 0;
  for (let i = 0; i < 40; i++) {
    const params = new URLSearchParams({
      lastChangedFrom: moreFrom || `${dayStr}T00:00:00.000+09:00`,
      lastChangedTo: `${dayStr}T23:59:59.999+09:00`,
      lastChangedType: type,
    });
    if (more) params.set('moreSequence', more);
    const r = await fetchRetry(`${HOST}/external/v1/pay-order/seller/product-orders/last-changed-statuses?${params}`, { headers: await auth() });
    const j = await r.json();
    if (!r.ok) throw new Error(`목록 ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
    for (const o of j.data?.lastChangeStatuses || []) { ids.add(o.productOrderId); n++; }
    more = j.data?.more?.moreSequence;
    moreFrom = j.data?.more?.moreFrom;
    if (!more) break;
    await sleep(400);
  }
  return n;
}

function cleanName(productName, productOption) {
  let name = String(productName || '').replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
  let opt = String(productOption || '')
    .replace(/^옵션선택\s*:\s*/, '').replace(/^색상\s*:\s*/, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[A-Z]\d{4,}/g, '')
    .replace(/\s+/g, ' ').trim();
  return opt ? `${name} (${opt})` : name;
}

const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
const dstr = (d) => new Date(kstNow.getTime() - d * 86400000).toISOString().split('T')[0];

async function main() {
const ids = new Set();
for (let d = 0; d <= DAYS; d++) {
  const day = dstr(d);
  const a = await idsForDay(day, 'DISPATCHED', ids);
  const b = await idsForDay(day, 'PAYED', ids);
  const c = await idsForDay(day, 'PURCHASE_DECIDED', ids);
  process.stdout.write(`${day}: DISPATCHED ${a} + PAYED ${b} + DECIDED ${c} (누적 ${ids.size})\n`);
  await sleep(400);
}

const all = [...ids];
const details = [];
for (let i = 0; i < all.length; i += 300) {
  const r = await fetchRetry(`${HOST}/external/v1/pay-order/seller/product-orders/query`, {
    method: 'POST', headers: { ...(await auth()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ productOrderIds: all.slice(i, i + 300) }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`상세 ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  details.push(...(j.data || []));
  process.stdout.write(`상세 ${Math.min(i + 300, all.length)}/${all.length}\n`);
  await sleep(400);
}

const minDate = dstr(DAYS), maxDate = dstr(1);
const rows = {};
let units = 0;
for (const o of details) {
  const p = o.productOrder || {};
  const name = cleanName(p.productName, p.productOption);
  if (!name) continue;
  const date = String(p.paymentDate || o.order?.paymentDate || '').slice(0, 10);
  if (!date || date < minDate || date > maxDate) continue;
  const k = `${name}|${date}`;
  rows[k] = rows[k] || { channel: '스마트스토어', category: '', name, date, qty: 0 };
  rows[k].qty += Number(p.quantity) || 0;
  units += Number(p.quantity) || 0;
}

const data = Object.values(rows);
console.log(`업서트: ${data.length}행 / 수량 ${units}개 / 주문 ${details.length}건`);
for (let i = 0; i < data.length; i += 500) {
  const r = await fetch(`${SUPA_URL}/rest/v1/channel_daily_sales?on_conflict=channel,name,date`, {
    method: 'POST',
    headers: { ...sH, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(data.slice(i, i + 500)),
  });
  if (!r.ok) throw new Error(`업서트 실패: ${await r.text()}`);
}
console.log('완료');
}

main().catch(async (e) => {
  console.error('스마트스토어 동기화 실패:', e.message);
  if (TG_TOKEN && TG_CHAT) {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text: `❌ 스마트스토어 실판매 동기화 실패 (로컬)\n${e.message}` }),
    }).catch(() => {});
  }
  process.exit(1);
});
