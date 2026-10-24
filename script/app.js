import * as S from './store.js';
import * as C from './crypto.js';
import {t,setLanguage,getLanguage,preferredLanguage,date,compactDate,localized as L} from './i18n.js';
import {docsContent,docKeys,docTitle,policy} from './docs.js';
import {startMeteors} from './meteors.js';
import {requestInstall,refreshInstallButtons} from './install.js';
import {compressImage} from './images.js';
import * as Cloud from './cloud.js';
import * as CloudUI from './cloud-ui.js';
import * as Unlock from './unlock-cache.js';
import {homeDetails} from './home-content.js';
import {clearLegacy} from './legacy-storage.js';
import {isMainSite,mainSiteURL} from './site-origin.js';
import {notePreview} from './note-preview.js';
import {createRouter} from './router.js';

const $=(s,root=document)=>root.querySelector(s),$$=(s,root=document)=>[...root.querySelectorAll(s)];
export const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=name=>`<i class="fa-solid fa-${name==='sparkles'?'wand-magic-sparkles':name}" aria-hidden="true"></i>`;
const button=(label,ico,attrs='',cls='')=>`<button type="button" class="button ${cls}" aria-label="${escape(t(label))}" ${attrs}>${icon(ico)}<span>${t(label)}</span></button>`;
const iconButton=(label,ico,attrs='',cls='')=>`<button type="button" class="icon-btn ${cls}" title="${t(label)}" aria-label="${t(label)}" ${attrs}>${icon(ico)}</button>`;
const linkButton=(label,ico,url,cls='')=>`<a href="${url}" class="button ${cls}" aria-label="${escape(t(label))}">${icon(ico)}<span class="compact-label">${t(label)}</span></a>`;
const main=$('#main');
let prefs=S.preferences(),currentPage='',renderId=0,allNotes=[],selection=new Set(),query='',filter='all',filterOpen=false,editorDirty=false,previewing=false,opened=null,editor=null,pausedDraft=null,cloudBoot=Promise.resolve(null);
let router=null,renderQueue=Promise.resolve(),rendering=false,viewRefresh=null;
const privatePages=['dashboard','notes','trash','note','edit','settings'];
const navigate=(url,options)=>router?router.navigate(url,options):Promise.resolve(false);
setLanguage(prefs.language||preferredLanguage());
const md=window.markdownit({html:false,linkify:true,typographer:false});
// Never load Markdown-supplied remote images. Only validated local attachments render.
md.renderer.rules.image=(tokens,index)=>escape(tokens[index].content);
const linkOpen=md.renderer.rules.link_open||((tokens,idx,options,env,self)=>self.renderToken(tokens,idx,options));
md.renderer.rules.link_open=(tokens,idx,options,env,self)=>{tokens[idx].attrSet('rel','noopener noreferrer');return linkOpen(tokens,idx,options,env,self);};
const size=n=>{if(n<1000)return `${Math.round(n)} B`;if(n<1e6)return `${(n/1000).toFixed(n<10000?2:1)} KB`;if(n<1e9)return `${(n/1e6).toFixed(2)} MB`;return `${(n/1e9).toFixed(2)} GB`;};
const showLive=message=>{$('#live').textContent=message;};
function route(){const p=location.pathname.split('/').filter(Boolean).pop()?.replace(/\.html$/,'')||'index';return p==='index'?'home':['dashboard','notes','trash','settings','docs','privacy','terms','note','edit','new'].includes(p)?(p==='new'?'edit':p):'404';}
function newId(){return new URLSearchParams(location.search).get('id');}
function noteURL(id){return `/note.html?id=${encodeURIComponent(id)}`;}
const routeAddress=()=>location.pathname+location.search;
function viewGuard(){const token=renderId,url=routeAddress();return ()=>token===renderId&&url===routeAddress();}

function dialog({title,body='',confirm='gotIt',cancel=false,danger=false,form=false,wide=false,className='',onSubmit=null,onOpen=null}){
  return new Promise(resolve=>{
    const el=document.createElement('dialog');el.className=[wide?'draw-dialog':'',className].filter(Boolean).join(' ');
    el.setAttribute('aria-labelledby','dialog-title');
    el.innerHTML=`<div class="dialog-body"><h2 id="dialog-title">${escape(title)}</h2>${body}</div><div class="dialog-actions">${cancel?button('cancel','xmark','data-cancel','ghost'):''}${button(confirm,danger?'trash-can':form?'unlock-keyhole':'check','data-confirm',danger?'danger':'primary')}</div>`;
    $('#dialog-root').append(el);let settled=false,submitting=false;
    const finish=value=>{if(settled)return;settled=true;el.close();el.remove();resolve(value);};
    $('[data-cancel]',el)?.addEventListener('click',()=>{if(!submitting)finish(null);});
    el.addEventListener('atlas-dismiss',()=>finish(null),{once:true});
    el.addEventListener('cancel',e=>{e.preventDefault();if(submitting)return;if(cancel)finish(null);else if(!onSubmit)finish(true);});
    // Backdrop clicks intentionally do not dismiss dialogs.
    $('[data-confirm]',el).addEventListener('click',async()=>{
      if(submitting)return;const btn=$('[data-confirm]',el),cancelButton=$('[data-cancel]',el),original=btn.innerHTML;
      if(onSubmit){
        submitting=true;btn.disabled=true;if(cancelButton)cancelButton.disabled=true;el.setAttribute('aria-busy','true');
        btn.innerHTML=`<span class="spinner" aria-hidden="true"></span><span>${t('processing')}</span>`;
        try{const value=await onSubmit(el);if(value!==false)finish(value??true);}
        catch(e){let err=$('.dialog-error',el);if(!err){err=document.createElement('p');err.className='dialog-error';err.setAttribute('role','alert');$('.dialog-body',el).append(err);}const errorKey=e.name==='OperationError'?'unlockError':e.message,translated=t(errorKey);err.textContent=translated&&translated!==errorKey?translated:t(Cloud.errorKey(e));err.scrollIntoView({block:'nearest'});}
        finally{submitting=false;btn.disabled=false;btn.innerHTML=original;if(cancelButton)cancelButton.disabled=false;el.removeAttribute('aria-busy');}
      }else finish(true);
    });
    el.showModal();onOpen?.(el);setTimeout(()=>{if(el.isConnected)$('.input',el)?.focus({preventScroll:true});},50);
    if(form)el.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('input')){e.preventDefault();$('[data-confirm]',el).click();}});
  });
}
async function alertMessage(message,title=t('error')){return dialog({title,body:`<p>${escape(message)}</p>`});}
async function fail(error){console.error('[AtlasNote]',error.name,error.message);const key=error.name==='QuotaExceededError'?'storageFull':error.name==='SecurityError'?'storageDisabled':['unexpectedError','storageFull','storageDisabled','storageError','storageBlocked','missingKey','conflict','notFound','pinRules','invalidData','invalidImage','imageLimit','limitError','cryptoError','copyFailed'].includes(error.message)?error.message:error.name==='OperationError'?'unlockError':Cloud.errorKey(error);return alertMessage(t(key));}
function bind(el,event,fn){el?.addEventListener(event,async e=>{try{await fn(e);}catch(error){await fail(error);}});}
async function copyText(text){
  try{await navigator.clipboard.writeText(text);}catch{
    const previous=document.activeElement,area=document.createElement('textarea');area.value=text;area.className='sr-only';area.readOnly=true;document.body.append(area);
    try{area.focus({preventScroll:true});area.select();if(!document.execCommand('copy'))throw new Error('copyFailed');}
    catch{throw new Error('copyFailed');}
    finally{area.remove();if(previous?.isConnected)previous.focus({preventScroll:true});}
  }
  showLive(t('copied'));
}

