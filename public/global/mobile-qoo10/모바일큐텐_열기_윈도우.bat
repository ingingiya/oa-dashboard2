@echo off
REM 모바일 큐텐 실시간 보기 (윈도우) - 크롬을 아이폰 모드로 따로 띄웁니다. 더블클릭하면 열립니다.
set UA=Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1
set CH="%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist %CH% set CH="%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist %CH% set CH="%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
start "" %CH% --user-data-dir="%LOCALAPPDATA%\oa-qoo10-mobile-view" --no-first-run --no-default-browser-check --user-agent="%UA%" --window-size=430,932 --app="https://m.qoo10.jp/shop/oaworld"
