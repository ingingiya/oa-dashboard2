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
def _find_in_obj(obj, keys, depth=0):
    """객체에서 재귀적으로 key 탐색"""
    if depth > 8 or not isinstance(obj, (dict, list)):
        return None
    if isinstance(obj, list):
        for item in obj:
            r = _find_in_obj(item, keys, depth + 1)
            if r is not None: return r
        return None
    for k in keys:
        if k in obj and obj[k]:
            return obj[k]
    for v in obj.values():
        r = _find_in_obj(v, keys, depth + 1)
        if r is not None: return r
    return None


async def extract_zigzag(page, pid):
    # 1) __NEXT_DATA__ 전체 재귀 탐색
    try:
        nd = await page.evaluate("() => JSON.stringify(window.__NEXT_DATA__)")
        if nd:
            d = json.loads(nd)
            # dehydratedState queries 안에 product 데이터가 있는 경우
            queries = _find_in_obj(d, ["queries"])
            if isinstance(queries, list):
                for q in queries:
                    data = q.get("state", {}).get("data", {}) if isinstance(q, dict) else {}
                    # 중첩 구조에서 product 찾기
                    p = None
                    for key in ["product", "item", "catalog", "catalogProduct", "goods"]:
                        p = data.get(key) if isinstance(data, dict) else None
                        if p: break
                    if not p and isinstance(data, dict):
                        # data 자체가 product인 경우
                        if data.get("name") and (data.get("price") or data.get("salePrice")):
                            p = data
                    if p and isinstance(p, dict):
                        name = p.get("name") or p.get("title") or ""
                        brand = p.get("brand") or (p.get("store", {}).get("name", "") if isinstance(p.get("store"), dict) else "")
                        sale = int(p.get("price") or p.get("salePrice") or p.get("discountedPrice") or 0)
                        orig = int(p.get("originalPrice") or p.get("retailPrice") or sale)
                        img = p.get("image") or p.get("thumbnail") or p.get("imageUrl") or ""
                        if name and sale:
                            return {"name": name, "brand": brand, "sale_price": sale, "original_price": orig, "image": img}
            # 기존 방식
            pp = d.get("props", {}).get("pageProps", {})
            p = pp.get("product") or pp.get("item") or pp.get("catalog") or {}
            if p:
                name = p.get("name") or p.get("title") or ""
                brand = p.get("brand") or (p.get("store", {}).get("name", "") if isinstance(p.get("store"), dict) else "")
                sale = int(p.get("price") or p.get("salePrice") or p.get("discountedPrice") or 0)
                orig = int(p.get("originalPrice") or p.get("retailPrice") or sale)
                img = p.get("image") or p.get("thumbnail") or p.get("imageUrl") or ""
                if name and sale:
                    return {"name": name, "brand": brand, "sale_price": sale, "original_price": orig, "image": img}
    except Exception as e:
        print(f"    ⚠️ 추출 실패(NEXT_DATA): {e}")
    # 2) DOM 셀렉터
    try:
        result = await page.evaluate("""() => {
            const p = el => { if (!el) return 0; const m = (el.innerText||'').replace(/[^0-9]/g,''); return m ? parseInt(m) : 0; };
            const nameEl = document.querySelector('[class*="ProductName"], [class*="product-name"], h1');
            const brandEl = document.querySelector('[class*="BrandName"], [class*="brand-name"], [class*="StoreName"]');
            const priceEl = document.querySelector('[class*="SalePrice"], [class*="sale-price"], [class*="Price__sale"]');
            const origEl  = document.querySelector('[class*="OriginalPrice"], [class*="original-price"]');
            let sale = p(priceEl), orig = p(origEl);
            if (!orig || orig < sale) orig = sale;
            const imgEl = document.querySelector('img[src*="cf.shop-talk"], img[src*="zigzag"], [class*="ProductImage"] img');
            return { name: nameEl?.innerText?.trim()||'', brand: brandEl?.innerText?.trim()||'', sale_price: sale, original_price: orig, image: imgEl?.src||'' };
        }""")
        if result and result.get("sale_price"):
            return result
    except Exception as e:
        print(f"    ⚠️ 추출 실패(DOM): {e}")
    # 3) JSON-LD fallback
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
    # 1) __NEXT_DATA__ 탐색
    try:
        nd = await page.evaluate("() => JSON.stringify(window.__NEXT_DATA__)")
        if nd:
            d = json.loads(nd)
            pp = d.get("props", {}).get("pageProps", {})
            p = pp.get("goods") or pp.get("goodsDetail") or pp.get("product") or pp.get("item") or {}
            if not p:
                # dehydratedState 재귀 탐색
                p = _find_in_obj(pp.get("dehydratedState", {}), ["goods", "goodsDetail", "product", "item"]) or {}
            if p and isinstance(p, dict):
                name = p.get("name") or p.get("goods_name") or ""
                brand = (p.get("market", {}).get("name", "") if isinstance(p.get("market"), dict) else p.get("brand", ""))
                sale = int(p.get("price") or p.get("sale_price") or 0)
                orig = int(p.get("retail_price") or p.get("original_price") or sale)
                img = p.get("cover_image") or p.get("image") or ""
                if name and sale:
                    return {"name": name, "brand": brand, "sale_price": sale, "original_price": orig, "image": img}
    except Exception as e:
        print(f"    ⚠️ 추출 실패(NEXT_DATA): {e}")
    # 2) DOM 셀렉터 fallback
    try:
        await page.wait_for_timeout(2000)
        result = await page.evaluate("""() => {
            const p = el => { if (!el) return 0; const m = (el.innerText||'').replace(/[^0-9]/g,''); return m ? parseInt(m) : 0; };
            const nameEl = document.querySelector('[class*="GoodsName"], [class*="goods-name"], [class*="ProductName"], h1');
            const brandEl = document.querySelector('[class*="MarketName"], [class*="market-name"], [class*="BrandName"]');
            const saleEl  = document.querySelector('[class*="SalePrice"], [class*="sale-price"], [class*="GoodsPrice"]');
            const origEl  = document.querySelector('[class*="OriginPrice"], [class*="origin-price"], [class*="OriginalPrice"]');
            let sale = p(saleEl), orig = p(origEl);
            if (!orig || orig < sale) orig = sale;
            const imgEl = document.querySelector('[class*="GoodsImage"] img, [class*="goods-image"] img, [class*="ProductImage"] img');
            return { name: nameEl?.innerText?.trim()||'', brand: brandEl?.innerText?.trim()||'', sale_price: sale, original_price: orig, image: imgEl?.src||'' };
        }""")
        if result and result.get("sale_price"):
            return result
    except Exception as e:
        print(f"    ⚠️ 추출 실패(DOM): {e}")
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
    # JS 로딩 대기 (카카오는 동적 렌더링)
    try:
        await page.wait_for_load_state("networkidle", timeout=15000)
    except: pass
    # 1) DOM 셀렉터 (카카오선물하기는 JS 렌더링 후 DOM에 데이터)
    try:
        result = await page.evaluate("""() => {
            const p = el => { if (!el) return 0; const m = (el.innerText||'').replace(/[^0-9]/g,''); return m ? parseInt(m) : 0; };
            const nameEl = document.querySelector('[class*="tit_product"], [class*="ProductName"], [class*="product_name"], [class*="tit_item"], h1[class*="tit"]');
            const brandEl = document.querySelector('[class*="txt_brand"], [class*="BrandName"], [class*="brand_name"]');
            const saleEl  = document.querySelector('[class*="price_sale"], [class*="SalePrice"], [class*="txt_price"], em[class*="price"]');
            const origEl  = document.querySelector('[class*="price_origin"], [class*="OriginalPrice"], [class*="price_before"] del');
            let sale = p(saleEl), orig = p(origEl);
            if (!orig || orig < sale) orig = sale;
            const imgEl = document.querySelector('[class*="thumb_product"] img, [class*="ProductImage"] img, [class*="img_product"]');
            return { name: nameEl?.innerText?.trim()||'', brand: brandEl?.innerText?.trim()||'', sale_price: sale, original_price: orig, image: imgEl?.src||'' };
        }""")
        if result and result.get("sale_price"):
            return result
    except Exception as e:
        print(f"    ⚠️ 추출 실패(DOM): {e}")
    # 2) __NEXT_DATA__ 탐색
    try:
        nd = await page.evaluate("() => JSON.stringify(window.__NEXT_DATA__)")
        if nd:
            d = json.loads(nd)
            pp = d.get("props", {}).get("pageProps", {})
            p = pp.get("product") or pp.get("item") or {}
            if not p:
                p = _find_in_obj(pp, ["product", "item", "productDetail"]) or {}
            if p and isinstance(p, dict):
                name = p.get("name") or p.get("productName") or ""
                brand = (p.get("brand", {}).get("name", "") if isinstance(p.get("brand"), dict) else p.get("brandName", ""))
                sale = int(p.get("price") or p.get("salePrice") or 0)
                orig = int(p.get("originalPrice") or sale)
                img = p.get("image") or p.get("thumbnailUrl") or ""
                if name and sale:
                    return {"name": name, "brand": brand, "sale_price": sale, "original_price": orig, "image": img}
    except Exception as e:
        print(f"    ⚠️ 추출 실패(NEXT_DATA): {e}")
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


