#!/usr/bin/env python3
"""매체별·카테고리별 광고 단가 지도 자동 갱신 (주간).
수집: 메타 Graph API(30일, 광고세트) · 네이버 AD부스터 xlsx(7일, 통합광고주센터) · 네이버 GFA(30일)
출력: docs/ad-cost-map.json (히스토리 누적) + docs/광고단가지도.html (템플릿 치환) + 텔레그램 요약
사용: python3 scripts/ad-cost-map-sync.py [--no-naver] [--no-telegram]
"""
import io, json, re, sys, subprocess, urllib.request, urllib.parse
from datetime import date, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent; ROOT = HERE.parent; DOCS = ROOT / "docs"
sys.path.insert(0, str(HERE / "adboost"))
ENV = {l.split("=", 1)[0]: l.split("=", 1)[1].strip().strip('"') for l in (ROOT / ".env.local").read_text().splitlines() if "=" in l and not l.startswith("#")}
ARGV = sys.argv[1:]
TODAY = date.today().isoformat()
log = lambda *a: print(*a, flush=True)

# ── 카테고리 규칙 (캠페인/광고세트 이름 → 카테고리) ──
CAT_RULES = [
    ("뷰티가전 · 드라이기", ["소닉플로우", "에어리소닉", "드라이기", "sonic"]),
    ("뷰티가전 · 고데기", ["프리온", "고데기", "물결", "웨이브"]),
    ("구강가전", ["클린이스윙", "클린이워터", "구강", "cleanes", "칫솔", "세정기"]),
    ("욕실", ["클린이스쿨", "욕실"]),
    ("마사지기", ["포켓건", "바디스팟", "롤링스팟", "히트스팟", "마사지", "knee", "건강"]),
    ("충전", ["퀵터보", "퀵롤", "퀵맥", "충전", "모바일", "보조배터리"]),
    ("가습기 · 인테리어", ["플렌티", "가습기", "인테리어", "무드등"]),
    ("계절가전", ["아이스볼트", "선풍기", "핸디팬", "계절", "냉풍"]),
    ("생활가전", ["생활"]),
]
def cat_of(name):
    n = (name or "").lower()
    for cat, kws in CAT_RULES:
        if any(k.lower() in n for k in kws): return cat
    return "기타"

def agg(rows, keyf):
    out = {}
    for r in rows:
        k = keyf(r); a = out.setdefault(k, {"spend": 0, "clicks": 0, "imp": 0, "conv": 0, "rev": 0, "n": 0})
        for f in ("spend", "clicks", "imp", "conv", "rev"): a[f] += r.get(f, 0) or 0
        a["n"] += 1
    for a in out.values():
        a["cpc"] = round(a["spend"] / a["clicks"]) if a["clicks"] else None
        a["cpm"] = round(a["spend"] / a["imp"] * 1000) if a["imp"] else None
        a["roas"] = round(a["rev"] / a["spend"], 1) if a["spend"] and a["rev"] else None
    return out

# ── 1) 메타 ──
def fetch_meta():
    tok = ENV["META_ACCESS_TOKEN"]; acct = "act_" + ENV.get("META_AD_ACCOUNT_ID", "561422496378510").replace("act_", "")
    u = (f"https://graph.facebook.com/v21.0/{acct}/insights?level=adset&fields=campaign_name,adset_name,objective,spend,impressions,inline_link_clicks,actions,action_values"
         f"&date_preset=last_30d&limit=200&access_token={tok}")
    rows = []
    while u:
        d = json.load(urllib.request.urlopen(u, timeout=90)); rows += d.get("data", []); u = d.get("paging", {}).get("next")
    out = []
    for r in rows:
        goal = "트래픽" if r.get("objective") in ("LINK_CLICKS", "OUTCOME_TRAFICC", "OUTCOME_TRAFFIC") else "전환" if r.get("objective") in ("OUTCOME_SALES", "CONVERSIONS") else r.get("objective", "")
        pc = sum(int(a["value"]) for a in r.get("actions", []) if a.get("action_type") == "purchase")
        pv = sum(float(a["value"]) for a in r.get("action_values", []) if a.get("action_type") == "purchase")
        out.append({"name": f"{r['campaign_name']} | {r['adset_name']}", "goal": goal, "cat": cat_of(r["campaign_name"] + " " + r["adset_name"]),
                    "spend": float(r.get("spend", 0)), "clicks": int(r.get("inline_link_clicks", 0) or 0), "imp": int(r.get("impressions", 0) or 0), "conv": pc, "rev": pv})
    return out

