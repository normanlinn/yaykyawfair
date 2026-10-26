// Yay Kyaw Nights: a walkable night street fair inspired by Yangon's Yay Kyaw.
import { Ctx, TAU, rand, pick, clamp, lerp, srng, rr, el, circ, ln, ks, hexA, MMF, DISP, BODY, $ } from './util';
import { SHIRTS, LONS, SKINS, BALLOONS, AV_SHIRTS, AV_LONS, person, PersonOpts, Avatar, DEFAULT_AVATAR, avatarOpts, cleanAvatar, randomAvatar } from './people';
import { A, audioInit, sfx, bell, setChatter, setMaster } from './audio';

// ---------- canvas ----------
const cv = $<HTMLCanvasElement>('game'), ctx = cv.getContext('2d');
const lightC = document.createElement('canvas'), lx = lightC.getContext('2d');
const mini = $<HTMLCanvasElement>('mini'), mx = mini.getContext('2d');
let VW = 0, VH = 0, DPR = 1;
function resize(): void {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  VW = window.innerWidth; VH = window.innerHeight;
  cv.width = Math.round(VW*DPR); cv.height = Math.round(VH*DPR);
  lightC.width = Math.ceil(VW/2); lightC.height = Math.ceil(VH/2);
}
window.addEventListener('resize', resize); resize();

