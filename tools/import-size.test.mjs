// Isolated synthetic browser data only. A mocked size checks the removed gate;
// this is deliberately NOT a claim to have parsed an actual multi-GB file.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {fixture} from './puter-fixture.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/eaton/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext({locale:'en-US'});await fixture().attach(context);const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4321/settings.html');await page.waitForSelector('[data-import]');
 await page.evaluate(async()=>{
  const S=await import('/script/store.js');
  const n=await S.saveNote({id:S.uuid(),mode:'basic',rev:0},{title:'Synthetic source',text:'Only disposable test content.',images:[],history:[]});
  window.__entry=await S.exportNote(n);
  const original=HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click=function(){
   if(this.type!=='file')return original.call(this);
   const file=new File([JSON.stringify(window.__entry)],'synthetic.json',{type:'application/json'});
   Object.defineProperty(file,'size',{value:6_000_000_000});
   const dt=new DataTransfer();dt.items.add(file);this.files=dt.files;this.dispatchEvent(new Event('change'));
  };
 });
 await page.locator('[data-import]').click();await page.waitForSelector('dialog');
 assert.match(await page.locator('dialog').innerText(),/imported/i);
 assert.equal(await page.evaluate(async()=>(await(await import('/script/store.js')).all()).length),2);
 assert.equal(await page.evaluate(async()=>{const S=await import('/script/store.js');const ns=await S.all();return (await S.decodeRecord(ns.find(n=>n.id!==window.__entry.id))).text;}),'Only disposable test content.');
 await page.locator('dialog [data-confirm]').click();
 await page.evaluate(()=>{window.__entry={format:'invalid',version:1};});
 await page.locator('[data-import]').click();await page.waitForSelector('dialog');
 assert.doesNotMatch(await page.locator('dialog').innerText(),/imported successfully/i);
 assert.equal(await page.evaluate(async()=>(await(await import('/script/store.js')).all()).length),2);
 assert.deepEqual(errors,[]);
 console.log('PASS: no file-size gate at 6 GB metadata; valid import creates a readable new copy; invalid format leaves existing notes unchanged. Not an actual 6 GB parsing test.');
}finally{await browser.close();}
