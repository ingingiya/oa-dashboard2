#!/usr/bin/env python3
"""시즌 소재 캘린더 — 다가오는 커머스 행사 D-30/14/7/3에 텔레그램 알림 + 소재 준비 제안.
매일 08:20 실행. 해당 D-day가 아니면 조용히 종료.
"""
import re, json, datetime, urllib.request
from pathlib import Path

# (날짜, 행사명, 소재 제안 — 광고 스튜디오 학습 레퍼런스 기준)
EVENTS = [
    ("2026-09-25", "추석 연휴", "3D 기프트박스·명절 정석(보름달)·장바구니 사전담기 — 선물세트 소재는 D-21부터 집행이 정석"),
    ("2026-10-02", "10월 황금연휴", "여행/휴대 소구 — 퀵롤차저·클린이포터블 휴대 컷"),
    ("2026-11-11", "빼빼로데이·광군제", "커플/선물 소구 + 벌룬 % 타이포 특가"),
    ("2026-11-19", "수능", "수험생 선물·수고했어 소구 — 마사지기·구강케어"),
    ("2026-11-27", "블랙프라이데이", "마커 벅벅 이중 취소선·홀로그램 오픈런·시말서 패러디 — 연중 최대 할인 톤"),
    ("2026-12-25", "크리스마스", "3D 기프트박스·봉투 개봉 콜라주 — 선물 포장 소구"),
    ("2027-01-01", "새해 다짐 시즌", "루틴 소구 (몬드리안 아침/점심/저녁·전후 2분할) — 구강케어 새해 다짐 수요"),
    ("2027-02-07", "설 연휴", "명절 선물세트 — 추석 소재 리스킨"),
    ("2027-02-14", "발렌타인데이", "커플 선물 — 컬러웨이 A/B (핑크)"),
    ("2027-03-14", "화이트데이", "커플 선물 리스킨"),
    ("2027-05-08", "어버이날", "효도템 소구 — 안마기·구강케어, 카톡 고민형(부모님 걱정 버전)"),
]
FIRE = {30, 14, 7, 3}

def tg(msg):
    tenv = (Path.home() / ".claude" / "channels" / "telegram" / ".env").read_text()
    tok = re.search(r"BOT_TOKEN=(\S+)", tenv).group(1)
    urllib.request.urlopen(urllib.request.Request(
        f"https://api.telegram.org/bot{tok}/sendMessage",
        data=json.dumps({"chat_id": "8704535307", "text": msg}).encode(),
        headers={"Content-Type": "application/json"}), timeout=30)

def main():
    today = datetime.date.today()
    lines = []
    for d, name, tip in EVENTS:
        dd = (datetime.date.fromisoformat(d) - today).days
        if dd in FIRE:
            lines.append(f"📅 {name} D-{dd} ({d})\n→ 추천 소재: {tip}")
    if lines:
        tg("⏰ 시즌 소재 준비 알림\n\n" + "\n\n".join(lines)
           + "\n\n광고 스튜디오 [학습] 레퍼런스에서 골라 바로 만들 수 있어요")
        print("\n".join(lines))
    else:
        print("오늘 해당 D-day 없음")

if __name__ == "__main__":
    main()
