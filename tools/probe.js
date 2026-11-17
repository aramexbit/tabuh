// TABUH — headless QA probe (Node Playwright). Starts its own server on 8083
// serving game/, drives the game through window.__game + real clicks/keys,
// and reports PASS/FAIL per check. Usage: node tools/probe.js [--shots-only]
const { chromium } = require('/home/hatch/workspace/makefun/lumenfall/tools/node_modules/playwright-core');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = process.env.CHROME_PATH || (require('os').homedir() + '/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome');
const BASE = 'http://localhost:8083';
const results = [];
let errors = [], failedReqs = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function newPage(browser, url) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', r => failedReqs.push(r.url() + ' :: ' + (r.failure() || {}).errorText));
  await page.goto(url, { waitUntil: 'networkidle' });
  await sleep(900);
  return page;
}
async function waitFor(page, fn, timeout = 30000, interval = 200) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await page.evaluate(fn)) return true;
    await sleep(interval);
  }
  return false;
}
// Press Space exactly when the beat marker is centered (phase near 0/1).
async function tabuhOnBeat(page) {
  const ok = await waitFor(page, () => {
    const g = window.__game;
    const ph = g.beatPhase();
    return ph < 0.05 || ph > 0.95;
  }, 5000, 40);
  if (!ok) return false;
  await page.keyboard.press('Space');
  return true;
}

