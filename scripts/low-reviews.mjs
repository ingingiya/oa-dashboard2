// 낮은 평점 리뷰 주간 수집(6): 브랜드스토어 상품 페이지(CDP 크롬)에서 리뷰 API 호출 → 최근 7일 1~3점 → oa_low_reviews_v1 (주간 요약에 포함). launchd com.oa.lowreviews 월 09:10
import { chromium } from 'playwright-core';
import { env } from './nworks-lib.mjs';
const PRODUCTS = [['플렌티플렛 4L', 'https://brand.naver.com/oastore/products/9609372358']];
const b = await chromium.connectOverCDP('http://127.0.0.1:9223', { timeout: 20000 }); const ctx = b.contexts()[0];
const since = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10); const out = [];
for (const [name, url] of PRODUCTS) {
  const p = await ctx.newPage();
  try {
    let origin = null; p.on('request', (rq) => { const m = rq.url().match(/\/n\/v1\/marketing-message\/(\d+)/); if (m) origin = m[1]; });
    await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 }); await p.waitForTimeout(6000);
    const merchant = await p.evaluate(() => { const h = document.documentElement.innerHTML; const m = h.match(/"payReferenceKey":"(\d+)"/); return m ? m[1] : null; });
    const ids = { origin, merchant: merchant || '500070063' };
    if (!ids.origin) { out.push({ name, error: 'originProductNo 없음(marketing-message 요청 미발생)' }); continue; }
    const rows = [];
    for (let page = 1; page <= 5; page++) {
      const j = await p.evaluate(async ({ origin, merchant, page }) => { const r = await fetch('/n/v1/contents/reviews/query-pages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ checkoutMerchantNo: merchant, originProductNo: origin, page, pageSize: 30, reviewSearchSortType: 'REVIEW_CREATE_DATE_DESC' }) }); return r.ok ? r.json() : { status: r.status }; }, { ...ids, page });
      const list = j.contents || []; if (!list.length) break;
      for (const c of list) { const d = String(c.createDate || '').slice(0, 10); if (d < since) { page = 99; break; } rows.push({ date: d, score: c.reviewScore, text: String(c.reviewContent || '').replace(/\s+/g, ' ').slice(0, 160), option: c.productOptionContent || '' }); }
    }
    const low = rows.filter(r => r.score <= 3); const avg = rows.length ? (rows.reduce((a, r) => a + r.score, 0) / rows.length).toFixed(2) : null;
    out.push({ name, total: rows.length, avg, low });
  } catch (e) { out.push({ name, error: String(e.message).slice(0, 100) }); } finally { await p.close(); }
}
const val = { since, at: new Date().toISOString(), products: out };
const SU = env.NEXT_PUBLIC_SUPABASE_URL, SK = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const r = await fetch(`${SU}/rest/v1/settings`, { method: 'POST', headers: { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ key: 'oa_low_reviews_v1', value: val, updated_at: new Date().toISOString() }) });
console.log(r.status, JSON.stringify(out).slice(0, 600)); process.exit(0);
