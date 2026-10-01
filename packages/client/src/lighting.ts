import Phaser from 'phaser';
import { visualSettings } from './visual-effects';

export interface LightingEnvironment {
  width: number;
  height: number;
  theme: string;
  arena: boolean;
}

/** Hard bounds, independent of map size and the number of combat events. */
export const LIGHTING_BUDGETS = {
  low: { pools: 2, flashes: 2 },
  medium: { pools: 4, flashes: 4 },
  high: { pools: 6, flashes: 6 },
} as const;

const TEXTURE = 'bandera-light-falloff-v1';
const FLOOR_LIGHT = 1.25; // Above baked terrain; below shadows, traps, objectives and actors.
const FLASH_DURATION = 220;
type Light = { image: Phaser.GameObjects.Image; life: number; radius: number };

/** Cosmetic terrain illumination. No network, collision, camera or actor state is changed. */
export class LightingManager {
  private pools: Light[] = [];
  private flashes: Light[] = [];
  private ambient: Phaser.GameObjects.Rectangle;
  private cursor = 0;
  private destroyed = false;
  private environment?: LightingEnvironment;

  constructor(private scene: Phaser.Scene) {
    // One reusable 64px texture, retained by the game's texture manager across scene restarts.
    if (!scene.textures.exists(TEXTURE)) {
      const texture = scene.textures.createCanvas(TEXTURE, 64, 64);
      if (texture) {
        const ctx = texture.context;
        const pixels = ctx.createImageData(64, 64);
        for (let y = 0; y < 64; y++) {
          for (let x = 0; x < 64; x++) {
            const distance = Math.hypot(x - 31.5, y - 31.5) / 32;
            const alpha = Math.max(0, 1 - distance);
            const index = (y * 64 + x) * 4;
            pixels.data[index] = pixels.data[index + 1] = pixels.data[index + 2] = 255;
            pixels.data[index + 3] = Math.round(alpha * alpha * 255);
          }
        }
        ctx.putImageData(pixels, 0, 0);
        texture.refresh();
        texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }
    this.ambient = scene.add.rectangle(0, 0, 1, 1, 0x182934, 0)
      .setOrigin(0, 0).setDepth(FLOOR_LIGHT - .05).setVisible(false);
    if (scene.textures.exists(TEXTURE)) {
      for (let i = 0; i < LIGHTING_BUDGETS.high.pools; i++) this.pools.push(this.makeLight());
      for (let i = 0; i < LIGHTING_BUDGETS.high.flashes; i++) this.flashes.push(this.makeLight());
    }
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  private makeLight(): Light {
    return {
      image: this.scene.add.image(0, 0, TEXTURE).setDepth(FLOOR_LIGHT).setVisible(false),
      life: 0,
      radius: 100,
    };
  }

  setEnvironment(environment: LightingEnvironment) {
    if (this.destroyed) return;
    this.environment = { ...environment };
    const { width, height, theme, arena } = environment;
    const ash = theme === 'ceniza' || theme === 'ruins';
    const swamp = theme === 'cienaga';
    const cool = swamp ? 0x71aaa0 : ash ? 0xa6a2c9 : 0x93bdd2;
    const warm = ash ? 0xe6a575 : swamp ? 0xcacb8a : 0xe8d2a0;
    this.ambient.setSize(width, height).setFillStyle(ash ? 0x302238 : swamp ? 0x152d2a : 0x172d38);
    // Mirrored placement keeps arena teams equally legible. These are broad ambient pools,
    // not fake torches or interactable sources. World light stays deliberately sparse.
    const positions = [[.2, .28], [.8, .72], [.8, .28], [.2, .72], [.5, .2], [.5, .8]];
    for (let i = 0; i < this.pools.length; i++) {
      const light = this.pools[i];
      light.radius = Math.min(arena ? 175 : 220, Math.min(width, height) * .3);
      light.image.setPosition(Math.round(width * positions[i][0]), Math.round(height * positions[i][1]))
        .setDisplaySize(light.radius * 2, light.radius * 1.5).setTint(i < 2 ? warm : cool);
    }
    for (const light of this.flashes) { light.life = 0; light.image.setVisible(false); }
    this.update(0, 0);
  }

  flash(x: number, y: number, color: number) {
    if (this.destroyed || !this.environment || visualSettings.intensity <= 0 || visualSettings.reduced) return;
    const budget = LIGHTING_BUDGETS[visualSettings.quality];
    if (!this.flashes.length || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const light = this.flashes[this.cursor++ % budget.flashes];
    light.life = FLASH_DURATION;
    light.radius = 42;
    light.image.setPosition(x, y).setTint(color).setDisplaySize(84, 64)
      .setAlpha(.2 * visualSettings.intensity).setVisible(true);
  }

  update(time: number, delta: number) {
    if (this.destroyed || !this.environment) return;
    const intensity = Phaser.Math.Clamp(visualSettings.intensity, 0, 1);
    const budget = LIGHTING_BUDGETS[visualSettings.quality];
    const reduced = visualSettings.reduced;
    this.ambient.setAlpha(.028 * intensity).setVisible(intensity > 0);
    const view = this.scene.cameras.main.worldView;
    for (let i = 0; i < this.pools.length; i++) {
      const light = this.pools[i];
      const visible = intensity > 0 && i < budget.pools &&
        light.image.x + light.radius >= view.left && light.image.x - light.radius <= view.right &&
        light.image.y + light.radius >= view.top && light.image.y - light.radius <= view.bottom;
      light.image.setVisible(visible);
      if (visible) {
        const breath = reduced || visualSettings.quality === 'low' ? 1 : 1 + Math.sin(time * .00065 + i * 2) * .06;
        light.image.setAlpha(.13 * intensity * breath);
      }
    }
    for (let i = 0; i < this.flashes.length; i++) {
      const light = this.flashes[i];
      light.life = Math.max(0, light.life - Math.max(0, delta));
      if (intensity === 0 || reduced || i >= budget.flashes) light.life = 0;
      light.image.setVisible(light.life > 0);
      if (light.life > 0) light.image.setAlpha(.2 * intensity * light.life / FLASH_DURATION);
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.ambient.destroy();
    for (const light of this.pools) light.image.destroy();
    for (const light of this.flashes) light.image.destroy();
    this.pools.length = this.flashes.length = 0;
  }
}
