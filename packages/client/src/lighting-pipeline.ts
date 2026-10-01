import Phaser from 'phaser';
import { visualSettings } from './visual-effects';

export interface TerrainLight {
  x: number; y: number; color: number; radius: number; intensity: number; falloff?: number;
}
const VERTEX = `
precision highp float;
uniform mat4 uProjectionMatrix;
uniform vec4 uInverseCamera;
uniform vec2 uWorldOffset;
attribute vec2 inPosition;
attribute vec2 inTexCoord;
attribute float inTexId;
attribute float inTintEffect;
attribute vec4 inTint;
varying vec2 outTexCoord;
varying vec2 outWorld;
varying vec4 outTint;
void main () {
  gl_Position = uProjectionMatrix * vec4(inPosition, 1.0, 1.0);
  outTexCoord = inTexCoord;
  outTint = inTint;
  outWorld = vec2(dot(inPosition, uInverseCamera.xy), dot(inPosition, uInverseCamera.zw)) + uWorldOffset;
}`;
const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uMainSampler;
uniform sampler2D uLightMap;
uniform vec4 uLightBounds;
uniform float uStrength;
varying vec2 outTexCoord;
varying vec2 outWorld;
varying vec4 outTint;
void main () {
  vec4 base = texture2D(uMainSampler, outTexCoord) * vec4(outTint.bgr * outTint.a, outTint.a);
  vec2 lightUV = (outWorld - uLightBounds.xy) / uLightBounds.zw;
  vec3 illumination = min(texture2D(uLightMap, clamp(lightUV, 0.0, 1.0)).rgb * 2.0, vec3(1.75));
  gl_FragColor = vec4(mix(base.rgb, base.rgb * illumination, uStrength), base.a);
}`;
let serial = 0;

/** Two texture lookups per receiving pixel; light count does not increase fragment work. */
export class TerrainLightingPipeline extends Phaser.Renderer.WebGL.Pipelines.SinglePipeline {
  readonly capacity = 32;
  private lights: readonly TerrainLight[] = [];
  private strength = 0;
  private ambient: [number, number, number] = [.8, .82, .86];
  private camera?: Phaser.Cameras.Scene2D.Camera;
  private origin = new Phaser.Math.Vector2();
  private horizontal = new Phaser.Math.Vector2();
  private vertical = new Phaser.Math.Vector2();
  private lightmap: Phaser.Textures.CanvasTexture;
  private textureKey = `bandera-lightmap-${++serial}`;
  private bounds = new Phaser.Geom.Rectangle(0, 0, 1, 1);
  private lastUpload = -Infinity;
  private lastStrength = -1;

  constructor(game: Phaser.Game, _capacity = 32) {
    super({ game, vertShader: VERTEX, fragShader: FRAGMENT });
    const texture = game.textures.createCanvas(this.textureKey, 320, 192);
    if (!texture) throw new Error('Unable to allocate terrain lightmap');
    this.lightmap = texture;
    // Only low-frequency illumination is interpolated; source art retains nearest sampling.
    texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }

  configure(lights: readonly TerrainLight[], ambient: [number, number, number], strength: number) {
    this.lights = lights; this.ambient = ambient; this.strength = strength;
  }

  onRender(_scene: Phaser.Scene, camera: Phaser.Cameras.Scene2D.Camera) {
    this.camera = camera;
    const view = camera.worldView, now = this.game.loop.now;
    const margin = 64;
    const outside = view.left < this.bounds.left + margin / 2 || view.right > this.bounds.right - margin / 2 ||
      view.top < this.bounds.top + margin / 2 || view.bottom > this.bounds.bottom - margin / 2;
    if (this.lastStrength === this.strength && !outside && now - this.lastUpload < (visualSettings.low ? 1000 / 15 : 1000 / 30)) return;
    this.lastUpload = now; this.lastStrength = this.strength;
    this.bounds.setTo(view.x - margin, view.y - margin, Math.max(1, view.width + margin * 2), Math.max(1, view.height + margin * 2));
    const ctx = this.lightmap.context;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'copy';
    ctx.fillStyle = `rgb(${Math.round(this.ambient[0] * 127.5)},${Math.round(this.ambient[1] * 127.5)},${Math.round(this.ambient[2] * 127.5)})`;
    ctx.fillRect(0, 0, 320, 192);
    if (this.strength > 0) {
      const sx = 320 / this.bounds.width, sy = 192 / this.bounds.height;
      ctx.setTransform(sx, 0, 0, sy, -this.bounds.x * sx, -this.bounds.y * sy);
      ctx.globalCompositeOperation = 'lighter';
      for (const light of this.lights) {
        const radius = light.radius;
        const gradient = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, radius);
        const r = Math.round(((light.color >> 16) & 255) * Math.min(2, light.intensity) / 2);
        const g = Math.round(((light.color >> 8) & 255) * Math.min(2, light.intensity) / 2);
        const b = Math.round((light.color & 255) * Math.min(2, light.intensity) / 2);
        for (let i = 0; i <= 4; i++) {
          const fraction = i / 4, alpha = (1 - fraction) ** (light.falloff ?? 1.6);
          gradient.addColorStop(fraction, `rgba(${r},${g},${b},${alpha})`);
        }
        ctx.fillStyle = gradient;
        ctx.fillRect(light.x - radius, light.y - radius, radius * 2, radius * 2);
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over';
    this.lightmap.refresh();
  }

  onBind() {
    const camera = this.camera;
    if (!camera) return;
    camera.getWorldPoint(0, 0, this.origin); camera.getWorldPoint(1, 0, this.horizontal); camera.getWorldPoint(0, 1, this.vertical);
    this.set4f('uInverseCamera', this.horizontal.x - this.origin.x, this.vertical.x - this.origin.x,
      this.horizontal.y - this.origin.y, this.vertical.y - this.origin.y);
    this.set2f('uWorldOffset', this.origin.x, this.origin.y);
    this.set4f('uLightBounds', this.bounds.x, this.bounds.y, this.bounds.width, this.bounds.height);
    this.set1f('uStrength', this.strength); this.set1i('uLightMap', 1);
    const texture = this.lightmap.source[0].glTexture;
    if (texture) this.bindTexture(texture, 1);
  }

  destroy() {
    this.game.textures.remove(this.textureKey);
    return super.destroy();
  }
}
