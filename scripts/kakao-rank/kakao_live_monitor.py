#!/usr/bin/env python3
"""카카오 선물하기 실시간 배지 모니터 — targets_manual.json 8상품의 `/a/product-detail/v1/live/products/{id}` highlights(예: '지금 N명이 보고 있어요')를
1분마다 기록(data/live_log.jsonl). 어떤 매체/시간대 유입이 실시간 배지를 켜는지 검증용. `--summary [일수]`로 요약."""
import json, sys, time, pathlib, urllib.request, datetime, collections
HERE=pathlib.Path(__file__).resolve().parent; LOG=HERE/"data"/"live_log.jsonl"; LOG.parent.mkdir(exist_ok=True)
T=json.loads((HERE/"targets_manual.json").read_text())
# ★모바일 카카오톡 인앱 웹뷰 UA로 조회 (사용자 09-23 "모바일환경에서")
H={"User-Agent":"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 25.8.1","Accept":"application/json","Referer":"https://gift.kakao.com/","X-Requested-With":"com.kakao.talk"}
import re as _re
ENV=dict(m.groups() for m in (_re.match(r"^([A-Z_]+)=(.*)$",l) for l in (HERE.parent.parent/".env.local").read_text().splitlines()) if m)
SB=ENV["NEXT_PUBLIC_SUPABASE_URL"].strip('"'); SK=ENV["SUPABASE_SERVICE_ROLE_KEY"].strip('"'); SH={"apikey":SK,"Authorization":"Bearer "+SK,"Content-Type":"application/json"}
if "--summary" in sys.argv:
    days=int(sys.argv[sys.argv.index("--summary")+1]) if len(sys.argv)>sys.argv.index("--summary")+1 else 1
    since=(datetime.datetime.now()-datetime.timedelta(days=days)).isoformat()
    rows=[json.loads(l) for l in LOG.read_text().splitlines() if l.strip()] if LOG.exists() else []
    rows=[r for r in rows if r["t"]>=since]; print(f"기록 {len(rows)}건 (최근 {days}일)")
    by=collections.defaultdict(list)
    for r in rows:
        for pid,h in r["hl"].items(): by[pid].append((r["t"][11:16],h))
    for t in T:
        hs=[(tm,h) for tm,h in by.get(str(t["id"]),[]) if h]
        print(f"  {t['name']:10} 배지 켜짐 {len(hs)}회" + (f" — 예: {hs[0][0]} {hs[0][1][:60]}" if hs else ""))
    sys.exit()
out={"t":datetime.datetime.now().isoformat(timespec="seconds"),"hl":{}}
# ★09-23 정정: 실시간 배지('N명이 보는 중'·'N명이 최근 구매'·'최근 위시 N')는 랭킹 API 상품의 fomoBadge 에 실림
#   {orderCount}|{wishCount}|{viewCount}. 이전에 보던 /live/products 는 쇼핑라이브 하이라이트라 무관. 각 제품의 목표 리스트(+가전·디지털) 페이지를 훑어 기록.
LISTS={"건강가전":{"navId":7,"subNavId":164},"뷰티가전":{"navId":7,"subNavId":161},"생활가전":{"navId":7,"subNavId":160},"계절가전":{"navId":7,"subNavId":163},"충전기":{"navId":7,"subNavId":157},"음향가전":{"navId":7,"subNavId":158},"가전·디지털":{"navId":7},"전체":{"navId":11000}}
RH={**H,"Content-Type":"application/json","Origin":"https://gift.kakao.com","Referer":"https://gift.kakao.com/ranking/category/7"}
need={str(t["id"]):t for t in T}; lists_needed=sorted({(t.get("goal") or {}).get("list") or "가전·디지털" for t in T}|{"가전·디지털"})
def fomo_txt(fb):
    if not fb: return ""
    if fb.get("orderCount"): return f"최근 구매 {fb['orderCount']:,}명"
    if fb.get("viewCount"): return f"보는 중 {fb['viewCount']:,}명"
    if fb.get("wishCount"): return f"최근 위시 {fb['wishCount']:,}"
    return json.dumps(fb,ensure_ascii=False)
seen={}
for lname in lists_needed:
    body=LISTS.get(lname) or LISTS["가전·디지털"]
    for pg in range(5):
        try:
            d=json.load(urllib.request.urlopen(urllib.request.Request("https://gift.kakao.com/a/rank/v1/gift-rank/ranking-tab/category-tab/search",data=json.dumps({**body,"page":pg,"size":100,"filters":{"searchFilters":[]}}).encode(),headers=RH,method="POST"),timeout=20))
        except Exception as e: out.setdefault("err",[]).append(f"{lname}:{str(e)[:40]}"); break
        for it in d.get("products",[]):
            pid=str(it.get("productId"))
            if pid in need and pid not in seen: seen[pid]=(lname,it.get("fomoBadge") or {})
        if d.get("last") or not d.get("products"): break
    time.sleep(0.3)
