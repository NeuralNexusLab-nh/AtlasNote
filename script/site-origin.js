export const MAIN_ORIGIN='https://atlasnote.nxlabtw.com';
export function isMainSite(url=globalThis.location){return url?.origin===MAIN_ORIGIN;}
export function mainSiteURL(url=globalThis.location){return MAIN_ORIGIN+(url?.pathname||'/')+(url?.search||'')+(url?.hash||'');}
export function assertMainSite(){if(!isMainSite())throw new Error('mainSiteOnly');}
