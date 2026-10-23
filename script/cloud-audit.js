// Incident diagnostics only: no connect(), key access, cleanup, write or delete.
import {sdk,errorKey} from './cloud.js';
import {requests} from './cloud-requests.js';
import {assertMainSite} from './site-origin.js';
const ROOT='atlasnote-v1',ID=/^[a-f0-9-]{36}$/;
function missing(e){return e?.status===404||e?.error?.status===404||['ENOENT','not_found','subject_does_not_exist'].includes(e?.code||e?.error?.code);}
export async function auditCloud(onProgress=()=>{}){
  assertMainSite();const p=await sdk();if(!p.auth.isSignedIn())throw new Error('cloudAuth');
  const token=p.authToken,user=await requests.run(()=>p.auth.getUser(),'auth');
  if(!user?.uuid||user.is_temp)throw new Error('cloudAuth');
  const read=work=>requests.run(()=>{if(!p.auth.isSignedIn()||token!==p.authToken)throw new Error('cloudAuth');return work();});
  async function list(path){try{const values=await requests.run(()=>{if(!p.auth.isSignedIn()||token!==p.authToken)throw new Error('cloudAuth');return p.fs.readdir(path);},'list');if(!Array.isArray(values))throw new Error('cloudInvalid');return values;}catch(e){if(missing(e))return null;throw e;}}
  const root=await list(ROOT);
  const report={format:'AtlasNoteReadOnlyAudit',version:1,checkedAt:new Date().toISOString(),rootPresent:root!==null,accountFilePresent:!!root?.some(f=>f.name==='account.json'),noteDirectories:0,blobFiles:0,active:0,deleted:0,conflicts:0,empty:0,entries:[]};
  if(root===null)return report;
  const folders=(await list(ROOT+'/notes')||[]).filter(f=>ID.test(f.name)&&(f.is_dir||f.isDir===true));report.noteDirectories=folders.length;
  report.blobFiles=(await list(ROOT+'/blobs')||[]).filter(f=>/^[a-f0-9]{64}\.json$/.test(f.name)).length;
  for(const folder of folders){
    const files=(await list(ROOT+'/notes/'+folder.name)||[]).filter(f=>ID.test(f.name.replace(/\.json$/,''))),changes=[];
    for(const file of files){
      const blob=await read(()=>p.fs.read(ROOT+'/notes/'+folder.name+'/'+file.name));if(!blob||blob.size>6000)throw new Error('cloudInvalid');
      let value;try{value=JSON.parse(await blob.text());}catch{throw new Error('cloudInvalid');}
      if(value.format!=='AtlasNoteChange'||value.version!==1||value.noteId!==folder.name||value.id!==file.name.replace(/\.json$/,'')||typeof value.deleted!=='boolean'||!Array.isArray(value.parents)||!value.parents.every(id=>ID.test(id)))throw new Error('cloudInvalid');
      changes.push({id:value.id,parents:value.parents,deleted:value.deleted});
    }
    const ancestors=new Set(changes.flatMap(c=>c.parents)),heads=changes.filter(c=>!ancestors.has(c.id));
    if(changes.length&&!heads.length)throw new Error('cloudInvalid');
    const state=heads.length>1?'conflicts':heads.length?(heads[0].deleted?'deleted':'active'):'empty';report[state]++;
    report.entries.push({noteId:folder.name,records:changes.length,state,deletionRecords:changes.filter(c=>c.deleted).length});
    onProgress(report.entries.length,folders.length);
  }
  // Never return keys, content, ciphertext, provider tokens or user identity.
  return report;
}
export {errorKey};
