export const dynamic = 'force-dynamic';

const GRAPH = "https://graph.facebook.com/v19.0";

function getAction(actions, type) {
  if (!Array.isArray(actions)) return 0;
  const a = actions.find(a => a.action_type === type);
  return a ? parseFloat(a.value) || 0 : 0;
}

const PURCHASE_TYPES = [
  "purchase",
  "offsite_conversion.fb_pixel_purchase",
  "omni_purchase",
  "web_in_store_purchase",
  "website_purchase",
];
const CART_TYPES = [
  "add_to_cart",
  "offsite_conversion.fb_pixel_add_to_cart",
  "omni_add_to_cart",
];

function getActionAny(arr, types) {
  if (!Array.isArray(arr)) return 0;
  for (const type of types) {
    const a = arr.find(a => a.action_type === type);
    if (a) return parseFloat(a.value) || 0;
  }
  return 0;
}

function normalize(row) {
  const actions      = row.actions || [];
  const actionValues = row.action_values || [];
  const costPerAction = row.cost_per_action_type || [];

  const purchases = getActionAny(actions, PURCHASE_TYPES);
  const cart      = getActionAny(actions, CART_TYPES);
  const convValue = getActionAny(actionValues, PURCHASE_TYPES);
  const lpv       = getAction(actions, "landing_page_view") || getAction(actions, "omni_landing_page_view");

  const cpaCand = costPerAction.find(c => PURCHASE_TYPES.includes(c.action_type));
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

  // 디버그: ?debug=1 이면 첫 3개 raw 반환
  if (searchParams.get("debug") === "1") {
    const debugRows = [];
    let debugUrl = `${GRAPH}/${accountId}/insights?level=ad&fields=${fields}&time_increment=1${timeRange}&limit=3&access_token=${token}`;
    const debugRes = await fetch(debugUrl);
    const debugData = await debugRes.json();
    return Response.json({ raw: (debugData.data || []).slice(0, 3) });
  }

  return Response.json({ rows: allRows, total: allRows.length });
}
