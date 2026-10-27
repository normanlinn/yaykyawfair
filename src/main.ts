// Yay Kyaw Nights: a walkable 3D night street fair inspired by Yangon's Yay Kyaw.
// Game logic works in map units (see layout.ts); world3d.ts draws it with Three.js.
import { Ctx, TAU, rand, pick, clamp, lerp, srng, rr, el, circ, ln, ks, MMF, DISP, BODY, $ } from './util';
import { SHIRTS, LONS, SKINS, BALLOONS, AV_SHIRTS, AV_LONS, person, PersonOpts, Avatar, Gender, DEFAULT_AVATAR, avatarOpts, cleanAvatar, randomAvatar, genderStartingLook } from './people';
import { A, audioInit, sfx, bell, horn, setChatter, setMaster } from './audio';
import {
  WW, WH, NORTH, ROAD, ZONES, FW, CR, PS, TR as TRK, ST, FV, PHOTO, TOYS_AT, UNCLE, SNACKS, Snack, CARTS, BOOTHS, SECRETS,
  STALLFRONTS, VENDOR_POSTS, blocked, trackPos,
} from './layout';
import { friends } from './friends';
import { init3d, build3d, resize3d, render3d, launchFirework, renderPreview, capture, project, rigKey, CrowdItem, Frame, Look, RideKind } from './world3d';

// ---------- canvases ----------
const world = $<HTMLCanvasElement>('world');
const cv = $<HTMLCanvasElement>('game'), ctx = cv.getContext('2d'); // 2D overlay for the game booths
const mini = $<HTMLCanvasElement>('mini'), mx = mini.getContext('2d');
let VW = 0, VH = 0, DPR = 1;
function resize(): void {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  VW = window.innerWidth; VH = window.innerHeight;
  cv.width = Math.round(VW*DPR); cv.height = Math.round(VH*DPR);
  resize3d(VW, VH, S.settings.gfx==='low' ? 1 : Math.min(DPR, 1.75));
}

// ---------- state ----------
type Mode = 'title' | 'walk' | 'scene' | 'mg';
interface Settings { density: 'low' | 'med' | 'high'; gfx: 'low' | 'high'; cam: 'close' | 'wide'; sound: boolean; mini: boolean; av: Avatar; name: string; avDone: boolean }
interface GameState {
  mode: Mode; kyat: number; tix: number; clock: number;
  zones: string[]; secrets: string[]; snacks: string[]; toys: string[]; prizes: string[]; photos: string[];
  rides: number; games: number; ticketsWon: number; finaleSeen: boolean; showStarted: boolean; showDone: boolean; summaryShown: boolean;
  balloon: string | null; fan: boolean; uncleAt: number; showT: number; paused: boolean; photo: boolean;
  settings: Settings;
}
const S: GameState = {
  showT:0, paused:false, photo:false,
  mode:'title', kyat:15000, tix:0, clock:18*60+30,
  zones:[], secrets:[], snacks:[], toys:[], prizes:[], photos:[],
  rides:0, games:0, ticketsWon:0, finaleSeen:false, showStarted:false, showDone:false, summaryShown:false,
  balloon:null, fan:false, uncleAt:-999,
  settings:{density:'med', gfx:'high', cam:'close', sound:true, mini:true, av:{...DEFAULT_AVATAR}, name:'', avDone:false}
};
try{ const sv=JSON.parse(localStorage.getItem('ykn-settings')||'null'); if(sv){ Object.assign(S.settings,sv); S.settings.av={...DEFAULT_AVATAR,...(sv.av||{})}; } }catch{ /* storage unavailable */ }
function saveSettings(): void { try{ localStorage.setItem('ykn-settings',JSON.stringify(S.settings)); }catch{ /* storage unavailable */ } }

const P = {x:900,y:2540,hd:Math.PI,moving:false,hidden:false,waveUntil:0};
const CAM = {yaw:0,pitch:.42,dist:11};
const TR = {u:0,riding:false,rideU:0};
const NAME_MAX = 16, CHAT_MAX = 120;
let T = 0;
const lookCache = new Map<string, Look>();
function lookFor(o: PersonOpts): Look { const key=rigKey(o); let l=lookCache.get(key); if(!l){ l={o,key}; lookCache.set(key,l); } return l; }
const myLook = (): Look => lookFor(avatarOpts(S.settings.av));

// ---------- things you can walk up to ----------
interface Interactable { x: number; y: number; r: number; label: () => string; act: () => void }
const IT: Interactable[] = [];
CARTS.forEach(([x,y],i)=>{ const sn=SNACKS[i]; IT.push({x,y:y+26,r:42,label:()=>`Buy ${sn.name} · ${ks(sn.p)}`,act:()=>buySnack(sn)}); });
IT.push({x:BOOTHS[0].x,y:BOOTHS[0].y+35,r:50,label:()=>`Play ring toss · ${ks(1000)}`,act:()=>startGame('ring')});
IT.push({x:BOOTHS[1].x,y:BOOTHS[1].y+35,r:50,label:()=>`Play balloon darts · ${ks(1000)}`,act:()=>startGame('darts')});
IT.push({x:BOOTHS[2].x,y:BOOTHS[2].y+35,r:50,label:()=>`Trade tickets for prizes (${S.tix} tickets)`,act:openPrizes});
IT.push({x:590,y:850,r:50,label:()=>`Ride the Ferris wheel · ${ks(1500)}`,act:()=>buyRide('ferris',1500)});
IT.push({x:CR.cx,y:CR.cy+165,r:60,label:()=>`Ride the carousel · ${ks(1000)}`,act:()=>buyRide('carousel',1000)});
IT.push({x:PS.px,y:PS.py+75,r:60,label:()=>`Ride the pirate ship · ${ks(1200)}`,act:()=>buyRide('pirate',1200)});
IT.push({x:TRK.cx,y:TRK.cy+TRK.ry+78,r:55,label:()=>`Ride the mini train · ${ks(500)}`,act:()=>{ if(!pay(500)) return; S.rides++; TR.riding=true; TR.rideU=0; P.hidden=true; sfx('toot'); toast('All aboard! One loop around the Kids Corner.'); updateHUD(); }});
IT.push({x:TOYS_AT.x,y:TOYS_AT.y+30,r:48,label:()=>'Browse the toy stall',act:openToys});
IT.push({x:PHOTO.x,y:PHOTO.y+30,r:45,label:()=>`Souvenir photo booth · ${ks(500)}`,act:boothPhoto});
IT.push({x:FV.x,y:FV.y+10,r:110,label:()=>S.showStarted&&!S.showDone?'Watch the fireworks now!':S.showDone?'Watch the finale again':'Watch the skyline',act:()=>startScene('finale')});
IT.push({x:UNCLE.x,y:UNCLE.y+10,r:45,label:()=>'Ask Uncle for pocket money',act:askUncle});

// ---------- NPCs ----------
interface Npc { x: number; y: number; tx: number; ty: number; sp: number; wait: number; ph: number; moving: boolean; stuck: number; hd: number; s: number;
  shirt: string; lon: string; skin: string; bun: boolean; hat?: boolean; balloon?: string | null; leader?: Npc; ox?: number; oy?: number; post?: boolean }
let NPC: Npc[] = [];
function freePoint(): [number, number] { for(let k=0;k<40;k++){ const p=npcTarget(); if(!blocked(p[0],p[1],5)) return p; } return [900,2000]; }
function npcTarget(): [number, number] {
  const r=Math.random();
  if(r<.34) return [rand(780,1020),rand(420,2560)];
  if(r<.44) return [rand(200,540),rand(2160,2280)];
  if(r<.56){ const s=pick(STALLFRONTS); return [s.x+rand(-34,34),s.y+rand(4,26)]; }
  if(r<.64) return [rand(1240,1520),rand(2090,2200)];
  const z=pick(ZONES); return [rand(z.x+30,z.x+z.w-30),rand(z.y+40,z.y+z.h-30)];
}
function mk(o: Partial<Npc>): Npc { return Object.assign({x:0,y:0,tx:0,ty:0,sp:rand(26,46),wait:rand(0,4),shirt:pick(SHIRTS),lon:pick(LONS),skin:pick(SKINS),s:1,ph:rand(0,9),moving:false,bun:Math.random()<.45,stuck:0,hd:rand(0,TAU)},o); }
function spawnCrowd(): void {
  const n={low:28,med:60,high:110}[S.settings.density]||60;
  NPC=VENDOR_POSTS.map(v=>{ const r=srng(v.seed+5); return mk({x:v.x,y:v.y,hd:0,post:true,hat:v.hat,bun:!v.hat&&r()<.5,shirt:SHIRTS[Math.floor(r()*SHIRTS.length)],lon:LONS[Math.floor(r()*LONS.length)],skin:SKINS[Math.floor(r()*SKINS.length)]}); });
  NPC.push(mk({x:UNCLE.x,y:UNCLE.y,hd:0,post:true,shirt:'#ffffff',lon:'#3c5a2a',skin:'#a8714a',bun:false}));
  for(let i=0;i<n;i++){
    const [x,y]=freePoint(); const L=mk({x,y}); [L.tx,L.ty]=freePoint(); NPC.push(L);
    if(Math.random()<.3) L.balloon=pick(BALLOONS);
    if(Math.random()<.35){ const k=Math.random()<.4?2:1; for(let j=0;j<k;j++) NPC.push(mk({x:x+rand(-10,10),y:y+rand(4,12),s:.68,leader:L,ox:rand(-14,14),oy:rand(4,12),balloon:Math.random()<.4?pick(BALLOONS):null,bun:Math.random()<.5})); }
  }
}
function turnTo(n: { hd: number }, dx: number, dy: number, dt: number): void {
  const want=Math.atan2(dx,dy); let d=want-n.hd; d=Math.atan2(Math.sin(d),Math.cos(d)); n.hd+=d*Math.min(1,dt*10);
}
function updateNPC(n: Npc, dt: number): void {
  if(n.post){ n.moving=false; const d=Math.hypot(P.x-n.x,P.y-n.y); if(d<160&&P.y>n.y) turnTo(n,P.x-n.x,P.y-n.y,dt*.3); return; }
  let tx: number, ty: number, sp: number;
  if(n.leader){ tx=n.leader.x+n.ox; ty=n.leader.y+n.oy; sp=n.leader.sp*1.4; const d=Math.hypot(tx-n.x,ty-n.y); if(d>140){n.x=tx;n.y=ty;} if(d<6){ n.moving=false; return; } }
  else{
    if(n.wait>0){ n.wait-=dt; n.moving=false; return; }
    tx=n.tx; ty=n.ty; sp=n.sp;
    if(Math.hypot(tx-n.x,ty-n.y)<5){ const atStage=n.y>2150&&n.x<560; n.wait=atStage?rand(6,18):rand(1,6); [n.tx,n.ty]=freePoint(); n.moving=false; return; }
  }
  const dx=tx-n.x, dy=ty-n.y, d=Math.hypot(dx,dy)||1;
  const nx=n.x+dx/d*sp*dt, ny=n.y+dy/d*sp*dt; let moved=false;
  if(!blocked(nx,n.y,4)){ n.x=nx; moved=true; }
  if(!blocked(n.x,ny,4)){ n.y=ny; moved=true; }
  if(moved) turnTo(n,dx,dy,dt);
  n.moving=moved;
  if(!moved && !n.leader){ if(++n.stuck>20){ [n.tx,n.ty]=freePoint(); n.stuck=0; } }
}

