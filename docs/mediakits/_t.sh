#!/bin/sh
t=$(curl -s -m 25 -A "Mozilla/5.0 Chrome/124.0" "$1" | grep -oE "<title>[^<]*</title>" | head -1 | sed 's|<title>||;s|</title>||;s| 광고 상품 실시간 예약하기 | 애드노트||')
echo "$1 | $t"
