#!/usr/bin/env python3
"""타사 광고 모니터 — 메타 광고 라이브러리(KR, 게재 중)에서 브랜드/키워드별 광고를 긁어 Supabase ad_monitor_ads 에 저장.
 저장: 광고주(page_name)·본문(creative_body)·헤드라인(link_title)·랜딩 도메인(link_url)·소재 이미지(snapshot_url, detail-assets/competitor/{id}.jpg)·게재 시작·플랫폼·검색어·is_active
 사용: python3 scripts/competitor/adlib_monitor.py ["검색어" ...]   (기본: TERMS)   ★channel=chrome 필수 (기본 chromium은 0건)
"""
import re, sys, json, time, hashlib, pathlib, urllib.parse, urllib.request
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2]
env=dict(m.groups() for m in (re.match(r"^([A-Z_]+)=(.*)$",l) for l in (ROOT/".env.local").read_text().splitlines()) if m)
SB=env["NEXT_PUBLIC_SUPABASE_URL"].strip().strip('"'); KEY=env["SUPABASE_SERVICE_ROLE_KEY"].strip().strip('"'); H={"apikey":KEY,"Authorization":f"Bearer {KEY}","Content-Type":"application/json"}
TERMS=sys.argv[1:] or ["워터픽","아쿠아픽","오랄비 전동칫솔","필립스 소닉케어","브라운 전동칫솔","구강세정기","다이슨 에어랩","유닉스 드라이기","JMW 드라이기","글램팜","보다나 고데기","마사지건","목 마사지기","발 마사지기","미니 가습기","가열식 가습기","무선 충전기","맥세이프 충전기"]
def log(*a): print(time.strftime("%H:%M:%S"),*a,flush=True)
def parse_blocks(txt):
    out=[]
    for bl in txt.split("라이브러리 ID:")[1:]:
        L=[l.strip() for l in bl.split("\n") if l.strip() and l.strip()!="​"]
        if not L: continue
        aid=re.match(r"\d+",L[0]); aid=aid.group(0) if aid else None
        if not aid: continue
        start=next((l for l in L if "게재 시작" in l),""); m=re.search(r"(\d{4})\. ?(\d{1,2})\. ?(\d{1,2})",start); started=f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}" if m else None
        try: i=L.index("광고 상세 정보 보기"); adv=L[i+1]
        except ValueError: adv="?"; i=-1
        rest=L[i+2:i+12] if i>=0 else L[1:10]
        rest=[l for l in rest if l not in("광고","Shop Now","더 알아보기","지금 구매하기","구매하기","자세히 알아보기","드롭다운 열기","여러 버전이 있는 광고입니다") and not l.startswith("플랫폼")]
        domain=next((l for l in rest if re.match(r"^[A-Z0-9.\-]+\.[A-Z]{2,}$",l)),"")
        body=[l for l in rest if l!=domain]
        out.append({"id":aid,"page_name":adv,"creative_body":" / ".join(body[:3])[:300],"link_title":(body[1] if len(body)>1 else (body[0] if body else ""))[:120],"link_url":domain.lower(),"started_at":started})
    return out
def upload_img(aid,data):
    path=f"competitor/{aid}.jpg"; r=urllib.request.Request(f"{SB}/storage/v1/object/detail-assets/{path}",data=data,headers={"apikey":KEY,"Authorization":f"Bearer {KEY}","Content-Type":"image/jpeg","x-upsert":"true"},method="POST")
    try: urllib.request.urlopen(r,timeout=60); return f"{SB}/storage/v1/object/public/detail-assets/{path}"
    except Exception as e: log("img upload fail",aid,str(e)[:60]); return None
