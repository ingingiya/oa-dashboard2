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
# 날짜 표 — 매체별로 광고비·CPM·CPC·CTR을 나눠서 표시 (10-02 "효율은 메타랑 트위터 나눠서")
CH = D["chans"]; x0 = M + 250; gw = (W - M - x0) // max(1, len(CH)); sub = ["광고비", "노출", "CPM", "CPC", "CTR"]; SWD = [0.235, 0.225, 0.17, 0.16, 0.21]; XR = lambda gx, k: gx + int(gw * sum(SWD[:k + 1])) - 8
def effv(cost, e):
    imp, clk = e.get("imp", 0), e.get("clk", 0)
    return [won(cost), won(imp) if imp else "-", won(cost / imp * 1000) if imp else "-", won(cost / clk) if clk else "-", f"{clk / imp * 100:.2f}%" if imp else "-"]
d.text((M + 10, y + 26), "날짜", font=font(17, "SemiBold"), fill=SUB); rt(x0 - 14, y + 26, "합계", font(17, "SemiBold"), SUB)
for ci, c in enumerate(CH):
    gx = x0 + ci * gw; d.rectangle((gx + 6, y, gx + gw - 6, y + 24), fill=INK if ci == 0 else "#57504a"); tw = d.textlength(c, font=font(16, "Bold")); d.text((gx + gw / 2 - tw / 2, y + 2), c, font=font(16, "Bold"), fill="white")
    for k, s_ in enumerate(sub): rt(XR(gx, k), y + 28, s_, font(15, "SemiBold"), SUB)
y += 52; d.line((M, y, W - M, y), fill=INK, width=2); y += 8
for i, r in enumerate(D["days"]):
    if i == 0: d.rectangle((M, y - 4, W - M, y + 34), fill=HL)
    d.text((M + 10, y), r["label"], font=font(20, "Bold" if i == 0 else "Regular"), fill=INK)
    rt(x0 - 14, y + 2, won(r["total"]), font(18, "Bold"))
    for ci, c in enumerate(CH):
        gx = x0 + ci * gw; cost = r["ch"].get(c, 0)
        vals = effv(cost, (r.get("eff") or {}).get(c, {})) if cost else ["0", "-", "-", "-", "-"]
        for k, v in enumerate(vals): rt(XR(gx, k), y + 3, v, font(17, "SemiBold" if k == 0 else "Regular"), INK if cost else "#b5aca0")
        if ci: d.line((gx, y - 4, gx, y + 34), fill=LINE)
    y += 38; d.line((M, y - 2, W - M, y - 2), fill=LINE)
d.rectangle((M, y, W - M, y + 44), fill=INK)
d.text((M + 10, y + 10), f"총 금액 ({len(D['days'])}일)", font=font(19, "Bold"), fill="white"); rt(x0 - 14, y + 12, won(D["sum14"]["total"]), font(18, "Bold"), "white")
for ci, c in enumerate(CH):
    gx = x0 + ci * gw; cost = D["sum14"]["ch"].get(c, 0); e = {k: sum((r.get("eff") or {}).get(c, {}).get(k, 0) for r in D["days"]) for k in ("imp", "clk")}
    for k, v in enumerate(effv(cost, e)): rt(XR(gx, k), y + 13, v, font(17, "Bold"), "white")
y += 74
# 캠페인별
d.text((M, y), f"{D['until_label']} 캠페인별", font=font(22, "Bold"), fill=INK); y += 38
for c in D["chans"]:
    d.text((M, y), f"{c}  {won(D['yday_ch'].get(c,0))}원", font=font(19, "SemiBold"), fill=RED); y += 30
    rows_ = D["camps"].get(c, []); lim = 6 if c == "메타" else 10
    for row in rows_[:lim]:
        name, cost = row[0], row[1]; extra = (str(row[2]) if len(row) > 2 and row[2] else "") + (f" · CPM {won(row[3])}" if len(row) > 3 and row[3] else "") + (f" · 노출 {won(row[4])}" if len(row) > 4 and row[4] else "")
        nm = name
        while d.textlength(nm, font=font(16)) > 400 and len(nm) > 4: nm = nm[:-2]
        d.text((M, y), nm + ("…" if nm != name else ""), font=font(16), fill=INK); rt(M + 540, y, won(cost), font(16, "SemiBold")); d.text((M + 560, y + 1), extra, font=font(15), fill=SUB); y += 25
    if len(rows_) > lim: d.text((M, y), f"외 {len(rows_) - lim}개  {won(sum(r[1] for r in rows_[lim:]))}", font=font(15), fill=SUB); y += 25
    y += 12
d.text((M, H - M - 34), "CPM=노출 1,000회당 비용 · CPC=클릭당 비용(메타는 링크 클릭 기준) · 결과당 비용=전환 캠페인은 구매당, 트래픽은 클릭당 · ROAS는 계산하지 않음", font=font(15), fill=SUB)
d.text((M, H - M - 10), D.get("note", ""), font=font(15), fill=SUB)
im.save(out)
print(out)
