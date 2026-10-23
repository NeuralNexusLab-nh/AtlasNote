import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {fixture} from './puter-fixture.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/eaton/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
let checks=0;const ok=(value,label)=>{assert.ok(value,label);checks++;};
try{
 const mock=fixture(),context=await browser.newContext({locale:'en-US',serviceWorkers:'block'});await mock.attach(context);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4321/settings.html');await page.waitForSelector('.account-settings');
 const absent=()=>page.evaluate(async()=>!(await indexedDB.databases()).some(d=>d.name==='atlasnote-v1')&&!localStorage.getItem('atlasnote.device-root.v1'));
 ok(await absent(),'Fresh installation never creates retired storage');
 const cloud=await page.evaluate(async()=>{
  const S=await import('/script/store.js'),Cloud=await import('/script/cloud.js');
  const n=await S.saveNote({id:S.uuid(),mode:'basic',rev:0},{title:'Cloud survivor',text:'Must survive cleanup',images:[],history:[]},null);await Cloud.sync();
  localStorage.setItem('unrelated-app-key','preserve');sessionStorage.setItem('unrelated-session-key','preserve');
  return {id:n.id,checks:Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('atlasnote.cloud-key-check.')))};
 });
 const createLegacy=()=>page.evaluate(async()=>{
  localStorage.setItem('atlasnote.device-root.v1','Synthetic retired secret');
  const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('atlasnote-v1',1);q.onupgradeneeded=()=>q.result.createObjectStore('notes',{keyPath:'id'});q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
  await new Promise((resolve,reject)=>{const tx=db.transaction('notes','readwrite');tx.objectStore('notes').put({id:'retired-synthetic',body:{title:'Old synthetic note',text:'Delete without confirmation',images:['old-image'],history:['old-version']},trashedAt:'2026-01-01'});tx.oncomplete=resolve;tx.onerror=reject;});db.close();
 });
 mock.setFailWrites(true);
 const pending=await page.evaluate(async()=>{const S=await import('/script/store.js');return (await S.saveNote({id:S.uuid(),mode:'basic',rev:0},{title:'Pending survivor',text:'Still waiting for upload',images:[],history:[]},null)).id;});
 await createLegacy();const before=JSON.stringify([...mock.files.values()]);await page.reload();await page.waitForSelector('.account-settings');
 await page.waitForFunction(async()=>!(await indexedDB.databases()).some(d=>d.name==='atlasnote-v1')&&!localStorage.getItem('atlasnote.device-root.v1'));
 ok(!await page.locator('dialog,[data-migrate],[data-legacy-clear]').count(),'Nonempty legacy storage is deleted without confirmation or migration');
 ok(JSON.stringify([...mock.files.values()])===before,'No Puter files are deleted, changed or migrated');
 const preserved=await page.evaluate(async({cloud,pending})=>{const S=await import('/script/store.js');return {cloud:(await S.decodeRecord(await S.get(cloud.id))).text,pending:(await S.decodeRecord(await S.get(pending))).text,outbox:(await S.rawAll('outbox')).some(c=>c.noteId===pending),checks:Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('atlasnote.cloud-key-check.'))),other:localStorage.getItem('unrelated-app-key'),session:sessionStorage.getItem('unrelated-session-key'),signedIn:window.puter.auth.isSignedIn()};},{cloud,pending});
 ok(preserved.cloud==='Must survive cleanup'&&preserved.pending==='Still waiting for upload'&&preserved.outbox,'Current cloud notes and unsynced changes survive');
 ok(JSON.stringify(preserved.checks)===JSON.stringify(cloud.checks)&&preserved.other==='preserve'&&preserved.session==='preserve'&&preserved.signedIn,'Cloud key checks, authorization and unrelated data survive');
 mock.setFailWrites(false);await page.evaluate(async()=>{await (await import('/script/cloud.js')).sync();});
 // A locked old tab delays DB deletion, but cannot keep the persisted old secret.
 await createLegacy();
 const blocked=await page.evaluate(async()=>{
  const db=await new Promise(r=>{const q=indexedDB.open('atlasnote-v1');q.onsuccess=()=>r(q.result);});
  const L=await import('/script/legacy-storage.js');let deletion,reported=false;
  await new Promise(resolve=>{deletion=L.clearLegacy({onBlocked:()=>{reported=true;resolve();}});});
  const keyGone=!localStorage.getItem('atlasnote.device-root.v1');
  const S=await import('/script/store.js');const saved=await S.saveNote({id:S.uuid(),mode:'basic',rev:0},{title:'Save during cleanup',text:'Not blocked by retired tabs',images:[],history:[]},null);
  localStorage.setItem('atlasnote.device-root.v1','Rewritten by an old tab');db.close();await deletion;
  return {reported,keyGone,saved:!!saved.id};
 });
 ok(blocked.reported&&blocked.keyGone&&blocked.saved&&await absent(),'Blocked deletion removes old key, allows cloud saves and finishes after old tab closes');
 await page.evaluate(async()=>{Object.defineProperty(indexedDB,'databases',{value:undefined,configurable:true});await (await import('/script/legacy-storage.js')).clearLegacy();delete indexedDB.databases;});
 ok(await absent(),'No database enumeration API is required');
 for(const language of ['en','zh-Hant','ja','leet'])for(const theme of ['dark','light']){
  await createLegacy();await page.evaluate(({language,theme})=>localStorage.setItem('atlasnote.preferences',JSON.stringify({language,theme})),{language,theme});await page.reload();await page.waitForSelector('.account-settings');
  await page.waitForFunction(async()=>!(await indexedDB.databases()).some(d=>d.name==='atlasnote-v1')&&!localStorage.getItem('atlasnote.device-root.v1'));
  ok(await page.evaluate(({language,theme})=>{const p=JSON.parse(localStorage.getItem('atlasnote.preferences'));return p.language===language&&p.theme===theme;},{language,theme}),`${language} ${theme}: preferences preserved`);
  for(const [width,height]of [[1440,900],[768,1024],[390,844],[320,568]]){
   await page.setViewportSize({width,height});ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${language} ${theme} ${width}: settings fit`);
  }
 }
 // Cleanup also runs on the public homepage, without a Puter sign-in.
 const signedOut=await browser.newContext({serviceWorkers:'block'});await mock.attach(signedOut,{signedIn:false});const anonymous=await signedOut.newPage();await anonymous.goto('http://127.0.0.1:4321/');
 await anonymous.evaluate(async()=>{localStorage.setItem('atlasnote.device-root.v1','anonymous-retired-key');const d=await new Promise(r=>{const q=indexedDB.open('atlasnote-v1',1);q.onupgradeneeded=()=>q.result.createObjectStore('notes',{keyPath:'id'});q.onsuccess=()=>r(q.result);});await new Promise(r=>{const tx=d.transaction('notes','readwrite');tx.objectStore('notes').put({id:'anonymous-old',text:'old data'});tx.oncomplete=r;});d.close();});
 await anonymous.reload();await anonymous.waitForFunction(async()=>!(await indexedDB.databases()).some(d=>d.name==='atlasnote-v1')&&!localStorage.getItem('atlasnote.device-root.v1'));
 ok(!await anonymous.locator('dialog').count(),'Signed-out users get cleanup without a prompt');
 ok(await anonymous.evaluate(async()=>{const C=await import('/script/crypto.js');try{C.deviceRoot(true);return false;}catch{return !localStorage.getItem('atlasnote.device-root.v1');}}),'Retired root cannot be regenerated');
 ok(await anonymous.evaluate(async()=>{const S=await import('/script/store.js');try{await S.saveNote({id:S.uuid(),mode:'none',rev:0},{title:'No offline fallback',text:'Must not save here',images:[],history:[]},null);return false;}catch{return !(await indexedDB.databases()).some(d=>d.name==='atlasnote-v1');}}),'Signed-out writes cannot recreate a device-only database');
 ok(!errors.length,'No unhandled browser errors: '+errors.join(', '));
 console.log('PASS '+checks+' automatic cleanup, isolation, blocked-tab and responsive checks.');
}finally{await browser.close();}
