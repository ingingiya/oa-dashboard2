#!/usr/bin/env python3
"""GFA 기간 합계+캠페인별+직전기간+신규소재 JSON 출력 (daily-ad-report.mjs 용).

사용법: gfa_daily.py [START END [NEW_SINCE]]  (생략 시 어제~어제, 신규는 오늘 시작 소재)
출력: {"tot":{cost,imp,clk,buy,rev}, "prev":{...직전 7일...},
       "camps":[{name,cost,buy,rev} 지출순], "newCreatives":[이름...], "error":null}
"""
import json, re, sys
from datetime import date, timedelta
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
PROFILE = HERE / ".gfa_profile"
ACCOUNT = 1742505


def sched_start(s):
    m = re.match(r"(\d{4})\.(\d{1,2})\.(\d{1,2})", str(s or ""))
    return date(int(m[1]), int(m[2]), int(m[3])) if m else None


def fetch_range(ctx, start, end):
    tot = {"cost": 0, "imp": 0, "clk": 0, "buy": 0, "rev": 0}
    camps = {}
    creatives = {}  # name → 시작일
    page = 1
    while True:
        url = (f"https://ads.naver.com/apis/report/gfa/v1/adAccounts/{ACCOUNT}"
               f"/stats/reportPerformance?startDate={start}&endDate={end}"
               f"&reportAdUnit=CREATIVE&reportFilterListString=%5B%5D"
               f"&pageNumber={page}&pageSize=100")
        r = ctx.request.get(url, headers={
            "Referer": f"https://ads.naver.com/manage/ad-accounts/{ACCOUNT}/da/report/performance"})
        if r.status != 200:
            raise RuntimeError(f"HTTP {r.status}")
        d = r.json()
        for it in d.get("reportPerformanceDetailResponseList") or []:
            cost = it.get("sales") or 0
            buy = it.get("purchaseConvCount") or 0
            rev = it.get("purchaseConvSales") or 0
            tot["cost"] += cost
            tot["imp"] += it.get("impCount") or 0
            tot["clk"] += it.get("clickCount") or 0
            tot["buy"] += buy
            tot["rev"] += rev
            cn = it.get("campaignName") or "(기타)"
            c = camps.setdefault(cn, {"name": cn, "cost": 0, "buy": 0, "rev": 0})
            c["cost"] += cost
            c["buy"] += buy
            c["rev"] += rev
            nm = it.get("creativeName")
            if nm and nm not in creatives:
                creatives[nm] = sched_start(it.get("scheduleString"))
        if page >= (d.get("totalPage") or 1):
            break
        page += 1
    return tot, sorted(camps.values(), key=lambda c: -c["cost"]), creatives


try:
    if len(sys.argv) >= 3:
        start, end = sys.argv[1], sys.argv[2]
    else:
        start = end = (date.today() - timedelta(days=1)).isoformat()
    s = date.fromisoformat(start)
    # 평소 비교 기준: 시작일 직전 7일 (주간 모드면 곧 직전 주)
    ps, pe = (s - timedelta(days=7)).isoformat(), (s - timedelta(days=1)).isoformat()
    with sync_playwright() as pw:
        ctx = pw.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE), channel="chrome", headless=True,
            args=["--disable-blink-features=AutomationControlled"])
        if "NID_AUT" not in {c["name"] for c in ctx.cookies("https://naver.com")}:
            raise RuntimeError("네이버 세션 만료 — gfa_login.py 재실행 필요")
        tot, camps, _ = fetch_range(ctx, start, end)
        prev, _, _ = fetch_range(ctx, ps, pe)
        # 신규 소재: 오늘 스냅샷에서 시작일 >= new_since
        new_since = date.fromisoformat(sys.argv[3]) if len(sys.argv) >= 4 else date.today()
        today = date.today().isoformat()
        _, _, todays = fetch_range(ctx, today, today)
        new_creatives = sorted(n for n, sd in todays.items() if sd and sd >= new_since)
        ctx.close()
    print(json.dumps({"tot": tot, "prev": prev, "camps": camps,
                      "newCreatives": new_creatives, "error": None}, ensure_ascii=False))
except Exception as e:
    print(json.dumps({"tot": None, "prev": None, "camps": [], "newCreatives": [],
                      "error": str(e)}))
    sys.exit(0)
