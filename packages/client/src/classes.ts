import { BLOOD_BOND, CELESTIAL_CUT, CLASS_IDS, CLASSES, DEFAULT_CLASS, curve, KNIGHT_AWAKEN, KNIGHT_FLURRY_COOLDOWN, KNIGHT_STEP, RULES, WARRIOR_LAUNCH, WARRIOR_PARRY, WARRIOR_REINFORCE, WARRIOR_SLASH_COOLDOWN, validClass, type ClassId } from '@bandera/shared';
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
    { name: 'Flecha del cazador', icon: icon('archer-arrow'), description: `Una flecha certera. Mantené ${seconds(RULES.chargeTime)} para tensar el arco: pega más, vuela un 30 % más rápido y, a carga completa, se vuelve viento que atraviesa a todos.`, damage: `${RULES.arrowDamage}–${RULES.arrowDamage * RULES.chargeMultiplier}`, cooldown: seconds(RULES.archerShotCooldown) },
    { name: 'Paso del viento', icon: icon('archer-wind'), description: 'El viento te levanta y te deja donde quisiste estar: un esquive rápido que, mantenido, llega hasta 1,8 veces más lejos.', damage: '0', cooldown: seconds(RULES.dashCooldown) },
    { name: 'Daga veloz', icon: icon('guardian-slash'), description: 'Un filo corto para el que se acercó demasiado: una puñalada rápida a quemarropa.', damage: String(CLASSES.archer.meleeDamage).replace('.', ','), cooldown: seconds(CLASSES.archer.meleeCooldown) },
    { name: 'Cepo del bosque', icon: icon('archer-trap'), description: `Un cepo escondido entre la hierba: quien lo pisa queda herido e inmovilizado ${seconds(RULES.trapStun)}. Hasta ${RULES.trapMax} a la vez, duran ${seconds(RULES.trapLife)}.`, damage: String(RULES.trapDamage).replace('.', ','), cooldown: seconds(RULES.trapCooldown) },
    { name: 'Salva triple', icon: icon('archer-volley'), description: 'Tres flechas que se abren como un abanico: de cerca entran las tres, de lejos se reparten. Con el arco tenso heredan un tercio de la carga.', damage: `3 × ${RULES.arrowDamage}`, cooldown: seconds(RULES.volleyCooldown) },
    { name: 'Flecha del vendaval', icon: icon('archer-wind'), description: 'En pleno salto cargado el arquero se vuelve tormenta: una flecha de viento que cruza la arena e ignora guardias y escudos.', damage: String(RULES.arrowDamage * RULES.chargeMultiplier * RULES.windScale).replace('.', ','), cooldown: seconds(RULES.dashCooldown) },
  ],
  mage: [
    { name: 'Orbe de fuego', icon: icon('mage-fireball'), description: `Una esfera de llama viva. Cargada ${seconds(RULES.overchargeTime)} dobla su tamaño, estalla al impactar y quema a los cercanos con la mitad del daño.`, damage: `${RULES.arrowDamage}–2,5`, cooldown: seconds(RULES.shotCooldown) },
    { name: 'Parpadeo', icon: icon('mage-blink'), description: `El mago pliega el espacio: mantené para alejar la puerta hasta ${RULES.mageBlinkRange} u y soltá para reaparecer junto al cursor, incluso tras un muro.`, damage: '0', cooldown: seconds(RULES.dashCooldown) },
    { name: 'Égida de dos sellos', icon: icon('mage-shield'), description: `Dos sellos arcanos giran alrededor del mago: cada uno anula un golpe, ${RULES.magicShieldHits} en total.`, damage: '0', cooldown: seconds(RULES.magicShieldCooldown) },
    { name: 'Saeta glacial', icon: icon('mage-ice'), description: `Una aguja de hielo arcano: quien la recibe queda congelado ${seconds(RULES.freezeDuration)}, sin moverse ni atacar.`, damage: '0', cooldown: seconds(RULES.iceCooldown) },
    { name: 'Singularidad', icon: icon('mage-blackhole'), description: `El conjuro prohibido: un punto que atrae a los enemigos y consume a quien llega a su centro. Cargalo hasta ${seconds(RULES.blackHoleChargeTime)} para que crezca y llegue más lejos; al final estalla.`, damage: '0,75–2,25; letal en el centro', cooldown: seconds(RULES.blackHoleCooldown) },
  ],
  necromancer: [
    { name: 'Vínculo de Sangre', icon: icon('necromancer-bloodbond'), description: `Un hilo de sangre atado a quien alcanza, rival, zombie o monstruo: mientras siga a menos de ${BLOOD_BOND.reach} u, cada segundo le roba ${String(BLOOD_BOND.drain).replace('.', ',')} de vida y te la da. Dura ${seconds(BLOOD_BOND.duration[0])}, ${seconds(BLOOD_BOND.duration[1])} cargado; se corta si se aleja.`, damage: `${String(BLOOD_BOND.damage[0]).replace('.', ',')} y ${String(BLOOD_BOND.drain).replace('.', ',')} por segundo`, cooldown: seconds(BLOOD_BOND.cooldown) },
    { name: 'Guardia de cadáveres', icon: icon('necromancer-summon'), description: `La tierra devuelve a sus muertos: dos zombies (${RULES.zombieHp} de vida) custodian tu círculo y muerden a quien lo pise.`, damage: `${RULES.zombieDamage} por golpe`, cooldown: seconds(RULES.summonCooldown) },
    { name: 'Campeón putrefacto', icon: icon('vanguard-sword'), description: `Si cae uno de tus zombies, el próximo vuelve con espada (${RULES.swordZombieHp} de vida): cada muerte que cobra lo hace más fuerte, hasta golpear a todos a su alrededor.`, damage: `${String(RULES.swordZombieDamage).replace('.', ',')}–2,5`, cooldown: seconds(RULES.summonCooldown) },
    { name: 'Arcanista no-muerto', icon: icon('necromancer-mage'), description: `Mantené la invocación: un hechicero no-muerto (${RULES.hatHp} de vida) que lanza fuego y hielo, se cura y levanta lacayos.`, damage: `${String(RULES.gustDamage).replace('.', ',')}–${String(RULES.spellDamage).replace('.', ',')}`, cooldown: seconds(RULES.summonCooldown) },
    { name: 'Rito de resurrección', icon: icon('necromancer-resurrection'), description: `Con el aura llena (${seconds(RULES.raiseCharge)}) junto a la tumba de un rival, su alma vuelve encadenada con su clase y sus técnicas para pelear por vos.`, damage: 'Según la clase', cooldown: seconds(RULES.thrallCooldown) },
    { name: 'Voluntad del amo', icon: icon('necromancer-resurrection'), description: 'Una orden y tus muertos te siguen; otra, y cazan solos a quien se acerque.', damage: '0', cooldown: '0 s' },
    { name: 'Marca funeraria', icon: icon('necromancer-resurrection'), description: 'Señalá a uno de tus muertos y el vínculo lo pasa de tu círculo a seguir tu mano, o de vuelta.', damage: '0', cooldown: '0 s' },
  ],
  guardian: [
    { name: 'Tres Cortes', icon: icon('guardian-slash'), description: 'La esgrima del relámpago: un corte, su regreso y el Tajo Descendente, que cae desde lo alto como un rayo y es crítico si conecta.', damage: '1 · 1 · 1,5', cooldown: '0 s' },
    { name: 'Filo cargado', icon: icon('guardian-slash'), description: 'Mantené para cargar el corte que sigue: hasta el doble de daño, un tajo que sale de la hoja y el poder de partir hechizos en el aire. El del descendente desgarra el suelo.', damage: 'hasta ×2', cooldown: '0 s' },
    { name: 'Ráfaga de Acero', icon: icon('guardian-flurry'), description: 'Tres relámpagos que electrizan y juntos aturden; dos cortes cruzados a media carga; y a fondo, el Corte Celestial, un tajo de luz dorada que cruza el mapa, devastador de cerca.', damage: `0,5 · 0,5 · 0,75 · 2 × 1 · ${String(CELESTIAL_CUT.damage).replace('.', ',')}`, cooldown: seconds(KNIGHT_FLURRY_COOLDOWN) },
    { name: 'Paso Relámpago', icon: icon('guardian-step'), description: `El cuerpo se vuelve rayo y cruza de ${KNIGHT_STEP.near} a ${KNIGHT_STEP.far} u en un destello, aun en medio de un corte; quien se interpone queda electrizado.`, damage: '1–1,5', cooldown: seconds(KNIGHT_STEP.cooldown) },
    { name: 'Despertar del Relámpago', icon: icon('guardian-awaken'), description: `El sello del trueno se abre y el relámpago violeta de los dioses desciende sobre el Caballero: durante ${seconds(KNIGHT_AWAKEN.duration)} cada técnica despierta su forma eléctrica, más feroz y electrizante.`, damage: `+${Math.round((KNIGHT_AWAKEN.damage - 1) * 100)} %`, cooldown: seconds(KNIGHT_AWAKEN.cooldown) },
  ],
  vanguard: [
    { name: 'Mandoble del Titán', icon: icon('vanguard-titan'), description: 'El Barrido del Titán arrasa el frente y la Caída de Montaña se desploma desde lo alto; cargados, la fuerza desborda el acero en una onda escarlata.', damage: '2 · 2,5; hasta ×1,75', cooldown: '0 s' },
    { name: 'Creciente Escarlata', icon: icon('vanguard-crescent'), description: 'Una luna de sangre que crece mientras la cargás y corta lo que le lanzan: flechas, orbes y, completa a los 3 s, tajos y olas. Sobrecargada, cruza el mapa.', damage: '1,5–5', cooldown: `${seconds(WARRIOR_SLASH_COOLDOWN)} o más` },
    { name: 'Parry', icon: icon('vanguard-parry'), description: 'Nunca tuvo talento para la magia, así que entrenó lo único que tenía hasta dominarlo como nadie: parar. A tiempo devuelve lo que le lanzan; sostenido, lo devuelve más rápido, más fuerte y más grande, hasta una Singularidad.', damage: 'devuelve el ataque, hasta ×2', cooldown: `${seconds(WARRIOR_PARRY.successCooldown)} si acierta · ${seconds(curve(WARRIOR_PARRY.cooldown, 0))} o más si falla` },
    { name: 'Embestida Sísmica', icon: icon('vanguard-seismic'), description: `La tierra cede bajo el pie y el Guerrero sale como un alud hasta ${WARRIOR_LAUNCH.far} u, apartando a quien se cruce.`, damage: String(WARRIOR_LAUNCH.hit.damage).replace('.', ','), cooldown: seconds(WARRIOR_LAUNCH.cooldown) },
    { name: 'Cuerpo de Titán', icon: icon('vanguard-titanbody'), description: `Lo que otros logran con hechizos, él lo logra con el cuerpo: durante ${seconds(WARRIOR_REINFORCE.duration)} recibe un ${Math.round((1 - WARRIOR_REINFORCE.taken) * 100)} % menos de daño, nada lo mueve y cada golpe desata una onda.`, damage: `−${Math.round((1 - WARRIOR_REINFORCE.taken) * 100)} % recibido`, cooldown: seconds(WARRIOR_REINFORCE.cooldown) },
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
