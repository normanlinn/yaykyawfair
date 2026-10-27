// The fair in 3D (Three.js). Game logic lives in main.ts and works in map units;
// this module builds the scene once and mirrors the game state into it every frame.
import * as THREE from 'three';
import { TAU, srng, rand, pick, clamp, lerp, MMF, BODY, DISP } from './util';
import { PersonOpts, bodyProfile } from './people';
import {
  M, WW, WH, NORTH, ROAD, ZONES, FW, CR, PS, TR, ST, FV, PHOTO, TOYS_AT, ARCH_Y, SNACKS, CARTS, TEA_TABLES, BOOTHS, SECRETS,
  STRINGS, TREES, trackPos,
} from './layout';

// ---------------------------------------------------------------- basics
let renderer: THREE.WebGLRenderer;
const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 900);
const hemi = new THREE.HemisphereLight('#6f5aa8', '#22182c', 1.4);
const moonLight = new THREE.DirectionalLight('#8fa6ff', 0.55);
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
function makeGlows(pts: Array<[number, number, number, string, number?]>, size: number): THREE.Points {
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
export function animatePerson(r: Rig, t: number, moving: boolean, wave: boolean, seated = false): void {
  const s = moving ? Math.sin(t * 11) : 0;
  r.body.position.y = moving ? Math.abs(s) * 0.05 : Math.sin(t * 2) * 0.008;
  r.footL.position.z = 0.02 + s * 0.14; r.footR.position.z = 0.02 - s * 0.14;
  r.footL.visible = r.footR.visible = !seated;
  if (wave) { r.armL.rotation.z = -0.4; r.armR.rotation.z = 2.6 + Math.sin(t * 12) * 0.35; r.armL.rotation.x = 0; }
  else { r.armL.rotation.z = 0.08; r.armR.rotation.z = -0.08; r.armL.rotation.x = s * 0.5; r.armR.rotation.x = -s * 0.5; }
  r.balloon.rotation.z = Math.sin(t * 1.7) * 0.06;
}

// ---------------------------------------------------------------- the crowd, instanced (a handful of draw calls for everyone)
export interface CrowdItem { x: number; y: number; hd: number; s: number; moving: boolean; t: number; shirt: string; lon: string; skin: string; hat?: boolean; bun?: boolean; balloon?: string | null }
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
      p.set(X(it.x), bob * it.s, Z(it.y)); q.setFromAxisAngle(up, it.hd); sc.setScalar(it.s);
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
  cars: [] as THREE.Group[], stageGlows: null as THREE.Points, stageLight: null as THREE.PointLight,
  band: [] as Rig[], secretSparkles: null as THREE.Points, steam: null as THREE.Points, lake: null as THREE.Mesh,
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
  scene.add(stars);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(128, 128, c => { c.fillStyle = '#fff6d6'; c.beginPath(); c.arc(64, 64, 40, 0, TAU); c.fill(); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(80, 54, 36, 0, TAU); c.fill(); }), fog: false, depthWrite: false }));
  moon.scale.setScalar(36); moon.position.set(160, 170, -260); scene.add(moon);

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
    const mat = new THREE.MeshBasicMaterial({ map: winTex[i % 3], color: '#bbbbbb' });
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
  halo.scale.set(90, 90, 1); halo.position.set(0, 32, -6); pag.add(halo);
  GLOWS.push([46, 51.5 + 0, -70, '#ffffff', 1.5]);
  // golden reflection on the lake
  const refl = new THREE.Mesh(new THREE.PlaneGeometry(6, 30), new THREE.MeshBasicMaterial({ color: '#ffb84a', transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
  refl.rotation.x = -Math.PI / 2; refl.position.set(46, 0.03, Z(NORTH) - 16); scene.add(refl);
  // lakeside fence
  const fence = lam('#5a5070');
  box(WW * M, 0.08, 0.08, fence, scene, 45, 1.0, Z(NORTH)); box(WW * M, 0.08, 0.08, fence, scene, 45, 0.5, Z(NORTH));
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 1.2, 0.1), fence, 76);
  for (let i = 0; i < 76; i++) posts.setMatrixAt(i, new THREE.Matrix4().makeTranslation(i * 1.2, 0.6, Z(NORTH)));
  scene.add(posts);
}

