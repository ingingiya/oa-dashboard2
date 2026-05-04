export const dynamic = 'force-dynamic';

const GROQ_KEY = process.env.GROQ_API_KEY;

export async function POST(request) {
  if (!GROQ_KEY) return Response.json({ error: "GROQ_API_KEY 없음" }, { status: 500 });

  const { product, reviews } = await request.json();
  if (!reviews?.length) return Response.json({ error: "리뷰 없음" }, { status: 400 });

  // 리뷰 너무 많으면 샘플링 (토큰 제한)
  const sample = reviews.length > 150
    ? [...reviews.filter(r => r.rating <= 2).slice(0, 50), ...reviews.filter(r => r.rating >= 4).slice(0, 80), ...reviews.filter(r => r.rating === 3).slice(0, 20)]
    : reviews;

  const reviewText = sample.map((r, i) =>
    `[${i + 1}] ★${r.rating} (${r.date || ''}) ${r.option ? `[${r.option}]` : ''}\n${r.content}`
  ).join('\n\n');

  const starDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  reviews.forEach(r => { if (r.rating >= 1 && r.rating <= 5) starDist[r.rating]++; });

  const prompt = `다음은 네이버 스마트스토어 "${product}" 제품의 실제 고객 리뷰입니다.

${reviewText}

위 리뷰를 분석해서 아래 JSON 형식으로만 답하세요. 다른 텍스트는 절대 포함하지 마세요.

{
  "summary": "전반적인 리뷰 요약 2-3줄",
  "positive": [
    {"title": "긍정 포인트 제목", "desc": "구체적인 내용", "count": 언급횟수추정},
    ...3-5개
  ],
  "negative": [
    {"title": "부정 포인트 제목", "desc": "구체적인 내용", "count": 언급횟수추정},
    ...3-5개
  ],
  "suggestions": [
    {"title": "개선 제안 제목", "desc": "구체적인 개선 방법"},
    ...3-4개
  ],
  "keywords": {
    "positive": ["키워드1", "키워드2", ...최대8개],
    "negative": ["키워드1", "키워드2", ...최대8개]
  }
}`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: `Groq 오류: ${err}` }, { status: res.status });
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";

    // JSON 추출
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return Response.json({ error: "AI 응답 파싱 실패", raw }, { status: 500 });

    const analysis = JSON.parse(jsonMatch[0]);
    return Response.json({ analysis, starDist, total: reviews.length });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
