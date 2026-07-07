#!/usr/bin/env python3
"""11번가 포커스클릭 모니터링 — 이미용 그룹 제품별 30일 광고비/전환 + 키워드별 순위/입찰가

사용자 크롬(로그인된 adoffice 탭)을 AppleScript로 조종해 수집.
결과: copy-bank/../11st-focus/ 마크다운 + Supabase settings oa_11st_focus_v1

전제: 크롬에 adoffice.11st.co.kr 탭 열려 있고 로그인 상태,
      보기>개발자 정보>Apple Events의 자바스크립트 허용 ON
"""
import json, subprocess, sys, time, pathlib, urllib.request, datetime

SELLER = 1262
CAMPAIGN = 93213      # 건강/이미용가전 (직접)
GROUP = 385595        # 이미용
BASE = f"https://adoffice.11st.co.kr/sellers/{SELLER}/cpc/focus/campaigns/{CAMPAIGN}/groups/{GROUP}"

def run_js(js, retries=2):
    """adoffice 탭에서 JS 실행 (argv로 전달해 이스케이프 문제 회피)"""
    scpt = '''on run argv
tell application "Google Chrome"
repeat with w in windows
  repeat with t in tabs of w
    if URL of t contains "adoffice" then
      return execute t javascript (item 1 of argv)
    end if
  end repeat
end repeat
return "NO_TAB"
end tell
end run'''
    for i in range(retries + 1):
        r = subprocess.run(["osascript", "-e", scpt, js], capture_output=True, text=True, timeout=60)
        if r.returncode == 0:
            return r.stdout.strip()
        time.sleep(2)
    raise RuntimeError(f"JS 실행 실패: {r.stderr.strip()[:200]}")

def goto(url):
    scpt = '''on run argv
tell application "Google Chrome"
repeat with w in windows
  repeat with t in tabs of w
    if URL of t contains "adoffice" then
      set URL of t to (item 1 of argv)
      return "OK"
    end if
  end repeat
end repeat
return "NO_TAB"
end tell
end run'''
    r = subprocess.run(["osascript", "-e", scpt, url], capture_output=True, text=True, timeout=30)
    if "NO_TAB" in r.stdout:
        raise RuntimeError("adoffice 탭 없음 — 크롬에서 AD OFFICE 로그인 탭을 열어두세요")
    time.sleep(7)

def set_period_30d():
    """기간 프리셋을 '최근 30일'로 변경"""
    run_js("var cb=document.querySelector('.MuiSelect-select[role=combobox]');cb&&cb.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));'o'")
    time.sleep(1.5)
    run_js("var li=Array.from(document.querySelectorAll('[role=option],li')).find(e=>(e.innerText||'').trim()==='최근 30일');li&&li.click();'p'")
    time.sleep(5)

def get_rows(slice_from=1, slice_to=99):
    out = run_js(
        "JSON.stringify(Array.from(document.querySelectorAll('table tbody tr')).map(tr=>({"
        "link:(Array.from(tr.querySelectorAll('a')).find(a=>a.href.includes('/keywords'))||{}).href||'',"
        f"cells:Array.from(tr.querySelectorAll('td')).map(td=>(td.innerText||'').trim().replace(/\\n/g,'|')).slice({slice_from},{slice_to})"
        "})))")
    return json.loads(out) if out and out != "NO_TAB" else []

def next_page():
    r = run_js("var b=Array.from(document.querySelectorAll('button')).find(x=>(x.getAttribute('aria-label')||'')==='Go to next page');if(b&&!b.disabled){b.click();'NEXT'}else{'END'}")
    time.sleep(5)
    return r == "NEXT"

def collect_pages(slice_from=1, slice_to=99, max_pages=10):
    rows = []
    for _ in range(max_pages):
        rows += get_rows(slice_from, slice_to)
        if not next_page():
            break
    return rows

def num(s):
    s = (s or "").replace(",", "").replace("|", "")
    try:
        return float(s)
    except ValueError:
        return None

