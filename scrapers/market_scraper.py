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
            # 실제 구조: pageProps.meta.data
            meta = pp.get("meta", {}).get("data", {})
            if meta:
                name  = meta.get("goodsNm") or meta.get("goodsName") or ""
                brand_info = meta.get("brandInfo", {})
                brand = brand_info.get("brandName") or brand_info.get("name") or ""
                gp    = meta.get("goodsPrice", {})
                sale  = int(gp.get("salePrice") or gp.get("price") or 0)
                orig  = int(gp.get("normalPrice") or gp.get("originalPrice") or sale)
                imgs  = meta.get("thumbnailImageUrl") or meta.get("thumbnail") or ""
                if not imgs:
                    gl = meta.get("goodsImages") or meta.get("imageList") or []
                    imgs = gl[0].get("imageUrl","") if gl else ""
                if name and sale:
                    return {"name": name, "brand": brand, "sale_price": sale, "original_price": orig, "image": imgs}
            # fallback: 구버전 구조
            p = pp.get("product") or pp.get("goodsDetail") or pp.get("item") or {}
            if p:
                brand = p.get("brandName") or (p.get("brand", {}).get("name", "") if isinstance(p.get("brand"), dict) else p.get("brand", ""))
                sale  = int(p.get("price") or p.get("salePrice") or p.get("goodsPrice") or 0)
                orig  = int(p.get("originalPrice") or p.get("consumerPrice") or sale)
                img   = p.get("thumbnailImageUrl") or p.get("thumbnail") or ""
                name  = p.get("goodsName") or p.get("name") or ""
                if name and sale:
                    return {"name": name, "brand": brand, "sale_price": sale, "original_price": orig, "image": img}
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
    try:
        nd = await page.evaluate("() => JSON.stringify(window.__NEXT_DATA__)")
        if nd:
            d = json.loads(nd)
            pp = d.get("props", {}).get("pageProps", {})
            # 실제 구조: pageProps.dehydratedState.queries[].state.data
            queries = pp.get("dehydratedState", {}).get("queries", [])
            for q in queries:
                data = q.get("state", {}).get("data", {}) if isinstance(q, dict) else {}
                if not isinstance(data, dict): continue
                product = data.get("product", {})
                shop    = data.get("shop", {})
                if not product or not isinstance(product, dict): continue
                name  = product.get("name") or product.get("title") or ""
                brand = shop.get("name", "") if isinstance(shop, dict) else ""
                pp2   = product.get("product_price", {})
                sale  = int((pp2.get("final_discount_info") or {}).get("discount_price") or pp2.get("price") or 0)
                orig  = int((pp2.get("max_price_info") or {}).get("price") or sale)
                imgs  = product.get("product_image_list", [])
                img   = imgs[0].get("url", "") if imgs else ""
                if name and sale:
                    return {"name": name, "brand": brand, "sale_price": sale, "original_price": orig, "image": img}
    except Exception as e:
        print(f"    ⚠️ 추출 실패: {e}")
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
def _parse_ably_data(d, pid):
    """에이블리 API/NEXT_DATA 응답에서 상품 데이터 추출"""
    candidates = []
    # 여러 키 후보 탐색
    for key in ["goods", "product", "item", "data", "goodsDetail"]:
        v = d.get(key)
        if isinstance(v, dict): candidates.append(v)
    if not candidates:
        candidates = [d]
    for p in candidates:
        if not isinstance(p, dict): continue
        name  = p.get("name") or p.get("goods_name") or p.get("goodsName") or ""
        brand = ""
        m = p.get("market") or p.get("brand") or {}
        if isinstance(m, dict): brand = m.get("name", "")
        elif isinstance(m, str): brand = m
        sale  = int(p.get("price") or p.get("sale_price") or p.get("salePrice") or 0)
        orig  = int(p.get("retail_price") or p.get("original_price") or p.get("retailPrice") or sale)
        img   = p.get("cover_image") or p.get("image") or p.get("coverImage") or ""
        if name and sale:
            return {"name": name, "brand": brand, "sale_price": sale, "original_price": orig, "image": img}
    return None


