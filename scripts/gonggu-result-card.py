# 공구 결과 한 장(13): 어제 끝난 공구·행사 → 성과 PNG(프리텐다드) → Desktop 저장(+ --send 시 경은 웍스 개인 전송). launchd com.oa.gonggucard 매일 09:20
import json, sys, os, urllib.request, datetime, subprocess
from PIL import Image, ImageDraw, ImageFont
env = {}
for l in open('/Users/kirby/oa-dashboard2/.env.local'):
    if '=' in l and not l.startswith('#'):
        k, v = l.split('=', 1); env[k.strip()] = v.strip().strip('"')
SEND = '--send' in sys.argv
DB = '32964cd9-cb02-81a5-82ce-f06d2b2fe959'
H = {'Authorization': 'Bearer ' + env['NOTION_TOKEN'], 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json'}
y = (datetime.date.today() - datetime.timedelta(1)).isoformat()
if len(sys.argv) > 1 and sys.argv[1][:2] == '20': y = sys.argv[1]
req = urllib.request.Request(f'https://api.notion.com/v1/databases/{DB}/query', data=json.dumps({'filter': {'property': '날짜', 'date': {'on_or_before': y}}, 'sorts': [{'property': '날짜', 'direction': 'descending'}], 'page_size': 50}).encode(), headers=H)
res = json.load(urllib.request.urlopen(req, timeout=60))['results']
ev = []
for p in res:
    pr = p['properties']; t = ''.join(x['plain_text'] for x in pr['이름']['title']); ty = (pr['유형'].get('select') or {}).get('name'); d = pr['날짜'].get('date') or {}
    if ty not in ('공구', '행사') or t.startswith(('[공구 D', '[공구 오픈', '★원복', '[행사 준비', '[행사 오픈')): continue
    if (d.get('end') or d.get('start')) == y: ev.append({'t': t, 's': d.get('start'), 'e': d.get('end') or d.get('start'), 'memo': ''.join(x['plain_text'] for x in pr['메모'].get('rich_text', []))})
if not ev: print('어제 끝난 공구·행사 없음', y); sys.exit(0)
PRODUCTS = [('플렌티플렛', '오아플렌티플렛4L'), ('프리온', '오아프리온무선고데기-%'), ('코듀', '오아포그밍L코듀%'), ('와플', '오아포그밍L와플%'), ('듀얼미스트 맥스', '오아듀얼미스트맥스-%'), ('듀얼미스트', '오아듀얼미스트무선가습기'), ('에어리소닉', '오아에어리소닉드라이기-%'), ('소닉플로우', '오아소닉플로우-%'), ('히트스팟', '오아히트스팟%'), ('타프', '오아타프실링팬-화이트'), ('퀵롤', '오아퀵롤차저65W%'), ('듀얼포켓', '오아듀얼포켓건-%')]
items = []
for i, e in enumerate(ev):
    like = next((l for k, l in PRODUCTS if k.replace(' ', '') in e['t'].replace(' ', '')), None)
    if like: items.append({'id': str(i), 'product': like, 'start': e['s'], 'end': e['e']})
r = urllib.request.Request('https://oa-dashboard2.vercel.app/api/event-perf', data=json.dumps({'items': items}).encode(), headers={'Content-Type': 'application/json'})
perf = json.load(urllib.request.urlopen(r, timeout=120)).get('results', {})
PF = '/Users/kirby/Library/Fonts/PretendardVariable.ttf'
def F(sz, w='Regular'):
    f = ImageFont.truetype(PF, sz)
    try: f.set_variation_by_name(w)
    except Exception: pass
    return f
W = 1080; rows = [(e, perf.get(str(i))) for i, e in enumerate(ev)]
Hh = 220 + 300 * len(rows)
im = Image.new('RGB', (W, Hh), 'white'); d = ImageDraw.Draw(im)
d.text((60, 56), '공구·행사 결과', font=F(44, 'ExtraBold'), fill=(17, 21, 23)); d.text((60, 116), f'{y} 종료 · 스마트스토어+자사몰 판매 · 부스터즈팀', font=F(22), fill=(92, 102, 107))
d.line([(60, 170), (W - 60, 170)], fill=(17, 21, 23), width=3)
yy = 200
won = lambda v: f'{v/1e8:.2f}억' if v >= 1e8 else f'{round(v/1e4):,}만'
for e, pf in rows:
    d.text((60, yy), e['t'].replace('[공구] ', '').replace('[행사] ', ''), font=F(34, 'Bold'), fill=(17, 21, 23)); d.text((60, yy + 48), f"{e['s'][5:].replace('-', '/')} ~ {e['e'][5:].replace('-', '/')}", font=F(22), fill=(92, 102, 107))
    if not pf or pf.get('error'):
        d.text((60, yy + 100), '집계 실패 (전산 연결) · 대시보드에서 새로고침', font=F(24), fill=(210, 59, 47))
    else:
        lift = pf['perDay'] / pf['prePerDay'] if pf.get('prePerDay') else None; ly = (pf['q'] / pf['lyQ'] - 1) * 100 if pf.get('lyQ') else None
        cols = [(f"{pf['q']:,}대", f"{won(pf['amt'])}원"), (f"{lift:.1f}배" if lift else '—', '직전 7일 대비 하루 판매'), ((('+' if ly >= 0 else '') + f'{ly:.0f}%') if ly is not None else '—', f"작년 같은 날짜 {pf.get('lyQ', 0):,}대")]
        for j, (big, small) in enumerate(cols):
            x = 60 + j * 330; color = (26, 110, 156) if j == 0 else ((35, 132, 90) if (j == 1 and lift and lift >= 1.5) or (j == 2 and ly is not None and ly >= 0) else (17, 21, 23))
            d.text((x, yy + 96), big, font=F(56, 'ExtraBold'), fill=color); d.text((x, yy + 166), small, font=F(20), fill=(92, 102, 107))
    yy += 300; d.line([(60, yy - 40), (W - 60, yy - 40)], fill=(221, 226, 229), width=1)
out = os.path.expanduser(f'~/Desktop/공구결과_{y}.png'); im.save(out); print('saved', out)
if SEND:
    subprocess.run(['node', '-e', f"import('/Users/kirby/oa-dashboard2/scripts/nworks-lib.mjs').then(async m=>{{await m.sendFileToUser(m.MEMBER_EMAIL['경은'],'{out}','공구결과_{y}.png');console.log('sent')}})"], check=False)
