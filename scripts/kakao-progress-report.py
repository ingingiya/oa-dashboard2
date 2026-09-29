#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""카카오 선물하기 트래픽 진행 보고 — "오늘 무엇을 언제 바꿨고, 트래킹했더니 순위가 이렇게 움직였다" (09-23 사용자 요청)
입력: settings.oa_traffic_ads_v1(광고관리 트래픽 라인·랜딩 변경 시각) + kakao-rank/data/{날짜}_*.json(시간별 순위 스냅샷) + live_log.jsonl(실시간 배지)
출력: stdout JSON {"text": 웍스 본문, "png": 표 이미지 경로}. 사용: python3 kakao-progress-report.py [YYYY-MM-DD]
"""
import sys, json, re, datetime as dt, urllib.request, os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent; ROOT = HERE.parent; DATA = HERE / "kakao-rank" / "data"
env = {}
for line in (ROOT / ".env.local").read_text().splitlines():
    m = re.match(r"^([A-Z_]+)=(.*)$", line)
    if m: env[m[1]] = m[2].strip().strip('"')
SB, SK = env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"]
def sget(key):
    r = urllib.request.Request(f"{SB}/rest/v1/settings?key=eq.{key}&select=value", headers={"apikey": SK, "Authorization": "Bearer " + SK})
    rows = json.load(urllib.request.urlopen(r, timeout=30)); return rows[0]["value"] if rows else None

KST = dt.timezone(dt.timedelta(hours=9))
today = sys.argv[1] if len(sys.argv) > 1 and re.match(r"\d{4}-\d{2}-\d{2}", sys.argv[1]) else dt.datetime.now(KST).date().isoformat()
yday = (dt.date.fromisoformat(today) - dt.timedelta(days=1)).isoformat()
targets = json.loads((HERE / "kakao-rank" / "targets_manual.json").read_text())

# ── 스냅샷 타임라인 (파일 mtime = 측정 시각)
def snaps(date):
    out = []
    for p in sorted(DATA.glob(f"{date}_*.json")):
        try: d = json.loads(p.read_text())
        except Exception: continue
        t = dt.datetime.fromtimestamp(p.stat().st_mtime, KST); out.append((t, d))
    return sorted(out, key=lambda x: x[0])
S_today, S_yday = snaps(today), snaps(yday)
base = S_yday[-1] if S_yday else None  # 어제 마지막 = 기준점

# ── 광고관리 트래픽 라인 (집행중 + 오늘 바뀐 것)
ads = (sget("oa_traffic_ads_v1") or {}).get("items", [])
def line_of(pid):
    for it in ads:
        if f"product/{pid}" in (it.get("web_url") or "") or f"product/{pid}" in (it.get("kakao_url") or ""): return it
    return None

# ── 실시간 배지 (오늘)
live = {}
lp = DATA / "live_log.jsonl"
if lp.exists():
    for l in lp.read_text().splitlines():
        try: r = json.loads(l)
        except Exception: continue
        if not r["t"].startswith(today): continue
        for pid, h in r["hl"].items():
            live.setdefault(pid, {"n": 0, "on": []}); live[pid]["n"] += 1
            if h and not h.startswith("ERR"): live[pid]["on"].append((r["t"][11:16], h[:30]))

# ── 오늘의 변경 이벤트 (광고관리 updated_at 이 오늘인 라인)
events = []
for it in ads:
    ua = it.get("updated_at") or ""
    if ua.startswith(today):
        ln = (it.get("landing_note") or "").split(" · ")[0]
        what = f"랜딩 → {ln} ({it.get('status')})" if ln and ln.startswith("인앱") and ("교체" in it.get("landing_note", "") or "받음" in it.get("landing_note", "")) else f"상태 → {it.get('status')}"
        events.append((ua[11:16], f"{it.get('product')} · {what}"))
events.sort()

# ── 제품별 행
rows = []
for t in targets:
    pid = str(t["id"]); g = t.get("goal") or {}; lst = g.get("list") or "가전·디지털"
    def rk(d):
        if pid not in (d.get("ranks") or {}) and pid not in (d.get("wish") or {}): return "NA"
        return (d.get("ranks", {}).get(pid, {}) or {}).get(lst)
    def wi(d): return (d.get("wish", {}) or {}).get(pid)
    tl = [(tm, rk(d), wi(d)) for tm, d in S_today]
    tracked_y = base is not None and pid in (base[1].get("ranks") or {}) or (base is not None and pid in (base[1].get("wish") or {}))
    b = (rk(base[1]), wi(base[1])) if (base and tracked_y) else ("NA", None)
    it = line_of(pid)
    cur = tl[-1] if tl else (None, None, None)
    first = tl[0] if tl else (None, None, None)
    rows.append({"name": t["name"], "list": lst, "goal": g, "line": it, "base": b, "tl": tl, "cur": cur, "first": first, "live": live.get(pid, {"n": 0, "on": []})})

def fmt_r(v): return "미측정" if v == "NA" else "500밖" if v is None else f"{v}위"
def delta(a, b):  # a→b (순위는 작을수록 좋음)
    if a == "NA": return ("", (120, 120, 128))
    if a is None and b is None: return ("", (120, 120, 128))
    if b == "NA": return ("", (120, 120, 128))
    if a is None: return ("진입", (214, 60, 60))
    if b is None: return ("이탈", (40, 100, 220))
    d = a - b
    return (f"▲{d}", (214, 60, 60)) if d > 0 else (f"▼{-d}", (40, 100, 220)) if d < 0 else ("―", (120, 120, 128))

# ── 텍스트 본문
now = dt.datetime.now(KST).strftime("%H:%M")
L = [f"📈 카카오 선물하기 트래픽 진행 보고 · {today[5:].replace('-', '/')} {now} 기준"]
L.append(f"(측정 {len(S_today)}회: " + " → ".join(tm.strftime('%H:%M') for tm, _ in S_today) + f" · 기준점 = 전일 마지막 {S_yday[-1][0].strftime('%m/%d %H:%M') if S_yday else '없음'})")
if events:
    L.append("\n🛠 오늘 바뀐 것"); L += [f"· {tm} {w}" for tm, w in events]
L.append("\n📊 제품별 (목표 리스트 기준)")
for r in rows:
    live_on = [it for it in r["line"] and [r["line"]] or [] if it.get("status") == "집행중"]
    st = f"[{r['line']['status']}] " if r["line"] else ""
    b0, w0 = r["base"]; t1, r1, w1 = r["first"]; tn, rn, wn = r["cur"]
    dtxt, _ = delta(b0, rn)
    path = " → ".join(f"{tm.strftime('%H:%M')} {fmt_r(rr)}" for tm, rr, _ in r["tl"]) if r["tl"] else "측정 없음"
    g = r["goal"]; gtxt = f" · 목표 {g['min']}~{g['max']}위" if g.get("min") is not None else ""
    wtxt = f" · 위시 {w0:,}→{wn:,} ({wn - w0:+,})" if (w0 is not None and wn is not None) else ""
    ltxt = f" · 배지 {len(r['live']['on'])}/{r['live']['n']}회 켜짐" if r["live"]["n"] else ""
    L.append(f"· {st}{r['name']} ({r['list']}): 전일 {fmt_r(b0)} → {path}  {dtxt}{gtxt}{wtxt}{ltxt}")
    if r["live"]["on"]: L.append("    실시간 배지: " + ", ".join(f"{tm} '{h}'" for tm, h in r["live"]["on"][:5]))
# ── 소닉플로우 미니 (무신사·지그재그·에이블리) — settings.oa_sonic_rank_v1 history (sonic_rank_track.py 매시)
sonic = sget("oa_sonic_rank_v1") or {}
sh = [h for h in (sonic.get("history") or []) if isinstance(h, dict) and h.get("ts")]
sh_today = [h for h in sh if h["ts"].startswith(today)]; sh_yday = [h for h in sh if h["ts"].startswith(yday)]
# 기준점: 전일 마지막, 없으면 오늘 첫 '유효' 측정(에러 레코드 제외). 지표별로 값이 있는 첫 레코드를 쓴다
def first_valid(plat, k):
    for h in sh_today:
        v = (h.get(plat) or {}).get(k)
        if v not in (None, ""): return h
    return None
s_base = sh_yday[-1] if sh_yday else None
BASE_LABEL = "전일" if sh_yday else "오늘 첫측정"
def sv(h, plat, k):
    try: v = (h.get(plat) or {}).get(k); return None if v in ("", None) else (int(v) if isinstance(v, str) and v.isdigit() else v)
    except Exception: return None
SONIC_METRICS = [("musinsa", "hair_rank", "무신사 헤어케어 순위", "rank"), ("musinsa", "all_rank", "무신사 뷰티 전체 순위", "rank"), ("musinsa", "page_view_total", "무신사 누적 조회", "num"), ("musinsa", "purchase_total", "무신사 누적 구매", "num"), ("musinsa", "reviews", "무신사 리뷰", "num"),
                 ("zigzag", "hair_rank", "지그재그 헤어기기 순위", "rank"), ("zigzag", "appliance_rank", "지그재그 이미용가전 순위", "rank"), ("zigzag", "reviews", "지그재그 리뷰", "num"),
                 ("ably", "likes", "에이블리 찜", "num"), ("ably", "sell_count", "에이블리 판매수", "num"), ("ably", "reviews", "에이블리 리뷰", "num")]
sonic_lines = []
sonic_events = [(it.get("updated_at", "")[11:16], f"{it.get('product')} · 상태 → {it.get('status')} · {it.get('period', '')}") for it in ads if "소닉" in (it.get("product") or "") and (it.get("updated_at") or "").startswith(today)]
if sh_today:
    for plat, k, label, kind in SONIC_METRICS:
        bh = s_base or first_valid(plat, k); b0 = sv(bh, plat, k) if bh else None; cur = sv(sh_today[-1], plat, k)
        pts = [(h["ts"][11:16], sv(h, plat, k)) for h in sh_today if not any(str(kk).endswith("_err") for kk in (h.get(plat) or {}) if kk.startswith(k))]
        if all(v is None for _, v in pts) and b0 is None: continue  # 하루 종일 미노출 지표는 생략
        if kind == "rank":
            path = " → ".join(f"{t} {'-' if v is None else str(v) + '위'}" for t, v in pts[-6:])
            dtxt = ("" if (b0 is None or cur is None) else (f"▲{b0 - cur}" if b0 > cur else f"▼{cur - b0}" if b0 < cur else "―")) or ("진입" if (b0 is None and cur is not None) else "")
            sonic_lines.append(f"· {label}: {BASE_LABEL} {'-' if b0 is None else str(b0) + '위'} → {path}  {dtxt}")
        else:
            if cur is None: continue
            sonic_lines.append(f"· {label}: {BASE_LABEL} {b0 if b0 is not None else '-'} → 현재 {cur}" + (f" ({cur - b0:+,})" if (b0 is not None and isinstance(cur, (int, float)) and isinstance(b0, (int, float))) else ""))
# 소닉플로우 표 행 (PNG): 플랫폼별 순위 경로 + 보조 지표
SONIC_ROWS = []
if sh_today:
    valid = [h for h in sh_today if not any(str(k).endswith("_err") for pl in ("musinsa", "zigzag") for k in (h.get(pl) or {}))]
    pts_h = (valid or sh_today)[-5:]
    sonic_times = [h["ts"][11:16] for h in pts_h]
    def extra(plat, pairs):
        out = []
        for k, lab in pairs:
            bh = s_base or first_valid(plat, k); b0 = sv(bh, plat, k) if bh else None; cur = sv(sh_today[-1], plat, k)
            if cur is None: continue
            out.append(f"{lab} {cur:,}" + (f"({cur - b0:+,})" if isinstance(b0, (int, float)) and isinstance(cur, (int, float)) and cur != b0 else ""))
        return " · ".join(out)
    for plat, k, label, camp, ex in [("musinsa", "hair_rank", "소닉플로우 미니", "무신사 헤어케어", [("page_view_total", "조회"), ("purchase_total", "구매"), ("reviews", "리뷰")]),
                                     ("zigzag", "hair_rank", "소닉플로우 미니", "지그재그 헤어기기", [("reviews", "리뷰")]),
                                     ("zigzag", "appliance_rank", "소닉플로우 미니", "지그재그 이미용가전", [("reviews", "리뷰")]),
                                     ("ably", "beauty_device_daily", "소닉플로우 미니", "에이블리 뷰티디바이스", [("likes", "찜"), ("sell_count", "판매"), ("reviews", "리뷰")])]:
        bh = s_base or first_valid(plat, k); b0 = sv(bh, plat, k) if bh else None
        path = [sv(h, plat, k) for h in pts_h]; cur = path[-1] if path else None
        line_it = next((it for it in ads if "소닉" in (it.get("product") or "") and (("무신사" in camp and "무신사" in it["product"]) or ("지그재그" in camp and "지그재그" in it["product"]))), None)
        SONIC_ROWS.append({"name": label, "camp": camp + (f" · {line_it['status']}" if line_it else ""), "base": b0, "path": path, "cur": cur, "extra": extra(plat, ex)})
live_total = sum(len(r["live"]["on"]) for r in rows)
L.append(f"\n🟢 실시간 배지: 오늘 {live_total}회 켜짐" + (" — 캐시슬라이드 분산 유입으론 아직 안 켜짐" if live_total == 0 else ""))
if sonic_lines:
    L.append(f"\n🌀 소닉플로우 미니 (무신사·지그재그 캐시슬라이드, 매시 측정 {len(sh_today)}회)")
    L += [f"· {tm} {w}" for tm, w in sorted(sonic_events)]
    L += sonic_lines
text = "\n".join(L)

# ── PNG 표
FONT_DIR = Path.home() / "Library/Fonts"
def font(size, w="Regular"): return ImageFont.truetype(str(FONT_DIR / f"Pretendard-{w}.otf"), size)
INK, MUTED, LINE, BG, HEAD = (28, 28, 30), (120, 120, 128), (232, 232, 236), (255, 255, 255), (246, 246, 248)
times = [tm.strftime("%H:%M") for tm, _ in S_today]
COLS = [("제품", 150, "l"), ("캠페인", 110, "l"), ("전일", 80, "c")] + [(t, 82, "c") for t in times] + [("변화", 70, "c"), ("목표", 110, "l"), ("위시 변화", 150, "r"), ("배지", 70, "c")]
W = 40 * 2 + sum(c[1] for c in COLS); ROW = 50; H = 40 + 70 + 44 + ROW * len(rows) + (30 + 26 * len(events) if events else 0) + (40 + 26 * len(sonic_events) + 6 + 44 + ROW * len(SONIC_ROWS) if SONIC_ROWS else 0) + 60
im = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(im)
d.text((40, 34), f"카카오 선물하기 트래픽 진행 · {today[5:].replace('-', '/')} {now}", font=font(26, "Bold"), fill=INK)
d.text((40, 70), f"기준점 전일 마지막 {S_yday[-1][0].strftime('%m/%d %H:%M') if S_yday else '없음'} · 오늘 측정 {len(S_today)}회 · 순위는 각 제품의 목표 리스트 기준", font=font(15), fill=MUTED)
y = 110; x = 40
d.rectangle((40, y, W - 40, y + 44), fill=HEAD)
for name, w, al in COLS:
    f = font(15, "SemiBold"); tw = d.textlength(name, font=f); tx = x + 10 if al == "l" else x + w - 10 - tw if al == "r" else x + (w - tw) / 2
    d.text((tx, y + 13), name, font=f, fill=MUTED); x += w
y += 44
for r in rows:
    x = 40; cells = []
    cells.append((r["name"], INK, "Bold")); cells.append(((r["line"] or {}).get("status", "-") + ("·인앱" if (r["line"] or {}).get("landing_note", "").startswith("인앱") else ""), INK if (r["line"] or {}).get("status") == "집행중" else MUTED, "Regular"))
    b0, w0 = r["base"]; cells.append((fmt_r(b0), MUTED, "Regular"))
    prev = b0
    for tm, rr, _ in r["tl"]:
        dt_, col = delta(prev, rr); cells.append((fmt_r(rr) + (f" {dt_}" if dt_ and dt_ != "―" else ""), col if dt_ not in ("", "―") else INK, "Regular")); prev = rr
    tn, rn, wn = r["cur"]; dt_, col = delta(b0, rn); cells.append((dt_ or "―", col, "Bold"))
    g = r["goal"]; gt = (f"{g['min']}~{g['max']}위" if g.get("min") is not None else "-"); hit = rn is not None and g.get("max") is not None and rn <= g["max"]
    cells.append((gt + (" ✓" if hit else ""), (30, 140, 80) if hit else INK, "Regular"))
    cells.append((f"{w0:,} → {wn:,} ({wn - w0:+,})" if (w0 is not None and wn is not None) else "-", INK, "Regular"))
    cells.append((f"{len(r['live']['on'])}/{r['live']['n']}" if r["live"]["n"] else "-", (30, 140, 80) if r["live"]["on"] else MUTED, "Regular"))
    for (txt, col, wt), (name, w, al) in zip(cells, COLS):
        f = font(15, wt); tw = d.textlength(txt, font=f); tx = x + 10 if al == "l" else x + w - 10 - tw if al == "r" else x + (w - tw) / 2
        d.text((tx, y + 16), txt, font=f, fill=col); x += w
    d.line((40, y + ROW, W - 40, y + ROW), fill=LINE); y += ROW
if events:
    y += 14; d.text((40, y), "오늘 바뀐 것", font=font(16, "Bold"), fill=INK); y += 26
    for tm, w in events: d.text((40, y), f"{tm}  {w}", font=font(15), fill=INK); y += 26
if SONIC_ROWS:
    y += 14; d.text((40, y), f"소닉플로우 미니 · 무신사/지그재그/에이블리 캐시슬라이드 (매시 측정 {len(sh_today)}회)", font=font(16, "Bold"), fill=INK); y += 26
    for tm, w in sorted(sonic_events): d.text((40, y), f"{tm}  {w}", font=font(15), fill=INK); y += 26
    y += 6
    SC = [("제품", 120, "l"), ("플랫폼·캠페인", 190, "l"), (BASE_LABEL, 84, "c")] + [(t, 70, "c") for t in sonic_times] + [("변화", 64, "c"), ("지표 변화", W - 80 - 120 - 190 - 84 - 70 * len(sonic_times) - 64, "l")]
    x = 40; d.rectangle((40, y, W - 40, y + 44), fill=HEAD)
    for name, w, al in SC:
        f = font(15, "SemiBold"); tw = d.textlength(name, font=f); tx = x + 10 if al == "l" else x + w - 10 - tw if al == "r" else x + (w - tw) / 2
        d.text((tx, y + 13), name, font=f, fill=MUTED); x += w
    y += 44
    for r in SONIC_ROWS:
        x = 40; cells = [(r["name"], INK, "Bold"), (r["camp"], INK if "집행중" in r["camp"] else MUTED, "Regular"), ("-" if r["base"] is None else fmt_r(r["base"]), MUTED, "Regular")]
        prev = r["base"]
        for v in r["path"]:
            dt_, col = delta(prev, v); cells.append((fmt_r(v) if v is not None else "미노출", col if dt_ not in ("", "―") else (INK if v is not None else MUTED), "Regular")); prev = v if v is not None else prev
        dt_, col = delta(r["base"], r["cur"]); cells.append((dt_ or "―", col, "Bold")); cells.append((r["extra"] or "-", INK, "Regular"))
        for ci, ((txt, col, wt), (name, w, al)) in enumerate(zip(cells, SC)):
            if ci == len(SC) - 1:  # 지표 변화: 두 줄(13px)로
                parts = [t for t in txt.split(" · ") if t]; l1 = " · ".join(parts[:2]); l2 = " · ".join(parts[2:])
                d.text((x + 10, y + (10 if l2 else 16)), l1, font=font(13), fill=col)
                if l2: d.text((x + 10, y + 28), l2, font=font(13), fill=col)
            else:
                f = font(15, wt); tw = d.textlength(txt, font=f); tx = x + 10 if al == "l" else x + w - 10 - tw if al == "r" else x + (w - tw) / 2
                d.text((tx, y + 16), txt, font=f, fill=col)
            x += w
        d.line((40, y + ROW, W - 40, y + ROW), fill=LINE); y += ROW
d.text((40, H - 34), "▲ 상승(순위 숫자 감소) · ▼ 하락 · 배지 = 실시간 '지금 N명 보고 있어요' 켜진 횟수/측정 횟수 (10분 간격, 카카오톡 인앱 UA)", font=font(13), fill=MUTED)
png = f"/tmp/kakao-progress-{today}.png"; im.save(png)
print(json.dumps({"text": text, "png": png}, ensure_ascii=False))
