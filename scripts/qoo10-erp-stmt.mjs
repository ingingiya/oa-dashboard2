// 큐텐 위탁 주문서 등록: node qoo10-erp-stmt.mjs <xlsx> <내용> [--go]
// --go 없으면 업로드 검증까지만(등록 안 함). 결과 JSON 한 줄 출력.
import { chromium } from 'playwright-core';
const [file,title]=process.argv.slice(2); const GO=process.argv.includes('--go');
const out=(o)=>{console.log('RESULT '+JSON.stringify(o)); process.exit(o.ok?0:1);};
const b = await chromium.connectOverCDP('http://127.0.0.1:9223',{timeout:20000}); const ctx = b.contexts()[0];
for (const q of ctx.pages()) if (q.url().includes('order_statement')) await q.close();
const p = await ctx.newPage(); await p.setViewportSize({width:1700,height:1100});
await p.goto('https://erpw.oa-corp.com/home/sales/order_statement', { waitUntil: 'domcontentloaded', timeout: 30000 }); await p.waitForTimeout(8000);
if (/login|\/$/.test(p.url()) && !(await p.getByText('위탁 주문서 등록').count())) out({ok:false,err:'전산 로그아웃 — 자동화 크롬(9223)에서 로그인 필요'});
await p.getByRole('button',{name:'등록',exact:true}).first().click(); await p.waitForTimeout(3000);
await p.locator('th:has-text("내용") + td input').last().fill(title);
await p.locator('th:has-text("매출처명") + td [class*=SearchSelector-module__cover]').last().click(); await p.waitForTimeout(800);
await p.locator('input[placeholder="검색어 입력"]').last().fill('큐텐'); await p.waitForTimeout(2500);
await p.locator('[class*=SearchSelector] li, [class*=SearchSelector] [class*=item], [class*=SearchSelector] [class*=option]').filter({hasText:'795-81-01033'}).first().click(); await p.waitForTimeout(2500);
await p.locator('th:has-text("정산명") + td select').last().selectOption({label:'이베이재팬 유한회사(큐텐)'}); await p.waitForTimeout(800);
await p.getByRole('button',{name:'기본값'}).click(); await p.waitForTimeout(1000);
await p.locator('input[type=file]').first().setInputFiles(file); await p.waitForTimeout(7000);
const pop = await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()=='확인'&&x.offsetParent);return b? b.closest('div').parentElement.innerText.trim().slice(0,150):null});
if (pop) out({ok:false,err:'업로드 검증 실패: '+pop});
if (!GO) out({ok:true,dry:true});
await p.getByRole('button',{name:'등록',exact:true}).last().click(); await p.waitForTimeout(2500);
const q = (await p.innerText('body')).match(/주문 (\d+) ?건을 등록하시겠습니까/);
if (!q) out({ok:false,err:'확인창 안 뜸'});
await p.getByRole('button',{name:'저장',exact:true}).last().click();
for (let i=0;i<60;i++){ await p.waitForTimeout(2000); if (!(await p.getByText('처리 중입니다').count())) break; }
await p.waitForTimeout(3000);
out({ok:true,count:+q[1]});
