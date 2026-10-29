export type Team = 0 | 1;
export type UnitKind = 'extractor' | 'vanguard' | 'lancer' | 'bulwark' | 'disruptor' | 'wasp' | 'titan';
export type Order = 'attack' | 'defend' | 'retreat';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type Research = 'extraction' | 'weapons' | 'shields';
// Shared by combat, scenery, camera limits and the tactical map.
export const FIELD = { halfLength:96, halfDepth:10, coreX:[-90,90] as readonly number[], oreOffset:10, oreZ:-5, relayRadius:4.5 };
export interface UnitDefinition { name: string; tag: string; cost: number; hp: number; shield: number; speed: number; range: number; damage: number; rate: number; train: number; air: boolean; antiAir: boolean; melee: boolean; description: string; ability: string; }
export const ROSTER: Record<UnitKind, UnitDefinition> = {
  extractor: {name:'Extractor',tag:'ECONOMY',cost:70,hp:80,shield:0,speed:4,range:1.7,damage:5,rate:1.3,train:2,air:false,antiAir:false,melee:true,description:'Hauls Helion from deposits to base. Protect your supply line.',ability:'Overdrive · move and extract faster for 5s'},
  vanguard: {name:'Vanguard',tag:'ASSAULT',cost:90,hp:150,shield:0,speed:5.1,range:2,damage:24,rate:.75,train:2.4,air:false,antiAir:false,melee:true,description:'Fast plasma blades slip inside frontal shields. Ground only.',ability:'Surge · dash forward and strike nearby ground targets'},
  lancer: {name:'Lancer',tag:'ANTI-AIR',cost:130,hp:110,shield:0,speed:3.6,range:11,damage:17,rate:.8,train:3,air:false,antiAir:true,melee:false,description:'Accurate pulse rifle. Prioritizes aircraft; needs a frontline.',ability:'Overcharge · double weapon output for 4s'},
  bulwark: {name:'Bulwark',tag:'DEFENSE',cost:180,hp:260,shield:200,speed:2.6,range:2.5,damage:18,rate:1.1,train:4,air:false,antiAir:false,melee:true,description:'Directional shield absorbs ranged fire. Flank or use EMP.',ability:'Brace · restore 100 shield unless disrupted'},
  disruptor: {name:'Disruptor',tag:'SUPPORT',cost:200,hp:100,shield:0,speed:3.3,range:9,damage:11,rate:1.2,train:4,air:false,antiAir:true,melee:false,description:'EMP support temporarily disables enemy shields in a radius.',ability:'Blackout · disable nearby shields for 6s'},
  wasp: {name:'Wasp',tag:'AIR STRIKE',cost:240,hp:130,shield:0,speed:5,range:9,damage:20,rate:.9,train:4.5,air:true,antiAir:true,melee:false,description:'Flying drone ignores melee formations. Counter with Lancers.',ability:'Afterburn · faster flight and double damage for 4s'},
  titan: {name:'Titan',tag:'SIEGE',cost:650,hp:780,shield:80,speed:1.9,range:15,damage:65,rate:2.4,train:8,air:false,antiAir:false,melee:false,description:'Heavy siege cannon with splash damage. Cannot engage aircraft.',ability:'Groundbreak · shockwave damages nearby ground enemies'},
};
export const KINDS = Object.keys(ROSTER) as UnitKind[];
export const RESEARCH: Record<Research, {name:string;cost:number;description:string}> = {
  extraction:{name:'Efficient extraction',cost:180,description:'+50% Helion per delivery'},
  weapons:{name:'Resonant weapons',cost:240,description:'+25% damage to all troops'},
  shields:{name:'Shield capacitors',cost:200,description:'+50% shield capacity and faster regeneration'},
};
export interface MissionDefinition { id:number; title:string; location:string; subtitle:string; briefing:string; ending:string; objective:string; theme:number; unlocked:UnitKind[]; research:boolean; forward:boolean; relays:number[]; }
const basic: UnitKind[] = ['extractor','vanguard','lancer'];
const shields: UnitKind[] = [...basic,'bulwark','disruptor'];
export const MISSIONS: MissionDefinition[] = [
  {id:0,title:'The First Light',location:'VESPER / OUTER SETTLEMENT',subtitle:'Every rebellion begins with a repair.',briefing:'Vesper has been dark for eleven days. Our engineers have brought one extractor online. A Directorate recovery force is approaching. Protect the supply line, build a fighting force, and disable their command core before they shut us down again.',ending:'For the first time in eleven nights, Vesper’s windows glow. A message arrives from the Directorate: surrender the extractor, or every frontier connection will be severed. Commander Vale closes the channel. “Then we reconnect them ourselves.”',objective:'Destroy the Directorate core. Keep your extractors alive.',theme:0,unlocked:basic,research:false,forward:false,relays:[]},
  {id:1,title:'The Shutdown Order',location:'KHEPRI / EXTRACTION FIELDS',subtitle:'A shield is only a promise until it breaks.',briefing:'Directorate Bulwarks have sealed the Khepri extraction fields. Frontal rifle fire will not break their shields. Deploy our new Disruptors to create an opening, or send Vanguards inside their protection. Secure the field and bring its power back to the frontier.',ending:'The field is ours. In the command records, engineer Sera finds something unexpected: the shutdowns followed a pattern of cascading Grid failures. “They were afraid of something,” she says. “We need to find out what.”',objective:'Break the shield line and destroy the enemy core.',theme:1,unlocked:shields,research:true,forward:false,relays:[0]},
  {id:2,title:'Broken Sky',location:'ORISON / UPLINK RIDGE',subtitle:'The sky belongs to whoever can hold it.',briefing:'Orison’s uplink contains the Grid’s diagnostic history. Directorate aircraft patrol the ridge. Lancers can engage them; Vanguards cannot. Our engineers have converted survey drones into Wasps. Capture the uplink relay and eliminate the Directorate core.',ending:'The uplink confirms it: Helion’s central regulators are burning out. The Directorate has been sacrificing the frontier to delay a planetary blackout. The Coalition broadcasts the evidence. Repair teams begin moving toward the capital.',objective:'Capture the uplink relay, then destroy the enemy core.',theme:2,unlocked:[...shields,'wasp'],research:true,forward:false,relays:[0]},
  {id:3,title:'The Long Connection',location:'MERIDIAN / INDUSTRIAL CORRIDOR',subtitle:'An army moves on the light behind it.',briefing:'The road to Helion’s heart is lined with disconnected relays. Capture them and invest in forward bases to shorten your reinforcement route. Our Titan construction frames now carry siege cannons. Take the corridor before the Directorate closes the capital gates.',ending:'Across the corridor, relay after relay turns cyan. Directorate technicians quietly open maintenance routes for the repair convoy. Not everyone on the other side believes this war can save the Grid.',objective:'Establish a forward base and destroy the Directorate core.',theme:3,unlocked:KINDS,research:true,forward:true,relays:[-30,30]},
  {id:4,title:'The Heart of Helion',location:'HELION PRIME / CENTRAL COMPLEX',subtitle:'We did not come this far to choose who goes dark.',briefing:'The central regulator is failing. The Directorate wants to isolate the frontier permanently; Sera’s repair can reconnect the entire network. Capture both control relays, break through the final defense, and disable the military command core so the repair teams can enter.',ending:'The military core falls silent. Sera’s team reroutes the failing regulators through the frontier extractors. One by one, lights return across the planet. There is no victory speech. Just an open channel, and a voice from Vesper: “We can see the sunrise from here.”',objective:'Capture both control relays and destroy the command core.',theme:4,unlocked:KINDS,research:true,forward:true,relays:[-30,30]},
];
export const OPENING = [
  'We built the Helion Grid so no city would ever go dark again.',
  'For a century, it kept that promise.',
  'Then the Directorate began choosing which cities deserved the light.',
  'On the frontier, hospitals failed. Harvest towers stopped. Our requests for power became requests for permission to survive.',
  'So we restarted an abandoned extractor.',
  'They called it theft.',
  'When their army arrived, we were still repairing the lights.',
];
export const THEMES = [
  {name:'Vesper frontier',sky:0x52616a,fog:0x677176,ground:0x383e3d,light:0xe4d6b7,accent:0x73dbe0},
  {name:'Khepri fields',sky:0x665448,fog:0x857160,ground:0x51483b,light:0xffd6a1,accent:0xe5b171},
  {name:'Orison ridge',sky:0x465a70,fog:0x657b8f,ground:0x333f4a,light:0xd8e6ff,accent:0x9eb9d8},
  {name:'Meridian corridor',sky:0x4a525d,fog:0x646e77,ground:0x343c42,light:0xf8d5ac,accent:0xe5ad78},
  {name:'Helion Prime',sky:0x34404b,fog:0x526471,ground:0x2f3944,light:0xd8efff,accent:0x78dce1},
];
