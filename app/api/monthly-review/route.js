export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// 월간 자동 회고: 지난달 가설 적중률 + 판매 총평 + 다음 달 제안 → Claude → 텔레그램
// 크론: 매월 1일 01:00 UTC (10:00 KST)

import Anthropic from '@anthropic-ai/sdk';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sH = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' };
const BEAUTY_CODES = ['DRY', 'STR', 'GVN', 'MUM'];
const GROUPS = [['소닉플로우', ['소닉플로우']], ['갈바닉', ['갈바닉']], ['화장거울', ['거울']], ['고데기', ['고데기']], ['드라이기', ['드라이', '에어리']]];
const groupOf = (n) => GROUPS.find(([, kws]) => kws.some(k => String(n || '').includes(k)))?.[0] || null;

async function fetchAll(url) {
  const all = [];
  for (let o = 0; o < 100000; o += 1000) {
    const r = await fetch(url, { headers: { ...sH, Range: `${o}-${o + 999}` }, cache: 'no-store' });
    if (!r.ok) throw new Error(`조회 실패: ${await r.text()}`);
    const page = await r.json();
    all.push(...page);
    if (page.length < 1000) break;
  }
  return all;
}

export async function GET() {
  try {
    const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
    // 지난달 1일 ~ 말일, 전전달 1일 (전월 대비용)
    const firstThis = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), 1));
    const firstLast = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth() - 1, 1));
    const firstPrev = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth() - 2, 1));
    const d = (x) => x.toISOString().split('T')[0];
    const monthLabel = `${firstLast.getUTCFullYear()}년 ${firstLast.getUTCMonth() + 1}월`;

    // 1. 판매: 전전달~지난달 이미용 매출 (그룹×월 집계)
    const sales = await fetchAll(
      `${SUPA_URL}/rest/v1/beauty_sales?select=name,channel,date,qty,revenue,profit&date=gte.${d(firstPrev)}&date=lt.${d(firstThis)}&cat_id=in.(${BEAUTY_CODES.join(',')})`
    );
    const agg = {}; // group -> {lastQty,lastRev,lastProfit,prevQty,prevRev}
    let tot = { lastRev: 0, prevRev: 0, lastProfit: 0, lastQty: 0, prevQty: 0 };
    for (const r of sales) {
      const isLast = r.date >= d(firstLast);
      const q = Number(r.qty) || 0, rev = Number(r.revenue) || 0, pf = Number(r.profit) || 0;
      if (isLast) { tot.lastRev += rev; tot.lastProfit += pf; tot.lastQty += q; }
      else { tot.prevRev += rev; tot.prevQty += q; }
      const gr = groupOf(r.name);
      if (!gr) continue;
      const o = agg[gr] = agg[gr] || { lastQty: 0, lastRev: 0, lastProfit: 0, prevQty: 0, prevRev: 0 };
      if (isLast) { o.lastQty += q; o.lastRev += rev; o.lastProfit += pf; }
      else { o.prevQty += q; o.prevRev += rev; }
    }
    const man = (n) => Math.round(n / 10000);
    const salesText = Object.entries(agg).map(([gr, o]) =>
      `${gr}: ${Math.round(o.lastQty)}개 ${man(o.lastRev)}만원 (이익 ${man(o.lastProfit)}만원, 전월 ${Math.round(o.prevQty)}개 ${man(o.prevRev)}만원)`
    ).join('\n');

    // 2. 실판매 (쿠팡·지그재그, 지난달)
    let realText = '(데이터 없음)';
    try {
      const real = await fetchAll(
        `${SUPA_URL}/rest/v1/channel_daily_sales?select=channel,name,qty&date=gte.${d(firstLast)}&date=lt.${d(firstThis)}`
      );
      const rc = {};
      for (const r of real) {
        const gr = groupOf(r.name);
        if (!gr) continue;
        const k = `${r.channel} ${gr}`;
        rc[k] = (rc[k] || 0) + (Number(r.qty) || 0);
      }
      const entries = Object.entries(rc).sort((a, b) => b[1] - a[1]);
      if (entries.length) realText = entries.map(([k, v]) => `${k}: ${Math.round(v)}개`).join('\n');
    } catch {}

    // 3. 가설 성적표 (지난달)
    const hypos = await fetchAll(
      `${SUPA_URL}/rest/v1/daily_hypotheses?select=type,product,hypothesis,status,auto_note&date=gte.${d(firstLast)}&date=lt.${d(firstThis)}`
    );
    const nConf = hypos.filter(h => h.status === 'confirmed').length;
    const nRej = hypos.filter(h => h.status === 'rejected').length;
    const hypoStat = `총 ${hypos.length}건 생성 / 검증 ${nConf}건 / 기각 ${nRej}건 / 미확정 ${hypos.length - nConf - nRej}건`;
    const confirmedText = hypos.filter(h => h.status === 'confirmed').slice(0, 8)
      .map(h => `[${h.type}] ${h.product}: ${h.hypothesis}`).join('\n') || '(없음)';
    const rejectedText = hypos.filter(h => h.status === 'rejected').slice(0, 5)
      .map(h => `[${h.type}] ${h.product}: ${h.hypothesis}`).join('\n') || '(없음)';

    // 4. Claude 회고 생성
    const prompt = `당신은 OA 뷰티(이미용 소형가전: 드라이기·고데기·갈바닉·화장거울)의 데이터 분석가입니다. ${monthLabel} 월간 회고를 작성하세요.

## 판매 실적 (제품군별, 지난달 vs 전월)
전체: ${Math.round(tot.lastQty)}개 ${man(tot.lastRev)}만원 (이익 ${man(tot.lastProfit)}만원), 전월 ${Math.round(tot.prevQty)}개 ${man(tot.prevRev)}만원
${salesText}

## 쿠팡·지그재그 실판매 (실제 소비자 판매)
${realText}

## 가설 성적표
${hypoStat}
### 검증된 가설 (맞았음)
${confirmedText}
### 기각된 가설 (틀렸음)
${rejectedText}

## 출력 형식 (텔레그램 메시지용 일반 텍스트, 800자 이내)
🗓 ${monthLabel} 회고
📈 이번 달 요약: (매출/이익 총평 2~3문장, 전월 대비 수치 인용)
🏆 잘한 것: (2~3개, 검증된 가설·성장 제품군 근거)
⚠️ 아쉬운 것: (1~2개)
🎯 다음 달 제안: (구체적 액션 2~3개)

## 규칙
- 마크다운/HTML 태그 쓰지 말고 일반 텍스트 + 이모지만
- 반드시 실제 숫자를 인용해 판단할 것
- 한국어, 간결하게`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });
    const review = msg.content.find(b => b.type === 'text')?.text || '';
    if (!review) throw new Error('회고 생성 실패');

    // 5. 텔레그램 발송
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (token && chatId) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: review }),
      });
    }

    return Response.json({ ok: true, month: monthLabel, hypotheses: hypos.length, review: review.slice(0, 200) });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
