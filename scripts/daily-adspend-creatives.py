#!/usr/bin/env python3
# 메타 소재별 어제 성과 콘택트시트 — 광고비 상위 소재의 이미지+광고비·결과당 비용·CPM·CTR (ROAS는 계산하지 않음 — 10-02 사용자 지시) (10-02 "이미지는 메타 소재, 효율도 같이")
# 사용: daily-adspend-creatives.py YYYY-MM-DD out.png  → out 경로 출력
import sys, json, re, io, urllib.request, urllib.parse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parent.parent
env = {}
for l in (ROOT / ".env.local").read_text().splitlines():
    m = re.match(r"^([A-Z_0-9]+)=(.*)$", l)
    if m: env[m[1]] = m[2].strip().strip('"')
T, ACC = env["META_ACCESS_TOKEN"], env["META_AD_ACCOUNT_ID"]
FILTER = [f.strip() for f in env.get("META_CAMPAIGN_FILTER", "뷰티,부스터").split(",") if f.strip()]
day, out = sys.argv[1], sys.argv[2]
FONT_DIR = Path.home() / "Library/Fonts"
if not (FONT_DIR / "Pretendard-Regular.otf").exists(): FONT_DIR = Path("/Library/Fonts")
font = lambda s, w="Regular": ImageFont.truetype(str(FONT_DIR / f"Pretendard-{w}.otf"), s)
def get(u):
    return json.load(urllib.request.urlopen(u, timeout=60))
PUR = ["purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase", "web_in_store_purchase", "website_purchase"]
def act(arr):
    for t in PUR:
        for a in arr or []:
            if a.get("action_type") == t: return float(a.get("value") or 0)
    return 0.0
tr = urllib.parse.quote(json.dumps({"since": day, "until": day}))
url = f"https://graph.facebook.com/v19.0/{ACC}/insights?level=ad&fields=ad_id,ad_name,campaign_name,adset_name,objective,spend,impressions,inline_link_clicks,actions,action_values&time_range={tr}&limit=500&access_token={T}"
rows = []
while url:
    j = get(url); rows += j.get("data", []); url = (j.get("paging") or {}).get("next")
rows = [r for r in rows if float(r.get("spend") or 0) > 0 and (not FILTER or any(f in r["campaign_name"] for f in FILTER))]
rows.sort(key=lambda r: -float(r["spend"]))
# 소재 단위 합산(같은 이미지/영상이 여러 광고세트에 복사된 경우)
groups = {}
for r in rows[:60]:
    try: c = get(f"https://graph.facebook.com/v19.0/{r['ad_id']}?fields=creative{{id,image_hash,video_id,thumbnail_url,image_url,object_story_spec}}&thumbnail_width=480&thumbnail_height=480&access_token={T}").get("creative", {})
    except Exception: c = {}
    spec = c.get("object_story_spec") or {}
    key = c.get("image_hash") or spec.get("link_data", {}).get("image_hash") or c.get("video_id") or spec.get("video_data", {}).get("video_id") or c.get("id") or r["ad_id"]
    g = groups.setdefault(key, {"name": r["ad_name"], "camp": r["campaign_name"], "cost": 0, "imp": 0, "clk": 0, "buy": 0, "rev": 0, "n": 0, "img": c.get("image_url") or c.get("thumbnail_url"), "video": bool(c.get("video_id") or spec.get("video_data")), "obj": r.get("objective") or ""})
    g["cost"] += float(r["spend"]); g["imp"] += int(r.get("impressions") or 0); g["clk"] += int(r.get("inline_link_clicks") or 0); g["buy"] += act(r.get("actions")); g["rev"] += act(r.get("action_values")); g["n"] += 1
