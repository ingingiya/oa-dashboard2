#!/usr/bin/env python3
import json, time, urllib.parse, re, collections
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT = Path(__file__).parent; KW = re.compile(r"가습기|humidif", re.I)
import sys, os, datetime, urllib.request as _ur
TOPIC = sys.argv[1] if len(sys.argv) > 1 else "가습기"
EXTRA = {"가습기": ["미니 가습기","가열식 가습기","무선 가습기","초음파 가습기","쿠쿠 가습기","보아르 가습기","발뮤다 가습기"], "마사지기": ["미니 마사지건","손목 마사지기","허리 마사지기","목 마사지기","발 마사지기"], "고데기": ["무선 고데기","봉고데기","오토 고데기","에어랩"], "드라이기": ["헤어드라이기","무선 드라이기","BLDC 드라이기"]}
QUERIES = [TOPIC] + EXTRA.get(TOPIC, [TOPIC + " 추천"])
def parse(txt):
    blocks = txt.split("라이브러리 ID:")[1:]; out = []
    for bl in blocks:
        lines = [l.strip() for l in bl.split("\n") if l.strip() and l.strip() != "​"]
        if not KW.search(bl): continue
        start = next((l for l in lines if "게재 시작" in l), "")
        try: i = lines.index("광고 상세 정보 보기"); adv = lines[i+1]
        except ValueError: adv = "?"
        body = " / ".join(lines[lines.index(adv)+2: lines.index(adv)+7]) if adv in lines else ""
        out.append({"adv": adv, "start": start.replace("에 게재 시작함",""), "text": body[:220], "id": lines[0][:20]})
    return out
ads = {}
with sync_playwright() as p:
    b = p.chromium.launch(headless=True); pg = b.new_page(viewport={"width": 1500, "height": 1000}, locale="ko-KR")
    for q in QUERIES:
        u = f"https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=KR&q={urllib.parse.quote(q)}&search_type=keyword_unordered&media_type=all"
        try:
            pg.goto(u, timeout=60000); time.sleep(6)
            for _ in range(6): pg.mouse.wheel(0, 3000); time.sleep(1.5)
            txt = pg.evaluate("()=>document.body.innerText"); m = re.search(r"결과 ~?([\d,]+)개", txt)
            found = parse(txt)
            for a in found: ads.setdefault(a["id"], {**a, "q": q})
            print(f"[메타] {q}: 결과 {m.group(1) if m else '?'} / 가습기 광고 {len(found)} / 광고주 {sorted(set(a['adv'] for a in found))[:8]}", flush=True)
        except Exception as e: print("[메타]", q, "실패", str(e)[:80], flush=True)
    naver = {}
    for q in ["가습기", "미니 가습기", "무선 가습기", "가열식 가습기"]:
        try:
            pg.goto(f"https://search.naver.com/search.naver?query={urllib.parse.quote(q)}", timeout=60000); time.sleep(3)
            txt = pg.evaluate("()=>document.body.innerText")
            i = txt.find("파워링크"); seg = txt[i:i+5000] if i >= 0 else ""
            names = [l.strip() for l in seg.split("\n") if l.strip()]
            adv = [names[k+1] for k, l in enumerate(names[:-1]) if l == "광고" and len(names[k+1]) < 40]
            naver[q] = list(dict.fromkeys(adv))[:15]; print("[네이버 파워링크]", q, naver[q][:10], flush=True)
        except Exception as e: print("[네이버]", q, "실패", str(e)[:80], flush=True)
    b.close()
c = collections.Counter(a["adv"] for a in ads.values())
json.dump({"meta_ads": list(ads.values()), "meta_advertisers": c.most_common(), "naver": naver}, open(OUT / f"result_{TOPIC}.json", "w"), ensure_ascii=False, indent=1)
# ★대시보드 저장: settings oa_competitor_ads_v1 = {topics:{<topic>:{updated_at, total, advertisers:[{adv,n,start,text}], ads:[...]}}}
env = dict(l.strip().split("=", 1) for l in open(os.path.expanduser("~/oa-dashboard2/.env.local")) if "=" in l and not l.startswith("#"))
URL = env["NEXT_PUBLIC_SUPABASE_URL"].strip('"'); KEY = env["SUPABASE_SERVICE_ROLE_KEY"].strip('"'); h = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal"}
try: cur = json.load(_ur.urlopen(_ur.Request(f"{URL}/rest/v1/settings?key=eq.oa_competitor_ads_v1&select=value", headers=h)))
except Exception: cur = []
val = cur[0]["value"] if cur else {"topics": {}}
by = collections.defaultdict(list)
for a in ads.values(): by[a["adv"]].append(a)
advs = [{"adv": adv, "n": n, "start": sorted(by[adv], key=lambda x: x["start"], reverse=True)[0]["start"], "text": sorted(by[adv], key=lambda x: x["start"], reverse=True)[0]["text"][:200]} for adv, n in c.most_common() if adv != "?"]
val.setdefault("topics", {})[TOPIC] = {"updated_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"), "queries": QUERIES, "total": len(ads), "advertisers": advs, "ads": [{k: a[k] for k in ("adv", "start", "text", "q")} for a in ads.values()][:200], "naver": naver}
_ur.urlopen(_ur.Request(f"{URL}/rest/v1/settings", data=json.dumps([{"key": "oa_competitor_ads_v1", "value": val}], ensure_ascii=False).encode(), headers=h, method="POST")); print("dashboard saved:", TOPIC, len(advs), "advertisers")
print("== 메타 활성 가습기 광고주 TOP:", c.most_common(30))
