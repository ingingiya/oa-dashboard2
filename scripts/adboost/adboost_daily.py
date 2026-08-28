#!/usr/bin/env python3
"""AD부스터(ADVoost)·디스플레이 광고 성과 — 통합광고주센터(ads.naver.com) 전체캠페인 xlsx 다운로드.
기간은 센터 기본(최근 7일). 출력: JSON 한 줄 (아침 브리핑 advoost_section이 소비).
NID 자동 로그인 (자격증명 .env) — 캡차 뜨면 실패 JSON 반환.
"""
import io, json, re, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))


def main():
    try:
        import openpyxl
        from playwright.sync_api import sync_playwright
        from adboost_lib import launch, ensure_login
        # 오아만 (보아르 12n300은 사용자 지시로 제외, 2026-08-28)
        ACCOUNTS = [("1742505", "k2ci00")]
        bufs, period = [], "최근 7일"
        with sync_playwright() as pw:
            ctx = launch(pw)
            page = ctx.pages[0] if ctx.pages else ctx.new_page()
            ensure_login(page)
            for acct, label in ACCOUNTS:
                try:
                    page.goto(f"https://ads.naver.com/manage/ad-accounts/{acct}/all-campaigns", timeout=60000)
                    page.wait_for_timeout(12000)
                    body = page.inner_text("body")[:3000]
                    m = re.findall(r"(\d{4}\.\d{2}\.\d{2})", body)
                    if len(m) >= 2:
                        period = f"{m[0]}~{m[1]}"
                    with page.expect_download(timeout=30000) as dl:
                        page.click("text=다운로드", timeout=10000)
                    bufs.append((label, io.BytesIO(Path(dl.value.path()).read_bytes())))
                except Exception:
                    pass
            ctx.close()

        out = []
        for label, buf in bufs:
            wb = openpyxl.load_workbook(buf)
            for r in list(wb.active.iter_rows(values_only=True))[1:]:
                if len(r) < 14 or not r[5]:
                    continue
                gu, name = str(r[1] or ""), str(r[5])
                num = lambda v: float(re.sub(r"[^0-9.]", "", str(v)) or 0)
                cost = num(r[11])
                if cost <= 0 or not gu:
                    continue
                out.append({"acct": label, "gu": gu, "name": name, "cost": cost,
                            "conv": int(num(r[12])), "rev": num(r[13])})
        boost = [x for x in out if "부스터" in x["name"] or "부스트" in x["name"] or "voost" in x["name"].lower()]
        da = [x for x in out if "디스플레이" in x["gu"]]
        tot = lambda xs, k: sum(x[k] for x in xs)
        print(json.dumps({"ok": True, "period": period,
            "boost": sorted(boost, key=lambda x: -x["cost"]),
            "boost_tot": {"cost": tot(boost, "cost"), "conv": tot(boost, "conv"), "rev": tot(boost, "rev")},
            "da_tot": {"cost": tot(da, "cost"), "conv": tot(da, "conv"), "rev": tot(da, "rev")},
            "rows": out}, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)[:150]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
