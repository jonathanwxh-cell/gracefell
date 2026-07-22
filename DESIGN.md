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

## v2.4 — Codex (GPT-5), "the sovereign has a voice" (2026-07-22)

The visual readability rule from v2.2 now has an audio counterpart: every hostile
windup gets a stable sound identity. `engine.ts` names the gameplay event and its
arena position; `GameAudio` owns how that event is voiced. Swipe, slam, charge,
volley, meteor, ring and spiral no longer collapse onto the same triangle chirp or
roar. The cue is part of the attack contract, not decoration.

### Synthesis and mix

Important sounds are layered as transient, body and room tail. Light sword actions
stay short and dry; heavy hits, slams and meteors earn the sub energy and longer
reverb. The three-hit combo rises slightly in brightness, confirmed hits differ
from whiffs, meteor fuses whistle before impact, and perfect dodge briefly clears
space in the music before its metallic spark.

The mix now has explicit mobile guardrails:

- one startup-generated noise buffer replaces per-sound allocation and random-fill;
- a 36-voice soft budget drops low-priority clutter before critical feedback;
- a compressor/limiter catches phase-three pileups before the phone speaker clips;
- short generated stereo impulse response gives the arena a shared stone-room tail;
- world X becomes stereo pan, clamped before the arena edge;
- heavy feedback ducks the drone instead of trying to win a volume contest.

### Timing and lifecycle

Victory notes, the double heartbeat and drums are scheduled against
`AudioContext.currentTime`. A 50 ms look-ahead only decides what to enqueue; the
browser audio clock decides when it sounds, so main-thread canvas work cannot pull
the rhythm apart. `Game.destroy()` now tears the audio system down as well as the
render/input loop, closing the context and clearing its scheduler.

### Changed from v2.3

- `audio.telegraph()` as a generic gameplay cue is replaced by
  `audio.telegraph(attack, pan)`; menu rows use the deliberately small `audio.ui()`.
- Player damage and perfect dodge now request their documented haptic patterns.
- Boss and player events pass positional pan; Web Audio node construction remains
  inside `GameAudio`.
- The touch ATK QA no longer accepts the unchanged `move` state as success.

### Verification notes

`npm run build` passes. Chromium desktop and mobile passes reached combat, exercised
all seven windups plus meteor/ring/impact layers, confirmed a running AudioContext,
limiter, reusable noise pool, bounded voice count, real touch ATK state and haptic
requests, with no console errors. Headless audio is silent by design, so these tests
prove the event graph and runtime invariants — a human phone-speaker/headphone pass
still decides final timbre and level balance.

## v2.5 — Codex (GPT-5), "the room remembers a song" (2026-07-22)

The procedural score did its most important job — it stayed out of the way of combat —
but its four oscillators and sparse drum scheduler could not carry two minutes of tension
without sounding like a system. The owner asked specifically for MiniMax, so this pass
uses Music 3.0 to add one original instrumental rather than replacing the audio engine.

The prompt asks for a ruined-sacred-arena palette in D minor: low strings, bowed bass,
frame drums, iron percussion and broken bells, while explicitly reserving transient and
midrange space for the attack language introduced in v2.4. The API-produced result is a
two-minute 44.1 kHz stereo MP3. Its exact prompt, trace identifier and SHA-256 live beside
the asset in `public/audio/README.md` so this binary has reproducible provenance.

### Integration, not replacement

`GameAudio.init()` still starts the procedural bed immediately. It then fetches and
decodes the local MP3 inside the already-unlocked AudioContext and crossfades it in over
1.8 seconds. The generated score and procedural bed have separate submix gains but meet
again at the existing `music` bus, so mute, heavy-hit ducking and the phase-three limiter
continue to govern both. If fetch or decode fails, the generated-score state becomes
`fallback` and the procedural bed simply keeps playing. No API key or remote URL enters
the client build.

