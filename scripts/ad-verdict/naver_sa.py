import hmac,hashlib,base64,time,json,urllib.request,urllib.parse,datetime,re
from pathlib import Path
env={}
for l in Path('/Users/kirby/oa-dashboard2/.env.local').read_text().splitlines():
    if '=' in l and not l.startswith('#'): k,v=l.split('=',1); env[k.strip()]=v.strip().strip('"')
K,C,S=env['NAVER_API_KEY'],env['NAVER_CUSTOMER_ID'],env['NAVER_SECRET_KEY']
def nget(path,**p):
    ts=str(int(time.time()*1000)); sig=base64.b64encode(hmac.new(S.encode(),f"{ts}.GET.{path}".encode(),hashlib.sha256).digest()).decode()
    r=urllib.request.Request(f"https://api.searchad.naver.com{path}?{urllib.parse.urlencode(p)}",headers={"X-API-KEY":K,"X-Customer":C,"X-Timestamp":ts,"X-Signature":sig})
    return json.loads(urllib.request.urlopen(r,timeout=60).read())
T=datetime.date.today()
P={'yday':(T-datetime.timedelta(1),T-datetime.timedelta(1)),'7d':(T-datetime.timedelta(7),T-datetime.timedelta(1)),'30d':(T-datetime.timedelta(30),T-datetime.timedelta(1))}
camps=nget('/ncc/campaigns'); out=[]
for c in camps:
    for g in nget('/ncc/adgroups',nccCampaignId=c['nccCampaignId']):
        nm=c['name']+' › '+g['name']
        if not re.search(r'플렌티|plenti|프리온|preon',nm,re.I): continue
        row={'camp':c['name'],'group':g['name'],'type':c.get('campaignTp'),'status':g.get('status'),'enabled':not g.get('userLock')}
        for k,(a,b) in P.items():
            ds=nget('/stats',id=g['nccAdgroupId'],fields=json.dumps(["impCnt","clkCnt","salesAmt","ccnt","convAmt","purchaseCcnt","purchaseConvAmt"]),timeRange=json.dumps({"since":str(a),"until":str(b)})).get('data') or []
            row[k]={x:sum(float(d.get(x) or 0) for d in ds) for x in ["impCnt","clkCnt","salesAmt","ccnt","convAmt","purchaseCcnt","purchaseConvAmt"]}
            if k=='30d': row['daily']=[{'day':d['dateStart'],'imp':d.get('impCnt',0),'clk':d.get('clkCnt',0),'cost':d.get('salesAmt',0)} for d in ds]
        out.append(row)
print(json.dumps(out,ensure_ascii=False))
