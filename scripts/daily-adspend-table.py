#!/usr/bin/env python3
# 일별 광고비 표 이미지 (A4 세로 비율 1240x1754, 인쇄용) — stdin JSON {until, days:[{d,label,total,ch:{}}], chans, sum14, month:{label,total,ch}, camps:{ch:[[name,cost]]}, note} → PNG+PDF 경로 출력
import sys, json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
FONT_DIR = Path.home() / "Library/Fonts"
if not (FONT_DIR / "Pretendard-Regular.otf").exists(): FONT_DIR = Path("/Library/Fonts")
def font(size, w="Regular"): return ImageFont.truetype(str(FONT_DIR / f"Pretendard-{w}.otf"), size)
D = json.load(sys.stdin); out = sys.argv[1] if len(sys.argv) > 1 else "/tmp/daily-adspend.png"
W, H, M = 1240, 1754, 70; INK, SUB, LINE, HL, RED = "#1b1917", "#6d645b", "#d9d2c6", "#fff3b0", "#e8452c"
im = Image.new("RGB", (W, H), "white"); d = ImageDraw.Draw(im)
won = lambda n: f"{round(n):,}"
def rt(x, y, t, f, fill=INK): d.text((x - d.textlength(t, font=f), y), t, font=f, fill=fill)
y = M
d.text((M, y), "오아 부스터즈팀 · 일별 광고비", font=font(22, "SemiBold"), fill=SUB); y += 40
d.text((M, y), f"{D['until_label']} 광고비  {won(D['yday_total'])}원", font=font(50, "Bold"), fill=INK); y += 74
sub = "  ·  ".join(f"{c} {won(D['yday_ch'].get(c,0))}원" for c in D["chans"]) + (f"  ·  전일 대비 {D['delta']}" if D.get("delta") else "")
d.text((M, y), sub, font=font(22), fill=SUB); y += 50
# 요약 3칸
bx = (W - 2 * M) // 3
for i, (lab, val, s2) in enumerate([(f"최근 {len(D['days'])}일 합계", won(D["sum14"]["total"]) + "원", " / ".join(f"{c} {won(D['sum14']['ch'].get(c,0))}" for c in D["chans"])), (f"최근 {len(D['days'])}일 일평균", won(D["sum14"]["total"] / max(1, len(D["days"]))) + "원", ""), (D["month"]["label"], won(D["month"]["total"]) + "원", " / ".join(f"{c} {won(D['month']['ch'].get(c,0))}" for c in D["chans"]))]):
    x0 = M + i * bx; d.rectangle((x0, y, x0 + bx - 12, y + 118), outline=INK, width=2)
    d.text((x0 + 18, y + 14), lab, font=font(18, "SemiBold"), fill=SUB); d.text((x0 + 18, y + 42), val, font=font(32, "Bold"), fill=INK)
    if s2: d.text((x0 + 18, y + 86), s2, font=font(15), fill=SUB)
y += 150
# 날짜 표
cols = [M + 10, M + 420, M + 700, M + 960]; cr = [M + 400, M + 680, M + 940, W - M - 10]
d.text((cols[0], y), "날짜", font=font(18, "SemiBold"), fill=SUB)
for i, t in enumerate(["합계"] + D["chans"]): rt(cr[i + 1] if i + 1 < len(cr) else cr[-1], y, t, font(18, "SemiBold"), SUB)
y += 30; d.line((M, y, W - M, y), fill=INK, width=2); y += 8
mx = max([r["total"] for r in D["days"]] + [1])
for i, r in enumerate(D["days"]):
    if i == 0: d.rectangle((M, y - 4, W - M, y + 34), fill=HL)
    d.text((cols[0], y), r["label"], font=font(21, "Bold" if i == 0 else "Regular"), fill=INK)
    bw = int(200 * r["total"] / mx); d.rectangle((M + 150, y + 8, M + 150 + bw, y + 22), fill="#c9c1b4" if i else RED)
    rt(cr[1], y, won(r["total"]), font(21, "Bold"))
    for j, c in enumerate(D["chans"]): rt(cr[j + 2] if j + 2 < len(cr) else cr[-1], y, won(r["ch"].get(c, 0)), font(21))
    y += 38; d.line((M, y - 2, W - M, y - 2), fill=LINE)
d.rectangle((M, y, W - M, y + 44), fill=INK)
d.text((cols[0], y + 9), f"총 금액 ({len(D['days'])}일)", font=font(22, "Bold"), fill="white"); rt(cr[1], y + 9, won(D["sum14"]["total"]), font(22, "Bold"), "white")
for j, c in enumerate(D["chans"]): rt(cr[j + 2] if j + 2 < len(cr) else cr[-1], y + 9, won(D["sum14"]["ch"].get(c, 0)), font(22, "Bold"), "white")
y += 74
# 캠페인별
d.text((M, y), f"{D['until_label']} 캠페인별", font=font(22, "Bold"), fill=INK); y += 38
half = (W - 2 * M) // 2
y0 = y
for ci, c in enumerate(D["chans"]):
    x0 = M + ci * half; yy = y0
    d.text((x0, yy), f"{c}  {won(D['yday_ch'].get(c,0))}원", font=font(19, "SemiBold"), fill=RED); yy += 32
    for name, cost in D["camps"].get(c, [])[:12]:
        nm = name
        while d.textlength(nm, font=font(17)) > half - 150 and len(nm) > 4: nm = nm[:-2]
        d.text((x0, yy), nm + ("…" if nm != name else ""), font=font(17), fill=INK); rt(x0 + half - 30, yy, won(cost), font(17, "SemiBold")); yy += 27
    y = max(y, yy)
d.text((M, H - M - 10), D.get("note", ""), font=font(15), fill=SUB)
im.save(out); im.save(out.replace(".png", ".pdf"), "PDF", resolution=150.0)
print(out)
