export const dynamic = 'force-dynamic';

const NAVER_ID = process.env.NAVER_CLIENT_ID;
const NAVER_SECRET = process.env.NAVER_CLIENT_SECRET;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get("keyword");
  const platform = searchParams.get("platform"); // naver_channel | coupang | both

  if (!keyword || !platform) return Response.json({ error: "keyword, platform required" }, { status: 400 });

  if (!NAVER_ID || !NAVER_SECRET) {
    return Response.json({ error: "NAVER_API_KEY_MISSING", message: "NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수를 설정해주세요." }, { status: 503 });
  }

  // 쿠팡은 "쿠팡 드라이기" 처럼 앞에 붙여서 검색
  const naverQuery = platform === "coupang" ? `쿠팡 ${keyword}` : keyword;
  const allItems = [];

  for (let start = 1; start <= 301; start += 100) {
    const url = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(naverQuery)}&display=100&start=${start}&sort=sim`;
    try {
      const res = await fetch(url, {
        headers: {
          "X-Naver-Client-Id": NAVER_ID,
          "X-Naver-Client-Secret": NAVER_SECRET,
        },
      });
      if (!res.ok) break;
      const data = await res.json();
      const items = data.items || [];
      if (!items.length) break;
      allItems.push(...items);
      if (items.length < 100) break;
    } catch { break; }
  }

  const results = { naver_channel: [], coupang: [] };
  let naverRank = 0, coupangRank = 0;

  for (const item of allItems) {
    const link = item.link || "";
    const mall = item.mallName || "";
    const name = (item.title || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    const price = parseInt(item.lprice || 0);
    if (!name || !price) continue;

    const prod = {
      name,
      brand: item.brand || item.maker || mall,
      price,
      originalPrice: parseInt(item.hprice || item.lprice || 0) || price,
      image: item.image || "",
      url: link,
      mallName: mall,
    };

    const isNaver = link.includes("smartstore.naver.com") || link.includes("brand.naver.com");
    const isCoupang = link.includes("coupang.com") || mall === "쿠팡" || mall.includes("쿠팡");

    if (isNaver) {
      naverRank++;
      results.naver_channel.push({ ...prod, rank: naverRank });
    }
    if (isCoupang) {
      coupangRank++;
      results.coupang.push({ ...prod, rank: coupangRank });
    }
  }

  if (platform === "both") return Response.json(results);
  return Response.json(results[platform] || []);
}
