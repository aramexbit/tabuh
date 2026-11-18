// The dusk village scene: sky, moon, stars, hills, houses with lit windows,
// rice terraces, the cobbled stone path, the spirit gate, the village gate,
// empty build pads and drifting fireflies. All drawn in code — no image assets.
import { W, H } from './config.js';
import { PATH_POINTS, PADS, GATE, distanceToPath } from './world.js';
import { makeRng } from './rng.js';

const stars = [];
{
  const rng = makeRng(1234);
  for (let i = 0; i < 90; i++) {
    stars.push({ x: rng.range(0, W), y: rng.range(0, 260), r: rng.range(0.6, 1.8), tw: rng.range(0, 6.28) });
  }
}
const fireflies = [];
{
  const rng = makeRng(777);
  for (let i = 0; i < 90; i++) {
    fireflies.push({ x: rng.range(60, W - 60), y: rng.range(80, H - 60), ph: rng.range(0, 6.28), sp: rng.range(0.3, 0.9) });
  }
}
// Ground sparkles: tiny gold/cyan glints scattered over the fields (never on
// the path or a pad), twinkling like the mockup's dense starfield.
const sparkles = [];
{
  const rng = makeRng(4242);
  let placed = 0;
  let guard = 0;
  while (placed < 50 && guard++ < 500) {
    const x = rng.range(40, W - 40);
    const y = rng.range(320, 610);
    if (distanceToPath(x, y) < 40) continue;
    if (PADS.some((p) => Math.hypot(x - p.x, y - p.y) < 52)) continue;
    if (x > 1040 && y > 480) continue; // the grade badge covers this corner
    sparkles.push({ x, y, r: rng.range(0.8, 2.2), ph: rng.range(0, 6.28), gold: rng.range(0, 1) > 0.45 });
    placed++;
  }
}

// Grass tufts (three blades each), hand-placed in the verified empty zones.
const GRASS = [
  [150, 560], [230, 610], [560, 600], [900, 600],
  [60, 560], [350, 520], [760, 470], [600, 560],
  [980, 560], [1180, 450],
];

// Ground patches: large soft dark + faint green blobs that break the flat
// lawn into depth, like the mockup's uneven field. Never on the path/pads.
const PATCHES = [];
{
  const rng = makeRng(31337);
  let placed = 0;
  let guard = 0;
  while (placed < 24 && guard++ < 600) {
    const x = rng.range(40, W - 40);
    const y = rng.range(320, 610);
    if (distanceToPath(x, y) < 55) continue;
    if (PADS.some((p) => Math.hypot(x - p.x, y - p.y) < 60)) continue;
    PATCHES.push({
      x, y, rx: rng.range(42, 95), ry: rng.range(12, 26),
      dark: rng.range(0, 1) > 0.33,
    });
    placed++;
  }
}

function drawGrass(ctx, x, y) {
  ctx.strokeStyle = '#4a9a58';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (const [dx, h, lean] of [[-6, 14, -3], [0, 18, 0], [6, 13, 3]]) {
    ctx.beginPath();
    ctx.moveTo(x + dx, y);
    ctx.quadraticCurveTo(x + dx + lean, y - h * 0.6, x + dx + lean * 2, y - h);
    ctx.stroke();
  }
}

