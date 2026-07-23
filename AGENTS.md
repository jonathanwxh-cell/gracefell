# AGENTS.md — gracefell operational runbook

> ## ⛔ Before you write any code
>
> This repo is worked on by several different AI agents. **Read [PROVENANCE.md](PROVENANCE.md) first**
> and record your pass there when you finish. You are not the first agent here and you
> won't be the last.
>
> Minimum obligations for any pass:
> 1. Tag your commits: `Agent-Pass: <Agent> / <model> / <harness>` trailer (see `.gitmessage`).
> 2. Add a row to `PROVENANCE.md` when the pass is done.
> 3. Write your reasoning section in `DESIGN.md`.
> 4. Don't silently change what a previous agent built — document it under `### Changed from vX.Y`.
>
> Enable the commit template once: `git config commit.template .gitmessage`

App: GRACEFELL, boss-arena souls-like. https://gracefell.alyoechosys.dev · port 8491 · service `gracefell` · repo jonathanwxh-cell/gracefell (public).

## This is a mobile-first game
Design for a 390×844 phone held in two hands, then let desktop inherit. Any new UI has to be
reachable by a thumb, sized for a fingertip (r ≥ 22px), and clear of the joystick half and the
safe-area insets. Desktop/keyboard support is kept because it costs nothing — but it is the
secondary path, and no feature should require a keyboard.

## Layout
- Vite + React + TS app. Game logic lives almost entirely in `src/game/engine.ts` (+ `src/game/audio.ts`). `src/pages/Home.tsx` mounts the canvas and its focus-revealed semantic companion controls.
- `server.mjs` — zero-dep static server for `dist/`, binds **127.0.0.1** (never localhost), SPA fallback, `/health`.
- `qa/verify.cjs` — the Playwright gate. Run before claiming DONE.
- `PROVENANCE.md` / `scripts/provenance.sh` — the multi-agent ledger and its regenerator.

## Deploy loop
1. Edit `src/**`.
2. `npm run build` (tsc -b && vite build) — MUST pass; tsc is the syntax gate.
3. `restart_service gracefell` (isolated call — never chained).
4. `npm run qa` → build + isolated 127.0.0.1:8492 desktop/mobile/touch playtest. The result and screenshots are written under the platform temp directory's `gracefell-qa` folder.

