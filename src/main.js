// TABUH bootstrap: fit the 1280x720 canvas to the window (kept 16:9), create
// the game, expose it for probes, and run the frame loop.
import { Game } from './game.js';
import { attachInput } from './input.js';
import { W, H } from './config.js';

const canvas = document.getElementById('game');

function resize() {
  const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width = `${Math.floor(W * scale)}px`;
  canvas.style.height = `${Math.floor(H * scale)}px`;
}
window.addEventListener('resize', resize);
resize();

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '1', 10) || 1;
const shot = params.get('shot');

const game = new Game(canvas, { seed, shot });
attachInput(game);
window.__game = game;

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  game.frame(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
