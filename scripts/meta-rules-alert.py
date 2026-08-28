#!/usr/bin/env python3
"""부스터즈팀 메타 광고 킬/증액 룰 알림 → 텔레그램.

매일 아침 세트별 성과(3일/7일)를 스캔해서 증액 추천·중지 추천·관찰 대상을
근거 수치와 함께 텔레그램으로 발송. 실행은 사람이 (1단계 알림 전용).

룰 (2026-08-26, 최근 14일 실데이터 기준 — 주력 캠페인 CPA ₩8,711):
  목표 CPA        ₩10,000
  증액 추천       7일 구매 ≥ 8 AND 7일 CPA ≤ 목표 AND 3일 CPA ≤ 목표×1.5  → +25% 제안
  중지 추천       (7일 지출 ≥ 목표×3 AND 구매 0) OR (7일 CPA ≥ 목표×3 AND 지출 ≥ ₩10만)
  관찰(소재교체)  7일 CPA 목표×2~3 AND 지출 ≥ ₩10만
  ※ 트래픽(LPV) 목표 세트는 CPA 룰 대상 아님 — 건수만 표기

사용법: python3 meta-rules-alert.py [--dry-run]
크론: 42 9 * * * (메타 시트 싱크 9:35 이후)
"""
import argparse, json, sys, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GRAPH = "https://graph.facebook.com/v19.0"
TG_ENV = Path.home() / ".claude" / "channels" / "telegram" / ".env"
TG_CHAT_ID = "8704535307"

TARGET_CPA = 10_000
SCALE_MIN_PURCHASES = 8
SCALE_STEP = 1.25  # +25%
CAMPAIGN_KEYWORD = "부스터"

PURCHASE_TYPES = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase",
                  "website_purchase", "web_in_store_purchase"]


def load_env(path):
    env = {}
    if not path.exists():
        return env
    for l in path.read_text().splitlines():
        if "=" in l and not l.strip().startswith("#"):
            k, v = l.split("=", 1)
            env[k.strip()] = v.strip().strip('"')
    return env


def gget(path, token, **params):
    params["access_token"] = token
    url = f"{GRAPH}/{path}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=120) as r:
        return json.loads(r.read())


def purchases_of(row, window="7d_click"):
    # ★뷰스루 과대귀속 방지 — 판정은 클릭 귀속(7d_click)만. 뷰스루는 view_of()로 따로.
    for key in ("catalog_segment_actions", "actions"):
        for a in row.get(key) or []:
            if a.get("action_type") in PURCHASE_TYPES:
                try:
                    return int(float(a.get(window, a["value"] if window == "value" else 0) or 0))
                except (KeyError, ValueError):
                    pass
    return 0


def view_of(row):
    return purchases_of(row, "1d_view")


def weighted_of(row):
    # 판정용 가중 구매 — 클릭 + 뷰스루×0.3 (업계식 절충, 2026-08-28 사용자 합의)
    return purchases_of(row) + 0.3 * view_of(row)


def insights_by_adset(acct, token, preset, campaign_ids):
    rows, url_params = [], dict(
        level="adset", date_preset=preset, limit=200,
        fields="adset_id,adset_name,campaign_name,spend,actions,catalog_segment_actions",
        action_attribution_windows=json.dumps(["7d_click", "1d_view"]),
        filtering=json.dumps([{"field": "campaign.id", "operator": "IN", "value": campaign_ids}]))
    data = gget(f"act_{acct}/insights", token, **url_params)
    rows += data.get("data", [])
    return {r["adset_id"]: r for r in rows}




