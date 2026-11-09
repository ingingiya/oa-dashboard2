// 큐텐 순위 트래커(~/oa-qoo10-rank/data.json) → 대시보드 해외 탭(settings oa_global_qoo10_rank_v1)
// ~/oa-qoo10-rank/run.sh 끝에서 실행 (launchd com.oa.qoo10rank 10:00·19:30)
import fs from "fs";
const env = Object.fromEntries(fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]));
const rows = JSON.parse(fs.readFileSync(process.env.HOME + "/oa-qoo10-rank/data.json", "utf8"));
const body = { key: "oa_global_qoo10_rank_v1", value: { updated: rows.map((r) => r.t).sort().pop(), rows: rows.slice(-8 * 60) }, updated_at: new Date().toISOString() };
const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/settings`, { method: "POST", headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(body) });
console.log("qoo10 rank push", r.status, body.value.updated, rows.length);
