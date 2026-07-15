// 스마트스토어 상품 등록 — 커머스 API (로컬 전용: IP 화이트리스트)
// dry-run 기본: 토큰 + 카테고리 요건 조회 + 페이로드 출력. --live: 이미지 업로드 → POST /external/v2/products (판매대기 SUSPENSION)
// KC인증 등 400 에러 반복 예상 — 에러 바디 전체 덤프. 막히면 폴백: 등록양식 JSON 생성 (--fallback)
// 사용:
//   node scripts/launch/smartstore-register.mjs "제품명" --price 59000 --category-id 50000204 \
//     [--images "a.jpg,b.jpg"] [--detail detail.html] [--stock 100] [--brand 오아] [--launch 런칭명] [--live] [--fallback]
import fs from 'fs';
import { homedir } from 'os';
import { resolve, basename } from 'path';
import { commerceToken, COMMERCE_HOST, patchStage, telegram } from './launch-lib.mjs';

const args = process.argv.slice(2);
const flags = {}; const pos = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--live' || args[i] === '--fallback') flags[args[i].slice(2)] = true;
  else if (args[i].startsWith('--')) { flags[args[i].slice(2)] = args[i + 1]; i++; }
  else pos.push(args[i]);
}
const PRODUCT = pos[0];
const PRICE = Number(flags.price);
const CATEGORY_ID = flags['category-id'];
if (!PRODUCT || !PRICE || !CATEGORY_ID) {
  console.error('사용법: node smartstore-register.mjs "제품명" --price 59000 --category-id 50000204 [--images a.jpg,b.jpg] [--detail detail.html] [--live] [--fallback]');
  process.exit(1);
}
const IMAGES = (flags.images || '').split(',').map(s => s.trim()).filter(Boolean);
const STOCK = Number(flags.stock) || 100;
const BRAND = flags.brand || '오아';
const LAUNCH = flags.launch || PRODUCT;
const LIVE = !!flags.live;

const token = await commerceToken();
const aH = { Authorization: `Bearer ${token}` };
console.log('커머스 토큰 OK');

async function dump(r, label) {
  const text = await r.text();
  let j; try { j = JSON.parse(text); } catch { j = text; }
  if (!r.ok) {
    console.error(`\n[${label}] ${r.status} 에러 바디 전체:\n${typeof j === 'string' ? j : JSON.stringify(j, null, 2)}`);
    throw new Error(`${label} ${r.status}`);
  }
  return j;
}

// ── 카테고리 요건 조회 ──
let catInfo = null, attrs = null;
try {
  catInfo = await dump(await fetch(`${COMMERCE_HOST}/external/v1/categories/${CATEGORY_ID}`, { headers: aH }), '카테고리 조회');
  console.log(`카테고리: ${catInfo?.wholeCategoryName || catInfo?.name || CATEGORY_ID}`);
} catch { console.log('카테고리 조회 실패 — ID 확인 필요'); }
try {
  attrs = await dump(await fetch(`${COMMERCE_HOST}/external/v1/product-attributes/attributes?categoryId=${CATEGORY_ID}`, { headers: aH }), '속성 조회');
  console.log(`카테고리 속성 ${Array.isArray(attrs) ? attrs.length : 0}개 (필수 여부는 등록 에러로 확인)`);
} catch {}

// ── 상세 HTML ──
const detailHtml = flags.detail && fs.existsSync(flags.detail)
  ? fs.readFileSync(flags.detail, 'utf8')
  : `<div style="text-align:center"><h2>${PRODUCT}</h2><p>상세페이지 준비 중입니다.</p></div>`;

// ── 페이로드 (판매대기 SUSPENSION로 생성) ──
const buildPayload = (imageUrls) => ({
  originProduct: {
    statusType: 'SUSPENSION', // 판매대기 — 검수 후 수동으로 판매중 전환
    saleType: 'NEW',
    leafCategoryId: CATEGORY_ID,
    name: PRODUCT,
    detailContent: detailHtml,
    images: imageUrls.length ? { representativeImage: { url: imageUrls[0] }, optionalImages: imageUrls.slice(1).map(url => ({ url })) } : undefined,
    salePrice: PRICE,
    stockQuantity: STOCK,
    deliveryInfo: {
      deliveryType: 'DELIVERY',
      deliveryAttributeType: 'NORMAL',
      deliveryCompany: 'CJGLS',
      deliveryFee: { deliveryFeeType: 'FREE' },
      claimDeliveryInfo: { returnDeliveryFee: 3000, exchangeDeliveryFee: 6000 },
    },
    detailAttribute: {
      afterServiceInfo: { afterServiceTelephoneNumber: '070-4036-1811', afterServiceGuideContent: '고객센터로 문의 주세요' },
      originAreaInfo: { originAreaCode: '03', content: '중국', plural: false }, // 03=수입산
      minorPurchasable: true,
      productInfoProvidedNotice: { productInfoProvidedNoticeType: 'ETC', etc: { itemName: PRODUCT, modelName: PRODUCT, manufacturer: '오아 주식회사', customerServicePhoneNumber: '070-4036-1811' } },
      brandName: BRAND,
      // KC인증 필요 시 400 에러 바디 참고해 certificationTargetExcludeContent 또는 productCertificationInfos 추가
    },
  },
  smartstoreChannelProduct: { naverShoppingRegistration: true, channelProductDisplayStatusType: 'ON' },
});

