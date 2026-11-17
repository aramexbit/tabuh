// Towers: bronze gamelan instruments built on stone pads. A tower strikes on the
// beat grid (cooldown counts beats, not seconds), so its rhythm is visible.
// Saron/Bonang/Kenong fire homing note projectiles; Kendang pulses a slow;
// Gong lands an instant area shockwave + stun.
import { TOWERS, UPGRADES, SELL_RATE } from './config.js';
import { PADS } from './world.js';

export function towerStats(tower) {
  const base = TOWERS[tower.type];
  const up = UPGRADES[tower.level] || { dmgMul: 1, rangeMul: 1 };
  return {
    dmg: Math.round(base.dmg * up.dmgMul),
    range: Math.round(base.range * up.rangeMul),
    beatsPerShot: base.beatsPerShot,
    aoe: base.aoe || 0,
    slow: base.slow || 0,
    slowBeats: base.slowBeats || 0,
    stunBeats: base.stunBeats || 0,
  };
}

export function upgradeCost(tower) {
  if (tower.level >= 3) return null;
  return Math.round(TOWERS[tower.type].cost * UPGRADES[tower.level + 1].costMul);
}

export function sellValue(tower) {
  let spent = TOWERS[tower.type].cost;
  for (let l = 2; l <= tower.level; l++) {
    spent += Math.round(TOWERS[tower.type].cost * UPGRADES[l].costMul);
  }
  return Math.round(spent * SELL_RATE);
}

export function createTower(type, padIndex) {
  const pad = PADS[padIndex];
  return {
    type, padIndex, level: 1,
    x: pad.x, y: pad.y,
    cooldown: 0, // beats until the next strike
    flash: 0, // animation timer after firing
    angle: -Math.PI / 2,
  };
}

function firstTargetInRange(game, tower, range) {
  let best = null;
  let bestDist = -1;
  for (const e of game.enemies) {
    if (e.hp <= 0) continue;
    const d = Math.hypot(e.x - tower.x, e.y - tower.y);
    if (d <= range && e.dist > bestDist) {
      best = e;
      bestDist = e.dist;
    }
  }
  return best;
}

function fireProjectile(game, tower, target, stats) {
  game.projectiles.push({
    x: tower.x, y: tower.y - 14,
    target, dmg: stats.dmg, aoe: stats.aoe,
    slow: stats.slow, slowBeats: stats.slowBeats,
    stunBeats: stats.stunBeats,
    speed: 620, color: TOWERS[tower.type].color,
    kind: tower.type, trail: [],
  });
  game.audio.strike(tower.type);
}

function applyHit(game, x, y, dmg, aoe, slow, slowBeats, stunBeats, mult) {
  const hitAll = [];
  if (aoe > 0) {
    for (const e of game.enemies) {
      if (e.hp > 0 && Math.hypot(e.x - x, e.y - y) <= aoe + e.radius) hitAll.push(e);
    }
  } else {
    for (const e of game.enemies) {
      if (e.hp > 0 && Math.hypot(e.x - x, e.y - y) <= e.radius + 6) { hitAll.push(e); break; }
    }
  }
  for (const e of hitAll) {
    game.damageEnemy(e, Math.round(dmg * mult));
    if (slow > 0 && !e.def.slowResist) {
      e.slowUntil = game.time + slowBeats * game.beatDur;
      e.slowFactor = 1 - slow;
    }
    if (stunBeats > 0) {
      e.stunUntil = game.time + stunBeats * game.beatDur;
    }
  }
  return hitAll.length;
}

export function updateTowers(game, dtBeats) {
  for (const tower of game.towers) {
    tower.flash = Math.max(0, tower.flash - dtBeats * 2);
    tower.cooldown -= dtBeats;
    if (tower.cooldown > 0) continue;
    const stats = towerStats(tower);
    const target = firstTargetInRange(game, tower, stats.range);
    if (!target) continue;
    tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x);
    tower.cooldown = stats.beatsPerShot;
    tower.flash = 1;
    if (tower.type === 'kendang') {
      // Instant pulse: slow + chip damage to everything in range.
      let hit = 0;
      for (const e of game.enemies) {
        if (e.hp <= 0) continue;
        if (Math.hypot(e.x - tower.x, e.y - tower.y) <= stats.range) {
          game.damageEnemy(e, Math.round(stats.dmg * game.comboMult()));
          if (!e.def.slowResist) {
            e.slowUntil = game.time + stats.slowBeats * game.beatDur;
            e.slowFactor = 1 - stats.slow;
          }
          hit++;
        }
      }
      if (hit > 0) game.effects.ring(tower.x, tower.y, stats.range, '#c97b3d');
      game.audio.strike('kendang');
    } else if (tower.type === 'gong') {
      // Instant shockwave at the target: big area damage + stun.
      const n = applyHit(game, target.x, target.y, stats.dmg, stats.aoe, 0, 0, stats.stunBeats, game.comboMult());
      game.effects.ring(target.x, target.y, stats.aoe, '#f5c542');
      game.effects.burst(target.x, target.y, '#f5c542', 14);
      game.shake = Math.max(game.shake, 0.35);
      game.audio.strike('gong');
      if (n > 0) game.stats.gongHits = (game.stats.gongHits || 0) + 1;
    } else {
      fireProjectile(game, tower, target, stats);
    }
  }
}

