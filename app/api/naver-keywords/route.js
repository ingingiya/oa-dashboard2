export const dynamic = 'force-dynamic';
import crypto from 'crypto';

function makeSignature(timestamp, method, path, secretKey) {
  const message = `${timestamp}.${method}.${path}`;
  return crypto.createHmac('sha256', secretKey).update(message).digest('base64');
}

export async function GET(request) {
  const apiKey      = process.env.NAVER_API_KEY;
  const secretKey   = process.env.NAVER_SECRET_KEY;
  const customerId  = process.env.NAVER_CUSTOMER_ID;

  if (!apiKey || !secretKey || !customerId) {
    return Response.json({ error: "NAVER_API_KEY / NAVER_SECRET_KEY / NAVER_CUSTOMER_ID 환경변수 없음" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const keywords = searchParams.get("keywords"); // 콤마 구분
  if (!keywords) return Response.json({ error: "keywords 파라미터 필요" }, { status: 400 });

  const timestamp = Date.now().toString();
  const method = "GET";
  const path = "/keywordstool";
  const signature = makeSignature(timestamp, method, path, secretKey);

  const qs = new URLSearchParams({
    hintKeywords: keywords,
    showDetail: "1",
  });

  const res = await fetch(`https://api.naver.com${path}?${qs}`, {
    headers: {
      "X-API-KEY":   apiKey,
      "X-Customer":  customerId,
      "X-Timestamp": timestamp,
      "X-Signature": signature,
    },
  });

  if (!res.ok) {
    const err = await res.text();
    return Response.json({ error: `네이버 API 오류: ${err}` }, { status: res.status });
  }

  const data = await res.json();
  // keywordList 배열에서 필요한 필드만 추출
  const list = (data.keywordList || []).map(k => ({
    keyword:       k.relKeyword,
    pcMonthly:     k.monthlyPcQcCnt   === "< 10" ? 0 : parseInt(k.monthlyPcQcCnt)   || 0,
    mobileMonthly: k.monthlyMobileQcCnt === "< 10" ? 0 : parseInt(k.monthlyMobileQcCnt) || 0,
    competition:   k.compIdx, // LOW / MID / HIGH
  }));

  return Response.json({ keywords: list });
}
