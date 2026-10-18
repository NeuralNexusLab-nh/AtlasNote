/* Cache the application shell only. Never serialize decrypted notes or keys. */
const CACHE='atlasnote-shell-v1';
const ASSETS=['/','/index.html','/notes.html','/note.html','/edit.html','/trash.html','/settings.html','/docs.html','/privacy.html','/terms.html','/style.css','/site.webmanifest','/asset/logo.svg','/asset/icon-192.png','/asset/icon-512.png','/asset/icon-maskable.png','/asset/fontawesome/css/all.min.css','/asset/fontawesome/webfonts/fa-solid-900.woff2','/asset/fontawesome/webfonts/fa-brands-400.woff2','/asset/fontawesome/webfonts/fa-regular-400.woff2','/script/theme.js','/script/app.js','/script/crypto.js','/script/kdf-worker.js','/script/store.js','/script/i18n.js','/script/docs.js','/script/meteors.js','/script/vendor/markdown-it.min.js','/script/vendor/argon2.umd.min.js'];
ASSETS.push('/favicon.ico','/script/install.js','/install.css','/script/policies.js','/script/images.js');
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('atlasnote-shell-')&&name!==CACHE)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  if(!ASSETS.includes(url.pathname))return;
  event.respondWith((async()=>{const cache=await caches.open(CACHE);try{const response=await fetch(event.request);if(response.ok)await cache.put(url.pathname,response.clone());return response;}catch{const cached=await cache.match(url.pathname);if(cached)return cached;return new Response('Offline',{status:503});}})());
});
