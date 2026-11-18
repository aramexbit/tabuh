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

// Difficulty: chosen on the menu, saved, applied to enemy HP/speed only —
// coins, gate and tower costs never change, so the probe's numbers hold.
export const DIFFICULTIES = {
  easy: { name: 'Mudah', hp: 0.75, speed: 0.9 },
  normal: { name: 'Normal', hp: 1.0, speed: 1.0 },
  hard: { name: 'Sulit', hp: 1.35, speed: 1.1 },
};
export const DIFF_KEYS = ['easy', 'normal', 'hard'];
export const DIFF = { hp: 1, speed: 1, key: 'normal' };
export function setDifficulty(key) {
  const d = DIFFICULTIES[key] || DIFFICULTIES.normal;
  DIFF.hp = d.hp;
  DIFF.speed = d.speed;
  DIFF.key = DIFFICULTIES[key] ? key : 'normal';
}

// Pusaka: relic warisan, bonus pasif permanen selama satu run. Didapat
// otomatis saat wave-nya selesai; ikon menyala di panel PUSAKA.
export const RELICS = [
  { key: 'keris', name: 'Keris Pusaka', wave: 3, desc: 'Semua menara +25% damage' },
  { key: 'gong', name: 'Gong Pusaka', wave: 5, desc: 'Jendela ketuk lebih lebar, kombo tidak langsung putus' },
  { key: 'kendi', name: 'Kendi Pusaka', wave: 7, desc: '+50% koin dari kill' },
  { key: 'jimat', name: 'Jimat Pelindung', wave: 9, desc: 'Gerbang +5 HP maks, repair ◆50' },
];

// Towers: bronze gamelan instruments. beatsPerShot counts beats between strikes;
// towers fire on the beat grid, so their rhythm is visible and audible.
export const TOWERS = {
  saron: {
    name: 'Saron', key: '1', cost: 50, dmg: 8, range: 115, beatsPerShot: 1,
    color: '#e8b64c', desc: 'Cepat, satu sasaran. Pukulan stabil tiap ketuk.',
    durability: 80, // paling rapuh
  },
  kendang: {
    name: 'Kendang', key: '2', cost: 70, dmg: 4, range: 120, beatsPerShot: 1,
    color: '#c9402e', desc: 'Denyut drum: melambatkan roh 40% selama 2 ketuk.',
    slow: 0.4, slowBeats: 2, durability: 95,
  },
  bonang: {
    name: 'Bonang', key: '3', cost: 100, dmg: 14, range: 125, beatsPerShot: 1,
    color: '#e07830', desc: 'Kettle gong: damage area kecil di sekitar sasaran.',
    aoe: 55, durability: 110,
  },
  kenong: {
    name: 'Kenong', key: '4', cost: 150, dmg: 30, range: 205, beatsPerShot: 2,
    color: '#8a6fd9', desc: 'Jangkauan jauh, damage besar, lambat.',
    durability: 140,
  },
  gong: {
    name: 'Gong', key: '5', cost: 250, dmg: 80, range: 165, beatsPerShot: 4,
    color: '#f5c542', desc: 'Gema besar: damage area luas + setrum 1 ketuk.',
    aoe: 120, stunBeats: 1, durability: 200, // paling tahan lama — tapi tidak kebal
  },
};
export const TOWER_ORDER = ['saron', 'kendang', 'bonang', 'kenong', 'gong'];

// Upgrades: level 2 and 3. Cost is a multiple of the base cost.
export const UPGRADES = {
  2: { costMul: 0.6, dmgMul: 1.6, rangeMul: 1.1 },
  3: { costMul: 1.0, dmgMul: 2.3, rangeMul: 1.2 },
};

