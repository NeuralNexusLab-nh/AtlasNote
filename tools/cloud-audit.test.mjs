import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {fixture} from './puter-fixture.mjs';
const {chromium}=createRequire(import.meta.url)('C:/Users/eaton/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true}),mock=fixture(),base='https://atlasnote.nxlabtw.com';let checks=0;
const ok=(v,m)=>{assert.ok(v,m);checks++;},artifacts=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-audit-'));
try{
 const context=await browser.newContext({locale:'en-US',serviceWorkers:'block'});await mock.attach(context);const seed=await context.newPage();await seed.goto(base+'/dashboard.html');await seed.waitForSelector('.dashboard-metrics');
 await seed.evaluate(async()=>{const S=await import('/script/store.js');for(let i=0;i<2;i++){const n=await S.saveNote({id:S.uuid(),mode:'basic',rev:0},{title:'Audit synthetic '+i,text:'Never render this secret in diagnostics.',images:[],history:[]},null);if(i===1)await S.remove(n.id,n.rev);}});await seed.close();
 const before=JSON.stringify([...mock.files]),callStart=mock.calls.length,root=JSON.parse([...mock.files.values()].find(f=>f.path.endsWith('/account.json')).text).root;
 const page=await context.newPage();await page.goto(base+'/cloud-check.html');
 await page.evaluate(()=>localStorage.setItem('atlasnote.device-root.v1','synthetic legacy data must not be cleared by audit'));
 await page.getByRole('button',{name:'Check existing files'}).click();await page.locator('.cloud-check-result:not([hidden])').waitFor();
 const report=await page.evaluate(async()=>await(await import('/script/cloud-audit.js')).auditCloud());
 ok(report.noteDirectories===2&&report.active===1&&report.deleted===1,'Read-only audit distinguishes live notes and deletion-marked journals');
 ok(report.entries.find(entry=>entry.state==='deleted').records===2,'Original change remains visible behind a deletion record');
 ok(JSON.stringify([...mock.files])===before,'Diagnostics never modifies remote files');
 ok(mock.calls.slice(callStart).every(c=>['getUser','read','list'].includes(c.method)),'Diagnostics only calls identity and read/list APIs');
 ok(!mock.calls.slice(callStart).some(c=>c.method==='read'&&(c.args[0].endsWith('/account.json')||c.args[0].includes('/blobs/'))),'Does not read cloud account keys or note snapshot contents');
 ok(!JSON.stringify(report).includes(root)&&!JSON.stringify(report).includes('Never render this secret'),'Report contains neither keys nor note content');
 ok(await page.evaluate(()=>localStorage.getItem('atlasnote.device-root.v1'))!==null,'Diagnostics does not run legacy local cleanup');
 mock.setFaults([{method:'read',path:'/notes/'}]);await page.getByRole('button',{name:'Check existing files'}).click();await page.waitForFunction(()=>document.querySelector('[role=status]').textContent.includes('not completed'));
 ok(await page.locator('.cloud-check-result').isHidden(),'Failed scan never displays partial diagnostic counts');mock.setFaults([]);
 for(const locale of ['en-US','zh-TW','ja-JP'])for(const width of [320,390,768,1440]){
  const c=await browser.newContext({locale,viewport:{width,height:900},serviceWorkers:'block'});await mock.attach(c);const p=await c.newPage();await p.goto(base+'/cloud-check.html');await p.locator('button').click();await p.locator('.cloud-check-result:not([hidden])').waitFor();
  ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Diagnostic layout fits '+locale+' '+width);
  if(width===320||width===1440)await p.screenshot({path:path.join(artifacts,locale+'-'+width+'.png'),fullPage:true});await c.close();
 }
 console.log('PASS '+checks+' read-only cloud audit checks. Screenshots: '+artifacts);
}finally{await browser.close();}
