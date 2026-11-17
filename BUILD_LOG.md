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
