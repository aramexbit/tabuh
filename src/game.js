// TABUH game core: state machine, beat clock, wave flow, economy, combo.
// The beat clock (BEAT = 0.6 s at 100 BPM) drives tower fire, the music and the
// TABUH hit window, so rhythm is one system, not three.
import {
  W, H, BEAT, START_COINS, GATE_HP, TOTAL_WAVES, TOWERS, waveClearBonus,
  RELICS, setDifficulty,
} from './config.js';
import { makeRng } from './rng.js';
import { GamelanAudio } from './audio.js';
import { pointAt, PATH_LENGTH, PADS } from './world.js';
import {
  createTower, towerStats, upgradeCost, sellValue, towerSpent, updateTowers,
  updateProjectiles, drawTower,
} from './towers.js';
import { createEnemy, updateEnemy, drawEnemy } from './enemies.js';
import { WaveSpawner, waveDef } from './waves.js';
import { Effects } from './effects.js';
import { drawScene } from './render.js';
import { UI } from './ui.js';
import { applyShot, checkShot } from './shots.js';

const BEST_KEY = 'tabuh-best-v1';
const DIFF_KEY = 'tabuh-diff-v1';

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
    this.difficulty = this.loadDifficulty();
    setDifficulty(this.difficulty);
    this.reset();
    this.state = 'menu';
    if (this.shot) applyShot(this);
  }

  loadDifficulty() {
    try {
      const d = localStorage.getItem(DIFF_KEY);
      if (d === 'easy' || d === 'normal' || d === 'hard') return d;
    } catch (e) { /* storage unavailable */ }
    return 'normal';
  }

  setDifficultyKey(key) {
    this.difficulty = (key === 'easy' || key === 'hard') ? key : 'normal';
    setDifficulty(this.difficulty);
    try {
      localStorage.setItem(DIFF_KEY, this.difficulty);
    } catch (e) { /* storage unavailable */ }
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
    this.score = 0; // run score: kills x100 x combo + tabuh + wave/boss bonus
    this.shake = 0;
    this.emberTimer = 0; // ambient ember spawner (visual only)
    this.banner = null; // {title, sub, until, color} — big center-screen banner
    this.twist = null; // wave twist key ('kabut' | 'purnama' | 'hujan') or null
    this.gongUsedWave = 0; // the wave the Gong Raksasa was last fired on
    this.flash = 0; // full-screen flash (Gong Raksasa), decays in update()
    this.shotReady = false;
    this.endless = false;
    this.boss = null;
    this.bossAnnounced = false;
    this.relics = new Set();
    this.waveTotal = 0;
    this.waveStartKills = 0;
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

  // Big center-screen banner (~2 s): relic earned, wave twist, boss intro.
  showBanner(title, sub, dur = 2.2, color = '#ffd76a') {
    this.banner = { title, sub, until: this.time + dur, dur, color };
  }

  // Wave twist every 3rd wave (rotating): 3/12/21 Berkabut, 6/15/24
  // Purnama, 9/18/27 Hujan. Applies to the wave being started.
  static twistForWave(wave) {
    const m = wave % 9;
    if (m === 3) return 'kabut';
    if (m === 6) return 'purnama';
    if (m === 0) return 'hujan';
    return null;
  }

  static TWISTS = {
    kabut: { name: 'Malam Berkabut', desc: 'Jangkauan menara -20% • Hantu lebih cepat' },
    purnama: { name: 'Bulan Purnama', desc: 'Hantu +30% HP • Koin x2' },
    hujan: { name: 'Hujan Deras', desc: 'Jendela ketuk lebih sempit • Damage +25%' },
  };

  // Gong Raksasa: the special move. Available while the combo multiplier is
  // at x2.0 or more, once per wave. Clicking the glowing TABUH button or
  // pressing G fires it; Space always stays a normal tabuh.
  gongRaksasaReady() {
    return this.state === 'playing' && this.phase === 'wave'
      && this.comboMult() >= 2.0 && this.gongUsedWave !== this.wave;
  }

  triggerGongRaksasa() {
    if (!this.gongRaksasaReady()) return false;
    this.gongUsedWave = this.wave;
    this.flash = 1;
    this.shake = Math.max(this.shake, 0.8);
    this.audio.strike('gong');
    // Shockwaves from the village heart, lightning onto the field.
    this.effects.ring(640, 360, 700, '#f5c542', 1.4, 8);
    this.effects.ring(640, 360, 480, '#fff2b0', 1.1, 6);
    this.effects.ring(640, 360, 300, '#ffd76a', 0.9, 5);
    const alive = this.enemies.filter((e) => e.hp > 0);
    for (let i = 0; i < Math.min(5, alive.length); i++) {
      const e = alive[Math.floor(Math.random() * alive.length)];
      this.effects.bolt(e.x, e.y);
    }
    this.effects.bolt(640, 360);
    this.effects.text(640, 300, 'GONG RAKSASA!', '#ffd76a', 44);
    // 200 damage + 2-beat stun to every spirit on screen.
    for (const e of alive) {
      this.damageEnemy(e, 200, 'gong');
      e.stunUntil = this.time + 2 * this.beatDur;
    }
    return true;
  }

  startWave() {
    if (this.state !== 'playing' || this.phase !== 'build') return;
    this.audio.ensure();
    this.phase = 'wave';
    this.spawner.start(this.wave);
    this.waveTotal = this.spawner.remaining;
    this.waveStartKills = this.stats.kills;
    this.selectedPad = null;
    this.selectedTower = null;
    // Wave twist banner (every 3rd wave).
    this.twist = Game.twistForWave(this.wave);
    if (this.twist) {
      const t = Game.TWISTS[this.twist];
      this.showBanner(t.name, t.desc, 2.5);
    }
    // Dramatic boss intro before any wave that fields a Raja.
    const def = waveDef(this.wave);
    if (def.groups.some((gr) => gr.type === 'raja')) {
      this.showBanner('RAJA BUTO IJO DATANG!', 'Boss malam ini — siapkan gong dan pusakamu!', 2.5, '#ff9a3d');
      this.shake = Math.max(this.shake, 0.6);
      this.effects.ring(1234, 58, 140, '#ff9a3d', 1.0, 5);
    }
  }

  // Passive damage multiplier from relics (Keris +25%) and the Hujan twist
  // (+25%). Kept apart from comboMult() so the HUD still shows the honest
  // combo multiplier.
  dmgMul() {
    let m = this.relics.has('keris') ? 1.25 : 1;
    if (this.twist === 'hujan') m *= 1.25;
    return m;
  }

  repairCost() {
    return this.relics.has('jimat') ? 50 : 100;
  }

  comboGrade() {
    if (this.combo >= 15) return 'S';
    if (this.combo >= 10) return 'A';
    if (this.combo >= 5) return 'B';
    if (this.combo >= 1) return 'C';
    return '—';
  }

  // The player taps TABUH on the beat. Timing windows (seconds to the nearest
  // beat): perfect <= 0.07, good <= 0.14, else a miss that breaks the combo.
  // Gong Pusaka widens the windows and softens a miss (combo halves);
  // the Hujan twist narrows them again (x0.7).
  tabuh() {
    if (this.state !== 'playing') return;
    this.audio.ensure();
    const phase = this.beatPhase();
    const d = Math.min(phase, 1 - phase) * BEAT;
    const wide = this.relics.has('gong');
    let perfectWin = wide ? 0.10 : 0.07;
    let goodWin = wide ? 0.20 : 0.14;
    if (this.twist === 'hujan') {
      perfectWin *= 0.7;
      goodWin *= 0.7;
    }
    this.stats.beatPresses++;
    let verdict;
    if (d <= perfectWin) {
      verdict = 'perfect';
      this.stats.perfectHits++;
      this.combo++;
      this.coins += 1;
      this.stats.coinsEarned += 1;
      this.score += 10;
    } else if (d <= goodWin) {
      verdict = 'good';
      this.stats.goodHits++;
      this.combo++;
      this.score += 5;
    } else {
      verdict = 'miss';
      this.stats.misses++;
      this.combo = wide ? Math.floor(this.combo / 2) : 0;
    }
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
    this.effects.ring(930, H - 52, 60, verdict === 'perfect' ? '#7fe3a8' : verdict === 'good' ? '#ffd76a' : '#ff7a6a');
    this.effects.text(930, H - 130, verdict === 'perfect' ? 'PERFECT!' : verdict === 'good' ? 'Good' : 'Meleset',
      verdict === 'perfect' ? '#7fe3a8' : verdict === 'good' ? '#ffd76a' : '#ff7a6a', 20);
  }

  damageEnemy(e, dmg, kind) {
    if (e.hp <= 0) return;
    // Resistance: Kuntilanak takes less damage from Saron (x0.75 — an L2
    // Saron still kills a wave-1 Kuntilanak in 2 hits, so wave 1 stays fair).
    if (kind === 'saron' && e.type === 'wisik') dmg = Math.max(1, Math.round(dmg * 0.75));
    e.hp -= dmg;
    e.flash = 1;
    // Floating damage numbers: shown for almost every hit now, and big
    // enough to read at a glance (the mockup's -80 / -34 / -16).
    if (dmg >= 5) {
      const big = dmg >= 50;
      const mid = dmg >= 20;
      this.effects.text(
        e.x + (Math.random() * 16 - 8), e.y - e.radius - 8, `-${dmg}`,
        big ? '#ff9a3d' : '#ffd76a', big ? 30 : mid ? 22 : 17,
      );
    }
    if (dmg >= 30) this.effects.burst(e.x, e.y, e.def.color, 8);
    if (e.type === 'raja') this.shake = Math.max(this.shake, 0.18);
    if (e.hp <= 0) {
      // Kill reward: Kendi +50%, Bulan Purnama x2 — and the coin pop says so.
      let reward = e.reward;
      if (this.relics.has('kendi')) reward = Math.round(reward * 1.5);
      if (this.twist === 'purnama') reward *= 2;
      this.coins += reward;
      this.stats.coinsEarned += reward;
      this.stats.kills++;
      // Score: 100 per kill, scaled by the combo multiplier at kill time.
      this.score += Math.round(100 * this.comboMult());
      if (e.type === 'raja') {
        this.score += 5000;
        this.effects.text(e.x, e.y - 44, 'BOSS +5000', '#ffd76a', 26);
      }
      this.effects.burst(e.x, e.y, e.def.color, 16);
      const bonus = (this.relics.has('kendi') ? ' (+50%)' : '') + (this.twist === 'purnama' ? ' (x2)' : '');
      this.effects.text(e.x, e.y - 18, `+${reward} ◆${bonus}`, '#ffd76a', 17);
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

  // Ghosts damage towers. At 0 durability the tower is destroyed: the pad
  // empties and half of what was sunk into it comes back as coins.
  damageTower(t, dmg) {
    if (!this.towers.includes(t)) return;
    t.durability -= dmg;
    this.effects.text(t.x, t.y - 30, `-${dmg}`, '#ff7a6a', 18);
    this.effects.burst(t.x, t.y - 10, '#8a94a8', 8);
    if (t.durability <= 0) {
      const refund = Math.round(towerSpent(t) * 0.5);
      this.coins += refund;
      this.towers = this.towers.filter((x) => x !== t);
      if (this.selectedTower === t) this.selectedTower = null;
      this.effects.text(t.x, t.y - 44, `Hancur! +${refund} ◆`, '#ff9a7a', 16);
      this.effects.burst(t.x, t.y, '#ff7a6a', 14);
      this.shake = Math.max(this.shake, 0.3);
    }
  }

  repairTowerCost(t) {
    const missing = 1 - t.durability / t.maxDurability;
    return Math.max(10, Math.round(missing * TOWERS[t.type].cost * 0.5));
  }

  repairTower(t) {
    const cost = this.repairTowerCost(t);
    if (!this.towers.includes(t) || t.durability >= t.maxDurability || this.coins < cost) return false;
    this.coins -= cost;
    t.durability = t.maxDurability;
    this.effects.ring(t.x, t.y, 44, '#7fe3a8');
    this.effects.text(t.x, t.y - 34, 'Diperbaiki!', '#7fe3a8', 14);
    return true;
  }

  // Late-game money sink: spend surplus coins to patch the village gate.
  // Jimat Pelindung halves the price.
  repairGate() {
    if (this.state !== 'playing') return false;
    const cost = this.repairCost();
    if (this.gateHp >= this.gateMaxHp || this.coins < cost) return false;
    this.coins -= cost;
    this.gateHp = Math.min(this.gateMaxHp, this.gateHp + 5);
    this.effects.text(620, 60, '+5 Gerbang', '#7fe3a8', 18);
    return true;
  }

  // A relic is earned automatically when its wave is cleared: a big banner
  // announces it center-screen, so the effect is impossible to miss.
  awardRelic(relic) {
    if (this.relics.has(relic.key)) return;
    this.relics.add(relic.key);
    if (relic.key === 'jimat') {
      this.gateMaxHp += 5;
      this.gateHp = Math.min(this.gateMaxHp, this.gateHp + 5);
    }
    const subs = {
      keris: 'Damage menara +25% — angka damage naik!',
      gong: 'Jendela ketuk lebih lebar — kombo lebih awet!',
      kendi: 'Koin kill +50% — lihat pop koin emas!',
      jimat: 'Gerbang +5 HP maks — bar gerbang 25/20!',
    };
    this.showBanner(`${relic.name.toUpperCase()}!`, subs[relic.key] || relic.desc, 2.2);
    this.effects.ring(640, 216, 260, '#ffd76a', 1.0);
  }

  waveCleared() {
    let bonus = waveClearBonus(this.wave);
    if (this.twist === 'purnama') bonus *= 2; // Bulan Purnama: koin x2
    this.coins += bonus;
    this.score += 250 * this.wave; // wave-clear score bonus
    this.stats.coinsEarned += bonus;
    this.effects.text(640, 120, `Malam ${this.wave} selesai!  +${bonus} koin`, '#7fe3a8', 22);
    for (const r of RELICS) {
      if (r.wave === this.wave) this.awardRelic(r);
    }
    if (this.wave >= TOTAL_WAVES && !this.endless) {
      this.victory();
      return;
    }
    this.wave++;
    this.phase = 'build';
  }

  continueEndless() {
    if (this.state !== 'victory') return;
    this.endless = true;
    this.state = 'playing';
    this.wave = TOTAL_WAVES + 1;
    this.phase = 'build';
    this.gateHp = Math.min(this.gateMaxHp, this.gateHp + 5);
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

  // Boss tracking + enrage phases. At 50% HP the Raja speeds up and calls
  // wisik; at 25% he speeds up again and calls more. Announced on screen.
  updateBoss() {
    for (const e of this.enemies) {
      if (e.type !== 'raja') continue;
      if (this.boss !== e) {
        this.boss = e;
        this.effects.text(640, 160, 'RAJA BUTO IJO MUNCUL!', '#ff9a3d', 30);
        this.effects.ring(e.x, e.y, 160, '#ff9a3d', 1.2);
        this.shake = Math.max(this.shake, 0.5);
      }
      const pct = e.hp / e.maxHp;
      if (e.phase === 0 && pct <= 0.5) {
        e.phase = 1;
        e.speed = e.baseSpeed * 1.5;
        this.summonWisik(e, 3);
        this.effects.text(640, 160, 'Raja mengamuk!', '#ff9a3d', 26);
        this.shake = Math.max(this.shake, 0.5);
      } else if (e.phase === 1 && pct <= 0.25) {
        e.phase = 2;
        e.speed = e.baseSpeed * 2.2;
        this.summonWisik(e, 3);
        this.effects.text(640, 160, 'Raja murka!', '#ff4a3d', 26);
        this.shake = Math.max(this.shake, 0.6);
      }
    }
    if (this.boss && (this.boss.hp <= 0 || this.boss.reachedGate)) this.boss = null;
  }

  summonWisik(boss, n) {
    for (let i = 0; i < n; i++) {
      const w = createEnemy('wisik', this.wave, this.rng);
      w.dist = Math.max(0, boss.dist - 90 - i * 40);
      const p = pointAt(w.dist);
      w.x = p.x;
      w.y = p.y;
      this.enemies.push(w);
    }
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
    if (id === 'endless') { this.continueEndless(); return; }
    if (id && id.startsWith('diff:')) { this.setDifficultyKey(id.slice(5)); return; }
    if (id === 'quit-menu') { this.state = 'menu'; return; }
    if (id === 'wave') { this.startWave(); return; }
    // The TABUH button fires the Gong Raksasa while it glows; Space always
    // stays a normal tabuh, and G fires the special directly.
    if (id === 'tabuh') {
      if (!this.triggerGongRaksasa()) this.tabuh();
      return;
    }
    if (id === 'gong') { this.triggerGongRaksasa(); return; }
    if (id === 'repair') { this.repairGate(); return; }
    if (id === 'upgrade' && this.selectedTower) { this.upgradeTower(this.selectedTower); return; }
    if (id === 'repair-tower' && this.selectedTower) { this.repairTower(this.selectedTower); return; }
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
      // Beat rings along the whole stone path: six glowing rings bloom on
      // the ketuk so the rhythm is visible everywhere, like the mockup.
      for (const f of [0.08, 0.25, 0.42, 0.58, 0.75, 0.92]) {
        const p = pointAt(f * PATH_LENGTH);
        this.effects.ring(p.x, p.y, 64, 'rgba(232,182,76,0.9)', 0.55, 5);
      }
      // Beat rings at both gates: the whole arena pulses with the ketuk.
      this.effects.ring(150, 648, 90, 'rgba(232,182,76,0.6)', 0.55, 5);
      this.effects.ring(1234, 58, 80, 'rgba(127,227,200,0.5)', 0.55, 5);
      // Screenshot poses play the rhythm for real: a perfect tabuh on every
      // beat, so their stats show genuine engagement (and the grade badge
      // shows a real S/A, not a faked number).
      if ((this.shot === 'win' || this.shot === 'play' || this.shot === 'big' || this.shot === 'boss')
        && this.state === 'playing') this.tabuh();
    }
    // Ambient embers drift up off the field — a few per second, capped by
    // the effects list, so the night air always glitters.
    this.emberTimer -= dt;
    if (this.emberTimer <= 0) {
      this.emberTimer = 0.15;
      this.effects.mote(60 + Math.random() * 1160, 380 + Math.random() * 220);
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
    this.updateBoss();
    this.effects.update(dt);
    this.shake = Math.max(0, this.shake - dt * 1.8);
    this.flash = Math.max(0, this.flash - dt * 1.5);
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
        const stats = towerStats(this.selectedTower, this);
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
    // Gong Raksasa flash: a white-gold wash over everything, fading fast.
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,240,200,${0.5 * this.flash})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}
