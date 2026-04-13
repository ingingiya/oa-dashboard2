export const dynamic = 'force-dynamic';

const OA_IDENTIFIERS = ["오아", "oa ", "oa뷰티", "oabeauty", "oa beauty", "소닉플로우", "프리온", "에어리소닉"];

function matchesBrand(item, brandKw) {
  const kw = brandKw.toLowerCase();
  // brand, maker, mallName 우선 (title 제외 — 타사 제품 제목에 브랜드명 포함 방지)
  const strongFields = [item.brand, item.maker, item.mallName]
    .map(f => (f || "").replace(/<[^>]+>/g, "").toLowerCase());
  if (kw === "오아" || kw === "oa") {
    const allFields = [...strongFields, (item.title||"").toLowerCase()];
    return allFields.some(f => OA_IDENTIFIERS.some(id => f.includes(id)));
  }
  return strongFields.some(f => f.includes(kw));
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query    = searchParams.get("query");
  const brandKw  = (searchParams.get("brand") || "오아").toLowerCase();

  if (!query) return Response.json({ error: "query 파라미터 필요" }, { status: 400 });

  const clientId     = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return Response.json({ error: "NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 없음" }, { status: 500 });
  }

  try {
    // 최대 100개 (네이버 API 최대값)
    const res = await fetch(
      `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=100&sort=sim`,
      {
        headers: {
          "X-Naver-Client-Id":     clientId,
          "X-Naver-Client-Secret": clientSecret,
        },
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: `네이버 API 오류: ${err}` }, { status: res.status });
    }

    const data = await res.json();
    const items = data.items || [];

    let rank = null;
    let matchedProduct = null;
    let matchedMall = null;

    for (let i = 0; i < items.length; i++) {
      if (matchesBrand(items[i], brandKw)) {
        rank = i + 1;
        matchedProduct = items[i].title?.replace(/<[^>]+>/g, "") || "";
        matchedMall    = items[i].mallName || "";
        break;
      }
    }

    // 상위 30개 요약 (경쟁사 분석용)
    const topItems = items.slice(0, 30).map((item, i) => ({
      rank: i + 1,
      mallName: item.mallName || "",
      brand: item.brand || item.maker || "",
      title: item.title?.replace(/<[^>]+>/g, "") || "",
      lprice: item.lprice ? parseInt(item.lprice) : null,
      link: item.link || "",
      image: item.image || "",
      isTarget: matchesBrand(item, brandKw),
    }));

    return Response.json({ query, rank, matchedProduct, matchedMall, total: items.length, topItems });
  } catch (e) {
    return Response.json({ error: e.message, rank: null }, { status: 500 });
  }
}
