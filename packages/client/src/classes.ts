import { CLASS_IDS, CLASSES, DEFAULT_CLASS, RULES, validClass, type ClassId } from '@bandera/shared';
import { classIllustration } from './art.js';

interface SkillPreview {
  name: string;
  icon: string;
  description: string;
  damage: string;
  cooldown: string;
}

const icon = (name: string) => `/assets/skills/${name}.png`;
const seconds = (value: number) => `${String(value).replace('.', ',')} s`;
const CLASS_SKILLS: Record<ClassId, SkillPreview[]> = {
  archer: [
    { name: 'Flecha del cazador', icon: icon('archer-arrow'), description: 'Tensá el arco para liberar una flecha de viento veloz y penetrante.', damage: `${RULES.arrowDamage}–${RULES.arrowDamage * RULES.chargeMultiplier}`, cooldown: seconds(RULES.archerShotCooldown) },
    { name: 'Paso del viento', icon: icon('archer-wind'), description: 'Una ráfaga evasiva que puede cargarse para recorrer más distancia.', damage: '0', cooldown: seconds(RULES.dashCooldown) },
    { name: 'Daga veloz', icon: icon('guardian-slash'), description: 'Corte corto y rápido para castigar enemigos demasiado cercanos.', damage: String(CLASSES.archer.meleeDamage).replace('.', ','), cooldown: seconds(CLASSES.archer.meleeCooldown) },
    { name: 'Cepo del bosque', icon: icon('archer-trap'), description: `Trampa oculta que hiere e inmoviliza durante ${seconds(RULES.trapStun)}.`, damage: String(RULES.trapDamage).replace('.', ','), cooldown: seconds(RULES.trapCooldown) },
    { name: 'Salva triple', icon: icon('archer-volley'), description: 'Libera tres flechas en sucesión; también hereda parte de la carga.', damage: `3 × ${RULES.arrowDamage}`, cooldown: seconds(RULES.volleyCooldown) },
    { name: 'Flecha del vendaval', icon: icon('archer-wind'), description: 'Tras un salto cargado, dispara una flecha que atraviesa guardias y escudos.', damage: String(RULES.arrowDamage * RULES.chargeMultiplier * RULES.windScale).replace('.', ','), cooldown: seconds(RULES.dashCooldown) },
  ],
  mage: [
    { name: 'Orbe de fuego', icon: icon('mage-fireball'), description: 'Conjurá una esfera ígnea; a carga máxima explota al impactar.', damage: `${RULES.arrowDamage}–2,5`, cooldown: seconds(RULES.shotCooldown) },
    { name: 'Traslación arcana', icon: icon('mage-dash'), description: 'Desplazamiento mágico que puede cargarse para ampliar su alcance.', damage: '0', cooldown: seconds(RULES.dashCooldown) },
    { name: 'Égida de dos sellos', icon: icon('mage-shield'), description: `Una barrera encantada que anula ${RULES.magicShieldHits} impactos.`, damage: '0', cooldown: seconds(RULES.magicShieldCooldown) },
    { name: 'Saeta glacial', icon: icon('mage-ice'), description: `Perfora con hielo arcano e inmoviliza durante ${seconds(RULES.freezeDuration)}.`, damage: '0', cooldown: seconds(RULES.iceCooldown) },
  ],
  necromancer: [
    { name: 'Llama de ultratumba', icon: icon('necromancer-fire'), description: 'Arrojá fuego espectral; canalizarlo aumenta su poder hasta el doble.', damage: `${RULES.fireDamage}–2`, cooldown: seconds(RULES.fireCooldown) },
    { name: 'Guardia de cadáveres', icon: icon('necromancer-summon'), description: 'Alza dos zombies que protegen el círculo del Nigromante y cazan enemigos.', damage: `${RULES.zombieDamage} por golpe`, cooldown: seconds(RULES.summonCooldown) },
    { name: 'Campeón putrefacto', icon: icon('vanguard-sword'), description: 'Un guardia caído regresa con espada, sube tres niveles y termina golpeando en área.', damage: `${String(RULES.swordZombieDamage).replace('.', ',')}–2,5`, cooldown: seconds(RULES.summonCooldown) },
    { name: 'Arcanista no-muerto', icon: icon('necromancer-mage'), description: 'Invoca un zombie mago que alterna fuego, hielo y ráfagas mientras crea lacayos.', damage: `${String(RULES.gustDamage).replace('.', ',')}–${String(RULES.spellDamage).replace('.', ',')}`, cooldown: seconds(RULES.summonCooldown) },
    { name: 'Rito de resurrección', icon: icon('necromancer-resurrection'), description: 'Abre una mandala y esclaviza a un rival caído, conservando su clase y habilidades.', damage: 'Según la clase', cooldown: seconds(RULES.thrallCooldown) },
    { name: 'Voluntad del amo', icon: icon('necromancer-resurrection'), description: 'Ordená a tus no-muertos o liberá su instinto de caza automático.', damage: '0', cooldown: '0 s' },
    { name: 'Marca funeraria', icon: icon('necromancer-resurrection'), description: 'Traslada al zombie señalado entre el círculo del amo y el cursor.', damage: '0', cooldown: '0 s' },
  ],
  guardian: [
    { name: 'Acero juramentado', icon: icon('guardian-slash'), description: 'Tajo frontal que puede cargarse para duplicar su fuerza.', damage: `${CLASSES.guardian.meleeDamage}–${CLASSES.guardian.meleeDamage * 2}`, cooldown: seconds(CLASSES.guardian.meleeCooldown) },
    { name: 'Carga del bastión', icon: icon('vanguard-dash'), description: 'Arremetida blindada que hiere y conserva la carga de la espada para combinar el golpe.', damage: String(RULES.guardianDashDamage), cooldown: seconds(RULES.guardianDashCooldown) },
    { name: 'Muralla de acero', icon: icon('guardian-shield'), description: 'Alzá el escudo para bloquear ataques dentro del arco frontal.', damage: '0', cooldown: seconds(RULES.guardCooldown) },
    { name: 'Impacto del baluarte', icon: icon('guardian-bash'), description: `Golpe de escudo que empuja y aturde durante ${seconds(RULES.shieldBashStun)}.`, damage: String(RULES.shieldBashDamage).replace('.', ','), cooldown: seconds(RULES.shieldBashCooldown) },
    { name: 'Furia dorada', icon: icon('guardian-fury'), description: `Durante ${seconds(RULES.furyDuration)}, la espada inflige un 40 % más de daño.`, damage: '+40 %', cooldown: seconds(RULES.furyCooldown) },
  ],
  vanguard: [
    { name: 'Mandoble colosal', icon: icon('vanguard-sword'), description: 'Un barrido pesado de gran alcance que puede cargarse para devastar.', damage: `${CLASSES.vanguard.meleeDamage}–${CLASSES.vanguard.meleeDamage * 2}`, cooldown: seconds(CLASSES.vanguard.meleeCooldown) },
    { name: 'Avance imparable', icon: icon('vanguard-dash'), description: 'Impulso de combate que conserva la carga de la espada para combinar ambas acciones.', damage: '0', cooldown: seconds(RULES.dashCooldown) },
    { name: 'Creciente escarlata', icon: icon('vanguard-slash'), description: 'Proyecta un tajo ancho que atraviesa a cuantos encuentre.', damage: String(RULES.slashDamage).replace('.', ','), cooldown: seconds(RULES.slashCooldown) },
    { name: 'Revancha de hierro', icon: icon('vanguard-counter'), description: 'Devuelve proyectiles y evita sus efectos; canalizado, duplica su daño y velocidad.', damage: '×1–×2', cooldown: seconds(RULES.counterCooldown) },
  ],
};

