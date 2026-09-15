import { MAGE_SKINS, SKILLS, SKILL_SLOTS, activePreset, defaultCustomization, validCustomization, type BindableAction, type CharacterCustomization, type PhysicalBinding, type SkillId, type SkillSlot } from '@bandera/shared';

const STORAGE='bandera-customization:v1';
const ALLOWED = new Set<PhysicalBinding>(['MouseLeft','MouseRight','MouseMiddle','Space','Shift','Ctrl','KeyQ','KeyE','KeyR','KeyF','KeyC','KeyX','KeyZ','KeyV','KeyG','KeyT']);
const slotNames:Record<SkillSlot,string>={primary:'Primaria',secondary:'Secundaria',mobility:'Movilidad',skill1:'Habilidad I',skill2:'Habilidad II'};
const actionName=(action:BindableAction)=>action==='companionCommand'?'Mando':slotNames[action];
const BINDING_LABELS:Record<string,string>={MouseLeft:'CLIC IZQ.',MouseRight:'CLIC DER.',MouseMiddle:'CLIC CENTRAL',Space:'ESPACIO',Shift:'SHIFT',Ctrl:'CTRL'};
const bindingLabel=(binding:PhysicalBinding)=>BINDING_LABELS[binding]??binding.replace('Key','');
const clone=<T>(value:T):T=>structuredClone(value);

export function loadMageCustomization():CharacterCustomization {
  try { const value=JSON.parse(localStorage.getItem(STORAGE)??'null'); if(validCustomization('mage',value))return value; } catch { /* corrupted profiles fall back safely */ }
  return defaultCustomization('mage');
}
export function saveMageCustomization(value:CharacterCustomization){ localStorage.setItem(STORAGE,JSON.stringify(value)); }