The phase-aware procedural drums remain at a reduced level under the fixed recording.
That matters because the player's damage rate determines when phase two and three occur;
a pre-rendered musical transition cannot stay synchronized with every run.

### Changed from v2.4

- The project is no longer literally asset-free: it ships one generated MP3. Visuals and
  every gameplay SFX remain procedural.
- `musicNodes` now also owns the looping `AudioBufferSourceNode`, so the existing teardown
  path stops and disconnects the recording with the rest of the audio graph.
- Audio QA now treats `soundtrackState: "playing"` as a required runtime invariant rather
  than accepting a silently missing binary.

## v2.6 — Codex (GPT-5), "iron, distance, and breath" (2026-07-22)

This pass turns the six open audio enhancement issues into one coherent mix architecture.
They were not independent requests: variation needs a shared policy, distance needs a richer
spatial contract than pan alone, adaptive music needs separate buses, and all of that raises
the importance of predictable voice pressure and peak control.

### A spatial contract, not just stereo decoration

Gameplay now passes `{ pan, distance }` from every world event, measured relative to the
player rather than the arena centre. `GameAudio` converts distance into attenuation,
high-frequency rolloff, and proportionally more room send. The call sites name events and
coordinates; they still do not build Web Audio nodes. This keeps the acoustic model centralized
and makes future occlusion or alternate mixes possible without rewriting boss logic.

### Variation and materials

Repeated cues draw from four subtle, non-repeating profiles that vary pitch, filter, gain,
duration, and onset. A per-family streak mask can pull a repeated sound down by up to 6 dB,
while exact rhythmic telegraphs remain deterministic. Sword contact now separates a 6–9 ms
transient, material body, gated sub layer, and inharmonic metal resonances; player hurt uses
flesh/body components and deliberately omits the metal tail. The sub gate prevents rapid
phase-three hits from multiplying low-frequency energy.

Malakar also gains motion foley: paced footfalls while stalking and a scrape texture only while
charging. His roar is no longer a single oscillator gesture. It combines breath, FM modulation,
subharmonic body, formant sweeps, saturation, and slow unstable flutter, with separate small and
full-roar shapes.

### Adaptive score and mastering

The MiniMax recording remains the musical identity and procedural fallback remains immediate,
but the music bus is now split into drone, drums, tension, and soundtrack layers. Player health
below 35% introduces a filtered tension pad; boss health below 30% increases intensity; stagger
briefly suppresses drums so the opening is audible. Changes use AudioParam targets rather than
frame-stepped gain jumps.

The master compressor now feeds a soft-clipping WaveShaper ceiling at -1 dBFS. This is a
practical browser approximation of true-peak protection, not a claim of oversampled offline
loudness mastering. The arena response is a 1.9-second stereo, mid-focused synthetic impulse;
live Chromium measured its generation at about 8.2 ms, comfortably below the issue's 50 ms
budget.

### Changed from v2.5

- Positional audio arguments changed from a numeric pan to `SpatialAudio`; a numeric value is
  still accepted inside `GameAudio` for compatibility, but gameplay should pass the descriptor.
- The procedural score is no longer one indivisible bus: drone, drums, and tension can respond
  independently while the MiniMax track remains routed through the common music/master chain.
- The 36-voice ceiling is now hard, with six slots reserved from ordinary sounds for critical
  feedback during dense combat.
- QA debug state exposes the peak limiter, IR duration/build cost, variation coverage, maximum
  exercised distance, and adaptive mix state.

### Verification notes

`npm run build`, TypeScript, focused audio ESLint, JavaScript syntax checks, and `git diff
--check` pass. Live Chromium loaded the MiniMax score, exercised nine variation families and
470 px of distance, engaged low-health/boss-intensity/stagger states, peaked at 30/36 active
voices in the stress burst, and emitted no console warnings or errors. Desktop and 390×844
views reached combat. The legacy repo QA script still points at a Linux-only Chromium path on
this Windows checkout, so its expanded assertions are recorded but were not executed here.
Final timbre and balance remain a human listening decision on headphones and a phone speaker.

