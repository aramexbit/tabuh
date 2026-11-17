// Particles, floating text and expanding beat rings. Purely visual: nothing
// here touches game logic, so the probe can disable it without changing a run.
export class Effects {
  constructor() {
    this.particles = [];
    this.texts = [];
    this.rings = [];
  }

  burst(x, y, color, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 120;
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30,
        life: 0.5 + Math.random() * 0.3, maxLife: 0.8, color,
        r: 2 + Math.random() * 3,
      });
    }
  }

  ring(x, y, maxR, color) {
    this.rings.push({ x, y, r: 8, maxR, color, life: 0.5 });
  }

  text(x, y, str, color = '#ffd76a', size = 16) {
    this.texts.push({ x, y, str, color, size, life: 1.0 });
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
      t.y -= 34 * dt;
      t.life -= dt * 0.9;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const r of this.rings) {
      r.r += (r.maxR - r.r) * dt * 6 + 30 * dt;
      r.life -= dt;
    }
    this.rings = this.rings.filter((r) => r.life > 0 && r.r < r.maxR * 1.05);
  }

  draw(ctx) {
    for (const r of this.rings) {
      ctx.globalAlpha = Math.max(0, r.life * 1.6);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
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
