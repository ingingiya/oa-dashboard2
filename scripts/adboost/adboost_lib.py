#!/usr/bin/env python3
"""AD부스터(통합광고주센터 ads.naver.com) 공용 헬퍼 — NID 자동 로그인 + 계정 상수.
세션이 브라우저 재시작마다 풀리므로 매 실행 로그인 (자격증명 .env)."""
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROFILE = HERE / ".adboost_profile"
ACCOUNT = "1742505"
DASH = f"https://ads.naver.com/manage/ad-accounts/{ACCOUNT}/dashboard"


def load_env():
    return dict(l.split("=", 1) for l in (HERE / ".env").read_text().strip().splitlines())


def launch(pw, headless=False):
    return pw.chromium.launch_persistent_context(
        user_data_dir=str(PROFILE), channel="chrome", headless=headless,
        viewport={"width": 1600, "height": 950},
        args=["--disable-blink-features=AutomationControlled", "--window-position=2400,2400"])


def ensure_login(page):
    env = load_env()
    page.goto(DASH, timeout=60000)
    page.wait_for_timeout(5000)
    if "nid.naver" in page.url:
        page.fill("#id", env["NID_ID"])
        page.fill("#pw", env["NID_PW"])
        try:
            page.check("#keep", timeout=2000)
        except Exception:
            pass
        page.keyboard.press("Enter")
        for _ in range(25):
            page.wait_for_timeout(2000)
            if "ads.naver.com" in page.url and "nid" not in page.url:
                break
            try:
                if page.locator("text=등록안함").count():
                    page.click("text=등록안함")
            except Exception:
                pass
        page.wait_for_timeout(4000)
        if "ads.naver.com" not in page.url:
            raise RuntimeError("광고주센터 로그인 실패 — 캡차/2단계 가능성, ads_login.py로 수동 확인")
    return page
