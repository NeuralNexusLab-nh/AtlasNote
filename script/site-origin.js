export const MAIN_ORIGIN='https://atlasnote.nxlabtw.com';
export function isMainSite(url=globalThis.location){return url?.origin===MAIN_ORIGIN;}
export function assertMainSite(){if(!isMainSite())throw new Error('mainSiteOnly');}
