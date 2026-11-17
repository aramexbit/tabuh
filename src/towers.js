// Towers: bronze gamelan instruments built on stone pads. A tower strikes on the
// beat grid (cooldown counts beats, not seconds), so its rhythm is visible.
// Saron/Bonang/Kenong fire homing note projectiles; Kendang pulses a slow;
// Gong lands an instant area shockwave + stun.
import { TOWERS, UPGRADES, SELL_RATE } from './config.js';
import { PADS } from './world.js';

export function towerStats(tower, game) {
  const base = TOWERS[tower.type];
  const up = UPGRADES[tower.level] || { dmgMul: 1, rangeMul: 1 };
  // Malam Berkabut: tower range -20%.
  const rangeMul = game && game.twist === 'kabut' ? 0.8 : 1;
  return {
    dmg: Math.round(base.dmg * up.dmgMul),
    range: Math.round(base.range * up.rangeMul * rangeMul),
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
  return Math.round(towerSpent(tower) * SELL_RATE);
}

// Total coins sunk into a tower (build + upgrades) — the base for both the
// sell refund (70%) and the destroy refund (50%).
export function towerSpent(tower) {
  let spent = TOWERS[tower.type].cost;
  for (let l = 2; l <= tower.level; l++) {
    spent += Math.round(TOWERS[tower.type].cost * UPGRADES[l].costMul);
  }
  return spent;
}

export function createTower(type, padIndex) {
  const pad = PADS[padIndex];
  // Durability: ghosts fight back. Explicit per tower — it follows price and
  // size: Saron is the most fragile, Gong the toughest (but nothing is immune).
  const maxDurability = TOWERS[type].durability;
  return {
    type, padIndex, level: 1,
    x: pad.x, y: pad.y,
    cooldown: 0, // beats until the next strike
    flash: 0, // animation timer after firing
    angle: -Math.PI / 2,
    durability: maxDurability,
    maxDurability,
    stunUntil: 0, // Kuntilanak laugh: no firing at all
    slowUntil: 0, // Pocong wrap: firing slows to slowFactor
    slowFactor: 1,
  };
}

function firstTargetInRange(game, tower, range) {
  // v2.7: each tower shoots the spirit nearest ITSELF. The old rule (nearest
  // the village gate) made every tower in range focus-fire the single most
  // advanced walker, so the hunting pack was picked off one by one and never
  // reached the far pads (diagnostic 18 Nov: far-hunters died at y~250).
  // Nearest-to-tower spreads the fire across the pack — walkers survive the
  // crossing, reach their tower, and that tower defends itself against its
  // own attackers. That is the hunt-the-towers game the user asked for.
  let best = null;
  let bestD = Infinity;
  for (const e of game.enemies) {
    if (e.hp <= 0) continue;
    const d = Math.hypot(e.x - tower.x, e.y - tower.y);
    if (d > range) continue;
    if (d < bestD) {
      best = e;
      bestD = d;
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

function applyHit(game, x, y, dmg, aoe, slow, slowBeats, stunBeats, mult, kind) {
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
    game.damageEnemy(e, Math.round(dmg * mult), kind);
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
    // Kuntilanak laugh: stunned towers do not fire at all.
    if (game.time < tower.stunUntil) continue;
    // Pocong wrap: the cooldown ticks at slowFactor speed.
    let beats = dtBeats;
    if (game.time < tower.slowUntil) beats *= tower.slowFactor;
    tower.cooldown -= beats;
    if (tower.cooldown > 0) continue;
    const stats = towerStats(tower, game);
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
          game.damageEnemy(e, Math.round(stats.dmg * game.comboMult() * game.dmgMul()), 'kendang');
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
      // Instant shockwave at the target: big area damage + stun. Two rings
      // (wide gold + tight bright core) and a heavy spark burst, so the
      // gong's hit reads as the biggest moment on the field.
      const n = applyHit(game, target.x, target.y, stats.dmg, stats.aoe, 0, 0, stats.stunBeats, game.comboMult() * game.dmgMul(), 'gong');
      game.stats.lastGongHits = n;
      // Best gong hit so far: the big pose captures on the best hit, not
      // the latest — the latest hit is often a lone straggler, so requiring
      // lastGongHits>=2 made the pose flaky (probe 31/32, big never ready).
      game.stats.maxGongHits = Math.max(game.stats.maxGongHits || 0, n);
      game.effects.ring(target.x, target.y, stats.aoe * 1.35, '#f5c542', 1.2, 6);
      game.effects.ring(target.x, target.y, stats.aoe * 0.8, '#fff2b0', 0.9, 4);
      // The gong's hit lands as light: a shaft from the sky + a pool of
      // gold on the ground, so the biggest moment reads as light, not text.
      game.effects.beam(target.x, target.y);
      game.effects.glow(target.x, target.y, stats.aoe * 1.6);
      game.effects.burst(target.x, target.y, '#f5c542', 22);
      game.effects.burst(target.x, target.y, '#fff2b0', 10);
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
      const n = applyHit(game, p.target.x, p.target.y, p.dmg, p.aoe, p.slow, p.slowBeats, p.stunBeats, game.comboMult() * game.dmgMul(), p.kind);
      game.effects.burst(p.target.x, p.target.y, p.color, p.aoe > 0 ? 14 : 8);
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
  // Warm glow under every tower so the instruments read as lit bronze
  // against the dark field; the gong gets the widest, brightest halo.
  const glowR = tower.type === 'gong' ? 74 : 46;
  const gg = ctx.createRadialGradient(x, y - 6, 4, x, y - 6, glowR);
  gg.addColorStop(0, def.color + '59');
  gg.addColorStop(0.6, def.color + '26');
  gg.addColorStop(1, def.color + '00');
  ctx.fillStyle = gg;
  ctx.beginPath();
  ctx.arc(x, y - 6, glowR, 0, Math.PI * 2);
  ctx.fill();
  if (tower.type === 'gong') {
    // Pulsing halo ring around the gong, breathing with the beat.
    ctx.strokeStyle = `rgba(245,197,66,${0.30 + 0.18 * Math.sin(time * (Math.PI * 2 / 0.6))})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y - 12, 30 + 3 * Math.sin(time * 3 + tower.padIndex), 0, Math.PI * 2);
    ctx.stroke();
  }
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
  // Durability bar above the tower (always visible once chipped).
  const durPct = tower.durability / tower.maxDurability;
  if (durPct < 1) {
    const bw = 44;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(x - bw / 2, y - 48, bw, 6);
    ctx.fillStyle = durPct > 0.5 ? '#7fe3a8' : durPct > 0.25 ? '#ffd76a' : '#ff7a6a';
    ctx.fillRect(x - bw / 2, y - 48, bw * Math.max(0, durPct), 6);
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - bw / 2, y - 48, bw, 6);
  }
  // Cracks + smoke when badly damaged; a wrapped tower shows its shroud.
  if (durPct < 0.5) {
    ctx.strokeStyle = 'rgba(20,16,12,0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 12, y - 20);
    ctx.lineTo(x - 4, y - 8);
    ctx.lineTo(x - 10, y + 2);
    ctx.moveTo(x + 12, y - 18);
    ctx.lineTo(x + 4, y - 6);
    ctx.stroke();
    ctx.fillStyle = `rgba(160,160,160,${0.25 + 0.15 * Math.sin(time * 2 + tower.padIndex)})`;
    ctx.beginPath();
    ctx.arc(x + 6 + Math.sin(time * 1.3 + tower.padIndex) * 4, y - 30, 6, 0, Math.PI * 2);
    ctx.arc(x - 8, y - 36, 5, 0, Math.PI * 2);
    ctx.fill();
    if (durPct < 0.35) {
      ctx.fillStyle = '#ff4a3d';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', x, y - 52);
      ctx.textAlign = 'left';
    }
  }
  if (time < tower.stunUntil) {
    // Dizzy stars while stunned by a Kuntilanak laugh.
    ctx.fillStyle = '#ffe9a8';
    for (let i = 0; i < 3; i++) {
      const a = time * 3 + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 16, y - 26 + Math.sin(a) * 4, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (time < tower.slowUntil) {
    // White wrap bands while a Pocong shrouds the tower.
    ctx.strokeStyle = 'rgba(245,242,232,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 18, y - 22);
    ctx.lineTo(x + 18, y - 14);
    ctx.moveTo(x - 18, y - 8);
    ctx.lineTo(x + 18, y - 2);
    ctx.stroke();
  }
}
