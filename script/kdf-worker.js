/* Fixed, bounded KDF parameters: imported backups cannot choose their own cost. */
importScripts('/script/vendor/argon2.umd.min.js');
self.onmessage=async ({data})=>{
  try {
    const bytes=await hashwasm.argon2id({password:data.pin,salt:new Uint8Array(data.salt),parallelism:1,iterations:4,memorySize:98304,hashLength:32,outputType:'binary'});
    data.pin='';self.postMessage({bytes:bytes.buffer},[bytes.buffer]);
  }catch{self.postMessage({error:true});}
};
