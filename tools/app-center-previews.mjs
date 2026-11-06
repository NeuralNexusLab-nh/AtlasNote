/* Generate only synthetic App Center preview media. No real Puter account or note is opened. */
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {fixture} from './puter-fixture.mjs';

const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/eaton/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const destination=fileURLToPath(new URL('../marketing/app-center/',import.meta.url));
const base='https://atlasnote.nxlabtw.com';
await fs.mkdir(destination,{recursive:true});

const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({locale:'en-US',serviceWorkers:'block',viewport:{width:1920,height:1080}});
const mock=fixture();
await mock.attach(context);
const page=await context.newPage();
try{
  await page.goto(base+'/notes.html');
  await page.waitForSelector('#note-list');
  const ids=await page.evaluate(async()=>{
    const C=await import('/script/crypto.js'),S=await import('/script/store.js'),U=await import('/script/unlock-cache.js'),Cloud=await import('/script/cloud.js');
    const canvas=document.createElement('canvas');canvas.width=960;canvas.height=540;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#eef0ff';ctx.fillRect(0,0,960,540);ctx.fillStyle='#29367f';ctx.font='bold 86px Arial';ctx.fillText('AtlasNote',72,190);ctx.fillStyle='#747a9d';ctx.font='42px Arial';ctx.fillText('Write it freely, keep it closely.',72,276);
    const imageBlob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    const image={id:'img_02468ace1357',type:'image/png',data:C.b64(new Uint8Array(await imageBlob.arrayBuffer())),width:960,height:540,caption:'A visual note, kept alongside its text.'};
    const make=async(title,text,images=[])=>{
      const id=S.uuid(),vault=await C.createVault(id,'Preview!PIN-2026');
      const record=await S.saveNote({id,mode:'secure',rev:0,pinned:false,archived:false,trashedAt:null,salt:vault.salt,wrap:vault.wrap},{title,text,images,history:[]},vault.key);
      await U.remember(record,vault.key);vault.key.fill(0);return id;
    };
    const welcome=await make('Everything in one clear place','# Keep the useful things close\n\nCapture a thought, a link, an image, or a detail worth keeping. AtlasNote keeps it readable when you need it.\n\n{img_02468ace1357}',[image]);
    await make('Saturday checklist','- Finish the project outline\n- Bring the camera\n- Send the notes\n\nA short note is often the one you need most.');
    await make('Private reference','A secure note for personal details. AtlasEncrypt keeps the content protected until you unlock it.');
    await Cloud.sync();return {welcome};
  });

  const largeShots=[
    {name:'desktop-01-notes.png',size:[1920,1080],url:'/notes.html'},
    {name:'desktop-02-note.png',size:[1920,1080],url:`/note.html?id=${ids.welcome}`},
    {name:'desktop-03-editor.png',size:[1920,1080],url:`/edit.html?id=${ids.welcome}`},
    {name:'tablet-01-notes.png',size:[1024,768],url:'/notes.html'},
    {name:'tablet-02-note.png',size:[1024,768],url:`/note.html?id=${ids.welcome}`},
    {name:'tablet-03-editor.png',size:[1024,768],url:`/edit.html?id=${ids.welcome}`}
  ];
  for(const shot of largeShots){
    await page.setViewportSize({width:shot.size[0],height:shot.size[1]});
    await page.goto(base+shot.url);
    const ready=shot.url.startsWith('/notes')?'#note-list':shot.url.startsWith('/note')?'#note-content':'#editor-form';
    await page.waitForSelector(ready,{timeout:15_000});
    await page.waitForTimeout(180);
    await page.screenshot({path:destination+shot.name,fullPage:false});
  }
  const mobileContext=await browser.newContext({locale:'en-US',serviceWorkers:'block',isMobile:true,deviceScaleFactor:3,viewport:{width:360,height:760}});
  await mock.attach(mobileContext);
  const mobile=await mobileContext.newPage();
  await mobile.goto(base+'/notes.html');await mobile.waitForSelector('#note-list',{timeout:15_000});
  await mobile.evaluate(async id=>{const C=await import('/script/crypto.js'),S=await import('/script/store.js'),U=await import('/script/unlock-cache.js'),note=await S.get(id),key=await C.unlockVault(note,'Preview!PIN-2026');try{await U.remember(note,key);}finally{key.fill(0);}} ,ids.welcome);
  for(const shot of [
    {name:'mobile-01-notes.png',url:'/notes.html'},
    {name:'mobile-02-note.png',url:`/note.html?id=${ids.welcome}`},
    {name:'mobile-03-editor.png',url:`/edit.html?id=${ids.welcome}`}
  ]){
    await mobile.goto(base+shot.url);
    const ready=shot.url.startsWith('/notes')?'#note-list':shot.url.startsWith('/note')?'#note-content':'#editor-form';
    await mobile.waitForSelector(ready,{timeout:15_000});await mobile.waitForTimeout(180);
    await mobile.screenshot({path:destination+shot.name,fullPage:false});
  }
  await mobileContext.close();
  console.log(`Created ${largeShots.length+3} synthetic App Center previews in ${destination}`);
}finally{await browser.close();}
