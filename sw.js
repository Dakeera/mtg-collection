const V='mtg-v1', SHELL=['./','index.html','manifest.webmanifest','data.json','icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V&&x!=='mtg-img').map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url); if(e.request.method!=='GET')return;
  if(u.hostname==='cards.scryfall.io'){ // card art: cache-first, kept forever
    e.respondWith(caches.open('mtg-img').then(async c=>{const h=await c.match(e.request);if(h)return h;
      try{const r=await fetch(e.request);if(r.ok)c.put(e.request,r.clone());return r}catch(x){return Response.error()}}));
  } else if(u.origin===location.origin){ // app files: network first so updates show up, cache fallback offline
    e.respondWith(fetch(e.request).then(r=>{const k=r.clone();caches.open(V).then(c=>c.put(e.request,k));return r}).catch(()=>caches.match(e.request)));
  }
});
