/* Isolated synthetic browser tests. No real profile, mail, secrets or original notes. */
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/eaton/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.env.ATLAS_TEST_URL||'http://127.0.0.1:4321';
const artifacts=await fs.mkdtemp(path.join(os.tmpdir(),'atlasnote-qa-'));
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
const page=await context.newPage();const errors=[],requests=[];let assertions=0;
page.on('pageerror',e=>errors.push(e.message));page.on('request',req=>{if(!req.url().startsWith(base)&&!req.url().startsWith('data:'))requests.push(req.url());});
const ok=(v,m)=>{assert.ok(v,m);assertions++;};
try{
 await page.goto(base);await page.waitForSelector('.hero');await page.screenshot({path:path.join(artifacts,'home-desktop.png'),fullPage:true});
 const feature=await page.evaluate(()=>({crypto:!!crypto.subtle,idb:!!indexedDB}));ok(feature.crypto&&feature.idb,'Secure context and IndexedDB');
 // Real UI creation, persistence and Markdown/XSS behavior.
 await page.goto(base+'/edit.html');await page.locator('#note-title').fill('QA travel reference');await page.locator('#note-text').fill('# A useful note\n\n**Keep this.**\n\n<script>window.bad=1</script>\n\n![remote](https://example.com/tracking.png)');
 await page.locator('#save-note').click();await page.waitForURL('**/note.html?id=*');await page.waitForSelector('#note-content strong');ok(await page.locator('#note-content strong').textContent()==='Keep this.','Markdown rendering');ok(!await page.evaluate(()=>window.bad),'Raw HTML is not executed');
 const basicURL=page.url();await page.reload();await page.waitForSelector('#note-content strong');ok(true,'Note persists after reload');
 await page.goto(base+'/edit.html?id='+new URL(basicURL).searchParams.get('id'));await page.locator('#note-text').fill('Changed body');await page.locator('#save-note').click();await page.waitForURL('**/note.html?id=*');await page.waitForSelector('#note-content');
 const checks=await page.evaluate(async()=>{
  const S=await import('/script/store.js'),C=await import('/script/crypto.js');
  const notes=await S.all(),first=notes[0],raw=JSON.stringify(first),payload=await S.decodeRecord(first),entry=await S.exportNote(first);
  const secondId=S.uuid(),second=await S.saveNote({id:secondId,mode:'basic',rev:0},{title:'QA other note',text:'Other private body',images:[],history:[]},null);
  const secondKey=await C.deviceKey(secondId);let separated=false;try{await C.open(C.unb64(entry.key),secondId,'content',second.body);}catch{separated=true;}secondKey.fill(0);
  const before=(await S.all()).length;await S.importEntries([entry],()=>{throw new Error('must not prompt');});const imported=(await S.all()).find(n=>![first.id,secondId].includes(n.id));const importedPayload=await S.decodeRecord(imported);
  let conflict=false;try{await S.put({...first,archived:true},0);}catch(e){conflict=e.message==='conflict';}
  let rejected=false;try{await S.importEntries([entry,{...entry,id:'malicious'}],()=>{});}catch{rejected=true;}
  const after=(await S.all()).length;
  const vault=await C.createVault(S.uuid(),'Qa!7passPhrase');const id=S.uuid(),v=await C.createVault(id,'Qa!7passPhrase');
  const secure=await S.saveNote({id,mode:'secure',rev:0,salt:v.salt,wrap:v.wrap},{title:'QA safe note',text:'Only the right passphrase',images:[],history:[]},v.key);v.key.fill(0);
  let wrong=false;try{await C.unlockVault(secure,'WRONG');}catch{wrong=true;}
  const key=await C.unlockVault(secure,'Qa!7passPhrase'),clear=await S.decodeRecord(secure,key);key.fill(0);
  const exported=await S.exportNote(secure);let prompt=0;await S.importEntries([exported],async()=>++prompt===1?'Qa!7passPhrase':'New!7Passphrase');
  const ids=new Set([first.id,secondId,imported.id,id]);const restored=(await S.all()).find(n=>!ids.has(n.id));const restoredKey=await C.unlockVault(restored,'New!7Passphrase');const restoredPayload=await S.decodeRecord(restored,restoredKey);restoredKey.fill(0);vault.key.fill(0);
  return {ciphertext:!raw.includes('Changed body')&&!raw.includes('QA travel reference'),history:payload.history.length===1,historyText:S.apply(payload.text,payload.history[0].text),separated,basicKey:!!entry.key,importedFresh:imported.id!==first.id&&importedPayload.text===payload.text,conflict,rejected,atomic:after===before+1,wrong,secure:clear.text==='Only the right passphrase',noSecureKey:!('key' in exported),rewrapped:restoredPayload.text===clear.text&&restored.id!==id,allCount:(await S.all()).length};
 });
 for(const [key,value] of Object.entries(checks))if(typeof value==='boolean')ok(value,key);ok(checks.historyText.startsWith('# A useful note'),'Reverse text history');console.log('Functional checks:',checks);
 // Quota and settings controls.
 await page.goto(base+'/settings.html');await page.waitForSelector('#retention-form');await page.locator('[name=history]').selectOption('10');await page.locator('#retention-form button').click();await page.reload();await page.waitForSelector('#retention-form');ok(await page.locator('[name=history]').inputValue()==='10','Retention setting persists');
 await page.goto(base+'/notes.html');await page.waitForSelector('.note-card');await page.locator('#search').fill('other note');ok(await page.locator('.note-card').count()===1,'Title search');
 // Every representative size, locale and theme; do not touch a real user profile.
 const sizes=[[1440,900],[1024,768],[768,1024],[430,932],[390,844],[360,740],[320,568],[844,390]];
 for(const lang of ['en','zh-Hant','ja','leet'])for(const theme of ['dark','light']){
  await page.evaluate(({lang,theme})=>{const p=JSON.parse(localStorage.getItem('atlasnote.preferences')||'{}');localStorage.setItem('atlasnote.preferences',JSON.stringify({...p,language:lang,theme}));},{lang,theme});
  for(const route of ['/','/notes.html','/settings.html','/edit.html','/docs.html','/docs.html?article=encryption','/privacy.html','/terms.html']){
   await page.goto(base+route);await page.waitForFunction(()=>!document.querySelector('.initial-loading'));
   for(const [width,height] of sizes){await page.setViewportSize({width,height});await page.waitForTimeout(35);const bad=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().right>innerWidth+2&&getComputedStyle(e).position!=='fixed').slice(0,4).map(e=>e.className)}));ok(bad.scroll<=bad.width+2,`${lang}/${theme} ${route} ${width}: ${JSON.stringify(bad)}`);}
   if(lang==='zh-Hant'&&theme==='dark'&&['/','/edit.html','/notes.html','/settings.html','/docs.html'].includes(route)){await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(artifacts,`mobile-${route.replace(/[^a-z]/g,'')||'home'}.png`),fullPage:true});}
  }
 }
 await page.setViewportSize({width:1440,height:900});await page.goto(base+'/notes.html');await page.screenshot({path:path.join(artifacts,'notes-desktop.png'),fullPage:true});
 // Service worker controls a fresh page, offline navigation succeeds.
 await page.goto(base);await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await page.goto(base+'/notes.html');await page.waitForSelector('.note-card');ok(true,'PWA offline notes');await context.setOffline(false);
 ok(requests.length===0,'No external network requests: '+requests.join(','));ok(errors.length===0,'No runtime errors: '+errors.join(','));
 console.log(`PASS ${assertions} checks. Screenshots: ${artifacts}`);
}catch(e){await page.screenshot({path:path.join(artifacts,'failure.png'),fullPage:true}).catch(()=>{});console.error('FAILED',e,errors,'Screenshots:',artifacts);process.exitCode=1;}
finally{await context.close();await browser.close();}
