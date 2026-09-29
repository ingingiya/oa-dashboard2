import { chromium } from "playwright-core";
const b = await chromium.connectOverCDP("http://localhost:9223"); const ctx=b.contexts()[0];
const p = ctx.pages().find(x=>x.url().includes("mail.worksmobile.com/w/")) || await ctx.newPage();
await p.goto("https://mail.worksmobile.com/w/all",{waitUntil:"domcontentloaded"}); await p.waitForTimeout(2500);
for (const pat of [/소재를 입력해주세요/, /소재 제출이 완료/, /상품 교체 일정 회신/]) {
  const row = p.locator("li[draggable='true']").filter({ hasText: pat }).first();
  if (!(await row.count())) { console.log("no row", pat); continue; }
  await row.locator("a, span").filter({ hasText: pat }).first().click().catch(()=>row.click()); await p.waitForTimeout(3000);
  const txt = await p.evaluate(()=>{ const fr=[...document.querySelectorAll("iframe")]; let t=""; for (const f of fr){ try{ t+=(f.contentDocument&&f.contentDocument.body?f.contentDocument.body.innerText:"")+"\n"; }catch(e){} } return t || document.body.innerText; });
  console.log("=====", String(pat)); console.log(txt.replace(/\n{2,}/g,"\n").slice(0,1800));
  await p.goBack({waitUntil:"domcontentloaded"}).catch(()=>{}); await p.waitForTimeout(1500);
}
await b.close();
