export type Team = 'blue' | 'red' | 'green' | 'violet';
export type MapId = 'courtyard' | 'forest' | 'ruins' | 'crossroads';
export type GameMode = 'duel' | 'teams' | 'ffa3' | 'ffa4' | 'pve';
export interface Vec { x: number; y: number }
export interface Rect extends Vec { w: number; h: number }
export interface Bush extends Rect { id: string }
export interface MapDefinition {
  id: MapId;
  name: string;
  description: string;
  theme: 'stone' | 'forest' | 'ruins' | 'crossroads';
  walls: Rect[];
  bushes: Bush[];
  sideHomes: Record<'blue' | 'red', Vec>;
  sideSpawns: Record<'blue' | 'red', Vec[]>;
  cornerHomes: Record<Team, Vec>;
  cornerSpawns: Record<Team, Vec[]>;
  pveSpawns: Vec[];
  pveBossSpawn: Vec;
}

const sideHomes = { blue: {x:145,y:270}, red:{x:815,y:270} };
const sideSpawns = { blue:[{x:70,y:270},{x:70,y:310}], red:[{x:890,y:270},{x:890,y:310}] };
const cornerHomes = {blue:{x:145,y:120},red:{x:815,y:120},green:{x:145,y:420},violet:{x:815,y:420}};
const cornerSpawns = {blue:[{x:70,y:95},{x:70,y:145}],red:[{x:890,y:95},{x:890,y:145}],green:[{x:70,y:395},{x:70,y:445}],violet:[{x:890,y:395},{x:890,y:445}]};
const pveSpawns=[{x:45,y:90},{x:45,y:270},{x:45,y:450},{x:915,y:90},{x:915,y:270},{x:915,y:450},{x:480,y:45},{x:480,y:495}];
const pveBossSpawn={x:480,y:55};
const common = {sideHomes,sideSpawns,cornerHomes,cornerSpawns,pveSpawns,pveBossSpawn} as const;
export const MAPS: Record<MapId, MapDefinition> = {
  courtyard: {id:'courtyard',name:'Patio del Rey',description:'Rutas abiertas para aprender y comparar clases.',theme:'stone',...common,walls:[
    {x:245,y:116,w:52,h:96},{x:245,y:328,w:52,h:96},{x:663,y:116,w:52,h:96},{x:663,y:328,w:52,h:96},{x:423,y:164,w:114,h:42},{x:423,y:334,w:114,h:42}],bushes:[]},
  forest: {id:'forest',name:'Bosque de Emboscadas',description:'Un claro central y rutas laterales cubiertas por vegetación.',theme:'forest',...common,walls:[
    {x:270,y:205,w:44,h:130},{x:646,y:205,w:44,h:130},{x:410,y:95,w:140,h:38},{x:410,y:407,w:140,h:38}],bushes:[
    {id:'f1',x:160,y:80,w:170,h:70},{id:'f2',x:630,y:80,w:170,h:70},{id:'f3',x:160,y:390,w:170,h:70},{id:'f4',x:630,y:390,w:170,h:70}]},
  ruins: {id:'ruins',name:'Ruinas del Bastión',description:'Tres corredores conectados y encuentros a corta distancia.',theme:'ruins',...common,walls:[
    {x:205,y:80,w:55,h:150},{x:205,y:310,w:55,h:150},{x:700,y:80,w:55,h:150},{x:700,y:310,w:55,h:150},{x:370,y:185,w:220,h:42},{x:370,y:313,w:220,h:42}],bushes:[
    {id:'r1',x:275,y:235,w:145,h:70},{id:'r2',x:540,y:235,w:145,h:70}]},
  crossroads: {id:'crossroads',name:'Encrucijada',description:'Plaza abierta, diagonales rápidas y cobertura pequeña.',theme:'crossroads',...common,walls:[
    {x:300,y:150,w:60,h:60},{x:600,y:150,w:60,h:60},{x:300,y:330,w:60,h:60},{x:600,y:330,w:60,h:60}],bushes:[
    {id:'c1',x:245,y:215,w:100,h:45},{id:'c2',x:615,y:215,w:100,h:45},{id:'c3',x:245,y:280,w:100,h:45},{id:'c4',x:615,y:280,w:100,h:45}]},
};
export const MAP_IDS = Object.keys(MAPS) as MapId[];
export const DEFAULT_MAP: MapId = 'courtyard';
export const validMap = (value: unknown): value is MapId => typeof value === 'string' && MAP_IDS.includes(value as MapId);
export const MODE_INFO: Record<GameMode,{name:string;maxPlayers:number;kind:'duel'|'teams'|'ffa'|'pve'}> = {
  duel:{name:'Duelo 1v1',maxPlayers:2,kind:'duel'},teams:{name:'Equipos 2v2',maxPlayers:4,kind:'teams'},
  ffa3:{name:'Todos contra todos · 3',maxPlayers:3,kind:'ffa'},ffa4:{name:'Todos contra todos · 4',maxPlayers:4,kind:'ffa'},
  pve:{name:'Hordas PvE · 1–4',maxPlayers:4,kind:'pve'},
};
export const GAME_MODES = Object.keys(MODE_INFO) as GameMode[];
export const DEFAULT_MODE: GameMode = 'duel';
export const validMode = (value:unknown): value is GameMode => typeof value === 'string' && GAME_MODES.includes(value as GameMode);
export const pointBush = (map:MapDefinition,p:Vec) => map.bushes.find(b=>p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h)?.id ?? null;
