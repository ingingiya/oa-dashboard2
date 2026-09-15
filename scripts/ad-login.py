#!/usr/bin/env python3
"""광고센터 자동 로그인 → 프로필 세션 저장. 자격증명 ~/.oa-ad-creds/<site> (크롬 저장분에서 복호화, 0600)
사용: python3 scripts/ad-login.py 11st|esm|coupang|ably|musinsa [--headed]"""
import sys, time, pathlib
from playwright.sync_api import sync_playwright
SITES = {
  "11st":    ("/Users/kirby/.pw-11st",   "https://adoffice.11st.co.kr/sellers/1262/dashboard"),
  "esm":     ("/Users/kirby/.pw-esmplus","https://www.esmplus.com"),
  "coupang": ("/Users/kirby/.pw-coupang","https://advertising.coupang.com"),
  "ably":    ("/Users/kirby/.pw-ably",   "https://my.a-bly.com"),
  "musinsa": ("/Users/kirby/.pw-musinsa","https://bizest.musinsa.com"),
}
key = sys.argv[1]; headed = "--headed" in sys.argv; prof, url = SITES[key]
cred = dict(l.split("=", 1) for l in pathlib.Path.home().joinpath(".oa-ad-creds", key).read_text().strip().splitlines())
def is_login(page):
    try: return "로그인" in page.title() or "login" in page.url.lower() or "signin" in page.url.lower() or "auth" in page.url.lower()
    except Exception: return True
with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(prof, headless=not headed, channel="chrome", viewport={"width": 1400, "height": 950}, args=["--disable-blink-features=AutomationControlled"])
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.goto(url, wait_until="domcontentloaded", timeout=60000); time.sleep(5)
    print(f"[{key}] {page.url[:80]} | {page.title()}", flush=True)
    if is_login(page):
        fr = next((f for f in page.frames if f.locator("input[type=password]:visible").count()), page)
        idf = fr.locator("input[type=text]:visible, input[type=email]:visible").first; pwf = fr.locator("input[type=password]:visible").first
        idf.click(); idf.fill(""); idf.type(cred["ID"], delay=50); pwf.click(); pwf.fill(""); pwf.type(cred["PW"], delay=50); time.sleep(0.5)
        pwf.press("Enter"); time.sleep(10)
        page.screenshot(path=f"/tmp/adlogin_{key}.png")
        print(f"[{key}] after: {page.url[:90]} | {page.title()}", flush=True)
        try:
            t = page.inner_text("body"); msg = [l for l in t.splitlines() if any(k in l for k in ("일치", "확인", "실패", "오류", "인증", "잠금", "captcha", "보안"))][:4]
            if msg: print(f"[{key}] msg: {msg}", flush=True)
        except Exception: pass
    for i in range(60 if headed else 3):
        if not is_login(page): print(f"[{key}] LOGGED IN → {page.url[:90]}", flush=True); time.sleep(3); break
        time.sleep(5)
    else: print(f"[{key}] NOT logged in", flush=True)
    ctx.close()
