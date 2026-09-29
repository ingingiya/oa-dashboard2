#!/usr/bin/env python3
"""지마켓·옥션 광고센터(ESM) 30일 성과 수집 → docs/esm-ads.json
로그인 ~/.oa-ad-creds/esm (k2ci). 헤드리스는 세션 불안정 → 헤드(adboost와 동일)."""
import time, pathlib, json, re, sys
from datetime import date, timedelta
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
cred = dict(l.split("=", 1) for l in pathlib.Path.home().joinpath(".oa-ad-creds/esm").read_text().strip().splitlines())
END = date.today() - timedelta(days=1); START = END - timedelta(days=29)
OA_SELLERS = ["k2ci00", "k2ci01", "k2ci", "k2ci2"]  # 보아르(voar*) 제외
num = lambda s: float(re.sub(r"[^0-9.\-]", "", str(s)) or 0)
out = {"updated": date.today().isoformat(), "period": f"{START}~{END}", "gmarket": {}, "auction": {}}
def login_form(page, label):
    fr = next((f for f in page.frames if f.locator("input[type=password]:visible").count()), page)
    idf = fr.locator("input[type=text]:visible").first; pwf = fr.locator("input[type=password]:visible").first
    idf.click(); idf.fill(""); idf.type(cred["ID"], delay=60); pwf.click(); pwf.fill(""); pwf.type(cred["PW"], delay=60); time.sleep(1); pwf.press("Enter"); time.sleep(8)
    print(f"[{label}] ->", page.url[:70], "|", page.title(), flush=True)
def summary_from(text):
    m = re.search(r"요약 리포트.*?광고 비용\s*/?\s*([\d,]+)원.*?판매자 전환 금액\s*/?\s*([\d,]+)원.*?광고수익률\s*/?\s*([\d.,]+)%.*?노출 수\s*/?\s*([\d,]+)회.*?클릭 수\s*/?\s*([\d,]+)회.*?평균클릭비용\s*/?\s*([\d,]+)원.*?판매자 전환 수\s*/?\s*([\d,]+)회", text.replace("\n", " "), re.S)
    if not m: return None
    return {"spend": num(m[1]), "rev": num(m[2]), "roas": num(m[3]) / 100, "imp": num(m[4]), "clicks": num(m[5]), "cpc": num(m[6]), "conv": num(m[7])}
