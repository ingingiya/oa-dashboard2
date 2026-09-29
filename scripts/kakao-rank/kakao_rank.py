#!/usr/bin/env python3
"""카카오 선물하기 랭킹 트래킹 — 대상 상품의 카테고리 랭킹 순위/위시/후기 스냅샷 저장 + 전일 비교 JSON 출력.
사용법: python3 kakao_rank.py [--date YYYY-MM-DD] [--slot am|pm] [--no-save]
슬롯: 랭킹은 08:00·17:00 등 하루 여러 번 갱신 → 스냅샷 {date}_{slot}.json, 비교는 같은 슬롯의 전일(없으면 전일 아무 슬롯)
출력: {"date","prevDate","lists":[...],"products":[{name,id,ranks:{list:{today,prev}},wish:{today,prev},review:{today,prev}}]}
"""
import sys, json, datetime as dt, warnings, time
from pathlib import Path
warnings.filterwarnings("ignore")
import requests

HERE = Path(__file__).resolve().parent; DATA = HERE / "data"; DATA.mkdir(exist_ok=True)
TARGETS = json.loads((HERE / "targets_manual.json").read_text()) if (HERE / "targets_manual.json").exists() else json.loads((HERE / "targets.json").read_text())  # ★사용자 목표 리스트(targets_manual.json, goal 포함)가 있으면 우선, 없으면 메타 ACTIVE 자동 목록
LISTS = [  # (라벨, body) — 순서 = 표 컬럼 순서
    ("건강가전", {"navId": 7, "subNavId": 164}),
    ("뷰티가전", {"navId": 7, "subNavId": 161}),
    ("생활가전", {"navId": 7, "subNavId": 160}),
    ("계절가전", {"navId": 7, "subNavId": 163}),
    ("충전기", {"navId": 7, "subNavId": 157}),
    ("음향가전", {"navId": 7, "subNavId": 158}),
    ("가전·디지털", {"navId": 7}),
    ("전체", {"navId": 11000}),
]
MAX_PAGES = 5  # 100 × 5 = 500위까지
H = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128 Safari/537.36",
     "Accept": "application/json, text/plain, */*", "Content-Type": "application/json",
     "Referer": "https://gift.kakao.com/ranking/category/7", "Origin": "https://gift.kakao.com"}
U = "https://gift.kakao.com/a/rank/v1/gift-rank/ranking-tab/category-tab/search"
ids = {t["id"]: t["name"] for t in TARGETS}

args = sys.argv[1:]
today = args[args.index("--date") + 1] if "--date" in args else (dt.datetime.utcnow() + dt.timedelta(hours=9)).date().isoformat()
slot = args[args.index("--slot") + 1] if "--slot" in args else "pm"
snap = {"date": today, "updatedAt": None, "ranks": {}, "wish": {}, "review": {}}
for label, body in LISTS:
    n = 0
    for p in range(MAX_PAGES):
        for attempt in range(3):
            try:
                r = requests.post(U, headers=H, json={**body, "page": p, "size": 100, "filters": {"searchFilters": []}}, timeout=30)
                if r.status_code == 200: break
            except Exception: pass
            time.sleep(2)
        else:
            break
        d = r.json(); snap["updatedAt"] = d.get("updatedAt") or snap["updatedAt"]
        items = d.get("products", [])
        for it in items:
            n += 1
            pid = it["productId"]
            if pid in ids:
                snap["ranks"].setdefault(str(pid), {})[label] = n
                snap["wish"][str(pid)] = it["wish"]["wishCount"]
        if d.get("last") or not items: break
# 후기 수는 상품상세에서
for pid in ids:
    try:
        pd = requests.get(f"https://gift.kakao.com/a/product-detail/v3/products/{pid}", headers=H, timeout=30).json()
        snap["review"][str(pid)] = pd.get("review", {}).get("totalCount")
        if str(pid) not in snap["wish"]: snap["wish"][str(pid)] = None
    except Exception: pass

snap["slot"] = slot
if "--no-save" not in args:
    (DATA / f"{today}_{slot}.json").write_text(json.dumps(snap, ensure_ascii=False))
def stem_date(st): return st[:10]
def stem_slot(st): return st[11:] or "pm"  # 구형 파일(날짜만)은 pm 취급
cands = [p.stem for p in DATA.glob("*.json") if stem_date(p.stem) < today]
same = sorted(c for c in cands if stem_slot(c) == slot)
pick = same[-1] if same else (sorted(cands, key=lambda c: (stem_date(c), stem_slot(c)))[-1] if cands else None)
prev = json.loads((DATA / f"{pick}.json").read_text()) if pick else None
out = {"date": today, "prevDate": prev["date"] if prev else None, "updatedAt": snap["updatedAt"], "lists": [l for l, _ in LISTS], "products": []}
for t in TARGETS:
    k = str(t["id"])
    out["products"].append({"name": t["name"], "id": t["id"], "goal": t.get("goal"), "memo": t.get("memo"),
        "ranks": {l: {"today": snap["ranks"].get(k, {}).get(l), "prev": (prev or {}).get("ranks", {}).get(k, {}).get(l)} for l, _ in LISTS},
        "wish": {"today": snap["wish"].get(k), "prev": (prev or {}).get("wish", {}).get(k)},
        "review": {"today": snap["review"].get(k), "prev": (prev or {}).get("review", {}).get(k)}})
print(json.dumps(out, ensure_ascii=False))
# 대시보드(광고관리 트래픽 표 순위 컬럼)용 — settings.oa_kakao_rank_v1 에 비교 JSON 그대로 푸시
if "--no-save" not in args:
    try:
        env = {}
        for l in (HERE.parent.parent / ".env.local").read_text().splitlines():
            if "=" in l and not l.startswith("#"): k_, v_ = l.split("=", 1); env[k_.strip()] = v_.strip().strip('"')
        SB = env["NEXT_PUBLIC_SUPABASE_URL"]; SK = env["SUPABASE_SERVICE_ROLE_KEY"]
        out["slot"] = slot
        r = requests.post(f"{SB}/rest/v1/settings?on_conflict=key", headers={"apikey": SK, "Authorization": "Bearer " + SK, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates"}, json={"key": "oa_kakao_rank_v1", "value": out}, timeout=30)
        print("settings push", r.status_code, file=sys.stderr)
    except Exception as e: print("settings push fail", e, file=sys.stderr)
