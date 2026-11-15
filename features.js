/* MtG DeckMaster — feature modules shared by the web version and the Android app.
   Loaded before the main script in index.html. Nothing here runs at load time except declarations;
   every function uses the main script's globals (D, V, render, …) only when it is called. */
let RO=null,MINE=null,DRAFT=null,CAM=null,OC=null;
/* Deck formats you build a deck for (constructed). Draft, Sealed, Cube, Jumpstart and Two-Headed Giant are left out:
   their decks come from opening packs or another format's rules, so they can't be generated from a collection. */
const DFMT=[
 {k:'Casual',g:'House rules',n:60,max:4,leg:'',note:'Your own format: put 60 cards together and go nuts!'},
 {k:'Standard',g:'Official formats',n:60,max:4,leg:'standard'},{k:'Pioneer',g:'Official formats',n:60,max:4,leg:'pioneer'},{k:'Modern',g:'Official formats',n:60,max:4,leg:'modern'},
 {k:'Legacy',g:'Official formats',n:60,max:4,leg:'legacy'},{k:'Vintage',g:'Official formats',n:60,max:4,leg:'vintage',prompt:'Cards on the Vintage restricted list may appear only once.'},
 {k:'Pauper',g:'Official formats',n:60,max:4,leg:'pauper',prompt:'Only cards that have been printed at common rarity are legal.'},
 {k:'Commander',g:'Official formats',n:100,single:1,leg:'commander',cmd:'cr',life:40,cmdLabel:'Commander',cmdRule:'a legendary creature, or a card that says it can be your commander',prompt:'The commander counts toward the 100. Every card must fit inside the commander’s color identity.'},
 {k:'Brawl',g:'Official formats',n:100,single:1,leg:'brawl',cmd:'crpw',life:25,cmdLabel:'Commander',cmdRule:'a legendary creature or a planeswalker',prompt:'The commander counts toward the 100 and sets the color identity.'},
 {k:'Standard Brawl',g:'Official formats',n:60,single:1,leg:'standardbrawl',cmd:'crpw',life:25,cmdLabel:'Commander',cmdRule:'a legendary creature or a planeswalker',prompt:'Only Standard-legal cards. The commander counts toward the 60 and sets the color identity.'},
 {k:'Historic',g:'Official MTG Arena formats',n:60,max:4,leg:'historic'},{k:'Timeless',g:'Official MTG Arena formats',n:60,max:4,leg:'timeless',prompt:'Cards on the Timeless restricted list may appear only once.'},
 {k:'Alchemy',g:'Official MTG Arena formats',n:60,max:4,leg:'alchemy',note:'Wizards is retiring Alchemy from MTG Arena on February 2, 2027.'},
 {k:'Oathbreaker',g:'Community formats',n:60,single:1,leg:'oathbreaker',cmd:'pw',life:20,cmdLabel:'Oathbreaker',cmdRule:'a planeswalker',prompt:'The 60 cards are: 1 planeswalker (the Oathbreaker), 1 signature spell (an instant or sorcery inside the Oathbreaker’s color identity) and 58 other cards. Every card must fit the Oathbreaker’s color identity.'},
 {k:'Pauper Commander',g:'Community formats',n:100,single:1,leg:'paupercommander',cmd:'unc',life:30,cmdLabel:'Commander',cmdRule:'a creature that has been printed at uncommon',prompt:'The other 99 cards must have been printed at common. The commander sets the color identity.'},
 {k:'Duel Commander',g:'Community formats',n:100,single:1,leg:'duel',cmd:'cr',life:20,cmdLabel:'Commander',cmdRule:'a legendary creature',prompt:'1 v 1 Commander with its own banned list. The commander counts toward the 100 and sets the color identity.'},
 {k:'Premodern',g:'Community formats',n:60,max:4,leg:'premodern',prompt:'Only cards from Fourth Edition through Scourge are legal.'}];
const dfmt=k=>DFMT.find(x=>x.k===k)||null,fmtSize=k=>(dfmt(k)||{}).n||0,isCmdFmt=k=>!!(dfmt(k)||{}).cmd;
const sleeveLabel=(name,f)=>`${name} (${f||'Casual'} - ${fmtSize(f)||60} Cards)`;
function fmtRuleText(F){return F.single?`Exactly ${F.n} cards${F.cmd?', including your '+F.cmdLabel.toLowerCase()+' ('+F.cmdRule+')':''}. Only 1 copy of each card, except basic lands.`:`${F.k==='Casual'?'60':'At least '+F.n} cards (this app builds exactly ${F.n}). Up to ${F.max} copies of any card, except basic lands.`}
function fmtOptions(sel,req){const gs=[...new Set(DFMT.map(f=>f.g))];return (req?`<option value="" ${sel?'':'selected'} disabled>Choose your deck type…</option>`:'')+gs.map(g=>`<optgroup label="${g}">${DFMT.filter(f=>f.g===g).map(f=>`<option value="${f.k}" ${f.k===sel?'selected':''}>${f.k} · ${f.n} cards</option>`).join('')}</optgroup>`).join('')}
const copyCap=(c,F)=>c.type==='Basic Land'||/a deck can have any number of cards named/i.test(c.text||'')?999:F.single||(F.k==='Vintage'||F.k==='Timeless')&&c.leg&&c.leg[F.leg]==='r'?1:F.max||4;
function cmdOK(c,F){const t=(c.type||'')+' '+(c.subtype||'');
  if(F.cmd==='pw')return /planeswalker/i.test(t);if(F.cmd==='unc')return /creature/i.test(t);
  if(/can be your commander/i.test(c.text||''))return true;return /legendary/i.test(t)&&(/creature/i.test(t)||(F.cmd==='crpw'&&/planeswalker/i.test(t)))}
function aiFmt(v){const F=dfmt(v);G.fmt=v;G.legal=F?F.leg:'';G.res=null;if(F&&!F.cmd)G.cmd='';render();if(G.legal)ensureLegal().then(()=>render())}
function aiNeedFmt(){if(dfmt(G.fmt))return true;toast('Choose your deck type first');const s=document.getElementById('gfmt');if(s){s.scrollIntoView({block:'center'});s.focus()}return false}

/* ---------- small helpers ---------- */
const fxSlug=n=>{n=String(n||'').trim().replace(/[^A-Za-z0-9]+/g,'-').replace(/^-+|-+$/g,'');return n?n+'-':''};
const fxDate=ms=>{try{return new Date(ms).toLocaleDateString([],{year:'numeric',month:'short',day:'numeric'})}catch(e){return ''}};
const fxPl=(n,w)=>`${n} ${w}${n===1?'':'s'}`;
function fxMigrate(){if(!D)return;D.matchups=D.matchups||[];D.sims=D.sims||[];D.swaps=D.swaps||[];D.sleeves=D.sleeves||[];
  // Matchup log: only matchups that have actually been run are listed (drops old "Template / Pending" rows).
  D.matchups.forEach(s=>{if(/MASTER MATCHUP/i.test(s.title||'')&&s.rows)s.rows=s.rows.filter((r,i)=>i===0||!(/template|pending/i.test(String(r[r.length-1]))||String(r[5]).trim()==='-'))})}
function fxBack(){if(CAM){CAM.close();return true}return false}
async function fxDownload(text,name,type){const blob=new Blob([text],{type:type||'text/plain'});
  if(isNative()){try{const r=await nativeSave(blob,name,false);return toast(r.where?'Saved to '+r.where:'File shared')}catch(e){return toast('Could not save the file: '+String(e&&e.message||e).slice(0,80))}}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();toast('Saved to Downloads')}
async function fxReadBackup(f){const buf=new Uint8Array(await f.arrayBuffer());let j;
  if(String.fromCharCode(...buf.slice(0,15))==='SQLite format 3'){const SQL=await loadSQL(),db=new SQL.Database(buf),r=db.exec("SELECT value FROM app_state WHERE key='backup_json'");db.close();j=JSON.parse(r[0].values[0][0])}
  else j=JSON.parse(new TextDecoder().decode(buf));
  if(!j||!Array.isArray(j.cards)||!Array.isArray(j.decks))throw new Error('not a backup');return j}
// "Lorwyn Eclipsed Play Booster 3" -> "Lorwyn Eclipsed"; "Singles Orders" -> "Singles". Used for pull lists, where cards are stored by set.
function fxSetLabel(src){const x=canonSrc(src);if(x==='Singles Orders')return 'Singles';
  const m=x.match(/^(.*?)\s+(?:Bundle(?:\s+Box)?|(?:(?:Play|Draft|Set|Collector|Family|Jumpstart|Theme)\s+)?Boosters?(?:\s+(?:Pack|Box))?|Prerelease(?:\s+(?:Kit|Pack))?|Commander\s+Deck|Starter\s+(?:Kit|Deck)|Fat\s+Pack|Gift\s+(?:Box|Bundle))\b/i);
  if(m&&m[1].trim().length>2)return m[1].trim();
  return x.replace(/\s+\d+(\s*\(.*\))?$/,'').trim()||x}
function fxCardLabel(c){const l=[...new Set(cardSources(c).map(fxSetLabel))];return l.length?{k:l[0],alt:l.slice(1)}:{k:'Unknown source',alt:[]}}

/* ---------- collection list: load more cards as you scroll ---------- */
addEventListener('scroll',()=>{try{if(V.view!=='collection')return;const m=document.getElementById('more');
  if(m&&m.getBoundingClientRect().top<innerHeight+600){V.lim=(V.lim||150)+150;drawList()}}catch(e){}},{passive:true});

/* ---------- deck editing: stage changes, then Save or Discard ---------- */
function fxDraft(i){if(!DRAFT||DRAFT.deck!==i){const m={};D.decks[i].cards.forEach(e=>{const k=norm(e.name);m[k]=m[k]||{name:e.name,base:0,qty:0};m[k].base+=e.qty;m[k].qty+=e.qty});DRAFT={deck:i,m}}return DRAFT}
const fxDraftDirty=()=>!!DRAFT&&Object.values(DRAFT.m).some(x=>x.qty!==x.base);
function fxDeckCards(i){const d=D.decks[i];if(!DRAFT||DRAFT.deck!==i)return d.cards;return Object.values(DRAFT.m).map(x=>({name:x.name,qty:x.qty,d:x.qty-x.base}))}
function fxDraftChg(i,name,dl,fromSearch){if(RO||i==null||!D.decks[i])return;const d=fxDraft(i),k=norm(name),c=findCard(name),x=d.m[k]||(d.m[k]={name:c?c.name:name,base:0,qty:0});
  x.qty=Math.max(0,x.qty+dl);if(!x.qty&&!x.base)delete d.m[k];render();
  if(fromSearch)fxBuilder()}
function fxCanLeave(){if(fxDraftDirty()){if(!confirm('You have deck changes that are not saved.\n\nOK = discard them\nCancel = stay and keep editing'))return false}DRAFT=null;return true}
function fxLeaveDeck(){if(!fxCanLeave())return;V.deck=null;render();scrollTo(0,0)}
const fxDraftNote=i=>RO?'':'<p class="mut" data-rw>Use + / − or “Add card” to make as many changes as you like. Nothing changes until you tap <b>Save changes</b>.</p>';
function fxDraftBar(i){if(!DRAFT||DRAFT.deck!==i||!fxDraftDirty())return '';const ch=Object.values(DRAFT.m),a=sum(ch,x=>Math.max(0,x.qty-x.base)),r=sum(ch,x=>Math.max(0,x.base-x.qty));
  return `<div style="height:76px"></div><div id="dbar"><span><b>Not saved:</b> ${a?'+'+a:''}${a&&r?' / ':''}${r?'−'+r:''} card${a+r===1?'':'s'}</span><button onclick="fxDraftDiscard()">Discard</button><button class="pri" onclick="fxDraftSave()">Save changes</button></div>`}
function fxDraftDiscard(){if(!confirm('Discard all the changes you made to this deck?\n\nOK = discard\nCancel = keep editing'))return;DRAFT=null;render();toast('Changes discarded')}
function fxDraftSave(){
  if(!DRAFT)return;const i=DRAFT.deck,d=D.decks[i],ch=Object.values(DRAFT.m).filter(x=>x.qty!==x.base),adds=ch.filter(x=>x.qty>x.base),rems=ch.filter(x=>x.qty<x.base);
  const na=sum(adds,x=>x.qty-x.base),nr=sum(rems,x=>x.base-x.qty);
  if(!confirm(`Save these changes to ${d.name}?\n\n${fxPl(na,'card')} added, ${nr} removed.\n\nOK = save\nCancel = keep editing`))return;
  const inG={},outG={},put=(G,k,q,name,alt)=>(G[k]=G[k]||[]).push({q,name,alt:alt||[]}),others=D.decks.filter(x=>x!==d).map(x=>x.name);
  // 1) removals: decide where each physical copy goes, then take it off the list
  rems.forEach(x=>{const n=x.base-x.qty,c=findCard(x.name),lo=loanedOut(d.name,x.name);let perm=Math.max(0,lo-x.qty),phys=n-Math.min(n,perm);perm=Math.min(n,perm);
    if(perm>0)actLoans().filter(l=>l.from===d.name&&norm(l.card)===norm(x.name)).forEach(l=>{if(perm<=0)return;const k=Math.min(perm,l.qty);perm-=k;put(outG,'Nothing to move — already in deck: '+l.to,k,x.name);
      if(k>=l.qty){l.status='permanent';l.done=today();setSwapStatus(l.id,'Permanent '+today())}else l.qty-=k});
    if(phys>0)[...actLoans()].reverse().filter(l=>l.to===d.name&&norm(l.card)===norm(x.name)).forEach(l=>{if(phys<=0)return;const k=Math.min(phys,l.qty);phys-=k;put(outG,'Return to deck: '+l.from,k,x.name);
      if(k>=l.qty){l.status='returned';l.done=today();setSwapStatus(l.id,'Returned '+today())}else l.qty-=k});
    if(phys>0){const L=c?fxCardLabel(c):{k:'Not in your collection',alt:[]};put(outG,L.k,phys,x.name,L.alt)}
    let left=n;d.cards.filter(e=>norm(e.name)===norm(x.name)).forEach(e=>{const k=Math.min(left,e.qty);e.qty-=k;left-=k});d.cards=d.cards.filter(e=>e.qty>0)});
  try{reconcileLoans()}catch(e){}
  // 2) additions: free copies come from the collection (by set); the rest are borrowed from other decks
  adds.forEach(x=>{const n=x.qty-x.base,c=findCard(x.name);
    if(!c)put(inG,'Not in your collection',n,x.name);
    else if(c.type==='Basic Land'){const L=fxCardLabel(c);put(inG,L.k,n,c.name,L.alt)}
    else{const pl=planCard(c,n,others),L=fxCardLabel(c);if(pl.free>0)put(inG,L.k,pl.free,c.name,L.alt);
      pl.from.forEach(f=>{makeLoan(c.name,f.q,f.deck,d.name);put(inG,'From deck: '+f.deck,f.q,c.name)});
      if(pl.short>0)put(inG,'Not enough copies — you own fewer than the deck lists',pl.short,c.name)}
    const e=d.cards.find(e=>norm(e.name)===norm(x.name));e?e.qty+=n:d.cards.push({name:c?c.name:x.name,qty:n,finish:c?.finish||'Normal'})});
  DRAFT=null;save();render();fxPullSplash(d.name,inG,outG)}
