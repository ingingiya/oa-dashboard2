export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

// 템플릿 레퍼런스 분석: 따라하고 싶은 상세페이지 캡쳐 → 디자인을 모사한 HTML 템플릿 생성/저장
// POST { images: [{ url, media_type }] } → settings 키 oa_detail_html_template_v1 저장
// POST { reset: true } → 템플릿 해제
// GET → 현재 템플릿 유무

const KEY = 'oa_detail_html_template_v1';

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

export async function GET() {
  const { data } = await getSupabase().from('settings').select('value').eq('key', KEY).maybeSingle();
  return Response.json({ ok: true, active: !!data?.value?.html, updatedAt: data?.value?.updatedAt || null });
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: '잘못된 요청' }, { status: 400 }); }

  if (body?.reset) {
    await getSupabase().from('settings').delete().eq('key', KEY);
    return Response.json({ ok: true, active: false });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: 'ANTHROPIC_API_KEY 없음' }, { status: 500 });

  const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const images = (Array.isArray(body?.images) ? body.images : [])
    .filter((f) => f?.url && OK_TYPES.includes(f?.media_type))
    .slice(0, 8);
  if (!images.length) return Response.json({ error: '이미지 필수' }, { status: 400 });

  const prompt = `당신은 한국 이커머스 상세페이지 전문 웹퍼블리셔입니다.
첨부된 상세페이지 디자인 캡쳐를 분석해, 그 디자인 시스템(컬러 팔레트·타이포 위계·섹션 구조·뱃지/하이라이트 같은 장식 장치·여백 리듬)을 최대한 따라한 HTML 템플릿 한 개를 만드세요.

## 규칙
- 폭 860px 고정, 순수 HTML+인라인 <style> 한 파일. 외부 리소스는 폰트 CSS 한 개만:
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
  font-family는 'Pretendard','Apple SD Gothic Neo',sans-serif 기본.
- 사진/일러스트 넣지 말 것 — 이미지는 아래 플레이스홀더 URL만. 장식은 전부 CSS(그라데이션·뱃지·형광펜 하이라이트 등)로.
- 데이터는 이중 중괄호 플레이스홀더 그대로 출력 (치환은 서버가 함):
  {{productName}} {{tagline}}
  {{hook.headline}} {{hook.sub}} {{hook.image}}
  {{usp[0].headline}} {{usp[0].desc}} {{usp[0].image}} (usp는 0~2 세 개 모두)
  {{scene.headline}} {{scene.images[0]}} {{scene.images[1]}}
  {{cert.headline}} {{cert.image}}
  {{cta.headline}} {{cta.image}}
  {{specsTable}} → 서버가 <table class="specs-table"><tr><th>라벨</th><td>값</td></tr>…</table>로 치환
  {{certItems}} → 서버가 <li>항목</li>… 로 치환 (ul로 감쌀 것)
  {{faqItems}} → 서버가 <div class="faq-item"><div class="q">Q…</div><div class="a">A…</div></div>… 로 치환
  → .specs-table, .faq-item .q/.a 클래스를 CSS로 스타일링하세요.
- headline 류는 줄바꿈 포함 가능 → white-space:pre-line.
- 이미지 플레이스홀더는 <img src="{{…}}" style="width:100%;display:block"> 기본, 디자인에 맞게 radius 등 조정.
- 섹션 순서는 첨부 디자인의 흐름을 따르되 위 데이터가 전부 들어가야 함 (훅→USP 3개→사용씬→스펙→인증→FAQ→CTA 골격 안에서 변형).
- 각 섹션은 <body> 바로 아래 최상위 요소로 (서버가 섹션 경계에서 이미지를 자름).

## 출력
<!DOCTYPE html>로 시작하는 완성 HTML만 출력. 설명·마크다운 코드블록 금지.`;

  try {
    const client = new Anthropic({ apiKey });
    const blocks = images.map((f) => ({ type: 'image', source: { type: 'url', url: f.url } }));
    // 긴 HTML 생성이라 스트리밍으로 수집 (논스트리밍은 타임아웃)
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      messages: [{ role: 'user', content: [...blocks, { type: 'text', text: prompt }] }],
    });
    const msg = await stream.finalMessage();
    const text = (msg.content || []).find((b) => b.type === 'text')?.text || '';
    const html = text.replace(/^```html?\s*|```\s*$/g, '').trim();
    if (!html.toLowerCase().startsWith('<!doctype')) throw new Error('HTML 생성 실패: ' + html.slice(0, 80));

    const { error } = await getSupabase()
      .from('settings')
      .upsert({ key: KEY, value: { html, updatedAt: new Date().toISOString() } }, { onConflict: 'key' });
    if (error) throw error;
    return Response.json({ ok: true, active: true, bytes: html.length });
  } catch (e) {
    console.error('detail/style 실패:', e);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
