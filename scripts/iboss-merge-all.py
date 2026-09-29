#!/usr/bin/env python3
"""외부 광고상품 DB 재생성: docs/iboss-merged.json ← 아이보스 원본 + 웹조사 + 매체소개서 조사 + 수동 보강 + 위픽업(텍스트/OCR) + 애즈순 + 연락처 + 썸네일
재실행하면 처음부터 다시 만든다(멱등). 소스가 늘면 여기에 단계 추가."""
import json, re, pathlib, subprocess, urllib.request, urllib.parse, concurrent.futures as cf
ROOT=pathlib.Path(__file__).resolve().parent.parent; D=ROOT/"docs"; TH=pathlib.Path.home()/"oa-adcost/thumbs"; TH.mkdir(parents=True,exist_ok=True)
S=pathlib.Path("/private/tmp/claude-501/-Users-kirby/0cc44013-5eb1-49cc-a1a3-f7009066ff5f/scratchpad")
def norm(s): return re.sub(r"[\s\(\)\[\]·\-_/,.'\"&]+","",(s or "").lower())
def J(p): return json.loads(pathlib.Path(p).read_text())
ib=J(D/"iboss-ad-products.json"); items=ib["items"]; byn={norm(i["name"]):i for i in items}
def find(name): return byn.get(norm(name))
def add(t): items.append(t); byn[norm(t["name"])]=t; return t
def fill(t,src,keys=("cpc","cpm","cpv","flat_price","min_budget")):
    for k in keys:
        if src.get(k) and not t.get(k): t[k]=src[k]
# 1) 웹 조사 + 매체 소개서 조사
for w in J(D/"iboss-web-prices.json")["items"]:
    t=find(w.get("match_iboss_name") or "") or find(w["name"]) or add({"name":w["name"],"category":w.get("category") or "#기타","platform_type":"","url":w.get("source_url") or "","cpc":None,"cpm":None,"cpv":None,"flat_price":None,"min_budget":None,"pricing_text":"","tags":[]})
    fill(t,w)
    for k,s in (("web_note","price_note"),("source_url","source_url"),("source_year","source_year"),("fit","fit_for_oa"),("fit_reason","fit_reason"),("price_basis","price_basis"),("audience","audience")):
        if w.get(s) and not t.get(k): t[k]=w[s]
    if w.get("cpc_measured_low"): t["cpc_range"]=f"{w['cpc_measured_low']}~{w.get('cpc_measured_high') or ''}"
if (D/"iboss-mediakit-prices.json").exists():
    for m in J(D/"iboss-mediakit-prices.json")["items"]:
        t=find(m["name"])
        if not t: continue
        if m.get("status")=="priced":
            fill(t,m); t.setdefault("price_basis","공시/소개서")
            for k,s in (("web_note","price_note"),("source_url","kit_url"),("source_year","kit_year"),("fit","fit_for_oa"),("fit_reason","fit_reason")):
                if m.get(s) and not t.get(k): t[k]=m[s]
        elif m.get("status")=="kit_no_price" and not t.get("web_note"):
            t["web_note"]=m.get("price_note") or "소개서 있음, 단가 비공개"; t["source_url"]=t.get("source_url") or m.get("kit_url"); t["fit"]=t.get("fit") or m.get("fit_for_oa"); t["fit_reason"]=t.get("fit_reason") or m.get("fit_reason")
        if m.get("kit_file") and str(m["kit_file"]).endswith(".pdf") and pathlib.Path(m["kit_file"]).exists(): t["_kit_pdf"]=m["kit_file"]
