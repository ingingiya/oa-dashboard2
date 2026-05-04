// Coupang Partners API search
export const dynamic = 'force-dynamic';

const ACCESS_KEY = process.env.COUPANG_ACCESS_KEY;
const SECRET_KEY = process.env.COUPANG_SECRET_KEY;

function hmacSHA256(secret, message) {
  const crypto = require("crypto");
  return crypto.createHmac("sha256", secret).update(message).digest("hex");
}

function getCoupangAuthHeader(method, path, query) {
  // Coupang requires: yyyyMMddTHHmmssZ (keep T and Z)
  const datetime = new Date().toISOString().replace(/\.\d{3}/, "").replace(/[-:]/g, "");
  const message = datetime + method + path + (query ? "?" + query : "");
  const signature = hmacSHA256(SECRET_KEY, message);
  return {
    datetime,
    auth: `CEA algorithm=HmacSHA256, access-key=${ACCESS_KEY}, signed-date=${datetime}, signature=${signature}`,
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get("keyword");

  if (!keyword) return Response.json({ error: "keyword required" }, { status: 400 });
  if (!ACCESS_KEY || !SECRET_KEY) {
    return Response.json({ error: "COUPANG_API_KEY_MISSING" }, { status: 503 });
  }

  const allResults = [];
  const limit = 100;

  for (let page = 1; page <= 3; page++) {
    const query = `keyword=${encodeURIComponent(keyword)}&limit=${limit}&page=${page}&sortType=BEST_SELLING`;
    const path = "/v2/providers/affiliate_open_api/apis/openapi/products/search";
    const { datetime, auth } = getCoupangAuthHeader("GET", path, query);

    try {
      const res = await fetch(`https://api-gateway.coupang.com${path}?${query}`, {
        headers: {
          "Authorization": auth,
          "Content-Type": "application/json;charset=UTF-8",
          "X-Coupang-Date": datetime,
        },
      });
      const text = await res.text();
      if (!res.ok) {
        console.error("Coupang API error:", res.status, text.slice(0, 300));
        break;
      }
      const data = JSON.parse(text);
      const items = data?.data?.productData || data?.productData || [];
      if (!items.length) break;
      allResults.push(...items);
      if (items.length < limit) break;
    } catch(e) { console.error("Coupang fetch error:", e.message); break; }
  }

  const results = allResults.map((item, i) => {
    const price = parseInt(item.salePrice || item.productPrice || 0);
    const originalPrice = parseInt(item.normalPrice || item.productPrice || price);
    return {
      rank: i + 1,
      name: (item.productName || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"),
      brand: item.productTypeName || "",
      price,
      originalPrice,
      image: item.productImage || "",
      url: item.productUrl || item.deepLink || "",
      mallName: "쿠팡",
      isAd: false,
    };
  }).filter(item => item.price > 0 && item.name);

  return Response.json(results);
}