now=time.strftime("%Y-%m-%dT%H:%M:%S+09:00"); rows={}
with sync_playwright() as p:
    b=p.chromium.launch(channel="chrome",headless=True); pg=b.new_page(viewport={"width":1400,"height":1000},locale="ko-KR")
    for q in TERMS:
        u="https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=KR&q="+urllib.parse.quote(q)+"&search_type=keyword_unordered&media_type=all"
        try:
            pg.goto(u,timeout=60000); pg.wait_for_timeout(6000)
            for _ in range(4): pg.mouse.wheel(0,2500); pg.wait_for_timeout(1200)
            txt=pg.inner_text("body"); found=parse_blocks(txt)
            # 소재 이미지: 각 블록의 첫 이미지 src (라이브러리 ID 텍스트 근처)
            imgs=pg.evaluate("""()=>{const out={};document.querySelectorAll('div').forEach(d=>{const t=d.innerText||'';const m=t.match(/라이브러리 ID: (\\d+)/);if(m&&t.length<4000){const im=[...d.querySelectorAll('img')].find(i=>(i.naturalWidth||i.width)>150&&!/emoji|profile|static\\.xx/.test(i.src));if(im&&!out[m[1]])out[m[1]]=im.src;}});return out}""")
            for a in found:
                a["search_term"]=q; a["img_src"]=imgs.get(a["id"]); rows.setdefault(a["id"],a)
            log(q,"광고",len(found),"이미지",sum(1 for a in found if imgs.get(a["id"])),"| 광고주",sorted(set(a["page_name"] for a in found))[:6])
        except Exception as e: log(q,"실패",str(e)[:80])
    # 이미지 다운로드(브라우저 컨텍스트로 fetch → 쿠키/리퍼러 문제 회피)
    for aid,a in rows.items():
        if not a.get("img_src"): a["snapshot_url"]=None; continue
        try:
            data=pg.evaluate("""async(src)=>{const r=await fetch(src);const b=await r.blob();const buf=await b.arrayBuffer();return Array.from(new Uint8Array(buf))}""",a["img_src"])
            a["snapshot_url"]=upload_img(aid,bytes(data)) if data and len(data)>2000 else None
        except Exception as e: a["snapshot_url"]=None
    b.close()
# 기존 활성 → 이번에 안 보인 건 is_active=false
try:
    ex=json.load(urllib.request.urlopen(urllib.request.Request(f"{SB}/rest/v1/ad_monitor_ads?select=id,first_seen,search_term&is_active=eq.true&limit=5000",headers=H)))
    exist={r["id"]:r["first_seen"] for r in ex}
    # ★이번 실행에 포함된 검색어의 광고만 '사라짐' 판정 (부분 실행 시 다른 검색어 광고를 꺼버리던 버그, 09-23)
    scoped={r["id"] for r in ex if r.get("search_term") in TERMS}
except Exception: exist={}
payload=[{"id":aid,"page_id":None,"page_name":a["page_name"],"creative_body":a["creative_body"],"link_title":a["link_title"],"link_url":a["link_url"],"snapshot_url":a.get("snapshot_url"),"platforms":"meta","started_at":a["started_at"],"stopped_at":None,"first_seen":exist.get(aid,now),"last_seen":now,"search_term":a["search_term"],"is_active":True} for aid,a in rows.items()]
for i in range(0,len(payload),200):
    r=urllib.request.Request(f"{SB}/rest/v1/ad_monitor_ads?on_conflict=id",data=json.dumps(payload[i:i+200]).encode(),headers={**H,"Prefer":"resolution=merge-duplicates"},method="POST"); urllib.request.urlopen(r,timeout=60)
gone=[i for i in exist if i not in rows and i in scoped]
if gone:
    for i in range(0,len(gone),100):
        ids=",".join(gone[i:i+100]); urllib.request.urlopen(urllib.request.Request(f"{SB}/rest/v1/ad_monitor_ads?id=in.({ids})",data=json.dumps({"is_active":False,"stopped_at":now}).encode(),headers=H,method="PATCH"),timeout=60)
new=[a for a in payload if a["first_seen"]==now]
urllib.request.urlopen(urllib.request.Request(f"{SB}/rest/v1/ad_monitor_reports",data=json.dumps({"total_active":len(payload),"new_count":len(new),"gone_count":len(gone),"report_json":{"terms":TERMS,"new_ads":[{"id":a["id"],"adv":a["page_name"],"title":a["link_title"],"term":a["search_term"]} for a in new[:60]]},"sent":False}).encode(),headers=H,method="POST"),timeout=60)
log("DONE active",len(payload),"new",len(new),"gone",len(gone),"img",sum(1 for a in payload if a["snapshot_url"]))
