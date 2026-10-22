/* AstraNote-style tab cache: content keys only; never PINs or plaintext. */
import {b64,unb64} from './crypto.js';
const PREFIX='atlasnote.unlock.v1:',SESSION='atlasnote.unlock-session.v1';
let owner='',scope='';const memory=new Map();
export function forgetAll(){for(const value of memory.values())value.fill(0);memory.clear();try{for(const k of Object.keys(sessionStorage))if(k.startsWith(PREFIX))sessionStorage.removeItem(k);sessionStorage.removeItem(SESSION);}catch{}owner='';scope='';}
export async function beginSession(id,token){
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token||'puter-session')))].map(v=>v.toString(16).padStart(2,'0')).join('');
 let prior;try{prior=JSON.parse(sessionStorage.getItem(SESSION)||'null');}catch{}
 if(prior?.owner!==id||prior?.fingerprint!==hash){forgetAll();prior={owner:id,fingerprint:hash,scope:crypto.randomUUID()};try{sessionStorage.setItem(SESSION,JSON.stringify(prior));}catch{}}
 owner=id;scope=prior.scope;
}
async function cacheId(note){if(!owner||!scope||note.mode!=='secure')return null;const fingerprint=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([note.salt,note.wrap]))))].map(v=>v.toString(16).padStart(2,'0')).join('');return `${PREFIX}${owner}:${scope}:${note.id}:${fingerprint}`;}
export async function remember(note,key){const id=await cacheId(note);if(!id||!(key instanceof Uint8Array)||key.length!==32)return;memory.get(id)?.fill(0);memory.set(id,new Uint8Array(key));try{sessionStorage.setItem(id,b64(key));}catch{}}
export async function cached(note){const id=await cacheId(note);if(!id)return null;if(memory.has(id))return new Uint8Array(memory.get(id));try{const raw=sessionStorage.getItem(id);if(!raw)return null;const bytes=unb64(raw);if(bytes.length!==32){sessionStorage.removeItem(id);return null;}memory.set(id,new Uint8Array(bytes));return bytes;}catch{return null;}}
export async function forget(note){const id=await cacheId(note);if(!id)return;memory.get(id)?.fill(0);memory.delete(id);try{sessionStorage.removeItem(id);}catch{}}
