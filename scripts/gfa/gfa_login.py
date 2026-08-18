#!/usr/bin/env python3
"""GFA(네이버 광고주센터) 로그인 세션 저장 — 창이 뜨면 네이버 로그인만 하면 됨.

사용법: python3 gfa_login.py
로그인 감지 시 자동 종료, 세션은 .gfa_profile에 저장됨 (gfa_sync.py가 재사용).
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
PROFILE = HERE / ".gfa_profile"

with sync_playwright() as pw:
    ctx = pw.chromium.launch_persistent_context(
        user_data_dir=str(PROFILE), channel="chrome", headless=False,
        viewport=None, args=["--disable-blink-features=AutomationControlled"])
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.goto("https://ads.naver.com", timeout=60000)
    print("창에서 네이버 로그인 해주세요 (로그인 유지 체크 권장). 최대 10분 대기...")
    logged_in = False
    for i in range(120):  # 10분, 5초 간격
        page.wait_for_timeout(5000)
        try:
            cookies = {c["name"] for c in ctx.cookies("https://naver.com")}
            if "NID_AUT" in cookies and "NID_SES" in cookies:
                logged_in = True
                break
        except Exception:
            pass
    if logged_in:
        print("로그인 감지 — 세션 저장 완료. 5초 후 창을 닫습니다.")
        page.wait_for_timeout(5000)
    else:
        print("로그인 미감지 (10분 초과) — 다시 실행해주세요.")
    ctx.close()
