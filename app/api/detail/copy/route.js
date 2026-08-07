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
  const raw = String(body?.raw || '').slice(0, 8000);
  const productName = String(body?.productName || '').slice(0, 100);
  // 첨부 자료 (캡쳐 이미지/PDF, Storage 공개 URL) — 비전으로 제품 정보 추출
  const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
  const files = (Array.isArray(body?.files) ? body.files : [])
    .filter((f) => f?.url && OK_TYPES.includes(f?.media_type))
    .slice(0, 5);
  if (!productName && !raw && !files.length)
    return Response.json({ error: 'productName·raw·files 중 하나 필수' }, { status: 400 });
  const category = String(body?.category || '').slice(0, 100);
  const specs = String(body?.specs || '').slice(0, 2000);
  const points = (Array.isArray(body?.points) ? body.points : []).map((p) => String(p).slice(0, 200)).filter(Boolean);
  const tagline = String(body?.tagline || '현명한 당신, 오아하시네요').slice(0, 100);

  const prompt = `당신은 억대 매출 상세페이지를 만들어온 이커머스 전문 카피라이터입니다. 생활가전 브랜드 "오아(OA)"의 상세페이지를 씁니다. 와디즈 펀딩 1위 제품, 무신사·올리브영 베스트셀러 상세페이지의 톤을 참고하세요.

## 잘 팔리는 카피 원칙 (반드시 지킬 것)
1. **후킹은 고객의 짜증나는 순간을 생생하게**: "또 이러네…" 싶은 구체적 장면을 건드려서 "어 이거 내 얘기인데?"가 되게. 제품 얘기로 시작 금지
2. **스펙이 아니라 삶의 변화**: "바람이 강하다"(X) → "드라이 시간이 반으로"(O). 모든 USP는 "그래서 고객의 하루가 어떻게 좋아지는데?"에 답할 것
3. **숫자는 무기**: 입력 자료에 있는 수치(풍속·용량·시간·데시벨)는 비교와 함께 활용 — "기존 제품의 2배", "단 8분". 없는 수치를 지어내진 말 것
4. **헤드라인 공식 활용**: 전후 대비("어제까진 몰랐던"), 질문("아직도 ~하세요?"), 단호한 선언("드라이는 8분이면 끝"), 의외성 등 — 밋밋한 명사 나열 금지
5. **리듬**: 짧게 끊는 단문. 읽는 맛이 나게. 다만 과장 광고 문구("최고", "혁신적인" 남발)와 유아어는 금지 — 자신감 있고 세련되게
6. **cta는 지금 사야 할 이유**: 막연한 "만나보세요" 금지 — 오늘 밤부터 달라질 일상을 한 번 더 상기시키고 등을 밀어줄 것
7. faq도 판매 도구: 구매를 막는 진짜 망설임(소음? A/S? 세척?)을 골라 확신을 주는 답변으로

## 오아 톤앤매너
- 자신감 있는 단문, 세련된 위트 허용. 싸구려 과장 금지
- 태그라인 "${tagline}" 결 유지

## 제품 정보
${files.length ? `### 첨부 자료 ${files.length}건 (캡쳐/PDF — 여기서 제품명·카테고리·스펙·소구점을 직접 추출하세요)
` : ''}${raw ? `### 붙여넣은 원본 자료 (여기서 제품명·카테고리·스펙·소구점을 직접 추출하세요)
${raw}
` : ''}- 제품명: ${productName || '(미입력 — 원본 자료에서 추출)'}
- 카테고리: ${category || '(미입력 — 원본 자료에서 추출)'}
- 스펙:
${specs || (raw ? '(원본 자료에서 추출)' : '(미입력)')}
- 핵심 소구점:
${points.length ? points.map((p, i) => `${i + 1}. ${p}`).join('\n') : '(미입력 — 스펙에서 유추)'}

## 출력
아래 JSON 스키마를 정확히 따라 순수 JSON만 출력하세요 (마크다운 코드블록 금지).
줄바꿈이 필요한 headline은 \\n 사용.
image 필드는 전부 빈 문자열 "".

{
  "productName": "${productName || '(원본 자료에서 추출한 제품명)'}",
  "category": "${category || '(원본 자료에서 추출한 카테고리)'}",
  "tagline": "${tagline}",
  "hook": { "headline": "고객의 짜증나는 순간 후킹 (2줄, \\n 구분)", "sub": "한 줄 보조 — 해결 암시", "image": "" },
  "usp": [
    { "headline": "소구점1 — 헤드라인 공식 적용", "desc": "혜택(삶의 변화) 중심 한 줄, 수치 있으면 활용", "image": "" },
    { "headline": "소구점2 — 헤드라인 공식 적용", "desc": "혜택 중심 한 줄", "image": "" },
    { "headline": "소구점3 — 헤드라인 공식 적용", "desc": "혜택 중심 한 줄", "image": "" }
  ],
  "scene": { "headline": "사용씬 헤드라인", "images": ["", ""] },
  "specs": [ { "label": "제품명", "value": "오아 ${productName}" } ],
  "cert": { "headline": "믿고 쓰는 이유", "items": ["인증/시험 항목"], "image": "" },
  "faq": [ { "q": "질문", "a": "답변" } ],
  "cta": { "headline": "구매 유도 헤드라인", "image": "" },
  "cutPrompts": {
    "hook": "영어 이미지 프롬프트",
    "usp1": "...", "usp2": "...", "usp3": "...",
    "scene1": "...", "scene2": "...", "cert": "...", "packshot": "..."
  }
}

specs 배열은 입력 스펙을 label/value로 정리 (5~7행), faq는 구매 망설임 해소 2~3개.

cutPrompts는 각 섹션의 AI 이미지 생성 프롬프트 (영어, 각 1~2문장):
- 제품은 반드시 "the product"로 지칭 (실사 참조 이미지가 따로 들어감), 이미지 안에 글자/텍스트 오버레이 금지
- ★usp1~3이 가장 중요: 위 usp 배열의 소구점 1~3과 각각 1:1 대응 — 그 소구점이 사진만 봐도 즉시 전달되게 "효과를 시각화"할 것. 예: 강력한 바람=휘날리는 리본이나 흐르는 공기 스트림, 미세 진동=역동적 모션 블러와 물방울 튐, 저소음=고요한 새벽 침실 무드, 대용량 배터리=장시간 사용 암시 소품. 단순 제품 클로즈업 금지
- usp1~3은 나중에 GIF/영상으로 확장되므로 정지컷이어도 모션이 암시되는 장면(바람·스팀·물줄기·입자·빛 등이 흐르는 순간 포착)으로
- hook은 문제상황이나 극적 무드, scene1~2는 한국 가정 라이프스타일, cert는 신뢰/실험실 무드, packshot은 흰 배경 정면`;

  try {
    const client = new Anthropic({ apiKey: key });
    const blocks = files.map((f) =>
      f.media_type === 'application/pdf'
        ? { type: 'document', source: { type: 'url', url: f.url } }
        : { type: 'image', source: { type: 'url', url: f.url } }
    );
    const msg = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 3500,
      messages: [{ role: 'user', content: [...blocks, { type: 'text', text: prompt }] }],
    });
    const text = (msg.content || []).find((b) => b.type === 'text')?.text || '';
    const jsonStr = text.replace(/^```json?\s*|```\s*$/g, '').trim();
    const product = JSON.parse(jsonStr);
    return Response.json({ ok: true, product });
  } catch (e) {
    console.error('detail/copy 실패:', e);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
