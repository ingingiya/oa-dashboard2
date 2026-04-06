import asyncio
import json
import os
import re
from datetime import datetime

import httpx
from playwright.async_api import async_playwright

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")


# ── Supabase에서 링크 목록 가져오기 ──────────────────
async def fetch_links():
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/musinsa_links?select=*&active=eq.true&order=id.asc",
            headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
        )
        if res.status_code == 200:
            return res.json()
        print(f"링크 목록 불러오기 실패: {res.status_code}")
        return []


# ── DOM에서 가격 추출 ─────────────────────────────────
async def extract_price(page, pid: str) -> dict:
    print(f"  🔍 가격 추출: {pid}")

    # 1) window.__NEXT_DATA__
    try:
        next_data = await page.evaluate("() => JSON.stringify(window.__NEXT_DATA__)")
        if next_data:
            d = json.loads(next_data)
            pp = d.get("props", {}).get("pageProps", {})
            product = pp.get("product") or pp.get("goodsDetail") or pp.get("item") or {}
            if product:
                name = product.get("goodsName") or product.get("name") or product.get("title", "")
                brand = (
                    product.get("brandName")
                    or (product.get("brand", {}).get("name", "") if isinstance(product.get("brand"), dict) else product.get("brand", ""))
                )
                original_price = int(product.get("price") or product.get("originalPrice") or product.get("consumerPrice") or 0)
                sale_price = int(product.get("salePrice") or product.get("immediateDiscountedPrice") or product.get("goodsPrice") or original_price or 0)
                image = (
                    product.get("thumbnailImageUrl") or product.get("thumbnail")
                    or product.get("mainImageUrl") or product.get("imageUrl")
                    or ((product.get("goodsImages") or [{}])[0].get("imageUrl", ""))
                    or ""
                )
                # 세일기간 from __NEXT_DATA__
                sale_period = ""
                try:
                    coupon = product.get("coupon") or product.get("event") or product.get("promotion") or {}
                    if isinstance(coupon, dict):
                        end = coupon.get("endDate") or coupon.get("end_date") or coupon.get("expireDate") or ""
                        start = coupon.get("startDate") or coupon.get("start_date") or ""
                        if start and end:
                            sale_period = f"{start[:10]} ~ {end[:10]}"
                        elif end:
                            sale_period = f"~ {end[:10]}"
                except Exception:
                    pass
                if name and sale_price:
                    return {"brand": brand, "name": name, "sale_price": sale_price, "original_price": original_price, "image": image, "sale_period": sale_period}
    except Exception as e:
        print(f"    ⚠️  __NEXT_DATA__ 실패: {e}")

    # 2) JSON-LD
    try:
        html = await page.content()
        ld_matches = re.findall(r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, re.DOTALL)
        for ld_str in ld_matches:
            ld = json.loads(ld_str.strip())
            if isinstance(ld, list):
                ld = next((x for x in ld if x.get("@type") == "Product"), {})
            if ld.get("@type") == "Product":
                offer = ld.get("offers", {})
                if isinstance(offer, list):
                    offer = offer[0]
                sale_price = int(float(offer.get("price", 0)))
                sale_period = ""
                valid_through = offer.get("validThrough") or offer.get("priceValidUntil") or ""
                if valid_through:
                    sale_period = f"~ {valid_through[:10]}"
                return {
                    "brand": ld.get("brand", {}).get("name", "") if isinstance(ld.get("brand"), dict) else ld.get("brand", ""),
                    "name": ld.get("name", ""),
                    "sale_price": sale_price,
                    "original_price": sale_price,
                    "sale_period": sale_period,
                }
    except Exception as e:
        print(f"    ⚠️  JSON-LD 실패: {e}")

    # 3) DOM 셀렉터
    try:
        result = await page.evaluate("""() => {
            const selectors = ['[class*="price"]','[class*="Price"]','.c-product__price','[data-price]'];
            for (const sel of selectors) {
                const els = document.querySelectorAll(sel);
                for (const el of els) {
                    const text = el.innerText || el.textContent || '';
                    const match = text.match(/[0-9,]+/);
                    if (match) {
                        const price = parseInt(match[0].replace(/,/g, ''));
                        if (price > 1000) {
                            const nameEl = document.querySelector('h1, [class*="name"], [class*="Name"], [class*="title"]');
                            const brandEl = document.querySelector('[class*="brand"], [class*="Brand"]');
                            return {
                                brand: brandEl ? brandEl.innerText.trim() : '',
                                name: nameEl ? nameEl.innerText.trim().slice(0, 80) : '',
                                sale_price: price,
                                original_price: price,
                            };
                        }
                    }
                }
            }
            return null;
        }""")
        if result:
            return result
    except Exception as e:
        print(f"    ⚠️  DOM 셀렉터 실패: {e}")

    return {}


