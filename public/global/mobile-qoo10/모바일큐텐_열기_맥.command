#!/bin/zsh
# 모바일 큐텐 실시간 보기 (맥) — 크롬을 아이폰 모드로 따로 띄우고 일본어→한국어 자동번역. 더블클릭하면 열립니다.
UA="Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
URL="${1:-https://m.qoo10.jp/shop/oaworld}"
PD="${OA_MQ_PROFILE:-$HOME/.oa-qoo10-mobile-view}"
mkdir -p "$PD/Default"
# 창이 닫혀 있을 때만 설정 기록(열려 있으면 크롬이 덮어씀)
if ! pgrep -f "user-data-dir=$PD" >/dev/null; then
osascript -l JavaScript - "$PD/Default/Preferences" <<'JS' >/dev/null 2>&1
function run(a){ObjC.import('Foundation');const p=a[0];let o={};
 try{const s=$.NSString.stringWithContentsOfFileEncodingError(p,4,null);if(s&&!s.isNil())o=JSON.parse(s.js)}catch(e){}
 o.translate=Object.assign(o.translate||{},{enabled:true});
 o.translate_allowlists=Object.assign(o.translate_allowlists||{},{ja:'ko'});
 o.translate_whitelists=Object.assign(o.translate_whitelists||{},{ja:'ko'});
 o.translate_recent_target='ko';
 o.intl=Object.assign(o.intl||{},{accept_languages:'ko,ja'});
 $(JSON.stringify(o)).writeToFileAtomicallyEncodingError(p,true,4,null)}
JS
fi
open -na "Google Chrome" --args --user-data-dir="$PD" --no-first-run --no-default-browser-check --lang=ko --user-agent="$UA" --window-size=430,932 ${OA_MQ_EXTRA} --app="$URL"