function chrome(){
  $('#navbar').classList.remove('open');
  const nav=(Cloud.signedIn()?[['home','house','/'],['dashboard','table-columns','/dashboard.html'],['notes','book-open','/notes.html'],['trash','trash-can','/trash.html'],['docs','book','/docs.html'],['settings','sliders','/settings.html']]:[['home','house','/'],['docs','book','/docs.html']]);
  $('#navbar').innerHTML=`<a class="brand" href="/" aria-label="AtlasNote"><img src="/asset/logo.svg" alt="" width="31" height="31"><span>AtlasNote</span></a><nav class="nav-links" aria-label="${t('home')}">${nav.map(([key,ico,url])=>`<a class="nav-link ${currentPage===key||key==='notes'&&['note','edit'].includes(currentPage)?'active':''}" href="${url}" ${currentPage===key?'aria-current="page"':''}>${icon(ico)}<span>${t(key)}</span></a>`).join('')}</nav><div class="nav-actions"><select class="language-select" aria-label="${t('language')}" id="language"><option value="en">English</option><option value="zh-Hant">繁體中文</option><option value="ja">日本語</option><option value="leet">l33t</option></select>${Cloud.signedIn()?button('logout','right-from-bracket','data-nav-signout','nav-auth'):linkButton('login','right-to-bracket','/dashboard.html','primary nav-auth')}${iconButton('filter','bars','data-menu aria-expanded="false"','mobile-toggle')}</div>`;
  $('#language').value=getLanguage();
  const syncBadge=document.createElement('button');syncBadge.type='button';syncBadge.className='sync-badge';syncBadge.dataset.cloudStatus='';syncBadge.hidden=!Cloud.signedIn();$('.nav-actions').prepend(syncBadge);updateCloudStatus();bind(syncBadge,'click',async()=>{if(!Cloud.profile()){await navigate('/dashboard.html');return;}if(Cloud.status()==='conflict')return CloudUI.conflictManager();await Cloud.sync();if(['dashboard','notes','trash','note'].includes(currentPage)&&!editorDirty)await render();else updateCloudStatus();});
  bind($('#language'),'change',async e=>{if(editorDirty&&!await dialog({title:t('discard'),body:`<p>${t('discardWarning')}</p>`,confirm:'discard',cancel:true})){e.target.value=getLanguage();return;}editorDirty=false;prefs={...prefs,language:e.target.value};if(Cloud.signedIn())await Cloud.savePreferences(prefs);else S.savePreferences(prefs);setLanguage(prefs.language);await render();});

  bind($('[data-nav-signout]'),'click',signOut);
  bind($('[data-menu]'),'click',e=>{const open=$('#navbar').classList.toggle('open');e.currentTarget.setAttribute('aria-expanded',String(open));});
  $('#footer').innerHTML=`<div class="footer-links"><a href="/terms.html">${t('terms')}</a><a href="/privacy.html">${t('privacy')}</a><a href="mailto:atlasnote@nxlabtw.com">${icon('envelope')}${t('contact')}</a></div><p class="footer-tagline">${t('tagline')}</p><p>AtlasNote · © ${new Date().getFullYear()} <a href="https://nxlabtw.com" rel="noopener noreferrer">NXLabTW</a></p>`;
  document.documentElement.dataset.theme=prefs.theme;$('.skip').textContent=L(['Skip to content','跳至主要內容','本文へ移動']);
}
async function signOut(){if(!await dialog({title:t('logout'),body:editorDirty?`<p>${t('discardWarning')}</p>`:'',confirm:'logout',cancel:true}))return;await Cloud.signOut();editorDirty=false;pausedDraft?.key?.fill(0);pausedDraft=null;allNotes=[];selection.clear();query='';filter='all';filterOpen=false;await navigate('/');}
function updateHomeActions(){const signed=Cloud.signedIn();for(const a of $$('[data-home-primary]')){a.href='/dashboard.html';a.innerHTML=icon(signed?'table-columns':'right-to-bracket')+`<span>${t(signed?'openDashboard':'homeStart')}</span>`;a.setAttribute('aria-label',t(signed?'openDashboard':'homeStart'));}}
function prose(text,images=[]){
  const container=document.createElement('div');container.className='prose';
  const used=new Set();const map=new Map(images.map(i=>[i.id,i]));
  // Attachment tokens are replaced through text nodes, never raw HTML substitution.
  container.innerHTML=md.render(text);
  const walker=document.createTreeWalker(container,NodeFilter.SHOW_TEXT);const texts=[];while(walker.nextNode())if(!walker.currentNode.parentElement.closest('code,pre,a'))texts.push(walker.currentNode);
  for(const node of texts){const matches=[...node.data.matchAll(/\{(img_[a-f0-9]{12})\}/g)].filter(m=>map.has(m[1]));if(!matches.length)continue;const frag=document.createDocumentFragment();let offset=0;for(const m of matches){frag.append(document.createTextNode(node.data.slice(offset,m.index)));frag.append(imageFigure(map.get(m[1])));used.add(m[1]);offset=m.index+m[0].length;}frag.append(document.createTextNode(node.data.slice(offset)));node.replaceWith(frag);}
  for(const image of images)if(!used.has(image.id))container.append(imageFigure(image));return container;
}
function imageFigure(image){const figure=document.createElement('figure');figure.className='image-figure';const img=document.createElement('img');img.src=`data:${image.type};base64,${image.data}`;img.alt=image.caption||t('images');img.width=image.width;img.height=image.height;img.loading='lazy';figure.append(img);if(image.caption){const caption=document.createElement('figcaption');caption.textContent=image.caption;figure.append(caption);}return figure;}

