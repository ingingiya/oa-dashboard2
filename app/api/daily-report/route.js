export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// 일일 광고 효율 보고 → 텔레그램 (매일 17:30 KST 자동 발송)
// 메타광고 + GFA 어제 성과 요약 + 주간 누적 대비

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sH = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' };

const num = v => { const n = parseFloat(String(v||'').replace(/,/g,'').replace(/[^0-9.-]/g,'')); return isNaN(n)?0:n; };
const fmtW = n => n >= 10000 ? `${(n/10000).toFixed(1)}만` : `${Math.round(n).toLocaleString()}원`;
const fmtPct = (v, suffix='%') => `${Math.round(v)}${suffix}`;
const delta = (cur, prev) => {
  if (!prev) return '';
  const d = prev > 0 ? Math.round((cur - prev) / prev * 100) : 0;
  return d > 0 ? ` (+${d}%)` : d < 0 ? ` (${d}%)` : ' (±0%)';
};

// KST 날짜 유틸
function kstDate(offsetDays = 0) {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
function kstWeekStart() {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().slice(0, 10);
}

// ── 메타광고 데이터 (Meta Marketing API) ──
async function fetchMetaAds(since, until) {
  const token = process.env.META_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;
  if (!token || !accountId) return [];

  const campaignFilter = (process.env.META_CAMPAIGN_FILTER || '뷰티').toLowerCase();
  const fields = 'ad_name,campaign_name,adset_name,objective,spend,impressions,inline_link_clicks,clicks,ctr,cpm,cost_per_inline_link_click,actions,action_values,website_purchase_roas,date_start';
  const PURCHASE_TYPES = ['purchase','offsite_conversion.fb_pixel_purchase','omni_purchase'];

  let allRows = [];
  let url = `https://graph.facebook.com/v19.0/${accountId}/insights?level=ad&fields=${fields}&time_increment=1&time_range={"since":"${since}","until":"${until}"}&action_attribution_windows=%5B%221d_view%22%2C%227d_click%22%5D&use_unified_attribution_setting=true&limit=500&access_token=${token}`;

  while (url) {
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) break;
    for (const r of (data.data || [])) {
      if (!(r.campaign_name || '').toLowerCase().includes(campaignFilter)) continue;
      const spend = parseFloat(r.spend) || 0;
      const actions = r.actions || [];
      const actionValues = r.action_values || [];
      let purchases = 0, convValue = 0;
      for (const t of PURCHASE_TYPES) {
        const a = actions.find(x => x.action_type === t);
        if (a) { purchases += parseFloat(a.value) || 0; break; }
      }
      for (const t of PURCHASE_TYPES) {
        const a = actionValues.find(x => x.action_type === t);
        if (a) { convValue += parseFloat(a.value) || 0; break; }
      }
      if (!convValue) {
        const wr = r.website_purchase_roas;
        if (Array.isArray(wr) && wr[0]) convValue = (parseFloat(wr[0].value) || 0) * spend;
      }
      allRows.push({
        date: r.date_start, campaign: r.campaign_name, adName: r.ad_name,
        spend, impressions: parseInt(r.impressions)||0,
        clicks: parseInt(r.inline_link_clicks)||0,
        purchases, convValue,
      });
    }
    url = data.paging?.next || null;
  }
  return allRows;
}