with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context("/Users/kirby/.pw-esmplus", headless=False, channel="chrome", viewport={"width": 1500, "height": 1100}, args=["--disable-blink-features=AutomationControlled"])
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.goto("https://signin.esmplus.com/login", wait_until="domcontentloaded", timeout=60000); time.sleep(4)
    if "signin" in page.url:
        page.get_by_text("ESM PLUS", exact=False).first.click(); time.sleep(1); login_form(page, "esmplus")
    # ── G마켓 광고센터 ──
    page.goto("https://adcenter.esmplus.com/report", wait_until="domcontentloaded", timeout=60000); time.sleep(8)
    if "login" in page.url: login_form(page, "adcenter"); page.goto("https://adcenter.esmplus.com/report", wait_until="domcontentloaded", timeout=60000); time.sleep(8)
    # 판매자 전환(좌측 상단 드롭다운 좌표 170,96 → 버튼 텍스트) + 기간 선택(좌표 487,287 → '지난 30일' → 적용)
    def gm_collect(seller):
        page.goto("https://adcenter.esmplus.com/report", wait_until="domcontentloaded", timeout=60000); time.sleep(8)
        page.mouse.click(170, 96); time.sleep(2)
        try: page.get_by_role("button", name=seller, exact=True).first.click(timeout=5000); time.sleep(7)
        except Exception as e: print("  seller switch err", seller, str(e)[:60]); page.keyboard.press("Escape")
        cur = page.evaluate("() => { const el=[...document.querySelectorAll('p,span,div')].find(e=>e.children.length===0 && /^(k2ci00|k2ci01|voar00|voarn3)$/.test((e.innerText||'').trim()) && e.getBoundingClientRect().top<120); return el ? el.innerText.trim() : 'none'; }")
        page.mouse.click(487, 287); time.sleep(2)
        try:
            page.get_by_text("지난 30일", exact=True).last.click(force=True, timeout=5000); time.sleep(2)
            page.get_by_role("button", name="적용").first.click(timeout=5000); time.sleep(9)
        except Exception as e: print("  period err", str(e)[:80]); page.keyboard.press("Escape")
        txt = page.inner_text("body"); s = summary_from(txt); m = re.search(r"조회 일자 \(([\d.]+ - [\d.]+)\)", txt)
        print(f"[gmarket {seller} cur={cur}] period={m[1] if m else '?'}", s, flush=True)
        if s and cur == seller: out["gmarket"][f"{seller} (30일)"] = dict(s, period=m[1] if m else "")
        elif s: out["gmarket"][f"{cur} (30일, {seller} 전환실패)"] = dict(s, period=m[1] if m else "")
    for s in ("k2ci00", "k2ci01"): gm_collect(s)
    # ── 옥션 광고센터 (API 직접 호출) ──
    page.goto("https://ad.esmplus.com/CPC/Main", wait_until="domcontentloaded", timeout=60000); time.sleep(6)
    if "LogOn" in page.url:
        try: page.get_by_text("ESM PLUS", exact=True).first.click(timeout=3000); time.sleep(1)
        except Exception: pass
        login_form(page, "auction")
    fd, td = START.isoformat(), END.isoformat()
    for name, url, body in [
        ("cpp_daily", "https://ad.esmplus.com/CPP/Report/GetReportSuccBidSummaryDate", {"sellerIdList": OA_SELLERS, "fromDate": fd, "toDate": td, "productSeqList": [1, 2, 3, 4, 5, 6], "pageNo": 1, "pageSize": "100"}),
    ]:
        try:
            r = page.request.post(url, data=json.dumps(body), headers={"Content-Type": "application/json", "Referer": "https://ad.esmplus.com/cpp/report/dailyreport"})
            j = r.json(); out["auction"][name] = j; print(f"[auction {name}] status {r.status} keys {list(j)[:6] if isinstance(j, dict) else type(j)}", str(j)[:300], flush=True)
        except Exception as e: print("auction api err", name, str(e)[:100])
    # 옥션 파워클릭 날짜별 리포트 (UI)
    try:
        page.goto("https://ad.esmplus.com/cpc/report/dailyReport", wait_until="domcontentloaded", timeout=60000); time.sleep(6)
        inp = page.locator("input").filter(has_text="").first
        info = page.evaluate("() => [...document.querySelectorAll('input')].map(i=>({t:i.type,n:i.name,id:i.id,v:i.value,cls:i.className.slice(0,40)})).filter(i=>i.t!='hidden'||/date|Date/.test(i.n+i.id))")
        print("cpc inputs:", info[:12], flush=True)
        rad = page.evaluate("() => [...document.querySelectorAll('input[type=radio]')].map(i=>({n:i.name,v:i.value,chk:i.checked,lab:(i.closest('label')||i.parentElement).innerText.trim().slice(0,20),top:Math.round(i.getBoundingClientRect().top)}))"); print("  radios:", rad, flush=True)
        sh = page.evaluate("() => [...document.querySelectorAll('*')].filter(e=>e.children.length===0 && (e.innerText||'').trim() && (e.innerText||'').length<16 && e.getBoundingClientRect().width>0).map(e=>e.tagName+'|'+e.innerText.trim()+'@'+Math.round(e.getBoundingClientRect().top)+','+Math.round(e.getBoundingClientRect().left))"); print("  shorts:", [x for x in sh if any(k in x for k in ["일","주","월","조회","~","기간"])][:40], flush=True)
        page.screenshot(path="/tmp/auc_daily.png", full_page=True)
        page.evaluate(f"""() => {{ for (const i of document.querySelectorAll('input')) {{ if (/(from|start|sdate|begin)/i.test(i.name+i.id)) {{ i.value='{fd}'; i.dispatchEvent(new Event('change',{{bubbles:true}})); }} if (/(to|end|edate)/i.test(i.name+i.id) && !/total/i.test(i.name+i.id)) {{ i.value='{td}'; i.dispatchEvent(new Event('change',{{bubbles:true}})); }} }} }}""")
        labels = page.evaluate("() => [...document.querySelectorAll('label')].map(l=>l.innerText.trim()).filter(t=>t)"); print("  cpc labels:", labels[:20], flush=True)
        page.get_by_text("조회하기", exact=True).first.click(); time.sleep(7)
        rows7 = page.eval_on_selector_all("table tr", "trs=>trs.map(tr=>[...tr.querySelectorAll('td')].map(td=>td.innerText.trim())).filter(r=>r.length>5)")
        out["auction"]["cpc_daily_7d"] = rows7
        for nm in ():
            try:
                page.get_by_text(nm, exact=True).first.click(); time.sleep(1); page.get_by_text("조회하기", exact=True).first.click(); time.sleep(7)
                rows = page.eval_on_selector_all("table tr", "trs=>trs.map(tr=>[...tr.querySelectorAll('td')].map(td=>td.innerText.trim())).filter(r=>r.length>5)")
                out["auction"][nm] = rows; print(f"  {nm}:", rows[:3], flush=True)
            except Exception as e: print("  monthly err", nm, str(e)[:60])

    except Exception as e: print("auction cpc ui err", str(e)[:100])
    time.sleep(1); ctx.close()
(ROOT / "docs" / "esm-ads.json").write_text(json.dumps(out, ensure_ascii=False, indent=1)); print("saved docs/esm-ads.json")
