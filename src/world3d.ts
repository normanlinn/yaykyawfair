import { movementHeading, turnToward } from './motion';
import * as THREE from 'three';
import { PersonOpts } from './people';
type Zone = { x: number; y: number; w: number; h: number; name: string; my: string; n: number; g: string };
export type Actor = { id: string; x: number; y: number; look: PersonOpts; moving?: boolean; name?: string; wave?: boolean; bike?: boolean; face?: number; speed?: number; heading?: number };
/** Real geometry, perspective camera and animated rides, sharing the original game's coordinates. */
export class World3D {
  renderer: THREE.WebGLRenderer;
  canvas: HTMLCanvasElement;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(48, 1, .1, 500);
  private actors = new Map<string, THREE.Group>();
  private wheel = new THREE.Group();
  private carousel = new THREE.Group();
  private ship = new THREE.Group();
  private train: THREE.Group[]=[];
  private size = '';
  private materials = new Map<string, THREE.MeshStandardMaterial>();
  private box = new THREE.BoxGeometry(1, 1, 1);
  private ball = new THREE.SphereGeometry(1, 10, 8);
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
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); this.renderer.setClearColor('#100e24');
    this.canvas = this.renderer.domElement; this.canvas.id = 'world3d'; this.canvas.setAttribute('aria-label', '3D Yay Kyaw night fair');
    document.body.prepend(this.canvas); this.scene.fog = new THREE.FogExp2('#16132b', .006);
    this.scene.add(new THREE.HemisphereLight('#c2c7ff', '#4b2840', 1.8));
    const moon = new THREE.DirectionalLight('#ffe4ba', 1.6); moon.position.set(-30, 90, 60); this.scene.add(moon);
    this.block(this.scene, 90, -.7, 155, 220, 1, 340, '#211c35');
    this.block(this.scene, 90, -.1, 180, 28, .25, 294, '#3b3549');
    for (let y = 36; y < 260; y += 8) this.block(this.scene, 90, .1, y, .4, .1, 3, '#c6ad75');
    zones.forEach(z => {
      this.block(this.scene, (z.x + z.w / 2) / 10, -.1, (z.y + z.h / 2) / 10, z.w / 10, .25, z.h / 10, z.g);
      const label = this.label(`${z.my}\n${z.name}`); label.position.set((z.x + z.w / 2) / 10, 11, (z.y + z.h - 15) / 10); this.scene.add(label);
    });
    // Match collision footprints so visible booths never invite walking through an invisible wall.
    colliders.forEach((c, i) => {
      if (c.w > 500 || c.h > 500) return;
      const x = (c.x + c.w / 2) / 10, z = (c.y + c.h / 2) / 10;
      this.block(this.scene, x, 2, z, c.w / 10, 4, c.h / 10, ['#793b62', '#326e69', '#a96340'][i % 3]);
      this.block(this.scene, x, 4.4, z, c.w / 10 + 1, .8, c.h / 10 + 1, ['#edac57', '#d95977', '#62b7aa'][i % 3]);
    });
    interactions.forEach(it=>{const label=this.label(it.label.slice(0,80));label.position.set(it.x/10,9,it.y/10);label.scale.set(12,3,1);this.scene.add(label);});
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
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, x = 11 * Math.cos(a), z = 11 * Math.sin(a); this.block(this.carousel, x, 8, z, .2, 14, .2, '#fff2cd'); this.block(this.carousel, x, 5, z, 3, 2, 1.5, '#95d2c4'); }
    this.ship.position.set(138, 15, 110); this.scene.add(this.ship);
    this.block(this.ship, 0, -8, 0, 18, 4, 7, '#ae7048');
    this.block(this.ship, -7, -1, 0, .4, 16, .4, '#e8c282'); this.block(this.ship, 7, -1, 0, .4, 16, .4, '#e8c282');
    for (let z = 44; z < 256; z += 25) {
      for (let i = 0; i <= 8; i++) { const x = 76 + i * 3.5; const bulb = new THREE.Mesh(this.ball, new THREE.MeshStandardMaterial({color:['#f28e60', '#f4ca59', '#5dd3bc'][i%3],emissive:['#f28e60', '#f4ca59', '#5dd3bc'][i%3],emissiveIntensity:1.5})); bulb.scale.set(.7, 1, .7); bulb.position.set(x, 13 - Math.sin(i / 8 * Math.PI) * 2, z); this.scene.add(bulb); }
      const lamp=new THREE.PointLight('#ffc47a',35,30,2);lamp.position.set(90,9,z);this.scene.add(lamp);
      this.block(this.scene, 76, 6, z, .3, 14, .3, '#b99a75'); this.block(this.scene, 104, 6, z, .3, 14, .3, '#b99a75');
    }
    for(let i=0;i<4;i++){const car=new THREE.Group();this.block(car,0,2,0,3,2.5,4,i===0?'#c85b57':'#d2a763');for(const x of [-1.6,1.6])for(const z of [-1.2,1.2])this.sphere(car,x,.7,z,.5,.5,.5,'#24202c');this.train.push(car);this.scene.add(car);}
    const gate = this.label('ရေကျော်ညများ\nYay Kyaw Nights'); gate.position.set(90, 18, 244); gate.scale.set(12, 3, 1); this.scene.add(gate);
    this.block(this.scene, 76, 6, 244, 1, 14, 1, '#c18254'); this.block(this.scene, 104, 6, 244, 1, 14, 1, '#c18254');
    this.canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.canvas.hidden = true; document.dispatchEvent(new Event('ykn-3d-lost')); });
  }
  private mat(color: string) { let m = this.materials.get(color); if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: .8 }); this.materials.set(color, m); } return m; }
  private block(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, color: string) {
    const m = new THREE.Mesh(this.box, this.mat(color)); m.position.set(x, y, z); m.scale.set(w, h, d); parent.add(m); return m;
  }
  private label(text: string) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d')!;
    g.fillStyle = '#182c31'; g.roundRect(0, 0, 512, 128, 18); g.fill(); g.strokeStyle = '#b7a17a'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#ffe8ac'; g.textAlign = 'center'; g.font = 'bold 27px Padauk, Pyidaungsu, sans-serif';
    const paint=()=>{g.clearRect(0,0,512,128);g.fillStyle='#182c31';g.beginPath();g.roundRect(0,0,512,128,18);g.fill();g.strokeStyle='#b7a17a';g.stroke();g.fillStyle='#f0dfbc';g.font='bold 27px Padauk, Pyidaungsu, sans-serif';text.split('\n').forEach((line,i)=>g.fillText(line,256,text.includes('\n')?47+i*48:76,480));};paint();
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: true, transparent:true })); sprite.scale.set(15, 3.75, 1);document.fonts.ready.then(()=>{paint();sprite.material.map!.needsUpdate=true;});return sprite;
  }
  private sphere(parent:THREE.Object3D,x:number,y:number,z:number,rx:number,ry:number,rz:number,color:string){const m=new THREE.Mesh(this.ball,this.mat(color));m.position.set(x,y,z);m.scale.set(rx,ry,rz);parent.add(m);return m;}
  private tube(parent:THREE.Object3D,a:number[],b:number[],r:number,color:string){
    const from=new THREE.Vector3(...a as [number,number,number]),to=new THREE.Vector3(...b as [number,number,number]);
    // Shared unit cylinder keeps articulated bicycles inexpensive.
    const mesh=new THREE.Mesh(this.rod,this.mat(color));mesh.position.copy(from.clone().add(to).multiplyScalar(.5));mesh.scale.set(r,from.distanceTo(to),r);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),to.sub(from).normalize());parent.add(mesh);return mesh;
  }
  private disposeActor(group:THREE.Group){group.traverse(o=>{if(o instanceof THREE.Mesh && o.geometry!==this.box && o.geometry!==this.ball && o.geometry!==this.rod)o.geometry.dispose();});}
  private rod=new THREE.CylinderGeometry(1,1,1,8);
  private avatar(look:PersonOpts,bike:boolean){
    const root=new THREE.Group(),body=new THREE.Group();body.name='body';root.add(body);
    const skin=look.skin,hair='#221b22',top=look.shirt,wrap=look.lon;
    const lower=bike?2.4:1.7, torso=bike?3.55:3.7, head=bike?5.2:5.45;
    // Rounded cloth silhouettes and a clear wrapped waist rather than rectangular blocks.
    const skirt=new THREE.Mesh(new THREE.CylinderGeometry(look.outfit==='htamein'?.68:.85,look.outfit==='htamein'?.78:.72,bike?1.25:2.5,12),this.mat(wrap));skirt.position.set(0,lower,0);body.add(skirt);
    const shirt=this.sphere(body,0,torso,0,.91,1.02,.56,top);
    this.block(body,0,torso+.82,.43,.22,.38,.12,'#f9e8ca');
    if(look.outfit==='taikpon'){
      this.block(body,0,torso,.53,.08,1.4,.08,'#ac957d');
      for(let i=0;i<4;i++)this.sphere(body,.16,torso+.45-i*.28,.58,.065,.065,.04,'#d7b26c');
    }else if(look.outfit==='htamein'){
      this.block(body,0,torso-.72,.42,1.25,.12,.12,'#eacb90');
      this.block(body,.33,torso,.53,.07,1.1,.06,'#f4d6ba');
    }else this.sphere(body,.15,lower+1.1,.65,.24,.16,.13,wrap);
    // Woven checks, stripes and acheik-inspired chevrons wrap the longyi.
    if(look.pat!=='plain')for(let i=0;i<7;i++){
      const y=lower-(bike?.5:1.05)+i*(bike?.15:.32);
      if(look.pat==='acheik')for(let j=0;j<4;j++){const x=-.62+j*.4;this.tube(body,[x,y,.73],[x+.2,y+.11,.73],.025,'#dfb778');this.tube(body,[x+.2,y+.11,.73],[x+.4,y,.73],.025,'#dfb778');}
      else this.block(body,0,y,.74,1.4,.035,.025,'#d0b596');
    }
    if(look.pat==='check')for(const x of [-.5,-.15,.2,.55])this.block(body,x,lower,.75,.025,bike?1.1:2.4,.025,'#b5a999');
    this.sphere(body,0,head,0,.79,.91,.7,skin);
    this.sphere(body,0,head+.48,-.13,.8,.55,.68,hair);
    // Eyes, brows, nose and a gentle smile make individual faces readable.
    for(const x of [-.28,.28]){this.sphere(body,x,head+.05,.64,.065,.09,.04,'#221b22');this.block(body,x,head+.23,.64,.2,.035,.03,hair);}
    this.sphere(body,0,head-.09,.72,.085,.13,.1,skin);this.block(body,0,head-.38,.65,.22,.035,.025,'#834e44');
    if(look.thanaka)for(const x of [-.47,.47])this.sphere(body,x,head-.18,.55,.19,.2,.07,'#efd99d');
    if(look.hair==='long')this.sphere(body,0,head-.15,-.42,.82,1.05,.4,hair);
    if(look.hair==='bun'||look.bun)this.sphere(body,0,head+.65,-.58,.4,.4,.38,hair);
    if(look.head==='flower'||look.flower)for(let i=0;i<5;i++){const a=i/5*Math.PI*2;this.sphere(body,.6+Math.cos(a)*.16,head+.55+Math.sin(a)*.16,.25,.12,.12,.08,'#f4c647');}
    if(look.head==='gaungbaung'){this.sphere(body,0,head+.72,0,.84,.32,.73,'#e8d4b7');this.block(body,.6,head+.8,0,.25,.8,.2,'#e8d4b7');}
    if(look.head==='hat'||look.hat){const h=new THREE.Mesh(new THREE.ConeGeometry(1.15,.55,16),this.mat('#c4a36a'));h.position.set(0,head+.95,0);body.add(h);}
    if(look.head==='cap'){this.sphere(body,0,head+.65,0,.83,.28,.72,top);this.block(body,0,head+.6,.7,1.3,.12,.65,top);}
    if(look.glasses){for(const x of [-.28,.28])this.block(body,x,head+.05,.72,.42,.23,.1,'#20252c');this.block(body,0,head+.05,.73,.2,.05,.08,'#d2b88a');}
    for(const x of [-1,1]){
      const arm=new THREE.Group();arm.name=x>0?'rightArm':'leftArm';arm.position.set(x*.85,torso+.35,0);body.add(arm);
      this.sphere(arm,x*.12,-.25,0,.25,.45,.29,top);
      if(bike){this.tube(arm,[x*.1,-.4,0],[x*.1,-.6,.8],.16,skin);this.tube(arm,[x*.1,-.6,.8],[x*.02,-.35,1.35],.15,skin);}
      else this.sphere(arm,x*.16,-.85,.08,.17,.42,.18,skin);
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
    return root;
  }
  render(time: number, player: { x: number; y: number }, actors: Actor[], wide: boolean, train: {x:number;y:number;angle:number}[]=[]) {
    this.canvas.hidden = false;
    const size = `${innerWidth}:${innerHeight}`; if (this.size !== size) { this.size = size; this.renderer.setSize(innerWidth, innerHeight); this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); }
    const px = player.x / 10, pz = player.y / 10;
    const distance = wide ? 1.5 : 1;
    this.camera.position.set(px, 44 * distance, pz + 43 * distance); this.camera.lookAt(px, 1, pz - 16);
    this.wheel.rotation.z = time * .12; this.wheel.children.forEach(c => { if (c.userData.cabin) c.rotation.z = -time * .12; });
    this.carousel.rotation.y = time * .25; this.ship.rotation.z = Math.sin(time) * .5;
    const live = new Set<string>();
    for (const a of actors) {
      live.add(a.id); let group = this.actors.get(a.id);
      const signature=JSON.stringify([a.look.shirt,a.look.lon,a.look.skin,a.look.pat,a.look.outfit,a.look.hair,a.look.head,a.look.bun,a.look.hat,a.look.thanaka,a.look.glasses,a.look.bag,a.bike]);
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
