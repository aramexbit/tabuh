# TABUH — Gamelan Defense — BUILD LOG

Entry for make.fun best-game-01. Repo: https://github.com/aramexbit/tabuh
Competition: best game, any genre, desktop browser, offline. Deadline: 18 Nov 2026 18:00 UTC
(19 Nov 2026 01:00 WIB). Results due 3 Dec 2026 06:10 UTC. Prizes: 1st $400, 2nd $200,
3rd $120, 4th–10th $40 (top 10 of the final heat).

## Concept

A Javanese village at dusk is attacked by waves of spirits. The player defends it by
placing bronze gamelan instruments as towers along a stone path: Gong, Bonang, Kendang,
Saron, Kenong. Every tower strikes on the beat of a procedural gamelan loop, and the
player taps TABUH (Space or click) exactly on the beat to build a combo multiplier that
boosts all tower damage. Missing the beat breaks the combo. Rhythm + tower defense:
no top entry in this bounty plays this way, and the culture + procedural music make the
entry stand out in the judge's screenshot sheet and source outline.

Our previous entry in this bounty, ARCANE DUEL (submission 01a1e38d), ranks 1475 of
10,539 — this is a NEW entry (new repo), it does not replace it.

## Design decisions

- Canvas 2D, vanilla JS, no vendored libraries: the whole game is our own source, so
  the dossier outline shows our files and names, not a library.
- All art is drawn in code (dusk sky, moon, village silhouettes, stone path, bronze
  instruments, glowing spirits, fireflies). No image assets, no network requests.
- All music is synthesized with WebAudio (slendro-style pentatonic scale, gong cycle,
  interlocking bonang/saron patterns, kendang pulse). Mute toggle included.
- Beat clock drives both music and tower fire: towers strike on beats, so the rhythm
  is visible (pulse rings, mallet strikes) as well as audible.
- 10 waves ("malam"), escalating. Win = survive all 10. Lose = village gate HP hits 0.
- Economy: coins from kills + wave-clear bonus + perfect-beat bonus. Towers upgrade
  twice (perunggu -> emas), with stat boosts and a gold trim.
- Controls: mouse (click pads, build bar, TABUH button) + keyboard (1-5 select tower,
  Space = tabuh, P pause, M mute). Desktop browser only, fully offline.
- Screenshots: 4 real renders (?shot= poses in src/shots.js): menu, mid-action play,
  gong ultimate moment, victory screen with real stats.

## Files (one job each)

- game/index.html — canvas shell, loads src/main.js
- game/src/main.js — bootstrap, exposes window.__game for probes
- game/src/game.js — Game class: state machine, loop, beat clock, wave flow
- game/src/config.js — balance: towers, enemies, waves, economy
- game/src/rng.js — seeded RNG (mulberry32)
- game/src/audio.js — WebAudio gamelan synth + beat scheduler
- game/src/world.js — path waypoints, build pads, village gate
- game/src/towers.js — tower build/upgrade/fire + drawing
- game/src/enemies.js — enemy types, movement, drawing
- game/src/waves.js — wave compositions + spawner
- game/src/effects.js — particles, floating text, beat rings
- game/src/render.js — background scene (sky, village, path, pads, gate)
- game/src/input.js — mouse + keyboard
- game/src/ui.js — HUD, menus, overlays, buttons
- game/src/shots.js — screenshot poses (?shot=menu|play|big|win)
- main.ts — entrypoint: copies game/ + screenshots/, writes dossier.json
- vendor/makefun-game.ts — kit file, unchanged

## Build order

1. Repo + kit init (anchor 09bd9635cebb291975e88cba466b626a07280949 round 34031885).
2. Core: config, rng, world, game loop, render, input, ui (menu + HUD).
3. Towers + enemies + waves + effects + audio + beat system.
4. Probe headless (0 console errors), fix, balance-tune with auto-play.
5. GitHub Pages playtest (branch play), independent reviewer agent, fix findings.
6. 4 screenshots, user approval, quota check, bundle + submit.

## Lessons applied (from earlier projects)

- rsync ALWAYS --exclude=.git (a builder once wiped a local clone with rsync --delete).
- VM file-write fault: creating files is fine but writing contents sometimes fails EPERM
  leaving 0-byte files. Edit important files only with the file tools, verify sizes with
  stat after any copy.
- Never claim a game "passes" from code review or a probe alone — the user's playtest
  decides. Present bug findings equally with good news, up front.
- Don't change a working feature without instruction; don't change localStorage key
  formats without a safe default.

## Progress log

- 17 Nov ~14:15 WIB: game v1 written + committed (326f377). Probe 1: 30/32 PASS —
  only failure was a favicon 404 console error (fixed with a data: SVG favicon).
- Probe 2 (after favicon fix): **32/32 PASS** — menu, build/upgrade/sell, tabuh on beat
  (perfect), wave 1 cleared with gate untouched, pause/resume, mute, defeat screen,
  restart, win pose victory, all 3 shot poses ready, 0 console errors, 0 failed
  requests. Harness: tools/probe.js (Node Playwright, own http server).