def meta_yesterday_section(acct, token):
    rows = gget(f"act_{acct}/insights", token, level="campaign", date_preset="yesterday",
                fields="campaign_name,spend,actions,action_values,catalog_segment_actions,catalog_segment_value",
                action_attribution_windows=json.dumps(["7d_click", "1d_view"]),
                limit=100).get("data", [])
    def revenue_of(r):
        for key in ("catalog_segment_value", "action_values"):
            for a in r.get(key) or []:
                if a.get("action_type") in PURCHASE_TYPES:
                    try:
                        return float(a["value"])
                    except (KeyError, ValueError):
                        pass
        return 0.0
    rows = [r for r in rows if float(r.get("spend") or 0) > 0]
    if not rows:
        return ["어제 지출 없음"]
    tot_sp = sum(float(r["spend"]) for r in rows)
    tot_pu = sum(purchases_of(r) for r in rows)
    tot_view = sum(view_of(r) for r in rows)
    tot_w = tot_pu + 0.3 * tot_view
    tot_rev = sum(revenue_of(r) for r in rows)
    out = [f"합계 ₩{tot_sp:,.0f} · 클릭구매 {tot_pu} (+뷰 {tot_view}) · ROAS {tot_rev / tot_sp if tot_sp else 0:.1f}"
           + (f" · 가중CPA ₩{tot_sp / tot_w:,.0f}" if tot_w >= 1 else "")]
    for r in sorted(rows, key=lambda x: -float(x["spend"]))[:5]:
        sp = float(r["spend"]); pu = purchases_of(r); vw = view_of(r); rev = revenue_of(r)
        flag = " ⚠️점검" if sp >= 30000 and rev / sp < 1 else ""
        out.append(f"· {r['campaign_name'][:20]}: ₩{sp:,.0f} · 구매 {pu}+뷰{vw} · ROAS {rev / sp:.1f}{flag}")
    return out


def testzone_section(acct, token):
    adsets = gget(f"act_{acct}/adsets", token, fields="name,effective_status", limit=200).get("data", [])
    tests = [a for a in adsets if a["name"].startswith("[테스트존]") and a.get("effective_status") == "ACTIVE"]
    if not tests:
        return []
    rows = []
    for t in tests:
        ins = gget(f'{t["id"]}/insights', token, date_preset="last_7d",
                   fields="spend,ctr,actions").get("data", []) if "id" in t else []
        i = ins[0] if ins else {}
        sp = float(i.get("spend", 0) or 0)
        ctr = float(i.get("ctr", 0) or 0)
        lpv = next((int(x["value"]) for x in i.get("actions", []) if x["action_type"] == "landing_page_view"), 0)
        rows.append({"n": t["name"].replace("[테스트존] ", "")[:22], "sp": sp, "ctr": ctr,
                     "cpl": sp / lpv if lpv else None})
    ready = sorted([r for r in rows if r["sp"] >= 15000 and r["cpl"]], key=lambda r: (r["cpl"], -r["ctr"]))
    out = []
    if len(ready) >= 2 and ready[0]["cpl"] * 1.2 <= ready[1]["cpl"]:
        w = ready[0]
        out.append(f"🏆 승자 {w['n']} — LPV ₩{w['cpl']:,.0f}·CTR {w['ctr']:.2f}% → 전환 세트 승격 추천")
    else:
        for r in rows:
            st = f"₩{r['sp']:,.0f}·CTR {r['ctr']:.2f}%" + (f"·LPV ₩{r['cpl']:,.0f}" if r["cpl"] else "")
            out.append(f"· {r['n']}: {st}")
        out.append("(판정엔 세트당 ₩15,000 지출 필요)")
    return out



def naver_section():
    import hmac, hashlib, base64, time, datetime
    env = load_env(ROOT / ".env.local")
    api_key, cust, secret = env.get("NAVER_API_KEY"), env.get("NAVER_CUSTOMER_ID"), env.get("NAVER_SECRET_KEY")
    if not api_key:
        raise RuntimeError("네이버 검색광고 키 없음")
    def nh(path):
        ts = str(int(time.time() * 1000))
        sig = base64.b64encode(hmac.new(secret.encode(), f"{ts}.GET.{path}".encode(), hashlib.sha256).digest()).decode()
        return {"X-API-KEY": api_key, "X-Customer": cust, "X-Timestamp": ts, "X-Signature": sig}
    def nget(path, **params):
        qs = urllib.parse.urlencode(params)
        req = urllib.request.Request(f"https://api.searchad.naver.com{path}?{qs}", headers=nh(path))
        return json.loads(urllib.request.urlopen(req, timeout=60).read())
    y = str(datetime.date.today() - datetime.timedelta(days=1))
    camps = nget("/ncc/campaigns")
    rows = []
    for c in camps:
        if c.get("status") not in ("ELIGIBLE", "PAUSED"):
            continue
        st = nget("/stats", id=c["nccCampaignId"], fields=json.dumps(["salesAmt", "ccnt", "convAmt"]),
                  timeRange=json.dumps({"since": y, "until": y}))
        d = (st.get("data") or [{}])[0]
        sp = float(d.get("salesAmt") or 0)
        if sp < 1000:
            continue
        rows.append({"n": c["name"][:18], "sp": sp, "cv": int(d.get("ccnt") or 0), "rev": float(d.get("convAmt") or 0)})
    if not rows:
        return ["어제 지출 있는 캠페인 없음"]
    rows.sort(key=lambda r: -r["sp"])
    tsp = sum(r["sp"] for r in rows); tcv = sum(r["cv"] for r in rows); trev = sum(r["rev"] for r in rows)
    out = [f"합계 ₩{tsp:,.0f} · 전환 {tcv} · ROAS {trev / tsp if tsp else 0:.1f}"]
    for r in rows[:6]:
        roas = r["rev"] / r["sp"] if r["sp"] else 0
        flag = " ⚠️점검" if r["sp"] >= 30000 and roas < 1 else ""
        out.append(f"· {r['n']}: ₩{r['sp']:,.0f} · 전환 {r['cv']} · ROAS {roas:.1f}{flag}")
    return out



