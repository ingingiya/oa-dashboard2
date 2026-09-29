#!/usr/bin/env python3
"""i-boss (아이보스) 광고상품 디렉토리 크롤러.

사용:  python3 scripts/iboss-crawl.py            # 전체 (목록 → 상세 → JSON + 요약)
       python3 scripts/iboss-crawl.py --list     # 목록만
       python3 scripts/iboss-crawl.py --summary  # 기존 JSON으로 요약만 재생성
메모:
 - curl은 403. Playwright(channel=chrome, headless) + 데스크톱 UA로 통과.
 - 기본 목록(/ab-7654)은 34개 고정 노출·페이지네이션 없음. 검색어 `%`(LIKE 와일드카드)로 전체가 나오며
   페이지 파라미터는 PB_1585563853=N.
 - 상세 페이지: h1 이름, .pd-info(광고비 산정 방식·비용 / 지원 광고소재 방식 / 타기팅 지원 / 적합 업종 / 적정 예산),
   .goods_tag .hashtag 태그. 소개서 다운로드는 로그인 필수(/ab-login) → brochure_url에 그대로 기록.
 - 체크포인트: docs/iboss-crawl-state.json (중단 후 재실행 시 이어서 진행).
"""
import json, re, sys, time, os
from datetime import date
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright

BASE = "https://www.i-boss.co.kr"
START = f"{BASE}/ab-7654"
SEARCH = f"{BASE}/ab-7654?query=%25&PB_1585563853={{n}}"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_JSON = os.path.join(ROOT, "docs", "iboss-ad-products.json")
OUT_MD = os.path.join(ROOT, "docs", "iboss-ad-products-summary.md")
STATE = os.path.join(ROOT, "docs", "iboss-crawl-state.json")
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")
MAX_ITEMS = 600
NAV_WAIT = 2.5
DETAIL_GAP = 1.0

def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)

def goto(pg, url):
    for attempt in range(3):
        try:
            pg.goto(url, wait_until="domcontentloaded", timeout=60000)
            time.sleep(NAV_WAIT)
            return True
        except Exception as e:
            log("nav retry", url, e)
            time.sleep(5)
    return False

# ---------- 목록 ----------
def parse_cells(pg):
    """목록 페이지의 상품 카드 → [{url,name,category}]"""
    return pg.evaluate("""() => {
      const out=[];
      document.querySelectorAll('a[href^="/ab-7684-"]').forEach(a=>{
        const p=a.querySelector('p'); const cat=a.querySelector('div>span');
        const nm = p ? p.innerText.trim() : (a.querySelector('span.ellipsis-1,span:not(.p_img):not(.updated)')||{innerText:''}).innerText.trim();
        if(!nm) return;
        out.push({url:a.getAttribute('href'), name:nm, category: cat? cat.innerText.trim():''});
      });
      return out;}""")

def crawl_list(pg):
    """목록 수집.
    사이트 페이지네이션(PB_1585563853=2 이상)은 실제로 빈 페이지를 반환(사이트 버그)하고, 검색 1페이지 15장은
    요청마다 무작위 순서라서 `query=%`를 반복 샘플링 + 보조 검색어로 합집합을 모은다.
    페이지 링크 수(예: 11페이지)×15 = 상한선으로 사용."""
    items = {}
    def add(cells, src):
        n = 0
        for c in cells:
            u = urljoin(BASE, c["url"]).split("?")[0]
            if u not in items:
                items[u] = {"url": u, "name": c["name"], "category": c["category"], "sources": [src]}
                n += 1
            else:
                if not items[u]["category"] and c["category"]:
                    items[u]["category"] = c["category"]
                if src not in items[u]["sources"]:
                    items[u]["sources"].append(src)
        return n
    goto(pg, START)
    add(parse_cells(pg), "home")  # 둘러보기 + 오늘 인기 + 신규 광고상품
    log("home items:", len(items))
    goto(pg, SEARCH.format(n=1))
    pages = max([int(x) for x in re.findall(r'title="(\d+) 페이지로 이동"', pg.content())] + [1])
    upper = pages * 15
    lower = (pages - 1) * 15 + 1
    log(f"search pagination shows {pages}+ page links (block of 10, upper bound unknown)")
    stale = 0
    reqs = 0
    extra = ["광고", "앱", "디스플레이", "옥외광고", "콘텐츠", "동영상", "검색", "인플루언서", "이메일", "배너", "커뮤니티", "여성", "뷰티", "헬스", "쇼핑", "타겟", "패키지", "네이티브", "리워드", "DA"]
    seq = []
    for i in range(60):
        seq.append("%25")
        if i % 3 == 2 and extra: seq.append(extra.pop(0))
    seq += ["%25"] * 600
    for q in seq:
        url = f"{BASE}/ab-7654?query={q}&PB_1585563853=1"
        if not goto(pg, url): continue
        reqs += 1
        cells = [c for c in parse_cells(pg) if c["category"]]  # 카드형(카테고리 태그 보유)만
        new = add(cells, f"search:{q}")
        stale = 0 if new else stale + 1
        log(f"sample {reqs} q={q}: {len(cells)} cells, {new} new, total {len(items)}, stale {stale}")
        # 페이저는 10개 블록만 보여줘 상한 추정 불가 → 연속 25회 신규 0이면 종료
        if stale >= 25: break
        if len(items) >= MAX_ITEMS: break
    return list(items.values()), pages

