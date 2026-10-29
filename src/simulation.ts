import { FIELD, KINDS, MISSIONS, RESEARCH, ROSTER, type Difficulty, type MissionDefinition, type Order, type Research, type Team, type UnitKind } from './data';
export interface Unit { id:number; kind:UnitKind; team:Team; x:number; z:number; hp:number; shield:number; facing:number; cooldown:number; abilityCooldown:number; emp:number; boost:number; cargo:number; mining:number; phase:number; moving:boolean; previousX:number; previousZ:number; dash:number; windup:number; dashX:number; dashZ:number; hitTime:number; }
export interface Relay { x:number; owner:Team|null; capturing:Team|null; progress:number; baseHp:number; }
export interface Projectile { id:number; team:Team; kind:UnitKind|'core'; x:number; y:number; z:number; target:number; targetTeam:Team; damage:number; speed:number; splash:boolean; }
export interface BattleEvent {type:'shot'|'hit'|'emp'|'death'|'capture'|'spawn'|'delivery'|'ability'; x:number; z:number; team:Team; kind?:UnitKind|'core';}
export interface Army {money:number; core:number; order:Order; rally:number; rallyZ:number; queue:{kind:UnitKind;remaining:number}[]; research:Record<Research,boolean>; spawn:number|null;}
export interface MatchOptions {mission?:number;theme?:number;difficulty:Difficulty;seed?:number;}
export interface ControlInput {x:number;z:number;fire:boolean;}
export interface MatchState {time:number;units:Unit[];relays:Relay[];armies:[Army,Army];projectiles:Projectile[];winner:Team|null;paused:boolean;controlled:number|null;}
const other=(team:Team):Team=>team===0?1:0;
export const CORE_X=FIELD.coreX;
const clamp=(n:number,limit:number)=>Math.max(-limit,Math.min(limit,n));
const dist=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);
const emptyResearch=():Record<Research,boolean>=>({extraction:false,weapons:false,shields:false});
export class Battle {
  state:MatchState;
  options:MatchOptions;
  mission:MissionDefinition|null;
  available:UnitKind[];
  events:BattleEvent[]=[];
  input:ControlInput={x:0,z:0,fire:false};
  private serial=0;
  private randomSeed:number;
  private aiTime=0;
  private coreTimers=[0,0];

