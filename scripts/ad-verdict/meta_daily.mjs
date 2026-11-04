import { env } from '/Users/kirby/oa-dashboard2/scripts/nworks-lib.mjs';
const c = (s) => String(s || '').trim().replace(/^"|"$/g, '');
const T = c(env.META_ACCESS_TOKEN), A = c(env.META_AD_ACCOUNT_ID);
const get = async (u) => { const r = await (await fetch(u)).json(); if (r.error) throw new Error(JSON.stringify(r.error)); return r; };
let sets = [], u = `https://graph.facebook.com/v19.0/${A}/adsets?fields=name,effective_status,campaign{name}&limit=500&access_token=${T}`;
while (u) { const r = await get(u); sets.push(...r.data); u = r.paging?.next; }
const st = Object.fromEntries(sets.map((s) => [s.id, s.effective_status]));
let rows = [], v = `https://graph.facebook.com/v19.0/${A}/insights?level=adset&date_preset=last_30d&time_increment=1&fields=adset_id,adset_name,campaign_name,spend,impressions,inline_link_clicks&limit=500&access_token=${T}`;
while (v) { const r = await get(v); rows.push(...r.data); v = r.paging?.next; }
const out = rows.filter((r) => /플렌티플렛|프리온/.test(r.adset_name + r.campaign_name) && /부스터/.test(r.campaign_name)).map((r) => ({ day: r.date_start, product: /플렌티/.test(r.adset_name + r.campaign_name) ? '플렌티플렛 4L' : '프리온', channel: '메타', set: r.campaign_name + ' › ' + r.adset_name, on: st[r.adset_id] === 'ACTIVE', cost: +r.spend, imp: +r.impressions, clk: +(r.inline_link_clicks || 0) }));
console.log(JSON.stringify(out));
