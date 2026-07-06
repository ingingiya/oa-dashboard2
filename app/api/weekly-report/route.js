export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// 주간 메타광고 리포트 → 텔레그램 발송 (매주 월요일 크론)
// 필요 env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function classifyAppeal(name) {
  const s = (name || "").toLowerCase();
  if (!s) return "기타";
  if (/협력|협찬|파트너|roun|\.life|크리에이터|앰버서더/.test(s)) return "협력";
  if (/\d+\s*(원|만원|%)|할인|특가|세일|프로모션|행사|품절|역대급|최저가|쿠폰|딜\b|혜택|증정|사은품|초특가|와우/.test(s)) return "가격/프로모션";
  if (/헬스장|아직도|쓰세요|안씁|안 씁|출근|퇴근|여행|자취|기숙사|캠핑|출장|운동|아침|저녁|일상|후기|리뷰|비포|애프터|전후|언니|남친|여친|엄마|선물|브이로그|국룰|요즘|이제/.test(s)) return "상황/라이프스타일";
  if (/초경량|경량|무게|음이온|속건|바람|모터|스펙|한뼘|사이즈|접이|폴더|무선|급속|온도|풍량|저소음|소음|미니|컬러|그램|\d+g\b|\d+mm|쿨링|세라믹|코팅/.test(s)) return "기능/스펙";
  return "기타";
}

// 따옴표 처리 CSV 파서
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

