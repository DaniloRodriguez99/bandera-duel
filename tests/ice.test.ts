import { it, expect } from 'vitest';
import { Duel, RULES, idleInput, movePlayer, CLASS_IDS } from '@bandera/shared';

function setup() {
  const d=new Duel(), mage=d.add('a','Mage','mage'), target=d.add('b','Target','archer');
  d.state.phase='playing';Object.assign(mage,{x:400,y:270});Object.assign(target,{x:460,y:270});
  return {d,mage,target};
}
it('el hielo impacta sin daño y bloquea movimiento y dash durante exactamente medio segundo',()=>{
  const {d,mage,target}=setup();
  d.step(new Map([[mage.id,{...idleInput(),ice:true}]]));
  for(let i=0;i<4 && !target.frozenLeft;i++)d.step(new Map());
  expect(target.frozenLeft).toBe(.5);expect(target.hp).toBe(3);
  const x=target.x;
  for(let i=0;i<15;i++) movePlayer(target,{...idleInput(),x:1,dash:true},false);
  expect(target.x).toBeCloseTo(x);expect(target.dashCd).toBe(0);
  movePlayer(target,{...idleInput(),x:1},false);
  expect(target.x-x).toBeCloseTo(190/30);
});
it('solo el mago puede lanzar hielo y tiene recarga independiente',()=>{
  for(const id of CLASS_IDS){
    const {mage}=setup();mage.classId=id;
    const first=movePlayer(mage,{...idleInput(),ice:true},false);
    expect(first.ice).toBe(id==='mage');
    expect(movePlayer(mage,{...idleInput(),ice:true},false).ice).toBe(false);
  }
  const {mage}=setup();movePlayer(mage,{...idleInput(),ice:true},false);
  expect(mage.iceCd).toBe(RULES.iceCooldown);expect(mage.shotCd).toBe(0);
});
it('los escudos y la invulnerabilidad bloquean la congelación',()=>{
  const {d,mage,target}=setup();target.classId='mage';target.magicShieldHits=2;
  d.damage(target,mage,0,0,true);expect(target.magicShieldHits).toBe(1);expect(target.frozenLeft).toBe(0);
  target.classId='guardian';target.guarding=true;target.angle=Math.PI;
  d.damage(target,mage,0,0,true);expect(target.frozenLeft).toBe(0);
  target.guarding=false;target.invuln=1;d.damage(target,mage,0,0,true);expect(target.frozenLeft).toBe(0);
});
