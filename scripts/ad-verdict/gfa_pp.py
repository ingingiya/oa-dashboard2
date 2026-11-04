import json,sys,re,os
from datetime import date,timedelta
from pathlib import Path
from playwright.sync_api import sync_playwright
src=open('/Users/kirby/oa-dashboard2/scripts/gfa/gfa_daily.py').read().split('\ntry:')[0]
src=src.replace('Path(__file__).resolve().parent','Path("/Users/kirby/oa-dashboard2/scripts/gfa")')
exec(src)
T=date.today(); P={'yday':(T-timedelta(1),T-timedelta(1)),'7d':(T-timedelta(7),T-timedelta(1)),'30d':(T-timedelta(30),T-timedelta(1))}
out={}
with sync_playwright() as pw:
    sys.path.insert(0,"/Users/kirby/oa-dashboard2/scripts/adboost"); from adboost_lib import launch, ensure_login
    ctx=launch(pw); page=ctx.pages[0] if ctx.pages else ctx.new_page(); ensure_login(page)
    page.goto(f"https://ads.naver.com/manage/ad-accounts/{ACCOUNT}/da/report/performance",timeout=60000); page.wait_for_timeout(8000)
    for k,(a,b) in P.items():
        tot,camps,_=fetch_range(ctx,a.isoformat(),b.isoformat())
        out[k]=[c for c in camps if c['cost']]
    daily=[]
    for i in range(30,0,-1):
        d=(T-timedelta(i)).isoformat(); _,camps,_=fetch_range(ctx,d,d)
        for c in camps:
            if re.search('플렌티|프리온',c['name']): daily.append({'day':d,**c})
    out['daily']=daily
    ctx.close()
print(json.dumps(out,ensure_ascii=False))
