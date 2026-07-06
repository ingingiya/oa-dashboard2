export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import Anthropic from '@anthropic-ai/sdk';

const OA_TEMPLATE = `OA 상세페이지 기획안 표준 구조:
1. 커버 — 제품명+카피  2. 후킹카피  3. 모델컷  4. 제품소개+기술브랜딩
5. 비교표  6-7. 핵심기능 픽토그램(6개)  8-19. 기능별 상세(2p씩)
20-22. 사용법  23-24. 안전/관리  25. 컬러  26-27. 인증/스펙  28-30. 레퍼런스
카피톤: 감성+기능소구, 짧고 임팩트. 디자인: 미니멀, 화이트, 제품컬러 포인트`;

export async function POST(req) {
  try {
    const body = await req.json();
    const { productName, category, features, targetAudience, priceRange, competitors, mode } = body;
    if (!productName) return Response.json({ error: '제품명 필수' }, { status: 400 });

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY });

    const prompt = mode === 'competitor'
      ? `${category||'이미용가전'} "${productName}" 경쟁사 분석. 경쟁사: ${competitors||'다이슨,샤오미,유닉스,테스콤'}
분석: 1)경쟁사 상세페이지 구조 2)소구점 비교 3)오아 차별화 4)후킹카피 5개 5)비교표 항목
JSON으로 응답: {"competitors":[{"name":"","strengths":[""],"weaknesses":[""]}],"commonSections":[""],"differentiators":[""],"hookCopies":[""],"comparisonItems":[""],"insights":""}`
      : `오아(OA) "${productName}" 상세페이지 기획안.
카테고리:${category||'이미용가전'} 기능:${features||'미입력'} 타겟:${targetAudience||'20-40대 여성'} 가격:${priceRange||'미입력'} 경쟁:${competitors||'미입력'}
${OA_TEMPLATE}
JSON으로 응답: {"productName":"","mainCopy":"","subCopy":"","techBranding":"","slides":[{"page":1,"type":"cover","title":"","copy":"","imageGuide":"","notes":""}],"features":[{"icon":"","title":"","description":""}],"comparisonTable":{"headers":["항목","기존","오아"],"rows":[]},"specs":[{"label":"","value":""}],"copyTone":"","designTone":""}`;

    // 스트리밍
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 4000,
            stream: true,
            messages: [{ role: 'user', content: prompt }],
          });

          for await (const event of response) {
            if (event.type === 'content_block_delta' && event.delta?.text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
            }
            if (event.type === 'message_stop') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
            }
          }
        } catch (e) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: e.message })}\n\n`));
        }
        controller.close();
      }
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
    });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
