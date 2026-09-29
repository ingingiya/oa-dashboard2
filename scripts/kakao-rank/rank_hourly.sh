#!/bin/zsh
cd /Users/kirby/oa-dashboard2
/usr/bin/python3 -W ignore scripts/kakao-rank/kakao_rank.py --slot "h$(date +%H)" > /dev/null
