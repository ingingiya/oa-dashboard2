#!/usr/bin/env node
// 프로젝트 연동 제품 데이터 MySQL -> Supabase 동기화
// 실행: node scripts/sync-project-products.js
// 1) Supabase에서 projects 테이블의 products 배열 읽기
// 2) MySQL에서 해당 제품들의 매출/재고 조회
// 3) Supabase project_product_data에 upsert

const mysql = require('mysql2/promise');

const SUPA_URL = 'https://lugqeflqusqsyotdiaxg.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1Z3FlZmxxdXNxc3lvdGRpYXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxOTkzMzksImV4cCI6MjA4ODc3NTMzOX0.ls7CN3iISLM_JcGEaVRV_JDSvm4BFqYMU6m4iBGiRA0';
const sH = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' };

const SYNC_DAYS = 90;

async function main() {
  console.log(`[${new Date().toLocaleString('ko-KR')}] 프로젝트 제품 동기화 시작`);

  // 1. Supabase에서 모든 프로젝트의 연동 제품 가져오기
  const projRes = await fetch(`${SUPA_URL}/rest/v1/projects?select=id,products`, { headers: sH });
  const projects = await projRes.json();
  if (!Array.isArray(projects)) { console.log('프로젝트 없음'); return; }

  const allProducts = [];
  projects.forEach(p => {
    (p.products || []).forEach(pr => {
      if (pr.id && !allProducts.find(x => x.id === pr.id)) {
        allProducts.push(pr);
      }
    });
  });

  if (!allProducts.length) { console.log('연동된 제품 없음'); return; }
  console.log(`  연동 제품 ${allProducts.length}개: ${allProducts.map(p => p.name).join(', ')}`);

  // 2. MySQL 연결
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
    const ids = allProducts.map(p => p.id);
    const ph = ids.map(() => '?').join(',');

    // 매출 데이터
    console.log('  매출 데이터 조회 중...');
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
      WHERE 제품번호 IN (${ph})
        AND 판매날짜 >= DATE_SUB(CURDATE(), INTERVAL ${SYNC_DAYS} DAY)
      GROUP BY 제품번호, 제품명, 브랜드명, DATE(판매날짜)
      ORDER BY date DESC
    `, ids);
    console.log(`    -> ${salesRows.length}건`);

    // 재고 데이터
    console.log('  재고 데이터 조회 중...');
    const [stockRows] = await pool.query(`
      SELECT
        제품번호 as product_id,
        CAST(COALESCE(NULLIF(현재고수량,''),0) AS SIGNED) as stock,
        CAST(COALESCE(NULLIF(생산수량,''),0) AS SIGNED) as producing,
        CAST(COALESCE(NULLIF(출하수량,''),0) AS SIGNED) as shipping,
        CAST(COALESCE(NULLIF(운송수량,''),0) AS SIGNED) as transit
      FROM v_purchase_status
      WHERE 제품번호 IN (${ph})
    `, ids);
    console.log(`    -> ${stockRows.length}건`);

    // 재고를 product_id 기준 맵으로
    const stockMap = {};
    stockRows.forEach(s => { stockMap[s.product_id] = s; });

    // 3. Supabase에 upsert
    console.log('  Supabase 업로드 중...');
    const today = new Date().toISOString().split('T')[0];
    const rows = salesRows.map(r => ({
      product_id: r.product_id,
      product_name: r.product_name,
      brand: r.brand,
      date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
      qty: Number(r.qty) || 0,
      revenue: Number(r.revenue) || 0,
      profit: Number(r.profit) || 0,
      stock: r.date === today && stockMap[r.product_id] ? stockMap[r.product_id].stock : null,
      producing: r.date === today && stockMap[r.product_id] ? stockMap[r.product_id].producing : null,
      shipping: r.date === today && stockMap[r.product_id] ? stockMap[r.product_id].shipping : null,
      transit: r.date === today && stockMap[r.product_id] ? stockMap[r.product_id].transit : null,
      synced_at: new Date().toISOString(),
    }));

    // 오늘자 재고 전용 행 (매출 없는 제품도 재고는 기록)
    allProducts.forEach(p => {
      if (stockMap[p.id] && !rows.find(r => r.product_id === p.id && r.date === today)) {
        rows.push({
          product_id: p.id,
          product_name: p.name,
          brand: p.brand,
          date: today,
          qty: 0, revenue: 0, profit: 0,
          stock: stockMap[p.id].stock,
          producing: stockMap[p.id].producing,
          shipping: stockMap[p.id].shipping,
          transit: stockMap[p.id].transit,
          synced_at: new Date().toISOString(),
        });
      }
    });

    // 배치 upsert
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
        throw new Error(`Supabase upsert 실패: ${err}`);
      }
      total += batch.length;
      console.log(`    ${total}/${rows.length}건`);
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