# ---------- 상세 ----------
def _num(s):
    return int(s.replace(",", ""))

AMT = r'(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(만\s*원|천\s*원|억\s*원|원)'
RANGE = re.compile(r'(\d[\d,]*(?:\.\d+)?)\s*[~∼～\-–]\s*(\d[\d,]*(?:\.\d+)?)\s*(만\s*원|천\s*원|억\s*원|원)')

def _range_fix(m):
    a, b, unit = m.group(1), m.group(2), m.group(3)
    ad, bd = a.replace(",", ""), b.replace(",", "")
    # '2~300만원' 같은 축약(앞자리만 표기) → 200~300만원
    if ad.isdigit() and bd.isdigit() and len(ad) < len(bd) and int(ad) * 10 ** (len(bd) - len(ad)) < int(bd):
        ad = str(int(ad) * 10 ** (len(bd) - len(ad)))
    return f"{ad}{unit} ~ {bd}{unit}"

def amounts(text):
    """텍스트에서 원화 금액(정수) 리스트. '3,500 ~ 4,000만원'처럼 앞 숫자에 단위가 없는 범위는 단위를 전파."""
    text = RANGE.sub(_range_fix, text)
    res = []
    for m in re.finditer(AMT, text):
        v = float(m.group(1).replace(",", ""))
        unit = m.group(2).replace(" ", "")
        if unit.startswith("만"): v *= 10000
        elif unit.startswith("천"): v *= 1000
        elif unit.startswith("억"): v *= 100000000
        res.append(int(v))
    return res

def price_for(key, lines):
    """key(CPC/CPM/CPV 등)가 포함된 줄에서 키워드 '뒤'에 오는 첫 금액. 없으면 None
    (예: '최소 CPM 100원 / CPC 10원' → CPC=10)"""
    pat = re.compile(key, re.I)
    for ln in lines:
        m = pat.search(ln)
        if not m:
            continue
        fixed = RANGE.sub(_range_fix, ln)
        m2 = pat.search(fixed) or m
        after = [ (mm.start(), mm) for mm in re.finditer(AMT, fixed) if mm.start() >= m2.end() ]
        if after:
            return amounts(after[0][1].group(0))[0]
    return None

def parse_prices(price_text, intro_text, budget_text):
    lines = [l.strip() for l in re.split(r'[\n\r]|(?<=[.;])\s', price_text + "\n" + intro_text) if l.strip()]
    lines = [re.sub(r'\s+', ' ', l) for l in lines]
    cpc = price_for(r'\bCPC\b|클릭당|클릭 당', lines)
    cpm = price_for(r'\bCPM\b|1,?000회\s*노출|노출\s*1,?000', lines)
    cpv = price_for(r'\bCPV\b|조회당|시청당|재생당', lines)
    flat = price_for(r'\bCPT\b|\bCPP\b|정액|구좌|/\s*(월|주|일)|(월|주|일)\s*[\d,]+\s*(만\s*)?원|\d\s*(개월|주|일|달)\b|\d\s*(개월|주|일|달)\s*/|일주일|한\s*달', lines)
    minb = None
    if budget_text:
        a = amounts(budget_text)
        minb = a[0] if a else None
    if minb is None:
        minb = price_for(r'최소\s*(집행|입금|예산|금액|비용|단위|광고비)|최소집행|미니멈|minimum', lines)
    return cpc, cpm, cpv, flat, minb

def crawl_detail(pg, url):
    if not goto(pg, url):
        return None
    if "ab-login" in pg.url:
        return {"error": "login redirect"}
    d = pg.evaluate("""() => {
      const q=s=>document.querySelector(s); const t=e=>e?e.innerText.trim():'';
      const info={};
      document.querySelectorAll('.pd-info > div').forEach(d=>{const k=t(d.querySelector('p')); info[k]=t(d.querySelector('span'));});
      const tags=[...document.querySelectorAll('.goods_tag .hashtag a')].map(a=>a.innerText.trim());
      const dn=q('.detail_profile .dn a');
      const media=t(q('.media_info, .goods_box.box3'));
      return {name:t(q('.adproduct-title h1')||q('h1')), intro:t(q('.goods_intro')), info, tags,
              brochure: dn? dn.getAttribute('href'):null, brochure_txt: dn? dn.innerText.trim():'', media};}""")
    return d

