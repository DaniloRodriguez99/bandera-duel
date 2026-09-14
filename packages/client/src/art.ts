import { type ClassId } from '@bandera/shared';
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
// Hunched ghoul: rotting skin (7), sockets and jaw (2), glowing red eyes (9), exposed
// ribs and teeth (6), rags dyed in the summoner's color (3) and long clawed arms.
export const ZOMBIE_ART: string[] = [
  '................','......7777......','.....777777.....','....77979777....',
  '....77722777....','.....762267.....','...3333333333...','..773626263377..',
  '.7773626263.777.','77..336263..77..','....333333......','....33.3.33.....',
  '....77...77.....','...77.....77....','...88.....88....','................',
];
export function palette(cloth: string, light: string): Record<string,string> {
  return {0:'#26353b',1:'#a9b7b8',2:'#17272d',3:cloth,4:light,5:'#796452',6:'#e3e5d5',7:'#d1a77f',8:'#423b38',9:'#000000',A:'#000000',B:'#000000',C:'#000000',D:'#000000',E:'#000000',F:'#000000'};
}
export function zombiePalette(cloth: string, light: string): Record<string,string> {
  return {...palette(cloth, light), 2:'#1d241c', 6:'#d6cfb3', 7:'#7f9a6e', 9:'#ff4a3d'};
}
export function classIllustration(classId:ClassId):string {
  const colors=palette('#64897e','#b6cbb0');
  const pixels=CLASS_ART[classId].flatMap((row,y)=>row.split('').map((c,x)=>c==='.'?'':`<rect x="${x+5}" y="${y+3}" width="1" height="1" fill="${colors[c]}"/>`)).join('');
  const weapon=classId==='archer'?'<path d="M22 6Q30 13 22 20M22 6V20" stroke="#eac787" fill="none"/><path d="M22 13H29" stroke="#ede7d1"/>':classId==='mage'?'<path d="M24 5V21" stroke="#796452" stroke-width="2"/><path d="M24 4L27 7L24 10L21 7Z" fill="#9edcff" stroke="#e8f7ff"/><circle cx="24" cy="7" r="1" fill="#fff"/>':classId==='necromancer'?'<path d="M24 6V21" stroke="#4a3a2b" stroke-width="2"/><circle cx="24" cy="6" r="2.5" fill="#e8e2c8"/><path d="M23 6H23.5M24.5 6H25" stroke="#26353b"/><circle cx="24" cy="2.5" r="1.5" fill="#f08a4b"/>':classId==='guardian'?'<path d="M20 11H27V17L23.5 20L20 17Z" fill="#eac787" stroke="#655940"/><path d="M23.5 12V17M21 14H26" stroke="#596f63"/>':'<path d="M23 2L25 4V18H23Z" fill="#e3e5d5"/><path d="M20 17H28V19H20ZM23 19H25V23H23Z" fill="#eac787"/>';
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
