import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fixture} from './puter-fixture.mjs';
const {chromium}=createRequire(import.meta.url)('C:/Users/eaton/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true}),mock=fixture(),base='https://atlasnote.nxlabtw.com';
const context=await browser.newContext({locale:'en-US',viewport:{width:390,height:568},serviceWorkers:'block'});await mock.attach(context);const page=await context.newPage();
const artifacts=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-navigation-'));let checks=0;const errors=[],ok=(value,message)=>{assert.ok(value,message);checks++;};page.on('pageerror',error=>errors.push(error.message));
const reached=barrier=>Promise.race([barrier.entered,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Synthetic provider barrier not reached')),15000);timer.unref();})]);
async function nav(pathname){
 await page.evaluate(path=>{const a=document.createElement('a');a.href=path;a.textContent='Synthetic navigation';document.body.append(a);a.click();a.remove();},pathname);
 await page.waitForURL(base+pathname);await page.waitForFunction(()=>document.querySelector('#main')?.getAttribute('aria-busy')!=='true');
}
const storageCalls=()=>mock.calls.filter(c=>['read','write','list','delete','kvGet','kvSet'].includes(c.method)).length;
try{
 await page.goto(base+'/notes.html');await page.waitForSelector('#note-list');
 const ids=await page.evaluate(async()=>{
  const S=await import('/script/store.js'),C=await import('/script/crypto.js'),U=await import('/script/unlock-cache.js'),ids=[];
  for(const mode of ['none','basic','secure','basic']){
   const id=S.uuid(),vault=mode==='secure'?await C.createVault(id,'Synthetic!PIN15'):null;
   const note=await S.saveNote({id,mode,rev:0,...(vault?{salt:vault.salt,wrap:vault.wrap}:{})},{title:'Synthetic route '+mode+' '+ids.length,text:'Route fixture '+ids.length,images:[],history:[]},vault?.key);
   if(vault){await U.remember(note,vault.key);vault.key.fill(0);}ids.push(note.id);
  }
  window.__syntheticDocument=crypto.randomUUID();return ids;
 });
 // First warm render must not download account configuration or notebook files again.
 await nav('/notes.html');await page.waitForSelector('.note-card');const marker=await page.evaluate(()=>window.__syntheticDocument),before=storageCalls();mock.setLatency(900);
 for(const id of ids){
  await nav('/note.html?id='+id);await page.waitForSelector('#note-content .prose');
  await page.locator('.note-actions a[href^="/edit"]').click();await page.waitForSelector('#editor-form');
  await page.locator('[data-discard]').click();await page.waitForSelector('#note-content .prose');
  ok(!await page.locator('#vault-input').count(),'Tab unlock cache survives note/edit navigation');
 }
 ok(storageCalls()===before,'Warm note/edit switches perform no cloud file or preference requests');
 ok(await page.evaluate(()=>window.__syntheticDocument)===marker,'All warm switches share the same document and memory workspace');
 ok(await page.evaluate(()=>performance.getEntriesByType('navigation').length)===1,'Internal navigation does not reload the document');mock.setLatency(0);
 await page.locator('[data-menu]').click();await page.locator('.nav-links a[href="/settings.html"]').click();await page.waitForSelector('.account-settings');ok(!await page.locator('#navbar').evaluate(el=>el.classList.contains('open')),'Mobile menu closes on a real navigation link');ok(await page.locator('.nav-links a[href="/settings.html"]').getAttribute('aria-current')==='page','Active navigation state follows the URL');
 // Independent usage requests cannot hold the dashboard or a later route hostage.
 const heldSpace=mock.pauseNext('space','');await nav('/dashboard.html');await reached(heldSpace);
 ok(await page.locator('.dashboard-recent').isVisible(),'Dashboard notes render while usage is still waiting');
 ok(await page.locator('.resource-loading[aria-busy=true]').count()===2,'Usage cards honestly show a loading state');
 await page.screenshot({path:path.join(artifacts,'dashboard-loading-mobile.png'),fullPage:true});
 await nav('/settings.html');await page.waitForSelector('.account-settings');heldSpace.release();await page.waitForTimeout(100);
 ok(!await page.locator('.dashboard-metrics,.resource-stack').count(),'A late usage response cannot overwrite Settings');
 const usageBefore=mock.calls.filter(c=>c.method==='space'||c.method==='monthly').length;await nav('/dashboard.html');await page.waitForSelector('.dashboard-metrics .meter');
 ok(mock.calls.filter(c=>c.method==='space'||c.method==='monthly').length===usageBefore,'Recent usage is shared instead of refetched on every visit');
 await nav('/notes.html');await page.waitForSelector('.note-card');await page.evaluate(()=>scrollTo({top:180,behavior:'instant'}));const oldY=await page.evaluate(()=>scrollY);
 await nav('/note.html?id='+ids[0]);await page.waitForSelector('#note-content .prose');await page.goBack();await page.waitForSelector('#note-list');await page.waitForFunction(y=>Math.abs(scrollY-y)<2,oldY);ok(true,'Back restores list scroll position');
 await page.goForward();await page.waitForSelector('#note-content .prose');ok(page.url().includes(ids[0]),'Forward restores the note route');
 await page.locator('.note-actions a[href^="/edit"]').click();await page.waitForSelector('#note-text');await page.locator('#note-text').fill('Do not lose my synthetic draft.');
 const editURL=page.url();await page.evaluate(()=>document.querySelector('.skip').click());await page.waitForURL(editURL+'#main');ok(await page.locator('#note-text').inputValue()==='Do not lose my synthetic draft.','Skip link keeps the same editor and draft');ok(!await page.locator('dialog').count(),'An in-page anchor does not ask to discard a draft');await page.goBack();await page.waitForURL(editURL);ok(!await page.locator('dialog').count(),'Back across an anchor preserves editing without a discard prompt');
 await page.evaluate(()=>document.querySelector('.brand').click());await page.waitForSelector('dialog [data-cancel]');await page.locator('dialog [data-cancel]').click();ok(page.url()===editURL,'Cancelled link navigation keeps the editor URL');ok(await page.locator('#note-text').inputValue()==='Do not lose my synthetic draft.','Cancelled navigation keeps the exact draft');
 await page.goBack();await page.waitForSelector('dialog [data-cancel]');await page.locator('dialog [data-cancel]').click();await page.waitForURL(editURL);ok(await page.locator('#note-text').inputValue()==='Do not lose my synthetic draft.','Cancelled browser Back restores the URL and retains the draft');
 await page.evaluate(()=>history.back());await page.waitForSelector('dialog [data-cancel]');await page.evaluate(()=>history.back());await page.waitForTimeout(80);await page.locator('dialog [data-cancel]').click();await page.waitForURL(editURL);ok(await page.locator('#note-text').inputValue()==='Do not lose my synthetic draft.','Repeated Back during the warning still restores the editor correctly');
 await page.goBack();await page.waitForSelector('dialog [data-confirm]');await page.locator('dialog [data-confirm]').click();await page.waitForSelector('#note-content .prose');ok((await page.locator('#note-content').innerText()).includes('Route fixture 0'),'Accepted discard returns to saved content');
 // Rapid link requests finish at the final route without old async screens painting over it.
 await page.evaluate(()=>{for(const href of ['/dashboard.html','/settings.html','/notes.html']){const a=document.createElement('a');a.href=href;document.body.append(a);a.click();a.remove();}});await page.waitForURL(base+'/notes.html');await page.waitForSelector('#note-list');await page.waitForTimeout(100);ok(!await page.locator('.account-settings,.dashboard-metrics').count(),'Rapid navigation leaves only the final requested view');
 // Remote changes update a reading view, but never replace an editor buffer.
 const writerContext=await browser.newContext({locale:'en-US',serviceWorkers:'block'});await mock.attach(writerContext);const writer=await writerContext.newPage();await writer.goto(base+'/notes.html');await writer.waitForSelector('#note-list');
 await nav('/edit.html?id='+ids[1]);await page.waitForSelector('#note-text');await page.locator('#note-text').fill('My unsaved local editing buffer');
 await writer.evaluate(async id=>{const S=await import('/script/store.js'),n=await S.get(id),payload=await S.decodeRecord(n);await S.saveNote(n,{...payload,title:'Changed on another device',text:'Remote durable text'},null,payload);},ids[1]);
 await page.evaluate(async()=>{await(await import('/script/cloud.js')).sync();});await page.waitForSelector('[data-remote-change]');ok(await page.locator('#note-text').inputValue()==='My unsaved local editing buffer','Background sync does not overwrite an unsaved editor');
 await page.locator('#save-note').click();await page.waitForSelector('.dialog-body');ok(await page.locator('#note-text').inputValue()==='My unsaved local editing buffer','A stale revision cannot silently overwrite remote work');await page.locator('dialog [data-confirm]').click();
 await page.locator('[data-discard]').click();await page.locator('dialog [data-confirm]').click();await page.waitForSelector('#note-content .prose');ok((await page.locator('#note-content').innerText()).includes('Remote durable text'),'Discard reveals the latest confirmed cloud content');
 await writerContext.close();
 // Saving waits for its own durable journal but does not wait for an unrelated full scan.
 await nav('/edit.html?id='+ids[0]);await page.waitForSelector('#note-text');await page.locator('#note-text').fill('Durable warm-navigation save');const scanBefore=mock.calls.filter(c=>c.method==='list').length;
 const heldWrite=mock.pauseNext('write','/blobs/');await page.locator('#save-note').click();await reached(heldWrite);ok(page.url().includes('/edit.html'),'An unconfirmed upload does not navigate or claim success');heldWrite.release();await page.waitForSelector('#note-content .prose');
 ok(mock.calls.filter(c=>c.method==='list').length===scanBefore,'A confirmed save does not rescan every note');ok(await page.evaluate(()=>window.__syntheticDocument)===marker,'Saving also preserves the same workspace document');
 await page.reload();await page.waitForSelector('#note-content .prose');ok((await page.locator('#note-content').innerText()).includes('Durable warm-navigation save'),'The acknowledged save survives a cold reload');
 await nav('/edit.html?id='+ids[0]);await page.waitForSelector('#note-text');await page.locator('#note-text').fill('Retried editor text');mock.setFailWrites(true);await page.locator('#save-note').click();await page.waitForSelector('dialog [data-confirm]');await page.locator('dialog [data-confirm]').click();mock.setFailWrites(false);await page.locator('#save-note').click();await page.waitForSelector('#note-content .prose');
 ok(await page.evaluate(async id=>{const S=await import('/script/store.js'),payload=await S.decodeRecord(await S.get(id));return payload.history.length>=2&&S.apply(payload.text,payload.history[0].text)==='Durable warm-navigation save';},ids[0]),'Editor upload retry preserves the previous text history');
 // The same-page upload/pull mutex must also work without navigator.locks.
 await page.evaluate(()=>{window.__locksDescriptor=Object.getOwnPropertyDescriptor(navigator,'locks');Object.defineProperty(navigator,'locks',{configurable:true,value:undefined});});
 const heldScan=mock.pauseNext('list','/atlasnote-v1/notes'),scan=page.evaluate(async()=>{await(await import('/script/cloud.js')).sync();});await reached(heldScan);
 const writesBefore=mock.calls.filter(c=>c.method==='write').length;
 const concurrent=page.evaluate(async()=>{const S=await import('/script/store.js');const note=await S.saveNote({id:S.uuid(),mode:'none',rev:0},{title:'Mutex fallback fixture',text:'Synthetic serialized save',images:[],history:[]},null);return !S.hasPending(note.id);});
 await page.waitForTimeout(100);ok(mock.calls.filter(c=>c.method==='write').length===writesBefore,'Without Web Locks, uploads do not race an active pull');heldScan.release();await scan;ok(await concurrent,'The queued fallback save reaches a durable journal');
 await page.evaluate(()=>{if(window.__locksDescriptor)Object.defineProperty(navigator,'locks',window.__locksDescriptor);else delete navigator.locks;delete window.__locksDescriptor;});
 await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
 ok(await page.evaluate(async()=>{const C=await import('/script/crypto.js'),S=await import('/script/store.js');return !document.querySelector('#note-content')&&!C.hasRoot()&&!(await S.rawAll('notes')).length;}),'A frozen full document does not keep a private screen or account records');
 await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await page.waitForSelector('#note-content .prose');ok((await page.locator('#note-content').innerText()).includes('Retried editor text'),'A restored full document reauthenticates and reloads confirmed data');
 // A rejected request hides private content; stale responses cannot repaint it.
 mock.setFailAuth(true);await page.evaluate(async()=>{try{await(await import('/script/cloud.js')).authorize(true);}catch{}});await page.waitForSelector('[data-cloud-login]');ok(!await page.locator('#note-content,#note-title,.note-card').count(),'Revocation removes private UI');mock.setFailAuth(false);await page.locator('[data-cloud-login]').click();await page.waitForSelector('#note-content .prose');
 await page.locator('[data-nav-signout]').click();await page.locator('dialog [data-confirm]').click();await page.waitForURL(base+'/');await page.waitForSelector('.hero');ok(await page.evaluate(async()=>{const S=await import('/script/store.js'),C=await import('/script/crypto.js');return !(await S.rawAll('notes')).length&&!C.hasRoot()&&!Object.keys(sessionStorage).some(k=>k.startsWith('atlasnote.unlock'));}),'Sign out clears notes, account keys and unlock cache without a reload');
 await page.goBack();await page.waitForSelector('[data-cloud-login]');ok(!await page.locator('#note-content,.note-card').count(),'Browser Back after logout cannot reopen private content');
 ok(!errors.length,'No browser runtime errors: '+errors.join(', '));console.log(JSON.stringify({checks,artifacts},null,2));
}catch(error){await page.screenshot({path:path.join(artifacts,'failure.png'),fullPage:true});console.error('Artifacts:',artifacts);throw error;}finally{await browser.close();}
