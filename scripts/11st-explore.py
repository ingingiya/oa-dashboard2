#!/usr/bin/env python3
"""11번가 셀러오피스 로그인 확인 + 광고센터 진입 탐색"""
import sys, time, pathlib
from playwright.sync_api import sync_playwright

PROFILE = "/Users/kirby/.pw-11st"

def log(*a):
    print(*a, flush=True)

with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(PROFILE, headless=False, viewport={"width": 1500, "height": 950})
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.goto("https://soffice.11st.co.kr/view/main", wait_until="domcontentloaded", timeout=60000)
    time.sleep(6)
    log("URL:", page.url)
    log("TITLE:", page.title())
    page.screenshot(path="/tmp/11st.png")
    links = page.eval_on_selector_all("a", """els => els
      .map(a => ({t: (a.innerText||'').trim().replace(/\\n/g,' ').slice(0,50), h: a.href}))
      .filter(x => /광고|입찰|키워드|포커스|애드|ad(center|off)/i.test(x.t + ' ' + x.h))
      .slice(0, 50)""")
    for l in links:
        log(f"- {l['t']} → {l['h']}")

    # 새 탭(광고센터) 열림 감지용
    def on_page(np):
        log("NEW PAGE:", np.url)
    ctx.on("page", on_page)

    log("--- 브라우저 180초 유지 ---")
    try:
        time.sleep(180)
    except KeyboardInterrupt:
        pass
    for pg in ctx.pages:
        log("OPEN TAB:", pg.url)
    page.screenshot(path="/tmp/11st_end.png")
    ctx.close()