def build_item(base, d):
    info = d.get("info", {})
    price_text = info.get("광고비 산정 방식·비용", "") or ""
    creative = info.get("지원 광고소재 방식", "") or ""
    target = info.get("타기팅 지원", "") or ""
    biz = info.get("적합 업종", "") or ""
    budget = info.get("적정 예산", "") or ""
    intro = d.get("intro", "") or ""
    cpc, cpm, cpv, flat, minb = parse_prices(price_text, intro, budget)
    raw = re.sub(r'\s+', ' ', price_text).strip()
    if budget:
        raw = (raw + " | 적정예산: " + re.sub(r'\s+', ' ', budget)).strip(" |")
    # 본문에 금액이 있으면 첫 금액 문장 보강
    if not amounts(raw):
        for ln in intro.splitlines():
            if amounts(ln) and re.search(r'CPC|CPM|CPV|CPT|정액|원', ln):
                raw = (raw + " | " + re.sub(r'\s+', ' ', ln.strip())).strip(" |")
                break
    has_price_text = bool(amounts(raw)) or bool(re.search(r'CPC|CPM|CPV|CPT|CPA|CPI|정액|협의|입찰|과금', raw))
    if not has_price_text:
        raw = "소개서 참조"
    brochure = d.get("brochure")
    if brochure:
        brochure = urljoin(BASE, brochure)
        if "ab-login" in brochure:
            brochure = brochure + "  (로그인 필요: 소개서 다운로드)"
    cat = base.get("category") or ""
    platform = ", ".join([x for x in [cat.lstrip("#"), re.sub(r'[✅\n]+', '/', creative).strip("/ ")] if x])
    audience = re.sub(r'[✅\n]+', '/', target).strip("/ ")
    if biz:
        audience = (audience + " | 업종: " + re.sub(r'[✅\n]+', '/', biz).strip("/ ")).strip(" |")
    audience = re.sub(r'\s*/\s*', '/', audience)[:200]
    return {
        "name": d.get("name") or base["name"],
        "category": cat,
        "tags": d.get("tags", []),
        "platform_type": platform[:200],
        "audience": audience,
        "url": base["url"],
        "cpc": cpc, "cpm": cpm, "cpv": cpv,
        "flat_price": flat, "min_budget": minb,
        "pricing_text": raw[:300],
        "brochure_url": brochure,
    }

# ---------- 요약 ----------
BEAUTY_KW = re.compile(r'뷰티|미용|화장|코스메틱|헬스|건강|다이어트|피부|여성|주부|2030|3040|20대|30대|40대|라이프스타일|커뮤니티|맘|육아|병의원|약국|피트니스|운동|헬스케어|웰니스|쇼핑|커머스|인플루언서|체험단|리뷰', re.I)

