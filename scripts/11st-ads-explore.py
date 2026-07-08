#!/usr/bin/env python3
"""11번가 광고센터(AD OFFICE) 탐색 — 포커스클릭 키워드/입찰 메뉴 찾기"""
import sys, time, pathlib
from playwright.sync_api import sync_playwright

PROFILE = "/Users/kirby/.pw-11st"
URL = sys.argv[1] if len(sys.argv) > 1 else "https://adoffice.11st.co.kr/sellers/1262/dashboard"
creds = dict(l.split("=", 1) for l in pathlib.Path.home().joinpath(".11st-creds").read_text().strip().splitlines())

def log(*a):
    print(*a, flush=True)

with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(PROFILE, headless=False, viewport={"width": 1600, "height": 1000})
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.goto(URL, wait_until="domcontentloaded", timeout=60000)
    time.sleep(6)
    log("URL:", page.url)
    log("TITLE:", page.title())
    # AD OFFICE 별도 로그인 폼이면 1회만 자동 시도
    try:
        pwbox = page.locator("input[type='password']:visible").first
        if pwbox.is_visible():
            idbox = page.locator("input[type='text']:visible").first
            idbox.click(); idbox.type(creds["ID"], delay=80)
            pwbox.click(); pwbox.type(creds["PW"], delay=80)
            page.get_by_text("로그인", exact=True).first.click()
            time.sleep(8)
            log("AFTER LOGIN URL:", page.url)
            if "login" in page.url.lower() or page.locator("input[type='password']").first.is_visible():
                log("자동 로그인 실패 — 창에서 직접 로그인해주세요 (재시도 안 함)")
    except Exception as e:
        log("로그인 시도 스킵:", e)
    page.screenshot(path="/tmp/11ads.png", full_page=False)
    links = page.eval_on_selector_all("a, button", """els => els
      .map(a => ({t: (a.innerText||'').trim().replace(/\\n/g,' ').slice(0,50), h: a.href||''}))
      .filter(x => x.t && /광고|입찰|키워드|포커스|캠페인|리포트|관리/.test(x.t))
      .slice(0, 60)""")
    seen = set()
    for l in links:
        k = l['t'] + l['h']
        if k in seen: continue
        seen.add(k)
        log(f"- {l['t']} → {l['h']}")
    log("--- 브라우저 180초 유지 ---")
    try:
        time.sleep(180)
    except KeyboardInterrupt:
        pass
    for pg in ctx.pages:
        log("OPEN TAB:", pg.url)
    page.screenshot(path="/tmp/11ads_end.png")
    ctx.close()
