#!/usr/bin/env python3
"""아이보스 광고상품 소개서 일괄 다운로드 + 단가 추출 → docs/iboss-brochures.json
- 로그인: 사용자 크롬(Default) 쿠키를 복사(iboss_cookies.json, scripts/iboss-cookies.py 로 재생성). ★move_url 다운로드는 Cloudflare 때문에 헤드 크롬만 통과.
- PDF/PPTX → 텍스트(pdftotext / python-pptx 없으면 unzip xml) → CPC/CPM/CPV/정액/최소 금액 정규식."""
import json, os, re, time, subprocess, pathlib, sys, zipfile
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent; DOCS = ROOT / "docs"; BR = DOCS / "iboss-brochures"; BR.mkdir(exist_ok=True)
CK = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path("/private/tmp/claude-501/-Users-kirby/0cc44013-5eb1-49cc-a1a3-f7009066ff5f/scratchpad/iboss_cookies.json")
items = json.loads((DOCS / "iboss-ad-products.json").read_text())["items"]
state_p = DOCS / "iboss-brochures.json"; state = json.loads(state_p.read_text()) if state_p.exists() else {}
def num(s): return int(re.sub(r"[^0-9]", "", s)) * (10000 if "만" in s else 1) if re.sub(r"[^0-9]", "", s) else None
def prices(t):
    t2 = re.sub(r"\s+", " ", t)
    out = {}
    for key, pat in (("cpc", r"CPC[^0-9]{0,25}([\d,]+\s*(?:만)?\s*원)"), ("cpm", r"CPM[^0-9]{0,25}([\d,]+\s*(?:만)?\s*원)"), ("cpv", r"CPV[^0-9]{0,25}([\d,]+\s*(?:만)?\s*원)"), ("cpt_or_flat", r"(?:CPT|CPD|CPP|정액|구좌|1주|1일|일 단가|주 단가|월 단가)[^0-9]{0,30}([\d,]+\s*(?:만)?\s*원)"), ("min_budget", r"(?:최소|최저)[^0-9]{0,20}([\d,]+\s*(?:만)?\s*원)")):
        ms = re.findall(pat, t2, re.I)
        vals = [v for v in (num(m) for m in ms) if v and v >= 5]
        if vals: out[key] = min(vals); out[key + "_all"] = sorted(set(vals))[:8]
    snip = [m.group(0)[:120] for m in re.finditer(r"[^.|]{0,60}(?:CPC|CPM|CPV|CPT|단가|원/|원 /|원\)|₩)[^.|]{0,60}", t2, re.I)][:12]
    return out, snip
def to_text(fp):
    fp = pathlib.Path(fp); ext = fp.suffix.lower()
    try:
        if ext == ".pdf": return subprocess.run(["pdftotext", "-layout", str(fp), "-"], capture_output=True, text=True, timeout=120).stdout
        if ext in (".pptx", ".docx", ".xlsx"):
            z = zipfile.ZipFile(fp); txt = ""
            for n in z.namelist():
                if n.endswith(".xml") and ("slides/slide" in n or "word/document" in n or "sharedStrings" in n): txt += " ".join(re.findall(r"<a:t>([^<]*)</a:t>|<t[^>]*>([^<]*)</t>", z.read(n).decode("utf8", "ignore")).__str__())
            return txt
    except Exception as e: return f"ERR {e}"
    return ""
LOCK = ROOT / "scripts" / "iboss-brochures.lock"
if LOCK.exists() and time.time() - LOCK.stat().st_mtime < 6 * 3600: raise SystemExit("already running")
LOCK.write_text(str(os.getpid()))
import atexit; atexit.register(lambda: LOCK.unlink(missing_ok=True))
ck = json.loads(CK.read_text()) if CK.exists() else []
cred = dict(l.split("=", 1) for l in pathlib.Path.home().joinpath(".oa-ad-creds/iboss").read_text().strip().splitlines())
def ensure_login(pg):
    pg.goto("https://www.i-boss.co.kr/", wait_until="domcontentloaded", timeout=60000); time.sleep(2)
    if "회원가입" not in pg.inner_text("body")[:900]: return True
    pg.goto("https://www.i-boss.co.kr/ab-login", wait_until="domcontentloaded", timeout=60000); time.sleep(2)
    pg.fill("input[name=user_id]", cred["ID"]); pg.fill("input[name=user_passwd]", cred["PW"]); pg.keyboard.press("Enter"); time.sleep(5)
    pg.goto("https://www.i-boss.co.kr/", wait_until="domcontentloaded", timeout=60000); time.sleep(2)
    ok = "회원가입" not in pg.inner_text("body")[:900]; print("login via credentials:", ok, pg.url[:80], flush=True); return ok
