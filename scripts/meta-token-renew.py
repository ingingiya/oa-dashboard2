#!/usr/bin/env python3
"""메타 장기 토큰 갱신 헬퍼 — 단기 토큰을 60일 토큰으로 교환해 .env.local에 저장.

절차:
1. developers.facebook.com → Graph API 탐색기 → 앱 "광고 뷰티팀" 선택
   → ads_read, ads_management 권한으로 토큰 생성 (단기 토큰 복사)
2. 앱 설정 > 기본 설정에서 앱 시크릿 코드 확인
3. 실행: python3 meta-token-renew.py <단기토큰> <앱시크릿>

완료 후 Vercel 반영 (프로드 메타 기능들 복구):
  npx vercel env rm META_ACCESS_TOKEN production
  npx vercel env add META_ACCESS_TOKEN production   # 새 토큰 붙여넣기
  npx vercel redeploy https://oa-dashboard2.vercel.app
"""
import json, re, sys, urllib.parse, urllib.request
from pathlib import Path

APP_ID = "4378436105725902"  # 광고 뷰티팀
ENV = Path(__file__).resolve().parent.parent / ".env.local"

if len(sys.argv) < 3:
    sys.exit(__doc__)
short_token, secret = sys.argv[1], sys.argv[2]

url = ("https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token"
       f"&client_id={APP_ID}&client_secret={secret}"
       f"&fb_exchange_token={urllib.parse.quote(short_token)}")
d = json.load(urllib.request.urlopen(url, timeout=60))
token = d.get("access_token")
if not token:
    sys.exit(f"교환 실패: {d}")
print(f"장기 토큰 발급 성공 (expires_in={d.get('expires_in')}초 ≈ {int(d.get('expires_in', 0) / 86400)}일)")

text = ENV.read_text()
if re.search(r"^META_ACCESS_TOKEN=", text, re.M):
    text = re.sub(r"^META_ACCESS_TOKEN=.*$", f"META_ACCESS_TOKEN={token}", text, flags=re.M)
else:
    text += f"\nMETA_ACCESS_TOKEN={token}\n"
ENV.write_text(text)
print(f".env.local 갱신 완료. Vercel 반영은 위 사용법의 vercel env 명령 참고")
