/* Synthetic account only. Removing file transfer must not remove storage or image features. */
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fixture} from './puter-fixture.mjs';
const {chromium}=createRequire(import.meta.url)('C:/Users/eaton/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true}),mock=fixture();
const context=await browser.newContext({locale:'en-US',serviceWorkers:'block'});await mock.attach(context);
const page=await context.newPage(),errors=[],base='http://127.0.0.1:4321';page.on('pageerror',e=>errors.push(e.message));
const artifacts=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-no-transfer-'));let checks=0;
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const transferControls='[data-import],[data-export],[data-backup],[data-conflict-export],#backup-note,.settings-data-tools';
try{
 await page.goto(base+'/dashboard.html');await page.waitForSelector('.dashboard-metrics');
 const id=await page.evaluate(async()=>{const S=await import('/script/store.js');const n=await S.saveNote({id:S.uuid(),mode:'basic',rev:0},{title:'Synthetic note without file transfers',text:'Keep content, history and cloud sync.',images:[],history:[]},null);await(await import('/script/cloud.js')).sync();return n.id;});
 const before=JSON.stringify([...mock.files.values()]);
 ok(await page.evaluate(async()=>{const S=await import('/script/store.js');return !('exportNote' in S)&&!('importEntries' in S)&&!('validateEntry' in S);}), 'File transfer functions are removed, not just hidden');
 for(const language of ['en','zh-Hant','ja','leet'])for(const theme of ['dark','light']){
  await page.evaluate(({language,theme})=>localStorage.setItem('atlasnote.preferences',JSON.stringify({language,theme,history:3,trashDays:7})),{language,theme});
  for(const route of ['/notes.html','/trash.html','/settings.html','/note.html?id='+id,'/docs.html','/docs.html?article=sync','/terms.html','/privacy.html']){
   await page.goto(base+route);await page.waitForFunction(()=>!document.querySelector('.initial-loading'));
   ok(!await page.locator(transferControls).count(),`${language} ${theme} ${route}: no transfer controls`);
   ok(!await page.locator('a[href*="article=backup"]').count(),`${route}: no removed docs link`);
   const text=await page.locator('#main').innerText();ok(!/匯入|匯出|Export JSON|Import JSON|書き出し|読み込みと書き出し/i.test(text),`${language} ${route}: no obsolete feature copy`);
   for(const [width,height]of [[1440,900],[1024,768],[768,1024],[430,932],[390,844],[360,740],[320,568],[844,390]]){
    await page.setViewportSize({width,height});ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${language} ${theme} ${route} ${width}: no overflow`);
   }
  }
 }
 ok(JSON.stringify([...mock.files.values()])===before,'Navigating without transfers does not change any cloud note');
 await page.goto(base+'/docs.html?article=backup');await page.waitForSelector('.docs-content');ok(!await page.locator('a[href*="article=backup"]').count(),'Old docs URLs fall back to an existing article');
 await page.goto(base+'/edit.html?id='+id);await page.waitForSelector('#note-text');
 ok(await page.locator('#note-text').inputValue()==='Keep content, history and cloud sync.','Existing cloud content remains editable');
 ok(!!await page.locator('[data-image-input],#image-input,input[accept*="image"]').count(),'Image upload remains available');
 await page.goto(base+'/note.html?id='+id);await page.waitForSelector('[data-copy]');ok(true,'Copy content remains available');
 await page.evaluate(()=>localStorage.setItem('atlasnote.preferences',JSON.stringify({language:'zh-Hant',theme:'dark'})));await page.setViewportSize({width:390,height:844});await page.goto(base+'/settings.html');await page.waitForSelector('.account-settings');await page.screenshot({path:path.join(artifacts,'settings-mobile.png'),fullPage:true});
 await page.setViewportSize({width:1440,height:900});await page.screenshot({path:path.join(artifacts,'settings-desktop.png'),fullPage:true});
 ok(!errors.length,'No browser errors: '+errors.join(', '));console.log(JSON.stringify({checks,artifacts},null,2));
}finally{await browser.close();}
