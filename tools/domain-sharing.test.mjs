import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {fixture} from './puter-fixture.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/eaton/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true}),mock=fixture(),context=await browser.newContext({serviceWorkers:'block'});let checks=0;const ok=(value,label)=>{assert.ok(value,label);checks++;};
try{
 await mock.attach(context,{mainAppGranted:false,grantOnRequest:false});
 const page=await context.newPage(),origin='https://notes.example.test',local='11111111-1111-4111-8111-111111111111:',secondary='/codex-test/AppData/test-secondary-notes-example-test/atlasnote-v1/old.json',main='/codex-test/AppData/test-atlasnote/atlasnote-v1/sentinel.json';
 mock.files.set(local+secondary,{owner:mock.owner,path:secondary,text:'secondary-only data'});mock.files.set(local+main,{owner:mock.owner,path:main,text:'main data must remain'});
 await context.route(origin+'/**',async route=>{const url=new URL(route.request().url()),response=await fetch('http://127.0.0.1:4321'+url.pathname+url.search);const headers=Object.fromEntries(response.headers);delete headers['content-length'];await route.fulfill({status:response.status,headers,body:Buffer.from(await response.arrayBuffer())});});
 await page.goto(origin+'/dashboard.html');await page.waitForSelector('[data-domain-permission]');
 ok(!mock.files.has(local+secondary),'Secondary origin Puter data is removed before requesting main-app access');
 ok(mock.files.get(local+main)?.text==='main data must remain'&&mock.files.size===1,'Denied secondary has not read, deleted or initialized main-app data');
 ok(mock.calls.some(call=>call.method==='permsCheck'&&call.args[0]==='appData')&&!mock.calls.some(call=>call.method==='write'),'Permission is checked before any main-app write');
 mock.setDomainAccess(false,false);await page.locator('[data-domain-permission]').click();await page.waitForSelector('dialog [data-confirm]');await page.locator('dialog [data-confirm]').click();await page.waitForSelector('[data-domain-permission]');
 ok(await page.locator('[data-domain-permission]').count()===1,'Declined permission leaves notes unavailable and keeps an explicit retry action');
 // A fresh explicit access action is a user gesture; grant only the main AtlasNote app's data scopes.
 mock.setDomainAccess(false,true);await page.locator('[data-domain-permission]').click();await page.waitForSelector('.dashboard-metrics');
 const refreshed=await page.evaluate(async()=> (await import('/script/cloud.js')).signedIn());ok(refreshed,'Granting app-data permission connects the secondary origin to the main app namespace');
 await page.evaluate(async()=>{const C=await import('/script/cloud.js');await C.savePreferences({theme:'dark',language:'en',history:3,trashDays:7});});
 ok(mock.calls.some(call=>call.method==='kvSet'&&call.args[2]?.appUuid==='test-atlasnote'),'Secondary preferences are written into the main app KV namespace');
 ok([...mock.files.values()].some(file=>file.path.startsWith('/codex-test/AppData/test-atlasnote/atlasnote-v1/')),'Secondary cloud files use the canonical app AppData path');
 const secondarySentinel='/codex-test/AppData/test-secondary-notes-example-test/atlasnote-v1/after-consent.json';mock.files.set(local+secondarySentinel,{owner:mock.owner,path:secondarySentinel,text:'not touched after consent'});await page.reload();await page.waitForSelector('.dashboard-metrics');ok(mock.files.has(local+secondarySentinel),'Reconnecting after consent does not keep deleting the secondary app namespace');
 console.log('PASS '+checks+' secondary-origin cleanup, consent gate and shared Puter namespace checks.');
}finally{await browser.close();}
