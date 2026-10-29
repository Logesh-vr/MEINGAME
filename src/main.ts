import './style.css';
import '@fontsource/oxanium/latin-600.css';
import '@fontsource/oxanium/latin-700.css';
import '@fontsource/rajdhani/latin-500.css';
import '@fontsource/rajdhani/latin-600.css';
import '@fontsource/rajdhani/latin-700.css';
import './cinematic.css';
import { KINDS, MISSIONS, OPENING, RESEARCH, ROSTER, THEMES, type Difficulty, type Research, type UnitKind } from './data';
import { Battle } from './simulation';
import { loadSave, missionUnlocked, persistSave } from './save';
import { World } from './render';
import { Sound } from './audio';

const app=document.querySelector<HTMLElement>('#app')!;
const canvas=document.querySelector<HTMLCanvasElement>('#world')!;
let save=loadSave();
const audio=new Sound(save.settings);
let world:World;
try{world=new World(canvas,save.settings);}catch(error){
  document.getElementById('boot')?.remove();
  app.innerHTML='<section class="compat"><span class="eyebrow">GRAPHICS UNAVAILABLE</span><h1>A little more power.</h1><p>Helion Divide needs WebGL 2. Enable hardware acceleration in your desktop browser, update your graphics driver, then reload.</p><button onclick="location.reload()" class="primary">Try again ↗</button></section>';
  throw error;
}
type Screen='story'|'menu'|'campaign'|'briefing'|'skirmish'|'settings'|'battle'|'pause'|'result';
let screen:Screen='menu',battle:Battle|null=null,selected:number|null=null,chosenMission=0,chosenMap=0;
let settingsBack:Screen='menu',storyTime=0,storyIndex=-1,previous=performance.now(),accumulator=0,hudTime=0;
let toastTime=0,tutorialDismissed=false;
const keys=new Set<string>();
const performanceSamples:number[]=[];
let pointerDown:{x:number;y:number}|null=null;
const fmt=(n:number)=>Math.floor(n).toLocaleString('en-US');
const clock=(s:number)=>`${Math.floor(s/60).toString().padStart(2,'0')}:${Math.floor(s%60).toString().padStart(2,'0')}`;
function persist(){if(!persistSave(save))toast('Browser storage is unavailable. Progress will last for this visit.');}
const icon=(kind:UnitKind)=>{
  const shapes:Record<UnitKind,string>={
    extractor:'<path d="M7 20h30M13 16l-4-5m22 5 4-5M17 25l-4 8m15-8 4 8"/><path d="m14 19 9-7 9 7-9 8Z"/><path d="m20 29 3 4 3-4"/>',
    vanguard:'<circle cx="21" cy="9" r="4"/><path d="m21 14-2 12-7 11m7-11 9 11M20 18l-8 7m9-7 9 5 8-15M35 5l5 3-9 17"/>',
    lancer:'<circle cx="19" cy="9" r="4"/><path d="m19 14 1 13-8 11m8-11 9 11M20 18l6 5m-8-6-7 7 15-1m-2-5h15m-11 0v7"/>',
    bulwark:'<circle cx="18" cy="9" r="4"/><path d="m18 14 1 13-7 11m7-11 8 11M18 18l-9 7m13-9 13-3v17l-6 5-6-5Z"/>',
    disruptor:'<circle cx="18" cy="9" r="4"/><path d="m18 14 1 13-7 11m7-11 9 11M18 18l-8 7m11-7 7 5m0-9v12m5-15v18m5-22v26"/>',
    wasp:'<path d="m11 16 11-7 11 7-11 8Zm11-7v15M8 15 3 7m30 8 8-8M12 22l-7 7m26-7 7 7M18 24l4 13 4-13"/><circle cx="6" cy="6" r="4"/><circle cx="38" cy="6" r="4"/>',
    titan:'<path d="M15 6h14v8H15ZM10 16h24v13H10Zm3 13-5 10h9l5-10 5 10h9l-5-10M9 17H4v13h5m25-12h9v5H30M19 18v7h7v-7Z"/>',
  };
  return `<svg viewBox="0 0 46 44" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[kind]}</svg>`;
};
function shell(content:string,active=''){
  app.innerHTML=`<div class="screen-shade"></div><div class="cinema-grain"></div>${active!=='menu'?'<header class="cinema-header"><button data-action="menu" class="quiet-logo" aria-label="Helion Divide home">HELION <b>DIVIDE</b></button></header>':''}${content}<div class="version-mark">HELION DIVIDE <span>1.0</span></div>`;
  document.body.dataset.screen=active;
}
function menu(){
  screen='menu';battle=null;keys.clear();world.menu();
  shell(`<section class="title-menu"><div class="title-rule"></div><h1 class="cinema-title">HELION<span>DIVIDE</span></h1><p class="title-tagline">THEY TOOK THE LIGHT.<br>TAKE IT BACK.</p><nav class="cinema-menu" aria-label="Main menu"><button class="menu-play" data-action="campaign"><i></i>${save.completed.length?'Continue campaign':'Campaign'}<span>▶</span></button><button data-action="skirmish">Skirmish</button><button data-action="story">The story</button><button data-action="settings">Settings</button></nav></section><div class="world-caption"><span>VESPER</span><i></i><small>Eleven nights without power.</small></div>`,'menu');
}
function story(){
  battle=null;world.menu();screen='story';keys.clear();storyTime=0;storyIndex=-1;
  app.innerHTML=`<div class="story-vignette"></div><div class="letterbox top"></div><div class="letterbox bottom"></div><div class="story-top"><span class="story-place">THE FRONTIER · 2186</span><button class="text-button" data-action="skip-story">Skip intro</button></div><div class="story-text"><p id="story-caption"></p><div class="story-progress">${OPENING.map((_,i)=>`<i id="chapter-${i}"></i>`).join('')}</div><button class="text-button story-next" data-action="advance-story">Next <kbd>ENTER</kbd></button></div><button class="audio-enable text-button" data-action="audio">Sound on</button>`;
  document.body.dataset.screen='story';updateStory();
}
function finishStory(){save.storyViewed=true;persist();menu();}
function updateStory(){
  const durations=[5,4,5,8,4,3.5,6];let total=0,index=0;for(;index<durations.length;index++){total+=durations[index];if(storyTime<total)break;}
  if(index>=OPENING.length){finishStory();return;}
  if(index!==storyIndex){storyIndex=index;const p=document.querySelector('#story-caption')!;p.textContent=OPENING[index];p.classList.remove('caption-enter');void (p as HTMLElement).offsetWidth;p.classList.add('caption-enter');for(let i=0;i<OPENING.length;i++)document.querySelector(`#chapter-${i}`)?.classList.toggle('filled',i<=index);}
}
function campaign(){
  screen='campaign';battle=null;keys.clear();
  if(!missionUnlocked(chosenMission,save.completed))chosenMission=0;
  const m=MISSIONS[chosenMission];world.menu(m.theme);
  const positions=[[5,55],[27,35],[50,60],[73,30],[95,50]];
  shell(`<section class="campaign-stage"><div class="stage-top"><span class="chapter-label">CAMPAIGN</span><button class="cinema-back" data-action="menu">← Back</button></div><article class="chapter-story"><span class="chapter-label">CHAPTER 0${m.id+1} <i></i> ${m.location.split(' / ')[0]}</span><h1>${m.title}</h1><p class="chapter-tagline">${m.subtitle}</p><p class="chapter-brief">${m.briefing}</p><button class="cinema-start" data-action="launch-campaign"><span>▶</span> ${save.completed.includes(m.id)?'Replay chapter':'Begin chapter'}</button></article><nav class="chapter-route" aria-label="Campaign chapters"><svg viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="50,55 270,35 500,60 730,30 950,50"/></svg>${MISSIONS.map((x,i)=>{const unlocked=missionUnlocked(i,save.completed),done=save.completed.includes(i);return `<button class="chapter-node ${i===chosenMission?'chosen':''} ${done?'complete':''}" style="left:${positions[i][0]}%;top:${positions[i][1]}%" data-action="mission" data-id="${i}" aria-label="Chapter ${i+1}: ${x.title}" ${!unlocked?'disabled':''}><span class="node-ring"><i>${done?'✓':unlocked?'0'+(i+1):'·'}</i></span><strong>${x.title}</strong><small>${done?'COMPLETE':unlocked?x.location.split(' / ')[0]:'LOCKED'}</small></button>`;}).join('')}</nav></section>`,'campaign');
}
function briefing(id:number){
  chosenMission=id;battle=null;screen='briefing';keys.clear();world.menu(MISSIONS[id].theme);const m=MISSIONS[id];
  shell(`<section class="between-chapters"><span class="chapter-label">CHAPTER 0${m.id+1}</span><h1>${m.title}</h1><p class="chapter-tagline">${m.subtitle}</p><p>${m.briefing}</p><button class="cinema-start" data-action="launch-campaign"><span>▶</span> Begin chapter</button><button class="cinema-back" data-action="campaign">Campaign</button></section>`,'briefing');
}
function skirmish(){
  screen='skirmish';battle=null;keys.clear();world.menu([0,3,4][chosenMap]);
  const maps=[{name:'Vesper frontier',text:'Open ground. A settlement worth defending.'},{name:'Meridian corridor',text:'A broken road through the industrial heartland.'},{name:'Helion Prime',text:'Every connection leads back here.'}];
  shell(`<section class="skirmish-stage"><div class="stage-top"><span class="chapter-label">SKIRMISH</span><button class="cinema-back" data-action="menu">← Back</button></div><div class="skirmish-setup"><h1>Choose your ground.</h1><nav class="battlefield-choices" aria-label="Battlefield">${maps.map((m,i)=>`<button class="${chosenMap===i?'chosen':''}" data-action="map" data-id="${i}"><span>0${i+1}</span>${m.name}<i>${chosenMap===i?'◂':''}</i></button>`).join('')}</nav><p class="map-flavor">${maps[chosenMap].text}</p><div class="difficulty-select"><span class="chapter-label">DIFFICULTY</span><div>${(['easy','normal','hard'] as Difficulty[]).map(d=>`<button class="${save.settings.difficulty===d?'chosen':''}" data-action="difficulty" data-id="${d}">${d}</button>`).join('')}</div></div><button class="cinema-start" data-action="launch-skirmish"><span>▶</span> Start battle</button><p class="skirmish-note">Full army unlocked. You versus the Directorate.</p></div></section>`,'skirmish');
}

