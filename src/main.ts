// Yay Kyaw Nights: a walkable 3D night street fair inspired by Yangon's Yay Kyaw.
// Game logic works in map units (see layout.ts); world3d.ts draws it with Three.js.
import { Ctx, TAU, rand, pick, clamp, lerp, srng, rr, el, circ, ln, ks, MMF, DISP, BODY, $ } from './util';
import { SHIRTS, LONS, SKINS, BALLOONS, AV_SHIRTS, AV_LONS, person, PersonOpts, Avatar, Gender, DEFAULT_AVATAR, avatarOpts, cleanAvatar, randomAvatar, genderStartingLook } from './people';
import { A, audioInit, sfx, bell, horn, setChatter, setMaster, loadVoices, speak } from './audio';
import { CROWD_LINES, VENDOR_CALLS, REPLIES, VOICE_CLIPS } from './voices';
import {
  WW, WH, NORTH, ROAD, ZONES, FW, CR, PS, STATION, TRAIN_STOP, TRAIN_OFF, TRACK_LEN, ST, FV, PHOTO, TOYS_AT, UNCLE, ARCH_Y, SNACKS, Snack, CARTS, BOOTHS, SECRETS,
  STALLFRONTS, VENDOR_POSTS, POND, WISH_STALL, BUMPER, HAND_WHEEL, SWINGER, PWE_FOOD, CANDLE, CANDLE_N, FLOWER_N, TEA, TEA_TABS, teaStools, M, blocked, trackPos,
} from './layout';
import { friends } from './friends';
import { openWishes, Wish, WishKind, WISH_PRICE, WISH_IDEAS, WISH_MAX_LEN, cleanWish } from './wishes';
import { init3d, build3d, resize3d, render3d, launchFirework, fountain, renderPreview, capture, project, rigKey, setWishes, wishSpot, BUMPER_N, CANDLE_MINE, CrowdItem, Frame, Look, RideKind } from './world3d';

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
interface Settings { density: 'low' | 'med' | 'high'; gfx: 'low' | 'high'; cam: 'close' | 'wide'; sound: boolean; mini: boolean; av: Avatar; name: string; avDone: boolean; realTime?: boolean }
interface GameState {
  mode: Mode; kyat: number; tix: number; clock: number;
  zones: string[]; secrets: string[]; snacks: string[]; toys: string[]; prizes: string[]; photos: string[];
  rides: number; games: number; ticketsWon: number; finaleSeen: boolean; showStarted: boolean; showDone: boolean; summaryShown: boolean;
  balloon: string | null; fan: boolean; uncleAt: number; showT: number; paused: boolean; photo: boolean;
  settings: Settings;
}
const S: GameState = {
  showT:0, paused:false, photo:false,
  mode:'title', kyat:15000, tix:0, clock:17*60,
  zones:[], secrets:[], snacks:[], toys:[], prizes:[], photos:[],
  rides:0, games:0, ticketsWon:0, finaleSeen:false, showStarted:false, showDone:false, summaryShown:false,
  balloon:null, fan:false, uncleAt:-999,
  settings:{density:'med', gfx:'high', cam:'close', sound:true, mini:true, av:{...DEFAULT_AVATAR}, name:'', avDone:false}
};
try{ const sv=JSON.parse(localStorage.getItem('ykn-settings')||'null'); if(sv){ Object.assign(S.settings,sv); S.settings.av={...DEFAULT_AVATAR,...(sv.av||{})}; } }catch{ /* storage unavailable */ }
function saveSettings(): void { try{ localStorage.setItem('ykn-settings',JSON.stringify(S.settings)); }catch{ /* storage unavailable */ } }

const P = {x:900,y:2540,hd:Math.PI,moving:false,hidden:false,waveUntil:0,vx:0,vy:0,spd:0,kx:0,ky:0,dance:false,sit:false,standX:0,standY:0};
const LOOK = {yaw:0,pitch:0}; // turning your head on a ride or while watching the fireworks
const CAM = {yaw:0,pitch:.42,dist:11,zoom:11};
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
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
IT.push({x:STATION.x,y:STATION.y,r:80,label:()=>TRN.waiting?(TRN.dwell>0?'Hop on the mini train!':'Waiting for the mini train… it is coming'):`Ride the mini train round the whole fair · ရထားလေး · ${ks(500)}`,act:buyTrain});
IT.push({x:TOYS_AT.x,y:TOYS_AT.y+30,r:48,label:()=>'Browse the toy stall',act:openToys});
IT.push({x:PHOTO.x,y:PHOTO.y+30,r:45,label:()=>`Souvenir photo booth · ${ks(500)}`,act:boothPhoto});
IT.push({x:FV.x,y:FV.y+10,r:110,label:()=>S.showStarted&&!S.showDone?'Watch the fireworks now!':S.showDone?'Watch the finale again':'Watch the skyline',act:()=>startScene('finale')});
IT.push({x:UNCLE.x,y:UNCLE.y+10,r:45,label:()=>'Ask Uncle for pocket money',act:askUncle});
IT.push({x:WISH_STALL.x,y:WISH_STALL.y+50,r:60,label:()=>'Make a Thadingyut wish · ဆုတောင်း',act:()=>openWish('sky')});
IT.push({x:POND.x-POND.rx-44,y:POND.y+POND.ry*.5,r:60,label:()=>'Look out over all the wishes',act:()=>startScene('wishes')});
IT.push({x:POND.x-POND.rx-44,y:POND.y-POND.ry*.3,r:60,label:()=>'Look out over all the wishes',act:()=>startScene('wishes')});
IT.push({x:POND.x+POND.rx+44,y:POND.y,r:70,label:()=>`Float a wish on the lake · ${ks(WISH_PRICE.water)}`,act:()=>openWish('water')});
IT.push({x:WISH_STALL.x-150,y:WISH_STALL.y-40,r:70,label:()=>`Float a wish on the lake · ${ks(WISH_PRICE.water)}`,act:()=>openWish('water')});
IT.push({x:HAND_WHEEL.x,y:HAND_WHEEL.y+80,r:60,label:()=>`Ride the hand-turned wheel · လူအားချားရဟတ် · ${ks(1500)}`,act:()=>buyRide('handwheel',1500)});
IT.push({x:SWINGER.x,y:SWINGER.y+SWINGER.R+40,r:60,label:()=>`Ride the flying swing · ဒန်းလွှဲ · ${ks(1200)}`,act:()=>buyRide('swinger',1200)});
IT.push({x:BUMPER.x-40,y:BUMPER.y+BUMPER.h/2,r:55,label:()=>`Dodge the bumper cars for 30 seconds · ${ks(1000)}`,act:startDodge});
IT.push({x:BUMPER.x+BUMPER.w/2,y:BUMPER.y+BUMPER.h+40,r:60,label:()=>`Drive a bumper car · ကားတိုက်မောင်းမယ် · ${ks(1000)}`,act:startDrive});
PWE_FOOD.forEach(f=>IT.push({x:f.x,y:f.y+40,r:50,label:()=>`Buy ${f.name.toLowerCase()} · ${f.my} · ${ks(f.p)}`,act:()=>buyPwe(f)}));
IT.push({x:ST.x,y:ST.y+130,r:95,label:()=>P.dance?'Stop dancing':'Dance with the dancers · ကခုန်မယ်',act:toggleDance});
IT.push({x:CANDLE.x,y:CANDLE.y+CANDLE.R+30,r:70,label:()=>CAND.mine>=CANDLE_MINE?'Every lamp here is lit. Thank you!':`Light an oil lamp · ဆီမီးထွန်းမယ် · ${ks(200)}`,act:lightLamp});
IT.push({x:CANDLE.x-CANDLE.R-30,y:CANDLE.y,r:70,label:()=>`Offer flowers · ပန်းကပ်မယ် · ${ks(300)}`,act:offerFlowers});
IT.push({x:TEA.x-120,y:TEA.y+60,r:60,label:()=>`Order tea at the counter · ${ks(500)}`,act:orderTea});
TEA_TABS.forEach((_,i)=>{ const [x,y]=teaStools(i)[teaFree(i)];
  const ox=TEA_TABS[i][0]+(x-TEA_TABS[i][0])/17*46, oy=TEA_TABS[i][1]+(y-TEA_TABS[i][1])/17*46;
  IT.push({x:ox,y:oy,r:34,label:()=>P.sit?'Stand up':'Sit down at this table · ထိုင်မယ်',act:()=>sitAt(i)}); });

