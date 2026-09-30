import type Phaser from 'phaser';

export const visualSettings = {
  low: localStorage.getItem('bandera-fx') === 'low',
  shake: localStorage.getItem('bandera-shake') !== 'off',
  get reduced() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; },
};

/** Fixed-size pool: decorative effects cannot accumulate during long battles. */
export class ParticlePool {
  private particles: { shape: Phaser.GameObjects.Rectangle; life: number; duration: number; vx: number; vy: number }[] = [];
  private cursor = 0;
  constructor(private scene: Phaser.Scene) {}
  burst(x: number, y: number, color: number, count: number, speed = 40, duration = 350) {
    const limit = visualSettings.low ? 96 : 192;
    count = Math.ceil(count * (visualSettings.low ? .5 : 1) * (visualSettings.reduced ? .5 : 1));
    for (let i = 0; i < count; i++) {
      const index = this.cursor++ % limit;
      let p = this.particles[index];
      if (!p) this.particles[index] = p = { shape: this.scene.add.rectangle(0, 0, 2, 2, color).setDepth(19), life: 0, duration, vx: 0, vy: 0 };
      const a = i * 2.399 + this.cursor;
      p.life = p.duration = duration; p.vx = Math.cos(a) * speed; p.vy = Math.sin(a) * speed;
      p.shape.setPosition(x, y).setFillStyle(color).setAlpha(.8).setVisible(true);
    }
  }
  update(delta: number) {
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      p.life -= delta;
      p.shape.x += p.vx * delta / 1000; p.shape.y += p.vy * delta / 1000;
      p.shape.setAlpha(Math.max(0, p.life / p.duration) * .8).setVisible(p.life > 0);
    }
  }
  clear() { for (const p of this.particles) { p.life = 0; p.shape.setVisible(false); } }
}
