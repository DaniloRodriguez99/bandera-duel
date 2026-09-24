import { describe,expect,it } from 'vitest';
import { CHARACTER_SKINS, CLASS_IDS, DEFAULT_LOADOUTS, Duel, MAGE_SKINS, SKILLS, activePreset, defaultCustomization, idleInput, newPlayer, projectileSkillStats, resolveSlotInput, validCustomization, validLoadout } from '@bandera/shared';
import { migrateCustomization } from '../packages/client/src/customization';

describe('character customization model',()=>{
  it('ships valid defaults for every class and ten distinct mage skins',()=>{
    for(const classId of CLASS_IDS){expect(validLoadout(classId,DEFAULT_LOADOUTS[classId])).toBe(true);expect(validCustomization(classId,defaultCustomization(classId))).toBe(true);}
    expect(MAGE_SKINS).toHaveLength(10);
    expect(new Set(MAGE_SKINS.map(s=>s.id)).size).toBe(10);
    for(const classId of CLASS_IDS){expect(CHARACTER_SKINS[classId].length).toBeGreaterThanOrEqual(5);expect(new Set(CHARACTER_SKINS[classId].map(s=>s.id)).size).toBe(CHARACTER_SKINS[classId].length);}
  });
  it('rejects duplicates, reserved bindings and incompatible skills',()=>{
    const duplicate=defaultCustomization('mage');duplicate.presets.default.loadout.skill2='mage.ice';expect(validCustomization('mage',duplicate)).toBe(false);
    const reserved=defaultCustomization('mage');reserved.presets.default.bindings.primary='KeyW' as never;expect(validCustomization('mage',reserved)).toBe(false);
    const incompatible=defaultCustomization('mage');incompatible.presets.default.loadout.primary='guardian.sword';expect(validCustomization('mage',incompatible)).toBe(false);
  });
  it('maps logical slots through a validated hybrid mage loadout',()=>{
    const customization=defaultCustomization('mage');const preset=activePreset(customization);
    preset.loadout.primary='necromancer.fire';preset.loadout.secondary='necromancer.summon';preset.loadout.skill1='mage.ice';
    const player=newPlayer('m','Mago','blue','mage',undefined,customization);
    const fire=idleInput();fire.slots.primary.released=true;
    const cast=resolveSlotInput(player,fire);expect(cast.shot).toBe(true);
    const result=projectileSkillStats('necromancer.fire','mage');expect(result.damage).toBe(projectileSkillStats('necromancer.fire','necromancer').damage);
    const summon=idleInput();summon.slots.secondary.released=true;expect(resolveSlotInput(player,summon).summon).toBe(true);
  });
  it('dispara el parpadeo al soltar, no al presionar',()=>{
    const player=newPlayer('m','Mago','blue','mage');
    const pressed=idleInput();pressed.slots.mobility.pressed=true;
    expect(resolveSlotInput(player,pressed).dash).toBe(false);
    const released=idleInput();released.slots.mobility.released=true;
    expect(resolveSlotInput(player,released).dash).toBe(true);
  });
  it('migra Parpadeo sin perder skin ni controles guardados',()=>{
    const old=defaultCustomization('mage');old.selectedSkin=MAGE_SKINS[3].id;
    old.presets.default.loadout.mobility='common.dash';old.presets.default.loadout.skill2=null;
    old.presets.default.bindings.mobility='Shift';
    const migrated=migrateCustomization('mage',old);
    expect(validCustomization('mage',migrated)).toBe(true);
    const profile=migrated as typeof old;
    expect(profile.selectedSkin).toBe(old.selectedSkin);
    expect(profile.presets.default.bindings.mobility).toBe('Shift');
    expect(profile.presets.default.loadout.mobility).toBe('mage.blink');
    expect(profile.presets.default.loadout.skill2).toBeNull();
  });
  it('resuelve Singularidad sólo cuando se pulsa su slot equipado',()=>{
    const p=newPlayer('m','Mago','blue','mage');
    const pressed=idleInput();pressed.slots.skill2.pressed=true;
    expect(resolveSlotInput(p,pressed).blackHole).toBe(true);
    const released=idleInput();released.slots.skill2.released=true;
    expect(resolveSlotInput(p,released).blackHole).toBe(false);
  });
  it('ignores a manipulated logical slot when it is empty',()=>{
    const customization=defaultCustomization('mage');activePreset(customization).loadout.skill2=null;
    const player=newPlayer('m','Mago','blue','mage',undefined,customization);const input=idleInput();input.slots.skill2.pressed=true;
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
    expect(Object.keys(DEFAULT_LOADOUTS.mage)).toEqual(['primary','secondary','mobility','skill1','skill2']);
  });
});
