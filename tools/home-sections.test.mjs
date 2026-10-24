import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fixture} from './puter-fixture.mjs';
const {chromium}=createRequire(import.meta.url)('C:/Users/eaton/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true}),mock=fixture(),context=await browser.newContext({serviceWorkers:'block'});
await mock.attach(context);const page=await context.newPage(),base='https://atlasnote.nxlabtw.com',artifacts=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-home-sections-')),errors=[];let checks=0;
const ok=(value,label)=>{assert.ok(value,label);checks++;};page.on('pageerror',error=>errors.push(error.message));
try{
 for(const language of ['en','zh-Hant','ja','leet'])for(const theme of ['dark','light']){
  mock.setPreferences({language,theme,history:3,trashDays:7});await page.goto(base);await page.waitForSelector('[data-nav-signout]');await page.waitForFunction(({language,theme})=>document.querySelector('#language').value===language&&document.documentElement.dataset.theme===theme,{language,theme});await page.waitForSelector('.home-encryption');await page.evaluate(()=>document.fonts.ready);
  ok(await page.locator('.home-detail').count()===3,'Exactly three existing product sections; no extra AI section');
  const agent=page.locator('.home-purpose .detail-card').last();
  if(language!=='leet')ok((await agent.locator('h3').innerText()).includes('Atlas Agent'),'AI name is visible in the feature heading');
  if(language!=='leet')ok((await agent.locator('h3').innerText()).includes('AI'),'AI is explicitly identified, not hidden behind a vague title');
  ok(await page.locator('.organize-list .organize-item').count()===3,'Organization uses three practical rows');
  ok(await page.locator('.encryption-overview .encryption-option').count()===3,'Three encryption options form one comparison panel');
  for(const [width,height]of [[1440,900],[1024,768],[768,1024],[430,932],[390,844],[360,740],[320,568],[844,390]]){
   await page.setViewportSize({width,height});
   const result=await page.evaluate(()=>{
    const sections=[...document.querySelectorAll('.home-detail')],cards=[...document.querySelectorAll('.home-detail article')];
    const fits=cards.every(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&el.scrollWidth<=el.clientWidth+1;});
    const readable=cards.every(el=>{const h=el.querySelector('h3'),r=h.getBoundingClientRect(),s=getComputedStyle(h);return r.width>=170&&r.height/parseFloat(s.lineHeight)<=3.1;});
    const icons=[...document.querySelectorAll('.home-detail i')].every(el=>{const content=getComputedStyle(el,'::before').content;return content&&content!=='none'&&content!=='normal'&&content!=='""'&&el.getAttribute('aria-hidden')==='true';});
    return {fits,readable,icons,noOverflow:document.documentElement.scrollWidth<=innerWidth+1,sectionCount:sections.length,features:getComputedStyle(document.querySelector('.feature-grid')).gridTemplateColumns.split(' ').length,organize:getComputedStyle(document.querySelector('.home-organize')).gridTemplateColumns.split(' ').length,encryption:getComputedStyle(document.querySelector('.encryption-overview')).gridTemplateColumns.split(' ').length};
   });
   ok(result.fits&&result.noOverflow,`${language}/${theme}/${width}: no horizontal overflow`);ok(result.readable,`${language}/${theme}/${width}: readable feature headings, no narrow word stacks`);ok(result.icons,`${language}/${theme}/${width}: all decorative icons render correctly`);
   if(width===1440)ok(result.features===2&&result.organize===2&&result.encryption===3,'Wide layouts differ: four overview cards, split organization rows, three-column encryption');
   if(width<=600)ok(result.features===1&&result.organize===1&&result.encryption===1,'Small screens use readable full-width content, not squeezed columns');
   if(language==='zh-Hant'&&[1440,390,320].includes(width))await page.screenshot({path:path.join(artifacts,`${theme}-${width}.png`),fullPage:true});
  }
  if(language==='ja'&&theme==='light'){await page.setViewportSize({width:768,height:1024});await page.screenshot({path:path.join(artifacts,'ja-light-tablet.png'),fullPage:true});}
 }
 await page.selectOption('#language','en');await page.waitForFunction(()=>document.querySelector('.home-purpose')?.textContent.includes('your AI editor'));ok(true,'Language switching immediately updates the AI card');
 await page.locator('.home-encryption .section-link a').click();await page.waitForURL('**/docs.html?article=encryption');ok(await page.locator('.docs-layout').count()===1,'Encryption guide link still opens the existing documentation');
 await page.goto(base);await page.waitForSelector('[data-nav-signout]');await page.locator('[data-nav-signout]').click();await page.locator('dialog [data-confirm]').click();await page.waitForSelector('.nav-auth.primary');ok(await page.locator('.home-detail').count()===3,'Public signed-out homepage keeps all three sections and the AI card');
 ok(!errors.length,'No uncaught browser errors: '+errors.join(', '));console.log(JSON.stringify({checks,artifacts},null,2));
}catch(error){await page.screenshot({path:path.join(artifacts,'failure.png'),fullPage:true});console.error('Artifacts:',artifacts);throw error;}finally{await browser.close();}
