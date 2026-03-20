export const dynamic = 'force-dynamic';

export async function POST(request) {
  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) return new Response(JSON.stringify({error:"OPENAI_API_KEY 없음"}),{status:500});
  const { messages, context } = await request.json();
  const systemPrompt = `당신은 OA 뷰티팀의 마케팅 데이터 에이전트입니다. 현재 메타광고 대시보드 데이터를 기반으로 팀의 질문에 답합니다.\n\n## 현재 데이터\n${context||"없음"}\n\n## 규칙\n- 한국어로 간결하게 답하세요\n- 숫자는 만원 단위로 표시하세요\n- 그래프가 필요하면 아래 형식으로 포함하세요:\n\`\`\`chart\n{"type":"bar"|"line"|"pie","title":"제목","data":[{"name":"레이블","value":숫자}]}\n\`\`\`\n- 모르는 데이터는 솔직하게 말하세요`;
  const res = await fetch("https://api.openai.com/v1/chat/completions",{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":`Bearer ${OPENAI_KEY}`},
    body:JSON.stringify({model:"gpt-4o-mini",messages:[{role:"system",content:systemPrompt},...messages],max_tokens:1500,temperature:0.3}),
  });
  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content||"답변 없음";
  return new Response(JSON.stringify({reply}),{status:200,headers:{"Content-Type":"application/json"}});
}
