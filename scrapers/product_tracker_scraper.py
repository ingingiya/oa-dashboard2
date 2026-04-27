"""
제품 트래킹 스크래퍼
Supabase의 oa_tracked_products_v1에서 제품 목록을 읽어
각 제품의 가격/순위/리뷰수를 수집하고 oa_tracked_history_v1에 저장합니다.
지원 플랫폼: musinsa, oliveyoung, zigzag, coupang (Playwright 필요)
"""
import asyncio
import json
import os
import re
from datetime import datetime

import httpx
from playwright.async_api import async_playwright

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
TODAY = datetime.now().strftime("%Y-%m-%d")

SB_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

PLAYWRIGHT_PLATFORMS = {"musinsa", "oliveyoung", "zigzag", "coupang", "naver"}


async def fetch_tracked_products():
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/settings?key=eq.oa_tracked_products_v1&select=value",
            headers=SB_HEADERS,
        )
        if res.status_code == 200:
            rows = res.json()
            if rows:
                val = rows[0].get("value")
                if isinstance(val, list):
                    return val
                if isinstance(val, str):
                    return json.loads(val)
        print(f"tracked products 로드 실패: {res.status_code}")
        return []


async def load_history():
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/settings?key=eq.oa_tracked_history_v1&select=value",
            headers=SB_HEADERS,
        )
        if res.status_code == 200:
            rows = res.json()
            if rows:
                val = rows[0].get("value")
                if isinstance(val, list):
                    return val
                if isinstance(val, str):
                    return json.loads(val)
        return []


async def save_history(history):
    async with httpx.AsyncClient() as client:
        # upsert into settings table
        res = await client.post(
            f"{SUPABASE_URL}/rest/v1/settings",
            headers={**SB_HEADERS, "Prefer": "resolution=merge-duplicates"},
            json={"key": "oa_tracked_history_v1", "value": history},
        )
        if res.status_code not in (200, 201):
            print(f"히스토리 저장 실패: {res.status_code} {res.text}")
        else:
            print(f"히스토리 저장 완료 ({len(history)}개)")


async def scrape_musinsa(page, prod):
    url = prod.get("url", "")
    if not url:
        return None
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(3000)

        # 1) __NEXT_DATA__
        result = await page.evaluate("""() => {
            try {
                const nd = window.__NEXT_DATA__;
                if (nd) {
                    const pp = nd?.props?.pageProps || {};
                    const p = pp.product || pp.goodsDetail || pp.item || {};
                    const price = parseInt(p.salePrice || p.immediateDiscountedPrice || p.goodsPrice || p.price || 0) || null;
                    if (price) return {
                        price,
                        reviews: p.reviewCount || p.review_count || null,
                        rating: p.reviewScore || p.avgRating || null,
                    };
                }
            } catch(e) {}
            return null;
        }""")

        # 2) JSON-LD 폴백
        if not result:
            html = await page.content()
            import re as _re
            for m in _re.finditer(r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, _re.DOTALL):
                try:
                    import json as _json
                    ld = _json.loads(m.group(1).strip())
                    if isinstance(ld, list):
                        ld = next((x for x in ld if x.get("@type") == "Product"), {})
                    if ld.get("@type") == "Product":
                        offer = ld.get("offers", {})
                        if isinstance(offer, list): offer = offer[0]
                        price = int(float(offer.get("price", 0))) or None
                        result = {"price": price, "reviews": None, "rating": None}
                        break
                except Exception:
                    pass

        if result:
            return {
                "price": result.get("price"),
                "reviews": result.get("reviews"),
                "rating": result.get("rating"),
                "likes": None,
            }
    except Exception as e:
        print(f"  무신사 스크래핑 오류 ({url}): {e}")
    return None


async def scrape_oliveyoung(page, prod):
    url = prod.get("url", "")
    if not url:
        return None
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(2000)

        result = await page.evaluate("""() => {
            const priceEl = document.querySelector('.price-2 strong, .prd-price .tx-cur');
            const reviewEl = document.querySelector('.review-count, .tx-point');
            const ratingEl = document.querySelector('.score-star .inner, .rating-num');
            return {
                price: priceEl ? parseInt(priceEl.textContent.replace(/[^0-9]/g,'')) || null : null,
                reviews: reviewEl ? parseInt(reviewEl.textContent.replace(/[^0-9,]/g,'').replace(',','')) || null : null,
                rating: ratingEl ? parseFloat(ratingEl.textContent) || null : null,
            };
        }""")
        if result:
            return {
                "price": result.get("price"),
                "reviews": result.get("reviews"),
                "rating": result.get("rating"),
                "likes": None,
            }
    except Exception as e:
        print(f"  올리브영 스크래핑 오류 ({url}): {e}")
    return None