def main():
    check = run_js("location.href")
    if check == "NO_TAB":
        print("❌ adoffice 탭 없음"); sys.exit(1)

    # ── 1) 제품별 30일 성과 (이미용 그룹) ──
    goto(BASE)
    set_period_30d()
    prod_rows = collect_pages(1, 99)
    products = []
    for r in prod_rows:
        c = r["cells"]
        if len(c) < 15 or not r["link"]:
            continue
        # c: [이미지, 상품명(id|명), onoff, 상태, 키워드등록, 입찰검색, 입찰추천, 노출수, 클릭수, 클릭률, 평균순위, 평균클릭비용, 총비용, 총전환수, 총전환당비용, 총전환금액, ...]
        name_parts = c[1].split("|")
        products.append({
            "pid": name_parts[0], "name": "|".join(name_parts[1:]) or name_parts[0],
            "status": c[3], "imps": num(c[7]) or 0, "clicks": num(c[8]) or 0,
            "avgRank": num(c[10]), "cpc": num(c[11]),
            "spend30": num(c[12]) or 0, "conv30": num(c[13]) or 0, "convValue30": num(c[15]) or 0,
            "kwUrl": r["link"],
        })
    print(f"제품 {len(products)}개 수집", flush=True)

    # ── 2) 키워드별 순위 (지출 있거나 운영중 상품만) ──
    targets = [p for p in products if p["status"] == "운영중"]
    for i, p in enumerate(targets):
        goto(p["kwUrl"])
        set_period_30d()
        kw_rows = collect_pages(1, 12)
        kws = []
        for r in kw_rows:
            c = r["cells"]
            if len(c) < 11:
                continue
            # c: [키워드, onoff, 상태, 입찰가, 자동입찰, 품질지수, 노출순위, 노출수, 클릭수, 클릭률, 평균순위]
            kws.append({"kw": c[0], "status": c[2], "bid": num(c[3]), "auto": c[4],
                        "rank": c[6], "imps": num(c[7]) or 0, "clicks": num(c[8]) or 0, "avgRank": num(c[10])})
        p["keywords"] = kws
        print(f"[{i+1}/{len(targets)}] {p['name'][:30]} 키워드 {len(kws)}개", flush=True)

    # ── 3) 마진 데이터 (Supabase) ──
    env = dict(l.split("=", 1) for l in open(pathlib.Path(__file__).parent.parent / ".env.local")
               if "=" in l and not l.startswith("#"))
    surl = env.get("NEXT_PUBLIC_SUPABASE_URL", "").strip().strip('"').strip("'")
    skey = env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "").strip().strip('"').strip("'")
    hdrs = {"apikey": skey, "Authorization": f"Bearer {skey}", "Content-Type": "application/json"}

    def supa_get(path):
        req = urllib.request.Request(f"{surl}/rest/v1/{path}", headers=hdrs)
        return json.loads(urllib.request.urlopen(req).read())

    # 마진맵: MySQL 매출이익 기반 (copy-bank/11st_margin_map.json, 개당 마진액 원)
    mm_path = pathlib.Path(__file__).parent.parent / "copy-bank" / "11st_margin_map.json"
    margins = sorted(json.loads(mm_path.read_text())["items"], key=lambda m: -len(m["keyword"]))

    # 제품 ↔ 마진 키워드 매칭 (공백 제거 후 최장 키워드 우선). 월손익 = 마진×전환수 − 광고비
    for p in products:
        flat = p["name"].replace(" ", "")
        m = next((m for m in margins if m["keyword"] in flat), None)
        p["marginWon"] = m.get("margin_unit") if m else None
        p["roas30"] = round(p["convValue30"] / p["spend30"] * 100) if p["spend30"] else None
        if p["marginWon"] is not None:
            p["profit30"] = round(p["marginWon"] * p["conv30"] - p["spend30"])
            p["verdict"] = "흑자" if p["profit30"] >= 0 else "적자"
            aov = p["convValue30"] / p["conv30"] if p["conv30"] else None
            p["breakeven"] = round(aov / p["marginWon"] * 100) if aov else None  # 손익분기 ROAS
        else:
            p["profit30"] = None
            p["breakeven"] = None
            p["verdict"] = None

    # ── 4) 저장 ──
    today = datetime.date.today().isoformat()
    payload = {"date": today, "campaign": "건강/이미용가전", "group": "이미용", "products": products}
    # 로컬 JSON 먼저 저장 (Supabase 실패해도 데이터 보존)
    outdir = pathlib.Path(__file__).parent.parent / "copy-bank"
    (outdir / "11st_focus_이미용.json").write_text(json.dumps(payload, ensure_ascii=False, indent=1))
    print(f"✅ {outdir/'11st_focus_이미용.json'}", flush=True)
    body = json.dumps({"key": "oa_11st_focus_v1", "value": payload}, ensure_ascii=False).encode()
    req = urllib.request.Request(f"{surl}/rest/v1/settings?on_conflict=key", data=body,
                                 headers={**hdrs, "Prefer": "resolution=merge-duplicates"}, method="POST")
    try:
        urllib.request.urlopen(req)
        print("✅ Supabase oa_11st_focus_v1 저장", flush=True)
    except Exception as e:
        print("Supabase 저장 실패:", e, flush=True)

    lines = [f"# 11번가 포커스클릭 이미용 ({today}, 최근 30일)\n"]
    lines.append("| 제품 | 상태 | 30일 광고비 | 전환수 | 전환금액 | ROAS | 개당마진 | 월손익 | 손익분기ROAS | 판정 |")
    lines.append("|---|---|---|---|---|---|---|---|---|---|")
    for p in sorted(products, key=lambda x: -x["spend30"]):
        lines.append(f"| {p['name'][:35]} | {p['status']} | {int(p['spend30']):,}원 | {int(p['conv30'])} | {int(p['convValue30']):,}원 | "
                     f"{str(p['roas30'])+'%' if p['roas30'] is not None else '—'} | "
                     f"{format(p['marginWon'], ',')+'원' if p['marginWon'] else '—'} | "
                     f"{format(p['profit30'], ',')+'원' if p['profit30'] is not None else '—'} | "
                     f"{str(p['breakeven'])+'%' if p['breakeven'] else '—'} | {p['verdict'] or '—'} |")
    (outdir / "11st_focus_이미용.md").write_text("\n".join(lines))
    print(f"✅ {outdir/'11st_focus_이미용.md'}", flush=True)
    print("완료", flush=True)

if __name__ == "__main__":
    main()
