import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fixture} from './puter-fixture.mjs';

const config=JSON.parse(await fs.readFile(new URL('../edgeone.json',import.meta.url),'utf8'));
const rules=config.headers, common=rules.find(rule=>rule.source==='/*').headers;
const policy=Object.fromEntries(common.map(({key,value})=>[key.toLowerCase(),value]));
const template=rules.map(rule=>rule.source+'\n'+rule.headers.map(({key,value})=>`  ${key}: ${value}`).join('\n')).join('\n')+'\n';
assert.equal((await fs.readFile(new URL('../_headers',import.meta.url),'utf8')).replace(/\r\n/g,'\n'),template,'Static host policies stay identical');
assert(common.length<=30);
for(const {key,value} of common){assert(key.length&&value.length<=1000&&/^[\x20-\x7e]+$/.test(value));}
const csp=policy['content-security-policy'];
assert(csp.includes("default-src 'none'"));
assert(!csp.includes("'unsafe-inline'")&&!csp.includes("'unsafe-eval'"));
assert(csp.includes("'wasm-unsafe-eval'"),'PIN KDF needs WebAssembly, not arbitrary JS eval');
assert(csp.includes("frame-ancestors 'none'")&&csp.includes("script-src-attr 'none'"));
assert(csp.includes('upgrade-insecure-requests'));
assert(csp.includes('https://puter-seoul.s3.ap-northeast-2.amazonaws.com'),'Allow the observed Puter signed-storage host');
assert(!csp.includes('https://*.amazonaws.com'),'Do not allow arbitrary AWS buckets');
assert.equal(policy['cross-origin-opener-policy'],'same-origin-allow-popups','Keep OAuth popup opener communication');
assert.equal(policy['cross-origin-resource-policy'],'same-origin');
assert(!('cross-origin-embedder-policy' in policy),'Do not break the external SDK with an unverified COEP requirement');
assert(!Object.keys(policy).some(key=>key.startsWith('access-control-allow-')),'Domain portability must not enable wildcard CORS');
assert(!policy['strict-transport-security'].includes('includeSubDomains'),'Do not change security policy of unrelated subdomains');

const base=process.env.ATLAS_TEST_ORIGIN||'http://127.0.0.1:4321';
for(const pathname of ['/','/notes','/script/app.js','/script/kdf-worker.js','/site.webmanifest','/sw.js','/not-a-page']){
 const response=await fetch(base+pathname);
 for(const [key,value] of Object.entries(policy)){
  if(key==='strict-transport-security'){assert.equal(response.headers.get(key),null);continue;}
  const expected=key==='content-security-policy'?value.replace(/; upgrade-insecure-requests$/,''):key==='cache-control'&&['/sw.js','/site.webmanifest'].includes(pathname)?'no-cache':value;
  assert.equal(response.headers.get(key),expected,pathname+' '+key);
 }
 assert.equal(response.headers.get('access-control-allow-origin'),null);
}
const denied=await fetch(base+'/',{method:'POST'});assert.equal(denied.status,405);assert.equal(denied.headers.get('x-frame-options'),'DENY');

