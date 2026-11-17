// TABUH — honest auto-play balance bot. Plays the game like a reasonable
// player: a fixed sensible build order, cheapest-first upgrades, gate repair
// when chipped, and (in --tabuh mode) a perfect TABUH on every beat via an
// in-page driver. No coins are granted; everything is earned in-game.
// Usage: node tools/autoplay.js [--tabuh|--no-tabuh] [--speed 3] [--seed 1]
// Exit 0 = victory, 1 = defeat, 2 = timeout/error.
const { chromium } = require('/home/hatch/workspace/makefun/lumenfall/tools/node_modules/playwright-core');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = process.env.CHROME_PATH || (require('os').homedir() + '/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome');
const args = process.argv.slice(2);
const TABUH = args.includes('--tabuh');
const SPEED = parseInt((args.find(a => a.startsWith('--speed')) || '--speed=3').split('=')[1], 10);
const SEED = parseInt((args.find(a => a.startsWith('--seed')) || '--seed=1').split('=')[1], 10);
const PORT = 8096;
const BASE = `http://localhost:${PORT}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Same build order the independent reviewer used (sensible play).
const PLAN = [
  ['saron', 1], ['bonang', 3], ['kenong', 2], ['kendang', 6],
  ['gong', 0], ['saron', 5], ['bonang', 7], ['kenong', 4],
];

(async () => {
  const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: path.join(__dirname, '..', 'game'), stdio: 'ignore' });
  await sleep(1500);
  const ok = await new Promise((resolve) => {
    require('http').get(BASE + '/', (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve(res.statusCode === 200 && body.includes('TABUH')));
    }).on('error', () => resolve(false));
  });
  if (!ok) { console.error('PREFLIGHT FAIL: port did not serve TABUH'); server.kill(); process.exit(2); }
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  let code = 2;
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${BASE}/?seed=${SEED}`, { waitUntil: 'networkidle' });
    await sleep(800);
    await page.evaluate(([speed, tabuh]) => {
      const g = window.__game;
      g.start();
      g.timeScale = speed;
      if (tabuh) {
        // Perfect TABUH on every beat, driven in-page (no round-trip lag).
        let lastBeat = -1;
        window.__tabuhDriver = setInterval(() => {
          const gg = window.__game;
          if (gg.state === 'playing' && gg.beatIndex !== lastBeat) {
            lastBeat = gg.beatIndex;
            gg.tabuh();
          }
        }, 10);
      }
    }, [SPEED, TABUH]);

    let planIdx = 0;
    let lastWave = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 600000) {
      const s = await page.evaluate(() => {
        const g = window.__game;
        return {
          state: g.state, phase: g.phase, wave: g.wave, coins: g.coins,
          gateHp: g.gateHp, kills: g.stats.kills,
          towers: g.towers.map(t => `${t.type}@${t.padIndex}L${t.level}`),
          acc: g.stats.beatPresses ? Math.round(100 * (g.stats.perfectHits + g.stats.goodHits) / g.stats.beatPresses) : 0,
          combo: g.stats.maxCombo,
        };
      });
      if (s.state === 'victory' || s.state === 'defeat') {
        console.log(`\n${TABUH ? 'WITH' : 'WITHOUT'} tabuh: ${s.state.toUpperCase()} — wave ${s.wave}, gate ${s.gateHp}/20, kills ${s.kills}, coins ${s.coins}, accuracy ${s.acc}%, maxCombo ${s.combo}`);
        console.log(`towers: ${s.towers.join(', ')}`);
        console.log(`console errors: ${errors.length}${errors.length ? ' — ' + errors.slice(0, 3).join(' | ') : ''}`);
        code = s.state === 'victory' ? 0 : 1;
        break;
      }
      if (s.wave !== lastWave) {
        console.log(`wave ${s.wave} starts — gate ${s.gateHp}/20, kills ${s.kills}, coins ${s.coins}, towers: ${s.towers.join(', ')}`);
        lastWave = s.wave;
      }
      if (s.phase === 'build') {
        // Repair when chipped and affordable.
        if (s.gateHp <= 15 && s.coins >= 100) {
          await page.evaluate(() => window.__game.repairGate());
          continue;
        }
        // Build next planned tower.
        if (planIdx < PLAN.length) {
          const [type, pad] = PLAN[planIdx];
          const built = await page.evaluate(([ty, pd]) => window.__game.buildTower(ty, pd), [type, pad]);
          if (built) { console.log(`  built ${type}@pad${pad}`); planIdx++; continue; }
          if (s.coins < 250) { /* can't afford the next one yet — upgrade instead */ }
        }
        // Upgrade cheapest affordable tower (L1->L2 first, then L2->L3).
        const upgraded = await page.evaluate(async () => {
          const g = window.__game;
          const mod = await import('./src/towers.js');
          const cands = g.towers.filter(t => t.level < 3)
            .map(t => ({ t, cost: mod.upgradeCost(t) }))
            .sort((a, b) => a.cost - b.cost);
          for (const c of cands) {
            if (g.coins >= c.cost && g.upgradeTower(c.t)) return `${c.t.type}@pad${c.t.padIndex} -> L${c.t.level}`;
          }
          return null;
        });
        if (upgraded) { console.log(`  upgraded ${upgraded}`); continue; }
        // Nothing to buy — start the wave.
        await page.evaluate(() => window.__game.startWave());
      } else {
        // Mid-wave: emergency repair only.
        if (s.gateHp <= 8 && s.coins >= 100) {
          await page.evaluate(() => window.__game.repairGate());
        }
      }
      await sleep(250);
    }
    if (code === 2) console.log('TIMEOUT after 600 s');
  } finally {
    await browser.close();
    server.kill();
  }
  process.exit(code);
})().catch(e => { console.error('AUTOPLAY CRASH:', e.message); process.exit(2); });
