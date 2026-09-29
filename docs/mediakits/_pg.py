#!/usr/bin/env python3
# usage: _pg.py URL [savename]  -> fetch page/pdf/pptx, print price-ish lines
import sys,re,subprocess,html,os,zipfile,tempfile
url=sys.argv[1]; save=sys.argv[2] if len(sys.argv)>2 else None
KIT='/Users/kirby/oa-dashboard2/docs/mediakits/'
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
tmp=tempfile.mktemp(dir='/private/tmp/claude-501/-Users-kirby/0cc44013-5eb1-49cc-a1a3-f7009066ff5f/scratchpad')
r=subprocess.run(["curl","-s","-L","-m","40","-A",UA,"-o",tmp,"-w","%{content_type}|%{http_code}|%{url_effective}",url],capture_output=True,text=True)
ct,code,eff=r.stdout.split("|",2) if "|" in r.stdout else ("","","")
print("#",code,ct,eff)
head=open(tmp,'rb').read(8)
txt=""
if head.startswith(b'%PDF'):
    dst=KIT+(save or re.sub(r'[^A-Za-z0-9가-힣._-]','_',os.path.basename(eff.split('?')[0]) or 'kit'))
    if not dst.endswith('.pdf'): dst+='.pdf'
    os.replace(tmp,dst); print("# saved",dst, os.path.getsize(dst))
    txt=subprocess.run(["pdftotext","-layout",dst,"-"],capture_output=True,text=True).stdout
elif head.startswith(b'PK'):
    dst=KIT+(save or os.path.basename(eff.split('?')[0]))
    if not dst.endswith('.pptx'): dst+='.pptx'
    os.replace(tmp,dst); print("# saved",dst, os.path.getsize(dst))
    z=zipfile.ZipFile(dst)
    for n in sorted([n for n in z.namelist() if n.startswith('ppt/slides/slide')],key=lambda s:int(re.findall(r'\d+',s)[0])):
        s=z.read(n).decode('utf8','ignore')
        txt+="\n"+" ".join(re.findall(r'<a:t>([^<]*)</a:t>',s))
else:
    h=open(tmp,'rb').read().decode('utf8','ignore')
    h=re.sub(r'<(script|style)[^>]*>.*?</\1>','',h,flags=re.S)
    txt=html.unescape(re.sub(r'<[^>]+>','\n',h))
    os.remove(tmp)
lines=[re.sub(r'\s+',' ',l).strip() for l in txt.split('\n')]
lines=[l for l in lines if l]
print("# lines",len(lines))
pat=re.compile(r'CPC|CPM|CPV|CPT|CPA|CPI|정액|구좌|최소|만원|[0-9,]{3,}\s*원|VAT|부가세|단가|\.pdf|\.pptx',re.I)
seen=set()
FULL=os.environ.get('FULL')
for l in lines:
    if (FULL or pat.search(l)) and l not in seen:
        seen.add(l); print(l[:220])
        if len(seen)>(400 if FULL else 60): break
