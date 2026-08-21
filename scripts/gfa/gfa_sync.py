#!/usr/bin/env python3
"""GFA 소재별 성과 → 대시보드 GFA 탭(oa_gfa_report_v1) 자동 업로드.

광고주센터 내부 API(reportPerformance)를 로그인 세션 쿠키로 직접 호출 —
CSV 다운로드/업로드 수작업 대체. 세션 만료 시: python3 gfa_login.py 로 재로그인.

사용법:
  python3 gfa_sync.py              # 최근 30일 (오늘 제외)
  python3 gfa_sync.py --days 90    # 기간 변경
  python3 gfa_sync.py --dry-run    # 업로드 없이 요약만
"""
import argparse, json, sys, urllib.request
from datetime import date, timedelta
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent  # ~/oa-dashboard2
PROFILE = HERE / ".gfa_profile"
ACCOUNT = 1742505  # k2ci00 (뷰티팀 GFA 계정)


def load_env():
    env = {}
    for l in (ROOT / ".env.local").read_text().splitlines():
        if "=" in l and not l.strip().startswith("#"):
            k, v = l.split("=", 1)
            env[k.strip()] = v.strip().strip('"')
    return env


def fetch_pages(ctx, start, end, label=""):
    items_all = []
    page = 1
    while True:
        url = (f"https://ads.naver.com/apis/report/gfa/v1/adAccounts/{ACCOUNT}"
               f"/stats/reportPerformance?startDate={start}&endDate={end}"
               f"&reportAdUnit=CREATIVE&reportFilterListString=%5B%5D"
               f"&pageNumber={page}&pageSize=100")
        r = ctx.request.get(url, headers={"Referer": "https://ads.naver.com/manage/ad-accounts/1742505/da/report/performance"})
        if r.status != 200:
            detail = r.text()[:300]
            ctx.close()
            sys.exit(f"API 오류 HTTP {r.status} — 세션 만료 가능, gfa_login.py 재실행 필요\n{detail}")
        d = r.json()
        items_all.extend(d.get("reportPerformanceDetailResponseList") or [])
        total = d.get("totalPage") or 1
        print(f"  {label}page {page}/{total} — 누적 {len(items_all)}행")
        if page >= total:
            break
        page += 1
    return items_all


def fetch_report(days):
    start = (date.today() - timedelta(days=days)).isoformat()
    end = (date.today() - timedelta(days=1)).isoformat()
    print(f"조회 기간: {start} ~ {end}")
    rows = []
    with sync_playwright() as pw:
        ctx = pw.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE), channel="chrome", headless=True,
            args=["--disable-blink-features=AutomationControlled"])
        cookies = {c["name"] for c in ctx.cookies("https://naver.com")}
        if "NID_AUT" not in cookies:
            ctx.close()
            sys.exit("네이버 로그인 세션 없음/만료 — 먼저 실행: python3 scripts/gfa/gfa_login.py")
        for it in fetch_pages(ctx, start, end):
            rows.append({
                "name":  it.get("creativeName") or "",
                "group": it.get("adSetName") or "",
                "camp":  it.get("campaignName") or "",
                "cost":  it.get("sales") or 0,
                "imp":   it.get("impCount") or 0,
                "clk":   it.get("clickCount") or 0,
                "conv":  it.get("convCount") or 0,
                "buy":   it.get("purchaseConvCount") or 0,
                "rev":   it.get("purchaseConvSales") or 0,
                "start": it.get("scheduleString") or "",  # "2026.08.08. ~ 진행 중"
            })
        # 활성 판정: 어제~오늘 노출이 있는 소재만 송출 중 (소재/그룹/캠페인 어느 레벨에서 꺼져도 노출 0)
        recent = fetch_pages(ctx, (date.today() - timedelta(days=1)).isoformat(),
                             date.today().isoformat(), label="활성 ")
        ctx.close()
    active = {(it.get("campaignName"), it.get("adSetName"), it.get("creativeName"))
              for it in recent if (it.get("impCount") or 0) > 0}
    for r in rows:
        r["on"] = (r["camp"], r["group"], r["name"]) in active
    n_off = sum(1 for r in rows if r["name"] and r["camp"] and not r["on"])
    print(f"활성 판정 — 송출 중 {len(active)}개 · 꺼짐 {n_off}개")
    return [r for r in rows if r["name"] and r["camp"]], start, end


def upload(env, rows, start, end):
    supa = env["NEXT_PUBLIC_SUPABASE_URL"]
    key = env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
    h = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    # 기존 targetRoas 유지
    req = urllib.request.Request(
        f"{supa}/rest/v1/settings?key=eq.oa_gfa_report_v1&select=value", headers=h)
    cur = json.load(urllib.request.urlopen(req, timeout=60))
    target = (cur[0]["value"].get("targetRoas") if cur else None) or 300
    value = {"fileName": f"GFA API 자동 ({start}~{end})",
             "uploadedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
             "targetRoas": target, "rows": rows}
    body = json.dumps({"key": "oa_gfa_report_v1", "value": value}, ensure_ascii=False).encode()
    req = urllib.request.Request(
        f"{supa}/rest/v1/settings?on_conflict=key", data=body, method="POST",
        headers={**h, "Prefer": "resolution=merge-duplicates"})
    urllib.request.urlopen(req, timeout=120)
    print(f"업로드 완료 — {len(rows)}행, targetRoas {target}% 유지")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=30)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    env = load_env()
    rows, start, end = fetch_report(a.days)
    cost = sum(r["cost"] for r in rows)
    buy = sum(r["buy"] for r in rows)
    rev = sum(r["rev"] for r in rows)
    print(f"소재 {len(rows)}행 · 총비용 {cost:,}원 · 구매완료 {buy} · 전환매출 {rev:,}원"
          f" · ROAS {rev / cost * 100:.0f}%" if cost else f"소재 {len(rows)}행 (지출 0)")
    if a.dry_run:
        for r in rows[:5]:
            print(" ", r)
        print("(dry-run — 업로드 안 함)")
        return
    if not rows:
        sys.exit("행 0개 — 업로드 생략")
    upload(env, rows, start, end)
    print("대시보드 GFA 탭 새로고침하면 반영됩니다")


if __name__ == "__main__":
    main()
