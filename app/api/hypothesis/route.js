export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 데이터 조회 + AI 생성 + 자동 검증에 시간 필요

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

// Supabase beauty_sales에서 최근 28일 이미용 데이터 조회 (매일 MySQL→Supabase 동기화됨)
// Vercel에서 MySQL 직접 접속이 차단되어 있어 동기화 테이블 사용
async function fetchSalesData() {
  const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
  const dstr = (d) => new Date(kstNow.getTime() - d * 86400000).toISOString().split('T')[0];
  const from28 = dstr(28);
  const from7 = dstr(7);
  const from14 = dstr(14);
  const yesterdayDate = dstr(1);

  // 페이지네이션으로 28일치 전체 조회
  const all = [];
  const PAGE = 1000;
  for (let offset = 0; offset < 50000; offset += PAGE) {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/beauty_sales?select=name,channel,date,qty,revenue&date=gte.${from28}&cat_id=in.(${BEAUTY_CODES.join(',')})&order=date.desc`,
      { headers: { ...sH, Range: `${offset}-${offset + PAGE - 1}` }, cache: 'no-store' }
    );
    if (!res.ok) throw new Error(`판매 데이터 조회 실패: ${await res.text()}`);
    const page = await res.json();
    all.push(...page);
    if (page.length < PAGE) break;
  }

  // 주차 인덱스 (0=이번주, 1=지난주, 2, 3)
  const weekIdx = (date) => {
    if (date >= from7) return 0;
    if (date >= from14) return 1;
    if (date >= dstr(21)) return 2;
    return 3;
  };

  // 4주 주별 제품 집계
  const byProduct = {};
  for (const r of all) {
    const p = byProduct[r.name] = byProduct[r.name] ||
      { name: r.name, w: [0, 0, 0, 0], rev: [0, 0, 0, 0] };
    const wi = weekIdx(r.date);
    p.w[wi] += Number(r.qty) || 0;
    p.rev[wi] += Number(r.revenue) || 0;
  }
  const trend = Object.values(byProduct)
    .filter(p => p.w.some(q => q > 0))
    .sort((a, b) => Math.abs(b.w[0] - b.w[1]) - Math.abs(a.w[0] - a.w[1]))
    .slice(0, 25);

  // 채널 이동 감지: 제품×채널 이번주 vs 지난주
  const byPC = {};
  for (const r of all) {
    if (r.date < from14) continue;
    const key = `${r.name}|${r.channel || '기타'}`;
    const c = byPC[key] = byPC[key] ||
      { name: r.name, channel: r.channel || '기타', this_week: 0, last_week: 0 };
    if (r.date >= from7) c.this_week += Number(r.qty) || 0;
    else c.last_week += Number(r.qty) || 0;
  }
  const channelShift = Object.values(byPC)
    .filter(c => c.this_week + c.last_week >= 3 && c.this_week !== c.last_week)
    .sort((a, b) => Math.abs(b.this_week - b.last_week) - Math.abs(a.this_week - a.last_week))
    .slice(0, 20);

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
    .slice(0, 25);

  return { trend, channelShift, yesterday };
}

// 쿠팡·지그재그 실판매 (네이버웍스 메일 파일 → channel_daily_sales 동기화)
// ERP의 쿠팡/지그재그 수치는 일괄 발주라 실제 소비자 판매와 다름
async function fetchRealChannelSales() {
  const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
  const dstr = (d) => new Date(kstNow.getTime() - d * 86400000).toISOString().split('T')[0];
  const from14 = dstr(14);
  const from7 = dstr(7);

  const kw = ['드라이', '고데기', '갈바닉', '거울', '소닉플로우', '에어리'];
  const orFilter = kw.map(k => `name.ilike.*${k}*`).join(',');

  const all = [];
  const PAGE = 1000;
  for (let offset = 0; offset < 20000; offset += PAGE) {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/channel_daily_sales?select=channel,name,date,qty&date=gte.${from14}&or=(${encodeURIComponent(orFilter)})`,
      { headers: { ...sH, Range: `${offset}-${offset + PAGE - 1}` }, cache: 'no-store' }
    );
    if (!res.ok) return []; // 테이블 없거나 오류 시 조용히 스킵
    const page = await res.json();
    all.push(...page);
    if (page.length < PAGE) break;
  }

  const byKey = {};
  for (const r of all) {
    const k = `${r.channel}|${r.name}`;
    const o = byKey[k] = byKey[k] || { channel: r.channel, name: r.name, this_week: 0, last_week: 0 };
    if (r.date >= from7) o.this_week += Number(r.qty) || 0;
    else o.last_week += Number(r.qty) || 0;
  }
  return Object.values(byKey)
    .filter(o => o.this_week + o.last_week >= 3)
    .sort((a, b) => Math.abs(b.this_week - b.last_week) - Math.abs(a.this_week - a.last_week))
    .slice(0, 25);
}