function buildGround(): void {
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), lam('#120e1a'));
  outside.rotation.x = -Math.PI / 2; outside.position.set(45, -0.02, 60); scene.add(outside);
  const fair = new THREE.Mesh(new THREE.PlaneGeometry(WW * M, (WH - NORTH) * M), lam('#211a29'));
  fair.rotation.x = -Math.PI / 2; fair.position.set(WW * M / 2, 0, Z((WH + NORTH) / 2)); scene.add(fair);
  const roadTex = canvasTex(128, 128, c => { c.fillStyle = '#3a3445'; c.fillRect(0, 0, 128, 128); c.fillStyle = 'rgba(255,255,255,.07)';
    for (let y = 0; y < 128; y += 32) { c.fillRect(0, y, 128, 2); for (let x = (y / 32) % 2 ? 16 : 0; x < 128; x += 32) c.fillRect(x, y, 2, 32); } }, true);
  roadTex.repeat.set(ROAD.w / 80, (WH - NORTH) / 80);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD.w * M, (WH - NORTH) * M), new THREE.MeshLambertMaterial({ map: roadTex }));
  road.rotation.x = -Math.PI / 2; road.position.set(X(ROAD.x + ROAD.w / 2), 0.01, Z((WH + NORTH) / 2)); scene.add(road);
  for (const zn of ZONES) {
    const tex = canvasTex(256, Math.round(256 * zn.h / zn.w), c => {
      const w = 256, h = c.canvas.height; c.fillStyle = zn.g; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(255,220,160,.18)'; c.lineWidth = 3; c.setLineDash([10, 8]); c.strokeRect(4, 4, w - 8, h - 8);
      c.fillStyle = 'rgba(255,231,163,.07)'; c.font = `400 64px ${DISP}`; c.textBaseline = 'bottom';
      c.textAlign = zn.x < ROAD.x ? 'left' : 'right'; c.fillText(String(zn.n).padStart(2, '0'), zn.x < ROAD.x ? 12 : w - 12, h - 6);
    });
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(zn.w * M, zn.h * M), new THREE.MeshLambertMaterial({ map: tex }));
    pad.rotation.x = -Math.PI / 2; pad.position.set(X(zn.x + zn.w / 2), 0.015, Z(zn.y + zn.h / 2)); scene.add(pad);
    // zone sign facing the main street
    const left = zn.x < ROAD.x, sx = X(left ? 712 : 1088), sz = Z(zn.y + 80);
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
    cyl(0.03, 0.03, 0.9, lam('#cfd3e8'), inner, 0, -0.45, 0, 4);
    box(1.4, 0.7, 1.1, lam(cols[i % 4]), inner, 0, -1.45, 0);
    box(1.4, 0.12, 1.1, lam(cols[i % 4]), inner, 0, -0.85, 0);
    box(1.5, 0.08, 1.2, lam('#fff3d6'), inner, 0, -0.78, 0);
    if (i % 3 !== 1 && i !== 0) { sphere(0.17, lam(pick(['#d9a77a', '#c58c5c', '#a8714a'])), inner, -0.3, -0.9, 0, 8); sphere(0.17, lam('#e4b98f'), inner, 0.3, -0.92, 0, 8); }
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
  const cx = X(TR.cx), cz = Z(TR.cy), rx = TR.rx * M, rz = TR.ry * M;
  const grass = add(new THREE.Mesh(new THREE.CircleGeometry(1, 40), lam('#2a3a2e')), scene, cx, 0.02, cz); grass.rotation.x = -Math.PI / 2; grass.scale.set(rx - 1.5, rz - 1.3, 1);
  for (const off of [-0.35, 0.35]) {
    const pts: THREE.Vector3[] = []; for (let i = 0; i <= 80; i++) { const a = i / 80 * TAU; pts.push(new THREE.Vector3(cx + Math.cos(a) * (rx + off), 0.08, cz + Math.sin(a) * (rz + off))); }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#8a8aa8' })));
  }
  const sl = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.06, 0.18), lam('#3e3428'), 60);
  for (let i = 0; i < 60; i++) { const a = i / 60 * TAU; const m = new THREE.Matrix4().compose(new THREE.Vector3(cx + Math.cos(a) * rx, 0.04, cz + Math.sin(a) * rz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(Math.sin(a) * rz, Math.cos(a) * rx)), new THREE.Vector3(1, 1, 1)); sl.setMatrixAt(i, m); }
  scene.add(sl);
  for (let i = 0; i < 6; i++) sphere(0.6, lam('#3a5a3e'), scene, cx - 6 + i * 2.4, 0.4, cz + Math.sin(i) * 1.5, 8);
  const cols = ['#c23b4b', '#2d7bb6', '#e0a526', '#3a9b7a'];
  for (let i = 0; i < 4; i++) {
    const car = add(new THREE.Group(), scene, 0, 0, 0);
    box(0.9, 0.7, 1.5, lam(cols[i]), car, 0, 0.6, 0);
    for (const [wx, wz] of [[-0.5, 0.45], [0.5, 0.45], [-0.5, -0.45], [0.5, -0.45]]) { const w = add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 10), lam('#1b1420')), car, wx, 0.25, wz); w.rotation.z = Math.PI / 2; }
    if (i === 0) { cyl(0.18, 0.22, 0.7, lam('#2a2238'), car, 0, 1.3, 0.35, 8); sphere(0.14, glowMat('#ffe7a3'), car, 0, 0.8, 0.78, 8); }
    else if (i !== 2) { sphere(0.17, lam('#c58c5c'), car, -0.15, 1.15, 0, 8); sphere(0.14, lam('#e4b98f'), car, 0.2, 1.1, -0.2, 8); }
    const seat = add(new THREE.Group(), car, 0, 0.55, 0); seat.name = 'seat';
    anim.cars.push(car);
  }
  // station
  const st = add(new THREE.Group(), scene, cx, 0, Z(TR.cy + TR.ry + 60));
  box(6, 0.3, 1.6, lam('#5a3a24'), st, 0, 0.15, 0);
  for (const sx of [-2.6, 2.6]) cyl(0.08, 0.08, 2.6, lam('#e9dcc4'), st, sx, 1.4, 0, 6);
  box(6.6, 0.25, 2.2, lam('#c23b4b'), st, 0, 2.8, 0);
  board(signTex('ရထားလေး', 'Mini train · 500 Ks', '#2a1606', 512, 140), 3.6, 1, st, 0, 3.5, 0);
  const pl = new THREE.PointLight('#ffe1a6', 24, 10, 2); pl.position.set(0, 2.6, 1); st.add(pl);
  // toy stall
  const ts = add(new THREE.Group(), scene, X(TOYS_AT.x), 0, Z(TOYS_AT.y));
  box(5.4, 1.5, 1.8, lam('#e9dcc4'), ts, 0, 0.75, -0.9);
  box(5.4, 0.4, 1.82, lam('#7a2e5c'), ts, 0, 0.3, -0.9);
  for (let k = 0; k < 5; k++) { cyl(0.02, 0.02, 2, lam('#ffffff'), ts, -2 + k, 2.5, -1.2, 4); sphere(0.32, lam(LANTERN_COLS[k]), ts, -2 + k, 3.7, -1.2, 10).scale.y = 1.2; }
  for (let k = 0; k < 4; k++) { sphere(0.25, lam('#f7efe0'), ts, -1.5 + k, 1.75, -0.6, 10); sphere(0.17, lam('#c23b4b'), ts, -1.5 + k, 2.1, -0.6, 8); } // tumbling dolls
  board(signTex('ကစားစရာ', 'Toys', '#2a1606', 384, 130), 3, 1, ts, 0, 4.9, -1.3);
  const tl = new THREE.PointLight('#ffd27a', 18, 9, 2); tl.position.set(0, 3, 1); ts.add(tl);
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
  const looks: PersonOpts[] = [
    { shirt: '#f4b63f', lon: '#7a1f2b', skin: '#a8714a', head: 'gaungbaung', gbc: '#ffffff' },
    { shirt: '#ffffff', lon: '#283a6b', skin: '#c58c5c' },
    { shirt: '#ff8ad8', lon: '#4b2c63', skin: '#e4b98f', outfit: 'htamein', bun: true, flower: true },
    { shirt: '#9fd3f0', lon: '#2f5d50', skin: '#d9a77a' },
  ];
  looks.forEach((o, i) => {
    const r = buildPerson({ ...o, s: 1.05 }); r.g.position.set(-5.5 + i * 3.6, 1.2, -1.6); g.add(r.g); anim.band.push(r);
  });
  // the saing waing drum circle around the first player
  const ring = add(new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.18, 8, 24), lam('#b8862b')), g, -5.5, 1.75, -1.6); ring.rotation.x = Math.PI / 2;
  for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; cyl(0.12, 0.12, 0.35, lam('#e0b45a'), g, -5.5 + Math.cos(a) * 1.0, 2.0, -1.6 + Math.sin(a) * 1.0, 8); }
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
const FMAX = 6000;
const fw = {
  pos: new Float32Array(FMAX * 3), col: new Float32Array(FMAX * 3), base: new Float32Array(FMAX * 3),
  vel: new Float32Array(FMAX * 3), life: new Float32Array(FMAX), max: new Float32Array(FMAX), drag: new Float32Array(FMAX), grav: new Float32Array(FMAX),
  kind: new Uint8Array(FMAX), // 0 spark, 1 shell
  type: [] as string[], next: 0, points: null as THREE.Points, flash: 0,
};
const FCOL = ['#ff5a4e', '#f4b63f', '#3fc7a5', '#ff8ad8', '#8fb4ff', '#ffffff', '#ffd27a'];
let onBoom: (() => void) | null = null;
function fwAdd(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, col: string, drag: number, g: number, kind = 0, type = ''): void {
  const i = fw.next; fw.next = (fw.next + 1) % FMAX;
  fw.pos.set([x, y, z], i * 3); fw.vel.set([vx, vy, vz], i * 3);
  const c = new THREE.Color(col); fw.base.set([c.r, c.g, c.b], i * 3);
  fw.life[i] = life; fw.max[i] = life; fw.drag[i] = drag; fw.grav[i] = g; fw.kind[i] = kind; fw.type[i] = type;
}
export function launchFirework(): void {
  const x = rand(5, 85), z = rand(-35, 5), col = pick(FCOL), type = pick(['peony', 'peony', 'ring', 'willow', 'crossette']);
  fwAdd(x, 1, z, rand(-1, 1), rand(30, 38), rand(-1, 1), rand(1.3, 1.7), '#ffdca0', 0.1, 9.8, 1, type + '|' + col);
}
function burst(i: number): void {
  const [type, col] = fw.type[i].split('|');
  const x = fw.pos[i * 3], y = fw.pos[i * 3 + 1], z = fw.pos[i * 3 + 2];
  const n = type === 'willow' ? 160 : 130;
  const ax = new THREE.Vector3(rand(-1, 1), rand(-0.3, 0.3), rand(-1, 1)).normalize(), v = new THREE.Vector3(), perp = new THREE.Vector3();
  for (let k = 0; k < n; k++) {
    if (type === 'ring') { const a = k / n * TAU; perp.set(Math.cos(a), Math.sin(a), 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), ax.z).normalize(); v.copy(perp).multiplyScalar(16); }
    else { v.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(type === 'willow' ? rand(5, 11) : rand(8, 17)); }
    const c = type === 'willow' ? '#ffd27a' : Math.random() < 0.2 ? '#ffffff' : col;
    fwAdd(x, y, z, v.x, v.y, v.z, type === 'willow' ? rand(2.4, 3.2) : rand(1.3, 2.0), c, type === 'willow' ? 1.4 : 1.0, type === 'willow' ? 3 : 6, type === 'crossette' ? 2 : 0);
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
    if (fw.kind[i] === 2 && fw.life[i] < fw.max[i] * 0.45) { fw.kind[i] = 0; for (let k = 0; k < 4; k++) { const a = k / 4 * TAU; fwAdd(fw.pos[i * 3], fw.pos[i * 3 + 1], fw.pos[i * 3 + 2], Math.cos(a) * 6, rand(-1, 1), Math.sin(a) * 6, 0.7, '#ffffff', 1.2, 4); } }
    const a = clamp(fw.life[i] / Math.min(fw.max[i], 1.2), 0, 1) * (0.75 + Math.random() * 0.25);
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
  scene.add(hemi, moonLight, new THREE.AmbientLight('#4a3a6a', 0.5));
  moonLight.position.set(80, 120, -160);
}
export function build3d(): void {
  buildSkyAndCity(); buildGround(); buildTrees(); buildLanterns(); buildFerris(); buildCarousel(); buildPirate();
  buildFood(); buildBooths(); buildKids(); buildStage(); buildFinaleAndGate(); buildSecrets();
  scene.add(makeGlows(GLOWS, 1.1));
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
export interface Body3D { x: number; y: number; hd: number; moving: boolean; wave: boolean; look: Look; balloon: string | null }
export type RideKind = 'ferris' | 'carousel' | 'pirate' | 'train' | 'finale' | null;
export interface Frame {
  t: number; dt: number; night: number; quality: 'low' | 'high';
  me: Body3D & { hidden: boolean };
  crowd: CrowdItem[];
  bikes: Array<{ x: number; y: number; dir: number; cur: number; ph: number; ringT: number; rider: PersonOpts; col: string; saika: boolean; moto: boolean }>;
  others: Array<Body3D & { id: string; visible: boolean }>;
  ride: RideKind; rideT: number; trainU: number;
  cam: { yaw: number; pitch: number; dist: number };
  sparkle: number[]; // 0..1 per secret
  steamFrom: Array<[number, number]>;
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
  if (kind === 'train') return anim.cars[2].getObjectByName('seat');
  return null;
}
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), camTarget = new THREE.Vector3(), camPos = new THREE.Vector3();
let camInit = false;

