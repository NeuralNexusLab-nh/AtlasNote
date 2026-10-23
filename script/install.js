import {t,localized as L} from './i18n.js';

let deferred=null,installed=false,active=null;
function rememberInstalled(value){installed=value;}
const standalone=()=>Boolean(navigator.standalone||matchMedia('(display-mode: standalone)').matches);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fa=n=>`<i class="fa-solid fa-${n}" aria-hidden="true"></i>`;
// These are browser toolbar symbols, not generic download icons.
const glyph=kind=>{
 const paths={'edge-install':'M3 3h7v7H3V3zm0 11h7v7H3v-7zm11 0h7v7h-7v-7zm3-12h2v3h3v2h-3v3h-2V7h-3V5h3V2z',install:'M4 3h16v15h-5v-2h3V5H6v11h3v2H4V3zm7 5h2v10l3-3 1.4 1.4L12 22l-5.4-5.6L8 15l3 3V8z',share:'M11 3 7 7l-1.4-1.4L12 0l6.4 5.6L17 7l-4-4v12h-2V3zM4 9h4v2H6v11h12V11h-2V9h4v15H4V9z',plus:'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z'};
 if(kind==='dots'||kind==='vertical')return `<svg viewBox="0 0 24 24" aria-hidden="true">${[5,12,19].map(v=>`<circle cx="${kind==='dots'?v:12}" cy="${kind==='dots'?12:v}" r="1.8"/>`).join('')}</svg>`;
 return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[kind]||paths.install}"/></svg>`;
};
const names={edge:'Microsoft Edge',chrome:'Google Chrome',ios:'Safari · iPhone / iPad',mac:'Safari · Mac',android:'Chrome / Edge · Android',firefox:'Firefox · Android',other:'Firefox / Tor / Other'};
export function detectInstallBrowser(ua=navigator.userAgent){
 if(/iPhone|iPad|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1))return 'ios';
 if(/Android/.test(ua))return /Firefox\//.test(ua)?'firefox':'android';
 if(/Edg\//.test(ua))return 'edge';
 if(/Chrome\//.test(ua)&&!/OPR|SamsungBrowser/.test(ua))return 'chrome';
 if(/Macintosh/.test(ua)&&/Safari/.test(ua)&&!/Chrome|Edg/.test(ua))return 'mac';
 return 'other';
}
function stepsFor(browser){
 const s=(key,visual,kind)=>({key,visual,kind});
 const menu=s('installMenu','',browser==='edge'?'dots':'vertical');
 const add=s('installAdd',L(['Add','加入','追加']),'plus');
 const home=s('installHome',L(['Add to Home Screen','加入主畫面','ホーム画面に追加']),'plus');
 if(browser==='edge')return [menu,s('installTools',L(['More tools','更多工具','その他のツール'])),s('installApps',L(['Apps','應用程式','アプリ'])),s('installConfirm',L(['Install this site as an app','將此網站安裝為應用程式','このサイトをアプリとしてインストール']),'edge-install')];
 if(browser==='chrome')return [menu,s('installChromeTools',L(['Cast, save, and share','投放、儲存及分享','キャスト、保存、共有'])),s('installChromeConfirm',L(['Install page as app','將網頁安裝為應用程式','ページをアプリとしてインストール']),'install')];
 if(browser==='ios')return [s('installShare','', 'share'),home,add];
 if(browser==='mac')return [s('installFile',L(['File','檔案','ファイル'])),s('installDock',L(['Add to Dock','加入 Dock','Dock に追加']),'plus')];
 if(browser==='android'||browser==='firefox')return [menu,s('installAndroid',L(['Install / Add to Home screen','安裝／加入主畫面','インストール／ホーム画面に追加']),'plus')];
 return [];
}
export function refreshInstallButtons(){
 const hidden=installed||standalone();
 const focusHero=hidden&&document.activeElement?.matches('[data-hero-install]');
 if(standalone()&&!installed)rememberInstalled(true);
 document.querySelectorAll('[data-install-control],[data-install],[data-hero-install]').forEach(b=>{b.hidden=hidden;});
 // Settings now contains only installation here; hide its title and card too.
 document.querySelectorAll('.app-settings').forEach(section=>{section.hidden=hidden;});
 document.querySelectorAll('[data-hero-notes]').forEach(link=>{link.hidden=!hidden;});
 if(focusHero)document.querySelector('[data-hero-notes]')?.focus({preventScroll:true});
}
function illustration(step,index,browser){
 const mobile=['ios','android','firefox'].includes(browser);
 return `<div class="install-illustration ${mobile?'is-phone':''}" aria-hidden="true"><div class="install-window"><div class="install-toolbar"><div class="install-window-dots"><b></b><b></b><b></b></div><span class="install-url">atlasnote</span>${index===0&&step.kind!=='plus'?`<span class="install-target">${step.kind?glyph(step.kind):esc(step.visual)}</span>`:glyph('dots')}</div><div class="install-page"><img src="/asset/logo.svg" width="28" height="28" alt=""><b>AtlasNote</b><span></span><span></span></div>${index>0||step.kind==='plus'?`<div class="install-menu-item"><span>${step.kind?glyph(step.kind):''}</span><b>${esc(step.visual)}</b>${fa('arrow-left')}</div>`:`<span class="install-pointer">${fa('arrow-up')}</span>`}</div></div>`;
}
function showGuide(){
 if(active){active.focus();return;}
 const previous=document.activeElement;
 const el=document.createElement('dialog');el.className='install-dialog';el.setAttribute('aria-labelledby','install-title');
 let browser=detectInstallBrowser(),view=['edge','chrome'].includes(browser)?'quick':'manual',step=0;
 const close=()=>{el.close();el.remove();active=null;if(previous?.isConnected)previous.focus();};
 function draw(){
  const steps=stepsFor(browser),desktop=['edge','chrome'].includes(browser),canPrompt=Boolean(deferred);
  el.innerHTML=`<header class="install-heading"><div><img src="/asset/logo.svg" alt="" width="36" height="36"><div><h2 id="install-title">${t('install')}</h2><p>${t('installSubtitle')}</p></div></div><button type="button" class="icon-btn" data-close aria-label="${t('installDone')}">${fa('xmark')}</button></header><div class="install-body"><div class="install-view-switch" role="group" aria-label="${t('install')}">${['quick','manual'].map(v=>`<button type="button" class="button ${view===v?'active':''}" data-view="${v}" aria-pressed="${view===v}">${fa(v==='quick'?'bolt':'list-ol')}${t(v==='quick'?'installQuick':'installGuide')}</button>`).join('')}</div><section class="install-panel" aria-live="polite">${view==='quick'?`${canPrompt?`<div class="install-instant"><img src="/asset/icon-192.png" alt="" width="64" height="64"><h3>AtlasNote</h3><button type="button" class="button primary" data-native>${fa('download')}${t('installNow')}</button></div>`:desktop?`<h3>${t('installAddress')}</h3>${illustration({kind:browser==='edge'?'edge-install':'install',visual:''},0,browser)}<p class="install-note">${t('installNoPrompt')}</p><button type="button" class="button" data-manual>${fa('list-ol')}${t('installGuide')}</button>`:`<p class="install-note">${t(browser==='other'?'installOther':'installNoPrompt')}</p><button type="button" class="button primary" data-manual>${fa('list-ol')}${t('installGuide')}</button>`}`:`<label class="install-browser"><span class="field-label">${t('installBrowser')}</span><select class="field" data-browser>${Object.entries(names).map(([key,name])=>`<option value="${key}" ${browser===key?'selected':''}>${name}</option>`).join('')}</select></label>${steps.length?`<ol class="install-step-list" data-count="${steps.length}">${steps.map((s,i)=>`<li class="install-step ${i===step?'current':''}" data-step="${i}" ${i!==step?'aria-hidden="true"':''}><div class="install-step-label"><span>${i+1}</span><strong>${t(s.key)}</strong></div>${illustration(s,i,browser)}</li>`).join('')}</ol><div class="install-step-nav"><button type="button" class="button" data-prev ${step===0?'disabled':''} aria-label="${t('installBack')}">${fa('arrow-left')}<span>${t('installBack')}</span></button><span class="mono" role="status">${step+1} / ${steps.length}</span><button type="button" class="button primary" data-next>${step===steps.length-1?t('installDone'):t('installNext')}${fa(step===steps.length-1?'check':'arrow-right')}</button></div><p class="install-note">${t('installDifferent')}</p>`:`<p class="install-note">${t('installOther')}</p>`}`}</section></div>`;
  el.querySelector('[data-close]').onclick=close;
  el.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;draw();el.querySelector(`[data-view="${view}"]`).focus();});
  el.querySelector('[data-manual]')?.addEventListener('click',()=>{view='manual';draw();el.querySelector('[data-browser]').focus();});
  el.querySelector('[data-browser]')?.addEventListener('change',e=>{browser=e.target.value;step=0;draw();el.querySelector('[data-browser]').focus();});
  el.querySelector('[data-prev]')?.addEventListener('click',()=>{step--;draw();el.querySelector('[data-prev]').focus();});
  el.querySelector('[data-next]')?.addEventListener('click',()=>{if(step===steps.length-1)return close();step++;draw();el.querySelector('[data-next]').focus();});
  el.querySelector('[data-native]')?.addEventListener('click',async()=>{const event=deferred;deferred=null;try{await event.prompt();const choice=await event.userChoice;if(choice?.outcome==='accepted')return close();}catch{}view='manual';draw();});
  // All steps are readable on desktop, but only the active step enters the mobile accessibility tree.
  const sync=()=>{const narrow=matchMedia('(max-width: 600px)').matches;el.querySelectorAll('[data-step]').forEach(li=>li.setAttribute('aria-hidden',String(narrow&&Number(li.dataset.step)!==step)));};
  sync();el._sync=sync;
 }
 el.addEventListener('cancel',e=>{e.preventDefault();close();});
 // Deliberately no backdrop-click dismissal.
 const resize=()=>el._sync?.();window.addEventListener('resize',resize);
 el.addEventListener('close',()=>window.removeEventListener('resize',resize),{once:true});
 document.querySelector('#dialog-root').append(el);active=el;draw();el.showModal();
}
export async function requestInstall(){
 if(standalone()||installed){refreshInstallButtons();return;}
 if(deferred){const event=deferred;deferred=null;try{await event.prompt();const choice=await event.userChoice;if(choice?.outcome==='accepted')return;}catch{/* Fall back to real browser steps, not an unsupported-browser error. */}}
 showGuide();
}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferred=event;rememberInstalled(false);refreshInstallButtons();});
window.addEventListener('appinstalled',()=>{rememberInstalled(true);deferred=null;if(active){active.close();active.remove();active=null;}refreshInstallButtons();});
matchMedia('(display-mode: standalone)').addEventListener?.('change',refreshInstallButtons);
