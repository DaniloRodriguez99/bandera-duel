import { CHARACTER_SKINS, CLASSES, DEFAULT_BINDINGS, DEFAULT_LOADOUTS, SKILLS, SKILL_SLOTS, activePreset, defaultCustomization, validCustomization, validSkill, type BindableAction, type CharacterCustomization, type CharacterLoadout, type ClassId, type PhysicalBinding, type SkillId, type SkillSlot } from '@bandera/shared';
import { classIllustration } from './art.js';

const STORAGE='bandera-customization:v1';
const ALLOWED = new Set<PhysicalBinding>(['MouseLeft','MouseRight','MouseMiddle','Space','Shift','Ctrl','KeyQ','KeyE','KeyR','KeyF','KeyC','KeyX','KeyZ','KeyV','KeyG','KeyT']);
/** What each slot is for, the same for every class. */
export const SLOT_NAMES:Record<SkillSlot,string>={primary:'Ataque',secondary:'Secundario',mobility:'Movilidad',q:'Básica',e:'Secundaria',f:'Poderosa',r:'Definitiva'};
const COMPANION_ACTIONS=['companionCommand','companionMark'] as const;
const actionName=(action:BindableAction)=>action==='companionCommand'?'Mando':action==='companionMark'?'Marcar':SLOT_NAMES[action];
const BINDING_LABELS:Record<string,string>={MouseLeft:'CLIC IZQ.',MouseRight:'CLIC DER.',MouseMiddle:'CLIC CENTRAL',Space:'ESPACIO',Shift:'SHIFT',Ctrl:'CTRL'};
const bindingLabel=(binding:PhysicalBinding)=>BINDING_LABELS[binding]??binding.replace('Key','');
const clone=<T>(value:T):T=>structuredClone(value);
const branchTone=(branch:string)=>branch==='mage'?'#59bfff':branch==='necromancer'?'#b56cff':branch==='archer'?'#77d982':branch==='guardian'?'#f0bd58':branch==='vanguard'?'#ee6862':'#9bb9c7';

const storageKey=(classId:ClassId)=>classId==='mage'?STORAGE:`${STORAGE}:${classId}`;
export function loadCustomization(classId:ClassId):CharacterCustomization {
  try { const value=migrateCustomization(classId,JSON.parse(localStorage.getItem(storageKey(classId))??'null')); if(validCustomization(classId,value)){saveCustomization(value);return value;} } catch { /* corrupted profiles fall back safely */ }
  return defaultCustomization(classId);
}
/** Skills that no longer exist, and what took their place in the kit; null when nothing did. */
const RETIRED: Record<string, SkillId | null> = { 'guardian.guard': 'guardian.flurry', 'guardian.shieldBash': null };
/** Skills a class no longer uses, by class, and what took their place. */
const REPLACED: Partial<Record<ClassId, Record<string, SkillId>>> = { vanguard: { 'common.dash': 'vanguard.dash' } };
/** Skills that moved to another default slot: from the old one to the new, if the new one is free. */
const MOVED: Partial<Record<ClassId, { id: SkillId; from: SkillSlot; to: SkillSlot }[]>> = {
  guardian: [{ id: 'guardian.flurry', from: 'secondary', to: 'q' }],
};
/** Skills a class gained: a saved profile gets them where the default puts them, if that slot is free. */
const GAINED: Partial<Record<ClassId, SkillId[]>> = { vanguard: ['vanguard.reinforce'] };
/**
 * Brings a saved profile up to date.
 *
 * Retired skills leave their slot to whatever took their place (the knight's shield became the
 * flurry; its shield bash has no successor).
 *
 * Version 1 had five slots (Habilidad I and II) and per-class keys. Version 2 is the universal
 * layout: every equipped skill moves to where the class's default puts it (or its first free
 * compatible slot), and the controls reset to the universal keys, which is the point of the change.
 * Skins and the skill tree are kept.
 */
