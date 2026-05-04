export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const OA_IDENTIFIERS = ["오아", "oa뷰티", "oabeauty", "oa beauty", "소닉플로우", "프리온", "에어리소닉"];

function matchesBrand(item, brandKw) {
  const kw = brandKw.toLowerCase();
  const fields = [item.brand, item.maker, item.mallName, item.storeName]
    .map(f => (f || "").toLowerCase());
  const titleLower = (item.title || item.productTitle || "").toLowerCase();

  if (kw === "오아" || kw === "oa") {
    return [...fields, titleLower].some(f => OA_IDENTIFIERS.some(id => f.includes(id)));
  }
  return [...fields, titleLower].some(f => f.includes(kw));
}

let _firstRawProduct = null; // 디버그용

// 네이버 쇼핑 실제 검색 결과 스크래핑 (최대 3페이지 = 300개)
async function scrapeNaverShopping(query) {
  const PAGE_SIZE = 100;
  const MAX_PAGES = 3;
  const allProducts = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `https://search.shopping.naver.com/api/search?query=${encodeURIComponent(query)}&sort=rel&pagingIndex=${page}&pagingSize=${PAGE_SIZE}&viewType=list&productSet=total`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "ko-KR,ko;q=0.9",
        "Referer": `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(query)}`,
        "Origin": "https://search.shopping.naver.com",
      },
    });

    if (!res.ok) throw new Error(`쇼핑 스크래핑 실패: ${res.status}`);
    const data = await res.json();

    const shoppingResult = data?.shoppingResult || data?.result || data;
    const products = shoppingResult?.products || shoppingResult?.items || data?.products || [];

    if (!products.length) break;

    if (page === 1 && products[0]) _firstRawProduct = products[0]; // 디버그

    products.forEach((p) => {
      const link = p.mallProductUrl || p.link || "";
      const isCatalog = link.includes("search.shopping.naver.com/catalog/") || p.mallName === "네이버";
      allProducts.push({
        rank: allProducts.length + 1,
        title: (p.productTitle || p.title || "").replace(/<[^>]+>/g, ""),
        brand: p.brand || p.maker || "",
        mallName: p.mallName || p.storeName || "",
        maker: p.maker || "",
        lprice: p.price ? parseInt(p.price) : (p.lprice ? parseInt(p.lprice) : null),
        link,
        image: p.imageUrl || p.image || "",
        isAd: !!(p.adId || p.isAd || p.adProductId),
        isCatalog,
        mallCount: null,
        reviewCount: p.reviewCount != null ? parseInt(p.reviewCount) : null,
        reviewScore: p.reviewScore != null ? parseFloat(p.reviewScore) : (p.starScore != null ? parseFloat(p.starScore) : null),
      });
    });
  }

  return allProducts;
}

// 기존 네이버 오픈 API (폴백용)
async function fetchNaverApi(query, clientId, clientSecret) {
  const res = await fetch(
    `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=100&sort=sim`,
    {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
    }
  );
  if (!res.ok) throw new Error(`네이버 API 오류: ${res.status}`);
  const data = await res.json();
  return (data.items || []).map((p, i) => {
    const link = p.link || "";
    const isCatalog = link.includes("search.shopping.naver.com/catalog/") || p.mallName === "네이버";
    return {
      rank: i + 1,
      title: (p.title || "").replace(/<[^>]+>/g, ""),
      brand: p.brand || p.maker || "",
      mallName: p.mallName || "",
      maker: p.maker || "",
      lprice: p.lprice ? parseInt(p.lprice) : null,
      link,
      image: p.image || "",
      isAd: false,
      isCatalog,
      mallCount: null,
    };
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query   = searchParams.get("query");
  const brandKw = (searchParams.get("brand") || "오아").toLowerCase();

  if (!query) return Response.json({ error: "query 파라미터 필요" }, { status: 400 });

  const clientId     = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  let items = [];
  let source = "scrape";

  try {
    items = await scrapeNaverShopping(query);
  } catch (e) {
    if (clientId && clientSecret) {
      try {
        items = await fetchNaverApi(query, clientId, clientSecret);
        source = "api";
      } catch (e2) {
        return Response.json({ error: e2.message, rank: null }, { status: 500 });
      }
    } else {
      return Response.json({ error: e.message, rank: null }, { status: 500 });
    }
  }

  // 광고 제외하고 순위 재계산
  let organicRank = 0;
  const topItems = items.slice(0, 300).map(item => {
    if (!item.isAd) organicRank++;
    return {
      ...item,
      organicRank: item.isAd ? null : organicRank,
      isTarget: matchesBrand(item, brandKw),
    };
  });

  let rank = null;
  let matchedProduct = null;
  let matchedMall = null;

  for (const item of topItems) {
    if (!item.isAd && matchesBrand(item, brandKw)) {
      rank = item.organicRank;
      matchedProduct = item.title;
      matchedMall    = item.mallName;
      break;
    }
  }

  const organicTotal = items.filter(i => !i.isAd).length;

  return Response.json({ query, rank, matchedProduct, matchedMall, total: organicTotal, topItems, source });
}
