import { describe, expect, it } from 'vitest';
import { CLASSES, Duel, RULES, blackHoleStats, idleInput, type Input, type SlotInputState } from '@bandera/shared';
import { World, newCharacter, INCANTATION_TIME } from '@bandera/shared/world';
import { SKILLS_WORLD } from '@bandera/shared/rpg/skills';

const ticks = (seconds:number) => Math.ceil(seconds/RULES.tick);
const advance = (duel:Duel,n:number) => {for(let i=0;i<n;i++)duel.step(new Map());};
type Aim = {x:number;y:number};
/** The mage's Singularidad key (skill2 by default) in one state, aiming at a map point. */
const key = (state:Partial<SlotInputState>,aim:Aim={x:480,y:270},extra:Partial<Input>={}) => {
  const input={...idleInput(1),aimX:aim.x,aimY:aim.y,...extra};
  input.slots.skill2={pressed:false,held:false,released:false,...state};
  return input;
};
const send = (duel:Duel,input:Input) => duel.step(new Map([['a',input]]));
/** Presses and keeps holding for this long. */
const hold = (duel:Duel,seconds:number,aim?:Aim,extra:Partial<Input>={}) => {
  send(duel,key({pressed:true,held:true},aim,extra));
  for(let i=1;i<ticks(seconds);i++)send(duel,key({held:true},aim,extra));
};
const release = (duel:Duel,aim?:Aim) => send(duel,key({released:true},aim));
const cast = (duel:Duel,seconds:number,aim?:Aim) => {hold(duel,seconds,aim);release(duel,aim);};
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
  it('la carga agranda el agujero, su daño y su alcance; la recarga empieza al soltar',()=>{
    const tap=arena();
    tap.duel.step(new Map([['a',key({pressed:true,released:true},{x:950,y:270})]]));
    const small=tap.duel.state.blackHoles[0];
    const tapped=blackHoleStats(RULES.tick);
    expect(small).toMatchObject({startRadius:tapped.startRadius,burstRadius:tapped.burstRadius,damage:tapped.damage,traveling:true});
    expect(small.targetX-370).toBeCloseTo(tapped.range);

    const {duel,mage}=arena();
    hold(duel,1,{x:950,y:270});
    expect(mage.blackHoleCharge).toBeCloseTo(1,1);
    expect(mage.blackHoleCd).toBe(0);
    expect(duel.state.blackHoles).toHaveLength(0);
    expect(duel.state.events.some(e=>e.kind==='cast'&&e.skillId==='mage.blackHole')).toBe(true);
    hold(duel,2,{x:950,y:270});
    expect(mage.blackHoleCharge).toBe(RULES.blackHoleChargeTime);
    release(duel,{x:950,y:270});
    expect(mage.blackHoleCharge).toBe(0);
    expect(mage.blackHoleCd).toBe(RULES.blackHoleCooldown);
    const big=duel.state.blackHoles[0];
    expect(big).toMatchObject({startRadius:RULES.blackHoleStartMax,radius:RULES.blackHoleGrowMax,burstRadius:RULES.blackHoleBurstMax,damage:RULES.blackHoleDamageMax});
    expect(big.targetX-370).toBeCloseTo(RULES.blackHoleRangeMax);
    expect(big.startRadius).toBeGreaterThan(small.startRadius);
  });
  it('viaja al cursor si está a su alcance y no lo sigue después',()=>{
    const {duel}=arena();
    cast(duel,2,{x:700,y:270});
    expect(duel.state.blackHoles[0]).toMatchObject({targetX:700,targetY:270,traveling:true});
    const start=duel.state.blackHoles[0].x;
    for(let i=0;i<ticks(0.5);i++)send(duel,{...idleInput(),aimX:100,aimY:100});
    expect(duel.state.blackHoles[0].x-start).toBeCloseTo(RULES.blackHoleTravelSpeed*0.5,0);
    advance(duel,ticks(0.4));
    expect(duel.state.blackHoles[0]).toMatchObject({x:700,y:270,traveling:false});
  });
  it('mientras carga el mago camina a media velocidad y no ataca',()=>{
    const {duel,mage}=arena();
    const fire=key({pressed:true,held:true},undefined,{x:1});
    fire.slots.primary={pressed:true,held:true,released:true};
    send(duel,fire);
    for(let i=1;i<ticks(0.5);i++){
      const input=key({held:true},undefined,{x:1});input.slots.primary={pressed:true,held:true,released:true};send(duel,input);
    }
    expect(mage.x-370).toBeCloseTo(CLASSES.mage.speed*RULES.chargeMoveSpeed*ticks(0.5)*RULES.tick);
    expect(duel.state.arrows).toHaveLength(0);
    expect(mage.blackHoleCharge).toBeGreaterThan(0);
  });
  it('estalla al tocar un muro, con el radio de su carga',()=>{
    const {duel,enemy}=arena();
    Object.assign(enemy,{x:450,y:236,invuln:0});
    cast(duel,2,{x:480,y:185});
    advance(duel,ticks(0.4));
    expect(duel.state.blackHoles).toHaveLength(0);
    const burst=duel.state.events.find(e=>e.kind==='explosion'&&e.skillId==='mage.blackHole')!;
    expect(burst.radius).toBe(RULES.blackHoleBurstMax);
    expect(burst.y).toBeGreaterThan(206);
    expect(burst.x).toBeLessThan(480);
    expect(enemy.hp).toBeLessThan(enemy.maxHp);
  });
  it('volver a pulsar lo detona en pleno viaje sin empezar otra carga',()=>{
    const {duel,mage,enemy}=arena();
    cast(duel,2,{x:950,y:270});
    advance(duel,2);
    const hole=duel.state.blackHoles[0];
    expect(hole.traveling).toBe(true);
    Object.assign(enemy,{x:hole.x+40,y:hole.y,invuln:0});
    send(duel,key({pressed:true,held:true}));
    expect(duel.state.blackHoles).toHaveLength(0);
    expect(enemy.hp).toBe(enemy.maxHp-RULES.blackHoleDamageMax);
    send(duel,key({held:true}));
    expect(mage.blackHoleCharge).toBe(0);
    expect(mage.blackHoleCd).toBeGreaterThan(0);
  });
  it('en destino crece, atrae y estalla tras su espera; persiste si muere el mago',()=>{
    const {duel,mage,enemy}=arena();
    cast(duel,2);
    advance(duel,ticks(0.5));
    const hole=duel.state.blackHoles[0];
    expect(hole.traveling).toBe(false);
    const first=enemy.x;
    advance(duel,ticks(1));
    expect(hole.currentRadius).toBeGreaterThan(hole.startRadius);
    expect(enemy.x).toBeLessThan(first);
    mage.magicShieldHits=0;duel.damage(mage,enemy,0,100);
    expect(mage.hp).toBe(0);
    expect(duel.state.blackHoles).toHaveLength(1);
    const before=enemy.hp;
    advance(duel,ticks(RULES.blackHoleLinger));
    expect(duel.state.blackHoles).toHaveLength(0);
    expect(enemy.hp).toBeLessThan(before);
    expect(duel.state.events.some(e=>e.kind==='explosion'&&e.skillId==='mage.blackHole')).toBe(true);
  });
  it('un aturdimiento, morir o soltar sin lanzar cortan la carga sin gastar la recarga',()=>{
    const stunned=arena();
    hold(stunned.duel,1);
    stunned.mage.stunLeft=0.5;
    send(stunned.duel,key({held:true}));
    expect(stunned.mage.blackHoleCharge).toBe(0);
    expect(stunned.mage.blackHoleCd).toBe(0);

    const dead=arena();
    hold(dead.duel,1);
    dead.mage.magicShieldHits=0;dead.duel.damage(dead.mage,dead.enemy,0,100);
    expect(dead.mage.blackHoleCharge).toBe(0);
    expect(dead.mage.blackHoleCd).toBe(0);

    const cancelled=arena();
    hold(cancelled.duel,1);
    send(cancelled.duel,key({}));
    expect(cancelled.mage.blackHoleCharge).toBe(0);
    expect(cancelled.mage.blackHoleCd).toBe(0);
    advance(cancelled.duel,ticks(1));
    expect(cancelled.duel.state.blackHoles).toHaveLength(0);
  });
  it('en 2v2 respeta aliados y limpia el agujero al reiniciar',()=>{
    const {duel,mage}=arena('teams');
    const ally=duel.add('c','Aliado','guardian');
    Object.assign(mage,{x:370,y:270});
    Object.assign(ally,{x:560,y:270});
    cast(duel,2);
    const before={x:ally.x,hp:ally.hp};
    advance(duel,ticks(RULES.blackHoleLinger+1));
    expect(ally.x).toBe(before.x);
    expect(ally.hp).toBe(before.hp);
    mage.blackHoleCd=0;
    cast(duel,1);duel.resetArena();expect(duel.state.blackHoles).toHaveLength(0);
    hold(duel,1);duel.resetArena();expect(mage.blackHoleCharge).toBe(0);
  });
  it('en FFA atrae a cada rival y el tirón no atraviesa un muro',()=>{
    const {duel,mage}=arena('ffa3');
    const third=duel.add('c','Tercero','guardian');
    // A third player respawns everyone in their corner: place the bodies afterwards.
    Object.assign(mage,{x:370,y:270});
    Object.assign(third,{x:430,y:270});
    const walled=duel.state.players.find(p=>p.id==='b')!;
    Object.assign(walled,{x:480,y:145});
    cast(duel,2);
    advance(duel,ticks(0.3));
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
