import { chromium } from "playwright-core"; import fs from "fs";
const FILES = fs.readdirSync("/Users/kirby/Desktop/캐시슬라이드_1주차_전달_9종").filter(f=>f.endsWith(".jpg")).sort().map(f=>"/Users/kirby/Desktop/캐시슬라이드_1주차_전달_9종/"+f);
const b = await chromium.connectOverCDP("http://localhost:9223"); const ctx=b.contexts()[0];
const cp = ctx.pages().find(x=>x.url().includes("write/popup")); if (!cp) { console.log("no popup"); process.exit(1); }
for (const f of cp.frames()) { const n = await f.locator("input[type=file]").count().catch(()=>0); console.log("frame", f.url().slice(0,60), "file inputs:", n); }
const html = await cp.evaluate(()=>{ const el=[...document.querySelectorAll("button,a,label,span")].find(e=>/파일첨부/.test(e.textContent||"")); return el? el.outerHTML.slice(0,300):"none"; }); console.log("btn:", html);
let ok=false;
for (const f of cp.frames()) { const ins = f.locator("input[type=file]"); const n = await ins.count().catch(()=>0); for (let i=0;i<n;i++){ try { await ins.nth(i).setInputFiles(FILES); ok=true; console.log("set on frame", f.url().slice(0,40), "input", i); break; } catch(e){ console.log("fail", String(e).slice(0,80)); } } if (ok) break; }
await cp.waitForTimeout(12000);
const shown = await cp.evaluate(()=>Array.from(new Set(document.body.innerText.match(/세트[123]_[^\s]+?\.jpg/g)||[]))); console.log("shown:", shown.length, shown.slice(0,9));
await cp.screenshot({ path: "/private/tmp/claude-501/-Users-kirby/4e3ff771-7c28-441f-813a-ddef9a8e1466/scratchpad/works_attach.png" });
await b.close();
