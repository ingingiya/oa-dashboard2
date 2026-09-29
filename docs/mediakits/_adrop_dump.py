import re,html,subprocess,sys,os
from concurrent.futures import ThreadPoolExecutor
UA="Mozilla/5.0 (Macintosh) Chrome/124.0"
urls=[l.strip() for l in open('_adrop_kits.txt') if l.strip()]
def go(u):
    h=subprocess.run(["curl","-s","-m","30","-A",UA,u],capture_output=True,text=True).stdout
    t=re.search(r'<title>([^<]*)</title>',h); t=html.unescape(t.group(1)) if t else ''
    t=t.replace(' 광고 상품 실시간 예약하기 | 애드노트','')
    body=re.sub(r'<(script|style)[^>]*>.*?</\1>','',h,flags=re.S)
    txt=html.unescape(re.sub(r'<[^>]+>','\n',body))
    lines=[re.sub(r'\s+',' ',l).strip() for l in txt.split('\n')]; lines=[l for l in lines if l]
    kid=u.split('/')[-1]
    open(f'adrop/{kid}.txt','w').write(t+'\n'+u+'\n'+'\n'.join(lines))
    return f"{kid} | {t}"
with ThreadPoolExecutor(10) as ex:
    res=list(ex.map(go,urls))
open('_adrop_titles.txt','w').write('\n'.join(res))
print('\n'.join(sorted(res,key=lambda s:s.split('|')[1])))
