export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import Anthropic from '@anthropic-ai/sdk';

// 상세페이지 카피 생성: 제품 정보 폼 입력 → 섹션별 카피 product JSON
// POST body: { productName, category, specs, points[], tagline? }
export async function POST(request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: 'ANTHROPIC_API_KEY 없음' }, { status: 500 });

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: '잘못된 요청' }, { status: 400 }); }
  const productName = String(body?.productName || '').slice(0, 100);
  if (!productName) return Response.json({ error: 'productName 필수' }, { status: 400 });
  const category = String(body?.category || '').slice(0, 100);
  const specs = String(body?.specs || '').slice(0, 2000);
  const points = (Array.isArray(body?.points) ? body.points : []).map((p) => String(p).slice(0, 200)).filter(Boolean);
  const tagline = String(body?.tagline || '현명한 당신, 오아하시네요').slice(0, 100);

  const prompt = `당신은 생활가전 브랜드 "오아(OA)"의 상세페이지 카피라이터입니다.

## 오아 톤앤매너
- 담백하고 자신감 있는 단문. 과장·유아어 금지
- 문제 제기(후킹)는 고객이 겪는 구체적 상황으로
- 태그라인 "${tagline}" 결 유지

## 제품 정보
- 제품명: ${productName}
- 카테고리: ${category || '(미입력)'}
- 스펙:
${specs || '(미입력)'}
- 핵심 소구점:
${points.length ? points.map((p, i) => `${i + 1}. ${p}`).join('\n') : '(미입력 — 스펙에서 유추)'}

## 출력
아래 JSON 스키마를 정확히 따라 순수 JSON만 출력하세요 (마크다운 코드블록 금지).
줄바꿈이 필요한 headline은 \\n 사용.
image 필드는 전부 빈 문자열 "".

{
  "productName": "${productName}",
  "category": "${category}",
  "tagline": "${tagline}",
  "hook": { "headline": "문제제기 헤드라인 (2줄, \\n 구분)", "sub": "한 줄 보조", "image": "" },
  "usp": [
    { "headline": "소구점1 헤드라인", "desc": "한 줄 설명", "image": "" },
    { "headline": "소구점2 헤드라인", "desc": "한 줄 설명", "image": "" },
    { "headline": "소구점3 헤드라인", "desc": "한 줄 설명", "image": "" }
  ],
  "scene": { "headline": "사용씬 헤드라인", "images": ["", ""] },
  "specs": [ { "label": "제품명", "value": "오아 ${productName}" } ],
  "cert": { "headline": "믿고 쓰는 이유", "items": ["인증/시험 항목"], "image": "" },
  "faq": [ { "q": "질문", "a": "답변" } ],
  "cta": { "headline": "구매 유도 헤드라인", "image": "" }
}

specs 배열은 입력 스펙을 label/value로 정리 (5~7행), faq는 구매 망설임 해소 2~3개.`;

  try {
    const client = new Anthropic({ apiKey: key });
    const msg = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = msg.content?.[0]?.text || '';
    const jsonStr = text.replace(/^```json?\s*|```\s*$/g, '').trim();
    const product = JSON.parse(jsonStr);
    return Response.json({ ok: true, product });
  } catch (e) {
    console.error('detail/copy 실패:', e);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
