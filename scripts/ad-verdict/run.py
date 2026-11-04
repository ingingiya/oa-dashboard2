# 아침 광고 판정(24): 네이버 검색·GFA·메타 최근 7일 → 끄기/줄이기/늘리기/유지 → Supabase settings oa_ad_verdict_v1
# 실행: cd scripts/ad-verdict && python3 run.py   (launchd com.oa.adverdict 매일 09:00)
import json, subprocess, sys, os, urllib.request, datetime
H = os.path.dirname(os.path.abspath(__file__)); os.chdir(H)
env = {}
for l in open('/Users/kirby/oa-dashboard2/.env.local'):
    if '=' in l and not l.startswith('#'):
        k, v = l.split('=', 1); env[k.strip()] = v.strip().strip('"')
BE = {'플렌티플렛 4L': 254, '프리온': 228}  # 손익분기 ROAS % (9월 말 원가·수취 기준)
def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
    out = r.stdout.strip().splitlines()
    return json.loads(out[-1]) if out else None
rows = []
def verdict_roas(cost, roas, be):
    if cost < 20000: return 'keep', '광고비 작음'
    if roas < be * 0.5: return 'off', f'ROAS {roas:.0f}% · 손익분기 {be}%의 절반 미만'
    if roas < be: return 'down', f'ROAS {roas:.0f}% · 손익분기 {be}% 미달'
    if roas >= be * 1.5: return 'up', f'ROAS {roas:.0f}% · 손익분기 1.5배 이상'
    return 'keep', f'ROAS {roas:.0f}%'
try:
    for g in run([sys.executable, 'naver_sa.py']) or []:
        if '플렌티스팀' in g['group']: continue
        prod = '플렌티플렛 4L' if '플렌티' in g['group'] else '프리온'; w = g['7d']
        if not g.get('enabled'): continue
        roas = (w['purchaseConvAmt'] / w['salesAmt'] * 100) if w['salesAmt'] else 0
        v, why = verdict_roas(w['salesAmt'], roas, BE[prod])
        rows.append({'product': prod, 'channel': '네이버 ' + ('파워링크' if g['type'] == 'WEB_SITE' else '쇼핑검색'), 'name': g['group'], 'cost7': w['salesAmt'], 'buy7': w['purchaseCcnt'], 'roas7': roas, 'cpa7': (w['salesAmt'] / w['purchaseCcnt']) if w['purchaseCcnt'] else None, 'verdict': v, 'reason': why})
except Exception as e: rows.append({'product': '-', 'channel': '네이버 검색', 'name': '수집 실패', 'cost7': 0, 'verdict': 'keep', 'reason': str(e)[:80]})
try:
    for c in (run([sys.executable, 'gfa_pp.py']) or {}).get('7d', []):
        if not ('플렌티' in c['name'] or '프리온' in c['name']): continue
        prod = '플렌티플렛 4L' if '플렌티' in c['name'] else '프리온'
        roas = (c['rev'] / c['cost'] * 100) if c['cost'] else 0
        v, why = verdict_roas(c['cost'], roas, BE[prod])
        rows.append({'product': prod, 'channel': '네이버 GFA', 'name': c['name'], 'cost7': c['cost'], 'buy7': c['buy'], 'roas7': roas, 'cpa7': (c['cost'] / c['buy']) if c['buy'] else None, 'verdict': v, 'reason': why})
