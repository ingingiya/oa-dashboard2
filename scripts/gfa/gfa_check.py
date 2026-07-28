#!/usr/bin/env python3
"""GFA 관리시스템 접속 — API 신청 메뉴 확인용. 고정 프로필로 로그인 유지."""
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
PROFILE = HERE / ".gfa_profile"

with sync_playwright() as pw:
    ctx = pw.chromium.launch_persistent_context(
        user_data_dir=str(PROFILE), channel="chrome", headless=False,
        viewport=None, args=["--disable-blink-features=AutomationControlled"])
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.goto("https://gfa.naver.com", timeout=60000)
    page.wait_for_load_state("domcontentloaded")
    print("URL:", page.url)
    print("로그인 필요하면 창에서 로그인하세요. 3분 대기 후 스크린샷 저장.")
    for i in range(36):  # 최대 3분, 5초 간격으로 URL 변화 감시
        page.wait_for_timeout(5000)
        if "gfa.naver.com" in page.url and "nid.naver" not in page.url and "auth" not in page.url:
            page.wait_for_timeout(3000)
            break
    print("최종 URL:", page.url)
    page.screenshot(path=str(HERE / "gfa_home.png"), full_page=False)
    print("screenshot saved:", HERE / "gfa_home.png")
    ctx.close()
