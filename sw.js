const V='mtg-v24', KEEP=[V,'mtg-img','mtg-lib'], SHELL=['./','index.html','features.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/nav-generate.png','icons/nav-collection.png','icons/nav-decks.svg','icons/nav-add.svg','icons/nav-generate-orb.svg','icons/nav-more.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>Promise.all(SHELL.map(u=>c.add(u).catch(()=>{})))));self.skipWaiting()});
self.addEventListener('activate',e=>{imgMetaInit().catch(()=>{});e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>!KEEP.includes(x)).map(x=>caches.delete(x)))));self.clients.claim()});
const cacheFirst=(e,name)=>e.respondWith(caches.open(name).then(async c=>{const h=await c.match(e.request);if(h)return h;
  try{const r=await fetch(e.request);if(r.ok||r.type==='opaque')c.put(e.request,r.clone());return r}catch(x){return Response.error()}}));
/* Card pictures (cards.scryfall.io), saved on the device. Two kinds:
   • pictures of VERIFIED artwork of cards in the collection (the page sends the list with 'imgkeep') — always kept, not limited;
   • everything else (lookups, artwork choices, unverified cards) — max 300 MB, least recently viewed removed first.
   Sizes/last use live in IndexedDB “mtg_imgmeta” (pictures without CORS count as ~100 KB). Never part of backups. */
const IMG='mtg-img',IMG_MAX=300*1024*1024,IMG_EST=100*1024;let imgDbP=null,imgTrimAt=0,KEEP_SET=null;const imgSeen=new Map();
const imgKey=u=>String(u).split('?')[0];
const imgDb=()=>imgDbP||(imgDbP=new Promise(ok=>{try{const r=indexedDB.open('mtg_imgmeta',2);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains('r'))db.createObjectStore('r',{keyPath:'u'}).createIndex('a','a');if(!db.objectStoreNames.contains('m'))db.createObjectStore('m')};r.onsuccess=()=>ok(r.result);r.onerror=()=>ok(null)}catch(e){ok(null)}}));
const idbP=q=>new Promise(ok=>{q.onsuccess=()=>ok(q.result);q.onerror=()=>ok(undefined)});
async function imgKeep(){if(KEEP_SET)return KEEP_SET;const db=await imgDb();const L=db?await idbP(db.transaction('m').objectStore('m').get('keep')):null;return KEEP_SET=new Set(L||[])}
async function imgAll(){const db=await imgDb();if(!db)return [];return (await idbP(db.transaction('r').objectStore('r').getAll()))||[]}
async function imgMetaInit(){const db=await imgDb();if(!db)return;const n=await idbP(db.transaction('r').objectStore('r').count());if(n)return;
  const c=await caches.open(IMG),ks=(await c.keys()).filter(k=>/cards\.scryfall\.io/.test(k.url));if(!ks.length)return;const tx=db.transaction('r','readwrite'),now=Date.now();ks.forEach((k,i)=>tx.objectStore('r').put({u:k.url,a:now-ks.length+i,n:IMG_EST}))}
async function imgNote(u,n){const db=await imgDb();if(!db)return;const tx=db.transaction('r','readwrite'),R=tx.objectStore('r'),old=await idbP(R.get(u));
  R.put({u,a:Date.now(),n:n==null?(old?old.n:IMG_EST):n});tx.oncomplete=()=>{if(n!=null)imgTrim()}}
async function imgStat(){const K=await imgKeep(),L=await imgAll();let kept=0,other=0;L.forEach(x=>{if(K.has(imgKey(x.u)))kept+=x.n||0;else other+=x.n||0});return {kept,other,size:other}}
async function imgTrim(force){if(!force&&Date.now()-imgTrimAt<30000)return;imgTrimAt=Date.now();const K=await imgKeep(),L=(await imgAll()).filter(x=>!K.has(imgKey(x.u)));let tot=L.reduce((s,x)=>s+(x.n||0),0);if(tot<=IMG_MAX)return;
  L.sort((x,y)=>x.a-y.a);const drop=[];for(const x of L){if(tot<=IMG_MAX*0.9)break;tot-=x.n||0;drop.push(x.u)}
  const c=await caches.open(IMG),db=await imgDb();await Promise.all(drop.map(u=>c.delete(u)));if(db){const tx=db.transaction('r','readwrite');drop.forEach(u=>tx.objectStore('r').delete(u))}}
const imgFirst=e=>e.respondWith(caches.open(IMG).then(async c=>{const u=e.request.url,h=await c.match(e.request);
  if(h){const t=imgSeen.get(u)||0;if(Date.now()-t>36e5){imgSeen.set(u,Date.now());imgNote(u,null).catch(()=>{})}return h}
  try{const r=await fetch(e.request);if(r.ok||r.type==='opaque'){const k=r.clone();c.put(e.request,k.clone()).then(async()=>{let n=IMG_EST;try{if(k.type!=='opaque')n=(await k.blob()).size}catch(x){}imgNote(u,n)}).catch(()=>{})}return r}catch(x){return Response.error()}}));
self.addEventListener('message',e=>{const d=e.data||{},port=e.ports&&e.ports[0],reply=x=>{if(port)port.postMessage(x)};
  if(d.type==='imgkeep')(async()=>{const L=(d.urls||[]).map(imgKey);KEEP_SET=new Set(L);const db=await imgDb();if(db)db.transaction('m','readwrite').objectStore('m').put(L,'keep');imgTrim(true);reply({ok:true})})().catch(()=>reply({ok:false}));
  if(d.type==='imgstat')(async()=>{await imgMetaInit();reply(await imgStat())})().catch(()=>reply({size:0,kept:0,other:0}));
  if(d.type==='imgclear')(async()=>{const K=await imgKeep(),c=await caches.open(IMG),db=await imgDb(),L=(await imgAll()).filter(x=>!K.has(imgKey(x.u)));await Promise.all(L.map(x=>c.delete(x.u)));if(db){const tx=db.transaction('r','readwrite');L.forEach(x=>tx.objectStore('r').delete(x.u))}reply({ok:true,n:L.length})})().catch(()=>reply({ok:false}))});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url); if(e.request.method!=='GET')return;
  if(u.hostname==='cards.scryfall.io') imgFirst(e);            // card art (300 MB limit)
  else if(u.hostname==='svgs.scryfall.io') cacheFirst(e,'mtg-img'); // mana/set symbols (tiny)
  else if(u.hostname==='cdn.jsdelivr.net') cacheFirst(e,'mtg-lib');         // OCR + sqlite libraries
  else if(u.origin===location.origin) e.respondWith(fetch(e.request).then(r=>{if(r.ok){const k=r.clone();caches.open(V).then(c=>c.put(e.request,k))}return r}).catch(()=>caches.match(e.request)));
});
