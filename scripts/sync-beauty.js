#!/usr/bin/env node
// 이미용 판매 데이터 MySQL → Supabase 동기화
// 실행: node scripts/sync-beauty.js
// 크론: 매일 오전 7시 자동 실행

const mysql = require('mysql2/promise');

const SUPA_URL = 'https://lugqeflqusqsyotdiaxg.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1Z3FlZmxxdXNxc3lvdGRpYXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxOTkzMzksImV4cCI6MjA4ODc3NTMzOX0.ls7CN3iISLM_JcGEaVRV_JDSvm4BFqYMU6m4iBGiRA0';

const BEAUTY_IDS = [44,70,71,72,73,74,75,76,77,78,80,82,200,201,202,203,204,205,206,207,208,209];
const SYNC_DAYS = 400; // 전년도 비교를 위해 13개월치

async function fetchBeautySales(pool) {
  const placeholders = BEAUTY_IDS.map(() => '?').join(',');
  const [rows] = await pool.query(`
    SELECT
      제품명 as name,
      제품카테고리ID as cat_id,
      거래처명 as channel,
      DATE(판매날짜) as date,
      SUM(판매수량) as qty,
      SUM(총매출액) as revenue,
      SUM(총이익) as profit
    FROM v_daily_sales_detail
    WHERE 판매날짜 >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      AND 제품카테고리ID IN (${placeholders})
    GROUP BY 제품명, 제품카테고리ID, 거래처명, DATE(판매날짜)
    ORDER BY date DESC
  `, [SYNC_DAYS, ...BEAUTY_IDS]);
  return rows;
}

async function upsertToSupabase(rows) {
  const BATCH = 500;
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map(r => ({
      name: r.name,
      cat_id: Number(r.cat_id),
      channel: r.channel || '',
      date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
      qty: Number(r.qty) || 0,
      revenue: Number(r.revenue) || 0,
      profit: Number(r.profit) || 0,
      synced_at: new Date().toISOString(),
    }));

    const res = await fetch(`${SUPA_URL}/rest/v1/beauty_sales`, {
      method: 'POST',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(batch),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Supabase upsert 실패: ${err}`);
    }
    total += batch.length;
    console.log(`  ↑ ${total}/${rows.length}건 완료`);
  }
}

async function main() {
  console.log(`[${new Date().toLocaleString('ko-KR')}] 이미용 동기화 시작`);
  const pool = mysql.createPool({
    host: '52.78.125.230',
    port: 3306,
    user: 'user_for_ai_sm',
    password: '1234',
    database: 'db_for_ai_sm',
    waitForConnections: true,
    connectionLimit: 3,
  });

  try {
    console.log('MySQL 조회 중...');
    const rows = await fetchBeautySales(pool);
    console.log(`  → ${rows.length}건 조회됨`);

    console.log('Supabase 업로드 중...');
    await upsertToSupabase(rows);

    console.log('✅ 동기화 완료!');
  } catch (e) {
    console.error('❌ 오류:', e.message);
    process.exit(1);
  } finally {
    await pool.end().catch(() => {});
  }
}

main();
