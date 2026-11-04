// 스마트스토어 검색어 유입 주간 수집(4): CDP 9223 크롬(오아스토어 로그인) → 데이터분석 검색 분석 API → 캠핑/가습기/고데기 그룹 합계(최근 7·30일 + 작년 동기) → oa_ss_query_v1
// launchd com.oa.ssquery 월 09:15. ★자동화 크롬이 '오아스토어'로 접속 중이어야 함(보아르샵이면 스토어 이동 필요)
import { chromium } from 'playwright-core';
import { env } from './nworks-lib.mjs';
const G = [['캠핑 가습기', /(캠핑|차박|텐트|글램핑)\s*(용)?\s*가습기|가습기.*(캠핑|차박|텐트)/], ['가습기 전체', /가습기/], ['실링팬·타프팬', /실링팬|타프팬/], ['무선 고데기', /무선\s*고데기|프리온/], ['전기담요', /전기\s*담요|포그밍/]];
const ds = (d) => d.toISOString().slice(0, 10); const addD = (d, n) => { const t = new Date(d); t.setUTCDate(t.getUTCDate() + n); return t; };
const now = new Date(Date.now() + 9 * 3600e3); const e = addD(now, -1), s = addD(now, -30); const ly = (d) => { const t = new Date(d); t.setUTCFullYear(t.getUTCFullYear() - 1); return t; };
const b = await chromium.connectOverCDP('http://127.0.0.1:9223', { timeout: 20000 }); const ctx = b.contexts()[0];
let p = ctx.pages().find((x) => /sell\.smartstore\.naver\.com/.test(x.url())); if (!p) { p = await ctx.newPage(); await p.goto('https://sell.smartstore.naver.com/#/home/dashboard', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(8000); }
const store = await p.evaluate(() => document.body.innerText.includes('오아스토어')); if (!store) { console.log('오아스토어 아님 → 중단'); process.exit(1); }
async function pull(sd, ed) { const out = []; for (let pg = 0; pg < 30; pg++) { const r = await p.evaluate(async ({ pg, sd, ed }) => { const x = await fetch('/api/v1/seller-insight/store-analytics/metrics/query', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expandChannelProducts: false, dimensionKey: 'ALL', reportType: 'QUERY', dimensionType: 'QUERY', searchType: 'COUNT', startDate: sd, endDate: ed, interval: 'TOTAL', page: pg, size: 100, sortField: 'VISIT_COUNT', sortDirection: 'DESC' }) }); return [x.status, await x.text()]; }, { pg, sd, ed }); if (r[0] !== 200) throw new Error('HTTP ' + r[0]); const j = JSON.parse(r[1]); out.push(...j.metrics); if (j.metrics.length < 100) break; } return out; }
const cur = await pull(ds(s), ds(e)), prev = await pull(ds(ly(s)), ds(ly(e)));
const sum = (rows, rx) => rows.filter((r) => r.dimension.keyword !== 'ALL' && rx.test(r.dimension.keyword)).reduce((a, r) => ({ visit: a.visit + +r.visitCount, pay: a.pay + +r.payCount, sales: a.sales + +r.salesAmount }), { visit: 0, pay: 0, sales: 0 });
const groups = G.map(([label, rx]) => { const c = sum(cur, rx), l = sum(prev, rx); return { label, ...c, lyVisit: l.visit, lyPay: l.pay, lySales: l.sales }; });
const val = { range: `${ds(s).slice(5)}~${ds(e).slice(5)} (30일)`, at: new Date().toISOString(), groups };
const SU = env.NEXT_PUBLIC_SUPABASE_URL, SK = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const r = await fetch(`${SU}/rest/v1/settings`, { method: 'POST', headers: { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ key: 'oa_ss_query_v1', value: val, updated_at: new Date().toISOString() }) });
console.log(r.status, JSON.stringify(groups)); process.exit(0);
