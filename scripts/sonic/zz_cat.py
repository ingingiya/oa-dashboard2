import asyncio, json, re, sys
from playwright.async_api import async_playwright
UA="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
URL=sys.argv[1]; PID="168691181"
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
        for _ in range(8): await pg.mouse.wheel(0,3000); await pg.wait_for_timeout(900)
        t=await pg.evaluate("()=>document.body.innerText"); print("HEAD:", " | ".join([l for l in t.split("\n") if l.strip()][:20])[:400])
        names=[n for n,_,_ in ops]; print("ops:",list(dict.fromkeys(names)))
        for n,req,body in ops:
            if PID in body:
                # 상품 리스트 내 순서
                ids=re.findall(r'"catalog_product_id":"(\d+)"',body); pos=ids.index(PID)+1 if PID in ids else None
                i=body.find(PID); print("FOUND in",n,"pos",pos,"of",len(ids),"| req vars:",re.sub(r'\s+',' ',req)[:400]); print("  ctx:",body[max(0,i-300):i+300].replace("\n"," ")[:600])
        if not any(PID in b for _,_,b in ops): print("product not in captured lists; list ops:",[(n,len(re.findall(r'"catalog_product_id"',b))) for n,_,b in ops][:12])
        await b.close()
asyncio.run(main())
