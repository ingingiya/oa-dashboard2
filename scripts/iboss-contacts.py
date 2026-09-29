#!/usr/bin/env python3
"""아이보스 매체 담당 연락처 수집 → docs/iboss-merged.json (ad-cost-map-sync.py 가 우선 읽음)
1단계: 아이보스 상품 페이지의 '매체 정보' 블록 → 매체명·소개·웹사이트·SNS (CDP 9223 크롬, 로그인 불필요)
2단계: 매체 웹사이트 홈 + 광고문의/contact 후보 페이지 → 이메일(광고/제휴 우선)·전화·담당 문구 정규식
3단계: 병합 → contact_email / contact_phone / contact_site / contact_src / contact_note
사용: python3 scripts/iboss-contacts.py [--stage1|--stage2|--merge] (기본 전부). 상태 파일 docs/iboss-contacts.json (재실행 시 이어서)"""
import json, re, sys, time, pathlib, urllib.request, urllib.parse, ssl, html as htmlmod, concurrent.futures as cf
ROOT = pathlib.Path(__file__).resolve().parent.parent; DOCS = ROOT / "docs"
SRC = json.loads((DOCS / "iboss-ad-products.json").read_text())
STATE_P = DOCS / "iboss-contacts.json"; STATE = json.loads(STATE_P.read_text()) if STATE_P.exists() else {}
def save(): STATE_P.write_text(json.dumps(STATE, ensure_ascii=False, indent=1))
def key(it): return it["url"].rsplit("/", 1)[-1]
SKIP_HOST = ("instagram.com", "facebook.com", "google.com", "youtube.com", "apple.com", "play.google", "naver.com", "kakao.com", "tiktok.com", "twitter.com", "x.com", "linkedin.com")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36"
CTX = ssl.create_default_context(); CTX.check_hostname = False; CTX.verify_mode = ssl.CERT_NONE