// ---------- world data ----------
const WW = 1800, WH = 2600, NORTH = 340;
const ROAD = {x:760, w:280};
const ZONES = [
  {id:'ferris',  n:1, name:'Ferris Wheel', my:'ချားရဟတ်', x:100, y:350, w:640, h:530, g:'#2b2238',
   card:'From the top car the whole fair becomes a field of lights, and the Shwedagon glows gold beyond the rooftops.'},
  {id:'carousel',n:2, name:'Carousel', my:'မြင်းစီးချားရဟတ်', x:1060,y:350, w:640, h:530, g:'#2d2133',
   card:'Painted horses rise and fall to the music. Grandparents wave every time the children come round.'},
  {id:'food',    n:3, name:'Food Street', my:'စားသောက်တန်း', x:100, y:900, w:640, h:520, g:'#30252c',
   card:'Steam from mohinga pots, the hiss of mont lin ma yar pans, and a sugarcane queue that never ends.'},
  {id:'pirate',  n:4, name:'Pirate Ship', my:'ပင်လယ်ဓားပြသင်္ဘော', x:1060,y:900, w:640, h:520, g:'#26243a',
   card:'The ship swings higher on every pass. The back row screams loudest, every single time.'},
  {id:'games',   n:5, name:'Game Booths', my:'ကစားပွဲဆိုင်များ', x:100, y:1440,w:640, h:520, g:'#2b2234',
   card:'Ring toss and balloon darts. Win tickets, then trade them for a prize to carry home.'},
  {id:'kids',    n:6, name:'Kids Corner', my:'ကလေးကစားကွင်း', x:1060,y:1440,w:640, h:520, g:'#22283a',
   card:'A little train toots around its track while toy sellers twirl tumbling dolls and paper fans.'},
  {id:'music',   n:7, name:'Music + Photo', my:'ဂီတနှင့် ဓာတ်ပုံ', x:100, y:1980,w:640, h:460, g:'#2e2131',
   card:'A saing waing ensemble shares the stage with a pop singer, and somebody always starts dancing.'},
  {id:'finale',  n:8, name:'Finale View', my:'မီးပန်းကြည့်ရှုရာ', x:1060,y:1980,w:640, h:460, g:'#1f2236',
   card:'The best seat in the fair for fireworks blooming over the city skyline.'},
];
const COL = []; // colliders
const addCol = (x,y,w,h)=>COL.push({x,y,w,h});
function blocked(x: number, y: number, r: number): boolean {
  if(x<40+r||x>WW-40-r||y<NORTH+8+r||y>WH-14-r) return true;
  for(const b of COL){ if(x+r>b.x&&x-r<b.x+b.w&&y+r>b.y&&y-r<b.y+b.h) return true; }
  return false;
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

const P = {x:900,y:2540,face:1,step:0,moving:false,hidden:false,waveUntil:0};
const AV = (): PersonOpts => avatarOpts(S.settings.av);
const NAME_MAX = 16;
let T = 0, camX = 900, camY = 2300, zoom = 1, flashV = 0;

// ---------- structures ----------
interface Drawable { y: number; x0: number; x1: number; draw: (c: Ctx) => void }
interface Light { x: number; y: number; r: number; c?: string }
interface Particle { k: 'steam' | 'note' | 'heart'; x: number; y: number; vx: number; vy: number; life: number; max: number; ch?: string }
interface Interactable { x: number; y: number; r: number; label: () => string; act: () => void }
interface Vendor { x: number; y: number; shirt: string; lon: string; skin: string; hat?: boolean; bun?: boolean }
const DRAW: Drawable[] = [];
const LIGHTS: Light[] = [];
const PART: Particle[] = [];
const IT: Interactable[] = [];
const VENDORS: Vendor[] = [];
function addDraw(y: number, x0: number, x1: number, f: (c: Ctx) => void): void {DRAW.push({y,x0,x1,draw:f});}
function addLight(x: number, y: number, r: number, c?: string): void {LIGHTS.push({x,y,r,c});}

// signs
function sign(c: Ctx, x: number, y: number, my: string, en: string, col?: string): void {
  c.fillStyle='#4a3a2a'; c.fillRect(x-2,y-46,4,46);
  c.font='700 13px '+MMF; const w1=c.measureText(my).width;
  c.font='600 10px '+BODY; const w2=c.measureText(en.toUpperCase()).width;
  const w=Math.max(w1,w2)+18;
  c.fillStyle=col||'#7a1f2b'; rr(c,x-w/2,y-80,w,38,6); c.fill();
  c.strokeStyle='#f4b63f'; c.lineWidth=1.5; c.stroke();
  c.fillStyle='#fff3d6'; c.textAlign='center'; c.textBaseline='middle';
  c.font='700 13px '+MMF; c.fillText(my,x,y-67);
  c.font='600 10px '+BODY; c.fillStyle='#f4d58a'; c.fillText(en.toUpperCase(),x,y-51);
}
ZONES.forEach(z=>{
  const sx = z.x<ROAD.x ? 712 : 1088, sy = z.y+80;
  addDraw(sy,sx-60,sx+60,c=>sign(c,sx,sy,z.my,z.n+' · '+z.name));
  addLight(sx,sy-60,70,'#f4b63f');
});

// trees around the edges (rain trees / tamarind)
(function(){
  const r=srng(3); const spots=[];
  for(let y=420;y<WH-60;y+=150){ spots.push([62+r()*16,y+r()*40]); spots.push([WW-62-r()*16,y+r()*40]); }
  spots.forEach(([x,y],i)=>{
    addCol(x-8,y-6,16,10);
    const hue=['#173a2b','#1c4231','#14332a'][i%3];
    addDraw(y,x-50,x+50,c=>{
      c.fillStyle='#3b2a20'; c.fillRect(x-4,y-40,8,40);
      c.fillStyle=hue; circ(c,x,y-62,30); circ(c,x-20,y-48,20); circ(c,x+20,y-50,22);
      c.fillStyle='rgba(255,255,255,.05)'; circ(c,x-8,y-72,14);
      for(let k=0;k<6;k++){ const a=k/6*TAU+T*.4; c.fillStyle=k%2?'#ffd27a':'#ff9bb3'; circ(c,x+Math.cos(a)*24,y-58+Math.sin(a)*14,1.8); }
    });
    addLight(x,y-55,60,'#ffd27a');
  });
})();

// Ferris wheel
const FW={cx:420,cy:560,R:170};
addCol(FW.cx-145,FW.cy+190,290,50);
addDraw(FW.cy+240,FW.cx-200,FW.cx+200,c=>{
  const {cx,cy,R}=FW, rot=T*.22;
  c.fillStyle='#3d3350'; c.fillRect(cx-145,cy+195,290,40);
  c.fillStyle='#2a2238'; c.fillRect(cx-145,cy+225,290,10);
  c.strokeStyle='#7d82a3'; c.lineWidth=9; c.lineCap='round';
  ln(c,cx,cy,cx-105,cy+205); ln(c,cx,cy,cx+105,cy+205);
  c.lineWidth=4; ln(c,cx-55,cy+110,cx+55,cy+110);
  c.strokeStyle='#9aa0bc'; c.lineWidth=1.5;
  for(let i=0;i<16;i++){ const a=rot+i/16*TAU; ln(c,cx,cy,cx+Math.cos(a)*R,cy+Math.sin(a)*R); }
  c.strokeStyle='#d5d9ee'; c.lineWidth=4; c.beginPath(); c.arc(cx,cy,R,0,TAU); c.stroke();
  c.lineWidth=2; c.beginPath(); c.arc(cx,cy,R-14,0,TAU); c.stroke();
  const cols=['#ff5a4e','#f4b63f','#3fc7a5','#ff8ad8','#8fb4ff'];
  for(let i=0;i<40;i++){ const a=rot+i/40*TAU; c.fillStyle=cols[(i+Math.floor(T*5))%5]; circ(c,cx+Math.cos(a)*R,cy+Math.sin(a)*R,3); }
  for(let i=0;i<12;i++){
    const a=rot+i/12*TAU, px=cx+Math.cos(a)*R, py=cy+Math.sin(a)*R;
    c.strokeStyle='#cfd3e8'; c.lineWidth=1.5; ln(c,px,py,px,py+8);
    c.fillStyle=['#c23b4b','#2d7bb6','#e0a526','#3a9b7a'][i%4]; rr(c,px-11,py+7,22,17,4); c.fill();
    c.fillStyle='#fff3c4'; c.fillRect(px-8,py+10,16,6);
    c.fillStyle=SKINS[i%6]; if(i%3!==2){ circ(c,px-3,py+12,2.6); circ(c,px+4,py+12,2.6); }
  }
  c.fillStyle='#f4b63f'; circ(c,cx,cy,11); c.fillStyle='#8a5a12'; circ(c,cx,cy,4);
});
addLight(FW.cx,FW.cy,260,'#ff8ad8'); addLight(FW.cx,FW.cy+215,120,'#f4b63f');

// Ferris ticket kiosk
addCol(560,795,60,30);
addDraw(825,540,640,c=>{ booth(c,590,825,60,'#2d7bb6','ချားရဟတ်','1,500 Ks'); });
function booth(c: Ctx, x: number, y: number, w: number, col: string, _my: string, price: string): void {
  c.fillStyle='#e9dcc4'; c.fillRect(x-w/2,y-38,w,38);
  c.fillStyle='#2a2238'; c.fillRect(x-w/2+6,y-32,w-12,14);
  c.fillStyle=col; c.beginPath(); c.moveTo(x-w/2-6,y-38); c.lineTo(x,y-58); c.lineTo(x+w/2+6,y-38); c.fill();
  c.fillStyle='#f4b63f'; c.font='700 10px '+BODY; c.textAlign='center'; c.textBaseline='middle'; c.fillText(price,x,y-8);
}
addLight(590,800,80,'#fff1c9');

// Carousel
const CR={cx:1380,cy:640};
addCol(CR.cx-150,CR.cy-30,300,85);
function carouselDraw(c,cx,cy,sc,rot,riderIdx,t){
  const RX=135*sc, RY=38*sc, top=cy-120*sc;
  const horses=[];
  for(let i=0;i<8;i++){ const a=rot+i/8*TAU; horses.push({i,a,x:cx+Math.cos(a)*RX,y:cy-8*sc+Math.sin(a)*RY,front:Math.sin(a)}); }
  // platform
  c.fillStyle='#4a2f5a'; el(c,cx,cy+6*sc,150*sc,46*sc);
  c.fillStyle='#6b4380'; el(c,cx,cy,150*sc,44*sc);
  c.fillStyle='#f4b63f'; for(let i=0;i<24;i++){ const a=i/24*TAU+rot; if(Math.sin(a)>0){ circ(c,cx+Math.cos(a)*148*sc,cy+Math.sin(a)*43*sc+3*sc,2.2*sc);} }
  const drawHorse=h=>{
    const bob=Math.sin(t*3+h.i*1.3)*6*sc, d=.8+.2*(h.front+1)/2;
    c.strokeStyle='#e8d29a'; c.lineWidth=2*sc; ln(c,h.x,top+30*sc,h.x,h.y);
    const col=['#f7efe0','#f4b63f','#ffb3c7','#9fd3f0'][h.i%4];
    c.fillStyle=col; el(c,h.x,h.y-18*sc+bob,13*d*sc,6*d*sc);
    const dir=Math.cos(h.a)>0?-1:1;
    c.fillRect(h.x+dir*9*d*sc-3*sc,h.y-30*sc+bob,6*sc,12*sc);
    c.fillRect(h.x-9*d*sc,h.y-14*sc+bob,2*sc,8*sc); c.fillRect(h.x+7*d*sc,h.y-14*sc+bob,2*sc,8*sc);
    c.fillStyle='#c23b4b'; c.fillRect(h.x-4*sc,h.y-24*sc+bob,8*sc,4*sc);
    if(h.i===riderIdx){ person(c,h.x,h.y-18*sc+bob,{...AV(),s:sc*.8,hl:true,t}); }
    else if(h.i%2===0){ person(c,h.x,h.y-18*sc+bob,{s:sc*.62,shirt:SHIRTS[h.i],lon:LONS[h.i],skin:SKINS[h.i%6],bun:h.i%4===0}); }
  };
  horses.filter(h=>h.front<=0).sort((a,b)=>a.front-b.front).forEach(drawHorse);
  c.fillStyle='#d9c48a'; c.fillRect(cx-9*sc,top,18*sc,cy-top);
  c.fillStyle='#c23b4b'; c.fillRect(cx-9*sc,top+20*sc,18*sc,6*sc); c.fillRect(cx-9*sc,top+50*sc,18*sc,6*sc);
  horses.filter(h=>h.front>0).sort((a,b)=>a.front-b.front).forEach(drawHorse);
  // canopy
  c.fillStyle='#8f2234'; el(c,cx,top,160*sc,36*sc);
  for(let i=0;i<12;i++){ const a0=i/12*Math.PI*2;
    c.fillStyle=i%2?'#fff3d6':'#c23b4b';
    c.beginPath(); c.moveTo(cx,top-58*sc); c.lineTo(cx+Math.cos(a0)*160*sc,top+Math.sin(a0)*36*sc); c.lineTo(cx+Math.cos(a0+TAU/12)*160*sc,top+Math.sin(a0+TAU/12)*36*sc); c.closePath(); c.fill(); }
  for(let i=0;i<14;i++){ const x=cx-150*sc+i*300*sc/13; const yy=top+Math.sqrt(Math.max(0,1-((x-cx)/(160*sc))**2))*36*sc;
    c.fillStyle=i%2?'#f4b63f':'#fff3d6'; circ(c,x,yy+4*sc,7*sc);
    c.fillStyle=(i+Math.floor(t*4))%3?'#ffe7a3':'#ff5a4e'; circ(c,x,yy+4*sc,2.2*sc); }
  c.fillStyle='#f4b63f'; c.fillRect(cx-1.5*sc,top-80*sc,3*sc,24*sc);
  c.fillStyle='#ff5a4e'; c.beginPath(); c.moveTo(cx+1.5*sc,top-80*sc); c.lineTo(cx+18*sc,top-74*sc+Math.sin(t*4)*2*sc); c.lineTo(cx+1.5*sc,top-68*sc); c.fill();
}
addDraw(CR.cy+50,CR.cx-170,CR.cx+170,c=>carouselDraw(c,CR.cx,CR.cy,1,T*.6,-1,T));
addLight(CR.cx,CR.cy-40,240,'#ffd27a');

// Pirate ship
const PS={px:1380,py:1010,L:160};
addCol(PS.px-150,PS.py+195,300,70);
function shipDraw(c,px,py,L,th,sc,playerSeat,t){
  c.strokeStyle='#596080'; c.lineWidth=8*sc; c.lineCap='round';
  ln(c,px,py,px-130*sc,py+L+95*sc); ln(c,px,py,px+130*sc,py+L+95*sc);
  c.save(); c.translate(px,py); c.rotate(th);
  c.strokeStyle='#a9aec8'; c.lineWidth=4*sc; ln(c,0,0,-48*sc,L); ln(c,0,0,48*sc,L);
  // mast & sail
  c.strokeStyle='#5a3a24'; c.lineWidth=3*sc; ln(c,0,L-4*sc,0,L-58*sc);
  c.fillStyle='#e9dcc4'; c.beginPath(); c.moveTo(2*sc,L-56*sc); c.quadraticCurveTo(26*sc,L-36*sc,2*sc,L-16*sc); c.fill();
  c.fillStyle='#c23b4b'; c.fillRect(-1*sc,L-66*sc,14*sc,8*sc);
  // riders
  const arms=Math.abs(th)>.5;
  for(let i=0;i<9;i++){ const x=(-88+i*22)*sc;
    const isP=i===playerSeat;
    person(c,x,L+4*sc,isP?{...AV(),s:sc*.95,armsUp:arms,t:t+i,hl:true}:{s:sc*.8,shirt:SHIRTS[i%10],lon:LONS[i%9],skin:SKINS[i%6],armsUp:arms,t:t+i,bun:i%3===1}); }
  // hull
  c.fillStyle='#7a3f2a'; c.beginPath(); c.moveTo(-118*sc,L-12*sc); c.lineTo(118*sc,L-12*sc); c.lineTo(100*sc,L+22*sc); c.quadraticCurveTo(0,L+40*sc,-100*sc,L+22*sc); c.closePath(); c.fill();
  c.fillStyle='#f4b63f'; c.fillRect(-112*sc,L-6*sc,224*sc,4*sc);
  c.fillStyle='#5a2c1d'; for(let i=0;i<7;i++) circ(c,(-72+i*24)*sc,L+10*sc,3.5*sc);
  c.fillStyle='#f4b63f'; c.beginPath(); c.moveTo(118*sc,L-12*sc); c.lineTo(134*sc,L-28*sc); c.lineTo(122*sc,L-2*sc); c.fill();
  c.restore();
}
addDraw(PS.py+265,PS.px-260,PS.px+260,c=>{
  c.fillStyle='#3a3350'; c.fillRect(PS.px-150,PS.py+200,300,60);
  c.fillStyle='#2a2238'; c.fillRect(PS.px-150,PS.py+250,300,12);
  shipDraw(c,PS.px,PS.py,PS.L,Math.sin(T*1.15)*.95,1,-1,T);
});
addLight(PS.px,PS.py+150,230,'#8fb4ff');

// Food carts
const SNACKS=[
  {id:'mohinga',name:'Mohinga',my:'မုန့်ဟင်းခါး',p:1000,col:'#c2543a',d:'Fish noodle soup with crispy fritters, Yangon’s breakfast that tastes even better at night.'},
  {id:'mlmy',name:'Mont lin ma yar',my:'မုန့်လင်မယား',p:500,col:'#d9932b',d:'The “husband and wife” snack: two crispy halves pressed together.'},
  {id:'shweyinaye',name:'Shwe yin aye',my:'ရွှေရင်အေး',p:1200,col:'#3f9f8a',d:'Coconut milk, sago and jelly over shaved ice.'},
  {id:'laphet',name:'Laphet thoke',my:'လက်ဖက်သုပ်',p:1000,col:'#5f7b2d',d:'Pickled tea leaf salad with crunchy fried beans.'},
  {id:'kyan',name:'Sugarcane juice',my:'ကြံရည်',p:600,col:'#8aa63a',d:'Pressed fresh through the roller while you wait.'},
  {id:'bbq',name:'Barbecue skewers',my:'အကင်',p:800,col:'#a03a2a',d:'Grilled sticks in the style of 19th Street in Chinatown.'},
];
const CARTS=[[250,1030],[430,1030],[610,1030],[250,1290],[430,1290],[610,1290]];
const STALLFRONTS=[];
CARTS.forEach(([x,y],i)=>{
  const sn=SNACKS[i];
  addCol(x-62,y-34,124,36);
  const v={x,y:y-26,shirt:pick(SHIRTS),lon:pick(LONS),skin:pick(SKINS),hat:i%2===0,bun:i%2===1};
  VENDORS.push(v);
  addDraw(y,x-75,x+75,c=>{
    c.fillStyle='#1b1420'; circ(c,x-44,y+2,8); circ(c,x+44,y+2,8);
    c.fillStyle='#e9dcc4'; c.fillRect(x-62,y-34,124,32);
    c.fillStyle=sn.col; c.fillRect(x-62,y-12,124,10);
    c.fillStyle='rgba(180,230,255,.25)'; c.fillRect(x-54,y-30,108,14);
    c.fillStyle='#fff3d6'; for(let k=0;k<4;k++) circ(c,x-36+k*24,y-23,4);
    c.strokeStyle='#8a7d6a'; c.lineWidth=2; ln(c,x-58,y-34,x-58,y-72); ln(c,x+58,y-34,x+58,y-72);
    for(let k=0;k<8;k++){ c.fillStyle=k%2?'#fff3d6':sn.col; c.fillRect(x-66+k*16.5,y-84,16.5,14); }
    c.fillStyle=sn.col; for(let k=0;k<8;k++){ c.beginPath(); c.arc(x-57.75+k*16.5,y-70,8.25,0,Math.PI); c.fill(); }
    c.fillStyle='#2a1606'; rr(c,x-46,y-104,92,22,5); c.fill();
    c.fillStyle='#ffe7a3'; c.font='700 13px '+MMF; c.textAlign='center'; c.textBaseline='middle'; c.fillText(sn.my,x,y-93);
    c.fillStyle='#f4b63f'; c.font='700 10px '+BODY; c.fillText(ks(sn.p),x,y-6);
    c.fillStyle='#ffd27a'; circ(c,x-58,y-74,3); circ(c,x+58,y-74,3);
  });
  addLight(x,y-40,110,'#ffd27a');
  STALLFRONTS.push({x,y:y+20});
  IT.push({x,y:y+26,r:42,label:()=>`Buy ${sn.name} · ${ks(sn.p)}`,act:()=>buySnack(sn)});
});
// tea shop stools
(function(){
  const r=srng(9);
  for(let i=0;i<5;i++){ const x=180+i*110, y=1160+r()*10;
    addDraw(y,x-30,x+30,c=>{
      c.fillStyle='#d8c6a8'; c.fillRect(x-14,y-14,28,10); c.fillStyle='#6b5a44'; c.fillRect(x-12,y-4,3,6); c.fillRect(x+9,y-4,3,6);
      const sc=['#2d7bb6','#c23b4b','#2d7bb6','#e0a526'];
      [[-24,-2],[24,-2],[-14,10],[14,10]].forEach(([dx,dy],k)=>{ c.fillStyle=sc[(k+i)%4]; c.fillRect(x+dx-5,y+dy-8,10,6); c.fillRect(x+dx-5,y+dy-2,2,4); c.fillRect(x+dx+3,y+dy-2,2,4); });
      c.fillStyle='#f3efe6'; circ(c,x-6,y-12,2.4); circ(c,x+5,y-11,2.4);
    });
  }
})();

// Game booths
function gameBooth(x,y,kind){
  addCol(x-100,y-48,200,50);
  addDraw(y,x-115,x+115,c=>{
    c.fillStyle='#3a2a4a'; c.fillRect(x-96,y-112,192,72);
    if(kind==='ring'){ for(let r=0;r<3;r++) for(let k=0;k<6;k++){ c.fillStyle=(r===1&&k===3)?'#f4b63f':'#3fae7a'; const bx=x-60+k*24, by=y-96+r*18; c.fillRect(bx-3,by,6,10); c.fillRect(bx-1.5,by-5,3,5);} }
    else if(kind==='darts'){ for(let r=0;r<3;r++) for(let k=0;k<7;k++){ c.fillStyle=BALLOONS[(r*7+k)%5]; el(c,x-72+k*24,y-96+r*20+Math.sin(T*2+k+r)*1.5,7,8.5);} }
    else { const toys=['#c9a46a','#f7efe0','#ff8ad8','#8fb4ff','#f4b63f'];
      c.fillStyle='#5a3a24'; c.fillRect(x-90,y-78,180,4); c.fillRect(x-90,y-102,180,4);
      for(let k=0;k<7;k++){ c.fillStyle=toys[k%5]; circ(c,x-72+k*24,y-86,8); circ(c,x-72+k*24,y-95,5); }
      for(let k=0;k<5;k++){ c.fillStyle=toys[(k+2)%5]; el(c,x-60+k*30,y-60,11,9); circ(c,x-60+k*30+9,y-66,5); } }
    c.fillStyle=kind==='prize'?'#2d7bb6':'#c23b4b'; c.fillRect(x-100,y-40,200,38);
    for(let k=0;k<10;k++){ c.fillStyle=k%2?'#fff3d6':(kind==='prize'?'#2d7bb6':'#c23b4b'); c.fillRect(x-100+k*20,y-40,20,8); }
    for(let k=0;k<10;k++){ c.fillStyle=k%2?'#fff3d6':'#f4b63f'; c.fillRect(x-106+k*21.2,y-134,21.2,18); }
    c.fillStyle='#f4b63f'; for(let k=0;k<10;k++){ c.beginPath(); c.arc(x-95.4+k*21.2,y-116,10.6,0,Math.PI); c.fill(); }
    const label=kind==='ring'?['ကွင်းပစ်','RING TOSS']:kind==='darts'?['မြှားပစ်','BALLOON DARTS']:['ဆုများ','PRIZES'];
    c.fillStyle='#2a1606'; rr(c,x-58,y-160,116,26,6); c.fill();
    c.fillStyle='#ffe7a3'; c.textAlign='center'; c.textBaseline='middle';
    c.font='700 12px '+MMF; c.fillText(label[0],x-24,y-147); c.font='700 9px '+BODY; c.fillStyle='#f4b63f'; c.fillText(label[1],x+28,y-147);
    for(let k=0;k<9;k++){ c.fillStyle=(k+Math.floor(T*3))%2?'#ffe7a3':'#ff5a4e'; circ(c,x-96+k*24,y-134,2.4); }
  });
  addLight(x,y-60,140,'#ffe1a6');
  VENDORS.push({x,y:y-46,shirt:pick(SHIRTS),lon:pick(LONS),skin:pick(SKINS),hat:false,bun:Math.random()<.5});
  STALLFRONTS.push({x,y:y+24});
}
gameBooth(270,1590,'ring'); gameBooth(570,1590,'darts'); gameBooth(420,1870,'prize');
IT.push({x:270,y:1625,r:50,label:()=>`Play ring toss · ${ks(1000)}`,act:()=>startGame('ring')});
IT.push({x:570,y:1625,r:50,label:()=>`Play balloon darts · ${ks(1000)}`,act:()=>startGame('darts')});
IT.push({x:420,y:1905,r:50,label:()=>`Trade tickets for prizes (${S.tix} tickets)`,act:openPrizes});

// Kids corner: mini train
const TR={cx:1380,cy:1650,rx:210,ry:110,u:0,riding:false,rideU:0};
function trackPos(u: number): [number, number] { return [TR.cx+Math.cos(u)*TR.rx, TR.cy+Math.sin(u)*TR.ry]; }
addDraw(TR.cy+TR.ry+60,TR.cx-80,TR.cx+80,c=>{ // station
  const x=TR.cx, y=TR.cy+TR.ry+60;
  c.fillStyle='#5a3a24'; c.fillRect(x-60,y-14,120,14);
  c.fillStyle='#c23b4b'; c.beginPath(); c.moveTo(x-70,y-46); c.lineTo(x+70,y-46); c.lineTo(x+56,y-60); c.lineTo(x-56,y-60); c.fill();
  c.fillStyle='#e9dcc4'; c.fillRect(x-52,y-46,4,32); c.fillRect(x+48,y-46,4,32);
  c.fillStyle='#ffe7a3'; c.font='700 10px '+BODY; c.textAlign='center'; c.textBaseline='middle'; c.fillText('MINI TRAIN · 500 Ks',x,y-53);
});
addLight(TR.cx,TR.cy+TR.ry+40,110,'#ffe1a6');
IT.push({x:TR.cx,y:TR.cy+TR.ry+78,r:55,label:()=>`Ride the mini train · ${ks(500)}`,act:()=>{ if(!pay(500)) return; S.rides++; TR.riding=true; TR.rideU=0; P.hidden=true; sfx('toot'); toast('All aboard! One loop around the Kids Corner.'); updateHUD(); }});
// toy stall
addCol(1530,1885,120,36);
addDraw(1920,1510,1670,c=>{
  const x=1590,y=1920;
  c.fillStyle='#e9dcc4'; c.fillRect(x-60,y-36,120,34);
  c.fillStyle='#7a2e5c'; c.fillRect(x-60,y-12,120,10);
  for(let k=0;k<5;k++){ c.fillStyle=BALLOONS[k]; el(c,x-40+k*20,y-90+Math.sin(T*1.6+k)*2,7,8.5); c.strokeStyle='rgba(255,255,255,.5)'; c.lineWidth=.8; ln(c,x-40+k*20,y-82,x-40+k*20,y-40); }
  c.fillStyle='#f7efe0'; for(let k=0;k<4;k++){ el(c,x-36+k*24,y-26,6,7); c.fillStyle='#c23b4b'; circ(c,x-36+k*24,y-34,4); c.fillStyle='#f7efe0'; }
  c.fillStyle='#2a1606'; rr(c,x-44,y-124,88,22,5); c.fill();
  c.fillStyle='#ffe7a3'; c.font='700 12px '+MMF; c.textAlign='center'; c.textBaseline='middle'; c.fillText('ကစားစရာ · TOYS',x,y-113);
});
VENDORS.push({x:1590,y:1890,shirt:'#f2d49b',lon:'#4b2c63',skin:'#a8714a',hat:true});
STALLFRONTS.push({x:1590,y:1945});
addLight(1590,1890,110,'#ffd27a');
IT.push({x:1590,y:1950,r:48,label:()=>'Browse the toy stall',act:openToys});

// Music stage
const ST={x:360,y:2110};
addCol(ST.x-175,ST.y-80,350,90);
const BAND=[{dx:-110,shirt:'#f4b63f',lon:'#7a1f2b',ring:true},{dx:-40,shirt:'#ffffff',lon:'#283a6b'},{dx:30,shirt:'#ff8ad8',lon:'#4b2c63',mic:true},{dx:100,shirt:'#9fd3f0',lon:'#2f5d50'}];
addDraw(ST.y+12,ST.x-200,ST.x+200,c=>{
  const {x,y}=ST;
  c.fillStyle='#1d1628'; c.fillRect(x-175,y-150,350,80);
  c.strokeStyle='#7d82a3'; c.lineWidth=4; ln(c,x-170,y-150,x-170,y-20); ln(c,x+170,y-150,x+170,y-20); ln(c,x-172,y-150,x+172,y-150);
  for(let k=0;k<8;k++){ const on=(k+Math.floor(T*4))%2; c.fillStyle=on?['#ff5a4e','#3fc7a5','#f4b63f','#8fb4ff'][k%4]:'#3a3350'; circ(c,x-150+k*43,y-146,5); }
  c.fillStyle='#7a1f2b'; rr(c,x-90,y-140,180,34,6); c.fill();
  c.fillStyle='#ffe7a3'; c.font='700 15px '+MMF; c.textAlign='center'; c.textBaseline='middle'; c.fillText('ဂီတ',x-46,y-123); c.font='400 13px '+DISP; c.fillStyle='#f4b63f'; c.fillText('LIVE',x+30,y-123);
  c.fillStyle='#4a3a5a'; c.fillRect(x-175,y-70,350,60); c.fillStyle='#2b2238'; c.fillRect(x-175,y-12,350,20);
  BAND.forEach((b,i)=>{
    const bx=x+b.dx, by=y-26, bob=-Math.abs(Math.sin(T*4+i))*2.5;
    if(b.ring){ c.fillStyle='#b8862b'; el(c,bx,by-2,22,9); c.fillStyle='#4a3a5a'; el(c,bx,by-2,15,5.5); for(let k=0;k<10;k++){ const a=k/10*TAU; c.fillStyle='#e0b45a'; circ(c,bx+Math.cos(a)*19,by-4+Math.sin(a)*7.5,2.8);} }
    person(c,bx,by,{shirt:b.shirt,lon:b.lon,skin:SKINS[i],bob,armsUp:b.mic&&Math.sin(T*1.3)>.4,t:T,step:0,s:1.15,bun:i===2});
    if(b.mic){ c.strokeStyle='#999'; c.lineWidth=1.5; ln(c,bx+8,by,bx+8,by-26); }
  });
  c.fillStyle='#16101f'; c.fillRect(x-200,y-60,24,60); c.fillRect(x+176,y-60,24,60);
  c.fillStyle='#3a3350'; circ(c,x-188,y-40,7); circ(c,x-188,y-18,9); circ(c,x+188,y-40,7); circ(c,x+188,y-18,9);
});
addLight(ST.x,ST.y-40,260,'#ff8ad8'); addLight(ST.x,ST.y+60,160,'#8fb4ff');
// Photo booth
addCol(590,2255,70,45);
addDraw(2300,570,680,c=>{
  const x=625,y=2300;
  c.fillStyle='#e9dcc4'; c.fillRect(x-35,y-80,70,80);
  c.fillStyle='#7a1f2b'; c.fillRect(x-28,y-66,30,62);
  c.fillStyle='#2a2238'; c.fillRect(x+6,y-60,22,16); c.fillStyle='#fff'; circ(c,x+17,y-52,4);
  c.fillStyle='#2a1606'; rr(c,x-42,y-104,84,22,5); c.fill();
  c.fillStyle='#ffe7a3'; c.font='700 12px '+MMF; c.textAlign='center'; c.textBaseline='middle'; c.fillText('ဓာတ်ပုံ · PHOTO',x,y-93);
  if(Math.sin(T*.9)>.97){ c.fillStyle='rgba(255,255,255,.8)'; circ(c,x+17,y-52,10); }
});
addLight(625,2280,90,'#ffffff');
IT.push({x:625,y:2330,r:45,label:()=>`Souvenir photo booth · ${ks(500)}`,act:boothPhoto});

// Finale view platform (walkable deck)
const FV={x:1380,y:2150};
addDraw(2080,1220,1540,c=>{
  const {x,y}=FV;
  c.fillStyle='#4a3424'; c.fillRect(x-160,y-70,320,130);
  c.fillStyle='#5c4230'; for(let k=0;k<13;k++) c.fillRect(x-160,y-70+k*10,320,5);
  c.fillStyle='#3a2a1c'; c.fillRect(x-40,y+60,80,16); c.fillRect(x-36,y+76,72,8);
  c.strokeStyle='#d9c48a'; c.lineWidth=3; ln(c,x-160,y-82,x+160,y-82);
  for(let k=0;k<=16;k++){ ln(c,x-160+k*20,y-82,x-160+k*20,y-66); }
  for(let k=0;k<9;k++){ c.fillStyle=k%2?'#ff5a4e':'#f4b63f'; circ(c,x-150+k*37.5,y-86+Math.sin(T*2+k)*1,3); }
  c.fillStyle='#6b4f3a'; c.fillRect(x-120,y+20,70,10); c.fillRect(x+50,y+20,70,10);
});
// a sign on the deck rail
addDraw(2066,1250,1510,c=>{ c.fillStyle='#2a1606'; rr(c,FV.x-80,FV.y-118,160,26,6); c.fill(); c.fillStyle='#ffe7a3'; c.font='700 12px '+MMF; c.textAlign='center'; c.textBaseline='middle'; c.fillText('မီးပန်း · FIREWORKS 9:30 PM',FV.x,FV.y-105); });
addLight(FV.x,FV.y,180,'#ffd27a');
IT.push({x:FV.x,y:FV.y+10,r:110,label:()=>S.showStarted&&!S.showDone?'Watch the fireworks now!':S.showDone?'Watch the finale again':'Watch the skyline',act:()=>startScene('finale')});

// Entry arch
addDraw(2475,740,1060,c=>{
  const y=2475;
  c.fillStyle='#7a1f2b'; c.fillRect(770,y-150,24,150); c.fillRect(1006,y-150,24,150);
  c.fillStyle='#f4b63f'; c.fillRect(766,y-156,32,10); c.fillRect(1002,y-156,32,10);
  c.fillStyle='#7a1f2b'; rr(c,760,y-210,280,62,10); c.fill(); c.strokeStyle='#f4b63f'; c.lineWidth=3; c.stroke();
  c.fillStyle='#ffe7a3'; c.font='700 22px '+MMF; c.textAlign='center'; c.textBaseline='middle'; c.fillText('ရေကျော်ညများ',900,y-189);
  c.font='400 14px '+DISP; c.fillStyle='#f4b63f'; c.fillText('YAY KYAW NIGHTS',900,y-163);
  for(let k=0;k<15;k++){ c.fillStyle=(k+Math.floor(T*6))%3?'#ffe7a3':'#ff5a4e'; circ(c,768+k*18.8,y-214,3); }
});
addCol(770,2465,24,12); addCol(1006,2465,24,12);
addLight(900,2380,220,'#f4b63f');
// uncle at the gate
const UNCLE={x:1120,y:2520,shirt:'#ffffff',lon:'#3c5a2a',skin:'#a8714a',hat:false};
VENDORS.push(UNCLE);
IT.push({x:UNCLE.x,y:UNCLE.y+10,r:45,label:()=>'Ask Uncle for pocket money',act:askUncle});

// lantern strings over the road
const STRINGS=[]; for(let y=470;y<=2370;y+=140) STRINGS.push(y);
STRINGS.forEach(y=>{ addLight(900,y+20,150,'#ff7a5c'); });

// secrets
const SECRETS=[
  {id:'cat',x:410,y:1186,name:'Sleeping cat',d:'Under the tea-shop stools, a ginger cat sleeps through the whole festival.'},
  {id:'slipper',x:990,y:1720,name:'A lost slipper',d:'One blue rubber slipper on the road. Somebody is hopping home tonight.'},
  {id:'saika',x:1210,y:2490,name:'Parked trishaw',d:'A sidecar trishaw, a saika, waits by the gate for the late crowd heading home.'},
  {id:'parrot',x:700,y:1935,name:'Fortune parrot',d:'A green parrot picks a folded card for you. It says: a lucky night ahead.'},
  {id:'kite',x:1560,y:362,name:'Kite on the fence',d:'A paper kite is tangled on the lakeside fence, its tail still dancing in the breeze.'},
  {id:'quail',x:742,y:1432,name:'Quail-egg grandma',d:'An old lady sells quail eggs from a basket by lamplight and remembers every regular.'},
];
SECRETS.forEach(s=>{
  addDraw(s.y,s.x-30,s.x+30,c=>{
    const {x,y}=s;
    if(s.id==='cat'){ c.fillStyle='#e08a3a'; el(c,x,y-4,9,5); circ(c,x+8,y-7,4); c.beginPath(); c.moveTo(x+6,y-10); c.lineTo(x+7,y-14); c.lineTo(x+9,y-10); c.fill(); c.strokeStyle='#e08a3a'; c.lineWidth=2; c.beginPath(); c.arc(x-9,y-2,5,Math.PI*.5,Math.PI*1.4); c.stroke(); }
    if(s.id==='slipper'){ c.fillStyle='#2d7bb6'; el(c,x,y-2,8,3.5); c.strokeStyle='#fff'; c.lineWidth=1.2; ln(c,x-2,y-4,x+3,y-1); }
    if(s.id==='saika'){ c.fillStyle='#1b1420'; circ(c,x-14,y-6,8); circ(c,x+14,y-6,8); c.fillStyle='#2f5d50'; c.fillRect(x-4,y-24,26,14); c.fillStyle='#c23b4b'; c.fillRect(x-22,y-20,16,6); c.strokeStyle='#999'; c.lineWidth=2; ln(c,x-14,y-6,x-22,y-26); c.fillStyle='#2a2a2a'; c.fillRect(x-26,y-30,8,4); }
    if(s.id==='parrot'){ c.strokeStyle='#d9c48a'; c.lineWidth=1.2; c.beginPath(); c.arc(x,y-20,10,Math.PI,0); c.stroke(); ln(c,x-10,y-20,x-10,y-4); ln(c,x+10,y-20,x+10,y-4); ln(c,x-10,y-4,x+10,y-4); c.fillStyle='#3fb36a'; el(c,x,y-12,3.5,5); c.fillStyle='#f4b63f'; circ(c,x+2,y-16,1.4); }
    if(s.id==='kite'){ c.fillStyle='#ff5a4e'; c.beginPath(); c.moveTo(x,y-28); c.lineTo(x+9,y-18); c.lineTo(x,y-6); c.lineTo(x-9,y-18); c.fill(); c.strokeStyle='#f4b63f'; c.lineWidth=1.2; c.beginPath(); c.moveTo(x,y-6); for(let k=1;k<6;k++) c.lineTo(x+Math.sin(T*3+k)*4,y-6+k*5); c.stroke(); }
    if(s.id==='quail'){ c.fillStyle='#b98a4a'; el(c,x+10,y-4,9,5); c.fillStyle='#efe3cf'; circ(c,x+7,y-7,2); circ(c,x+11,y-8,2); circ(c,x+14,y-6,2); person(c,x-6,y,{shirt:'#f3efe6',lon:'#5a3a24',skin:'#b7835a',bun:true,s:.9}); }
    if(!S.secrets.includes(s.id)){ const d=Math.hypot(P.x-x,P.y-y); if(d<170){ const a=(1-d/170)*(.5+.5*Math.sin(T*5)); c.fillStyle=`rgba(255,240,180,${a})`; const sy=y-36; c.beginPath(); c.moveTo(x,sy-6); c.lineTo(x+2,sy-2); c.lineTo(x+6,sy); c.lineTo(x+2,sy+2); c.lineTo(x,sy+6); c.lineTo(x-2,sy+2); c.lineTo(x-6,sy); c.lineTo(x-2,sy-2); c.fill(); } }
  });
});
addCol(1184,2478,52,16);

// vendors drawn as people
VENDORS.forEach(v=>addDraw(v.y,v.x-12,v.x+12,c=>person(c,v.x,v.y,{shirt:v.shirt,lon:v.lon,skin:v.skin,hat:v.hat,bun:v.bun,bob:-Math.abs(Math.sin(T*1.5+v.x))*1})));

// ---------- skyline (used on the map and in scenes) ----------
const SKY=(function(){ const r=srng(21), b=[]; let x=-0.05;
  while(x<1.05){ const w=.02+r()*.045, h=.25+r()*.75; const win=[]; const cols=Math.floor(w*120), rows=Math.floor(h*10);
    for(let i=0;i<cols;i++) for(let j=0;j<rows;j++) if(r()<.35) win.push([i/cols,j/rows,r()]);
    if(Math.abs(x-.5)>.06) b.push({x,w,h,win,tone:r()}); x+=w+r()*.008; }
  const stars=[]; for(let i=0;i<120;i++) stars.push([r(),r()*.7,r()*6,r()]);
  const bokeh=[]; for(let i=0;i<90;i++) bokeh.push([r(),r(),r(),Math.floor(r()*5)]);
  return {b,stars,bokeh}; })();
function pagoda(c: Ctx, x: number, base: number, h: number, glow?: boolean): void {
  const w=h*.42;
  if(glow){ const g=c.createRadialGradient(x,base-h*.45,0,x,base-h*.45,h*.9); g.addColorStop(0,'rgba(255,200,90,.45)'); g.addColorStop(1,'rgba(255,200,90,0)'); c.fillStyle=g; c.fillRect(x-h,base-h*1.4,h*2,h*1.5); }
  const gr=c.createLinearGradient(x-w,0,x+w,0); gr.addColorStop(0,'#b97a17'); gr.addColorStop(.45,'#ffd86b'); gr.addColorStop(1,'#a8680f');
  c.fillStyle=gr;
  c.fillRect(x-w,base-h*.08,w*2,h*.08); c.fillRect(x-w*.82,base-h*.15,w*1.64,h*.08); c.fillRect(x-w*.66,base-h*.21,w*1.32,h*.07);
  c.beginPath(); c.moveTo(x-w*.6,base-h*.21); c.bezierCurveTo(x-w*.6,base-h*.48,x-w*.18,base-h*.5,x-w*.15,base-h*.6); c.lineTo(x+w*.15,base-h*.6); c.bezierCurveTo(x+w*.18,base-h*.5,x+w*.6,base-h*.48,x+w*.6,base-h*.21); c.fill();
  for(let k=0;k<5;k++){ const ww=w*(.16-k*.022); c.fillRect(x-ww,base-h*(.6+k*.035),ww*2,h*.03); }
  c.beginPath(); c.moveTo(x-w*.1,base-h*.77); c.quadraticCurveTo(x-w*.12,base-h*.86,x,base-h*.93); c.quadraticCurveTo(x+w*.12,base-h*.86,x+w*.1,base-h*.77); c.fill();
  c.fillRect(x-1,base-h,2,h*.08);
  c.fillStyle='#fff6d0'; circ(c,x,base-h,Math.max(1.2,h*.012));
}
function skyline(c: Ctx, X: number, Y: number, W: number, H: number, lit?: boolean): void { // draws buildings into box with bottom at Y+H
  SKY.b.forEach(b=>{
    const bx=X+b.x*W, bw=b.w*W, bh=b.h*H*.7, by=Y+H-bh;
    c.fillStyle=b.tone>.5?'#151233':'#1b1740'; c.fillRect(bx,by,bw,bh);
    if(lit){ c.fillStyle='rgba(255,214,140,.75)'; b.win.forEach(([i,j,f])=>{ if(f>.15||Math.sin(T+f*40)>0) c.fillRect(bx+i*bw+1,by+j*bh+3,Math.max(1,bw*.04),Math.max(1,bh*.035)); }); }
  });
  pagoda(c,X+W*.5,Y+H,H*1.05,true);
}
function drawNorth(){
  const g=ctx.createLinearGradient(0,-500,0,NORTH); g.addColorStop(0,'#08061f'); g.addColorStop(.55,'#1b1243'); g.addColorStop(1,'#141c45');
  ctx.fillStyle=g; ctx.fillRect(-600,-600,WW+1200,NORTH+600);
  skyline(ctx,-200,40,WW+400,170,true);
  ctx.fillStyle='#0f1838'; ctx.fillRect(-600,210,WW+1200,NORTH-210);
  for(let i=0;i<60;i++){ const x=(i*97)%WW, y=220+(i*37)%110; ctx.fillStyle=`rgba(255,210,120,${.12+.12*Math.sin(T*2+i)})`; ctx.fillRect(x+Math.sin(T+i)*6,y,30+(i%4)*10,1.5); }
  ctx.fillStyle='rgba(255,200,90,.22)'; for(let k=0;k<9;k++) ctx.fillRect(900-6+Math.sin(T*2+k)*5,216+k*13,12,3);
  // fence
  ctx.strokeStyle='#5a5070'; ctx.lineWidth=2; ln(ctx,0,NORTH+2,WW,NORTH+2); ln(ctx,0,NORTH-8,WW,NORTH-8);
  for(let x=0;x<=WW;x+=24) ln(ctx,x,NORTH-14,x,NORTH+4);
}

// ---------- NPCs ----------
interface Npc extends PersonOpts { x: number; y: number; tx: number; ty: number; sp: number; wait: number; ph: number; moving: boolean; stuck: number; leader?: Npc; ox?: number; oy?: number }
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
function mk(o: Partial<Npc>): Npc { return Object.assign({x:0,y:0,tx:0,ty:0,sp:rand(26,46),wait:rand(0,4),shirt:pick(SHIRTS),lon:pick(LONS),skin:pick(SKINS),s:1,ph:rand(0,9),moving:false,bun:Math.random()<.45,face:1,stuck:0},o); }
function spawnCrowd(){
  const n={low:28,med:60,high:110}[S.settings.density]||60;
  NPC=[];
  for(let i=0;i<n;i++){
    const [x,y]=freePoint(); const L=mk({x,y}); [L.tx,L.ty]=freePoint(); NPC.push(L);
    if(Math.random()<.3) L.balloon=pick(BALLOONS);
    if(Math.random()<.35){ const k=Math.random()<.4?2:1; for(let j=0;j<k;j++) NPC.push(mk({x:x+rand(-10,10),y:y+rand(4,12),s:.68,leader:L,ox:rand(-14,14),oy:rand(4,12),balloon:Math.random()<.4?pick(BALLOONS):null,bun:Math.random()<.5})); }
  }
}
function updateNPC(n: Npc, dt: number): void {
  let tx,ty,sp;
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
  if(Math.abs(dx)>1) n.face=dx>0?1:-1;
  n.moving=moved;
  if(!moved && !n.leader){ if(++n.stuck>20){ [n.tx,n.ty]=freePoint(); n.stuck=0; } }
}

// ---------- small shared helpers ----------
function setSound(on: boolean): void { S.settings.sound=on; saveSettings(); setMaster(on); $('bSound').textContent=on?'Sound on':'Sound off'; }
function esc(t: string): string { return t.replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch] as string)); }
/** Player names are free text from other players: strip control and invisible characters and cap the length. */
function cleanName(v: unknown): string {
  if(typeof v!=='string') return '';
  return v.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿]/g,'').trim().slice(0,NAME_MAX);
}
function nameTag(c: Ctx, x: number, y: number, name: string, self: boolean): void {
  c.font='700 11px '+BODY; c.textAlign='center'; c.textBaseline='middle';
  const w=c.measureText(name).width+12;
  c.fillStyle=self?'rgba(122,31,43,.88)':'rgba(13,10,36,.78)'; rr(c,x-w/2,y-8,w,16,8); c.fill();
  if(!self){ c.strokeStyle='rgba(63,199,165,.8)'; c.lineWidth=1; c.stroke(); }
  c.fillStyle=self?'#ffe7a3':'#ffffff'; c.fillText(name,x,y+.5);
}
function loadFonts(): void {
  if(!document.fonts) return;
  ['400 14px "Walone"','700 14px "Walone"','400 14px "Brandon Text"','700 14px "Brandon Text"'].forEach(f=>{ document.fonts.load(f,'ရေကျော် Aa').catch(()=>{ /* fallback fonts stay */ }); });
}

