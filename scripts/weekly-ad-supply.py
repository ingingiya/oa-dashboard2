#!/usr/bin/env python3
"""주간 자동 소재 공급 — 매주 월요일 아침, 학습 레퍼런스 × 주력 제품 조합으로
광고 소재를 자동 생성해 부스터즈 팀 보관함에 채워놓는다.

로직: adrefs.json의 [학습] 레퍼런스를 주차별로 로테이션(6개) × 제품도 주차 로테이션 1개
→ 관리자 로그인(크레딧 무차감) → adcopy로 카피 변환 → PIL로 콤보 합성 → refad 생성
→ 보관함(부스터즈) 직접 저장 → 텔레그램 요약.

크론: 30 8 * * 1  (월요일 08:30)
"""
import io, re, sys, json, time, base64, urllib.request, datetime
from pathlib import Path
from PIL import Image

APP = "https://oa-detail-gen.vercel.app"
BASE = "https://lugqeflqusqsyotdiaxg.supabase.co/storage/v1/object/public/detail-assets"
BOOSTERS = "g_9fb17e41-0bcd-41a5-b1e3-80e6f5527fb1"
N_PER_WEEK = int(sys.argv[1]) if len(sys.argv) > 1 else 6

env = (Path.home() / "oa-detail-app" / ".env.local").read_text()
SB_URL = re.search(r'NEXT_PUBLIC_SUPABASE_URL="?([^"\n]+)"?', env).group(1).strip('"')
SB_KEY = re.search(r'SUPABASE_SERVICE_ROLE_KEY="?([^"\n]+)"?', env).group(1).strip('"')
SB_H = {"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"}

def jreq(url, data=None, headers=None, method=None):
    req = urllib.request.Request(url, data=json.dumps(data).encode() if data is not None else None,
        headers={"Content-Type": "application/json", **(headers or {})}, method=method)
    return json.loads(urllib.request.urlopen(req, timeout=300).read())

def tg(msg):
    try:
        tenv = (Path.home() / ".claude" / "channels" / "telegram" / ".env").read_text()
        tok = re.search(r"BOT_TOKEN=(\S+)", tenv).group(1)
        jreq(f"https://api.telegram.org/bot{tok}/sendMessage",
             {"chat_id": "8704535307", "text": msg})
    except Exception as e:
        print("텔레그램 실패:", e)

