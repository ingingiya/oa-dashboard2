#!/bin/sh
# print price section of an adrop dump
f=adrop/$1.txt; head -2 $f; grep -nE "CPM|CPC|CPP|CPV|CPT|원|최소|VAT|기준\)" $f | grep -vE "^[0-9]+:(로그인|회원가입)" | cut -c1-200 | head -${2:-40}
