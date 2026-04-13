export const dynamic = 'force-dynamic';

function detectChannel(url) {
  if (!url) return null;
  if (url.includes("smartstore.naver.com") || url.includes("brand.naver.com")) return "스마트스토어";
  if (url.includes("coupang.com")) return "쿠팡";
  if (url.includes("musinsa.com")) return "무신사";
  if (url.includes("oliveyoung.co.kr")) return "올리브영";
  if (url.includes("11st.co.kr")) return "11번가";
  if (url.includes("gmarket.co.kr")) return "G마켓";
  if (url.includes("auction.co.kr")) return "옥션";
  if (url.includes("a-bly.com") || url.includes("ably.co.kr")) return "에이블리";
  if (url.includes("zigzag.kr")) return "지그재그";
  return null;
}

const CHANNEL_MALL_MAP = {
  "스마트스토어": ["스마트스토어", "네이버쇼핑"],
  "쿠팡": ["쿠팡"],
  "무신사": ["무신사"],
  "올리브영": ["올리브영"],
  "11번가": ["11번가"],
  "G마켓": ["G마켓", "지마켓"],
  "옥션": ["옥션"],
  "에이블리": ["에이블리"],
  "지그재그": ["지그재그"],
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query   = (searchParams.get("query") || "").trim();
  const url     = searchParams.get("url");
  const channel = searchParams.get("channel");

  if (!query) return Response.json({ error: "제품명(query)을 입력해주세요" }, { status: 400 });

  const clientId     = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return Response.json({ error: "NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 없음" }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=30&sort=sim`,
      {
        headers: {
          "X-Naver-Client-Id":     clientId,
          "X-Naver-Client-Secret": clientSecret,
        },
      }
    );
    if (!res.ok) return Response.json({ error: `네이버 API ${res.status}` }, { status: res.status });

    const data = await res.json();
    const items = (data.items || []).map(item => ({
      title:       item.title?.replace(/<[^>]+>/g, "") || "",
      mallName:    item.mallName || "",
      brand:       item.brand || item.maker || "",
      lprice:      item.lprice ? parseInt(item.lprice) : null,
      hprice:      item.hprice ? parseInt(item.hprice) : null,
      link:        item.link  || "",
      image:       item.image || "",
      productId:   item.productId || "",
    }));

    // 채널 감지 (URL에서 or 파라미터에서)
    const detectedChannel = channel || detectChannel(url);
    const mallKeywords = detectedChannel ? (CHANNEL_MALL_MAP[detectedChannel] || [detectedChannel]) : [];

    // 채널 필터링 — mallName 포함 여부
    const channelItems = mallKeywords.length > 0
      ? items.filter(i => mallKeywords.some(m => (i.mallName||"").includes(m)))
      : items;

    // 채널 매칭 결과가 없으면 전체 결과 사용
    const finalItems = channelItems.length > 0 ? channelItems : items;

    // 가격 범위
    const prices = finalItems.map(i => i.lprice).filter(Boolean);
    const minPrice = prices.length ? Math.min(...prices) : null;
    const maxPrice = prices.length ? Math.max(...prices) : null;
    const avgPrice = prices.length ? Math.round(prices.reduce((a,b)=>a+b,0)/prices.length) : null;

    // 상위 5개 결과
    const top = finalItems.slice(0, 5);

    return Response.json({
      query,
      channel: detectedChannel,
      minPrice,
      maxPrice,
      avgPrice,
      salePrice: minPrice,   // 최저가를 할인가로
      items: top,
      total: finalItems.length,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
