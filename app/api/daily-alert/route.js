export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// 일일 이상 감지 → 텔레그램 알림 (매일 아침 크론)
// 어제 지출/ROAS를 직전 7일 평균과 비교, 급변·데이터 누락 시에만 발송

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some(f => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some(f => f !== "")) rows.push(row);
  return rows;
}

const num = v => {
  const n = parseFloat(String(v || "").replace(/,/g, "").replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
};

const normalizeDate = v => {
  const s = String(v || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const ko = s.match(/^(\d{4})[.\s]+(\d{1,2})[.\s]+(\d{1,2})/);
  if (ko) return `${ko[1]}-${ko[2].padStart(2, "0")}-${ko[3].padStart(2, "0")}`;
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  return "";
};

const fmtW = n => n >= 10000 ? `${Math.round(n / 10000).toLocaleString()}만원` : `${Math.round(n).toLocaleString()}원`;

export async function GET(request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId)
    return Response.json({ error: "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 없음" }, { status: 500 });

  // 시트 URL
  const setRes = await fetch(`${SUPA_URL}/rest/v1/settings?key=eq.oa_conv_sheet_url_v1&select=value`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
  });
  let sheetUrl = (await setRes.json())?.[0]?.value;
  if (typeof sheetUrl === "string") sheetUrl = sheetUrl.replace(/^"|"$/g, "");
  if (!sheetUrl) return Response.json({ error: "시트 URL 설정 없음" }, { status: 400 });

  const m = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  let csvUrl = sheetUrl;
  if (m) {
    const gid = (sheetUrl.match(/[#&?]gid=(\d+)/) || [])[1] || "0";
    csvUrl = `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${gid}&t=${Date.now()}`;
  }
  const csvRes = await fetch(csvUrl, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store", redirect: "follow" });
  if (!csvRes.ok) return Response.json({ error: `시트 HTTP ${csvRes.status}` }, { status: 502 });
  const rows = parseCSV(await csvRes.text());
  if (rows.length < 2) return Response.json({ error: "시트 데이터 없음" }, { status: 400 });

  const header = rows[0].map(h => h.trim());
  const idx = (...names) => header.findIndex(h => names.some(n => h.replace(/\s/g, "") === n.replace(/\s/g, "")));
  const iDate = idx("일", "날짜", "보고 시작");
  const iCamp = idx("캠페인 이름");
  const iAd = idx("광고 이름");
  const iSpend = idx("지출 금액 (KRW)", "지출 금액");
  const iConvV = idx("공유 항목의 구매 전환값", "웹사이트 구매 전환값", "구매 전환값");
  if (iDate < 0 || iSpend < 0) return Response.json({ error: "필수 컬럼 없음", header }, { status: 400 });

  // 일별 집계
  const daily = {};
  for (const r of rows.slice(1)) {
    const date = normalizeDate(r[iDate]);
    if (!date) continue;
    if (((r[iCamp] || "") + (r[iAd] || "")).includes("Instagram 게시물")) continue;
    if (!daily[date]) daily[date] = { spend: 0, convValue: 0 };
    daily[date].spend += num(r[iSpend]);
    daily[date].convValue += iConvV >= 0 ? num(r[iConvV]) : 0;
  }

  // 어제 (KST)
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  kst.setUTCDate(kst.getUTCDate() - 1);
  const yday = kst.toISOString().slice(0, 10);
  const y = daily[yday];

  // 직전 7일 (지출>0인 날만 평균)
  const prior = [];
  for (let i = 2; i <= 8; i++) {
    const d = new Date(Date.now() + 9 * 3600 * 1000);
    d.setUTCDate(d.getUTCDate() - i);
    const v = daily[d.toISOString().slice(0, 10)];
    if (v && v.spend > 0) prior.push(v);
  }
  const avgSpend = prior.length ? prior.reduce((s, v) => s + v.spend, 0) / prior.length : 0;
  const avgRoas = (() => {
    const ts = prior.reduce((s, v) => s + v.spend, 0), tc = prior.reduce((s, v) => s + v.convValue, 0);
    return ts > 0 ? tc / ts : 0;
  })();

  const alerts = [];
  if (!y || y.spend === 0) {
    alerts.push(`⚠️ 어제(${yday}) 지출 데이터 없음 — 시트 내보내기 확인 필요`);
    // 최근 누락일 나열
    const missing = Object.keys(daily).sort().slice(-7).filter(d => daily[d].spend === 0);
    if (missing.length > 1) alerts.push(`누락 의심일: ${missing.join(", ")}`);
  } else {
    const roas = y.spend > 0 ? y.convValue / y.spend : 0;
    if (avgSpend > 0) {
      const dev = (y.spend - avgSpend) / avgSpend;
      if (Math.abs(dev) >= 0.4)
        alerts.push(`${dev > 0 ? "📈 지출 급증" : "📉 지출 급감"} — 어제 ${fmtW(y.spend)} (7일 평균 ${fmtW(avgSpend)}, ${dev > 0 ? "+" : ""}${Math.round(dev * 100)}%)`);
    }
    if (avgRoas > 0) {
      const dev = (roas - avgRoas) / avgRoas;
      if (Math.abs(dev) >= 0.4)
        alerts.push(`${dev > 0 ? "🚀 ROAS 급등" : "🔻 ROAS 급락"} — 어제 ${Math.round(roas * 100)}% (7일 평균 ${Math.round(avgRoas * 100)}%)`);
    }
  }

  const force = new URL(request.url).searchParams.get("force") === "1";
  if (!alerts.length && !force)
    return Response.json({ ok: true, yday, spend: y?.spend || 0, alerts: 0, sent: false });

  const lines = [`🔔 메타광고 일일 체크 (${yday})`];
  if (alerts.length) { lines.push(``); alerts.forEach(a => lines.push(a)); }
  else lines.push(`이상 없음 — 어제 지출 ${fmtW(y?.spend || 0)}`);
  lines.push(``);
  lines.push(`상세 👉 oa-dashboard2.vercel.app`);

  const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: lines.join("\n") }),
  });
  const tgData = await tgRes.json();
  if (!tgData.ok) return Response.json({ error: "텔레그램 발송 실패", detail: tgData }, { status: 502 });

  return Response.json({ ok: true, yday, spend: y?.spend || 0, alerts: alerts.length, sent: true });
}
