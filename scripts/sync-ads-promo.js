#!/usr/bin/env node
// 광고비 + 프로모션 일정 MySQL -> Supabase 동기화

const mysql = require('mysql2/promise');

const SUPA_URL = 'https://lugqeflqusqsyotdiaxg.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1Z3FlZmxxdXNxc3lvdGRpYXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxOTkzMzksImV4cCI6MjA4ODc3NTMzOX0.ls7CN3iISLM_JcGEaVRV_JDSvm4BFqYMU6m4iBGiRA0';
const sH = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' };

async function main() {
  console.log(`[${new Date().toLocaleString('ko-KR')}] 광고/프로모션 동기화 시작`);

  const pool = mysql.createPool({
    host: '52.78.125.230', port: 3306,
    user: 'user_for_ai_sm', password: '1234',
    database: 'db_for_ai_sm',
    waitForConnections: true, connectionLimit: 3,
  });

  try {
    // 광고비 (90일)
    console.log('광고 캠페인 데이터 조회 중...');
    const [adRows] = await pool.query(`
      SELECT
        DATE(stat_date) as date,
        campaign_name,
        campaign_tp as campaign_type,
        SUM(imp_cnt) as impressions,
        SUM(clk_cnt) as clicks,
        SUM(sales_amt) as spend,
        SUM(conv_cnt) as conversions,
        SUM(conv_amt) as conv_amount
      FROM ad_daily_campaign
      WHERE stat_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
      GROUP BY DATE(stat_date), campaign_name, campaign_tp
      ORDER BY date DESC
    `);
    console.log(`  -> 광고 ${adRows.length}건`);

    if (adRows.length) {
      const rows = adRows.map(r => ({
        date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
        campaign_name: r.campaign_name,
        campaign_type: r.campaign_type,
        impressions: Number(r.impressions) || 0,
        clicks: Number(r.clicks) || 0,
        spend: Number(r.spend) || 0,
        conversions: Number(r.conversions) || 0,
        conv_amount: Number(r.conv_amount) || 0,
        synced_at: new Date().toISOString(),
      }));

      const BATCH = 500;
      let total = 0;
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const res = await fetch(`${SUPA_URL}/rest/v1/ad_campaigns?on_conflict=date,campaign_name`, {
          method: 'POST',
          headers: { ...sH, Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify(batch),
        });
        if (!res.ok) { const err = await res.text(); throw new Error(`광고 upsert 실패: ${err}`); }
        total += batch.length;
      }
      console.log(`  -> ${total}건 업로드 완료`);
    }

    // 프로모션 일정
    console.log('프로모션 일정 조회 중...');
    const [promoRows] = await pool.query(`
      SELECT
        s.ID as promo_id,
        s.정산처명 as channel,
        s.행사명 as promo_name,
        DATE(s.시작일) as start_date,
        DATE(s.종료일) as end_date,
        s.브랜드명 as brand,
        s.메모 as memo,
        s.영업담당자 as manager
      FROM v_sales_promotion_schedule s
      ORDER BY s.시작일 DESC
      LIMIT 500
    `);
    // 프로모션별 상품 조회
    const [merchRows] = await pool.query(`
      SELECT 행사일정ID as promo_id, 상품명 as product_name
      FROM v_sales_promotion_schedule_merchandise
    `);
    const merchMap = {};
    merchRows.forEach(r => {
      if (!merchMap[r.promo_id]) merchMap[r.promo_id] = [];
      merchMap[r.promo_id].push(r.product_name);
    });
    console.log(`  -> 프로모션 ${promoRows.length}건 (상품 ${merchRows.length}건)`);

    if (promoRows.length) {
      const rows = promoRows.map(r => ({
        promo_id: r.promo_id,
        channel: r.channel,
        promo_name: r.promo_name,
        start_date: r.start_date instanceof Date ? r.start_date.toISOString().split('T')[0] : String(r.start_date),
        end_date: r.end_date instanceof Date ? r.end_date.toISOString().split('T')[0] : String(r.end_date),
        brand: r.brand,
        memo: r.memo,
        manager: r.manager,
        products: merchMap[r.promo_id] || [],
        synced_at: new Date().toISOString(),
      }));

      const BATCH = 500;
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const res = await fetch(`${SUPA_URL}/rest/v1/promotions?on_conflict=promo_id`, {
          method: 'POST',
          headers: { ...sH, Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify(batch),
        });
        if (!res.ok) { const err = await res.text(); throw new Error(`프로모션 upsert 실패: ${err}`); }
      }
      console.log(`  -> ${promoRows.length}건 업로드 완료`);
    }

    console.log('완료!');
  } catch (e) {
    console.error('오류:', e.message);
    process.exit(1);
  } finally {
    await pool.end().catch(() => {});
  }
}

main();
// 이 파일 끝에 monthly_meta도 동기화하도록 별도 실행