const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/eaton/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 for(const host of ['atlasnote.nxlabtw.com']){
  const context=await browser.newContext({serviceWorkers:'block',locale:'en-US'}),mock=fixture();
  await mock.attach(context);
  const requests=[];
  await context.route('https://'+host+'/**',async route=>{
   const url=new URL(route.request().url()),response=await fetch(base+url.pathname+url.search);
   const headers=Object.fromEntries(response.headers);delete headers['content-length'];
   // Fulfill the production policy at the canonical host without using a real account or DNS.
   Object.assign(headers,policy);
   await route.fulfill({status:response.status,headers,body:Buffer.from(await response.arrayBuffer())});
  });
  await context.route('https://untrusted.example.net/**',route=>{requests.push(route.request().url());return route.abort();});
  for(const pattern of ['https://other-bucket.s3.ap-northeast-2.amazonaws.com/**','https://puter-seoul.s3.ap-northeast-2.amazonaws.com.attacker.example/**'])await context.route(pattern,route=>{requests.push(route.request().url());return route.abort();});
  await context.addInitScript(()=>{window.__violations=[];document.addEventListener('securitypolicyviolation',event=>window.__violations.push(event.effectiveDirective));});
  const page=await context.newPage();
  await page.goto('https://'+host+'/edit.html');await page.waitForSelector('#note-title');
  await page.locator('#note-title').fill('Portable synthetic note');await page.locator('#note-text').fill('Synthetic content only');
  await page.locator('#save-note').click();await page.waitForURL('**/note.html?id=*');await page.waitForSelector('.note-actions');
  const result=await page.evaluate(async()=>{
   const C=await import('/script/crypto.js'),S=await import('/script/store.js');
   const id=crypto.randomUUID(),vault=await C.createVault(id,'Random!PIN-2026');
   try{const record=await S.saveNote({id,mode:'secure',rev:0,salt:vault.salt,wrap:vault.wrap},{title:'Secure portable',text:'Argon and AES still work',images:[],history:[]},vault.key);return (await S.decodeRecord(record,vault.key)).text;}
   finally{vault.key.fill(0);}
  });
  assert.equal(result,'Argon and AES still work');
  const uploadErrors=await page.evaluate(async()=>{const {errorKey}=await import('/script/cloud.js');return [errorKey({partial:true,failedItems:[{stage:'upload'}]}),errorKey({partial:true,failedItems:[{}],status:429}),errorKey({partial:true,failedItems:[{}],status:401}),errorKey({partial:true,failedItems:[{}],status:402})];});
  assert.deepEqual(uploadErrors,['cloudUpload','cloudRate','cloudAuth','cloudCredit'],'Upload errors are useful without masking authentication, rate or quota failures');
  assert.deepEqual(await page.evaluate(()=>window.__violations),[],host+' legitimate application has no CSP violations');
  const originalBase=await page.evaluate(()=>document.baseURI);
  await page.evaluate(async()=>{
   const inline=document.createElement('script');inline.textContent='window.__injected=true';document.head.append(inline);
   const remote=document.createElement('script');remote.src='https://untrusted.example.net/payload.js';document.head.append(remote);
   const button=document.createElement('button');button.setAttribute('onclick','window.__eventInjected=true');document.body.append(button);button.click();button.remove();
   const base=document.createElement('base');base.href='https://untrusted.example.net/';document.head.append(base);
   try{await fetch('https://untrusted.example.net/collect');}catch{}
   try{await fetch('https://other-bucket.s3.ap-northeast-2.amazonaws.com/probe');}catch{}
   try{await fetch('https://puter-seoul.s3.ap-northeast-2.amazonaws.com.attacker.example/probe');}catch{}
  });
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>!!window.__injected||!!window.__eventInjected),false);
  assert.equal(await page.evaluate(()=>document.baseURI),originalBase);
  const violations=await page.evaluate(()=>window.__violations);
  for(const directive of ['script-src-elem','script-src-attr','base-uri','connect-src'])assert(violations.includes(directive),directive+' blocked');
  assert.deepEqual(requests,[],'CSP blocks untrusted requests before network transmission');

  await context.route('https://attacker.example.test/**',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><title>Synthetic frame test</title><iframe src="https://${host}/"></iframe>`}));
  const attacker=await context.newPage(),errors=[];attacker.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await attacker.goto('https://attacker.example.test/');await attacker.waitForTimeout(500);
  assert(errors.some(message=>/frame-ancestors|X-Frame-Options/.test(message)),'Cross-origin embedding blocked by browser');
  assert.equal(await attacker.locator('iframe').contentFrame().locator('.site-header').count().catch(()=>0),0);
  await context.close();
 }
 console.log('Security headers: policy parity, canonical-host responses, real Argon/AES, blocked scripts/connections/base/frame — passed.');
}finally{await browser.close();}
