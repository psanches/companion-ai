// Public immutable assets only. HTML, sessions and API responses are never cached.
const CACHE_NAME = 'lumi-fingerprints-v1';
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const key of await caches.keys())if(key.startsWith('lumi-')&&key!==CACHE_NAME)await caches.delete(key);
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(!/^\/_assets\/[a-f0-9]{64}\//.test(url.pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE_NAME),cached=await cache.match(request);
  if(cached)return cached;
  const response=await fetch(request);
  if(response.ok){await cache.put(request,response.clone());const keys=await cache.keys();for(const key of keys.slice(0,Math.max(0,keys.length-100)))await cache.delete(key);}
  return response;
 })());
});