// ---------- bicycles on the main street ----------
interface Bike { x: number; y: number; dir: 1 | -1; sp: number; cur: number; rider: PersonOpts; col: string; bellCd: number; pathCd: number; ringT: number; saika: boolean; ph: number }
const BIKES: Bike[] = [];
function spawnBikes(): void {
  BIKES.length=0;
  for(let i=0;i<6;i++){
    const dir: 1 | -1 = i%2 ? 1 : -1;
    BIKES.push({ x: dir<0 ? rand(975,1005) : rand(795,825), y: rand(420,2560), dir, sp: rand(70,105), cur: 80,
      rider: { shirt:pick(SHIRTS), lon:pick(LONS), skin:pick(SKINS), hat:Math.random()<.3, bun:Math.random()<.4 },
      col: pick(['#2d7bb6','#c23b4b','#3a9b7a','#1b1420','#e0a526']), bellCd: rand(3,12), pathCd: 0, ringT: 0, saika: i===5, ph: rand(0,9) });
  }
}
function ringBell(b: Bike): void {
  b.ringT=.8;
  if(S.mode==='walk') bell(clamp(1-Math.hypot(P.x-b.x,P.y-b.y)/520,0,1));
}
function inLane(b: Bike, x: number, y: number): number { // distance ahead, or -1
  const ahead=(y-b.y)*b.dir; return ahead>0&&ahead<130&&Math.abs(x-b.x)<24 ? ahead : -1;
}
function updateBikes(dt: number): void {
  for(const b of BIKES){
    let ahead=S.mode==='walk'&&!P.hidden ? inLane(b,P.x,P.y) : -1;
    for(const r of REMOTE.values()){ const a=inLane(b,r.x,r.y); if(a>=0&&(ahead<0||a<ahead)) ahead=a; }
    const target=ahead<0 ? b.sp : ahead<45 ? 0 : 20;
    b.cur=lerp(b.cur,target,Math.min(1,dt*3));
    b.y+=b.dir*b.cur*dt;
    b.bellCd-=dt; b.pathCd-=dt; b.ringT=Math.max(0,b.ringT-dt);
    if(ahead>=0&&b.pathCd<=0){ ringBell(b); b.pathCd=2.2; }                       // someone in the way: ring ring!
    else if(b.bellCd<=0){ if(Math.hypot(P.x-b.x,P.y-b.y)<650) ringBell(b); b.bellCd=rand(8,18); } // a friendly ring now and then
    if(b.y<NORTH+16) b.y=WH+30; else if(b.y>WH+40) b.y=NORTH+16;
  }
}
function drawBike(c: Ctx, b: Bike): void {
  const {x,y}=b, pedal=Math.sin(T*b.cur*.12+b.ph)*1.6;
  c.fillStyle='rgba(0,0,0,.3)'; el(c,x,y-10,5,14);
  const wheel=(wy: number)=>{ c.strokeStyle='#15101c'; c.lineWidth=2.6; c.beginPath(); c.ellipse(x,wy,2.2,6.6,0,0,TAU); c.stroke(); };
  const bar=()=>{ const hy=(b.dir>0?y:y-20)-13;
    c.strokeStyle='#b7bdd6'; c.lineWidth=1.8; ln(c,x-7,hy,x+7,hy); c.fillStyle='#1b1420'; circ(c,x-7,hy,1.5); circ(c,x+7,hy,1.5);
    c.fillStyle='#d9c48a'; circ(c,x+5,hy-1.5,1.6); // the bell
    if(b.ringT>0){ c.strokeStyle=`rgba(255,231,163,${Math.min(1,b.ringT*1.4)})`; c.lineWidth=1.3;
      for(const rad of [5,9]){ c.beginPath(); c.arc(x+6,hy-2,rad,-1.1,.6); c.stroke(); } } };
  wheel(y-20);
  c.strokeStyle=b.col; c.lineWidth=2.8; ln(c,x,y-4,x,y-17);
  if(b.dir<0) bar();
  if(b.saika){ // sidecar trishaw
    c.fillStyle='#15101c'; circ(c,x-17,y-3,4.5);
    c.fillStyle='#2f5d50'; rr(c,x-25,y-22,15,17,3); c.fill(); c.fillStyle='#c23b4b'; c.fillRect(x-25,y-12,15,3);
    c.fillStyle=SKINS[2]; circ(c,x-17.5,y-25,3.6); c.fillStyle='#17101a'; c.beginPath(); c.arc(x-17.5,y-25.6,3.7,Math.PI,0); c.fill();
  }
  person(c,x,y-6,{...b.rider,s:.92,step:pedal,bob:-Math.abs(pedal)*.4});
  wheel(y);
  if(b.dir>0) bar();
}

