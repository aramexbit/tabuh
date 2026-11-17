// Spirits: hantu Indonesia — Kuntilanak, Tuyul, Pocong, Genderuwo, Buto Ijo.
// Each has a type definition (config.js), a distance along the path, and
// temporary slow / stun timers. Every figure is drawn in code — no image
// assets — with its own silhouette, motion (float / hop / shamble), and HP bar.
import { ENEMIES, enemyHp, enemySpeed } from './config.js';
import { pointAt, PATH_LENGTH } from './world.js';

let nextId = 1;

export function createEnemy(type, wave, rng) {
  const def = ENEMIES[type];
  return {
    id: nextId++,
    type,
    def,
    dist: 0,
    x: 0,
    y: 0,
    angle: 0,
    hp: enemyHp(type, wave),
    maxHp: enemyHp(type, wave),
    speed: enemySpeed(type, wave) * rng.range(0.92, 1.08),
    baseSpeed: 0, // set below; enrage phases multiply it
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
  };
  e.baseSpeed = e.speed;
  return e;
}

export function updateEnemy(game, e, dt) {
  e.flash = Math.max(0, e.flash - dt * 4);
  if (game.time < e.stunUntil) return; // stunned: no movement
  let speed = e.speed;
  if (game.time < e.slowUntil) speed *= e.slowFactor;
  // Malam Berkabut: ghosts move 15% faster.
  if (game.twist === 'kabut') speed *= 1.15;
  e.dist += speed * dt;
  const p = pointAt(e.dist);
  const wob = Math.sin(game.time * 3 + e.wobble) * e.wobbleAmp;
  const nx = -Math.sin(p.angle);
  const ny = Math.cos(p.angle);
  e.x = p.x + nx * wob;
  e.y = p.y + ny * wob - e.radius * 0.4;
  e.angle = p.angle;
  if (e.dist >= PATH_LENGTH) {
    e.reachedGate = true;
  }
  // Ghosts fight back: each type attacks towers it passes, on its own timer.
  e.attackCd -= dt;
  if (e.attackCd <= 0) e.attackCd = ghostAttack(game, e);
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

export function drawEnemy(ctx, e, time) {
  const c = e.def.color;
  const pulse = 0.75 + Math.sin(time * 4 + e.wobble) * 0.25;
  // Faint aura so the figure reads against the dark field.
  const g = ctx.createRadialGradient(e.x, e.y, 1, e.x, e.y, e.radius * 2.2);
  g.addColorStop(0, c);
  g.addColorStop(0.4, c + '88');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.4 * pulse;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(e.x, e.y, e.radius * 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // The figure itself. The Raja is a Buto drawn 1.5x with a gold crown.
  if (e.type === 'wisik') drawKuntilanak(ctx, e, time);
  else if (e.type === 'kunang') drawTuyul(ctx, e, time);
  else if (e.type === 'bayang') drawPocong(ctx, e, time);
  else if (e.type === 'slira') drawGenderuwo(ctx, e, time);
  else if (e.type === 'raja') {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.scale(1.5, 1.5);
    ctx.translate(-e.x, -e.y);
    drawButo(ctx, e, time);
    ctx.restore();
    // Gold crown.
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    ctx.moveTo(e.x - 16, e.y - 40);
    ctx.lineTo(e.x - 16, e.y - 52);
    ctx.lineTo(e.x - 8, e.y - 44);
    ctx.lineTo(e.x, e.y - 54);
    ctx.lineTo(e.x + 8, e.y - 44);
    ctx.lineTo(e.x + 16, e.y - 52);
    ctx.lineTo(e.x + 16, e.y - 40);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff4a3d';
    ctx.beginPath();
    ctx.arc(e.x, e.y - 45, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else drawButo(ctx, e, time);
  if (e.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${0.7 * e.flash})`;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius * 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  // HP bar: always visible for the big brutes and the boss, otherwise only
  // once damaged — the player must see how much boss is left at a glance.
  // Thick (6 px) with a dark border so it reads over any background.
  if (e.hp < e.maxHp || e.type === 'raksasa' || e.type === 'raja') {
    const w = e.radius * 2 + 8;
    const pct = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 14, w, 6);
    ctx.fillStyle = pct > 0.5 ? '#7fe3a8' : pct > 0.25 ? '#ffd76a' : '#ff7a6a';
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 14, w * pct, 6);
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.lineWidth = 1;
    ctx.strokeRect(e.x - w / 2, e.y - e.radius - 14, w, 6);
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
  // Head: bald, greenish.
  ctx.fillStyle = '#c9e7a8';
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