except Exception as e: rows.append({'product': '-', 'channel': 'GFA', 'name': '수집 실패', 'cost7': 0, 'verdict': 'keep', 'reason': str(e)[:80]})
try:
    today = datetime.date.today(); a = str(today - datetime.timedelta(7)); b = str(today - datetime.timedelta(1))
    agg = {}
    for r in run(['node', 'meta_daily.mjs']) or []:
        if not (a <= r['day'] <= b): continue
        k = (r['product'], r['set']); x = agg.setdefault(k, [0, 0, 0, r.get('on')]); x[0] += r['cost']; x[1] += r['imp']; x[2] += r['clk']
    for (prod, name), (cost, imp, clk, on) in agg.items():
        if cost < 20000 or on is False: continue
        cpc = cost / clk if clk else 9999
        if cpc > 1000 and cost >= 100000: v, why = 'off', f'클릭 1번 {cpc:,.0f}원 · 메타는 구매 추적이 부정확해 클릭 단가로 판단'
        elif cpc > 600: v, why = 'down', f'클릭 1번 {cpc:,.0f}원 · 같은 제품 트래픽 세트 대비 비쌈'
        elif cpc < 150: v, why = 'up', f'클릭 1번 {cpc:,.0f}원 · 싸게 들어옴'
        else: v, why = 'keep', f'클릭 1번 {cpc:,.0f}원'
        rows.append({'product': prod, 'channel': '메타', 'name': name, 'cost7': cost, 'cpc7': cpc, 'verdict': v, 'reason': why})
except Exception as e: rows.append({'product': '-', 'channel': '메타', 'name': '수집 실패', 'cost7': 0, 'verdict': 'keep', 'reason': str(e)[:80]})
# 이번 달 누적 광고비(제품별·채널별) → oa_ad_spend_v1 (손익 카드용)
try:
    ym = datetime.date.today().strftime('%Y-%m'); spend = {'플렌티플렛4L': {'meta': 0, 'naver': 0, 'gfa': 0}, '프리온': {'meta': 0, 'naver': 0, 'gfa': 0}}
    P = lambda prod: '플렌티플렛4L' if '플렌티' in prod else '프리온'
    for g in run([sys.executable, 'naver_sa.py']) or []:
        if '플렌티스팀' in g['group']: continue
        for d in g.get('daily', []):
            if str(d['day']).startswith(ym.replace('-', '')) or str(d['day']).startswith(ym): spend[P(g['group'])]['naver'] += float(d.get('cost') or 0)
    gf = run([sys.executable, 'gfa_pp.py']) or {}
    for d in gf.get('daily', []):
        nm = d.get('name', '')
        if ('플렌티' in nm or '프리온' in nm) and str(d.get('day', '')).startswith(ym): spend[P(nm)]['gfa'] += float(d.get('cost') or 0)
    for r in run(['node', 'meta_daily.mjs']) or []:
        if str(r['day']).startswith(ym): spend[P(r['product'])]['meta'] += float(r['cost'] or 0)
    v2 = {'ym': ym, 'at': datetime.datetime.now().isoformat(timespec='minutes'), 'by': spend}
    req2 = urllib.request.Request(env['NEXT_PUBLIC_SUPABASE_URL'] + '/rest/v1/settings', method='POST', data=json.dumps({'key': 'oa_ad_spend_v1', 'value': v2, 'updated_at': datetime.datetime.utcnow().isoformat() + 'Z'}).encode(),
        headers={'apikey': env['NEXT_PUBLIC_SUPABASE_ANON_KEY'], 'Authorization': 'Bearer ' + env['NEXT_PUBLIC_SUPABASE_ANON_KEY'], 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates'})
    urllib.request.urlopen(req2, timeout=60); print('spend', spend)
except Exception as e: print('spend fail', str(e)[:120])
order = {'off': 0, 'down': 1, 'up': 2, 'keep': 3}
rows.sort(key=lambda r: (order[r['verdict']], -r.get('cost7', 0)))
val = {'at': datetime.datetime.now().isoformat(timespec='minutes'), 'be': {'플렌티플렛': BE['플렌티플렛 4L'], '프리온': BE['프리온']}, 'rows': rows}
req = urllib.request.Request(env['NEXT_PUBLIC_SUPABASE_URL'] + '/rest/v1/settings', method='POST', data=json.dumps({'key': 'oa_ad_verdict_v1', 'value': val, 'updated_at': datetime.datetime.utcnow().isoformat() + 'Z'}).encode(),
    headers={'apikey': env['NEXT_PUBLIC_SUPABASE_ANON_KEY'], 'Authorization': 'Bearer ' + env['NEXT_PUBLIC_SUPABASE_ANON_KEY'], 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates'})
print(urllib.request.urlopen(req, timeout=60).status, len(rows), 'rows', {k: sum(1 for r in rows if r['verdict'] == k) for k in order})