export async function GET() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId)
    return Response.json({ error: "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 없음" }, { status: 500 });

  // 1. Supabase settings에서 시트 URL
  const setRes = await fetch(`${SUPA_URL}/rest/v1/settings?key=eq.oa_conv_sheet_url_v1&select=value`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
  });
  const setData = await setRes.json();
  let sheetUrl = setData?.[0]?.value;
  if (typeof sheetUrl === "string") sheetUrl = sheetUrl.replace(/^"|"$/g, "");
  if (!sheetUrl) return Response.json({ error: "시트 URL 설정 없음 (oa_conv_sheet_url_v1)" }, { status: 400 });

  // 2. CSV 다운로드
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

  // 3. 컬럼 인덱스
  const header = rows[0].map(h => h.trim());
  const idx = (...names) => header.findIndex(h => names.some(n => h.replace(/\s/g, "") === n.replace(/\s/g, "")));
  const iDate = idx("일", "날짜", "보고 시작");
  const iCamp = idx("캠페인 이름");
  const iAd = idx("광고 이름");
  const iSpend = idx("지출 금액 (KRW)", "지출 금액");
  const iPurch = idx("공유 항목이 포함된 구매", "웹사이트 구매", "구매");
  const iConvV = idx("공유 항목의 구매 전환값", "웹사이트 구매 전환값", "구매 전환값");
  if (iDate < 0 || iSpend < 0) return Response.json({ error: "필수 컬럼 없음", header }, { status: 400 });

  // 4. 주별 집계 (월요일 시작)
  const weekMap = {};
  for (const r of rows.slice(1)) {
    const date = normalizeDate(r[iDate]);
    if (!date) continue;
    const camp = r[iCamp] || "", ad = r[iAd] || "";
    if ((camp + ad).includes("Instagram 게시물")) continue;
    const dd = new Date(date); const day = dd.getDay();
    const mon = new Date(dd); mon.setDate(dd.getDate() - (day === 0 ? 6 : day - 1));
    const wk = `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
    if (!weekMap[wk]) weekMap[wk] = { spend: 0, purchases: 0, convValue: 0, ads: {} };
    const w = weekMap[wk];
    const spend = num(r[iSpend]), purch = iPurch >= 0 ? num(r[iPurch]) : 0, convV = iConvV >= 0 ? num(r[iConvV]) : 0;
    w.spend += spend; w.purchases += purch; w.convValue += convV;
    if (ad) {
      if (!w.ads[ad]) w.ads[ad] = { spend: 0, purchases: 0, convValue: 0 };
      w.ads[ad].spend += spend; w.ads[ad].purchases += purch; w.ads[ad].convValue += convV;
    }
  }
  const weekKeys = Object.keys(weekMap).sort().reverse();
  if (!weekKeys.length) return Response.json({ error: "주별 데이터 없음" }, { status: 400 });
  const cur = weekMap[weekKeys[0]], prev = weekMap[weekKeys[1]];

  // 4.5. 소재 피로도: 주별 ROAS 3주 연속 하락 & 마지막 <4
  const asc = [...weekKeys].sort();
  const trail = {};
  for (const wk of asc) {
    for (const [ad, v] of Object.entries(weekMap[wk].ads)) {
      if (v.spend < 10000) continue;
      (trail[ad] = trail[ad] || []).push(v.convValue / v.spend);
    }
  }
  const fatigued = new Set();
  for (const [ad, arr] of Object.entries(trail)) {
    if (arr.length < 3) continue;
    const [a, b, c] = arr.slice(-3);
    if (a > b && b > c && c < 4) fatigued.add(ad);
  }
  const curWk = weekKeys[0];
  const end = new Date(curWk); end.setDate(end.getDate() + 6);
  const range = `${curWk.slice(5).replace("-", "/")} ~ ${String(end.getMonth() + 1).padStart(2, "0")}/${String(end.getDate()).padStart(2, "0")}`;

  // 5. 액션 추천 (대시보드 주별 탭과 동일 기준)
  const curAds = Object.entries(cur.ads).filter(([, v]) => v.spend > 0);
  const scaleUp = curAds.filter(([, v]) => v.spend >= 30000 && v.convValue / v.spend >= 4)
    .sort((a, b) => b[1].convValue / b[1].spend - a[1].convValue / a[1].spend).slice(0, 3);
  const stop = curAds.filter(([, v]) => (v.spend >= 30000 && v.purchases === 0) || (v.spend >= 50000 && v.convValue / v.spend < 2))
    .sort((a, b) => b[1].spend - a[1].spend).slice(0, 5);
  const picked = new Set([...scaleUp, ...stop].map(([n]) => n));
  const fatigue = curAds.filter(([n]) => fatigued.has(n) && !picked.has(n))
    .sort((a, b) => b[1].spend - a[1].spend).slice(0, 3);

  const roas = cur.spend > 0 ? Math.round((cur.convValue / cur.spend) * 100) : 0;
  const prevRoas = prev && prev.spend > 0 ? Math.round((prev.convValue / prev.spend) * 100) : null;
  const spendDelta = prev && prev.spend > 0 ? Math.round(((cur.spend - prev.spend) / prev.spend) * 100) : null;

  // 6. 메시지 조립
  const lines = [];
  lines.push(`📊 오아 뷰티 메타광고 주간 리포트`);
  lines.push(`${range}`);
  lines.push(``);
  lines.push(`💸 지출 ${fmtW(cur.spend)}${spendDelta !== null ? ` (전주 대비 ${spendDelta >= 0 ? "+" : ""}${spendDelta}%)` : ""}`);
  lines.push(`🛒 구매 ${cur.purchases}건 · ROAS ${roas}%${prevRoas !== null ? ` (전주 ${prevRoas}%)` : ""}`);
  if (scaleUp.length) {
    lines.push(``);
    lines.push(`🟢 증액 추천`);
    for (const [n, v] of scaleUp)
      lines.push(`· ${n} [${classifyAppeal(n)}] — ROAS ${Math.round((v.convValue / v.spend) * 100)}% / ${fmtW(v.spend)}`);
  }
  if (stop.length) {
    lines.push(``);
    lines.push(`🔴 중단 검토`);
    for (const [n, v] of stop)
      lines.push(`· ${n} [${classifyAppeal(n)}] — ${v.purchases === 0 ? "구매 0" : `ROAS ${Math.round((v.convValue / v.spend) * 100)}%`} / ${fmtW(v.spend)}`);
  }
  if (fatigue.length) {
    lines.push(``);
    lines.push(`🟡 교체 준비 (ROAS 3주 연속 하락)`);
    for (const [n, v] of fatigue)
      lines.push(`· ${n} [${classifyAppeal(n)}] — ROAS ${Math.round((v.convValue / v.spend) * 100)}% / ${fmtW(v.spend)}`);
  }
  if (!scaleUp.length && !stop.length && !fatigue.length) {
    lines.push(``);
    lines.push(`증액/중단 대상 소재 없음 — 안정 운영 중`);
  }
  lines.push(``);
  lines.push(`상세 👉 oa-dashboard2.vercel.app (메타광고 → 주별)`);

  // 7. 텔레그램 발송
  const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: lines.join("\n") }),
  });
  const tgData = await tgRes.json();
  if (!tgData.ok) return Response.json({ error: "텔레그램 발송 실패", detail: tgData }, { status: 502 });

  // 8. 소재 썸네일 첨부 (oa_meta_thumbs_v1 매칭, 최대 4장)
  let photos = 0;
  try {
    const thRes = await fetch(`${SUPA_URL}/rest/v1/settings?key=eq.oa_meta_thumbs_v1&select=value`, {
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    });
    const thData = await thRes.json();
    let thumbs = thData?.[0]?.value;
    if (typeof thumbs === "string") { try { thumbs = JSON.parse(thumbs); } catch { thumbs = null; } }
    if (thumbs && typeof thumbs === "object") {
      const norm = s => String(s || "").toLowerCase().replace(/[\s_\-\.]+/g, "");
      const keys = Object.keys(thumbs);
      const findThumb = name => {
        if (thumbs[name]) return thumbs[name];
        const n = norm(name);
        if (!n) return null;
        const k = keys.find(k => { const kk = norm(k); return kk.includes(n) || n.includes(kk); });
        return k ? thumbs[k] : null;
      };
      const targets = [
        ...scaleUp.map(([n, v]) => ({ n, v, tag: "🟢 증액" })),
        ...stop.map(([n, v]) => ({ n, v, tag: "🔴 중단" })),
        ...fatigue.map(([n, v]) => ({ n, v, tag: "🟡 교체" })),
      ];
      for (const t of targets) {
        if (photos >= 4) break;
        const url = findThumb(t.n);
        if (!url) continue;
        try {
          const pr = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId, photo: url,
              caption: `${t.tag} · ${t.n}\nROAS ${Math.round((t.v.convValue / t.v.spend) * 100)}% / ${fmtW(t.v.spend)}`,
            }),
          });
          if ((await pr.json()).ok) photos++;
        } catch {}
      }
    }
  } catch {}

  return Response.json({ ok: true, week: curWk, spend: cur.spend, roas, scaleUp: scaleUp.length, stop: stop.length, fatigue: fatigue.length, photos });
}
