import { chromium } from "playwright-core";
import fs from "fs";
const FILES = fs.readdirSync("/Users/kirby/Desktop/캐시슬라이드_1주차_전달_9종").filter(f=>f.endsWith(".jpg")).sort().map(f=>"/Users/kirby/Desktop/캐시슬라이드_1주차_전달_9종/"+f);
const BODY = `서진 님, 안녕하세요. 주식회사 오아 김경은입니다.<br>앞서 보낸 두 통(15:10, 15:11)은 정리가 잘못되어 이 메일로 갈음합니다. 혼선 드려 죄송합니다.<br><br>
<b>1. 운영 방식 (안내 주신 조건대로 진행)</b><br>
· 캠페인 3개에서 세트 3개씩, 총 9개 세트를 운영합니다.<br>
· 세트(상품·소재·랜딩 URL) 교체는 영업일 기준 반영으로 진행합니다. 반영까지 시간이 소요되는 점 확인했습니다.<br>
· 소재는 익일 검수 후 라이브되는 점도 확인했습니다. 교체 소재는 라이브 희망일 기준 2영업일 전까지 전달드리겠습니다.<br><br>
<b>2. 운영 세트(상품) 목록</b><br>
1. 퀵터보 무선충전기 — https://gift.kakao.com/product/13544023<br>
2. 듀얼포켓건 — https://gift.kakao.com/product/13984577<br>
3. 렛츠플레이핏 이어폰 — https://gift.kakao.com/product/13064685<br>
4. 촛불후 스피커 — https://gift.kakao.com/product/11443902<br>
5. 히트스팟S — https://gift.kakao.com/product/12115860<br>
6. 듀얼미스트 가습기 — https://gift.kakao.com/product/1245762<br>
7. 포핸드 손 마사지기 — https://gift.kakao.com/product/14174235<br>
8. 웨이스트레쳐 — https://gift.kakao.com/product/12751464<br>
· 위 목록으로 3개 캠페인에 3세트씩 배정해 운영하고, 나머지는 영업일 기준 교체로 순환합니다. 캠페인별 배정표와 소재(720×1280 · 100KB 이하 · jpg)는 별도 메일로 전달드리겠습니다.<br><br>
감사합니다.`;
const b = await chromium.connectOverCDP("http://localhost:9223"); const ctx=b.contexts()[0];
for (const pg of ctx.pages()) { if (pg.url().includes("write/popup")) { await pg.close().catch(()=>{}); } }
const p = ctx.pages().find(x=>x.url().includes("mail.worksmobile.com/w/")) || await ctx.newPage();
await p.goto("https://mail.worksmobile.com/w/all",{waitUntil:"domcontentloaded"}); await p.waitForTimeout(3000);
let rows = p.locator("li[draggable='true']").filter({ hasText: /오아카카오트래픽_세트1|서진/ });
if (!(await rows.count())) { const sb=p.locator("input[placeholder*='메일 검색']").first(); await sb.click(); await sb.fill("세트1"); await sb.press("Enter"); await p.waitForTimeout(3500); rows = p.locator("li[draggable='true']").filter({ hasText: /세트1|서진/ }); }
const n = await rows.count(); console.log("rows:", n); if (!n) { console.log("NOT FOUND"); await b.close(); process.exit(1); }
// 가장 최근 수신(내가 보낸 게 아닌) 행 선택
let row = null; for (let i=0;i<n;i++){ const t=(await rows.nth(i).innerText()).replace(/\s+/g," "); console.log("row",i,t.slice(0,120)); if(!row && !/^\s*(나|김경은)/.test(t)) row = rows.nth(i); }
row = row || rows.first();
await row.locator("input[type=checkbox], [role=checkbox], label").first().click(); await p.waitForTimeout(500);
const [cp] = await Promise.all([ctx.waitForEvent("page",{timeout:10000}).catch(()=>null), p.locator("button").filter({hasText:/^답장$/}).first().click()]);
if (!cp) { console.log("no popup"); await b.close(); process.exit(1); }
await cp.waitForTimeout(3500);
const subj = await cp.evaluate(()=>(document.querySelector("input[name=subject]")||{}).value||""); console.log("subject:", subj);
let filled=false;
for (const f of cp.frames()) { try { const ok = await f.evaluate((html)=>{const e=document.querySelector("[contenteditable=true]"); if(!e) return false; const d=document.createElement("div"); d.innerHTML=html+"<br><br>"; e.insertBefore(d, e.firstChild); return true;}, BODY); if (ok) { filled=true; break; } } catch(e){} }
console.log("filled:", filled);
// 첨부: 숨겨진 파일 input 에 9장
await cp.screenshot({ path: process.env.SHOT || "/tmp/works_cv3.png" }); console.log("DRAFT OPENED — NOT SENT"); await b.close();
