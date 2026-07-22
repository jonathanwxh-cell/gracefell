# GRACEFELL — design log

Boss-arena souls-like ARPG. Canvas 2D, fully procedural (zero assets), procedural Web Audio. One boss: MALAKAR.

## v1.0 — Kimi (OKComputer)

The original build. Established everything the sequel stands on:
- Engine architecture: `Input` / `Player` / `Boss` / `Game` classes, render methods merged onto `Game.prototype`.
- Souls-style input buffering (190ms press window, `consume()` semantics).
- Two-phase boss with six attacks (swipe combo, slam, charge, volley, meteor, ring), weighted range-gated attack selection, poise/stagger, telegraph rendering under entities.
- Player kit: roll i-frames, light/heavy with lunge + sword-tip ribbon, flasks, stamina economy.
- Procedural Web Audio engine — tone/noise primitives, drone bed, phase-aware drum scheduler, all SFX.
- Art direction: parchment & grace-gold on ash-black, the whole PAL palette, torchlight pools, YOU DIED / GREAT ENEMY FELLED screens, and the writing.

The prototype was already a working game with good bones. What follows is polish on top of it, not a rewrite.

## v2.0 — Claude (Opus 4.8), "the AAA pass" (2026-07-22)

Goal: take a solid one-boss prototype and push polish/fun/graphics hard, verified live.

### Combat depth
- **Perfect dodge**: a hit landing inside the early roll window (roll t > 0.18, i-frames active) triggers slow-mo (0.34s @ 0.25x), +30 stamina refund, gold flash, "PERFECT" popup, and 16 poise damage to the boss (`Game.onPerfectDodge`, gated by `player.perfectCd` 0.8s). Turns defense into offense — the core souls loop.
- **3-hit light combo**: `comboStep` 0→1→2 within a 0.6s `comboWindow`. Sweeps alternate direction; step 3 is a finisher (0.44s, dmg 24, wider arc, knockback, heavy swing SFX). Roll/heavy/getting hit resets the chain.
- **Phase 3** at 22% HP — "GRACE ABANDONS HIM": speedMul 1.42, all cooldowns reset, slow-mo entrance. New **spiral** attack (two opposed arms, 16 ticks × 2 projectiles, rotating 0.44 rad/tick), double ring waves, 9-meteor barrages with tighter fuses, 9-projectile volleys, denser ember shed.
- Phase 1→2 threshold moved 50%→55% so the fight escalates earlier.

### Rendering
- **Baked floor**: `buildFloor()` renders the whole arena floor once at 2x supersample into an offscreen canvas — flagstone mortar joints in 5 rings, tonal plate variance, stones, cracks, sigil, 700-speckle grain. Per-frame cost: one drawImage.
- **Persistent battle scars**: separate scorch canvas; slams/meteors paint scorch rings, player hits paint blood splats (`addScorch`). Cleared on `resetFight`. The arena tells the story of the fight.
- **Additive bloom**: glow particles, projectiles, and the boss core now composite with `lighter` (halo pass at 2.3x size @ 0.28 alpha) instead of shadowBlur — brighter and cheaper.
- **Atmosphere**: 3 swaying god-ray wedges (additive) + 64 parallax ash motes in screen space (drift tied to camX/camY by per-mote parallax factor).
- **Boss body**: tattered wings from phase 2 (ragged polygon, flap rate scales with phase), 5 orbiting crown shards (orbit speed 0.8/1.6/2.6 by phase, gold-rimmed in p3), white-hot p3 core.
- **Feel**: `zoomPunch` (+0.045 camera kick on heavy hits, decays 0.22/s), low-HP (<30%) pulsing crimson vignette + procedural heartbeat (interval lerps 1.0→0.55s with severity).

### Meta / persistence
- localStorage key `gracefell`: `{bestTime, wins, attempts, muted}`. Loaded in constructor (try/catch for private mode), saved on death/victory. Muted state re-applied on first gesture.
- **Victory grade seal**: S (no-hit, or <100s & ≤3 hits) / A / B / C, drawn as a stamped ring with pop-in scale; "✦ new record" tag; best time on title screen with win count.
- Death screen shows how close it was: "the sovereign stood at N%".
- Boss bar: poise sliver underneath + phase pips (◆◇◇); phase-3 name "MALAKAR, GRACE-FORSAKEN".
- Title: the sovereign's silhouette looms behind the logotype, core pulsing.
- Audio: phase-3 drum pattern (kick every other beat + hats + high pulse), heartbeat, victory chord now actually fires on boss death.

