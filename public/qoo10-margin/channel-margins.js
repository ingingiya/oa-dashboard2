const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money = value => `${new Intl.NumberFormat('ko-KR',{maximumFractionDigits:0}).format(Number(value)||0)}원`;
const localMoney = (value,currency) => `${new Intl.NumberFormat('ko-KR',{maximumFractionDigits:2}).format(Number(value)||0)} ${currency||''}`.trim();
const localMoneyRed = (value,currency) => `<span style="color:#dc2626">${new Intl.NumberFormat('ko-KR',{maximumFractionDigits:2}).format(Number(value)||0)} ${currency||''}</span>`.trim();

// 채널별 기본값. 수수료율은 참고용 임시값이며 화면에서 상품별로 수정한다(실제 계약 수수료 기준).
const CHANNEL_DEFAULTS = {
  'Qoo10': { engine:'qoo10', currency:'JPY', exchangeRate:Qoo10MarginCalc.QOO10_MARGIN_CONFIG.exchangeRate, feeRate:10, label:'QOO10 JAPAN', note:'사내 「큐텐(Qoo10)_일본역직구_마진계산기」 기준입니다. 국제배송비는 KSE 해상 요율표에서 청구중량으로 자동 조회됩니다. 카테고리 수수료율(기본 10%)은 QSM 요율과 대조하세요.' },
  'Rakuten': { currency:'JPY', exchangeRate:9.5, feeRate:10, label:'RAKUTEN JAPAN', note:'Rakuten 수수료율 기본값 10%는 임시값입니다. 입점 플랜·카테고리에 맞게 수정하세요.' },
  'Amazon US': { currency:'USD', exchangeRate:1400, feeRate:15, label:'AMAZON US', note:'Amazon 수수료율 기본값 15%(판매수수료)는 임시값입니다. FBA 수수료는 해외 배송비 칸에 포함해서 입력하세요.' },
};
const channel = new URLSearchParams(location.search).get('channel');
const cfg = CHANNEL_DEFAULTS[channel];
if (!cfg) {
  document.querySelector('main').innerHTML = '<p style="padding:40px">지원하지 않는 채널입니다. 사이드바의 「해외 채널 운영 현황」에서 채널을 선택하세요.</p>';
  throw new Error('unknown channel');
}
const isQoo = cfg.engine === 'qoo10';
const QCFG = isQoo ? Qoo10MarginCalc.QOO10_MARGIN_CONFIG : null;
const DEFAULT_TARGET_MARGIN = isQoo ? QCFG.targetMarginPercent : 20;
$$('.qooField').forEach(el => el.classList.toggle('hidden', !isQoo));
$$('.genericField').forEach(el => el.classList.toggle('hidden', isQoo));
if (isQoo) { const heads = $$('#listPanel thead th'); heads[6].textContent = '택배·포장·수출신고'; heads[7].textContent = 'KSE 해상 배송비'; heads[8].textContent = '수수료(VAT 포함)'; heads[9].textContent = '관세·광고비'; const eh = $$('#eventPanel thead th'); eh[6].textContent = '택배·포장·수출신고'; eh[7].textContent = 'KSE 해상 배송비'; eh[8].textContent = '수수료(VAT 포함)'; eh[9].textContent = '관세·광고비·쿠폰'; }
if (!isQoo) { $('#listingHead').remove(); $('#regHead').remove(); }
else $$('#listPanel thead th[data-sort="name"]').forEach(th => th.insertAdjacentHTML('beforebegin', '<th data-sort="code">상품코드</th>'));
$$('#eventPanel thead th[data-sort="name"]').forEach(th => th.insertAdjacentHTML('beforebegin', '<th data-sort="code">상품코드</th>'));

function qooInput(entry) {
  const o = entry.options || {};
  return {
    productCostKrw: entry.productCost, actualWeightKg: (Number(entry.actualWeightG)||0)/1000,
    widthCm: entry.widthCm, lengthCm: entry.lengthCm, heightCm: entry.heightCm,
    exchangeRate: entry.exchangeRate, domesticDeliveryPackagingKrw: entry.otherCost,
    targetMarginPercent: entry.targetMarginPercent, advertisingPercent: entry.advertisingPercent,
    vatRefundEnabled: entry.vatRefundEnabled, actualSalePriceJpy: entry.salePrice,
    categoryFeePercent: o.categoryFeePercent, overseasSaleFeeApplied: o.overseasSaleFeeApplied,
    reservationFeeApplied: o.reservationFeeApplied, externalAdFeeApplied: o.externalAdFeeApplied,
    megaDiscountFeeApplied: o.megaDiscountFeeApplied, vatApplied: o.vatApplied,
    exportDeclarationKrw: o.exportDeclarationKrw, customsApplied: o.customsApplied,
    customsThresholdJpy: o.customsThresholdJpy, customsRatePercent: o.customsRatePercent,
    megaCouponApplied: o.megaCouponApplied, couponDiscountPercent: o.couponDiscountPercent, couponSellerSharePercent: o.couponSellerSharePercent,
    shopCouponJpy: o.shopCouponJpy, shopCouponMinPriceJpy: o.shopCouponMinPriceJpy,
  };
}
function calcQooRow(entry, product) {
  const r = Qoo10MarginCalc.computeQoo10Margin(qooInput(entry));
  const calculated = Number(entry.productCost) > 0 && Number(entry.salePrice) > 0 && Number(entry.actualWeightG) > 0 && r.profitKrw != null;
  return { id:entry.id, productId:product.id, name:product.name, sku:product.sku||entry.sku||'', brand:product.brand||'', currency:entry.currency, listingPriceJpy:r.listingPriceJpy, salePrice:Number(entry.salePrice)||0, revenue:calculated?r.revenueKrw:0, productCost:Number(entry.productCost)||0, packaging:(Number(entry.otherCost)||0)+(Number(entry.options?.exportDeclarationKrw)||0), shipping:calculated?r.shippingKrw:0, fee:calculated?r.feeKrw:0, ad:calculated?r.adKrw+r.customsKrw+(r.couponKrw||0):0, promoPriceJpy:calculated?r.promoPriceJpy:null, couponPriceJpy:calculated?r.couponPriceJpy:null, profit:calculated?r.profitKrw:0, margin:calculated?r.marginRate*100:0, verdict:calculated?r.verdict:null, calculated, updatedAt:entry.updatedAt||'' };
}
document.title = `${channel} 상품 마진 | Overseas Sales Hub`;
$('#pageKicker').textContent = `${cfg.label} PROFIT ANALYTICS`;
$('#pageTitle').textContent = `${channel} 상품 마진`;
$('#costKicker').textContent = channel.toUpperCase();
$('#feeNote').textContent = cfg.note;
$$('#costCurrency option').forEach(o => { o.disabled = o.value !== cfg.currency; });
$('#costCurrency').value = cfg.currency;

let products = [], pricingEntries = [], marginRows = [];

