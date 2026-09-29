#!/usr/bin/env python3
"""오픈애즈(openads.co.kr/item) 광고상품 574종 크롤 → docs/openads-products.json
 - 목록: /item 에서 '더보기' 반복 클릭으로 itemId 수집(카드 카테고리 라벨 포함)
 - 상세: 이름·소개·태그·소재유형/디바이스/과금방식·소개서 링크·★광고 성과 데이터(매체사 등록 노출/클릭/CTR/CPC)·본문 금액
 - 상태 저장(docs/openads-state.json)으로 중단 후 재실행 시 이어서. 사용: python3 scripts/openads-crawl.py [--list-only] [--limit N]
"""
import re, json, sys, time, pathlib
from playwright.sync_api import sync_playwright
D = pathlib.Path(__file__).resolve().parent.parent / "docs"; STATE = D / "openads-state.json"; OUT = D / "openads-products.json"
BASE = "https://www.openads.co.kr"
st = json.loads(STATE.read_text()) if STATE.exists() else {"list": [], "details": {}}
def log(*a): print(time.strftime("%H:%M:%S"), *a, flush=True)
def num(s): return int(re.sub(r"[^\d]", "", s)) if re.search(r"\d", s or "") else None
def amounts(t):  # '1,000만원' '150원' '5,000,000원' → 원 단위 정수 목록
    out=[]
    for m in re.finditer(r"([\d,]+(?:\.\d+)?)\s*(억|만)?\s*원", t or ""):
        v=float(m.group(1).replace(",","")); v*= {"억":1e8,"만":1e4,None:1}[m.group(2)]; out.append(int(v))
    return out
def parse_prices(text):
    cpc=cpm=cpv=flat=minb=None
    for m in re.finditer(r"CPC[^\d]{0,12}([\d,]+)\s*원", text): cpc=cpc or num(m.group(1))
    for m in re.finditer(r"CPM[^\d]{0,12}([\d,]+)\s*원", text): cpm=cpm or num(m.group(1))
    for m in re.finditer(r"CPV[^\d]{0,12}([\d,]+)\s*원", text): cpv=cpv or num(m.group(1))
    for m in re.finditer(r"(최소|최저)[^\n]{0,20}?([\d,]+(?:\.\d+)?\s*(?:억|만)?\s*원)", text): minb=minb or (amounts(m.group(2)) or [None])[0]
    big=[a for a in amounts(text) if a>=100000]
    if big and flat is None: flat=big[0]
    return cpc,cpm,cpv,flat,minb
