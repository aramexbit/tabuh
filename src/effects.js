// Particles, floating text and expanding beat rings. Purely visual: nothing
// here touches game logic, so the probe can disable it without changing a run.
export class Effects {
  constructor() {
    this.particles = [];
    this.texts = [];
    this.rings = [];
    this.lightning = []; // jagged sky bolts for the Gong Raksasa
  }

  // A lightning bolt from the sky down to (x, y): jagged polyline, short life.
  bolt(x, y) {
    const pts = [];
    const segs = 7;
    const sx = x + (Math.random() - 0.5) * 100;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      pts.push({
        x: sx + (x - sx) * t + (i === 0 || i === segs ? 0 : (Math.random() - 0.5) * 56),
        y: -10 + (y + 10) * t,
      });
    }
    this.lightning.push({ pts, life: 0.4 });
  }

  // Particle cap: the field must stay readable and fast — oldest motes drop
  // first, so a busy fight never grows the list without bound.
  static MAX_PARTICLES = 200;

  burst(x, y, color, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 120;
      this.pushParticle({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30,
        life: 0.5 + Math.random() * 0.3, maxLife: 0.8, color,
        r: 2 + Math.random() * 3,
      });
    }
  }

  // One slow-rising ambient ember (gold / cyan / orange), drifting up off
  // the field so the night air always glitters, even between fights.
  mote(x, y) {
    const colors = ['#ffd76a', '#7fe3e8', '#ffb85c'];
    this.pushParticle({
      x, y, vx: (Math.random() - 0.5) * 10, vy: -8 - Math.random() * 14,
      life: 2 + Math.random() * 1.2, maxLife: 3.2,
      color: colors[Math.floor(Math.random() * colors.length)],
      r: 1.5 + Math.random() * 1.5,
    });
  }

  pushParticle(p) {
    this.particles.push(p);
    while (this.particles.length > Effects.MAX_PARTICLES) this.particles.shift();
  }

  ring(x, y, maxR, color, life = 0.5, width = 3) {
    this.rings.push({ x, y, r: 8, maxR, color, life, width });
  }

  text(x, y, str, color = '#ffd76a', size = 16) {
    // Cap the pile-up: a Gong Raksasa blast spawns a dozen numbers at once;
    // drop small ones so the big numbers stay readable, like the top-10
    // frames' clean numbers.
    if (this.texts.length >= 20 && size < 22) return;
    // Spread numbers from the same blast: a random offset + slow sideways
    // drift, so they fan out instead of stacking into one unreadable blob.
    this.texts.push({
      x: x + (Math.random() * 28 - 14), y: y + (Math.random() * 12 - 6),
      vx: (Math.random() - 0.5) * 16, str, color, size, life: 1.0,
    });
  }

  update(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 160 * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const t of this.texts) {
      t.x += (t.vx || 0) * dt;
      t.y -= 40 * dt;
      t.life -= dt * 0.75; // numbers hang in the air a little longer
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const r of this.rings) {
      r.r += (r.maxR - r.r) * dt * 6 + 30 * dt;
      r.life -= dt;
    }
    this.rings = this.rings.filter((r) => r.life > 0 && r.r < r.maxR * 1.05);
    for (const b of this.lightning) b.life -= dt;
    this.lightning = this.lightning.filter((b) => b.life > 0);
  }

  draw(ctx) {
    for (const r of this.rings) {
      const a = Math.max(0, r.life * 1.6);
      // Soft glow fill under the ring so it reads as light, not just a line.
      ctx.globalAlpha = a * 0.10;
      ctx.fillStyle = r.color;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = a;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width || 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const b of this.lightning) {
      const a = Math.max(0, b.life / 0.4);
      // Wide gold glow pass, then a thin white core.
      for (const [color, w, alpha] of [['#ffd76a', 7, a * 0.5], ['#ffffff', 2, a]]) {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(b.pts[0].x, b.pts[0].y);
        for (let i = 1; i < b.pts.length; i++) ctx.lineTo(b.pts[i].x, b.pts[i].y);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, t.life * 1.5));
      ctx.font = `bold ${t.size}px sans-serif`;
      ctx.fillStyle = t.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 3;
      ctx.strokeText(t.str, t.x, t.y);
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}