// ---------- small shared helpers ----------
function setSound(on: boolean): void { S.settings.sound=on; saveSettings(); setMaster(on); $('bSound').textContent=on?'Sound on':'Sound off'; }
function esc(t: string): string { return t.replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch] as string)); }
/** Text from other players: strip control and invisible direction characters, keep Myanmar (U+1000–109F) and everything printable, cap the length. */
function cleanText(v: unknown, max: number): string {
  if(typeof v!=='string') return '';
  return v.replace(/[\u0000-\u001f\u007f-\u009f​‎‏‪-‮⁠-⁯﻿]/g,'').replace(/\s+/g,' ').trim().slice(0,max);
}
const cleanName = (v: unknown): string => cleanText(v,NAME_MAX);
/** Waits (briefly) for the Myanmar and Latin fonts so the 3D signs are drawn with them. */
async function loadFonts(): Promise<void> {
  if(!document.fonts) return;
  const want=['400 30px "Pyidaungsu"','700 30px "Pyidaungsu"','700 30px "Padauk"','400 14px "Brandon Text"','700 14px "Brandon Text"','400 20px "Bungee"'].map(f=>document.fonts.load(f,'ရေကျော် Aa').catch(()=>[]));
  await Promise.race([Promise.all(want),new Promise(r=>setTimeout(r,2500))]);
}

// ---------- bicycles and motorbikes on the main street ----------
interface Bike { x: number; y: number; dir: 1 | -1; sp: number; cur: number; rider: PersonOpts; col: string; bellCd: number; pathCd: number; ringT: number; saika: boolean; moto: boolean; ph: number }
const BIKES: Bike[] = [];
function spawnBikes(): void {
  BIKES.length=0;
  for(let i=0;i<8;i++){
    const dir: 1 | -1 = i%2 ? 1 : -1, moto=i===2||i===5||i===6;
    BIKES.push({ x: dir<0 ? rand(975,1005) : rand(795,825), y: rand(420,2560), dir, sp: moto?rand(130,170):rand(70,105), cur: 80,
      rider: { shirt:pick(SHIRTS), lon:pick(LONS), skin:pick(SKINS), hat:!moto&&Math.random()<.3, bun:Math.random()<.4, head:moto&&Math.random()<.6?'cap':'none', capc:pick(['#1b1420','#c23b4b','#2d7bb6']) },
      col: moto?pick(['#c23b4b','#2d7bb6','#e9dcc4','#1b1420']):pick(['#2d7bb6','#c23b4b','#3a9b7a','#1b1420','#e0a526']),
      bellCd: rand(3,12), pathCd: 0, ringT: 0, saika: i===7, moto, ph: rand(0,9) });
  }
}
/** Bicycles go "cling cling", motorbikes go "tee tee". */
function ringBell(b: Bike): void {
  b.ringT=b.moto?.5:.8;
  if(S.mode!=='walk'&&S.mode!=='title') return;
  const v=clamp(1-Math.hypot(P.x-b.x,P.y-b.y)/560,0,1);
  if(b.moto) horn(v); else bell(v);
}
function inLane(b: Bike, x: number, y: number): number { // distance ahead, or -1
  const ahead=(y-b.y)*b.dir; return ahead>0&&ahead<(b.moto?170:130)&&Math.abs(x-b.x)<26 ? ahead : -1;
}
function updateBikes(dt: number): void {
  for(const b of BIKES){
    let ahead=S.mode==='walk'&&!P.hidden ? inLane(b,P.x,P.y) : -1;
    for(const r of REMOTE.values()){ if(r.where!=='walk') continue; const a=inLane(b,r.x,r.y); if(a>=0&&(ahead<0||a<ahead)) ahead=a; }
    for(const o of BIKES){ if(o===b||o.dir!==b.dir) continue; const a=(o.y-b.y)*b.dir; if(a>0&&a<55&&Math.abs(o.x-b.x)<20&&(ahead<0||a+30<ahead)) ahead=a+30; }
    const target=ahead<0 ? b.sp : ahead<45 ? 0 : 20;
    b.cur=lerp(b.cur,target,Math.min(1,dt*3));
    b.y+=b.dir*b.cur*dt;
    b.bellCd-=dt; b.pathCd-=dt; b.ringT=Math.max(0,b.ringT-dt);
    if(ahead>=0&&ahead<140&&b.pathCd<=0&&(S.mode!=='walk'||ahead<140)){ ringBell(b); b.pathCd=2.2; } // someone in the way
    else if(b.bellCd<=0){ if(Math.hypot(P.x-b.x,P.y-b.y)<650) ringBell(b); b.bellCd=rand(8,18); } // a friendly ring now and then
    if(b.y<NORTH+16) b.y=WH+30; else if(b.y>WH+40) b.y=NORTH+16;
  }
}

// ---------- avatar creator ----------
function openAvatar(first: boolean, after?: () => void): void {
  const a: Avatar = {...S.settings.av};
  const wrap=document.createElement('div');
  wrap.innerHTML=`<div class="avgrid"><div class="avprev"><canvas aria-label="Preview of your character"></canvas><div class="avname"></div><button type="button" class="avrand">Surprise me</button></div><div class="avopts"></div></div>`;
  const cvs=wrap.querySelector('canvas') as HTMLCanvasElement;
  const nameEl=wrap.querySelector('.avname') as HTMLElement;
  const opts=wrap.querySelector('.avopts') as HTMLElement;
  let open=true;
  const spin=(t: number)=>{ if(!open) return; if(cvs.isConnected&&cvs.clientWidth) renderPreview(cvs,avatarOpts(a),t/1000); requestAnimationFrame(spin); };
  const draw=()=>{ const nm=cleanName(nameVal); nameEl.textContent=nm; nameEl.hidden=!nm; };
  const row=(label: string)=>{ const r=document.createElement('div'); r.className='avrow'; r.innerHTML=`<span class="lbl">${label}</span>`; const box=document.createElement('div'); box.className='seg wrap'; r.appendChild(box); opts.appendChild(r); return box; };
  const choice=<K extends keyof Avatar>(label: string, key: K, vals: Array<[Avatar[K],string]>)=>{
    const box=row(label);
    vals.forEach(([v,l])=>{ const b=document.createElement('button'); b.type='button'; b.innerHTML=l; b.setAttribute('aria-pressed',String(a[key]===v));
      b.onclick=()=>{ a[key]=v; box.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b))); draw(); }; box.appendChild(b); });
  };
  const swatches=(label: string, key: 'skin'|'shirt'|'lon', cols: readonly string[])=>{
    const box=row(label); box.classList.add('sws');
    cols.forEach(col=>{ const b=document.createElement('button'); b.type='button'; b.className='sw'; b.style.background=col; b.setAttribute('aria-label',label+' '+col); b.setAttribute('aria-pressed',String(a[key]===col));
      b.onclick=()=>{ a[key]=col; box.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b))); draw(); }; box.appendChild(b); });
  };
  const toggle=(label: string, key: 'thanaka'|'bag'|'glasses', box: HTMLElement)=>{
    const b=document.createElement('button'); b.type='button'; b.innerHTML=label; b.setAttribute('aria-pressed',String(a[key]));
    b.onclick=()=>{ a[key]=!a[key]; b.setAttribute('aria-pressed',String(a[key])); draw(); }; box.appendChild(b);
  };
  let nameVal=S.settings.name;
  const build=()=>{ opts.innerHTML='';
    const nr=document.createElement('div'); nr.className='avrow';
    nr.innerHTML=`<label class="lbl" for="avName">Your name</label><input id="avName" maxlength="${NAME_MAX}" autocomplete="nickname" placeholder="Shown above your head (Burmese is fine)" value="${esc(nameVal)}">`;
    opts.appendChild(nr);
    const inp=nr.querySelector('input') as HTMLInputElement;
    inp.addEventListener('input',()=>{ nameVal=inp.value; draw(); });
    inp.addEventListener('keydown',e=>e.stopPropagation());
    const gr=row('Body'); ([['male','Male'],['female','Female'],['unspecified','Unspecified']] as Array<[Gender,string]>).forEach(([v,l])=>{
      const b=document.createElement('button'); b.type='button'; b.textContent=l; b.setAttribute('aria-pressed',String(a.gender===v));
      b.onclick=()=>{ if(a.gender===v) return; Object.assign(a,genderStartingLook(v)); build(); draw(); }; gr.appendChild(b); });
    choice('Outfit','outfit',[['longyi','Longyi + shirt'],['htamein','Htamein + eingyi'],['taikpon','Taikpon jacket']]);
    swatches('Top colour','shirt',AV_SHIRTS);
    swatches('Longyi / htamein colour','lon',AV_LONS);
    choice('Weave','pat',[['plain','Plain'],['check','Checks'],['stripe','Stripes'],['acheik','Acheik waves']]);
    choice('Hair','hair',[['short','Short'],['bun','Sadohn bun'],['long','Long']]);
    choice('On your head','head',[['none','Nothing'],['gaungbaung','Gaung baung'],['flower','Padauk flower'],['hat','Bamboo hat'],['cap','Cap']]);
    swatches('Skin','skin',SKINS);
    const ex=row('Extras'); toggle('Thanaka','thanaka',ex); toggle('Shan bag','bag',ex); toggle('Sunglasses','glasses',ex);
    const done=document.createElement('button'); done.type='button'; done.className='cta avdone'; done.textContent=first?'Enter the fair':'Save my look';
    opts.appendChild(done);
    done.onclick=()=>{ save(); closeModal(); };
  };
  build();
  (wrap.querySelector('.avrand') as HTMLButtonElement).onclick=()=>{ Object.assign(a,randomAvatar()); build(); draw(); };
  let saved=false;
  const save=()=>{ if(saved) return; saved=true;
    S.settings.av=cleanAvatar(a); S.settings.name=cleanName(nameVal); S.settings.avDone=true; saveSettings(); lastSent=''; };
  openModal(first?'Dress up for the fair':'Your look',wrap,()=>{ open=false; if(first||!saved) save(); after?.(); });
  draw(); requestAnimationFrame(spin);
}

