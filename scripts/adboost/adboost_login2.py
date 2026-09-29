import time,sys
from playwright.sync_api import sync_playwright
from adboost_lib import PROFILE, DASH, load_env
env=load_env()
with sync_playwright() as pw:
    ctx=pw.chromium.launch_persistent_context(user_data_dir=str(PROFILE),channel="chrome",headless=False,viewport={"width":1400,"height":950},args=["--disable-blink-features=AutomationControlled"])
    page=ctx.pages[0] if ctx.pages else ctx.new_page(); page.goto(DASH,timeout=60000); page.wait_for_timeout(4000)
    if "nid.naver" in page.url:
        page.fill("#id",env["NID_ID"]); page.fill("#pw",env["NID_PW"])
        try: page.check("#keep",timeout=2000)
        except Exception: pass
        page.keyboard.press("Enter"); print("자격증명 입력 → 캡차/2단계 있으면 창에서 처리해 주세요",flush=True)
        for _ in range(300):
            time.sleep(2)
            try:
                if page.locator("text=등록안함").count(): page.click("text=등록안함")
            except Exception: pass
            if "ads.naver.com" in page.url and "nid" not in page.url: break
        else: print("시간 초과",flush=True); sys.exit(1)
    print("로그인 완료:",page.url[:80],flush=True); page.wait_for_timeout(3000); ctx.close(); print("세션 저장",flush=True)
