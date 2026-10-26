import {createRequire} from 'node:module';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {fixture} from './puter-fixture.mjs';
const {chromium}=createRequire(import.meta.url)('C:/Users/eaton/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true}),mock=fixture(),artifacts=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-polish-')),base='https://atlasnote.nxlabtw.com';let checks=0;const errors=[],ok=(v,m)=>{assert.ok(v,m);checks++;};
const context=await browser.newContext({locale:'en-US',viewport:{width:1440,height:900},serviceWorkers:'block'});await mock.attach(context,{authDelay:650});const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
try{
 await p.goto(base);await p.waitForSelector('.hero');await p.waitForSelector('[data-nav-signout]');await p.waitForFunction(()=>[...document.querySelectorAll('[data-home-primary]')].every(a=>a.textContent.includes('Open dashboard')));
 ok(await p.locator('[data-home-primary]').count()===2,'Both homepage CTAs update after delayed authentication');ok(await p.locator('#language').evaluate(e=>e.nextElementSibling.matches('[data-nav-signout]')),'Sign out immediately follows language selector');ok(!await p.locator('[data-theme-toggle]').count(),'Navbar theme control removed');
 const durations=await p.evaluate(()=>Object.fromEntries([['wordmark','.hero-wordmark'],['copy','.hero-copy'],['preview','.hero-preview']].map(([k,s])=>[k,parseFloat(getComputedStyle(document.querySelector(s)).animationDuration)])));ok(durations.wordmark===.095&&durations.copy===.1125&&durations.preview===.125,'Homepage entrance duration is 25% of previous duration');
 for(const [used,remaining]of [[0,100],[25,75],[80,20],[100,0]]){
  mock.setUsage({used,capacity:100},{allowanceInfo:{remaining,monthUsageAllowance:100}});await p.goto(base+'/dashboard.html');await p.waitForSelector('.dashboard-metrics .meter');
  const meters=await p.locator('.meter').evaluateAll(es=>es.map(e=>({ratio:e.firstElementChild.getBoundingClientRect().width/e.getBoundingClientRect().width,value:Number(e.getAttribute('aria-valuenow'))})));
  ok(meters.length===2&&Math.abs(meters[0].ratio-used/100)<.015&&meters[0].value===used&&Math.abs(meters[1].ratio-remaining/100)<.015&&meters[1].value===remaining,`Storage bar matches ${used}% used and allowance bar matches ${remaining}% remaining`);
 }
 mock.setUsage({used:44_600,capacity:104_857_600},{allowanceInfo:{remaining:830,monthUsageAllowance:1000}});
 await p.goto(base+'/notes.html');await p.waitForSelector('#note-list');ok(!await p.locator('.resource-stack').count(),'No capacity cards on My notes');
 await p.goto(base+'/settings.html');await p.waitForSelector('.account-settings');ok(!await p.locator('.resource-stack').count(),'No capacity cards in Settings');ok(!await p.locator('.account-settings').getByText('Email not verified').count(),'No misleading email-verification badge');ok(!await p.locator('.account-settings a[href="https://puter.com"]').count(),'Redundant Puter Support link removed');
 const notes=await p.evaluate(async()=>{const S=await import('/script/store.js'),C=await import('/script/crypto.js'),result=[];for(const mode of ['none','basic','secure']){const id=S.uuid(),v=mode==='secure'?await C.createVault(id,'Synthetic!PIN15'):null,n=await S.saveNote({id,mode,rev:0,trashedAt:new Date().toISOString(),trashDays:7,...(v?{salt:v.salt,wrap:v.wrap}:{})},{title:'Trash test '+mode,text:'Readable trash '+mode,images:[],history:[]},v?.key);v?.key.fill(0);result.push({id:n.id,mode});}await(await import('/script/cloud.js')).sync();return result;});
 for(const {id,mode}of notes){
  await p.goto(base+'/trash.html');await p.waitForSelector('.note-card');await p.locator(`a.note-link[href="/note.html?id=${id}"]`).click();await p.waitForSelector('.trash-note-banner');
  if(mode==='secure'){await p.locator('[data-unlock]').click();await p.locator('#vault-input').fill('Synthetic!PIN15');await p.locator('dialog [data-confirm]').click();}
  await p.waitForFunction(mode=>document.querySelector('#note-content')?.textContent.includes('Readable trash '+mode),mode);ok(true,`${mode} trash note opens through actual card link`);ok(!await p.locator('.note-actions a[href^="/edit"], [data-agent], [data-history]').count(),'Trashed note has no editing actions');ok(await p.locator('[data-restore], [data-permanent-delete]').count()===2,'Restore and permanent delete available');
  await p.goto(base+'/edit.html?id='+id);await p.waitForURL('**/note.html?id='+id);ok(!await p.locator('#editor-form').count(),'Direct edit URL redirects to read-only trash note');
 }
 await p.locator('[data-restore]').click();await p.waitForSelector('[data-agent]');ok(!await p.locator('.trash-note-banner').count(),'Restoring unlocks normal note actions');
 for(const language of ['en','zh-Hant','ja','leet'])for(const theme of ['dark','light']){
  mock.setPreferences({language,theme,history:3,trashDays:7});
  for(const route of ['/','/dashboard.html','/notes.html','/trash.html','/settings.html']){
   await p.goto(base+route);await p.waitForFunction(()=>!document.querySelector('.initial-loading'));await p.waitForTimeout(500);
   for(const [width,height]of [[1440,900],[1024,768],[768,1024],[430,932],[390,844],[360,740],[320,568],[844,390]]){
    await p.setViewportSize({width,height});ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${language} ${theme} ${route} ${width}: no overflow`);
    ok(await p.locator('.nav-auth').isVisible(),`${width}: login/logout is reachable`);
   }
   if(['en','zh-Hant','ja'].includes(language)&&['/','/dashboard.html','/settings.html','/trash.html'].includes(route)){
    await p.setViewportSize({width:390,height:844});await p.screenshot({path:path.join(artifacts,`${language}-${theme}-${route==='/'?'home':route.slice(1,-5)}-mobile.png`),fullPage:true});
    if(language==='zh-Hant'&&theme==='dark'){await p.setViewportSize({width:1440,height:900});await p.screenshot({path:path.join(artifacts,`${route==='/'?'home':route.slice(1,-5)}-desktop.png`),fullPage:true});}
   }
  }
 }
 const allIcons=await p.locator('i.fa-solid').evaluateAll(es=>es.every(e=>{const c=getComputedStyle(e,'::before').content;return c&&c!=='none'&&c!=='normal'&&c!=='""';}));ok(allIcons,'All displayed Font Awesome icons have glyphs');
 await p.setViewportSize({width:390,height:844});await p.goto(base);await p.waitForSelector('[data-menu]');await p.locator('[data-menu]').click();ok(await p.locator('#navbar').evaluate(e=>e.classList.contains('open')),'Mobile menu opens');await p.locator('.nav-links a[href="/dashboard.html"]').click();await p.waitForSelector('.dashboard-metrics');ok(!await p.locator('#navbar').evaluate(e=>e.classList.contains('open')),'Mobile menu closes on navigation');
 await p.locator('[data-nav-signout]').click();await p.locator('dialog [data-confirm]').click();await p.waitForURL(base+'/');await p.waitForSelector('.nav-auth.primary');ok(!await p.locator('[data-nav-signout]').count(),'Navbar sign out actually logs out');ok(await p.locator('#language').evaluate(e=>e.nextElementSibling.matches('.nav-auth')),'Signed-out login also follows language selector');
 ok(errors.length===0,'No unhandled browser errors: '+errors.join(', '));console.log(JSON.stringify({checks,artifacts},null,2));
}catch(e){await p.screenshot({path:path.join(artifacts,'failure.png'),fullPage:true});console.error('Screenshots:',artifacts);throw e;}finally{await browser.close();}
