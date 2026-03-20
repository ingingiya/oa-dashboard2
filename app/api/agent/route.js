export const dynamic = 'force-dynamic';

export async function POST(request) {
  const GROQ_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_KEY) {
    return new Response(JSON.stringify({ error: "GROQ_API_KEY 환경변수가 없어요" }), {
      status: 500, headers: { "Content-Type": "application/json" }
    });
  }

  const { messages, context } = await request.json();

  const systemPrompt = `당신은 OA 뷰티팀의 마케팅 데이터 에이전트입니다. 현재 메타광고 대시보드 데이터를 기반으로 팀의 질문에 답합니다.

## 현재 데이터
${context || "데이터 없음"}

## 규칙
- 한국어로 간결하게 답하세요
- 숫자는 만원 단위로 표시하세요 (예: 150만원)
- 그래프가 필요하면 반드시 아래 형식으로 포함하세요:
\`\`\`chart
{"type":"bar","title":"차트제목","data":[{"name":"레이블","value":숫자}]}
\`\`\`
type은 bar, line, pie 중 하나
- 모르는 데이터는 솔직하게 말하세요`;

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
