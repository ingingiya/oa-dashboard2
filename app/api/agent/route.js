export const dynamic = 'force-dynamic';

export async function POST(request) {
  const GROQ_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_KEY) {
    return new Response(JSON.stringify({ error: "GROQ_API_KEY 환경변수가 없어요" }), {
      status: 500, headers: { "Content-Type": "application/json" }
    });
  }

  const { messages, context } = await request.json();

  const systemPrompt = `당신은 OA 뷰티팀의 마케팅 데이터 에이전트입니다. 아래 대시보드 데이터를 기반으로만 답하세요.

## 대시보드 현재 데이터
${context || "데이터 없음"}

## 답변 규칙
- 반드시 위 데이터에 있는 숫자만 사용하세요. 임의로 숫자를 만들지 마세요.
- 데이터에 없는 내용은 "현재 데이터에 없어요"라고 말하세요.
- 한국어로 간결하게 답하세요.
- 숫자는 만원 단위로 표시하세요 (예: 150만원).
- ROAS는 % 단위로 표시하세요 (예: ROAS 350%).
- 그래프가 필요하면 반드시 아래 형식으로 포함하세요:
\`\`\`chart
{"type":"bar","title":"차트제목","data":[{"name":"레이블","value":숫자}]}
\`\`\`
type은 bar, line, pie 중 하나
- 캠페인/광고 이름은 데이터에 있는 그대로 사용하세요.`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        max_tokens: 1500,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return new Response(JSON.stringify({ error: `Groq 오류: ${err}` }), {
        status: res.status, headers: { "Content-Type": "application/json" }
      });
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || "답변을 받지 못했어요";
    return new Response(JSON.stringify({ reply }), {
      status: 200, headers: { "Content-Type": "application/json" }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { "Content-Type": "application/json" }
    });
  }
}