function drawCloud(ctx, x, y, s) {
  // Soft dusk cloud: dark blue-grey puffs with a gold-lit rim.
  ctx.fillStyle = 'rgba(46,66,92,0.55)';
  for (const [dx, dy, r] of [[-34, 6, 20], [0, 0, 26], [34, 8, 18], [10, -10, 18]]) {
    ctx.beginPath();
    ctx.ellipse(x + dx * s, y + dy * s, r * s, r * s * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(232,182,76,0.28)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y - 8 * s, 34 * s, 12 * s, 0, Math.PI, 0);
  ctx.stroke();
}

function drawHouse(ctx, x, y, w, h, lit) {
  // Ground shadow: the house sits ON the field now, not pasted on it.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h + 4, w * 0.62, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  // v2.10 (reviewer #9, O2): three house variants, derived from x so the
  // same house always looks the same — the village read as copy-paste
  // (identical brown silhouette + 2 yellow windows, a dozen times).
  const v = ((x / 50) | 0) % 3;
  const wall = v === 2 ? '#241c14' : v === 1 ? '#2e241a' : '#2a2118';
  const roof = v === 2 ? '#241a12' : v === 1 ? '#1a140e' : '#1c1712';
  // Walls.
  ctx.fillStyle = wall;
  ctx.fillRect(x, y, w, h);
  // Steep thatched roof.
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(x - 10, y);
  ctx.lineTo(x + w / 2, y - h * 0.85);
  ctx.lineTo(x + w + 10, y);
  ctx.closePath();
  ctx.fill();
  // Roof ridge highlight.
  ctx.strokeStyle = 'rgba(232,182,76,0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - 10, y);
  ctx.lineTo(x + w / 2, y - h * 0.85);
  ctx.lineTo(x + w + 10, y);
  ctx.stroke();
  // Lit windows: v0 two windows, v1 one wide window + door, v2 three
  // small windows.
  if (lit) {
    ctx.fillStyle = '#ffb85c';
    if (v === 1) {
      ctx.fillRect(x + w * 0.3, y + h * 0.3, w * 0.4, h * 0.32);
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(x + w * 0.72, y + h * 0.55, w * 0.16, h * 0.45);
    } else if (v === 2) {
      ctx.fillRect(x + w * 0.12, y + h * 0.35, w * 0.16, h * 0.28);
      ctx.fillRect(x + w * 0.42, y + h * 0.35, w * 0.16, h * 0.28);
      ctx.fillRect(x + w * 0.72, y + h * 0.35, w * 0.16, h * 0.28);
    } else {
      ctx.fillRect(x + w * 0.2, y + h * 0.35, w * 0.2, h * 0.3);
      ctx.fillRect(x + w * 0.62, y + h * 0.35, w * 0.2, h * 0.3);
    }
    const g = ctx.createRadialGradient(x + w / 2, y + h * 0.5, 2, x + w / 2, y + h * 0.5, 64);
    g.addColorStop(0, 'rgba(255,184,92,0.38)');
    g.addColorStop(1, 'rgba(255,184,92,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x + w / 2 - 64, y + h * 0.5 - 64, 128, 128);
  }
}

function drawPath(ctx) {
  // Wide dirt underlay, then cobbles along the waypoints.
  // v2.13 (reviewer #12, P1-5): the path was too dark to read in 1 s —
  // brightened ~20% (underlay #4d4436 -> #5e5342, cobbles #6e6250 ->
  // #857a62, dots 0.5 -> 0.6) so the route reads like #10's lava.
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#5e5342';
  ctx.lineWidth = 46;
  ctx.beginPath();
  ctx.moveTo(PATH_POINTS[0][0], PATH_POINTS[0][1]);
  for (let i = 1; i < PATH_POINTS.length; i++) ctx.lineTo(PATH_POINTS[i][0], PATH_POINTS[i][1]);
  ctx.stroke();
  ctx.strokeStyle = '#857a62';
  ctx.lineWidth = 38;
  ctx.beginPath();
  ctx.moveTo(PATH_POINTS[0][0], PATH_POINTS[0][1]);
  for (let i = 1; i < PATH_POINTS.length; i++) ctx.lineTo(PATH_POINTS[i][0], PATH_POINTS[i][1]);
  ctx.stroke();
  // Cobble dots.
  ctx.fillStyle = 'rgba(210,190,150,0.6)';
  for (let i = 0; i < PATH_POINTS.length - 1; i++) {
    const a = PATH_POINTS[i];
    const b = PATH_POINTS[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.floor(len / 26);
    for (let j = 0; j < n; j++) {
      const t = (j + 0.5) / n;
      const x = a[0] + (b[0] - a[0]) * t + ((j % 2) - 0.5) * 10;
      const y = a[1] + (b[1] - a[1]) * t + ((j % 3) - 1) * 8;
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawSpiritGate(ctx, time) {
  const x = PATH_POINTS[0][0] - 18;
  const y = PATH_POINTS[0][1] - 6;
  const pulse = 0.6 + Math.sin(time * 2.2) * 0.25;
  // Swirling portal.
  const g = ctx.createRadialGradient(x, y, 4, x, y, 52);
  g.addColorStop(0, `rgba(127,227,200,${0.75 * pulse})`);
  g.addColorStop(0.5, `rgba(80,180,160,${0.4 * pulse})`);
  g.addColorStop(1, 'rgba(40,90,90,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, 52, 0, Math.PI * 2);
  ctx.fill();
  // Stone arch.
  ctx.strokeStyle = '#2c3442';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(x, y + 26, 34, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = '#2c3442';
  ctx.fillRect(x - 40, y + 18, 10, 26);
  ctx.fillRect(x + 30, y + 18, 10, 26);
  // Inner swirl.
  ctx.strokeStyle = `rgba(200,255,235,${0.8 * pulse})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 16, time * 1.5, time * 1.5 + Math.PI * 1.4);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 8, -time * 2, -time * 2 + Math.PI);
  ctx.stroke();
}

function drawVillageGate(ctx, time, hp, maxHp) {
  const { x, y, w, h } = GATE;
  const flicker = 0.85 + Math.sin(time * 5) * 0.1 + Math.sin(time * 9.3) * 0.05;
  // Wooden arch.
  ctx.fillStyle = '#5a3d24';
  ctx.fillRect(x - w / 2, y - h, 12, h);
  ctx.fillRect(x + w / 2 - 12, y - h, 12, h);
  ctx.fillStyle = '#6b4a2c';
  ctx.fillRect(x - w / 2 - 8, y - h - 8, w + 16, 12);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(x - w / 2 - 4, y - h / 2 - 6, w + 8, 8);
  // Lanterns.
  for (const lx of [x - w / 2 - 2, x + w / 2 + 2]) {
    const g = ctx.createRadialGradient(lx, y - h - 2, 1, lx, y - h - 2, 26);
    g.addColorStop(0, `rgba(255,190,100,${0.55 * flicker})`);
    g.addColorStop(1, 'rgba(255,190,100,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(lx, y - h - 2, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffb85c';
    ctx.beginPath();
    ctx.arc(lx, y - h - 2, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Gate HP as small lanterns row above the arch.
  const n = 10;
  for (let i = 0; i < n; i++) {
    const lit = i < Math.ceil((hp / maxHp) * n);
    ctx.fillStyle = lit ? '#ffb85c' : 'rgba(120,90,60,0.5)';
    ctx.beginPath();
    ctx.arc(x - w / 2 + 8 + i * ((w - 16) / (n - 1)), y - h - 18, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawScene(ctx, game, time) {
  // Sky: deeper dusk gradient with a warm glow low on the horizon.
  // v2.10 (reviewer #9, R6): the sky TINT changes as the nights deepen —
  // all four frames were the same blue-green dusk, so night 6 vs 9 vs 10
  // read as one repeated state. Now: blue dusk (1-3) -> purple (4-6) ->
  // deep violet (7-8) -> storm (9) -> boss red/orange (10+). Draw-only.
  // v2.11 (reviewer #10, R6-ulang): wave 9 gets its OWN storm tint AND
  // visible rain (below) — v2.10's waves 8 and 9 shared the violet band
  // and were indistinguishable without reading the HUD. In the menu
  // (wave < 1) the first tint applies.
  const SKY_TINTS = [
    { stops: ['#081626', '#14384a', '#2c4a4a', '#6b5a3a'], glow: 'rgba(232,182,76,0.10)' },
    { stops: ['#0d1226', '#1e2a4a', '#3a2a4a', '#5a3a5a'], glow: 'rgba(180,140,232,0.10)' },
    { stops: ['#0a0e20', '#1a2340', '#2a2340', '#4a2a3a'], glow: 'rgba(200,120,180,0.10)' },
    { stops: ['#070d18', '#12203a', '#1a2438', '#3a2a3a'], glow: 'rgba(140,180,255,0.08)' },
    { stops: ['#160a12', '#3a1420', '#4a1a1a', '#7a3a20'], glow: 'rgba(255,120,60,0.14)' },
  ];
  const w = game.wave || 1;
  const tintIdx = w >= 10 ? 4 : w === 9 ? 3 : Math.min(2, Math.floor((w - 1) / 3));
  const tint = SKY_TINTS[tintIdx];
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, tint.stops[0]);
  sky.addColorStop(0.45, tint.stops[1]);
  sky.addColorStop(0.72, tint.stops[2]);
  sky.addColorStop(1, tint.stops[3]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  const horizon = ctx.createRadialGradient(W / 2, 310, 40, W / 2, 310, 560);
  horizon.addColorStop(0, tint.glow);
  horizon.addColorStop(1, 'rgba(232,182,76,0)');
  ctx.fillStyle = horizon;
  ctx.fillRect(0, 0, W, H);
  // Stars.
  for (const s of stars) {
    ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(time * 0.8 + s.tw));
    ctx.fillStyle = '#dfe9f5';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Moon.
  const mg = ctx.createRadialGradient(150, 90, 8, 150, 90, 60);
  mg.addColorStop(0, 'rgba(240,230,190,0.9)');
  mg.addColorStop(0.35, 'rgba(240,230,190,0.25)');
  mg.addColorStop(1, 'rgba(240,230,190,0)');
  ctx.fillStyle = mg;
  ctx.beginPath();
  ctx.arc(150, 90, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#efe6c0';
  ctx.beginPath();
  ctx.arc(150, 90, 26, 0, Math.PI * 2);
  ctx.fill();
  // Golden dusk clouds drifting over the village (like the mockup's sky).
  drawCloud(ctx, 620, 105, 1.15);
  drawCloud(ctx, 980, 78, 0.9);
  drawCloud(ctx, 330, 150, 0.8);
  // Distant hills.
  ctx.fillStyle = '#0f2a33';
  ctx.beginPath();
  ctx.moveTo(0, 300);
  ctx.quadraticCurveTo(300, 210, 640, 290);
  ctx.quadraticCurveTo(980, 360, 1280, 260);
  ctx.lineTo(1280, 720);
  ctx.lineTo(0, 720);
  ctx.closePath();
  ctx.fill();
  // Ground: dark teal-green fields.
  // v2.14 (reviewer #13, P1): darkened ~15% (#17352c -> #122b24,
  // #0e241d -> #0a1c16) so the (brightened) path and the enemies stand
  // out from the lawn instead of blending into it.
  const ground = ctx.createLinearGradient(0, 300, 0, H);
  ground.addColorStop(0, '#122b24');
  ground.addColorStop(1, '#0a1c16');
  ctx.fillStyle = ground;
  ctx.fillRect(0, 300, W, H - 300);
  // Ground patches: soft dark/light blobs so the lawn has depth.
  for (const p of PATCHES) {
    ctx.fillStyle = p.dark ? 'rgba(0,0,0,0.16)' : 'rgba(140,200,140,0.07)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Rice terraces (bottom left).
  ctx.strokeStyle = 'rgba(120,180,120,0.18)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 560 + i * 38);
    ctx.quadraticCurveTo(160, 540 + i * 38, 330, 575 + i * 38);
    ctx.stroke();
  }
  // Houses (mid-left, behind the path).
  drawHouse(ctx, 120, 300, 120, 70, true);
  drawHouse(ctx, 300, 330, 100, 58, true);
  drawHouse(ctx, 480, 300, 130, 76, true);
  drawHouse(ctx, 700, 250, 110, 62, false);
  drawHouse(ctx, 940, 255, 100, 58, true);
  // Houses (lower-middle — fills the empty field between path segments).
  drawHouse(ctx, 860, 470, 110, 64, true);
  drawHouse(ctx, 1060, 530, 100, 58, true);
  drawHouse(ctx, 60, 430, 100, 60, true);
  drawHouse(ctx, 1080, 420, 90, 54, false);
  // More houses so the middle field never reads as one big empty lawn.
  drawHouse(ctx, 180, 495, 100, 58, true);
  drawHouse(ctx, 640, 540, 110, 62, true);
  drawHouse(ctx, 980, 380, 100, 58, false);
  // Bamboo cluster (lower-middle, right of the path).
  ctx.strokeStyle = '#3f7a4a';
  ctx.lineWidth = 3;
  for (const [bx, by, bh] of [[770, 600, 70], [790, 605, 55], [810, 598, 62]]) {
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + 6, by - bh / 2, bx + 2, by - bh);
    ctx.stroke();
    ctx.fillStyle = '#4a9a58';
    ctx.beginPath();
    ctx.ellipse(bx + 2, by - bh - 6, 16, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Second bamboo cluster (left field).
  ctx.strokeStyle = '#3f7a4a';
  ctx.lineWidth = 3;
  for (const [bx, by, bh] of [[250, 505, 60], [268, 510, 48], [286, 502, 55]]) {
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + 6, by - bh / 2, bx + 2, by - bh);
    ctx.stroke();
    ctx.fillStyle = '#4a9a58';
    ctx.beginPath();
    ctx.ellipse(bx + 2, by - bh - 6, 14, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Third + fourth bamboo clusters (right field, bottom left).
  for (const cluster of [[[1150, 470, 62], [1168, 475, 50], [1186, 468, 56]], [[90, 580, 58], [108, 585, 46], [126, 578, 52]]]) {
    ctx.strokeStyle = '#3f7a4a';
    ctx.lineWidth = 3;
    for (const [bx, by, bh] of cluster) {
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + 6, by - bh / 2, bx + 2, by - bh);
      ctx.stroke();
      ctx.fillStyle = '#4a9a58';
      ctx.beginPath();
      ctx.ellipse(bx + 2, by - bh - 6, 14, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Grass tufts across the verified empty zones.
  for (const [gx, gy] of GRASS) drawGrass(ctx, gx, gy);
  // The stone path.
  drawPath(ctx);
  // Empty build pads (occupied ones are drawn by the tower).
  for (let i = 0; i < PADS.length; i++) {
    const occupied = game.towers.some((t) => t.padIndex === i);
    if (occupied) continue;
    const p = PADS[i];
    const sel = game.selectedPad === i;
    ctx.fillStyle = sel ? '#5a5142' : '#3a3f4d';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 6, 34, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = sel ? '#ffd76a' : 'rgba(232,182,76,0.4)';
    ctx.lineWidth = sel ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 2, 32, 12, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (sel) {
      ctx.fillStyle = 'rgba(255,215,106,0.9)';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Pilih instrumen', p.x, p.y - 22);
    }
  }
  drawSpiritGate(ctx, time);
  drawVillageGate(ctx, time, game.gateHp, game.gateMaxHp);
  // Fireflies (90 now — the night air is thick with them).
  for (const f of fireflies) {
    const fx = f.x + Math.sin(time * f.sp + f.ph) * 18;
    const fy = f.y + Math.cos(time * f.sp * 0.7 + f.ph) * 10;
    ctx.globalAlpha = 0.35 + 0.5 * Math.abs(Math.sin(time * 1.4 + f.ph));
    ctx.fillStyle = '#ffe066';
    ctx.beginPath();
    ctx.arc(fx, fy, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Halo so each firefly glows, not just dots.
    ctx.globalAlpha = 0.18 * Math.abs(Math.sin(time * 1.4 + f.ph));
    ctx.beginPath();
    ctx.arc(fx, fy, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Ground sparkles: gold/cyan glints twinkling over the fields.
  for (const s of sparkles) {
    ctx.globalAlpha = 0.25 + 0.55 * Math.abs(Math.sin(time * 1.8 + s.ph));
    ctx.fillStyle = s.gold ? '#ffd76a' : '#7fe3e8';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // v2.11 (reviewer #10, R6-ulang): visible RAIN during the Hujan twist —
  // the twist only changed numbers before (damage x1.25, narrower
  // windows), so wave 9 looked identical to wave 8. Diagonal streaks,
  // deterministic from (i, time) so the same moment always looks the same.
  if (game.twist === 'hujan') {
    ctx.strokeStyle = 'rgba(157,184,232,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 70; i++) {
      const rx = ((i * 137 + time * 140) % 1400) - 60;
      const ry = ((i * 89 + time * 320) % 780) - 40;
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 5, ry + 16);
    }
    ctx.stroke();
  }
  // Beat pulse: the whole arena breathes gold on the ketuk (0.6 s cycle).
  const pulse = 0.5 + 0.5 * Math.sin(time * (Math.PI * 2 / 0.6));
  const pg = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 760);
  pg.addColorStop(0, `rgba(232,182,76,${0.09 * pulse})`);
  pg.addColorStop(1, 'rgba(232,182,76,0)');
  ctx.fillStyle = pg;
  ctx.fillRect(0, 0, W, H);
  // Vignette: darkened edges pull the eye to the village centre and give
  // the flat canvas a photographic depth the top-10 frames all have.
  const vg = ctx.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 780);
  vg.addColorStop(0, 'rgba(4,8,16,0)');
  vg.addColorStop(1, 'rgba(4,8,16,0.45)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}
