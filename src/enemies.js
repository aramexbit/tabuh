// Spirits: hantu Indonesia — Kuntilanak, Tuyul, Pocong, Genderuwo, Buto Ijo.
// Each has a type definition (config.js), a distance along the path, and
// temporary slow / stun timers. Every figure is drawn in code — no image
// assets — with its own silhouette, motion (float / hop / shamble), and HP bar.
import { ENEMIES, enemyHp, enemySpeed } from './config.js';

let nextId = 1;

// ---- Tower-hunting AI (v2.7) ----
// Ghosts no longer walk the stone path. Each ghost hunts a tower: it picks
// a target (nearest, with a penalty per ghost already hunting it so the pack
// spreads instead of piling onto one tower), walks straight at it, and
// attacks it until it breaks — then retargets. With no towers left, it
// heads for the village gate. The gate is the finish line, not the first
// stop: that is what the player asked for ("destroy the weapons first").
// Powers are unchanged — only movement + targeting moved.
const GATE_POS = { x: 150, y: 648 };
const ATTACK_RANGE = { wisik: 80, kunang: 80, bayang: 90, slira: 100, raksasa: 110, raja: 120, emas: 0 };

// v2.22 (JURUS): the attack is a 3-phase jurus, not an instant hit.
// Windup (slow anticipation, the telegraph) -> strike (damage lands on
// the strike frame, 1-2 frames of smear) -> recovery (the pose is HELD
// until the ghost can move again — never idle before it can act). The
// strike-to-strike cadence is UNCHANGED per type (ATK_CD): the windup
// starts ATK_CD - 1.12 s after the previous recovery ends, so the
// damage lands exactly ATK_CD after the previous damage. No damage,
// HP, speed or economy value changes — this is animation only.
const ATK_CD = { wisik: 3.0, kunang: 2.0, bayang: 3.0, slira: 2.0, raksasa: 2.5, raja: 2.0 };
const WINDUP_DUR = 0.45; // slow anticipation (the telegraph)
// v2.23 (R4): the strike lasts 0.20 s (was 0.12) so the smear is
// catchable in a still frame, and the recovery shortens to 0.47 s —
// the cadence stays exactly 0.45 + 0.20 + 0.47 = 1.12 s, so no damage,
// HP, speed or economy value changes.
const STRIKE_DUR = 0.20; // the hit, with its smear
const RECOVERY_DUR = 0.47; // medium settle, pose held throughout
const FIRST_WINDUP_DUR = 2.0; // first strike: the long sizing-up windup
const HITSTOP_SMALL = 0.03; // freeze on a normal strike landing
const HITSTOP_BIG = 0.08; // freeze on a Buto/Raja smash landing
const HUNTER_PENALTY = 600; // px-equivalent per ghost already hunting a tower
// Big enough that the pack spreads nearly round-robin across ALL towers
// (one hunter each before any tower gets its second): the first ghosts
// are the tanky slira, and as the near towers fill up the 0.75 hysteresis
// lets them migrate to the far pads — so the tanks, not only the fragile
// wisik/bayang, end up hunting the lower half. With 260 the far pads
// were only ever picked by fragile ghosts that died on the long walk
// (v2.7 probe still 30/32: play/big never saw 2 ghosts below y=360).
// v2.8 — far hunters: the round-robin above still filled the NEAR pads
// first, so the pack's centre of mass stayed top-right and the lower half
// read empty in 2 of 4 frames (reviewer #7). 40% of ghosts are now
// FAR HUNTERS: they only hunt towers in the lower half (y > 360), so
// 2-3 ghosts are always working the bottom pads. The boss (raja) and the
// golden tuyul (emas) are never far hunters — the boss must stay
// targetable in the centre band for the boss pose, and the emas runs
// straight for the gate anyway.

function huntersOn(game, tower, self) {
  let n = 0;
  for (const e of game.enemies) if (e.targetTower === tower && e !== self) n++;
  return n;
}

function bestTarget(game, e) {
  // Far hunters only consider lower-half towers (if any exist); everyone
  // else considers the whole board. The restriction rides along through
  // pickTarget's hysteresis re-picks, so a far hunter never drifts back
  // to a near tower mid-walk.
  let pool = game.towers;
  if (e.farHunter) {
    const low = game.towers.filter((t) => t.y > 360);
    if (low.length > 0) pool = low;
  }
  let best = null, bestScore = Infinity;
  for (const t of pool) {
    // A Tuyul never returns to a tower it already robbed.
    if (e.type === 'kunang' && e.stolenFrom.includes(t.padIndex)) continue;
    const d = Math.hypot(e.x - t.x, e.y - t.y);
    const score = d + HUNTER_PENALTY * huntersOn(game, t, e) + (e.id % 5) * 17;
    if (score < bestScore) { best = t; bestScore = score; }
  }
  return best;
}

// (Re)pick a hunt target. force=true when the target is gone (no
// hysteresis); the periodic re-pick only switches when clearly better, so
// ghosts don't flip-flop between two near-equal towers.
function pickTarget(game, e, force = false) {
  if (e.type === 'emas') { e.targetTower = null; e.targetGate = true; e.inRange = false; e.retargetCd = 2.5; return; }
  const best = bestTarget(game, e);
  if (!best) { e.targetTower = null; e.targetGate = true; e.inRange = false; e.retargetCd = 2.5; return; }
  if (!force && e.targetTower && e.targetTower !== best) {
    const cur = Math.hypot(e.x - e.targetTower.x, e.y - e.targetTower.y)
      + HUNTER_PENALTY * huntersOn(game, e.targetTower, e) + (e.id % 5) * 17;
    const next = Math.hypot(e.x - best.x, e.y - best.y)
      + HUNTER_PENALTY * huntersOn(game, best, e) + (e.id % 5) * 17;
    if (next > cur * 0.75) { e.retargetCd = 2.5; return; } // keep the current target
  }
  e.targetTower = best;
  e.targetGate = false;
  e.inRange = false;
  e.retargetCd = 2.5;
}

export function createEnemy(type, wave, rng) {
  const def = ENEMIES[type];
  const speed = enemySpeed(type, wave) * rng.range(0.92, 1.08);
  const id = nextId++;
  return {
    id,
    type,
    def,
    x: 0,
    y: 0,
    angle: 0,
    hp: enemyHp(type, wave),
    maxHp: enemyHp(type, wave),
    speed,
    baseSpeed: speed, // enrage phases multiply this (was 0: dead code after
    // return left it unset, so an enraged boss FROZE instead of speeding up)
    phase: 0, // boss phases: 0 normal, 1 enraged (50%), 2 furious (25%)
    radius: def.radius,
    reward: def.reward,
    gateDmg: def.gateDmg,
    slowUntil: 0,
    slowFactor: 1,
    stunUntil: 0,
    wobble: rng.range(0, Math.PI * 2),
    wobbleAmp: rng.range(3, 7),
    flash: 0,
    attackCd: 2 + rng.range(0, 1.5), // ghosts size up the towers before striking
    stolenFrom: [], // padIndex list a Tuyul already stole from
    farHunter: type !== 'raja' && type !== 'emas' && (id % 10) < 5, // v2.9:
    // 50% of ghosts hunt ONLY lower-half towers (was 40% in v2.8, R4) —
    // one more spread push, only after R1-R3. Deterministic by id: any
    // block of 10 spawns holds exactly 5 far hunters.
    targetTower: null, // the tower this ghost is hunting (v2.7 AI)
    targetGate: false, // true when no towers are left: head for the gate
    retargetCd: 0, // periodic re-pick timer (keeps the spread adaptive)
    inRange: false, // standing at the target, attacking
    // v2.22 (JURUS): the 3-phase attack state machine. atkPhase 'none'
    // = waiting for the next windup (attackCd counts down); 'windup' /
    // 'strike' / 'recovery' = the jurus in progress (atkT seconds in,
    // atkDur the phase length). atkTower = the tower this jurus will
    // hit (locked at windup start; if it dies mid-windup the strike
    // whiffs). px/py = last frame's position — hair/cloth trails 1
    // frame behind the body. prevAngle/pivotUntil = the 1-frame pivot
    // on a direction reversal. roarUntil = boss enrage roar (game time).
    atkPhase: 'none',
    atkT: 0,
    atkDur: 0,
    atkFirst: true,
    atkTower: null,
    px: 0,
    py: 0,
    prevAngle: null,
    pivotUntil: 0,
    roarUntil: 0,
    lane: rng.range(-18, 18), // per-ghost offset so the pack doesn't stack
  };
}

