// The dusk village scene: sky, moon, stars, hills, houses with lit windows,
// rice terraces, the cobbled stone path, the spirit gate, the village gate,
// empty build pads and drifting fireflies. All drawn in code — no image assets.
import { W, H } from './config.js';
import { PATH_POINTS, PADS, GATE } from './world.js';
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
  for (let i = 0; i < 26; i++) {
    fireflies.push({ x: rng.range(60, W - 60), y: rng.range(80, H - 60), ph: rng.range(0, 6.28), sp: rng.range(0.3, 0.9) });
  }
}

function drawHouse(ctx, x, y, w, h, lit) {
  // Walls.
  ctx.fillStyle = '#2a2118';
  ctx.fillRect(x, y, w, h);
  // Steep thatched roof.
  ctx.fillStyle = '#1c1712';
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
  // Lit windows.
  if (lit) {
    ctx.fillStyle = '#ffb85c';
    ctx.fillRect(x + w * 0.2, y + h * 0.35, w * 0.2, h * 0.3);
    ctx.fillRect(x + w * 0.62, y + h * 0.35, w * 0.2, h * 0.3);
    const g = ctx.createRadialGradient(x + w / 2, y + h * 0.5, 2, x + w / 2, y + h * 0.5, 46);
    g.addColorStop(0, 'rgba(255,184,92,0.28)');
    g.addColorStop(1, 'rgba(255,184,92,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x + w / 2 - 46, y + h * 0.5 - 46, 92, 92);
  }
}

function drawPath(ctx) {
  // Wide dirt underlay, then cobbles along the waypoints.
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#4d4436';
  ctx.lineWidth = 46;
  ctx.beginPath();
  ctx.moveTo(PATH_POINTS[0][0], PATH_POINTS[0][1]);
  for (let i = 1; i < PATH_POINTS.length; i++) ctx.lineTo(PATH_POINTS[i][0], PATH_POINTS[i][1]);
  ctx.stroke();
  ctx.strokeStyle = '#6e6250';
  ctx.lineWidth = 38;
  ctx.beginPath();
  ctx.moveTo(PATH_POINTS[0][0], PATH_POINTS[0][1]);
  for (let i = 1; i < PATH_POINTS.length; i++) ctx.lineTo(PATH_POINTS[i][0], PATH_POINTS[i][1]);
  ctx.stroke();
  // Cobble dots.
  ctx.fillStyle = 'rgba(210,190,150,0.5)';
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
  // Sky: dusk gradient, warm band at the horizon.
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0b1c2e');
  sky.addColorStop(0.45, '#14384a');
  sky.addColorStop(0.72, '#2c4a4a');
  sky.addColorStop(1, '#6b5a3a');
  ctx.fillStyle = sky;
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
  const ground = ctx.createLinearGradient(0, 300, 0, H);
  ground.addColorStop(0, '#17352c');
  ground.addColorStop(1, '#0e241d');
  ctx.fillStyle = ground;
  ctx.fillRect(0, 300, W, H - 300);
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
  // Fireflies.
  for (const f of fireflies) {
    const fx = f.x + Math.sin(time * f.sp + f.ph) * 18;
    const fy = f.y + Math.cos(time * f.sp * 0.7 + f.ph) * 10;
    ctx.globalAlpha = 0.35 + 0.5 * Math.abs(Math.sin(time * 1.4 + f.ph));
    ctx.fillStyle = '#ffe066';
    ctx.beginPath();
    ctx.arc(fx, fy, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
