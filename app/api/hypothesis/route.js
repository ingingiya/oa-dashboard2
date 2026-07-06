export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 데이터 조회 + AI 생성에 시간 필요

import Anthropic from '@anthropic-ai/sdk';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sH = {
  apikey: SUPA_KEY,
  Authorization: `Bearer ${SUPA_KEY}`,
  'Content-Type': 'application/json',
};

// 이미용 카테고리 코드 (드라이기, 고데기, 갈바닉, 화장거울)
const BEAUTY_CODES = ['DRY','STR','GVN','MUM'];

// Supabase beauty_sales에서 최근 14일 이미용 데이터 조회 (매일 MySQL→Supabase 동기화됨)
// Vercel에서 MySQL 직접 접속이 차단되어 있어 동기화 테이블 사용
async function fetchSalesData() {
  const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
  const dstr = (d) => new Date(kstNow.getTime() - d * 86400000).toISOString().split('T')[0];
  const from14 = dstr(14);
  const from7 = dstr(7);
  const yesterdayDate = dstr(1);

  // 페이지네이션으로 14일치 전체 조회
  const all = [];
  const PAGE = 1000;
  for (let offset = 0; offset < 50000; offset += PAGE) {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/beauty_sales?select=name,channel,date,qty,revenue&date=gte.${from14}&cat_id=in.(${BEAUTY_CODES.join(',')})&order=date.desc`,
      { headers: { ...sH, Range: `${offset}-${offset + PAGE - 1}` }, cache: 'no-store' }
    );
    if (!res.ok) throw new Error(`판매 데이터 조회 실패: ${await res.text()}`);
    const page = await res.json();
    all.push(...page);
    if (page.length < PAGE) break;
  }

  // 전주 vs 이번주 제품별 집계
  const byProduct = {};
  for (const r of all) {
    const p = byProduct[r.name] = byProduct[r.name] ||
      { name: r.name, this_week: 0, last_week: 0, this_revenue: 0, last_revenue: 0 };
    if (r.date >= from7) {
      p.this_week += Number(r.qty) || 0;
      p.this_revenue += Number(r.revenue) || 0;
    } else {
      p.last_week += Number(r.qty) || 0;
      p.last_revenue += Number(r.revenue) || 0;
    }
  }
  const trend = Object.values(byProduct)
    .filter(p => p.this_week > 0 || p.last_week > 0)
    .sort((a, b) => Math.abs(b.this_week - b.last_week) - Math.abs(a.this_week - a.last_week))
    .slice(0, 30);

  // 어제 제품×채널별 집계
  const byChannel = {};
  for (const r of all) {
    if (r.date !== yesterdayDate) continue;
    const key = `${r.name}|${r.channel}`;
    const c = byChannel[key] = byChannel[key] ||
      { name: r.name, channel: r.channel || '기타', qty: 0, revenue: 0 };
    c.qty += Number(r.qty) || 0;
    c.revenue += Number(r.revenue) || 0;
  }
  const yesterday = Object.values(byChannel)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 30);

  return { trend, yesterday };
}

async function generateHypotheses(salesData) {
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY 환경변수가 없어요');

  const fmt = (n) => Math.round(Number(n) / 10000);
  const trendText = salesData.trend.map(r =>
    `${r.name}: 지난주 ${r.last_week}개(${fmt(r.last_revenue)}만원) → 이번주 ${r.this_week}개(${fmt(r.this_revenue)}만원)`
  ).join('\n');
  const yesterdayText = salesData.yesterday.map(r =>
    `${r.name} [${r.channel}]: ${r.qty}개, ${fmt(r.revenue)}만원`
  ).join('\n');

  const prompt = `당신은 OA 뷰티(이미용 브랜드)의 판매 데이터 분석가입니다. 아래 데이터를 보고 가설을 만드세요.

## 주간 판매 변화 (전주 vs 이번주, 변동 큰 순)
${trendText}

## 어제 판매 (채널별)
${yesterdayText}

## 출력 형식 (반드시 JSON 배열만, 다른 텍스트 없이)
[
  {"type":"원인분석","product":"제품명","hypothesis":"판매 변동의 원인 가설 (1-2문장)","evidence":"근거가 된 숫자","priority":"high|mid|low"},
  {"type":"마케팅액션","product":"제품명","hypothesis":"다음에 시도해볼 마케팅/광고 액션 가설 (1-2문장)","evidence":"근거가 된 숫자","priority":"high|mid|low"}
]

## 규칙
- 원인분석 가설 3개 + 마케팅액션 가설 3개, 총 6개
- 반드시 위 데이터의 실제 숫자를 evidence에 인용
- 변동폭이 큰 제품 위주로
- 한국어로 작성`;

  const client = new Anthropic({ apiKey: ANTHROPIC_KEY });
  const msg = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });
  const raw = msg.content.find(b => b.type === 'text')?.text || '[]';

  // JSON 배열 부분만 추출
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('가설 JSON 파싱 실패: ' + raw.slice(0, 200));
  return JSON.parse(match[0]);
}

// 텔레그램 아침 브리핑 (실패해도 가설 저장에는 영향 없음)
async function sendTelegramBriefing(today, hypotheses) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const pri = { high: '🔴', mid: '🟡', low: '🟢' };
  const section = (type, emoji) => {
    const items = hypotheses.filter(h => h.type === type);
    if (!items.length) return '';
    return `\n${emoji} <b>${type}</b>\n` + items.map(h =>
      `${pri[h.priority] || '🟡'} <b>${h.product}</b>\n${h.hypothesis}\n<i>근거: ${h.evidence}</i>`
    ).join('\n\n');
  };

  const text = `📊 <b>오늘의 판매 가설</b> (${today})\n` +
    section('원인분석', '🔍') + '\n' + section('마케팅액션', '💡') +
    `\n\n👉 대시보드 가설 탭에서 검증/기각 가능`;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch (e) {
    console.error('텔레그램 발송 실패:', e.message);
  }
}

// 7일 지난 open 가설을 전후 판매 비교로 자동 검증 (AI 제안, 확정은 사용자가)
async function verifyOldHypotheses() {
  const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
  const dstr = (d) => new Date(kstNow.getTime() - d * 86400000).toISOString().split('T')[0];
  const cutoff = dstr(7);

  // 검증 대상: 7일 이상 지난 open 가설 중 아직 AI 제안이 없는 것
  const res = await fetch(
    `${SUPA_URL}/rest/v1/daily_hypotheses?select=id,date,type,product,hypothesis,evidence&status=eq.open&date=lte.${cutoff}&or=(auto_verdict.is.null,auto_verdict.eq.)&order=date.asc&limit=12`,
    { headers: sH, cache: 'no-store' }
  );
  const targets = await res.json();
  if (!Array.isArray(targets) || targets.length === 0) return [];

  // 대상 제품들의 전후 판매 조회 (가장 오래된 가설 기준 -7일부터 오늘까지)
  const minDate = targets[0].date;
  const fromDate = new Date(new Date(minDate).getTime() - 7 * 86400000).toISOString().split('T')[0];
  const products = [...new Set(targets.map(t => t.product).filter(Boolean))];
  const nameFilter = products.map(p => `"${p.replace(/"/g, '')}"`).join(',');

  const all = [];
  const PAGE = 1000;
  for (let offset = 0; offset < 20000; offset += PAGE) {
    const r = await fetch(
      `${SUPA_URL}/rest/v1/beauty_sales?select=name,date,qty,revenue&date=gte.${fromDate}&name=in.(${encodeURIComponent(nameFilter)})`,
      { headers: { ...sH, Range: `${offset}-${offset + PAGE - 1}` }, cache: 'no-store' }
    );
    if (!r.ok) throw new Error(`검증용 판매 조회 실패: ${await r.text()}`);
    const page = await r.json();
    all.push(...page);
    if (page.length < PAGE) break;
  }

  // 가설별 전후 7일 집계
  const fmt = (n) => Math.round(Number(n) / 10000);
  const cases = targets.map(t => {
    const d0 = new Date(t.date).getTime();
    let bQty = 0, bRev = 0, aQty = 0, aRev = 0;
    for (const r of all) {
      if (r.name !== t.product) continue;
      const dt = new Date(r.date).getTime();
      const diff = (dt - d0) / 86400000;
      if (diff >= -7 && diff < 0) { bQty += Number(r.qty) || 0; bRev += Number(r.revenue) || 0; }
      else if (diff >= 0 && diff < 7) { aQty += Number(r.qty) || 0; aRev += Number(r.revenue) || 0; }
    }
    return { ...t, before: { qty: bQty, rev: fmt(bRev) }, after: { qty: aQty, rev: fmt(aRev) } };
  });

  const casesText = cases.map(c =>
    `id ${c.id} [${c.type}] ${c.product}\n가설: ${c.hypothesis}\n근거: ${c.evidence}\n가설 이전 7일: ${c.before.qty}개 ${c.before.rev}만원 → 가설 이후 7일: ${c.after.qty}개 ${c.after.rev}만원`
  ).join('\n\n');

  const prompt = `당신은 OA 뷰티의 판매 데이터 분석가입니다. 아래 가설들이 세워진 뒤 7일간의 실제 판매를 보고, 가설이 맞았는지 판단하세요.

${casesText}

## 출력 형식 (반드시 JSON 배열만)
[{"id":숫자,"verdict":"confirm|reject|unclear","note":"판단 이유 1문장 (실제 숫자 인용)"}]

## 규칙
- confirm: 이후 판매 흐름이 가설과 부합 / reject: 가설과 반대 / unclear: 판단 근거 부족
- 마케팅액션 가설은 실행 여부를 알 수 없으므로, 판매 흐름이 액션의 전제와 여전히 부합하는지로 판단
- 한국어로 작성`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });
  const raw = msg.content.find(b => b.type === 'text')?.text || '[]';
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('검증 JSON 파싱 실패: ' + raw.slice(0, 200));
  const verdicts = JSON.parse(match[0]);

  const results = [];
  for (const v of verdicts) {
    const target = targets.find(t => t.id === Number(v.id));
    if (!target) continue;
    await fetch(`${SUPA_URL}/rest/v1/daily_hypotheses?id=eq.${Number(v.id)}`, {
      method: 'PATCH',
      headers: { ...sH, Prefer: 'return=minimal' },
      body: JSON.stringify({ auto_verdict: v.verdict || 'unclear', auto_note: v.note || '' }),
    });
    results.push({ ...target, verdict: v.verdict, note: v.note });
  }
  return results;
}