# 2) 수동 보강(직접 검색, 09-15)
MANUAL=[("올웨이즈 첫 광고주",{"cpc":70,"cpm":1050},"billing=CPC/CPM; 첫 광고주 프로모션 30% 할인 CPC 70원·CPM 1,050원, 정가 CPC 100원~·CPM 1,500원","공시/프로모션","high"),("화해 광고상품소개서",{"cpm":3000},"billing=CPM; 포커스 배너 CPM 3,000원, 와이드 6,000원, 우측여백 10,000원 (VAT 별도)","공시/단가표","high"),("크루비",{"flat_price":550000,"min_budget":550000},"billing=정액; 테스트 주 55만원(노출 5만회↑), 월 99만원","공시/정액","high"),("아이웨딩",{"flat_price":700000},"billing=정액; 앱 오픈 전면 7일 독점 100만원 → 프로모션 70만원","공시/정액","high"),("네이버 쇼핑라이브 광고",{"cpc":400,"min_budget":3000000},"billing=CPA; 라이브 알림받기 건당 400원, 최소 300만원","공시/단가표","mid"),("네이버 브랜드메시지",{"cpc":10},"billing=건당; 무료 건수 소진 후 건당 10원","공시/단가표","mid"),("디지털캠프 Ai 쇼핑",{"cpc":20},"billing=CPC; 리워드 DA 패키지 CPC 20원(2026.03)","공시","mid"),("리얼클릭 DSP",{"cpc":50},"billing=CPC; 최소 입찰 50원, 리타겟 14~20원","공시/최저입찰","mid"),("클래스팅",{"cpm":8000,"min_budget":5000000},"billing=CPM; 네이티브 CPM 8,000원, 최소 500만원(2017)","공시(구)","mid"),("타겟팅게이츠",{"cpc":186,"min_budget":1000000},"billing=CPC; 모바일 186원/PC 270원, 최소 100만원","실측평균","mid"),("카울리",{"cpc":500,"cpm":1500},"billing=CPC/CPM; 소셜애드 CPM 1,500원/CPC 500원(구)","공시(구)","mid"),("엘포인트",{"cpc":50},"billing=건당; 앱 푸시 건당 50원, 문자 150~200원","공시","mid"),("네이버웹툰 원화컷",{"cpm":1500},"billing=CPM; 띠배너 CPM 1,500원","공시","mid"),("컬리 광고",{"cpm":13000},"billing=CPM; 공시 CPM 13,000원, 프로모션 30~60% 할인","공시","mid"),("지그재그 광고",{"cpc":400,"min_budget":10000},"billing=CPC; 평균 200~600원, 일 예산 1만원부터. 실측 585원","실측평균","mid"),("SSG닷컴 광고",{"min_budget":1000000},"billing=CPC/CPM; 월 100만원부터","공시","mid")]
for sub,f,note,basis,fit in MANUAL:
    t=next((i for i in items if sub in i["name"]),None)
    if t: fill(t,f); t["web_note"]=note; t["price_basis"]=basis; t["fit"]=t.get("fit") or fit; t["source_year"]=t.get("source_year") or 2026
# 3) 위픽업 (텍스트 + OCR)
def pick(pr,k,lo,hi):
    v=[x for x in (pr or {}).get(k+"_all",[]) if lo<=x<=hi]; return min(v) if v else None
WCAT={"오프라인: DOOH":"#옥외광고","DOOH":"#옥외광고","OOH":"#옥외광고","오프라인: ATL":"#TV/라디오/인쇄","오프라인: BTL":"#오프라인 프로모션","오프라인: 기타":"#오프라인","온라인: 보상형":"#리워드 광고","온라인: 커머스":"#커머스 광고","온라인: 포털":"#포털 광고","포털":"#포털 광고","온라인: 소셜미디어":"#소셜미디어 광고","온라인: 앱":"#앱 광고","온라인: 플랫폼":"#플랫폼 광고","온라인:플랫폼":"#플랫폼 광고","플랫폼":"#플랫폼 광고","온라인: 기타":"#기타","기타":"#기타"}
wp=J(D/"wepick-brochures.json") if (D/"wepick-brochures.json").exists() else []
for w in wp:
    if not w.get("pdf") or w.get("status")=="err": continue
    comp,prod=(w.get("company") or "").strip(),(w.get("product") or "").strip()
    pr=w.get("prices") or {}; vals={"cpc":pick(pr,"cpc",5,50000),"cpm":pick(pr,"cpm",100,300000),"cpv":pick(pr,"cpv",1,5000),"flat_price":pick(pr,"flat_price",50000,200000000),"min_budget":pick(pr,"min_budget",10000,500000000)}
    t=None
    for cand in (prod, comp+" "+prod, comp):
        t=find(cand)
        if t: break
    if t is None and comp and len(norm(comp))>=2:
        t=next((i for i in items if norm(comp) in norm(i["name"]) and (norm(prod)[:6] in norm(i["name"]) or len(norm(i["name"]))<=len(norm(comp))+6)),None)
    if t is None:
        t=add({"name":prod if (comp and norm(comp) in norm(prod)) or not comp else f"{comp} {prod}","category":WCAT.get(w.get("category") or "기타","#기타"),"platform_type":"","url":w["url"],"cpc":None,"cpm":None,"cpv":None,"flat_price":None,"min_budget":None,"pricing_text":"","tags":[]})
    fill(t,vals); ocr=w.get("status")=="ok_ocr"
    if any(vals.values()) or not t.get("web_note"):
        t["web_note"]=("위픽업 소개서 OCR" if ocr else "위픽업 소개서")+f"({w.get('ref') or ''}) "+((" / ".join(w.get("snippets",[])[:2])[:150]) if w.get("snippets") else "이미지형 PDF라 단가 자동추출 안 됨, 소개서 직접 확인"); t["price_basis"]="소개서 OCR(확인 필요)" if ocr else "소개서(위픽업)"
    t["brochure_pdf"]=w["pdf"]; t["source_url"]=t.get("source_url") or w["url"]; t["source_year"]=t.get("source_year") or (w.get("ref") or "")[:4]; t["_wp_id"]=w["id"]
