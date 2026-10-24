import {auditCloud,errorKey} from './cloud-audit.js';
import {isMainSite,MAIN_ORIGIN,mainSiteURL} from './site-origin.js';
import {setLanguage,t,preferredLanguage} from './i18n.js';
setLanguage(preferredLanguage());
const word=key=>t('audit_'+key);
const main=document.querySelector('#main');
if(!isMainSite()){
 window.location.replace(mainSiteURL());
}else{
 document.title=word('title')+' — AtlasNote';
 const brand=document.createElement('p');brand.className='eyebrow';brand.textContent='AtlasNote';
 const title=document.createElement('h1');title.textContent=word('title');
 const intro=document.createElement('p');intro.textContent=word('intro');
 const start=document.createElement('button');start.type='button';start.className='button primary';start.textContent=word('start');
 const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const result=document.createElement('section');result.className='card cloud-check-result';result.hidden=true;
 const back=document.createElement('a');back.href=MAIN_ORIGIN;back.className='button ghost';back.textContent=word('back');
 main.append(brand,title,intro,start,status,result,back);
 start.addEventListener('click',async()=>{
  start.disabled=true;start.textContent=word('working');result.hidden=true;result.replaceChildren();status.textContent=word('working');
  try{
   const report=await auditCloud((done,total)=>{status.textContent=word('working')+' '+done+' / '+total;});
   const stats=document.createElement('dl');
   for(const [label,value]of [['root',word(report.rootPresent?'found':'absent')],['key',word(report.accountFilePresent?'found':'absent')],...['noteDirectories','blobFiles','active','deleted','conflicts','empty'].map(key=>[key,report[key]])]){
    const term=document.createElement('dt'),detail=document.createElement('dd');term.textContent=word(label);detail.textContent=String(value);stats.append(term,detail);
   }
   result.append(stats);
   for(const entry of report.entries){const row=document.createElement('p'),id=document.createElement('code'),detail=document.createElement('span');id.textContent=entry.noteId;detail.textContent=word(entry.state)+' · '+entry.records+' '+word('records')+' · '+entry.deletionRecords+' '+word('deletionRecords');row.append(id,detail);result.append(row);}
   result.hidden=false;status.textContent=word('complete');
  }catch(error){status.textContent=word('failed')+' '+t(errorKey(error));}
  finally{start.disabled=false;start.textContent=word('start');}
 });
}
