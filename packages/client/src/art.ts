import { MAGE_SKINS, type ClassId, type MobKind } from '@bandera/shared';
// Original pixel matrices: 0 outline, 1 steel, 2 shadow, 3 cloth, 4 highlight,
// 5 leather, 6 blade, 7 skin, 8 boots. Shared by class cards and in-game sprites.
export const CLASS_ART: Record<ClassId, string[]> = {
  archer: [
    '.....3333.......','....333343......','...33333343.....','...33277233.....',
    '....327723......','.....5555.......','...33333333.....','..3333444333....',
    '..7333444337....','..77335553377...','...33333333.....','....335533......',
    '....335533......','....55..55......','....55..55......','....88..88......',
  ],
  mage: [
    '......44........','.....4444.......','....433334......','...43333334.....',
    '...33277233.....','....327723......','.....5555.......','...33344333.....',
    '..3333444333....','.733334433337...','.773333333377...','...33355333.....',
    '....335533......','....33..33......','....88..88......','....88..88......',
  ],
  necromancer: [
    '.....0000.......','....033330......','...03333330.....','...03277230.....',
    '...03747430.....','....032230......','...33333333.....','..3334443333....',
    '.73333433337....','.77333433377....','..333343333.....','..333333333.....',
    '..332222233.....','..333333333.....','...3333333......','....88..88......',
  ],
  guardian: [
    '.....1111.......','....111111......','...01111110.....','...01222210.....',
    '...01222210.....','....011110......','...33111133.....','..3331661333....',
    '.733316613337...','.773316613377...','...33166133.....','....334433......',
    '....110011......','....110011......','....88..88......','....88..88......',
  ],
  vanguard: [
    '.....4444.......','....011110......','...01111110.....','...01222210.....',
    '...01122110.....','....011110......','..1111111111....','.011111111110...',
    '.011136631110...','.711136631117...','.771136631177...','..1113333111....',
    '...11100111.....','...11100111.....','...11100111.....','...888..888.....',
  ],
};
export function mageSkinArt(skinId?:string):string[]{
  const skin=MAGE_SKINS.find(item=>item.id===skinId),rows=[...CLASS_ART.mage];
  if(!skin)return rows;
  if(skin.silhouette==='crown'){rows[0]='....4.44.4......';rows[1]='.....4444.......';}
  if(skin.silhouette==='hood'){rows[0]='.....33333......';rows[1]='....334433......';rows[2]='...33333333.....';}
  if(skin.silhouette==='armor'){rows[6]='..1113333111....';rows[7]='.111334433111...';rows[8]='11133444333111..';}
  if(skin.silhouette==='turban'){rows[0]='....444444......';rows[1]='...43333334.....';rows[2]='....433334......';}
  if(skin.silhouette==='horns'){rows[0]='...4..44..4.....';rows[1]='....433334......';}
  return rows;
}
// Hunched ghoul: rotting skin (7), sockets and jaw (2), glowing red eyes (9), exposed
// ribs and teeth (6), rags dyed in the summoner's color (3) and long clawed arms.
export const ZOMBIE_ART: string[] = [
  '................','......7777......','.....777777.....','....77979777....',
  '....77722777....','.....762267.....','...3333333333...','..773626263377..',
  '.7773626263.777.','77..336263..77..','....333333......','....33.3.33.....',
  '....77...77.....','...77.....77....','...88.....88....','................',
];
/** Hostile PvE creatures use the same 16×16 pixel grammar as necromancer summons. */
export const PVE_MOB_ART: Record<MobKind, string[]> = {
  zombie: ZOMBIE_ART,
  wolf: ["................", "............77..", "..77.......777..", ".0777.....07770.", ".07777777777770.", ".07777222777770.", "..077799777770..", "...0777777770...", "....077777770...", "..777777777777..", ".07777555577770.", ".0777......7770.", "..77.......77...", "..88.......88...", ".88.........88..", "................"],
  skeleton: [".....00000......", "....0666660.....", "....0696960.....", "....0662660.....", ".....06660......", "......060.......", "....00666000....", "...06.6666.60...", "..06..6666..60..", "..0...6336...0..", "......6336......", "......6336......", ".....06..60.....", "....06....60....", "...08......80...", "................"],
  brute: ["....00000000....", "...0777777770...", "..077799997770..", "..077722227770..", "...077777770....", "..001111111100..", ".01113333331110.", "0111334444331110", "0771333333331770", "0771336666331770", ".01133333333110.", "..0133553310....", "...11100111.....", "...11100111.....", "..0880..0880....", "................"],
  cryptGuardian: ["..4..000000..4..", "...4001111004...", "...0111111110...", "..011122221110..", "..011199991110..", "...011111110....", "..001113311100..", ".01133344333110.", "0111334444331110", "0771336666331770", ".01133333333110.", "..01135533110...", "..1111001111....", "..1111001111....", ".08880..08880...", "................"],
};
export function palette(cloth: string, light: string): Record<string,string> {
  return {0:'#26353b',1:'#a9b7b8',2:'#17272d',3:cloth,4:light,5:'#796452',6:'#e3e5d5',7:'#d1a77f',8:'#423b38',9:'#000000',A:'#000000',B:'#000000',C:'#000000',D:'#000000',E:'#000000',F:'#000000'};
}
export function zombiePalette(cloth: string, light: string): Record<string,string> {
  return {...palette(cloth, light), 2:'#1d241c', 6:'#d6cfb3', 7:'#7f9a6e', 9:'#ff4a3d'};
}
export function pveMobPalette(kind: MobKind): Record<string, string> {
  if (kind === 'wolf') return {...palette('#58382f', '#c38b61'), 0:'#201a19', 2:'#35251f', 7:'#78543e', 9:'#ff5a42'};
  if (kind === 'skeleton') return {...palette('#6e2730', '#c85d55'), 0:'#24201e', 1:'#d8d0b7', 2:'#5d5448', 6:'#e8e0c8', 7:'#b8aa8d', 9:'#ff493d'};
  if (kind === 'brute') return {...zombiePalette('#71312d', '#ca6250'), 0:'#202723', 1:'#737a71', 4:'#d48a61', 7:'#708962', 9:'#ff493d'};
  if (kind === 'cryptGuardian') return {...zombiePalette('#55265f', '#be79d1'), 0:'#17131c', 1:'#74717c', 2:'#24182a', 4:'#d08ce3', 7:'#65725f', 9:'#ff395c'};
  return {...zombiePalette('#6e2b2b', '#c55c50'), 0:'#1d211d', 3:'#6e2b2b', 4:'#c55c50', 9:'#ff493d'};
}
export function classIllustration(classId:ClassId,skinId?:string):string {
  const skin=classId==='mage'?MAGE_SKINS.find(item=>item.id===skinId):undefined;
  const colors=palette(skin?.cloth??'#64897e',skin?.light??'#b6cbb0');
  const pixels=(classId==='mage'?mageSkinArt(skinId):CLASS_ART[classId]).flatMap((row,y)=>row.split('').map((c,x)=>c==='.'?'':`<rect x="${x+5}" y="${y+3}" width="1" height="1" fill="${colors[c]}"/>`)).join('');
  const weapon=classId==='archer'?'<path d="M22 6Q30 13 22 20M22 6V20" stroke="#eac787" fill="none"/><path d="M22 13H29" stroke="#ede7d1"/>':classId==='mage'?`<path d="M24 5V21" stroke="#796452" stroke-width="2"/><path d="M24 4L27 7L24 10L21 7Z" fill="${skin?.accent??'#9edcff'}" stroke="#e8f7ff"/><circle cx="24" cy="7" r="1" fill="#fff"/>`:classId==='necromancer'?'<path d="M24 6V21" stroke="#4a3a2b" stroke-width="2"/><circle cx="24" cy="6" r="2.5" fill="#e8e2c8"/><path d="M23 6H23.5M24.5 6H25" stroke="#26353b"/><circle cx="24" cy="2.5" r="1.5" fill="#f08a4b"/>':classId==='guardian'?'<path d="M20 11H27V17L23.5 20L20 17Z" fill="#eac787" stroke="#655940"/><path d="M23.5 12V17M21 14H26" stroke="#596f63"/>':'<path d="M23 2L25 4V18H23Z" fill="#e3e5d5"/><path d="M20 17H28V19H20ZM23 19H25V23H23Z" fill="#eac787"/>';
  return `<svg viewBox="0 0 32 25" aria-hidden="true" shape-rendering="crispEdges">${pixels}${weapon}</svg>`;
}
// The necromancer zombie is a revived person: wide-brimmed hat banded in the summoner's
// color (3), grey-green corpse skin (7) with stitched cheeks (1), sunken glowing eyes (9),
// a torn robe showing ribs (6). Arms and staff are drawn separately so they can move.
export const HAT_ZOMBIE_ART: string[] = [
  '......0000......','......0330......','...0000000000...','.....777777.....',
  '.....797797.....','.....771177.....','......7267......','.....335533.....',
  '....33262633....','....33626233....','....33333333....','....333.3333....',
  '.....33..33.....','.....77..77.....','....88....88....','................',
];
export function hatPalette(cloth: string, light: string): Record<string,string> {
  return {...zombiePalette(cloth, light), 0:'#15101c', 1:'#2a1f1f', 2:'#1d241c', 5:'#4d3a2c', 6:'#d6cfb3', 7:'#8c9a82', 9:'#ff4a3d'};
}
/** A raised thrall keeps its class silhouette with grey skin and violet ghost-light. */
export function undeadPalette(cloth: string, light: string): Record<string,string> {
  return {...palette(cloth, light), 2:'#141c17', 4:'#c47bff', 5:'#4d4238', 7:'#8a9a86', 8:'#2a2622'};
}
