#!/usr/bin/env python3
"""오늘(KST) 생성된 메타 트래픽 광고 소재 콘택트시트 → /tmp/kakao-newads.png (없으면 출력 없음). argv: date"""
import sys, json, io, re, urllib.request, datetime as dt, subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
HERE = Path(__file__).resolve().parent
env = {}
for line in (HERE.parent / ".env.local").read_text().splitlines():
    m = re.match(r"^([A-Z_]+)=(.*)$", line)
    if m: env[m[1]] = m[2].strip().strip('"')
T, ACC = env["META_ACCESS_TOKEN"], env["META_AD_ACCOUNT_ID"]
date = sys.argv[1]
since = int((dt.datetime.fromisoformat(date) - dt.timedelta(hours=9)).timestamp())  # KST 00:00
def get(url):
    return json.load(urllib.request.urlopen(url, timeout=60))
flt = urllib.parse.quote(json.dumps([{"field": "ad.created_time", "operator": "GREATER_THAN", "value": since}])) if False else None
import urllib.parse
flt = urllib.parse.quote(json.dumps([{"field": "ad.created_time", "operator": "GREATER_THAN", "value": since}]))
url = f"https://graph.facebook.com/v19.0/{ACC}/ads?fields=name,created_time,effective_status,adset{{name}},campaign{{name,objective}},creative{{id,image_url,video_id,object_story_spec}}&filtering={flt}&limit=200&access_token={T}"
ads = []
while url:
    d = get(url); ads += d.get("data", []); url = d.get("paging", {}).get("next")
seen = set(); items = []
for a in ads:
    ct = a.get("created_time", "")  # 예: 2026-09-10T09:12:33+0900
    try:
        kst = (dt.datetime.strptime(ct, "%Y-%m-%dT%H:%M:%S%z").astimezone(dt.timezone(dt.timedelta(hours=9)))).date().isoformat()
    except Exception: kst = ct[:10]
    if kst != date: continue
    camp = a.get("campaign", {}).get("name", "")
    if "트래픽" not in camp and (a.get("campaign", {}).get("objective") != "OUTCOME_TRAFFIC"): continue
    adset = re.sub(r"^\[.*?\]\s*", "", a.get("adset", {}).get("name", ""))
    if re.search(r"_복사$", adset): continue
    c = a.get("creative", {}); spec = c.get("object_story_spec", {})
    key = spec.get("link_data", {}).get("image_hash") or c.get("video_id") or spec.get("video_data", {}).get("video_id") or c.get("id")
    if key in seen: continue
    seen.add(key)
    url_ = c.get("image_url")
    video = bool(c.get("video_id") or spec.get("video_data"))
    if not url_ and video:
        h = spec.get("video_data", {}).get("image_hash")
        if h:
            try:
                r = get(f"https://graph.facebook.com/v19.0/{ACC}/adimages?hashes={urllib.parse.quote(json.dumps([h]))}&fields=url&access_token={T}")
                url_ = (r.get("data") or [{}])[0].get("url")
            except Exception: pass
    if not url_: url_ = c.get("thumbnail_url")
    if not url_: continue
    items.append({"adset": adset, "camp": re.sub(r"^부스터즈?팀_", "", camp), "name": a["name"], "status": a.get("effective_status"), "url": url_, "video": video})
if not items: sys.exit(0)
F = lambda s, w="Regular": ImageFont.truetype(f"/Users/kirby/Library/Fonts/Pretendard-{w}.otf", s)
imgs = []
for o in items:
    try:
        b = urllib.request.urlopen(urllib.request.Request(o["url"], headers={"User-Agent": "Mozilla/5.0"}), timeout=30).read()
        im = Image.open(io.BytesIO(b)).convert("RGB")
    except Exception:
        im = Image.new("RGB", (400, 400), (235, 235, 238))
    imgs.append((o, im))
W = 1080; PAD = 40; COLS = 4; GAP = 16; CELL = (W - PAD * 2 - GAP * (COLS - 1)) // COLS; LBL = 58
rows = (len(imgs) + COLS - 1) // COLS
H = 110 + rows * (CELL + LBL + GAP) + 20
sheet = Image.new("RGB", (W, H), (255, 255, 255)); dr = ImageDraw.Draw(sheet)
y, m, dd = map(int, date.split("-"))
dr.text((PAD, 40), f"{m}/{dd} 신규 등록 소재", font=F(30, "Bold"), fill=(28, 28, 30))
camps = sorted({o["camp"] for o in items})
dr.text((PAD, 84), f"{len(imgs)}건 · " + " / ".join(camps), font=F(18), fill=(120, 120, 128))
def label(t, w, f):
    while dr.textlength(t, font=f) > w and len(t) > 3: t = t[:-2] + "…"
    return t
ST = {"ACTIVE": "진행중", "PENDING_REVIEW": "검토중", "IN_PROCESS": "처리중", "PAUSED": "일시정지"}
for i, (o, im) in enumerate(imgs):
    r, c = divmod(i, COLS); x = PAD + c * (CELL + GAP); yy = 120 + r * (CELL + LBL + GAP)
    im2 = im.copy(); im2.thumbnail((CELL, CELL))
    box = Image.new("RGB", (CELL, CELL), (245, 245, 247)); box.paste(im2, ((CELL - im2.width) // 2, (CELL - im2.height) // 2))
    sheet.paste(box, (x, yy)); dr.rectangle((x, yy, x + CELL - 1, yy + CELL - 1), outline=(225, 225, 230))
    dr.text((x, yy + CELL + 6), label(("▶ " if o["video"] else "") + o["adset"], CELL, F(17, "Bold")), font=F(17, "Bold"), fill=(28, 28, 30))
    nm = re.sub(r"^" + re.escape(o["adset"]) + r"_", "", o["name"]); nm = re.sub(r"_" + re.escape(o["adset"]) + r"$", "", nm)
    dr.text((x, yy + CELL + 30), label(f"{nm} · {ST.get(o['status'], o['status'])}", CELL, F(14)), font=F(14), fill=(120, 120, 128))
sheet.save("/tmp/kakao-newads.png", optimize=True)
print(len(imgs))