## Don't-undo list
- `window.__game` debug hook — QA depends on it.
- Baked floor (`buildFloor`) + scorch canvas: floor detail is rendered ONCE offscreen. If you add floor detail, add it inside `buildFloor`, not in `drawArena` (per-frame).
- Particle/projectile bloom uses `globalCompositeOperation = 'lighter'` inside save/restore pairs — keep the restores or everything turns additive.
- `resetFight` must clear the scorch canvas (setTransform reset → clearRect → restore) — the ctx carries a center translate.
- localStorage key `gracefell` — schema **v2**: `{v, bestTime, bests{}, wins, attempts, muted, grace, shakeEnabled, flashReduced, hapticsEnabled}`. Bump `Game.SAVE_VERSION` and add a migration branch in the constructor if you change it; there is a QA test that a v1 save still loads.
- `bests[grace]` is authoritative for records; top-level `bestTime` is only a display fallback.
- Phase-3 transition intentionally resets all boss cooldowns.
- **The reserved hazard hue.** `PAL.danger` / `PAL.dangerEdge` mean one thing: this will hurt you. Hostile projectiles, hostile rings, attack telegraphs — nothing else. Decorative fire uses `PAL.amber`. A QA assertion fails if any ambient particle carries the danger hue. If you need a new warm colour, add one; do not borrow this one.
- Hazards are also **shape-coded** so they survive colour blindness: projectiles get a white core + rotating diamond (decor is round), hostile rings get a bright leading edge, meteors get four inward ticks. Keep the redundancy — colour alone is not a signal.
- `Game.mods` is the single derivation point for every difficulty/accessibility lever. Tune there, not at call sites.
- `touchLayout()` is the single source of truth for the on-screen controls — renderer, hit-test and QA all read it. Buttons are placed in `base` units out from the bottom-right corner and the whole cluster shrinks on narrow screens; don't reintroduce fixed pixel offsets (they used to put FLASK inside the joystick half on sub-380px phones).
- `Input.isTouch` is seeded from `coarsePointer()` at construction, NOT from the first touch event. Before this, phone users saw "CLICK TO RAISE YOUR BLADE" and a line of WASD bindings as their first impression. Keep the up-front detection.
- Terminal retry/replay uses `Input.confirmSequence`, a monotonic gesture counter snapshotted on death/victory. Do not replace it with only the short combat buffer: pointer-only embedded browsers and focus handoffs can otherwise discard the visible “rise again” tap.
- Safe-area insets come from `--sa-b` / `--sa-r` published in `src/index.css` and read in `resize()` — `env()` isn't reachable from a canvas context.
- `menuGeom()` is the single source of truth for title-menu layout — renderer, hit-test and QA layout assertions all read it. If you move a menu element, move it there or the test stops protecting you.
- `shake()` early-returns when `shakeEnabled` is false, and `flashScale()` gates full-screen flashes. Don't bypass them with direct `shakeAmp` writes — they're photosensitivity controls, not polish.
- Perfect dodge window scales with grace: `t > 0.42 - 0.24 * mods.perfectWindow`; `perfectCd` prevents multi-trigger from one swing.
- `GameAudio` owns synthesis, soundtrack loading, player-relative distance/pan, arena reverb, adaptive music, ducking, limiting, voice pressure, scheduling and teardown. Gameplay code should name the event and pass `audioSpatial(x, y)`; it should not build Web Audio nodes itself.
- `public/audio/gracefell-sovereigns-fall.mp3` is the sparse MiniMax score. It streams through `MediaElementAudioSourceNode -> soundtrackPresenceDip -> soundtrackFilter -> soundtrackMusic -> music -> master` so action ducking, mute and the limiter still apply. The procedural drone/drums start immediately, crossfade under the MP3, and remain the network/playback fallback. Do not return to decoding the full track into an `AudioBuffer` on mobile.
- Noise and arena-IR sample data are generated once in the first zero-delay preparation task, then copied into their Web Audio buffers when the first gesture unlocks the context. The prepared arena buffer attaches one task after the gesture so its allocation does not block input. Do not return to allocating/filling an `AudioBuffer` for every projectile or impact — phase-three storms make that a mobile GC problem.
- Boss windups use `audio.telegraph(attack, spatial)`. The seven attack names are an audio readability contract: a player should be able to distinguish swipe, slam, charge, volley, meteor, ring and spiral before the hit lands.
- Combat owns the mix: keep SFX at full submix gain, the music bus at or below 0.24, the soundtrack submix at or below 0.56, and the broad 1.8 kHz soundtrack dip at least 4 dB deep. Player verbs and all seven boss windups must duck the music and use critical voice reservations. Bump `SOUNDTRACK_VERSION` whenever the MP3 changes so browser/CDN caches cannot retain an older score.
- `vary()` is the central SFX anti-repetition policy. Keep hostile telegraph timing exact; apply variation to performance and impact sounds, and retain repeat masking/critical-voice reservations rather than adding unbounded layers at call sites.
- The generated score, procedural drone, drums and tension pad have separate submix gains. `updateCombatState()` owns low-health, boss-intensity and stagger transitions. The master route must remain `master -> compressor -> peakLimiter -> destination`.
- The arena IR sample data is prepared once in the first zero-delay preparation task and copied into its Web Audio buffer on startup. It should stay above 1.5 seconds while the measured first-gesture buffer build remains below the QA budget. Distance processing owns attenuation, low-pass and room-send changes together; do not add call-site volume hacks.
- Prepared noise/IR data uses a 24 kHz canonical rate, but the runtime AudioBuffers must be resampled to `AudioContext.sampleRate`. Chromium may open at 44.1 kHz and rejects a mismatched convolver buffer before the fight can start. The arena response remains at least 1.5 seconds and is mono after the already-stereo spatial send to keep cold allocation inside the mobile budget.
- Boss stalk footsteps and charge scrape are state foley. Charge scrape must stop with charge state; it is intentionally requested in short grains rather than held as an orphanable looping node.

## Headless QA facts (hard-won)
- Playwright is a repo dev dependency. `npm run qa` starts an isolated fixed-port server and uses Playwright's installed Chromium; `PLAYWRIGHT_CHROMIUM_PATH` remains available for unusual hosts.
- Constructing a second `Game` (e.g. to test save migration) **overwrites the `window.__game` hook**, and `destroy()` does not restore it — every later assertion then silently reads a dead instance. Save and restore it around the construction.
- Screenshots are not always reviewable by an agent. When they aren't, make correctness numeric instead of eyeballing: that's why `menuGeom()` exists and why the layout assertions caught a chevron drawing 5px outside its plate at 390px.
- Headless RAF timing varies → gate on `waitForFunction(game.stateT/state)`, never wall-clock sleeps, for sim-time thresholds.
- Boss ignores damage while `state === 'spawn'` (intro). Wait for `game.state === 'fight'` first.
- AudioContext works headlessly but is silent. QA asserts initialization, MiniMax MP3 decode, limiter/noise-pool presence, voice pressure, every boss-cue code path and haptic requests; actual timbre and mix balance still require a listening pass on phone speaker + headphones.

## Known scope edges
- Touch is now genuinely tested: `qa/verify.cjs` runs a third pass in a `hasTouch + isMobile` context that taps to start, drives a real drag through the touch listeners and asserts the knight moves, taps ATK, checks every button for overlap / off-screen / joystick-zone / fingertip-size violations, then dies naturally and proves both touchscreen and pointer-only resurrection. That test caught two overlapping buttons when it was written and the reported retry failure in v2.9.1.
- Still unverified by machine: haptics (no vibration API headless) and real iOS Safari URL-bar / dvh behaviour.
- `npm ci` fails on this lockfile (kimi plugin resolution) — use `npm install`.
