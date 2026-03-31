export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const LINKS = [
  { pid: "5485556", url: "https://www.musinsa.com/products/5485556" },
  { pid: "3774961", url: "https://www.musinsa.com/products/3774961" },
  { pid: "4173791", url: "https://www.musinsa.com/products/4173791" },
  { pid: "3702722", url: "https://www.musinsa.com/products/3702722" },
  { pid: "5485742", url: "https://www.musinsa.com/products/5485742" },
  { pid: "4270193", url: "https://www.musinsa.com/products/4270193" },
  { pid: "3620953", url: "https://www.musinsa.com/products/3620953" },
];

async function fetchPrice(pid, url) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9",
      },
    });
    const html = await res.text();

    // 1) __NEXT_DATA__
    const nextMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextMatch) {
      try {
        const d = JSON.parse(nextMatch[1]);
        const pp = d?.props?.pageProps || {};
        const product = pp.product || pp.goodsDetail || pp.item || {};
        if (product) {
          const name = product.goodsName || product.name || product.title || "";
          const brand = (typeof product.brand === "object" ? product.brand?.name : product.brand) || product.brandName || "";
          const salePrice = parseInt(product.price || product.salePrice || product.goodsPrice || 0);
          const originalPrice = parseInt(product.originalPrice || product.consumerPrice || salePrice);
          if (name && salePrice) return { name, brand, sale_price: salePrice, original_price: originalPrice };
        }
      } catch {}
    }

    // 2) JSON-LD
    const ldMatches = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
    for (const m of ldMatches) {
      try {
        let ld = JSON.parse(m[1]);
        if (Array.isArray(ld)) ld = ld.find(x => x["@type"] === "Product") || {};
        if (ld["@type"] === "Product") {
          const offer = Array.isArray(ld.offers) ? ld.offers[0] : ld.offers || {};
          const salePrice = parseInt(parseFloat(offer.price || 0));
          return {
            name: ld.name || "",
            brand: typeof ld.brand === "object" ? ld.brand?.name || "" : ld.brand || "",
            sale_price: salePrice,
            original_price: salePrice,
          };
        }
      } catch {}
    }

    return null;
  } catch (e) {
    console.error(`pid ${pid} 오류:`, e.message);
    return null;
  }
}

async function saveToSupabase(row) {
  await fetch(`${SUPABASE_URL}/rest/v1/musinsa_prices`, {
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

  const results = [];
  const errors = [];

  for (const { pid, url } of LINKS) {
    const data = await fetchPrice(pid, url);
    if (data && data.sale_price) {
      const row = {
        product_id: pid,
        url,
        name: data.name,
        brand: data.brand,
        sale_price: data.sale_price,
        original_price: data.original_price,
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