for t in T:
    pid=str(t["id"]); ln,fb=seen.get(pid,(None,{}))
    out["hl"][pid]=fomo_txt(fb) if fb else ""
    out.setdefault("fomo",{})[pid]={"list":ln,"badge":fb}
with LOG.open("a") as f: f.write(json.dumps(out,ensure_ascii=False)+"\n")
on=[f"{t['name']}:{out['hl'][str(t['id'])][:50]}" for t in T if out["hl"].get(str(t["id"])) and not out["hl"][str(t["id"])].startswith("ERR")]
print(out["t"], "배지:", on or "없음")
# ★모바일 화면 캡처(사용자 09-23 "실시간 배지모니터를 직접 보여줘"): 상품 8개 상단 390×760 을 detail-assets/kakao-live/{pid}.jpg 에 최신본 덮어쓰기,
#   배지가 켜진 순간은 kakao-live/on/{pid}_{ts}.jpg 로 따로 보존(증거). 실패해도 기록엔 영향 없음.
SHOTS={}
if "--no-shot" not in sys.argv:
    try:
        from playwright.sync_api import sync_playwright
        ts=out["t"].replace(":","").replace("-","")
        def up(path,data):
            r=urllib.request.Request(f"{SB}/storage/v1/object/detail-assets/{path}",data=data,headers={"apikey":SK,"Authorization":"Bearer "+SK,"Content-Type":"image/jpeg","x-upsert":"true"},method="POST")
            urllib.request.urlopen(r,timeout=60); return f"{SB}/storage/v1/object/public/detail-assets/{path}"
        with sync_playwright() as pw:
            b=pw.chromium.launch(channel="chrome",headless=True)
            ctx=b.new_context(user_agent=H["User-Agent"],viewport={"width":390,"height":760},device_scale_factor=2,is_mobile=True,has_touch=True,locale="ko-KR")
            for t in T:
                pid=str(t["id"]); pg=ctx.new_page()
                try:
                    pg.goto(f"https://gift.kakao.com/product/{pid}",wait_until="networkidle",timeout=45000); pg.wait_for_timeout(1500)
                    img=pg.screenshot(type="jpeg",quality=70,clip={"x":0,"y":0,"width":390,"height":760})
                    u=up(f"kakao-live/{pid}.jpg",img); SHOTS[pid]={"url":u,"t":out["t"]}
                    if out["hl"].get(pid) and not out["hl"][pid].startswith("ERR"): SHOTS[pid]["on_url"]=up(f"kakao-live/on/{pid}_{ts}.jpg",img)
                except Exception as e: SHOTS[pid]={"err":str(e)[:60]}
                finally: pg.close()
            b.close()
    except Exception as e: print("shot fail",str(e)[:80])

# 대시보드용: 최근 7일 샘플을 settings.oa_kakao_live_v1 에 푸시 (10분 간격 × 7일 ≈ 1,000건)
try:
    rows=[json.loads(l) for l in LOG.read_text().splitlines() if l.strip()]
    since=(datetime.datetime.now()-datetime.timedelta(days=7)).isoformat(); rows=[r for r in rows if r["t"]>=since][-1100:]
    payload={"updated":out["t"],"interval_min":10,"ua":"KakaoTalk in-app (iOS) · 랭킹 fomoBadge","targets":[{"id":t["id"],"name":t["name"]} for t in T],"samples":rows}
    # 캡처 URL은 누적 병합(이번 실행에 실패한 상품은 직전 캡처 유지, 켜짐 캡처는 상품당 최근 20개 보존)
    try:
        prev=json.load(urllib.request.urlopen(urllib.request.Request(f"{SB}/rest/v1/settings?key=eq.oa_kakao_live_v1&select=value",headers=SH),timeout=20))
        prev_shots=(prev[0]["value"].get("shots") if prev else None) or {}
    except Exception: prev_shots={}
    shots={}
    for t in T:
        pid=str(t["id"]); o=dict(prev_shots.get(pid) or {}); n=SHOTS.get(pid) or {}
        if n.get("url"): o["url"]=n["url"]; o["t"]=n["t"]
        if n.get("on_url"): o["on"]=([{"t":out["t"],"url":n["on_url"],"hl":out["hl"].get(pid,"")}]+(o.get("on") or []))[:20]
        shots[pid]=o
    payload["shots"]=shots
    req=urllib.request.Request(f"{SB}/rest/v1/settings?on_conflict=key",data=json.dumps({"key":"oa_kakao_live_v1","value":payload}).encode(),headers={**SH,"Prefer":"resolution=merge-duplicates"},method="POST"); urllib.request.urlopen(req,timeout=30)
except Exception as e: print("push fail",str(e)[:80])
