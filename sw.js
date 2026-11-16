const V='mtg-v10', KEEP=[V,'mtg-img','mtg-lib'], SHELL=['./','index.html','features.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/nav-generate.png','icons/nav-collection.png','icons/nav-decks.svg','icons/nav-add.svg','icons/nav-generate-orb.svg','icons/nav-more.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>Promise.all(SHELL.map(u=>c.add(u).catch(()=>{})))));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>!KEEP.includes(x)).map(x=>caches.delete(x)))));self.clients.claim()});
const cacheFirst=(e,name)=>e.respondWith(caches.open(name).then(async c=>{const h=await c.match(e.request);if(h)return h;
  try{const r=await fetch(e.request);if(r.ok||r.type==='opaque')c.put(e.request,r.clone());return r}catch(x){return Response.error()}}));
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url); if(e.request.method!=='GET')return;
  if(u.hostname==='cards.scryfall.io'||u.hostname==='svgs.scryfall.io') cacheFirst(e,'mtg-img');            // card art
  else if(u.hostname==='cdn.jsdelivr.net') cacheFirst(e,'mtg-lib');         // OCR + sqlite libraries
  else if(u.origin===location.origin) e.respondWith(fetch(e.request).then(r=>{if(r.ok){const k=r.clone();caches.open(V).then(c=>c.put(e.request,k))}return r}).catch(()=>caches.match(e.request)));
});
