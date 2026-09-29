#!/usr/bin/env python3
"""네이버 광고주센터(AD부스터) 수동 로그인 창 — 캡차/2단계로 자동 로그인이 막힐 때. 로그인 완료 감지 시 세션 저장 후 자동 종료 (프로필 .adboost_profile)."""
import time, sys
from playwright.sync_api import sync_playwright
from adboost_lib import PROFILE, DASH
with sync_playwright() as pw:
    ctx = pw.chromium.launch_persistent_context(user_data_dir=str(PROFILE), channel="chrome", headless=False, viewport={"width": 1400, "height": 950}, args=["--disable-blink-features=AutomationControlled"])
    page = ctx.pages[0] if ctx.pages else ctx.new_page(); page.goto(DASH, timeout=60000); page.wait_for_timeout(4000)
    print("URL:", page.url, flush=True)
    if "nid.naver" not in page.url and "ads.naver.com" in page.url: print("이미 로그인됨", flush=True)
    else:
        print("로그인 창 대기 (최대 10분) — 창에서 네이버 로그인 해주세요", flush=True)
        for _ in range(300):
            time.sleep(2)
            if "ads.naver.com" in page.url and "nid" not in page.url: print("로그인 감지 ✓", flush=True); break
        else: print("시간 초과", flush=True); sys.exit(1)
    page.wait_for_timeout(3000); ctx.close(); print("세션 저장 완료", flush=True)
