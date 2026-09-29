#!/usr/bin/env python3
"""X(트위터) 광고관리자 로그인 세션 저장 — 창이 뜨면 OA 광고 계정으로 로그인만 하면 됨.

사용법: python3 xads_login.py
로그인 감지 시 자동 종료, 세션은 .xads_profile에 저장됨 (xads_stats.py가 재사용).
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
PROFILE = HERE / ".xads_profile"
ACCOUNT = "18ce55spa1p"

with sync_playwright() as pw:
    ctx = pw.chromium.launch_persistent_context(
        user_data_dir=str(PROFILE), channel="chrome", headless=False,
        viewport=None, args=["--disable-blink-features=AutomationControlled"])
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.goto(f"https://ads.x.com/campaign_form/{ACCOUNT}", timeout=60000)
    print("창에서 X 광고 계정으로 로그인 해주세요. 최대 10분 대기...")
    import time
    ok = False
    for _ in range(120):
        time.sleep(5)
        try:
            names = {c["name"] for c in ctx.cookies(["https://x.com", "https://ads.x.com"])}
            if "auth_token" in names and "ct0" in names:
                ok = True
                break
            if not ctx.pages:  # 탭을 다 닫았으면 다시 열어줌
                ctx.new_page().goto(f"https://ads.x.com/campaign_form/{ACCOUNT}", timeout=60000)
        except Exception as e:
            if "closed" in str(e).lower():
                print("브라우저가 닫혔습니다 — 로그인 미완료. 다시 실행해주세요.")
                raise SystemExit(1)
    if ok:
        print("로그인 감지 — 세션 저장 완료. 5초 후 창을 닫습니다.")
        try:
            pg = ctx.pages[0] if ctx.pages else ctx.new_page()
            pg.goto(f"https://ads.x.com/campaign_management/{ACCOUNT}", timeout=60000)
            time.sleep(5)
        except Exception:
            pass
    else:
        print("로그인 미감지 (10분 초과) — 다시 실행해주세요.")
    try: ctx.close()
    except Exception: pass
