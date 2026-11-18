// Wave spawning: each wave is a list of groups {type, count, interval, delay}.
// The spawner builds a sorted queue of spawn events when the wave starts and
// ticks it down. A wave is cleared when every event fired and no enemy remains.
import { WAVES } from './config.js';
import { GATES } from './world.js';
import { createEnemy } from './enemies.js';

// Composition of a wave (campaign or endless), for the spawner and the
// DATANG threat list.
export function waveDef(wave) {
  return WAVES[wave - 1] || endlessWave(wave);
}

export class WaveSpawner {
  constructor(game) {
    this.game = game;
    this.queue = []; // {at, type}
    this.active = false;
  }

  start(wave) {
    const def = waveDef(wave);
    this.queue = [];
    // v2.19 — multi-gate spawn: ghosts split round-robin across the three
    // gates, so all three are visibly active every wave. The boss (raja)
    // always enters through gate 0 (top-right): the boss pose expects him
    // in the centre band, and his parking geometry is tuned to that gate.
    let gateSeq = 0;
    for (const g of def.groups) {
      for (let i = 0; i < g.count; i++) {
        const gate = g.type === 'raja' ? 0 : (gateSeq++ % GATES.length);
        this.queue.push({ at: g.delay + i * g.interval, type: g.type, gate });
      }
    }
    this.queue.sort((a, b) => a.at - b.at);
    this.active = true;
    this.t = 0;
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    while (this.queue.length > 0 && this.queue[0].at <= this.t) {
      const ev = this.queue.shift();
      const e = createEnemy(ev.type, this.game.wave, this.game.rng);
      // Bulan Purnama: ghosts have +30% HP.
      if (this.game.twist === 'purnama') e.hp = e.maxHp = Math.round(e.hp * 1.3);
      // v2.19 — spawn at the assigned gate (not always the top-right one).
      const p = GATES[ev.gate] || GATES[0];
      e.x = p.x;
      e.y = p.y;
      e.gate = ev.gate;
      this.game.enemies.push(e);
    }
    if (this.queue.length === 0) this.active = false;
  }

  get remaining() {
    return this.queue.length;
  }
}

// Endless waves (11+): same families, growing counts; a Raja returns every
// 5th endless wave. HP/speed keep scaling via enemyHp/enemySpeed(wave).
function endlessWave(wave) {
  const extra = wave - 10;
  const groups = [
    { type: 'raksasa', count: 3 + Math.floor(extra / 2), interval: 4.0, delay: 0 },
    { type: 'slira', count: 8 + extra, interval: 1.8, delay: 2 },
    { type: 'bayang', count: 10 + extra, interval: 0.8, delay: 4 },
    { type: 'kunang', count: 12, interval: 0.4, delay: 8 },
    { type: 'wisik', count: 12, interval: 0.6, delay: 10 },
  ];
  if (extra % 5 === 0) groups.unshift({ type: 'raja', count: 1, interval: 1, delay: 2 });
  return { groups };
}
