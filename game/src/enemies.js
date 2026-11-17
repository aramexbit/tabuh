// Spirits: glowing wisps that walk the stone path toward the village gate.
// Each has a type definition (config.js), a distance along the path, and
// temporary slow / stun timers. Drawing is a luminous orb with a wispy tail,
// eyes, and an HP bar — no image assets.
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
    radius: def.radius,
    reward: def.reward,
    gateDmg: def.gateDmg,
    slowUntil: 0,
    slowFactor: 1,
    stunUntil: 0,
    wobble: rng.range(0, Math.PI * 2),
    wobbleAmp: rng.range(3, 7),
    flash: 0,
  };
}

export function updateEnemy(game, e, dt) {
  e.flash = Math.max(0, e.flash - dt * 4);
  if (game.time < e.stunUntil) return; // stunned: no movement
  let speed = e.speed;
  if (game.time < e.slowUntil) speed *= e.slowFactor;
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
}

export function drawEnemy(ctx, e, time) {
  const c = e.def.color;
  const pulse = 0.75 + Math.sin(time * 4 + e.wobble) * 0.25;
  // Wispy tail.
  ctx.save();
  ctx.globalAlpha = 0.35 * pulse;
  ctx.strokeStyle = c;
  ctx.lineWidth = e.radius * 0.9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const back = 26;
  ctx.moveTo(e.x - Math.cos(e.angle) * back, e.y - Math.sin(e.angle) * back);
  ctx.quadraticCurveTo(
    e.x - Math.cos(e.angle) * back * 0.5 + Math.sin(time * 2 + e.wobble) * 8,
    e.y - Math.sin(e.angle) * back * 0.5 + Math.cos(time * 2 + e.wobble) * 8,
    e.x, e.y,
  );
  ctx.stroke();
  ctx.restore();
  // Glow.
  const g = ctx.createRadialGradient(e.x, e.y, 1, e.x, e.y, e.radius * 2.2);
  g.addColorStop(0, c);
  g.addColorStop(0.4, c + 'aa');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.55 * pulse;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(e.x, e.y, e.radius * 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // Body orb.
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.arc(e.x, e.y, e.radius * 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(e.x - e.radius * 0.25, e.y - e.radius * 0.3, e.radius * 0.3, 0, Math.PI * 2);
  ctx.fill();
  if (e.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${0.7 * e.flash})`;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  // Eyes.
  const ex = Math.cos(e.angle) * e.radius * 0.3;
  const ey = Math.sin(e.angle) * e.radius * 0.3;
  ctx.fillStyle = '#0b1020';
  ctx.beginPath();
  ctx.arc(e.x + ex - 4, e.y + ey - 2, 2.2, 0, Math.PI * 2);
  ctx.arc(e.x + ex + 4, e.y + ey - 2, 2.2, 0, Math.PI * 2);
  ctx.fill();
  // HP bar.
  if (e.hp < e.maxHp) {
    const w = e.radius * 2;
    const pct = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 10, w, 4);
    ctx.fillStyle = pct > 0.5 ? '#7fe3a8' : pct > 0.25 ? '#ffd76a' : '#ff7a6a';
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 10, w * pct, 4);
  }
}
