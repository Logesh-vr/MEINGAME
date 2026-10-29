import {it,expect} from 'vitest';
import {Battle} from '../src/simulation';
import {ROSTER,type UnitKind} from '../src/data';

// Deterministic command-level player: no free money, spawned reinforcements,
// health changes, or victory shortcuts. Exercises full public battle rules.
function play(b:Battle){
  let think=0,phase=0;const desiredWorkers=7;
  for(let step=0;step<30*900&&b.state.winner===null;step++){
    if(think--<=0){think=15;const s=b.state,a=s.armies[0],units=s.units.filter(u=>u.team===0);
      const workers=units.filter(u=>u.kind==='extractor').length+a.queue.filter(q=>q.kind==='extractor').length;
      if(workers<desiredWorkers)b.recruit('extractor');
      else{
        const composition:UnitKind[]=b.available.includes('bulwark')?['lancer','bulwark','lancer','vanguard','disruptor']:['lancer','vanguard','lancer'];
        const pick=composition[phase++%composition.length];if(a.money>=ROSTER[pick].cost)b.recruit(pick);
        if(a.money>600&&!a.research.weapons)b.research('weapons');
        if(a.money>450&&!a.research.extraction)b.research('extraction');
      }
      const troops=units.filter(u=>u.kind!=='extractor');
      if(s.time<45)b.setOrder('defend');
      else if(b.mission&&b.mission.id>=2&&!b.objectivesSatisfied()){
        const relayIndex=s.relays.findIndex(r=>r.owner!==0);
        if(relayIndex>=0)b.setRally(s.relays[relayIndex].x);
        else if(b.mission.id===3){b.buildBase(0);b.setOrder('attack');}
      }else if(troops.length>5||s.time>120)b.setOrder('attack');
    }
    b.tick(1/30);b.takeEvents();
  }
  return {winner:b.state.winner,time:Math.floor(b.state.time),units:b.count,core:Math.ceil(b.state.armies[0].core),enemy:Math.ceil(b.state.armies[1].core),objective:b.objectivesSatisfied()};
}
it.each([0,1,2,3,4])('campaign mission %i is completable through legal commands',mission=>{
  const result=play(new Battle({mission,difficulty:'easy',seed:12345}));console.log('Mission',mission+1,result);expect(result.winner).toBe(0);
});
it.each(['easy','normal','hard'] as const)('skirmish on %s reaches a real outcome',difficulty=>{
  const result=play(new Battle({difficulty,seed:12345}));console.log('Skirmish',difficulty,result);expect(result.winner).not.toBe(null);
});
