export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import Anthropic from '@anthropic-ai/sdk';

// 연출 컨셉 자동 추천: 제품 정보(+앵커 실사) → 배경/컬러/무드 컨셉 4개
// POST { productName, category, raw?, anchorUrl? }
// → { ok, concepts: [{ title, desc, styleBlock }] } (styleBlock은 영어 프롬프트 블록)
export async function POST(request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: 'ANTHROPIC_API_KEY 없음' }, { status: 500 });

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: '잘못된 요청' }, { status: 400 }); }
  const productName = String(body?.productName || '').slice(0, 100);
  const category = String(body?.category || '').slice(0, 100);
  const raw = String(body?.raw || '').slice(0, 3000);
  const anchorUrl = String(body?.anchorUrl || '');

  const prompt = `당신은 이커머스 제품 화보 아트디렉터입니다.
${anchorUrl ? '첨부된 제품 실사를 보고 ' : ''}이 제품의 상세페이지 연출컷에 쓸 배경/컬러/무드 컨셉 4개를 제안하세요.

제품: ${productName || '(첨부 이미지 참고)'} / 카테고리: ${category || '-'}
${raw ? `참고 정보:\n${raw}` : ''}

규칙:
- 4개는 서로 뚜렷이 달라야 함 (예: 브랜드 컬러 톤온톤 / 라이프스타일 실내 / 다크 프리미엄 / 파스텔 스튜디오 등)
- 제품 색상과 어울리는 배경 컬러를 구체적 hex나 색이름으로
- styleBlock은 이미지 생성 프롬프트에 그대로 붙일 영어 한 단락 (배경·조명·소품·컬러 팔레트, 40단어 이내, 제품 변형 지시 금지)

순수 JSON만 출력:
{"concepts":[{"title":"한글 컨셉명(6자 내)","desc":"한글 한 줄 설명","styleBlock":"english style prompt"}, ...4개]}`;

  try {
    const client = new Anthropic({ apiKey: key });
    const content = [];
    if (anchorUrl) content.push({ type: 'image', source: { type: 'url', url: anchorUrl } });
    content.push({ type: 'text', text: prompt });
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content }],
    });
    const text = (msg.content || []).find((b) => b.type === 'text')?.text || '';
    const parsed = JSON.parse(text.replace(/^```json?\s*|```\s*$/g, '').trim());
    return Response.json({ ok: true, concepts: parsed.concepts || [] });
  } catch (e) {
    console.error('detail/concepts 실패:', e);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
