#!/usr/bin/env python3
"""에이블리 광고 30일 성과 → docs/ably-ads.json (로그인 ~/.oa-ad-creds/ably, 세션은 프로세스 내에서만 유지)"""
import time, pathlib, json
from datetime import date, timedelta
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
cred = dict(l.split("=", 1) for l in pathlib.Path.home().joinpath(".oa-ad-creds/ably").read_text().strip().splitlines())
END = date.today() - timedelta(days=1); START = END - timedelta(days=29); MKT = 12065
out = {"updated": date.today().isoformat(), "period": f"{START}~{END}"}
with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context("/Users/kirby/.pw-ably", headless=False, channel="chrome", viewport={"width": 1400, "height": 900}, args=["--disable-blink-features=AutomationControlled"])
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.goto("https://my.a-bly.com/login", wait_until="domcontentloaded", timeout=60000); time.sleep(5)
    fr = next((f for f in page.frames if f.locator("input[type=password]:visible").count()), page)
    idf = fr.locator("input[type=text]:visible, input[type=email]:visible, input:not([type]):visible").first; pwf = fr.locator("input[type=password]:visible").first
    idf.click(); idf.type(cred["ID"], delay=50); pwf.click(); pwf.type(cred["PW"], delay=50); pwf.press("Enter"); time.sleep(8)
    # 인증 헤더 캡처: 대시보드 로드 중 api 요청의 Authorization 헤더
    hdr = {}
    def on_req(r):
        if "api.a-bly.com/seller" in r.url and r.headers.get("authorization") and not hdr: hdr.update({k: v for k, v in r.headers.items() if k.lower() in ("authorization", "x-app-version", "accept")})
    page.on("request", on_req)
    page.goto("https://my.a-bly.com/ad/dashboard", wait_until="domcontentloaded", timeout=60000); time.sleep(8)
    print("auth header captured:", bool(hdr), flush=True)
    def get(url):
        r = page.request.get(url, headers=hdr); return r.json() if r.ok else {"error": r.status, "body": r.text()[:200]}
    out["statistics_30d"] = get(f"https://api.a-bly.com/seller/ad_markets/{MKT}/statistics/?start_at={START}&end_at={END}&app_type=0")
    out["timeseries_30d"] = get(f"https://api.a-bly.com/seller/ad_markets/{MKT}/statistics_timeseries/?start_at={START}&end_at={END}&periodicity=daily")
    camps = get(f"https://api.a-bly.com/seller/ad_campaigns/?page=1&per_page=9999&statistics_start_date={START}&statistics_end_date={END}")
    out["campaigns_30d"] = [{k: c.get(k) for k in c if k in ("sno", "title", "is_default_campaign", "ad_status_description_code", "goods_count", "daily_budget") or "statistic" in k or k in ("display", "click", "charge", "order_price", "order_count", "roas", "cpc")} for c in (camps.get("results") or [])] if isinstance(camps, dict) else camps
    s = out["statistics_30d"]; print("30d:", {k: s.get(k) for k in ("display", "click", "charge", "order_price", "order_count", "cpc", "cpm", "roas")} if isinstance(s, dict) else s, flush=True)
    print("campaigns:", len(out["campaigns_30d"]) if isinstance(out["campaigns_30d"], list) else out["campaigns_30d"], flush=True)
    if isinstance(out["campaigns_30d"], list) and out["campaigns_30d"]: print("sample keys:", list(out["campaigns_30d"][0].keys())[:20], flush=True)
    ctx.close()
(ROOT / "docs" / "ably-ads.json").write_text(json.dumps(out, ensure_ascii=False, indent=1)); print("saved docs/ably-ads.json")
