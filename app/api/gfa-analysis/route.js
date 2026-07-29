export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import Anthropic from '@anthropic-ai/sdk';

// GFA 리포트(oa_gfa_report_v1) → 집계 → Claude 판단 (OFF/증액/예산이동 등 액션 추천)
export async function POST(request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: 'ANTHROPIC_API_KEY 없음' }, { status: 500 });

  // 사용자가 "실행함"으로 표시한 과거 액션 목록 (효과 리뷰용)
  const body = await request.json().catch(() => ({}));
  const executed = Array.isArray(body?.executed) ? body.executed.slice(0, 20) : [];

  // 리포트 로드
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supaUrl || !supaKey) return Response.json({ error: 'Supabase 환경변수 없음' }, { status: 500 });
  const r = await fetch(`${supaUrl}/rest/v1/settings?key=eq.oa_gfa_report_v1&select=value`,
    { headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` } });
  const report = (await r.json())?.[0]?.value;
  const rows = report?.rows || [];
  if (!rows.length) return Response.json({ error: 'GFA 리포트가 없습니다 — CSV를 먼저 업로드해주세요' }, { status: 400 });
  const TARGET = report?.targetRoas || 300;

  // ── 집계 ──
  const n = v => Number(v) || 0;
  const typeOf = name => { const t = (String(name || '').split('_').pop() || '').trim(); return /형/.test(t) ? t : '(기타)'; };
  const objOf = camp => /트래픽/.test(String(camp || '')) ? '트래픽' : '전환';
  const prodOf = name => String(name || '').split(/[_ ]/)[0] || '(기타)';
  const acc = (map, k, r2, extra) => {
    const a = map[k] = map[k] || { cost: 0, imp: 0, clk: 0, buy: 0, rev: 0, names: new Set(), ...extra };
    a.cost += n(r2.cost); a.imp += n(r2.imp); a.clk += n(r2.clk); a.buy += n(r2.buy); a.rev += n(r2.rev);
    a.names.add(r2.name);
  };
  const typeMap = {}, prodMap = {}, creaMap = {}, bannerMap = {};
  rows.forEach(r2 => {
    acc(typeMap, `${objOf(r2.camp)}|${typeOf(r2.name)}`, r2);
    acc(prodMap, prodOf(r2.name), r2);
    acc(creaMap, `[${r2.camp}] ${r2.name}`, r2); // 같은 소재명이 여러 캠페인에 있으면 분리 (합산 오인 방지)
    const ty = typeOf(r2.name);
    if (/배너형/.test(ty)) acc(bannerMap, `${prodOf(r2.name)}|${/PC/.test(ty) ? 'PC' : '모바일'}`, r2);
  });
  const line = (label, a) => {
    const ctr = a.imp ? (a.clk / a.imp * 100) : 0;
    const roas = a.cost ? (a.rev / a.cost * 100) : 0;
    return `${label}: 지출 ${Math.round(a.cost).toLocaleString()}원, 노출 ${Math.round(a.imp).toLocaleString()}, CTR ${ctr.toFixed(2)}%, 구매 ${a.buy}건, 매출 ${Math.round(a.rev).toLocaleString()}원, ROAS ${roas.toFixed(0)}%`;
  };
  const fmtMap = (map, top) => Object.entries(map)
    .sort((a, b) => b[1].cost - a[1].cost).slice(0, top || 99)
    .map(([k, a]) => line(k, a)).join('\n');

  const prompt = `당신은 생활가전 브랜드 "오아"의 네이버 GFA(성과형 DA) 광고 운용 전략가입니다.
아래는 소재별 리포트 집계입니다. 목표 ROAS는 ${TARGET}%, 모든 전환 지표는 구매완료 기준(장바구니 제외)입니다.
소재명 규칙: "제품명_컨셉 N_지면유형" (배너형(PC)/배너형(모바일)/피드형/스퀘어형/피드형(2:3)). 캠페인은 전환/트래픽/맞춤타겟 목적으로 나뉩니다.

## 목적×유형별 (캠페인목적|지면유형)
${fmtMap(typeMap)}

## 제품별
${fmtMap(prodMap)}

## 배너형 PC vs 모바일 (제품|디바이스)
${fmtMap(bannerMap)}

## 소재별 지출 상위 20 ([캠페인] 소재명 — 같은 소재명이라도 캠페인이 다르면 별도 행)
${fmtMap(creaMap, 20)}

주의: 소재 지출을 언급할 때 반드시 해당 캠페인 한 줄의 금액만 인용하세요. 여러 캠페인의 동일 소재명을 합쳐 말하지 마세요.
${executed.length ? `
## 이전에 실행한 액션 (사용자가 실제로 실행했다고 표시)
${executed.map(e => `- [${e.action}] ${e.target} — ${String(e.executedAt || '').slice(0, 10)} 실행, 실행시점 전체: 지출 ${Math.round(e.baseline?.cost || 0).toLocaleString()}원 / 구매 ${e.baseline?.buy ?? '?'}건 / ROAS ${e.baseline?.roas ?? '?'}%`).join('\n')}

위 실행 액션들이 효과가 있었는지 현재 데이터와 비교 평가하세요. 새 추천(actions)은 이미 실행한 것과 중복되지 않게 하세요.` : ''}

## 판단 원칙
- 지출 3만원 미만은 판단 보류 (데이터 부족)
- 트래픽 캠페인은 CTR·CPC 위주로, 전환 캠페인은 ROAS·구매 위주로 판단
- OFF 추천은 "충분히 쓰고 구매 0" 또는 "ROAS 극히 저조"일 때만
- 증액은 목표 ROAS 근접/초과 소재, 2배씩 점진
- 유형/디바이스 단위 패턴(예: 특정 제품군의 PC 배너 전멸)을 우선 발굴 — 소재 하나하나보다 묶음 판단이 실행하기 쉬움
- 예산 이동 추천 시 "어디서 빼서 어디로"를 명확히

## 요청
바로 실행 가능한 액션을 최대 6개 제안하세요. JSON만 출력:
{"summary":"현 상황 한 줄 총평","actions":[{"action":"OFF|증액|예산이동|테스트|유지","target":"대상 (제품/유형/소재 묶음)","reason":"데이터 근거 1문장 (숫자 포함)","impact":"기대 효과 1문장"}]${executed.length ? `,"review":[{"target":"실행 액션의 target 문자열 그대로","verdict":"효과있음|효과없음|판단보류","note":"현재 지표 근거 1문장 (숫자 포함)"}]` : ''}}`;

  try {
    const client = new Anthropic({ apiKey: key });
    const msg = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: executed.length ? 2400 : 1800,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = msg.content?.[0]?.text || '';
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return Response.json({ error: 'AI 응답 파싱 실패', raw: text.slice(0, 500) }, { status: 502 });
    const analysis = JSON.parse(m[0]);
    return Response.json({ ok: true, analysis, reportId: report.uploadedAt || '', fileName: report.fileName || '' });
  } catch (e) {
    return Response.json({ error: e.message || 'AI 호출 실패' }, { status: 502 });
  }
}
