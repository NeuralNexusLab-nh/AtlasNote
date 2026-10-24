// Same-document navigation keeps the authenticated, memory-only workspace alive.
const paths=/^\/(?:|index\.html|(?:dashboard|notes|trash|settings|docs|privacy|terms|note|edit)(?:\.html)?|new)$/;
export function appURL(value,base=location.href){
  try{const url=new URL(value,base);return url.origin===location.origin&&!url.username&&!url.password&&paths.test(url.pathname)?url:null;}catch{return null;}
}
export function createRouter({render,canLeave,onError}){
  const namespace='atlasRoute',session=crypto.randomUUID(),positions=new Map();
  let current={session,key:crypto.randomUUID(),index:0},currentURL=new URL(location.href),queue=Promise.resolve(),busy=0,restoring=null;
  const write=(method,entry,url)=>history[method]({...history.state,[namespace]:entry},'',url);
  write('replaceState',current,location.href);history.scrollRestoration='manual';
  const remember=()=>positions.set(current.key,{x:scrollX,y:scrollY});
  const schedule=work=>{
    busy++;
    const result=queue.catch(()=>{}).then(work).catch(error=>{onError(error);return false;}).finally(()=>busy--);
    queue=result;return result;
  };
  async function show(url,position,renderPage=true){
    if(renderPage){await render();document.querySelector('#main')?.focus({preventScroll:true});}
    if(position){window.scrollTo({left:position.x,top:position.y,behavior:'instant'});return;}
    if(url.hash){let id;try{id=decodeURIComponent(url.hash.slice(1));}catch{}const anchor=id&&document.getElementById(id);if(anchor){anchor.focus({preventScroll:true});anchor.scrollIntoView();return;}}
    window.scrollTo({left:position?.x||0,top:position?.y||0,behavior:'instant'});
  }
  function navigate(value,{replace=false}={}){
    const url=appURL(value);if(!url)return Promise.resolve(false);
    return schedule(async()=>{
      const hashOnly=url.pathname===currentURL.pathname&&url.search===currentURL.search&&(url.hash||currentURL.hash)&&url.hash!==currentURL.hash;
      if(!hashOnly&&!await canLeave())return false;
      remember();const entry={session,key:crypto.randomUUID(),index:current.index+(replace?0:1)};
      write(replace?'replaceState':'pushState',entry,url.href);current=entry;currentURL=url;
      await show(url,null,!hashOnly);return true;
    });
  }
  document.addEventListener('click',event=>{
    const anchor=event.target.closest?.('a[href]');
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||!anchor||anchor.hasAttribute('download')||(anchor.target&&anchor.target!=='_self')||anchor.relList.contains('external'))return;
    const url=new URL(anchor.href,location.href);
    if(!['http:','https:'].includes(url.protocol))return;
    event.preventDefault();
    if(appURL(url))void navigate(url);
    else void schedule(async()=>{if(await canLeave()){remember();location.assign(url.href);}return true;});
  });
  window.addEventListener('popstate',event=>{
    const target=event.state?.[namespace];
    if(restoring){
      if(target?.key===restoring.key){const done=restoring.resolve;restoring=null;done();}
      else if(target?.session===session&&current.index!==target.index)history.go(current.index-target.index);
      return;
    }
    if(target?.session!==session)return;const url=new URL(location.href);
    void schedule(async()=>{
      if(history.state?.[namespace]?.key!==target.key)return false;
      remember();
      const sameRoute=url.pathname===currentURL.pathname&&url.search===currentURL.search;
      if(!sameRoute&&!await canLeave()){
        const actual=history.state?.[namespace],delta=actual?.session===session?current.index-actual.index:0;
        if(delta)await new Promise(resolve=>{restoring={key:current.key,resolve};history.go(delta);});
        return false;
      }
      if(history.state?.[namespace]?.key!==target.key)return false;
      current=target;currentURL=url;await show(url,positions.get(target.key),!sameRoute);return true;
    });
  });
  return {navigate,get busy(){return busy>0;}};
}
