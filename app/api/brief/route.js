export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import Anthropic from '@anthropic-ai/sdk';

// 재제작 요청 AI 브리프: 부진 소재 + 상위 성과 소재 패턴 → 훅/카피 아이디어 3개
export async function POST(request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: 'ANTHROPIC_API_KEY 없음' }, { status: 500 });

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: '잘못된 요청' }, { status: 400 }); }
  const adName = String(body?.adName || '').slice(0, 200);
  if (!adName) return Response.json({ error: 'adName 필수' }, { status: 400 });
  const appeal = String(body?.appeal || '').slice(0, 50);
  const roas = String(body?.roas || '').slice(0, 20);
  const note = String(body?.note || '').slice(0, 300);
  // 상위 성과 소재 [{adName, appeal, roas, spend}] (대시보드에서 전달)
  const topAds = Array.isArray(body?.topAds) ? body.topAds.slice(0, 8) : [];

  // 카피뱅크: 상품 문의 기반 망설임 (scripts/copy-bank.py → oa_copy_bank_v1) — 실패해도 무시
  let hesitations = [];
  try {
    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supaUrl && supaKey) {
      const r = await fetch(`${supaUrl}/rest/v1/settings?key=eq.oa_copy_bank_v1&select=value`,
        { headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` } });
      const rows = await r.json();
      const cb = rows?.[0]?.value || {};
      const all = (cb._qna_beauty?.hesitations || cb._qna?.hesitations || []);
      // 광고명과 제품이 겹치는 망설임 우선, 없으면 상위 6개
      const tokens = adName.split(/[\s_\-·/]+/).filter(t => t.length >= 2);
      const rel = all.filter(h => tokens.some(t => (h.product || '').includes(t)));
      hesitations = (rel.length ? rel : all).slice(0, 6);
    }
  } catch { /* 카피뱅크 없어도 브리프는 생성 */ }

  const prompt = `당신은 이미용 가전(드라이기·고데기·갈바닉·화장거울) 브랜드 "오아"의 메타(페이스북/인스타) 광고 소재 기획자입니다.

아래 부진 소재를 대체할 새 소재 브리프를 작성해주세요.

## 재제작 대상 (부진 소재)
- 광고명: ${adName}
- 소구 유형: ${appeal || '미분류'}
- ROAS: ${roas || '?'}%
${note ? `- 메모: ${note}` : ''}

## 최근 성과 좋은 소재 (참고 패턴)
${topAds.length ? topAds.map(a => `- ${a.adName} (${a.appeal || '?'}, ROAS ${a.roas}%, 지출 ${Math.round((a.spend || 0) / 10000)}만원)`).join('\n') : '- (데이터 없음)'}

${hesitations.length ? `## 고객 구매 망설임 (최근 6개월 실제 상품 문의 분석 — 선제 대응하면 전환 상승)
${hesitations.map(h => `- ${h.question} (약 ${h.count || '?'}회) → 대응: ${h.counter || ''}`).join('\n')}

` : ''}## 소재 제작 5원칙
1. 첫 1초 훅이 전부 — 스크롤 멈추게 하는 비주얼/카피
2. 제품보다 상황 — 사용 맥락(출근 준비, 여행, 습한 날)을 먼저 보여주기
3. 소구 하나만 — 한 소재에 한 메시지
4. 자막 필수 — 무음 시청 대응
5. CTA는 구체적으로

## 요청
성과 좋은 소재의 패턴을 반영해 새 소재 아이디어 3개를 제안하세요. 각각:
- hook: 첫 1초 훅 (비주얼 + 카피 한 줄)
- copy: 메인 카피 (1~2문장)
- appeal: 소구 유형 (상황/가격/기능/협력 중 하나)
- why: 이 방향을 추천하는 이유 (성과 데이터 근거, 1문장)

JSON 배열만 출력하세요. 다른 텍스트 없이:
[{"hook":"...","copy":"...","appeal":"...","why":"..."}]`;

  try {
    const client = new Anthropic({ apiKey: key });
    const msg = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = msg.content?.[0]?.text || '';
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) return Response.json({ error: 'AI 응답 파싱 실패', raw: text.slice(0, 500) }, { status: 502 });
    const ideas = JSON.parse(m[0]);
    return Response.json({ ok: true, ideas });
  } catch (e) {
    return Response.json({ error: e.message || 'AI 호출 실패' }, { status: 502 });
  }
}
