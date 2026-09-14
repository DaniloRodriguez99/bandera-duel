import { describe,it,expect } from 'vitest';
import { Duel, CLASSES, CLASS_IDS, RULES, HOMES, newPlayer, movePlayer, idleInput, type ClassId, type Input, type Player } from '@bandera/shared';
function setup(a:ClassId='guardian',b:ClassId='archer') {
  const d=new Duel(),p=d.add('a','A',a),q=d.add('b','B',b);d.state.phase='playing';
  Object.assign(p,{x:420,y:270,angle:0});Object.assign(q,{x:470,y:270,angle:Math.PI});return {d,p,q};
}
function input(options:Partial<Input>={}):Input{return {...idleInput(),...options};}
function step(d:Duel,p:Player,options:Partial<Input>={},count=1){for(let i=0;i<count;i++)d.step(new Map([[p.id,input(options)]]));}
describe('clases y persistencia',()=>{
  it.each(CLASS_IDS)('%s usa vida y velocidad propias, incluida penalización de bandera',id=>{
    const p=newPlayer('p','P','blue',id);const x=p.x;movePlayer(p,input({x:1}),false,1/30);expect(p.x-x).toBeCloseTo(CLASSES[id].speed/30);expect(p.hp).toBe(CLASSES[id].hp);expect(p.maxHp).toBe(p.hp);
    const q=newPlayer('q','Q','red',id);const qx=q.x;movePlayer(q,input({x:-1}),true);expect(qx-q.x).toBeCloseTo(CLASSES[id].speed*.85/30);
  });
  it('clase inicial, cambio compartido de listo y bloqueo de selección',()=>{
    const d=new Duel(),p=d.add('a','A'),q=d.add('b','B');expect(p.classId).toBe('guardian');d.ready(p.id);expect(p.ready).toBe(true);
    expect(d.selectClass(q.id,'vanguard')).toBe(true);expect(p.ready).toBe(false);expect(q.maxHp).toBe(5);
    d.ready(p.id);d.ready(q.id);expect(d.selectClass(p.id,'archer')).toBe(false);d.state.phase='playing';expect(d.selectClass(q.id,'archer')).toBe(false);
    d.finish('blue','tiempo');d.ready(p.id);d.selectClass(q.id,'archer');expect(d.state.players.every(p=>!p.ready)).toBe(true);
  });
  it.each(CLASS_IDS)('%s persiste en captura, muerte y revancha',id=>{
    const {d,p,q}=setup(id);Object.assign(p,HOMES.blue);Object.assign(d.state.flags[1],{status:'carried',carrier:p.id});d.step(new Map());
    let own=d.state.players[0];expect(own.classId).toBe(id);expect(own.hp).toBe(CLASSES[id].hp);
    d.state.phase='playing';own.magicShieldHits=0;d.damage(own,q,0,99);expect(own.hp).toBe(0);step(d,q,{},91);expect(own.classId).toBe(id);expect(own.hp).toBe(CLASSES[id].hp);
    d.finish('draw','tiempo');d.ready('a');d.ready('b');expect(d.state.players[0].classId).toBe(id);
  });
});
describe('armas y permisos',()=>{
  it.each(CLASS_IDS.filter(id=>CLASSES[id].melee))('%s: daño, alcance y preparación cuerpo a cuerpo',id=>{
    const {d,p,q}=setup(id,'vanguard');q.x=p.x+CLASSES[id].meleeRange-1;step(d,p,{sword:true});expect(q.hp).toBe(5);
    step(d,p,{},Math.ceil(CLASSES[id].windup/RULES.tick)+1);expect(q.hp).toBe(5-CLASSES[id].meleeDamage);
    const fresh=setup(id,'vanguard');fresh.q.x=fresh.p.x+CLASSES[id].meleeRange+1;step(fresh.d,fresh.p,{sword:true});step(fresh.d,fresh.p,{},12);expect(fresh.q.hp).toBe(5);
  });
  it.each(['guardian','vanguard'] as ClassId[])('%s rechaza flechas y dash',id=>{
    const {d,p}=setup(id);const x=p.x;step(d,p,{shot:true,dash:true});expect(d.state.arrows).toHaveLength(0);expect(p.x).toBe(x);expect(p.dashCd).toBe(0);
  });
  it.each(['archer','mage','necromancer','vanguard'] as ClassId[])('%s no puede cubrirse',id=>{const {d,p}=setup(id);step(d,p,{guard:true});expect(p.guarding).toBe(false);});
  it('el mago lanza fuego, rechaza báculo y puede esquivar',()=>{
    const {d,p,q}=setup('mage','vanguard');q.y=450;step(d,p,{shot:true});expect(d.state.arrows[0].classId).toBe('mage');
    step(d,p,{},28);Object.assign(q,{x:p.x+33,y:p.y});step(d,p,{sword:true});step(d,p,{},5);expect(q.hp).toBe(5);
    step(d,p,{},15);step(d,p,{dash:true});expect(p.dashCd).toBeGreaterThan(0);
  });
  it('flechas rápidas alcanzan como máximo 672 unidades',()=>{
    const {d,p,q}=setup('archer');p.x=80;q.y=450;step(d,p,{shot:true});const arrow=d.state.arrows[0];expect(arrow.x-80).toBeCloseTo(560/30);
    step(d,p,{},35);expect(arrow.x-80).toBeCloseTo(672);step(d,p);expect(d.state.arrows).toHaveLength(0);
  });
  it('la espada pesada tampoco atraviesa paredes',()=>{const {d,p,q}=setup('vanguard');Object.assign(p,{x:480,y:150});Object.assign(q,{x:480,y:219});step(d,p,{sword:true,angle:Math.PI/2});step(d,p,{},12);expect(q.hp).toBe(3);});
});
describe('escudo',()=>{
  it('el escudo mágico absorbe dos golpes de cualquier daño y dirección; el tercero hiere',()=>{
    const {d,p,q}=setup('mage','vanguard');
    expect(p.magicShieldHits).toBe(2);
    d.damage(p,q,0,2);expect(p.magicShieldHits).toBe(1);expect(p.hp).toBe(3);
    d.damage(p,q,Math.PI,.5);expect(p.magicShieldHits).toBe(0);expect(p.hp).toBe(3);expect(p.magicShieldCd).toBe(15);
    d.damage(p,q,0,1);expect(p.hp).toBe(2);
  });
  it('requiere 15 segundos desde la rotura y un nuevo clic; no repone un escudo activo',()=>{
    const {d,p,q}=setup('mage');d.damage(p,q,0);step(d,p,{guard:true});expect(p.magicShieldHits).toBe(1);
    d.damage(p,q,0);step(d,p,{guard:true},449);expect(p.magicShieldHits).toBe(0);expect(p.magicShieldCd).toBeGreaterThan(0);
    step(d,p,{guard:true},2);expect(p.magicShieldHits).toBe(0);
    step(d,p);step(d,p,{guard:true});expect(p.magicShieldHits).toBe(2);
  });
  it('conserva bandera y posición al absorber un impacto y renueva escudo al reiniciar',()=>{
    const {d,p,q}=setup('mage');Object.assign(d.state.flags[1],{status:'carried',carrier:p.id});
    const x=p.x;d.damage(p,q,0);expect(p.x).toBe(x);expect(d.state.flags[1].carrier).toBe(p.id);
    d.resetArena();expect(d.state.players[0].magicShieldHits).toBe(2);
  });
  it.each(CLASS_IDS.filter(id=>CLASSES[id].melee))('bloquea el golpe frontal de %s y conserva bandera y posición',attacker=>{
    const {d,p,q}=setup('guardian',attacker);Object.assign(q,{x:445,y:270});Object.assign(d.state.flags[1],{status:'carried',carrier:p.id});
    d.step(new Map([[p.id,input({guard:true})],[q.id,input({sword:true,angle:Math.PI})]]));
    step(d,p,{guard:true},12);expect(p.hp).toBe(3);expect(p.x).toBe(420);expect(d.state.flags[1].carrier).toBe(p.id);expect(d.state.events.some(e=>e.kind==='block')).toBe(true);
  });
  it.each([Math.PI,Math.PI/2,Math.PI/3+.05])('recibe daño fuera del arco: %s rad',direction=>{const {d,p,q}=setup();step(d,p,{guard:true});d.damage(p,q,direction+Math.PI,1);expect(p.hp).toBe(2);});
  it('bloquea flechas entrantes aunque el arquero se haya movido',()=>{
    const {d,p,q}=setup();q.x=520;d.step(new Map([[p.id,input({guard:true})],[q.id,input({shot:true,angle:Math.PI})]]));q.x=350;
    step(d,p,{guard:true},10);expect(p.hp).toBe(3);expect(d.state.arrows).toHaveLength(0);expect(d.state.events.some(e=>e.kind==='block')).toBe(true);
  });
  it('camina al 25%, puede girar, y combina penalización de bandera',()=>{const {d,p}=setup();Object.assign(d.state.flags[1],{status:'carried',carrier:p.id});const x=p.x;step(d,p,{guard:true,x:1,angle:1});expect(p.x-x).toBeCloseTo(180*.25*.85/30);expect(p.angle).toBe(1);});
  it('agota duración, recarga y exige soltar antes de reactivar',()=>{
    const {d,p}=setup();step(d,p,{guard:true},36);expect(p.guarding).toBe(true);step(d,p,{guard:true});expect(p.guarding).toBe(false);expect(p.guardCd).toBeCloseTo(1.5);
    step(d,p,{guard:true},50);expect(p.guarding).toBe(false);step(d,p);step(d,p,{guard:true});expect(p.guarding).toBe(true);
  });
  it('liberar inicia recarga y recuperación sin ataques encolados',()=>{const {d,p}=setup();step(d,p,{guard:true,sword:true});expect(p.windup).toBe(0);step(d,p,{sword:true});expect(p.guarding).toBe(false);expect(p.guardCd).toBeCloseTo(1.5);expect(p.windup).toBe(0);step(d,p,{},5);expect(p.windup).toBe(0);step(d,p,{sword:true});expect(p.windup).toBeGreaterThan(0);});
  it('no permite escudo durante preparación del golpe',()=>{const {d,p}=setup();step(d,p,{sword:true});step(d,p,{guard:true});expect(p.guarding).toBe(false);});
  it.each([false,true])('activar escudo en el tick del impacto es independiente del orden: %s',reverse=>{
    const {d,p,q}=setup('guardian','vanguard');q.x=445;q.windup=.01;q.swingAngle=Math.PI;if(reverse)d.state.players.reverse();step(d,p,{guard:true});expect(p.hp).toBe(3);
  });
});
describe('dash invulnerable',()=>{
  it('protege solo durante el dash y conserva la bandera sin empujón',()=>{
    const {d,p,q}=setup('archer');Object.assign(d.state.flags[1],{status:'carried',carrier:p.id});step(d,p,{dash:true});const x=p.x;d.damage(p,q,0);expect(p.hp).toBe(3);expect(p.x).toBe(x);expect(d.state.flags[1].carrier).toBe(p.id);
    step(d,p,{},5);expect(p.dashInvulnerable).toBe(false);d.damage(p,q,0);expect(p.hp).toBe(2);expect(d.state.flags[1].status).toBe('dropped');
  });
  it('no dispara ni da cuchilladas durante el dash, tampoco al terminar',()=>{const {d,p}=setup('archer');step(d,p,{dash:true,sword:true,shot:true});step(d,p,{sword:true,shot:true},3);step(d,p,{},4);expect(d.state.arrows).toHaveLength(0);expect(d.state.events.filter(e=>e.kind==='sword')).toHaveLength(0);step(d,p,{shot:true});expect(d.state.arrows).toHaveLength(1);});
  it('la recarga evita repetir dash y no borra otras protecciones',()=>{const {d,p}=setup('archer');p.invuln=1;step(d,p,{dash:true});expect(p.invuln).toBeGreaterThan(.9);step(d,p,{},5);step(d,p,{dash:true});expect(p.dashInvulnerable).toBe(false);expect(p.dashCd).toBeGreaterThan(1);});
});
