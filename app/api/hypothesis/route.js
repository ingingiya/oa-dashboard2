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

      return Response.json({ ok: true, count: rows.length, date: today });
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