// Spirits: hantu Indonesia. hp scales with the wave.
export const ENEMIES = {
  wisik: {
    name: 'Kuntilanak', hp: 20, speed: 55, reward: 3, gateDmg: 1, radius: 13,
    color: '#c8f7c5', desc: 'Kuntilanak — melayang cepat, gaun putih.',
  },
  kunang: {
    name: 'Tuyul', hp: 12, speed: 86, reward: 2, gateDmg: 1, radius: 10,
    color: '#b8e986', desc: 'Tuyul — bocah kecil, lari cepat bergerombol.',
  },
  emas: {
    name: 'Tuyul Emas', hp: 40, speed: 110, reward: 150, gateDmg: 1, radius: 14,
    color: '#ffd76a', desc: 'Tuyul Emas — cepat, berkilau, hadiah koin besar.',
  },
  bayang: {
    name: 'Pocong', hp: 46, speed: 40, reward: 5, gateDmg: 1, radius: 16,
    color: '#f5f2e8', desc: 'Pocong — melompat dengan kain kafan.',
    slowResist: true, // Kafan Membungkus: kebal lambat Kendang
  },
  slira: {
    name: 'Genderuwo', hp: 92, speed: 30, reward: 9, gateDmg: 2, radius: 19,
    color: '#8a7a6a', desc: 'Genderuwo — besar berbulu, kebal lambat.',
    slowResist: true,
  },
  raksasa: {
    name: 'Buto Ijo', hp: 260, speed: 20, reward: 20, gateDmg: 3, radius: 26,
    color: '#69b34c', desc: 'Buto Ijo — raksasa hijau bertaring.',
  },
  raja: {
    name: 'Raja Buto Ijo', hp: 1200, speed: 16, reward: 150, gateDmg: 5, radius: 40,
    color: '#7ed957', desc: 'Raja Buto Ijo — boss malam kesepuluh, bermahkota emas.',
    slowResist: true,
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
  { groups: [{ type: 'raksasa', count: 1, interval: 1, delay: 0 }, { type: 'slira', count: 6, interval: 2.4, delay: 3 }, { type: 'bayang', count: 10, interval: 1.0, delay: 5 }, { type: 'kunang', count: 12, interval: 0.45, delay: 8 }] },
  { groups: [{ type: 'raksasa', count: 3, interval: 6.0, delay: 0 }, { type: 'slira', count: 8, interval: 2.2, delay: 2 }, { type: 'bayang', count: 12, interval: 0.9, delay: 4 }, { type: 'kunang', count: 14, interval: 0.4, delay: 8 }] },
  { groups: [{ type: 'raksasa', count: 5, interval: 5.0, delay: 0 }, { type: 'slira', count: 10, interval: 2.0, delay: 2 }, { type: 'bayang', count: 12, interval: 0.9, delay: 4 }, { type: 'wisik', count: 16, interval: 0.6, delay: 8 }] },
  // Malam 10: boss Raja Buto Ijo + pengawal. Total HP sengaja di atas v1 —
  // Pusaka (Keris +25%, Kendi +50% koin, Jimat +5 gerbang) membuat board
  // lebih kuat, jadi tanpa ritme TABUH gerbang harus tetap jatuh.
  { groups: [{ type: 'raja', count: 1, interval: 1, delay: 2 }, { type: 'raksasa', count: 6, interval: 4.0, delay: 0 }, { type: 'slira', count: 12, interval: 2.0, delay: 2 }, { type: 'bayang', count: 14, interval: 0.9, delay: 4 }, { type: 'kunang', count: 12, interval: 0.5, delay: 8 }] },
];

export function enemyHp(type, wave) {
  // Late waves scale hard (+28%/wave) so a maxed board without the rhythm
  // combo cannot hold the gate — TABUH has to matter.
  return Math.round(ENEMIES[type].hp * (1 + 0.28 * (wave - 1)) * DIFF.hp);
}

export function enemySpeed(type, wave) {
  return ENEMIES[type].speed * (1 + 0.04 * (wave - 1)) * DIFF.speed;
}

export function waveClearBonus(wave) {
  return 15 + 4 * wave;
}