def advoost_section():
    import subprocess
    r = subprocess.run([sys.executable, str(ROOT / "scripts" / "adboost" / "adboost_daily.py")],
                       capture_output=True, text=True, timeout=300)
    data = json.loads(r.stdout.strip().splitlines()[-1])
    if not data.get("ok"):
        raise RuntimeError(data.get("error", "실패"))
    # 대시보드 /ads용 스냅샷 적재
    try:
        denv = load_env(Path.home() / "oa-detail-app" / ".env.local")
        sb_url, sb_key = denv["NEXT_PUBLIC_SUPABASE_URL"], denv["SUPABASE_SERVICE_ROLE_KEY"]
        body = json.dumps({"key": "oa_advoost_v1", "value": data}).encode()
        req = urllib.request.Request(f"{sb_url}/rest/v1/settings?on_conflict=key", data=body,
            headers={"apikey": sb_key, "Authorization": f"Bearer {sb_key}",
                     "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates"}, method="POST")
        urllib.request.urlopen(req, timeout=30)
    except Exception:
        pass
    bt = data["boost_tot"]
    out = []
    if bt["cost"]:
        out.append(f"AD부스터/ADVoost 합계 ₩{bt['cost']:,.0f} · 전환 {bt['conv']} · ROAS {bt['rev'] / bt['cost']:.1f} ({data['period']})")
        for b in data["boost"][:8]:
            roas = b["rev"] / b["cost"] if b["cost"] else 0
            flag = " ⚠️점검" if b["cost"] >= 200000 and roas < 3 else ""
            nm = b["name"].replace("MO_오아_AD부스터_", "").split("#")[0][:22]
            out.append(f"· [{b.get('acct', '')}] {nm}: ₩{b['cost']:,.0f} · ROAS {roas:.1f}{flag}")
    # 두 계정 전체에서 낭비 캠페인 경고 (7일 10만↑ 쓰고 ROAS<1)
    waste = [r for r in data.get("rows", []) if r["cost"] >= 100000 and (r["rev"] / r["cost"] if r["cost"] else 0) < 1]
    if waste:
        out.append(f"🚨 낭비 의심 {len(waste)}건 (7일 10만↑·ROAS<1):")
        for w in sorted(waste, key=lambda x: -x["cost"])[:5]:
            out.append(f"· [{w.get('acct', '')}] {w['name'][:22]}: ₩{w['cost']:,.0f} · ROAS {w['rev'] / w['cost']:.1f}")
    return out


def gfa_section():
    import subprocess
    r = subprocess.run([sys.executable, str(ROOT / "scripts" / "gfa" / "gfa_daily.py")],
                       capture_output=True, text=True, timeout=240)
    data = json.loads(r.stdout.strip().splitlines()[-1])
    if data.get("error"):
        raise RuntimeError(data["error"])
    # 대시보드 광고 관제(/ads)용 스냅샷 적재 — 실패해도 브리핑엔 영향 없음
    try:
        import datetime as _dt
        denv = load_env(Path.home() / "oa-detail-app" / ".env.local")
        sb_url, sb_key = denv["NEXT_PUBLIC_SUPABASE_URL"], denv["SUPABASE_SERVICE_ROLE_KEY"]
        body = json.dumps({"key": "oa_gfa_daily_v1", "value": {**data, "date": str(_dt.date.today() - _dt.timedelta(days=1))}}).encode()
        req = urllib.request.Request(f"{sb_url}/rest/v1/settings?on_conflict=key", data=body,
            headers={"apikey": sb_key, "Authorization": f"Bearer {sb_key}",
                     "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates"}, method="POST")
        urllib.request.urlopen(req, timeout=30)
    except Exception:
        pass
    out = []
    tot = data.get("tot") or {}
    if tot:
        roas = (tot.get("rev") or 0) / tot["cost"] if tot.get("cost") else 0
        out.append(f"합계 ₩{tot.get('cost',0):,.0f} · 구매 {tot.get('buy',0)} · ROAS {roas:.1f}")
    for c in (data.get("camps") or [])[:5]:
        roas = (c.get("rev") or 0) / c["cost"] if c.get("cost") else 0
        flag = " ⚠️점검" if c.get("cost", 0) >= 30000 and roas < 1 else ""
        out.append(f"· {c['name'][:20]}: ₩{c['cost']:,.0f} · ROAS {roas:.1f}{flag}")
    return out


