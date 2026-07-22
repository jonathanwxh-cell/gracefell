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

## v2.1 — Claude (Opus 4.8), "going public" (2026-07-22)

No gameplay change. The repo went public, so the things a stranger needs
arrived: a README that explains the game rather than the Vite template, and an
explicit credit split — Kimi (OKComputer) built v1, this agent extended it.

The substantive piece is `PROVENANCE.md` and its enforcement. Several different
AI agents work on this repo with no shared memory; each arrives cold and acts on
whatever is written down. So credit and handoff context had to become mechanical
rather than remembered:
- `PROVENANCE.md` — the ledger, one row per pass, plus the rules (identify your
  harness honestly, never claim a previous agent's work, document what you
  changed from an earlier pass).
- `.gitmessage` — commit template carrying the `Agent-Pass:` / `Co-authored-by:`
  trailers, enabled via repo-local `commit.template`.
- `AGENTS.md` — obligations hoisted to the top, because that's the part agents
  reliably read.
- `.github/pull_request_template.md` — the same fields at review time.
- `scripts/provenance.sh` — regenerates the ledger from git trailers, `--gaps`
  lists untagged commits. The markdown can drift; trailers in the object store
  can't, so git stays the source of truth and drift stays detectable.

The three pre-convention commits were left untagged rather than rewritten —
they're the honest record of how this started.

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

### Shipping (v2.2, same pass)
Listed on the box's public hub at `sites.alyoechosys.dev` under **Play**, then
promoted to the featured shelf (now: Astra, Lume, Is It A Bubble, GRACEFELL,
easel.). The hub is `~/apps/sites/sites.json`, served static — no restart, live
on refresh. Verified with Playwright at 1280 and 390 that the card renders,
links to the right host, and adds no console errors or overflow. Note the card
sits ~8th in DOM order; "featured" there means a promoted shelf, not
top-of-page.

## v2.3 — Claude (Opus 4.8), "mobile-first, properly" (2026-07-22)

Direction from the owner: this is a game designed for mobile, so treat it that
way. That reframing exposed three genuine bugs, none of which were visible from
a desktop browser.

### The first impression was wrong
`Input.isTouch` only became true on the first `touchstart`. So the title screen
a phone user actually saw said **"CLICK TO RAISE YOUR BLADE"** above a line of
WASD bindings. It's now seeded at construction from `coarsePointer()` — a
`(pointer: coarse)` media query, with a `maxTouchPoints` fallback that excludes
fine-pointer laptops with touchscreens — and still upgrades on a real touch.
All the copy branches: title legend, HUD hint, mute indicator.

### The controls didn't fit small phones
Buttons were at fixed pixel offsets from the bottom-right corner. On anything
narrower than ~380px the FLASK button crossed into the left 45% joystick zone,
so pressing it also started a stick drag. And nothing accounted for the iOS home
indicator, so ROLL sat in the system gesture strip.

`touchLayout()` now places buttons in `base` units out from the corner, with
`base` shrinking when the width budget between the joystick half and the right
padding gets tight, and `padB`/`padR` including safe-area insets (published as
`--sa-b`/`--sa-r` from `index.css`, since `env()` can't be read from a canvas).
Verified clean at 320×568, 360×780, 390×844, 414×896 and landscape.

The first layout attempt used a unit square inside a cluster box and produced
overlapping ATK/ROLL and ATK/HVY buttons at thumb size. The new touch test
caught it immediately, which is the whole argument for writing the test first.

### Touch is now actually tested
`qa/verify.cjs` gained a third pass in a `hasTouch: true, isMobile: true`
context that plays with thumbs only: taps to start the fight, drives a real drag
through the touch listeners and asserts the knight moves (55.9px, diagonal), taps
ATK, and checks every button for overlap, off-screen, joystick-zone intrusion and
fingertip size (r ≥ 22). Previously touch was render-only in the harness.

### Haptics
Short vibrations on taking a hit (longer for heavy), a double-tick on a perfect
dodge, and a tick on every button press. Off-switchable from a HAPTICS row that
only appears on touch devices. Untestable headlessly — no vibration API — so
this is the one part of the pass that rests on code reading, not verification.

### On keeping the keyboard
The instruction floated removing keyboard controls. I kept them. They cost
nothing at runtime, they're already covered by the desktop QA pass, and deleting
them would only subtract from anyone on a laptop. What "mobile-first" changes is
what *decides* the design — sizes, copy, difficulty, readability all now answer
to the phone — not whether a second input path is allowed to exist. Easy to
strip later if that turns out to be wrong; hard to re-derive.

### Changed from v2.2
- Title control legend and HUD hint are no longer desktop-only strings; both branch on `isTouch`.
- `TOUCH_BTNS` schema changed from `{dx, dy, r}` pixels to `{ox, oy, ur}` base-units. Anything reading the old fields will break.
- Menu has a 4th row on touch devices; `menuRows()` no longer returns a fixed 3, and the base Y shifts to keep the block centred.