## v2.7 — Codex (GPT-5), "polish without weight" (2026-07-22)

The owner chose not to add generated 3D assets because the existing Canvas2D silhouettes and
telegraphs already carry the fight, while heavier assets would spend the mobile memory and frame
budget in the wrong place. Three independent review lanes instead found that the largest quality
gains were input trust, interruption safety, readable supporting UI, and startup cost.

### Input and lifecycle are part of combat feel

Touch buttons used to set a one-frame flag while keyboard and mouse actions entered the 190 ms
buffer. Hit-stop clears one-frame flags, so a phone tap during a 50–90 ms impact freeze could be
silently lost. Touch actions now enter the same buffer while retaining the short visual pressed
state. Input teardown also owns every listener it creates and resets held keys, taps, and joystick
state when the page loses focus.

Blur and `visibilitychange` now stop the RAF rather than merely relying on browser throttling,
suspend the AudioContext, pause the streamed score, and resume with a fresh timestamp. The fight
therefore cannot advance while the player is handling a phone interruption. Active projectiles,
rings, and meteors are cleared on defeat so hazard graphics cannot obscure the retry surface.

### Keep the music; stop decoding it all at once

The MiniMax recording is still the musical identity and still routes through
`soundtrackFilter -> soundtrackMusic -> music -> master`. The source is now a looping
`HTMLAudioElement` connected through a `MediaElementAudioSourceNode`, so the browser streams the
compressed MP3 instead of retaining the whole two-minute stereo recording as decoded PCM.

Noise and impulse sample data are prepared during an idle window before the first gesture. The
gesture still creates and unlocks the real AudioContext, but its expensive random-fill work has
already happened. The arena floor cache also derives its supersampling from viewport zoom and DPR;
a 390 px phone no longer allocates the same 2680×2680 surface as a high-DPI desktop.

### A companion layer, not a dashboard

The canvas remains the visual game. A tiny DOM companion exposes the title, live state,
instructions, start/retry action, trial dial, sound, shake, flash, and haptic controls to screen
readers and keyboard focus. It stays visually clipped until focused, then opens as one restrained
parchment-and-ash toolbar. This preserves the playfield while ending the previous all-or-nothing
accessibility boundary.

Inside the canvas, supporting copy and settings plates receive enough contrast to survive a phone
display, touch settings have 44 px hit regions, the first-play hint sits clear of the combat
buttons, a temporary MOVE affordance reveals the joystick zone, and sound is a real touch target.
System-level reduced-motion preference now supplies the first-run shake/flash defaults, while a
saved explicit choice still wins. Positive trial pips use ember rather than the reserved hostile
hazard red, keeping the combat danger language exclusive to damaging telegraphs.

### Changed from v2.6

- The generated score is streamed rather than fetched and decoded into an `AudioBuffer`.
- Noise/IR random-fill work is prepared before first interaction; their Web Audio buffers are still
  created once and the 1.9-second room contract remains intact.
- The floor bake is still offscreen and one-time, but its supersample scale is adaptive.
- The product is no longer literally canvas-only: the visual game is one canvas with one semantic,
  focus-revealed DOM companion.
- `qa/verify.cjs` no longer depends on one Linux checkout or Chromium binary. `npm run qa` owns a
  fixed loopback test server, and GitHub Actions runs lint, build, desktop, mobile, and real-touch
  paths on every push and pull request.

### Changed from v2.7

The idle-prepared noise and arena impulse still use one canonical 48 kHz data set, but runtime
AudioBuffers are now linearly resampled to the actual `AudioContext.sampleRate`. This preserves
their intended duration and avoids Chromium rejecting a 48 kHz convolver buffer when a device or
CI runner opens Web Audio at 44.1 kHz. QA now asserts the context and impulse rates match.