function calcRow(entry, product) {
  if (isQoo) return calcQooRow(entry, product);
  const salePrice = Number(entry.salePrice)||0, rate = Number(entry.exchangeRate)||1;
  const productCost = Number(entry.productCost)||0, shipping = Number(entry.shippingCost)||0;
  const packaging = Number(entry.otherCost)||0, ad = Number(entry.adCost)||0;
  const feeRate = Number(entry.platformFeeRate)||0;
  const target = entry.targetMarginPercent != null ? Number(entry.targetMarginPercent) : DEFAULT_TARGET_MARGIN;
  const revenue = salePrice*rate, fee = revenue*feeRate/100;
  const calculated = revenue > 0 && productCost > 0;
  const profit = calculated ? revenue - productCost - fee - shipping - packaging - ad : 0;
  const margin = calculated ? profit/revenue*100 : 0;
  const verdict = !calculated ? null : margin <= 0 ? '적자' : margin >= target - 0.2 ? '목표 달성' : '목표 미달';
  return { id:entry.id, productId:product.id, name:product.name, sku:product.sku||entry.sku||'', brand:product.brand||'', currency:entry.currency, salePrice, revenue, productCost, packaging, shipping, fee, ad, profit, margin, verdict, calculated, updatedAt:entry.updatedAt||'' };
}
function buildRows() {
  marginRows = pricingEntries.filter(e => e.channel === channel).map(e => {
    const product = products.find(p => p.id === e.productId);
    return product ? calcRow(e, product) : null;
  }).filter(Boolean);
}
// 표 헤더 클릭 정렬. 값이 없는 행(원가 미설정)은 맨 아래로 간다.
const VERDICT_RANK = { '적자':0, '목표 미달':1, '목표 달성':2 };
const calcOnly = fn => row => row.calculated ? fn(row) : null;
const colSortGetters = {
  name: row => row.name,
  listing: row => row.listingPriceJpy,
  code: row => qooCodeOf(row),
  reg: row => qooReg[row.productId] ? 1 : 0,
  sale: calcOnly(row => row.revenue),
  cost: calcOnly(row => row.productCost),
  packaging: calcOnly(row => row.packaging),
  shipping: calcOnly(row => row.shipping),
  fee: calcOnly(row => row.fee),
  ad: calcOnly(row => row.ad),
  profit: calcOnly(row => row.profit),
  margin: calcOnly(row => row.margin),
  verdict: calcOnly(row => VERDICT_RANK[row.verdict]),
};
function filteredRows() {
  const keyword = $('#marginSearch').value.trim().toLowerCase(), filter = $('#marginFilter').value, lossOnly = $('#lossOnly').checked;
  const rows = marginRows.filter(row => {
    if (keyword && ![row.name,row.sku,row.brand].some(v => String(v||'').toLowerCase().includes(keyword))) return false;
    if (lossOnly && (!row.calculated || row.margin >= 0)) return false;
    if (filter === 'missing') return !row.calculated;
    if (filter === 'loss') return row.calculated && row.margin < 0;
    if (filter === '0-10') return row.calculated && row.margin >= 0 && row.margin < 10;
    if (filter === '10-15') return row.calculated && row.margin >= 10 && row.margin < 15;
    if (filter === '15-20') return row.calculated && row.margin >= 15 && row.margin < 20;
    if (filter === '20') return row.calculated && row.margin >= 20;
    if (filter === '30') return row.calculated && row.margin >= 30;
    return true;
  });
  const field = {profit:'profit',margin:'margin',revenue:'revenue',cost:'productCost',name:'name'}[$('#sortBy').value], dir = $('#sortOrder').value === 'asc' ? 1 : -1;
  if (!TableSort.sort(rows, colSortGetters)) rows.sort((a,b) => field === 'name' ? a.name.localeCompare(b.name,'ko')*dir : ((Number(a[field])||0)-(Number(b[field])||0))*dir);
  return rows;
}
function renderMetrics() {
  const total = marginRows.length, calc = marginRows.filter(r => r.calculated), loss = calc.filter(r => r.margin < 0);
  const avg = calc.length ? calc.reduce((s,r) => s+r.margin,0)/calc.length : 0;
  $('#marginMetrics').innerHTML = `<article class="marginMetric"><div class="metricHead"><span class="metricIcon">□</span>등록 상품수</div><strong>${total}</strong><small>${escapeHtml(channel)} 원가를 등록한 상품</small></article><article class="marginMetric"><div class="metricHead"><span class="metricIcon">▤</span>마진 계산된 상품수</div><strong>${calc.length}</strong><small>등록 ${total}개 중 ${calc.length}개 계산완료 (${total?(calc.length/total*100).toFixed(1):'0.0'}%)</small></article><article class="marginMetric loss"><div class="metricHead"><span class="metricIcon">↘</span>마진 손실 상품수</div><strong>${loss.length}</strong><small>계산된 상품 중 ${calc.length?(loss.length/calc.length*100).toFixed(1):'0.0'}%가 손실</small></article><article class="marginMetric average"><div class="metricHead"><span class="metricIcon">↗</span>평균 마진율</div><strong>${avg.toFixed(1)}%</strong><small>마진 계산된 상품의 평균 마진율</small></article>`;
}
function verdictBadge(row) {
  if (!row.calculated) return '<span class="stateBadge missing">원가 설정 필요</span>';
  if (row.verdict === '적자') return '<span class="stateBadge loss">적자</span>';
  if (row.verdict === '목표 미달') return '<span class="stateBadge missing">목표 미달</span>';
  return '<span class="stateBadge good">목표 달성</span>';
}
// 큐텐 등록 현황(완료/미완료): 상품별로 서버에 저장, 배지를 클릭하면 토글
let qooReg = {};
if (isQoo) fetch('/api/qm/qoo10-registered').then(r => r.json()).then(d => { qooReg = d.items || {}; try { renderRows(); } catch {} }).catch(() => {});
// 큐텐 등록 완료 상품은 상품명 앞에 상품코드(시트와 동일)를 붙여 보여준다
let qooSheetCodes = {};
const qooKey = v => String(v || '').replace(/[\s·\-_]/g, '').replace(/^오아/, '').toLowerCase();
if (isQoo) fetch('/api/qm/qoo10-sheet-codes').then(r => r.json()).then(d => { qooSheetCodes = {}; Object.entries(d.items || {}).forEach(([k, v]) => { qooSheetCodes[qooKey(k)] = v; }); try { renderRows(); } catch {} }).catch(() => {});
let qooManual = {};
if (isQoo) fetch('/api/qm/qoo10-manual-codes').then(r => r.json()).then(d => { qooManual = d.items || {}; try { renderRows(); } catch {} }).catch(() => {});
function qooSheetCodeOf(row) {
  if (!isQoo) return '';
  const k = qooKey(row.name);
  const hit = Object.keys(qooSheetCodes).filter(x => x && k.startsWith(x)).sort((p, q) => q.length - p.length)[0];
  const code = hit && qooSheetCodes[hit];
  return code || '';
}
function qooCodeOf(row) { return qooManual[row.productId] || qooSheetCodeOf(row) || ''; }
function qooCodeCell(row) {
  if (!isQoo) return '';
  return `<input type="text" inputmode="numeric" data-qoo-code="${escapeHtml(row.productId)}" value="${escapeHtml(qooCodeOf(row))}" title="${qooManual[row.productId] ? '직접 입력한 값' : '시트 값'} · 수정하면 저장됩니다" placeholder="직접 입력" style="width:104px;padding:5px 7px;border:1px solid #d1d5db;border-radius:6px;font:inherit;font-size:12px">`;
}
function qooRegBadge(row) {
  const date = qooReg[row.productId];
  return date
    ? `<button type="button" class="stateBadge" data-qoo-reg="${escapeHtml(row.productId)}" data-qoo-on="1" title="큐텐 등록 ${date} · 클릭하면 미완료로" style="cursor:pointer;border:0;background:#2563eb;color:#fff">✓ 완료</button>`
    : `<button type="button" class="stateBadge" data-qoo-reg="${escapeHtml(row.productId)}" data-qoo-on="0" title="클릭하면 등록 완료로 표시" style="cursor:pointer;border:0;background:#e5e7eb;color:#4b5563">미완료</button>`;
}
function renderRows() {
  const rows = filteredRows();
  $('#resultCount').textContent = `${rows.length}개 항목`;
  $('#marginEmpty').classList.toggle('hidden', rows.length > 0);
  $('#marginRows').innerHTML = rows.map(row => `<tr>
    <td><input type="checkbox" class="rowSel" data-id="${escapeHtml(row.id)}"${selectedRows.has(row.id)?' checked':''}></td>
    ${isQoo?`<td>${qooCodeCell(row)}</td>`:''}
    <td><div class="marginProduct"><span class="productThumb">${escapeHtml((row.name||'P').slice(0,1))}</span><span><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.sku||'SKU 미입력')}${row.brand?` · ${escapeHtml(row.brand)}`:''}</small></span></div></td>
    ${isQoo?`<td>${row.listingPriceJpy!=null&&Number.isFinite(row.listingPriceJpy)?`<span class="priceMain">${localMoney(Math.round(row.listingPriceJpy),'JPY')}</span>`:'-'}</td><td>${qooRegBadge(row)}</td>`:''}
    <td>${row.calculated?`<span class="priceMain">${localMoneyRed(row.salePrice,row.currency)}</span><span class="cellSub">${money(row.revenue)}</span>`:'<span class="cellSub">판매가 미설정</span>'}</td>
    <td>${row.calculated?money(row.productCost):'-'}</td>
    <td>${row.calculated?money(row.packaging):'-'}</td>
    <td>${row.calculated?money(row.shipping):'-'}</td>
    <td>${row.calculated?money(row.fee):'-'}</td>
    <td>${row.calculated?money(row.ad):'-'}</td>
    <td><span class="profitMain ${row.profit<0?'negative':'positive'}">${row.calculated?money(row.profit):'-'}</span></td>
    <td><span class="marginRate ${row.margin<0?'negative':'positive'}">${row.calculated?`${row.margin.toFixed(1)}%`:'-'}</span></td>
    <td>${verdictBadge(row)}</td>
    <td><button type="button" class="rowAction" data-cost-entry="${row.id}">수정</button></td>
  </tr>`).join('');
  syncSelectionUi();
  $$('[data-cost-entry]').forEach(b => b.onclick = () => {
    const entry = pricingEntries.find(e => e.id === b.dataset.costEntry);
    openCostDialog(products.find(p => p.id === entry.productId), entry);
  });
}

// ── 선택 삭제: 행 앞 체크박스로 고르고 '선택 삭제' 버튼으로 한 번에 지운다 ──
const selectedRows = new Set();
function syncSelectionUi() {
  const n = selectedRows.size, btn = $('#deleteSelected');
  btn.disabled = n === 0; btn.style.opacity = n ? '1' : '.5'; btn.textContent = n ? `선택 삭제 (${n})` : '선택 삭제';
  const boxes = $$('.rowSel:not(:disabled)'); $('#selAll').checked = boxes.length > 0 && boxes.every(b => b.checked);
}
$('#marginRows').addEventListener('change', e => {
  const b = e.target.closest('.rowSel'); if (!b) return;
  if (b.checked) selectedRows.add(b.dataset.id); else selectedRows.delete(b.dataset.id);
  syncSelectionUi();
});
$('#selAll').addEventListener('change', e => {
  $$('.rowSel:not(:disabled)').forEach(b => { b.checked = e.target.checked; if (e.target.checked) selectedRows.add(b.dataset.id); else selectedRows.delete(b.dataset.id); });
  syncSelectionUi();
});
$('#deleteSelected').addEventListener('click', async () => {
  const ids = [...selectedRows].filter(id => marginRows.some(r => r.id === id));
  if (!ids.length) return;
  if (!confirm(`선택한 ${ids.length}개 상품의 ${channel} 원가 정보를 삭제할까요?`)) return;
  for (const id of ids) await fetch('/api/qm/pricing/' + id, { method: 'DELETE' });
  selectedRows.clear(); await loadData(); toast(`${ids.length}개 상품을 삭제했습니다.`);
});
function renderAll() { renderMetrics(); renderRows(); renderEvent(); }