# ── 2) 네이버 AD부스터 (통합광고주센터 xlsx) ──
def fetch_adboost():
    import openpyxl
    from playwright.sync_api import sync_playwright
    from adboost_lib import launch, ensure_login
    bufs, period = [], ""
    with sync_playwright() as pw:
        ctx = launch(pw)  # 기존 adboost_daily와 동일(헤드리스 아님)
        page = ctx.pages[0] if ctx.pages else ctx.new_page(); ensure_login(page)
        for acct in ("1742505", "2236"):
            try:
                page.goto(f"https://ads.naver.com/manage/ad-accounts/{acct}/all-campaigns", timeout=60000); page.wait_for_timeout(12000)
                m = re.findall(r"(\d{4}\.\d{2}\.\d{2})", page.inner_text("body")[:3000]); period = f"{m[0]}~{m[1]}" if len(m) >= 2 else period
                with page.expect_download(timeout=30000) as dl: page.click("text=다운로드", timeout=10000)
                bufs.append(io.BytesIO(Path(dl.value.path()).read_bytes()))
            except Exception as e: log("adboost", acct, "skip", str(e)[:80])
        ctx.close()
    num = lambda v: float(re.sub(r"[^0-9.]", "", str(v)) or 0)
    out = []
    for buf in bufs:
        for r in list(openpyxl.load_workbook(buf).active.iter_rows(values_only=True))[1:]:
            if len(r) < 14 or not r[5] or "보아르" in str(r[5]): continue
            spend = num(r[11]);
            if spend <= 0: continue
            gu = str(r[1] or ""); kind = str(r[6] or "")
            out.append({"name": str(r[5]), "goal": f"{gu} · {kind}", "cat": cat_of(str(r[5]) + " " + kind), "spend": spend,
                        "clicks": int(num(r[8])), "imp": int(num(r[7])), "conv": int(num(r[12])), "rev": num(r[13]), "gu": gu})
    return out, period

# ── 3) 네이버 GFA ──
def fetch_gfa():
    start = (date.today() - timedelta(days=30)).isoformat(); end = (date.today() - timedelta(days=1)).isoformat()
    r = subprocess.run(["python3", str(HERE / "gfa" / "gfa_daily.py"), start, end], capture_output=True, text=True, timeout=600)
    t = r.stdout; d = json.loads(t[t.index("{"):])
    if d.get("error"): raise RuntimeError(d["error"])
    return [{"name": c["name"], "goal": "GFA", "cat": cat_of(c["name"]), "spend": c["cost"], "clicks": c.get("clk", 0), "imp": c.get("imp", 0), "conv": c["buy"], "rev": c["rev"]} for c in d["camps"]]

# ── 실행 ──
data = {"updated": TODAY, "channels": {}}
if "--no-meta" not in ARGV:
  try:
    meta = fetch_meta(); data["channels"]["meta"] = {"period": "최근 30일", "rows": meta}; log("meta", len(meta))
  except Exception as e: log("meta FAIL", e); data["channels"]["meta"] = {"error": str(e)[:200]}
if "--no-naver" not in ARGV:
    try:
        ab, period = fetch_adboost(); data["channels"]["adboost"] = {"period": period or "최근 7일", "rows": ab}; log("adboost", len(ab))
    except Exception as e: log("adboost FAIL", e); data["channels"]["adboost"] = {"error": str(e)[:200]}
    if "--no-gfa" in ARGV: pass
    else:
      try:
        gfa = fetch_gfa(); data["channels"]["gfa"] = {"period": "최근 30일", "rows": gfa}; log("gfa", len(gfa))
      except Exception as e: log("gfa FAIL", e); data["channels"]["gfa"] = {"error": str(e)[:200]}

