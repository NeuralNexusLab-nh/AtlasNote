/* Test-only Puter contract double. Never served to visitors, never added to production code. */
export function fixture(){
 const files=new Map(),kv=new Map(),calls=[];let failWrites=false,failAuth=false,domainGranted=true,domainRequestGrant=true,aiReply={message:'Made the note clearer.',title:'A clearer note',text:'# Clearer\n\nA concise rewritten note.'};
 let spaceOverride=null,monthlyOverride=null;
 const owner='11111111-1111-4111-8111-111111111111';
 const failure=code=>{throw {code,status:code==='not_found'?404:code==='insufficient_funds'?402:code==='cloudAuth'?401:409};};
 async function attach(context,{signedIn=true,account=owner,authDelay=0,mainAppGranted=true,grantOnRequest=true}={}){
  domainGranted=mainAppGranted;domainRequestGrant=grantOnRequest;
  let identities=0;
  await context.exposeBinding('__puterCall',async(_,method,args)=>{
   calls.push({account,method,args});if(method==='getUser'){if(!identities++&&authDelay)await new Promise(r=>setTimeout(r,authDelay));if(failAuth)failure('cloudAuth');return {uuid:account,username:account===owner?'codex-test':'second-test',email_confirmed:true,is_temp:false};}
   if(method==='appsGet'){if(args[0]!=='AtlasNote')failure('not_found');return {uid:'test-atlasnote',name:'AtlasNote'};}
   if(method==='permsCheck'||method==='permsRequest'){const scopes=args[1]?.scopes;if(args[0]!=='appData'||scopes?.fs!=='write'||!Array.isArray(scopes?.kv)||!scopes.kv.includes('get')||!scopes.kv.includes('set')||scopes.kv.includes('del'))failure('invalid_argument');if(method==='permsCheck')return domainGranted;if(domainRequestGrant)domainGranted=true;return domainRequestGrant;}
   if(method==='space')return spaceOverride??{capacity:25_000_000,used:[...files.values()].filter(f=>f.owner===account).reduce((n,f)=>n+Buffer.byteLength(f.text),0)+1_000_000};
   if(method==='monthly')return monthlyOverride??{allowanceInfo:{monthUsageAllowance:1000,remaining:830},usage:{},appTotals:{}};
   const [path,data,options]=args,key=account+':'+path;
   if(method==='write'){if(failWrites)failure('insufficient_funds');if(files.has(key)&&options?.overwrite===false)failure('already_exists');files.set(key,{owner:account,path,text:typeof data==='string'?data:JSON.stringify(data)});return {name:path.split('/').pop(),path,is_dir:false};}
   if(method==='read'){if(!files.has(key))failure('not_found');return files.get(key).text;}
   if(method==='list'){const root=path.replace(/\/$/,'')+'/',items=new Map();for(const f of files.values()){if(f.owner!==account||!f.path.startsWith(root))continue;const rest=f.path.slice(root.length),name=rest.split('/')[0];items.set(name,{name,is_dir:rest.includes('/'),path:root+name});}if(!items.size)failure('not_found');return [...items.values()];}
   if(method==='delete'){for(const [id,f]of files)if(f.owner===account&&(f.path===path||options?.recursive&&f.path.startsWith(path+'/')))files.delete(id);return true;}
   if(method==='kvGet'||method==='kvSet'){const settings=method==='kvGet'?data:options,kvKey=account+':'+(settings?.appUuid||settings?.appId||'test-atlasnote')+':'+path;if(method==='kvGet')return kv.get(kvKey)??null;kv.set(kvKey,data);return true;}
   if(method==='ai')return typeof aiReply==='string'?aiReply:JSON.stringify(aiReply);
   throw new Error('Unknown test call '+method);
  });
  await context.addInitScript(({signedIn,username})=>{
   let authenticated=localStorage.getItem('fixture.auth')??String(signedIn);const call=(method,...args)=>window.__puterCall(method,args);
   const appID=location.hostname==='atlasnote.nxlabtw.com'?'test-atlasnote':'test-secondary-'+location.hostname.replace(/[^a-z0-9-]/g,'-');
   const filePath=path=>path.startsWith('/')?path:`/${username}/AppData/${appID}/${path}`;
   const kvOptions=options=>({...options,appUuid:options?.appUuid||appID});
   window.puter={appID,auth:{isSignedIn:()=>authenticated==='true',signIn:async()=>{authenticated='true';localStorage.setItem('fixture.auth','true');return {};},signOut:async()=>{authenticated='false';localStorage.setItem('fixture.auth','false');},getUser:()=>call('getUser'),getMonthlyUsage:()=>call('monthly')},apps:{get:name=>call('appsGet',name)},perms:{check:(resource,details)=>call('permsCheck',resource,details),request:(resource,details)=>call('permsRequest',resource,details)},fs:{write:(p,d,o)=>call('write',filePath(p),d,o),read:async p=>new Blob([await call('read',filePath(p))]),readdir:p=>call('list',filePath(p)),space:()=>call('space'),delete:(p,o)=>call('delete',filePath(p),null,o)},kv:{get:(key,options)=>call('kvGet',key,kvOptions(options)),set:(key,data,options)=>call('kvSet',key,data,kvOptions(options))},ai:{listModels:async()=>[{id:'openai/gpt-6-luna',provider:'openai'}],chat:async(messages,{signal})=>{const text=await call('ai',messages);return (async function*(){for(let i=0;i<text.length;i+=30){if(signal?.aborted)throw new DOMException('Aborted','AbortError');await new Promise(r=>setTimeout(r,5));yield {text:text.slice(i,i+30)};}})();}}};
  },{signedIn,username:account===owner?'codex-test':'second-test'});
 }
 return {attach,files,calls,owner,setPreferences:(prefs,account=owner)=>kv.set(account+':test-atlasnote:atlasnote.preferences.v1',prefs),setUsage:(space,monthly)=>{spaceOverride=space;monthlyOverride=monthly;},setFailWrites:v=>failWrites=v,setFailAuth:v=>failAuth=v,setAI:v=>aiReply=v,setDomainAccess:(granted,requestGranted=granted)=>{domainGranted=granted;domainRequestGrant=requestGranted;}};
}
