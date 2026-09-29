#!/usr/bin/env python3
"""소닉플로우 미니 무신사/지그재그 랭킹·관심 트래커 → settings oa_sonic_rank_v1 (09-23)
무신사: 뷰티 실시간 랭킹 API(sections/231, 헤어케어 104006·전체 104000) 순위 + "N명이 보는 중"(노출될 때만) + stat(조회·구매) + 리뷰수
지그재그: 카테고리 추천순 리스트(헤어기기 1671/1895, 이미용가전 1862/2448) 위치 + 관심(fomo) + 리뷰 + 가격. "N명이 보고 있어요"는 앱 전용이라 웹/API에 없음."""
import json, re, os, sys, asyncio, urllib.request, urllib.parse, datetime
ROOT=os.path.expanduser("~/oa-dashboard2"); env=dict(l.strip().split("=",1) for l in open(f"{ROOT}/.env.local",encoding="utf-8") if "=" in l and not l.startswith("#"))
URL=(env.get("NEXT_PUBLIC_SUPABASE_URL") or env.get("SUPABASE_URL")).strip('"'); KEY=(env.get("SUPABASE_SERVICE_ROLE_KEY")).strip('"')
H={"apikey":KEY,"Authorization":f"Bearer {KEY}","Content-Type":"application/json"}
# ★09-29: --product 로 추적 상품 선택 (기본 sonic). airstraight = 에어스트레이트(무신사만, 지그재그/에이블리 미입점 → 스킵)
PRODUCTS={"sonic":{"key":"oa_sonic_rank_v1","name":"소닉플로우 미니","ms":"6074981","zz":"168691181","ably":True},
          "airstraight":{"key":"oa_airstraight_rank_v1","name":"에어스트레이트","ms":"7009064","zz":None,"ably":False}}
PRODUCT=sys.argv[sys.argv.index("--product")+1] if "--product" in sys.argv else "sonic"; CFG=PRODUCTS[PRODUCT]
KEYNAME=CFG["key"]; MS_ID=CFG["ms"]; ZZ_ID=CFG["zz"] or ""
UA="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
def get(u,hdr=None):
    if hdr: r=urllib.request.Request(u,headers=hdr); return json.load(urllib.request.urlopen(r,timeout=40))
    import subprocess; out=subprocess.run(["curl","-s","-m","40","-A","Mozilla/5.0","-H","Referer: https://www.musinsa.com/","-H","Accept: application/json",u],capture_output=True,text=True).stdout; return json.loads(out)
def walk(o,fn):
    if isinstance(o,dict):
        fn(o); [walk(v,fn) for v in o.values()]
    elif isinstance(o,list): [walk(v,fn) for v in o]
def musinsa():
    out={"hair_rank":None,"all_rank":None,"viewers":None,"buying":None}
    for cat,k in (("104006","hair_rank"),("104000","all_rank")):
        try:
            d=get(f"https://api.musinsa.com/api2/hm/web/v5/pans/ranking/sections/231?storeCode=beauty&categoryCode={cat}&contentsId=")
            items=[]; walk(d,lambda o: items.append(o) if o.get("type")=="PRODUCT_COLUMN" and "info" in o else None)
            ids=[i["id"] for i in items]; out[k]=ids.index(MS_ID)+1 if MS_ID in ids else None; out[k+"_total"]=len(ids)
            if MS_ID in ids:
                for a in items[ids.index(MS_ID)]["info"].get("additionalInformation",[]):
                    t=a.get("text","")
                    if "보는 중" in t: out["viewers"]=t
                    if "구매 중" in t: out["buying"]=t
        except Exception as e: out[k+"_err"]=str(e)[:80]
    try: s=get(f"https://goods-detail.musinsa.com/api2/goods/{MS_ID}/stat")["data"]; out["page_view_total"]=s.get("pageViewTotal"); out["purchase_total"]=s.get("purchaseTotal")
    except Exception as e: out["stat_err"]=str(e)[:80]
    try:
        g=get(f"https://goods-detail.musinsa.com/api2/goods/{MS_ID}")["data"]; out["reviews"]=(g.get("goodsReview") or {}).get("totalCount"); out["review_score"]=(g.get("goodsReview") or {}).get("satisfactionScore")
        gp=g.get("goodsPrice") or {}; out["normal_price"]=gp.get("normalPrice"); out["sale_price"]=gp.get("salePrice"); out["final_price"]=gp.get("finalPrice"); out["discount"]=gp.get("finalDiscount") or gp.get("discountRate")
    except Exception as e: out["goods_err"]=str(e)[:80]
    return out
