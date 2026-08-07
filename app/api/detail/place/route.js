export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import Anthropic from '@anthropic-ai/sdk';

// GIF/추가컷 자동 배치 — 컷 라벨 ↔ 상세페이지 섹션 내용 매칭 (haiku)
// POST { sections: string[], items: [{id, label}] } → { ok, placements: [{id, after}] }
export async function POST(request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: 'ANTHROPIC_API_KEY 없음' }, { status: 500 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: '잘못된 요청' }, { status: 400 }); }
  const sections = (Array.isArray(body?.sections) ? body.sections : []).map((s) => String(s).slice(0, 80)).slice(0, 30);
  const items = (Array.isArray(body?.items) ? body.items : [])
    .map((i) => ({ id: String(i?.id || ''), label: String(i?.label || '').slice(0, 60) }))
    .filter((i) => i.id)
    .slice(0, 20);
  if (!sections.length || !items.length) return Response.json({ ok: true, placements: [] });

  const prompt = `상세페이지의 섹션 목록과, 페이지 사이사이에 끼워 넣을 추가 이미지(모델컷/GIF) 목록입니다.
각 이미지를 내용이 가장 잘 어울리는 섹션 "뒤"에 배치하세요.

## 섹션 (1부터)
${sections.map((s, i) => `${i + 1}. ${s}`).join('\n')}

## 배치할 이미지
${items.map((it) => `- id "${it.id}": ${it.label}`).join('\n')}

## 규칙
- 비포/부정 컷은 문제 제기(후킹) 섹션 근처, 애프터/긍정·헤어모션·사용컷은 관련 USP나 사용씬 근처, 전신샷·클로즈업은 라이프스타일/씬 근처
- 같은 섹션에 몰지 말고 페이지 전체에 리듬 있게 분산
- 순수 JSON만 출력: {"placements":[{"id":"...","after":섹션번호}]}`;

  try {
    const client = new Anthropic({ apiKey: key });
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = (msg.content || []).find((b) => b.type === 'text')?.text || '';
    const cleaned = text.replace(/^```json?\s*|```\s*$/g, '').trim();
    const parsed = JSON.parse((cleaned.match(/\{[\s\S]*\}/) || [cleaned])[0]);
    const placements = (parsed.placements || [])
      .map((p) => ({ id: String(p.id), after: Number(p.after) || 0 }))
      .filter((p) => p.after >= 1 && p.after <= sections.length);
    return Response.json({ ok: true, placements });
  } catch (e) {
    console.error('detail/place 실패:', e);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
