import {MAIN_ORIGIN,isMainSite} from './script/site-origin.js';

// Apply before serving any app document, script, or Puter integration.
export function middleware({request,next}){
  const url=new URL(request.url);
  if(url.hostname==='atlasnote.nxlabtw.com'&&url.protocol==='http:'){
    return Response.redirect(MAIN_ORIGIN+url.pathname+url.search,308);
  }
  if(!isMainSite(url))return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AtlasNote</title><main><h1>AtlasNote</h1><p>AtlasNote is available only at its main address.</p><p><a href="https://atlasnote.nxlabtw.com/">Open AtlasNote</a></p></main></html>',{
    status:421,
    headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'}
  });
  return next();
}
