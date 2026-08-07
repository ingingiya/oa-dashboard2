// app/api/notify/route.ts
// 텔레그램 완료 알림 — POST { text } → 봇으로 메시지 전송
// env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text) throw new Error("text 필요");
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) throw new Error("TELEGRAM_BOT_TOKEN/CHAT_ID 미설정");
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: String(text).slice(0, 3900) }),
    });
    if (!r.ok) throw new Error(`텔레그램 ${r.status}: ${await r.text()}`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