- Screenshot lesson: port 8084 was occupied by an unrelated JSON service
  (`{"error":"not_found"...}`) — the first shots run captured its blank error page.
  Fix: pre-flight check in tools/shots.js (verify the served page contains TABUH)
  + moved to port 8094. Always verify the server you probe is YOUR server.
- Screenshot fixes: gong "big" moment moved to the central pad + requires a
  multi-hit shockwave (>=2 spirits) so the frame reads as a climax; win pose now
  plays waves 9+10 at 1x speed and taps TABUH on every beat for real, so the
  victory screen shows genuine stats (89% accuracy, max combo 20, kills 84,
  coins 891, ~1.5 min play-time) instead of 0% accuracy / 0:09.
- 17 Nov ~14:28 WIB: playtest live at https://aramexbit.github.io/tabuh/
  (branch `play`, subtree split of game/, commit 523f57d). Main branch at fdc59e7.
- 17 Nov ~14:34 WIB: independent review (subagent) — CRITICAL: kendang slow +
  gong stun never applied (game.beatDur undefined -> NaN); MAJOR: rhythm
  optional (zero-tabuh auto-play won 20/20); MAJOR: no money sink (~600 coins
  unspent). Fixes committed: beatDur line, HP scale 0.12->0.18/wave, speed
  scale, wave 9-10 counts up, gate repair sink (100 coins, +5 HP), pad panel
  flip, +2 houses + bamboo filling the lower field.
- 17 Nov ~14:47 WIB: user feedback — spirits looked like marbles ("kelereng").
  Redrew all 5 enemies as hantu Indonesia in canvas: Kuntilanak (white dress,
  long black hair, floats), Tuyul (small bald child, quick bob), Pocong (white
  shroud with ties, hops), Genderuwo (bulky dark hairy, red eyes), Buto Ijo
  (giant green ogre, horns + fangs). Internal type keys unchanged.
- 17 Nov ~14:50 WIB: user asked for creepy night ambience — added to audio.js:
  crickets (4-5 kHz chirps, random pan/pitch), wind (looped noise, lowpass,
  slow LFO), low drone (55 + 55.7 Hz), owl hoot (~24 s), frog croak (~9 s).
  Routes through master gain, so mute silences it; headless-safe.
- 17 Nov ~15:00 WIB: autoplay BUG — `--speed 3` parsed as `--speed=3` gave
  SPEED=NaN, timeScale=NaN froze the game clock (time=NaN, nothing spawned,
  600 s timeout). Heartbeat log in autoplay.js caught it. Fixed arg parsing
  (space + = forms) + game.frame() guards a non-finite timeScale to 1.
- 17 Nov ~15:05 WIB: balance v1 STILL too easy — no-tabuh bot won 20/20
  (kills 252, coins 659). Balance v2: HP +28%/wave, speed +4%/wave, wave 7-10
  counts up, kill rewards -25%, wave bonus 15+4w. Re-testing both modes.

## Submit — 17 Nov 2026 ~15:26 WIB (TERKIRIM)
- Kuota live (curl, 15:13 WIB): best-game-01 can_submit TRUE, day 3/3 tersisa, hard 19/20.
- Bundle: ~/workspace/makefun/tabuh-bundle.tar.gz, 2.006.381 byte, sha256 cd06d065f47aa8cdd8f47938eaca7083911e6b30f9179ac4299fc8dc60c7cd4f (kit level 19, 21 sesi muse-app; deklarasi harness muse-app 1.3 / provider meta / model muse-spark-1.3 / effort default; --muse-usage 204 baris; 1 sesi latar tanpa usage row — peringatan "usage goes uncounted" saja, bukan penolakan).
- Check lokal: 14 passed, 0 failed (thinking_revised LOLOS — game.js dari 7 pesan; thinking_reproduces 95,9%; thinking_priced 35 usage records; thinking_fresh skip-note: subagent review 6 baris tanpa anchor — bukan penolakan).
- Submit: --source (entri source-bundle, bukan --repo-url) + --keypair makefun-keypair.json, commit 92586a7f310140961a44b0266f99b89903af538b.
- HASIL: HTTP 202, submission 01a1e89d-6432-729d-92ea-b0e25c551d1a, claim AF-0F4M6-YNJB1-AAF1V-8M73N, judul "TABUH — Gamelan Defense". Payout wallet JEsUS (delegasi pin akun). Status server: submitted, outcome not decided yet; semua check server pass (account_wallet, quota, form, entry_signature, source_bundle).
- Hasil due 3 Des 2026 06:10 UTC. Entri ini ENTRI FINAL (menggantikan ARCANE DUEL sebagai entri best-game-01 terbaru; ARCANE DUEL tetap tercatat terpisah).