// ── 행사 진행 시 마진: 정상 실제 판매가는 그대로 두고, 행사 판매가만 따로 넣어 마진을 미리 본다 ──
let EVENT_KEY = 'marginEventPrices:' + channel;
let eventPrices = {};
try { eventPrices = JSON.parse(localStorage.getItem(EVENT_KEY) || '{}') || {}; } catch { eventPrices = {}; }
const saveEventPrices = () => { try { localStorage.setItem(EVENT_KEY, JSON.stringify(eventPrices)); } catch {} };
const evSelected = new Set();
let EVENT_QP_KEY = 'marginEventQp:' + channel;
let eventQp = {};
const saveEventQp = () => { try { localStorage.setItem(EVENT_QP_KEY, JSON.stringify(eventQp)); } catch {} };
const CUR_LABEL = { JPY:'엔', USD:'달러' }[cfg.currency] || cfg.currency;
(() => {
  const st = document.createElement('style');
  st.textContent = '.viewTabs{display:flex;gap:10px;margin:0 0 16px}.viewTab{padding:13px 28px;border:2px solid #cbd5e1;border-radius:12px;background:#fff;color:#475569;font-size:16px;font-weight:800;cursor:pointer;box-shadow:0 1px 2px rgba(15,23,42,.06)}.viewTab:hover{border-color:#2563eb;color:#1d4ed8}.viewTab.active{background:#2563eb;border-color:#1d4ed8;color:#fff;box-shadow:0 4px 12px rgba(37,99,235,.35)}'
    + '.evBulkBar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 20px 10px;padding:12px 14px;border:1px solid #bfdbfe;border-radius:10px;background:#eff6ff}.evBulkTitle{font-weight:800;color:#1e3a8a}.evSelCount{padding:3px 10px;border-radius:999px;background:#fff;color:#1d4ed8;font-weight:700;font-size:13px}.evBulkBar select,.evBulkBar input{padding:7px 9px;border:1px solid #93c5fd;border-radius:8px;background:#fff;font-size:14px}.evBulkBar input{width:110px;text-align:right}.evUnit{font-weight:700;color:#334155}'
    + '.evBtn{margin:0 6px 0 0;padding:8px 14px;border:1px solid #2563eb;border-radius:8px;background:#2563eb;color:#fff;font-weight:700;cursor:pointer}.evBtnGhost{border-color:#d1d5db;background:#fff;color:#4b5563;margin-left:12px}.evHint{margin:0 0 10px;padding:0 20px;color:#6b7280;font-size:13px}'
    + '.evPrice{width:100px;padding:7px 8px;border:2px solid #fca5a5;border-radius:8px;font-weight:700;color:#dc2626;text-align:right}.evPrice:focus{outline:none;border-color:#2563eb}.evDelta.negative{color:#dc2626}.evDelta.positive{color:#16a34a}';
  document.head.appendChild(st);
  $('#evAmtOpt').textContent = `할인 금액 (${CUR_LABEL})`;
})();
function eventContext(row) {
  const entry = pricingEntries.find(e => e.id === row.id), product = products.find(p => p.id === row.productId);
  return entry && product ? { entry, product } : null;
}
// 행사가로 다시 계산한 결과(행사가 미입력이면 ok=false)
function evInfo(row) {
  const c = eventContext(row), price = Number(eventPrices[row.id]);
  const has = !!c && row.calculated && Number.isFinite(price) && price > 0;
  let ev = has ? calcRow(evEntry(c.entry, price, row.id), c.product) : null;
  const qp = evMode === 'review' ? (Number(eventQp[row.id]) || 0) : 0;
  // Q포인트는 셀러 100% 부담: 광고비·쿠폰 칸에 합산하고 순이익에서 뺀다.
  if (ev && ev.calculated && qp > 0) {
    const q = qp * (ev.salePrice > 0 ? ev.revenue / ev.salePrice : 0), target = c.entry.targetMarginPercent != null ? Number(c.entry.targetMarginPercent) : DEFAULT_TARGET_MARGIN;
    ev = { ...ev, ad: ev.ad + q, profit: ev.profit - q };
    ev.margin = ev.revenue > 0 ? ev.profit / ev.revenue * 100 : 0;
    ev.verdict = ev.margin <= 0 ? '적자' : ev.margin >= target - 0.2 ? '목표 달성' : '목표 미달';
  }
  const ok = !!ev && ev.calculated;
  return { c, price, qp, has, ev, ok, disc: has && row.salePrice > 0 ? (1 - price / row.salePrice) * 100 : null, delta: ok ? ev.margin - row.margin : null };
}
// 쿠폰이 적용된 행이면 고객이 실제 결제하는 프로모션 가격(메가와리 쿠폰 + SHOP 쿠폰 적용 후)을 보여준다.
function promoLine(ev) {
  if (!ev || ev.promoPriceJpy == null || ev.promoPriceJpy === ev.salePrice) return '<span class="cellSub evPromo"></span>';
  return `<span class="cellSub evPromo" style="color:#b91c1c;font-weight:700">프로모션가 ${localMoney(Math.round(ev.promoPriceJpy), ev.currency)}</span>`;
}
// 리뷰이벤트 탭: 소비자체감가 = 특가가격 − Q포인트
function consumerLine(row) {
  if (evMode !== 'review') return '';
  const { has, price, qp } = evInfo(row);
  return `<span class="cellSub evConsumer" style="color:#1d4ed8;font-weight:700">${has && qp > 0 ? `소비자체감가 ${localMoney(Math.round(price - qp), row.currency)}` : ''}</span>`;
}
function qpInput(row) {
  if (evMode !== 'review' || !row.calculated) return '';
  const q = Number(eventQp[row.id]) || 0;
  return `<div style="margin-top:6px"><input type="number" class="evQp" min="0" step="1" data-id="${escapeHtml(row.id)}" value="${q || ''}" placeholder="Q포인트" title="Q포인트 지급액 (엔, 셀러 100% 부담)" style="width:100px;padding:7px 8px;border:2px solid #93c5fd;border-radius:8px;font-weight:700;color:#1d4ed8;text-align:right"></div>${consumerLine(row)}`;
}
function eventRowCells(row) {
  const { price, has, ev, ok, disc, delta } = evInfo(row);
  return [
    `<td><input type="checkbox" class="evSel" data-id="${escapeHtml(row.id)}"${evSelected.has(row.id)?' checked':''}></td>`,
    `<td>${qooCodeCell(row)}</td>`,
    `<td><div class="marginProduct"><span class="productThumb">${escapeHtml((row.name||'P').slice(0,1))}</span><span><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.sku||'SKU 미입력')}${row.brand?` · ${escapeHtml(row.brand)}`:''}</small>${evMemoLine(row.id)}</span></div></td>`,
    `<td>${row.calculated ? `<span class="priceMain">${localMoney(row.salePrice,row.currency)}</span><span class="cellSub">${money(row.revenue)}</span>` : '<span class="cellSub">판매가 미설정</span>'}</td>`,
    `<td class="evInputCell">${row.calculated ? `<input type="number" class="evPrice" min="0" step="0.01" data-id="${escapeHtml(row.id)}" value="${has ? price : ''}" placeholder="행사가"><span class="cellSub evKrw">${ok ? money(ev.revenue) : ''}</span>${promoLine(ok ? ev : null)}${qpInput(row)}` : '-'}</td>`,
    `<td>${disc != null ? `${disc.toFixed(1)}%` : '-'}</td>`,
    `<td>${ok ? money(ev.productCost) : '-'}</td>`,
    `<td>${ok ? money(ev.packaging) : '-'}</td>`,
    `<td>${ok ? money(ev.shipping) : '-'}</td>`,
    `<td>${ok ? money(ev.fee) : '-'}</td>`,
    `<td>${ok ? money(ev.ad) : '-'}</td>`,
    `<td><span class="profitMain ${ok && ev.profit<0?'negative':'positive'}">${ok ? money(ev.profit) : '-'}</span></td>`,
    `<td><span class="marginRate ${ok && ev.margin<0?'negative':'positive'}">${ok ? `${ev.margin.toFixed(1)}%` : '-'}</span></td>`,
    `<td>${ok ? `<span class="evDelta ${delta<0?'negative':'positive'}">${delta>0?'+':''}${delta.toFixed(1)}%p</span>` : '-'}</td>`,
    `<td>${ok ? verdictBadge(ev) : '-'}</td>`,
    `<td><button type="button" class="rowAction evEdit" data-id="${escapeHtml(row.id)}">수정${eventMeta[row.id] ? ' ●' : ''}</button></td>`,
  ];
}
// ── 행사 전용 설정(메가할인 이용료 등 수수료 옵션, 행사 기간, 메모): 정상 원가 설정은 건드리지 않고 행사 계산에만 덮어쓴다 ──
let EVENT_META_KEY = 'marginEventMeta:' + channel;
let eventMeta = {};
try { eventMeta = JSON.parse(localStorage.getItem(EVENT_META_KEY) || '{}') || {}; } catch { eventMeta = {}; }
const saveEventMeta = () => { try { localStorage.setItem(EVENT_META_KEY, JSON.stringify(eventMeta)); } catch {} };
const QOO_EV_FLAGS = [['overseasSaleFeeApplied','해외상품판매수수료 +2%'],['reservationFeeApplied','예약배송상품수수료 +2%'],['externalAdFeeApplied','외부광고수수료 +1%'],['megaDiscountFeeApplied','메가할인 이용료 +1%'],['megaCouponApplied','메가와리 쿠폰 (Co-funding: 큐텐·셀러 분담)'],['vatApplied','부가세 10% 적용 (사업자등록 시 면제)'],['customsApplied','관세 셀러 부담']];
function evEntry(entry, price, id) {
  const m = eventMeta[id], e = { ...entry, salePrice: price };
  if (evMode === 'review' && isQoo) e.options = { ...(entry.options || {}), megaCouponApplied: false };
  if (!m) return e;
  if (isQoo) {
    e.options = { ...(e.options || entry.options || {}), ...(m.options || {}) };
    if (evMode === 'review') e.options.megaCouponApplied = false;
    if (m.advertisingPercent != null) e.advertisingPercent = m.advertisingPercent;
    if (m.vatRefundEnabled != null) e.vatRefundEnabled = m.vatRefundEnabled;
  } else {
    if (m.platformFeeRate != null) e.platformFeeRate = m.platformFeeRate;
    if (m.adCost != null) e.adCost = m.adCost;
  }
  return e;
}
function evMemoLine(id) {
  const m = eventMeta[id]; if (!m) return '';
  const period = m.start || m.end ? `📅 ${m.start || '?'} ~ ${m.end || '?'}` : '';
  const text = [period, m.memo].filter(Boolean).join(' · ');
  return text ? `<small class="evMemo" style="display:block;color:#b45309;white-space:normal;max-width:240px">${escapeHtml(text)}</small>` : '';
}
function openEvDialog(row) {
  const c = eventContext(row); if (!c) return;
  const m = eventMeta[row.id] || {}, o = c.entry.options || {};
  const eff = key => m.options?.[key] ?? (evMode === 'review' && key === 'megaCouponApplied' ? false : o[key]) ?? QCFG?.[key];
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  const inp = 'width:100%;padding:9px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box';
  const lab = 'display:block;font-size:13px;font-weight:700;color:#334155';
  const rv = evMode === 'review';
  const flags = isQoo ? QOO_EV_FLAGS.filter(([k]) => !(rv && k === 'megaCouponApplied')).map(([k, t]) => `<label style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" data-flag="${k}"${eff(k) ? ' checked' : ''}> ${t}</label>`).join('')
    + `<label style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" id="evfRefund"${(m.vatRefundEnabled ?? c.entry.vatRefundEnabled) ? ' checked' : ''}> 부가세 환급 적용</label>` : '';
  const fields = isQoo
    ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 16px">${flags}</div>
       <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
         <label style="${lab}">카테고리 수수료율 (%)<input id="evfCat" type="number" step="0.1" style="${inp}" value="${eff('categoryFeePercent') ?? ''}"></label>
         <label style="${lab}">광고비 비중 (판매가 대비 %)<input id="evfAd" type="number" step="0.1" style="${inp}" value="${m.advertisingPercent ?? c.entry.advertisingPercent ?? 0}"></label>
         ${rv ? '' : `<label style="${lab}">메가와리 쿠폰 할인율 (%)<input id="evfCpnDisc" type="number" step="0.1" style="${inp}" value="${eff('couponDiscountPercent') ?? 20}"></label>
         <label style="${lab}">쿠폰 셀러 부담비율 (%)<input id="evfCpnShare" type="number" step="1" style="${inp}" value="${eff('couponSellerSharePercent') ?? 50}"></label>
         <label style="${lab}">SHOP 쿠폰 할인액 (엔, 셀러 100% 부담)<input id="evfShop" type="number" step="1" style="${inp}" value="${eff('shopCouponJpy') ?? 0}" placeholder="예: 400"></label>
         <label style="${lab}">SHOP 쿠폰 최소 구매액 (엔)<input id="evfShopMin" type="number" step="1" style="${inp}" value="${eff('shopCouponMinPriceJpy') ?? 0}" placeholder="예: 3000"></label>`}</div>
       ${rv ? '<small style="color:#64748b">상품 마진 목록의 설정값을 그대로 가져옵니다. 여기서 바꾼 값은 리뷰이벤트 계산에만 적용됩니다. 특가가격은 표의 「행사 판매가」, Q포인트 지급액은 그 아래 칸에 입력하세요.</small>' : `<small style="color:#64748b">행사 판매가 = 쿠폰 적용 전 판매가(TS/DD 가격)를 넣으세요. 메가와리 쿠폰은 판매가 × 할인율(최대 10,000엔)이고 그중 셀러 부담비율만큼, SHOP 쿠폰은 메가와리 적용가가 최소 구매액 이상일 때 전액 정산액에서 빠집니다. 수수료·관세는 쿠폰 적용 전 판매가 기준입니다.</small>`}`
    : `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
         <label style="${lab}">플랫폼 수수료 (%)<input id="evfFee" type="number" step="0.01" style="${inp}" value="${m.platformFeeRate ?? c.entry.platformFeeRate ?? 0}"></label>
         <label style="${lab}">광고비/개 (원)<input id="evfAdCost" type="number" style="${inp}" value="${m.adCost ?? c.entry.adCost ?? 0}"></label></div>`;
  box.innerHTML = `<div style="background:#fff;border-radius:14px;padding:22px 24px;width:min(560px,100%);max-height:92vh;overflow:auto;display:grid;gap:14px">
    <div><p class="kicker" style="margin:0">EVENT SETTINGS</p><h3 style="margin:2px 0 0">${escapeHtml(row.name)} · 행사 설정</h3>
      <small style="color:#64748b">여기서 바꾼 값은 「행사 진행 시 마진」 계산에만 적용되고, 상품 마진 목록의 원가·수수료 설정은 바뀌지 않습니다.</small></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <label style="${lab}">행사 시작일<input id="evfStart" type="date" style="${inp}" value="${escapeHtml(m.start || '')}"></label>
      <label style="${lab}">행사 종료일<input id="evfEnd" type="date" style="${inp}" value="${escapeHtml(m.end || '')}"></label></div>
    ${fields}
    <label style="${lab}">메모 (행사 일정·조건 등)<textarea id="evfMemo" rows="3" style="${inp}">${escapeHtml(m.memo || '')}</textarea></label>
    <div style="display:flex;gap:8px;justify-content:space-between;align-items:center">
      <button type="button" id="evfReset" class="evBtn evBtnGhost" style="margin:0">행사 설정 초기화</button>
      <span><button type="button" id="evfCancel" class="evBtn evBtnGhost" style="margin:0 6px 0 0">취소</button><button type="button" id="evfSave" class="evBtn" style="margin:0">저장</button></span></div></div>`;
  document.body.appendChild(box);
  const close = () => box.remove(), q = s => box.querySelector(s);
  box.addEventListener('mousedown', e => { if (e.target === box) close(); });
  q('#evfCancel').onclick = close;
  q('#evfReset').onclick = () => { delete eventMeta[row.id]; saveEventMeta(); close(); renderEvent(); toast('행사 설정을 초기화했습니다.'); };
  q('#evfSave').onclick = () => {
    const next = { start: q('#evfStart').value, end: q('#evfEnd').value, memo: q('#evfMemo').value.trim() };
    if (isQoo) {
      next.options = {}; box.querySelectorAll('[data-flag]').forEach(b => { next.options[b.dataset.flag] = b.checked; });
      next.options.categoryFeePercent = Number(q('#evfCat').value) || 0;
      if (q('#evfCpnDisc')) {
        next.options.couponDiscountPercent = Number(q('#evfCpnDisc').value) || 0;
        next.options.couponSellerSharePercent = Number(q('#evfCpnShare').value) || 0;
        next.options.shopCouponJpy = Number(q('#evfShop').value) || 0;
        next.options.shopCouponMinPriceJpy = Number(q('#evfShopMin').value) || 0;
      } else next.options.megaCouponApplied = false;
      next.advertisingPercent = Number(q('#evfAd').value) || 0;
      next.vatRefundEnabled = q('#evfRefund').checked;
    } else { next.platformFeeRate = Number(q('#evfFee').value) || 0; next.adCost = Number(q('#evfAdCost').value) || 0; }
    eventMeta[row.id] = next; saveEventMeta(); close(); renderEvent(); toast('행사 설정을 저장했습니다.');
  };
}
$('#eventRows').addEventListener('click', e => {
  const b = e.target.closest('.evEdit'); if (!b) return;
  const row = marginRows.find(r => r.id === b.dataset.id); if (row) openEvDialog(row);
});

// 행사 표 헤더 클릭 정렬(행사가를 안 넣은 행은 맨 아래)
const evOnly = fn => row => { const i = evInfo(row); return i.ok ? fn(i, row) : null; };
const evGetters = {
  code: row => qooCodeOf(row),
  name: row => row.name,
  normal: row => row.calculated ? row.revenue : null,
  event: row => { const i = evInfo(row); return i.ok ? i.ev.revenue : null; },
  disc: row => evInfo(row).disc,
  cost: evOnly(i => i.ev.productCost), packaging: evOnly(i => i.ev.packaging), shipping: evOnly(i => i.ev.shipping),
  fee: evOnly(i => i.ev.fee), ad: evOnly(i => i.ev.ad), profit: evOnly(i => i.ev.profit), margin: evOnly(i => i.ev.margin),
  delta: evOnly(i => i.delta), verdict: evOnly(i => VERDICT_RANK[i.ev.verdict]),
};
const evSort = TableSort.create($('#eventPanel table'), () => renderEvent());
function visibleEventRows() {
  const rows = filteredRows().filter(r => eventContext(r));
  evSort.sort(rows, evGetters);
  return rows;
}
function syncEvSelUi(rows) {
  rows = rows || visibleEventRows();
  const n = rows.filter(r => evSelected.has(r.id)).length;
  $('#evSelCount').textContent = `선택 ${n}개`;
  $('#evSelAll').checked = rows.length > 0 && n === rows.length;
  $('#evSelAll').indeterminate = n > 0 && n < rows.length;
}
function renderEvent() {
  if ($('#eventPanel').classList.contains('hidden')) return;
  const rows = visibleEventRows();
  $('#eventCount').textContent = `${rows.length}개 항목`;
  $('#eventEmpty').classList.toggle('hidden', rows.length > 0);
  $('#eventRows').innerHTML = rows.map(row => `<tr data-row="${escapeHtml(row.id)}">${eventRowCells(row).join('')}</tr>`).join('');
  syncEvSelUi(rows);
  renderRecover();
}
// ── 리뷰이벤트 회수 시뮬레이터(보고용): 리뷰이벤트로 생기는 손실을 타임특가·정상가 판매로 몇 개·며칠 만에 회수하는지 계산 ──
const RECOVER_KEY = 'marginReviewRecover:' + channel;
let recoverState = {};
try { recoverState = JSON.parse(localStorage.getItem(RECOVER_KEY) || '{}') || {}; } catch { recoverState = {}; }
const saveRecover = () => { try { localStorage.setItem(RECOVER_KEY, JSON.stringify(recoverState)); } catch {} };
let recoverId = '';
$('#eventPanel .evBulkBar').insertAdjacentHTML('beforebegin', '<div id="recoverPanel" class="hidden" style="margin:0 0 16px;padding:18px 20px;border:2px solid #93c5fd;border-radius:14px;background:#f8fbff"></div>');
function recoverCalc(row) {
  const info = evInfo(row); if (!info.ok) return null;
  const st = recoverState[row.id] || {};
  const qty = Number(st.qty) > 0 ? Number(st.qty) : 50;
  const ts = Number(st.ts) > 0 ? Number(st.ts) : row.salePrice;
  const perDay = Number(st.perDay) > 0 ? Number(st.perDay) : 0;
  const evProfit = info.ev.profit, loss = evProfit < 0 ? -evProfit * qty : 0;
  const tsRow = calcRow({ ...info.c.entry, salePrice: ts }, info.c.product);
  const tsProfit = tsRow && tsRow.calculated ? tsRow.profit : null, tsMargin = tsRow && tsRow.calculated ? tsRow.margin : null;
  const nm = Number(st.nm) > 0 ? Number(st.nm) : row.salePrice;   // 상시가(내가 넣는 상시 판매가)
  const nmRow = calcRow({ ...info.c.entry, salePrice: nm }, info.c.product);
  const normProfit = nmRow && nmRow.calculated ? nmRow.profit : null, normMargin = nmRow && nmRow.calculated ? nmRow.margin : null;
  const tsQty = Number(st.tsQty) > 0 ? Number(st.tsQty) : 0, nmQty = Number(st.nmQty) > 0 ? Number(st.nmQty) : 0;
  const need = p => loss <= 0 ? 0 : (p != null && p > 0 ? Math.ceil(loss / p) : null);
  return { row, info, qty, ts, nm, perDay, evProfit, loss, tsProfit, tsMargin, normProfit, normMargin, tsQty, nmQty, tsTotal: tsProfit != null ? tsProfit * tsQty : null, nmTotal: normProfit != null ? normProfit * nmQty : null, needTs: need(tsProfit), needNorm: need(normProfit) };
}
function recoverText(c) {
  const cur = c.row.currency, evPrice = c.info.price;
  const days = n => c.perDay > 0 && n != null ? ` (하루 ${c.perDay}개 판매 시 약 ${Math.ceil(n / c.perDay)}일)` : '';
  if (c.loss <= 0) return `[${c.row.name}] 리뷰이벤트가 ${localMoney(evPrice, cur)} × ${c.qty}개 기준 개당 ${money(c.evProfit)} 이익이라 손실 없이 포토리뷰 ${c.qty}건을 확보합니다.`;
  const ts = c.needTs == null ? '타임특가 가격에서는 개당 이익이 없어 회수가 어렵습니다.' : `이후 타임특가(${localMoney(c.ts, cur)})로 개당 ${money(c.tsProfit)} 남기면 ${c.needTs.toLocaleString('ko-KR')}개 판매 시 투자금을 전액 회수합니다${days(c.needTs)}.`;
  const norm = c.needNorm == null ? '' : ` 상시가(${localMoney(c.nm, cur)})로 팔면 개당 ${money(c.normProfit)}씩 남아 ${c.needNorm.toLocaleString('ko-KR')}개로 회수됩니다${days(c.needNorm)}.`
    + (c.nmQty > 0 && c.nmTotal != null ? ` 상시가로 ${c.nmQty.toLocaleString('ko-KR')}개 판매 시 총 ${money(c.nmTotal)} 회수(투자금 차감 후 ${money(c.nmTotal - c.loss)}).` : '')
    + (c.tsQty > 0 && c.tsTotal != null ? ` 타임특가로 ${c.tsQty.toLocaleString('ko-KR')}개 판매 시 총 ${money(c.tsTotal)} 회수(투자금 차감 후 ${money(c.tsTotal - c.loss)}).` : '');
  return `[${c.row.name}] 리뷰이벤트 ${localMoney(evPrice, cur)} × ${c.qty}개는 개당 ${money(c.evProfit)}, 총 ${money(-c.loss)}의 선투자입니다. 대신 포토리뷰 ${c.qty}건이 쌓입니다. ${ts}${norm} 회수 이후 판매분은 모두 순이익입니다.`;
}
function renderRecoverOut() {
  const row = marginRows.find(r => r.id === recoverId), out = $('#recoverOut'); if (!row || !out) return;
  const c = recoverCalc(row); if (!c) { out.innerHTML = '<p class="evHint" style="margin:0">위의 <b>리뷰이벤트 금액</b>(예: 999)을 입력하면 이 상품의 회수 계산이 나옵니다.</p>'; return; }
  const cur = row.currency, cell = (t, v, sub) => `<div style="padding:10px 14px;background:#fff;border:1px solid #dbeafe;border-radius:10px"><small style="color:#64748b">${t}</small><div style="font-size:20px;font-weight:800;margin-top:2px">${v}</div>${sub ? `<small style="color:#64748b">${sub}</small>` : ''}</div>`;
  const neg = 'color:#dc2626', pos = 'color:#16a34a';
  const days = n => c.perDay > 0 && n != null ? `약 ${Math.ceil(n / c.perDay)}일` : '일 판매량 입력 시 계산';
  out.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:10px">
    ${cell('① 리뷰이벤트 개당 순이익', `<span style="${c.evProfit < 0 ? neg : pos}">${money(c.evProfit)}</span>`, `${localMoney(c.info.price, cur)} · 마진 ${c.info.ev.margin.toFixed(1)}%`)}
    ${cell(`② 총 투자(손실) × ${c.qty}개`, `<span style="${c.loss > 0 ? neg : pos}">${c.loss > 0 ? money(-c.loss) : '손실 없음'}</span>`, `얻는 것: 포토리뷰 ${c.qty}건`)}
    ${cell('③ 타임특가 개당 순이익', c.tsProfit == null ? '-' : `<span style="${c.tsProfit < 0 ? neg : pos}">${money(c.tsProfit)}</span>`, c.tsMargin == null ? '' : `${localMoney(c.ts, cur)} · 마진 ${c.tsMargin.toFixed(1)}%`)}
    ${cell('④ 회수에 필요한 판매량(타임특가)', c.loss <= 0 ? '-' : c.needTs == null ? '<span style="' + neg + '">회수 불가</span>' : c.needTs.toLocaleString('ko-KR') + '개', c.loss <= 0 ? '' : days(c.needTs))}
    ${cell('⑤ 상시가 개당 순이익', c.normProfit == null ? '-' : `<span style="${c.normProfit < 0 ? neg : pos}">${money(c.normProfit)}</span>`, c.normMargin == null ? '' : `${localMoney(c.nm, cur)} · 마진 ${c.normMargin.toFixed(1)}%`)}
    ${cell('⑥ 회수에 필요한 판매량(상시가)', c.loss <= 0 ? '-' : c.needNorm == null ? '<span style="' + neg + '">회수 불가</span>' : c.needNorm.toLocaleString('ko-KR') + '개', c.loss <= 0 ? '' : days(c.needNorm))}
    ${cell(`⑦ 타임특가 ${c.tsQty ? c.tsQty.toLocaleString('ko-KR') + '개' : '판매개수 입력 시'} 총 회수금액`, c.tsQty && c.tsTotal != null ? `<span style="${c.tsTotal < 0 ? neg : pos}">${money(c.tsTotal)}</span>` : '-', c.tsQty && c.tsTotal != null ? `투자금 차감 후 <b style="${c.tsTotal - c.loss < 0 ? neg : pos}">${money(c.tsTotal - c.loss)}</b>` : '')}
    ${cell(`⑧ 상시가 ${c.nmQty ? c.nmQty.toLocaleString('ko-KR') + '개' : '판매개수 입력 시'} 총 회수금액`, c.nmQty && c.nmTotal != null ? `<span style="${c.nmTotal < 0 ? neg : pos}">${money(c.nmTotal)}</span>` : '-', c.nmQty && c.nmTotal != null ? `투자금 차감 후 <b style="${c.nmTotal - c.loss < 0 ? neg : pos}">${money(c.nmTotal - c.loss)}</b>` : '')}
  </div>
  <textarea id="recoverText" readonly rows="4" style="width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;font-size:14px;line-height:1.6;resize:vertical">${escapeHtml(recoverText(c))}</textarea>
  <div style="margin-top:8px"><button type="button" class="evBtn" id="recoverCopy">보고용 문구 복사</button></div>`;
}
function renderRecover() {
  const box = $('#recoverPanel'); if (!box) return;
  if (evMode !== 'review') { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  const rows = marginRows.filter(r => r.calculated && eventContext(r));   // 등록된 상품 전체(행사가를 아직 안 넣은 상품도 선택 가능)
  const head ='<p class="kicker" style="margin:0">PAYBACK SIMULATOR</p><h3 style="margin:2px 0 6px;font-size:18px">리뷰이벤트 투자금 회수 계산 (보고용)</h3>';
  if (!rows.length) { box.innerHTML = head + '<p class="evHint" style="margin:0">원가가 등록된 상품이 없습니다. 먼저 상품 마진 목록에서 원가를 등록하세요.</p>'; return; }
  if (!rows.some(r => r.id === recoverId)) recoverId = (rows.find(r => evInfo(r).ok) || rows[0]).id;
  const row = rows.find(r => r.id === recoverId), st = recoverState[row.id] || {};
  const inp = (cls, label, val, ph) => `<label style="display:flex;flex-direction:column;gap:4px;font-size:13px;color:#475569">${label}<input type="number" class="${cls}" min="0" step="any" value="${val || ''}" placeholder="${ph}" style="width:130px;padding:8px 10px;border:2px solid #93c5fd;border-radius:8px;font-weight:700;text-align:right"></label>`;
  box.innerHTML = head + `<p class="evHint" style="margin:0 0 12px">포토리뷰를 쌓는 이벤트 손실(①②)을 이후 타임특가·정상가 판매 이익(③⑤)으로 몇 개 팔아야 회수하는지(④⑥) 계산합니다. 회수 후 판매분은 전부 순이익입니다.</p>
    <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;margin-bottom:12px">
      <label style="display:flex;flex-direction:column;gap:4px;font-size:13px;color:#475569">상품 검색 <small style="color:#94a3b8">(이름을 입력하거나 목록에서 선택)</small><input id="recoverSel" list="recoverList" value="${escapeHtml(row.name)}" placeholder="상품명 검색" autocomplete="off" style="min-width:280px;padding:9px 10px;border:2px solid #93c5fd;border-radius:8px;font-weight:700"><datalist id="recoverList">${rows.map(r => `<option value="${escapeHtml(r.name)}"></option>`).join('')}</datalist></label>
      ${inp('rcEv', `리뷰이벤트 금액(${row.currency})`, eventPrices[row.id], '예: 999')}
      ${inp('rcQty', '리뷰이벤트 수량(개)', st.qty, '50')}
      ${inp('rcTs', `타임특가 판매가(${row.currency})`, st.ts, String(row.salePrice))}
      ${inp('rcTsQty', '타임특가 판매 개수', st.tsQty, '예: 116')}
      ${inp('rcNm', `상시가(${row.currency})`, st.nm, String(row.salePrice))}
      ${inp('rcNmQty', '상시가 판매 개수', st.nmQty, '예: 100')}
      ${inp('rcDay', '하루 판매량(개, 선택)', st.perDay, '예: 3')}
    </div><div id="recoverOut"></div>`;
  renderRecoverOut();
}
$('#eventPanel').addEventListener('input', e => {
  const t = e.target; if (!t.closest || !t.closest('#recoverPanel')) return;
  if (t.classList.contains('rcEv')) {   // 리뷰이벤트 금액: 위 표의 행사가와 같은 값 — 같이 바뀌고 마진도 다시 계산된다
    const tableInput = document.querySelector('#eventRows .evPrice[data-id="' + recoverId + '"]'), v = Number(t.value);
    if (tableInput) { tableInput.value = t.value !== '' && v > 0 ? t.value : ''; tableInput.dispatchEvent(new Event('input', { bubbles: true })); }
    else { if (t.value !== '' && v > 0) eventPrices[recoverId] = v; else delete eventPrices[recoverId]; saveEventPrices(); }
    renderRecoverOut(); return;
  }
  const key = { rcQty: 'qty', rcTs: 'ts', rcDay: 'perDay', rcNm: 'nm', rcTsQty: 'tsQty', rcNmQty: 'nmQty' }[[...t.classList].find(k => k.startsWith('rc')) || ''];
  if (!key) return;
  const st = recoverState[recoverId] || (recoverState[recoverId] = {}), v = Number(t.value);
  if (t.value !== '' && v > 0) st[key] = v; else delete st[key];
  saveRecover(); renderRecoverOut();
});
$('#eventPanel').addEventListener('change', e => {
  if (e.target.id !== 'recoverSel') return;
  const q = e.target.value.trim().toLowerCase(), pool = marginRows.filter(r => r.calculated && eventContext(r));
  const hit = pool.find(r => r.name.toLowerCase() === q) || pool.find(r => r.name.toLowerCase().includes(q) || (r.sku || '').toLowerCase().includes(q));
  if (hit) recoverId = hit.id; else toast('일치하는 상품이 없습니다.');
  renderRecover();
});
$('#eventPanel').addEventListener('click', e => {
  if (!e.target.closest || !e.target.closest('#recoverCopy')) return;
  const ta = $('#recoverText'); if (!ta) return;
  navigator.clipboard.writeText(ta.value).then(() => toast('보고용 문구를 복사했습니다.')).catch(() => { ta.select(); toast('문구를 선택했습니다. Ctrl+C로 복사하세요.'); });
});
// 입력 중에는 입력칸을 유지한 채 나머지 칸만 다시 계산한다(포커스 유지).
$('#eventRows').addEventListener('input', e => {
  const input = e.target.closest('.evPrice'); if (!input) return;
  const id = input.dataset.id, v = Number(input.value);
  if (input.value !== '' && v > 0) eventPrices[id] = v; else delete eventPrices[id];
  saveEventPrices();
  const row = marginRows.find(r => r.id === id); if (!row) return;
  const cells = eventRowCells(row), tr = input.closest('tr');
  [...tr.children].forEach((td, i) => {
    if (i === 0 || i === 1) return;
    if (i === 4) { const k = td.querySelector('.evKrw'); if (k) k.textContent = evInfo(row).ok ? money(evInfo(row).ev.revenue) : ''; const pm = td.querySelector('.evPromo'); if (pm) pm.outerHTML = promoLine(evInfo(row).ok ? evInfo(row).ev : null); const cs = td.querySelector('.evConsumer'); if (cs) cs.outerHTML = consumerLine(row); return; }
    td.outerHTML = cells[i];
  });
});
$('#eventRows').addEventListener('input', e => {
  const input = e.target.closest('.evQp'); if (!input) return;
  const id = input.dataset.id, v = Number(input.value);
  if (input.value !== '' && v > 0) eventQp[id] = v; else delete eventQp[id];
  saveEventQp();
  const row = marginRows.find(r => r.id === id); if (!row) return;
  const cells = eventRowCells(row);
  [...input.closest('tr').children].forEach((td, i) => {
    if (i === 4) { const cs = td.querySelector('.evConsumer'); if (cs) cs.outerHTML = consumerLine(row); return; }
    if (i > 4) td.outerHTML = cells[i];
  });
});
$('#eventRows').addEventListener('change', e => {
  const b = e.target.closest('.evSel'); if (!b) return;
  if (b.checked) evSelected.add(b.dataset.id); else evSelected.delete(b.dataset.id);
  syncEvSelUi();
});
$('#evSelAll').addEventListener('change', e => {
  $$('.evSel').forEach(b => { b.checked = e.target.checked; if (e.target.checked) evSelected.add(b.dataset.id); else evSelected.delete(b.dataset.id); });
  syncEvSelUi();
});
$('#evBulkMode').addEventListener('change', () => { $('#evBulkUnit').textContent = $('#evBulkMode').value === 'pct' ? '%' : CUR_LABEL; });
// 「행사 진행 시 마진」과 「리뷰이벤트 진행 시 마진」은 같은 화면·같은 계산을 쓰고, 입력값(행사가·행사 설정)만 따로 저장한다.
const EV_MODES = {
  event: { title: '행사 진행 시 마진', kicker: 'EVENT PROFITABILITY', priceKey: 'marginEventPrices:', metaKey: 'marginEventMeta:', qpKey: 'marginEventQp:' },
  review: { title: '리뷰이벤트 진행 시 마진', kicker: 'REVIEW EVENT PROFITABILITY', priceKey: 'marginReviewPrices:', metaKey: 'marginReviewMeta:', qpKey: 'marginReviewQp:' },
};
let evMode = 'event';
function setEvMode(mode) {
  evMode = mode; const m = EV_MODES[mode];
  EVENT_KEY = m.priceKey + channel; EVENT_META_KEY = m.metaKey + channel; EVENT_QP_KEY = m.qpKey + channel;
  try { eventQp = JSON.parse(localStorage.getItem(EVENT_QP_KEY) || '{}') || {}; } catch { eventQp = {}; }
  $('#evQpWrap').classList.toggle('hidden', mode !== 'review');
  try { eventPrices = JSON.parse(localStorage.getItem(EVENT_KEY) || '{}') || {}; } catch { eventPrices = {}; }
  try { eventMeta = JSON.parse(localStorage.getItem(EVENT_META_KEY) || '{}') || {}; } catch { eventMeta = {}; }
  evSelected.clear();
  $('#eventTitle').textContent = m.title; $('#eventKicker').textContent = m.kicker;
}
$('#viewTabs').addEventListener('click', e => {
  const b = e.target.closest('.viewTab'); if (!b) return;
  const view = b.dataset.view, ev = view === 'event' || view === 'review';
  $$('.viewTab').forEach(t => t.classList.toggle('active', t === b));
  $('#listPanel').classList.toggle('hidden', ev); $('#eventPanel').classList.toggle('hidden', !ev);
  if (ev) { if (view !== evMode) setEvMode(view); renderEvent(); }
});
$('#evBulkApply').addEventListener('click', () => {
  const mode = $('#evBulkMode').value, val = Number($('#evBulkValue').value);
  const targets = visibleEventRows().filter(r => evSelected.has(r.id) && r.calculated && r.salePrice > 0);
  if (!targets.length) return toast('먼저 상품 앞 체크박스로 할인할 상품을 선택하세요.');
  const qpRaw = evMode === 'review' ? $('#evBulkQp').value : '';
  if (qpRaw !== '' && Number(qpRaw) >= 0) {
    for (const r of targets) { if (Number(qpRaw) > 0) eventQp[r.id] = Number(qpRaw); else delete eventQp[r.id]; }
    saveEventQp();
    if (!(val > 0)) { renderEvent(); return toast(`${targets.length}개 상품에 Q포인트 ${Number(qpRaw)}${CUR_LABEL}을 적용했습니다.`); }
  }
  if (!(val > 0) || (mode === 'pct' && val >= 100)) return toast(mode === 'pct' ? '할인율을 0~100% 사이로 입력하세요.' : '할인 금액을 입력하세요.');
  const whole = cfg.currency === 'JPY';
  let applied = 0, skipped = 0;
  for (const r of targets) {
    let p = mode === 'pct' ? r.salePrice * (1 - val / 100) : r.salePrice - val;
    p = whole ? Math.round(p) : Math.round(p * 100) / 100;
    if (p > 0) { eventPrices[r.id] = p; applied++; } else skipped++;
  }
  saveEventPrices(); renderEvent();
  toast(`${applied}개 상품에 ${mode === 'pct' ? val + '%' : val + CUR_LABEL} 할인을 적용했습니다.${skipped ? ` (할인 후 0 이하 ${skipped}개 제외)` : ''}`);
});
$('#evClear').addEventListener('click', () => {
  if (!Object.keys(eventPrices).length || !confirm('입력한 행사 판매가를 모두 지울까요? (실제 판매가는 바뀌지 않습니다)')) return;
  eventPrices = {}; eventQp = {}; saveEventPrices(); saveEventQp(); renderEvent();
});
['marginSearch','marginFilter','sortBy','sortOrder','lossOnly'].forEach(id => $('#'+id).addEventListener(id==='marginSearch'?'input':'change', renderEvent));
$('#marginRows').addEventListener('click', async e => {
  const b = e.target.closest('[data-qoo-reg]'); if (!b) return;
  const on = b.dataset.qooOn !== '1';
  try {
    const r = await fetch('/api/qm/qoo10-registered', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ productId: b.dataset.qooReg, registered: on }) });
    if (!r.ok) throw new Error();
    qooReg = (await r.json()).items || {}; renderRows(); toast(`큐텐 등록 ${on ? '완료' : '미완료'}로 표시했습니다.`);
  } catch { toast('등록 현황을 저장하지 못했습니다.'); }
});
let toastTimer = null;
function toast(message, ms = 1800) { const el = $('#marginToast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), ms); }
async function loadData(showMessage=false) {
  const [pr, pc] = await Promise.all([fetch('/api/qm/products'), fetch('/api/qm/pricing')]);
  if (!pr.ok || !pc.ok) throw new Error('상품 마진 데이터를 불러오지 못했습니다.');
  products = (await pr.json()).products || []; pricingEntries = (await pc.json()).entries || [];
  buildRows(); renderAll();
  const latest = pricingEntries.filter(e => e.channel === channel).map(e => e.updatedAt).sort().pop();
  $('#updatedLabel').textContent = latest ? `최근 계산 ${new Intl.DateTimeFormat('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(latest))}` : '마진 데이터 미등록';
  if (showMessage) toast('상품 및 마진 데이터를 새로 불러왔습니다.');
}
function downloadCsv() {
  const rows = filteredRows(); if (!rows.length) return toast('다운로드할 상품이 없습니다.');
  const headers = ['상품명','SKU','통화','현지판매가','원화매출','사입원가','택배·포장비','해외배송비','총수수료','광고비','순이익','마진율','판정'];
  const body = rows.map(r => [r.name,r.sku,r.currency,r.salePrice,Math.round(r.revenue),r.productCost,r.packaging,r.shipping,Math.round(r.fee),r.ad,r.calculated?Math.round(r.profit):'',r.calculated?r.margin.toFixed(2):'',r.verdict||''].map(v => `"${String(v??'').replace(/"/g,'""')}"`).join(','));
  const blob = new Blob(['﻿'+[headers.join(','),...body].join('\r\n')],{type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${channel.replace(/\s/g,'_')}_상품마진_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
  toast(`${rows.length}개 마진 데이터를 다운로드했습니다.`);
}
TableSort.init(document.querySelector('#listPanel table'), renderRows);
['sortBy','sortOrder'].forEach(id => $('#'+id).addEventListener('change', () => { TableSort.clear(); evSort.clear(); }));
['marginSearch','marginFilter','sortBy','sortOrder','lossOnly'].forEach(id => $('#'+id).addEventListener(id==='marginSearch'?'input':'change', renderRows));

// ── ERP 원가 조회 ──
// ERP 제품 정보의 패키지 무게(kg)·사이즈(cm)를 현재 채널 폼에 채운다. 값이 없는 항목은 건드리지 않는다.
function applyPackage(pkg) {
  const set = (id, v) => { if (v != null && v !== 0 && $(id)) $(id).value = v; };
  if (isQoo) { set('#qWeightKg', pkg.w); set('#qW', pkg.x); set('#qL', pkg.y); set('#qH', pkg.z); }
}

// 상품 원가조회 하나로 상품을 정한다: ERP에서 고른 제품과 같은 이름/SKU의 상품이 있으면 그것을 쓰고, 없으면 새로 등록한다.
let pendingErpProduct = null;
const normalizeProductName = name => String(name || '').replace(/\s+/g, '').replace(/^오아/, '').toLowerCase();
async function ensureProduct(erp) {
  const found = products.find(p => (p.sku && p.sku === erp.code) || normalizeProductName(p.name) === normalizeProductName(erp.name));
  if (found) return found.id;
  const r = await fetch('/api/qm/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: erp.name, sku: erp.code, brand: '오아' }) });
  const created = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(created.error || '상품을 등록하지 못했습니다.');
  products.unshift(created);
  return created.id;
}
// 구글시트 옵션 칸에 붙여넣을 ERP 상품코드(예: A02262)를 안내 줄에 보여주고 복사 버튼을 단다. lead는 코드 앞에 둘 기존 안내문.
function showMerchandiseCode(hint, mcode, lead) {
  hint.innerHTML = `${lead ? escapeHtml(lead) + '<br>' : ''}ERP 상품코드 <b>${escapeHtml(mcode)}</b> <button type="button" class="ghostBtn" id="copyMerchandiseCode" style="padding:2px 8px;margin-left:6px">복사</button>`;
  hint.className = 'erpHint ok wide';
  hint.querySelector('#copyMerchandiseCode').onclick = async e => {
    try { await navigator.clipboard.writeText(mcode); e.target.textContent = '복사됨 ✓'; }
    catch { e.target.textContent = '복사 실패 — 직접 선택해 복사하세요'; }
  };
}
function wireErpLookup(searchId, resultsId, hintId, costId, onApplied) {
  const input = $('#'+searchId), results = $('#'+resultsId), hint = $('#'+hintId);
  let timer = null;
  function applyRow(b) {
    $('#'+costId).value = Math.round(Number(b.dataset.cost)||0);
    input.value = b.dataset.name;
    pendingErpProduct = { name: b.dataset.name, code: b.dataset.code };
    const pkg = JSON.parse(b.dataset.pkg || 'null');
    if (pkg) applyPackage(pkg);
    hint.textContent = `ERP 적용: ${b.dataset.name} (${b.dataset.code}) · 원가 ${money(b.dataset.cost)} · ${b.dataset.ym} 기준` + (pkg ? ` · 중량·사이즈 자동입력${pkg.d ? ` (같은 모델 ${pkg.d} 값)` : ''}${pkg.s ? ' (⚠ ERP 입력값 확인 필요)' : ''}` : ' · ERP에 패키지 사이즈 미입력');
    hint.className = 'erpHint ok wide';
    // 구글시트 옵션 칸에 붙여넣을 ERP 상품코드(예: A02262). 없으면 표시하지 않는다.
    if (b.dataset.mcode) showMerchandiseCode(hint, b.dataset.mcode, hint.textContent);
    results.classList.add('hidden'); onApplied?.();
  }
  async function run(q) {
    if (!q) { results.classList.add('hidden'); results.innerHTML = ''; return; }
    results.innerHTML = '<div class="erpEmpty">ERP 조회 중…</div>'; results.classList.remove('hidden');
    try {
      const r = await fetch('/api/qm/erp/products?q='+encodeURIComponent(q));
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || '조회 실패');
      const rows = body.products || [];
      results.innerHTML = rows.length ? rows.map(p => `<button type="button" data-cost="${p.cost}" data-code="${escapeHtml(p.productCode)}" data-mcode="${escapeHtml(p.merchandiseCode || '')}" data-ym="${escapeHtml(p.yearMonth)}" data-name="${escapeHtml(p.name)}" data-pkg="${escapeHtml(JSON.stringify(p.weightKg!=null||p.widthCm!=null?{w:p.weightKg,x:p.widthCm,y:p.lengthCm,z:p.heightCm,s:p.packageSuspect,d:p.packageDerivedFrom}:null))}">${escapeHtml(p.name)}<span>${escapeHtml(p.productCode)}${p.merchandiseCode ? ` · 상품코드 ${escapeHtml(p.merchandiseCode)}` : ''} · ${money(p.cost)} · ${escapeHtml(p.yearMonth)}${p.weightKg!=null?` · ${p.weightKg}kg ${p.widthCm??'?'}×${p.lengthCm??'?'}×${p.heightCm??'?'}cm`:''}</span></button>`).join('') : '<div class="erpEmpty">일치하는 ERP 제품이 없습니다.</div>';
      results.querySelectorAll('button').forEach(b => b.onclick = () => applyRow(b));
    } catch (error) {
      hint.textContent = '';
      results.innerHTML = `<div class="erpEmpty">ERP 조회 실패: ${escapeHtml(error.message)}</div>`;
    }
  }
  input.oninput = () => { clearTimeout(timer); const q = input.value.trim(); timer = setTimeout(() => run(q), 300); };
  document.addEventListener('click', e => { if (e.target !== input && !results.contains(e.target)) results.classList.add('hidden'); });
  return q => { input.value = q; run(q); };
}
const runErpCostLookup = wireErpLookup('erpCostSearch','erpCostResults','erpCostHint','costProductCost',() => updateCostCalc());
let erpQuickTimer = null;
$('#marginSearch').addEventListener('input', () => {
  clearTimeout(erpQuickTimer);
  const q = $('#marginSearch').value.trim(), box = $('#erpQuickResults');
  erpQuickTimer = setTimeout(async () => {
    if (!q) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    try {
      const r = await fetch('/api/qm/erp/products?q='+encodeURIComponent(q)); const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || '조회 실패');
      const rows = body.products || [];
      box.innerHTML = rows.length ? rows.map(p => `<button type="button" data-name="${escapeHtml(p.name)}">${escapeHtml(p.name)}<span>${escapeHtml(p.productCode)} · 원가 ${money(p.cost)} · ${escapeHtml(p.yearMonth)}</span></button>`).join('') : '<div class="erpEmpty">일치하는 ERP 제품이 없습니다.</div>';
      box.classList.remove('hidden');
      box.querySelectorAll('button').forEach(b => b.onclick = () => { $('#marginSearch').value = b.dataset.name; box.classList.add('hidden'); renderRows(); });
    } catch (error) { box.innerHTML = `<div class="erpEmpty">ERP 조회 실패: ${escapeHtml(error.message)}</div>`; box.classList.remove('hidden'); }
  }, 300);
});
document.addEventListener('click', e => { if (e.target !== $('#marginSearch') && !$('#erpQuickResults').contains(e.target)) $('#erpQuickResults').classList.add('hidden'); });

// ── 원가 등록/수정 팝업 ──
function costValues() {
  return {
    productId:$('#costProduct').value, channel, currency:$('#costCurrency').value,
    salePrice:Number($('#costSalePrice').value)||0, exchangeRate:Number($('#costExchangeRate').value)||1,
    productCost:Number($('#costProductCost').value)||0, platformFeeRate:Number($('#costFeeRate').value)||0,
    shippingCost:Number($('#costShipping').value)||0, otherCost:Number($('#costPackaging').value)||0,
    adCost:Number($('#costAd').value)||0, targetMarginPercent:Number($('#costTargetMargin').value)||0,
    memo:$('#costMemo').value,
    ...(isQoo ? {
      actualWeightG:Math.round((Number($('#qWeightKg').value)||0)*1000), widthCm:Number($('#qW').value)||0, lengthCm:Number($('#qL').value)||0, heightCm:Number($('#qH').value)||0,
      advertisingPercent:Number($('#qAdRate').value)||0, vatRefundEnabled:$('#qVatRefund').checked,
      shippingCost:0, platformFeeRate:0, adCost:0,
      options:{ categoryFeePercent:Number($('#qCategoryFee').value)||0, overseasSaleFeeApplied:$('#qOverseas').checked, reservationFeeApplied:$('#qReserve').checked, externalAdFeeApplied:$('#qExtAd').checked, megaDiscountFeeApplied:$('#qMega').checked, vatApplied:$('#qVat').checked, exportDeclarationKrw:Number($('#qExport').value)||0, customsApplied:$('#qCustoms').checked, customsThresholdJpy:Number($('#qCustomsThreshold').value)||0, customsRatePercent:Number($('#qCustomsRate').value)||0 },
    } : {}),
  };
}
function renderQooPreview(v) {
  const r = Qoo10MarginCalc.computeQoo10Margin(qooInput(v));
  const jpy = (x, d=0) => x == null ? '-' : `${new Intl.NumberFormat('ko-KR',{minimumFractionDigits:d,maximumFractionDigits:d}).format(x)} JPY`;
  const cls = r.verdict === '목표 달성' ? 'good' : r.verdict === '목표 미달' ? 'warn' : r.verdict === '적자' ? 'bad' : '';
  const hasSale = r.isUsingActualSalePrice;
  $('#costLiveCalc').innerHTML = `
    <div><span>부피중량</span><strong>${r.volumetricWeightKg.toFixed(2)}kg</strong></div>
    <div><span>청구중량</span><strong>${r.chargeableWeightKg.toFixed(2)}kg</strong></div>
    <div><span>KSE 해상 배송비</span><strong>${r.shippingJpy!=null?jpy(r.shippingJpy)+' ('+money(r.shippingKrw)+')':'30kg 초과 · KSE 문의'}</strong></div>
    <div><span>수수료율(VAT 포함)</span><strong>${(r.feeRate*100).toFixed(2)}%</strong></div>
    <div><span>★ 권장 판매가</span><strong>${r.recommendedError?escapeHtml(r.recommendedError):jpy(r.roundedRecommendedJpy)+' ('+money(r.roundedRecommendedJpy*r.exchangeRate)+')'}</strong></div>
    <div><span>등록가(할인 전, 참고)</span><strong>${jpy(r.listingPriceJpy)}</strong></div>
    <div><span>손익분기가</span><strong>${jpy(r.breakEvenJpy)}</strong></div>
    <div><span>관세(JPY)</span><strong>${hasSale?jpy(r.customsJpy):'-'}</strong></div>
    <div><span>정산 예상액</span><strong>${r.settlementJpy!=null?jpy(r.settlementJpy):'-'}</strong></div>
    <div><span>순이익(원)</span><strong>${r.profitKrw!=null?money(r.profitKrw):'-'}</strong></div>
    <div><span>★ 실제 마진율${hasSale?'':' (권장가 기준)'}</span><strong>${r.marginRate!=null?(r.marginRate*100).toFixed(1)+'%':'-'}</strong></div>
    <div class="verdict"><span>판정</span><strong class="${cls}">${r.verdict||'-'}</strong></div>`;
}
function updateCostCalc() {
  const v = costValues();
  if (isQoo) return renderQooPreview(v);
  const r = calcRow(v, {id:v.productId, name:''});
  const recDen = 1 - v.platformFeeRate/100 - v.targetMarginPercent/100;
  const reco = recDen > 0 && v.exchangeRate ? (v.productCost+v.shippingCost+v.otherCost+v.adCost)/v.exchangeRate/recDen : null;
  const cls = r.verdict === '목표 달성' ? 'good' : r.verdict === '목표 미달' ? 'warn' : r.verdict === '적자' ? 'bad' : '';
  $('#costLiveCalc').innerHTML = `
    <div><span>원화 매출</span><strong>${v.salePrice?money(r.revenue):'-'}</strong></div>
    <div><span>총 수수료(원)</span><strong>${v.salePrice?money(r.fee):'-'}</strong></div>
    <div><span>순이익(원)</span><strong>${r.calculated?money(r.profit):'-'}</strong></div>
    <div><span>실제 마진율</span><strong>${r.calculated?r.margin.toFixed(1)+'%':'-'}</strong></div>
    <div><span>권장 판매가</span><strong>${reco!=null?localMoney(reco,v.currency):'수수료+목표마진 100% 이상'}</strong></div>
    <div class="verdict"><span>판정</span><strong class="${cls}">${r.verdict||'-'}</strong></div>`;
}
function openCostDialog(product, entry) {
  $('#costForm').reset();
  $('#costId').value = entry?.id || '';
  $('#costTitle').textContent = entry ? '원가 정보 수정' : '원가 등록';
  $('#costProduct').innerHTML = products.map(p => `<option value="${p.id}">${escapeHtml(p.name)}${p.sku?' · '+escapeHtml(p.sku):''}</option>`).join('');
  pendingErpProduct = null;
  $('#costProduct').value = entry?.productId || '';
  $('#costCurrency').value = cfg.currency;
  $('#costExchangeRate').value = entry?.exchangeRate || cfg.exchangeRate;
  $('#costProductCost').value = entry?.productCost || '';
  $('#costSalePrice').value = entry?.salePrice || '';
  $('#costFeeRate').value = entry ? entry.platformFeeRate : cfg.feeRate;
  $('#costShipping').value = entry?.shippingCost || '';
  $('#costPackaging').value = entry?.otherCost ?? (isQoo ? QCFG.domesticDeliveryPackagingKrw : 3000);
  $('#costAd').value = entry?.adCost || '';
  $('#costTargetMargin').value = entry?.targetMarginPercent ?? DEFAULT_TARGET_MARGIN;
  $('#costMemo').value = entry?.memo || '';
  if (isQoo) {
    const o = entry?.options || {};
    $('#qWeightKg').value = entry?.actualWeightG ? entry.actualWeightG/1000 : '';
    $('#qW').value = entry?.widthCm || ''; $('#qL').value = entry?.lengthCm || ''; $('#qH').value = entry?.heightCm || '';
    $('#qCategoryFee').value = o.categoryFeePercent ?? QCFG.categoryFeePercent;
    $('#qAdRate').value = entry?.advertisingPercent ?? QCFG.advertisingPercent;
    $('#qExport').value = o.exportDeclarationKrw ?? QCFG.exportDeclarationKrw;
    $('#qCustomsThreshold').value = o.customsThresholdJpy ?? QCFG.customsThresholdJpy;
    $('#qCustomsRate').value = o.customsRatePercent ?? QCFG.customsRatePercent;
    $('#qOverseas').checked = o.overseasSaleFeeApplied ?? QCFG.overseasSaleFeeApplied;
    $('#qReserve').checked = o.reservationFeeApplied ?? QCFG.reservationFeeApplied;
    $('#qExtAd').checked = o.externalAdFeeApplied ?? QCFG.externalAdFeeApplied;
    $('#qMega').checked = o.megaDiscountFeeApplied ?? QCFG.megaDiscountFeeApplied;
    $('#qVat').checked = o.vatApplied ?? QCFG.vatApplied;
    $('#qCustoms').checked = o.customsApplied ?? QCFG.customsApplied;
    $('#qVatRefund').checked = entry?.vatRefundEnabled ?? QCFG.vatRefundEnabled;
  }
  $('#deleteCost').classList.toggle('hidden', !entry);
  $('#costError').textContent = '';
  $('#erpCostSearch').value = ''; $('#erpCostResults').classList.add('hidden'); $('#erpCostResults').innerHTML = ''; $('#erpCostHint').textContent = '';
  const selected = products.find(p => p.id === $('#costProduct').value);
  if (selected) {
    $('#erpCostSearch').value = selected.name;
    // 수정 창을 열 때도 ERP 상품코드가 보이게 이름으로 다시 조회한다(그 사이 다른 제품을 골랐으면 덮어쓰지 않음).
    const hint = $('#erpCostHint');
    fetch('/api/qm/erp/products?q=' + encodeURIComponent(selected.name)).then(r => r.json()).then(body => {
      const hit = (body.products || []).find(p => p.name === selected.name);
      if (hit?.merchandiseCode && !hint.textContent.trim() && $('#costDialog').open) showMerchandiseCode(hint, hit.merchandiseCode, '');
    }).catch(() => {});
  }
  updateCostCalc();
  $('#costDialog').showModal();
}
$$('#costForm input:not(#erpCostSearch),#costForm select:not(#costProduct)').forEach(x => x.oninput = updateCostCalc);
$('#closeCost').onclick = $('#cancelCost').onclick = () => $('#costDialog').close();
$('#costForm').onsubmit = async e => {
  e.preventDefault();
  const body = costValues();
  if (pendingErpProduct) { try { body.productId = await ensureProduct(pendingErpProduct); } catch (error) { $('#costError').textContent = error.message; return; } }
  if (!body.productId) { $('#costError').textContent = '상품 원가조회에서 상품을 검색해 선택하세요.'; return; }
  if (isQoo && !(body.actualWeightG > 0)) { $('#costError').textContent = '실중량(kg)을 0보다 크게 입력하세요.'; return; }
  if (!(body.exchangeRate > 0)) { $('#costError').textContent = '환율을 0보다 크게 입력하세요.'; return; }
  const id = $('#costId').value;
  const r = await fetch(id ? '/api/qm/pricing/'+id : '/api/qm/pricing', {method:id?'PUT':'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
  const result = await r.json().catch(() => ({}));
  if (!r.ok) { $('#costError').textContent = result.error || '저장하지 못했습니다.'; return; }
  $('#costDialog').close(); await loadData();
  if (isQoo) toast('원가 정보를 저장했습니다. 구글시트로 보내는 중… (몇 초 걸립니다)', 10000);
  const sheetMsg = isQoo ? await autoPushSheet(result.productId ? result : { ...body, id }) : '';
  toast('원가 정보를 저장했습니다.' + sheetMsg, sheetMsg ? 8000 : 1800);
};
$('#deleteCost').onclick = async () => {
  const id = $('#costId').value;
  if (id && confirm('삭제할까요?')) { await fetch('/api/qm/pricing/'+id, {method:'DELETE'}); $('#costDialog').close(); await loadData(); toast('삭제했습니다.'); }
};
$('#openCostTop').onclick = $('#openCostEmpty').onclick = () => openCostDialog(products[0]||null, null);
$('#openMethod').onclick = () => $('#methodDialog').showModal();
$('#closeMethod').onclick = () => $('#methodDialog').close();
$('#syncProducts').addEventListener('click', () => loadData(true).catch(error => toast(error.message)));
$('#downloadMargins').addEventListener('click', downloadCsv);
// 큐텐 자동등록 구글시트로 판매가격(권장판매가)/소비자가(등록가)/무게(kg) 전송 — 100엔 단위 반올림
function qooSheetItem(e) {
  const r100 = v => Number.isFinite(v) && v > 0 ? Math.round(v / 100) * 100 : null;
  const p = products.find(x => x.id === e.productId); const sku = (p && p.sku) || e.sku || ''; const name = (p && p.name) || '';
  if (!name || !(Number(e.actualWeightG) > 0)) return null;
  const r = Qoo10MarginCalc.computeQoo10Margin(qooInput(e));
  const price = r.recommendedError ? null : r100(r.roundedRecommendedJpy), consumer = r100(r.listingPriceJpy);
  return price ? { sku, name, price, consumer, weightKg: Number(e.actualWeightG) / 1000 } : null;
}
// 원가 저장 시 자동 전송: 저장한 상품 1개의 값을 시트에 덮어씀
async function autoPushSheet(entry) {
  // 판매가격을 계산하지 못해도(실중량 0·권장가 오류 등) 옵션 상품코드는 보낸다. 가격 값이 없으면 서버가 가격 칸은 건드리지 않는다.
  const priced = qooSheetItem(entry);
  const productName = (products.find(x => x.id === entry.productId) || {}).name;
  const item = priced || (productName ? { name: productName, sku: entry.sku || '' } : null);
  if (!item) return '';
  try {
    const res = await fetch('/api/qm/qoo10-push-sheet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [item], overwrite: true }) });
    const d = await res.json().catch(() => ({})); if (!res.ok || d.error || d.ok === false) throw new Error(d.error || '응답 오류');
    let msg = d.updated.length ? ' · 구글시트 반영됨' : priced ? ' · 시트에 같은 폴더명 없음(시트 미반영)' : ' · 판매가격 미계산(가격은 시트에 안 보냄)';
    if (d.optionsNeedUpdate) msg += ' · ⚠ 옵션 상품코드는 구글 Apps Script를 업데이트해야 들어갑니다';
    else if (d.optionsWritten?.length) msg += ` · 옵션 칸에 상품코드 입력(${d.optionsWritten.join(', ')})`;
    return msg;
  } catch (err) { return ' · 구글시트 전송 실패: ' + err.message; }
}
$('#pushSheet').addEventListener('click', async () => {
  const items = pricingEntries.filter(x => x.channel === channel).map(qooSheetItem).filter(Boolean);
  if (!items.length) return toast('보낼 상품이 없습니다.');
  if (!window.confirm(items.length + '개 상품의 판매가격·소비자가·무게를 구글시트의 빈 칸에 채웁니다(이미 값이 있는 칸은 유지). 보낼까요?')) return;
  try {
    const res = await fetch('/api/qm/qoo10-push-sheet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) });
    const d = await res.json(); if (!res.ok || d.error) throw new Error(d.error || res.status);
    toast(`시트 반영 ${d.updated.length}개` + (d.notFound.length ? ` / 시트에 없음 ${d.notFound.length}개: ${d.notFound.slice(0, 5).join(', ')}` : ''));
  } catch (err) { toast('전송 실패: ' + err.message); }
});
loadData().catch(error => { toast(error.message); $('#marginEmpty').classList.remove('hidden'); });

document.addEventListener('change', async e => {
  const el = e.target.closest ? e.target.closest('[data-qoo-code]') : null;
  if (!el) return;
  try {
    const r = await fetch('/api/qm/qoo10-manual-codes', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ productId: el.dataset.qooCode, code: el.value }) });
    if (!r.ok) throw 0;
    qooManual = (await r.json()).items || {};
    document.querySelectorAll('[data-qoo-code]').forEach(o => { if (o !== el && o.dataset.qooCode === el.dataset.qooCode) o.value = el.value; });
    toast('상품코드를 저장했습니다.');
  } catch { toast('상품코드를 저장하지 못했습니다.'); }
});
