#!/usr/bin/env python3
"""오픈애즈 상세 JSON(loadItemWithLikeSubscribe) + 소개서 PDF 다운로드·텍스트 추출 → docs/openads-products.json 보강.
 - 로그인 없이 동작(09-21 확인). 연락처(questionEmail/questionContact)·상품 URL·성과데이터·디바이스/소재/과금·소개서 PDF.
 - PDF: docs/mediakits/openads/{itemId}.pdf, 텍스트 .txt (pdftotext). 금액 파싱: CPC/CPM/CPV·정액·최소예산·단가 문장 스니펫.
 사용: python3 scripts/openads-enrich.py [--limit N] [--no-pdf]
"""
import re, json, sys, time, pathlib, subprocess, requests
D=pathlib.Path(__file__).resolve().parent.parent/"docs"; MK=D/"mediakits"/"openads"; MK.mkdir(parents=True,exist_ok=True)
ST=json.loads((D/"openads-state.json").read_text()); OUT=D/"openads-products.json"
prev={i["id"]:i for i in json.loads(OUT.read_text())["items"]} if OUT.exists() else {}
S=requests.Session(); S.headers.update({"User-Agent":"Mozilla/5.0 (Macintosh) Chrome/128","X-Requested-With":"XMLHttpRequest"}); S.get("https://www.openads.co.kr/item",timeout=30)
def log(*a): print(time.strftime("%H:%M:%S"),*a,flush=True)
def num(s): return int(re.sub(r"[^\d]","",s)) if re.search(r"\d",s or "") else None
def amounts(t):
    out=[]
    for m in re.finditer(r"([\d,]+(?:\.\d+)?)\s*(억|만|천)?\s*원",t or ""):
        try: v=float(m.group(1).replace(",",""))
        except: continue
        v*={"억":1e8,"만":1e4,"천":1e3,None:1}[m.group(2)]; out.append(int(v))
    return out
def parse_prices(text):
    t=re.sub(r"[ \t]+"," ",text or ""); cpc=cpm=cpv=flat=minb=None; snips=[]
    for lab,pat in (("cpc",r"CPC[^\d\n]{0,14}([\d,]+)\s*원"),("cpm",r"CPM[^\d\n]{0,14}([\d,]+)\s*원"),("cpv",r"CPV[^\d\n]{0,14}([\d,]+)\s*원")):
        vals=[num(m.group(1)) for m in re.finditer(pat,t,re.I)]; vals=[v for v in vals if v and 1<=v<=200000]
        if vals: locals()[lab]  # noop
        if lab=="cpc" and vals: cpc=min(vals)
        if lab=="cpm" and vals: cpm=min(vals)
        if lab=="cpv" and vals: cpv=min(vals)
    for m in re.finditer(r"(최소|최저)\s*(집행|광고비|예산|구매)?[^\n]{0,25}?([\d,]+(?:\.\d+)?\s*(?:억|만|천)?\s*원)",t): 
        a=amounts(m.group(3)); 
        if a and a[0]>=10000: minb=minb or a[0]
    for ln in t.splitlines():
        if amounts(ln) and re.search(r"CPC|CPM|CPV|CPT|CPP|정액|구좌|주|일|월|패키지|단가|비용|광고비|VAT",ln): snips.append(re.sub(r"\s+"," ",ln.strip())[:90])
        if len(snips)>=4: break
    big=[a for a in amounts(t) if 100000<=a<=500000000]
    if big: flat=min(big)
    return cpc,cpm,cpv,flat,minb,snips
