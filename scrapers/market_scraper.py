#!/usr/bin/env python3
"""
시장가/순위 통합 스크래퍼
사용: python market_scraper.py [platform]
platform: musinsa | oliveyoung | zigzag | ably | kakao_gift
"""
import asyncio, json, os, re, sys
from datetime import datetime
from urllib.parse import quote

import httpx
from playwright.async_api import async_playwright

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
PLATFORM = sys.argv[1] if len(sys.argv) > 1 else "musinsa"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

PLATFORM_NAMES = {
    "musinsa": "무신사", "oliveyoung": "올리브영",
    "zigzag": "지그재그", "ably": "에이블리", "kakao_gift": "카카오선물하기",
}


async def fetch_links():
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/market_links?platform=eq.{PLATFORM}&active=eq.true&order=id.asc",
            headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
        )
        return res.json() if res.status_code == 200 else []


async def save_to_supabase(data: dict):
    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{SUPABASE_URL}/rest/v1/market_prices?on_conflict=platform,product_id",
            headers={
                "apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates",
            },
            json=data,
        )
        print(f"  {'✅' if res.status_code in (200,201) else '❌'} Supabase: {res.status_code}")


# ── 무신사 ───────────────────────────────────────────
async def extract_musinsa(page, pid):
    try:
        nd = await page.evaluate("() => JSON.stringify(window.__NEXT_DATA__)")
        if nd:
            d = json.loads(nd)
            pp = d.get("props", {}).get("pageProps", {})
            p = pp.get("product") or pp.get("goodsDetail") or pp.get("item") or {}
            if p:
                brand = p.get("brandName") or (p.get("brand", {}).get("name", "") if isinstance(p.get("brand"), dict) else p.get("brand", ""))
                sale = int(p.get("price") or p.get("salePrice") or p.get("goodsPrice") or 0)
                orig = int(p.get("originalPrice") or p.get("consumerPrice") or sale)
                img = p.get("thumbnailImageUrl") or p.get("thumbnail") or ((p.get("goodsImages") or [{}])[0].get("imageUrl", ""))
                name = p.get("goodsName") or p.get("name") or ""
                if name and sale:
                    return {"name": name, "brand": brand, "sale_price": sale, "original_price": orig, "image": img or ""}
    except Exception as e:
        print(f"    ⚠️ 추출 실패: {e}")
    return {}


