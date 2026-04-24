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

PLAYWRIGHT_PLATFORMS = {"musinsa", "oliveyoung", "zigzag", "coupang"}


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
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(2000)

        result = await page.evaluate("""() => {
            const nd = window.__NEXT_DATA__;
            if (nd) {
                const pp = nd?.props?.pageProps || {};
                const p = pp.product || pp.goodsDetail || pp.item || {};
                return {
                    price: p.price || p.salePrice || p.goodsPrice || null,
                    name: p.goodsName || p.name || p.title || null,
                    reviews: p.reviewCount || p.review_count || null,
                    rating: p.reviewScore || p.avgRating || null,
                };
            }
            const priceEl = document.querySelector('#goods_price strong, .price-box .txt-price');
            const reviewEl = document.querySelector('.review-count, [class*="review"] em');
            return {
                price: priceEl ? parseInt(priceEl.textContent.replace(/[^0-9]/g,'')) || null : null,
                reviews: reviewEl ? parseInt(reviewEl.textContent.replace(/[^0-9]/g,'')) || null : null,
                name: null,
                rating: null,
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


SCRAPERS = {
    "musinsa": scrape_musinsa,
    "oliveyoung": scrape_oliveyoung,
    "zigzag": scrape_zigzag,
    "coupang": scrape_coupang,
}


async def main():
    products = await fetch_tracked_products()
    target = [p for p in products if p.get("platform") in PLAYWRIGHT_PLATFORMS]

    if not target:
        print("트래킹할 Playwright 제품이 없습니다.")
        return

    print(f"총 {len(target)}개 제품 트래킹 시작")
    history = await load_history()

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            locale="ko-KR",
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
                    "rank": None,
                    "notes": "",
                    "auto": True,
                }
                history.append(entry)
                print(f"  ✅ 가격={data.get('price')}, 리뷰={data.get('reviews')}, 별점={data.get('rating')}")
            else:
                print(f"  ⚠️ 데이터 없음")

        await browser.close()

    await save_history(history)


if __name__ == "__main__":
    asyncio.run(main())