  private everCaptured=new Set<number>();
  private builtForward=false;
  message='';
  constructor(options:MatchOptions){
    this.options=options;this.randomSeed=options.seed??78123;
    this.mission=options.mission===undefined?null:MISSIONS[options.mission];
    this.available=this.mission?.unlocked??KINDS;
    const army=(team:Team):Army=>({money:560,core:2400,order:'defend',rally:CORE_X[team]+(team===0?9:-9),rallyZ:0,queue:[],research:emptyResearch(),spawn:null});
    this.state={time:0,units:[],relays:(this.mission?.relays??[-30,30]).map(x=>({x,owner:null,capturing:null,progress:0,baseHp:0})),armies:[army(0),army(1)],projectiles:[],winner:null,paused:false,controlled:null};
    for(const team of [0,1] as Team[]){this.spawn('extractor',team);this.spawn('extractor',team);this.spawn('vanguard',team);this.spawn('lancer',team);}
    if(this.mission&&this.mission.id>=1){this.spawn('bulwark',1,CORE_X[1]-15,-2);this.spawn('bulwark',1,CORE_X[1]-15,2);}
    if(this.mission&&this.mission.id>=2)this.spawn('wasp',1,CORE_X[1]-12,1);
    if(this.mission&&this.mission.id>=3)this.spawn('titan',1,CORE_X[1]-9,-1);
    this.events=[];
  }
  random(){this.randomSeed=(Math.imul(this.randomSeed,1664525)+1013904223)>>>0;return this.randomSeed/4294967296;}
  emit(event:BattleEvent){if(this.events.length<200)this.events.push(event);}
  takeEvents(){return this.events.splice(0);}
  get count(){return this.state.units.filter(u=>u.team===0).length;}
  capacity(team:Team){return this.state.units.filter(u=>u.team===team).length+this.state.armies[team].queue.length;}
  spawn(kind:UnitKind,team:Team,x?:number,z?:number){
    const a=this.state.armies[team];const relay=a.spawn===null?undefined:this.state.relays[a.spawn];
    const origin=kind!=='extractor'&&relay?.owner===team&&relay.baseHp>0?relay.x:CORE_X[team];
    const u:Unit={id:++this.serial,kind,team,x:x??origin+(team===0?2:-2),z:z??(this.random()-.5)*6,hp:ROSTER[kind].hp,shield:ROSTER[kind].shield*(a.research.shields?1.5:1),facing:team===0?1:-1,cooldown:0,abilityCooldown:0,emp:0,boost:0,cargo:0,mining:0,phase:this.random()*6.28,moving:false,previousX:0,previousZ:0,dash:0,windup:0,dashX:team===0?1:-1,dashZ:0,hitTime:0};
    u.previousX=u.x;u.previousZ=u.z;
    this.state.units.push(u);this.emit({type:'spawn',x:u.x,z:u.z,team,kind});return u;
  }
  recruit(kind:UnitKind,team:Team=0){
    const a=this.state.armies[team];const d=ROSTER[kind];
    if(this.state.winner!==null||this.state.paused)return false;
    if(!this.available.includes(kind)){this.message='This unit is not unlocked for this mission.';return false;}
    if(this.capacity(team)>=40){this.message='Army capacity reached: 40 units including production.';return false;}
    if(a.queue.length>=8){this.message='Production queue is full.';return false;}
    if(a.money<d.cost){this.message='Insufficient Helion. Protect your extractors.';return false;}
    a.money-=d.cost;a.queue.push({kind,remaining:d.train});return true;
  }
  cancelProduction(index:number,team:Team=0){
    if(this.state.paused||this.state.winner!==null)return false;
    const q=this.state.armies[team].queue;if(!q[index])return false;
    this.state.armies[team].money+=ROSTER[q[index].kind].cost*.8;q.splice(index,1);return true;
  }
  research(key:Research,team:Team=0){
    const a=this.state.armies[team];if(this.state.paused||this.state.winner!==null||a.research[key]||a.money<RESEARCH[key].cost||this.mission?.research===false)return false;
    a.money-=RESEARCH[key].cost;a.research[key]=true;
    if(key==='shields')for(const u of this.state.units)if(u.team===team)u.shield=Math.min(this.maxShield(u),u.shield+ROSTER[u.kind].shield*.5);
    return true;
  }
  maxShield(u:Unit){return ROSTER[u.kind].shield*(this.state.armies[u.team].research.shields?1.5:1);}
  setOrder(order:Order,team:Team=0){if(this.state.paused||this.state.winner!==null)return;this.state.armies[team].order=order;}
  setRally(x:number,z=0){if(this.state.paused||this.state.winner!==null)return;const a=this.state.armies[0];a.rally=clamp(x,FIELD.halfLength-4);a.rallyZ=clamp(z,FIELD.halfDepth-2);a.order='defend';}
  control(id:number|null){if(id===null){this.state.controlled=null;this.input={x:0,z:0,fire:false};return true;}const u=this.state.units.find(u=>u.id===id&&u.team===0&&u.hp>0);if(!u||this.state.paused||this.state.winner!==null)return false;this.state.controlled=id;this.input={x:0,z:0,fire:false};return true;}
  buildBase(index:number,team:Team=0){
    const r=this.state.relays[index],a=this.state.armies[team];if(this.state.paused||this.state.winner!==null||this.mission?.forward===false||!r||r.owner!==team||r.baseHp>0||a.money<350)return false;
    a.money-=350;r.baseHp=650;a.spawn=index;if(team===0)this.builtForward=true;return true;
  }
  setSpawn(index:number|null,team:Team=0){
    if(this.state.paused||this.state.winner!==null)return false;
    if(index!==null){const r=this.state.relays[index];if(!r||r.owner!==team||r.baseHp<=0)return false;}
    this.state.armies[team].spawn=index;return true;
  }
  ability(id:number){
    const u=this.state.units.find(u=>u.id===id&&u.hp>0);if(!u||u.abilityCooldown>0||this.state.paused||this.state.winner!==null)return false;
    if(u.kind==='bulwark'&&u.emp>0){this.message='Shield systems disrupted. Wait for EMP recovery.';return false;}
    u.abilityCooldown=u.kind==='disruptor'?12:10;
    if(u.kind==='disruptor'){
      for(const e of this.state.units)if(e.team!==u.team&&dist(u,e)<12)e.emp=6;
      this.emit({type:'emp',x:u.x,z:u.z,team:u.team,kind:u.kind});
    }else if(u.kind==='bulwark')u.shield=Math.min(this.maxShield(u),u.shield+100);
    else if(u.kind==='vanguard'){
      const target=this.state.units.filter(e=>e.team!==u.team&&e.hp>0&&!ROSTER[e.kind].air&&dist(u,e)<8).sort((a,b)=>dist(u,a)-dist(u,b))[0];
      const length=target?dist(u,target):1;
      u.dashX=target?(target.x-u.x)/Math.max(.01,length):u.facing;
      u.dashZ=target?(target.z-u.z)/Math.max(.01,length):0;
      u.dash=4;u.windup=.16;
    }else if(u.kind==='titan'){
      for(const e of this.state.units)if(e.team!==u.team&&!ROSTER[e.kind].air&&dist(u,e)<7)this.damage(e,65,u.x,true);
      this.emit({type:'ability',x:u.x,z:u.z,team:u.team,kind:u.kind});
    }else u.boost=u.kind==='extractor'?5:4;
    return true;
  }
  damage(u:Unit,amount:number,sourceX:number,melee=false){
    if(u.hp<=0)return;
    // A shield faces in x; melee strikes are already inside the shield envelope.
    if(!melee&&u.emp<=0&&u.shield>0&&(sourceX-u.x)*u.facing>0){const absorbed=Math.min(u.shield,amount);u.shield-=absorbed;amount-=absorbed;}
    u.hp-=amount;u.hitTime=.18;
    this.emit({type:'hit',x:u.x,z:u.z,team:u.team,kind:u.kind});
  }
  private move(u:Unit,x:number,z:number,dt:number,mult=1){
    const length=Math.hypot(x,z);if(length<.12)return;
    const step=Math.min(length,ROSTER[u.kind].speed*dt*mult*(u.boost>0&&(u.kind==='wasp'||u.kind==='extractor')?1.65:1));
    u.x=clamp(u.x+x/length*step,FIELD.halfLength);u.z=clamp(u.z+z/length*step,FIELD.halfDepth);if(Math.abs(x)>.2&&Math.abs(x)>Math.abs(z)*.35)u.facing=Math.sign(x);u.moving=true;
  }
  private advanceDash(u:Unit,dt:number){
    if(u.windup>0){u.windup=Math.max(0,u.windup-dt);return;}
    let step=Math.min(u.dash,14*dt);let hit:Unit|undefined;
    for(const e of this.state.units){
      if(e.team===u.team||e.hp<=0||ROSTER[e.kind].air)continue;
      const dx=e.x-u.x,dz=e.z-u.z,along=dx*u.dashX+dz*u.dashZ;
      const across=Math.abs(dx*u.dashZ-dz*u.dashX);
      if(along>=0&&across<1.3&&along<=step+1.3){const contact=Math.max(0,along-Math.sqrt(1.3*1.3-across*across));if(contact<=step){step=contact;hit=e;}}
    }
    u.x=clamp(u.x+u.dashX*step,FIELD.halfLength);u.z=clamp(u.z+u.dashZ*step,FIELD.halfDepth);
    if(Math.abs(u.dashX)>.05)u.facing=Math.sign(u.dashX);u.moving=step>0;u.dash=Math.max(0,u.dash-step);
    if(hit){this.damage(hit,35,u.x,true);u.dash=0;this.emit({type:'ability',x:u.x,z:u.z,team:u.team,kind:u.kind});}
    if(Math.abs(u.x)>=FIELD.halfLength||Math.abs(u.z)>=FIELD.halfDepth)u.dash=0;
  }
  private mine(u:Unit,dt:number,manual:boolean){
    const base=CORE_X[u.team],ore=base+(u.team===0?FIELD.oreOffset:-FIELD.oreOffset),desired=u.cargo>0?base:ore;
    if(!manual)this.move(u,desired-u.x,FIELD.oreZ+(u.id%3-1)*.65-u.z,dt);
    if(dist(u,{x:base,z:FIELD.oreZ})<3&&u.cargo>0){this.state.armies[u.team].money+=u.cargo;u.cargo=0;this.emit({type:'delivery',x:u.x,z:u.z,team:u.team,kind:u.kind});}
    else if(dist(u,{x:ore,z:FIELD.oreZ})<2.2&&u.cargo===0&&(!manual||this.input.fire)){
      u.mining+=dt*(u.boost>0?2:1);if(u.mining>=2.5){u.mining=0;u.cargo=this.state.armies[u.team].research.extraction?45:30;}
    }
  }
  private target(u:Unit){
    const d=ROSTER[u.kind];let best:Unit|undefined;let score=Infinity;
    for(const e of this.state.units){if(e.team===u.team||e.hp<=0||(!d.antiAir&&ROSTER[e.kind].air))continue;
      let distance=dist(u,e);if(distance>d.range+12)continue;
      // A reachable enemy takes priority over a preferred but out-of-range target.
      if(distance<=d.range)distance-=100;
      if(u.kind==='lancer'&&ROSTER[e.kind].air)distance-=5;
      if(distance<score){score=distance;best=e;}}
    return best;
  }
  private shoot(u:Unit,target:Unit|undefined,coreTeam?:Team){
    const d=ROSTER[u.kind];if(u.cooldown>0)return;
    u.cooldown=d.rate;const damage=d.damage*(this.state.armies[u.team].research.weapons?1.25:1)*(u.boost>0?2:1);
    const tx=target?.x??CORE_X[coreTeam!];u.facing=Math.sign(tx-u.x)||u.facing;
    if(d.melee&&target)this.damage(target,damage,u.x,true);
    else if(d.melee)this.state.armies[coreTeam!].core-=damage;
    else this.state.projectiles.push({id:++this.serial,team:u.team,kind:u.kind,x:u.x,y:d.air?5:1.5,z:u.z,target:target?.id??-1,targetTeam:target?.team??coreTeam!,damage,speed:u.kind==='titan'?27:42,splash:u.kind==='titan'});
    this.emit({type:'shot',x:u.x,z:u.z,team:u.team,kind:u.kind});
  }
  private updateAI(dt:number){
    this.aiTime-=dt;if(this.aiTime>0)return;
    const difficulty=this.options.difficulty;this.aiTime=difficulty==='hard'?1.2:difficulty==='normal'?2.5:4;
    const a=this.state.armies[1],units=this.state.units.filter(u=>u.team===1),workers=units.filter(u=>u.kind==='extractor').length+a.queue.filter(q=>q.kind==='extractor').length;
    if(workers<(difficulty==='hard'?9:difficulty==='normal'?6:4))this.recruit('extractor',1);
    else{
      const enemies=this.state.units.filter(u=>u.team===0),air=enemies.filter(u=>ROSTER[u.kind].air).length,shield=enemies.filter(u=>u.shield>0).length;
      let choices:UnitKind[]=this.available.filter(k=>k!=='extractor');
      if(difficulty==='hard'&&air>1)choices=['lancer','lancer','wasp'].filter(k=>this.available.includes(k as UnitKind)) as UnitKind[];
      else if(difficulty!=='easy'&&shield>2&&this.available.includes('disruptor'))choices=['disruptor','vanguard','lancer'];
      const pick=choices[Math.floor(this.random()*choices.length)];
      if(a.money>=ROSTER[pick].cost)this.recruit(pick,1);
      else if(a.money>150&&a.queue.length===0)this.recruit('lancer',1);
      if(difficulty!=='easy'&&units.length>9){for(const key of ['weapons','shields','extraction'] as Research[])if(!a.research[key]&&a.money>RESEARCH[key].cost+150){this.research(key,1);break;}}
    }
    const troops=units.filter(u=>u.kind!=='extractor').length;
    const threshold=difficulty==='hard'?4:difficulty==='normal'?6:8;
    if(troops>=threshold||this.state.time>(difficulty==='easy'?100:65))a.order='attack';
    if(troops<2&&a.core>500){a.order='defend';a.rally=CORE_X[1]-14;a.rallyZ=0;}
    if(difficulty==='hard')for(let i=0;i<this.state.relays.length;i++){const r=this.state.relays[i];if(r.owner===1&&r.baseHp===0&&a.money>750)this.buildBase(i,1);}
  }
  objectivesSatisfied(){
    if(!this.mission)return true;
    if(this.mission.id===2)return this.everCaptured.has(0);
    if(this.mission.id===3)return this.builtForward;
    if(this.mission.id===4)return this.state.relays.every(r=>r.owner===0);
    return true;
  }
  objectiveStatus(){
    if(this.mission?.id===2)return `${this.everCaptured.has(0)?'✓':'○'} Capture the uplink relay`;
    if(this.mission?.id===3)return `${this.builtForward?'✓':'○'} Establish a forward base`;
    if(this.mission?.id===4)return `${this.state.relays.filter(r=>r.owner===0).length}/2 control relays secured`;
    return 'Keep your extraction line protected';
  }
  tick(dt:number){
    const s=this.state;if(s.paused||s.winner!==null)return;s.time+=dt;for(const u of s.units){u.previousX=u.x;u.previousZ=u.z;}this.updateAI(dt);
    for(const team of [0,1] as Team[]){const a=s.armies[team];
      if(a.queue[0]){a.queue[0].remaining-=dt;if(a.queue[0].remaining<=0)this.spawn(a.queue.shift()!.kind,team);}
      this.coreTimers[team]-=dt;
      if(this.coreTimers[team]<=0){const near=s.units.find(u=>u.team!==team&&u.hp>0&&dist(u,{x:CORE_X[team],z:0})<11);if(near){this.coreTimers[team]=1.4;s.projectiles.push({id:++this.serial,team,kind:'core',x:CORE_X[team],y:5,z:0,target:near.id,targetTeam:near.team,damage:16,speed:38,splash:false});}}
    }
    for(const u of s.units){
      if(u.hp<=0)continue;u.moving=false;u.hitTime=Math.max(0,u.hitTime-dt);u.cooldown=Math.max(0,u.cooldown-dt);u.abilityCooldown=Math.max(0,u.abilityCooldown-dt);u.emp=Math.max(0,u.emp-dt);u.boost=Math.max(0,u.boost-dt);
      if(u.emp<=0&&u.cooldown===0)u.shield=Math.min(this.maxShield(u),u.shield+dt*(s.armies[u.team].research.shields?14:9));
      const manual=s.controlled===u.id;
      if(u.dash>0){this.advanceDash(u,dt);continue;}
      if(manual)this.move(u,this.input.x,this.input.z,dt);
      if(u.kind==='extractor'){this.mine(u,dt,manual);continue;}
      const a=s.armies[u.team],enemy=other(u.team),d=ROSTER[u.kind];const target=this.target(u);
      const range=target?dist(u,target):Infinity;
      const allowed=a.order!=='retreat'&&(a.order==='attack'||(target&&(range<=d.range+6||dist(target,{x:a.rally,z:a.rallyZ})<13)));
      if(target&&range<=d.range&&(manual?this.input.fire:allowed))this.shoot(u,target);
      else if(dist(u,{x:CORE_X[enemy],z:0})<=d.range+2&&(manual?this.input.fire:a.order==='attack'))this.shoot(u,undefined,enemy);
      else if(!manual){
        const base=s.relays.find(r=>r.owner===enemy&&r.baseHp>0&&dist(u,{x:r.x,z:0})<d.range+1);
        if(base&&a.order==='attack'&&u.cooldown<=0){u.cooldown=d.rate;base.baseHp=Math.max(0,base.baseHp-d.damage*(a.research.weapons?1.25:1)*(u.boost>0?2:1));this.emit({type:'shot',x:u.x,z:u.z,team:u.team,kind:u.kind});}
        else{const goal=a.order==='retreat'?CORE_X[u.team]:a.order==='attack'?CORE_X[enemy]:a.rally;
          if(target&&allowed&&range>d.range*.85)this.move(u,target.x-u.x,target.z-u.z,dt);
          else {const lane=a.order==='defend'?a.rallyZ+Math.sin(u.id*2)*1.8:a.order==='retreat'?Math.sin(u.id*2)*4:Math.sin(u.id*2)*6*Math.min(1,Math.abs(goal-u.x)/20);
            if(Math.abs(goal-u.x)>1.4||Math.abs(lane-u.z)>.4)this.move(u,goal-u.x,lane-u.z,dt);}
        }
      }
      // Manual fire can destroy an opposing forward base when no soldier/core is in range.
      if(manual&&this.input.fire&&u.cooldown<=0){const base=s.relays.find(r=>r.owner===enemy&&r.baseHp>0&&dist(u,{x:r.x,z:0})<d.range+1);if(base){u.cooldown=d.rate;base.baseHp=Math.max(0,base.baseHp-d.damage*(a.research.weapons?1.25:1)*(u.boost>0?2:1));this.emit({type:'shot',x:u.x,z:u.z,team:u.team,kind:u.kind});}}
      if(!manual&&target&&allowed&&range<(u.kind==='vanguard'?7:10)&&(u.kind!=='vanguard'||range>d.range)&&u.abilityCooldown===0)this.ability(u.id);
    }
    // Soft separation preserves formations without a heavyweight physics world.
    for(let i=0;i<s.units.length;i++)for(let j=i+1;j<s.units.length;j++){
      const a=s.units[i],b=s.units[j];if(a.hp<=0||b.hp<=0||ROSTER[a.kind].air!==ROSTER[b.kind].air)continue;const distance=dist(a,b),min=a.kind==='titan'||b.kind==='titan'?1.6:.8;
      if(distance<min){const push=(min-distance)*dt*2;const dx=(a.x-b.x)/(distance||1),dz=distance>.01?(a.z-b.z)/distance:(a.id%2?1:-1);a.x+=dx*push;b.x-=dx*push;a.z=clamp(a.z+dz*push,FIELD.halfDepth);b.z=clamp(b.z-dz*push,FIELD.halfDepth);}
    }
    for(const u of s.units){u.x=clamp(u.x,FIELD.halfLength);u.z=clamp(u.z,FIELD.halfDepth);u.phase+=dist(u,{x:u.previousX,z:u.previousZ})*2.2;}
    s.projectiles=s.projectiles.filter(p=>{
      const target=s.units.find(u=>u.id===p.target&&u.hp>0);
      if(p.target!==-1&&!target)return false;
      const tx=target?.x??CORE_X[p.targetTeam],ty=target?(ROSTER[target.kind].air?5:1.4):3,tz=target?.z??0;
      const length=Math.hypot(tx-p.x,ty-p.y,tz-p.z),step=p.speed*dt;
      if(length<=step+.4){
        if(target){this.damage(target,p.damage,p.x);if(p.splash)for(const e of s.units)if(e.id!==target.id&&e.team!==p.team&&!ROSTER[e.kind].air&&dist(e,target)<3)this.damage(e,p.damage*.5,p.x);}
        else s.armies[p.targetTeam].core-=p.damage;
        return false;
      }
      p.x+=(tx-p.x)/length*step;p.y+=(ty-p.y)/length*step;p.z+=(tz-p.z)/length*step;return true;
    });
    for(const r of s.relays){
      if(r.baseHp===0)for(const a of s.armies)if(a.spawn!==null&&s.relays[a.spawn]===r)a.spawn=null;
      const present=([0,1] as Team[]).filter(team=>s.units.some(u=>u.team===team&&u.kind!=='extractor'&&!ROSTER[u.kind].air&&u.hp>0&&dist(u,{x:r.x,z:0})<FIELD.relayRadius));
      if(present.length===1&&r.owner!==present[0]&&r.baseHp<=0){const team=present[0];if(r.capturing!==team){r.capturing=team;r.progress=0;}r.progress+=dt/6;
        if(r.progress>=1){r.owner=team;r.progress=0;r.capturing=null;this.emit({type:'capture',x:r.x,z:0,team});if(team===0)this.everCaptured.add(s.relays.indexOf(r));}}
      else if(present.length===0){r.progress=Math.max(0,r.progress-dt*.15);if(r.progress===0)r.capturing=null;}
      if(r.owner!==null)s.armies[r.owner].money+=dt*3;
    }
    for(const u of s.units)if(u.hp<=0)this.emit({type:'death',x:u.x,z:u.z,team:u.team,kind:u.kind});
    s.units=s.units.filter(u=>u.hp>0);if(s.controlled!==null&&!s.units.some(u=>u.id===s.controlled))s.controlled=null;
    if(s.armies[0].core<=0)s.winner=1;
    else if(s.armies[1].core<=0){if(this.objectivesSatisfied()){s.winner=0;}else {s.armies[1].core=1;if(!this.message)this.message='Command core disabled. Complete the remaining relay objective to secure victory.';}}
    // Once the core is disabled, completing the objective ends the match immediately.
    if(s.winner===null&&s.armies[1].core<=1&&this.objectivesSatisfied()){s.winner=0;}
    s.armies[0].core=Math.max(0,s.armies[0].core);s.armies[1].core=Math.max(0,s.armies[1].core);
  }
}
