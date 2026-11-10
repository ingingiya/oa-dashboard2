export const dynamic = 'force-dynamic';
export const maxDuration = 60;
// 동욱님 큐텐 마진 계산기(public/qoo10-margin) API — 원본 express(api/index.js) 이식.
// 저장소: Supabase settings 테이블 키 qm_products / qm_pricing / qm_qoo10_registered / qm_qoo10_manual_codes / qm_erp_cost / qm_erp_package / qm_erp_codes
import crypto from 'crypto';
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
async function readKey(k, fb) { const r = await fetch(`${URL_}/rest/v1/settings?key=eq.qm_${k}&select=value`, { headers: H, cache: 'no-store' }); const d = await r.json(); return d?.[0]?.value ?? fb; }
async function writeKey(k, value) { const r = await fetch(`${URL_}/rest/v1/settings`, { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ key: 'qm_' + k, value, updated_at: new Date().toISOString() }) }); if (!r.ok) throw new Error('DB 저장 실패: ' + await r.text()); }
const J = (d, s = 200) => Response.json(d, { status: s });
const CH = ['Qoo10', 'Rakuten', 'Amazon US'];
const CATS = ['계절가전', '이미용가전', '욕실가전', '건강가전', '생활가전', '주방가전', '모바일', '인테리어/조명', '미분류'];
const OPT = new Set(['categoryFeePercent', 'overseasSaleFeeApplied', 'reservationFeeApplied', 'externalAdFeeApplied', 'megaDiscountFeeApplied', 'vatApplied', 'exportDeclarationKrw', 'customsApplied', 'customsThresholdJpy', 'customsRatePercent']);
const DEF = { targetMarginPercent: 40, listingDiscountPercent: 30, advertisingPercent: 0, voucherCostLocal: 0 };
const readProducts = async () => { const d = await readKey('products', null); return { products: Array.isArray(d?.products) ? d.products : [] }; };
const readPricing = async () => { const d = await readKey('pricing', null); return { entries: Array.isArray(d?.entries) ? d.entries : [] }; };
const readItems = async (k) => { const d = await readKey(k, null); return d && typeof d.items === 'object' ? d : { items: {} }; };
async function pricingEntry(b, ex = {}) {
  const n = (v) => Math.max(0, Number.isFinite(Number(v)) ? Number(v) : 0);
  const nn = (v) => (v === undefined || v === null || v === '') ? null : n(v);
  const channel = String(b.channel || ex.channel || ''); if (!CH.includes(channel)) throw new Error('판매채널을 선택하세요.');
  const productId = String(b.productId || ex.productId || '');
  const product = (await readProducts()).products.find((x) => x.id === productId); if (!product) throw new Error('상품을 선택하세요.');
  const currency = ['KRW', 'JPY', 'USD', 'SGD', 'MYR', 'VND', 'TWD', 'THB', 'PHP', 'BRL', 'MXN'].includes(b.currency) ? b.currency : 'KRW';
  return { id: ex.id || crypto.randomUUID(), productId, productName: product.name, sku: product.sku || '', channel, currency,
    salePrice: n(b.salePrice), exchangeRate: n(b.exchangeRate) || 1, productCost: n(b.productCost), shippingCost: n(b.shippingCost),
    platformFeeRate: Math.min(100, n(b.platformFeeRate)), adCost: n(b.adCost), otherCost: n(b.otherCost), targetQuantity: Math.round(n(b.targetQuantity)),
    memo: String(b.memo || '').trim().slice(0, 300), updatedAt: new Date().toISOString(),
    actualWeightG: nn(b.actualWeightG) ?? ex.actualWeightG ?? 0, widthCm: nn(b.widthCm) ?? ex.widthCm ?? 0, lengthCm: nn(b.lengthCm) ?? ex.lengthCm ?? 0, heightCm: nn(b.heightCm) ?? ex.heightCm ?? 0,
    targetMarginPercent: nn(b.targetMarginPercent) ?? ex.targetMarginPercent ?? DEF.targetMarginPercent,
    listingDiscountPercent: nn(b.listingDiscountPercent) ?? ex.listingDiscountPercent ?? DEF.listingDiscountPercent,
    vatRefundEnabled: b.vatRefundEnabled !== undefined ? Boolean(b.vatRefundEnabled) : Boolean(ex.vatRefundEnabled),
    advertisingPercent: nn(b.advertisingPercent) ?? ex.advertisingPercent ?? DEF.advertisingPercent,
    voucherCostLocal: nn(b.voucherCostLocal) ?? ex.voucherCostLocal ?? DEF.voucherCostLocal,
    options: b.options && typeof b.options === 'object' && !Array.isArray(b.options)
      ? Object.fromEntries(Object.entries(b.options).filter(([k, v]) => OPT.has(k) && (typeof v === 'boolean' || Number.isFinite(Number(v)))).map(([k, v]) => [k, typeof v === 'boolean' ? v : Number(v)]))
      : (ex.options || {}) };
}
// 전산(MySQL 원격 MCP) v_product 실시간 조회: 구매단가(원)·패키지 크기·무게
async function mcpQuery(sql, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch('https://mcp-mysql.oa-corp.com/mcp', { method: 'POST', headers: { Authorization: `Bearer ${process.env.MCP_MYSQL_TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'run_query', arguments: { sql, limit: 30 } } }) });
      const t = await res.text(); const line = t.split('\n').find((l) => l.startsWith('data: ')); const j = JSON.parse(line ? line.slice(6) : t);
      const c = j?.result?.content?.[0]?.text; if (j?.result?.isError) throw new Error(c); return JSON.parse(c).rows || [];
    } catch (e) { if (i >= tries) throw e; await new Promise((r) => setTimeout(r, 2000 * i)); }
  }
}
async function erpLive(q, codes, pkg) {
  const k = String(q || '').replace(/['"\\%_;]/g, '').trim().slice(0, 40); if (!k) return [];
  // 원가 = 월별 재고 원가(v_purchase_stock_cost_monthly) 제품별 최신 연월의 적용단가, 0이면 v_product 구매단가(원)
  const rows = await mcpQuery(`SELECT p.\`제품ID\` AS pid, p.\`제품명\` AS nm, p.\`제품코드\` AS code, p.\`제품유형\` AS typ, p.\`판매상태\` AS st, p.\`구매단가(원)\` AS buy,
    p.\`패키지가로\` AS w, p.\`패키지세로\` AS l, p.\`패키지높이\` AS h, p.\`무게\` AS kg,
    (SELECT c.\`적용단가\` FROM v_purchase_stock_cost_monthly c WHERE c.\`제품ID\`=p.\`제품ID\` ORDER BY c.\`연월\` DESC LIMIT 1) AS cost,
    (SELECT c.\`연월\` FROM v_purchase_stock_cost_monthly c WHERE c.\`제품ID\`=p.\`제품ID\` ORDER BY c.\`연월\` DESC LIMIT 1) AS ym
    FROM v_product p WHERE (p.\`제품명\` LIKE '%${k}%' OR p.\`제품코드\` LIKE '%${k}%') AND p.\`브랜드\`='오아'
    ORDER BY (p.\`판매상태\`='단종'), (p.\`제품유형\`<>'본품'), p.\`제품명\` LIMIT 20`);
  const f = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
  const pm = new Map((pkg?.rows || []).map((r) => [r.productCode, r]));
  const cm = new Map(String(codes?.map || '').split(',').filter(Boolean).map((x) => x.split(':')));
  return rows.map((r) => { const sp = pm.get(r.code) || {}; const cost = f(r.cost) || f(r.buy) || 0; return {
    productId: r.pid, name: r.nm, productCode: r.code, productType: r.typ, status: r.st, cost: Math.round(cost), yearMonth: f(r.cost) ? r.ym : '구매단가',
    merchandiseCode: cm.get(String(r.pid)) || null,
    weightKg: f(r.kg) ?? sp.weightKg ?? null, widthCm: f(r.w) ?? sp.widthCm ?? null, lengthCm: f(r.l) ?? sp.lengthCm ?? null, heightCm: f(r.h) ?? sp.heightCm ?? null,
    packageSuspect: !!sp.suspect }; });
}
async function erpSearch(q) {
  const needle = String(q || '').trim().toLowerCase(); if (!needle) return [];
  const [cost, pkg, codes] = await Promise.all([readKey('erp_cost', null), readKey('erp_package', null), readKey('erp_codes', null)]);
  // 전산 실시간 우선, 실패(전산 연결 끊김)하면 동욱님 스냅샷(qm_erp_cost)
  try { const live = await erpLive(q, codes, pkg); if (live.length) return live; } catch (e) { /* fall back */ }
  if (!cost || !Array.isArray(cost.rows)) throw new Error('전산 연결이 안 되고 원가 스냅샷도 없습니다.');
  const pm = new Map((pkg?.rows || []).map((r) => [r.productCode, r]));
  const cm = new Map(String(codes?.map || '').split(',').filter(Boolean).map((p) => p.split(':')));
  return cost.rows.filter((r) => r.name.toLowerCase().includes(needle))
    .sort((a, b) => (a.productType === '본품' ? 0 : 1) - (b.productType === '본품' ? 0 : 1) || a.name.localeCompare(b.name, 'ko')).slice(0, 20)
    .map((base) => { const row = { ...base, merchandiseCode: cm.get(String(base.productId)) || null }; const p = pm.get(row.productCode);
      return p ? { ...row, weightKg: p.weightKg, widthCm: p.widthCm, lengthCm: p.lengthCm, heightCm: p.heightCm, packageSuspect: p.suspect, packageDerivedFrom: p.derivedFrom || null } : row; });
}
const path = (ctx) => (ctx.params?.p || []).join('/');
export async function GET(req, ctx) {
  try {
    const p = path(ctx);
    if (p === 'products') return J(await readProducts());
    if (p === 'pricing') return J(await readPricing());
    if (p === 'qoo10-registered') return J(await readItems('qoo10_registered'));
    if (p === 'qoo10-manual-codes') return J(await readItems('qoo10_manual_codes'));
    if (p === 'qoo10-sheet-codes') return J({ items: {} });
    if (p === 'erp/products') {
      try { const cost = await readKey('erp_cost', null); return J({ products: await erpSearch(new URL(req.url).searchParams.get('q')), snapshot: { asOf: '실시간 (실패 시 ' + (cost?.asOf || '').slice(0, 10) + ' 스냅샷)', rowCount: cost?.rowCount, source: '전산 월별 재고 원가(적용단가) + 제품 패키지' } }); }
      catch (e) { return J({ error: 'ERP 원가 조회 실패: ' + e.message }, 502); }
    }
    return J({ error: 'Not found' }, 404);
  } catch (e) { return J({ error: e.message }, 500); }
}
export async function POST(req, ctx) {
  try {
    const p = path(ctx); const b = await req.json().catch(() => ({}));
    if (p === 'products') {
      const name = String(b.name || '').trim().slice(0, 120); if (!name) return J({ error: '상품명을 입력하세요.' }, 400);
      const d = await readProducts(); const product = { id: crypto.randomUUID(), name, sku: String(b.sku || '').trim().slice(0, 80), brand: String(b.brand || '').trim().slice(0, 80), category: CATS.includes(b.category) ? b.category : '미분류', certificates: [], createdAt: new Date().toISOString() };
      d.products.unshift(product); await writeKey('products', d); return J(product, 201);
    }
    if (p === 'pricing') { try { const d = await readPricing(); const e = await pricingEntry(b); d.entries.unshift(e); await writeKey('pricing', d); return J(e, 201); } catch (e) { return J({ error: e.message }, 400); } }
    if (p === 'qoo10-registered') {
      const id = String(b.productId || '').trim().slice(0, 100); if (!id) return J({ error: '상품을 확인하세요.' }, 400);
      const d = await readItems('qoo10_registered'); if (b.registered) d.items[id] = new Date().toISOString().slice(0, 10); else delete d.items[id]; await writeKey('qoo10_registered', d); return J(d);
    }
    if (p === 'qoo10-manual-codes') {
      const id = String(b.productId || '').trim().slice(0, 100), code = String(b.code || '').trim().slice(0, 40); if (!id) return J({ error: '상품을 확인하세요.' }, 400);
      const d = await readItems('qoo10_manual_codes'); if (code) d.items[id] = code; else delete d.items[id]; await writeKey('qoo10_manual_codes', d); return J(d);
    }
    if (p === 'qoo10-push-sheet') return J({ error: '이 버전에서는 구글시트 전송을 지원하지 않습니다.' }, 501);
    return J({ error: 'Not found' }, 404);
  } catch (e) { return J({ error: e.message }, 500); }
}
export async function PUT(req, ctx) {
  try {
    const [a, id] = path(ctx).split('/'); if (a !== 'pricing' || !id) return J({ error: 'Not found' }, 404);
    const b = await req.json().catch(() => ({})); const d = await readPricing(); const i = d.entries.findIndex((x) => x.id === id);
    if (i < 0) return J({ error: '가격 정보를 찾을 수 없습니다.' }, 404);
    try { d.entries[i] = await pricingEntry(b, d.entries[i]); } catch (e) { return J({ error: e.message }, 400); }
    await writeKey('pricing', d); return J(d.entries[i]);
  } catch (e) { return J({ error: e.message }, 500); }
}
export async function DELETE(req, ctx) {
  try {
    const [a, id] = path(ctx).split('/'); if (a !== 'pricing' || !id) return J({ error: 'Not found' }, 404);
    const d = await readPricing(); const before = d.entries.length; d.entries = d.entries.filter((x) => x.id !== id);
    if (d.entries.length === before) return J({ error: '가격 정보를 찾을 수 없습니다.' }, 404);
    await writeKey('pricing', d); return J({ ok: true });
  } catch (e) { return J({ error: e.message }, 500); }
}
