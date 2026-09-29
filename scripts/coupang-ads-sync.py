#!/usr/bin/env python3
"""쿠팡 광고센터 30일 성과 → docs/coupang-ads.json
로그인 ~/.oa-ad-creds/coupang (Wing k2ci01). 광고보고서 > 광고 보고서(매출 성장) 빌더: 기간 설정 → 합계 → 전체 캠페인 → 보고서 만들기 → 다운로드(xlsx).
★다운로드 폴더는 /tmp 금지(샌드박스에서 브라우저가 죽음) → scripts/coupang/downloads"""
import time, pathlib, json, re, io
from datetime import date, timedelta
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent; DL = ROOT / "scripts" / "coupang" / "downloads"; DL.mkdir(parents=True, exist_ok=True)
cred = dict(l.split("=", 1) for l in pathlib.Path.home().joinpath(".oa-ad-creds/coupang").read_text().strip().splitlines())
END = date.today() - timedelta(days=1); START = END - timedelta(days=29)
def login(page):
    for _ in range(8):
        time.sleep(3); u = page.url
        if "advertising.coupang.com" in u and "login" not in u and "xauth" not in u: return True
        if page.locator("input[type=password]:visible").count():
            page.locator("input[type=text]:visible, input[type=email]:visible").first.fill(cred["ID"]); page.locator("input[type=password]:visible").first.fill(cred["PW"]); page.keyboard.press("Enter"); time.sleep(10); continue
        if page.get_by_text("판매자 또는 광고대행사로 로그인").count(): page.get_by_text("판매자 또는 광고대행사로 로그인").first.click(); continue
        if page.get_by_role("button", name="로그인하기").count():
            page.get_by_role("button", name="로그인하기").first.click(); time.sleep(3)
            try: page.get_by_text("한국", exact=True).last.click(timeout=3000); time.sleep(1); page.get_by_text("광고센터로 가기").last.click(timeout=3000); time.sleep(8)
            except Exception: pass
    return False
def set_date(page, idx, val):
    inp = page.locator("input[placeholder*='-'], input[value*='-']").nth(idx)
    inp.click(); page.keyboard.press("Meta+A"); page.keyboard.type(val); page.keyboard.press("Enter"); time.sleep(1)
with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context("/Users/kirby/.pw-coupang", headless=False, channel="chrome", viewport={"width": 1480, "height": 1100}, accept_downloads=True, downloads_path=str(DL), args=["--disable-blink-features=AutomationControlled"])
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.goto("https://advertising.coupang.com/home", wait_until="domcontentloaded", timeout=60000)
    if not login(page): raise SystemExit("login failed")
    page.goto("https://advertising.coupang.com/marketing-reporting/billboard/reports/pa", wait_until="domcontentloaded"); time.sleep(8)
    bb = page.get_by_text("기간 설정", exact=False).first.bounding_box(); page.mouse.click(bb["x"] - 14, bb["y"] + bb["height"] / 2); time.sleep(1)  # 라디오 원 클릭
    dinp = page.locator(".ant-picker-input input, input[placeholder*='20']")
    print("date inputs", dinp.count(), flush=True)
    for i, v in ((0, START.isoformat()), (1, END.isoformat())):
        dinp.nth(i).click(timeout=8000); time.sleep(0.5); page.keyboard.press("Meta+A"); page.keyboard.type(v); page.keyboard.press("Enter"); time.sleep(1)
    shown = page.evaluate("() => [...document.querySelectorAll('input')].map(i=>i.value).filter(v=>/\\d{4}-\\d{2}-\\d{2}/.test(v))"); print("dates:", shown, flush=True)
    page.screenshot(path=str(DL / "before_create.png"))
    page.get_by_text("합계", exact=True).first.click(); time.sleep(0.5)
    page.get_by_role("button", name="캠페인을 선택하세요").first.click(); time.sleep(2)
    page.get_by_text("전체선택", exact=True).first.click(); time.sleep(1); page.get_by_role("button", name="확인").last.click(); time.sleep(1)
    page.get_by_role("button", name="보고서 만들기").first.click(); time.sleep(3)
    for nm in ("확인", "생성"):
        b = page.get_by_role("button", name=nm)
        if b.count() and b.last.is_visible():
            try: b.last.click(timeout=2000)
            except Exception: pass
    page.screenshot(path=str(DL / "after_create.png"))
    # 생성 완료 대기 후 첫 행 다운로드
    ok = False; first = None
    for i in range(40):
        time.sleep(8)
        try: page.get_by_role("button", name="목록 새로 고침").first.click(timeout=3000)
        except Exception: pass
        time.sleep(3)
        first = page.locator("tr", has_text=f"{START} ~ {END}").first
        txt = first.inner_text().replace("\n", " ") if first.count() else ""
        print("row:", txt[:120], flush=True)
        if "생성 완료" in txt: ok = True; break
    if not ok: raise SystemExit("report not ready")
    with page.expect_download(timeout=60000) as dl: first.get_by_role("button", name="다운로드").click()
    f = DL / f"coupang_{END}.xlsx"; dl.value.save_as(str(f)); print("downloaded", f, f.stat().st_size, flush=True)
    ctx.close()
# ── 파싱 ──
import openpyxl
wb = openpyxl.load_workbook(f, data_only=True); ws = wb.active
rows = list(ws.iter_rows(values_only=True)); hdr = None
for i, r in enumerate(rows):
    if r and any(isinstance(c, str) and ("광고비" in c or "클릭" in c) for c in r): hdr = i; break
print("header row", hdr, rows[hdr] if hdr is not None else rows[:3])
H = [str(c or "") for c in rows[hdr]]
def col(*keys):
    for k in keys:
        for j, h in enumerate(H):
            if k in h: return j
    return None
c_name, c_spend, c_clk, c_imp, c_rev, c_ord = col("캠페인명", "캠페인 이름", "캠페인"), col("광고비"), col("클릭수", "클릭"), col("노출수", "노출"), col("총 전환매출", "전환 매출", "매출"), col("총 주문", "주문수", "주문")
camps = []
for r in rows[hdr + 1:]:
    if not r or c_name is None or not r[c_name]: continue
    n = lambda j: float(r[j] or 0) if j is not None and isinstance(r[j], (int, float)) else float(re.sub(r"[^0-9.]", "", str(r[j] or 0)) or 0) if j is not None else 0
    camps.append({"name": str(r[c_name]), "spend": n(c_spend), "clicks": n(c_clk), "imp": n(c_imp), "rev": n(c_rev), "conv": n(c_ord)})
oa = [c for c in camps if "보아르" not in c["name"] and "voar" not in c["name"].lower()]
def agg(cs):
    s = {k: sum(c[k] for c in cs) for k in ("spend", "clicks", "imp", "rev", "conv")}; s["cpc"] = round(s["spend"] / s["clicks"]) if s["clicks"] else None; s["roas"] = round(s["rev"] / s["spend"], 2) if s["spend"] else None; s["n"] = len(cs); return s
out = {"updated": date.today().isoformat(), "period": f"{START}~{END}", "summary_30d": agg(oa), "all_vendors": agg(camps), "header": H, "campaigns": sorted(oa, key=lambda c: -c["spend"])[:80]}
(ROOT / "docs" / "coupang-ads.json").write_text(json.dumps(out, ensure_ascii=False, indent=1)); print("30d OA:", out["summary_30d"], "| all:", out["all_vendors"])