def stage1():
    from playwright.sync_api import sync_playwright
    todo = [it for it in SRC["items"] if key(it) not in STATE or "media" not in STATE[key(it)]]
    print("stage1 todo", len(todo), flush=True)
    if not todo: return
    with sync_playwright() as p:
        b = p.chromium.connect_over_cdp("http://127.0.0.1:9223"); pg = b.contexts[0].new_page()
        for n, it in enumerate(todo, 1):
            k = key(it); rec = STATE.setdefault(k, {"name": it["name"], "url": it["url"]})
            try:
                pg.goto(it["url"], wait_until="domcontentloaded", timeout=45000); time.sleep(1.8)
                info = pg.evaluate("""()=>{const out={};
                  const all=[...document.querySelectorAll('h1,h2,h3,h4,h5,dt,strong,b,span,div,p')];
                  const i=all.findIndex(e=>(e.innerText||'').trim()==='매체 정보');
                  if(i>=0){const root=all[i].closest('section,div'); const t=(root?root.innerText:'').replace(/\\s+/g,' ');
                    out.block=t.slice(0,400);
                    out.links=[...(root||document).querySelectorAll('a')].map(a=>({t:(a.innerText||'').trim().slice(0,20),h:a.href})).filter(x=>x.h&&!/i-boss\\.co\\.kr/.test(x.h)).slice(0,8);}
                  const body=document.body.innerText||'';
                  out.emails=[...new Set(body.match(/[\\w.+-]+@[\\w-]+\\.[\\w.-]+/g)||[])].filter(e=>!/i-boss/.test(e)).slice(0,5);
                  out.phones=[...new Set(body.match(/0\\d{1,2}[-.\\s]?\\d{3,4}[-.\\s]?\\d{4}/g)||[])].filter(p=>!/862-7643/.test(p)).slice(0,5);
                  const m=body.match(/(?:담당자?|매니저|문의)\\s*[:：]?\\s*([가-힣]{2,4}\\s*(?:매니저|팀장|대리|과장|차장|부장|이사|대표|PD|프로)?)/); out.person=m?m[1].trim():null;
                  return out;}""")
                blk = info.get("block") or ""
                m = re.match(r"매체 정보\s+(.+?)\s{1,}(.*)$", blk)
                rec["media"] = (m.group(1) if m else "").strip()[:40] or None
                rec["media_desc"] = (m.group(2) if m else blk)[:200]
                links = info.get("links") or []
                web = next((l["h"] for l in links if l["t"] == "웹사이트"), None) or next((l["h"] for l in links if not any(s in l["h"] for s in SKIP_HOST)), None)
                rec["website"] = web; rec["links"] = links
                rec["page_emails"] = info.get("emails") or []; rec["page_phones"] = info.get("phones") or []; rec["page_person"] = info.get("person")
                print(n, k, rec["media"], "|", (web or "-")[:50], "|", rec["page_emails"][:2], flush=True)
            except Exception as e:
                rec["media_err"] = str(e)[:80]; rec.setdefault("media", None); print(n, k, "ERR", str(e)[:60], flush=True)
            if n % 10 == 0: save()
            time.sleep(0.6)
        pg.close()
    save()

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
PHONE_RE = re.compile(r"(?<!\d)(?:0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}|1[5-9]\d{2}[-.\s]?\d{4})(?!\d)")
BAD_EMAIL = re.compile(r"(example|sentry|wixpress|\.png|\.jpg|\.gif|@2x|noreply|no-reply|webmaster@w3|privacy@|unsubscribe|^(aaa|abc|test|sample|name|email|your|user|id)@|@(aaa|abc|test|sample|email|domain|company)\.)", re.I)
GOOD_EMAIL = re.compile(r"(ad|ads|adsales|biz|business|partner|marketing|mkt|sales|contact|info|pr|media|promotion|hello|cs)", re.I)
def fetch(url, timeout=10):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "ko,en;q=0.8"})
    with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
        raw = r.read(600000); ct = r.headers.get("content-type", "")
        enc = "utf-8"
        m = re.search(r"charset=([\w-]+)", ct);
        if m: enc = m.group(1)
        try: return raw.decode(enc, "ignore"), r.geturl()
        except Exception: return raw.decode("utf-8", "ignore"), r.geturl()
