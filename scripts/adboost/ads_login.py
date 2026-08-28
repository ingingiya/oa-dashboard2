#!/usr/bin/env python3
"""통합광고주센터(ads.naver.com) 로그인 — 네이버 아이디(NID), 세션은 프로필에 유지됨.
창에서 로그인 상태 유지 체크하고 로그인해주세요.
"""
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
PROFILE = HERE / ".adboost_profile"

with sync_playwright() as pw:
    ctx = pw.chromium.launch_persistent_context(
        user_data_dir=str(PROFILE), channel="chrome", headless=False,
        viewport=None, args=["--disable-blink-features=AutomationControlled"])
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.goto("https://nid.naver.com/nidlogin.login?url=https%3A%2F%2Fads.naver.com%2F", timeout=60000)
    print("⏳ 네이버 아이디로 로그인해주세요 — [로그인 상태 유지] 체크! (최대 10분)")
    ok = False
    for _ in range(300):
        time.sleep(2)
        if "ads.naver.com" in page.url and "nid.naver" not in page.url:
            ok = True
            break
    print("✅ 로그인:" if ok else "⛔ 시간 초과:", page.url)
    time.sleep(4)
    page.screenshot(path=str(HERE / "ads_home.png"))
    print("📸", HERE / "ads_home.png")
    ctx.close()
