/* Puter boundary: no developer credentials, no public file URLs, no legacy data upload. */
import * as S from './store.js';
import * as C from './crypto.js';
import * as Unlock from './unlock-cache.js';
import {responseSchema} from './agent-images.js';
import {assertMainSite} from './site-origin.js';
import {requests,isRateLimited} from './cloud-requests.js';
let sdkPromise,user=null,ready=false,session=0,syncTask=null,pushTask=null,timer=null;
let state='signedOut';
let identityFlight=null,identityFlightSession=-1,identityCache=null,identityAt=0,identityToken=null,lastSyncAt=0;
let lastRefreshAt=0,usageCache=null,usageFlight=null,usageVersion=0,accountWork=Promise.resolve();
const clearUsage=()=>{usageCache=null;usageVersion++;};
const ROOT='atlasnote-v1';
const ID=/^[a-f0-9-]{36}$/;
const HASH=/^[a-f0-9]{64}$/;
const utf8=new TextEncoder();
const verifiedBlobs=new Set();
export const profile=()=>user?{uuid:user.uuid,username:user.username,emailConfirmed:!!user.email_confirmed}:null;
export const status=()=>state;
export const signedIn=()=>ready&&!!user;
function notify(value){state=value;window.dispatchEvent(new CustomEvent('atlas-cloud',{detail:{state}}));}
function missing(e){return e?.status===404||e?.error?.status===404||['ENOENT','not_found','subject_does_not_exist'].includes(e?.code)||['ENOENT','not_found','subject_does_not_exist'].includes(e?.error?.code);}
export function errorKey(e){
  const code=e?.code||e?.error?.code||e?.error||e?.message;
  if(['popup_blocked','popupBlocked'].includes(code))return 'cloudPopup';
  if(['auth_window_closed','auth_canceled','auth_cancelled'].includes(code))return 'cloudAuthCanceled';
  if(isRateLimited(e))return 'cloudRate';
  if(e?.status===401||e?.error?.status===401||['invalid_token','authentication_required'].includes(code))return 'cloudAuth';
  if(e?.status===402||['insufficient_funds','subscription_required'].includes(code))return 'cloudCredit';
  if(e?.status===413||code==='storage_limit_reached')return 'cloudFull';
  if((e?.partial===true&&Array.isArray(e.failedItems))||['batch_upload_failed','batch_upload_partially_failed','batch_upload_no_results'].includes(code))return 'cloudUpload';
  return ['cloudAuth','cloudOffline','cloudConflict','cloudInvalid','cloudPending','cloudKey','cloudUpload','mainSiteOnly'].includes(code)?code:'cloudError';
}
async function remote(work,kind='read'){
  const ticket=session,p=await sdk(),token=p.authToken;
  try{return await requests.run(()=>{if(ticket!==session||!p.auth.isSignedIn()||token!==p.authToken)throw new Error('cloudAuth');return work();},kind);}
  catch(e){if(ticket===session&&errorKey(e)==='cloudAuth')suspend('cloudAuth');throw e;}
}
function deadline(p,ms=20000){let t;return Promise.race([p,new Promise((_,reject)=>t=setTimeout(()=>reject(new Error('cloudOffline')),ms))]).finally(()=>clearTimeout(t));}
export function sdk(){
  assertMainSite();
  if(window.puter)return Promise.resolve(window.puter);
  if(!sdkPromise)sdkPromise=new Promise((resolve,reject)=>{const tag=document.createElement('script');tag.src='https://js.puter.com/v2/';tag.async=true;tag.onload=()=>window.puter?resolve(window.puter):reject(new Error('cloudError'));tag.onerror=()=>{sdkPromise=null;tag.remove();reject(new Error('cloudOffline'));};document.head.append(tag);});
  return deadline(sdkPromise);
}
async function identity(force=false){
  if(!navigator.onLine)throw new Error('cloudOffline');const p=await sdk();if(!p.auth.isSignedIn())throw new Error('cloudAuth');
  if(!force&&identityCache&&identityToken===p.authToken&&Date.now()-identityAt<30000)return identityCache;
  if(identityFlight&&identityFlightSession===session)return deadline(identityFlight);
  const ticket=session,token=p.authToken;
  const flight=remote(()=>p.auth.getUser(),'auth').then(u=>{if(ticket!==session||token!==p.authToken||!u||typeof u.uuid!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(u.uuid)||u.is_temp)throw new Error('cloudAuth');identityCache=u;identityAt=Date.now();identityToken=token;return u;}).finally(()=>{if(identityFlight===flight)identityFlight=null;});
  identityFlight=flight;identityFlightSession=ticket;return deadline(flight);
}
export async function authorize(force=false){assertMainSite();if(!ready||!user)throw new Error('cloudAuth');try{const u=await identity(force);if(u.uuid!==user.uuid)throw new Error('cloudAuth');return u;}catch(e){if(errorKey(e)==='cloudAuth'||errorKey(e)==='cloudOffline')suspend(errorKey(e));throw e;}}
function suspend(reason){identityCache=null;identityAt=0;clearUsage();if(reason==='cloudAuth')Unlock.forgetAll();ready=false;C.useAccountKey(null);notify(reason==='cloudAuth'?'signedOut':'offline');window.dispatchEvent(new CustomEvent('atlas-access-lost'));}
function beginSignIn(p){
  // iPadOS can reject a popup after an awaited SDK promise, despite the user
  // having just tapped Login. Start the provider window in this same task.
  ++session;ready=false;clearTimeout(timer);
  let request;
  try{request=p.auth.signIn({attempt_temp_user_creation:false,request_auth:true});}
  catch(error){return Promise.reject(error);}
  return Promise.resolve(request).then(()=>connect());
}
export function signIn(){
  assertMainSite();
  // The SDK normally loaded during boot. Do not await before its popup API.
  return window.puter?beginSignIn(window.puter):sdk().then(beginSignIn);
}
export async function connect(){
  assertMainSite();
  const ticket=++session;ready=false;clearTimeout(timer);clearUsage();lastRefreshAt=0;if(syncTask)await syncTask.catch(()=>{});if(pushTask)await pushTask.catch(()=>{});C.useAccountKey(null);notify('connecting');
  try{
    const next=await identity(true);if(ticket!==session)throw new Error('cloudAuth');
    const p=await sdk();let config;
    try{config=await readJSON(path('account.json'),4000);}catch(e){if(!missing(e))throw e;
      // Never initialize a replacement key over a pre-existing notebook tree.
      if((await list(path('notes'))).length||(await list(path('blobs'))).length)throw new Error('cloudKey');
      const candidate={format:'AtlasNoteAccount',version:1,owner:next.uuid,root:C.b64(C.random(32)),createdAt:new Date().toISOString()};try{await remote(()=>p.fs.write(path('account.json'),JSON.stringify(candidate),{overwrite:false,createMissingParents:true}),'write');}catch(writeError){/* Another device may have initialized the same account. Read the winner, never replace it. */try{config=await readJSON(path('account.json'),4000);}catch{throw writeError;}}config??=await readJSON(path('account.json'),4000);}
    if(config.format!=='AtlasNoteAccount'||config.version!==1||config.owner!==next.uuid||C.unb64(config.root).length!==32)throw new Error('cloudKey');
    if(ticket!==session)throw new Error('cloudAuth');if(user?.uuid!==next.uuid)verifiedBlobs.clear();user=next;await Unlock.beginSession(next.uuid,p.authToken);if(ticket!==session)throw new Error('cloudAuth');C.useAccountKey(C.unb64(config.root));ready=true;
    S.configureAccount(user.uuid,{authorize,prepare:async record=>{await authorize();return {id:crypto.randomUUID(),noteId:record.id,parents:[],record:structuredClone(record),deleted:false,at:new Date().toISOString()};},changed:async id=>{notify('syncing');await flushChange(id);},remove:removeNote});
    await sync();
    try{const saved=await preferences();window.dispatchEvent(new CustomEvent('atlas-preferences',{detail:saved}));}catch{}
    return profile();
  }catch(e){if(ticket!==session)throw e;ready=false;C.useAccountKey(null);notify(errorKey(e)==='cloudAuth'?'signedOut':errorKey(e));throw e;}
}
export async function boot(){try{const p=await sdk();if(!p.auth.isSignedIn()){notify('signedOut');return null;}return await connect();}catch{return null;}}
export async function signOut(){await authorize();if(S.hasPending())await flushPending();++session;clearTimeout(timer);const p=await sdk();await p.auth.signOut();identityCache=null;identityAt=0;clearUsage();verifiedBlobs.clear();user=null;ready=false;Unlock.forgetAll();S.detachAccount();notify('signedOut');}
// A frozen full document must not retain an authenticated view across logout elsewhere.
// No provider logout, remote mutation or removal of the tab unlock cache is performed.
export function discardFrozenPage(){++session;clearTimeout(timer);identityCache=null;identityAt=0;clearUsage();verifiedBlobs.clear();user=null;ready=false;S.detachAccount();}
const path=relative=>`${ROOT}/${relative}`;
export async function readJSON(filePath,max=100_000_000){const p=await sdk(),file=await remote(()=>p.fs.read(filePath));if(!file||file.size>max)throw new Error('cloudInvalid');let value;try{value=JSON.parse(await file.text());}catch{throw new Error('cloudInvalid');}return value;}
async function hash(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',utf8.encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('');}
async function blob(value){
  if(!ready)throw new Error('cloudAuth');const text=JSON.stringify(value),id=await hash(text),filePath=path('blobs/'+id+'.json');if(verifiedBlobs.has(id))return id;
  const p=await sdk();try{await remote(()=>p.fs.write(filePath,text,{overwrite:false,createMissingParents:true}),'write');}catch(e){let existing;try{existing=await readBlob(id);}catch{throw e;}if(JSON.stringify(existing)!==text)throw new Error('cloudInvalid');}
  verifiedBlobs.add(id);return id;
}
async function readBlob(id){if(!HASH.test(id))throw new Error('cloudInvalid');const value=await readJSON(path('blobs/'+id+'.json'));if(await hash(JSON.stringify(value))!==id)throw new Error('cloudInvalid');verifiedBlobs.add(id);return value;}
async function pack(record){const r=structuredClone(record);if(r.attachments)r.attachments=await Promise.all(r.attachments.map(async a=>({id:a.id,hash:a.hash,blob:await blob(a.box)})));if(r.mode==='none'&&r.body.images)r.body.images=await Promise.all(r.body.images.map(async image=>({blob:await blob(image)})));return blob(r);}
async function unpack(id){const r=await readBlob(id);if(!ID.test(r.id)||!['none','basic','secure'].includes(r.mode)||!Number.isFinite(Date.parse(r.updatedAt))||!Number.isFinite(Date.parse(r.createdAt)))throw new Error('cloudInvalid');if(r.attachments){if(!Array.isArray(r.attachments)||r.attachments.length>3)throw new Error('cloudInvalid');r.attachments=await Promise.all(r.attachments.map(async a=>({id:a.id,hash:a.hash,box:await readBlob(a.blob)})));}if(r.mode==='none'){if(!Array.isArray(r.body?.images)||r.body.images.length>3)throw new Error('cloudInvalid');r.body.images=await Promise.all(r.body.images.map(a=>readBlob(a.blob)));S.validatePayload(r.body);}else{if(C.unb64(r.body?.iv).length!==12||C.unb64(r.body?.data).length<16||C.unb64(r.titleBox?.iv).length!==12)throw new Error('cloudInvalid');if(r.mode==='secure'&&(C.unb64(r.salt).length!==16||C.unb64(r.wrap?.iv).length!==12))throw new Error('cloudInvalid');}return r;}
async function list(filePath){try{const p=await sdk(),items=await remote(()=>p.fs.readdir(filePath),'list');if(!Array.isArray(items))throw new Error('cloudInvalid');return items;}catch(e){if(missing(e))return [];throw e;}}
async function mapLimit(items,limit,task){
  const output=new Array(items.length);let next=0,failure;
  await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(!failure){const index=next++;if(index>=items.length)return;try{output[index]=await task(items[index],index);}catch(error){failure??=error;}}}));
  if(failure)throw failure;return output;
}
async function pushPending(ticket,owner){
    if(ticket!==session||owner!==user?.uuid||!ready)throw new Error('cloudAuth');
    for(const change of await S.rawAll('outbox')){
      if(ticket!==session||!ready)throw new Error('cloudAuth');
      const commit={format:'AtlasNoteChange',version:1,id:change.id,noteId:change.noteId,parents:change.parents,deleted:change.deleted,at:change.at,snapshot:change.deleted?null:await pack(change.record)};
      if(ticket!==session||!ready)throw new Error('cloudAuth');const filePath=path('notes/'+change.noteId+'/'+change.id+'.json'),p=await sdk();
      try{await remote(()=>p.fs.write(filePath,JSON.stringify(commit),{overwrite:false,createMissingParents:true}),'write');}
      catch(e){let existing;try{existing=await readJSON(filePath,6000);}catch{throw e;}if(JSON.stringify(existing)!==JSON.stringify(commit))throw new Error('cloudInvalid');}
      if(ticket!==session||owner!==user?.uuid)throw new Error('cloudAuth');
      S.memoryDelete('outbox',change.id);S.memoryPut('changes',commit);clearUsage();
    }
}
function accountLock(owner,run){
  const task=accountWork.catch(()=>{}).then(()=>navigator.locks?navigator.locks.request('atlas-cloud-sync-'+owner,run):run());
  accountWork=task;return task;
}
export async function flushPending(){
  if(pushTask)return pushTask;const ticket=session,owner=user?.uuid;
  const task=(async()=>{
    await authorize();if(ticket!==session||owner!==user?.uuid)throw new Error('cloudAuth');notify('syncing');
    await accountLock(owner,()=>pushPending(ticket,owner));
    if(ticket!==session||!ready||owner!==user?.uuid)throw new Error('cloudAuth');
    notify((await S.rawAll('conflicts')).length?'conflict':S.hasPending()?'pending':'synced');
  })().catch(error=>{if(ticket===session)notify(errorKey(error));throw error;}).finally(()=>{if(pushTask===task)pushTask=null;});
  pushTask=task;return task;
}
export function refresh(){
  if(!ready||document.hidden||syncTask||Date.now()-lastSyncAt<30000||Date.now()-lastRefreshAt<15000)return;
  lastRefreshAt=Date.now();void sync().catch(()=>{});
}
export async function sync(){
  if(syncTask)return syncTask;const ticket=session,owner=user?.uuid;let completed=false;
  syncTask=(async()=>{await authorize();notify('syncing');const run=async()=>{
    await pushPending(ticket,owner);
    const folders=(await list(path('notes'))).filter(folder=>ID.test(folder.name)&&(folder.is_dir||folder.isDir===true));
    const stagedChanges=new Map();
    // Read and validate the complete snapshot before publishing any remote changes.
    const staged=await mapLimit(folders,2,async folder=>{
      const files=(await list(path('notes/'+folder.name))).filter(file=>ID.test(file.name?.replace(/\.json$/,'')));
      const changes=await mapLimit(files,2,async file=>{
        const id=file.name.replace(/\.json$/,'');let c=await S.rawGet('changes',id);
        if(!c){c=await readJSON(path('notes/'+folder.name+'/'+file.name),6000);if(c.format!=='AtlasNoteChange'||c.version!==1||c.id!==id||c.noteId!==folder.name||!Array.isArray(c.parents)||c.parents.length>100||!c.parents.every(x=>ID.test(x))||typeof c.deleted!=='boolean'||(!c.deleted&&!HASH.test(c.snapshot))||!Number.isFinite(Date.parse(c.at)))throw new Error('cloudInvalid');stagedChanges.set(id,c);}return c;
      });
      const referenced=new Set(changes.flatMap(c=>c.parents)),heads=changes.filter(c=>!referenced.has(c.id));
      if(!heads.length&&changes.length)throw new Error('cloudInvalid');if(!heads.length)return null;
      const known=await S.rawGet('heads',folder.name),tips=heads.map(c=>c.id);
      if(JSON.stringify([...(known?.tips||[])].sort())===JSON.stringify([...tips].sort()))return null;
      if((await S.rawAll('outbox')).some(c=>c.noteId===folder.name))return null;
      const head=heads.length===1?heads[0]:heads.filter(c=>!c.deleted).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0];
      const record=head&&!head.deleted?await unpack(head.snapshot):null;if(record&&record.id!==folder.name)throw new Error('cloudInvalid');
      return {id:folder.name,tips,heads,record};
    });
    if(ticket!==session||owner!==user?.uuid||!ready)throw new Error('cloudAuth');
    const localNotes=new Map((await S.rawAll('notes')).map(note=>[note.id,note]));
    if(ticket!==session||owner!==user?.uuid||!ready)throw new Error('cloudAuth');
    for(const change of stagedChanges.values())S.memoryPut('changes',change);
    for(const result of staged){
      if(!result||S.hasPending(result.id))continue;
      const n=localNotes.get(result.id);
      if(result.record)S.memoryPut('notes',{...result.record,rev:(n?.rev||0)+1});else if(result.heads.length===1)S.memoryDelete('notes',result.id);
      S.memoryPut('heads',{id:result.id,tips:result.tips});
      if(result.heads.length>1)S.memoryPut('conflicts',{id:result.id,heads:result.heads});else S.memoryDelete('conflicts',result.id);
    }
    const conflicts=await S.rawAll('conflicts');completed=true;lastSyncAt=Date.now();clearUsage();notify(conflicts.length?'conflict':S.hasPending()?'pending':'synced');
    const ids=staged.filter(Boolean).map(result=>result.id);if(ids.length)window.dispatchEvent(new CustomEvent('atlas-notes-updated',{detail:{ids}}));
  };return await accountLock(owner,run);})()
    .catch(e=>{if(ticket===session)notify(errorKey(e));throw e;})
    .finally(()=>{syncTask=null;if(completed&&ready&&S.hasPending()){clearTimeout(timer);timer=setTimeout(()=>{if(ready)sync().catch(()=>{});},1000);}});
  return syncTask;
}
async function flushChange(id){
  const owner=user?.uuid;
  for(let attempt=0;attempt<3;attempt++){
    try{await flushPending();}catch(error){if(ready&&user?.uuid===owner&&!await S.rawGet('outbox',id))return;throw error;}
    if(!await S.rawGet('outbox',id))return;
  }
  throw new Error('cloudPending');
}
async function removeNote(id,expected){await authorize();const n=await S.rawGet('notes',id);if(!n||n.rev!==expected)throw new Error('conflict');const h=await S.rawGet('heads',id),change={id:crypto.randomUUID(),noteId:id,parents:h?.tips||[],deleted:true,at:new Date().toISOString()};S.memoryPut('outbox',change);S.memoryPut('heads',{id,tips:[change.id]});S.memoryDelete('notes',id);S.memoryDelete('conflicts',id);notify('syncing');await flushChange(change.id);}
export const conflicts=()=>S.rawAll('conflicts');
export async function conflictPreview(head){await authorize();return head.deleted?null:unpack(head.snapshot);}
export async function resolveConflict(id,chosen){await authorize();const conflict=await S.rawGet('conflicts',id);if(!conflict||!conflict.heads.some(h=>h.id===chosen))throw new Error('conflict');const head=conflict.heads.find(h=>h.id===chosen),record=await conflictPreview(head),n=await S.rawGet('notes',id),change={id:crypto.randomUUID(),noteId:id,parents:conflict.heads.map(h=>h.id),record,deleted:head.deleted,at:new Date().toISOString()};if(record)S.memoryPut('notes',{...record,rev:(n?.rev||0)+1});else S.memoryDelete('notes',id);S.memoryPut('outbox',change);S.memoryPut('heads',{id,tips:[change.id]});S.memoryDelete('conflicts',id);await flushChange(change.id);}
export async function usage(){
  await authorize();const ticket=session,owner=user.uuid,version=usageVersion;
  if(usageCache?.session===ticket&&Date.now()-usageCache.at<20000)return structuredClone(usageCache.value);
  if(usageFlight?.session===ticket)return usageFlight.task;
  const task=(async()=>{const p=await sdk(),[space,monthly]=await Promise.allSettled([remote(()=>p.fs.space(),'space'),remote(()=>p.auth.getMonthlyUsage(),'usage')]);
    if(ticket!==session||owner!==user?.uuid||!ready)throw new Error('cloudAuth');
    const value={space:space.status==='fulfilled'?space.value:null,monthly:monthly.status==='fulfilled'?monthly.value:null};
    if(version===usageVersion&&space.status==='fulfilled'&&monthly.status==='fulfilled')usageCache={session:ticket,at:Date.now(),value};return structuredClone(value);
  })().finally(()=>{if(usageFlight?.task===task)usageFlight=null;});
  usageFlight={session:ticket,task};return task;
}
export async function savePreferences(prefs){await authorize();const p=await sdk();await remote(()=>p.kv.set('atlasnote.preferences.v1',{theme:prefs.theme==='light'?'light':'dark',language:['en','zh-Hant','ja','leet'].includes(prefs.language)?prefs.language:null,history:[0,1,3,5,10,20].includes(prefs.history)?prefs.history:3,trashDays:[1,3,7,14,30].includes(prefs.trashDays)?prefs.trashDays:7}),'write');S.savePreferences(prefs);}
export async function preferences(){await authorize();const p=await sdk();let value=await remote(()=>p.kv.get('atlasnote.preferences.v1'),'kv');if(!value)value=await remote(()=>p.kv.get('atlasnote.retention.v1'),'kv');return value&&typeof value==='object'?S.savePreferences({...S.preferences(),...value}):S.preferences();}
export async function saveRetention(prefs){return savePreferences(prefs);}
export async function retention(){return preferences();}
export async function agent(messages,onChunk,signal){await authorize();signal.throwIfAborted();const p=await sdk(),models=await p.ai.listModels();signal.throwIfAborted();const candidate=models.find(m=>m.id==='openai/gpt-6-luna')||models.find(m=>m.id==='gpt-6-luna');if(!candidate)throw new Error('agentUnavailable');const result=await p.ai.chat(messages,{model:candidate.id,stream:true,max_tokens:12000,outputFormat:{type:'json_schema',schema:responseSchema,name:'atlas_note_edit',strict:true},signal});let text='';for await(const chunk of result){if(signal.aborted)throw new DOMException('Aborted','AbortError');if(chunk.type==='error')throw new Error('agentFailed');if(chunk.text){text+=chunk.text;onChunk(text.length);if(text.length>200000)throw new Error('agentInvalid');}}return text;}
window.addEventListener('offline',()=>{if(user)suspend('cloudOffline');});
window.addEventListener('focus',()=>{if(ready)authorize().then(refresh).catch(()=>{});});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&ready)authorize().catch(()=>{});});
setInterval(()=>{if(ready&&!document.hidden)authorize(true).then(refresh).catch(()=>{});},30000);
