@echo off
REM 모바일 큐텐 실시간 보기 (윈도우) - 크롬을 아이폰 모드로 따로 띄우고 일본어→한국어 자동번역. 더블클릭하면 열립니다.
set UA=Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1
set CH="%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist %CH% set CH="%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist %CH% set CH="%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
REM 자동번역 설정(창이 닫혀 있을 때만 기록)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$pd=$env:LOCALAPPDATA+'\oa-qoo10-mobile-view'; if(Get-CimInstance Win32_Process | ? {$_.Name -eq 'chrome.exe' -and $_.CommandLine -like '*oa-qoo10-mobile-view*'}){exit}; New-Item -ItemType Directory -Force ($pd+'\Default') | Out-Null; $f=$pd+'\Default\Preferences'; $o=$null; if(Test-Path $f){try{$o=[IO.File]::ReadAllText($f) | ConvertFrom-Json}catch{}}; if(-not $o){$o=New-Object psobject}; $o | Add-Member -Force NoteProperty translate @{enabled=$true}; $o | Add-Member -Force NoteProperty translate_allowlists @{ja='ko'}; $o | Add-Member -Force NoteProperty translate_whitelists @{ja='ko'}; $o | Add-Member -Force NoteProperty translate_recent_target 'ko'; $o | Add-Member -Force NoteProperty intl @{accept_languages='ko,ja'}; [IO.File]::WriteAllText($f,($o | ConvertTo-Json -Depth 100 -Compress))"
start "" %CH% --user-data-dir="%LOCALAPPDATA%\oa-qoo10-mobile-view" --no-first-run --no-default-browser-check --lang=ko --user-agent="%UA%" --window-size=430,932 --app="https://m.qoo10.jp/shop/oaworld"