def write_summary(data):
    items = data["items"]
    from collections import Counter
    cats = Counter(i["category"] or "(미분류)" for i in items)
    cpc_items = sorted([i for i in items if i["cpc"]], key=lambda x: x["cpc"])[:20]
    cpm_items = sorted([i for i in items if i["cpm"]], key=lambda x: x["cpm"])[:20]
    n_cpc = sum(1 for i in items if i["cpc"])
    n_cpm = sum(1 for i in items if i["cpm"])
    n_any = sum(1 for i in items if any(i[k] for k in ("cpc","cpm","cpv","flat_price","min_budget")))
    n_broch = sum(1 for i in items if i["pricing_text"] == "소개서 참조")
    def score(i):
        blob = " ".join([i["name"], i["audience"], " ".join(i.get("tags", [])), i["category"]])
        return len(set(BEAUTY_KW.findall(blob)))
    rel = sorted([(score(i), i) for i in items if score(i) >= 2], key=lambda x: -x[0])
    L = []
    L.append(f"# 아이보스 광고상품 디렉토리 크롤 요약 ({data['crawled']})\n")
    L.append(f"- 소스: {data['source']}  \n- 총 상품 수: **{len(items)}**  \n- 목록 페이지 수: 사이트 페이저는 {data.get('pages')}+ 링크를 보이지만 2페이지부터 빈 응답(사이트 버그) → 검색 `query=%` 1페이지(무작위 15개)를 반복 샘플링해 합집합 수집  \n"
             f"- 명시적 CPC 있음: {n_cpc} / CPM 있음: {n_cpm} / 어떤 금액이든 파싱됨: {n_any} / 텍스트 가격 없음(소개서 참조): {n_broch}\n")
    L.append("## 카테고리별 수\n")
    for c, n in cats.most_common():
        L.append(f"- {c}: {n}")
    L.append("\n## CPC 저렴한 순 20\n\n| 상품 | CPC(원) | 카테고리 |\n|---|---:|---|")
    for i in cpc_items:
        L.append(f"| [{i['name']}]({i['url']}) | {i['cpc']:,} | {i['category']} |")
    L.append("\n## CPM 저렴한 순 20\n\n| 상품 | CPM(원) | 카테고리 |\n|---|---:|---|")
    for i in cpm_items:
        L.append(f"| [{i['name']}]({i['url']}) | {i['cpm']:,} | {i['category']} |")
    L.append("\n## 뷰티/헬스 소형가전 브랜드(뷰티가전·구강가전·안마기, 여성 20~40대) 관련 후보\n")
    L.append("키워드(뷰티·헬스·여성·2030/3040·라이프스타일·커뮤니티·병의원·약국·쇼핑 등) 2개 이상 매칭 기준, 매칭 수 내림차순.\n")
    L.append("| 상품 | 카테고리 | 매칭 | 가격 요약 |\n|---|---|---:|---|")
    for s, i in rel:
        pr = []
        for k, lab in (("cpc","CPC"),("cpm","CPM"),("cpv","CPV"),("flat_price","정액"),("min_budget","최소/적정")):
            if i[k]: pr.append(f"{lab} {i[k]:,}")
        L.append(f"| [{i['name']}]({i['url']}) | {i['category']} | {s} | {', '.join(pr) or i['pricing_text'][:60]} |")
    if data.get("note"):
        L.append(f"\n> {data['note']}")
    open(OUT_MD, "w").write("\n".join(L) + "\n")
    log("summary written", OUT_MD)

# ---------- main ----------
def main():
    if "--summary" in sys.argv:
        write_summary(json.load(open(OUT_JSON))); return
    if "--rebuild" in sys.argv:  # 상태 파일로 JSON/요약 재생성(파서 수정 후)
        state = json.load(open(STATE))
        finalize(state["list"][:MAX_ITEMS], state["details"], state["pages"], ""); return
    state = json.load(open(STATE)) if os.path.exists(STATE) else {}
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True)
        pg = b.new_page(user_agent=UA, viewport={"width": 1280, "height": 900})
        if not state.get("list"):
            lst, pages = crawl_list(pg)
            state = {"list": lst, "pages": pages, "details": {}}
            json.dump(state, open(STATE, "w"), ensure_ascii=False, indent=1)
        lst, pages = state["list"], state["pages"]
        log("list total", len(lst), "pages", pages)
        if "--list" in sys.argv:
            b.close(); return
        note = ""
        if len(lst) > MAX_ITEMS:
            note = f"목록 {len(lst)}개 중 {MAX_ITEMS}개에서 중단(상한)."
            lst = lst[:MAX_ITEMS]
        details = state.setdefault("details", {})
        for k, base in enumerate(lst):
            if base["url"] in details: continue
            d = crawl_detail(pg, base["url"])
            if d is None or d.get("error"):
                log("FAIL", base["url"], d); details[base["url"]] = {"error": str(d)}
            else:
                details[base["url"]] = d
            if k % 10 == 0:
                log(f"detail {k+1}/{len(lst)}", base["name"])
                json.dump(state, open(STATE, "w"), ensure_ascii=False)
            time.sleep(DETAIL_GAP)
        json.dump(state, open(STATE, "w"), ensure_ascii=False)
        b.close()
    finalize(lst, details, pages, note)

def finalize(lst, details, pages, note):
    items = []
    for base in lst:
        d = details.get(base["url"]) or {}
        if d.get("error"):
            items.append({"name": base["name"], "category": base.get("category",""), "tags": [], "platform_type": base.get("category","").lstrip("#"),
                          "audience": "", "url": base["url"], "cpc": None, "cpm": None, "cpv": None, "flat_price": None,
                          "min_budget": None, "pricing_text": "소개서 참조", "brochure_url": None, "error": d["error"]})
        else:
            items.append(build_item(base, d))
    data = {"source": START, "crawled": date.today().isoformat(), "count": len(items), "pages": pages, "note": note, "items": items}
    json.dump(data, open(OUT_JSON, "w"), ensure_ascii=False, indent=1)
    log("json written", OUT_JSON, len(items))
    write_summary(data)

if __name__ == "__main__":
    main()
