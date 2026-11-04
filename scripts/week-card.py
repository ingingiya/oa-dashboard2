# 이번 주 한 장(10): 금 18:00 — 이번 주 공구 성과·광고비·구매·PPL 진행을 PNG 한 장 → Desktop (+ --send 시 경은 웍스). launchd com.oa.weekcard
import json, os, sys, urllib.request, datetime, subprocess
from PIL import Image, ImageDraw, ImageFont
env = {}
for l in open('/Users/kirby/oa-dashboard2/.env.local'):
    if '=' in l and not l.startswith('#'): k, v = l.split('=', 1); env[k.strip()] = v.strip().strip('"')
SU = env['NEXT_PUBLIC_SUPABASE_URL']; SK = env['NEXT_PUBLIC_SUPABASE_ANON_KEY']; HS = {'apikey': SK, 'Authorization': 'Bearer ' + SK}
def setting(k):
    d = json.load(urllib.request.urlopen(urllib.request.Request(f"{SU}/rest/v1/settings?key=eq.{k}&select=value", headers=HS), timeout=30)); return d[0]['value'] if d else None
today = datetime.date.today(); mon = today - datetime.timedelta(today.weekday()); sun = mon + datetime.timedelta(6)
md = lambda d: f"{d.month}/{d.day}"
# 공구·행사 (노션)
H = {'Authorization': 'Bearer ' + env['NOTION_TOKEN'], 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json'}
q = urllib.request.Request('https://api.notion.com/v1/databases/32964cd9-cb02-81a5-82ce-f06d2b2fe959/query', data=json.dumps({'filter': {'and': [{'property': '날짜', 'date': {'on_or_after': mon.isoformat()}}, {'property': '날짜', 'date': {'on_or_before': sun.isoformat()}}]}, 'page_size': 100}).encode(), headers=H)
ev = []
for p in json.load(urllib.request.urlopen(q, timeout=60))['results']:
    pr = p['properties']; t = ''.join(x['plain_text'] for x in pr['이름']['title']); ty = (pr['유형'].get('select') or {}).get('name')
    if ty in ('공구', '행사') and not t.startswith(('[공구 D', '[공구 오픈', '★원복', '[행사 준비', '[행사 오픈')):
        d = pr['날짜']['date']; m = ''.join(x['plain_text'] for x in pr['메모'].get('rich_text', [])); import re; mm = re.search(r'\[성과\]([^\n]*)', m)
        ev.append((t.replace('[공구] ', '').replace('[행사] ', ''), d['start'][5:].replace('-', '/') + ('~' + d['end'][5:].replace('-', '/') if d.get('end') else ''), mm.group(1).replace('(자동 기록)', '').strip() if mm else '집계 전'))
verdict = setting('oa_ad_verdict_v1') or {}; spend = setting('oa_ad_spend_v1') or {}; st = setting('oa_ppl_stage_v1') or {}
rows = verdict.get('rows', []); cost7 = sum(r.get('cost7', 0) for r in rows); buy7 = sum(r.get('buy7', 0) or 0 for r in rows if r.get('buy7') is not None)
try:
    leads = json.load(urllib.request.urlopen('https://oa-dashboard2.vercel.app/api/ppl-leads', timeout=60)).get('rows', [])
    conf = [r for r in leads if r.get('confirmed')]; shipped = sum(1 for r in conf if (st.get(str(r['id'])) or {}).get('shipped')); uploaded = sum(1 for r in conf if (st.get(str(r['id'])) or {}).get('uploaded'))
except Exception: conf, shipped, uploaded = [], 0, 0
PF = '/Users/kirby/Library/Fonts/PretendardVariable.ttf'
def F(sz, w='Regular'):
    f = ImageFont.truetype(PF, sz)
    try: f.set_variation_by_name(w)
    except Exception: pass
    return f
W = 1080; Hh = 560 + 56 * max(1, len(ev)); im = Image.new('RGB', (W, Hh), 'white'); d = ImageDraw.Draw(im)
d.text((60, 56), '부스터즈팀 이번 주', font=F(44, 'ExtraBold'), fill=(17, 21, 23)); d.text((60, 116), f'{md(mon)} ~ {md(sun)} · 구매완료 기준', font=F(22), fill=(92, 102, 107)); d.line([(60, 170), (W - 60, 170)], fill=(17, 21, 23), width=3)
y = 200; d.text((60, y), '공구·행사', font=F(26, 'Bold'), fill=(17, 21, 23)); y += 44
if not ev: d.text((60, y), '이번 주 공구·행사 없음', font=F(22), fill=(92, 102, 107)); y += 40
for t, dd, pf in ev: d.text((60, y), f'{dd}  {t}', font=F(22, 'Medium'), fill=(17, 21, 23)); d.text((60, y + 28), pf, font=F(18), fill=(26, 110, 156)); y += 56
y += 20; d.text((60, y), '광고 (최근 7일)', font=F(26, 'Bold'), fill=(17, 21, 23)); y += 44
won = lambda v: f'{v/1e8:.2f}억' if v >= 1e8 else f'{round(v/1e4):,}만'
d.text((60, y), f'광고비 {won(cost7)}원 · 구매 {buy7}건(네이버·GFA) · 판정 끄기 {sum(1 for r in rows if r.get("verdict")=="off")} / 줄이기 {sum(1 for r in rows if r.get("verdict")=="down")} / 늘리기 {sum(1 for r in rows if r.get("verdict")=="up")}', font=F(22), fill=(17, 21, 23)); y += 36
by = spend.get('by', {})
for k, v in by.items(): d.text((60, y), f"{k} 이번 달 누적 광고비 {won(v['meta']+v['naver']+v['gfa'])}원 (메타 {won(v['meta'])} · 네이버 {won(v['naver'])} · GFA {won(v['gfa'])})", font=F(20), fill=(92, 102, 107)); y += 30
y += 20; d.text((60, y), 'PPL 협찬', font=F(26, 'Bold'), fill=(17, 21, 23)); y += 44
d.text((60, y), f'확정 {len(conf)}명 · {sum(int(r.get("deal_amount") or 0) for r in conf):,}만원 · 발송 {shipped} · 업로드 {uploaded}', font=F(22), fill=(17, 21, 23))
out = os.path.expanduser(f'~/Desktop/부스터즈_이번주_{mon.strftime("%m%d")}.png'); im = im.crop((0, 0, W, min(Hh, y + 90))); im.save(out); print('saved', out)
if '--send' in sys.argv: subprocess.run(['node', '-e', f"import('/Users/kirby/oa-dashboard2/scripts/nworks-lib.mjs').then(async m=>{{await m.sendFileToUser(m.MEMBER_EMAIL['경은'],'{out}','{os.path.basename(out)}');console.log('sent')}})"], check=False)
