import {createRequire} from 'node:module';import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {fixture} from './puter-fixture.mjs';
const {chromium}=createRequire(import.meta.url)('C:/Users/eaton/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true}),mock=fixture(),base='https://atlasnote.nxlabtw.com';
const context=await browser.newContext({locale:'en-US',permissions:['clipboard-read','clipboard-write'],serviceWorkers:'block'});await mock.attach(context);
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));let checks=0;
// Production denies clipboard-read. Verify writes through a separate isolated
// test origin instead of weakening that policy or reading the user's profile.
await context.route('https://clipboard-check.invalid/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Synthetic clipboard check</title>'}));
const reader=await context.newPage();await reader.goto('https://clipboard-check.invalid/');
const readClipboard=async()=>{await reader.bringToFront();try{return (await reader.evaluate(()=>navigator.clipboard.readText())).replace(/\r\n/g,'\n');}finally{await page.bringToFront();}};
const ok=(value,message)=>{assert.ok(value,message);checks++;},artifacts=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-note-actions-'));
const body='Copy the content only.\n\n**Markdown stays text.**\n繁體中文・日本語',pin='Synthetic!234';
try{
 await page.goto(base+'/dashboard.html');await page.waitForSelector('.dashboard-metrics');
 const ids=await page.evaluate(async({body,pin})=>{const S=await import('/script/store.js'),C=await import('/script/crypto.js'),ids={};for(const mode of ['none','basic','secure']){const note={id:S.uuid(),mode,rev:0};let key=null;if(mode==='secure'){const vault=await C.createVault(note.id,pin);Object.assign(note,{salt:vault.salt,wrap:vault.wrap});key=vault.key;}const saved=await S.saveNote(note,{title:'Synthetic title must not be copied',text:body,images:[],history:[]},key);key?.fill(0);ids[mode]=saved.id;}return ids;},{body,pin});
 const filesystemCalls=()=>mock.calls.filter(c=>['read','write','list','delete'].includes(c.method)).length;
 for(const mode of ['none','basic']){
  await page.goto(base+'/note.html?id='+ids[mode]);await page.waitForSelector('#note-content p');const before=filesystemCalls();await page.locator('[data-copy]').click();
  await page.waitForFunction(()=>document.querySelector('[data-copy]')?.textContent.includes('Copied')||document.querySelector('dialog'));
  ok(!await page.locator('dialog').count(),mode+': a successful clipboard write must not open a cloud error dialog');
  ok(await readClipboard()===body,mode+': copies full body only, preserving line breaks');
  ok(filesystemCalls()===before,mode+': copying does not access or write Puter files');
 }
 await page.goto(base+'/note.html?id='+ids.secure);await page.waitForSelector('[data-unlock]');
 ok(!await page.locator('[data-lock]').isVisible(),'Lock action is hidden while already locked');
 await page.locator('[data-unlock]').click();await page.locator('#vault-input').fill(pin);await page.locator('dialog [data-confirm]').click();await page.waitForSelector('[data-lock]',{state:'visible'});
 ok(await page.locator('[data-lock]').isVisible(),'Lock action returns after a successful PIN unlock');
 await page.locator('[data-copy]').click();await page.waitForFunction(()=>document.querySelector('[data-copy]')?.textContent.includes('Copied'));
 ok(await readClipboard()===body&&!await page.locator('dialog').count(),'Unlocked AtlasEncrypt copies without an unrelated error');
 await page.locator('[data-lock]').click();await page.waitForSelector('[data-unlock]');
 ok(!await page.locator('[data-lock]').isVisible(),'Explicit locking hides the lock action again');
 await page.locator('[data-copy]').click();await page.locator('#vault-input').fill(pin);await page.locator('dialog [data-confirm]').click();await page.waitForFunction(()=>document.querySelector('[data-copy]')?.textContent.includes('Copied'));
 ok(await readClipboard()===body&&await page.locator('[data-lock]').isVisible(),'Copying a locked note requires PIN and updates the unlocked actions');
 // Simulate an older/denied Clipboard API, but inspect the real fallback selection.
 await page.evaluate(()=>{window.__clipboardWrite=navigator.clipboard.writeText.bind(navigator.clipboard);window.__exec=document.execCommand.bind(document);navigator.clipboard.writeText=async()=>{throw new DOMException('Synthetic denial','NotAllowedError');};document.execCommand=command=>{if(command==='copy'){window.__fallbackCopy=document.activeElement?.value;return true;}return window.__exec(command);};});
 await page.locator('[data-copy]').click();await page.waitForFunction(()=>window.__fallbackCopy!==undefined);
 ok(await page.evaluate(()=>window.__fallbackCopy)===body,'Legacy fallback selects the complete text');
 ok(!await page.locator('dialog').count(),'Successful fallback does not show an error dialog');
 for(const language of ['en','zh-Hant','ja','leet']){
  mock.setPreferences({language,theme:'dark',history:3,trashDays:7});await page.goto(base+'/note.html?id='+ids.basic);await page.waitForSelector('[data-copy]');
  await page.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw new DOMException('Synthetic denial','NotAllowedError');};document.execCommand=()=>false;});await page.locator('[data-copy]').click();await page.waitForSelector('dialog');
  const text=await page.locator('dialog').innerText();ok(!/Puter|cryptoError|copyFailed/.test(text),'Clipboard failure has its own translated message: '+language);await page.locator('dialog [data-confirm]').click();
 }
 for(const theme of ['dark','light'])for(const width of [1440,1024,768,430,390,360,320,844]){
  mock.setPreferences({language:'zh-Hant',theme,history:3,trashDays:7});await page.setViewportSize({width,height:width===844?390:844});await page.goto(base+'/note.html?id='+ids.secure);await page.waitForSelector('#note-content p');await page.locator('[data-lock]').click();await page.waitForSelector('[data-unlock]');
  ok(!await page.locator('[data-lock]').isVisible(),'Locked action hidden: '+theme+' '+width);
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No overflow: '+theme+' '+width);
  if(width<=600)ok(await page.evaluate(()=>Math.abs(document.querySelector('[data-trash]').getBoundingClientRect().width-document.querySelector('.note-actions').getBoundingClientRect().width)<2),'The last mobile action fills its row after hiding Lock');
  if(width===390)await page.screenshot({path:path.join(artifacts,'locked-'+theme+'-mobile.png'),fullPage:true});
  await page.locator('[data-unlock]').click();await page.locator('#vault-input').fill(pin);await page.locator('dialog [data-confirm]').click();await page.waitForSelector('[data-lock]',{state:'visible'});
  if(width===390)await page.screenshot({path:path.join(artifacts,'unlocked-'+theme+'-mobile.png'),fullPage:true});
 }
 ok(!errors.length,'No unhandled browser errors: '+errors.join(', '));
 console.log('PASS '+checks+' clipboard and lock-action checks. Screenshots: '+artifacts);
}finally{await browser.close();}
