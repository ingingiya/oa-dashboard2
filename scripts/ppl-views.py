# PPL 영상 조회수 자동 수집(22): oa_ppl_stage_v1 의 url → yt-dlp 로 조회수·댓글 → views 갱신. launchd com.oa.pplviews 매일 08:50
import json, subprocess, urllib.request, datetime
env = {}
for l in open('/Users/kirby/oa-dashboard2/.env.local'):
    if '=' in l and not l.startswith('#'):
        k, v = l.split('=', 1); env[k.strip()] = v.strip().strip('"')
U = env['NEXT_PUBLIC_SUPABASE_URL']; K = env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
H = {'apikey': K, 'Authorization': 'Bearer ' + K, 'Content-Type': 'application/json'}
def get(key):
    r = urllib.request.Request(f"{U}/rest/v1/settings?key=eq.{key}&select=value", headers=H)
    d = json.load(urllib.request.urlopen(r, timeout=30)); return d[0]['value'] if d else None
st = get('oa_ppl_stage_v1') or {}
n = 0
for id_, m in st.items():
    url = (m or {}).get('url', '')
    if not url or not url.startswith('http'): continue
    try:
        out = subprocess.run(['yt-dlp', '-j', '--no-warnings', '--skip-download', url], capture_output=True, text=True, timeout=90).stdout.strip().splitlines()
        if not out: continue
        j = json.loads(out[-1]); vc = j.get('view_count'); cc = j.get('comment_count'); up = j.get('upload_date')
        if vc is None: continue
        m['views'] = str(vc); m['viewsAt'] = datetime.date.today().isoformat()
        if cc is not None: m['comments'] = str(cc)
        if up and not m.get('uploadDate'): m['uploadDate'] = f"{up[:4]}-{up[4:6]}-{up[6:]}"
        if not m.get('uploaded'): m['uploaded'] = True
        n += 1; print(id_, vc, cc)
    except Exception as e: print('fail', id_, str(e)[:80])
if n:
    req = urllib.request.Request(f"{U}/rest/v1/settings", method='POST', data=json.dumps({'key': 'oa_ppl_stage_v1', 'value': st, 'updated_at': datetime.datetime.utcnow().isoformat() + 'Z'}).encode(), headers={**H, 'Prefer': 'resolution=merge-duplicates'})
    print('saved', urllib.request.urlopen(req, timeout=30).status, n)
else: print('갱신할 영상 없음')
