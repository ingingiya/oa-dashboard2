#!/usr/bin/env python3
# 일별 광고비 표 이미지 (1240x1754) — stdin JSON {until, days:[{d,label,total,ch:{}}], chans, sum14, month:{label,total,ch}, camps:{ch:[[name,cost]]}, note} → PNG 경로 출력
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
cr = [0, M + 330, M + 470, M + 570, M + 720, M + 820, M + 920, M + 1010, W - M - 10]; cols = [M + 10]; HD = ["합계"] + D["chans"] + ["노출", "클릭", "CPM", "CPC", "CTR"]
d.text((cols[0], y), "날짜", font=font(18, "SemiBold"), fill=SUB)
for i, t in enumerate(HD): rt(cr[i + 1], y, t, font(17, "SemiBold"), SUB)
y += 30; d.line((M, y, W - M, y), fill=INK, width=2); y += 8
mx = max([r["total"] for r in D["days"]] + [1])
for i, r in enumerate(D["days"]):
    if i == 0: d.rectangle((M, y - 4, W - M, y + 34), fill=HL)
    d.text((cols[0], y), r["label"], font=font(21, "Bold" if i == 0 else "Regular"), fill=INK)
    bw = int(80 * r["total"] / mx); d.rectangle((M + 130, y + 9, M + 130 + bw, y + 21), fill="#c9c1b4" if i else RED)
    vals = [won(r["total"])] + [won(r["ch"].get(c, 0)) for c in D["chans"]] + [won(r.get("imp", 0)), won(r.get("clk", 0)), won(r["total"] / r["imp"] * 1000) if r.get("imp") else "-", won(r["total"] / r["clk"]) if r.get("clk") else "-", f"{r['clk'] / r['imp'] * 100:.2f}%" if r.get("imp") else "-"]
    for j, v in enumerate(vals): rt(cr[j + 1], y + 2, v, font(18, "Bold" if j == 0 else "Regular"))
    y += 38; d.line((M, y - 2, W - M, y - 2), fill=LINE)
d.rectangle((M, y, W - M, y + 44), fill=INK)
d.text((cols[0], y + 10), f"총 금액 ({len(D['days'])}일)", font=font(19, "Bold"), fill="white"); S = {k: sum(r.get(k, 0) for r in D["days"]) for k in ("clk", "imp", "buy", "rev", "mcost")}; T14 = D["sum14"]["total"]
vals = [won(T14)] + [won(D["sum14"]["ch"].get(c, 0)) for c in D["chans"]] + [won(S["imp"]), won(S["clk"]), won(T14 / S["imp"] * 1000) if S["imp"] else "-", won(T14 / S["clk"]) if S["clk"] else "-", f"{S['clk'] / S['imp'] * 100:.2f}%" if S["imp"] else "-"]
for j, v in enumerate(vals): rt(cr[j + 1], y + 11, v, font(18, "Bold"), "white")
y += 74
# 캠페인별
d.text((M, y), f"{D['until_label']} 캠페인별", font=font(22, "Bold"), fill=INK); y += 38
half = (W - 2 * M) // 2
y0 = y
for ci, c in enumerate(D["chans"]):
    x0 = M + ci * half; yy = y0
    d.text((x0, yy), f"{c}  {won(D['yday_ch'].get(c,0))}원", font=font(19, "SemiBold"), fill=RED); yy += 32
    for row in D["camps"].get(c, [])[:12]:
        name, cost = row[0], row[1]; extra = (f"CPC {won(row[2])}" if len(row) > 2 and row[2] else "") + (f" · CPM {won(row[3])}" if len(row) > 3 and row[3] else "")
        nm = name
        while d.textlength(nm, font=font(16)) > half - 330 and len(nm) > 4: nm = nm[:-2]
        d.text((x0, yy), nm + ("…" if nm != name else ""), font=font(16), fill=INK); rt(x0 + half - 210, yy, won(cost), font(16, "SemiBold")); d.text((x0 + half - 200, yy), extra, font=font(14), fill=SUB); yy += 27
    y = max(y, yy)
d.text((M, H - M - 34), "노출·클릭=메타(링크 클릭)+X 합산 · CPM=노출 1,000회당 비용 · CPC=클릭당 비용 · 구매·ROAS는 수치가 부정확해 표시하지 않음", font=font(15), fill=SUB)
d.text((M, H - M - 10), D.get("note", ""), font=font(15), fill=SUB)
im.save(out)
print(out)
