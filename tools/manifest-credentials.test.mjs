import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {createRequire} from 'node:module';
import {fixture} from './puter-fixture.mjs';
const {chromium}=createRequire(import.meta.url)('C:/Users/eaton/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base='https://atlasnote.nxlabtw.com',preview=process.env.ATLAS_TEST_ORIGIN||'http://127.0.0.1:4321';
const manifest=await fs.readFile(new URL('../site.webmanifest',import.meta.url),'utf8');assert.equal(JSON.parse(manifest).name,'AtlasNote');
let checks=0;const ok=(value,message)=>{assert.ok(value,message);checks++;};
for(const name of ['index','dashboard','notes','note','edit','trash','settings','docs','terms','privacy']){
 const html=await fs.readFile(new URL('../'+name+'.html',import.meta.url),'utf8');
 ok(/<link\s+rel="manifest"\s+href="\/site\.webmanifest"\s+crossorigin="use-credentials"/.test(html),name+': manifest carries the site verification cookie');
}
const browser=await chromium.launch({channel:'msedge',headless:true});
async function check(legacy){
 const context=await browser.newContext({locale:'en-US',serviceWorkers:'block'});await fixture().attach(context,{signedIn:false});
 await context.addCookies([{name:'EO_Bot_Ssid',value:'synthetic-atlas-ticket',url:base,httpOnly:true,secure:true,sameSite:'Lax'}]);
 const received=[];
 await context.route(base+'/site.webmanifest',async route=>{
  const headers=await route.request().allHeaders(),verified=headers.cookie?.includes('EO_Bot_Ssid=synthetic-atlas-ticket');received.push(!!verified);
  return route.fulfill({status:200,contentType:verified?'application/manifest+json':'text/html',body:verified?manifest:'<!doctype html><title>Synthetic edge verification page</title>'});
 });
 if(legacy)await context.route(base+'/',async route=>{const response=await fetch(preview+'/'),html=(await response.text()).replace(' crossorigin="use-credentials"','');const headers=Object.fromEntries(response.headers);delete headers['content-length'];return route.fulfill({status:200,headers,body:html});});
 const page=await context.newPage(),cdp=await context.newCDPSession(page);await cdp.send('Page.enable');await page.goto(base+'/');await page.waitForSelector('.hero');const result=await cdp.send('Page.getAppManifest');await context.close();return {result,received};
}
try{
 const old=await check(true);
 ok(old.received.length>0&&old.received.every(value=>!value),'Old manifest link omits the verification cookie');
 ok(old.result.errors.some(e=>/syntax|parse|JSON/i.test(e.message)),'Old behavior reproduces the HTML-as-manifest parse error');
 const current=await check(false);
 ok(current.received.length>0&&current.received.every(Boolean),'Updated manifest request includes the synthetic verification cookie');
 ok(!current.result.errors.length&&JSON.parse(current.result.data).name==='AtlasNote','Browser parses the authenticated manifest without errors');
 console.log('PASS '+checks+' credentialed manifest and edge-challenge regression checks.');
}finally{await browser.close();}