export function migrateCustomization(classId:ClassId,raw:unknown):unknown {
  if(!raw||typeof raw!=='object')return raw;
  const value=clone(raw) as unknown as {version:number;classId:ClassId;presets:Record<string,{loadout:Record<string,unknown>;bindings:unknown;skillTreeSelection?:SkillId[]}>};
  if(value.classId!==classId||!value.presets||typeof value.presets!=='object')return raw;
  let repaired=false;
  const replaced=REPLACED[classId]??{};
  for(const preset of Object.values(value.presets)){
    if(!preset?.loadout||typeof preset.loadout!=='object')continue;
    for(const [slot,id] of Object.entries(preset.loadout)){
      if(typeof id==='string'&&id in RETIRED){preset.loadout[slot]=RETIRED[id];repaired=true;}
      else if(typeof id==='string'&&id in replaced){preset.loadout[slot]=replaced[id];repaired=true;}
    }
    if(Array.isArray(preset.skillTreeSelection)&&preset.skillTreeSelection.some(id=>id in replaced)){
      preset.skillTreeSelection=preset.skillTreeSelection.map(id=>replaced[id]??id);
      repaired=true;
    }
    for(const {id,from,to} of MOVED[classId]??[])
      if(preset.loadout[from]===id&&!preset.loadout[to]){preset.loadout[to]=id;preset.loadout[from]=null;repaired=true;}
    for(const id of GAINED[classId]??[]){
      const home=SKILL_SLOTS.find(slot=>DEFAULT_LOADOUTS[classId][slot]===id);
      if(!home||preset.loadout[home]||Object.values(preset.loadout).includes(id))continue;
      preset.loadout[home]=id;
      if(Array.isArray(preset.skillTreeSelection)&&!preset.skillTreeSelection.includes(id))preset.skillTreeSelection.push(id);
      repaired=true;
    }
    if(Array.isArray(preset.skillTreeSelection)&&preset.skillTreeSelection.some(id=>id in RETIRED)){
      preset.skillTreeSelection=[...new Set(preset.skillTreeSelection.flatMap(id=>id in RETIRED?(RETIRED[id]?[RETIRED[id]!]:[]):[id]))];
      repaired=true;
    }
  }
  if(value.version!==1)return repaired?value:raw;
  for(const preset of Object.values(value.presets)){
    if(!preset?.loadout||typeof preset.loadout!=='object')continue;
    // The mage's old dash became Parpadeo before the universal layout.
    if(classId==='mage'&&preset.loadout.mobility==='common.dash'){
      preset.loadout.mobility='mage.blink';
      preset.skillTreeSelection=preset.skillTreeSelection?.map(id=>id==='common.dash'?'mage.blink':id)??[];
    }
    const equipped=[...new Set(Object.values(preset.loadout).filter(validSkill))];
    const loadout=Object.fromEntries(SKILL_SLOTS.map(slot=>[slot,null])) as CharacterLoadout;
    const place=(id:SkillId,slot:SkillSlot|undefined)=>{if(!slot||loadout[slot])return false;loadout[slot]=id;return true;};
    for(const id of equipped){
      const home=SKILL_SLOTS.find(slot=>DEFAULT_LOADOUTS[classId][slot]===id);
      if(!place(id,home))for(const slot of SKILLS[id].compatibleSlots)if(place(id,slot))break;
    }
    preset.loadout=loadout;
    preset.bindings={...DEFAULT_BINDINGS[classId]};
  }
  value.version=2;
  return value;
}
export function saveCustomization(value:CharacterCustomization){ localStorage.setItem(storageKey(value.classId),JSON.stringify(value)); }

