/* Puter boundary: no developer credentials, no public file URLs, no legacy data upload. */
import * as S from './store.js';
import * as C from './crypto.js';
import * as Unlock from './unlock-cache.js';
import {responseSchema} from './agent-images.js';
let sdkPromise,user=null,ready=false,session=0,syncTask=null,timer=null;
let state='signedOut';
const ROOT='atlasnote-v1';
const MAIN_HOST='atlasnote.nxlabtw.com';
const MAIN_APP_NAME='AtlasNote';
let activeRoot=ROOT,sharedAppId=null,sharedKV=null;
const ID=/^[a-f0-9-]{36}$/;
const HASH=/^[a-f0-9]{64}$/;
const utf8=new TextEncoder();
export const profile=()=>user?{uuid:user.uuid,username:user.username,emailConfirmed:!!user.email_confirmed}:null;
export const status=()=>state;
export const signedIn=()=>ready&&!!user;
function notify(value){state=value;window.dispatchEvent(new CustomEvent('atlas-cloud',{detail:{state}}));}
function missing(e){return e?.status===404||e?.error?.status===404||['ENOENT','not_found','subject_does_not_exist'].includes(e?.code)||['ENOENT','not_found','subject_does_not_exist'].includes(e?.error?.code);}
export function errorKey(e){const code=e?.code||e?.error?.code||e?.error||e?.message;return e?.status===402||['insufficient_funds','subscription_required'].includes(code)?'cloudCredit':e?.status===413||code==='storage_limit_reached'?'cloudFull':e?.status===429||code==='too_many_requests'?'cloudRate':['cloudAuth','cloudOffline','cloudConflict','cloudInvalid','cloudPending','cloudKey','domainPermission','domainAppMissing'].includes(code)?code:'cloudError';}
function deadline(p,ms=20000){let t;return Promise.race([p,new Promise((_,reject)=>t=setTimeout(()=>reject(new Error('cloudOffline')),ms))]).finally(()=>clearTimeout(t));}
export function sdk(){
  if(window.puter)return Promise.resolve(window.puter);
  if(!sdkPromise)sdkPromise=new Promise((resolve,reject)=>{const tag=document.createElement('script');tag.src='https://js.puter.com/v2/';tag.async=true;tag.onload=()=>window.puter?resolve(window.puter):reject(new Error('cloudError'));tag.onerror=()=>{sdkPromise=null;tag.remove();reject(new Error('cloudOffline'));};document.head.append(tag);});
  return deadline(sdkPromise);
}
async function identity(){if(!navigator.onLine)throw new Error('cloudOffline');const p=await sdk();if(!p.auth.isSignedIn())throw new Error('cloudAuth');const u=await deadline(p.auth.getUser());if(!u||typeof u.uuid!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(u.uuid)||u.is_temp)throw new Error('cloudAuth');return u;}
export async function authorize(){if(!ready||!user)throw new Error('cloudAuth');try{const u=await identity();if(u.uuid!==user.uuid)throw new Error('cloudAuth');return u;}catch(e){suspend(errorKey(e));throw e;}}
function suspend(reason){if(reason==='cloudAuth')Unlock.forgetAll();ready=false;C.useAccountKey(null);notify(reason==='cloudAuth'?'signedOut':'offline');window.dispatchEvent(new CustomEvent('atlas-access-lost'));}
export async function signIn(){const p=await sdk();++session;ready=false;clearTimeout(timer);await p.auth.signIn({attempt_temp_user_creation:false,request_auth:true});return connect();}
async function prepareDomain(p,next,request=false){
  if(location.hostname.toLowerCase()===MAIN_HOST){activeRoot=ROOT;sharedAppId=null;sharedKV=null;return;}
  // Puter apps are looked up by their registered app name, not by their hosting domain.
  const target=await deadline(p.apps.get(MAIN_APP_NAME));if(!target?.uid)throw new Error('domainAppMissing');
  // Use Puter's documented per-store scope shape: files can be read/written;
  // only this app's settings need KV get/set (not delete).
  const scopes={fs:'write',kv:['get','set']};
  let granted=await deadline(p.perms.check('appData',{app:target.uid,scopes}));
  if(!granted){
    // Before consent, discard only this secondary app's old Puter namespace.
    activeRoot=ROOT;sharedAppId=null;sharedKV=null;
    try{await p.fs.delete(ROOT,{recursive:true});}catch(e){if(!missing(e))throw e;}
  }
  if(!granted&&request)granted=await deadline(p.perms.request('appData',{app:target.uid,scopes}));
  if(!granted){activeRoot=null;sharedAppId=target.uid;sharedKV={appUuid:target.uid};throw new Error('domainPermission');}
  if(typeof next.username!=='string'||! /^[A-Za-z0-9_.-]{1,100}$/.test(next.username))throw new Error('cloudAuth');
  sharedAppId=target.uid;sharedKV={appUuid:target.uid};activeRoot=`/${next.username}/AppData/${target.uid}/${ROOT}`;
}
export async function requestDomainAccess(){const p=await sdk(),next=await identity();await prepareDomain(p,next,true);return connect();}
export async function connect(){
  const ticket=++session;ready=false;clearTimeout(timer);if(syncTask)await syncTask.catch(()=>{});C.useAccountKey(null);notify('connecting');
  try{
    const next=await identity();if(ticket!==session)throw new Error('cloudAuth');
    const p=await sdk();await prepareDomain(p,next,false);let config;
    try{config=await readJSON(path('account.json'),4000);}catch(e){if(!missing(e))throw e;
      // Never initialize a replacement key over a pre-existing notebook tree.
      if((await list(path('notes'))).length)throw new Error('cloudKey');
      const candidate={format:'AtlasNoteAccount',version:1,owner:next.uuid,root:C.b64(C.random(32)),createdAt:new Date().toISOString()};try{await p.fs.write(path('account.json'),JSON.stringify(candidate),{overwrite:false,createMissingParents:true});}catch(writeError){/* Another device may have initialized the same account. Read the winner, never replace it. */try{config=await readJSON(path('account.json'),4000);}catch{throw writeError;}}config??=await readJSON(path('account.json'),4000);}
    if(config.format!=='AtlasNoteAccount'||config.version!==1||config.owner!==next.uuid||C.unb64(config.root).length!==32)throw new Error('cloudKey');
    if(ticket!==session)throw new Error('cloudAuth');user=next;await Unlock.beginSession(next.uuid,p.authToken);if(ticket!==session)throw new Error('cloudAuth');C.useAccountKey(C.unb64(config.root));ready=true;
    S.configureAccount(user.uuid,{authorize,prepare:async record=>{await authorize();return {id:crypto.randomUUID(),noteId:record.id,parents:[],record:structuredClone(record),deleted:false,at:new Date().toISOString()};},changed:async()=>{notify('syncing');await sync();},remove:removeNote});
    try{await sync();}catch(e){if(['cloudAuth','cloudOffline','cloudKey','cloudInvalid'].includes(errorKey(e)))throw e;}
    try{const saved=await preferences();window.dispatchEvent(new CustomEvent('atlas-preferences',{detail:saved}));}catch{}
    return profile();
  }catch(e){if(ticket!==session)throw e;ready=false;C.useAccountKey(null);notify(errorKey(e)==='cloudAuth'?'signedOut':errorKey(e));throw e;}
}
export async function boot(){try{const p=await sdk();if(!p.auth.isSignedIn()){notify('signedOut');return null;}return await connect();}catch{return null;}}
export async function signOut(){await authorize();if((await S.rawAll('outbox')).length){await sync();if((await S.rawAll('outbox')).length)throw new Error('cloudPending');}++session;clearTimeout(timer);const p=await sdk();await p.auth.signOut();user=null;ready=false;Unlock.forgetAll();S.detachAccount();notify('signedOut');}
function schedule(){clearTimeout(timer);timer=setTimeout(()=>sync().catch(()=>{}),250);}
const path=relative=>`${activeRoot}/${relative}`;
export async function readJSON(filePath,max=100_000_000){const file=await (await sdk()).fs.read(filePath);if(!file||file.size>max)throw new Error('cloudInvalid');let value;try{value=JSON.parse(await file.text());}catch{throw new Error('cloudInvalid');}return value;}
async function hash(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',utf8.encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('');}
async function blob(value){if(!ready)throw new Error('cloudAuth');const text=JSON.stringify(value),id=await hash(text),filePath=path('blobs/'+id+'.json');if(!ready)throw new Error('cloudAuth');try{await (await sdk()).fs.write(filePath,text,{overwrite:false,createMissingParents:true});}catch(e){let existing;try{existing=await readBlob(id);}catch{throw e;}if(JSON.stringify(existing)!==text)throw new Error('cloudInvalid');}return id;}
async function readBlob(id){if(!HASH.test(id))throw new Error('cloudInvalid');const value=await readJSON(path('blobs/'+id+'.json'));if(await hash(JSON.stringify(value))!==id)throw new Error('cloudInvalid');return value;}
async function pack(record){const r=structuredClone(record);if(r.attachments)r.attachments=await Promise.all(r.attachments.map(async a=>({id:a.id,hash:a.hash,blob:await blob(a.box)})));if(r.mode==='none'&&r.body.images)r.body.images=await Promise.all(r.body.images.map(async image=>({blob:await blob(image)})));return blob(r);}
async function unpack(id){const r=await readBlob(id);if(!ID.test(r.id)||!['none','basic','secure'].includes(r.mode)||!Number.isFinite(Date.parse(r.updatedAt))||!Number.isFinite(Date.parse(r.createdAt)))throw new Error('cloudInvalid');if(r.attachments){if(!Array.isArray(r.attachments)||r.attachments.length>3)throw new Error('cloudInvalid');r.attachments=await Promise.all(r.attachments.map(async a=>({id:a.id,hash:a.hash,box:await readBlob(a.blob)})));}if(r.mode==='none'){if(!Array.isArray(r.body?.images)||r.body.images.length>3)throw new Error('cloudInvalid');r.body.images=await Promise.all(r.body.images.map(a=>readBlob(a.blob)));S.validatePayload(r.body);}else{if(C.unb64(r.body?.iv).length!==12||C.unb64(r.body?.data).length<16||C.unb64(r.titleBox?.iv).length!==12)throw new Error('cloudInvalid');if(r.mode==='secure'&&(C.unb64(r.salt).length!==16||C.unb64(r.wrap?.iv).length!==12))throw new Error('cloudInvalid');}return r;}
async function list(path){try{return await (await sdk()).fs.readdir(path);}catch(e){if(missing(e))return [];throw e;}}
async function mapLimit(items,limit,task){const output=new Array(items.length);let next=0;await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(true){const index=next++;if(index>=items.length)return;output[index]=await task(items[index],index);}}));return output;}
export async function sync(){
  if(syncTask)return syncTask;const ticket=session,owner=user?.uuid;
  syncTask=(async()=>{await authorize();notify('syncing');const run=async()=>{
    // Immutable change files are committed last. A failed upload cannot publish half a note.
    for(const change of await S.rawAll('outbox')){if(ticket!==session||!ready)throw new Error('cloudAuth');const commit={format:'AtlasNoteChange',version:1,id:change.id,noteId:change.noteId,parents:change.parents,deleted:change.deleted,at:change.at,snapshot:change.deleted?null:await pack(change.record)};if(ticket!==session||!ready)throw new Error('cloudAuth');const filePath=path('notes/'+change.noteId+'/'+change.id+'.json');try{await (await sdk()).fs.write(filePath,JSON.stringify(commit),{overwrite:false,createMissingParents:true});}catch(e){let existing;try{existing=await readJSON(filePath,6000);}catch{throw e;}if(JSON.stringify(existing)!==JSON.stringify(commit))throw new Error('cloudInvalid');}S.memoryDelete('outbox',change.id);S.memoryPut('changes',commit);}
    const folders=(await list(path('notes'))).filter(folder=>ID.test(folder.name)&&folder.is_dir),pendingIds=new Set((await S.rawAll('outbox')).map(change=>change.noteId));
    // Bound remote fan-out to avoid the old serial latency without flooding Puter.
    await mapLimit(folders,4,async folder=>{
      const files=(await list(path('notes/'+folder.name))).filter(file=>ID.test(file.name?.replace(/\.json$/,''))),changes=await mapLimit(files,4,async file=>{
        const id=file.name.replace(/\.json$/,'');let c=await S.rawGet('changes',id);if(!c){c=await readJSON(path('notes/'+folder.name+'/'+file.name),6000);if(c.format!=='AtlasNoteChange'||c.version!==1||c.id!==id||c.noteId!==folder.name||!Array.isArray(c.parents)||c.parents.length>100||!c.parents.every(x=>ID.test(x))||typeof c.deleted!=='boolean'||(!c.deleted&&!HASH.test(c.snapshot))||!Number.isFinite(Date.parse(c.at)))throw new Error('cloudInvalid');S.memoryPut('changes',c);}return c;
      });
      const referenced=new Set(changes.flatMap(c=>c.parents)),heads=changes.filter(c=>!referenced.has(c.id));if(!heads.length&&changes.length)throw new Error('cloudInvalid');
      if(pendingIds.has(folder.name))return;const known=await S.rawGet('heads',folder.name);if(JSON.stringify([...known?.tips||[]].sort())===JSON.stringify(heads.map(c=>c.id).sort()))return;
      if(ticket!==session||owner!==user?.uuid)throw new Error('cloudAuth');
      if(heads.length>1){S.memoryPut('heads',{id:folder.name,tips:heads.map(c=>c.id)});S.memoryPut('conflicts',{id:folder.name,heads});return;}
      const head=heads[0];if(!head)return;const remote=head.deleted?null:await unpack(head.snapshot);if(remote&&remote.id!==folder.name)throw new Error('cloudInvalid');
      if((await S.rawAll('outbox')).some(c=>c.noteId===folder.name))return;
      const n=await S.rawGet('notes',folder.name);if(remote)S.memoryPut('notes',{...remote,rev:(n?.rev||0)+1});else S.memoryDelete('notes',folder.name);S.memoryPut('heads',{id:folder.name,tips:[head.id]});S.memoryDelete('conflicts',folder.name);
    });
    const conflicts=await S.rawAll('conflicts');notify(conflicts.length?'conflict':(await S.rawAll('outbox')).length?'pending':'synced');
  };return navigator.locks?await navigator.locks.request('atlas-cloud-sync-'+owner,run):await run();})().catch(e=>{notify(errorKey(e));throw e;}).finally(()=>{syncTask=null;if(ready)S.rawAll('outbox').then(items=>{if(items.length){clearTimeout(timer);timer=setTimeout(()=>sync().catch(()=>{}),state==='pending'?500:30000);}}).catch(()=>{});});return syncTask;
}
async function removeNote(id,expected){await authorize();const n=await S.rawGet('notes',id);if(!n||n.rev!==expected)throw new Error('conflict');const h=await S.rawGet('heads',id),change={id:crypto.randomUUID(),noteId:id,parents:h?.tips||[],deleted:true,at:new Date().toISOString()};S.memoryPut('outbox',change);S.memoryPut('heads',{id,tips:[change.id]});S.memoryDelete('notes',id);S.memoryDelete('conflicts',id);notify('syncing');await sync();}
export const conflicts=()=>S.rawAll('conflicts');
export async function conflictPreview(head){await authorize();return head.deleted?null:unpack(head.snapshot);}
export async function resolveConflict(id,chosen){await authorize();const conflict=await S.rawGet('conflicts',id);if(!conflict||!conflict.heads.some(h=>h.id===chosen))throw new Error('conflict');const head=conflict.heads.find(h=>h.id===chosen),record=await conflictPreview(head),n=await S.rawGet('notes',id),change={id:crypto.randomUUID(),noteId:id,parents:conflict.heads.map(h=>h.id),record,deleted:head.deleted,at:new Date().toISOString()};if(record)S.memoryPut('notes',{...record,rev:(n?.rev||0)+1});else S.memoryDelete('notes',id);S.memoryPut('outbox',change);S.memoryPut('heads',{id,tips:[change.id]});S.memoryDelete('conflicts',id);await sync();}
export async function usage(){await authorize();const p=await sdk(),[space,monthly]=await Promise.allSettled([p.fs.space(),p.auth.getMonthlyUsage()]);return {space:space.status==='fulfilled'?space.value:null,monthly:monthly.status==='fulfilled'?monthly.value:null};}
export async function savePreferences(prefs){await authorize();const p=await sdk();await p.kv.set('atlasnote.preferences.v1',{theme:prefs.theme==='light'?'light':'dark',language:['en','zh-Hant','ja','leet'].includes(prefs.language)?prefs.language:null,history:[0,1,3,5,10,20].includes(prefs.history)?prefs.history:3,trashDays:[1,3,7,14,30].includes(prefs.trashDays)?prefs.trashDays:7},sharedKV||undefined);S.savePreferences(prefs);}
export async function preferences(){await authorize();const p=await sdk(),options=sharedKV||undefined;let value=await p.kv.get('atlasnote.preferences.v1',options);if(!value)value=await p.kv.get('atlasnote.retention.v1',options);return value&&typeof value==='object'?S.savePreferences({...S.preferences(),...value}):S.preferences();}
export async function saveRetention(prefs){return savePreferences(prefs);}
export async function retention(){return preferences();}
export async function agent(messages,onChunk,signal){await authorize();const p=await sdk(),models=await p.ai.listModels(),candidate=models.find(m=>m.id==='openai/gpt-6-luna')||models.find(m=>m.id==='gpt-6-luna');if(!candidate)throw new Error('agentUnavailable');const result=await p.ai.chat(messages,{model:candidate.id,stream:true,max_tokens:12000,outputFormat:{type:'json_schema',schema:responseSchema,name:'atlas_note_edit',strict:true},signal});let text='';for await(const chunk of result){if(signal.aborted)throw new DOMException('Aborted','AbortError');if(chunk.type==='error')throw new Error('agentFailed');if(chunk.text){text+=chunk.text;onChunk(text.length);if(text.length>200000)throw new Error('agentInvalid');}}return text;}
window.addEventListener('offline',()=>{if(user)suspend('cloudOffline');});
window.addEventListener('focus',()=>{if(ready)authorize().then(()=>sync()).catch(()=>{});});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&ready)authorize().catch(()=>{});});
setInterval(()=>{if(ready&&!document.hidden)authorize().catch(()=>{});},30000);
