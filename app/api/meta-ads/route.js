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

function getRoas(row) {
  // website_purchase_roas / purchase_roas 필드 직접 사용
  const wr = row.website_purchase_roas;
  if (Array.isArray(wr) && wr.length > 0) return parseFloat(wr[0].value) || 0;
  const pr = row.purchase_roas;
  if (Array.isArray(pr) && pr.length > 0) return parseFloat(pr[0].value) || 0;
  return 0;
}

function normalize(row) {
  const actions       = row.actions || [];
  const actionValues  = row.action_values || [];
  const uniqueActions = row.unique_actions || [];
  const costPerAction = row.cost_per_action_type || [];

  // 구매수: actions → unique_actions fallback
  let purchases = getActionAny(actions, PURCHASE_TYPES);
  if (!purchases) purchases = getActionAny(uniqueActions, PURCHASE_TYPES);

  const cart = getActionAny(actions, CART_TYPES);
  const lpv  = getAction(actions, "landing_page_view") || getAction(actions, "omni_landing_page_view");

  // 전환값: action_values → website_purchase_roas * spend fallback
  let convValue = getActionAny(actionValues, PURCHASE_TYPES);
  const roasMultiplier = getRoas(row);
  const spend = parseFloat(row.spend) || 0;
  if (!convValue && roasMultiplier > 0) convValue = roasMultiplier * spend;

  // CPA: cost_per_action_type → spend/purchases 계산
  const cpaCand = costPerAction.find(c => PURCHASE_TYPES.includes(c.action_type));
  let cpa = cpaCand ? parseFloat(cpaCand.value) || 0 : 0;
  if (!cpa && purchases > 0) cpa = Math.round(spend / purchases);

  return {
    date:        row.date_start || "",
    campaign:    row.campaign_name || "",
    adset:       row.adset_name || "",
    adName:      row.ad_name || "",
    objective:   row.objective || "",
    resultType:  purchases > 0 ? "purchase" : "",
    spend,
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
    "website_purchase_roas",
    "purchase_roas",
    "unique_actions",
    "date_start", "date_stop",
  ].join(",");

  const timeRange = since && until
    ? `&time_range={"since":"${since}","until":"${until}"}`
    : `&date_preset=${datePreset}`;

  // 캠페인 이름 필터 (env 또는 기본값)
  const campaignFilter = (process.env.META_CAMPAIGN_FILTER || "뷰티").toLowerCase();

  // Ads Manager 기본값과 동일한 귀속 기간 + 통합 귀속 설정
  const attrWindows = "action_attribution_windows=%5B%221d_view%22%2C%227d_click%22%5D";
  const unifiedAttr = "use_unified_attribution_setting=true";

  let allRows = [];
  let url = `${GRAPH}/${accountId}/insights?level=ad&fields=${fields}&time_increment=1${timeRange}&${attrWindows}&${unifiedAttr}&limit=500&access_token=${token}`;

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

  // 디버그: ?debug=1 이면 전환 캠페인 첫 2개 raw 반환 (action_type 확인용)
  if (searchParams.get("debug") === "1") {
    const debugUrl = `${GRAPH}/${accountId}/insights?level=ad&fields=${fields}&time_increment=1&date_preset=last_30d&${attrWindows}&${unifiedAttr}&limit=100&access_token=${token}`;
    const debugRes = await fetch(debugUrl);
    const debugData = await debugRes.json();
    const convRows = (debugData.data || []).filter(r =>
      (r.campaign_name||"").toLowerCase().includes(campaignFilter) &&
      (r.objective||"") !== "LINK_CLICKS"
    ).slice(0, 2);
    // 전환 캠페인에서 나온 action_type 전체 목록
    const allActionTypes = new Set();
    convRows.forEach(r => {
      (r.actions||[]).forEach(a => allActionTypes.add(a.action_type));
      (r.action_values||[]).forEach(a => allActionTypes.add("value:"+a.action_type));
    });
    return Response.json({
      conv_sample: convRows.map(r => ({
        ad: r.ad_name, campaign: r.campaign_name, objective: r.objective,
        spend: r.spend,
        actions: r.actions,
        action_values: r.action_values,
        unique_actions: r.unique_actions,
        website_purchase_roas: r.website_purchase_roas,
        purchase_roas: r.purchase_roas,
      })),
      all_action_types: [...allActionTypes],
    });
  }

  return Response.json({ rows: allRows, total: allRows.length });
}
