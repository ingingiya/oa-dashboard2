export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const H = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

async function searchNaverShopping(keyword) {
  const url = `https://search.shopping.naver.com/api/search?query=${encodeURIComponent(keyword)}&sort=rel&pagingIndex=1&pagingSize=100&viewType=list&productSet=total`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "ko-KR,ko;q=0.9",
      "Referer": `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(keyword)}`,
      "Origin": "https://search.shopping.naver.com",
    },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const sr = data?.shoppingResult || data?.result || data;
  return sr?.products || sr?.items || data?.products || [];
}

async function saveToSupabase(row) {
  await fetch(`${SUPABASE_URL}/rest/v1/market_prices?on_conflict=platform,product_id`, {
    method: "POST",
    headers: { ...H, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(row),
  });
}

export async function POST() {
  // 1. Coupang 링크 목록 조회
  const linksRes = await fetch(`${SUPABASE_URL}/rest/v1/market_links?platform=eq.coupang&active=eq.true&order=id.asc`, { headers: H });
  const links = await linksRes.json();
  if (!links?.length) return Response.json({ ok: true, collected: 0, message: "수집할 링크 없음" });

  const results = [];
  for (const link of links) {
    const { product_id, url, search_keyword } = link;
    const keyword = search_keyword || product_id;

    try {
      const prods = await searchNaverShopping(keyword);
      let found = null;

      for (const p of prods) {
        const pLink = p.mallProductUrl || p.link || "";
        const mall = p.mallName || p.storeName || "";
        if (pLink.includes("coupang.com") || mall === "쿠팡") {
          const name = (p.productTitle || p.title || "").replace(/<[^>]+>/g, "");
          const price = parseInt(p.price || p.lprice || 0);
          if (name && price) {
            found = {
              platform: "coupang",
              product_id,
              url: pLink || url,
              name,
              brand: p.brand || "",
              sale_price: price,
              original_price: price,
              image: p.imageUrl || p.image || "",
              collected_at: new Date().toISOString(),
            };
            break;
          }
        }
      }

      if (found) {
        await saveToSupabase(found);
        results.push({ product_id, name: found.name, price: found.sale_price });
      } else {
        results.push({ product_id, error: `네이버쇼핑에 쿠팡 상품 없음 (키워드: ${keyword})` });
      }
    } catch (e) {
      results.push({ product_id, error: e.message });
    }
  }

  const success = results.filter(r => !r.error).length;
  return Response.json({ ok: true, collected: success, total: links.length, results });
}
