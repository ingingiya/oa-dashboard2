import json
from collections import defaultdict
from PIL import Image, ImageDraw, ImageFont
import os; S=os.path.dirname(os.path.abspath(__file__))+'/'
import sys
P=sys.argv[1] if len(sys.argv)>1 else '7'
A,B=('2026-10-05','2026-11-03') if P=='30' else ('2026-10-28','2026-11-03')
PL=f'{P}일'; PK='30d' if P=='30' else '7d'
agg=defaultdict(lambda:[0,0,0,0,0]); sets=defaultdict(lambda:[0,0,0,0,0])  # cost imp clk buy rev
def add(d,k,c,i,cl,bu=0,rv=0):
    x=d[k]; x[0]+=c; x[1]+=i; x[2]+=cl; x[3]+=bu; x[4]+=rv
for r in json.load(open(S+'meta_daily.json')):
    if A<=r['day']<=B:
        ch='메타 트래픽' if '트래픽' in r['set'] else '메타 전환'
        add(agg,(r['product'],ch),r['cost'],r['imp'],r['clk']); add(sets,(r['product'],ch,r['set']),r['cost'],r['imp'],r['clk'])
for g in json.load(open(S+'naver_sa.json')):
    if '플렌티스팀' in g['group']: continue
    prod='플렌티플렛 4L' if '플렌티' in g['group'] else '프리온'; ch='네이버 파워링크' if g['type']=='WEB_SITE' else '네이버 쇼핑검색'; w=g[PK]
    add(agg,(prod,ch),w['salesAmt'],w['impCnt'],w['clkCnt'],w['purchaseCcnt'],w['purchaseConvAmt'])
for c in json.load(open(S+'gfa.json'))[PK]:
    if '플렌티' in c['name'] or '프리온' in c['name']:
        prod='플렌티플렛 4L' if '플렌티' in c['name'] else '프리온'
        add(agg,(prod,'네이버 GFA'),c['cost'],c['imp'],c['clk'],c['buy'],c['rev']); add(sets,(prod,'네이버 GFA',c['name']),c['cost'],c['imp'],c['clk'],c['buy'],c['rev'])
PF='/Users/kirby/Library/Fonts/PretendardVariable.ttf'
def F(sz,w='Regular'):
    f=ImageFont.truetype(PF,sz)
    try: f.set_variation_by_name(w)
    except Exception: pass
    return f
W=1400; H=1930
BG=(247,246,243); INK=(28,30,34); MUT=(110,112,118); LINE=(226,224,219); RED=(214,69,61); GRN=(38,150,92); GRY=(190,192,198); AMB=(196,132,20); CARD=(255,255,255)
im=Image.new('RGB',(W,H),BG); d=ImageDraw.Draw(im)
won=lambda v:f"{round(v):,}"
x0=70
d.text((x0,60),'플렌티플렛 4L · 프리온  광고 단가 비교',font=F(46,'Bold'),fill=INK)
d.text((x0,124),f'최근 {PL} ({A.replace("-",".")} ~ 11.03) · 메타 · 네이버 파워링크 · 쇼핑검색 · GFA · 부가세 별도',font=F(22),fill=MUT)
d.text((x0,156),'노출 1번 = 광고비 ÷ 노출수 (광고가 한 번 보일 때 드는 돈) · 클릭 1번 = 광고비 ÷ 클릭수',font=F(22),fill=MUT)
# summary card
y=210; d.rounded_rectangle([x0-10,y,W-60,y+300],18,fill=CARD,outline=LINE)
d.text((x0+20,y+24),'한 줄 요약',font=F(28,'Bold'),fill=INK)
g=lambda p,c:agg[(p,c)]
ORDER0=['메타 트래픽','메타 전환','네이버 파워링크','네이버 쇼핑검색','네이버 GFA']; pm=g('플렌티플렛 4L','메타 트래픽'); rm=g('프리온','메타 트래픽'); pc=g('플렌티플렛 4L','메타 전환'); pgf=g('플렌티플렛 4L','네이버 GFA')
st=sets[('프리온','메타 전환','부스터팀_뷰티가전_전환 › [전환] 프리온 new 컬러 출시')]
pr=sorted([(c,*agg[('플렌티플렛 4L',c)]) for c in ORDER0 if agg[('플렌티플렛 4L',c)][1]],key=lambda r:-r[1]/r[2])
top=[r for r in pr if r[1]/r[2]>=pr[0][1]/pr[0][2]*0.9 and not r[0].startswith('메타')]
nm='·'.join(r[0].replace('네이버 ','') for r in top); vals='·'.join(f"{r[1]/r[2]:.1f}" for r in top)
items=[(RED,'비쌈',f"플렌티 네이버 {nm}가 노출 1번 {vals}원으로 가장 비쌈 (메타 트래픽 {pm[0]/pm[1]:.1f}원의 약 {top[0][1]/top[0][2]/(pm[0]/pm[1]):.0f}배) · {PL} {sum(r[1] for r in top)/1e4:.0f}만원 집행",f'→ GFA ROAS {pgf[4]/pgf[0]*100:.0f}% (광고비 {pgf[0]/1e4:.0f}만원 → 구매 {pgf[3]:.0f}건·매출 {pgf[4]/1e4:.0f}만원). 축소 검토'+(', 파워링크는 키워드 입찰가 점검' if any(r[0]=='네이버 파워링크' for r in top) else '')),
       (GRN,'쌈',f"클릭 1번은 메타 트래픽이 가장 쌈 · 플렌티 {won(pm[0]/pm[2])}원, 프리온 {won(rm[0]/rm[2])}원",f'→ 유입 목적이면 메타 트래픽 비중 유지 (메타 전환은 구매할 사람을 골라 보여줘서 클릭 1번이 플렌티 {won(pc[0]/pc[2])}원으로 더 비쌈)'),
       (AMB,'점검',f"프리온 메타 '전환 new 컬러' 세트: 클릭 1번 {won(st[0]/st[2])}원 · 클릭률 {st[2]/st[1]*100:.2f}% · {PL} {st[0]/1e4:.0f}만원",'→ 소재 교체 1순위')]