async function sendVerifyTelegram(results) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId || results.length === 0) return;

  const icon = { confirm: '✅ 검증 제안', reject: '❌ 기각 제안', unclear: '❓ 불확실' };
  const text = `🤖 <b>가설 자동 검증</b> (7일 경과분)\n\n` + results.map(r =>
    `${icon[r.verdict] || '❓'} <b>${r.product}</b> (${r.date})\n${r.hypothesis}\n<i>${r.note}</i>`
  ).join('\n\n') + `\n\n👉 대시보드 가설 탭에서 확정해주세요`;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch (e) {
    console.error('검증 텔레그램 발송 실패:', e.message);
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';

  try {
    // 저장된 가설 목록
    if (action === 'list') {
      const res = await fetch(
        `${SUPA_URL}/rest/v1/daily_hypotheses?select=*&order=date.desc,id.asc&limit=200`,
        { headers: sH, cache: 'no-store' }
      );
      const rows = await res.json();
      return Response.json({ rows: Array.isArray(rows) ? rows : [] });
    }

    // 가설 생성 (수동 버튼 + Vercel 크론 공용)
    if (action === 'generate') {
      const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().split('T')[0]; // KST

      // 오늘 이미 생성했으면 스킵 (force=1로 재생성 가능)
      if (!searchParams.get('force')) {
        const chk = await fetch(
          `${SUPA_URL}/rest/v1/daily_hypotheses?select=id&date=eq.${today}&limit=1`,
          { headers: sH, cache: 'no-store' }
        );
        const existing = await chk.json();
        if (Array.isArray(existing) && existing.length > 0) {
          return Response.json({ ok: true, skipped: true, message: '오늘 가설이 이미 있어요' });
        }
      }

      const salesData = await fetchSalesData();
      const hypotheses = await generateHypotheses(salesData);

      const rows = hypotheses.map(h => ({
        date: today,
        type: h.type || '원인분석',
        product: h.product || '',
        hypothesis: h.hypothesis || '',
        evidence: h.evidence || '',
        priority: h.priority || 'mid',
        status: 'open',
      }));

      const ins = await fetch(`${SUPA_URL}/rest/v1/daily_hypotheses`, {
        method: 'POST',
        headers: { ...sH, Prefer: 'return=minimal' },
        body: JSON.stringify(rows),
      });
      if (!ins.ok) throw new Error(`Supabase 저장 실패: ${await ins.text()}`);

      await sendTelegramBriefing(today, rows);

      // 7일 지난 가설 자동 검증 (실패해도 생성 결과에는 영향 없음)
      try {
        const results = await verifyOldHypotheses();
        await sendVerifyTelegram(results);
      } catch (e) {
        console.error('자동 검증 실패:', e.message);
      }

      return Response.json({ ok: true, count: rows.length, date: today });
    }

    // 수동 검증 트리거
    if (action === 'verify') {
      const results = await verifyOldHypotheses();
      await sendVerifyTelegram(results);
      return Response.json({ ok: true, verified: results.length });
    }

    return Response.json({ error: '알 수 없는 action' }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// 가설 상태 변경 (검증완료/기각)
export async function PATCH(request) {
  try {
    const { id, status } = await request.json();
    if (!id || !status) return Response.json({ error: 'id, status 필요' }, { status: 400 });

    const res = await fetch(`${SUPA_URL}/rest/v1/daily_hypotheses?id=eq.${Number(id)}`, {
      method: 'PATCH',
      headers: { ...sH, Prefer: 'return=minimal' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error(await res.text());
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
