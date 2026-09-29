#!/usr/bin/env python3
"""X 자동 로그인 → .xads_profile 세션 저장. 사용법: X_USER=.. X_PASS=.. python3 xads_autologin.py"""
import os, time
from pathlib import Path
from playwright.sync_api import sync_playwright
HERE = Path(__file__).resolve().parent
PROFILE = HERE / ".xads_profile"
ACCOUNT = "18ce55spa1p"
USER, PASS = os.environ["X_USER"], os.environ["X_PASS"]
with sync_playwright() as pw:
    ctx = pw.chromium.launch_persistent_context(user_data_dir=str(PROFILE), channel="chrome", headless=False,
        viewport={"width": 1280, "height": 900}, args=["--disable-blink-features=AutomationControlled"])
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.goto("https://x.com/i/flow/login", timeout=60000)
    page.wait_for_timeout(4000)
    u = page.locator('input[name="username_or_email"]:visible, input[autocomplete="username"]:visible').first
    u.fill(USER); u.press("Enter"); page.wait_for_timeout(4000)
    # 가끔 이메일/전화 확인 단계
    if page.locator('input[data-testid="ocfEnterTextTextInput"]').count():
        page.fill('input[data-testid="ocfEnterTextTextInput"]', USER); page.keyboard.press("Enter"); page.wait_for_timeout(3000)
    pw_in = page.locator('input[name="password"]:visible').first
    pw_in.wait_for(timeout=30000); pw_in.fill(PASS); pw_in.press("Enter")
    ok = False
    for _ in range(24):
        page.wait_for_timeout(5000)
        names = {c["name"] for c in ctx.cookies(["https://x.com"])}
        if "auth_token" in names and "ct0" in names: ok = True; break
    page.screenshot(path=str(HERE / "login_state.png"))
    print("LOGIN_OK" if ok else "LOGIN_FAIL", page.url)
    print(page.inner_text("body")[:600].replace("\n", " | "))
    if ok:
        page.goto(f"https://ads.x.com/campaign_management/{ACCOUNT}", timeout=60000)
        page.wait_for_timeout(8000)
        page.screenshot(path=str(HERE / "ads_state.png"))
        print("ADS_URL", page.url)
    ctx.close()
