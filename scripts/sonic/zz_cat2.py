import asyncio, json, re, sys
from playwright.async_api import async_playwright
UA="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
URL=sys.argv[1]; PID="168691181"
def find_cards(o,out):
    if isinstance(o,dict):
        if o.get("type")=="PRODUCT_CARD" and isinstance(o.get("product_card"),dict) and o["product_card"].get("product_id"): out.append(o["product_card"])
        for v in o.values(): find_cards(v,out)
    elif isinstance(o,list):
        for v in o: find_cards(v,out)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(channel="chrome",headless=True); ctx=await b.new_context(user_agent=UA,viewport={"width":430,"height":900},locale="ko-KR"); pg=await ctx.new_page()
        ops=[]
        async def on_resp(r):
            if "graphql" in r.url:
                try: ops.append((r.url.split("/")[-1], r.request.post_data or "", await r.text()))
                except: pass
        pg.on("response", lambda r: asyncio.ensure_future(on_resp(r)))
        await pg.goto(URL,timeout=60000); await pg.wait_for_timeout(7000)
        for _ in range(10): await pg.mouse.wheel(0,3000); await pg.wait_for_timeout(900)
        allcards=[]; 
        for n,req,body in ops:
            if "PRODUCT_CARD" not in body: continue
            try: d=json.loads(body)
            except: continue
            cards=[]; find_cards(d,cards)
            if not cards: continue
            m=re.search(r'"(?:sort|order|sorting)[a-z_]*":"?([A-Za-z_]+)',req); print(n,"cards",len(cards),"sort:",m.group(1) if m else None, "| vars:",re.sub(r'\s+',' ',req)[:0])
            allcards+= [c for c in cards]
        ids=[c["product_id"] for c in allcards]; uniq=list(dict.fromkeys(ids)); pos=uniq.index(PID)+1 if PID in uniq else None
        print("TOTAL uniq cards",len(uniq),"| sonic pos",pos)
        me=[c for c in allcards if c["product_id"]==PID]
        if me: s=json.dumps(me[0],ensure_ascii=False); print("CARD keys:",list(me[0].keys())); print("badges/nudge:",re.findall(r'"(?:text|title)":"([^"]{1,30})"',s)[:20]); print("ENGAGEMENT:",json.dumps(me[0].get("engagement"),ensure_ascii=False)[:600]); print("META:",json.dumps(me[0].get("meta"),ensure_ascii=False)[:300]); print("BADGE:",re.findall(r"\"text\":\"([^\"]{1,30})\"",json.dumps(me[0].get("badge"),ensure_ascii=False))[:10])
        await b.close()
asyncio.run(main())