// ---------- avatar creator ----------
function openAvatar(first: boolean, after?: () => void): void {
  const a: Avatar = {...S.settings.av};
  const wrap=document.createElement('div');
  wrap.innerHTML=`<div class="avgrid"><div class="avprev"><canvas width="220" height="260" aria-label="Preview of your character"></canvas><button type="button" class="avrand">Surprise me</button></div><div class="avopts"></div></div>`;
  const cvs=wrap.querySelector('canvas') as HTMLCanvasElement, pc=cvs.getContext('2d');
  const opts=wrap.querySelector('.avopts') as HTMLElement;
  const draw=()=>{
    pc.clearRect(0,0,220,260);
    const g=pc.createLinearGradient(0,0,0,260); g.addColorStop(0,'#2a1d4f'); g.addColorStop(1,'#140e2a'); pc.fillStyle=g; rr(pc,0,0,220,260,14); pc.fill();
    for(let k=0;k<6;k++){ pc.fillStyle=['#ff5a4e','#f4b63f','#3fc7a5'][k%3]; el(pc,22+k*35,26+Math.sin(k)*5,7,9); }
    person(pc,110,228,{...avatarOpts(a),s:5.2});
    const nm=cleanName(nameVal);
    if(nm) nameTag(pc,110,246,nm,true);
  };
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
  nr.innerHTML=`<label class="lbl" for="avName">Your name</label><input id="avName" maxlength="${NAME_MAX}" autocomplete="nickname" placeholder="Shown above your head" value="${esc(nameVal)}">`;
  opts.appendChild(nr);
  (nr.querySelector('input') as HTMLInputElement).addEventListener('input',e=>{ nameVal=(e.target as HTMLInputElement).value; draw(); });
  nr.querySelector('input').addEventListener('keydown',e=>e.stopPropagation());
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
  openModal(first?'Dress up for the fair':'Your look',wrap,()=>{ if(first||!saved) save(); after?.(); });
  draw();
}

// ---------- multiplayer: everyone with the page open shares one fair ----------
interface Remote { peer: string; name: string; av: Avatar; x: number; y: number; tx: number; ty: number; face: number; moving: boolean; where: string; balloon: string | null; wv: number; waveUntil: number }
const REMOTE = new Map<string, Remote>();
let room: typeof Claude.room | null = null;
let lastSent='', presT=0, waveCount=0, roomReady=false;
async function initRoom(): Promise<void> {
  try{
    const r=await window.claude?.use?.('room');
    if(!r) return;
    room=r;
    r.onPeers(ch=>syncPeers(ch.peers), ()=>{ room=null; REMOTE.clear(); updatePlayers(); });
    setTimeout(()=>{ roomReady=true; },2500); // the first deliveries list who was already here: no join toasts for them
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
    if(!r){ r={peer:p.peer,name:'',av:DEFAULT_AVATAR,x,y,tx:x,ty:y,face:1,moving:false,where:'walk',balloon:null,wv:0,waveUntil:0}; REMOTE.set(p.peer,r);
      if(roomReady) toast(`<b>${esc(cleanName(pr.n)||'A friend')}</b> joined the fair.`); }
    r.tx=x; r.ty=y; r.name=cleanName(pr.n); r.av=cleanAvatar(pr.av); r.face=pr.f===-1?-1:1;
    r.where=typeof pr.w==='string'?pr.w.slice(0,12):'walk';
    r.balloon=typeof pr.b==='string'&&(BALLOONS as readonly string[]).includes(pr.b)?pr.b:null;
    const wv=typeof pr.wv==='number'?pr.wv:0; if(wv!==r.wv){ if(r.wv!==0||wv>0) r.waveUntil=T+2.2; r.wv=wv; }
  }
  for(const [k,r] of [...REMOTE]) if(!seen.has(k)){ toast(`<b>${esc(r.name||'A friend')}</b> left the fair.`); REMOTE.delete(k); }
  updatePlayers();
}
function updatePlayers(): void {
  $('pStat').hidden=!room||REMOTE.size===0;
  $('players').textContent=String(REMOTE.size+1);
}
function sendPresence(dt: number): void {
  if(!room||S.mode==='title') return;
  presT-=dt; if(presT>0) return; presT=.08;
  const where=S.mode==='walk'?(TR.riding?'train':'walk'):S.mode==='scene'?SC.kind:MG.kind;
  const msg={x:Math.round(P.x),y:Math.round(P.y),f:P.face,w:where,n:S.settings.name,av:S.settings.av as unknown as Record<string,unknown>,b:S.balloon,wv:waveCount};
  const k=JSON.stringify(msg); if(k===lastSent) return; lastSent=k;
  room.presence(msg).catch(()=>{ lastSent=''; });
}
function wave(): void { if(S.mode!=='walk') return; P.waveUntil=T+2.2; waveCount++; }

