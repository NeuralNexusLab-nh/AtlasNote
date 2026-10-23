/* Retired local-only data: exact targets, never account caches or upload queues. */
const DATABASE='atlasnote-v1',KEY='atlasnote.device-root.v1';
export async function clearLegacy({onBlocked=()=>{}}={}){
  const run=async()=>{
    // Remove the old secret even if another old tab delays database deletion.
    let keyError;
    const removeKey=()=>{try{localStorage.removeItem(KEY);keyError=null;}catch(error){keyError=error;}};
    removeKey();
    await new Promise((resolve,reject)=>{
      // Deleting an absent database succeeds without creating it. No enumeration needed.
      const request=indexedDB.deleteDatabase(DATABASE);
      request.onsuccess=resolve;
      request.onerror=()=>reject(new Error('storageError'));
      // Keep deletion queued until old connections close; never block app startup.
      request.onblocked=()=>onBlocked();
    });
    // An old tab may have written its key again while deletion was waiting.
    removeKey();if(keyError)throw keyError;
  };
  // IDB serializes deletes itself. Never hold the account-encryption lock here.
  return run();
}