async function home(){
  main.innerHTML=`<section class="hero"><div class="hero-copy reveal"><div class="hero-wordmark"><img src="/asset/logo.svg" alt="" width="43" height="43">AtlasNote</div><h1>${t('homeTitle').split(String.fromCharCode(10)).map(s=>`<span>${s}</span>`).join('')}</h1><p class="intro">${t('intro')}</p><div class="actions">${linkButton('getStarted','plus','/edit.html','primary')}${button('install','download','data-hero-install')}<a href="/notes.html" class="button" data-hero-notes hidden>${icon('book-open')}<span>${t('openNotes')}</span></a></div></div><div class="hero-preview"><div class="preview-top"><span>${icon('file-lines')} ${t('demoInteractive')}</span><div class="preview-dots"><span></span><span></span><span></span></div></div><div class="demo-tabs" role="tablist" aria-label="${t('preview')}">${['demoWelcome','demoMemo','demoPrivate'].map((k,i)=>`<button type="button" role="tab" aria-selected="${i===0}" data-scene="${i}" class="${i===0?'active':''}">${icon(['list-check','file-pen','lock'][i])}${t(k)}</button>`).join('')}</div><div class="preview-body" id="hero-note" role="tabpanel"></div><div class="preview-bottom"><span>${icon('note-sticky')} ${t('demoFooter')}</span><a href="/edit.html" aria-label="${t('newNote')}">${icon('arrow-right')}</a></div></div></section>`;
  const scene=index=>{
    $$('.demo-tabs button').forEach((b,i)=>{b.classList.toggle('active',i===index);b.setAttribute('aria-selected',String(i===index));});
    const target=$('#hero-note');
    if(index===0)target.innerHTML=`<h2>${t('demoWelcomeTitle')}</h2><div class="demo-checklist">${t('demoWelcomeItems').split('|').map((item,i)=>`<label><input type="checkbox" ${i===0?'checked':''}><span>${item}</span></label>`).join('')}</div>`;
    else if(index===1)target.innerHTML=`<h2>${t('demoMemoTitle')}</h2><div class="demo-memo"><div>${icon('image')}<span>${t('demoMemoWhen')}</span></div><div>${icon('cloud')}<span>${t('demoMemoBring')}</span></div><p>${t('demoMemoBody')}</p></div>`;
    else target.innerHTML=`<div class="demo-scene-icon">${icon('lock')}</div><h2>${t('demoPrivateTitle')}</h2><p>${t('demoPrivateBody')}</p>`;
  };
  scene(0);$$('[data-scene]').forEach(b=>bind(b,'click',()=>scene(Number(b.dataset.scene))));
  bind($('[data-hero-install]'),'click',install);
  const primary=$('.hero-copy .primary');primary.dataset.homePrimary='';primary.href='/dashboard.html';primary.querySelector('span').textContent=t(Cloud.profile()?'openDashboard':'homeStart');primary.setAttribute('aria-label',primary.querySelector('span').textContent);primary.querySelector('i').className='fa-solid fa-'+(Cloud.profile()?'table-columns':'right-to-bracket');
  $('.preview-bottom a').href='/dashboard.html';
  main.insertAdjacentHTML('beforeend',homeDetails(Cloud.signedIn()));updateHomeActions();
}

