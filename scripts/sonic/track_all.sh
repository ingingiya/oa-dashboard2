#!/bin/zsh
cd /Users/kirby/oa-dashboard2
/usr/bin/python3 -W ignore scripts/sonic/sonic_rank_track.py --product sonic
/usr/bin/python3 -W ignore scripts/sonic/sonic_rank_track.py --product airstraight