def crawl_site(web):
    """홈 + 광고문의/contact 후보 최대 4페이지에서 이메일·전화 수집"""
    out = {"emails": [], "phones": [], "pages": [], "person": None}
    try: h0, base = fetch(web)
    except Exception as e: out["err"] = str(e)[:60]; return out
    pages = [(base, h0)]
    cand = []
    for m in re.finditer(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', h0, re.I | re.S):
        href, txt = m.group(1), re.sub(r"<[^>]+>", "", m.group(2))
        if re.search(r"광고\s*문의|광고\s*제휴|제휴\s*문의|광고\s*안내|contact|advertis|partnership|inquiry|문의하기|비즈니스", href + " " + txt, re.I):
            u = urllib.parse.urljoin(base, htmlmod.unescape(href))
            if u.startswith("http") and u not in cand and "mailto:" not in u: cand.append(u)
    for u in cand[:4]:
        try: pages.append((u, fetch(u)[0]))
        except Exception: pass
    for u, h in pages:
        text = htmlmod.unescape(h)
        ems = [e for e in EMAIL_RE.findall(text) if not BAD_EMAIL.search(e)]
        ems += [e for e in re.findall(r"mailto:([^\"'?]+)", text)]
        phs = PHONE_RE.findall(re.sub(r"<[^>]+>", " ", text))
        if ems or phs: out["pages"].append(u)
        out["emails"] += ems; out["phones"] += phs
        if not out["person"]:
            pm = re.search(r"(?:광고|제휴)\s*(?:담당자?|문의)\s*[:：]?\s*([가-힣]{2,4}\s*(?:매니저|팀장|대리|과장|차장|부장|이사|대표)?)", re.sub(r"<[^>]+>", " ", text))
            if pm: out["person"] = pm.group(1).strip()
    out["emails"] = clean_emails(out["emails"]); out["phones"] = clean_phones(out["phones"])
    return out
VALID_EMAIL = re.compile(r"^[A-Za-z0-9._%+-]{1,40}@(?:[A-Za-z0-9-]{1,40}\.)+[A-Za-z]{2,10}$")
def clean_emails(lst):
    seen = []
    for e in lst:
        e = re.sub(r"[가-힣]+$", "", e.strip().strip(".,;:)("))  # 'support@x.kr로' 같은 조사 제거
        if not VALID_EMAIL.match(e) or BAD_EMAIL.search(e): continue
        if re.search(r"@v?\d+\.\d+", e) or re.search(r"\.(png|jpg|jpeg|gif|svg|js|css|webp)$", e, re.I): continue
        if e.lower() not in [s.lower() for s in seen]: seen.append(e)
    seen.sort(key=lambda e: (0 if GOOD_EMAIL.search(e.split("@")[0]) else 1, e))
    return seen[:3]
def clean_phones(lst):
    ph = []
    for p_ in lst:
        d = re.sub(r"\D", "", p_)
        if not (9 <= len(d) <= 11): continue
        if d.startswith("02") and len(d) in (9, 10): f = f"02-{d[2:-4]}-{d[-4:]}"
        elif re.match(r"0(3[1-3]|4[1-4]|5[1-5]|6[1-4]|70|80|10|1[1-9])", d) and len(d) in (10, 11): f = f"{d[:3]}-{d[3:-4]}-{d[-4:]}"
        elif re.match(r"1[5-9]\d{2}\d{4}$", d): f = f"{d[:4]}-{d[4:]}"
        else: continue
        if f not in ph: ph.append(f)
    return ph[:2]

# ── 3단계: 브라우저 렌더 크롤 (JS 사이트·봇차단 사이트) ─────────────────────────
OBF_RE = re.compile(r"([A-Za-z0-9._%+-]{1,40})\s*[\[(]\s*(?:at|골뱅이)\s*[\])]\s*([A-Za-z0-9-]{1,40}(?:\s*[\[(]\s*(?:dot|닷)\s*[\])]\s*[A-Za-z0-9-]{1,40}|\.[A-Za-z0-9.-]{2,40}))", re.I)
def deobf(text):
    out = []
    for a, b in OBF_RE.findall(text):
        b = re.sub(r"\s*[\[(]\s*(?:dot|닷)\s*[\])]\s*", ".", b, flags=re.I); out.append(f"{a}@{b}")
    return out
def stage3():
    from playwright.sync_api import sync_playwright
    todo = [k for k, v in STATE.items() if v.get("website") and not any(x in v["website"] for x in SKIP_HOST)
            and "render" not in v and not (v.get("site") or {}).get("emails")]
    print("stage3 todo", len(todo), flush=True)
    with sync_playwright() as p:
        b = p.chromium.connect_over_cdp("http://127.0.0.1:9223"); ctx = b.contexts[0]; pg = ctx.new_page()
        pg.set_default_timeout(25000)
        for n, k in enumerate(todo, 1):
            v = STATE[k]; res = {"emails": [], "phones": [], "pages": [], "person": None}
            try:
                pg.goto(v["website"], wait_until="domcontentloaded"); time.sleep(3)
                def grab():
                    d = pg.evaluate("""()=>({t:document.body?document.body.innerText:'', m:[...document.querySelectorAll('a[href^="mailto:"]')].map(a=>a.getAttribute('href').slice(7).split('?')[0]),
                       tel:[...document.querySelectorAll('a[href^="tel:"]')].map(a=>a.getAttribute('href').slice(4)), h:document.documentElement.outerHTML.slice(0,400000)})""")
                    text = d["t"] + " " + d["h"]
                    ems = EMAIL_RE.findall(text) + d["m"] + deobf(d["t"])
                    phs = PHONE_RE.findall(d["t"]) + d["tel"]
                    pm = re.search(r"(?:광고|제휴)\s*(?:담당자?|문의)\s*[:：]?\s*([가-힣]{2,4}\s*(?:매니저|팀장|대리|과장|차장|부장|이사|대표)?)", d["t"])
                    return ems, phs, (pm.group(1).strip() if pm else None)
                ems, phs, person = grab(); res["emails"] += ems; res["phones"] += phs; res["person"] = person
                if ems: res["pages"].append(pg.url)
                # 광고문의/contact 링크 최대 3개
                links = pg.evaluate("""()=>[...document.querySelectorAll('a')].map(a=>({t:(a.innerText||'').trim().slice(0,30),h:a.href})).filter(x=>x.h&&x.h.startsWith('http')&&/광고\s*문의|광고\s*제휴|제휴\s*문의|광고\s*안내|contact|advertis|partnership|inquiry|문의하기|비즈니스|회사소개|company|about/i.test(x.t+' '+x.h))""")
                seen = set(); cnt = 0
                for l in links:
                    if l["h"] in seen or cnt >= 3: continue
                    seen.add(l["h"]); cnt += 1
                    try:
                        pg.goto(l["h"], wait_until="domcontentloaded"); time.sleep(2.5)
                        e2, p2, per2 = grab(); res["emails"] += e2; res["phones"] += p2; res["person"] = res["person"] or per2
                        if e2: res["pages"].append(l["h"])
                    except Exception: pass
                res["emails"] = clean_emails(res["emails"]); res["phones"] = clean_phones(res["phones"])
            except Exception as e: res["err"] = str(e)[:60]
            v["render"] = res
            print(n, k, v.get("media"), "|", res["emails"], res["phones"], res.get("err", ""), flush=True)
            if n % 10 == 0: save()
        pg.close()
    save()


# ── 4단계: 검색엔진 보완 (DuckDuckGo HTML) — 사이트 없거나 렌더 크롤로도 이메일 없는 매체 ─────
def ddg(q):
    u = "https://html.duckduckgo.com/html/?q=" + urllib.parse.quote(q)
    h, _ = fetch(u, timeout=15)
    res = []
    for m in re.finditer(r'<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)</a>.*?<a[^>]+class="result__snippet"[^>]*>(.*?)</a>', h, re.S):
        href = htmlmod.unescape(m.group(1))
        mm = re.search(r"uddg=([^&]+)", href)
        if mm: href = urllib.parse.unquote(mm.group(1))
        res.append((href, re.sub(r"<[^>]+>", "", m.group(2)), re.sub(r"<[^>]+>", "", m.group(3))))
    return res[:6]
def stage4():
    todo = [k for k, v in STATE.items() if "search" not in v and not (v.get("site") or {}).get("emails") and not (v.get("render") or {}).get("emails")
            and not v.get("page_emails")]
    print("stage4 todo", len(todo), flush=True)
    for n, k in enumerate(todo, 1):
        v = STATE[k]; name = v.get("media") or v["name"][:30]; res = {"emails": [], "phones": [], "src": []}
        try:
            for q in (f"{name} 광고 문의 이메일", f"{name} 광고제휴 문의"):
                hits = ddg(q)
                for href, title, snip in hits:
                    text = title + " " + snip
                    ems = clean_emails(EMAIL_RE.findall(text) + deobf(text)); phs = clean_phones(PHONE_RE.findall(text))
                    if ems or phs: res["emails"] += ems; res["phones"] += phs; res["src"].append(href)
                # 스니펫에 없으면 상위 결과 페이지 3개 직접 열어서 추출 (매체 도메인·비즈니스 페이지 우선)
                if not res["emails"]:
                    site_host = urllib.parse.urlparse(v.get("website") or "").netloc.replace("www.", "")
                    ranked = sorted([h for h in hits if not any(x in h[0] for x in ("i-boss", "blog.naver", "youtube", "instagram", "facebook", "namu.wiki", "wikipedia"))],
                                    key=lambda h: (0 if site_host and site_host in h[0] else 1))
                    for href, title, snip in ranked[:3]:
                        try:
                            ph, _ = fetch(href, timeout=10); t2 = htmlmod.unescape(ph); plain = re.sub(r"<[^>]+>", " ", t2)
                            ems = clean_emails(EMAIL_RE.findall(t2) + re.findall(r"mailto:([^\"'?]+)", t2) + deobf(plain)); phs = clean_phones(PHONE_RE.findall(plain))
                            if ems or phs: res["emails"] += ems; res["phones"] += phs; res["src"].append(href)
                            if res["emails"]: break
                        except Exception: pass
                if res["emails"]: break
                time.sleep(1.2)
            res["emails"] = clean_emails(res["emails"]); res["phones"] = clean_phones(res["phones"])
        except Exception as e: res["err"] = str(e)[:60]
        v["search"] = res; print(n, k, name, "|", res["emails"], res["phones"], res.get("err", ""), flush=True)
        if n % 10 == 0: save()
        time.sleep(1.5)
    save()

def stage2():
    todo = [k for k, v in STATE.items() if v.get("website") and "site" not in v and not any(s in v["website"] for s in SKIP_HOST)]
    print("stage2 todo", len(todo), flush=True)
    def job(k):
        return k, crawl_site(STATE[k]["website"])
    with cf.ThreadPoolExecutor(8) as ex:
        for n, (k, res) in enumerate(ex.map(job, todo), 1):
            STATE[k]["site"] = res
            print(n, k, STATE[k].get("media"), "|", res.get("emails"), res.get("phones"), res.get("err", ""), flush=True)
            if n % 10 == 0: save()
    save()
def merge():
    items = []
    for it in SRC["items"]:
        k = key(it); v = STATE.get(k, {}); o = dict(it)
        site = v.get("site") or {}; rend = v.get("render") or {}; srch = v.get("search") or {}
        emails = clean_emails(v.get("page_emails", []) + site.get("emails", []) + rend.get("emails", []) + srch.get("emails", []))
        phones = clean_phones(v.get("page_phones", []) + site.get("phones", []) + rend.get("phones", []) + srch.get("phones", []))
        o["contact_email"] = ", ".join(emails) if emails else o.get("contact_email")
        o["contact_phone"] = ", ".join(phones) if phones else o.get("contact_phone")
        o["contact_site"] = v.get("website")
        o["contact_person"] = v.get("page_person") or site.get("person") or rend.get("person")
        o["media"] = v.get("media"); o["media_desc"] = v.get("media_desc")
        o["contact_src"] = ("아이보스 페이지" if v.get("page_emails") or v.get("page_phones") else "") or ("매체 웹사이트" if site.get("emails") or site.get("phones") or rend.get("emails") or rend.get("phones") else "") or ("검색" if srch.get("emails") or srch.get("phones") else "") or ("웹사이트만" if v.get("website") else "")
        items.append(o)
    out = dict(SRC); out["items"] = items; out["contacts_at"] = time.strftime("%Y-%m-%d %H:%M")
    (DOCS / "iboss-merged.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    n_e = sum(1 for i in items if i.get("contact_email")); n_p = sum(1 for i in items if i.get("contact_phone")); n_w = sum(1 for i in items if i.get("contact_site"))
    print(f"merged {len(items)} | email {n_e} | phone {n_p} | website {n_w}")
if __name__ == "__main__":
    a = sys.argv[1:] or ["--stage1", "--stage2", "--merge"]
    if "--stage1" in a: stage1()
    if "--stage2" in a: stage2()
    if "--stage3" in a: stage3()
    if "--stage4" in a: stage4()
    if "--merge" in a: merge()
