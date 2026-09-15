import {it,expect} from 'vitest';
import {Duel,idleInput,projectileStats,RULES,movePlayer,newPlayer,sanitizeInput} from '@bandera/shared';
function game(){const d=new Duel();d.add('a','A','archer');d.add('b','B','guardian');d.state.phase='playing';return d;}
function hold(d:Duel,n:number){for(let i=0;i<n;i++)d.step(new Map([['a',{...idleInput(),charge:true}]]));}
it('carga mantenida no dispara y suelta una flecha penetrante de viento',()=>{
 const d=game();hold(d,24);expect(d.state.arrows).toHaveLength(0);
 d.step(new Map([['a',{...idleInput(),shot:true}]]));const arrow=d.state.arrows[0];expect(arrow.charged).toBe(true);
 expect(arrow.wind).toBe(true);expect(arrow.hits).toEqual([]);
 expect(projectileStats(arrow.classId,arrow.charged)).toMatchObject({speed:936,damage:1.3});
 const q=d.state.players[1];q.x=arrow.x+30;q.y=arrow.y;d.step(new Map());expect(q.hp).toBeCloseTo(0.4);
});
it('clic rápido o carga parcial conservan daño normal; el cliente no puede declarar potencia',()=>{
 const d=game();hold(d,8);const raw={...idleInput(),shot:true,shotCharge:99,charged:true};
 d.step(new Map([['a',sanitizeInput(raw)!]]));expect(d.state.arrows[0].charged).toBe(false);
});
it('cancelación sin disparo libera carga y dash, trampa y triple la descartan',()=>{
 for(const action of [{},{dash:true},{trap:true},{volley:true}]){
  const d=game();hold(d,24);d.step(new Map([['a',{...idleInput(),...action}]]));
  expect(d.state.players[0].shotCharge).toBe(0);expect(d.state.arrows.every(a=>!a.charged)).toBe(true);
 }
});
it('sin la habilidad lista no se carga y el aturdimiento bloquea movimiento y todas las habilidades',()=>{
 const p=newPlayer('a','A','blue','mage');p.shotCd=1;movePlayer(p,{...idleInput(),charge:true},false);expect(p.shotCharge).toBe(0);
 p.classId='archer';p.stunLeft=1;const x=p.x;
 for(let i=0;i<30;i++)movePlayer(p,{...idleInput(),x:1,charge:true,shot:true,volley:true,trap:true,dash:true},false);
 expect(p.x).toBe(x);expect(p.stunLeft).toBeCloseTo(0);expect(p.shotCharge).toBe(0);expect(p.trapLeft).toBe(0);
});
