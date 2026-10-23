import {createRequire} from 'node:module';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/eaton/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
const root='https://atlasnote.nxlabtw.com',artifacts=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-install-'));let count=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));const ok=(v,m)=>{assert.ok(v,m);count++;};
const sizes=[[1440,900],[1024,768],[768,1024],[430,932],[390,844],[360,740],[320,568],[844,390]];
try{
 await page.goto(root);await page.waitForSelector('.hero');await page.selectOption('#language','en');await page.waitForTimeout(1800);
 ok(await page.locator('.demo-checklist input:checked').count()===1,'Only first demo step checked');
 ok((await page.locator('.demo-checklist').innerText()).includes('first note'),'Useful demo checklist');
 await page.locator('[data-scene="1"]').click();ok((await page.locator('#hero-note').innerText()).includes('Dinner'),'Concrete reminder demo');
 for(const route of ['/','/notes.html','/trash.html','/edit.html','/settings.html','/docs.html','/terms.html','/privacy.html']){
  await page.goto(root+route);await page.waitForSelector('#global-stars');ok(await page.locator('#global-stars').count()===1,'One meteor canvas on '+route);
  if(route.includes('settings')||route.includes('notes'))ok((await page.locator('.storage-limit').innerText()).includes('GB'),'Capacity estimate shown on '+route);
 }
 await page.goto(root);await page.waitForSelector('[data-hero-install]');
 // Correct native prompt from a user click; rejection and dismissal must show help instead of an error.
 for(const outcome of ['accepted','dismissed','rejected']){
  await page.evaluate(outcome=>{window.__promptCalls=0;const e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=()=>{window.__promptCalls++;return outcome==='rejected'?Promise.reject(new Error('blocked')):Promise.resolve();};e.userChoice=Promise.resolve({outcome});dispatchEvent(e);},outcome);
  await page.locator('[data-hero-install]').click();ok(await page.evaluate(()=>window.__promptCalls)===1,'Native prompt called once');
  if(outcome==='accepted')ok(await page.locator('.install-dialog').count()===0,'Accepted native prompt no extra modal');
  else{await page.waitForSelector('.install-dialog');await page.locator('[data-close]').click();}
 }
 for(const lang of ['en','zh-Hant','ja','leet'])for(const theme of ['dark','light']){
  await page.evaluate(({lang,theme})=>localStorage.setItem('atlasnote.preferences',JSON.stringify({language:lang,theme})),{lang,theme});await page.goto(root);await page.waitForSelector('[data-hero-install]');
  await page.locator('[data-hero-install]').click();await page.waitForSelector('.install-dialog');await page.locator('[data-view=manual]').click();
  for(const browserKey of ['edge','chrome','ios','mac','android','firefox','other']){
   await page.locator('[data-browser]').selectOption(browserKey);
   for(const [width,height]of sizes){await page.setViewportSize({width,height});
    ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${lang}/${theme} ${browserKey} ${width} document width`);
    ok(await page.locator('.install-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1),`${browserKey} dialog width`);
    if(width<=600&&browserKey!=='other')ok(await page.locator('.install-step:visible').count()===1,'Mobile shows one step');
   }
  }
  await page.setViewportSize({width:390,height:844});await page.locator('[data-browser]').selectOption('ios');await page.locator('[data-next]').click();ok((await page.locator('.install-step.current').innerText()).includes(lang==='zh-Hant'?'加入主畫面':lang==='ja'?'ホーム画面':lang==='leet'?'Home':'Home Screen'),'Mobile next step');
  await page.mouse.click(1,1);ok(await page.locator('.install-dialog').isVisible(),'Backdrop does not dismiss installation');
  if(lang==='zh-Hant'&&theme==='dark')await page.screenshot({path:path.join(artifacts,'install-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1440,height:900});await page.locator('[data-browser]').selectOption('edge');if(lang==='zh-Hant'&&theme==='dark')await page.screenshot({path:path.join(artifacts,'install-desktop.png'),fullPage:true});
  await page.keyboard.press('Escape');ok(await page.locator('.install-dialog').count()===0,'Escape closes tutorial');
  if(lang==='zh-Hant'&&theme==='dark'){
   await page.waitForTimeout(1800);await page.screenshot({path:path.join(artifacts,'home-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(artifacts,'home-mobile.png'),fullPage:true});
   await page.goto(root+'/edit.html');await page.waitForSelector('.compression-label');ok((await page.locator('.compression-label').innerText()).includes('壓縮'),'Compression has a visible label');await page.screenshot({path:path.join(artifacts,'edit-mobile.png'),fullPage:true});
   await page.goto(root+'/settings.html');await page.waitForSelector('.storage-limit');await page.screenshot({path:path.join(artifacts,'settings-mobile.png'),fullPage:true});await page.setViewportSize({width:1440,height:900});await page.screenshot({path:path.join(artifacts,'settings-desktop.png'),fullPage:true});
  }
 }
 // Unavailable quota API must not block saving. No storage-warning interstitial.
 await page.addInitScript(()=>{Object.defineProperty(navigator.storage,'estimate',{value:()=>Promise.reject(new Error('unavailable'))});});
 await page.goto(root+'/edit.html');await page.waitForSelector('#editor-form');await page.locator('#note-title').fill('Synthetic storage test');await page.locator('#note-text').fill('Only isolated test data.');await page.locator('#save-note').click();await page.waitForURL('**/note.html?id=*');ok(await page.locator('dialog').count()===0,'Saving no longer interrupts with storage warning');
 await page.goto(root+'/notes.html');await page.waitForSelector('.note-card');ok((await page.locator('.storage-limit').innerText()).includes('browser')||await page.locator('.storage-limit').count()===1,'Missing capacity does not block notes');
 await page.evaluate(()=>dispatchEvent(new Event('appinstalled')));ok(await page.locator('[data-install-control]').isHidden(),'Installed app hides install control');
 ok(errors.length===0,'No page errors: '+errors.join(','));console.log(`PASS ${count} checks. Screenshots: ${artifacts}`);
}finally{await browser.close();}