export function mountMageCustomization(root:HTMLElement, initial:CharacterCustomization, onChange:(value:CharacterCustomization)=>void){
  let value=clone(initial), selected:SkillId='mage.fireball', tab:'skills'|'skins'='skills', capture:BindableAction|null=null;
  const preset=()=>activePreset(value);
  const commit=()=>{saveMageCustomization(value);onChange(clone(value));render();};
  const render=()=>{
    const skin=MAGE_SKINS.find(item=>item.id===value.selectedSkin)??MAGE_SKINS[0];
    const skill=SKILLS[selected];
    root.innerHTML=`<div class="custom-shell" role="dialog" aria-modal="true" aria-labelledby="custom-title">
      <header><div><small>PERSONAJE · MAGO</small><h2 id="custom-title">Forjá tu arcanista</h2></div><button class="custom-close" aria-label="Cerrar">×</button></header>
      <div class="custom-preview" style="--cloth:${skin.cloth};--light:${skin.light};--accent:${skin.accent}"><div class="mage-preview ${skin.silhouette}"><i></i><b></b><span></span></div><strong>${skin.name}</strong><small>${skin.description}</small></div>
      <nav><button data-tab="skins" aria-pressed="${tab==='skins'}">SKINS</button><button data-tab="skills" aria-pressed="${tab==='skills'}">HABILIDADES</button></nav>
      <section class="custom-center">${tab==='skins'?`<div class="skin-grid">${MAGE_SKINS.map(item=>`<button data-skin="${item.id}" aria-pressed="${item.id===value.selectedSkin}" style="--swatch:${item.cloth};--accent:${item.accent}"><i></i><span>${item.name}</span></button>`).join('')}</div>`:`<div class="skill-tree"><h3>ARCANO</h3>${(['mage.fireball','mage.magicShield','mage.ice','common.dash'] as SkillId[]).map(id=>skillNode(id)).join('')}<h3>ARTES PROHIBIDAS</h3>${(['necromancer.fire','necromancer.summon'] as SkillId[]).map(id=>skillNode(id)).join('')}</div>`}</section>
      <aside class="skill-detail"><img src="/assets/skills/${skill.icon}.png" alt=""><small>${skill.branch.toUpperCase()}</small><h3>${skill.name}</h3><p>${skill.description}</p><dl><div><dt>DAÑO</dt><dd>${skill.damage}</dd></div><div><dt>ENFRIAMIENTO</dt><dd>${String(skill.cooldown).replace('.',',')} s</dd></div><div><dt>ACTIVACIÓN</dt><dd>${skill.trigger==='hold-release'?'Mantener y soltar':skill.trigger==='hold'?'Mantener':'Pulsar'}</dd></div></dl>${selected==='necromancer.summon'?'<p class="included">INCLUYE · Mando, Marcar, zombie con espada, zombie mago y resurrección.</p>':''}</aside>
      <footer><div class="loadout-title"><div><small>LOADOUT ACTIVO</small><strong>PRESET DEFAULT</strong></div><button data-reset="all">Restablecer todo</button></div><div class="loadout-grid">${SKILL_SLOTS.map(slot=>slotCard(slot)).join('')}</div>${Object.values(preset().loadout).includes('necromancer.summon')?`<div class="context-binding"><span><strong>Mando</strong><small>Marcar: Ctrl + este control</small></span><button class="binding" data-bind="companionCommand">${capture==='companionCommand'?'PULSÁ UNA TECLA…':bindingLabel(preset().bindings.companionCommand)}</button><button data-reset="companionCommand">↺</button></div>`:''}<p class="binding-note">Elegí una habilidad y luego un slot resaltado. Tocá una tecla para cambiar un control. WASD, flechas, Escape, Tab, Enter, sistema y F1–F12 están reservadas.</p><div class="binding-conflict" hidden></div></footer>
    </div>`;
    bind();
  };
  const skillNode=(id:SkillId)=>{const skill=SKILLS[id],equipped=Object.values(preset().loadout).includes(id);return `<button class="skill-node" data-skill="${id}" aria-pressed="${id===selected}"><img src="/assets/skills/${skill.icon}.png" alt=""><span><strong>${skill.name}</strong><small>${equipped?'EQUIPADA':'DISPONIBLE'}</small></span></button>`;};
  const slotCard=(slot:SkillSlot)=>{const id=preset().loadout[slot],skill=id?SKILLS[id]:null,compatible=SKILLS[selected].compatibleSlots.includes(slot);return `<article class="loadout-slot ${compatible?'compatible':''}" data-slot="${slot}"><small>${slotNames[slot]}</small>${skill?`<img src="/assets/skills/${skill.icon}.png" alt=""><strong>${skill.name}</strong>`:'<span class="empty-skill">VACÍO</span>'}<button class="binding" data-bind="${slot}">${capture===slot?'PULSÁ UNA TECLA…':bindingLabel(preset().bindings[slot])}</button>${id?`<button class="slot-reset" data-reset="${slot}">↺</button>`:''}</article>`;};
  const bind=()=>{
    root.querySelector<HTMLButtonElement>('.custom-close')!.onclick=()=>{root.hidden=true;capture=null;};
    root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(button=>button.onclick=()=>{tab=button.dataset.tab as typeof tab;render();});
    root.querySelectorAll<HTMLButtonElement>('[data-skin]').forEach(button=>button.onclick=()=>{value.selectedSkin=button.dataset.skin!;commit();});
    root.querySelectorAll<HTMLButtonElement>('[data-skill]').forEach(button=>button.onclick=()=>{selected=button.dataset.skill as SkillId;render();});
    root.querySelectorAll<HTMLElement>('[data-slot]').forEach(card=>card.onclick=(event)=>{if((event.target as HTMLElement).closest('button'))return;const slot=card.dataset.slot as SkillSlot;if(!SKILLS[selected].compatibleSlots.includes(slot))return;for(const current of SKILL_SLOTS)if(preset().loadout[current]===selected)preset().loadout[current]=null;preset().loadout[slot]=selected;if(!preset().skillTreeSelection.includes(selected))preset().skillTreeSelection.push(selected);commit();});
    root.querySelectorAll<HTMLButtonElement>('[data-bind]').forEach(button=>button.onclick=()=>{capture=button.dataset.bind as BindableAction;render();});
    root.querySelectorAll<HTMLButtonElement>('[data-reset]').forEach(button=>button.onclick=()=>{const target=button.dataset.reset;if(target==='all')value=defaultCustomization('mage');else if(target==='companionCommand')preset().bindings.companionCommand=defaultCustomization('mage').presets.default.bindings.companionCommand;else {const slot=target as SkillSlot;preset().loadout[slot]=defaultCustomization('mage').presets.default.loadout[slot];preset().bindings[slot]=defaultCustomization('mage').presets.default.bindings[slot];}commit();});
  };
  const physical=(event:KeyboardEvent|MouseEvent):PhysicalBinding|undefined=>event instanceof MouseEvent?(event.button===0?'MouseLeft':event.button===1?'MouseMiddle':event.button===2?'MouseRight':undefined):event.code==='ControlLeft'||event.code==='ControlRight'?'Ctrl':event.code==='ShiftLeft'||event.code==='ShiftRight'?'Shift':event.code as PhysicalBinding;
  const captureEvent=(event:KeyboardEvent|MouseEvent)=>{if(root.hidden||!capture||(event.target as HTMLElement)?.closest?.('.binding-conflict'))return;const binding=physical(event);event.preventDefault();if(!binding||!ALLOWED.has(binding))return;const slotConflict=SKILL_SLOTS.find(slot=>slot!==capture&&preset().loadout[slot]&&preset().bindings[slot]===binding);const commandConflict=capture!=='companionCommand'&&Object.values(preset().loadout).includes('necromancer.summon')&&preset().bindings.companionCommand===binding?'companionCommand':undefined;const conflict:BindableAction|undefined=slotConflict??commandConflict;if(conflict){const box=root.querySelector<HTMLElement>('.binding-conflict')!;box.hidden=false;box.innerHTML=`<span>${bindingLabel(binding)} ya controla ${actionName(conflict)}.</span><button data-swap>Intercambiar</button><button data-cancel>Cancelar</button>`;box.querySelector<HTMLButtonElement>('[data-swap]')!.onclick=()=>{const target=capture!;const old=preset().bindings[target];preset().bindings[conflict]=old;preset().bindings[target]=binding;capture=null;commit();};box.querySelector<HTMLButtonElement>('[data-cancel]')!.onclick=()=>{capture=null;render();};return;}preset().bindings[capture]=binding;capture=null;commit();};
  window.addEventListener('keydown',captureEvent,true);window.addEventListener('mousedown',captureEvent,true);
  render();
  return {open(){root.hidden=false;render();},get value(){return clone(value);}};
}