async def scrape_zigzag(page, prod):
    url = prod.get("url", "")
    if not url:
        return None
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(2500)

        result = await page.evaluate("""() => {
            const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
            for (const s of scripts) {
                try {
                    const d = JSON.parse(s.textContent);
                    if (d['@type'] === 'Product') {
                        const offer = d.offers;
                        return {
                            price: offer?.price ? parseInt(offer.price) : null,
                            rating: d.aggregateRating?.ratingValue || null,
                            reviews: d.aggregateRating?.reviewCount || null,
                        };
                    }
                } catch(e) {}
            }
            const priceEl = document.querySelector('[class*="price"],[data-tid*="price"]');
            return {
                price: priceEl ? parseInt(priceEl.textContent.replace(/[^0-9]/g,'')) || null : null,
                rating: null,
                reviews: null,
            };
        }""")
        if result:
            return {
                "price": result.get("price"),
                "reviews": result.get("reviews"),
                "rating": result.get("rating"),
                "likes": None,
            }
    except Exception as e:
        print(f"  지그재그 스크래핑 오류 ({url}): {e}")
    return None


async def scrape_coupang(page, prod):
    url = prod.get("url", "")
    if not url:
        return None
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(2000)

        result = await page.evaluate("""() => {
            const priceEl = document.querySelector('.prod-price .total-price strong, .price-value');
            const reviewEl = document.querySelector('.rating-total-count, [class*="ratingCount"]');
            const ratingEl = document.querySelector('.rating-star-num');
            return {
                price: priceEl ? parseInt(priceEl.textContent.replace(/[^0-9]/g,'')) || null : null,
                reviews: reviewEl ? parseInt(reviewEl.textContent.replace(/[^0-9]/g,'')) || null : null,
                rating: ratingEl ? parseFloat(ratingEl.textContent) || null : null,
            };
        }""")
        if result:
            return {
                "price": result.get("price"),
                "reviews": result.get("reviews"),
                "rating": result.get("rating"),
                "likes": None,
            }
    except Exception as e:
        print(f"  쿠팡 스크래핑 오류 ({url}): {e}")
    return None


OA_IDENTIFIERS = ["오아", "oa뷰티", "oabeauty", "oa beauty", "소닉플로우", "프리온", "에어리소닉"]


async def naver_rank_search(keyword: str, brand: str):
    """네이버 쇼핑 검색 API로 순위·가격 조회 (httpx 사용)"""
    url = f"https://search.shopping.naver.com/api/search?query={keyword}&sort=rel&pagingIndex=1&pagingSize=100&viewType=list&productSet=total"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "ko-KR,ko;q=0.9",
        "Referer": f"https://search.shopping.naver.com/search/all?query={keyword}",
        "Origin": "https://search.shopping.naver.com",
    }
    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.get(url, headers=headers)
        if res.status_code != 200:
            return None, None, None

    data = res.json()
    products = (data.get("shoppingResult") or data.get("result") or data).get("products", [])

    brand_lower = brand.lower()
    organic_rank = 0
    for p in products:
        is_ad = bool(p.get("adId") or p.get("isAd") or p.get("adProductId"))
        if not is_ad:
            organic_rank += 1
        fields = [(p.get(f) or "").lower() for f in ["brand", "maker", "mallName", "storeName"]]
        title = (p.get("productTitle") or p.get("title") or "").lower()

        if brand_lower in ("오아", "oa"):
            matched = any(ident in " ".join(fields + [title]) for ident in OA_IDENTIFIERS)
        else:
            matched = any(brand_lower in f for f in fields + [title])

        if matched and not is_ad:
            price = p.get("price") or p.get("lprice")
            return organic_rank, int(price) if price else None, p.get("productTitle") or p.get("title")

    return None, None, None


