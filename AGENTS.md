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

## Layout
- Vite + React + TS app. Game logic lives almost entirely in `src/game/engine.ts` (+ `src/game/audio.ts`). `src/pages/Home.tsx` just mounts a canvas.
- `server.mjs` — zero-dep static server for `dist/`, binds **127.0.0.1** (never localhost), SPA fallback, `/health`.
- `qa/verify.cjs` — the Playwright gate. Run before claiming DONE.
- `PROVENANCE.md` / `scripts/provenance.sh` — the multi-agent ledger and its regenerator.

## Deploy loop
1. Edit `src/**`.
2. `npm run build` (tsc -b && vite build) — MUST pass; tsc is the syntax gate.
3. `restart_service gracefell` (isolated call — never chained).
4. `node qa/verify.cjs` → check `/tmp/gracefell-result.json` has `"ok": true`. Run long via `setsid ... & ` + poll; the harness takes ~60–90s.

## Don't-undo list
- `window.__game` debug hook — QA depends on it.
- Baked floor (`buildFloor`) + scorch canvas: floor detail is rendered ONCE offscreen. If you add floor detail, add it inside `buildFloor`, not in `drawArena` (per-frame).
- Particle/projectile bloom uses `globalCompositeOperation = 'lighter'` inside save/restore pairs — keep the restores or everything turns additive.
- `resetFight` must clear the scorch canvas (setTransform reset → clearRect → restore) — the ctx carries a center translate.
- localStorage key `gracefell` — schema **v2**: `{v, bestTime, bests{}, wins, attempts, muted, grace, shakeEnabled, flashReduced}`. Bump `Game.SAVE_VERSION` and add a migration branch in the constructor if you change it; there is a QA test that a v1 save still loads.
- `bests[grace]` is authoritative for records; top-level `bestTime` is only a display fallback.
- Phase-3 transition intentionally resets all boss cooldowns.
- **The reserved hazard hue.** `PAL.danger` / `PAL.dangerEdge` mean one thing: this will hurt you. Hostile projectiles, hostile rings, attack telegraphs — nothing else. Decorative fire uses `PAL.amber`. A QA assertion fails if any ambient particle carries the danger hue. If you need a new warm colour, add one; do not borrow this one.
- Hazards are also **shape-coded** so they survive colour blindness: projectiles get a white core + rotating diamond (decor is round), hostile rings get a bright leading edge, meteors get four inward ticks. Keep the redundancy — colour alone is not a signal.
- `Game.mods` is the single derivation point for every difficulty/accessibility lever. Tune there, not at call sites.
- `menuGeom()` is the single source of truth for title-menu layout — renderer, hit-test and QA layout assertions all read it. If you move a menu element, move it there or the test stops protecting you.
- `shake()` early-returns when `shakeEnabled` is false, and `flashScale()` gates full-screen flashes. Don't bypass them with direct `shakeAmp` writes — they're photosensitivity controls, not polish.
- Perfect dodge window scales with grace: `t > 0.42 - 0.24 * mods.perfectWindow`; `perfectCd` prevents multi-trigger from one swing.

## Headless QA facts (hard-won)
- chromium path: `~/.cache/ms-playwright/chromium-1228/...` (1223 does not exist on this box).
- Constructing a second `Game` (e.g. to test save migration) **overwrites the `window.__game` hook**, and `destroy()` does not restore it — every later assertion then silently reads a dead instance. Save and restore it around the construction.
- Screenshots are not always reviewable by an agent. When they aren't, make correctness numeric instead of eyeballing: that's why `menuGeom()` exists and why the layout assertions caught a chevron drawing 5px outside its plate at 390px.
- RAF runs ~0.6x real time under swiftshader → gate on `waitForFunction(game.stateT/state)`, never wall-clock sleeps, for sim-time thresholds.
- Boss ignores damage while `state === 'spawn'` (intro). Wait for `game.state === 'fight'` first.
- Audio: AudioContext works headless but is silent — no assertions on sound.

## Known scope edges
- Touch UI verified render-only headlessly (`isTouch` needs real touch events); button hit-tests unchanged from prototype.
- `npm ci` fails on this lockfile (kimi plugin resolution) — use `npm install`.
