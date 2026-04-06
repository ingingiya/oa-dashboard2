import asyncio
import json
import os
import re
from datetime import datetime

import httpx
from playwright.async_api import async_playwright

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")


async def fetch_links():
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/oliveyoung_links?select=*&active=eq.true&order=id.asc",
            headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
        )
        if res.status_code == 200:
            return res.json()
        print(f"링크 목록 불러오기 실패: {res.status_code}")
        return []


async def extract_price(page, pid: str) -> dict:
    print(f"  🔍 가격 추출: {pid}")

    try:
        result = await page.evaluate("""() => {
            const parsePrice = el => {
                if (!el) return 0;
                const txt = el.innerText || el.textContent || '';
                const m = txt.replace(/[^0-9]/g, '');
                return m ? parseInt(m) : 0;
            };

            // 상품명
            const nameEl = document.querySelector(
                '[class*="GoodsDetailInfo_title"], ' +
                '[class*="goods-name"], [class*="prd-name"], ' +
                '.prd-name, .goods-name, h2.prd-name'
            );
            const name = nameEl ? nameEl.innerText.trim() : '';

            // 브랜드
            const brandEl = document.querySelector(
                '[class*="TopUtils_btn-brand"], ' +
                '[class*="brand-name"], [class*="prd-brand"], ' +
                '.prd-brand, .brand-name, .brand'
            );
            const brand = brandEl ? brandEl.innerText.trim() : '';

            // ── 가격 추출 ──
            // 올리브영 CSS Modules 구조:
            //   할인가: [class*="GoodsDetailInfo_price__"] (SPAN)  → 68,900원
            //   정가:   [class*="price-before"] (S태그)            → 85,000원
            let salePrice = 0;
            let origPrice = 0;

            // 1) 할인가
            const saleEl = document.querySelector('[class*="GoodsDetailInfo_price__"]');
            salePrice = parsePrice(saleEl);

            // 2) 정가 (취소선 S 태그)
            const origEl = document.querySelector('[class*="price-before"]');
            origPrice = parsePrice(origEl);

            // 3) 할인 없는 상품: 정가만 있으면 그게 판매가
            if (!salePrice && origPrice) salePrice = origPrice;

            // 4) 둘 다 없으면 price-box 전체에서 숫자 추출
            if (!salePrice) {
                const boxEl = document.querySelector('[class*="price-box"]');
                if (boxEl) {
                    const nums = (boxEl.innerText || '').match(/[\d,]{4,}/g) || [];
                    const parsed = nums.map(n => parseInt(n.replace(/,/g,''))).filter(n => n > 1000 && n < 2000000);
                    if (parsed.length > 0) {
                        salePrice = Math.min(...parsed);
                        origPrice = Math.max(...parsed);
                    }
                }
            }

            // 정가가 없거나 판매가보다 작으면 판매가로 맞춤
            if (!origPrice || origPrice < salePrice) origPrice = salePrice;

            // ── 세일 기간 추출 ──
            let salePeriod = '';
            const periodSelectors = [
                '[class*="period"], [class*="Period"]',
                '[class*="event-date"], [class*="eventDate"]',
                '[class*="sale-date"], [class*="saleDate"]',
                '.evt-period, .sale-period, .promotion-period',
                '[class*="duration"], [class*="deadline"]',
            ];
            for (const sel of periodSelectors) {
                const el = document.querySelector(sel);
                if (el) {
                    const txt = el.innerText.trim();
                    if (txt && /\\d/.test(txt)) { salePeriod = txt.slice(0, 60); break; }
                }
            }
            if (!salePeriod) {
                const allText = document.body.innerText;
                const dateMatch = allText.match(
                    /세일[^\\n]*?(\\d{4}\\.\\d{2}\\.\\d{2}[^\\n]{0,30})/
                ) || allText.match(/(\\d{4}\\.\\d{2}\\.\\d{2}\\s*~\\s*\\d{4}\\.\\d{2}\\.\\d{2})/);
                if (dateMatch) salePeriod = dateMatch[1].trim().slice(0, 60);
            }

            // ── 이미지 (올리브영: class 없음, URL 패턴으로 필터) ──
            let image = '';
            for (const el of document.querySelectorAll('img')) {
                const src = el.src || el.dataset.src || '';
                if (src.includes('cfimages/cf-goods') || src.includes('image.oliveyoung.co.kr/cfimages')) {
                    image = src;
                    break;
                }
            }

            return { name, brand, sale_price: salePrice, original_price: origPrice, image, sale_period: salePeriod };
        }""")

        if result and result.get("sale_price"):
            return result
    except Exception as e:
        print(f"    ⚠️  DOM 추출 실패: {e}")

    return {}


async def find_rank(page, keyword: str, product_id: str):
    if not keyword:
        return None
    try:
        from urllib.parse import quote
        search_url = f"https://www.oliveyoung.co.kr/store/search/getSearchMain.do?query={quote(keyword)}&rowsPerPage=48"
        await page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(2000)
        rank = await page.evaluate("""(pid) => {
            const links = Array.from(document.querySelectorAll('a[href*="goodsNo="]'));
            const seen = new Set();
            let pos = 0;
            for (const a of links) {
                const m = a.href.match(/goodsNo=([A-Z0-9]+)/i);
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


async def save_to_supabase(data: dict):
    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{SUPABASE_URL}/rest/v1/oliveyoung_prices?on_conflict=product_id",
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


async def main():
    print(f"\n🚀 올리브영 가격 수집 시작 ({datetime.now().strftime('%Y-%m-%d %H:%M')})")

    links = await fetch_links()
    if not links:
        print("❌ 수집할 링크 없음 — 대시보드 올리브영 탭에서 링크를 추가해주세요")
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
                        print(f"  🏆 순위: {rank}위" if rank else "  ⚠️  순위 없음 (48위 밖)")
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
    with open("oliveyoung_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print("📄 oliveyoung_results.json 저장됨")


if __name__ == "__main__":
    asyncio.run(main())
