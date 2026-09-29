#!/usr/bin/env python3
"""X 광고관리자 내부 API로 캠페인별 일자별 광고비/노출/클릭 수집 → JSON stdout.
사용법: python3 xads_stats.py START END [--filter 트래픽,카카오] [--raw]
세션: .xads_profile (xads_autologin.py / xads_login.py 로 생성). 출력: {제품: {날짜: {cost,imp,clk}}}
"""
import sys, json, re, datetime as dt, warnings
warnings.filterwarnings('ignore')
from pathlib import Path
import requests
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
ACCT, QID = "18ce55spa1p", "4503599745048349"
args = [a for a in sys.argv[1:] if not a.startswith("--")]
start, end = args[0], args[1]
flt = [f.strip() for f in (sys.argv[sys.argv.index("--filter") + 1] if "--filter" in sys.argv else "트래픽,카카오").split(",") if f.strip()]
RAW = "--raw" in sys.argv
WITH_STATUS = "--with-status" in sys.argv  # 출력 {"data":..., "status":{제품: true=집행중}}
PRODUCTS = ["듀얼포켓건", "히트스팟S", "히트스팟", "눈편한세상", "넥스트레쳐", "롤링스팟", "소닉플로우", "에어리소닉", "클린이스윙"]

with sync_playwright() as pw:
    ctx = pw.chromium.launch_persistent_context(user_data_dir=str(HERE / ".xads_profile"), channel="chrome", headless=True)
    ck = {c["name"]: c["value"] for c in ctx.cookies(["https://x.com", "https://ads.x.com"])}
    ctx.close()
if "auth_token" not in ck or "ct0" not in ck:
    print(json.dumps({"error": "X 세션 없음 — xads_autologin.py 재실행 필요"})); sys.exit(2)
bearer = (HERE / "bearer.txt").read_text().strip()
H = {"authorization": f"Bearer {bearer}", "x-csrf-token": ck["ct0"], "x-twitter-auth-type": "OAuth2Session",
     "content-type": "application/json", "origin": "https://ads.x.com", "referer": "https://ads.x.com/"}
S = requests.Session(); S.headers.update(H); S.cookies.update({"auth_token": ck["auth_token"], "ct0": ck["ct0"]})

def query(d):
    items, page = [], 1
    while True:
        body = {"page": page, "page_size": 100, "sort_by": "created_at", "sort_order": "desc", "include_deleted": False,
                "start_date": d, "end_date": d, "timezone": "Asia/Seoul", "objective_filter": [1, 3, 51, 9, 11, 50, 4, 5]}
        r = S.post(f"https://ads-api.x.com/11/accounts/{ACCT}/ad-query/api/v1/{QID}/campaigns", json=body, timeout=60)
        if r.status_code in (401, 403):
            print(json.dumps({"error": f"X 세션 만료({r.status_code}) — xads_autologin.py 재실행 필요"})); sys.exit(2)
        if not r.ok:
            print(json.dumps({"error": f"X {r.status_code}: {r.text[:200]}"})); sys.exit(1)
        j = r.json(); got = j.get("items", []); items += got
        if len(got) < 100 or len(items) >= (j.get("total") or 0): break
        page += 1
    return items

def product_of(name):
    for p in PRODUCTS:
        if p in name: return p
    return re.sub(r"^\d{6}_?", "", name).strip() or name

out = {}; status = {}
d0, d1 = dt.date.fromisoformat(start), dt.date.fromisoformat(end)
d = d0
while d <= d1:
    ds = d.isoformat()
    for it in query(ds):
        name = it["name"]
        if not any(f in name for f in flt): continue
        if not it.get("deleted"): status[name if RAW else product_of(name)] = status.get(name if RAW else product_of(name), False) or it.get("serving_status") == 0  # serving_status 0=집행중, 1=일시중지
        s = it["stats"]
        cost, imp, clk = s["total_spend_local_micro"] / 1e6, s["total_impressions"], s["total_clicks"]
        if cost == 0 and imp == 0: continue
        key = name if RAW else product_of(name)
        t = out.setdefault(key, {}).setdefault(ds, {"cost": 0, "imp": 0, "clk": 0})
        t["cost"] += cost; t["imp"] += imp; t["clk"] += clk
    d += dt.timedelta(days=1)
print(json.dumps({"data": out, "status": status} if WITH_STATUS else out, ensure_ascii=False))
