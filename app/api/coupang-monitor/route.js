export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// 쿠팡 가격·품절 모니터링: Wing API로 이미용 제품 가격/재고 스냅샷 → 전일 대비 변동 시 텔레그램
// 크론: 매일 00:30 UTC (09:30 KST)

import crypto from 'crypto';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sH = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' };

const HOST = 'https://api-gateway.coupang.com';
const ACCESS = process.env.COUPANG_ACCESS_KEY;
const SECRET = process.env.COUPANG_SECRET_KEY;
const VENDOR = process.env.COUPANG_VENDOR_ID;

const KEYWORDS = ['소닉플로우', '갈바닉', '거울', '고데기', '드라이', '에어리'];

function cpAuth(method, path, query) {
  // signed-date: yyMMdd'T'HHmmss'Z' (UTC)
  const datetime = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z').slice(2);
  const message = datetime + method + path + (query || '');
  const signature = crypto.createHmac('sha256', SECRET).update(message).digest('hex');
  return `CEA algorithm=HmacSHA256, access-key=${ACCESS}, signed-date=${datetime}, signature=${signature}`;
}

async function cpFetch(path, query) {
  const auth = cpAuth('GET', path, query);
  const r = await fetch(`${HOST}${path}${query ? `?${query}` : ''}`, {
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`쿠팡 API ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  return j;
}

async function telegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get('secret') !== process.env.ERP_SYNC_SECRET
    && req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!ACCESS || !SECRET || !VENDOR) {
    return Response.json({ error: '쿠팡 API 키 없음 (COUPANG_ACCESS_KEY 등 env 확인)' }, { status: 500 });
  }

  try {
    // 1. 판매중 상품 목록 (이미용 키워드만)
    const listPath = '/v2/providers/seller_api/apis/api/v1/marketplace/seller-products';
    const products = [];
    let nextToken = '';
    for (let page = 0; page < 10; page++) {
      const query = `vendorId=${VENDOR}&status=APPROVED&maxPerPage=100${nextToken ? `&nextToken=${nextToken}` : ''}`;
      const res = await cpFetch(listPath, query);
      for (const p of res.data || []) {
        if (KEYWORDS.some(k => String(p.sellerProductName || '').includes(k))) products.push(p);
      }
      nextToken = res.nextToken;
      if (!nextToken) break;
    }

    // 2. 상품 상세 → vendorItemId 목록 (최대 20개 상품)
    const items = []; // {vendorItemId, productName, itemName}
    for (const p of products.slice(0, 20)) {
      const detail = await cpFetch(`/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/${p.sellerProductId}`);
      for (const it of detail.data?.items || []) {
        if (it.vendorItemId) items.push({
          vendorItemId: it.vendorItemId,
          productName: p.sellerProductName,
          itemName: it.itemName || '',
        });
      }
    }

    // 3. 아이템별 가격·재고 (최대 60개)
    const kstToday = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const snap = [];
    for (const it of items.slice(0, 60)) {
      try {
        const inv = await cpFetch(`/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/${it.vendorItemId}/inventories`);
        const d = inv.data || {};
        snap.push({
          date: kstToday,
          vendor_item_id: it.vendorItemId,
          product_name: it.productName,
          item_name: it.itemName,
          sale_price: Number(d.salePrice) || 0,
          stock: Number(d.amountInStock) || 0,
          sold_out: (Number(d.amountInStock) || 0) <= 0,
          synced_at: new Date().toISOString(),
        });
      } catch (e) {
        // 개별 아이템 실패는 건너뜀
      }
    }
    if (!snap.length) throw new Error('수집된 아이템 없음 (쿠팡 API 응답 확인 필요)');

    // 4. 직전 스냅샷과 비교
    const prevRes = await fetch(
      `${SUPA_URL}/rest/v1/coupang_price_stock?select=vendor_item_id,product_name,item_name,sale_price,sold_out,date&date=lt.${kstToday}&order=date.desc&limit=1000`,
      { headers: sH, cache: 'no-store' }
    );
    const prevAll = prevRes.ok ? await prevRes.json() : [];
    const prev = {}; // vendor_item_id -> 최신 이전 스냅샷
    for (const r of prevAll) if (!prev[r.vendor_item_id]) prev[r.vendor_item_id] = r;

    const changes = [];
    for (const s of snap) {
      const p = prev[s.vendor_item_id];
      if (!p) continue;
      const label = `${s.product_name}${s.item_name ? ` (${s.item_name})` : ''}`.slice(0, 50);
      if (!p.sold_out && s.sold_out) changes.push(`🔴 품절: ${label}`);
      else if (p.sold_out && !s.sold_out) changes.push(`🟢 재입고: ${label}`);
      if (Number(p.sale_price) > 0 && s.sale_price > 0 && Number(p.sale_price) !== s.sale_price) {
        const diff = s.sale_price - Number(p.sale_price);
        changes.push(`💰 가격 변동: ${label} ${Number(p.sale_price).toLocaleString()}→${s.sale_price.toLocaleString()}원 (${diff > 0 ? '+' : ''}${diff.toLocaleString()})`);
      }
    }
    if (changes.length) {
      await telegram(`🛒 쿠팡 가격·품절 변동 (${kstToday})\n\n${changes.slice(0, 20).join('\n')}`);
    }

    // 5. 오늘 스냅샷 업서트
    for (let i = 0; i < snap.length; i += 200) {
      const r = await fetch(`${SUPA_URL}/rest/v1/coupang_price_stock?on_conflict=date,vendor_item_id`, {
        method: 'POST',
        headers: { ...sH, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(snap.slice(i, i + 200)),
      });
      if (!r.ok) throw new Error(`업서트 실패: ${await r.text()}`);
    }

    return Response.json({ ok: true, products: products.length, items: snap.length, changes: changes.length });
  } catch (e) {
    await telegram(`❌ 쿠팡 가격·품절 모니터링 실패\n${e.message}`).catch(() => {});
    return Response.json({ error: e.message }, { status: 500 });
  }
}
