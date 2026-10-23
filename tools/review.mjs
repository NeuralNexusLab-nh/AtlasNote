// User-facing correction checks. Synthetic content and an isolated browser profile only.
import {createRequire} from 'node:module';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/eaton/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true}),page=await context.newPage();
const base='https://atlasnote.nxlabtw.com',artifacts=await fs.mkdtemp(path.join(os.tmpdir(),'atlasnote-review-'));const errors=[];page.on('pageerror',e=>errors.push(e.message));let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
try{
 await page.goto(base);await page.waitForSelector('.demo-tabs');await page.selectOption('#language','en');
 ok(!await page.locator('main').textContent().then(s=>s.includes('YOUR WORDS')||s.includes('git status')||s.includes('Back up')),'Home removes technical sample and backup promotion');
 ok(await page.locator('.hero h1 span').count()===2,'Slogan has deliberate two-line rhythm');
 await page.locator('[data-scene="1"]').click();ok((await page.locator('#hero-note').textContent()).includes('Saturday'),'Demo reminder tab');await page.locator('[data-scene="2"]').click();ok((await page.locator('#hero-note').textContent()).includes('AtlasEncrypt'),'Only private demo uses AtlasEncrypt');await page.locator('[data-scene="0"]').click();const first=page.locator('.demo-checklist input').first();await first.uncheck();ok(!await first.isChecked(),'Demo checklist is interactive');
 const order=await page.locator('.nav-links a').allTextContents();ok(order.indexOf('Docs')<order.indexOf('Settings'),'Docs left of settings');const footer=await page.locator('.footer-links a').allTextContents();ok(footer.indexOf('Terms')<footer.indexOf('Privacy'),'Terms left of privacy');ok(!await page.locator('#language').textContent().then(t=>t.includes('😎')),'No l33t emoji');
 for(const lang of ['en','zh-Hant','ja','leet'])for(const theme of ['dark','light']){
  await page.evaluate(({lang,theme})=>localStorage.setItem('atlasnote.preferences',JSON.stringify({language:lang,theme,history:3,trashDays:7})),{lang,theme});
  for(const route of ['/','/settings.html','/docs.html?article=encryption','/docs.html?article=offline']){
   await page.goto(base+route);await page.waitForFunction(()=>!document.querySelector('.initial-loading'));
   if(route.includes('docs'))ok(!await page.locator('main').textContent().then(s=>/Service Worker|HKDF|Argon2|Base64/.test(s)),'Guides use user language');
   if(route.includes('settings'))ok(!await page.locator('main').textContent().then(s=>/On this device|儲存在此裝置|この端末に保存|筆記、圖片與版本/.test(s)),'Settings has clear sections without duplicate device copy');
   for(const [width,height]of[[1440,900],[768,1024],[390,844],[320,568]]){await page.setViewportSize({width,height});await page.waitForTimeout(35);ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),`${lang}/${theme} ${route} ${width} no overflow`);}
   if(lang==='zh-Hant'&&theme==='dark'&&route.includes('settings')){await page.setViewportSize({width:1440,height:900});await page.screenshot({path:path.join(artifacts,'settings-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(artifacts,'settings-mobile.png'),fullPage:true});}
   if(lang==='zh-Hant'&&theme==='dark'&&route==='/'){await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(1000);await page.screenshot({path:path.join(artifacts,'home-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});await page.waitForTimeout(800);await page.screenshot({path:path.join(artifacts,'home-mobile.png'),fullPage:true});}
  }
 }
 await page.evaluate(()=>localStorage.setItem('atlasnote.preferences',JSON.stringify({language:'en',theme:'dark',history:3,trashDays:7})));
 await page.goto(base+'/edit.html');await page.waitForSelector('#editor-form');await page.locator('#note-title').fill('Synthetic large-image test');await page.locator('#note-text').fill('Only generated noise; no user data.');await page.locator('[data-compression=clear]').click();
 const generated=await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.width=3200;canvas.height=2400;const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(canvas.width,canvas.height);
  for(let offset=0;offset<pixels.data.length;offset+=65536)crypto.getRandomValues(pixels.data.subarray(offset,Math.min(offset+65536,pixels.data.length)));
  for(let at=3;at<pixels.data.length;at+=4)pixels.data[at]=255;ctx.putImageData(pixels,0,0);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png')),transfer=new DataTransfer();for(let i=0;i<3;i++)transfer.items.add(new File([blob],`synthetic-${i}.png`,{type:'image/png'}));
  const input=document.querySelector('#image-files');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));return {sourceBytes:blob.size};
 });
 ok(generated.sourceBytes>10_000_000,'Accepts source image above old 10 MB ceiling');await page.waitForFunction(()=>document.querySelectorAll('.image-card').length===3,{},{timeout:120000});
 await page.locator('#save-note').click();await page.waitForURL('**/note.html?id=*',{timeout:120000});await page.waitForSelector('#note-content img',{timeout:120000});
 const note=await page.evaluate(async()=>{const S=await import('/script/store.js');const n=(await S.all())[0],p=await S.decodeRecord(n);return {id:n.id,count:p.images.length,width:p.images[0].width,recordBytes:S.bytes(n)};});
 ok(note.count===3&&note.width===3200,'Images retain dimensions above old 2048 limit');ok(note.recordBytes>25_000_000,'Large image note remains supported without file transfer');
 ok(!await page.locator('[data-export],[data-import]').count(),'Large notes do not expose file transfers');
 ok(!errors.length,'No runtime errors: '+errors.join(','));console.log(`PASS ${checks} targeted checks. Large source ${(generated.sourceBytes/1e6).toFixed(1)} MB; record ${(note.recordBytes/1e6).toFixed(1)} MB. Screenshots: ${artifacts}`);
}catch(error){await page.screenshot({path:path.join(artifacts,'failure.png'),fullPage:true}).catch(()=>{});console.error(error,errors,'Screenshots:',artifacts);process.exitCode=1;}finally{await context.close();await browser.close();}
