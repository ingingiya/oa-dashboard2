import hmac,hashlib,base64,time,json,urllib.request,urllib.parse
from pathlib import Path
env={}
for l in Path('/Users/kirby/oa-dashboard2/.env.local').read_text().splitlines():
    if '=' in l and not l.startswith('#'): k,v=l.split('=',1); env[k.strip()]=v.strip().strip('"')
K,C,S=env['NAVER_API_KEY'],env['NAVER_CUSTOMER_ID'],env['NAVER_SECRET_KEY']
def call(method,path,body=None,**p):
    ts=str(int(time.time()*1000)); sig=base64.b64encode(hmac.new(S.encode(),f"{ts}.{method}.{path}".encode(),hashlib.sha256).digest()).decode()
    q=('?'+urllib.parse.urlencode(p)) if p else ''
    r=urllib.request.Request(f"https://api.searchad.naver.com{path}{q}",method=method,data=json.dumps(body).encode() if body is not None else None,headers={"X-API-KEY":K,"X-Customer":C,"X-Timestamp":ts,"X-Signature":sig,"Content-Type":"application/json; charset=UTF-8"})
    try: return json.loads(urllib.request.urlopen(r,timeout=60).read() or b'null')
    except urllib.error.HTTPError as e: raise SystemExit(f'HTTP {e.code} {e.read().decode()[:500]}')
