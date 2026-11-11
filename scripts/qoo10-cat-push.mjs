// 큐텐 카테고리 랭킹(cat_data.json) → 대시보드 oa_global_qoo10_cat_v1
import fs from "fs"; import { env } from "./nworks-lib.mjs";
const f = process.env.HOME + "/oa-qoo10-rank/cat_data.json"; if (!fs.existsSync(f)) process.exit(0);
const rows = JSON.parse(fs.readFileSync(f, "utf8")); const ours = JSON.parse(fs.readFileSync(process.env.HOME + "/oa-qoo10-rank/ours.json", "utf8"));
const times = [...new Set(rows.map((r) => r.t))].sort(); const keep = rows.filter((r) => times.slice(-10).includes(r.t));
const body = { key: "oa_global_qoo10_cat_v1", value: { updated: times.at(-1), names: ours, rows: keep }, updated_at: new Date().toISOString() };
const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/settings`, { method: "POST", headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(body) });
console.log("qoo10 cat push", r.status, body.value.updated, keep.length);
