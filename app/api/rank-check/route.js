export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// 채널별 검색 순위 자동 조회 (쿠팡은 봇 차단으로 불가 — 수동 기록)
// GET /api/rank-check?product=dryer|prion

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const OA_IDS = ["오아", "소닉플로우", "에어리", "슈퍼플로우", "씬플로우", "슬림에어", "프리온", "oa뷰티", "oabeauty"];

// product별 검색어 + 매칭 규칙
const PRODUCTS = {
  dryer: {
    keyword: "드라이기",
    match: (brand, title) => {
      const t = (brand + " " + title).toLowerCase();
      return OA_IDS.some(id => t.includes(id)) && /드라이/.test(title) && !/거치대|스탠드/.test(title);
    },
  },
  prion: {
    keyword: "무선 고데기",
    match: (brand, title) => (brand + " " + title).toLowerCase().includes("프리온"),
  },
};

async function checkMusinsa(p) {
  const url = `https://api.musinsa.com/api2/dp/v1/plp/goods?gf=A&keyword=${encodeURIComponent(p.keyword)}&sortCode=POPULAR&page=1&size=100&caller=SEARCH`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`musinsa ${res.status}`);
  const data = await res.json();
  const list = (data?.data?.list || []).filter(g => !g.isAd); // 광고 제외
  for (let i = 0; i < list.length; i++) {
    const g = list[i];
    if (p.match(g.brandName || g.brand || "", g.goodsName || "")) {
      return { rank: i + 1, title: g.goodsName, total: list.length };
    }
  }
  return { rank: null, total: list.length };
}

async function checkZigzag(p) {
  const res = await fetch("https://api.zigzag.kr/api/2/graphql/GetSearchResult", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify({
      query: "query GetSearchResult($input: SearchResultInput!) { search_result(input: $input) { ui_item_list { __typename ... on UxGoodsCardItem { shop_name title aid } } } }",
      variables: { input: { page_id: "search_result", q: p.keyword } },
    }),
  });
  if (!res.ok) throw new Error(`zigzag ${res.status}`);
  const data = await res.json();
  if (data.errors) throw new Error(data.errors[0]?.message || "zigzag graphql error");
  const goods = (data?.data?.search_result?.ui_item_list || []).filter(i => i.title && !i.aid); // 광고 제외
  for (let i = 0; i < goods.length; i++) {
    if (p.match(goods[i].shop_name || "", goods[i].title || "")) {
      return { rank: i + 1, title: goods[i].title, total: goods.length };
    }
  }
  return { rank: null, total: goods.length };
}

async function checkAbly(p) {
  const tokRes = await fetch("https://api.a-bly.com/api/v2/anonymous/token/", { headers: { "User-Agent": UA } });
  if (!tokRes.ok) throw new Error(`ably token ${tokRes.status}`);
  const { token } = await tokRes.json();
  // 에이블리는 공백 포함 검색어에서 결과가 비어 나옴 → 공백 제거
  const res = await fetch(`https://api.a-bly.com/api/v2/screens/SEARCH_RESULT/?query=${encodeURIComponent(p.keyword.replace(/\s+/g, ""))}&search_type=DIRECT`, {
    headers: { "X-Anonymous-Token": token, "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`ably ${res.status}`);
  const data = await res.json();
  const goods = [];
  (function walk(o) {
    if (Array.isArray(o)) return o.forEach(walk);
    if (o && typeof o === "object") {
      if (typeof o.name === "string" && (o.market_name || o.sno) && !o.ad) goods.push(o); // 광고 제외
      Object.values(o).forEach(walk);
    }
  })(data.components || []);
  for (let i = 0; i < goods.length; i++) {
    if (p.match(goods[i].market_name || "", goods[i].name || "")) {
      return { rank: i + 1, title: goods[i].name, total: goods.length };
    }
  }
  return { rank: null, total: goods.length };
}

async function checkNaver(p, origin) {
  const brand = p === PRODUCTS.prion ? "프리온" : "오아";
  const res = await fetch(`${origin}/api/naver-rank?query=${encodeURIComponent(p.keyword)}&brand=${encodeURIComponent(brand)}`);
  if (!res.ok) throw new Error(`naver ${res.status}`);
  const data = await res.json();
  return { rank: data.rank, title: data.matchedProduct, total: data.total };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("product") || "dryer";
  const p = PRODUCTS[key];
  if (!p) return Response.json({ error: "product=dryer|prion" }, { status: 400 });

  const origin = new URL(request.url).origin;
  const tasks = {
    네이버: () => checkNaver(p, origin),
    지그재그: () => checkZigzag(p),
    에이블리: () => checkAbly(p),
    무신사: () => checkMusinsa(p),
  };
  const entries = await Promise.all(Object.entries(tasks).map(async ([ch, fn]) => {
    try { return [ch, await fn()]; }
    catch (e) { return [ch, { rank: null, error: e.message }]; }
  }));
  return Response.json({ product: key, keyword: p.keyword, channels: Object.fromEntries(entries) });
}
