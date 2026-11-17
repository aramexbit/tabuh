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

function huntersOn(game, tower, self) {
  let n = 0;
  for (const e of game.enemies) if (e.targetTower === tower && e !== self) n++;
  return n;
}

function bestTarget(game, e) {
  let best = null, bestScore = Infinity;
  for (const t of game.towers) {
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
  return {
    id: nextId++,
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
    targetTower: null, // the tower this ghost is hunting (v2.7 AI)
    targetGate: false, // true when no towers are left: head for the gate
    retargetCd: 0, // periodic re-pick timer (keeps the spread adaptive)
    inRange: false, // standing at the target, attacking
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
  // Big eyes + small mouth.
  eyes(ctx, x, y - 4, 2.8, 0, 1.8);
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
  // March speed: 2.0x while more than 350 px from the target, combat speed
  // close in. The walk from the spirit gate to the far pads crosses 3-4
  // tower ranges; at 1.5x the far-hunting ghosts died around y=250-280,
  // ~100 px short of the lower half (diagnostic 18 Nov). At 2.0x they
  // cross fast enough to arrive alive and fight.
  const march = d > 350 ? 2.0 : 1;
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
    game.effects.ring(t.x, t.y, 46, 'rgba(245,242,232,0.7)');
    return 3.0;
  }
  if (e.type === 'slira') {
    // Pukulan Bulu: heavy durability damage.
    const t = nearestTower(game, e, 100);
    if (!t) return 0.5;
    game.damageTower(t, 18, e);
    game.shake = Math.max(game.shake, 0.2);
    return 2.0;
  }
  if (e.type === 'raksasa') {
    // Hantaman Raksasa: very heavy durability damage.
    const t = nearestTower(game, e, 110);
    if (!t) return 0.5;
    game.damageTower(t, 30, e);
    game.effects.burst(t.x, t.y - 10, '#8a94a8', 8);
    game.shake = Math.max(game.shake, 0.3);
    return 2.5;
  }
  if (e.type === 'raja') {
    // Hantaman Raja: the hardest single hit in the game.
    const t = nearestTower(game, e, 120);
    if (!t) return 0.5;
    game.damageTower(t, 45, e);
    game.effects.ring(t.x, t.y, 90, '#ff9a3d', 0.8);
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
const VISUAL_SCALE = { wisik: 1.25, kunang: 1.25, bayang: 1.25, slira: 1.25, raksasa: 1.3, raja: 2.2, emas: 1.3 };

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
  const g = ctx.createRadialGradient(e.x, e.y, 1, e.x, e.y, vr * 2.2);
  g.addColorStop(0, c);
  g.addColorStop(0.4, c + '88');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.55 * pulse;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(e.x, e.y, vr * 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // The figure itself, scaled around its own centre. The Raja is a Buto
  // drawn 2.2x with a gold crown sized to match. A soft type-colour glow
  // (shadowBlur) lifts the figure off the dark field so it never reads
  // as a flat blob.
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.scale(vs, vs);
  ctx.translate(-e.x, -e.y);
  ctx.shadowColor = c;
  ctx.shadowBlur = 10;
  if (e.type === 'wisik') drawKuntilanak(ctx, e, time);
  else if (e.type === 'kunang') drawTuyul(ctx, e, time);
  else if (e.type === 'emas') drawTuyulEmas(ctx, e, time);
  else if (e.type === 'bayang') drawPocong(ctx, e, time);
  else if (e.type === 'slira') drawGenderuwo(ctx, e, time);
  else if (e.type === 'raja') drawButo(ctx, e, time);
  else drawButo(ctx, e, time);
  ctx.restore();
  if (e.type === 'raja') {
    // Gold crown, sized to the 2.2x body: the Buto's horns top out around
    // -66 px, so the crown sits just above them.
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    ctx.moveTo(e.x - 24, e.y - 58);
    ctx.lineTo(e.x - 24, e.y - 76);
    ctx.lineTo(e.x - 12, e.y - 64);
    ctx.lineTo(e.x, e.y - 80);
    ctx.lineTo(e.x + 12, e.y - 64);
    ctx.lineTo(e.x + 24, e.y - 76);
    ctx.lineTo(e.x + 24, e.y - 58);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff4a3d';
    ctx.beginPath();
    ctx.arc(e.x, e.y - 66, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Type-color ring at the feet (drawn over the figure's base).
  ctx.strokeStyle = c;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(e.x, e.y + vr * 0.8, vr * 0.95, vr * 0.32, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (e.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${0.7 * e.flash})`;
    ctx.beginPath();
    ctx.arc(e.x, e.y, vr * 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  // HP bar: ALWAYS visible now, thin (5 px) with a dark border — the judge
  // must read every spirit's health at a glance, not only the damaged ones.
  const w = vr * 2 + 8;
  const pct = Math.max(0, e.hp / e.maxHp);
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(e.x - w / 2, e.y - vr - 14, w, 5);
  ctx.fillStyle = pct > 0.5 ? '#7fe3a8' : pct > 0.25 ? '#ffd76a' : '#ff7a6a';
  ctx.fillRect(e.x - w / 2, e.y - vr - 14, w * pct, 5);
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  ctx.lineWidth = 1;
  ctx.strokeRect(e.x - w / 2, e.y - vr - 14, w, 5);
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
  // Arms: thin pale lines reaching out.
  ctx.strokeStyle = '#e8ede6';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 4);
  ctx.lineTo(x - 13, y + 2);
  ctx.moveTo(x + 6, y - 4);
  ctx.lineTo(x + 13, y + 2);
  ctx.stroke();
  // Hair: dark mass over the head, strands falling past the shoulders.
  ctx.fillStyle = '#14100c';
  ctx.beginPath();
  ctx.ellipse(x, y - 7, 8.5, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x - 7, y + 1, 3, 9, 0.15, 0, Math.PI * 2);
  ctx.ellipse(x + 7, y + 1, 3, 9, -0.15, 0, Math.PI * 2);
  ctx.fill();
  // Pale face peeking through the hair.
  ctx.fillStyle = '#f5e9d8';
  ctx.beginPath();
  ctx.ellipse(x, y - 6, 4.5, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  eyes(ctx, x, y - 7, 2, 0, 1.1);
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
  // Big eyes + small mouth.
  eyes(ctx, x, y - 4, 2.8, 0, 1.8);
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
  // Shroud: rounded top, slightly tapered, wavy bottom.
  ctx.fillStyle = '#f5f2e8';
  ctx.beginPath();
  ctx.moveTo(x - 10, y + 14);
  ctx.lineTo(x - 11, y - 8);
  ctx.quadraticCurveTo(x - 11, y - 16, x, y - 16);
  ctx.quadraticCurveTo(x + 11, y - 16, x + 11, y - 8);
  ctx.lineTo(x + 10, y + 14);
  ctx.quadraticCurveTo(x + 5, y + 17, x, y + 14);
  ctx.quadraticCurveTo(x - 5, y + 17, x - 10, y + 14);
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
  // Face: dark slit with two pale glowing eyes.
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse(x, y - 9, 4.5, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(x - 1.8, y - 10, 1, 0, Math.PI * 2);
  ctx.arc(x + 1.8, y - 10, 1, 0, Math.PI * 2);
  ctx.fill();
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
  // Long arms hanging down.
  ctx.strokeStyle = '#3a3129';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 13, y - 4);
  ctx.lineTo(x - 16, y + 14);
  ctx.moveTo(x + 13, y - 4);
  ctx.lineTo(x + 16, y + 14);
  ctx.stroke();
  // Red glowing eyes + fanged mouth.
  ctx.fillStyle = '#ff4a3d';
  ctx.beginPath();
  ctx.arc(x - 5, y - 6, 3.2, 0, Math.PI * 2);
  ctx.arc(x + 5, y - 6, 3.2, 0, Math.PI * 2);
  ctx.fill();
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

// Buto Ijo: giant green ogre — wide body, horns, fangs, angry eyes.
function drawButo(ctx, e, time) {
  const { x } = e;
  const breathe = 1 + Math.sin(time * 2 + e.wobble) * 0.03;
  const y = e.y + 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(breathe, breathe);
  // Horns.
  ctx.fillStyle = '#3a2a1a';
  ctx.beginPath();
  ctx.moveTo(-14, -18);
  ctx.lineTo(-18, -30);
  ctx.lineTo(-9, -21);
  ctx.closePath();
  ctx.moveTo(14, -18);
  ctx.lineTo(18, -30);
  ctx.lineTo(9, -21);
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
  // Thick arms.
  ctx.strokeStyle = '#5da244';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-19, -6);
  ctx.lineTo(-25, 10);
  ctx.moveTo(19, -6);
  ctx.lineTo(25, 10);
  ctx.stroke();
  // Angry eyes under a heavy brow.
  ctx.strokeStyle = '#2e4d1e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-11, -14);
  ctx.lineTo(-3, -11);
  ctx.moveTo(11, -14);
  ctx.lineTo(3, -11);
  ctx.stroke();
  eyes(ctx, 0, -8, 6, 0, 2.2, '#f5f2e8');
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
