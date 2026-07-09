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

// 오가닉 순위 + 광고 슬롯 순위 분리 계산. items: [{brand,title,isAd}]
function rankOf(p, items) {
  const out = { rank: null, title: null, adRank: null, adTitle: null, total: 0, adTotal: 0 };
  for (const it of items) {
    if (it.isAd) {
      out.adTotal++;
      if (out.adRank == null && p.match(it.brand, it.title)) { out.adRank = out.adTotal; out.adTitle = it.title; }
    } else {
      out.total++;
      if (out.rank == null && p.match(it.brand, it.title)) { out.rank = out.total; out.title = it.title; }
    }
  }
  return out;
}

async function checkMusinsa(p) {
  const url = `https://api.musinsa.com/api2/dp/v1/plp/goods?gf=A&keyword=${encodeURIComponent(p.keyword)}&sortCode=POPULAR&page=1&size=100&caller=SEARCH`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`musinsa ${res.status}`);
  const data = await res.json();
  return rankOf(p, (data?.data?.list || []).map(g => ({
    brand: g.brandName || g.brand || "", title: g.goodsName || "", isAd: !!g.isAd,
  })));
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
  return rankOf(p, (data?.data?.search_result?.ui_item_list || []).filter(i => i.title).map(i => ({
    brand: i.shop_name || "", title: i.title || "", isAd: !!i.aid,
  })));
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
      if (typeof o.name === "string" && (o.market_name || o.sno)) goods.push(o);
      Object.values(o).forEach(walk);
    }
  })(data.components || []);
  return rankOf(p, goods.map(g => ({
    brand: g.market_name || "", title: g.name || "", isAd: !!g.ad,
  })));
}

async function checkNaver(p, origin) {
  const brand = p === PRODUCTS.prion ? "프리온" : "오아";
  const res = await fetch(`${origin}/api/naver-rank?query=${encodeURIComponent(p.keyword)}&brand=${encodeURIComponent(brand)}`);
  if (!res.ok) throw new Error(`naver ${res.status}`);
  const data = await res.json();
  // topItems에 isAd 포함 (스크래핑 성공 시) — openapi 폴백은 광고 정보 없음
  const r = rankOf(p, (data.topItems || []).map(i => ({
    brand: `${i.brand || ""} ${i.mallName || ""} ${i.maker || ""}`, title: i.title || "", isAd: !!i.isAd,
  })));
  return { ...r, rank: data.rank ?? r.rank, title: data.matchedProduct ?? r.title };
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
