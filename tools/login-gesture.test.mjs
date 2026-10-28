import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {fixture} from './puter-fixture.mjs';

const require=createRequire(import.meta.url),{chromium}=require('C:/Users/eaton/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true}),mock=fixture(),base='https://atlasnote.nxlabtw.com';
let checks=0;const ok=(value,message)=>{assert.ok(value,message);checks++;};
try{
  const context=await browser.newContext({serviceWorkers:'block'});await mock.attach(context,{signedIn:false});
  const page=await context.newPage();await page.goto(base+'/notes.html');await page.waitForSelector('[data-cloud-login]');
  const result=await page.evaluate(async()=>{
    const Cloud=await import('/script/cloud.js');let calls=0;
    window.puter.auth.signIn=()=>{calls++;throw {code:'popup_blocked'};};
    const request=Cloud.signIn();
    const callsBeforeAwait=calls,error=await request.catch(value=>value);
    return {callsBeforeAwait,errorKey:Cloud.errorKey(error)};
  });
  ok(result.callsBeforeAwait===1,'A ready Puter sign-in window starts in the original user-gesture task');
  ok(result.errorKey==='cloudPopup','A blocked Puter popup receives a clear, actionable error key');
  console.log(`PASS ${checks} Puter mobile-login gesture checks.`);
}finally{await browser.close();}