async def find_rank(page, keyword: str, product_id: str):
    if not keyword:
        return None
    try:
        from urllib.parse import quote
        search_url = f"https://www.musinsa.com/search/?q={quote(keyword)}&type=goods"
        await page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(2000)
        rank = await page.evaluate("""(pid) => {
            const links = Array.from(document.querySelectorAll('a[href*="/products/"]'));
            const seen = new Set();
            let pos = 0;
            for (const a of links) {
                const m = a.href.match(/\/products\/(\d+)/);
                if (!m) continue;
                if (seen.has(m[1])) continue;
                seen.add(m[1]);
                pos++;
                if (m[1] === pid) return pos;
            }
            return null;
        }""", product_id)
        return rank
    except Exception as e:
        print(f"    ⚠️  순위 검색 실패: {e}")
        return None


# ── Supabase 저장 ─────────────────────────────────────
async def save_to_supabase(data: dict):
    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{SUPABASE_URL}/rest/v1/musinsa_prices",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates",
            },
            json=data,
        )
        if res.status_code in (200, 201):
            print(f"  ✅ Supabase 저장 완료")
        else:
            print(f"  ❌ Supabase 오류: {res.status_code} {res.text}")


# ── 메인 ─────────────────────────────────────────────
async def main():
    print(f"\n🚀 무신사 가격 수집 시작 ({datetime.now().strftime('%Y-%m-%d %H:%M')})")

    links = await fetch_links()
    if not links:
        print("❌ 수집할 링크 없음")
        return

    print(f"총 {len(links)}개 상품\n")
    results = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 900},
        )
        await context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        )
        page = await context.new_page()

        for i, link in enumerate(links):
            pid = link["product_id"]
            url = link["url"]
            keyword = link.get("search_keyword") or ""
            print(f"[{i+1}/{len(links)}] pid: {pid}")
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=60000)
                await page.wait_for_timeout(3000)

                price_data = await extract_price(page, pid)

                if price_data and price_data.get("sale_price"):
                    row = {
                        "product_id": pid,
                        "url": url,
                        "name": price_data.get("name", ""),
                        "brand": price_data.get("brand", ""),
                        "sale_price": int(price_data["sale_price"]),
                        "original_price": int(price_data.get("original_price", price_data["sale_price"])),
                        "image": price_data.get("image", ""),
                        "sale_period": price_data.get("sale_period", ""),
                        "collected_at": datetime.utcnow().isoformat(),
                    }
                    print(f"  📦 {row['brand']} - {row['name']}")
                    print(f"  💰 판매가: {row['sale_price']:,}원 / 정가: {row['original_price']:,}원")
                    if row["sale_period"]:
                        print(f"  📅 세일기간: {row['sale_period']}")

                    if keyword:
                        print(f"  🔍 순위 검색: '{keyword}'")
                        rank = await find_rank(page, keyword, pid)
                        row["rank"] = rank
                        print(f"  🏆 순위: {rank}위" if rank else "  ⚠️  순위 없음 (검색 결과 밖)")
                    else:
                        row["rank"] = None

                    await save_to_supabase(row)
                    results.append(row)
                else:
                    print(f"  ❌ 가격 추출 실패")

            except Exception as e:
                print(f"  ❌ 오류: {e}")

            await asyncio.sleep(2)

        await browser.close()

    print(f"\n✅ 완료: {len(results)}/{len(links)}개 성공")
    with open("results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print("📄 results.json 저장됨")


if __name__ == "__main__":
    asyncio.run(main())
