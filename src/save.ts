import type { Difficulty } from './data';
export interface Settings {quality:'low'|'medium'|'high';music:number;effects:number;reducedMotion:boolean;difficulty:Difficulty;}
export interface SaveData {version:1;completed:number[];storyViewed:boolean;settings:Settings;}
export const defaults=():SaveData=>({version:1,completed:[],storyViewed:false,settings:{quality:'medium',music:.25,effects:.5,reducedMotion:false,difficulty:'normal'}});
export function parseSave(raw:string|null):SaveData{
  const base=defaults();if(!raw)return base;
  try{const data=JSON.parse(raw);if(data.version!==1)return base;
    base.completed=Array.isArray(data.completed)?[...new Set<number>(data.completed.filter((n:unknown)=>Number.isInteger(n)&&Number(n)>=0&&Number(n)<5))]:[];
    base.storyViewed=data.storyViewed===true;const s=data.settings??{};
    if(['low','medium','high'].includes(s.quality))base.settings.quality=s.quality;
    if(['easy','normal','hard'].includes(s.difficulty))base.settings.difficulty=s.difficulty;
    for(const key of ['music','effects'] as const)if(typeof s[key]==='number'&&Number.isFinite(s[key]))base.settings[key]=Math.max(0,Math.min(1,s[key]));
    base.settings.reducedMotion=s.reducedMotion===true;return base;
  }catch{return base;}
}
export function loadSave(){try{return parseSave(localStorage.getItem('helion-divide-v1'));}catch{return defaults();}}
export function persistSave(data:SaveData){try{localStorage.setItem('helion-divide-v1',JSON.stringify(data));return true;}catch{return false;}}
export function missionUnlocked(id:number,completed:number[]){return id===0||completed.includes(id-1);}
