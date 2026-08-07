export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

// 템플릿 레퍼런스 분석: 따라하고 싶은 상세페이지 캡쳐 → 디자인을 모사한 HTML 템플릿 생성/저장
// 라이브러리: 만든 템플릿은 전부 저장, 썸네일로 미리보고 골라서 활성화 (렌더는 활성 키만 읽음)
// POST { images, name? } → 생성 + 라이브러리 저장 + 활성화
// POST { activate: id } / { remove: id } / { reset: true } / GET → 목록+활성 id

const KEY = 'oa_detail_html_template_v1';       // 활성 템플릿 (render가 읽는 키 — 구조 유지)
const LIB_KEY = 'oa_detail_html_templates_v1';  // 라이브러리 { items: [{id,name,html,thumb,createdAt}], activeId }

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

const getVal = async (sb, key) =>
  (await sb.from('settings').select('value').eq('key', key).maybeSingle()).data?.value || null;
const setVal = (sb, key, value) =>
  sb.from('settings').upsert({ key, value }, { onConflict: 'key' });

// 라이브러리 로드 (+구버전 단일 템플릿 자동 이관)
async function getLib(sb) {
  let lib = await getVal(sb, LIB_KEY);
  if (!lib) {
    const old = await getVal(sb, KEY);
    lib = { items: [], activeId: null };
    if (old?.html) {
      const id = 'legacy';
      lib.items.push({ id, name: '기존 템플릿', html: old.html, thumb: null, createdAt: old.updatedAt || new Date().toISOString() });
      lib.activeId = id;
    }
    await setVal(sb, LIB_KEY, lib);
  }
  return lib;
}

const publicList = (lib) => ({
  ok: true,
  active: !!lib.activeId,
  activeId: lib.activeId,
  items: lib.items.map(({ id, name, thumb, createdAt }) => ({ id, name, thumb, createdAt })),
});

export async function GET() {
  const lib = await getLib(getSupabase());
  return Response.json(publicList(lib));
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: '잘못된 요청' }, { status: 400 }); }

  const sb = getSupabase();

  if (body?.reset) {
    const lib = await getLib(sb);
    lib.activeId = null;
    await Promise.all([setVal(sb, LIB_KEY, lib), sb.from('settings').delete().eq('key', KEY)]);
    return Response.json(publicList(lib));
  }

  if (body?.activate) {
    const lib = await getLib(sb);
    const item = lib.items.find((t) => t.id === body.activate);
    if (!item) return Response.json({ error: '템플릿 없음' }, { status: 404 });
    lib.activeId = item.id;
    await Promise.all([
      setVal(sb, LIB_KEY, lib),
      setVal(sb, KEY, { html: item.html, updatedAt: new Date().toISOString() }),
    ]);
    return Response.json(publicList(lib));
  }

  if (body?.rename) {
    const lib = await getLib(sb);
    const item = lib.items.find((t) => t.id === body.rename);
    if (!item) return Response.json({ error: '템플릿 없음' }, { status: 404 });
    const name = String(body.name || '').trim().slice(0, 40);
    if (!name) return Response.json({ error: '이름 필수' }, { status: 400 });
    item.name = name;
    await setVal(sb, LIB_KEY, lib);
    return Response.json(publicList(lib));
  }

  if (body?.remove) {
    const lib = await getLib(sb);
    lib.items = lib.items.filter((t) => t.id !== body.remove);
    if (lib.activeId === body.remove) {
      lib.activeId = null;
      await sb.from('settings').delete().eq('key', KEY);
    }
    await setVal(sb, LIB_KEY, lib);
    return Response.json(publicList(lib));
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: 'ANTHROPIC_API_KEY 없음' }, { status: 500 });

  const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const images = (Array.isArray(body?.images) ? body.images : [])
    .filter((f) => f?.url && OK_TYPES.includes(f?.media_type))
    .slice(0, 8);
  if (!images.length) return Response.json({ error: '이미지 필수' }, { status: 400 });

  // 레퍼런스 페이지 URL이 있으면 실제 HTML/CSS 소스도 긁어서 분석에 포함 (컬러·폰트·간격 정확도 ↑)
  let refSource = '';
  const refUrl = String(body?.refUrl || '').trim();
  if (/^https?:\/\//.test(refUrl)) {
    try {
      const res = await fetch(refUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36' },
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        let src = (await res.text())
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/\s{2,}/g, ' ');
        // 쇼핑몰 통짜 페이지는 헤더/네비가 길어 상세 본문 구간을 중심으로 슬라이스 (카페24 등)
        const anchor = src.search(/prd_?Detail|ec-data-src|se2_inputarea|상세정보/i);
        if (anchor > 10000) src = src.slice(0, 4000) + '\n<!-- …중략… -->\n' + src.slice(anchor - 2000);
        refSource = src.slice(0, 60000);
      }
    } catch (e) {
      console.error('레퍼런스 HTML 수집 실패(캡쳐만으로 진행):', e.message);
    }
  }

  const prompt = `당신은 한국 이커머스 상세페이지 전문 웹퍼블리셔입니다.
첨부된 상세페이지 디자인 캡쳐를 분석해, 그 디자인 시스템(컬러 팔레트·타이포 위계·섹션 구조·뱃지/하이라이트 같은 장식 장치·여백 리듬)을 최대한 따라한 HTML 템플릿 한 개를 만드세요.
${refSource ? `\n## 레퍼런스 페이지 실제 소스 (컬러 hex·폰트·px 간격은 눈대중 말고 여기서 정확히 추출)\n\`\`\`html\n${refSource}\n\`\`\`\n` : ''}