async function listPage(isTrash=false,isCurrent=viewGuard()){
  const records=await S.all(),titles=await Promise.all(records.map(n=>C.readTitle(n)));if(!isCurrent())return;allNotes=records.map((n,i)=>({...n,displayTitle:titles[i]||t('untitled')}));
  main.innerHTML=`<header class="page-head"><div><p class="eyebrow">${icon('note-sticky')}${t('localBadge')}</p><h1>${t(isTrash?'trash':'notes')}</h1><p>${isTrash?t('trashRetention'):t('notSynced')}</p></div><div class="actions">${isTrash?'':linkButton('newNote','plus','/edit.html','primary')}</div></header><div class="workspace-grid notes-workspace"><section class="workspace-main"><div class="toolbar"><label class="search-box">${icon('magnifying-glass')}<input class="input" id="search" type="search" aria-label="${t('search')}" placeholder="${t('search')}" maxlength="200" value="${escape(query)}"></label>${isTrash?'':`<button class="button" type="button" data-filter aria-expanded="${filterOpen}">${icon('sliders')}<span class="compact-label">${t('filter')}</span></button>`}</div><div id="filters"></div><div id="selection"></div><div class="note-list" id="note-list"></div></section></div>`;
  const drawList=()=>{
    const notes=allNotes.filter(n=>Boolean(n.trashedAt)===isTrash&&(!query||n.displayTitle.toLocaleLowerCase().includes(query.toLocaleLowerCase()))&&(isTrash||filter==='all'&&!n.archived||filter==='pinned'&&n.pinned||filter==='archived'&&n.archived)).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||Date.parse(b.updatedAt)-Date.parse(a.updatedAt));
    $('#filters').innerHTML=!isTrash&&filterOpen?`<div class="filter-panel">${['all','pinned','archived'].map((k,i)=>`<button type="button" class="filter-chip ${filter===k?'active':''}" data-filter-value="${k}">${icon(['layer-group','thumbtack','box-archive'][i])}${t(k)}</button>`).join('')}</div>`:'';
    $$('[data-filter-value]').forEach(b=>bind(b,'click',()=>{filter=b.dataset.filterValue;selection.clear();drawList();}));
    $('#selection').innerHTML=notes.length?`<div class="selection-bar"><label><input id="select-all" type="checkbox" ${notes.every(n=>selection.has(n.id))?'checked':''}>${selection.size?`${selection.size} ${t('selected')}`:t('selectAll')}</label>${selection.size?`<div class="selection-actions">${isTrash?button('restore','rotate-left','data-batch="restore"')+button('deleteForever','trash-can','data-batch="delete"','danger'):button('pin','thumbtack','data-batch="pin"')+button('archive','box-archive','data-batch="archive"')+button('moveTrash','trash-can','data-batch="trash"','danger')}</div>`:''}</div>`:'';
    $$('.selection-actions .button span').forEach(s=>s.classList.add('compact-label'));
    bind($('#select-all'),'change',e=>{selection=new Set(e.target.checked?notes.map(n=>n.id):[]);drawList();});
    $$('[data-batch]').forEach(b=>bind(b,'click',()=>actNotes([...selection],b.dataset.batch)));
    $('#note-list').innerHTML=notes.length?notes.map(n=>`<article class="note-card ${n.pinned?'pinned':''}"><label class="note-select"><input type="checkbox" data-select="${n.id}" aria-label="${t('selectNote')}: ${escape(n.displayTitle)}" ${selection.has(n.id)?'checked':''}></label><a class="note-link" href="${noteURL(n.id)}"><h3>${escape(n.displayTitle)}</h3><div class="card-meta"><span>${icon(n.mode==='none'?'file-lines':'lock')}${t(n.mode)}</span><span>${size(n.size)}</span>${n.pinned?`<span>${icon('thumbtack')}</span>`:''}<span class="card-date">${date(n.updatedAt)}</span></div></a><div class="utility">${isTrash?iconButton('restore','rotate-left',`data-action="restore" data-id="${n.id}"`)+iconButton('deleteForever','trash-can',`data-action="delete" data-id="${n.id}"`,'danger'):iconButton(n.pinned?'unpin':'pin','thumbtack',`data-action="pin" data-id="${n.id}"`,n.pinned?'active':'')+iconButton(n.archived?'unarchive':'archive','box-archive',`data-action="archive" data-id="${n.id}"`,n.archived?'active':'')+iconButton('moveTrash','trash-can',`data-action="trash" data-id="${n.id}"`,'danger')}</div></article>`).join(''):`<div class="empty">${icon(isTrash?'trash-can':'feather-pointed')}<h2>${t(query?'noResults':isTrash?'emptyTrash':'emptyTitle')}</h2><p>${isTrash?'':t('emptyDesc')}</p>${isTrash?'':linkButton('newNote','plus','/edit.html','primary')}</div>`;
    $$('[data-select]').forEach(b=>bind(b,'change',()=>{b.checked?selection.add(b.dataset.select):selection.delete(b.dataset.select);drawList();}));
    $$('[data-action]').forEach(b=>bind(b,'click',()=>actNotes([b.dataset.id],b.dataset.action)));
  };
  drawList();bind($('#search'),'input',e=>{query=e.target.value;drawList();});bind($('[data-filter]'),'click',()=>{filterOpen=!filterOpen;$('[data-filter]').setAttribute('aria-expanded',String(filterOpen));drawList();});

}
async function actNotes(ids,action){
  if(action==='delete'&&!await dialog({title:t('deleteForever'),body:`<p>${t('deleteWarning')}</p>`,confirm:'deleteForever',cancel:true,danger:true}))return;
  for(const id of ids){const n=await S.get(id);if(!n)continue;
    if(action==='delete'){await S.remove(id,n.rev);await Unlock.forget(n);}
    else await S.updateMeta(id,action==='pin'?{pinned:!n.pinned}:action==='archive'?{archived:!n.archived}:action==='restore'?{trashedAt:null}:{trashedAt:new Date().toISOString(),trashDays:prefs.trashDays});
  }
  selection.clear();if(currentPage==='note'){await navigate('/trash.html');return;}await listPage(currentPage==='trash');
}
async function askPIN(key='importPIN'){
  const result=await dialog({title:t(key),body:`<label class="field-label" for="vault-input">${t('pinLabel')}</label><input class="input" id="vault-input" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore maxlength="16"><p class="hint">${t('pinRules')}</p>`,confirm:'unlock',cancel:true,form:true,onSubmit:el=>{const pin=$('input',el).value;if(!C.validatePIN(pin))throw new Error('pinRules');return pin;}});
  if(result===null)throw new Error('cancelled');return result;
}
async function unlockNote(note){
  let unlocked;
  const cached=await Unlock.cached(note);if(cached){try{return {key:cached,payload:await S.decodeRecord(note,cached)};}catch{cached.fill(0);await Unlock.forget(note);}}
  const ok=await dialog({title:await C.readTitle(note)||t('unlockTitle'),body:`<label class="field-label" for="vault-input">${t('pinLabel')}</label><input class="input" type="password" id="vault-input" autocomplete="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore maxlength="16"><p class="hint">${t('pinRules')}</p>`,confirm:'unlock',cancel:true,form:true,onSubmit:async el=>{
    const pin=$('input',el).value;if(!C.validatePIN(pin))throw new Error('pinRules');let key;try{key=await C.unlockVault(note,pin);const payload=await S.decodeRecord(note,key);await Unlock.remember(note,key);unlocked={key,payload};return true;}catch{key?.fill(0);throw new Error('unlockError');}
  }});
  return ok?unlocked:null;
}
function clearKeys(){opened?.key?.fill(0);editor?.key?.fill(0);opened=null;editor?.imageSources?.clear();editor=null;}
async function notePage(isCurrent=viewGuard()){
  const n=await S.get(newId());if(!n)throw new Error('notFound');
  const title=await C.readTitle(n)||t('untitled');if(!isCurrent())return;
  main.innerHTML=`<section class="note-page"><header class="note-header"><p class="eyebrow">${icon('note-sticky')}${t(n.trashedAt?'trash':'notes')}</p><div class="note-title-row"><h1>${escape(title)}</h1><span class="pill accent">${icon(n.mode==='none'?'file-lines':'lock')}${t(n.mode)}</span></div><div class="note-meta"><span>${t('edited')} ${date(n.updatedAt)}</span><span>${size(n.size)}</span><span id="word-count"></span></div></header><div class="actions note-actions">${button('copy','copy','data-copy','icon-mobile')}${!n.trashedAt?linkButton('edit','pen','/edit.html?id='+n.id,'primary'):''}${!n.trashedAt?button('agent','wand-magic-sparkles','data-agent','primary icon-mobile'):''}${!n.trashedAt?button('history','clock-rotate-left','data-history','icon-mobile'):''}${n.mode==='secure'?button('lock','lock','data-lock','icon-mobile'):''}${n.trashedAt?button('restore','rotate-left','data-restore','primary')+button('deleteForever','trash-can','data-permanent-delete','danger'):button('delete','trash-can','data-trash','danger icon-mobile')}</div>${n.trashedAt?`<p class="trash-note-banner">${icon('trash-can')}${t('trashReadOnly')}</p>`:''}<article class="note-paper" id="note-content"></article></section>`;
  const content=$('#note-content');
  const lockButton=$('[data-lock]');if(lockButton)lockButton.hidden=true;
  const draw=payload=>{if(!isCurrent()||!content.isConnected)return;content.innerHTML='';content.append(prose(payload.text,payload.images));$('#word-count').textContent=`${Array.from(payload.text).length} ${t('characters')}`;if(lockButton)lockButton.hidden=false;};
  if(n.mode==='secure'){
    opened={note:n,key:null,payload:null};const cached=await Unlock.cached(n);if(!isCurrent()){cached?.fill(0);return;}if(cached){try{const payload=await S.decodeRecord(n,cached);if(!isCurrent()){cached.fill(0);return;}opened={note:n,key:cached,payload};draw(opened.payload);}catch{cached.fill(0);await Unlock.forget(n);}}if(!isCurrent())return;if(!opened.payload)content.innerHTML=`<div class="locked-card"><div class="lock-icon">${icon('lock')}</div><h2>${t('locked')}</h2><p>${t('sessionOnly')}</p>${button('unlock','unlock-keyhole','data-unlock','primary')}</div>`;
    bind($('[data-unlock]'),'click',async()=>{const result=await unlockNote(n);if(result){opened={note:n,...result};draw(result.payload);}});
  }else{const payload=await S.decodeRecord(n);if(!isCurrent())return;opened={note:n,key:null,payload};draw(opened.payload);}
  bind($('[data-copy]'),'click',async e=>{const b=e.currentTarget;b.disabled=true;try{if(!opened.payload){const result=await unlockNote(n);if(!result)return;opened={note:n,...result};draw(result.payload);}await copyText(opened.payload.text);if(!b.isConnected)return;b.innerHTML=icon('check')+`<span class="compact-label">${t('copied')}</span>`;setTimeout(()=>{if(b.isConnected)b.innerHTML=icon('copy')+`<span class="compact-label">${t('copy')}</span>`;},1800);}finally{if(b.isConnected)b.disabled=false;}});
  bind($('[data-history]'),'click',async()=>{if(!opened.payload){const result=await unlockNote(n);if(!result)return;opened={note:n,...result};draw(result.payload);}await historyDialog(opened);});
  bind($('[data-lock]'),'click',async()=>{await Unlock.forget(n);clearKeys();await notePage();});bind($('[data-trash]'),'click',()=>actNotes([n.id],'trash'));bind($('[data-permanent-delete]'),'click',()=>actNotes([n.id],'delete'));bind($('[data-restore]'),'click',async()=>{await S.updateMeta(n.id,{trashedAt:null});await notePage();});
  bind($('[data-agent]'),'click',async()=>{if(!opened.payload){const result=await unlockNote(n);if(!result)return;opened={note:n,...result};draw(result.payload);}await CloudUI.agent(opened);});
}
async function historyDialog(state){
  const versions=[];let title=state.payload.title,text=state.payload.text;
  for(const h of state.payload.history){title=S.apply(title,h.title);text=S.apply(text,h.text);versions.push({title,text,at:h.at});}
  if(!versions.length){await alertMessage(t('historyEmpty'),t('history'));return;}
  let save;
  await dialog({title:t('history'),className:'workflow-dialog history-dialog',body:`<p class="workflow-hint">${t('historyHint')}</p><div class="workflow-field"><label class="field-label" for="history-select">${t('chooseVersion')}</label><div class="history-select">${icon('clock-rotate-left')}<select class="field" id="history-select">${versions.map((v,i)=>`<option value="${i}">${i+1} · ${compactDate(v.at)}</option>`).join('')}</select>${icon('chevron-down')}</div></div><div id="history-preview"></div>`,confirm:'restoreVersion',cancel:true,onOpen:el=>{const preview=()=>{const v=versions[Number($('#history-select',el).value)];$('#history-preview',el).replaceChildren(notePreview({...v,images:state.payload.images},prose));};bind($('#history-select',el),'change',preview);preview();},onSubmit:async el=>{
    const select=$('#history-select',el),version=versions[Number(select.value)];
    save??=CloudUI.reviewedSave(state.note,{...state.payload,title:version.title,text:version.text},state.key,state.payload);select.disabled=true;
    try{await save();await notePage();return true;}
    catch(error){if(!S.hasPending(state.note.id)){save=null;select.disabled=false;}throw error;}
  }});
}

