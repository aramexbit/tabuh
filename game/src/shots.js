// Screenshot poses (?shot=menu|play|big|win). Each pose drives the real game
// (real towers, real waves, real stats) and sets game.shotReady when the frame
// is ready to capture. Nothing here hardcodes a screenshot's numbers.
import { TOWERS } from './config.js';

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
    giveCoins(game, 600);
    game.buildTower('saron', 1);
    game.buildTower('bonang', 3);
    game.buildTower('kendang', 6);
    game.wave = 3;
    game.startWave();
  } else if (shot === 'big') {
    giveCoins(game, 900);
    game.buildTower('gong', 0);
    game.buildTower('kenong', 2);
    game.buildTower('bonang', 3);
    game.buildTower('saron', 4);
    game.wave = 7;
    game.startWave();
  } else if (shot === 'win') {
    giveCoins(game, 3000);
    buildMaxed(game, 'gong', 0);
    buildMaxed(game, 'kenong', 2);
    buildMaxed(game, 'bonang', 3);
    buildMaxed(game, 'saron', 4);
    buildMaxed(game, 'kendang', 5);
    game.wave = 10;
    game.timeScale = 4;
    game.startWave();
  }
}

// Called every update while a shot pose is active.
export function checkShot(game) {
  if (game.shotReady) return;
  if (game.shot === 'play') {
    if (game.enemies.length >= 5 && game.projectiles.length >= 2) game.shotReady = true;
  } else if (game.shot === 'big') {
    if ((game.stats.gongHits || 0) > 0 && game.enemies.length >= 4) game.shotReady = true;
  } else if (game.shot === 'win') {
    if (game.state === 'victory') game.shotReady = true;
  }
  // Safety: never wait forever — a pose that cannot complete still yields a
  // frame (the probe logs it and the shot is retaken by hand).
  if (game.time > 120) game.shotReady = true;
}