# 4) 애즈순
AS=D/"adssoon-products.json"
if AS.exists():
    ACAT={"CPP 배너":"#디스플레이 광고","CPM 배너":"#디스플레이 광고","CPC 배너":"#디스플레이 광고","CPA 배너":"#디스플레이 광고","디스플레이":"#디스플레이 광고","메세지":"#메시지","라이브커머스광고":"#라이브커머스","숏폼":"#동영상 광고","퀴즈":"#리워드 광고","참여형":"#리워드 광고","체험단/협찬":"#콘텐츠/체험단"}
    BE=re.compile(r"뷰티|여성|패션|헬스|건강|커머스|쇼핑|멤버쉽|멤버십|리워드|올리브영|화장품")
    for x in J(AS)["details"]:
        if x.get("err"): continue
        media=(x.get("medias") or [{}])[0].get("mediaName","").strip(); title=x["productTitle"].strip()
        name=title if (media and norm(media) in norm(title)) or not media else f"{media} {title}"
        if find(name) or find(title): continue
        price=x.get("salesPrice") or x.get("price") or 0; gt=x.get("guaranteeType"); ga=x.get("guaranteeAmount") or 0; cpc=cpm=cpv=None; unit=""
        if price and ga:
            if gt=="click": cpc=round(price/ga); unit=f"보장 클릭 {ga:,}회"
            elif gt=="impression": cpm=round(price/ga*1000); unit=f"보장 노출 {ga:,}회"
            elif gt=="viewer": cpv=round(price/ga); unit=f"보장 시청 {ga:,}명"
            elif gt=="send_volume": unit=f"발송 {ga:,}건 (건당 {round(price/ga)}원)"
            elif gt: unit=f"보장 {gt} {ga:,}"
        ptype=next((t["tagName"] for t in x.get("tags",[]) if t["tag"].startswith("ptype")),""); mt=[t["tagName"] for t in x.get("tags",[]) if t["tag"].startswith("mtype")]; tg=[t["productTargetName"] for t in x.get("targets",[])]; aud=" · ".join(mt+tg)
        fit="high" if BE.search(" ".join(mt)+media+title) and ("뷰티" in aud or "여성" in aud or "올리브영" in name) else ("mid" if BE.search(aud+media) else "low")
        add({"name":name,"category":ACAT.get(ptype,"#디스플레이 광고"),"platform_type":ptype,"audience":aud,"url":f"https://www.ads-soon.com/product/details/{x['productNo']}","cpc":cpc,"cpm":cpm,"cpv":cpv,"flat_price":price or None,"min_budget":price or None,"pricing_text":"","tags":mt,"web_note":f"애즈순 예약가 {price:,}원~ ({unit or '보장 없음'}, {ptype}) · 예약 구매형, 애즈순(ads@cv-3.com, 070-4400-5732) 통해 집행 · 주문 {x.get('orderCount') or 0}건","price_basis":"애즈순 공시","source_url":f"https://www.ads-soon.com/product/details/{x['productNo']}","source_year":"2026","fit":fit,"fit_reason":("뷰티·여성 타겟 매체" if fit=="high" else aud[:60]),"contact_email":"ads@cv-3.com","contact_phone":"070-4400-5732","brochure_pdf":x.get("introFileUrl") or None,"adssoon":True,"_as_no":x["productNo"]})