// ---------- UI helpers ----------
function toast(msg: string, big?: boolean): void {
  const d=document.createElement('div'); d.className='toast'+(big?' big':''); d.innerHTML=msg; $('toasts').appendChild(d);
  while($('toasts').children.length>3) $('toasts').firstChild.remove();
  setTimeout(()=>d.remove(),big?4200:3000);
}
function fmtClock(m: number): string { m=Math.floor(m); let h=Math.floor(m/60)%24, mm=m%60; const ap=h>=12?'PM':'AM'; h=h%12||12; return h+':'+String(mm).padStart(2,'0')+' '+ap; }
function journey(){
  const discover=S.zones.length>=4, play=S.rides>0&&S.games>0, fin=S.finaleSeen;
  return {arrive:true,discover,play,finale:fin};
}
let hudCache='';
function updateHUD(){
  $('kyat').textContent=S.kyat.toLocaleString('en-US');
  $('tix').textContent=String(S.tix);
  $('clock').textContent=fmtClock(S.clock);
  const j=journey(); let nowSet=false;
  document.querySelectorAll<HTMLElement>('#journey li').forEach(li=>{ const k=li.dataset.s; li.classList.toggle('done',j[k]); const now=!j[k]&&!nowSet; li.classList.toggle('now',now); if(now) nowSet=true; });
  let g;
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
function closeModal(){ $('modal').hidden=true; S.paused=false; const f=modalClose; modalClose=null; if(f) f(); }
$('mClose').onclick=closeModal;
$('modal').addEventListener('pointerdown',e=>{ if((e.target as HTMLElement).id==='modal') closeModal(); });

// ---------- actions ----------
function buySnack(sn){
  if(!pay(sn.p)) return;
  if(!S.snacks.includes(sn.id)){ S.snacks.push(sn.id); toast(`<b>${sn.name}</b> <span class="mm">${sn.my}</span><br>${sn.d}`); }
  else toast(`Another ${sn.name}. Still delicious.`);
  for(let i=0;i<6;i++) PART.push({k:'heart',x:P.x+rand(-6,6),y:P.y-34,vx:rand(-10,10),vy:rand(-40,-20),life:1.2,max:1.2});
}
const TOYS=[
  {id:'balloon',name:'Balloon',my:'ပူဖောင်း',p:500,d:'Tied to your wrist so it follows you around the fair.'},
  {id:'fan',name:'Bamboo hand fan',my:'ယပ်တောင်',p:600,d:'Painted paper on a bamboo frame. Perfect for a warm night.'},
  {id:'doll',name:'Tumbling doll',my:'ပစ်တိုင်းထောင်',p:800,d:'Pyit taing htaung, the papier-mâché doll that always gets back up.'},
  {id:'top',name:'Wooden spinning top',my:'ဂျင်',p:400,d:'Wind the string, throw it down, watch it hum.'},
];
function openToys(){
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
const PRIZES=[
  {id:'keychain',name:'Lucky keychain',p:8,d:'A tiny gold bell on a red cord.'},
  {id:'owl',name:'Lucky owl pair',my:'ဇီးကွက်',p:15,d:'A pair of papier-mâché owls, said to bring good fortune.'},
  {id:'kite',name:'Paper kite',p:22,d:'Ready for a windy afternoon by the lake.'},
  {id:'teddy',name:'Teddy bear',p:35,d:'Fluffy, slightly lopsided, absolutely perfect.'},
  {id:'elephant',name:'White elephant plush',my:'ဆင်ဖြူ',p:60,d:'The giant prize. A white elephant is a royal symbol of luck.'},
];
function openPrizes(){
  const wrap=document.createElement('div'); wrap.className='items';
  const p=document.createElement('p'); p.className='muted'; p.textContent=`You have ${S.tix} tickets. Win more at ring toss and balloon darts.`; wrap.appendChild(p);
  PRIZES.forEach(z=>{ const r=document.createElement('div'); r.className='item';
    r.innerHTML=`<div class="t"><b>${z.name} ${z.my?`<span class="mm muted">${z.my}</span>`:''}</b><small>${z.d}</small></div>`;
    const b=document.createElement('button'); b.className='cta'; b.textContent=`${z.p} tickets`; b.disabled=S.tix<z.p;
    b.onclick=()=>{ if(S.tix<z.p) return; S.tix-=z.p; S.prizes.push(z.id); sfx('ding'); toast(`You won a <b>${z.name}</b>! It is in your bag.`); updateHUD(); closeModal(); };
    r.appendChild(b); wrap.appendChild(r); });
  openModal('Prize counter',wrap);
}
function askUncle(){
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
  let url=''; try{ url=c.toDataURL('image/jpeg',.82); }catch(e){}
  if(url){ S.photos.unshift(url); if(S.photos.length>24) S.photos.pop(); }
  $('flash').style.transition='none'; $('flash').style.opacity='.9'; requestAnimationFrame(()=>{ $('flash').style.transition='opacity .45s'; $('flash').style.opacity='0'; });
  sfx('shutter');
}
function boothPhoto(){
  if(!pay(500)) return;
  const c=document.createElement('canvas'); c.width=480; c.height=600; const g=c.getContext('2d');
  const gr=g.createLinearGradient(0,0,0,600); gr.addColorStop(0,'#1b1243'); gr.addColorStop(1,'#4a2150'); g.fillStyle=gr; g.fillRect(0,0,480,600);
  const sv=T; skyline(g,0,250,480,170,true);
  g.fillStyle='#2a2238'; g.fillRect(0,420,480,180);
  for(let k=0;k<9;k++){ g.fillStyle=['#ff5a4e','#f4b63f','#3fc7a5'][k%3]; el(g,30+k*52,60+Math.sin(k)*10,10,13); g.fillStyle='rgba(255,231,163,.6)'; el(g,30+k*52,60+Math.sin(k)*10,4,5); }
  g.strokeStyle='rgba(255,231,163,.5)'; g.lineWidth=1.5; g.beginPath(); g.moveTo(0,40); g.quadraticCurveTo(240,90,480,40); g.stroke();
  const pose=Math.floor(Math.random()*3);
  person(g,240,540,{...AV(),s:5.2,armsUp:pose===0,t:1.2,balloon:S.balloon,fan:S.fan});
  if(pose>0){ person(g,140,545,{s:3.8,shirt:pick(SHIRTS),lon:pick(LONS),skin:pick(SKINS),thanaka:true,bun:true}); person(g,345,548,{s:3.4,shirt:pick(SHIRTS),lon:pick(LONS),skin:pick(SKINS),thanaka:true,armsUp:true,t:2}); }
  g.fillStyle='#ffe7a3'; g.font='700 30px '+MMF; g.textAlign='center'; g.fillText('ရေကျော်ညများ',240,140);
  capturePhoto(c,'Souvenir photo · 2026');
  toast('Click! Your souvenir photo is in your bag.');
}
function enterPhotoMode(){ if(S.mode!=='walk'&&S.mode!=='scene') return; S.photo=true; $('photoUI').hidden=false; document.body.classList.add('photo'); syncChrome(); }
function exitPhotoMode(){ S.photo=false; P.hidden=TR.riding; $('photoUI').hidden=true; syncChrome(); }
$('shutter').onclick=()=>{ capturePhoto(cv); toast('Photo saved to your bag.'); };
$('photoExit').onclick=exitPhotoMode;
$('photoHide').onclick=()=>{ if(S.mode!=='walk') return; P.hidden=!P.hidden; $('photoHide').textContent=P.hidden?'Show me':'Hide me'; };

// ---------- bag ----------
let bagTab='postcards';
function openBag(){
  const wrap=document.createElement('div');
  const tabs=document.createElement('div'); tabs.className='tabs';
  [['postcards',`Postcards ${S.zones.length}/8`],['souvenirs','Souvenirs'],['photos',`Photos ${S.photos.length}`],['secrets',`Secrets ${S.secrets.length}/6`]].forEach(([k,l])=>{
    const b=document.createElement('button'); b.textContent=l; b.setAttribute('aria-pressed',String(bagTab===k)); b.onclick=()=>{ bagTab=k; render(); tabs.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b))); }; tabs.appendChild(b); });
  const body=document.createElement('div');
  function render(){
    body.innerHTML='';
    if(bagTab==='postcards'){ const g=document.createElement('div'); g.className='cards';
      ZONES.forEach(z=>{ const has=S.zones.includes(z.id); const d=document.createElement('div'); d.className='pc'+(has?'':' locked');
        d.innerHTML=has?`<span class="stamp"></span><span class="no">${String(z.n).padStart(2,'0')}</span><b>${z.name}</b><span class="mm">${z.my}</span><p>${z.card}</p>`:`<span class="no">${String(z.n).padStart(2,'0')}</span><b>Not found yet</b><p>Walk into this zone to collect its postcard.</p>`;
        g.appendChild(d); }); body.appendChild(g); }
    if(bagTab==='souvenirs'){
      const list=[];
      S.snacks.forEach(id=>{ const s=SNACKS.find(x=>x.id===id); list.push(`<div class="item"><div class="t"><b>${s.name} <span class="mm muted">${s.my}</span></b><small>Snack tasted</small></div></div>`); });
      S.toys.forEach(id=>{ const s=TOYS.find(x=>x.id===id); list.push(`<div class="item"><div class="t"><b>${s.name}</b><small>Toy from the Kids Corner stall</small></div></div>`); });
      S.prizes.forEach(id=>{ const s=PRIZES.find(x=>x.id===id); list.push(`<div class="item"><div class="t"><b>${s.name}</b><small>Prize won with tickets</small></div></div>`); });
      body.innerHTML=list.length?`<div class="items">${list.join('')}</div>`:'<p class="muted">Nothing yet. Try a snack on Food Street, a toy in the Kids Corner, or win a prize at the Game Booths.</p>'; }
    if(bagTab==='photos'){ if(!S.photos.length){ body.innerHTML='<p class="muted">No photos yet. Press P (or the Photo button) anywhere, even on a ride, or visit the photo booth by the stage.</p>'; }
      else { const g=document.createElement('div'); g.className='photos'; S.photos.forEach(u=>{ const i=new Image(); i.src=u; i.alt='Fair photo'; g.appendChild(i); }); body.appendChild(g);
        const p=document.createElement('p'); p.className='muted'; p.textContent='To keep a photo, long-press or right-click it and save the image.'; body.appendChild(p);} }
    if(bagTab==='secrets'){ body.innerHTML='<div class="items">'+SECRETS.map(s=>S.secrets.includes(s.id)?`<div class="item"><div class="t"><b>${s.name}</b><small>${s.d}</small></div></div>`:`<div class="item"><div class="t"><b>???</b><small>A hidden detail somewhere in the fair. Look for a faint sparkle.</small></div></div>`).join('')+'</div>'; }
  }
  render(); wrap.appendChild(tabs); wrap.appendChild(body);
  openModal('Your bag',wrap);
}
function openSettings(){
  const wrap=document.createElement('div');
  const opt=(label: string, key: keyof Settings, vals: Array<[unknown,string]>, fn?: (v: any)=>void)=>{ const r=document.createElement('div'); r.className='opt'; r.innerHTML=`<span>${label}</span>`; const sg=document.createElement('div'); sg.className='seg';
    vals.forEach(([v,l])=>{ const b=document.createElement('button'); b.textContent=l; b.setAttribute('aria-pressed',String(S.settings[key]===v)); b.onclick=()=>{ (S.settings as unknown as Record<string, unknown>)[key]=v; saveSettings(); sg.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b))); fn&&fn(v); }; sg.appendChild(b); });
    r.appendChild(sg); wrap.appendChild(r); };
  opt('Crowd density','density',[['low','Low'],['med','Medium'],['high','High']],()=>spawnCrowd());
  opt('Graphics quality','gfx',[['low','Fast'],['high','Night lighting']]);
  opt('Camera','cam',[['close','Close'],['wide','Wide']]);
  opt('Mini map','mini',[[true,'Show'],[false,'Hide']],()=>syncChrome());
  opt('Sound','sound',[[true,'On'],[false,'Off']],v=>setSound(v));
  const ob=document.createElement('button'); ob.className='cta'; ob.textContent='Change outfit and name'; ob.style.marginTop='12px'; ob.onclick=()=>{ closeModal(); openAvatar(false); }; wrap.appendChild(ob);
  const k=document.createElement('div'); k.innerHTML=`<h3 style="font-family:var(--display);font-weight:400;font-size:15px;color:var(--gold);margin:16px 0 6px">Controls</h3>
  <table class="keys"><tr><td><b>WASD / arrows</b></td><td>Walk (hold Shift to hurry)</td></tr><tr><td><b>E / Space / Enter</b></td><td>Interact, throw, stop the meter</td></tr><tr><td><b>P</b></td><td>Photo mode</td></tr><tr><td><b>C</b></td><td>Close or wide camera</td></tr><tr><td><b>B</b></td><td>Open your bag</td></tr><tr><td><b>Q</b></td><td>Wave to other players</td></tr><tr><td><b>Esc</b></td><td>Close, leave a ride or game</td></tr></table>
  <p class="muted" style="font-size:13px">On a phone, drag the stick to walk and tap GO to interact. In balloon darts, tap where you want to aim.</p>`;
  wrap.appendChild(k);
  openModal('Settings',wrap);
}

// ---------- fireworks ----------
interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; drag: number; g: number; cross?: boolean; split?: boolean; px?: number; py?: number }
interface Shell { x: number; y: number; vx: number; vy: number; fuse: number; col: string; type: string }
const FWK: { p: Spark[]; shells: Shell[]; next: number } = {p:[],shells:[],next:0};
const FCOL=['#ff5a4e','#f4b63f','#3fc7a5','#ff8ad8','#8fb4ff','#ffffff','#ffd27a'];
function launch(cx?: number): void {
  const x=cx!=null?cx:rand(.12,.88)*VW;
  FWK.shells.push({x,y:VH*.95,vx:rand(-20,20),vy:-rand(VH*.75,VH*1.05),fuse:rand(.9,1.3),col:pick(FCOL),type:pick(['peony','peony','ring','willow','crossette'])});
  sfx('launch');
}
function burst(s){
  const n=s.type==='ring'?46:s.type==='willow'?70:64;
  for(let i=0;i<n;i++){
    const a=s.type==='ring'?i/n*TAU:rand(0,TAU), sp=s.type==='ring'?160:s.type==='willow'?rand(40,120):rand(60,200);
    FWK.p.push({x:s.x,y:s.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp*(s.type==='ring'?.6:1),life:s.type==='willow'?2.6:rand(1.1,1.7),max:2.6,col:s.type==='willow'?'#ffd27a':(Math.random()<.2?'#ffffff':s.col),drag:s.type==='willow'?1.6:1.1,g:s.type==='willow'?30:60,cross:s.type==='crossette'});
  }
  flashV=Math.min(1,flashV+.5);
  setTimeout(()=>{ sfx('boom'); if(Math.random()<.5) sfx('crackle'); },120+Math.random()*200);
}
function updFireworks(dt){
  if(S.showStarted&&!S.showDone){
    FWK.next-=dt; const rem=S.showT;
    if(FWK.next<=0){ const fin=rem<7; launch(); if(fin){ launch(); if(Math.random()<.6) launch(); } FWK.next=fin?rand(.12,.3):rand(.35,.95); }
  }
  if(S.mode==='scene'&&SC.kind==='finale'&&S.showDone&&SC.replay){ FWK.next-=dt; if(FWK.next<=0){ launch(); FWK.next=rand(.3,.8); } }
  for(let i=FWK.shells.length-1;i>=0;i--){ const s=FWK.shells[i]; s.x+=s.vx*dt; s.y+=s.vy*dt; s.vy+=320*dt; s.fuse-=dt; if(s.fuse<=0||s.vy>-40){ burst(s); FWK.shells.splice(i,1); } }
  for(let i=FWK.p.length-1;i>=0;i--){ const p=FWK.p[i]; p.vx*=Math.pow(.3,dt*p.drag); p.vy*=Math.pow(.3,dt*p.drag); p.vy+=p.g*dt; p.px=p.x; p.py=p.y; p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt;
    if(p.cross&&p.life<.8&&!p.split){ p.split=true; for(let k=0;k<4;k++){ const a=k/4*TAU+.6; FWK.p.push({x:p.x,y:p.y,vx:Math.cos(a)*70,vy:Math.sin(a)*70,life:.6,max:.6,col:p.col,drag:1.2,g:40}); } }
    if(p.life<=0) FWK.p.splice(i,1); }
  flashV=Math.max(0,flashV-dt*1.6);
}
function drawFireworks(c,alpha){
  c.save(); c.globalCompositeOperation='lighter'; c.lineCap='round';
  FWK.shells.forEach(s=>{ c.strokeStyle='rgba(255,220,160,.8)'; c.lineWidth=2; ln(c,s.x,s.y,s.x-s.vx*.04,s.y-s.vy*.04); });
  FWK.p.forEach(p=>{ const a=clamp(p.life/Math.min(p.max,1.2),0,1)*alpha; c.globalAlpha=a; c.strokeStyle=p.col; c.lineWidth=3.2; ln(c,p.px??p.x,p.py??p.y,p.x+(p.x-(p.px??p.x))*2.5,p.y+(p.y-(p.py??p.y))*2.5); c.fillStyle=p.col; c.globalAlpha=a*.25; circ(c,p.x,p.y,5); });
  c.restore(); c.globalAlpha=1;
}