function skillPreviews(classId: ClassId) {
  return `<span class="class-skills" aria-label="Habilidades de ${CLASSES[classId].name}">${CLASS_SKILLS[classId]
    .map(
      (skill) =>
        `<span class="class-skill" role="img" aria-label="${skill.name}. ${skill.description} Daño: ${skill.damage}. Enfriamiento: ${skill.cooldown}."><img src="${skill.icon}" alt=""><span class="skill-tooltip"><b>${skill.name}</b><span>${skill.description}</span><span class="skill-meta"><em>DAÑO <strong>${skill.damage}</strong></em><em>ENFRIAMIENTO <strong>${skill.cooldown}</strong></em></span></span></span>`,
    )
    .join('')}</span>`;
}

export function savedClass(): ClassId { const saved=localStorage.getItem('bandera-class');return validClass(saved)?saved:DEFAULT_CLASS; }
export function saveClass(classId:ClassId) { localStorage.setItem('bandera-class',classId); }
export function mountClasses(root:HTMLElement, selected:ClassId, choose:(id:ClassId)=>void, customize?:(id:ClassId)=>void) {
  root.innerHTML=CLASS_IDS.map(id=>{const c=CLASSES[id];return `<article class="class-card" data-class-card="${id}" aria-pressed="${id===selected}"><button type="button" class="class-select" data-class="${id}" aria-pressed="${id===selected}" aria-label="Elegir ${c.name}: ${c.label.toLowerCase()}">${classIllustration(id)}<strong>${c.name}</strong><span class="class-equipment">${c.label}</span><span class="class-stats">${'♥'.repeat(c.hp)} · ${c.speed>=180?'LIGERO':'PESADO'}</span><small>${c.description}</small>${skillPreviews(id)}</button><button type="button" class="customize-class" data-customize="${id}" aria-label="Personalizar ${c.name}">PERSONALIZAR</button></article>`;}).join('');
  root.querySelectorAll<HTMLButtonElement>('[data-class]').forEach(b=>b.onclick=()=>choose(b.dataset.class as ClassId));
  root.querySelectorAll<HTMLButtonElement>('.customize-class').forEach(b=>b.onclick=()=>customize?.(b.dataset.customize as ClassId));
}
export function updateClasses(root:HTMLElement, selected:ClassId, disabled=false) {
  root.querySelectorAll<HTMLElement>('[data-class-card]').forEach(card=>card.setAttribute('aria-pressed',String(card.dataset.classCard===selected)));
  root.querySelectorAll<HTMLButtonElement>('[data-class]').forEach(b=>{b.disabled=disabled;b.setAttribute('aria-pressed',String(b.dataset.class===selected));});
}
export function updateClassSkin(root:HTMLElement,classId:ClassId,skinId:string){const button=root.querySelector<HTMLElement>(`[data-class="${classId}"]`);const old=button?.querySelector('svg');if(old)old.outerHTML=classIllustration(classId,skinId);}