# 4b) 오픈애즈 (openads.co.kr/item — NHN AD 디렉토리, 매체사 등록 실측 성과 데이터 포함)
OA_=D/"openads-products.json"
if OA_.exists():
    OCAT={"배너":"#디스플레이 광고","컨텐츠":"#콘텐츠광고","메시지":"#메시지","옥외":"#옥외 광고","검색":"#검색광고","동영상":"#동영상 광고"}
    BE2=re.compile(r"뷰티|여성|패션|헬스|건강|커머스|쇼핑|주부|맘|육아|2030|3040|올리브영|화장품|라이프스타일")
    n_add=0
    for x in J(OA_)["items"]:
        name=(x.get("name") or "").strip()
        if not name or find(name): continue
        perf=x.get("perf") or []
        pcpc=round(sum(p["cpc"]*p["clicks"] for p in perf if p.get("cpc") and p.get("clicks"))/max(sum(p["clicks"] for p in perf if p.get("cpc") and p.get("clicks")),1)) if any(p.get("cpc") for p in perf) else None
        cpc=pcpc or x.get("cpc"); 
        pn=" / ".join(f"{p['period']} {p['industry']}: 노출 {p['imp']:,}·클릭 {p['clicks']:,}·CTR {p['ctr']}%·CPC {p['cpc']:,}원" for p in perf[:3])
        text=" ".join([x.get("tagline") or "",x.get("intro") or "",x.get("card") or ""," ".join(x.get("tags") or [])])
        fit="high" if BE2.search(text) and re.search(r"뷰티|여성|주부|맘|올리브영|화장품",text) else ("mid" if BE2.search(text) else "low")
        cre=(x.get("creative") or "").split(",")[0].strip()
        add({"name":name,"category":OCAT.get(cre,"#디스플레이 광고"),"platform_type":", ".join(v for v in [x.get("creative"),x.get("device"),x.get("billing")] if v)[:200],"audience":((x.get("tagline") or "")+" | "+", ".join((x.get("tags") or [])[:8]))[:200],
             "url":x["url"],"cpc":cpc,"cpm":x.get("cpm"),"cpv":x.get("cpv"),"flat_price":x.get("flat_price"),"min_budget":x.get("min_budget"),"pricing_text":(x.get("billing") or "")+(" · 소개서 참조" if not (cpc or x.get("cpm") or x.get("flat_price")) else ""),
             "tags":(x.get("tags") or [])[:10],"web_note":(("★매체사 등록 실측: "+pn+" · ") if pn else "")+(("소개서 단가: "+" / ".join(x.get("price_snips") or [])[:220]+" · ") if x.get("price_snips") else "")+"오픈애즈(NHN AD)"+(f" · 소개서 {x.get('brochure_name')}" if x.get("brochure_name") else "")+". "+((x.get("intro") or "").replace("\n"," ")[:120]),
             "price_basis":"오픈애즈 실측(매체사 등록)" if pn else ("오픈애즈 소개서 PDF" if x.get("brochure_chars") else "오픈애즈 공시"),"source_url":x["url"],"source_year":"2026","fit":fit,"fit_reason":(x.get("tagline") or x.get("card") or "")[:60],
             "contact_email":x.get("contact_email") or (x.get("emails") or [None])[0],"contact_phone":x.get("contact_phone"),"contact_person":x.get("contact_name"),"contact_src":"오픈애즈 문의 정보" if x.get("contact_email") else None,
             "brochure_pdf":("https://oa-dashboard2.vercel.app/"+x["brochure_pdf"]) if False else None,"brochure_dl":x.get("brochure_dl"),"openads":True,"openads_perf":perf[:5] or None}); n_add+=1
    print("openads added",n_add)

# 5) 카테고리 정규화
CM={"디스플레이":"#디스플레이 광고","커머스":"#커머스 광고","#온라인: 플랫폼":"#플랫폼 광고","#온라인: 앱":"#앱 광고","#온라인: 기타":"#기타","#온라인: 포털":"#포털 광고","#온라인: 보상형":"#리워드 광고","#온라인: 소셜미디어":"#소셜미디어 광고","#온라인: 커머스":"#커머스 광고","#콘텐츠 광고":"#콘텐츠광고","#영상광고":"#동영상 광고","#동영상":"#동영상 광고","리워드":"#리워드 광고","검색":"#검색광고","소셜":"#소셜미디어 광고","#오프라인: DOOH":"#옥외광고","#DOOH":"#옥외광고","#OOH":"#옥외광고","#옥외/사이니지":"#옥외광고","#오프라인: 기타":"#오프라인"}
for i in items:
    c=i.get("category") or "#기타"; c=CM.get(c,c); c=c if c.startswith("#") else "#"+c; i["category"]=CM.get(c,c)