// ---------- multiplayer: everyone with the page open shares one fair ----------
interface Remote { peer: string; name: string; av: Avatar; look: Look; x: number; y: number; tx: number; ty: number; hd: number; moving: boolean; where: string; balloon: string | null; wv: number; waveUntil: number; sayI: number; say: string; sayUntil: number }
const REMOTE = new Map<string, Remote>();
let room: { presence(value: Record<string, unknown>): Promise<unknown> } | null = null;
let lastSent='', presT=0, waveCount=0, roomReady=false;
const mySay={i:0,t:'',until:0};
async function initRoom(): Promise<void> {
  try{
    const r=await window.claude?.use?.('room');
    if(!r){ // outside claude.ai (for example on Vercel): invitation-only PeerJS friend rooms
      const fr=friends(peers=>syncPeers(peers as unknown as Claude.room.Peer[]));
      room=fr; roomReady=true; $('bFriends').hidden=false; $('bFriends').onclick=()=>fr.open();
      chatLine('','Open Friends · သူငယ်ချင်း to create or join a room, then press T to chat.',true); return;
    }
    room=r;
    r.onPeers(ch=>syncPeers(ch.peers), ()=>{ room=null; REMOTE.clear(); updatePlayers(); });
    setTimeout(()=>{ roomReady=true; },2500); // the first deliveries list who was already here: no join notes for them
  }catch{ room=null; }
}
function syncPeers(peers: readonly Claude.room.Peer[]): void {
  const seen=new Set<string>();
  for(const p of peers){
    if(p.sameTab||p.kind!=='viewer') continue;
    const pr=p.presence as Record<string, unknown>;
    if(typeof pr.x!=='number'||typeof pr.y!=='number'||!isFinite(pr.x)||!isFinite(pr.y)) continue; // still on the title screen
    seen.add(p.peer);
    const x=clamp(pr.x,0,WW), y=clamp(pr.y,0,WH);
    let r=REMOTE.get(p.peer);
    if(!r){ r={peer:p.peer,name:'',av:DEFAULT_AVATAR,look:lookFor(avatarOpts(DEFAULT_AVATAR)),x,y,tx:x,ty:y,hd:0,moving:false,where:'walk',balloon:null,wv:0,waveUntil:0,sayI:-1,say:'',sayUntil:0}; REMOTE.set(p.peer,r);
      if(roomReady){ const nm=cleanName(pr.n)||'A friend'; toast(`<b>${esc(nm)}</b> joined the fair.`); chatLine('',`${nm} joined the fair.`,true); } }
    r.tx=x; r.ty=y; r.name=cleanName(pr.n); r.av=cleanAvatar(pr.av); r.look=lookFor(avatarOpts(r.av));
    if(typeof pr.h==='number'&&isFinite(pr.h)) r.hd=pr.h;
    r.where=typeof pr.w==='string'?pr.w.slice(0,12):'walk';
    r.balloon=typeof pr.b==='string'&&(BALLOONS as readonly string[]).includes(pr.b)?pr.b:null;
    const wv=typeof pr.wv==='number'?pr.wv:0; if(wv!==r.wv){ if(r.wv!==0||wv>0) r.waveUntil=T+2.2; r.wv=wv; }
    // chat rides along in presence so everyone, including view-only members, can talk
    const say=pr.say as Record<string, unknown> | undefined, sayI=say&&typeof say.i==='number'?say.i:0;
    if(r.sayI<0) r.sayI=sayI; // whatever they said before we arrived stays unsaid
    else if(sayI!==r.sayI){
      r.sayI=sayI; const t=cleanText(say.t,CHAT_MAX);
      if(t){ r.say=t; r.sayUntil=T+7; chatLine(r.name||'Player',t,false); if(S.mode==='walk') sfx('chat'); }
    }
  }
  for(const [k,r] of [...REMOTE]) if(!seen.has(k)){ toast(`<b>${esc(r.name||'A friend')}</b> left the fair.`); REMOTE.delete(k); }
  updatePlayers();
}
function updatePlayers(): void {
  $('pStat').hidden=!room||REMOTE.size===0;
  $('players').textContent=String(REMOTE.size+1);
}
function whereNow(): string { return S.mode==='walk'?(TR.riding?'train':'walk'):S.mode==='scene'?SC.kind:S.mode==='mg'?MG.kind:'title'; }
function sendPresence(dt: number): void {
  if(!room||S.mode==='title') return;
  presT-=dt; if(presT>0) return; presT=.08;
  const msg: Record<string, unknown>={x:Math.round(P.x),y:Math.round(P.y),h:Math.round(P.hd*100)/100,w:whereNow(),n:S.settings.name,av:S.settings.av as unknown as Record<string,unknown>,b:S.balloon,wv:waveCount};
  if(mySay.i>0) msg.say={i:mySay.i,t:mySay.t};
  const k=JSON.stringify(msg); if(k===lastSent) return; lastSent=k;
  room.presence(msg).catch(()=>{ lastSent=''; });
}
function wave(): void { if(S.mode!=='walk') return; P.waveUntil=T+2.2; waveCount++; }

// ---------- chat ----------
const PHRASES: Array<[string, string]> = [
  ['မင်္ဂလာပါ','Hello'], ['နေကောင်းလား','How are you?'], ['လာ၊ အတူတူ စီးရအောင်','Come ride with me'],
  ['မုန့်ဟင်းခါး စားမလား','Want some mohinga?'], ['မီးပန်း ကြည့်ရအောင်','Let’s watch the fireworks'], ['ဒီမှာ','Over here!'],
  ['ပျော်စရာကြီး','So much fun!'], ['ကျေးဇူးတင်ပါတယ်','Thank you'], ['ခဏစောင့်','Wait a moment'], ['တာ့တာ','Bye-bye'],
];
let chatOpen=false, lastChatAt=-9;
function chatLine(name: string, text: string, sys: boolean, me = false): void {
  const d=document.createElement('div'); d.className='cl'+(sys?' sys':'')+(me?' me':'');
  if(!sys){ const b=document.createElement('b'); b.textContent=name; d.appendChild(b); }
  d.appendChild(document.createTextNode(text));
  const log=$('chatLog'); log.appendChild(d);
  while(log.children.length>40) log.firstChild.remove();
  log.scrollTop=log.scrollHeight;
  setTimeout(()=>d.classList.add('old'),12000);
}
function say(text: string): void {
  const t=cleanText(text,CHAT_MAX); if(!t) return;
  if(T-lastChatAt<1){ toast('Slow down a little.'); return; }
  lastChatAt=T; mySay.i++; mySay.t=t; mySay.until=T+7;
  chatLine(S.settings.name||'You',t,false,true); presT=0;
}
function openChat(): void {
  if(S.mode==='title'||S.mode==='mg'||S.photo) return;
  chatOpen=true; $('chat').classList.add('open'); $('chatForm').hidden=false; $('chatQuick').hidden=false;
  for(const k in keys) keys[k]=false;
  setTimeout(()=>$<HTMLInputElement>('chatIn').focus({preventScroll:true}),0);
}
function closeChat(): void { chatOpen=false; $('chat').classList.remove('open'); $('chatForm').hidden=true; $('chatQuick').hidden=true; $<HTMLInputElement>('chatIn').blur(); }
PHRASES.forEach(([my,en])=>{ const b=document.createElement('button'); b.type='button'; b.innerHTML=`<span class="mm">${my}</span><small>${en}</small>`; b.onclick=()=>{ say(my); closeChat(); }; $('chatQuick').appendChild(b); });
$('chatForm').addEventListener('submit',e=>{ e.preventDefault(); const i=$<HTMLInputElement>('chatIn'); say(i.value); i.value=''; closeChat(); });
$('chatIn').addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Escape'){ e.preventDefault(); closeChat(); } });

// people at the fair chat too (shown as bubbles near you)
const NPC_LINES: Array<[string, string]> = [
  ['ဒါ ဘယ်လောက်လဲ','How much is this?'], ['စားလို့ကောင်းတယ်','Delicious!'], ['ချားရဟတ် စီးချင်တယ်','I want to ride the wheel'],
  ['မီးပန်း ဘယ်အချိန်လဲ','When are the fireworks?'], ['ဟိုမှာ ကြည့်','Look over there!'], ['အမေ၊ ပူဖောင်း ဝယ်ပေး','Mum, buy me a balloon'],
  ['လာ၊ သွားကြရအောင်','Come on, let’s go'], ['ညကြီး လှလိုက်တာ','What a lovely night'], ['ကြံရည် သောက်မယ်','I’ll get sugarcane juice'],
];
const NPC_SAY: Array<{ n: Npc; t: [string, string]; until: number }> = [];
let npcSayT=3;
function updateNpcSay(dt: number): void {
  npcSayT-=dt; for(let i=NPC_SAY.length-1;i>=0;i--) if(NPC_SAY[i].until<T) NPC_SAY.splice(i,1);
  if(npcSayT>0||S.mode!=='walk') return; npcSayT=rand(3,7);
  const near=NPC.filter(n=>!n.leader&&n.s>=1&&Math.hypot(n.x-P.x,n.y-P.y)<260&&!NPC_SAY.some(s=>s.n===n));
  if(!near.length||NPC_SAY.length>=2) return;
  NPC_SAY.push({n:pick(near),t:pick(NPC_LINES),until:T+4.5});
}

// ---------- name tags and bubbles over the 3D view ----------
const tagPool: HTMLElement[] = []; let tagUsed=0;
function tagEl(cls: string, html: string): HTMLElement {
  let d=tagPool[tagUsed]; if(!d){ d=document.createElement('div'); $('tags').appendChild(d); tagPool.push(d); }
  tagUsed++; if(d.className!==cls) d.className=cls; if(d.dataset.h!==html){ d.innerHTML=html; d.dataset.h=html; } d.hidden=false; return d;
}
function placeTag(x: number, y: number, h: number, cls: string, html: string, maxD = 55): void {
  const p=project(x,y,h,VW,VH); if(!p.ok||p.d>maxD) return;
  const s=clamp(14/p.d,.55,1.15), d=tagEl(cls,html);
  d.style.transform=`translate(${p.sx-d.offsetWidth/2}px,${p.sy-d.offsetHeight}px) scale(${s.toFixed(3)})`;
  d.style.opacity=String(clamp(1.3-p.d/maxD,0,1));
}
function updateTags(): void {
  tagUsed=0;
  if(S.mode==='walk'&&!S.photo||S.mode==='scene'&&S.photo===false&&SC.kind==='finale'||S.mode==='walk'&&S.photo){
    const meVis=S.mode==='walk'&&!P.hidden;
    if(meVis&&mySay.until>T) placeTag(P.x,P.y,2.55,'bub',`<span class="mm">${esc(mySay.t)}</span>`);
    else if(meVis&&S.settings.name) placeTag(P.x,P.y,2.25,'tag me',esc(S.settings.name));
    for(const r of REMOTE.values()){
      if(r.where!=='walk') continue;
      if(r.sayUntil>T) placeTag(r.x,r.y,2.55,'bub',`<span class="mm">${esc(r.say)}</span><small>${esc(r.name||'Player')}</small>`,80);
      else placeTag(r.x,r.y,2.25,'tag',esc(r.name||'Player'),80);
    }
    if(S.mode==='walk') for(const s of NPC_SAY) placeTag(s.n.x,s.n.y,2.3*s.n.s,'bub npc',`<span class="mm">${s.t[0]}</span><small>${s.t[1]}</small>`,35);
  }
  for(let i=tagUsed;i<tagPool.length;i++) if(!tagPool[i].hidden) tagPool[i].hidden=true;
}

// ---------- UI helpers ----------
function toast(msg: string, big?: boolean): void {
  const d=document.createElement('div'); d.className='toast'+(big?' big':''); d.innerHTML=msg; $('toasts').appendChild(d);
  while($('toasts').children.length>3) $('toasts').firstChild.remove();
  setTimeout(()=>d.remove(),big?4200:3000);
}
function fmtClock(m: number): string { m=Math.floor(m); let h=Math.floor(m/60)%24; const mm=m%60; const ap=h>=12?'PM':'AM'; h=h%12||12; return h+':'+String(mm).padStart(2,'0')+' '+ap; }
function journey(): Record<string, boolean> {
  return {arrive:true,discover:S.zones.length>=4,play:S.rides>0&&S.games>0,finale:S.finaleSeen};
}
let hudCache='';
function updateHUD(): void {
  $('kyat').textContent=S.kyat.toLocaleString('en-US');
  $('tix').textContent=String(S.tix);
  $('clock').textContent=fmtClock(S.clock);
  const j=journey(); let nowSet=false;
  document.querySelectorAll<HTMLElement>('#journey li').forEach(li=>{ const k=li.dataset.s; li.classList.toggle('done',j[k]); const now=!j[k]&&!nowSet; li.classList.toggle('now',now); if(now) nowSet=true; });
  let g: string;
  if(!j.discover) g=`Discover the fair: ${S.zones.length} of 8 zones found. Follow the signs off the main street.`;
  else if(!j.play) g=`Play: ${S.rides?'ride done':'take a ride'}, ${S.games?'game played':'win tickets at a game booth'}.`;
  else if(!j.finale) g=S.showStarted?'Fireworks now! Go to the Finale View deck.':'Fireworks at 9:30 PM. Find a spot on the Finale View deck.';
  else g=`Collected: ${S.zones.length}/8 postcards, ${S.secrets.length}/6 secrets, ${S.photos.length} photos.`;
  if(g!==hudCache){ $('goal').textContent=g; hudCache=g; }
}
function pay(n: number): boolean { if(S.kyat<n){ toast(`Not enough kyat. You have ${ks(S.kyat)}. Uncle at the entry gate can help.`); sfx('miss'); return false; } S.kyat-=n; sfx('coin'); updateHUD(); return true; }