async def run_platform(platform, page):
    name = PLATFORM_NAMES.get(platform, platform)
    print(f"\n🚀 {name} 수집 시작 ({datetime.now().strftime('%Y-%m-%d %H:%M')})")
    links = await fetch_links_for(platform)
    if not links:
        print(f"❌ {name}: 수집할 링크 없음"); return 0
    print(f"총 {len(links)}개 상품\n")
    results = []
    for i, link in enumerate(links):
        pid, url, keyword = link["product_id"], link["url"], link.get("search_keyword") or ""
        print(f"[{i+1}/{len(links)}] {pid}")
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=60000)
            await page.wait_for_timeout(3000)
            price_data = await EXTRACTORS[platform](page, pid)
            if price_data and price_data.get("sale_price"):
                row = {"platform": platform, "product_id": pid, "url": url,
                       "name": price_data.get("name",""), "brand": price_data.get("brand",""),
                       "sale_price": int(price_data["sale_price"]),
                       "original_price": int(price_data.get("original_price", price_data["sale_price"])),
                       "image": price_data.get("image",""), "collected_at": datetime.utcnow().isoformat()}
                print(f"  📦 {row['brand']} - {row['name']}")
                print(f"  💰 {row['sale_price']:,}원 / 정가 {row['original_price']:,}원")
                if keyword:
                    print(f"  🔍 순위 검색: '{keyword}'")
                    rank = await RANK_FINDERS[platform](page, keyword, pid)
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
    print(f"\n✅ {name} 완료: {len(results)}/{len(links)}개 성공")
    return len(results)


async def fetch_links_for(platform):
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/market_links?platform=eq.{platform}&active=eq.true&order=id.asc",
            headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
        )
        return res.json() if res.status_code == 200 else []


async def main():
    if PLATFORM not in EXTRACTORS and PLATFORM != "all":
        print(f"❌ 지원하지 않는 플랫폼: {PLATFORM}  지원: all, {', '.join(EXTRACTORS.keys())}"); return

    platforms = list(EXTRACTORS.keys()) if PLATFORM == "all" else [PLATFORM]
    print(f"\n🚀 {'전체' if PLATFORM == 'all' else PLATFORM_NAMES.get(PLATFORM, PLATFORM)} 수집 시작 ({datetime.now().strftime('%Y-%m-%d %H:%M')})")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-blink-features=AutomationControlled"])
        context = await browser.new_context(user_agent=UA, viewport={"width": 1280, "height": 900})
        await context.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        page = await context.new_page()

        total = 0
        for platform in platforms:
            total += await run_platform(platform, page)

        await browser.close()
    print(f"\n🎉 전체 완료: {total}개 성공")


if __name__ == "__main__":
    asyncio.run(main())
