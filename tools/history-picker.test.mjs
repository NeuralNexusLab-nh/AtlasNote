import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fixture} from './puter-fixture.mjs';
const {chromium}=createRequire(import.meta.url)('C:/Users/eaton/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true}),mock=fixture(),context=await browser.newContext({locale:'en-US',serviceWorkers:'block'});
await mock.attach(context);const page=await context.newPage(),base='https://atlasnote.nxlabtw.com',artifacts=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-history-picker-'));let checks=0;const errors=[],ok=(v,m)=>{assert.ok(v,m);checks++;};page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(base+'/notes.html');await page.waitForSelector('#note-list');
 const id=await page.evaluate(async()=>{
  const S=await import('/script/store.js');let title='Current synthetic title',text='Current synthetic text';const history=[];
  for(let i=0;i<20;i++){const previousTitle='Earlier title '+(20-i),previousText='Earlier body '+(20-i)+'\n\n**Synthetic text only**';history.push({at:new Date(Date.now()-(i+1)*60000).toISOString(),title:S.patch(title,previousTitle),text:S.patch(text,previousText)});title=previousTitle;text=previousText;}
  const id=S.uuid(),now=new Date().toISOString();await S.put(await S.encodeRecord({id,mode:'basic',rev:0,createdAt:now,updatedAt:now},{title:'Current synthetic title',text:'Current synthetic text',images:[],history}));return id;
 });
 for(const language of ['en','zh-Hant','ja','leet'])for(const theme of ['dark','light']){
  mock.setPreferences({language,theme,history:20,trashDays:7});await page.goto(base+'/note.html?id='+id);await page.waitForSelector('[data-history]');
  const expected={en:'Version history','zh-Hant':'先前版本',ja:'以前のバージョン'}[language];if(expected)ok(await page.locator('[data-history]').textContent()===expected,'History action uses plural-capable wording');
  await page.locator('[data-history]').click();await page.waitForSelector('#history-select');ok(await page.locator('#history-select option').count()===20,'Every saved version remains selectable');
  if(expected)ok(await page.locator('.history-dialog h2').textContent()===expected,'Dialog title matches the note action');
  const styles=await page.locator('#history-select').evaluate(el=>{el.focus();const s=getComputedStyle(el),r=el.getBoundingClientRect();return {native:el.tagName==='SELECT',appearance:s.appearance,radius:parseFloat(s.borderRadius),height:r.height,focus:el.matches(':focus-visible'),outline:s.outlineStyle};});
  ok(styles.native&&styles.appearance==='none'&&styles.radius===10&&styles.height>=48,'Native select uses AtlasNote field styling and a generous touch target');ok(styles.focus&&styles.outline==='solid','Keyboard focus has a visible outline');
  ok(await page.locator('.history-select>i').evaluateAll(es=>es.length===2&&es.every(el=>el.getAttribute('aria-hidden')==='true'&&getComputedStyle(el).pointerEvents==='none')),'Decorative icons do not capture clicks or repeat accessible labels');
  await page.locator('#history-select').selectOption('19');ok(await page.locator('#history-preview .note-preview-title').textContent()==='Earlier title 1','Oldest version has the correct separate title');ok((await page.locator('#history-preview .note-preview-content').innerText()).includes('Earlier body 1'),'Oldest version has the correct content');
  await page.locator('#history-select').focus();await page.keyboard.press('Home');await page.waitForFunction(()=>document.querySelector('#history-preview .note-preview-title')?.textContent==='Earlier title 20');ok(true,'Keyboard selection updates the preview');
  for(const [width,height]of [[1440,900],[1024,768],[768,1024],[430,932],[390,844],[360,740],[320,568],[844,390]]){
   await page.setViewportSize({width,height});const fits=await page.locator('.history-dialog').evaluate(el=>{const r=el.getBoundingClientRect(),body=el.querySelector('.dialog-body'),select=el.querySelector('#history-select'),field=select.getBoundingClientRect(),s=getComputedStyle(select),ctx=document.createElement('canvas').getContext('2d');ctx.font=s.font;const labelWidth=Math.max(...[...select.options].map(option=>ctx.measureText(option.text).width)),available=select.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight);return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1&&body.scrollWidth<=body.clientWidth+1&&field.width>180&&labelWidth<=available+1;});ok(fits,`${language}/${theme}/${width}: picker and complete date labels fit without horizontal overflow`);
  }
  if(language==='zh-Hant')for(const [width,height,label]of [[1440,900,'desktop'],[390,844,'mobile'],[320,568,'small-mobile']]){await page.setViewportSize({width,height});await page.screenshot({path:path.join(artifacts,`${theme}-${label}.png`)});}
  if(language==='zh-Hant'&&theme==='dark'){await page.locator('#history-select').click();await page.screenshot({path:path.join(artifacts,'dark-options-mobile.png')});await page.keyboard.press('Escape');ok(await page.locator('.history-dialog').isVisible(),'Closing the native option list keeps the history dialog open');}
  await page.locator('dialog [data-cancel]').click();
 }
 ok(!errors.length,'No browser errors: '+errors.join(', '));console.log(JSON.stringify({checks,artifacts},null,2));
}catch(error){await page.screenshot({path:path.join(artifacts,'failure.png')});console.error('Artifacts:',artifacts);throw error;}finally{await browser.close();}
