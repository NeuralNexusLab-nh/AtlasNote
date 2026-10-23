// Real official SDK + browser CSP. Only transport responses are synthetic;
// every API/storage URL is intercepted, and no real account is used.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('C:/Users/eaton/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base='https://atlasnote.nxlabtw.com',storage='https://puter-seoul.s3.ap-northeast-2.amazonaws.com';
const policy=JSON.parse(await fs.readFile(new URL('../edgeone.json',import.meta.url),'utf8')).headers.find(rule=>rule.source==='/*').headers;
const csp=policy.find(header=>header.key==='Content-Security-Policy').value;
const sdkResponse=await fetch('https://js.puter.com/v2/');assert(sdkResponse.ok,'Official SDK is available');const sdk=await sdkResponse.text();
const browser=await chromium.launch({channel:'msedge',headless:true});let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
async function trial({denyStorage=false,failStorage=false}={}){
 const context=await browser.newContext({serviceWorkers:'block'}),registrations=new Map(),uploaded=new Map(),completed=new Map(),calls=[],escaped=[];
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url()),method=request.method();
  const cors={'Access-Control-Allow-Origin':base,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS','Access-Control-Allow-Headers':request.headers()['access-control-request-headers']||'content-type,authorization','Access-Control-Expose-Headers':'ETag'};
  if(url.origin===base)return route.fulfill({status:200,contentType:'text/html',headers:{'Content-Security-Policy':denyStorage?csp.replace(' '+storage,''):csp},body:'<!doctype html><title>Synthetic signed transfer test</title><script src="https://js.puter.com/v2/"></script>'});
  if(url.origin==='https://js.puter.com')return route.fulfill({status:200,contentType:'text/javascript',body:sdk});
  if(url.origin==='https://api.puter.com'){
   calls.push({path:url.pathname,method});
   if(method==='OPTIONS')return route.fulfill({status:204,headers:cors});
   let data;try{data=request.postDataJSON();}catch{}
   const json=value=>route.fulfill({status:200,contentType:'application/json',headers:cors,body:JSON.stringify(value)});
   if(url.pathname==='/fs/startBatchWrite'){
    assert(Array.isArray(data),'The real SDK sends an array for batch start');
    return json(data.map(item=>{const sessionId='synthetic-'+(registrations.size+1);registrations.set(sessionId,item.fileMetadata);return {sessionId,url:storage+'/'+sessionId+'?X-Amz-Signature=synthetic-not-a-credential',contentType:item.fileMetadata.contentType};}));
   }
   if(url.pathname==='/fs/completeBatchWrite')return json(data.map(item=>{assert(uploaded.has(item.uploadId),'Finalize only after the signed PUT succeeds');const metadata=registrations.get(item.uploadId);completed.set(item.uploadId,metadata);return {fsEntry:{uid:item.uploadId,path:metadata.path,name:metadata.path.split('/').pop(),is_dir:false,size:metadata.size}};}));
   if(url.pathname.includes('abort'))return json({success:true});
   if(url.pathname==='/read')return route.fulfill({status:200,contentType:'application/octet-stream',headers:cors,body:[...uploaded.values()][0]||''});
   return route.fulfill({status:404,contentType:'application/json',headers:cors,body:JSON.stringify({code:'not_found',message:'Synthetic endpoint is not implemented'})});
  }
  if(url.origin===storage){
   calls.push({path:'signed-storage',method});
   if(method==='OPTIONS')return route.fulfill({status:204,headers:cors});
   if(failStorage)return route.fulfill({status:503,headers:cors,body:'Synthetic storage failure'});
   uploaded.set(url.pathname.slice(1),request.postDataBuffer().toString('utf8'));
   return route.fulfill({status:200,headers:{...cors,ETag:'"synthetic-etag"'},body:''});
  }
  escaped.push(url.origin);return route.abort();
 });
 const page=await context.newPage();await page.goto(base+'/__signed-transfer-test__');await page.waitForFunction(()=>window.puter?.fs);
 const result=await page.evaluate(async()=>{
  window.__blocked=[];document.addEventListener('securitypolicyviolation',e=>window.__blocked.push({directive:e.effectiveDirective,origin:(()=>{try{return new URL(e.blockedURI).origin;}catch{return e.blockedURI;}})()}));
  puter.authToken='codex-synthetic-not-a-real-token';puter.appID='app-codex-synthetic';
  const text=JSON.stringify({title:'Synthetic transport test',text:'No personal notes. 繁體中文・日本語\n'+'.'.repeat(65536)});
  try{const record=await puter.fs.write('atlasnote-test/transport.json',text,{overwrite:false,createMissingParents:true});const read=await puter.fs.read('atlasnote-test/transport.json');if(typeof read?.text!=='function')return {ok:false,readType:typeof read,constructor:read?.constructor?.name,keys:read&&Object.keys(read).slice(0,10),blocked:window.__blocked};return {ok:true,name:record.name,roundTrip:await read.text()===text,blocked:window.__blocked};}
  catch(e){return {ok:false,message:e.message,partial:e.partial,blocked:window.__blocked};}
 });
 await context.close();return {result,calls,uploaded,completed,escaped};
}
try{
 const allowed=await trial();
 ok(allowed.result.ok,'Real Puter SDK signed upload succeeds under the production CSP: '+JSON.stringify({result:allowed.result,calls:allowed.calls}));
 ok(allowed.result.roundTrip,'UTF-8 and larger text survive the real SDK upload/read transport');
 ok(allowed.uploaded.size===1&&allowed.completed.size===1,'Signed PUT is followed by exactly one finalization');
 ok(allowed.calls.some(c=>c.path==='signed-storage'&&c.method==='PUT'),'Browser actually sends the S3 PUT instead of bypassing CSP in a mock');
 ok(!allowed.result.blocked.length&&!allowed.escaped.length,'Valid transport has no CSP violation or unmocked network request');
 const blocked=await trial({denyStorage:true});
 ok(!blocked.result.ok&&blocked.result.partial,'The old policy reproduces the real SDK partial upload error');
 ok(blocked.result.blocked.some(e=>e.directive==='connect-src'&&e.origin===storage),'Old-policy failure is specifically the signed-storage CSP block');
 ok(!blocked.uploaded.size&&!blocked.completed.size,'A blocked PUT is never claimed as finalized');
 const failed=await trial({failStorage:true});
 ok(!failed.result.ok&&!failed.completed.size,'A real storage failure is not disguised as a successful save');
 ok(!failed.escaped.length&&!blocked.escaped.length,'All SDK requests remain isolated from real accounts');
 console.log('PASS '+checks+' real-SDK signed-storage CSP transport checks.');
}finally{await browser.close();}