with sync_playwright() as p:
    b=p.chromium.launch(channel="chrome",headless=True); pg=b.new_page(viewport={"width":1300,"height":900})
    if not st["list"] or "--relist" in sys.argv:
        pg.goto(BASE+"/item",wait_until="domcontentloaded"); pg.wait_for_timeout(3500)
        for i in range(80):
            btn=pg.locator("button, a, div, span").filter(has_text=re.compile(r"더보기\s*\(\d+/\d+\)")).last
            if not btn.count(): log("더보기 버튼 없음"); break
            try: btn.scroll_into_view_if_needed(); btn.click(timeout=5000)
            except Exception as e: log("더보기 끝/실패",str(e)[:60]); break
            pg.wait_for_timeout(1500)
            n=pg.locator("a[href*='itemDetail']").count()
            if i%5==0: log("cards",n)
            try:
                bt=pg.locator("button, a, div, span").filter(has_text=re.compile(r"더보기\s*\(\d+/\d+\)")).last.inner_text(timeout=2000)
                a,t=map(int,re.search(r"\((\d+)/(\d+)\)", bt).groups())
                if a>=t: break
            except Exception: pass
        cards=pg.eval_on_selector_all("a[href*='itemDetail']","els=>els.map(e=>({href:e.getAttribute('href'),text:(e.innerText||'').replace(/\\s+/g,' ').trim()}))")
        seen={}
        for c in cards:
            m=re.search(r"itemId=(\d+)",c["href"] or ""); 
            if not m: continue
            iid=m.group(1); t=c["text"]
            if "성과 데이터를 등록했어요" in t: continue
            if iid not in seen or len(t)>len(seen[iid]["card"]): seen[iid]={"id":iid,"card":t}
        st["list"]=list(seen.values()); STATE.write_text(json.dumps(st,ensure_ascii=False)); log("list",len(st["list"]))
    if "--list-only" in sys.argv: b.close(); sys.exit()
    limit=int(sys.argv[sys.argv.index("--limit")+1]) if "--limit" in sys.argv else 10**9
    only=sys.argv[sys.argv.index("--only")+1].split(",") if "--only" in sys.argv else None
    todo=[x for x in st["list"] if (x["id"] in only if only else x["id"] not in st["details"])][:limit]; log("todo",len(todo))
    for k,x in enumerate(todo):
        iid=x["id"]
        try:
            pg.goto(f"{BASE}/item/itemDetail?itemId={iid}",wait_until="domcontentloaded"); pg.wait_for_timeout(2500)
            body=re.sub(r"[ \t]+"," ",pg.inner_text("body"))
            body=body.split("매주 화요일 아침")[0]
            name=(pg.locator("h1,h2").first.inner_text() if pg.locator("h1,h2").count() else "").strip()
            if not name or name in("Open Ads",): 
                m=re.search(r"인사이터 신청\n(.+?)\n",body); name=(m.group(1).strip() if m else x["card"].split(" ")[0])
            name=re.sub(r"\s*광고상품$","",name)
            # h1이 "이름  태그라인" 형태 → 카드 이름을 우선, 태그라인은 별도 저장
            tagline=""
            if x["card"] and name.startswith(x["card"]): tagline=name[len(x["card"]):].strip(); name=x["card"]
            elif "  " in name: name,tagline=[t.strip() for t in name.split("  ",1)]
            perf=[]
            for m in re.finditer(r"\n\s*\d+\n\s*(\d{4}\.\d{2}(?:\s*~\s*[\d.]+)?[^\n]*?)\s+([^\n]+?)\s+([\d,]+)회\s+([\d,]+)회\s+([\d.]+)%\s+([\d,]+)원",body):
                perf.append({"period":m.group(1).strip(),"industry":m.group(2).strip(),"imp":num(m.group(3)),"clicks":num(m.group(4)),"ctr":float(m.group(5)),"cpc":num(m.group(6))})
            def field(label):
                m=re.search(label+r"\n([^\n]+)",body); return m.group(1).strip() if m else ""
            tags=re.findall(r"#\s?([^\n#]{1,30})",body.split("광고상품 정보")[0].split("광고상품정보 태그")[-1]) if "광고상품정보 태그" in body else []
            intro=body.split("광고상품 내용")[1].split("광고상품정보 태그")[0].strip() if "광고상품 내용" in body else ""
            broch=pg.eval_on_selector_all("a","els=>els.map(e=>[e.getAttribute('href')||'',(e.innerText||'').trim()]).filter(x=>/소개서|다운/.test(x[1])).map(x=>x[0])")
            emails=list(dict.fromkeys(re.findall(r"[\w.+-]+@[\w-]+\.[\w.]+",intro)))
            cpc,cpm,cpv,flat,minb=parse_prices(intro)
            st["details"][iid]={"id":iid,"name":name,"card":x["card"],"intro":intro[:3000],"tags":[t.strip() for t in tags][:15],"creative":field("소재유형"),"device":field("디바이스"),"billing":field("과금 방식"),"brochure":[u for u in broch if u and not u.startswith("javascript")][:2],"perf":perf,"tagline":tagline,"emails":[e for e in emails if "openads" not in e][:3],"cpc":cpc,"cpm":cpm,"cpv":cpv,"flat_price":flat,"min_budget":minb,"url":f"{BASE}/item/itemDetail?itemId={iid}"}
        except Exception as e:
            st["details"][iid]={"id":iid,"name":x["card"][:40],"error":str(e)[:120],"url":f"{BASE}/item/itemDetail?itemId={iid}"}
        if k%10==0: STATE.write_text(json.dumps(st,ensure_ascii=False)); log(k,"/",len(todo),name if 'name' in dir() else iid)
    STATE.write_text(json.dumps(st,ensure_ascii=False)); b.close()
items=[v for v in st["details"].values() if not v.get("error")]
OUT.write_text(json.dumps({"crawled":time.strftime("%Y-%m-%d"),"count":len(items),"items":items},ensure_ascii=False,indent=1))
log("DONE items",len(items),"perf",sum(1 for i in items if i.get("perf")),"errors",sum(1 for v in st["details"].values() if v.get("error")))
