import { FairArt } from './worldArt';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { movementHeading, turnToward } from './motion';
import * as THREE from 'three';
import { PersonOpts, bodyProfile } from './people';
type Zone = { x: number; y: number; w: number; h: number; name: string; my: string; n: number; g: string };
export type Actor = { id: string; x: number; y: number; look: PersonOpts; moving?: boolean; name?: string; wave?: boolean; bike?: boolean; face?: number; speed?: number; heading?: number };
/** Real geometry, perspective camera and animated rides, sharing the original game's coordinates. */
export class World3D {
  renderer: THREE.WebGLRenderer;
  canvas: HTMLCanvasElement;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, .1, 500);
  private actors = new Map<string, THREE.Group>();
  private wheel = new THREE.Group();
  private carousel = new THREE.Group();
  private ship = new THREE.Group();
  private train: THREE.Group[]=[];
  private size = '';
  private materials = new Map<string, THREE.MeshStandardMaterial>();
  private box = new THREE.BoxGeometry(1, 1, 1);
  private ball = new THREE.SphereGeometry(1, 20, 16);
  private portraitRenderer: THREE.WebGLRenderer | null=null;
  private portraitScene=new THREE.Scene();
  private portraitActor:THREE.Group|null=null;
  portrait(look:PersonOpts):HTMLCanvasElement {
    if(!this.portraitRenderer){this.portraitRenderer=new THREE.WebGLRenderer({alpha:true,antialias:true});this.portraitRenderer.setSize(220,260);this.portraitRenderer.setPixelRatio(2);this.portraitScene.add(new THREE.HemisphereLight('#fff2dc','#64776d',2));const light=new THREE.DirectionalLight('#fff2dc',2);light.position.set(3,7,8);this.portraitScene.add(light);}
    if(this.portraitActor){this.portraitScene.remove(this.portraitActor);this.disposeActor(this.portraitActor);}
    this.portraitActor=this.avatar(look,false);this.portraitScene.add(this.portraitActor);
    const camera=new THREE.PerspectiveCamera(34,220/260,.1,80);camera.position.set(6,5.5,13);camera.lookAt(0,3.2,0);this.portraitRenderer.render(this.portraitScene,camera);return this.portraitRenderer.domElement;
  }
  private labels = new Map<string, THREE.Sprite>();
  constructor(zones: Zone[], colliders: { x: number; y: number; w: number; h: number }[], interactions: {x:number;y:number;label:string}[]) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia('(pointer:coarse)').matches?1.5:2));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.setClearColor('#101f30');
    this.canvas = this.renderer.domElement; this.canvas.id = 'world3d'; this.canvas.setAttribute('aria-label', '3D Yay Kyaw night fair');
    document.body.prepend(this.canvas); this.scene.fog = new THREE.FogExp2('#101f30', .0028);
    this.scene.add(new THREE.HemisphereLight('#9ebbe7', '#6d5446', 1.4));
    const moon = new THREE.DirectionalLight('#ffdbad', 2.2);moon.position.set(-25,90,200);moon.target.position.set(90,0,150);this.scene.add(moon.target);moon.castShadow=true;moon.shadow.mapSize.set(2048,2048);Object.assign(moon.shadow.camera,{left:-115,right:115,top:170,bottom:-170,near:.5,far:300});moon.shadow.normalBias=.045;moon.shadow.bias=-.00015;this.scene.add(moon);
    const rim=new THREE.DirectionalLight('#79b7d4',1.1);rim.position.set(160,40,90);this.scene.add(rim);
    const art=new FairArt(this.scene,Math.min(8,this.renderer.capabilities.getMaxAnisotropy()));art.ground();
    zones.forEach(z=>art.plaza(z));
    colliders.forEach((c,i)=>{if(c.w<=500&&c.h<=500)art.stall(c,i,interactions);});
    art.strings();art.entrance();
    // Wheel lies in an upright plane; gondolas stay upright while orbiting.
    this.wheel.position.set(42, 22, 56); this.scene.add(this.wheel);
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(17, .5, 6, 48), this.mat('#f3b654')); this.wheel.add(hoop);
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      const spoke = this.block(this.wheel, 8 * Math.cos(a), 8 * Math.sin(a), 0, 17, .2, .2, '#f2ce82'); spoke.rotation.z = a;
      const cabin = this.block(this.wheel, 17 * Math.cos(a), 17 * Math.sin(a), 0, 3, 3, 2.5, ['#e45f68', '#4fc8ae', '#f5ba48'][i % 3]); cabin.userData.cabin = true;
    }
    this.block(this.scene, 38, 10, 56, 1, 22, 1, '#c4a77c').rotation.z = -.2;
    this.block(this.scene, 46, 10, 56, 1, 22, 1, '#c4a77c').rotation.z = .2;
    this.carousel.position.set(138, 0, 60); this.scene.add(this.carousel);
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 1, 24), this.mat('#c95372')); platform.position.y = 1; this.carousel.add(platform);
    this.block(this.carousel, 0, 9, 0, 1, 18, 1, '#f1b54f');
    const roof = new THREE.Mesh(new THREE.ConeGeometry(17, 7, 16), this.mat('#efaf50')); roof.position.y = 19; this.carousel.add(roof);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, x = 11 * Math.cos(a), z = 11 * Math.sin(a); this.block(this.carousel, x, 8, z, .2, 14, .2, '#fff2cd'); const horse=new THREE.Group();horse.position.set(x,4.5,z);horse.rotation.y=-a;this.sphere(horse,0,0,0,1.25,.6,.45,'#e9d5ae');this.sphere(horse,.9,.65,0,.3,.9,.3,'#e9d5ae');this.sphere(horse,1,1.25,0,.5,.3,.28,'#e9d5ae');this.block(horse,0,.5,0,.8,.15,.85,'#9e4659');for(const hx of [-.7,.6])for(const hz of [-.25,.25])this.tube(horse,[hx,-.2,hz],[hx+.1,-1.1,hz],.1,'#a6825d');this.carousel.add(horse); }
    for(let i=0;i<24;i++){const a=i/24*Math.PI*2;const bulb=new THREE.Mesh(this.ball,art.material('#eac386',true));bulb.position.set(Math.cos(a)*15.7,16,Math.sin(a)*15.7);bulb.scale.setScalar(.18);this.carousel.add(bulb);}
    this.ship.position.set(138, 15, 110); this.scene.add(this.ship);
    const hullShape=new THREE.Shape();hullShape.moveTo(-10,-5);hullShape.lineTo(10,-5);hullShape.quadraticCurveTo(8,-10,0,-10);hullShape.quadraticCurveTo(-8,-10,-10,-5);const hullGeo=new THREE.ExtrudeGeometry(hullShape,{depth:6,bevelEnabled:true,bevelSize:.2,bevelThickness:.2,bevelSegments:2,steps:1});hullGeo.translate(0,0,-3);const hull=new THREE.Mesh(hullGeo,this.mat('#994d36'));hull.castShadow=true;this.ship.add(hull);for(const z of [-3,3])this.block(this.ship,0,-5,z,19,.25,.22,'#dfb35c');for(let i=-3;i<=3;i++)this.block(this.ship,i*2.3,-5.5,0,1.2,.5,5,'#b8895b');
    this.block(this.ship, -7, -1, 0, .4, 16, .4, '#e8c282'); this.block(this.ship, 7, -1, 0, .4, 16, .4, '#e8c282');
    for(let z=48;z<260;z+=30){const lamp=new THREE.PointLight('#ffb866',90,42,2);lamp.position.set(90,9,z);this.scene.add(lamp);}
    // A ring of tiny bulbs and framed gondolas make the wheel recognizable at a distance.
    for(let i=0;i<48;i++){const a=i/48*Math.PI*2;const bulb=new THREE.Mesh(this.ball,art.material(i%2?'#ffd78b':'#ec8c70',true));bulb.scale.setScalar(.2);bulb.position.set(Math.cos(a)*17,Math.sin(a)*17,.4);this.wheel.add(bulb);}
    this.wheel.children.filter(c=>c.userData.cabin).forEach((c,i)=>{const cabin=c as THREE.Mesh;const g=new THREE.Group();g.position.copy(cabin.position);g.userData.cabin=true;this.wheel.remove(cabin);this.block(g,0,-.1,0,3.4,2.6,2.8,['#b84f48','#387e7b','#d4a04c'][i%3]);this.block(g,0,.45,1.43,2.65,1.15,.06,'#ebdfba');this.block(g,0,1.45,0,3.7,.25,3.1,'#d0b477');this.wheel.add(g);});
    for(let i=0;i<4;i++){const car=new THREE.Group();this.block(car,0,2,0,3,2.5,4,i===0?'#c85b57':'#d2a763');for(const x of [-1.6,1.6])for(const z of [-1.2,1.2])this.sphere(car,x,.7,z,.5,.5,.5,'#24202c');this.train.push(car);this.scene.add(car);}
    art.optimize();
    this.canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.canvas.hidden = true; document.dispatchEvent(new Event('ykn-3d-lost')); });
  }
  private mat(color: string) { let m = this.materials.get(color); if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: .8 }); this.materials.set(color, m); } return m; }
  private block(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, color: string) {
    const m = new THREE.Mesh(this.box, this.mat(color)); m.position.set(x, y, z); m.scale.set(w, h, d);m.castShadow=m.receiveShadow=true; parent.add(m); return m;
  }
  private label(text: string) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d')!;
    g.fillStyle = '#182c31'; g.roundRect(0, 0, 512, 128, 18); g.fill(); g.strokeStyle = '#b7a17a'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#ffe8ac'; g.textAlign = 'center'; g.font = 'bold 27px Padauk, Pyidaungsu, sans-serif';
    const paint=()=>{g.clearRect(0,0,512,128);g.fillStyle='#182c31';g.beginPath();g.roundRect(0,0,512,128,18);g.fill();g.strokeStyle='#b7a17a';g.stroke();g.fillStyle='#f0dfbc';g.font='bold 27px Padauk, Pyidaungsu, sans-serif';text.split('\n').forEach((line,i)=>g.fillText(line,256,text.includes('\n')?47+i*48:76,480));};paint();
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: true, transparent:true })); sprite.scale.set(15, 3.75, 1);document.fonts.ready.then(()=>{paint();sprite.material.map!.needsUpdate=true;});return sprite;
  }
  private sphere(parent:THREE.Object3D,x:number,y:number,z:number,rx:number,ry:number,rz:number,color:string){const m=new THREE.Mesh(this.ball,this.mat(color));m.position.set(x,y,z);m.scale.set(rx,ry,rz);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
  private tube(parent:THREE.Object3D,a:number[],b:number[],r:number,color:string){
    const from=new THREE.Vector3(...a as [number,number,number]),to=new THREE.Vector3(...b as [number,number,number]);
    // Shared unit cylinder keeps articulated bicycles inexpensive.
    const mesh=new THREE.Mesh(this.rod,this.mat(color));mesh.position.copy(from.clone().add(to).multiplyScalar(.5));mesh.scale.set(r,from.distanceTo(to),r);mesh.castShadow=mesh.receiveShadow=true;mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),to.sub(from).normalize());parent.add(mesh);return mesh;
  }
  private disposeActor(group:THREE.Group){group.traverse(o=>{if(o instanceof THREE.Mesh && o.geometry!==this.box && o.geometry!==this.ball && o.geometry!==this.rod)o.geometry.dispose();});}
  private rod=new THREE.CylinderGeometry(1,1,1,8);
  private clothMats=new Map<string,THREE.MeshStandardMaterial>();
  private cloth(color:string,pattern:string){
    const key=color+pattern;let material=this.clothMats.get(key);if(material)return material;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const g=canvas.getContext('2d')!;g.fillStyle=color;g.fillRect(0,0,512,512);
    for(let i=0;i<512;i+=4){g.fillStyle='#fff7db0c';g.fillRect(0,i,512,1);g.fillStyle='#00000012';g.fillRect(i,0,1,512);}
    g.strokeStyle='#ecd9ad90';g.lineWidth=2;
    if(pattern==='acheik')for(let y=20;y<512;y+=42){g.beginPath();for(let x=0;x<=512;x+=4){const py=y+Math.sin(x/18)*6;if(!x)g.moveTo(x,py);else g.lineTo(x,py);}g.stroke();}
    else if(pattern!=='plain'){for(let y=0;y<512;y+=40){g.fillStyle='#e6cf9c70';g.fillRect(0,y,512,2);g.fillStyle='#ffffff20';g.fillRect(0,y+6,512,1);}if(pattern==='check')for(let x=0;x<512;x+=48){g.fillStyle='#e6cf9c65';g.fillRect(x,0,2,512);g.fillStyle='#00000025';g.fillRect(x+6,0,6,512);}}
    g.fillStyle='#14182050';g.fillRect(0,476,512,16);g.fillStyle='#e3c99f80';g.fillRect(0,479,512,2);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;material=new THREE.MeshStandardMaterial({map:texture,roughness:.9});this.clothMats.set(key,material);return material;
  }
  private avatar(look:PersonOpts,bike:boolean){
    const root=new THREE.Group(),body=new THREE.Group();body.name='body';root.add(body);
    const skin=look.skin,hair='#221b22',top=look.shirt,wrap=look.lon;
    const profile=bodyProfile(look.gender),shoulders=profile.shoulders;
    const lower=bike?2.4:1.7, torso=bike?3.55:3.7, head=bike?5.2:5.45;
    // Rounded cloth silhouettes and a clear wrapped waist rather than rectangular blocks.
    const skirt=new THREE.Mesh(new THREE.CylinderGeometry(look.outfit==='htamein'?.68:.85,look.outfit==='htamein'?.78:.72,bike?1.25:2.5,12),this.cloth(wrap,look.pat||'plain'));skirt.position.set(0,lower,0);skirt.castShadow=skirt.receiveShadow=true;body.add(skirt);
    const shirtPoints=[new THREE.Vector2(profile.hip,-.95),new THREE.Vector2(profile.waist,-.45),new THREE.Vector2(profile.waist+.04,0),new THREE.Vector2(shoulders,.55),new THREE.Vector2(shoulders*.82,.82),new THREE.Vector2(.24,.95)];
    const shirt=new THREE.Mesh(new THREE.LatheGeometry(shirtPoints,20),this.mat(top));shirt.scale.z=.62;shirt.position.y=torso;shirt.castShadow=shirt.receiveShadow=true;body.add(shirt);
    this.sphere(body,0,torso+1,0,profile.neck,.35,profile.neck,skin);
    this.block(body,0,torso+.82,.43,.22,.38,.12,'#f9e8ca');
    if(look.outfit==='taikpon'){
      this.block(body,0,torso,.53,.08,1.4,.08,'#ac957d');
      for(let i=0;i<4;i++)this.sphere(body,.16,torso+.45-i*.28,.58,.065,.065,.04,'#d7b26c');
    }else if(look.outfit==='htamein'){
      this.block(body,0,torso-.72,.42,1.25,.12,.12,'#eacb90');
      this.block(body,.33,torso,.53,.07,1.1,.06,'#f4d6ba');
    }else this.sphere(body,.15,lower+1.1,.65,.24,.16,.13,wrap);
    // A continuous woven texture wraps around the garment, including its back.
    const male=look.gender==='male',female=look.gender==='female';
    const facePoints=male?[[0,-.88],[.38,-.83],[.65,-.57],[.77,-.2],[.75,.36],[.61,.73],[.3,.9],[0,.94]]:female?[[0,-.92],[.21,-.86],[.43,-.64],[.64,-.28],[.67,.3],[.55,.7],[.25,.9],[0,.94]]:[[0,-.9],[.29,-.82],[.56,-.57],[.72,-.1],[.68,.4],[.5,.77],[0,.94]];
    const face=new THREE.Mesh(new THREE.LatheGeometry(facePoints.map(([r,y])=>new THREE.Vector2(r,y)),24),this.mat(skin));face.scale.z=.87;face.position.y=head;face.castShadow=true;body.add(face);
    this.sphere(body,0,head+.52,-.12,profile.face+.01,.46,.59,hair);
    // Eyes, brows, nose and a gentle smile make individual faces readable.
    const eyeX=male?.29:female?.24:.27,eyeZ=male?.65:female?.57:.61;
    for(const x of [-eyeX,eyeX]){this.sphere(body,x,head+.05,eyeZ,.055,.075,.035,'#221b22');const brow=this.block(body,x,head+.23,eyeZ,.2,male?.055:.025,.03,hair);brow.rotation.z=male?(x<0?-.07:.07):0;}
    this.sphere(body,0,head-.09,eyeZ+.08,male?.1:.075,.13,.1,skin);this.block(body,0,head-.38,eyeZ-.03,male?.24:.19,.025,.025,'#834e44');
    if(look.thanaka)for(const x of [-profile.face*.63,profile.face*.63])this.sphere(body,x,head-.18,eyeZ-.12,.13,.16,.035,'#e9cf91');
    if(look.hair==='long')this.sphere(body,0,head-.15,-.42,.82,1.05,.4,hair);
    if(look.hair==='bun'||look.bun)this.sphere(body,0,head+.65,-.58,.4,.4,.38,hair);
    if(look.head==='flower'||look.flower)for(let i=0;i<5;i++){const a=i/5*Math.PI*2;this.sphere(body,.6+Math.cos(a)*.16,head+.55+Math.sin(a)*.16,.25,.12,.12,.08,'#f4c647');}
    if(look.head==='gaungbaung'){this.sphere(body,0,head+.72,0,.84,.32,.73,'#e8d4b7');this.block(body,.6,head+.8,0,.25,.8,.2,'#e8d4b7');}
    if(look.head==='hat'||look.hat){const h=new THREE.Mesh(new THREE.ConeGeometry(1.15,.55,16),this.mat('#c4a36a'));h.position.set(0,head+.95,0);body.add(h);}
    if(look.head==='cap'){this.sphere(body,0,head+.65,0,.83,.28,.72,top);this.block(body,0,head+.6,.7,1.3,.12,.65,top);}
    if(look.glasses){for(const x of [-.28,.28])this.block(body,x,head+.05,.72,.42,.23,.1,'#20252c');this.block(body,0,head+.05,.73,.2,.05,.08,'#d2b88a');}
    for(const x of [-1,1]){
      const arm=new THREE.Group();arm.name=x>0?'rightArm':'leftArm';arm.position.set(x*(shoulders+.02),torso+.35,0);body.add(arm);
      this.sphere(arm,x*.12,-.25,0,.21,.38,.23,top);
      if(bike){this.tube(arm,[x*.1,-.4,0],[x*.1,-.6,.8],.16,skin);this.tube(arm,[x*.1,-.6,.8],[x*.02,-.35,1.35],.15,skin);}
      else this.sphere(arm,x*.16,-.85,.08,profile.arm,.42,profile.arm,skin);
    }
    if(look.bag){this.tube(body,[-.7,torso+.7,.58],[.9,lower+.1,.58],.06,'#c38e57');this.block(body,1,lower+.1,.2,.7,1,.3,'#b3574e');for(let i=0;i<3;i++)this.block(body,1,lower-.2+i*.25,.38,.6,.06,.03,'#e4c996');}
    if(!bike){for(const x of [-.38,.38]){this.block(body,x,.32,.12,.4,.5,.35,skin);this.block(body,x,.09,.25,.53,.15,.8,'#302c2b');}}
    else{
      // Wheels run along the street (Z axis); the rider sits on a real diamond frame.
      for(const z of [-1.65,1.65]){
        const wheel=new THREE.Group();wheel.position.set(0,1.1,z);wheel.userData.wheel=true;root.add(wheel);
        const tire=new THREE.Mesh(new THREE.TorusGeometry(1.05,.12,8,20),this.mat('#171b25'));tire.rotation.y=Math.PI/2;wheel.add(tire);
        for(let i=0;i<8;i++){const a=i/8*Math.PI*2;this.tube(wheel,[0,0,0],[0,Math.sin(a),Math.cos(a)],.018,'#c4c8c5');}
      }
      const frame='#65a49c';
      for(const [a,b] of [[[0,1.1,-1.65],[0,2.35,-.5]],[[0,2.35,-.5],[0,1.1,0]],[[0,1.1,0],[0,1.1,-1.65]],[[0,2.35,-.5],[0,2.5,1.15]],[[0,2.5,1.15],[0,1.1,0]],[[0,2.5,1.15],[0,1.1,1.65]]])this.tube(root,a,b,.075,frame);
      this.block(root,0,2.5,-.5,.7,.2,.6,'#4b3430');this.tube(root,[0,2.5,1.15],[0,3.55,1.3],.07,'#c3c6bb');this.tube(root,[-.9,3.55,1.3],[.9,3.55,1.3],.08,'#c3c6bb');
      this.block(root,0,2.75,2,.95,.7,.7,'#ac8859');this.sphere(root,.6,3.65,1.3,.13,.09,.13,'#f0c86f');
      const crank=new THREE.Group();crank.name='crank';crank.position.set(0,1.1,0);root.add(crank);
      for(const x of [-.5,.5]){const z=x<0?-.45:.45;this.tube(crank,[0,0,0],[x,0,z],.07,'#b6b8ab');this.block(crank,x,0,z,.4,.15,.3,'#242633');}
      for(const x of [-.45,.45]){this.tube(body,[x,2.4,-.3],[x,1.8,.6],.22,wrap);this.tube(body,[x,1.8,.6],[x,1.1,.1],.15,skin);this.block(body,x,1,.2,.4,.18,.65,'#302c2b');}
    }
    this.compactBody(body);return root;
  }
  private compactBody(body:THREE.Group){
    body.updateMatrixWorld(true);const batches=new Map<THREE.Material,THREE.Mesh[]>();
    for(const child of [...body.children])if(child instanceof THREE.Mesh){const material=child.material as THREE.Material;const list=batches.get(material)||[];list.push(child);batches.set(material,list);}
    for(const [material,meshes]of batches){if(meshes.length<2)continue;const parts=meshes.map(m=>m.geometry.clone().applyMatrix4(m.matrix));const merged=mergeGeometries(parts);parts.forEach(g=>g.dispose());if(!merged)continue;for(const m of meshes){body.remove(m);if(m.geometry!==this.box&&m.geometry!==this.ball&&m.geometry!==this.rod)m.geometry.dispose();}const mesh=new THREE.Mesh(merged,material);mesh.castShadow=mesh.receiveShadow=true;body.add(mesh);}
  }
  render(time: number, player: { x: number; y: number }, actors: Actor[], wide: boolean, train: {x:number;y:number;angle:number}[]=[]) {
    this.canvas.hidden = false;
    const size = `${innerWidth}:${innerHeight}`; if (this.size !== size) { this.size = size; this.renderer.setSize(innerWidth, innerHeight); this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); }
    const px = player.x / 10, pz = player.y / 10;
    const distance = wide ? 1.3 : 1;
    this.camera.position.set(px+8*distance,36*distance,pz+43*distance);this.camera.lookAt(px,2,pz-12);
    this.wheel.rotation.z = time * .12; this.wheel.children.forEach(c => { if (c.userData.cabin) c.rotation.z = -time * .12; });
    this.carousel.rotation.y = time * .25; this.ship.rotation.z = Math.sin(time) * .5;
    const live = new Set<string>();
    for (const a of actors) {
      live.add(a.id); let group = this.actors.get(a.id);
      const signature=JSON.stringify([a.look.gender,a.look.shirt,a.look.lon,a.look.skin,a.look.pat,a.look.outfit,a.look.hair,a.look.head,a.look.bun,a.look.hat,a.look.thanaka,a.look.glasses,a.look.bag,a.bike]);
      if (!group || group.userData.signature!==signature) {
        if(group){this.scene.remove(group);this.disposeActor(group);}
        group=this.avatar(a.look,!!a.bike); group.userData.signature=signature;
        this.scene.add(group); this.actors.set(a.id, group);
      }
      group.position.set(a.x / 10, !a.bike && a.moving ? Math.abs(Math.sin(time * 10 + a.x)) * .12 : 0, a.y / 10);
      const was=group.userData;
      const initial=a.heading ?? (a.id==='me'?Math.PI:Math.sin(a.x*3+a.y)*Math.PI);
      const dx=a.x-(was.x??a.x),dy=a.y-(was.y??a.y);
      const heading=a.bike?(a.face===-1?Math.PI:0):a.moving?movementHeading(dx,dy,was.heading??initial):(was.heading??initial);
      group.rotation.y=turnToward(was.rotation??heading,heading,time-(was.time??time));
      group.scale.setScalar(a.look.s||1);
      Object.assign(was,{x:a.x,y:a.y,heading,rotation:group.rotation.y,time});
      const body=group.getObjectByName('body')!;
      if(a.bike){
        body.rotation.x=.15;
        for(const wheel of group.children) if(wheel.userData.wheel) wheel.rotation.x=time*(a.speed||0)*.08;
        const crank=group.getObjectByName('crank');if(crank) crank.rotation.x=time*(a.speed||0)*.08;
      }else{
        const arm=body.getObjectByName('rightArm');if(arm){arm.rotation.z=a.wave?-2.5:0;arm.rotation.x=a.moving?Math.sin(time*9)*.28:0;}
        const left=body.getObjectByName('leftArm');if(left) left.rotation.x=a.moving?-Math.sin(time*9)*.28:0;
      }
      if (a.name) {
        let label = this.labels.get(a.id);
        if (!label || label.userData.text !== a.name) { if (label) { this.scene.remove(label); label.material.map?.dispose(); label.material.dispose(); } label = this.label(a.name); label.scale.set(6, 1.5, 1); label.userData.text = a.name; this.labels.set(a.id, label); this.scene.add(label); }
        label.position.set(a.x / 10, 8, a.y / 10);
      }
    }
    for (const [id, group] of this.actors) if (!live.has(id)) { this.scene.remove(group);this.disposeActor(group); this.actors.delete(id); const label = this.labels.get(id); if (label) { this.scene.remove(label); label.material.map?.dispose(); label.material.dispose(); this.labels.delete(id); } }
    this.train.forEach((car,i)=>{const p=train[i];car.visible=!!p;if(p){car.position.set(p.x/10,0,p.y/10);car.rotation.y=p.angle;}});
    this.renderer.render(this.scene, this.camera);
  }
}
