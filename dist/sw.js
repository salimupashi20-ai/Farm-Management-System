const CACHE='farm-manager-v2';
const FILES=['/','/index.html','/style.css','/domain.js','/sync.js','/app.js','/manifest.json','/icon.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)))});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('farm-manager-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()]))});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||!FILES.includes(url.pathname))return;
 // Cache only the public app shell. Authenticated API data is never cached here.
 event.respondWith(fetch(event.request).catch(()=>caches.match(url.pathname).then(response=>response||Response.error())));
});
