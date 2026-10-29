// The fair in 3D (Three.js). Game logic lives in main.ts and works in map units;
// this module builds the scene once and mirrors the game state into it every frame.
import * as THREE from 'three';
import { TAU, srng, rand, pick, clamp, lerp, MMF, BODY, DISP } from './util';
import { PersonOpts, bodyProfile } from './people';
import { SHOPS, PWE_SHOPS, Shop, mmNum } from './shops';
import {
  M, WW, WH, NORTH, ROAD, ZONES, FW, CR, PS, KIDS, TRAIN, STATION, TRAIN_OFF, TRACK_LEN, ST, FV, PHOTO, TOYS_AT, ARCH_Y, SNACKS, CARTS, TEA_TABLES, BOOTHS, SECRETS,
  STRINGS, TREES, POND, WISH_STALL, BUMPER, HAND_WHEEL, SWINGER, PWE_FOOD, CANDLE, CANDLE_N, FLOWER_N, TEA, TEA_TABS, teaStools, RESTROOMS, PARKED, QUEUES, QUEUE_GAP, trackPos,
} from './layout';

// ---------------------------------------------------------------- basics
let renderer: THREE.WebGLRenderer;
const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 900);
const hemi = new THREE.HemisphereLight('#6f5aa8', '#22182c', 1.4);
const moonLight = new THREE.DirectionalLight('#8fa6ff', 0.55);
const sunLight = new THREE.DirectionalLight('#fff4e0', 0);
const ambient = new THREE.AmbientLight('#4a3a6a', 0.5);
// morning, afternoon, evening and night: what changes with the clock
const tod = {
  daySky: null as THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> | null, stars: null as THREE.Points | null, moon: null as THREE.Sprite | null, sun: null as THREE.Sprite | null,
  clouds: null as THREE.Group | null, halo: null as THREE.Sprite | null, city: [] as THREE.MeshBasicMaterial[],
  ground: [] as Array<{ m: THREE.MeshLambertMaterial; night: THREE.Color; day: THREE.Color }>, last: -1,
};
function groundTint(m: THREE.MeshLambertMaterial, night: string, day: string): void { tod.ground.push({ m, night: new THREE.Color(night), day: new THREE.Color(day) }); }
const X = (x: number) => x * M, Z = (y: number) => y * M;

const matCache = new Map<string, THREE.Material>();
function lam(col: string, extra?: THREE.MeshLambertMaterialParameters & { k?: string }): THREE.MeshLambertMaterial {
  const key = 'l' + col + (extra?.k || '');
  let m = matCache.get(key) as THREE.MeshLambertMaterial;
  if (!m) { const { k: _k, ...rest } = extra || {}; m = new THREE.MeshLambertMaterial({ color: col, ...rest }); matCache.set(key, m); }
  return m;
}
function glowMat(col: string): THREE.MeshBasicMaterial {
  const key = 'b' + col; let m = matCache.get(key) as THREE.MeshBasicMaterial;
  if (!m) { m = new THREE.MeshBasicMaterial({ color: col }); matCache.set(key, m); }
  return m;
}
function add<T extends THREE.Object3D>(o: T, parent: THREE.Object3D, x = 0, y = 0, z = 0): T { o.position.set(x, y, z); parent.add(o); return o; }
function box(w: number, h: number, d: number, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Mesh {
  return add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), parent, x, y, z);
}
function cyl(rt: number, rb: number, h: number, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0, seg = 16): THREE.Mesh {
  return add(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat), parent, x, y, z);
}
function sphere(r: number, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0, seg = 16): THREE.Mesh {
  return add(new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.75 | 0)), mat), parent, x, y, z);
}
function cone(r: number, h: number, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0, seg = 10): THREE.Mesh {
  return add(new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat), parent, x, y, z);
}
/** A beam between two points. */
function beam(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material, parent: THREE.Object3D): THREE.Mesh {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  parent.add(m); return m;
}
function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, repeat = false): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'));
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
function stripes(a: string, b: string, n = 8): THREE.CanvasTexture {
  return canvasTex(128, 16, c => { for (let i = 0; i < n; i++) { c.fillStyle = i % 2 ? b : a; c.fillRect(i * 128 / n, 0, 128 / n + 1, 16); } });
}
/** A lit sign board with Myanmar text over English. */
function signTex(my: string, en: string, bg = '#7a1f2b', w = 512, h = 192): THREE.CanvasTexture {
  return canvasTex(w, h, c => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#f4b63f'; c.lineWidth = 10; c.strokeRect(5, 5, w - 10, h - 10);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#fff3d6'; c.font = `700 ${h * 0.3}px ${MMF}`; c.fillText(my, w / 2, h * 0.4, w - 30);
    c.fillStyle = '#f4d58a'; c.font = `700 ${h * 0.17}px ${BODY}`; c.fillText(en.toUpperCase(), w / 2, h * 0.78, w - 30);
  });
}
function board(tex: THREE.Texture, w: number, h: number, parent: THREE.Object3D, x: number, y: number, z: number, ry = 0): THREE.Mesh {
  // two single-sided planes back to back, so the text reads correctly from both sides
  const g = new THREE.PlaneGeometry(w, h), mat = new THREE.MeshBasicMaterial({ map: tex });
  const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.rotation.y = ry; parent.add(m);
  const back = new THREE.Mesh(g, mat); back.rotation.y = Math.PI; back.position.z = -0.01; m.add(back);
  return m;
}

// ---------------------------------------------------------------- glows (lanterns, bulbs) as one point cloud
const glowSprite = canvasTex(64, 64, c => {
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.65)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
});
function makeGlows(pts: Array<[number, number, number, string, number?]>, size: number): THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> {
  const pos = new Float32Array(pts.length * 3), col = new Float32Array(pts.length * 3), c = new THREE.Color();
  pts.forEach(([x, y, z, k, i = 1], n) => { pos.set([x, y, z], n * 3); c.set(k).multiplyScalar(i); col.set([c.r, c.g, c.b], n * 3); });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size, map: glowSprite, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
}
const GLOWS: Array<[number, number, number, string, number?]> = [];
const LANTERN_COLS = ['#ff5a4e', '#f4b63f', '#ff8ad8', '#3fc7a5', '#ffd27a'];

// ---------------------------------------------------------------- people
export interface Rig {
  g: THREE.Group; body: THREE.Group; armL: THREE.Group; armR: THREE.Group; footL: THREE.Mesh; footR: THREE.Mesh;
  balloon: THREE.Group; key: string;
  ph?: number; amp?: number; // stride phase and how far into the walk cycle we have blended
}
const GEO = {
  longyi: new THREE.CylinderGeometry(0.25, 0.28, 0.7, 14),
  htamein: new THREE.CylinderGeometry(0.22, 0.32, 0.74, 14),
  torso: new THREE.CapsuleGeometry(0.24, 0.24, 4, 12),
  torsoSlim: new THREE.CapsuleGeometry(0.215, 0.22, 4, 12),
  jacket: new THREE.CylinderGeometry(0.255, 0.26, 0.42, 16, 1, true, 0.4, TAU - 0.8),
  head: new THREE.SphereGeometry(0.23, 16, 12),
  hair: new THREE.SphereGeometry(0.245, 16, 8, 0, TAU, 0, Math.PI / 2),
  arm: new THREE.CapsuleGeometry(0.065, 0.36, 3, 6),
  foot: new THREE.BoxGeometry(0.12, 0.08, 0.22),
  shadow: new THREE.CircleGeometry(0.4, 16),
  eye: new THREE.SphereGeometry(0.025, 6, 4),
  dot: new THREE.CircleGeometry(0.055, 10),
  bun: new THREE.SphereGeometry(0.1, 10, 8),
  hat: new THREE.ConeGeometry(0.48, 0.26, 18),
  balloon: new THREE.SphereGeometry(0.22, 12, 10),
};
const shadowMat = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.35, depthWrite: false });
const longyiTexCache = new Map<string, THREE.Texture>();
function longyiMat(col: string, pat: string | undefined): THREE.Material {
  const key = col + (pat || 'plain');
  let t = longyiTexCache.get(key);
  if (!t) {
    t = canvasTex(64, 64, c => {
      c.fillStyle = col; c.fillRect(0, 0, 64, 64);
      if (pat === 'check') { c.fillStyle = 'rgba(0,0,0,.28)'; for (let i = 0; i < 64; i += 16) c.fillRect(i, 0, 5, 64); c.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 4; i < 64; i += 16) c.fillRect(0, i, 64, 4); }
      else if (pat === 'stripe') { c.fillStyle = 'rgba(255,255,255,.25)'; for (let i = 0; i < 64; i += 12) c.fillRect(0, i, 64, 4); }
      else if (pat === 'acheik') {
        c.strokeStyle = 'rgba(255,236,170,.6)'; c.lineWidth = 3;
        for (let r = 0; r < 4; r++) { c.beginPath(); for (let i = 0; i <= 8; i++) c.lineTo(i * 8, r * 16 + 6 + (i % 2 ? -5 : 5)); c.stroke(); }
      } else { c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(0, 40, 64, 5); }
    }, true);
    t.repeat.set(3, 1);
    longyiTexCache.set(key, t);
  }
  return lam('#ffffff', { map: t, k: 'tex' + key });
}

export function rigKey(o: PersonOpts): string {
  return [o.gender, o.shirt, o.lon, o.skin, o.pat, o.hair, o.bun, o.outfit, o.head, o.thanaka, o.glasses, o.bag, o.hat, o.flower, o.capc, o.gbc, o.s].join('|');
}
export function buildPerson(o: PersonOpts): Rig {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const sh = new THREE.Mesh(GEO.shadow, shadowMat); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; g.add(sh);
  const skin = lam(o.skin), dark = lam('#17101a');
  const footL = add(new THREE.Mesh(GEO.foot, lam('#1b1420')), g, -0.1, 0.04, 0.02);
  const footR = add(new THREE.Mesh(GEO.foot, lam('#1b1420')), g, 0.1, 0.04, 0.02);
  const ht = o.outfit === 'htamein', bp = bodyProfile(o.gender), sw = bp.shoulders / 0.86;
  add(new THREE.Mesh(ht ? GEO.htamein : GEO.longyi, longyiMat(o.lon, o.pat)), body, 0, ht ? 0.4 : 0.42, 0);
  if (o.outfit === 'taikpon') {
    add(new THREE.Mesh(GEO.torso, lam('#f7f3ea')), body, 0, 1.0, 0);
    const j = add(new THREE.Mesh(GEO.jacket, lam(o.shirt, { side: THREE.DoubleSide, k: 'ds' })), body, 0, 1.02, 0);
    j.scale.set(1.02, 1, 1.02);
    for (let k = 0; k < 3; k++) sphere(0.022, lam('#ffffff'), body, 0.08, 1.15 - k * 0.1, 0.24, 6);
  } else add(new THREE.Mesh(ht ? GEO.torsoSlim : GEO.torso, lam(o.shirt)), body, 0, 1.0, 0).scale.x = sw;
  // arms hang from the shoulders and can be raised to wave
  const arm = (side: number) => {
    const a = add(new THREE.Group(), body, side * 0.27 * sw, 1.27, 0);
    add(new THREE.Mesh(GEO.arm, lam(o.outfit === 'taikpon' ? o.shirt : o.shirt)), a, 0, -0.22, 0);
    sphere(0.07, skin, a, 0, -0.46, 0, 8);
    return a;
  };
  const armL = arm(-1), armR = arm(1);
  add(new THREE.Mesh(GEO.head, skin), body, 0, 1.52, 0);
  const hair = add(new THREE.Mesh(GEO.hair, dark), body, 0, 1.54, -0.02); hair.rotation.x = -0.45;
  if (o.hair === 'long') box(0.42, 0.42, 0.1, dark, body, 0, 1.36, -0.17);
  if (o.bun) sphere(0.1, dark, body, 0, 1.74, -0.14, 10);
  for (const s of [-1, 1]) add(new THREE.Mesh(GEO.eye, lam('#120c14')), body, s * 0.08, 1.55, 0.215);
  if (o.thanaka) for (const s of [-1, 1]) { const d = add(new THREE.Mesh(GEO.dot, lam('#efdca6')), body, s * 0.12, 1.47, 0.2); d.rotation.y = s * 0.5; }
  if (o.glasses) { box(0.36, 0.07, 0.03, lam('#0b0b10'), body, 0, 1.555, 0.225); }
  if (o.head === 'gaungbaung') {
    const gb = lam(o.gbc || '#f7b7c3');
    const band = add(new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 8, 18), gb), body, 0, 1.64, 0); band.rotation.x = Math.PI / 2;
    sphere(0.17, gb, body, 0, 1.7, 0, 12);
    const flap = add(new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 8), gb), body, 0.22, 1.74, 0.02); flap.rotation.z = -1.0;
  }
  if (o.hat) add(new THREE.Mesh(GEO.hat, lam('#c9a46a')), body, 0, 1.78, 0);
  if (o.head === 'cap' && !o.hat) {
    const cm = lam(o.capc || '#c23b4b');
    add(new THREE.Mesh(GEO.hair, cm), body, 0, 1.56, 0).scale.set(1.04, 1, 1.04);
    box(0.3, 0.03, 0.2, cm, body, 0, 1.57, 0.25);
  }
  if (o.flower) { sphere(0.07, lam('#ffd23f'), body, 0.2, 1.66, 0.05, 8); sphere(0.03, lam('#ff5a4e'), body, 0.24, 1.67, 0.08, 6); }
  if (o.bag) {
    box(0.2, 0.2, 0.09, lam('#c23b4b'), body, 0.3, 0.72, 0.05);
    const st = box(0.04, 0.85, 0.03, lam('#c23b4b'), body, 0.05, 1.1, 0.24); st.rotation.z = 0.62;
  }
  const balloon = new THREE.Group(); g.add(balloon); balloon.visible = false;
  sphere(0.22, lam('#ff5a4e'), balloon, 0.35, 2.55, 0, 12).name = 'b';
  beam(new THREE.Vector3(0.33, 1.0, 0.05), new THREE.Vector3(0.35, 2.34, 0), 0.006, lam('#ffffff'), balloon);
  const s = o.s || 1; g.scale.setScalar(s);
  return { g, body, armL, armR, footL, footR, balloon, key: rigKey(o) };
}
export function setBalloon(r: Rig, col: string | null): void {
  r.balloon.visible = !!col;
  if (col) ((r.balloon.getObjectByName('b') as THREE.Mesh).material = lam(col));
}
/** Poses a person. With dt the stride follows speed and blends in and out instead of snapping; returns true on a footfall. */
export function animatePerson(r: Rig, t: number, moving: boolean, wave: boolean, seated = false, dt = 0, spd = 1): boolean {
  let s: number, stepped = false;
  r.body.rotation.z = 0;
  if (dt > 0) {
    const a0 = r.amp ?? 0, ph0 = r.ph ?? 0;
    r.amp = a0 + ((moving ? 1 : 0) - a0) * (1 - Math.exp(-dt * 9));
    r.ph = ph0 + dt * (7 + 5 * Math.min(spd, 1.6)) * Math.max(r.amp, moving ? 1 : 0);
    stepped = moving && Math.floor(r.ph / Math.PI) !== Math.floor(ph0 / Math.PI);
    const a = r.amp; s = Math.sin(r.ph) * a;
    r.body.position.y = Math.abs(Math.sin(r.ph)) * 0.05 * a * (0.7 + 0.4 * Math.min(spd, 1.6)) + Math.sin(t * 2) * 0.008 * (1 - a);
    r.body.rotation.x = 0.09 * a * Math.min(spd, 1.6); // lean into the walk
  } else {
    s = moving ? Math.sin(t * 11) : 0;
    r.body.position.y = moving ? Math.abs(s) * 0.05 : Math.sin(t * 2) * 0.008;
  }
  r.footL.position.z = 0.02 + s * 0.14; r.footR.position.z = 0.02 - s * 0.14;
  r.footL.visible = r.footR.visible = !seated;
  if (wave) { r.armL.rotation.z = -0.4; r.armR.rotation.z = 2.6 + Math.sin(t * 12) * 0.35; r.armL.rotation.x = 0; }
  else { r.armL.rotation.z = 0.08; r.armR.rotation.z = -0.08; r.armL.rotation.x = s * 0.5; r.armR.rotation.x = -s * 0.5; }
  r.balloon.rotation.z = Math.sin(t * 1.7) * 0.06;
  return stepped;
}

/** Burmese classical dance: knees soft, body swaying from the waist, hands turned back at the wrist and circling, head tilted against the sway. */
export const BEAT = 60 / 100; // the stage music's beat, in seconds
export function animateDancer(r: Rig, t: number, i = 0): void {
  const b = t / BEAT, ph = b * Math.PI / 2 + i * 0.7, sw = Math.sin(ph), sw2 = Math.sin(ph * 2);
  r.body.rotation.z = sw * 0.16; r.body.rotation.x = 0.06 + Math.max(0, sw2) * 0.05;
  r.body.position.y = -0.06 + Math.abs(Math.sin(b * Math.PI)) * 0.035;
  r.armR.rotation.z = 1.25 + Math.sin(ph + 0.6) * 0.75; r.armL.rotation.z = -1.25 + Math.sin(ph + 0.6 + Math.PI) * 0.75;
  r.armR.rotation.x = -0.5 + Math.cos(ph) * 0.45; r.armL.rotation.x = -0.5 - Math.cos(ph) * 0.45;
  const step = Math.sin(b * Math.PI * 0.5 + i);
  r.footL.position.z = 0.02 + Math.max(0, step) * 0.16; r.footR.position.z = 0.02 + Math.max(0, -step) * 0.16;
  r.footL.visible = r.footR.visible = true;
  const tr = (r as Rig & { train?: THREE.Mesh }).train; // a flick of the heel sends the train back
  if (tr) { tr.rotation.z = Math.sin(ph) * 0.25; tr.position.z = -0.5 - Math.max(0, Math.sin(b * Math.PI * 0.25 + i)) * 0.15; }
}
function animateBand(t: number): void {
  const b = t / BEAT;
  anim.band.forEach((r, i) => {
    r.footL.visible = r.footR.visible = false; r.body.position.y = -0.32; // sitting cross-legged on the stage
    if (i === 0 || i === 1) { // drum and gong circles: both hands busy
      const q = t * (i === 0 ? 9 : 7); r.armL.rotation.z = -0.5 + Math.sin(q) * 0.25; r.armR.rotation.z = 0.5 + Math.sin(q + 1.7) * 0.25;
      r.armL.rotation.x = r.armR.rotation.x = -0.9; r.body.rotation.z = Math.sin(b * Math.PI / 2) * 0.05;
    } else if (i === 2) { // hne: both hands up at the oboe, sways with the long notes
      r.armL.rotation.z = -0.25; r.armR.rotation.z = 0.25; r.armL.rotation.x = r.armR.rotation.x = -1.55;
      r.body.rotation.x = -0.08 + Math.sin(b * Math.PI / 4) * 0.06; r.body.rotation.z = Math.sin(b * Math.PI / 4) * 0.07;
      if (anim.hne) anim.hne.rotation.x = Math.PI / 2 + 0.5 + r.body.rotation.x;
    } else if (i === 3) { // pat ma: a big stroke on the strong beats
      const k = Math.pow(Math.max(0, Math.sin(b * Math.PI / 2)), 6); r.armR.rotation.z = 0.4 + k * 1.2; r.armR.rotation.x = -0.6; r.armL.rotation.z = -0.3; r.armL.rotation.x = -0.4;
    } else { // si and wa keep the time
      const k = Math.abs(Math.sin(b * Math.PI)); r.armL.rotation.x = -1 - k * 0.3; r.armR.rotation.x = -1 - k * 0.3; r.armL.rotation.z = -0.3 + k * 0.2; r.armR.rotation.z = 0.3 - k * 0.2;
    }
  });
}

