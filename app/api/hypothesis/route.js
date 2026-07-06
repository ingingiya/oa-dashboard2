export const dynamic = 'force-dynamic';
export const maxDuration = 60; // MySQL 조회 + AI 생성에 시간 필요

import mysql from 'mysql2/promise';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sH = {
  apikey: SUPA_KEY,
  Authorization: `Bearer ${SUPA_KEY}`,
  'Content-Type': 'application/json',
};

// 이미용 카테고리 코드 (드라이기, 고데기, 안마기, 전동칫솔, 구강세정기, 칫솔살균기, 체중계 등)
const BEAUTY_CATEGORY_IDS = ['DRY','STR','MSG','GVN','ETB','ORL','TBS','SCA','MUM'];

function getPool() {
  return mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    database: process.env.MYSQL_DB,
    waitForConnections: true,
    connectionLimit: 5,
  });
}

async function fetchSalesData(pool) {
  const placeholders = BEAUTY_CATEGORY_IDS.map(() => '?').join(',');

  // 전주 vs 이번주 급등/급락
  const [trend] = await pool.query(`
    SELECT
      제품명 as name,
      SUM(CASE WHEN 판매날짜 >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 판매수량 ELSE 0 END) as this_week,
      SUM(CASE WHEN 판매날짜 >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
                AND 판매날짜 < DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 판매수량 ELSE 0 END) as last_week,
      SUM(CASE WHEN 판매날짜 >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 총매출액 ELSE 0 END) as this_revenue,
      SUM(CASE WHEN 판매날짜 >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
                AND 판매날짜 < DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 총매출액 ELSE 0 END) as last_revenue
    FROM v_daily_sales_detail
    WHERE 판매날짜 >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
      AND 카테고리코드 IN (${placeholders})
    GROUP BY 제품명
    HAVING this_week > 0 OR last_week > 0
    ORDER BY ABS(this_week - last_week) DESC
    LIMIT 30
  `, [...BEAUTY_CATEGORY_IDS]);

  // 어제 일별 판매 (채널별 포함)
  const [yesterday] = await pool.query(`
    SELECT
      제품명 as name,
      매출처명 as channel,
      SUM(판매수량) as qty,
      SUM(총매출액) as revenue
    FROM v_daily_sales_detail
    WHERE DATE(판매날짜) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
      AND 카테고리코드 IN (${placeholders})
    GROUP BY 제품명, 거래처명
    ORDER BY revenue DESC
    LIMIT 30
  `, [...BEAUTY_CATEGORY_IDS]);

  return { trend, yesterday };
}

async function generateHypotheses(salesData) {
  const GROQ_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_KEY) throw new Error('GROQ_API_KEY 환경변수가 없어요');

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

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.4,
    }),
  });

  if (!res.ok) throw new Error(`Groq 오류: ${await res.text()}`);
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || '[]';

  // JSON 배열 부분만 추출
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('가설 JSON 파싱 실패: ' + raw.slice(0, 200));
  return JSON.parse(match[0]);
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

      let pool;
      let salesData;
      try {
        pool = getPool();
        salesData = await fetchSalesData(pool);
      } finally {
        if (pool) await pool.end().catch(() => {});
      }

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