async function editPage(isCurrent=()=>true){
  const id=newId();const note=id?await S.get(id):{id:S.uuid(),mode:'basic',rev:0,pinned:false,archived:false,trashedAt:null};
  if(!isCurrent())return;if(!note)throw new Error('notFound');if(note.trashedAt){void navigate(noteURL(note.id),{replace:true});return;}let key=null,payload={title:'',text:'',images:[],history:[]};
  if(id){if(pausedDraft?.note.id===id&&pausedDraft.owner===Cloud.profile()?.uuid){key=pausedDraft.key?new Uint8Array(pausedDraft.key):null;payload=structuredClone(pausedDraft.payload);}else if(note.mode==='secure'){const result=await unlockNote(note);if(!result){void navigate(noteURL(id),{replace:true});return;}({key,payload}=result);}else payload=await S.decodeRecord(note);}
  if(!isCurrent()){key?.fill(0);return;}
  if(!id&&pausedDraft&&pausedDraft.owner===Cloud.profile()?.uuid){Object.assign(note,pausedDraft.note);payload=structuredClone(pausedDraft.payload);}
  editor={note,payload:structuredClone(payload),previous:id?structuredClone(payload):null,key,compression:'balanced',imageSources:new Map(),imageBusy:false};previewing=false;editorDirty=false;
  main.innerHTML=`<form id="editor-form" novalidate><header class="page-head"><div><p class="eyebrow">${icon('note-sticky')}${t('localBadge')}</p><h1>${t(id?'edit':'newNote')}</h1></div><div class="actions">${button('discard','xmark','data-discard','ghost') }<button class="button primary" type="submit" id="save-note">${icon('check')}<span class="compact-label">${t('save')}</span></button></div></header><div class="editor-layout"><div class="editor-main"><section class="card"><label class="field-label" for="note-title">${t('title')}</label><input class="input title-input" id="note-title" placeholder="${t('titlePlaceholder')}" maxlength="80" required value="${escape(payload.title)}"><p class="hint">${t('titleRule')}</p></section><section class="card"><div class="editor-tabs">${button('content','pen','data-tab="write"','small')}${button('preview','eye','data-tab="preview"','small ghost')}<span class="count-label" id="editor-count"></span></div><label class="sr-only" for="note-text">${t('content')}</label><textarea class="editor-text" id="note-text" placeholder="${t('contentPlaceholder')}" maxlength="1000000" spellcheck="false">${escape(payload.text)}</textarea><div class="editor-preview" id="editor-preview" hidden></div></section><section class="card"><div class="image-header"><h2>${icon('image')} ${t('images')} <small class="muted" id="image-count">${payload.images.length}/3</small></h2><div class="compression-control"><span class="compression-label">${t('compression')}</span><div class="compression-switch" role="group" aria-label="${t('compression')}">${['compact','balanced','clear'].map(k=>`<button type="button" data-compression="${k}" class="${k==='balanced'?'active':''}">${t(k)}</button>`).join('')}</div></div></div><div class="image-upload" id="dropzone">${button('addImage','plus','data-add-images')}<p class="hint">${t('imageHint')}</p><input type="file" id="image-files" accept="image/png,image/jpeg,image/webp" multiple hidden></div><div class="image-grid" id="image-grid"></div></section></div><aside class="editor-side"><section class="card"><h2>${icon('shield-halved')} ${t('encryption')}</h2><div class="encryption-choices">${['none','basic','secure'].map(mode=>`<label class="mode-choice"><input type="radio" name="mode" value="${mode}" ${note.mode===mode?'checked':''} ${id?'disabled':''}><span><strong>${t(mode)}</strong><small>${t(mode+'Desc')}</small></span></label>`).join('')}</div><div class="pin-grid" id="new-pin" ${note.mode==='secure'&&!id?'':'hidden'}><label class="field-group"><span class="field-label">${t('pinLabel')}</span><input class="input" id="new-pin-value" type="password" autocomplete="off" data-lpignore="true" data-1p-ignore autocapitalize="off" spellcheck="false" minlength="4" maxlength="16"></label><label class="field-group"><span class="field-label">${t('confirmPIN')}</span><input class="input" id="new-pin-confirm" type="password" autocomplete="off" data-lpignore="true" data-1p-ignore autocapitalize="off" spellcheck="false" maxlength="16"></label><p class="hint">${t('pinRules')}</p></div>${id?`<p class="hint">${t('newModeHint')}</p>`:''}</section><section class="card size-card"><p class="eyebrow">${t('estimated')}</p><div class="storage-number" data-size></div><p class="hint">${t('storageAbout')}</p></section><p class="hint">${t('notSynced')}</p></aside></div></form>`;
  $$('[name=mode]').forEach(input=>{const strong=input.closest('label').querySelector('strong');strong.innerHTML=`<span class="mode-name-long">${t(input.value)}</span><span class="mode-name-short">${t(input.value+'Short')}</span>`;});
  const update=()=>{
    editorDirty=true;editor.payload.title=$('#note-title').value;editor.payload.text=$('#note-text').value;
    $('#editor-count').textContent=`${Array.from(editor.payload.text).length} ${t('characters')}`;
    $('[data-size]').textContent=size(S.bytes(editor.payload));
    const pin=$('#new-pin-value').value,confirmation=$('#new-pin-confirm').value,needsPIN=editor.note.mode==='secure'&&!id;
    $('#new-pin-value').classList.toggle('invalid',!!pin&&!C.validatePIN(pin));$('#new-pin-confirm').classList.toggle('invalid',!!confirmation&&pin!==confirmation);
    $('#save-note').disabled=editor.imageBusy||!editor.payload.title.trim()||(needsPIN&&(!C.validatePIN(pin)||pin!==confirmation));
    if(previewing){$('#editor-preview').innerHTML='';$('#editor-preview').append(prose(editor.payload.text,editor.payload.images));}
  };
  ['#note-title','#note-text','#new-pin-value','#new-pin-confirm'].forEach(s=>bind($(s),'input',update));
  $$('[name=mode]').forEach(r=>bind(r,'change',()=>{editor.note.mode=r.value;$('#new-pin').hidden=r.value!=='secure';update();}));
  $$('[data-tab]').forEach(b=>bind(b,'click',()=>{previewing=b.dataset.tab==='preview';$('#note-text').hidden=previewing;$('#editor-preview').hidden=!previewing;update();}));
  $$('[data-compression]').forEach(b=>{b.title=t(b.dataset.compression+'Hint');b.setAttribute('aria-label',t(b.dataset.compression)+': '+b.title);b.setAttribute('aria-pressed',String(b.classList.contains('active')));bind(b,'click',()=>changeCompression(b.dataset.compression));});
  bind($('[data-discard]'),'click',async()=>{if(!editorDirty||await dialog({title:t('discard'),body:`<p>${t('discardWarning')}</p>`,confirm:'discard',cancel:true})){editorDirty=false;await navigate(id?noteURL(id):'/notes.html');}});
  bind($('#editor-form'),'submit',async e=>{
    e.preventDefault();if($('#save-note').disabled)return;const target=editor,btn=$('#save-note'),form=$('#editor-form');form.inert=true;form.setAttribute('aria-busy','true');btn.disabled=true;btn.innerHTML='<span class="spinner"></span>';
    try{
      if(!target.payload.title.trim())throw new Error('limitError');
      if(!id&&target.note.mode==='secure'){const vault=await C.createVault(target.note.id,$('#new-pin-value').value);target.key?.fill(0);target.key=vault.key;target.note.salt=vault.salt;target.note.wrap=vault.wrap;}
      target.note=await S.saveNote(target.note,target.payload,target.key,target.previous);if(target.key)await Unlock.remember(target.note,target.key);
      if(editor===target&&Cloud.signedIn()){editorDirty=false;form.removeAttribute('aria-busy');await navigate(noteURL(target.note.id));}
    }catch(error){const pending=await S.rawGet('notes',target.note.id);if(pending&&S.hasPending(target.note.id)){target.note=pending;try{target.previous=await S.decodeRecord(pending,target.key);}catch{target.previous=structuredClone(target.payload);}}throw error;}
    finally{if(editor!==target)target.key?.fill(0);form.inert=false;form.removeAttribute('aria-busy');btn.innerHTML=icon('check')+`<span class="compact-label">${t('save')}</span>`;btn.disabled=false;}
  });
  bind($('[data-add-images]'),'click',()=>$('#image-files').click());bind($('#image-files'),'change',async e=>{await addImages([...e.target.files]);e.target.value='';update();});
  bind($('#dropzone'),'dragover',e=>{e.preventDefault();$('#dropzone').classList.add('dragging');});bind($('#dropzone'),'dragleave',()=>$('#dropzone').classList.remove('dragging'));
  bind($('#dropzone'),'drop',async e=>{e.preventDefault();$('#dropzone').classList.remove('dragging');await addImages([...e.dataTransfer.files]);update();});
  bind($('#note-text'),'paste',async e=>{const files=[...e.clipboardData.files];if(files.length){e.preventDefault();await addImages(files);update();}});
  editor.update=update;drawImages();update();editorDirty=!!pausedDraft;pausedDraft?.key?.fill(0);pausedDraft=null;
}