def season_section():
    import datetime
    EVENTS = [("2026-09-25", "추석", "기프트박스·장바구니 사전담기"),
              ("2026-10-02", "10월 연휴", "휴대 소구"),
              ("2026-11-11", "빼빼로데이", "벌룬 특가"),
              ("2026-11-19", "수능", "수고했어 선물"),
              ("2026-11-27", "블랙프라이데이", "마커벅벅·오픈런"),
              ("2026-12-25", "크리스마스", "기프트박스"),
              ("2027-02-07", "설", "명절 리스킨"),
              ("2027-05-08", "어버이날", "효도템·카톡 고민형")]
    today = datetime.date.today()
    out = []
    for d, name, tip in EVENTS:
        dd = (datetime.date.fromisoformat(d) - today).days
        if dd in (30, 14, 7, 3):
            out.append(f"⏰ {name} D-{dd} — 소재 준비: {tip}")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    env = load_env(ROOT / ".env.local")
    token, acct = env["META_ACCESS_TOKEN"], env["META_AD_ACCOUNT_ID"].replace("act_", "")
    tg = load_env(TG_ENV)
    bot = tg.get("TELEGRAM_BOT_TOKEN") or tg.get("BOT_TOKEN") or next(
        (v for v in tg.values() if ":AA" in v), "")

    # 1) 부스터 캠페인 (활성)
    camps = gget(f"act_{acct}/campaigns", token,
                 fields="id,name,effective_status", limit=200).get("data", [])
    camps = [c for c in camps if c["effective_status"] == "ACTIVE"]
    if not camps:
        print("활성 캠페인 없음")
        return
    # 캠페인별 목표 CPA — scripts/ad-targets.json {"default":10000,"rules":[{"match":"부스터","cpa":10000}]}
    try:
        tconf = json.loads((ROOT / "scripts" / "ad-targets.json").read_text())
    except Exception:
        tconf = {"default": TARGET_CPA, "rules": []}
    def target_for(camp_name):
        for r in tconf.get("rules", []):
            if r.get("match") and r["match"] in (camp_name or ""):
                return int(r.get("cpa") or tconf.get("default", TARGET_CPA))
        return int(tconf.get("default", TARGET_CPA))
    camp_ids = [c["id"] for c in camps]

    # 2) 활성 세트 + 예산
    adsets = []
    for cid in camp_ids:
        adsets += gget(f"{cid}/adsets", token,
                       fields="id,name,daily_budget,effective_status,optimization_goal",
                       limit=100).get("data", [])
    adsets = [s for s in adsets if s.get("effective_status") == "ACTIVE"]

    # 3) 성과 (7일/3일)
    i7 = insights_by_adset(acct, token, "last_7d", camp_ids)
    i3 = insights_by_adset(acct, token, "last_3d", camp_ids)

    scale, kill, watch, traffic_n = [], [], [], 0
    for s in adsets:
        sid = s["id"]
        goal = (s.get("optimization_goal") or "").upper()
        if "LANDING" in goal or "LINK_CLICK" in goal or "TRAFFIC" in goal:
            traffic_n += 1
            continue
        r7, r3 = i7.get(sid, {}), i3.get(sid, {})
        sp7 = float(r7.get("spend") or 0)
        pu7 = weighted_of(r7)
        sp3 = float(r3.get("spend") or 0)
        pu3 = weighted_of(r3)
        if sp7 < 1:
            continue  # 지출 없는 세트는 스킵
        cpa7 = sp7 / pu7 if pu7 >= 1 else None
        cpa3 = sp3 / pu3 if pu3 >= 1 else None
        budget = int(s.get("daily_budget") or 0)  # KRW는 제로데시멀 — 그대로 원 단위
        camp = (r7.get("campaign_name") or r3.get("campaign_name") or "")
        tgt = target_for(camp)
        name = (f"[{camp[:14]}] " if camp else "") + s["name"][:30]

        if (pu7 >= SCALE_MIN_PURCHASES and cpa7 and cpa7 <= tgt
                and (cpa3 is None or cpa3 <= tgt * 1.5)):
            new_budget = int(round(budget * SCALE_STEP, -3))
            scale.append(f"· {name}\n  7일 가중CPA ₩{cpa7:,.0f} (클릭 {purchases_of(r7)}+뷰 {view_of(r7)}/₩{sp7:,.0f}) → 예산 ₩{budget:,}→₩{new_budget:,} (+25%)")
        elif (sp7 >= tgt * 3 and pu7 == 0) or (cpa7 and cpa7 >= tgt * 3 and sp7 >= 100_000):
            why = "구매 0" if pu7 == 0 else f"CPA ₩{cpa7:,.0f}"
            kill.append(f"· {name}\n  7일 ₩{sp7:,.0f} 지출, {why} → OFF 권고")
        elif cpa7 and tgt * 2 <= cpa7 < tgt * 3 and sp7 >= 100_000:
            watch.append(f"· {name}\n  7일 CPA ₩{cpa7:,.0f} — 소재 교체 검토")

    lines = ["📣 아침 광고 브리핑 (가중구매=클릭+뷰×0.3)"]
    # ── 📈 메타 어제 성과 ──
    try:
        lines += ["", "━━ 📈 메타 (어제)"] + meta_yesterday_section(acct, token)
    except Exception as e:
        lines += ["", f"📈 메타 어제 성과 실패: {str(e)[:60]}"]
    lines += ["", "━━ 📣 메타 룰 판정 (7일)"]
    if scale:
        lines += ["", f"⬆️ 증액 추천 {len(scale)}건"] + scale
    if kill:
        lines += ["", f"⛔ 중지 추천 {len(kill)}건"] + kill
    if watch:
        lines += ["", f"👀 관찰 {len(watch)}건"] + watch
    if not (scale or kill or watch):
        lines += ["", "✅ 모든 활성 세트가 룰 범위 안 — 조치 없음"]
    if traffic_n:
        lines += ["", f"(트래픽 목표 세트 {traffic_n}개는 CPA 룰 제외)"]

    # ── 🧪 테스트존 소재 판정 (LPV 단가·CTR) ──
    try:
        tz = testzone_section(acct, token)
        if tz:
            lines += ["", "━━ 🧪 테스트존"] + tz
    except Exception as e:
        lines += ["", f"🧪 테스트존 판정 실패: {str(e)[:60]}"]

    # ── 🛒 네이버 쇼핑검색광고 (라이브 API) ──
    try:
        nv = naver_section()
        if nv:
            lines += ["", "━━ 🛒 네이버 검색광고 (어제)"] + nv
    except Exception as e:
        lines += ["", f"🛒 네이버 검색광고 실패: {str(e)[:60]}"]

    # ── 🚀 AD부스터/ADVoost (통합광고주센터, 7일) ──
    try:
        av = advoost_section()
        if av:
            lines += ["", "━━ 🚀 AD부스터 (7일)"] + av
    except Exception as e:
        lines += ["", f"🚀 AD부스터 실패: {str(e)[:60]} — NID 캡차 가능성, ads_login.py 확인"]

    # ── 📊 GFA 어제 성과 (gfa_daily.py — 실패해도 브리핑은 발송) ──
    try:
        gfa = gfa_section()
        if gfa:
            lines += ["", "━━ 📊 GFA (어제)"] + gfa
    except Exception as e:
        lines += ["", f"📊 GFA 데이터 실패: {str(e)[:60]} — gfa_login.py로 세션 확인"]

    # ── 📅 시즌 D-day ──
    try:
        sz = season_section()
        if sz:
            lines += ["", "━━ 📅 시즌"] + sz
    except Exception:
        pass

    msg = "\n".join(lines)
    print(msg)

    if a.dry_run:
        return
    if not bot:
        sys.exit("텔레그램 봇 토큰 없음")
    data = json.dumps({"chat_id": TG_CHAT_ID, "text": msg}).encode()
    req = urllib.request.Request(f"https://api.telegram.org/bot{bot}/sendMessage",
                                 data=data, headers={"Content-Type": "application/json"})
    urllib.request.urlopen(req, timeout=30)
    print("→ 텔레그램 발송 완료")


if __name__ == "__main__":
    main()
