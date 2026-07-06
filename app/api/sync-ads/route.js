export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import mysql from 'mysql2/promise';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sH = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' };

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  if (secret !== process.env.ERP_SYNC_SECRET && req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    database: process.env.MYSQL_DB,
    connectionLimit: 3,
  });

  const result = {};

  try {
    // 1. 광고 캠페인 (90일)
    const [adRows] = await pool.query(`
      SELECT DATE(stat_date) as date, campaign_name, campaign_tp as campaign_type,
        SUM(imp_cnt) as impressions, SUM(clk_cnt) as clicks, SUM(sales_amt) as spend,
        SUM(conv_cnt) as conversions, SUM(conv_amt) as conv_amount
      FROM ad_daily_campaign
      WHERE stat_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
      GROUP BY DATE(stat_date), campaign_name, campaign_tp
    `);
    const adData = adRows.map(r => ({
      date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
      campaign_name: r.campaign_name, campaign_type: r.campaign_type,
      impressions: Number(r.impressions) || 0, clicks: Number(r.clicks) || 0,
      spend: Number(r.spend) || 0, conversions: Number(r.conversions) || 0,
      conv_amount: Number(r.conv_amount) || 0, synced_at: new Date().toISOString(),
    }));
    if (adData.length) {
      for (let i = 0; i < adData.length; i += 500) {
        const res = await fetch(`${SUPA_URL}/rest/v1/ad_campaigns?on_conflict=date,campaign_name`, {
          method: 'POST',
          headers: { ...sH, Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify(adData.slice(i, i + 500)),
        });
        if (!res.ok) throw new Error(await res.text());
      }
    }
    result.ad_campaigns = adData.length;

    // 2. 프로모션
    const [promoRows] = await pool.query(`
      SELECT s.ID as promo_id, s.정산처명 as channel, s.행사명 as promo_name,
        DATE(s.시작일) as start_date, DATE(s.종료일) as end_date,
        s.브랜드명 as brand, s.메모 as memo, s.영업담당자 as manager
      FROM v_sales_promotion_schedule s ORDER BY s.시작일 DESC LIMIT 500
    `);
    const [merchRows] = await pool.query(`
      SELECT 행사일정ID as promo_id, 상품명 as product_name FROM v_sales_promotion_schedule_merchandise
    `);
    const merchMap = {};
    merchRows.forEach(r => { if (!merchMap[r.promo_id]) merchMap[r.promo_id] = []; merchMap[r.promo_id].push(r.product_name); });

    const promoData = promoRows.map(r => ({
      promo_id: r.promo_id, channel: r.channel, promo_name: r.promo_name,
      start_date: r.start_date instanceof Date ? r.start_date.toISOString().split('T')[0] : String(r.start_date),
      end_date: r.end_date instanceof Date ? r.end_date.toISOString().split('T')[0] : String(r.end_date),
      brand: r.brand, memo: r.memo, manager: r.manager,
      products: merchMap[r.promo_id] || [], synced_at: new Date().toISOString(),
    }));
    if (promoData.length) {
      for (let i = 0; i < promoData.length; i += 500) {
        const res = await fetch(`${SUPA_URL}/rest/v1/promotions?on_conflict=promo_id`, {
          method: 'POST',
          headers: { ...sH, Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify(promoData.slice(i, i + 500)),
        });
        if (!res.ok) throw new Error(await res.text());
      }
    }
    result.promotions = promoData.length;

    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json({ ok: false, error: e.message, ...result }, { status: 500 });
  } finally {
    await pool.end().catch(() => {});
  }
}