# 6) 연락처 (위픽업 텍스트/OCR + 매체소개서 PDF)
EM=re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"); PH=re.compile(r"(?:0\d{1,2}[-.\s]\d{3,4}[-.\s]\d{4}|1\d{3}[-.\s]\d{4}|01[016789]\d{7,8})")
BAD=("wepick","i-boss","example","noreply","no-reply","sentry","google","facebook","adobe","apple","microsoft","developer@","test@",".png",".jpg",".gif")
def contacts(txt):
    ems=[e for e in dict.fromkeys(EM.findall(txt)) if not any(b in e.lower() for b in BAD)][:2]; phs=[p for p in dict.fromkeys(PH.findall(txt)) if not re.match(r"^0{3,}",p)][:2]; return ems,phs
W=D/"mediakits/wepick"
for i in items:
    if i.get("contact_email"): continue
    txt=""
    if i.get("_wp_id"):
        for suf in (".txt",".ocr.txt"):
            f=W/(i["_wp_id"]+suf)
            if f.exists(): txt+=f.read_text(errors="ignore")
    elif i.get("_kit_pdf"): txt=subprocess.run(["pdftotext",i["_kit_pdf"],"-"],capture_output=True,text=True,errors="ignore").stdout
    if txt:
        ems,phs=contacts(txt)
        if ems or phs: i["contact_email"]=", ".join(ems); i["contact_phone"]=", ".join(phs)
# 6b) 애즈순 항목에 같은 매체의 직접 연락처 붙이기 (위픽업/소개서에서 뽑은 매체 담당자)
def mkey(s): return norm(re.sub(r"(광고|상품|소개서|통합|배너|DA|앱)","",s or ""))
direct={}
for i in items:
    if i.get("adssoon") or not i.get("contact_email") or "cv-3.com" in i["contact_email"]: continue
    k=mkey(i["name"])[:6]
    if len(k)>=2: direct.setdefault(k,(i["name"],i["contact_email"],i.get("contact_phone") or ""))
for i in items:
    if not i.get("adssoon"): continue
    media=(i["name"].split(" ")[0] if " " in i["name"] else i["name"]); k=mkey(media)[:6]
    hit=direct.get(k) or next((v for kk,v in direct.items() if len(k)>=3 and (kk.startswith(k) or k.startswith(kk))),None)
    if hit: i["direct_contact"]=hit[1]; i["direct_contact_from"]=hit[0]; i["direct_phone"]=hit[2]
# 7) 썸네일
jobs=[]
for i in items:
    if i.get("_wp_id") and (W/(i["_wp_id"]+".pdf")).exists(): i["thumb"]=f"thumbs/{i['_wp_id']}.jpg"; jobs.append((W/(i["_wp_id"]+".pdf"),TH/(i["_wp_id"]+".jpg")))
    elif i.get("_kit_pdf"): k="mk_"+pathlib.Path(i["_kit_pdf"]).stem; i["thumb"]=f"thumbs/{k}.jpg"; jobs.append((pathlib.Path(i["_kit_pdf"]),TH/(k+".jpg")))
    elif i.get("_as_no") and (D/"mediakits/adssoon"/f"{i['_as_no']}.pdf").exists(): i["thumb"]=f"thumbs/as_{i['_as_no']}.jpg"; jobs.append((D/"mediakits/adssoon"/f"{i['_as_no']}.pdf",TH/f"as_{i['_as_no']}.jpg"))
def mk(j):
    src,dst=j
    if dst.exists(): return 1
    try: subprocess.run(["pdftoppm","-jpeg","-r","50","-f","1","-l","1","-scale-to","640","-singlefile",str(src),str(dst.with_suffix(""))],check=True,timeout=120,capture_output=True); return 1
    except Exception: return 0
with cf.ThreadPoolExecutor(6) as ex: ok=sum(ex.map(mk,jobs))
for i in items:
    if i.get("thumb") and not (pathlib.Path.home()/"oa-adcost"/i["thumb"]).exists(): i.pop("thumb",None)
    for k in ("_wp_id","_kit_pdf","_as_no"): i.pop(k,None)
ib["count"]=len(items); ib["merged"]=str(__import__("datetime").date.today())
(D/"iboss-merged.json").write_text(json.dumps(ib,ensure_ascii=False,indent=1))
print("total",len(items),"any price",sum(1 for i in items if i.get("cpc") or i.get("cpm") or i.get("flat_price")),"cpc",sum(1 for i in items if i.get("cpc")),"thumb",sum(1 for i in items if i.get("thumb")),"contact",sum(1 for i in items if i.get("contact_email")),"adssoon",sum(1 for i in items if i.get("adssoon")))
