// HUD, menus and overlays — everything drawn on the canvas (one rendering path,
// so screenshots show exactly what the player sees). Buttons are hit-rects
// rebuilt every draw; input.js asks this module whether a click landed on one.
import { W, H, TOWERS, TOWER_ORDER, TOTAL_WAVES, RELICS, DIFFICULTIES, DIFF_KEYS, ENEMIES } from './config.js';
import { PADS } from './world.js';
import { waveDef } from './waves.js';
import { towerStats, upgradeCost, sellValue } from './towers.js';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class UI {
  constructor(game) {
    this.game = game;
    this.hit = []; // {id, x, y, w, h, circle?}
    this.hover = { x: -1, y: -1 };
  }

  // Register a clickable rect (or circle) for this frame.
  addHit(id, x, y, w, h, circle = false) {
    this.hit.push({ id, x, y, w, h, circle });
  }

  clickAt(x, y) {
    for (let i = this.hit.length - 1; i >= 0; i--) {
      const b = this.hit[i];
      if (b.circle) {
        const dx = x - (b.x + b.w / 2);
        const dy = y - (b.y + b.h / 2);
        if (dx * dx + dy * dy <= (b.w / 2) * (b.w / 2)) return b.id;
      } else if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        return b.id;
      }
    }
    return null;
  }

  draw(ctx) {
    const g = this.game;
    this.hit = [];
    if (g.state === 'menu') this.drawMenu(ctx);
    else if (g.state === 'howto') this.drawHowto(ctx);
    else {
      this.drawHud(ctx);
      if (g.state === 'paused') this.drawPaused(ctx);
      else if (g.state === 'victory') this.drawEnd(ctx, true);
      else if (g.state === 'defeat') this.drawEnd(ctx, false);
      else if (g.selectedPad !== null || g.selectedTower) this.drawPadPanel(ctx);
    }
  }

  panel(ctx, x, y, w, h, alpha = 0.88) {
    ctx.fillStyle = `rgba(10,18,30,${alpha})`;
    rr(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(232,182,76,0.55)';
    ctx.lineWidth = 1.5;
    rr(ctx, x, y, w, h, 14);
    ctx.stroke();
  }

  button(ctx, id, x, y, w, h, label, opts = {}) {
    const hov = this.hover.x >= x && this.hover.x <= x + w && this.hover.y >= y && this.hover.y <= y + h;
    const dis = opts.disabled;
    ctx.fillStyle = dis ? 'rgba(60,66,80,0.8)' : hov ? '#8a6a2a' : '#6b5222';
    rr(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = dis ? 'rgba(150,150,150,0.4)' : '#e8b64c';
    ctx.lineWidth = 1.5;
    rr(ctx, x, y, w, h, 10);
    ctx.stroke();
    ctx.fillStyle = dis ? '#9aa0ae' : '#ffe9a8';
    ctx.font = `bold ${opts.size || 16}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2 + 1);
    if (!dis) this.addHit(id, x, y, w, h);
    return { x, y, w, h };
  }

  drawMenu(ctx) {
    const g = this.game;
    // Decorative towers on the field behind the title.
    const deco = [
      { type: 'gong', padIndex: 0, level: 1, x: 1150, y: 195, cooldown: 0, flash: 0, angle: 0 },
      { type: 'bonang', padIndex: 3, level: 2, x: 890, y: 345, cooldown: 0, flash: 0, angle: 0 },
      { type: 'kendang', padIndex: 6, level: 1, x: 400, y: 438, cooldown: 0, flash: 0, angle: 0 },
    ];
    for (const t of deco) g.drawTowerOnly(ctx, t);
    ctx.fillStyle = 'rgba(6,12,22,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f5c542';
    ctx.font = 'bold 96px Georgia, serif';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 8;
    ctx.strokeText('TABUH', W / 2, 190);
    ctx.fillText('TABUH', W / 2, 190);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 28px Georgia, serif';
    ctx.fillText('— Gamelan Defense —', W / 2, 238);
    ctx.fillStyle = '#cfe8dd';
    ctx.font = '18px sans-serif';
    ctx.fillText('Desa diserang roh saat senja. Bangun gamelan perunggu, tabuh tepat di ketuk,', W / 2, 282);
    ctx.fillText('dan selamatkan desa sampai malam kesepuluh.', W / 2, 308);
    this.button(ctx, 'play', W / 2 - 130, 350, 260, 56, '▶  MAIN', { size: 22 });
    this.button(ctx, 'howto', W / 2 - 130, 420, 260, 48, 'Cara Main', { size: 18 });
    // Difficulty selector (the Play button above never moves).
    ctx.fillStyle = '#cfe8dd';
    ctx.font = '15px sans-serif';
    ctx.fillText('— Kesulitan —', W / 2, 486);
    const dw = 110, dh = 30, dy = 494;
    DIFF_KEYS.forEach((key, i) => {
      const dx = W / 2 - 175 + i * 120;
      const sel = g.difficulty === key;
      ctx.fillStyle = sel ? '#8a6a2a' : '#232c3d';
      rr(ctx, dx, dy, dw, dh, 9);
      ctx.fill();
      ctx.strokeStyle = sel ? '#ffd76a' : 'rgba(232,182,76,0.4)';
      ctx.lineWidth = sel ? 2.5 : 1.5;
      rr(ctx, dx, dy, dw, dh, 9);
      ctx.stroke();
      ctx.fillStyle = sel ? '#ffe9a8' : '#cfe8dd';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(DIFFICULTIES[key].name, dx + dw / 2, dy + dh / 2 + 1);
      this.addHit('diff:' + key, dx, dy, dw, dh);
    });
    const best = g.best;
    if (best && best.wave > 0) {
      ctx.fillStyle = '#9db8e8';
      ctx.font = '16px sans-serif';
      ctx.fillText(`Rekor: Malam ${best.wave}/10 • ${best.kills} roh dikalahkan`, W / 2, 546);
    }
    ctx.fillStyle = 'rgba(207,232,221,0.7)';
    ctx.font = '14px sans-serif';
    ctx.fillText('Mouse + keyboard • Offline penuh • Musik gamelan prosedural', W / 2, 574);
    ctx.textBaseline = 'alphabetic';
  }

  drawHowto(ctx) {
    const g = this.game;
    this.panel(ctx, W / 2 - 340, 60, 680, 610);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f5c542';
    ctx.font = 'bold 30px Georgia, serif';
    ctx.fillText('Cara Main', W / 2, 108);
    ctx.fillStyle = '#e8e2d0';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'left';
    const lines = [
      '1. Klik sebuah pad batu, lalu pilih instrumen (atau tekan 1–5) untuk',
      '    membangunnya. Instrumen menyerang roh yang lewat di jalurnya.',
      '2. Tekan SPASI (atau klik gendang TABUH) tepat saat penanda sampai',
      '    di tengah garis ketuk. Perfect / Good menaikkan kombo — kombo',
      '    melipatgandakan damage semua menara. Meleset = kombo putus.',
      '3. Klik menara yang sudah dibangun untuk upgrade, perbaiki, atau jual.',
      '4. Tekan MULAI MALAM untuk memulai gelombang berikutnya. Roh yang',
      '    sampai ke gerbang desa mengurangi HP gerbang. Gerbang jatuh = kalah.',
      '5. Bertahanlah 10 malam untuk menang — lalu lanjut Endless bila mau.',
      '6. Hantu menyerang balik! Kuntilanak menyetrum menara, Tuyul mencuri',
      '    koin, Pocong membungkus menara, Genderuwo & Buto menghantamnya.',
      '    Menara rusak: perbaiki di panelnya; bila hancur, bangun ulang',
      '    (50% biaya kembali). Koin didapat dari TABUH dan kill.',
      '7. Daya tahan ikut harga (Gong terkuat, Saron terrapuh) — tidak ada',
      '    menara yang kebal; boss bisa menghancurkan gong sekalipun.',
      '8. Pocong kebal lambat Kendang; Kuntilanak kebal sebagian dari Saron.',
      '9. Gerbang rusak? Klik Perbaiki di atas (◆100, +5 HP) selama bermain.',
      '',
      'Instrumen:',
      '  Saron (50) — cepat, satu sasaran.   Kendang (70) — melambatkan roh.',
      '  Bonang (100) — damage area kecil.   Kenong (150) — jauh dan kuat.',
      '  Gong (250) — gema besar + setrum.',
      '',
      'Kontrol: 1–5 pilih instrumen • Spasi tabuh • P jeda • M bisu • R ulang',
    ];
    let y = 140;
    for (const ln of lines) {
      ctx.fillText(ln, W / 2 - 310, y);
      y += 21;
    }
    this.button(ctx, 'back-menu', W / 2 - 110, 612, 220, 48, 'Kembali', { size: 18 });
    ctx.textBaseline = 'alphabetic';
  }

  drawHud(ctx) {
    const g = this.game;
    // Top bar.
    ctx.fillStyle = 'rgba(8,14,26,0.82)';
    ctx.fillRect(0, 0, W, 46);
    ctx.fillStyle = '#e8b64c';
    ctx.fillRect(0, 46, W, 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 19px sans-serif';
    ctx.fillText(g.endless ? `Malam ${g.wave} ∞` : `Malam ${Math.min(g.wave, TOTAL_WAVES)}/${TOTAL_WAVES}`, 16, 24);
    ctx.fillStyle = '#cfe8dd';
    ctx.font = '16px sans-serif';
    const left = g.enemies.length + g.spawner.remaining;
    ctx.fillText(`Roh tersisa: ${g.phase === 'build' ? '—' : left}`, 170, 24);
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 19px sans-serif';
    ctx.fillText(`◆ ${g.coins}`, 340, 24);
    // Gate HP.
    ctx.fillStyle = '#cfe8dd';
    ctx.font = '16px sans-serif';
    ctx.fillText('Gerbang', 470, 24);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(545, 14, 110, 18);
    ctx.fillStyle = g.gateHp > 10 ? '#7fe3a8' : g.gateHp > 5 ? '#ffd76a' : '#ff7a6a';
    ctx.fillRect(545, 14, 110 * Math.max(0, g.gateHp / g.gateMaxHp), 18);
    ctx.strokeStyle = '#e8b64c';
    ctx.lineWidth = 1;
    ctx.strokeRect(545, 14, 110, 18);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${g.gateHp}/${g.gateMaxHp}`, 600, 24);
    ctx.textAlign = 'left';
    if (g.gateHp < g.gateMaxHp) {
      const rc = g.repairCost();
      this.button(ctx, 'repair', 665, 12, 88, 20, `Perbaiki ◆${rc}`, { disabled: g.coins < rc, size: 12 });
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = '#9db8e8';
    ctx.font = '15px sans-serif';
    ctx.fillText(`Roh dikalahkan: ${g.stats.kills}`, 900, 24);
    ctx.fillText(`Kombo x${g.comboMult().toFixed(2)}`, 1058, 24);
    // Combo grade letter (S/A/B/C), colored, beside the multiplier.
    const grade = g.comboGrade();
    ctx.fillStyle = grade === 'S' ? '#ffd76a' : grade === 'A' ? '#7fe3a8' : grade === 'B' ? '#9db8e8' : grade === 'C' ? '#cfe8dd' : '#8a94a8';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(grade, 1064, 24);
    ctx.textAlign = 'right';
    this.button(ctx, 'mute', 1120, 8, 62, 30, g.audio.muted ? '🔇' : '🔊', { size: 15 });
    this.button(ctx, 'pause', 1190, 8, 62, 30, 'II', { size: 15 });
    ctx.textAlign = 'left';
    // Boss bar + side panels (over the scene, never over pads or the pad panel).
    if (g.boss) this.drawBossBar(ctx);
    this.drawIncoming(ctx);
    this.drawRelics(ctx);
    // Bottom bar.
    ctx.fillStyle = 'rgba(8,14,26,0.86)';
    ctx.fillRect(0, H - 102, W, 102);
    ctx.fillStyle = '#e8b64c';
    ctx.fillRect(0, H - 102, W, 2);
    // Tower cards.
    let cx = 10;
    for (const type of TOWER_ORDER) {
      const def = TOWERS[type];
      const afford = g.coins >= def.cost;
      const sel = g.selectedType === type;
      ctx.fillStyle = sel ? '#6b5222' : afford ? '#232c3d' : '#1a2029';
      rr(ctx, cx, H - 94, 92, 86, 10);
      ctx.fill();
      ctx.strokeStyle = sel ? '#ffd76a' : afford ? '#e8b64c' : 'rgba(150,150,150,0.35)';
      ctx.lineWidth = sel ? 2.5 : 1.5;
      rr(ctx, cx, H - 94, 92, 86, 10);
      ctx.stroke();
      ctx.fillStyle = afford || sel ? def.color : '#7a7f8a';
      ctx.beginPath();
      ctx.arc(cx + 46, H - 70, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0b1020';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(def.key, cx + 46, H - 66);
      ctx.fillStyle = afford || sel ? '#ffe9a8' : '#7a7f8a';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(def.name, cx + 46, H - 44);
      ctx.fillStyle = afford || sel ? '#ffd76a' : '#7a7f8a';
      ctx.font = '13px sans-serif';
      ctx.fillText(`◆ ${def.cost}`, cx + 46, H - 24);
      this.addHit('tower:' + type, cx, H - 94, 92, 86);
      cx += 98;
    }
    // Beat bar (center).
    const bx = 510, bw = 350, by = H - 82;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    rr(ctx, bx, by, bw, 30, 8);
    ctx.fill();
    // Hit zone.
    ctx.fillStyle = 'rgba(127,227,168,0.35)';
    ctx.fillRect(bx + bw / 2 - 26, by, 52, 30);
    ctx.fillStyle = 'rgba(127,227,168,0.7)';
    ctx.fillRect(bx + bw / 2 - 10, by, 20, 30);
    // Moving marker: at the beat instant it sits in the middle of the bar
    // (phase 0 -> center), so "press when the marker is centered" matches
    // the game's timing windows.
    const ph = g.beatPhase();
    const mx = bx + ((ph + 0.5) % 1) * bw;
    ctx.fillStyle = '#ffd76a';
    ctx.fillRect(mx - 2, by - 4, 4, 38);
    ctx.beginPath();
    ctx.arc(mx, by - 4, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#cfe8dd';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('KETUK — tekan Spasi saat penanda di tengah', bx + bw / 2, by + 48);
    // Combo text + big grade letter beside it.
    ctx.fillStyle = g.combo > 0 ? '#ffd76a' : '#8a94a8';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(g.combo > 0 ? `Kombo ${g.combo}  •  x${g.comboMult().toFixed(2)}` : 'Kombo 0', bx + bw / 2, by + 70);
    const gb = g.comboGrade();
    if (gb !== '—') {
      ctx.fillStyle = gb === 'S' ? '#ffd76a' : gb === 'A' ? '#7fe3a8' : gb === 'B' ? '#9db8e8' : '#cfe8dd';
      ctx.font = 'bold 34px Georgia, serif';
      ctx.textAlign = 'left';
      ctx.fillText(gb, bx + bw / 2 + 112, by + 72);
      ctx.textAlign = 'center';
    }
    // TABUH drum button.
    const tx = 930, ty = H - 52;
    const hov = Math.hypot(this.hover.x - tx, this.hover.y - ty) <= 44;
    const dg = ctx.createRadialGradient(tx - 10, ty - 12, 4, tx, ty, 46);
    dg.addColorStop(0, hov ? '#f0d060' : '#c97b3d');
    dg.addColorStop(1, '#7a4a1e');
    ctx.fillStyle = dg;
    ctx.beginPath();
    ctx.arc(tx, ty, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(tx, ty, 42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('TABUH', tx, ty + 1);
    ctx.fillStyle = '#e8d9b0';
    ctx.font = '11px sans-serif';
    ctx.fillText('Spasi', tx, ty + 16);
    this.addHit('tabuh', tx - 42, ty - 42, 84, 84, true);
    // Wave button.
    const waveReady = g.phase === 'build' && (g.state === 'playing');
    this.button(ctx, 'wave', 1010, H - 88, 150, 42,
      g.phase === 'build' ? `Mulai Malam ${g.wave}` : `Malam ${g.wave}…`,
      { disabled: !waveReady, size: 16 });
    ctx.fillStyle = '#cfe8dd';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(g.phase === 'build' ? 'Bangun dulu, lalu mulai' : 'Gelombang berjalan…', 1085, H - 24);
    this.button(ctx, 'restart', 1170, H - 88, 96, 42, 'Ulang', { size: 15 });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // Boss bar: big gold-framed red bar under the top bar, with the boss name
  // and skulls. Only while a Raja is alive.
  drawBossBar(ctx) {
    const g = this.game;
    const b = g.boss;
    if (!b) return;
    const pct = Math.max(0, b.hp / b.maxHp);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ff9a3d';
    ctx.font = 'bold 21px Georgia, serif';
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = 5;
    ctx.strokeText('RAJA BUTO IJO', W / 2, 64);
    ctx.fillText('RAJA BUTO IJO', W / 2, 64);
    const bx = 430, bw = 420, by = 76, bh = 18;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    rr(ctx, bx - 3, by - 3, bw + 6, bh + 6, 9);
    ctx.fill();
    ctx.strokeStyle = '#e8b64c';
    ctx.lineWidth = 2;
    rr(ctx, bx - 3, by - 3, bw + 6, bh + 6, 9);
    ctx.stroke();
    ctx.fillStyle = '#5a0f0f';
    ctx.fillRect(bx, by, bw, bh);
    const grad = ctx.createLinearGradient(bx, by, bx, by + bh);
    grad.addColorStop(0, '#ff7a5c');
    grad.addColorStop(0.5, '#e5322d');
    grad.addColorStop(1, '#8f130f');
    ctx.fillStyle = grad;
    ctx.fillRect(bx, by, bw * pct, bh);
    // Skulls flanking the bar (drawn shapes, no font glyphs).
    for (const sx of [bx - 16, bx + bw + 16]) {
      ctx.fillStyle = '#f5f2e8';
      ctx.beginPath();
      ctx.arc(sx, by + bh / 2, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0b1020';
      ctx.beginPath();
      ctx.arc(sx - 2.5, by + bh / 2 - 1, 1.4, 0, Math.PI * 2);
      ctx.arc(sx + 2.5, by + bh / 2 - 1, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`HP ${Math.max(0, Math.ceil(b.hp))} / ${b.maxHp}`, W / 2, by + bh / 2 + 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
  }

  // DATANG: threat queue for the running wave (alive + still queued), or the
  // next wave's composition during the build phase — like the top-10 boards.
  drawIncoming(ctx) {
    const g = this.game;
    const ORDER = ['wisik', 'kunang', 'bayang', 'slira', 'raksasa', 'raja'];
    const counts = new Map();
    if (g.phase === 'wave') {
      for (const e of g.enemies) counts.set(e.type, (counts.get(e.type) || 0) + 1);
      for (const q of g.spawner.queue) counts.set(q.type, (counts.get(q.type) || 0) + 1);
    } else {
      for (const grp of waveDef(g.wave).groups) {
        counts.set(grp.type, (counts.get(grp.type) || 0) + grp.count);
      }
    }
    const rows = ORDER.filter((t) => counts.get(t) > 0);
    const GHOST_POWER = {
      wisik: 'Tawa: setrum menara 2 ketuk',
      kunang: 'Mencuri 3 koin',
      bayang: 'Kafan: serang -75% 4 ketuk',
      slira: 'Pukulan: -18 daya tahan',
      raksasa: 'Hantaman: -30 daya tahan',
      raja: 'Hantaman: -45 daya tahan',
    };
    const x = 12, y = 260, w = 200;
    const h = 36 + rows.length * 30 + 50;
    this.panel(ctx, x, y, w, h, 1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f5c542';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText('DATANG', x + w / 2, y + 18);
    ctx.textAlign = 'left';
    let ry = y + 40;
    for (const t of rows) {
      const def = ENEMIES[t];
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(x + 22, ry, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0b1020';
      ctx.beginPath();
      ctx.arc(x + 19, ry - 1, 1.6, 0, Math.PI * 2);
      ctx.arc(x + 25, ry - 1, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8e2d0';
      ctx.font = '15px sans-serif';
      ctx.fillText(def.name, x + 36, ry);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffe9a8';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(String(counts.get(t)), x + w - 14, ry);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#9db8e8';
      ctx.font = '11px sans-serif';
      ctx.fillText(GHOST_POWER[t], x + 36, ry + 12);
      ry += 30;
    }
    // Wave progress bar.
    const prog = g.waveTotal > 0 && g.phase === 'wave'
      ? Math.min(1, (g.stats.kills - g.waveStartKills) / g.waveTotal) : 0;
    ctx.fillStyle = '#cfe8dd';
    ctx.font = '13px sans-serif';
    ctx.fillText(g.endless ? `Malam ${g.wave} ∞` : `Malam ${g.wave}/${TOTAL_WAVES}`, x + 14, ry + 12);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x + 14, ry + 22, w - 28, 8);
    ctx.fillStyle = '#7fe3a8';
    ctx.fillRect(x + 14, ry + 22, (w - 28) * prog, 8);
    ctx.textBaseline = 'middle';
  }

  // PUSAKA: four relic medallions, top right. Earned ones glow gold.
  drawRelics(ctx) {
    const g = this.game;
    const x = 1064, y = 56, w = 204, h = 92;
    this.panel(ctx, x, y, w, h, 1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f5c542';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('PUSAKA', x + w / 2, y + 17);
    const cy = y + 56;
    RELICS.forEach((r, i) => {
      const cx = x + 32 + i * 48;
      const lit = g.relics.has(r.key);
      ctx.beginPath();
      ctx.arc(cx, cy, 19, 0, Math.PI * 2);
      ctx.fillStyle = lit ? '#6b5222' : 'rgba(30,36,48,0.9)';
      ctx.fill();
      ctx.strokeStyle = lit ? '#ffd76a' : 'rgba(150,150,150,0.4)';
      ctx.lineWidth = lit ? 2.5 : 1.5;
      ctx.stroke();
      if (lit) {
        ctx.shadowColor = '#ffd76a';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(cx, cy, 19, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      this.drawRelicGlyph(ctx, r.key, cx, cy, lit ? '#ffd76a' : '#7a7f8a');
    });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
  }

  drawRelicGlyph(ctx, key, x, y, color) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    if (key === 'keris') {
      ctx.beginPath();
      ctx.moveTo(x - 9, y + 9);
      ctx.quadraticCurveTo(x - 2, y + 2, x + 2, y - 2);
      ctx.quadraticCurveTo(x + 6, y - 6, x + 10, y - 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 11, y + 5);
      ctx.lineTo(x - 5, y + 11);
      ctx.stroke();
    } else if (key === 'gong') {
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (key === 'kendi') {
      ctx.beginPath();
      ctx.ellipse(x, y + 2, 7, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 3, y - 5);
      ctx.lineTo(x + 3, y - 5);
      ctx.lineTo(x + 2, y - 10);
      ctx.lineTo(x - 2, y - 10);
      ctx.closePath();
      ctx.stroke();
    } else {
      // Jimat: diamond amulet.
      ctx.beginPath();
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x + 7, y);
      ctx.lineTo(x, y + 10);
      ctx.lineTo(x - 7, y);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawPadPanel(ctx) {
    const g = this.game;
    // Flip the panel to the left when the selected pad is on the right half,
    // so it never covers the tower it describes or its range circle.
    const padIndex = g.selectedTower ? g.selectedTower.padIndex : g.selectedPad;
    const padX = padIndex !== null && PADS[padIndex] ? PADS[padIndex].x : 0;
    const px = padX > 640 ? 12 : 880, py = 56, pw = 388, ph = 196;
    this.panel(ctx, px, py, pw, ph);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if (g.selectedTower) {
      const t = g.selectedTower;
      const def = TOWERS[t.type];
      const stats = towerStats(t);
      ctx.fillStyle = '#f5c542';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(`${def.name}  •  Level ${t.level}`, px + 16, py + 26);
      ctx.fillStyle = '#e8e2d0';
      ctx.font = '14px sans-serif';
      ctx.fillText(`Damage ${stats.dmg}  •  Jangkauan ${stats.range}  •  Tiap ${stats.beatsPerShot} ketuk`, px + 16, py + 52);
      ctx.fillText(def.desc, px + 16, py + 74);
      const up = upgradeCost(t);
      if (up !== null) {
        this.button(ctx, 'upgrade', px + 16, py + 96, 170, 38, `Upgrade ◆ ${up}`, { disabled: g.coins < up, size: 15 });
      } else {
        ctx.fillStyle = '#9db8e8';
        ctx.font = '14px sans-serif';
        ctx.fillText('Level maksimal.', px + 16, py + 115);
      }
      this.button(ctx, 'sell', px + 200, py + 96, 90, 38, `Jual ◆ ${sellValue(t)}`, { size: 15 });
      this.button(ctx, 'close-panel', px + 304, py + 96, 68, 38, 'Tutup', { size: 15 });
      // Repair row (only when chipped): cost scales with the missing part.
      if (t.durability < t.maxDurability) {
        const rc = g.repairTowerCost(t);
        const pct = Math.round((t.durability / t.maxDurability) * 100);
        ctx.fillStyle = pct > 50 ? '#7fe3a8' : pct > 25 ? '#ffd76a' : '#ff7a6a';
        ctx.font = '14px sans-serif';
        ctx.fillText(`Daya tahan: ${pct}%`, px + 16, py + 164);
        this.button(ctx, 'repair-tower', px + 200, py + 144, 172, 38, `Perbaiki ◆ ${rc}`, { disabled: g.coins < rc, size: 15 });
      }
    } else if (g.selectedPad !== null) {
      ctx.fillStyle = '#f5c542';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('Pad kosong — pilih instrumen', px + 16, py + 26);
      ctx.fillStyle = '#e8e2d0';
      ctx.font = '14px sans-serif';
      ctx.fillText('Klik kartu instrumen di bawah (atau tekan 1–5),', px + 16, py + 52);
      ctx.fillText('lalu klik pad ini untuk membangun.', px + 16, py + 74);
      this.button(ctx, 'close-panel', px + 16, py + 96, 110, 38, 'Tutup', { size: 15 });
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  drawPaused(ctx) {
    ctx.fillStyle = 'rgba(6,12,22,0.6)';
    ctx.fillRect(0, 0, W, H);
    this.panel(ctx, W / 2 - 220, 200, 440, 300);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f5c542';
    ctx.font = 'bold 34px Georgia, serif';
    ctx.fillText('Jeda', W / 2, 252);
    this.button(ctx, 'resume', W / 2 - 110, 290, 220, 48, 'Lanjutkan', { size: 18 });
    this.button(ctx, 'restart', W / 2 - 110, 350, 220, 48, 'Mulai Ulang', { size: 18 });
    this.button(ctx, 'quit-menu', W / 2 - 110, 410, 220, 48, 'Menu Utama', { size: 18 });
    ctx.textBaseline = 'alphabetic';
  }

  drawEnd(ctx, won) {
    const g = this.game;
    const s = g.stats;
    const acc = s.beatPresses > 0 ? Math.round(((s.perfectHits + s.goodHits) / s.beatPresses) * 100) : 0;
    ctx.fillStyle = 'rgba(6,12,22,0.65)';
    ctx.fillRect(0, 0, W, H);
    this.panel(ctx, W / 2 - 280, 130, 560, 440);
    ctx.textAlign = 'center';
    ctx.fillStyle = won ? '#7fe3a8' : '#ff9a7a';
    ctx.font = 'bold 44px Georgia, serif';
    ctx.fillText(won ? 'DESA SELAMAT!' : 'GERBANG JATUH', W / 2, 196);
    ctx.fillStyle = '#e8e2d0';
    ctx.font = '17px sans-serif';
    ctx.fillText(won
      ? 'Sepuluh malam berlalu. Gamelan berhenti, desa kembali tenang.'
      : `Roh menembus gerbang pada malam ${g.wave}. Desa butuh penjaga yang lebih baik.`, W / 2, 232);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 18px sans-serif';
    const rows = [
      `Malam diselesaikan: ${won ? TOTAL_WAVES : g.wave - 1}${g.endless ? ' (Endless)' : ` / ${TOTAL_WAVES}`}`,
      `Roh dikalahkan: ${s.kills}`,
      `Koin didapat: ${s.coinsEarned}`,
      `Akurasi ketuk: ${acc}%  (Perfect ${s.perfectHits} • Good ${s.goodHits} • Meleset ${s.misses})`,
      `Kombo tertinggi: ${s.maxCombo}`,
      `Waktu: ${Math.floor(s.timeSec / 60)}:${String(Math.floor(s.timeSec % 60)).padStart(2, '0')}`,
    ];
    let y = 282;
    for (const r of rows) {
      ctx.fillText(r, W / 2, y);
      y += 30;
    }
    this.button(ctx, 'restart', W / 2 - 230, 480, 220, 50, 'Main Lagi', { size: 18 });
    this.button(ctx, 'quit-menu', W / 2 + 10, 480, 220, 50, 'Menu Utama', { size: 18 });
    if (won && !g.endless) {
      this.button(ctx, 'endless', W / 2 - 230, 538, 460, 28, 'Lanjut Endless  →', { size: 15 });
    }
    ctx.textBaseline = 'alphabetic';
  }
}