function settings(){
  screen='settings';
  shell(`<section class="page-content settings-page"><div class="page-heading"><div><div class="eyebrow">OPTIONS</div><h1>Settings</h1></div><button class="back" data-action="settings-back">← Back</button></div><div class="settings-panel"><label><span><strong>Graphics quality</strong><small>Resolution and real-time shadows</small></span><select id="quality"><option value="low" ${save.settings.quality==='low'?'selected':''}>Low · performance</option><option value="medium" ${save.settings.quality==='medium'?'selected':''}>Medium · balanced</option><option value="high" ${save.settings.quality==='high'?'selected':''}>High · fidelity</option></select></label><label><span><strong>Ambience</strong><small></small></span><input aria-label="Ambient sound volume" id="music" type="range" min="0" max="1" step=".05" value="${save.settings.music}"></label><label><span><strong>Sound effects</strong><small></small></span><input aria-label="Combat effects volume" id="effects" type="range" min="0" max="1" step=".05" value="${save.settings.effects}"></label><label><span><strong>Reduced motion</strong><small>Reduce cinematic camera movement and idle animation</small></span><input id="reducedMotion" type="checkbox" ${save.settings.reducedMotion?'checked':''}></label><div class="settings-note">Progress saves between missions in this browser. Leaving or reloading an active battle ends that match.</div></div><div class="controls-reference"><span class="eyebrow">CONTROLS</span><p><kbd>W A S D</kbd> Move controlled unit <kbd>SPACE</kbd> Fire / extract <kbd>Q</kbd> Special action<br><kbd>ENTER</kbd> Take / release control <kbd>ESC</kbd> Release control / pause <kbd>← →</kbd> Pan camera<br>Click a soldier to select · Double-click to control · Click terrain to rally · Scroll to zoom</p></div></section>`,'settings');
}
function startBattle(mission?:number){
  battle=new Battle({mission,theme:[0,3,4][chosenMap],difficulty:save.settings.difficulty});screen='battle';selected=null;keys.clear();accumulator=0;tutorialDismissed=false;world.start(battle);world.select(null);
  document.body.dataset.screen='battle';
  app.innerHTML=`<div class="battle-top"><div class="core-status coalition"><div class="eyebrow">COALITION</div><div class="core-bar"><i id="our-core-bar"></i></div><span id="our-core"></span></div><div class="battle-center"><span class="eyebrow">${battle.mission?`OPERATION 0${battle.mission.id+1}`:'SKIRMISH'} / ${THEMES[battle.mission?.theme??battle.options.theme??0].name.toUpperCase()}</span><span id="match-time">00:00</span><span class="micro" id="army-count"></span></div><div class="core-status directorate"><div class="eyebrow">DIRECTORATE</div><div class="core-bar"><i id="enemy-core-bar"></i></div><span id="enemy-core"></span></div></div><div class="army-toolbar"><div class="resource"><span class="helion-glyph">◈</span><strong id="money">560</strong><span>HELION</span></div><div class="orders"><button data-action="order" data-id="attack" title="Advance and engage the enemy">↗ Attack</button><button data-action="order" data-id="defend" title="Hold the rally point and engage nearby enemies">◇ Defend</button><button data-action="order" data-id="retreat" title="Return to the command core">↙ Retreat</button></div><div class="toolbar-right"><button class="icon-button" data-action="overview" title="See the full battlefield">⊡</button><button class="icon-button" data-action="next-unit" title="Select next friendly unit (F)" aria-label="Select next friendly unit">⌖</button><button class="icon-button" data-action="help" title="Show controls">?</button><button class="icon-button" data-action="pause" aria-label="Pause battle">Ⅱ</button></div></div><div class="battle-mission"><span class="eyebrow">${battle.mission?.title.toUpperCase()??'RECLAIM THE GRID'}</span><p id="objective-status"></p></div><div id="selection-panel"></div><div id="tutorial"></div><div class="battle-bottom"><div class="production-row"><span class="eyebrow">ARMY / <span id="production-status">READY</span></span><div id="production-queue"></div><button class="text-button" data-action="research-toggle">Research & relays ↑</button></div><div class="roster">${KINDS.map((k,i)=>{const d=ROSTER[k],locked=!battle!.available.includes(k);return `<button class="unit-card ${locked?'locked':''}" data-action="recruit" data-id="${k}" ${locked?'disabled':''} title="${d.description} · ${d.train}s production"><span class="unit-key">${i+1}</span>${icon(k)}<span class="unit-name">${d.name}</span><span class="unit-cost">${locked?'LOCKED':`◈ ${d.cost}`}</span><span class="unit-tag">${d.tag}</span></button>`;}).join('')}</div><div class="battle-controls"><span id="control-hint">CLICK TO SELECT · DOUBLE-CLICK TO CONTROL · TERRAIN TO RALLY</span><span><kbd>← →</kbd> PAN <kbd>SCROLL</kbd> ZOOM</span></div></div><div id="research-panel"></div><div id="modal"></div><div id="toast" role="status"></div>`;
  updateHUD();
}
let deploying=false;
function deploy(mission?:number){
  if(deploying)return;deploying=true;keys.clear();
  const transition=document.createElement('div');transition.className='chapter-transition';transition.setAttribute('role','status');
  transition.innerHTML=mission===undefined?'<span>SKIRMISH</span><h2>Hold the line.</h2>':`<span>CHAPTER 0${mission+1}</span><h2>${MISSIONS[mission].title}</h2>`;
  document.body.append(transition);audio.tone(80,.65,'sine',.08,120);
  setTimeout(()=>{startBattle(mission);if(battle)battle.state.paused=true;},300);
  setTimeout(()=>{transition.classList.add('departing');if(screen==='battle'&&battle)battle.state.paused=false;deploying=false;},1400);
  setTimeout(()=>transition.remove(),2150);
}
function tutorial(){
  if(!battle||tutorialDismissed)return '';
  const t=battle.state.time,m=battle.mission?.id;
  let title='Your first orders',text='Extractors gather Helion automatically. Recruit soldiers below, then choose Attack to advance. Click terrain to set a defensive rally point.';
  if(t>18){title='Take the field';text='Click a friendly unit, then press Enter to control it. Move with WASD, hold Space to attack, and use Q for its ability. Escape returns to army command.';}
  if(m===1&&t>35){title='Break their promise';text='Bulwark shields block frontal ranged fire. Disruptors disable them with EMP; Vanguards strike inside their protection. Research upgrades are below.';}
  else if(m===2&&t>35){title='Control the sky';text='Lancers and Wasps can attack aircraft. Capture the uplink by holding ground soldiers near the central relay for 6 uncontested seconds.';}
  else if((m===3||m===4||m===undefined)&&t>35){title='Build a connection';text='Rally troops near a relay to capture it. Open Research & relays to build a forward base for 350 Helion and deploy reinforcements there.';}
  if(t>85)return '';
  return `<div class="tutorial"><button data-action="dismiss-tutorial" aria-label="Dismiss tutorial">×</button><span class="eyebrow">TIP</span><strong>${title}</strong><p>${text}</p></div>`;
}
let researchOpen=false;
function updateHUD(){
  if(!battle||screen!=='battle')return;
  const s=battle.state,a=s.armies[0];
  const set=(id:string,value:string)=>{const e=document.getElementById(id);if(e&&e.textContent!==value)e.textContent=value;};
  set('money',fmt(a.money));set('match-time',clock(s.time));set('our-core',`${fmt(a.core)} / 2,400`);set('enemy-core',`${fmt(s.armies[1].core)} / 2,400`);set('army-count',`${battle.count} / 40 UNITS`);
  document.getElementById('our-core-bar')!.style.width=`${a.core/24}%`;document.getElementById('enemy-core-bar')!.style.width=`${s.armies[1].core/24}%`;
  set('objective-status',battle.objectiveStatus());set('production-status',a.queue.length?`${ROSTER[a.queue[0].kind].name.toUpperCase()} · ${Math.ceil(a.queue[0].remaining)}s`:'READY');
  const queue=document.getElementById('production-queue')!;const queueHTML=a.queue.map((q,i)=>`<button data-action="cancel" data-id="${i}" title="Cancel ${ROSTER[q.kind].name}; 80% refund">${icon(q.kind)}<span>${i===0?Math.ceil(q.remaining)+'s':''}</span></button>`).join('');if(queue.innerHTML!==queueHTML)queue.innerHTML=queueHTML;
  document.querySelectorAll<HTMLButtonElement>('[data-action="order"]').forEach(e=>{e.classList.toggle('active',e.dataset.id===a.order);});
  document.querySelectorAll<HTMLButtonElement>('[data-action="recruit"]').forEach(e=>{const kind=e.dataset.id as UnitKind;e.disabled=!battle!.available.includes(kind)||a.money<ROSTER[kind].cost||battle!.capacity(0)>=40||a.queue.length>=8;});
  const unit=s.units.find(u=>u.id===selected);if(!unit)selected=null;
  const panel=document.getElementById('selection-panel')!;
  if(unit){const d=ROSTER[unit.kind],controlled=s.controlled===unit.id;const html=`<aside class="selected-unit"><div class="selected-heading">${icon(unit.kind)}<div><span class="eyebrow">${controlled?'DIRECT CONTROL':'UNIT SELECTED'}</span><h3>${d.name}</h3></div><button data-action="deselect" aria-label="Deselect unit">×</button></div><div class="unit-vitals"><span>HULL <strong>${Math.ceil(unit.hp)} / ${d.hp}</strong></span>${d.shield?`<span>SHIELD <strong>${unit.emp>0?'EMP '+Math.ceil(unit.emp)+'s':Math.ceil(unit.shield)+' / '+battle.maxShield(unit)}</strong></span>`:''}${unit.kind==='extractor'?`<span>CARGO <strong>◈ ${unit.cargo}</strong></span>`:''}</div><p>${d.description}</p><button class="control-button" data-action="control">${controlled?'Release control':'Take control'} <kbd>ENTER</kbd></button><button class="ability-button" data-action="ability" ${unit.abilityCooldown>0||(unit.kind==='bulwark'&&unit.emp>0)?'disabled':''}>${d.ability}<span>${unit.abilityCooldown>0?Math.ceil(unit.abilityCooldown)+'s':'Q'}</span></button></aside>`;if(panel.innerHTML!==html)panel.innerHTML=html;}
  else if(panel.innerHTML)panel.innerHTML='';
  set('control-hint',s.controlled!==null?'DIRECT CONTROL · WASD MOVE · SPACE PRIMARY · Q ABILITY · ESC RELEASE':'CLICK TO SELECT · DOUBLE-CLICK TO CONTROL · TERRAIN TO RALLY');
  const tut=document.getElementById('tutorial')!,text=tutorial();if(tut.innerHTML!==text)tut.innerHTML=text;
  if(researchOpen)renderResearch();
  if(battle.message){toast(battle.message);battle.message='';}
}
function renderResearch(){
  if(!battle)return;const a=battle.state.armies[0];
  const html=`<section class="research-drawer"><div class="drawer-title"><span class="eyebrow">UPGRADES</span><button data-action="research-toggle" aria-label="Close research">×</button></div><div class="research-items">${(Object.keys(RESEARCH) as Research[]).map(k=>`<button data-action="research" data-id="${k}" ${a.research[k]||a.money<RESEARCH[k].cost||battle!.mission?.research===false?'disabled':''}><span>${RESEARCH[k].name}<small>${RESEARCH[k].description}</small></span><strong>${a.research[k]?'✓':battle!.mission?.research===false?'LOCKED':'◈ '+RESEARCH[k].cost}</strong></button>`).join('')}</div><span class="eyebrow relay-title">RELAY NETWORK / +3 HELION PER SECOND EACH</span><div class="relay-items"><button data-action="spawn-home" class="home-spawn ${a.spawn===null?'active':''}">⌂ Main core ${a.spawn===null?'· Deploying here':''}</button>${battle.state.relays.map((r,i)=>`<div class="relay-card"><span>Relay 0${i+1}<small>${r.owner===0?'COALITION':r.owner===1?'DIRECTORATE':r.progress>0?`CAPTURING ${Math.floor(r.progress*100)}%`:'NEUTRAL'}</small></span>${r.owner===0?(r.baseHp>0?`<button data-action="spawn" data-id="${i}" ${a.spawn===i?'disabled':''}>${a.spawn===i?'✓ DEPLOYING':`Deploy here · ${Math.ceil(r.baseHp)} HP`}</button>`:`<button data-action="base" data-id="${i}" ${a.money<350||battle!.mission?.forward===false?'disabled':''}>${battle!.mission?.forward===false?'BASE LOCKED':'Build base ◈ 350'}</button>`):'<small>Hold ground troops nearby to capture</small>'}</div>`).join('')||'<p class="micro">No relays in this sector.</p>'}</div></section>`;
  const p=document.getElementById('research-panel');if(p&&p.innerHTML!==html)p.innerHTML=html;
}
function pause(){
  if(!battle)return;screen='pause';battle.state.paused=true;keys.clear();
  document.getElementById('modal')!.innerHTML=`<div class="modal-backdrop"><section class="pause-panel cinema-pause"><h2>PAUSED</h2><nav class="cinema-menu"><button class="menu-play" data-action="resume">Resume<span>▶</span></button><button data-action="restart">Restart chapter</button><button data-action="settings">Settings</button><button data-action="leave">Quit to menu</button></nav><small>Your completed chapters are saved.</small></section></div>`;
}
function resume(){
  if(!battle)return;screen='battle';battle.state.paused=false;keys.clear();document.getElementById('modal')!.innerHTML='';updateHUD();
}
function showResult(){
  if(!battle)return;const victory=battle.state.winner===0,m=battle.mission;updateHUD();screen='result';keys.clear();
  if(victory&&m&&!save.completed.includes(m.id)){save.completed.push(m.id);save.completed.sort();persist();}
  const title=victory?(m?.id===4?'A new dawn.':'The light returns.'):'Not the end.';
  const text=victory?(m?.ending??'The Directorate core falls silent. Your army holds the field. Another light returns to the frontier.'):'The core is lost. The frontier is not. Regroup, protect your supply line, and fight again.';
  document.getElementById('modal')!.innerHTML=`<div class="modal-backdrop result-backdrop"><section class="result-panel cinema-result"><span class="chapter-label">${victory?'VICTORY':'DEFEAT'} ${m?' / CHAPTER 0'+(m.id+1):''}</span><h1>${title}</h1><p>${text}</p><span class="result-summary">${clock(battle.state.time)} <i>·</i> ${battle.count} survivors <i>·</i> ${battle.state.relays.filter(r=>r.owner===0).length} relays secured</span><nav class="result-actions">${victory&&m&&m.id<4?'<button class="cinema-start" data-action="next-mission"><span>▶</span> Continue</button>':'<button class="cinema-start" data-action="restart"><span>▶</span> Try again</button>'}<button class="cinema-back" data-action="leave">${m?'Campaign':'Main menu'}</button></nav></section></div>`;
  audio.tone(victory?440:180,1,'triangle',.12,victory?660:55);
}
function toast(message:string){
  const e=document.getElementById('toast');if(e){e.textContent=message;e.classList.add('visible');toastTime=4;}
  else{let el=document.getElementById('global-toast');if(!el){el=document.createElement('div');el.id='global-toast';el.setAttribute('role','status');document.body.append(el);}el.textContent=message;setTimeout(()=>el?.remove(),5000);}
}
function selectNextUnit(){
  if(!battle||screen!=='battle')return;
  const units=battle.state.units.filter(u=>u.team===0).sort((a,b)=>Number(a.kind==='extractor')-Number(b.kind==='extractor')||a.id-b.id);
  if(!units.length)return;const i=units.findIndex(u=>u.id===selected);const unit=units[(i+1)%units.length];selected=unit.id;world.select(selected);world.focus(unit.x);updateHUD();
}
app.addEventListener('click',event=>{
  const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');if(!button||button.disabled)return;audio.unlock();audio.click();
  const action=button.dataset.action,id=button.dataset.id;
  switch(action){
    case'menu':if(battle&&(screen==='battle'||screen==='pause')){pause();break;}menu();break;
    case'campaign':chosenMission=MISSIONS.find(m=>!save.completed.includes(m.id))?.id??4;campaign();break;
    case'skirmish':skirmish();break;
    case'story':story();break;
    case'skip-story':finishStory();break;
    case'advance-story':{const times=[5,4,5,8,4,3.5,6];storyTime=times.slice(0,storyIndex+1).reduce((a,b)=>a+b,0)+.01;updateStory();break;}
    case'audio':button.textContent='◌ Sound enabled';break;
    case'mission':chosenMission=Number(id);campaign();break;
    case'launch-campaign':researchOpen=false;deploy(chosenMission);break;
    case'map':chosenMap=Number(id);skirmish();break;
    case'difficulty':save.settings.difficulty=id as Difficulty;persist();skirmish();break;
    case'launch-skirmish':researchOpen=false;deploy();break;
    case'settings':settingsBack=screen==='pause'?'pause':screen==='battle'?'pause':screen; if(battle)battle.state.paused=true;settings();break;
    case'settings-back':if(settingsBack==='pause'&&battle){const old=battle;const oldSelected=selected;rebuildBattleUI(old,oldSelected);pause();}else if(settingsBack==='campaign')campaign();else if(settingsBack==='skirmish')skirmish();else menu();break;
    case'recruit':if(battle?.recruit(id as UnitKind))audio.tone(640,.08,'sine',.04,900);else toast(battle?.message??'Unable to recruit.');break;
    case'cancel':battle?.cancelProduction(Number(id));break;
    case'order':battle?.setOrder(id as 'attack'|'defend'|'retreat');break;
    case'overview':world.overview();break;
    case'next-unit':selectNextUnit();break;
    case'help':tutorialDismissed=false;toast('F cycles friendly units. Enter takes control. WASD move · Space attack · Q ability · Escape release / pause.');break;
    case'pause':pause();break;
    case'resume':resume();break;
    case'restart':researchOpen=false;deploy(battle?.options.mission);break;
    case'leave':{const wasCampaign=!!battle?.mission;battle=null;world.menu();if(wasCampaign)campaign();else menu();break;}
    case'next-mission':{const next=(battle?.mission?.id??0)+1;researchOpen=false;briefing(next);break;}
    case'deselect':selected=null;world.select(null);break;
    case'control':if(battle&&selected!==null)battle.control(battle.state.controlled===selected?null:selected);break;
    case'ability':if(selected!==null)battle?.ability(selected);break;
    case'dismiss-tutorial':tutorialDismissed=true;break;
    case'research-toggle':researchOpen=!researchOpen;if(!researchOpen)document.getElementById('research-panel')!.innerHTML='';break;
    case'research':if(!battle?.research(id as Research))toast('Research unavailable or insufficient Helion.');break;
    case'base':if(battle?.buildBase(Number(id)))toast('Forward base online. New combat troops deploy here.');break;
    case'spawn':battle?.setSpawn(Number(id));break;
    case'spawn-home':battle?.setSpawn(null);break;
  }
  if(screen==='battle')updateHUD();
});
// Settings replace the HUD, but the simulation object survives unchanged.
function rebuildBattleUI(saved:Battle,savedSelected:number|null){
  const theme=saved.options.theme,mission=saved.options.mission,dismissed=tutorialDismissed;startBattle(mission);battle=saved;battle.options.theme=theme;selected=savedSelected;tutorialDismissed=dismissed;world.start(saved);world.select(selected);updateHUD();
}
app.addEventListener('input',event=>{
  if(screen!=='settings')return;const el=event.target as HTMLInputElement;
  if(el.id==='quality')save.settings.quality=el.value as typeof save.settings.quality;
  if(el.id==='music'||el.id==='effects')save.settings[el.id]=Number(el.value);
  if(el.id==='reducedMotion')save.settings.reducedMotion=el.checked;
  world.settings(save.settings);audio.unlock();audio.apply(save.settings);persist();
});
canvas.addEventListener('pointerdown',event=>{pointerDown={x:event.clientX,y:event.clientY};audio.unlock();});
canvas.addEventListener('pointerup',event=>{
  if(!battle||screen!=='battle'||!pointerDown||Math.hypot(event.clientX-pointerDown.x,event.clientY-pointerDown.y)>7)return;
  const picked=world.pick(event.clientX,event.clientY);selected=picked.unit;world.select(selected);
  if(selected===null){battle.control(null);battle.setRally(picked.x);toast('Defensive rally point updated.');}updateHUD();
});
canvas.addEventListener('dblclick',event=>{if(screen==='battle'&&battle){const p=world.pick(event.clientX,event.clientY);if(p.unit!==null){selected=p.unit;world.select(selected);battle.control(selected);updateHUD();}}});
canvas.addEventListener('wheel',event=>{if(screen!=='battle')return;event.preventDefault();world.zoomBy(event.deltaY*.0006);},{passive:false});
canvas.addEventListener('contextmenu',event=>event.preventDefault());
window.addEventListener('keydown',event=>{
  if((event.target as HTMLElement).matches('input,select,textarea'))return;
  const key=event.key.toLowerCase();if([' ','arrowleft','arrowright','arrowup','arrowdown'].includes(key))event.preventDefault();
  if(event.repeat){keys.add(key);return;}keys.add(key);
  if(screen==='story'){if(key==='escape')finishStory();else if(key==='enter')document.querySelector<HTMLButtonElement>('[data-action="advance-story"]')?.click();return;}
  if((screen==='menu'||screen==='pause')&&(key==='arrowup'||key==='arrowdown')){
    const choices=Array.from(document.querySelectorAll<HTMLButtonElement>('.cinema-menu button:not(:disabled)'));const current=choices.indexOf(document.activeElement as HTMLButtonElement);choices[(current+(key==='arrowdown'?1:-1)+choices.length)%choices.length]?.focus();return;
  }
  if(key==='escape'){if(screen==='battle'&&battle){if(battle.state.controlled!==null)battle.control(null);else pause();}else if(screen==='pause')resume();else if(screen==='settings')document.querySelector<HTMLButtonElement>('[data-action="settings-back"]')?.click();else if(screen==='campaign'||screen==='skirmish'||screen==='briefing')menu();return;}
  if(screen!=='battle'||!battle)return;audio.unlock();
  if(key==='enter'&&selected!==null){event.preventDefault();battle.control(battle.state.controlled===selected?null:selected);}
  if(key==='q'&&battle.state.controlled!==null)battle.ability(battle.state.controlled);
  if(key==='f')selectNextUnit();
  const hotkey=Number(key);if(hotkey>=1&&hotkey<=7)battle.recruit(KINDS[hotkey-1]);
  if(key==='p')pause();
});
window.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));
window.addEventListener('blur',()=>{keys.clear();if(screen==='battle')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();audio.suspend();if(screen==='battle')pause();}else previous=performance.now();});
window.addEventListener('resize',()=>world.resize());
function frame(now:number){
  const delta=Math.min((now-previous)/1000,.1);previous=now;
  if(!document.hidden){
    if(screen==='story'){storyTime+=delta;updateStory();}
    if(battle&&screen==='battle'){
      battle.input={x:(keys.has('d')?1:0)-(keys.has('a')?1:0),z:(keys.has('s')?1:0)-(keys.has('w')?1:0),fire:keys.has(' ')};
      if(keys.has('arrowleft'))world.pan(-delta*25);if(keys.has('arrowright'))world.pan(delta*25);
      accumulator+=delta;let steps=0;while(accumulator>=1/30&&steps++<4){battle.tick(1/30);accumulator-=1/30;}
      const events=battle.takeEvents();world.showEvents(events);audio.events(events);
      if(battle.state.winner!==null)showResult();
      hudTime+=delta;if(hudTime>.16){hudTime=0;updateHUD();}
      if(toastTime>0){toastTime-=delta;if(toastTime<=0)document.getElementById('toast')?.classList.remove('visible');}
    }
    world.update(delta,screen==='story'?Math.min(1,storyTime/35):undefined);
    if(battle&&screen==='battle'){performanceSamples.push(now);if(performanceSamples.length>180)performanceSamples.shift();}
  }
  requestAnimationFrame(frame);
}
if(save.storyViewed)menu();else story();
requestAnimationFrame(frame);
void document.fonts.ready.then(()=>{document.getElementById('boot')?.classList.add('loaded');setTimeout(()=>document.getElementById('boot')?.remove(),700);});
// Read-only diagnostics for reproducible QA; no gameplay or save mutation hooks.
Object.defineProperty(window,'helionDiagnostics',{get:()=>({screen,time:battle?.state.time,units:battle?.state.units.length,controlled:battle?.state.controlled,selected,quality:save.settings.quality,fps:performanceSamples.length>1?(performanceSamples.length-1)*1000/(performanceSamples.at(-1)!-performanceSamples[0]):0,render:world.stats()})});