top = sorted(groups.values(), key=lambda g: -g["cost"])[:12]
if not top: print("none"); sys.exit(0)
COLS, CW, IMG, PAD, TH = 4, 290, 270, 20, 150
R = (len(top) + COLS - 1) // COLS; W = PAD * 2 + COLS * CW; HEAD = 110; H = HEAD + R * (IMG + TH) + PAD
im = Image.new("RGB", (W, H), "white"); d = ImageDraw.Draw(im); won = lambda n: f"{round(n):,}"
d.text((PAD, 22), f"메타 소재별 성과 · {int(day[5:7])}/{int(day[8:10])}", font=font(34, "Bold"), fill="#1b1917")
tc = sum(g["cost"] for g in top); ta = sum(float(r["spend"]) for r in rows)
d.text((PAD, 70), f"광고비 상위 {len(top)}개 소재 {won(tc)}원 (메타 전체 {won(ta)}원의 {tc / ta * 100:.0f}%) · 결과당 비용 = 전환 캠페인은 구매당, 트래픽 캠페인은 클릭당", font=font(17), fill="#6d645b")
for i, g in enumerate(top):
    x, y = PAD + (i % COLS) * CW, HEAD + (i // COLS) * (IMG + TH)
    try:
        t = Image.open(io.BytesIO(urllib.request.urlopen(urllib.request.Request(g["img"], headers={"User-Agent": "Mozilla/5.0"}), timeout=40).read())).convert("RGB")
        s = min(t.size); t = t.crop(((t.width - s) // 2, (t.height - s) // 2, (t.width + s) // 2, (t.height + s) // 2)).resize((IMG, IMG))
    except Exception: t = Image.new("RGB", (IMG, IMG), "#eee")
    im.paste(t, (x, y)); d.rectangle((x, y, x + IMG, y + IMG), outline="#d9d2c6")
    d.rectangle((x, y, x + 44, y + 34), fill="#1b1917"); d.text((x + 12, y + 5), str(i + 1), font=font(20, "Bold"), fill="white")
    if g["video"]: d.rectangle((x + IMG - 58, y, x + IMG, y + 28), fill="#e8452c"); d.text((x + IMG - 50, y + 4), "영상", font=font(16, "Bold"), fill="white")
    ty = y + IMG + 8
    # 결과 = 메타 광고 관리자와 같은 기준: 전환(판매) 캠페인은 구매, 트래픽 캠페인은 링크 클릭 (10-02 사용자 "결과당 구매", ROAS는 계산 안 함)
    traffic = "TRAFFIC" in g["obj"] or "LINK_CLICKS" in g["obj"] or "트래픽" in g["camp"]
    res_n = g["clk"] if traffic else g["buy"]; res_lab = "클릭" if traffic else "구매"
    cpr = f"{won(g['cost'] / res_n)}원" if res_n else "구매 없음"
    cpm = g["cost"] / g["imp"] * 1000 if g["imp"] else 0
    d.text((x, ty), f"{won(g['cost'])}원", font=font(22, "Bold"), fill="#1b1917")
    d.text((x, ty + 31), (f"{res_lab}당 {cpr}" if res_n else cpr), font=font(18, "Bold"), fill="#e8452c" if not res_n else "#1b1917")
    d.text((x + 172, ty + 34), f"({res_lab} {won(res_n)})", font=font(15), fill="#6d645b")
    d.text((x, ty + 57), f"노출 {won(g['imp'])} · CPM {won(cpm)}원" if g["imp"] else "", font=font(16), fill="#1b1917")
    rt_ = f"CTR {g['clk'] / g['imp'] * 100:.2f}%" if g["imp"] else ""; d.text((x + IMG - d.textlength(rt_, font=font(15)), ty + 4), rt_, font=font(15), fill="#6d645b")
    nm = g["name"]
    while d.textlength(nm, font=font(14)) > IMG and len(nm) > 4: nm = nm[:-2]
    d.text((x, ty + 82), nm, font=font(14), fill="#6d645b")
    cp = g["camp"]
    while d.textlength(cp, font=font(13)) > IMG and len(cp) > 4: cp = cp[:-2]
    d.text((x, ty + 102), cp, font=font(13), fill="#8a8178")
im.save(out); print(out)
