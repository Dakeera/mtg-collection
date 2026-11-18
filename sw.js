const V='mtg-v16', KEEP=[V,'mtg-img','mtg-lib'], SHELL=['./','index.html','features.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/nav-generate.png','icons/nav-collection.png','icons/nav-decks.svg','icons/nav-add.svg','icons/nav-generate-orb.svg','icons/nav-more.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>Promise.all(SHELL.map(u=>c.add(u).catch(()=>{})))));self.skipWaiting()});
self.addEventListener('activate',e=>{imgMetaInit().catch(()=>{});e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>!KEEP.includes(x)).map(x=>caches.delete(x)))));self.clients.claim()});
const cacheFirst=(e,name)=>e.respondWith(caches.open(name).then(async c=>{const h=await c.match(e.request);if(h)return h;
  try{const r=await fetch(e.request);if(r.ok||r.type==='opaque')c.put(e.request,r.clone());return r}catch(x){return Response.error()}}));
/* Card pictures (cards.scryfall.io): saved on the device, max 300 MB, least recently viewed removed first. Sizes/last use are tracked in IndexedDB “mtg_imgmeta” (pictures without CORS count as ~100 KB). Never part of backups. */
const IMG='mtg-img',IMG_MAX=300*1024*1024,IMG_EST=100*1024;let imgDbP=null,imgTrimming=false;const imgSeen=new Map();
const imgDb=()=>imgDbP||(imgDbP=new Promise(ok=>{try{const r=indexedDB.open('mtg_imgmeta',1);r.onupgradeneeded=()=>{const db=r.result;db.createObjectStore('r',{keyPath:'u'}).createIndex('a','a');db.createObjectStore('m')};r.onsuccess=()=>ok(r.result);r.onerror=()=>ok(null)}catch(e){ok(null)}}));
const idbP=q=>new Promise(ok=>{q.onsuccess=()=>ok(q.result);q.onerror=()=>ok(undefined)});
async function imgMetaInit(){const db=await imgDb();if(!db)return;const sz=await idbP(db.transaction('m').objectStore('m').get('size'));if(sz!=null)return;
  const c=await caches.open(IMG),ks=await c.keys(),tx=db.transaction(['r','m'],'readwrite'),now=Date.now();ks.forEach((k,i)=>tx.objectStore('r').put({u:k.url,a:now-ks.length+i,n:IMG_EST}));tx.objectStore('m').put(ks.length*IMG_EST,'size')}
async function imgNote(u,n){const db=await imgDb();if(!db)return;const tx=db.transaction(['r','m'],'readwrite'),R=tx.objectStore('r'),M=tx.objectStore('m'),old=await idbP(R.get(u)),sz=(await idbP(M.get('size')))||0;
  R.put({u,a:Date.now(),n:n==null?(old?old.n:IMG_EST):n});if(n!=null||!old)M.put(Math.max(0,sz+(n==null?IMG_EST:n)-(old?old.n:0)),'size');tx.oncomplete=()=>{if(n!=null)imgTrim()}}
async function imgTrim(){if(imgTrimming)return;const db=await imgDb();if(!db)return;const sz=(await idbP(db.transaction('m').objectStore('m').get('size')))||0;if(sz<=IMG_MAX)return;imgTrimming=true;
  const c=await caches.open(IMG),drop=[];await new Promise(ok=>{const tx=db.transaction(['r','m'],'readwrite');let left=sz;tx.objectStore('r').index('a').openCursor().onsuccess=e=>{const k=e.target.result;if(!k||left<=IMG_MAX*0.9){tx.objectStore('m').put(k?Math.max(0,left):0,'size');return}left-=k.value.n||0;drop.push(k.value.u);k.delete();k.continue()};tx.oncomplete=tx.onerror=()=>ok()});
  await Promise.all(drop.map(u=>c.delete(u)));imgTrimming=false}
const imgFirst=e=>e.respondWith(caches.open(IMG).then(async c=>{const u=e.request.url,h=await c.match(e.request);
  if(h){const t=imgSeen.get(u)||0;if(Date.now()-t>36e5){imgSeen.set(u,Date.now());imgNote(u,null).catch(()=>{})}return h}
  try{const r=await fetch(e.request);if(r.ok||r.type==='opaque'){const k=r.clone();c.put(e.request,k.clone()).then(async()=>{let n=IMG_EST;try{if(k.type!=='opaque')n=(await k.blob()).size}catch(x){}imgNote(u,n)}).catch(()=>{})}return r}catch(x){return Response.error()}}));
self.addEventListener('message',e=>{const d=e.data||{},port=e.ports&&e.ports[0];if(!port)return;
  if(d.type==='imgstat')imgDb().then(async db=>{await imgMetaInit();const sz=db?(await idbP(db.transaction('m').objectStore('m').get('size')))||0:0;port.postMessage({size:sz})}).catch(()=>port.postMessage({size:0}));
  if(d.type==='imgclear')(async()=>{await caches.delete(IMG);const db=await imgDb();if(db){const tx=db.transaction(['r','m'],'readwrite');tx.objectStore('r').clear();tx.objectStore('m').put(0,'size')}port.postMessage({ok:true})})().catch(()=>port.postMessage({ok:false}))});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url); if(e.request.method!=='GET')return;
  if(u.hostname==='cards.scryfall.io') imgFirst(e);            // card art (300 MB limit)
  else if(u.hostname==='svgs.scryfall.io') cacheFirst(e,'mtg-img'); // mana/set symbols (tiny)
  else if(u.hostname==='cdn.jsdelivr.net') cacheFirst(e,'mtg-lib');         // OCR + sqlite libraries
  else if(u.origin===location.origin) e.respondWith(fetch(e.request).then(r=>{if(r.ok){const k=r.clone();caches.open(V).then(c=>c.put(e.request,k))}return r}).catch(()=>caches.match(e.request)));
});
