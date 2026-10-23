import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {fixture} from './puter-fixture.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/eaton/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});let checks=0;const ok=(value,label)=>{assert.ok(value,label);checks++;};
try{
 const mock=fixture(),context=await browser.newContext({locale:'en-US',serviceWorkers:'block'});await mock.attach(context);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://atlasnote.nxlabtw.com/settings.html');await page.waitForSelector('.account-settings');
 const legacy=await page.evaluate(async()=>{
  localStorage.setItem('atlasnote.device-root.v1','retired-key');localStorage.setItem('atlasnote.preferences','{"theme":"light"}');localStorage.setItem('unrelated-site-key','keep');sessionStorage.setItem('unrelated-session-key','keep');
  const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('atlasnote-v1',1);q.onupgradeneeded=()=>q.result.createObjectStore('notes',{keyPath:'id'});q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});db.close();
  return {dbs:(await indexedDB.databases()).map(x=>x.name),keys:Object.keys(localStorage)};
 });
 const ownKey='11111111-1111-4111-8111-111111111111:',mainPath='/codex-test/AppData/test-atlasnote/atlasnote-v1/keep.json';
 mock.files.set(ownKey+mainPath,{owner:'11111111-1111-4111-8111-111111111111',path:mainPath,text:'main Puter data'});
 await page.reload();await page.waitForSelector('.account-settings');
 const cleanup=await page.evaluate(async()=>({dbs:(await indexedDB.databases()).map(x=>x.name),oldKey:localStorage.getItem('atlasnote.device-root.v1'),oldPrefs:localStorage.getItem('atlasnote.preferences'),other:localStorage.getItem('unrelated-site-key'),session:sessionStorage.getItem('unrelated-session-key')}));
 ok(!cleanup.dbs.some(name=>/^atlasnote-(?:cloud-|locked|v1)/.test(name))&&!cleanup.oldKey&&!cleanup.oldPrefs,'Legacy AtlasNote browser data is removed on startup');
 ok(cleanup.other==='keep'&&cleanup.session==='keep','Unrelated browser data and session data are untouched');
 ok(mock.files.has(ownKey+mainPath),'The main AtlasNote Puter namespace remains intact');
 ok(!await page.locator('dialog,[data-migrate],[data-legacy-clear]').count(),'Cleanup is automatic and never uploads or prompts to migrate legacy data');
 const saved=await page.evaluate(async()=>{
  const S=await import('/script/store.js'),Cloud=await import('/script/cloud.js');
  await Cloud.savePreferences({theme:'light',language:'zh-Hant',history:5,trashDays:14});
  const note=await S.saveNote({id:S.uuid(),mode:'basic',rev:0},{title:'Cloud-only note',text:'Persisted by Puter',images:[],history:[]},null);
  return {id:note.id,dbs:(await indexedDB.databases()).map(x=>x.name),local:Object.keys(localStorage).filter(key=>/^atlasnote[.-]/.test(key))};
 });
 ok(!saved.dbs.some(name=>/^atlasnote-(?:cloud-|locked|v1)/.test(name))&&!saved.local.length,'Notes and app preferences are not persisted in browser storage');
 await page.reload();await page.waitForSelector('.account-settings');
 const remote=await page.evaluate(async id=>{const S=await import('/script/store.js'),Cloud=await import('/script/cloud.js');const n=await S.get(id);return {text:(await S.decodeRecord(n)).text,prefs:await Cloud.preferences()};},saved.id);
 ok(remote.text==='Persisted by Puter','A confirmed cloud note survives a reload');ok(remote.prefs.theme==='light'&&remote.prefs.language==='zh-Hant'&&remote.prefs.history===5&&remote.prefs.trashDays===14,'Preferences are restored from Puter, not localStorage');
 await page.evaluate(async()=>{Object.defineProperty(indexedDB,'databases',{value:undefined,configurable:true});localStorage.setItem('atlasnote.cloud-key-check.12345678-1234-4234-8234-123456789abc','old');await (await import('/script/legacy-storage.js')).clearLegacy();delete indexedDB.databases;});
 ok(await page.evaluate(()=>!localStorage.getItem('atlasnote.cloud-key-check.12345678-1234-4234-8234-123456789abc')),'Cleanup fallback removes known old cache keys when database enumeration is unavailable');
 // A blocked old IndexedDB connection holds cleanup until it is released; it never creates a new local store.
 const blocked=await page.evaluate(async()=>{
  const db=await new Promise(resolve=>{const q=indexedDB.open('atlasnote-v1',1);q.onupgradeneeded=()=>q.result.createObjectStore('notes',{keyPath:'id'});q.onsuccess=()=>resolve(q.result);});
  let reported=false,finished=false;const pending=(async()=>{await (await import('/script/legacy-storage.js')).clearLegacy({onBlocked:()=>{reported=true;}});finished=true;})();
  await new Promise(resolve=>setTimeout(resolve,50));const beforeClose={reported,finished};db.close();await pending;return {...beforeClose,finished};
 });
 ok(blocked.reported&&blocked.finished,'Cleanup detects a blocked old database deletion and completes after the connection is released');
 // The same cleanup runs for signed-out visits and never reconstructs an offline note store.
 const signedOut=await browser.newContext({serviceWorkers:'block'});await mock.attach(signedOut,{signedIn:false});const anonymous=await signedOut.newPage();await anonymous.goto('https://atlasnote.nxlabtw.com/');
 await anonymous.evaluate(async()=>{localStorage.setItem('atlasnote.device-root.v1','retired');const q=indexedDB.open('atlasnote-v1',1);await new Promise((resolve,reject)=>{q.onupgradeneeded=()=>q.result.createObjectStore('notes',{keyPath:'id'});q.onsuccess=()=>{q.result.close();resolve();};q.onerror=()=>reject(q.error);});});
 await anonymous.reload();await anonymous.waitForFunction(async()=>!(await indexedDB.databases()).some(d=>d.name==='atlasnote-v1')&&!localStorage.getItem('atlasnote.device-root.v1'));
 ok(!await anonymous.locator('dialog').count(),'Signed-out visitors get cleanup without a prompt');
 ok(await anonymous.evaluate(async()=>{const S=await import('/script/store.js');try{await S.saveNote({id:S.uuid(),mode:'none',rev:0},{title:'No offline fallback',text:'Must not save here',images:[],history:[]},null);return false;}catch{return !(await indexedDB.databases()).some(d=>d.name==='atlasnote-v1');}}),'Signed-out writes cannot recreate a local note database');
 ok(!errors.length,'No unhandled browser errors: '+errors.join(','));console.log('PASS '+checks+' cloud-only storage, legacy cleanup, origin isolation and responsive checks.');
}finally{await browser.close();}
