/* MtG DeckMaster — feature modules shared by the web version and the Android app.
   Loaded before the main script in index.html. Nothing here runs at load time except declarations;
   every function uses the main script's globals (D, V, render, …) only when it is called. */
let RO=null,MINE=null,DRAFT=null,CAM=null,OC=null,CIMG={};
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
function fxBack(){if(CAM){CAM.close();return true}if(V.view==='decks'&&V.opt!=null&&!$('#modal').classList.contains('open')&&!$('#qafull')){if(OPT.step==='confirm'){OPT.step='';render()}else fxOptClose();return true}const qf=$('#qafull');if(qf){qf.remove();return true}if(IMP.stage==='pick'&&(IMP.qa?V.view==='add':V.view==='more'&&V.sub==='import')&&!$('#modal').classList.contains('open')){if(IMP.kind==='verify'&&IMP.pi===0){fxVerStop();return true}fxQAPrev();return true}if(IMP.stage==='preview'&&!$('#modal').classList.contains('open')&&(IMP.qa?V.view==='add':V.view==='more'&&V.sub==='import')){fxImpCancel();return true}return false}
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
/* Where a copy physically lives: each WotC set is its own place; every other “Pulled from” (Bulk Box 1, Singles Orders, Trade, Gift, any custom source added later) shares ONE storage. Uses the Scryfall set list when loaded, else the product words in the name. */
const FX_OTHER='Bulk & singles';
const FXPRODRE=/^(.*?)\s+(?:Bundle(?:\s+Box)?|(?:(?:Play|Draft|Set|Collector|Family|Jumpstart|Theme)\s+)?Boosters?(?:\s+(?:Pack|Box))?|Prerelease(?:\s+(?:Kit|Pack))?|Commander\s+Deck|Starter\s+(?:Kit|Deck)|Fat\s+Pack|Gift\s+(?:Box|Bundle))\b/i;
function fxStoreLabel(src){const x=canonSrc(src||'');if(!x||SV_SKIP.test(x)||isCustomSrc(x))return FX_OTHER;
  if(typeof FXSETS!=='undefined'&&FXSETS){const s=fxSetIn(x,FXSETS);if(s)return s.n}
  /* a WotC product without a recognisable set name (e.g. a precon typed by its deck name) is still its own place */
  const m=x.match(FXPRODRE);return m&&m[1].trim().length>2?m[1].trim():FX_OTHER}
function fxCardLabel(c){const l=[...new Set(cardSources(c).map(fxStoreLabel))];return l.length?{k:l[0],alt:l.slice(1)}:{k:FX_OTHER,alt:[]}}
/* ---------- Which “Pulled from” each deck copy comes from: d.srcs = { normName: { source: qty } } (collection copies only — borrowed and missing copies are tracked elsewhere). Chosen automatically, kept stable, shown on the card page. ---------- */
function fxSrcOwned(c){const m={};D.acq.filter(a=>norm(a.name)===norm(c.name)).forEach(a=>{const s=canonSrc(a.source||'');if(s&&(+a.qty||0)>0)m[s]=(m[s]||0)+(+a.qty||0)});
  const ss=cardSources(c);let tot=sum(Object.values(m),v=>v);
  if(tot<c.qty){const s=ss.find(x=>!(x in m))||ss[0]||'Unknown';m[s]=(m[s]||0)+(c.qty-tot)}
  else if(tot>c.qty){let over=tot-c.qty;for(const k of Object.keys(m).reverse()){const t=Math.min(over,m[k]);m[k]-=t;over-=t;if(!m[k])delete m[k];if(!over)break}}
  return m}
function fxDeckNeed(d,c){return Math.max(0,sum(d.cards.filter(e=>norm(e.name)===norm(c.name)))-loanedIn(d.name,c.name)-(d.miss?fxMissQ(d,c.name):0))}
function fxAllocAll(){if(!D||RO)return;const own=new Map();
  D.decks.forEach(d=>{d.srcs=d.srcs||{};const names=new Map();d.cards.forEach(e=>names.set(norm(e.name),e.name));
    Object.keys(d.srcs).forEach(k=>{if(!names.has(k))delete d.srcs[k]});
    names.forEach((nm,k)=>{const c=findCard(nm);if(!c){delete d.srcs[k];return}if(!own.has(k))own.set(k,{c,m:fxSrcOwned(c)});
      const m=d.srcs[k]=d.srcs[k]||{};let over=sum(Object.values(m),v=>v)-fxDeckNeed(d,c);
      for(const s of Object.keys(m).reverse()){if(over<=0)break;const t=Math.min(over,m[s]);m[s]-=t;over-=t;if(!m[s])delete m[s]}});
    if(!Object.keys(d.srcs).length)delete d.srcs});
  /* a source can't hand out more copies than came from it (e.g. after a rename or a lower quantity) */
  own.forEach(({m},k)=>{const used={};D.decks.forEach(d=>{const a=d.srcs&&d.srcs[k];if(a)for(const s in a)used[s]=(used[s]||0)+a[s]});
    for(const s in used){let over=used[s]-(m[s]||0);if(over<=0)continue;[...D.decks].reverse().forEach(d=>{const a=d.srcs&&d.srcs[k];if(!a||!a[s]||over<=0)return;const t=Math.min(over,a[s]);a[s]-=t;over-=t;if(!a[s])delete a[s]})}});
  /* fill: copies not yet assigned take the source with the most free copies */
  D.decks.forEach(d=>{const names=new Map();d.cards.forEach(e=>names.set(norm(e.name),e.name));names.forEach((nm,k)=>{const o=own.get(k);if(!o)return;
    d.srcs=d.srcs||{};const m=d.srcs[k]=d.srcs[k]||{};let want=fxDeckNeed(d,o.c)-sum(Object.values(m),v=>v);
    while(want>0){const free={};for(const s in o.m)free[s]=o.m[s];D.decks.forEach(x=>{const a=x.srcs&&x.srcs[k];if(a)for(const s in a)free[s]=(free[s]||0)-a[s]});
      const best=Object.keys(free).filter(s=>free[s]>0).sort((a,b)=>free[b]-free[a])[0];if(!best)break;const t=Math.min(want,free[best]);m[best]=(m[best]||0)+t;want-=t}
    if(!Object.keys(m).length)delete d.srcs[k]});if(d.srcs&&!Object.keys(d.srcs).length)delete d.srcs})}
const fxSrcSnap=d=>JSON.parse(JSON.stringify(d&&d.srcs||{}));
/* pull list lines from what the allocation changed: added copies come FROM a source, removed ones go BACK to it */
function fxAllocDiff(d,before,inG,outG){const after=d.srcs||{},keys=new Set([...Object.keys(before||{}),...Object.keys(after)]);
  keys.forEach(k=>{const b=(before||{})[k]||{},a=after[k]||{},nm=(findCard(k)||{}).name||(d.cards.find(e=>norm(e.name)===k)||{}).name||k;
    new Set([...Object.keys(b),...Object.keys(a)]).forEach(s=>{const dq=(a[s]||0)-(b[s]||0);if(!dq)return;const G=dq>0?inG:outG;if(G)fxGrpPut(G,fxStoreLabel(s),Math.abs(dq),nm,FXPULL(s))})})}
const FXPULL=s=>[`pulled from ${s}`];
/* card page: copies per “Pulled from”, and which deck uses them */
function fxSrcUse(c){const k=norm(c.name),own=fxSrcOwned(c),rows={};for(const s in own)rows[s]={own:own[s],decks:[]};
  D.decks.forEach(d=>{const a=d.srcs&&d.srcs[k];if(a)for(const s in a){rows[s]=rows[s]||{own:0,decks:[]};rows[s].decks.push([d.name,a[s]])}});return rows}
function fxSrcBox(c){if(!findCard(c.name)||c.custom&&false)return '';const R=fxSrcUse(c),ks=Object.keys(R);if(!ks.length)return `<div class="sec"><h4>Pulled from</h4><span class="mut">—</span></div>`;
  return `<div class="sec"><h4>Pulled from</h4>${ks.map(s=>{const r=R[s],used=sum(r.decks,x=>x[1]),free=Math.max(0,r.own-used);return `<div class="kv" style="align-items:flex-start"><span>${esc(s)}<br><span class="mut" style="font-size:12px;font-weight:400">stored in: ${esc(fxStoreLabel(s))}</span></span><b style="text-align:right">${r.own} ${r.own===1?'copy':'copies'}<br><span class="mut" style="font-size:12px;font-weight:400">${r.decks.map(([n,q])=>`${q} in ${esc(n)}`).concat(free?[`${free} free`]:[]).join(' · ')||'—'}</span></b></div>`}).join('')}${fxSrcDeckRows(c)}</div>`}
/* card page: per deck, which “Pulled from” its copies come from — with “Change” (owner request: choose the source after the deck is built) */
function fxSrcDeckRows(c){if(RO)return '';const k=norm(c.name),own=fxSrcOwned(c);if(Object.keys(own).length<2)return '';
  const L=D.decks.map((d,i)=>({d,i,a:d.srcs&&d.srcs[k]})).filter(x=>x.a&&Object.keys(x.a).length);if(!L.length)return '';
  return `<p class="mut" style="margin:10px 0 4px;font-size:13px">Which copies each deck uses:</p>${L.map(({d,i,a})=>`<div class="kv" style="align-items:center"><span>${esc(d.name)}<br><span class="mut" style="font-size:12px;font-weight:400">${Object.keys(a).map(s=>`${a[s]} from ${esc(s)}`).join(' · ')}</span></span><button style="padding:6px 12px" onclick="fxDSrc(${esc(JSON.stringify(c.name))},${i})">⇄ Change</button></div>`).join('')}`}
let FXDS=null;
function fxDSrc(name,di){const c=findCard(name),d=D.decks[di];if(!c||!d||RO)return;const k=norm(c.name);FXDS={name:c.name,di,m:Object.assign({},(d.srcs&&d.srcs[k])||{})};fxDSrcDraw()}
function fxDSrcCaps(){const c=findCard(FXDS.name),d=D.decks[FXDS.di],k=norm(c.name),own=fxSrcOwned(c),cap={};
  for(const s in own){let used=0;D.decks.forEach((x,j)=>{if(j!==FXDS.di&&x.srcs&&x.srcs[k]&&x.srcs[k][s])used+=x.srcs[k][s]});cap[s]=Math.max(0,own[s]-used)}
  return {c,d,cap,need:fxDeckNeed(d,c)}}
function fxDSrcDraw(){const {c,d,cap,need}=fxDSrcCaps(),m=FXDS.m,tot=sum(Object.values(m),v=>v),ok=tot===need;
  KEEPSCROLL=true;openM(`<h3>${esc(d.name)}: where do its ${need===1?'copy':need+' copies'} of ${esc(c.name)} come from?</h3><p class="mut">Pick how many copies this deck takes from each “Pulled from”. You can only use copies that aren’t already in another deck.</p>
    ${Object.keys(cap).map(s=>{const v=m[s]||0;return `<div class="kv" style="align-items:center"><span>${esc(s)}<br><span class="mut" style="font-size:12px;font-weight:400">stored in: ${esc(fxStoreLabel(s))} · ${cap[s]} available for this deck</span></span><span style="display:flex;align-items:center;gap:8px;flex:0 0 auto"><button style="padding:6px 12px" onclick="fxDSrcSet(${esc(JSON.stringify(s))},-1)" ${v>0?'':'disabled'}>−</button><b style="min-width:22px;text-align:center">${v}</b><button style="padding:6px 12px" onclick="fxDSrcSet(${esc(JSON.stringify(s))},1)" ${v<cap[s]&&tot<need?'':'disabled'}>+</button></span></div>`}).join('')}
    <p style="margin:10px 0;${ok?'':'color:#f39c12'}">${tot} of ${need} chosen${ok?' ✓':tot<need?` — choose ${need-tot} more`:''}</p>
    <div class="row"><button data-card="${esc(c.name)}">Cancel</button><button class="pri" onclick="fxDSrcSave()" ${ok?'':'disabled'}>Save</button></div>`)}
function fxDSrcSet(s,dl){const {cap,need}=fxDSrcCaps(),m=FXDS.m,tot=sum(Object.values(m),v=>v),v=(m[s]||0)+dl;if(v<0||v>cap[s]||dl>0&&tot>=need)return;if(v)m[s]=v;else delete m[s];fxDSrcDraw()}
async function fxDSrcSave(){const {c,d,need}=fxDSrcCaps(),k=norm(c.name),old=(d.srcs&&d.srcs[k])||{},m=FXDS.m;if(sum(Object.values(m),v=>v)!==need)return;
  const out=[],inn=[];new Set([...Object.keys(old),...Object.keys(m)]).forEach(s=>{const dq=(m[s]||0)-(old[s]||0);if(dq>0)inn.push(`• Take ${dq} from ${s} (stored in ${fxStoreLabel(s)})`);if(dq<0)out.push(`• Put ${-dq} back in ${s} (stored in ${fxStoreLabel(s)})`)});
  if(!out.length&&!inn.length){toast('Nothing changed');return showCard(c.name,true)}
  const str=x=>Object.keys(x).map(s=>`${x[s]}× ${s}`).join(', ')||'—';
  if(!(await ask(`Save where ${d.name} gets ${c.name} from?\n\n${out.length?'Swap the cards:\n'+out.join('\n')+'\n':''}${inn.join('\n')}`)))return;
  d.srcs=d.srcs||{};d.srcs[k]=Object.assign({},m);logEdit(c.name,`Pulled from (deck ${d.name})`,str(old),str(m));FXDS=null;save();showCard(c.name,true);toast('Deck source updated')}


/* ---------- collection list: load more cards as you scroll ---------- */
addEventListener('scroll',()=>{try{if(V.view!=='collection')return;const m=document.getElementById('more');
  if(m&&m.getBoundingClientRect().top<innerHeight+600){V.lim=(V.lim||150)+150;drawList()}}catch(e){}},{passive:true});

/* ---------- deck editing: stage changes, then Save or Discard ---------- */
function fxDraft(i){if(!DRAFT||DRAFT.deck!==i){const m={};D.decks[i].cards.forEach(e=>{const k=norm(e.name);m[k]=m[k]||{name:e.name,base:0,qty:0};m[k].base+=e.qty;m[k].qty+=e.qty});DRAFT={deck:i,m}}return DRAFT}
const fxDraftDirty=()=>!!DRAFT&&Object.values(DRAFT.m).some(x=>x.qty!==x.base);
function fxDeckCards(i){const d=D.decks[i];if(!DRAFT||DRAFT.deck!==i)return d.cards;return Object.values(DRAFT.m).map(x=>({name:x.name,qty:x.qty,d:x.qty-x.base}))}
async function fxDraftChg(i,name,dl,fromSearch){if(RO||i==null||!D.decks[i])return;const F=dfmt(D.decks[i].format);
  if(dl>0&&F&&!D.decks[i].override){const pr=fxAddProblems(i,name,dl);if(pr.length&&!(await fxOverrideAsk(i,name,pr)))return}
  const d=fxDraft(i),k=norm(name),c=findCard(name),x=d.m[k]||(d.m[k]={name:c?c.name:name,base:0,qty:0});
  x.qty=Math.max(0,x.qty+dl);if(!x.qty&&!x.base)delete d.m[k];render();
  if(fromSearch)fxBuilder()}
async function fxCanLeave(){if(fxDraftDirty()){if(!(await ask('You have deck changes that are not saved.\n\nOK = discard them\nCancel = stay and keep editing')))return false}DRAFT=null;return true}
async function fxLeaveDeck(){if(!(await fxCanLeave()))return;V.deck=null;render();scrollTo(0,0)}
const fxDraftNote=i=>RO?'':'<p class="mut" data-rw>Use + / − or “Add card” to make as many changes as you like. Nothing changes until you tap <b>Save changes</b>.</p>';
function fxDraftBar(i){if(!DRAFT||DRAFT.deck!==i||!fxDraftDirty())return '';const ch=Object.values(DRAFT.m),a=sum(ch,x=>Math.max(0,x.qty-x.base)),r=sum(ch,x=>Math.max(0,x.base-x.qty));
  return `<div style="height:76px"></div><div id="dbar"><span><b>Not saved:</b> ${a?'+'+a:''}${a&&r?' / ':''}${r?'−'+r:''} card${a+r===1?'':'s'}</span><button onclick="fxDraftDiscard()">Discard</button><button class="pri" onclick="fxDraftSave()">Save changes</button></div>`}
async function fxDraftDiscard(){if(!(await ask('Discard all the changes you made to this deck?\n\nOK = discard\nCancel = keep editing')))return;DRAFT=null;render();toast('Changes discarded')}
async function fxDraftSave(opt){opt=opt||{};
  if(!DRAFT)return;const i=DRAFT.deck,d=D.decks[i],ch=Object.values(DRAFT.m).filter(x=>x.qty!==x.base),adds=ch.filter(x=>x.qty>x.base),rems=ch.filter(x=>x.qty<x.base);
  const na=sum(adds,x=>x.qty-x.base),nr=sum(rems,x=>x.base-x.qty);
  if(!opt.yes&&!(await ask(`Save these changes to ${d.name}?\n\n${fxPl(na,'card')} added, ${nr} removed.\n\nOK = save\nCancel = keep editing`)))return;
  const inG={},outG={},put=(G,k,q,name,alt)=>(G[k]=G[k]||[]).push({q,name,alt:alt||[]}),others=opt.allowed||D.decks.filter(x=>x!==d).map(x=>x.name),before=fxSrcSnap(d);
  // 1) removals: decide where each physical copy goes, then take it off the list
  rems.forEach(x=>{const n=x.base-x.qty,c=findCard(x.name),lo=loanedOut(d.name,x.name);let perm=Math.max(0,lo-x.qty),phys=n-Math.min(n,perm);perm=Math.min(n,perm);
    if(perm>0)actLoans().filter(l=>l.from===d.name&&norm(l.card)===norm(x.name)).forEach(l=>{if(perm<=0)return;const k=Math.min(perm,l.qty);perm-=k;put(outG,'Nothing to move — already in deck: '+l.to,k,x.name);
      if(k>=l.qty){l.status='permanent';l.done=today();setSwapStatus(l.id,'Permanent '+today())}else l.qty-=k});
    if(phys>0)[...actLoans()].reverse().filter(l=>l.to===d.name&&norm(l.card)===norm(x.name)).forEach(l=>{if(phys<=0)return;const k=Math.min(phys,l.qty);phys-=k;put(outG,'Return to deck: '+l.from,k,x.name);
      if(k>=l.qty){l.status='returned';l.done=today();setSwapStatus(l.id,'Returned '+today())}else l.qty-=k});
    if(phys>0&&!c)put(outG,'Not in your collection',phys,x.name)
    let left=n;d.cards.filter(e=>norm(e.name)===norm(x.name)).forEach(e=>{const k=Math.min(left,e.qty);e.qty-=k;left-=k});d.cards=d.cards.filter(e=>e.qty>0)});
  try{reconcileLoans()}catch(e){}
  // 2) additions: free copies come from the collection (by set); the rest are borrowed from other decks
  adds.forEach(x=>{const n=x.qty-x.base,c=findCard(x.name);
    if(!c)put(inG,'Not in your collection',n,x.name);
    else if(c.type==='Basic Land'){}
    else{const pl=planCard(c,n,others);
      pl.from.forEach(f=>{makeLoan(c.name,f.q,f.deck,d.name);put(inG,'From deck: '+f.deck,f.q,c.name)});
      if(pl.short>0)put(inG,'Not enough copies — you own fewer than the deck lists',pl.short,c.name)}
    const e=d.cards.find(e=>norm(e.name)===norm(x.name));e?e.qty+=n:d.cards.push({name:c?c.name:x.name,qty:n,finish:c?.finish||'Normal'})});
  if(d.miss){d.miss.forEach(m=>{const have=sum(d.cards.filter(e=>norm(e.name)===norm(m.name)));m.qty=Math.min(m.qty,have)});d.miss=d.miss.filter(m=>m.qty>0);if(!d.miss.length)delete d.miss}
  DRAFT=null;save();fxAllocDiff(d,before,inG,outG);fxOverrideAuto(i);render();fxPullSplash(d.name,inG,outG)}
function fxPullSplash(deck,inG,outG){
  const ord=G=>Object.keys(G).sort((a,b)=>(/deck:/i.test(b)-/deck:/i.test(a))||a.localeCompare(b)),tot=G=>sum(Object.values(G).flat(),x=>x.q);
  const grp=G=>ord(G).map(k=>`<div class="grp"><b>${esc(k)} <span class="mut">· ${sum(G[k],x=>x.q)}</span></b>${G[k].sort((a,b)=>a.name.localeCompare(b.name)).map(x=>`<div>${x.q}× ${esc(x.name)}${x.alt.length?` <span class="mut">(${/^pulled from /.test(x.alt[0])?esc(x.alt.join(', ')):'or '+esc(x.alt.join(' / '))})</span>`:''}</div>`).join('')}</div>`).join('');
  const txt=(t,G)=>tot(G)?`${t}\n`+ord(G).map(k=>`  ${k}\n`+G[k].map(x=>`    ${x.q}x ${x.name}${x.alt.length&&/^pulled from /.test(x.alt[0])?` (${x.alt.join(', ')})`:''}`).join('\n')).join('\n')+'\n':'';
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
  <div class="f"><label>…or paste a deck link someone sent you</label><input id="oclink" placeholder="https://tinyurl.com/… or another deck link"></div><div class="row"><button onclick="fxOpenLink(document.getElementById('oclink').value)">Open deck link</button></div>
  <p class="mut" style="font-size:12px">Tap a collection to open it. Slide a row to the left to delete it.</p><div id="oclist"><p class="mut">Loading…</p></div>`}
async function ocDraw(){await ocLoad();const el=document.getElementById('oclist');if(!el)return;
  el.innerHTML=OC.length?OC.map(r=>`<div class="ocrow" data-oc="${esc(r.id)}"><button class="ocdel" onclick="ocDelete('${esc(r.id)}')">Delete</button><div class="ocin"><b>${esc(r.name)} ${r.status==='signed'?'<span title="Signed by its owner" style="color:#2ecc71">✓</span>':'<span class="mut" style="font-weight:400;font-size:11px">unverified</span>'}<br><span>${r.partial?fxPl(r.data.decks.length,'deck')+' only':r.data.cards.length+' titles · '+fxPl(r.data.decks.length,'deck')}${r.uid&&!/^(old|link)-/.test(r.uid)?' · ID '+esc(fxCode(r.uid)):''}</span>${r.data.decks.length?`<br><span style="font-weight:400;font-size:12px">${r.data.decks.slice(0,8).map(d=>'🃏 '+esc(d.name)).join(' · ')}${r.data.decks.length>8?' …':''}</span>`:''}</b><span>${esc(fxDate(r.updated))}</span></div></div>`).join(''):'<p class="mut">No other collections saved yet.</p>';
  el.querySelectorAll('.ocrow').forEach(row=>{const inn=row.querySelector('.ocin');let x0=null,dx=0,open=false;
    const set=o=>{open=o;inn.style.transform=o?'translateX(-92px)':''};
    inn.addEventListener('pointerdown',e=>{x0=e.clientX;dx=0;inn.style.transition='none';try{inn.setPointerCapture(e.pointerId)}catch(_){}});
    inn.addEventListener('pointermove',e=>{if(x0==null)return;dx=e.clientX-x0;const b=open?-92:0;inn.style.transform=`translateX(${Math.max(-92,Math.min(0,b+dx))}px)`});
    const end=()=>{if(x0==null)return;x0=null;inn.style.transition='';if(Math.abs(dx)<8){if(open)set(false);else roOpen(row.dataset.oc)}else set(open?dx<40:dx<-40)};
    inn.addEventListener('pointerup',end);inn.addEventListener('pointercancel',()=>{x0=null;inn.style.transition='';set(open)})})}
async function ocImport(f){return fxOpenFile(f,'view')}
async function ocDelete(id){const r=(OC||[]).find(x=>x.id===id);if(!r)return;if(!(await ask(`Delete the saved collection “${r.name}”?\n\nThis only removes it from this list. Your own collection is not affected.`)))return ocDraw();
  await fxTx('readwrite',st=>st.delete(id));if(!(OC||[]).some(x=>x.id!==id&&x.uid===r.uid))fxFriendIndex(r,true);toast('Removed');ocDraw()}
async function roOpen(id){await ocLoad();const r=OC.find(x=>x.id===id);if(!r)return;if(!(await fxCanLeave()))return;
  const j=JSON.parse(JSON.stringify(r.data));['acq','edits','flags','swaps','matchups','loans','sleeves','sims'].forEach(k=>{j[k]=j[k]||[]});j.kept=j.kept||{};
  j.cards.forEach(c=>{c.text=c.text||'';c.colors=c.colors||'';c.type=c.type||'';c.qty=+c.qty||0});j.decks.forEach(d=>{d.cards=d.cards||[];d.tokens=d.tokens||[]});
  MINE={D,ART,ART2,CIMG};CIMG=j.customImgs||{};delete j.customImgs;D=j;ART=Object.assign({},ART);ART2=Object.assign({},ART2);RO={id:r.id,name:r.name,given:r.given||(r.data&&r.data.owner)||'',updated:r.updated,uid:r.uid,status:r.status};IDX=null;DRAFT=null;HIST.length=0;
  V.view='collection';V.deck=null;V.q=V.type=V.color='';V.lim=0;closeM();render();scrollTo(0,0);fetchArt()}
function roExit(){if(!RO)return;D=MINE.D;ART=MINE.ART;ART2=MINE.ART2;CIMG=MINE.CIMG;RO=null;MINE=null;IDX=null;HIST.length=0;V.view='more';V.sub='others';V.deck=null;V.q=V.type=V.color='';V.lim=0;closeM();persist();render();scrollTo(0,0)}
const roBar=()=>`<div class="robar"><button onclick="roExit()">← Back to my collection</button><b title="Tap to rename" onclick="roRename()">${RO.status==='signed'?'✓ ':''}${esc(RO.name)}</b><span>Updated<br>${esc(fxDate(RO.updated))}</span></div>`;
async function roRename(){const n=await askText('Name for this collection (so you know whose it is):',RO.name);if(n==null)return;const name=n.trim();if(!name)return;
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
let IMP={stage:'idle',sq:null,text:'',dname:'',dfmt:'Casual',dtext:'',dadd:false};
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
  const post=async ids=>{const r=await scryFetch('https://api.scryfall.com/cards/collection',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({identifiers:ids})});if(!r||!r.ok)throw new Error('lookup failed');return (await r.json()).data||[]};
  const round=async(list,ident)=>{const uniq=new Map();list.forEach(x=>{const id=ident(x);uniq.set(JSON.stringify(id),id)});const ids=[...uniq.values()],got=[];
    for(let i=0;i<ids.length;i+=75){onProg&&onProg(i,ids.length);got.push(...await post(ids.slice(i,i+75)))}
    const byId=new Map(),bySN=new Map(),byNS=new Map(),byN=new Map();
    got.forEach(c=>{byId.set(c.id,c);bySN.set(c.set+'|'+String(c.collector_number).toLowerCase(),c);const k=norm(front(c.name));byNS.set(k+'|'+c.set,c);if(!byN.has(k))byN.set(k,c);(c.card_faces||[]).forEach(f=>{const fk=norm(f.name);if(!byN.has(fk))byN.set(fk,c)})});
    list.forEach(x=>{const k=norm(front(x.name));x.card=(x.sid&&byId.get(x.sid))||(x.set&&x.num&&bySN.get(x.set+'|'+String(x.num).toLowerCase()))||(x.set&&byNS.get(k+'|'+x.set))||byN.get(k)||byN.get(norm(x.name))||null;
      if(x.card&&x.set&&x.num&&!x.sid&&norm(front(x.card.name))!==k&&byN.get(k))x.card=byN.get(k)})};
  await round(items,x=>x.sid?{id:x.sid}:x.set&&x.num?{set:x.set,collector_number:String(x.num)}:x.set?{name:front(x.name),set:x.set}:{name:front(x.name)});
  const miss=items.filter(x=>!x.card);if(miss.length)await round(miss,x=>({name:front(x.name)}));
  const still=items.filter(x=>!x.card&&!x.own).slice(0,80);let k=0;
  for(const x of still){onProg&&onProg(k++,still.length,'Checking spelling');const nm=front(x.name).replace(/[^\p{L}\p{N}' ,.-]/gu,' ').replace(/\s+/g,' ').trim();if(nm.length<3)continue;
    const c=await scry('/cards/named?fuzzy='+encodeURIComponent(nm));
    if(c&&c.object==='card'){x.typed=x.name;x.card=c;x.name=c.name;x.fuzzy=true;continue}
    const ac=await scry('/cards/autocomplete?q='+encodeURIComponent(nm.slice(0,Math.max(3,Math.min(nm.length,6)))));
    const sg=((ac&&ac.data)||[]).map(n=>({n,s:sim(nm,n)})).sort((a,b)=>b.s-a.s).slice(0,5).map(x=>x.n);if(sg.length)x.sugs=sg}
  onProg&&onProg(1,1)}
/* ver = the user picked this exact printing (several-cards picker): mark the artwork verified ✓, like a single add. An artwork already verified is never replaced. */
function fxAddCard(c,n,fin,src,price,notes,ver){
  const nm=c.name;let e=findCard(nm),had=false;fin=fin||'Normal';
  if(e){had=cardSources(e).includes(src);e.finish=mergeFinish(e.finish||'Normal',e.qty,fin,n);e.qty+=n;if(!had)e.source=(e.source&&e.source!=='None'?e.source+', ':'')+src}
  else{const f=c.card_faces?.[0]||c,L={W:'White',U:'Blue',B:'Black',R:'Red',G:'Green'},ci=(c.color_identity||[]).map(x=>L[x]).join('/'),tl=c.type_line||f.type_line||'';
    D.cards.push({name:nm,source:src,colors:ci||(/Land/.test(tl)?'Land':'Colorless'),cost:c.mana_cost||f.mana_cost||'None',cmc:String(c.cmc??0),type:catOf(c),subtype:(tl.split(' — ')[1]||'None'),power:f.power||'None',toughness:f.toughness||'None',
      text:c.oracle_text||f.oracle_text||'',keywords:(c.keywords||[]).join(', ')||'None',legal:c.legalities?.commander==='banned'?'Restricted: Banned in Commander':'None (Sanctioned Legal)',qty:n,finish:fin,status:'Added in app'});e=D.cards[D.cards.length-1];IDX=null}
  const pr={art:sImg(c),art2:sImg2(c),set:c.set,setName:c.set_name,cn:c.collector_number,scryId:c.id};
  if(!e.verified&&(!e.set||!(e.art||ART[e.name])))Object.assign(e,pr);if(ver&&!fxBasic(e)&&!/Basic Land/.test(c.type_line||''))fxSetCopies(e,c,n);
  if(c.color_identity)e.ci=c.color_identity;if(c.legalities){e.leg=legOf(c.legalities);e.legAt=today()}fxSetPrice(e,c);
  ART[e.name]=sImg(c)||ART[e.name]||'';ART2[e.name]=sImg2(c)||ART2[e.name]||'';
  D.acq.push({date:today(),name:nm,set:c.set,cn:c.collector_number,finish:fin,qty:n,source:src,price:price||'',notes:notes||'Bulk import',shared:had});return e}
const fxImpProg=(d,t,what)=>{const b=document.getElementById('impb'),x=document.getElementById('impt');if(b)b.style.width=Math.max(3,Math.round(d/Math.max(1,t)*100))+'%';if(x)x.textContent=`${what||'Looking cards up'}… ${Math.min(d,t)} of ${t}`};
async function fxImpStart(items,kind){
  if(!items.length)return toast('I couldn’t find any cards in that — check the format in the guide below');
  Object.assign(IMP,{stage:'work',kind,items});render();
  try{if(kind==='deck'){items.forEach(x=>{const c=findCard(x.name);if(c){x.own=c;x.name=c.name}});const need=items.filter(x=>!x.own);if(need.length)await fxResolve(need,fxImpProg);need.forEach(x=>{if(x.card)x.name=x.card.name})}
    else await fxResolve(items,fxImpProg)}
  catch(e){IMP.stage='idle';render();return toast('Couldn’t reach Scryfall to look the cards up — check your internet connection and try again')}
  IMP.stage=IMP.qa&&kind==='collection'?'pick':'preview';IMP.pi=0;render();scrollTo(0,0)}
async function fxImpFile(f){if(!f)return;let t;try{t=await fxFileText(f)}catch(e){return toast('Couldn’t read that file'+(/\.xlsx?$/i.test(f.name)?' (Excel files need internet the first time)':''))}fxImpStart(fxParseAny(t),'collection')}
function fxImpText(){fxImpStart(fxParseAny(IMP.text||''),'collection')}
function fxImpDeck(){if(!(IMP.dname||'').trim())return toast('Give the deck a name first');if(D.decks.some(d=>d.name.toLowerCase()===IMP.dname.trim().toLowerCase()))return toast('You already have a deck with that name');
  const it=fxParseAny(IMP.dtext||'').filter(x=>!/sideboard|maybeboard|considering/.test(x.section||''));fxImpStart(it,'deck')}
function fxImpCancel(){IMP.stage='idle';IMP.items=null;IMP.sq=null;IMP.qa=false;render()}
/* Bulk imports are always one source, asked on the final check screen (IMP.sq, same picker as single add). */
function fxImpSrc(){const r=resolveSrc();return r&&!isCustomSrc(r)?r:''}
async function fxImpCommit(){
  const it=IMP.items||[];
  if(IMP.kind==='collection'){const ok=it.filter(x=>x.card),n=sum(ok,x=>x.qty),src=fxImpSrc();
    if(!src){toast(IMP.sq&&isCustomSrc((IMP.sq.newSrc||IMP.sq.sel||'').trim())?'“Custom Cards” is only for custom cards — pick another “Pulled from”':'Choose where these cards came from first');document.getElementById('impsrc')?.scrollIntoView({block:'center'});return}
    if(!(await ask(`Add ${fxPl(n,'card')} (${fxPl(ok.length,'line')}) to your collection?\n\nPulled from: ${src}\n\nCards you already own get their quantity increased — no duplicates are created.`)))return;
    ok.forEach(x=>{const fins=(x.card.finishes||['nonfoil']).map(f=>finMap[f]||f),fin=fins.includes(x.fin)?x.fin:fins[0];x.fin=fin;fxAddCard(x.card,x.qty,fin,src,x.price,x.notes,IMP.qa&&!x.nover)});
    const wasQa=IMP.qa,hid=fxHistAdd(src,ok,wasQa);
    saveArt();save();IMP.stage='idle';IMP.items=null;IMP.sq=null;IMP.text='';if(IMP.qa)V.qadd='';IMP.qa=false;render();toast(`${fxPl(n,'card')} added to your collection`);
    setTimeout(()=>fxOneCheck(ok.map(x=>x.card.name)),300);
    if(!wasQa&&fxHistLeft(D.imports[0]).length&&await ask(`${fxPl(n,'card')} added.\n\nDo you want to verify their artwork now? You pick the matching printing card by card and can stop at any time — whatever is left stays in More → Bulk import → Import history.\n\nOK = verify now\nCancel = later`))fxHistVerify(hid);return}
  const name=IMP.dname.trim(),cards=[],by={};let added=0;
  it.forEach(x=>{if(!x.own&&!x.card)return;const nm=x.name,k=norm(nm);if(by[k])by[k].qty+=x.qty;else{by[k]={name:nm,qty:x.qty,finish:x.own?.finish||'Normal'};cards.push(by[k])}});
  if(!cards.length)return toast('None of those cards could be matched');
  if(!(await ask(`Create the deck “${name}” with ${fxPl(sum(cards),'card')}?${IMP.dadd?'\n\nCards you don’t own will also be added to your collection.':''}`)))return;
  if(IMP.dadd){const need={};it.forEach(x=>{if(!x.own&&x.card){const k=x.card.id;need[k]=need[k]||{c:x.card,q:0};need[k].q+=x.qty}});Object.values(need).forEach(v=>{fxAddCard(v.c,v.q,'Normal','Deck import: '+name,'','Imported with the deck '+name);added+=v.q});saveArt()}
  const cm=it.find(x=>x.section==='commander'&&(x.own||x.card));
  D.decks.push({name,format:IMP.dfmt,sleeve:'',commander:isCmdFmt(IMP.dfmt)?(cm?cm.name:cards[0].name):'',info:'Imported deck list',cards,tokens:[]});
  save();IMP.stage='idle';IMP.items=null;IMP.dtext='';IMP.dname='';go('decks');V.deck=D.decks.length-1;render();scrollTo(0,0);toast(`Deck created${added?` — ${fxPl(added,'card')} added to your collection`:''}`);fetchArt()}
function fxTemplate(){fxDownload('Name,Quantity,Set code,Collector number,Finish,Price,Notes\r\nLightning Bolt,4,m11,146,Normal,,\r\nSol Ring,1,c21,263,Foil,2.50,From Sam\r\nLlanowar Elves,2,,,,,Only the name is required\r\n','mtg-import-template.csv','text/csv')}
function fxGuide(){fxDownload(`MtG DeckMaster — bulk import guide

1. Open mtg-import-template.csv in Excel, Google Sheets or Numbers.
2. Put one card per row. Only "Name" is required.
     Name              The card's name in English (e.g. Lightning Bolt)
     Quantity          How many copies (blank = 1)
     Set code          The 3-5 letter set code printed at the bottom-left of the card (e.g. M11). Optional.
     Collector number  The number printed next to the set code (e.g. 146). Optional, but with the set code it picks the exact artwork.
     Finish            Normal, Foil or Etched Foil (blank = Normal)
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
function fxExportCSV(){const q=v=>/[",\n]/.test(String(v))?'"'+String(v).replace(/"/g,'""')+'"':String(v??''),rows=[['Name','Quantity','Set code','Collector number','Finish','Pulled from','Type']];
  D.cards.forEach(c=>{const fm=finMapOf(c);Object.keys(fm).filter(k=>fm[k]>0).forEach(k=>rows.push([c.name,fm[k],c.set||'',c.cn||'',k,c.source&&c.source!=='None'?c.source:'',c.type||'']))});
  fxDownload(rows.map(r=>r.map(q).join(',')).join('\r\n')+'\r\n',`${fxPrefix()}collection_${tsName()}.csv`,'text/csv')}
function fxImportView(){
  if(IMP.stage==='pick')return fxQAPick();
  if(IMP.stage==='work')return `<h3>Reading your ${IMP.kind==='deck'?'deck list':'cards'}…</h3><p class="mut" id="impt">Looking cards up…</p><div class="pbar"><i id="impb" style="width:3%"></i></div>`;
  if(IMP.stage==='preview'){const it=IMP.items,deck=IMP.kind==='deck',ok=it.filter(x=>x.card||x.own),bad=it.filter(x=>!x.card&&!x.own),own=it.filter(x=>x.own);
    return `<h3>Check before importing</h3><div class="sec"><b>${fxPl(sum(ok,x=>x.qty),'card')}</b> matched on ${fxPl(ok.length,'line')}${ok.filter(x=>x.fuzzy).length?` · <b style="color:#f39c12">${ok.filter(x=>x.fuzzy).length} spelling corrected — check them below</b>`:''}${deck?` · ${own.length} already in your collection · ${ok.length-own.length} you don’t own`:''}${bad.filter(x=>!x.skip).length?` · <b style="color:#ff6b6b">${bad.filter(x=>!x.skip).length} not found</b>`:''}${bad.filter(x=>x.skip).length?` · ${bad.filter(x=>x.skip).length} skipped`:''}</div>
    ${bad.filter(x=>x.skip).length?`<div class="sec"><b>Skipped by you:</b> ${esc(bad.filter(x=>x.skip).map(x=>x.name).join(', '))}</div>`:''}${bad.filter(x=>!x.skip).length?`<div class="warn"><b>Not found (these will be skipped):</b> ${esc(bad.filter(x=>!x.skip).map(x=>x.name).slice(0,60).join(', '))}${bad.length>60?'…':''}</div>`:''}
    ${tbl(deck?['Qty','Card','Status']:['Qty','Card','Printing','Finish'],ok.slice(0,200).map(x=>deck?[x.qty,x.name,x.own?'✓ in your collection':'not owned'+(IMP.dadd?' — will be added':'')]:[x.qty,{h:esc(x.card.name)+(x.fuzzy?`<br><span style="color:#f39c12;font-size:12px">you typed “${esc(x.typed)}”</span>`:'')},`${x.card.set_name} · ${x.card.set.toUpperCase()} #${x.card.collector_number}`,x.fin]))}
    ${ok.length>200?`<p class="mut">Showing the first 200 of ${ok.length} lines.</p>`:''}
    ${deck?'':`<div class="f" id="impsrc">${srcFields(IMP.sq=IMP.sq||{},'Pulled from * (one for all of these cards)')}<p class="mut" style="margin:4px 0 0;font-size:12px">The set of each card comes from the artwork you chose — this is where you got them (a box, an order, a trade…).</p></div>`}
    <div class="row"><button onclick="fxImpCancel()">Cancel</button>${IMP.qa&&!deck?`<button onclick="IMP.stage='pick';IMP.pi=IMP.items.length-1;render()">‹ Change printings</button>`:''}<button class="pri" onclick="fxImpCommit()" ${ok.length?'':'disabled'}>${deck?'Create deck':'Add to my collection'}</button></div>`}
  const site=(n,u,t)=>`<li><a href="${u}" target="_blank" rel="noopener">${n}</a> — ${t}</li>`;
  return `<h3>Import cards into your collection</h3><p class="mut">Add many cards at once from a file or a pasted list. You see a preview first — nothing is added until you confirm.</p>
  ${fxHistView()}<p class="mut" style="font-size:12px">You’ll choose where the cards were pulled from (one “Pulled from” for the whole import) on the last screen, before anything is added.</p>
  <div class="row"><label class="btn pri">📄 Choose a file (CSV, text or Excel)<input type="file" accept=".csv,.tsv,.txt,.xlsx,.xls,text/*" hidden onchange="fxImpFile(this.files[0]);this.value=''"></label></div>
  <div class="f"><label>…or paste a list (one card per line)</label><textarea rows="5" placeholder="4 Lightning Bolt&#10;1 Sol Ring (C21) 263&#10;2x Llanowar Elves *F*" oninput="IMP.text=this.value">${esc(IMP.text)}</textarea></div><div class="row"><button onclick="fxImpText()">Read pasted list</button></div>
  <details class="g"><summary>📝 Template and guide for building your own file</summary><p class="mut">Download the template, fill in one card per row in Excel or Google Sheets, save it as CSV, then choose it above. Only the card name is required; set code + collector number pick the exact artwork.</p><div class="row"><button onclick="fxTemplate()">⬇ CSV template</button><button onclick="fxGuide()">⬇ Guide (text file)</button></div>
  ${tbl(['Column','What goes in it'],[['Name','Card name (required)'],['Quantity','Copies — blank means 1'],['Set code','3–5 letters at the bottom-left of the card, e.g. M11'],['Collector number','The number next to the set code'],['Finish','Normal, Foil or Etched Foil'],['Price / Notes','Optional']])}</details>
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
  const opts=[...D.decks.map((d,i)=>[`m:${i}`,d.name]),...OC.flatMap(r=>r.data.decks.map((d,i)=>[`o:${r.id}:${i}`,fxDeckTitle(d,r.given||r.data.owner||r.name)+(r.status==='signed'?' ✓':'')]))];
  const h=sel=>opts.map(([v,l])=>`<option value="${esc(v)}" ${sel===v?'selected':''}>${esc(l)}</option>`).join('')||'<option value="">No decks yet</option>';
  if(!V.simA||!opts.some(o=>o[0]===V.simA))V.simA=opts[0]?.[0]||'';if(!V.simB||!opts.some(o=>o[0]===V.simB))V.simB=(opts[1]||opts[0]||[''])[0];a.innerHTML=h(V.simA);b.innerHTML=h(V.simB)}
function simPick(v){const p=String(v).split(':');if(p[0]==='m'){const d=D.decks[+p[1]];return d&&Object.assign(simDeck(d,D.cards),{owner:D.uid||'',deck:d.name})}const r=(OC||[]).find(x=>x.id===p[1]),d=r&&r.data.decks[+p[2]];return d&&Object.assign(simDeck(d,r.data.cards,`${d.name} (${r.name})`),{owner:r.uid||'',deck:d.name})}
const simName=(s,k)=>{const o=s[k+'o'],r=o&&o!==D.uid&&(OC||[]).find(x=>x.uid===o&&!x.sep);return r&&s[k+'d']?`${s[k+'d']} (${r.name})`:s[k]};
async function fxSimRun(){const A=simPick(V.simA),B=simPick(V.simB),n=V.simN||1000,out=document.getElementById('simout');if(!A||!B)return toast('Pick two decks first');
  if(V.simA===V.simB&&!(await ask('Both sides are the same deck (a mirror match). Run it anyway?')))return;
  if(V.simA!==V.simB&&!(await ask(`Run ${n} games of ${A.name} vs ${B.name}?\n\nThe result is added to the Simulation log.`)))return;
  for(const d of [A,B])if(d.n<20)return toast(`${d.name} has only ${d.n} cards — add more before simulating`);
  out.innerHTML=`<p class="mut" id="simt">Playing games…</p><div class="pbar"><i id="simb" style="width:2%"></i></div>`;
  const r=await simRun(A,B,n,(d,t)=>{const b=document.getElementById('simb'),x=document.getElementById('simt');if(b)b.style.width=Math.round(d/t*100)+'%';if(x)x.textContent=`Playing games… ${d} of ${t}`});
  const ms=simMaster(),num=Math.max(0,...ms.rows.slice(1).map(x=>parseInt(String(x[0]).replace(/\D/g,''))||0))+1,id='MATCH-'+String(num).padStart(3,'0'),pct=v=>(Math.round(v/n*1000)/10).toFixed(1);
  const fmt=A.fmt&&A.fmt===B.fmt?`${A.fmt} (${fmtSize(A.fmt)} Cards)`:'Mixed formats';
  ms.rows.push([id,today(),A.name,B.name,fmt,String(n),`${r.aw} (${pct(r.aw)}%)`,`${r.bw} (${pct(r.bw)}%)`,`${r.avg} Turns`,'Simulated in app']);
  D.sims.push({id,date:today(),a:A.name,b:B.name,fmt,n,aw:r.aw,bw:r.bw,dr:r.dr,avg:r.avg,ap:r.ap,ad:r.ad,unkA:A.unk,unkB:B.unk,la:A.list,lb:B.list,ca:A.commander,cb:B.commander,ao:A.owner,bo:B.owner,ad:A.deck,bd:B.deck,note:''});
  V.simOpen=id;save();render();toast(`${A.name} ${pct(r.aw)}% — ${B.name} ${pct(r.bw)}%`)}
async function fxSimDel(id){if(!(await ask(`Remove ${id} from the matchup log?`)))return;const ms=simMaster();ms.rows=ms.rows.filter((r,i)=>i===0||r[0]!==id);D.sims=(D.sims||[]).filter(s=>s.id!==id);save();render()}
function fxSimPrompt(s){return `You are an expert Magic: The Gathering analyst. Two decks were played against each other in a simplified simulator (it models mana, creatures, combat keywords, removal, burn, card draw and ramp, but not triggered abilities or combos).

Simulator result over ${s.n} games (${s.fmt}): ${s.a} won ${s.aw}, ${s.b} won ${s.bw}, ${s.dr} drawn or stalled. Average game length ${s.avg} turns.

Please give: (1) your own estimate of the real win rate and whether the simulator is likely over- or under-rating either deck, and why; (2) the key cards and synergies in each deck for this matchup; (3) how each deck should play the matchup; (4) two or three card changes that would improve each deck against the other. Keep it under 350 words.

DECK A — ${s.a}${s.ca?' (commander: '+s.ca+')':''}:
${s.la||'(list not saved)'}

DECK B — ${s.b}${s.cb?' (commander: '+s.cb+')':''}:
${s.lb||'(list not saved)'}`}
const simGet=id=>(D.sims||[]).find(s=>s.id===id);
function fxSimCopy(id){const s=simGet(id);if(!s)return;navigator.clipboard.writeText(fxSimPrompt(s)).then(()=>toast('Prompt copied — paste it into your AI app, then paste its answer back here'),()=>toast('Could not copy'))}
async function fxSimNote(id){const s=simGet(id),el=document.getElementById('sn-'+id);if(!s||!el)return;if(!(await ask('Save this note on the matchup?')))return;s.note=el.value.trim();V.simOpen=id;save();render();toast('Commentary saved')}
// One place that talks to the AI providers. Times out (default 3 min) and can be cancelled; gives a clear message for every failure.
async function fxCallAI(p,o){o=o||{};const key=AIKEY.trim(),model=G.model.trim();if(!key||!model)throw new Error('Enter your API key on the Deck Generator tab first (Option B).');
  const ctl=new AbortController(),to=setTimeout(()=>ctl.abort(),o.timeout||180000);if(o.signal)o.signal.addEventListener('abort',()=>ctl.abort());let r,j,txt='';
  try{
    if(G.prov==='anthropic'){r=await fetch('https://api.anthropic.com/v1/messages',{signal:ctl.signal,method:'POST',headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model,max_tokens:o.maxTokens||1500,messages:[{role:'user',content:p}]})});j=await r.json();txt=(j.content||[]).map(b=>b.text||'').join('')}
    else if(G.prov==='openai'){r=await fetch('https://api.openai.com/v1/chat/completions',{signal:ctl.signal,method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({model,messages:[{role:'user',content:p}]})});j=await r.json();txt=j.choices?.[0]?.message?.content||''}
    else{r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{signal:ctl.signal,method:'POST',headers:{'content-type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{parts:[{text:p}]}]})});j=await r.json();
      txt=(j.candidates?.[0]?.content?.parts||[]).filter(x=>!x.thought).map(x=>x.text||'').join('');if(!txt&&j.candidates?.[0]?.finishReason)txt='';if(!txt&&j.promptFeedback?.blockReason)throw new Error('Gemini blocked the request ('+j.promptFeedback.blockReason+').')}}
  catch(e){clearTimeout(to);if(e.name==='AbortError')throw e;if(e instanceof TypeError)throw new Error('Couldn’t reach '+(FXPN[G.prov]||'the provider')+' — check your internet connection.');throw e}
  clearTimeout(to);
  if(!r.ok){const m=j&&j.error&&(j.error.message||j.error.type)||('error '+r.status);throw new Error(`${FXPN[G.prov]||'The provider'} said: ${m}${r.status===404||/model/i.test(m)?' — tap “My models” to pick a model your key can use.':r.status===401||r.status===403?' — check the API key.':r.status===429?' — you’ve hit a usage or rate limit; wait a minute or check your plan.':''}`)}
  if(!txt)throw new Error('The AI sent back an empty reply'+(j.candidates?.[0]?.finishReason?` (${j.candidates[0].finishReason})`:j.stop_reason?` (${j.stop_reason})`:'')+'. Try again or pick another model.');return txt}
async function fxSimAsk(id){const s=simGet(id);if(!s)return;if(!(await ask(s.note?'Ask the AI to explain this matchup?\n\nIts answer replaces the current note.':'Ask the AI to explain this matchup?\n\nIts answer is saved as the note.')))return;toast('Asking the AI…');try{s.note=(await fxCallAI(fxSimPrompt(s))).trim();V.simOpen=id;save();render();toast('Commentary added')}catch(e){toast(String(e&&e.message||e).slice(0,140))}}

/* ---------- card prices (Scryfall, USD) and collection sorting ---------- */
const fxMoney=v=>'$'+(Math.round(v*100)/100).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
const fxUnit=c=>{const p=(c&&c.price)||{},n=+p.n||0,f=+p.f||n,e=+p.e||f;return {Normal:n||f||e,Foil:f||n,'Etched Foil':e||n}};
/* Per-copy value: each copy is priced by its own verified printing (copies 2+ in c.cps carry their own Scryfall price); copies without their own printing use the card's price. Finishes are handed out to the copies in order (Normal first, then Foil, …). */
function fxCopyVals(c){if(!c)return [];const fm=finMapOf(c),fins=[];Object.keys(fm).forEach(k=>{for(let i=0;i<(fm[k]||0);i++)fins.push(k)});const out=[];
  for(let i=0;i<c.qty;i++){const own=i?(c.cps||[])[i-1]:null,src=own&&own.price?own:c,u=fxUnit(src),fin=fins[i]||'Normal';
    out.push({k:i+1,fin,v:(u[fin]??u.Normal)||0,lab:i?(own?`${own.setName||''} · ${String(own.set||'').toUpperCase()} #${own.cn||''}`:'artwork not verified'):(c.set&&c.verified?`${c.setName||''} · ${String(c.set||'').toUpperCase()} #${c.cn||''}`:'artwork not verified'),own:!!(i?own:c.verified),cnt:!!(i?own:c.verified)||fxBasic(c)})}
  return out}
const fxHasCopyPrices=c=>!!(c&&c.qty>1&&(c.cps||[]).some(x=>x&&x.price));
/* Value counted in totals: only copies whose artwork is verified (basic lands always count). fxValAll = market value of every copy (used for sorting / per-card badges). */
function fxValAll(c){if(!c)return 0;if(fxHasCopyPrices(c))return sum(fxCopyVals(c),x=>x.v);if(!c.price)return 0;const u=fxUnit(c),fm=finMapOf(c);return sum(Object.keys(fm),k=>(fm[k]||0)*(u[k]??u.Normal))}
function fxVal(c){if(!c||(!c.price&&!fxHasCopyPrices(c)))return 0;return sum(fxCopyVals(c).filter(x=>x.cnt),x=>x.v)}
const fxEachAll=c=>c&&c.qty?fxValAll(c)/c.qty:0;
const fxEach=c=>c&&c.qty?fxVal(c)/c.qty:0;
const fxSetPrice=(e,c)=>{if(c&&c.prices&&(!e.price||!e.scryId||e.scryId===c.id)){e.price={n:c.prices.usd||'',f:c.prices.usd_foil||'',e:c.prices.usd_etched||''};e.priceAt=today()}};
let PRBUSY=false;
async function fetchPrices(force){if(PRBUSY||!D)return;const stale=c=>!c.custom&&(force||!c.priceAt||(Date.now()-new Date(c.priceAt))>7*864e5),todo=D.cards.filter(c=>isReal(c)&&stale(c));if(!todo.length)return;PRBUSY=true;let got=0;
  const ident=c=>c.scryId?{id:c.scryId}:c.set&&c.cn?{set:String(c.set).toLowerCase(),collector_number:String(c.cn)}:{name:front(c.name)};
  try{for(let i=0;i<todo.length;i+=75){const ch=todo.slice(i,i+75),r=await scryFetch('https://api.scryfall.com/cards/collection',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({identifiers:ch.map(ident)})});if(!r||!r.ok)throw 0;
    const j=await r.json(),byId=new Map(),bySN=new Map(),byN=new Map();(j.data||[]).forEach(x=>{byId.set(x.id,x);bySN.set(x.set+'|'+x.collector_number,x);if(!byN.has(norm(front(x.name))))byN.set(norm(front(x.name)),x)});
    ch.forEach(c=>{const x=(c.scryId&&byId.get(c.scryId))||(c.set&&c.cn&&bySN.get(String(c.set).toLowerCase()+'|'+c.cn))||byN.get(norm(front(c.name)));if(x&&x.prices){c.price={n:x.prices.usd||'',f:x.prices.usd_foil||'',e:x.prices.usd_etched||''};c.priceAt=today();got++}});
    persist();await new Promise(r=>setTimeout(r,110))}
    const cp=todo.flatMap(c=>(c.cps||[]).filter(x=>x&&x.scryId));for(let i=0;i<cp.length;i+=75){const ch=cp.slice(i,i+75),r=await scryFetch('https://api.scryfall.com/cards/collection',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({identifiers:[...new Set(ch.map(x=>x.scryId))].map(id=>({id}))})});if(!r||!r.ok)break;
      const j=await r.json(),byId=new Map((j.data||[]).map(x=>[x.id,x]));ch.forEach(x=>{const y=byId.get(x.scryId);if(y&&y.prices){x.price=fxPriceOf(y);x.priceAt=today();got++}});persist()}}catch(e){}
  PRBUSY=false;if(got&&V.view==='collection'&&!$('#modal').classList.contains('open')&&document.activeElement?.id!=='q'){const y=scrollY;render();scrollTo(0,y)}}
function fxPriceRow(c){if(!c||!findCard(c.name))return '';if(!c.price&&!fxHasCopyPrices(c))return '';
  const L=fxCopyVals(c),cnt=L.filter(x=>x.cnt),wait=L.filter(x=>!x.cnt&&x.v),at=`<span style="font-weight:400;font-size:11px">(Scryfall${c.priceAt?', '+esc(c.priceAt):''})</span>`,
    note=n=>`<div class="mut" style="font-size:12px;margin:4px 0 0">${n===1&&c.qty===1?'This card isn’t':`${n} ${n===1?'copy isn’t':'copies aren’t'}`} counted in your collection value until ${n===1?'its':'their'} artwork is verified (🎨).</div>`;
  if(!sum(L,x=>x.v))return `<div class="kv"><span>Price</span><b class="mut">no price listed</b></div>`;
  if(c.qty>1&&(fxHasCopyPrices(c)||wait.length)){return `<div class="kv"><span>Value per copy ${at}</span><b></b></div>${L.map(x=>`<div class="kv" style="padding-left:10px"><span style="font-weight:400">Copy ${x.k} · ${esc(x.lab)}${x.fin!=='Normal'?' · '+esc(x.fin):''}</span><b>${!x.v?'<span class="mut">no price</span>':x.cnt?fxMoney(x.v):`<span class="mut" title="Not counted until the artwork is verified">(${fxMoney(x.v)})</span>`}</b></div>`).join('')}<div class="kv" style="border-top:1px solid var(--card2);margin-top:4px;padding-top:6px"><span><b>${wait.length?`Counted value (${cnt.length} of ${c.qty} copies)`:`Total value of all ${c.qty} copies`}</b></span><b style="color:var(--gold)">${fxMoney(sum(cnt,x=>x.v))}</b></div>${wait.length?note(wait.length):''}`}
  const u=fxUnit(c),fm=finMapOf(c),ks=Object.keys(fm).filter(k=>fm[k]>0),each=ks.map(k=>`${fxMoney(u[k]??u.Normal)}${ks.length>1?' '+esc(k):''}`).join(' · ');
  return `<div class="kv"><span>Price ${at}</span><b>${each} each${c.qty>1&&!wait.length?` · ${fxMoney(fxVal(c))} total`:''}</b></div>${wait.length?note(wait.length):''}`}
const fxTotalTile=()=>{const v=sum(D.cards,fxVal);return v?`<div title="Estimated from Scryfall market prices — only cards with verified artwork are counted"><b>${fxMoney(v)}</b>est. value</div>`:''};
const fxDeckValue=d=>{const v=sum(d.cards,e=>e.qty*fxEach(findCard(e.name)));return v?`<span>Value ${fxMoney(v)}</span>`:''};
const FXSORT=[['','Sort: original order'],['new','Sort: newest added first'],['az','Sort: name A → Z'],['za','Sort: name Z → A'],['qty','Sort: most copies first'],['mvlo','Sort: mana value, low → high'],['mvhi','Sort: mana value, high → low'],['prhi','Sort: price, high → low'],['prlo','Sort: price, low → high'],['total','Sort: total value, high → low'],['type','Sort: card type'],['color','Sort: color']];
const fxSortKey=()=>{if(V.sort==null){try{V.sort=localStorage.getItem('mtg_sort_v1')||''}catch(e){V.sort=''}}return V.sort};
const fxSortSel=()=>`<select id="fs" aria-label="Sort">${FXSORT.map(([k,l])=>`<option value="${k}" ${fxSortKey()===k?'selected':''}>${l}</option>`).join('')}</select>`;
function fxSetSort(v){V.sort=v;try{localStorage.setItem('mtg_sort_v1',v)}catch(e){}drawList(true)}
function fxSort(cs){const k=fxSortKey(),mv=c=>parseFloat(c.cmc)||0,nm=(a,b)=>a.name.localeCompare(b.name);if(!k)return cs;const a=[...cs];
  return k==='new'?a.reverse():k==='az'?a.sort(nm):k==='za'?a.sort((x,y)=>nm(y,x)):k==='qty'?a.sort((x,y)=>y.qty-x.qty||nm(x,y)):k==='mvlo'?a.sort((x,y)=>mv(x)-mv(y)||nm(x,y)):k==='mvhi'?a.sort((x,y)=>mv(y)-mv(x)||nm(x,y)):
    k==='prhi'?a.sort((x,y)=>fxEachAll(y)-fxEachAll(x)||nm(x,y)):k==='prlo'?a.sort((x,y)=>(fxEachAll(x)||1e9)-(fxEachAll(y)||1e9)||nm(x,y)):k==='total'?a.sort((x,y)=>fxValAll(y)-fxValAll(x)||nm(x,y)):k==='type'?a.sort((x,y)=>String(x.type).localeCompare(String(y.type))||nm(x,y)):a.sort((x,y)=>String(x.colors).localeCompare(String(y.colors))||nm(x,y))}
const fxBadge=c=>'×'+c.qty+(/^(prhi|prlo|total)$/.test(fxSortKey())&&fxValAll(c)?' · '+fxMoney(V.sort==='total'?fxValAll(c):fxEachAll(c)):'');

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
async function fxRename(v){const n=String(v||'').trim();if(n===(D.owner||''))return;if(!(await ask(`Rename your collection to “${n}”?\n\nYour ID stays the same.`)))return render();D.owner=n;save();toast('Collection name saved — your ID stays the same')}
function fxAsk(title,body,btns){window.FXASK=btns.map(b=>()=>{closeM();b.fn&&b.fn()});
  openM(`<h3>${title}</h3>${body}<div style="display:flex;flex-direction:column;gap:10px;margin-top:14px">${btns.map((b,i)=>`<button class="${b.cls||''}" style="padding:13px" onclick="FXASK[${i}]()">${b.t}</button>`).join('')}</div>`)}
const fxWho=(name,uid)=>`<b>${esc(name||'(no name)')}</b>${uid?` <span class="mut">· ID ${esc(fxCode(uid))}</span>`:' <span class="mut">· no ID (older file)</span>'}`;

/* ---------- one way in for every file: backup, share file, or someone else's backup ---------- */
async function fxOpenFile(f,hint){if(!f)return;let j;try{j=await fxReadBackup(f)}catch(e){return toast('That file isn’t a MtG DeckMaster backup or share file')}
  if(j.kind==='mtg-share')return fxGotShare(j);if(j.xfer)return fxGotDevice(j);return fxGotBackup(j,f,hint)}
async function fxRestoreAsk(j){let m=`Restore this backup? It replaces everything currently in the app (${D.cards.length} card titles, ${fxPl(D.decks.length,'deck')}).`;
  if(j.updated&&D.updated&&j.updated<D.updated-60000&&D.cards.length)m+=`\n\n⚠ This backup is OLDER than what is in the app now.\nBackup last changed: ${new Date(j.updated).toLocaleString()}\nApp last changed: ${new Date(D.updated).toLocaleString()}\nAnything you changed since then will be lost.`;
  if(await ask(m))fxRestore(j)}
function fxRestore(j){fxKeysIn(j,(j.uid&&D&&j.uid===D.uid)||(D&&!D.cards.length&&!D.decks.length));fxImgsIn(j);D=j;D.acq=D.acq||[];D.edits=D.edits||[];D.flags=D.flags||[];D.kept=D.kept||{};D.loans=D.loans||[];normSources();fxMigrate();fxInitId();DRAFT=null;V.noWelcome=0;save();stamp();closeM();toast('Backup restored');render();fetchArt();fxSrcAuto()}
function fxGotBackup(j,f,hint){const empty=!D.cards.length&&!D.decks.length,same=j.uid&&D.uid&&j.uid===D.uid;
  const asFriend=()=>fxSaveFriend({uid:j.uid||('old-'+fxUuid()),name:j.owner||String(f.name||'Collection').replace(/\.[^.]+$/,'').replace(/[_-]?(mtg-)?backup.*$/i,'').replace(/_[0-9A-Z]{4}-[0-9A-Z]{4}$/,'')||'Collection',updated:j.updated||f.lastModified||Date.now(),pub:j.keys?j.keys.pub:null,cards:j.cards,decks:j.decks,customImgs:j.customImgs,scope:'all'},'unverified',{});
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
async function fxRecover(j,mode){if(mode==='mine'&&!(await ask(`Replace your current cards and decks (${D.cards.length} titles, ${fxPl(D.decks.length,'deck')}) with the ones in this share file?\n\nYour logs, sleeves and ID are kept.`)))return;
  D.cards=j.cards;D.decks=j.decks;D.loans=[];if(mode!=='mine'){D.owner=mode==='copy'?(j.name||'My')+' (copy)':j.name;D.uid=mode==='recover'?j.uid:fxUuid();D.created=today();D.keys=null;fxKeys()}
  normSources();IDX=null;DRAFT=null;V.noWelcome=0;save();render();fetchArt();toast(mode==='recover'?'Collection recovered — friends will be asked to trust your new signature':'Done')}
function fxFriendIndex(rec,del){const F=RO?(MINE.D.friends=MINE.D.friends||[]):(D.friends=D.friends||[]),i=F.findIndex(x=>x.uid===rec.uid);if(del){if(i>=0)F.splice(i,1)}else if(!rec.sep&&!rec.link){const e={uid:rec.uid,name:rec.name,pub:rec.pub||null};i>=0?F[i]=e:F.push(e)}if(!RO)save()}
async function fxSaveFriend(j,status,opt){await ocLoad();const ex=opt.separate?null:OC.find(r=>r.uid===j.uid&&!r.sep&&!!r.link===!!opt.link),nick=((D.friends||[]).find(x=>x.uid===j.uid)||{}).name;
  let data={cards:j.cards,decks:j.decks,owner:j.name,updated:j.updated,customImgs:j.customImgs||{}},msg='';
  if(j.scope==='deck'&&ex){data=JSON.parse(JSON.stringify(ex.data));j.decks.forEach(d=>{const i=data.decks.findIndex(x=>x.name===d.name);i>=0?data.decks[i]=d:data.decks.push(d)});data.customImgs=Object.assign(data.customImgs||{},j.customImgs||{});j.cards.forEach(c=>{const i=data.cards.findIndex(x=>norm(x.name)===norm(c.name));if(i<0)data.cards.push(c);else if(ex.partial)data.cards[i]=c});msg=`Deck “${j.decks[0].name}” added to ${ex.name}`}
  else if(ex){const o=new Set(ex.data.cards.map(c=>norm(c.name))),n=new Set(j.cards.map(c=>norm(c.name))),add=[...n].filter(x=>!o.has(x)).length,rem=[...o].filter(x=>!n.has(x)).length,dd=j.decks.length-ex.data.decks.length;
    msg=`${ex.name} updated: ${add?'+'+add+' ':''}${rem?'−'+rem+' ':''}${add||rem?'card titles':'no card changes'}${dd?`, ${dd>0?'+':''}${dd} deck${Math.abs(dd)===1?'':'s'}`:''}`}
  const rec={id:ex?ex.id:'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),uid:j.uid,name:ex?ex.name:(opt.separate?(j.name||'Collection')+' (unverified copy)':(opt.link?opt.nick:nick)||opt.nick||j.name||'Collection'),given:j.name,updated:j.scope==='deck'&&ex?Math.max(ex.updated||0,j.updated||0):j.updated,added:ex?ex.added:Date.now(),
    pub:opt.trust||!ex||!ex.pub?(j.pub||null):ex.pub,status:j.scope==='deck'&&ex?ex.status:status,partial:j.scope==='deck'?(ex?!!ex.partial:true):false,sep:!!opt.separate,link:!!opt.link,data};
  try{await fxTx('readwrite',st=>st.put(rec))}catch(e){toast('Could not save that collection (storage full?)');return null}
  fxFriendIndex(rec);toast(msg||`${rec.name} added to Other collections${status==='signed'?' ✓ verified':''}`);if(!opt.quiet){V.view='more';V.sub='others';render()}return rec}

/* ---------- sharing: signed share files and deck links ---------- */
async function fxShareData(scope,i){const keep=['name','colors','cost','cmc','type','subtype','power','toughness','text','keywords','qty','finish','set','setName','cn','scryId','art','art2','leg','legAt','price','priceAt','verified','custom'];
  let decks=D.decks.map(d=>({name:d.name,format:d.format,commander:d.commander||'',cards:d.cards.map(e=>({name:e.name,qty:e.qty,finish:e.finish||'Normal'})),tokens:d.tokens||[]})),cards=D.cards;
  if(scope==='deck'){decks=[decks[i]];const s=new Set(decks[0].cards.map(e=>norm(e.name)));cards=cards.filter(c=>s.has(norm(c.name)))}
  const body={kind:'mtg-share',v:1,scope,uid:D.uid,name:D.owner||'Collection',updated:D.updated||Date.now(),pub:D.keys?D.keys.pub:null,cards:cards.map(c=>{const o={};keep.forEach(k=>{if(c[k]!=null)o[k]=c[k]});return o}),decks};
  const im={};cards.forEach(c=>{if(c.custom&&CIMG[c.name])im[c.name]=CIMG[c.name]});if(Object.keys(im).length)body.customImgs=im;
  const txt=JSON.stringify(body),sig=await fxSign(txt);return JSON.stringify(Object.assign(JSON.parse(txt),{sig}))}
async function fxSend(text,name){const blob=new Blob([text],{type:'application/json'});
  if(isNative()){try{await nativeSave(blob,name,true)}catch(e){toast('Could not share the file: '+String(e&&e.message||e).slice(0,80))}return}
  try{const file=new File([blob],name,{type:'application/json'});if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:name});return}}catch(e){if(e&&e.name==='AbortError')return}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();toast('Share file saved to Downloads — send it to your friend')}
async function fxShareFile(scope,i){if(!D.uid)fxIdentity();if(!D.keys)await fxKeys();
  const name=`${fxPrefix()}${scope==='deck'?'deck-'+(fxSlug(D.decks[i].name).replace(/-$/,'')||'deck')+'_':''}share_${tsName()}.json`;fxSend(await fxShareData(scope,i),name)}
async function fxPack(o){const b=new TextEncoder().encode(JSON.stringify(o));let out=b,z='j';try{if(window.CompressionStream){out=new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());z='z'}}catch(e){out=b;z='j'}
  return z+fxB64(out).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
/* Compact deck code (prefix c / C): cards with a known set + number are sent as “#set:number”, others by name; qty 1 is left out. */
async function fxPackDeck(d){const lines=[d.name,d.format||'',d.commander||'',D.owner||'',(D.uid||'').replace(/-/g,'')].map(x=>String(x).replace(/[\n|]/g,' '));
  const L=d.cards.map(e=>{const c=findCard(e.name),id=c&&!c.custom&&c.set&&c.cn?'#'+c.set+':'+c.cn:e.name.replace(/[\n|]/g,' ');return (e.qty>1?e.qty+'*':'')+id});
  if(!D.keys)await fxKeys();let txt=lines.join('\n')+'\n'+L.join('|');
  /* signed with this collection's key, so the receiver can check who it came from (same key as share files) */
  if(D.keys&&D.keys.pub){txt+='\nk:'+D.keys.pub.x+'.'+D.keys.pub.y;const s=await fxSign(txt);if(s)txt+='\ns:'+s}
  const b=new TextEncoder().encode(txt);let out=b,z='C';try{if(window.CompressionStream){out=new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());z='c'}}catch(e){}
  return z+fxB64(out).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
async function fxUnpack(s){const z=s[0];
  if(z==='c'||z==='C'){let b=fxUnB64(s.slice(1).replace(/-/g,'+').replace(/_/g,'/'));if(z==='c')b=new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    const all=new TextDecoder().decode(b),t=all.split('\n'),u=t[4]||'',uid=u.length===32?u.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,'$1-$2-$3-$4-$5'):u;
    const kl=t.find(x=>/^k:/.test(x)),sl=t.find(x=>/^s:/.test(x)),kx=kl?kl.slice(2).split('.'):null,signed=sl?all.slice(0,all.lastIndexOf('\ns:')):'';
    return {n:t[0],f:t[1],c:t[2],o:t[3],u:uid,pub:kx&&kx.length===2?{kty:'EC',crv:'P-256',x:kx[0],y:kx[1],ext:true}:null,sig:sl?sl.slice(2):'',signed,l:(t[5]||'').split('|').filter(Boolean).map(x=>{const m=x.match(/^(\d+)\*(.*)$/),q=m?+m[1]:1,v=m?m[2]:x;const k=v.match(/^#([^:]+):(.+)$/);return k?[q,'',k[1],k[2]]:[q,v]})}}let b=fxUnB64(s.slice(1).replace(/-/g,'+').replace(/_/g,'/'));if(z==='z')b=new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());return JSON.parse(new TextDecoder().decode(b))}
/* Deck links: a TinyURL short link (needs internet). Offline, the app offers an app-only link that carries the compact deck code itself. */
/* “Nick's Collection - Rakdos Aggro” — a deck's name with its owner, for sharing and for other people's decks */
const fxDeckTitle=(d,owner)=>{const o=owner!=null?owner:(RO?(RO.given||RO.name):D.owner)||'';return o?`${o} - ${d.name}`:d.name};
const fxLinkBase=()=>!isNative()&&/^https?:/.test(location.protocol)?new URL('d/',location.origin+location.pathname).href:FX_SITE+'d/';
async function fxShortUrl(url){const api='https://tinyurl.com/api-create.php?url='+encodeURIComponent(url),ok=s=>/^https:\/\/(tinyurl\.com|is\.gd)\/[A-Za-z0-9_\-]+$/.test(String(s||'').trim())?String(s).trim():'';
  const H=isNative()&&window.Capacitor.Plugins.CapacitorHttp;
  if(H){try{const r=await H.get({url:api,responseType:'text'});const s=ok(r&&r.data);if(s)return s}catch(e){}}
  try{const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),12000),r=await fetch(api,{signal:ctl.signal});clearTimeout(t);if(r.ok){const s=ok(await r.text());if(s)return s}}catch(e){}
  /* web fallback when TinyURL doesn't allow browser requests: is.gd via JSONP */
  return await new Promise(res=>{const cb='fxIsgd'+Date.now(),s=document.createElement('script'),done=v=>{delete window[cb];s.remove();res(v)};const t=setTimeout(()=>done(''),12000);
    window[cb]=j=>{clearTimeout(t);done(ok(j&&j.shorturl))};s.onerror=()=>{clearTimeout(t);done('')};s.src='https://is.gd/create.php?format=json&callback='+cb+'&url='+encodeURIComponent(url);document.head.appendChild(s)})}
async function fxSendLink(d,url,short){const title=fxDeckTitle(d),text=`${title} — a MtG DeckMaster deck`;
  try{if(isNative()&&window.Capacitor.Plugins.Share){await window.Capacitor.Plugins.Share.share({title,text,url,dialogTitle:'Share deck link'});return}
    if(navigator.share){await navigator.share({title,text,url});return}}catch(e){if(e&&(e.name==='AbortError'||/cancel/i.test(String(e.message))))return}
  navigator.clipboard.writeText(url).then(()=>toast(short?'Short link copied — paste it into a message':'Deck link copied — paste it into a message'),()=>askText('Copy this link:',url))}
async function fxAppLink(i){const d=D.decks[i];fxSendLink(d,fxLinkBase()+'#d='+await fxPackDeck(d),false)}
async function fxDeckLink(i,tries){tries=tries||0;const d=D.decks[i];if(!D.uid)fxIdentity();
  const offline=()=>fxAsk('You’re offline',`<p>A short link needs the internet.</p><p class="mut">You can share an <b>app-only link</b> instead: it carries the deck list itself, so it’s longer, but it works without any outside service and opens in MtG DeckMaster (app or web).</p>`,[{t:'🔗 Share app-only link',cls:'pri',fn:()=>fxAppLink(i)},{t:'Cancel'}]);
  if(!navigator.onLine)return offline();
  toast('Making a short link…');const long=fxLinkBase()+'?d='+await fxPackDeck(d),s=await fxShortUrl(long);
  if(s)return fxSendLink(d,s,true);
  if(!navigator.onLine)return offline();
  /* online but no short link: one retry, then the app-only link joins the choices (resets next time Share deck is opened) */
  if(!tries)return fxAsk('Couldn’t make a short link','<p class="mut">The link service (TinyURL) didn’t answer. Try again in a moment, or send the deck as a file.</p>',[{t:'↻ Try again',cls:'pri',fn:()=>fxDeckLink(i,1)},{t:'📄 Send as a file',fn:()=>fxShareFile('deck',i)},{t:'Cancel'}]);
  fxAsk('Still no short link','<p>The link service still isn’t answering.</p><p class="mut">You can share an <b>app-only link</b> instead: it carries the deck list itself, so it’s longer, but it works without any outside service and opens in MtG DeckMaster (app or web). Or send the deck as a file.</p>',[{t:'🔗 Share app-only link',cls:'pri',fn:()=>fxAppLink(i)},{t:'📄 Send as a file',fn:()=>fxShareFile('deck',i)},{t:'Cancel'}])}
/* A pasted / opened short link: the Android app asks TinyURL where it leads; otherwise the link is opened and comes back through the deck-link page. */
/* is.gd can tell us where a short link leads (JSONP works in the browser and in the Android app). */
const fxIsgdLookup=u=>new Promise(res=>{const code=(u.match(/is\.gd\/([A-Za-z0-9_\-]+)/i)||[])[1];if(!code)return res('');const cb='fxIsgdF'+Date.now(),s=document.createElement('script'),done=v=>{delete window[cb];s.remove();res(v||'')};const t=setTimeout(()=>done(''),10000);
  window[cb]=j=>{clearTimeout(t);done(j&&j.url)};s.onerror=()=>{clearTimeout(t);done('')};s.src='https://is.gd/forward.php?format=json&callback='+cb+'&shorturl='+code;document.head.appendChild(s)});
async function fxOpenShort(u){const H=isNative()&&window.Capacitor.Plugins.CapacitorHttp;
  if(/is\.gd\//i.test(u)&&navigator.onLine){const t=await fxIsgdLookup(u),m=String(t).match(/[#?&]d=[A-Za-z0-9_\-]+/);if(m)return fxOpenLink(m[0])}
  if(H){try{toast('Opening the short link…');const r=await H.get({url:u,responseType:'text'}),fin=String(r&&r.url||''),m=fin.match(/[#?&]d=[A-Za-z0-9_\-]+/)||String(r&&r.data||'').match(/[#?&]d=[A-Za-z0-9_\-]+/);if(m)return fxOpenLink(m[0])}catch(e){}}
  if(!navigator.onLine)return toast('You’re offline — short links need the internet to open');
  if(isNative())window.open(u,'_system');else location.href=u}
function fxShareDeck(i){const d=D.decks[i];fxAsk(`Share “${esc(d.name)}”`,'<p class="mut"><b>File</b>: signed, includes the card details, opens in the app under Other collections.<br><b>Link</b>: quickest — a short TinyURL link (needs internet) that opens the deck in the app or on the web. Links aren’t signed.</p>',[{t:'📄 Send as a file',cls:'pri',fn:()=>fxShareFile('deck',i)},{t:'🔗 Share as a link',fn:()=>fxDeckLink(i)},{t:'Cancel'}])}
function fxCardObj(c,src,n,fin){const f=c.card_faces?.[0]||c,L={W:'White',U:'Blue',B:'Black',R:'Red',G:'Green'},ci=(c.color_identity||[]).map(x=>L[x]).join('/'),tl=c.type_line||f.type_line||'';
  return {name:c.name,source:src,colors:ci||(/Land/.test(tl)?'Land':'Colorless'),cost:c.mana_cost||f.mana_cost||'None',cmc:String(c.cmc??0),type:catOf(c),subtype:(tl.split(' — ')[1]||'None'),power:f.power||'None',toughness:f.toughness||'None',
    text:c.oracle_text||f.oracle_text||'',keywords:(c.keywords||[]).join(', ')||'None',legal:c.legalities?.commander==='banned'?'Restricted: Banned in Commander':'None (Sanctioned Legal)',qty:n,finish:fin||'Normal',status:'Added in app'}}
async function fxOpenLink(text){const m=String(text||'').match(/[#?&]d=([A-Za-z0-9_\-]+)/);if(!m){const sh=String(text||'').match(/https?:\/\/(?:www\.)?(?:tinyurl\.com|is\.gd)\/[A-Za-z0-9_\-]+/i);if(sh)return fxOpenShort(sh[0]);return toast('That doesn’t look like a deck link')}let o;try{o=await fxUnpack(m[1]);if(!o||!Array.isArray(o.l)||!o.n)throw 0}catch(e){return toast('That deck link is damaged or incomplete')}
  const n=sum(o.l,x=>+x[0]||0);fxAsk('A deck was shared with you',`<div class="sec"><b>${esc((o.o?o.o+' - ':'')+o.n)}</b> <span class="mut">· ${esc(o.f||'')} · ${fxPl(n,'card')}</span><br>from ${fxWho(o.o||'someone',o.u)}</div><p class="mut">Links aren’t signed, so the sender can’t be verified. The deck is view-only until you copy it to your own decks.</p>`,[{t:'👁 View the deck',cls:'pri',fn:()=>fxLinkImport(o)},{t:'Cancel'}])}
async function fxLinkImport(o){toast('Looking the cards up…');const items=o.l.map(([q,nm,st,cn])=>({name:String(nm||''),qty:+q||1,set:st||'',num:cn||'',sid:''})),need=[];
  items.forEach(x=>{const c=x.name&&findCard(x.name);if(c)x.own=c;else need.push(x)});try{if(need.length)await fxResolve(need)}catch(e){return toast('Couldn’t reach Scryfall to look the cards up — check your internet connection')}
  items.forEach(x=>{if(!x.own&&x.card){const c=findCard(x.card.name);if(c)x.own=c;else if(!x.name)x.name=x.card.name}});
  const cards=[],seen=new Set();items.forEach(x=>{const src=x.own||(x.card&&Object.assign(fxCardObj(x.card,'',x.qty),{art:sImg(x.card),set:x.card.set,setName:x.card.set_name,cn:x.card.collector_number,scryId:x.card.id,leg:legOf(x.card.legalities)}));if(!src)return;x.name=src.name;if(seen.has(norm(src.name)))return;seen.add(norm(src.name));const c=JSON.parse(JSON.stringify(src));delete c.source;c.qty=x.qty;cards.push(c)});
  /* Signed links are checked with the sender's key. A verified deck joins that person's entry in Other collections (grouped by sender);
     unsigned or unverifiable links stay in a separate “shared by link” entry. A link signed with this collection's own key is one of your own decks. */
  const ok=!!(o.pub&&o.sig&&o.u&&await fxVerify(o.signed,o.sig,o.pub)),deck={name:o.n,format:o.f||'Casual',commander:o.c||'',cards:items.map(x=>({name:x.name,qty:x.qty,finish:'Normal'})),tokens:[]};
  if(ok&&D.uid&&o.u===D.uid&&D.keys&&D.keys.pub&&D.keys.pub.x===o.pub.x&&D.keys.pub.y===o.pub.y){const i=D.decks.findIndex(d=>d.name.toLowerCase()===o.n.toLowerCase());
    if(i>=0){V.view='decks';V.deck=i;render();scrollTo(0,0);return toast('This is your own deck — it’s already in your decks')}
    if(!(await ask(`“${o.n}” is one of your own decks (signed with your collection’s key), but it isn’t in your decks on this device.\n\nAdd it to your decks?`)))return;
    D.decks.push({name:o.n,format:deck.format,sleeve:'',commander:deck.commander,info:'Restored from your own deck link',cards:deck.cards.filter(e=>findCard(e.name)).map(e=>({name:findCard(e.name).name,qty:e.qty,finish:'Normal'})),tokens:[]});save();V.view='decks';V.deck=D.decks.length-1;render();scrollTo(0,0);return toast('Added to your decks')}
  await ocLoad();const ex=ok&&OC.find(r=>r.uid===o.u&&!r.sep&&!r.link),clash=ex&&ex.pub&&(ex.pub.x!==o.pub.x||ex.pub.y!==o.pub.y);
  if(clash&&!(await ask(`This link says it’s from ${ex.name}, but it was signed with a different key than the ${ex.name} you already have.\n\nIt could be someone else using their name. OK = keep it as a separate, unverified entry\nCancel = don’t open it`)))return;
  const uid=o.u||('link-'+fxUuid()),rec=await fxSaveFriend({uid,name:o.o||'Shared decks',updated:Date.now(),pub:ok&&!clash?o.pub:null,scope:'deck',cards,decks:[deck]},ok&&!clash?'signed':'unverified',ok&&!clash?{quiet:true}:{link:true,quiet:true,separate:!!clash,nick:(o.o||'Someone')+' — shared by link'});
  if(rec){await roOpen(rec.id);const i=D.decks.findIndex(d=>d.name===o.n);if(i>=0){V.view='decks';V.deck=i;render()}}}
function fxCheckLink(){try{if(/#d=/.test(location.hash)){const h=location.hash;history.replaceState(history.state,'',location.pathname+location.search);fxOpenLink(h)}}catch(e){}}
addEventListener('hashchange',()=>fxCheckLink());
const fxRoDeckBtns=i=>RO?`<div class="row"><button class="pri" onclick="fxBuildPlan(${i})">🛠 Build this deck with my cards</button><button onclick="fxSimVs(${i})">⚔ Simulate vs my decks</button></div>`:'';
function fxCopyDeck(i){const d=D.decks[i],from=RO.name,base=fxDeckTitle(d);roExit();let nm=base,k=2;while(D.decks.some(x=>x.name.toLowerCase()===nm.toLowerCase()))nm=`${base} ${k++}`;
  const cards=d.cards.map(e=>({name:(findCard(e.name)||e).name,qty:e.qty,finish:'Normal'})),own=cards.filter(e=>{const c=findCard(e.name);return c&&(c.type==='Basic Land'||c.qty>=e.qty)}).length;
  D.decks.push({name:nm,format:d.format||'Casual',sleeve:'',commander:d.commander||'',info:'Copied from '+from,cards,tokens:[]});save();V.view='decks';V.deck=D.decks.length-1;render();scrollTo(0,0);
  fxAsk('Deck copied to your decks',`<p>You own enough copies of <b>${own} of ${cards.length}</b> card titles in this deck.</p><p class="mut">Cards you don’t own are still on the list, so you can see what you’d need to get. No cards were added to your collection.</p>`,[{t:'Done',cls:'pri'}])}
function fxSimVs(i){const id=RO.id;roExit();V.view='more';V.sub='matchups';V.simB=`o:${id}:${i}`;render();scrollTo(0,0)}
function fxProfileView(){if(!D.uid)return `<p class="mut">You’re just looking around, so this app has no collection yet.</p><div class="f"><label>Name your collection</label><input id="wname" maxlength="40" placeholder="e.g. Nick’s collection"></div><div class="row"><button class="pri" onclick="fxStart()">Start my collection</button><label class="btn">⬆ Restore my backup<input type="file" hidden onchange="fxOpenFile(this.files[0],'restore');this.value=''"></label></div>`;
  const v=sum(D.cards,fxVal),kv=(a,b)=>`<div class="kv"><span>${a}</span><b>${b}</b></div>`;
  return `<div class="sec"><div class="f" style="margin-bottom:10px"><label>Collection name</label><input value="${esc(D.owner||'')}" maxlength="40" placeholder="e.g. Nick’s collection" onchange="fxRename(this.value)"></div>
  ${kv('Collection ID',`${esc(fxCode(D.uid))} <button style="padding:3px 8px;margin-left:6px" onclick="navigator.clipboard.writeText('${esc(fxCode(D.uid))}').then(()=>toast('ID copied'))">Copy</button>`)}${kv('Created',esc(D.created||'—'))}${kv('Cards',`${sum(D.cards)} <span class="mut">(${D.cards.length} titles)</span>`)}${kv('Decks',D.decks.length)}${v?kv('Estimated value <span class="mut" style="font-weight:400;font-size:11px">(verified artwork only)</span>',fxMoney(v)):''}${kv('Last changed',D.updated?esc(new Date(D.updated).toLocaleString()):'—')}${kv('Signature',D.keys?'✓ files you share are signed':'<span class="mut">not available on this device</span>')}</div>
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
async function fxBuilder(first){const i=V.deck,d=D.decks[i];if(RO||!d)return;
  if(first){const F=dfmt(d.format);if(F&&F.leg){const need=D.cards.filter(c=>isReal(c)&&!c.leg&&!c.legMiss);if(need.length&&!(await ensureLegal(need))){d.legPending=true;save();render();toast('Offline — rule warnings are incomplete until the cards are checked')}}V.bq='';V.bt='';V.bc='';V.bfree=false;V.bown=true;V.bsrc=V.bsrc||'';const types=[...new Set(D.cards.filter(isReal).map(c=>c.type))].sort();
    openM(`<h3>Add cards to ${esc(d.name)}</h3><div id="bhead" class="sec" style="position:sticky;top:0;z-index:2"></div>
    <input id="bq" type="search" placeholder="Search name or rules text…" style="width:100%" oninput="V.bq=this.value;fxBuilder()">
    <div class="brow" style="margin:8px 0"><select onchange="V.bt=this.value;fxBuilder()"><option value="">All types</option>${types.map(x=>`<option>${esc(x)}</option>`).join('')}</select><select onchange="V.bc=this.value;fxBuilder()"><option value="">All colors</option>${['White','Blue','Black','Red','Green','Colorless','Land'].map(x=>`<option>${x}</option>`).join('')}</select></div>
    <label style="margin:0 0 4px"><input type="checkbox" onchange="V.bfree=this.checked;fxBuilder()">Only show cards with a copy that isn’t in another deck</label>
    <label style="margin:0 0 8px"><input type="checkbox" checked onchange="V.bown=this.checked;fxBuilder()">Only add cards that are in my collection</label>
    <div id="bnew" class="sec" hidden><p class="mut" style="margin:0 0 6px">Cards you don’t own yet (e.g. you bought the whole deck) are searched on Scryfall. Adding one puts it in your collection <b>and</b> in this deck.</p><label style="margin:0">New cards are pulled from</label><input id="bsrc" list="bsrcl" placeholder="e.g. Singles Orders or the deck you bought" value="${esc(V.bsrc)}" oninput="V.bsrc=this.value"><datalist id="bsrcl">${allSources().filter(s=>!isCustomSrc(s)).map(s=>`<option value="${esc(s)}">`).join('')}</datalist></div><div id="bres"></div><div id="bscry"></div><div class="row"><button class="pri" onclick="closeM()">Done</button></div>`)}
  const el=document.getElementById('bres');if(!el)return;const q=(V.bq||'').toLowerCase(),dl=fxDeckCards(i),inDeck=n=>sum(dl.filter(e=>norm(e.name)===norm(n))),t=target(d),n=sum(dl),F=dfmt(d.format),cmdC=d.commander&&findCard(d.commander);
  document.getElementById('bhead').innerHTML=`<b>${n}${t?' / '+t:''} cards</b> in this ${F?esc(F.k)+' ':''}deck${fxDraftDirty()?' <span class="dl">· not saved yet</span>':''}${t&&n>=t?` <span style="color:#f39c12">· ${n>t?'over the limit':'full'}</span>`:''}${d.override?' <span style="color:#ff6b6b">· ⛔ override on</span>':''}<br><span class="mut" style="font-size:12px">Tap + or − as much as you like, then Done and “Save changes”.</span>`;
  const list=D.cards.filter(c=>isReal(c)&&(!q||c.name.toLowerCase().includes(q)||String(c.text||'').toLowerCase().includes(q))&&(!V.bt||c.type===V.bt)&&(!V.bc||String(c.colors).includes(V.bc))&&(!V.bfree||freeCopies(c)>0||inDeck(c.name)>0)).sort((a,b)=>(inDeck(b.name)>0)-(inDeck(a.name)>0)||a.name.localeCompare(b.name));
  FXB=list.slice(0,60).map(c=>c.name);
  {const bn=document.getElementById('bnew');if(bn)bn.hidden=!!V.bown;fxBScry(q)}
  el.innerHTML=list.slice(0,60).map((c,k)=>{const u=usage(c.name).filter(x=>x.d!==d),fr=freeCopies(c),have=inDeck(c.name);
    const iss=fxCardIssues(c,have,F,cmdC);
    return `<div class="res" style="cursor:default;flex-wrap:wrap"><span style="flex:1;min-width:0">${esc(c.name)} ${costHtml(c.cost)}${iss.length?` <button class="isb" onclick="this.closest('.res').querySelector('.isd').hidden^=1">⚠ ${esc(iss[0].title)}${iss.length>1?' +'+(iss.length-1):''}</button>`:''}<br><span class="mut" style="font-size:12px">${esc(c.type)} · own ${c.qty} · ${c.type==='Basic Land'?'basic land':fr>0?fr+' free':'<b style="color:#f39c12">none free</b>'}${u.length?' · in '+esc(u.map(x=>x.d.name).join(', ')):''}</span></span>
    <span style="display:flex;align-items:center;gap:8px;flex:0 0 auto"><button style="padding:6px 12px" onclick="fxBAdd(${k},-1)" ${have?'':'disabled'}>−</button><b style="min-width:22px;text-align:center">${have}</b><button class="pri" style="padding:6px 12px" onclick="fxBAdd(${k},1)">+</button></span>${iss.length?`<div class="isd" hidden>${iss.map(x=>`<p><b>${esc(x.title)}.</b> ${esc(x.msg)}</p>`).join('')}<p class="mut">You can still add it — this is just so you know.</p></div>`:''}</div>`}).join('')+(list.length>60?`<p class="mut">Showing 60 of ${list.length} — search or filter to narrow it down.</p>`:'')||`<p class="mut">${V.bown?'No cards match.':'None of your cards match.'}</p>`}
async function fxBAdd(k,dl){const n=FXB[k];if(n==null)return;const d=D.decks[V.deck];if(dl>0&&!(await ask(`Pull 1× ${n} from your collection into ${d.name}?\n\n(It’s staged — tap Save changes on the deck to apply.)`)))return;const y=document.getElementById('modal').scrollTop;fxDraftChg(V.deck,n,dl,true);document.getElementById('modal').scrollTop=y}
/* Builder with “Only add cards that are in my collection” switched off: search Scryfall for cards you don't own and add them to the collection + this deck */
let BSC={q:'',list:null,t:0,busy:false};
function fxBScry(q){const el=document.getElementById('bscry');if(V.bown||!el){clearTimeout(BSC.t);if(el)el.innerHTML='';return}
  if(q.length<3){el.innerHTML='<p class="mut">Type at least 3 letters to also search cards you don’t own.</p>';return}
  if(BSC.q===q&&BSC.list)return fxBScryDraw();el.innerHTML='<p class="mut">Searching Scryfall…</p>';clearTimeout(BSC.t);
  BSC.t=setTimeout(async()=>{if(V.bown)return;const r=await scry('/cards/search?order=name&unique=cards&q='+encodeURIComponent(q));if((V.bq||'').toLowerCase()!==q)return;
    BSC={q,list:r&&r.data?r.data.filter(c=>!findCard(c.name)).slice(0,25):[],err:!r&&scry.st!==404,t:0};fxBScryDraw()},500)}
function fxBScryDraw(){const el=document.getElementById('bscry');if(!el)return;const L=BSC.list||[];
  el.innerHTML=`<h4 style="margin:12px 0 4px">Not in your collection — from Scryfall</h4>`+(BSC.err?'<p class="mut">Couldn’t reach Scryfall — check your internet connection.</p>':L.length?L.map((c,k)=>`<div class="res" style="cursor:default;flex-wrap:wrap"><span style="flex:1;min-width:0">${esc(c.name)} ${costHtml(c.mana_cost||c.card_faces?.[0]?.mana_cost||'')}<br><span class="mut" style="font-size:12px">${esc(c.type_line||'')} · you don’t own it</span></span>
    <span style="display:flex;align-items:center;gap:6px;flex:0 0 auto"><input id="bnq${k}" type="number" min="1" value="1" style="width:56px;padding:6px"><button class="pri" style="padding:6px 10px" onclick="fxBNew(${k})">＋ Add</button></span></div>`).join(''):'<p class="mut">No other cards match on Scryfall.</p>')}
async function fxBNew(k){const c=(BSC.list||[])[k],d=D.decks[V.deck];if(!c||!d)return;const q=Math.max(1,parseInt(document.getElementById('bnq'+k)?.value,10)||1);
  let src=canonSrc(String(V.bsrc||'').trim());if(!src){toast('Say where the new cards come from first (the box above)');document.getElementById('bsrc')?.focus();return}
  if(isCustomSrc(src))return toast('“Custom Cards” is only for custom cards — pick another “Pulled from”');if(!allSources().some(s=>s.toLowerCase()===src.toLowerCase()))src=autoNumber(src);
  if(!(await ask(`Add ${q}× ${c.name} to your collection AND put it in ${d.name}?\n\nPulled from: ${src}\n(The deck change is staged — tap Save changes on the deck to apply.)`)))return;
  fxAddCard(c,q,'Normal',src,'','Added while building '+d.name);V.bsrc=src;{const bi=document.getElementById('bsrc');if(bi)bi.value=src}IDX=null;saveArt();save();BSC.list=BSC.list.filter(x=>x!==c);
  const y=document.getElementById('modal').scrollTop;fxDraftChg(V.deck,c.name,q,true);document.getElementById('modal').scrollTop=y;toast(`${q}× ${c.name} added to your collection`)}
function fxDeckEdit(i){const d=D.decks[i];openM(`<h3>Edit deck details</h3><div class="f"><label>Name</label><input id="en" value="${esc(d.name)}"><label>Format</label><select id="ef">${fmtOptions(dfmt(d.format)?d.format:'Casual')}</select>
  <label>Commander (optional)</label><input id="ec" list="ecl" value="${esc(d.commander||'')}"><datalist id="ecl">${fxDeckCards(i).map(e=>`<option value="${esc(e.name)}">`).join('')}</datalist>
  <label>Sleeves <span id="sl" class="mut"></span></label><label style="margin:2px 0 4px;font-weight:400"><input type="checkbox" id="nsa" onchange="NSA=this.checked;sleeveOpts(window.FXCUR)">Auto-select from available sleeves</label><div class="swr" id="ns"></div></div><br><div class="row"><button onclick="closeM()">Cancel</button><button class="pri" onclick="fxDeckEditSave(${i})">Save details</button></div>`);
  const cur=sleeveOf(d);window.FXCUR=cur?cur.color:'';NSA=false;NSV=window.FXCUR;$('#ef').onchange=()=>sleeveOpts(window.FXCUR);sleeveOpts(window.FXCUR)}
async function fxDeckEditSave(i){const d=D.decks[i],name=$('#en').value.trim(),old=d.name;if(!name)return toast('Give the deck a name');if(D.decks.some((x,k)=>k!==i&&x.name.toLowerCase()===name.toLowerCase()))return toast('Another deck already has that name');if(!(await ask(`Save the changes to “${old}”?`)))return;
  const s=sleeveOf(d);d.name=name;d.format=$('#ef').value;d.commander=$('#ec').value.trim();
  if(name!==old){D.loans.forEach(l=>{if(l.from===old)l.from=name;if(l.to===old)l.to=name});D.swaps.forEach(w=>{if(w.deck===old)w.deck=name;if(w.row&&w.row[1]===old)w.row[1]=name})}
  const ns=D.sleeves.find(x=>x.color===NSV);if(s&&s!==ns){s.deck='';s.inUse=0}d.sleeve=ns?ns.color:'';
  if(ns){ns.deck=sleeveLabel(name,d.format);ns.inUse=Math.min(fmtSize(d.format)||60,ns.total)}
  save();fxOverrideAuto(i);closeM();render();toast('Deck details saved')}

/* ---------- Add card tab: type several card names at once ---------- */
const fxQuickAdd=()=>`<div class="sec" style="margin-top:22px"><h4>Add several cards at once</h4><div class="f"><textarea id="qadd" rows="3" placeholder="Sol Ring, Llanowar Elves, 4 Lightning Bolt" oninput="V.qadd=this.value">${esc(V.qadd||'')}</textarea></div>
  <p class="mut" style="font-size:12px;margin:6px 0">Type the card names with a comma between each one. Don’t use commas inside a card’s name — they are only for separating cards. Put a number in front for more than one copy (“4 Lightning Bolt”). You’ll see a preview before anything is added.</p><div class="row"><button class="pri" onclick="fxQuickGo()">Look up these cards</button></div></div>`;
function fxQuickGo(){const txt=(document.getElementById('qadd').value||'').trim();if(!txt)return toast('Type one or more card names first');const items=fxParseList(txt.split(/[,\n]+/).map(x=>x.trim()).filter(Boolean).join('\n'));if(!items.length)return toast('I couldn’t find any card names in that');
  V.qadd=txt;IMP.qa=true;fxImpStart(items,'collection')}

/* ---------- new source name: suggest similar existing sources as you type ---------- */
function fxSrcSuggest(v){const el=document.getElementById('srcsug');if(!el)return;v=String(v||'').trim();const lv=v.toLowerCase();if(lv.length<2){el.innerHTML='';return}
  const srcs=allSources().filter(x=>!IDX_SRC.includes(x.toLowerCase())&&!isCustomSrc(x)),bases={};
  srcs.forEach(x=>{const m=x.match(NUMRE),b=m?m[1].trim():x,k=b.toLowerCase();(bases[k]=bases[k]||{b,items:[]}).items.push(x)});
  const words=lv.split(/\s+/).filter(Boolean),score=b=>{const l=b.toLowerCase();if(l===lv)return 3;if(l.startsWith(lv))return 2.5;if(words.every(w=>l.includes(w)))return 2;const s=sim(lv,l.slice(0,Math.max(lv.length,4)));return s>=0.7?s:0};
  const hits=Object.values(bases).map(o=>({o,s:score(o.b)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s||a.o.b.localeCompare(b.o.b)).slice(0,4);
  if(!hits.length){el.innerHTML='';return}
  el.innerHTML=`<div class="mut" style="font-size:12px;margin:6px 0 2px">Matching sources — tap one:</div>`+hits.map(({o})=>{const nx=autoNumber(o.b),last=o.items.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).slice(-1)[0];
    return `<div class="res" style="padding:8px 10px;cursor:default;gap:6px;flex-wrap:wrap"><span><b>${esc(o.b)}</b> <span class="mut" style="font-size:12px">${o.items.length} so far</span></span><span style="display:flex;gap:6px;flex-wrap:wrap">
      ${nx!==o.b||!o.items.includes(o.b)?`<button style="padding:5px 9px;font-size:12px" class="pri" onclick="fxSrcPick('new','${esc(o.b).replace(/'/g,"\\'")}')">New pull: ${esc(nx)}</button>`:''}
      <button style="padding:5px 9px;font-size:12px" onclick="fxSrcPick('old','${esc(last).replace(/'/g,"\\'")}')">Add to ${esc(last)}</button></span></div>`}).join('')}
function fxSrcPick(kind,x){const q=SQ();if(kind==='new'){q.newSrc=x;const i=document.getElementById('newsrc');if(i)i.value=x;newSrcIn(x);document.getElementById('srcsug').innerHTML='';return}
  const g=srcGroup(x);q.grp=g==='Singles Orders'?'Singles Orders':g;q.sel=x;q.newSrc='';autoPrint(x);render()}


/* ---------- Verified artwork: one helper for every way a printing gets confirmed (gold ✓) ---------- */
function fxVerifyPrint(name,p,why,quiet){const e=findCard(name);if(!e||!p||RO)return false;if(/Pulled from/.test(why||'')&&(e.noAuto||fxCopyList(e).some(Boolean)))return false;const vb=true;
  logEdit(e.name,'Printing',e.set?`${e.setName} #${e.cn}${e.verified?' ✓':''}`:'(not set)',`${p.set_name} #${p.collector_number} ✓${why?' ('+why+')':''}`);
  Object.assign(e,{art:sImg(p),art2:sImg2(p),set:p.set,setName:p.set_name,cn:p.collector_number,scryId:p.id,verified:vb});e.price=null;e.priceAt='';fxSetPrice(e,p);
  ART[e.name]=sImg(p)||ART[e.name]||'';ART2[e.name]=sImg2(p)||'';if(!quiet){saveArt();save()}return true}
const fxPrintsUrl=n=>'https://api.scryfall.com/cards/search?order=released&unique=prints&include_extras=true&q='+encodeURIComponent('!"'+front(n)+'"');

/* ---------- Import history: every bulk / several-cards import, so artwork can be verified later, a bit at a time ---------- */
function fxHistAdd(src,ok,ver){D.imports=D.imports||[];const id=Date.now().toString(36);
  D.imports.unshift({id,at:today(),src,kind:ver?'several':'bulk',items:ok.map(x=>({name:x.card.name,qty:x.qty,fin:x.fin||'',sid:x.card.id||''}))});return id}
const fxHistLeft=h=>{const s=new Set();return (h?h.items:[]).filter(it=>{const e=findCard(it.name),k=norm(it.name);if(!e||e.custom||fxBasic(e)||e.verified||s.has(k))return false;s.add(k);return true})};
function fxHistView(){const L=D.imports||[];if(!L.length)return '';const left=sum(L,h=>fxHistLeft(h).length);
  return `<h3>Import history</h3><p class="mut">Every import is listed here. Cards whose artwork isn’t verified yet can be checked any time — stop whenever you like, the rest waits here.${left?` <b>${fxPl(left,'card')} still to verify.</b>`:''}</p>`+L.slice(0,30).map(h=>{const l=fxHistLeft(h),n=sum(h.items,x=>x.qty);
    return `<div class="sec"><b>${esc(h.at)}</b> · ${esc(h.src)} <span class="mut">· ${fxPl(n,'card')} · ${h.kind==='several'?'several cards at once':'bulk import'}</span>
    <div class="row" style="align-items:center;margin-top:6px">${l.length?`<span style="flex:1">${l.length} not verified yet</span><button class="pri" style="flex:0 0 auto" onclick="fxHistVerify('${h.id}')">✓ Verify artwork</button>`:'<span style="flex:1;color:var(--gold)">✓ All artwork verified</span>'}<button style="flex:0 0 auto;padding:8px 12px" onclick="fxHistDel('${h.id}')" title="Remove from history">✕</button></div>
    <details><summary class="mut" style="font-size:13px">Cards in this import</summary><div style="font-size:13px;margin-top:4px">${h.items.map(x=>{const e=findCard(x.name);return `${x.qty}× ${e?cl(e.name):esc(x.name)+' <span class="mut">(no longer in your collection)</span>'}${e&&e.verified?' <span style="color:var(--gold)">✓</span>':''}`}).join('<br>')}</div></details></div>`}).join('')+(L.length>30?`<p class="mut">Showing the newest 30 of ${L.length}.</p>`:'')}
async function fxHistDel(id){if(!(await ask('Remove this import from the history?\n\nYour cards stay in your collection — only this history entry goes.')))return;D.imports=(D.imports||[]).filter(h=>h.id!==id);save();render()}
function fxHistVerify(id){const h=(D.imports||[]).find(x=>x.id===id),l=fxHistLeft(h);if(!l.length)return toast('All artwork in this import is already verified');
  Object.assign(IMP,{stage:'pick',kind:'verify',vid:id,qa:false,pi:0,vdone:0,items:l.map(it=>({name:findCard(it.name).name,qty:it.qty,sid:it.sid,stub:true,card:{name:it.name,id:it.sid,finishes:['nonfoil'],prints_search_uri:fxPrintsUrl(it.name)}}))});
  go('more');V.sub='import';render();scrollTo(0,0)}
/* Search box above every artwork list (verify, several cards, artwork picker): matches set name, set code, collector number (“eld 123”, “#123”), year, finish (foil, etched), frame/border words (borderless, showcase, extended…). All words must match. */
function fxPrintHay(p){return [p.set_name,p.set,p.collector_number,'#'+p.collector_number,p.set+' '+p.collector_number,p.set+p.collector_number,(p.released_at||'').slice(0,4),(p.finishes||[]).join(' ').replace('nonfoil','normal nonfoil'),(p.frame_effects||[]).join(' ').replace('extendedart','extended art'),p.border_color==='borderless'?'borderless':'',(p.promo_types||[]).join(' '),p.full_art?'full art':'',p.promo?'promo':'',p.lang&&p.lang!=='en'?p.lang:'',p.artist||''].join(' ').toLowerCase()}
const fxPQ=(p,q)=>{q=String(q||'').toLowerCase().trim();if(!q)return true;const h=fxPrintHay(p);return q.replace(/#/g,' #').split(/\s+/).filter(Boolean).every(w=>h.includes(w))};
const fxPQBox=(i,x)=>`<input type="search" class="pqin" placeholder="🔍 Search set, code, number, year, foil…" value="${esc(x.pq||'')}" oninput="fxPQDraw(${i},this.value)" style="width:100%;margin:6px 0 8px"><p class="mut pqn" style="margin:-4px 0 6px;font-size:12px;${x.pq?'':'display:none'}"></p>`;
function fxPQDraw(i,v){const x=IMP.items[i];if(!x)return;x.pq=v;let n=0;document.querySelectorAll('#main .grid [data-pk]').forEach(t=>{const ok=fxPQ((x.prints||[x.card])[+t.dataset.pk]||{},v);t.style.display=ok?'':'none';if(ok)n++});const c=document.querySelector('#main .pqn');if(c){c.style.display=v?'':'none';c.textContent=n?`${n} of ${(x.prints||[x.card]).length} printings match`:'No printing matches — try fewer words'}}
function fxVerPick(){const it=IMP.items,i=Math.min(IMP.pi||0,it.length-1),x=it[i],n=it.length,e=findCard(x.name);
  const head=`<div class="row" style="align-items:center;margin:0 0 6px"><b style="flex:1">Verify artwork · ${i+1} of ${n}${IMP.vsrc!=null?`<br><span class="mut" style="font-weight:400;font-size:13px">${String(IMP.vsrc).startsWith(FXDECKPFX)?'🃏 '+esc(IMP.vsrc)+' — check the copies in this deck':'Pulled from: '+esc(IMP.vsrc)}</span>`:''}</b><button style="padding:6px 10px" onclick="fxVerStop()">Finish later</button></div><div class="pbar"><i style="width:${Math.round((i+1)/n*100)}%"></i></div>`;
  const ready=!x.stub&&!x.err&&x.prints;
  const nav=`<div style="height:84px"></div><div class="qanav"><button onclick="fxQAPrev()">‹ ${i?'Previous':'Back'}</button><button onclick="fxQASkip()">Skip for now</button><button class="pri" onclick="fxQANext()" ${ready?'':'disabled'}>${i+1<n?'✓ Save &amp; next ›':'✓ Save &amp; finish'}</button></div>`;
  if(!x.prints&&!x.loading&&!x.err)fxQALoad(i);
  if(!ready)return head+`<h3 style="margin:8px 0 2px">${esc(x.name)}</h3>`+(x.err?`<div class="warn">Couldn’t load the printings — check your internet connection. <button style="padding:3px 9px" onclick="IMP.items[${IMP.pi}].err=false;render()">Try again</button></div>`:'<p class="mut">Loading all printings…</p>')+nav;
  const c=x.card,sm=p=>p.image_uris?.small||p.card_faces?.[0]?.image_uris?.small||'';
  return head+`<h3 style="margin:8px 0 2px">${esc(x.name)}</h3><p class="mut" style="margin:0 0 8px">You own ${e?e.qty:x.qty}${x.done?' · <span style="color:var(--gold)">✓ saved</span>':''}. Tap the set name under an artwork to choose it, or tap the picture to see it full screen.</p>
  <div class="qabar"><b class="qanm">${esc(x.name)}</b>${(x.vmax=x.vmax||fxUnverifiedCopies(e)||1,x.vy=Math.max(1,Math.min(x.cap!=null?x.cap:x.vmax,x.vmax)))>1?`<label style="margin:0">Copies with this artwork</label><span style="display:inline-flex;align-items:center;gap:6px"><input type="number" min="1" max="${x.vy}" value="${Math.min(x.vq||x.vy,x.vy)}" style="width:62px" onchange="IMP.items[${i}].vq=Math.min(${x.vy},Math.max(1,parseInt(this.value)||1));this.value=IMP.items[${i}].vq"><b>of ${x.vy}</b>${IMP.vsrc!=null?'<span class="mut" style="font-size:12px">in this group</span>':''}</span>`:''}${(()=>{const fins=(c.finishes||['nonfoil']).map(f=>finMap[f]||f);if(!fins.includes(x.fin)){const fm=e?finMapOf(e):{};x.fin=fins.find(f=>(fm[f]||0)>0&&f!=='Normal')||fins.find(f=>(fm[f]||0)>0)||fins[0]}return fins.length>1?`<span class="chips" style="margin:0">${fins.map(f=>`<button class="${x.fin===f?'on':''}" onclick="IMP.items[${i}].fin='${f}';render()">${f==='Normal'?f:'✦ '+f}</button>`).join('')}</span>`:`<span class="mut" style="font-size:13px">${esc(fins[0])}</span>`})()}<span class="mut" style="font-size:13px">${esc(c.set_name||'')} · ${esc(String(c.set||'').toUpperCase())} #${esc(c.collector_number||'')}</span></div>
  ${fxPQBox(i,x)}<div class="grid">${x.prints.map((p,k)=>`<div class="tile" data-pk="${k}" style="${p.id===c.id?'outline:3px solid var(--gold);border-radius:12px;':''}${fxPQ(p,x.pq)?'':'display:none'}"><div class="art" onclick="fxQAView(${i},${k})"><img loading="lazy" src="${esc(sm(p))}" alt="">${p.id===c.id?'<span class="badge">✓</span>':''}</div><div class="nm setcap" onclick="fxQAPrint(${i},${k})" style="cursor:pointer"><b>${esc(p.set_name)}</b><span>${esc(String(p.set||'').toUpperCase())} #${esc(p.collector_number)}${p.released_at?' · '+esc(p.released_at.slice(0,4)):''}</span>${fxFinLabel(p)}</div></div>`).join('')}</div>`+nav}
async function fxVerNext(saveIt){const x=IMP.items[IMP.pi];
  if(saveIt){if(x.stub||x.err||!x.prints)return;const e=findCard(x.name),n=Math.min(x.vq||x.vy||x.vmax||1,fxUnverifiedCopies(e)||1);
    const fin=x.fin||'Normal';
    if(!(await ask(`Save ${x.card.set_name} #${x.card.collector_number}${fin!=='Normal'?' ('+fin+')':''} as the verified artwork for ${n>1?n+' copies of ':''}${x.name}?`)))return;
    if(e){const fm=finMapOf(e),have=fm[fin]||0;if(have<n){let need=n-have;const sup=(x.card.finishes||['nonfoil']).map(f=>finMap[f]||f);const order=Object.keys(fm).filter(k=>k!==fin).sort((a,b)=>(sup.includes(a)?1:0)-(sup.includes(b)?1:0)||(a==='Normal'?-1:1));
      for(const k of order){if(!need)break;const t=Math.min(need,fm[k]||0);fm[k]-=t;need-=t}fm[fin]=(fm[fin]||0)+(n-have-need);const old=e.finish;e.finish=finStr(fm);if(old!==e.finish)logEdit(e.name,'Finish',old||'Normal',e.finish+' (artwork check)')}}
    if(e&&e.qty>1){logEdit(e.name,'Printing',`${fxUnverifiedCopies(e)} copies not verified`,`${x.card.set_name} #${x.card.collector_number} ✓ ×${n} (import history)`);if(fxSetCopies(e,x.card,n)){saveArt();save();if(!x.done)IMP.vdone++;x.done=true}}
    else if(fxVerifyPrint(x.name,x.card,'import history')){if(!x.done)IMP.vdone++;x.done=true}
    /* bring the card back for its other copies — but when verifying one “Pulled from” group, only for copies that came from THAT group */
    if(IMP.vsrc!=null){e.vplace=e.vplace||{};e.vplace[IMP.vsrc]=(e.vplace[IMP.vsrc]||0)+Math.min(x.vq||x.vy||x.vmax||1,n)}/* remember which place's copies were checked, so that place doesn't list them again */
    const n0=Math.min(x.vq||x.vy||x.vmax||1,n),srcLeft=x.cap!=null?x.cap-n0:Infinity,left=Math.min(fxUnverifiedCopies(findCard(x.name)),srcLeft);
    if(left>0&&!(IMP.items[IMP.pi+1]&&IMP.items[IMP.pi+1].restOf===x))IMP.items.splice(IMP.pi+1,0,Object.assign({},x,{restOf:x,done:false,vq:0,vmax:left,cap:x.cap!=null?left:undefined}))}
  if(IMP.pi+1<IMP.items.length){IMP.pi++;render();scrollTo(0,0)}else fxVerStop()}
function fxVerStop(){const n=IMP.vdone||0,src=IMP.vsrc;
  if(src!=null){const l=(fxMissArt()[src]||[]).length;IMP.stage='idle';IMP.items=null;IMP.kind='';IMP.vsrc=null;go('more');V.sub='check';V.maOpen=true;render();scrollTo(0,0);
    return toast(n?`Artwork verified for ${fxPl(n,'card')}${l?` — ${l} left in “${src}” for later`:` — “${src}” is done`}`:l?`${l} left in “${src}” — they wait in Data check`:'Done')}
  const h=(D.imports||[]).find(x=>x.id===IMP.vid),l=fxHistLeft(h).length;IMP.stage='idle';IMP.items=null;IMP.kind='';render();scrollTo(0,0);
  toast(n?`Artwork verified for ${fxPl(n,'card')}${l?` — ${l} left for later`:''}`:l?`${l} left to verify — they wait in Import history`:'Done')}
/* ---------- Data check → Resolve missing artwork: every card with an unverified copy, grouped by pull source, one source at a time ---------- */
/* Where the unverified copies physically are: each deck is its own place (“In deck: …”) for the copies it holds; the remaining copies are listed under their “Pulled from”.
   Returns { place: [{c, n}] } with n = copies of that card in that place (capped by how many copies are still unverified). */
const FXDECKPFX='In deck: ';
/* group name for a “Pulled from”: the numbers don't matter — every pack/box of a WotC set goes under the set's name (all Lorwyn Eclipsed packs → “Lorwyn Eclipsed”), other sources lose their number (“Bulk Box 1”, “Bulk Box 2” → “Bulk Box”) */
function fxMissKey(s){const st=fxStoreLabel(s);if(st&&st!==FX_OTHER)return st;if(/^\s*bulk\s*box\b/i.test(s))return String(s).trim();return String(s).replace(/\s+\d+(\s*\(.*\))?$/,'').trim()||s}
function fxMissArt(){const G={},raw={},add=(k,c,n)=>{if(n<=0)return;const L=raw[k]=raw[k]||[],x=L.find(y=>y.c===c);if(x)x.n+=n;else L.push({c,n})};
  D.cards.forEach(c=>{if(!isReal(c)||c.custom||fxBasic(c))return;const u=fxUnverifiedCopies(c);if(!u)return;const k=norm(c.name);let inDecks=0;const used={};
    D.decks.forEach(d=>{const q=Math.max(0,sum(d.cards.filter(e=>norm(e.name)===k),e=>e.qty)-(d.miss?fxMissQ(d,c.name):0));if(!q)return;const n=Math.min(q,c.qty-inDecks);if(n<=0)return;inDecks+=n;add(FXDECKPFX+d.name,c,n);const a=d.srcs&&d.srcs[k];if(a)for(const s in a)used[s]=(used[s]||0)+a[s]});
    const free=c.qty-inDecks;if(free<=0)return;const own=fxSrcOwned(c),ss=Object.keys(own).filter(s=>!isCustomSrc(s));let left=free;
    if(!ss.length){add('No “Pulled from”',c,free);return}
    ss.forEach(s=>{const n=Math.max(0,Math.min(left,own[s]-(used[s]||0)));if(n>0){add(fxMissKey(s),c,n);left-=n}});
    if(left>0)add(fxMissKey(ss[0]),c,left)});
  /* copies already checked from a group aren't listed there again; never more than the card's unverified copies */
  for(const k in raw)raw[k].forEach(({c,n})=>{n=Math.min(Math.max(0,n-((c.vplace&&c.vplace[k])||0)),fxUnverifiedCopies(c));if(n>0)(G[k]=G[k]||[]).push({c,n})});
  return G}
function fxMissArtView(){const G=fxMissArt(),isD=k=>k.startsWith(FXDECKPFX),ks=Object.keys(G).sort((a,b)=>(isD(b)-isD(a))||G[b].length-G[a].length||a.localeCompare(b)),cards=new Set(Object.values(G).flat().map(x=>x.c)),copies=sum([...cards],c=>fxUnverifiedCopies(c));
  return `<div class="sec"><h4>Resolve missing artwork</h4>${cards.size?`<p class="mut" style="margin:4px 0">${fxPl(cards.size,'card')} (${copies} ${copies===1?'copy':'copies'}) still need their artwork verified. They’re listed by where they are now: cards in a deck are listed under that deck (🃏), the rest by where they were pulled from — so you can work through one deck, box or pack at a time. Your progress is saved card by card — tap <b>Finish later</b> any time.</p>
  <button class="pri" onclick="V.maOpen=!V.maOpen;render()">🎨 ${V.maOpen?'Hide the list':'Resolve missing artwork'}</button>
  ${V.maOpen?ks.map(s=>`<div class="sec" style="margin:8px 0${isD(s)?';border-left:3px solid var(--gold)':''}"><div class="row" style="align-items:center"><span style="flex:1"><b>${isD(s)?'🃏 ':''}${esc(s)}</b> <span class="mut">· ${fxPl(G[s].length,'card')}</span></span><button class="pri" style="flex:0 0 auto" onclick="fxMissArtGo(${esc(JSON.stringify(s))})">Start</button></div>
    <details><summary class="mut" style="font-size:13px">${isD(s)?'Cards in this deck':'Cards pulled from here'}</summary><div style="font-size:13px;margin-top:4px">${G[s].map(({c,n})=>{const o=ks.filter(x=>x!==s&&G[x].some(y=>y.c===c));return `${cl(c.name)} <span class="mut">· ${n} ${n===1?'copy':'copies'} to check here (${fxUnverifiedCopies(c)} of ${c.qty} not verified)${o.length?' · also in '+esc(o.join(', ')):''}</span>`}).join('<br>')}</div></details></div>`).join(''):''}`
  :'<p class="mut" style="margin:4px 0">✓ Every card’s artwork is verified (basic lands and custom cards don’t need it).</p>'}</div>`}
function fxMissArtGo(s){const L=(fxMissArt()[s]||[]);if(!L.length)return toast('Nothing left to verify there');
  Object.assign(IMP,{stage:'pick',kind:'verify',vid:null,vsrc:s,qa:false,pi:0,vdone:0,items:L.map(({c,n})=>{const u=fxUnverifiedCopies(c);return {name:c.name,qty:c.qty,sid:c.scryId||'',stub:true,vmax:u,vq:n<u?n:0,cap:Math.min(n,u),src:s,card:{name:c.name,id:c.scryId||'',finishes:['nonfoil'],prints_search_uri:fxPrintsUrl(c.name)}}})});
  go('more');V.sub='import';render();scrollTo(0,0)}

/* ---------- Existing cards: verify the artwork from a “pulled from” source that names a real set ---------- */
let SV={running:false,msg:'',ok:[],unsure:[]};
const SV_SKIP=/^(singles?\s+orders?|trade|gift|none|bulk import|deck import:.*)$/i;
/* WotC sets from Scryfall /sets — cached 7 days on this device (mtg_sets_v1; not collection data, never in backups) */
let FXSETS=null;const FXSET_NO=['token','memorabilia','promo','alchemy','minigame','treasure_chest','vanguard'];
const snorm=x=>(' '+String(x||'').toLowerCase().replace(/[’'`]/g,'').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim()+' ').replace(/^ the /,' ');
function fxSetIdx(s){const al=new Map(),add=(k,x)=>{k=snorm(k);if(k.trim().length<4)return;if(!al.has(k))al.set(k,[]);if(!al.get(k).includes(x))al.get(k).push(x)};
  s.forEach(x=>{add(x.n,x);const m=x.n.match(/^(.+?):\s*(.+)$/),cmd=/\sCommander$/.test(x.n);if(m){add(m[1]+(cmd?' Commander':''),x);if(cmd)add(m[2],x)}});return {s,al}}
async function fxSets(){if(FXSETS)return FXSETS;try{const c=JSON.parse(localStorage.getItem('mtg_sets_v1')||'null');if(c&&Date.now()-c.t<7*864e5&&c.s&&c.s.length)return FXSETS=fxSetIdx(c.s)}catch(e){}
  const r=await scry('/sets');if(!r||!r.data)return null;const s=r.data.filter(x=>!x.digital&&!FXSET_NO.includes(x.set_type)&&x.name&&x.name.length>=4).map(x=>({c:x.code,n:x.name,t:x.set_type,p:x.parent_set_code||''}));
  try{localStorage.setItem('mtg_sets_v1',JSON.stringify({t:Date.now(),s}))}catch(e){}return FXSETS=fxSetIdx(s)}
const fxIsCmdSrc=s=>/commander|precon|\bdeck\b/i.test(s)&&!/booster|bundle|prerelease/i.test(s);
/* the set named in a “Pulled from” text: longest set name (or short form like “Duskmourn Commander”) found as whole words; a commander-deck source moves to that set’s Commander set */
function fxSetIn(src,S){const t=snorm(src);let best=null,bl=0;for(const [k,L] of S.al){if(k.length<=bl||!t.includes(k))continue;const ex=L.filter(x=>snorm(x.n)===k),one=ex.length===1?ex[0]:L.length===1?L[0]:null;if(one){best=one;bl=k.length}}
  if(best&&best.t!=='commander'&&fxIsCmdSrc(src)){const cs=S.s.filter(x=>x.t==='commander'&&x.p===best.c);if(cs.length===1)best=cs[0]}return best}
/* every printing of a card (cached) — [] when Scryfall doesn't know it, null when Scryfall couldn't be reached */
async function fxPrintsAll(n){const r=await scry(fxPrintsUrl(n));if(!r)return scry.st===404?[]:null;let pr=r.data||[],nx=r.has_more&&r.next_page;while(nx){const r2=await scry(nx);if(!r2||!r2.data)break;pr=pr.concat(r2.data);nx=r2.has_more&&r2.next_page}return pr}
/* a source with no set in its name (e.g. a precon called just “Blight Curse Commander Deck 1”): the one set that contains ALL its cards */
async function fxSrcInfer(src,S){if(!fxIsCmdSrc(src))return null;const cards=D.cards.filter(c=>isReal(c)&&!c.custom&&!fxBasic(c)&&cardSources(c).includes(src)).slice(0,12);if(cards.length<3)return null;
  let inter=null;for(const c of cards){const pr=await fxPrintsAll(c.name);if(pr===null)return undefined;if(!pr.length)continue;const cs=new Set(pr.map(p=>p.set));inter=inter?new Set([...inter].filter(x=>cs.has(x))):cs;if(!inter.size)return null}
  if(!inter)return null;const L=S.s.filter(x=>inter.has(x.c)&&x.t==='commander');return L.length===1?L[0]:null}
async function fxSetFor(src,S,memo){if(memo.has(src))return memo.get(src);let x=fxSetIn(src,S);if(!x){x=await fxSrcInfer(src,S);if(x===undefined)return undefined}memo.set(src,x||null);return x||null}
/* Only one paper printing exists → there is only one possible artwork, so every copy is verified without asking (owner's choice). Digital-only (Arena/MTGO) printings don't count. */
const fxPaper=pr=>(pr||[]).filter(p=>!p.digital&&(!p.games||p.games.includes('paper')));
function fxOneApply(e,p){if(!e||!p||RO||e.custom||fxBasic(e))return 0;const n=fxUnverifiedCopies(e);if(!n)return 0;
  if(!e.verified)fxVerifyPrint(e.name,p,'only one printing exists',true);const k=fxSetCopies(e,p,fxUnverifiedCopies(e));
  if(k)logEdit(e.name,'Printing (copies)',`${k} ${k===1?'copy':'copies'} not verified`,`${p.set_name} #${p.collector_number} ✓ ×${k} (only one printing exists)`);return n}
/* after adding cards: verify those that have only one printing (quietly, in the background) */
async function fxOneCheck(names){if(RO||!navigator.onLine)return;let n=0;for(const nm of [...new Set(names)]){const e=findCard(nm);if(!e||e.custom||fxBasic(e)||!fxUnverifiedCopies(e))continue;const pr=await fxPrintsAll(e.name);const pp=fxPaper(pr);if(pp&&pp.length===1&&fxOneApply(e,pp[0]))n++}
  if(n){saveArt();save();render();toast(`✓ ${fxPl(n,'card')} verified automatically — only one printing exists`)}}
/* what comes in a sealed precon: the regular card, not the display/thick commander or collector-booster variants */
const fxPreconPrint=p=>!p.promo&&!(p.promo_types||[]).some(t=>/thick|serialized|surgefoil|galaxyfoil|textured|halofoil|confettifoil|raisedfoil/.test(t))&&!(p.frame_effects||[]).some(f=>/extendedart|showcase|inverted|etched/.test(f))&&p.border_color!=='borderless'&&!p.full_art;
function fxSrcPrint(prints,src,set){if(!set)return {why:'no WotC set found for “'+src+'”'};let c=prints.filter(p=>p.set===set.c);if(!c.length)return {why:`no printing in ${set.n} (“${src}”)`};
  if(c.length>1&&/booster|bundle|prerelease|pack/i.test(src)){const b=c.filter(p=>p.booster);if(b.length)c=b}
  if(c.length>1&&(set.t==='commander'||fxIsCmdSrc(src))){const b=c.filter(fxPreconPrint);if(b.length)c=b}
  return c.length===1?{p:c[0]}:{why:`${c.length} printings in ${set.n}`}}
const svMsg=t=>{SV.msg=t;const e=document.getElementById('svmsg');if(e)e.textContent=t};
async function fxSrcVerify(auto){if(SV.running||RO)return;if(!navigator.onLine){if(!auto)toast('You’re offline — try again when connected');return}
  const todo=D.cards.filter(c=>isReal(c)&&!c.custom&&!fxBasic(c)&&!c.noAuto&&fxUnverifiedCopies(c)>0);let one=0;
  SV={running:true,msg:'',ok:[],unsure:[],cand:[]};if(!auto)render();let stopped=false;svMsg('Loading the list of WotC sets…');
  const S=await fxSets();if(!S){SV.running=false;SV.msg='Couldn’t load the list of sets from Scryfall — it tries again next time.';render();return}
  const memo=new Map();
  for(let i=0;i<todo.length;i++){if(RO){stopped=true;break}while(fxBusy())await new Promise(z=>setTimeout(z,700));const c=todo[i];svMsg(`Checking ${i+1} of ${todo.length}…`);
    if(c.noAuto||!fxUnverifiedCopies(c))continue;const srcs=cardSources(c).filter(s=>!isCustomSrc(s));
    const pr=await fxPrintsAll(c.name);if(pr===null){stopped=true;break}if(!pr.length){SV.unsure.push([c.name,'not found on Scryfall']);continue}
    {const pp=fxPaper(pr);if(pp.length===1){if(fxOneApply(c,pp[0])){one++;SV.ok.push(c.name)}continue}}
    /* the “Pulled from” rule only ever touches cards with NO verified copy */
    if(fxCopyList(c).some(Boolean)||!srcs.some(s=>!SV_SKIP.test(s)))continue;
    const res=[];for(const s of srcs){if(SV_SKIP.test(s)){res.push({why:'also from “'+s+'”'});continue}const set=await fxSetFor(s,S,memo);if(set===undefined){stopped=true;break}res.push(fxSrcPrint(pr,s,set))}if(stopped)break;
    const bad=res.find(x=>!x.p),ids=new Set(res.filter(x=>x.p).map(x=>x.p.id));
    if(bad||ids.size!==1){SV.unsure.push([c.name,bad?bad.why:'its “Pulled from” entries point to different printings']);continue}
    SV.cand.push({name:c.name,p:res[0].p,src:srcs.join(', ')})}
  SV.running=false;const C=SV.cand;if(one){saveArt();save()}
  SV.msg=stopped?`Paused — Scryfall stopped answering (or you went offline). Tap the button to carry on; cards already checked are remembered for 24 hours.`:`Checked: ${fxPl(C.length,'card')} can be verified from their “Pulled from”, ${SV.unsure.length} left for you to check.`;render();
  if(!C.length){if(!stopped){D.srcv4=today();save()}if(!auto||one)toast(stopped?'Verification paused — Scryfall stopped answering':one?`✓ Artwork verified for ${fxPl(one,'card')} with only one printing`:'No cards could be verified from their “Pulled from”');return}
  /* owner's choice: a card whose pull sources all point to exactly ONE printing is verified automatically (every copy); anything uncertain stays for the user */
  C.forEach(x=>{const e=findCard(x.name);if(!e||e.noAuto||fxCopyList(e).some(Boolean))return;/* never touches a card with ANY verified copy */
    if(!fxVerifyPrint(x.name,x.p,'from “Pulled from”',true))return;if(e.qty>1){const n=fxSetCopies(e,x.p,e.qty-1);if(n)logEdit(e.name,`Printing (copies 2–${e.qty})`,'(not verified)',`${x.p.set_name} #${x.p.collector_number} ✓ ×${n} (from “Pulled from”)`)}SV.ok.push(x.name)});SV.cand=[];if(!stopped)D.srcv4=today();saveArt();save();
  SV.msg=`${stopped?'Paused':'Done'}: ${fxPl(SV.ok.length,'card')} verified from their “Pulled from”, ${SV.unsure.length} left for you to check.${stopped?' Tap the button to check the rest.':''}`;render();
  toast(`✓ Artwork verified for ${fxPl(SV.ok.length,'card')} from their “Pulled from” — details in More → Data check`)}
const fxBusy=()=>IMP.stage==='work'||(IMP.items||[]).some(x=>x&&x.loading)||A.step==='reading'||!!(A.prints===null&&A.step==='verify');
function fxSrcAuto(){setTimeout(()=>{try{fxImgKeepSoon()}catch(e){}},3000);try{const c=JSON.parse(localStorage.getItem('mtg_sets_v1')||'null');if(c&&c.s&&!FXSETS)FXSETS=fxSetIdx(c.s)}catch(e){}if(navigator.onLine&&!FXSETS)fxSets().catch(()=>{});setTimeout(()=>{if(!D.srcv4&&!RO&&D.cards.length&&navigator.onLine)fxSrcVerify(true)},5000)}
/* Card pictures saved by the service worker (300 MB limit) — ask it for the size / to clear */
function fxSwMsg(type,x){return new Promise(ok=>{const c=navigator.serviceWorker&&navigator.serviceWorker.controller;if(!c)return ok(null);const ch=new MessageChannel();ch.port1.onmessage=e=>ok(e.data);setTimeout(()=>ok(null),4000);c.postMessage(Object.assign({type},x||{}),[ch.port2])})}
/* tell the service worker which pictures belong to VERIFIED artwork of cards in the collection — those are kept outside the 300 MB limit */
function fxKeepUrls(){const S=new Set(),add=u=>{if(u&&/cards\.scryfall\.io/.test(u)){S.add(u);S.add(u.replace('/normal/','/large/'));S.add(u.replace('/large/','/normal/'))}};
  D.cards.forEach(c=>{if(c.custom)return;if(c.verified){add(c.art||ART[c.name]);add(c.art2||ART2[c.name])}(c.cps||[]).slice(0,Math.max(0,c.qty-1)).forEach(x=>{if(x){add(x.art);add(x.art2)}})});return [...S]}
let IKT=null,IKLAST='';function fxImgKeepSoon(){if(RO)return;clearTimeout(IKT);IKT=setTimeout(()=>{const L=fxKeepUrls(),h=L.length+':'+L.slice(0,50).join('|').length+':'+L.join('').length;if(h===IKLAST)return;const c=navigator.serviceWorker&&navigator.serviceWorker.controller;if(!c)return;IKLAST=h;c.postMessage({type:'imgkeep',urls:L})},1500)}
function fxImgCacheView(){setTimeout(async()=>{const e=$('#imsz'),k=$('#imkp');if(!e)return;fxImgKeepSoon();const r=await fxSwMsg('imgstat');if(!r){e.textContent='not available in this version of the app';if(k)k.textContent='—';return}e.textContent=fxMB(r.other||r.size||0);if(k)k.textContent=fxMB(r.kept||0)},0);
  return `<div class="sec"><h4>Card pictures saved on this device</h4><p class="mut" style="margin:4px 0">Pictures of your cards’ <b>verified</b> artwork are always kept, so your collection loads instantly and shows without internet — they don’t count toward the limit. Every other picture (lookups, artwork choices, cards not verified yet) can use up to 300 MB; the ones you haven’t looked at for longest are removed first. Never part of your backups.</p>
  <div class="kv"><span>Your collection (verified artwork)</span><b id="imkp">…</b></div><div class="kv"><span>Other pictures</span><b><span id="imsz">…</span> of 300 MB</b></div><div class="row"><button onclick="fxImgCacheClear()">Clear other pictures</button></div></div>`}
async function fxImgCacheClear(){if(!(await ask('Clear the other saved card pictures on this device?\n\nPictures of your verified artwork stay. Your collection isn’t touched — other pictures download again when you look at them.\n\nOK = Clear\nCancel = Keep them')))return;const r=await fxSwMsg('imgclear');render();toast(r&&r.ok?'Saved pictures cleared':'Couldn’t clear them here')}
/* ---------- Offline card database (optional, off by default): Scryfall's “Oracle cards” bulk file (one entry per card), slimmed down into IndexedDB “mtg_cardsdb”. Used only when Scryfall can't be reached, for name lookups and name suggestions — never for printings, so it can't make a card look like it has only one printing. Turning it off deletes it. Never in backups. ---------- */
const CDB_KEY='mtg_cardsdb_v1';let CDB_RUN=null;
const fxCdbMeta=()=>{try{return JSON.parse(localStorage.getItem(CDB_KEY)||'null')}catch(e){return null}};
const fxCdbSetMeta=m=>{try{m?localStorage.setItem(CDB_KEY,JSON.stringify(m)):localStorage.removeItem(CDB_KEY)}catch(e){}};
let cdbP=null;const fxCdbOpen=()=>cdbP||(cdbP=new Promise(ok=>{try{const r=indexedDB.open('mtg_cardsdb',2);r.onupgradeneeded=()=>{const db=r.result,s=db.objectStoreNames.contains('c')?r.transaction.objectStore('c'):db.createObjectStore('c',{keyPath:'k'});if(!s.indexNames.contains('fk'))s.createIndex('fk','fk')};r.onsuccess=()=>ok(r.result);r.onerror=()=>ok(null)}catch(e){ok(null)}}));
const cdbKey=n=>String(n||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[’']/g,"'").trim();
function fxCdbSlim(c){const f=(c.card_faces||[])[0]||{},img=c.image_uris||f.image_uris||{};
  return {k:cdbKey(c.name),fk:cdbKey(c.name.split(' // ')[0]),object:'card',_offline:true,id:c.id,oracle_id:c.oracle_id,name:c.name,mana_cost:c.mana_cost,cmc:c.cmc,type_line:c.type_line,oracle_text:c.oracle_text,power:c.power,toughness:c.toughness,colors:c.colors??f.colors,color_identity:c.color_identity,keywords:c.keywords,legalities:c.legalities,set:c.set,set_name:c.set_name,collector_number:c.collector_number,rarity:c.rarity,finishes:c.finishes,prices:c.prices,released_at:c.released_at,prints_search_uri:c.prints_search_uri,image_uris:img.small?{small:img.small,normal:img.normal}:undefined,card_faces:c.card_faces?c.card_faces.map(x=>({name:x.name,mana_cost:x.mana_cost,type_line:x.type_line,oracle_text:x.oracle_text,power:x.power,toughness:x.toughness,image_uris:x.image_uris?{small:x.image_uris.small,normal:x.image_uris.normal}:undefined})):undefined}}
/* Wi-Fi or not: Android app asks the phone (@capacitor/network); browsers only say it where they support navigator.connection.type (Android Chrome) — iPhone/desktop browsers can't tell */
async function fxConnType(){try{const N=isNative()&&window.Capacitor.Plugins.Network;if(N){const s=await N.getStatus();if(s&&s.connectionType)return s.connectionType}}catch(e){}const c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;return c&&c.type?c.type:'unknown'}
async function fxCdbWifiOk(){const t=await fxConnType();if(t==='wifi'||t==='ethernet')return true;
  const what=t==='cellular'?'You’re on mobile data, not Wi-Fi.':'The app can’t tell whether you’re on Wi-Fi.';
  if(!(await ask(`${what}\n\nThe card database is a large download (about 150 MB). Download it anyway?\n\nOK = Download anyway\nCancel = Wait for Wi-Fi`)))return false;
  return await ask(`Are you sure?\n\nThis can use about 150 MB of mobile data.\n\nOK = Yes, download now\nCancel = Wait for Wi-Fi`)}
async function fxCdbToggle(on){if(RO)return;
  if(on){if(!navigator.onLine)return toast('You’re offline — connect to the internet first');if(!(await fxCdbWifiOk()))return render();fxCdbSetMeta({on:true});return fxCdbDownload()}
  if(!(await ask('Turn off the offline card database?\n\nThe downloaded file is deleted from this device. Your collection isn’t touched.\n\nOK = Turn off and delete\nCancel = Keep it')))return render();
  if(CDB_RUN)CDB_RUN.stop=true;const db=await fxCdbOpen();try{db&&db.close()}catch(e){}cdbP=null;await new Promise(ok=>{const r=indexedDB.deleteDatabase('mtg_cardsdb');r.onsuccess=r.onerror=r.onblocked=()=>ok()});fxCdbSetMeta(null);render();toast('Offline card database deleted')}
async function fxCdbUpdate(){if(!navigator.onLine)return toast('You’re offline');if(!(await fxCdbWifiOk()))return;fxCdbDownload()}
async function fxCdbDownload(){if(CDB_RUN)return;const run=CDB_RUN={stop:false,done:0,total:0,bytes:0,size:0};const say=t=>{run.msg=t;const e=$('#cdbmsg');if(e)e.textContent=t};render();
  try{say('Finding the latest card list…');const bd=await scryFetch('/bulk-data');if(!bd)throw new Error('Scryfall didn’t answer');let list=null,raw='';try{raw=await bd.text();list=JSON.parse(raw)}catch(e){}
    const items=Array.isArray(list)?list:(list&&(list.data||list.items))||[];let meta=items.find(x=>x&&/oracle/i.test((x.type||'')+' '+(x.name||'')));
    if(meta&&!meta.download_uri&&meta.uri){const one=await scryFetch(meta.uri);if(one&&one.ok){try{meta=await one.json()}catch(e){}}}
    /* if Scryfall doesn't give a direct file link, ask the API for the file itself (?format=file redirects to it) */
    const anyLink=o=>{let u='';JSON.stringify(o||{},(k,v)=>{if(!u&&typeof v==='string'&&/^https:\/\/data\.scryfall\.io\/.+\.json/.test(v))u=v;return v});return u};
    const dl=meta&&(meta.download_uri||meta.download_url||anyLink(meta)||((meta.uri||(meta.id?'https://api.scryfall.com/bulk-data/'+meta.id:(meta.type?'https://api.scryfall.com/bulk-data/'+meta.type:'')))?(meta.uri||'https://api.scryfall.com/bulk-data/'+(meta.id||meta.type))+'?format=file':''));
    if(!dl)throw new Error(`card list link not found (Scryfall ${bd.status}; ${items.length?'files: '+items.map(x=>x&&(x.type||x.name)).join(', '):'reply: '+raw.slice(0,80).replace(/\s+/g,' ')})`);run.size=meta.size||0;
    const r=await fetch(dl);if(!r.ok||!r.body)throw new Error('download failed ('+r.status+')');
    const db=await fxCdbOpen();if(!db)throw new Error('this device can’t store it');await new Promise(ok=>{const tx=db.transaction('c','readwrite');tx.objectStore('c').clear();tx.oncomplete=tx.onerror=()=>ok()});
    /* Scryfall now serves the file gzip-compressed (.json.gz, application/gzip) without asking the browser to unpack it — unpack it here when it starts with the gzip signature */
    let rd=r.body.getReader();const first=await rd.read();const b0=first.value||new Uint8Array(0);
    {const rest=rd,src=new ReadableStream({start(c){if(b0.length)c.enqueue(b0);if(first.done)c.close()},async pull(c){const x=await rest.read();if(x.done)c.close();else c.enqueue(x.value)}});
     if(b0[0]===0x1f&&b0[1]===0x8b){if(typeof DecompressionStream!=='function')throw new Error('this browser can’t unpack the compressed card list — try the Android app or another browser');rd=src.pipeThrough(new DecompressionStream('gzip')).getReader();run.size=0}else rd=src.getReader()}
    const dec=new TextDecoder();let head='',top='';let buf='',depth=0,inStr=false,esc=false,start=-1,batch=[];
    const flush=async()=>{if(!batch.length)return;const b=batch;batch=[];await new Promise(ok=>{const tx=db.transaction('c','readwrite'),s=tx.objectStore('c');b.forEach(x=>s.put(x));tx.oncomplete=tx.onerror=()=>ok()})};
    for(;;){if(run.stop)throw new Error('stopped');const {done,value}=await rd.read();if(done)break;run.bytes+=value.length;const txt=dec.decode(value,{stream:true});if(head.length<200)head+=txt.slice(0,200-head.length);buf+=txt;
      let cut=0;
      for(let p=run.scan||0;p<buf.length;p++){const ch=buf[p];if(inStr){if(esc)esc=false;else if(ch==='\\')esc=true;else if(ch==='"')inStr=false;continue}
        if(ch==='"'){inStr=true;continue}if(ch==='{'){if(depth===0&&!top){top='{'}if((depth===1&&top==='[')||(depth===0&&top==='{'))start=p;depth++}else if(ch==='}'){depth--;if(depth===(top==='{'?0:1)&&start>=0){try{const c=JSON.parse(buf.slice(start,p+1));if(c.object==='card'&&c.layout!=='art_series'&&c.layout!=='token'&&c.layout!=='double_faced_token'&&c.layout!=='emblem')batch.push(fxCdbSlim(c))}catch(e){}cut=p+1;start=-1;run.done++}}else if(ch==='['&&depth===0){if(!top)top='[';depth=1}}
      if(cut){buf=buf.slice(cut);run.scan=buf.length}else run.scan=buf.length;if(start>=0&&cut){start-=cut}
      if(batch.length>=400)await flush();say(`Downloading… ${fxMB(run.bytes)}${run.size?' of '+fxMB(run.size):''} · ${run.done} cards`)}
    await flush();
    if(run.done<1000){const db2=await fxCdbOpen();if(db2)await new Promise(ok=>{const tx=db2.transaction('c','readwrite');tx.objectStore('c').clear();tx.oncomplete=tx.onerror=()=>ok()});
      throw new Error(`that wasn’t the full card list — got ${run.done} entries, ${fxMB(run.bytes)} from ${String(r.url||dl).replace(/^https:\/\//,'').slice(0,70)} (${r.headers.get('content-type')||'?'}): “${head.replace(/\s+/g,' ').slice(0,110)}”`)}
    fxCdbSetMeta({on:true,at:today(),n:run.done,bytes:run.bytes});CDB_RUN=null;render();toast(`✓ Offline card database ready — ${run.done} cards`)}
  catch(e){CDB_RUN=null;const m=fxCdbMeta();if(m&&m.on)fxCdbSetMeta({on:true,err:String(e.message||e)});render();if(String(e.message)!=='stopped')toast('Couldn’t download the card database: '+String(e.message||e).slice(0,80))}}
function fxCdbView(){const m=fxCdbMeta()||{},on=!!m.on,run=CDB_RUN;
  return `<div class="sec"><h4>Offline card database</h4><p class="mut" style="margin:4px 0">Optional. Downloads Scryfall’s full card list (about 150 MB, once) so card names, details and name suggestions still work without internet. Off by default; turning it off deletes the download. Never part of your backups.</p>
  <label style="display:flex;gap:8px;align-items:center;font-weight:600"><input type="checkbox" ${on?'checked':''} ${run?'disabled':''} onchange="fxCdbToggle(this.checked)"> Keep an offline card database on this device</label>
  ${run?`<p id="cdbmsg" class="mut">${esc(run.msg||'Starting…')}</p>`:on?(m.at?`<div class="kv"><span>Downloaded</span><b>${esc(m.at)} · ${m.n} cards</b></div><div class="row"><button onclick="fxCdbUpdate()">Update now</button></div>`:`<p class="mut">${m.err?'Last download failed: '+esc(m.err)+'. ':''}Not downloaded yet.</p><div class="row"><button onclick="fxCdbUpdate()">Download now</button></div>`):''}</div>`}
/* local-first lookups (owner's rule: checks use the downloaded database before going online) */
async function fxCdbGet(name){const m=fxCdbMeta();if(!m||!m.at)return null;const db=await fxCdbOpen();if(!db)return null;const k=cdbKey(name);
  return new Promise(ok=>{try{const s=db.transaction('c').objectStore('c'),q=s.get(k);const fix=x=>{if(x&&x.card_faces&&x.card_faces.length>1&&x.oracle_text===x.card_faces[0].oracle_text){x={...x};delete x.oracle_text;delete x.mana_cost;delete x.power;delete x.toughness}return x};/* records saved by the first version copied face 1 onto the card — strip that so checks match Scryfall */
    q.onsuccess=()=>{if(q.result)return ok(fix(q.result));const q2=s.index('fk').get(k);q2.onsuccess=()=>ok(fix(q2.result||null));q2.onerror=()=>ok(null)};q.onerror=()=>ok(null)}catch(e){ok(null)}})}
/* /cards/collection: name-only identifiers are answered from the database; the rest (ids, set+number — e.g. price updates) still go to Scryfall */
async function fxCdbCollect(ids){const m=fxCdbMeta();if(!m||!m.at||!Array.isArray(ids))return null;const found=[],rest=[];
  for(const id of ids){const ks=Object.keys(id||{});if(ks.length===1&&ks[0]==='name'){const c=await fxCdbGet(id.name);if(c){found.push(c);continue}}rest.push(id)}
  return found.length?{found,rest}:null}
/* offline fallback used by scry() when Scryfall can't be reached and nothing is saved: exact/fuzzy name and name suggestions only */
async function fxCdbAnswer(u){const m=fxCdbMeta();if(!m||!m.at)return null;const db=await fxCdbOpen();if(!db)return null;const q=new URL(u),p=q.pathname,get=k=>new Promise(ok=>{const r=db.transaction('c').objectStore('c').get(k);r.onsuccess=()=>ok(r.result||null);r.onerror=()=>ok(null)});
  const range=(pre,n)=>new Promise(ok=>{const out=[];const r=db.transaction('c').objectStore('c').openCursor(IDBKeyRange.bound(pre,pre+'￿'));r.onsuccess=e=>{const c=e.target.result;if(!c||out.length>=n)return ok(out);out.push(c.value);c.continue()};r.onerror=()=>ok(out)});
  if(p==='/cards/named'){const n=cdbKey(q.searchParams.get('exact')||q.searchParams.get('fuzzy')||'');if(!n)return null;let c=await get(n);if(!c){const L=await range(n,1);c=L[0]&&(L[0].fk===n||q.searchParams.get('fuzzy'))?L[0]:null}return c}
  if(p==='/cards/autocomplete'){const n=cdbKey(q.searchParams.get('q')||'');if(n.length<2)return null;const L=await range(n,20);return {object:'catalog',data:L.map(x=>x.name)}}
  return null}
/* Data check: the on-device Scryfall cache (size, clear) */
function fxCacheView(){setTimeout(async()=>{const e=$('#scsz');if(e)e.textContent=fxMB(await scryCSize())},0);return `<div class="sec"><h4>Scryfall lookups saved on this device</h4><p class="mut" style="margin:4px 0">Card lookups are kept on this device for 7 days so the app doesn’t ask Scryfall for the same thing twice — faster, and they still work when Scryfall can’t be reached. Up to 200 MB; the oldest unused lookups are removed first. This is never part of your backups.</p><div class="kv"><span>Space used</span><b><span id="scsz">…</span> of 200 MB</b></div><div class="row"><button onclick="fxCacheClear()">Clear saved lookups</button></div></div>`}
const fxMB=n=>n<1048576?`${Math.max(0,Math.round(n/1024))} KB`:`${(n/1048576).toFixed(1)} MB`;
async function fxCacheClear(){if(!(await ask('Clear the saved Scryfall lookups on this device?\n\nYour collection isn’t touched — the app simply looks cards up again when it needs them.\n\nOK = Clear\nCancel = Keep them')))return;await scryCClear();render();toast('Saved lookups cleared')}
function fxSrcView(){return `<div class="sec"><h4>Verify artwork from “Pulled from”</h4><p class="mut" style="margin:4px 0">Cards with only one printing ever made get every copy verified (there’s only one possible artwork). For cards with <b>no</b> verified artwork yet whose “Pulled from” is a real set (e.g. “Lorwyn Eclipsed Play Booster 3” or a Commander deck), the app picks that set’s printing and marks the artwork verified ✓. It never changes a card that already has any verified copy. A Commander deck counts as its Commander set even when only the deck’s name was typed (the app finds the one Commander set that has all of its cards), and only the regular printing that comes in the box is used. If it isn’t sure (several possible printings, or a “Pulled from” that isn’t a set) the card is left unverified for you.${(D.srcv4||D.srcv3)?` Last run: <b>${esc(D.srcv4||D.srcv3)}</b>.`:''}</p>
  <div class="row"><button onclick="fxSrcVerify()" ${SV.running?'disabled':''}>${SV.running?'Checking…':'✓ Verify from “Pulled from”'}</button><button onclick="fxTidyScan()" ${TS.running||SV.running?'disabled':''}>${TS.running?'Checking…':'🏷 Tidy up “Pulled from” names'}</button></div><p id="svmsg" class="mut">${esc(TS.running||TS.msg&&!SV.running?TS.msg:SV.msg)}</p>
  ${SV.ok.length?`<details><summary>Verified (${SV.ok.length})</summary><div style="font-size:13px">${SV.ok.map(n=>cl(n)).join(', ')}</div></details>`:''}
  ${SV.unsure.length?`<details><summary>Left unverified (${SV.unsure.length}) — tap a card, then 🎨</summary><div style="font-size:13px">${SV.unsure.map(([n,w])=>`${cl(n)} <span class="mut">— ${esc(w)}</span>`).join('<br>')}</div></details>`:''}</div>`}

/* ---------- Tidy up “Pulled from” names to the official WotC set names, keeping each box/pack number ---------- */
let TS={running:false,msg:'',rows:null,S:null};
const FXPRODS=['play booster','draft booster','set booster','collector booster','jumpstart booster','booster box','booster pack','bundle box','gift bundle','bundle','prerelease kit','prerelease pack','prerelease','commander deck','precon','starter kit','starter deck','beginner box','scene box','challenger deck','planeswalker deck','theme deck','intro pack'];
const fxTitle=s=>s.replace(/\b[a-z]/g,m=>m.toUpperCase());
function fxTidyName(src,set,S){let rest=String(src).trim(),num='';const m=rest.match(/^(.*?)\s+(\d+)(\s*\(.*\))?$/);if(m){rest=m[1];num=' '+m[2]+(m[3]||'')}
  let prod='';for(const p of FXPRODS){const re=new RegExp('\\b'+p+'\\b','i');if(re.test(rest)){prod=p;rest=rest.replace(re,' ');break}}
  const W=new Set(['commander','deck','the','of','and']);(snorm(set.n)).trim().split(' ').forEach(w=>W.add(w));if(S)for(const [k,L] of S.al)if(L.includes(set))k.trim().split(' ').forEach(w=>W.add(w));
  const left=rest.split(/\s+/).filter(w=>{const n=snorm(w).trim();return n&&!W.has(n)}).join(' ').replace(/^[\s\-–—:,]+|[\s\-–—:,]+$/g,'');
  if(set.t==='commander'||prod==='commander deck'||prod==='precon'){const base=/\sCommander$/i.test(set.n)?set.n.replace(/\s+Commander$/i,'')+' Commander Deck':/^Commander\b/i.test(set.n)?set.n+' Deck':set.n+' Commander Deck';return base+(left?' – '+left:'')+num}
  return set.n+(prod?' '+fxTitle(prod):'')+(left?' '+left:'')+num}
async function fxTidyScan(){if(TS.running||SV.running||RO)return;if(!navigator.onLine)return toast('You’re offline — try again when connected');
  TS={running:true,msg:'Loading the list of WotC sets…',rows:null,S:null};render();const S=await fxSets();
  if(!S){TS={running:false,msg:'Couldn’t load the list of sets from Scryfall — try again later.',rows:null};render();return}
  const used=new Set(D.cards.flatMap(c=>cardSources(c))),srcs=allSources().filter(s=>!SV_SKIP.test(s)&&!isCustomSrc(s)&&(used.has(s)||D.acq.some(a=>canonSrc(a.source)===s))),memo=new Map(),rows=[],low=new Set(allSources().map(x=>x.toLowerCase()));
  for(let i=0;i<srcs.length;i++){const s=srcs[i];svMsg(`Checking “Pulled from” names: ${i+1} of ${srcs.length}…`);TS.msg=`Checking ${i+1} of ${srcs.length}…`;
    const set=await fxSetFor(s,S,memo);if(set===undefined){TS={running:false,msg:'Paused — Scryfall stopped answering (or you went offline). Try again in a minute.',rows:null};render();return}
    if(!set){rows.push({old:s,set:'',neu:'',on:false});continue}const neu=fxTidyName(s,set,S);if(neu===s)continue;
    const merge=neu.toLowerCase()!==s.toLowerCase()&&low.has(neu.toLowerCase());rows.push({old:s,set:set.n,neu,on:!merge,merge})}
  TS={running:false,msg:'',rows,S};render();fxTidyOpen()}
function fxTidyOpen(){const R=TS.rows||[],ch=R.filter(r=>r.set),no=R.filter(r=>!r.set);
  if(!R.length)return toast('✓ Every “Pulled from” name already uses the official set name');
  const row=(r)=>{const i=R.indexOf(r);return `<div class="sec" style="margin:6px 0;padding:8px 10px"><label style="display:flex;gap:8px;align-items:flex-start;font-weight:400"><input type="checkbox" ${r.on?'checked':''} onchange="TS.rows[${i}].on=this.checked" style="margin-top:3px"><span style="flex:1"><span class="mut" style="font-size:12px">Now:</span> ${esc(r.old)} <span class="mut" style="font-size:12px">· ${fxPl(sum(D.cards.filter(c=>cardSources(c).includes(r.old))),'card')}</span></span></label>
    <div class="f" style="margin:6px 0 0"><label style="font-size:12px">WotC set</label><input list="tsets" value="${esc(r.set)}" placeholder="Pick the set (optional)" onchange="fxTidySet(${i},this.value)"></div>
    <div class="f" style="margin:6px 0 0"><label style="font-size:12px">New name</label><textarea id="tsn${i}" rows="2" style="resize:none;width:100%;box-sizing:border-box" placeholder="—" oninput="TS.rows[${i}].neu=this.value.trim();TS.rows[${i}].on=!!this.value.trim();this.closest('.sec').querySelector('input[type=checkbox]').checked=TS.rows[${i}].on">${esc(r.neu)}</textarea></div>
    ${r.merge?`<p class="mut" style="font-size:12px;margin:4px 0 0">⚠ “${esc(r.neu)}” already exists — ticking this joins the two into one. Leave it unticked or change the name if they’re different boxes.</p>`:''}</div>`};
  openM(`<h3>🏷 Tidy up “Pulled from” names</h3><p class="mut">Suggested official WotC set names for your “Pulled from” entries. The number you gave each box or pack stays exactly the same. Untick anything you want to keep as it is, or edit the new name.</p>
    ${ch.length?`<h4 style="margin:12px 0 4px">Suggested (${ch.length})</h4>${ch.map(row).join('')}`:''}
    ${no.length?`<details style="margin-top:10px"><summary>No WotC set found (${no.length}) — pick one if it is a set</summary>${no.map(row).join('')}</details>`:''}
    <datalist id="tsets">${TS.S.s.map(x=>`<option value="${esc(x.n)}">`).join('')}</datalist>
    <div class="row" style="margin-top:12px"><button class="pri" onclick="fxTidyApply()">Rename ticked names</button><button onclick="closeM()">Cancel</button></div>`)}
function fxTidySet(i,v){const r=TS.rows[i],set=TS.S.s.find(x=>x.n.toLowerCase()===String(v).trim().toLowerCase());r.set=set?set.n:'';r.neu=set?fxTidyName(r.old,set,TS.S):'';r.on=!!r.neu;r.merge=!!r.neu&&r.neu.toLowerCase()!==r.old.toLowerCase()&&allSources().some(x=>x.toLowerCase()===r.neu.toLowerCase());KEEPSCROLL=true;fxTidyOpen()}
async function fxTidyApply(){const L=(TS.rows||[]).filter(r=>r.on&&r.neu&&r.neu!==r.old);if(!L.length)return toast('Nothing ticked to rename');
  if(L.some(r=>isCustomSrc(r.neu)))return toast('“Custom Cards” is reserved for custom cards — pick another name');
  if(!(await ask(`Rename ${fxPl(L.length,'“Pulled from” name')}?\n\n${L.slice(0,12).map(r=>`${r.old} → ${r.neu}`).join('\n')}${L.length>12?`\n…and ${L.length-12} more`:''}\n\nThe numbers stay the same. Your cards, their history and the import history are updated — nothing else changes.\n\nOK = Rename\nCancel = Go back`)))return;
  const M=new Map(L.map(r=>[r.old,r.neu]));let n=0;
  D.cards.forEach(c=>{const ss=cardSources(c);if(!ss.some(s=>M.has(s)))return;const o=c.source,out=[];ss.map(s=>M.get(s)||s).forEach(x=>{if(!out.some(y=>y.toLowerCase()===x.toLowerCase()))out.push(x)});c.source=out.join(', ');logEdit(c.name,'Pulled from',o,c.source);n++});
  D.acq.forEach(a=>{const x=canonSrc(a.source);if(M.has(x))a.source=M.get(x)});(D.imports||[]).forEach(h=>{if(M.has(h.src))h.src=M.get(h.src)});
  D.decks.forEach(d=>{if(d.srcs)for(const k in d.srcs){const m=d.srcs[k],o={};for(const s in m){const t=M.get(s)||s;o[t]=(o[t]||0)+m[s]}d.srcs[k]=o}});
  try{const ls=localStorage.getItem('mtg_lastsrc_v1');if(ls&&M.has(ls))localStorage.setItem('mtg_lastsrc_v1',M.get(ls))}catch(e){}
  save();closeM();TS.rows=null;TS.msg='';render();toast(`✓ Renamed ${fxPl(L.length,'name')} on ${fxPl(n,'card')} — now checking artwork from the new names…`);setTimeout(()=>fxSrcVerify(),400)}


/* ---------- pop-ups: the page behind never scrolls while one is open ---------- */
function fxLockCheck(){const on=!!document.querySelector('.modal.open,#cam,#apfull,#qafull,#zoom,#legload,#askov');document.documentElement.classList.toggle('lock',on)}
(()=>{let q=0;const mo=new MutationObserver(()=>{if(q)return;q=requestAnimationFrame(()=>{q=0;fxLockCheck()})});const go=()=>mo.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});document.body?go():addEventListener('DOMContentLoaded',go)})();

/* ---------- shared rule check + grouped “where it comes from / goes back to” lists ---------- */
/* Returns why a card may not be added under the deck’s rules (banned, not legal, outside commander colors, custom card in an official format), or ''. */
function fxRuleBlock(c,qty,F,cmdC){const x=fxCardIssues(c,qty,F,cmdC).find(i=>['banned','notlegal','color','custom'].includes(i.kind));return x?x.title.toLowerCase():''}
const fxGrpPut=(G,k,q,name,alt)=>{if(q>0)(G[k]=G[k]||[]).push({q,name,alt:alt||[]})};
const fxGrpHtml=G=>{const ks=Object.keys(G).sort((a,b)=>(/deck:/i.test(b)-/deck:/i.test(a))||a.localeCompare(b));return ks.length?ks.map(k=>`<div class="grp"><b>${esc(k)} <span class="mut">· ${sum(G[k],x=>x.q)}</span></b>${G[k].sort((a,b)=>a.name.localeCompare(b.name)).map(x=>`<div>${x.q}× ${esc(x.name)}${x.alt.length?` <span class="mut">(${/^pulled from /.test(x.alt[0])?esc(x.alt.join(', ')):'or '+esc(x.alt.join(' / '))})</span>`:''}</div>`).join('')}</div>`).join(''):'<p class="mut">None.</p>'};

/* ---------- ✨ Optimize Deck: the Deck Generator’s tools pointed at an existing deck ---------- */
let OPT={};
function fxOptOpen(i){if(RO)return;if(DRAFT&&DRAFT.deck===i&&fxDraftDirty())return toast('Save or discard your unsaved deck changes first');DRAFT=null;
  if(OPT.deck!==i||OPT.dname!==D.decks[i].name)OPT={deck:i,dname:D.decks[i].name,goal:'',colors:[],legal:'',own:true,noDecks:true,from:{},reply:'',res:null,step:'',err:''};
  V.opt=i;render();scrollTo(0,0);const F=dfmt(D.decks[i].format);if(F&&F.leg)ensureLegal().then(()=>render())}
function fxOptClose(){if(OPT.busy)aiCancel2();V.opt=null;OPT.step='';render();scrollTo(0,0)}
const optAllowed=()=>OPT.noDecks?[]:D.decks.filter((d,k)=>k!==OPT.deck&&OPT.from[d.name]).map(d=>d.name);
function optCols(d,F){const cmdC=F&&F.cmd&&d.commander&&findCard(d.commander);if(cmdC)return {cols:fxIdCols(cmdC),why:'the '+F.cmdLabel.toLowerCase()+'’s colors'};
  if(OPT.colors.length)return {cols:OPT.colors,why:'the colors you picked'};const s=new Set();d.cards.forEach(e=>{const c=findCard(e.name);if(c)fxCI(c).forEach(x=>s.add(x))});return {cols:CLR.filter(x=>s.has(x)),why:'the deck’s current colors',soft:true}}
const optLegal=(c,F)=>{const k=F&&F.leg||OPT.legal;return !k||!!(c.leg&&(c.leg[k]==='l'||c.leg[k]==='r'))};
function fxOptView(m,i){const d=D.decks[i],F=dfmt(d.format),L=d.cards,tot=sum(L),cc=optCols(d,F);
  if(OPT.step==='confirm')return fxOptConfirm(m,i);
  m.innerHTML=`<button onclick="fxOptClose()">← ${esc(d.name)}</button><h2 style="margin:10px 0 4px">✨ Optimize Deck</h2>
  <div class="tags"><span>${esc(d.format)}</span><span>${tot}${F&&F.n?'/'+F.n:''} cards</span>${d.commander?`<span>${esc(F&&F.cmdLabel||'Commander')}: ${cl(d.commander)}</span>`:''}</div>
  <p class="mut">An AI looks at this deck and the cards you can use, and suggests what to take out and put in. Nothing changes until you check every change and confirm.</p>
  <div class="f">${F?`<p class="mut" style="margin:0 0 6px">Rules for this deck: ${esc(fmtRuleText(F))}${F.leg?` Only cards legal in ${esc(F.k)} are suggested.`:''}</p>`:'<div class="warn">This deck has no deck type, so no rules can be checked. Set one with ✎ Edit details.</div>'}
  ${F&&!F.leg?`<label>Card legality</label><select onchange="OPT.legal=this.value;render();if(OPT.legal)ensureLegal().then(()=>render())"><option value="">Any card — casual, no restrictions</option><optgroup label="Only cards that can be played in…">${FMTS.map(([k,n])=>`<option value="${k}" ${OPT.legal===k?'selected':''}>${n}</option>`).join('')}</optgroup></select>`:''}
  ${F&&F.cmd&&d.commander?`<p class="mut">Colors: only cards inside ${esc(d.commander)}’s color identity (${cc.cols.length?cc.cols.map(symImg).join(''):'colorless'}).</p>`:`<label>Colors <span class="mut">(none selected = keep the deck’s current colors)</span></label><div class="chips">${CLR.map(k=>`<button class="pipb ${OPT.colors.includes(k)?'on':''}" title="${CLRN[k]}" onclick="OPT.colors=OPT.colors.includes('${k}')?OPT.colors.filter(x=>x!=='${k}'):[...OPT.colors,'${k}'];render()">${symImg(k)}</button>`).join('')}</div>`}
  <label>Where may new cards come from?</label>
  <label style="margin:2px 0"><input type="checkbox" ${OPT.noDecks?'checked':''} onchange="OPT.noDecks=this.checked;render()">Don't use cards already in other decks</label>
  ${OPT.noDecks?'<p class="mut">Only cards that are not in any deck will be suggested.</p>':`<p class="mut">Cards not in any deck are always available. Also allow taking cards from:</p>${D.decks.map((x,k)=>k===i?'':`<label style="margin:2px 0"><input type="checkbox" ${OPT.from[x.name]?'checked':''} onchange="OPT.from[${JSON.stringify(x.name).replace(/"/g,'&quot;')}]=this.checked">${esc(x.name)} <span class="mut">· ${sum(x.cards)} cards</span></label>`).join('')||'<p class="mut">No other decks.</p>'}<p class="mut">Cards taken from a deck are recorded as a loan; that deck gets a red ★ until you return them or make it permanent.</p>`}
  <label>Goal</label><textarea rows="3" oninput="OPT.goal=this.value" placeholder="How do you want to optimize?">${esc(OPT.goal)}</textarea>
  <p class="mut" style="font-size:12px;margin:4px 0 0">Describe a problem (“runs out of cards”, “too slow”), or a play style or ability to balance. Leave it blank and the AI looks for a more optimal build overall.</p>
  <label><input type="checkbox" ${OPT.own?'checked':''} onchange="OPT.own=this.checked">Only use cards I own</label></div>
  <details class="aopt" ${fxAiOpen('a')} ontoggle="fxAiTog('a',this.open)"><summary><h3>Option A — use your own AI chat (no key needed)</h3></summary><ol class="st"><li>Set the options above.</li><li>Tap <b>Copy prompt</b>.</li><li>Paste it into a new chat in your AI app (Gemini, ChatGPT, Claude, etc.) and send.</li><li>Copy its whole answer, paste it into the <b>AI reply</b> box below and tap <b>Read reply</b>.</li></ol><button class="pri" onclick="fxOptCopy()">📋 Copy prompt</button></details>
  <details class="aopt" ${fxAiOpen('b')} ontoggle="fxAiTog('b',this.open)"><summary><h3>Option B — optimize here (needs an API key)</h3></summary><p class="mut">Uses the same provider, model and key as the Deck Generator.</p>
  ${aiKeyUI()}<br>${OPT.busy?`<div class="sec"><b id="obusy">Waiting for the AI… ${fxElapsed(OPT.t0)}</b><p class="mut" style="margin:4px 0 8px">This usually takes 20 seconds to 2 minutes. It stops by itself after 3 minutes.</p><button onclick="aiCancel2()">Cancel</button></div>`:'<button class="pri" onclick="fxOptRun()">✨ Optimize deck</button>'}${OPT.err?`<div class="warn">${esc(OPT.err)}</div>`:''}</details>
  <h3>AI reply</h3><textarea id="oreply" rows="6" oninput="OPT.reply=this.value" placeholder="Paste the AI's answer here (Option B fills this in for you)">${esc(OPT.reply)}</textarea><br><br><button onclick="fxOptRead()">Read reply</button><div id="oprev"></div>`;
  if(OPT.res)fxOptPrev()}
function fxOptPrompt(){const i=OPT.deck,d=D.decks[i],F=dfmt(d.format),al=optAllowed(),cc=optCols(d,F),cmdC=F.cmd&&d.commander&&findCard(d.commander),inDeck={},tot=sum(d.cards);
  d.cards.forEach(e=>{const k=norm(e.name);inDeck[k]=(inDeck[k]||0)+e.qty});
  const desc=c=>`${c.type} | ${c.colors} | MV ${c.cmc}`;
  const deckRows=d.cards.map(e=>{const c=findCard(e.name);return `${e.qty} ${e.name}${c?' | '+desc(c):''}`});
  const rows=D.cards.filter(c=>isReal(c)&&optLegal(c,F)&&!(F.leg&&c.custom)&&(!cc.cols.length||okColor(c,cc.cols)))
    .map(c=>({c,a:Math.min(aiAvail(c,al),Math.max(0,copyCap(c,F)-(inDeck[norm(c.name)]||0)))})).filter(x=>x.a>0).map(({c,a})=>`${c.name} | ${desc(c)} | available ${a}`);
  const legal=F.leg?F.k:OPT.legal?(FMTS.find(x=>x[0]===OPT.legal)||[])[1]:'';
  return `You are an expert Magic: The Gathering deck builder. Improve my existing ${F.k} deck. Follow the official ${F.k} deck-building rules exactly.
Deck rules: ${fmtRuleText(F)}${F.prompt?' '+F.prompt:''}
Deck: ${d.name}${d.commander?`\n${F.cmdLabel||'Commander'}: ${d.commander} (keep it — never remove it)`:''}
Goal: ${OPT.goal.trim()||'Review the cards available in my collection and the cards already in my deck, and find a more optimal build: better synergy, a smoother mana curve, the right number of lands and better card quality. Only change what clearly improves the deck.'}
Format legality: ${legal?'only cards legal in '+legal+' (the list below is already filtered; a card marked restricted may appear only once)':'none — any card is fine'}
Colors: ${cc.cols.length?(cmdC?'only cards inside the '+(F.cmdLabel||'commander').toLowerCase()+'’s color identity: ':'stay within ')+cc.cols.map(x=>CLRN[x]).join(', ')+(cmdC?'':' (colorless cards and lands are fine)'):'any'}
${OPT.own?'New cards must come ONLY from MY AVAILABLE CARDS below, spelled exactly as listed, never more copies than "available".':'Prefer cards from MY AVAILABLE CARDS below; you may suggest a few cards I do not own — put * at the end of those lines (I would have to get them first).'}
The deck has ${tot} cards now and must have exactly ${F.n||tot} cards after your changes.

OUTPUT FORMAT: list only the changes, one per line:
OUT <quantity> <card name>   (a card to take out of the deck)
IN <quantity> <card name>    (a card to put into the deck)
No headings or bullets. Then write a line containing only --- and explain the changes and why they help (under 200 words).

CURRENT DECK (quantity name | type | colors | mana value):
${deckRows.join('\n')}

MY AVAILABLE CARDS (name | type | colors | mana value | copies available):
${rows.join('\n')||'(none)'}`}
async function fxOptCopy(){const F=dfmt(D.decks[OPT.deck].format);if(!F)return toast('Give this deck a deck type first (✎ Edit details)');if((F.leg||OPT.legal)&&!(await ensureLegal()))return;const p=fxOptPrompt();
  try{await navigator.clipboard.writeText(p);toast('Prompt copied — paste it into your AI')}catch(e){openM(`<h3>Copy this prompt</h3><textarea rows="12" readonly style="width:100%" onfocus="this.select()">${esc(p)}</textarea>`)}}
function aiCancel2(){if(OPT.ctl){OPT.cancelled=true;OPT.ctl.abort()}}
async function fxOptRun(){const F=dfmt(D.decks[OPT.deck].format);if(!F)return toast('Give this deck a deck type first (✎ Edit details)');
  const key=AIKEY.trim(),model=G.model.trim();if(!key||!model)return toast('Enter a model and your API key first');if((F.leg||OPT.legal)&&!(await ensureLegal()))return;
  OPT.busy=true;OPT.err='';OPT.t0=Date.now();OPT.ctl=new AbortController();render();const tick=setInterval(()=>{const b=$('#obusy');if(b)b.textContent='Waiting for the AI… '+fxElapsed(OPT.t0)},1000);let txt='';
  try{txt=await fxCallAI(fxOptPrompt(),{signal:OPT.ctl.signal,timeout:180000,maxTokens:6000})}
  catch(e){OPT.err=e&&e.name==='AbortError'?(OPT.cancelled?'Cancelled.':'The AI took longer than 3 minutes, so I stopped waiting. Try again, or pick a faster model.'):String(e&&e.message||e)}
  clearInterval(tick);OPT.busy=false;OPT.cancelled=false;OPT.ctl=null;if(txt&&!OPT.err){OPT.reply=txt;OPT.res=null}render();if(txt&&!OPT.err)fxOptRead()}
function fxOptRead(){const i=OPT.deck,d=D.decks[i],F=dfmt(d.format);if(!F)return toast('Give this deck a deck type first (✎ Edit details)');
  OPT.reply=$('#oreply')?.value??OPT.reply;const parts=OPT.reply.split(/^\s*---+\s*$/m),why=(parts.slice(1).join('\n')).trim(),al=optAllowed(),cmdC=F.cmd&&d.commander&&findCard(d.commander),cc=optCols(d,F);
  const inDeck={};d.cards.forEach(e=>{const k=norm(e.name);inDeck[k]=(inDeck[k]||0)+e.qty});
  const outs=[],ins=[],byO={},byI={};
  parts[0].split('\n').forEach(l=>{l=l.replace(/^[\s•*]+/,'').replace(/\*\*/g,'');const m=l.match(/^(OUT|IN|REMOVE|ADD|CUT|[-−+])\s*:?\s*(\d+)?\s*x?\s+(.+?)\s*$/i);if(!m)return;
    const isOut=/^(OUT|REMOVE|CUT|-|−)$/i.test(m[1]),q=+(m[2]||1),nm=m[3].replace(/\*+$/,'').replace(/\s*\(.*\)\s*$/,'').trim(),k=norm(nm),B=isOut?byO:byI,A=isOut?outs:ins;
    if(B[k])B[k].want+=q;else{B[k]={name:nm,want:q,c:findCard(nm)};A.push(B[k])}});
  const after=Object.assign({},inDeck);
  outs.forEach(e=>{const k=norm(e.name),have=inDeck[k]||0;if(e.c)e.name=e.c.name;
    if(!have){e.n=0;e.st='✗ not in this deck (skipped)';return}
    if(cmdC&&k===norm(cmdC.name)){e.n=0;e.st='✗ the '+(F.cmdLabel||'commander').toLowerCase()+' stays (skipped)';return}
    e.n=Math.min(e.want,have);after[k]-=e.n;const src=e.c?(loanedIn(d.name,e.c.name)?'↩ back to the deck it was borrowed from':'↩ back to '+fxCardLabel(e.c).k):'';e.st=(e.n<e.want?`⚠ the deck only has ${have} (removing ${e.n}) · `:'')+(src||'✓ removed')});
  let total=sum(Object.values(after),x=>x);
  ins.forEach(e=>{const c=e.c;if(!c||!isReal(c)){e.n=0;e.st=OPT.own?'✗ not in your collection (skipped)':'✗ you don’t own it — add it to your collection first (skipped)';return}e.name=c.name;const k=norm(c.name);
    if(!optLegal(c,F)){e.n=0;e.st='✗ not legal'+(F.leg?' in '+F.k:'')+' (skipped)';return}
    if(!cmdC&&cc.cols.length&&!okColor(c,cc.cols)){e.n=0;e.st='✗ outside '+cc.why+' (skipped)';return}
    const bad=fxRuleBlock(c,(after[k]||0)+e.want,F,cmdC);if(bad){e.n=0;e.st='✗ '+bad+' (skipped)';return}
    const cap=copyCap(c,F),room=Math.max(0,cap-(after[k]||0));let n=Math.min(e.want,room);const note=[];if(n<e.want)note.push(`${F.k} allows ${cap}`);
    const pl=planCard(c,n,al);if(pl.got<n){note.push(`only ${pl.got} available`);n=pl.got}
    if(F.n&&total+n>F.n){const k2=Math.max(0,F.n-total);note.push(`the deck would go over ${F.n} cards`);n=Math.min(n,k2)}
    e.n=n;after[k]=(after[k]||0)+n;total+=n;if(!n){e.st='✗ '+note.join(', ')+' (skipped)';return}
    const p2=planCard(c,n,al);e.st=(note.length?'⚠ '+note.join(', ')+` (adding ${n}) · `:'')+(p2.from.length?'↪ '+p2.from.map(x=>`${x.q} from ${x.deck}`).join(', ')+(p2.free?` + ${p2.free} free`:''):'✓ free in your collection')});
  OPT.res={outs,ins,why,total};fxOptPrev()}
function fxOptPrev(){const r=OPT.res,el=$('#oprev'),d=D.decks[OPT.deck],F=dfmt(d.format);if(!el)return;const no=sum(r.outs,e=>e.n),ni=sum(r.ins,e=>e.n);
  if(!r.outs.length&&!r.ins.length){el.innerHTML='<div class="warn">I couldn’t find any “OUT 1 Card” / “IN 1 Card” lines in that reply.</div>';return}
  el.innerHTML=`<h3>Suggested changes</h3>${r.why?`<div class="sec" style="white-space:pre-wrap">${esc(r.why)}</div>`:''}
  <h4>Take out (${no})</h4>${r.outs.length?tbl(['Qty','Card','Status'],r.outs.map(e=>[e.n||e.want,{h:cl(e.name)},e.st])):'<p class="mut">Nothing.</p>'}
  <h4>Put in (${ni})</h4>${r.ins.length?tbl(['Qty','Card','Comes from'],r.ins.map(e=>[e.n||e.want,{h:cl(e.name)},e.st])):'<p class="mut">Nothing.</p>'}
  <p class="mut">After these changes the deck has <b>${r.total}${F&&F.n?'/'+F.n:''}</b> cards.${F&&F.n&&r.total<F.n?` That’s ${F.n-r.total} short — you can add cards by hand afterwards.`:''}</p>
  ${no+ni?'<button class="pri big" onclick="OPT.step=\'confirm\';render();scrollTo(0,0)">Accept these changes ›</button>':'<div class="warn">None of the suggested changes can be made (see the reasons above).</div>'}`}
function fxOptGroups(){const r=OPT.res,d=D.decks[OPT.deck],al=optAllowed(),outG={},inG={};
  r.outs.filter(e=>e.n>0).forEach(e=>{const c=e.c||findCard(e.name);let n=e.n;[...actLoans()].reverse().filter(l=>l.to===d.name&&norm(l.card)===norm(e.name)).forEach(l=>{if(n<=0)return;const k=Math.min(n,l.qty);n-=k;fxGrpPut(outG,'Return to deck: '+l.from,k,e.name)});
    if(n>0){const L=c?fxCardLabel(c):{k:'Not in your collection',alt:[]};fxGrpPut(outG,L.k,n,e.name,L.alt)}});
  r.ins.filter(e=>e.n>0).forEach(e=>{const pl=planCard(e.c,e.n,al),L=fxCardLabel(e.c);fxGrpPut(inG,L.k,e.c.type==='Basic Land'?e.n:pl.free,e.c.name,L.alt);if(e.c.type!=='Basic Land')pl.from.forEach(f=>fxGrpPut(inG,'From deck: '+f.deck,f.q,e.c.name))});
  return {outG,inG}}
function fxOptConfirm(m,i){const d=D.decks[i],F=dfmt(d.format),{outG,inG}=fxOptGroups(),no=sum(Object.values(outG).flat(),x=>x.q),ni=sum(Object.values(inG).flat(),x=>x.q);
  m.innerHTML=`<button onclick="OPT.step='';render();scrollTo(0,0)">‹ Back to the suggestions</button><h2 style="margin:10px 0 4px">Confirm changes to ${esc(d.name)}</h2>
  <p class="mut">Check every card. Nothing changes until you tap <b>Update deck</b>.</p>
  <h3>Cards removed (${no}) — they go back to:</h3>${fxGrpHtml(outG)}
  <h3>Cards added (${ni}) — pull them from:</h3>${fxGrpHtml(inG)}
  <p class="mut">The deck will have <b>${OPT.res.total}${F&&F.n?'/'+F.n:''}</b> cards. Cards taken from other decks are recorded as loans (red ★ on that deck).</p>
  <div class="row"><button onclick="OPT.step='';render();scrollTo(0,0)">‹ Back</button><button class="pri" onclick="fxOptApply()">✓ Update deck</button></div>`}
function fxOptApply(){const i=OPT.deck,d=D.decks[i],r=OPT.res;if(!d||d.name!==OPT.dname)return toast('That deck changed — open Optimize again');
  DRAFT=null;const dr=fxDraft(i);
  r.outs.filter(e=>e.n>0).forEach(e=>{const x=dr.m[norm(e.name)];if(x)x.qty=Math.max(0,x.qty-e.n)});
  r.ins.filter(e=>e.n>0).forEach(e=>{const k=norm(e.c.name),x=dr.m[k]||(dr.m[k]={name:e.c.name,base:0,qty:0});x.qty+=e.n});
  const al=optAllowed();d.info=((d.info||'')+(d.info?' · ':'')+'Optimized '+today()).slice(-300);
  OPT={};V.opt=null;fxDraftSave({yes:true,allowed:al});scrollTo(0,0)}


/* ---------- Build a deck from someone else's list: use my cards, borrow from my decks, or track the rest as missing → ordered → received ---------- */
const fxTcg=n=>'https://www.tcgplayer.com/search/magic/product?productLineName=magic&view=grid&q='+encodeURIComponent(front(n));
const fxTcgMass=L=>'https://www.tcgplayer.com/massentry?productline=Magic&c='+encodeURIComponent(L.map(m=>`${m.qty} ${front(m.name)}`).join('||'));
const fxMissUsd=m=>{const c=findCard(m.name);return (c&&c.price?fxUnit(c).Normal:0)||m.usd||0};
const fxMissQ=(d,n)=>sum((d.miss||[]).filter(m=>norm(m.name)===norm(n)),m=>m.qty);
let BP=null;
function fxBuildPlan(i){const d=D.decks[i],snap={};d.cards.forEach(e=>{const c=findCard(e.name)||{};snap[norm(e.name)]={type:c.type||'',cmc:c.cmc||'',colors:c.colors||'',cost:c.cost||'',art:ART[c.name]||c.art||'',usd:c.price?fxUnit(c).Normal||0:0}});
  const src={name:d.name,format:d.format||'Casual',commander:d.commander||'',owner:RO.given||RO.name,cards:d.cards.map(e=>({name:e.name,qty:e.qty}))};roExit();
  const rows=[];src.cards.forEach(e=>{const c=findCard(e.name),s=snap[norm(e.name)]||{},r={name:c?c.name:e.name,need:e.qty,snap:s,c};
    if(!c||!isReal(c)){r.free=0;r.lend=[];r.buy=e.qty}
    else{r.free=Math.min(e.qty,freeCopies(c));let left=e.qty-r.free;r.lend=[];if(c.type!=='Basic Land')D.decks.map(x=>({deck:x.name,t:takeable(c,x.name)})).filter(x=>x.t>0).sort((a,b)=>b.t-a.t).forEach(x=>{if(left<=0)return;const k=Math.min(left,x.t);r.lend.push({deck:x.deck,q:k});left-=k});r.buy=left}
    r.usd=(c&&c.price?fxUnit(c).Normal:0)||s.usd||0;r.borrow=false;rows.push(r)});
  let nm=`${src.owner} - ${src.name}`,k=2;while(D.decks.some(x=>x.name.toLowerCase()===nm.toLowerCase()))nm=`${src.owner} - ${src.name} ${k++}`;
  BP={src,rows,name:nm};go('decks');V.deck=null;render();fxBuildDraw()}
function fxBuildDraw(){const B=BP;if(!B)return;const tot=k=>sum(B.rows,r=>k(r)),inDeck=B.rows.filter(r=>r.lend.length);
  const st=r=>[r.free?`✓ ${r.free} from your collection`:'',r.lend.length?(r.borrow?'↪ borrow '+r.lend.map(x=>`${x.q} from ${esc(x.deck)}`).join(', '):'⏳ missing — '+r.lend.map(x=>`${x.q} in ${esc(x.deck)}`).join(', ')):'',r.buy?`🛒 ${r.buy} to get (you don’t own ${r.free||r.lend.length?'enough':'it'})${r.usd?' · ≈ '+fxMoney(r.usd*r.buy):''}`:''].filter(Boolean).join('<br>');
  openM(`<h3>Build “${esc(B.src.name)}” with your cards</h3>
  <div class="f"><label>New deck name</label><input id="bpname" value="${esc(B.name)}" oninput="BP.name=this.value"></div>
  <div class="tags"><span>✓ ${tot(r=>r.free)} you have free</span><span>↪/⏳ ${tot(r=>sum(r.lend,x=>x.q))} in your other decks</span><span>🛒 ${tot(r=>r.buy)} you don’t own${tot(r=>r.buy*r.usd)?` · ≈ ${fxMoney(tot(r=>r.buy*r.usd))}`:''}</span></div>
  ${inDeck.length?`<div class="sec"><b>Cards that are in your other decks</b><p class="mut" style="margin:4px 0">Borrow them now (recorded as a loan — that deck gets a red ★), or leave them where they are and list them as missing in the new deck.</p><div class="row"><button onclick="BP.rows.forEach(r=>r.borrow=true);fxBuildDraw()">↪ Borrow all</button><button onclick="BP.rows.forEach(r=>r.borrow=false);fxBuildDraw()">⏳ Leave all as missing</button></div></div>`:''}
  <div class="tblw"><table><tr><th>Qty</th><th>Card</th><th>Where it comes from</th></tr>${B.rows.map((r,k)=>`<tr><td>${r.need}</td><td>${esc(r.name)}</td><td style="font-size:13px">${st(r)}${r.lend.length?`<br><label style="margin:4px 0 0;font-weight:400"><input type="checkbox" ${r.borrow?'checked':''} onchange="BP.rows[${k}].borrow=this.checked;fxBuildDraw()">Borrow</label>`:''}${r.buy?`<br><a href="${fxTcg(r.name)}" target="_blank" rel="noopener">Find on TCGplayer ↗</a>`:''}</td></tr>`).join('')}</table></div>
  <p class="mut">Cards you don’t have are still put on the deck list and marked missing (🛒), so you can order them and tick them off when they arrive.</p>
  <div class="row"><button onclick="BP=null;closeM()">Cancel</button><button class="pri" onclick="fxBuildMake()">Create deck</button></div>`)}
async function fxBuildMake(){const B=BP,name=(B.name||'').trim();if(!name)return toast('Give the deck a name');if(D.decks.some(x=>x.name.toLowerCase()===name.toLowerCase()))return toast('You already have a deck with that name — pick another');
  {const bor=sum(B.rows.filter(r=>r.borrow),r=>sum(r.lend,x=>x.q)),mis=sum(B.rows,r=>r.buy+(r.borrow?0:sum(r.lend,x=>x.q)));if(!(await ask(`Create “${name}”?${bor?`\n\n${fxPl(bor,'card')} will be borrowed from your other decks (they get a red ★).`:''}${mis?`\n${fxPl(mis,'card')} will be listed as missing.`:''}`)))return}
  const d={name,format:B.src.format,sleeve:'',commander:B.src.commander,info:`Built from ${B.src.owner}’s “${B.src.name}”`,cards:[],tokens:[],miss:[]};D.decks.push(d);const inG={},sec='Built from a shared deck';
  B.rows.forEach(r=>{const e={name:r.name,qty:r.need,finish:'Normal'};if(!r.c){Object.assign(e,{type:r.snap.type,cmc:r.snap.cmc,colors:r.snap.colors})}d.cards.push(e);
    r.lend.forEach(x=>{if(r.borrow){makeLoan(r.name,x.q,x.deck,name,sec+' — borrowed from another deck');fxGrpPut(inG,'From deck: '+x.deck,x.q,r.name)}else d.miss.push({name:r.name,qty:x.q,why:'deck',deck:x.deck,st:'missing',at:today()})});
    if(r.buy)d.miss.push({name:r.name,qty:r.buy,why:'buy',st:'missing',at:today(),usd:r.usd||0})});
  if(!d.miss.length)delete d.miss;BP=null;save();fxAllocDiff(d,{},inG,null);closeM();V.view='decks';V.deck=D.decks.length-1;render();scrollTo(0,0);
  const nm=sum(d.miss||[],m=>m.qty);if(Object.keys(inG).length)fxPullSplash(name,inG,{});toast(nm?`Deck created — ${fxPl(nm,'card')} marked missing (🛒)`:'Deck created')}
/* Missing-cards box on the deck page */
function fxMissBox(i){const d=D.decks[i];if(RO||!d||!(d.miss||[]).length)return '';const L=d.miss,mi=L.filter(m=>m.st==='missing'),buy=mi.filter(m=>m.why==='buy');
  const row=(m,k)=>{const c=findCard(m.name),fr=c?freeCopies(c):0,canB=m.why==='deck'&&m.deck&&c&&takeable(c,m.deck)>0;
    return `<div class="sec" style="margin:6px 0"><b>${m.qty}× ${cl(m.name)}</b> <span class="mut">· ${m.st==='ordered'?`📦 ordered ${esc(m.od||'')}${m.note?' — '+esc(m.note):''}`:m.why==='deck'?`⏳ in ${esc(m.deck||'another deck')}`:'🛒 you don’t own it'}${fxMissUsd(m)?' · ≈ '+fxMoney(fxMissUsd(m)*m.qty):''}</span>
    <div class="row" style="margin-top:6px">${m.st==='missing'?`<a class="btn" href="${fxTcg(m.name)}" target="_blank" rel="noopener">TCGplayer ↗</a><button onclick="fxMissOrdered(${i},${k})">Ordered</button>${canB?`<button onclick="fxMissBorrow(${i},${k})">↪ Borrow from ${esc(m.deck)}</button>`:''}${fr>0?`<button onclick="fxMissUseFree(${i},${k})">✓ Use my free copy</button>`:''}`
      :`<button onclick="fxMissCancel(${i},${k})">Order cancelled</button><button class="pri" onclick="fxMissGot(${i},${k})">Card received</button>`}</div></div>`};
  return `<div class="redbox" style="border-color:#f39c12"><b>🛒 Missing cards — ${fxPl(sum(L,m=>m.qty),'card')}</b><p class="mut" style="margin:4px 0">They’re on the deck list but not in the deck yet. Order them, then tap <b>Card received</b> to add them to your collection.${sum(buy,m=>fxMissUsd(m)*m.qty)?` Estimated cost of the cards you don’t own: <b>≈ ${fxMoney(sum(buy,m=>fxMissUsd(m)*m.qty))}</b> (Scryfall market price).`:''}</p>
  ${buy.length?`<div class="row"><a class="btn pri" href="${fxTcgMass(buy)}" target="_blank" rel="noopener">🛒 Buy all ${fxPl(sum(buy,m=>m.qty),'card')} on TCGplayer ↗</a><button onclick="fxMissOrderAll(${i})">Mark all as ordered</button></div>`:''}
  ${L.map(row).join('')}</div>`}
const fxMissTag=d=>(d.miss||[]).length?` <span style="color:#f39c12;font-size:12px">🛒 ${sum(d.miss,m=>m.qty)} missing${d.miss.some(m=>m.st==='ordered')?' · 📦 '+sum(d.miss.filter(m=>m.st==='ordered'),m=>m.qty)+' ordered':''}</span>`:'';
function fxMissDone(d,k){d.miss.splice(k,1);if(!d.miss.length)delete d.miss}
async function fxMissOrdered(i,k){const d=D.decks[i],m=d.miss[k];if(!(await ask(`Mark ${m.qty}× ${m.name} as ordered?`)))return;const n=await askText('Optional note — where you ordered it or an order number:','');m.st='ordered';m.od=today();if(n&&n.trim())m.note=n.trim().slice(0,120);save();render()}
async function fxMissOrderAll(i){const d=D.decks[i],L=d.miss.filter(m=>m.st==='missing'&&m.why==='buy');if(!(await ask(`Mark all ${fxPl(sum(L,m=>m.qty),'card')} you don’t own as ordered?\n\n${L.map(m=>m.qty+'× '+m.name).join('\n')}`)))return;const nt=(await askText('Optional note — where you ordered them or an order number:','')||'').trim().slice(0,120);L.forEach(m=>{m.st='ordered';m.od=today();if(nt)m.note=nt});save();render()}
async function fxMissCancel(i,k){const d=D.decks[i],m=d.miss[k];if(!(await ask(`Order cancelled for ${m.qty}× ${m.name}?\n\nIt goes back to missing.`)))return;m.st='missing';delete m.od;delete m.note;save();render()}
async function fxMissBorrow(i,k){const d=D.decks[i],m=d.miss[k],c=findCard(m.name),q=Math.min(m.qty,takeable(c,m.deck));if(!q)return toast(`${m.deck} has no copy to lend right now`);
  if(!(await ask(`Borrow ${q}× ${c.name} from ${m.deck}?\n\n${m.deck} will show a red ★ until it’s returned.`)))return;makeLoan(c.name,q,m.deck,d.name,'Built from a shared deck — borrowed from another deck');m.qty-=q;if(m.qty<=0)fxMissDone(d,k);save();render()}
async function fxMissUseFree(i,k){const d=D.decks[i],m=d.miss[k],c=findCard(m.name),q=Math.min(m.qty,freeCopies(c));if(!(await ask(`Use ${q}× ${c.name} from your collection (not in any deck)?`)))return;m.qty-=q;if(m.qty<=0)fxMissDone(d,k);save();render()}
async function fxMissGot(i,k){const d=D.decks[i],m=d.miss[k];let q=m.qty;if(m.qty>1){const a=await askText(`How many of the ${m.qty}× ${m.name} arrived?`,String(m.qty));if(a==null)return;q=Math.max(0,Math.min(m.qty,parseInt(a,10)||0));if(!q)return}
  if(!(await ask(`Card received: add ${q}× ${m.name} to your collection and to ${d.name}?\n\nIt’s filed under “Singles Orders”.${q<m.qty?`\n${m.qty-q} stay on order.`:''}`)))return;
  toast('Looking the card up…');const c=await scry('/cards/named?exact='+encodeURIComponent(front(m.name)));if(!c||c.object!=='card')return toast(navigator.onLine?'Couldn’t find that card on Scryfall — try again later':'You’re offline — try again when connected');
  const e=d.cards.find(x=>norm(x.name)===norm(m.name));if(e){['type','cmc','colors'].forEach(x=>delete e[x])}
  fxAddCard(c,q,'Normal','Singles Orders','','Ordered for '+d.name+(m.note?' — '+m.note:''));m.qty-=q;if(m.qty<=0)fxMissDone(d,k);IDX=null;saveArt();save();render();
  if(await ask(`${q}× ${c.name} added.\n\nVerify the artwork now? Pick the printing you received so it gets the gold ✓.`)){if(!fxCopiesOpen(c.name))artPicker(c.name)}}


/* ---------- Deck viewer filter / search: tap a card type or a mana-curve bar, or open 🔍 Search deck ---------- */
function fxDF(d){if(!V.df||V.dfd!==d.name){V.df={q:'',ty:[],mv:[],col:[]};V.dfd=d.name}return V.df}
const fxDFOn=F=>!!(F.q||F.ty.length||F.mv.length||F.col.length);
const fxMV=c=>Math.min(7,Math.round(parseFloat(c.cmc)||0));
function fxDFMatch(F,c){const q=F.q.trim().toLowerCase();if(q&&!(String(c.name||'').toLowerCase().includes(q)||String(c.text||'').toLowerCase().includes(q)||String(c.type||'').toLowerCase().includes(q)))return false;
  if(F.ty.length&&!F.ty.includes(c.type||'Other'))return false;if(F.mv.length&&(/Land/.test(c.type||'')||!F.mv.includes(fxMV(c))))return false;
  if(F.col.length){const ci=fxCI(c);if(!F.col.some(k=>k==='C'?!ci.length:ci.includes(k)))return false}return true}
const fxDFLabel=F=>[F.q.trim()?`“${F.q.trim()}”`:'',F.ty.join(' or '),F.mv.length?'mana value '+F.mv.map(k=>k===7?'7+':k).join('/'):'',F.col.length?F.col.map(k=>k==='C'?'colorless':CLRN[k]).join(' or '):''].filter(Boolean).join(' · ');
function fxDFTog(k,v){const d=D.decks[V.deck];if(!d)return;const F=fxDF(d);F[k]=F[k].includes(v)?F[k].filter(x=>x!==v):[...F[k],v];render();if($('#modal').classList.contains('open')&&$('#dfres'))fxDeckFind(true)}
function fxDFClear(){if(V.df){V.df={q:'',ty:[],mv:[],col:[]}}{const qi=$('#dfq');if(qi){qi.value='';qi.dispatchEvent(new Event('input'))}}render();if($('#dfres'))fxDeckFind(true)}
function fxDeckFind(again){const i=V.deck,d=D.decks[i];if(!d)return;const F=fxDF(d),ents=fxDeckCards(i).map(e=>({e,c:findCard(e.name)||e})),types=[...new Set(ents.map(x=>x.c.type||'Other'))].sort();
  const hits=ents.filter(({c})=>fxDFMatch(F,c)),chip=(k,v,lab,on)=>`<button class="pipb ${on?'on':''}" style="width:auto;padding:4px 10px" onclick="fxDFTog('${k}',${esc(JSON.stringify(v))})">${lab}</button>`;
  const body=`<div class="f" style="margin:0"><label>Card types</label><div class="chips">${types.map(t=>chip('ty',t,esc(t)+' '+sum(ents.filter(x=>(x.c.type||'Other')===t).map(x=>x.e)),F.ty.includes(t))).join('')}</div>
    <label>Mana value <span class="mut">(non-land)</span></label><div class="chips">${[0,1,2,3,4,5,6,7].map(k=>chip('mv',k,k===7?'7+':k,F.mv.includes(k))).join('')}</div>
    <label>Colors</label><div class="chips">${[...CLR,'C'].map(k=>`<button class="pipb ${F.col.includes(k)?'on':''}" title="${k==='C'?'Colorless':CLRN[k]}" onclick="fxDFTog('col','${k}')">${k==='C'?'◇':symImg(k)}</button>`).join('')}</div></div>
    <p class="mut" style="margin:10px 0 4px"><b>${sum(hits.map(x=>x.e))}</b> of ${sum(ents.map(x=>x.e))} cards match${fxDFOn(F)?' · '+esc(fxDFLabel(F)):''}</p>
    <div>${hits.slice(0,80).map(({e,c})=>`<div class="res" onclick="showCard(${esc(JSON.stringify(e.name))})"><span>${e.qty}× ${esc(e.name)} ${costHtml(c.cost||'')}<br><span class="mut" style="font-size:12px">${esc(c.type||'')}</span></span></div>`).join('')||'<p class="mut">Nothing matches.</p>'}</div>`;
  if(again&&$('#dfres')){$('#dfres').innerHTML=body;return}
  openM(`<h3>🔍 Search ${esc(RO?fxDeckTitle(d):d.name)}</h3><input id="dfq" type="search" placeholder="Name, type or rules text (e.g. flying, draw)…" style="width:100%" value="${esc(F.q)}" oninput="V.df.q=this.value;render();fxDeckFind(true)"><div id="dfres" style="margin-top:8px">${body}</div>
  <div class="row"><button onclick="fxDFClear()">Clear all</button><button class="pri" onclick="closeM()">Show on the deck page</button></div>`);setTimeout(()=>$('#dfq')?.focus(),50)}



/* Give n not-yet-verified copies of a card the printing p (copy 1 first, then copies 2+ in c.cps). Verified copies are never replaced. Returns how many were set. */
const fxPriceOf=p=>p&&p.prices?{n:p.prices.usd||'',f:p.prices.usd_foil||'',e:p.prices.usd_etched||''}:null;
function fxSetCopies(e,p,n){if(!e||!p||fxBasic(e))return 0;let k=0;const pr={set:p.set,setName:p.set_name,cn:p.collector_number,scryId:p.id,art:sImg(p),art2:sImg2(p)};
  if(n>0&&!e.verified){Object.assign(e,pr,{verified:true});ART[e.name]=pr.art||ART[e.name]||'';ART2[e.name]=pr.art2||'';e.price=null;e.priceAt='';fxSetPrice(e,p);k++}
  e.cps=e.cps||[];for(let i=0;i<e.qty-1&&k<n;i++){if(!e.cps[i]){e.cps[i]=Object.assign({},pr,fxPriceOf(p)?{price:fxPriceOf(p),priceAt:today()}:{});k++}}while(e.cps.length&&!e.cps[e.cps.length-1])e.cps.pop();if(!e.cps.length)delete e.cps;return k}
/* gold ✓ = every copy verified, silver ✓ = some, none → 🎨. Basic lands and custom cards have no check at all. */
const fxVerState=c=>!c||c.custom||fxBasic(c)||!isReal(c)?null:(n=>n>=c.qty?'all':n>0?'some':'none')(fxCopyList(c).filter(Boolean).length);
const fxUnverifiedCopies=e=>e&&!fxBasic(e)?fxCopyList(e).filter(x=>!x).length:0;
/* ---------- Several copies of a card: each copy can have its own verified artwork (copy 1 = the card's own printing, copies 2+ in c.cps). Basic lands never need verifying. ---------- */
const fxBasic=c=>!!c&&(c.type==='Basic Land'||/^Basic\b.*Land/i.test(c.type||''));
const fxCopiesOn=c=>!!c&&isReal(c)&&!c.custom&&c.qty>1&&!!findCard(c.name);
const fxCopyList=c=>{const L=[c.verified&&c.set?{set:c.set,setName:c.setName,cn:c.cn,scryId:c.scryId,art:c.art||ART[c.name]}:null];for(let k=1;k<c.qty;k++)L.push((c.cps||[])[k-1]||null);return L};
function fxCopiesRow(c){const L=fxCopyList(c),v=L.filter(Boolean);return `${v.length} of ${c.qty} copies verified${v.length?' <span style="color:var(--gold)">✓</span>':''}<br><span class="mut" style="font-weight:400;font-size:12px">${v.length?esc([...new Set(v.map(x=>`${x.setName} #${x.cn}`))].join(' · ')):'tap the card to choose each copy’s artwork'}</span>`}
function fxCopiesOpen(name,force){const c=findCard(name);if(!c||!fxCopiesOn(c)||RO)return false;const L=fxCopyList(c);
  openM(`<button onclick="showCard(${esc(JSON.stringify(c.name))})">← Back</button><h3>Your ${c.qty} copies of ${esc(c.name)}</h3><p class="mut">Each copy can be a different printing. Tap a copy to choose its artwork; <b>?</b> means ${fxBasic(c)?'no artwork chosen yet (basic lands don’t need it)':'that copy isn’t verified yet'}.</p>
  <div class="grid">${L.map((x,k)=>`<div class="tile" onclick="artPicker(${esc(JSON.stringify(c.name))},${k})"><div class="art">${x&&x.art?`<img src="${esc(x.art)}" alt=""><span class="vf" title="Artwork verified">✓</span>`:'<div class="qbox">?</div>'}</div><div class="nm setcap"><b>Copy ${k+1}</b><span>${x?esc(`${x.setName||''} · ${String(x.set||'').toUpperCase()} #${x.cn||''}`):'not verified yet'}</span></div></div>`).join('')}</div>
  ${L[0]&&!fxBasic(c)&&L.some(x=>!x)?`<div class="row"><button class="pri" onclick="fxCopiesSame(${esc(JSON.stringify(c.name))})">Use copy 1’s artwork for the ${(n=>n+' unverified '+(n===1?'copy':'copies'))(L.filter(x=>!x).length)}</button></div>`:''}
  ${artOf(c.name)?`<div class="row"><button onclick="zoom(${esc(JSON.stringify(c.name))})">⛶ View the card full screen</button></div>`:''}`,()=>showCard(c.name));return true}
/* copies screen: give every unverified copy copy 1's verified printing (asks first; verified copies are never changed) */
async function fxCopiesSame(name){const c=findCard(name);if(!c||!c.verified||RO)return;const n=fxUnverifiedCopies(c);if(!n)return;
  if(!(await ask(`Use copy 1’s artwork (${c.setName} · ${String(c.set||'').toUpperCase()} #${c.cn}) for the ${n} unverified ${n===1?'copy':'copies'} of ${c.name}?\n\nCopies that are already verified stay as they are.\n\nOK = Use it\nCancel = Go back`)))return;
  c.cps=c.cps||[];let k=0;for(let i=0;i<c.qty-1;i++){if(!c.cps[i]){c.cps[i]={set:c.set,setName:c.setName,cn:c.cn,scryId:c.scryId,art:c.art||ART[c.name]||'',art2:c.art2||ART2[c.name]||''};if(c.price){c.cps[i].price=c.price;c.cps[i].priceAt=c.priceAt||today()}k++}}
  logEdit(c.name,'Printing (copies)',`${k} copies not verified`,`${c.setName} #${c.cn} ✓ ×${k} (same as copy 1)`);save();toast(`✓ ${k} ${k===1?'copy':'copies'} verified`);fxCopiesOpen(c.name,true)}
async function fxCopySet(c,k,p){if(!(await ask(`Use ${p.set_name} (${String(p.set).toUpperCase()}) #${p.collector_number} for copy ${k+1} of ${c.name}?`)))return;
  c.cps=c.cps||[];while(c.cps.length<k)c.cps.push(null);const old=c.cps[k-1];
  c.cps[k-1]={set:p.set,setName:p.set_name,cn:p.collector_number,scryId:p.id,art:sImg(p),art2:sImg2(p)};if(fxPriceOf(p)){c.cps[k-1].price=fxPriceOf(p);c.cps[k-1].priceAt=today()}
  logEdit(c.name,`Printing (copy ${k+1})`,old?`${old.setName} #${old.cn} ✓`:'(not verified)',`${p.set_name} #${p.collector_number} ✓`);save();toast(`Copy ${k+1} verified`);fxCopiesOpen(c.name,true)}


/* More → Backup → “📂 Open my backups folder”. Android: opens the phone's file manager at Documents/MtG-DeckMaster. Web: a browser can't open folders, so it says where the browser saved them. */
async function fxOpenBkFolder(){
  if(isNative()){const U=window.Capacitor.Plugins.ApkUpdater;try{if(U&&U.openFolder){const r=await U.openFolder({path:'Documents/MtG-DeckMaster'});
      /* the phone's file browser opens inside the folder; tapping a backup hands it back here and it opens like any other file (with the usual checks before restoring) */
      if(r&&r.picked&&r.data){const b=atob(r.data),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);await fxOpenFile(new File([u],r.name||'backup',{type:/\.sqlite$/i.test(r.name||'')?'application/x-sqlite3':'application/json'}))}return}}catch(e){if(e&&/too big|Couldn/.test(String(e.message||e)))return toast(String(e.message||e))}
    return fxAsk('Open your backups folder','<p>Your manual backups are saved in <b>Documents → MtG-DeckMaster</b> on this phone (automatic backups are in its <b>autosave</b> folder).</p><p class="mut">Open your phone’s <b>Files</b> app and go to Documents → MtG-DeckMaster.</p>',[{t:'OK',cls:'pri'}])}
  fxAsk('Where your backups are','<p>Your browser saves backup files where it saves downloads — usually the <b>Downloads</b> folder — or wherever you picked in the share sheet (e.g. Google Drive or Files).</p><p class="mut">A web page isn’t allowed to open folders on your device. Open your <b>Files</b> app (iPhone: Files → Downloads, Android: Files → Downloads) to find them. Automatic backups on the web version stay inside the browser — see Automatic backups below.</p>',[{t:'OK',cls:'pri'}])}


/* Deck Generator / Optimize: Option A and B fold away; the one you used last stays open (per device) */
function fxAiOpen(k){let s=null;try{s=localStorage.getItem('mtg_aiopt_v1')}catch(e){}if(!s)s=fxKeyAny()?'b':'a';return s===k?'open':''}
function fxAiTog(k,open){if(open){try{localStorage.setItem('mtg_aiopt_v1',k)}catch(e){}}}
/* Single add: start with the last “Pulled from” used on this device (shown in the dropdowns, easy to change) */
function fxLastSrcQ(q){let s='';try{s=localStorage.getItem('mtg_lastsrc_v1')||''}catch(e){}if(!s||isCustomSrc(s))return q;const G=srcData(),g=srcGroup(s);
  if(s==='Singles Orders')return Object.assign(q,{grp:'Singles Orders',sel:'Singles Orders'});if(G[g]&&G[g].includes(s))return Object.assign(q,{grp:g,sel:s});return q}
/* Decks list: a color strip (the deck's colors — commander identity for commander decks) and a small picture of the commander / main card */
const FXCOLHEX={W:'#f3ecc8',U:'#2f7fd0',B:'#6d5a78',R:'#d8402f',G:'#2f9a5a'};
function fxDeckCols(d){const cm=d.commander&&findCard(d.commander);if(cm)return fxCI(cm);const s=new Set();d.cards.forEach(e=>{const c=findCard(e.name)||e;if(!fxBasic(c))fxCI(c).forEach(x=>s.add(x))});return CLR.filter(x=>s.has(x))}
const fxDeckStrip=d=>{const c=fxDeckCols(d);return `<div class="dkstrip" title="${c.length?esc(c.map(x=>CLRN[x]).join(', ')):'Colorless'}">${(c.length?c:['C']).map(x=>`<i style="background:${FXCOLHEX[x]||'#9a9aa6'}"></i>`).join('')}</div>`};
function fxDeckThumb(d){let n=d.commander&&artOf(d.commander)?d.commander:'';if(!n){const e=d.cards.map(e=>({e,c:findCard(e.name)})).filter(x=>x.c&&!/Land/.test(x.c.type||'')&&artOf(x.c.name)).sort((a,b)=>(parseFloat(b.c.cmc)||0)-(parseFloat(a.c.cmc)||0))[0];n=e?e.c.name:''}
  const u=n&&artOf(n);return u?`<img class="dkthumb" loading="lazy" src="${esc(u)}" alt="">`:`<div class="dkthumb" style="display:flex;align-items:center;justify-content:center;font-size:22px">🃏</div>`}
/* Card without a picture: a card-shaped frame tinted with its colors, showing name, mana cost and type */
function fxPh(c){c=c||{};const ci=fxCI(c),hex=ci.map(x=>FXCOLHEX[x]),bg=hex.length>1?`linear-gradient(135deg,${hex.join(',')})`:hex[0]?`linear-gradient(160deg,${hex[0]},#1b1924)`:/Land/.test(c.type||'')?'linear-gradient(160deg,#8a7a5a,#2b261d)':'linear-gradient(160deg,#9a9aa6,#2a2a33)';
  return `<div class="phc" style="--phbg:${bg}"><div class="pht"><span>${esc(c.name||'')}</span><span>${c.cost&&c.cost!=='None'?costHtml(c.cost):''}</span></div><div class="phc-art">${c.custom?'★':/Land/.test(c.type||'')?'⛰':'🂠'}</div><div class="phy">${esc([c.type,c.subtype&&c.subtype!=='None'?c.subtype:''].filter(Boolean).join(' — '))}</div></div>`}
/* ---------- Collection: “⚙ Filter & sort” window (type and color chips, sort) ---------- */
function fxFilterPop(){const L=D.cards,cnt=(k,v)=>L.filter(c=>k==='type'?c.type===v:String(c.colors).includes(v)).length,types=[...new Set(L.map(c=>c.type))].sort();
  const chip=(k,v,lab,n)=>`<button class="fc ${V[k]===v?'on':''}" onclick="V.${k}=V.${k}===${esc(JSON.stringify(v))}?'':${esc(JSON.stringify(v))};render();fxFilterPop()">${lab}${n!=null?` <span style="opacity:.7">${n}</span>`:''}</button>`;
  const shown=()=>{const q=(V.q||'').toLowerCase();return L.filter(c=>(!q||c.name.toLowerCase().includes(q)||String(c.text||'').toLowerCase().includes(q))&&(!V.type||(V.type==='__custom'?c.custom:V.type==='__unknown'?c.legMiss&&!c.custom:c.type===V.type))&&(!V.color||String(c.colors).includes(V.color))).length};
  const body=`<div class="fpop"><h3 style="margin:0">Filter &amp; sort</h3>
  <h4>Card type</h4><div class="chips">${types.map(t=>chip('type',t,esc(t),cnt('type',t))).join('')}${L.some(c=>c.custom)?chip('type','__custom','★ Custom cards',L.filter(c=>c.custom).length):''}${L.some(c=>c.legMiss&&!c.custom)?chip('type','__unknown','? Not found on Scryfall',L.filter(c=>c.legMiss&&!c.custom).length):''}</div>
  <h4>Color</h4><div class="chips">${['White','Blue','Black','Red','Green','Colorless','Land'].map(x=>chip('color',x,esc(x),cnt('color',x))).join('')}</div>
  <h4>Sort by</h4><select style="width:100%" onchange="fxSetSort(this.value);render();fxFilterPop()">${FXSORT.map(([k,l])=>`<option value="${k}" ${fxSortKey()===k?'selected':''}>${esc(l.replace(/^Sort: /,''))}</option>`).join('')}</select>
  <div class="row" style="margin-top:16px"><button onclick="V.type=V.color='';fxSetSort('');render();fxFilterPop()">Clear all</button><button class="pri" onclick="closeM()">Show ${shown()} card${shown()===1?'':'s'}</button></div></div>`;
  if($('#modal').classList.contains('open')&&$('.fpop')){KEEPSCROLL=true;openM(body)}else openM(body)}

/* ---------- send my collection to my other device ---------- */
async function fxSendDevice(){if(!D.uid)fxIdentity();if(!D.keys)await fxKeys();
  if(!(await ask('Send your whole collection to another phone, tablet or computer of yours?\n\nThis is a full private backup — it includes the secret key that signs your share files. Only send it to yourself (for example to your own email, Google Drive or Quick Share).\n\nOn the other device: open MtG DeckMaster → More → My profile → “Open a file”, or the welcome screen’s “Restore my backup”.')))return;
  const keys=fxKeyAny()&&await ask(`Also send your saved API key${Object.keys(fxKeys0()).length>1?'s':''} (${fxKeyList()})?\n\nOK = yes, so you don’t have to type it on the other device\nCancel = no`);
  const j=Object.assign(JSON.parse(JSON.stringify(D)),{xfer:{from:isNative()?'Android app':(/iPhone|iPad/i.test(navigator.userAgent)?'iPhone / iPad':'web browser'),at:Date.now()}});
  await fxSend(fxWithImgs(j,keys),`${fxPrefix()}to-my-device_${tsName()}.json`);try{localStorage.setItem(BK,today());localStorage.removeItem(DY)}catch(e){}}
function fxGotDevice(j){const same=D.uid&&j.uid===D.uid,empty=!D.cards.length&&!D.decks.length,newer=!D.updated||(j.updated||0)>=D.updated,when=x=>x?new Date(x).toLocaleString():'unknown';
  const body=`<div class="sec">${fxWho(j.owner,j.uid)}<br><span class="mut">Sent from your ${esc(j.xfer.from)} · ${esc(when(j.xfer.at))}</span></div>
  ${tbl(['','On this device','In the file'],[['Card titles',D.cards.length,j.cards.length],['Decks',D.decks.length,j.decks.length],['Last changed',when(D.updated),when(j.updated)]])}
  ${empty?'':same?(newer?'<p>The file is <b>newer</b> than this device. Updating replaces what is here with it.</p>':'<p style="color:#ff6b6b"><b>⚠ This device has newer changes than the file.</b> Updating would lose them. Usually you want to send from <i>this</i> device to the other one instead.</p>'):`<p style="color:#f39c12">This device has a <b>different collection</b> (${fxWho(D.owner,D.uid)}). Updating replaces it with the one in the file — back it up first if you want to keep it.</p>`}`;
  fxAsk(empty?'Your collection from another device':'Update this device?',body,[{t:empty?'Use it on this device':'Update this device',cls:same&&!newer?'danger':'pri',fn:async()=>{if(D.cards.length&&!same&&!(await ask('Replace the collection on this device? It cannot be undone unless you have a backup.')))return;delete j.xfer;fxRestore(j)}},{t:'Cancel'}])}

/* ---------- deck rules: legality, copy limits, commander colors, deck size ---------- */
// Color identity (Commander rule 903.4): every colored mana symbol in the mana cost and rules text (reminder text in parentheses doesn't count).
// Scryfall's color_identity (c.ci) is used when known; otherwise it is worked out from the card, plus any color names in the "colors" field.
function fxCI(c){if(!c)return [];if(Array.isArray(c.ci))return c.ci;const out=new Set();
  String(c.colors||'').split(/[\/,\s]+/).forEach(x=>{if(N2L[x])out.add(N2L[x])});
  const txt=String(c.cost||'')+' '+String(c.text||'').replace(/\([^)]*\)/g,' ');(txt.match(/\{[^}]+\}/g)||[]).forEach(m=>(m.match(/[WUBRG]/g)||[]).forEach(x=>out.add(x)));
  return ['W','U','B','R','G'].filter(x=>out.has(x))}
const fxIdCols=c=>fxCI(c);
function fxCardIssues(c,qty,F,cmdC){if(!F||!c)return [];const out=[],st=F.leg&&c.leg?c.leg[F.leg]:undefined,cap=copyCap(c,F);
  if(c.custom&&F.leg)out.push({kind:'custom',title:'Custom card',msg:`${c.name} is marked as a custom card (a proxy, homebrew or playtest card). Custom cards aren’t legal in ${F.k} games or events — fine for casual play with friends who agree.`});
  else if(c.legMiss&&!c.custom&&!c.leg)out.push({kind:'unknown',title:'Not found on Scryfall',msg:`Scryfall doesn’t recognise “${c.name}”, so its rules can’t be checked.${c.legSug?` Did you mean ${c.legSug}?`:''} It may be misspelled, or it may be a custom card.`});
  if(F.leg&&c.leg&&st==='b')out.push({kind:'banned',title:`Banned in ${F.k}`,msg:`${c.name} is on the ${F.k} banned list, so a deck that includes it can’t be played in ${F.k} games or events.`});
  else if(F.leg&&c.leg&&!st)out.push({kind:'notlegal',title:`Not legal in ${F.k}`,msg:`${c.name} isn’t part of the ${F.k} card pool${/Standard|Alchemy/.test(F.k)?' — it has rotated out, or was never in a set that is legal there':/Pauper/.test(F.k)?' — it has never been printed at common':F.k==='Pioneer'?' — it was only printed before Return to Ravnica (2012)':F.k==='Modern'?' — it was only printed before Eighth Edition (2003)':F.k==='Premodern'?' — it wasn’t printed between Fourth Edition and Scourge':''}.`});
  if(qty>cap&&cap<999)out.push(st==='r'?{kind:'restricted',title:`Restricted in ${F.k}`,msg:`${c.name} is on the ${F.k} restricted list: a deck may include only 1 copy. This deck has ${qty}.`,cap}:{kind:'copies',title:`Too many copies (${qty})`,msg:`${F.single?F.k+' is a singleton format: only 1 copy of each card, except basic lands.':F.k+' allows up to '+cap+' copies of a card, except basic lands.'} This deck has ${qty}.`,cap});
  if(F.cmd&&cmdC&&norm(c.name)!==norm(cmdC.name)){const cc=fxIdCols(cmdC);if(!okColor(c,cc))out.push({kind:'color',title:'Outside the commander’s colors',msg:`${F.k} decks may only use cards inside the ${F.cmdLabel.toLowerCase()}’s color identity (${cc.length?cc.map(x=>CLRN[x]).join(', '):'colorless'}). ${c.name} is ${fxCI(c).map(x=>CLRN[x]).join('/')||'colorless'}.`})}
  return out}
function deckIssues(i){const d=D.decks[i],F=d&&dfmt(d.format);if(!F)return [];const L=fxDeckCards(i),tot=sum(L),ign=d.ok||[],out=[],cmdC=d.commander&&findCard(d.commander),
  add=(card,x,fixes)=>out.push(Object.assign({card,fixes,ign:ign.includes(x.kind+'|'+norm(card||''))},x));
  if(tot>F.n)add('',{kind:'size',title:`${tot} cards — ${F.k} decks hold ${F.n}`,msg:`${F.single?F.k+' decks must have exactly '+F.n+' cards.':'This app keeps '+F.k+' decks at '+F.n+' cards.'} This deck has ${tot-F.n} too many.`},[{t:'Open the card picker',a:'pick'}]);
  if(F.cmd){if(!d.commander)add('',{kind:'nocmd',title:`No ${F.cmdLabel.toLowerCase()} chosen`,msg:`${F.k} decks are built around a ${F.cmdLabel.toLowerCase()} (${F.cmdRule}). Choose one so the color rules can be checked.`},[{t:'Choose one',a:'edit'}]);
    else if(cmdC&&!cmdOK(cmdC,F))add(d.commander,{kind:'badcmd',title:`${cmdC.name} can’t be the ${F.cmdLabel.toLowerCase()}`,msg:`In ${F.k} the ${F.cmdLabel.toLowerCase()} must be ${F.cmdRule}. ${cmdC.name} is a ${cmdC.type}.`},[{t:'Choose another',a:'edit'}])}
  L.forEach(e=>{const c=findCard(e.name);if(!c)return;fxCardIssues(c,e.qty,F,cmdC).forEach(x=>add(c.name,x,x.kind==='unknown'?[...(c.legSug?[{t:'Use '+c.legSug,a:'sug'}]:[]),{t:c.legSug?'Something else':'Find a match',a:'match'},{t:'Mark as custom card',a:'custom'}]:x.cap?[{t:`Reduce to ${x.cap}`,a:'cut',n:e.qty-x.cap}]:[{t:'Remove from deck',a:'cut',n:e.qty}]))});
  return out}
function fxIssueTag(d){const i=D.decks.indexOf(d),L=deckIssues(i),a=L.filter(x=>!x.ign).length,g=L.length-a;
  if(d.override)return `<br><button class="ovtag" onclick="event.stopPropagation();V.deck=${i};render();fxIssues(${i})">⛔ Override on — not legal for ${esc(d.format)}${L.length?' · '+fxPl(L.length,'rule issue'):''} · View</button>`;
  if(!L.length)return '';
  return `<br><button class="ovtag w${a?'':' g'}" onclick="event.stopPropagation();V.deck=${i};render();fxIssues(${i})">⚠ ${a?fxPl(a,'rule issue')+' for '+esc(d.format):''}${a&&g?' · ':''}${g?g+' ignored':''} · View</button>`}
function fxIssueBox(i){const all=deckIssues(i),d=D.decks[i];
  if(d.override)return `<div class="ovbox"><b style="color:#ff8a80">⛔ Override on — this deck isn’t legal for ${esc(d.format)}</b><p style="margin:6px 0">${all.length?`${fxPl(all.length,'rule issue')}: ${esc(all.slice(0,3).map(x=>x.title+(x.card&&!x.title.includes(x.card)?' ('+x.card+')':'')).join('; '))}${all.length>3?'…':''}`:'No cards break the rules right now, but the override stays on until you turn it off.'}</p><div class="row" style="margin:0"><button class="pri" onclick="fxIssues(${i})">See all cards in violation</button><button onclick="fxOverrideOff(${i})">Turn override off</button></div></div>`;
  if(!all.length)return '';const L=all.filter(x=>!x.ign),g=all.length-L.length;
  if(!L.length)return `<div class="sec" style="display:flex;gap:10px;align-items:center"><span class="mut" style="flex:1">⚠ ${fxPl(g,'ignored rule issue')} for ${esc(d.format)}</span><button onclick="fxIssues(${i})">Inspect</button></div>`;
  return `<div class="warn" style="display:flex;gap:10px;align-items:center"><span style="flex:1">⚠ <b>${fxPl(L.length,'rule issue')}</b> for ${esc(d.format)}${g?` <span class="mut">(+${g} ignored)</span>`:''}: ${esc(L.slice(0,3).map(x=>x.title+(x.card&&!x.title.includes(x.card)?' ('+x.card+')':'')).join('; '))}${L.length>3?'…':''}</span><button onclick="fxIssues(${i})">Inspect</button></div>`}
function fxIssues(i){const d=D.decks[i],L=deckIssues(i).sort((a,b)=>a.ign-b.ign);window.FXISS=L;if(!L.length&&!d.override){closeM();return toast('No rule issues left')}
  openM(`<h3>⚠ ${esc(d.name)} — ${esc(d.format)} rules</h3>${d.override?`<div class="ovbox" style="margin-top:0">⛔ <b>Override on</b> since ${esc(d.overrideAt||'')} — rule-breaking cards can be added to this deck. <button style="padding:4px 10px;margin-left:6px" onclick="fxOverrideOff(${i},true)">Turn off</button></div>`:''}<p class="mut">The deck can still be used as it is. Removing cards here is staged like any other edit: tap <b>Save changes</b> afterwards.</p>
  ${L.map((x,k)=>`<div class="sec" style="${x.ign?'opacity:.75':''}"><b>${esc(x.title)}</b>${x.card&&!x.title.includes(x.card)?` — ${cl(x.card)}`:''}${x.ign?' <span class="mut" style="font-size:12px">· ignored</span>':''}<p style="margin:6px 0">${esc(x.msg)}</p><div class="row" style="margin:0">${x.fixes.map((f,j)=>`<button class="pri" style="padding:7px 12px" onclick="fxFix(${i},${k},${j})">${esc(f.t)}</button>`).join('')}<button style="padding:7px 12px" onclick="fxFix(${i},${k},-1)">${x.ign?'Stop ignoring':'Ignore this'}</button></div></div>`).join('')}
  <div class="row"><button onclick="fxDeckEdit(${i})">Change deck type…</button><button class="pri" onclick="closeM()">Done</button></div>`)}
async function fxFix(i,k,j){const x=(window.FXISS||[])[k],d=D.decks[i];if(!x)return;
  if(j<0){if(!(await ask(x.ign?`Stop ignoring “${x.title}”?`:`Ignore “${x.title}”${x.card?' for '+x.card:''}?\n\nIt stays listed (muted) and the deck stops showing ⚠ for it.`)))return;const key=x.kind+'|'+norm(x.card||'');d.ok=(d.ok||[]).filter(k=>k!==key);if(!x.ign)d.ok.push(key);save();render();return fxIssues(i)}
  const f=x.fixes[j];if(f.a==='match')return fxMatchUnknown(x.card,()=>{render();fxIssues(i)});if(f.a==='sug')return fxUseSug(x.card,()=>{render();fxIssues(i)});if(f.a==='custom'){fxSetCustom(x.card,true);return fxIssues(i)}if(f.a==='edit')return fxDeckEdit(i);if(f.a==='pick'){closeM();return fxBuilder(true)}
  if(f.a==='cut'){fxDraftChg(i,x.card,-f.n);toast(`Staged: −${f.n} ${x.card} — tap Save changes to apply`);return fxIssues(i)}}

const fxDeckNeedsLeg=i=>{const d=D.decks[i],F=d&&dfmt(d.format);if(!F||!F.leg)return [];return fxDeckCards(i).map(e=>findCard(e.name)).filter(c=>c&&isReal(c)&&!c.custom&&(!c.leg||F.cmd&&!c.ci)&&!c.legMiss)};
async function fxLegalCheck(i,list,quiet){const d=D.decks[i];if(!d||RO)return true;const need=list||fxDeckNeedsLeg(i);
  if(!need.length){if(d.legPending){d.legPending=false;save();render()}return true}
  const ok=await ensureLegal(need);
  if(ok){d.legPending=false;save();render();if(!quiet)toast(`${d.name}: rules checked`);return true}
  if(!d.legPending){d.legPending=true;save()}render();return false}
function fxLegalBox(i){const d=D.decks[i],need=fxDeckNeedsLeg(i);
  if(need.length&&!RO&&!(V.legTry||{})[d.name]){V.legTry=V.legTry||{};V.legTry[d.name]=1;setTimeout(()=>fxLegalCheck(i,null,true),0)}
  if(!need.length&&d.legPending){d.legPending=false;save()}
  if(!d.legPending||!need.length)return '';
  return `<div class="sec" style="display:flex;gap:10px;align-items:center;border:1px solid #4a6aa8"><span style="flex:1">⏳ <b>${fxPl(need.length,'card')}</b> haven’t been checked against the ${esc(d.format)} rules yet — this needs an internet connection.</span><button onclick="fxLegalCheck(${i})">Check now</button></div>`}

/* ---------- cards Scryfall doesn't recognise: find a match, or mark as a custom card ---------- */
async function fxSetCustom(name,on,ok){const c=findCard(name);if(!c)return;if(!ok&&!(await ask(on?`Mark ${c.name} as a custom card?\n\nIt moves to the Custom cards group and is filed under “Custom Cards”.`:`Unmark ${c.name} as a custom card?`)))return;c.custom=!!on;{const ss=cardSources(c).filter(x=>!isCustomSrc(x));if(on)ss.push(CUSTOM_SRC);c.source=ss.length?ss.join(', '):'None'}if(on){delete c.legMiss;c.leg=null}else{c.legMiss=today()}logEdit(c.name,'Custom card',on?'no':'yes',on?'yes':'no');save();render();toast(on?`${c.name} is now in your Custom cards group — you can add a photo of it`:`${c.name} is no longer marked custom`)}
function fxUnknownBox(c){if(!c||RO||!findCard(c.name))return '';
  if(c.custom)return `<div class="sec"><b style="color:#c39bff">★ Custom card</b><p class="mut" style="margin:4px 0">Kept in your Custom cards group. The app doesn’t look it up on Scryfall, and it’s flagged as not legal in official formats. Add your own photo so it shows like any other card — it’s compressed (about 60 KB) and included in your backups and share files.</p><div class="row" style="margin:6px 0 0"><button onclick="fxCustomEdit('${esc(c.name).replace(/'/g,"\\'")}')">✎ Edit card details</button></div><div class="row" style="margin:6px 0 0"><button class="pri" onclick="fxCustomPhoto('${esc(c.name).replace(/'/g,"\\'")}')">📷 ${CIMG[c.name]?'Retake photo':'Take a photo of this card'}</button>${CIMG[c.name]?`<button onclick="fxCustomPhotoDel('${esc(c.name).replace(/'/g,"\\'")}')">Remove photo</button>`:''}</div><button style="margin-top:8px" onclick="fxUnmarkCustom('${esc(c.name).replace(/'/g,"\\'")}')">It’s a real card — unmark</button></div>`;
  if(!c.legMiss||c.leg)return '';
  const q=esc(c.name).replace(/'/g,"\\'");
  return `<div class="warn"><b>? Scryfall doesn’t recognise this card</b><p style="margin:4px 0">${c.legSug?`Did you mean <b>${esc(c.legSug)}</b>?`:'It may be misspelled, or it may be a custom card (proxy, homebrew, playtest).'}</p><div class="row" style="margin:0">${c.legSug?`<button class="pri" onclick="fxUseSug('${q}')">Yes — update my card</button>`:''}<button class="${c.legSug?'':'pri'}" onclick="fxMatchUnknown('${esc(c.name).replace(/'/g,"\\'")}')">${c.legSug?'Something else':'Find a match'}</button><button onclick="fxSetCustom('${esc(c.name).replace(/'/g,"\\'")}',true);showCard('${esc(c.name).replace(/'/g,"\\'")}')">Mark as custom card</button></div></div>`}
function fxUnknownList(){const L=D.cards.filter(c=>isReal(c)&&c.legMiss&&!c.leg&&!c.custom),C=D.cards.filter(c=>c.custom);let h='';
  if(L.length)h+=`<div class="sec"><h4>Not found on Scryfall (${L.length})</h4><p class="mut" style="margin:0 0 6px">Check each one: it may be misspelled, or it may be a custom card.</p>${L.map(c=>`<div class="kv"><span>${cl(c.name)}${c.legSug?`<br><span class="mut" style="font-size:12px">Did you mean ${esc(c.legSug)}? <button style="padding:2px 8px" onclick="fxUseSug('${esc(c.name).replace(/'/g,"\\'")}',()=>render())">Yes</button></span>`:''}</span><b><button style="padding:4px 8px" onclick="fxMatchUnknown('${esc(c.name).replace(/'/g,"\\'")}')">Find a match</button> <button style="padding:4px 8px" onclick="fxSetCustom('${esc(c.name).replace(/'/g,"\\'")}',true)">Custom</button></b></div>`).join('')}</div>`;
  if(C.length)h+=`<div class="sec"><h4>★ Custom cards (${C.length})</h4><p class="mut" style="margin:0">${C.map(c=>cl(c.name)).join(', ')}</p></div>`;return h}
// Try to match the card: exact name → close spelling (fuzzy) → list of similar names. Matching updates the EXISTING card (never creates a new one).
async function fxMatchUnknown(name,after){const e=findCard(name);if(!e)return;const done=after||(()=>showCard(e.name)),nm=front(e.name);
  openM(`<h3>Finding “${esc(e.name)}”…</h3><p class="mut">Checking Scryfall.</p>`);
  let c=await scry('/cards/named?exact='+encodeURIComponent(nm));
  if(c&&c.object==='card'){delete e.legMiss;e.leg=legOf(c.legalities);e.legAt=today();fxSetPrice(e,c);if(!ART[e.name]){ART[e.name]=sImg(c);saveArt()}save();if(!verifyEntry(e,c,done)){closeM();toast(`Found it — ${e.name} is now checked`);done()}return}
  if(c===null&&!navigator.onLine){closeM();return toast('You’re offline — try again when connected')}
  c=await scry('/cards/named?fuzzy='+encodeURIComponent(nm));const ac=await scry('/cards/autocomplete?q='+encodeURIComponent(nm.slice(0,Math.max(3,Math.min(nm.length,12)))));
  const opts=[...new Set([...(c&&c.object==='card'?[c.name]:[]),...((ac&&ac.data)||[])])].slice(0,6);window.FXUNK={name:e.name,done,opts};
  openM(`<h3>Which card is “${esc(e.name)}”?</h3><p class="mut">Scryfall has no card with exactly that name. ${opts.length?'Is it one of these? Choosing one updates your existing card — no duplicate is created.':'No close matches were found.'}</p>
  ${opts.map((o,k)=>`<div class="res" onclick="fxPickMatch(${k})"><span>${esc(o)}</span><b>Use this</b></div>`).join('')}
  <div class="f"><label>Or search by another name</label><input id="unkq" value="${esc(nm)}"></div><div class="row"><button onclick="fxSearchUnknown()">Search</button></div>
  <div class="row"><button onclick="closeM()">Cancel</button><button class="pri" onclick="closeM();fxSetCustom(FXUNK.name,true);FXUNK.done()">★ Mark as custom card</button></div>`)}
async function fxSearchUnknown(){const q=($('#unkq').value||'').trim();if(!q)return;const ac=await scry('/cards/autocomplete?q='+encodeURIComponent(q));FXUNK.opts=((ac&&ac.data)||[]).slice(0,8);
  const box=FXUNK.opts.map((o,k)=>`<div class="res" onclick="fxPickMatch(${k})"><span>${esc(o)}</span><b>Use this</b></div>`).join('')||'<p class="mut">No cards found with that name.</p>';
  document.querySelectorAll('#mbody .res').forEach(x=>x.remove());$('#mbody .f').insertAdjacentHTML('beforebegin',box)}
async function fxPickMatch(k){const o=FXUNK.opts[k],e=findCard(FXUNK.name);if(!o||!e)return;const c=await scry('/cards/named?exact='+encodeURIComponent(o));if(!c||c.object!=='card')return toast('Couldn’t load that card — check your connection');
  if(!(await ask(`Update your existing card “${e.name}” to “${c.name}”?\n\nQuantity, finishes, sources and decks are kept.`)))return;
  const old=e.name;renameCard(old,c.name);const n=findCard(c.name)||e;delete n.legMiss;delete n.legSug;n.leg=legOf(c.legalities);n.legAt=today();fxSetPrice(n,c);
  ART[n.name]=sImg(c)||ART[n.name]||'';saveArt();const f=fullDiff(n,c,false);if(f.length)applyDiffs(n,f);save();closeM();toast(`Updated: ${old} → ${c.name}`);(FXUNK.done===undefined?()=>showCard(n.name):()=>{try{FXUNK.done()}catch(_){showCard(n.name)}})()}
function fxUseSug(name,after){const c=findCard(name);if(!c||!c.legSug)return fxMatchUnknown(name,after);window.FXUNK={name:c.name,done:after||(()=>showCard(c.legSug)),opts:[c.legSug]};fxPickMatch(0)}

/* ---------- foil display ---------- */
const fxHasFoil=c=>{if(fxBasic(c))return false;try{const fm=finMapOf(c);return Object.keys(fm).some(k=>/foil/i.test(k)&&fm[k]>0)}catch(e){return false}};
function fxFinLabel(p){const f=p.finishes||[],nf=f.includes('nonfoil'),fo=f.includes('foil'),et=f.includes('etched');
  const t=[nf&&'Normal',fo&&'✦ Foil',et&&'✦ Etched'].filter(Boolean);if(!t.length)return '';const only=t.length===1;
  return `<i class="fin ${nf&&only?'n':'f'}">${only&&!nf?t[0]+' only':t.join(' + ')}</i>`}

/* ---------- custom card photos (stored in IndexedDB; ~60 KB JPEG each; included in backups and share files) ---------- */
const fxIdb=()=>new Promise((ok,no)=>{const r=indexedDB.open('mtg_imgs',1);r.onupgradeneeded=()=>r.result.createObjectStore('i');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
const fxIdbDo=(mode,fn)=>fxIdb().then(db=>new Promise((ok,no)=>{const t=db.transaction('i',mode),r=fn(t.objectStore('i'));t.oncomplete=()=>{db.close();ok(r&&r.result)};t.onerror=()=>{db.close();no(t.error)}}));
async function fxImgLoad(){try{const keys=await fxIdbDo('readonly',st=>st.getAllKeys()),vals=await fxIdbDo('readonly',st=>st.getAll());keys.forEach((k,n)=>{CIMG[k]=vals[n]});return keys.length}catch(e){return 0}}
const fxImgPut=(k,v)=>{if(!RO)fxIdbDo('readwrite',st=>st.put(v,k)).catch(()=>toast('Couldn’t save the photo (storage full?)'))};
const fxImgDel=k=>{if(!RO)fxIdbDo('readwrite',st=>st.delete(k)).catch(()=>{})};
function fxWithImgs(o,keys){const im={},add={};(o.cards||[]).forEach(c=>{if(c.custom&&CIMG[c.name])im[c.name]=CIMG[c.name]});if(Object.keys(im).length)add.customImgs=im;if(keys&&fxKeyAny())add.aiKeys=fxKeys0();return JSON.stringify(Object.keys(add).length?Object.assign({},o,add):o)}
function fxImgsIn(j){if(j&&j.aiKeys)fxKeysIn(j,true);const im=j&&j.customImgs;if(!im)return;Object.keys(im).forEach(k=>{if(/^data:image\//.test(im[k])){CIMG[k]=im[k];fxImgPut(k,im[k])}});delete j.customImgs}
function fxCompress(blob){return new Promise((ok,no)=>{const u=URL.createObjectURL(blob),im=new Image();im.onerror=()=>{URL.revokeObjectURL(u);no(new Error('image'))};
  im.onload=()=>{URL.revokeObjectURL(u);const R=63/88;let sx=0,sy=0,sw=im.naturalWidth,sh=im.naturalHeight;
    if(!blob.cropped){if(sw/sh>R){const w=sh*R;sx=(sw-w)/2;sw=w}else{const h=sw/R;sy=(sh-h)/2;sh=h}}
    const W=490,H=684,cv=document.createElement('canvas');cv.width=W;cv.height=H;const x=cv.getContext('2d');x.imageSmoothingQuality='high';x.fillStyle='#000';x.fillRect(0,0,W,H);x.drawImage(im,sx,sy,sw,sh,0,0,W,H);
    let q=0.82,url=cv.toDataURL('image/jpeg',q);while(url.length*0.75>65000&&q>0.42){q-=0.08;url=cv.toDataURL('image/jpeg',q)}ok(url)};im.src=u})}
function fxCustomPhoto(name){closeM();fxCam(b=>fxCustomPhotoSet(name,b))}
async function fxCustomPhotoSet(name,b){{const c=findCard(name);if(!c||!b)return;if(!(await ask(`Use this picture for ${c.name}?${CIMG[c.name]?'\n\nIt replaces the current picture.':''}`)))return;let url;try{url=await fxCompress(b)}catch(e){return toast('Couldn’t read that photo')}
  CIMG[c.name]=url;fxImgPut(c.name,url);c.imgAt=Date.now();save();render();showCard(c.name);toast(`Picture saved (${Math.round(url.length*0.75/1024)} KB)`)}}
async function fxCustomPhotoDel(name){const c=findCard(name);if(!c||!(await ask(`Remove the photo of ${c.name}?`)))return;delete CIMG[c.name];fxImgDel(c.name);c.imgAt=Date.now();save();render();showCard(c.name)}

/* ---------- rule override: two approvals, once per deck ---------- */
function fxAddProblems(i,name,dl){const d=D.decks[i],F=dfmt(d.format);if(!F)return [];const L=fxDeckCards(i),tot=sum(L),out=[],c=findCard(name),cmdC=d.commander&&findCard(d.commander);
  if(tot+dl>F.n)out.push(`The deck would have ${tot+dl} cards — ${F.k} decks hold ${F.n}`);
  if(c){const have=sum(L.filter(e=>norm(e.name)===norm(c.name)));fxCardIssues(c,have+dl,F,cmdC).filter(x=>x.kind!=='unknown').forEach(x=>out.push(`${x.title}${x.title.includes(c.name)?'':' ('+c.name+')'}`))}
  return [...new Set(out)]}
async function fxOverrideAsk(i,name,pr){const d=D.decks[i],F=dfmt(d.format);
  if(!(await ask(`Adding ${name} breaks the ${F.k} rules:\n\n• ${pr.join('\n• ')}\n\nOverride the rules for “${d.name}”?\n\nOK = override\nCancel = don’t add it`)))return false;
  if(!(await ask(`Are you really sure?\n\n“${d.name}” will be marked as NOT legal for ${F.k}. Rule-breaking cards (banned, extra copies, custom cards, too many cards…) can then be added to it.\n\nThe deck will always show an “Override on” warning, and you can tap it to see every card that breaks the rules.\n\nOK = yes, override this deck\nCancel = don’t add it`)))return false;
  d.override=true;d.overrideAt=today();save();toast(`Override on for ${d.name}`);return true}
async function fxOverrideOff(i,inModal){const d=D.decks[i],n=deckIssues(i).length;
  if(!(await ask(`Turn the rule override off for “${d.name}”?\n\n${n?`The ${fxPl(n,'card or rule issue')} already in the deck stay, and stay flagged. `:''}New rule-breaking cards will need two approvals again.`)))return;
  d.override=false;delete d.overrideAt;save();render();if(inModal)fxIssues(i);toast('Override turned off')}

/* ---------- app updates ----------
   Android app: checks GitHub Releases (at most once a day, or by hand in More → App updates), downloads the new APK inside the app
   with the local ApkUpdater plugin, then opens Android's own Install screen (Android always asks the user to tap Install).
   Web version: the site updates itself; the app compares the live index.html / features.js with what it loaded and offers a reload. */
const FX_REL='https://api.github.com/repos/Dakeera/mtg-collection/releases?per_page=10',FX_UPDK='mtg_updchk_v1';
let UPD=null,UPDST={checked:0,msg:'',busy:false,cur:null,hide:''},WEBUPD=false,WEBH=null;
const fxUpdP=()=>window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.ApkUpdater;
async function fxUpdCur(){if(UPDST.cur)return UPDST.cur;try{const i=await window.Capacitor.Plugins.App.getInfo();UPDST.cur={v:i.version,b:parseInt(i.build)||0}}catch(e){UPDST.cur={v:'?',b:0}}return UPDST.cur}
async function fxUpdCheck(manual){if(!isNative())return;UPDST.busy=true;UPDST.msg='Checking GitHub for a newer version…';if(V.sub==='updates')render();
  try{const cur=await fxUpdCur(),r=await fetch(FX_REL,{headers:{Accept:'application/vnd.github+json'},cache:'no-store'});if(!r.ok)throw new Error('GitHub answered '+r.status);
    const rels=(await r.json()).filter(x=>!x.draft&&!x.prerelease&&/^android-v1\.\d+$/.test(x.tag_name)).map(x=>({n:+x.tag_name.split('.')[1],x})).sort((a,b)=>b.n-a.n),top=rels[0];
    const a=top&&(top.x.assets||[]).find(a=>/\.apk$/i.test(a.name));
    UPD=top&&a&&top.n>cur.b?{n:top.n,url:a.browser_download_url,name:a.name,size:a.size,date:(top.x.published_at||'').slice(0,10),notes:top.x.body||''}:null;
    UPDST.checked=Date.now();try{localStorage.setItem(FX_UPDK,String(UPDST.checked))}catch(e){}
    UPDST.msg=UPD?`Version 1.${UPD.n} is available (you have ${cur.v}).`:`You’re up to date (version ${cur.v}).`;if(manual&&!UPD)toast('You’re up to date')}
  catch(e){UPDST.msg='Couldn’t check for updates — '+(navigator.onLine?String(e&&e.message||e).slice(0,80):'you’re offline')+'.';if(manual)toast(UPDST.msg)}
  UPDST.busy=false;render()}
function fxUpdBanner(){if(RO)return '';
  if(isNative()&&UPD&&UPDST.hide!==String(UPD.n)&&V.sub!=='updates')return `<div class="sec" id="updban" style="border:1px solid var(--ac)"><b>⬆ Update 1.${UPD.n} is available</b><p class="mut" style="margin:4px 0">Your collection stays on the phone — updating doesn’t touch it.</p><div class="row" style="margin:0"><button class="pri" onclick="fxUpdRun()">Update now</button><button onclick="UPDST.hide='${UPD.n}';render()">Later</button></div><p class="mut" style="margin:8px 0 0;font-size:12px">Tip: make a backup first, just in case. <button style="padding:3px 9px" onclick="fxUpdBackup()">💾 Back up now</button></p></div>`;
  if(!isNative()&&WEBUPD&&UPDST.hide!=='web')return `<div class="sec" id="updban" style="border:1px solid var(--ac)"><b>⬆ A new version of MtG DeckMaster is ready</b><p class="mut" style="margin:4px 0">Reload to start using it. Your collection is kept.</p><div class="row" style="margin:0"><button class="pri" onclick="fxWebReload()">Reload now</button><button onclick="UPDST.hide='web';render()">Later</button></div><p class="mut" style="margin:8px 0 0;font-size:12px">Tip: make a backup first, just in case. <button style="padding:3px 9px" onclick="fxUpdBackup()">💾 Back up now</button></p></div>`;
  return ''}
// Backup that doesn't leave the update banner: saves straight away and the banner stays where it is.
async function fxUpdBackup(){try{await doBackup(false)}catch(e){toast('Backup failed')}}
function fxWebReload(){try{navigator.serviceWorker&&navigator.serviceWorker.getRegistration().then(r=>r&&r.update()).finally(()=>location.reload())}catch(e){location.reload()}}
async function fxUpdRun(){const P=fxUpdP();if(!UPD)return;if(!P)return toast('This app build can’t update itself yet — download the new version from GitHub Releases once, and later updates will work from here');
  const ov=document.createElement('div');ov.id='updov';ov.style.cssText='position:fixed;inset:0;background:#000d;z-index:96;display:flex;align-items:center;justify-content:center;padding:20px';
  ov.innerHTML=`<div class="sheet" style="margin:0;width:100%;max-width:420px"><h3 style="margin-top:0">Downloading update 1.${UPD.n}…</h3><p class="mut" id="updt">Starting…</p><div class="pbar"><i id="updb" style="width:2%"></i></div><div class="row" id="updbtns"></div></div>`;document.body.appendChild(ov);
  const set=(t,w)=>{const x=$('#updt'),b=$('#updb');if(x)x.textContent=t;if(b&&w!=null)b.style.width=w+'%'},btns=h=>{const b=$('#updbtns');if(b)b.innerHTML=h};
  let lis=null;try{lis=await P.addListener('progress',p=>{const tot=p.total>0?p.total:UPD.size||0;set(`${(p.done/1048576).toFixed(1)} of ${tot?(tot/1048576).toFixed(1):'?'} MB`,tot?Math.max(2,Math.round(p.done/tot*100)):null)})}catch(e){}
  let f;try{f=await P.download({url:UPD.url,name:UPD.name})}catch(e){if(lis)lis.remove();set(String(e&&e.message||e));return btns('<button class="pri" onclick="this.closest(\'#updov\').remove();fxUpdRun()">Try again</button><button onclick="this.closest(\'#updov\').remove()">Close</button>')}
  if(lis)lis.remove();set('Downloaded. Opening Android’s install screen…',100);window.FXUPDF=f.path;fxUpdInstall()}
async function fxUpdInstall(){const P=fxUpdP(),ov=$('#updov');if(!P||!ov)return;const x=$('#updt'),b=$('#updbtns');let r;
  try{r=await P.install({path:window.FXUPDF})}catch(e){x.textContent=String(e&&e.message||e);b.innerHTML='<button onclick="this.closest(\'#updov\').remove()">Close</button>';return}
  if(r&&r.needsPermission){x.innerHTML='Android needs your permission first (only once):<br>1. Tap <b>Open settings</b>.<br>2. Turn on <b>Allow from this source</b>.<br>3. Come back here and tap <b>Install</b>.';
    b.innerHTML='<button onclick="fxUpdP().openInstallSettings()">Open settings</button><button class="pri" onclick="fxUpdInstall()">Install</button><button onclick="this.closest(\'#updov\').remove()">Cancel</button>';return}
  x.innerHTML='Android’s install screen is open — tap <b>Install</b> (or <b>Update</b>). The app restarts on the new version with your collection kept.<br><br>If nothing appeared, tap Install again.';
  b.innerHTML='<button class="pri" onclick="fxUpdInstall()">Install</button><button onclick="this.closest(\'#updov\').remove()">Close</button>'}
function fxUpdView(){const c=UPDST.cur;if(!c)fxUpdCur().then(()=>{if(V.sub==='updates')render()});const last=+(localStorage.getItem(FX_UPDK)||0);
  return `<div class="sec"><div class="kv"><span>Installed version</span><b>${c?esc(c.v):'…'}</b></div><div class="kv"><span>Last checked</span><b>${last?esc(new Date(last).toLocaleString()):'never'}</b></div></div>
  <p class="mut">${esc(UPDST.msg||'The app checks for updates once a day when you open it.')}</p>
  <div class="row"><button class="pri" onclick="fxUpdCheck(true)" ${UPDST.busy?'disabled':''}>${UPDST.busy?'Checking…':'🔄 Check for updates'}</button>${UPD?`<button class="pri" onclick="fxUpdRun()">⬆ Update to 1.${UPD.n}</button>`:''}</div>
  ${UPD?`<p class="mut" style="font-size:12px">Released ${esc(UPD.date)} · ${UPD.size?(UPD.size/1048576).toFixed(1)+' MB':''}. <button style="padding:3px 9px" onclick="fxUpdBackup()">💾 Back up first</button></p>`:''}
  <details class="g"><summary>How updating works</summary><p class="mut">The app downloads the new version from this project’s GitHub page and opens Android’s install screen — Android always asks you to tap Install; no app can update itself silently. The first time, Android also asks you to allow “Install unknown apps” for MtG DeckMaster. Updates are signed with the same key as your current app, so your collection stays where it is.</p></details>`}
async function fxWebHash(){const h=[];for(const f of ['index.html','features.js']){const r=await fetch(f,{cache:'no-store'});if(!r.ok)throw 0;h.push(await r.text())}const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(h.join('\u0000')));return fxB64(d)}
async function fxWebCheck(){if(isNative()||WEBUPD||!/^https?:/.test(location.protocol))return;try{const h=await fxWebHash();if(WEBH==null){WEBH=h;return}if(h!==WEBH){WEBUPD=true;render()}}catch(e){}}
function fxUpdStart(){if(isNative()){const last=+(localStorage.getItem(FX_UPDK)||0);if(Date.now()-last>20*3600e3)setTimeout(()=>fxUpdCheck(false),4000);return}
  fxWebCheck();setInterval(fxWebCheck,30*60e3);document.addEventListener('visibilitychange',()=>{if(!document.hidden)fxWebCheck()})}

function fxOverrideAuto(i){const d=D.decks[i];if(!d||!d.override||deckIssues(i).length)return false;d.override=false;delete d.overrideAt;save();
  setTimeout(()=>toast(`Every rule issue in ${d.name} is fixed — override turned off. Breaking a rule again will need two approvals.`),400);return true}

/* ---------- Deck Generator: commander choices follow the same filters; Start over ---------- */
function aiCmdChoices(F){const al=aiAllowed(),cols=aiColors();
  return D.cards.filter(c=>isReal(c)&&cmdOK(c,F)&&okLegal(c)&&aiAvail(c,al)>0&&(!cols.length||okColor(c,cols)))}
async function aiReset(){if(!(await ask('Start over?\n\nThis clears the deck type, colors, where cards may come from, theme, commander, the AI reply and the preview.\n\nYour saved API key and model stay as they are.\n\nOK = clear everything\nCancel = keep it')))return;
  Object.assign(G,{fmt:'',legal:'',theme:'',cmd:'',colors:[],rand:false,rc:null,own:true,noDecks:true,from:{},busy:false,res:null,reply:'',err:''});render();scrollTo(0,0);toast('Deck Generator cleared')}

/* ---------- Add card tab: create a custom card by hand ---------- */
const fxCustomAddBtn=()=>`<div class="sec" style="margin-top:14px"><h4>Custom card</h4><p class="mut" style="font-size:12px;margin:4px 0 8px">For proxies, homebrew or playtest cards that aren’t on Scryfall. They go in your ★ Custom cards group.</p><div class="row"><button class="pri" onclick="fxCustomNew()">★ Add a custom card</button></div></div>`;
function fxCustomNew(){const types=['Creature','Legendary Creature','Instant','Sorcery','Artifact','Enchantment','Planeswalker','Legendary Planeswalker','Land','Basic Land','Battle','Kindred'];
  openM(`<h3>★ Add a custom card</h3><p class="mut">Only the name is required. You can add a photo of the card on the next screen.</p><div class="f">
  <label>Card name *</label><input id="cn_n" maxlength="80" autocomplete="off">
  <label>Card type</label><select id="cn_t">${types.map(x=>`<option>${x}</option>`).join('')}</select>
  <label>Subtype (optional)</label><input id="cn_s" placeholder="e.g. Elf Druid">
  <label>Mana cost (optional)</label><input id="cn_c" placeholder="e.g. {2}{G}{G}" oninput="fxCustomCost()"><p class="mut" id="cn_cp" style="margin:4px 0 0"></p>
  <label>Colors</label><div class="chips">${CLR.map(k=>`<button type="button" class="pipb" data-cn="${k}" onclick="this.classList.toggle('on')">${symImg(k)}</button>`).join('')}</div><p class="mut" style="font-size:12px;margin:2px 0 0">Leave all off for colorless. Colors in the mana cost are added automatically.</p>
  <div class="row" style="margin:0"><div style="flex:1"><label>Power</label><input id="cn_p" inputmode="numeric"></div><div style="flex:1"><label>Toughness</label><input id="cn_h" inputmode="numeric"></div></div>
  <label>Rules text (optional)</label><textarea id="cn_x" rows="3" placeholder="Use {T}, {G} etc. for symbols"></textarea>
  <div class="row" style="margin:0"><div style="flex:1"><label>Quantity</label><input id="cn_q" type="number" min="1" value="1"></div><div style="flex:1"><label>Finish</label><select id="cn_f"><option>Normal</option><option>Foil</option></select></div></div>
  <label>Pulled from</label><div class="sec" style="margin:4px 0 0;padding:8px 12px">★ Custom Cards <span class="mut" style="font-size:12px">— every custom card is kept under this source</span></div>
  </div><br><div class="row"><button onclick="closeM()">Cancel</button><button class="pri" onclick="fxCustomSave()">Add to my collection</button></div>`);setTimeout(()=>{const i=$('#cn_n');if(i)i.focus()},50)}
function fxCustomCost(){const v=$('#cn_c').value,p=$('#cn_cp');if(p)p.innerHTML=v?costHtml(v):''}
async function fxCustomSave(){const nm=($('#cn_n').value||'').trim();if(!nm)return toast('Give the card a name');
  const ex=findCard(nm);if(ex&&!ex.custom)return toast(`“${ex.name}” is already a real card in your collection — use another name`);
  const q=Math.max(1,parseInt($('#cn_q').value)||1),fin=$('#cn_f').value,ty=$('#cn_t').value,cost=($('#cn_c').value||'').trim(),txt=($('#cn_x').value||'').trim(),src=CUSTOM_SRC,
    picked=[...document.querySelectorAll('[data-cn].on')].map(b=>b.dataset.cn),fromCost=fxCI({cost,text:''}),ci=CLR.filter(k=>picked.includes(k)||fromCost.includes(k)),
    mv=(cost.match(/\{[^}]+\}/g)||[]).reduce((a,m)=>{const k=m.slice(1,-1);return a+(/^\d+$/.test(k)?+k:/^[XYZ]$/.test(k)?0:1)},0);
  if(ex){if(!(await ask(`You already have the custom card “${ex.name}”.\n\nAdd ${q} more ${q===1?'copy':'copies'} to it?`)))return;ex.finish=mergeFinish(ex.finish||'Normal',ex.qty,fin,q);ex.qty+=q;if(!cardSources(ex).includes(src))ex.source=(cardSources(ex).length?ex.source+', ':'')+src;
    D.acq.push({date:today(),name:ex.name,set:'',cn:'',finish:fin,qty:q,source:src,price:'',notes:'Custom card',shared:true});save();closeM();render();showCard(ex.name);return toast('Copies added')}
  const L={W:'White',U:'Blue',B:'Black',R:'Red',G:'Green'};
  D.cards.push({name:nm,source:src,colors:ci.length?ci.map(x=>L[x]).join('/'):(/Land/.test(ty)?'Land':'Colorless'),cost:cost||'None',cmc:String(mv),type:ty,subtype:($('#cn_s').value||'').trim()||'None',
    power:($('#cn_p').value||'').trim()||'None',toughness:($('#cn_h').value||'').trim()||'None',text:txt,keywords:'None',legal:'Custom card',qty:q,finish:fin,status:'Added in app',custom:true,ci});
  IDX=null;D.acq.push({date:today(),name:nm,set:'',cn:'',finish:fin,qty:q,source:src,price:'',notes:'Custom card',shared:false});logEdit(nm,'Custom card','','created');save();closeM();render();showCard(nm);
  toast(`${nm} added to your Custom cards — tap “Take a photo of this card” to add its picture`)}

/* ---------- API keys: saved on this device only, outside the collection data ----------
   Stored in their own storage key, so they are never part of share files. Manual backups and device transfers ask before
   including them; automatic backups always include them. Restoring brings them back only for your own collection
   (same ID) or into an empty app, and never replaces a key already saved on this device. */
const FXKEY='mtg_aikeys_v1',FXKEYREM='mtg_aikeyrem_v1';let FXBKKEYS=false;
const fxKeys0=()=>{try{return JSON.parse(localStorage.getItem(FXKEY)||'{}')||{}}catch(e){return {}}};
const fxKeyRem=()=>{try{return localStorage.getItem(FXKEYREM)!=='0'}catch(e){return false}};
const fxKeyAny=()=>Object.values(fxKeys0()).some(Boolean);
const FXPN={anthropic:'Anthropic',openai:'OpenAI',gemini:'Google Gemini'},fxKeyList=()=>Object.keys(fxKeys0()).filter(k=>fxKeys0()[k]).map(k=>FXPN[k]||k).join(', ');
const fxKeyGet=p=>fxKeys0()[p]||'';
function fxKeyWrite(o){try{Object.keys(o).forEach(k=>{if(!o[k])delete o[k]});Object.keys(o).length?localStorage.setItem(FXKEY,JSON.stringify(o)):localStorage.removeItem(FXKEY)}catch(e){}}
function fxKeySave(){if(!fxKeyRem())return;const o=fxKeys0();o[G.prov]=(AIKEY||'').trim();fxKeyWrite(o)}
function fxKeyRemSet(on){try{localStorage.setItem(FXKEYREM,on?'1':'0')}catch(e){}if(on){fxKeySave();toast('Your API key will be remembered on this device')}else{fxKeyWrite({});toast('Saved keys removed — the key is kept only until you close the app')}render()}
async function fxKeyForget(){if(!(await ask(`Forget the API keys saved on this device (${fxKeyList()})?`)))return;fxKeyWrite({});AIKEY='';render();toast('Saved API keys forgotten')}
function fxKeysIn(j,adopt){const k=j&&j.aiKeys;if(j)delete j.aiKeys;if(!k||!adopt||!fxKeyRem())return;const o=fxKeys0();let n=0;Object.keys(k).forEach(p=>{if(k[p]&&!o[p]){o[p]=k[p];n++}});if(n){fxKeyWrite(o);if(!AIKEY)AIKEY=fxKeyGet(G.prov);toast(`API key${n>1?'s':''} restored on this device`)}}

/* ---------- models: list the ones this API key can use ---------- */
const fxElapsed=t0=>{const s=Math.round((Date.now()-(t0||G.t0||Date.now()))/1000);return s<60?s+' s':Math.floor(s/60)+' min '+(s%60)+' s'};
const FXMODELPREF={anthropic:[/sonnet/,/haiku/,/opus/],openai:[/^gpt-[\d.]+-mini/,/^gpt-[\d.]+$/,/^gpt/,/^o\d/],gemini:[/flash(?!-lite)/,/flash-lite/,/pro/]};
function fxModelSave(){try{const o=JSON.parse(localStorage.getItem('mtg_aimodel_v1')||'{}');o[G.prov]=G.model.trim();localStorage.setItem('mtg_aimodel_v1',JSON.stringify(o))}catch(e){}}
function fxModelLoad(){try{const o=JSON.parse(localStorage.getItem('mtg_aimodel_v1')||'{}');if(o[G.prov])G.model=o[G.prov]}catch(e){}}
async function fxLoadModels(){const key=AIKEY.trim();if(!key)return toast('Type your API key first');G.mload=true;G.mmsg='';render();let ids=[];
  try{let r,j;
    if(G.prov==='anthropic'){r=await fetch('https://api.anthropic.com/v1/models?limit=100',{headers:{'x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'}});j=await r.json();ids=(j.data||[]).map(m=>m.id)}
    else if(G.prov==='openai'){r=await fetch('https://api.openai.com/v1/models',{headers:{Authorization:'Bearer '+key}});j=await r.json();ids=(j.data||[]).map(m=>m.id).filter(x=>/^(gpt|o\d|chatgpt)/.test(x)&&!/(audio|realtime|tts|transcribe|image|embedding|search|instruct|codex|moderation)/.test(x)).sort().reverse()}
    else{r=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200',{headers:{'x-goog-api-key':key}});j=await r.json();ids=(j.models||[]).filter(m=>(m.supportedGenerationMethods||[]).includes('generateContent')).map(m=>m.name.replace(/^models\//,'')).filter(x=>/^gemini/.test(x)&&!/(embedding|image|tts|audio|live|vision|banana)/.test(x)).sort().reverse()}
    if(!r.ok)throw new Error((j.error&&j.error.message)||('error '+r.status))}
  catch(e){G.mload=false;G.mmsg='Couldn’t load your models: '+String(e&&e.message||e).slice(0,120);return render()}
  G.models=ids;G.mload=false;
  if(!ids.includes(G.model.trim())){const pick=(FXMODELPREF[G.prov]||[]).map(re=>ids.find(x=>re.test(x)&&!/preview|exp/.test(x))||ids.find(x=>re.test(x))).find(Boolean)||ids[0];
    G.mmsg=ids.length?`“${G.model||'(none)'}” isn’t available for your key, so I picked ${pick}. Tap the model box to choose another (${ids.length} available).`:'Your key has no chat models available.';if(pick){G.model=pick;fxModelSave()}}
  else G.mmsg=`✓ ${G.model} is available for your key (${ids.length} models in the list).`;render()}

/* ---------- suggestion lists ----------
   Android's built-in <datalist> popup draws with a see-through background in dark mode once you start typing,
   so every input that has a list="…" is switched to this styled dropdown instead (applied automatically).
   The list scrolls with your finger; an option is only chosen by a deliberate tap (finger lifted without moving).
   Suggestion fields and in-popup search boxes get a ✕ that clears the field. */
let FXAC=null;
function fxACClose(){if(FXAC){FXAC.box.remove();FXAC=null}}
function fxACPlace(){if(!FXAC)return;const r=FXAC.inp.getBoundingClientRect(),vh=(window.visualViewport&&visualViewport.height)||innerHeight,below=vh-r.bottom>200||r.top<200;
  Object.assign(FXAC.box.style,{left:r.left+'px',width:r.width+'px',top:below?(r.bottom+4)+'px':'',bottom:below?'':(innerHeight-r.top+4)+'px',maxHeight:Math.max(140,Math.min(300,below?vh-r.bottom-12:r.top-12))+'px'})}
function fxACShow(inp){const id=inp.dataset.acl,dl=id&&document.getElementById(id);if(!dl){fxACClose();return}
  const all=[...dl.options].map(o=>o.value).filter(Boolean),q=inp.value.trim().toLowerCase(),
    opts=(q?all.filter(v=>v.toLowerCase().includes(q)&&v.toLowerCase()!==q).sort((a,b)=>(b.toLowerCase().startsWith(q))-(a.toLowerCase().startsWith(q))):all).slice(0,80);
  if(!opts.length){fxACClose();return}
  if(!FXAC||FXAC.inp!==inp){fxACClose();const box=document.createElement('div');box.className='acbox';document.body.appendChild(box);FXAC={inp,box};fxACTouch(box)}
  fxACPlace();FXAC.box.innerHTML=opts.map((v,k)=>`<div data-ack="${k}">${esc(v)}</div>`).join('');FXAC.opts=opts;FXAC.box.scrollTop=0}
function fxACPick(k){if(!FXAC)return;const inp=FXAC.inp,v=FXAC.opts[k];if(v==null)return;inp.value=v;fxACClose();inp.dispatchEvent(new Event('input',{bubbles:true}));inp.dispatchEvent(new Event('change',{bubbles:true}));fxACClose();fxACX(inp)}
// A tap = finger down and up on the same option without moving more than a few pixels. Moving = scrolling, never a choice.
function fxACTouch(box){let st=null;
  box.addEventListener('pointerdown',e=>{const o=e.target.closest('[data-ack]');st={x:e.clientX,y:e.clientY,k:o?+o.dataset.ack:null,top:box.scrollTop,t:Date.now()};FXAC&&(FXAC.inBox=true);if(e.pointerType==='mouse')e.preventDefault()});
  box.addEventListener('pointermove',e=>{if(st&&(Math.abs(e.clientY-st.y)>8||Math.abs(e.clientX-st.x)>8))st.moved=true});
  box.addEventListener('pointercancel',()=>{st=null});
  box.addEventListener('scroll',()=>{if(st&&Math.abs(box.scrollTop-st.top)>4)st.moved=true},{passive:true});
  box.addEventListener('pointerup',e=>{const s=st;st=null;if(!s||s.moved||s.k==null)return;const o=e.target.closest('[data-ack]');if(!o||+o.dataset.ack!==s.k)return;e.preventDefault();fxACPick(s.k)});
  box.addEventListener('click',e=>e.preventDefault())}
function fxACX(inp){const w=inp.parentElement;if(!w||!w.classList.contains('acw'))return;w.classList.toggle('has',!!inp.value)}
function fxACWrap(inp){if(inp.parentElement&&inp.parentElement.classList.contains('acw'))return;const w=document.createElement('span');w.className='acw'+(inp.tagName==='TEXTAREA'?' ta':'');if(inp.style.flex){w.style.flex=inp.style.flex;inp.style.flex=''}
  inp.parentNode.insertBefore(w,inp);w.appendChild(inp);const b=document.createElement('button');b.type='button';b.className='acx';b.setAttribute('aria-label','Clear');b.textContent='✕';
  b.addEventListener('pointerdown',e=>e.preventDefault());b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();inp.value='';inp.dispatchEvent(new Event('input',{bubbles:true}));inp.dispatchEvent(new Event('change',{bubbles:true}));fxACX(inp);inp.focus()});
  w.appendChild(b);fxACX(inp)}
function fxACWire(root){(root||document).querySelectorAll('input[list]').forEach(inp=>{inp.dataset.acl=inp.getAttribute('list');inp.removeAttribute('list');inp.setAttribute('autocomplete','off');fxACWrap(inp)});
  (root||document).querySelectorAll('#modal input[type=search],#modal #unkq,#modal #um_n,#qadd,#qas').forEach(fxACWrap)}
document.addEventListener('focusin',e=>{const t=e.target;if(t&&t.dataset&&t.dataset.acl)fxACShow(t)});
document.addEventListener('input',e=>{const t=e.target;if(!t||!t.parentElement)return;if(t.parentElement.classList.contains('acw'))fxACX(t);if(t.dataset&&t.dataset.acl)fxACShow(t)});
document.addEventListener('focusout',e=>{if(FXAC&&e.target===FXAC.inp)setTimeout(()=>{if(FXAC&&!FXAC.inBox&&document.activeElement!==FXAC.inp)fxACClose();if(FXAC)FXAC.inBox=false},250)});
document.addEventListener('pointerdown',e=>{if(FXAC&&!FXAC.box.contains(e.target)&&e.target!==FXAC.inp&&!e.target.closest('.acw'))fxACClose()},true);
addEventListener('scroll',e=>{if(FXAC&&!FXAC.box.contains(e.target))fxACPlace()},true);
addEventListener('resize',()=>fxACPlace());if(window.visualViewport)visualViewport.addEventListener('resize',()=>fxACPlace());
new MutationObserver(()=>{if(document.querySelector('input[list],#modal input[type=search]:not(.acw input),#modal #unkq:not(.acw input),#modal #um_n:not(.acw input),#qadd:not(.acw textarea),#qas:not(.acw input)'))fxACWire()}).observe(document.documentElement,{childList:true,subtree:true});

/* ---------- custom card artwork: take a photo or upload a picture (never a Scryfall search or a card scan) ---------- */
function fxCustomArt(name){const c=findCard(name);if(!c)return;const q=esc(c.name).replace(/'/g,"\\'");
  openM(`<h3>Picture for ${esc(c.name)}</h3><p class="mut">Custom cards use your own picture. Nothing is looked up online.</p>
  ${CIMG[c.name]?`<div class="frame" style="margin:10px auto"><img src="${CIMG[c.name]}" alt=""></div>`:''}
  <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px">
  <button class="pri" style="padding:13px" onclick="fxCustomPhoto('${q}')">📷 Take a photo (line it up in the green corners)</button>
  <label class="btn" style="padding:13px;text-align:center">🖼 Upload a picture from your phone<input type="file" accept="image/*" hidden onchange="fxCustomUpload('${q}',this.files[0]);this.value=''"></label>
  ${CIMG[c.name]?`<button onclick="fxCustomPhotoDel('${q}')">Remove picture</button>`:''}
  <button onclick="showCard('${q}')">← Back</button></div>
  <p class="mut" style="font-size:12px">Uploaded pictures are trimmed to card shape from the centre and compressed (about 60 KB).</p>`,()=>showCard(c.name))}
function fxCustomUpload(name,f){if(!f)return;if(!/^image\//.test(f.type||'image/'))return toast('That isn’t a picture file');fxCustomPhotoSet(name,f)}

/* ---------- un-marking a custom card: ask first, then ask where it came from ---------- */
async function fxUnmarkCustom(name){const c=findCard(name);if(!c)return;
  if(!(await ask(`Is “${c.name}” really a real Magic card?\n\nUnmarking it takes it out of your Custom cards group and the “Custom Cards” source. The app will then try to match it with Scryfall, and your custom picture will no longer be shown.\n\nOK = yes, it’s a real card\nCancel = keep it custom`)))return;
  const srcs=allSources().filter(x=>!IDX_SRC.includes(x.toLowerCase())&&!isCustomSrc(x)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})),q=esc(c.name).replace(/'/g,"\\'");
  openM(`<h3>Where did ${esc(c.name)} come from?</h3><p class="mut">Real cards need a “Pulled from” other than “Custom Cards”.</p><div class="f">
  <label>Pulled from</label><select id="um_s" onchange="fxUmPick()"><option value="">Choose…</option><optgroup label="Existing sources">${srcs.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}</optgroup><option value="__new">＋ A new source</option></select>
  <div id="um_nw" hidden><label>New source name</label><input id="um_n" list="um_nl" placeholder="e.g. Foundations Play Booster" oninput="fxUmNote()"><datalist id="um_nl">${srcs.map(x=>`<option value="${esc(x)}">`).join('')}</datalist><p class="mut" id="um_note" style="margin:4px 0 0"></p></div></div>
  <br><div class="row"><button onclick="showCard('${q}')">Cancel</button><button class="pri" onclick="fxUmSave('${q}')">Unmark custom</button></div>`,()=>showCard(c.name))}
function fxUmPick(){const n=$('#um_s').value==='__new';$('#um_nw').hidden=!n;if(n)setTimeout(()=>$('#um_n').focus(),30)}
function fxUmNote(){const v=($('#um_n').value||'').trim(),r=v?autoNumber(canonSrc(v)):'';$('#um_note').textContent=isCustomSrc(v)?'“Custom Cards” is only for custom cards.':r&&r!==v?`Will be saved as: ${r}`:''}
function fxUmSave(name){const c=findCard(name);if(!c)return;const sel=$('#um_s').value;let src=sel==='__new'?($('#um_n').value||'').trim():sel;
  if(!src)return toast('Choose where it came from');if(sel==='__new'){if(allSources().map(x=>x.toLowerCase()).includes(src.toLowerCase()))src=allSources().find(x=>x.toLowerCase()===src.toLowerCase());else src=autoNumber(canonSrc(src))}
  if(isCustomSrc(src))return toast('“Custom Cards” is only for custom cards — choose another “Pulled from”');
  fxSetCustom(c.name,false,true);const ss=cardSources(c).filter(x=>!isCustomSrc(x));if(!ss.includes(src))ss.push(src);c.source=ss.join(', ');
  D.acq.forEach(a=>{if(norm(a.name)===norm(c.name)&&isCustomSrc(a.source))a.source=src});logEdit(c.name,'Pulled from','Custom Cards',src);save();render();showCard(c.name);toast(`${c.name} is now a regular card from “${src}”`)}

/* ---------- edit a custom card's details (name, type, cost, colors, P/T, rules text) ---------- */
function fxCustomEdit(name){const c=findCard(name);if(!c||!c.custom)return;const types=['Creature','Legendary Creature','Instant','Sorcery','Artifact','Enchantment','Planeswalker','Legendary Planeswalker','Land','Basic Land','Battle','Kindred'],
  v=x=>esc(nzs(x)),ci=fxCI(c),q=esc(c.name).replace(/'/g,"\\'");if(!types.includes(c.type))types.unshift(c.type);
  openM(`<h3>✎ Edit ${esc(c.name)}</h3><p class="mut">Changes apply to this card everywhere — your collection, decks and logs. Copies and finishes are changed with + / − on the card page.</p><div class="f">
  <label>Card name *</label><input id="cn_n" maxlength="80" value="${v(c.name)}" autocomplete="off">
  <label>Card type</label><select id="cn_t">${types.map(x=>`<option ${x===c.type?'selected':''}>${esc(x)}</option>`).join('')}</select>
  <label>Subtype</label><input id="cn_s" value="${v(c.subtype)}">
  <label>Mana cost</label><input id="cn_c" value="${v(c.cost)}" placeholder="e.g. {2}{G}{G}" oninput="fxCustomCost()"><p class="mut" id="cn_cp" style="margin:4px 0 0">${costHtml(c.cost)}</p>
  <label>Colors</label><div class="chips">${CLR.map(k=>`<button type="button" class="pipb ${ci.includes(k)?'on':''}" data-cn="${k}" onclick="this.classList.toggle('on')">${symImg(k)}</button>`).join('')}</div>
  <div class="row" style="margin:0"><div style="flex:1"><label>Power</label><input id="cn_p" value="${v(c.power)}"></div><div style="flex:1"><label>Toughness</label><input id="cn_h" value="${v(c.toughness)}"></div></div>
  <label>Rules text</label><textarea id="cn_x" rows="4">${esc(c.text||'')}</textarea></div>
  <br><div class="row"><button onclick="showCard('${q}')">Cancel</button><button class="pri" onclick="fxCustomEditSave('${q}')">Save changes</button></div>`,()=>showCard(c.name))}
async function fxCustomEditSave(name){const c=findCard(name);if(!c)return;const nm=($('#cn_n').value||'').trim();if(!nm)return toast('Give the card a name');
  const other=findCard(nm);if(other&&other!==c)return toast(`You already have a card called “${other.name}” — choose another name`);
  const cost=($('#cn_c').value||'').trim(),txt=($('#cn_x').value||'').trim(),ty=$('#cn_t').value,picked=[...document.querySelectorAll('[data-cn].on')].map(b=>b.dataset.cn),fromCost=fxCI({cost,text:''}),ci=CLR.filter(k=>picked.includes(k)||fromCost.includes(k)),
    mv=(cost.match(/\{[^}]+\}/g)||[]).reduce((a,m)=>{const k=m.slice(1,-1);return a+(/^\d+$/.test(k)?+k:/^[XYZ]$/.test(k)?0:1)},0),L={W:'White',U:'Blue',B:'Black',R:'Red',G:'Green'},
    now={type:ty,subtype:($('#cn_s').value||'').trim()||'None',cost:cost||'None',cmc:String(mv),colors:ci.length?ci.map(x=>L[x]).join('/'):(/Land/.test(ty)?'Land':'Colorless'),power:($('#cn_p').value||'').trim()||'None',toughness:($('#cn_h').value||'').trim()||'None',text:txt};
  const lbl={type:'Type',subtype:'Subtype',cost:'Mana cost',cmc:'Mana value',colors:'Colors',power:'Power',toughness:'Toughness',text:'Rules text'},ch=Object.keys(now).filter(k=>String(c[k]??'')!==String(now[k]));
  if(nm===c.name&&!ch.length&&String(c.ci||'')===String(ci))return showCard(c.name);
  if(!(await ask(`Save these changes to ${c.name}?\n\n${[...(nm!==c.name?[`Name: ${c.name} → ${nm}`]:[]),...ch.map(k=>`${lbl[k]}: ${String(c[k]??'').slice(0,30)} → ${String(now[k]).slice(0,30)}`)].join('\n')||'Colors'}`)))return;
  ch.forEach(k=>logEdit(c.name,lbl[k],c[k],now[k]));Object.assign(c,now);c.ci=ci;if(nm!==c.name){logEdit(c.name,'Name',c.name,nm);renameCard(c.name,nm)}
  IDX=null;save();render();showCard(nm);toast('Card details saved')}

/* ---------- several cards at once: choose the printing of each card, in the order typed ---------- */
function fxQAPick(){if(IMP.kind==='verify')return fxVerPick();const it=IMP.items,i=Math.min(IMP.pi||0,it.length-1),x=it[i],n=it.length,done=it.filter(y=>y.card&&!y.skip).length;
  const head=`<div class="row" style="align-items:center;margin:0 0 6px"><b style="flex:1">Card ${i+1} of ${n}</b><span class="mut" style="font-size:12px">${done} ready</span>${i+1<n||x.card?`<button style="flex:0 0 auto;padding:6px 10px;font-size:13px" onclick="fxQASkipArt()">⏭ Skip artwork for the rest</button>`:''}</div><div class="pbar"><i style="width:${Math.round((i+1)/n*100)}%"></i></div>`;
  const nav=`<div style="height:84px"></div><div class="qanav"><button onclick="fxQAPrev()">‹ ${i?'Previous':'Back'}</button><button onclick="fxQASkip()">${x.skip?'Don’t skip':'Skip this card'}</button><button class="pri" onclick="fxQANext()" ${!x.card&&!x.skip?'disabled':''}>${i+1<n?'Next ›':'Review all ›'}</button></div>`;
  if(x.skip)return head+`<h3>${esc(x.name)}</h3><p class="mut">Skipped — it won’t be added.</p>`+nav;
  if(x.reading)return head+`<h3>Reading the card…</h3><p class="mut" id="qamsg">${esc(x.reading)}</p>`;
  if(!x.card)return head+`<h3>Couldn’t find “${esc(x.name)}”</h3>${x.sugs&&x.sugs.length?`<p style="margin:6px 0 4px">Did you mean one of these?</p><div class="sug">${x.sugs.map(n=>`<div onclick="fxQAUse(${JSON.stringify(n).replace(/"/g,'&quot;')})">${esc(n)}</div>`).join('')}</div><p class="mut">Or type the name again (suggestions come from Scryfall), or scan the card.</p>`:'<p class="mut">Type the name again (suggestions come from Scryfall), or scan the card.</p>'}
    <input id="qas" type="search" value="${esc(x.q!=null?x.q:x.name)}" placeholder="Start typing a card name" style="width:100%" autocomplete="off" oninput="fxQASearch(this.value)"><div class="sug" id="qasug"></div>
    <div class="row" style="margin-top:10px"><button onclick="fxQAScan()">📷 Scan this card</button></div>`+nav;
  const c=x.card,fins=(c.finishes||['nonfoil']).map(f=>finMap[f]||f);if(!fins.includes(x.fin))x.fin=fins[0];if(!x.prints&&!x.loading)fxQALoad(i);
  const sm=p=>p.image_uris?.small||p.card_faces?.[0]?.image_uris?.small||'',list=x.prints||[c];
  return head+`<h3 style="margin:8px 0 2px">${esc(c.name)}</h3>${x.fuzzy?`<div class="warn" style="margin:4px 0 8px">You typed “${esc(x.typed)}” — this looks like the closest match. <button style="padding:3px 9px" onclick="fxQAWrong()">Not right? Search again</button></div>`:`<p class="mut" style="margin:0 0 8px">Typed as “${esc(x.raw||x.name)}”.</p>`}${x.mine?'<p style="margin:0 0 8px;color:var(--gold)">✓ Already in your collection with this verified artwork.</p>':''}${x.restOf?`<p style="margin:0 0 8px;color:var(--gold)">The other ${x.qty} ${x.qty>1?'copies':'copy'} of ${esc(x.name)} — pick their artwork.</p>`:''}<p class="mut" style="margin:0 0 8px">Tap the set name under an artwork to choose it, or tap the picture to see it full screen.</p>
  <div class="qabar"><b class="qanm">${esc(c.name)}</b><label style="margin:0">Copies</label><input type="number" min="1" value="${x.qty}" style="width:80px" onchange="fxQAQty(${i},this.value)">
  ${fins.length>1?`<span class="chips" style="margin:0">${fins.map(f=>`<button class="${x.fin===f?'on':''}" onclick="IMP.items[${i}].fin='${f}';render()">${f}</button>`).join('')}</span>`:`<span class="mut">${esc(fins[0])}</span>`}</div>
  ${fxPQBox(i,x)}<div class="grid">${list.map((p,k)=>`<div class="tile" data-pk="${k}" style="${p.id===c.id?'outline:3px solid var(--gold);border-radius:12px;':''}${fxPQ(p,x.pq)?'':'display:none'}"><div class="art" onclick="fxQAView(${i},${k})"><img loading="lazy" src="${esc(sm(p))}" alt="">${p.id===c.id?'<span class="badge">✓</span>':''}</div><div class="nm setcap" onclick="fxQAPrint(${i},${k})" style="cursor:pointer"><b>${esc(p.set_name)}</b><span>${esc(String(p.set||'').toUpperCase())} #${esc(p.collector_number)}${p.released_at?' · '+esc(p.released_at.slice(0,4)):''}</span>${fxFinLabel(p)}</div></div>`).join('')}</div>
  ${x.loading?'<p class="mut">Loading all printings…</p>':''}`+nav}
async function fxQALoad(i){const x=IMP.items[i];if(!x||!x.card||x.prints||x.loading)return;x.loading=true;const all=[];let url=x.card.prints_search_uri,pages=0;
  try{while(url&&pages<4){const p=await scry(url);if(!p||!p.data)break;all.push(...p.data);pages++;url=p.has_more?p.next_page:null}}catch(e){}
  x.loading=false;if(x.stub){if(!all.length){x.err=true}else{x.stub=false;x.err=false;x.card=all.find(p=>p.id===x.sid)||all[0];x.prints=all}if(IMP.stage==='pick'&&IMP.pi===i)render();return}x.loading=false;x.prints=all.length?all:[x.card];if(!x.prints.some(p=>p.id===x.card.id))x.prints.unshift(x.card);if(!x.picked){const e=findCard(x.card.name),m=e&&e.verified&&e.scryId&&x.prints.find(p=>p.id===e.scryId);if(m){x.card=m;x.mine=true}}if(IMP.stage==='pick'&&IMP.pi===i)render()}
function fxQAPrint(i,k){const x=IMP.items[i];const p=(x.prints||[])[k];if(!p)return;x.card=p;x.picked=true;x.mine=false;render()}
/* Full-screen artwork viewer for the add-several picker: swipe or use ‹ › to browse every printing, flip double-faced cards, “Use this one” picks it. */
function fxQAView(i,k){const x=IMP.items[i];fxPrintView(x.prints||[x.card],k,x.card&&x.card.id,kk=>fxQAPrint(i,kk))}
/* Full-screen artwork viewer shared by the several-cards picker and the artwork picker: ‹ › / swipe through the printings, ↻ Flip, “Use this one” selects (onUse) */
function fxPrintView(list,k,selId,onUse){if(!list[k])return;let face=0;$('#qafull')?.remove();const d=document.createElement('div');d.id='qafull';
  const big=(p,f)=>{const cf=p.card_faces;if(cf&&cf[f]&&cf[f].image_uris)return cf[f].image_uris.large||cf[f].image_uris.normal||'';return p.image_uris?.large||p.image_uris?.normal||cf?.[0]?.image_uris?.large||cf?.[0]?.image_uris?.normal||''};
  const draw=()=>{const p=list[k],sel=!!selId&&p.id===selId,two=!!(p.card_faces&&p.card_faces[1]&&p.card_faces[1].image_uris);
    d.innerHTML=`<div class="qft"><span>${k+1} of ${list.length}</span>${sel?'<b class="qfsel">✓ Selected</b>':''}<button class="qfx" aria-label="Close">✕</button></div>
    <div class="im"><button class="qfa ql" ${k?'':'disabled'} aria-label="Previous">‹</button><img src="${esc(big(p,face))}" alt=""><button class="qfa qr" ${k+1<list.length?'':'disabled'} aria-label="Next">›</button></div>
    <div class="qfc"><b>${esc(p.set_name)}</b> · ${esc(String(p.set||'').toUpperCase())} #${esc(p.collector_number)}${p.released_at?' · '+esc(p.released_at.slice(0,4)):''} ${fxFinLabel(p)}</div>
    <div class="bt">${two?'<button class="qff">↻ Flip</button>':''}<button class="qfb">Back to list</button><button class="pri qfu">${sel?'Keep this one':'Use this one'}</button></div>`;
    d.querySelector('.qfx').onclick=d.querySelector('.qfb').onclick=()=>d.remove();
    d.querySelector('.ql').onclick=()=>go(-1);d.querySelector('.qr').onclick=()=>go(1);
    if(two)d.querySelector('.qff').onclick=()=>{face=face?0:1;draw()};
    d.querySelector('.qfu').onclick=()=>{d.remove();onUse(k)}};
  const go=s=>{const n=k+s;if(n<0||n>=list.length)return;k=n;face=0;draw()};
  let sx=null,sy=0;d.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY},{passive:true});
  d.addEventListener('touchend',e=>{if(sx==null)return;const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;sx=null;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.3)go(dx<0?1:-1)},{passive:true});
  draw();document.body.appendChild(d)}
/* Copies box in the several-cards picker: lowering it brings the card up again for the remaining copies' artwork */
/* Several cards: stop choosing artwork — this card and the rest keep the printing Scryfall matched and are added unverified (verify later in Data check / Import history) */
async function fxQASkipArt(){const it=IMP.items,i=IMP.pi||0,rest=it.slice(i),ok=rest.filter(x=>x.card&&!x.skip),lost=rest.filter(x=>!x.card&&!x.skip);
  if(!(await ask(`Skip the artwork for the rest?\n\nThe remaining ${fxPl(sum(ok,x=>x.qty),'card')} keep the printing Scryfall matched and are added without the ✓ — you can verify them later in More → Data check or Import history.${lost.length?`\n\n${fxPl(lost.length,'card')} still not found (${lost.map(x=>x.raw||x.name).join(', ')}) will be left out.`:''}\n\nOK = skip the artwork\nCancel = keep choosing`)))return;
  rest.forEach(x=>{if(x.card)x.nover=true;else x.skip=true});IMP.stage='preview';render();scrollTo(0,0)}
/* Single add: estimated value of the chosen printing (Scryfall market price for the finish × quantity) */
function fxAddVal(){const c=A.card;if(!c)return '';if(!A.printOK)return `<div class="aval mut">${A.skipArt?'Estimated value: shown once the artwork is chosen (skipped).':'Estimated value: pick your artwork above to see it.'}</div>`;
  const pr=c.prices||{},fin=String(A.finish||'Normal'),v=parseFloat(/etched/i.test(fin)?pr.usd_etched:/foil/i.test(fin)?(pr.usd_foil||pr.usd_etched):pr.usd)||0,q=A.qty||1;
  return `<div class="aval"><span>Estimated value</span><b>${v?`${fxMoney(v)} each${q>1?` · ${fxMoney(v*q)} for ${q}`:''}`:'<span class="mut">no market price for this printing / finish</span>'}</b></div>`}
async function fxSkipArt1(){if(!(await ask('Skip the artwork check?\n\nThe card is added with the printing Scryfall matched, without the ✓. You can verify it later from its card page (🎨) or More → Data check.\n\nOK = skip it\nCancel = choose the artwork')))return;A.printOK=false;A.skipArt=true;A.finish=A.finish||fins0();A.step='q';A.q=A.q||fxLastSrcQ({});render()}
function fxQAQty(i,v){const x=IMP.items[i];if(!x)return;if(x.max==null)x.max=x.qty;x.qty=Math.max(1,parseInt(v,10)||1);if(x.qty>x.max)x.max=x.qty;render()}
function fxQASplit(i){const x=IMP.items[i];if(!x||!x.card||x.skip||x.max==null)return;const rest=x.max-x.qty,nx=IMP.items[i+1],linked=nx&&nx.restOf===x;
  if(rest<=0){if(linked)IMP.items.splice(i+1,1);return}
  if(/Basic Land/.test(x.card.type_line||''))return;
  if(linked){nx.qty=nx.max=rest;return}
  IMP.items.splice(i+1,0,{name:x.name,raw:x.raw,qty:rest,max:rest,fin:x.fin,card:x.card,prints:x.prints,restOf:x,typed:x.typed,fuzzy:false})}
function fxQANext(){if(IMP.kind==='verify')return fxVerNext(true);const x=IMP.items[IMP.pi];if(!x.card&&!x.skip)return;fxQASplit(IMP.pi);if(IMP.pi+1<IMP.items.length){IMP.pi++;render();scrollTo(0,0)}else{IMP.stage='preview';IMP.items.forEach(y=>{if(y.skip){y.card0=y.card0||y.card;y.card=null}});render();scrollTo(0,0)}}
function fxQAPrev(){if(IMP.pi>0){IMP.pi--;render();scrollTo(0,0)}else if(IMP.kind==='verify')fxVerStop();else fxImpCancel()}
function fxQASkip(){if(IMP.kind==='verify')return fxVerNext(false);const x=IMP.items[IMP.pi];x.skip=!x.skip;if(!x.skip&&x.card0&&!x.card)x.card=x.card0;render()}
let QAT=null;
function fxQASearch(v){const x=IMP.items[IMP.pi];x.q=v;clearTimeout(QAT);const q=v.trim();if(q.length<2){const s=$('#qasug');if(s)s.innerHTML='';return}
  QAT=setTimeout(async()=>{const r=await scry('/cards/autocomplete?q='+encodeURIComponent(q));const s=$('#qasug');if(!s||($('#qas')||{}).value.trim()!==q)return;
    s.innerHTML=(r&&r.data||[]).slice(0,12).map((n,k)=>`<div onclick="fxQAUse(${JSON.stringify(n).replace(/"/g,'&quot;')})">${esc(n)}</div>`).join('')||'<p class="mut">No cards found with that name.</p>'},250)}
async function fxQAUse(name){const x=IMP.items[IMP.pi];const c=await scry('/cards/named?exact='+encodeURIComponent(name));if(!c||c.object!=='card')return toast('Couldn’t load that card — check your connection');
  x.raw=x.raw||x.typed||x.name;x.card=c;x.name=c.name;x.prints=null;x.q=null;x.fuzzy=false;render()}
function fxQAScan(){const i=IMP.pi;fxCam(async blob=>{const x=IMP.items[i];x.raw=x.raw||x.name;x.reading='Loading the text reader…';render();
  try{await loadTess();const r=await identify(blob,null,m=>{x.reading=m;const e=$('#qamsg');if(e)e.textContent=m});x.reading=null;
    if(r.cards&&r.cards.length){x.card=r.cards[0].card;x.name=x.card.name;x.prints=null;toast(`Found ${x.card.name}`)}else toast('Couldn’t read that card — try again, or type the name')}
  catch(e){x.reading=null;toast('Couldn’t read that photo')}render()})}
function fxQAWrong(){const x=IMP.items[IMP.pi];x.q=x.typed;x.sugs=null;x.card=null;x.prints=null;x.fuzzy=false;x.name=x.typed;render();setTimeout(()=>{const i=$('#qas');if(i){i.focus();fxQASearch(i.value)}},50)}
/* ---------- Keyword abilities explained (card page, under Rules). Plain-language summaries written for this app. ---------- */
const FXKW=[
['Deathtouch','Any amount of damage this deals to a creature is enough to destroy it.'],
['Defender','This creature can’t attack (it can still block).'],
['Double strike','Deals combat damage twice: once in a first-strike step and again in the normal damage step.'],
['First strike','Deals combat damage before creatures without first strike, so it can kill a blocker or attacker before that creature strikes back.'],
['Flash','You may cast this any time you could cast an instant — even on an opponent’s turn or during combat.'],
['Flying','Can only be blocked by creatures with flying or reach.'],
['Haste','Can attack and use {T} abilities the turn it comes under your control (no “summoning sickness”).'],
['Hexproof','Can’t be the target of spells or abilities your opponents control.'],
['Indestructible','Isn’t destroyed by “destroy” effects or lethal damage. It can still be exiled, sacrificed or shrunk to 0 toughness.'],
['Lifelink','Damage this deals also makes you gain that much life.'],
['Menace','Can’t be blocked except by two or more creatures.'],
['Reach','Can block creatures with flying.'],
['Trample','If it’s blocked, damage beyond what’s needed to destroy the blockers goes through to the player or planeswalker it attacked.'],
['Vigilance','Attacking doesn’t cause this creature to tap, so it can still block on the next turn.'],
['Ward','Whenever it becomes the target of a spell or ability an opponent controls, that spell or ability is countered unless they pay the ward cost.'],
['Protection','Can’t be blocked, targeted, dealt damage or enchanted/equipped by anything with the stated quality (e.g. “protection from red”).'],
['Shroud','Can’t be the target of any spells or abilities — not even yours.'],
['Intimidate','Can only be blocked by artifact creatures and creatures that share a color with it.'],
['Fear','Can only be blocked by artifact creatures and black creatures.'],
['Shadow','Can only block or be blocked by creatures with shadow.'],
['Horsemanship','Can only be blocked by creatures with horsemanship.'],
['Skulk','Can’t be blocked by creatures with greater power.'],
['Landwalk','Can’t be blocked as long as the defending player controls a land of the named type (e.g. Forestwalk, Islandwalk).'],
['Banding','Creatures with banding can attack as a group, and their controller assigns combat damage dealt to them.'],
['Flanking','Whenever a creature without flanking blocks this, the blocker gets -1/-1 until end of turn.'],
['Bushido','When this blocks or becomes blocked, it gets +N/+N until end of turn.'],
['Rampage','Whenever this becomes blocked, it gets +N/+N for each creature blocking it beyond the first.'],
['Exalted','Whenever a creature you control attacks alone, it gets +1/+1 until end of turn for each instance of exalted you have.'],
['Prowess','Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.'],
['Afflict','Whenever this becomes blocked, the defending player loses N life.'],
['Annihilator','Whenever this attacks, the defending player sacrifices N permanents.'],
['Battle cry','Whenever this attacks, each other attacking creature gets +1/+0 until end of turn.'],
['Myriad','Whenever this attacks, for each other opponent, create a token copy of it attacking that player; exile the tokens at end of combat.'],
['Melee','Whenever this attacks, it gets +1/+1 until end of turn for each opponent you attacked this combat.'],
['Mentor','Whenever this attacks, put a +1/+1 counter on target attacking creature with lesser power.'],
['Training','Whenever this attacks with another creature with greater power, put a +1/+1 counter on it.'],
['Toxic','Combat damage this deals to a player also gives them N poison counters (10 poison counters and they lose).'],
['Infect','Deals damage to creatures as -1/-1 counters and to players as poison counters (10 poison and they lose).'],
['Wither','Deals damage to creatures in the form of -1/-1 counters.'],
['Poisonous','Whenever this deals combat damage to a player, they get N poison counters.'],
['Undying','When it dies, if it had no +1/+1 counters, return it to the battlefield with a +1/+1 counter.'],
['Persist','When it dies, if it had no -1/-1 counters, return it to the battlefield with a -1/-1 counter.'],
['Evolve','Whenever a creature with greater power or toughness enters under your control, put a +1/+1 counter on this.'],
['Modular','Enters with N +1/+1 counters; when it dies, you may move its counters onto target artifact creature.'],
['Graft','Enters with N +1/+1 counters; whenever another creature enters, you may move one of its counters onto that creature.'],
['Bloodthirst','If an opponent was dealt damage this turn, it enters with N +1/+1 counters.'],
['Riot','Enters with your choice of a +1/+1 counter or haste.'],
['Unleash','You may have it enter with a +1/+1 counter; it can’t block as long as it has one.'],
['Fabricate','When it enters, put N +1/+1 counters on it or create N 1/1 colorless Servo artifact creature tokens.'],
['Outlast','Pay the cost and tap it: put a +1/+1 counter on it. Only as a sorcery.'],
['Adapt','If it has no +1/+1 counters, put N +1/+1 counters on it.'],
['Monstrosity','If it isn’t monstrous yet, put N +1/+1 counters on it and it becomes monstrous (often triggering a bonus).'],
['Level up','Pay the cost (sorcery speed) to put a level counter on it; it gains the abilities of the level it has reached.'],
['Equip','Pay the cost to attach this Equipment to target creature you control. Only as a sorcery.'],
['Reconfigure','Pay the cost to attach it to a creature (it stops being a creature) or unattach it (it becomes a creature again). Sorcery speed.'],
['Bestow','You can cast it as an Aura that gives its stats and abilities to a creature; if that creature leaves, it becomes a creature itself.'],
['Enchant','This Aura can only be attached to the kind of object named (e.g. “Enchant creature”).'],
['Crew','Tap any untapped creatures you control with total power N or more: this Vehicle becomes an artifact creature until end of turn.'],
['Saddle','Tap creatures you control with total power N or more: this Mount becomes saddled until end of turn. Sorcery speed.'],
['Fortify','Pay the cost to attach this Fortification to target land you control. Sorcery speed.'],
['Kicker','You may pay an extra cost as you cast it for an additional effect.'],
['Multikicker','You may pay the kicker cost any number of times for a bigger effect.'],
['Flashback','You may cast it from your graveyard by paying its flashback cost; then it’s exiled.'],
['Jump-start','You may cast it from your graveyard by paying its mana cost and discarding a card; then it’s exiled.'],
['Escape','You may cast it from your graveyard by paying its escape cost, which includes exiling other cards from your graveyard.'],
['Disturb','You may cast it transformed (back face up) from your graveyard by paying its disturb cost.'],
['Unearth','Pay the cost: return it from your graveyard to the battlefield with haste; exile it at the next end step or if it would leave. Sorcery speed.'],
['Embalm','Exile it from your graveyard and pay the cost: create a token copy of it that’s a white Zombie. Sorcery speed.'],
['Eternalize','Exile it from your graveyard and pay the cost: create a 4/4 black Zombie token copy of it. Sorcery speed.'],
['Encore','Exile it from your graveyard and pay the cost: for each opponent, create a token copy that attacks that opponent this turn; sacrifice them at end step.'],
['Retrace','You may cast it from your graveyard by discarding a land card in addition to paying its other costs.'],
['Aftermath','The second half of this split card can only be cast from your graveyard.'],
['Buyback','You may pay an extra cost as you cast it; if you do, it returns to your hand as it resolves.'],
['Cycling','Pay the cost and discard this card: draw a card.'],
['Landcycling','Pay the cost and discard this card: search your library for a land of the stated type, reveal it and put it in your hand.'],
['Channel','Discard this card and pay the cost to get the stated effect.'],
['Madness','If you discard it, you may cast it right away for its madness cost instead of putting it in your graveyard.'],
['Morph','You may cast it face down as a 2/2 for {3}; turn it face up any time by paying its morph cost.'],
['Megamorph','Like morph, but it gets a +1/+1 counter when turned face up.'],
['Disguise','You may cast it face down as a 2/2 with ward {2} for {3}; turn it face up any time for its disguise cost.'],
['Manifest','Put the top card of your library onto the battlefield face down as a 2/2; if it’s a creature card you can turn it face up for its mana cost.'],
['Cloak','Put the card onto the battlefield face down as a 2/2 with ward {2}; if it’s a creature card you can turn it face up for its mana cost.'],
['Suspend','Instead of casting it, exile it with N time counters by paying the suspend cost; remove a counter each upkeep and cast it free when the last is removed.'],
['Foretell','During your turn, pay {2} to exile it face down; on a later turn you may cast it for its foretell cost.'],
['Plot','Pay the plot cost to exile it face up; on a later turn you may cast it without paying its mana cost, as a sorcery.'],
['Evoke','You may cast it for its evoke cost instead; if you do, it’s sacrificed when it enters (you still get its enter effects).'],
['Dash','You may cast it for its dash cost; it gains haste and returns to your hand at the next end step.'],
['Blitz','You may cast it for its blitz cost; it gains haste and “when this dies, draw a card,” and is sacrificed at the next end step.'],
['Prowl','You may cast it for its prowl cost if a creature of a shared type dealt combat damage to a player this turn.'],
['Spectacle','You may cast it for its spectacle cost if an opponent lost life this turn.'],
['Surge','You may cast it for its surge cost if you or a teammate cast another spell this turn.'],
['Emerge','You may cast it by sacrificing a creature and paying its emerge cost reduced by that creature’s mana value.'],
['Convoke','Your creatures can help pay for this spell: each creature you tap pays for {1} or one mana of its color.'],
['Delve','Each card you exile from your graveyard while casting it pays for {1}.'],
['Improvise','Each artifact you tap while casting it pays for {1}.'],
['Affinity','This spell costs {1} less for each of the stated thing you control (e.g. affinity for artifacts).'],
['Undaunted','This spell costs {1} less for each opponent you have.'],
['Offering','You may cast it any time you could cast an instant by sacrificing a creature of the stated type and paying the difference in cost.'],
['Splice','As you cast a spell of the stated type, you may reveal this and pay its splice cost to add its effect to that spell.'],
['Entwine','For a modal spell, you may pay the entwine cost to choose all the modes.'],
['Escalate','For a modal spell, pay the escalate cost for each mode beyond the first you choose.'],
['Replicate','When you cast it, copy it once for each time you paid its replicate cost.'],
['Storm','When you cast it, copy it for each other spell cast before it this turn.'],
['Cascade','When you cast it, exile cards from the top of your library until you hit a nonland card with lower mana value; you may cast that card free.'],
['Discover','Exile cards from the top of your library until you hit a nonland card with mana value N or less; cast it free or put it into your hand.'],
['Casualty','As you cast it, you may sacrifice a creature with power N or more; if you do, copy the spell.'],
['Squad','As you cast it, you may pay the squad cost any number of times; create that many token copies when it enters.'],
['Cipher','After it resolves, you may encode it on a creature you control; whenever that creature deals combat damage to a player, you may cast a copy.'],
['Overload','You may cast it for its overload cost, changing every “target” in its text to “each”.'],
['Rebound','If you cast it from your hand, exile it as it resolves; at your next upkeep you may cast it from exile for free.'],
['Ninjutsu','Return an unblocked attacker you control to hand and pay the cost: put this onto the battlefield tapped and attacking.'],
['Mutate','You may cast it for its mutate cost onto a non-Human creature you own; they merge into one creature with all the abilities.'],
['Champion','When it enters, exile another creature of the stated type you control or sacrifice this; that card returns when this leaves.'],
['Soulbond','You may pair it with another unpaired creature when either enters; both get the bonus while paired.'],
['Partner','You can have two commanders if both have partner.'],
['Companion','If your deck meets the stated condition, you may start the game with this outside your deck and put it into your hand once for {3}.'],
['Devour','As it enters, you may sacrifice any number of creatures; it enters with N +1/+1 counters for each.'],
['Exploit','When it enters, you may sacrifice a creature to get a bonus.'],
['Extort','Whenever you cast a spell, you may pay {W/B}; if you do, each opponent loses 1 life and you gain that much.'],
['Afterlife','When it dies, create N 1/1 white and black Spirit tokens with flying.'],
['Decayed','Can’t block; when it attacks, sacrifice it at end of combat.'],
['Phasing','It phases in or out each of your untap steps; while phased out it’s treated as though it doesn’t exist.'],
['Vanishing','Enters with N time counters; remove one each upkeep and sacrifice it when the last is removed.'],
['Fading','Enters with N fade counters; remove one each upkeep, and sacrifice it when you can’t.'],
['Echo','At your next upkeep after it enters, pay its echo cost or sacrifice it.'],
['Cumulative upkeep','At each of your upkeeps, add an age counter, then pay the cost for each age counter or sacrifice it.'],
['Hideaway','When it enters, look at the top N cards, exile one face down and put the rest on the bottom; you can play the exiled card when the condition is met.'],
['Daybound','If it’s day: when a player casts no spells on their own turn, it becomes night and this transforms to its nightbound face.'],
['Nightbound','If it’s night: when a player casts two or more spells in a turn, it becomes day and this transforms back.'],
['Exhaust','An activated ability you can only activate once.'],
['Gift','You may promise an opponent a gift as you cast it; if you do, they get the gift and you get an extra effect.'],
['Offspring','You may pay an extra cost as you cast it; when it enters, create a 1/1 token copy of it.'],
['Impending','You may cast it for its impending cost; it enters with N time counters and isn’t a creature until the last is removed.'],
['Living weapon','When this Equipment enters, create a 0/0 black Phyrexian Germ token and attach this to it.'],
['For Mirrodin!','When this Equipment enters, create a 2/2 red Rebel creature token and attach this to it.'],
['Backup','When it enters, put N +1/+1 counters on target creature; if that’s another creature, it also gains this creature’s other abilities until end of turn.'],
['Craft','Exile this and the stated materials from your battlefield/graveyard: return it transformed. Sorcery speed.'],
['Ravenous','Enters with X +1/+1 counters; if X is 5 or more, draw a card when it enters.'],
['Read ahead','As this Saga enters, choose which chapter to start on; earlier chapters don’t trigger.'],
['Visit','An ability that triggers whenever you roll to visit your Attractions and land on this one.'],
['Hidden agenda','Start the game with this conspiracy face down, naming a card; reveal it later for a bonus involving that card.'],
/* keyword actions */
['Scry','Look at the top N cards of your library, then put any number on the bottom and the rest back on top in any order.'],
['Surveil','Look at the top N cards of your library, then put any number into your graveyard and the rest back on top in any order.'],
['Mill','Put the top N cards of your library into your graveyard.'],
['Fight','Each of the two creatures deals damage equal to its power to the other.'],
['Explore','Reveal the top card of your library: if it’s a land, put it in your hand; otherwise put a +1/+1 counter on this and you may put that card into your graveyard.'],
['Investigate','Create a Clue token (an artifact with “{2}, sacrifice this: draw a card”).'],
['Proliferate','Choose any number of permanents and/or players, then give each another counter of each kind already there.'],
['Populate','Create a token that’s a copy of a creature token you control.'],
['Amass','Put N +1/+1 counters on an Army you control; if you don’t have one, first create a 0/0 Army creature token.'],
['Connive','Draw a card, then discard a card; if you discarded a nonland card, put a +1/+1 counter on this creature.'],
['Learn','You may reveal a Lesson card you own from outside the game and put it in your hand, or discard a card to draw a card.'],
['Venture into the dungeon','Move your marker to the next room of a dungeon (starting one if needed) and get that room’s effect.'],
['Initiative','Take the initiative: venture into the Undercity. Whoever deals combat damage to you steals it.'],
['Monarch','Become the monarch: draw an extra card at your end step. A player who deals combat damage to you steals it.'],
['Goad','The goaded creature attacks each combat if able, and attacks a player other than you if able, until your next turn.'],
['Incubate','Create an Incubator artifact token with N +1/+1 counters; pay {2} to transform it into an artifact creature.'],
['Manifest dread','Look at the top two cards; manifest one face down as a 2/2 and put the other into your graveyard.'],
['Collect evidence','Exile cards with total mana value N or more from your graveyard.'],
['Suspect','A suspected creature has menace and can’t block.'],
['Forage','Exile three cards from your graveyard or sacrifice a Food.'],
['Time travel','For each permanent you control and suspended card you own with a time counter, you may add or remove one time counter.'],
['Role','A Role is an Aura token that gives the enchanted creature a bonus; a creature can only have one Role from each player.'],
['Treasure','A Treasure token: {T}, sacrifice it: add one mana of any color.'],
['Food','A Food token: {2}, {T}, sacrifice it: gain 3 life.'],
['Clue','A Clue token: {2}, sacrifice it: draw a card.'],
['Blood','A Blood token: {1}, {T}, discard a card, sacrifice it: draw a card.'],
['Transform','Turn this double-faced card over to its other face.'],
['Regenerate','The next time it would be destroyed this turn, instead tap it, remove it from combat and remove all damage from it.'],
['Sacrifice','Put a permanent you control into its owner’s graveyard (it isn’t “destroyed”, so indestructible doesn’t stop it).'],
['Exile','Move it to the exile zone, outside the game; it doesn’t go to the graveyard.'],
['Detain','Until your next turn, the permanent can’t attack or block and its activated abilities can’t be used.'],
['Tap','Turn it sideways; tapped permanents can’t attack or use {T} abilities until they untap.'],
['Equipped','Refers to the creature this Equipment is attached to.'],
];
function fxKwFind(c){if(!c)return [];const kws=String(c.keywords||'').toLowerCase(),txt=String(c.text||'').toLowerCase().replace(/\([^)]*\)/g,' ');
  const seen=new Set(),out=[];
  const hit=k=>{const w=k.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),re=new RegExp('(^|[^a-z])'+w+'(s|es|ed|d|ing)?([^a-z]|$)');return (kws&&re.test(kws))||re.test(txt)};
  [...FXKW].sort((a,b)=>b[0].length-a[0].length).forEach(([k,d])=>{if(seen.has(k))return;
    /* skip generic words that only count as keywords in a few contexts */
    if(['Tap','Exile','Sacrifice','Transform','Equipped','Enchant','Treasure','Food','Clue','Blood','Role','Partner','Protection','Flash','Fight','Visit','Suspect','Learn','Gift'].includes(k)&&!new RegExp('(^|, )'+k.toLowerCase()+'($|,)').test(kws)){
      if(k==='Fight'&&/\bfights?\b/.test(txt)){seen.add(k);out.push([k,d])}
      if(k==='Treasure'||k==='Food'||k==='Clue'||k==='Blood'){if(new RegExp('\\b'+k.toLowerCase()+' tokens?\\b').test(txt)){seen.add(k);out.push([k,d])}}
      if(k==='Protection'&&/\bprotection from\b/.test(txt)){seen.add(k);out.push([k,d])}
      if(k==='Flash'&&/(^|\n)flash(\n|$)/.test(txt)){seen.add(k);out.push([k,d])}
      if(k==='Transform'&&/\btransforms?\b/.test(txt)){seen.add(k);out.push([k,d])}
      if(k==='Enchant'&&/(^|\n)enchant /.test(txt)){seen.add(k);out.push([k,d])}
      return}
    if(hit(k)){if(k==='First strike'&&seen.has('Double strike')&&!/first strike/.test(txt.replace(/double strike/g,'')))return;if(k==='Cycling'&&seen.has('Landcycling')&&!/(^|[^a-z])cycling/.test(txt.replace(/\w+cycling/g,'')))return;if(k==='Kicker'&&seen.has('Multikicker')&&!/(^|[^a-z])kicker/.test(txt.replace(/multikicker/g,'')))return;if(k==='Morph'&&seen.has('Megamorph'))return;if(k==='Manifest'&&seen.has('Manifest dread')&&!/manifest(?! dread)/.test(txt))return;
      seen.add(k);out.push([k,d])}});
  /* landwalk variants */
  if(/\b(plains|island|swamp|mountain|forest|desert)walk\b/.test(kws+' '+txt)&&!seen.has('Landwalk'))out.push(['Landwalk',FXKW.find(x=>x[0]==='Landwalk')[1]]);
  return out.sort((a,b)=>txt.indexOf(a[0].toLowerCase())-txt.indexOf(b[0].toLowerCase()))}
function fxKwBox(c){const L=fxKwFind(c);if(!L.length)return '';
  return `<div class="sec kwbox"><h4>Abilities explained</h4><ul>${L.map(([k,d])=>`<li><b>${esc(k)}</b> — ${symHtml(d)}</li>`).join('')}</ul></div>`}