async def scrape_naver(page, prod):
    keyword = prod.get("keyword", "")
    brand = prod.get("brand", prod.get("name", ""))
    url = prod.get("url", "")

    rank, price, matched_name = None, None, None

    # 1) 키워드 있으면 순위·가격 HTTP 검색
    if keyword:
        try:
            rank, price, matched_name = await naver_rank_search(keyword, brand)
            print(f"  순위={rank}, 가격={price}, 매칭={matched_name}")
        except Exception as e:
            print(f"  네이버 순위 검색 오류: {e}")

    # 2) 스마트스토어 URL 있으면 Playwright로 리뷰·별점 수집
    reviews, rating, likes = None, None, None
    if url:
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(3000)

            result = await page.evaluate("""() => {
                try {
                    const nd = window.__NEXT_DATA__;
                    if (nd) {
                        const pp = nd?.props?.pageProps || {};
                        const product = pp.product || pp.initialState?.product?.productDetail?.product || {};
                        const rv = pp.reviewSummary || pp.initialState?.review?.reviewSummary || pp.initialState?.product?.reviewSummary || {};
                        return {
                            price: product.salePrice || product.discountedSalePrice || product.price || null,
                            reviews: rv.totalReviewCount ?? rv.reviewCount ?? null,
                            rating: rv.averageReviewScore ? parseFloat(rv.averageReviewScore) : null,
                            likes: product.wish || product.wishCount || null,
                        };
                    }
                } catch(e) {}
                const reviewEl = document.querySelector('[class*="reviewCount"], [class*="totalReviewCount"]');
                const ratingEl = document.querySelector('[class*="averageScore"], [class*="ratingScore"]');
                return {
                    price: null,
                    reviews: reviewEl ? parseInt(reviewEl.textContent.replace(/[^0-9]/g,'')) || null : null,
                    rating: ratingEl ? parseFloat(ratingEl.textContent) || null : null,
                    likes: null,
                };
            }""")
            if result:
                reviews = result.get("reviews")
                rating = result.get("rating")
                likes = result.get("likes")
                if not price and result.get("price"):
                    price = result.get("price")
        except Exception as e:
            print(f"  네이버 스마트스토어 스크래핑 오류 ({url}): {e}")

    if rank is None and price is None and reviews is None:
        return None

    return {"rank": rank, "price": price, "reviews": reviews, "rating": rating, "likes": likes}


SCRAPERS = {
    "musinsa": scrape_musinsa,
    "oliveyoung": scrape_oliveyoung,
    "zigzag": scrape_zigzag,
    "coupang": scrape_coupang,
    "naver": scrape_naver,
}


async def main():
    products = await fetch_tracked_products()
    print(f"전체 등록 제품: {len(products)}개")
    for p in products:
        print(f"  - [{p.get('platform')}] {p.get('name')} url={p.get('url','(없음)')[:60]}")

    # 네이버는 키워드만 있어도 처리 가능 (URL 없어도 순위 검색), 나머지는 URL 필수
    target = [
        p for p in products
        if (p.get("platform") == "naver" and p.get("keyword"))
        or (p.get("platform") in PLAYWRIGHT_PLATFORMS and p.get("platform") != "naver" and p.get("url"))
    ]

    if not target:
        print("트래킹할 제품이 없습니다. (네이버: 키워드 필요 / 무신사 등: URL 필요)")
        return

    print(f"총 {len(target)}개 제품 트래킹 시작")
    history = await load_history()

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            locale="ko-KR",
            viewport={"width": 1280, "height": 900},
        )
        await context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        )
        page = await context.new_page()

        for prod in target:
            platform = prod.get("platform")
            scraper_fn = SCRAPERS.get(platform)
            if not scraper_fn:
                continue

            print(f"[{platform}] {prod.get('name', prod.get('id'))}")
            data = await scraper_fn(page, prod)

            if data:
                entry = {
                    "id": f"{prod['id']}_{TODAY}_{int(datetime.now().timestamp())}",
                    "productId": prod["id"],
                    "date": TODAY,
                    "price": data.get("price"),
                    "reviews": data.get("reviews"),
                    "rating": data.get("rating"),
                    "likes": data.get("likes"),
                    "rank": data.get("rank"),
                    "notes": "",
                    "auto": True,
                }
                history.append(entry)
                print(f"  ✅ 순위={data.get('rank')}, 가격={data.get('price')}, 리뷰={data.get('reviews')}, 별점={data.get('rating')}")
            else:
                print(f"  ⚠️ 데이터 없음")

        await browser.close()

    await save_history(history)


if __name__ == "__main__":
    asyncio.run(main())
