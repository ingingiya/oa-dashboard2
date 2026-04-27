export const dynamic = 'force-dynamic';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function detectPlatform(url) {
  if (url.includes('musinsa.com')) return 'musinsa';
  if (url.includes('smartstore.naver.com')) return 'naver';
  if (url.includes('shopping.naver.com')) return 'naver';
  if (url.includes('coupang.com')) return 'coupang';
  if (url.includes('oliveyoung.co.kr')) return 'oliveyoung';
  if (url.includes('zigzag.kr')) return 'zigzag';
  return 'unknown';
}

async function fetchMusinsa(url) {
  // 상품 ID 추출
  const idMatch = url.match(/goods[\/=](\d+)/);
  if (!idMatch) return { error: '상품 ID 추출 실패' };
  const goodsId = idMatch[1];

  const res = await fetch(`https://www.musinsa.com/app/goods/${goodsId}`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' },
  });
  if (!res.ok) return { error: `무신사 ${res.status}` };
  const html = await res.text();

  const name = html.match(/<h2 class="product_title[^"]*"[^>]*>\s*<em[^>]*>([^<]+)<\/em>/)?.[1]?.trim()
    || html.match(/<title>([^<|]+)/)?.[1]?.trim() || '';
  const price = html.match(/id="goods_price"[^>]*>\s*<strong[^>]*>([\d,]+)/)?.[1]?.replace(/,/g, '') || '';
  const brand = html.match(/class="brand[^"]*"[^>]*>\s*<a[^>]*>([^<]+)<\/a>/)?.[1]?.trim() || '';
  const reviews = html.match(/구매후기\s*<span[^>]*>([\d,]+)/)?.[1]?.replace(/,/g,'') || '';
  const rating = html.match(/class="review_grade[^"]*"[^>]*>([\d.]+)/)?.[1] || '';
  const likes = html.match(/좋아요\s*<em[^>]*>([\d,]+)/)?.[1]?.replace(/,/g,'') || '';

  return { name, brand, price: price ? parseInt(price) : null, reviews: reviews ? parseInt(reviews) : null, rating: rating ? parseFloat(rating) : null, likes: likes ? parseInt(likes) : null, platform: 'musinsa', goodsId };
}

async function fetchNaver(url) {
  // 스마트스토어 URL에서 channelUrl, productNo 추출
  // 예: https://smartstore.naver.com/oabeauty/products/12345678
  const urlMatch = url.match(/smartstore\.naver\.com\/([^/?#]+)\/products\/(\d+)/);
  if (!urlMatch) return { error: '스마트스토어 URL 형식 오류' };
  const [, channelUrl, productNo] = urlMatch;

  const H = {
    'User-Agent': UA,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'Referer': `https://smartstore.naver.com/${channelUrl}/products/${productNo}`,
  };

  let channelUid = null, name = '', price = null, reviews = null, rating = null;

  // 1) 채널 정보로 channelUid 조회
  try {
    const chRes = await fetch(`https://smartstore.naver.com/i/v1/channels/v2/${channelUrl}`, { headers: H });
    if (chRes.ok) {
      const chData = await chRes.json();
      channelUid = chData?.channel?.channelUid || chData?.channelUid || null;
    }
  } catch(_) {}

  // 2) 상품 상세 (가격·이름)
  try {
    const prodRes = await fetch(
      `https://smartstore.naver.com/i/v1/products/${productNo}`,
      { headers: H }
    );
    if (prodRes.ok) {
      const pd = await prodRes.json();
      const p = pd?.product || pd;
      name = p?.name || p?.productName || '';
      price = p?.salePrice || p?.discountedSalePrice || p?.price || null;
    }
  } catch(_) {}

  // 3) 리뷰 요약
  if (channelUid) {
    try {
      const rvRes = await fetch(
        `https://smartstore.naver.com/i/v1/review/summary/channels/${channelUid}/products/${productNo}`,
        { headers: H }
      );
      if (rvRes.ok) {
        const rv = await rvRes.json();
        const s = rv?.reviewSummary || rv;
        reviews = s?.totalReviewCount ?? s?.reviewCount ?? null;
        rating = s?.averageReviewScore != null ? parseFloat(s.averageReviewScore) : null;
      }
    } catch(_) {}
  }

  // 4) 리뷰 폴백: 리뷰 카운트 API
  if (reviews == null) {
    try {
      const cntRes = await fetch(
        `https://smartstore.naver.com/i/v1/review/count/product?productNos=${productNo}`,
        { headers: H }
      );
      if (cntRes.ok) {
        const cnt = await cntRes.json();
        const item = Array.isArray(cnt) ? cnt[0] : cnt;
        reviews = item?.totalCount ?? item?.count ?? null;
      }
    } catch(_) {}
  }

  return { name, price, reviews, rating, platform: 'naver' };
}

async function fetchCoupang(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' },
  });
  if (!res.ok) return { error: `쿠팡 ${res.status}` };
  const html = await res.text();

  const name = html.match(/<title>([^<|]+)/)?.[1]?.trim() || '';
  const price = html.match(/priceValue[^>]*>([\d,]+)/)?.[1]?.replace(/,/g,'') || html.match(/"finalPrice"\s*:\s*(\d+)/)?.[1] || '';
  const reviews = html.match(/totalReviewCount[^>]*>([\d,]+)/)?.[1]?.replace(/,/g,'') || '';
  const rating = html.match(/averageRating[^"]*"([\d.]+)/)?.[1] || '';

  return { name, price: price ? parseInt(price) : null, reviews: reviews ? parseInt(reviews) : null, rating: rating ? parseFloat(rating) : null, platform: 'coupang' };
}

export async function POST(request) {
  const { url } = await request.json();
  if (!url) return Response.json({ error: 'url 필요' }, { status: 400 });

  const platform = detectPlatform(url);
  try {
    let data;
    if (platform === 'musinsa') data = await fetchMusinsa(url);
    else if (platform === 'naver') data = await fetchNaver(url);
    else if (platform === 'coupang') data = await fetchCoupang(url);
    else data = { platform, name: '', price: null, reviews: null, rating: null };

    return Response.json({ ...data, platform, url });
  } catch (e) {
    return Response.json({ error: e.message, platform, url }, { status: 500 });
  }
}
