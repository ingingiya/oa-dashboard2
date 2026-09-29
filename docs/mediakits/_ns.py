#!/usr/bin/env python3
# usage: _ns.py "query" [n]  -> naver web search results (title | url)
import sys,re,urllib.parse,subprocess,html
q=sys.argv[1]; n=int(sys.argv[2]) if len(sys.argv)>2 else 12
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
def fetch(url):
    return subprocess.run(["curl","-s","-L","-m","20","-A",UA,url],capture_output=True,text=True).stdout
out=[]
for where in ["web","nexearch"]:
    url=f"https://search.naver.com/search.naver?where={where}&query="+urllib.parse.quote(q)
    h=fetch(url)
    for m in re.finditer(r'<a[^>]+href="(https?://[^"]+)"[^>]*>(.*?)</a>',h,re.S):
        u,t=m.group(1),re.sub('<[^>]+>','',m.group(2)).strip()
        u=html.unescape(u)
        if re.search(r'naver\.(com|me)|pstatic|naver\.net',u): continue
        if not t or len(t)<4: continue
        if u in [x[0] for x in out]: continue
        out.append((u,t[:90]))
for u,t in out[:n]: print(t,"|",u)
