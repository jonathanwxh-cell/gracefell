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
- localStorage key `gracefell` — keep shape `{bestTime, wins, attempts, muted}` backward-compatible.
- Phase-3 transition intentionally resets all boss cooldowns.
- Perfect dodge window = roll `t > 0.18` with i-frames; `perfectCd` prevents multi-trigger from one swing.

## Headless QA facts (hard-won)
- chromium path: `~/.cache/ms-playwright/chromium-1228/...` (1223 does not exist on this box).
- RAF runs ~0.6x real time under swiftshader → gate on `waitForFunction(game.stateT/state)`, never wall-clock sleeps, for sim-time thresholds.
- Boss ignores damage while `state === 'spawn'` (intro). Wait for `game.state === 'fight'` first.
- Audio: AudioContext works headless but is silent — no assertions on sound.

## Known scope edges
- Touch UI verified render-only headlessly (`isTouch` needs real touch events); button hit-tests unchanged from prototype.
- `npm ci` fails on this lockfile (kimi plugin resolution) — use `npm install`.
