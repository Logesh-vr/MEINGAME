import type { Settings } from './save';
import type { BattleEvent } from './simulation';
export class Sound {
  private context:AudioContext|null=null;
  private fx:GainNode|null=null;
  private ambience:GainNode|null=null;
  private settings:Settings;
  private lastShot=0;
  constructor(settings:Settings){this.settings=settings;}
  unlock(){
    if(!this.context){
      this.context=new AudioContext();this.fx=this.context.createGain();this.ambience=this.context.createGain();this.fx.connect(this.context.destination);this.ambience.connect(this.context.destination);
      // Original, quiet harmonic drone. No externally sourced recordings.
      for(const [i,freq] of [55,82.41,110,164.81].entries()){
        const osc=this.context.createOscillator(),gain=this.context.createGain();osc.type='sine';osc.frequency.value=freq;gain.gain.value=.018/(i+1);osc.connect(gain);gain.connect(this.ambience);osc.start();
      }
      this.apply(this.settings);
    }
    void this.context.resume();
  }
  apply(settings:Settings){this.settings=settings;if(this.fx)this.fx.gain.value=settings.effects;if(this.ambience)this.ambience.gain.value=settings.music;}
  suspend(){if(this.context)void this.context.suspend();}
  tone(freq:number,duration=.12,type:OscillatorType='sine',volume=.1,end=40){
    const c=this.context;if(!c||c.state!=='running'||!this.fx)return;const osc=c.createOscillator(),gain=c.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,c.currentTime);osc.frequency.exponentialRampToValueAtTime(end,c.currentTime+duration);gain.gain.setValueAtTime(volume,c.currentTime);gain.gain.exponentialRampToValueAtTime(.001,c.currentTime+duration);osc.connect(gain);gain.connect(this.fx);osc.start();osc.stop(c.currentTime+duration);
  }
  click(){this.tone(520,.055,'sine',.035,720);}
  events(events:BattleEvent[]){
    if(!this.context)return;for(const e of events){if(e.team!==0)continue;
      if(e.type==='shot'&&this.context.currentTime-this.lastShot>.065){this.lastShot=this.context.currentTime;this.tone(e.kind==='titan'?85:520,e.kind==='titan'?.3:.08,e.kind==='vanguard'?'triangle':'sawtooth',e.kind==='titan'?.13:.035,e.kind==='titan'?24:90);}
      else if(e.type==='emp')this.tone(1200,.5,'sine',.12,55);
      else if(e.type==='capture')this.tone(350,.5,'triangle',.07,740);
      else if(e.type==='death')this.tone(75,.2,'triangle',.045,25);
    }
  }
}
