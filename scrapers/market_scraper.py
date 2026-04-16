#!/usr/bin/env python3
"""
시장가/순위 통합 스크래퍼
사용: python market_scraper.py [platform]
platform: naver_channel | coupang | musinsa | oliveyoung | zigzag | ably | kakao_gift
"""
import asyncio, json, os, re, sys
from datetime import datetime
from urllib.parse import quote

import httpx
from playwright.async_api import async_playwright
try:
    from playwright_stealth import stealth_async as _stealth
except ImportError:
    _stealth = None

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
COUPANG_COOKIE = os.environ.get("COUPANG_COOKIE", "")
PLATFORM = sys.argv[1] if len(sys.argv) > 1 else "musinsa"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

PLATFORM_NAMES = {
    "musinsa": "무신사", "oliveyoung": "올리브영",
    "zigzag": "지그재그", "ably": "에이블리", "kakao_gift": "카카오선물하기",
    "naver_channel": "네이버채널", "coupang": "쿠팡",
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
                raw_img = meta.get("thumbnailImageUrl") or meta.get("thumbnail") or ""
                gl = meta.get("goodsImages") or meta.get("imageList") or []
                if raw_img and raw_img.startswith("/"):
                    imgs = f"https://image.msscdn.net/thumbnails{raw_img.replace('_500.', '_big.').replace('_125.', '_big.')}?w=1200"
                elif raw_img:
                    imgs = raw_img
                elif gl:
                    imgs = gl[0].get("imageUrl", "")
                else:
                    imgs = ""
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
        await page.goto(f"https://www.musinsa.com/search/goods?q={quote(keyword)}", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(4000)
        result = await page.evaluate("""(pid) => {
            const selectors = ['a[href*="/products/"]', 'a[href*="/goods/"]'];
            const links = selectors.flatMap(s => Array.from(document.querySelectorAll(s)));
            const seen = new Set(); let pos = 0;
            for (const a of links) {
                const m = a.href.match(/\/(?:products|goods)\/(\d+)/);
                if (!m || seen.has(m[1])) continue;
                seen.add(m[1]); pos++;
                if (m[1] === pid) return pos;
            }
            return { notFound: pos, sample: links.slice(0,3).map(a=>a.href) };
        }""", pid)
        if isinstance(result, int): return result
        print(f"    ⚠️ 무신사 순위 못찾음 (총{result.get('notFound')}개): {result.get('sample')}")
        return None
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
        await page.wait_for_timeout(3000)
        result = await page.evaluate("""(pid) => {
            const links = Array.from(document.querySelectorAll('a[href*="goodsNo="]'));
            const seen = new Set(); let pos = 0;
            for (const a of links) {
                const m = a.href.match(/goodsNo=([A-Z0-9]+)/i);
                if (!m || seen.has(m[1])) continue;
                seen.add(m[1]); pos++;
                if (m[1].toUpperCase() === pid.toUpperCase()) return pos;
            }
            return { notFound: pos, sample: links.slice(0,3).map(a=>a.href) };
        }""", pid)
        if isinstance(result, int): return result
        print(f"    ⚠️ 올리브영 순위 못찾음 (총{result.get('notFound')}개): {result.get('sample')}")
        return None
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
        captured_json = []

        async def on_response(response):
            try:
                ct = response.headers.get("content-type", "")
                if "json" not in ct: return
                url = response.url
                # 검색 결과 API만 수집
                if not any(k in url for k in ["search", "catalog", "product"]): return
                data = await response.json()
                if isinstance(data, (dict, list)):
                    captured_json.append({"url": url, "data": data})
            except: pass

        page.on("response", on_response)
        await page.goto(f"https://zigzag.kr/search?q={quote(keyword)}", wait_until="domcontentloaded", timeout=30000)
        try: await page.wait_for_load_state("networkidle", timeout=10000)
        except: pass
        await page.wait_for_timeout(3000)
        page.remove_listener("response", on_response)

        # 1순위: __NEXT_DATA__ 에서 검색결과 파싱
        rank = await page.evaluate("""(pid) => {
            try {
                const nd = window.__NEXT_DATA__;
                if (!nd) return null;
                const queries = nd?.props?.pageProps?.dehydratedState?.queries || [];
                for (const q of queries) {
                    const data = q?.state?.data;
                    if (!data || typeof data !== 'object') continue;
                    // 가능한 list 키들 재귀 탐색
                    function findList(obj, depth) {
                        if (depth > 5 || !obj || typeof obj !== 'object') return null;
                        if (Array.isArray(obj) && obj.length > 1) {
                            // 첫 아이템이 product_id 같은 걸 가지면 검색결과 리스트
                            const first = obj[0];
                            if (first && typeof first === 'object' &&
                                (first.catalog_product_id || first.product_id || first.id)) {
                                return obj;
                            }
                        }
                        for (const v of Object.values(obj)) {
                            const r = findList(v, depth + 1);
                            if (r) return r;
                        }
                        return null;
                    }
                    const list = findList(data, 0);
                    if (!list) continue;
                    for (let i = 0; i < list.length; i++) {
                        const item = list[i];
                        const itemId = String(item?.catalog_product_id || item?.product_id || item?.id || "");
                        if (itemId === pid) return i + 1;
                    }
                }
            } catch(e) {}
            return null;
        }""", pid)

        if isinstance(rank, int):
            print(f"    ✅ __NEXT_DATA__ 순위: {rank}")
            return rank

        # 2순위: 인터셉트된 API 응답에서 탐색
        def find_in_data(obj, target, depth=0):
            if depth > 6: return None
            if isinstance(obj, list) and len(obj) > 1:
                for i, item in enumerate(obj):
                    if not isinstance(item, dict): continue
                    item_id = str(item.get("catalog_product_id") or item.get("product_id") or item.get("id") or "")
                    if item_id == target:
                        return i + 1
            if isinstance(obj, dict):
                for v in obj.values():
                    r = find_in_data(v, target, depth + 1)
                    if r: return r
            return None

        for entry in captured_json:
            r = find_in_data(entry["data"], pid)
            if r:
                print(f"    ✅ API 인터셉트 순위: {r} ({entry['url'].split('?')[0][-50:]})")
                return r

        # 3순위: DOM — 링크의 Y 좌표 기준, 상위 1/4 영역(추천/최근본) 제외
        result = await page.evaluate("""(pid) => {
            const links = Array.from(document.querySelectorAll('a[href*="/catalog/products/"]'));
            const pageH = document.body.scrollHeight;
            const cutoff = pageH * 0.15; // 상위 15%는 추천/최근본으로 간주
            const seen = new Set(); let pos = 0;
            for (const a of links) {
                const m = a.href.match(/\/catalog\/products\/(\d+)/);
                if (!m || seen.has(m[1])) continue;
                const rect = a.getBoundingClientRect();
                const absTop = rect.top + window.scrollY;
                if (absTop < cutoff) continue; // 상단 추천 영역 제외
                seen.add(m[1]); pos++;
                if (m[1] === pid) return pos;
            }
            return { notFound: pos, sampleIds: Array.from(seen).slice(0,5) };
        }""", pid)

        if isinstance(result, int): return result
        print(f"    ⚠️ 지그재그 순위 못찾음: {result}")
        return None
    except Exception as e:
        print(f"    ⚠️ 순위 실패: {e}"); return None


# ── 에이블리 ─────────────────────────────────────────
def _extract_ably_product(p):
    """dict 하나에서 에이블리 상품 데이터 추출 시도"""
    if not isinstance(p, dict): return None
    name  = p.get("name") or p.get("goods_name") or p.get("goodsName") or ""
    brand = ""
    m = p.get("market") or p.get("brand") or p.get("seller") or {}
    if isinstance(m, dict): brand = m.get("name", "") or m.get("brand_name", "")
    elif isinstance(m, str): brand = m
    sale  = int(p.get("price") or p.get("sale_price") or p.get("salePrice") or 0)
    orig  = int(p.get("retail_price") or p.get("original_price") or p.get("retailPrice") or sale)
    img   = p.get("cover_image") or p.get("image") or p.get("coverImage") or p.get("thumbnail") or ""
    if name and sale:
        return {"name": name, "brand": brand, "sale_price": sale, "original_price": orig, "image": img}
    return None


def _parse_ably_data(d):
    if not isinstance(d, dict): return None
    # 직접 키 탐색
    for key in ["goods", "product", "item", "data", "goodsDetail"]:
        r = _extract_ably_product(d.get(key))
        if r: return r
    # pieces 리스트 (에이블리 상품 데이터가 리스트 안에 있는 경우)
    for key in ["pieces", "items", "goods_list", "products"]:
        lst = d.get(key)
        if isinstance(lst, list):
            for item in lst:
                r = _extract_ably_product(item)
                if r: return r
    # root 자체
    return _extract_ably_product(d)


async def extract_ably(page, pid, captured=None):
    # 모든 캡처된 응답에서 상품 데이터 찾기
    for entry in (captured or {}).get("all", []):
        data = entry.get("data", entry) if isinstance(entry, dict) and "data" in entry else entry
        result = _parse_ably_data(data)
        if result:
            print(f"    ✅ API 인터셉트 성공")
            return result

    # __NEXT_DATA__ fallback
    try:
        nd = await page.evaluate("() => JSON.stringify(window.__NEXT_DATA__)")
        if nd and nd != "null":
            d = json.loads(nd)
            pp = d.get("props", {}).get("pageProps", {})
            queries = pp.get("dehydratedState", {}).get("queries", [])
            for q in queries:
                data = q.get("state", {}).get("data", {}) if isinstance(q, dict) else {}
                if not isinstance(data, dict): continue
                result = _parse_ably_data(data)
                if result: return result
            result = _parse_ably_data(pp)
            if result: return result
        else:
            print(f"    ⚠️ 에이블리 __NEXT_DATA__ 없음")
    except Exception as e:
        print(f"    ⚠️ 에이블리 실패: {e}")
    n_resp = len((captured or {}).get("all", []))
    print(f"    ⚠️ 에이블리 인터셉트 {n_resp}개 응답 모두 파싱 실패")
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
def _to_int(v):
    """중첩 dict일 수 있는 price 값을 int로 변환"""
    if isinstance(v, (int, float)): return int(v)
    if isinstance(v, str): return int(v.replace(",", "")) if v.strip().replace(",","").isdigit() else 0
    if isinstance(v, dict):
        # price: {discountedPrice, salePrice, price, amount ...}
        for k in ["discountedPrice", "salePrice", "price", "amount", "value"]:
            r = _to_int(v.get(k, 0))
            if r: return r
    return 0


def _try_kakao_obj(d):
    """dict 하나에서 카카오 상품 데이터 추출 시도"""
    if not isinstance(d, dict): return None
    name = d.get("name") or d.get("productName") or d.get("title") or ""
    brand_raw = d.get("brand") or d.get("brandName") or d.get("seller") or ""
    brand = brand_raw.get("name", "") if isinstance(brand_raw, dict) else (str(brand_raw) if brand_raw else "")
    sale = _to_int(d.get("price") or d.get("salePrice") or d.get("discountedPrice") or 0)
    orig = _to_int(d.get("originalPrice") or d.get("listPrice") or d.get("normalPrice") or d.get("regularPrice") or sale)
    img = d.get("image") or d.get("thumbnailUrl") or d.get("imageUrl") or d.get("thumbnail") or ""
    if isinstance(img, dict): img = img.get("url") or img.get("src") or img.get("original") or ""
    if name and len(name) > 2 and sale:
        return {"name": name, "brand": brand, "sale_price": sale, "original_price": orig, "image": img}
    return None


def _parse_kakao_data(d):
    if not isinstance(d, dict): return None
    # 1depth 키 탐색
    for key in ["product", "item", "data", "productDetail", "giftProduct"]:
        r = _try_kakao_obj(d.get(key))
        if r: return r
    # root 자체
    r = _try_kakao_obj(d)
    if r: return r
    # 2depth: 모든 dict 값 시도
    for v in d.values():
        if isinstance(v, dict):
            r = _try_kakao_obj(v)
            if r: return r
        elif isinstance(v, list):
            for item in v:
                r = _try_kakao_obj(item)
                if r: return r
    return None


async def extract_kakao_gift(page, pid, captured=None):
    all_resp = (captured or {}).get("all", [])
    # 1순위: product 관련 API URL 응답
    for entry in all_resp:
        url, data = entry.get("url",""), entry.get("data",{})
        if "product" in url and pid in url:
            result = _parse_kakao_data(data)
            if result:
                print(f"    ✅ API 인터셉트 성공 ({url.split('?')[0].split('/')[-1]})")
                return result
    # 2순위: product URL 포함 (pid 없어도)
    for entry in all_resp:
        url, data = entry.get("url",""), entry.get("data",{})
        if "product" in url:
            result = _parse_kakao_data(data)
            if result:
                print(f"    ✅ API 인터셉트 성공")
                return result

    # DOM 추출 — 카카오선물하기 실제 CSS 클래스 기반
    try:
        result = await page.evaluate("""() => {
            const toInt = el => {
                if (!el) return 0;
                const m = (el.innerText||'').replace(/[^0-9]/g,'');
                return m ? parseInt(m) : 0;
            };
            const name  = document.querySelector('h4.tit_subject')?.innerText?.replace(/<!---->/g,'').trim() || '';
            const brand = document.querySelector('.link_brand,.txt_brand,.brand_name')?.innerText?.trim() || '';
            const sale  = toInt(document.querySelector('.txt_total'));
            const orig  = toInt(document.querySelector('del.legacy_price'));
            const img   = document.querySelector('img.img_g')?.src || '';
            return { name, brand, sale_price: sale, original_price: orig > sale ? orig : sale, image: img };
        }""")
        if result and result.get("sale_price") and result.get("name"):
            print(f"    ✅ DOM 추출 성공: {result['name'][:20]}")
            return result
        if result and result.get("sale_price"):
            print(f"    ⚠️ 가격만 추출 성공 (이름 없음)")
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


async def extract_naver_channel(page, pid):
    """네이버 스마트스토어 / 브랜드스토어 가격 추출"""
    try:
        nd = await page.evaluate("() => JSON.stringify(window.__NEXT_DATA__)")
        if nd:
            d = json.loads(nd)
            pp = d.get("props", {}).get("pageProps", {})
            # 스마트스토어 구조
            product = pp.get("initialState", {}).get("product", {}).get("A", {})
            if not product:
                product = _find_in_obj(pp, ["productName", "salePrice"], 0) or {}
            name = product.get("productName") or product.get("name") or ""
            sale = int(product.get("salePrice") or product.get("price") or 0)
            orig = int(product.get("retailPrice") or product.get("originalPrice") or sale)
            img_info = product.get("representativeImageUrl") or product.get("image") or ""
            if name and sale:
                return {"name": name, "brand": "", "sale_price": sale, "original_price": orig, "image": img_info}
    except Exception as e:
        print(f"    ⚠️ 네이버채널 추출 실패(NEXT_DATA): {e}")
    try:
        # DOM 폴백
        name = await page.evaluate("""() => {
            const el = document.querySelector('h3._2-I30XS1lA, h2.product_title, ._2aNPDQFiUD, [class*="productName"]');
            return el ? el.textContent.trim() : '';
        }""")
        price = await page.evaluate("""() => {
            const el = document.querySelector('strong._1LY7DqCnwR, ._1LY7DqCnwR, [class*="salePrice"], em._1ym0zGUNe6');
            if (!el) return 0;
            return parseInt(el.textContent.replace(/[^0-9]/g,'')) || 0;
        }""")
        if name and price:
            return {"name": name, "brand": "", "sale_price": price, "original_price": price, "image": ""}
    except Exception as e:
        print(f"    ⚠️ 네이버채널 DOM 추출 실패: {e}")
    return {}


async def find_rank_naver_channel(page, keyword, pid):
    """네이버 쇼핑 검색 순위"""
    try:
        url = f"https://search.shopping.naver.com/api/search?query={quote(keyword)}&sort=rel&pagingIndex=1&pagingSize=100&viewType=list&productSet=total"
        res_data = await page.evaluate(f"""async () => {{
            const r = await fetch("{url}", {{
                headers: {{"Accept":"application/json","Referer":"https://search.shopping.naver.com"}}
            }});
            return r.ok ? await r.json() : null;
        }}""")
        if res_data:
            products = (res_data.get("shoppingResult") or res_data.get("result") or {}).get("products") or res_data.get("products") or []
            organic = 0
            for p in products:
                is_ad = bool(p.get("adId") or p.get("isAd"))
                if not is_ad:
                    organic += 1
                link = p.get("mallProductUrl") or p.get("link") or ""
                if pid in link or str(p.get("nvMid","")) == pid or str(p.get("id","")) == pid:
                    return organic if not is_ad else None
    except Exception as e:
        print(f"    ⚠️ 네이버 순위 실패: {e}")
    return None


async def _fetch_coupang_html(url):
    """쿠팡 HTML을 브라우저 쿠키로 직접 가져옴 (Akamai 우회)"""
    if not COUPANG_COOKIE:
        return None
    try:
        from curl_cffi.requests import AsyncSession
        async with AsyncSession(impersonate="chrome131") as s:
            r = await s.get(url, headers={
                "Cookie": COUPANG_COOKIE,
                "Accept-Language": "ko-KR,ko;q=0.9",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Referer": "https://www.coupang.com/",
                "User-Agent": UA,
            }, timeout=20)
            if r.status_code == 200 and len(r.text) > 5000:
                return r.text
    except Exception as e:
        print(f"    ⚠️ httpx 쿠팡 실패: {e}")
    return None


def _parse_coupang_html(t):
    """쿠팡 HTML에서 상품 정보 추출"""
    # JSON-LD
    lds = re.findall(r'<script[^>]*ld\+json[^>]*>(.*?)</script>', t, re.DOTALL)
    for raw in lds:
        try:
            d = json.loads(raw)
            if isinstance(d, list): d = next((x for x in d if x.get("@type") == "Product"), {})
            if d.get("@type") == "Product":
                offers = d.get("offers", {})
                if isinstance(offers, list): offers = offers[0] if offers else {}
                sale = int(float(str(offers.get("price", 0)).replace(",", ""))) if offers.get("price") else 0
                name = d.get("name", "")
                imgs = d.get("image", [])
                img = (imgs[0] if isinstance(imgs, list) and imgs else imgs) if imgs else ""
                if name and sale:
                    return {"name": name, "brand": "", "sale_price": sale, "original_price": sale, "image": str(img)}
        except: pass

    # 가격 패턴 — "총 결제금액" 또는 "할인가"
    sale_m = re.search(r'class="[^"]*total-price[^"]*"[^>]*><strong[^>]*>([\d,]+)', t)
    if not sale_m:
        sale_m = re.search(r'"salePrice"\s*:\s*(\d+)', t)
    name_m = re.search(r'class="[^"]*prod-buy-header__title[^"]*"[^>]*>(.*?)</h2>', t, re.DOTALL)
    if not name_m:
        name_m = re.search(r'"productName"\s*:\s*"([^"]+)"', t)
    img_m = re.search(r'class="[^"]*prod-img[^"]*"[^>]*src="([^"]+)"', t)
    if not img_m:
        img_m = re.search(r'"mainImageUrl"\s*:\s*"([^"]+)"', t)

    sale = int(sale_m.group(1).replace(",", "")) if sale_m else 0
    name = re.sub(r'<[^>]+>', '', name_m.group(1)).strip() if name_m else ""
    img = img_m.group(1) if img_m else ""
    if name and sale:
        return {"name": name, "brand": "", "sale_price": sale, "original_price": sale, "image": img}
    return {}


async def extract_coupang(page, pid):
    """쿠팡 상품 가격 추출"""
    # 1) 브라우저 쿠키 있으면 httpx로 직접 가져오기 (Akamai 우회)
    url = await page.evaluate("() => location.href")
    html = await _fetch_coupang_html(url)
    if html:
        result = _parse_coupang_html(html)
        if result:
            return result
        print("    ⚠️ 쿠키로 HTML 가져왔으나 파싱 실패")

    # 2) Playwright 폴백 (한국 IP에서 실행 시 동작 가능)
    try:
        try: await page.wait_for_load_state("networkidle", timeout=10000)
        except: pass

        title = await page.evaluate("() => document.title")
        if "Access Denied" in title:
            print("    ❌ Akamai 차단 — COUPANG_COOKIE 환경변수 설정 필요")
            print("    ℹ️ Chrome에서 쿠팡 열고 F12 → Network → 요청 클릭 → Request Headers → cookie 값 복사")
            print("    ℹ️ .env.local에 COUPANG_COOKIE=<복사한값> 추가, GitHub Secrets에도 추가")
            return {}

        nd = await page.evaluate("() => { try { return JSON.stringify(window.__NEXT_DATA__); } catch(e) { return null; } }")
        if nd:
            try:
                d = json.loads(nd)
                pp = d.get("props", {}).get("pageProps", {})
                for key in ["product", "pdpData", "itemInfo", "detail"]:
                    item = pp.get(key) or pp.get("initialState", {}).get(key)
                    if item and isinstance(item, dict):
                        sale = item.get("salePrice") or item.get("saleUnitPrice") or item.get("finalPrice") or 0
                        name = item.get("productName") or item.get("name") or item.get("itemName") or ""
                        img = item.get("mainImageUrl") or item.get("imageUrl") or item.get("image") or ""
                        orig = item.get("originalPrice") or item.get("basePrice") or sale
                        if name and sale:
                            return {"name": str(name), "brand": "", "sale_price": int(sale), "original_price": int(orig), "image": str(img)}
            except: pass

        body_html = await page.evaluate("() => document.body ? document.body.innerHTML : ''")
        result = _parse_coupang_html(body_html)
        if result:
            return result
    except Exception as e:
        print(f"    ⚠️ 쿠팡 추출 실패: {e}")
    return {}


async def find_rank_coupang(page, keyword, pid):
    """쿠팡 검색 순위"""
    try:
        await page.goto(f"https://www.coupang.com/np/search?q={quote(keyword)}&limit=72&page=1", wait_until="domcontentloaded", timeout=30000)
        try: await page.wait_for_load_state("networkidle", timeout=8000)
        except: pass
        rank = await page.evaluate(f"""(pid) => {{
            const items = document.querySelectorAll('li[id^="productUnit"], li.search-product');
            let pos = 0;
            for (const item of items) {{
                const sponsored = item.querySelector('[class*="ad-badge"], [class*="adBadge"]');
                if (sponsored) continue;
                pos++;
                const a = item.querySelector('a[href*="/vp/products/"]');
                if (a && a.href.includes('/' + pid)) return pos;
            }}
            return null;
        }}""", pid)
        return rank
    except Exception as e:
        print(f"    ⚠️ 쿠팡 순위 실패: {e}")
    return None


# ── 플랫폼 매핑 ──────────────────────────────────────
def _wrap(fn):
    """captured 파라미터 없는 extractor를 통일 시그니처로 래핑"""
    async def wrapper(page, pid, captured=None): return await fn(page, pid)
    return wrapper

EXTRACTORS = {
    "naver_channel": _wrap(extract_naver_channel),
    "coupang":       _wrap(extract_coupang),
    "musinsa":       _wrap(extract_musinsa),
    "oliveyoung":    _wrap(extract_oliveyoung),
    "zigzag":        _wrap(extract_zigzag),
    "ably":          extract_ably,
    "kakao_gift":    extract_kakao_gift,
}
RANK_FINDERS = {
    "naver_channel": find_rank_naver_channel,
    "coupang":       find_rank_coupang,
    "musinsa":       find_rank_musinsa,
    "oliveyoung":    find_rank_oliveyoung,
    "zigzag":        find_rank_zigzag,
    "ably":          find_rank_ably,
    "kakao_gift":    find_rank_kakao_gift,
}


INTERCEPT_PLATFORMS = {"kakao_gift", "ably"}


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
            # 카카오/에이블리: goto 전에 모든 JSON 응답 수집
            all_responses = []
            if platform in INTERCEPT_PLATFORMS:
                async def _on_response(response, _pid=pid, _all=all_responses, _plat=platform):
                    try:
                        ct = response.headers.get("content-type", "")
                        if "json" not in ct: return
                        data = await response.json()
                        if not isinstance(data, dict): return
                        # 카카오는 pid가 응답에 없을 수 있어 모든 JSON 수집 (URL 포함)
                        if _plat == "kakao_gift":
                            _all.append({"url": response.url, "data": data})
                        elif _pid in json.dumps(data):
                            _all.append({"url": response.url, "data": data})
                    except: pass
                page.on("response", _on_response)

            await page.goto(url, wait_until="domcontentloaded", timeout=60000)
            await page.wait_for_timeout(3000)

            if platform in INTERCEPT_PLATFORMS:
                try:
                    await page.wait_for_load_state("networkidle", timeout=8000)
                except: pass
                page.remove_listener("response", _on_response)

            captured = {"all": all_responses}
            price_data = await EXTRACTORS[platform](page, pid, captured)
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
        if _stealth:
            await _stealth(page)

        total = 0
        for platform in platforms:
            total += await run_platform(platform, page)

        await browser.close()
    print(f"\n🎉 전체 완료: {total}개 성공")


if __name__ == "__main__":
    asyncio.run(main())
