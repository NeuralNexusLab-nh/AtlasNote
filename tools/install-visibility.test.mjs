/* Isolated Edge contexts, synthetic Puter identity; no OS installation or personal storage. */
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fixture} from './puter-fixture.mjs';
const {chromium}=createRequire(import.meta.url)('C:/Users/eaton/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true}),mock=fixture(),base='http://127.0.0.1:4321';
const artifacts=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-install-visibility-'));let checks=0;
const ok=(value,label)=>{assert.ok(value,label);checks++;};
try{
 for(const mode of ['not-installed','installed-tab','standalone']){
  const context=await browser.newContext({serviceWorkers:'block'});await mock.attach(context);
  await context.addInitScript(mode=>{
   if(mode==='installed-tab')localStorage.setItem('atlasnote.app-installed','true');
   if(mode==='standalone'){
    const original=window.matchMedia.bind(window);
    window.matchMedia=query=>{const result=original(query);if(query==='(display-mode: standalone)')Object.defineProperty(result,'matches',{value:true});return result;};
   }
  },mode);
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  for(const language of ['en','zh-Hant','ja','leet'])for(const theme of ['dark','light']){
   await page.goto(base);await page.evaluate(({language,theme})=>localStorage.setItem('atlasnote.preferences',JSON.stringify({language,theme})),{language,theme});
   await page.goto(base+'/settings.html');await page.waitForSelector('.account-settings');
   const shown=mode==='not-installed';
   ok(await page.locator('.app-settings').isVisible()===shown,`${mode} ${language} ${theme}: card visibility`);
   ok(await page.locator('[data-install]').isVisible()===shown,`${mode} ${language} ${theme}: button visibility`);
   for(const [width,height]of [[1440,900],[768,1024],[390,844],[320,568]]){
    await page.setViewportSize({width,height});ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${mode} ${language} ${theme} ${width}: no overflow`);
   }
   if(language==='zh-Hant'&&theme==='dark')await page.screenshot({path:path.join(artifacts,mode+'-mobile.png'),fullPage:true});
  }
  if(mode==='not-installed'){
   await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));
   ok(!await page.locator('.app-settings').isVisible(),'Installation event removes entire card immediately');
  }
  if(mode==='installed-tab'){
   ok(await page.evaluate(()=>!matchMedia('(display-mode: standalone)').matches),'Installed-tab case is a normal Edge tab, not simulated PWA mode');
   await page.evaluate(()=>window.dispatchEvent(new Event('beforeinstallprompt')));
   ok(await page.locator('.app-settings').isVisible()&&await page.locator('[data-install]').isVisible(),'A fresh install offer restores card and button together');
  }
  ok(!errors.length,'No browser errors: '+errors.join(', '));await context.close();
 }
 console.log(JSON.stringify({checks,artifacts},null,2));
}finally{await browser.close();}
