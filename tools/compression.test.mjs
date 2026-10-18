import {createRequire} from 'node:module';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/eaton/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({locale:'en-US',viewport:{width:390,height:844}}),page=await context.newPage(),artifacts=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-compression-'));
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4321/edit.html');await page.waitForSelector('#editor-form');await page.locator('#note-title').fill('Synthetic compression comparison');
 await page.locator('[data-compression=clear]').click();
 const source=await page.evaluate(async()=>{
  const c=document.createElement('canvas');c.width=2400;c.height=1600;const x=c.getContext('2d'),g=x.createLinearGradient(0,0,2400,1600);g.addColorStop(0,'#e7dcf3');g.addColorStop(.5,'#8294c5');g.addColorStop(1,'#33467c');x.fillStyle=g;x.fillRect(0,0,2400,1600);
  let seed=125;for(let i=0;i<12000;i++){seed=(seed*16807)%2147483647;const a=seed%2400;seed=(seed*16807)%2147483647;const b=seed%1600;x.fillStyle=`rgba(40,60,110,${(i%9)/15})`;x.fillRect(a,b,3+i%17,3+i%7);}
  x.fillStyle='#fff';x.fillRect(120,170,2100,1060);x.fillStyle='#263452';x.font='bold 68px sans-serif';x.fillText('ATLASNOTE · SYNTHETIC TEST',180,280);x.font='36px sans-serif';for(let i=0;i<13;i++)x.fillText('Keep this note clear and easy to read. '+(i+1),180,380+i*57);
  const blob=await new Promise(r=>c.toBlob(r,'image/png'));window.__sourcePixels=x.getImageData(0,0,2400,1600).data;return {data:[...new Uint8Array(await blob.arrayBuffer())],bytes:blob.size};
 });
 await page.setInputFiles('#image-files',{name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from(source.data)});
 await page.waitForSelector('.image-card');await page.waitForFunction(()=>document.querySelector('.compression-switch').getAttribute('aria-busy')==='false');
 const read=()=>page.locator('.image-card img').evaluate(async im=>{await im.decode();return {width:im.naturalWidth,height:im.naturalHeight,bytes:atob(im.src.split(',')[1]).length,src:im.src};});
 const clear=await read();assert.equal(clear.width,2400);
 for(const preset of ['compact','balanced','clear']){
  await page.locator('[data-compression='+preset+']').click();await page.waitForFunction(()=>document.querySelector('.compression-switch').getAttribute('aria-busy')==='false');
  const current=await read();if(preset==='compact'){assert(current.bytes<clear.bytes*.15);assert(current.width<clear.width);}if(preset==='balanced'){assert(current.bytes>globalThis.compactBytes);assert(current.bytes<clear.bytes);assert(current.width>=1024);}if(preset==='compact')globalThis.compactBytes=current.bytes;
  if(preset==='clear'){assert.equal(current.src,clear.src,'Return to clear uses original source, not an already compressed thumbnail');}
  assert.equal(await page.locator('[data-compression].active').getAttribute('data-compression'),preset);assert.equal(await page.locator('[data-compression][aria-pressed=true]').getAttribute('data-compression'),preset);
  await page.locator('.image-header').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(artifacts,preset+'-mobile.png')});console.log(preset,current.width+'x'+current.height,current.bytes+' bytes');
 }
 // Check that drawing is based on the retained source, not a compact thumbnail.
 await page.locator('[data-compression=compact]').click();await page.waitForFunction(()=>document.querySelector('.compression-switch').getAttribute('aria-busy')==='false');await page.locator('[data-draw]').click();assert.equal(await page.locator('#draw-canvas').getAttribute('width'),'2400');await page.locator('[data-cancel-draw]').click();
 await page.selectOption('#language','leet');await page.waitForSelector('dialog');await page.locator('dialog [data-confirm]').click();await page.waitForSelector('#editor-form');
 const leet=await page.evaluate(async()=>{const i=await import('/script/i18n.js');i.setLanguage('en');const plain=i.t('intro');i.setLanguage('leet');const funny=i.t('intro');return {plain,funny};});
 const eligible=[...leet.plain].filter(c=>/[aeiost]/i.test(c)).length,changed=[...leet.plain].filter((c,i)=>c!==leet.funny[i]).length;assert(changed>0&&changed<=Math.ceil(eligible*.2));assert(leet.funny.includes('Markdown'));console.log('l33t:',leet.funny);
 assert.deepEqual(errors,[]);console.log('PASS compression switching, source preservation, drawing resolution and 20% l33t. Screenshots: '+artifacts);
}finally{await browser.close();}
