import { describe, expect, it } from 'vitest';
import { Duel, RULES, idleInput } from '@bandera/shared';
import { World, newCharacter, INCANTATION_TIME } from '@bandera/shared/world';
import { SKILLS_WORLD } from '@bandera/shared/rpg/skills';

const ticks = (seconds:number) => Math.ceil(seconds/RULES.tick);
const advance = (duel:Duel,n:number) => {for(let i=0;i<n;i++)duel.step(new Map());};
const cast = (duel:Duel,x=480,y=270) => {
  const input=idleInput(1);input.slots.skill2.pressed=true;input.aimX=x;input.aimY=y;
  duel.step(new Map([['a',input]]));
};
function arena(mode:'duel'|'teams'|'ffa3'='duel'){
  const duel=new Duel('courtyard',mode);
  const mage=duel.add('a','Mago','mage');
  const enemy=duel.add('b','Enemigo','guardian');
  duel.state.phase='playing';
  Object.assign(mage,{x:370,y:270});
  Object.assign(enemy,{x:570,y:270});
  return {duel,mage,enemy};
}

describe('Singularidad en la arena',()=>{
  it('fija el destino al comenzar y viaja a 420 u/s aunque cambie el apuntado',()=>{
    const {duel,mage}=arena();
    cast(duel,700,270);
    expect(mage.blackHoleX).toBeCloseTo(700);
    expect(mage.blackHoleY).toBeCloseTo(270);
    for(let i=0;i<ticks(2)+1;i++)duel.step(new Map([['a',{...idleInput(),aimX:100,aimY:100}]]));
    expect(duel.state.blackHoles[0]).toMatchObject({targetX:700,targetY:270,traveling:true,currentRadius:40});
    const start=duel.state.blackHoles[0].x;
    advance(duel,ticks(0.5));
    expect(duel.state.blackHoles[0].x-start).toBeCloseTo(210,0);
    advance(duel,ticks(0.4));
    expect(duel.state.blackHoles[0]).toMatchObject({x:700,y:270,traveling:false});
  });
  it('bloquea movimiento y ataque durante dos segundos, sin interrumpirse por golpe o stun',()=>{
    const {duel,mage,enemy}=arena();
    cast(duel);
    expect(mage.blackHoleCd).toBe(RULES.blackHoleCooldown);
    expect(mage.blackHoleCast).toBe(RULES.blackHoleCast);
    mage.magicShieldHits=0;mage.hp=10;
    duel.damage(mage,enemy,0,0.5);
    const x=mage.x;
    mage.stunLeft=0.8;
    for(let i=0;i<ticks(1);i++)duel.step(new Map([['a',{...idleInput(),x:1,shot:true}]]));
    expect(mage.x).toBe(x);
    expect(duel.state.arrows).toHaveLength(0);
    expect(mage.blackHoleCast).toBeGreaterThan(0);
    advance(duel,ticks(1)+1);
    expect(duel.state.blackHoles).toHaveLength(1);
    expect(duel.state.blackHoles[0]).toMatchObject({targetX:480,targetY:270,radius:200,owner:'a'});
  });
  it('arrastra enemigos y explota al final; el agujero persiste si muere el mago',()=>{
    const {duel,mage,enemy}=arena();
    cast(duel);advance(duel,ticks(2));
    const first=enemy.x;
    advance(duel,ticks(3));
    expect(enemy.x).toBeLessThan(first);
    mage.magicShieldHits=0;duel.damage(mage,enemy,0,100);
    expect(mage.hp).toBe(0);
    expect(duel.state.blackHoles).toHaveLength(1);
    const before=enemy.hp;
    advance(duel,ticks(2)+2);
    expect(duel.state.blackHoles).toHaveLength(0);
    expect(enemy.hp).toBeLessThan(before);
    expect(duel.state.events.some(e=>e.kind==='explosion'&&e.skillId==='mage.blackHole')).toBe(true);
  });
  it('morir durante el casteo lo cancela sin devolver la recarga',()=>{
    const {duel,mage,enemy}=arena();cast(duel);
    mage.magicShieldHits=0;duel.damage(mage,enemy,0,100);
    expect(mage.blackHoleCast).toBe(0);
    expect(mage.blackHoleCd).toBeGreaterThan(0);
    advance(duel,ticks(2)+1);
    expect(duel.state.blackHoles).toHaveLength(0);
  });
  it('atrae durante el viaje, crece al llegar y desintegra solo bajas de la explosión',()=>{
    const {duel,mage,enemy}=arena();
    Object.assign(enemy,{x:420,y:270,hp:1,invuln:0});
    cast(duel,700,270);
    advance(duel,ticks(2)+1);
    const hole=duel.state.blackHoles[0];
    const before=enemy.x;
    advance(duel,ticks(0.1));
    expect(hole.traveling).toBe(true);
    expect(enemy.x).not.toBe(before);
    expect(hole.currentRadius).toBe(RULES.blackHoleStartRadius);
    advance(duel,ticks(0.8));
    expect(hole.traveling).toBe(false);
    advance(duel,ticks(2));
    expect(hole.currentRadius).toBeGreaterThan(100);
    Object.assign(enemy,{x:700,y:270,hp:1,invuln:0});
    advance(duel,ticks(2)+2);
    expect(duel.state.events.some(e=>e.kind==='disintegrate'&&e.skillId==='mage.blackHole')).toBe(true);
  });
  it('en 2v2 respeta aliados y limpia el agujero al reiniciar',()=>{
    const {duel,mage}=arena('teams');
    const ally=duel.add('c','Aliado','guardian');
    Object.assign(ally,{x:560,y:270});
    cast(duel);advance(duel,ticks(2));
    const before={x:ally.x,hp:ally.hp};
    advance(duel,ticks(4)+2);
    expect(ally.x).toBe(before.x);
    expect(ally.hp).toBe(before.hp);
    cast(duel);duel.resetArena();expect(duel.state.blackHoles).toHaveLength(0);
    expect(mage.blackHoleCast).toBe(0);
  });
  it('en FFA atrae a cada rival y el tirón no atraviesa un muro',()=>{
    const {duel}=arena('ffa3');
    const third=duel.add('c','Tercero','guardian');
    Object.assign(third,{x:390,y:270});
    const walled=duel.state.players.find(p=>p.id==='b')!;
    Object.assign(walled,{x:480,y:145});
    cast(duel);advance(duel,ticks(2));
    const thirdX=third.x;
    advance(duel,ticks(1));
    expect(third.x).toBeGreaterThan(thirdX);
    expect(walled.y).toBeLessThanOrEqual(152.01);
  });
});