def find_cards(o,out):
    if isinstance(o,dict):
        if o.get("type")=="PRODUCT_CARD" and isinstance(o.get("product_card"),dict) and o["product_card"].get("product_id"): out.append(o["product_card"])
        for v in o.values(): find_cards(v,out)
    elif isinstance(o,list):
        for v in o: find_cards(v,out)
async def zz_cat(pg,url):
    ops=[]
    async def on_resp(r):
        if "graphql" in r.url:
            try: ops.append(await r.text())
            except: pass
    pg.on("response", lambda r: asyncio.ensure_future(on_resp(r)))
    await pg.goto(url,timeout=60000); await pg.wait_for_timeout(6000)
    for _ in range(10): await pg.mouse.wheel(0,3000); await pg.wait_for_timeout(800)
    cards=[]
    for body in ops:
        if "PRODUCT_CARD" not in body: continue
        try: find_cards(json.loads(body),cards)
        except: pass
    uniq=list(dict.fromkeys(c["product_id"] for c in cards)); me=next((c for c in cards if c["product_id"]==ZZ_ID),None)
    return (uniq.index(ZZ_ID)+1 if ZZ_ID in uniq else None), len(uniq), me
async def zigzag():
    from playwright.async_api import async_playwright
    out={"hair_rank":None,"appliance_rank":None}
    async with async_playwright() as p:
        b=await p.chromium.launch(channel="chrome",headless=True); ctx=await b.new_context(user_agent=UA,viewport={"width":430,"height":900},locale="ko-KR")
        for url,k in (("https://zigzag.kr/pages/srp-clp-category?category_id=1671&sub_category_id=1895","hair_rank"),("https://zigzag.kr/pages/srp-clp-category?category_id=1862&sub_category_id=2448","appliance_rank")):
            try:
                pg=await ctx.new_page(); pos,total,me=await zz_cat(pg,url); await pg.close(); out[k]=pos; out[k+"_total"]=total
                if me and "interest" not in out:
                    f=((me.get("engagement") or {}).get("fomo") or {}).get("fomo_text"); out["interest"]=f
                    out["reviews"]=(me.get("review") or {}).get("count"); out["review_score"]=(me.get("review") or {}).get("score")
                    pr=me.get("price") or {}; out["price"]=pr.get("final_price"); out["discount"]=pr.get("final_price_discount_rate")
            except Exception as e: out[k+"_err"]=str(e)[:80]
        await b.close()
    return out
