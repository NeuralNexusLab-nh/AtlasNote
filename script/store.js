import * as C from './crypto.js';
let DB='atlasnote-locked',dbPromise,backend={authorize:async()=>{throw new Error('cloudAuth');}};
export function configureAccount(id,adapter){if(!/^[a-zA-Z0-9-]{1,100}$/.test(id))throw new Error('cloudAuth');DB='atlasnote-cloud-'+id;dbPromise=null;backend=adapter;}
export function detachAccount(){backend={authorize:async()=>{throw new Error('cloudAuth');}};dbPromise=null;DB='atlasnote-locked';C.useAccountKey(null);}
async function authorize(){if(backend)await backend.authorize();}
function storageFailure(error){return new Error(error?.name==='QuotaExceededError'?'storageFull':['SecurityError','NotAllowedError'].includes(error?.name)?'storageDisabled':'storageError',{cause:error});}
export const LIMITS={text:1_000_000,images:3,image:16_000_000,sourceImage:100_000_000,dimension:8192,pixels:67_108_864};
export const uuid=()=>crypto.randomUUID();
export const bytes=value=>new TextEncoder().encode(JSON.stringify(value)).length;
export function database(){
  if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{const req=indexedDB.open(DB,3);req.onupgradeneeded=()=>{for(const name of ['notes','outbox','heads','conflicts','changes'])if(!req.result.objectStoreNames.contains(name))req.result.createObjectStore(name,{keyPath:'id'});};req.onsuccess=()=>{req.result.onversionchange=()=>{req.result.close();dbPromise=null;};resolve(req.result);};req.onerror=()=>{dbPromise=null;reject(storageFailure(req.error));};req.onblocked=()=>reject(new Error('storageBlocked'));});
  return dbPromise;
}
export async function all(){await authorize();return rawAll('notes');}
export async function get(id){await authorize();return rawGet('notes',id);}
export async function rawAll(name){const db=await database();return new Promise((resolve,reject)=>{const req=db.transaction(name).objectStore(name).getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(storageFailure(req.error));});}
export async function rawGet(name,id){const db=await database();return new Promise((resolve,reject)=>{const req=db.transaction(name).objectStore(name).get(id);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(storageFailure(req.error));});}
export async function atomic(stores,fn){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction(stores,'readwrite');fn(tx);tx.oncomplete=resolve;tx.onabort=()=>reject(storageFailure(tx.error));tx.onerror=()=>{};});}
export async function put(record,expected=0){
  await authorize();const change=backend?await backend.prepare(record):null;
  const db=await database();return new Promise((resolve,reject)=>{
    const tx=db.transaction(change?['notes','outbox','heads','conflicts']:['notes'],'readwrite'),store=tx.objectStore('notes');let conflict=false;
    const req=store.get(record.id);req.onsuccess=()=>{if((req.result?.rev||0)!==expected){conflict=true;tx.abort();return;}const save=()=>{store.put({...record,rev:expected+1});if(change){tx.objectStore('outbox').put(change);tx.objectStore('heads').put({id:record.id,tips:[change.id]});}};if(change){const c=tx.objectStore('conflicts').get(record.id);c.onsuccess=()=>{if(c.result){conflict=true;tx.abort();}else{const h=tx.objectStore('heads').get(record.id);h.onsuccess=()=>{change.parents=h.result?.tips||[];save();};}};}else save();};
    tx.oncomplete=()=>{backend?.changed();resolve({...record,rev:expected+1});};tx.onabort=()=>reject(conflict?new Error('conflict'):storageFailure(tx.error));tx.onerror=()=>{};
  });
}
export async function remove(id,expected){await authorize();if(backend)return backend.remove(id,expected);const db=await database();return new Promise((resolve,reject)=>{let conflict=false;const tx=db.transaction('notes','readwrite'),store=tx.objectStore('notes');const req=store.get(id);req.onsuccess=()=>{if(!req.result||req.result.rev!==expected){conflict=true;tx.abort();return;}store.delete(id);};tx.oncomplete=resolve;tx.onabort=()=>reject(conflict?new Error('conflict'):storageFailure(tx.error));tx.onerror=()=>{};});}
export async function updateMeta(id,change){const note=await get(id);if(!note)throw new Error('notFound');return put({...note,...change},note.rev);}
export async function cleanup(){for(const n of await all())if(n.trashedAt&&Date.parse(n.trashedAt)+n.trashDays*86400000<Date.now())await remove(n.id,n.rev).catch(()=>{});}
export function preferences(){try{const p=JSON.parse(localStorage.getItem('atlasnote.preferences')||'{}');return {theme:p.theme==='light'?'light':'dark',language:['en','zh-Hant','ja','leet'].includes(p.language)?p.language:null,history:[0,1,3,5,10,20].includes(p.history)?p.history:3,trashDays:[1,3,7,14,30].includes(p.trashDays)?p.trashDays:7};}catch{return {theme:'dark',language:null,history:3,trashDays:7};}}
export function savePreferences(p){localStorage.setItem('atlasnote.preferences',JSON.stringify(p));}
export function patch(current,previous){let a=0,b=0;while(a<current.length&&a<previous.length&&current[a]===previous[a])a++;while(b<current.length-a&&b<previous.length-a&&current[current.length-b-1]===previous[previous.length-b-1])b++;return [a,current.length-a-b,previous.slice(a,previous.length-b)];}
export function apply(text,p){if(!Array.isArray(p)||p.length!==3||!Number.isInteger(p[0])||!Number.isInteger(p[1])||p[0]<0||p[1]<0||p[0]+p[1]>text.length||typeof p[2]!=='string'||p[2].length>LIMITS.text)throw new Error('invalidData');const result=text.slice(0,p[0])+p[2]+text.slice(p[0]+p[1]);if(result.length>LIMITS.text)throw new Error('invalidData');return result;}
export function validatePayload(p){
  if(!p||typeof p!=='object'||typeof p.title!=='string'||p.title.length<1||p.title.length>80||typeof p.text!=='string'||p.text.length>LIMITS.text||!Array.isArray(p.images)||p.images.length>LIMITS.images||!Array.isArray(p.history)||p.history.length>20)throw new Error('invalidData');
  const ids=new Set();
  for(const i of p.images){if(!i||!/^img_[a-f0-9]{12}$/.test(i.id)||ids.has(i.id)||!['image/webp','image/png','image/jpeg'].includes(i.type)||typeof i.data!=='string'||i.data.length>Math.ceil(LIMITS.image/3)*4||typeof i.caption!=='string'||i.caption.length>400||!Number.isInteger(i.width)||!Number.isInteger(i.height)||i.width<1||i.height<1||i.width>LIMITS.dimension||i.height>LIMITS.dimension||i.width*i.height>LIMITS.pixels)throw new Error('invalidData');const data=C.unb64(i.data),dimensions=imageDimensions(data,i.type);if(data.length>LIMITS.image||!dimensions||dimensions.width!==i.width||dimensions.height!==i.height)throw new Error('invalidData');ids.add(i.id);}
  let text=p.text,title=p.title;
  for(const h of p.history){if(!h||!Number.isFinite(Date.parse(h.at)))throw new Error('invalidData');text=apply(text,h.text);title=apply(title,h.title);if(title.length>80)throw new Error('invalidData');}
  // Whitelist fields so parsed JSON cannot inject settings, paths or prototype properties.
  return {title:p.title,text:p.text,images:p.images.map(i=>({id:i.id,type:i.type,data:i.data,caption:i.caption,width:i.width,height:i.height})),history:p.history.map(h=>({at:h.at,text:h.text,title:h.title}))};
}
export function magic(b,type){return type==='image/png'?b.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v):type==='image/jpeg'?b[0]===255&&b[1]===216&&b[2]===255:type==='image/webp'&&new TextDecoder().decode(b.slice(0,4))==='RIFF'&&new TextDecoder().decode(b.slice(8,12))==='WEBP';}
export function imageDimensions(b,type){
  if(!magic(b,type))return null;
  const view=new DataView(b.buffer,b.byteOffset,b.byteLength);
  if(type==='image/png'&&b.length>=24)return {width:view.getUint32(16),height:view.getUint32(20)};
  if(type==='image/webp'&&b.length>=30){const tag=new TextDecoder().decode(b.slice(12,16));if(tag==='VP8X')return {width:1+b[24]+(b[25]<<8)+(b[26]<<16),height:1+b[27]+(b[28]<<8)+(b[29]<<16)};if(tag==='VP8 ')return {width:view.getUint16(26,true)&16383,height:view.getUint16(28,true)&16383};if(tag==='VP8L'&&b[20]===47){const bits=view.getUint32(21,true);return {width:1+(bits&16383),height:1+((bits>>>14)&16383)};}}
  if(type==='image/jpeg'){let at=2;while(at+9<b.length){if(b[at++]!==255)return null;while(at<b.length&&b[at]===255)at++;const marker=b[at++];if(marker===217||marker===218)return null;if(marker===1||(marker>=208&&marker<=215))continue;if(at+2>b.length)return null;const length=view.getUint16(at);if(length<2||at+length>b.length)return null;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker))return {width:view.getUint16(at+5),height:view.getUint16(at+3)};at+=length;}}
  return null;
}
export async function decodeRecord(note,key=null){if(note.mode==='none')return validatePayload(note.body);if(note.mode==='basic')key=await C.deviceKey(note.id);if(!key)throw new Error('locked');try{const payload=await C.open(key,note.id,'content',note.body);if(note.attachments)payload.images=await Promise.all(note.attachments.map(a=>C.open(key,note.id,'image:'+a.id,a.box)));return validatePayload(payload);}finally{if(note.mode==='basic')key.fill(0);}}
export async function encodeRecord(note,payload,key=null){
  if(note.mode!=='none'&&!C.hasRoot()&&(await all()).some(n=>n.mode!=='none'))throw new Error('missingKey');
  payload=validatePayload(payload);let body,titleBox=null,attachments;
  if(note.mode==='none')body=payload;else{const actual=note.mode==='basic'?await C.deviceKey(note.id,'content',true):key;if(!actual)throw new Error('locked');try{attachments=await Promise.all(payload.images.map(async image=>{const hash=C.b64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(image))))),old=note.attachments?.find(a=>a.id===image.id&&a.hash===hash);return old||{id:image.id,hash,box:await C.seal(actual,note.id,'image:'+image.id,image)};}));body=await C.seal(actual,note.id,'content',{...payload,images:[]});titleBox=await C.protectTitle(note.id,payload.title,true);}finally{if(note.mode==='basic')actual.fill(0);}}
  const record={...note,body,titleBox};if(attachments)record.attachments=attachments;record.size=bytes(record);return record;
}
export async function saveNote(note,payload,key,previous=null){
  const limit=preferences().history;
  payload={...payload,history:previous?[...previous.history]:[]};
  if(previous&&(previous.title!==payload.title||previous.text!==payload.text))payload.history.unshift({at:note.updatedAt,title:patch(payload.title,previous.title),text:patch(payload.text,previous.text)});
  payload.history=payload.history.slice(0,limit);
  const now=new Date().toISOString();return put(await encodeRecord({...note,createdAt:note.createdAt||now,updatedAt:now},payload,key),note.rev||0);
}