function imageSource(target,image){
  let source=target.imageSources.get(image.id);
  if(!source){source=new Blob([C.unb64(image.data)],{type:image.type});target.imageSources.set(image.id,source);}
  return source;
}
function imageBusy(target,busy){
  if(busy)target.imageReady=new Promise(resolve=>target.imageDone=resolve);else{target.imageDone?.();target.imageDone=null;}
  target.imageBusy=busy;if(editor!==target)return;
  $$('[data-compression],[data-add-images],[data-draw],[data-remove-image],#image-files').forEach(b=>b.disabled=busy);
  $('.compression-switch')?.setAttribute('aria-busy',String(busy));target.update();
  const label=$('.compression-label');if(label)label.innerHTML=(busy?'<span class="spinner" aria-hidden="true"></span> ':'')+t('compression');
}
async function changeCompression(mode){
  const target=editor;if(target.imageBusy)return;
  if(!target.payload.images.length){target.compression=mode;$$('[data-compression]').forEach(b=>{b.classList.toggle('active',b.dataset.compression===mode);b.setAttribute('aria-pressed',String(b.dataset.compression===mode));});return;}
  imageBusy(target,true);
  try{
    const replacements=new Map();for(const im of target.payload.images)replacements.set(im.id,await compressImage(imageSource(target,im),mode));
    if(editor!==target)return;
    target.payload.images=target.payload.images.map(im=>({...im,...replacements.get(im.id)}));target.compression=mode;
    $$('[data-compression]').forEach(b=>{b.classList.toggle('active',b.dataset.compression===mode);b.setAttribute('aria-pressed',String(b.dataset.compression===mode));});drawImages();
  }finally{imageBusy(target,false);}
}
async function addImages(files){
  const target=editor;if(target.imageBusy){await target.imageReady;if(editor!==target)return;return addImages(files);}
  if(target.payload.images.length+files.length>3)throw new Error('imageLimit');imageBusy(target,true);
  try{
    const prepared=[];for(const file of files){const id='img_'+[...C.random(6)].map(b=>b.toString(16).padStart(2,'0')).join('');prepared.push({file,image:{id,caption:'',...await compressImage(file,target.compression)}});}
    if(editor!==target)return;
    for(const {file,image} of prepared){target.imageSources.set(image.id,file);target.payload.images.push(image);}drawImages();
  }finally{imageBusy(target,false);}
}
function drawImages(){
  if(!editor||!$('#image-grid'))return;$('#image-count').textContent=`${editor.payload.images.length}/3`;
  $('#image-grid').innerHTML=editor.payload.images.map((im,i)=>`<article class="image-card"><img src="data:${im.type};base64,${im.data}" alt="${escape(im.caption||t('preview'))}"><div class="image-info"><div class="image-id"><code>{${im.id}}</code><span>${size(C.unb64(im.data).length)}</span></div><input class="input" data-caption="${i}" aria-label="${t('caption')}" maxlength="400" placeholder="${t('caption')}" value="${escape(im.caption)}"><div class="image-tools">${iconButton('insertImage','file-arrow-up',`data-insert="${i}"`)}${iconButton('draw','paintbrush',`data-draw="${i}"`)}${iconButton('removeImage','trash-can',`data-remove-image="${i}"`,'danger')}</div></div></article>`).join('');
  $$('[data-caption]').forEach(el=>bind(el,'input',()=>{editor.payload.images[Number(el.dataset.caption)].caption=el.value;editor.update();}));
  $$('[data-insert]').forEach(el=>bind(el,'click',()=>{const field=$('#note-text'),im=editor.payload.images[Number(el.dataset.insert)];field.setRangeText(`\n{${im.id}}\n`,field.selectionStart,field.selectionEnd,'end');field.focus();editor.update();}));
  $$('[data-remove-image]').forEach(el=>bind(el,'click',()=>{const i=Number(el.dataset.removeImage);editor.imageSources.delete(editor.payload.images[i].id);editor.payload.images.splice(i,1);drawImages();editor.update();}));
  $$('[data-draw]').forEach(el=>bind(el,'click',()=>drawing(Number(el.dataset.draw))));
}
async function drawing(index){
  const target=editor,original=target.payload.images[index],image=await createImageBitmap(imageSource(target,original));const scale=Math.min(1,S.LIMITS.dimension/Math.max(image.width,image.height)),drawWidth=Math.max(1,Math.round(image.width*scale)),drawHeight=Math.max(1,Math.round(image.height*scale));
  const el=document.createElement('dialog');el.className='draw-dialog';el.setAttribute('aria-label',t('draw'));
  el.innerHTML=`<div class="dialog-body"><h2>${t('draw')}</h2><div class="draw-toolbar">${['pen','eraser','textTool'].map((k,i)=>button(k,['pen','eraser','font'][i],`data-tool="${k}"`,i?'small':'small primary')).join('')}<input type="color" value="#6678f2" id="draw-color" aria-label="${t('appearance')}"><input type="range" min="2" max="40" value="5" id="draw-width" aria-label="${t('pen')}">${iconButton('undo','rotate-left','data-undo')}<input class="input" placeholder="${t('drawingText')}" aria-label="${t('drawingText')}" id="draw-text" maxlength="100"></div><div class="draw-stage"><canvas width="${drawWidth}" height="${drawHeight}" id="draw-canvas"></canvas></div><p class="hint">${t('drawingHint')}</p></div><div class="dialog-actions">${button('cancel','xmark','data-cancel-draw')}${button('applyDrawing','check','data-apply-draw','primary')}</div>`;
  $('#dialog-root').append(el);el.showModal();const canvas=$('#draw-canvas',el),ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,canvas.width,canvas.height);image.close();let tool='pen',last=null,undo=[];
  const close=()=>{el.close();el.remove();$(`[data-draw="${index}"]`)?.focus({preventScroll:true});};el.addEventListener('cancel',e=>{e.preventDefault();close();});
  $$('[data-tool]',el).forEach(b=>bind(b,'click',()=>{tool=b.dataset.tool;$$('[data-tool]',el).forEach(x=>x.classList.toggle('primary',x===b));}));
  const point=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};};
  canvas.addEventListener('pointerdown',e=>{e.preventDefault();if(undo.length>=8)undo.shift();undo.push(ctx.getImageData(0,0,canvas.width,canvas.height));const p=point(e);ctx.globalCompositeOperation='source-over';ctx.fillStyle=$('#draw-color',el).value;
    if(tool==='textTool'){const text=$('#draw-text',el).value;if(text){ctx.font=`${Math.max(18,canvas.width/24)}px system-ui`;ctx.fillText(text,p.x,p.y);}return;}
    canvas.setPointerCapture(e.pointerId);last=p;ctx.beginPath();ctx.arc(p.x,p.y,Number($('#draw-width',el).value)/2,0,Math.PI*2);ctx.fillStyle=tool==='eraser'?'#fff':$('#draw-color',el).value;ctx.fill();
  });
  canvas.addEventListener('pointermove',e=>{if(!last)return;const p=point(e);ctx.strokeStyle=tool==='eraser'?'#fff':$('#draw-color',el).value;ctx.lineWidth=Number($('#draw-width',el).value);ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(p.x,p.y);ctx.stroke();last=p;});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>last=null);
  bind($('[data-undo]',el),'click',()=>{const prev=undo.pop();if(prev)ctx.putImageData(prev,0,0);});bind($('[data-cancel-draw]',el),'click',close);
  bind($('[data-apply-draw]',el),'click',async()=>{const apply=$('[data-apply-draw]',el);apply.disabled=true;try{const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('invalidImage');const result=await compressImage(blob,target.compression);if(editor!==target)return;target.payload.images[index]={...original,...result};target.imageSources.set(original.id,blob);target.update();drawImages();close();}finally{apply.disabled=false;}});
}