let modalClose: (() => void) | null = null;
function openModal(title: string, html: string | HTMLElement, onClose?: () => void): void {
  $('mTitle').textContent=title; $('mBody').innerHTML=''; if(typeof html==='string') $('mBody').innerHTML=html; else $('mBody').appendChild(html);
  $('modal').hidden=false; modalClose=onClose||null; S.paused=true; $('mClose').focus({preventScroll:true});
}
function closeModal(): void { $('modal').hidden=true; S.paused=false; const f=modalClose; modalClose=null; if(f) f(); }
$('mClose').onclick=closeModal;
$('modal').addEventListener('pointerdown',e=>{ if((e.target as HTMLElement).id==='modal') closeModal(); });

// ---------- actions ----------
function buySnack(sn: Snack): void {
  if(!pay(sn.p)) return;
  if(!S.snacks.includes(sn.id)){ S.snacks.push(sn.id); toast(`<b>${sn.name}</b> <span class="mm">${sn.my}</span><br>${sn.d}`); }
  else toast(`Another ${sn.name}. Still delicious.`);
}
const TOYS=[
  {id:'balloon',name:'Balloon',my:'ပူဖောင်း',p:500,d:'Tied to your wrist so it follows you around the fair.'},
  {id:'fan',name:'Bamboo hand fan',my:'ယပ်တောင်',p:600,d:'Painted paper on a bamboo frame. Perfect for a warm night.'},
  {id:'doll',name:'Tumbling doll',my:'ပစ်တိုင်းထောင်',p:800,d:'Pyit taing htaung, the papier-mâché doll that always gets back up.'},
  {id:'top',name:'Wooden spinning top',my:'ဂျင်',p:400,d:'Wind the string, throw it down, watch it hum.'},
];
function openToys(): void {
  const wrap=document.createElement('div'); wrap.className='items';
  TOYS.forEach(t=>{ const r=document.createElement('div'); r.className='item';
    const owned=S.toys.includes(t.id)&&t.id!=='balloon';
    r.innerHTML=`<div class="t"><b>${t.name} <span class="mm muted">${t.my}</span></b><small>${t.d}</small></div>`;
    const b=document.createElement('button'); b.className='cta'; b.textContent=owned?'Owned':`Buy · ${ks(t.p)}`; b.disabled=owned;
    b.onclick=()=>{ if(!pay(t.p)) return; if(!S.toys.includes(t.id)) S.toys.push(t.id); if(t.id==='balloon') S.balloon=pick(BALLOONS); if(t.id==='fan') S.fan=true; toast(`You bought a ${t.name.toLowerCase()}.`); closeModal(); };
    r.appendChild(b); wrap.appendChild(r); });
  const p=document.createElement('p'); p.className='muted'; p.textContent=`You have ${ks(S.kyat)}.`; wrap.prepend(p);
  openModal('Toy stall',wrap);
}
const PRIZES: Array<{ id: string; name: string; my?: string; p: number; d: string }> = [
  {id:'keychain',name:'Lucky keychain',p:8,d:'A tiny gold bell on a red cord.'},
  {id:'owl',name:'Lucky owl pair',my:'ဇီးကွက်',p:15,d:'A pair of papier-mâché owls, said to bring good fortune.'},
  {id:'kite',name:'Paper kite',p:22,d:'Ready for a windy afternoon by the lake.'},
  {id:'teddy',name:'Teddy bear',p:35,d:'Fluffy, slightly lopsided, absolutely perfect.'},
  {id:'elephant',name:'White elephant plush',my:'ဆင်ဖြူ',p:60,d:'The giant prize. A white elephant is a royal symbol of luck.'},
];
function openPrizes(): void {
  const wrap=document.createElement('div'); wrap.className='items';
  const p=document.createElement('p'); p.className='muted'; p.textContent=`You have ${S.tix} tickets. Win more at ring toss and balloon darts.`; wrap.appendChild(p);
  PRIZES.forEach(z=>{ const r=document.createElement('div'); r.className='item';
    r.innerHTML=`<div class="t"><b>${z.name} ${z.my?`<span class="mm muted">${z.my}</span>`:''}</b><small>${z.d}</small></div>`;
    const b=document.createElement('button'); b.className='cta'; b.textContent=`${z.p} tickets`; b.disabled=S.tix<z.p;
    b.onclick=()=>{ if(S.tix<z.p) return; S.tix-=z.p; S.prizes.push(z.id); sfx('ding'); toast(`You won a <b>${z.name}</b>! It is in your bag.`); updateHUD(); closeModal(); };
    r.appendChild(b); wrap.appendChild(r); });
  openModal('Prize counter',wrap);
}
function askUncle(): void {
  const mins=S.clock-S.uncleAt;
  if(S.kyat>=3000){ toast('Uncle laughs: “You still have plenty! Go and enjoy yourself.”'); return; }
  if(mins<30){ toast('Uncle: “I just gave you some! Come back a bit later.”'); return; }
  S.kyat+=5000; S.uncleAt=S.clock; sfx('coin'); toast('Uncle hands you <b>5,000 Ks</b>. “Don’t spend it all on shwe yin aye.”'); updateHUD();
}

// ---------- photos ----------
function capturePhoto(src: HTMLCanvasElement, label?: string): void {
  const w=480, h=Math.round(w*src.height/src.width);
  const c=document.createElement('canvas'); c.width=w; c.height=h+44; const g=c.getContext('2d');
  g.fillStyle='#fff'; g.fillRect(0,0,w,h+44); g.drawImage(src,8,8,w-16,h-16);
  g.fillStyle='#2a1606'; g.font='400 14px '+DISP; g.textBaseline='middle'; g.fillText('YAY KYAW NIGHTS',12,h+18);
  g.font='600 13px '+BODY; g.textAlign='right'; g.fillText(label||fmtClock(S.clock),w-12,h+18);
  let url=''; try{ url=c.toDataURL('image/jpeg',.82); }catch{ /* tainted or unsupported */ }
  if(url){ S.photos.unshift(url); if(S.photos.length>24) S.photos.pop(); }
  $('flash').style.transition='none'; $('flash').style.opacity='.9'; requestAnimationFrame(()=>{ $('flash').style.transition='opacity .45s'; $('flash').style.opacity='0'; });
  sfx('shutter');
}
function pagoda(c: Ctx, x: number, base: number, h: number): void {
  const w=h*.42;
  const g=c.createRadialGradient(x,base-h*.45,0,x,base-h*.45,h*.9); g.addColorStop(0,'rgba(255,200,90,.45)'); g.addColorStop(1,'rgba(255,200,90,0)'); c.fillStyle=g; c.fillRect(x-h,base-h*1.4,h*2,h*1.5);
  const gr=c.createLinearGradient(x-w,0,x+w,0); gr.addColorStop(0,'#b97a17'); gr.addColorStop(.45,'#ffd86b'); gr.addColorStop(1,'#a8680f');
  c.fillStyle=gr;
  c.fillRect(x-w,base-h*.08,w*2,h*.08); c.fillRect(x-w*.82,base-h*.15,w*1.64,h*.08); c.fillRect(x-w*.66,base-h*.21,w*1.32,h*.07);
  c.beginPath(); c.moveTo(x-w*.6,base-h*.21); c.bezierCurveTo(x-w*.6,base-h*.48,x-w*.18,base-h*.5,x-w*.15,base-h*.6); c.lineTo(x+w*.15,base-h*.6); c.bezierCurveTo(x+w*.18,base-h*.5,x+w*.6,base-h*.48,x+w*.6,base-h*.21); c.fill();
  c.beginPath(); c.moveTo(x-w*.1,base-h*.6); c.quadraticCurveTo(x-w*.12,base-h*.86,x,base-h*.95); c.quadraticCurveTo(x+w*.12,base-h*.86,x+w*.1,base-h*.6); c.fill();
}
function boothPhoto(): void {
  if(!pay(500)) return;
  const c=document.createElement('canvas'); c.width=480; c.height=600; const g=c.getContext('2d');
  const gr=g.createLinearGradient(0,0,0,600); gr.addColorStop(0,'#1b1243'); gr.addColorStop(1,'#4a2150'); g.fillStyle=gr; g.fillRect(0,0,480,600);
  const r=srng(21); for(let x=0;x<480;){ const w=12+r()*24, h=60+r()*120; g.fillStyle=r()<.5?'#151233':'#1b1740'; g.fillRect(x,420-h,w,h); g.fillStyle='rgba(255,214,140,.7)'; for(let k=0;k<6;k++) g.fillRect(x+r()*w,420-h+r()*h,2,3); x+=w+2; }
  pagoda(g,240,420,190);
  g.fillStyle='#2a2238'; g.fillRect(0,420,480,180);
  for(let k=0;k<9;k++){ g.fillStyle=['#ff5a4e','#f4b63f','#3fc7a5'][k%3]; el(g,30+k*52,60+Math.sin(k)*10,10,13); g.fillStyle='rgba(255,231,163,.6)'; el(g,30+k*52,60+Math.sin(k)*10,4,5); }
  g.strokeStyle='rgba(255,231,163,.5)'; g.lineWidth=1.5; g.beginPath(); g.moveTo(0,40); g.quadraticCurveTo(240,90,480,40); g.stroke();
  const pose=Math.floor(Math.random()*3);
  person(g,240,540,{...avatarOpts(S.settings.av),s:5.2,armsUp:pose===0,t:1.2,balloon:S.balloon,fan:S.fan});
  if(pose>0){ person(g,140,545,{s:3.8,shirt:pick(SHIRTS),lon:pick(LONS),skin:pick(SKINS),thanaka:true,bun:true}); person(g,345,548,{s:3.4,shirt:pick(SHIRTS),lon:pick(LONS),skin:pick(SKINS),thanaka:true,armsUp:true,t:2}); }
  g.fillStyle='#ffe7a3'; g.font='700 30px '+MMF; g.textAlign='center'; g.fillText('ရေကျော်ညများ',240,140);
  capturePhoto(c,'Souvenir photo · 2026');
  toast('Click! Your souvenir photo is in your bag.');
}
function enterPhotoMode(): void { if(S.mode!=='walk'&&S.mode!=='scene') return; closeChat(); S.photo=true; $('photoUI').hidden=false; document.body.classList.add('photo'); syncChrome(); }
function exitPhotoMode(): void { S.photo=false; P.hidden=TR.riding; $('photoUI').hidden=true; document.body.classList.remove('photo'); syncChrome(); }
$('shutter').onclick=()=>{ renderNow(0); capturePhoto(capture()); toast('Photo saved to your bag.'); };
$('photoExit').onclick=exitPhotoMode;
$('photoHide').onclick=()=>{ if(S.mode!=='walk') return; P.hidden=!P.hidden; $('photoHide').textContent=P.hidden?'Show me':'Hide me'; };

