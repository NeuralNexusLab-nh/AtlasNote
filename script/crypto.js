/* Device encryption and AtlasEncrypt. Keep v1 AAD labels for existing-note compatibility. */
const enc = new TextEncoder(), dec = new TextDecoder('utf-8', { fatal: true });
let accountRoot=null,accountSelected=false;
// Account keys stay in memory. The original device key is never overwritten.
export function useAccountKey(bytes){accountSelected=true;accountRoot?.fill(0);accountRoot=bytes?new Uint8Array(bytes):null;}
export function hasRoot(){return accountSelected?!!accountRoot:!!localStorage.getItem('atlasnote.device-root.v1');}
export async function legacyKey(id,purpose='content'){const raw=unb64(localStorage.getItem('atlasnote.device-root.v1')||'');try{if(raw.length!==32)throw new Error('missingKey');return await derive(raw,id,purpose);}finally{raw.fill(0);}}
export const b64 = bytes => { let s=''; for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s); };
export const unb64 = s => {
  if(typeof s!=='string'||s.length>340_000_000||!s.length||s.length%4||/[^A-Za-z0-9+/=]/.test(s))throw new Error('invalidBackup');
  let raw;try{raw=atob(s);}catch{throw new Error('invalidBackup');}
  const bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes;
};
export const random = n => crypto.getRandomValues(new Uint8Array(n));
const aad = (id, purpose) => enc.encode(`AtlasEncrypt/v1\0${id}\0${purpose}`);
const importAES = bytes => crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt']);
async function derive(raw,id,purpose) {
  const root=await crypto.subtle.importKey('raw',raw,'HKDF',false,['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt:enc.encode('AtlasEncrypt/device/v1'),info:aad(id,purpose)},root,256));
}
export function deviceRoot(create=false) {
  if(accountRoot)return new Uint8Array(accountRoot);
  if(accountSelected)throw new Error('missingKey');
  let value=localStorage.getItem('atlasnote.device-root.v1');
  if(!value&&create){ value=b64(random(32));localStorage.setItem('atlasnote.device-root.v1',value); }
  if(!value)throw new Error('missingKey');
  const bytes=unb64(value);if(bytes.length!==32)throw new Error('missingKey');return bytes;
}
export async function deviceKey(id,purpose='content',create=false) {
  const use=async()=>{const raw=deviceRoot(create);try{return await derive(raw,id,purpose);}finally{raw.fill(0);}};
  if(create){if(!navigator.locks)throw new Error('cryptoError');return navigator.locks.request('atlasnote-device-root-v1',use);}
  return use();
}
export async function seal(key,id,purpose,data) {
  const iv=random(12);const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(id,purpose),tagLength:128},await importAES(key),enc.encode(JSON.stringify(data)));
  return {iv:b64(iv),data:b64(new Uint8Array(ciphertext))};
}
export async function open(key,id,purpose,box) {
  if(!box||typeof box!=='object')throw new Error('invalidBackup');
  const iv=unb64(box.iv),bytes=unb64(box.data);if(iv.length!==12||bytes.length<16)throw new Error('invalidBackup');
  return JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad(id,purpose),tagLength:128},await importAES(key),bytes)));
}
export function validatePIN(pin){return typeof pin==='string'&&/^[\x20-\x7e]{4,16}$/.test(pin);}
export function pinKey(pin,salt,id) {
  if(!validatePIN(pin))return Promise.reject(new Error('pinRules'));
  return new Promise((resolve,reject)=>{
    const worker=new Worker('/script/kdf-worker.js');
    const timer=setTimeout(()=>{worker.terminate();reject(new Error('cryptoError'));},60_000);
    worker.onmessage=async e=>{clearTimeout(timer);worker.terminate();if(e.data.error){reject(new Error('cryptoError'));return;}const raw=new Uint8Array(e.data.bytes);try{resolve(await derive(raw,id,'vault-wrap'));}catch(error){reject(error);}finally{raw.fill(0);}};
    worker.onerror=()=>{clearTimeout(timer);worker.terminate();reject(new Error('cryptoError'));};
    worker.postMessage({pin,salt:unb64(salt)});
  });
}
export async function createVault(id,pin){const key=random(32),salt=b64(random(16)),wrapping=await pinKey(pin,salt,id);try{return {key,salt,wrap:await seal(wrapping,id,'wrapped-key',b64(key))};}finally{wrapping.fill(0);}}
export async function unlockVault(note,pin){const salt=unb64(note.salt);if(salt.length!==16)throw new Error('invalidBackup');const wrapping=await pinKey(pin,note.salt,note.id);try{const raw=unb64(await open(wrapping,note.id,'wrapped-key',note.wrap));if(raw.length!==32)throw new Error('invalidBackup');return raw;}finally{wrapping.fill(0);}}
export async function protectTitle(id,title,create=false){const key=await deviceKey(id,'title',create);try{return await seal(key,id,'title',title);}finally{key.fill(0);}}
export async function readTitle(note){if(note.mode==='none')return note.body.title;try{const key=await deviceKey(note.id,'title');try{return await open(key,note.id,'title',note.titleBox);}finally{key.fill(0);}}catch{return null;}}