def main():
    week = datetime.date.today().isocalendar()[1]
    meta = jreq(f"{BASE}/adrefs/adrefs.json")
    pins = [r for r in meta["refs"] if r["id"].startswith("pin_")]
    prods = meta.get("products", [])
    if not pins or not prods:
        tg("⚠️ 주간 소재 공급 실패: 레퍼런스/제품 목록이 비어 있음"); return
    # 주차 로테이션 — 매주 다른 조합
    refs = [pins[(week * N_PER_WEEK + i) % len(pins)] for i in range(N_PER_WEEK)]
    prod = prods[week % len(prods)]

    # 관리자 로그인 (크레딧 무차감) — 쿠키 확보
    kv = jreq(f"{SB_URL}/rest/v1/settings?select=value&key=eq.oa_detail_admin_pin_v1", headers=SB_H)
    pin = (kv[0]["value"] or {}).get("adminPin") if kv else None
    if not pin:
        tg("⚠️ 주간 소재 공급 실패: 관리자 PIN을 KV에서 못 읽음"); return
    req = urllib.request.Request(f"{APP}/api/detail/credits",
        data=json.dumps({"login": {"name": "관리자", "pin": pin}}).encode(),
        headers={"Content-Type": "application/json"})
    res = urllib.request.urlopen(req, timeout=60)
    cookie = "; ".join(c.split(";")[0] for c in res.headers.get_all("Set-Cookie") or [])
    if "oa_team_tk" not in cookie:
        tg("⚠️ 주간 소재 공급 실패: 관리자 로그인 쿠키 없음"); return
    AUTH = {"Cookie": cookie}

    def fetch_img(url):
        return Image.open(io.BytesIO(urllib.request.urlopen(
            urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=60).read())).convert("RGB")

    made, failed, gallery_refs = [], [], []
    prod_im = fetch_img(prod["url"])
    for ref in refs:
        title = f"[자동] {ref['title'].replace('[학습] ', '')} × {prod['name']}"
        try:
            tmpl = list((ref.get("copies") or {}).values())
            spec = tmpl[0] if tmpl else ""
            if spec:
                a = jreq(f"{APP}/api/detail/adcopy", {
                    "template": spec, "refTitle": ref["title"],
                    "productName": prod["name"], "productDesc": prod.get("desc", ""),
                    "intent": "주간 신규 소재 (시즌 프로모션)"}, AUTH)
                if a.get("ok"):
                    spec = a["copySpec"]
            # 콤보 합성 (좌: 레퍼런스 / 우: 제품, 높이 1200)
            ref_im = fetch_img(ref["url"])
            H = 1200
            ims = [ref_im, prod_im]
            ws = [round(im.width * H / im.height) for im in ims]
            cv = Image.new("RGB", (sum(ws) + 40, H), "white")
            x = 0
            for im, w in zip(ims, ws):
                cv.paste(im.resize((w, H)), (x, 0)); x += w + 40
            buf = io.BytesIO(); cv.save(buf, "JPEG", quality=88)
            combo = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()

            g = jreq(f"{APP}/api/detail/refad", {
                "combo": combo, "copySpec": spec, "ratio": "1:1",
                "productDesc": prod.get("desc", "")}, AUTH)
            if not g.get("ok"):
                raise RuntimeError(g.get("error", "생성 실패"))
            out = g["image"]
            raw = (urllib.request.urlopen(out, timeout=120).read() if out.startswith("http")
                   else base64.b64decode(out.split(",")[1]))

            # 보관함 직접 저장 (부스터즈 팀)
            iid = format(int(time.time() * 1000), "x") + "auto"
            path = f"adgallery/{BOOSTERS}/{iid}.jpg"
            im = Image.open(io.BytesIO(raw)).convert("RGB")
            im.thumbnail((1080, 1080))
            ob = io.BytesIO(); im.save(ob, "JPEG", quality=88)
            urllib.request.urlopen(urllib.request.Request(
                f"{SB_URL}/storage/v1/object/detail-assets/{path}", data=ob.getvalue(),
                headers={**SB_H, "Content-Type": "image/jpeg", "x-upsert": "true"}, method="POST"))
            kvg = jreq(f"{SB_URL}/rest/v1/settings?select=value&key=eq.oa_ad_gallery_v1", headers=SB_H)
            items = (kvg[0]["value"] or {}).get("items", []) if kvg else []
            items.insert(0, {"id": iid, "url": f"{BASE}/{path}", "title": title[:40],
                             "teamId": BOOSTERS, "team": "부스터즈",
                             "at": datetime.datetime.now(datetime.timezone.utc).isoformat()})
            urllib.request.urlopen(urllib.request.Request(
                f"{SB_URL}/rest/v1/settings?on_conflict=key",
                data=json.dumps({"key": "oa_ad_gallery_v1", "value": {"items": items}}).encode(),
                headers={**SB_H, "Content-Type": "application/json",
                         "Prefer": "resolution=merge-duplicates"}, method="POST"))
            made.append(title)
            gallery_refs.append({"id": f"auto_{iid}", "title": f"[자동] {ref['title'].replace('[학습] ', '').split(' — ')[0]} × {prod['name']}"[:40],
                                 "url": f"{BASE}/{path}", "copies": {"generic": spec}, "productKeys": []})
            print("✅", title)
        except Exception as e:
            failed.append(f"{title}: {str(e)[:60]}")
            print("❌", title, e)
        time.sleep(5)

    # 레퍼런스 갤러리에도 등록 — 지난주 [자동] 분은 교체 (갤러리 비대 방지)
    if gallery_refs:
        try:
            cur = jreq(f"{BASE}/adrefs/adrefs.json")
            cur["refs"] = gallery_refs + [r for r in cur["refs"] if not r["id"].startswith("auto_")]
            urllib.request.urlopen(urllib.request.Request(
                f"{SB_URL}/storage/v1/object/detail-assets/adrefs/adrefs.json",
                data=json.dumps(cur, ensure_ascii=False).encode(),
                headers={**SB_H, "Content-Type": "application/json", "x-upsert": "true"}, method="POST"))
            print(f"레퍼런스 갤러리 등록 {len(gallery_refs)}건 (지난주 자동분 교체)")
        except Exception as e:
            print("갤러리 등록 실패:", e)

    msg = f"🗂 주간 소재 공급 완료 ({week}주차)\n제품: {prod['name']}\n생성 {len(made)}/{len(refs)}장 → 보관함 + 레퍼런스 갤러리 맨 앞 [자동]\n"
    msg += "\n".join("· " + m.replace("[자동] ", "") for m in made)
    if failed:
        msg += "\n⚠️ 실패:\n" + "\n".join(failed)
    tg(msg)

if __name__ == "__main__":
    main()
