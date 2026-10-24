import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {fixture} from './puter-fixture.mjs';
const {chromium}=createRequire(import.meta.url)('C:/Users/eaton/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true}),mock=fixture(),context=await browser.newContext({serviceWorkers:'block'});await mock.attach(context);const page=await context.newPage();let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};mock.setUsage({used:null,capacity:null},{allowanceInfo:{}});
try{
 for(const language of ['en','zh-Hant','ja','leet'])for(const theme of ['dark','light']){
  mock.setPreferences({language,theme,history:3,trashDays:7});await page.goto('https://atlasnote.nxlabtw.com/dashboard.html');await page.waitForSelector('.resource-pair');
  ok(await page.locator('.dashboard-metrics .meter').count()===0,'Unknown usage never invents a percentage');
  ok((await page.locator('.resource-pair strong').allTextContents()).every(t=>t==='—'),'Unknown capacity uses a compact placeholder');
  for(const [width,height]of [[1440,900],[1024,768],[768,1024],[430,932],[390,844],[360,740],[320,568],[844,390]]){
   await page.setViewportSize({width,height});ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${language}/${theme}/${width}: unavailable state has no horizontal overflow`);
  }
 }
 console.log(`PASS ${checks} unavailable-resource layout and honest-value checks.`);
}finally{await browser.close();}