async function settingsPage(){
  main.innerHTML=`<header class="page-head"><h1>${t('settings')}</h1></header><div class="settings-grid"><form class="card settings-card" id="appearance-form"><h2>${icon('palette')}${t('appearance')}</h2><div class="form-stack"><label><span class="field-label">${t('appearance')}</span><select class="field" name="theme"><option value="dark">${t('dark')}</option><option value="light">${t('light')}</option></select></label><label><span class="field-label">${t('language')}</span><select class="field" name="language"><option value="en">English</option><option value="zh-Hant">繁體中文</option><option value="ja">日本語</option><option value="leet">l33t</option></select></label></div><div class="actions end" hidden><button class="button primary" type="submit">${icon('check')}${t('saveSettings')}</button></div></form><form class="card settings-card" id="retention-form"><h2>${icon('sliders')}${t('notesSettings')}</h2><div class="form-stack"><label><span class="field-label">${t('retention')}</span><select class="field" name="history">${[0,1,3,5,10,20].map(v=>`<option value="${v}">${v?`${v} ${t('versions')}`:t('disabled')}</option>`).join('')}</select></label><label><span class="field-label">${t('trashRetention')}</span><select class="field" name="trashDays">${[1,3,7,14,30].map(v=>`<option value="${v}">${v} ${t('days')}</option>`).join('')}</select></label></div><div class="actions end" hidden><button class="button primary" type="submit">${icon('check')}${t('saveSettings')}</button></div></form><section class="card settings-card app-settings"><h2>${icon('window-maximize')}${t('application')}</h2><div class="app-install-row">${button('install','download','data-install')}</div></section></div>`;
  const appearance=$('#appearance-form'),retention=$('#retention-form');appearance.elements.theme.value=prefs.theme;appearance.elements.language.value=getLanguage();retention.elements.history.value=prefs.history;retention.elements.trashDays.value=prefs.trashDays;
  [appearance,retention].forEach(form=>bind(form,'input',()=>$('.actions',form).hidden=false));
  bind(appearance,'submit',async e=>{e.preventDefault();prefs={...prefs,theme:appearance.elements.theme.value,language:appearance.elements.language.value};await Cloud.savePreferences(prefs);setLanguage(prefs.language);await render();showLive(t('settingsSaved'));});
  bind(retention,'submit',async e=>{e.preventDefault();const next={...prefs,history:Number(retention.elements.history.value),trashDays:Number(retention.elements.trashDays.value)};await Cloud.saveRetention(next);prefs=next;$('.actions',retention).hidden=true;showLive(t('settingsSaved'));});
  bind($('[data-install]'),'click',install);
  bind($('[data-persist]'),'click',async()=>{const yes=await navigator.storage?.persist?.();await alertMessage(t(yes?'persistYes':'persistNo'),t('storageTitle'));});
  $('.persistence-row')?.remove();await CloudUI.accountSettings();
}
function docsPage(kind='docs'){
  const requested=new URLSearchParams(location.search).get('article')||'start',key=docKeys.includes(requested)?requested:'start';const content=kind==='docs'?docsContent(key):policy(kind);const index=docKeys.indexOf(key);
  main.innerHTML=`<div class="docs-layout"><aside class="docs-sidebar"><nav class="docs-nav-main" aria-label="${t('docs')}">${docKeys.map((k,i)=>`<a href="/docs.html?article=${k}" class="${kind==='docs'&&k===key?'active':''}">${icon(['compass','file-pen','cloud','shield-halved','note-sticky','download','circle-question'][i])}${docTitle(k)}</a>`).join('')}</nav><div class="utility-links"><a href="/terms.html">${icon('scale-balanced')}${t('terms')}</a><a href="/privacy.html">${icon('fingerprint')}${t('privacy')}</a><a href="mailto:atlasnote@nxlabtw.com">${icon('envelope')}${t('contact')}</a></div></aside><article class="docs-content reveal"><p class="eyebrow">${icon('note-sticky')}AtlasNote / ${t(kind==='docs'?'docs':kind)}</p><h1>${content.title}</h1><p class="lead">${content.lead}</p>${content.html}${kind==='docs'?`<nav class="doc-pagination">${index>0?`<a href="/docs.html?article=${docKeys[index-1]}">${icon('arrow-left')}<span><small>${t('previous')}</small>${docTitle(docKeys[index-1])}</span></a>`:'<span></span>'}${index<docKeys.length-1?`<a href="/docs.html?article=${docKeys[index+1]}"><span><small>${t('next')}</small>${docTitle(docKeys[index+1])}</span>${icon('arrow-right')}</a>`:'<span></span>'}</nav>`:''}</article></div>`;
  document.title=`${content.title} — AtlasNote`;
}
async function install(){return requestInstall();}
window.addEventListener('beforeunload',e=>{if(editorDirty||S.hasPending()){e.preventDefault();e.returnValue='';}});
window.addEventListener('pagehide',event=>{
  if(!event.persisted)return;
  ++renderId;clearTimeout(viewRefresh);clearKeys();pausedDraft?.key?.fill(0);pausedDraft=null;allNotes=[];selection.clear();
  document.querySelectorAll('dialog').forEach(d=>{d.dispatchEvent(new Event('atlas-dismiss'));if(d.isConnected){d.close();d.remove();}});
  Cloud.discardFrozenPage();main.replaceChildren();
});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
async function canLeave(){
  if(document.querySelector('dialog[open]')||$('#editor-form')?.getAttribute('aria-busy')==='true')return false;
  if(S.hasPending()){try{await Cloud.flushPending();if(S.hasPending())throw new Error('cloudPending');}catch(error){await fail(error);return false;}}
  if(editorDirty&&!await dialog({title:t('discard'),body:`<p>${t('discardWarning')}</p>`,confirm:'discard',cancel:true}))return false;
  editorDirty=false;pausedDraft?.key?.fill(0);pausedDraft=null;return true;
}
function render(){
  clearTimeout(viewRefresh);const token=++renderId,url=routeAddress();
  const task=renderQueue.catch(()=>{}).then(()=>renderView(token,url));renderQueue=task;return task;
}
async function renderView(token,url){
  const isCurrent=()=>token===renderId&&url===routeAddress();
  if(!isCurrent())return;rendering=true;main.inert=true;main.setAttribute('aria-busy','true');
  document.body.dataset.page=route();if(!$('#global-stars')){const stars=document.createElement('canvas');stars.id='global-stars';stars.className='starfield';stars.setAttribute('aria-hidden','true');document.body.prepend(stars);startMeteors(stars);}clearKeys();currentPage=route();chrome();document.title=currentPage==='home'?`AtlasNote — ${t('tagline')}`:`${t(currentPage==='edit'?'newNote':currentPage)} — AtlasNote`;
  try{
    if(privatePages.includes(currentPage)){await cloudBoot;if(!isCurrent())return;try{await Cloud.authorize();}catch{if(isCurrent())CloudUI.loginGate();return;}if(!isCurrent())return;await S.cleanup();if(!isCurrent())return;}
    if(currentPage==='home')await home();
    else if(currentPage==='dashboard')await CloudUI.dashboard(isCurrent);
    else if(['notes','trash'].includes(currentPage))await listPage(currentPage==='trash',isCurrent);
    else if(currentPage==='note')await notePage(isCurrent);else if(currentPage==='edit')await editPage(isCurrent);else if(currentPage==='settings')await settingsPage();else if(['docs','privacy','terms'].includes(currentPage))docsPage(currentPage);
    else main.innerHTML=`<div class="empty"><h1>404</h1>${linkButton('home','arrow-left','/')}</div>`;
    if(!isCurrent())return;
    $$('[data-progress]').forEach(el=>el.style.setProperty('--progress',`${el.dataset.progress}%`));
    refreshInstallButtons();
    if(privatePages.includes(currentPage))Cloud.refresh();
  }catch(error){if(!isCurrent())return;main.innerHTML=`<div class="empty">${icon('triangle-exclamation')}<h1>${t('error')}</h1><p>${t(['notFound','missingKey','storageError','storageFull','storageDisabled'].includes(error.message)?error.message:'unexpectedError')}</p>${linkButton('notes','arrow-left','/notes.html')}</div>`;console.error('[AtlasNote]',error.message);}
  finally{rendering=false;main.inert=false;main.removeAttribute('aria-busy');}
}
CloudUI.configureUI({icon,button,linkButton,escape,size,bind,dialog,alertMessage,prose,render,askPIN,signOut});
function updateCloudStatus(){const badge=$('[data-cloud-status]');if(!badge)return;const state=Cloud.status(),key=['synced','syncing','pending','connecting','signedOut','offline'].includes(state)?state:state==='conflict'?'resolve':'syncPaused';badge.innerHTML=icon(state==='synced'?'cloud':state==='conflict'?'triangle-exclamation':state==='signedOut'?'right-to-bracket':'rotate')+`<span>${escape(t(key))}</span>`;badge.setAttribute('aria-label',t(key));badge.title=t(state.startsWith('cloud')?state:key);badge.dataset.state=state;}
window.addEventListener('atlas-cloud',()=>{if($('.nav-link').length!==(Cloud.signedIn()?6:2))chrome();else updateCloudStatus();updateHomeActions();});
window.addEventListener('atlas-preferences',event=>{const previousLanguage=getLanguage();prefs={...prefs,...event.detail};setLanguage(prefs.language||preferredLanguage());document.documentElement.dataset.theme=prefs.theme;if(currentPage){chrome();document.title=currentPage==='home'?`AtlasNote — ${t('tagline')}`:`${t(currentPage==='edit'?'newNote':currentPage)} — AtlasNote`;if(previousLanguage!==getLanguage()&&['home','docs','privacy','terms'].includes(currentPage))void render();}});
window.addEventListener('atlas-notes-updated',event=>{
  if(!Cloud.signedIn()||!privatePages.includes(currentPage))return;
  if(currentPage==='edit'){
    if(editor&&event.detail.ids.includes(editor.note.id)&&!$('[data-remote-change]')){const notice=document.createElement('p');notice.className='notice';notice.dataset.remoteChange='';notice.setAttribute('role','status');notice.textContent=t('remoteChanged');$('#editor-form .page-head')?.after(notice);}return;
  }
  if(!['dashboard','notes','trash','note'].includes(currentPage)||editorDirty||rendering||router?.busy||document.querySelector('dialog[open]'))return;
  viewRefresh=setTimeout(()=>void render(),0);
});
window.addEventListener('atlas-access-lost',()=>{
  ++renderId;clearTimeout(viewRefresh);
  if(editor&&editorDirty){pausedDraft={owner:Cloud.profile()?.uuid,note:structuredClone(editor.note),payload:structuredClone(editor.payload),key:editor.key?new Uint8Array(editor.key):null};}
  clearKeys();allNotes=[];selection.clear();query='';filter='all';filterOpen=false;
  document.querySelectorAll('dialog').forEach(d=>{d.dispatchEvent(new Event('atlas-dismiss'));if(d.isConnected){d.close();d.remove();}});
  if(privatePages.includes(currentPage)){CloudUI.loginGate();main.inert=false;main.removeAttribute('aria-busy');}
});
if(!isMainSite()){
  // Keep this deployment completely static: redirect before Puter or account UI starts.
  window.location.replace(mainSiteURL());
}else{
router=createRouter({render,canLeave,onError:error=>void fail(error)});
// Retire pre-Puter notes and their key, even when signed out. Never touch cloud caches.
const cleanupBoot=clearLegacy({onBlocked:()=>alertMessage(t('legacyBusy'))}).then(()=>S.reset());
cloudBoot=cleanupBoot.then(()=>Cloud.boot());
await render();
if('serviceWorker' in navigator)navigator.serviceWorker.getRegistrations().then(registrations=>Promise.all(registrations.filter(r=>new URL(r.scope).origin===location.origin&&new URL(r.active?.scriptURL||r.installing?.scriptURL||r.waiting?.scriptURL||'/sw.js').pathname==='/sw.js').map(r=>r.unregister()))).catch(()=>{});
}
