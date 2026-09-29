#!/usr/bin/env python3
"""카카오 트래픽 리포트 표 이미지 렌더 → Supabase 업로드 → 공개 URL stdout.
입력: stdin JSON {title, sub, media:[{name, data:{제품:{날짜:{cost,imp,clk}}}}]}
"""
import sys, json, io, os, re, datetime as dt, urllib.request
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

FONT_DIR = Path.home() / "Library/Fonts"
def font(size, w="Regular"):
    return ImageFont.truetype(str(FONT_DIR / f"Pretendard-{w}.otf"), size)

env = {}
for line in (Path(__file__).resolve().parent.parent / ".env.local").read_text().splitlines():
    m = re.match(r"^([A-Z_]+)=(.*)$", line)
    if m: env[m[1]] = m[2].strip().strip('"')
SB_URL, SB_KEY = env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"]

inp = json.load(sys.stdin)
won = lambda n: f"{round(n):,}원"
num = lambda n: f"{int(n):,}"
cpc = lambda t: won(t["cost"] / t["clk"]) if t["clk"] else "-"
cpm = lambda t: won(t["cost"] / t["imp"] * 1000) if t["imp"] else "-"
def md(d):
    y, m, dd = map(int, d.split("-"))
    return f"{m}/{dd}({'월화수목금토일'[dt.date(y, m, dd).weekday()]})"
def tot(rows):
    s = {"cost": 0, "imp": 0, "clk": 0}
    for t in rows:
        for k in s: s[k] += t[k]
    return s

# ── 레이아웃 ──
W = 1080; PAD = 40
COLS = [("제품", 190, "l"), ("날짜", 130, "l"), ("광고비", 150, "r"), ("노출", 130, "r"), ("클릭", 100, "r"), ("CPC", 130, "r"), ("CPM", 130, "r")]
ROW_H = 46
BG, INK, MUTED, LINE = (255, 255, 255), (28, 28, 30), (120, 120, 128), (232, 232, 236)
HEAD_BG, SUM_BG, MEDIA_BG = (246, 246, 248), (255, 248, 236), (28, 28, 30)
ACCENT = (222, 120, 40)

# 행 데이터 구성
sections = []
for m in inp["media"]:
    rows = []
    data = m.get("data") or {}
    off = set(m.get("off") or [])  # 꺼진 제품은 맨 아래 (사용자 09-16 "꺼진 건 아래로")
    names = sorted(data, key=lambda n: (n in off, -tot(data[n].values())["cost"]))
    divided = False
    for n in names:
        first = True
        if n in off and not divided: rows.append(("off", "", "", None)); divided = True
        for d in sorted(data[n]):
            t = data[n][d]
            if t["cost"] == 0 and t["imp"] == 0: continue
            rows.append(("day", (n + " (꺼짐)" if n in off else n) if first else "", md(d), t)); first = False
        rows.append(("sum", n + (" (꺼짐)" if n in off else ""), "누적", tot(data[n].values())))
    total = tot([tot(data[n].values()) for n in names]) if names else None
    sections.append((m["name"], rows, total, m.get("error")))

H = PAD + 110 + sum(ROW_H * (len(r) + 2) + 40 for _, r, _, _ in sections) + PAD
img = Image.new("RGB", (W, H), BG); dr = ImageDraw.Draw(img)
y = PAD
dr.text((PAD, y), inp["title"], font=font(30, "Bold"), fill=INK); y += 44
dr.text((PAD, y), inp["sub"], font=font(18), fill=MUTED); y += 50

def cell_text(x, y, w, txt, f, fill, align):
    tw = dr.textlength(txt, font=f)
    cx = x + w - tw - 12 if align == "r" else x + 12
    dr.text((cx, y + (ROW_H - f.size) / 2 - 2), txt, font=f, fill=fill)

for name, rows, total, err in sections:
    # 매체 헤더 (합계 포함)
    dr.rounded_rectangle((PAD, y, W - PAD, y + ROW_H), radius=8, fill=MEDIA_BG)
    dr.text((PAD + 14, y + 11), name, font=font(20, "Bold"), fill=(255, 255, 255))
    if total:
        s = f"광고비 {won(total['cost'])}   클릭 {num(total['clk'])}   CPC {cpc(total)}   CPM {cpm(total)}"
        f = font(17, "Medium"); dr.text((W - PAD - 14 - dr.textlength(s, font=f), y + 13), s, font=f, fill=(255, 220, 180))
    y += ROW_H + 6
    if err or not rows:
        dr.text((PAD + 14, y + 12), err or "집행 데이터 없음", font=font(17), fill=MUTED); y += ROW_H + 40; continue
    # 컬럼 헤더
    dr.rectangle((PAD, y, W - PAD, y + ROW_H), fill=HEAD_BG)
    x = PAD
    for label, w, al in COLS:
        cell_text(x, y, w, label, font(16, "SemiBold"), MUTED, al); x += w
    y += ROW_H
    for kind, prod, date, t in rows:
        if kind == "off":  # 구분 띠: 아래는 꺼진 광고
            dr.rectangle((PAD, y, W - PAD, y + ROW_H), fill=(238, 238, 242))
            dr.text((PAD + 14, y + 12), "▼ 꺼진 광고 (일시중지·미집행) — 누적 참고용", font=font(16, "SemiBold"), fill=MUTED); y += ROW_H; continue
        if kind == "sum": dr.rectangle((PAD, y, W - PAD, y + ROW_H), fill=SUM_BG)
        dr.line((PAD, y + ROW_H, W - PAD, y + ROW_H), fill=LINE, width=1)
        vals = [prod, date, won(t["cost"]), num(t["imp"]), num(t["clk"]), cpc(t), cpm(t)]
        x = PAD
        for (label, w, al), v in zip(COLS, vals):
            bold = kind == "sum"
            f = font(17, "Bold" if bold else ("SemiBold" if label == "제품" else "Regular"))
            col = ACCENT if (bold and label in ("CPC", "광고비")) else INK
            cell_text(x, y, w, v, f, col, al); x += w
        y += ROW_H
    y += 40

img = img.crop((0, 0, W, y + PAD - 30))
ob = io.BytesIO(); img.save(ob, "PNG", optimize=True)
path = f"reports/kakao-traffic/{inp.get('date', dt.date.today().isoformat())}.png"
req = urllib.request.Request(f"{SB_URL}/storage/v1/object/detail-assets/{path}", data=ob.getvalue(),
    headers={"Authorization": f"Bearer {SB_KEY}", "apikey": SB_KEY, "Content-Type": "image/png", "x-upsert": "true"}, method="POST")
urllib.request.urlopen(req)
local = Path("/tmp/kakao-traffic-table.png"); local.write_bytes(ob.getvalue())
print(f"{SB_URL}/storage/v1/object/public/detail-assets/{path}?v={int(dt.datetime.now().timestamp())}")
