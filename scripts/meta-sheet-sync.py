#!/usr/bin/env python3
"""메타 소재별 일별 성과 → 오아대시보드 구글시트 자동 입력.

동작: Graph API insights(level=ad, 일별) → 시트 마지막 날짜 이후 ~ 어제 구간을
시트와 동일한 30컬럼 포맷으로 만들어 Apps Script 웹앱(doPost)으로 전송.
웹앱이 같은 날짜 기존 행을 지우고 새 행을 붙임 (재실행 안전).

사전 준비(1회): scripts/meta_sheet_webapp.gs 를 구글시트 확장프로그램>Apps Script에
붙여넣고 웹 앱 배포 → 배포 URL을 .env.local 에 SHEET_WEBAPP_URL= 로 저장.

사용법:
  python3 meta-sheet-sync.py            # 시트 마지막 날짜+1 ~ 어제
  python3 meta-sheet-sync.py --since 2026-08-11 --until 2026-08-17
  python3 meta-sheet-sync.py --dry-run  # 전송 없이 행만 출력
"""
import argparse, csv, io, json, sys, urllib.parse, urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GRAPH = "https://graph.facebook.com/v19.0"
SHEET_ID = "1r9WhAOgvdIcumgrkNkTbyYSVj1ONxyXp0trwzD-xAng"
GID = "1293104038"

PURCHASE_TYPES = ["purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase",
                  "web_in_store_purchase", "website_purchase"]
CART_TYPES = ["add_to_cart", "offsite_conversion.fb_pixel_add_to_cart", "omni_add_to_cart"]

HEADER = ["오아뷰티(경은)", "캠페인 이름", "광고 세트 이름", "광고 이름", "일", "목표", "광고",
          "노출", "클릭(전체)", "공유 항목이 포함된 장바구니에 담기", "공유 항목이 포함된 구매",
          "공유 항목의 구매 전환값", "CPC(전체)", "CTR(전체)", "지출 금액 (KRW)", "결과 유형",
          "결과", "결과당 비용", "CPC(링크 클릭당 비용)", "CPM(1,000회 노출당 비용)",
          "공유 항목의 웹사이트 구매 전환값", "공유 항목의 앱 내 구매 전환값만", "링크 클릭",
          "랜딩 페이지 조회", "광고 세트 예산", "광고 세트 예산 유형", "캠페인 예산",
          "캠페인 예산 유형", "보고 시작", "보고 종료"]


def load_env():
    env = {}
    for l in (ROOT / ".env.local").read_text().splitlines():
        if "=" in l and not l.strip().startswith("#"):
            k, v = l.split("=", 1)
            env[k.strip()] = v.strip().strip('"')
    return env


