export const dynamic = 'force-dynamic';

// 재제작 요청 → 텔레그램 즉시 알림 (대시보드 재제작 버튼에서 호출)
export async function POST(request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId)
    return Response.json({ error: "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 없음" }, { status: 500 });

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "잘못된 요청" }, { status: 400 }); }
  const adName = String(body?.adName || "").slice(0, 200);
  if (!adName) return Response.json({ error: "adName 필수" }, { status: 400 });
  const roas = String(body?.roas || "").slice(0, 20);
  const spend = Number(body?.spend) || 0;
  const note = String(body?.note || "").slice(0, 300);
  const thumbUrl = String(body?.thumbUrl || "");

  const fmtW = n => n >= 10000 ? `${Math.round(n / 10000).toLocaleString()}만원` : `${Math.round(n).toLocaleString()}원`;
  const lines = [`🎨 소재 재제작 요청`, ``, `· ${adName}`];
  if (roas) lines.push(`· ROAS ${roas}%${spend ? ` / 지출 ${fmtW(spend)}` : ""}`);
  else if (spend) lines.push(`· 지출 ${fmtW(spend)}`);
  if (note) lines.push(`· ${note}`);
  lines.push(``);
  lines.push(`목록 👉 oa-dashboard2.vercel.app (메타광고 → 소재)`);
  const text = lines.join("\n");

  let ok = false;
  if (/^https?:\/\//.test(thumbUrl)) {
    try {
      const pr = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, photo: thumbUrl, caption: text }),
      });
      ok = (await pr.json()).ok;
    } catch {}
  }
  if (!ok) {
    const mr = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    ok = (await mr.json()).ok;
  }
  if (!ok) return Response.json({ error: "텔레그램 발송 실패" }, { status: 502 });
  return Response.json({ ok: true });
}
