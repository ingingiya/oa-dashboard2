#!/usr/bin/env python3
"""애드부스트 상시 브라우저 데몬 — 커머스ID 세션은 브라우저 종료 시 소멸되므로
브라우저를 계속 띄워두고(CDP 9223) 크롤러는 여기 접속만 한다.
launchd com.oa.adboostdaemon (KeepAlive) — 재부팅 후엔 창에서 재로그인 필요.
"""
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
PROFILE = HERE / ".adboost_profile"

with sync_playwright() as pw:
    ctx = pw.chromium.launch_persistent_context(
        user_data_dir=str(PROFILE), channel="chrome", headless=False,
        viewport={"width": 1380, "height": 860},
        args=["--disable-blink-features=AutomationControlled", "--remote-debugging-port=9223",
              "--window-size=1380,860"])
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    try:
        page.goto("https://sell.smartstore.naver.com/#/home/dashboard", timeout=60000)
    except Exception:
        pass
    print("🟢 애드부스트 데몬 가동 — CDP :9223 (창을 닫지 마세요, 최소화는 OK)")
    while True:
        time.sleep(3600)
