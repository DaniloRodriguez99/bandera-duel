import {describe,it,expect} from 'vitest';
import {
  Duel, MAPS, MAP_IDS, MODE_INFO, TEAMS, blocked, findPath, playerVisibleTo,
  type Team,
} from '@bandera/shared';

describe('mapas y formatos',()=>{
  it('publica cuatro mapas transitables y mantiene bases y arbustos fuera de paredes',()=>{
    expect(MAP_IDS).toEqual(['courtyard','forest','ruins','crossroads']);
    expect(MAPS.courtyard.bushes).toHaveLength(0);
    expect(MAPS.forest.bushes).toHaveLength(4);
    expect(MAPS.ruins.bushes).toHaveLength(2);
    expect(MAPS.crossroads.bushes).toHaveLength(4);
    for(const map of Object.values(MAPS)){
      for(const home of Object.values(map.cornerHomes)) expect(blocked(home.x,home.y,12,map.walls)).toBe(false);
      expect(findPath(map.sideHomes.blue,map.sideHomes.red,undefined,map.walls).length).toBeGreaterThan(1);
    }
  });

  it('exige el cupo completo del formato antes de iniciar',()=>{
    for(const mode of ['duel','teams','ffa3','ffa4'] as const){
      const d=new Duel('forest',mode);
      for(let i=0;i<MODE_INFO[mode].maxPlayers;i++){
        const p=d.add(String(i),`P${i}`);
        d.ready(p.id);
        if(i<MODE_INFO[mode].maxPlayers-1)expect(d.state.phase).toBe('lobby');
      }
      expect(d.state.phase).toBe('countdown');
      expect(d.state.mapId).toBe('forest');
      expect(d.state.mode).toBe(mode);
    }
  });

  it('equilibra 2v2, comparte bandera y marcador, y cambiar equipo desmarca a todos',()=>{
    const d=new Duel('ruins','teams');
    const players=Array.from({length:3},(_,i)=>d.add(String(i),`P${i}`));
    expect(players.map(p=>p.team)).toEqual(['blue','red','blue']);
    expect(d.state.bases).toHaveLength(2);
    expect(d.state.flags).toHaveLength(2);
    players.forEach(p=>p.ready=true);
    expect(d.selectTeam(players[0].id,'red')).toBe(true);
    expect(players.every(p=>!p.ready)).toBe(true);
    const fourth=d.add('3','P3');
    expect(fourth.team).toBe('blue');
    const hp=players[2].hp;
    d.damage(players[2],fourth,0,99);
    expect(players[2].hp).toBe(hp);
  });

  it('usa facciones independientes en todos contra todos',()=>{
    const d=new Duel('crossroads','ffa4');
    for(let i=0;i<4;i++)d.add(String(i),`P${i}`);
    expect(d.state.players.map(p=>p.team)).toEqual(TEAMS);
    expect(new Set(d.state.players.map(p=>p.team)).size).toBe(4);
  });
});

describe('sigilo en arbustos',()=>{
  const hiddenDuel=()=>{
    const d=new Duel('forest','teams');
    const [viewer,enemy,ally]=[d.add('v','Vista'),d.add('e','Enemigo'),d.add('a','Aliado')];
    d.add('other','Otro');
    Object.assign(viewer,{x:180,y:110,bushId:'f1'});
    Object.assign(ally,{x:700,y:110,bushId:'f2'});
    Object.assign(enemy,{x:250,y:110,bushId:'f1',revealLeft:0});
    return {d,viewer,enemy,ally};
  };
  it('oculta entre grupos y detecta a 90 unidades en el mismo grupo con visión compartida',()=>{
    const {d,viewer,enemy,ally}=hiddenDuel();
    expect(playerVisibleTo(d.state,enemy,viewer.team)).toBe(true);
    viewer.hp=0;
    expect(playerVisibleTo(d.state,enemy,viewer.team)).toBe(false);
    Object.assign(ally,{x:321,y:110,bushId:'f1'});
    expect(playerVisibleTo(d.state,enemy,ally.team)).toBe(true);
    ally.x=341;
    expect(playerVisibleTo(d.state,enemy,ally.team)).toBe(false);
  });
  it('revela al atacar, al recibir daño y al transportar una bandera',()=>{
    const {d,viewer,enemy}=hiddenDuel();
    viewer.hp=0;
    enemy.revealLeft=1.5;
    expect(playerVisibleTo(d.state,enemy,viewer.team)).toBe(true);
    enemy.revealLeft=0;
    d.state.flags[0].carrier=enemy.id;
    d.state.flags[0].status='carried';
    expect(playerVisibleTo(d.state,enemy,viewer.team)).toBe(true);
  });
});

