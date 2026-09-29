#!/usr/bin/env python3
"""테스트존 승자 판정 — [테스트존] 세트들의 최근 7일 성과를 비교해
승자(전환 세트 승격 추천)와 탈락(중지 추천)을 매일 9:45 텔레그램으로 알림.

판정 (트래픽 최적화 세트라 LPV 단가·CTR 기준):
- 데이터 충분: 지출 ≥ 15,000원
- 승자: LPV 단가 최저 (동률이면 CTR 높은 쪽). 2위보다 20% 이상 좋아야 확정, 아니면 "더 지켜보기"
- 탈락: 지출 ≥ 20,000원인데 CTR < 0.5% 또는 LPV 단가가 승자의 2.5배 이상
활성 테스트존 세트가 없으면 알림 생략 (조용).
"""
import re, json, urllib.request
from pathlib import Path

V = "v19.0"
env = (Path.home() / "oa-dashboard2" / ".env.local").read_text() if (Path.home() / "oa-dashboard2" / ".env.local").exists() else ""
env += (Path.home() / "oa-detail-app" / ".env.local").read_text()
TOKEN = re.search(r"META_ACCESS_TOKEN=\"?([^\"\n]+)\"?", env).group(1).strip('"')
ACCT = re.search(r"META_AD_ACCOUNT_ID=\"?(?:act_)?([0-9]+)\"?", env).group(1)

def graph(path, **params):
    q = urllib.parse.urlencode({**params, "access_token": TOKEN})
    return json.load(urllib.request.urlopen(f"https://graph.facebook.com/{V}/{path}?{q}", timeout=60))

import urllib.parse

def tg(msg):
    tenv = (Path.home() / ".claude" / "channels" / "telegram" / ".env").read_text()
    tok = re.search(r"BOT_TOKEN=(\S+)", tenv).group(1)
    urllib.request.urlopen(urllib.request.Request(
        f"https://api.telegram.org/bot{tok}/sendMessage",
        data=json.dumps({"chat_id": "8704535307", "text": msg}).encode(),
        headers={"Content-Type": "application/json"}), timeout=30)

def main():
    adsets = graph(f"act_{ACCT}/adsets", fields="name,status,effective_status", limit="200")
    tests = [a for a in adsets.get("data", []) if a["name"].startswith("[테스트존]") and a.get("effective_status") == "ACTIVE"]
    if not tests:
        print("활성 테스트존 없음 — 알림 생략"); return

    rows = []
    for a in tests:
        ins = graph(f'{a["id"]}/insights', date_preset="last_7d",
                    fields="spend,ctr,actions,impressions").get("data", [])
        i = ins[0] if ins else {}
        spend = float(i.get("spend", 0) or 0)
        ctr = float(i.get("ctr", 0) or 0)
        lpv = next((int(x["value"]) for x in i.get("actions", []) if x["action_type"] == "landing_page_view"), 0)
        rows.append({"name": a["name"].replace("[테스트존] ", ""), "spend": spend, "ctr": ctr,
                     "lpv": lpv, "cpl": spend / lpv if lpv else None})

    ready = [r for r in rows if r["spend"] >= 15000 and r["cpl"]]
    lines = [f"🧪 테스트존 소재 판정 (7일, 활성 {len(rows)}개)"]
    if len(ready) >= 2:
        ready.sort(key=lambda r: (r["cpl"], -r["ctr"]))
        w, second = ready[0], ready[1]
        if w["cpl"] * 1.2 <= second["cpl"]:
            lines.append(f"🏆 승자: {w['name']} — LPV {w['cpl']:,.0f}원 · CTR {w['ctr']:.2f}%")
            lines.append("→ 전환 세트로 승격 추천 (광고관리자에서 전환 캠페인에 복제)")
        else:
            lines.append(f"⏳ 1위 {w['name']} (LPV {w['cpl']:,.0f}원) vs 2위 {second['name']} ({second['cpl']:,.0f}원) — 격차 20% 미만, 더 지켜보기")
        for r in rows:
            if r["spend"] >= 20000 and (r["ctr"] < 0.5 or (r["cpl"] and r["cpl"] >= ready[0]["cpl"] * 2.5)):
                lines.append(f"🗑 중지 추천: {r['name']} — CTR {r['ctr']:.2f}% · LPV {(r['cpl'] or 0):,.0f}원")
    else:
        for r in rows:
            st = f"지출 {r['spend']:,.0f}원 · CTR {r['ctr']:.2f}%" + (f" · LPV {r['cpl']:,.0f}원" if r["cpl"] else "")
            lines.append(f"· {r['name']}: {st} (데이터 수집 중)")
        lines.append("판정까지 세트당 지출 15,000원 필요")
    tg("\n".join(lines))
    print("\n".join(lines))

if __name__ == "__main__":
    main()
