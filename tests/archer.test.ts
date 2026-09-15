import {it,expect} from 'vitest';
import {Duel,idleInput,RULES,movePlayer,newPlayer,type ClassId} from '@bandera/shared';
function game(){const d=new Duel();d.add('a','A','archer');d.add('b','B','guardian');d.state.phase='playing';return d;}
function ticks(d:Duel,n:number){for(let i=0;i<n;i++)d.step(new Map());}
function place(d:Duel){const p=d.state.players[0];p.trapCd=0;d.step(new Map([['a',{...idleInput(),trap:true}]]));ticks(d,15);}
it('triple casi paralela que se abre de a poco, recarga y exclusión de disparo normal',()=>{
 const d=game();d.step(new Map([['a',{...idleInput(),volley:true,shot:true}]]));
 expect(d.state.arrows).toHaveLength(3);expect(d.state.arrows.map(a=>a.angle)).toEqual([-RULES.volleyAngle,0,RULES.volleyAngle]);
 const gap=d.state.arrows[2].y-d.state.arrows[0].y;expect(gap).toBeGreaterThan(2*RULES.volleyGap);expect(gap).toBeLessThan(2*RULES.volleyGap+4);
 expect(d.state.players[0].volleyCd).toBe(5);
 d.step(new Map([['a',{...idleInput(),volley:true}]]));expect(d.state.arrows).toHaveLength(3);
});
it('triple mientras se desplaza sale penetrante',()=>{
 const d=game();d.step(new Map([['a',{...idleInput(),volley:true,x:1}]]));
 expect(d.state.arrows).toHaveLength(3);
 expect(d.state.arrows.every(a=>a.wind&&a.hits&&a.volley!==undefined)).toBe(true);
});
it('triple mientras se desplaza en PvE sale penetrante',()=>{
 const d=new Duel('courtyard','pve');d.add('a','A','archer');d.state.phase='playing';d.state.pve={objective:'elimination',wave:1,initialPartySize:1,pendingBudget:0,spawnedAll:true,enemiesRemaining:1,rewardLeft:0,chosen:[],completed:false,endless:false,bossActive:false,kills:{},damage:{}};
 d.state.mobs.push({id:'m1',kind:'zombie',hp:10,maxHp:10,x:300,y:270,angle:0,speed:0,damage:1,attackCd:0,specialCd:0,windup:0,spawnLeft:0,frozenLeft:0,target:null,elite:false,boss:false,bushId:null,revealLeft:0});
 d.step(new Map([['a',{...idleInput(),volley:true,x:1}]]));
 expect(d.state.arrows).toHaveLength(3);
 expect(d.state.arrows.every(a=>a.wind&&a.hits&&a.volley!==undefined)).toBe(true);
});
it.each(['guardian','vanguard','mage','necromancer'] as ClassId[])('%s no usa habilidades de arquero',id=>{
 const p=newPlayer('a','A','blue',id);expect(movePlayer(p,{...idleInput(),volley:true,trap:true},false)).toMatchObject({trap:false,volley:false});expect(p.trapLeft).toBe(0);
});
it('trampa inmoviliza medio segundo y no permite atacar mientras se prepara',()=>{
 const d=game();d.step(new Map([['a',{...idleInput(),trap:true}]]));ticks(d,7);expect(d.state.traps).toHaveLength(0);
 d.step(new Map([['a',{...idleInput(),volley:true,shot:true,dash:true}]]));expect(d.state.arrows).toHaveLength(0);expect(d.state.players[0].dashCd).toBe(0);
 ticks(d,7);expect(d.state.traps).toHaveLength(1);expect(d.state.traps[0].armLeft).toBeGreaterThan(0);
});
it('movimiento bloqueado durante preparación y daño la cancela',()=>{
 const d=game(),p=d.state.players[0],q=d.state.players[1];
 const x=p.x;d.step(new Map([['a',{...idleInput(),trap:true,x:1}]]));d.step(new Map([['a',{...idleInput(),x:1}]]));expect(p.x).toBe(x);ticks(d,15);expect(d.state.traps).toHaveLength(1);d.state.traps=[];
 p.trapCd=0;d.step(new Map([['a',{...idleInput(),trap:true}]]));d.damage(p,q,0);ticks(d,35);expect(d.state.traps).toHaveLength(0);expect(p.trapCd).toBeGreaterThan(0);
});
it('activación, daño, bandera y aturdimiento temporal',()=>{
 const d=game();place(d);const p=d.state.players[0],q=d.state.players[1],t=d.state.traps[0];
 q.x=t.x;q.y=t.y;q.invuln=0;p.x=400;p.y=270;
 const flag=d.state.flags[0];flag.status='carried';flag.carrier=q.id;
 d.step(new Map());expect(q.hp).toBe(3);ticks(d,16);
 expect(q.hp).toBe(2.5);expect(q.stunLeft).toBeGreaterThan(0);expect(flag.status).toBe('dropped');expect(d.state.traps).toHaveLength(0);
 q.x=480;q.y=270;const x=q.x;movePlayer(q,{...idleInput(),x:1},true);expect(q.x-x).toBe(0);
 ticks(d,50);expect(q.stunLeft).toBe(0);
});
it('máximo tres, vencimiento y limpieza al reiniciar',()=>{
 const d=game();place(d);place(d);place(d);const first=d.state.traps[0].id;place(d);
 expect(d.state.traps).toHaveLength(3);expect(d.state.traps.some(t=>t.id===first)).toBe(false);
 ticks(d,Math.ceil(RULES.trapLife*30));expect(d.state.traps).toHaveLength(0);
 place(d);d.resetArena();expect(d.state.traps).toHaveLength(0);expect(d.state.players[0].trapLeft).toBe(0);
});
it('dash evita la trampa durante la ventana de invulnerabilidad',()=>{
 const d=game();place(d);ticks(d,20);const q=d.state.players[1],t=d.state.traps[0];q.classId='archer';q.x=t.x;q.y=t.y;
 d.step(new Map([['b',{...idleInput(),dash:true}]]));expect(q.hp).toBe(3);expect(d.state.traps).toHaveLength(1);
});