export function updateProjectiles(game, dt) {
  for (const p of game.projectiles) {
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 6) p.trail.shift();
    if (!p.target || p.target.hp <= 0) {
      // Target died mid-flight: keep flying to its last spot, then fizzle.
      p.x += Math.cos(p.angle || 0) * p.speed * dt;
      p.y += Math.sin(p.angle || 0) * p.speed * dt;
      p.dead = true;
      continue;
    }
    const dx = p.target.x - p.x;
    const dy = p.target.y - p.y;
    const d = Math.hypot(dx, dy);
    p.angle = Math.atan2(dy, dx);
    const step = p.speed * dt;
    if (d <= step + p.target.radius * 0.5) {
      const n = applyHit(game, p.target.x, p.target.y, p.dmg, p.aoe, p.slow, p.slowBeats, p.stunBeats, game.comboMult());
      game.effects.burst(p.target.x, p.target.y, p.color, p.aoe > 0 ? 10 : 5);
      if (n > 0 && p.kind === 'bonang') game.effects.ring(p.target.x, p.target.y, p.aoe, p.color);
      p.dead = true;
    } else {
      p.x += (dx / d) * step;
      p.y += (dy / d) * step;
    }
  }
  game.projectiles = game.projectiles.filter((p) => !p.dead);
}

// ---- Drawing: bronze instruments on a stone pad, seen from a slight top angle.

function drawPad(ctx, x, y) {
  ctx.fillStyle = '#3a3f4d';
  ctx.beginPath();
  ctx.ellipse(x, y + 6, 34, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4a5060';
  ctx.beginPath();
  ctx.ellipse(x, y + 2, 32, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(232,182,76,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(x, y + 2, 32, 12, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function bronze(ctx, x, y, r, color, flash) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, '#ffe9a8');
  g.addColorStop(0.45, color);
  g.addColorStop(1, '#7a5a1e');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  if (flash > 0) {
    ctx.fillStyle = `rgba(255,255,220,${0.5 * flash})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#5d4413';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

export function drawTower(ctx, tower, time) {
  const { x, y } = tower;
  const def = TOWERS[tower.type];
  const flash = tower.flash;
  const bob = Math.sin(time * 2 + tower.padIndex) * 1.5;
  drawPad(ctx, x, y);
  ctx.save();
  ctx.translate(x, y + bob * 0.3);
  const gold = tower.level >= 2;
  const glow = tower.level >= 3;
  if (glow) {
    ctx.shadowColor = '#ffd76a';
    ctx.shadowBlur = 14;
  }
  if (tower.type === 'saron') {
    // Five bronze bars on a wooden frame.
    ctx.fillStyle = '#6b4a26';
    ctx.fillRect(-26, -8, 52, 16);
    for (let i = 0; i < 5; i++) {
      const bx = -20 + i * 10;
      bronze(ctx, bx, -6, 5.5, def.color, flash);
    }
    ctx.fillStyle = '#8a6a35';
    ctx.fillRect(-28, 8, 56, 4);
  } else if (tower.type === 'kendang') {
    // Barrel drum lying sideways.
    ctx.fillStyle = '#8a5a2e';
    ctx.beginPath();
    ctx.ellipse(-8, -4, 20, 13, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8d9b0';
    ctx.beginPath();
    ctx.ellipse(8, -10, 11, 11, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c9a86a';
    ctx.beginPath();
    ctx.ellipse(8, -10, 7, 7, -0.25, 0, Math.PI * 2);
    ctx.fill();
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,220,${0.5 * flash})`;
      ctx.beginPath();
      ctx.ellipse(8, -10, 11, 11, -0.25, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (tower.type === 'bonang') {
    // Two rows of small kettles.
    ctx.fillStyle = '#6b4a26';
    ctx.fillRect(-26, -12, 52, 22);
    for (let r = 0; r < 2; r++) {
      for (let i = 0; i < 4; i++) {
        bronze(ctx, -19 + i * 13, -6 + r * 10, 5, def.color, flash);
        ctx.fillStyle = '#5d4413';
        ctx.beginPath();
        ctx.arc(-19 + i * 13, -6 + r * 10, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (tower.type === 'kenong') {
    // One large kettle on a low frame.
    ctx.fillStyle = '#6b4a26';
    ctx.fillRect(-20, -2, 40, 8);
    bronze(ctx, 0, -12, 13, def.color, flash);
    ctx.fillStyle = '#5d4413';
    ctx.beginPath();
    ctx.arc(0, -12, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (tower.type === 'gong') {
    // Big gong hanging in a carved frame.
    ctx.strokeStyle = '#7a5a28';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-22, -2);
    ctx.lineTo(-22, -34);
    ctx.lineTo(22, -34);
    ctx.lineTo(22, -2);
    ctx.stroke();
    ctx.fillStyle = '#8a6a35';
    ctx.fillRect(-26, -38, 52, 6);
    bronze(ctx, 0, -16, 17, def.color, flash);
    ctx.fillStyle = '#8a6a35';
    ctx.beginPath();
    ctx.arc(0, -16, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (gold) {
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 36, 14, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Level pips.
  for (let i = 0; i < tower.level; i++) {
    ctx.fillStyle = i === 0 ? '#e8b64c' : '#ffd76a';
    ctx.beginPath();
    ctx.arc(x - 8 + i * 8, y + 18, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
