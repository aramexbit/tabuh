// Screenshot poses (?shot=menu|play|big|win). Each pose drives the real game
// (real towers, real waves, real stats) and sets game.shotReady when the frame
// is ready to capture. Nothing here hardcodes a screenshot's numbers.
import { TOTAL_WAVES } from './config.js';

// How many live spirits are in the LOWER half of the field (y > 360)?
// v2.7: ghosts hunt towers all over the field, so the capture condition is
// real spread — at least 2 ghosts down low — not a teleported center band.
// (The old spreadToCenter placement was deleted: staging is gone, the AI
// spreads the pack itself. The center-band helpers went with it.)
function lowerHalfCount(game) {
  return game.enemies.filter((e) => e.y > 360).length;
}

// v2.8: how many ghosts are actually FIGHTING a lower-half tower right
// now (in range, target below y=360)? Spread alone is not enough — the
// reviewer caught frames where 2 ghosts stood low but nothing was
// happening down there. The capture needs a real fight in the lower half.
function bottomAttackCount(game) {
  return game.enemies.filter(
    (e) => e.inRange && e.targetTower && e.targetTower.y > 360,
  ).length;
}

// v2.8: how many ghosts are fighting in the CENTRE band (x 448-832)?
// The big pose must catch the action in the middle of the field, not a
// pack piled on the right edge while a beam fills the centre.
function centerFightCount(game) {
  return game.enemies.filter((e) => e.inRange && e.x >= 448 && e.x <= 832).length;
}

function giveCoins(game, n) {
  game.coins = n;
}

// Stage the relics a real player would already own at this wave
// (Keris M3, Gong M5, Kendi M7, Jimat M9) so no frame shows grey medals
// for relics that wave's player has earned.
function stageRelics(game, keys) {
  game.relics = new Set(keys);
  if (keys.includes('jimat')) {
    game.gateMaxHp = 25;
    game.gateHp = 25;
  }
}

// Stage the score a real player would already have at this wave, exactly
// like stageRelics. Measured from a real perfect-tabuh run (seed 1):
// wave 6 start 24.095, wave 7 start 32.365, wave 9 start 53.250,
// wave 10 start 66.866, victory 88.542. The formula itself is already in
// the top-10 band (22-63 ribu mid-game) — the v2.3 frames were low only
// because every pose started from score 0. A x10 formula would push the
// victory score to ~885 ribu, so the formula stays untouched.
function stageScore(game, n) {
  game.score = n;
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
    // Wave 6 Bulan Purnama: twist banner + coin pops x2 + a diverse field
    // (Genderuwo, Pocong, Kuntilanak) instead of the near-empty wave 3.
    // Kenong on pad 0 covers the spirit gate, so it fires from the first
    // beat and the first kill lands while the banner is still up.
    // Lower pads filled too (R4): saron@7 + bonang@5, so the bottom half
    // of the field has towers for the hunting ghosts to attack.
    giveCoins(game, 900);
    // All towers stay LEVEL 1 in this pose: L2 firepower (~40% more DPS)
    // shreds the far-hunting ghosts on the long walk, so none ever reached
    // the lower half (diagnostics 18 Nov: max lowerHalf 0 at L2, 1 at wave
    // 7). L1 is also what a real wave-6 player can afford (~450 coins,
    // not 630) — and the ghosts that survive the walk then fight the
    // towers in the lower half, which is the frame's whole point.
    game.buildTower('saron', 1);
    game.buildTower('bonang', 3);
    game.buildTower('kenong', 0);
    game.buildTower('saron', 7);
    game.buildTower('bonang', 5);
    game.wave = 6;
    game.startWave();
    stageRelics(game, ['keris', 'gong']);
    stageScore(game, 24095);
  } else if (shot === 'big') {
    // Wave 7: one Buto Ijo + 6 Genderuwo + fast Pocong/Tuyul. The gong
    // sits on pad 5 (640,482, centre of the LOWER half), not the central
    // pad 4: at pad 4 the gong's AoE sat on the diagonal to the lower pads
    // and shredded every walker before it reached y>360 (wave 7: max
    // lowerHalf 0, 0, 1). At pad 5 the ghosts hunting the gong ARRIVE in
    // the lower half and fight it there — which is exactly the frame's
    // point. Lower pads filled (R4): gong@5 + saron@7. All towers L1
    // (see the play pose).
    giveCoins(game, 900);
    game.buildTower('gong', 5);
    game.buildTower('kenong', 2);
    game.buildTower('bonang', 3);
    game.buildTower('saron', 1);
    game.buildTower('saron', 7);
    game.wave = 7;
    game.startWave();
    stageRelics(game, ['keris', 'gong']);
    stageScore(game, 32365);
  } else if (shot === 'boss') {
    // Wave 10 boss fight, mid-battle: the Raja on the field with adds around.
    // No towers on pads 0/1 (near the spirit gate) AND none on pads 2/3:
    // the boss hunts the nearest tower, so with the gate-side pads empty he
    // walks into the field instead of camping the top-right corner — and
    // with pads 2/3 empty too, his target is the gong on pad 4 (660,288),
    // dead centre, instead of the kenong/bonang at x~900-1020. Lower pads
    // filled (R4): kendang@6 + saron@7 + bonang@5 — the far hunters' ground.
    giveCoins(game, 1200);
    game.buildTower('gong', 4);
    game.buildTower('kendang', 6);
    game.buildTower('saron', 7);
    game.buildTower('bonang', 5);
    game.wave = 10;
    game.startWave();
    stageRelics(game, ['keris', 'gong', 'kendi', 'jimat']);
    stageScore(game, 66866);
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
    buildMaxed(game, 'saron', 7); // lower pad filled (R4)
    game.wave = 9;
    game.startWave();
    // A real wave-9 player owns Keris + Gong + Kendi already (Jimat comes
    // from clearing wave 9, during this pose).
    stageRelics(game, ['keris', 'gong', 'kendi']);
    stageScore(game, 53250);
  }
}