## 규칙
- 폭 860px 고정, 순수 HTML+인라인 <style> 한 파일. 외부 리소스는 폰트만 허용:
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/sun-typeface/SUIT/fonts/variable/woff2/SUIT-Variable.css">
  그리고 필요하면 <style> 안에 아래 @font-face 사용 가능 (다른 URL 발명 금지):
  @font-face{font-family:'Paperlogy';src:url('https://fastly.jsdelivr.net/gh/projectnoonnu/2408-3@1.0/Paperlogy-8ExtraBold.woff2') format('woff2');font-weight:800}
  @font-face{font-family:'GmarketSans';src:url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/GmarketSansBold.woff') format('woff');font-weight:700}
  본문은 'Pretendard' 기본. 헤드라인은 레퍼런스 무드에 맞춰 선택 — 임팩트/프로모션 무드면 'Paperlogy' 또는 'GmarketSans', 모던/미니멀이면 'SUIT Variable' 또는 Pretendard 고밀도 웨이트. 폴백 'Apple SD Gothic Neo',sans-serif 필수.
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
- **타이포 위계 필수** (레퍼런스가 어떻든 이 최소 기준은 지킬 것 — 모바일에서 읽히는 크기):
  훅 메인 헤드라인 46~56px/weight 850/letter-spacing -0.03em, 섹션 헤드라인 34~42px/800,
  서브카피 19~22px/500, 본문 16~17px/400/line-height 1.75, 캡션·라벨 13~14px.
  같은 섹션 안에서 헤드라인:본문 크기 대비 최소 2.2배. 본문 한 줄 최대 32자 느낌으로.
- 여백 리듬: 섹션 상하 패딩 80~110px, 헤드라인↔본문 사이 20~28px — 답답하게 붙이지 말 것.
- 이미지 플레이스홀더는 <img src="{{…}}" style="width:100%;display:block"> 기본, 디자인에 맞게 radius 등 조정.
- 섹션 순서는 첨부 디자인의 흐름을 따르되 위 데이터가 전부 들어가야 함 (훅→USP 3개→사용씬→스펙→인증→FAQ→CTA 골격 안에서 변형).
- **이미지 구성도 레퍼런스를 따라할 것**: 레퍼런스가 이미지를 어떻게 쓰는지 관찰해 동일하게 —
  풀블리드(여백 없이 꽉 채움)/카드형(radius+그림자)/텍스트 오버레이/좌우 분할 등 배치 방식,
  이미지 크기 비중(이미지가 큰 페이지면 크게), 이미지와 텍스트의 리듬(교차 배치 등)을 모사.
  레퍼런스에 움직임(GIF/영상 프레임)이 들어간 구간이 보이면 그 위치의 섹션을 반드시 독립 섹션으로 분리
  (서버가 섹션 사이에 GIF 조각을 끼우는 구조라, 경계가 있어야 모션을 넣을 수 있음).
- 각 섹션은 <body> 바로 아래 최상위 요소로 (서버가 섹션 경계에서 이미지를 자름).

## 출력
<!DOCTYPE html>로 시작하는 완성 HTML만 출력. 설명·마크다운 코드블록 금지.`;

  try {
    const client = new Anthropic({ apiKey });
    // Anthropic URL 다운로드 간헐 실패 → 서버가 직접 받아 base64로 전달
    const blocks = await Promise.all(images.map(async (f) => {
      const res = await fetch(f.url);
      if (!res.ok) throw new Error(`캡쳐 다운로드 실패 ${res.status}`);
      const data = Buffer.from(await res.arrayBuffer()).toString('base64');
      return { type: 'image', source: { type: 'base64', media_type: f.media_type, data } };
    }));
    // 긴 HTML 생성이라 스트리밍으로 수집 (논스트리밍은 타임아웃)
    const stream = client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 16000,
      messages: [{ role: 'user', content: [...blocks, { type: 'text', text: prompt }] }],
    });
    const msg = await stream.finalMessage();
    const text = (msg.content || []).find((b) => b.type === 'text')?.text || '';
    const html = text.replace(/^```html?\s*|```\s*$/g, '').trim();
    if (!html.toLowerCase().startsWith('<!doctype')) throw new Error('HTML 생성 실패: ' + html.slice(0, 80));

    // 라이브러리에 저장 + 활성화 (썸네일 = 첫 캡쳐 조각)
    const lib = await getLib(sb);
    const d = new Date();
    const item = {
      id: d.getTime().toString(36),
      name: String(body?.name || '').slice(0, 40) || `템플릿 ${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      html,
      thumb: images[0]?.url || null,
      createdAt: d.toISOString(),
    };
    lib.items.push(item);
    lib.activeId = item.id;
    const [{ error }, { error: e2 }] = await Promise.all([
      setVal(sb, LIB_KEY, lib),
      setVal(sb, KEY, { html, updatedAt: item.createdAt }),
    ]);
    if (error || e2) throw error || e2;
    return Response.json({ ...publicList(lib), bytes: html.length });
  } catch (e) {
    console.error('detail/style 실패:', e);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