yy=y+80
for col,tag,txt,todo in items:
    tw=d.textlength(tag,font=F(20,'Bold'))+28
    d.rounded_rectangle([x0+20,yy+2,x0+20+tw,yy+34],16,outline=col,width=2); d.text((x0+34,yy+5),tag,font=F(20,'Bold'),fill=col)
    d.text((x0+40+tw,yy),txt,font=F(24,'SemiBold'),fill=INK); d.text((x0+40+tw,yy+36),todo,font=F(21),fill=MUT); yy+=72
# product bars
ORDER=['메타 트래픽','메타 전환','네이버 파워링크','네이버 쇼핑검색','네이버 GFA']
y=550
for prod in ['플렌티플렛 4L','프리온']:
    rs=[(c,*agg[(prod,c)]) for c in ORDER if agg[(prod,c)][1]>0]
    rs.sort(key=lambda r:-r[1]/r[2])
    h=110+len(rs)*112
    d.rounded_rectangle([x0-10,y,W-60,y+h],18,fill=CARD,outline=LINE)
    d.text((x0+20,y+22),prod,font=F(32,'Bold'),fill=INK)
    tot=sum(r[1] for r in rs)
    note=f"{PL} 광고비 합계 {tot/1e4:,.0f}만원"+(" · 네이버 GFA 집행 없음" if prod=='프리온' else '')
    d.text((W-90-d.textlength(note,font=F(21)),y+32),note,font=F(21),fill=MUT)
    mx=max(v[0]/v[1] for v in agg.values() if v[1]); yy=y+90
    for i,(c,cost,imp,clk,buy,rev) in enumerate(rs):
        cpi=cost/imp; col=RED if i==0 else GRN if i==len(rs)-1 else GRY
        d.text((x0+20,yy+6),c,font=F(24,'SemiBold'),fill=INK)
        bx=x0+250; bw=int((W-60-40-bx-260)*cpi/mx)
        d.rounded_rectangle([bx,yy+8,bx+max(bw,8),yy+34],8,fill=col)
        d.text((bx+max(bw,8)+14,yy-2),f"{cpi:.1f}원",font=F(34,'Bold'),fill=col if col!=GRY else INK)
        roas=(f"ROAS {rev/cost*100:,.0f}% (구매 {buy:,.0f}건)") if (('GFA' in c or '네이버' in c) and cost) else "ROAS 미표시 (구매 추적 부정확)"
        d.text((bx,yy+46),f"클릭 1번 {won(cost/clk)}원  ·  클릭률 {clk/imp*100:.2f}%  ·  광고비 {cost/1e4:,.0f}만원  ·  {roas}",font=F(21),fill=MUT)
        yy+=112
    y+=h+30
d.text((x0,H-84),'ROAS = 구매완료 매출 ÷ 광고비 (네이버 검색광고·GFA 모두 구매완료 전환만, 장바구니 등 다른 전환 제외).  메타는 구매 추적이 부정확해 ROAS 제외.',font=F(19),fill=MUT)
d.text((x0,H-50),'출처: 메타 광고관리자 · 네이버 검색광고 API · 네이버 GFA 리포트  |  플렌티스팀·GSSHOP 행사 캠페인 제외  |  부스터즈팀 2026.11.04',font=F(19),fill=MUT)
im=im.crop((0,0,W,min(H,y+80))) if y+80<H-60 else im
out=f'/Users/kirby/Desktop/광고단가비교_플렌티_프리온_1104'+('_30일' if P=='30' else '')+'.png'; im.save(out); print(out,im.size,y)
