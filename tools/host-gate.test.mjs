import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {fixture} from './puter-fixture.mjs';
import {MAIN_ORIGIN,isMainSite,mainSiteURL} from '../script/site-origin.js';

const require=createRequire(import.meta.url),{chromium}=require('C:/Users/eaton/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true}),mock=fixture(),context=await browser.newContext({serviceWorkers:'block',locale:'en-US'});let checks=0;
const ok=(value,label)=>{assert.ok(value,label);checks++;};
try{
 ok(isMainSite(new URL(MAIN_ORIGIN+'/notes.html')),'Canonical origin is accepted');
 for(const source of [
  'https://www.atlasnote.nxlabtw.com/notes.html?view=all#recent',
  'https://secondary.example.test/dashboard.html?welcome=1',
  'https://atlasnote.nxlabtw.com.evil.test/settings.html',
  'http://127.0.0.1:4321/docs.html'
 ]){
  const input=new URL(source),target=new URL(mainSiteURL(input));
  ok(target.origin===MAIN_ORIGIN&&target.pathname===input.pathname&&target.search===input.search&&target.hash===input.hash,'Canonical redirect preserves route details for '+source);
 }
 await mock.attach(context,{signedIn:false});
 await context.route('https://secondary.example.test/**',async route=>{
  const url=new URL(route.request().url()),response=await fetch('http://127.0.0.1:4321'+url.pathname+url.search),headers=Object.fromEntries(response.headers);delete headers['content-length'];
  await route.fulfill({status:response.status,headers,body:Buffer.from(await response.arrayBuffer())});
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('https://secondary.example.test/?from=redirect#hero');
 await page.waitForURL(MAIN_ORIGIN+'/?from=redirect#hero');
 ok(page.url()===MAIN_ORIGIN+'/?from=redirect#hero','Non-canonical page redirects to canonical route');
 ok(mock.calls.length===0,'Redirect occurs before Puter starts on a public page');
 ok(errors.length===0,'Redirect creates no browser errors');
 console.log('PASS '+checks+' static canonical redirect checks.');
}finally{await browser.close();}
