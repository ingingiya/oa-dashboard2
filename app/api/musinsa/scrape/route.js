export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import Anthropic from '@anthropic-ai/sdk';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

async function fetchLinks() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/musinsa_links?select=*&active=eq.true&order=id.asc`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  return res.ok ? res.json() : [];
}

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
        const name = product.goodsName || product.name || product.title || "";
        const brand = (typeof product.brand === "object" ? product.brand?.name : product.brand) || product.brandName || "";
        const salePrice = parseInt(product.price || product.salePrice || product.goodsPrice || 0);
        const originalPrice = parseInt(product.originalPrice || product.consumerPrice || salePrice);
        if (name && salePrice) return { name, brand, sale_price: salePrice, original_price: originalPrice };
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
          if (salePrice) return {
            name: ld.name || "",
            brand: typeof ld.brand === "object" ? ld.brand?.name || "" : ld.brand || "",
            sale_price: salePrice,
            original_price: salePrice,
          };
        }
      } catch {}
    }

    // 3) Claude로 HTML 분석
    if (ANTHROPIC_API_KEY) {
      const snippet = html.slice(0, 8000);
      const msg = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{
          role: "user",
          content: `이 무신사 상품 페이지 HTML에서 정보를 추출해줘.\n반드시 JSON만 응답:\n{"brand":"브랜드명","name":"상품명","sale_price":판매가숫자,"original_price":정가숫자}\n가격은 숫자만(쉼표/원 제외). 정가 없으면 sale_price와 동일.\n\nHTML:\n${snippet}`,
        }],
      });
      const text = msg.content[0].text.trim();
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}") + 1;
      if (start >= 0 && end > start) {
        const result = JSON.parse(text.slice(start, end));
        if (result.sale_price) return result;
      }
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

async function findMusinsaRank(keyword, productId) {
  if (!keyword) return null;
  try {
    const res = await fetch(
      `https://api.musinsa.com/api/search/goods?keyword=${encodeURIComponent(keyword)}&page=1&size=60&sortType=SCORE`,
      { headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json", "Referer": "https://www.musinsa.com/" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const items = data?.data?.list || data?.list || data?.goods || [];
    const idx = items.findIndex(item => {
      const id = String(item.goodsNo || item.id || item.productNo || "");
      return id === String(productId);
    });
    return idx >= 0 ? idx + 1 : null;
  } catch { return null; }
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
      const rank = await findMusinsaRank(search_keyword, pid);
      const row = {
        product_id: pid,
        url,
        name: data.name,
        brand: data.brand,
        sale_price: parseInt(data.sale_price),
        original_price: parseInt(data.original_price || data.sale_price),
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