daily = {}
# ── 4) 마켓 광고센터 (별도 수집기 산출물 읽기: esm-ads-sync.py, ably-ads-sync.py) ──
def load_market_json():
    rows = {}
    try:
        e = json.loads((DOCS / "esm-ads.json").read_text())
        for seller, v in e.get("gmarket", {}).items():
            if seller == "campaigns" or not isinstance(v, dict): continue
            rows.setdefault("esm", []).append({"name": f"G마켓광고센터 {seller}", "goal": f"G마켓광고센터 {seller}", "cat": "기타", "spend": v["spend"], "clicks": v["clicks"], "imp": v["imp"], "conv": v["conv"], "rev": v["rev"]})
        daily = [r for r in e.get("auction", {}).get("cpc_daily_7d", []) if len(r) >= 11 and str(r[0]).startswith("20")]
        n = lambda x: float(str(x).replace(",", "").replace("원", "").replace("%", "") or 0)
        if daily: rows.setdefault("esm", []).append({"name": "파워클릭 일별(7일)", "goal": "파워클릭 G+A (7일)", "cat": "기타", "spend": sum(n(r[6]) for r in daily), "clicks": sum(n(r[2]) for r in daily), "imp": sum(n(r[1]) for r in daily), "conv": sum(n(r[7]) for r in daily), "rev": sum(n(r[8]) for r in daily)})
        if rows.get("esm"): data["channels"]["esm"] = {"period": e.get("period", ""), "rows": rows["esm"]}
    except Exception as ex: log("esm json skip", ex)
    try:
        a = json.loads((DOCS / "ably-ads.json").read_text()); st = a["statistics_30d"]
        crow = [{"name": c["title"], "goal": "에이블리", "cat": cat_of(c["title"]), "spend": c.get("charge") or 0, "clicks": c.get("click") or 0, "imp": c.get("display") or 0, "conv": c.get("order_count") or 0, "rev": c.get("order_price") or 0} for c in a.get("campaigns_30d", [])]
        data["channels"]["ably"] = {"period": a.get("period", "최근 30일"), "rows": crow or [{"name": "전체", "goal": "에이블리", "cat": "기타", "spend": st["charge"], "clicks": st["click"], "imp": st["display"], "conv": st["order_count"], "rev": st["order_price"]}]}
    except Exception as ex: log("ably json skip", ex)
load_market_json()
try:
    z = json.loads((DOCS / "zigzag-ads.json").read_text()); st = z["summary_30d"]
    data["channels"]["zigzag"] = {"period": z.get("period", "최근 30일"), "rows": [{"name": "지그재그 광고 전체", "goal": "지그재그", "cat": "뷰티가전 · 고데기", "spend": st["spend"], "clicks": st["clicks"], "imp": st["imp"], "conv": st["conv"], "rev": st["rev"]}]}
    for dt, v in z.get("daily", {}).items():
        if "cpc" in v: daily.setdefault("지그재그", {})[dt] = {"spend": v["spend"], "clicks": v["clicks"], "imp": v["imp"], "rev": 0}
except Exception as ex: log("zigzag json skip", ex)
# X (트위터): scripts/xads/xads_stats.py 산출물 docs/x-ads.json {제품:{날짜:{cost,imp,clk}}}
try:
    x = json.loads((DOCS / "x-ads.json").read_text())
    xr = [{"name": prod, "goal": "X 트래픽 (카카오 랜딩)", "cat": cat_of(prod), "spend": sum(v["cost"] for v in d.values()), "clicks": sum(v["clk"] for v in d.values()), "imp": sum(v["imp"] for v in d.values()), "conv": 0, "rev": 0} for prod, d in x.items()]
    if xr: data["channels"]["x"] = {"period": "최근 30일", "rows": xr}
except Exception as ex: log("x json skip", ex)

