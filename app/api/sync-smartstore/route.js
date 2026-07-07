export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// 스마트스토어 실판매 동기화: 네이버 커머스 API 결제 주문 → channel_daily_sales 업서트
// 주의: 커머스 API IP 화이트리스트 때문에 Vercel에서는 GW.IP_NOT_ALLOWED로 실패 —
// 실제 동기화는 로컬 crontab(scripts/sync-smartstore.mjs, 매일 9:25)이 담당. 이 라우트는 허용 IP에서의 수동 실행용.

import bcrypt from 'bcryptjs';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sH = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' };

const HOST = 'https://api.commerce.naver.com';
const CID = process.env.NAVER_COMMERCE_CLIENT_ID;
const CSECRET = process.env.NAVER_COMMERCE_CLIENT_SECRET;

async function getToken() {
  const ts = Date.now();
  const sign = Buffer.from(bcrypt.hashSync(`${CID}_${ts}`, CSECRET)).toString('base64');
  const r = await fetch(`${HOST}/external/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CID, timestamp: String(ts), client_secret_sign: sign,
      grant_type: 'client_credentials', type: 'SELF',
    }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`커머스 토큰 실패: ${JSON.stringify(j).slice(0, 200)}`);
  return j.access_token;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchRetry(url, opts) {
  for (let a = 0; a < 6; a++) {
    const r = await fetch(url, opts);
    if (r.status !== 429) return r;
    await sleep(2000 * (a + 1));
  }
  throw new Error('429 재시도 초과');
}

// 하루치 상태변경 상품주문 ID (24시간 윈도우 + moreFrom/moreSequence 페이지네이션)
// 주의: lastChangedType은 "마지막" 변경 기준이라 PAYED만으로는 당일 발송처리된 주문이 빠짐
// → DISPATCHED + PAYED 유니온으로 수집 후 상세의 paymentDate로 집계
async function idsForDay(token, dayStr, type, ids) {
  let more = null, moreFrom = null;
  for (let i = 0; i < 40; i++) {
    const params = new URLSearchParams({
      lastChangedFrom: moreFrom || `${dayStr}T00:00:00.000+09:00`,
      lastChangedTo: `${dayStr}T23:59:59.999+09:00`,
      lastChangedType: type,
    });
    if (more) params.set('moreSequence', more);
    const r = await fetchRetry(`${HOST}/external/v1/pay-order/seller/product-orders/last-changed-statuses?${params}`, {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
    });
    const j = await r.json();
    if (!r.ok) throw new Error(`주문 목록 ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
    for (const o of j.data?.lastChangeStatuses || []) ids.add(o.productOrderId);
    more = j.data?.more?.moreSequence;
    moreFrom = j.data?.more?.moreFrom;
    if (!more) break;
    await sleep(300);
  }
}

// 상품주문 상세 (300개씩)
async function orderDetails(token, ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 300) {
    const r = await fetchRetry(`${HOST}/external/v1/pay-order/seller/product-orders/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ productOrderIds: ids.slice(i, i + 300) }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(`주문 상세 ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
    out.push(...(j.data || []));
    await sleep(300);
  }
  return out;
}

// 상품명 정리: [증정문구] 제거 + 옵션에서 코드 제거한 색상만 추출
function cleanName(productName, productOption) {
  let name = String(productName || '').replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
  let opt = String(productOption || '')
    .replace(/^옵션선택\s*:\s*/, '').replace(/^색상\s*:\s*/, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[A-Z]\d{4,}/g, '') // 모델코드 제거
    .replace(/\s+/g, ' ').trim();
  return opt ? `${name} (${opt})` : name;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get('secret') !== process.env.ERP_SYNC_SECRET
    && req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!CID || !CSECRET) {
    return Response.json({ error: '커머스 API 키 없음 (NAVER_COMMERCE_CLIENT_ID/SECRET)' }, { status: 500 });
  }
  const days = Math.min(Number(searchParams.get('days')) || 3, 35);

  try {
    const token = await getToken();
    const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
    const dstr = (d) => new Date(kstNow.getTime() - d * 86400000).toISOString().split('T')[0];

    // 오늘(d=0)까지 포함해 수집: 어제 결제분이 오늘 발송처리(DISPATCHED)로 잡히기 때문
    const ids = new Set();
    for (let d = 0; d <= days; d++) {
      const day = dstr(d);
      await idsForDay(token, day, 'DISPATCHED', ids);
      await idsForDay(token, day, 'PAYED', ids);
      // 구매확정되면 마지막 변경이 PURCHASE_DECIDED로 바뀌어 위 두 조회에서 사라짐 → 함께 수집
      await idsForDay(token, day, 'PURCHASE_DECIDED', ids);
      await sleep(300);
    }

    const details = await orderDetails(token, [...ids]);
    const orders = details.length;

    // paymentDate 기준 집계, 대상 기간(어제~days일 전)만 업서트
    const minDate = dstr(days), maxDate = dstr(1);
    const rows = {}; // name|date -> row
    for (const o of details) {
      const p = o.productOrder || {};
      const name = cleanName(p.productName, p.productOption);
      if (!name) continue;
      const date = String(p.paymentDate || o.order?.paymentDate || '').slice(0, 10);
      if (!date || date < minDate || date > maxDate) continue;
      const k = `${name}|${date}`;
      rows[k] = rows[k] || { channel: '스마트스토어', category: '', name, date, qty: 0 };
      rows[k].qty += Number(p.quantity) || 0;
    }

    const data = Object.values(rows);
    for (let i = 0; i < data.length; i += 500) {
      const r = await fetch(`${SUPA_URL}/rest/v1/channel_daily_sales?on_conflict=channel,name,date`, {
        method: 'POST',
        headers: { ...sH, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(data.slice(i, i + 500)),
      });
      if (!r.ok) throw new Error(`업서트 실패: ${await r.text()}`);
    }

    return Response.json({ ok: true, days, orders, rows: data.length });
  } catch (e) {
    // 실패 시 텔레그램 알림
    const token = process.env.TELEGRAM_BOT_TOKEN, chatId = process.env.TELEGRAM_CHAT_ID;
    if (token && chatId) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: `❌ 스마트스토어 실판매 동기화 실패\n${e.message}` }),
      }).catch(() => {});
    }
    return Response.json({ error: e.message }, { status: 500 });
  }
}
