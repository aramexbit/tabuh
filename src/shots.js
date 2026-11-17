// Screenshot poses (?shot=menu|play|big|win). Each pose drives the real game
// (real towers, real waves, real stats) and sets game.shotReady when the frame
// is ready to capture. Nothing here hardcodes a screenshot's numbers.
import { TOTAL_WAVES } from './config.js';

function giveCoins(game, n) {
  game.coins = n;
}

function buildMaxed(game, type, padIndex) {
  const t = game.buildTower(type, padIndex);
  if (!t) return null;
  game.upgradeTower(t);
  game.upgradeTower(t);
  return t;
}

export function applyShot(game) {
  const shot = game.shot;
  if (shot === 'menu') {
    game.state = 'menu';
    setTimeout(() => { game.shotReady = true; }, 600);
    return;
  }
  game.start();
  if (shot === 'play') {
    giveCoins(game, 900);
    game.buildTower('saron', 1);
    game.buildTower('bonang', 3);
    game.buildTower('kendang', 6);
    game.buildTower('kenong', 2);
    game.wave = 3;
    game.startWave();
  } else if (shot === 'big') {
    // Gong on the central pad so its shockwave lands mid-frame.
    giveCoins(game, 900);
    game.buildTower('gong', 4);
    game.buildTower('kenong', 2);
    game.buildTower('bonang', 3);
    game.buildTower('saron', 1);
    game.wave = 7;
    game.startWave();
  } else if (shot === 'boss') {
    // Wave 10 boss fight, mid-battle: the Raja on the field with adds around.
    giveCoins(game, 1200);
    game.buildTower('gong', 4);
    game.buildTower('kenong', 2);
    game.buildTower('bonang', 3);
    game.buildTower('saron', 1);
    game.buildTower('kendang', 6);
    game.wave = 10;
    game.startWave();
  } else if (shot === 'win') {
    // Endgame push: waves 9 + 10 with maxed towers, at 1x speed so the
    // victory screen's play-time reads like a real endgame (~1.5 min),
    // not a fast-forward. The pose plays the rhythm for real (auto-tabuh
    // on every beat, see game.js), so the victory screen shows genuine
    // accuracy/combo stats, not zeros.
    giveCoins(game, 3000);
    buildMaxed(game, 'gong', 0);
    buildMaxed(game, 'kenong', 2);
    buildMaxed(game, 'bonang', 3);
    buildMaxed(game, 'saron', 4);
    buildMaxed(game, 'kendang', 5);
    game.wave = 9;
    game.startWave();
  }
}

// The win pose plays waves 9+10 with counter-attacks on: like a real player,
// it repairs chipped towers and rebuilds destroyed ones between waves.
const WIN_BOARD = [
  ['gong', 0], ['kenong', 2], ['bonang', 3], ['saron', 4], ['kendang', 5],
];
function maintainWinBoard(game) {
  if (game.phase !== 'build') return;
  const chipped = game.towers
    .filter((t) => t.durability < t.maxDurability * 0.6)
    .map((t) => ({ t, cost: game.repairTowerCost(t) }))
    .sort((a, b) => a.cost - b.cost);
  for (const c of chipped) {
    if (game.coins >= c.cost && game.repairTower(c.t)) return;
  }
  for (const [type, pad] of WIN_BOARD) {
    if (!game.towers.some((t) => t.padIndex === pad)) {
      const t = game.buildTower(type, pad);
      if (t) {
        game.upgradeTower(t);
        game.upgradeTower(t);
        return;
      }
    }
  }
}

// Called every update while a shot pose is active.
export function checkShot(game) {
  if (game.shotReady) return;
  if (game.shot === 'play') {
    // Towers get stunned now, so a live projectile is rarer — one is enough.
    if (game.enemies.length >= 5 && game.projectiles.length >= 1) game.shotReady = true;
  } else if (game.shot === 'big') {
    // Capture the gong at its best: a shockwave that caught at least 2
    // spirits, with plenty of action still on the field.
    if ((game.stats.lastGongHits || 0) >= 2 && game.enemies.length >= 5) game.shotReady = true;
  } else if (game.shot === 'boss') {
    // Capture the boss on screen with a busy field and projectiles flying.
    if (game.boss && game.enemies.length >= 6 && game.projectiles.length >= 2) game.shotReady = true;
  } else if (game.shot === 'win') {
    // Auto-advance: maintain the board, then start the next wave.
    if (game.state === 'playing') {
      maintainWinBoard(game);
      if (game.phase === 'build' && game.wave <= TOTAL_WAVES) game.startWave();
    }
    if (game.state === 'victory') game.shotReady = true;
  }
  // Safety: never wait forever — a pose that cannot complete still yields a
  // frame (the probe logs it and the shot is retaken by hand).
  if (game.time > 120) game.shotReady = true;
}
