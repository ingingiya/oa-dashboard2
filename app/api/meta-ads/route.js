export const dynamic = 'force-dynamic';

const GRAPH = "https://graph.facebook.com/v19.0";

function getAction(actions, type) {
  if (!Array.isArray(actions)) return 0;
  const a = actions.find(a => a.action_type === type);
  return a ? parseFloat(a.value) || 0 : 0;
}

function normalize(row) {
  const actions      = row.actions || [];
  const actionValues = row.action_values || [];
  const costPerAction = row.cost_per_action_type || [];

  const purchases  = getAction(actions, "purchase") || getAction(actions, "offsite_conversion.fb_pixel_purchase");
  const cart       = getAction(actions, "add_to_cart") || getAction(actions, "offsite_conversion.fb_pixel_add_to_cart");
  const convValue  = getAction(actionValues, "purchase") || getAction(actionValues, "offsite_conversion.fb_pixel_purchase");
  const lpv        = getAction(actions, "landing_page_view");

  const cpaCand = costPerAction.find(c =>
    c.action_type === "purchase" || c.action_type === "offsite_conversion.fb_pixel_purchase"
  );
  const cpa = cpaCand ? parseFloat(cpaCand.value) || 0 : 0;

  return {
    date:        row.date_start || "",
    campaign:    row.campaign_name || "",
    adset:       row.adset_name || "",
    adName:      row.ad_name || "",
    objective:   row.objective || "",
    resultType:  purchases > 0 ? "purchase" : "",
    spend:       parseFloat(row.spend) || 0,
    impressions: parseInt(row.impressions) || 0,
    clicks:      parseInt(row.inline_link_clicks) || 0,
    clicksAll:   parseInt(row.clicks) || 0,
    lpv,
    purchases,
    cart,
    convValue,
    cpc:         parseFloat(row.cost_per_inline_link_click) || 0,
    cpcAll:      parseFloat(row.cost_per_unique_click) || 0,
    ctr:         parseFloat(row.ctr) || 0,
    cpa,
    cpm:         parseFloat(row.cpm) || 0,
    campaignBudget:     parseFloat(row.campaign_budget) || 0,
    campaignBudgetType: "",
    adsetBudget:        parseFloat(row.adset_budget) || 0,
    adsetBudgetType:    "",
  };
}

export async function GET(request) {
  const token     = process.env.META_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;

  if (!token || !accountId)
    return Response.json({ error: "META_ACCESS_TOKEN 또는 META_AD_ACCOUNT_ID 없음" }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const datePreset = searchParams.get("datePreset") || "last_30d";
  const since      = searchParams.get("since"); // YYYY-MM-DD
  const until      = searchParams.get("until");

  const fields = [
    "ad_name", "campaign_name", "adset_name", "objective",
    "spend", "impressions", "clicks", "inline_link_clicks",
    "ctr", "cpm", "cost_per_inline_link_click", "cost_per_unique_click",
    "actions", "action_values", "cost_per_action_type",
    "date_start", "date_stop",
  ].join(",");

  const timeRange = since && until
    ? `&time_range={"since":"${since}","until":"${until}"}`
    : `&date_preset=${datePreset}`;

  // 캠페인 이름 필터 (env 또는 기본값)
  const campaignFilter = (process.env.META_CAMPAIGN_FILTER || "뷰티").toLowerCase();

  let allRows = [];
  let url = `${GRAPH}/${accountId}/insights?level=ad&fields=${fields}&time_increment=1${timeRange}&limit=500&access_token=${token}`;

  // 페이징 처리
  while (url) {
    const res = await fetch(url);
    const data = await res.json();

    if (data.error)
      return Response.json({ error: data.error.message }, { status: 400 });

    const filtered = (data.data || [])
      .filter(r => (r.campaign_name || "").toLowerCase().includes(campaignFilter))
      .map(normalize);

    allRows = allRows.concat(filtered);
    url = data.paging?.next || null;
  }

  return Response.json({ rows: allRows, total: allRows.length });
}
