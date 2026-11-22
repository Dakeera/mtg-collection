/* MtG DeckMaster — battle simulator, engine v2 (owner request: “make it more robust and realistic”).
   Shared by the website and the Android app. It runs inside a Web Worker when the browser allows it (the screen
   stays responsive), otherwise on the page. A simplified model — not a full rules engine — that knows:
   • mana colors (lands only make their real colors; spells need the right colors; taplands, fetches, mana rocks/dorks)
   • London mulligan (draw 7, keep or mulligan, put cards on the bottom)
   • card behaviour read from the rules text (Scryfall’s oracle text when the page could get it): removal, burn, wipes,
     draw, ramp, tokens, counterspells, discard, lifegain, anthems, auras/equipment (with equip costs), +1/+1 counters,
     artifact/enchantment removal, combat tricks, planeswalkers (loyalty + one ability per turn)
   • triggered abilities: enters / dies / attacks / upkeep with the usual effects
   • activated abilities: {T} pingers, {T} card draw, mana, pump sinks, equip
   • instant speed: removal on attackers, counterspells, combat tricks, flash creatures and draw at the opponent’s end step
   • combat with keywords (flying, reach, trample, deathtouch, first/double strike, lifelink, menace, vigilance, haste,
     defender, indestructible, hexproof/ward) and a one-turn race look-ahead before attacking
   • best-of-three matches: game 1 with the main deck, then side-deck cards are swapped in for the matchup
   • a turn-by-turn log of one sample game, per-card stats (win rate when drawn, stuck in hand) and a margin of error. */