// ---------- NPCs ----------
interface Npc { x: number; y: number; tx: number; ty: number; sp: number; wait: number; ph: number; moving: boolean; stuck: number; hd: number; s: number;
  shirt: string; lon: string; skin: string; bun: boolean; hat?: boolean; balloon?: string | null; leader?: Npc; ox?: number; oy?: number; post?: boolean; sit?: number; nod?: number }
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
  // people sitting at the teashop tables, and kneeling to light lamps at the candle festival
  TEA_TABS.forEach((_,i)=>teaStools(i).forEach(([x,y,hd],k)=>{ if(k===teaFree(i)) return; NPC.push(mk({x,y,hd,post:true,sit:.5,nod:rand(0,9)})); }));
  for(let k=0;k<12;k++){ const a=Math.PI*.15+k/12*Math.PI*1.7+rand(-.05,.05), R=CANDLE.R+16; NPC.push(mk({x:CANDLE.x+Math.cos(a)*R,y:CANDLE.y+Math.sin(a)*R,hd:Math.atan2(-Math.cos(a),-Math.sin(a)),post:true,sit:.5,nod:rand(0,9),bun:Math.random()<.6})); }
  for(let i=0;i<n;i++){
    const [x,y]=freePoint(); const L=mk({x,y}); [L.tx,L.ty]=freePoint(); NPC.push(L);
    if(Math.random()<.3) L.balloon=pick(BALLOONS);
    if(Math.random()<.35){ const k=Math.random()<.4?2:1; for(let j=0;j<k;j++) NPC.push(mk({x:x+rand(-10,10),y:y+rand(4,12),s:.68,leader:L,ox:rand(-14,14),oy:rand(4,12),balloon:Math.random()<.4?pick(BALLOONS):null,bun:Math.random()<.5})); }
  }
}
function turnTo(n: { hd: number }, dx: number, dy: number, dt: number): void {
  const want=Math.atan2(dx,dy); let d=want-n.hd; d=Math.atan2(Math.sin(d),Math.cos(d)); n.hd+=d*Math.min(1,dt*10);
}
/** The empty stool at each teashop table, kept for you. */
function teaFree(i: number): number { return (i*3+1)%4; }
function updateNPC(n: Npc, dt: number): void {
  if(n.sit){ n.moving=false; if(n.nod!=null) n.nod+=dt; return; }
  if(n.post){ n.moving=false; const d=Math.hypot(P.x-n.x,P.y-n.y); if(d<160&&P.y>n.y) turnTo(n,P.x-n.x,P.y-n.y,dt*.3); return; }
  let tx: number, ty: number, sp: number;
  if(n.leader){ tx=n.leader.x+n.ox; ty=n.leader.y+n.oy; sp=n.leader.sp*1.4; const d=Math.hypot(tx-n.x,ty-n.y); if(d>140&&!blocked(tx,ty,4)){n.x=tx;n.y=ty;} if(d<6){ n.moving=false; return; } }
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
  const want=['400 30px "KhitHaung"','500 30px "KhitHaung"','600 30px "KhitHaung"','700 30px "KhitHaung"','400 30px "Pyidaungsu"','700 30px "Padauk"','400 14px "Brandon Text"','700 14px "Brandon Text"','400 20px "Bungee"'].map(f=>document.fonts.load(f,'ရေကျော် Aa').catch(()=>[]));
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

// ---------- pwe bumper cars: they wander, chase you when you walk in, and you can run ----------
interface Bumper { x: number; y: number; hd: number; sp: number; hit: number; cd: number; tx: number; ty: number }
const BUMPS: Bumper[] = [];
const DODGE = {on:false,t:0,hits:0,shown:''};
let shake=0;
const BR=22; // a car's radius, in map units
const inArena=(x: number, y: number)=>x>BUMPER.x&&x<BUMPER.x+BUMPER.w&&y>BUMPER.y&&y<BUMPER.y+BUMPER.h;
function bumpTarget(b: Bumper): void { b.tx=rand(BUMPER.x+50,BUMPER.x+BUMPER.w-50); b.ty=rand(BUMPER.y+50,BUMPER.y+BUMPER.h-50); }
function spawnBumpers(): void {
  BUMPS.length=0;
  for(let i=0;i<BUMPER_N;i++){ const b={x:BUMPER.x+70+(i%4)*120,y:BUMPER.y+90+Math.floor(i/4)*200,hd:rand(0,TAU),sp:0,hit:0,cd:0,tx:0,ty:0}; bumpTarget(b); BUMPS.push(b); }
}
function bang(b: Bumper, v: number): void {
  if(b.cd>0) return; b.cd=.6; b.hit=v;
  if(S.mode==='walk'&&Math.hypot(P.x-b.x,P.y-b.y)<(v>=1?520:220)){ sfx('bump'); if(v>=1&&Math.random()<.5) sfx('zap'); }
}
function updateBumpers(dt: number): void {
  const me=S.mode==='walk'&&!P.hidden&&inArena(P.x,P.y);
  if(DODGE.on){ DODGE.t-=dt; if(!me&&S.mode==='walk') endDodge(false); else if(DODGE.t<=0) endDodge(true); }
  BUMPS.forEach((b,i)=>{
    b.hit=Math.max(0,b.hit-dt*2.5); b.cd-=dt;
    if(DRIVE.on&&i===MY_CAR){ driveCar(b,dt); return; }
    let tx=b.tx, ty=b.ty, want=70;
    const mine=DRIVE.on?BUMPS[MY_CAR]:null;
    if(mine&&i%3===0&&Math.hypot(mine.x-b.x,mine.y-b.y)<320){ tx=mine.x+Math.sin(mine.hd)*mine.sp*.4; ty=mine.y+Math.cos(mine.hd)*mine.sp*.4; want=96; }
    else if(me&&(DODGE.on||i<3)&&Math.hypot(P.x-b.x,P.y-b.y)<(DODGE.on?700:240)){ tx=P.x+P.vx*.45; ty=P.y+P.vy*.45; want=DODGE.on?100+(30-DODGE.t)*1.4:92; }
    else if(Math.hypot(tx-b.x,ty-b.y)<30) bumpTarget(b);
    let d=Math.atan2(tx-b.x,ty-b.y)-b.hd; d=Math.atan2(Math.sin(d),Math.cos(d));
    b.hd+=clamp(d,-2.3*dt,2.3*dt);
    b.sp+=(want*(Math.abs(d)>1.6?.45:1)-b.sp)*Math.min(1,dt*2);
    b.x+=Math.sin(b.hd)*b.sp*dt; b.y+=Math.cos(b.hd)*b.sp*dt;
    const x0=BUMPER.x+BR+6, x1=BUMPER.x+BUMPER.w-BR-6, y0=BUMPER.y+BR+6, y1=BUMPER.y+BUMPER.h-BR-6;
    if(b.x<x0||b.x>x1){ b.x=clamp(b.x,x0,x1); b.hd=-b.hd; b.sp*=.5; bang(b,.6); }
    if(b.y<y0||b.y>y1){ b.y=clamp(b.y,y0,y1); b.hd=Math.PI-b.hd; b.sp*=.5; bang(b,.6); }
  });
  for(let i=0;i<BUMPS.length;i++) for(let j=i+1;j<BUMPS.length;j++){
    const a=BUMPS[i], c=BUMPS[j], dx=c.x-a.x, dy=c.y-a.y, d=Math.hypot(dx,dy)||1;
    if(d<BR*2){ const push=(BR*2-d)/2, nx=dx/d, ny=dy/d; a.x-=nx*push; a.y-=ny*push; c.x+=nx*push; c.y+=ny*push;
      if(DRIVE.on&&(i===MY_CAR||j===MY_CAR)){ if(a.cd<=0&&c.cd<=0){ const sg=i===MY_CAR?1:-1; carHit(i===MY_CAR?a:c,i===MY_CAR?c:a,nx*sg,ny*sg); } }
      else if(a.cd<=0&&c.cd<=0){ bang(a,1); c.cd=.6; c.hit=1; a.sp*=.3; c.sp*=.3; a.hd+=rand(-1.2,1.2); c.hd+=rand(-1.2,1.2); } }
  }
  if(me) for(const b of BUMPS){
    const dx=P.x-b.x, dy=P.y-b.y, d=Math.hypot(dx,dy)||1;
    if(d<BR+12&&b.cd<=0){
      const k=150+b.sp*2.4; P.kx+=dx/d*k; P.ky+=dy/d*k; shake=Math.max(shake,.75);
      bang(b,1); sfx('zap'); b.sp*=.2; b.hd+=Math.PI*.7;
      if(DODGE.on){ DODGE.hits++; } else toast('Bzzt! A bumper car got you. Run!');
    }
  }
  shake=Math.max(0,shake-dt*2.2);
}
// driving one yourself: W/S or the stick for go and reverse, A/D to steer; bump as many cars as you can in a minute
const DRIVE={on:false,given:0,taken:0,kx:0,ky:0,shown:''};
const MY_CAR=3, DRIVE_SECS=60;
function startDrive(): void {
  if(!pay(1000)) return; S.games++; S.rides++;
  const b=BUMPS[MY_CAR]; b.x=BUMPER.x+BUMPER.w/2; b.y=BUMPER.y+BUMPER.h-50; b.hd=Math.PI; b.sp=0; b.cd=0;
  DRIVE.on=true; DRIVE.given=DRIVE.taken=0; DRIVE.kx=DRIVE.ky=0; DRIVE.shown='';
  startScene('bumper'); sfx('zap'); updateHUD();
}
function driveCar(b: Bumper, dt: number): void {
  let thr=0, st=0;
  if(!chatOpen){ if(keys.ArrowUp||keys.KeyW) thr++; if(keys.ArrowDown||keys.KeyS) thr--; if(keys.ArrowLeft||keys.KeyA) st--; if(keys.ArrowRight||keys.KeyD) st++; }
  if(joy.id!=null){ thr=clamp(-joy.y*1.4,-1,1); st=clamp(joy.x*1.4,-1,1); }
  const want=thr>0?thr*125:thr*60;
  b.sp+=clamp(want-b.sp,-200*dt,(thr?150:80)*dt);
  b.hd-=st*(1.3+Math.min(1,Math.abs(b.sp)/90)*1.1)*dt; // bumper cars turn on the spot, faster when moving
  b.x+=(Math.sin(b.hd)*b.sp+DRIVE.kx)*dt; b.y+=(Math.cos(b.hd)*b.sp+DRIVE.ky)*dt;
  const f=Math.exp(-dt*4); DRIVE.kx*=f; DRIVE.ky*=f;
  const x0=BUMPER.x+BR+6, x1=BUMPER.x+BUMPER.w-BR-6, y0=BUMPER.y+BR+6, y1=BUMPER.y+BUMPER.h-BR-6;
  const wall=(fast: number)=>{ if(fast>35&&b.cd<=0){ b.cd=.4; b.hit=.8; sfx('bump'); shake=Math.max(shake,clamp(fast/160,.2,.6)); } };
  if(b.x<x0||b.x>x1){ b.x=clamp(b.x,x0,x1); wall(Math.abs(Math.sin(b.hd)*b.sp+DRIVE.kx)); DRIVE.kx*=-.5; b.sp*=-.3; }
  if(b.y<y0||b.y>y1){ b.y=clamp(b.y,y0,y1); wall(Math.abs(Math.cos(b.hd)*b.sp+DRIVE.ky)); DRIVE.ky*=-.5; b.sp*=-.3; }
}
/** Your car `p` and another car `o` touch; (nx, ny) points from you to them. Whoever was driving into the other gets the bump. */
function carHit(p: Bumper, o: Bumper, nx: number, ny: number): void {
  const mine=(Math.sin(p.hd)*p.sp+DRIVE.kx)*nx+(Math.cos(p.hd)*p.sp+DRIVE.ky)*ny, theirs=-(Math.sin(o.hd)*o.sp*nx+Math.cos(o.hd)*o.sp*ny);
  p.cd=o.cd=.5; p.hit=o.hit=1; sfx('bump'); if(Math.random()<.5) sfx('zap');
  if(mine>=30&&mine>=theirs*.7){ DRIVE.given++; o.sp*=-.3; o.hd+=rand(-1.4,1.4); o.x+=nx*14; o.y+=ny*14; toast(pick(['Bang! Got one!','Boom! +1','Direct hit!','Bzzt! Gotcha!'])); }
  if(theirs>=30) DRIVE.taken++;
  const k=30+Math.max(0,theirs)*1.3+Math.max(0,mine)*.3; DRIVE.kx-=nx*k; DRIVE.ky-=ny*k; p.sp*=.3;
  shake=Math.max(shake,clamp(Math.max(mine,theirs)/120,.25,.9));
}
function endDrive(): void {
  if(!DRIVE.on) return; DRIVE.on=false; bumpTarget(BUMPS[MY_CAR]);
  P.x=BUMPER.x+BUMPER.w/2; P.y=BUMPER.y+BUMPER.h+46; P.hd=0; P.vx=P.vy=P.kx=P.ky=0;
  const won=clamp(1+Math.floor(DRIVE.given/2),1,10); S.tix+=won; S.ticketsWon+=won; sfx('ding');
  toast(`<span class="z">Round over! · ကားတိုက်</span>You bumped ${DRIVE.given} car${DRIVE.given===1?'':'s'} and got bumped ${DRIVE.taken} time${DRIVE.taken===1?'':'s'}. <b>+${won} tickets</b>`,true);
}

// ---------- the mini train: it runs its loop all night, waits at the station, and hurries round when someone is waiting ----------
const TRN={d:TRAIN_STOP,v:0,dwell:6,left:false,waiting:false,aboard:false,chuff:0,clack:0,tootCd:0};
const TV=64, TV_FAST=190, TACC=16; // map units a second: 64 is 3.2 m/s, a gentle mini train
const TRAIN_CAPS: Array<[number, string]> = [
  [100,'Chuff chuff… out of the station we go. Drag to look around and press Q to wave.'],
  [700,'The pwe rides! On your left the boys swing on the spokes of the wooden wheel; on your right, the flying swing under its golden roof.'],
  [1450,'A thousand little oil lamps glow around the stupa on your left. On your right, the teashop TV and the clink of tea cups.'],
  [2080,'Round the bend and down the long side of the Wishing Lake. Look left: lanterns drifting slowly across the water.'],
  [3150,'Along the south edge now, behind the teashop tables and the banana fritter stalls. Smell that!'],
  [4500,'Past the Finale View deck on your right. Wave at the people waiting for the fireworks!'],
  [5250,'Up the west side, past the Kids Corner garden and the toy stall. Toot toot, nearly home!'],
];
const onTrain=()=>S.mode==='scene'&&SC.kind==='train';
function buyTrain(): void {
  if(TRN.waiting){ if(TRN.dwell>0) boardTrain(); else toast('The mini train is on its way. Wait here on the platform!'); return; }
  if(!pay(500)) return; TRN.waiting=true; updateHUD();
  if(TRN.dwell>0) boardTrain(); else { sfx('coin'); toast('Ticket bought! The Golden Express is hurrying round to pick you up. Wait on the platform.'); }
}
function boardTrain(): void {
  TRN.waiting=false; TRN.dwell=Math.max(TRN.dwell,3); TRN.aboard=false; S.rides++;
  P.dance=false; standUp(); startScene('train'); sfx('toot'); updateHUD();
}
function leaveTrain(): void { endScene(); }
function placeOffTrain(): void {
  if(TRN.dwell>0){ P.x=STATION.x; P.y=STATION.y-12; P.hd=0; return; }
  const [x,y,h]=trackPos(TRN.d-TRAIN_OFF[1]);
  for(const sd of [1,-1]){ const px=x-Math.sin(h)*40*sd, py=y+Math.cos(h)*40*sd; if(!blocked(px,py,8)){ P.x=px; P.y=py; return; } }
  P.x=STATION.x; P.y=STATION.y-12;
}
function updateTrain(dt: number): void {
  TRN.tootCd-=dt;
  const riding=onTrain();
  if(TRN.dwell>0){
    TRN.v=0; TRN.dwell-=dt;
    if(TRN.waiting&&S.mode==='walk'&&Math.hypot(P.x-STATION.x,P.y-STATION.y)<170) boardTrain();
    if(TRN.dwell<=0){ TRN.left=false; if(riding){ TRN.aboard=true; sfx('whistle'); } else if(Math.hypot(P.x-STATION.x,P.y-STATION.y)<600) sfx('whistle'); }
  } else {
    const ds=(TRAIN_STOP-TRN.d+TRACK_LEN)%TRACK_LEN, fast=TRN.waiting&&!riding;
    if(ds>150&&ds<TRACK_LEN-150) TRN.left=true;
    const vt=Math.min(fast?TV_FAST:TV,Math.sqrt(2*TACC*Math.max(0,ds-1))+4);
    TRN.v+=clamp(vt-TRN.v,-TACC*3*dt,TACC*dt*(fast?2.5:1));
    const step=TRN.v*dt;
    if(TRN.left&&ds<=step+.5){
      TRN.d=TRAIN_STOP; TRN.v=0; TRN.dwell=8; TRN.left=false;
      if(riding&&TRN.aboard){ TRN.aboard=false; SC.dur=SC.t+2.5; $('sceneCap').textContent='Toot toot! Back at the station. Thanks for riding the Golden Express.'; sfx('toot'); }
      else if(Math.hypot(P.x-STATION.x,P.y-STATION.y)<600) sfx('toot');
    } else TRN.d=(TRN.d+step)%TRACK_LEN;
    // the sounds of the ride: a chuff every few metres and the clack of the rail joints
    const near=riding||Math.hypot(P.x-trackPos(TRN.d)[0],P.y-trackPos(TRN.d)[1])<320;
    TRN.chuff-=step; if(TRN.chuff<=0){ TRN.chuff=24; if(near) sfx('chuff'); }
    TRN.clack-=step; if(TRN.clack<=0){ TRN.clack=110; if(riding) sfx('clack'); }
  }
  if(riding){ const [x,y]=trackPos(TRN.d-TRAIN_OFF[1]); P.x=x; P.y=y; return; }
  // the train pushes people off its track (and toots at you first)
  const shove=(x: number, y: number, me: boolean): [number, number] | null => {
    for(let k=0;k<TRAIN_OFF.length;k++){
      const [cx,cy,h]=trackPos(TRN.d-TRAIN_OFF[k]), fx=Math.cos(h), fy=Math.sin(h), dx=x-cx, dy=y-cy;
      const along=dx*fx+dy*fy, side=-dx*fy+dy*fx, half=k?24:30;
      if(Math.abs(along)<half+8&&Math.abs(side)<24){ const sg=side>=0?1:-1; return [cx+fx*along-fy*sg*25,cy+fy*along+fx*sg*25]; }
      if(me&&k===0&&TRN.v>20&&along>0&&along<170&&Math.abs(side)<26&&TRN.tootCd<=0){ TRN.tootCd=4; sfx('toot'); toast('Toot toot! Mind the train!'); }
    }
    return null;
  };
  if(S.mode==='walk'){ const np=shove(P.x,P.y,true); if(np&&!blocked(np[0],np[1],6)){ P.x=np[0]; P.y=np[1]; } }
  for(const n of NPC){ if(n.sit) continue; const np=shove(n.x,n.y,false); if(np){ n.x=np[0]; n.y=np[1]; } }
}

function startDodge(): void {
  if(DODGE.on||!pay(1000)) return;
  S.games++; DODGE.on=true; DODGE.t=30; DODGE.hits=0;
  P.x=BUMPER.x+60; P.y=BUMPER.y+BUMPER.h/2; P.vx=P.vy=P.kx=P.ky=0; P.hd=Math.PI/2; fadeFrom();
  toast('<span class="z">Dodge the cars! · ကားရှောင်</span>Stay inside the arena for 30 seconds. Fewer bumps, more tickets. Hold Shift to sprint.',true);
  sfx('zap'); updateHUD();
}
function endDodge(done: boolean): void {
  DODGE.on=false; $('prompt').hidden=true; DODGE.shown='';
  if(!done){ toast('You left the arena, so the round is over.'); return; }
  const won=DODGE.hits===0?8:DODGE.hits<=2?5:DODGE.hits<=5?3:1;
  S.tix+=won; S.ticketsWon+=won; sfx('ding');
  toast(`<span class="z">You survived!</span>${DODGE.hits===0?'Not a single bump.':DODGE.hits+' bump'+(DODGE.hits>1?'s':'')+'.'} <b>+${won} tickets</b>`,true); updateHUD();
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
    done.onclick=()=>{ confetti(done); sfx('ding'); save(); closeModal(); };
    opts.querySelectorAll<HTMLElement>('.avrow').forEach((r,i)=>r.style.setProperty('--i',String(i)));
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
interface Remote { peer: string; name: string; av: Avatar; look: Look; x: number; y: number; tx: number; ty: number; hd: number; moving: boolean; where: string; dance: boolean; balloon: string | null; wv: number; waveUntil: number; sayI: number; say: string; sayUntil: number }
const REMOTE = new Map<string, Remote>();
let room: { presence(value: Record<string, unknown>): Promise<unknown> } | null = null;
let lastSent='', presT=0, waveCount=0, roomReady=false, publicFair=false, netOk=true;
const mySay={i:0,t:'',until:0};
async function initRoom(): Promise<void> {
  try{
    const r=await window.claude?.use?.('room');
    if(!r){ // outside claude.ai (for example on Vercel): everyone shares a public PeerJS fair, with private rooms for friends
      // (the status callback can fire while friends() is still starting, so it must not touch `fr` before it exists)
      let fr: ReturnType<typeof friends> | null=null;
      fr=friends(peers=>syncPeers(peers as unknown as Claude.room.Peer[]),st=>{ if(fr){ publicFair=fr.isPublic; netOk=fr.connected; } $('pStat').title=st; updatePlayers(); });
      $('pStat').onclick=()=>fr.open(); $('pStat').style.cursor='pointer';
      room=fr; publicFair=true; setTimeout(()=>{ roomReady=true; },2500); $('bFriends').hidden=false; $('bFriends').onclick=()=>fr.open();
      updatePlayers(); return;
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
    if(!r){ r={peer:p.peer,name:'',av:DEFAULT_AVATAR,look:lookFor(avatarOpts(DEFAULT_AVATAR)),x,y,tx:x,ty:y,hd:0,moving:false,where:'walk',dance:false,balloon:null,wv:0,waveUntil:0,sayI:-1,say:'',sayUntil:0}; REMOTE.set(p.peer,r);
      if(roomReady){ const nm=cleanName(pr.n)||'A friend'; toast(`<b>${esc(nm)}</b> joined the fair.`); chatLine('',`${nm} joined the fair.`,true); } }
    r.tx=x; r.ty=y; r.name=cleanName(pr.n); r.av=cleanAvatar(pr.av); r.look=lookFor(avatarOpts(r.av));
    if(typeof pr.h==='number'&&isFinite(pr.h)) r.hd=pr.h;
    r.where=typeof pr.w==='string'?pr.w.slice(0,12):'walk'; r.dance=pr.dn===1;
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
  $('pStat').hidden=!room||(REMOTE.size===0&&!publicFair);
  $('players').textContent=netOk?String(REMOTE.size+1):'…';
  $('pStat').classList.toggle('off',!netOk);
  const t=$('titleOnline'); if(t){ t.hidden=!room||REMOTE.size===0; t.textContent=`${REMOTE.size} ${REMOTE.size===1?'person is':'people are'} at the fair right now`; }
}
function whereNow(): string { return S.mode==='walk'?'walk':S.mode==='scene'?SC.kind:S.mode==='mg'?MG.kind:'title'; }
function sendPresence(dt: number): void {
  if(!room||S.mode==='title') return;
  presT-=dt; if(presT>0) return; presT=.08;
  const msg: Record<string, unknown>={x:Math.round(P.x),y:Math.round(P.y),h:Math.round(P.hd*100)/100,w:whereNow(),n:S.settings.name,av:S.settings.av as unknown as Record<string,unknown>,b:S.balloon,wv:waveCount,dn:P.dance?1:0};
  if(mySay.i>0) msg.say={i:mySay.i,t:mySay.t};
  const k=JSON.stringify(msg); if(k===lastSent) return; lastSent=k;
  room.presence(msg).catch(()=>{ lastSent=''; });
}
function wave(): void { if(S.mode!=='walk'&&S.mode!=='scene') return; P.waveUntil=T+2.2; waveCount++; }

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
const NPC_LINES = CROWD_LINES;
const NPC_SAY: Array<{ n: Npc; t: [string, string]; until: number }> = [];
let npcSayT=3, murmurT=2, callT=4;
/** Says a line out loud from where that person stands: louder up close, muffled and panned with distance. */
function voiceFrom(n: { x: number; y: number }, clip: string, loud=1): void {
  if(!S.settings.sound) return;
  const d=Math.hypot(n.x-P.x,n.y-P.y), vol=loud*Math.pow(clamp(1-d/900,0,1),1.4);
  const q=project(n.x,n.y,1.6,VW,VH), pan=q.ok?clamp((q.sx/VW)*2-1,-1,1)*.7:clamp((n.x-P.x)/400,-1,1)*.5;
  speak(clip,vol,pan,clamp(d/700,0,1));
}
const voiceOf=(n: Npc)=>NPC.indexOf(n)%2?'f':'m';
function updateNpcSay(dt: number): void {
  npcSayT-=dt; for(let i=NPC_SAY.length-1;i>=0;i--) if(NPC_SAY[i].until<T) NPC_SAY.splice(i,1);
  if(npcSayT>0||S.mode!=='walk') return; npcSayT=rand(3,7);
  const near=NPC.filter(n=>!n.leader&&n.s>=1&&Math.hypot(n.x-P.x,n.y-P.y)<260&&!NPC_SAY.some(s=>s.n===n));
  if(!near.length||NPC_SAY.length>=2) return;
  const n=pick(near), i=Math.floor(Math.random()*NPC_LINES.length);
  NPC_SAY.push({n,t:NPC_LINES[i],until:T+4.5}); voiceFrom(n,`say${i}${voiceOf(n)}`,1);
}
/** Background talk: people further off saying things you half catch, and snack sellers calling out. */
function updateCrowdTalk(dt: number): void {
  if(S.mode!=='walk'&&!(S.mode==='scene'&&SC.kind==='wishes')) return;
  murmurT-=dt;
  if(murmurT<=0){
    const pool=NPC.filter(n=>(!n.post||n.sit)&&Math.hypot(n.x-P.x,n.y-P.y)<750);
    murmurT=rand(.7,2.2)*(pool.length>25?1:1.8);
    if(pool.length){ const n=pick(pool), i=Math.floor(Math.random()*NPC_LINES.length); voiceFrom(n,`say${i}${voiceOf(n)}`,.45); }
  }
  callT-=dt;
  if(callT<=0){
    callT=rand(5,10);
    const carts=CARTS.map((c,i)=>({i,n:NPC[i],d:Math.hypot(c[0]-P.x,c[1]-P.y)})).filter(c=>c.n&&c.d<520);
    if(carts.length){ const c=pick(carts), k=Math.random()<.25?VENDOR_CALLS.length-1:c.i;
      voiceFrom(c.n,`call${k}`,1.1);
      if(!NPC_SAY.some(q=>q.n===c.n)&&c.d<360) NPC_SAY.push({n:c.n,t:VENDOR_CALLS[k],until:T+3.5}); }
  }
}

// ---------- name tags and bubbles over the 3D view ----------
const tagPool: HTMLElement[] = []; let tagUsed=0;
function tagEl(cls: string, html: string): HTMLElement {
  let d=tagPool[tagUsed]; if(!d){ d=document.createElement('div'); $('tags').appendChild(d); tagPool.push(d); }
  tagUsed++; if(d.className!==cls) d.className=cls;
  const fresh=d.hidden||d.dataset.h!==html;
  if(d.dataset.h!==html){ d.innerHTML=html; d.dataset.h=html; } d.hidden=false;
  if(fresh&&!RM&&cls.startsWith('bub')) d.animate([{opacity:0,scale:'.4'},{opacity:1,scale:'1'}],{duration:260,easing:'cubic-bezier(.2,1.5,.4,1)'});
  return d;
}
function placeTag(x: number, y: number, h: number, cls: string, html: string, maxD = 55): void {
  const p=project(x,y,h,VW,VH); if(!p.ok||p.d>maxD) return;
  const s=clamp(14/p.d,.55,1.15), d=tagEl(cls,html);
  d.style.transform=`translate(${p.sx-d.offsetWidth/2}px,${p.sy-d.offsetHeight}px) scale(${s.toFixed(3)})`;
  d.style.opacity=String(clamp(1.3-p.d/maxD,0,1));
}
// ---------- Thadingyut wishes ----------
let wishStore: Awaited<ReturnType<typeof openWishes>> | null = null;
let WISHES: Wish[] = [];
const wishBorn = new Map<string, number>();
function refreshWishes(): void { setWishes(WISHES.map(w=>({id:w.id,k:w.k,born:wishBorn.get(w.id) ?? -1}))); }
async function initWishes(): Promise<void> {
  wishStore=await openWishes((all,fresh)=>{
    WISHES=all;
    for(const w of fresh) if(!wishBorn.has(w.id)){ wishBorn.set(w.id,T); if(!w.mine&&S.mode==='walk') chatLine('',`A new wish ${w.k==='sky'?'rises into the sky':'floats on the lake'}: “${w.t}”`,true); }
    refreshWishes();
  });
}
function openWish(kind: WishKind): void {
  if(S.mode!=='walk') return;
  let k=kind;
  const wrap=document.createElement('div'); wrap.className='wish';
  wrap.innerHTML=`<p class="muted">On Thadingyut night people send their wishes up on paper fire balloons and float candles on the water. Write yours in Myanmar or English. It will glow here for everyone, forever.</p>
  <div class="seg" role="radiogroup"><button data-k="sky" role="radio">🎈 Fire balloon <span class="mm">မီးပုံးပျံ</span><small>${ks(WISH_PRICE.sky)}</small></button><button data-k="water" role="radio">🪷 Water lantern <span class="mm">ရေမီးပုံး</span><small>${ks(WISH_PRICE.water)}</small></button></div>
  <textarea id="wishIn" class="mm" maxlength="${WISH_MAX_LEN}" rows="2" placeholder="ဆုတောင်းလေး ရေးပါ… / Write your wish…"></textarea>
  <div class="ideas">${WISH_IDEAS.map(t=>`<button class="mm" type="button">${esc(t)}</button>`).join('')}</div>
  <div class="row"><small class="muted" id="wishLeft"></small><button class="cta" id="wishGo"></button></div>
  <h3>Wishes glowing tonight <button type="button" id="wishSee">See them all</button></h3><div class="wlist"></div>`;
  const ta=wrap.querySelector<HTMLTextAreaElement>('#wishIn'), go=wrap.querySelector<HTMLButtonElement>('#wishGo');
  const sync=()=>{ wrap.querySelectorAll<HTMLButtonElement>('.seg button').forEach(b=>{ const on=b.dataset.k===k; b.classList.toggle('on',on); b.setAttribute('aria-checked',String(on)); });
    go.textContent=`${k==='sky'?'Send it up':'Float it'} · ${ks(WISH_PRICE[k])}`; go.disabled=!cleanWish(ta.value);
    wrap.querySelector('#wishLeft').textContent=`${WISH_MAX_LEN-ta.value.length} letters left · you have ${ks(S.kyat)}`; };
  wrap.querySelectorAll<HTMLButtonElement>('.seg button').forEach(b=>b.onclick=()=>{ k=b.dataset.k as WishKind; sync(); });
  wrap.querySelectorAll<HTMLButtonElement>('.ideas button').forEach(b=>b.onclick=()=>{ ta.value=b.textContent; sync(); ta.focus(); });
  ta.oninput=sync; ta.addEventListener('keydown',e=>e.stopPropagation());
  wrap.querySelector<HTMLButtonElement>('#wishSee').onclick=()=>{ closeModal(); startScene('wishes'); };
  const list=wrap.querySelector('.wlist');
  list.innerHTML=[...WISHES].reverse().slice(0,24).map(w=>`<div class="w ${w.k}"><span>${w.k==='sky'?'🎈':'🪷'}</span><div><span class="mm">${esc(w.t)}</span><small>${esc(w.n||'Someone')}${w.mine?' · you':''}</small></div></div>`).join('');
  go.onclick=async()=>{
    const t=cleanWish(ta.value); if(!t||!wishStore) return;
    if(!pay(WISH_PRICE[k])) return;
    go.disabled=true;
    const res=await wishStore.add({k,t,n:S.settings.name||'Visitor'});
    if(res==='full'||res==='failed'){ S.kyat+=WISH_PRICE[k]; updateHUD(); toast(res==='full'?'You have sent lots of wishes already. They will keep shining, so try again a little later.':'That wish could not be saved just now. Your kyat is back.'); go.disabled=false; return; }
    if(!wishBorn.has(res.id)) wishBorn.set(res.id,T);
    refreshWishes(); closeModal(); sfx('ding');
    toast(k==='sky'?`<span class="z">ဆုတောင်းပြည့်ပါစေ</span>Your fire balloon is rising over the fair.`:`<span class="z">ဆုတောင်းပြည့်ပါစေ</span>Your lantern is drifting slowly out across the Wishing Lake.`,true);
    if(!wishStore.shared) chatLine('','Your wish is saved in this browser. Open the game on claude.ai to share wishes with everyone.',true);
  };
  sync();
  openModal('Thadingyut wishes · ဆုတောင်း',wrap);
}
function wishTags(all=false): void {
  const near: Array<[number, Wish, [number, number, number]]>=[];
  for(const w of WISHES){ const p=wishSpot(w.id); if(!p) continue;
    const d=Math.hypot((p[0]-P.x)*.05,(p[1]-P.y)*.05,p[2]);
    const age=T-(wishBorn.get(w.id) ?? -99);
    if(age<14&&w.mine) near.push([-1,w,p]); else if(all||d<(w.k==='sky'?46:20)) near.push([all?(w.k==='sky'?0:100)+Math.hypot((p[0]-POND.x)*.05,(p[1]-POND.y)*.05):d,w,p]); }
  near.sort((a,b)=>a[0]-b[0]);
  const used: Array<[number, number]>=[]; let n=0;
  for(const [,w,p] of near){
    if(n>=(all?12:5)) break;
    const h=p[2]+(w.k==='sky'?2.7:0.9), q=project(p[0],p[1],h,VW,VH); if(!q.ok) continue;
    if(used.some(([x,y])=>Math.abs(x-q.sx)<170&&Math.abs(y-q.sy)<46)) continue; // keep labels from piling up
    used.push([q.sx,q.sy]); n++;
    placeTag(p[0],p[1],h,'bub wish '+w.k,`<span class="mm">${esc(w.t)}</span><small>${esc(w.n||'Someone')}</small>`,all?90:w.k==='sky'?70:30);
  }
}
function updateTags(): void {
  tagUsed=0;
  if(S.mode==='scene'&&SC.kind==='wishes'&&!S.photo) wishTags(true);
  else if(S.mode==='walk'||S.mode==='scene'&&!S.photo){
    const meVis=S.mode==='walk'&&!P.hidden;
    if(meVis&&mySay.until>T) placeTag(P.x,P.y,2.55,'bub',`<span class="mm">${esc(mySay.t)}</span>`);
    else if(meVis&&S.settings.name) placeTag(P.x,P.y,2.25,'tag me',esc(S.settings.name));
    for(const r of REMOTE.values()){
      if(r.where!=='walk') continue;
      if(r.sayUntil>T) placeTag(r.x,r.y,2.55,'bub',`<span class="mm">${esc(r.say)}</span><small>${esc(r.name||'Player')}</small>`,80);
      else placeTag(r.x,r.y,2.25,'tag',esc(r.name||'Player'),80);
    }
    wishTags();
    if(S.mode==='walk') for(const s of NPC_SAY) placeTag(s.n.x,s.n.y,2.3*s.n.s,'bub npc',`<span class="mm">${s.t[0]}</span><small>${s.t[1]}</small>`,35);
  }
  for(let i=tagUsed;i<tagPool.length;i++) if(!tagPool[i].hidden) tagPool[i].hidden=true;
}

// ---------- UI helpers ----------
function toast(msg: string, big?: boolean): void {
  const d=document.createElement('div'); d.className='toast'+(big?' big':''); d.innerHTML=msg; $('toasts').appendChild(d);
  while($('toasts').children.length>3) $('toasts').firstChild.remove();
  setTimeout(()=>{ d.classList.add('out'); setTimeout(()=>d.remove(),RM?0:320); },big?4200:3000);
}
/** Cuts to black and fades back in, for jumps the camera can't glide across (stepping up to a game booth). */
function fadeFrom(): void {
  if(RM) return; const f=$('fade'); f.style.transition='none'; f.style.opacity='1';
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ f.style.transition='opacity .5s ease-out'; f.style.opacity='0'; }));
}
function pop(e: HTMLElement, big=1.3): void { if(!RM) e.animate([{scale:String(big)},{scale:'1'}],{duration:380,easing:'cubic-bezier(.2,1.4,.4,1)'}); }
function floatText(from: HTMLElement, txt: string, cls: string): void {
  if(RM) return; const r=from.getBoundingClientRect(), d=document.createElement('div'); d.className='floatx '+cls; d.textContent=txt;
  d.style.left=r.left+r.width/2+'px'; d.style.top=r.top+r.height+'px'; document.body.appendChild(d);
  d.animate([{opacity:0,translate:'-50% 0'},{opacity:1,translate:'-50% 10px',offset:.2},{opacity:0,translate:'-50% 44px'}],{duration:1100,easing:'ease-out'}).onfinish=()=>d.remove();
}
// ---------- updates: tell players with the game open when a newer version has been deployed ----------
declare const __BUILD__: string;
let updSeen='';
async function checkUpdate(): Promise<void> {
  if(location.protocol!=='http:'&&location.protocol!=='https:') return; // a saved file or the claude.ai page: nothing to check
  try{
    const r=await fetch('version.json?t='+Date.now(),{cache:'no-store'}); if(!r.ok) return;
    const j=await r.json() as { v?: string; notes?: string };
    if(!j.v||j.v===__BUILD__||j.v===updSeen) return;
    updSeen=j.v; $('updNotes').textContent=j.notes?'New: '+j.notes:'Refresh to get the latest rides and fixes.';
    $('updBar').hidden=false; sfx('ding');
  }catch{ /* offline: try again later */ }
}
$('updGo').onclick=()=>location.reload();
$('updLater').onclick=()=>{ $('updBar').hidden=true; };
setInterval(checkUpdate,90_000); setTimeout(checkUpdate,8000);
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') checkUpdate(); });

// ---------- time of day: morning, afternoon, evening and night ----------
const TOD_NAMES: Array<[number, string, string]> = [[5,'Morning','မနက်ခင်း'],[11,'Afternoon','နေ့လည်'],[16.5,'Evening','ညနေခင်း'],[19,'Night','ညအချိန်']];
function todOf(m: number): [string, string] { const h=(m/60)%24; let r=TOD_NAMES[3]; for(const t of TOD_NAMES) if(h>=t[0]) r=t; return [r[1],r[2]]; }
/** How dark it is: 0 in the day, 1 from 7:30 PM until 5 AM. */
function nightAt(m: number): number { const h=(m/60)%24; return h>=12?clamp(h-18.5,0,1):clamp(6-h,0,1); }
/** Minutes past midnight in Yangon right now (UTC+6:30). */
function mmtNow(): number { const d=new Date(); return (d.getUTCHours()*60+d.getUTCMinutes()+d.getUTCSeconds()/60+390)%1440; }
function setClock(m: number, live=false): void {
  S.settings.realTime=live; saveSettings();
  if(S.showStarted&&!S.showDone&&m<21*60+30) onShowCancelled();
  S.clock=m;
  if(m<21*60+30){ S.showStarted=false; S.showDone=false; MINI.t=0; MINI.next=rand(6,14); }
  else if(!S.showStarted){ S.showStarted=true; S.showDone=true; } // tonight's finale is over; the deck still plays an encore
  const [en,my]=todOf(m);
  toast(`<span class="z">${en} · ${my}</span>${live?'Following Myanmar time, live. ':''}It is ${fmtClock(m)} at the fair.`,true);
  $('timeMenu').hidden=true; $('timeStat').setAttribute('aria-expanded','false'); updateHUD();
}
function onShowCancelled(): void { if(S.mode==='scene'&&SC.kind==='finale') endScene(); }
function tickClock(dt: number): void {
  const before=S.clock;
  S.clock=S.settings.realTime?mmtNow():S.clock+dt/2;
  if(S.clock>=1440) S.clock-=1440;
  if(S.clock<before-600){ S.showStarted=false; S.showDone=false; S.uncleAt-=1440; } // a new day: fireworks again tonight
}
$('timeStat').onclick=()=>{ const m=$('timeMenu'); m.hidden=!m.hidden; $('timeStat').setAttribute('aria-expanded',String(!m.hidden));
  $('mmtNow').textContent=fmtClock(mmtNow());
  m.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.classList.toggle('on',b.dataset.t==='mmt'?!!S.settings.realTime:!S.settings.realTime&&todOf(+b.dataset.t!)[0]===todOf(S.clock)[0]));
  if(!m.hidden) m.querySelector<HTMLButtonElement>('button')!.focus({preventScroll:true}); };
