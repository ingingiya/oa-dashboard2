#!/usr/bin/env python3
"""트래픽 표 + 랭킹 표 PNG를 세로로 합쳐 한 장 → Supabase 업로드 → URL. argv: date"""
import sys, io, re, datetime as dt, urllib.request
from pathlib import Path
from PIL import Image, ImageDraw
env = {}
for line in (Path(__file__).resolve().parent.parent / ".env.local").read_text().splitlines():
    m = re.match(r"^([A-Z_]+)=(.*)$", line)
    if m: env[m[1]] = m[2].strip().strip('"')
date = sys.argv[1]
parts = [Image.open(p).convert("RGB") for p in ["/tmp/kakao-traffic-table.png", "/tmp/kakao-rank-table.png", "/tmp/kakao-newads.png"] if Path(p).exists()]
W = max(p.width for p in parts); GAP = 24
H = sum(p.height for p in parts) + GAP * (len(parts) - 1)
out = Image.new("RGB", (W, H), (255, 255, 255)); y = 0
for i, p in enumerate(parts):
    if p.width != W: p = p.resize((W, round(p.height * W / p.width)))
    if i: ImageDraw.Draw(out).line((40, y - GAP // 2, W - 40, y - GAP // 2), fill=(210, 210, 216), width=2)
    out.paste(p, (0, y)); y += p.height + GAP
ob = io.BytesIO(); out.save(ob, "PNG", optimize=True)
Path("/tmp/kakao-report-all.png").write_bytes(ob.getvalue())
path = f"reports/kakao-traffic/all-{date}.png"
k = env["SUPABASE_SERVICE_ROLE_KEY"]; u = env["NEXT_PUBLIC_SUPABASE_URL"]
urllib.request.urlopen(urllib.request.Request(f"{u}/storage/v1/object/detail-assets/{path}", data=ob.getvalue(),
    headers={"Authorization": f"Bearer {k}", "apikey": k, "Content-Type": "image/png", "x-upsert": "true"}, method="POST"))
print(f"{u}/storage/v1/object/public/detail-assets/{path}?v={int(dt.datetime.now().timestamp())}")
