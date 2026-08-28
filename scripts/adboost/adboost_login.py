#!/usr/bin/env python3
"""애드부스트(스마트스토어센터 커머스솔루션) 로그인 — 고정 프로필에 세션 저장.
창이 뜨면 네이버 로그인 → 로그인 감지 후 애드부스트 메뉴 화면을 스크린샷.
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
    page.goto("https://sell.smartstore.naver.com/", timeout=60000)
    print("⏳ 창에서 [로그인하기] 눌러서 네이버 로그인 해주세요 (최대 10분 대기)")
    ok = False
    for _ in range(300):
        time.sleep(2)
        try:
            body = page.inner_text("body")[:5000]
        except Exception:
            continue
        # 판매자 센터 GNB(판매관리/정산)가 보여야 진짜 로그인
        if ("판매관리" in body or "정산관리" in body or "상품관리" in body) and "가입하기" not in body:
            ok = True
            break
    if not ok:
        print("⛔ 10분 내 로그인 안 됨 — 다시 실행해주세요")
    print("✅ 로그인 감지:", page.url)
    time.sleep(3)
    page.screenshot(path=str(HERE / "smartstore_home.png"))
    print("📸", HERE / "smartstore_home.png")
    ctx.close()
