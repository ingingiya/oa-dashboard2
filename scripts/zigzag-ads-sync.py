#!/usr/bin/env python3
"""지그재그(카카오스타일 파트너센터) 광고 30일 성과 → docs/zigzag-ads.json
로그인 ~/.oa-ad-creds/zigzag (oa@k2ci.com). 파트너센터 GraphQL GetAdPartnerAdSetDailyStatsList 직접 호출 (세션은 프로세스 내)."""
import time, pathlib, json
from datetime import date, timedelta
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent; SHOP = "cq-zqoplb6d"
cred = dict(l.split("=", 1) for l in pathlib.Path.home().joinpath(".oa-ad-creds/zigzag").read_text().strip().splitlines())
END = date.today() - timedelta(days=1); START = END - timedelta(days=29); ymd = lambda d: int(d.strftime("%Y%m%d"))
Q = """query GetAdPartnerAdSetDailyStatsList($date_ymd_gte: Int!, $date_ymd_lte: Int!, $site_id: ID!) {
  ad_partner_ad_set_daily_stats_list(date_ymd_gte: $date_ymd_gte, date_ymd_lte: $date_ymd_lte, site_id: $site_id) {
    total_basic_metrics { billing click cpc cpv ctr view }
    total_quality_index_by_date { d3 { click_order_amount click_order_count } d7 { click_order_amount click_order_count } d14 { click_order_amount click_order_count } }
  } }"""
def fetch(page, a, b):
    r = page.request.post(f"https://partners.kakaostyle.com/api/provider/{SHOP}/graphql/GetAdPartnerAdSetDailyStatsList", data=json.dumps({"query": Q, "variables": {"date_ymd_gte": ymd(a), "date_ymd_lte": ymd(b), "site_id": "1"}}), headers={"Content-Type": "application/json"})
    return r.json()["data"]["ad_partner_ad_set_daily_stats_list"]
with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context("/Users/kirby/.pw-zigzag", headless=False, channel="chrome", viewport={"width": 1300, "height": 800}, args=["--disable-blink-features=AutomationControlled"])
    page = ctx.new_page(); page.goto(f"https://partners.kakaostyle.com/shop/{SHOP}/home", wait_until="domcontentloaded", timeout=60000); time.sleep(5)
    if page.locator("input[type=password]:visible").count():
        page.get_by_placeholder("이메일 주소").fill(cred["ID"]); page.get_by_placeholder("비밀번호").fill(cred["PW"]); page.get_by_role("button", name="로그인").click(); time.sleep(8)
    tot = fetch(page, START, END)
    daily = {}
    for i in range(30):  # 일별 시계열 (하루 단위 호출)
        d = START + timedelta(days=i)
        try:
            m = fetch(page, d, d)["total_basic_metrics"]; daily[d.isoformat()] = {"spend": m["billing"], "clicks": m["click"], "imp": m["view"], "cpc": round(m["cpc"]) if m["cpc"] else None}
        except Exception as e: daily[d.isoformat()] = {"error": str(e)[:60]}
        time.sleep(0.3)
    ctx.close()
m = tot["total_basic_metrics"]; q7 = tot["total_quality_index_by_date"]["d7"]
out = {"updated": date.today().isoformat(), "period": f"{START}~{END}", "summary_30d": {"spend": m["billing"], "clicks": m["click"], "cpc": m["cpc"], "imp": m["view"], "ctr": m["ctr"], "conv": q7["click_order_count"], "rev": q7["click_order_amount"], "roas": round(q7["click_order_amount"] / m["billing"], 2) if m["billing"] else None}, "quality": tot["total_quality_index_by_date"], "daily": daily}
print("30d:", out["summary_30d"], "| daily days:", sum(1 for v in daily.values() if "cpc" in v), flush=True)
(ROOT / "docs" / "zigzag-ads.json").write_text(json.dumps(out, ensure_ascii=False, indent=1)); print("saved docs/zigzag-ads.json")
