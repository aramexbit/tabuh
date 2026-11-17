// Particles, floating text and expanding beat rings. Purely visual: nothing
// here touches game logic, so the probe can disable it without changing a run.
import { W, H } from './config.js';

export class Effects {
  constructor() {
    this.particles = [];
    this.texts = [];
    this.rings = [];
    this.lightning = []; // jagged sky bolts for the Gong Raksasa
    this.beams = []; // vertical light shafts (gong strikes, Gong Raksasa)
    this.glows = []; // expanding pools of light on the ground
    this.bigQueue = []; // v2.8 (P1): big announcement texts wait their turn
  }

  // A shaft of light from the sky down to (x, y): a gong strike landing
  // as light, not just a ring — the Lanternkeep moment TABUH showed as
  // text instead of light. Life 1.4 s (was 0.7): at the boss capture
  // (500 ms after the trigger) the old beam had faded to alpha ~0.13,
  // effectively invisible — only the gold shockwave rings showed.
  beam(x, y) {
    this.beams.push({ x, y, life: 1.4, maxLife: 1.4 });
  }

  // An expanding pool of gold light on the ground. Life 1.4 s (was 0.9),
  // same reason as the beam: it must still be glowing at capture time.
  glow(x, y, maxR, color = '#ffd76a') {
    this.glows.push({ x, y, r: 12, maxR, life: 1.4, maxLife: 1.4, color });
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
    // Cap the pile-up: at most 4 SMALL texts live at once. A Gong Raksasa
    // blast used to spawn a dozen numbers that stacked into the unreadable
    // blob in the v2.3 boss frame — the top-10 frames keep their numbers
    // small, local and few. Big texts (kill pops, banners) always pass.
    if (size < 22) {
      const small = this.texts.filter((t) => t.size < 22).length;
      if (small >= 4) return;
    } else if (this.texts.length >= 12) return;
    // v2.8 (P1): at most ONE big announcement text (size >= 22) on screen
    // at a time. "GONG RAKSASA!" + "TUYUL EMAS! +150" + a "TUYUL EMAS
    // +500" kill pop used to stack in the same band and read as one
    // unreadable blob (v2.7 boss frame). A big text that arrives while one
    // is live waits in a short queue (max 2, further arrivals dropped)
    // and shows when the slot frees — the event still reads, just in turn.
    if (size >= 22 && this.texts.some((t) => t.size >= 22)) {
      if (this.bigQueue.length < 2) this.bigQueue.push({ x, y, str, color, size });
      return;
    }
    // v2.9 (R3): measure the REAL rendered width — the 0.6*size estimate
    // under-measures wide glyphs ("◆" is ~1.0x size, bold digits ~0.6),
    // so "+14 ◆" still sat ~25-35 px from the right edge in v2.8 even
    // though the estimate said 48 px clear. The ctx is stored by draw()
    // (called every frame); before the first draw, fall back to the
    // estimate. Setting ctx.font here is safe: every draw site sets its
    // own font before fillText.
    let estW = str.length * size * 0.6;
    if (this.ctx) {
      this.ctx.font = `bold ${size}px sans-serif`;
      estW = this.ctx.measureText(str).width;
    }
    // Spread numbers from the same blast: a random offset + slow sideways
    // drift, so they fan out instead of stacking into one unreadable blob.
    // Clamp inside the frame with a real margin (center-aligned: keep half
    // the width clear) — a long golden-tuyul pop used to touch the right
    // edge at the old 8 px margin; 48 px now (P4: "+14" was still clipped
    // at the win frame's right edge in v2.7).
    let px = Math.min(Math.max(x + (Math.random() * 28 - 14), estW / 2 + 48), W - estW / 2 - 48);
    let py = y + (Math.random() * 12 - 6);
    // De-collide: a number that would land on top of a live one steps away
    // (up to 8 steps), so a multi-kill reads as a stack. The horizontal
    // window is +20 now (was +6): two "-44" pops side by side used to read
    // as "-4444" over the beat verdict (v2.6 frame 2). The vertical window
    // is deliberately wide — (sizeA + sizeB) * 1.2: texts are drawn on an
    // alphabetic baseline, so two texts whose centers are only ~11 px apart
    // still overlap their glyphs, and texts spawned a beat apart have
    // already risen into each other's space by capture time.
    // The step (3x the font) MUST exceed the window: a step smaller than
    // the window re-hits the same text and burns all 8 tries without
    // clearing it — that was the remaining boss-frame overlap.
    const step = size * 3;
    if (size >= 30) {
      // Banners (GONG RAKSASA!): fixed position high on the field, never
      // de-collided DOWN onto the boss's crown/face — clamp to the upper
      // band [64, 280] and skip the loop entirely.
      py = Math.min(Math.max(py, 64), 280);
    } else {
      // Medium texts (22-29) step UP, small texts step down: a medium pop
      // stepped down used to land on the sprite below it.
      const dir = size >= 22 ? -1 : 1;
      for (let tries = 0; tries < 8; tries++) {
        const hit = this.texts.find((t) =>
          Math.abs(t.x - px) < (t.estW + estW) / 2 + 20
          && Math.abs(t.y - py) < (t.size + size) * 1.2);
        if (!hit) break;
        py += dir * step;
      }
      // Keep pops inside the field: a kill pop spawned near the gate used to
      // slide under the TABUH drum (bottom bar), and the de-collision steps
      // only push DOWN — so clamp after the loop, not before it.
      // P4: keep clear of the top bar too (64, was 56).
      py = Math.min(Math.max(py, 64), H - 150);
    }
    // Grade-badge exclusion: the big S/A/B/C badge lives at x 1064-1268,
    // y 496-608 (bottom right, always visible while playing). A kill pop
    // landing there would sit on top of the badge — shift it left of it.
    if (px + estW / 2 > 1064 && px - estW / 2 < 1268 && py > 496 && py < 608) {
      px = 1064 - estW / 2 - 8;
    }
    this.texts.push({
      x: px, y: py, estW,
      vx: (Math.random() - 0.5) * 16, str, color, size, life: 1.0,
      // Small numbers fade fast (0.8 s); big pops linger (1.3 s).
      decay: size < 22 ? 1.25 : 0.75,
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
    // Crowded fights fade their numbers faster (P1), so the field never
    // fills with stale pops.
    const crowded = this.texts.length > 8;
    for (const t of this.texts) {
      t.x += (t.vx || 0) * dt;
      t.y -= 40 * dt;
      // Rising pops must not climb into the top bar (P4: 64, was 60).
      t.y = Math.max(t.y, 64);
      // Drift must never carry a pop off the side edge (P4) — v2.9 (R3):
      // 48 px, not 24: the old 24 px drift clamp (with the underestimated
      // width) is how "+14 ◆" ended ~25 px from the edge in v2.8.
      t.x = Math.min(Math.max(t.x, t.estW / 2 + 48), W - t.estW / 2 - 48);
      t.life -= dt * (t.decay || 0.75) * (crowded ? 1.5 : 1);
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    // Drain the big-text queue (P1): one announcement at a time — a queued
    // text shows as soon as the slot is free.
    if (this.bigQueue.length > 0 && !this.texts.some((t) => t.size >= 22)) {
      const q = this.bigQueue.shift();
      this.text(q.x, q.y, q.str, q.color, q.size);
    }
    for (const r of this.rings) {
      r.r += (r.maxR - r.r) * dt * 6 + 30 * dt;
      r.life -= dt;
    }
    this.rings = this.rings.filter((r) => r.life > 0 && r.r < r.maxR * 1.05);
    for (const b of this.lightning) b.life -= dt;
    this.lightning = this.lightning.filter((b) => b.life > 0);
    for (const b of this.beams) b.life -= dt;
    this.beams = this.beams.filter((b) => b.life > 0);
    for (const gl of this.glows) {
      gl.r += (gl.maxR - gl.r) * dt * 5 + 60 * dt;
      gl.life -= dt;
    }
    this.glows = this.glows.filter((gl) => gl.life > 0 && gl.r < gl.maxR * 1.05);
  }

  draw(ctx) {
    // v2.9 (R3): keep the ctx so text() can measure real glyph widths.
    this.ctx = ctx;
    // Light pools first (under the rings), then the beams.
    for (const gl of this.glows) {
      const a = Math.max(0, gl.life / (gl.maxLife || 0.9));
      const gg = ctx.createRadialGradient(gl.x, gl.y, 4, gl.x, gl.y, gl.r);
      gg.addColorStop(0, `rgba(255,220,130,${0.65 * a})`);
      gg.addColorStop(1, 'rgba(255,220,130,0)');
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(gl.x, gl.y, gl.r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const b of this.beams) {
      // Wide gold shaft (96 px) + a narrow white core, so the beam reads
      // as light even over a bright field — not just a faint wash.
      const a = Math.max(0, b.life / (b.maxLife || 1.4));
      const bg = ctx.createLinearGradient(b.x - 48, 0, b.x + 48, 0);
      bg.addColorStop(0, 'rgba(255,220,130,0)');
      bg.addColorStop(0.5, `rgba(255,220,130,${0.7 * a})`);
      bg.addColorStop(1, 'rgba(255,220,130,0)');
      ctx.fillStyle = bg;
      ctx.fillRect(b.x - 48, 0, 96, b.y);
      const core = ctx.createLinearGradient(b.x - 14, 0, b.x + 14, 0);
      core.addColorStop(0, 'rgba(255,255,255,0)');
      core.addColorStop(0.5, `rgba(255,255,240,${0.55 * a})`);
      core.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = core;
      ctx.fillRect(b.x - 14, 0, 28, b.y);
    }
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
