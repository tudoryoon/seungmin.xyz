const CACHE='realm-offline-v1';
const OFFLINE='/offline.html';
const PAGES=new Set(['/','/index.html','/test.html','/roulette.html','/offline.html']);
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.add(new Request(OFFLINE,{cache:'reload'}));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const name of await caches.keys())if(name.startsWith('realm-offline-')&&name!==CACHE)await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||request.mode!=='navigate'||url.origin!==self.location.origin||!PAGES.has(url.pathname))return;
  // Never cache account pages, auth callbacks, API responses or private files.
  event.respondWith(fetch(request,{cache:'no-store'}).catch(async()=>{
    const cache=await caches.open(CACHE);
    return await cache.match(OFFLINE)||new Response('Offline',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  }));
});