// ---------- bag & settings ----------
let bagTab='postcards';
function openBag(): void {
  const wrap=document.createElement('div');
  const tabs=document.createElement('div'); tabs.className='tabs';
  [['postcards',`Postcards ${S.zones.length}/8`],['souvenirs','Souvenirs'],['photos',`Photos ${S.photos.length}`],['secrets',`Secrets ${S.secrets.length}/6`]].forEach(([k,l])=>{
    const b=document.createElement('button'); b.textContent=l; b.setAttribute('aria-pressed',String(bagTab===k)); b.onclick=()=>{ bagTab=k; render(); tabs.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b))); }; tabs.appendChild(b); });
  const body=document.createElement('div');
  function render(): void {
    body.innerHTML='';
    if(bagTab==='postcards'){ const g=document.createElement('div'); g.className='cards';
      ZONES.forEach(z=>{ const has=S.zones.includes(z.id); const d=document.createElement('div'); d.className='pc'+(has?'':' locked');
        d.innerHTML=has?`<span class="stamp"></span><span class="no">${String(z.n).padStart(2,'0')}</span><b>${z.name}</b><span class="mm">${z.my}</span><p>${z.card}</p>`:`<span class="no">${String(z.n).padStart(2,'0')}</span><b>Not found yet</b><p>Walk into this zone to collect its postcard.</p>`;
        g.appendChild(d); }); body.appendChild(g); }
    if(bagTab==='souvenirs'){
      const list: string[]=[];
      S.snacks.forEach(id=>{ const s=SNACKS.find(x=>x.id===id); list.push(`<div class="item"><div class="t"><b>${s.name} <span class="mm muted">${s.my}</span></b><small>Snack tasted</small></div></div>`); });
      S.toys.forEach(id=>{ const s=TOYS.find(x=>x.id===id); list.push(`<div class="item"><div class="t"><b>${s.name}</b><small>Toy from the Kids Corner stall</small></div></div>`); });
      S.prizes.forEach(id=>{ const s=PRIZES.find(x=>x.id===id); list.push(`<div class="item"><div class="t"><b>${s.name}</b><small>Prize won with tickets</small></div></div>`); });
      body.innerHTML=list.length?`<div class="items">${list.join('')}</div>`:'<p class="muted">Nothing yet. Try a snack on Food Street, a toy in the Kids Corner, or win a prize at the Game Booths.</p>'; }
    if(bagTab==='photos'){ if(!S.photos.length){ body.innerHTML='<p class="muted">No photos yet. Press P (or the Photo button) anywhere, even on a ride, or visit the photo booth by the stage.</p>'; }
      else { const g=document.createElement('div'); g.className='photos'; S.photos.forEach(u=>{ const i=new Image(); i.src=u; i.alt='Fair photo'; g.appendChild(i); }); body.appendChild(g);
        const p=document.createElement('p'); p.className='muted'; p.textContent='To keep a photo, long-press or right-click it and save the image.'; body.appendChild(p);} }
    if(bagTab==='secrets'){ body.innerHTML='<div class="items">'+SECRETS.map(s=>S.secrets.includes(s.id)?`<div class="item"><div class="t"><b>${s.name}</b><small>${s.d}</small></div></div>`:'<div class="item"><div class="t"><b>???</b><small>A hidden detail somewhere in the fair. Look for a faint sparkle.</small></div></div>').join('')+'</div>'; }
  }
  render(); wrap.appendChild(tabs); wrap.appendChild(body);
  openModal('Your bag',wrap);
}
function setCam(c: 'close' | 'wide'): void { S.settings.cam=c; saveSettings(); CAM.dist=c==='wide'?24:11; }
function openSettings(): void {
  const wrap=document.createElement('div');
  const opt=(label: string, key: keyof Settings, vals: Array<[unknown,string]>, fn?: (v: any)=>void)=>{ const r=document.createElement('div'); r.className='opt'; r.innerHTML=`<span>${label}</span>`; const sg=document.createElement('div'); sg.className='seg';
    vals.forEach(([v,l])=>{ const b=document.createElement('button'); b.textContent=l; b.setAttribute('aria-pressed',String(S.settings[key]===v)); b.onclick=()=>{ (S.settings as unknown as Record<string, unknown>)[key]=v; saveSettings(); sg.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b))); fn&&fn(v); }; sg.appendChild(b); });
    r.appendChild(sg); wrap.appendChild(r); };
  opt('Crowd density','density',[['low','Low'],['med','Medium'],['high','High']],()=>spawnCrowd());
  opt('Graphics','gfx',[['low','Fast'],['high','Sharp']],()=>resize());
  opt('Camera','cam',[['close','Close'],['wide','Wide']],v=>setCam(v));
  opt('Mini map','mini',[[true,'Show'],[false,'Hide']],()=>syncChrome());
  opt('Sound','sound',[[true,'On'],[false,'Off']],v=>setSound(v));
  const ob=document.createElement('button'); ob.className='cta'; ob.textContent='Change outfit and name'; ob.style.marginTop='12px'; ob.onclick=()=>{ closeModal(); openAvatar(false); }; wrap.appendChild(ob);
  const k=document.createElement('div'); k.innerHTML=`<h3 style="font-family:var(--display);font-weight:400;font-size:15px;color:var(--gold);margin:16px 0 6px">Controls</h3>
  <table class="keys"><tr><td><b>WASD / arrows</b></td><td>Walk (hold Shift to hurry)</td></tr><tr><td><b>Drag / mouse wheel</b></td><td>Look around, zoom</td></tr><tr><td><b>E / Space</b></td><td>Interact, throw, stop the meter</td></tr><tr><td><b>T / Enter</b></td><td>Chat with other players</td></tr><tr><td><b>P</b></td><td>Photo mode</td></tr><tr><td><b>C</b></td><td>Close or wide camera</td></tr><tr><td><b>B</b></td><td>Open your bag</td></tr><tr><td><b>Q</b></td><td>Wave to other players</td></tr><tr><td><b>Esc</b></td><td>Close, leave a ride or game</td></tr></table>
  <p class="muted" style="font-size:13px">On a phone, drag the stick to walk, drag anywhere else to look around and tap GO to interact. In balloon darts, tap where you want to aim.</p>`;
  wrap.appendChild(k);
  openModal('Settings',wrap);
}

// ---------- fireworks ----------
let fwNext=0;
function launch(): void { launchFirework(); sfx('launch'); }
function onBoom(): void { setTimeout(()=>{ sfx('boom'); if(Math.random()<.5) sfx('crackle'); },250+Math.random()*350); }
function updFireworks(dt: number): void {
  if(S.showStarted&&!S.showDone){
    fwNext-=dt; const fin=S.showT<7;
    if(fwNext<=0){ launch(); if(fin){ launch(); if(Math.random()<.6) launch(); } fwNext=fin?rand(.15,.35):rand(.4,1.0); }
  }
  if(S.mode==='scene'&&SC.kind==='finale'&&S.showDone&&SC.replay){ fwNext-=dt; if(fwNext<=0){ launch(); fwNext=rand(.35,.85); } }
}

// ---------- rides & the finale ----------
type SceneKind = 'ferris' | 'carousel' | 'pirate' | 'finale';
const SC: { kind: SceneKind | null; t: number; dur: number; replay?: boolean; topSaid?: boolean; wh?: boolean } = {kind:null,t:0,dur:0};
const RIDECAP: Record<string, string> = {
  ferris:'Rising over the fair. Look for the Shwedagon Pagoda glowing gold beyond the lake.',
  carousel:'Round and round on a painted horse. Wave at the crowd!',
  pirate:'Hold on tight, it swings higher each time.',
};
function buyRide(kind: SceneKind, price: number): void { if(!pay(price)) return; S.rides++; startScene(kind); updateHUD(); }
function startScene(kind: SceneKind): void {
  closeChat();
  SC.kind=kind; SC.t=0; SC.dur={ferris:28,carousel:16,pirate:16,finale:9999}[kind]; SC.replay=false; SC.topSaid=false;
  S.mode='scene'; $('prompt').hidden=true;
  if(kind==='finale'){
    if(S.showDone){ SC.replay=true; setBar('An encore just for you. Fireworks bloom over the city.'); }
    else if(S.showStarted) setBar('The fireworks finale has begun!');
    else setBar(`The skyline at ${fmtClock(S.clock)}. Fireworks begin at 9:30 PM.`,'Wait for the fireworks',()=>{ S.clock=Math.max(S.clock,21*60+29.5); $('sceneAlt').hidden=true; $('sceneCap').textContent='Settling in. The first rocket is about to go up…'; });
  } else setBar(RIDECAP[kind]);
  syncChrome();
}
function setBar(cap: string, alt?: string, altFn?: () => void, exit?: string): void {
  $('sceneCap').textContent=cap; $('sceneAlt').hidden=!alt; if(alt){ $('sceneAlt').textContent=alt; $('sceneAlt').onclick=altFn; }
  $('sceneExit').textContent=exit||'Leave';
}
function endScene(): void {
  const k=SC.kind; S.mode='walk'; SC.kind=null; $('sceneBar').hidden=true;
  if(k==='ferris'||k==='carousel'||k==='pirate') toast('What a ride! Your ticket stub is a keepsake.');
  syncChrome(); updateHUD(); maybeSummary();
}
$('sceneExit').onclick=()=>{ if(S.mode==='scene') endScene(); else if(S.mode==='mg') endGame(); };
function updateScene(dt: number, atTop: boolean): void {
  SC.t+=dt;
  if(SC.kind==='ferris'&&atTop&&!SC.topSaid){ SC.topSaid=true; $('sceneCap').textContent='Top of the wheel! The whole of Yangon sparkles below you.'; sfx('ding'); }
  if(SC.kind==='pirate'){ const c=Math.abs(Math.cos(T*1.15)); if(c<.06&&!SC.wh){ sfx('whee'); SC.wh=true; } if(c>.3) SC.wh=false; }
  if(SC.dur<9999&&SC.t>=SC.dur) endScene();
}