# ── 일별 시계열 (대시보드 추이용): 메타(목표별), X, 에이블리, 지그재그 ──
daily = globals().get("daily", {})
try:
    if "--no-meta" not in ARGV:
        tok = ENV["META_ACCESS_TOKEN"]; acct = "act_" + ENV.get("META_AD_ACCOUNT_ID", "561422496378510").replace("act_", "")
        u = f"https://graph.facebook.com/v21.0/{acct}/insights?level=campaign&fields=objective,spend,impressions,inline_link_clicks,actions,action_values&time_increment=1&date_preset=last_30d&limit=500&access_token={tok}"
        rows = []
        while u:
            d = json.load(urllib.request.urlopen(u, timeout=120)); rows += d.get("data", []); u = d.get("paging", {}).get("next")
        for r in rows:
            goal = "메타 트래픽" if r.get("objective") in ("LINK_CLICKS", "OUTCOME_TRAFFIC") else "메타 전환" if r.get("objective") in ("OUTCOME_SALES", "CONVERSIONS") else None
            if not goal: continue
            a = daily.setdefault(goal, {}).setdefault(r["date_start"], {"spend": 0, "clicks": 0, "imp": 0, "rev": 0})
            a["spend"] += float(r.get("spend", 0)); a["clicks"] += int(r.get("inline_link_clicks", 0) or 0); a["imp"] += int(r.get("impressions", 0) or 0)
            a["rev"] += sum(float(x["value"]) for x in r.get("action_values", []) if x.get("action_type") == "purchase")
except Exception as ex: log("meta daily skip", ex)
try:
    x = json.loads((DOCS / "x-ads.json").read_text())
    for prod, dd in x.items():
        for dt, v in dd.items():
            a = daily.setdefault("X 트래픽", {}).setdefault(dt, {"spend": 0, "clicks": 0, "imp": 0, "rev": 0}); a["spend"] += v["cost"]; a["clicks"] += v["clk"]; a["imp"] += v["imp"]
except Exception as ex: log("x daily skip", ex)
try:
    ab = json.loads((DOCS / "ably-ads.json").read_text())
    for v in ab.get("timeseries_30d", []):
        daily.setdefault("에이블리", {})[v["datetime"][:10]] = {"spend": v["charge"], "clicks": v["click"], "imp": v["display"], "rev": v["order_price"]}
except Exception as ex: log("ably daily skip", ex)
if "--no-meta" in ARGV:
    prev_daily = (json.loads((DOCS / "ad-cost-map.json").read_text()).get("latest", {}).get("daily", {}) if (DOCS / "ad-cost-map.json").exists() else {})
    for k in ("메타 트래픽", "메타 전환"):
        if k in prev_daily: daily[k] = prev_daily[k]
for ch, dd in daily.items():
    for dt, a in dd.items():
        a["cpc"] = round(a["spend"] / a["clicks"]) if a["clicks"] else None; a["cpm"] = round(a["spend"] / a["imp"] * 1000) if a["imp"] else None
data["daily"] = daily

# 요약 (매체 × 목표, 매체 × 카테고리)
summary = {}
for ch, v in data["channels"].items():
    rows = v.get("rows") or []
    summary[ch] = {"by_goal": agg(rows, lambda r: r["goal"]), "by_cat": agg(rows, lambda r: (r["cat"], r["goal"]))}
    summary[ch]["by_cat"] = {f"{k[0]} | {k[1]}": a for k, a in summary[ch]["by_cat"].items()}
data["summary"] = summary

# 히스토리 누적 (부분 실행이면 빠진 채널은 직전 값 유지)
hist_p = DOCS / "ad-cost-map.json"
hist = json.loads(hist_p.read_text()) if hist_p.exists() else {"history": []}
prev_latest = hist.get("latest") or {}
for ch in ("meta", "adboost", "gfa", "esm", "ably", "x", "zigzag"):
    if ch not in data["channels"] and ch in prev_latest.get("channels", {}):
        data["channels"][ch] = prev_latest["channels"][ch]; summary[ch] = prev_latest.get("summary", {}).get(ch, {})
