/* Remove AtlasNote-managed persistent browser data only. Never migrate it. */
const LOCAL_PREFIXES=['atlasnote.','atlasnote-'];
const DATABASE=/^atlasnote-(?:cloud-[A-Za-z0-9-]{1,100}|locked|v1)$/;

function removeMatching(storage,prefixes){
  for(let i=storage.length-1;i>=0;i--){const key=storage.key(i);if(key&&prefixes.some(prefix=>key.startsWith(prefix)))storage.removeItem(key);}
}
function deleteDatabase(name,onBlocked){return new Promise((resolve,reject)=>{
  const request=indexedDB.deleteDatabase(name);let blocked=false;request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error||new Error('storageError'));request.onblocked=()=>{blocked=true;onBlocked();};
  // A blocked deletion remains queued and completes once old tabs close.
  void blocked;
});}
async function clearOwnCaches(){
  if('caches'in globalThis)for(const name of await caches.keys())if(name.startsWith('atlasnote-shell-'))await caches.delete(name);
  if('serviceWorker'in navigator){const registrations=await navigator.serviceWorker.getRegistrations();for(const registration of registrations){const scripts=[registration.active,registration.waiting,registration.installing].filter(Boolean).map(worker=>new URL(worker.scriptURL));if(scripts.some(url=>url.origin===location.origin&&url.pathname==='/sw.js'))await registration.unregister();}}
}
export async function clearLegacy({onBlocked=()=>{}}={}){
  let knownAccounts=[];try{knownAccounts=Object.keys(localStorage).map(key=>key.match(/^atlasnote\.cloud-key-check\.([A-Za-z0-9-]{1,100})$/)?.[1]).filter(Boolean);}catch{}
  try{removeMatching(localStorage,LOCAL_PREFIXES);}catch(error){throw new Error('storageError',{cause:error});}
  let names=[];
  try{names=(await indexedDB.databases()).map(db=>db.name).filter(name=>name&&DATABASE.test(name));}
  catch{names=['atlasnote-v1','atlasnote-locked',...knownAccounts.map(id=>`atlasnote-cloud-${id}`)];}
  await Promise.all(names.map(name=>deleteDatabase(name,onBlocked)));
  await clearOwnCaches();
}
