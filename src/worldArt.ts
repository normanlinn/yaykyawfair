import { MMF } from './util';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as THREE from 'three';

type Footprint = { x: number; y: number; w: number; h: number };
type Sign = { x: number; y: number; label: string };

/** Locally generated materials and hand-built market architecture; no remote asset requests. */
export class FairArt {
  private cube = new THREE.BoxGeometry(1, 1, 1);
  private globe = new THREE.SphereGeometry(1, 16, 12);
  private cylinder = new THREE.CylinderGeometry(1, 1, 1, 12);
  private mats = new Map<string, THREE.MeshStandardMaterial>();
  private wood: THREE.MeshStandardMaterial;
  private stone: THREE.MeshStandardMaterial;
  private brass: THREE.MeshStandardMaterial;
  constructor(private scene: THREE.Scene, private anisotropy: number) {
    const timber = this.texture('wood'); timber.repeat.set(2, 1);
    this.wood = new THREE.MeshStandardMaterial({ color: '#93704b', map: timber, roughness: .74, bumpMap: timber, bumpScale: .035 });
    const paving = this.texture('stone'); paving.repeat.set(8, 42);
    this.stone = new THREE.MeshStandardMaterial({ color: '#a3a3a0', map: paving, roughness: .45, metalness: .12, bumpMap: paving, bumpScale: .08 });
    this.brass = new THREE.MeshStandardMaterial({ color: '#d5a453', metalness: .65, roughness: .28 });
  }
  private texture(kind: 'wood' | 'stone' | 'fabric', stripe = '#b96044') {
    const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d')!;
    let seed = 31; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    if (kind === 'stone') {
      g.fillStyle = '#303d45'; g.fillRect(0, 0, 512, 512);
      for (let y = 0; y < 8; y++) for (let x = -1; x < 5; x++) {
        const shade = 72 + Math.floor(rand() * 27); g.fillStyle = `rgb(${shade},${shade + 12},${shade + 17})`;
        g.beginPath(); g.roundRect(x * 128 + (y % 2 ? 64 : 0) + 2, y * 64 + 2, 124, 60, 5); g.fill();
        g.strokeStyle = '#aec0b12b'; g.lineWidth = 2; g.stroke();
      }
    } else if (kind === 'wood') {
      g.fillStyle = '#b19b79'; g.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 230; i++) {
        g.strokeStyle = `rgba(53,31,18,${.025 + rand() * .14})`; g.lineWidth = .3 + rand() * 2;
        const y = rand() * 512; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(150, y + rand() * 15, 320, y - rand() * 15, 512, y); g.stroke();
      }
      for (let i = 0; i < 5; i++) { g.fillStyle = '#33271435'; g.fillRect(0, i * 103, 512, 3); }
    } else {
      for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#eee0b4' : stripe; g.fillRect(i * 64, 0, 64, 512); }
      for (let i = 0; i < 512; i += 4) { g.fillStyle = '#281e1b12'; g.fillRect(0, i, 512, 1); g.fillRect(i, 0, 1, 512); }
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = this.anisotropy; return t;
  }
  material(color: string, glow = false) {
    const key = color + glow; let mat = this.mats.get(key);
    if (!mat) { mat = new THREE.MeshStandardMaterial({ color, roughness: glow ? .45 : .75, emissive: glow ? color : '#000000', emissiveIntensity: glow ? .9 : 0 }); this.mats.set(key, mat); } return mat;
  }
  box(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material) {
    const m = new THREE.Mesh(this.cube, mat); m.position.set(x, y, z); m.scale.set(w, h, d); m.castShadow = m.receiveShadow = true;m.userData.fairArt=true; parent.add(m); return m;
  }
  private ball(parent: THREE.Object3D, x: number, y: number, z: number, sx: number, sy: number, sz: number, mat: THREE.Material) {
    const m = new THREE.Mesh(this.globe, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true;m.userData.fairArt=true; parent.add(m); return m;
  }
  private post(parent: THREE.Object3D, x: number, y: number, z: number, radius: number, height: number, mat = this.wood) {
    const m = new THREE.Mesh(this.cylinder, mat); m.position.set(x, y, z); m.scale.set(radius, height, radius); m.castShadow = true;m.userData.fairArt=true; parent.add(m); return m;
  }
  ground() {
    this.box(this.scene, 90, -.8, 150, 235, 1, 370, this.material('#1d3236'));
    this.box(this.scene, 90, -.12, 170, 28, .3, 315, this.stone);
    for (const x of [75.3, 104.7]) {
      this.box(this.scene, x, .03, 150, 1.2, .45, 270, this.material('#c5bda7'));
      this.box(this.scene, x, .3, 150, .12, .08, 270, this.brass);
    }
    // Drain grates and little inlaid brass stars break up the paving without a highway divider.
    for (let z = 42; z < 260; z += 16) {
      for (const x of [77.2, 102.8]) for (let k = 0; k < 5; k++) this.box(this.scene, x, .065, z + k * .22, 1, .035, .08, this.material('#29383c'));
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(.25), this.brass); star.position.set(90, .12, z); star.scale.y = .15; this.scene.add(star);
    }
    // Layered shophouse fronts make the street feel like a neighborhood rather than an empty platform.
    for (const side of [-1, 1]) for (let i = 0; i < 10; i++) {
      const x = side < 0 ? -10 : 190, z = 31 + i * 24, height = 12 + (i % 3) * 3;
      const color = ['#536d69', '#756963', '#526477', '#766a4d'][i % 4];
      this.box(this.scene, x, height / 2, z, 14, height, 22, this.material(color));
      this.box(this.scene, x, height + .5, z, 15, 1, 23, this.wood);
      for (let level = 0; level < 2; level++) for (let j = 0; j < 3; j++) {
        const wx = x + side * -7.05, wy = 5 + level * 5, wz = z - 7 + j * 7;
        this.box(this.scene, wx, wy, wz, .2, 2.8, 2.6, this.material((i + j) % 3 ? '#d6ab62' : '#273d46', (i + j) % 3 !== 0));
        this.box(this.scene, wx - side * .1, wy, wz, .2, 3.1, .15, this.wood);
      }
    }
  }
  stall(c: Footprint, index: number, signs: Sign[]) {
    const x = (c.x + c.w / 2) / 10, z = (c.y + c.h / 2) / 10, w = c.w / 10, d = c.h / 10;
    if (w < 3) { this.post(this.scene, x, 3, z, Math.max(.25, w / 3), 6); this.lantern(this.scene, x, 6.4, z, '#f5bf62', .55); return; }
    const group = new THREE.Group(); group.position.set(x, 0, z); this.scene.add(group);
    if(w>30&&z>195&&z<218){this.stage(group,w,d);return;}
    const stripe = ['#b64d42', '#327b75', '#d09a47', '#755687'][index % 4];
    const fabric = new THREE.MeshStandardMaterial({ map: this.texture('fabric', stripe), roughness: .85, side: THREE.DoubleSide });
    this.box(group, 0, .3, 0, w, .5, d, this.wood);
    this.box(group, 0, 1.7, 0, w * .96, 2.7, d * .92, this.wood);
    // Recessed panels, framed counter and a striped canvas canopy, all inside the original footprint.
    for (let j = 0; j < Math.ceil(w / 3); j++) this.box(group, -w / 2 + 1.5 + j * 3, 1.6, d / 2 + .03, Math.min(2.6, w - .5), 1.8, .08, this.material(stripe));
    this.box(group, 0, 3.15, 0, w + .15, .25, d + .15, this.wood);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.post(group, sx * (w / 2 - .15), 3.2, sz * (d / 2 - .15), .12, 6.4);
    const canopy = this.box(group, 0, 6.3, 0, w + .8, .16, d + 1, fabric); canopy.rotation.x = -.09;
    this.box(group, 0, 5.9, d / 2 + .45, w + .8, .8, .08, fabric);
    for (let j = 0; j < Math.max(2, Math.floor(w)); j++) this.ball(group, -w / 2 + .4 + j, 5.52, d / 2 + .46, .48, .15, .06, this.material(j % 2 ? '#eee0b4' : stripe));
    this.box(group, 0, 5.65, -d / 2, w - .6, .13, .12, this.material('#ffd89c', true));
    for (const sx of [-1, 1]) this.lantern(group, sx * Math.max(1, w / 2 - .6), 4.7, d / 2 + .4, sx < 0 ? '#f2bd62' : '#f17d52', .42);
    const nearest = signs.map(s => ({ ...s, distance: Math.hypot(s.x / 10 - x, s.y / 10 - z) })).sort((a, b) => a.distance - b.distance)[0];
    if (nearest && nearest.distance < 20) this.board(group, nearest.label, 0, 4.7, -d / 2 + .18, Math.min(w - .5, 12), 1.45);
    const food = z > 90 && z < 141 && x < 76;
    // Little bowls, woven produce baskets, stacked cups and stainless soup pots.
    const count = Math.min(7, Math.max(2, Math.floor(w / 2)));
    for (let j = 0; j < count; j++) {
      const bx = -w * .37 + j * w * .74 / (count - 1);
      if (food && j % 3 === 0) {
        this.post(group, bx, 3.7, 0, .55, .85, new THREE.MeshStandardMaterial({ color: '#bcc5c2', metalness: .8, roughness: .3 }));
        this.ball(group, bx, 4.13, 0, .57, .12, .57, this.material('#c2c8c1')); this.post(group, bx, 4.28, 0, .08, .16);
      } else {
        this.ball(group, bx, 3.43, 0, .55, .22, .55, this.material('#c2935d'));
        for (let k = 0; k < 4; k++) this.ball(group, bx + Math.sin(k * 2.4) * .25, 3.61, Math.cos(k * 2.4) * .25, .18, .18, .18, this.material(food ? ['#e2b55d', '#7b9b54', '#de855a'][j % 3] : ['#eeab62', '#76b1ac', '#cb7c95'][j % 3]));
      }
    }
  }
  plaza(z:{x:number;y:number;w:number;h:number;my:string;name:string}) {
    const map=this.texture('stone');map.repeat.set(z.w/70,z.h/70);const material=new THREE.MeshStandardMaterial({color:'#777f78',map,roughness:.9,bumpMap:map,bumpScale:.035});
    this.box(this.scene,(z.x+z.w/2)/10,-.25,(z.y+z.h/2)/10,z.w/10,.18,z.h/10,material);
    const x=z.x<760?72:108,y=(z.y+z.h/2)/10;this.post(this.scene,x,2.4,y,.1,4.8);this.board(this.scene,z.my,x,4.8,y,6.5,1.3);
  }
  private stage(group:THREE.Group,w:number,d:number){
    this.box(group,0,.5,0,w,1,d,this.wood);this.box(group,0,4,-d/2+.25,w,7,.3,this.material('#22393c'));
    for(const x of [-w/2+1,w/2-1]){this.post(group,x,5,0,.2,10);this.box(group,x,3.5,1,2,5,2,this.material('#1b242b'));for(const y of [2.2,4])this.ball(group,x,y,2.03,.65,.65,.08,this.material('#384651'));}
    const roof=this.box(group,0,9,0,w+1,.35,d+1,this.material('#315c58'));roof.rotation.x=-.07;
    for(const x of [-w/2+3,w/2-3]){this.box(group,x,5,-d/2+.6,4.5,7,.3,this.material('#7e3341'));}
    this.board(group,'ရေကျော် ဂီတည',0,6.8,-d/2+.5,13,2.4);
    for(let i=0;i<5;i++){const x=-w/3+i*w/6;this.post(group,x,1.5,0,.65,1.2,this.material('#ba774d'));this.ball(group,x,2.12,0,.67,.08,.67,this.material('#eddfc4'));this.box(group,x,.8,d/2,.9,.2,.7,this.material(i%2?'#e8b266':'#b94e5c',true));}
  }
  private board(parent: THREE.Object3D, text: string, x: number, y: number, z: number, width: number, height: number) {
    const c = document.createElement('canvas'); c.width = 768; c.height = 128; const g = c.getContext('2d')!;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = this.anisotropy;
    const paint = () => { g.fillStyle = '#143b39'; g.fillRect(0, 0, 768, 128); g.strokeStyle = '#dab778'; g.lineWidth = 5; g.strokeRect(8, 8, 752, 112); g.font = '700 38px '+MMF; g.textAlign = 'center'; g.fillStyle = '#fff0c9'; g.fillText(text, 384, 78, 720); t.needsUpdate = true; }; paint(); document.fonts.ready.then(paint);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: t, emissive: '#d6ac6c', emissiveMap: t, emissiveIntensity: .25, roughness: .8, side: THREE.DoubleSide })); sign.position.set(x, y, z); parent.add(sign);
  }
  private papers=new Map<string,THREE.MeshBasicMaterial>();
  private paper(color:string){
    let material=this.papers.get(color);if(material)return material;
    const c=document.createElement('canvas');c.width=256;c.height=128;const g=c.getContext('2d')!;
    const shade=new THREE.Color(color).multiplyScalar(.55).getStyle(),light=new THREE.Color(color).lerp(new THREE.Color('#ffe7bd'),.3).getStyle();
    const grad=g.createLinearGradient(0,0,256,0);grad.addColorStop(0,shade);grad.addColorStop(.28,color);grad.addColorStop(.5,light);grad.addColorStop(.72,color);grad.addColorStop(1,shade);g.fillStyle=grad;g.fillRect(0,0,256,128);
    for(let y=0;y<128;y+=6){g.fillStyle='#5b261515';g.fillRect(0,y,256,1);}
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;material=new THREE.MeshBasicMaterial({map:texture,toneMapped:false});this.papers.set(color,material);return material;
  }
  lantern(parent: THREE.Object3D, x: number, y: number, z: number, color: string, scale = 1) {
    const lamp = new THREE.Group(); lamp.position.set(x, y, z); lamp.scale.setScalar(scale); parent.add(lamp);
    this.ball(lamp, 0, 0, 0, .65, .84, .65, this.paper(color));
    for (const sy of [-1, 1]) this.post(lamp, 0, sy * .72, 0, .35, .12, this.brass);
    this.post(lamp, 0, -.96, 0, .04, .32, this.material('#d5b16a'));
    // Fine vertical ribs and a hanging silk tassel sharpen the paper-lantern silhouette.
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; this.post(lamp, Math.cos(a) * .59, 0, Math.sin(a) * .59, .018, 1.12, this.material('#ad613f')); }
    for (let i = -1; i <= 1; i++) this.post(lamp, i * .08, -1.2, 0, .025, .3, this.material(color));
  }
  strings() {
    for (let z = 44; z < 256; z += 22) {
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= 24; i++) { const u = i / 24; points.push(new THREE.Vector3(76 + 28 * u, 13 - Math.sin(u * Math.PI) * 2.4, z)); }
      const wire = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: '#625342' })); this.scene.add(wire);
      for (let i = 1; i < 8; i++) { const u = i / 8; this.lantern(this.scene, 76 + 28 * u, 12.4 - Math.sin(u * Math.PI) * 2.4, z, ['#ed7847', '#f8c573', '#69aa95'][i % 3], .8); }
      for (const x of [75.6, 104.4]) this.post(this.scene, x, 6.3, z, .14, 13);
    }
  }
  /** Merge static geometry by material so the decorative detail stays affordable on phones. */
  optimize() {
    this.scene.updateMatrixWorld(true);const batches=new Map<THREE.Material,THREE.Mesh[]>();
    this.scene.traverse(o=>{if(o instanceof THREE.Mesh&&o.userData.fairArt){const mat=o.material as THREE.Material;const list=batches.get(mat)||[];list.push(o);batches.set(mat,list);}});
    for(const [mat,meshes]of batches){if(meshes.length<2)continue;const parts=meshes.map(m=>m.geometry.clone().applyMatrix4(m.matrixWorld));const merged=mergeGeometries(parts);parts.forEach(g=>g.dispose());if(!merged)continue;for(const m of meshes)m.removeFromParent();const mesh=new THREE.Mesh(merged,mat);mesh.castShadow=mesh.receiveShadow=true;this.scene.add(mesh);}
  }
  entrance() {
    for (const x of [78.2, 101.8]) {
      this.box(this.scene, x, 1.5, 247, 1.8, 3, 1.2, this.material('#925c45'));
      this.post(this.scene, x, 7.4, 247, .3, 12, this.wood);
      for (const y of [3.5, 11, 12]) this.post(this.scene, x, y, 247, .4, .2, this.brass);
      this.lantern(this.scene, x, 12.9, 247, '#f5b657', 1);
    }
    this.box(this.scene, 90, 12, 247, 24, .7, .7, this.wood);
    this.board(this.scene, 'ရေကျော်ညများ  ·  YAY KYAW NIGHTS', 90, 12.1, 247.4, 15, 2.1);
    // Flower boxes flank the entry, outside the walking lane.
    for (const x of [69, 111]) {
      this.box(this.scene, x, .65, 250, 4, 1.3, 4, this.wood);
      for (let i = 0; i < 13; i++) { const px = x + Math.sin(i * 2.4) * 1.5, pz = 250 + Math.cos(i * 2.4) * 1.5; this.post(this.scene, px, 1.4, pz, .045, 1.5, this.material('#567e4e')); this.ball(this.scene, px, 2.1, pz, .32, .25, .32, this.material(i % 2 ? '#f4c561' : '#d58b72')); }
    }
  }
}