def http_json(url, data=None, timeout=120):
    req = urllib.request.Request(url, data=data,
                                 headers={"Content-Type": "application/json"} if data else {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")[:400]
        if "graph.facebook" in url and ("expired" in body or "OAuthException" in body):
            sys.exit(f"메타 토큰 만료/무효 — scripts/meta-token-renew.py 로 갱신 필요\n{body}")
        sys.exit(f"HTTP {e.code}: {body}")


def act(arr, types):
    if not isinstance(arr, list):
        return 0.0
    for t in types:
        for a in arr:
            if a.get("action_type") == t:
                try:
                    return float(a.get("value") or 0)
                except ValueError:
                    return 0.0
    return 0.0


def sheet_last_date():
    url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={GID}"
    with urllib.request.urlopen(urllib.request.Request(
            url, headers={"User-Agent": "Mozilla/5.0"}), timeout=120) as r:
        rows = list(csv.reader(io.TextIOWrapper(r, encoding="utf-8")))
    hdr = rows[0]
    di = hdr.index("일")
    dates = sorted({r[di] for r in rows[1:] if len(r) > di and r[di][:4].isdigit()})
    return dates[-1] if dates else None


def fetch_budgets(env):
    """광고세트/캠페인 예산 맵 (이름 기준)."""
    token, acct = env["META_ACCESS_TOKEN"], env["META_AD_ACCOUNT_ID"]
    adset, camp = {}, {}
    url = (f"{GRAPH}/{acct}/adsets?fields=name,daily_budget,lifetime_budget,"
           f"campaign{{name,daily_budget,lifetime_budget}}&limit=200&access_token={token}")
    while url:
        d = http_json(url)
        for a in d.get("data", []):
            b = a.get("daily_budget") or a.get("lifetime_budget")
            ty = "일일 예산" if a.get("daily_budget") else ("총 예산" if a.get("lifetime_budget") else "")
            adset[a.get("name", "")] = (b or "", ty)
            c = a.get("campaign") or {}
            cb = c.get("daily_budget") or c.get("lifetime_budget")
            cty = "일일 예산" if c.get("daily_budget") else ("총 예산" if c.get("lifetime_budget") else "")
            camp[c.get("name", "")] = (cb, cty) if cb else ("광고 세트 예산 사용 중", "")
        url = (d.get("paging") or {}).get("next")
    return adset, camp


def fetch_insights(env, since, until):
    token, acct = env["META_ACCESS_TOKEN"], env["META_AD_ACCOUNT_ID"]
    cfilters = [f.strip() for f in
                (env.get("META_CAMPAIGN_FILTER") or "뷰티,부스터").lower().split(",") if f.strip()]
    fields = ",".join(["ad_name", "campaign_name", "adset_name", "objective", "spend",
                       "impressions", "clicks", "inline_link_clicks", "ctr", "cpm",
                       "cost_per_inline_link_click", "actions", "action_values",
                       "cost_per_action_type", "website_purchase_roas", "unique_actions",
                       "date_start", "date_stop"])
    tr = urllib.parse.quote(json.dumps({"since": since, "until": until}))
    url = (f"{GRAPH}/{acct}/insights?level=ad&fields={fields}&time_increment=1"
           f"&time_range={tr}"
           f"&action_attribution_windows=%5B%221d_view%22%2C%227d_click%22%5D"
           f"&use_unified_attribution_setting=true&limit=500&access_token={token}")
    rows = []
    while url:
        d = http_json(url)
        if d.get("error"):
            sys.exit(f"Graph API 오류: {d['error'].get('message')}")
        rows += [r for r in d.get("data", [])
                 if any(f in (r.get("campaign_name") or "").lower() for f in cfilters)]
        url = (d.get("paging") or {}).get("next")
    return rows


def to_sheet_row(r, adset_b, camp_b):
    spend = float(r.get("spend") or 0)
    imp = int(r.get("impressions") or 0)
    clicks_all = int(r.get("clicks") or 0)
    link_clicks = int(r.get("inline_link_clicks") or 0)
    actions = r.get("actions") or []
    avalues = r.get("action_values") or []
    buy = act(actions, PURCHASE_TYPES) or act(r.get("unique_actions") or [], PURCHASE_TYPES)
    cart = act(actions, CART_TYPES)
    lpv = act(actions, ["landing_page_view", "omni_landing_page_view"])
    conv_val = act(avalues, PURCHASE_TYPES)
    if not conv_val:
        wr = r.get("website_purchase_roas") or []
        if wr:
            conv_val = float(wr[0].get("value") or 0) * spend
    cpa_list = r.get("cost_per_action_type") or []
    cpa = act(cpa_list, PURCHASE_TYPES)
    if not cpa and buy:
        cpa = round(spend / buy)
    ab, aty = adset_b.get(r.get("adset_name", ""), ("", ""))
    cb, cty = camp_b.get(r.get("campaign_name", ""), ("광고 세트 예산 사용 중", ""))
    f = lambda v: ("" if not v else (round(v, 6) if isinstance(v, float) else v))
    i = lambda v: ("" if not v else int(v))
    return ["API", r.get("campaign_name", ""), r.get("adset_name", ""), r.get("ad_name", ""),
            r.get("date_start", ""), r.get("objective", ""), r.get("ad_name", ""),
            imp, clicks_all, i(cart), i(buy), f(conv_val),
            f(round(spend / clicks_all, 1) if clicks_all else 0),
            f(float(r.get("ctr") or 0)), int(round(spend)),
            "공유 항목이 포함된 구매" if buy else "", i(buy), f(cpa),
            f(float(r.get("cost_per_inline_link_click") or 0)),
            f(float(r.get("cpm") or 0)), f(conv_val), "", link_clicks, i(lpv),
            ab, aty, cb, cty, r.get("date_start", ""), r.get("date_stop", "")]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--since")
    ap.add_argument("--until")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    env = load_env()

    yesterday = (date.today() - timedelta(days=1)).isoformat()
    until = a.until or yesterday
    if a.since:
        since = a.since
    else:
        last = sheet_last_date()
        print(f"시트 마지막 날짜: {last}")
        # 최근 7일은 매일 다시 씀 — 메타 어트리뷰션(7d_click)이 늦게 잡히는 전환 반영
        base = datetime.strptime(last, "%Y-%m-%d").date() + timedelta(days=1) \
            if last else date.today() - timedelta(days=7)
        since = min(base, date.today() - timedelta(days=7)).isoformat()
    if since > until:
        print(f"추가할 날짜 없음 (since {since} > until {until})")
        return
    print(f"메타 인사이트 조회: {since} ~ {until}")

    adset_b, camp_b = fetch_budgets(env)
    raw = fetch_insights(env, since, until)
    rows = [to_sheet_row(r, adset_b, camp_b) for r in raw]
    dates = sorted({r[4] for r in rows})
    print(f"{len(rows)}행 ({len(dates)}일: {dates[0] if dates else '-'} ~ {dates[-1] if dates else '-'})")
    if not rows:
        print("전송할 행 없음")
        return
    if a.dry_run:
        for r in rows[:5]:
            print(r)
        print(f"... (dry-run, 총 {len(rows)}행 전송 안 함)")
        return

    webapp = env.get("SHEET_WEBAPP_URL")
    if not webapp:
        sys.exit("SHEET_WEBAPP_URL이 .env.local에 없습니다 — meta_sheet_webapp.gs 배포 후 URL 저장 필요")
    payload = json.dumps({"secret": env.get("SHEET_WEBAPP_SECRET", "oa-meta-sync"),
                          "dates": dates, "rows": rows}, ensure_ascii=False).encode()
    resp = http_json(webapp, data=payload, timeout=300)
    print("웹앱 응답:", resp)
    if not resp.get("ok"):
        sys.exit("전송 실패")
    print("완료 — 대시보드 메타 탭 새로고침하면 반영됩니다")


if __name__ == "__main__":
    main()