/** Renders a frame and returns where the camera looked (used by the minimap) and whether the Ferris cabin is at the top. */
export function render3d(f: Frame): { atTop: boolean } {
  const { t, dt } = f;
  // night light level
  const n = clamp(f.night, 0, 1), flash = fw.flash;
  hemi.intensity = (1.5 - 0.65 * n) + flash * 1.4;
  hemi.color.set(flash > 0.05 ? '#b49ad8' : '#6f5aa8');
  (scene.fog as THREE.Fog).color.setRGB(0.1 - 0.03 * n, 0.07 - 0.02 * n, 0.22 - 0.06 * n);

  // rides
  anim.wheel.rotation.z = (f.ride === 'ferris' ? 0 : 0) + t * 0.22 + (f.ride === 'ferris' ? 0 : 0);
  for (const c of anim.cabins) c.rotation.z = -anim.wheel.rotation.z;
  anim.carousel.rotation.y = -t * 0.6;
  anim.horses.forEach((h, i) => { h.position.y = 1.3 + Math.sin(t * 3 + i * 1.3) * 0.3; });
  anim.swing.rotation.z = Math.sin(t * 1.15) * 0.95;
  const arms = Math.abs(anim.swing.rotation.z) > 0.55;
  anim.swing.children.forEach(ch => { const r = (ch as THREE.Object3D & { rig?: Rig }).rig; if (r) animatePerson(r, t + ch.position.x, false, arms, true); });
  anim.cars.forEach((car, i) => {
    const u = f.trainU - i * 0.16, [x, y] = trackPos(u), [x2, y2] = trackPos(u + 0.01);
    car.position.set(X(x), 0, Z(y)); car.rotation.y = Math.atan2(X(x2) - X(x), Z(y2) - Z(y));
  });
  anim.band.forEach((r, i) => animatePerson(r, t + i, false, i === 2 && Math.sin(t * 1.3) > 0.4));
  anim.band.forEach((r, i) => { r.body.position.y = Math.abs(Math.sin(t * 4 + i)) * 0.06; });
  anim.stageLight.color.setHSL((t * 0.05) % 1, 0.7, 0.6);
  const sgc = anim.stageGlows.geometry.getAttribute('color') as THREE.BufferAttribute;
  for (let k = 0; k < 8; k++) { const on = (k + Math.floor(t * 4)) % 2; const c = new THREE.Color(LANTERN_COLS[k % 5]).multiplyScalar(on ? 2 : 0.25); sgc.setXYZ(k, c.r, c.g, c.b); }
  sgc.needsUpdate = true;
  const sp = anim.secretSparkles.geometry.getAttribute('color') as THREE.BufferAttribute;
  f.sparkle.forEach((a, i) => { const v = a * (0.6 + 0.4 * Math.sin(t * 5 + i)); sp.setXYZ(i, v, v * 0.95, v * 0.7); });
  sp.needsUpdate = true;
  (anim.lake.material as THREE.MeshLambertMaterial).emissiveIntensity = 0.9 + Math.sin(t * 0.7) * 0.1;

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
  if (seat) { player.g.position.set(0, f.ride === 'ferris' ? -1.75 : f.ride === 'carousel' ? -0.55 : 0, 0); player.g.rotation.y = 0; animatePerson(player, t, false, f.ride === 'pirate' && arms, true); }
  else { player.g.position.set(X(f.me.x), 0, Z(f.me.y)); player.g.rotation.y = f.me.hd; animatePerson(player, t, f.me.moving, f.me.wave); }
  player.g.visible = !f.me.hidden || !!seat;
  if (f.ride === 'finale') { player.g.position.set(X(FV.x) - 1.6, 0.6, Z(FV.y) - 1.2); player.g.rotation.y = Math.PI; }
  setBalloon(player, f.me.balloon);

  // others
  const seen = new Set<string>();
  for (const o of f.others) {
    seen.add(o.id);
    const r = syncRig(remotes.get(o.id) || null, o.look, scene); remotes.set(o.id, r);
    r.g.visible = o.visible; r.g.position.set(X(o.x), 0, Z(o.y)); r.g.rotation.y = o.hd; animatePerson(r, t + o.x, o.moving, o.wave); setBalloon(r, o.balloon);
  }
  for (const [id, r] of remotes) if (!seen.has(id)) { r.g.removeFromParent(); remotes.delete(id); }

  // camera
  let atTop = false;
  scene.updateMatrixWorld();
  if (seat && f.ride !== 'train') {
    seat.getWorldPosition(tmpV);
    if (f.ride === 'ferris') { camPos.set(tmpV.x, tmpV.y + 1.2, tmpV.z + 6.5); camTarget.set(tmpV.x, tmpV.y - 1.6, tmpV.z - 30); atTop = tmpV.y > 17; }
    else if (f.ride === 'carousel') { const c = new THREE.Vector3(X(CR.cx), 2, Z(CR.cy)); tmpV2.copy(tmpV).sub(c).setY(0).normalize(); camPos.copy(tmpV).addScaledVector(tmpV2, 6.5).setY(tmpV.y + 2.2); camTarget.copy(tmpV).setY(tmpV.y + 0.6); }
    else { camPos.set(X(PS.px), 5.5, Z(PS.py) + 16); camTarget.copy(tmpV).lerp(new THREE.Vector3(X(PS.px), 3, Z(PS.py)), 0.3); }
  } else if (f.ride === 'train' && seat) {
    seat.getWorldPosition(tmpV); const car = anim.cars[2]; tmpV2.set(Math.sin(car.rotation.y), 0, Math.cos(car.rotation.y));
    camPos.copy(tmpV).addScaledVector(tmpV2, -5.5).setY(3.4); camTarget.copy(tmpV).addScaledVector(tmpV2, 4).setY(0.9);
  } else if (f.ride === 'finale') {
    camPos.set(X(FV.x) + 0.9, 3.3, Z(FV.y) + 2.8); camTarget.set(X(FV.x) - 18, 24, -40);
  } else {
    const { yaw, pitch, dist } = f.cam;
    camTarget.set(X(f.me.x), 1.3, Z(f.me.y));
    camPos.set(camTarget.x + Math.sin(yaw) * Math.cos(pitch) * dist, camTarget.y + Math.sin(pitch) * dist, camTarget.z + Math.cos(yaw) * Math.cos(pitch) * dist);
  }
  if (!camInit) { camera.position.copy(camPos); camInit = true; }
  const k = f.ride && f.ride !== 'finale' ? 1 : Math.min(1, dt * 7);
  camera.position.lerp(camPos, k);
  camera.lookAt(camTarget);
  renderer.render(scene, camera);
  return { atTop };
}
export function snapCamera(): void { camInit = false; }

/** Projects a map point at a height (metres) to screen pixels. */
export function project(x: number, y: number, h: number, w: number, hpx: number): { sx: number; sy: number; ok: boolean; d: number } {
  tmpV.set(X(x), h, Z(y));
  const d = tmpV.distanceTo(camera.position);
  tmpV.project(camera);
  return { sx: (tmpV.x + 1) / 2 * w, sy: (1 - tmpV.y) / 2 * hpx, ok: tmpV.z < 1 && tmpV.z > -1, d };
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
