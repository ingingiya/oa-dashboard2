// 위탁 주문 목록 캡처 + 한 주문에 파일 첨부·저장
// node qoo10-erp-attach.mjs cap <업체주문번호> <out.png>
// node qoo10-erp-attach.mjs attach <업체주문번호> <file1> [file2...]
// node qoo10-erp-attach.mjs count <업체주문번호...>   (쉼표 구분 → 전산에 있는 개수)
import { chromium } from 'playwright-core';
const [mode,no,...rest]=process.argv.slice(2);
const out=(o)=>{console.log('RESULT '+JSON.stringify(o)); process.exit(o.ok?0:1);};
const b = await chromium.connectOverCDP('http://127.0.0.1:9223',{timeout:20000}); const ctx = b.contexts()[0];
for (const q of ctx.pages()) if (q.url().includes('collect_order')) await q.close();
const p = await ctx.newPage(); await p.setViewportSize({width:1700,height:1100});
p.on('dialog',d=>d.accept());
await p.goto('https://erpw.oa-corp.com/home/sales/collect_order', { waitUntil: 'domcontentloaded', timeout: 30000 }); await p.waitForTimeout(8000);
const sels=p.locator('select'); for(let i=0;i<await sels.count();i++){const o=await sels.nth(i).evaluate(s=>[...s.options].map(o=>o.text).join('/')); if(o.includes('주문서')&&o.includes('위탁 주문')) await sels.nth(i).selectOption({label:'전체'});}
await p.fill('input[name=settle_name]','이베이재팬');
if (mode==='count') { await p.mouse.click(1655,327); await p.waitForTimeout(800); }
else await p.fill('input[name=order_number_mall]',no);
if (mode==='cap') await p.fill('input[name=order_number_mall]','');
await p.getByRole('button',{name:'검색',exact:true}).click(); await p.waitForTimeout(15000);
if (mode==='count') {
  // 등록일시 오늘 기준 목록에서 업체주문번호 모으기 (페이지 넘김)
  const want=new Set(no.split(',')); const seen=new Set();
  for (let pg=0; pg<20; pg++){
    const nos = await p.evaluate(()=>[...document.querySelectorAll('tr')].map(r=>[...r.querySelectorAll('td')].map(t=>t.innerText.trim())).filter(c=>c[3]&&/^B\d+/.test(c[3])).map(c=>c[4]));
    nos.forEach(x=>want.has(x)&&seen.add(x));
    const next = p.locator('[class*=NumberBox-module__page_number]').filter({hasText:String(pg+2)}).first();
    if (!(await next.count())) break; await next.click(); await p.waitForTimeout(6000);
  }
  out({ok:true,found:seen.size,missing:[...want].filter(x=>!seen.has(x))});
}
if (mode==='cap') {
  const tbl = p.locator('table').filter({hasText:'업체주문번호'}).last();
  const bx = await tbl.boundingBox(); const tot = await p.getByText(/\[ 총 \d+건 \]/).first().boundingBox();
  await p.screenshot({path:rest[0], clip:{x:bx.x-10,y:tot.y-10,width:bx.width+20,height:(bx.y-tot.y)+36*3+50}});
  out({ok:true,file:rest[0]});
}
const bno = await p.evaluate(()=>{const r=[...document.querySelectorAll('tr')].find(r=>/B26/.test(r.innerText));return r&&r.innerText.match(/B\d{12}/)[0]});
if (!bno) out({ok:false,err:'주문 없음 '+no});
await p.getByText(bno,{exact:true}).first().click(); await p.waitForTimeout(8000);
const sec = p.locator('text=주문 관련 파일').first().locator('xpath=ancestor::*[.//button[normalize-space()="추가"]][1]');
for (const f of rest) {
  const [fc] = await Promise.all([p.waitForEvent('filechooser',{timeout:10000}).catch(()=>null), sec.getByRole('button',{name:'추가',exact:true}).click()]);
  if (fc) await fc.setFiles(f); else await p.locator('input[type=file]').last().setInputFiles(f);
  await p.waitForTimeout(4000);
}
await p.getByRole('button',{name:'저장',exact:true}).last().click(); await p.waitForTimeout(2500);
await p.getByRole('button',{name:/^(저장|확인|예)$/}).last().click(); await p.waitForTimeout(8000);
const ok = p.getByRole('button',{name:'확인',exact:true}); if (await ok.count()) { await ok.last().click(); await p.waitForTimeout(1500); }
const files = await p.evaluate(()=>{const h=[...document.querySelectorAll('*')].find(e=>e.children.length<3&&e.innerText?.trim()=='주문 관련 파일');return h? h.parentElement.parentElement.innerText:''});
const saved = rest.every(f=>files.includes(f.split('/').pop()) ) && /\d{4}-\d{2}-\d{2}T/.test(files);
out({ok:saved,order:bno,files:files.replace(/\s+/g,' ').slice(0,300)});
