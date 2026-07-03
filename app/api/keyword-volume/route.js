export const dynamic = 'force-dynamic';
import crypto from 'crypto';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function makeSignature(timestamp, method, path, secretKey) {
  const message = `${timestamp}.${method}.${path}`;
  return crypto.createHmac('sha256', secretKey).update(message).digest('base64');
}

export async function GET(request) {
  const apiKey = process.env.naver_ad;
  const secretKey = process.env.naver_ad_key;
  const customerId = process.env.NAVER_CUSTOMER_ID;

  if (!apiKey || !secretKey || !customerId) {
    return Response.json({ error: "네이버 API 키 없음" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const keywords = searchParams.get("keywords");
  if (!keywords) return Response.json({ error: "keywords 필요" }, { status: 400 });

  const timestamp = Date.now().toString();
  const path = "/keywordstool";
  const signature = makeSignature(timestamp, "GET", path, secretKey);

  const qs = new URLSearchParams({ hintKeywords: keywords, showDetail: "1" });
  const res = await fetch(`https://api.naver.com${path}?${qs}`, {
    headers: {
      "X-API-KEY": apiKey,
      "X-Customer": customerId,
      "X-Timestamp": timestamp,
      "X-Signature": signature,
    },
  });

  if (!res.ok) {
    const err = await res.text();
    return Response.json({ error: err }, { status: res.status });
  }

  const data = await res.json();
  const list = (data.keywordList || []).map(k => ({
    keyword: k.relKeyword,
    pc_monthly: k.monthlyPcQcCnt === "< 10" ? 0 : parseInt(k.monthlyPcQcCnt) || 0,
    mobile_monthly: k.monthlyMobileQcCnt === "< 10" ? 0 : parseInt(k.monthlyMobileQcCnt) || 0,
    total_monthly: (k.monthlyPcQcCnt === "< 10" ? 0 : parseInt(k.monthlyPcQcCnt) || 0) + (k.monthlyMobileQcCnt === "< 10" ? 0 : parseInt(k.monthlyMobileQcCnt) || 0),
    competition: k.compIdx,
  }));

  // Supabase에 기록 (오늘 날짜)
  if (SUPA_URL && SUPA_KEY && list.length) {
    const today = new Date().toISOString().split('T')[0];
    const rows = list.slice(0, 50).map(k => ({
      keyword: k.keyword,
      date: today,
      pc_monthly: k.pc_monthly,
      mobile_monthly: k.mobile_monthly,
      total_monthly: k.total_monthly,
      competition: k.competition,
    }));
    await fetch(`${SUPA_URL}/rest/v1/keyword_volumes?on_conflict=keyword,date`, {
      method: 'POST',
      headers: {
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(rows),
    }).catch(() => {});
  }

  return Response.json({ keywords: list });
}
