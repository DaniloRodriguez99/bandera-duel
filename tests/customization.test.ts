import { describe,expect,it } from 'vitest';
import { CHARACTER_SKINS, CLASS_IDS, DEFAULT_BINDINGS, DEFAULT_LOADOUTS, Duel, MAGE_SKINS, SKILLS, SKILL_SLOTS, UNIVERSAL_BINDINGS, activePreset, defaultCustomization, idleInput, newPlayer, projectileSkillStats, resolveSlotInput, validCustomization, validLoadout, type CharacterCustomization, type ClassId } from '@bandera/shared';
import { migrateCustomization } from '../packages/client/src/customization';

describe('character customization model',()=>{
  it('ships valid defaults for every class and ten distinct mage skins',()=>{
    for(const classId of CLASS_IDS){expect(validLoadout(classId,DEFAULT_LOADOUTS[classId])).toBe(true);expect(validCustomization(classId,defaultCustomization(classId))).toBe(true);}
    expect(MAGE_SKINS).toHaveLength(10);
    expect(new Set(MAGE_SKINS.map(s=>s.id)).size).toBe(10);
    for(const classId of CLASS_IDS){expect(CHARACTER_SKINS[classId].length).toBeGreaterThanOrEqual(5);expect(new Set(CHARACTER_SKINS[classId].map(s=>s.id)).size).toBe(CHARACTER_SKINS[classId].length);}
  });
  it('rejects duplicates, reserved bindings and incompatible skills',()=>{
    const duplicate=defaultCustomization('mage');duplicate.presets.default.loadout.secondary='mage.ice';expect(validCustomization('mage',duplicate)).toBe(false);
    const reserved=defaultCustomization('mage');reserved.presets.default.bindings.primary='KeyW' as never;expect(validCustomization('mage',reserved)).toBe(false);
    const incompatible=defaultCustomization('mage');incompatible.presets.default.loadout.primary='guardian.sword';expect(validCustomization('mage',incompatible)).toBe(false);
  });
  it('maps logical slots through a validated hybrid mage loadout',()=>{
    const customization=defaultCustomization('mage');const preset=activePreset(customization);
    preset.loadout.primary='necromancer.fire';preset.loadout.f='necromancer.summon';
    // The mage's free R and M2 hold Mando and Marcar, so the hybrid is valid out of the box.
    expect(validCustomization('mage',customization)).toBe(true);
    const player=newPlayer('m','Mago','blue','mage',undefined,customization);
    const fire=idleInput();fire.slots.primary.released=true;
    const cast=resolveSlotInput(player,fire);expect(cast.shot).toBe(true);
    const result=projectileSkillStats('necromancer.fire','mage');expect(result.damage).toBe(projectileSkillStats('necromancer.fire','necromancer').damage);
    const summon=idleInput();summon.slots.f.released=true;expect(resolveSlotInput(player,summon).summon).toBe(true);
  });
  it('Parpadeo carga mientras se mantiene y se lanza al soltar',()=>{
    const player=newPlayer('m','Mago','blue','mage');
    const pressed=idleInput();pressed.slots.mobility.pressed=true;
    expect(resolveSlotInput(player,pressed)).toMatchObject({blink:true,blinkRelease:false,dash:false});
    const held=idleInput();held.slots.mobility.held=true;
    expect(resolveSlotInput(player,held)).toMatchObject({blink:true,blinkRelease:false});
    const released=idleInput();released.slots.mobility.released=true;
    expect(resolveSlotInput(player,released)).toMatchObject({blink:false,blinkRelease:true,dash:false});
  });
  it('migra perfiles de la versión 1 a la disposición universal, conservando la skin',()=>{
    const v1=(classId:ClassId,loadout:Record<string,string|null>,bindings:Record<string,string>)=>({
      version:1,classId,selectedSkin:CHARACTER_SKINS[classId][2].id,activePresetId:'default',
      presets:{default:{loadout,bindings:{primary:'MouseLeft',companionCommand:'KeyE',...bindings},skillTreeSelection:Object.values(loadout).filter(Boolean)}},
    });
    const mage=migrateCustomization('mage',v1('mage',
      {primary:'mage.fireball',secondary:'mage.magicShield',mobility:'common.dash',skill1:'mage.ice',skill2:null},
      {secondary:'MouseRight',mobility:'Shift',skill1:'MouseMiddle',skill2:'KeyE'})) as CharacterCustomization;
    expect(validCustomization('mage',mage)).toBe(true);
    expect(mage.version).toBe(2);
    expect(mage.selectedSkin).toBe(CHARACTER_SKINS.mage[2].id);
    // Each skill lands where the universal layout puts it; the old dash became Parpadeo.
    expect(mage.presets.default.loadout).toEqual({primary:'mage.fireball',secondary:null,mobility:'mage.blink',q:'mage.ice',e:'mage.magicShield',f:null,r:null});
    // The controls reset to the universal keys: ice leaves the middle click for Q.
    expect(mage.presets.default.bindings).toEqual(DEFAULT_BINDINGS.mage);
    expect(mage.presets.default.skillTreeSelection).toContain('mage.blink');

    const knight=migrateCustomization('guardian',v1('guardian',
      {primary:'guardian.sword',secondary:'guardian.guard',mobility:'guardian.dash',skill1:'guardian.shieldBash',skill2:'guardian.fury'},
      {secondary:'MouseRight',mobility:'Space',skill1:'KeyQ',skill2:'KeyE'})) as CharacterCustomization;
    expect(validCustomization('guardian',knight)).toBe(true);
    // The shield is gone: the flurry takes its place on M2 and the bash has no successor.
    expect(knight.presets.default.loadout).toEqual({primary:'guardian.sword',secondary:'guardian.flurry',mobility:'guardian.dash',q:null,e:null,f:null,r:'guardian.fury'});
    expect(knight.presets.default.skillTreeSelection).not.toContain('guardian.guard');

    // A profile saved with the universal layout, before the knight lost the shield, is repaired too.
    const saved=defaultCustomization('guardian') as unknown as {selectedSkin:string;presets:{default:{loadout:Record<string,string|null>;skillTreeSelection:string[]}}};
    saved.selectedSkin=CHARACTER_SKINS.guardian[3].id;
    saved.presets.default.loadout={primary:'guardian.sword',secondary:'guardian.guard',mobility:'guardian.dash',q:'guardian.shieldBash',e:null,f:null,r:'guardian.fury'};
    saved.presets.default.skillTreeSelection=['guardian.sword','guardian.guard','guardian.shieldBash'];
    expect(validCustomization('guardian',saved)).toBe(false);
    const repaired=migrateCustomization('guardian',saved) as CharacterCustomization;
    expect(validCustomization('guardian',repaired)).toBe(true);
    expect(repaired.selectedSkin).toBe(CHARACTER_SKINS.guardian[3].id);
    expect(repaired.presets.default.loadout).toMatchObject({secondary:'guardian.flurry',q:null,r:'guardian.fury'});
    expect(repaired.presets.default.skillTreeSelection).toEqual(['guardian.sword','guardian.flurry']);

    const archer=migrateCustomization('archer',v1('archer',
      {primary:'archer.arrow',secondary:'archer.dagger',mobility:'common.dash',skill1:'archer.trap',skill2:'archer.volley'},
      {secondary:'MouseRight',mobility:'Space',skill1:'KeyQ',skill2:'KeyE'})) as CharacterCustomization;
    expect(archer.presets.default.loadout).toMatchObject({q:'archer.volley',e:'archer.trap'});
    // A profile already on version 2 is left alone.
    expect(migrateCustomization('mage',defaultCustomization('mage'))).toEqual(defaultCustomization('mage'));
    // A warrior saved before his launch and his iron body: the shared dodge becomes his launch and
    // the free R takes the reinforcement; everything else stays.
    const warrior=defaultCustomization('vanguard');
    warrior.selectedSkin='vanguard.ironTitan';
    warrior.presets.default.loadout={primary:'vanguard.sword',secondary:null,mobility:'common.dash',q:'vanguard.slash',e:'vanguard.counter',f:null,r:null};
    warrior.presets.default.skillTreeSelection=['vanguard.sword','common.dash','vanguard.slash','vanguard.counter'];
    expect(validCustomization('vanguard',warrior)).toBe(false);
    const upgraded=migrateCustomization('vanguard',warrior) as CharacterCustomization;
    expect(validCustomization('vanguard',upgraded)).toBe(true);
    expect(upgraded.selectedSkin).toBe('vanguard.ironTitan');
    expect(upgraded.presets.default.loadout).toEqual(DEFAULT_LOADOUTS.vanguard);
    expect(upgraded.presets.default.skillTreeSelection).toEqual(['vanguard.sword','vanguard.dash','vanguard.slash','vanguard.counter','vanguard.reinforce']);
    // One who moved something else into R keeps it.
    const busy=structuredClone(warrior);busy.presets.default.loadout.r='vanguard.counter';busy.presets.default.loadout.e=null;
    expect((migrateCustomization('vanguard',busy) as CharacterCustomization).presets.default.loadout.r).toBe('vanguard.counter');
  });
  it('todas las clases comparten los mismos siete controles',()=>{
    for(const classId of CLASS_IDS)
      for(const slot of SKILL_SLOTS)expect(DEFAULT_BINDINGS[classId][slot]).toBe(UNIVERSAL_BINDINGS[slot]);
    expect(UNIVERSAL_BINDINGS).toEqual({primary:'MouseLeft',secondary:'MouseRight',mobility:'Space',q:'KeyQ',e:'KeyE',f:'KeyF',r:'KeyR'});
    // Every mobility skill lives on Space, and the powerful ones on F.
    for(const classId of CLASS_IDS){
      const mobility=DEFAULT_LOADOUTS[classId].mobility;
      if(mobility)expect(SKILLS[mobility].grants).toContain('mobility');
    }
    expect(DEFAULT_LOADOUTS.mage.f).toBe('mage.blackHole');
    expect(DEFAULT_LOADOUTS.necromancer).toMatchObject({f:'necromancer.summon',mobility:null});
    expect(DEFAULT_LOADOUTS.guardian.r).toBe('guardian.fury');
  });
  it('Mando y Marcar necesitan teclas propias cuando está la invocación',()=>{
    const clash=defaultCustomization('necromancer');activePreset(clash).bindings.companionCommand='KeyF';
    expect(validCustomization('necromancer',clash)).toBe(false);
    const same=defaultCustomization('necromancer');activePreset(same).bindings.companionMark='KeyE';
    expect(validCustomization('necromancer',same)).toBe(false);
    // Without the summon the companion keys are never read, so they may overlap anything.
    const archer=defaultCustomization('archer');activePreset(archer).bindings.companionCommand='KeyQ';
    expect(validCustomization('archer',archer)).toBe(true);
  });
  it('Mando y Marcar pasan aunque haya otra tecla mantenida',()=>{
    const p=newPlayer('n','Nigromante','blue','necromancer');
    const input={...idleInput(),command:true,mark:true};input.slots.primary.held=true;
    expect(resolveSlotInput(p,input)).toMatchObject({command:true,mark:true,charge:true});
  });
  it('Singularidad carga al mantener, se lanza al soltar y se detona al volver a pulsar',()=>{
    const p=newPlayer('m','Mago','blue','mage');
    const pressed=idleInput();pressed.slots.f.pressed=true;
    expect(resolveSlotInput(p,pressed)).toMatchObject({blackHole:true,blackHoleDetonate:true,blackHoleRelease:false});
    const held=idleInput();held.slots.f.held=true;
    expect(resolveSlotInput(p,held)).toMatchObject({blackHole:true,blackHoleDetonate:false,blackHoleRelease:false});
    const released=idleInput();released.slots.f.released=true;
    expect(resolveSlotInput(p,released)).toMatchObject({blackHole:false,blackHoleDetonate:false,blackHoleRelease:true});
  });
  it('ignores a manipulated logical slot when it is empty',()=>{
    const customization=defaultCustomization('mage');activePreset(customization).loadout.f=null;
    const player=newPlayer('m','Mago','blue','mage',undefined,customization);const input=idleInput();input.slots.f.pressed=true;
    const resolved=resolveSlotInput(player,input);expect(resolved.ice||resolved.summon||resolved.shot||resolved.guard).toBe(false);
  });
  it('applies profiles only in configurable phases and clears ready state',()=>{
    const duel=new Duel();const player=duel.add('m','Mago','mage');player.ready=true;
    const customization=defaultCustomization('mage');customization.selectedSkin=MAGE_SKINS[4].id;
    expect(duel.setCustomization(player.id,customization)).toBe(true);expect(player.skinId).toBe(MAGE_SKINS[4].id);expect(player.ready).toBe(false);expect(player.profileRevision).toBe(2);
    duel.state.phase='playing';expect(duel.setCustomization(player.id,defaultCustomization('mage'))).toBe(false);
  });
  it('keeps contextual necromancer actions inside the summon skill',()=>{
    expect(SKILLS['necromancer.summon'].grants).toContain('companionControl');
    expect(Object.keys(DEFAULT_LOADOUTS.mage)).toEqual(['primary','secondary','mobility','q','e','f','r']);
  });
});