$('timeMenu').querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.onclick=()=>{ sfx('ding'); if(b.dataset.t==='mmt') setClock(mmtNow(),true); else setClock(+b.dataset.t!); });
document.addEventListener('pointerdown',e=>{ const m=$('timeMenu'); if(!m.hidden&&!m.contains(e.target as Node)&&!$('timeStat').contains(e.target as Node)){ m.hidden=true; $('timeStat').setAttribute('aria-expanded','false'); } });
const TOD_ICON: Record<string, string> = {Morning:'🌅',Afternoon:'☀️',Evening:'🌇',Night:'🌙'};
function showTime(): void { const [en]=todOf(S.clock); $('clock').textContent=fmtClock(S.clock); $('todLbl').textContent=S.settings.realTime?en+' · Yangon':en; const ic=TOD_ICON[en]; if($('todIcon').textContent!==ic) $('todIcon').textContent=ic; }
function fmtClock(m: number): string { m=Math.floor(m); let h=Math.floor(m/60)%24; const mm=m%60; const ap=h>=12?'PM':'AM'; h=h%12||12; return h+':'+String(mm).padStart(2,'0')+' '+ap; }
function journey(): Record<string, boolean> {
  return {arrive:true,discover:S.zones.length>=4,play:S.rides>0&&S.games>0,finale:S.finaleSeen};
}
let hudCache='', hudDone: Record<string, boolean> | null=null;
let hudK=-1, hudT=-1;
function updateHUD(): void {
  $('kyat').textContent=S.kyat.toLocaleString('en-US');
  $('tix').textContent=String(S.tix);
  if(hudK>=0&&S.kyat!==hudK){ pop($('kyat')); floatText($('kyat'),(S.kyat>hudK?'+':'−')+Math.abs(S.kyat-hudK).toLocaleString('en-US')+' Ks',S.kyat>hudK?'up':'down'); }
  if(hudT>=0&&S.tix>hudT){ pop($('tix'),1.5); floatText($('tix'),'+'+(S.tix-hudT)+' 🎟','up'); }
  hudK=S.kyat; hudT=S.tix;
  showTime();
  const j=journey(); let nowSet=false;
  document.querySelectorAll<HTMLElement>('#journey li').forEach(li=>{ const k=li.dataset.s!; li.classList.toggle('done',j[k]); const now=!j[k]&&!nowSet; li.classList.toggle('now',now); if(now) nowSet=true;
    if(hudDone&&j[k]&&!hudDone[k]){ li.classList.remove('lit'); void li.offsetWidth; li.classList.add('lit'); sfx('ding'); } });
  hudDone=j;
  let g: string;
  if(!j.discover) g=`Explore: find ${4-S.zones.length} more zone${4-S.zones.length===1?'':'s'} (${S.zones.length} of 4). Follow the signs off the main street.`;
  else if(!j.play) g=!S.rides&&!S.games?'Take a ride, then win tickets at ring toss or balloon darts.':!S.rides?'Game played! Now take a ride: the train, the bumper cars or the big wheel.':'Ride done! Now win some tickets at ring toss or balloon darts.';
  else if(!j.finale) g=S.showStarted&&!S.showDone?'The fireworks are on! Run to the Finale View deck.':nightAt(S.clock)<.5?'Wait for dark: the fireworks finale is at 9:30 PM at the Finale View deck.':'Fireworks finale at 9:30 PM. Grab a spot on the Finale View deck.';
  else g=`All done! ${S.zones.length}/${ZONES.length} postcards, ${S.secrets.length}/6 secrets and ${S.photos.length} photos so far.`;
  if(g!==hudCache){ $('goalT').textContent=g; hudCache=g; const el=$('goal'); el.classList.remove('new'); void el.offsetWidth; el.classList.add('new'); }
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

function buyPwe(f: typeof PWE_FOOD[number]): void {
  if(!pay(f.p)) return;
  if(!S.snacks.includes(f.id)){ S.snacks.push(f.id); toast(`<b>${f.name}</b> <span class="mm">${f.my}</span><br>${f.d}`); }
  else toast(`Another ${f.name.toLowerCase()}. Still delicious.`);
}
function toggleDance(): void {
  P.dance=!P.dance;
  if(P.dance){ P.hd=Math.PI; toast('<span class="z">ကခုန်ကြစို့</span>You join the dancers in front of the stage. Move to stop dancing.'); sfx('ding'); }
}
// ---------- the candle festival ----------
const CAND = {lamps:880, mine:0, flowers:FLOWER_N-40, t:0};
function lightLamp(): void {
  if(CAND.mine>=CANDLE_MINE){ toast('Every lamp on this side is already lit. What a sight!'); return; }
  if(!pay(200)) return;
  CAND.mine++; sfx('fizz'); setTimeout(()=>sfx('ding'),500);
  toast(`<span class="z">ဆုတောင်းပြည့်ပါစေ</span>You light a little oil lamp. It joins ${(CAND.lamps+CAND.mine-1).toLocaleString('en-US')} others glowing around the stupa.`,true);
}
function offerFlowers(): void {
  if(CAND.flowers>=FLOWER_N){ toast('The flower cups are all full. A thousand flowers!'); return; }
  if(!pay(300)) return;
  CAND.flowers=Math.min(FLOWER_N,CAND.flowers+5); sfx('ding');
  toast(`<span class="z">ပန်းကပ်လှူ</span>You lay jasmine, marigolds and roses in the cups. ${CAND.flowers.toLocaleString('en-US')} of ${FLOWER_N.toLocaleString('en-US')} flowers offered tonight.`,true);
}
function updateCandles(dt: number): void { // the kneeling visitors keep lighting lamps through the night
  CAND.t-=dt; if(CAND.t>0) return; CAND.t=rand(3,6);
  if(CAND.lamps<CANDLE_N-CANDLE_MINE) CAND.lamps++;
}
// ---------- the teashop ----------
function orderTea(): void {
  if(!pay(500)) return;
  if(!S.snacks.includes('tea')) S.snacks.push('tea');
  toast('<b>Laphet yay</b> <span class="mm">လက်ဖက်ရည်</span><br>Strong tea with condensed milk, poured from high up so it froths. Take a seat at a table and stay a while.');
}
function sitAt(i: number): void {
  if(P.sit){ standUp(); return; }
  const [x,y,hd]=teaStools(i)[teaFree(i)];
  P.standX=P.x; P.standY=P.y; P.x=x; P.y=y; P.hd=hd; P.sit=true; P.dance=false; P.vx=P.vy=0;
  toast('You pull up a tiny stool. Move to stand up again.');
  const near=NPC.filter(n=>n.sit&&Math.hypot(n.x-TEA_TABS[i][0],n.y-TEA_TABS[i][1])<25);
  if(near.length){ const n=pick(near); setTimeout(()=>{ if(!P.sit) return; NPC_SAY.push({n,t:REPLIES[0],until:T+4}); voiceFrom(n,`rep0${voiceOf(n)}`,1.3); },900); }
}
function standUp(): void { if(!P.sit) return; P.sit=false; P.x=P.standX; P.y=P.standY; }
// ---------- talking to people ----------
const TALK: Array<[string, string, number]> = [
  ['မင်္ဂလာပါ','Hello',0], ['နေကောင်းလား','How are you?',1], ['ဘာစားရင် ကောင်းမလဲ','What should I eat?',2],
  ['မီးပန်း ဘယ်မှာ ကြည့်ရမလဲ','Where can I watch the fireworks?',3], ['ဘာစီးရင် ပျော်မလဲ','What’s fun to ride?',4],
];
let talkTo: Npc | null = null;
const talkIT: Interactable = {x:0,y:0,r:40,label:()=>'Talk to this person · စကားပြောမယ်',act:()=>{ if(talkTo) openTalk(talkTo); }};
function nearNpc(): Npc | null {
  let best: Npc | null=null, bd=46;
  for(const n of NPC){ if(n.leader||n.s<1||(n.post&&!n.sit)) continue; const d=Math.hypot(n.x-P.x,n.y-P.y); if(d<bd){ bd=d; best=n; } }
  return best;
}
function openTalk(n: Npc): void {
  const held=n.wait; n.wait=999; n.moving=false; if(!n.sit) n.hd=Math.atan2(P.x-n.x,P.y-n.y); P.hd=Math.atan2(n.x-P.x,n.y-P.y);
  const wrap=document.createElement('div'); wrap.className='talk';
  wrap.innerHTML='<div class="tlog" aria-live="polite"></div><p class="muted">Say something:</p><div class="tq"></div>';
  const log=wrap.querySelector('.tlog') as HTMLElement, q=wrap.querySelector('.tq') as HTMLElement;
  const line=(t: [string, string], me: boolean)=>{ const d=document.createElement('div'); d.className='tl'+(me?' me':'');
    d.innerHTML=`<span class="mm">${esc(t[0])}</span><small>${esc(t[1])}</small>`; log.appendChild(d); log.scrollTop=log.scrollHeight;
    if(!RM) d.animate([{opacity:0,translate:me?'12px 0':'-12px 0'},{opacity:1,translate:'0 0'}],{duration:260,easing:'ease-out'}); };
  let busy=false;
  TALK.forEach(([my,en,ri])=>{ const b=document.createElement('button'); b.type='button'; b.innerHTML=`<span class="mm">${my}</span><small>${en}</small>`;
    b.onclick=()=>{ if(busy) return; busy=true; line([my,en],true); sfx('chat');
      setTimeout(()=>{ busy=false; line(REPLIES[ri],false); voiceFrom(n,`rep${ri}${voiceOf(n)}`,1.4); NPC_SAY.push({n,t:REPLIES[ri],until:T+4.5}); },700); };
    q.appendChild(b); });
  const wv=document.createElement('button'); wv.type='button'; wv.innerHTML='👋 <small>Wave</small>';
  wv.onclick=()=>{ wave(); line(['👋','(they wave back and smile)'],false); }; q.appendChild(wv);
  openModal(n.sit?'Chatting at the table · စကားပြော':'Chatting with a fairgoer · စကားပြော',wrap,()=>{ n.wait=n.post?held:rand(1,3); });
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
function exitPhotoMode(): void { S.photo=false; P.hidden=false; $('photoUI').hidden=true; document.body.classList.remove('photo'); syncChrome(); }
$('shutter').onclick=()=>{ renderNow(0); capturePhoto(capture()); toast('Photo saved to your bag.'); };
$('photoExit').onclick=exitPhotoMode;
$('photoHide').onclick=()=>{ if(S.mode!=='walk') return; P.hidden=!P.hidden; $('photoHide').textContent=P.hidden?'Show me':'Hide me'; };

// ---------- bag & settings ----------
let bagTab='postcards';
function openBag(): void {
  const wrap=document.createElement('div');
  const tabs=document.createElement('div'); tabs.className='tabs';
  [['postcards',`Postcards ${S.zones.length}/${ZONES.length}`],['souvenirs','Souvenirs'],['photos',`Photos ${S.photos.length}`],['secrets',`Secrets ${S.secrets.length}/6`]].forEach(([k,l])=>{
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
      S.snacks.forEach(id=>{ const s=SNACKS.find(x=>x.id===id)||PWE_FOOD.find(x=>x.id===id)||{name:'Laphet yay',my:'လက်ဖက်ရည်'}; list.push(`<div class="item"><div class="t"><b>${s.name} <span class="mm muted">${s.my}</span></b><small>Snack tasted</small></div></div>`); });
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
function setCam(c: 'close' | 'wide'): void { S.settings.cam=c; saveSettings(); CAM.zoom=c==='wide'?24:11; }
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
// Little shows over the lake every minute or so from 7 PM, then the big finale at 9:30. Each time you're asked if you want to watch.
let fwNext=0, fountT=0;
const MINI = {next:30, t:0, declined:0};
function launch(): void { launchFirework(); sfx('launch'); }
function onBoom(): void { setTimeout(()=>{ sfx('boom'); if(Math.random()<.5) sfx('crackle'); },250+Math.random()*350); }
const LAKE_Z = 340*M-1.5;
function showFountains(): void {
  const fin=S.showT<12;
  for(let k=0;k<11;k++) fountain(6+k*14, LAKE_Z, fin?4.5:6, pick(['#ffd27a','#ffffff','#ff8ad8','#7ad8ff']), .2, fin?1.6:1.1);
}
function updFireworks(dt: number): void {
  if(S.mode!=='title'&&!S.paused&&!S.showStarted&&S.clock>=19*60&&S.clock<21*60+25){
    MINI.next-=dt; if(MINI.next<=0&&MINI.t<=0){ MINI.t=15; MINI.next=rand(45,70); fwNext=0; onShow(false); }
  }
  if(MINI.t>0){ MINI.t-=dt; fwNext-=dt; if(fwNext<=0){ launch(); if(Math.random()<.25) launch(); fwNext=rand(.45,1.0); } if(MINI.t<=0) miniOver(); }
  if(S.showStarted&&!S.showDone){
    fwNext-=dt; const fin=S.showT<12;
    if(fwNext<=0){ launch(); if(fin){ launch(); if(Math.random()<.7) launch(); if(Math.random()<.35) launchFirework({type:pick(['double','kamuro','brocade','chrys']),up:rand(42,50)}); } fwNext=fin?rand(.12,.3):rand(.35,.85); }
    fountT-=dt; if(fountT<=0){ fountT=fin?4:14; showFountains(); }
  }
  if(S.mode==='scene'&&SC.kind==='finale'&&S.showDone&&SC.replay){ fwNext-=dt; if(fwNext<=0){ launch(); fwNext=rand(.35,.85); } }
}
function onShow(big: boolean): void {
  if(S.mode==='scene'&&SC.kind==='finale'){ setBar(big?'The fireworks finale has begun! Drag to look around the sky. Press P for a photo.':'A little fireworks show over the lake. Drag to look around. The big finale is at 9:30 PM.'); return; }
  if(S.mode!=='walk'||S.paused||(!big&&MINI.declined>=2)){ toast(big?'<span class="z">Fireworks!</span>The finale has begun. The Finale View deck has the best seat.':'🎆 Fireworks over the lake!',big); return; }
  askFireworks(big);
}
let askT: ReturnType<typeof setTimeout> | undefined;
function askFireworks(big: boolean): void {
  const d=$('fwAsk'); d.hidden=false; sfx('ding');
  $('fwAskQ').innerHTML=big?'<span class="mm">မီးပန်းပွဲကြီး စပြီ။ ကြည့်မလား</span><b>The big fireworks finale is starting! Do you want to watch?</b>'
    :'<span class="mm">မီးပန်း ပစ်နေပြီ။ ကြည့်မလား</span><b>Fireworks are going up over the lake. Do you want to watch?</b>';
  clearTimeout(askT); askT=setTimeout(()=>{ d.hidden=true; },15000);
  $('fwYes').focus({preventScroll:true});
}
function answerFireworks(yes: boolean): void {
  const d=$('fwAsk'); if(d.hidden) return; d.hidden=true; clearTimeout(askT);
  if(!yes){ if(!S.showStarted) MINI.declined++; toast('Okay! You can watch any time from the Finale View deck.'); return; }
  if(S.mode==='scene'&&SC.kind==='train') leaveTrain(); else if(S.mode==='scene'&&SC.kind==='bumper') endScene();
  if(S.mode!=='walk') return;
  P.dance=false; standUp(); closeModal(); closeMap();
  startScene('finale');
}
$('fwYes').onclick=()=>answerFireworks(true);
$('fwNo').onclick=()=>answerFireworks(false);
function miniOver(): void {
  if(S.mode==='scene'&&SC.kind==='finale'&&!S.showStarted) setBar('That was a little show. The big finale is at 9:30 PM.','Wait for the finale',waitForFinale);
}
function waitForFinale(): void { if(S.settings.realTime){ S.settings.realTime=false; saveSettings(); } if(S.clock>21*60+30){ S.showStarted=false; S.showDone=false; } S.clock=21*60+29.5; $('sceneAlt').hidden=true; $('sceneCap').textContent='Settling in. The first rocket is about to go up…'; }

// ---------- rides & the finale ----------
type SceneKind = 'ferris' | 'carousel' | 'pirate' | 'handwheel' | 'swinger' | 'train' | 'bumper' | 'finale' | 'wishes';
const RIDES: SceneKind[] = ['ferris','carousel','pirate','handwheel','swinger'];
const SC: { kind: SceneKind | null; t: number; dur: number; replay?: boolean; topSaid?: boolean; wh?: boolean; cue?: number } = {kind:null,t:0,dur:0};
const RIDECAP: Record<string, string> = {
  ferris:'Rising over the fair in your gondola. Look for the Shwedagon Pagoda glowing gold beyond the lake. Drag to look around, Q to wave.',
  carousel:'Round and round on a painted horse. Drag to look around and press Q to wave at the crowd!',
  pirate:'Hold on tight, it swings higher each time. Drag to look around.',
  handwheel:'You climb into a little wooden seat. The young men swing up onto the spokes to turn the wheel by hand… drag to look around.',
  train:'All aboard! You squeeze onto the front bench of the first carriage, right behind the engine. Drag to look around.',
  bumper:'You squeeze into a bumper car. W / S or the stick to go and reverse, A / D to steer. Bump as many cars as you can!',
  swinger:'Lifting off on the flying swing under its golden roof. Drag to look around and press Q to wave.',
};
function buyRide(kind: SceneKind, price: number): void { if(!pay(price)) return; S.rides++; startScene(kind); updateHUD(); }
function startScene(kind: SceneKind): void {
  closeChat();
  SC.kind=kind; SC.t=0; SC.dur={ferris:28,carousel:16,pirate:16,handwheel:22,swinger:24,train:9999,bumper:DRIVE_SECS,finale:9999,wishes:9999}[kind]; SC.replay=false; SC.topSaid=false; SC.cue=0; LOOK.yaw=LOOK.pitch=0;
  S.mode='scene'; $('prompt').hidden=true;
  if(kind==='finale'){
    if(S.showDone){ SC.replay=true; setBar('An encore just for you. Fireworks bloom over the city.'); }
    else if(S.showStarted) setBar('The fireworks finale has begun! Drag to look around the sky.');
    else if(MINI.t>0) setBar('A little fireworks show over the lake. Drag to look around. The big finale is at 9:30 PM.','Wait for the finale',waitForFinale);
    else if(nightAt(S.clock)<.5) setBar(`It is still light at ${fmtClock(S.clock)}. The fireworks go up after dark: little shows from 7 PM and the finale at 9:30 PM.`,'Skip to the finale',waitForFinale);
    else setBar(`The skyline at ${fmtClock(S.clock)}. Little shows go up every minute or so, and the finale is at 9:30 PM.`,'Wait for the finale',waitForFinale);
  } else if(kind==='wishes'){ CAM.yaw=0; setBar(`Every light is somebody's wish: ${WISHES.filter(w=>w.k==='sky').length} fire balloons and ${WISHES.filter(w=>w.k==='water').length} water lanterns. Drag to look around.`,'Make a wish',()=>{ endScene(); openWish('sky'); }); }
  else setBar(RIDECAP[kind]);
  syncChrome();
}
function setBar(cap: string, alt?: string, altFn?: () => void, exit?: string): void {
  $('sceneCap').textContent=cap; $('sceneAlt').hidden=!alt; if(alt){ $('sceneAlt').textContent=alt; $('sceneAlt').onclick=altFn; }
  $('sceneExit').textContent=exit||'Leave';
}
function endScene(): void {
  const k=SC.kind; S.mode='walk'; SC.kind=null; $('sceneBar').hidden=true;
  if(k==='train'){ placeOffTrain(); TRN.aboard=false; toast('You hop off the mini train.'); }
  if(k==='bumper') endDrive();
  if(k&&RIDES.includes(k)) toast(k==='handwheel'?'The boys hop down grinning and wait for a tip. What a ride!':'What a ride! Your ticket stub is a keepsake.');
  syncChrome(); updateHUD(); maybeSummary();
}
$('sceneExit').onclick=()=>{ if(S.mode==='scene') endScene(); else if(S.mode==='mg') endGame(); };
function updateScene(dt: number, atTop: boolean): void {
  SC.t+=dt;
  if(SC.kind==='ferris'&&atTop&&!SC.topSaid){ SC.topSaid=true; $('sceneCap').textContent='Top of the wheel! The whole of Yangon sparkles below you.'; sfx('ding'); }
  if(SC.kind==='pirate'){ const c=Math.abs(Math.cos(T*1.15)); if(c<.06&&!SC.wh){ sfx('whee'); SC.wh=true; } if(c>.3) SC.wh=false; }
  if(SC.kind==='wishes'&&drag.id==null) CAM.yaw+=dt*.06;
  if(SC.kind==='handwheel'){
    if(SC.cue===0&&SC.t>3){ SC.cue=1; sfx('whee'); $('sceneCap').textContent='Hup! The boys swing on the spokes with all their weight and the wheel spins faster and faster.'; }
    if(SC.cue===1&&SC.t>10){ SC.cue=2; sfx('whee'); $('sceneCap').textContent='Round and round, swooping over the crowd. Hold on to the bar!'; }
    if(SC.cue===2&&SC.t>17){ SC.cue=3; sfx('clank'); $('sceneCap').textContent='Slowing down… the boys drag their feet and hop off one by one.'; }
  }
  if(SC.kind==='swinger'&&SC.cue===0&&SC.t>5){ SC.cue=1; sfx('whee'); }
  if(SC.kind==='train'&&TRN.aboard&&TRN.v>0){ const rel=(TRN.d-TRAIN_STOP+TRACK_LEN)%TRACK_LEN, c=TRAIN_CAPS[SC.cue||0]; if(c&&rel>=c[0]){ SC.cue=(SC.cue||0)+1; $('sceneCap').textContent=c[1]; } }
  if(SC.kind==='bumper'){ const txt=`⏱ ${Math.max(0,Math.ceil(SC.dur-SC.t))} s · You bumped ${DRIVE.given} · Got bumped ${DRIVE.taken} · W/S go, A/D steer`; if(txt!==DRIVE.shown&&SC.t>4){ DRIVE.shown=txt; $('sceneCap').textContent=txt; } }
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
  S.mode='mg'; $('prompt').hidden=true; fadeFrom();
  setBar(kind==='ring'?'Stop the sweeping marker to aim, then stop the power bar. Gold bottle pays 8 tickets.':'Aim the wobbling crosshair and throw. Gold balloons pay 6 tickets.');
  syncChrome(); updateHUD();
}
function endGame(): void { fadeFrom(); S.mode='walk'; $('sceneBar').hidden=true; if(MG.won) toast(`You won <b>${MG.won} tickets</b>. Spend them at the prize counter.`); syncChrome(); updateHUD(); }
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
  if(bigMap){ if(e.code==='Escape'||e.code==='KeyM') closeMap(); return; }
  if(!$('fwAsk').hidden&&(e.code==='Enter'||e.code==='Space')&&(document.activeElement as HTMLElement)?.closest?.('#fwAsk')) return; // let the focused Yes/No button take it
  if(e.code==='Escape'){ if(chatOpen) closeChat(); else if(S.photo) exitPhotoMode(); else if(S.mode==='scene') endScene(); else if(S.mode==='mg') endGame(); return; }
  if((e.code==='KeyT'||e.code==='Enter')&&S.mode!=='mg'){ e.preventDefault(); openChat(); return; }
  if(e.code==='KeyE'||e.code==='Space'||e.code==='Enter'){ if(document.activeElement&&document.activeElement.tagName==='BUTTON'&&e.code!=='KeyE') return; press(); }
  if(e.code==='KeyP'){ S.photo?exitPhotoMode():enterPhotoMode(); }
  if(e.code==='KeyC') setCam(S.settings.cam==='close'?'wide':'close');
  if(e.code==='KeyB'&&S.mode==='walk') openBag();
  if(e.code==='KeyQ') wave();
  if(e.code==='KeyM'){ if(bigMap) closeMap(); else openMap(); }
  if(!$('fwAsk').hidden&&(e.code==='KeyY'||e.code==='KeyN')) answerFireworks(e.code==='KeyY');
});
window.addEventListener('keyup',e=>{ keys[e.code]=false; });
window.addEventListener('blur',()=>{ for(const k in keys) keys[k]=false; });
function press(): void {
  if(S.paused) return;
  if(S.mode==='walk'){ const it=nearIT(); if(it) it.act(); }
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
  if(pinch.size===2){ const [a,b]=[...pinch.values()]; const d=Math.hypot(a.x-b.x,a.y-b.y); if(pinchD) CAM.zoom=clamp(CAM.zoom*pinchD/d,5,40); pinchD=d; return; }
  if(e.pointerId!==drag.id) return;
  const dx=e.clientX-drag.x, dy=e.clientY-drag.y; drag.x=e.clientX; drag.y=e.clientY; drag.moved+=Math.abs(dx)+Math.abs(dy);
  if(povLook()){ // first person on a ride, or on the fireworks deck: turn your head
    const wide=S.mode==='scene'&&SC.kind==='finale'?1.7:2.4;
    LOOK.yaw=clamp(LOOK.yaw-dx*.005,-wide,wide); LOOK.pitch=clamp(LOOK.pitch+dy*.004,-1,.8); return;
  }
  CAM.yaw-=dx*.006; CAM.pitch=clamp(CAM.pitch+dy*.004,.08,1.25);
});
function povLook(): boolean { return S.mode==='scene'&&SC.kind!=='wishes'; }
const endDrag=(e: PointerEvent)=>{ pinch.delete(e.pointerId); pinchD=0; if(e.pointerId===drag.id){ drag.id=null; world.classList.remove('drag'); } };
world.addEventListener('pointerup',endDrag); world.addEventListener('pointercancel',endDrag);
world.addEventListener('wheel',e=>{ e.preventDefault(); CAM.zoom=clamp(CAM.zoom*Math.exp(e.deltaY*.0012),5,40); },{passive:false});
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
  $('touch').hidden=!playing||ph||!touchMode||!(S.mode==='walk'||S.mode==='scene'&&SC.kind==='bumper');
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
function nearIT(): Interactable | null {
  let best: Interactable | null=null, bd=1e9; for(const it of IT){ const d=Math.hypot(P.x-it.x,P.y-it.y); if(d<it.r&&d<bd){bd=d;best=it;} }
  if(best||P.sit||P.dance) return best;
  const n=nearNpc(); if(!n) return null;
  talkTo=n; talkIT.x=n.x; talkIT.y=n.y; return talkIT;
}
let lastIT: Interactable | null=null;
function checkWorld(): void {
  for(const z of ZONES){ if(!S.zones.includes(z.id)&&P.x>z.x&&P.x<z.x+z.w&&P.y>z.y&&P.y<z.y+z.h){ S.zones.push(z.id); sfx('ding');
    toast(`<span class="z">${String(z.n).padStart(2,'0')} · ${z.name}</span><span class="mm">${z.my}</span>Postcard collected (${S.zones.length}/${ZONES.length})`,true); updateHUD(); } }
  for(const s of SECRETS){ if(!S.secrets.includes(s.id)&&Math.hypot(P.x-s.x,P.y-s.y)<50){ S.secrets.push(s.id); S.kyat+=300; sfx('ding'); toast(`Secret found: <b>${s.name}</b><br>${s.d} <span class="muted">(+300 Ks)</span>`); updateHUD(); } }
  if(DODGE.on){ const t=`<span class="key">⏱</span>${Math.ceil(DODGE.t)} s left · ${DODGE.hits} bump${DODGE.hits===1?'':'s'} · keep running!`;
    if(t!==DODGE.shown){ $('prompt').innerHTML=t; $('prompt').hidden=false; DODGE.shown=t; } lastIT=null; return; }
  const it=(S.mode==='walk'&&!S.photo)?nearIT():null;
  if(it!==lastIT||it){ if(it){ $('prompt').innerHTML=`<span class="key">${touchMode?'GO':'E'}</span>${it.label()}`; $('prompt').hidden=false; } else $('prompt').hidden=true; lastIT=it; }
}
function maybeSummary(): void {
  if(!S.showDone||S.summaryShown||S.mode!=='walk') return;
  S.summaryShown=true; S.finaleSeen=true; updateHUD();
  openModal('What a night!',`<p>The last sparks drift over the skyline. Here is your Yay Kyaw night:</p>
  <div class="statgrid"><div><b>${S.zones.length}/${ZONES.length}</b>Postcards</div><div><b>${S.secrets.length}/6</b>Secrets</div><div><b>${S.snacks.length}/${SNACKS.length+PWE_FOOD.length+1}</b>Snacks tasted</div><div><b>${S.rides}</b>Rides</div><div><b>${S.ticketsWon}</b>Tickets won</div><div><b>${S.prizes.length+S.toys.length}</b>Souvenirs</div><div><b>${S.photos.length}</b>Photos</div></div>
  <p class="muted">The fair stays open. Keep exploring, find the rest of the secrets, or watch the finale again from the Finale View deck.</p>`);
}

// ---------- movement ----------
function movePlayer(dt: number): void {
  if(S.mode!=='walk'||S.paused) { P.moving=false; P.vx=P.vy=P.spd=0; }
  if(S.mode!=='walk'||S.paused) return;
  let ix=0, iy=0;
  if(!chatOpen){ if(keys.ArrowLeft||keys.KeyA) ix--; if(keys.ArrowRight||keys.KeyD) ix++; if(keys.ArrowUp||keys.KeyW) iy--; if(keys.ArrowDown||keys.KeyS) iy++; }
  if(joy.id!=null){ ix=joy.x; iy=joy.y; }
  const mag=Math.hypot(ix,iy);
  if(mag>.15){ if(P.sit) standUp(); if(P.dance){ P.dance=false; } }
  if(P.sit){ P.vx=P.vy=0; P.moving=false; P.spd=0; return; }
  let tvx=0, tvy=0;
  if(mag>.15){
    // camera-relative: up on the stick walks away from the camera
    const fx=-Math.sin(CAM.yaw), fz=-Math.cos(CAM.yaw), rx=Math.cos(CAM.yaw), rz=-Math.sin(CAM.yaw);
    const dx=rx*ix-fx*iy, dy=rz*ix-fz*iy;
    const sp=(keys.ShiftLeft||keys.ShiftRight||mag>.95&&joy.id!=null?210:135)*Math.min(1,mag)/mag;
    tvx=dx*sp; tvy=dy*sp;
  }
  // ease into and out of a walk rather than starting and stopping dead
  const k=1-Math.exp(-dt*(mag>.15?9:12));
  P.vx+=(tvx-P.vx)*k; P.vy+=(tvy-P.vy)*k;
  const v=Math.hypot(P.vx,P.vy); if(v<2){ P.vx=P.vy=0; }
  const nx=P.x+P.vx*dt, ny=P.y+P.vy*dt;
  if(!blocked(nx,P.y,6)) P.x=nx; else P.vx=0;
  if(!blocked(P.x,ny,6)) P.y=ny; else P.vy=0;
  // a bumper car's shove, fading out
  if(P.kx||P.ky){
    const kx=P.x+P.kx*dt, ky=P.y+P.ky*dt;
    if(!blocked(kx,P.y,6)) P.x=kx; else P.kx*=-.4;
    if(!blocked(P.x,ky,6)) P.y=ky; else P.ky*=-.4;
    const f=Math.exp(-dt*5); P.kx*=f; P.ky*=f; if(Math.hypot(P.kx,P.ky)<6) P.kx=P.ky=0;
  }
  P.spd=Math.hypot(P.vx,P.vy)/135; P.moving=P.spd>.08;
  if(P.moving) turnTo(P,P.vx,P.vy,dt*1.4);
}

// ---------- main loop ----------
let last=performance.now(), chatT=0, ready=false;
const crowdBuf: CrowdItem[] = [];
function frameData(dt: number): Frame {
  crowdBuf.length=0;
  for(const n of NPC) crowdBuf.push({x:n.x,y:n.y,hd:n.sit?n.hd+Math.sin((n.nod||0)*.5)*.35:n.hd,s:n.s,moving:n.moving,t:T+n.ph,sit:n.sit,shirt:n.shirt,lon:n.lon,skin:n.skin,hat:n.hat,bun:n.bun,balloon:n.balloon});
  const others=[...REMOTE.values()].map(r=>({id:r.peer,x:r.x,y:r.y,hd:r.hd,moving:r.moving,wave:T<r.waveUntil,dance:r.dance,look:r.look,balloon:r.balloon,visible:r.where==='walk'}));
  let ride: RideKind=null;
  if(S.mode==='scene') ride=SC.kind as RideKind;
  const title=S.mode==='title';
  const cam=title?{yaw:T*.05,pitch:.38,dist:46}:CAM;
  return {
    t:T, dt, night:title?1:nightAt(S.clock), clock:title?20*60:S.clock, quality:S.settings.gfx,
    me:{x:title?900:P.x,y:title?2000:P.y,hd:P.hd,moving:P.moving,spd:P.spd,wave:T<P.waveUntil,dance:P.dance,sit:P.sit,look:myLook(),balloon:S.balloon,hidden:P.hidden||title},
    crowd:crowdBuf, bikes:BIKES, others, ride, rideT:SC.t, train:TRN, cam,
    sparkle:SECRETS.map(s=>S.secrets.includes(s.id)?0:clamp(1-Math.hypot(P.x-s.x,P.y-s.y)/320,0,1)),
    steamFrom:CARTS, look:LOOK, bumpers:BUMPS, shake:RM?0:shake,
    candles:{lamps:CAND.lamps,mine:CAND.mine,flowers:CAND.flowers},
  };
}
function renderNow(dt: number): { atTop: boolean } { return render3d(frameData(dt)); }
function frame(now: number): void {
  const dt=Math.min(.05,(now-last)/1000); last=now; T+=dt;
  if(S.mode!=='title'&&!S.paused){
    tickClock(dt);
    if(!S.showStarted&&S.clock>=21*60+30&&S.clock<22*60){ S.showStarted=true; S.showT=75; fountT=0; MINI.t=0; onShow(true); updateHUD(); }
    if(S.showStarted&&!S.showDone){ S.showT-=dt; if(S.showT<=0){ S.showDone=true; if(S.mode==='scene'&&SC.kind==='finale'){ S.finaleSeen=true; setBar('That was beautiful. Stay for an encore, or head back to the fair.','Encore',()=>{ SC.replay=true; $('sceneAlt').hidden=true; },'Back to the fair'); } else maybeSummary(); updateHUD(); } }
  }
  updFireworks(dt);
  movePlayer(dt);
  CAM.dist+=(CAM.zoom-CAM.dist)*(1-Math.exp(-dt*8));
  updateTrain(dt);
  for(const n of NPC) updateNPC(n,dt);
  updateBikes(dt); updateBumpers(dt); updateCandles(dt);
  const glide=(room as { slow?: boolean } | null)?.slow?2.6:8; // relayed positions come about once a second: glide between them
  for(const r of REMOTE.values()){ const k=Math.min(1,dt*glide); r.moving=Math.hypot(r.tx-r.x,r.ty-r.y)>1.5; r.x=lerp(r.x,r.tx,k); r.y=lerp(r.y,r.ty,k); }
  updateNpcSay(dt); updateCrowdTalk(dt);
  if(S.mode==='mg') drawMG(dt);
  else if(ready){ const res=renderNow(dt); if(S.mode==='scene') updateScene(dt,res.atTop); }
  updateTags();
  if(S.mode==='walk'){ checkWorld(); if(S.settings.mini&&!S.photo) drawMini(); }
  sendPresence(dt);
  chatT-=dt; if(chatT<=0){ chatT=.5; let n=0; if(S.mode==='walk'){ for(const q of NPC) if(Math.abs(q.x-P.x)<280&&Math.abs(q.y-P.y)<280) n++; n+=REMOTE.size; } setChatter(S.mode==='walk'?.25+.75*Math.min(1,n/12):S.mode==='title'?0:.2); }
  if(A.c&&A.music){ let v: number; if(S.mode==='walk'||S.mode==='title'){ const d=Math.hypot(P.x-ST.x,P.y-ST.y); v=.03+.5*clamp(1-d/650,0,1)+(P.dance?.15:0); } else if(S.mode==='scene'&&SC.kind==='carousel') v=.45; else v=.06;
    A.music.gain.setTargetAtTime(v,A.c.currentTime,.3); if(A.amb) A.amb.gain.setTargetAtTime(S.mode==='walk'?.22:.1,A.c.currentTime,.4); }
  if((T*10|0)%3===0) showTime();
  requestAnimationFrame(frame);
}
// ---------- maps: a close-up mini map that follows you, and a full map of the fair (tap the mini map or press M) ----------
const MAP_MARKS: Array<{ x: number; y: number; icon: string; en: string; my: string; small?: boolean; tiny?: boolean }> = [
  {x:FW.cx,y:FW.cy+150,icon:'🎡',en:'Ferris wheel',my:'ချားရဟတ်'}, {x:CR.cx,y:CR.cy,icon:'🎠',en:'Carousel',my:'မြင်းစီးချားရဟတ်'},
  {x:PS.px,y:PS.py,icon:'⛵',en:'Pirate ship',my:'သင်္ဘောလွှဲ'}, {x:STATION.x,y:STATION.y,icon:'🚂',en:'Train station',my:'ရထားဘူတာ'},
  {x:ST.x,y:ST.y,icon:'🎤',en:'Stage',my:'ဇာတ်စင်'}, {x:FV.x,y:FV.y,icon:'🎆',en:'Finale View',my:'မီးပန်းကြည့်ရာ'},
  {x:PHOTO.x,y:PHOTO.y,icon:'📸',en:'Photo booth',my:'ဓာတ်ပုံ',small:true}, {x:TOYS_AT.x,y:TOYS_AT.y,icon:'🧸',en:'Toys',my:'အရုပ်',small:true},
  {x:WISH_STALL.x,y:WISH_STALL.y,icon:'🏮',en:'Wish stall',my:'ဆုတောင်း'}, {x:POND.x,y:POND.y,icon:'🪷',en:'Wishing Lake',my:'ဆုတောင်းကန်'},
  {x:UNCLE.x,y:UNCLE.y,icon:'👴',en:'Uncle',my:'ဦးလေး',small:true,tiny:true},
  {x:BUMPER.x+BUMPER.w/2,y:BUMPER.y+BUMPER.h/2,icon:'🚗',en:'Bumper cars',my:'ကားတိုက်'}, {x:HAND_WHEEL.x,y:HAND_WHEEL.y,icon:'🎡',en:'Hand-turned wheel',my:'လူအားချားရဟတ်'},
  {x:SWINGER.x,y:SWINGER.y,icon:'🎢',en:'Flying swing',my:'ဒန်းလွှဲ'},
  {x:CANDLE.x,y:CANDLE.y,icon:'🪔',en:'Oil lamps',my:'ဆီမီးထွန်းပွဲ'}, {x:TEA.x,y:TEA.y+60,icon:'☕',en:'Teashop',my:'လက်ဖက်ရည်ဆိုင်'},
  ...PWE_FOOD.map(f=>({x:f.x,y:f.y,icon:'🍌',en:f.name,my:f.my,small:true,tiny:true})),
  ...BOOTHS.map(b=>({x:b.x,y:b.y,icon:b.kind==='prize'?'🎁':'🎯',en:b.kind==='ring'?'Ring toss':b.kind==='darts'?'Darts':'Prizes',my:b.my,small:true})),
  ...CARTS.map(([x,y],i)=>({x,y,icon:'🍜',en:SNACKS[i].name,my:SNACKS[i].my,small:true,tiny:true})),
];
interface MapView { cx: number; cy: number; s: number; w: number; h: number; big: boolean }
function drawMap(g: CanvasRenderingContext2D, v: MapView): void {
  const { w, h, s, big } = v, X=(x: number)=>w/2+(x-v.cx)*s, Y=(y: number)=>h/2+(y-v.cy)*s, k=big?1:1.25;
  g.clearRect(0,0,w,h); g.fillStyle='#1b1533'; g.fillRect(0,0,w,h);
  // the lake and city to the north
  g.fillStyle='#0e1a44'; g.fillRect(0,0,w,Math.max(0,Y(NORTH)));
  g.fillStyle='rgba(244,182,63,.35)'; for(let x=-200;x<WW+200;x+=90) g.fillRect(X(x),Y(NORTH-140-(x*7%60)),8*s*5,(60+x*13%90)*s);
  g.fillStyle='#3a3060'; g.fillRect(X(40),Y(NORTH),(WW-80)*s,(WH-NORTH-14)*s);
  // zones
  for(const z of ZONES){ const has=S.zones.includes(z.id);
    g.fillStyle=z.g; rr(g,X(z.x),Y(z.y),z.w*s,z.h*s,10*k); g.fill();
    g.strokeStyle=has?'rgba(244,182,63,.85)':'rgba(255,255,255,.12)'; g.lineWidth=has?2*k:1; g.stroke(); }
  // main street
  g.fillStyle='#4a4166'; g.fillRect(X(ROAD.x),Y(NORTH),ROAD.w*s,(WH-NORTH)*s);
  g.strokeStyle='rgba(244,214,138,.55)'; g.setLineDash([10*k,10*k]); g.lineWidth=2*k; g.beginPath(); g.moveTo(X(ROAD.x+ROAD.w/2),Y(NORTH)); g.lineTo(X(ROAD.x+ROAD.w/2),Y(WH)); g.stroke(); g.setLineDash([]);
  // train track, pond, gate
  g.strokeStyle='#8a7a64'; g.lineWidth=3*k; g.beginPath(); for(let d=0;d<=TRACK_LEN;d+=20){ const [x,y]=trackPos(d); if(d) g.lineTo(X(x),Y(y)); else g.moveTo(X(x),Y(y)); } g.closePath(); g.stroke();
  { const [x,y]=trackPos(TRN.d); g.fillStyle='#e0b040'; g.beginPath(); g.arc(X(x),Y(y),3.5*k,0,TAU); g.fill(); }
  const pg=g.createRadialGradient(X(POND.x),Y(POND.y),0,X(POND.x),Y(POND.y),POND.rx*s);
  pg.addColorStop(0,'#3b6fd0'); pg.addColorStop(1,'#152a6a'); g.fillStyle=pg;
  g.beginPath(); g.ellipse(X(POND.x),Y(POND.y),POND.rx*s,POND.ry*s,0,0,TAU); g.fill(); g.strokeStyle='#b8a888'; g.lineWidth=2*k; g.stroke();
  g.fillStyle='#ffb347'; for(const w of WISHES) if(w.k==='water'){ const p=wishSpot(w.id); if(p){ g.beginPath(); g.arc(X(p[0]),Y(p[1]),1.6*k,0,TAU); g.fill(); } }
  g.fillStyle='#7a1f2b'; g.fillRect(X(900-150),Y(ARCH_Y)-4*k,300*s,8*k); g.fillStyle='#f4b63f'; g.fillRect(X(900-150),Y(ARCH_Y)-1*k,300*s,2*k);
  // landmarks
  g.textAlign='center'; g.textBaseline='middle';
  for(const m of MAP_MARKS){ if(!big&&m.small&&s<.2) continue;
    const x=X(m.x), y=Y(m.y), r=(m.small?9:13)*k; if(x<-30||y<-30||x>w+30||y>h+30) continue;
    g.fillStyle='rgba(13,10,36,.78)'; g.beginPath(); g.arc(x,y,r,0,TAU); g.fill(); g.strokeStyle='rgba(244,182,63,.7)'; g.lineWidth=1.2*k; g.stroke();
    g.font=`${(m.small?11:15)*k}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; g.fillText(m.icon,x,y+1);
    if((big||!m.small)&&!m.tiny){ g.font=`700 ${(big?(m.small?10:12):11)}px ${BODY}`; g.fillStyle='#fff3d6';
      g.strokeStyle='rgba(13,10,36,.85)'; g.lineWidth=3; g.strokeText(m.en,x,y+r+8); g.fillText(m.en,x,y+r+8);
      if(big){ g.font=`500 ${m.small?10:12}px ${MMF}`; g.fillStyle='#f4d58a'; g.strokeText(m.my,x,y+r+22); g.fillText(m.my,x,y+r+22); } } }
  if(big){ g.textAlign='left'; for(const z of ZONES){ g.font=`400 10px ${DISP}`; g.fillStyle=S.zones.includes(z.id)?'#f4b63f':'rgba(255,255,255,.4)'; g.fillText(`${z.n} ${z.name.toUpperCase()}`,X(z.x)+6,Y(z.y)+10); } g.textAlign='center'; }
  // other players
  for(const r of REMOTE.values()){ if(r.where!=='walk') continue; const x=X(r.x), y=Y(r.y);
    g.fillStyle='#3fc7a5'; g.beginPath(); g.arc(x,y,5*k,0,TAU); g.fill(); g.strokeStyle='#fff'; g.lineWidth=1.5; g.stroke();
    if(big||s>.2){ g.font=`700 11px ${BODY}`; g.fillStyle='#bff5e6'; g.fillText(r.name||'Player',x,y-11*k); } }
  // you: which way the camera looks, and an arrow for the way you face
  const px=X(P.x), py=Y(P.y), fx=-Math.sin(CAM.yaw), fz=-Math.cos(CAM.yaw), ca=Math.atan2(fz,fx);
  g.fillStyle='rgba(255,231,163,.22)'; g.beginPath(); g.moveTo(px,py); g.arc(px,py,34*k,ca-.5,ca+.5); g.closePath(); g.fill();
  const hx=Math.sin(P.hd), hy=Math.cos(P.hd), a=9*k;
  g.fillStyle='#ff5a4e'; g.strokeStyle='#fff'; g.lineWidth=2;
  g.beginPath(); g.moveTo(px+hx*a*1.3,py+hy*a*1.3); g.lineTo(px-hx*a*.8+hy*a*.8,py-hy*a*.8-hx*a*.8); g.lineTo(px-hx*a*.35,py-hy*a*.35); g.lineTo(px-hx*a*.8-hy*a*.8,py-hy*a*.8+hx*a*.8); g.closePath(); g.fill(); g.stroke();
  if(big){ g.font=`700 12px ${BODY}`; g.fillStyle='#ffe7a3'; g.strokeStyle='rgba(13,10,36,.9)'; g.lineWidth=3; g.strokeText('You are here',px,py-20); g.fillText('You are here',px,py-20); }
}
function drawMini(): void {
  const w=mini.width, h=mini.height;
  mx.save(); drawMap(mx,{cx:clamp(P.x,350,WW-350),cy:clamp(P.y,NORTH+250,WH-200),s:.27,w,h,big:false});
  mx.fillStyle='rgba(13,10,36,.75)'; mx.beginPath(); mx.arc(w-18,18,12,0,TAU); mx.fill(); mx.fillStyle='#f4b63f'; mx.font=`700 13px ${BODY}`; mx.textAlign='center'; mx.textBaseline='middle'; mx.fillText('N',w-18,19);
  mx.restore();
}
let bigMap=false;
function openMap(): void {
  if(S.mode!=='walk'||bigMap) return;
  bigMap=true; S.paused=true; $('bigmap').hidden=false; drawBigMap();
}
function closeMap(): void { if(!bigMap) return; bigMap=false; S.paused=false; $('bigmap').hidden=true; }
function drawBigMap(): void {
  const c=$<HTMLCanvasElement>('bigmapC'), box=c.parentElement.getBoundingClientRect(), dpr=Math.min(2,devicePixelRatio||1);
  const top=NORTH-180, H=WH-top, s=Math.min(box.width/WW,(box.height)/H);
  c.style.width=WW*s+'px'; c.style.height=H*s+'px'; c.width=Math.round(WW*s*dpr); c.height=Math.round(H*s*dpr);
  const g=c.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0);
  drawMap(g,{cx:WW/2,cy:top+H/2,s,w:WW*s,h:H*s,big:true});
}
$('mini').addEventListener('click',openMap);
$('bigmap').addEventListener('click',e=>{ if((e.target as HTMLElement).id!=='bigmapC') closeMap(); });
$('bigmapClose').addEventListener('click',closeMap);
window.addEventListener('resize',()=>{ if(bigMap) drawBigMap(); });

// ---------- title screen sky and a burst of confetti ----------
function decorateTitle(): void {
  if(RM) return;
  const sky=document.querySelector('#title .tsky') as HTMLElement; if(!sky) return;
  const cols=['#ff5a4e','#f4b63f','#ff8ad8','#ffb347','#ffd27a'];
  for(let k=0;k<16;k++){ const i=document.createElement('i'), sz=rand(16,34);
    i.style.cssText=`left:${rand(2,96)}%;--s:${sz}px;--c:${pick(cols)};--d:${rand(14,26)}s;--w:${-rand(0,24)}s;--x:${rand(-60,60)}px`; sky.appendChild(i); }
  for(let k=0;k<40;k++){ const b=document.createElement('b'); b.style.cssText=`left:${rand(0,100)}%;top:${rand(0,60)}%;--d:${rand(2,5)}s;--w:${-rand(0,5)}s`; sky.appendChild(b); }
  document.querySelectorAll<HTMLElement>('#title .in>*').forEach((e,i)=>e.style.setProperty('--i',String(i)));
}
function confetti(from?: HTMLElement): void {
  if(RM) return;
  const r=from?.getBoundingClientRect(), x0=r?r.left+r.width/2:VW/2, y0=r?r.top:VH/2;
  const cols=['#ff5a4e','#f4b63f','#ff8ad8','#3fc7a5','#fff3d6'];
  for(let k=0;k<46;k++){ const d=document.createElement('div'); d.className='confetti'; d.style.background=pick(cols); d.style.left=x0+'px'; d.style.top=y0+'px'; document.body.appendChild(d);
    const a=rand(-Math.PI*.95,-Math.PI*.05), v=rand(160,420), dx=Math.cos(a)*v, dy=Math.sin(a)*v;
    d.animate([{transform:'translate(0,0) rotate(0)',opacity:1},{transform:`translate(${dx*.6}px,${dy*.6}px) rotate(${rand(180,540)}deg)`,opacity:1,offset:.45},{transform:`translate(${dx}px,${dy+380}px) rotate(${rand(540,900)}deg)`,opacity:0}],{duration:rand(1300,2000),easing:'cubic-bezier(.2,.7,.4,1)'}).onfinish=()=>d.remove(); }
}

// ---------- boot ----------
function startGameFlow(): void {
  $('title').hidden=true; S.mode='walk'; audioInit(S.settings.sound); loadVoices(VOICE_CLIPS); setSound(S.settings.sound);
  P.x=900; P.y=2545; P.hd=Math.PI; CAM.yaw=0;
  syncChrome(); updateHUD();
  const welcome=()=>{ setTimeout(()=>toast(`<span class="z">Welcome${S.settings.name?', '+esc(S.settings.name):''}!</span>${ZONES.length} zones, six hidden secrets, little fireworks shows all evening and the finale at 9:30 PM. Press T to chat, and walk up to people to talk.`,true),300); };
  if(!S.settings.avDone) openAvatar(true,welcome); else welcome();
}
$('start').onclick=()=>{ goLandscape(); startGameFlow(); };
// phones: go full screen and turn sideways where the browser allows it (Android); elsewhere a hint asks you to turn the phone
function goLandscape(): void {
  if(!matchMedia('(pointer:coarse)').matches||Math.min(screen.width,screen.height)>600) return;
  const el=document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  try{ const p=el.requestFullscreen?.({navigationUI:'hide'}); if(p) p.then(()=>(screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape')).catch(()=>{}); }catch{ /* not allowed here */ }
}
try{ if(localStorage.getItem('ykn-portrait')==='1') document.body.classList.add('portraitOK'); }catch{ /* storage unavailable */ }
$('rotateOK').onclick=()=>{ document.body.classList.add('portraitOK'); try{ localStorage.setItem('ykn-portrait','1'); }catch{ /* storage unavailable */ } };

function snapshot(): unknown { return {S:JSON.parse(JSON.stringify({...S,paused:false,photo:false})),P:{x:P.x,y:P.y,hd:P.hd}}; }
async function boot(data: any): Promise<void> {
  if(data&&data.S){ Object.assign(S,data.S); S.paused=false; S.photo=false; if(data.P){P.x=data.P.x;P.y=data.P.y;P.hd=data.P.hd||0;}
    if(S.mode!=='title'){ $('title').hidden=true; S.mode='walk'; } }
  decorateTitle(); init3d(world,onBoom); resize(); window.addEventListener('resize',resize);
  setCam(S.settings.cam);
  spawnCrowd(); spawnBikes(); spawnBumpers(); setSound(S.settings.sound); syncChrome(); updateHUD(); initRoom(); initWishes();
  requestAnimationFrame(t=>{ last=t; frame(t); });
  await loadFonts();
  build3d(); ready=true;
}
try{ window.claude?.hot?.snapshot?.(snapshot); }catch{ /* no viewer */ }
const hot=window.claude&&window.claude.hot;
if(hot&&hot.ready) hot.ready(boot); else boot(hot&&hot.data||{});
// audio needs a gesture; also unlock on first tap after a reload
window.addEventListener('pointerdown',()=>{ if(S.mode!=='title'){ audioInit(S.settings.sound); loadVoices(VOICE_CLIPS); if(A.c&&A.c.state==='suspended') A.c.resume(); } });
window.__ykn={checkUpdate,S,P,CAM,startScene,startGame,TRN,buyTrain,startDrive,DRIVE,syncPeers,BIKES,say,BUMPS,DODGE,CAND,NPC,MINI,LOOK,askFireworks,openTalk,nearNpc,sitAt,toggleDance,lightLamp,offerFlowers};
