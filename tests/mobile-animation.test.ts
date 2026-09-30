import { describe, it, expect } from 'vitest';
import { facingFor, Locomotion } from '../packages/client/src/locomotion';
import { pose } from '../packages/client/src/directional-art';
import { CLASS_ART, characterSkinArt, LOOK_ART } from '../packages/client/src/art';
import { CHARACTER_SKINS, CLASS_IDS } from '@bandera/shared';
import { normalizeServer, roomCode, invitation } from '../packages/client/src/mobile-connection';

describe('mobile connection', () => {
  it('normalizes secure URLs and only permits insecure development endpoints explicitly', () => {
    expect(normalizeServer(' https://game.example/ ')).toBe('wss://game.example');
    expect(normalizeServer('ws://192.168.1.5:2567', true)).toBe('ws://192.168.1.5:2567');
    for (const value of ['http://game.example', 'ftp://game.example', 'https://u:p@game.example', 'https://game.example/?secret=x', 'localhost:2567'])
      expect(() => normalizeServer(value)).toThrow();
  });
  it('accepts room codes and web invitations without leaking the native origin', () => {
    expect(roomCode('AbC_123-x')).toBe('AbC_123-x');
    expect(roomCode('https://game.example/?sala=AbC_123-x')).toBe('AbC_123-x');
    expect(invitation('AbC_123-x', true)).toBe('AbC_123-x');
    expect(invitation('AbC_123-x', true, 'https://game.example')).toBe('https://game.example/?sala=AbC_123-x');
    for (const code of ['<script>', 'https://game.example/', '', 'abc']) expect(() => roomCode(code)).toThrow();
  });
});
describe('directional locomotion', () => {
  it('maps all eight directions and keeps facing on stopping', () => {
    for (let i = 0; i < 8; i++) expect(facingFor(Math.cos(i*Math.PI/4),Math.sin(i*Math.PI/4))).toBe(i);
    const state = new Locomotion(); state.update(10, 10, 16); state.update(0, 10, 16);
    expect(state.facing).toBe(4); expect(state.moving).toBe(true);
    state.update(0, 10, 120); expect(state.moving).toBe(false); expect(state.facing).toBe(4);
  });
  it('advances by distance, freezes, and resets after teleports or respawn', () => {
    const state = new Locomotion(); state.update(0,0,16); state.update(10,0,16);
    expect(state.phase).toBe(2);
    state.update(20,0,16,true); expect(state.moving).toBe(false); expect(state.phase).toBe(2);
    state.update(200,0,16); expect(state.phase).toBe(0); expect(state.moving).toBe(false);
    state.update(210,0,16); state.update(210,0,16,false,true); expect(state.phase).toBe(0);
  });
  it('ignores tiny reconciliation jitter', () => {
    const state = new Locomotion(); state.update(10,10,16);
    for (let i=0;i<50;i++) state.update(10+(i%2)*.1,10,16);
    expect(state.moving).toBe(false); expect(state.facing).toBe(2);
  });
  it('produces distinct front, back, profile and walking poses for all appearances', () => {
    const appearances = [...Object.values(CLASS_ART), ...Object.values(LOOK_ART), ...CLASS_IDS.flatMap(id => CHARACTER_SKINS[id].map(skin => characterSkinArt(id,skin.id)))];
    for (const rows of appearances) {
      expect(pose(rows,2,0)).not.toEqual(pose(rows,6,0));
      expect(pose(rows,2,0)).not.toEqual(pose(rows,0,0));
      const walk = new Set(Array.from({length:6},(_,i)=>pose(rows,2,i+2).join('')));
      expect(walk.size).toBe(6);
      for(let d=0;d<8;d++) for(let f=0;f<8;f++) {
        const pixels = pose(rows,d as 0,f);
        expect(pixels).toHaveLength(20); expect(pixels.every(row=>row.length===20)).toBe(true);
      }
    }
  });
});
