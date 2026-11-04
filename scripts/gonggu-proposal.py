# 공구 제안서 자동 생성(7): python3 scripts/gonggu-proposal.py "플렌티플렛" [공구가] → Desktop/공구제안서_제품_날짜.xlsx (기존 양식 복제 후 치환)
import sys, shutil, datetime, openpyxl, glob, os
P = {
 '플렌티플렛': {'tpl': '2026_공구제안서_포그밍L코듀_플렌티플렛.xlsx', 'sheet': '플렌티플렛4L', 'name': '오아 플렌티플렛 4L 접이식 가습기', 'url': 'https://brand.naver.com/oastore/products/9609372358', 'normal': 68000, 'default': 54900, 'size': '235 x 240 x 215mm (접었을 때 높이 115mm)', 'use': '1회 급수(4L) 최대 32시간', 'power': '유선 (AC 220V / 25W)', 'pack': '본품, 전원케이블, 파우치, 사용설명서'},
 '포그밍코듀': {'tpl': '2026_공구제안서_포그밍L코듀_플렌티플렛.xlsx', 'sheet': '포그밍L코듀', 'name': '오아 포그밍L 코듀 전기담요 — 라떼 (180×130cm)', 'url': 'brand.naver.com/oastore', 'normal': 98000, 'default': 59000, 'size': '180 × 130cm (1인용) · 모델 OEBK-002LA', 'use': '타이머 20분 단위 최대 3시간', 'power': '유선 · AC 220V / 140W', 'pack': '본품, 온도조절기(전원케이블 일체), 사용설명서'},
 '프리온': {'tpl': '2026_공구제안서_포그밍L코듀_플렌티플렛.xlsx', 'sheet': '플렌티플렛4L', 'name': '오아 프리온 무선 고데기 (핑크/화이트/퍼플)', 'url': 'https://brand.naver.com/oastore', 'normal': 54800, 'default': 47900, 'size': '휴대용 · 배터리 분리형(기내 반입 가능)', 'use': '1회 충전 약 30분', 'power': 'USB-C 충전', 'pack': '본품, 배터리, USB-C 케이블, 파우치, 사용설명서'},
}
key = sys.argv[1].replace(' ', '') if len(sys.argv) > 1 else ''
k = next((x for x in P if x in key), None)
if not k: print('제품: ' + ', '.join(P)); sys.exit(1)
c = P[k]; price = int(sys.argv[2]) if len(sys.argv) > 2 else c['default']; fee = 0.15; supply = round(price * (1 - fee) / 1.1)
src = os.path.expanduser('~/Downloads/' + c['tpl']); out = os.path.expanduser(f"~/Desktop/공구제안서_{k}_{datetime.date.today().strftime('%y%m%d')}.xlsx")
shutil.copy(src, out); wb = openpyxl.load_workbook(out)
for ws in list(wb.worksheets):
    if ws.title != c['sheet']: wb.remove(ws)
ws = wb[c['sheet']]; ws.title = k
ws['C2'] = c['name']; ws['F2'] = c['url']; ws['F3'] = f"정상가 : {c['normal']:,}원\n공구가 {price:,}원 (수수료 15% · 공급가 {supply:,}원)\n"; ws['F4'] = c['size']; ws['F5'] = c['use']; ws['F6'] = c['power']; ws['C9'] = c['pack']
wb.save(out); print('saved', out, '공구가', price, '공급가', supply)