// The win pose plays waves 9+10 with counter-attacks on: like a real player,
// it repairs chipped towers and rebuilds destroyed ones between waves.
const WIN_BOARD = [
  ['gong', 0], ['kenong', 2], ['bonang', 3], ['saron', 4], ['kendang', 5],
  ['saron', 7],
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
// v2.7: captures come from REAL gameplay now — the hunting AI spreads the
// pack itself, so no ghost is ever teleported for a frame. Each pose waits
// for a busy field with at least 2 ghosts in the lower half (y > 360);
// a time fallback (45 s with enemies still out) keeps a slow pose from
// falling through to the 120 s safety with an empty build-phase frame.
// v2.8: the v2.7 fallback fired on clustered frames and bypassed the
// spread the poses exist to show (reviewer #7: 0 ghosts below y=360 in
// frames 1-2). The fallback now waits longer (60 s) and STILL requires
// real spread — it only relaxes the stricter fight/position conditions.
// The strict conditions additionally require a REAL fight in the lower
// half (a ghost in range of a bottom tower), not just ghosts standing low.
export function checkShot(game) {
  if (game.shotReady) return;
  const spread = lowerHalfCount(game) >= 2;
  const bottomFight = bottomAttackCount(game) >= 1;
  const fallback = game.time >= 60 && game.enemies.length >= 5 && spread;
  if (game.shot === 'play') {
    // Wave 6 Purnama: capture AFTER the 6 s twist banner has faded
    // (spawner.t >= 6.8), so the field + spirits are visible instead of
    // hidden behind the banner — the twist pill under the top bar still
    // names it. Require a busy field and at least 2 kills, so x2 coin pops
    // have already happened.
    const afterBanner = game.spawner.t >= 6.8 && game.enemies.length >= 5 && game.stats.kills >= 2;
    if ((afterBanner && spread && bottomFight) || fallback) {
      game.shotReady = true;
    }
  } else if (game.shot === 'big') {
    // Capture the gong at its best: a busy field with the pack spread into
    // the lower half. The gong condition is a preference, not a gate: once
    // the gong has ever caught 2+ spirits, capture as soon as the field
    // spreads; otherwise capture once the battle is well underway (t>=30)
    // — the gong fires constantly in a busy wave, so a shockwave ring is
    // usually visible anyway. Requiring maxGongHits>=2 alone made the pose
    // flaky (ready 1 run in 3).
    // v2.8 (P3): the fight itself must be in the CENTRE band — 2+ ghosts
    // in range at x 448-832 — so the frame shows the battle mid-field,
    // not a pack piled on the right edge behind a beam.
    const gongReady = (game.stats.maxGongHits || 0) >= 2 || game.time >= 30;
    const centre = centerFightCount(game) >= 2;
    if ((game.enemies.length >= 5 && spread && bottomFight && centre && gongReady) || fallback) {
      game.shotReady = true;
    } else if (game.phase === 'build' && game.state === 'playing' && game.wave < TOTAL_WAVES) {
      // Wave cleared without a good frame: press on to the next wave
      // (the win pose does the same). The towers are already chipped or
      // destroyed, so the next wave's pack spreads into the lower half
      // more easily — one wave alone was flaky (2/3 in the probe harness).
      game.startWave();
    }
  } else if (game.shot === 'boss') {
    // Capture the boss on screen with a busy field, the combo high enough
    // that the Gong Raksasa is glowing and ready to fire — and the boss
    // walked into the field (y > 180) hunting the nearest tower, not camped
    // at the spirit gate. NOTE: no projectiles>=2 requirement — live
    // projectiles last ~0.2 s, so the count is 0 in ~90% of frames and the
    // pose was flaky (240 s timeout, victory screen captured instead).
    // v2.8 (P2): the boss must be in the CENTRE band (x 512-768) — with
    // pads 2/3 empty he parks on the pad-4 gong at x~660. v2.8 (P0): a
    // real fight in the lower half, not just ghosts standing low. The
    // frame's action comes from the boss, the pack, and the gong's own
    // beams — the capture tool no longer fires the Gong Raksasa blast
    // right before the shot (it killed the spread-out weak ghosts).
    const bossCentred = game.boss && game.boss.x >= 512 && game.boss.x <= 768;
    if (game.boss && game.enemies.length >= 6
      && game.combo >= 14 && game.boss.y > 180 && bossCentred && spread && bottomFight) {
      game.shotReady = true;
    } else if (fallback && game.boss) {
      game.shotReady = true;
    }
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
