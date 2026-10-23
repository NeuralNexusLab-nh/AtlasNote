import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fixture} from './puter-fixture.mjs';
import {middleware} from '../middleware.js';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/eaton/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true}),mock=fixture(),context=await browser.newContext({serviceWorkers:'block',locale:'en-US'});let checks=0;
const ok=(value,label)=>{assert.ok(value,label);checks++;};
try{
 let nextCalls=0;const next=()=>{nextCalls++;return new Response('canonical-content');};
 const accepted=await middleware({request:new Request('https://atlasnote.nxlabtw.com/notes.html'),next});
 ok(await accepted.text()==='canonical-content'&&nextCalls===1,'Edge middleware serves the canonical HTTPS origin');
 for(const origin of ['https://www.atlasnote.nxlabtw.com','https://secondary.example.test','https://atlasnote.nxlabtw.com.evil.test','https://atlasnote.nxlabtw.com:444','http://127.0.0.1:4321'])for(const route of ['/','/dashboard.html','/script/app.js','/site.webmanifest']){
  const denied=await middleware({request:new Request(origin+route,{headers:{'X-Forwarded-Host':'atlasnote.nxlabtw.com'}}),next});
  ok(denied.status===421&&nextCalls===1&&!((await denied.text()).includes('/script/app.js')),'Edge rejects '+origin+route+' before serving app code');
 }
 const upgraded=await middleware({request:new Request('http://atlasnote.nxlabtw.com/notes.html?view=all'),next});
 ok(upgraded.status===308&&upgraded.headers.get('location')==='https://atlasnote.nxlabtw.com/notes.html?view=all','Canonical HTTP requests upgrade to HTTPS');
 await mock.attach(context,{signedIn:true});
 await context.addInitScript(()=>localStorage.setItem('atlasnote.legacy.sentinel','leave-this-data-alone'));
 await context.route('https://secondary.example.test/**',async route=>{const url=new URL(route.request().url()),response=await fetch('http://127.0.0.1:4321'+url.pathname+url.search),headers=Object.fromEntries(response.headers);delete headers['content-length'];await route.fulfill({status:response.status,headers,body:Buffer.from(await response.arrayBuffer())});});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const route of ['/','/dashboard.html','/notes.html','/edit.html','/trash.html','/settings.html','/docs.html']){await page.goto('https://secondary.example.test'+route);await page.waitForSelector('.main-site-gate');ok(!await page.locator('[data-cloud-login],.note-actions,.dashboard-metrics').count(),'Client fallback blocks '+route);}
 const gateText=await page.locator('.main-site-gate').innerText();ok(gateText.includes('僅在主站')||gateText.toLowerCase().includes('main address')||gateText.includes('メインサイト'),'Secondary hostname displays the main-site-only gate');
 ok(await page.locator('.main-site-gate a').getAttribute('href')==='https://atlasnote.nxlabtw.com/','Gate points directly to the canonical hostname');
 ok(await page.evaluate(()=>localStorage.getItem('atlasnote.legacy.sentinel'))==='leave-this-data-alone','Secondary hostname does not run destructive local-data cleanup');
 ok(mock.calls.length===0,'Secondary hostname makes no Puter API calls');
 const rejected=await page.evaluate(async()=>{const cloud=await import('/script/cloud.js');return Promise.all(['sdk','signIn','connect','authorize'].map(async action=>{try{await cloud[action]();return null;}catch(e){return e.message;}}));});
 ok(rejected.every(error=>error==='mainSiteOnly')&&mock.calls.length===0,'Cloud boundaries reject SDK, login, connection and authorization on secondary hosts');
 const artifacts=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-host-gate-'));
 for(const [width,height]of [[1440,900],[390,844],[320,568]]){await page.setViewportSize({width,height});ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Gate has no horizontal overflow at '+width);await page.screenshot({path:path.join(artifacts,'gate-'+width+'.png'),fullPage:true});}
 for(const [language,terms,phrase]of [['en','Terms','AtlasNote runs only on atlasnote.nxlabtw.com'],['zh-Hant','使用條款','AtlasNote 僅在 atlasnote.nxlabtw.com 運作'],['ja','利用規約','AtlasNote は atlasnote.nxlabtw.com でのみ動作します']]){
  mock.setPreferences({language,theme:'dark',history:3,trashDays:7});
  await page.goto('https://atlasnote.nxlabtw.com/privacy.html');await page.waitForSelector('.docs-layout');
  await page.waitForFunction(({language,terms})=>document.documentElement.lang===language&&document.querySelector('#footer a')?.textContent===terms,{language,terms});
  const privacyText=await page.locator('.docs-content').innerText();
  ok(privacyText.includes(phrase)&&!privacyText.includes('On secondary domains')&&!privacyText.includes('副網域會先刪除'),'Privacy and navigation match the saved '+language+' locale');
  ok(await page.locator('#language').inputValue()===language,'Language selector matches rendered '+language+' content');
 }
 ok(errors.length===0,'No uncaught browser errors');
 console.log('PASS '+checks+' canonical-host gate checks. Screenshots: '+artifacts);
}finally{await browser.close();}