(function(root){
'use strict';
const SIMV=2;
const W={a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,x:3};
const num=s=>s==null?0:(/^\d+$/.test(s)?+s:(W[String(s).toLowerCase()]||1));
const CL=['W','U','B','R','G'],BASIC={plains:'W',island:'U',swamp:'B',mountain:'R',forest:'G'};
const rnd=n=>Math.floor(Math.random()*n);
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=rnd(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};

/* ---------- reading a card ---------- */
function costOf(str){const r={g:0,c:{},hy:[],x:0};
  (String(str||'').match(/\{[^}]+\}/g)||[]).forEach(t=>{const x=t.slice(1,-1).toUpperCase();
    if(/^\d+$/.test(x))r.g+=+x;else if(x==='X')r.x++;else if(CL.includes(x)||x==='C')r.c[x]=(r.c[x]||0)+1;
    else if(x.includes('/')){const p=x.split('/');if(p.includes('P'))r.g++;else{const o=p.filter(y=>CL.includes(y));if(o.length)r.hy.push(o);else r.g++}}
    else if(x!=='S')r.g++});return r}
const cmcOf=k=>k.g+k.x*2+Object.values(k.c).reduce((a,b)=>a+b,0)+k.hy.length;
/* the effect of a piece of rules text (a whole spell, or one trigger / ability clause) */
function effOf(t){const o={};if(!t)return o;
  const m1=t.match(/deals? (\d+|x) damage to (any target|target player|each opponent|target opponent|target creature or player|any other target|target player or planeswalker|each player)/);if(m1)o.burn=num(m1[1]);
  const m2=t.match(/deals? (\d+|x) damage to (?:another |up to one )?target (?:creature|attacking|blocking|tapped)/);
  if(/(destroy|exile) target (creature|permanent|nonland|attacking|blocking|tapped)|target creature gets -\d+\/-\d+|target (opponent|player) sacrifices a creature|fights? (another |up to one )?target creature|return target (nonland permanent|creature) to its owner'?s hand|enchanted creature can'?t attack or block|enchanted creature can'?t attack, block/.test(t))o.kill=99;
  else if(m2)o.kill=num(m2[1]);else if(o.burn)o.kill=o.burn;
  const md=t.match(/deals? (\d+|x) damage divided as you choose among (?:one, two, or three|any number of) targets?/);if(md&&!o.kill)o.kill=Math.max(3,num(md[1]));
  if(/(destroy|exile) all (other )?(creatures|nonland permanents)|all creatures get -\d|damage to each creature|each player sacrifices all creatures/.test(t))o.wrath=1;
  if(/(destroy|exile) target (artifact|enchantment|artifact or enchantment|noncreature permanent)/.test(t))o.artkill=1;
  const m3=t.match(/draws? (a|an|one|two|three|four|five|x|\d+) cards?/);if(m3)o.draw=num(m3[1]);
  const m4=t.match(/gains? (\d+|x) life/);if(m4)o.gain=num(m4[1]);
  if(/counter target (\w+ )?spell/.test(t))o.counter=1;
  if(/target (opponent|player) (reveals .*?)?discards?|each opponent discards/.test(t))o.discard=1;
  if(/search your library for (a|an|up to \w+) (basic )?(land|forest|plains|island|swamp|mountain)/.test(t))o.ramp=1;
  const m5=t.match(/creates? (a|an|one|two|three|four|five|x|\d+) (?:tapped )?(\d+)\/(\d+)/);if(m5)o.tok={n:num(m5[1]),p:+m5[2],t:Math.max(1,+m5[3]),fly:/flying/.test(t.slice(m5.index,m5.index+110)),opp:/(its controller|that player|target opponent|each opponent) creates?$/.test(t.slice(Math.max(0,m5.index-30),m5.index+7).trim())};
  const m6=t.match(/creatures you control get \+(\d+)\/\+(\d+)/);if(m6)o.anthem=[+m6[1],+m6[2]];
  const m8=t.match(/target creature (?:you control )?gets \+(\d+)\/\+(\d+)/);if(m8&&!/-\d+\/-\d+/.test(t))o.trick=[+m8[1],+m8[2]];
  const m9=t.match(/put (a|an|one|two|three|x|\d+) \+1\/\+1 counters? on (target|each) creature/);if(m9)o.ctr=num(m9[1]);
  return o}
const hasAny=o=>Object.keys(o).length>0;
function landColors(c,t,ty){const s=new Set();
  (c.produced_mana||[]).forEach(x=>{if(CL.includes(x)||x==='C')s.add(x)});
  Object.keys(BASIC).forEach(b=>{if(new RegExp('\\b'+b+'\\b').test(ty))s.add(BASIC[b])});
  (t.match(/add [^.]*/g)||[]).forEach(a=>{(a.match(/\{[wubrgc]\}/g)||[]).forEach(x=>s.add(x[1].toUpperCase()));if(/any color|any one color|mana of any/.test(a))CL.forEach(x=>s.add(x))});
  const f=t.match(/search your library for an? ((?:basic )?(?:plains|island|swamp|mountain|forest)(?:(?:,| or) (?:plains|island|swamp|mountain|forest))*) card/);
  if(f)Object.keys(BASIC).forEach(b=>{if(f[1].includes(b))s.add(BASIC[b])});
  if(/search your library for a basic land/.test(t))CL.forEach(x=>s.add(x));
  if(!s.size&&c.name)Object.keys(BASIC).forEach(b=>{if(new RegExp('\\b'+b+'\\b','i').test(c.name))s.add(BASIC[b])});
  if(!s.size)s.add('C');return [...s]}
/* every card of a deck is turned into a small “profile” once, then played many times */
function profile(c,name){
  if(!c)return {n:name,cmc:3,cost:{g:3,c:{},hy:[],x:0},k:'spell',unk:true};
  const t=String(c.oracle_text||c.text||'').toLowerCase().replace(/\([^)]*\)/g,''),ty=String(c.type_line||c.type||'').toLowerCase(),nm=String(c.name||name);
  const self=nm.toLowerCase().split(' // ')[0],tt=t.split(self).join('~').replace(/this creature|this permanent|this artifact|this enchantment/g,'~');
  const kw=String(Array.isArray(c.keywords)?c.keywords.join(', '):c.keywords||'').toLowerCase(),kwl=(kw&&kw!=='none'?kw:'')+', '+tt.split('\n').filter(l=>!/[.:]/.test(l)).join(', '),has=w=>new RegExp('\\b'+w+'\\b').test(kwl);
  const cost=costOf(c.mana_cost||c.cost),o={n:nm,cost,cmc:Math.max(0,Math.round(parseFloat(c.cmc))||cmcOf(cost))};
  o.cols=[...new Set([...Object.keys(cost.c).filter(x=>x!=='C'),...cost.hy.flat()])];
  if(/\bland\b/.test(ty)&&!/creature/.test(ty)){o.k='land';o.lc=landColors(Object.assign({},c,{name:nm}),String(c.oracle_text||c.text||'').toLowerCase(),ty);o.tapped=/enters( the battlefield)? tapped/.test(t)?(/unless/.test(t)?0.5:1):0;o.fetch=/search your library for/.test(t)&&/sacrifice/.test(t);o.basic=/\bbasic\b/.test(ty);return o}
  /* split the text into trigger clauses, activated abilities and the rest */
  const lines=tt.split('\n'),rest=[],trig={},act=[];
  lines.forEach(l=>{let m;
    if((m=l.match(/^(when|whenever) [^,]*?(~|it) enters[^,]*, (.*)$/)))trig.etb=Object.assign(trig.etb||{},effOf(m[3]));
    else if((m=l.match(/^(when|whenever) [^,]*?(~|it) dies[^,]*, (.*)$/)))trig.dies=Object.assign(trig.dies||{},effOf(m[3]));
    else if((m=l.match(/^whenever [^,]*?(~|it) attacks[^,]*, (.*)$/)))trig.atk=Object.assign(trig.atk||{},effOf(m[2]));
    else if((m=l.match(/^at the beginning of (your upkeep|your end step|each upkeep|your precombat main phase)[^,]*, (.*)$/)))trig.upk=Object.assign(trig.upk||{},effOf(m[2]));
    else if((m=l.match(/^((?:\{[^}]+\}(?:, )?)+(?:, sacrifice [^:]*)?|equip \{\d+\}|equip \d+): (.*)$/))&&!/only your opponents/.test(m[2])){const ab={cost:costOf(m[1].replace(/\{t\}|\{q\}/g,'')),tap:/\{t\}/.test(m[1]),sac:/sacrifice/.test(m[1]),e:effOf(m[2])};
      if(/add \{|add (one|two|three) mana|mana of any/.test(m[2]))ab.mana=landColors({},m[2],'');
      const pp=m[2].match(/~ gets \+(\d+)\/\+(\d+)/);if(pp)ab.pump=[+pp[1],+pp[2]];act.push(ab)}
    else if((m=l.match(/^equip (?:\{(\d+)\}|(\d+))/)))o.equip=+(m[1]||m[2]);
    else rest.push(l)});
  const rt=rest.join('\n');Object.assign(o,effOf(rt));
  const eq=t.match(/equip (?:\{(\d+)\}|(\d+))/);if(eq)o.equip=+(eq[1]||eq[2]);
  const ab=t.match(/(?:enchanted|equipped) creature gets \+(\d+)\/\+(\d+)/);if(ab){o.aura=[+ab[1],+ab[2]];delete o.trick}
  if(hasAny(trig))o.trig=trig;const ma=act.filter(a=>a.mana),oa=act.filter(a=>!a.mana);if(ma.length){o.mana=ma[0].mana;o.ramp=1}if(oa.length)o.act=oa;
  o.inst=/instant/.test(ty)||has('flash');
  if(/creature/.test(ty)){o.k='creature';const pi=parseInt(c.power),ti=parseInt(c.toughness);o.p=isNaN(pi)?Math.max(1,o.cmc-1):Math.max(0,pi);o.t=isNaN(ti)?Math.max(1,o.cmc-1):Math.max(1,ti);
    const ec=t.match(/enters (?:the battlefield )?with (a|an|one|two|three|four|five|x|\d+) \+1\/\+1 counters?/);if(ec){o.p+=num(ec[1]);o.t+=num(ec[1])}
    ['flying','reach','trample','haste','deathtouch','lifelink','vigilance','menace','defender','indestructible'].forEach(k=>{if(has(k))o[k]=1});
    o.ds=has('double strike');o.fs=o.ds||has('first strike');o.hex=has('hexproof')||has('shroud')||has('ward');delete o.trick;return o}
  if(/planeswalker/.test(ty)){o.k='pw';o.loy=parseInt(c.loyalty)||3;const pl=(String(c.oracle_text||c.text||'').toLowerCase().match(/^\+\d+: .*$/m)||[''])[0];o.pwe=effOf(pl);if(!hasAny(o.pwe))o.pwe={draw:1};return o}
  if(/artifact|enchantment|battle/.test(ty)&&!/instant|sorcery/.test(ty)){o.k='perm';if(/artifact/.test(ty))o.art=1;else o.ench=1;return o}
  o.k='spell';o.sorc=/sorcery/.test(ty);return o}

/* ---------- a deck, ready to play ---------- */
function prep(deck){const main=[],side=[],unk=new Set();let cmdr=null;const cn=deck.commander?String(deck.commander).toLowerCase().split(' // ')[0]:'';
  deck.cards.forEach(e=>{const p=profile(e.card,e.name);if(p.unk)unk.add(e.name);
    for(let i=0;i<(e.main||0);i++){if(cn&&!cmdr&&p.k==='creature'&&String(e.name).toLowerCase().split(' // ')[0]===cn){cmdr=p;continue}main.push(p)}
    for(let i=0;i<(e.side||0);i++)side.push(p)});
  return {name:deck.name,main,side,cmdr,unk:[...unk],life:deck.life||20}}
/* what a deck looks like to its opponent (for sideboarding) */
function shape(list){const n=list.length||1,nl=list.filter(c=>c.k!=='land'),cr=list.filter(c=>c.k==='creature');
  return {n,cre:cr.length/n,fly:cr.filter(c=>c.flying).length/n,spells:list.filter(c=>c.k==='spell').length/n,arts:list.filter(c=>c.art||c.ench||c.equip||c.aura).length/n,
    burn:list.filter(c=>c.burn).length/n,wide:list.filter(c=>c.tok).length/n+cr.filter(c=>c.cmc<=2).length/n,avg:nl.reduce((a,c)=>a+c.cmc,0)/(nl.length||1)}}
/* how good a card is against that opponent */
function value(c,S){if(c.k==='land')return 99;let v=3+(c.k==='creature'?(c.p+c.t)/4:0)+(c.draw||0)*0.6;
  if(c.kill)v+=S.cre*8-1.5;if(c.wrath)v+=S.wide*10+S.cre*4-3;if(c.counter)v+=S.spells*8+(S.avg-3)-1;if(c.artkill)v+=S.arts*14-3;if(c.discard)v+=S.spells*5-0.5;
  if(c.gain)v+=S.burn*10-0.5;if(c.reach||c.kill)v+=S.fly*4;if(c.burn&&!c.kill)v-=0.5;if(c.k==='creature'&&S.avg<2.6&&c.cmc>=5)v-=1;return v}
function sideboard(D,opp){if(!D.side.length)return {main:D.main,plan:[]};const S=shape(opp.main),main=D.main.slice(),side=D.side.slice(),plan=[];
  for(let k=0;k<15&&side.length;k++){let bi=-1,bv=-1e9;side.forEach((c,i)=>{const v=value(c,S);if(v>bv){bv=v;bi=i}});
    let wi=-1,wv=1e9;main.forEach((c,i)=>{if(c.k==='land'||c===D.cmdr)return;const v=value(c,S);if(v<wv){wv=v;wi=i}});
    if(wi<0||bv<wv+1.5)break;plan.push([side[bi].n,main[wi].n]);const out=main[wi];main[wi]=side[bi];side.splice(bi,1);side.push(out)}
  return {main,plan}}

/* ---------- mana ---------- */
/* sources: untapped lands, rocks and ready mana creatures, each with the colors it can make. Pays colored pips first
   (scarcest first, using the least flexible source), then hybrid, then generic. Returns the sources to tap, or null. */
function pay(srcs,cost,extra){const free=srcs.filter(s=>!s.used),use=[];
  const take=col=>{const c=free.filter(s=>!use.includes(s)&&s.c.includes(col)).sort((a,b)=>a.c.length-b.c.length)[0];if(c){use.push(c);return true}return false};
  const pips=[];Object.entries(cost.c).forEach(([k,v])=>{for(let i=0;i<v;i++)pips.push(k)});
  pips.sort((a,b)=>free.filter(s=>s.c.includes(a)).length-free.filter(s=>s.c.includes(b)).length);
  for(const p of pips)if(!take(p))return null;
  for(const h of cost.hy)if(!h.some(take))return null;
  let g=cost.g+(extra||0);const left=free.filter(s=>!use.includes(s)).sort((a,b)=>a.c.length-b.c.length);if(left.length<g)return null;use.push(...left.slice(0,g));return use}
function sources(me){const s=[];me.lands.forEach(l=>{if(!l.tap)s.push({c:l.c,o:l})});me.rocks.forEach(r=>{if(!r.tap)s.push({c:r.c,o:r})});
  me.bf.forEach(x=>{if(x.c.mana&&!x.sick&&!x.tap)s.push({c:x.c.mana,o:x,cre:1})});return s}
const tapAll=u=>u.forEach(s=>{s.o.tap=true;s.used=true});
const canCast=(me,c,extra)=>!!pay(sources(me),c.cost,extra);

/* ---------- the game ---------- */
function Game(A,B,first,life,lists,log){this.L=log?[]:null;this.P=[0,1].map(i=>{const d=i?B:A;return {i,name:d.name,lib:shuffle(lists[i].slice()),hand:[],bf:[],perms:[],lands:[],rocks:[],life,cz:d.cmdr,tax:0,anth:[0,0],seen:new Set(),mull:0,poisonless:1}});this.t=first;this.turn=0}
const P_=Game.prototype;
P_.log=function(s){if(this.L&&this.L.length<600)this.L.push(s)};
P_.draw=function(p,n){while(n-->0){if(!p.lib.length){p.decked=true;return}const c=p.lib.pop();p.hand.push(c);p.seen.add(c.n)}};
P_.keep=function(h,m){const L=h.filter(c=>c.k==='land').length,n=h.length;if(m>=2)return true;if(m===1)return L>=1&&L<=n-1;
  if(L<2||L>5)return false;const cols=new Set(h.filter(c=>c.k==='land').flatMap(c=>c.lc));return h.some(c=>c.k!=='land'&&c.cmc<=L+1&&c.cols.every(x=>cols.has(x)))||L>=3};
P_.mulligan=function(p){for(let m=0;;m++){p.lib=shuffle(p.lib.concat(p.hand));p.hand=[];p.seen=new Set();this.draw(p,7);if(this.keep(p.hand,m)||m>=3){
    for(let k=0;k<m;k++){const L=p.hand.filter(c=>c.k==='land').length,idx=L>3?p.hand.findIndex(c=>c.k==='land'):p.hand.reduce((bi,c,i)=>c.k!=='land'&&(bi<0||c.cmc>p.hand[bi].cmc)?i:bi,-1);const c=p.hand.splice(idx<0?0:idx,1)[0];p.lib.unshift(c)}
    p.mull=m;if(m)this.log(`${p.name} mulligans to ${7-m}.`);return}}};
const pw=x=>x.p+x.o.anth[0]+(x.eq||0),tg=x=>x.t+x.o.anth[1]+(x.eqt||0);
const threat=x=>pw(x)+tg(x)+(x.c.flying?2:0)+(x.c.deathtouch?2:0)+(x.c.lifelink?1:0);
P_.die=function(x){const o=x.o,i=o.bf.indexOf(x);if(i<0)return;o.bf.splice(i,1);o.perms.forEach(e=>{if(e.on===x)e.on=null});if(x.c.trig&&x.c.trig.dies)this.effect(x.c.trig.dies,o,this.P[1-o.i],x.c.n+' (dies)');
  if(x.cz){o.cz=x.c;o.tax+=2;this.log(`${o.name}’s commander ${x.c.n} goes back to the command zone.`)}};
P_.target=function(op,dmg){return op.bf.filter(x=>!x.c.hex&&(dmg>=99?!x.c.indestructible:tg(x)<=dmg)).sort((a,b)=>threat(b)-threat(a))[0]};
/* apply an effect (spell, trigger, ability) */
P_.effect=function(e,me,op,src){if(!e)return;const L=[];
  if(e.wrath){[...me.bf,...op.bf].forEach(x=>{if(!x.c.indestructible)this.die(x)});L.push('wipes the board')}
  if(e.kill||e.burn){const t=this.target(op,e.kill||e.burn);
    if(e.burn&&(op.life<=e.burn||!t||(threat(t)<3&&op.life<=e.burn*3))){op.life-=e.burn;L.push(`${e.burn} damage to ${op.name} (${op.life} life)`)}else if(t){this.die(t);L.push('removes '+t.c.n)}}
  if(e.artkill){const t=op.perms.find(x=>x.c.art||x.c.ench)||op.rocks.find(r=>r.card);if(t){if(op.perms.includes(t)){op.perms.splice(op.perms.indexOf(t),1);this.unequip(t)}else op.rocks.splice(op.rocks.indexOf(t),1);L.push('destroys '+(t.c||t.card).n)}}
  if(e.draw){this.draw(me,e.draw);L.push(`draws ${e.draw}`)}
  if(e.gain){me.life+=e.gain;L.push(`gains ${e.gain} (${me.life})`)}
  if(e.discard&&op.hand.length){const i=op.hand.reduce((bi,c,j)=>c.k!=='land'&&(bi<0||c.cmc>op.hand[bi].cmc)?j:bi,-1);if(i>=0){L.push('makes them discard '+op.hand[i].n);op.hand.splice(i,1)}}
  if(e.ramp&&!e.mana){const l=me.lib.findIndex(c=>c.k==='land'&&c.basic);if(l>=0){const c=me.lib.splice(l,1)[0];me.lands.push({c:c.lc,tap:true,card:c});L.push('ramps')}else me.rocks.push({c:CL,tap:true})}
  if(e.tok){const w=e.tok.opp?op:me;for(let i=0;i<e.tok.n;i++)w.bf.push({c:{n:'token',k:'creature',cmc:0,p:e.tok.p,t:e.tok.t,flying:e.tok.fly},p:e.tok.p,t:e.tok.t,tap:false,sick:true,o:w});L.push(`${e.tok.opp?'gives them':'makes'} ${e.tok.n} token${e.tok.n>1?'s':''}`)}
  if(e.anthem){me.anth[0]+=e.anthem[0];me.anth[1]+=e.anthem[1]}
  if(e.ctr){const b=[...me.bf].sort((a,b)=>threat(b)-threat(a))[0];if(b){b.p+=e.ctr;b.t+=e.ctr}}
  if(L.length&&src)this.log(`  ${src}: ${L.join(', ')}.`)};
P_.unequip=function(e){if(e.on){e.on.eq=(e.on.eq||0)-e.c.aura[0];e.on.eqt=(e.on.eqt||0)-e.c.aura[1];e.on=null}};
P_.enter=function(me,op,c,cz){
  if(c.k==='creature'){const x={c,p:c.p,t:c.t,tap:false,sick:!c.haste,o:me,cz:!!cz};me.bf.push(x);if(c.trig&&c.trig.etb)this.effect(c.trig.etb,me,op,c.n+' enters');if(c.anthem){me.anth[0]+=c.anthem[0];me.anth[1]+=c.anthem[1]}return}
  if(c.k==='pw'){me.perms.push({c,loy:c.loy});return}
  if(c.k==='perm'){if(c.mana&&!c.aura&&!c.equip){me.rocks.push({c:c.mana,tap:false,card:c});return}const x={c};me.perms.push(x);
    if(c.aura&&!c.equip){const b=[...me.bf].sort((a,b)=>threat(b)-threat(a))[0];if(b){x.on=b;b.eq=(b.eq||0)+c.aura[0];b.eqt=(b.eqt||0)+c.aura[1]}}
    this.effect(Object.assign({},c,{aura:0,k:0}),me,op,c.n);return}
  this.effect(c,me,op,c.n)};
/* casting: pay, give the opponent a chance to counter it, then resolve */
P_.cast=function(me,op,c,from){const extra=from==='cz'?me.tax:0,u=pay(sources(me),c.cost,extra);if(!u)return false;tapAll(u);
  if(from==='cz'){me.cz=null}else me.hand.splice(me.hand.indexOf(c),1);
  this.log(`${me.name} casts ${c.n}${from==='cz'?' from the command zone':''}.`);
  if(c.cmc>=2&&this.respondCounter(op,c)){if(from==='cz'){me.cz=c;me.tax+=2}return true}
  this.enter(me,op,c,from==='cz');return true};
P_.respondCounter=function(op,c){const k=op.hand.find(h=>h.counter&&h.k==='spell'&&canCast(op,h));if(!k||Math.random()>0.8)return false;
  const u=pay(sources(op),k.cost);if(!u)return false;tapAll(u);op.hand.splice(op.hand.indexOf(k),1);this.log(`  ${op.name} counters it with ${k.n}.`);return true};
/* what to cast now, best first; instant-speed interaction is kept for the opponent’s turn when it matters */
P_.priority=function(me,op,c){const my=me.bf.reduce((a,x)=>a+pw(x),0),their=op.bf.reduce((a,x)=>a+pw(x),0);
  if(c.k==='land')return -1;if(c.counter&&c.k==='spell')return -1;if(c.trick&&c.k==='spell'&&!c.draw)return -1;
  if(c.wrath&&c.k==='spell')return their-my>=4&&op.bf.length>=2?95:-1;
  if((c.ramp||c.mana)&&c.k!=='creature')return me.lands.length<6?90:20;
  if(c.k==='creature')return (c.mana&&me.lands.length<5?85:60)+c.cmc+(c.inst?-30:0);
  if(c.kill||c.burn){if(c.inst&&op.bf.length)return -1;const t=this.target(op,c.kill||c.burn);return t?80:c.burn?(op.life<=c.burn*2||!me.bf.length?45:25):-1}
  if(c.artkill)return op.perms.some(x=>x.c.art||x.c.ench)||op.rocks.some(r=>r.card)?70:-1;
  if(c.discard)return op.hand.length?52:-1;
  if(c.k==='pw')return 62;if(c.tok)return 58;if(c.equip)return me.bf.length?57:30;if(c.anthem||c.aura)return me.bf.length?55:-1;
  if(c.draw)return c.inst?-1:50;if(c.gain)return 20;if(c.k==='perm')return 30;return 15};
P_.reserve=function(me,op){const h=me.hand.filter(c=>c.inst&&(c.counter||c.kill||c.trick)&&c.k!=='creature');if(!h.length)return null;
  /* only hold mana up when we are not behind on the board — otherwise develop */
  const my=me.bf.reduce((a,x)=>a+pw(x),0),their=op.bf.reduce((a,x)=>a+pw(x),0);if(their>my||(their>0&&me.life<=8&&!h.some(c=>c.kill)))return null;return h.sort((a,b)=>a.cmc-b.cmc)[0]};
P_.playLand=function(me){const L=me.hand.filter(c=>c.k==='land');if(!L.length)return;
  const need=new Set(me.hand.filter(c=>c.k!=='land').flatMap(c=>c.cols)),have=new Set(me.lands.flatMap(l=>l.c)),canNow=me.hand.some(c=>c.k!=='land'&&c.cmc<=me.lands.length+1);
  const sc=l=>l.lc.filter(x=>need.has(x)&&!have.has(x)).length*3+l.lc.filter(x=>need.has(x)).length-(l.tapped&&canNow?2:0)+(l.tapped&&!canNow?1:0);
  const l=L.sort((a,b)=>sc(b)-sc(a))[0];me.hand.splice(me.hand.indexOf(l),1);const tp=l.tapped>=1||(l.tapped&&Math.random()<l.tapped);
  if(l.fetch)me.life-=1;me.lands.push({c:l.lc,tap:tp,card:l});this.log(`${me.name} plays ${l.n}${tp?' (tapped)':''}.`)};
P_.main=function(me,op){this.playLand(me);
  for(let g=0;g<30;g++){const res=this.reserve(me,op),opts=me.hand.map(c=>({c,from:'hand'}));if(me.cz)opts.push({c:me.cz,from:'cz'});
    const ok=opts.map(o=>({o,p:this.priority(me,op,o.c)})).filter(x=>x.p>=0&&x.o.c!==res).filter(x=>{const u=pay(sources(me),x.o.c.cost,x.o.from==='cz'?me.tax:0);if(!u)return false;
      if(!res||x.p>=85)return true;const left=sources(me).filter(s=>!u.includes(s));return !!pay(left,res.cost)}).sort((a,b)=>b.p-a.p||b.o.c.cmc-a.o.c.cmc)[0];
    if(!ok)break;this.cast(me,op,ok.o.c,ok.o.from);if(op.life<=0)return}
  /* planeswalkers use one ability, equipment gets attached, activated abilities are used with spare mana */
  me.perms.filter(x=>x.c.k==='pw').forEach(x=>{x.loy++;this.effect(x.c.pwe,me,op,x.c.n)});
  me.perms.filter(x=>x.c.equip&&!x.on&&me.bf.length).forEach(e=>{const b=[...me.bf].sort((a,b)=>threat(b)-threat(a))[0],u=pay(sources(me),{g:e.c.equip,c:{},hy:[],x:0});if(b&&u){tapAll(u);e.on=b;b.eq=(b.eq||0)+(e.c.aura||[1,0])[0];b.eqt=(b.eqt||0)+(e.c.aura||[0,1])[1];this.log(`  equips ${e.c.n} to ${b.c.n}.`)}});
  this.abilities(me,op,false)};
P_.abilities=function(me,op,endStep){me.bf.forEach(x=>{(x.c.act||[]).forEach(a=>{if(a.tap&&(x.tap||x.sick))return;if(a.pump)return;const e=a.e;if(!(e.burn||e.kill||e.draw||e.gain||e.tok))return;
    if(this.reserve(me,op)&&!endStep)return;const u=pay(sources(me).filter(s=>s.o!==x),a.cost);if(!u)return;if((e.kill||e.burn)&&!e.draw&&!this.target(op,e.kill||e.burn)&&!(e.burn&&op.life<=e.burn*3))return;
    tapAll(u);if(a.tap)x.tap=true;this.effect(e,me,op,x.c.n+' (ability)')})})};
/* attackers: all in when lethal; otherwise attack where it is safe or a good trade, and look one turn ahead:
   don’t leave yourself dead to the crack-back */
P_.combat=function(me,op){
  let atk=me.bf.filter(x=>!x.tap&&!x.sick&&!x.c.defender&&pw(x)>0);if(!atk.length)return;
  const blk=op.bf.filter(x=>!x.tap),canB=(b,a)=>!a.c.flying||b.c.flying||b.c.reach,evas=a=>{const n=blk.filter(b=>canB(b,a)).length;return n===0||(a.c.menace&&n<2)};
  let nb=blk.length,pot=0;[...atk].sort((a,b)=>pw(b)-pw(a)).forEach(a=>{if(evas(a))pot+=pw(a)*(a.c.ds?2:1);else if(nb>0)nb--;else pot+=pw(a)});
  const allIn=pot>=op.life;
  if(!allIn){const back=op.bf.reduce((a,x)=>a+pw(x)*(x.c.ds?2:1),0);
    atk=atk.filter(a=>{const th=blk.filter(b=>canB(b,a)&&(pw(b)>=tg(a)||b.c.deathtouch)&&!a.c.indestructible);
      if(th.length&&!(me.bf.length>op.bf.length&&th.every(b=>pw(a)>=tg(b)&&!b.c.indestructible&&a.c.cmc<=b.c.cmc)))return false;return true});
    /* look-ahead: keep enough untapped (non-vigilant) blockers so the opponent can’t kill us next turn */
    let stay=me.bf.filter(x=>!atk.includes(x)||x.c.vigilance).reduce((a,x)=>a+1,0);
    while(atk.length&&back-Math.min(stay,op.bf.length)*2>=me.life){const z=atk.filter(a=>!a.c.vigilance).sort((a,b)=>pw(a)-pw(b))[0];if(!z)break;atk.splice(atk.indexOf(z),1);stay++}}
  if(!atk.length)return;atk.forEach(a=>{if(!a.c.vigilance)a.tap=true;if(a.c.trig&&a.c.trig.atk)this.effect(a.c.trig.atk,me,op,a.c.n+' attacks')});
  this.log(`${me.name} attacks with ${atk.map(a=>a.c.n).join(', ')}.`);
  /* the defender may kill an attacker at instant speed first */
  const ir=op.hand.find(h=>h.inst&&h.kill&&h.k!=='creature'&&canCast(op,h));if(ir){const t=atk.filter(a=>!a.c.hex&&(ir.kill>=99?!a.c.indestructible:tg(a)<=ir.kill)).sort((a,b)=>threat(b)-threat(a))[0];
    if(t){tapAll(pay(sources(op),ir.cost));op.hand.splice(op.hand.indexOf(ir),1);this.log(`  ${op.name} casts ${ir.n} on ${t.c.n}.`);this.die(t);atk=atk.filter(a=>a!==t)}}
  const free=[...blk].filter(b=>op.bf.includes(b)),blocks=new Map(),must=atk.reduce((a,x)=>a+pw(x)*(x.c.ds?2:1),0)>=op.life;
  [...atk].sort((a,b)=>pw(b)-pw(a)).forEach(a=>{const c=free.filter(b=>canB(b,a));if(!c.length||(a.c.menace&&c.length<2))return;
    const surv=b=>b.c.indestructible||!(pw(a)>=tg(b)||a.c.deathtouch),kills=b=>!a.c.indestructible&&(pw(b)>=tg(a)||b.c.deathtouch)&&(surv(b)||!(a.c.fs&&!b.c.fs));
    let pick=c.find(b=>surv(b)&&kills(b))||c.find(surv)||c.find(b=>kills(b)&&b.c.cmc<=a.c.cmc+1);
    if(!pick&&must)pick=[...c].sort((x,y)=>(pw(x)+tg(x))-(pw(y)+tg(y)))[0];if(!pick)return;
    const bs=[pick];free.splice(free.indexOf(pick),1);
    if(a.c.menace){const s2=free.filter(b=>canB(b,a)).sort((x,y)=>(pw(x)+tg(x))-(pw(y)+tg(y)))[0];if(!s2){free.push(pick);return}bs.push(s2);free.splice(free.indexOf(s2),1)}
    blocks.set(a,bs)});
  if(blocks.size)this.log(`  ${op.name} blocks: ${[...blocks].map(([a,bs])=>`${bs.map(b=>b.c.n).join(' + ')} on ${a.c.n}`).join('; ')}.`);
  /* combat tricks: the attacker pumps a blocked creature that would die, the defender saves a blocker */
  const trick=(who,x,need)=>{const k=who.hand.find(h=>h.trick&&h.k==='spell'&&canCast(who,h));if(!k||k.trick[1]<need)return;tapAll(pay(sources(who),k.cost));who.hand.splice(who.hand.indexOf(k),1);x.p+=k.trick[0];x.t+=k.trick[1];x.tmp=(x.tmp||[0,0]).map((v,i)=>v+k.trick[i]);this.log(`  ${who.name} casts ${k.n} on ${x.c.n}.`)};
  blocks.forEach((bs,a)=>{const bd=bs.reduce((s,b)=>s+pw(b),0);if(bd>=tg(a)&&!a.c.indestructible)trick(me,a,bd-tg(a)+1);const b=bs[0];if(b&&pw(a)>=tg(b)&&!b.c.indestructible)trick(op,b,pw(a)-tg(b)+1)});
  const dead=new Set();let toPl=0;
  atk.forEach(a=>{const bs=blocks.get(a),pa=pw(a);
    if(!bs){const d=pa*(a.c.ds?2:1);const pl=op.perms.find(x=>x.c.k==='pw');if(pl&&!allIn&&op.life>d*2){pl.loy-=d;if(pl.loy<=0){op.perms.splice(op.perms.indexOf(pl),1);this.log(`  ${pl.c.n} is defeated.`)}}else{op.life-=d;toPl+=d}if(a.c.lifelink)me.life+=d;return}
    const bFirst=bs.filter(b=>b.c.fs),fsDmg=bFirst.reduce((s,b)=>s+pw(b),0),aDies=!a.c.fs&&!a.c.indestructible&&bFirst.length&&(fsDmg>=tg(a)||bFirst.some(b=>b.c.deathtouch));
    if(aDies){dead.add(a);return}
    let rem=pa;const hit=new Set();bs.forEach(b=>{const need=a.c.deathtouch?1:tg(b),g=Math.min(rem,need);rem-=g;if(g>0&&(g>=tg(b)||a.c.deathtouch)&&!b.c.indestructible)hit.add(b)});
    if(a.c.trample&&rem>0){op.life-=rem;toPl+=rem}if(a.c.lifelink)me.life+=pa;
    const back=a.c.fs?bs.filter(b=>!hit.has(b)||b.c.fs):bs,bd=back.reduce((s,b)=>s+pw(b),0);
    if(!a.c.indestructible&&(bd>=tg(a)||(bd>0&&back.some(b=>b.c.deathtouch))))dead.add(a);hit.forEach(b=>dead.add(b))});
  if(dead.size)this.log(`  Dies: ${[...dead].map(x=>x.c.n).join(', ')}.`);this.log(`  ${op.name} is at ${op.life}${toPl?` (took ${toPl})`:''}.`);
  dead.forEach(x=>this.die(x));[...me.bf,...op.bf].forEach(x=>{if(x.tmp){x.p-=x.tmp[0];x.t-=x.tmp[1];x.tmp=null}})};
/* the opponent’s end step: flash creatures, instant draw and burn to the face, held removal on the biggest threat */
P_.endStep=function(me,op){for(let g=0;g<4;g++){const k=me.hand.filter(c=>c.inst&&canCast(me,c)).sort((a,b)=>b.cmc-a.cmc).find(c=>c.k==='creature'||c.draw||(c.burn&&op.life<=c.burn)||(c.kill&&this.target(op,c.kill)&&op.bf.length));
    if(!k)break;this.cast(me,op,k,'hand');if(op.life<=0)return}this.abilities(me,op,true)};
P_.run=function(){const P=this.P;P.forEach(p=>this.mulligan(p));
  for(this.turn=1;this.turn<=120;this.turn++){const me=P[this.t],op=P[1-this.t],rd=Math.ceil(this.turn/2);this.log(`— Turn ${rd}: ${me.name} (${me.life} life) · ${op.name} (${op.life} life)`);
    me.bf.forEach(x=>{x.tap=false;x.sick=false});me.lands.forEach(l=>l.tap=false);me.rocks.forEach(r=>r.tap=false);
    me.bf.filter(x=>x.c.trig&&x.c.trig.upk).forEach(x=>this.effect(x.c.trig.upk,me,op,x.c.n));
    if(this.turn>1){this.draw(me,1);if(me.decked){this.log(`${me.name} can’t draw — loses.`);return {w:1-this.t,turns:rd}}}
    this.main(me,op);if(op.life<=0)return this.end(this.t,rd);if(me.life<=0)return this.end(1-this.t,rd);
    this.combat(me,op);if(op.life<=0)return this.end(this.t,rd);if(me.life<=0)return this.end(1-this.t,rd);
    op.lands.forEach(l=>l.tap=false);op.rocks.forEach(r=>r.tap=false);op.bf.forEach(x=>{if(x.c.mana)x.tap=false});this.endStep(op,me);
    if(me.life<=0)return this.end(1-this.t,rd);while(me.hand.length>7)me.hand.splice(me.hand.reduce((bi,c,i)=>c.cmc>me.hand[bi].cmc?i:bi,0),1);
    this.t=1-this.t}
  this.log('The game stalls — counted as a draw.');return {w:-1,turns:60}};
P_.end=function(w,rd){this.log(`${this.P[w].name} wins on turn ${rd}.`);return {w,turns:rd}};
/* cards that stayed in hand all game although there were enough lands — usually a color problem */
P_.stuck=function(p){const cols=new Set(p.lands.flatMap(l=>l.c));return p.hand.filter(c=>c.k!=='land'&&c.cmc<=p.lands.length&&!c.cols.every(x=>cols.has(x))).map(c=>c.n)};

/* ---------- many games ---------- */
async function run(A0,B0,o,onProg){o=o||{};const A=prep(A0),B=prep(B0),n=o.n||1000,bo3=!!o.bo3,life=A.life===B.life?A.life:20;
  const r={v:SIMV,n,bo3,aw:0,bw:0,dr:0,turns:0,games:0,ap:[0,0],ad:[0,0],m:{a:0,b:0},g1:[0,0,0],post:[0,0,0],cards:[{},{}],unkA:A.unk,unkB:B.unk};
  const sbA=bo3?sideboard(A,B):{main:A.main,plan:[]},sbB=bo3?sideboard(B,A):{main:B.main,plan:[]};r.planA=sbA.plan;r.planB=sbB.plan;
  const stat=(k,p,won)=>{const S=r.cards[k];p.seen.forEach(nm=>{const x=S[nm]||(S[nm]={s:0,w:0,k:0});x.s++;if(won)x.w++})};
  const one=(first,post,log)=>{const lists=post?[sbA.main,sbB.main]:[A.main,B.main],g=new Game(A,B,first,life,lists,log),res=g.run();
    r.games++;r.turns+=res.turns;const k=first===0?r.ap:r.ad;k[1]++;if(res.w===0){r.aw++;k[0]++}else if(res.w===1)r.bw++;else r.dr++;
    const bucket=post?r.post:r.g1;bucket[res.w===0?0:res.w===1?1:2]++;
    g.P.forEach((p,i)=>{stat(i,p,res.w===i);g.stuck(p).forEach(nm=>{const S=r.cards[i],x=S[nm]||(S[nm]={s:0,w:0,k:0});x.k++})});if(log)r.log=g.L;return res};
  for(let m=0;m<n;m++){
    if(!bo3)one(m%2,false,m===0);
    else{let first=m%2,wa=0,wb=0;for(let gn=0;gn<3&&wa<2&&wb<2;gn++){const res=one(first,gn>0,m===0&&gn===0);if(res.w===0)wa++;else if(res.w===1)wb++;else{wa+=0.5;wb+=0.5}first=res.w===0?1:res.w===1?0:1-first}
      if(wa>wb)r.m.a++;else if(wb>wa)r.m.b++}
    if(m%25===24){onProg&&onProg(m+1,n);await new Promise(x=>setTimeout(x,0))}}
  r.avg=Math.round(r.turns/r.games*10)/10;
  /* per-card report: win rate in games where the card was drawn, and how often it got stuck in hand */
  r.cards=r.cards.map((S,i)=>Object.entries(S).map(([nm,x])=>({n:nm,s:x.s,w:x.w,k:x.k})).filter(x=>x.s>=Math.max(5,r.games*0.03)).sort((a,b)=>b.w/b.s-a.w/a.s));
  return r}

root.SIM2={run,profile,prep,SIMV};
if(typeof window==='undefined'&&typeof self!=='undefined'){self.onmessage=async ev=>{const d=ev.data||{};if(d.type!=='run')return;
  try{const r=await run(d.A,d.B,d.o,(k,t)=>self.postMessage({type:'prog',k,t}));self.postMessage({type:'done',r})}catch(e){self.postMessage({type:'err',msg:String(e&&e.message||e)})}}}
})(typeof self!=='undefined'?self:this);