data["summary"] = summary
hist["history"] = [h for h in hist.get("history", []) if h.get("updated") != TODAY] + [data]
hist["latest"] = data
hist["history"] = hist["history"][-90:]
hist_p.write_text(json.dumps(hist, ensure_ascii=False, indent=1))
# ── Supabase settings 푸시 (대시보드 /adcost 가 읽음) ──
try:
    supa = ENV["NEXT_PUBLIC_SUPABASE_URL"]; skey = ENV["SUPABASE_SERVICE_ROLE_KEY"]
    retail = (DOCS / "ad-cost-map-retail.json").read_text() if (DOCS / "ad-cost-map-retail.json").exists() else "[]"
    actions = (DOCS / "ad-cost-map-actions.json").read_text() if (DOCS / "ad-cost-map-actions.json").exists() else "[]"
    payload = {"updated": TODAY, "latest": {"channels": {k: {"period": v.get("period"), "error": v.get("error")} for k, v in data["channels"].items()}, "summary": summary, "daily": daily},
               "snapshots": [{"updated": h["updated"], "summary": {ch: {g: {kk: a.get(kk) for kk in ("spend", "clicks", "cpc", "cpm", "roas")} for g, a in v.get("by_goal", {}).items()} for ch, v in h.get("summary", {}).items()}} for h in hist["history"][-60:]],
               "retail": json.loads(retail), "actions": json.loads(actions)}
    body = json.dumps({"key": "oa_ad_cost_map_v1", "value": payload}, ensure_ascii=False).encode()
    req = urllib.request.Request(f"{supa}/rest/v1/settings?on_conflict=key", data=body, method="POST", headers={"apikey": skey, "Authorization": f"Bearer {skey}", "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates"})
    urllib.request.urlopen(req, timeout=60); log("supabase push ok")
except Exception as ex: log("supabase push FAIL", ex)

# ── HTML 생성 (템플릿 치환) ──
def fmt(v): return "-" if v is None else f"{v:,.0f}"
def table(rows_html, head):
    return f'<div class="tablewrap"><table><thead><tr>{head}</tr></thead><tbody>{rows_html}</tbody></table></div>'
def real_table():
    rows = ""
    labels = {"meta": "메타", "adboost": "네이버 AD부스터", "gfa": "네이버 GFA", "esm": "지마켓·옥션", "ably": "에이블리", "x": "X (트위터)", "zigzag": "지그재그"}
    for ch, v in data["channels"].items():
        if "error" in v: rows += f'<tr><td class="key">{labels[ch]}</td><td colspan="5" class="note">수집 실패: {v["error"]}</td></tr>'; continue
        for goal, a in sorted(summary[ch]["by_goal"].items(), key=lambda x: -x[1]["spend"]):
            if a["spend"] < 50000: continue
            rows += f'<tr><td class="key">{labels[ch]} · {goal}</td><td class="num">{fmt(a["spend"])}</td><td class="num">{fmt(a["clicks"])}</td><td class="num hi">{fmt(a["cpc"])}</td><td class="num">{fmt(a["cpm"])}</td><td class="note">{v["period"]}{" · ROAS " + str(a["roas"]) if a["roas"] else ""}</td></tr>'
    return table(rows, "<th>매체 · 목표</th><th class='num'>지출</th><th class='num'>클릭</th><th class='num'>CPC</th><th class='num'>CPM</th><th>기간</th>")
def cat_table(ch):
    v = data["channels"].get(ch, {})
    if "error" in v or ch not in summary: return f'<p class="note">수집 실패</p>'
    rows = ""
    for k, a in sorted(summary[ch]["by_cat"].items(), key=lambda x: -x[1]["spend"]):
        if a["spend"] < 50000: continue
        cat, goal = k.split(" | ")
        rows += f'<tr><td class="key">{cat}</td><td>{goal}</td><td class="num">{fmt(a["spend"])}</td><td class="num">{fmt(a["clicks"])}</td><td class="num hi">{fmt(a["cpc"])}</td><td class="num">{fmt(a["cpm"])}</td><td class="num">{a["roas"] or "-"}</td></tr>'
    return table(rows, "<th>카테고리</th><th>목표</th><th class='num'>지출</th><th class='num'>클릭</th><th class='num'>CPC</th><th class='num'>CPM</th><th class='num'>ROAS</th>")
