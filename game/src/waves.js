// Wave spawning: each wave is a list of groups {type, count, interval, delay}.
// The spawner builds a sorted queue of spawn events when the wave starts and
// ticks it down. A wave is cleared when every event fired and no enemy remains.
import { WAVES } from './config.js';
import { createEnemy } from './enemies.js';

export class WaveSpawner {
  constructor(game) {
    this.game = game;
    this.queue = []; // {at, type}
    this.active = false;
  }

  start(wave) {
    const def = WAVES[wave - 1];
    this.queue = [];
    for (const g of def.groups) {
      for (let i = 0; i < g.count; i++) {
        this.queue.push({ at: g.delay + i * g.interval, type: g.type });
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
      const p = this.game.pathStart();
      e.x = p.x;
      e.y = p.y;
      this.game.enemies.push(e);
    }
    if (this.queue.length === 0) this.active = false;
  }

  get remaining() {
    return this.queue.length;
  }
}
