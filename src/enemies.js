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
    attackAnim: 0, // v2.19: seconds left of the attack lunge/pose (visual)
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
  // v2.19 — the attack pose decays (visual only).
  e.attackAnim = Math.max(0, (e.attackAnim || 0) - dt);
  e.flash = Math.max(0, e.flash - dt * 4);
  if (game.time < e.stunUntil) return; // stunned: no movement
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
    // In range: stand and fight. First arrival gets a wind-up so the tower
    // lands a few free hits ("ghosts size up the towers before striking").
    if (!e.inRange) { e.inRange = true; e.attackCd = 2.0; }
    e.attackCd -= dt;
    if (e.attackCd <= 0) e.attackCd = ghostAttack(game, e);
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
  e.x += (dx / d) * step;
  e.y += (dy / d) * step;
  e.angle = Math.atan2(dy, dx);
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

// One attack. Returns the cooldown (seconds) until the next attempt.
function ghostAttack(game, e) {
  if (e.type === 'wisik') {
    // Tawa Melengking: nearby towers stop firing for 1 beat + small damage.
    const near = towersNear(game, e, 80);
    if (near.length === 0) return 0.5;
    for (const t of near) {
      t.stunUntil = game.time + 1 * game.beatDur;
      game.damageTower(t, 4, e);
    }
    // v2.19 — Kuntilanak scratching: pale claw streaks across the tower.
    const t0 = near[0];
    const angW = Math.atan2(t0.y - e.y, t0.x - e.x);
    game.effects.claw(t0.x, t0.y, angW, '#d8ecff');
    e.attackAnim = 0.45;
    game.effects.ring(e.x, e.y, 70, 'rgba(180,220,255,0.8)');
    return 3.0;
  }
  if (e.type === 'kunang') {
    // Mencuri Koin: each Tuyul steals a few coins from a tower it passes.
    const t = nearestTower(game, e, 80);
    if (!t || e.stolenFrom.includes(t.padIndex)) return 0.5;
    e.stolenFrom.push(t.padIndex);
    const steal = Math.min(3, game.coins);
    game.coins -= steal;
    game.effects.text(t.x, t.y - 34, `-${steal} ◆`, '#ff9a3d', 15);
    // v2.19 — Tuyul snatching: gold coins burst out of the robbed tower.
    game.effects.coinBurst(t.x, t.y);
    e.attackAnim = 0.45;
    // Robbed this tower: move on to the next one (or the gate, if every
    // tower has been robbed) instead of parking here forever.
    e.targetTower = null;
    return 2.0;
  }
  if (e.type === 'bayang') {
    // Kafan Membungkus: the tower's firing slows to 25% for 4 beats.
    const t = nearestTower(game, e, 90);
    if (!t) return 0.5;
    t.slowUntil = game.time + 4 * game.beatDur;
    t.slowFactor = 0.25;
    game.damageTower(t, 4, e);
    // v2.19 — Pocong leaping slam: impact burst on the tower.
    game.effects.burst(t.x, t.y - 10, '#ffe9a8', 10);
    e.attackAnim = 0.45;
    game.effects.ring(t.x, t.y, 46, 'rgba(245,242,232,0.7)');
    return 3.0;
  }
  if (e.type === 'slira') {
    // Pukulan Bulu: heavy durability damage.
    const t = nearestTower(game, e, 100);
    if (!t) return 0.5;
    game.damageTower(t, 18, e);
    // v2.19 — Genderuwo big claws: blood-red slash streaks.
    const angS = Math.atan2(t.y - e.y, t.x - e.x);
    game.effects.claw(t.x, t.y, angS, '#ff4a3d');
    e.attackAnim = 0.45;
    game.shake = Math.max(game.shake, 0.2);
    return 2.0;
  }
  if (e.type === 'raksasa') {
    // Hantaman Raksasa: very heavy durability damage.
    const t = nearestTower(game, e, 110);
    if (!t) return 0.5;
    game.damageTower(t, 30, e);
    game.effects.burst(t.x, t.y - 10, '#8a94a8', 8);
    // v2.19 — Buto Ijo two-fist slam: shockwave ring + orange debris.
    game.effects.ring(t.x, t.y, 95, '#ff9a3d', 0.7, 5);
    game.effects.burst(t.x, t.y - 10, '#ff7a3d', 12);
    e.attackAnim = 0.45;
    game.shake = Math.max(game.shake, 0.3);
    return 2.5;
  }
  if (e.type === 'raja') {
    // Hantaman Raja: the hardest single hit in the game.
    const t = nearestTower(game, e, 120);
    if (!t) return 0.5;
    game.damageTower(t, 45, e);
    game.effects.ring(t.x, t.y, 90, '#ff9a3d', 0.8);
    // v2.19 — Raja slam: gold burst with the shockwave.
    game.effects.burst(t.x, t.y - 10, '#ffd76a', 12);
    e.attackAnim = 0.45;
    game.shake = Math.max(game.shake, 0.4);
    return 2.0;
  }
  return 2.0;
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

export function drawEnemy(ctx, e, time) {
  const c = e.def.color;
  const pulse = 0.75 + Math.sin(time * 4 + e.wobble) * 0.25;
  const vs = VISUAL_SCALE[e.type] || 1;
  const vr = visualRadius(e); // visual radius — the figure's real on-screen size
  // Ground shadow + type-color base ring at the feet: every spirit now has
  // a dark anchor and its own colour on the ground, so types read apart.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(e.x, e.y + vr * 0.8, vr * 0.9, vr * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
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
  const auraColors = e.type === 'raja'
    ? ['#ffd76a', '#ff9a3d', '#ff4a3d']
    : [c, c + '88', 'rgba(0,0,0,0)'];
  const auraR = e.type === 'raja' ? vr * 1.1 : vr * 1.8;
  const auraA = e.type === 'raja' ? 0.3 : 0.55;
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
  // v2.19 — attack pose: while striking (attackAnim > 0) the figure
  // lunges toward its target and swells, so the attack reads as a motion,
  // not just a particle on the tower.
  let lx = 0, ly = 0, lungeScale = 1;
  if (e.attackAnim > 0) {
    const tgt = e.targetTower || GATE_POS;
    const ddx = tgt.x - e.x, ddy = tgt.y - e.y;
    const dd = Math.hypot(ddx, ddy) || 1;
    const m = e.attackAnim * 18;
    lx = (ddx / dd) * m; ly = (ddy / dd) * m;
    lungeScale = 1 + e.attackAnim * 0.15;
  }
  ctx.save();
  ctx.translate(e.x + lx, e.y + ly);
  ctx.scale(vs * lungeScale, vs * lungeScale);
  ctx.translate(-e.x, -e.y);
  ctx.shadowColor = c;
  ctx.shadowBlur = 10;
  if (e.type === 'wisik') drawKuntilanak(ctx, e, time);
  else if (e.type === 'kunang') drawTuyul(ctx, e, time);
  else if (e.type === 'emas') drawTuyulEmas(ctx, e, time);
  else if (e.type === 'bayang') drawPocong(ctx, e, time);
  else if (e.type === 'slira') drawGenderuwo(ctx, e, time);
  else if (e.type === 'raja') drawRaja(ctx, e, time);
  else drawButo(ctx, e, time);
  ctx.restore();
  if (e.type === 'raja') {
    // Gold crown, sized to the 3.5x body. v2.12 (R3): the horns reach
    // -38 local -> -133 absolute, so the crown sits higher (base -126,
    // top -153) — above the horn tips, not inside them. The crown top
    // (y ~103 at the boss's parking spot) still clears the boss bar
    // (ends y=100) by 3 px. (v2.19: rescaled from 3.2x by 3.5/3.2.)
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
  if (e.hp < e.maxHp || e.type === 'raja') {
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

// Kuntilanak: white dress, long black hair framing a pale face, floats.
function drawKuntilanak(ctx, e, time) {
  const { x } = e;
  const y = e.y + Math.sin(time * 2 + e.wobble) * 2;
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
  ctx.strokeStyle = '#e8ede6';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 4);
  ctx.lineTo(x - 13, y + 2);
  ctx.moveTo(x + 6, y - 4);
  ctx.lineTo(x + 13, y + 2);
  ctx.stroke();
  // Claw tips fanning out from each hand.
  ctx.strokeStyle = '#f5f2e8';
  ctx.lineWidth = 1.5;
  for (const s of [-1, 1]) {
    const hx = x + s * 13, hy = y + 2;
    for (const a of [-0.5, 0, 0.5]) {
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + s * 5 + Math.sin(a) * 3, hy + Math.cos(a) * 4 - 2);
      ctx.stroke();
    }
  }
  // Hair: dark mass over the head, strands falling past the shoulders.
  ctx.fillStyle = '#14100c';
  ctx.beginPath();
  ctx.ellipse(x, y - 7, 8.5, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x - 7, y + 1, 3, 9, 0.15, 0, Math.PI * 2);
  ctx.ellipse(x + 7, y + 1, 3, 9, -0.15, 0, Math.PI * 2);
  ctx.fill();
  // v2.19 — whipping hair: two long strands lashing outward, swinging
  // with time so the hair reads as alive (the folklore power, not a wig).
  const whip = Math.sin(time * 3 + e.wobble) * 0.25;
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(x + s * 8, y - 4);
    ctx.rotate(s * (0.55 + whip));
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
  const y = e.y + Math.sin(time * 6 + e.wobble) * 1.5;
  // Body: tiny dark sarong.
  ctx.fillStyle = '#5d6b3a';
  ctx.beginPath();
  ctx.ellipse(x, y + 6, 5.5, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head: bald, greenish — saturated now, so a Tuyul never reads as a
  // pale Pocong at a glance.
  ctx.fillStyle = '#a5d96a';
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
}

// Pocong: white shroud with ties, dark face slit, hops.
function drawPocong(ctx, e, time) {
  const { x } = e;
  const hop = -Math.abs(Math.sin(time * 5 + e.wobble)) * 7;
  const y = e.y + hop;
  // Shroud: rounded top, slightly tapered, TORN jagged bottom (v2.19 —
  // the shroud is ripped, not a clean sheet).
  ctx.fillStyle = '#f5f2e8';
  ctx.beginPath();
  ctx.moveTo(x - 10, y + 14);
  ctx.lineTo(x - 11, y - 8);
  ctx.quadraticCurveTo(x - 11, y - 16, x, y - 16);
  ctx.quadraticCurveTo(x + 11, y - 16, x + 11, y - 8);
  ctx.lineTo(x + 10, y + 14);
  ctx.lineTo(x + 6, y + 18);
  ctx.lineTo(x + 2, y + 13);
  ctx.lineTo(x - 2, y + 18);
  ctx.lineTo(x - 6, y + 13);
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
}

// Genderuwo: bulky dark hairy body, shaggy outline, red eyes.
function drawGenderuwo(ctx, e, time) {
  const { x, y } = e;
  // Shaggy fur: spiky dark outline behind the body.
  ctx.fillStyle = '#2e2620';
  ctx.beginPath();
  const spikes = 10;
  for (let i = 0; i <= spikes; i++) {
    const a = (i / spikes) * Math.PI * 2 - Math.PI / 2;
    const rOut = 19 + (i % 2 === 0 ? 4 : 0);
    const px = x + Math.cos(a) * rOut;
    const py = y + 1 + Math.sin(a) * rOut * 0.95;
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
  // Long arms hanging down, ending in claws (v2.19).
  ctx.strokeStyle = '#3a3129';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 13, y - 4);
  ctx.lineTo(x - 16, y + 14);
  ctx.moveTo(x + 13, y - 4);
  ctx.lineTo(x + 16, y + 14);
  ctx.stroke();
  // Claw tips at each hand.
  ctx.strokeStyle = '#f5f2e8';
  ctx.lineWidth = 1.5;
  for (const s of [-1, 1]) {
    const hx = x + s * 16, hy = y + 14;
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
  ctx.save();
  ctx.shadowColor = '#ff2a1a';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#ff4a3d';
  ctx.beginPath();
  ctx.arc(x - 5, y - 6, 4, 0, Math.PI * 2);
  ctx.arc(x + 5, y - 6, 4, 0, Math.PI * 2);
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
}

// Raja Buto Ijo: the SAME ogre silhouette as a Buto, but recoloured so it
// can never be mistaken for one — v2.11 (reviewer #10, R3-ulang): the v2.10
// boss kept the Buto's green body and only changed the aura, so at a
// glance it still read as "a bigger Buto". Now: dark-red body, bigger
// horns, glowing amber eyes, gold shoulder pads. Draw-only; hitbox, HP,
// speed and damage are untouched (VISUAL_SCALE raja is 2.5x, as before).
function drawRaja(ctx, e, time) {
  const { x } = e;
  const breathe = 1 + Math.sin(time * 2 + e.wobble) * 0.03;
  const y = e.y + 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(breathe, breathe);
  // Horns — bigger and darker than the Buto's (tips reach -38 local).
  ctx.fillStyle = '#2a0e14';
  ctx.beginPath();
  ctx.moveTo(-16, -18);
  ctx.lineTo(-22, -38);
  ctx.lineTo(-10, -22);
  ctx.closePath();
  ctx.moveTo(16, -18);
  ctx.lineTo(22, -38);
  ctx.lineTo(10, -22);
  ctx.closePath();
  ctx.fill();
  // Body: dark-red bulk, not green.
  ctx.fillStyle = '#7a2436';
  ctx.beginPath();
  ctx.ellipse(0, 2, 21, 23, 0, 0, Math.PI * 2);
  ctx.fill();
  // Belly, lighter red.
  ctx.fillStyle = '#a03a4a';
  ctx.beginPath();
  ctx.ellipse(0, 10, 13, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  // Thick arms.
  ctx.strokeStyle = '#5e1a28';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-19, -6);
  ctx.lineTo(-25, 10);
  ctx.moveTo(19, -6);
  ctx.lineTo(25, 10);
  ctx.stroke();
  // Gold shoulder pads — royal trim no Buto has.
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath();
  ctx.arc(-18, -8, 5, 0, Math.PI * 2);
  ctx.arc(18, -8, 5, 0, Math.PI * 2);
  ctx.fill();
  // Angry eyes under a heavy brow — GLOWING amber, not white.
  ctx.strokeStyle = '#3a0a12';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-11, -14);
  ctx.lineTo(-3, -11);
  ctx.moveTo(11, -14);
  ctx.lineTo(3, -11);
  ctx.stroke();
  ctx.save();
  ctx.shadowColor = '#ff4a3d';
  ctx.shadowBlur = 8;
  eyes(ctx, 0, -8, 6, 0, 2.2, '#ffb03d');
  ctx.restore();
  eyes(ctx, 0, -8, 6, 0, 1.1, '#1a0505');
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
  // v2.14 (reviewer #13, P0-1): rim-light — a bright gold arc along the
  // top edge of the body (local coords, radius 38) so the silhouette
  // reads against the dark backdrop disc, even at thumbnail size.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,215,106,0.85)';
  ctx.lineWidth = 1.5;
  ctx.shadowColor = '#ffd76a';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(0, 0, 38, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

// Buto Ijo: giant green ogre — wide body, horns, fangs, angry eyes.
function drawButo(ctx, e, time) {
  const { x } = e;
  const breathe = 1 + Math.sin(time * 2 + e.wobble) * 0.03;
  const y = e.y + 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(breathe, breathe);
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
  // Thick arms, ending in heavy fists (v2.19).
  ctx.strokeStyle = '#5da244';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-19, -6);
  ctx.lineTo(-25, 10);
  ctx.moveTo(19, -6);
  ctx.lineTo(25, 10);
  ctx.stroke();
  ctx.fillStyle = '#5da244';
  ctx.beginPath();
  ctx.arc(-25, 12, 7, 0, Math.PI * 2);
  ctx.arc(25, 12, 7, 0, Math.PI * 2);
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
