#!/usr/bin/env node
// 전체 제품 데이터 MySQL -> Supabase 동기화 (초기 1회용)
// 프로젝트 연동 여부와 관계없이 전 제품 90일치 동기화

const mysql = require('mysql2/promise');

const SUPA_URL = 'https://lugqeflqusqsyotdiaxg.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1Z3FlZmxxdXNxc3lvdGRpYXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxOTkzMzksImV4cCI6MjA4ODc3NTMzOX0.ls7CN3iISLM_JcGEaVRV_JDSvm4BFqYMU6m4iBGiRA0';
const sH = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' };

async function main() {
  console.log(`[${new Date().toLocaleString('ko-KR')}] 전체 제품 동기화 시작`);

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
    console.log('매출 데이터 조회 중 (90일)...');
    const [salesRows] = await pool.query(`
      SELECT
        제품번호 as product_id,
        제품명 as product_name,
        브랜드명 as brand,
        DATE(판매날짜) as date,
        SUM(판매수량) as qty,
        SUM(총매출액) as revenue,
        SUM(총매출이익) as profit
      FROM v_daily_sales_detail
      WHERE 판매날짜 >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
      GROUP BY 제품번호, 제품명, 브랜드명, DATE(판매날짜)
      ORDER BY date DESC
    `);
    console.log(`  -> ${salesRows.length}건`);

    const rows = salesRows.map(r => ({
      product_id: r.product_id,
      product_name: r.product_name,
      brand: r.brand,
      date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
      qty: Number(r.qty) || 0,
      revenue: Number(r.revenue) || 0,
      profit: Number(r.profit) || 0,
      synced_at: new Date().toISOString(),
    }));

    console.log('Supabase 업로드 중...');
    const BATCH = 500;
    let total = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const res = await fetch(`${SUPA_URL}/rest/v1/project_product_data?on_conflict=product_id,date`, {
        method: 'POST',
        headers: { ...sH, Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify(batch),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`실패: ${err}`);
      }
      total += batch.length;
      if (total % 5000 === 0 || total === rows.length) console.log(`  ${total}/${rows.length}건`);
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
