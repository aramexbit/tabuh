// TABUH balance: towers, spirits, waves, economy. One place, so tuning is a
// single edit and the probe can print these numbers back for verification.
export const W = 1280;
export const H = 720;
export const BPM = 100;
export const BEAT = 60 / BPM; // 0.6 s per beat
export const START_COINS = 150;
export const GATE_HP = 20;
export const TOTAL_WAVES = 10;
export const SELL_RATE = 0.7;

// Towers: bronze gamelan instruments. beatsPerShot counts beats between strikes;
// towers fire on the beat grid, so their rhythm is visible and audible.
export const TOWERS = {
  saron: {
    name: 'Saron', key: '1', cost: 50, dmg: 8, range: 115, beatsPerShot: 1,
    color: '#e8b64c', desc: 'Cepat, satu sasaran. Pukulan stabil tiap ketuk.',
  },
  kendang: {
    name: 'Kendang', key: '2', cost: 70, dmg: 4, range: 120, beatsPerShot: 1,
    color: '#c97b3d', desc: 'Denyut drum: melambatkan roh 40% selama 2 ketuk.',
    slow: 0.4, slowBeats: 2,
  },
  bonang: {
    name: 'Bonang', key: '3', cost: 100, dmg: 14, range: 125, beatsPerShot: 1,
    color: '#f0d060', desc: 'Kettle gong: damage area kecil di sekitar sasaran.',
    aoe: 55,
  },
  kenong: {
    name: 'Kenong', key: '4', cost: 150, dmg: 30, range: 205, beatsPerShot: 2,
    color: '#d9a441', desc: 'Jangkauan jauh, damage besar, lambat.',
  },
  gong: {
    name: 'Gong', key: '5', cost: 250, dmg: 80, range: 165, beatsPerShot: 4,
    color: '#f5c542', desc: 'Gema besar: damage area luas + setrum 1 ketuk.',
    aoe: 120, stunBeats: 1,
  },
};
export const TOWER_ORDER = ['saron', 'kendang', 'bonang', 'kenong', 'gong'];

// Upgrades: level 2 and 3. Cost is a multiple of the base cost.
export const UPGRADES = {
  2: { costMul: 0.6, dmgMul: 1.6, rangeMul: 1.1 },
  3: { costMul: 1.0, dmgMul: 2.3, rangeMul: 1.2 },
};

// Spirits: original names, not folklore creatures. hp scales with the wave.
export const ENEMIES = {
  wisik: {
    name: 'Wisik', hp: 20, speed: 55, reward: 4, gateDmg: 1, radius: 13,
    color: '#7fe3c8', desc: 'Bisikan cepat, rapuh.',
  },
  kunang: {
    name: 'Kunang', hp: 12, speed: 86, reward: 3, gateDmg: 1, radius: 10,
    color: '#ffe066', desc: 'Kawanan kunang-kunang, sangat cepat.',
  },
  bayang: {
    name: 'Bayang', hp: 46, speed: 40, reward: 7, gateDmg: 1, radius: 16,
    color: '#9db8e8', desc: 'Bayangan biasa, seimbang.',
  },
  slira: {
    name: 'Slira', hp: 92, speed: 30, reward: 12, gateDmg: 2, radius: 19,
    color: '#c9a7eb', desc: 'Selubung tebal, kebal lambat.',
    slowResist: true,
  },
  raksasa: {
    name: 'Raksasa', hp: 260, speed: 20, reward: 25, gateDmg: 3, radius: 26,
    color: '#ff9a7a', desc: 'Raksasa lambat, sangat kuat.',
  },
};

// Waves: groups spawn in order; delay is seconds after the wave starts.
export const WAVES = [
  { groups: [{ type: 'wisik', count: 6, interval: 1.2, delay: 0 }] },
  { groups: [{ type: 'wisik', count: 8, interval: 1.0, delay: 0 }, { type: 'kunang', count: 4, interval: 0.7, delay: 4 }] },
  { groups: [{ type: 'wisik', count: 8, interval: 0.9, delay: 0 }, { type: 'bayang', count: 3, interval: 1.6, delay: 3 }, { type: 'kunang', count: 6, interval: 0.6, delay: 6 }] },
  { groups: [{ type: 'bayang', count: 6, interval: 1.4, delay: 0 }, { type: 'wisik', count: 10, interval: 0.8, delay: 2 }, { type: 'kunang', count: 6, interval: 0.5, delay: 8 }] },
  { groups: [{ type: 'slira', count: 2, interval: 3.0, delay: 0 }, { type: 'bayang', count: 8, interval: 1.2, delay: 2 }, { type: 'kunang', count: 10, interval: 0.5, delay: 6 }] },
  { groups: [{ type: 'slira', count: 4, interval: 2.6, delay: 0 }, { type: 'bayang', count: 10, interval: 1.1, delay: 2 }, { type: 'wisik', count: 12, interval: 0.7, delay: 6 }] },
  { groups: [{ type: 'raksasa', count: 1, interval: 1, delay: 0 }, { type: 'slira', count: 4, interval: 2.4, delay: 3 }, { type: 'bayang', count: 10, interval: 1.0, delay: 5 }, { type: 'kunang', count: 12, interval: 0.45, delay: 8 }] },
  { groups: [{ type: 'raksasa', count: 2, interval: 6.0, delay: 0 }, { type: 'slira', count: 6, interval: 2.2, delay: 2 }, { type: 'bayang', count: 12, interval: 0.9, delay: 4 }, { type: 'kunang', count: 14, interval: 0.4, delay: 8 }] },
  { groups: [{ type: 'raksasa', count: 3, interval: 5.0, delay: 0 }, { type: 'slira', count: 8, interval: 2.0, delay: 2 }, { type: 'bayang', count: 12, interval: 0.9, delay: 4 }, { type: 'wisik', count: 16, interval: 0.6, delay: 8 }] },
  { groups: [{ type: 'raksasa', count: 5, interval: 4.0, delay: 0 }, { type: 'slira', count: 10, interval: 1.8, delay: 2 }, { type: 'bayang', count: 14, interval: 0.8, delay: 4 }, { type: 'kunang', count: 16, interval: 0.4, delay: 8 }] },
];

export function enemyHp(type, wave) {
  return Math.round(ENEMIES[type].hp * (1 + 0.12 * (wave - 1)));
}

export function waveClearBonus(wave) {
  return 20 + 5 * wave;
}
