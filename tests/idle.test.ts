import { describe, it, expect } from 'vitest';
import { watchIdle } from '../packages/server/src/idle.js';

describe('apagado por servidor vacío', () => {
  it('se apaga recién cuando pasó el tiempo entero sin nadie, y una sola vez', () => {
    let clients = 1;
    let now = 0;
    let apagados = 0;
    const watch = watchIdle({ clients: () => clients, idleMs: 60_000, onIdle: () => apagados++, now: () => now });
    watch.stop();
    watch.check();
    now = 120_000;
    watch.check();
    expect(apagados).toBe(0);

    clients = 0;
    watch.check(); // empty from now on
    now += 59_000;
    watch.check();
    expect(apagados).toBe(0);

    // Someone came back for a moment: the count starts over.
    clients = 1;
    watch.check();
    clients = 0;
    now += 1;
    watch.check();
    now += 59_999;
    watch.check();
    expect(apagados).toBe(0);
    now += 1;
    watch.check();
    watch.check();
    expect(apagados).toBe(1);
  });
});
