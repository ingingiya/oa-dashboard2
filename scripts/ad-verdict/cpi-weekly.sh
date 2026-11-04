#!/bin/zsh
# 단가 비교 PNG 주간 갱신(26): 월 09:30 — 7일·30일 PNG 생성 → oa-adcost(이사님 현황판) /cpi/ 에 올리고 배포
cd /Users/kirby/oa-dashboard2/scripts/ad-verdict || exit 1
export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin
python3 naver_sa.py > naver_sa.json && node meta_daily.mjs > meta_daily.json && python3 gfa_pp.py > gfa.json
python3 cpi_png.py 7 && python3 cpi_png.py 30
mkdir -p /Users/kirby/oa-adcost/cpi
cp ~/Desktop/광고단가비교_플렌티_프리온_1104.png /Users/kirby/oa-adcost/cpi/7d.png 2>/dev/null
cp ~/Desktop/광고단가비교_플렌티_프리온_1104_30일.png /Users/kirby/oa-adcost/cpi/30d.png 2>/dev/null
cd /Users/kirby/oa-adcost && npx vercel deploy --prod --yes 2>&1 | grep -E "Aliased|Error"
