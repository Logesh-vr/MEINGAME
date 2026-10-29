import * as THREE from 'three';
import { FIELD, ROSTER, THEMES, type Team, type UnitKind } from './data';
import { Battle, CORE_X, type Unit } from './simulation';
import type { Settings } from './save';
const CYAN=0x77e9ed,AMBER=0xffb65d;
interface Figure {root:THREE.Group;legs:THREE.Group[];arms:THREE.Group[];knees:THREE.Group[];gait:number;stride:number;initialized:boolean;shield?:THREE.Mesh;visor:THREE.Mesh;gun?:THREE.Group;bar:THREE.Mesh;shieldBar:THREE.Mesh;selection:THREE.Mesh;cargo?:THREE.Mesh;}
interface Effect {mesh:THREE.Mesh;life:number;max:number;emp:boolean;}
export class World {
  renderer:THREE.WebGLRenderer;
  scene=new THREE.Scene();
  camera:THREE.PerspectiveCamera;
  private environment=new THREE.Group();
  private actors=new THREE.Group();
  private batches=new Map<string,THREE.InstancedMesh>();
  private visuals=new Map<number,Figure>();
  private cores:THREE.Group[]=[];
  private relays:THREE.Group[]=[];
  private projectileVisuals:THREE.Mesh[]=[];
  private effects:Effect[]=[];
  private effectPool:THREE.Mesh[]=[];
  private showcase:Figure[]=[];
  private sun:THREE.DirectionalLight;
  private rim:THREE.DirectionalLight;
  private hemisphere:THREE.HemisphereLight;
  private matCache=new Map<string,THREE.MeshStandardMaterial>();
  private geometries={box:new THREE.BoxGeometry(1,1,1),sphere:new THREE.SphereGeometry(1,10,8),cylinder:new THREE.CylinderGeometry(1,1,1,8),cone:new THREE.CylinderGeometry(0,1,1,5),ring:new THREE.RingGeometry(.85,1,40),orb:new THREE.IcosahedronGeometry(1,1)};
  private raycaster=new THREE.Raycaster();
  private plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  private now=0;
  private selected:number|null=null;
  private targetX=0;
  private focusX=0;
  private zoom=1;
  private reduced=false;
  private quality:Settings['quality']='medium';
  private battle:Battle|null=null;
  private theme=-1;
  private wide=false;
  private follow=true;
  private rallyMarker=new THREE.Group();
  private seed=100;
  private selectionMaterial=new THREE.MeshBasicMaterial({color:CYAN,transparent:true,opacity:.8,depthWrite:false,side:THREE.DoubleSide});
  private shieldMaterial=new THREE.MeshStandardMaterial({color:CYAN,emissive:CYAN,emissiveIntensity:.6,transparent:true,opacity:.28,metalness:.4,roughness:.2,side:THREE.DoubleSide,depthWrite:false});
  private dummy=new THREE.Vector3();
  constructor(canvas:HTMLCanvasElement,settings:Settings){
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.2;
    this.camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,450);
    this.hemisphere=new THREE.HemisphereLight(0xbcdde8,0x252c31,2.3);this.scene.add(this.hemisphere);
    this.sun=new THREE.DirectionalLight(0xffddaf,3.3);this.sun.position.set(-24,40,10);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.camera.left=-55;this.sun.shadow.camera.right=55;this.sun.shadow.camera.top=30;this.sun.shadow.camera.bottom=-30;this.sun.shadow.camera.far=110;this.sun.shadow.bias=-.0008;this.sun.shadow.normalBias=.03;
    this.scene.add(this.sun,this.sun.target,this.environment,this.actors);this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.rim=new THREE.DirectionalLight(0xb1f4ed,1.7);this.rim.position.set(8,12,25);this.scene.add(this.rim);
    const rally=new THREE.Mesh(new THREE.RingGeometry(1.6,1.75,40),this.selectionMaterial);rally.rotation.x=-Math.PI/2;rally.position.y=.12;this.rallyMarker.add(rally);
    this.box(this.rallyMarker,CYAN,0,.65,0,.07,1.3,.07,CYAN);this.box(this.rallyMarker,CYAN,.4,1.2,0,.8,.3,.04,CYAN);this.scene.add(this.rallyMarker);this.rallyMarker.visible=false;
    this.settings(settings);this.resize();this.setTheme(0);this.menu();
  }
  settings(settings:Settings){this.quality=settings.quality;this.reduced=settings.reducedMotion;this.renderer.setPixelRatio(Math.min(devicePixelRatio,settings.quality==='high'?1.8:settings.quality==='medium'?1.25:1));this.renderer.shadowMap.enabled=settings.quality!=='low';this.renderer.shadowMap.autoUpdate=true;if(settings.quality==='low')this.renderer.setPixelRatio(.8);this.resize();}
  resize(){this.renderer.setSize(innerWidth,innerHeight);this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();}
  private random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
  private mat(color:number,glow=0,metal=.4,rough=.65){const key=`${color}/${glow}/${metal}/${rough}`;let m=this.matCache.get(key);if(!m){m=new THREE.MeshStandardMaterial({color:glow?0x0b1b23:color,emissive:glow||0,emissiveIntensity:glow?1.1:0,metalness:metal,roughness:rough});this.matCache.set(key,m);}return m;}
  private mesh(parent:THREE.Object3D,geometry:THREE.BufferGeometry,material:THREE.Material,x:number,y:number,z:number,sx=1,sy=1,sz=1){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  private box(parent:THREE.Object3D,color:number,x:number,y:number,z:number,sx:number,sy:number,sz:number,glow=0){return this.mesh(parent,this.geometries.box,this.mat(color,glow),x,y,z,sx,sy,sz);}
  private clearGroup(group:THREE.Group){
    const shared=new Set<THREE.BufferGeometry>(Object.values(this.geometries));
    group.traverse(o=>{if(o instanceof THREE.Mesh){if(!shared.has(o.geometry))o.geometry.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];for(const m of materials)if(![...this.matCache.values()].includes(m as THREE.MeshStandardMaterial)&&m!==this.selectionMaterial&&m!==this.shieldMaterial)m.dispose();}});group.clear();
  }
  private clearActors(){this.clearGroup(this.actors);for(const batch of this.batches.values()){this.scene.remove(batch);batch.dispose();}this.batches.clear();}
  private batchActors(){
    const counts=new Map<string,number>();this.actors.updateMatrixWorld(true);
    this.actors.traverseVisible(object=>{
      if(!(object instanceof THREE.Mesh)||Array.isArray(object.material))return;
      const key=object.geometry.uuid+'/'+object.material.uuid;let batch=this.batches.get(key);
      if(!batch){batch=new THREE.InstancedMesh(object.geometry,object.material,4096);batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);batch.castShadow=object.castShadow;batch.receiveShadow=object.receiveShadow;batch.frustumCulled=false;this.scene.add(batch);this.batches.set(key,batch);}
      const i=counts.get(key)??0;if(i<4096)batch.setMatrixAt(i,object.matrixWorld);counts.set(key,i+1);
    });
    for(const [key,batch] of this.batches){batch.count=Math.min(4096,counts.get(key)??0);batch.instanceMatrix.needsUpdate=true;}
  }
  setTheme(theme:number,wide=false){
    if(this.theme===theme&&this.wide===wide)return;this.wide=wide;this.theme=theme;this.seed=100+theme;this.clearGroup(this.environment);this.cores=[];this.relays=[];
    const t=THEMES[theme];this.scene.background=new THREE.Color(t.sky);this.scene.fog=new THREE.FogExp2(t.fog,.0105);this.sun.color.setHex(t.light);
    const floor=this.box(this.environment,t.ground,0,-.65,-5,wide?260:140,1,110);floor.castShadow=false;
    // A raised transit causeway and inlaid power lines give the battlefield a clear silhouette.
    this.box(this.environment,0x4c5356,0,-.12,0,wide?200:92,.3,wide?23:11);
    for(const z of (wide?[-11.7,11.7]:[-5.7,5.7])){this.box(this.environment,0x202a2e,0,-.15,z,wide?202:94,.5,.7);this.box(this.environment,0x54878a,0,.13,z,wide?196:88,.045,.045,CYAN);}
    for(let x=wide?-96:-43;x<=(wide?96:43);x+=4){this.box(this.environment,0x788183,x,.04,wide?10.4:4.4,1.2,.02,.12);this.box(this.environment,0x343d42,x,.01,0,.06,.01,wide?22:10);}
    if(wide)for(let x=-88;x<=88;x+=16){
      for(const z of [-12.6,12.6]){this.box(this.environment,0x35454d,x,.6,z,.7,1.2,.7);this.box(this.environment,0x637e85,x,1.25,z,.4,.08,.4,CYAN);}
      this.box(this.environment,0x596064,x,.045,0,2,.025,.07);
    }
    for(let i=0;i<48;i++){
      const x=(this.random()-.5)*(wide?300:175),z=-26-this.random()*45,h=4+this.random()*13;
      const rock=this.mesh(this.environment,this.geometries.cone,this.mat(i%2?0x4a5860:0x56636a),x,h*.43-2,z,9+this.random()*18,h,7+this.random()*9);rock.rotation.y=this.random()*5;rock.castShadow=false;
    }
    // Settlement modules: varied heights, bevel-like layered shoulders and lit service windows.
    for(let i=0;i<28;i++){
      const x=(i-14)*(wide?9:5)+this.random()*3,z=(wide?-20:-11)-this.random()*12,h=theme===4?4+this.random()*11:1.5+this.random()*5;
      if(Math.abs(x)<6&&theme===0)continue;
      this.box(this.environment,0x37444c,x,h/2,z,2+this.random()*3,h,2.5);
      this.box(this.environment,0x697278,x,h+.12,z,3,.3,3);
      if(i%3===0){this.box(this.environment,0x28333d,x,h+1.5,z,.15,3,.15);this.mesh(this.environment,this.geometries.sphere,this.mat(t.accent,t.accent),x,h+3,z,.13,.13,.13);}
      for(let j=1;j<h;j+=1.5)this.box(this.environment,t.accent,x,j,z+1.26,1.5,.09,.02,t.accent);
      if(i%5===0){const pipe=this.mesh(this.environment,this.geometries.cylinder,this.mat(0x647278),x+2,h*.4,z,1,h*.8,1);pipe.castShadow=true;}
    }
    // Layered distant megastructure: the Grid's signature broken orbital arc.
    const arcGeo=new THREE.TorusGeometry(17,.42,8,80,Math.PI*1.5);const arc=new THREE.Mesh(arcGeo,this.mat(0x667e88));arc.position.set(theme===4?0:20,10,-45);arc.rotation.z=.4;this.environment.add(arc);
    const arcGlow=new THREE.Mesh(new THREE.TorusGeometry(17,.07,5,80,Math.PI*1.35),this.mat(t.accent,t.accent));arcGlow.position.copy(arc.position);arcGlow.position.z+=.5;arcGlow.rotation.copy(arc.rotation);this.environment.add(arcGlow);
    this.mesh(this.environment,this.geometries.sphere,new THREE.MeshBasicMaterial({color:0xf6d5a3,fog:false}),-43,25,-80,4,4,4).castShadow=false;
    for(let i=0;i<36;i++){
      const x=(this.random()-.5)*(wide?220:110),z=this.random()>.5?(wide?15:8)+this.random()*9:-(wide?16:8)-this.random()*3;
      const rock=this.mesh(this.environment,this.geometries.orb,this.mat(0x596164),x,.25,z,.4+this.random()*1.5,.3+this.random()*.8,.4+this.random());rock.rotation.set(this.random(),this.random(),this.random());
    }
    for(const team of [0,1] as Team[])this.cores.push(this.core(team));
    for(const x of (wide?[CORE_X[0]+FIELD.oreOffset,CORE_X[1]-FIELD.oreOffset]:[-30,30])){
      const oreZ=wide?FIELD.oreZ:-2.7;
      this.box(this.environment,0x222c33,x,-.02,oreZ,4,.4,3);
      for(let i=0;i<6;i++){const shard=this.mesh(this.environment,this.geometries.orb,this.mat(0x90eef0,CYAN,.6,.3),x+(this.random()-.5)*2,1,oreZ+(this.random()-.5),.3+this.random()*.4,.7+this.random()*.8,.3);shard.rotation.z=(this.random()-.5)*.7;}
      this.box(this.environment,0x6f8084,x,2,oreZ-1.6,.15,4,.15);this.box(this.environment,0x9bcacc,x+1,3.6,oreZ-1.6,2,.15,.15,CYAN);
    }
  }
  private core(team:Team){
    const g=new THREE.Group(),color=team===0?CYAN:AMBER;g.position.x=this.wide?CORE_X[team]:team===0?-40:40;this.environment.add(g);
    this.box(g,0x253039,0,.35,0,6,.7,6);this.box(g,0x56656c,0,1,0,4.6,1,4.4);
    this.box(g,0x2b3945,0,1.8,0,3.1,1.6,3);this.box(g,0x778991,0,5.1,0,3.9,.35,3.8);
    for(const x of [-1.9,1.9])for(const z of [-1.9,1.9]){this.box(g,0x78858a,x,2.7,z,.48,4.9,.48);this.box(g,color,x,3,z+.26,.14,2,.04,color);}
    const orb=this.mesh(g,this.geometries.orb,this.mat(color,color,.2,.25),0,4,0,.9,1.3,.9);orb.name='energy';
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1.4,.1,8,28),this.mat(color,color));ring.position.y=4.2;ring.rotation.x=.4;g.add(ring);
    this.box(g,0x26333c,team===0?2.7:-2.7,2,1,.5,1.7,.8);
    this.box(g,color,0,1.2,2.3,2.5,.15,.05,color);
    if(this.wide){this.box(g,0x35474e,0,.04,FIELD.oreZ,4,.12,2);this.box(g,color,0,.12,FIELD.oreZ-1,3,.035,.08,color);}
    return g;
  }
  private figure(kind:UnitKind,team:Team):Figure{
    const root=new THREE.Group(),c=team===0?CYAN:AMBER,armor=this.battle?(team===0?0x2a404e:0x493b31):(team===0?0x526b78:0x6d635b),dark=0x222d36,light=0x9aadb3;
    const legs:THREE.Group[]=[],arms:THREE.Group[]=[],knees:THREE.Group[]=[];
    const selection=new THREE.Mesh(this.geometries.ring,this.selectionMaterial);selection.rotation.x=-Math.PI/2;selection.position.y=.09;selection.visible=false;root.add(selection);
    let visor:THREE.Mesh;let shield:THREE.Mesh|undefined;let gun:THREE.Group|undefined;let cargo:THREE.Mesh|undefined;
    if(kind==='wasp'||kind==='extractor'){
      this.mesh(root,this.geometries.orb,this.mat(armor),0,0,0,.75,.32,.52);
      this.box(root,dark,0,.08,.3,.75,.25,.35);
      visor=this.box(root,c,.45,0,.35,.38,.09,.1,c);
      for(const z of [-.65,.65]){
        this.box(root,light,0,0,z,1.6,.12,.22);
        const rotor=new THREE.Mesh(new THREE.TorusGeometry(.36,.05,6,16),this.mat(light));rotor.rotation.x=Math.PI/2;rotor.position.set(-.15,0,z);root.add(rotor);
        this.box(root,c,-.15,-.08,z,.3,.04,.15,c);
      }
      if(kind==='extractor'){
        const arm=new THREE.Group();arm.position.set(.3,-.1,0);root.add(arm);this.box(arm,light,.35,-.3,0,.15,.7,.15);this.box(arm,c,.5,-.6,0,.3,.15,.3,c);arms.push(arm);
        cargo=this.mesh(root,this.geometries.orb,this.mat(CYAN,CYAN),-.4,.4,0,.3,.3,.3);cargo.visible=false;
      }else{gun=new THREE.Group();root.add(gun);this.box(gun,dark,.6,-.22,0,1,.18,.18);this.box(gun,c,1.1,-.22,0,.16,.11,.11,c);}
    }else{
      const heavy=kind==='titan',broad=kind==='bulwark',height=heavy?1.45:1;
      this.mesh(root,this.geometries.sphere,this.mat(dark),0,1.1,0,.34,.21,.28);
      this.box(root,armor,0,1.63,0,broad?.85:.64,.8,.46);this.box(root,light,.05,1.94,.08,.58,.19,.5);
      this.box(root,dark,-.08,1.62,-.3,.42,.58,.25);
      this.box(root,c,.01,1.7,.25,.15,.25,.025,c);
      this.mesh(root,this.geometries.sphere,this.mat(armor),.02,2.29,0,.29,.31,.27);
      this.box(root,dark,.21,2.29,.05,.19,.18,.48);
      visor=this.box(root,c,.315,2.32,.02,.035,.075,.36,c);
      this.box(root,c,.03,2.32,.267,.38,.075,.025,c);
      this.box(root,c,0,1.85,.26,.5,.06,.025,c);
      this.box(root,c,0,1.85,-.26,.5,.06,.025,c);
      this.box(root,light,-.14,2.46,0,.32,.12,.4);
      for(const z of [-.23,.23]){
        const leg=new THREE.Group();leg.position.set(0,1.12,z);root.add(leg);legs.push(leg);
        this.box(leg,dark,0,-.22,0,.21,.5,.21);this.box(leg,armor,.04,-.48,0,.27,.21,.28);const knee=new THREE.Group();knee.position.y=-.48;leg.add(knee);knees.push(knee);this.box(knee,armor,0,-.24,0,.2,.48,.24);this.box(knee,light,.14,-.52,0,.46,.16,.3);
        const arm=new THREE.Group();arm.position.set(0,1.92,z*1.65);root.add(arm);arms.push(arm);
        this.mesh(arm,this.geometries.sphere,this.mat(armor),0,0,0,.22,.24,.24);
        this.box(arm,dark,.1,-.3,0,.18,.5,.18);this.box(arm,armor,.23,-.55,0,.22,.35,.24);this.box(arm,light,.25,-.73,0,.22,.15,.2);
      }
      if(kind==='vanguard'){
        gun=new THREE.Group();arms[1].add(gun);gun.position.set(.3,-.6,0);gun.rotation.z=-.5;
        this.box(gun,dark,.03,0,0,.14,.35,.16);this.box(gun,c,.03,.65,0,.09,1.1,.15,c);
      }else if(kind==='bulwark'){
        this.box(arms[1],light,.3,-.3,.1,.2,1.5,.85);
        shield=new THREE.Mesh(new THREE.PlaneGeometry(2.3,2.8),this.shieldMaterial);shield.position.set(.75,1.4,0);shield.rotation.y=Math.PI/2;root.add(shield);
        this.box(root,c,.8,2.6,0,.1,.1,1.6,c);
      }else{
        gun=new THREE.Group();root.add(gun);gun.position.set(.4,1.4,.45);
        this.box(gun,dark,.25,0,0,heavy?1.9:1.25,heavy?.32:.2,.27);
        this.box(gun,light,.1,.12,0,.5,.1,.32);
        this.box(gun,c,heavy?1.3:1,.01,0,.16,.1,.16,c);
        if(kind==='disruptor'){
          const coil=new THREE.Mesh(new THREE.TorusGeometry(.26,.07,6,16),this.mat(c,c));coil.rotation.y=Math.PI/2;coil.position.x=.9;gun.add(coil);
          this.box(root,c,-.2,1.9,-.4,.2,.3,.1,c);
        }
        arms.forEach(a=>a.rotation.z=.8);
      }
      if(heavy){root.scale.setScalar(height);this.box(root,armor,-.15,2,-.3,.9,.9,1);for(const z of [-.6,.6])this.box(root,light,-.08,1.98,z,.65,.5,.48);}
    }
    const bar=this.box(root,0x85edda,0,3.1,0,1,.07,.05,0x1a6656);bar.castShadow=false;
    const shieldBar=this.box(root,CYAN,0,2.98,0,1,.04,.04,CYAN);shieldBar.castShadow=false;
    return {root,legs,arms,knees,gait:0,stride:0,initialized:false,visor,shield,gun,bar,shieldBar,selection,cargo};
  }
  private mood(cinematic:boolean){
    const t=THEMES[this.theme];this.sun.intensity=cinematic?1.6:3.3;this.hemisphere.intensity=cinematic?1.1:2.3;this.rim.intensity=cinematic?2.4:1.7;
    this.scene.background=new THREE.Color(t.sky).multiplyScalar(cinematic?.36:1);this.scene.fog=new THREE.FogExp2(new THREE.Color(t.fog).multiplyScalar(cinematic?.42:1),cinematic?.009:.0105);
  }
  menu(theme=0){
    this.battle=null;this.rallyMarker.visible=false;this.clearActors();this.actors.visible=true;this.visuals.clear();this.clearEffects();this.showcase=[];this.setTheme(theme);this.mood(true);
    const figures:[UnitKind,number,number,number][]=[['vanguard',6,7,3.1],['lancer',10,3,2.2],['bulwark',2,-1,1.7],['wasp',15,-3,1.8]];
    for(const [kind,x,z,scale] of figures){const f=this.figure(kind,0);f.root.position.set(x,kind==='wasp'?7:0,z);f.root.scale.multiplyScalar(scale);f.root.rotation.y=-2;f.bar.visible=f.shieldBar.visible=false;this.actors.add(f.root);this.showcase.push(f);}
    this.focusX=this.targetX=0;this.zoom=1;
  }
  start(battle:Battle){this.battle=battle;this.clearActors();this.actors.visible=true;this.visuals.clear();this.showcase=[];this.clearEffects();this.setTheme(battle.mission?.theme??battle.options.theme??0,true);this.mood(false);this.focusX=this.targetX=CORE_X[0]+12;this.zoom=1;this.follow=true;
    for(const r of this.relays)this.environment.remove(r);this.relays=[];
    for(const r of battle.state.relays){
      const group=new THREE.Group();group.position.set(r.x,0,0);this.environment.add(group);this.relays.push(group);
      this.box(group,0x3b4e58,0,.2,0,3,.4,3);this.box(group,0x7d9299,0,1.6,0,.28,3,.28);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.8,.13,8,30),this.mat(0x9ca8ad));ring.position.y=3;ring.name='signal';group.add(ring);
      const flag=this.box(group,0xb6b4a6,0,2.7,.05,.3,1.7,.35);flag.name='flag';
      const base=this.box(group,0x344651,0,.7,0,3.8,1.4,3);base.name='base';base.visible=false;
      const circle=new THREE.Mesh(new THREE.RingGeometry(FIELD.relayRadius-.1,FIELD.relayRadius,48),new THREE.MeshBasicMaterial({color:0xabb5b2,transparent:true,opacity:.4,side:THREE.DoubleSide,depthWrite:false}));circle.rotation.x=-Math.PI/2;circle.position.y=.08;group.add(circle);
    }
  }
  private clearEffects(){for(const e of this.effects){this.scene.remove(e.mesh);this.effectPool.push(e.mesh);}this.effects=[];for(const p of this.projectileVisuals)p.visible=false;}
  select(id:number|null){this.selected=id;}
  pan(amount:number){this.follow=false;this.focus(this.targetX+amount);}
  zoomBy(amount:number){this.zoom=Math.max(.7,Math.min(4.4,this.zoom+amount));}
  overview(){this.follow=false;this.targetX=0;this.zoom=Math.min(4.4,(FIELD.halfLength+8)/Math.tan(THREE.MathUtils.degToRad(21))/this.camera.aspect/47);}
  focus(x:number){this.targetX=Math.max(-FIELD.halfLength+8,Math.min(FIELD.halfLength-8,x));}
  focusUnit(x:number){this.zoom=Math.min(this.zoom,1.15);this.follow=true;this.focus(x);}
  focusMap(x:number){this.follow=false;this.zoom=Math.min(this.zoom,1.15);this.focus(x);}
  cameraBounds(){
    const hit=(nx:number)=>{this.raycaster.setFromCamera(new THREE.Vector2(nx,0),this.camera);return this.raycaster.ray.intersectPlane(this.plane,this.dummy)?.x??this.focusX;};
    return {left:hit(-1),right:hit(1),focus:this.focusX};
  }
  pick(clientX:number,clientY:number):{unit:number|null;x:number;z:number}{
    this.raycaster.setFromCamera(new THREE.Vector2(clientX/innerWidth*2-1,1-clientY/innerHeight*2),this.camera);
    const hit=this.raycaster.ray.intersectPlane(this.plane,new THREE.Vector3());let best:number|null=null,score=22;
    if(this.battle)for(const u of this.battle.state.units){if(u.team!==0)continue;const pos=this.visuals.get(u.id)?.root.position;const v=new THREE.Vector3(pos?.x??u.x,ROSTER[u.kind].air?5:1.5,pos?.z??u.z).project(this.camera);const px=(v.x*.5+.5)*innerWidth,py=(-v.y*.5+.5)*innerHeight,d=Math.hypot(clientX-px,clientY-py);if(d<score){score=d;best=u.id;}}
    return {unit:best,x:hit?.x??0,z:hit?.z??0};
  }
  private effect(x:number,z:number,color:number,emp:boolean){
    if(this.effects.length>70)return;
    let mesh=this.effectPool.pop();if(!mesh)mesh=new THREE.Mesh(this.geometries.sphere,new THREE.MeshBasicMaterial({transparent:true,opacity:.8,depthWrite:false}));
    (mesh.material as THREE.MeshBasicMaterial).color.setHex(color);mesh.position.set(x,emp?.25:1,z);mesh.scale.setScalar(.3);mesh.visible=true;this.scene.add(mesh);this.effects.push({mesh,life:emp?.65:.25,max:emp?.65:.25,emp});
  }
  update(dt:number,storyProgress?:number,alpha=1){
    if(!this.battle?.state.paused)this.now+=dt;
    if(this.battle){
      const s=this.battle.state;
      if(this.follow&&s.controlled!==null){const u=s.units.find(u=>u.id===s.controlled);if(u)this.focus(u.x);}
      this.focusX=THREE.MathUtils.damp(this.focusX,this.targetX,5,dt);
      const distance=47*this.zoom;this.camera.position.set(this.focusX,distance*.58,distance*.83);this.camera.lookAt(this.focusX,0,-1.5);
      // Keep the strategic overview legible as the camera pulls away from the field.
      if(this.scene.fog instanceof THREE.FogExp2)this.scene.fog.density=.0105/Math.max(1,this.zoom);
      this.sun.position.x=this.focusX-24;this.sun.target.position.x=this.focusX;this.sun.target.updateMatrixWorld();
      const a=s.armies[0];this.rallyMarker.visible=a.order==='defend';this.rallyMarker.position.set(a.rally,0,a.rallyZ);
      const alive=new Set<number>();
      for(const u of s.units){
        alive.add(u.id);let f=this.visuals.get(u.id);if(!f){f=this.figure(u.kind,u.team);this.actors.add(f.root);this.visuals.set(u.id,f);}
        const d=ROSTER[u.kind],blend=s.paused?1:alpha;
        const x=THREE.MathUtils.lerp(u.previousX,u.x,blend),z=THREE.MathUtils.lerp(u.previousZ,u.z,blend);
        const travel=f.initialized?Math.hypot(x-f.root.position.x,z-f.root.position.z):0;
        const heading=u.facing===1?0:Math.PI;
        if(!f.initialized){f.root.rotation.y=heading;f.gait=u.phase;f.initialized=true;}
        if(!s.paused){
          f.gait+=Math.min(travel,1)*2.2;
          f.stride=THREE.MathUtils.damp(f.stride,u.moving?1:0,12,dt);
          const turn=THREE.MathUtils.euclideanModulo(heading-f.root.rotation.y+Math.PI,Math.PI*2)-Math.PI;
          f.root.rotation.y+=turn*(1-Math.exp(-18*dt));
          const swing=Math.sin(f.gait)*.52*f.stride;
          f.legs.forEach((leg,i)=>leg.rotation.z=swing*(i===0?1:-1));
          f.knees.forEach((knee,i)=>knee.rotation.z=-Math.max(0,Math.sin(f.gait+(i?Math.PI:0)))*.65*f.stride);
          const attackAge=d.rate-u.cooldown;
          const strike=u.cooldown>0&&attackAge<.38?Math.sin(attackAge/.38*Math.PI):0;
          if(u.kind==='vanguard')f.arms.forEach((arm,i)=>arm.rotation.z=(i===1?-strike*1.65:0)-swing*(i?1:-1)*.7-(u.windup>0?.7:0));
          else if(u.kind==='bulwark')f.arms[0].rotation.z=-strike*.9-swing*.3;
          else if(u.kind==='extractor')f.arms[0].rotation.z=u.mining>0?Math.sin(this.now*14)*.15:0;
          else f.arms.forEach(arm=>arm.rotation.z=.8+swing*.08);
          if(f.gun&&u.kind!=='vanguard'){
            const recoil=u.cooldown>0?Math.max(0,1-attackAge/.18):0;
            f.gun.position.x=(u.kind==='wasp'?0:.4)-recoil*(u.kind==='titan'?.24:.12);
            f.gun.rotation.z=recoil*.06;
          }
        }
        const hover=d.air?5:u.kind==='extractor'?.9:.06;
        f.root.position.set(x,hover+(this.reduced?0:d.air||u.kind==='extractor'?Math.sin(this.now*3+u.id)*.1:Math.abs(Math.sin(f.gait))*.035*f.stride),z);
        f.root.rotation.z=u.dash>0?-.16*u.facing:u.hitTime>0?Math.sin(u.hitTime*30)*.025:0;
        if(f.shield){f.shield.visible=u.emp<=0&&u.shield>0;f.shield.scale.setScalar(.85+.15*u.shield/this.battle.maxShield(u));}
        f.bar.scale.x=Math.max(.01,u.hp/d.hp);f.bar.visible=u.hp<d.hp||this.selected===u.id||s.controlled===u.id;
        f.shieldBar.scale.x=Math.max(.01,u.shield/Math.max(1,this.battle.maxShield(u)));f.shieldBar.visible=d.shield>0&&f.bar.visible&&u.emp<=0;
        f.selection.visible=this.selected===u.id||s.controlled===u.id;if(f.cargo)f.cargo.visible=u.cargo>0;
        f.visor.material=this.mat(u.emp>0?0x71817f:u.team===0?CYAN:AMBER,u.emp>0?0:u.team===0?CYAN:AMBER);
      }
      for(const [id,f] of this.visuals)if(!alive.has(id)){this.actors.remove(f.root);if(f.shield)f.shield.geometry.dispose();this.visuals.delete(id);}
      s.projectiles.forEach((p,i)=>{
        let mesh=this.projectileVisuals[i];if(!mesh){mesh=new THREE.Mesh(this.geometries.sphere,this.mat(CYAN,CYAN));this.scene.add(mesh);this.projectileVisuals.push(mesh);}
        mesh.visible=true;mesh.position.set(p.x,p.y,p.z);mesh.scale.set(p.kind==='titan'?.32:.18,.1,.1);mesh.material=this.mat(p.team===0?CYAN:AMBER,p.team===0?CYAN:AMBER);
      });for(let i=s.projectiles.length;i<this.projectileVisuals.length;i++)this.projectileVisuals[i].visible=false;
      this.relays.forEach((g,i)=>{const r=s.relays[i];const c=r.owner===0?CYAN:r.owner===1?AMBER:0xb6b4a6;(g.getObjectByName('flag') as THREE.Mesh).material=this.mat(c,r.owner===null?0:c);(g.getObjectByName('signal') as THREE.Mesh).material=this.mat(c,r.owner===null?0:c);g.getObjectByName('base')!.visible=r.baseHp>0;});
      this.cores.forEach((g,i)=>{const e=g.getObjectByName('energy')!;e.rotation.y=this.now*.4;e.scale.setScalar(.7+Math.max(0,s.armies[i].core)/2400*.3);});
    }else{
      const sway=this.reduced?0:Math.sin(this.now*.08)*1.5;
      this.camera.position.set(-5+sway,7.5,25);this.camera.lookAt(3,3,0);
      if(storyProgress!==undefined&&!this.reduced){this.camera.position.set(-30+storyProgress*38,9+Math.sin(storyProgress*5)*3,24);this.camera.lookAt(-12+storyProgress*20,2,-4);}
      this.showcase.forEach((f,i)=>{if(i===3)f.root.position.y=7+Math.sin(this.now*1.6)*.18;if(f.gun)f.gun.rotation.z=Math.sin(this.now*.7)*.025;});
    }
    this.effects=this.effects.filter(e=>{e.life-=this.battle?.state.paused?0:dt;if(e.life<=0){this.scene.remove(e.mesh);this.effectPool.push(e.mesh);return false;}const t=1-e.life/e.max;const scale=e.emp?1+t*11:.1+t*.7;e.mesh.scale.set(scale,e.emp?.04:scale,scale);(e.mesh.material as THREE.MeshBasicMaterial).opacity=(1-t)*.6;return true;});
    if(this.battle){this.actors.visible=true;this.batchActors();this.actors.visible=false;}
    this.renderer.render(this.scene,this.camera);
  }
  showEvents(events:ReturnType<Battle['takeEvents']>){for(const e of events){if(e.type==='emp')this.effect(e.x,e.z,CYAN,true);else if(e.type==='death')this.effect(e.x,e.z,e.team===0?CYAN:AMBER,false);else if(e.type==='hit'&&this.quality!=='low')this.effect(e.x,e.z,e.team===0?CYAN:AMBER,false);else if(e.type==='ability')this.effect(e.x,e.z,e.team===0?CYAN:AMBER,e.kind==='titan');}}
  stats(){return {drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures};}
}
