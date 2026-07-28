export const dynamic = 'force-dynamic';

const GRAPH = "https://graph.facebook.com/v19.0";

// 광고 이름 → 소재 썸네일 URL 맵 (뷰티 캠페인만)
export async function GET() {
  const token     = process.env.META_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;
  if (!token || !accountId)
    return Response.json({ error: "META_ACCESS_TOKEN 또는 META_AD_ACCOUNT_ID 없음" }, { status: 500 });

  // 쉼표 구분 다중 키워드 — 하나라도 캠페인명에 포함되면 수집
  const campaignFilters = (process.env.META_CAMPAIGN_FILTER || "뷰티,부스터").toLowerCase().split(",").map(s=>s.trim()).filter(Boolean);
  const thumbs = {};

  let url = `${GRAPH}/${accountId}/ads?fields=name,campaign{name},creative{image_url,thumbnail_url}&thumbnail_width=512&thumbnail_height=512&limit=200&access_token=${token}`;

  // 페이징 (최대 10페이지)
  for (let i = 0; i < 10 && url; i++) {
    const res = await fetch(url);
    const data = await res.json();
    if (data.error)
      return Response.json({ error: data.error.message }, { status: 400 });

    for (const ad of data.data || []) {
      const camp = (ad.campaign?.name || "").toLowerCase();
      if (!campaignFilters.some(f => camp.includes(f))) continue;
      const img = ad.creative?.image_url || ad.creative?.thumbnail_url;
      if (ad.name && img && !thumbs[ad.name]) thumbs[ad.name] = img;
    }
    url = data.paging?.next || null;
  }

  return Response.json({ thumbs, count: Object.keys(thumbs).length });
}
