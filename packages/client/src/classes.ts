import { CELESTIAL_CUT, CLASS_IDS, CLASSES, DEFAULT_CLASS, curve, KNIGHT_AWAKEN, KNIGHT_FLURRY_COOLDOWN, KNIGHT_STEP, RULES, WARRIOR_LAUNCH, WARRIOR_PARRY, WARRIOR_REINFORCE, WARRIOR_SLASH_COOLDOWN, validClass, type ClassId } from '@bandera/shared';
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
    { name: 'Parpadeo', icon: icon('mage-blink'), description: 'Mantené para ampliar el alcance hasta 260 u en 2 s y soltá: reaparecés junto al cursor, incluso tras un muro. Nunca antes de 0,5 s.', damage: '0', cooldown: seconds(RULES.dashCooldown) },
    { name: 'Égida de dos sellos', icon: icon('mage-shield'), description: `Una barrera encantada que anula ${RULES.magicShieldHits} impactos.`, damage: '0', cooldown: seconds(RULES.magicShieldCooldown) },
    { name: 'Saeta glacial', icon: icon('mage-ice'), description: `Perfora con hielo arcano e inmoviliza durante ${seconds(RULES.freezeDuration)}.`, damage: '0', cooldown: seconds(RULES.iceCooldown) },
    { name: 'Singularidad', icon: icon('mage-blackhole'), description: 'Mantené hasta 2 s para agrandarlo, dañar más y llegar más lejos. Soltá para lanzarlo: su núcleo consume a quien llega al centro y estalla contra un muro, al volver a pulsar o tras atraer 2,5 s en destino.', damage: '0,75–2,25; letal en el centro', cooldown: seconds(RULES.blackHoleCooldown) },
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
    { name: 'Tres Cortes', icon: icon('guardian-slash'), description: 'Un corte de derecha a izquierda, su regreso y el Tajo Descendente, que baja en diagonal desde el hombro, crítico si conecta. La hoja golpea por donde pasa.', damage: '1 · 1 · 1,5', cooldown: '0 s' },
    { name: 'Filo cargado', icon: icon('guardian-slash'), description: 'Mantené el corte que sigue: pega hasta el doble, lanza su tajo y corta habilidades enemigas. El descendente abre una grieta de energía a ras del suelo.', damage: 'hasta ×2', cooldown: '0 s' },
    { name: 'Ráfaga de Acero', icon: icon('guardian-flurry'), description: 'Tres golpes eléctricos que juntos aturden; a media carga, dos cortes cruzados; a fondo, el Corte Celestial: un tajo blanco y dorado que cruza el mapa, devastador de cerca.', damage: `0,5 · 0,5 · 0,75 · 2 × 1 · ${String(CELESTIAL_CUT.damage).replace('.', ',')}`, cooldown: seconds(KNIGHT_FLURRY_COOLDOWN) },
    { name: 'Paso Relámpago', icon: icon('guardian-step'), description: 'El cuerpo se carga de relámpago y sale hacia donde apunta, aun en medio de un corte; cargado llega más lejos. Electriza a quien atraviesa.', damage: '1–1,5', cooldown: seconds(KNIGHT_STEP.cooldown) },
    { name: 'Despertar del Relámpago', icon: icon('guardian-awaken'), description: `Un mandala baja por el cuerpo y el relámpago violeta lo toma ${seconds(KNIGHT_AWAKEN.duration)}: cada técnica es su versión eléctrica, más fuerte y electrizante.`, damage: `+${Math.round((KNIGHT_AWAKEN.damage - 1) * 100)} %`, cooldown: seconds(KNIGHT_AWAKEN.cooldown) },
  ],
  vanguard: [
    { name: 'Mandoble del Titán', icon: icon('vanguard-titan'), description: 'El Barrido del Titán y la Caída de Montaña, desde arriba: lentos y enormes. Cargados, mandan una onda roja hacia adelante.', damage: '2 · 2,5; hasta ×1,75', cooldown: '0 s' },
    { name: 'Creciente Escarlata', icon: icon('vanguard-crescent'), description: 'Un tajo que crece mientras lo cargás y corta lo que le lanzan: de sangre y violeta corta flechas; completo, a los 3 s, arde y parte tajos y olas; sobrecargado, cruza el mapa y lo parte todo.', damage: '1,5–5', cooldown: `${seconds(WARRIOR_SLASH_COOLDOWN)} o más` },
    { name: 'Represalia del Coloso', icon: icon('vanguard-reprisal'), description: 'Una guardia de frente. A tiempo devuelve lo que llega; mantenida, un mandala naranja endurece el cuerpo y lo devuelve más rápido, más fuerte y más grande, hasta una Singularidad.', damage: 'devuelve el ataque, hasta ×2', cooldown: `${seconds(WARRIOR_PARRY.successCooldown)} si acierta · ${seconds(curve(WARRIOR_PARRY.cooldown, 0))} o más si falla` },
    { name: 'Embestida Sísmica', icon: icon('vanguard-seismic'), description: 'Carga las piernas, el suelo cede y sale despedido hacia donde apunta, apartando a quien se cruce.', damage: String(WARRIOR_LAUNCH.hit.damage).replace('.', ','), cooldown: seconds(WARRIOR_LAUNCH.cooldown) },
    { name: 'Cuerpo de Titán', icon: icon('vanguard-titanbody'), description: `Un mandala rojo refuerza el cuerpo ${seconds(WARRIOR_REINFORCE.duration)}: menos daño, nada lo empuja y cada golpe manda su onda.`, damage: `−${Math.round((1 - WARRIOR_REINFORCE.taken) * 100)} % recibido`, cooldown: seconds(WARRIOR_REINFORCE.cooldown) },
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
