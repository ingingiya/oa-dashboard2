#!/usr/bin/env python3
"""ESM Plus 파워클릭 탐색용 — 영구 프로필로 열고 로그인 상태/광고 메뉴 확인"""
import sys, time
from playwright.sync_api import sync_playwright

PROFILE = "/Users/kirby/.pw-esmplus"
URL = sys.argv[1] if len(sys.argv) > 1 else "https://www.esmplus.com"

with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(PROFILE, headless=False, viewport={"width": 1500, "height": 950})
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.goto(URL, wait_until="domcontentloaded", timeout=60000)
    time.sleep(5)
    print("URL:", page.url)
    print("TITLE:", page.title())
    page.screenshot(path="/tmp/esm.png", full_page=False)
    # 광고/파워클릭 관련 링크 덤프
    links = page.eval_on_selector_all("a", """els => els
      .map(a => ({t: (a.innerText||'').trim().slice(0,40), h: a.href}))
      .filter(x => x.t && (/광고|파워클릭|입찰|키워드/.test(x.t) || /power|ad/i.test(x.h)))
      .slice(0, 40)""")
    for l in links:
        print(f"- {l['t']} → {l['h']}")
    print("\n브라우저 300초 유지 — 로그인 필요하면 지금 로그인하세요. Ctrl+C로 종료해도 프로필 저장됨.")
    try:
        time.sleep(300)
    except KeyboardInterrupt:
        pass
    ctx.close()