def exec_block():
    # 매체 대표 행: (라벨, 채널, 목표키 매칭, 표시 기간)
    picks = [("에이블리", "ably", "에이블리"), ("메타 트래픽", "meta", "트래픽"), ("X (트위터) 트래픽", "x", "X 트래픽"), ("지그재그", "zigzag", "지그재그"), ("메타 전환", "meta", "전환"),
             ("네이버 디스플레이 전환", "adboost", "웹사이트 전환"), ("네이버 파워링크", "adboost", "파워링크"), ("네이버 쇼핑검색", "adboost", "쇼핑검색"),
             ("GFA", "gfa", "GFA"), ("G마켓 광고센터", "esm", "k2ci00"), ("파워클릭 (G+A)", "esm", "파워클릭"), ("네이버 AD부스터 쇼핑", "adboost", "ADVoost")]
    rows = []
    for lab, ch, key in picks:
        for g, a in summary.get(ch, {}).get("by_goal", {}).items():
            if key in g and a["spend"] >= 100000 and a["cpc"]:
                rows.append({"label": lab, "cpc": a["cpc"], "roas": a["roas"], "spend": a["spend"], "clicks": a["clicks"], "period": data["channels"][ch].get("period", "")}); break
    rows.sort(key=lambda r: r["cpc"]); mx = max(r["cpc"] for r in rows) if rows else 1
    def cls(r): return "g" if (r["roas"] or 0) >= 8 else "w" if (r["roas"] or 0) >= 3 else ("b" if r["roas"] is not None else "")
    bars = "".join(f'<div class="rrow"><span>{r["label"]}</span><div class="track"><div class="fill {cls(r)}" style="width:{max(6, r["cpc"] / mx * 100):.0f}%"></div></div><span class="n">{r["cpc"]:,}</span><span class="roas">{("%.1f배" % r["roas"]) if r["roas"] else "측정불가"}</span></div>' for r in rows)
    tot_spend = sum(a["spend"] for ch in summary.values() for a in ch["by_goal"].values())
    tot_clicks = sum(a["clicks"] for ch in summary.values() for a in ch["by_goal"].values())
    cheapest = rows[0] if rows else None; best = max((r for r in rows if r["roas"]), key=lambda r: r["roas"], default=None); worst = min((r for r in rows if r["roas"]), key=lambda r: r["roas"], default=None)
    kpis = f"""<div class="kpis">
  <div class="kpi"><div class="l">집계 광고비 (표본 기간 합)</div><div class="v">{tot_spend/1e4:,.0f}만</div><div class="s">클릭 {tot_clicks:,.0f}회 · 평균 CPC {tot_spend/tot_clicks if tot_clicks else 0:,.0f}원</div></div>
  <div class="kpi good"><div class="l">가장 싼 클릭</div><div class="v">{cheapest["cpc"]:,}원</div><div class="s">{cheapest["label"]} · ROAS {cheapest["roas"] or "-"}배</div></div>
  <div class="kpi good"><div class="l">가장 잘 버는 매체</div><div class="v">{best["roas"]:.1f}배</div><div class="s">{best["label"]} · CPC {best["cpc"]:,}원</div></div>
  <div class="kpi bad"><div class="l">손해 구간</div><div class="v">{worst["roas"]:.1f}배</div><div class="s">{worst["label"]} · CPC {worst["cpc"]:,}원</div></div>
</div>"""
    rank = f"""<div class="rank"><h3>클릭 단가 순위 (낮을수록 좋음)</h3><p class="h">막대 색 = 광고수익률(ROAS). 초록 8배 이상 · 노랑 3~8배 · 갈색 3배 미만. 메타 ROAS는 픽셀 구매 추적값이라 실제보다 낮게 잡힘(참고용)</p>
<div class="rhead"><span>매체</span><span></span><span>CPC</span><span>ROAS</span></div>{bars}
<div class="legend2"><i style="background:var(--tag-real)"></i>8배↑ <i style="background:#C9A227"></i>3~8배 <i style="background:#B84A08"></i>3배↓ <i style="background:var(--accent)"></i>측정불가</div></div>"""
    # 카카오 선물하기 트래픽: 메타(카카오 캠페인 광고세트) × X 제품별
    prod = {}
    for r in data["channels"].get("meta", {}).get("rows", []):
        if "카카오" in r["name"]:
            nm = re.sub(r"^.*\|\s*\[?트래픽\]?\s*", "", r["name"]).strip(" []"); nm = re.sub(r"_(세트\d+|영상전용|재활용)$", "", nm)
            a = prod.setdefault(("메타", nm), {"spend": 0, "clicks": 0, "imp": 0}); a["spend"] += r["spend"]; a["clicks"] += r["clicks"]; a["imp"] += r["imp"]
    for r in data["channels"].get("x", {}).get("rows", []):
        a = prod.setdefault(("X", r["name"]), {"spend": 0, "clicks": 0, "imp": 0}); a["spend"] += r["spend"]; a["clicks"] += r["clicks"]; a["imp"] += r["imp"]
    prow = "".join(f'<tr><td class="key">{k[1]}</td><td>{k[0]}</td><td class="num">{v["spend"]:,.0f}</td><td class="num">{v["imp"]:,.0f}</td><td class="num">{v["clicks"]:,.0f}</td><td class="num hi">{v["spend"]/v["clicks"] if v["clicks"] else 0:,.0f}</td><td class="num">{v["spend"]/v["imp"]*1000 if v["imp"] else 0:,.0f}</td></tr>' for k, v in sorted(prod.items(), key=lambda x: -x[1]["spend"]) if v["spend"] >= 20000)
    ptable = f"""<div class="sec"><div class="secbar"><span>카카오 선물하기 트래픽 캠페인 · 제품별 (메타 30일 · X 30일)</span><span class="tot">{"  ".join(f"{k[0]} {sum(v['spend'] for kk,v in prod.items() if kk[0]==k[0]):,.0f}원" for k in [("메타",""),("X","")])}</span></div>
<div class="tablewrap"><table><thead><tr><th>제품</th><th>매체</th><th class="num">광고비</th><th class="num">노출</th><th class="num">클릭</th><th class="num">CPC</th><th class="num">CPM</th></tr></thead><tbody>{prow}</tbody></table></div></div>""" if prow else ""
    return kpis + rank + ptable