// ── GFA 데이터 (Supabase settings) ──
async function fetchGFA() {
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/settings?key=eq.oa_gfa_report_v1&select=value`, { headers: sH });
    const data = (await r.json())?.[0]?.value;
    return data?.rows || [];
  } catch { return []; }
}

// ── 네이버 검색광고 데이터 (ad_campaigns 테이블) ──
async function fetchNaverAds(since, until) {
  try {
    const r = await fetch(
      `${SUPA_URL}/rest/v1/ad_campaigns?select=date,campaign_name,spend,clicks,impressions,conversions,conv_amount&date=gte.${since}&date=lte.${until}&order=date.asc`,
      { headers: sH }
    );
    return await r.json() || [];
  } catch { return []; }
}

function classifyAppeal(name) {
  const s = (name || '').toLowerCase();
  if (/협력|협찬|파트너|크리에이터/.test(s)) return '협력';
  if (/\d+\s*(원|만원|%)|할인|특가|세일|프로모션|쿠폰/.test(s)) return '프로모';
  if (/헬스|아직도|출근|여행|자취|캠핑|후기|리뷰|전후|선물/.test(s)) return '상황';
  if (/초경량|모터|스펙|무선|급속|미니|컬러/.test(s)) return '스펙';
  return '';
}

export async function GET(request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId)
    return Response.json({ error: 'TELEGRAM env 없음' }, { status: 500 });

  const force = new URL(request.url).searchParams.get('force') === '1';
  const yesterday = kstDate(-1);
  const weekStart = kstWeekStart();
  // 지난주 같은 요일까지 비교용
  const prevWeekStart = (() => {
    const d = new Date(weekStart); d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  })();
  const prevYesterday = (() => {
    const d = new Date(yesterday); d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  })();

  // ── 1. 메타광고 ──
  const metaRows = await fetchMetaAds(weekStart, yesterday);
  const metaYday = metaRows.filter(r => r.date === yesterday);
  const metaWeek = metaRows;
  // 지난주 비교
  const metaPrevRows = await fetchMetaAds(prevWeekStart, prevYesterday);
  const metaPrevYday = metaPrevRows.filter(r => r.date === prevYesterday);

  const agg = rows => {
    const spend = rows.reduce((s,r) => s + r.spend, 0);
    const purchases = rows.reduce((s,r) => s + r.purchases, 0);
    const convValue = rows.reduce((s,r) => s + r.convValue, 0);
    const roas = spend > 0 ? Math.round(convValue / spend * 100) : 0;
    return { spend, purchases, convValue, roas };
  };

  const mY = agg(metaYday);
  const mPY = agg(metaPrevYday);
  const mW = agg(metaWeek);

  // 어제 소재별 TOP/BOTTOM
  const adMap = {};
  for (const r of metaYday) {
    const k = r.adName || '(이름없음)';
    if (!adMap[k]) adMap[k] = { spend: 0, purchases: 0, convValue: 0 };
    adMap[k].spend += r.spend; adMap[k].purchases += r.purchases; adMap[k].convValue += r.convValue;
  }
  const adList = Object.entries(adMap).filter(([,v]) => v.spend >= 10000).sort((a,b) => {
    const ra = a[1].spend > 0 ? a[1].convValue / a[1].spend : 0;
    const rb = b[1].spend > 0 ? b[1].convValue / b[1].spend : 0;
    return rb - ra;
  });
  const topAds = adList.filter(([,v]) => v.spend > 0 && v.convValue / v.spend >= 3).slice(0, 3);
  const bottomAds = adList.filter(([,v]) => v.spend >= 30000 && (v.purchases === 0 || v.convValue / v.spend < 1.5))
    .sort((a,b) => b[1].spend - a[1].spend).slice(0, 3);

  // ── 2. GFA ──
  const gfaRows = await fetchGFA();
  const gfaTotal = gfaRows.reduce((a, r) => ({
    cost: a.cost + (Number(r.cost)||0), imp: a.imp + (Number(r.imp)||0),
    clk: a.clk + (Number(r.clk)||0), buy: a.buy + (Number(r.buy)||0), rev: a.rev + (Number(r.rev)||0),
  }), { cost:0, imp:0, clk:0, buy:0, rev:0 });

  // ── 3. 네이버 검색광고 ──
  const naverRows = await fetchNaverAds(weekStart, yesterday);
  const naverYday = naverRows.filter(r => r.date === yesterday);
  const nY = {
    spend: naverYday.reduce((s,r) => s + (Number(r.spend)||0), 0),
    conv: naverYday.reduce((s,r) => s + (Number(r.conversions)||0), 0),
    convAmt: naverYday.reduce((s,r) => s + (Number(r.conv_amount)||0), 0),
  };
  const nYRoas = nY.spend > 0 ? Math.round(nY.convAmt / nY.spend * 100) : 0;

  // ── 4. 메시지 조립 ──
  const lines = [];
  const dayLabel = yesterday.slice(5).replace('-', '/');
  const kstNow = new Date(Date.now() + 9*3600*1000);
  const dayOfWeek = ['일','월','화','수','목','금','토'][kstNow.getUTCDay()];

  lines.push(`📊 오아 광고 데일리 리포트 (${dayLabel} ${['일','월','화','수','목','금','토'][new Date(yesterday).getDay()]})`);
  lines.push('');

  // 메타광고
  lines.push('━━ 메타광고 ━━');
  if (mY.spend > 0) {
    lines.push(`💸 지출 ${fmtW(mY.spend)}${delta(mY.spend, mPY.spend)}`);
    lines.push(`🛒 구매 ${mY.purchases}건 · ROAS ${mY.roas}%${delta(mY.roas, mPY.roas)}`);
    lines.push(`💰 전환매출 ${fmtW(mY.convValue)}`);

    if (topAds.length) {
      lines.push('');
      lines.push('🟢 효율 TOP');
      for (const [n, v] of topAds) {
        const tag = classifyAppeal(n);
        lines.push(`  · ${n.slice(0,35)}${tag ? ` [${tag}]` : ''}`);
        lines.push(`    ROAS ${Math.round(v.convValue/v.spend*100)}% · ${fmtW(v.spend)} · ${v.purchases}건`);
      }
    }
    if (bottomAds.length) {
      lines.push('');
      lines.push('🔴 효율 하위');
      for (const [n, v] of bottomAds) {
        const tag = classifyAppeal(n);
        lines.push(`  · ${n.slice(0,35)}${tag ? ` [${tag}]` : ''}`);
        lines.push(`    ROAS ${v.spend>0?Math.round(v.convValue/v.spend*100):0}% · ${fmtW(v.spend)} · ${v.purchases}건`);
      }
    }
  } else {
    lines.push('  어제 데이터 없음');
  }

  // 주간 누적
  if (mW.spend > 0) {
    lines.push('');
    lines.push(`📅 주간 누적 (${weekStart.slice(5).replace('-','/')}~)`);
    lines.push(`  지출 ${fmtW(mW.spend)} · 구매 ${mW.purchases}건 · ROAS ${mW.roas}%`);
  }

  // 네이버 검색광고
  if (nY.spend > 0) {
    lines.push('');
    lines.push('━━ 네이버 검색광고 ━━');
    lines.push(`💸 지출 ${fmtW(nY.spend)} · 전환 ${nY.conv}건 · ROAS ${nYRoas}%`);
  }

  // GFA
  if (gfaTotal.cost > 0) {
    const gfaRoas = gfaTotal.cost > 0 ? Math.round(gfaTotal.rev / gfaTotal.cost * 100) : 0;
    lines.push('');
    lines.push('━━ GFA (네이버 DA) ━━');
    lines.push(`💸 지출 ${fmtW(gfaTotal.cost)} · 구매 ${gfaTotal.buy}건 · ROAS ${gfaRoas}%`);
    lines.push(`  CTR ${gfaTotal.imp>0?(gfaTotal.clk/gfaTotal.imp*100).toFixed(2):0}%`);
  }

  // 전체 합산
  const totalSpend = mY.spend + nY.spend;
  const totalConvValue = mY.convValue + nY.convAmt;
  const totalRoas = totalSpend > 0 ? Math.round(totalConvValue / totalSpend * 100) : 0;
  if (totalSpend > 0) {
    lines.push('');
    lines.push('━━ 전체 합산 ━━');
    lines.push(`💸 총 지출 ${fmtW(totalSpend)} · 총 ROAS ${totalRoas}%`);
  }

  lines.push('');
  lines.push('상세 👉 oa-dashboard2.vercel.app');

  // ── 5. 텔레그램 발송 ──
  const text = lines.join('\n');
  const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  const tgData = await tgRes.json();

  // ── 6. 효율 TOP 소재 썸네일 첨부 ──
  let photos = 0;
  if (topAds.length) {
    try {
      const thRes = await fetch(`${SUPA_URL}/rest/v1/settings?key=eq.oa_meta_thumbs_v1&select=value`, { headers: sH });
      const thumbs = (await thRes.json())?.[0]?.value;
      if (thumbs && typeof thumbs === 'object') {
        const norm = s => String(s||'').toLowerCase().replace(/[\s_\-.]+/g,'');
        const keys = Object.keys(thumbs);
        for (const [n, v] of topAds) {
          if (photos >= 2) break;
          const nn = norm(n);
          const k = keys.find(k => { const kk = norm(k); return kk.includes(nn) || nn.includes(kk); });
          const url = k ? thumbs[k] : thumbs[n];
          if (!url) continue;
          try {
            await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: chatId, photo: url,
                caption: `🟢 ${n}\nROAS ${Math.round(v.convValue/v.spend*100)}% · ${fmtW(v.spend)}` }),
            });
            photos++;
          } catch {}
        }
      }
    } catch {}
  }

  return Response.json({
    ok: tgData.ok, yesterday, meta: mY, naver: nY,
    topAds: topAds.length, bottomAds: bottomAds.length, photos,
  });
}
