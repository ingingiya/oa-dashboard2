export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchLinks() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/oliveyoung_links?select=*&active=eq.true&order=id.asc`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  return res.ok ? res.json() : [];
}

async function fetchPrice(pid, url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9", "Referer": "https://www.oliveyoung.co.kr/" },
    });
    const html = await res.text();

    // JSON-LD
    const ldMatches = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
    for (const m of ldMatches) {
      try {
        let ld = JSON.parse(m[1]);
        if (Array.isArray(ld)) ld = ld.find(x => x["@type"] === "Product") || {};
        if (ld["@type"] === "Product") {
          const offer = Array.isArray(ld.offers) ? ld.offers[0] : ld.offers || {};
          const salePrice = parseInt(parseFloat(offer.price || 0));
          if (salePrice) return {
            name: ld.name || "",
            brand: typeof ld.brand === "object" ? ld.brand?.name || "" : ld.brand || "",
            sale_price: salePrice,
            original_price: salePrice,
            image: ld.image?.[0] || ld.image || "",
          };
        }
      } catch {}
    }

    // meta tags fallback
    const nameMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/);
    const imgMatch  = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/);
    const priceMatch = html.match(/["']price["']\s*:\s*([\d.]+)/);
    if (priceMatch) {
      return {
        name: nameMatch?.[1] || "",
        brand: "",
        sale_price: parseInt(priceMatch[1]),
        original_price: parseInt(priceMatch[1]),
        image: imgMatch?.[1] || "",
      };
    }
    return null;
  } catch { return null; }
}

async function findOliveyoungRank(keyword, productId) {
  if (!keyword) return null;
  try {
    const res = await fetch(
      `https://www.oliveyoung.co.kr/store/search/getSearchListAjax.do?query=${encodeURIComponent(keyword)}&rowsPerPage=48&currentPage=1&searchType=ALL`,
      { headers: { "User-Agent": UA, "Accept": "application/json, text/javascript", "Referer": "https://www.oliveyoung.co.kr/", "X-Requested-With": "XMLHttpRequest" } }
    );
    if (!res.ok) return null;
    const text = await res.text();
    const data = JSON.parse(text);
    const items = data?.goodsListDto?.goodsList || data?.list || [];
    const idx = items.findIndex(item => {
      const id = String(item.goodsNo || item.goodsCode || "");
      return id === String(productId);
    });
    return idx >= 0 ? idx + 1 : null;
  } catch { return null; }
}

async function saveToSupabase(row) {
  await fetch(`${SUPABASE_URL}/rest/v1/oliveyoung_prices?on_conflict=product_id`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(row),
  });
}

export async function POST() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return Response.json({ error: "Supabase 설정 없음" }, { status: 500 });
  }

  const links = await fetchLinks();
  if (!links.length) return Response.json({ error: "등록된 링크 없음" }, { status: 400 });

  const results = [];
  const errors = [];

  for (const { product_id: pid, url, search_keyword } of links) {
    const data = await fetchPrice(pid, url);
    if (data?.sale_price) {
      const rank = await findOliveyoungRank(search_keyword, pid);
      const row = {
        product_id: pid,
        url,
        name: data.name,
        brand: data.brand,
        sale_price: parseInt(data.sale_price),
        original_price: parseInt(data.original_price || data.sale_price),
        image: data.image || "",
        rank: rank ?? null,
        collected_at: new Date().toISOString(),
      };
      await saveToSupabase(row);
      results.push(row);
    } else {
      errors.push(pid);
    }
  }

  return Response.json({ ok: true, success: results.length, failed: errors.length, results });
}
