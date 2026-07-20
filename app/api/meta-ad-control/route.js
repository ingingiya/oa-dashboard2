export const dynamic = 'force-dynamic';

const GRAPH = "https://graph.facebook.com/v19.0";

// 광고 상태 조회: GET → { statuses: { 광고명: "ACTIVE"|"PAUSED"|... } }
export async function GET() {
  const token = process.env.META_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;
  if (!token || !accountId)
    return Response.json({ error: "META_ACCESS_TOKEN 또는 META_AD_ACCOUNT_ID 없음" }, { status: 500 });

  const statuses = {};
  let url = `${GRAPH}/${accountId}/ads?fields=name,status,effective_status&limit=500&access_token=${token}`;
  for (let page = 0; url && page < 10; page++) {
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) return Response.json({ error: data.error.message }, { status: 400 });
    (data.data || []).forEach(a => { statuses[a.name] = a.status; });
    url = data.paging?.next || null;
  }
  return Response.json({ statuses });
}

// 원클릭 광고 on/off: POST {adName, action?: "on"|"off"} (기본 off)
// off: 이름 정확히 일치하는 ACTIVE 광고 → PAUSED / on: PAUSED 광고 → ACTIVE
export async function POST(request) {
  const token = process.env.META_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;
  if (!token || !accountId)
    return Response.json({ error: "META_ACCESS_TOKEN 또는 META_AD_ACCOUNT_ID 없음" }, { status: 500 });

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "잘못된 요청" }, { status: 400 }); }
  const adName = String(body?.adName || "").trim();
  if (!adName) return Response.json({ error: "adName 필수" }, { status: 400 });
  const turnOn = body?.action === "on";
  const fromStatus = turnOn ? "PAUSED" : "ACTIVE";
  const toStatus = turnOn ? "ACTIVE" : "PAUSED";

  // 이름으로 광고 검색 (CONTAIN → 정확 일치 필터)
  const filtering = encodeURIComponent(JSON.stringify([{ field: "name", operator: "CONTAIN", value: adName }]));
  const searchRes = await fetch(
    `${GRAPH}/${accountId}/ads?fields=name,status,effective_status&filtering=${filtering}&limit=100&access_token=${token}`
  );
  const searchData = await searchRes.json();
  if (searchData.error)
    return Response.json({ error: searchData.error.message }, { status: 400 });

  const matches = (searchData.data || []).filter(a => a.name === adName);
  if (!matches.length)
    return Response.json({ error: `광고를 찾지 못함: ${adName}` }, { status: 404 });

  const targets = matches.filter(a => a.status === fromStatus);
  if (!targets.length)
    return Response.json({ ok: true, changed: 0, message: turnOn ? "이미 켜져 있음" : "이미 꺼져 있음", statuses: matches.map(a => a.effective_status) });

  const results = [];
  for (const ad of targets) {
    const r = await fetch(`${GRAPH}/${ad.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `status=${toStatus}&access_token=${token}`,
    });
    const d = await r.json();
    results.push({ id: ad.id, ok: !!d.success, error: d.error?.message });
  }
  const changed = results.filter(r => r.ok).length;
  if (!changed)
    return Response.json({ error: results[0]?.error || `${toStatus} 실패`, results }, { status: 502 });

  // 텔레그램 알림 (실패해도 무시)
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (botToken && chatId) {
    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: turnOn ? `▶️ 광고 재개됨\n\n· ${adName}\n· 대시보드에서 원클릭 ON 실행` : `⏸️ 광고 중단됨\n\n· ${adName}\n· 대시보드에서 원클릭 PAUSE 실행` }),
      });
    } catch {}
  }

  return Response.json({ ok: true, changed, results });
}