with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context("/Users/kirby/.pw-iboss", headless=False, channel="chrome", viewport={"width": 900, "height": 600}, accept_downloads=True, downloads_path=str(BR), args=["--disable-blink-features=AutomationControlled", "--window-position=1500,950", "--window-size=500,350"])
    pg = ctx.pages[0] if ctx.pages else ctx.new_page()
    if not ensure_login(pg):
        if ck: ctx.add_cookies(ck)
        if not ensure_login(pg): raise SystemExit("login failed")
    done = 0
    for it in items:
        key = it["url"].rsplit("/", 1)[-1]
        if key in state and state[key].get("status") in ("ok", "nofile"): continue
        rec = {"name": it["name"], "url": it["url"], "files": [], "status": "err"}
        try:
            pg.goto(it["url"], wait_until="domcontentloaded", timeout=60000); time.sleep(1.5)
            if "회원가입" in pg.inner_text("body")[:800]: ensure_login(pg); pg.goto(it["url"], wait_until="domcontentloaded", timeout=60000); time.sleep(1.5)
            links = pg.evaluate("() => [...new Set([...document.querySelectorAll(\"a[href*='move_url']\")].map(a=>a.href))]")
            if not links: rec["status"] = "nofile"
            for href in links[:3]:
                got = []; h = lambda d: got.append(d); pg.on("download", h)
                try:
                    try: pg.goto(href, wait_until="commit", timeout=30000)
                    except Exception as ge:
                        if "Download is starting" not in str(ge): raise
                    for _ in range(30):
                        if got: break
                        time.sleep(0.5)
                    if not got:
                        t = pg.title()
                        if "잠시만" in t or "moment" in t.lower():
                            time.sleep(8)
                            for _ in range(20):
                                if got: break
                                time.sleep(0.5)
                    if not got:
                        rec["files"].append({"href": href, "unavailable": pg.inner_text("body")[:60].strip(), "title": pg.title()[:30]}); rec["status"] = "unavailable"; print("  NA", pg.title()[:30], pg.inner_text("body")[:40].replace("\n", " "), flush=True)
                    else:
                        d = got[0]; safe = re.sub(r"[^\w.-]", "_", d.suggested_filename)[:80]; fn = BR / f"{key}_{safe}"; d.save_as(str(fn))
                        txt = to_text(fn); pr, snip = prices(txt)
                        rec["files"].append({"file": fn.name, "size": fn.stat().st_size, "chars": len(txt), "prices": pr, "snippets": snip}); rec["status"] = "ok"
                        (BR / (fn.stem + ".txt")).write_text(txt[:200000])
                except Exception as e:
                    rec["files"].append({"href": href, "err": str(e)[:80]}); print("  DLERR", str(e)[:70], flush=True)
                finally:
                    pg.remove_listener("download", h)
                time.sleep(1)
        except Exception as e: rec["err"] = str(e)[:100]; print("  ERR", rec["err"], flush=True)
        state[key] = rec; done += 1
        if done % 5 == 0: state_p.write_text(json.dumps(state, ensure_ascii=False, indent=1))
        print(done, key, rec["status"], [f.get("prices") for f in rec["files"]], flush=True)
        if rec["status"] == "unavailable":
            na_streak = globals().get("na_streak", 0) + 1; globals()["na_streak"] = na_streak
            if na_streak >= 4:
                print("4연속 이용불가 → 한도/차단 추정, 30분 대기 후 재개", flush=True); state_p.write_text(json.dumps(state, ensure_ascii=False, indent=1))
                for k in [k for k, v in state.items() if v.get("status") == "unavailable"][-4:]: state.pop(k, None)  # 마지막 4개는 재시도 대상으로 복구
                globals()["na_streak"] = 0; time.sleep(1800)
                try: ensure_login(pg)
                except Exception: pass
        else: globals()["na_streak"] = 0
        time.sleep(float(os.environ.get("IBOSS_DELAY", "45")))  # ★빠르게 돌리면 '이용할 수 없습니다'로 막힘(09-15) → 느리게
    ctx.close()
    # 아직 안 된 항목(err/unavailable)이 남았으면 1시간 뒤 한 바퀴 더 (최대 12회)
    remaining = [k for k, v in state.items() if v.get("status") in ("err", "unavailable")]
    rounds = int(os.environ.get("IBOSS_ROUND", "0"))
    if remaining and rounds < 12:
        state_p.write_text(json.dumps(state, ensure_ascii=False, indent=1)); print(f"남은 {len(remaining)}개, 1시간 후 재시도 (round {rounds+1})", flush=True); time.sleep(3600)
        os.environ["IBOSS_ROUND"] = str(rounds + 1); os.execv(sys.executable, [sys.executable, "-u", __file__] + sys.argv[1:])
state_p.write_text(json.dumps(state, ensure_ascii=False, indent=1)); print("DONE", len(state))
