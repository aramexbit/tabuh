// TABUH game core: state machine, beat clock, wave flow, economy, combo.
// The beat clock (BEAT = 0.6 s at 100 BPM) drives tower fire, the music and the
// TABUH hit window, so rhythm is one system, not three.
import {
  W, H, BEAT, START_COINS, GATE_HP, TOTAL_WAVES, TOWERS, waveClearBonus,
} from './config.js';
import { makeRng } from './rng.js';
import { GamelanAudio } from './audio.js';
import { pointAt, PATH_LENGTH, PADS } from './world.js';
import {
  createTower, towerStats, upgradeCost, sellValue, updateTowers,
  updateProjectiles, drawTower,
} from './towers.js';
import { updateEnemy, drawEnemy } from './enemies.js';
import { WaveSpawner } from './waves.js';
import { Effects } from './effects.js';
import { drawScene } from './render.js';
import { UI } from './ui.js';
import { applyShot, checkShot } from './shots.js';

const BEST_KEY = 'tabuh-best-v1';

export class Game {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.seed = opts.seed || 1;
    this.shot = opts.shot || null;
    this.rng = makeRng(this.seed);
    this.audio = new GamelanAudio();
    this.effects = new Effects();
    this.ui = new UI(this);
    this.spawner = new WaveSpawner(this);
    this.menuTime = 0;
    this.timeScale = 1;
    this.beatDur = BEAT; // towers.js uses game.beatDur for slow/stun timers
    this.shotReady = false;
    this.best = this.loadBest();
    this.reset();
    this.state = 'menu';
    if (this.shot) applyShot(this);
  }

  loadBest() {
    try {
      const raw = localStorage.getItem(BEST_KEY);
      if (!raw) return { wave: 0, kills: 0 };
      const b = JSON.parse(raw);
      return { wave: b.wave || 0, kills: b.kills || 0 };
    } catch (e) {
      return { wave: 0, kills: 0 };
    }
  }

  saveBest() {
    const b = {
      wave: Math.max(this.best.wave, this.state === 'victory' ? TOTAL_WAVES : this.wave - 1),
      kills: Math.max(this.best.kills, this.stats.kills),
    };
    this.best = b;
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify(b));
    } catch (e) { /* storage unavailable */ }
  }

  reset() {
    this.state = 'playing';
    this.phase = 'build';
    this.time = 0;
    this.beatTime = 0;
    this.beatIndex = 0;
    this.wave = 1;
    this.coins = START_COINS;
    this.gateHp = GATE_HP;
    this.gateMaxHp = GATE_HP;
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.selectedType = null;
    this.selectedPad = null;
    this.selectedTower = null;
    this.combo = 0;
    this.shake = 0;
    this.shotReady = false;
    this.stats = {
      kills: 0, coinsEarned: 0, perfectHits: 0, goodHits: 0, misses: 0,
      beatPresses: 0, maxCombo: 0, timeSec: 0, gongHits: 0,
    };
    this.spawner.queue = [];
    this.spawner.active = false;
  }

  start() {
    this.audio.ensure();
    this.reset();
  }

  pathStart() {
    return pointAt(0);
  }

  beatPhase() {
    return (this.beatTime % BEAT) / BEAT;
  }

  comboMult() {
    return 1 + Math.min(this.combo, 20) * 0.075;
  }

  startWave() {
    if (this.state !== 'playing' || this.phase !== 'build') return;
    this.audio.ensure();
    this.phase = 'wave';
    this.spawner.start(this.wave);
    this.selectedPad = null;
    this.selectedTower = null;
  }

  // The player taps TABUH on the beat. Timing windows (seconds to the nearest
  // beat): perfect <= 0.07, good <= 0.14, else a miss that breaks the combo.
  tabuh() {
    if (this.state !== 'playing') return;
    this.audio.ensure();
    const phase = this.beatPhase();
    const d = Math.min(phase, 1 - phase) * BEAT;
    this.stats.beatPresses++;
    let verdict;
    if (d <= 0.07) {
      verdict = 'perfect';
      this.stats.perfectHits++;
      this.combo++;
      this.coins += 1;
      this.stats.coinsEarned += 1;
    } else if (d <= 0.14) {
      verdict = 'good';
      this.stats.goodHits++;
      this.combo++;
    } else {
      verdict = 'miss';
      this.stats.misses++;
      this.combo = 0;
    }
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
    this.effects.ring(930, H - 52, 60, verdict === 'perfect' ? '#7fe3a8' : verdict === 'good' ? '#ffd76a' : '#ff7a6a');
    this.effects.text(930, H - 130, verdict === 'perfect' ? 'PERFECT!' : verdict === 'good' ? 'Good' : 'Meleset',
      verdict === 'perfect' ? '#7fe3a8' : verdict === 'good' ? '#ffd76a' : '#ff7a6a', 20);
  }

  damageEnemy(e, dmg) {
    if (e.hp <= 0) return;
    e.hp -= dmg;
    e.flash = 1;
    if (e.hp <= 0) {
      this.coins += e.reward;
      this.stats.coinsEarned += e.reward;
      this.stats.kills++;
      this.effects.burst(e.x, e.y, e.def.color, 10);
      this.effects.text(e.x, e.y - 18, `+${e.reward}`, '#ffd76a', 14);
    }
  }

  buildTower(type, padIndex) {
    const def = TOWERS[type];
    if (!def || this.coins < def.cost) return null;
    if (this.towers.some((t) => t.padIndex === padIndex)) return null;
    this.coins -= def.cost;
    const t = createTower(type, padIndex);
    this.towers.push(t);
    this.effects.ring(t.x, t.y, 46, def.color);
    return t;
  }

  upgradeTower(t) {
    const cost = upgradeCost(t);
    if (cost === null || this.coins < cost) return false;
    this.coins -= cost;
    t.level++;
    this.effects.ring(t.x, t.y, 56, '#ffd76a');
    this.effects.text(t.x, t.y - 34, `Level ${t.level}!`, '#ffd76a', 16);
    return true;
  }

  sellTower(t) {
    this.coins += sellValue(t);
    this.towers = this.towers.filter((x) => x !== t);
    this.selectedTower = null;
  }

  // Late-game money sink: spend surplus coins to patch the village gate.
  repairGate() {
    if (this.state !== 'playing') return false;
    if (this.gateHp >= this.gateMaxHp || this.coins < 100) return false;
    this.coins -= 100;
    this.gateHp = Math.min(this.gateMaxHp, this.gateHp + 5);
    this.effects.text(620, 60, '+5 Gerbang', '#7fe3a8', 18);
    return true;
  }

  waveCleared() {
    const bonus = waveClearBonus(this.wave);
    this.coins += bonus;
    this.stats.coinsEarned += bonus;
    this.effects.text(640, 120, `Malam ${this.wave} selesai!  +${bonus} koin`, '#7fe3a8', 22);
    if (this.wave >= TOTAL_WAVES) {
      this.victory();
      return;
    }
    this.wave++;
    this.phase = 'build';
  }

  victory() {
    this.state = 'victory';
    this.saveBest();
    this.audio.fanfare(true);
  }

  defeat() {
    this.state = 'defeat';
    this.saveBest();
    this.audio.fanfare(false);
  }

  // ---- Input actions (from input.js / UI buttons) ----

  handleAction(id) {
    if (id === 'play') { this.start(); return; }
    if (id === 'howto') { this.state = 'howto'; return; }
    if (id === 'back-menu') { this.state = 'menu'; return; }
    if (id === 'mute') { this.audio.ensure(); this.audio.setMuted(!this.audio.muted); return; }
    if (id === 'pause') { if (this.state === 'playing') this.state = 'paused'; return; }
    if (id === 'resume') { if (this.state === 'paused') this.state = 'playing'; return; }
    if (id === 'restart') { this.start(); return; }
    if (id === 'quit-menu') { this.state = 'menu'; return; }
    if (id === 'wave') { this.startWave(); return; }
    if (id === 'tabuh') { this.tabuh(); return; }
    if (id === 'repair') { this.repairGate(); return; }
    if (id === 'upgrade' && this.selectedTower) { this.upgradeTower(this.selectedTower); return; }
    if (id === 'sell' && this.selectedTower) { this.sellTower(this.selectedTower); return; }
    if (id === 'close-panel') { this.selectedPad = null; this.selectedTower = null; return; }
    if (id && id.startsWith('tower:')) {
      const type = id.slice(6);
      this.selectedType = this.selectedType === type ? null : type;
      this.selectedTower = null;
      return;
    }
  }

  handlePadClick(padIndex) {
    const tower = this.towers.find((t) => t.padIndex === padIndex);
    if (tower) {
      this.selectedTower = tower;
      this.selectedPad = null;
      this.selectedType = null;
      return;
    }
    if (this.selectedType) {
      const built = this.buildTower(this.selectedType, padIndex);
      if (built) {
        this.selectedTower = built;
        this.selectedPad = null;
        this.selectedType = null;
      }
      return;
    }
    this.selectedPad = padIndex;
    this.selectedTower = null;
  }

  handleCanvasClick(x, y) {
    const hit = this.ui.clickAt(x, y);
    if (hit) {
      this.handleAction(hit);
      return;
    }
    if (this.state !== 'playing') return;
    // Pads first, then built towers (a tower sits on its pad).
    for (let i = 0; i < PADS.length; i++) {
      if (Math.hypot(x - PADS[i].x, y - PADS[i].y) < 38) {
        this.handlePadClick(i);
        return;
      }
    }
    this.selectedPad = null;
    this.selectedTower = null;
    this.selectedType = null;
  }

  // ---- Frame ----

  frame(dt) {
    this.menuTime += dt;
    this.realDt = dt; // unscaled, for honest play-time stats
    // Guard: a non-finite timeScale (bad input, never the UI) must not
    // poison the clock to NaN and freeze the game silently.
    const ts = Number.isFinite(this.timeScale) ? this.timeScale : 1;
    if (this.state === 'playing') this.update(dt * ts);
    this.draw();
  }

  update(dt) {
    this.time += dt;
    this.stats.timeSec += this.realDt;
    // Beat clock.
    const prevBeat = this.beatIndex;
    this.beatTime += dt;
    this.beatIndex = Math.floor(this.beatTime / BEAT);
    if (this.beatIndex !== prevBeat) {
      this.audio.onBeat(this.beatIndex);
      // The win screenshot pose plays the rhythm for real: a perfect tabuh
      // on every beat, so its victory stats show genuine engagement.
      if (this.shot === 'win' && this.state === 'playing') this.tabuh();
    }
    const dtBeats = dt / BEAT;
    this.spawner.update(dt);
    updateTowers(this, dtBeats);
    updateProjectiles(this, dt);
    // Enemies: move, gate damage, death cleanup.
    for (const e of this.enemies) updateEnemy(this, e, dt);
    for (const e of this.enemies) {
      if (e.reachedGate) {
        this.gateHp -= e.gateDmg;
        this.shake = Math.max(this.shake, 0.5);
        this.effects.burst(150, 640, '#ff7a6a', 12);
        this.effects.text(150, 590, `-${e.gateDmg} Gerbang`, '#ff7a6a', 18);
      }
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0 && !e.reachedGate);
    this.effects.update(dt);
    this.shake = Math.max(0, this.shake - dt * 1.8);
    if (this.gateHp <= 0) {
      this.gateHp = 0;
      this.defeat();
      return;
    }
    if (this.phase === 'wave' && !this.spawner.active && this.enemies.length === 0) {
      this.waveCleared();
    }
    if (this.shot) checkShot(this);
  }

  drawTowerOnly(ctx, tower) {
    drawTower(ctx, tower, this.menuTime);
  }

  draw() {
    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0) {
      const s = this.shake * 6;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }
    drawScene(ctx, this, this.state === 'menu' ? this.menuTime : this.time);
    if (this.state !== 'menu' && this.state !== 'howto') {
      // Range preview for the selected tower.
      if (this.selectedTower) {
        const stats = towerStats(this.selectedTower);
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = '#ffd76a';
        ctx.beginPath();
        ctx.arc(this.selectedTower.x, this.selectedTower.y, stats.range, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,215,106,0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(this.selectedTower.x, this.selectedTower.y, stats.range, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Towers, then projectiles, then enemies (front-to-back by y).
      const sortedTowers = [...this.towers].sort((a, b) => a.y - b.y);
      for (const t of sortedTowers) drawTower(ctx, t, this.time);
      for (const p of this.projectiles) {
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        for (const tp of p.trail) ctx.lineTo(tp.x, tp.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(p.x - 1.5, p.y - 1.5, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      const sortedEnemies = [...this.enemies].sort((a, b) => a.y - b.y);
      for (const e of sortedEnemies) drawEnemy(ctx, e, this.time);
      this.effects.draw(ctx);
    }
    ctx.restore();
    this.ui.draw(ctx);
  }
}
