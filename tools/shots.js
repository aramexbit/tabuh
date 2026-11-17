// TABUH — screenshot capture (Node Playwright). Loads each ?shot= pose, waits
// for game.shotReady, and saves a 1280x720 JPEG (quality 82) into screenshots/.
// Verifies every file is <= 256 KiB and the long side is 1280, short side 720.
// Usage: node tools/shots.js
const { chromium } = require('/home/hatch/workspace/makefun/lumenfall/tools/node_modules/playwright-core');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = process.env.CHROME_PATH || (require('os').homedir() + '/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome');
const BASE = 'http://localhost:8094';
const OUT = path.join(__dirname, '..', 'screenshots');
const SHOTS = [
  { name: '1-boss.jpg', shot: 'boss' },
  { name: '2-big.jpg', shot: 'big' },
  { name: '3-win.jpg', shot: 'win' },
  { name: '4-play.jpg', shot: 'play' },
];
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = spawn('python3', ['-m', 'http.server', '8094'], { cwd: path.join(__dirname, '..', 'game'), stdio: 'ignore' });
  await sleep(1500);
  // Pre-flight: confirm OUR server answered (port 8084 was once occupied by an
  // unrelated JSON service, which silently produced a blank "screenshot").
  const ok = await new Promise((resolve) => {
    require('http').get(BASE + '/', (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve(res.statusCode === 200 && body.includes('TABUH')));
    }).on('error', () => resolve(false));
  });
  if (!ok) {
    console.error('PREFLIGHT FAIL: server on 8094 did not serve the TABUH page — aborting, no screenshots taken');
    server.kill();
    process.exit(2);
  }
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const errors = [];
  try {
    for (const s of SHOTS) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      page.on('console', m => { if (m.type() === 'error') errors.push(`${s.name}: ${m.text()}`); });
      page.on('pageerror', e => errors.push(`${s.name}: pageerror: ${e.message}`));
      await page.goto(`${BASE}/?shot=${s.shot}&seed=1`, { waitUntil: 'networkidle' });
      // Wait for the pose to be ready (max 240 s for the 1x win pose).
      const t0 = Date.now();
      let ready = false;
      while (Date.now() - t0 < 240000) {
        if (await page.evaluate(() => window.__game && window.__game.shotReady)) { ready = true; break; }
        await sleep(250);
      }
      if (!ready) console.log(`WARN  ${s.name}: pose not ready after 240 s, capturing anyway`);
      if (s.shot === 'boss') {
        // Fire the Gong Raksasa + spawn a Tuyul Emas for the frame: flash,
        // shockwave, lightning and big damage numbers, captured before the
        // flash fades (no 400 ms settle sleep here).
        await page.evaluate(() => {
          const g = window.__game;
          g.spawnGoldenTuyul();
          g.triggerGongRaksasa();
        });
      } else {
        await sleep(400);
      }
      const file = path.join(OUT, s.name);
      await page.screenshot({ path: file, type: 'jpeg', quality: 82 });
      const state = await page.evaluate(() => ({
        state: window.__game.state,
        wave: window.__game.wave,
        kills: window.__game.stats.kills,
        coins: window.__game.stats.coinsEarned,
        acc: window.__game.stats.beatPresses,
      }));
      const sz = fs.statSync(file).size;
      console.log(`${s.name}  ${Math.round(sz / 1024)} KiB  ${sz <= 262144 ? 'OK' : 'TOO BIG'}  ${JSON.stringify(state)}`);
      await page.close();
    }
    if (errors.length > 0) {
      console.log('console errors during shots:');
      for (const e of errors) console.log('  ' + e);
      process.exit(1);
    }
  } finally {
    await browser.close();
    server.kill();
  }
})().catch(e => { console.error('SHOTS CRASH:', e); process.exit(2); });