function fxPullSplash(deck,inG,outG){
  const ord=G=>Object.keys(G).sort((a,b)=>(/deck:/i.test(b)-/deck:/i.test(a))||a.localeCompare(b)),tot=G=>sum(Object.values(G).flat(),x=>x.q);
  const grp=G=>ord(G).map(k=>`<div class="grp"><b>${esc(k)} <span class="mut">· ${sum(G[k],x=>x.q)}</span></b>${G[k].sort((a,b)=>a.name.localeCompare(b.name)).map(x=>`<div>${x.q}× ${esc(x.name)}${x.alt.length?` <span class="mut">(or ${esc(x.alt.join(' / '))})</span>`:''}</div>`).join('')}</div>`).join('');
  const txt=(t,G)=>tot(G)?`${t}\n`+ord(G).map(k=>`  ${k}\n`+G[k].map(x=>`    ${x.q}x ${x.name}`).join('\n')).join('\n')+'\n':'';
  window.FXPULL=`${deck} — pull list\n\n`+txt('CARDS ADDED',inG)+'\n'+txt('CARDS REMOVED',outG);
  openM(`<div class="pull"><h3>✓ ${esc(deck)} updated</h3><p class="mut">Your pull list, grouped by where each card is stored.</p>
  <h4>Cards added (${tot(inG)}) — pull these from:</h4>${grp(inG)||'<p class="mut">None.</p>'}
  <h4>Cards removed (${tot(outG)}) — put these back in:</h4>${grp(outG)||'<p class="mut">None.</p>'}
  <div class="row"><button onclick="navigator.clipboard.writeText(window.FXPULL).then(()=>toast('Pull list copied'),()=>toast('Could not copy'))">📋 Copy list</button><button class="pri" onclick="closeM()">Done</button></div></div>`)}

/* ---------- in-app camera with a card-shaped frame ---------- */
async function fxCam(cb){
  const fallback=()=>{const i=document.createElement('input');i.type='file';i.accept='image/*';i.capture='environment';i.onchange=()=>{if(i.files[0])cb(i.files[0])};i.click()};
  if(!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia))return fallback();
  let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:2560},height:{ideal:1440}}})}
  catch(e){toast('The in-app camera could not start — using your phone camera instead');return fallback()}
  const el=document.createElement('div');el.id='cam';
  el.innerHTML=`<div class="vw"><video autoplay playsinline muted></video><div id="camf"><i></i><i></i><i></i><i></i></div><div class="tip">Line the card up inside the green corners, then tap the round button</div></div>
  <div class="cb"><button id="camx">Cancel</button><button class="shut" id="cams" aria-label="Take photo"></button><span style="display:flex;flex-direction:column;gap:6px"><button id="camt" style="display:none">🔦 Light</button><button id="camp">Phone camera</button></span></div>`;
  document.body.appendChild(el);const v=el.querySelector('video'),vw=el.querySelector('.vw'),f=el.querySelector('#camf');v.srcObject=stream;
  const lay=()=>{const W=vw.clientWidth,H=vw.clientHeight,w=Math.min(W*0.86,H*0.8*63/88),h=w*88/63;f.style.width=w+'px';f.style.height=h+'px';f.style.left=(W-w)/2+'px';f.style.top=(H-h)/2+'px'};
  lay();addEventListener('resize',lay);
  const close=()=>{removeEventListener('resize',lay);try{stream.getTracks().forEach(t=>t.stop())}catch(e){}el.remove();CAM=null};CAM={close};
  try{const track=stream.getVideoTracks()[0],caps=track.getCapabilities?track.getCapabilities():{};
    if(caps.torch){const b=el.querySelector('#camt');b.style.display='';let on=false;b.onclick=()=>{on=!on;track.applyConstraints({advanced:[{torch:on}]}).catch(()=>{})}}
    if(caps.focusMode&&caps.focusMode.includes('continuous'))track.applyConstraints({advanced:[{focusMode:'continuous'}]}).catch(()=>{})}catch(e){}
  el.querySelector('#camx').onclick=close;el.querySelector('#camp').onclick=()=>{close();fallback()};
  el.querySelector('#cams').onclick=()=>{const W=vw.clientWidth,H=vw.clientHeight,VW=v.videoWidth,VH=v.videoHeight;if(!VW)return toast('The camera is still starting…');
    const r=fxCropRect(W,H,VW,VH,f.offsetLeft,f.offsetTop,f.offsetWidth,f.offsetHeight),up=Math.max(1,Math.min(2,1200/r.w)),cv=document.createElement('canvas');cv.width=Math.round(r.w*up);cv.height=Math.round(r.h*up);
    const x=cv.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(v,r.x,r.y,r.w,r.h,0,0,cv.width,cv.height);
    cv.toBlob(b=>{close();if(!b)return toast('Could not take the photo');b.cropped=true;cb(b)},'image/jpeg',0.95)}}
// Maps the on-screen frame to video pixels (the video is shown with object-fit: cover), with a small margin around the frame.
function fxCropRect(W,H,VW,VH,fx,fy,fw,fh){const sc=Math.max(W/VW,H/VH),ox=(W-VW*sc)/2,oy=(H-VH*sc)/2,pad=0.025;fx-=fw*pad;fy-=fh*pad;fw*=1+2*pad;fh*=1+2*pad;
  let x=Math.max(0,(fx-ox)/sc),y=Math.max(0,(fy-oy)/sc);return {x,y,w:Math.min(VW-x,fw/sc),h:Math.min(VH-y,fh/sc)}}