// ---------- mini games (drawn flat on the 2D overlay, like stepping up to the booth) ----------
interface Bottle { r: number; c: number; x: number; y: number; sc: number; gold: boolean }
interface Balloon { r: number; c: number; col: string; gold: boolean; pop: boolean; ph: number; x?: number; y?: number; R?: number }
interface Dart { sx: number; sy: number; tx: number; ty: number; t: number; done?: boolean; stuck?: boolean }
interface Fx { x: number; y: number; life: number; txt?: string; vx?: number; vy?: number; col?: string }
interface MiniGame {
  kind: 'ring' | 'darts'; t: number; won: number; done: boolean; fx: Fx[]; left: number;
  phase?: 'aim' | 'power' | 'fly' | 'over'; rings?: Array<{ on?: number; x?: number; y?: number; sc?: number }>; bottles?: Bottle[];
  flight?: { sx: number; sy: number; tx: number; ty: number; t: number } | null; aimX?: number; pt?: number;
  balloons?: Balloon[]; darts?: Dart[]; aim?: { x: number; y: number };
}
const MG = {} as MiniGame;
function startGame(kind: MiniGame['kind']): void {
  if(!pay(1000)) return;
  closeChat();
  S.games++; Object.keys(MG).forEach(k=>delete (MG as unknown as Record<string, unknown>)[k]);
  Object.assign(MG,{kind,t:0,won:0,done:false,fx:[]});
  if(kind==='ring'){ MG.left=5; MG.phase='aim'; MG.rings=[]; MG.bottles=[]; MG.flight=null; }
  if(kind==='darts'){ MG.left=6; MG.balloons=[]; MG.darts=[]; MG.aim={x:VW/2,y:VH*.42}; for(let r=0;r<4;r++) for(let c=0;c<7;c++) MG.balloons.push({r,c,col:BALLOONS[(r*3+c)%5],gold:(r===1&&c===5)||(r===3&&c===1),pop:false,ph:rand(0,9)}); }
  S.mode='mg'; $('prompt').hidden=true;
  setBar(kind==='ring'?'Stop the sweeping marker to aim, then stop the power bar. Gold bottle pays 8 tickets.':'Aim the wobbling crosshair and throw. Gold balloons pay 6 tickets.');
  syncChrome(); updateHUD();
}
function endGame(): void { S.mode='walk'; $('sceneBar').hidden=true; if(MG.won) toast(`You won <b>${MG.won} tickets</b>. Spend them at the prize counter.`); syncChrome(); updateHUD(); }
function ringLayout(): Bottle[] {
  const m=Math.min(VW,VH), cx=VW/2, top=VH*.3, B: Bottle[]=[];
  for(let r=0;r<3;r++){ const sc=(.75+r*.18)*m/700; for(let c=0;c<4;c++) B.push({r,c,x:cx+(c-1.5)*95*sc,y:top+r*70*m/700,sc,gold:r===0&&c===2}); }
  return B;
}
function mgPress(px?: number, py?: number): void {
  if(MG.done) return;
  if(MG.kind==='ring'){
    const B=ringLayout(), xs=B.map(b=>b.x), half=(Math.max(...xs)-Math.min(...xs))/2+40;
    if(MG.phase==='aim'){ MG.aimX=VW/2+Math.sin(MG.t*2.3)*half; MG.phase='power'; MG.pt=0; }
    else if(MG.phase==='power'){
      const p=(Math.sin(MG.pt*2.6-Math.PI/2)+1)/2, ys=B.map(b=>b.y); const yFront=Math.max(...ys)+40, yBack=Math.min(...ys)-40;
      const ty=lerp(yFront,yBack,p), tx=MG.aimX+rand(-7,7);
      MG.flight={sx:VW/2,sy:VH*.92,tx,ty,t:0}; MG.phase='fly'; MG.left--; sfx('throw');
    }
  }
  if(MG.kind==='darts'){
    if(MG.left<=0) return;
    if(px!=null){ MG.aim.x=px; MG.aim.y=py; }
    const w=wob(); MG.darts.push({sx:VW/2,sy:VH*1.02,tx:MG.aim.x+w[0],ty:MG.aim.y+w[1],t:0}); MG.left--; sfx('throw');
  }
}
function wob(): [number, number] { const m=Math.min(VW,VH)/700; return [Math.sin(MG.t*1.7)*22*m+Math.sin(MG.t*3.1)*8*m, Math.cos(MG.t*2.3)*16*m]; }
function drawMG(dt: number): void {
  ctx.setTransform(DPR,0,0,DPR,0,0);
  MG.t+=dt; const m=Math.min(VW,VH)/700;
  const g=ctx.createLinearGradient(0,0,0,VH); g.addColorStop(0,'#2a1d4f'); g.addColorStop(1,'#140e2a'); ctx.fillStyle=g; ctx.fillRect(0,0,VW,VH);
  for(let k=0;k<Math.ceil(VW/60);k++){ ctx.fillStyle=k%2?'rgba(194,59,75,.25)':'rgba(255,243,214,.05)'; ctx.fillRect(k*60,0,60,VH*.62); }
  for(let k=0;k<Math.ceil(VW/40)+1;k++){ ctx.fillStyle=(k+Math.floor(T*3))%3?'#ffe7a3':'#ff5a4e'; circ(ctx,k*40+20,18,4); }
  if(MG.kind==='ring'){
    const B=ringLayout();
    ctx.fillStyle='#6b4a2e'; ctx.beginPath(); ctx.moveTo(VW/2-260*m,VH*.24); ctx.lineTo(VW/2+260*m,VH*.24); ctx.lineTo(VW/2+380*m,VH*.68); ctx.lineTo(VW/2-380*m,VH*.68); ctx.fill();
    ctx.fillStyle='#4f3520'; ctx.fillRect(VW/2-380*m,VH*.68,760*m,30*m);
    MG.rings.filter(r=>r.on==null).forEach(r=>{ ctx.strokeStyle='#ff5a4e'; ctx.lineWidth=4*r.sc; ctx.beginPath(); ctx.ellipse(r.x,r.y,16*r.sc,6*r.sc,0,0,TAU); ctx.stroke(); });
    B.forEach(b=>{ const s=b.sc; ctx.fillStyle='rgba(0,0,0,.3)'; el(ctx,b.x,b.y+4*s,16*s,5*s);
      ctx.fillStyle=b.gold?'#e0a526':'#2f8f5e'; rr(ctx,b.x-12*s,b.y-42*s,24*s,44*s,6*s); ctx.fill(); ctx.fillRect(b.x-5*s,b.y-62*s,10*s,22*s);
      ctx.fillStyle='rgba(255,255,255,.3)'; ctx.fillRect(b.x-8*s,b.y-38*s,4*s,30*s);
      ctx.fillStyle=b.gold?'#ffe7a3':'#c9e8d4'; ctx.fillRect(b.x-6*s,b.y-66*s,12*s,5*s);
      MG.rings.filter(r=>r.on===b.r*4+b.c).forEach((r,i)=>{ ctx.strokeStyle='#ff5a4e'; ctx.lineWidth=4*s; ctx.beginPath(); ctx.ellipse(b.x,b.y-48*s+i*6*s,14*s,5*s,0,0,TAU); ctx.stroke(); });
    });
    const xs=B.map(b=>b.x), half=(Math.max(...xs)-Math.min(...xs))/2+40;
    if(MG.phase==='aim'||MG.phase==='power'){
      const ax=MG.phase==='aim'?VW/2+Math.sin(MG.t*2.3)*half:MG.aimX;
      ctx.strokeStyle='rgba(244,182,63,.8)'; ctx.setLineDash([6,6]); ctx.lineWidth=2; ln(ctx,ax,VH*.2,ax,VH*.86); ctx.setLineDash([]);
      ctx.fillStyle='#f4b63f'; ctx.beginPath(); ctx.moveTo(ax-10,VH*.88); ctx.lineTo(ax+10,VH*.88); ctx.lineTo(ax,VH*.86-4); ctx.fill();
      if(MG.phase==='power'){ MG.pt+=dt; const p=(Math.sin(MG.pt*2.6-Math.PI/2)+1)/2; const bx=VW-50, bh=VH*.4, by=VH*.3;
        ctx.fillStyle='rgba(0,0,0,.4)'; rr(ctx,bx,by,22,bh,8); ctx.fill(); const gg=ctx.createLinearGradient(0,by+bh,0,by); gg.addColorStop(0,'#3fc7a5'); gg.addColorStop(.6,'#f4b63f'); gg.addColorStop(1,'#ff5a4e'); ctx.fillStyle=gg; rr(ctx,bx+3,by+bh-p*bh,16,p*bh,6); ctx.fill();
        ctx.fillStyle='#fff'; ctx.font='600 12px '+BODY; ctx.textAlign='center'; ctx.fillText('POWER',bx+11,by-8); }
    }
    if(MG.flight){ const f=MG.flight; f.t+=dt/.75; const p=clamp(f.t,0,1);
      const x=lerp(f.sx,f.tx,p), y=lerp(f.sy,f.ty,p)-Math.sin(p*Math.PI)*VH*.22, sc=lerp(2.2,.9,p)*m;
      ctx.strokeStyle='#ff5a4e'; ctx.lineWidth=5*sc; ctx.beginPath(); ctx.ellipse(x,y,16*sc,6*sc+Math.sin(MG.t*20)*2,0,0,TAU); ctx.stroke();
      if(p>=1){ let best: Bottle | null=null, bd=1e9; B.forEach(b=>{ const d=Math.hypot(b.x-f.tx,(b.y-48*b.sc)-f.ty)/b.sc; if(d<bd){bd=d;best=b;} });
        if(best&&bd<20){ const pts=best.gold?8:3; MG.won+=pts; S.tix+=pts; S.ticketsWon+=pts; MG.rings.push({on:best.r*4+best.c}); sfx('ding'); MG.fx.push({x:best.x,y:best.y-80*best.sc,txt:`+${pts}`,life:1.2}); }
        else { MG.rings.push({x:f.tx,y:f.ty+20*m,sc:m}); sfx('miss'); MG.fx.push({x:f.tx,y:f.ty,txt:'So close!',life:1}); }
        MG.flight=null; MG.phase=MG.left>0?'aim':'over'; updateHUD(); if(MG.left<=0) finishGame(); }
    }
    ctx.fillStyle='#fff'; ctx.font='400 '+Math.round(16*Math.max(.8,m))+'px '+DISP; ctx.textAlign='left'; ctx.fillText(`RINGS ${MG.left}`,20,VH*.76); ctx.fillText(`TICKETS +${MG.won}`,20,VH*.76+24);
    ctx.textAlign='center'; ctx.font='600 15px '+BODY; ctx.fillStyle='#ffe7a3';
    if(MG.phase==='aim') ctx.fillText('Tap or press Space to stop the aim',VW/2,VH*.8); if(MG.phase==='power') ctx.fillText('Tap again to set the throw distance',VW/2,VH*.8);
  }
  if(MG.kind==='darts'){
    const bw=Math.min(VW*.86,560*m*1.3), bh=VH*.5, bx=VW/2-bw/2, by=VH*.14;
    ctx.fillStyle='#b98a4a'; rr(ctx,bx,by,bw,bh,10); ctx.fill(); ctx.fillStyle='rgba(0,0,0,.08)'; for(let k=0;k<12;k++) ctx.fillRect(bx,by+k*bh/12,bw,2);
    ctx.strokeStyle='#5a3a24'; ctx.lineWidth=6; rr(ctx,bx,by,bw,bh,10); ctx.stroke();
    const br=Math.min(bw/7,bh/4)*.36;
    MG.balloons.forEach(b=>{ b.x=bx+(b.c+.5)*bw/7+Math.sin(T*1.3+b.ph)*4; b.y=by+(b.r+.5)*bh/4+Math.cos(T*1.7+b.ph)*4; b.R=br;
      if(b.pop){ ctx.fillStyle='rgba(0,0,0,.2)'; circ(ctx,b.x,b.y,3); return; }
      ctx.fillStyle=b.gold?'#f4b63f':b.col; el(ctx,b.x,b.y,br,br*1.2); ctx.fillStyle='rgba(255,255,255,.4)'; el(ctx,b.x-br*.35,b.y-br*.45,br*.22,br*.35);
      if(b.gold){ ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.beginPath(); ctx.ellipse(b.x,b.y,br,br*1.2,0,0,TAU); ctx.stroke(); }
    });
    const sp=320*dt; if(keys.ArrowLeft||keys.KeyA) MG.aim.x-=sp; if(keys.ArrowRight||keys.KeyD) MG.aim.x+=sp; if(keys.ArrowUp||keys.KeyW) MG.aim.y-=sp; if(keys.ArrowDown||keys.KeyS) MG.aim.y+=sp;
    MG.aim.x=clamp(MG.aim.x,bx,bx+bw); MG.aim.y=clamp(MG.aim.y,by,by+bh);
    MG.darts.forEach(d=>{ if(d.done) return; d.t+=dt/.28; const p=clamp(d.t,0,1); const x=lerp(d.sx,d.tx,p), y=lerp(d.sy,d.ty,p);
      ctx.strokeStyle='#e9dcc4'; ctx.lineWidth=3; ln(ctx,x,y,x,y+30*(1-p*.6)); ctx.fillStyle='#c23b4b'; ctx.fillRect(x-4,y+22*(1-p*.6),8,8);
      if(p>=1){ d.done=true; const hit=MG.balloons.find(b=>!b.pop&&Math.hypot(b.x-d.tx,(b.y-d.ty)/1.2)<b.R);
        if(hit){ hit.pop=true; const pts=hit.gold?6:2; MG.won+=pts; S.tix+=pts; S.ticketsWon+=pts; sfx('pop'); MG.fx.push({x:hit.x,y:hit.y,txt:`+${pts}`,life:1.1}); for(let k=0;k<14;k++) MG.fx.push({x:hit.x,y:hit.y,vx:rand(-120,120),vy:rand(-160,40),col:hit.gold?'#f4b63f':hit.col,life:.8}); }
        else { d.stuck=true; sfx('miss'); }
        updateHUD(); if(MG.left<=0&&MG.darts.every(z=>z.done)) finishGame(); } });
    MG.darts.filter(d=>d.stuck).forEach(d=>{ ctx.fillStyle='#2a2a2a'; circ(ctx,d.tx,d.ty,2.5); ctx.strokeStyle='#e9dcc4'; ctx.lineWidth=3; ln(ctx,d.tx,d.ty,d.tx+4,d.ty+14); });
    if(!MG.done){ const w=wob(), ax=MG.aim.x+w[0], ay=MG.aim.y+w[1];
      ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(ax,ay,16,0,TAU); ctx.stroke(); ln(ctx,ax-24,ay,ax-8,ay); ln(ctx,ax+8,ay,ax+24,ay); ln(ctx,ax,ay-24,ax,ay-8); ln(ctx,ax,ay+8,ax,ay+24); }
    ctx.fillStyle='#fff'; ctx.font='400 '+Math.round(16*Math.max(.8,m))+'px '+DISP; ctx.textAlign='left'; ctx.fillText(`DARTS ${MG.left}`,20,VH*.72); ctx.fillText(`TICKETS +${MG.won}`,20,VH*.72+24);
    ctx.textAlign='center'; ctx.font='600 15px '+BODY; ctx.fillStyle='#ffe7a3'; if(!MG.done) ctx.fillText(touchMode?'Tap the board to throw at that spot':'Move the mouse or arrow keys, click or Space to throw',VW/2,VH*.8);
  }
  MG.fx.forEach(f=>{ f.life-=dt; if(f.txt){ f.y-=40*dt; ctx.globalAlpha=clamp(f.life,0,1); ctx.fillStyle='#f4b63f'; ctx.font='400 22px '+DISP; ctx.textAlign='center'; ctx.fillText(f.txt,f.x,f.y); }
    else { f.x+=f.vx*dt; f.y+=f.vy*dt; f.vy+=400*dt; ctx.globalAlpha=clamp(f.life,0,1); ctx.fillStyle=f.col; ctx.fillRect(f.x,f.y,5,3); } });
  ctx.globalAlpha=1; MG.fx=MG.fx.filter(f=>f.life>0);
  if(MG.done){ ctx.fillStyle='rgba(13,10,36,.75)'; rr(ctx,VW/2-150,VH*.36,300,90,16); ctx.fill(); ctx.fillStyle='#f4b63f'; ctx.font='400 26px '+DISP; ctx.textAlign='center'; ctx.fillText(MG.won?`+${MG.won} TICKETS`:'NO LUCK',VW/2,VH*.36+42); ctx.fillStyle='#fff'; ctx.font='600 14px '+BODY; ctx.fillText(MG.won>=10?'The booth keeper cheers for you!':'Try another round?',VW/2,VH*.36+68); }
}
function finishGame(): void { MG.done=true; setBar(`Round over. You won ${MG.won} tickets (${S.tix} total).`,`Play again · ${ks(1000)}`,()=>startGame(MG.kind),'Leave'); }