// ── 폴백: 등록양식 JSON만 생성 ──
if (flags.fallback) {
  const p = resolve(homedir(), 'Downloads', `스토어등록양식_${PRODUCT}.json`);
  fs.writeFileSync(p, JSON.stringify(buildPayload(IMAGES), null, 2));
  console.log(`폴백: 등록양식 JSON 생성 — ${p} (스마트스토어센터에서 수동 등록)`);
  await telegram(`📋 스토어 등록양식 생성(폴백) — ${PRODUCT}\n${p}\nAPI 등록이 막혀 수동 등록 필요`);
  process.exit(0);
}

if (!LIVE) {
  console.log('\n── DRY-RUN 페이로드 ──');
  console.log(JSON.stringify(buildPayload(IMAGES.length ? ['<업로드 후 URL>'] : []), null, 2));
  console.log(`\n이미지 ${IMAGES.length}개 (라이브 시 업로드): ${IMAGES.join(', ') || '없음 — 라이브 전 필수'}`);
  await telegram(`🧪 스토어 등록 dry-run — ${PRODUCT}\n가격 ${PRICE.toLocaleString()}원 · 재고 ${STOCK} · 카테고리 ${CATEGORY_ID}\n이미지 ${IMAGES.length}개\n등록하려면 --live로 재실행 (승인 필요, 판매대기로 생성됨)`);
  console.log('\ndry-run 완료 — 실제 등록하려면 --live 추가 (사용자 승인 후)');
  process.exit(0);
}

// ── LIVE ──
try {
  if (IMAGES.length === 0) throw new Error('대표 이미지 필수 — --images 지정');
  // 1) 이미지 업로드
  const fd = new FormData();
  for (const img of IMAGES) fd.append('imageFiles', new Blob([fs.readFileSync(img)]), basename(img));
  const up = await dump(await fetch(`${COMMERCE_HOST}/external/v1/product-images/upload`, { method: 'POST', headers: aH, body: fd }), '이미지 업로드');
  const urls = (up.images || []).map(i => i.url);
  console.log(`이미지 업로드 ${urls.length}개`);

  // 2) 상품 등록 (판매대기)
  const created = await dump(await fetch(`${COMMERCE_HOST}/external/v2/products`, {
    method: 'POST', headers: { ...aH, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildPayload(urls)),
  }), '상품 등록');
  const productNo = created.originProductNo || created.smartstoreChannelProductNo || null;
  console.log('등록 완료:', JSON.stringify(created, null, 2).slice(0, 500));

  // 3) 상태 확인
  if (created.originProductNo) {
    const check = await fetch(`${COMMERCE_HOST}/external/v2/products/origin-products/${created.originProductNo}`, { headers: aH });
    if (check.ok) console.log('등록 확인 OK (판매대기)');
  }

  await patchStage(LAUNCH, 'store', {
    status: '진행',
    checklist: { images: true, draft: true },
    set: { productNo },
  }).catch(e => console.log(`(런칭 상태 패치 생략: ${e.message})`));
  await telegram(`✅ 스토어 등록 완료 (판매대기) — ${PRODUCT}\n상품번호: ${productNo}\n스마트스토어센터에서 검수 후 판매중으로 전환하세요`);
} catch (e) {
  console.error('\n등록 실패:', e.message);
  console.error('→ 위 에러 바디의 누락 필드(KC인증/원산지 등)를 보완해 재시도하거나, --fallback으로 수동 등록양식 생성');
  await telegram(`❌ 스토어 등록 실패 — ${PRODUCT}\n${e.message.slice(0, 300)}\n(--fallback으로 수동 양식 생성 가능)`);
  await patchStage(LAUNCH, 'store', { status: '차단' }).catch(() => {});
  process.exit(1);
}