tpl = (DOCS / "ad-cost-map-template.html").read_text()
html = (tpl.replace("{{UPDATED}}", TODAY).replace("{{EXEC}}", exec_block() + (DOCS / "ad-cost-map-actions.html").read_text() if (DOCS / "ad-cost-map-actions.html").exists() else exec_block()).replace("{{REAL_TABLE}}", real_table())
        .replace("{{CAT_META}}", cat_table("meta")).replace("{{CAT_NAVER}}", cat_table("adboost")).replace("{{CAT_GFA}}", cat_table("gfa")).replace("{{CAT_ABLY}}", cat_table("ably")))
(DOCS / "광고단가지도.html").write_text(html); log("html ok")

# ── 텔레그램 요약 (매체별 CPC + 지난 주 대비) ──
if "--no-telegram" not in ARGV:
    try:
        tg = {l.split("=", 1)[0]: l.split("=", 1)[1].strip().strip('"') for l in (Path.home() / ".claude/channels/telegram/.env").read_text().splitlines() if "=" in l}
        bot = tg.get("TELEGRAM_BOT_TOKEN") or tg.get("BOT_TOKEN"); chat = tg.get("TELEGRAM_CHAT_ID") or tg.get("CHAT_ID") or "8704535307"
        prev = next((h for h in reversed(hist["history"][:-1]) if h.get("summary")), None)
        lines = [f"📊 광고 단가 지도 갱신 ({TODAY})"]
        for ch, lab in (("meta", "메타"), ("adboost", "네이버"), ("gfa", "GFA")):
            for goal, a in summary.get(ch, {}).get("by_goal", {}).items():
                if a["spend"] < 200000 or not a["cpc"]: continue
                pv = (prev or {}).get("summary", {}).get(ch, {}).get("by_goal", {}).get(goal, {}).get("cpc") if prev else None
                delta = f" ({'+' if a['cpc'] >= pv else ''}{round((a['cpc'] - pv) / pv * 100)}%)" if pv else ""
                lines.append(f"{lab} {goal}: CPC {a['cpc']:,}원{delta}")
        lines.append(f"docs/광고단가지도.html")
        urllib.request.urlopen(urllib.request.Request(f"https://api.telegram.org/bot{bot}/sendMessage", data=urllib.parse.urlencode({"chat_id": chat, "text": "\n".join(lines)}).encode()), timeout=30)
        log("telegram sent")
    except Exception as e: log("telegram skip", e)
