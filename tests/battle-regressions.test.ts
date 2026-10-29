import {describe,it,expect} from 'vitest';
import {Battle} from '../src/simulation';
import {FIELD,ROSTER} from '../src/data';
const isolated=()=>{const b=new Battle({difficulty:'easy'});b.state.units=[];b.state.relays=[];Object.defineProperty(b,'updateAI',{value:()=>{}});return b;};
const run=(b:Battle,seconds:number)=>{for(let i=0;i<seconds*30;i++){b.tick(1/30);b.takeEvents();}};

describe('battle movement regressions',()=>{
  it('winds up and charges continuously, stopping before an enemy instead of teleporting through it',()=>{
    const b=isolated(),u=b.spawn('vanguard',0,0,0),e=b.spawn('extractor',1,3,0);b.control(u.id);
    b.state.armies[1].order='retreat';e.cooldown=99;
    b.ability(u.id);expect(u.x).toBe(0);expect(e.hp).toBe(ROSTER.extractor.hp);
    // Keep the target stationary so contact distance and single impact are measurable.
    b.state.armies[1].order='defend';
    let previous=u.x;
    for(let i=0;i<20;i++){e.x=3;e.z=0;e.cargo=0;b.tick(1/30);expect(Math.abs(u.x-previous)).toBeLessThan(.51);expect(u.x).toBeLessThan(3);previous=u.x;}
    expect(u.dash).toBe(0);expect(e.hp).toBe(ROSTER.extractor.hp-35);
  });
  it('a free charge covers four metres over time and freezes when paused',()=>{
    const b=isolated(),u=b.spawn('vanguard',0,0,0);b.control(u.id);b.ability(u.id);run(b,.25);
    expect(u.x).toBeGreaterThan(0);expect(u.x).toBeLessThan(4);b.state.paused=true;const x=u.x;run(b,1);expect(u.x).toBe(x);
    b.state.paused=false;run(b,1);expect(u.x).toBeCloseTo(4);expect(u.dash).toBe(0);
  });
  it('nearby enemies are engaged while marching to a distant defensive rally',()=>{
    const b=isolated();b.setRally(60);const u=b.spawn('lancer',0,0,0),e=b.spawn('bulwark',1,6,0);e.emp=10;
    run(b,.4);expect(e.hp).toBeLessThan(ROSTER.bulwark.hp);expect(u.x).toBeLessThan(1);
  });
  it('selects a reachable ground target before an airborne target outside firing range',()=>{
    const b=isolated(),u=b.spawn('lancer',0,0,0),ground=b.spawn('bulwark',1,10,0);b.spawn('wasp',1,14,0);
    b.control(u.id);b.input.fire=true;b.tick(1/30);expect(b.state.projectiles.find(p=>p.team===0)?.target).toBe(ground.id);
  });
  it('keeps crowded units inside the expanded ground boundaries',()=>{
    const b=isolated();for(let i=0;i<20;i++)b.spawn('bulwark',0,FIELD.halfLength-.05,FIELD.halfDepth-.05);
    run(b,2);for(const u of b.state.units){expect(Math.abs(u.x)).toBeLessThanOrEqual(FIELD.halfLength);expect(Math.abs(u.z)).toBeLessThanOrEqual(FIELD.halfDepth);}
  });
  it('a relay cannot be captured from the far side of the battlefield depth',()=>{
    const b=isolated();b.state.relays=[{x:0,owner:null,capturing:null,progress:0,baseHp:0}];const u=b.spawn('bulwark',0,0,9);b.control(u.id);
    run(b,7);expect(b.state.relays[0].owner).toBe(null);expect(b.state.relays[0].progress).toBe(0);
  });
  it('melee attacks cannot hit a core across the depth of the lane',()=>{
    const b=isolated(),u=b.spawn('vanguard',0,FIELD.coreX[1],9);b.control(u.id);b.input.fire=true;run(b,1);
    expect(b.state.armies[1].core).toBe(2400);
  });
  it('controlled forward-base attacks include weapon research and overcharge',()=>{
    const b=isolated();b.state.relays=[{x:0,owner:1,capturing:null,progress:0,baseHp:650}];const u=b.spawn('lancer',0,-5,0);
    b.research('weapons');b.control(u.id);b.ability(u.id);b.input.fire=true;b.tick(1/30);
    expect(b.state.relays[0].baseHp).toBe(650-ROSTER.lancer.damage*1.25*2);
  });
  it('transferring or releasing control clears held input and rejects dead units',()=>{
    const b=isolated(),u=b.spawn('lancer',0),v=b.spawn('vanguard',0);b.control(u.id);b.input={x:1,z:1,fire:true};b.control(v.id);
    expect(b.input).toEqual({x:0,z:0,fire:false});b.input.fire=true;b.control(null);expect(b.input.fire).toBe(false);
    u.hp=0;expect(b.control(u.id)).toBe(false);
  });
  it('rally positions retain depth for flanking and clamp to the expanded field',()=>{
    const b=isolated();b.setRally(70,6);expect(b.state.armies[0]).toMatchObject({rally:70,rallyZ:6,order:'defend'});
    b.setRally(1000,1000);expect(b.state.armies[0].rally).toBe(FIELD.halfLength-4);expect(b.state.armies[0].rallyZ).toBe(FIELD.halfDepth-2);
  });
});