// ---------- input ----------
const keys: Record<string, boolean> = {}; let touchMode=false;
window.addEventListener('keydown',e=>{
  if(S.mode==='title') return;
  if((e.target as HTMLElement)?.tagName==='INPUT') return;
  keys[e.code]=true;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  if(e.repeat) return;
  if(!$('modal').hidden){ if(e.code==='Escape') closeModal(); return; }
  if(e.code==='Escape'){ if(chatOpen) closeChat(); else if(S.photo) exitPhotoMode(); else if(S.mode==='scene') endScene(); else if(S.mode==='mg') endGame(); return; }
  if((e.code==='KeyT'||e.code==='Enter')&&S.mode!=='mg'){ e.preventDefault(); openChat(); return; }
  if(e.code==='KeyE'||e.code==='Space'||e.code==='Enter'){ if(document.activeElement&&document.activeElement.tagName==='BUTTON'&&e.code!=='KeyE') return; press(); }
  if(e.code==='KeyP'){ S.photo?exitPhotoMode():enterPhotoMode(); }
  if(e.code==='KeyC') setCam(S.settings.cam==='close'?'wide':'close');
  if(e.code==='KeyB'&&S.mode==='walk') openBag();
  if(e.code==='KeyQ'&&S.mode==='walk') wave();
  if(e.code==='KeyM'){ S.settings.mini=!S.settings.mini; saveSettings(); syncChrome(); }
});
window.addEventListener('keyup',e=>{ keys[e.code]=false; });
window.addEventListener('blur',()=>{ for(const k in keys) keys[k]=false; });
function press(): void {
  if(S.paused) return;
  if(S.mode==='walk'){ if(TR.riding) return; const it=nearIT(); if(it) it.act(); }
  else if(S.mode==='mg') mgPress();
}
cv.addEventListener('pointerdown',e=>{
  if(e.pointerType==='touch') setTouch(true);
  if(S.mode==='mg'){ if(MG.kind==='darts') mgPress(e.clientX,e.clientY); else mgPress(); }
});
cv.addEventListener('pointermove',e=>{ if(S.mode==='mg'&&MG.kind==='darts'&&e.pointerType==='mouse'){ MG.aim.x=e.clientX; MG.aim.y=e.clientY; } });
// look around: drag the 3D view, wheel or pinch to zoom
const drag={id:null as number | null,x:0,y:0,moved:0};
const pinch=new Map<number, {x:number;y:number}>(); let pinchD=0;
world.addEventListener('pointerdown',e=>{
  if(e.pointerType==='touch') setTouch(true);
  if(chatOpen) closeChat();
  pinch.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pinch.size===2){ const [a,b]=[...pinch.values()]; pinchD=Math.hypot(a.x-b.x,a.y-b.y); }
  drag.id=e.pointerId; drag.x=e.clientX; drag.y=e.clientY; drag.moved=0; world.setPointerCapture(e.pointerId); world.classList.add('drag');
});
world.addEventListener('pointermove',e=>{
  if(pinch.has(e.pointerId)) pinch.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pinch.size===2){ const [a,b]=[...pinch.values()]; const d=Math.hypot(a.x-b.x,a.y-b.y); if(pinchD) CAM.dist=clamp(CAM.dist*pinchD/d,5,40); pinchD=d; return; }
  if(e.pointerId!==drag.id) return;
  const dx=e.clientX-drag.x, dy=e.clientY-drag.y; drag.x=e.clientX; drag.y=e.clientY; drag.moved+=Math.abs(dx)+Math.abs(dy);
  CAM.yaw-=dx*.006; CAM.pitch=clamp(CAM.pitch+dy*.004,.08,1.25);
});
const endDrag=(e: PointerEvent)=>{ pinch.delete(e.pointerId); pinchD=0; if(e.pointerId===drag.id){ drag.id=null; world.classList.remove('drag'); } };
world.addEventListener('pointerup',endDrag); world.addEventListener('pointercancel',endDrag);
world.addEventListener('wheel',e=>{ e.preventDefault(); CAM.dist=clamp(CAM.dist*Math.exp(e.deltaY*.0012),5,40); },{passive:false});
$('prompt').addEventListener('click',press);
$('act').addEventListener('pointerdown',e=>{ e.preventDefault(); press(); });
const joy: { x: number; y: number; id: number | null } = {x:0,y:0,id:null};
$('stick').addEventListener('pointerdown',e=>{ joy.id=e.pointerId; $('stick').setPointerCapture(e.pointerId); moveJoy(e); });
$('stick').addEventListener('pointermove',e=>{ if(e.pointerId===joy.id) moveJoy(e); });
const endJoy=(e: PointerEvent)=>{ if(e.pointerId!==joy.id) return; joy.id=null; joy.x=joy.y=0; $('knob').style.transform=''; };
$('stick').addEventListener('pointerup',endJoy); $('stick').addEventListener('pointercancel',endJoy);
function moveJoy(e: PointerEvent): void { const r=$('stick').getBoundingClientRect(); let dx=e.clientX-(r.left+r.width/2), dy=e.clientY-(r.top+r.height/2); const d=Math.hypot(dx,dy), mxd=r.width/2-10; if(d>mxd){dx=dx/d*mxd;dy=dy/d*mxd;} joy.x=dx/mxd; joy.y=dy/mxd; $('knob').style.transform=`translate(${dx}px,${dy}px)`; }
function setTouch(on: boolean): void { if(touchMode===on) return; touchMode=on; document.body.classList.toggle('touch',on); syncChrome(); }
if(window.matchMedia&&matchMedia('(pointer:coarse)').matches) touchMode=true;
document.body.classList.toggle('touch',touchMode);

$('bBag').onclick=()=>{ if(S.mode==='walk') openBag(); };
$('bPhoto').onclick=()=>enterPhotoMode();
$('bCam').onclick=()=>setCam(S.settings.cam==='close'?'wide':'close');
$('bSet').onclick=openSettings;
$('bAv').onclick=()=>{ if(S.mode==='walk') openAvatar(false); };
$('bWave').onclick=()=>wave();
$('bChat').onclick=()=>{ chatOpen?closeChat():openChat(); };
$('waveT').addEventListener('pointerdown',e=>{ e.preventDefault(); wave(); });
$('bSound').onclick=()=>{ audioInit(S.settings.sound); setSound(!S.settings.sound); };

function syncChrome(): void {
  const playing=S.mode!=='title', ph=!!S.photo;
  $('hud').hidden=!playing||ph;
  $('tools').hidden=!playing||ph;
  $('mini').hidden=!playing||ph||S.mode!=='walk'||!S.settings.mini;
  $('touch').hidden=!playing||ph||!touchMode||S.mode!=='walk';
  $('chat').hidden=!playing||ph||S.mode==='mg';
  $('sceneBar').hidden=ph||!(S.mode==='scene'||S.mode==='mg');
  cv.hidden=S.mode!=='mg';
  if(S.mode!=='walk'||ph) $('prompt').hidden=true;
  $<HTMLButtonElement>('bBag').disabled=S.mode!=='walk';
  $('photoHide').hidden=S.mode!=='walk';
  document.body.classList.toggle('inplay',S.mode==='scene'||S.mode==='mg');
  $('vfText').textContent=S.mode==='scene'?'PHOTO MODE · ON THE RIDE':'PHOTO MODE';
}