def ably():
    """에이블리 랭킹(웹 API는 카테고리별 톱10만): 뷰티>뷰티기기>헤어 기기(652)·뷰티기기(651)·뷰티 전체, 일간/주간. 순위 없으면 None(=10위 밖)"""
    import uuid
    out={}
    try:
        H0={"User-Agent":"Mozilla/5.0","x-web-type":"Web","x-device-type":"PCWeb","x-app-version":"0.1.0","x-device-id":str(uuid.uuid4()),"Accept":"application/json","Referer":"https://m.a-bly.com/"}
        tok=json.load(urllib.request.urlopen(urllib.request.Request("https://api.a-bly.com/api/v2/anonymous/token/",headers=H0),timeout=30))["token"]; H1={**H0,"x-anonymous-token":tok}
        for key,q in (("hair_device","market_type_sno=3&category_sno=652"),("beauty_device","market_type_sno=3&category_sno=651"),("beauty_all","market_type_sno=3")):
            for period in ("daily","weekly"):
                d=json.load(urllib.request.urlopen(urllib.request.Request(f"https://api.a-bly.com/api/v2/goods/?filter=best&{q}&period={period}",headers=H1),timeout=30))
                gs=d.get("goods") or []; pos=next((n+1 for n,g in enumerate(gs) if "소닉플로우" in (g.get("name") or "")),None)
                out[f"{key}_{period}"]=pos; out[f"{key}_{period}_total"]=len(gs)
                if pos:
                    g=gs[pos-1]; out["sno"]=g.get("sno"); out["sell_count"]=g.get("sell_count"); out["reviews"]=g.get("total_review_count"); out["price"]=g.get("price"); out["discount"]=g.get("discount_rate")
        # 상품 검색으로 가격·판매수 (sno 55114185)
        d=json.load(urllib.request.urlopen(urllib.request.Request("https://api.a-bly.com/api/v2/screens/SEARCH_RESULT/?query="+urllib.parse.quote("소닉플로우"),headers=H1),timeout=30))
        found=[]
        def w(o):
            if isinstance(o,dict):
                if o.get("sno")==55114185 and "price" in o: found.append(o)
                for v in o.values(): w(v)
            elif isinstance(o,list):
                for v in o: w(v)
        w(d)
        if found:
            it=found[0]; out["sno"]=55114185; out["price"]=it.get("price"); out["discount"]=it.get("discount_rate"); out["sell_count"]=it.get("sell_count"); out["reviews"]=it.get("total_review_count"); out["normal_price"]=it.get("original_price") or it.get("origin_price")
        # 상세 API: 좋아요·리뷰·가격 보강
        try:
            g=json.load(urllib.request.urlopen(urllib.request.Request("https://api.a-bly.com/api/v2/goods/55114185/",headers=H1),timeout=30)); gg=g.get("goods") or g
            for k,v in (("likes","likes_count"),("reviews","total_review_count"),("sell_count","sell_count"),("price","price"),("discount","discount_rate"),("normal_price","original_price")):
                if gg.get(v) is not None: out[k]=gg.get(v)
            ac=gg.get("applied_coupon") or {}; out["coupon_price"]=ac.get("price") or ac.get("discounted_price") or ac.get("final_price"); out["coupon_text"]=ac.get("title") or ac.get("name") or (gg.get("price_description") if isinstance(gg.get("price_description"),str) else None)
        except Exception as e: out["detail_err"]=str(e)[:80]
    except Exception as e: out["err"]=str(e)[:100]
    return out
def save(rec):
    try: cur=(get(f"{URL}/rest/v1/settings?key=eq.{KEYNAME}&select=value",H) or [{}])[0].get("value") or {}
    except Exception: cur={}
    hist=(cur.get("history") or []); hist.append(rec); hist=hist[-720:]
    val={"product":CFG["name"],"links":{"musinsa":f"https://www.musinsa.com/products/{MS_ID}",**({"zigzag":f"https://zigzag.kr/catalog/products/{ZZ_ID}","ably":"https://m.a-bly.com/goods/55114185"} if PRODUCT=="sonic" else {})},"latest":rec,"history":hist,"updated_at":rec["ts"]}
    req=urllib.request.Request(f"{URL}/rest/v1/settings",data=json.dumps([{"key":KEYNAME,"value":val}],ensure_ascii=False).encode(),headers={**H,"Prefer":"resolution=merge-duplicates,return=minimal"},method="POST"); urllib.request.urlopen(req,timeout=40).read()
if __name__=="__main__":
    ts=datetime.datetime.now().strftime("%Y-%m-%d %H:%M"); rec={"ts":ts,"musinsa":musinsa(),"zigzag":asyncio.run(zigzag()) if CFG["zz"] else {},"ably":ably() if CFG["ably"] else {}}
    print(json.dumps(rec,ensure_ascii=False)); save(rec); print("saved",KEYNAME)
