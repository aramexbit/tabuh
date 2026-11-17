// Mouse + keyboard input. Coordinates are converted from client pixels to the
// game's logical 1280x720 space via the canvas bounding rect, so the layout
// scales with the window.
import { W, H, TOWER_ORDER } from './config.js';

function toLogical(game, clientX, clientY) {
  const rect = game.canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * W,
    y: ((clientY - rect.top) / rect.height) * H,
  };
}

export function attachInput(game) {
  const canvas = game.canvas;
  canvas.addEventListener('mousemove', (e) => {
    const p = toLogical(game, e.clientX, e.clientY);
    game.ui.hover = p;
  });
  canvas.addEventListener('mouseleave', () => {
    game.ui.hover = { x: -1, y: -1 };
  });
  canvas.addEventListener('mousedown', (e) => {
    game.audio.ensure();
    const p = toLogical(game, e.clientX, e.clientY);
    game.handleCanvasClick(p.x, p.y);
  });
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Space') {
      e.preventDefault();
      game.tabuh();
      return;
    }
    game.audio.ensure();
    const k = e.key.toLowerCase();
    if (k >= '1' && k <= '5') {
      const type = TOWER_ORDER[Number(k) - 1];
      if (type && game.state === 'playing') {
        game.selectedType = game.selectedType === type ? null : type;
        game.selectedTower = null;
      }
      return;
    }
    if (k === 'p') {
      if (game.state === 'playing') game.state = 'paused';
      else if (game.state === 'paused') game.state = 'playing';
      return;
    }
    if (k === 'm') {
      game.audio.setMuted(!game.audio.muted);
      return;
    }
    if (k === 'g') {
      game.triggerGongRaksasa();
      return;
    }
    if (k === 'r') {
      if (game.state === 'victory' || game.state === 'defeat' || game.state === 'paused') game.start();
      return;
    }
    if (k === 'escape') {
      if (game.state === 'howto') game.state = 'menu';
      else if (game.state === 'paused') game.state = 'playing';
      else if (game.state === 'playing') {
        game.selectedPad = null;
        game.selectedTower = null;
        game.selectedType = null;
      }
    }
  });
}
