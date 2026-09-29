import { chromium } from "playwright-core";
const BODY=`안녕하세요 김미성 님, 주식회사 오아 김경은입니다.<br><br>이전에 핑크레이디님께 별도로 DM을 드린 적이 있었는데, 진행 의사가 있으시다니 다행입니다. 연락 주셔서 감사합니다.<br><br>샘플 테스트는 바로 진행 가능합니다. 아래만 회신 주시면 이번 주 안에 발송하겠습니다.<br>· 수령인 성함 / 연락처 / 배송 주소<br>· 희망 컬러(있으시면)<br><br>테스트 후 핑크레이디 대표님 콘텐츠 방향과 잘 맞는다고 판단되시면, 공동구매(단독 공구가·기간·수수료)와 콘텐츠 형태·일정을 협의드리겠습니다. 요청 주신 공구 제안서는 이 메일에 함께 첨부드립니다.<br><br>인스타그램 링크 확인했습니다. 솔직하고 친근한 톤이 저희 제품과 잘 맞을 것 같아 기대됩니다.<br><br>감사합니다.`;
const b = await chromium.connectOverCDP("http://localhost:9223"); const ctx=b.contexts()[0];
const p = ctx.pages().find(x=>x.url().includes("mail.worksmobile.com/w/")) || await ctx.newPage();
await p.goto("https://mail.worksmobile.com/w/all",{waitUntil:"domcontentloaded"}); await p.waitForTimeout(3000);
let rows = p.locator("li[draggable='true']").filter({ hasText: /핑크레이디|배네타|김미성/ });
if (!(await rows.count())) { const sb=p.locator("input[placeholder*='메일 검색']").first(); await sb.click(); await sb.fill("핑크레이디"); await sb.press("Enter"); await p.waitForTimeout(3500); rows = p.locator("li[draggable='true']").filter({ hasText: /핑크레이디|배네타|김미성/ }); }
const n = await rows.count(); console.log("rows:", n); if (!n) { console.log("NOT FOUND"); await b.close(); process.exit(0); }
console.log("row:", (await rows.first().innerText()).replace(/\s+/g," ").slice(0,150));
await rows.first().locator("input[type=checkbox], [role=checkbox], label").first().click(); await p.waitForTimeout(500);
const [cp] = await Promise.all([ctx.waitForEvent("page",{timeout:10000}).catch(()=>null), p.locator("button").filter({hasText:/^답장$/}).first().click()]);
if (!cp) { console.log("no popup"); await b.close(); process.exit(0); }
await cp.waitForTimeout(3500); let filled=false;
for (const f of cp.frames()) { try { const ok = await f.evaluate((html)=>{const e=document.querySelector("[contenteditable=true]"); if(!e) return false; const d=document.createElement("div"); d.innerHTML=html+"<br><br>"; e.insertBefore(d, e.firstChild); return true;}, BODY); if (ok) { filled=true; break; } } catch(e){} }
console.log("filled:", filled, "— NOT SENT, attach 제안서 yourself"); await cp.bringToFront(); await b.close();