// ---------------------------------------------------------------- the crowd, instanced (a handful of draw calls for everyone)
export interface CrowdItem { x: number; y: number; hd: number; s: number; moving: boolean; t: number; sit?: number; shirt: string; lon: string; skin: string; hat?: boolean; bun?: boolean; balloon?: string | null }
class Crowd {
  parts: Record<string, THREE.InstancedMesh> = {};
  local: Record<string, THREE.Matrix4> = {};
  colors = new Map<string, THREE.Color>();
  constructor(cap: number) {
    const mk = (name: string, geo: THREE.BufferGeometry, mat: THREE.Material, m: THREE.Matrix4, colored: boolean) => {
      const im = new THREE.InstancedMesh(geo, mat, cap); im.frustumCulled = false; im.count = 0;
      if (colored) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
      scene.add(im); this.parts[name] = im; this.local[name] = m;
    };
    const T = (x: number, y: number, z: number, rx = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, 0)), new THREE.Vector3(1, 1, 1));
    const crowdLongyi = canvasTex(64, 64, c => { c.fillStyle = '#fff'; c.fillRect(0, 0, 64, 64); c.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 0; i < 64; i += 16) c.fillRect(i, 0, 5, 64); c.fillStyle = 'rgba(0,0,0,.1)'; c.fillRect(0, 40, 64, 6); }, true);
    crowdLongyi.repeat.set(3, 1);
    mk('longyi', GEO.longyi, new THREE.MeshLambertMaterial({ map: crowdLongyi }), T(0, 0.42, 0), true);
    mk('torso', GEO.torso, new THREE.MeshLambertMaterial(), T(0, 1.0, 0), true);
    mk('head', GEO.head, new THREE.MeshLambertMaterial(), T(0, 1.52, 0), true);
    mk('hair', GEO.hair, lam('#17101a'), T(0, 1.54, -0.02, -0.45), false);
    mk('shadow', GEO.shadow, shadowMat, T(0, 0.02, 0, -Math.PI / 2), false);
    mk('hat', GEO.hat, lam('#c9a46a'), T(0, 1.78, 0), false);
    mk('bun', GEO.bun, lam('#17101a'), T(0, 1.74, -0.14), false);
    mk('balloon', GEO.balloon, new THREE.MeshLambertMaterial(), T(0.35, 2.55, 0), true);
  }
  col(c: string): THREE.Color { let k = this.colors.get(c); if (!k) { k = new THREE.Color(c); this.colors.set(c, k); } return k; }
  update(items: CrowdItem[]): void {
    const base = new THREE.Matrix4(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const n: Record<string, number> = { longyi: 0, torso: 0, head: 0, hair: 0, shadow: 0, hat: 0, bun: 0, balloon: 0 };
    const put = (name: string, color?: string) => {
      const im = this.parts[name], i = n[name]++;
      m.multiplyMatrices(base, this.local[name]); im.setMatrixAt(i, m);
      if (color) im.setColorAt(i, this.col(color));
    };
    for (const it of items) {
      const bob = it.moving ? Math.abs(Math.sin(it.t * 11)) * 0.05 : 0;
      p.set(X(it.x), (bob - (it.sit || 0)) * it.s, Z(it.y)); q.setFromAxisAngle(up, it.hd); sc.setScalar(it.s);
      base.compose(p, q, sc);
      put('longyi', it.lon); put('torso', it.shirt); put('head', it.skin); put('hair');
      if (it.hat) put('hat'); else if (it.bun) put('bun');
      if (it.balloon) put('balloon', it.balloon);
      p.y = 0; base.compose(p, q, sc); put('shadow');
    }
    for (const k in this.parts) {
      const im = this.parts[k]; im.count = n[k]; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  }
}
let crowd: Crowd;

// ---------------------------------------------------------------- animated pieces we keep hold of
const anim = {
  wheel: null as THREE.Group, cabins: [] as THREE.Group[],
  carousel: null as THREE.Group, horses: [] as THREE.Group[],
  swing: null as THREE.Group, shipSeat: null as THREE.Object3D,
  stageGlows: null as THREE.Points, stageLight: null as THREE.PointLight,
  band: [] as Rig[], dancers: [] as Rig[], hne: null as THREE.Mesh, secretSparkles: null as THREE.Points, steam: null as THREE.Points, lake: null as THREE.Mesh, pond: null as THREE.Mesh,
  wheelBulbs: null as THREE.Points, carouselBulbs: null as THREE.Points,
};
let player: Rig | null = null, playerParent: THREE.Object3D = scene;
const remotes = new Map<string, Rig>();
const bikes: Array<{ g: THREE.Group; rider: Rig; key: string; bell: THREE.Mesh; front: THREE.Mesh; back: THREE.Mesh }> = [];

// ---------------------------------------------------------------- building the world
function buildSkyAndCity(): void {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.MeshBasicMaterial({
    side: THREE.BackSide, fog: false, depthWrite: false,
    map: canvasTex(4, 256, c => { const g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#050418'); g.addColorStop(0.35, '#0d0a2e'); g.addColorStop(0.5, '#3a1a52'); g.addColorStop(0.56, '#5a2450'); g.addColorStop(1, '#120c22'); c.fillStyle = g; c.fillRect(0, 0, 4, 256); }),
  }));
  sky.position.set(45, 0, 60); scene.add(sky);
  const r = srng(21), sp: Array<[number, number, number, string, number]> = [];
  for (let i = 0; i < 700; i++) { const a = r() * TAU, el = 0.08 + r() * 1.3, R = 560; sp.push([45 + Math.cos(a) * Math.cos(el) * R, Math.sin(el) * R, 60 + Math.sin(a) * Math.cos(el) * R, '#fffbe8', 0.4 + r() * 0.6]); }
  const stars = makeGlows(sp, 3.2); (stars.material as THREE.PointsMaterial).sizeAttenuation = false; (stars.material as THREE.PointsMaterial).size = 2.2; (stars.material as THREE.PointsMaterial).fog = false;
  scene.add(stars); tod.stars = stars;
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(128, 128, c => { c.fillStyle = '#fff6d6'; c.beginPath(); c.arc(64, 64, 40, 0, TAU); c.fill(); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(80, 54, 36, 0, TAU); c.fill(); }), fog: false, depthWrite: false }));
  moon.scale.setScalar(36); moon.position.set(160, 170, -260); scene.add(moon); tod.moon = moon;
  // the daytime sky: a gradient dome that fades in over the night sky, with the sun and a few soft clouds
  tod.daySky = new THREE.Mesh(new THREE.SphereGeometry(590, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, transparent: true, fog: false,
    uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, a: { value: 0 } },
    vertexShader: 'varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float a; varying vec3 vp;
      void main(){ float h = clamp(vp.y, 0.0, 1.0); vec3 c = mix(hor, top, pow(h, 0.5)); float s = max(dot(vp, sunDir), 0.0);
        c += sunCol * (pow(s, 12.0) * 0.35 + pow(s, 3.0) * 0.12 * (1.0 - h)); if (vp.y < 0.0) c = hor * 0.92;
        gl_FragColor = vec4(c, a);
        #include <colorspace_fragment>
      }`,
  }));
  tod.daySky.position.set(45, 0, 60); tod.daySky.renderOrder = -1; scene.add(tod.daySky);
  tod.sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite, color: '#fff2c8', transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  tod.sun.scale.setScalar(60); scene.add(tod.sun);
  tod.clouds = new THREE.Group(); scene.add(tod.clouds);
  const cm = new THREE.SpriteMaterial({ map: glowSprite, color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, fog: false });
  const rc = srng(5);
  for (let i = 0; i < 16; i++) {
    const a = rc() * TAU, R = 330 + rc() * 160, y = 110 + rc() * 90;
    for (let k = 0; k < 4; k++) { const c = new THREE.Sprite(cm); c.position.set(45 + Math.cos(a) * R + (k - 1.5) * 24 + rc() * 10, y + rc() * 10, 60 + Math.sin(a) * R + rc() * 12); c.scale.set(70 + rc() * 40, 30 + rc() * 14, 1); tod.clouds.add(c); }
  }

  // lake between the fence and the city
  const lake = new THREE.Mesh(new THREE.PlaneGeometry(400, 34), new THREE.MeshLambertMaterial({ color: '#0f1a3f', emissive: '#0a1030' }));
  lake.rotation.x = -Math.PI / 2; lake.position.set(45, 0.01, Z(NORTH) - 17); scene.add(lake); anim.lake = lake;
  // city blocks with lit windows
  const winTex = [0, 1, 2].map(v => canvasTex(64, 128, c => { const rr = srng(40 + v); c.fillStyle = v === 1 ? '#1b1740' : '#151233'; c.fillRect(0, 0, 64, 128);
    for (let y = 6; y < 124; y += 10) for (let x = 5; x < 60; x += 9) if (rr() < 0.38) { c.fillStyle = rr() < 0.8 ? '#ffd68c' : '#cfe3ff'; c.fillRect(x, y, 5, 5); } }));
  const city = new THREE.Group(); scene.add(city);
  const rb = srng(7);
  for (let i = 0; i < 70; i++) {
    const x = -70 + rb() * 230; if (x > 34 && x < 58) continue;
    const z = -6 - rb() * 45, h = 6 + rb() * 26, w = 4 + rb() * 7, d = 4 + rb() * 6;
    const mat = new THREE.MeshBasicMaterial({ map: winTex[i % 3], color: '#bbbbbb' }); tod.city.push(mat);
    box(w, h, d, mat, city, x, h / 2, z);
  }
  // Shwedagon Pagoda on its hill, glowing gold
  const pag = new THREE.Group(); pag.position.set(46, 0, -70); scene.add(pag);
  cyl(30, 46, 10, lam('#1a1430'), pag, 0, 5, 0, 24);
  const prof: THREE.Vector2[] = [];
  const P = (r: number, y: number) => prof.push(new THREE.Vector2(r, y));
  P(0, 10); P(15, 10); P(15, 12); P(13, 12); P(13, 14); P(11.5, 14); P(11.5, 16); P(10, 16);
  P(10, 19); P(9.6, 23); P(8.2, 27); P(6, 30); P(4, 32); P(3.2, 33); P(3.2, 34); P(2.8, 34); P(2.8, 35.2); P(2.4, 35.2); P(2.4, 36.2);
  P(2.0, 36.2); P(1.9, 38); P(1.6, 41); P(1.0, 44); P(0.5, 47); P(0.2, 50); P(0, 51);
  const gold = new THREE.MeshLambertMaterial({ color: '#ffcf5a', emissive: '#a8640c', emissiveIntensity: 0.5 });
  add(new THREE.Mesh(new THREE.LatheGeometry(prof, 40), gold), pag, 0, 0, 0);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite, color: '#ffb84a', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  halo.scale.set(90, 90, 1); halo.position.set(0, 32, -6); pag.add(halo); tod.halo = halo;
  GLOWS.push([46, 51.5 + 0, -70, '#ffffff', 1.5]);
  // golden reflection on the lake
  const refl = new THREE.Mesh(new THREE.PlaneGeometry(6, 30), new THREE.MeshBasicMaterial({ color: '#ffb84a', transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
  refl.rotation.x = -Math.PI / 2; refl.position.set(46, 0.03, Z(NORTH) - 16); scene.add(refl);
  // lakeside fence
  const fence = lam('#5a5070');
  box(WW * M, 0.08, 0.08, fence, scene, WW * M / 2, 1.0, Z(NORTH)); box(WW * M, 0.08, 0.08, fence, scene, WW * M / 2, 0.5, Z(NORTH));
  const nPost = Math.ceil(WW * M / 1.2) + 1, posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 1.2, 0.1), fence, nPost);
  for (let i = 0; i < nPost; i++) posts.setMatrixAt(i, new THREE.Matrix4().makeTranslation(i * 1.2, 0.6, Z(NORTH)));
  scene.add(posts);
}

function buildGround(): void {
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshLambertMaterial({ color: '#120e1a' })); groundTint(outside.material, '#120e1a', '#4f6436');
  outside.rotation.x = -Math.PI / 2; outside.position.set(45, -0.02, 60); scene.add(outside);
  const fair = new THREE.Mesh(new THREE.PlaneGeometry(WW * M, (WH - NORTH) * M), new THREE.MeshLambertMaterial({ color: '#211a29' })); groundTint(fair.material, '#211a29', '#8f7b5c');
  fair.rotation.x = -Math.PI / 2; fair.position.set(WW * M / 2, 0, Z((WH + NORTH) / 2)); scene.add(fair);
  const roadTex = canvasTex(128, 128, c => { c.fillStyle = '#3a3445'; c.fillRect(0, 0, 128, 128); c.fillStyle = 'rgba(255,255,255,.07)';
    for (let y = 0; y < 128; y += 32) { c.fillRect(0, y, 128, 2); for (let x = (y / 32) % 2 ? 16 : 0; x < 128; x += 32) c.fillRect(x, y, 2, 32); } }, true);
  roadTex.repeat.set(ROAD.w / 80, (WH - NORTH) / 80);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD.w * M, (WH - NORTH) * M), new THREE.MeshLambertMaterial({ map: roadTex })); groundTint(road.material, '#ffffff', '#b8b0a8');
  road.rotation.x = -Math.PI / 2; road.position.set(X(ROAD.x + ROAD.w / 2), 0.01, Z((WH + NORTH) / 2)); scene.add(road);
  for (const zn of ZONES) {
    const tex = canvasTex(256, Math.round(256 * zn.h / zn.w), c => {
      const w = 256, h = c.canvas.height; c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); // tinted by the material: the zone colour at night, packed earth by day
      c.strokeStyle = 'rgba(255,220,160,.18)'; c.lineWidth = 3; c.setLineDash([10, 8]); c.strokeRect(4, 4, w - 8, h - 8);
      c.fillStyle = 'rgba(255,231,163,.07)'; c.font = `400 64px ${DISP}`; c.textBaseline = 'bottom';
      c.textAlign = zn.x < ROAD.x ? 'left' : 'right'; c.fillText(String(zn.n).padStart(2, '0'), zn.x < ROAD.x ? 12 : w - 12, h - 6);
    });
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(zn.w * M, zn.h * M), new THREE.MeshLambertMaterial({ map: tex, color: zn.g }));
    groundTint(pad.material, zn.g, ['#b49c74', '#a89070', '#b8a07a', '#a49478'][zn.n % 4]);
    pad.rotation.x = -Math.PI / 2; pad.position.set(X(zn.x + zn.w / 2), 0.015, Z(zn.y + zn.h / 2)); scene.add(pad);
    // zone sign facing the main street
    const left = zn.x < ROAD.x, sx = X(left ? 712 : zn.x > 1700 ? zn.x + 20 : 1088), sz = Z(zn.y + 80);
    cyl(0.07, 0.07, 3, lam('#4a3a2a'), scene, sx, 1.5, sz, 6);
    board(signTex(zn.my, `${zn.n} · ${zn.name}`), 3.2, 1.2, scene, sx, 3.3, sz, left ? Math.PI / 2 : -Math.PI / 2);
    GLOWS.push([sx, 4.2, sz, '#f4b63f', 0.7]);
  }
}

function buildTrees(): void {
  const trunk = lam('#3b2a20'), leaves = [lam('#173a2b'), lam('#1c4231'), lam('#14332a')];
  TREES.forEach(([x, y], i) => {
    const g = add(new THREE.Group(), scene, X(x), 0, Z(y));
    cyl(0.18, 0.25, 2.6, trunk, g, 0, 1.3, 0, 7);
    sphere(1.6, leaves[i % 3], g, 0, 3.4, 0, 10); sphere(1.1, leaves[(i + 1) % 3], g, -0.9, 2.8, 0.4, 8); sphere(1.2, leaves[(i + 2) % 3], g, 0.9, 2.9, -0.3, 8);
    for (let k = 0; k < 7; k++) { const a = k / 7 * TAU; GLOWS.push([X(x) + Math.cos(a) * 1.7, 2.7 + (k % 3) * 0.5, Z(y) + Math.sin(a) * 1.7, k % 2 ? '#ffd27a' : '#ff9bb3', 0.8]); }
  });
}

function buildLanterns(): void {
  const lineMat = new THREE.LineBasicMaterial({ color: '#1a1424' });
  const post = lam('#4a4058');
  const lanternGeo = new THREE.SphereGeometry(0.18, 10, 8);
  STRINGS.forEach((y, si) => {
    const z = Z(y), x0 = X(ROAD.x), x1 = X(ROAD.x + ROAD.w);
    cyl(0.08, 0.08, 4.4, post, scene, x0, 2.2, z, 6); cyl(0.08, 0.08, 4.4, post, scene, x1, 2.2, z, 6);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push(new THREE.Vector3(lerp(x0, x1, t), 4.3 - Math.sin(t * Math.PI) * 0.9, z)); }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    for (let k = 1; k < 8; k++) {
      const t = k / 8, x = lerp(x0, x1, t), yy = 4.3 - Math.sin(t * Math.PI) * 0.9 - 0.3, col = LANTERN_COLS[(k + si) % 5];
      add(new THREE.Mesh(lanternGeo, glowMat(col)), scene, x, yy, z).scale.set(1, 1.25, 1);
      GLOWS.push([x, yy, z, col, 1]);
    }
  });
}

function buildFerris(): void {
  const cx = X(FW.cx), cz = Z(FW.cy), hub = 10.2, R = FW.R * M;
  const frame = lam('#7d82a3');
  for (const dz of [-0.9, 0.9]) {
    beam(new THREE.Vector3(cx, hub, cz + dz), new THREE.Vector3(cx - 5.2, 0, cz + dz * 2.2), 0.18, frame, scene);
    beam(new THREE.Vector3(cx, hub, cz + dz), new THREE.Vector3(cx + 5.2, 0, cz + dz * 2.2), 0.18, frame, scene);
  }
  box(14, 0.5, 4, lam('#3d3350'), scene, cx, 0.25, cz + 2);
  const wheel = add(new THREE.Group(), scene, cx, hub, cz); anim.wheel = wheel;
  const rim = lam('#d5d9ee');
  for (const dz of [-0.6, 0.6]) {
    add(new THREE.Mesh(new THREE.TorusGeometry(R, 0.09, 6, 64), rim), wheel, 0, 0, dz);
    add(new THREE.Mesh(new THREE.TorusGeometry(R - 0.7, 0.05, 6, 64), rim), wheel, 0, 0, dz);
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; beam(new THREE.Vector3(0, 0, dz), new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, dz), 0.04, lam('#9aa0bc'), wheel); }
  }
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.8, 16), lam('#f4b63f')), wheel, 0, 0, 0).rotation.x = Math.PI / 2;
  const bulbs: Array<[number, number, number, string, number]> = [];
  for (let i = 0; i < 48; i++) { const a = i / 48 * TAU; bulbs.push([Math.cos(a) * R, Math.sin(a) * R, 0.7, LANTERN_COLS[i % 5], 1.2]); bulbs.push([Math.cos(a) * R, Math.sin(a) * R, -0.7, LANTERN_COLS[(i + 2) % 5], 1.2]); }
  anim.wheelBulbs = makeGlows(bulbs, 1.0); wheel.add(anim.wheelBulbs);
  const cols = ['#c23b4b', '#2d7bb6', '#e0a526', '#3a9b7a'];
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU, cab = add(new THREE.Group(), wheel, Math.cos(a) * R, Math.sin(a) * R, 0);
    const inner = add(new THREE.Group(), cab, 0, 0, 0); inner.name = 'inner';
    // a gondola: hanger, canopy, corner posts, low walls and two facing benches
    const cc = lam(cols[i % 4]);
    cyl(0.03, 0.03, 0.45, lam('#cfd3e8'), inner, 0, -0.22, 0, 4);
    box(1.6, 0.08, 1.3, lam('#fff3d6'), inner, 0, -0.47, 0); box(1.66, 0.12, 1.36, cc, inner, 0, -0.4, 0);
    for (const [px, pz] of [[-0.76, -0.6], [0.76, -0.6], [-0.76, 0.6], [0.76, 0.6]]) cyl(0.025, 0.025, 1.3, lam('#cfd3e8'), inner, px, -1.12, pz, 4);
    box(1.6, 0.1, 1.3, lam('#3a3350'), inner, 0, -1.8, 0);
    box(1.6, 0.42, 0.05, cc, inner, 0, -1.55, -0.63); box(1.6, 0.42, 0.05, cc, inner, 0, -1.55, 0.63);
    box(0.05, 0.42, 1.3, cc, inner, -0.78, -1.55, 0); box(0.05, 0.42, 1.3, cc, inner, 0.78, -1.55, 0);
    box(1.4, 0.06, 0.32, lam('#e9dcc4'), inner, 0, -1.55, -0.42); box(1.4, 0.06, 0.32, lam('#e9dcc4'), inner, 0, -1.55, 0.42);
    if (i % 3 !== 1 && i !== 0) { const r = buildPerson({ shirt: pick(['#f3efe6', '#f7b7c3', '#9fd3f0']), lon: pick(['#6b2335', '#283a6b']), skin: pick(['#d9a77a', '#c58c5c', '#a8714a']), s: 0.8, bun: i % 2 === 0 }); r.g.position.set(-0.3, -2.05, -0.42); r.footL.visible = r.footR.visible = false; inner.add(r.g); }
    anim.cabins.push(cab);
  }
  // ticket kiosk
  const k = add(new THREE.Group(), scene, X(590), 0, Z(810));
  box(2.6, 2, 1.6, lam('#e9dcc4'), k, 0, 1, 0); add(new THREE.Mesh(new THREE.ConeGeometry(2.1, 0.9, 4), lam('#2d7bb6')), k, 0, 2.45, 0).rotation.y = Math.PI / 4;
  board(signTex('ချားရဟတ်', '1,500 Ks', '#2a1606', 256, 96), 2.2, 0.8, k, 0, 1.4, 0.81);
  GLOWS.push([X(590), 2.2, Z(810) + 1, '#fff1c9', 1]);
}

function buildCarousel(): void {
  const g = add(new THREE.Group(), scene, X(CR.cx), 0, Z(CR.cy));
  cyl(7.6, 7.8, 0.5, lam('#4a2f5a'), g, 0, 0.25, 0, 40);
  const rotor = add(new THREE.Group(), g, 0, 0.5, 0); anim.carousel = rotor;
  cyl(7.3, 7.3, 0.12, lam('#6b4380'), rotor, 0, 0.06, 0, 40);
  cyl(0.5, 0.5, 6, lam('#d9c48a'), rotor, 0, 3, 0, 12);
  const horseCols = ['#f7efe0', '#f4b63f', '#ffb3c7', '#9fd3f0'];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU, hx = Math.cos(a) * 5.6, hz = Math.sin(a) * 5.6;
    cyl(0.05, 0.05, 5.6, lam('#e8d29a'), rotor, hx, 2.9, hz, 6);
    const h = add(new THREE.Group(), rotor, hx, 1.3, hz); h.rotation.y = -a; // facing along the circle
    const mat = lam(horseCols[i % 4]);
    box(0.4, 0.45, 1.3, mat, h, 0, 0, 0); box(0.3, 0.7, 0.35, mat, h, 0, 0.35, 0.6); box(0.28, 0.25, 0.5, mat, h, 0, 0.65, 0.85);
    for (const [lx, lz] of [[-0.12, 0.45], [0.12, 0.45], [-0.12, -0.45], [0.12, -0.45]]) box(0.09, 0.55, 0.09, mat, h, lx, -0.45, lz);
    box(0.42, 0.12, 0.5, lam('#c23b4b'), h, 0, 0.28, -0.05);
    const seat = add(new THREE.Group(), h, 0, 0.1, -0.05); seat.name = 'seat';
    if (i % 2 === 0 && i !== 0) { const kid = buildPerson({ shirt: pick(['#f7b7c3', '#9fd3f0', '#ffffff']), lon: pick(['#283a6b', '#6b2335']), skin: '#c58c5c', s: 0.62, bun: i === 4 }); kid.g.position.y = -0.1; animatePerson(kid, 0, false, false, true); seat.add(kid.g); }
    anim.horses.push(h);
  }
  // striped canopy
  const canopyTex = canvasTex(256, 32, c => { for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? '#fff3d6' : '#c23b4b'; c.fillRect(i * 16, 0, 16, 32); } });
  add(new THREE.Mesh(new THREE.ConeGeometry(8.2, 2.6, 32, 1, true), new THREE.MeshLambertMaterial({ map: canopyTex, side: THREE.DoubleSide })), rotor, 0, 7.3, 0);
  add(new THREE.Mesh(new THREE.CylinderGeometry(8.2, 8.2, 0.7, 32, 1, true), new THREE.MeshLambertMaterial({ map: stripes('#f4b63f', '#c23b4b', 16), side: THREE.DoubleSide })), rotor, 0, 5.7, 0);
  cyl(0.06, 0.06, 1.4, lam('#f4b63f'), rotor, 0, 9.1, 0, 6);
  box(0.8, 0.45, 0.04, lam('#ff5a4e'), rotor, 0.42, 9.5, 0);
  const bulbs: Array<[number, number, number, string, number]> = [];
  for (let i = 0; i < 32; i++) { const a = i / 32 * TAU; bulbs.push([Math.cos(a) * 8.25, 5.35, Math.sin(a) * 8.25, i % 2 ? '#ffe7a3' : '#ff5a4e', 1.2]); }
  anim.carouselBulbs = makeGlows(bulbs, 0.9); rotor.add(anim.carouselBulbs);
  const pl = new THREE.PointLight('#ffd27a', 80, 22, 2); pl.position.set(0, 4.5, 0); g.add(pl);
}

function buildPirate(): void {
  const px = X(PS.px), pz = Z(PS.py), pivotY = 9.4, L = 7.2;
  const frame = lam('#596080');
  for (const dz of [-1.6, 1.6]) {
    beam(new THREE.Vector3(px, pivotY, pz + dz), new THREE.Vector3(px - 6.4, 0, pz + dz * 1.6), 0.2, frame, scene);
    beam(new THREE.Vector3(px, pivotY, pz + dz), new THREE.Vector3(px + 6.4, 0, pz + dz * 1.6), 0.2, frame, scene);
  }
  beam(new THREE.Vector3(px, pivotY, pz - 1.7), new THREE.Vector3(px, pivotY, pz + 1.7), 0.18, frame, scene);
  box(14, 0.4, 6, lam('#3a3350'), scene, px, 0.2, pz);
  const swing = add(new THREE.Group(), scene, px, pivotY, pz); anim.swing = swing;
  const arm = lam('#a9aec8');
  for (const dz of [-1.2, 1.2]) for (const dx of [-2.2, 2.2]) beam(new THREE.Vector3(0, 0, dz * 0.9), new THREE.Vector3(dx, -L, dz), 0.1, arm, swing);
  // hull from a 2D outline, extruded across the ship's width
  const sh = new THREE.Shape(); sh.moveTo(-5.6, 0.6); sh.lineTo(5.6, 0.6); sh.lineTo(6.5, 1.4); sh.lineTo(4.8, -0.9); sh.quadraticCurveTo(0, -1.8, -4.8, -0.9); sh.lineTo(-6.5, 1.4); sh.closePath();
  const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 2.4, bevelEnabled: false }), lam('#7a3f2a'));
  hull.position.set(0, -L - 0.6, -1.2); swing.add(hull);
  box(11.4, 0.14, 2.5, lam('#f4b63f'), swing, 0, -L + 0.02, 0);
  box(11, 0.1, 2.2, lam('#5a2c1d'), swing, 0, -L - 0.4, 0);
  cyl(0.08, 0.08, 3.4, lam('#5a3a24'), swing, 0, -L + 1.6, 0, 6);
  const sail = add(new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.2), lam('#e9dcc4', { side: THREE.DoubleSide, k: 'ds' })), swing, 0.95, -L + 1.9, 0); sail.rotation.y = Math.PI / 2;
  box(0.9, 0.5, 0.04, lam('#c23b4b'), swing, 0.45, -L + 3.1, 0);
  for (let i = 0; i < 9; i++) {
    const x = -4.4 + i * 1.1;
    if (i === 8) { const seat = add(new THREE.Group(), swing, x, -L + 0.1, 0.4); anim.shipSeat = seat; continue; }
    const rider = buildPerson({ shirt: pick(['#f3efe6', '#f7b7c3', '#9fd3f0', '#b5e6c8', '#e98b6d']), lon: pick(['#6b2335', '#2f5d50', '#283a6b']), skin: pick(['#d9a77a', '#c58c5c', '#a8714a']), s: 0.85, bun: i % 3 === 1 });
    rider.g.position.set(x, -L + 0.1, (i % 2 ? -0.5 : 0.5)); rider.footL.visible = rider.footR.visible = false; swing.add(rider.g);
    rider.g.name = 'rider'; (rider.g as THREE.Object3D & { rig?: Rig }).rig = rider;
  }
  const pl = new THREE.PointLight('#8fb4ff', 60, 20, 2); pl.position.set(px, 6, pz + 5); scene.add(pl);
}

/** A hand-painted price board for a stall: each dish in Myanmar with its price, the way they're chalked up at the fair. */
function menuTex(shop: Shop, bg: string): THREE.CanvasTexture {
  const n = shop.menu.length, w = 256, h = 96 + n * 52;
  return canvasTex(w, h, c => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h); c.strokeStyle = '#c9a46a'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8);
    c.textBaseline = 'middle'; c.textAlign = 'center'; c.fillStyle = '#ffe7a3'; c.font = `700 30px ${MMF}`; c.fillText('ဈေးနှုန်း', w / 2, 40);
    shop.menu.forEach((m, k) => {
      const y = 96 + k * 52;
      c.textAlign = 'left'; c.fillStyle = '#fff6e6'; c.font = `24px ${MMF}`; c.fillText(m.my, 16, y, 150);
      c.textAlign = 'right'; c.fillStyle = '#ffd27a'; c.font = `700 22px ${MMF}`; c.fillText(mmNum(m.p), w - 14, y);
    });
  });
}
/** The little things that make a stall look lived in: a price board on an easel, the gas bottle and a string of bulbs. */
function stallLife(g: THREE.Group, shop: Shop | undefined, bg: string, sx: number, front: number, top: number): void {
  if (shop) {
    const n = shop.menu.length, h = 0.38 * (96 + n * 52) / 52;
    const b = board(menuTex(shop, bg), 1.0, h * 0.5, g, sx, 0.9 + h * 0.25, front, sx < 0 ? 0.35 : -0.35);
    for (const lx of [-0.4, 0.4]) { cyl(0.025, 0.025, 0.95, lam('#6b4a2e'), b, lx, -h * 0.25 - 0.45, -0.03, 4); }
  }
  cyl(0.2, 0.2, 0.75, lam('#2d6bb6'), g, sx < 0 ? 2.5 : -2.5, 0.38, -2.0, 10); cyl(0.06, 0.06, 0.12, lam('#c8ccd8'), g, sx < 0 ? 2.5 : -2.5, 0.8, -2.0, 6);
  for (let k = 0; k < 8; k++) GLOWS.push([g.position.x - 2.6 + k * 0.74, top - Math.sin(k / 7 * Math.PI) * 0.18, g.position.z + front, k % 3 ? '#ffe7a3' : '#ffb35a', 0.8]);
}
function buildFood(): void {
  CARTS.forEach(([x, y], i) => {
    const sn = SNACKS[i], g = add(new THREE.Group(), scene, X(x), 0, Z(y));
    for (const sx of [-2.2, 2.2]) { const w = add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.2, 14), lam('#1b1420')), g, sx, 0.42, 0.6); w.rotation.x = Math.PI / 2; }
    box(6.2, 1.4, 1.8, lam('#e9dcc4'), g, 0, 1.1, -0.9);
    box(6.2, 0.4, 1.82, lam(sn.col), g, 0, 0.6, -0.9);
    box(5.4, 0.6, 1.2, new THREE.MeshLambertMaterial({ color: '#b4e6ff', transparent: true, opacity: 0.35 }), g, 0, 2.1, -0.9);
    for (const sx of [-2.9, 2.9]) cyl(0.05, 0.05, 2.4, lam('#8a7d6a'), g, sx, 2.9, -0.2, 6);
    const aw = box(6.8, 0.15, 2.6, new THREE.MeshLambertMaterial({ map: stripes('#fff3d6', sn.col, 10) }), g, 0, 4.1, -0.6); aw.rotation.x = 0.18;
    board(signTex(sn.my, sn.name + ' · ' + sn.p.toLocaleString('en-US') + ' Ks', '#2a1606', 512, 160), 4.4, 1.35, g, 0, 5.0, -1.3);
    GLOWS.push([X(x) - 2.9, 3.9, Z(y) - 0.3, '#ffd27a', 1], [X(x) + 2.9, 3.9, Z(y) - 0.3, '#ffd27a', 1]);
    const pl = new THREE.PointLight('#ffd27a', 22, 9, 2); pl.position.set(0, 3.4, 0.6); g.add(pl);
    buildDish(g, sn.id);
    stallLife(g, SHOPS[i], '#23402f', -3.75, 0.5, 3.75);
  });
  TEA_TABLES.forEach(([x, y], i) => {
    const g = add(new THREE.Group(), scene, X(x), 0, Z(y));
    box(1.2, 0.5, 0.7, lam('#d8c6a8'), g, 0, 0.25, 0);
    const sc = ['#2d7bb6', '#c23b4b', '#e0a526'];
    [[-0.95, 0], [0.95, 0], [0, 0.75], [0, -0.75]].forEach(([dx, dz], k) => box(0.45, 0.3, 0.45, lam(sc[(k + i) % 3]), g, dx, 0.15, dz));
    sphere(0.08, lam('#f3efe6'), g, 0.2, 0.56, 0, 8);
  });
}

function boothBack(kind: string): THREE.CanvasTexture {
  return canvasTex(256, 96, c => {
    c.fillStyle = '#3a2a4a'; c.fillRect(0, 0, 256, 96);
    if (kind === 'ring') for (let r = 0; r < 3; r++) for (let k = 0; k < 8; k++) { c.fillStyle = r === 1 && k === 4 ? '#f4b63f' : '#3fae7a'; const x = 18 + k * 30, y = 12 + r * 28; c.fillRect(x - 4, y + 6, 8, 16); c.fillRect(x - 2, y, 4, 7); }
    else if (kind === 'darts') for (let r = 0; r < 3; r++) for (let k = 0; k < 9; k++) { c.fillStyle = LANTERN_COLS[(r * 9 + k) % 5]; c.beginPath(); c.ellipse(16 + k * 28, 16 + r * 30, 10, 12, 0, 0, TAU); c.fill(); }
    else { c.fillStyle = '#5a3a24'; c.fillRect(0, 44, 256, 4); for (let k = 0; k < 8; k++) { c.fillStyle = ['#c9a46a', '#f7efe0', '#ff8ad8', '#8fb4ff', '#f4b63f'][k % 5]; c.beginPath(); c.arc(18 + k * 31, 30, 12, 0, TAU); c.fill(); c.beginPath(); c.arc(18 + k * 31, 70, 14, 0, TAU); c.fill(); } }
  });
}
function buildBooths(): void {
  BOOTHS.forEach(b => {
    const g = add(new THREE.Group(), scene, X(b.x), 0, Z(b.y));
    const col = b.kind === 'prize' ? '#2d7bb6' : '#c23b4b';
    box(10, 3.6, 0.3, new THREE.MeshLambertMaterial({ map: boothBack(b.kind) }), g, 0, 2.4, -2.6);
    for (const sx of [-4.9, 4.9]) box(0.2, 5, 2.8, lam('#3a2a4a'), g, sx, 2.5, -1.3);
    box(10, 1.6, 0.6, new THREE.MeshLambertMaterial({ map: stripes('#fff3d6', col, 12) }), g, 0, 0.8, -0.2);
    const roof = box(10.6, 0.25, 3.4, new THREE.MeshLambertMaterial({ map: stripes('#fff3d6', '#f4b63f', 12) }), g, 0, 5.1, -1.2); roof.rotation.x = 0.15;
    board(signTex(b.my, b.en, '#2a1606', 512, 150), 5, 1.45, g, 0, 6.3, -1.6);
    for (let k = 0; k < 9; k++) GLOWS.push([X(b.x) - 4.8 + k * 1.2, 5.0, Z(b.y) + 0.4, k % 2 ? '#ffe7a3' : '#ff5a4e', 0.9]);
    const pl = new THREE.PointLight('#ffe1a6', 26, 10, 2); pl.position.set(0, 3.8, 1); g.add(pl);
  });
}

function buildKids(): void {
  const cx = X(KIDS.cx), cz = Z(KIDS.cy), rx = KIDS.rx * M, rz = KIDS.ry * M;
  const grass = add(new THREE.Mesh(new THREE.CircleGeometry(1, 40), lam('#2a3a2e')), scene, cx, 0.02, cz); grass.rotation.x = -Math.PI / 2; grass.scale.set(rx - 1.5, rz - 1.3, 1);
  for (let i = 0; i < 6; i++) sphere(0.6, lam('#3a5a3e'), scene, cx - 6 + i * 2.4, 0.4, cz + Math.sin(i) * 1.5, 8);
  buildTrain();
  // toy stall
  const ts = add(new THREE.Group(), scene, X(TOYS_AT.x), 0, Z(TOYS_AT.y));
  box(5.4, 1.5, 1.8, lam('#e9dcc4'), ts, 0, 0.75, -0.9);
  box(5.4, 0.4, 1.82, lam('#7a2e5c'), ts, 0, 0.3, -0.9);
  for (let k = 0; k < 5; k++) { cyl(0.02, 0.02, 2, lam('#ffffff'), ts, -2 + k, 2.5, -1.2, 4); sphere(0.32, lam(LANTERN_COLS[k]), ts, -2 + k, 3.7, -1.2, 10).scale.y = 1.2; }
  for (let k = 0; k < 4; k++) { sphere(0.25, lam('#f7efe0'), ts, -1.5 + k, 1.75, -0.6, 10); sphere(0.17, lam('#c23b4b'), ts, -1.5 + k, 2.1, -0.6, 8); } // tumbling dolls
  board(signTex('ကစားစရာ', 'Toys', '#2a1606', 384, 130), 3, 1, ts, 0, 4.9, -1.3);
  const tl = new THREE.PointLight('#ffd27a', 18, 9, 2); tl.position.set(0, 3, 1); ts.add(tl);
}

// ---------------------------------------------------------------- the mini train (ရထားလေး): a little steam engine and open carriages on a loop through the whole fair
const trn = {
  loco: null as THREE.Group | null, cars: [] as THREE.Group[], wheels: [] as THREE.Mesh[], rods: [] as THREE.Object3D[], seat: null as THREE.Object3D | null,
  chimney: null as THREE.Object3D | null, smokePos: new Float32Array(70 * 3), smokeCol: new Float32Array(70 * 3), smokeVel: new Float32Array(70 * 3), smokeLife: new Float32Array(70), smokeNext: 0, smoke: null as THREE.Points | null, puffT: 0, spin: 0,
};
const LOCO_HALF = 1.45, CAR_HALF = 1.1;
function buildTrain(): void {
  // the track: rails, sleepers and a gravel bed, laid in short straight pieces
  const STEP = 10, n = Math.ceil(TRACK_LEN / STEP);
  const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.09, STEP * M + 0.02), lam('#b8bccb'), n * 2);
  const bed = new THREE.InstancedMesh(new THREE.BoxGeometry(1.7, 0.04, STEP * M + 0.02), lam('#4a4440'), n);
  const nS = Math.ceil(TRACK_LEN / 14), sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 0.07, 0.2), lam('#5a3a24'), nS);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const [x, y, h] = trackPos((i + 0.5) * STEP), ry = Math.atan2(Math.cos(h), Math.sin(h)), nx = -Math.sin(h), ny = Math.cos(h);
    q.setFromAxisAngle(UP, ry);
    bed.setMatrixAt(i, m4.compose(v.set(X(x), 0.02, Z(y)), q, one));
    for (const sd of [-1, 1]) rails.setMatrixAt(i * 2 + (sd > 0 ? 1 : 0), m4.compose(v.set(X(x) + nx * sd * 0.42, 0.12, Z(y) + ny * sd * 0.42), q, one));
  }
  for (let i = 0; i < nS; i++) { const [x, y, h] = trackPos(i * 14); q.setFromAxisAngle(UP, Math.atan2(Math.cos(h), Math.sin(h))); sleepers.setMatrixAt(i, m4.compose(v.set(X(x), 0.06, Z(y)), q, one)); }
  scene.add(bed, sleepers, rails);
  // the engine: green boiler with gold bands, a tall chimney, a red cab and a lamp on the front
  const red = lam('#b8332e'), green = lam('#2f6b4a'), gold = lam('#e0b040'), black = lam('#1b1420'), wood = lam('#8a5a32');
  const L = trn.loco = add(new THREE.Group(), scene);
  box(1.1, 0.28, 2.9, black, L, 0, 0.42, 0);
  const boiler = cyl(0.42, 0.42, 1.7, green, L, 0, 1.02, 0.45, 18); boiler.rotation.x = Math.PI / 2;
  for (const z of [-0.2, 0.45, 1.1]) { const b = cyl(0.445, 0.445, 0.06, gold, L, 0, 1.02, z, 18); b.rotation.x = Math.PI / 2; }
  const smokebox = cyl(0.44, 0.44, 0.22, black, L, 0, 1.02, 1.32, 18); smokebox.rotation.x = Math.PI / 2;
  const chim = cyl(0.13, 0.11, 0.62, black, L, 0, 1.72, 1.12, 10); cone(0.22, 0.2, black, chim, 0, 0.38, 0, 12).rotation.x = Math.PI;
  trn.chimney = add(new THREE.Object3D(), L, 0, 2.15, 1.12);
  sphere(0.17, gold, L, 0, 1.46, 0.5, 12);
  sphere(0.13, glowMat('#fff2c0'), L, 0, 1.08, 1.48, 10);
  box(1.12, 0.22, 0.12, red, L, 0, 0.42, 1.5); // the buffer beam
  const cow = cone(0.45, 0.4, red, L, 0, 0.3, 1.62, 4); cow.rotation.set(Math.PI / 2, Math.PI / 4, 0); cow.scale.set(1.2, 1, 0.5);
  // the cab is open at the back, so from the first carriage you see the driver and the boiler ahead
  box(1.12, 0.62, 0.08, red, L, 0, 0.86, -0.4);
  for (const sx of [-0.5, 0.5]) box(0.12, 0.62, 0.08, red, L, sx, 1.48, -0.4); // window frames either side of the boiler
  for (const sx of [-0.56, 0.56]) { box(0.06, 0.5, 0.95, red, L, sx, 0.82, -0.85); cyl(0.035, 0.035, 0.95, gold, L, sx * 0.93, 1.32, -1.28, 6); }
  box(1.3, 0.07, 1.15, gold, L, 0, 1.8, -0.82);
  for (const sx of [-1, 1]) board(signTex('ရွှေရထား', 'Golden Express', '#7a1f2b', 384, 120), 0.8, 0.25, L, sx * 0.595, 0.85, -0.85, sx * Math.PI / 2);
  const driver = buildPerson({ shirt: '#f3efe6', lon: '#283a6b', skin: '#a8714a', s: 0.72 }); driver.g.position.set(0.4, 0.5, -0.95); driver.g.rotation.y = -0.6; driver.footL.visible = driver.footR.visible = false; animatePerson(driver, 0, false, false, true); L.add(driver.g);
  const lampLight = new THREE.PointLight('#ffe1a6', 14, 12, 2); lampLight.position.set(0, 1.1, 2.4); L.add(lampLight);
  const wheel = (g: THREE.Group, r: number, x: number, z: number, col: THREE.Material) => {
    const w = add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.08, 14), col), g, x, r + 0.05, z); w.rotation.z = Math.PI / 2;
    const spoke = box(0.1, r * 1.7, 0.06, gold, w, 0, 0, 0); spoke.rotation.x = 0; trn.wheels.push(w); return w;
  };
  for (const sx of [-0.58, 0.58]) { for (const z of [-0.85, 0, 0.85]) wheel(L, 0.3, sx, z, red); trn.rods.push(box(0.04, 0.05, 1.8, gold, L, sx * 1.07, 0.35, 0)); }
  // four open carriages with benches and striped canopies, like the ones at a pwe
  const cols = ['#c23b4b', '#2d7bb6', '#e0a526', '#3a9b7a'], tops = ['#f4b63f', '#ffffff', '#c23b4b', '#f4b63f'];
  for (let i = 0; i < 4; i++) {
    const c = add(new THREE.Group(), scene), body = lam(cols[i]);
    box(1.15, 0.12, 2.15, wood, c, 0, 0.5, 0);
    for (const sx of [-0.55, 0.55]) box(0.06, 0.36, 2.15, body, c, sx, 0.73, 0);
    for (const sz of [-1.05, 1.05]) box(1.15, 0.36, 0.06, body, c, 0, 0.73, sz);
    for (const sx of [-0.55, 0.55]) box(0.07, 0.04, 2.17, gold, c, sx, 0.93, 0);
    for (const bz of [0.4, -0.55]) { box(0.95, 0.08, 0.42, wood, c, 0, 0.78, bz); box(0.95, 0.36, 0.06, wood, c, 0, 1.0, bz - 0.22); }
    for (const sx of [-0.52, 0.52]) for (const sz of [-1.0, 1.0]) cyl(0.03, 0.03, 1.15, gold, c, sx, 1.45, sz, 6);
    box(1.32, 0.06, 2.3, new THREE.MeshLambertMaterial({ map: stripes(tops[i], cols[i], 10) }), c, 0, 2.05, 0);
    for (let k = 0; k < 4; k++) for (const sx of [-0.62, 0.62]) sphere(0.045, glowMat(LANTERN_COLS[(k + i) % 5]), c, sx, 2.0, -0.9 + k * 0.6, 6);
    box(0.1, 0.08, 0.3, black, c, 0, 0.42, 1.2);
    for (const sx of [-0.58, 0.58]) for (const z of [-0.65, 0.65]) wheel(c, 0.22, sx, z, black);
    if (i === 0) { trn.seat = add(new THREE.Group(), c, -0.18, 0.82, 0.4); trn.seat.name = 'seat'; }
    // passengers: families, kids and a grandma, a couple to a bench
    const r = srng(70 + i);
    for (const [px, pz] of [[0.22, 0.4], [-0.22, -0.55], [0.22, -0.55], [-0.22, 0.4]] as Array<[number, number]>) {
      if (i === 0 && pz > 0) continue; if (r() < 0.35) continue;
      const kid = r() < 0.45, p = buildPerson({ shirt: pick(['#f3efe6', '#f7b7c3', '#9fd3f0', '#b5e6c8', '#ffd27a']), lon: pick(['#6b2335', '#283a6b', '#2f5d50']), skin: pick(['#d9a77a', '#c58c5c', '#a8714a']), s: kid ? 0.6 : 0.8, bun: r() < 0.5 });
      p.g.position.set(px, 0.82 - (kid ? 0.3 : 0.42), pz); p.footL.visible = p.footR.visible = false; animatePerson(p, 0, false, false, true); c.add(p.g);
    }
    trn.cars.push(c);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(trn.smokePos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(trn.smokeCol, 3));
  trn.smoke = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.3, map: glowSprite, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  trn.smoke.frustumCulled = false; scene.add(trn.smoke);
  // the station: a raised wooden platform with a tin roof, flower pots and a ticket sign
  const sx0 = X(STATION.x - 45), sz0 = Z(STATION.y), st = add(new THREE.Group(), scene, sx0, 0, sz0);
  box(13.5, 0.12, 2.2, lam('#7a5232'), st, 0, 0.06, 0);
  box(13.5, 0.06, 0.12, lam('#e8d38a'), st, 0, 0.13, 1.05);
  for (let k = 0; k < 5; k++) cyl(0.08, 0.08, 2.9, lam('#e9dcc4'), st, -6 + k * 3, 1.5, -0.6, 6);
  const tin = box(13.8, 0.12, 2.6, lam('#c23b4b'), st, 0, 3.0, -0.1); tin.rotation.x = 0.1;
  board(signTex('ရထားဘူတာ', 'Mini train station · 500 Ks', '#2a1606', 512, 140), 4.2, 1.15, st, 0, 3.75, -0.2);
  for (const k of [-5, 5]) { cyl(0.28, 0.2, 0.45, lam('#a0522d'), st, k, 0.35, -0.7, 10); sphere(0.33, lam('#3a7a3e'), st, k, 0.75, -0.7, 8); sphere(0.1, lam('#f05a7e'), st, k + 0.15, 0.95, -0.55, 6); }
  box(0.9, 1.2, 0.6, lam('#5a3a24'), st, -6.2, 0.6, -0.7); // the ticket box
  for (let k = 0; k < 14; k++) GLOWS.push([sx0 - 6.6 + k, 2.85, sz0 + 1.2, k % 2 ? '#ffe7a3' : '#ff5a4e', 0.9]);
  const pl = new THREE.PointLight('#ffe1a6', 30, 14, 2); pl.position.set(0, 2.6, 0.6); st.add(pl);
}
function placeOnTrack(g: THREE.Object3D, d: number, half: number): number {
  const [x1, y1, h1] = trackPos(d + half / M * 0.75), [x2, y2, h2] = trackPos(d - half / M * 0.75);
  g.position.set(X((x1 + x2) / 2), 0, Z((y1 + y2) / 2)); g.rotation.set(0, Math.atan2(X(x1) - X(x2), Z(y1) - Z(y2)), 0);
  let dh = h1 - h2; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); return dh;
}
function updateTrain(f: Frame, t: number, dt: number): void {
  if (!trn.loco) return;
  const v = f.train.v * M; // metres a second
  placeOnTrack(trn.loco, f.train.d, LOCO_HALF);
  trn.loco.position.y = Math.abs(Math.sin(t * 13)) * 0.01 * Math.min(1, v);
  trn.cars.forEach((c, i) => {
    const dh = placeOnTrack(c, f.train.d - TRAIN_OFF[i + 1], CAR_HALF), k = Math.min(1, v / 3);
    // a gentle rock from side to side, a lean on the bends, and a little jolt over each rail joint
    c.rotation.z = Math.sin(t * 6.5 + i * 1.7) * 0.018 * k + dh * 0.12;
    c.rotation.x = Math.sin(t * 9.1 + i) * 0.006 * k;
    c.position.y = Math.max(0, Math.sin(f.train.d * 0.31 - i * 2.2)) * 0.012 * k;
  });
  trn.spin += v * dt;
  trn.wheels.forEach(w => { w.rotation.x = -trn.spin / 0.27; });
  trn.rods.forEach((r, i) => { r.position.y = 0.35 + Math.sin(trn.spin / 0.3) * 0.12; r.position.z = Math.cos(trn.spin / 0.3) * 0.12 * (i ? 1 : -1); });
  // smoke: a puff with every chuff, more when pulling away, drifting back over the carriages
  trn.puffT -= dt * (0.6 + v * 1.2);
  if (trn.chimney && trn.puffT <= 0) {
    trn.puffT = 1; trn.chimney.getWorldPosition(tmpV);
    for (let k = 0; k < (v > 0.2 ? 3 : 1); k++) {
      const i = trn.smokeNext = (trn.smokeNext + 1) % 70;
      trn.smokePos.set([tmpV.x + rand(-0.1, 0.1), tmpV.y, tmpV.z + rand(-0.1, 0.1)], i * 3);
      trn.smokeVel.set([rand(-0.3, 0.3), rand(0.9, 1.5), rand(-0.3, 0.3)], i * 3); trn.smokeLife[i] = rand(1.6, 2.6);
    }
  }
  for (let i = 0; i < 70; i++) {
    if (trn.smokeLife[i] <= 0) { trn.smokeCol.set([0, 0, 0], i * 3); continue; }
    trn.smokeLife[i] -= dt;
    for (let j = 0; j < 3; j++) trn.smokePos[i * 3 + j] += trn.smokeVel[i * 3 + j] * dt;
    trn.smokeVel[i * 3 + 1] *= 1 - dt * 0.6;
    const a = clamp(trn.smokeLife[i] / 2.6, 0, 1) * 0.16; trn.smokeCol.set([a, a, a * 1.05], i * 3);
  }
  (trn.smoke!.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  (trn.smoke!.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
}

function buildStage(): void {
  const g = add(new THREE.Group(), scene, X(ST.x), 0, Z(ST.y));
  box(17, 1.2, 5, lam('#4a3a5a'), g, 0, 0.6, -1.8);
  box(17, 5, 0.3, lam('#1d1628'), g, 0, 3.6, -4.2);
  const truss = lam('#7d82a3');
  for (const sx of [-8.4, 8.4]) cyl(0.12, 0.12, 7.4, truss, g, sx, 3.7, -1, 8);
  box(17, 0.25, 0.25, truss, g, 0, 7.4, -1);
  board(signTex('ဂီတ', 'Live music', '#7a1f2b', 512, 150), 6, 1.75, g, 0, 5.2, -4.0);
  for (const sx of [-9.6, 9.6]) { box(1.3, 3, 1.1, lam('#16101f'), g, sx, 1.5, -0.6); for (const sy of [0.9, 2.1]) { const sp = add(new THREE.Mesh(new THREE.CircleGeometry(0.4, 14), lam('#3a3350')), g, sx, sy, -0.04); sp.position.z = -0.04; } }
  // the saing waing orchestra along the back of the stage, dancers in front
  const gold = lam('#e0b45a'), wood = lam('#6b3f22');
  const band: Array<[PersonOpts, number]> = [
    [{ shirt: '#ffffff', lon: '#7a1f2b', skin: '#a8714a', head: 'gaungbaung', gbc: '#f4b63f', outfit: 'taikpon' }, -5.6], // pat waing
    [{ shirt: '#ffffff', lon: '#283a6b', skin: '#c58c5c', head: 'gaungbaung', gbc: '#ffffff' }, -2.2],                    // kyi waing
    [{ shirt: '#ffffff', lon: '#2f5d50', skin: '#d9a77a', head: 'gaungbaung', gbc: '#ffe7a3' }, 0.9],                     // hne
    [{ shirt: '#ffffff', lon: '#4b2c63', skin: '#b07a50', head: 'gaungbaung', gbc: '#ffffff' }, 3.8],                     // pat ma
    [{ shirt: '#ffffff', lon: '#6b2335', skin: '#c58c5c', head: 'gaungbaung', gbc: '#f4b63f' }, 6.4],                     // si and wa
  ];
  band.forEach(([o, x]) => { const r = buildPerson({ ...o, s: 1.0 }); r.g.position.set(x, 1.2, -2.9); g.add(r.g); anim.band.push(r); });
  // pat waing: a ring of 21 tuned drums inside a carved gold-and-red wall
  const pw = add(new THREE.Group(), g, -5.6, 1.2, -2.9);
  add(new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.3, 0.75, 24, 1, true, 0.5, TAU - 1), lam('#9a2230', { side: THREE.DoubleSide, k: 'ds' })), pw, 0, 0.38, 0);
  for (let k = 0; k < 9; k++) { const a = 0.6 + k / 8 * (TAU - 1.2); cone(0.12, 0.55, gold, pw, Math.sin(a) * 1.28, 0.95, Math.cos(a) * 1.28); }
  for (let k = 0; k < 21; k++) { const a = 0.7 + k / 20 * (TAU - 1.4); cyl(0.09 - k * 0.002, 0.08, 0.3, lam('#7a4a26'), pw, Math.sin(a) * 1.0, 0.82, Math.cos(a) * 1.0, 8); }
  // kyi waing: a ring of small bossed gongs
  const kw = add(new THREE.Group(), g, -2.2, 1.2, -2.9);
  const kr = add(new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.06, 6, 28), gold), kw, 0, 0.55, 0); kr.rotation.x = Math.PI / 2;
  for (let k = 0; k < 19; k++) { const a = 0.7 + k / 18 * (TAU - 1.4); const gg = sphere(0.1, lam('#c9a24a'), kw, Math.sin(a) * 0.95, 0.62, Math.cos(a) * 0.95, 8); gg.scale.y = 0.45; }
  // hne: a conical double-reed oboe held up to the player's mouth
  const hne = cone(0.07, 0.6, lam('#3a2414'), g, 0.9, 2.35, -2.5); hne.rotation.x = Math.PI / 2 + 0.5; anim.hne = hne;
  sphere(0.09, gold, g, 0.9, 2.18, -2.25, 8).scale.y = 0.5;
  // pat ma: the big bass drum hung in a frame
  const pm = add(new THREE.Group(), g, 3.8, 1.2, -2.6);
  const drum = cyl(0.55, 0.55, 0.7, lam('#7a3a1e'), pm, 0, 1.25, 0, 18); drum.rotation.z = Math.PI / 2;
  for (const sx of [-0.6, 0.6]) cyl(0.04, 0.04, 2.1, wood, pm, sx, 1.05, -0.2, 6);
  box(1.3, 0.08, 0.08, gold, pm, 0, 2.1, -0.2);
  // si (small cymbals) and wa (bamboo clapper) beside their player
  sphere(0.07, gold, g, 6.15, 1.95, -2.4, 8); sphere(0.07, gold, g, 6.65, 1.95, -2.4, 8);
  box(0.06, 0.32, 0.12, lam('#d6b06a'), g, 6.4, 1.75, -2.35);
  // two dancers: a woman in a htamein with a long train and a man in a gaung baung
  const dancers: PersonOpts[] = [
    { shirt: '#fff3d6', lon: '#c2185b', skin: '#e4b98f', outfit: 'htamein', hair: 'bun', bun: true, head: 'flower', flower: true, pat: 'acheik', thanaka: true },
    { shirt: '#f4b63f', lon: '#283a6b', skin: '#b07a50', outfit: 'taikpon', head: 'gaungbaung', gbc: '#ff5a4e', pat: 'check' },
    { shirt: '#ffd1e6', lon: '#6a1b9a', skin: '#d9a77a', outfit: 'htamein', hair: 'bun', bun: true, head: 'flower', flower: true, pat: 'acheik' },
  ];
  dancers.forEach((o, i) => {
    const r = buildPerson({ ...o, s: 1.02 }); r.g.position.set(-3.2 + i * 3.2, 1.2, -0.4); g.add(r.g); anim.dancers.push(r);
    if (o.outfit === 'htamein') { // the train (yinzi) of the htamein, swept back along the floor
      const tr = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.9), lam(o.lon, { side: THREE.DoubleSide, k: 'train' + o.lon }));
      tr.rotation.x = -Math.PI / 2 + 0.12; tr.position.set(0, 0.04, -0.5); r.g.add(tr); (r as Rig & { train?: THREE.Mesh }).train = tr;
    }
  });
  const spot = new THREE.SpotLight('#ffe7c0', 160, 22, 0.55, 0.6, 1.4); spot.position.set(0, 7.2, 3); spot.target.position.set(0, 1.2, -0.4); g.add(spot, spot.target);
  const glows: Array<[number, number, number, string, number]> = [];
  for (let k = 0; k < 8; k++) glows.push([-7.5 + k * 2.15, 7.2, -1, LANTERN_COLS[k % 5], 2]);
  anim.stageGlows = makeGlows(glows, 1.4); g.add(anim.stageGlows);
  anim.stageLight = new THREE.PointLight('#ff8ad8', 120, 26, 2); anim.stageLight.position.set(0, 6, 3); g.add(anim.stageLight);
  // photo booth
  const pb = add(new THREE.Group(), scene, X(PHOTO.x), 0, Z(PHOTO.y));
  box(2.6, 3.4, 2.2, lam('#e9dcc4'), pb, 0, 1.7, -1.1);
  box(1.2, 2.8, 0.05, lam('#7a1f2b'), pb, -0.5, 1.5, 0.02);
  box(0.8, 0.6, 0.1, lam('#2a2238'), pb, 0.7, 2.6, 0.04);
  board(signTex('ဓာတ်ပုံ', 'Photo', '#2a1606', 384, 130), 2.6, 0.9, pb, 0, 3.9, 0.05);
  GLOWS.push([X(PHOTO.x) + 0.7, 2.6, Z(PHOTO.y) + 0.2, '#ffffff', 1]);
}

function buildFinaleAndGate(): void {
  const g = add(new THREE.Group(), scene, X(FV.x), 0, Z(FV.y));
  box(16, 0.6, 6.5, lam('#5c4230'), g, 0, 0.3, 0);
  const rail = lam('#d9c48a');
  box(16, 0.08, 0.08, rail, g, 0, 1.6, -3.2);
  for (let k = 0; k <= 16; k++) cyl(0.04, 0.04, 1.0, rail, g, -8 + k, 1.1, -3.2, 4);
  for (const sx of [-4.5, 4.5]) box(3.2, 0.5, 0.7, lam('#6b4f3a'), g, sx, 0.85, 1.5);
  board(signTex('မီးပန်း', 'Fireworks 9:30 PM', '#2a1606', 512, 150), 4.4, 1.3, g, 5.5, 2.2, 3.2);
  for (let k = 0; k < 9; k++) GLOWS.push([X(FV.x) - 7.5 + k * 1.9, 1.75, Z(FV.y) - 3.2, k % 2 ? '#ff5a4e' : '#f4b63f', 1]);
  const pl = new THREE.PointLight('#ffd27a', 30, 14, 2); pl.position.set(0, 3, 0); g.add(pl);
  // entry arch
  const a = add(new THREE.Group(), scene, X(900), 0, Z(ARCH_Y));
  for (const sx of [-6.5, 6.5]) { box(1.2, 7.5, 1.2, lam('#7a1f2b'), a, sx, 3.75, 0); box(1.6, 0.4, 1.6, lam('#f4b63f'), a, sx, 7.6, 0); }
  const sign = signTex('ရေကျော်ညများ', 'Yay Kyaw Nights', '#7a1f2b', 768, 220);
  board(sign, 14, 4, a, 0, 9.8, 0.2); board(sign, 14, 4, a, 0, 9.8, -0.2, Math.PI);
  for (let k = 0; k < 15; k++) GLOWS.push([X(900) - 7 + k, 11.9, Z(ARCH_Y) + 0.3, k % 3 ? '#ffe7a3' : '#ff5a4e', 1.1]);
  const al = new THREE.PointLight('#f4b63f', 70, 24, 2); al.position.set(0, 8, 3); a.add(al);
}

function buildSecrets(): void {
  for (const s of SECRETS) {
    const g = add(new THREE.Group(), scene, X(s.x), 0, Z(s.y));
    if (s.id === 'cat') { const c = lam('#e08a3a'); sphere(0.3, c, g, 0, 0.2, 0, 10).scale.set(1.4, 0.7, 1); sphere(0.17, c, g, 0.38, 0.28, 0, 8); for (const z of [-0.07, 0.07]) add(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 4), c), g, 0.4, 0.46, z); }
    if (s.id === 'slipper') box(0.22, 0.04, 0.5, lam('#2d7bb6'), g, 0, 0.03, 0).rotation.y = 0.6;
    if (s.id === 'saika') {
      for (const [wx, wz] of [[0, 0.7], [0, -0.7], [-1.1, 0]]) { const w = add(new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.05, 6, 16), lam('#15101c')), g, wx, 0.38, wz); w.rotation.y = wx ? Math.PI / 2 : 0; }
      box(1.1, 0.7, 0.9, lam('#2f5d50'), g, -1.1, 0.8, 0); box(1.1, 0.12, 0.9, lam('#c23b4b'), g, -1.1, 0.5, 0); beam(new THREE.Vector3(0, 0.4, -0.7), new THREE.Vector3(0, 1.1, 0.6), 0.04, lam('#9aa0bc'), g);
    }
    if (s.id === 'parrot') { const cage = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8, 0, TAU, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#d9c48a', wireframe: true })); add(cage, g, 0, 0.9, 0); box(0.8, 0.9, 0.8, lam('#5a3a24'), g, 0, 0.45, 0); sphere(0.12, lam('#3fb36a'), g, 0, 1.05, 0, 8).scale.y = 1.5; }
    if (s.id === 'kite') { const k = add(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), lam('#ff5a4e', { side: THREE.DoubleSide, k: 'ds' })), g, 0, 1.3, 0.1); k.rotation.z = Math.PI / 4; }
    if (s.id === 'quail') { sphere(0.35, lam('#b98a4a'), g, 0.6, 0.2, 0, 10).scale.y = 0.6; for (let i = 0; i < 4; i++) sphere(0.06, lam('#efe3cf'), g, 0.5 + i * 0.07, 0.36, (i % 2) * 0.1, 6); }
  }
  const pts: Array<[number, number, number, string, number]> = SECRETS.map(s => [X(s.x), 2.2, Z(s.y), '#fff0b4', 1]);
  anim.secretSparkles = makeGlows(pts, 1.4); scene.add(anim.secretSparkles);
}

// ---------------------------------------------------------------- fireworks
const FMAX = 9000;
const fw = {
  pos: new Float32Array(FMAX * 3), col: new Float32Array(FMAX * 3), base: new Float32Array(FMAX * 3),
  vel: new Float32Array(FMAX * 3), life: new Float32Array(FMAX), max: new Float32Array(FMAX), drag: new Float32Array(FMAX), grav: new Float32Array(FMAX),
  kind: new Uint8Array(FMAX), // 0 spark, 1 shell
  type: [] as string[], next: 0, points: null as THREE.Points, flash: 0,
};
const FCOL = ['#ff5a4e', '#f4b63f', '#3fc7a5', '#ff8ad8', '#8fb4ff', '#ffffff', '#ffd27a'];
let onBoom: (() => void) | null = null;
const chrysCol = new Map<number, string>(); // sparks that change colour halfway
function fwAdd(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, col: string, drag: number, g: number, kind = 0, type = ''): void {
  const i = fw.next; fw.next = (fw.next + 1) % FMAX;
  fw.pos.set([x, y, z], i * 3); fw.vel.set([vx, vy, vz], i * 3);
  const c = new THREE.Color(col); fw.base.set([c.r, c.g, c.b], i * 3);
  fw.life[i] = life; fw.max[i] = life; fw.drag[i] = drag; fw.grav[i] = g; fw.kind[i] = kind; fw.type[i] = type;
}
export const FW_TYPES = ['peony', 'ring', 'willow', 'crossette', 'heart', 'palm', 'strobe', 'chrys', 'double', 'brocade', 'kamuro', 'lotus', 'star', 'goldrain'];
/** Sends up one shell. Optional spot (metres), type and how high it climbs. */
export function launchFirework(o: { x?: number; z?: number; type?: string; up?: number } = {}): void {
  const x = o.x ?? rand(0, 160), z = o.z ?? rand(-40, 4), col = pick(FCOL), type = o.type ?? pick(['peony', 'peony', ...FW_TYPES]);
  const up = o.up ?? rand(30, 40);
  fwAdd(x, 1, z, rand(-1, 1), up, rand(-1, 1), up / 22, '#ffdca0', 0.1, 9.8, 1, type + '|' + col);
}
function burst(i: number): void {
  const [type, col] = fw.type[i].split('|');
  const x = fw.pos[i * 3], y = fw.pos[i * 3 + 1], z = fw.pos[i * 3 + 2];
  const n = type === 'willow' || type === 'brocade' || type === 'kamuro' ? 170 : type === 'palm' ? 12 : type === 'heart' ? 110 : 130;
  const ax = new THREE.Vector3(rand(-1, 1), rand(-0.3, 0.3), rand(-1, 1)).normalize(), v = new THREE.Vector3(), perp = new THREE.Vector3();
  const col2 = pick(FCOL.filter(c => c !== col));
  if (type === 'lotus') {
    // ကြာပန်း: eight pink petals opening round a gold heart, like the lotus on a Thadingyut lantern
    for (let p = 0; p < 8; p++) {
      const a = p / 8 * TAU;
      for (let k = 0; k < 16; k++) { const u = k / 15, w = Math.sin(u * Math.PI) * 0.35, b = a + (k % 2 ? w : -w);
        fwAdd(x, y, z, Math.cos(b) * (6 + u * 9), 3 + u * 7 - u * u * 6, Math.sin(b) * (6 + u * 9), rand(1.6, 2.1), u > 0.7 ? '#ffffff' : '#ff8ad8', 1.1, 3); }
    }
    for (let k = 0; k < 30; k++) { v.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(1.5, 3)); fwAdd(x, y, z, v.x, v.y, v.z, rand(1.4, 1.9), '#ffd27a', 1, 1.5); }
    fw.flash = Math.min(1, fw.flash + 0.5); onBoom?.(); return;
  }
  if (type === 'star') {
    for (let k = 0; k < 150; k++) { const a = k / 150 * TAU, r5 = 0.55 + 0.45 * Math.abs(Math.cos(a * 2.5)) ** 3;
      fwAdd(x, y, z, Math.sin(a) * 15 * r5, Math.cos(a) * 15 * r5, rand(-0.5, 0.5), rand(1.5, 1.9), k % 9 ? '#ffe28a' : '#ffffff', 1.1, 1.5); }
    fw.flash = Math.min(1, fw.flash + 0.5); onBoom?.(); return;
  }
  if (type === 'goldrain') {
    for (let k = 0; k < 190; k++) { v.set(rand(-1, 1), rand(-0.2, 1), rand(-1, 1)).normalize().multiplyScalar(rand(4, 9)); fwAdd(x, y, z, v.x, v.y, v.z, rand(3.4, 4.4), '#ffcf6a', 1.6, 2.2, 4); }
    fw.flash = Math.min(1, fw.flash + 0.4); onBoom?.(); return;
  }
  if (type === 'double') for (let k = 0; k < 70; k++) { v.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(4, 7)); fwAdd(x, y, z, v.x, v.y, v.z, rand(1.0, 1.4), col2, 1.0, 5); }
  for (let k = 0; k < n; k++) {
    if (type === 'heart') {
      const a = k / n * TAU, hx = 16 * Math.pow(Math.sin(a), 3), hy = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
      fwAdd(x, y, z, hx * 0.8, hy * 0.8, rand(-0.5, 0.5), rand(1.6, 2.0), Math.random() < 0.15 ? '#ffffff' : '#ff6f91', 1.2, 1.5); continue;
    }
    if (type === 'palm') { v.set(rand(-1, 1), rand(-0.2, 1), rand(-1, 1)).normalize().multiplyScalar(rand(13, 17)); fwAdd(x, y, z, v.x, v.y, v.z, rand(2.2, 2.8), '#ffd27a', 0.8, 5, 4); continue; }
    if (type === 'ring') { const a = k / n * TAU; perp.set(Math.cos(a), Math.sin(a), 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), ax.z).normalize(); v.copy(perp).multiplyScalar(16); }
    else { v.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(type === 'willow' ? rand(5, 11) : rand(8, 17)); }
    const gold = type === 'willow' || type === 'brocade' || type === 'kamuro';
    const c = gold ? (type === 'kamuro' ? '#fff1c9' : '#ffd27a') : type === 'strobe' ? '#ffffff' : Math.random() < 0.2 ? '#ffffff' : col;
    const kind = type === 'crossette' ? 2 : type === 'chrys' ? 3 : type === 'strobe' ? 5 : type === 'brocade' || type === 'kamuro' ? 4 : 0;
    if (type === 'chrys') chrysCol.set(fw.next, col2);
    fwAdd(x, y, z, v.x, v.y, v.z, gold ? rand(2.6, 3.4) : rand(1.3, 2.0), c, gold ? 1.4 : 1.0, gold ? 3 : 6, kind);
  }
  fw.flash = Math.min(1, fw.flash + 0.5);
  onBoom?.();
}
function updateFireworks(dt: number): void {
  for (let i = 0; i < FMAX; i++) {
    if (fw.life[i] <= 0) { fw.col[i * 3] = fw.col[i * 3 + 1] = fw.col[i * 3 + 2] = 0; continue; }
    const d = Math.pow(0.3, dt * fw.drag[i]);
    fw.vel[i * 3] *= d; fw.vel[i * 3 + 1] = fw.vel[i * 3 + 1] * d - fw.grav[i] * dt; fw.vel[i * 3 + 2] *= d;
    fw.pos[i * 3] += fw.vel[i * 3] * dt; fw.pos[i * 3 + 1] += fw.vel[i * 3 + 1] * dt; fw.pos[i * 3 + 2] += fw.vel[i * 3 + 2] * dt;
    fw.life[i] -= dt;
    if (fw.kind[i] === 1 && (fw.life[i] <= 0 || fw.vel[i * 3 + 1] < 2)) { fw.life[i] = 0; burst(i); continue; }
    // rockets and comets leave a glittering trail
    if ((fw.kind[i] === 1 || fw.kind[i] === 4) && Math.random() < (fw.kind[i] === 1 ? 0.9 : 0.35)) fwAdd(fw.pos[i * 3], fw.pos[i * 3 + 1], fw.pos[i * 3 + 2], rand(-0.4, 0.4), rand(-1, 0), rand(-0.4, 0.4), rand(0.3, 0.6), fw.kind[i] === 1 ? '#ffb060' : '#ffd27a', 2, 2);
    if (fw.kind[i] === 3 && fw.life[i] < fw.max[i] * 0.5) { const c = new THREE.Color(chrysCol.get(i) || '#8fb4ff'); fw.base.set([c.r, c.g, c.b], i * 3); fw.kind[i] = 0; chrysCol.delete(i); }
    if (fw.kind[i] === 2 && fw.life[i] < fw.max[i] * 0.45) { fw.kind[i] = 0; for (let k = 0; k < 4; k++) { const a = k / 4 * TAU; fwAdd(fw.pos[i * 3], fw.pos[i * 3 + 1], fw.pos[i * 3 + 2], Math.cos(a) * 6, rand(-1, 1), Math.sin(a) * 6, 0.7, '#ffffff', 1.2, 4); } }
    const a = clamp(fw.life[i] / Math.min(fw.max[i], 1.2), 0, 1) * (fw.kind[i] === 5 ? (Math.random() < 0.45 ? 0 : 1.6) : 0.75 + Math.random() * 0.25);
    fw.col[i * 3] = fw.base[i * 3] * a; fw.col[i * 3 + 1] = fw.base[i * 3 + 1] * a; fw.col[i * 3 + 2] = fw.base[i * 3 + 2] * a;
  }
  const g = fw.points.geometry;
  (g.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true; (g.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  fw.flash = Math.max(0, fw.flash - dt * 1.6);
}
export function fireworksActive(): boolean { for (let i = 0; i < FMAX; i += 7) if (fw.life[i] > 0) return true; return false; }

// ---------------------------------------------------------------- steam
const STEAM_N = 90;
const steam = { pos: new Float32Array(STEAM_N * 3), life: new Float32Array(STEAM_N), col: new Float32Array(STEAM_N * 3) };

// ---------------------------------------------------------------- public API
export function init3d(canvas: HTMLCanvasElement, boom: () => void): void {
  onBoom = boom;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setClearColor('#0d0a24');
  scene.fog = new THREE.Fog('#1a1238', 70, 340);
  scene.add(hemi, moonLight, sunLight, ambient);
  scene.add(camera); camera.add(fpArm); fpArm.position.set(0.34, -0.3, -0.75); fpArm.visible = false;
  const skin = new THREE.MeshLambertMaterial({ color: '#c58c5c', depthTest: false });
  const fa = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.3, 4, 8), skin); fa.position.y = 0.15; fa.renderOrder = 10; fpArm.add(fa);
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), skin); hand.position.y = 0.36; hand.scale.set(1, 1.2, 0.5); hand.renderOrder = 10; fpArm.add(hand);
  moonLight.position.set(80, 120, -160);
}
// ---------------------------------------------------------------- little effects: footstep dust and sky lanterns
let glowPts: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
const DUST_N = 48;
const dust = { pos: new Float32Array(DUST_N * 3), col: new Float32Array(DUST_N * 3), vel: new Float32Array(DUST_N * 3), life: new Float32Array(DUST_N), max: new Float32Array(DUST_N), next: 0, pts: null as THREE.Points };
function buildDust(): void {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(dust.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(dust.col, 3));
  dust.pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.55, map: glowSprite, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  dust.pts.frustumCulled = false; scene.add(dust.pts);
}
function kickDust(r: Rig, spd: number): void {
  const n = spd > 1.2 ? 4 : 2;
  for (let k = 0; k < n; k++) {
    const i = dust.next; dust.next = (dust.next + 1) % DUST_N;
    const a = rand(0, TAU), v = rand(0.3, 0.9) * (0.6 + spd * 0.4);
    dust.pos.set([r.g.position.x + rand(-0.15, 0.15), 0.08, r.g.position.z + rand(-0.15, 0.15)], i * 3);
    dust.vel.set([Math.cos(a) * v, rand(0.4, 0.9), Math.sin(a) * v], i * 3);
    dust.life[i] = dust.max[i] = rand(0.45, 0.8);
  }
}
function updateDust(dt: number): void {
  if (!dust.pts) return;
  for (let i = 0; i < DUST_N; i++) {
    if (dust.life[i] <= 0) { dust.col.set([0, 0, 0], i * 3); continue; }
    dust.life[i] -= dt; const k = Math.max(0, dust.life[i] / dust.max[i]) * 0.35;
    for (let j = 0; j < 3; j++) { dust.pos[i * 3 + j] += dust.vel[i * 3 + j] * dt; dust.vel[i * 3 + j] *= Math.exp(-dt * 3); }
    dust.col.set([0.95 * k, 0.75 * k, 0.5 * k], i * 3);
  }
  dust.pts.geometry.attributes.position.needsUpdate = true; dust.pts.geometry.attributes.color.needsUpdate = true;
}
// paper lanterns drifting up over the fair once it gets dark, like Tazaungdaing night
const SKY_N = 26;
const sky = { pos: new Float32Array(SKY_N * 3), col: new Float32Array(SKY_N * 3), seed: new Float32Array(SKY_N), pts: null as THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> };
function resetSkyLantern(i: number, y: number): void {
  sky.pos.set([X(rand(200, 1700)), y, Z(rand(300, 2400))], i * 3); sky.seed[i] = rand(0, 99);
  const c = new THREE.Color(pick(['#ffb347', '#ff8a3d', '#ffd27a'])).multiplyScalar(rand(0.6, 1)); sky.col.set([c.r, c.g, c.b], i * 3);
}
function buildSkyLanterns(): void {
  for (let i = 0; i < SKY_N; i++) resetSkyLantern(i, rand(8, 70));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(sky.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(sky.col, 3));
  sky.pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 2.4, map: glowSprite, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  sky.pts.frustumCulled = false; scene.add(sky.pts);
}
function updateSkyLanterns(t: number, dt: number, night: number): void {
  if (!sky.pts) return;
  sky.pts.material.opacity = clamp(night * 1.4 - 0.2, 0, 1); sky.pts.visible = sky.pts.material.opacity > 0;
  if (!sky.pts.visible) return;
  for (let i = 0; i < SKY_N; i++) {
    const o = i * 3, s = sky.seed[i];
    sky.pos[o] += (0.35 + Math.sin(t * 0.3 + s) * 0.25) * dt; sky.pos[o + 1] += (0.7 + (s % 1) * 0.5) * dt; sky.pos[o + 2] += Math.cos(t * 0.27 + s) * 0.2 * dt;
    if (sky.pos[o + 1] > 80) resetSkyLantern(i, 6);
  }
  sky.pts.geometry.attributes.position.needsUpdate = true;
}

// ---------------------------------------------------------------- Thadingyut wishes: fire balloons and pond lanterns
export interface WishSlot { id: string; k: 'sky' | 'water'; born: number }
interface WishObj { id: string; k: 'sky' | 'water'; born: number; seed: number; home: THREE.Vector3; from: THREE.Vector3; cur: THREE.Vector3; col: THREE.Color }
const WISH_CAP = 600;
const wishes = new Map<string, WishObj>();
let wishOrder: WishObj[] = [];
let balloonIM: THREE.InstancedMesh, cupIM: THREE.InstancedMesh, wishFlames: THREE.Points, wishHalos: THREE.Points;
const flamePos = new Float32Array(WISH_CAP * 2 * 3), flameCol = new Float32Array(WISH_CAP * 2 * 3);
const haloPos = new Float32Array(WISH_CAP * 3), haloCol = new Float32Array(WISH_CAP * 3);
function hash01(str: string, salt: number): number {
  let h = 2166136261 ^ salt; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}
const stallTop = () => new THREE.Vector3(X(WISH_STALL.x), 3.2, Z(WISH_STALL.y));
function buildWishPlace(): void {
  // the pond
  const pg = new THREE.CircleGeometry(1, 72);
  const pond = new THREE.Mesh(pg, new THREE.MeshLambertMaterial({ color: '#0d1840', emissive: '#0a1238', emissiveIntensity: 1 }));
  pond.rotation.x = -Math.PI / 2; pond.scale.set(POND.rx * M, POND.ry * M, 1); pond.position.set(X(POND.x), 0.04, Z(POND.y)); scene.add(pond);
  anim.pond = pond;
  const rim = new THREE.Mesh(new THREE.RingGeometry(1, 1.025, 96), lam('#8a7a64', { side: THREE.DoubleSide, k: 'rim' }));
  rim.rotation.x = -Math.PI / 2; rim.scale.copy(pond.scale); rim.position.set(X(POND.x), 0.06, Z(POND.y)); scene.add(rim);
  for (let k = 0; k < 56; k++) { const a = k / 56 * TAU; GLOWS.push([X(POND.x) + Math.cos(a) * (POND.rx + 18) * M, 0.25, Z(POND.y) + Math.sin(a) * (POND.ry + 18) * M, '#ffd27a', 0.55]); }
  // the wish stall
  const g = add(new THREE.Group(), scene, X(WISH_STALL.x), 0, Z(WISH_STALL.y));
  box(6, 1.1, 1.4, lam('#7a1f2b'), g, 0, 0.55, 0); box(6.2, 0.12, 1.6, lam('#f4b63f'), g, 0, 1.16, 0);
  for (const sx of [-2.9, 2.9]) cyl(0.08, 0.08, 3.2, lam('#d9c48a'), g, sx, 1.6, -0.6, 6);
  const roof = box(6.6, 0.18, 2.4, lam('#3fc7a5'), g, 0, 3.25, -0.2); roof.rotation.x = -0.12;
  board(signTex('ဆုတောင်း', 'Make a wish', '#2a1606', 512, 170), 3.6, 1.2, g, 0, 2.45, 0.2);
  const lg = new THREE.LatheGeometry(BALLOON_PROFILE, 10);
  for (let k = 0; k < 4; k++) { const b = add(new THREE.Mesh(lg, balloonMat()), g, -2.2 + k * 1.45, 3.85, 0.3); b.scale.setScalar(0.32); GLOWS.push([X(WISH_STALL.x) - 2.2 + k * 1.45, 3.62, Z(WISH_STALL.y) + 0.3, '#ffb347', 0.8]); }
  const pl = new THREE.PointLight('#ffb347', 18, 10, 2); pl.position.set(0, 2.6, 1.6); g.add(pl);
  // the wishes themselves
  balloonIM = new THREE.InstancedMesh(lg, balloonMat(), WISH_CAP); balloonIM.count = 0; balloonIM.frustumCulled = false;
  balloonIM.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(WISH_CAP * 3), 3); scene.add(balloonIM);
  cupIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.34, 0.18, 0.2, 8, 1, true), new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#4a2a10', side: THREE.DoubleSide }), WISH_CAP);
  cupIM.count = 0; cupIM.frustumCulled = false; cupIM.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(WISH_CAP * 3), 3); scene.add(cupIM);
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.BufferAttribute(flamePos, 3)); fg.setAttribute('color', new THREE.BufferAttribute(flameCol, 3));
  wishFlames = new THREE.Points(fg, new THREE.PointsMaterial({ size: 1.9, map: glowSprite, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  wishFlames.frustumCulled = false; scene.add(wishFlames);
  const hg = new THREE.BufferGeometry();
  hg.setAttribute('position', new THREE.BufferAttribute(haloPos, 3)); hg.setAttribute('color', new THREE.BufferAttribute(haloCol, 3));
  wishHalos = new THREE.Points(hg, new THREE.PointsMaterial({ size: 5.5, map: glowSprite, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  wishHalos.frustumCulled = false; scene.add(wishHalos);
  buildPondLife();
}
// a Taunggyi-style paper fire balloon, open at the bottom
const BALLOON_PROFILE = [[0.28, -0.95], [0.5, -0.6], [0.78, 0.05], [0.82, 0.6], [0.62, 1.1], [0.32, 1.38], [0.02, 1.48]].map(([r, y]) => new THREE.Vector2(r, y));
let _balloonMat: THREE.MeshBasicMaterial | null = null;
function balloonMat(): THREE.MeshBasicMaterial {
  if (_balloonMat) return _balloonMat;
  const tex = canvasTex(64, 128, c => {
    const gr = c.createLinearGradient(0, 128, 0, 0); gr.addColorStop(0, '#fff3c8'); gr.addColorStop(0.45, '#ffc76a'); gr.addColorStop(1, '#c8562e');
    c.fillStyle = gr; c.fillRect(0, 0, 64, 128);
    c.fillStyle = 'rgba(122,31,43,.35)'; for (const y of [26, 70]) c.fillRect(0, y, 64, 5);
    c.fillStyle = 'rgba(255,255,255,.25)'; for (let x = 0; x < 64; x += 16) c.fillRect(x, 0, 2, 128);
  });
  _balloonMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, fog: false });
  return _balloonMat;
}
// the pond moves: shimmering water, koi under the surface, lily pads, ripples and glints
const pond = { shimmer: null as THREE.Mesh, tex: null as THREE.CanvasTexture, koi: [] as Array<{ g: THREE.Group; tail: THREE.Mesh; a: number; b: number; sp: number; ph: number }>,
  rings: [] as Array<{ m: THREE.Mesh; t: number }>, ringNext: 0, glint: null as THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>,
  amb: null as THREE.InstancedMesh | null, ambF: null as THREE.Points | null, ambD: [] as Array<{ ra: number; a: number; dir: number; s: number }> };
function pondPoint(u: number, v: number, inset = 0.8): [number, number] {
  const ang = u * TAU, r = Math.sqrt(v) * inset; return [X(POND.x + Math.cos(ang) * POND.rx * r), Z(POND.y + Math.sin(ang) * POND.ry * r)];
}
function buildPondLife(): void {
  const cx = X(POND.x), cz = Z(POND.y), sx = POND.rx * M, sz = POND.ry * M;
  // a wavy, slowly drifting sheen over the water (the koi show through it)
  pond.tex = canvasTex(256, 256, c => {
    c.clearRect(0, 0, 256, 256); c.strokeStyle = 'rgba(150,190,255,.35)'; c.lineWidth = 2;
    for (let y = 8; y < 256; y += 22) { c.beginPath(); for (let x = 0; x <= 256; x += 8) { const yy = y + Math.sin(x / 256 * TAU * 2 + y) * 5; x ? c.lineTo(x, yy) : c.moveTo(x, yy); } c.stroke(); }
  }, true);
  pond.tex.repeat.set(4, 12);
  pond.shimmer = new THREE.Mesh(new THREE.CircleGeometry(1, 72), new THREE.MeshBasicMaterial({ map: pond.tex, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  pond.shimmer.rotation.x = -Math.PI / 2; pond.shimmer.scale.set(sx, sz, 1); pond.shimmer.position.set(cx, 0.075, cz); scene.add(pond.shimmer);
  // koi
  const koiCols = ['#ff7a2a', '#ffffff', '#ffb000', '#ff5038', '#f6f0e0', '#ff8f4a', '#e8402a', '#ff7a2a', '#ffffff', '#ffb000', '#ff5038', '#f6f0e0', '#ff8f4a', '#e8402a'];
  koiCols.forEach((col, i) => {
    const g = new THREE.Group(), mat = new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.25, transparent: true, opacity: 0.85 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 6), mat); body.scale.set(0.55, 0.32, 1.5); g.add(body);
    if (i % 2) { const spot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 5), lam('#ff3a20', { k: 'koi' })); spot.scale.set(0.9, 0.5, 1.2); spot.position.set(0, 0.05, 0.05); g.add(spot); }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.3, 4), mat); tail.rotation.x = -Math.PI / 2; tail.position.z = -0.38; tail.scale.set(1, 1, 0.25); g.add(tail);
    g.position.set(cx, 0.055, cz); scene.add(g);
    pond.koi.push({ g, tail, a: 0.35 + (i % 3) * 0.2, b: 0.3 + ((i + 1) % 3) * 0.18, sp: 0.12 + i * 0.025, ph: i * 1.7 });
  });
  // lily pads, some with a lotus
  for (let k = 0; k < 46; k++) {
    const [x, z] = pondPoint(hash01('pad' + k, 1), 0.35 + hash01('pad' + k, 2) * 0.65, 0.9);
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.45 + hash01('pad' + k, 3) * 0.3, 14, 0.4, TAU - 0.5), lam('#2f6b3a', { side: THREE.DoubleSide, k: 'pad' }));
    pad.rotation.x = -Math.PI / 2; pad.rotation.z = k; pad.position.set(x, 0.085, z); scene.add(pad);
    if (k % 3 === 0) { const lot = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.28, 7, 1, true), lam('#ff9bc0', { side: THREE.DoubleSide, emissive: '#5a1a30', k: 'lotus' })); lot.rotation.x = Math.PI; lot.position.set(x + 0.1, 0.22, z); scene.add(lot); }
  }
  // ripples
  const rg = new THREE.RingGeometry(0.85, 1, 36);
  for (let k = 0; k < 18; k++) {
    const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: '#bcd6ff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.09; m.visible = false; scene.add(m); pond.rings.push({ m, t: 99 });
  }
  // glints on the water
  const gp: Array<[number, number, number, string, number?]> = [];
  for (let k = 0; k < 160; k++) { const [x, z] = pondPoint(hash01('g' + k, 1), hash01('g' + k, 2), 0.95); gp.push([x, 0.1, z, '#cfe0ff', 0.6]); }
  pond.glint = makeGlows(gp, 0.35); scene.add(pond.glint);
  // a whole flotilla of candle lanterns other visitors set adrift earlier, drifting slowly around the lake
  const AMB = 180, cols = ['#ffd0a0', '#ffb0c8', '#fff0b0', '#ffc080'].map(c => new THREE.Color(c));
  pond.amb = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.16, 0.18, 8, 1, true), new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#4a2a10', side: THREE.DoubleSide }), AMB);
  pond.amb.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(AMB * 3), 3); pond.amb.frustumCulled = false; scene.add(pond.amb);
  const fp: Array<[number, number, number, string, number?]> = [];
  for (let k = 0; k < AMB; k++) { pond.ambD.push({ ra: 0.12 + Math.sqrt(hash01('al' + k, 1)) * 0.82, a: hash01('al' + k, 2) * TAU, dir: k % 3 ? 1 : -1, s: k * 1.37 }); pond.amb.setColorAt(k, cols[k % 4]); fp.push([0, 0.5, 0, '#ffb347', 1]); fp.push([0, 0.04, 0, '#ffb347', 0.35]); }
  pond.ambF = makeGlows(fp, 1.5); pond.ambF.frustumCulled = false; scene.add(pond.ambF);
}
function ripple(x: number, z: number): void {
  const r = pond.rings.find(q => q.t > 2.6); if (!r) return; r.t = 0; r.m.position.x = x; r.m.position.z = z; r.m.visible = true;
}
function updatePond(t: number, dt: number): void {
  if (!pond.shimmer) return;
  pond.tex.offset.set(t * 0.012, Math.sin(t * 0.2) * 0.03);
  (pond.shimmer.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(t * 0.9) * 0.1;
  const cx = X(POND.x), cz = Z(POND.y), sx = POND.rx * M, sz = POND.ry * M;
  for (const k of pond.koi) {
    const u = t * k.sp + k.ph, x = cx + Math.sin(u) * sx * k.a * 1.15, z = cz + Math.sin(u * 2 + k.ph) * sz * k.b * 1.4;
    const nx = cx + Math.sin(u + 0.05) * sx * k.a * 1.15, nz = cz + Math.sin((u + 0.05) * 2 + k.ph) * sz * k.b * 1.4;
    k.g.position.set(x, 0.055, z); k.g.rotation.y = Math.atan2(nx - x, nz - z); k.tail.rotation.y = Math.sin(t * 9 + k.ph) * 0.5;
    if (Math.sin(t * 0.7 + k.ph * 3) > 0.995 && hash01(String(Math.floor(t * 4)), k.ph) > 0.5) ripple(x, z); // a koi comes up to the surface
  }
  pond.ringNext -= dt;
  if (pond.ringNext <= 0) {
    pond.ringNext = 0.25 + Math.random() * 0.6;
    const cand = wishOrder.filter(w => w.k === 'water');
    if (cand.length && Math.random() < 0.6) { const w = cand[Math.floor(Math.random() * cand.length)]; ripple(w.cur.x, w.cur.z); }
    else { const [x, z] = pondPoint(Math.random(), Math.random()); ripple(x, z); }
  }
  for (const r of pond.rings) {
    if (r.t > 2.6) { r.m.visible = false; continue; }
    r.t += dt; const u = r.t / 2.6; r.m.scale.setScalar(0.15 + u * 1.4); (r.m.material as THREE.MeshBasicMaterial).opacity = (1 - u) * 0.5;
  }
  pond.glint.material.size = 0.35 + Math.sin(t * 3.1) * 0.12;
  if (pond.amb && pond.ambF) {
    const fpos = pond.ambF.geometry.getAttribute('position') as THREE.BufferAttribute, fa = fpos.array as Float32Array;
    const fcol = pond.ambF.geometry.getAttribute('color') as THREE.BufferAttribute, fc = fcol.array as Float32Array;
    pond.ambD.forEach((d, k) => {
      const a = d.a + t * 0.003 * d.dir, x = cx + Math.cos(a) * d.ra * sx + Math.sin(t * 0.08 + d.s) * 0.4, z = cz + Math.sin(a) * d.ra * sz + Math.cos(t * 0.06 + d.s) * 0.7;
      wm.compose(wp.set(x, 0.1 + Math.sin(t * 1.1 + d.s) * 0.02, z), wq.setFromAxisAngle(wup, d.s), ws.setScalar(1.3)); pond.amb!.setMatrixAt(k, wm);
      fa.set([x, 0.48, z], k * 6); fa.set([x, 0.04, z + 0.4], k * 6 + 3);
      const fl = 0.8 + Math.sin(t * 11 + d.s * 3) * 0.12; fc.set([fl, 0.65 * fl, 0.28 * fl], k * 6); fc.set([0.35 * fl, 0.22 * fl, 0.1 * fl], k * 6 + 3);
    });
    pond.amb.instanceMatrix.needsUpdate = true; fpos.needsUpdate = true; fcol.needsUpdate = true;
  }
}

/** Adds new wishes and drops removed ones. A wish with a born time rises (or drifts out) from the stall. */
export function setWishes(list: WishSlot[]): void {
  const keep = new Set<string>();
  for (const w of list.slice(-WISH_CAP)) {
    keep.add(w.id);
    const cur = wishes.get(w.id);
    if (cur) { if (w.born >= 0 && cur.born < 0) { cur.born = w.born; cur.from.copy(w.k === 'sky' ? stallTop() : new THREE.Vector3(X(POND.x - POND.rx * 0.3), 0.1, Z(POND.y + POND.ry * 0.94))); } continue; }
    const a = hash01(w.id, 1), b = hash01(w.id, 2), c = hash01(w.id, 3), home = new THREE.Vector3();
    if (w.k === 'sky') {
      // they gather over the lake, low enough to see from the shore
      const ang = a * TAU, r = Math.sqrt(b);
      home.set(X(POND.x) + Math.cos(ang) * r * (POND.rx * M + 8), 5 + c * 12, Z(POND.y) + Math.sin(ang) * r * (POND.ry * M - 6));
    } else {
      const ang = a * TAU, r = 0.15 + Math.sqrt(b) * 0.75;
      home.set(X(POND.x + Math.cos(ang) * POND.rx * r), 0.1, Z(POND.y + Math.sin(ang) * POND.ry * r));
    }
    const from = w.k === 'sky' ? stallTop() : new THREE.Vector3(X(POND.x - POND.rx * 0.3), 0.1, Z(POND.y + POND.ry * 0.94));
    const col = new THREE.Color().setHSL(w.k === 'sky' ? 0.03 + c * 0.1 : [0.95, 0.12, 0.0, 0.55][Math.floor(c * 4)], w.k === 'sky' ? 0.9 : 0.75, w.k === 'sky' ? 0.62 : 0.72);
    wishes.set(w.id, { id: w.id, k: w.k, born: w.born, seed: a * 100, home, from, cur: home.clone(), col });
  }
  for (const id of [...wishes.keys()]) if (!keep.has(id)) wishes.delete(id);
  wishOrder = [...wishes.values()];
}
/** Where a wish is right now, in map units plus height in metres (for its text label). */
export function wishSpot(id: string): [number, number, number] | null {
  const w = wishes.get(id); if (!w) return null;
  return [w.cur.x / M, w.cur.z / M, w.cur.y];
}
const wm = new THREE.Matrix4(), wq = new THREE.Quaternion(), ws = new THREE.Vector3(), wp = new THREE.Vector3(), wup = new THREE.Vector3(0, 1, 0);
function updateWishes(t: number, night: number): void {
  if (!balloonIM) return;
  let nb = 0, nc = 0, nf = 0, nh = 0;
  for (const w of wishOrder) {
    const age = w.born >= 0 ? t - w.born : 99, s = w.seed;
    if (w.k === 'sky') {
      const dur = 9, u = clamp(age / dur, 0, 1), e = 1 - Math.pow(1 - u, 3);
      w.cur.lerpVectors(w.from, w.home, e);
      w.cur.y = lerp(w.from.y, w.home.y, Math.min(1, u * 1.15)) + Math.sin(t * 0.5 + s) * 0.5;
      w.cur.x += Math.sin(t * 0.21 + s) * 0.9; w.cur.z += Math.cos(t * 0.17 + s) * 0.6;
      wp.copy(w.cur); wq.setFromAxisAngle(wup, t * 0.1 + s); ws.setScalar(1.5 * (age < 1 ? 0.3 + age * 0.7 : 1));
      wm.compose(wp, wq, ws); balloonIM.setMatrixAt(nb, wm); balloonIM.setColorAt(nb, w.col); nb++;
      const fl = 0.85 + Math.sin(t * 13 + s * 3) * 0.1 + Math.sin(t * 7.3 + s) * 0.05;
      flamePos.set([w.cur.x, w.cur.y - 0.75 * ws.x, w.cur.z], nf * 3); flameCol.set([1.0 * fl, 0.62 * fl, 0.25 * fl], nf * 3); nf++;
      haloPos.set([w.cur.x, w.cur.y + 0.4 * ws.x, w.cur.z], nh * 3); haloCol.set([0.55 * fl, 0.3 * fl, 0.1 * fl], nh * 3); nh++;
    } else {
      // every lantern drifts very slowly around the lake on its own loop (about half an hour a lap); a new one floats out from the stall
      const u = clamp(age / 40, 0, 1), e = u * u * (3 - 2 * u);
      const hx = w.home.x - X(POND.x), hz = w.home.z - Z(POND.y), ra = Math.hypot(hx / (POND.rx * M), hz / (POND.ry * M)), a0 = Math.atan2(hz / (POND.ry * M), hx / (POND.rx * M)) + t * 0.0035 * (s % 2 > 1 ? 1 : -1);
      wp.set(X(POND.x) + Math.cos(a0) * ra * POND.rx * M, 0.1, Z(POND.y) + Math.sin(a0) * ra * POND.ry * M);
      w.cur.lerpVectors(w.from, wp, e);
      w.cur.x += Math.sin(t * 0.09 + s) * 0.5; w.cur.z += Math.cos(t * 0.07 + s) * 0.8; w.cur.y = 0.1 + Math.sin(t * 1.1 + s) * 0.025;
      wp.copy(w.cur); wq.setFromAxisAngle(wup, t * 0.05 + s); ws.setScalar(1);
      ws.setScalar(1.6); wm.compose(wp, wq, ws); cupIM.setMatrixAt(nc, wm); cupIM.setColorAt(nc, w.col); nc++;
      const fl = 0.8 + Math.sin(t * 11 + s * 3) * 0.12;
      flamePos.set([w.cur.x, w.cur.y + 0.45, w.cur.z], nf * 3); flameCol.set([1.0 * fl, 0.7 * fl, 0.3 * fl], nf * 3); nf++;
      haloPos.set([w.cur.x, w.cur.y + 0.3, w.cur.z], nh * 3); haloCol.set([0.35 * fl, 0.2 * fl, 0.08 * fl], nh * 3); nh++;
      flamePos.set([w.cur.x, 0.05, w.cur.z + 0.5], nf * 3); flameCol.set([0.35 * fl, 0.22 * fl, 0.1 * fl], nf * 3); nf++; // reflection
    }
  }
  balloonIM.count = nb; cupIM.count = nc;
  balloonIM.instanceMatrix.needsUpdate = cupIM.instanceMatrix.needsUpdate = true;
  if (balloonIM.instanceColor) balloonIM.instanceColor.needsUpdate = true; if (cupIM.instanceColor) cupIM.instanceColor.needsUpdate = true;
  wishFlames.geometry.setDrawRange(0, nf); wishHalos.geometry.setDrawRange(0, nh);
  wishHalos.geometry.attributes.position.needsUpdate = true; wishHalos.geometry.attributes.color.needsUpdate = true;
  wishFlames.geometry.attributes.position.needsUpdate = true; wishFlames.geometry.attributes.color.needsUpdate = true;
  (anim.pond.material as THREE.MeshLambertMaterial).emissiveIntensity = 1 + Math.sin(t * 0.8) * 0.15 + night * 0.2;
}

// ---------------------------------------------------------------- food that looks like the dish on the sign
const DS = THREE.DoubleSide;
const bowlGeo = new THREE.LatheGeometry([[0, 0], [0.09, 0], [0.12, 0.015], [0.17, 0.08], [0.19, 0.105], [0.185, 0.11]].map(([x, y]) => new THREE.Vector2(x, y)), 18);
const plateGeo = new THREE.CylinderGeometry(0.2, 0.15, 0.03, 18);
function disc(r: number, mat: THREE.Material, parent: THREE.Object3D, x: number, y: number, z: number): THREE.Mesh {
  const m = add(new THREE.Mesh(new THREE.CircleGeometry(r, 18), mat), parent, x, y, z); m.rotation.x = -Math.PI / 2; return m;
}
function bowl(g: THREE.Object3D, x: number, y: number, z: number, s: number, rim: string, fill: string, glass = false): THREE.Group {
  const b = add(new THREE.Group(), g, x, y, z); b.scale.setScalar(s);
  add(new THREE.Mesh(bowlGeo, glass ? new THREE.MeshLambertMaterial({ color: '#cfeaff', transparent: true, opacity: 0.45, side: DS }) : lam(rim, { side: DS, k: 'ds' })), b);
  disc(0.165, lam(fill, { emissive: fill, emissiveIntensity: 0.15, k: 'fill' }), b, 0, 0.085, 0);
  return b;
}
function bits(g: THREE.Object3D, n: number, r: number, cols: string[], x: number, y: number, z: number, spread: number, seed: number, shape: 'box' | 'ball' = 'ball'): void {
  const rnd = srng(seed);
  for (let k = 0; k < n; k++) {
    const a = rnd() * TAU, d = Math.sqrt(rnd()) * spread, c = cols[k % cols.length];
    const m = shape === 'box' ? box(r * 2, r, r * 1.4, lam(c), g, x + Math.cos(a) * d, y, z + Math.sin(a) * d) : sphere(r, lam(c), g, x + Math.cos(a) * d, y, z + Math.sin(a) * d, 6);
    m.rotation.y = rnd() * 3;
  }
}
const embers: THREE.MeshLambertMaterial[] = [];
function buildDish(g: THREE.Group, id: string): void {
  const Y = 1.86, Zf = 0.18; // a ledge along the front of the counter
  box(5.8, 0.06, 0.46, lam('#8a6a4a'), g, 0, 1.83, Zf);
  if (id === 'mohinga') {
    const pot = cyl(0.42, 0.36, 0.55, lam('#b8bcc8'), g, -2.3, Y + 0.27, -0.55, 18); pot.name = 'pot';
    disc(0.4, lam('#c8742c', { emissive: '#7a3410', emissiveIntensity: 0.4, k: 'broth' }), g, -2.3, Y + 0.56, -0.55);
    for (let k = 0; k < 4; k++) {
      const x = -1.35 + k * 0.82, b = bowl(g, x, Y, Zf, 1, '#f3efe6', '#c8742c');
      for (let r = 0; r < 4; r++) { const n = add(new THREE.Mesh(new THREE.TorusGeometry(0.05 + r * 0.025, 0.008, 4, 14), lam('#f7f1e1')), b, 0.02 * r - 0.03, 0.095, 0); n.rotation.x = Math.PI / 2; }
      box(0.09, 0.03, 0.06, lam('#d99b3a'), b, 0.06, 0.105, -0.05).rotation.y = 0.5;   // pe kyaw fritters
      box(0.08, 0.03, 0.05, lam('#c88a2e'), b, -0.07, 0.105, 0.05).rotation.y = -0.4;
      sphere(0.035, lam('#ffffff'), b, -0.05, 0.1, -0.06, 8); sphere(0.018, lam('#f4b63f'), b, -0.05, 0.12, -0.06, 6); // half a boiled egg
      bits(b, 7, 0.012, ['#3d8a3a', '#5aa64a'], 0, 0.1, 0, 0.12, k + 3);                                       // coriander
    }
    const bas = cyl(0.32, 0.24, 0.16, lam('#8a5a2a'), g, 2.25, Y + 0.08, Zf, 14); bas.name = 'basket';
    bits(g, 12, 0.05, ['#d99b3a', '#c88a2e', '#e6b04a'], 2.25, Y + 0.18, Zf, 0.22, 9, 'box');
  } else if (id === 'mlmy') {
    const pan = cyl(0.62, 0.62, 0.1, lam('#2a2622'), g, -1.0, Y + 0.12, -0.2, 22);
    cyl(0.5, 0.55, 0.2, lam('#3a2a20'), g, -1.0, Y - 0.02, -0.2, 14);
    const coal = new THREE.MeshLambertMaterial({ color: '#ff6a20', emissive: '#ff4a10', emissiveIntensity: 1 }); embers.push(coal);
    cyl(0.48, 0.48, 0.02, coal, g, -1.0, Y + 0.06, -0.2, 14);
    const dome = new THREE.SphereGeometry(0.075, 12, 6, 0, TAU, 0, Math.PI / 2), gold = lam('#e0a040');
    for (let k = 0; k < 7; k++) { const a = k / 7 * TAU, r = k === 6 ? 0 : 0.36; add(new THREE.Mesh(dome, gold), pan, k === 6 ? 0 : Math.cos(a) * r, 0.05, k === 6 ? 0 : Math.sin(a) * r); }
    add(new THREE.Mesh(plateGeo, lam('#f3efe6')), g, 0.8, Y + 0.02, Zf).scale.set(1.6, 1, 1.6);
    for (let k = 0; k < 5; k++) { // "husband and wife": two halves pressed together, a quail egg on top
      const x = 0.55 + (k % 3) * 0.2, z = Zf - 0.08 + Math.floor(k / 3) * 0.16;
      add(new THREE.Mesh(dome, gold), g, x, Y + 0.04, z).rotation.x = Math.PI; add(new THREE.Mesh(dome, lam('#d59030')), g, x, Y + 0.04, z);
      sphere(0.025, lam('#ffd23f'), g, x, Y + 0.115, z, 6);
    }
    bits(g, 10, 0.02, ['#f3efe6'], 2.0, Y + 0.03, Zf, 0.15, 4); // a dish of quail eggs
  } else if (id === 'shweyinaye') {
    for (let k = 0; k < 4; k++) {
      const b = bowl(g, -1.4 + k * 0.9, Y, Zf, 1.05, '', '#f6efe1', true);
      for (let j = 0; j < 6; j++) box(0.1, 0.018, 0.025, lam(['#3fae7a', '#ff6f91', '#e0353f'][j % 3]), b, -0.08 + (j % 3) * 0.07, 0.1, -0.06 + Math.floor(j / 3) * 0.1).rotation.y = j;
      bits(b, 10, 0.012, ['#ffffff'], 0, 0.1, 0, 0.13, k + 11);                                                      // sago
      const ice = add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8, 0, TAU, 0, Math.PI / 2), lam('#f7fbff', { emissive: '#8ab4ff', emissiveIntensity: 0.15, k: 'ice' })), b, 0, 0.09, 0); ice.scale.y = 0.8;
    }
    box(0.5, 0.35, 0.35, new THREE.MeshLambertMaterial({ color: '#dff2ff', transparent: true, opacity: 0.55 }), g, 2.2, Y + 0.18, -0.5); // block of ice
    cyl(0.12, 0.14, 0.32, new THREE.MeshLambertMaterial({ color: '#f6efe1', transparent: true, opacity: 0.85 }), g, -2.3, Y + 0.16, Zf, 12); // coconut milk jug
  } else if (id === 'laphet') {
    const tray = cyl(0.55, 0.5, 0.08, lam('#7a1f2b'), g, -1.4, Y + 0.04, -0.15, 24); tray.name = 'tray';
    const heaps: Array<[string, number]> = [['#3a5a1e', 0.11], ['#d8c08a', 0.07], ['#8a5a2a', 0.07], ['#f3efe6', 0.06], ['#c23b2b', 0.05], ['#e6c45a', 0.05]];
    heaps.forEach(([c, r], k) => { const a = k / 6 * TAU; const h = sphere(r, lam(c), g, -1.4 + Math.cos(a) * 0.3, Y + 0.1, -0.15 + Math.sin(a) * 0.3, 8); h.scale.y = 0.5; });
    sphere(0.12, lam('#2f4a1a'), g, -1.4, Y + 0.12, -0.15, 10).scale.y = 0.45;
    for (let k = 0; k < 3; k++) {
      const x = 0.1 + k * 0.75; add(new THREE.Mesh(plateGeo, lam('#f3efe6')), g, x, Y + 0.02, Zf);
      const leaf = sphere(0.13, lam('#3d5a1e'), g, x, Y + 0.06, Zf, 10); leaf.scale.set(1, 0.4, 1);
      bits(g, 9, 0.022, ['#d8c08a', '#8a5a2a', '#e0353f', '#f3efe6'], x, Y + 0.1, Zf, 0.11, k + 21);
    }
  } else if (id === 'kyan') {
    const press = add(new THREE.Group(), g, -1.6, Y, -0.3);
    box(0.7, 0.6, 0.5, lam('#2f7a4a'), press, 0, 0.3, 0);
    for (const yy of [0.68, 0.84]) { const r = add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.55, 14), lam('#c8ccd8')), press, 0, yy, 0); r.rotation.z = Math.PI / 2; }
    const wheel = add(new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 6, 20), lam('#c23b4b')), press, 0.42, 0.76, 0); wheel.rotation.y = Math.PI / 2; wheel.name = 'presswheel';
    for (let k = 0; k < 9; k++) { // a bundle of sugarcane leaning on the cart
      const st = add(new THREE.Group(), g, 2.5 + (k % 3) * 0.09, 0, -0.1 + Math.floor(k / 3) * 0.09); st.rotation.z = -0.12 + k * 0.01;
      for (let j = 0; j < 7; j++) { cyl(0.035, 0.035, 0.36, lam(j % 2 ? '#9cae3a' : '#8a9a30'), st, 0, 0.18 + j * 0.37, 0, 6); cyl(0.042, 0.042, 0.02, lam('#6a6a22'), st, 0, 0.36 + j * 0.37, 0, 6); }
      if (k % 2) for (let j = 0; j < 3; j++) { const lf = box(0.04, 0.6, 0.01, lam('#5a8a2a'), st, 0.05, 2.7 + j * 0.1, 0); lf.rotation.z = 0.5 + j * 0.4; }
    }
    for (let k = 0; k < 4; k++) {
      const x = -0.5 + k * 0.6; cyl(0.07, 0.06, 0.2, new THREE.MeshLambertMaterial({ color: '#e8ffd8', transparent: true, opacity: 0.35 }), g, x, Y + 0.1, Zf, 12);
      cyl(0.062, 0.055, 0.16, lam('#c8d86a', { emissive: '#4a5a10', emissiveIntensity: 0.3, k: 'juice' }), g, x, Y + 0.085, Zf, 12);
      box(0.04, 0.04, 0.04, lam('#f7fbff'), g, x + 0.02, Y + 0.17, Zf); sphere(0.03, lam('#7ac83a'), g, x + 0.07, Y + 0.2, Zf, 6);
    }
  } else if (id === 'bbq') {
    const grill = add(new THREE.Group(), g, -0.3, Y, -0.1);
    box(2.6, 0.24, 0.7, lam('#2a2622'), grill, 0, 0.12, 0);
    const coal = new THREE.MeshLambertMaterial({ color: '#ff5a1a', emissive: '#ff3a00', emissiveIntensity: 1 }); embers.push(coal);
    box(2.4, 0.04, 0.55, coal, grill, 0, 0.22, 0);
    for (let k = 0; k < 12; k++) box(2.45, 0.015, 0.015, lam('#9a9a9a'), grill, 0, 0.26, -0.27 + k * 0.05);
    for (let k = 0; k < 11; k++) { // skewers: pork, chicken, peppers, tofu
      const sk = add(new THREE.Group(), grill, -1.1 + k * 0.22, 0.3, 0); sk.rotation.y = 0.05 * (k % 3);
      box(0.012, 0.012, 0.75, lam('#d8c08a'), sk, 0, 0, 0);
      for (let j = 0; j < 4; j++) box(0.07, 0.06, 0.08, lam(['#8a3a1e', '#a0522d', '#4a8a2a', '#e6c88a'][(j + k) % 4]), sk, 0, 0.02, -0.2 + j * 0.13);
    }
    for (let k = 0; k < 6; k++) { const sk = add(new THREE.Group(), g, 1.7 + (k % 3) * 0.2, Y + 0.05, Zf - 0.05 + Math.floor(k / 3) * 0.12); box(0.6, 0.012, 0.012, lam('#d8c08a'), sk, 0, 0, 0); for (let j = 0; j < 3; j++) box(0.08, 0.06, 0.07, lam(['#8a3a1e', '#c25a2a', '#4a8a2a'][j]), sk, -0.15 + j * 0.15, 0.02, 0); }
    const pl = new THREE.PointLight('#ff6a20', 6, 3, 2); pl.position.set(-0.3, Y + 0.6, 0.2); g.add(pl);
  }
}
function buildPweStall(f: { x: number; y: number; id: string; name: string; my: string; p: number }, i: number): void {
  // a bamboo-and-thatch snack stall with a hot oil wok, like the ones at every pwe
  const g = add(new THREE.Group(), scene, X(f.x), 0, Z(f.y)), col = ['#7a1f2b', '#2f5d50', '#8a5a1a'][i];
  const bamboo = lam('#c9a86a'), mat = new THREE.MeshLambertMaterial({ map: stripes('#d8b878', '#b8925a', 10) });
  box(6, 1.1, 1.8, mat, g, 0, 0.55, -0.9); box(6.02, 0.12, 1.82, lam('#6b4a2e'), g, 0, 1.12, -0.9);
  for (const sx of [-2.8, 2.8]) for (const sz of [-1.7, 0.2]) cyl(0.07, 0.07, 3.6, bamboo, g, sx, 1.8, sz, 6);
  const thatch = add(new THREE.Mesh(new THREE.ConeGeometry(4.4, 1.3, 4, 1, true), lam('#a8844a', { side: DS, k: 'thatch' })), g, 0, 4.15, -0.75); thatch.rotation.y = Math.PI / 4; thatch.scale.set(1, 1, 0.5);
  board(signTex(f.my, f.name + ' · ' + f.p.toLocaleString('en-US') + ' Ks', col, 512, 160), 4.2, 1.3, g, 0, 3.0, 0.25);
  stallLife(g, PWE_SHOPS[i], '#3a2414', 3.7, 0.4, 3.35);
  const Y = 1.18, Zf = -0.3;
  // the wok on its charcoal stove, with a bit of glow
  cyl(0.45, 0.5, 0.5, lam('#3a3030'), g, -1.8, Y + 0.25, Zf, 12); sphere(0.38, glowMat('#ff5a1a'), g, -1.8, Y + 0.5, Zf, 10).scale.y = 0.15;
  const wok = add(new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 8, 0, TAU, Math.PI * 0.6, Math.PI * 0.4), lam('#2a2a2a', { side: DS, k: 'wok' })), g, -1.8, Y + 1.05, Zf);
  disc(0.42, lam('#c98a2a', { emissive: '#3a1a00', k: 'oil' }), g, -1.8, Y + 0.62, Zf);
  const tray = (x: number) => { add(new THREE.Mesh(plateGeo, lam('#3f7a3a', { k: 'leaf' })), g, x, Y + 0.02, Zf).scale.set(2.6, 1, 2.2); }; // banana-leaf trays
  if (f.id === 'banana') {
    for (const x of [0, 1.4]) { tray(x); for (let k = 0; k < 6; k++) { const fr = add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 6), lam('#d9952a')), g, x - 0.25 + (k % 3) * 0.25, Y + 0.06 + Math.floor(k / 3) * 0.04, Zf - 0.12 + Math.floor(k / 3) * 0.22); fr.scale.set(1.4, 0.3, 0.8); fr.rotation.y = k; } }
  } else if (f.id === 'monlone') {
    for (const x of [0, 1.4]) { tray(x); for (let k = 0; k < 9; k++) sphere(0.07, lam('#f6f0e2'), g, x - 0.22 + (k % 3) * 0.22, Y + 0.08, Zf - 0.2 + Math.floor(k / 3) * 0.2, 8); bits(g, 30, 0.012, ['#ffffff', '#f2ead8'], x, Y + 0.1, Zf, 0.3, 50 + x * 10); }
  } else {
    for (const x of [0, 1.4]) { tray(x); for (let k = 0; k < 8; k++) { const tf = box(0.2, 0.06, 0.12, lam('#f2c23a'), g, x - 0.3 + (k % 4) * 0.2, Y + 0.06, Zf - 0.1 + Math.floor(k / 4) * 0.2); tf.rotation.y = k * 0.3; } }
    add(new THREE.Mesh(bowlGeo, lam('#ffffff')), g, 2.3, Y, Zf).scale.setScalar(0.8); disc(0.12, lam('#7a2a1a'), g, 2.3, Y + 0.08, Zf); // tamarind dip
  }
  GLOWS.push([X(f.x) - 2.8, 3.4, Z(f.y) + 0.2, '#ffd27a', 1], [X(f.x) + 2.8, 3.4, Z(f.y) + 0.2, '#ffd27a', 1]);
  const pl = new THREE.PointLight('#ffd9a0', 20, 9, 2); pl.position.set(0, 3.2, 0.6); g.add(pl);
}

// ---------------------------------------------------------------- pwe rides: bumper cars, the hand-turned wheel, the flying swing
export const BUMPER_N = 8;
const mid = {
  cars: [] as Array<{ g: THREE.Group; pole: THREE.Object3D }>, sparkPos: new Float32Array(260 * 3), sparkCol: new Float32Array(260 * 3), sparkVel: new Float32Array(260 * 3), sparkLife: new Float32Array(260), sparkNext: 0,
  sparks: null as THREE.Points, hw: null as THREE.Group, hwSeats: [] as THREE.Group[], hwSeat: null as THREE.Object3D, hwAngle: 0, drvSeat: null as THREE.Object3D, car3Driver: null as THREE.Object3D,
  swTop: null as THREE.Group, swChairs: [] as THREE.Group[], swSeat: null as THREE.Object3D, swAngle: 0, swW: 0,
};
const BCOLS = ['#e0353f', '#2d7bb6', '#e0a526', '#3fae7a', '#ff6f91', '#8a5ad8', '#ff8a3d', '#3fc7a5'];
function buildMidway(): void {
  // bumper car arena
  const ax = X(BUMPER.x + BUMPER.w / 2), az = Z(BUMPER.y + BUMPER.h / 2), aw = BUMPER.w * M, ah = BUMPER.h * M;
  const floorTex = canvasTex(128, 128, c => { c.fillStyle = '#2b3140'; c.fillRect(0, 0, 128, 128); c.strokeStyle = 'rgba(160,180,220,.18)'; c.lineWidth = 2; for (let k = 0; k <= 128; k += 32) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k, 128); c.moveTo(0, k); c.lineTo(128, k); c.stroke(); } }, true);
  floorTex.repeat.set(aw / 3, ah / 3);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(aw, ah), new THREE.MeshLambertMaterial({ map: floorTex })); floor.rotation.x = -Math.PI / 2; floor.position.set(ax, 0.03, az); scene.add(floor);
  const railMat = new THREE.MeshLambertMaterial({ map: stripes('#f4b63f', '#1b1420', 16) });
  const rail = (x: number, z: number, w: number, d: number) => box(w, 0.55, d, railMat, scene, x, 0.28, z);
  const x0 = X(BUMPER.x), x1 = X(BUMPER.x + BUMPER.w), z0 = Z(BUMPER.y), z1 = Z(BUMPER.y + BUMPER.h);
  rail(ax, z0, aw, 0.3); rail(x1, az, 0.3, ah);
  rail(x0, z0 + ah * 0.2, 0.3, ah * 0.4); rail(x0, z1 - ah * 0.2, 0.3, ah * 0.4);
  rail(x0 + aw * 0.2, z1, aw * 0.4, 0.3); rail(x1 - aw * 0.2, z1, aw * 0.4, 0.3);
  const post = lam('#c8ccd8');
  for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) cyl(0.14, 0.14, 4.8, post, scene, px, 2.4, pz, 8);
  // the electric ceiling: a wire grid the cars' poles drag along
  const pts: number[] = [], H = 4.6;
  for (let k = 0; k <= 20; k++) { const x = x0 + aw * k / 20; pts.push(x, H, z0, x, H, z1); }
  for (let k = 0; k <= 15; k++) { const z = z0 + ah * k / 15; pts.push(x0, H, z, x1, H, z); }
  const grid = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)), new THREE.LineBasicMaterial({ color: '#7a86b8' })); scene.add(grid);
  for (const [z, ry] of [[z0, 0], [z1, Math.PI]] as Array<[number, number]>) box(aw + 0.4, 0.5, 0.2, lam('#7a1f2b'), scene, ax, H + 0.25, z).rotation.y = ry;
  board(signTex('ကားတိုက်', 'Bumper cars', '#7a1f2b', 512, 160), 5, 1.55, scene, ax, H + 1.4, z1 + 0.1);
  for (let k = 0; k < 24; k++) GLOWS.push([x0 + aw * k / 23, H + 0.55, z1 + 0.12, LANTERN_COLS[k % 5], 1]);
  for (let k = 0; k < 24; k++) GLOWS.push([x0 + aw * k / 23, H + 0.55, z0 - 0.12, LANTERN_COLS[(k + 2) % 5], 1]);
  const al = new THREE.PointLight('#a8c0ff', 40, 18, 2); al.position.set(ax, H - 0.5, az); scene.add(al);
  const makeCar = (col: string, pole: boolean) => {
    const g = add(new THREE.Group(), scene, ax, 0, az);
    const body = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 0.7, 4, 12), lam(col)), g, 0, 0.42, 0); body.rotation.x = Math.PI / 2; body.scale.set(1, 1, 0.55);
    const bump = add(new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.13, 6, 24), lam('#1b1420')), g, 0, 0.32, 0); bump.rotation.x = Math.PI / 2; bump.scale.set(0.95, 1.3, 1);
    box(0.6, 0.35, 0.3, lam('#2a2238'), g, 0, 0.7, -0.25);
    const sw = add(new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 4, 12), lam('#2a2238')), g, 0, 0.85, 0.35); sw.rotation.x = -0.9;
    const p = add(new THREE.Group(), g, 0, 0, -0.55);
    if (pole) { cyl(0.03, 0.03, H - 0.6, lam('#c8ccd8'), p, 0, (H - 0.6) / 2 + 0.6, 0, 5); cyl(0.12, 0.12, 0.06, glowMat('#cfe0ff'), p, 0, H - 0.03, 0, 8); }
    else cyl(0.03, 0.03, 1.1, lam('#c8ccd8'), p, 0, 1.1, 0, 5); // parked: the pole is folded down
    sphere(0.09, glowMat('#ffe7a3'), g, 0.3, 0.55, 0.85, 6); sphere(0.09, glowMat('#ffe7a3'), g, -0.3, 0.55, 0.85, 6);
    return { g, pole: p };
  };
  // the empty cars waiting in a row by the gate for whoever is next in the queue
  PARKED.forEach(([x, y], k) => { const c = makeCar(BCOLS[(k + 3) % BCOLS.length], false); c.g.position.set(X(x), 0, Z(y)); c.g.rotation.y = Math.PI + (k % 2 ? 0.06 : -0.05); });
  for (let i = 0; i < BUMPER_N; i++) {
    const { g, pole } = makeCar(BCOLS[i % BCOLS.length], true);
    { const d = buildPerson({ shirt: pick(['#f3efe6', '#f7b7c3', '#9fd3f0', '#b5e6c8']), lon: pick(['#6b2335', '#2f5d50', '#283a6b']), skin: pick(['#d9a77a', '#c58c5c', '#a8714a']), s: 0.78, bun: i % 2 === 1 }); d.g.position.set(0, 0.15, -0.1); d.footL.visible = d.footR.visible = false; g.add(d.g); if (i === 3) mid.car3Driver = d.g; }
    if (i === 3) { mid.drvSeat = add(new THREE.Group(), g, 0, 0.32, -0.1); mid.drvSeat.name = 'seat'; }
    mid.cars.push({ g, pole });
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(mid.sparkPos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(mid.sparkCol, 3));
  mid.sparks = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.35, map: glowSprite, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  mid.sparks.frustumCulled = false; scene.add(mid.sparks);

  // the hand-turned wooden Ferris wheel (လူအားချားရဟတ်): no motor, young men climb the spokes and their weight turns it
  const hx = X(HAND_WHEEL.x), hz = Z(HAND_WHEEL.y), HUB = 6.4, R = 5.2;
  const wood = lam('#8a5a32'), dark = lam('#5a3a22');
  for (const sz of [-1.15, 1.15]) for (const sx of [-1, 1]) beam(new THREE.Vector3(hx + sx * 3.6, 0, hz + sz * 1.4), new THREE.Vector3(hx, HUB, hz + sz * 1.15), 0.13, dark, scene);
  for (const sz of [-1.15, 1.15]) box(7.4, 0.16, 0.16, dark, scene, hx, 1.2, hz + sz * 1.3);
  cyl(0.18, 0.18, 2.6, lam('#3a3030'), scene, hx, HUB, hz, 10).rotation.x = Math.PI / 2;
  mid.hw = add(new THREE.Group(), scene, hx, HUB, hz);
  const hwl: Array<[number, number, number, string, number?]> = [];
  for (const sz of [-0.85, 0.85]) {
    add(new THREE.Mesh(new THREE.TorusGeometry(R, 0.09, 6, 48), wood), mid.hw, 0, 0, sz);
    add(new THREE.Mesh(new THREE.TorusGeometry(R * 0.55, 0.06, 6, 32), wood), mid.hw, 0, 0, sz);
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + Math.PI / 8; beam(new THREE.Vector3(0, 0, sz), new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, sz), 0.06, wood, mid.hw); }
    for (let k = 0; k < 32; k++) { const a = k / 32 * TAU; hwl.push([Math.cos(a) * R, Math.sin(a) * R, sz * 1.08, LANTERN_COLS[k % 5], 0.9]); }
  }
  for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + Math.PI / 8; box(0.07, 0.07, 1.7, wood, mid.hw, Math.cos(a) * R * 0.78, Math.sin(a) * R * 0.78, 0); } // rungs the boys climb
  mid.hw.add(makeGlows(hwl, 0.75));
  const seatCols = ['#c23b4b', '#2f8f5e', '#e0a526', '#2d6bb6'];
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * TAU, hang = add(new THREE.Group(), mid.hw, Math.cos(a) * R, Math.sin(a) * R, 0);
    const seat = add(new THREE.Group(), hang, 0, 0, 0); // kept upright, swinging a little
    for (const sx of [-0.62, 0.62]) cyl(0.025, 0.025, 1.1, dark, seat, sx, -0.55, 0, 4);
    box(1.3, 0.1, 0.62, lam(seatCols[k % 4]), seat, 0, -1.1, 0); box(1.3, 0.55, 0.08, lam(seatCols[k % 4]), seat, 0, -0.85, -0.3);
    box(1.3, 0.05, 0.05, lam('#e9dcc4'), seat, 0, -0.62, 0.3); // the safety bar
    if (k === 0) mid.hwSeat = add(new THREE.Group(), seat, 0, -1.05, 0.05);
    else if (k % 2) { const r = buildPerson({ shirt: pick(['#f3efe6', '#f7b7c3', '#9fd3f0']), lon: pick(['#6b2335', '#283a6b', '#2f5d50']), skin: pick(['#d9a77a', '#c58c5c']), s: 0.78, bun: k % 3 === 0 }); r.g.position.set(0, -1.45, 0.05); r.footL.visible = r.footR.visible = false; seat.add(r.g); }
    mid.hwSeats.push(seat);
  }
  // the boys who turn it: hanging off the spokes in white singlets and tucked-up longyi
  for (let k = 0; k < 3; k++) {
    const a = k / 3 * TAU + 0.5, r = buildPerson({ shirt: '#ffffff', lon: pick(['#3c5a2a', '#6b2335', '#283a6b']), skin: pick(['#a8714a', '#b07a50', '#8a5a3a']), s: 0.95, pat: 'check' });
    r.g.position.set(Math.cos(a) * R * 0.72, Math.sin(a) * R * 0.72 - 0.9, 0.35); r.armL.rotation.z = -2.8; r.armR.rotation.z = 2.8; mid.hw.add(r.g);
  }
  board(signTex('လူအားချားရဟတ်', 'Hand-turned wheel · 1,500 Ks', '#2a1606', 512, 160), 3.8, 1.2, scene, hx, 2.0, hz + 2.6);

  // the flying swing (ဒန်းလွှဲ), under a tiered golden roof like a pagoda's
  const wx = X(SWINGER.x), wz = Z(SWINGER.y);
  cyl(2.8, 3.1, 0.5, lam('#3a3350'), scene, wx, 0.25, wz, 24);
  cyl(0.45, 0.6, 8, lam('#e9dcc4'), scene, wx, 4, wz, 14);
  mid.swTop = add(new THREE.Group(), scene, wx, 8, wz);
  const roofRed = lam('#9a2230', { side: DS, k: 'roofred' }), roofGold = lam('#e0b45a', { emissive: '#4a3008', k: 'roofgold' });
  [[4.8, 1.4, 0.5], [3.4, 1.2, 1.5], [2.1, 1.0, 2.4]].forEach(([r, h, y], k) => { add(new THREE.Mesh(new THREE.ConeGeometry(r, h, 24, 1, true), k % 2 ? roofGold : roofRed), mid.swTop, 0, y, 0); cyl(r * 0.62, r * 0.62, 0.35, k % 2 ? roofRed : roofGold, mid.swTop, 0, y - h / 2 + 0.1, 0, 20); });
  add(new THREE.Mesh(new THREE.ConeGeometry(0.4, 2.2, 12), roofGold), mid.swTop, 0, 4.0, 0); sphere(0.12, glowMat('#ffffff'), mid.swTop, 0, 5.2, 0, 8);
  cyl(4.8, 4.8, 0.35, roofGold, mid.swTop, 0, -0.35, 0, 24);
  const sl: Array<[number, number, number, string, number?]> = [];
  for (let k = 0; k < 32; k++) { const a = k / 32 * TAU; sl.push([Math.cos(a) * 4.85, -0.35, Math.sin(a) * 4.85, LANTERN_COLS[k % 5], 1]); }
  mid.swTop.add(makeGlows(sl, 0.9));
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * TAU, hang = add(new THREE.Group(), mid.swTop, Math.cos(a) * 4.2, -0.4, Math.sin(a) * 4.2); hang.rotation.y = -a;
    const chair = add(new THREE.Group(), hang, 0, 0, 0);
    for (const sx of [-0.2, 0.2]) cyl(0.008, 0.008, 3.6, lam('#cfd3e8'), chair, sx, -1.8, 0, 3);
    box(0.5, 0.08, 0.45, lam(BCOLS[k % 8]), chair, 0, -3.6, 0); box(0.5, 0.45, 0.06, lam(BCOLS[k % 8]), chair, 0, -3.35, -0.2);
    if (k === 0) { mid.swSeat = add(new THREE.Group(), chair, 0, -3.55, 0); }
    else if (k % 2) { const r = buildPerson({ shirt: pick(['#f3efe6', '#f7b7c3', '#9fd3f0', '#b5e6c8']), lon: pick(['#6b2335', '#2f5d50']), skin: pick(['#d9a77a', '#c58c5c', '#a8714a']), s: 0.75, bun: k % 3 === 0 }); r.g.position.set(0, -3.95, 0.05); r.footL.visible = r.footR.visible = false; chair.add(r.g); }
    mid.swChairs.push(chair);
  }
  board(signTex('ဒန်းလွှဲ', 'Flying swing · 1,200 Ks', '#2a1606', 512, 160), 3.6, 1.15, scene, wx, 2.2, wz + SWINGER.R * M + 0.6);
  PWE_FOOD.forEach((f, i) => buildPweStall(f, i));
}
/** How fast the hand-turned wheel spins (radians a second) through a 22-second ride. */
function handSpeed(u: number): number {
  if (u < 3) return 0.12 + Math.sin(u * 3) * 0.08;      // the boys climb on, rocking it
  if (u < 6) return 0.2 + (u - 3) / 3 * 0.95;           // they swing their weight and it picks up speed
  if (u < 17) return 1.15 + Math.sin(u * 1.7) * 0.15;   // each jump gives it another push
  if (u < 21) return 1.15 * (21 - u) / 4;               // dragging their feet to slow it
  return 0;
}
function swingSpeed(u: number): number { return u < 4 ? u / 4 : u < 20 ? 1 : u < 24 ? (24 - u) / 4 : 0; }
function midSpark(x: number, y: number, z: number, n: number, hot = 1): void {
  for (let k = 0; k < n; k++) {
    const i = mid.sparkNext; mid.sparkNext = (mid.sparkNext + 1) % 260;
    mid.sparkPos.set([x, y, z], i * 3); mid.sparkVel.set([rand(-2.5, 2.5) * hot, rand(-1, 1.5) * hot, rand(-2.5, 2.5) * hot], i * 3); mid.sparkLife[i] = rand(0.25, 0.6);
  }
}
function updateMidway(f: Frame, t: number, dt: number): void {
  if (!mid.sparks) return;
  const ax = X(BUMPER.x + BUMPER.w / 2), az = Z(BUMPER.y + BUMPER.h / 2);
  mid.cars.forEach((c, i) => {
    const b = f.bumpers[i]; if (!b) { c.g.position.set(ax, 0, az); return; }
    c.g.position.set(X(b.x), Math.abs(Math.sin(t * 9 + i)) * 0.015, Z(b.y)); c.g.rotation.y = b.hd;
    if (b.hit > 0.95) { c.pole.getWorldPosition(tmpV); midSpark(tmpV.x, 4.6, tmpV.z, 18, 1.5); }
    if (Math.random() < dt * 2.5) { c.pole.getWorldPosition(tmpV); midSpark(tmpV.x, 4.6, tmpV.z, 3); }
  });
  for (let i = 0; i < 260; i++) {
    if (mid.sparkLife[i] <= 0) { mid.sparkCol[i * 3] = mid.sparkCol[i * 3 + 1] = mid.sparkCol[i * 3 + 2] = 0; continue; }
    mid.sparkLife[i] -= dt; mid.sparkVel[i * 3 + 1] -= 9.8 * dt;
    for (let j = 0; j < 3; j++) mid.sparkPos[i * 3 + j] += mid.sparkVel[i * 3 + j] * dt;
    const a = Math.max(0, mid.sparkLife[i] * 2) * (Math.random() < 0.3 ? 1.6 : 1);
    mid.sparkCol.set([0.7 * a, 0.85 * a, 1.0 * a], i * 3);
  }
  mid.sparks.geometry.attributes.position.needsUpdate = true; mid.sparks.geometry.attributes.color.needsUpdate = true;
  // the hand-turned wheel: riders get their own spin from a standstill; otherwise it goes round on its own every so often
  const hu = f.ride === 'handwheel' ? f.rideT : t % 26, hs = handSpeed(hu);
  mid.hwAngle += dt * hs; mid.hw.rotation.z = mid.hwAngle;
  mid.hwSeats.forEach((st, k) => { st.rotation.z = -mid.hwAngle - Math.sin(mid.hwAngle * 2 + k) * 0.06 * hs - hs * 0.12; });
  // wave swinger
  const su = f.ride === 'swinger' ? f.rideT : t % 26, w = swingSpeed(su);
  mid.swW = w; mid.swAngle += dt * 1.5 * w;
  mid.swTop.rotation.set(Math.sin(t * 0.55) * 0.16 * w, mid.swAngle, Math.cos(t * 0.55) * 0.16 * w, 'YXZ');
  for (const ch of mid.swChairs) ch.rotation.z = -0.8 * w * w; // flung outward
}

// ---------------------------------------------------------------- the oil-lamp festival (ဆီမီးထွန်းပွဲ)
// A thousand clay lamps and a thousand flowers in rings around a small golden stupa. Most are lit already; people keep
// lighting more, and the ones nearest where you stand (south for lamps, west for flowers) are kept for you to light.
const cand = { flames: null as THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> | null, base: new Float32Array(0), order: [] as number[], mineOrder: [] as number[],
  flowerMesh: null as THREE.InstancedMesh | null, flowerOrder: [] as number[], flowerMats: [] as THREE.Matrix4[], shown: -1, lamps: -1, mine: -1, light: null as THREE.PointLight | null };
export const CANDLE_MINE = 40;
function buildCandles(): void {
  const cx = X(CANDLE.x), cz = Z(CANDLE.y), r = srng(77);
  const g = add(new THREE.Group(), scene, cx, 0, cz);
  // a raised brick terrace for the lamps, and the stupa in the middle
  cyl(CANDLE.R * M, CANDLE.R * M + 0.2, 0.12, lam('#5a3a2e'), g, 0, 0.06, 0, 48);
  const goldS = lam('#d4a23a', { emissive: '#6a4208', k: 'stupa' });
  cyl(2.6, 2.8, 0.5, lam('#e9dcc4'), g, 0, 0.35, 0, 24); cyl(2.1, 2.3, 0.45, lam('#e9dcc4'), g, 0, 0.8, 0, 24); cyl(1.65, 1.85, 0.4, goldS, g, 0, 1.2, 0, 24);
  const bell = sphere(1.35, goldS, g, 0, 2.1, 0, 24); bell.scale.y = 1.15;
  for (let k = 0; k < 4; k++) cyl(0.9 - k * 0.18, 1.0 - k * 0.18, 0.25, goldS, g, 0, 3.3 + k * 0.25, 0, 20);
  cone(0.45, 2.4, goldS, g, 0, 5.4, 0, 18);
  const hti = add(new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 6, 16), goldS), g, 0, 6.1, 0); hti.rotation.x = Math.PI / 2;
  sphere(0.08, glowMat('#ffffff'), g, 0, 6.75, 0, 8);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite, color: '#ffb84a', transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.set(16, 16, 1); halo.position.set(0, 3.4, 0); g.add(halo);
  cand.light = new THREE.PointLight('#ffb35a', 60, 20, 1.6); cand.light.position.set(0, 1.6, 0); g.add(cand.light);
  // lamps and flowers, ring by ring
  const lampPos: Array<[number, number]> = [], flowerPos: Array<[number, number]> = [];
  let total = 0; const radii: number[] = []; for (let rr = 70; rr <= CANDLE.R - 18; rr += 20) { radii.push(rr); total += TAU * rr; }
  const step = total / CANDLE_N;
  radii.forEach((rr, ri) => {
    const n = ri === radii.length - 1 ? CANDLE_N - lampPos.length : Math.round(TAU * rr / step);
    for (let k = 0; k < n; k++) { const a = (k + (ri % 2) * 0.5) / n * TAU; lampPos.push([Math.cos(a) * rr * M, Math.sin(a) * rr * M]); flowerPos.push([Math.cos(a + 0.5 / n * TAU) * (rr + 9) * M, Math.sin(a + 0.5 / n * TAU) * (rr + 9) * M]); }
  });
  lampPos.length = CANDLE_N; flowerPos.length = FLOWER_N;
  const cup = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.045, 0.06, 7), lam('#a0522d'), CANDLE_N);
  const m = new THREE.Matrix4();
  lampPos.forEach(([x, z], i) => { m.makeTranslation(x, 0.15, z); cup.setMatrixAt(i, m); }); g.add(cup);
  // which lamps are "yours": the outer ring nearest the south path
  const near = (p: [number, number], ax: number, az: number) => Math.hypot(p[0] - ax, p[1] - az);
  const south: [number, number] = [0, CANDLE.R * M], west: [number, number] = [-CANDLE.R * M, 0];
  const byS = lampPos.map((p, i) => [near(p, ...south), i]).sort((a, b) => a[0] - b[0]).map(v => v[1]);
  cand.mineOrder = byS.slice(0, CANDLE_MINE);
  const rest = byS.slice(CANDLE_MINE); for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  cand.order = rest;
  const glows: Array<[number, number, number, string, number]> = lampPos.map(([x, z]) => [x, 0.26, z, '#ffb347', 1]);
  cand.flames = makeGlows(glows, 0.55); g.add(cand.flames);
  cand.base = Float32Array.from((cand.flames.geometry.getAttribute('color') as THREE.BufferAttribute).array as Float32Array);
  // flowers: jasmine, marigold, rose and padauk, each a little cluster in a cup
  const fl = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.085, 0), new THREE.MeshLambertMaterial({ emissive: '#221008' }), FLOWER_N);
  fl.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(FLOWER_N * 3), 3);
  const FC = ['#fff8e8', '#ff9a1f', '#ff5a7a', '#ffd23a', '#ffffff', '#ff7a2e'].map(c => new THREE.Color(c));
  flowerPos.forEach(([x, z], i) => { const mm = new THREE.Matrix4().compose(new THREE.Vector3(x, 0.17, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 3, r() * 3, 0)), new THREE.Vector3(1, 0.8, 1)); cand.flowerMats.push(mm); fl.setMatrixAt(i, mm); fl.setColorAt(i, FC[Math.floor(r() * FC.length)]); });
  g.add(fl); cand.flowerMesh = fl;
  cand.flowerOrder = flowerPos.map((p, i) => [near(p, ...west), i]).sort((a, b) => b[0] - a[0]).map(v => v[1]); // furthest from the west path first
  board(signTex('ဆီမီးထွန်းပွဲ', 'Light a lamp · 200 Ks', '#5a1f2b', 512, 160), 3.4, 1.05, scene, cx + 3.2, 2.0, cz + CANDLE.R * M + 2.2);
  cyl(0.06, 0.06, 1.6, lam('#4a3a2a'), scene, cx + 3.2, 0.8, cz + CANDLE.R * M + 2.2, 6);
  board(signTex('ပန်းကပ်ရန်', 'Offer flowers · 300 Ks', '#5a1f2b', 512, 160), 3.4, 1.05, scene, cx - CANDLE.R * M - 2.2, 2.0, cz - 3.2, Math.PI / 2);
  cyl(0.06, 0.06, 1.6, lam('#4a3a2a'), scene, cx - CANDLE.R * M - 2.2, 0.8, cz - 3.2, 6);
}
function updateCandles(f: Frame, t: number): void {
  if (!cand.flames || !f.candles) return;
  const { lamps, mine, flowers } = f.candles;
  const col = cand.flames.geometry.getAttribute('color') as THREE.BufferAttribute, a = col.array as Float32Array;
  const lit = new Uint8Array(CANDLE_N);
  for (let i = 0; i < Math.min(lamps, cand.order.length); i++) lit[cand.order[i]] = 1;
  for (let i = 0; i < Math.min(mine, cand.mineOrder.length); i++) lit[cand.mineOrder[i]] = 1;
  for (let i = 0; i < CANDLE_N; i++) {
    const k = lit[i] ? 0.75 + 0.25 * Math.sin(t * 9 + i * 1.7) * Math.sin(t * 5.3 + i) : 0;
    a[i * 3] = cand.base[i * 3] * k; a[i * 3 + 1] = cand.base[i * 3 + 1] * k; a[i * 3 + 2] = cand.base[i * 3 + 2] * k;
  }
  col.needsUpdate = true;
  if (cand.light) cand.light.intensity = 45 + 15 * Math.sin(t * 7) * Math.sin(t * 3.1);
  if (flowers !== cand.shown && cand.flowerMesh) { // hide the flowers that haven't been offered yet
    cand.shown = flowers; const hide = new THREE.Matrix4().makeScale(0, 0, 0);
    cand.flowerOrder.forEach((idx, k) => cand.flowerMesh!.setMatrixAt(idx, k < flowers ? cand.flowerMats[idx] : hide));
    cand.flowerMesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- the teashop (လက်ဖက်ရည်ဆိုင်)
const teaAnim = { tv: null as THREE.CanvasTexture | null, tvT: 0, steam: null as THREE.Points | null, steamBase: [] as number[] };
function buildTeashop(): void {
  const sx = X(TEA.x), sz = Z(TEA.y), r = srng(91);
  const g = add(new THREE.Group(), scene, sx, 0, sz);
  // the shop: back wall, a tin roof on posts, the counter with kettles and the glass snack cabinet
  box(23, 3.6, 0.3, lam('#c9b58a'), g, 0, 1.8, -2.4);
  box(23, 0.9, 0.31, lam('#3f7a5a'), g, 0, 0.45, -2.38);
  const roof = box(24, 0.12, 6.4, lam('#8a8f96'), g, 0, 3.75, 0.6); roof.rotation.x = 0.06;
  for (const px of [-11.5, -5.75, 0, 5.75, 11.5]) cyl(0.08, 0.08, 3.7, lam('#5a5070'), g, px, 1.85, 3.6, 6);
  box(9, 1.0, 1.0, lam('#6b4a2e'), g, -2, 0.5, -0.6); box(9.2, 0.08, 1.1, lam('#d8c8a0'), g, -2, 1.03, -0.6);
  // glass cabinet of palata, samusa and cakes
  const cab = box(2.4, 0.7, 0.8, new THREE.MeshLambertMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.35 }), g, 1.2, 1.42, -0.6);
  cab.renderOrder = 2;
  for (let k = 0; k < 9; k++) { const b = box(0.32, 0.08, 0.22, lam(['#e0a64a', '#c98a3a', '#f2d48a'][k % 3]), g, 0.3 + (k % 5) * 0.42, 1.18 + Math.floor(k / 5) * 0.3, -0.65); b.rotation.y = r() * 0.4; }
  // charcoal stove and kettles
  box(1.6, 0.8, 1, lam('#3a3030'), g, -6.8, 0.4, -0.6);
  sphere(0.5, glowMat('#ff5a1a'), g, -6.8, 0.82, -0.6, 10).scale.y = 0.2;
  for (const kx of [-7.3, -6.3]) { cyl(0.32, 0.38, 0.55, lam('#b8b8c0'), g, kx, 1.12, -0.6, 14); cyl(0.04, 0.06, 0.4, lam('#b8b8c0'), g, kx + 0.38, 1.2, -0.6, 6).rotation.z = -0.9; }
  const steamGlows: Array<[number, number, number, string, number]> = [];
  for (let k = 0; k < 24; k++) { steamGlows.push([sx - 6.8 + rand(-0.6, 0.6), 1.5 + k * 0.08, sz - 0.6, '#ffffff', 0.25]); teaAnim.steamBase.push(r() * TAU); }
  teaAnim.steam = makeGlows(steamGlows, 0.8); scene.add(teaAnim.steam);
  // shelves with tins and condensed-milk cans
  for (let row = 0; row < 3; row++) { box(6, 0.06, 0.4, lam('#6b4a2e'), g, -2, 1.7 + row * 0.55, -2.1);
    for (let k = 0; k < 12; k++) cyl(0.09, 0.09, 0.22, lam(['#e04a3a', '#f4d03f', '#3a7ad0', '#ffffff'][(k + row) % 4]), g, -4.7 + k * 0.48, 1.85 + row * 0.55, -2.05, 8); }
  // the TV in the corner showing the football
  teaAnim.tv = canvasTex(128, 80, c => drawPitch(c, 0));
  const tv = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.85), new THREE.MeshBasicMaterial({ map: teaAnim.tv }));
  tv.position.set(7.5, 2.6, -2.2); g.add(tv); box(1.5, 0.95, 0.12, lam('#111'), g, 7.5, 2.6, -2.3);
  // fluorescent tubes under the roof
  for (let k = 0; k < 6; k++) { box(1.3, 0.06, 0.06, glowMat('#eaf6ff'), g, -9 + k * 3.6, 3.55, 1.5); GLOWS.push([sx - 9 + k * 3.6, 3.5, sz + 1.5, '#dff0ff', 1.2]); }
  const pl = new THREE.PointLight('#f2f6ff', 90, 24, 1.6); pl.position.set(0, 3.2, 2.5); g.add(pl);
  board(signTex('လက်ဖက်ရည်ဆိုင်', 'Teashop · Tea 500 Ks', '#1f4a3a', 640, 170), 7, 1.85, g, 0, 4.7, 3.65);
  // low tables and tiny plastic stools, instanced
  const tops = new THREE.InstancedMesh(new THREE.BoxGeometry(0.95, 0.05, 0.95), lam('#e9dcc4'), TEA_TABS.length);
  const legs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.42, 0.7), lam('#6b4a2e'), TEA_TABS.length);
  const stoolGeo = new THREE.CylinderGeometry(0.17, 0.2, 0.26, 10), stools: Record<string, Array<[number, number]>> = { '#d0322e': [], '#2e6bd0': [], '#2e9a5a': [], '#e07ab0': [] };
  const cupsAt: Array<[number, number]> = [], thermos: Array<[number, number]> = [];
  const mm = new THREE.Matrix4(), keys = Object.keys(stools);
  TEA_TABS.forEach(([x, y], i) => {
    mm.makeTranslation(X(x), 0.48, Z(y)); tops.setMatrixAt(i, mm); mm.makeTranslation(X(x), 0.24, Z(y)); legs.setMatrixAt(i, mm);
    teaStools(i).forEach(([a, b], k) => stools[keys[(i + k) % 4]].push([X(a), Z(b)]));
    for (let k = 0; k < 3; k++) cupsAt.push([X(x) + Math.cos(k * 2.1 + i) * 0.3, Z(y) + Math.sin(k * 2.1 + i) * 0.3]);
    thermos.push([X(x) + 0.05, Z(y) - 0.05]);
  });
  g.parent!.add(tops, legs);
  for (const k of keys) { const im = new THREE.InstancedMesh(stoolGeo, lam(k), stools[k].length); stools[k].forEach(([x, z], i) => { mm.makeTranslation(x, 0.13, z); im.setMatrixAt(i, mm); }); scene.add(im); }
  const cups = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.045, 0.035, 0.08, 8), lam('#ffffff'), cupsAt.length);
  cupsAt.forEach(([x, z], i) => { mm.makeTranslation(x, 0.55, z); cups.setMatrixAt(i, mm); }); scene.add(cups);
  const th = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 8), lam('#d04a3a'), thermos.length);
  thermos.forEach(([x, z], i) => { mm.makeTranslation(x, 0.66, z); th.setMatrixAt(i, mm); }); scene.add(th);
  // a string of bulbs over the tables
  const bulbs: Array<[number, number, number, string, number]> = [];
  for (let k = 0; k < 40; k++) { const u = k / 39; bulbs.push([X(TEA.x - 300 + u * 600), 3.4 - Math.sin(u * Math.PI * 4) * 0.3, Z(1950), LANTERN_COLS[k % 5], 1]); }
  for (let k = 0; k < 40; k++) { const u = k / 39; bulbs.push([X(TEA.x - 300 + u * 600), 3.4 - Math.sin(u * Math.PI * 4) * 0.3, Z(2140), LANTERN_COLS[(k + 2) % 5], 1]); }
  scene.add(makeGlows(bulbs, 0.9));
  for (const [lx, lz] of [[TEA.x, 1880], [TEA.x, 2070]]) { const l = new THREE.PointLight('#ffd9a0', 90, 26, 1.4); l.position.set(X(lx), 3.2, Z(lz)); scene.add(l); }
  for (const [px, pz] of [[TEA.x - 310, 1950], [TEA.x + 310, 1950], [TEA.x - 310, 2140], [TEA.x + 310, 2140]]) cyl(0.06, 0.06, 3.5, lam('#4a4058'), scene, X(px), 1.75, Z(pz), 6);
}
function drawPitch(c: CanvasRenderingContext2D, t: number): void {
  c.fillStyle = '#2f8a3a'; c.fillRect(0, 0, 128, 80);
  c.fillStyle = 'rgba(255,255,255,.12)'; for (let k = 0; k < 8; k++) if (k % 2) c.fillRect(k * 16, 0, 16, 80);
  c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1.5; c.strokeRect(4, 4, 120, 72); c.beginPath(); c.moveTo(64, 4); c.lineTo(64, 76); c.stroke(); c.beginPath(); c.arc(64, 40, 10, 0, TAU); c.stroke();
  const bx = 64 + Math.sin(t * 0.9) * 40 + Math.sin(t * 2.3) * 10, by = 40 + Math.cos(t * 1.3) * 24;
  for (let k = 0; k < 6; k++) { c.fillStyle = k < 3 ? '#e03a3a' : '#f2f2f2'; c.fillRect(bx + Math.sin(t + k * 2) * 22 - 2, by + Math.cos(t * 1.2 + k * 1.7) * 16 - 3, 4, 6); }
  c.fillStyle = '#fff'; c.beginPath(); c.arc(bx, by, 2, 0, TAU); c.fill();
  c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(2, 2, 34, 9); c.fillStyle = '#fff'; c.font = '700 8px sans-serif'; c.fillText('MYA 1-0', 4, 9);
}
// what you ordered at the teashop, set out on your table on the side where you sit
let teaDishes: THREE.Group | null = null, teaKey = '';
function dishFor(id: string, g: THREE.Group, x: number, z: number): void {
  const Y = 0.53, white = lam('#f6f2ea');
  const cup = (col: string) => { disc(0.07, white, g, x, Y, z); cyl(0.045, 0.036, 0.1, lam('#e8f0f4', { transparent: true, opacity: 0.55, k: 'glass' }), g, x, Y + 0.05, z, 10); cyl(0.042, 0.034, 0.075, lam(col), g, x, Y + 0.04, z, 10); };
  const plate = () => add(new THREE.Mesh(plateGeo, white), g, x, Y + 0.005, z).scale.set(0.6, 1, 0.6);
  if (id === 'yaynway') { sphere(0.07, lam('#c8ccd8'), g, x, Y + 0.07, z, 10).scale.y = 0.85; cyl(0.03, 0.025, 0.05, lam('#f2f2f2'), g, x + 0.12, Y + 0.025, z, 8); return; }
  if (id === 'kopi') { cup('#5a3a20'); return; }
  if (['pawkseint', 'choseint', 'kyaseint'].includes(id)) { cup(id === 'kyaseint' ? '#a8713a' : id === 'choseint' ? '#d9a86a' : '#c99258'); return; }
  plate();
  if (id === 'palata' || id === 'palata_egg') { const p = cyl(0.09, 0.09, 0.02, lam('#e8b65a'), g, x, Y + 0.025, z, 12); p.scale.z = 0.8; if (id === 'palata_egg') disc(0.035, lam('#ffd23a'), g, x, Y + 0.04, z); }
  else if (id === 'nanbya') { const n = cyl(0.08, 0.08, 0.02, lam('#d8a868'), g, x - 0.02, Y + 0.025, z, 12); n.scale.x = 1.4; disc(0.04, lam('#8a9a3a'), g, x + 0.06, Y + 0.04, z); }
  else if (id === 'ekyakway') { for (const d of [-0.025, 0.025]) { const s = cyl(0.016, 0.016, 0.17, lam('#d9952a'), g, x, Y + 0.03, z + d, 6); s.rotation.z = Math.PI / 2; } }
  else if (id === 'samusa') { for (let k = 0; k < 3; k++) { const c = cone(0.04, 0.03, lam('#d9a040'), g, x - 0.05 + k * 0.05, Y + 0.035, z, 3); c.rotation.x = Math.PI / 2; } }
  else if (id === 'paukzi') sphere(0.05, lam('#fbf7ee'), g, x, Y + 0.05, z, 10).scale.y = 0.8;
  else if (id === 'nangyi') { add(new THREE.Mesh(bowlGeo, white), g, x, Y, z).scale.setScalar(0.45); disc(0.07, lam('#e0b040'), g, x, Y + 0.045, z); }
}
function updateTeaDishes(f: Frame): void {
  const key = f.tea ? f.tea.table + ':' + f.tea.items.join(',') : '';
  if (key === teaKey) return; teaKey = key;
  if (teaDishes) { teaDishes.removeFromParent(); teaDishes = null; }
  if (!f.tea) return;
  const [tx, ty] = TEA_TABS[f.tea.table], [sx, sy] = teaStools(f.tea.table)[f.tea.seat];
  const ux = (sx - tx) / 17, uy = (sy - ty) / 17; // toward your stool
  teaDishes = add(new THREE.Group(), scene); const items = f.tea.items.slice(-8);
  items.forEach((id, k) => { const side = (k - (items.length - 1) / 2) * 0.17, near = 0.17 + (k % 2) * 0.04;
    dishFor(id, teaDishes!, X(tx) + ux * near - uy * side, Z(ty) + uy * near + ux * side); });
}
function updateTeashop(t: number): void {
  if (!teaAnim.tv) return;
  if (t - teaAnim.tvT > 0.12) { teaAnim.tvT = t; const c = (teaAnim.tv.image as HTMLCanvasElement).getContext('2d')!; drawPitch(c, t); teaAnim.tv.needsUpdate = true; }
  const p = teaAnim.steam!.geometry.getAttribute('position') as THREE.BufferAttribute, a = p.array as Float32Array;
  for (let k = 0; k < 24; k++) { const u = (t * 0.35 + k / 24) % 1, ph = teaAnim.steamBase[k]; a[k * 3 + 1] = 1.45 + u * 1.6; a[k * 3] = X(TEA.x) - 6.8 + (k % 2 ? 0.5 : -0.5) + Math.sin(t + ph) * 0.15 * (1 + u * 2); }
  p.needsUpdate = true;
}

// ---------------------------------------------------------------- more fireworks: rocket trails, new shapes, ground fountains
const fountains: Array<{ x: number; y: number; z: number; until: number; col: string; h: number }> = [];
export function fountain(x: number, z: number, secs: number, col = '#ffd27a', y = 0.2, h = 1): void { fountains.push({ x, y, z, until: clockT + secs, col, h }); }
let clockT = 0;
function updateFountains(dt: number): void {
  clockT += dt;
  for (let i = fountains.length - 1; i >= 0; i--) {
    const f = fountains[i]; if (f.until < clockT) { fountains.splice(i, 1); continue; }
    const n = Math.min(6, Math.floor(dt * 110) + (Math.random() < (dt * 110) % 1 ? 1 : 0));
    for (let k = 0; k < n; k++) fwAdd(f.x + rand(-0.1, 0.1), f.y, f.z + rand(-0.1, 0.1), rand(-1.2, 1.2), rand(7, 10) * f.h, rand(-1.2, 1.2), rand(0.8, 1.3), Math.random() < 0.3 ? '#ffffff' : f.col, 0.4, 9.8);
  }
}

export function build3d(): void {
  buildSkyAndCity(); buildGround(); buildTrees(); buildLanterns(); buildFerris(); buildCarousel(); buildPirate();
  buildFood(); buildBooths(); buildKids(); buildStage(); buildFinaleAndGate(); buildSecrets(); buildWishPlace(); buildMidway(); buildCandles(); buildTeashop(); buildRestrooms(); buildQueueRopes();
  glowPts = makeGlows(GLOWS, 1.1); scene.add(glowPts);
  buildDust(); buildSkyLanterns();
  crowd = new Crowd(400);
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.BufferAttribute(fw.pos, 3)); fg.setAttribute('color', new THREE.BufferAttribute(fw.col, 3));
  fw.points = new THREE.Points(fg, new THREE.PointsMaterial({ size: 2.2, map: glowSprite, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  fw.points.frustumCulled = false; scene.add(fw.points);
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(steam.pos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(steam.col, 3));
  anim.steam = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.4, map: glowSprite, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  anim.steam.frustumCulled = false; scene.add(anim.steam);
}
export function resize3d(w: number, h: number, dpr: number): void {
  if (!renderer) return;
  renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}

export interface Look { o: PersonOpts; key: string }
export interface Body3D { x: number; y: number; hd: number; moving: boolean; spd?: number; wave: boolean; dance?: boolean; look: Look; balloon: string | null }
export type RideKind = 'ferris' | 'carousel' | 'pirate' | 'train' | 'bumper' | 'handwheel' | 'swinger' | 'finale' | 'wishes' | null;
export interface Frame {
  t: number; dt: number; night: number; clock: number; quality: 'low' | 'high';
  me: Body3D & { hidden: boolean; sit?: boolean };
  candles?: { lamps: number; mine: number; flowers: number };
  crowd: CrowdItem[];
  bikes: Array<{ x: number; y: number; dir: number; cur: number; ph: number; ringT: number; rider: PersonOpts; col: string; saika: boolean; moto: boolean }>;
  others: Array<Body3D & { id: string; visible: boolean }>;
  ride: RideKind; rideT: number; train: { d: number; v: number };
  cam: { yaw: number; pitch: number; dist: number };
  sparkle: number[]; // 0..1 per secret
  look?: { yaw: number; pitch: number };   // where you've turned your head on a ride
  bumpers: Array<{ x: number; y: number; hd: number; hit: number }>;
  bumperPov?: boolean; // driving a bumper car: true looks out of your own eyes, false follows behind your car
  shake: number;
  steamFrom: Array<[number, number]>;
  tea?: { table: number; seat: number; items: string[] };
}

// ---------------------------------------------------------------- public restrooms (အိမ်သာ) and queue ropes
function buildRestrooms(): void {
  RESTROOMS.forEach((r, i) => {
    const g = add(new THREE.Group(), scene, X(r.x), 0, Z(r.y));
    box(5.0, 2.7, 2.8, lam('#e8e0cc'), g, 0, 1.35, 0);
    box(5.04, 0.5, 2.84, lam('#7a8a9a'), g, 0, 0.25, 0);
    box(5.5, 0.14, 3.3, lam('#9aa2aa'), g, 0, 2.78, 0.1);
    cyl(0.45, 0.45, 0.8, lam('#2a4a8a'), g, 1.6, 3.25, -0.6, 14); // the water tank on the roof
    for (const [dx, col, my, en] of [[-1.15, '#2d6bb6', 'အမျိုးသား', 'Men'], [1.15, '#c25a7a', 'အမျိုးသမီး', 'Women']] as Array<[number, string, string, string]>) {
      box(0.95, 2.0, 0.08, lam(col), g, dx, 1.0, 1.42);
      board(signTex(my, en, col, 256, 110), 0.9, 0.38, g, dx, 2.3, 1.45);
    }
    board(signTex('အိမ်သာ', 'Restroom · 100 Ks', '#2a1606', 384, 120), 2.2, 0.68, g, 0, 3.3, 1.5);
    box(0.7, 0.75, 0.45, lam('#c8ccd0'), g, 2.85, 0.4, 1.0); cyl(0.02, 0.02, 0.2, lam('#b8bcc4'), g, 2.85, 0.88, 0.9, 6); // a sink and tap outside
    box(0.6, 0.6, 0.45, lam('#8a5a32'), g, -2.95, 0.3, 1.25); // the attendant's little table, with a tin for the coins
    cyl(0.07, 0.07, 0.1, lam('#c8b070'), g, -2.95, 0.65, 1.25, 8);
    const att = buildPerson({ shirt: pick(['#f3efe6', '#9fd3f0']), lon: pick(['#6b2335', '#2f5d50']), skin: '#a8714a', s: 0.85, bun: i % 2 === 0 });
    att.g.position.set(-2.95, 0.05, 1.75); att.g.rotation.y = Math.PI; animatePerson(att, i, false, false, true); g.add(att.g);
    GLOWS.push([X(r.x), 2.6, Z(r.y) + 1.5, '#fff6dc', 0.9]);
  });
}
function buildQueueRopes(): void {
  const post = lam('#c9a032'), rope = new THREE.LineBasicMaterial({ color: '#b8323a' });
  QUEUES.forEach(q => {
    const len = (q.n + 1) * QUEUE_GAP, ox = -q.dy * 16, oy = q.dx * 16;
    for (const sd of [-1, 1]) {
      const pts: THREE.Vector3[] = [];
      for (let d = 0; d <= len; d += 40) { const x = q.x + q.dx * d + ox * sd, y = q.y + q.dy * d + oy * sd; cyl(0.04, 0.06, 0.95, post, scene, X(x), 0.47, Z(y), 6); pts.push(new THREE.Vector3(X(x), 0.85, Z(y))); }
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), rope));
    }
  });
}

// the sky through the day: [hour, sky overhead, sky at the horizon]
const SKY_KEYS: Array<[number, string, string]> = [
  [5, '#141a48', '#7a3a5a'], [6, '#2f4f96', '#f2a07a'], [7.2, '#4a86cf', '#f4d2b0'], [9, '#4f8fd8', '#cfe3f2'], [13, '#3a7fd6', '#bcd8f0'],
  [16, '#4a86cc', '#e2dcc4'], [17.4, '#4f68a8', '#ffbc7a'], [18.3, '#2c2a66', '#ff7a48'], [19.2, '#120c34', '#5a2450'],
];
const cA = new THREE.Color(), cC = new THREE.Color(), sunV = new THREE.Vector3();
function skyAt(h: number, top: THREE.Color, hor: THREE.Color): void {
  let i = 0; while (i < SKY_KEYS.length - 1 && SKY_KEYS[i + 1][0] <= h) i++;
  const a = SKY_KEYS[i], b = SKY_KEYS[Math.min(i + 1, SKY_KEYS.length - 1)], k = b[0] > a[0] ? clamp((h - a[0]) / (b[0] - a[0]), 0, 1) : 0;
  top.set(a[1]).lerp(cA.set(b[1]), k); hor.set(a[2]).lerp(cA.set(b[2]), k);
}
/** Sets the sky, sun, moon and lights for the clock (minutes past midnight). Returns how much daylight there is, 0 to 1. */
function timeOfDay(clock: number, night: number): number {
  const h = ((clock / 60) % 24 + 24) % 24, flash = fw.flash;
  const day = clamp(Math.min((h - 5.2) / 1.4, (19.3 - h) / 1.3), 0, 1);           // sky brightness
  const sunUp = clamp(Math.min((h - 5.8) / 1.2, (18.4 - h) / 1.0), 0, 1);         // direct sunlight
  const gold = clamp(1 - Math.abs(h - 17.9) / 1.3, 0, 1) + clamp(1 - Math.abs(h - 6.3) / 1.0, 0, 1) * 0.7; // sunrise and sunset glow
  const top = tod.daySky!.material.uniforms.top.value as THREE.Color, hor = tod.daySky!.material.uniforms.hor.value as THREE.Color;
  skyAt(h, top, hor);
  // the sun rises in the east (+x), crosses high and a little to the south, and sets in the west
  const th = clamp((h - 6) / 12.3, -0.05, 1.05) * Math.PI, sd = sunV.set(Math.cos(th), Math.sin(th) * 0.9 + 0.04, 0.35).normalize();
  tod.daySky!.material.uniforms.sunDir.value.copy(sd);
  (tod.daySky!.material.uniforms.sunCol.value as THREE.Color).set('#fff0c8').lerp(cA.set('#ff8a3a'), clamp(gold, 0, 1)).multiplyScalar(sunUp);
  tod.daySky!.material.uniforms.a.value = day; tod.daySky!.visible = day > 0.001;
  tod.sun!.position.copy(sd).multiplyScalar(520); tod.sun!.position.x += 45; tod.sun!.position.z += 60; tod.sun!.visible = sunUp > 0.01;
  tod.sun!.material.opacity = sunUp; tod.sun!.material.color.set('#fff2c8').lerp(cA.set('#ff9a50'), clamp(gold, 0, 1));
  sunLight.position.copy(sd).multiplyScalar(200); sunLight.intensity = sunUp * 2.1; sunLight.color.set('#fff2dc').lerp(cA.set('#ff9a58'), clamp(gold, 0, 1) * 0.8);
  (tod.stars!.material as THREE.PointsMaterial).opacity = 1 - day; (tod.stars!.material as THREE.PointsMaterial).transparent = true; tod.stars!.visible = day < 0.99;
  tod.moon!.material.opacity = 1 - day; tod.moon!.visible = day < 0.99;
  tod.clouds!.visible = day > 0.01; (tod.clouds!.children[0] as THREE.Sprite).material.opacity = day * 0.55;
  (tod.clouds!.children[0] as THREE.Sprite).material.color.set('#ffffff').lerp(cA.set('#ffb08a'), clamp(gold, 0, 1));
  tod.halo!.material.opacity = 0.55 * (1 - day * 0.8);
  const nn = clamp(night, 0, 1);
  hemi.color.set(flash > 0.05 ? '#b49ad8' : '#6f5aa8').lerp(cA.set('#dceaff'), day);
  hemi.groundColor.set('#22182c').lerp(cA.set('#8a7a5a'), day);
  hemi.intensity = lerp(1.5 - 0.65 * nn, 1.7, day) + flash * 1.4;
  ambient.color.set('#4a3a6a').lerp(cA.set('#ffffff'), day); ambient.intensity = lerp(0.5, 0.45, day);
  moonLight.intensity = 0.55 * (1 - day);
  const fog = scene.fog as THREE.Fog;
  cC.setRGB(0.1 - 0.03 * nn, 0.07 - 0.02 * nn, 0.22 - 0.06 * nn); fog.color.copy(cC).lerp(hor, day); fog.far = lerp(340, 460, day);
  renderer.setClearColor(fog.color);
  if (Math.abs(day - tod.last) > 0.002) { tod.last = day; for (const g of tod.ground) g.m.color.copy(g.night).lerp(g.day, day); for (const m of tod.city) m.color.set('#bbbbbb').lerp(cA.set('#9aa6b8'), day); }
  glowPts.material.opacity = 1 - day * 0.6;
  return day;
}

function syncRig(cur: Rig | null, look: Look, parent: THREE.Object3D): Rig {
  if (cur && cur.key === look.key) { if (cur.g.parent !== parent) parent.add(cur.g); return cur; }
  if (cur) cur.g.removeFromParent();
  const r = buildPerson(look.o); parent.add(r.g); return r;
}
function rideSeat(kind: RideKind): THREE.Object3D | null {
  if (kind === 'ferris') return anim.cabins[0].getObjectByName('inner');
  if (kind === 'carousel') return anim.horses[0].getObjectByName('seat');
  if (kind === 'pirate') return anim.shipSeat;
  if (kind === 'train') return trn.seat;
  if (kind === 'handwheel') return mid.hwSeat;
  if (kind === 'bumper') return mid.drvSeat;
  if (kind === 'swinger') return mid.swSeat;
  return null;
}
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), camTarget = new THREE.Vector3(), camPos = new THREE.Vector3();
const lookNow = new THREE.Vector3(), fromPos = new THREE.Vector3(), fromLook = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0), camUp = new THREE.Vector3(0, 1, 0), povUp = new THREE.Vector3(), povF = new THREE.Vector3(), povR = new THREE.Vector3(), povQ = new THREE.Quaternion();
/** Where your eyes are on each ride, in the seat's own frame, which way you face, and whether the horizon tilts with the ride. */
const POV: Record<string, { eye: [number, number, number]; fwd: [number, number, number]; tilt?: boolean }> = {
  ferris: { eye: [0, -1.05, 0.38], fwd: [0, -0.18, -1] },
  carousel: { eye: [0, 1.05, 0.05], fwd: [0, -0.12, 1] },
  pirate: { eye: [0, 1.15, 0], fwd: [-1, -0.08, 0], tilt: true },
  train: { eye: [0, 0.86, 0.05], fwd: [0, -0.1, 1], tilt: true },
  handwheel: { eye: [0, 0.95, 0.1], fwd: [0, -0.15, 1] },
  bumper: { eye: [0, 1.05, 0], fwd: [0, -0.18, 1] },
  swinger: { eye: [0, 0.75, 0.05], fwd: [0, -0.25, 1], tilt: true },
};
// a hand that waves in front of you when you wave from a ride
const fpArm = new THREE.Group();
let camInit = false, camMode = '', blend = 1;
const easeInOut = (x: number) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

/** Renders a frame and returns where the camera looked (used by the minimap) and whether the Ferris cabin is at the top. */
export function render3d(f: Frame): { atTop: boolean } {
  const { t, dt } = f;
  // light for the time of day
  const day = timeOfDay(f.clock, f.night);

  // rides
  anim.wheel.rotation.z = (f.ride === 'ferris' ? 0 : 0) + t * 0.22 + (f.ride === 'ferris' ? 0 : 0);
  anim.cabins.forEach((c, i) => { c.rotation.z = -anim.wheel.rotation.z + Math.sin(t * 1.15 + i * 0.8) * (i === 0 && f.ride === 'ferris' ? 0.045 : 0.025); c.rotation.x = Math.sin(t * 0.8 + i) * 0.015; });
  anim.carousel.rotation.y = -t * 0.6;
  anim.horses.forEach((h, i) => { h.position.y = 1.3 + Math.sin(t * 3 + i * 1.3) * 0.3; });
  anim.swing.rotation.z = Math.sin(t * 1.15) * 0.95;
  const arms = Math.abs(anim.swing.rotation.z) > 0.55;
  anim.swing.children.forEach(ch => { const r = (ch as THREE.Object3D & { rig?: Rig }).rig; if (r) animatePerson(r, t + ch.position.x, false, arms, true); });
  updateTrain(f, t, dt);
  animateBand(t);
  anim.dancers.forEach((r, i) => animateDancer(r, t, i));
  anim.stageLight.color.setHSL((t * 0.05) % 1, 0.7, 0.6);
  const sgc = anim.stageGlows.geometry.getAttribute('color') as THREE.BufferAttribute;
  for (let k = 0; k < 8; k++) { const on = (k + Math.floor(t * 4)) % 2; const c = new THREE.Color(LANTERN_COLS[k % 5]).multiplyScalar(on ? 2 : 0.25); sgc.setXYZ(k, c.r, c.g, c.b); }
  sgc.needsUpdate = true;
  const sp = anim.secretSparkles.geometry.getAttribute('color') as THREE.BufferAttribute;
  f.sparkle.forEach((a, i) => { const v = a * (0.6 + 0.4 * Math.sin(t * 5 + i)); sp.setXYZ(i, v, v * 0.95, v * 0.7); });
  sp.needsUpdate = true;
  (anim.lake.material as THREE.MeshLambertMaterial).emissiveIntensity = (0.9 + Math.sin(t * 0.7) * 0.1) * (1 - day * 0.8);

  // steam rising from the carts
  for (let i = 0; i < STEAM_N; i++) {
    steam.life[i] -= dt;
    if (steam.life[i] <= 0 && f.steamFrom.length) { const [x, y] = f.steamFrom[i % f.steamFrom.length]; steam.pos.set([X(x) + rand(-2, 2), 2.6, Z(y) - 0.9], i * 3); steam.life[i] = rand(1.2, 2.4); }
    steam.pos[i * 3 + 1] += dt * 0.9; steam.pos[i * 3] += Math.sin(t + i) * dt * 0.2;
    const a = clamp(steam.life[i] / 2.4, 0, 1) * 0.12; steam.col.set([a, a, a], i * 3);
  }
  (anim.steam.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  (anim.steam.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;

  updateFireworks(dt);

  // crowd
  crowd.update(f.crowd);

  // bikes
  while (bikes.length < f.bikes.length) {
    const i = bikes.length, g = new THREE.Group(); scene.add(g);
    const b = f.bikes[i], frame = lam(b.col);
    const tyre = b.moto ? 0.09 : 0.05;
    const back = add(new THREE.Mesh(new THREE.TorusGeometry(0.36, tyre, 6, 18), lam('#15101c')), g, 0, 0.38, -0.55); back.rotation.y = Math.PI / 2;
    const front = add(new THREE.Mesh(new THREE.TorusGeometry(0.36, tyre, 6, 18), lam('#15101c')), g, 0, 0.38, 0.6); front.rotation.y = Math.PI / 2;
    let bell: THREE.Mesh;
    if (b.moto) {
      // a little step-through motorbike: body, seat, front shield and a headlight that flashes when it honks
      box(0.36, 0.42, 1.0, frame, g, 0, 0.62, -0.1); box(0.3, 0.12, 0.62, lam('#1b1420'), g, 0, 0.9, -0.2);
      box(0.4, 0.75, 0.14, frame, g, 0, 0.85, 0.48); beam(new THREE.Vector3(0, 0.4, 0.6), new THREE.Vector3(0, 1.2, 0.5), 0.04, lam('#b7bdd6'), g);
      beam(new THREE.Vector3(-0.38, 1.2, 0.5), new THREE.Vector3(0.38, 1.2, 0.5), 0.03, lam('#b7bdd6'), g);
      bell = sphere(0.09, glowMat('#fff1c9'), g, 0, 1.08, 0.58, 8);
    } else {
      beam(new THREE.Vector3(0, 0.4, -0.55), new THREE.Vector3(0, 0.8, 0.1), 0.045, frame, g);
      beam(new THREE.Vector3(0, 0.8, 0.1), new THREE.Vector3(0, 0.4, 0.6), 0.045, frame, g);
      beam(new THREE.Vector3(0, 0.8, 0.1), new THREE.Vector3(0, 1.15, 0.5), 0.04, frame, g);
      beam(new THREE.Vector3(-0.35, 1.15, 0.5), new THREE.Vector3(0.35, 1.15, 0.5), 0.03, lam('#b7bdd6'), g);
      bell = sphere(0.06, lam('#d9c48a'), g, 0.22, 1.2, 0.5, 8);
    }
    if (b.saika) {
      box(0.9, 0.7, 1.1, lam('#2f5d50'), g, -0.85, 0.75, 0.1); box(0.9, 0.1, 1.1, lam('#c23b4b'), g, -0.85, 0.45, 0.1);
      add(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 6, 16), lam('#15101c')), g, -1.3, 0.3, 0.1).rotation.y = Math.PI / 2;
      sphere(0.18, lam('#a8714a'), g, -0.85, 1.35, 0.1, 8);
    }
    const rider = buildPerson({ ...b.rider, s: 0.95 }); rider.g.position.set(0, b.moto ? 0.42 : 0.25, b.moto ? -0.25 : -0.05); g.add(rider.g);
    rider.footL.visible = rider.footR.visible = false;
    bikes.push({ g, rider, key: '', bell, front, back });
  }
  f.bikes.forEach((b, i) => {
    const B = bikes[i];
    B.g.position.set(X(b.x), 0, Z(b.y)); B.g.rotation.y = b.dir > 0 ? 0 : Math.PI;
    B.front.rotation.x = B.back.rotation.x = 0; animatePerson(B.rider, t + b.ph, false, false, true);
    B.rider.body.position.y = Math.abs(Math.sin(t * b.cur * 0.12 + b.ph)) * 0.03;
    if (b.moto) { B.bell.material = glowMat(b.ringT > 0 && Math.sin(t * 30) > 0 ? '#ffffff' : '#fff1c9'); B.bell.scale.setScalar(b.ringT > 0 ? 1.6 : 1); }
    else B.bell.material = lam(b.ringT > 0 ? '#fff6c0' : '#d9c48a');
  });

  // me
  const seat = rideSeat(f.ride);
  player = syncRig(player, f.me.look, seat || scene);
  if (seat) { player.g.position.set(0, f.ride === 'ferris' ? -2.05 : f.ride === 'carousel' ? -0.55 : f.ride === 'handwheel' || f.ride === 'swinger' ? -0.35 : 0, 0); player.g.rotation.y = 0; animatePerson(player, t, false, f.me.wave || f.ride === 'pirate' && arms, true); }
  else if (f.me.sit) { player.g.position.set(X(f.me.x), -0.5, Z(f.me.y)); player.g.rotation.y = f.me.hd; animatePerson(player, t, false, f.me.wave, true); player.body.rotation.x = Math.sin(t * 0.7) * 0.04; }
  else { player.g.position.set(X(f.me.x), 0, Z(f.me.y)); player.g.rotation.y = f.me.hd; if (f.me.dance && !f.me.moving) animateDancer(player, t, 1); else if (animatePerson(player, t, f.me.moving, f.me.wave, false, dt, f.me.spd ?? 1) && !f.me.hidden) kickDust(player, f.me.spd ?? 1); }
  const chase = f.ride === 'bumper' && !f.bumperPov;
  if (f.ride === 'bumper') player.g.position.y = -0.2;
  if (mid.car3Driver) mid.car3Driver.visible = f.ride !== 'bumper';
  if (mid.cars[3]) mid.cars[3].pole.visible = !chase; // the camera sits right behind your own car's pole
  player.g.visible = (!f.me.hidden || !!seat) && (!POV[f.ride as string] || chase);
  if (f.ride === 'finale') { player.g.position.set(X(FV.x) - 1.6, 0.6, Z(FV.y) - 1.2); player.g.rotation.y = Math.PI; }
  setBalloon(player, f.me.balloon);

  // others
  const seen = new Set<string>();
  for (const o of f.others) {
    seen.add(o.id);
    const r = syncRig(remotes.get(o.id) || null, o.look, scene); remotes.set(o.id, r);
    r.g.visible = o.visible; r.g.position.set(X(o.x), 0, Z(o.y)); r.g.rotation.y = o.hd; if (o.dance && !o.moving) animateDancer(r, t, 2); else animatePerson(r, t, o.moving, o.wave, false, dt, o.spd ?? 1); setBalloon(r, o.balloon);
  }
  for (const [id, r] of remotes) if (!seen.has(id)) { r.g.removeFromParent(); remotes.delete(id); }

  // camera
  let atTop = false;
  scene.updateMatrixWorld();
  let wantUp = UP;
  const pov = chase ? undefined : POV[f.ride as string];
  if (seat && chase) {
    // behind your own bumper car, high enough to see over it; drag to swing round it
    seat.getWorldPosition(tmpV);
    const hd = (f.bumpers[3]?.hd ?? 0) + (f.look?.yaw ?? 0), lp = clamp(f.look?.pitch ?? 0, -0.3, 0.6);
    camPos.set(tmpV.x - Math.sin(hd) * 4.4, tmpV.y + 2.3 + lp * 3, tmpV.z - Math.cos(hd) * 4.4);
    camTarget.set(tmpV.x + Math.sin(hd) * 2.5, tmpV.y + 0.5, tmpV.z + Math.cos(hd) * 2.5);
  } else if (seat && pov) {
    // first person from your seat: the seat's own motion carries the view, and you can turn your head
    seat.getWorldPosition(tmpV); if (f.ride === 'ferris') atTop = tmpV.y > 17;
    seat.getWorldQuaternion(povQ);
    camPos.set(pov.eye[0], pov.eye[1], pov.eye[2]).applyMatrix4(seat.matrixWorld);
    povF.set(pov.fwd[0], pov.fwd[1], pov.fwd[2]).normalize().applyQuaternion(povQ);
    const ly = f.look?.yaw ?? 0, lp = clamp(f.look?.pitch ?? 0, -0.9, 0.9);
    povF.applyAxisAngle(UP, ly); povR.crossVectors(povF, UP).normalize(); povF.applyAxisAngle(povR, -lp);
    if (f.ride === 'carousel' || f.ride === 'train') camPos.y += Math.sin(t * 16) * 0.006;
    camTarget.copy(camPos).addScaledVector(povF, 10);
    if (pov.tilt) wantUp = povUp.set(0, 1, 0).applyQuaternion(povQ).lerp(UP, 0.35).normalize();
  } else if (f.ride === 'wishes') {
    const yaw = f.cam.yaw, cx = X(POND.x), cz = Z(POND.y), R = POND.ry * M + 2.5;
    camPos.set(cx + Math.sin(yaw) * (POND.rx * M + 2.5), 3.4, cz + Math.cos(yaw) * R); camTarget.set(cx - Math.sin(yaw) * 6, 5.5, cz - Math.cos(yaw) * 6);
  } else if (f.ride === 'finale') {
    // the deck view: aimed at the middle of the show; drag to turn and look anywhere in the sky
    camPos.set(X(FV.x) + 0.9, 3.6, Z(FV.y) + 3.4);
    povF.set(X(FV.x) - 8 - camPos.x, 30 - camPos.y, -22 - camPos.z).normalize();
    const ly = f.look?.yaw ?? 0, lp = clamp(f.look?.pitch ?? 0, -1.0, 0.5);
    povF.applyAxisAngle(UP, ly); povR.crossVectors(povF, UP).normalize(); povF.applyAxisAngle(povR, -lp);
    camTarget.copy(camPos).addScaledVector(povF, 60);
  } else {
    const { yaw, pitch, dist } = f.cam;
    camTarget.set(X(f.me.x), 1.3, Z(f.me.y));
    camPos.set(camTarget.x + Math.sin(yaw) * Math.cos(pitch) * dist, camTarget.y + Math.sin(pitch) * dist, camTarget.z + Math.cos(yaw) * Math.cos(pitch) * dist);
  }
  // The follow camera is locked to the player (lagging behind it is what made walking toward or away from it wobble).
  // Switching between walking and a ride glides from the old view to the new one instead of cutting.
  const mode = f.ride || 'walk';
  if (!camInit) { camInit = true; camMode = mode; blend = 1; camera.position.copy(camPos); lookNow.copy(camTarget); }
  else if (mode !== camMode) { camMode = mode; blend = 0; fromPos.copy(camera.position); fromLook.copy(lookNow); }
  if (blend < 1) {
    blend = Math.min(1, blend + dt / 1.1); const e = easeInOut(blend);
    camera.position.lerpVectors(fromPos, camPos, e); lookNow.lerpVectors(fromLook, camTarget, e);
  } else { camera.position.copy(camPos); lookNow.copy(camTarget); }
  camUp.lerp(wantUp, blend < 1 ? 0.08 : 0.35).normalize(); camera.up.copy(camUp);
  if (f.shake > 0) camera.position.add(tmpV2.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(f.shake * 0.12));
  camera.lookAt(lookNow);
  fpArm.visible = !!pov && f.me.wave && blend >= 1;
  if (fpArm.visible) fpArm.rotation.z = 0.5 + Math.sin(t * 12) * 0.35;
  const fov = (mode === 'finale' ? 66 : 55) + (mode === 'walk' ? clamp(((f.me.spd ?? 0) - 1.05) * 12, 0, 6) : 0);
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov += (fov - camera.fov) * (1 - Math.exp(-dt * 4)); camera.updateProjectionMatrix(); }
  updateDust(dt); updateSkyLanterns(t, dt, f.night); updateWishes(t, f.night); updatePond(t, dt); updateMidway(f, t, dt); updateFountains(dt); updateCandles(f, t); updateTeashop(t); updateTeaDishes(f);
  for (const e of embers) e.emissiveIntensity = 0.8 + Math.sin(t * 5 + Math.sin(t * 13)) * 0.25;
  glowPts.material.size = 1.1 * (1 + 0.05 * Math.sin(t * 2.3));
  renderer.render(scene, camera);
  return { atTop };
}
export function snapCamera(): void { camInit = false; }

/** Projects a map point at a height (metres) to screen pixels. */
export function project(x: number, y: number, h: number, w: number, hpx: number): { sx: number; sy: number; ok: boolean; d: number } {
  tmpV.set(X(x), h, Z(y));
  const d = tmpV.distanceTo(camera.position);
  const front = tmpV2.copy(tmpV).applyMatrix4(camera.matrixWorldInverse).z < -0.1; // behind the camera can project on screen too
  tmpV.project(camera);
  return { sx: (tmpV.x + 1) / 2 * w, sy: (1 - tmpV.y) / 2 * hpx, ok: front && tmpV.z < 1 && tmpV.z > -1, d };
}
export function seatWorld(kind: RideKind): [number, number, number] | null {
  const s = rideSeat(kind); if (!s) return null; s.getWorldPosition(tmpV); return [tmpV.x / M, tmpV.y, tmpV.z / M];
}

// ---------------------------------------------------------------- avatar preview (its own little renderer)
let pv: { r: THREE.WebGLRenderer; s: THREE.Scene; c: THREE.PerspectiveCamera; rig: Rig | null } | null = null;
export function renderPreview(canvas: HTMLCanvasElement, o: PersonOpts, t: number): void {
  if (!pv || pv.r.domElement !== canvas) {
    pv?.r.dispose();
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); r.setSize(canvas.clientWidth || 220, canvas.clientHeight || 260, false);
    const s = new THREE.Scene(); s.add(new THREE.HemisphereLight('#fff1dc', '#3a2a5a', 2.2)); const dl = new THREE.DirectionalLight('#ffd9a0', 1.2); dl.position.set(2, 3, 4); s.add(dl);
    const c = new THREE.PerspectiveCamera(30, (canvas.clientWidth || 220) / (canvas.clientHeight || 260), 0.1, 50); c.position.set(0, 1.25, 5.2); c.lookAt(0, 0.95, 0);
    pv = { r, s, c, rig: null };
  }
  const key = rigKey(o);
  if (!pv.rig || pv.rig.key !== key) { pv.rig?.g.removeFromParent(); pv.rig = buildPerson(o); pv.s.add(pv.rig.g); }
  pv.rig.g.rotation.y = Math.sin(t * 0.6) * 0.6;
  animatePerson(pv.rig, t, false, false);
  pv.r.render(pv.s, pv.c);
}
export function capture(): HTMLCanvasElement { return renderer.domElement; }
