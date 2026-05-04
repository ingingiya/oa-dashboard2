export const dynamic = 'force-dynamic';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const HEADERS = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword');
  if (!keyword) return Response.json({ error: 'keyword required' }, { status: 400 });

  try {
    const url = `https://www.amazon.com/s?k=${encodeURIComponent(keyword)}&s=review-rank`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return Response.json({ error: `Amazon ${res.status}` }, { status: 502 });
    const html = await res.text();

    // 모든 매치 위치 먼저 수집 (블록 안에 중복 패턴이 있어서 indexOf 불가, 인접 매치 사이를 블록으로 사용)
    const re = /data-asin="([A-Z0-9]{10})"[^>]*data-component-type="s-search-result"/g;
    const matches = [];
    let m;
    while ((m = re.exec(html)) !== null) matches.push({ index: m.index, asin: m[1] });

    const results = [];
    for (let i = 0; i < Math.min(10, matches.length); i++) {
      let rank = i + 1;
      const asin = matches[i].asin;
      const start = matches[i].index;
      const end = matches[i + 1]?.index ?? start + 40000;
      const block = html.slice(start, end);

      // 상품명: h2 aria-label
      const name = block.match(/h2[^>]*aria-label="([^"]{5,200})"/)?.[1]
                || block.match(/<h2[^>]*>[\s\S]*?<span>([^<]{5,150})<\/span>/)?.[1]?.trim()
                || "";

      // 가격
      const price = block.match(/<span class="a-offscreen">([^<]+)<\/span>/)?.[1] || "";

      // 별점
      const rating = block.match(/([0-9.]+) out of 5 stars/)?.[1] || "";

      // 리뷰수
      const reviews = block.match(/aria-label="([0-9,]+) ratings?"/)?.[1] || "";

      // 이미지
      const image = block.match(/s-image"[^>]*src="([^"]+)"/)?.[1] || "";

      // 상품 링크
      const path = block.match(/href="(\/[^"]+\/dp\/[A-Z0-9]{10}[^"]*)"/)?.[1] || "";
      const link = path ? `https://www.amazon.com${path.split('?')[0]}` : `https://www.amazon.com/dp/${asin}`;

      // 가격 숫자 변환 (KRW 36,089 → 36089)
      const priceNum = parseInt(price.replace(/[^0-9]/g, '')) || 0;

      if (name) {
        results.push({
          rank,
          asin,
          name,
          price: priceNum,
          originalPrice: priceNum,
          priceLabel: price,        // 원본 표시용 (KRW / $)
          rating: parseFloat(rating) || 0,
          reviews: parseInt(reviews.replace(/,/g, '')) || 0,
          image,
          url: link,
          brand: "",
          mallName: "Amazon",
        });
      }
    }

    return Response.json(results);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
