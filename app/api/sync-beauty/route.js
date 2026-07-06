export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import mysql from 'mysql2/promise';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sH = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' };

const BEAUTY_CATS = ['DRY','STR','MSG','GVN','ETB','ORL','TBS','SCA','MUM'];

function getPool() {
  return mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    database: process.env.MYSQL_DB,
    connectionLimit: 3,
  });
}

async function upsert(table, conflict, rows) {
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const res = await fetch(`${SUPA_URL}/rest/v1/${table}?on_conflict=${conflict}`, {
      method: 'POST',
      headers: { ...sH, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(rows.slice(i, i + BATCH)),
    });
    if (!res.ok) throw new Error(`${table} upsert: ${await res.text()}`);
  }
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  if (secret !== process.env.ERP_SYNC_SECRET && req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const pool = getPool();
  const result = {};

  try {
    // 1. beauty_sales (최근 14일)
    const ph = BEAUTY_CATS.map(() => '?').join(',');
    const [salesRows] = await pool.query(`
      SELECT 제품명 as name, 카테고리코드 as cat_id, 매출처명 as channel,
        DATE(판매날짜) as date, SUM(판매수량) as qty, SUM(총매출액) as revenue, SUM(총매출이익) as profit
      FROM v_daily_sales_detail
      WHERE 판매날짜 >= DATE_SUB(CURDATE(), INTERVAL 14 DAY) AND 카테고리코드 IN (${ph})
      GROUP BY 제품명, 카테고리코드, 매출처명, DATE(판매날짜)
    `, BEAUTY_CATS);
    const salesData = salesRows.map(r => ({
      name: r.name, cat_id: r.cat_id, channel: r.channel || '',
      date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
      qty: Number(r.qty) || 0, revenue: Number(r.revenue) || 0, profit: Number(r.profit) || 0,
      synced_at: new Date().toISOString(),
    }));
    if (salesData.length) await upsert('beauty_sales', 'name,cat_id,channel,date', salesData);
    result.beauty_sales = salesData.length;

    // 2. beauty_stock
    const [stockRows] = await pool.query(`
      SELECT 제품명 as name, 모델코드 as model, IFNULL(원가,0) as cost,
        SUM(가용재고수량) as stock_qty, SUM(발주대기수량) as order_pending,
        SUM(생산중수량) as production_qty, SUM(출고대기수량) as ship_qty, SUM(운송중수량) as transport_qty
      FROM v_stock_status
      GROUP BY 제품명, 모델코드, 원가
    `);
    const stockData = stockRows.map(r => ({
      name: r.name, model: r.model || '', cost: Number(r.cost) || 0,
      stock_qty: Number(r.stock_qty) || 0, order_pending: Number(r.order_pending) || 0,
      production_qty: Number(r.production_qty) || 0, ship_qty: Number(r.ship_qty) || 0,
      transport_qty: Number(r.transport_qty) || 0,
      synced_at: new Date().toISOString(),
    }));
    // 전체 교체: 기존 삭제 후 삽입
    if (stockData.length) {
      await fetch(`${SUPA_URL}/rest/v1/beauty_stock?synced_at=lt.${new Date().toISOString()}`, {
        method: 'DELETE', headers: sH,
      });
      await upsert('beauty_stock', 'name,model', stockData);
    }
    result.beauty_stock = stockData.length;

    // 3. beauty_incoming
    const [incomingRows] = await pool.query(`
      SELECT 제품명 as name, DATE(입고예정일) as arrival_date, SUM(입고예정수량) as qty
      FROM v_purchase_schedule_detail
      WHERE 입고예정일 >= CURDATE()
      GROUP BY 제품명, DATE(입고예정일)
    `);
    const incomingData = incomingRows.map(r => ({
      name: r.name,
      arrival_date: r.arrival_date instanceof Date ? r.arrival_date.toISOString().split('T')[0] : String(r.arrival_date),
      qty: Number(r.qty) || 0,
      synced_at: new Date().toISOString(),
    }));
    if (incomingData.length) {
      await fetch(`${SUPA_URL}/rest/v1/beauty_incoming?synced_at=lt.${new Date().toISOString()}`, {
        method: 'DELETE', headers: sH,
      });
      await upsert('beauty_incoming', 'name,arrival_date', incomingData);
    }
    result.beauty_incoming = incomingData.length;

    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json({ ok: false, error: e.message, ...result }, { status: 500 });
  } finally {
    await pool.end().catch(() => {});
  }
}