async def find_rank_musinsa(page, keyword, pid):
    try:
        await page.goto(f"https://www.musinsa.com/search/?q={quote(keyword)}&type=goods", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(2000)
        return await page.evaluate("""(pid) => {
            const links = Array.from(document.querySelectorAll('a[href*="/products/"]'));
            const seen = new Set(); let pos = 0;
            for (const a of links) {
                const m = a.href.match(/\/products\/(\d+)/);
                if (!m || seen.has(m[1])) continue;
                seen.add(m[1]); pos++;
                if (m[1] === pid) return pos;
            }
            return null;
        }""", pid)
    except Exception as e:
        print(f"    ⚠️ 순위 실패: {e}"); return None


# ── 올리브영 ─────────────────────────────────────────
async def extract_oliveyoung(page, pid):
    try:
        result = await page.evaluate("""() => {
            const p = el => { if (!el) return 0; const m = (el.innerText||'').replace(/[^0-9]/g,''); return m ? parseInt(m) : 0; };
            const nameEl = document.querySelector('[class*="GoodsDetailInfo_title"], .prd-name, .goods-name');
            const brandEl = document.querySelector('[class*="TopUtils_btn-brand"], .prd-brand, .brand-name');
            const saleEl = document.querySelector('[class*="GoodsDetailInfo_price__"]');
            const origEl = document.querySelector('[class*="price-before"]');
            let sale = p(saleEl), orig = p(origEl);
            if (!sale && orig) sale = orig;
            if (!orig || orig < sale) orig = sale;
            let image = '';
            for (const el of document.querySelectorAll('img')) {
                if ((el.src||'').includes('cfimages/cf-goods')) { image = el.src; break; }
            }
            return { name: nameEl?.innerText?.trim()||'', brand: brandEl?.innerText?.trim()||'', sale_price: sale, original_price: orig, image };
        }""")
        if result and result.get("sale_price"): return result
    except Exception as e:
        print(f"    ⚠️ 추출 실패: {e}")
    return {}


async def find_rank_oliveyoung(page, keyword, pid):
    try:
        await page.goto(f"https://www.oliveyoung.co.kr/store/search/getSearchMain.do?query={quote(keyword)}&rowsPerPage=48", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(2000)
        return await page.evaluate("""(pid) => {
            const links = Array.from(document.querySelectorAll('a[href*="goodsNo="]'));
            const seen = new Set(); let pos = 0;
            for (const a of links) {
                const m = a.href.match(/goodsNo=([A-Z0-9]+)/i);
                if (!m || seen.has(m[1])) continue;
                seen.add(m[1]); pos++;
                if (m[1] === pid) return pos;
            }
            return null;
        }""", pid)
    except Exception as e:
        print(f"    ⚠️ 순위 실패: {e}"); return None


# ── 지그재그 ─────────────────────────────────────────
async def extract_zigzag(page, pid):
    try:
        nd = await page.evaluate("() => JSON.stringify(window.__NEXT_DATA__)")
        if nd:
            d = json.loads(nd)
            pp = d.get("props", {}).get("pageProps", {})
            p = pp.get("product") or pp.get("item") or pp.get("catalog") or {}
            name = p.get("name") or p.get("title") or ""
            brand = p.get("brand") or (p.get("store", {}).get("name", "") if isinstance(p.get("store"), dict) else "")
            sale = int(p.get("price") or p.get("salePrice") or p.get("discountedPrice") or 0)
            orig = int(p.get("originalPrice") or p.get("retailPrice") or sale)
            img = p.get("image") or p.get("thumbnail") or p.get("imageUrl") or ""
            if name and sale:
                return {"name": name, "brand": brand, "sale_price": sale, "original_price": orig, "image": img}
    except Exception as e:
        print(f"    ⚠️ 추출 실패(NEXT_DATA): {e}")
    try:
        html = await page.content()
        for ld_str in re.findall(r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, re.DOTALL):
            ld = json.loads(ld_str.strip())
            if isinstance(ld, list): ld = next((x for x in ld if x.get("@type") == "Product"), {})
            if ld.get("@type") == "Product":
                offer = ld.get("offers", {}); offer = offer[0] if isinstance(offer, list) else offer
                price = int(float(offer.get("price", 0)))
                if price: return {"name": ld.get("name",""), "brand": (ld.get("brand",{}).get("name","") if isinstance(ld.get("brand"),dict) else ""), "sale_price": price, "original_price": price, "image": ""}
    except: pass
    return {}


async def find_rank_zigzag(page, keyword, pid):
    try:
        await page.goto(f"https://zigzag.kr/search?q={quote(keyword)}", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(3000)
        return await page.evaluate("""(pid) => {
            const links = Array.from(document.querySelectorAll('a[href*="/catalog/products/"]'));
            const seen = new Set(); let pos = 0;
            for (const a of links) {
                const m = a.href.match(/\/catalog\/products\/(\d+)/);
                if (!m || seen.has(m[1])) continue;
                seen.add(m[1]); pos++;
                if (m[1] === pid) return pos;
            }
            return null;
        }""", pid)
    except Exception as e:
        print(f"    ⚠️ 순위 실패: {e}"); return None


# ── 에이블리 ─────────────────────────────────────────
async def extract_ably(page, pid):
    try:
        nd = await page.evaluate("() => JSON.stringify(window.__NEXT_DATA__)")
        if nd:
            d = json.loads(nd)
            pp = d.get("props", {}).get("pageProps", {})
            p = pp.get("goods") or pp.get("product") or pp.get("item") or {}
            name = p.get("name") or p.get("goods_name") or ""
            brand = (p.get("market", {}).get("name", "") if isinstance(p.get("market"), dict) else p.get("brand", ""))
            sale = int(p.get("price") or p.get("sale_price") or 0)
            orig = int(p.get("retail_price") or p.get("original_price") or sale)
            img = p.get("cover_image") or p.get("image") or ""
            if name and sale:
                return {"name": name, "brand": brand, "sale_price": sale, "original_price": orig, "image": img}
    except Exception as e:
        print(f"    ⚠️ 추출 실패: {e}")
    return {}


async def find_rank_ably(page, keyword, pid):
    try:
        await page.goto(f"https://m.a-bly.com/search?query={quote(keyword)}", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(3000)
        return await page.evaluate("""(pid) => {
            const links = Array.from(document.querySelectorAll('a[href*="/goods/"]'));
            const seen = new Set(); let pos = 0;
            for (const a of links) {
                const m = a.href.match(/\/goods\/(\d+)/);
                if (!m || seen.has(m[1])) continue;
                seen.add(m[1]); pos++;
                if (m[1] === pid) return pos;
            }
            return null;
        }""", pid)
    except Exception as e:
        print(f"    ⚠️ 순위 실패: {e}"); return None


# ── 카카오선물하기 ────────────────────────────────────
async def extract_kakao_gift(page, pid):
    try:
        nd = await page.evaluate("() => JSON.stringify(window.__NEXT_DATA__)")
        if nd:
            d = json.loads(nd)
            pp = d.get("props", {}).get("pageProps", {})
            p = pp.get("product") or pp.get("item") or {}
            name = p.get("name") or p.get("productName") or ""
            brand = (p.get("brand", {}).get("name", "") if isinstance(p.get("brand"), dict) else p.get("brandName", ""))
            sale = int(p.get("price") or p.get("salePrice") or 0)
            orig = int(p.get("originalPrice") or sale)
            img = p.get("image") or p.get("thumbnailUrl") or ""
            if name and sale:
                return {"name": name, "brand": brand, "sale_price": sale, "original_price": orig, "image": img}
    except Exception as e:
        print(f"    ⚠️ 추출 실패: {e}")
    try:
        html = await page.content()
        for ld_str in re.findall(r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, re.DOTALL):
            ld = json.loads(ld_str.strip())
            if isinstance(ld, list): ld = next((x for x in ld if x.get("@type") == "Product"), {})
            if ld.get("@type") == "Product":
                offer = ld.get("offers", {}); offer = offer[0] if isinstance(offer, list) else offer
                price = int(float(offer.get("price", 0)))
                if price: return {"name": ld.get("name",""), "brand": "", "sale_price": price, "original_price": price, "image": ""}
    except: pass
    return {}


async def find_rank_kakao_gift(page, keyword, pid):
    try:
        await page.goto(f"https://gift.kakao.com/search/product?query={quote(keyword)}", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(3000)
        return await page.evaluate("""(pid) => {
            const links = Array.from(document.querySelectorAll('a[href*="/product/"]'));
            const seen = new Set(); let pos = 0;
            for (const a of links) {
                const m = a.href.match(/\/product\/(\d+)/);
                if (!m || seen.has(m[1])) continue;
                seen.add(m[1]); pos++;
                if (m[1] === pid) return pos;
            }
            return null;
        }""", pid)
    except Exception as e:
        print(f"    ⚠️ 순위 실패: {e}"); return None


# ── 플랫폼 매핑 ──────────────────────────────────────
EXTRACTORS  = {"musinsa": extract_musinsa, "oliveyoung": extract_oliveyoung, "zigzag": extract_zigzag, "ably": extract_ably, "kakao_gift": extract_kakao_gift}
RANK_FINDERS = {"musinsa": find_rank_musinsa, "oliveyoung": find_rank_oliveyoung, "zigzag": find_rank_zigzag, "ably": find_rank_ably, "kakao_gift": find_rank_kakao_gift}


async def main():
    name = PLATFORM_NAMES.get(PLATFORM, PLATFORM)
    print(f"\n🚀 {name} 수집 시작 ({datetime.now().strftime('%Y-%m-%d %H:%M')})")
    if PLATFORM not in EXTRACTORS:
        print(f"❌ 지원하지 않는 플랫폼: {PLATFORM}  지원: {', '.join(EXTRACTORS.keys())}"); return

    links = await fetch_links()
    if not links:
        print("❌ 수집할 링크 없음"); return

    print(f"총 {len(links)}개 상품\n")
    results = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-blink-features=AutomationControlled"])
        context = await browser.new_context(user_agent=UA, viewport={"width": 1280, "height": 900})
        await context.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        page = await context.new_page()

        for i, link in enumerate(links):
            pid, url, keyword = link["product_id"], link["url"], link.get("search_keyword") or ""
            print(f"[{i+1}/{len(links)}] {pid}")
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=60000)
                await page.wait_for_timeout(3000)
                price_data = await EXTRACTORS[PLATFORM](page, pid)
                if price_data and price_data.get("sale_price"):
                    row = {"platform": PLATFORM, "product_id": pid, "url": url,
                           "name": price_data.get("name",""), "brand": price_data.get("brand",""),
                           "sale_price": int(price_data["sale_price"]),
                           "original_price": int(price_data.get("original_price", price_data["sale_price"])),
                           "image": price_data.get("image",""), "collected_at": datetime.utcnow().isoformat()}
                    print(f"  📦 {row['brand']} - {row['name']}")
                    print(f"  💰 {row['sale_price']:,}원 / 정가 {row['original_price']:,}원")
                    if keyword:
                        print(f"  🔍 순위 검색: '{keyword}'")
                        rank = await RANK_FINDERS[PLATFORM](page, keyword, pid)
                        row["rank"] = rank
                        print(f"  🏆 {rank}위" if rank else "  ⚠️  순위 없음")
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


if __name__ == "__main__":
    asyncio.run(main())
