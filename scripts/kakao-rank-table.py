#!/usr/bin/env python3
"""카카오 선물하기 랭킹 표 이미지 렌더 → Supabase 업로드 → 공개 URL stdout. 입력: kakao_rank.py 출력 JSON(stdin)"""
import sys, json, io, re, datetime as dt, urllib.request
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

FONT_DIR = Path.home() / "Library/Fonts"
def font(size, w="Regular"): return ImageFont.truetype(str(FONT_DIR / f"Pretendard-{w}.otf"), size)
env = {}
for line in (Path(__file__).resolve().parent.parent / ".env.local").read_text().splitlines():
    m = re.match(r"^([A-Z_]+)=(.*)$", line)
    if m: env[m[1]] = m[2].strip().strip('"')
SB_URL, SB_KEY = env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"]

d = json.load(sys.stdin)
SUB = ["건강가전", "뷰티가전", "생활가전", "계절가전", "충전기", "음향가전"]
def md(s):
    y, m, dd = map(int, s.split("-")); return f"{m}/{dd}({'월화수목금토일'[dt.date(y, m, dd).weekday()]})"

UP, DOWN, INK, MUTED, LINE = (214, 60, 60), (40, 100, 220), (28, 28, 30), (120, 120, 128), (232, 232, 236)
BG, HEAD_BG, MEDIA_BG = (255, 255, 255), (246, 246, 248), (28, 28, 30)
W, PAD, ROW_H = 1080, 40, 52
COLS = [("제품", 135, "l"), ("소분류 순위", 205, "l"), ("목표", 200, "l"), ("가전·디지털", 125, "c"), ("전체", 100, "c"), ("위시", 160, "r"), ("후기", 75, "r")]
GOOD = (30, 140, 80)
def goal_cell(pr):  # 목표 리스트·범위 대비 현재 격차
    g = pr.get("goal")
    if not g: return ("-", MUTED)
    rng = f"{g['min']}" if g["min"] == g["max"] else f"{g['min']}~{g['max']}"
    t = pr["ranks"].get(g["list"], {}).get("today")
    short = {"가전·디지털": "가전", "음향가전": "음향", "건강가전": "건강", "계절가전": "계절"}.get(g["list"], g["list"])
    if t is None: return (f"{short} {rng}위 (500밖)", DOWN)
    if t <= g["max"]: return (f"{short} {rng}위 ✓달성", GOOD)
    return (f"{short} {rng}위 · {t - g['max']}↑ 남음" if t - g["max"] < 100 else f"{short} {rng}위 · {t - g['max']}↑", INK)

def rank_cell(t, p):  # → (text, color)
    if t is None: return ("500위 밖" if p is None else f"500위 밖 (전일 {p}위)", MUTED)
    if p is None: return (f"{t}위", INK) if d["prevDate"] is None else (f"{t}위 NEW", UP)
    diff = p - t
    if diff > 0: return (f"{t}위 ▲{diff}", UP)
    if diff < 0: return (f"{t}위 ▼{-diff}", DOWN)
    return (f"{t}위 −", INK)
def num_cell(t, p):
    if t is None: return ("-", MUTED)
    s = f"{t:,}"
    if p is not None and t != p: s += f" ({'+' if t > p else ''}{t - p:,})"
    return (s, INK)

rows = []
d["products"].sort(key=lambda pr: min([pr['ranks'][l]['today'] or 9999 for l in SUB] + [9999]))
for pr in d["products"]:
    r = pr["ranks"]
    subs = [(l, r[l]["today"], r[l]["prev"]) for l in SUB if r[l]["today"] is not None or r[l]["prev"] is not None]
    subs.sort(key=lambda x: (x[1] is None, x[1] or 9999))
    if subs:
        l, t, p = subs[0]; txt, col = rank_cell(t, p); sub = (f"{l} {txt}", col)
    else: sub = ("소분류 500위 밖", MUTED)
    rows.append([(pr["name"], INK), sub, goal_cell(pr), rank_cell(r["가전·디지털"]["today"], r["가전·디지털"]["prev"]),
                 rank_cell(r["전체"]["today"], r["전체"]["prev"]), num_cell(pr["wish"]["today"], pr["wish"]["prev"]), num_cell(pr["review"]["today"], pr["review"]["prev"])])

H = PAD + 100 + ROW_H * (len(rows) + 2) + 90
img = Image.new("RGB", (W, H), BG); dr = ImageDraw.Draw(img)
y = PAD
dr.text((PAD, y), "카카오 선물하기 랭킹 변화", font=font(30, "Bold"), fill=INK); y += 44
sub = f"{md(d['date'])} 랭킹 {d.get('updatedAt') or ''} 기준"
sub += f" · 전일({md(d['prevDate'])}) 대비" if d["prevDate"] else " · 첫 수집 (내일부터 전일 비교)"
dr.text((PAD, y), sub, font=font(18), fill=MUTED); y += 46
dr.rounded_rectangle((PAD, y, W - PAD, y + ROW_H - 6), radius=8, fill=MEDIA_BG)
dr.text((PAD + 14, y + 11), "카테고리 랭킹 (500위까지 스캔)", font=font(20, "Bold"), fill=(255, 255, 255)); y += ROW_H
def cell(x, y, w, txt, f, fill, al):
    tw = dr.textlength(txt, font=f)
    cx = x + w - tw - 12 if al == "r" else (x + (w - tw) / 2 if al == "c" else x + 12)
    dr.text((cx, y + (ROW_H - f.size) / 2 - 2), txt, font=f, fill=fill)
dr.rectangle((PAD, y, W - PAD, y + ROW_H), fill=HEAD_BG); x = PAD
for label, w, al in COLS: cell(x, y, w, label, font(16, "SemiBold"), MUTED, al); x += w
y += ROW_H
for row in rows:
    dr.line((PAD, y + ROW_H, W - PAD, y + ROW_H), fill=LINE, width=1); x = PAD
    for (label, w, al), (txt, col) in zip(COLS, row):
        cell(x, y, w, txt, font(17, "SemiBold" if label == "제품" or col in (UP, DOWN) else "Regular"), col, al); x += w
    y += ROW_H
y += 16
dr.text((PAD, y), "▲ 상승 / ▼ 하락 · 목표 = 지정 카테고리·순위, ✓달성 / n↑ = 목표까지 올라야 할 순위 수 · 위시·후기 괄호는 전일 대비", font=font(14), fill=MUTED)
img = img.crop((0, 0, W, y + 50))
ob = io.BytesIO(); img.save(ob, "PNG", optimize=True)
path = f"reports/kakao-traffic/rank-{d['date']}.png"
urllib.request.urlopen(urllib.request.Request(f"{SB_URL}/storage/v1/object/detail-assets/{path}", data=ob.getvalue(),
    headers={"Authorization": f"Bearer {SB_KEY}", "apikey": SB_KEY, "Content-Type": "image/png", "x-upsert": "true"}, method="POST"))
Path("/tmp/kakao-rank-table.png").write_bytes(ob.getvalue())
print(f"{SB_URL}/storage/v1/object/public/detail-assets/{path}?v={int(dt.datetime.now().timestamp())}")