### Verification (the gate)
`qa/verify.cjs` — headless Playwright (playwright-core from uptime-kuma, chromium-1228, swiftshader):
desktop 1280×800 + mobile 390×844. Asserts: canvas draws (pixel sampling), zero console/page errors, no horizontal overflow, title→intro→fight flow, phase 2 & 3 trigger, victory + grade + localStorage round-trip, restart flow, perfect-dodge unit check (stamina refund, popup, hp unchanged), combo fields. Result JSON → /tmp/gracefell-result.json. Separate probe confirmed the spiral attack chooses + fires (6+ live projectiles).

**Headless gotchas learned**:
- This box's chromium is `chromium-1228` (not 1223).
- Headless RAF runs ~0.6x real time under swiftshader → never gate QA on wall-clock waits for sim-time thresholds; `waitForFunction` on `game.stateT` / `game.state` instead.
- Boss ignores damage during `spawn`; wait for `state === 'fight'` before forcing damage.
- The phase-3 transition resets all boss cooldowns — pin cooldowns *after* `boss.phase === 3` if forcing a specific attack.

### Architecture notes
- Engine is a single `src/game/engine.ts` (~2.1k lines): Input / Player / Boss / Game classes + render methods bolted onto `Game.prototype` (declaration-merged interface). `window.__game` is the QA/debug hook.
- Static build served by `server.mjs` (zero-dep http, SPA fallback, immutable cache for /assets, 127.0.0.1 bind).

## v2.2 — Claude (Opus 4.8), "clarity and the grace dial" (2026-07-22)

Researched what actually drives replay and whether graphics matter, and the
answer to both pointed at the same slice: **readability is the feature**. The
genre evidence (AbleGamers on modifiable health/enemy-health/speed; Steelrising's
assist sliders; Lies of P adding options explicitly to broaden its base) says
accessibility in a hard game is a dial, not an easy mode. The art-direction
evidence says clarity is the leading indicator and fidelity the lagging one.
So this pass is partly subtractive — it takes back some of what v2.0 added.

### The reserved hazard hue
v2.0's own mistake: it lit the screen with orange bloom, orange embers, an
orange boss core, orange telegraphs AND orange projectiles. Danger and
decoration shared a hue, which is exactly the failure mode that makes a busy
phase-3 screen unreadable.

`PAL.danger` (#ff2d17) + `PAL.dangerEdge` are now **reserved**: hostile
projectiles, hostile rings, and attack telegraphs only. Decorative fire moved
to the new `PAL.amber`. The boss core and sword glow are amber too — the boss's
body is not a hazard; his attacks are. There is a QA assertion that no ambient
particle ever carries the danger hue, so this can't rot.

Hazards also got **non-colour coding**, for the ~8% of men with a red-green
deficiency and for anyone on a bad display:
- projectiles: hard white core + rotating diamond outline (decor is round)
- hostile rings: bright leading edge, which is the part you actually must clear
- meteors: four ticks closing inward, so the fuse reads as motion not colour

### The grace dial (−3 … +5)
One legible dial instead of a settings menu. Negative = aided (slower boss,
wider i-frames, softer hits, an extra flask, a more forgiving perfect-dodge
window). Positive = vowed (faster, fewer flasks, harder hits, no stagger at +3).
Everything derives from `Game.mods`, so there is exactly one place to tune.

The design constraint: aid lengthens the *read*, it does not change the fight.
The pattern you learn at −3 is the pattern you execute at +5. And the record
carries the setting — bests are stored per grace level, and the grade seal
stamps the trial ("S +2") — which answers the standing objection that a shared
difficulty is what makes "I beat it" mean something.

### Photosensitivity + motion
Screen shake toggle, and a flash-reduction toggle that scales the red/gold
full-screen flashes to 25% and replaces the low-HP vignette's 5Hz pulse with a
steady glow. v2.0 shipped that strobe without flagging it; this is the fix.

### Save schema v2
`{v:2, bests:{}, grace, shakeEnabled, flashReduced, ...}` with forward
migration from v1 saves (old `bestTime` is adopted as the grace-0 best). Done
now, before relics make the shape harder to change.

### Changed from v2.0
- Ambient/boss embers, boss core, sword glow, impact bursts: `PAL.ember` → `PAL.amber`. Deliberate; do not revert without re-reserving a hazard hue.
- Title screen's static control-hint block replaced by the live settings rows; the controls line moved above them.
- `bestTime` is retained but is now a display fallback — `bests[grace]` is authoritative.

### Verification notes
- `menuGeom()` is the single source of truth for menu layout, consumed by the
  renderer, the hit-test, and the QA assertions. This exists because I could
  not visually inspect the screenshots on this pass — so layout correctness had
  to become numeric: chevrons/labels/pips inside their plate, plate inside the
  viewport, rows clear of the title block, hit zones not inverted. That check
  immediately caught the left chevron drawing 5px outside its plate at 390px.
- Harness gotcha: constructing a second `Game` (for the migration test)
  overwrites the `window.__game` debug hook and `destroy()` does not restore
  it — every later assertion then reads a dead instance. Restore it manually.
