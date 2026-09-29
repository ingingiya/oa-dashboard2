import { chromium } from "playwright-core";
const b = await chromium.connectOverCDP("http://localhost:9223"); const ctx=b.contexts()[0];
const p = ctx.pages().find(x=>x.url().includes("mail.worksmobile.com/w/")) || await ctx.newPage();
for (const i of [0,1]) {
  await p.goto("https://mail.worksmobile.com/w/sent",{waitUntil:"domcontentloaded"}); await p.waitForTimeout(2500);
  const row = p.locator("li[draggable='true']").nth(i); const t=(await row.innerText()).replace(/\s+/g," "); const when=(t.match(/보낸날짜 : (\d+:\d+)/)||[])[1];
  await row.locator("span, a").filter({hasText:/상품 교체 일정 회신/}).first().click(); await p.waitForTimeout(3000);
  const body = await p.evaluate(()=>{ let s=""; for (const f of document.querySelectorAll("iframe")) { try { s+=f.contentDocument.body.innerText; } catch(e){} } return s || document.body.innerText; });
  const att = await p.evaluate(()=>document.body.innerText.match(/세트\d_[^\s]+?\.jpg/g)||[]);
  console.log("=== sent", i, when, "| 첨부:", att.length); console.log(body.replace(/\n{2,}/g,"\n").slice(0,1500)); 
}
await b.close();
