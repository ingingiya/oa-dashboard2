export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import crypto from 'crypto';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sH = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' };
const FIELDS = ['impCnt', 'clkCnt', 'salesAmt', 'cpc', 'ccnt', 'convAmt'];

function naverHeaders(path) {
  const ts = Date.now().toString();
  return {
    'X-API-KEY': process.env.NAVER_API_KEY,
    'X-Customer': process.env.NAVER_CUSTOMER_ID,
    'X-Timestamp': ts,
    'X-Signature': crypto.createHmac('sha256', process.env.NAVER_SECRET_KEY)
      .update(`${ts}.GET.${path}`).digest('base64'),
  };
}

async function getStat(id, since, until) {
  const qs = new URLSearchParams({
    id, fields: JSON.stringify(FIELDS),
    timeRange: JSON.stringify({ since, until }), timeIncrement: '1',
  });
  const res = await fetch(`https://api.naver.com/stats?${qs}`, { headers: naverHeaders('/stats') });
  if (!res.ok) return [];
  const json = await res.json();
  return json.data || [];
}

function makeRow(d, name, type) {
  return {
    date: d.dateStart, campaign_name: name, campaign_type: type,
    impressions: Number(d.impCnt) || 0, clicks: Number(d.clkCnt) || 0,
    spend: Number(d.salesAmt) || 0, conversions: Number(d.ccnt) || 0,
    conv_amount: Number(d.convAmt) || 0, synced_at: new Date().toISOString(),
  };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  if (secret !== process.env.ERP_SYNC_SECRET && req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!process.env.NAVER_API_KEY) return Response.json({ error: 'Naver API 환경변수 없음' }, { status: 500 });

  try {
    const campaigns = await fetch('https://api.naver.com/ncc/campaigns', { headers: naverHeaders('/ncc/campaigns') }).then(r => r.json());
    if (!campaigns.length) return Response.json({ ok: true, synced: 0 });

    const since = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];
    const until = new Date().toISOString().split('T')[0];
    const allRows = [];

    // 캠페인 단위 stat
    for (const c of campaigns) {
      const data = await getStat(c.nccCampaignId, since, until);
      data.forEach(d => allRows.push(makeRow(d, c.name, c.campaignTp)));
    }

    // 이미용 캠페인: 광고그룹 + 키워드 단위
    const beautyCamps = campaigns.filter(c => c.name.includes('이미용'));
    for (const c of beautyCamps) {
      const groups = await fetch(`https://api.naver.com/ncc/adgroups?nccCampaignId=${c.nccCampaignId}`, { headers: naverHeaders('/ncc/adgroups') }).then(r => r.json());
      for (const g of groups) {
        const data = await getStat(g.nccAdgroupId, since, until);
        data.forEach(d => allRows.push(makeRow(d, `${c.name} > ${g.name}`, c.campaignTp)));

        if (c.campaignTp === 'WEB_SITE') {
          const kwRes = await fetch(`https://api.naver.com/ncc/keywords?nccAdgroupId=${g.nccAdgroupId}`, { headers: naverHeaders('/ncc/keywords') });
          if (kwRes.ok) {
            const kws = await kwRes.json();
            for (const kw of kws) {
              const kwData = await getStat(kw.nccKeywordId, since, until);
              kwData.forEach(d => allRows.push(makeRow(d, `${c.name} > ${g.name} > ${kw.keyword}`, 'KEYWORD')));
            }
          }
        }
      }
    }

    // Supabase upsert
    for (let i = 0; i < allRows.length; i += 500) {
      const res = await fetch(`${SUPA_URL}/rest/v1/ad_campaigns?on_conflict=date,campaign_name`, {
        method: 'POST', headers: { ...sH, Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify(allRows.slice(i, i + 500)),
      });
      if (!res.ok) throw new Error(await res.text());
    }

    return Response.json({ ok: true, campaigns: campaigns.length, synced: allRows.length });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
