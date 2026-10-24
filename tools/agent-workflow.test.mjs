import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fixture} from './puter-fixture.mjs';
const {chromium}=createRequire(import.meta.url)('C:/Users/eaton/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true}),mock=fixture(),base='https://atlasnote.nxlabtw.com';
const artifacts=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-agent-workflow-'));
const context=await browser.newContext({locale:'en-US',viewport:{width:1440,height:900},serviceWorkers:'block'});
await mock.attach(context);const page=await context.newPage();let checks=0;const errors=[],ok=(value,message)=>{assert.ok(value,message);checks++;};
page.on('pageerror',error=>errors.push(error.message));
const viewports=[[1440,900],[1024,768],[768,1024],[430,932],[390,844],[360,740],[320,568],[844,390]];
const reached=barrier=>Promise.race([barrier.entered,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Timed out reaching the synthetic cloud barrier')),15000);timer.unref();})]);
async function layout(stage){
 for(const [width,height] of viewports){
  await page.setViewportSize({width,height});
  const dimensions=await page.locator('dialog[open]').evaluate(el=>{
   const r=el.getBoundingClientRect(),body=el.querySelector('.dialog-body'),actions=el.querySelector('.dialog-actions');
   const a=actions.getBoundingClientRect(),buttons=[...actions.querySelectorAll('button')].map(b=>b.getBoundingClientRect());
   return {fits:r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1,
    noOverflow:body.scrollWidth<=body.clientWidth+1,footer:a.top>=r.top&&a.bottom<=r.bottom+1,
    targets:buttons.every(b=>b.width>=43.99&&b.height>=43.99),balanced:innerWidth>600||buttons.every(b=>Math.abs(b.width-buttons[0].width)<1&&Math.abs(b.height-buttons[0].height)<1)};
  });
  for(const [name,value]of Object.entries(dimensions))ok(value,`${stage} ${width}x${height} ${name}`);
 }
}
async function openAgent(){await page.locator('[data-agent]').click();await page.waitForSelector('.agent-compose');}
async function preview(){await page.locator('#agent-prompt').fill('Make the note clearer, with a useful title.');await page.locator('dialog [data-confirm]').click();await page.waitForSelector('.agent-review #agent-result');}
try{
 await page.goto(base+'/notes.html');await page.waitForSelector('#note-list');
 const id=await page.evaluate(async()=>{
  const S=await import('/script/store.js'),C=await import('/script/crypto.js');
  const canvas=document.createElement('canvas');canvas.width=600;canvas.height=300;const ctx=canvas.getContext('2d');ctx.fillStyle='#dce2ff';ctx.fillRect(0,0,600,300);ctx.fillStyle='#394584';ctx.font='30px sans-serif';ctx.fillText('SYNTHETIC PREVIEW',30,90);
  const file=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  const image={type:file.type,data:C.b64(new Uint8Array(await file.arrayBuffer())),width:600,height:300};
  const first={title:'Previous title — 測試筆記',text:'# Previous text\n\nA separate **content** area.\n\n'+('An older paragraph.\n\n'.repeat(12)),images:Array.from({length:3},(_,i)=>({...image,id:'img_'+String(i+1).padStart(12,'0'),caption:['A brief caption','圖片註解與清楚的重點','A longer caption that should never crush the image or checkbox'][i]})),history:[]};
  const n=await S.saveNote({id:S.uuid(),mode:'basic',rev:0},first,null);
  await S.saveNote(n,{...first,title:'Current title — 圖片與文字的測試筆記',text:'# Current content\n\nThe current note stays unchanged until confirmation.'},null,first);return n.id;
 });
 const response={message:'Organized the paragraphs and clarified the title.\nNothing is saved until you confirm.',title:'A useful title — 圖片與重點，一目了然',text:'# Updated content\n\nA readable **preview**, separate from the note title.\n\n'+('A longer paragraph to check scrolling and line breaks.\n\n'.repeat(14))+'```text\n'+('long_code_'.repeat(40))+'\n```',imageEdits:[]};mock.setAI(response);
 for(const language of ['en','zh-Hant','ja','leet'])for(const theme of ['dark','light']){
  mock.setPreferences({language,theme,history:3,trashDays:7});await page.goto(base+'/note.html?id='+id);await page.waitForSelector('[data-agent]');
  console.log('Checking dialogs:',language,theme);await openAgent();ok(await page.locator('dialog [data-confirm]').isDisabled(),'Empty prompt cannot be submitted');
  ok(await page.locator('[data-agent-image]:checked').count()===0,'Images are opt-in');await layout(`${language}/${theme}/compose`);
  if(language==='zh-Hant'){await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(artifacts,`compose-${theme}-mobile.png`)});}
  const held=mock.pauseNext('ai','');await page.locator('#agent-prompt').fill('Make the note clearer.');await page.locator('dialog [data-confirm]').click();await reached(held);
  ok(await page.locator('.agent-dialog [role=progressbar]').isVisible(),'Progress is visible while waiting for AI');
  ok(await page.locator('.agent-dialog [role=status]').isVisible(),'Generation status is announced');await layout(`${language}/${theme}/progress`);held.release();await page.waitForSelector('#agent-result');
  const labels=await page.locator('.agent-review .note-preview-label').allTextContents();
  const translations={en:['Title','Content'],'zh-Hant':['標題','內容'],ja:['タイトル','本文']};if(translations[language])ok(JSON.stringify(labels)===JSON.stringify(translations[language]),`${language}: labels translated`);
  ok(await page.locator('.agent-review .note-preview-title').textContent()===response.title,'Title has its own field');
  ok((await page.locator('#agent-result').innerText()).includes('Updated content'),'Content has its own field');
  ok((await page.locator('.note-header h1').textContent()).startsWith('Current title'),'Preview never auto-saves');await layout(`${language}/${theme}/review`);
  if(language==='zh-Hant')for(const [width,height,name]of [[1440,900,'desktop'],[390,844,'mobile']]){await page.setViewportSize({width,height});await page.screenshot({path:path.join(artifacts,`review-${theme}-${name}.png`)});}
  await page.locator('dialog [data-cancel]').click();await page.locator('[data-history]').click();await page.waitForSelector('#history-preview .note-preview');
  ok((await page.locator('#history-preview .note-preview-title').textContent()).startsWith('Previous title'),'History title is separate');
  ok((await page.locator('#history-preview .note-preview-content').innerText()).includes('Previous text'),'History content is separate');
  await layout(`${language}/${theme}/history`);
  if(language==='zh-Hant'){await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(artifacts,`history-${theme}-mobile.png`)});}
  await page.locator('dialog [data-cancel]').click();
 }
 mock.setPreferences({language:'en',theme:'dark',history:3,trashDays:7});await page.setViewportSize({width:390,height:844});await page.goto(base+'/note.html?id='+id);await page.waitForSelector('[data-agent]');
 // Cancel immediately even when the provider is still preparing a response.
 await openAgent();const held=mock.pauseNext('ai','');await page.locator('#agent-prompt').fill('Synthetic cancellation');await page.locator('dialog [data-confirm]').click();await reached(held);await page.locator('[data-abort]').click();ok(!await page.locator('dialog[open]').count(),'Cancel closes the waiting UI immediately');held.release();await page.waitForTimeout(150);ok(!await page.locator('.agent-review').count(),'Cancelled work never reopens a result');
 await openAgent();await preview();mock.setFailWrites(true);await page.locator('dialog [data-confirm]').click();await page.waitForSelector('.agent-review .dialog-error');ok(await page.locator('.agent-review').isVisible(),'Upload failure preserves the review');ok(!await page.locator('dialog [data-confirm]').isDisabled(),'Retry is available after failed upload');
 mock.setFailWrites(false);const barrier=mock.pauseNext('write','/blobs/');const before=mock.calls.filter(c=>c.method==='list'&&c.args[0].endsWith('/notes')).length;
 await page.locator('dialog [data-confirm]').click();await reached(barrier);ok(await page.locator('dialog [data-cancel]').isDisabled(),'Cancel is disabled while saving');ok(await page.locator('dialog [data-confirm] .spinner').isVisible(),'Saving has a spinner');await page.keyboard.press('Escape');ok(await page.locator('.agent-review').isVisible(),'Escape cannot dismiss an active save');barrier.release();await page.waitForFunction(()=>document.querySelector('.note-header h1')?.textContent==='A useful title — 圖片與重點，一目了然');
 ok(mock.calls.filter(c=>c.method==='list'&&c.args[0].endsWith('/notes')).length-before===0,'Agent save confirms its upload without rescanning the notebook');
 await page.reload();await page.waitForFunction(()=>document.querySelector('#note-content')?.textContent.includes('Updated content'));ok(true,'Confirmed changes survive a cold cloud reload');
 await page.locator('[data-history]').click();await page.waitForSelector('#history-select');mock.setFailWrites(true);await page.locator('dialog [data-confirm]').click();await page.waitForSelector('.history-dialog .dialog-error');ok(await page.locator('#history-select').isDisabled(),'A failed history upload keeps the pending version selected');mock.setFailWrites(false);await page.locator('dialog [data-confirm]').click();await page.waitForFunction(()=>document.querySelector('.note-header h1')?.textContent.startsWith('Current title'));ok((await page.locator('#note-content').innerText()).includes('Current content'),'Restore changes both title and content after retry');ok(await page.locator('#note-content img').count()===3,'Restoring text retains current images');
 // Unsafe titles are always literal text; Markdown HTML and remote images stay inert.
 mock.setAI({message:'<img src=x onerror=alert(1)>',title:'<img src=x onerror=alert(1)>',text:'<script>alert(1)</script>\n\n![external](https://evil.invalid/image.png)',imageEdits:[]});await openAgent();await preview();
 ok(!await page.locator('.agent-summary img,.note-preview-title img,#agent-result script,#agent-result img[src^="https:"]').count(),'Preview treats supplied HTML as data, never code or remote images');await page.locator('dialog [data-cancel]').click();
 ok(!errors.length,'No browser runtime errors: '+errors.join(', '));console.log(JSON.stringify({checks,artifacts},null,2));
}catch(error){await page.screenshot({path:path.join(artifacts,'failure.png')});console.error('Artifacts:',artifacts);throw error;}finally{await browser.close();}
