import json,sys
OUT='/Users/kirby/oa-dashboard2/docs/iboss-mediakit-prices.json'
try: cur=json.load(open(OUT))
except Exception: cur={"researched":"2026-09-15","items":[]}
new=json.load(open(sys.argv[1]))
byname={i['name']:i for i in cur['items']}
for it in new: byname[it['name']]=it
cur['items']=list(byname.values())
json.dump(cur,open(OUT,'w'),ensure_ascii=False,indent=1)
print('total',len(cur['items']))