// ---------- scenes (rides + finale) ----------
type SceneKind = 'ferris' | 'carousel' | 'pirate' | 'finale';
const SC: { kind: SceneKind | null; t: number; dur: number; replay?: boolean; topSaid?: boolean; wh?: boolean } = {kind:null,t:0,dur:0};
const RIDECAP={
  ferris:'Rising over the fair. Look for the Shwedagon Pagoda glowing on the skyline.',
  carousel:'Round and round on a painted horse. Wave at the crowd!',
  pirate:'Hold on tight, it swings higher each time.',
};
function buyRide(kind: SceneKind, price: number): void { if(!pay(price)) return; S.rides++; startScene(kind); updateHUD(); }
function startScene(kind: SceneKind): void {
  SC.kind=kind; SC.t=0; SC.dur={ferris:20,carousel:15,pirate:15,finale:9999}[kind]; SC.replay=false;
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
function endScene(){
  const k=SC.kind; S.mode='walk'; SC.kind=null; $('sceneBar').hidden=true;
  if(k==='ferris'||k==='carousel'||k==='pirate') toast('What a ride! Your ticket stub is a keepsake.');
  syncChrome(); updateHUD(); maybeSummary();
}
$('sceneExit').onclick=()=>{ if(S.mode==='scene') endScene(); else if(S.mode==='mg') endGame(); };
function skyBack(c: Ctx, horizon: number, off?: number): void {
  const g=c.createLinearGradient(0,0,0,horizon); g.addColorStop(0,'#080622'); g.addColorStop(.7,'#24124a'); g.addColorStop(1,'#4b2152');
  c.fillStyle=g; c.fillRect(0,0,VW,horizon+2);
  SKY.stars.forEach(([x,y,ph,s])=>{ c.fillStyle=`rgba(255,255,240,${.35+.4*Math.sin(T*1.5+ph)})`; c.fillRect(x*VW,y*horizon,1+s,1+s); });
  c.fillStyle='#fff6d6'; circ(c,VW*.82,horizon*.18,Math.min(VW,VH)*.035); c.fillStyle='#24124a'; circ(c,VW*.82+Math.min(VW,VH)*.012,horizon*.18-4,Math.min(VW,VH)*.03);
  const hh=Math.min(VH*.32,VW*.38);
  skyline(c,-VW*.1+(off||0)*.2,horizon-hh,VW*1.2,hh,true);
  c.fillStyle='#120c22'; c.fillRect(0,horizon,VW,VH-horizon);
  c.save(); c.globalCompositeOperation='lighter';
  SKY.bokeh.forEach(([x,y,ph,ci])=>{ const yy=horizon+12+y*(VH-horizon); const r=3+y*8; c.fillStyle=FCOL[ci]; c.globalAlpha=.18+.15*Math.sin(T*2+ph*9); circ(c,x*VW,yy,r); });
  c.restore(); c.globalAlpha=1;
}
function drawScene(dt){
  const k=SC.kind; SC.t+=dt; const t=SC.t;
  const m=Math.min(VW,VH);
  if(k==='ferris'){
    const R=m*.4, cx=VW/2, rot=-Math.PI/2+Math.PI+ t/SC.dur*TAU; // player cabin starts at bottom
    const pcy=VH*.55+Math.sin(rot)*R; const off=(VH*.5-pcy)*.35;
    skyBack(ctx,VH*.74+off*.5,0);
    ctx.save(); ctx.translate(0,off);
    const cy=VH*.55;
    ctx.strokeStyle='#7d82a3'; ctx.lineWidth=m*.025; ctx.lineCap='round'; ln(ctx,cx,cy,cx-R*.62,VH+40); ln(ctx,cx,cy,cx+R*.62,VH+40);
    ctx.strokeStyle='#9aa0bc'; ctx.lineWidth=2; for(let i=0;i<16;i++){ const a=rot+i/16*TAU; ln(ctx,cx,cy,cx+Math.cos(a)*R,cy+Math.sin(a)*R); }
    ctx.strokeStyle='#d5d9ee'; ctx.lineWidth=m*.012; ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.stroke();
    for(let i=0;i<48;i++){ const a=rot+i/48*TAU; ctx.fillStyle=FCOL[(i+Math.floor(T*6))%5]; circ(ctx,cx+Math.cos(a)*R,cy+Math.sin(a)*R,m*.007); }
    for(let i=0;i<12;i++){ const a=rot+i/12*TAU, px=cx+Math.cos(a)*R, py=cy+Math.sin(a)*R, isP=i===0, cw=m*.085, ch=m*.07;
      ctx.strokeStyle='#cfd3e8'; ctx.lineWidth=2; ln(ctx,px,py,px,py+ch*.3);
      ctx.fillStyle=isP?'#c23b4b':['#2d7bb6','#e0a526','#3a9b7a'][i%3]; rr(ctx,px-cw/2,py+ch*.3,cw,ch,8); ctx.fill();
      ctx.fillStyle='rgba(255,243,196,.85)'; ctx.fillRect(px-cw*.4,py+ch*.42,cw*.8,ch*.38);
      if(isP){ person(ctx,px,py+ch*.95,{...AV(),s:m*.0016*1.6,armsUp:Math.sin(rot)<-.8,t:T,balloon:S.balloon}); ctx.strokeStyle='#f4b63f'; ctx.lineWidth=3; rr(ctx,px-cw/2,py+ch*.3,cw,ch,8); ctx.stroke(); }
      else { ctx.fillStyle=SKINS[i%6]; circ(ctx,px-cw*.15,py+ch*.6,m*.009); circ(ctx,px+cw*.18,py+ch*.6,m*.009); }
    }
    ctx.fillStyle='#f4b63f'; circ(ctx,cx,cy,m*.03);
    ctx.restore();
    if(Math.sin(rot)<-.9 && !SC.topSaid){ SC.topSaid=true; $('sceneCap').textContent='Top of the wheel! The whole of Yangon sparkles below you.'; sfx('ding'); }
  }
  if(k==='pirate'){
    skyBack(ctx,VH*.76,0);
    const amp=1.05*Math.pow(Math.sin(Math.PI*clamp(t/SC.dur,0,1)),.6), th=amp*Math.sin(t*1.9);
    if(Math.abs(Math.cos(t*1.9))<.05&&amp>.7&&!SC.wh){ sfx('whee'); SC.wh=true; } if(Math.abs(Math.cos(t*1.9))>.3) SC.wh=false;
    const sc=m*.0028; ctx.fillStyle='#2a2238'; ctx.fillRect(VW/2-170*sc,VH*.22+160*sc*1+ 95*sc,340*sc,VH);
    shipDraw(ctx,VW/2,VH*.2,160*sc,th,sc,8,T);
  }
  if(k==='carousel'){
    skyBack(ctx,VH*.62,0);
    const sc=m*.0033; carouselDraw(ctx,VW/2,VH*.72,sc,t*.9,0,T);
  }
  if(k==='finale'){
    skyBack(ctx,VH*.8,0);
    drawFireworks(ctx,1);
    // crowd from behind
    const r=srng(5), n=Math.ceil(VW/34)+2, base=VH;
    for(let i=0;i<n;i++){ const x=i*34-10+r()*12, h=VH*.11+r()*VH*.03, isP=i===Math.floor(n/2);
      const bob=Math.sin(T*2+i)*2; const glow=flashV;
      ctx.fillStyle=isP?'#3a2a12':'#1a1230';
      rr(ctx,x-15,base-h+bob+18,30,h,12); ctx.fill(); circ(ctx,x,base-h+bob+6,11);
      ctx.strokeStyle=isP?`rgba(244,182,63,${.6+glow*.4})`:`rgba(255,200,230,${.12+glow*.5})`; ctx.lineWidth=isP?2.5:1.5; ctx.beginPath(); ctx.arc(x,base-h+bob+6,11,Math.PI,0); ctx.stroke();
      if(r()<.18&&(S.showStarted||SC.replay)){ ctx.fillStyle='#cfe3ff'; ctx.fillRect(x+6,base-h+bob-14,8,12); }
      if(r()<.12){ ctx.fillStyle='#1a1230'; circ(ctx,x+2,base-h+bob-14,7); }
      if(isP){ ctx.fillStyle='#f4b63f'; ctx.font='400 12px '+DISP; ctx.textAlign='center'; ctx.fillText('YOU',x,base-h+bob-14); }
    }
  }
  if(SC.dur<9999&&t>=SC.dur) endScene();
}

// ---------- mini games ----------
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
  S.games++; Object.keys(MG).forEach(k=>delete MG[k]);
  Object.assign(MG,{kind,t:0,won:0,done:false,fx:[]});
  if(kind==='ring'){ MG.left=5; MG.phase='aim'; MG.rings=[]; MG.bottles=[]; MG.flight=null; }
  if(kind==='darts'){ MG.left=6; MG.balloons=[]; MG.darts=[]; MG.aim={x:VW/2,y:VH*.42}; for(let r=0;r<4;r++) for(let c=0;c<7;c++) MG.balloons.push({r,c,col:BALLOONS[(r*3+c)%5],gold:(r===1&&c===5)||(r===3&&c===1),pop:false,ph:rand(0,9)}); }
  S.mode='mg'; $('prompt').hidden=true;
  setBar(kind==='ring'?'Stop the sweeping marker to aim, then stop the power bar. Gold bottle pays 8 tickets.':'Aim the wobbling crosshair and throw. Gold balloons pay 6 tickets.');
  syncChrome(); updateHUD();
}
function endGame(){ S.mode='walk'; $('sceneBar').hidden=true; if(MG.won) toast(`You won <b>${MG.won} tickets</b>. Spend them at the prize counter.`); syncChrome(); updateHUD(); }
function ringLayout(){
  const m=Math.min(VW,VH), cx=VW/2, top=VH*.3, B=[];
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
function wob(){ const m=Math.min(VW,VH)/700; return [Math.sin(MG.t*1.7)*22*m+Math.sin(MG.t*3.1)*8*m, Math.cos(MG.t*2.3)*16*m]; }
function drawMG(dt){
  MG.t+=dt; const m=Math.min(VW,VH)/700;
  const g=ctx.createLinearGradient(0,0,0,VH); g.addColorStop(0,'#2a1d4f'); g.addColorStop(1,'#140e2a'); ctx.fillStyle=g; ctx.fillRect(0,0,VW,VH);
  for(let k=0;k<Math.ceil(VW/60);k++){ ctx.fillStyle=k%2?'rgba(194,59,75,.25)':'rgba(255,243,214,.05)'; ctx.fillRect(k*60,0,60,VH*.62); }
  for(let k=0;k<Math.ceil(VW/40)+1;k++){ ctx.fillStyle=(k+Math.floor(T*3))%3?'#ffe7a3':'#ff5a4e'; circ(ctx,k*40+20,18+env(),4); }
  if(MG.kind==='ring'){
    const B=ringLayout();
    ctx.fillStyle='#6b4a2e'; ctx.beginPath(); ctx.moveTo(VW/2-260*m,VH*.24); ctx.lineTo(VW/2+260*m,VH*.24); ctx.lineTo(VW/2+380*m,VH*.68); ctx.lineTo(VW/2-380*m,VH*.68); ctx.fill();
    ctx.fillStyle='#4f3520'; ctx.fillRect(VW/2-380*m,VH*.68,760*m,30*m);
    MG.rings.filter(r=>!r.on).forEach(r=>{ ctx.strokeStyle='#ff5a4e'; ctx.lineWidth=4*r.sc; ctx.beginPath(); ctx.ellipse(r.x,r.y,16*r.sc,6*r.sc,0,0,TAU); ctx.stroke(); });
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
      if(MG.phase==='power'){ MG.pt+=dt; const p=(Math.sin(MG.pt*2.6-Math.PI/2)+1)/2; const bx=VW-50-env(), bh=VH*.4, by=VH*.3;
        ctx.fillStyle='rgba(0,0,0,.4)'; rr(ctx,bx,by,22,bh,8); ctx.fill(); const gg=ctx.createLinearGradient(0,by+bh,0,by); gg.addColorStop(0,'#3fc7a5'); gg.addColorStop(.6,'#f4b63f'); gg.addColorStop(1,'#ff5a4e'); ctx.fillStyle=gg; rr(ctx,bx+3,by+bh-p*bh,16,p*bh,6); ctx.fill();
        ctx.fillStyle='#fff'; ctx.font='600 12px '+BODY; ctx.textAlign='center'; ctx.fillText('POWER',bx+11,by-8); }
    }
    if(MG.flight){ const f=MG.flight; f.t+=dt/.75; const p=clamp(f.t,0,1);
      const x=lerp(f.sx,f.tx,p), y=lerp(f.sy,f.ty,p)-Math.sin(p*Math.PI)*VH*.22, sc=lerp(2.2,.9,p)*m;
      ctx.strokeStyle='#ff5a4e'; ctx.lineWidth=5*sc; ctx.beginPath(); ctx.ellipse(x,y,16*sc,6*sc+Math.sin(MG.t*20)*2,0,0,TAU); ctx.stroke();
      if(p>=1){ let best=null,bd=1e9; B.forEach(b=>{ const d=Math.hypot(b.x-f.tx,(b.y-48*b.sc)-f.ty)/b.sc; if(d<bd){bd=d;best=b;} });
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
    // keyboard aim
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
    ctx.fillStyle='#fff'; ctx.font='400 '+Math.round(16*Math.max(.8,m))+'px '+DISP; ctx.textAlign='left'; ctx.fillText(`DARTS ${MG.left}`,20+env(),VH*.72); ctx.fillText(`TICKETS +${MG.won}`,20+env(),VH*.72+24);
    ctx.textAlign='center'; ctx.font='600 15px '+BODY; ctx.fillStyle='#ffe7a3'; if(!MG.done) ctx.fillText(touchMode?'Tap the board to throw at that spot':'Move the mouse or arrow keys, click or Space to throw',VW/2,VH*.8);
  }
  MG.fx.forEach(f=>{ f.life-=dt; if(f.txt){ f.y-=40*dt; ctx.globalAlpha=clamp(f.life,0,1); ctx.fillStyle='#f4b63f'; ctx.font='400 22px '+DISP; ctx.textAlign='center'; ctx.fillText(f.txt,f.x,f.y); }
    else { f.x+=f.vx*dt; f.y+=f.vy*dt; f.vy+=400*dt; ctx.globalAlpha=clamp(f.life,0,1); ctx.fillStyle=f.col; ctx.fillRect(f.x,f.y,5,3); } });
  ctx.globalAlpha=1; MG.fx=MG.fx.filter(f=>f.life>0);
  if(MG.done){ ctx.fillStyle='rgba(13,10,36,.75)'; rr(ctx,VW/2-150,VH*.36,300,90,16); ctx.fill(); ctx.fillStyle='#f4b63f'; ctx.font='400 26px '+DISP; ctx.textAlign='center'; ctx.fillText(MG.won?`+${MG.won} TICKETS`:'NO LUCK',VW/2,VH*.36+42); ctx.fillStyle='#fff'; ctx.font='600 14px '+BODY; ctx.fillText(MG.won>=10?'The booth keeper cheers for you!':'Try another round?',VW/2,VH*.36+68); }
}
function env(){ return 0; }
function finishGame(){ MG.done=true; setBar(`Round over. You won ${MG.won} tickets (${S.tix} total).`,`Play again · ${ks(1000)}`,()=>{ const k=MG.kind; const w=MG.won; startGame(k); },'Leave'); }

// ---------- input ----------
const keys: Record<string, boolean> = {}; let touchMode=false;
window.addEventListener('keydown',e=>{
  if(S.mode==='title') return;
  keys[e.code]=true;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  if(e.repeat) return;
  if(!$('modal').hidden){ if(e.code==='Escape') closeModal(); return; }
  if(e.code==='Escape'){ if(S.photo) exitPhotoMode(); else if(S.mode==='scene') endScene(); else if(S.mode==='mg') endGame(); return; }
  if(e.code==='KeyE'||e.code==='Space'||e.code==='Enter'){ if(document.activeElement&&document.activeElement.tagName==='BUTTON'&&e.code!=='KeyE') return; press(); }
  if(e.code==='KeyP'){ S.photo?exitPhotoMode():enterPhotoMode(); }
  if(e.code==='KeyC'){ S.settings.cam=S.settings.cam==='close'?'wide':'close'; saveSettings(); }
  if(e.code==='KeyB'&&S.mode==='walk') openBag();
  if(e.code==='KeyQ'&&S.mode==='walk') wave();
  if(e.code==='KeyM'){ S.settings.mini=!S.settings.mini; saveSettings(); syncChrome(); }
});
window.addEventListener('keyup',e=>{ keys[e.code]=false; });
window.addEventListener('blur',()=>{ for(const k in keys) keys[k]=false; });
function press(){
  if(S.paused) return;
  if(S.mode==='walk'){ if(TR.riding) return; const it=nearIT(); if(it) it.act(); }
  else if(S.mode==='mg') mgPress();
}
cv.addEventListener('pointerdown',e=>{
  if(e.pointerType==='touch') setTouch(true);
  if(S.mode==='mg'){ if(MG.kind==='darts') mgPress(e.clientX,e.clientY); else mgPress(); }
});
cv.addEventListener('pointermove',e=>{ if(S.mode==='mg'&&MG.kind==='darts'&&e.pointerType==='mouse'){ MG.aim.x=e.clientX; MG.aim.y=e.clientY; } });
$('prompt').addEventListener('click',press);
$('act').addEventListener('pointerdown',e=>{ e.preventDefault(); press(); });
const joy: { x: number; y: number; id: number | null } = {x:0,y:0,id:null};
$('stick').addEventListener('pointerdown',e=>{ joy.id=e.pointerId; $('stick').setPointerCapture(e.pointerId); moveJoy(e); });
$('stick').addEventListener('pointermove',e=>{ if(e.pointerId===joy.id) moveJoy(e); });
const endJoy=e=>{ if(e.pointerId!==joy.id) return; joy.id=null; joy.x=joy.y=0; $('knob').style.transform=''; };
$('stick').addEventListener('pointerup',endJoy); $('stick').addEventListener('pointercancel',endJoy);
function moveJoy(e){ const r=$('stick').getBoundingClientRect(); let dx=e.clientX-(r.left+r.width/2), dy=e.clientY-(r.top+r.height/2); const d=Math.hypot(dx,dy), mxd=r.width/2-10; if(d>mxd){dx=dx/d*mxd;dy=dy/d*mxd;} joy.x=dx/mxd; joy.y=dy/mxd; $('knob').style.transform=`translate(${dx}px,${dy}px)`; }
function setTouch(on){ if(touchMode===on) return; touchMode=on; document.body.classList.toggle('touch',on); syncChrome(); }
if(window.matchMedia&&matchMedia('(pointer:coarse)').matches) touchMode=true;
document.body.classList.toggle('touch',touchMode);

$('bBag').onclick=()=>{ if(S.mode==='walk') openBag(); };
$('bPhoto').onclick=()=>enterPhotoMode();
$('bCam').onclick=()=>{ S.settings.cam=S.settings.cam==='close'?'wide':'close'; saveSettings(); };
$('bSet').onclick=openSettings;
$('bAv').onclick=()=>{ if(S.mode==='walk') openAvatar(false); };
$('bWave').onclick=()=>wave();
$('waveT').addEventListener('pointerdown',e=>{ e.preventDefault(); wave(); });
$('bSound').onclick=()=>{ audioInit(S.settings.sound); setSound(!S.settings.sound); };

function syncChrome(){
  const playing=S.mode!=='title', ph=!!S.photo;
  $('hud').hidden=!playing||ph||S.mode==='scene'&&SC.kind!=='finale'&&false;
  $('tools').hidden=!playing||ph;
  $('mini').hidden=!playing||ph||S.mode!=='walk'||!S.settings.mini;
  $('touch').hidden=!playing||ph||!touchMode||S.mode!=='walk';
  $('sceneBar').hidden=ph||!(S.mode==='scene'||S.mode==='mg');
  if(S.mode!=='walk'||ph) $('prompt').hidden=true;
  $<HTMLButtonElement>('bBag').disabled=S.mode!=='walk';
  $('photoHide').hidden=S.mode!=='walk';
  document.body.classList.toggle('inplay',S.mode==='scene'||S.mode==='mg');
  $('vfText').textContent=S.mode==='scene'?'PHOTO MODE · ON THE RIDE':'PHOTO MODE';
}

// ---------- interaction & discovery ----------
function nearIT(){ let best=null,bd=1e9; for(const it of IT){ const d=Math.hypot(P.x-it.x,P.y-it.y); if(d<it.r&&d<bd){bd=d;best=it;} } return best; }
let lastIT=null;
function checkWorld(){
  for(const z of ZONES){ if(!S.zones.includes(z.id)&&P.x>z.x&&P.x<z.x+z.w&&P.y>z.y&&P.y<z.y+z.h){ S.zones.push(z.id); sfx('ding');
    toast(`<span class="z">${String(z.n).padStart(2,'0')} · ${z.name}</span><span class="mm">${z.my}</span>Postcard collected (${S.zones.length}/8)`,true); updateHUD(); } }
  for(const s of SECRETS){ if(!S.secrets.includes(s.id)&&Math.hypot(P.x-s.x,P.y-s.y)<46){ S.secrets.push(s.id); S.kyat+=300; sfx('ding'); toast(`Secret found: <b>${s.name}</b><br>${s.d} <span class="muted">(+300 Ks)</span>`); updateHUD(); } }
  const it=(S.mode==='walk'&&!TR.riding&&!S.photo)?nearIT():null;
  if(it!==lastIT||it){ if(it){ $('prompt').innerHTML=`<span class="key">${touchMode?'GO':'E'}</span>${it.label()}`; $('prompt').hidden=false; } else $('prompt').hidden=true; lastIT=it; }
}
function maybeSummary(){
  if(!S.showDone||S.summaryShown||S.mode!=='walk') return;
  S.summaryShown=true; S.finaleSeen=true; updateHUD();
  openModal('What a night!',`<p>The last sparks drift over the skyline. Here is your Yay Kyaw night:</p>
  <div class="statgrid"><div><b>${S.zones.length}/8</b>Postcards</div><div><b>${S.secrets.length}/6</b>Secrets</div><div><b>${S.snacks.length}/6</b>Snacks tasted</div><div><b>${S.rides}</b>Rides</div><div><b>${S.ticketsWon}</b>Tickets won</div><div><b>${S.prizes.length+S.toys.length}</b>Souvenirs</div><div><b>${S.photos.length}</b>Photos</div></div>
  <p class="muted">The fair stays open. Keep exploring, find the rest of the secrets, or watch the finale again from the Finale View deck.</p>`);
}

// ---------- main loop ----------
let last=performance.now(), chatT=0;
function frame(now){
  const dt=Math.min(.05,(now-last)/1000); last=now; T+=dt;
  ctx.setTransform(DPR,0,0,DPR,0,0);
  if(S.mode!=='title'&&!S.paused){
    S.clock=Math.min(23*60,S.clock+dt/2);
    if(!S.showStarted&&S.clock>=21*60+30){ S.showStarted=true; S.showT=42; toast('<span class="z">Fireworks!</span>The finale has begun. The Finale View deck has the best seat.',true); if(S.mode==='scene'&&SC.kind==='finale') setBar('The fireworks finale has begun! Press P to take a photo.'); updateHUD(); }
    if(S.showStarted&&!S.showDone){ S.showT-=dt; if(S.showT<=0){ S.showDone=true; if(S.mode==='scene'&&SC.kind==='finale'){ S.finaleSeen=true; setBar('That was beautiful. Stay for an encore, or head back to the fair.','Encore',()=>{ SC.replay=true; $('sceneAlt').hidden=true; },'Back to the fair'); } else maybeSummary(); updateHUD(); } }
    if(S.mode==='scene'&&SC.kind==='finale'&&S.showStarted) S.finaleSeen=S.finaleSeen||S.showDone;
  }
  updFireworks(dt);
  if(S.mode==='scene') drawScene(dt);
  else if(S.mode==='mg') drawMG(dt);
  else drawWorld(dt);
  // music volume by distance to stage
  sendPresence(dt);
  chatT-=dt; if(chatT<=0){ chatT=.5; let n=0; if(S.mode==='walk'){ for(const q of NPC) if(Math.abs(q.x-P.x)<280&&Math.abs(q.y-P.y)<280) n++; n+=REMOTE.size; } setChatter(S.mode==='walk'?.25+.75*Math.min(1,n/12):S.mode==='title'?0:.2); }
  if(A.c&&A.music){ let v=0; if(S.mode==='walk'||S.mode==='title'){ const d=Math.hypot(P.x-ST.x,P.y-ST.y); v=.03+.5*clamp(1-d/650,0,1); } else if(S.mode==='scene'&&SC.kind==='carousel') v=.45; else v=.06;
    A.music.gain.setTargetAtTime(v,A.c.currentTime,.3); if(A.amb) A.amb.gain.setTargetAtTime(S.mode==='walk'?.22:.1,A.c.currentTime,.4); }
  if((T*10|0)%3===0) $('clock').textContent=fmtClock(S.clock);
  requestAnimationFrame(frame);
}
function w2s(x: number, y: number): [number, number] { return [(x-camX)*zoom+VW/2,(y-camY)*zoom+VH/2]; }
function drawWorld(dt){
  // player movement
  if(S.mode==='walk'&&!S.paused){
    if(TR.riding){
      TR.rideU+=dt*.55; const [x,y]=trackPos(TR.u-.32); P.x=x; P.y=y;
      if(TR.rideU>=TAU){ TR.riding=false; P.hidden=false; P.x=TR.cx; P.y=TR.cy+TR.ry+90; toast('Toot toot! Thanks for riding the mini train.'); }
    } else {
      let ix=0,iy=0; if(keys.ArrowLeft||keys.KeyA) ix--; if(keys.ArrowRight||keys.KeyD) ix++; if(keys.ArrowUp||keys.KeyW) iy--; if(keys.ArrowDown||keys.KeyS) iy++;
      if(joy.id!=null){ ix=joy.x; iy=joy.y; }
      const mag=Math.hypot(ix,iy);
      if(mag>.15){ const sp=(keys.ShiftLeft||keys.ShiftRight||mag>.95&&joy.id!=null?210:135)*Math.min(1,mag)/mag;
        const nx=P.x+ix*sp*dt, ny=P.y+iy*sp*dt; if(!blocked(nx,P.y,6)) P.x=nx; if(!blocked(P.x,ny,6)) P.y=ny; P.moving=true; if(Math.abs(ix)>.1) P.face=ix>0?1:-1; }
      else P.moving=false;
    }
  }
  TR.u+=dt*.55;
  NPC.forEach(n=>updateNPC(n,dt));
  updateBikes(dt);
  // camera
  const baseZ=clamp(Math.min(VW,VH)/620,.75,1.7)*(S.settings.cam==='wide'?.62:1);
  zoom=lerp(zoom,baseZ,Math.min(1,dt*4));
  const halfW=VW/2/zoom, halfH=VH/2/zoom;
  let tx=P.x, ty=P.y-20; if(S.mode==='title'){ tx=900+Math.sin(T*.05)*200; ty=2000-((T*18)%1400); }
  camX=lerp(camX,tx,Math.min(1,dt*5)); camY=lerp(camY,ty,Math.min(1,dt*5));
  camX=WW>halfW*2?clamp(camX,halfW-60,WW-halfW+60):WW/2; camY=clamp(camY,halfH-260,WH-halfH+40);
  const vx0=camX-halfW-120, vx1=camX+halfW+120, vy0=camY-halfH-60, vy1=camY+halfH+220;
  ctx.fillStyle='#120e1a'; ctx.fillRect(0,0,VW,VH);
  ctx.save(); ctx.translate(VW/2,VH/2); ctx.scale(zoom,zoom); ctx.translate(-camX,-camY);
  if(vy0<NORTH+20) drawNorth();
  // ground
  ctx.fillStyle='#211a29'; ctx.fillRect(0,NORTH+4,WW,WH-NORTH-4);
  ZONES.forEach(z=>{ ctx.fillStyle=z.g; rr(ctx,z.x,z.y,z.w,z.h,18); ctx.fill(); ctx.strokeStyle='rgba(255,220,160,.08)'; ctx.lineWidth=2; ctx.setLineDash([10,8]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle='rgba(255,231,163,.06)'; ctx.font='400 64px '+DISP; ctx.textAlign=z.x<ROAD.x?'left':'right'; ctx.textBaseline='bottom'; ctx.fillText(String(z.n).padStart(2,'0'),z.x<ROAD.x?z.x+16:z.x+z.w-16,z.y+z.h-6); });
  ctx.fillStyle='#2f2a38'; ctx.fillRect(ROAD.x,NORTH+4,ROAD.w,WH-NORTH);
  ctx.fillStyle='rgba(255,255,255,.035)'; for(let y=Math.max(NORTH,Math.floor(vy0/40)*40);y<vy1;y+=40){ ctx.fillRect(ROAD.x,y,ROAD.w,1.5); for(let x=ROAD.x+((y/40)%2?20:0);x<ROAD.x+ROAD.w;x+=40) ctx.fillRect(x,y,1.5,40); }
  ctx.fillStyle='#4a4058'; ctx.fillRect(ROAD.x-4,NORTH+4,4,WH); ctx.fillRect(ROAD.x+ROAD.w,NORTH+4,4,WH);
  // train track
  ctx.strokeStyle='#5a5070'; ctx.lineWidth=2; ctx.beginPath(); ctx.ellipse(TR.cx,TR.cy,TR.rx-5,TR.ry-5,0,0,TAU); ctx.stroke(); ctx.beginPath(); ctx.ellipse(TR.cx,TR.cy,TR.rx+5,TR.ry+5,0,0,TAU); ctx.stroke();
  ctx.strokeStyle='#3e3428'; ctx.lineWidth=3; for(let i=0;i<48;i++){ const a=i/48*TAU, c=Math.cos(a), s=Math.sin(a); ln(ctx,TR.cx+c*(TR.rx-9),TR.cy+s*(TR.ry-9),TR.cx+c*(TR.rx+9),TR.cy+s*(TR.ry+9)); }
  ctx.fillStyle='#2a3a2e'; el(ctx,TR.cx,TR.cy,TR.rx-30,TR.ry-26); ctx.fillStyle='#3a5a3e'; for(let i=0;i<7;i++) circ(ctx,TR.cx-120+i*40,TR.cy+Math.sin(i)*30,12);
  // sortables
  const tags: Array<[number,number,string,boolean]> = [];
  const list: Array<{ y: number; draw?: (c: Ctx) => void; n?: Npc; car?: number; x?: number; player?: boolean; bike?: Bike; remote?: Remote }> = [];
  for(const d of DRAW) if(d.y>vy0-40&&d.y<vy1+120&&d.x1>vx0&&d.x0<vx1) list.push(d);
  for(const n of NPC) if(n.x>vx0&&n.x<vx1&&n.y>vy0&&n.y<vy1) list.push({y:n.y,n});
  for(let i=0;i<4;i++){ const [x,y]=trackPos(TR.u-i*.16); list.push({y,car:i,x}); }
  if(!P.hidden) list.push({y:P.y,player:true});
  for(const b of BIKES) if(b.y>vy0&&b.y<vy1+40&&b.x>vx0&&b.x<vx1) list.push({y:b.y,bike:b});
  for(const r of REMOTE.values()){ const k=Math.min(1,dt*8); r.moving=Math.hypot(r.tx-r.x,r.ty-r.y)>1.5; r.x=lerp(r.x,r.tx,k); r.y=lerp(r.y,r.ty,k);
    if((r.where==='walk'||r.where==='train')&&r.x>vx0&&r.x<vx1&&r.y>vy0&&r.y<vy1) list.push({y:r.y,remote:r}); }
  list.sort((a,b)=>a.y-b.y);
  for(const d of list){
    if(d.draw) d.draw(ctx);
    else if(d.n){ const n=d.n; const st=n.moving?Math.sin(T*11+n.ph)*1.6:0; person(ctx,n.x,n.y,{s:n.s,shirt:n.shirt,lon:n.lon,skin:n.skin,step:st,bob:n.moving?-Math.abs(st)*.8:0,bun:n.bun,balloon:n.balloon,t:T+n.ph,face:n.face}); }
    else if(d.car!=null){ const [x,y]=[d.x,d.y]; const col=d.car===0?'#c23b4b':['#2d7bb6','#e0a526','#3a9b7a'][d.car-1];
      ctx.fillStyle='rgba(0,0,0,.3)'; el(ctx,x,y,15,5); ctx.fillStyle=col; rr(ctx,x-14,y-20,28,18,4); ctx.fill(); ctx.fillStyle='#1b1420'; circ(ctx,x-8,y-2,4); circ(ctx,x+8,y-2,4);
      if(d.car===0){ ctx.fillStyle='#2a2238'; ctx.fillRect(x-4,y-32,8,12); ctx.fillStyle='#ffe7a3'; circ(ctx,x,y-12,3); if(Math.random()<.2) PART.push({k:'steam',x,y:y-34,vx:rand(-5,5),vy:-25,life:1.4,max:1.4}); }
      else { const isP=TR.riding&&d.car===2; if(isP) person(ctx,x,y-8,{...AV(),s:.8,hl:true,t:T,balloon:S.balloon}); else if(d.car!==3){ ctx.fillStyle=SKINS[d.car]; circ(ctx,x-5,y-24,4); circ(ctx,x+6,y-23,3); } } }
    else if(d.player){ const st=P.moving?Math.sin(T*12)*1.8:0; person(ctx,P.x,P.y,{...AV(),step:st,bob:P.moving?-Math.abs(st)*.8:0,hl:true,t:T,balloon:S.balloon,fan:S.fan,face:P.face,armsUp:T<P.waveUntil}); if(S.settings.name) tags.push([P.x,P.y-62,S.settings.name,true]); }
    else if(d.bike) drawBike(ctx,d.bike);
    else if(d.remote){ const r=d.remote; const st=r.moving?Math.sin(T*12+r.x)*1.8:0; person(ctx,r.x,r.y,{...avatarOpts(r.av),step:st,bob:r.moving?-Math.abs(st)*.8:0,t:T,balloon:r.balloon,face:r.face,armsUp:T<r.waveUntil}); tags.push([r.x,r.y-50,r.name||'Player',false]); }
  }
  // particles
  if(Math.random()<dt*6){ const c=pick(CARTS); PART.push({k:'steam',x:c[0]+rand(-30,30),y:c[1]-40,vx:rand(-4,4),vy:-18,life:2,max:2}); }
  if(Math.random()<dt*2.5){ PART.push({k:'note',x:ST.x+rand(-150,150),y:ST.y-60,vx:rand(-10,10),vy:-28,life:2.6,max:2.6,ch:pick(['♪','♫'])}); }
  for(let i=PART.length-1;i>=0;i--){ const p=PART[i]; p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt; if(p.life<=0){ PART.splice(i,1); continue; }
    const a=p.life/p.max;
    if(p.k==='steam'){ ctx.fillStyle=`rgba(255,255,255,${.18*a})`; circ(ctx,p.x,p.y,6+(1-a)*8); }
    if(p.k==='note'){ ctx.fillStyle=`rgba(255,215,130,${a})`; ctx.font='16px sans-serif'; ctx.textAlign='center'; ctx.fillText(p.ch,p.x+Math.sin(p.life*4)*5,p.y); }
    if(p.k==='heart'){ ctx.fillStyle=`rgba(255,120,150,${a})`; circ(ctx,p.x,p.y,2.5); } }
  // lantern strings over everything
  STRINGS.forEach((y,si)=>{ if(y<vy0-40||y>vy1+40) return;
    ctx.strokeStyle='#4a4058'; ctx.lineWidth=3; ln(ctx,ROAD.x-2,y+40,ROAD.x-2,y-40); ln(ctx,ROAD.x+ROAD.w+2,y+40,ROAD.x+ROAD.w+2,y-40);
    ctx.strokeStyle='rgba(30,25,40,.9)'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(ROAD.x,y-40); ctx.quadraticCurveTo(900,y+10,ROAD.x+ROAD.w,y-40); ctx.stroke();
    for(let k=1;k<8;k++){ const t=k/8, lx0=lerp(ROAD.x,ROAD.x+ROAD.w,t), ly=(1-t)*(1-t)*(y-40)+2*(1-t)*t*(y+10)+t*t*(y-40); const sw=Math.sin(T*1.4+k+si)*1.5;
      const col=['#ff5a4e','#f4b63f','#ff8ad8','#ff5a4e','#3fc7a5','#f4b63f','#ff5a4e'][k-1];
      ctx.fillStyle=col; el(ctx,lx0+sw,ly+8,6,7.5); ctx.fillStyle='rgba(255,240,200,.75)'; el(ctx,lx0+sw,ly+8,2.5,4); ctx.fillStyle='#2a1606'; ctx.fillRect(lx0+sw-3,ly,6,2); ctx.fillRect(lx0+sw-2,ly+15,4,2); } });
  for(const [x,y,n,me] of tags) nameTag(ctx,x,y,n,me);
  ctx.restore();
  // lighting
  const night=clamp((S.clock-(18*60+30))/60,0,1);
  const dark=(S.mode==='title'?.5:.3+.32*night)*(1-flashV*.35);
  if(S.settings.gfx==='high') drawLighting(dark); else { ctx.fillStyle=`rgba(8,6,28,${dark*.6})`; ctx.fillRect(0,0,VW,VH); }
  if(S.showStarted&&!S.showDone||FWK.p.length) drawFireworks(ctx,.85);
  if(flashV>0){ ctx.fillStyle=`rgba(255,220,240,${flashV*.08})`; ctx.fillRect(0,0,VW,VH); }
  if(S.mode==='walk'){ checkWorld(); if(S.settings.mini&&!S.photo) drawMini(); }
}
function drawLighting(dark){
  const sc=.5, lw=lightC.width, lh=lightC.height;
  lx.globalCompositeOperation='source-over'; lx.clearRect(0,0,lw,lh);
  lx.fillStyle=`rgba(8,6,28,${dark})`; lx.fillRect(0,0,lw,lh);
  lx.globalCompositeOperation='destination-out';
  const L=LIGHTS.concat([{x:P.x,y:P.y-20,r:110},{x:trackPos(TR.u)[0],y:trackPos(TR.u)[1],r:70,c:'#ffe7a3'}]);
  const vis=[];
  for(const l of L){ const [sx,sy]=w2s(l.x,l.y), r=l.r*zoom; if(sx+r<0||sx-r>VW||sy+r<0||sy-r>VH) continue; vis.push([sx,sy,r,l.c]);
    const g=lx.createRadialGradient(sx*sc,sy*sc,0,sx*sc,sy*sc,r*sc); g.addColorStop(0,'rgba(0,0,0,.95)'); g.addColorStop(.5,'rgba(0,0,0,.55)'); g.addColorStop(1,'rgba(0,0,0,0)'); lx.fillStyle=g; lx.fillRect(sx*sc-r*sc,sy*sc-r*sc,r*sc*2,r*sc*2); }
  ctx.drawImage(lightC,0,0,VW,VH);
  ctx.globalCompositeOperation='lighter';
  for(const [sx,sy,r,c] of vis){ if(!c) continue; const g=ctx.createRadialGradient(sx,sy,0,sx,sy,r*.7); g.addColorStop(0,hexA(c,.16)); g.addColorStop(1,hexA(c,0)); ctx.fillStyle=g; ctx.fillRect(sx-r,sy-r,r*2,r*2); }
  ctx.globalCompositeOperation='source-over';
}
function drawMini(){
  const w=mini.width, h=mini.height, s=w/WW;
  mx.clearRect(0,0,w,h); mx.fillStyle='#1a1430'; mx.fillRect(0,0,w,h);
  mx.fillStyle='#0f1838'; mx.fillRect(0,0,w,NORTH*s);
  mx.fillStyle='#3a3350'; mx.fillRect(ROAD.x*s,NORTH*s,ROAD.w*s,h);
  ZONES.forEach(z=>{ const has=S.zones.includes(z.id); mx.fillStyle=has?'rgba(244,182,63,.35)':'rgba(255,255,255,.08)'; rr(mx,z.x*s,z.y*s,z.w*s,z.h*s,6); mx.fill();
    mx.fillStyle=has?'#ffe7a3':'rgba(255,255,255,.4)'; mx.font='700 18px '+BODY; mx.textAlign='center'; mx.textBaseline='middle'; mx.fillText(String(z.n),(z.x+z.w/2)*s,(z.y+z.h/2)*s); });
  mx.fillStyle='#3fc7a5'; for(const r of REMOTE.values()){ mx.beginPath(); mx.arc(r.x*s,r.y*s,5,0,TAU); mx.fill(); }
  mx.fillStyle='#ff5a4e'; mx.beginPath(); mx.arc(P.x*s,P.y*s,6,0,TAU); mx.fill(); mx.strokeStyle='#fff'; mx.lineWidth=2; mx.stroke();
}

// ---------- boot ----------
function startGameFlow(){
  $('title').hidden=true; S.mode='walk'; audioInit(S.settings.sound); setSound(S.settings.sound);
  P.x=900; P.y=2545; camX=P.x; camY=P.y-200;
  syncChrome(); updateHUD();
  const welcome=()=>{ setTimeout(()=>toast(`<span class="z">Welcome${S.settings.name?', '+esc(S.settings.name):''}!</span>Eight zones, six hidden secrets, and fireworks at 9:30 PM.`,true),300); };
  if(!S.settings.avDone) openAvatar(true,welcome); else welcome();
}
$('start').onclick=startGameFlow;

function snapshot(): unknown { return {S:JSON.parse(JSON.stringify({...S,paused:false,photo:false})),P:{x:P.x,y:P.y}}; }
function boot(data: any): void {
  if(data&&data.S){ const keep=data.S; Object.assign(S,keep); S.paused=false; S.photo=false; if(data.P){P.x=data.P.x;P.y=data.P.y;}
    if(S.mode!=='title'){ $('title').hidden=true; if(S.mode!=='walk') S.mode='walk'; camX=P.x; camY=P.y; } }
  spawnCrowd(); spawnBikes(); setSound(S.settings.sound); syncChrome(); updateHUD(); initRoom(); loadFonts();
  requestAnimationFrame(t=>{ last=t; frame(t); });
}
try{ window.claude?.hot?.snapshot?.(snapshot); }catch{ /* no viewer */ }
const hot=window.claude&&window.claude.hot;
if(hot&&hot.ready) hot.ready(boot); else boot(hot&&hot.data||{});
// audio needs a gesture; also unlock on first tap after a reload
window.addEventListener('pointerdown',()=>{ if(S.mode!=='title'){ audioInit(S.settings.sound); if(A.c&&A.c.state==='suspended') A.c.resume(); } },{once:false});
window.__ykn={S,P,startScene,startGame,TR,syncPeers,BIKES};