limit=int(sys.argv[sys.argv.index("--limit")+1]) if "--limit" in sys.argv else 10**9
items=[]; done=0
for x in ST["list"][:limit]:
    iid=x["id"]; base=dict(prev.get(iid) or {"id":iid,"name":x["card"],"url":f"https://www.openads.co.kr/item/itemDetail?itemId={iid}"})
    try:
        r=S.post("https://www.openads.co.kr/item/itemDetail/loadItemWithLikeSubscribe",data={"itemId":iid},headers={"Referer":base["url"]},timeout=30); it=(r.json().get("message") or {}).get("itemData") or {}
        item=it.get("item") or {}; adp=it.get("adp") or {}; doc=it.get("doc") or {}; perf=it.get("perfDataList") or []; link=it.get("link") or {}
        base.update({"name":(item.get("itemName") or base.get("name") or "").strip(),"tagline":item.get("itemTypeDesc") or base.get("tagline") or "","site_url":item.get("itemUrl") or "","contact_email":item.get("questionEmail") or None,"contact_phone":item.get("questionContact") or None,"contact_name":item.get("questionName") or None,
            "reg":item.get("regDtime"),"targeting":(adp.get("itemAdItem") or {}).get("tgtPossYn"),"device":", ".join(d.get("deviceName","") for d in adp.get("devices",[])) or base.get("device",""),
            "creative":", ".join(c.get("creationTypeName") or c.get("itemCreationTypeCode","") for c in adp.get("creations",[])) or base.get("creative",""),
            "billing":", ".join(p.get("payTypeName") or p.get("itemPayTypeCode","") for p in adp.get("payTypes",adp.get("pays",[]))) or base.get("billing",""),
            "tags":[t["tagName"] for t in link.get("tags",[]) if t.get("tagName")][:15] or base.get("tags",[]),
            "perf":[{"period":p.get("periodText"),"industry":p.get("adCategoryName"),"imp":p.get("impCnt"),"clicks":p.get("clickCnt"),"ctr":p.get("ctr"),"cpc":p.get("cpc")} for p in perf] or base.get("perf",[])})
        html=item.get("content") or ""; intro=re.sub(r"<[^>]+>"," ",html).replace("&nbsp;"," "); intro=re.sub(r"[ \t]+"," ",intro).strip()
        if intro: base["intro"]=intro[:4000]
        if doc.get("itemItdeDocId"):
            pdf=MK/f"{iid}.pdf"; txt=MK/f"{iid}.txt"
            base["brochure_name"]=doc.get("fileName"); base["brochure_dl"]=f"https://www.openads.co.kr/item/itemDetail/downloadItemItdeDoc?itemItdeDocId={doc['itemItdeDocId']}"
            if "--no-pdf" not in sys.argv:
                if not pdf.exists() or pdf.stat().st_size<1000:
                    d=S.get(base["brochure_dl"],timeout=120)
                    if d.content[:4]==b"%PDF": pdf.write_bytes(d.content)
                if pdf.exists() and not txt.exists(): subprocess.run(["pdftotext","-layout",str(pdf),str(txt)],capture_output=True,timeout=120)
                if txt.exists():
                    t=txt.read_text(errors="ignore"); base["brochure_pdf"]=str(pdf.relative_to(D.parent)); base["brochure_chars"]=len(t.strip())
                    cpc,cpm,cpv,flat,minb,snips=parse_prices(t+"\n"+intro)
                    base.update({"cpc":cpc,"cpm":cpm,"cpv":cpv,"flat_price":flat,"min_budget":minb,"price_snips":snips})
        elif intro:
            cpc,cpm,cpv,flat,minb,snips=parse_prices(intro); base.update({"cpc":cpc,"cpm":cpm,"cpv":cpv,"flat_price":flat,"min_budget":minb,"price_snips":snips})
        base.pop("error",None)
    except Exception as e: base["error"]=str(e)[:120]
    items.append(base); done+=1
    if done%25==0: log(done,"/",len(ST["list"]),base.get("name"),"pdf" if base.get("brochure_pdf") else "-"); OUT.write_text(json.dumps({"crawled":time.strftime("%Y-%m-%d"),"count":len(items),"items":items},ensure_ascii=False,indent=1))
OUT.write_text(json.dumps({"crawled":time.strftime("%Y-%m-%d"),"count":len(items),"items":items},ensure_ascii=False,indent=1))
log("DONE",len(items),"pdf",sum(1 for i in items if i.get("brochure_pdf")),"price",sum(1 for i in items if i.get("cpc") or i.get("cpm") or i.get("flat_price")),"contact",sum(1 for i in items if i.get("contact_email")),"perf",sum(1 for i in items if i.get("perf")),"err",sum(1 for i in items if i.get("error")))
