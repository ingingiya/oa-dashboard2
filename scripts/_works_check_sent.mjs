import { chromium } from "playwright-core";
const b = await chromium.connectOverCDP("http://localhost:9223"); const ctx=b.contexts()[0];
console.log("open popups:", ctx.pages().filter(x=>x.url().includes("write/popup")).length);
const p = ctx.pages().find(x=>x.url().includes("mail.worksmobile.com/w/")) || await ctx.newPage();
await p.goto("https://mail.worksmobile.com/w/sent",{waitUntil:"domcontentloaded"}); await p.waitForTimeout(3000);
const rows = p.locator("li[draggable='true']"); const n = Math.min(await rows.count(), 4);
for (let i=0;i<n;i++) console.log("sent", i, (await rows.nth(i).innerText()).replace(/\s+/g," ").slice(0,150));
await b.close();