(async () => {
  const server = spawn('python3', ['-m', 'http.server', '8083'], { cwd: path.join(__dirname, '..', 'game'), stdio: 'ignore' });
  await sleep(1500);
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  try {
    // ---------- load + menu ----------
    let page = await newPage(browser, BASE + '/');
    check('page loads, menu state', await page.evaluate(() => window.__game && window.__game.state === 'menu'));
    check('no console errors on load', errors.length === 0, errors.slice(0, 3).join(' | '));
    check('no failed requests', failedReqs.length === 0, failedReqs.slice(0, 3).join(' | '));
    check('canvas 1280x720', await page.evaluate(() => { const c = document.getElementById('game'); return c.width === 1280 && c.height === 720; }));

    // ---------- start game via real click on the Play button ----------
    await page.mouse.click(640, 378); // Play button (W/2-130..W/2+130, 350..406)
    await sleep(400);
    check('Play starts game (build phase)', await page.evaluate(() => window.__game.state === 'playing' && window.__game.phase === 'build'));
    check('start coins 150', await page.evaluate(() => window.__game.coins === 150));
    check('gate HP 20/20', await page.evaluate(() => window.__game.gateHp === 20));

    // ---------- build a tower via real clicks ----------
    await page.mouse.click(56, 670); // saron card (10..102, 626..712)
    await sleep(200);
    await page.mouse.click(920, 138); // pad 2
    await sleep(300);
    check('saron built on pad (coins 100)', await page.evaluate(() => window.__game.towers.length === 1 && window.__game.towers[0].type === 'saron' && window.__game.coins === 100));
    // Click the built tower -> upgrade panel appears.
    await page.mouse.click(920, 138);
    await sleep(200);
    check('tower selected, panel open', await page.evaluate(() => window.__game.selectedTower && window.__game.selectedTower.type === 'saron'));
    // Upgrade via panel button (880+16..1050, 152..190 in logical coords).
    await page.mouse.click(970, 171);
    await sleep(200);
    check('upgrade to level 2 (coins 70)', await page.evaluate(() => window.__game.towers[0].level === 2 && window.__game.coins === 70));

    // ---------- tabuh timing ----------
    const before = await page.evaluate(() => ({ combo: window.__game.combo, presses: window.__game.stats.beatPresses }));
    const pressed = await tabuhOnBeat(page);
    await sleep(150);
    const after = await page.evaluate(() => ({ combo: window.__game.combo, perfect: window.__game.stats.perfectHits, good: window.__game.stats.goodHits }));
    check('tabuh on beat raises combo', pressed && after.combo === before.combo + 1 && (after.perfect + after.good) > 0,
      `pressed=${pressed} combo ${before.combo}->${after.combo} perfect=${after.perfect} good=${after.good}`);

    // ---------- wave 1: start, spawn, kill, clear ----------
    await page.mouse.click(1085, 654); // "Mulai Malam 1" button (1010..1160, 632..674)
    await sleep(300);
    check('wave 1 starts', await page.evaluate(() => window.__game.phase === 'wave' && window.__game.wave === 1));
    const spawned = await waitFor(page, () => window.__game.enemies.length > 0, 10000);
    check('enemies spawn', spawned);
    const cleared = await waitFor(page, () => window.__game.phase === 'build' && window.__game.wave === 2, 60000);
    check('wave 1 cleared, wave 2 build phase', cleared,
      await page.evaluate(() => `wave=${window.__game.wave} phase=${window.__game.phase} kills=${window.__game.stats.kills} coins=${window.__game.coins} gate=${window.__game.gateHp}`));
    check('kills counted, coins grew', await page.evaluate(() => window.__game.stats.kills >= 6 && window.__game.coins > 70));
    check('gate untouched in wave 1', await page.evaluate(() => window.__game.gateHp === 20));

    // ---------- pause / resume ----------
    await page.keyboard.press('p');
    await sleep(200);
    check('P pauses', await page.evaluate(() => window.__game.state === 'paused'));
    const t0 = await page.evaluate(() => window.__game.time);
    await sleep(600);
    const t1 = await page.evaluate(() => window.__game.time);
    check('time frozen while paused', t0 === t1, `${t0} vs ${t1}`);
    await page.keyboard.press('p');
    await sleep(200);
    check('P resumes', await page.evaluate(() => window.__game.state === 'playing'));

    // ---------- mute toggle ----------
    const m0 = await page.evaluate(() => window.__game.audio.muted);
    await page.keyboard.press('m');
    await sleep(150);
    const m1 = await page.evaluate(() => window.__game.audio.muted);
    check('M toggles mute', m1 !== m0, `${m0} -> ${m1}`);
    await page.keyboard.press('m');

    // ---------- sell ----------
    await page.mouse.click(920, 138); // select the saron again
    await sleep(200);
    await page.mouse.click(1105, 171); // Sell button (1080..1170, 152..190)
    await sleep(200);
    check('sell removes tower, refunds', await page.evaluate(() => window.__game.towers.length === 0 && window.__game.coins > 70));

    // ---------- defeat path: gate at 1 HP, drop a raksasa near the gate ----------
    const defeated = await page.evaluate(async () => {
      const g = window.__game;
      g.gateHp = 1;
      g.wave = 5;
      // Inject one enemy near the end of the path (same shape createEnemy returns).
      const mod = await import('./src/enemies.js');
      const wmod = await import('./src/world.js');
      const e = mod.createEnemy('raksasa', 5, g.rng);
      e.dist = wmod.PATH_LENGTH - 60;
      const p = wmod.pointAt(e.dist);
      e.x = p.x; e.y = p.y;
      g.enemies.push(e);
      return true;
    });
    check('defeat setup injected', defeated);
    const lost = await waitFor(page, () => window.__game.state === 'defeat', 60000);
    check('gate falls -> defeat screen', lost,
      await page.evaluate(() => `state=${window.__game.state} gate=${window.__game.gateHp}`));
    check('defeat stats real (kills>0, wave shown)', await page.evaluate(() => window.__game.stats.kills > 0));

    // ---------- restart from defeat ----------
    await page.mouse.click(525, 505); // "Main Lagi" (410..630, 480..530)
    await sleep(400);
    check('restart from defeat', await page.evaluate(() => window.__game.state === 'playing' && window.__game.wave === 1 && window.__game.coins === 150));
    await page.close();

    // ---------- win pose: maxed towers, wave 10, 4x speed ----------
    page = await newPage(browser, BASE + '/?shot=win&seed=1');
    const won = await waitFor(page, () => window.__game.state === 'victory', 120000);
    check('win pose reaches victory', won,
      await page.evaluate(() => `state=${window.__game.state} wave=${window.__game.wave} kills=${window.__game.stats.kills} coins=${window.__game.stats.coinsEarned}`));
    check('victory stats consistent (kills>0, coins>0)', await page.evaluate(() => window.__game.stats.kills > 0 && window.__game.stats.coinsEarned > 0));
    await page.close();

    // ---------- shot poses ready ----------
    for (const shot of ['menu', 'play', 'big']) {
      page = await newPage(browser, `${BASE}/?shot=${shot}&seed=1`);
      const ready = await waitFor(page, () => window.__game.shotReady, 90000);
      check(`shot=${shot} ready`, ready,
        await page.evaluate(() => `state=${window.__game.state} enemies=${window.__game.enemies.length} towers=${window.__game.towers.length}`));
      await page.close();
    }

    check('no console errors overall', errors.length === 0, errors.slice(0, 5).join(' | '));
    check('no failed requests overall', failedReqs.length === 0, failedReqs.slice(0, 5).join(' | '));
  } finally {
    await browser.close();
    server.kill();
  }
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) process.exit(1);
})().catch(e => { console.error('PROBE CRASH:', e); process.exit(2); });