export function mountCharacterCustomization(root:HTMLElement, initial:CharacterCustomization, onChange:(classId:ClassId,value:CharacterCustomization)=>void){
  let classId=initial.classId,value=clone(initial), selected:SkillId=activePreset(initial).loadout.primary!, tab:'skills'|'skins'='skills', capture:BindableAction|null=null;
  const preset=()=>activePreset(value);
  const commit=()=>{saveCustomization(value);onChange(classId,clone(value));render();};
  const render=()=>{
    const skins=CHARACTER_SKINS[classId],skin=skins.find(item=>item.id===value.selectedSkin)??skins[0];
    const skill=SKILLS[selected];
    root.innerHTML=`<div class="custom-shell" data-class-theme="${classId}" role="dialog" aria-modal="true" aria-labelledby="custom-title" style="--skin-cloth:${skin.cloth};--skin-light:${skin.light};--skin-accent:${skin.accent}">
      <header><div><small>PERSONAJE · ${CLASSES[classId].name.toUpperCase()}</small><h2 id="custom-title">Forjá tu ${CLASSES[classId].name.toLowerCase()}</h2></div><button class="custom-close" aria-label="Cerrar">×</button></header>
      <div class="custom-preview" style="--cloth:${skin.cloth};--light:${skin.light};--accent:${skin.accent}"><div class="character-preview">${classIllustration(classId,skin.id)}</div><strong>${skin.name}</strong><small>${skin.description}</small></div>
      <nav><button data-tab="skins" aria-pressed="${tab==='skins'}">SKINS</button><button data-tab="skills" aria-pressed="${tab==='skills'}">HABILIDADES</button></nav>
      <section class="custom-center">${tab==='skins'?`<div class="skin-grid">${skins.map((item,index)=>`<button class="rpg-frame frame-${index%5}" data-skin="${item.id}" aria-pressed="${item.id===value.selectedSkin}" style="--swatch:${item.cloth};--frame:${item.accent};--frame-light:${item.light}"><span class="skin-emblem"><i></i></span><span class="skin-copy"><strong>${item.name}</strong><small>${item.description}</small></span><b aria-hidden="true">◆</b></button>`).join('')}</div>`:`<div class="skill-tree">${skillBranches()}</div>`}</section>
      <aside class="skill-detail rpg-detail">${tab==='skins'?`<div class="detail-sigil" style="--swatch:${skin.cloth};--frame:${skin.accent};--frame-light:${skin.light}"><i></i></div><small>ASPECTO · ${CLASSES[classId].name.toUpperCase()}</small><h3>${skin.name}</h3><p>${skin.description}</p><dl><div><dt>VESTIMENTA</dt><dd><i class="color-chip" style="--chip:${skin.cloth}"></i>Principal</dd></div><div><dt>ORNAMENTOS</dt><dd><i class="color-chip" style="--chip:${skin.accent}"></i>Encantados</dd></div><div><dt>ESTADO</dt><dd>${skin.id===value.selectedSkin?'Equipado':'Disponible'}</dd></div></dl>`:`<img src="/assets/skills/${skill.icon}.png" alt=""><small>${skill.branch.toUpperCase()}</small><h3>${skill.name}</h3><p>${skill.description}</p><dl><div><dt>DAÑO</dt><dd>${skill.damage}</dd></div><div><dt>ENFRIAMIENTO</dt><dd>${String(skill.cooldown).replace('.',',')} s</dd></div><div><dt>ACTIVACIÓN</dt><dd>${skill.trigger==='hold-release'?'Mantener y soltar':skill.trigger==='release'?'Soltar':skill.trigger==='hold'?'Mantener':'Pulsar'}</dd></div></dl>${selected==='necromancer.summon'?'<p class="included">INCLUYE · Mando, Marcar, zombie con espada, zombie mago y resurrección.</p>':''}`}</aside>
      <footer><div class="loadout-title"><div><small>LOADOUT ACTIVO</small><strong>PRESET DEFAULT</strong></div><button data-reset="all">Restablecer todo</button></div><div class="loadout-grid">${SKILL_SLOTS.map(slot=>slotCard(slot)).join('')}</div>${Object.values(preset().loadout).includes('necromancer.summon')?COMPANION_ACTIONS.map(action=>`<div class="context-binding"><span><strong>${actionName(action)}</strong><small>${action==='companionCommand'?'Zombies automáticos o a tu mando':'Sobre un zombie: lo cambia de círculo'}</small></span><button class="binding" data-bind="${action}">${capture===action?'PULSÁ UNA TECLA…':bindingLabel(preset().bindings[action])}</button><button data-reset="${action}">↺</button></div>`).join(''):''}<p class="binding-note">Elegí una habilidad y luego un slot resaltado. Tocá una tecla para cambiar un control. WASD, flechas, Escape, Tab, Enter, sistema y F1–F12 están reservadas.</p><div class="binding-conflict" hidden></div></footer>
    </div>`;
    bind();
  };
  const availableSkills=()=>Object.values(SKILLS).filter(skill=>skill.compatibleClasses.includes(classId));
  const skillBranches=()=>{const skills=availableSkills(),branches=[...new Set(skills.map(skill=>skill.branch))];return branches.map(branch=>`<h3>${branch==='common'?'MOVILIDAD':branch.toUpperCase()}</h3>${skills.filter(skill=>skill.branch===branch).map(skill=>skillNode(skill.id)).join('')}`).join('');};
  const skillNode=(id:SkillId)=>{const skill=SKILLS[id],equipped=Object.values(preset().loadout).includes(id);return `<button class="skill-node rpg-frame" data-skill="${id}" aria-pressed="${id===selected}" style="--frame:${branchTone(skill.branch)}"><img src="/assets/skills/${skill.icon}.png" alt=""><span><strong>${skill.name}</strong><small>${equipped?'EQUIPADA':'DISPONIBLE'}</small></span><b aria-hidden="true">◆</b></button>`;};
  const slotCard=(slot:SkillSlot)=>{const id=preset().loadout[slot],skill=id?SKILLS[id]:null,compatible=SKILLS[selected].compatibleSlots.includes(slot);return `<article class="loadout-slot ${compatible?'compatible':''}" data-slot="${slot}"><small>${SLOT_NAMES[slot]}</small>${skill?`<img src="/assets/skills/${skill.icon}.png" alt=""><strong>${skill.name}</strong>`:'<span class="empty-skill">VACÍO</span>'}<button class="binding" data-bind="${slot}">${capture===slot?'PULSÁ UNA TECLA…':bindingLabel(preset().bindings[slot])}</button>${id?`<button class="slot-reset" data-reset="${slot}">↺</button>`:''}</article>`;};
  const bind=()=>{
    root.querySelector<HTMLButtonElement>('.custom-close')!.onclick=()=>{root.hidden=true;capture=null;};
    root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(button=>button.onclick=()=>{tab=button.dataset.tab as typeof tab;render();});
    root.querySelectorAll<HTMLButtonElement>('[data-skin]').forEach(button=>button.onclick=()=>{value.selectedSkin=button.dataset.skin!;commit();});
    root.querySelectorAll<HTMLButtonElement>('[data-skill]').forEach(button=>button.onclick=()=>{selected=button.dataset.skill as SkillId;render();});
    root.querySelectorAll<HTMLElement>('[data-slot]').forEach(card=>card.onclick=(event)=>{if((event.target as HTMLElement).closest('button'))return;const slot=card.dataset.slot as SkillSlot;if(!SKILLS[selected].compatibleSlots.includes(slot))return;for(const current of SKILL_SLOTS)if(preset().loadout[current]===selected)preset().loadout[current]=null;preset().loadout[slot]=selected;if(!preset().skillTreeSelection.includes(selected))preset().skillTreeSelection.push(selected);commit();});
    root.querySelectorAll<HTMLButtonElement>('[data-bind]').forEach(button=>button.onclick=()=>{capture=button.dataset.bind as BindableAction;render();});
    root.querySelectorAll<HTMLButtonElement>('[data-reset]').forEach(button=>button.onclick=()=>{const target=button.dataset.reset;if(target==='all')value=defaultCustomization(classId);else if(target==='companionCommand'||target==='companionMark')preset().bindings[target]=defaultCustomization(classId).presets.default.bindings[target];else {const slot=target as SkillSlot;preset().loadout[slot]=defaultCustomization(classId).presets.default.loadout[slot];preset().bindings[slot]=defaultCustomization(classId).presets.default.bindings[slot];}commit();});
  };
  const physical=(event:KeyboardEvent|MouseEvent):PhysicalBinding|undefined=>event instanceof MouseEvent?(event.button===0?'MouseLeft':event.button===1?'MouseMiddle':event.button===2?'MouseRight':undefined):event.code==='ControlLeft'||event.code==='ControlRight'?'Ctrl':event.code==='ShiftLeft'||event.code==='ShiftRight'?'Shift':event.code as PhysicalBinding;
  const captureEvent=(event:KeyboardEvent|MouseEvent)=>{if(root.hidden||!capture||(event.target as HTMLElement)?.closest?.('.binding-conflict'))return;const binding=physical(event);event.preventDefault();if(!binding||!ALLOWED.has(binding))return;const slotConflict=SKILL_SLOTS.find(slot=>slot!==capture&&preset().loadout[slot]&&preset().bindings[slot]===binding);const companionConflict=Object.values(preset().loadout).includes('necromancer.summon')?COMPANION_ACTIONS.find(action=>action!==capture&&preset().bindings[action]===binding):undefined;const conflict:BindableAction|undefined=slotConflict??companionConflict;if(conflict){const box=root.querySelector<HTMLElement>('.binding-conflict')!;box.hidden=false;box.innerHTML=`<span>${bindingLabel(binding)} ya controla ${actionName(conflict)}.</span><button data-swap>Intercambiar</button><button data-cancel>Cancelar</button>`;box.querySelector<HTMLButtonElement>('[data-swap]')!.onclick=()=>{const target=capture!;const old=preset().bindings[target];preset().bindings[conflict]=old;preset().bindings[target]=binding;capture=null;commit();};box.querySelector<HTMLButtonElement>('[data-cancel]')!.onclick=()=>{capture=null;render();};return;}preset().bindings[capture]=binding;capture=null;commit();};
  window.addEventListener('keydown',captureEvent,true);window.addEventListener('mousedown',captureEvent,true);
  render();
  return {open(nextClassId:ClassId,nextValue:CharacterCustomization){classId=nextClassId;value=clone(nextValue);selected=activePreset(value).loadout.primary??availableSkills()[0].id;capture=null;root.hidden=false;render();},get value(){return clone(value);}};
}
