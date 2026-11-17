// HUD, menus and overlays — everything drawn on the canvas (one rendering path,
// so screenshots show exactly what the player sees). Buttons are hit-rects
// rebuilt every draw; input.js asks this module whether a click landed on one.
import { W, H, TOWERS, TOWER_ORDER, TOTAL_WAVES } from './config.js';
import { PADS } from './world.js';
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
    const best = g.best;
    if (best && best.wave > 0) {
      ctx.fillStyle = '#9db8e8';
      ctx.font = '16px sans-serif';
      ctx.fillText(`Rekor: Malam ${best.wave}/10 • ${best.kills} roh dikalahkan`, W / 2, 508);
    }
    ctx.fillStyle = 'rgba(207,232,221,0.7)';
    ctx.font = '14px sans-serif';
    ctx.fillText('Mouse + keyboard • Offline penuh • Musik gamelan prosedural', W / 2, 560);
    ctx.textBaseline = 'alphabetic';
  }

  drawHowto(ctx) {
    const g = this.game;
    this.panel(ctx, W / 2 - 340, 70, 680, 580);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f5c542';
    ctx.font = 'bold 30px Georgia, serif';
    ctx.fillText('Cara Main', W / 2, 118);
    ctx.fillStyle = '#e8e2d0';
    ctx.font = '17px sans-serif';
    ctx.textAlign = 'left';
    const lines = [
      '1. Klik sebuah pad batu, lalu pilih instrumen (atau tekan 1–5) untuk',
      '    membangunnya. Instrumen menyerang roh yang lewat di jalurnya.',
      '2. Tekan SPASI (atau klik gendang TABUH) tepat saat penanda sampai',
      '    di tengah garis ketuk. Perfect / Good menaikkan kombo — kombo',
      '    melipatgandakan damage semua menara. Meleset = kombo putus.',
      '3. Klik menara yang sudah dibangun untuk upgrade atau menjualnya.',
      '4. Tekan MULAI MALAM untuk memulai gelombang berikutnya. Roh yang',
      '    sampai ke gerbang desa mengurangi HP gerbang. Gerbang jatuh = kalah.',
      '5. Bertahanlah 10 malam untuk menang.',
      '6. Gerbang rusak? Klik Perbaiki di atas (◆100, +5 HP) selama bermain.',
      '',
      'Instrumen:',
      '  Saron (50) — cepat, satu sasaran.   Kendang (70) — melambatkan roh.',
      '  Bonang (100) — damage area kecil.   Kenong (150) — jauh dan kuat.',
      '  Gong (250) — gema besar + setrum.',
      '',
      'Kontrol: 1–5 pilih instrumen • Spasi tabuh • P jeda • M bisu • R ulang',
    ];
    let y = 152;
    for (const ln of lines) {
      ctx.fillText(ln, W / 2 - 310, y);
      y += 24;
    }
    this.button(ctx, 'back-menu', W / 2 - 110, 578, 220, 48, 'Kembali', { size: 18 });
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
    ctx.fillText(`Malam ${Math.min(g.wave, TOTAL_WAVES)}/${TOTAL_WAVES}`, 16, 24);
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
      this.button(ctx, 'repair', 665, 12, 88, 20, 'Perbaiki ◆100', { disabled: g.coins < 100, size: 12 });
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = '#9db8e8';
    ctx.font = '15px sans-serif';
    ctx.fillText(`Roh dikalahkan: ${g.stats.kills}`, 900, 24);
    ctx.fillText(`Kombo x${g.comboMult().toFixed(2)}`, 1080, 24);
    this.button(ctx, 'mute', 1120, 8, 62, 30, g.audio.muted ? '🔇' : '🔊', { size: 15 });
    this.button(ctx, 'pause', 1190, 8, 62, 30, 'II', { size: 15 });
    ctx.textAlign = 'left';
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
    // Combo text.
    ctx.fillStyle = g.combo > 0 ? '#ffd76a' : '#8a94a8';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(g.combo > 0 ? `Kombo ${g.combo}  •  x${g.comboMult().toFixed(2)}` : 'Kombo 0', bx + bw / 2, by + 70);
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

  drawPadPanel(ctx) {
    const g = this.game;
    // Flip the panel to the left when the selected pad is on the right half,
    // so it never covers the tower it describes or its range circle.
    const padIndex = g.selectedTower ? g.selectedTower.padIndex : g.selectedPad;
    const padX = padIndex !== null && PADS[padIndex] ? PADS[padIndex].x : 0;
    const px = padX > 640 ? 12 : 880, py = 56, pw = 388, ph = 148;
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
      `Malam diselesaikan: ${won ? TOTAL_WAVES : g.wave - 1} / ${TOTAL_WAVES}`,
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
    ctx.textBaseline = 'alphabetic';
  }
}