async def extract_ably(page, pid):
    # 모든 JSON 응답 인터셉트 (URL 패턴 제한 없이)
    captured = {}

    async def handle_response(response):
        if captured.get("data"): return
        try:
            ct = response.headers.get("content-type", "")
            if "json" not in ct: return
            data = await response.json()
            if not isinstance(data, dict): return
            # 상품 ID가 응답 어딘가에 있으면 캡처
            raw = json.dumps(data)
            if pid in raw:
                captured["data"] = data
        except: pass

    page.on("response", handle_response)
    try:
        await page.wait_for_load_state("networkidle", timeout=15000)
    except: pass
    page.remove_listener("response", handle_response)

    if captured.get("data"):
        result = _parse_ably_data(captured["data"], pid)
        if result:
            print(f"    ✅ API 인터셉트 성공")
            return result

    # __NEXT_DATA__ fallback
    try:
        nd = await page.evaluate("() => JSON.stringify(window.__NEXT_DATA__)")
        if nd:
            d = json.loads(nd)
            pp = d.get("props", {}).get("pageProps", {})
            # dehydratedState queries 탐색
            queries = pp.get("dehydratedState", {}).get("queries", [])
            for q in queries:
                data = q.get("state", {}).get("data", {}) if isinstance(q, dict) else {}
                if not isinstance(data, dict): continue
                result = _parse_ably_data(data, pid)
                if result: return result
            # pageProps 직접
            result = _parse_ably_data(pp, pid)
            if result: return result
    except Exception as e:
        print(f"    ⚠️ __NEXT_DATA__ 실패: {e}")
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
    # 네트워크 인터셉트로 API 응답 가로채기
    captured = {}

    async def handle_response(response):
        url = response.url
        if (f"/product/{pid}" in url or f"/products/{pid}" in url or f"productId={pid}" in url) and "json" in response.headers.get("content-type",""):
            try:
                data = await response.json()
                if isinstance(data, dict) and not captured.get("data"):
                    captured["data"] = data
            except: pass

    page.on("response", handle_response)
    try:
        await page.wait_for_load_state("networkidle", timeout=15000)
    except: pass
    page.remove_listener("response", handle_response)

    # API 응답에서 데이터 추출
    if captured.get("data"):
        d = captured["data"]
        # 카카오 API 응답 구조 탐색
        product = d.get("product") or d.get("item") or d.get("data") or d
        if isinstance(product, dict):
            name = product.get("name") or product.get("productName") or ""
            brand_raw = product.get("brand") or product.get("brandName") or ""
            brand = brand_raw.get("name", "") if isinstance(brand_raw, dict) else str(brand_raw)
            sale = int(product.get("price") or product.get("salePrice") or product.get("discountedPrice") or 0)
            orig = int(product.get("originalPrice") or product.get("listPrice") or product.get("normalPrice") or sale)
            img = product.get("image") or product.get("thumbnailUrl") or product.get("imageUrl") or ""
            if isinstance(img, dict): img = img.get("url") or img.get("src") or ""
            if name and sale:
                print(f"    ✅ API 인터셉트 성공")
                return {"name": name, "brand": brand, "sale_price": sale, "original_price": orig, "image": img}

    # DOM fallback
    try:
        result = await page.evaluate("""() => {
            const p = el => { if (!el) return 0; const m = (el.innerText||'').replace(/[^0-9]/g,''); return m ? parseInt(m) : 0; };
            // 카카오선물하기 클래스 패턴
            const nameEl = document.querySelector('[class*="tit_product"],[class*="ProductName"],[class*="product_name"],[class*="tit_item"],h2,h1');
            const brandEl = document.querySelector('[class*="txt_brand"],[class*="brand_name"],[class*="txt_seller"]');
            const saleEl  = document.querySelector('[class*="price_sale"],[class*="num_price"],[class*="txt_price"] strong,[class*="sale_price"]');
            const origEl  = document.querySelector('[class*="price_origin"] del,[class*="origin_price"],[class*="list_price"]');
            let sale = p(saleEl), orig = p(origEl);
            if (!orig || orig < sale) orig = sale;
            const imgEl = document.querySelector('[class*="thumb_product"] img,[class*="product_img"] img,[class*="img_product"],main img');
            return { name: nameEl?.innerText?.trim()||'', brand: brandEl?.innerText?.trim()||'', sale_price: sale, original_price: orig, image: imgEl?.src||imgEl?.dataset?.src||'' };
        }""")
        if result and result.get("sale_price"):
            print(f"    ✅ DOM 추출 성공")
            return result
    except Exception as e:
        print(f"    ⚠️ DOM 추출 실패: {e}")
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