// ---------- interaction & discovery ----------
function nearIT(): Interactable | null { let best: Interactable | null=null, bd=1e9; for(const it of IT){ const d=Math.hypot(P.x-it.x,P.y-it.y); if(d<it.r&&d<bd){bd=d;best=it;} } return best; }
let lastIT: Interactable | null=null;
function checkWorld(): void {
  for(const z of ZONES){ if(!S.zones.includes(z.id)&&P.x>z.x&&P.x<z.x+z.w&&P.y>z.y&&P.y<z.y+z.h){ S.zones.push(z.id); sfx('ding');
    toast(`<span class="z">${String(z.n).padStart(2,'0')} · ${z.name}</span><span class="mm">${z.my}</span>Postcard collected (${S.zones.length}/8)`,true); updateHUD(); } }
  for(const s of SECRETS){ if(!S.secrets.includes(s.id)&&Math.hypot(P.x-s.x,P.y-s.y)<50){ S.secrets.push(s.id); S.kyat+=300; sfx('ding'); toast(`Secret found: <b>${s.name}</b><br>${s.d} <span class="muted">(+300 Ks)</span>`); updateHUD(); } }
  const it=(S.mode==='walk'&&!TR.riding&&!S.photo)?nearIT():null;
  if(it!==lastIT||it){ if(it){ $('prompt').innerHTML=`<span class="key">${touchMode?'GO':'E'}</span>${it.label()}`; $('prompt').hidden=false; } else $('prompt').hidden=true; lastIT=it; }
}
function maybeSummary(): void {
  if(!S.showDone||S.summaryShown||S.mode!=='walk') return;
  S.summaryShown=true; S.finaleSeen=true; updateHUD();
  openModal('What a night!',`<p>The last sparks drift over the skyline. Here is your Yay Kyaw night:</p>
  <div class="statgrid"><div><b>${S.zones.length}/8</b>Postcards</div><div><b>${S.secrets.length}/6</b>Secrets</div><div><b>${S.snacks.length}/6</b>Snacks tasted</div><div><b>${S.rides}</b>Rides</div><div><b>${S.ticketsWon}</b>Tickets won</div><div><b>${S.prizes.length+S.toys.length}</b>Souvenirs</div><div><b>${S.photos.length}</b>Photos</div></div>
  <p class="muted">The fair stays open. Keep exploring, find the rest of the secrets, or watch the finale again from the Finale View deck.</p>`);
}

// ---------- movement ----------
function movePlayer(dt: number): void {
  if(S.mode!=='walk'||S.paused) { P.moving=false; return; }
  if(TR.riding){
    TR.rideU+=dt*.55; const [x,y]=trackPos(TR.u-.32); P.x=x; P.y=y;
    if(TR.rideU>=TAU){ TR.riding=false; P.hidden=false; P.x=TRK.cx; P.y=TRK.cy+TRK.ry+90; toast('Toot toot! Thanks for riding the mini train.'); }
    return;
  }
  let ix=0, iy=0;
  if(!chatOpen){ if(keys.ArrowLeft||keys.KeyA) ix--; if(keys.ArrowRight||keys.KeyD) ix++; if(keys.ArrowUp||keys.KeyW) iy--; if(keys.ArrowDown||keys.KeyS) iy++; }
  if(joy.id!=null){ ix=joy.x; iy=joy.y; }
  const mag=Math.hypot(ix,iy);
  if(mag>.15){
    // camera-relative: up on the stick walks away from the camera
    const fx=-Math.sin(CAM.yaw), fz=-Math.cos(CAM.yaw), rx=Math.cos(CAM.yaw), rz=-Math.sin(CAM.yaw);
    const dx=rx*ix-fx*iy, dy=rz*ix-fz*iy;
    const sp=(keys.ShiftLeft||keys.ShiftRight||mag>.95&&joy.id!=null?210:135)*Math.min(1,mag)/mag;
    const nx=P.x+dx*sp*dt, ny=P.y+dy*sp*dt; if(!blocked(nx,P.y,6)) P.x=nx; if(!blocked(P.x,ny,6)) P.y=ny;
    P.moving=true; turnTo(P,dx,dy,dt*1.4);
  } else P.moving=false;
}

// ---------- main loop ----------
let last=performance.now(), chatT=0, ready=false;
const crowdBuf: CrowdItem[] = [];
function frameData(dt: number): Frame {
  crowdBuf.length=0;
  for(const n of NPC) crowdBuf.push({x:n.x,y:n.y,hd:n.hd,s:n.s,moving:n.moving,t:T+n.ph,shirt:n.shirt,lon:n.lon,skin:n.skin,hat:n.hat,bun:n.bun,balloon:n.balloon});
  const others=[...REMOTE.values()].map(r=>({id:r.peer,x:r.x,y:r.y,hd:r.hd,moving:r.moving,wave:T<r.waveUntil,look:r.look,balloon:r.balloon,visible:r.where==='walk'}));
  let ride: RideKind=null;
  if(S.mode==='scene') ride=SC.kind; else if(S.mode==='walk'&&TR.riding) ride='train';
  const title=S.mode==='title';
  const cam=title?{yaw:T*.05,pitch:.38,dist:46}:CAM;
  return {
    t:T, dt, night:clamp((S.clock-(18*60+30))/60,0,1), quality:S.settings.gfx,
    me:{x:title?900:P.x,y:title?2000:P.y,hd:P.hd,moving:P.moving,wave:T<P.waveUntil,look:myLook(),balloon:S.balloon,hidden:P.hidden||title},
    crowd:crowdBuf, bikes:BIKES, others, ride, rideT:SC.t, trainU:TR.u, cam,
    sparkle:SECRETS.map(s=>S.secrets.includes(s.id)?0:clamp(1-Math.hypot(P.x-s.x,P.y-s.y)/320,0,1)),
    steamFrom:CARTS,
  };
}
function renderNow(dt: number): { atTop: boolean } { return render3d(frameData(dt)); }
function frame(now: number): void {
  const dt=Math.min(.05,(now-last)/1000); last=now; T+=dt;
  if(S.mode!=='title'&&!S.paused){
    S.clock=Math.min(23*60,S.clock+dt/2);
    if(!S.showStarted&&S.clock>=21*60+30){ S.showStarted=true; S.showT=42; toast('<span class="z">Fireworks!</span>The finale has begun. The Finale View deck has the best seat.',true); if(S.mode==='scene'&&SC.kind==='finale') setBar('The fireworks finale has begun! Press P to take a photo.'); updateHUD(); }
    if(S.showStarted&&!S.showDone){ S.showT-=dt; if(S.showT<=0){ S.showDone=true; if(S.mode==='scene'&&SC.kind==='finale'){ S.finaleSeen=true; setBar('That was beautiful. Stay for an encore, or head back to the fair.','Encore',()=>{ SC.replay=true; $('sceneAlt').hidden=true; },'Back to the fair'); } else maybeSummary(); updateHUD(); } }
  }
  updFireworks(dt);
  movePlayer(dt);
  TR.u+=dt*.55;
  for(const n of NPC) updateNPC(n,dt);
  updateBikes(dt);
  for(const r of REMOTE.values()){ const k=Math.min(1,dt*8); r.moving=Math.hypot(r.tx-r.x,r.ty-r.y)>1.5; r.x=lerp(r.x,r.tx,k); r.y=lerp(r.y,r.ty,k); }
  updateNpcSay(dt);
  if(S.mode==='mg') drawMG(dt);
  else if(ready){ const res=renderNow(dt); if(S.mode==='scene') updateScene(dt,res.atTop); }
  updateTags();
  if(S.mode==='walk'){ checkWorld(); if(S.settings.mini&&!S.photo) drawMini(); }
  sendPresence(dt);
  chatT-=dt; if(chatT<=0){ chatT=.5; let n=0; if(S.mode==='walk'){ for(const q of NPC) if(Math.abs(q.x-P.x)<280&&Math.abs(q.y-P.y)<280) n++; n+=REMOTE.size; } setChatter(S.mode==='walk'?.25+.75*Math.min(1,n/12):S.mode==='title'?0:.2); }
  if(A.c&&A.music){ let v: number; if(S.mode==='walk'||S.mode==='title'){ const d=Math.hypot(P.x-ST.x,P.y-ST.y); v=.03+.5*clamp(1-d/650,0,1); } else if(S.mode==='scene'&&SC.kind==='carousel') v=.45; else v=.06;
    A.music.gain.setTargetAtTime(v,A.c.currentTime,.3); if(A.amb) A.amb.gain.setTargetAtTime(S.mode==='walk'?.22:.1,A.c.currentTime,.4); }
  if((T*10|0)%3===0) $('clock').textContent=fmtClock(S.clock);
  requestAnimationFrame(frame);
}
function drawMini(): void {
  const w=mini.width, h=mini.height, s=w/WW;
  mx.clearRect(0,0,w,h); mx.fillStyle='#1a1430'; mx.fillRect(0,0,w,h);
  mx.fillStyle='#0f1838'; mx.fillRect(0,0,w,NORTH*s);
  mx.fillStyle='#3a3350'; mx.fillRect(ROAD.x*s,NORTH*s,ROAD.w*s,h);
  ZONES.forEach(z=>{ const has=S.zones.includes(z.id); mx.fillStyle=has?'rgba(244,182,63,.35)':'rgba(255,255,255,.08)'; rr(mx,z.x*s,z.y*s,z.w*s,z.h*s,6); mx.fill();
    mx.fillStyle=has?'#ffe7a3':'rgba(255,255,255,.4)'; mx.font='700 18px '+BODY; mx.textAlign='center'; mx.textBaseline='middle'; mx.fillText(String(z.n),(z.x+z.w/2)*s,(z.y+z.h/2)*s); });
  mx.fillStyle='#3fc7a5'; for(const r of REMOTE.values()){ mx.beginPath(); mx.arc(r.x*s,r.y*s,5,0,TAU); mx.fill(); }
  // which way the camera looks
  const px=P.x*s, py=P.y*s, fx=-Math.sin(CAM.yaw), fz=-Math.cos(CAM.yaw);
  mx.fillStyle='rgba(255,231,163,.25)'; mx.beginPath(); mx.moveTo(px,py); mx.arc(px,py,26,Math.atan2(fz,fx)-.5,Math.atan2(fz,fx)+.5); mx.closePath(); mx.fill();
  mx.fillStyle='#ff5a4e'; mx.beginPath(); mx.arc(px,py,6,0,TAU); mx.fill(); mx.strokeStyle='#fff'; mx.lineWidth=2; mx.stroke();
}

// ---------- boot ----------
function startGameFlow(): void {
  $('title').hidden=true; S.mode='walk'; audioInit(S.settings.sound); setSound(S.settings.sound);
  P.x=900; P.y=2545; P.hd=Math.PI; CAM.yaw=0;
  syncChrome(); updateHUD();
  const welcome=()=>{ setTimeout(()=>toast(`<span class="z">Welcome${S.settings.name?', '+esc(S.settings.name):''}!</span>Eight zones, six hidden secrets, and fireworks at 9:30 PM. Press T to chat.`,true),300); };
  if(!S.settings.avDone) openAvatar(true,welcome); else welcome();
}
$('start').onclick=startGameFlow;

function snapshot(): unknown { return {S:JSON.parse(JSON.stringify({...S,paused:false,photo:false})),P:{x:P.x,y:P.y,hd:P.hd}}; }
async function boot(data: any): Promise<void> {
  if(data&&data.S){ Object.assign(S,data.S); S.paused=false; S.photo=false; if(data.P){P.x=data.P.x;P.y=data.P.y;P.hd=data.P.hd||0;}
    if(S.mode!=='title'){ $('title').hidden=true; S.mode='walk'; } }
  init3d(world,onBoom); resize(); window.addEventListener('resize',resize);
  setCam(S.settings.cam);
  spawnCrowd(); spawnBikes(); setSound(S.settings.sound); syncChrome(); updateHUD(); initRoom();
  requestAnimationFrame(t=>{ last=t; frame(t); });
  await loadFonts();
  build3d(); ready=true;
}
try{ window.claude?.hot?.snapshot?.(snapshot); }catch{ /* no viewer */ }
const hot=window.claude&&window.claude.hot;
if(hot&&hot.ready) hot.ready(boot); else boot(hot&&hot.data||{});
// audio needs a gesture; also unlock on first tap after a reload
window.addEventListener('pointerdown',()=>{ if(S.mode!=='title'){ audioInit(S.settings.sound); if(A.c&&A.c.state==='suspended') A.c.resume(); } });
window.__ykn={S,P,CAM,startScene,startGame,TR,syncPeers,BIKES,say};