// 메타 광고비 (구글시트 CSV, 최근 14일 제품군별 주간 집계 + 일별 총액)
const AD_GROUPS = [['소닉플로우',['소닉플로우','sonic']],['갈바닉',['갈바닉']],['화장거울',['거울']],['고데기',['고데기']],['드라이기',['드라이','에어리']]];
function csvParse(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(f => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some(f => f !== '')) rows.push(row);
  return rows;
}
const csvNum = v => { const n = parseFloat(String(v || '').replace(/,/g, '').replace(/[^0-9.-]/g, '')); return isNaN(n) ? 0 : n; };
const csvDate = v => {
  const s = String(v || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const ko = s.match(/^(\d{4})[.\s]+(\d{1,2})[.\s]+(\d{1,2})/);
  if (ko) return `${ko[1]}-${ko[2].padStart(2, '0')}-${ko[3].padStart(2, '0')}`;
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  return '';
};

async function fetchMetaSpend() {
  try {
    const setRes = await fetch(`${SUPA_URL}/rest/v1/settings?key=eq.oa_conv_sheet_url_v1&select=value`, {
      headers: sH, cache: 'no-store',
    });
    let sheetUrl = (await setRes.json())?.[0]?.value;
    if (typeof sheetUrl === 'string') sheetUrl = sheetUrl.replace(/^"|"$/g, '');
    if (!sheetUrl) return null;

    const m = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    let csvUrl = sheetUrl;
    if (m) {
      const gid = (sheetUrl.match(/[#&?]gid=(\d+)/) || [])[1] || '0';
      csvUrl = `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${gid}&t=${Date.now()}`;
    }
    const csvRes = await fetch(csvUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store', redirect: 'follow' });
    if (!csvRes.ok) return null;
    const rows = csvParse(await csvRes.text());
    if (rows.length < 2) return null;

    const header = rows[0].map(h => h.trim());
    const idx = (...names) => header.findIndex(h => names.some(n => h.replace(/\s/g, '') === n.replace(/\s/g, '')));
    const iDate = idx('일', '날짜', '보고 시작');
    const iCamp = idx('캠페인 이름');
    const iAd = idx('광고 이름');
    const iSpend = idx('지출 금액 (KRW)', '지출 금액');
    const iPurch = idx('공유 항목이 포함된 구매', '웹사이트 구매', '구매');
    const iConvV = idx('공유 항목의 구매 전환값', '웹사이트 구매 전환값', '구매 전환값');
    if (iDate < 0 || iSpend < 0) return null;

    const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
    const dstr = (d) => new Date(kstNow.getTime() - d * 86400000).toISOString().split('T')[0];
    const from14 = dstr(14), from7 = dstr(7);

    const groups = {}; // group -> {tSpend,tPurch,tConvV,lSpend,lPurch,lConvV}
    const daily = {};  // date -> spend
    for (const r of rows.slice(1)) {
      const date = csvDate(r[iDate]);
      if (!date || date < from14) continue;
      const name = `${r[iCamp] || ''} ${r[iAd] || ''}`;
      if (name.includes('Instagram 게시물')) continue;
      const spend = csvNum(r[iSpend]);
      const purch = iPurch >= 0 ? csvNum(r[iPurch]) : 0;
      const convV = iConvV >= 0 ? csvNum(r[iConvV]) : 0;
      daily[date] = (daily[date] || 0) + spend;
      const lower = name.toLowerCase();
      const gr = AD_GROUPS.find(([, kws]) => kws.some(k => lower.includes(k)))?.[0];
      if (!gr) continue;
      const o = groups[gr] = groups[gr] || { tSpend: 0, tPurch: 0, tConvV: 0, lSpend: 0, lPurch: 0, lConvV: 0 };
      if (date >= from7) { o.tSpend += spend; o.tPurch += purch; o.tConvV += convV; }
      else { o.lSpend += spend; o.lPurch += purch; o.lConvV += convV; }
    }
    if (!Object.keys(daily).length) return null;
    return { groups, daily };
  } catch { return null; } // 광고 데이터 없어도 가설 생성은 진행
}

// 프로모션 일정 (진행중 + 최근 종료 + 예정)
async function fetchPromotions() {
  try {
    const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
    const from14 = new Date(kstNow.getTime() - 14 * 86400000).toISOString().split('T')[0];
    const res = await fetch(
      `${SUPA_URL}/rest/v1/promotions?select=channel,promo_name,start_date,end_date,products&end_date=gte.${from14}&brand=ilike.*${encodeURIComponent('오아')}*&order=start_date.desc&limit=40`,
      { headers: sH, cache: 'no-store' }
    );
    if (!res.ok) return [];
    const rows = await res.json();
    if (!Array.isArray(rows)) return [];
    const kw = ['드라이', '고데기', '갈바닉', '거울', '소닉플로우', '에어리'];
    return rows
      .filter(r => !Array.isArray(r.products) || !r.products.length
        || r.products.some(p => kw.some(k => String(p || '').includes(k))))
      .slice(0, 20);
  } catch { return []; }
}

// 네이버 데이터랩 검색 트렌드 (최근 8주, 주간 상대지수). 실패 시 null → 프롬프트에서 생략
// 주의: developers.naver.com 앱에 "데이터랩(검색어트렌드)" API 권한 필요
async function fetchSearchTrend() {
  try {
    const cid = process.env.NAVER_CLIENT_ID, csec = process.env.NAVER_CLIENT_SECRET;
    if (!cid || !csec) return null;
    const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
    const dstr = (d) => new Date(kstNow.getTime() - d * 86400000).toISOString().split('T')[0];
    const res = await fetch('https://openapi.naver.com/v1/datalab/search', {
      method: 'POST',
      headers: { 'X-Naver-Client-Id': cid, 'X-Naver-Client-Secret': csec, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: dstr(56), endDate: dstr(1), timeUnit: 'week',
        keywordGroups: [
          { groupName: '드라이기', keywords: ['드라이기', '헤어드라이어'] },
          { groupName: '미니드라이기', keywords: ['미니드라이기', '휴대용드라이기'] },
          { groupName: '고데기', keywords: ['고데기', '매직기'] },
          { groupName: '갈바닉', keywords: ['갈바닉', '갈바닉마사지기'] },
          { groupName: '화장거울', keywords: ['화장거울', 'LED거울'] },
        ],
      }),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const j = await res.json();
    if (!Array.isArray(j.results)) return null;
    return j.results.map(g => ({
      group: g.title,
      weeks: (g.data || []).map(d => ({ week: d.period, ratio: d.ratio })),
    }));
  } catch { return null; }
}

// 과거 검증 결과 (피드백 루프용)
async function fetchPastVerdicts() {
  const res = await fetch(
    `${SUPA_URL}/rest/v1/daily_hypotheses?select=type,product,hypothesis,status&status=in.(confirmed,rejected)&order=date.desc&limit=10`,
    { headers: sH, cache: 'no-store' }
  );
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

async function generateHypotheses(salesData, pastVerdicts, realChannel, metaSpend, promotions, searchTrend) {
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY 환경변수가 없어요');

  const fmt = (n) => Math.round(Number(n) / 10000);
  const trendText = salesData.trend.map(r =>
    `${r.name}: 3주전 ${r.w[3]}개 → 2주전 ${r.w[2]}개 → 지난주 ${r.w[1]}개(${fmt(r.rev[1])}만원) → 이번주 ${r.w[0]}개(${fmt(r.rev[0])}만원)`
  ).join('\n');
  const shiftText = salesData.channelShift.map(c =>
    `${c.name} [${c.channel}]: 지난주 ${c.last_week}개 → 이번주 ${c.this_week}개`
  ).join('\n');
  const yesterdayText = salesData.yesterday.map(r =>
    `${r.name} [${r.channel}]: ${r.qty}개, ${fmt(r.revenue)}만원`
  ).join('\n');
  const feedbackText = pastVerdicts.length
    ? pastVerdicts.map(v =>
        `[${v.status === 'confirmed' ? '맞았음' : '틀렸음'}] (${v.type}) ${v.product}: ${v.hypothesis}`
      ).join('\n')
    : '(아직 없음)';

  // 메타 광고비 (제품군별 주간 + 일별 총액)
  let adText = '(데이터 없음)';
  if (metaSpend) {
    const man = (n) => Math.round(n / 10000);
    const roas = (v, s) => s > 0 ? Math.round(v / s * 100) : 0;
    const gLines = Object.entries(metaSpend.groups).map(([gr, o]) =>
      `${gr}: 지난주 ${man(o.lSpend)}만원(구매 ${Math.round(o.lPurch)}건, ROAS ${roas(o.lConvV, o.lSpend)}%) → 이번주 ${man(o.tSpend)}만원(구매 ${Math.round(o.tPurch)}건, ROAS ${roas(o.tConvV, o.tSpend)}%)`
    ).join('\n');
    const dLines = Object.entries(metaSpend.daily).sort()
      .map(([d, s]) => `${d.slice(5)}: ${man(s)}만원`).join(', ');
    adText = `[제품군별 주간]\n${gLines || '(제품군 매칭 없음)'}\n[일별 총 지출]\n${dLines}`;
  }

  // 프로모션
  const promoText = promotions.length
    ? promotions.map(p => {
        const prods = Array.isArray(p.products) ? p.products.slice(0, 4).join(', ') : '';
        return `${p.start_date}~${p.end_date} [${p.channel}] ${p.promo_name}${prods ? ` (${prods})` : ''}`;
      }).join('\n')
    : '(데이터 없음)';

  // 검색 트렌드 (주간 상대지수 → 추이 + 전주 대비 변화율)
  let trendSearchText = '(데이터 없음)';
  if (Array.isArray(searchTrend) && searchTrend.length) {
    trendSearchText = searchTrend.map(g => {
      const ws = g.weeks.slice(-8);
      const line = ws.map(w => Math.round(w.ratio)).join(' → ');
      const n = ws.length;
      const wow = n >= 2 && ws[n - 2].ratio > 0
        ? Math.round((ws[n - 1].ratio - ws[n - 2].ratio) / ws[n - 2].ratio * 100) : null;
      return `${g.group}: ${line}${wow !== null ? ` (전주 대비 ${wow > 0 ? '+' : ''}${wow}%)` : ''}`;
    }).join('\n');
  }

  const prompt = `당신은 OA 뷰티(이미용 브랜드)의 판매 데이터 분석가입니다. 아래 데이터를 보고 가설을 만드세요.

## 4주 판매 추이 (제품별 주간 수량, 변동 큰 순)
${trendText}

## 채널 이동 (제품×채널 주간 수량 변화)
${shiftText}

## 어제 판매 (채널별)
${yesterdayText}

## 쿠팡·지그재그 실판매 (실제 소비자 판매, 주간 수량)
${realChannel.length ? realChannel.map(o => `${o.name} [${o.channel}]: 지난주 ${o.last_week}개 → 이번주 ${o.this_week}개`).join('\n') : '(데이터 없음)'}

## 메타 광고 집행 (최근 14일)
${adText}

## 프로모션 일정 (진행중 · 최근 종료 · 예정)
${promoText}

## 네이버 검색 트렌드 (카테고리별 주간 상대지수, 최근 8주 — 시장 수요 신호)
${trendSearchText}

## 과거 가설 검증 결과 (참고 — 맞았던 패턴은 발전시키고, 틀렸던 유형의 가설은 피하세요)
${feedbackText}

## 출력 형식 (반드시 JSON 배열만, 다른 텍스트 없이)
[
  {"type":"원인분석","product":"제품명","hypothesis":"판매 변동의 원인 가설 (1-2문장, 광고비·프로모션 변화와 판매 변화를 연결해 설명)","evidence":"근거가 된 실제 숫자 (판매+광고/프로모션 교차 인용)","priority":"high|mid|low","expected_impact":"가설이 맞다면 예상되는 효과/리스크 — 반드시 구체적 수치 예측 포함 (예: 주간 -30개 추가 하락, 매출 -200만원)","how_to_verify":"판정 기준+기한 포함 (예: 3일 내 실판매가 지난주 대비 20% 회복 안 되면 기각)"},
  {"type":"마케팅액션","product":"제품명","hypothesis":"시도할 액션 + 실행 스텝 (예: ① 소닉플로우 메타 예산 일 5만→8만원 증액 ② 가격소구 소재로 교체 ③ 3일 후 ROAS 확인)","evidence":"근거가 된 실제 숫자","priority":"high|mid|low","expected_impact":"실행 시 기대 효과 — 구체적 수치 목표 (예: 주간 구매 15→25건, ROAS 300% 유지)","how_to_verify":"성공/실패 판정 기준+기한 (예: 7일 내 주간 실판매 +20개 미달이면 실패)"}
]

## 규칙
- 원인분석 가설 3개 + 마케팅액션 가설 3개, 총 6개
- 반드시 위 데이터의 실제 숫자를 evidence에 인용. 판매 변동을 광고비 증감·프로모션 시작/종료와 교차 검증해서 원인을 좁힐 것 (예: 광고비 그대로인데 판매 급감 → 광고 외 원인)
- expected_impact는 반드시 구체적 수치 예측 (개수/만원/%), how_to_verify는 반드시 판정 기준+기한을 포함
- 마케팅액션의 hypothesis에는 ①②③ 실행 스텝을 포함
- 4주 추이에서 지속 상승/하락 vs 일시 변동을 구분하고, 채널 이동 신호를 활용
- 검색 트렌드가 있으면 시장 수요(검색)와 우리 판매의 괴리를 활용 (예: 검색 늘었는데 판매 감소 → 경쟁사에 뺏김 / 검색 자체 감소 → 시장 계절성)
- 주의: 위 판매 추이/어제 판매(ERP)의 쿠팡·지그재그 수치는 플랫폼 일괄 발주(사입)라 하루에 몰려 잡힘. 쿠팡·지그재그 판단은 반드시 "쿠팡·지그재그 실판매" 섹션 수치를 기준으로 할 것 (실판매 데이터 없으면 발주 가능성을 언급)
- 변동폭이 큰 제품 위주로
- 한국어로 작성`;

  const client = new Anthropic({ apiKey: ANTHROPIC_KEY });
  const msg = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });
  let raw = msg.content.find(b => b.type === 'text')?.text || '[]';
  // 마크다운 코드블록 제거
  raw = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '');

  // JSON 배열 부분만 추출
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('가설 JSON 파싱 실패: ' + raw.slice(0, 200));
  let jsonStr = match[0];
  // 잘린 JSON 복구 시도
  try { return JSON.parse(jsonStr); } catch {
    // 마지막 완전한 객체까지만 파싱
    const lastComplete = jsonStr.lastIndexOf('}');
    if (lastComplete > 0) {
      jsonStr = jsonStr.slice(0, lastComplete + 1) + ']';
      try { return JSON.parse(jsonStr); } catch {}
    }
    throw new Error('가설 JSON 파싱 실패: ' + raw.slice(0, 200));
  }
}

const APP_URL = 'https://oa-dashboard2.vercel.app';

// 쿠팡 추정재고 (28일 발주 누적 − 실판매 누적) → 소진 임박 제품군 알림
const STOCK_GROUPS = [['소닉플로우',['소닉플로우']],['갈바닉',['갈바닉']],['화장거울',['거울']],['고데기',['고데기']],['드라이기',['드라이','에어리']]];
const stockGroup = (n) => {
  const s = String(n || '');
  for (const [g, kws] of STOCK_GROUPS) if (kws.some(k => s.includes(k))) return g;
  return null;
};

async function computeStockAlerts() {
  const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
  const from28 = new Date(kstNow.getTime() - 28 * 86400000).toISOString().split('T')[0];
  const from7 = new Date(kstNow.getTime() - 7 * 86400000).toISOString().split('T')[0];

  const fetchAll = async (url) => {
    const all = [];
    for (let o = 0; o < 30000; o += 1000) {
      const r = await fetch(url, { headers: { ...sH, Range: `${o}-${o + 999}` }, cache: 'no-store' });
      if (!r.ok) return all;
      const page = await r.json();
      all.push(...page);
      if (page.length < 1000) break;
    }
    return all;
  };
  const [erp, real] = await Promise.all([
    fetchAll(`${SUPA_URL}/rest/v1/beauty_sales?select=name,date,qty&date=gte.${from28}&channel=eq.${encodeURIComponent('쿠팡')}&cat_id=in.(${BEAUTY_CODES.join(',')})`),
    fetchAll(`${SUPA_URL}/rest/v1/channel_daily_sales?select=name,date,qty&date=gte.${from28}&channel=eq.${encodeURIComponent('쿠팡')}`),
  ]);
  if (!real.length) return []; // 실판매 데이터 없으면 판단 불가

  const g = {};
  const ensure = (k) => g[k] = g[k] || { erp28: 0, real28: 0, real7: 0 };
  for (const r of erp) { const gr = stockGroup(r.name); if (gr) ensure(gr).erp28 += Number(r.qty) || 0; }
  for (const r of real) {
    const gr = stockGroup(r.name); if (!gr) continue;
    const o = ensure(gr), q = Number(r.qty) || 0;
    o.real28 += q;
    if (r.date >= from7) o.real7 += q;
  }
  const alerts = [];
  for (const [gr, o] of Object.entries(g)) {
    const stock = Math.round(o.erp28 - o.real28);
    const daily = o.real7 / 7;
    if (stock > 0 && daily > 0) {
      const days = Math.round(stock / daily);
      if (days <= 7) alerts.push(`⚠️ ${gr}: 추정재고 약 ${stock}개, ${days}일 후 소진 예상 — 재발주 검토`);
    }
  }
  return alerts;
}

// 텔레그램 인라인 버튼 (✅검증/❌기각/🚀실행함 → action=set 링크)
function hypoButtons(items) {
  const short = (p) => String(p || '').replace(/^오아/, '').slice(0, 14);
  return items
    .filter(h => h.id)
    .map(h => {
      const row = [
        { text: `✅ ${short(h.product)}`, url: `${APP_URL}/api/hypothesis?action=set&id=${h.id}&status=confirmed` },
        { text: `❌ ${short(h.product)}`, url: `${APP_URL}/api/hypothesis?action=set&id=${h.id}&status=rejected` },
      ];
      if (h.type === '마케팅액션') {
        row.push({ text: '🚀 실행함', url: `${APP_URL}/api/hypothesis?action=set&id=${h.id}&executed=1` });
      }
      return row;
    });
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
      `${pri[h.priority] || '🟡'} <b>${h.product}</b>\n${h.hypothesis}\n<i>근거: ${h.evidence}</i>` +
      (h.expected_impact ? `\n📈 ${h.expected_impact}` : '')
    ).join('\n\n');
  };

  let stockText = '';
  try {
    const alerts = await computeStockAlerts();
    if (alerts.length) stockText = `\n\n📦 <b>쿠팡 재고 알림</b>\n${alerts.join('\n')}`;
  } catch (e) { console.error('재고 알림 실패:', e.message); }

  const text = `📊 <b>오늘의 판매 가설</b> (${today})\n` +
    section('원인분석', '🔍') + '\n' + section('마케팅액션', '💡') + stockText +
    `\n\n👉 버튼으로 바로 검증/기각하거나 대시보드 가설 탭에서 처리`;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId, text, parse_mode: 'HTML',
        reply_markup: { inline_keyboard: hypoButtons(hypotheses) },
      }),
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
    `${SUPA_URL}/rest/v1/daily_hypotheses?select=id,date,type,product,hypothesis,evidence,executed,executed_at&status=eq.open&date=lte.${cutoff}&or=(auto_verdict.is.null,auto_verdict.eq.)&order=date.asc&limit=12`,
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
    `id ${c.id} [${c.type}]${c.type === '마케팅액션' ? (c.executed ? ` (실행됨${c.executed_at ? ` ${c.executed_at}` : ''})` : ' (미실행)') : ''} ${c.product}\n가설: ${c.hypothesis}\n근거: ${c.evidence}\n가설 이전 7일: ${c.before.qty}개 ${c.before.rev}만원 → 가설 이후 7일: ${c.after.qty}개 ${c.after.rev}만원`
  ).join('\n\n');

  const prompt = `당신은 OA 뷰티의 판매 데이터 분석가입니다. 아래 가설들이 세워진 뒤 7일간의 실제 판매를 보고, 가설이 맞았는지 판단하세요.

${casesText}

## 출력 형식 (반드시 JSON 배열만)
[{"id":숫자,"verdict":"confirm|reject|unclear","note":"판단 이유 1문장 (실제 숫자 인용)"}]

## 규칙
- confirm: 이후 판매 흐름이 가설과 부합 / reject: 가설과 반대 / unclear: 판단 근거 부족
- 마케팅액션 가설: (실행됨) 표시가 있으면 실행 이후 판매 변화가 예상 효과와 부합하는지로 판단, (미실행)이면 판매 흐름이 액션의 전제와 여전히 부합하는지로만 판단
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
  ).join('\n\n') + `\n\n👉 버튼으로 바로 확정하거나 대시보드 가설 탭에서 처리`;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId, text, parse_mode: 'HTML',
        reply_markup: { inline_keyboard: hypoButtons(results) },
      }),
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
      } else {
        // 재생성: 오늘 기존 가설 삭제 (중복 방지)
        await fetch(`${SUPA_URL}/rest/v1/daily_hypotheses?date=eq.${today}`, {
          method: 'DELETE',
          headers: sH,
        });
      }

      const [salesData, pastVerdicts, realChannel, metaSpend, promotions, searchTrend] = await Promise.all([
        fetchSalesData(), fetchPastVerdicts(), fetchRealChannelSales(), fetchMetaSpend(), fetchPromotions(), fetchSearchTrend(),
      ]);
      const hypotheses = await generateHypotheses(salesData, pastVerdicts, realChannel, metaSpend, promotions, searchTrend);

      const rows = hypotheses.map(h => ({
        date: today,
        type: h.type || '원인분석',
        product: h.product || '',
        hypothesis: h.hypothesis || '',
        evidence: h.evidence || '',
        priority: h.priority || 'mid',
        expected_impact: h.expected_impact || '',
        how_to_verify: h.how_to_verify || '',
        status: 'open',
      }));

      const ins = await fetch(`${SUPA_URL}/rest/v1/daily_hypotheses`, {
        method: 'POST',
        headers: { ...sH, Prefer: 'return=representation' },
        body: JSON.stringify(rows),
      });
      if (!ins.ok) throw new Error(`Supabase 저장 실패: ${await ins.text()}`);
      const saved = await ins.json();

      await sendTelegramBriefing(today, Array.isArray(saved) ? saved : rows);

      // 7일 지난 가설 자동 검증 (실패해도 생성 결과에는 영향 없음)
      try {
        const results = await verifyOldHypotheses();
        await sendVerifyTelegram(results);
      } catch (e) {
        console.error('자동 검증 실패:', e.message);
      }

      return Response.json({ ok: true, count: rows.length, date: today });
    }

    // 텔레그램 버튼 → 가설 확정 (HTML 응답)
    if (action === 'set') {
      const id = Number(searchParams.get('id'));
      const status = searchParams.get('status');
      const page = (title, color) => new Response(
        `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>` +
        `<body style="font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:90vh;margin:0">` +
        `<div style="text-align:center"><div style="font-size:44px">${color}</div><div style="font-size:18px;font-weight:700;margin-top:12px">${title}</div>` +
        `<div style="font-size:13px;color:#888;margin-top:8px">이 창은 닫아도 돼요</div></div></body></html>`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      const executed = searchParams.get('executed') === '1';
      if (!id || (!executed && !['confirmed', 'rejected'].includes(status))) return page('잘못된 요청이에요', '⚠️');
      const todayKST = new Date(Date.now() + 9 * 3600 * 1000).toISOString().split('T')[0];
      const body = executed ? { executed: true, executed_at: todayKST } : { status };
      const res = await fetch(`${SUPA_URL}/rest/v1/daily_hypotheses?id=eq.${id}&select=product`, {
        method: 'PATCH',
        headers: { ...sH, Prefer: 'return=representation' },
        body: JSON.stringify(body),
      });
      const upd = await res.json().catch(() => []);
      if (!res.ok || !Array.isArray(upd) || upd.length === 0) return page('가설을 찾을 수 없어요', '⚠️');
      if (executed) return page(`${upd[0].product || ''} 액션 실행 처리 완료`, '🚀');
      return page(
        `${upd[0].product || ''} 가설 ${status === 'confirmed' ? '검증' : '기각'} 처리 완료`,
        status === 'confirmed' ? '✅' : '❌');
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
    const { id, status, executed, memo, assignee, executed_at, due_date } = await request.json();
    if (!id || (!status && executed === undefined && memo === undefined && assignee === undefined
      && executed_at === undefined && due_date === undefined)) {
      return Response.json({ error: 'id + 변경 필드 필요' }, { status: 400 });
    }

    const body = {};
    if (status) body.status = status;
    if (executed !== undefined) {
      body.executed = !!executed;
      body.executed_at = executed ? new Date(Date.now() + 9 * 3600 * 1000).toISOString().split('T')[0] : null;
    }
    if (executed_at !== undefined) { // 실행날짜 직접 지정 (YYYY-MM-DD 또는 null)
      body.executed_at = executed_at || null;
      body.executed = !!executed_at;
    }
    if (due_date !== undefined) body.due_date = due_date || null;
    if (memo !== undefined) body.memo = String(memo).slice(0, 500);
    if (assignee !== undefined) body.assignee = String(assignee).slice(0, 50);
    const res = await fetch(`${SUPA_URL}/rest/v1/daily_hypotheses?id=eq.${Number(id)}`, {
      method: 'PATCH',
      headers: { ...sH, Prefer: 'return=minimal' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { id } = await request.json();
    if (!id) return Response.json({ error: 'id 필요' }, { status: 400 });
    const res = await fetch(`${SUPA_URL}/rest/v1/daily_hypotheses?id=eq.${Number(id)}`, {
      method: 'DELETE',
      headers: sH,
    });
    if (!res.ok) throw new Error(await res.text());
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