describe('Singularidad en Lugunica',()=>{
  it('exige bastón, usa incantación y limita el punto apuntado a 360 unidades',()=>{
    const skill=SKILLS_WORLD.singularidad;
    const make=(weapon:'baston'|'espada')=>{
      const world=new World('umbral');
      const character=newCharacter('h','cuenta','Mago','guardian',{sparks:{sombra:3},weapon},{skillId:'singularidad',rarity:skill.rarity});
      const player=world.join(character);player.invuln=999;
      return {world,player};
    };
    const barred=make('espada');
    barred.world.cast('h','e',{x:barred.player.x+200,y:barred.player.y});
    barred.world.step(new Map());
    expect(barred.world.state.blackHoles).toHaveLength(0);
    expect(barred.world.notices.some(n=>n.kind==='denied')).toBe(true);
    const {world,player}=make('baston');
    const origin={x:player.x,y:player.y};
    world.cast('h','e',{x:player.x+900,y:player.y});
    world.step(new Map());
    expect(world.state.blackHoles).toHaveLength(0);
    expect(world.notices.some(n=>n.kind==='callout')).toBe(true);
    advance(world,ticks(INCANTATION_TIME)+1);
    expect(world.state.blackHoles).toHaveLength(1);
    expect(Math.hypot(world.state.blackHoles[0].targetX-origin.x,world.state.blackHoles[0].targetY-origin.y)).toBeLessThanOrEqual(360.01);
    const hole=world.state.blackHoles[0];
    advance(world,ticks(1));
    const monster=world.state.zombies.find(z=>z.family&&z.hp>0);
    expect(monster).toBeDefined();
    Object.assign(monster!,{x:hole.x+30,y:hole.y});
    const before=monster!.x;
    (world as unknown as {stepBlackHoles(dt:number):void}).stepBlackHoles(RULES.tick);
    expect(monster!.x).toBeLessThan(before);
  });
});
