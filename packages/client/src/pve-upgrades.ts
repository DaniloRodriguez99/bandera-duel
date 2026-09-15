import type { UpgradeId } from '@bandera/shared';

import archerProjectiles from './assets/pve-upgrades/archerProjectiles.png';
import guardianVigor from './assets/pve-upgrades/guardianVigor.png';
import haste from './assets/pve-upgrades/haste.png';
import mageElements from './assets/pve-upgrades/mageElements.png';
import necromancerArmy from './assets/pve-upgrades/necromancerArmy.png';
import power from './assets/pve-upgrades/power.png';
import regeneration from './assets/pve-upgrades/regeneration.png';
import resistance from './assets/pve-upgrades/resistance.png';
import reviveAlly from './assets/pve-upgrades/reviveAlly.png';
import secondChance from './assets/pve-upgrades/secondChance.png';
import speed from './assets/pve-upgrades/speed.png';
import vanguardMastery from './assets/pve-upgrades/vanguardMastery.png';
import vitality from './assets/pve-upgrades/vitality.png';

export const UPGRADE_ORDER: UpgradeId[] = [
  'power',
  'vitality',
  'haste',
  'speed',
  'regeneration',
  'resistance',
  'secondChance',
  'reviveAlly',
  'archerProjectiles',
  'mageElements',
  'necromancerArmy',
  'guardianVigor',
  'vanguardMastery',
];

export const UPGRADE_META: Record<UpgradeId, { title: string; short: string; icon: string }> = {
  power: { title: 'Fuerza', short: 'Daño', icon: power },
  vitality: { title: 'Vitalidad', short: 'Vida máxima', icon: vitality },
  haste: { title: 'Celeridad', short: 'Recargas', icon: haste },
  speed: { title: 'Paso ligero', short: 'Movimiento', icon: speed },
  regeneration: { title: 'Regeneración', short: 'Curación', icon: regeneration },
  resistance: { title: 'Armadura', short: 'Resistencia', icon: resistance },
  secondChance: { title: 'Segunda oportunidad', short: 'Revivir', icon: secondChance },
  reviveAlly: { title: 'Revivir compañero', short: 'Aliado', icon: reviveAlly },
  archerProjectiles: { title: 'Viento certero', short: 'Arquero', icon: archerProjectiles },
  mageElements: { title: 'Núcleo elemental', short: 'Mago', icon: mageElements },
  necromancerArmy: { title: 'Legión impía', short: 'Nigromante', icon: necromancerArmy },
  guardianVigor: { title: 'Acero imparable', short: 'Guardián', icon: guardianVigor },
  vanguardMastery: { title: 'Maestría pesada', short: 'Guerrero', icon: vanguardMastery },
};