/* ---------- other people's collections (read-only viewer) ---------- */
const fxDb=()=>new Promise((ok,no)=>{const r=indexedDB.open('mtg_others',1);r.onupgradeneeded=()=>r.result.createObjectStore('c',{keyPath:'id'});r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
const fxTx=(mode,fn)=>fxDb().then(db=>new Promise((ok,no)=>{const t=db.transaction('c',mode),r=fn(t.objectStore('c'));t.oncomplete=()=>{db.close();ok(r&&r.result)};t.onerror=()=>{db.close();no(t.error)}}));
async function ocLoad(){try{OC=((await fxTx('readonly',st=>st.getAll()))||[]).sort((a,b)=>(b.added||0)-(a.added||0))}catch(e){OC=[]}return OC}
function fxOthersView(){return `<p class="mut">Open a backup file someone shared with you to browse their collection and decks. It is view-only and kept separate from your own collection — nothing here can change your data.</p>
  <div class="row"><label class="btn pri">⬆ Import someone’s collection<input type="file" accept=".json,.sqlite,.db,application/json,application/octet-stream" hidden onchange="fxOpenFile(this.files[0],'view');this.value=''"></label></div>
  <div class="f"><label>…or paste a deck link someone sent you</label><input id="oclink" placeholder="https://…#d=…"></div><div class="row"><button onclick="fxOpenLink(document.getElementById('oclink').value)">Open deck link</button></div>
  <p class="mut" style="font-size:12px">Tap a collection to open it. Slide a row to the left to delete it.</p><div id="oclist"><p class="mut">Loading…</p></div>`}
async function ocDraw(){await ocLoad();const el=document.getElementById('oclist');if(!el)return;
  el.innerHTML=OC.length?OC.map(r=>`<div class="ocrow" data-oc="${esc(r.id)}"><button class="ocdel" onclick="ocDelete('${esc(r.id)}')">Delete</button><div class="ocin"><b>${esc(r.name)} ${r.status==='signed'?'<span title="Signed by its owner" style="color:#2ecc71">✓</span>':'<span class="mut" style="font-weight:400;font-size:11px">unverified</span>'}<br><span>${r.partial?fxPl(r.data.decks.length,'deck')+' only':r.data.cards.length+' titles · '+fxPl(r.data.decks.length,'deck')}${r.uid&&!/^(old|link)-/.test(r.uid)?' · ID '+esc(fxCode(r.uid)):''}</span></b><span>${esc(fxDate(r.updated))}</span></div></div>`).join(''):'<p class="mut">No other collections saved yet.</p>';
  el.querySelectorAll('.ocrow').forEach(row=>{const inn=row.querySelector('.ocin');let x0=null,dx=0,open=false;
    const set=o=>{open=o;inn.style.transform=o?'translateX(-92px)':''};
    inn.addEventListener('pointerdown',e=>{x0=e.clientX;dx=0;inn.style.transition='none';try{inn.setPointerCapture(e.pointerId)}catch(_){}});
    inn.addEventListener('pointermove',e=>{if(x0==null)return;dx=e.clientX-x0;const b=open?-92:0;inn.style.transform=`translateX(${Math.max(-92,Math.min(0,b+dx))}px)`});
    const end=()=>{if(x0==null)return;x0=null;inn.style.transition='';if(Math.abs(dx)<8){if(open)set(false);else roOpen(row.dataset.oc)}else set(open?dx<40:dx<-40)};
    inn.addEventListener('pointerup',end);inn.addEventListener('pointercancel',()=>{x0=null;inn.style.transition='';set(open)})})}
async function ocImport(f){return fxOpenFile(f,'view')}
async function ocDelete(id){const r=(OC||[]).find(x=>x.id===id);if(!r)return;if(!confirm(`Delete the saved collection “${r.name}”?\n\nThis only removes it from this list. Your own collection is not affected.`))return ocDraw();
  await fxTx('readwrite',st=>st.delete(id));if(!(OC||[]).some(x=>x.id!==id&&x.uid===r.uid))fxFriendIndex(r,true);toast('Removed');ocDraw()}
async function roOpen(id){await ocLoad();const r=OC.find(x=>x.id===id);if(!r)return;if(!fxCanLeave())return;
  const j=JSON.parse(JSON.stringify(r.data));['acq','edits','flags','swaps','matchups','loans','sleeves','sims'].forEach(k=>{j[k]=j[k]||[]});j.kept=j.kept||{};
  j.cards.forEach(c=>{c.text=c.text||'';c.colors=c.colors||'';c.type=c.type||'';c.qty=+c.qty||0});j.decks.forEach(d=>{d.cards=d.cards||[];d.tokens=d.tokens||[]});
  MINE={D,ART,ART2};D=j;ART=Object.assign({},ART);ART2=Object.assign({},ART2);RO={id:r.id,name:r.name,updated:r.updated,uid:r.uid,status:r.status};IDX=null;DRAFT=null;HIST.length=0;
  V.view='collection';V.deck=null;V.q=V.type=V.color='';V.lim=0;closeM();render();scrollTo(0,0);fetchArt()}
function roExit(){if(!RO)return;D=MINE.D;ART=MINE.ART;ART2=MINE.ART2;RO=null;MINE=null;IDX=null;HIST.length=0;V.view='more';V.sub='others';V.deck=null;V.q=V.type=V.color='';V.lim=0;closeM();persist();render();scrollTo(0,0)}
const roBar=()=>`<div class="robar"><button onclick="roExit()">← Back to my collection</button><b title="Tap to rename" onclick="roRename()">${RO.status==='signed'?'✓ ':''}${esc(RO.name)}</b><span>Updated<br>${esc(fxDate(RO.updated))}</span></div>`;
async function roRename(){const n=prompt('Name for this collection (so you know whose it is):',RO.name);if(n==null)return;const name=n.trim();if(!name)return;
  await ocLoad();const r=OC.find(x=>x.id===RO.id);if(r){r.name=name;await fxTx('readwrite',st=>st.put(r));fxFriendIndex(r)}RO.name=name;render();toast('Renamed')}

/* ---------- formats guide ---------- */
const FXFMT=[
 {k:'casual',n:'Casual (house rules)',casual:true},
 {k:'commander',n:'Commander (EDH)',players:'3–5 players, free-for-all (also played 1 v 1)',deck:'Exactly 100 cards, including your commander',copies:'1 of each card (singleton), except basic lands',life:'40',pool:'Almost every card ever printed, minus the Commander banned list',
  how:['Pick a legendary creature as your commander. It starts in the “command zone”, not in your deck, and you can cast it from there.','Every card in the deck must fit your commander’s color identity — the colors of every mana symbol on the commander, including in its rules text.','If your commander dies or is exiled you may send it back to the command zone. Each time you recast it from there it costs {2} more (“commander tax”).','A player who takes 21 combat damage from the same commander loses, whatever their life total.'],
  tip:'The most popular casual format. Games are long and social; decks are built around the commander’s theme.'},
 {k:'standard',n:'Standard',players:'2 players',deck:'60 or more (plus an optional sideboard of up to 15)',copies:'Up to 4 of each card, except basic lands',life:'20',pool:'Only the most recent sets — roughly the last three years. Once a year the oldest sets “rotate” out.',
  how:['The default tournament format, and the one new sets are designed around.','Because it rotates, decks change every year and stay cheaper to keep up with than older formats.','Matches are usually best of three with sideboarding between games.'],tip:'Good if you mostly buy new packs.'},
 {k:'pioneer',n:'Pioneer',players:'2 players',deck:'60 or more (sideboard up to 15)',copies:'Up to 4, except basic lands',life:'20',pool:'Every Standard set from Return to Ravnica (October 2012) onward. It never rotates.',
  how:['A “non-rotating” format: your cards stay legal unless they get banned.','Power level sits between Standard and Modern.'],tip:'A home for Standard cards after they rotate.'},
 {k:'modern',n:'Modern',players:'2 players',deck:'60 or more (sideboard up to 15)',copies:'Up to 4, except basic lands',life:'20',pool:'Every Standard set from Eighth Edition (2003) onward, plus the Modern Horizons sets. It never rotates.',
  how:['Fast, powerful and very diverse — many different deck types are competitive.','Has its own banned list, updated a few times a year.'],tip:'Popular for tournaments at local stores.'},
 {k:'legacy',n:'Legacy',players:'2 players',deck:'60 or more (sideboard up to 15)',copies:'Up to 4, except basic lands',life:'20',pool:'Every card ever printed, minus a banned list',
  how:['Very powerful older cards and combos are legal, so games can be decided in the first few turns.','Cards are banned rather than restricted.'],tip:'Many key cards are old and expensive.'},
 {k:'vintage',n:'Vintage',players:'2 players',deck:'60 or more (sideboard up to 15)',copies:'Up to 4, except basic lands — and only 1 of any card on the restricted list',life:'20',pool:'Every card ever printed. Very few cards are banned; the strongest are “restricted” to one copy instead.',
  how:['The only format where the famous “Power Nine” (Black Lotus, the Moxes…) are legal.','The restricted list is why this app shows “Restricted to 1 copy” for some cards.'],tip:'The most powerful — and most expensive — format.'},
 {k:'pauper',n:'Pauper',players:'2 players',deck:'60 or more (sideboard up to 15)',copies:'Up to 4, except basic lands',life:'20',pool:'Only cards that have been printed at common rarity (in paper or on Magic Online)',
  how:['If a card has ever been a common in any set, every printing of it is legal.','Cheap to build but surprisingly deep and competitive.'],tip:'Great budget format.'},
 {k:'brawl',n:'Brawl',players:'2 players (mostly on MTG Arena)',deck:'Exactly 100 cards, including your commander',copies:'1 of each card (singleton), except basic lands',life:'25 (30 in multiplayer)',pool:'A large, non-rotating pool — on Arena, every card available there',
  how:['Like Commander, but your commander can be a legendary creature or a planeswalker.','Color identity and commander tax work the same as in Commander.','There is no commander-damage rule.'],tip:'On Arena this used to be called Historic Brawl.'},
 {k:'standardbrawl',n:'Standard Brawl',players:'2 players (also multiplayer)',deck:'Exactly 60 cards, including your commander',copies:'1 of each card (singleton), except basic lands',life:'25 (30 in multiplayer)',pool:'Only cards that are legal in Standard',
  how:['A smaller Commander-style format using only current Standard cards.','Your commander can be a legendary creature or a planeswalker.'],tip:'An easy first step toward Commander.'},
 {k:'oathbreaker',n:'Oathbreaker',players:'3–5 players, free-for-all',deck:'Exactly 60 cards: 1 planeswalker (your Oathbreaker), 1 signature spell, and 58 others',copies:'1 of each card (singleton), except basic lands',life:'20',pool:'Almost every card ever printed, minus the Oathbreaker banned list',
  how:['Your Oathbreaker is a planeswalker and sits in the command zone.','Your signature spell is an instant or sorcery in your Oathbreaker’s colors. You can only cast it while your Oathbreaker is on the battlefield.','Both cost {2} more each time they are recast from the command zone.'],tip:'Faster games than Commander.'},
 {k:'paupercommander',n:'Pauper Commander (PDH)',players:'3–5 players, free-for-all',deck:'Exactly 100 cards, including your commander',copies:'1 of each card (singleton), except basic lands',life:'30',pool:'Commander: any uncommon creature. The other 99: commons only.',
  how:['Commander rules, built on a budget.','16 combat damage from the same commander knocks a player out.'],tip:'Very cheap way to play Commander-style games.'},
 {k:'draft',n:'Booster Draft (Limited)',players:'Usually 8 players in a “pod”',deck:'40 or more',copies:'No limit — play as many copies as you drafted',life:'20',pool:'Only the cards you draft, plus as many basic lands as you like',
  how:['Everyone opens a booster pack, keeps one card, and passes the rest to the left. Repeat until the pack is gone.','Do this with three packs (passing right for the second pack), then build a deck from the cards you picked.','About 17 lands and 23 spells is the usual starting point.'],tip:'Everyone starts equal — no collection needed.'},
 {k:'sealed',n:'Sealed Deck (Limited)',players:'Any number',deck:'40 or more',copies:'No limit',life:'20',pool:'Six booster packs that you open yourself, plus as many basic lands as you like',
  how:['Open your six packs and build the best 40-card deck you can from them.','This is the format used at prerelease events.'],tip:'The easiest way to play with a brand-new set.'},
 {k:'2hg',n:'Two-Headed Giant',players:'4 players in two teams of two',deck:'Uses another format’s deck rules (often Sealed: 40 or more)',copies:'As in the format being played',life:'30 per team (shared)',pool:'As in the format being played',
  how:['Teammates sit together, share one life total and take their turns at the same time.','You can show your hand to your teammate and plan together, but you each have your own cards and mana.'],tip:'A fun way to play with a partner.'}];
function fxFormatsView(){const k=V.fmt||'casual',f=FXFMT.find(x=>x.k===k)||FXFMT[0],li=a=>`<ul style="margin:4px 0 0;padding-left:18px">${a.map(x=>`<li>${symHtml(x)}</li>`).join('')}</ul>`;
  return `<div class="f"><label>Choose a format</label><select onchange="V.fmt=this.value;render()">${FXFMT.map(x=>`<option value="${x.k}" ${x.k===f.k?'selected':''}>${esc(x.n)}</option>`).join('')}</select></div>
  <div class="sec fmt"><h3 style="margin:4px 0 8px">${esc(f.n)}</h3>${f.casual?'<p style="font-size:17px;margin:6px 0 10px">Put 60 cards together and go nuts! <span class="mut">(Max 4 of any card besides basic land)</span></p>':
  `<dl style="margin:0"><dt>Players</dt><dd>${esc(f.players)}</dd><dt>Deck size</dt><dd>${esc(f.deck)}</dd><dt>Copies allowed</dt><dd>${esc(f.copies)}</dd><dt>Starting life</dt><dd>${esc(f.life)}</dd><dt>Which cards are legal</dt><dd>${esc(f.pool)}</dd><dt>How it plays</dt><dd>${li(f.how)}</dd><dt>Good to know</dt><dd>${esc(f.tip)}</dd></dl>`}</div>
  <p class="mut" style="font-size:12px">Banned and restricted cards change a few times a year. Open any card in your collection to see where it is legal right now.</p>`}

/* ---------- bulk import (collection + decks) ---------- */
let IMP={stage:'idle',mode:'set',src:'Bulk import',text:'',dname:'',dfmt:'Casual',dtext:'',dadd:false};
const FXCOL={name:['name','card name','card','cardname'],qty:['count','quantity','qty','amount','copies','owned'],setc:['set code','edition code','setcode','set_code'],setn:['set name','edition name','expansion','edition','set'],num:['collector number','card number','collector_number','number','cn'],foil:['foil','finish','printing'],price:['purchase price','my price','price paid','price'],src:['source','pulled from','binder name','location'],notes:['notes','note'],sid:['scryfall id','scryfall_id','scryfallid']};
function fxCSV(text){text=String(text).replace(/^﻿/,'');const first=text.split(/\r?\n/)[0]||'',delim=['\t',';',','].sort((a,b)=>first.split(b).length-first.split(a).length)[0],rows=[];let row=[],cur='',q=false;
  for(let i=0;i<text.length;i++){const ch=text[i];
    if(q){if(ch==='"'){if(text[i+1]==='"'){cur+='"';i++}else q=false}else cur+=ch}
    else if(ch==='"')q=true;else if(ch===delim){row.push(cur);cur=''}else if(ch==='\n'){row.push(cur);rows.push(row);row=[];cur=''}else if(ch!=='\r')cur+=ch}
  if(cur||row.length){row.push(cur);rows.push(row)}return rows.filter(r=>r.some(c=>String(c).trim()))}
function fxRowsToItems(rows){if(!rows.length)return null;const hd=rows[0].map(h=>String(h).trim().toLowerCase()),col={},used=new Set();
  Object.entries(FXCOL).forEach(([k,al])=>{for(const a of al){const i=hd.indexOf(a);if(i>=0&&!used.has(i)){col[k]=i;used.add(i);break}}});
  if(col.name==null)return null;
  return rows.slice(1).map(r=>{const g=k=>col[k]==null?'':String(r[col[k]]??'').trim();let setc=g('setc'),setn=g('setn');if(!setc&&setn&&/^[A-Za-z0-9]{2,6}$/.test(setn)){setc=setn;setn=''}
    const f=g('foil').toLowerCase(),fin=/etch/.test(f)?'Etched Foil':(/^(foil|true|yes|y|1)$/.test(f)||(/foil/.test(f)&&!/non/.test(f)))?'Foil':'Normal';
    return {name:g('name'),qty:Math.max(1,parseInt(g('qty'))||1),set:setc.toLowerCase(),setn,num:g('num'),fin,price:g('price'),src:g('src'),notes:g('notes'),sid:g('sid'),section:''}}).filter(x=>x.name)}
function fxParseList(text){const out=[];let section='';
  String(text).split(/\r?\n/).forEach(l=>{l=l.trim();if(!l||/^(\/\/|#)/.test(l))return;
    if(/^(deck|mainboard|main|main deck|sideboard|commander|companion|maybeboard|considering|about)\s*:?$/i.test(l)){section=l.replace(/:$/,'').toLowerCase();return}
    if(/^name\s+/i.test(l)&&!/^\d/.test(l))return;
    const m=l.match(/^(\d+)\s*x?\s+(.+)$/i);let qty=1,rest=l;if(m){qty=+m[1];rest=m[2]}
    rest=rest.replace(/\s+#!?\S.*$/,'').replace(/\s+\^.*$/,'');let fin='Normal';
    if(/\*F\*|\(foil\)/i.test(rest)){fin='Foil';rest=rest.replace(/\*F\*|\(foil\)/ig,'')}if(/\*E\*/i.test(rest)){fin='Etched Foil';rest=rest.replace(/\*E\*/ig,'')}
    rest=rest.trim();let set='',num='';const p=rest.match(/^(.*?)\s+[\(\[]([A-Za-z0-9]{2,6})[\)\]](?:\s+([A-Za-z0-9\-★]+))?$/);if(p){rest=p[1];set=p[2].toLowerCase();num=p[3]||''}
    rest=rest.trim();if(rest)out.push({name:rest,qty,set,setn:'',num,fin,price:'',src:'',notes:'',sid:'',section})});return out}
function fxParseAny(text){const rows=fxCSV(text),first=(rows[0]||[]).map(h=>String(h).trim().toLowerCase());
  if(rows.length>1&&first.length>1&&first.some(h=>FXCOL.name.includes(h))){const it=fxRowsToItems(rows);if(it)return it}
  return fxParseList(text)}
const fxLoadXLSX=()=>window.XLSX?Promise.resolve():new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';s.onload=ok;s.onerror=no;document.head.appendChild(s)});
async function fxFileText(f){if(/\.xlsx?$/i.test(f.name||'')){await fxLoadXLSX();const wb=XLSX.read(new Uint8Array(await f.arrayBuffer()),{type:'array'});return XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]])}return await f.text()}
// Look cards up on Scryfall in batches of 75. Tries the exact printing first, then falls back to the name alone.
async function fxResolve(items,onProg){
  const post=async ids=>{const r=await fetch('https://api.scryfall.com/cards/collection',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({identifiers:ids})});if(!r.ok)throw new Error('lookup failed');return (await r.json()).data||[]};
  const round=async(list,ident)=>{const uniq=new Map();list.forEach(x=>{const id=ident(x);uniq.set(JSON.stringify(id),id)});const ids=[...uniq.values()],got=[];
    for(let i=0;i<ids.length;i+=75){onProg&&onProg(i,ids.length);got.push(...await post(ids.slice(i,i+75)));await new Promise(r=>setTimeout(r,110))}
    const byId=new Map(),bySN=new Map(),byNS=new Map(),byN=new Map();
    got.forEach(c=>{byId.set(c.id,c);bySN.set(c.set+'|'+String(c.collector_number).toLowerCase(),c);const k=norm(front(c.name));byNS.set(k+'|'+c.set,c);if(!byN.has(k))byN.set(k,c);(c.card_faces||[]).forEach(f=>{const fk=norm(f.name);if(!byN.has(fk))byN.set(fk,c)})});
    list.forEach(x=>{const k=norm(front(x.name));x.card=(x.sid&&byId.get(x.sid))||(x.set&&x.num&&bySN.get(x.set+'|'+String(x.num).toLowerCase()))||(x.set&&byNS.get(k+'|'+x.set))||byN.get(k)||byN.get(norm(x.name))||null;
      if(x.card&&x.set&&x.num&&!x.sid&&norm(front(x.card.name))!==k&&byN.get(k))x.card=byN.get(k)})};
  await round(items,x=>x.sid?{id:x.sid}:x.set&&x.num?{set:x.set,collector_number:String(x.num)}:x.set?{name:front(x.name),set:x.set}:{name:front(x.name)});
  const miss=items.filter(x=>!x.card);if(miss.length)await round(miss,x=>({name:front(x.name)}));
  onProg&&onProg(1,1)}
function fxAddCard(c,n,fin,src,price,notes){
  const nm=c.name;let e=findCard(nm),had=false;fin=fin||'Normal';
  if(e){had=cardSources(e).includes(src);e.finish=mergeFinish(e.finish||'Normal',e.qty,fin,n);e.qty+=n;if(!had)e.source=(e.source&&e.source!=='None'?e.source+', ':'')+src}
  else{const f=c.card_faces?.[0]||c,L={W:'White',U:'Blue',B:'Black',R:'Red',G:'Green'},ci=(c.color_identity||[]).map(x=>L[x]).join('/'),tl=c.type_line||f.type_line||'';
    D.cards.push({name:nm,source:src,colors:ci||(/Land/.test(tl)?'Land':'Colorless'),cost:c.mana_cost||f.mana_cost||'None',cmc:String(c.cmc??0),type:catOf(c),subtype:(tl.split(' — ')[1]||'None'),power:f.power||'None',toughness:f.toughness||'None',
      text:c.oracle_text||f.oracle_text||'',keywords:(c.keywords||[]).join(', ')||'None',legal:c.legalities?.commander==='banned'?'Restricted: Banned in Commander':'None (Sanctioned Legal)',qty:n,finish:fin,status:'Added in app'});e=D.cards[D.cards.length-1];IDX=null}
  if(!e.set||!e.art)Object.assign(e,{art:sImg(c),art2:sImg2(c),set:c.set,setName:c.set_name,cn:c.collector_number,scryId:c.id});
  if(c.legalities){e.leg=legOf(c.legalities);e.legAt=today()}fxSetPrice(e,c);
  ART[e.name]=sImg(c)||ART[e.name]||'';ART2[e.name]=sImg2(c)||ART2[e.name]||'';
  D.acq.push({date:today(),name:nm,set:c.set,cn:c.collector_number,finish:fin,qty:n,source:src,price:price||'',notes:notes||'Bulk import',shared:had});return e}
const fxImpProg=(d,t)=>{const b=document.getElementById('impb'),x=document.getElementById('impt');if(b)b.style.width=Math.max(3,Math.round(d/Math.max(1,t)*100))+'%';if(x)x.textContent=`Looking cards up… ${Math.min(d,t)} of ${t}`};
async function fxImpStart(items,kind){
  if(!items.length)return toast('I couldn’t find any cards in that — check the format in the guide below');
  Object.assign(IMP,{stage:'work',kind,items});render();
  try{if(kind==='deck'){items.forEach(x=>{const c=findCard(x.name);if(c){x.own=c;x.name=c.name}});const need=items.filter(x=>!x.own);if(need.length)await fxResolve(need,fxImpProg);need.forEach(x=>{if(x.card)x.name=x.card.name})}
    else await fxResolve(items,fxImpProg)}
  catch(e){IMP.stage='idle';render();return toast('Couldn’t reach Scryfall to look the cards up — check your internet connection and try again')}
  IMP.stage='preview';render();scrollTo(0,0)}
async function fxImpFile(f){if(!f)return;let t;try{t=await fxFileText(f)}catch(e){return toast('Couldn’t read that file'+(/\.xlsx?$/i.test(f.name)?' (Excel files need internet the first time)':''))}fxImpStart(fxParseAny(t),'collection')}
function fxImpText(){fxImpStart(fxParseAny(IMP.text||''),'collection')}
function fxImpDeck(){if(!(IMP.dname||'').trim())return toast('Give the deck a name first');if(D.decks.some(d=>d.name.toLowerCase()===IMP.dname.trim().toLowerCase()))return toast('You already have a deck with that name');
  const it=fxParseAny(IMP.dtext||'').filter(x=>!/sideboard|maybeboard|considering/.test(x.section||''));fxImpStart(it,'deck')}
function fxImpCancel(){IMP.stage='idle';IMP.items=null;render()}
function fxImpSrc(x){return (x.src||'').trim()||(IMP.mode==='one'?(IMP.src||'').trim()||'Bulk import':x.card.set_name)}
function fxImpCommit(){
  const it=IMP.items||[];
  if(IMP.kind==='collection'){const ok=it.filter(x=>x.card),n=sum(ok,x=>x.qty);
    if(!confirm(`Add ${fxPl(n,'card')} (${fxPl(ok.length,'line')}) to your collection?\n\nCards you already own get their quantity increased — no duplicates are created.`))return;
    ok.forEach(x=>{const fins=(x.card.finishes||['nonfoil']).map(f=>finMap[f]||f),fin=fins.includes(x.fin)?x.fin:fins[0];fxAddCard(x.card,x.qty,fin,canonSrc(fxImpSrc(x)),x.price,x.notes)});
    saveArt();save();IMP.stage='idle';IMP.items=null;IMP.text='';render();toast(`${fxPl(n,'card')} added to your collection`);return}
  const name=IMP.dname.trim(),cards=[],by={};let added=0;
  it.forEach(x=>{if(!x.own&&!x.card)return;const nm=x.name,k=norm(nm);if(by[k])by[k].qty+=x.qty;else{by[k]={name:nm,qty:x.qty,finish:x.own?.finish||'Normal'};cards.push(by[k])}});
  if(!cards.length)return toast('None of those cards could be matched');
  if(!confirm(`Create the deck “${name}” with ${fxPl(sum(cards),'card')}?${IMP.dadd?'\n\nCards you don’t own will also be added to your collection.':''}`))return;
  if(IMP.dadd){const need={};it.forEach(x=>{if(!x.own&&x.card){const k=x.card.id;need[k]=need[k]||{c:x.card,q:0};need[k].q+=x.qty}});Object.values(need).forEach(v=>{fxAddCard(v.c,v.q,'Normal','Deck import: '+name,'','Imported with the deck '+name);added+=v.q});saveArt()}
  const cm=it.find(x=>x.section==='commander'&&(x.own||x.card));
  D.decks.push({name,format:IMP.dfmt,sleeve:'',commander:isCmdFmt(IMP.dfmt)?(cm?cm.name:cards[0].name):'',info:'Imported deck list',cards,tokens:[]});
  save();IMP.stage='idle';IMP.items=null;IMP.dtext='';IMP.dname='';go('decks');V.deck=D.decks.length-1;render();scrollTo(0,0);toast(`Deck created${added?` — ${fxPl(added,'card')} added to your collection`:''}`);fetchArt()}
function fxTemplate(){fxDownload('Name,Quantity,Set code,Collector number,Finish,Source,Price,Notes\r\nLightning Bolt,4,m11,146,Normal,Singles Orders,,\r\nSol Ring,1,c21,263,Foil,Trade,2.50,From Sam\r\nLlanowar Elves,2,,,,,,Only the name is required\r\n','mtg-import-template.csv','text/csv')}
function fxGuide(){fxDownload(`MtG DeckMaster — bulk import guide

1. Open mtg-import-template.csv in Excel, Google Sheets or Numbers.
2. Put one card per row. Only "Name" is required.
     Name              The card's name in English (e.g. Lightning Bolt)
     Quantity          How many copies (blank = 1)
     Set code          The 3-5 letter set code printed at the bottom-left of the card (e.g. M11). Optional.
     Collector number  The number printed next to the set code (e.g. 146). Optional, but with the set code it picks the exact artwork.
     Finish            Normal, Foil or Etched Foil (blank = Normal)
     Source            Where the card came from (e.g. Lorwyn Eclipsed Play Booster 3, Singles Orders, Trade). Blank = the choice you make on the import screen.
     Price             What you paid. Optional.
     Notes             Anything you like. Optional.
3. Delete the three example rows, then save or download the sheet as CSV (.csv). Excel files (.xlsx) also work.
4. In the app: More > Bulk import > Choose a file. Check the preview, then confirm.

You can also paste a plain list instead of using a file, one card per line:
     4 Lightning Bolt
     1 Sol Ring (C21) 263
     2x Llanowar Elves *F*          (*F* = foil)

Files exported from Moxfield, Archidekt, ManaBox, Deckbox and MTGGoldfish can be imported as they are.
Cards you already own get their quantity increased. Nothing is added until you confirm the preview.
`,'mtg-import-guide.txt','text/plain')}
function fxExportCSV(){const q=v=>/[",\n]/.test(String(v))?'"'+String(v).replace(/"/g,'""')+'"':String(v??''),rows=[['Name','Quantity','Set code','Collector number','Finish','Source','Type']];
  D.cards.forEach(c=>{const fm=finMapOf(c);Object.keys(fm).filter(k=>fm[k]>0).forEach(k=>rows.push([c.name,fm[k],c.set||'',c.cn||'',k,c.source&&c.source!=='None'?c.source:'',c.type||'']))});
  fxDownload(rows.map(r=>r.map(q).join(',')).join('\r\n')+'\r\n',`${fxPrefix()}collection_${tsName()}.csv`,'text/csv')}
function fxImportView(){
  if(IMP.stage==='work')return `<h3>Reading your ${IMP.kind==='deck'?'deck list':'cards'}…</h3><p class="mut" id="impt">Looking cards up…</p><div class="pbar"><i id="impb" style="width:3%"></i></div>`;
  if(IMP.stage==='preview'){const it=IMP.items,deck=IMP.kind==='deck',ok=it.filter(x=>x.card||x.own),bad=it.filter(x=>!x.card&&!x.own),own=it.filter(x=>x.own);
    return `<h3>Check before importing</h3><div class="sec"><b>${fxPl(sum(ok,x=>x.qty),'card')}</b> matched on ${fxPl(ok.length,'line')}${deck?` · ${own.length} already in your collection · ${ok.length-own.length} you don’t own`:''}${bad.length?` · <b style="color:#ff6b6b">${bad.length} not found</b>`:''}</div>
    ${bad.length?`<div class="warn"><b>Not found (these will be skipped):</b> ${esc(bad.map(x=>x.name).slice(0,60).join(', '))}${bad.length>60?'…':''}</div>`:''}
    ${tbl(deck?['Qty','Card','Status']:['Qty','Card','Printing','Finish','Source'],ok.slice(0,200).map(x=>deck?[x.qty,x.name,x.own?'✓ in your collection':'not owned'+(IMP.dadd?' — will be added':'')]:[x.qty,x.card.name,`${x.card.set_name} · ${x.card.set.toUpperCase()} #${x.card.collector_number}`,x.fin,canonSrc(fxImpSrc(x))]))}
    ${ok.length>200?`<p class="mut">Showing the first 200 of ${ok.length} lines.</p>`:''}
    <div class="row"><button onclick="fxImpCancel()">Cancel</button><button class="pri" onclick="fxImpCommit()" ${ok.length?'':'disabled'}>${deck?'Create deck':'Add to my collection'}</button></div>`}
  const site=(n,u,t)=>`<li><a href="${u}" target="_blank" rel="noopener">${n}</a> — ${t}</li>`;
  return `<h3>Import cards into your collection</h3><p class="mut">Add many cards at once from a file or a pasted list. You see a preview first — nothing is added until you confirm.</p>
  <div class="f"><label>Where should imported cards say they came from?</label><select onchange="IMP.mode=this.value;render()"><option value="set" ${IMP.mode==='set'?'selected':''}>Each card’s own set (e.g. “Lorwyn Eclipsed”)</option><option value="one" ${IMP.mode==='one'?'selected':''}>One source for everything…</option></select>
  ${IMP.mode==='one'?`<input style="margin-top:8px" value="${esc(IMP.src)}" oninput="IMP.src=this.value" placeholder="e.g. Bulk import, Gift from Sam">`:''}<p class="mut" style="margin:4px 0 0;font-size:12px">A “Source” column in your file always wins over this choice.</p></div>
  <div class="row"><label class="btn pri">📄 Choose a file (CSV, text or Excel)<input type="file" accept=".csv,.tsv,.txt,.xlsx,.xls,text/*" hidden onchange="fxImpFile(this.files[0]);this.value=''"></label></div>
  <div class="f"><label>…or paste a list (one card per line)</label><textarea rows="5" placeholder="4 Lightning Bolt&#10;1 Sol Ring (C21) 263&#10;2x Llanowar Elves *F*" oninput="IMP.text=this.value">${esc(IMP.text)}</textarea></div><div class="row"><button onclick="fxImpText()">Read pasted list</button></div>
  <details class="g"><summary>📝 Template and guide for building your own file</summary><p class="mut">Download the template, fill in one card per row in Excel or Google Sheets, save it as CSV, then choose it above. Only the card name is required; set code + collector number pick the exact artwork.</p><div class="row"><button onclick="fxTemplate()">⬇ CSV template</button><button onclick="fxGuide()">⬇ Guide (text file)</button></div>
  ${tbl(['Column','What goes in it'],[['Name','Card name (required)'],['Quantity','Copies — blank means 1'],['Set code','3–5 letters at the bottom-left of the card, e.g. M11'],['Collector number','The number next to the set code'],['Finish','Normal, Foil or Etched Foil'],['Source','Where it came from, e.g. “Lorwyn Eclipsed Play Booster 3”'],['Price / Notes','Optional']])}</details>
  <details class="g"><summary>🌐 Import from another website or app</summary><p class="mut">These let you build a collection (several by scanning with your camera) and export it as a CSV file. Export there, then use “Choose a file” above — the columns are recognised automatically.</p><ul style="padding-left:18px;margin:6px 0">
  ${site('Moxfield','https://moxfield.com','collection and decks; export the collection as CSV')}${site('Archidekt','https://archidekt.com','collection and decks; CSV export')}${site('ManaBox','https://manabox.app','phone app with a fast card scanner; Collection → top-right menu → export CSV')}${site('Deckbox','https://deckbox.org','inventory export as CSV')}${site('MTGGoldfish','https://www.mtggoldfish.com','collection export as CSV')}</ul><p class="mut" style="font-size:12px">Other scanner apps (Delver Lens, Dragon Shield, TCGplayer) also export CSV files with a card-name column, which is all this import needs. Their menus change over time, so look for “Export” or “Download CSV”.</p></details>
  <h3>Import a deck list</h3><p class="mut">Paste a deck exported as text from Moxfield, Archidekt, MTG Arena or most deck sites (lines like “1 Sol Ring”). A line that says “Commander” before a card marks the commander; sideboard and maybeboard sections are skipped.</p>
  <div class="f"><label>Deck name</label><input value="${esc(IMP.dname)}" oninput="IMP.dname=this.value"><label>Format</label><select onchange="IMP.dfmt=this.value">${fmtOptions(IMP.dfmt)}</select>
  <label>Deck list</label><textarea rows="5" placeholder="Commander&#10;1 Atraxa, Praetors’ Voice&#10;&#10;Deck&#10;1 Sol Ring&#10;10 Forest" oninput="IMP.dtext=this.value">${esc(IMP.dtext)}</textarea>
  <label><input type="checkbox" ${IMP.dadd?'checked':''} onchange="IMP.dadd=this.checked">Also add cards I don’t own to my collection</label></div><div class="row"><button onclick="fxImpDeck()">Read deck list</button></div>
  <h3>Export</h3><p class="mut">Save your collection as a CSV file that other sites, or a friend using this app, can import.</p><div class="row"><button onclick="fxExportCSV()">⬇ Export my collection as CSV</button></div>`}
function fxAfterMore(){if(V.sub==='others')ocDraw();if(V.sub==='matchups')simFill()}

/* ---------- battle simulator ----------
   A simplified model, not a full rules engine: it plays lands, casts spells on curve, attacks and blocks with real
   power/toughness and combat keywords, and understands removal, burn, board wipes, card draw, ramp, tokens, counterspells,
   lifegain and commanders from each card's rules text. Triggered abilities and combos are not modelled. */
const SIMW={a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,x:3};
const simNum=s=>s==null?0:(/^\d+$/.test(s)?+s:(SIMW[String(s).toLowerCase()]||1));
function simCard(c,name){
  if(!c)return {n:name,cmc:3,k:'spell',unk:true};
  const t=String(c.text||'').toLowerCase(),ty=String(c.type||''),kf=String(c.keywords||''),kwl=(kf&&kf!=='None'?kf:t.split('\n').filter(l=>!/[.:]/.test(l)).join(', ')).toLowerCase(),has=w=>new RegExp('\\b'+w+'\\b').test(kwl);
  const o={n:c.name,cmc:Math.max(0,Math.round(parseFloat(c.cmc)||0))};
  if(/land/i.test(ty)){o.k='land';return o}
  const m1=t.match(/deals? (\d+|x) damage to (any target|target player|each opponent|target opponent|target creature or player|any other target|target player or planeswalker)/);if(m1)o.burn=simNum(m1[1]);
  const m2=t.match(/deals? (\d+|x) damage to (?:another )?target (?:creature|attacking|blocking)/);
  if(/destroy target (creature|permanent|nonland|attacking|tapped)|exile target (creature|permanent|nonland)|target creature gets -\d+\/-\d+|target (opponent|player) sacrifices a creature|fights? (another |up to one )?target creature/.test(t))o.kill=99;else if(m2)o.kill=simNum(m2[1]);else if(o.burn)o.kill=o.burn;
  if(/destroy all creatures|exile all creatures|all creatures get -\d|damage to each creature|each player sacrifices all creatures/.test(t))o.wrath=1;
  const m3=t.match(/draws? (a|an|one|two|three|four|five|x|\d+) cards?/);if(m3)o.draw=simNum(m3[1]);
  const m4=t.match(/gains? (\d+|x) life/);if(m4)o.gain=simNum(m4[1]);
  if(/counter target (\w+ )?spell/.test(t))o.counter=1;
  if(/add \{|add (one|two|three) mana|search your library for (a|an|up to \w+) (basic )?(land|forest|plains|island|swamp|mountain)/.test(t))o.ramp=1;
  const m5=t.match(/creates? (a|an|one|two|three|four|five|x|\d+) (?:tapped )?(\d+)\/(\d+)/);if(m5)o.tok={n:simNum(m5[1]),p:+m5[2],t:Math.max(1,+m5[3]),fly:/flying/.test(t.slice(m5.index,m5.index+110))};
  const m6=t.match(/creatures you control get \+(\d+)\/\+(\d+)/);if(m6)o.anthem=[+m6[1],+m6[2]];
  const m7=t.match(/(?:enchanted|equipped) creature gets \+(\d+)\/\+(\d+)/);if(m7)o.aura=[+m7[1],+m7[2]];
  if(/creature/i.test(ty)){o.k='creature';const pi=parseInt(c.power),ti=parseInt(c.toughness);o.p=isNaN(pi)?Math.max(1,o.cmc-1):Math.max(0,pi);o.t=isNaN(ti)?Math.max(1,o.cmc-1):Math.max(1,ti);
    o.fly=has('flying');o.reach=has('reach');o.trample=has('trample');o.haste=has('haste');o.dt=has('deathtouch');o.ll=has('lifelink');o.ds=has('double strike');o.fs=o.ds||has('first strike');o.vig=has('vigilance');o.menace=has('menace');o.def=has('defender');o.ind=has('indestructible');o.hex=has('hexproof')||has('shroud')||has('ward');return o}
  o.k=/planeswalker/i.test(ty)?'pw':'spell';return o}
function simDeck(deck,cards,label){const idx=new Map(cards.map(c=>[norm(front(c.name)),c])),lib=[],unk=new Set();let cmdr=null;const cn=deck.commander?norm(front(deck.commander)):'';
  deck.cards.forEach(e=>{const c=idx.get(norm(front(e.name)));for(let i=0;i<e.qty;i++){const s=simCard(c,e.name);if(s.unk)unk.add(e.name);if(cn&&norm(front(e.name))===cn&&!cmdr&&s.k!=='land'){cmdr=s;continue}lib.push(s)}});
  return {fmt:deck.format||'',name:label||deck.name,lib,cmdr,unk:[...unk],n:lib.length+(cmdr?1:0),cmdFmt:isCmdFmt(deck.format),life:(dfmt(deck.format)||{}).life||20,list:deck.cards.map(e=>`${e.qty} ${e.name}`).join('\n'),commander:deck.commander||''}}
const simShuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const simDraw=(p,n)=>{while(n-->0&&p.lib.length)p.hand.push(p.lib.pop())};
const simP=x=>x.p+x.o.anth[0],simT=x=>x.t+x.o.anth[1];
function simDie(x){const o=x.o,i=o.bf.indexOf(x);if(i>=0)o.bf.splice(i,1);if(x.cz){o.cz=x.c;o.tax+=2}}
function simEnter(me,c,cz){if(c.k==='creature')me.bf.push({c,p:c.p,t:c.t,tap:false,sick:!c.haste,o:me,cz:!!cz})}
function simResolve(c,me,op){
  if(c.k==='creature')simEnter(me,c,c===me.cmdCard);
  if(c.k==='pw')me.pw++;
  if(c.tok)for(let i=0;i<c.tok.n;i++)me.bf.push({c:{n:'token',k:'creature',cmc:0,p:c.tok.p,t:c.tok.t,fly:c.tok.fly},p:c.tok.p,t:c.tok.t,tap:false,sick:true,o:me});
  if(c.wrath&&c.k!=='creature')[...me.bf,...op.bf].forEach(x=>{if(!x.c.ind)simDie(x)});
  if(c.kill||c.burn){const tg=op.bf.filter(x=>!x.c.hex&&(c.kill>=99?!x.c.ind:simT(x)<=c.kill)).sort((a,b)=>(simP(b)+simT(b)+(b.c.fly?2:0))-(simP(a)+simT(a)+(a.c.fly?2:0)))[0];
    if(c.burn&&(op.life<=c.burn||!tg||simP(tg)+simT(tg)<4)){op.life-=c.burn}else if(tg)simDie(tg)}
  if(c.draw)simDraw(me,c.draw);if(c.gain)me.life+=c.gain;if(c.ramp&&c.k!=='creature')me.rocks++;
  if(c.anthem&&c.k!=='creature'){me.anth[0]+=c.anthem[0];me.anth[1]+=c.anthem[1]}
  if(c.aura){const b=[...me.bf].sort((a,b)=>simP(b)-simP(a))[0];if(b){b.p+=c.aura[0];b.t+=c.aura[1]}}}
function simMain(me,op){
  const li=me.hand.findIndex(c=>c.k==='land');if(li>=0){me.hand.splice(li,1);me.lands++}
  let mana=me.lands+me.rocks+me.bf.filter(x=>x.c.ramp&&!x.sick).length;
  const myPow=sum(me.bf,simP),opPow=sum(op.bf,simP);
  const pri=c=>{if(c.counter&&!c.kill&&c.k!=='creature')return -1;if(c.wrath&&c.k!=='creature')return opPow-myPow>=4&&op.bf.length>=2?95:-1;
    if(c.ramp&&c.k!=='creature')return me.lands<6?90:20;
    if(c.k==='creature')return (c.ramp&&me.lands<5?85:60)+c.cmc;
    if(c.kill||c.burn){const tg=op.bf.some(x=>!x.c.hex&&(c.kill>=99||simT(x)<=c.kill));return tg?80:c.burn?(op.life<=c.burn*2||!me.bf.length?45:25):-1}
    if(c.k==='pw')return 62;if(c.tok)return 58;if(c.anthem||c.aura)return me.bf.length?55:-1;if(c.draw)return 50;if(c.gain)return 20;return 15};
  for(let guard=0;guard<30;guard++){
    const opts=me.hand.map(c=>({c,cost:c.cmc,cz:false}));if(me.cz)opts.push({c:me.cz,cost:me.cz.cmc+me.tax,cz:true});
    const pick=opts.filter(o=>o.cost<=mana).map(o=>({o,p:pri(o.c)})).filter(x=>x.p>=0).sort((a,b)=>b.p-a.p||b.o.cost-a.o.cost)[0];if(!pick)break;
    const {c,cost,cz}=pick.o;mana-=cost;if(cz){me.cz=null;me.cmdCard=c}else me.hand.splice(me.hand.indexOf(c),1);
    const ci=op.hand.findIndex(h=>h.counter&&h.k!=='creature'&&h.cmc<=op.open);
    if(ci>=0&&cost>=2&&Math.random()<0.7){op.open-=op.hand[ci].cmc;op.hand.splice(ci,1);if(cz){me.cz=c;me.tax+=2}continue}
    simResolve(c,me,op);if(op.life<=0)break}
  me.open=mana}
function simCombat(me,op){
  let atk=me.bf.filter(x=>!x.tap&&!x.sick&&!x.c.def&&simP(x)>0);if(!atk.length)return;
  const blk=op.bf.filter(x=>!x.tap),canB=(b,a)=>!a.c.fly||b.c.fly||b.c.reach,evas=a=>{const n=blk.filter(b=>canB(b,a)).length;return n===0||(a.c.menace&&n<2)};
  let nb=blk.length,pot=0;[...atk].sort((a,b)=>simP(b)-simP(a)).forEach(a=>{if(evas(a))pot+=simP(a)*(a.c.ds?2:1);else if(nb>0)nb--;else pot+=simP(a)});
  const allIn=pot>=op.life,needDef=!allIn&&sum(op.bf,simP)>=me.life;
  if(!allIn)atk=atk.filter(a=>{if(evas(a))return true;if(needDef&&!a.c.vig)return false;
    const th=blk.filter(b=>canB(b,a)&&(simP(b)>=simT(a)||b.c.dt)&&!a.c.ind);if(!th.length)return true;
    return me.bf.length>op.bf.length&&th.every(b=>simP(a)>=simT(b)&&!b.c.ind&&a.c.cmc<=b.c.cmc)});
  if(!atk.length)return;atk.forEach(a=>{if(!a.c.vig)a.tap=true});
  const free=[...blk],blocks=new Map(),must=sum(atk,a=>simP(a)*(a.c.ds?2:1))>=op.life;
  [...atk].sort((a,b)=>simP(b)-simP(a)).forEach(a=>{const c=free.filter(b=>canB(b,a));if(!c.length||(a.c.menace&&c.length<2))return;
    const surv=b=>b.c.ind||!(simP(a)>=simT(b)||a.c.dt),kills=b=>!a.c.ind&&(simP(b)>=simT(a)||b.c.dt)&&(surv(b)||!(a.c.fs&&!b.c.fs));
    let pick=c.find(b=>surv(b)&&kills(b))||c.find(surv)||c.find(b=>kills(b)&&b.c.cmc<=a.c.cmc+1);
    if(!pick&&must)pick=[...c].sort((x,y)=>(simP(x)+simT(x))-(simP(y)+simT(y)))[0];if(!pick)return;
    const bs=[pick];free.splice(free.indexOf(pick),1);
    if(a.c.menace){const s2=free.filter(b=>canB(b,a)).sort((x,y)=>(simP(x)+simT(x))-(simP(y)+simT(y)))[0];if(!s2){free.push(pick);return}bs.push(s2);free.splice(free.indexOf(s2),1)}
    blocks.set(a,bs)});
  const dead=new Set();
  atk.forEach(a=>{const bs=blocks.get(a),pa=simP(a);
    if(!bs){const d=pa*(a.c.ds?2:1);op.life-=d;if(a.c.ll)me.life+=d;return}
    const bFirst=bs.filter(b=>b.c.fs),fsDmg=sum(bFirst,simP),aDiesFirst=!a.c.fs&&!a.c.ind&&bFirst.length&&(fsDmg>=simT(a)||bFirst.some(b=>b.c.dt));
    if(aDiesFirst){dead.add(a);return}
    let rem=pa;const hit=new Set();bs.forEach(b=>{const need=a.c.dt?1:simT(b),g=Math.min(rem,need);rem-=g;if(g>0&&(g>=simT(b)||a.c.dt)&&!b.c.ind)hit.add(b)});
    if(a.c.trample&&rem>0)op.life-=rem;if(a.c.ll)me.life+=pa;
    const back=a.c.fs?bs.filter(b=>!hit.has(b)||b.c.fs):bs,bd=sum(back,simP);
    if(!a.c.ind&&(bd>=simT(a)||(bd>0&&back.some(b=>b.c.dt))))dead.add(a);hit.forEach(b=>dead.add(b))});
  dead.forEach(simDie)}
function simGame(A,B,first,life){
  const mk=d=>({lib:simShuffle(d.lib.slice()),hand:[],bf:[],lands:0,rocks:0,life,cz:d.cmdr,cmdCard:null,tax:0,open:0,anth:[0,0],pw:0});
  const P=[mk(A),mk(B)];P.forEach(p=>{simDraw(p,7);const l=p.hand.filter(c=>c.k==='land').length;if(l<2||l>5){p.lib=simShuffle(p.lib.concat(p.hand));p.hand=[];simDraw(p,6)}});
  let t=first;
  for(let turn=1;turn<=120;turn++){const me=P[t],op=P[1-t],rnd=Math.ceil(turn/2);
    me.bf.forEach(x=>{x.tap=false;x.sick=false});
    if(turn>1){if(!me.lib.length)return {w:1-t,turns:rnd};simDraw(me,1)}
    if(me.pw&&Math.random()<Math.min(0.9,0.5*me.pw))simDraw(me,1);
    simMain(me,op);if(op.life<=0)return {w:t,turns:rnd};
    simCombat(me,op);if(op.life<=0)return {w:t,turns:rnd};if(me.life<=0)return {w:1-t,turns:rnd};
    t=1-t}
  return {w:-1,turns:60}}
async function simRun(A,B,n,onProg){const life=A.life===B.life?A.life:20,r={n,aw:0,bw:0,dr:0,turns:0,ap:[0,0],ad:[0,0]};
  for(let g=0;g<n;g++){const first=g%2,res=simGame(A,B,first,life),k=first===0?r.ap:r.ad;k[1]++;
    if(res.w===0){r.aw++;k[0]++}else if(res.w===1)r.bw++;else r.dr++;r.turns+=res.turns;
    if(g%50===49){onProg&&onProg(g+1,n);await new Promise(x=>setTimeout(x,0))}}
  r.avg=Math.round(r.turns/n*10)/10;return r}

/* ---------- Matchups page ---------- */
const simMaster=()=>{let s=D.matchups.find(x=>/MASTER MATCHUP/i.test(x.title||''));if(!s){s={title:'1. MASTER MATCHUP SIMULATION SUMMARY LOG',rows:[['Matchup ID','Match Date','Deck A','Deck B','Format','Simulated Matches','Deck A Wins (%)','Deck B Wins (%)','Avg Match Length','Matchup Status']]};D.matchups.unshift(s)}return s};
function fxMatchups(){const ms=D.matchups.find(x=>/MASTER MATCHUP/i.test(x.title||'')),rows=ms?ms.rows.slice(1):[],rest=D.matchups.filter(x=>x!==ms),sims=[...(D.sims||[])].reverse(),pc=(a,b)=>b?Math.round(a/b*1000)/10+'%':'—';
  return `<h3>⚔ Simulate a battle</h3><p class="mut">Pick any two decks — yours or ones from collections other people shared with you. The app plays the games itself and adds the result to the log below.</p>
  <div class="f"><label>Deck A</label><select id="simA" onchange="V.simA=this.value"></select><label>Deck B</label><select id="simB" onchange="V.simB=this.value"></select>
  <label>Number of games</label><select id="simN" onchange="V.simN=+this.value">${[100,500,1000,5000].map(n=>`<option ${(V.simN||1000)===n?'selected':''}>${n}</option>`).join('')}</select></div>
  <div class="row"><button class="pri" onclick="fxSimRun()">⚔ Run simulation</button></div><div id="simout"></div>
  <details class="g"><summary>How accurate is this?</summary><p class="mut">It is a simplified model, not a full rules engine. It plays lands and casts spells on curve, attacks and blocks using real power, toughness and keywords (flying, trample, deathtouch, first strike, lifelink, menace…), and understands removal, burn, board wipes, card draw, ramp, tokens, counterspells, lifegain and commanders from each card’s rules text. Triggered abilities, combos and tricky cards are not modelled, so treat the numbers as a guide to how the decks’ speed and board presence compare. Use “Ask an AI” on a result for a second opinion that understands synergies.</p></details>
  <h3>Simulation log</h3>${rows.length?tbl(['ID','Date','Deck A','Deck B','Format','Games','A wins','B wins','Avg length','Status',''],[...rows].reverse().map(r=>[...r.slice(0,10).map(noEmoji),{h:`<button class="danger" data-rw style="padding:4px 8px" onclick="fxSimDel('${esc(r[0])}')">✕</button>`}])):'<p class="mut">No matchups have been run yet.</p>'}
  ${sims.map(s=>`<details class="g" ${V.simOpen===s.id?'open':''}><summary>${esc(s.id)} · ${esc(simName(s,'a'))} vs ${esc(simName(s,'b'))} · ${pc(s.aw,s.n)} / ${pc(s.bw,s.n)}</summary>
    ${tbl(['',s.a,s.b],[['Overall wins',`${s.aw} (${pc(s.aw,s.n)})`,`${s.bw} (${pc(s.bw,s.n)})`],['Win rate when '+s.a+' goes first',pc(s.ap[0],s.ap[1]),''],['Win rate when '+s.b+' goes first',pc(s.ad[0],s.ad[1]),''],['Draws / stalled games',s.dr,''],['Average game length',s.avg+' turns','']])}
    ${(s.unkA||[]).length||(s.unkB||[]).length?`<p class="mut" style="font-size:12px">Cards the simulator had no data for (treated as plain 3-mana spells): ${esc([...(s.unkA||[]),...(s.unkB||[])].slice(0,30).join(', '))}</p>`:''}
    ${s.note?`<div class="sec"><h4>AI commentary</h4><pre style="white-space:pre-wrap">${esc(s.note)}</pre></div>`:''}
    <div class="row" data-rw><button onclick="fxSimCopy('${s.id}')">📋 Copy AI prompt</button><button onclick="fxSimAsk('${s.id}')">✨ Ask an AI (uses your key)</button></div>
    <div class="f" data-rw><label>Paste the AI’s answer here to keep it with this result</label><textarea rows="3" id="sn-${s.id}">${esc(s.note||'')}</textarea></div><div class="row" data-rw><button onclick="fxSimNote('${s.id}')">Save commentary</button></div></details>`).join('')}
  ${rest.length?`<details class="g"><summary>Earlier analysis from your spreadsheet</summary>${rest.map(s=>`<h3>${esc(s.title)}</h3>${tbl(s.rows[0].map(noEmoji),s.rows.slice(1).map(r=>r.map(noEmoji)))}`).join('')}</details>`:''}`}
async function simFill(){await ocLoad();const a=document.getElementById('simA'),b=document.getElementById('simB');if(!a||!b)return;
  const opts=[...D.decks.map((d,i)=>[`m:${i}`,d.name]),...OC.flatMap(r=>r.data.decks.map((d,i)=>[`o:${r.id}:${i}`,`${d.name} (${r.name})`]))];
  const h=sel=>opts.map(([v,l])=>`<option value="${esc(v)}" ${sel===v?'selected':''}>${esc(l)}</option>`).join('')||'<option value="">No decks yet</option>';
  if(!V.simA||!opts.some(o=>o[0]===V.simA))V.simA=opts[0]?.[0]||'';if(!V.simB||!opts.some(o=>o[0]===V.simB))V.simB=(opts[1]||opts[0]||[''])[0];a.innerHTML=h(V.simA);b.innerHTML=h(V.simB)}
function simPick(v){const p=String(v).split(':');if(p[0]==='m'){const d=D.decks[+p[1]];return d&&Object.assign(simDeck(d,D.cards),{owner:D.uid||'',deck:d.name})}const r=(OC||[]).find(x=>x.id===p[1]),d=r&&r.data.decks[+p[2]];return d&&Object.assign(simDeck(d,r.data.cards,`${d.name} (${r.name})`),{owner:r.uid||'',deck:d.name})}
const simName=(s,k)=>{const o=s[k+'o'],r=o&&o!==D.uid&&(OC||[]).find(x=>x.uid===o&&!x.sep);return r&&s[k+'d']?`${s[k+'d']} (${r.name})`:s[k]};
async function fxSimRun(){const A=simPick(V.simA),B=simPick(V.simB),n=V.simN||1000,out=document.getElementById('simout');if(!A||!B)return toast('Pick two decks first');
  if(V.simA===V.simB&&!confirm('Both sides are the same deck (a mirror match). Run it anyway?'))return;
  for(const d of [A,B])if(d.n<20)return toast(`${d.name} has only ${d.n} cards — add more before simulating`);
  out.innerHTML=`<p class="mut" id="simt">Playing games…</p><div class="pbar"><i id="simb" style="width:2%"></i></div>`;
  const r=await simRun(A,B,n,(d,t)=>{const b=document.getElementById('simb'),x=document.getElementById('simt');if(b)b.style.width=Math.round(d/t*100)+'%';if(x)x.textContent=`Playing games… ${d} of ${t}`});
  const ms=simMaster(),num=Math.max(0,...ms.rows.slice(1).map(x=>parseInt(String(x[0]).replace(/\D/g,''))||0))+1,id='MATCH-'+String(num).padStart(3,'0'),pct=v=>(Math.round(v/n*1000)/10).toFixed(1);
  const fmt=A.fmt&&A.fmt===B.fmt?`${A.fmt} (${fmtSize(A.fmt)} Cards)`:'Mixed formats';
  ms.rows.push([id,today(),A.name,B.name,fmt,String(n),`${r.aw} (${pct(r.aw)}%)`,`${r.bw} (${pct(r.bw)}%)`,`${r.avg} Turns`,'Simulated in app']);
  D.sims.push({id,date:today(),a:A.name,b:B.name,fmt,n,aw:r.aw,bw:r.bw,dr:r.dr,avg:r.avg,ap:r.ap,ad:r.ad,unkA:A.unk,unkB:B.unk,la:A.list,lb:B.list,ca:A.commander,cb:B.commander,ao:A.owner,bo:B.owner,ad:A.deck,bd:B.deck,note:''});
  V.simOpen=id;save();render();toast(`${A.name} ${pct(r.aw)}% — ${B.name} ${pct(r.bw)}%`)}
function fxSimDel(id){if(!confirm(`Remove ${id} from the matchup log?`))return;const ms=simMaster();ms.rows=ms.rows.filter((r,i)=>i===0||r[0]!==id);D.sims=(D.sims||[]).filter(s=>s.id!==id);save();render()}
function fxSimPrompt(s){return `You are an expert Magic: The Gathering analyst. Two decks were played against each other in a simplified simulator (it models mana, creatures, combat keywords, removal, burn, card draw and ramp, but not triggered abilities or combos).

Simulator result over ${s.n} games (${s.fmt}): ${s.a} won ${s.aw}, ${s.b} won ${s.bw}, ${s.dr} drawn or stalled. Average game length ${s.avg} turns.

Please give: (1) your own estimate of the real win rate and whether the simulator is likely over- or under-rating either deck, and why; (2) the key cards and synergies in each deck for this matchup; (3) how each deck should play the matchup; (4) two or three card changes that would improve each deck against the other. Keep it under 350 words.

DECK A — ${s.a}${s.ca?' (commander: '+s.ca+')':''}:
${s.la||'(list not saved)'}

DECK B — ${s.b}${s.cb?' (commander: '+s.cb+')':''}:
${s.lb||'(list not saved)'}`}
const simGet=id=>(D.sims||[]).find(s=>s.id===id);
function fxSimCopy(id){const s=simGet(id);if(!s)return;navigator.clipboard.writeText(fxSimPrompt(s)).then(()=>toast('Prompt copied — paste it into your AI app, then paste its answer back here'),()=>toast('Could not copy'))}
function fxSimNote(id){const s=simGet(id),el=document.getElementById('sn-'+id);if(!s||!el)return;s.note=el.value.trim();V.simOpen=id;save();render();toast('Commentary saved')}
async function fxCallAI(p){const key=AIKEY.trim(),model=G.model.trim();if(!key||!model)throw new Error('Enter your API key on the Deck Generator tab first (Option B). It is kept in memory only.');let r,j,txt='';
  if(G.prov==='anthropic'){r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model,max_tokens:1500,messages:[{role:'user',content:p}]})});j=await r.json();txt=(j.content||[]).map(b=>b.text||'').join('')}
  else if(G.prov==='openai'){r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({model,messages:[{role:'user',content:p}]})});j=await r.json();txt=j.choices?.[0]?.message?.content||''}
  else{r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{parts:[{text:p}]}]})});j=await r.json();txt=(j.candidates?.[0]?.content?.parts||[]).map(x=>x.text||'').join('')}
  if(!r.ok)throw new Error(j.error?.message||'The provider returned an error ('+r.status+').');if(!txt)throw new Error('The AI sent back an empty reply.');return txt}
async function fxSimAsk(id){const s=simGet(id);if(!s)return;toast('Asking the AI…');try{s.note=(await fxCallAI(fxSimPrompt(s))).trim();V.simOpen=id;save();render();toast('Commentary added')}catch(e){toast(String(e&&e.message||e).slice(0,140))}}

/* ---------- card prices (Scryfall, USD) and collection sorting ---------- */
const fxMoney=v=>'$'+(Math.round(v*100)/100).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
const fxUnit=c=>{const p=(c&&c.price)||{},n=+p.n||0,f=+p.f||n,e=+p.e||f;return {Normal:n||f||e,Foil:f||n,'Etched Foil':e||n}};
function fxVal(c){if(!c||!c.price)return 0;const u=fxUnit(c),fm=finMapOf(c);return sum(Object.keys(fm),k=>(fm[k]||0)*(u[k]??u.Normal))}
const fxEach=c=>c&&c.qty?fxVal(c)/c.qty:0;
const fxSetPrice=(e,c)=>{if(c&&c.prices&&(!e.price||!e.scryId||e.scryId===c.id)){e.price={n:c.prices.usd||'',f:c.prices.usd_foil||'',e:c.prices.usd_etched||''};e.priceAt=today()}};
let PRBUSY=false;
async function fetchPrices(force){if(PRBUSY||!D)return;const stale=c=>force||!c.priceAt||(Date.now()-new Date(c.priceAt))>7*864e5,todo=D.cards.filter(c=>isReal(c)&&stale(c));if(!todo.length)return;PRBUSY=true;let got=0;
  const ident=c=>c.scryId?{id:c.scryId}:c.set&&c.cn?{set:String(c.set).toLowerCase(),collector_number:String(c.cn)}:{name:front(c.name)};
  try{for(let i=0;i<todo.length;i+=75){const ch=todo.slice(i,i+75),r=await fetch('https://api.scryfall.com/cards/collection',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({identifiers:ch.map(ident)})});if(!r.ok)throw 0;
    const j=await r.json(),byId=new Map(),bySN=new Map(),byN=new Map();(j.data||[]).forEach(x=>{byId.set(x.id,x);bySN.set(x.set+'|'+x.collector_number,x);if(!byN.has(norm(front(x.name))))byN.set(norm(front(x.name)),x)});
    ch.forEach(c=>{const x=(c.scryId&&byId.get(c.scryId))||(c.set&&c.cn&&bySN.get(String(c.set).toLowerCase()+'|'+c.cn))||byN.get(norm(front(c.name)));if(x&&x.prices){c.price={n:x.prices.usd||'',f:x.prices.usd_foil||'',e:x.prices.usd_etched||''};c.priceAt=today();got++}});
    persist();await new Promise(r=>setTimeout(r,110))}}catch(e){}
  PRBUSY=false;if(got&&V.view==='collection'&&!$('#modal').classList.contains('open')&&document.activeElement?.id!=='q'){const y=scrollY;render();scrollTo(0,y)}}
function fxPriceRow(c){if(!c||!c.price||!findCard(c.name))return '';const u=fxUnit(c),fm=finMapOf(c),ks=Object.keys(fm).filter(k=>fm[k]>0),each=ks.map(k=>`${fxMoney(u[k]??u.Normal)}${ks.length>1?' '+esc(k):''}`).join(' · ');
  if(!fxVal(c))return `<div class="kv"><span>Price</span><b class="mut">no price listed</b></div>`;
  return `<div class="kv"><span>Price <span style="font-weight:400;font-size:11px">(Scryfall, ${esc(c.priceAt||'')})</span></span><b>${each} each${c.qty>1?` · ${fxMoney(fxVal(c))} total`:''}</b></div>`}
const fxTotalTile=()=>{const v=sum(D.cards,fxVal);return v?`<div title="Estimated from Scryfall market prices for the printings you set"><b>${fxMoney(v)}</b>est. value</div>`:''};
const fxDeckValue=d=>{const v=sum(d.cards,e=>e.qty*fxEach(findCard(e.name)));return v?`<span>Value ${fxMoney(v)}</span>`:''};
const FXSORT=[['','Sort: original order'],['new','Sort: newest added first'],['az','Sort: name A → Z'],['za','Sort: name Z → A'],['qty','Sort: most copies first'],['mvlo','Sort: mana value, low → high'],['mvhi','Sort: mana value, high → low'],['prhi','Sort: price, high → low'],['prlo','Sort: price, low → high'],['total','Sort: total value, high → low'],['type','Sort: card type'],['color','Sort: color']];
const fxSortKey=()=>{if(V.sort==null){try{V.sort=localStorage.getItem('mtg_sort_v1')||''}catch(e){V.sort=''}}return V.sort};
const fxSortSel=()=>`<select id="fs" aria-label="Sort">${FXSORT.map(([k,l])=>`<option value="${k}" ${fxSortKey()===k?'selected':''}>${l}</option>`).join('')}</select>`;
function fxSetSort(v){V.sort=v;try{localStorage.setItem('mtg_sort_v1',v)}catch(e){}drawList(true)}
function fxSort(cs){const k=fxSortKey(),mv=c=>parseFloat(c.cmc)||0,nm=(a,b)=>a.name.localeCompare(b.name);if(!k)return cs;const a=[...cs];
  return k==='new'?a.reverse():k==='az'?a.sort(nm):k==='za'?a.sort((x,y)=>nm(y,x)):k==='qty'?a.sort((x,y)=>y.qty-x.qty||nm(x,y)):k==='mvlo'?a.sort((x,y)=>mv(x)-mv(y)||nm(x,y)):k==='mvhi'?a.sort((x,y)=>mv(y)-mv(x)||nm(x,y)):
    k==='prhi'?a.sort((x,y)=>fxEach(y)-fxEach(x)||nm(x,y)):k==='prlo'?a.sort((x,y)=>(fxEach(x)||1e9)-(fxEach(y)||1e9)||nm(x,y)):k==='total'?a.sort((x,y)=>fxVal(y)-fxVal(x)||nm(x,y)):k==='type'?a.sort((x,y)=>String(x.type).localeCompare(String(y.type))||nm(x,y)):a.sort((x,y)=>String(x.colors).localeCompare(String(y.colors))||nm(x,y))}
const fxBadge=c=>'×'+c.qty+(/^(prhi|prlo|total)$/.test(fxSortKey())&&fxVal(c)?' · '+fxMoney(V.sort==='total'?fxVal(c):fxEach(c)):'');

/* ---------- identity: every collection has a permanent ID, a changeable name, and a signing key ----------
   No server: the ID is a random UUID made on the device and stored inside the data, so it travels with backups.
   Share files are signed with a private key that never leaves the app or the owner's own backups. */
const FX_SITE='https://dakeera.github.io/mtg-collection/';
const fxUuid=()=>crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=crypto.getRandomValues(new Uint8Array(1))[0]&15;return (c==='x'?r:(r&3|8)).toString(16)});
function fxCode(uid){try{const hex=String(uid).replace(/[^0-9a-f]/gi,'').slice(0,10);if(hex.length<10)return String(uid).slice(0,9).toUpperCase();const A='0123456789ABCDEFGHJKMNPQRSTVWXYZ';let n=BigInt('0x'+hex),s='';for(let i=0;i<8;i++){s=A[Number(n&31n)]+s;n>>=5n}return s.slice(0,4)+'-'+s.slice(4)}catch(e){return ''}}
const fxPrefix=()=>(fxSlug(D.owner).replace(/-$/,'')||'mtg')+'_'+(D.uid?fxCode(D.uid)+'_':'');
const fxSubtle=()=>(window.crypto&&crypto.subtle)||null,FXEC={name:'ECDSA',namedCurve:'P-256'},FXSG={name:'ECDSA',hash:'SHA-256'};
const fxB64=buf=>{let s='';new Uint8Array(buf).forEach(b=>s+=String.fromCharCode(b));return btoa(s)},fxUnB64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const fxPubId=p=>p?String(p.x)+'.'+String(p.y):'';
async function fxKeys(){const T=D,s=fxSubtle();if(!T||T.keys||!s)return;try{const k=await s.generateKey(FXEC,true,['sign','verify']);T.keys={pub:await s.exportKey('jwk',k.publicKey),priv:await s.exportKey('jwk',k.privateKey)};if(!RO&&T===D)persist()}catch(e){}}
async function fxSign(text){const s=fxSubtle();if(!s||!D.keys)return null;try{const k=await s.importKey('jwk',D.keys.priv,FXEC,false,['sign']);return fxB64(await s.sign(FXSG,k,new TextEncoder().encode(text)))}catch(e){return null}}
async function fxVerify(text,sig,pub){const s=fxSubtle();if(!s||!sig||!pub)return false;try{const k=await s.importKey('jwk',pub,FXEC,false,['verify']);return await s.verify(FXSG,k,fxUnB64(sig),new TextEncoder().encode(text))}catch(e){return false}}
function fxIdentity(name){if(!D.uid){D.uid=fxUuid();D.created=D.created||today()}if(name!=null)D.owner=name;D.friends=D.friends||[];fxKeys()}
function fxInitId(){D.friends=D.friends||[];if(!D.uid&&(D.cards.length||D.decks.length))fxIdentity();else if(D.uid&&!D.keys)fxKeys()}
function fxWelcome(){if(D.uid||D.cards.length||D.decks.length||V.noWelcome)return false;$('#nav').innerHTML='';
  $('#main').innerHTML=`<div style="max-width:460px;margin:6vh auto 0;text-align:center"><img src="icons/icon-192.png" alt="" style="width:96px;height:96px;border-radius:22px"><h2>Welcome to MtG DeckMaster</h2>
  <p class="mut">Track your Magic cards and decks. Everything stays on this device — there is no account and no login.</p>
  <div class="f" style="text-align:left"><label>Name your collection</label><input id="wname" maxlength="40" placeholder="e.g. Nick’s collection"></div><br><button class="pri big" style="width:100%" onclick="fxStart()">Start my collection</button>
  <p class="mut" style="margin:18px 0 6px">Already have one?</p><label class="btn big" style="display:block">⬆ Restore my backup<input type="file" accept=".json,.sqlite,.db,application/json,application/octet-stream" hidden onchange="fxOpenFile(this.files[0],'restore');this.value=''"></label>
  <p><button style="background:none;border:0;text-decoration:underline;color:var(--mut)" onclick="V.noWelcome=1;render()">Just look around</button></p>
  <p class="mut" style="font-size:12px">Your collection gets its own permanent ID. You can rename the collection any time; the ID stays the same and comes back whenever you restore a backup.</p></div>`;return true}
function fxStart(){fxIdentity(($('#wname').value||'').trim()||'My collection');persist();render();toast('Collection created')}
function fxRename(v){D.owner=String(v||'').trim();save();toast('Collection name saved — your ID stays the same')}
function fxAsk(title,body,btns){window.FXASK=btns.map(b=>()=>{closeM();b.fn&&b.fn()});
  openM(`<h3>${title}</h3>${body}<div style="display:flex;flex-direction:column;gap:10px;margin-top:14px">${btns.map((b,i)=>`<button class="${b.cls||''}" style="padding:13px" onclick="FXASK[${i}]()">${b.t}</button>`).join('')}</div>`)}
const fxWho=(name,uid)=>`<b>${esc(name||'(no name)')}</b>${uid?` <span class="mut">· ID ${esc(fxCode(uid))}</span>`:' <span class="mut">· no ID (older file)</span>'}`;

/* ---------- one way in for every file: backup, share file, or someone else's backup ---------- */
async function fxOpenFile(f,hint){if(!f)return;let j;try{j=await fxReadBackup(f)}catch(e){return toast('That file isn’t a MtG DeckMaster backup or share file')}
  if(j.kind==='mtg-share')return fxGotShare(j);if(j.xfer)return fxGotDevice(j);return fxGotBackup(j,f,hint)}
function fxRestoreAsk(j){let m=`Restore this backup? It replaces everything currently in the app (${D.cards.length} card titles, ${fxPl(D.decks.length,'deck')}).`;
  if(j.updated&&D.updated&&j.updated<D.updated-60000&&D.cards.length)m+=`\n\n⚠ This backup is OLDER than what is in the app now.\nBackup last changed: ${new Date(j.updated).toLocaleString()}\nApp last changed: ${new Date(D.updated).toLocaleString()}\nAnything you changed since then will be lost.`;
  if(confirm(m))fxRestore(j)}
function fxRestore(j){D=j;D.acq=D.acq||[];D.edits=D.edits||[];D.flags=D.flags||[];D.kept=D.kept||{};D.loans=D.loans||[];normSources();fxMigrate();fxInitId();DRAFT=null;V.noWelcome=0;save();stamp();closeM();toast('Backup restored');render();fetchArt()}
function fxGotBackup(j,f,hint){const empty=!D.cards.length&&!D.decks.length,same=j.uid&&D.uid&&j.uid===D.uid;
  const asFriend=()=>fxSaveFriend({uid:j.uid||('old-'+fxUuid()),name:j.owner||String(f.name||'Collection').replace(/\.[^.]+$/,'').replace(/[_-]?(mtg-)?backup.*$/i,'').replace(/_[0-9A-Z]{4}-[0-9A-Z]{4}$/,'')||'Collection',updated:j.updated||f.lastModified||Date.now(),pub:j.keys?j.keys.pub:null,cards:j.cards,decks:j.decks,scope:'all'},'unverified',{});
  if(same||(empty&&hint!=='view'))return fxRestoreAsk(j);
  const info=`<div class="sec">${fxWho(j.owner,j.uid)}<br><span class="mut">${j.cards.length} card titles · ${fxPl(j.decks.length,'deck')}${j.updated?' · last changed '+esc(fxDate(j.updated)):''}</span></div>`;
  fxAsk('Whose collection is this?',info+`<p class="mut">${j.uid&&D.uid?'This file belongs to a <b>different collection</b> than the one in this app.':'This backup was made by an older version of the app, so it has no ID and I can’t tell whose it is.'} ${empty?'':'Your own collection stays untouched unless you choose to replace it.'}</p>`,
    [{t:'👁 View it (add to Other collections)',cls:hint==='view'||!empty?'pri':'',fn:asFriend},{t:empty?'Use it as my collection':'Replace my collection with it',cls:empty?'':'danger',fn:()=>fxRestoreAsk(j)},{t:'Cancel'}])}
async function fxGotShare(j){const {sig,...rest}=j;let st='unsigned';if(sig&&j.pub)st=(await fxVerify(JSON.stringify(rest),sig,j.pub))?'signed':'bad';
  const info=`<div class="sec">${fxWho(j.name,j.uid)}<br><span class="mut">${j.scope==='deck'?'Deck: '+esc(j.decks[0]?.name||''):j.cards.length+' card titles · '+fxPl(j.decks.length,'deck')}${j.updated?' · last changed '+esc(fxDate(j.updated)):''}</span></div>`,empty=!D.cards.length&&!D.decks.length;
  if(D.uid&&j.uid===D.uid&&j.scope!=='deck')return fxAsk('This is your own share file',info+'<p class="mut">A share file holds your cards and decks, but not your private notes, logs, sleeves or signing key. A backup file is the better way to restore. You can still use this one.</p>',[{t:'Restore my cards and decks from it',fn:()=>fxRecover(j,'mine')},{t:'Cancel'}]);
  await ocLoad();const ex=OC.find(r=>r.uid===j.uid&&!r.sep&&!r.link),known=ex?ex.pub:((D.friends||[]).find(x=>x.uid===j.uid)||{}).pub,keyOK=!known||(j.pub&&fxPubId(known)===fxPubId(j.pub)),who=ex?ex.name:j.name;
  const good=st==='signed'?'signed':'unverified';
  if(st==='bad')return fxAsk('⚠ This file was changed',info+'<p>The signature doesn’t match the contents. The file was edited after it was created, or it is damaged.</p><p class="mut">You can still open it. It will be marked “unverified”'+(ex?' and saved separately, so the trusted copy you already have is not replaced.':'.')+'</p>',[{t:'Import anyway (unverified)',fn:()=>fxSaveFriend(j,'unverified',{separate:!!ex})},{t:'Cancel',cls:'pri'}]);
  if(!keyOK)return fxAsk('⚠ Signature doesn’t match',info+`<p>You already know <b>${esc(who)}</b> under this ID, but this file ${st==='unsigned'?'is <b>not signed</b>':'is signed with a <b>different key</b>'}.</p><p class="mut">That happens when they reset the app or recovered their collection without a backup${st==='unsigned'?', or made the file with an older version':''}. It could also be a file from someone else using their ID. If you’re not sure, ask them.</p>`,
    [{t:`Trust it — update ${esc(who)} and remember this signature`,fn:()=>fxSaveFriend(j,good,{trust:true})},{t:'Keep both — save it separately as unverified',fn:()=>fxSaveFriend(j,'unverified',{separate:true})},{t:'Cancel',cls:'pri'}]);
  if(empty&&j.scope!=='deck')return fxAsk('A share file',info+'<p class="mut">Your app has no collection yet. What would you like to do with this one?</p>',[{t:'👁 View it (it belongs to someone else)',cls:'pri',fn:()=>fxSaveFriend(j,good,{})},{t:'It was mine — recover it (keeps the same ID)',fn:()=>fxRecover(j,'recover')},{t:'Start my collection from a copy (new ID)',fn:()=>fxRecover(j,'copy')},{t:'Cancel'}]);
  fxSaveFriend(j,good,{})}
function fxRecover(j,mode){if(mode==='mine'&&!confirm(`Replace your current cards and decks (${D.cards.length} titles, ${fxPl(D.decks.length,'deck')}) with the ones in this share file?\n\nYour logs, sleeves and ID are kept.`))return;
  D.cards=j.cards;D.decks=j.decks;D.loans=[];if(mode!=='mine'){D.owner=mode==='copy'?(j.name||'My')+' (copy)':j.name;D.uid=mode==='recover'?j.uid:fxUuid();D.created=today();D.keys=null;fxKeys()}
  normSources();IDX=null;DRAFT=null;V.noWelcome=0;save();render();fetchArt();toast(mode==='recover'?'Collection recovered — friends will be asked to trust your new signature':'Done')}
function fxFriendIndex(rec,del){const F=RO?(MINE.D.friends=MINE.D.friends||[]):(D.friends=D.friends||[]),i=F.findIndex(x=>x.uid===rec.uid);if(del){if(i>=0)F.splice(i,1)}else if(!rec.sep&&!rec.link){const e={uid:rec.uid,name:rec.name,pub:rec.pub||null};i>=0?F[i]=e:F.push(e)}if(!RO)save()}
async function fxSaveFriend(j,status,opt){await ocLoad();const ex=opt.separate?null:OC.find(r=>r.uid===j.uid&&!r.sep&&!!r.link===!!opt.link),nick=((D.friends||[]).find(x=>x.uid===j.uid)||{}).name;
  let data={cards:j.cards,decks:j.decks,owner:j.name,updated:j.updated},msg='';
  if(j.scope==='deck'&&ex){data=JSON.parse(JSON.stringify(ex.data));j.decks.forEach(d=>{const i=data.decks.findIndex(x=>x.name===d.name);i>=0?data.decks[i]=d:data.decks.push(d)});j.cards.forEach(c=>{const i=data.cards.findIndex(x=>norm(x.name)===norm(c.name));if(i<0)data.cards.push(c);else if(ex.partial)data.cards[i]=c});msg=`Deck “${j.decks[0].name}” added to ${ex.name}`}
  else if(ex){const o=new Set(ex.data.cards.map(c=>norm(c.name))),n=new Set(j.cards.map(c=>norm(c.name))),add=[...n].filter(x=>!o.has(x)).length,rem=[...o].filter(x=>!n.has(x)).length,dd=j.decks.length-ex.data.decks.length;
    msg=`${ex.name} updated: ${add?'+'+add+' ':''}${rem?'−'+rem+' ':''}${add||rem?'card titles':'no card changes'}${dd?`, ${dd>0?'+':''}${dd} deck${Math.abs(dd)===1?'':'s'}`:''}`}
  const rec={id:ex?ex.id:'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),uid:j.uid,name:ex?ex.name:(opt.separate?(j.name||'Collection')+' (unverified copy)':(opt.link?opt.nick:nick)||opt.nick||j.name||'Collection'),given:j.name,updated:j.scope==='deck'&&ex?Math.max(ex.updated||0,j.updated||0):j.updated,added:ex?ex.added:Date.now(),
    pub:opt.trust||!ex||!ex.pub?(j.pub||null):ex.pub,status:j.scope==='deck'&&ex?ex.status:status,partial:j.scope==='deck'?(ex?!!ex.partial:true):false,sep:!!opt.separate,link:!!opt.link,data};
  try{await fxTx('readwrite',st=>st.put(rec))}catch(e){toast('Could not save that collection (storage full?)');return null}
  fxFriendIndex(rec);toast(msg||`${rec.name} added to Other collections${status==='signed'?' ✓ verified':''}`);if(!opt.quiet){V.view='more';V.sub='others';render()}return rec}

/* ---------- sharing: signed share files and deck links ---------- */
async function fxShareData(scope,i){const keep=['name','colors','cost','cmc','type','subtype','power','toughness','text','keywords','qty','finish','set','setName','cn','scryId','art','art2','leg','legAt','price','priceAt','verified'];
  let decks=D.decks.map(d=>({name:d.name,format:d.format,commander:d.commander||'',cards:d.cards.map(e=>({name:e.name,qty:e.qty,finish:e.finish||'Normal'})),tokens:d.tokens||[]})),cards=D.cards;
  if(scope==='deck'){decks=[decks[i]];const s=new Set(decks[0].cards.map(e=>norm(e.name)));cards=cards.filter(c=>s.has(norm(c.name)))}
  const body={kind:'mtg-share',v:1,scope,uid:D.uid,name:D.owner||'Collection',updated:D.updated||Date.now(),pub:D.keys?D.keys.pub:null,cards:cards.map(c=>{const o={};keep.forEach(k=>{if(c[k]!=null)o[k]=c[k]});return o}),decks};
  const txt=JSON.stringify(body),sig=await fxSign(txt);return JSON.stringify(Object.assign(JSON.parse(txt),{sig}))}
async function fxSend(text,name){const blob=new Blob([text],{type:'application/json'});
  if(isNative()){try{await nativeSave(blob,name,true)}catch(e){toast('Could not share the file: '+String(e&&e.message||e).slice(0,80))}return}
  try{const file=new File([blob],name,{type:'application/json'});if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:name});return}}catch(e){if(e&&e.name==='AbortError')return}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();toast('Share file saved to Downloads — send it to your friend')}
async function fxShareFile(scope,i){if(!D.uid)fxIdentity();if(!D.keys)await fxKeys();
  const name=`${fxPrefix()}${scope==='deck'?'deck-'+(fxSlug(D.decks[i].name).replace(/-$/,'')||'deck')+'_':''}share_${tsName()}.json`;fxSend(await fxShareData(scope,i),name)}
async function fxPack(o){const b=new TextEncoder().encode(JSON.stringify(o));let out=b,z='j';try{if(window.CompressionStream){out=new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());z='z'}}catch(e){out=b;z='j'}
  return z+fxB64(out).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
async function fxUnpack(s){const z=s[0];let b=fxUnB64(s.slice(1).replace(/-/g,'+').replace(/_/g,'/'));if(z==='z')b=new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());return JSON.parse(new TextDecoder().decode(b))}
async function fxDeckLink(i){const d=D.decks[i];if(!D.uid)fxIdentity();const base=!isNative()&&/^https?:/.test(location.protocol)?new URL('d/',location.origin+location.pathname).href:FX_SITE+'d/',url=base+'#d='+await fxPack({n:d.name,f:d.format,c:d.commander||'',o:D.owner||'',u:D.uid||'',l:d.cards.map(e=>[e.qty,e.name])});
  try{if(isNative()&&window.Capacitor.Plugins.Share){await window.Capacitor.Plugins.Share.share({title:d.name,text:`${d.name} — a MtG DeckMaster deck`,url,dialogTitle:'Share deck link'});return}
    if(navigator.share){await navigator.share({title:d.name,url});return}}catch(e){if(e&&(e.name==='AbortError'||/cancel/i.test(String(e.message))))return}
  navigator.clipboard.writeText(url).then(()=>toast('Deck link copied — paste it into a message'),()=>prompt('Copy this link:',url))}
function fxShareDeck(i){const d=D.decks[i];fxAsk(`Share “${esc(d.name)}”`,'<p class="mut"><b>File</b>: signed, includes the card details, opens in the app under Other collections.<br><b>Link</b>: quickest — opens the web version with the deck ready to view. Links aren’t signed.</p>',[{t:'📄 Send as a file',cls:'pri',fn:()=>fxShareFile('deck',i)},{t:'🔗 Share as a link',fn:()=>fxDeckLink(i)},{t:'Cancel'}])}
function fxCardObj(c,src,n,fin){const f=c.card_faces?.[0]||c,L={W:'White',U:'Blue',B:'Black',R:'Red',G:'Green'},ci=(c.color_identity||[]).map(x=>L[x]).join('/'),tl=c.type_line||f.type_line||'';
  return {name:c.name,source:src,colors:ci||(/Land/.test(tl)?'Land':'Colorless'),cost:c.mana_cost||f.mana_cost||'None',cmc:String(c.cmc??0),type:catOf(c),subtype:(tl.split(' — ')[1]||'None'),power:f.power||'None',toughness:f.toughness||'None',
    text:c.oracle_text||f.oracle_text||'',keywords:(c.keywords||[]).join(', ')||'None',legal:c.legalities?.commander==='banned'?'Restricted: Banned in Commander':'None (Sanctioned Legal)',qty:n,finish:fin||'Normal',status:'Added in app'}}
async function fxOpenLink(text){const m=String(text||'').match(/[#?&]d=([A-Za-z0-9_\-]+)/);if(!m)return toast('That doesn’t look like a deck link');let o;try{o=await fxUnpack(m[1]);if(!o||!Array.isArray(o.l)||!o.n)throw 0}catch(e){return toast('That deck link is damaged or incomplete')}
  const n=sum(o.l,x=>+x[0]||0);fxAsk('A deck was shared with you',`<div class="sec"><b>${esc(o.n)}</b> <span class="mut">· ${esc(o.f||'')} · ${fxPl(n,'card')}</span><br>from ${fxWho(o.o||'someone',o.u)}</div><p class="mut">Links aren’t signed, so the sender can’t be verified. The deck is view-only until you copy it to your own decks.</p>`,[{t:'👁 View the deck',cls:'pri',fn:()=>fxLinkImport(o)},{t:'Cancel'}])}
async function fxLinkImport(o){toast('Looking the cards up…');const items=o.l.map(([q,nm])=>({name:String(nm),qty:+q||1,set:'',num:'',sid:''})),need=[];
  items.forEach(x=>{const c=findCard(x.name);if(c)x.own=c;else need.push(x)});try{if(need.length)await fxResolve(need)}catch(e){return toast('Couldn’t reach Scryfall to look the cards up — check your internet connection')}
  const cards=[],seen=new Set();items.forEach(x=>{const src=x.own||(x.card&&Object.assign(fxCardObj(x.card,'',x.qty),{art:sImg(x.card),set:x.card.set,setName:x.card.set_name,cn:x.card.collector_number,scryId:x.card.id,leg:legOf(x.card.legalities)}));if(!src)return;x.name=src.name;if(seen.has(norm(src.name)))return;seen.add(norm(src.name));const c=JSON.parse(JSON.stringify(src));delete c.source;c.qty=x.qty;cards.push(c)});
  const uid=o.u||('link-'+fxUuid()),rec=await fxSaveFriend({uid,name:o.o||'Shared decks',updated:Date.now(),pub:null,scope:'deck',cards,decks:[{name:o.n,format:o.f||'Casual',commander:o.c||'',cards:items.map(x=>({name:x.name,qty:x.qty,finish:'Normal'})),tokens:[]}]},'unverified',{link:true,quiet:true,nick:(o.o||'Someone')+' — shared by link'});
  if(rec){await roOpen(rec.id);const i=D.decks.findIndex(d=>d.name===o.n);if(i>=0){V.view='decks';V.deck=i;render()}}}
function fxCheckLink(){try{if(/#d=/.test(location.hash)){const h=location.hash;history.replaceState(history.state,'',location.pathname+location.search);fxOpenLink(h)}}catch(e){}}
addEventListener('hashchange',()=>fxCheckLink());
const fxRoDeckBtns=i=>RO?`<div class="row"><button class="pri" onclick="fxCopyDeck(${i})">＋ Copy to my decks</button><button onclick="fxSimVs(${i})">⚔ Simulate vs my decks</button></div>`:'';
function fxCopyDeck(i){const d=D.decks[i],from=RO.name;roExit();let nm=`${d.name} (from ${from})`,k=2;while(D.decks.some(x=>x.name.toLowerCase()===nm.toLowerCase()))nm=`${d.name} (from ${from}) ${k++}`;
  const cards=d.cards.map(e=>({name:(findCard(e.name)||e).name,qty:e.qty,finish:'Normal'})),own=cards.filter(e=>{const c=findCard(e.name);return c&&(c.type==='Basic Land'||c.qty>=e.qty)}).length;
  D.decks.push({name:nm,format:d.format||'Casual',sleeve:'',commander:d.commander||'',info:'Copied from '+from,cards,tokens:[]});save();V.view='decks';V.deck=D.decks.length-1;render();scrollTo(0,0);
  fxAsk('Deck copied to your decks',`<p>You own enough copies of <b>${own} of ${cards.length}</b> card titles in this deck.</p><p class="mut">Cards you don’t own are still on the list, so you can see what you’d need to get. No cards were added to your collection.</p>`,[{t:'Done',cls:'pri'}])}
function fxSimVs(i){const id=RO.id;roExit();V.view='more';V.sub='matchups';V.simB=`o:${id}:${i}`;render();scrollTo(0,0)}
function fxProfileView(){if(!D.uid)return `<p class="mut">You’re just looking around, so this app has no collection yet.</p><div class="f"><label>Name your collection</label><input id="wname" maxlength="40" placeholder="e.g. Nick’s collection"></div><div class="row"><button class="pri" onclick="fxStart()">Start my collection</button><label class="btn">⬆ Restore my backup<input type="file" hidden onchange="fxOpenFile(this.files[0],'restore');this.value=''"></label></div>`;
  const v=sum(D.cards,fxVal),kv=(a,b)=>`<div class="kv"><span>${a}</span><b>${b}</b></div>`;
  return `<div class="sec"><div class="f" style="margin-bottom:10px"><label>Collection name</label><input value="${esc(D.owner||'')}" maxlength="40" placeholder="e.g. Nick’s collection" onchange="fxRename(this.value)"></div>
  ${kv('Collection ID',`${esc(fxCode(D.uid))} <button style="padding:3px 8px;margin-left:6px" onclick="navigator.clipboard.writeText('${esc(fxCode(D.uid))}').then(()=>toast('ID copied'))">Copy</button>`)}${kv('Created',esc(D.created||'—'))}${kv('Cards',`${sum(D.cards)} <span class="mut">(${D.cards.length} titles)</span>`)}${kv('Decks',D.decks.length)}${v?kv('Estimated value',fxMoney(v)):''}${kv('Last changed',D.updated?esc(new Date(D.updated).toLocaleString()):'—')}${kv('Signature',D.keys?'✓ files you share are signed':'<span class="mut">not available on this device</span>')}</div>
  <p class="mut">The name can change whenever you like. The ID never changes: it is stored inside your data, appears in your file names, and comes back when you restore a backup — even on a new phone.</p>
  <div class="row"><button class="pri" onclick="V.sub='backup';render();scrollTo(0,0)">💾 Back up</button><button onclick="fxShareFile('all')">📤 Share my collection</button></div>
  <div class="row"><button onclick="fxSendDevice()">📲 Send to my other device</button></div>
  <div class="row"><label class="btn">📂 Open a file (backup or share file)<input type="file" accept=".json,.sqlite,.db,application/json,application/octet-stream" hidden onchange="fxOpenFile(this.files[0]);this.value=''"></label></div>
  <details class="g"><summary>Backup file or share file — which one?</summary><p class="mut"><b>Backup</b> (More → Backup): private and complete. It includes your notes, logs, sleeves and the secret key that signs your files. Keep it to yourself and use it to restore.</p><p class="mut"><b>Share file</b>: made for other people. It has your cards and decks only, and it is signed so their app can tell it really came from you. To share one deck, open the deck and tap “Share deck”.</p></details>
  <details class="g"><summary>Using more than one device</summary><p class="mut">Your collection lives on each device separately — there is no account or cloud sync. To move it, tap <b>Send to my other device</b> here, send the file to yourself, then on the other device open it with <b>Open a file</b> (or “Restore my backup” on a new device). The app checks it is the same collection ID and tells you which copy is newer before replacing anything.</p><p class="mut">Tip: treat one device as your “main” one, and send from it after a session of changes. Changes made on two devices at the same time can’t be merged — the copy you send replaces the other.</p></details>`}

/* ---------- deck links that open the Android app ---------- */
function fxNativeLinks(){try{if(!isNative())return;const A=window.Capacitor.Plugins.App;if(!A)return;const go=u=>{if(/[#?&]d=[A-Za-z0-9_\-]+/.test(String(u||'')))fxOpenLink(u)};
  A.addListener('appUrlOpen',e=>go(e&&e.url));A.getLaunchUrl().then(r=>go(r&&r.url)).catch(()=>{})}catch(e){}}

/* ---------- building a deck by hand ---------- */
let FXB=[];
function fxBuilder(first){const i=V.deck,d=D.decks[i];if(RO||!d)return;
  if(first){V.bq='';V.bt='';V.bc='';V.bfree=false;const types=[...new Set(D.cards.filter(isReal).map(c=>c.type))].sort();
    openM(`<h3>Add cards to ${esc(d.name)}</h3><div id="bhead" class="sec" style="position:sticky;top:0;z-index:2"></div>
    <input id="bq" type="search" placeholder="Search name or rules text…" style="width:100%" oninput="V.bq=this.value;fxBuilder()">
    <div class="brow" style="margin:8px 0"><select onchange="V.bt=this.value;fxBuilder()"><option value="">All types</option>${types.map(x=>`<option>${esc(x)}</option>`).join('')}</select><select onchange="V.bc=this.value;fxBuilder()"><option value="">All colors</option>${['White','Blue','Black','Red','Green','Colorless','Land'].map(x=>`<option>${x}</option>`).join('')}</select></div>
    <label style="margin:0 0 8px"><input type="checkbox" onchange="V.bfree=this.checked;fxBuilder()">Only show cards with a copy that isn’t in another deck</label><div id="bres"></div><div class="row"><button class="pri" onclick="closeM()">Done</button></div>`)}
  const el=document.getElementById('bres');if(!el)return;const q=(V.bq||'').toLowerCase(),dl=fxDeckCards(i),inDeck=n=>sum(dl.filter(e=>norm(e.name)===norm(n))),t=target(d),n=sum(dl);
  document.getElementById('bhead').innerHTML=`<b>${n}${t?' / '+t:''} cards</b> in this deck${fxDraftDirty()?' <span class="dl">· not saved yet</span>':''}<br><span class="mut" style="font-size:12px">Tap + or − as much as you like, then Done and “Save changes”.</span>`;
  const list=D.cards.filter(c=>isReal(c)&&(!q||c.name.toLowerCase().includes(q)||String(c.text||'').toLowerCase().includes(q))&&(!V.bt||c.type===V.bt)&&(!V.bc||String(c.colors).includes(V.bc))&&(!V.bfree||freeCopies(c)>0||inDeck(c.name)>0)).sort((a,b)=>(inDeck(b.name)>0)-(inDeck(a.name)>0)||a.name.localeCompare(b.name));
  FXB=list.slice(0,60).map(c=>c.name);
  el.innerHTML=list.slice(0,60).map((c,k)=>{const u=usage(c.name).filter(x=>x.d!==d),fr=freeCopies(c),have=inDeck(c.name);
    return `<div class="res" style="cursor:default"><span>${esc(c.name)} ${costHtml(c.cost)}<br><span class="mut" style="font-size:12px">${esc(c.type)} · own ${c.qty} · ${c.type==='Basic Land'?'basic land':fr>0?fr+' free':'<b style="color:#f39c12">none free</b>'}${u.length?' · in '+esc(u.map(x=>x.d.name).join(', ')):''}</span></span>
    <span style="display:flex;align-items:center;gap:8px;flex:0 0 auto"><button style="padding:6px 12px" onclick="fxBAdd(${k},-1)" ${have?'':'disabled'}>−</button><b style="min-width:22px;text-align:center">${have}</b><button class="pri" style="padding:6px 12px" onclick="fxBAdd(${k},1)">+</button></span></div>`}).join('')+(list.length>60?`<p class="mut">Showing 60 of ${list.length} — search or filter to narrow it down.</p>`:'')||'<p class="mut">No cards match.</p>'}
function fxBAdd(k,dl){const n=FXB[k];if(n==null)return;const y=document.getElementById('modal').scrollTop;fxDraftChg(V.deck,n,dl,true);document.getElementById('modal').scrollTop=y}
function fxDeckEdit(i){const d=D.decks[i];openM(`<h3>Edit deck details</h3><div class="f"><label>Name</label><input id="en" value="${esc(d.name)}"><label>Format</label><select id="ef">${fmtOptions(dfmt(d.format)?d.format:'Casual')}</select>
  <label>Commander (optional)</label><input id="ec" list="ecl" value="${esc(d.commander||'')}"><datalist id="ecl">${fxDeckCards(i).map(e=>`<option value="${esc(e.name)}">`).join('')}</datalist>
  <label>Sleeves <span id="sl" class="mut"></span></label><label style="margin:2px 0 4px;font-weight:400"><input type="checkbox" id="nsa" onchange="NSA=this.checked;sleeveOpts(window.FXCUR)">Auto-select from available sleeves</label><div class="swr" id="ns"></div></div><br><div class="row"><button onclick="closeM()">Cancel</button><button class="pri" onclick="fxDeckEditSave(${i})">Save details</button></div>`);
  const cur=sleeveOf(d);window.FXCUR=cur?cur.color:'';NSA=false;NSV=window.FXCUR;$('#ef').onchange=()=>sleeveOpts(window.FXCUR);sleeveOpts(window.FXCUR)}
function fxDeckEditSave(i){const d=D.decks[i],name=$('#en').value.trim(),old=d.name;if(!name)return toast('Give the deck a name');if(D.decks.some((x,k)=>k!==i&&x.name.toLowerCase()===name.toLowerCase()))return toast('Another deck already has that name');
  const s=sleeveOf(d);d.name=name;d.format=$('#ef').value;d.commander=$('#ec').value.trim();
  if(name!==old){D.loans.forEach(l=>{if(l.from===old)l.from=name;if(l.to===old)l.to=name});D.swaps.forEach(w=>{if(w.deck===old)w.deck=name;if(w.row&&w.row[1]===old)w.row[1]=name})}
  const ns=D.sleeves.find(x=>x.color===NSV);if(s&&s!==ns){s.deck='';s.inUse=0}d.sleeve=ns?ns.color:'';
  if(ns){ns.deck=sleeveLabel(name,d.format);ns.inUse=Math.min(fmtSize(d.format)||60,ns.total)}
  save();closeM();render();toast('Deck details saved')}

/* ---------- Add card tab: type several card names at once ---------- */
const fxQuickAdd=()=>`<div class="sec" style="margin-top:22px"><h4>Add several cards at once</h4><div class="f"><textarea id="qadd" rows="3" placeholder="Sol Ring, Llanowar Elves, 4 Lightning Bolt">${esc(V.qadd||'')}</textarea></div>
  <p class="mut" style="font-size:12px;margin:6px 0">Type the card names with a comma between each one. Don’t use commas inside a card’s name — they are only for separating cards. Put a number in front for more than one copy (“4 Lightning Bolt”). You’ll see a preview before anything is added.</p><div class="row"><button class="pri" onclick="fxQuickGo()">Look up these cards</button></div></div>`;
function fxQuickGo(){const txt=(document.getElementById('qadd').value||'').trim();if(!txt)return toast('Type one or more card names first');const items=fxParseList(txt.split(/[,\n]+/).map(x=>x.trim()).filter(Boolean).join('\n'));if(!items.length)return toast('I couldn’t find any card names in that');
  V.qadd='';go('more');V.sub='import';fxImpStart(items,'collection')}

/* ---------- new source name: suggest similar existing sources as you type ---------- */
function fxSrcSuggest(v){const el=document.getElementById('srcsug');if(!el)return;v=String(v||'').trim();const lv=v.toLowerCase();if(lv.length<2){el.innerHTML='';return}
  const srcs=allSources().filter(x=>!IDX_SRC.includes(x.toLowerCase())),bases={};
  srcs.forEach(x=>{const m=x.match(NUMRE),b=m?m[1].trim():x,k=b.toLowerCase();(bases[k]=bases[k]||{b,items:[]}).items.push(x)});
  const words=lv.split(/\s+/).filter(Boolean),score=b=>{const l=b.toLowerCase();if(l===lv)return 3;if(l.startsWith(lv))return 2.5;if(words.every(w=>l.includes(w)))return 2;const s=sim(lv,l.slice(0,Math.max(lv.length,4)));return s>=0.7?s:0};
  const hits=Object.values(bases).map(o=>({o,s:score(o.b)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s||a.o.b.localeCompare(b.o.b)).slice(0,4);
  if(!hits.length){el.innerHTML='';return}
  el.innerHTML=`<div class="mut" style="font-size:12px;margin:6px 0 2px">Matching sources — tap one:</div>`+hits.map(({o})=>{const nx=autoNumber(o.b),last=o.items.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).slice(-1)[0];
    return `<div class="res" style="padding:8px 10px;cursor:default;gap:6px;flex-wrap:wrap"><span><b>${esc(o.b)}</b> <span class="mut" style="font-size:12px">${o.items.length} so far</span></span><span style="display:flex;gap:6px;flex-wrap:wrap">
      ${nx!==o.b||!o.items.includes(o.b)?`<button style="padding:5px 9px;font-size:12px" class="pri" onclick="fxSrcPick('new','${esc(o.b).replace(/'/g,"\\'")}')">New pull: ${esc(nx)}</button>`:''}
      <button style="padding:5px 9px;font-size:12px" onclick="fxSrcPick('old','${esc(last).replace(/'/g,"\\'")}')">Add to ${esc(last)}</button></span></div>`}).join('')}
function fxSrcPick(kind,x){const q=A.q;if(kind==='new'){q.newSrc=x;const i=document.getElementById('newsrc');if(i)i.value=x;newSrcIn(x);document.getElementById('srcsug').innerHTML='';return}
  const g=srcGroup(x);q.grp=g==='Singles Orders'?'Singles Orders':g;q.sel=x;q.newSrc='';autoPrint(x);render()}

/* ---------- send my collection to my other device ---------- */
async function fxSendDevice(){if(!D.uid)fxIdentity();if(!D.keys)await fxKeys();
  if(!confirm('Send your whole collection to another phone, tablet or computer of yours?\n\nThis is a full private backup — it includes the secret key that signs your share files. Only send it to yourself (for example to your own email, Google Drive or Quick Share).\n\nOn the other device: open MtG DeckMaster → More → My profile → “Open a file”, or the welcome screen’s “Restore my backup”.'))return;
  const j=Object.assign(JSON.parse(JSON.stringify(D)),{xfer:{from:isNative()?'Android app':(/iPhone|iPad/i.test(navigator.userAgent)?'iPhone / iPad':'web browser'),at:Date.now()}});
  await fxSend(JSON.stringify(j),`${fxPrefix()}to-my-device_${tsName()}.json`);try{localStorage.setItem(BK,today());localStorage.removeItem(DY)}catch(e){}}
function fxGotDevice(j){const same=D.uid&&j.uid===D.uid,empty=!D.cards.length&&!D.decks.length,newer=!D.updated||(j.updated||0)>=D.updated,when=x=>x?new Date(x).toLocaleString():'unknown';
  const body=`<div class="sec">${fxWho(j.owner,j.uid)}<br><span class="mut">Sent from your ${esc(j.xfer.from)} · ${esc(when(j.xfer.at))}</span></div>
  ${tbl(['','On this device','In the file'],[['Card titles',D.cards.length,j.cards.length],['Decks',D.decks.length,j.decks.length],['Last changed',when(D.updated),when(j.updated)]])}
  ${empty?'':same?(newer?'<p>The file is <b>newer</b> than this device. Updating replaces what is here with it.</p>':'<p style="color:#ff6b6b"><b>⚠ This device has newer changes than the file.</b> Updating would lose them. Usually you want to send from <i>this</i> device to the other one instead.</p>'):`<p style="color:#f39c12">This device has a <b>different collection</b> (${fxWho(D.owner,D.uid)}). Updating replaces it with the one in the file — back it up first if you want to keep it.</p>`}`;
  fxAsk(empty?'Your collection from another device':'Update this device?',body,[{t:empty?'Use it on this device':'Update this device',cls:same&&!newer?'danger':'pri',fn:()=>{if(D.cards.length&&!same&&!confirm('Replace the collection on this device? It cannot be undone unless you have a backup.'))return;delete j.xfer;fxRestore(j)}},{t:'Cancel'}])}