function drawTuyulEmas(ctx, e, time) {
  const { x } = e;
  const y = e.y + Math.sin(time * 6 + e.wobble) * 1.5;
  // Pulsing gold halo so the bonus spirit reads instantly.
  ctx.save();
  ctx.shadowColor = '#ffd76a';
  ctx.shadowBlur = 14 + Math.sin(time * 6) * 6;
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath();
  ctx.arc(x, y - 2, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Body: tiny gold sarong.
  ctx.fillStyle = '#8a6d1f';
  ctx.beginPath();
  ctx.ellipse(x, y + 6, 5.5, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head: bald, bright gold.
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(x, y - 3, 7, 0, Math.PI * 2);
  ctx.fill();
  // Ears.
  ctx.beginPath();
  ctx.arc(x - 7, y - 3, 2, 0, Math.PI * 2);
  ctx.arc(x + 7, y - 3, 2, 0, Math.PI * 2);
  ctx.fill();
  // Big eyes + small mouth (v2.19: glowing yellow-green, mischievous).
  ctx.save();
  ctx.shadowColor = '#c8ff5a';
  ctx.shadowBlur = 6;
  eyes(ctx, x, y - 4, 2.8, 0, 1.8, '#fff3a8');
  ctx.restore();
  eyes(ctx, x, y - 4, 2.8, 0, 0.9, '#0b1020');
  ctx.fillStyle = '#0b1020';
  ctx.beginPath();
  ctx.arc(x, y + 1, 1.6, 0, Math.PI);
  ctx.fill();
  // Floating coin glint above the head.
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('◆', x, y - 14);
  ctx.textAlign = 'left';
}

export function updateEnemy(game, e, dt) {
  // v2.22: previous-frame position — hair/cloth trails 1 frame behind
  // the body (drawn from px/py), then settles 1-2 frames after a stop.
  // Saved first, before every early return, so px/py is always last
  // frame's position (the ghost only moves in the march branch below).
  e.px = e.x;
  e.py = e.y;
  e.flash = Math.max(0, e.flash - dt * 4);
  if (game.time < e.stunUntil) return; // stunned: no movement
  if (game.time < (e.roarUntil || 0)) return; // v2.22: boss enrage roar
  // — the Raja rears up and ROARS for 1 s (the telegraph) before the
  // summon lands; he neither moves nor attacks mid-roar.
  let speed = e.speed;
  if (game.time < e.slowUntil) speed *= e.slowFactor;
  // Malam Berkabut: ghosts move 15% faster.
  if (game.twist === 'kabut') speed *= 1.15;
  // Targeting: no target yet, target gone (destroyed/sold), or periodic
  // re-pick so the spread adapts as towers are built and destroyed.
  if (!e.targetTower && !e.targetGate) pickTarget(game, e, true);
  if (e.targetTower && !game.towers.includes(e.targetTower)) pickTarget(game, e, true);
  e.retargetCd -= dt;
  if (e.retargetCd <= 0) pickTarget(game, e, false);
  // Destination: the hunted tower (with a per-ghost lane offset so the pack
  // doesn't stack on one point) or the village gate.
  // The RANGE check uses the distance to the tower CENTER, not to the lane
  // point: ghostAttack measures from the ghost to the tower center with the
  // same radius, and the lane offset (up to ~20 px) used to park ghosts in
  // a dead zone — in range to stop, out of range to hit — where they stood
  // forever dealing no damage while the tower shot the walkers instead
  // (diagnostic 18 Nov: three ghosts frozen at (1219,118)/(1207,125)/
  // (1208,135) for 20 s, kenong untouched). The walk direction still aims
  // at the lane point, so ghosts spread around the tower instead of
  // stacking on one spot.
  let tx, ty, range;
  if (e.targetTower) {
    tx = e.targetTower.x + e.lane;
    ty = e.targetTower.y + e.lane * 0.5;
    range = ATTACK_RANGE[e.type] || 80;
  } else {
    tx = GATE_POS.x;
    ty = GATE_POS.y;
    range = 55;
  }
  const dx = tx - e.x;
  const dy = ty - e.y;
  const d = Math.hypot(dx, dy);
  // Range check: distance to the tower center (or the gate), so the ghost
  // only stops where its attack can actually reach.
  const dc = e.targetTower
    ? Math.hypot(e.targetTower.x - e.x, e.targetTower.y - e.y)
    : d;
  if (dc <= range) {
    if (e.targetGate) { e.reachedGate = true; return; }
    // In range: stand and fight. v2.22 (JURUS): the attack is a 3-phase
    // jurus, not an instant hit. First arrival starts the LONG windup
    // (2.0 s — the "sizing up" the old attackCd did, now a visible slow
    // coil instead of a frozen wait), so the first strike still lands
    // exactly 2.0 s after arrival. Later strikes: attackCd counts down
    // while atkPhase is 'none', then windup -> strike (damage) ->
    // recovery -> attackCd = ATK_CD - 1.12 s, so the strike-to-strike
    // cadence is exactly the old ATK_CD.
    if (!e.inRange) {
      e.inRange = true;
      startWindup(game, e, true);
    } else if (e.atkPhase === 'none') {
      e.attackCd -= dt;
      if (e.attackCd <= 0) startWindup(game, e, false);
    } else {
      updateAttackPhase(game, e, dt);
    }
    return;
  }
  e.inRange = false;
  // March speed. Far hunters sprint at 3.0x ALL the way until they are IN
  // attack range of their tower; near hunters keep the old 2.0x beyond
  // 350 px / 1.0x close in. The old rule slowed everyone to 1.0x inside
  // 350 px, so a far hunter crawled the last stretch under its target
  // tower's fire and died at the doorstep (diagnostic 18 Nov: a Genderuwo
  // with 10 HP took 5 s to cover the last 158 px to pad 5; a Pocong bound
  // for pad 7 died crossing pad 5's bonang). Sprinting in is what "hunt
  // the tower" means — the approach is a march, the fight is combat speed
  // (the in-range branch above returns early, so march never applies
  // while fighting). This makes the game harder, so re-verify autoplay.
  const march = e.farHunter ? 3.0 : (d > 350 ? 2.0 : 1);
  const step = speed * march * dt;
  // v2.22: 1-frame pivot on a direction reversal — the turn reads as a
  // turn, not an instant flip (wayang stiffness). A reversal is a turn
  // of more than ~86 degrees; small course corrections don't pivot.
  const newAngle = Math.atan2(dy, dx);
  if (e.prevAngle == null) {
    e.prevAngle = newAngle;
  } else {
    let dAng = newAngle - e.prevAngle;
    while (dAng > Math.PI) dAng -= Math.PI * 2;
    while (dAng < -Math.PI) dAng += Math.PI * 2;
    if (Math.abs(dAng) > 1.5) e.pivotUntil = game.time + 1 / 60;
    e.prevAngle = newAngle;
  }
  e.angle = newAngle;
  e.x += (dx / d) * step;
  e.y += (dy / d) * step;
}

function nearestTower(game, e, radius) {
  let best = null;
  let bestD = Infinity;
  for (const t of game.towers) {
    const d = Math.hypot(e.x - t.x, e.y - t.y);
    if (d <= radius && d < bestD) {
      best = t;
      bestD = d;
    }
  }
  return best;
}

function towersNear(game, e, radius) {
  return game.towers.filter((t) => Math.hypot(e.x - t.x, e.y - t.y) <= radius);
}

// v2.22 (JURUS): start a jurus. Lock the tower this jurus will hit
// (the per-type reach — the same radius the strike uses). No tower in
// reach: don't wind up at air — stay ready and retry soon.
function startWindup(game, e, first) {
  const t = nearestTower(game, e, ATTACK_RANGE[e.type] || 80);
  if (!t) { e.attackCd = 0.5; return; }
  e.atkTower = t;
  e.atkPhase = 'windup';
  e.atkT = 0;
  e.atkDur = first ? FIRST_WINDUP_DUR : WINDUP_DUR;
}

// Advance the jurus phase machine. Windup ends -> the strike lands
// (damage, on the strike frame). Strike ends -> recovery (the pose is
// HELD — never idle before the ghost can act). Recovery ends -> ready
// again, with attackCd set so the NEXT strike lands exactly ATK_CD
// after this one (windup 0.45 + strike 0.12 + recovery 0.55 = 1.12).
function updateAttackPhase(game, e, dt) {
  e.atkT += dt;
  if (e.atkPhase === 'windup') {
    if (e.atkT >= e.atkDur) ghostAttackStrike(game, e);
  } else if (e.atkPhase === 'strike') {
    if (e.atkT >= STRIKE_DUR) {
      e.atkPhase = 'recovery';
      e.atkT = 0;
      e.atkDur = RECOVERY_DUR;
    }
  } else if (e.atkPhase === 'recovery') {
    if (e.atkT >= RECOVERY_DUR) {
      e.atkPhase = 'none';
      e.atkT = 0;
      e.atkTower = null;
      e.attackCd = (ATK_CD[e.type] || 2.0) - (WINDUP_DUR + STRIKE_DUR + RECOVERY_DUR);
    }
  }
}

// One strike: the damage lands on the strike frame. The target is the
// tower locked at windup start — if it died mid-windup the strike
// whiffs (the pose still plays, no damage). Sets atkPhase='strike'.
function ghostAttackStrike(game, e) {
  e.atkPhase = 'strike';
  e.atkT = 0;
  if (e.type === 'wisik') {
    // Tawa Melengking: nearby towers stop firing for 1 beat + small damage.
    const near = towersNear(game, e, 80);
    if (near.length === 0) return; // whiff: no tower left in reach
    for (const t of near) {
      t.stunUntil = game.time + 1 * game.beatDur;
      game.damageTower(t, 4, e);
    }
    // v2.19 — Kuntilanak scratching: pale claw streaks across the tower.
    const t0 = near[0];
    const angW = Math.atan2(t0.y - e.y, t0.x - e.x);
    game.effects.claw(t0.x, t0.y, angW, '#d8ecff');
    game.effects.ring(e.x, e.y, 70, 'rgba(180,220,255,0.8)', 2.0, 3, true);
    game.hitStop = Math.max(game.hitStop || 0, HITSTOP_SMALL);
    return;
  }
  if (e.type === 'kunang') {
    // Mencuri Koin: each Tuyul steals a few coins from a tower it passes.
    const t = e.atkTower;
    if (!t || !game.towers.includes(t) || e.stolenFrom.includes(t.padIndex)) return; // whiff
    e.stolenFrom.push(t.padIndex);
    const steal = Math.min(3, game.coins);
    game.coins -= steal;
    game.effects.text(t.x, t.y - 34, `-${steal} ◆`, '#ff9a3d', 15);
    // v2.19 — Tuyul snatching: gold coins burst out of the robbed tower.
    game.effects.coinBurst(t.x, t.y);
    game.hitStop = Math.max(game.hitStop || 0, HITSTOP_SMALL);
    // Robbed this tower: move on to the next one (or the gate, if every
    // tower has been robbed) instead of parking here forever.
    e.targetTower = null;
    return;
  }
  if (e.type === 'bayang') {
    // Kafan Membungkus: the tower's firing slows to 25% for 4 beats.
    const t = e.atkTower;
    if (!t || !game.towers.includes(t)) return; // whiff
    t.slowUntil = game.time + 4 * game.beatDur;
    t.slowFactor = 0.25;
    game.damageTower(t, 4, e);
    // v2.19 — Pocong leaping slam: impact burst on the tower.
    game.effects.burst(t.x, t.y - 10, '#ffe9a8', 10);
    game.effects.ring(t.x, t.y, 46, 'rgba(245,242,232,0.7)', 2.0, 3, true);
    game.hitStop = Math.max(game.hitStop || 0, HITSTOP_SMALL);
    return;
  }
  if (e.type === 'slira') {
    // Pukulan Bulu: heavy durability damage.
    const t = e.atkTower;
    if (!t || !game.towers.includes(t)) return; // whiff
    game.damageTower(t, 18, e);
    // v2.19 — Genderuwo big claws: blood-red slash streaks.
    const angS = Math.atan2(t.y - e.y, t.x - e.x);
    game.effects.claw(t.x, t.y, angS, '#ff4a3d');
    game.hitStop = Math.max(game.hitStop || 0, HITSTOP_SMALL);
    game.shake = Math.max(game.shake, 0.2);
    return;
  }
  if (e.type === 'raksasa') {
    // Hantaman Raksasa: very heavy durability damage.
    const t = e.atkTower;
    if (!t || !game.towers.includes(t)) return; // whiff
    game.damageTower(t, 30, e);
    game.effects.burst(t.x, t.y - 10, '#8a94a8', 8);
    // v2.19 — Buto Ijo two-fist slam: shockwave ring + orange debris.
    game.effects.ring(t.x, t.y, 95, '#ff9a3d', 2.5, 5, true);
    game.effects.burst(t.x, t.y - 10, '#ff7a3d', 12);
    // v2.22: the smash lands with a hit-stop (the world flinches) +
    // a bigger shake — the weight of the blow.
    game.hitStop = Math.max(game.hitStop || 0, HITSTOP_BIG);
    game.shake = Math.max(game.shake, 0.3);
    return;
  }
  if (e.type === 'raja') {
    // Hantaman Raja: the hardest single hit in the game.
    const t = e.atkTower;
    if (!t || !game.towers.includes(t)) return; // whiff
    game.damageTower(t, 45, e);
    game.effects.ring(t.x, t.y, 90, '#ff9a3d', 2.5, 5, true);
    // v2.19 — Raja slam: gold burst with the shockwave.
    game.effects.burst(t.x, t.y - 10, '#ffd76a', 12);
    game.hitStop = Math.max(game.hitStop || 0, HITSTOP_BIG);
    game.shake = Math.max(game.shake, 0.4);
    return;
  }
}

// Visual scale per type (DRAWING ONLY — hitbox, HP, speed and damage are
// untouched). The v2.4 frames read as "small white blobs" because the
// sprites were drawn at their hitbox radius; the Raja was only 1.5x a Buto
// and sat in the top-right corner. Now every spirit is 25-30% bigger and
// the Raja is a true centrepiece at 2.2x.
// v2.19 (multi-gate): every spirit grows ~1.6x more — the mockup's ghosts
// are LARGE and menacing, not small blobs. The Raja only grows 3.2 -> 3.5:
// he is already the centrepiece, and a bigger crown would collide with
// the boss bar (crown top must stay below y=100 at his parking spot).
const VISUAL_SCALE = { wisik: 2.0, kunang: 2.0, bayang: 2.0, slira: 2.0, raksasa: 2.3, raja: 3.5, emas: 2.1 };

// Visual radius: the figure's real on-screen size (hitbox radius x the
// per-type visual scale). Game code that places floating text above a
// spirit must use this, not e.radius, or the numbers land inside the body.
export function visualRadius(e) {
  return e.radius * (VISUAL_SCALE[e.type] || 1);
}

export function drawEnemy(ctx, e, time, game) {
  const c = e.def.color;
  const pulse = 0.75 + Math.sin(time * 4 + e.wobble) * 0.25;
  // v2.23 (reviewer #20, R1): during the BOSS POSE capture the frame is
  // one clean boss — no sprite HP bars (his HP lives in the top bar),
  // no rim-light on his crown. game is threaded from Game.draw().
  const vs = VISUAL_SCALE[e.type] || 1;
  const vr = visualRadius(e); // visual radius — the figure's real on-screen size
  // v2.24 (reviewer #21, R2): in the BOSS POSE no ground shadow / foot
  // ring may circle the boss — his own orange+gold foot rings read as
  // two gold ellipses around his waist, and any near minion's ring
  // crosses his body. The boss loses his shadow + rings entirely;
  // other ghosts lose theirs within 240 px of his centre.
  const bossPose = game && game.shot === 'boss';
  const boss = bossPose ? game.boss : null;
  const nearBoss = boss && boss.hp > 0 && Math.hypot(e.x - boss.x, e.y - boss.y) < 240;
  const hideGround = bossPose && (e.type === 'raja' || nearBoss);
  // Ground shadow + type-color base ring at the feet: every spirit now has
  // a dark anchor and its own colour on the ground, so types read apart.
  if (!hideGround) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + vr * 0.8, vr * 0.9, vr * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Faint aura so the figure reads against the dark field. Stronger now
  // (0.55, was 0.4): the v2.6 frames read the spirits as pale blobs —
  // the aura + foot ring must carry the type colour.
  // v2.10 (reviewer #9, R3): the Raja's aura is GOLD-RED, not the Buto's
  // green — the boss read as "a bigger Buto" because his aura, ring and
  // body were the same green. Now he is unmistakable at thumbnail size.
  // v2.12 (reviewer #11, R3): the aura was TOO big — a 2.2x-vr disc that
  // washed the centre and hid the boss himself. The Raja's aura is now
  // 1.5x vr at alpha 0.4 (other types keep 2.2x / 0.55).
  // v2.13 (reviewer #12, P0-1): STILL a ball of light — the glow eats
  // ~30% of the centre and the boss has no readable silhouette. Cut the
  // Raja's glow ~40% more (1.5x -> 1.1x vr, alpha 0.4 -> 0.3) AND draw
  // a dark backdrop disc BEHIND him first, so the dark-red body reads
  // as a solid shape against the bright field instead of dissolving
  // into the beam + glow. Other types keep their aura (they need it —
  // they are small and pale).
  if (e.type === 'raja') {
    const bd = ctx.createRadialGradient(e.x, e.y, 1, e.x, e.y, vr * 1.4);
    bd.addColorStop(0, 'rgba(5,2,8,0.6)');
    bd.addColorStop(0.7, 'rgba(5,2,8,0.35)');
    bd.addColorStop(1, 'rgba(5,2,8,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = bd;
    ctx.beginPath();
    ctx.arc(e.x, e.y, vr * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // v2.20 (reviewer #18, R4): the Raja was PINK-CARTOON — a light red
  // body (#7a2436) with amber eyes and a gold-red aura read as "a cute
  // bigger Buto". Now: near-black blood-red body, bigger black horns,
  // glowing BLOOD-RED eyes, dark purple-red aura. Menacing, not cute.
  const auraColors = e.type === 'raja'
    ? ['#ff2a1a', '#7a0f2a', 'rgba(0,0,0,0)']
    : [c, c + '88', 'rgba(0,0,0,0)'];
  const auraR = e.type === 'raja' ? vr * 1.1 : vr * 1.8;
  const auraA = e.type === 'raja' ? 0.35 : 0.55;
  const g = ctx.createRadialGradient(e.x, e.y, 1, e.x, e.y, auraR);
  g.addColorStop(0, auraColors[0]);
  g.addColorStop(0.4, auraColors[1]);
  g.addColorStop(1, auraColors[2]);
  ctx.globalAlpha = auraA * pulse;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(e.x, e.y, auraR, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // The figure itself, scaled around its own centre. The Raja is a Buto
  // drawn 2.2x with a gold crown sized to match. A soft type-colour glow
  // (shadowBlur) lifts the figure off the dark field so it never reads
  // as a flat blob.
  // v2.22 (JURUS): the attack pose comes from the phase machine, not a
  // frozen timer. Windup: the figure coils BACK (away from the target,
  // -6 px) and swells slightly — slow anticipation, the telegraph.
  // Strike: it lunges FORWARD fast (+14 px) and swells — the hit.
  // Recovery: it eases back to rest over 0.55 s (the pose is HELD, so
  // the ghost never looks idle before it can act). The pose is a
  // PROGRESSION (atkT/atkDur), so a 2.0 s first windup reads as a slow
  // coil, not a frozen frame.
  // Walk lean: while walking (not fighting), the figure leans a touch
  // toward its movement direction — no more constant-speed stiffness.
  // Pivot: on a direction reversal, one frame of pivot pose (horizontal
  // squash + twist) so the turn reads as a turn, not a flip.
  let lx = 0, ly = 0, lungeScale = 1, lean = 0, squashX = 1;
  if (e.atkPhase === 'windup' || e.atkPhase === 'strike' || e.atkPhase === 'recovery') {
    const tgt = e.atkTower || e.targetTower || GATE_POS;
    const ddx = tgt.x - e.x, ddy = tgt.y - e.y;
    const dd = Math.hypot(ddx, ddy) || 1;
    const ux = ddx / dd, uy = ddy / dd;
    const p = Math.min(1, e.atkT / Math.max(0.01, e.atkDur));
    let m = 0;
    if (e.atkPhase === 'windup') { m = -6 * p; lungeScale = 1 + 0.02 * p; }
    else if (e.atkPhase === 'strike') { m = 14; lungeScale = 1.10; }
    else { m = 14 * (1 - p); lungeScale = 1 + 0.10 * (1 - p); }
    lx = ux * m; ly = uy * m;
  } else if (!e.inRange) {
    lean = 0.06 * Math.sign(Math.cos(e.angle) || 1);
  }
  if (time < (e.pivotUntil || 0)) {
    squashX = 0.7;
    lean = 0.25 * Math.sign(Math.cos(e.angle) || 1);
  }
  ctx.save();
  ctx.translate(e.x + lx, e.y + ly);
  ctx.rotate(lean);
  ctx.scale(vs * lungeScale * squashX, vs * lungeScale);
  ctx.translate(-e.x, -e.y);
  ctx.shadowColor = c;
  ctx.shadowBlur = 10;
  if (e.type === 'wisik') drawKuntilanak(ctx, e, time);
  else if (e.type === 'kunang') drawTuyul(ctx, e, time);
  else if (e.type === 'emas') drawTuyulEmas(ctx, e, time);
  else if (e.type === 'bayang') drawPocong(ctx, e, time);
  else if (e.type === 'slira') drawGenderuwo(ctx, e, time);
  else if (e.type === 'raja') drawRaja(ctx, e, time, game);
  else drawButo(ctx, e, time);
  ctx.restore();
  if (e.type === 'raja') {
    // Gold crown, sized to the 3.5x body. v2.20: the horns now reach
    // -46 local (-161 absolute), so the horn tips frame the crown
    // slightly above it — the crown sits between them, not above them.
    // Crown top (y ~147 at the boss's parking spot) still clears the
    // boss bar (ends y=118).
    ctx.save();
    ctx.shadowColor = '#ffd76a';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    ctx.moveTo(e.x - 33, e.y - 126);
    ctx.lineTo(e.x - 33, e.y - 148);
    ctx.lineTo(e.x - 16, e.y - 133);
    ctx.lineTo(e.x, e.y - 153);
    ctx.lineTo(e.x + 16, e.y - 133);
    ctx.lineTo(e.x + 33, e.y - 148);
    ctx.lineTo(e.x + 33, e.y - 126);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ff4a3d';
    for (const gx of [-16, 0, 16]) {
      ctx.beginPath();
      ctx.arc(e.x + gx, e.y - 140, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Type-color ring at the feet (drawn over the figure's base).
  // v2.10 (R3): the Raja's ring is orange + an outer gold ring, not green.
  // v2.24 (R2): hidden in the boss pose (see hideGround above) — the
  // boss's own two rings circled his waist in the v2.23 frame.
  if (!hideGround) {
    if (e.type === 'raja') {
      ctx.strokeStyle = '#ff9a3d';
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + vr * 0.8, vr * 0.95, vr * 0.32, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#ffd76a';
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + vr * 0.8, vr * 1.15, vr * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      ctx.strokeStyle = c;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + vr * 0.8, vr * 0.95, vr * 0.32, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  if (e.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${0.7 * e.flash})`;
    ctx.beginPath();
    ctx.arc(e.x, e.y, vr * 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  // HP bar: shown only when DAMAGED (or the boss) — v2.14 (reviewer #13,
  // P1): always-on bars were clutter in a crowd (8+ overlapping in the
  // big frame). A full-HP ghost needs no bar; a damaged one shows its
  // 7 px bar with dark border, staggered so neighbours don't align.
  // v2.23 (R1): none at all in the boss frame — not even the boss's own
  // sprite bar (it sat right under his crown, over the horns).
  // v2.23 (R3): none during the big frame's blast either — the
  // explosion is the only thing in the frame.
  const bossClean = game && game.shot === 'boss';
  const quiet = game && game.shotSpectacleQuiet;
  if (!bossClean && !quiet && (e.hp < e.maxHp || e.type === 'raja')) {
    const w = vr * 2 + 8;
    const pct = Math.max(0, e.hp / e.maxHp);
    const hpY = e.y - vr - 14 - (e.id % 3) * 6;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(e.x - w / 2, hpY, w, 7);
    ctx.fillStyle = pct > 0.5 ? '#7fe3a8' : pct > 0.25 ? '#ffd76a' : '#ff7a6a';
    ctx.fillRect(e.x - w / 2, hpY, w * pct, 7);
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(e.x - w / 2, hpY, w, 7);
  }
}

function eyes(ctx, x, y, dx, dy, r, color = '#0b1020') {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x - dx, y + dy, r, 0, Math.PI * 2);
  ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
  ctx.fill();
}

// v2.22 (JURUS): phase progress (0..1) + hair/cloth lag for a ghost.
// p = atkT/atkDur for the current phase (0 when not attacking). lag =
// the previous frame's offset, clamped — hair/cloth trails 1 frame
// behind the body and settles 1-2 frames after a stop. The lag is only
// a few px at walk speed, but a full 12 px on a strike lunge or a dash
// — exactly when the trail must read.
function jurusP(e) {
  if (!e.atkPhase || e.atkPhase === 'none') return 0;
  return Math.min(1, e.atkT / Math.max(0.01, e.atkDur));
}
function jurusLag(e) {
  return {
    x: Math.max(-12, Math.min(12, (e.px ?? e.x) - e.x)),
    y: Math.max(-12, Math.min(12, (e.py ?? e.y) - e.y)),
  };
}
// Claw smear: the same claw fan drawn at a ghosted (fading) position —
// the strike's motion blur. Called with a low globalAlpha before the
// real arms, so the swipe reads as one fast motion, not a static pose.
function clawSmear(ctx, hx, hy, s, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  for (const a of [-0.5, 0, 0.5]) {
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx + s * 5 + Math.sin(a) * 3, hy + Math.cos(a) * 4 - 2);
    ctx.stroke();
  }
}

// Kuntilanak: white dress, long black hair framing a pale face, floats.
function drawKuntilanak(ctx, e, time) {
  const { x } = e;
  const y = e.y + Math.sin(time * 2 + e.wobble) * 2;
  const ph = e.atkPhase || 'none';
  const p = jurusP(e);
  const lag = jurusLag(e);
  // v2.22 (JURUS "Cakaran Seribu"): windup — hair lifts + arms open
  // wide (the telegraph); strike — the claws sweep across the front
  // with a smear; recovery — the hair settles (it trails 1 frame
  // behind the body, so it lags the lunge and settles after it).
  // v2.23 (R4): the windup is a BIG silhouette change, not a subtle
  // one — arms spread wide AND raised high, hair lifted and swollen.
  // A still frame must read "about to strike" from across the room.
  const windupP = ph === 'windup' ? p : 0;
  const spread = ph === 'windup' ? 13 + 15 * p : ph === 'strike' ? 18 - 12 * p : ph === 'recovery' ? 6 + 7 * p : 13;
  const armY = ph === 'windup' ? 2 - 12 * p : ph === 'strike' ? -2 + 8 * p : ph === 'recovery' ? 6 - 4 * p : 2;
  // Dress: flared white trapezoid with a wavy hem.
  ctx.fillStyle = '#f2f5f0';
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 8);
  ctx.lineTo(x + 6, y - 8);
  ctx.lineTo(x + 11, y + 13);
  ctx.quadraticCurveTo(x + 5, y + 16, x, y + 13);
  ctx.quadraticCurveTo(x - 5, y + 16, x - 11, y + 13);
  ctx.closePath();
  ctx.fill();
  // Soft green-grey outline so the white dress never melts into a Pocong.
  ctx.strokeStyle = 'rgba(90,110,90,0.8)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Arms: thin pale lines reaching out, ending in claws (v2.19).
  // v2.22: the arms are the jurus — wide + raised in the windup, a
  // fast sweep across the front in the strike (with a smear: the arms
  // ghosted at the windup and mid-sweep positions), easing back in
  // the recovery.
  if (ph === 'strike') {
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = '#e8ede6';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 4);
    ctx.lineTo(x - 18, y - 2);
    ctx.moveTo(x + 6, y - 4);
    ctx.lineTo(x + 18, y - 2);
    ctx.stroke();
    for (const s of [-1, 1]) clawSmear(ctx, x + s * 18, y - 2, s, '#f5f2e8');
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 4);
    ctx.lineTo(x - 12, y + 2);
    ctx.moveTo(x + 6, y - 4);
    ctx.lineTo(x + 12, y + 2);
    ctx.stroke();
    for (const s of [-1, 1]) clawSmear(ctx, x + s * 12, y + 2, s, '#f5f2e8');
    ctx.restore();
  }
  ctx.strokeStyle = '#e8ede6';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 4);
  ctx.lineTo(x - spread, y + armY);
  ctx.moveTo(x + 6, y - 4);
  ctx.lineTo(x + spread, y + armY);
  ctx.stroke();
  // Claw tips fanning out from each hand.
  ctx.strokeStyle = '#f5f2e8';
  ctx.lineWidth = 1.5;
  for (const s of [-1, 1]) {
    clawSmear(ctx, x + s * spread, y + armY, s, '#f5f2e8');
  }
  // Hair: dark mass over the head, strands falling past the shoulders.
  // v2.22: the hair trails 1 frame behind the body (lag) and LIFTS in
  // the windup (the anticipation reads in the hair first), then
  // settles through the recovery.
  // v2.23 (R4): the lift is BIG now (8 px, was 3) and the hair SWELLS
  // (rx +3) — the windup reads in the hair before anything else.
  const hairX = x + lag.x * 0.7;
  const hairY = y - 7 - 8 * windupP + lag.y * 0.7;
  ctx.fillStyle = '#14100c';
  ctx.beginPath();
  ctx.ellipse(hairX, hairY, 8.5 + 3 * windupP, 10 + 2 * windupP, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(hairX - 7, y + 1 + lag.y * 0.7, 3, 9, 0.15, 0, Math.PI * 2);
  ctx.ellipse(hairX + 7, y + 1 + lag.y * 0.7, 3, 9, -0.15, 0, Math.PI * 2);
  ctx.fill();
  // v2.19 — whipping hair: two long strands lashing outward, swinging
  // with time so the hair reads as alive (the folklore power, not a wig).
  const whip = Math.sin(time * 3 + e.wobble) * 0.25;
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(hairX + s * 8, hairY + 3);
    ctx.rotate(s * (0.55 + whip + 0.8 * windupP));
    ctx.fillStyle = '#14100c';
    ctx.beginPath();
    ctx.ellipse(0, 8, 2.2, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Pale face peeking through the hair.
  ctx.fillStyle = '#f5e9d8';
  ctx.beginPath();
  ctx.ellipse(x, y - 6, 4.5, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // v2.19 — glowing red eyes (was plain dark).
  ctx.save();
  ctx.shadowColor = '#ff2a1a';
  ctx.shadowBlur = 7;
  eyes(ctx, x, y - 7, 2, 0, 1.4, '#ff4a3d');
  ctx.restore();
  eyes(ctx, x, y - 7, 2, 0, 0.7, '#1a0505');
}

// Tuyul: small bald child, greenish skin, big eyes, quick bob.
function drawTuyul(ctx, e, time) {
  const { x } = e;
  const ph = e.atkPhase || 'none';
  const p = jurusP(e);
  // v2.22 (JURUS): dash in with a smear -> snatch the coins -> dash
  // out. Windup — it CROUCHES (the anticipation); strike — it DASHES
  // at the tower (an extra lunge on top of the shared one) with two
  // fading afterimages trailing behind it; recovery — it slips back.
  const tgt = e.atkTower || e.targetTower || GATE_POS;
  const ddx = tgt.x - e.x, ddy = tgt.y - e.y;
  const dd = Math.hypot(ddx, ddy) || 1;
  const ux = ddx / dd, uy = ddy / dd;
  const dash = ph === 'strike' ? 8 * p : ph === 'recovery' ? 8 * (1 - p) : 0;
  if (ph === 'strike') {
    // Afterimages: the dash trail — two fading copies of the body
    // behind the dash, so the snatch reads as one fast motion.
    for (const [a, f] of [[0.30, 1.0], [0.15, 0.5]]) {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = '#a5d96a';
      ctx.beginPath();
      ctx.arc(x - ux * 8 * f, e.y + Math.sin(time * 6 + e.wobble) * 1.5 - 3, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5d6b3a';
      ctx.beginPath();
      ctx.ellipse(x - ux * 8 * f, e.y + Math.sin(time * 6 + e.wobble) * 1.5 + 6, 5.5, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  let sqX = 1, sqY = 1;
  // v2.23 (R4): the windup crouch is DEEP now (-0.28, was -0.15) — a
  // coiled spring, not a slight dip.
  if (ph === 'windup') { sqY = 1 - 0.28 * p; sqX = 1 + 0.18 * p; }
  else if (ph === 'recovery') { sqY = 0.85 + 0.15 * p; sqX = 1.10 - 0.10 * p; }
  const y = e.y + Math.sin(time * 6 + e.wobble) * 1.5 + uy * dash;
  const dx = x + ux * dash;
  ctx.save();
  ctx.translate(dx, y + 6);
  ctx.scale(sqX, sqY);
  ctx.translate(-dx, -(y + 6));
  // Body: tiny dark sarong.
  ctx.fillStyle = '#5d6b3a';
  ctx.beginPath();
  ctx.ellipse(dx, y + 6, 5.5, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head: bald, greenish — saturated now, so a Tuyul never reads as a
  // pale Pocong at a glance.
  ctx.fillStyle = '#a5d96a';
  ctx.beginPath();
  ctx.arc(dx, y - 3, 7, 0, Math.PI * 2);
  ctx.fill();
  // Ears.
  ctx.beginPath();
  ctx.arc(dx - 7, y - 3, 2, 0, Math.PI * 2);
  ctx.arc(dx + 7, y - 3, 2, 0, Math.PI * 2);
  ctx.fill();
  // Big eyes + small mouth (v2.19: glowing yellow-green, mischievous).
  ctx.save();
  ctx.shadowColor = '#c8ff5a';
  ctx.shadowBlur = 6;
  eyes(ctx, dx, y - 4, 2.8, 0, 1.8, '#fff3a8');
  ctx.restore();
  eyes(ctx, dx, y - 4, 2.8, 0, 0.9, '#0b1020');
  ctx.fillStyle = '#0b1020';
  ctx.beginPath();
  ctx.arc(dx, y + 1, 1.6, 0, Math.PI);
  ctx.fill();
  ctx.restore(); // v2.22: end the jurus squash transform
}

// Pocong: white shroud with ties, dark face slit, hops.
function drawPocong(ctx, e, time) {
  const { x } = e;
  const ph = e.atkPhase || 'none';
  const p = jurusP(e);
  const lag = jurusLag(e);
  // v2.22 (JURUS): windup — the shroud CROUCHES (squash, the body
  // coils down); strike — a HOP-SLAM (the body jumps, then slams down
  // with a squash on landing); recovery — it rises back upright. The
  // torn hem trails 1 frame behind the body.
  let sqX = 1, sqY = 1, slamY = 0;
  // v2.23 (R4): the windup crouch is DEEP now (-0.32, was -0.20) — the
  // shroud coils down before the hop-slam, a silhouette change that
  // reads at thumbnail size.
  if (ph === 'windup') { sqY = 1 - 0.32 * p; sqX = 1 + 0.20 * p; }
  else if (ph === 'strike') {
    slamY = -14 * Math.sin(p * Math.PI);
    sqY = 1 - 0.28 * p;
    sqX = 1 + 0.25 * p;
  } else if (ph === 'recovery') { sqY = 0.72 + 0.28 * p; sqX = 1.25 - 0.25 * p; }
  const hop = -Math.abs(Math.sin(time * 5 + e.wobble)) * 7;
  const y = e.y + hop + slamY;
  const hemLag = lag.y * 0.5;
  ctx.save();
  ctx.translate(x, y + 14);
  ctx.scale(sqX, sqY);
  ctx.translate(-x, -(y + 14));
  // Shroud: rounded top, slightly tapered, TORN jagged bottom (v2.19 —
  // the shroud is ripped, not a clean sheet).
  ctx.fillStyle = '#f5f2e8';
  ctx.beginPath();
  ctx.moveTo(x - 10, y + 14 + hemLag);
  ctx.lineTo(x - 11, y - 8);
  ctx.quadraticCurveTo(x - 11, y - 16, x, y - 16);
  ctx.quadraticCurveTo(x + 11, y - 16, x + 11, y - 8);
  ctx.lineTo(x + 10, y + 14 + hemLag);
  ctx.lineTo(x + 6, y + 18 + hemLag);
  ctx.lineTo(x + 2, y + 13 + hemLag);
  ctx.lineTo(x - 2, y + 18 + hemLag);
  ctx.lineTo(x - 6, y + 13 + hemLag);
  ctx.closePath();
  ctx.fill();
  // Dark outline: the shroud's edge against the white field and the white
  // Kuntilanak dress next to it.
  ctx.strokeStyle = 'rgba(90,80,60,0.85)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Knot at the top.
  ctx.fillStyle = '#e3ddc8';
  ctx.beginPath();
  ctx.arc(x, y - 15, 3.5, 0, Math.PI * 2);
  ctx.fill();
  // Kafan ties across the shroud.
  ctx.strokeStyle = 'rgba(120,110,90,0.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - 10, y - 2);
  ctx.lineTo(x + 10, y - 2);
  ctx.moveTo(x - 10, y + 7);
  ctx.lineTo(x + 10, y + 7);
  ctx.stroke();
  // Face: dark slit with two pale glowing eyes (v2.19: red-hot glow).
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse(x, y - 9, 4.5, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.shadowColor = '#ff3b1a';
  ctx.shadowBlur = 7;
  ctx.fillStyle = '#ff5a3d';
  ctx.beginPath();
  ctx.arc(x - 1.8, y - 10, 1.3, 0, Math.PI * 2);
  ctx.arc(x + 1.8, y - 10, 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.restore(); // v2.22: end the jurus squash transform
}

// Genderuwo: bulky dark hairy body, shaggy outline, red eyes.
function drawGenderuwo(ctx, e, time) {
  const { x, y } = e;
  const ph = e.atkPhase || 'none';
  const p = jurusP(e);
  const lag = jurusLag(e);
  // v2.22 (JURUS): windup — the body LEANS BACK (away from the tower)
  // and the eyes BURN brighter (the telegraph); strike — a DOUBLE
  // CLAW swipe with a smear; recovery — it settles back upright. The
  // shaggy fur trails 1 frame behind the body.
  // v2.23 (R4): the lean-back DOUBLES (-0.22, was -0.12), the arms rise
  // HIGHER (16 px, was 6) and the eyes burn HOTTER — the windup is a
  // different silhouette, not a tilt.
  const tgt = e.atkTower || e.targetTower;
  const dirSign = (tgt ? Math.sign(tgt.x - e.x) : 1) || 1;
  const leanBack = ph === 'windup' ? -0.22 * p * dirSign : ph === 'strike' ? -0.22 * dirSign + 0.22 * p * dirSign : 0;
  const eyeGlow = ph === 'windup' ? 8 + 20 * p : ph === 'strike' ? 20 : ph === 'recovery' ? 20 - 12 * p : 8;
  const eyeR = ph === 'windup' ? 4 + 2 * p : ph === 'strike' ? 5 : 4;
  ctx.save();
  ctx.translate(x, y + 16);
  ctx.rotate(leanBack);
  ctx.translate(-x, -(y + 16));
  // Shaggy fur: spiky dark outline behind the body.
  ctx.fillStyle = '#2e2620';
  ctx.beginPath();
  const spikes = 10;
  for (let i = 0; i <= spikes; i++) {
    const a = (i / spikes) * Math.PI * 2 - Math.PI / 2;
    const rOut = 19 + (i % 2 === 0 ? 4 : 0);
    const px = x + Math.cos(a) * rOut + lag.x * 0.3;
    const py = y + 1 + Math.sin(a) * rOut * 0.95 + lag.y * 0.3;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.65)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Body.
  ctx.fillStyle = '#4a3f35';
  ctx.beginPath();
  ctx.ellipse(x, y + 1, 14, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  // Long arms hanging down, ending in claws (v2.19). v2.22: in the
  // strike they sweep UP and forward in a double claw (with a smear:
  // the arms ghosted at the hanging and mid-sweep positions); in the
  // windup they rise slightly as the body leans back.
  const handY = ph === 'windup' ? 14 - 16 * p : ph === 'strike' ? 14 - 20 * p : ph === 'recovery' ? -6 + 20 * p : 14;
  const handX = ph === 'strike' ? 16 - 6 * p : ph === 'recovery' ? 10 + 6 * p : 16;
  if (ph === 'strike') {
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = '#3a3129';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 13, y - 4);
    ctx.lineTo(x - 16, y + 14);
    ctx.moveTo(x + 13, y - 4);
    ctx.lineTo(x + 16, y + 14);
    ctx.stroke();
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.moveTo(x - 13, y - 4);
    ctx.lineTo(x - 13, y + 4);
    ctx.moveTo(x + 13, y - 4);
    ctx.lineTo(x + 13, y + 4);
    ctx.stroke();
    ctx.restore();
  }
  ctx.strokeStyle = '#3a3129';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 13, y - 4);
  ctx.lineTo(x - handX, y + handY);
  ctx.moveTo(x + 13, y - 4);
  ctx.lineTo(x + handX, y + handY);
  ctx.stroke();
  // Claw tips at each hand.
  ctx.strokeStyle = '#f5f2e8';
  ctx.lineWidth = 1.5;
  for (const s of [-1, 1]) {
    const hx = x + s * handX, hy = y + handY;
    for (const a of [-0.5, 0, 0.5]) {
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + s * 4 + Math.sin(a) * 3, hy + Math.cos(a) * 4);
      ctx.stroke();
    }
  }
  // v2.19 — big curved horns (was hornless).
  ctx.fillStyle = '#1a120c';
  ctx.beginPath();
  ctx.moveTo(x - 9, y - 14);
  ctx.lineTo(x - 16, y - 28);
  ctx.lineTo(x - 6, y - 18);
  ctx.closePath();
  ctx.moveTo(x + 9, y - 14);
  ctx.lineTo(x + 16, y - 28);
  ctx.lineTo(x + 6, y - 18);
  ctx.closePath();
  ctx.fill();
  // Red glowing eyes + fanged mouth (v2.19: bigger, hotter glow).
  // v2.22: the eyes BURN in the windup (the telegraph — the glow and
  // the size grow with the windup progress) and stay hot through the
  // strike, then settle in the recovery.
  ctx.save();
  ctx.shadowColor = '#ff2a1a';
  ctx.shadowBlur = eyeGlow;
  ctx.fillStyle = '#ff4a3d';
  ctx.beginPath();
  ctx.arc(x - 5, y - 6, eyeR, 0, Math.PI * 2);
  ctx.arc(x + 5, y - 6, eyeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  eyes(ctx, x, y - 6, 5, 0, 1.3, '#1a0505');
  ctx.fillStyle = '#f5f2e8';
  ctx.beginPath();
  ctx.moveTo(x - 3, y + 6);
  ctx.lineTo(x - 1, y + 10);
  ctx.lineTo(x + 1, y + 6);
  ctx.moveTo(x + 1, y + 6);
  ctx.lineTo(x + 3, y + 10);
  ctx.lineTo(x + 5, y + 6);
  ctx.fill();
  ctx.restore(); // v2.22: end the lean-back transform
}

// Raja Buto Ijo: the SAME ogre silhouette as a Buto, but recoloured so it
// can never be mistaken for one — v2.11 (reviewer #10, R3-ulang): the v2.10
// boss kept the Buto's green body and only changed the aura, so at a
// glance it still read as "a bigger Buto". Now: dark-red body, bigger
// horns, glowing amber eyes, gold shoulder pads. Draw-only; hitbox, HP,
// speed and damage are untouched (VISUAL_SCALE raja is 2.5x, as before).
function drawRaja(ctx, e, time, game) {
  const { x } = e;
  const breathe = 1 + Math.sin(time * 2 + e.wobble) * 0.03;
  const y = e.y + 2;
  const ph = e.atkPhase || 'none';
  const p = jurusP(e);
  // v2.22 (JURUS): the Raja smashes like a Buto (fists up -> slam
  // down, bigger), AND the enrage is a ROAR — when roaring (the 1 s
  // before the summon lands) he rears up, arms thrown high, head
  // back, mouth open: a silhouette no other ghost has. The roar
  // overrides the attack pose.
  const roaring = time < (e.roarUntil || 0);
  let fistX = 25, fistY = 10, sqX = 1, sqY = 1, roarTilt = 0;
  if (roaring) {
    fistX = 18; fistY = -32;
    sqY = 1.06; sqX = 0.96; roarTilt = -0.12;
  } else if (ph === 'windup') {
    // v2.23 (R4): the fists rise HIGHER (56 px, was 40) — the telegraph
    // is unmistakable even at thumbnail size.
    fistX = 25 - 5 * p; fistY = 10 - 56 * p;
    sqY = 1 + 0.08 * p; sqX = 1 - 0.03 * p;
  } else if (ph === 'strike') {
    fistX = 20 + 8 * p; fistY = -30 + 50 * p;
    sqY = 1.05 - 0.20 * p; sqX = 0.97 + 0.13 * p;
  } else if (ph === 'recovery') {
    fistX = 28 - 3 * p; fistY = 20 - 10 * p;
    sqY = 0.85 + 0.15 * p; sqX = 1.10 - 0.10 * p;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(roarTilt);
  ctx.scale(breathe * sqX, breathe * sqY);
  // Horns — bigger and darker than the Buto's (v2.20: tips reach -46
  // local, near-black — the old -38 dark-red horns read small).
  ctx.fillStyle = '#160608';
  ctx.beginPath();
  ctx.moveTo(-16, -18);
  ctx.lineTo(-24, -46);
  ctx.lineTo(-10, -22);
  ctx.closePath();
  ctx.moveTo(16, -18);
  ctx.lineTo(24, -46);
  ctx.lineTo(10, -22);
  ctx.closePath();
  ctx.fill();
  // Body: near-black blood-red bulk, not pink-red (v2.20, R4).
  ctx.fillStyle = '#4a0f1e';
  ctx.beginPath();
  ctx.ellipse(0, 2, 21, 23, 0, 0, Math.PI * 2);
  ctx.fill();
  // Belly, darker red.
  ctx.fillStyle = '#6e1a28';
  ctx.beginPath();
  ctx.ellipse(0, 10, 13, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  // Thick arms. v2.22: the fists are the jurus (raised / slammed /
  // hanging), and in the roar they are thrown high above the head.
  if (ph === 'strike') {
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#38090f';
    ctx.beginPath();
    ctx.arc(-20, -30, 8, 0, Math.PI * 2);
    ctx.arc(20, -30, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = '#38090f';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-19, -6);
  ctx.lineTo(-fistX, fistY);
  ctx.moveTo(19, -6);
  ctx.lineTo(fistX, fistY);
  ctx.stroke();
  ctx.fillStyle = '#38090f';
  ctx.beginPath();
  ctx.arc(-fistX, fistY + 2, 7, 0, Math.PI * 2);
  ctx.arc(fistX, fistY + 2, 7, 0, Math.PI * 2);
  ctx.fill();
  // Gold shoulder pads — royal trim no Buto has.
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath();
  ctx.arc(-18, -8, 5, 0, Math.PI * 2);
  ctx.arc(18, -8, 5, 0, Math.PI * 2);
  ctx.fill();
  // Angry eyes under a heavy brow — GLOWING BLOOD-RED, not amber (v2.20).
  ctx.strokeStyle = '#20040a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-11, -14);
  ctx.lineTo(-3, -11);
  ctx.moveTo(11, -14);
  ctx.lineTo(3, -11);
  ctx.stroke();
  ctx.save();
  ctx.shadowColor = '#ff1a0a';
  ctx.shadowBlur = 10;
  eyes(ctx, 0, -8, 6, 0, 2.6, '#ff2a1a');
  ctx.restore();
  eyes(ctx, 0, -8, 6, 0, 1.1, '#0a0202');
  // Fangs pointing up from the mouth. v2.22 (roar): the mouth hangs
  // OPEN (a dark maw behind the fangs) — the roar's silhouette.
  if (roaring) {
    ctx.fillStyle = '#160208';
    ctx.beginPath();
    ctx.ellipse(0, 7, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#f5f2e8';
  ctx.beginPath();
  ctx.moveTo(-6, 2);
  ctx.lineTo(-4, -3);
  ctx.lineTo(-2, 2);
  ctx.moveTo(2, 2);
  ctx.lineTo(4, -3);
  ctx.lineTo(6, 2);
  ctx.closePath();
  ctx.fill();
  // v2.14 (reviewer #13, P0-1): rim-light — a bright gold arc along the
  // top edge of the body (local coords, radius 38) so the silhouette
  // reads against the dark backdrop disc, even at thumbnail size.
  // v2.21 (reviewer #19, R1): the OLD arc (radius 38, 1.15π-1.85π) was
  // itself the "golden ring across the crown" — at 133 px absolute it
  // arced right through the crown (y 109-136) and the face's upper
  // edge. Now a SHORT tight cap (radius 28, 1.38π-1.62π): it hugs the
  // top of the head, 28 px below the crown and clear of the horns'
  // inner edges, so the crown reads clean and the gold reads as rim
  // light, not a ring.
  // v2.23 (reviewer #20, R1): OFF in the boss frame — the crown must
  // be gold-free, and the backdrop disc already gives the silhouette.
  if (!game || game.shot !== 'boss') {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,215,106,0.85)';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#ffd76a';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(0, 0, 28, Math.PI * 1.38, Math.PI * 1.62);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

// Buto Ijo: giant green ogre — wide body, horns, fangs, angry eyes.
function drawButo(ctx, e, time) {
  const { x } = e;
  const breathe = 1 + Math.sin(time * 2 + e.wobble) * 0.03;
  const y = e.y + 2;
  const ph = e.atkPhase || 'none';
  const p = jurusP(e);
  // v2.22 (JURUS "Hantaman Raksasa"): windup PANJANG — both fists
  // rise high above the head (the telegraph, slow); strike — the fists
  // SLAM down to the ground (near-instant, with a smear) and the body
  // SQUASHES on impact (the hit-stop + shake + debris land in the
  // strike itself); recovery — the fists lower slowly back to the
  // sides. The fist positions are the silhouette: raised / down /
  // hanging are three different shapes.
  let fistX = 25, fistY = 12, sqX = 1, sqY = 1;
  if (ph === 'windup') {
    // v2.23 (R4): the fists rise HIGHER (56 px, was 42) — the telegraph
    // is unmistakable even at thumbnail size.
    fistX = 25 - 5 * p; fistY = 12 - 56 * p;
    sqY = 1 + 0.08 * p; sqX = 1 - 0.03 * p;
  } else if (ph === 'strike') {
    fistX = 20 + 8 * p; fistY = -30 + 50 * p;
    sqY = 1.05 - 0.20 * p; sqX = 0.97 + 0.13 * p;
  } else if (ph === 'recovery') {
    fistX = 28 - 3 * p; fistY = 20 - 8 * p;
    sqY = 0.85 + 0.15 * p; sqX = 1.10 - 0.10 * p;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(breathe * sqX, breathe * sqY);
  // Horns (v2.19: bigger — tips reach -38, like the Raja's).
  ctx.fillStyle = '#3a2a1a';
  ctx.beginPath();
  ctx.moveTo(-14, -18);
  ctx.lineTo(-24, -38);
  ctx.lineTo(-11, -24);
  ctx.closePath();
  ctx.moveTo(14, -18);
  ctx.lineTo(24, -38);
  ctx.lineTo(11, -24);
  ctx.closePath();
  ctx.fill();
  // Body: wide green bulk.
  ctx.fillStyle = '#69b34c';
  ctx.beginPath();
  ctx.ellipse(0, 2, 21, 23, 0, 0, Math.PI * 2);
  ctx.fill();
  // Belly, lighter.
  ctx.fillStyle = '#8ed07a';
  ctx.beginPath();
  ctx.ellipse(0, 10, 13, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  // Thick arms, ending in heavy fists (v2.19). v2.22: the fists ARE
  // the jurus — raised high in the windup, slammed to the ground in
  // the strike (with a smear: the fists ghosted at the raised
  // position), easing back down in the recovery.
  if (ph === 'strike') {
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#5da244';
    ctx.beginPath();
    ctx.arc(-20, -30, 7, 0, Math.PI * 2);
    ctx.arc(20, -30, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = '#5da244';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-19, -6);
  ctx.lineTo(-fistX, fistY);
  ctx.moveTo(19, -6);
  ctx.lineTo(fistX, fistY);
  ctx.stroke();
  ctx.fillStyle = '#5da244';
  ctx.beginPath();
  ctx.arc(-fistX, fistY + 2, 7, 0, Math.PI * 2);
  ctx.arc(fistX, fistY + 2, 7, 0, Math.PI * 2);
  ctx.fill();
  // Angry eyes under a heavy brow (v2.19: glowing amber, not plain white).
  ctx.strokeStyle = '#2e4d1e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-11, -14);
  ctx.lineTo(-3, -11);
  ctx.moveTo(11, -14);
  ctx.lineTo(3, -11);
  ctx.stroke();
  ctx.save();
  ctx.shadowColor = '#ff5a3d';
  ctx.shadowBlur = 8;
  eyes(ctx, 0, -8, 6, 0, 2.2, '#ffb03d');
  ctx.restore();
  eyes(ctx, 0, -8, 6, 0, 1.1, '#0b1020');
  // Fangs pointing up from the mouth.
  ctx.fillStyle = '#f5f2e8';
  ctx.beginPath();
  ctx.moveTo(-6, 2);
  ctx.lineTo(-4, -3);
  ctx.lineTo(-2, 2);
  ctx.moveTo(2, 2);
  ctx.lineTo(4, -3);
  ctx.lineTo(6, 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
