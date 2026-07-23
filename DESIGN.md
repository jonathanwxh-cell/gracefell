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
- Engine is a single `src/game/engine.ts` (~3.3k lines): Input / Player / Boss / Game classes + render methods bolted onto `Game.prototype` (declaration-merged interface). `window.__game` is the QA/debug hook.
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

## v2.8 — Codex + MiniMax, "combat owns the mix" (2026-07-22)

The first generated score asked for a three-act boss escalation with taiko, frame drums, iron
percussion, and a fierce final phase. It was appropriate in isolation but competed with exactly the
signals the game asks a player to react to. The replacement reverses those priorities: 78 BPM,
sparse low strings, almost no percussion, hollow mids, no choir or trailer climax, and intentional
gaps for tells and impacts. Its measured mean level is roughly 10 dB below the previous file.

The runtime no longer relies on the asset prompt alone. The SFX submix is full gain while the music
bus falls from 0.28 to 0.24 and the streamed score from 0.62 to 0.56. Combined with the source's
roughly 10 dB lower mean level, this remains audible between actions without taking the foreground.
A broad -6 dB peaking cut at 1.8 kHz and a lower low-pass ceiling leave the sword/telegraph presence band open. Every player
verb and all seven boss windups now trigger fast music ducking before their transient; those cues
use the six reserved critical voices rather than competing with phase-three projectile clutter.

### Changed from v2.7.1

- The MiniMax file is a new 150.349-second sparse instrumental, not a remix of the old score.
- Music/SFX separation is encoded as QA invariants for submix levels, presence dip, action-duck
  coverage, and minimum duck depth.
- Adaptive intensity can still lift the score slightly, but no longer opens it past the action-safe
  spectral ceiling; stagger now clears more space rather than merely reducing the drums.

## v2.9 — Codex (GPT-5), "fixed by Codex: trustworthy combat" (2026-07-23)

The owner asked for game-developer testing before implementation. Three independent read-only
reviewers covered combat systems, adversarial state/input QA, and player-facing combat UX. Their
runtime reproductions became acceptance tests before deployment rather than remaining review notes.

### Combat must tell one truth

Input TTLs now age in simulation time, so a natural follow-up pressed on a hit spark survives the
50–90 ms hit-stop that freezes attack recovery. Title/retry confirmation clears combat actions,
and the 2.6-second intro animates without updating the boss or live hazards. Damage is accepted only
in `fight`; victory owns a same-frame trade, clears every hazard, persists once, and cannot be
overwritten by a contradictory death screen.

The shared action queue is 260 ms rather than the original 190 ms. A read-only post-fix playtest
showed that heavy contact leaves about 200 ms of committed recovery, so a roll pressed on contact
expired one frame before it could execute. The longer queue does not cancel the commitment; it only
retains the command until recovery ends, and it still expires well before a delayed ghost action.

Player roll i-frames are tracked separately from generic post-hit invulnerability, so only the
early roll window can produce a perfect dodge. Player lunge motion integrates its authored velocity
envelope across each timestep; measured light reach is 41.44 world units at 30, 60, and 120 Hz.
Boss windup/recovery damping uses time-scaled exponents. Heavy and finisher force lives in a
separate decaying impulse so stalk AI cannot overwrite it.

Meteor barrages now use relative intervals after a real windup: six phase-two markers span about
1.95 seconds and nine phase-three markers about 2.41 seconds, with stale movement cleared. Volley
has a cheap danger-coded fan preview. Phase changes remove pre-existing projectiles, rings, and
meteors before the forced ring windup, preserve their push as player impulse, and stamp the ward.

### Touch and semantic controls cannot fight the player

Expanded fingertip targets deliberately remain generous, but an overlap resolves to exactly one
nearest normalized action. Touch action plates remain active through both queued and executing
states; the first real move/attack dismisses the tutorial; an empty flask is dimmed. Mobile phase
copy shrinks to fit, the phase-two sovereign name uses a compact form, and phase pips retain their
reserved width.

Window-level game input ignores interactive DOM targets. Focusing the semantic companion during a
fight pauses simulation and audio; Enter/Space activates only the focused control. Leaving the
companion resumes from a fresh RAF timestamp. This fixes both the inaccessible Sound button and
the hidden roll that previously happened behind it.

### Make the room specific without making it heavier

The old soft circular floor variance read as bokeh. `buildFloor()` now deterministically bakes
irregular stone wear and angular chips, biased away from the central telegraph band. A broken grace
seal, fallen blade, toppled censer, and split tablet sit at the outer ring as low-contrast landmarks.
Boss steps stamp at most 16 footprints; slams, meteors, and charge impacts add sharper cracks; phase
changes draw amber seams and charcoal ward failures onto the existing scorch canvas. Eight of the
existing 64 motes render as tiny grace flakes. There is no new canvas, particle, gradient-per-frame,
or decorative hazard-red work.

### Let light hits own a phone speaker

The light-hit layer most likely to disappear was an expendable transient above 9 kHz. It is now a
short 1.45–3.2 kHz band-pass contact crack inside the six-voice critical reserve, and every impact
briefly ducks the music. QA artificially fills the ordinary voice budget and verifies that this
contact cue is still admitted.

Cold audio setup also changed shape. Canonical waveform preparation runs in the first zero-delay
task at 24 kHz; the full 1.9-second noise bed still covers the longest cue, while a 1.55-second mono
stone impulse is applied to the already-spatialized stereo send one task after the gesture. This
replaces v2.8's longer synchronous stereo allocation and keeps a fresh mobile first gesture below
the 20 ms gate without changing the common music/SFX/limiter route.

### Verification and release contract

`npm run lint`, `npm run build`, and `npm run qa` pass locally. The expanded Playwright gate covers
desktop, 390×844 mobile, and genuine touch; exact ATK/ROLL expanded-region overlap; DOM Enter/Space
ownership; focused-settings pause; clean intro/retry; same-frame terminal arbitration; natural
combo buffering through hit-stop; 30/60/120 Hz lunge and boss damping; 1.95/2.41-second meteor
cadence; preserved heavy impulse; roll-only perfect dodge; phase hazard cleanup/scars; pressure-safe
light-hit audio; and cold first-tap initialization. It also retains the previous phase, victory,
save migration, hazard-palette, soundtrack, and interruption checks.

### Changed from v2.8

- The sparse MiniMax composition remains unchanged. The fix is contact-band SFX priority and
  per-impact ducking, not another music replacement.
- Arena identity is still procedural and baked; the soft circular material pass is replaced, not
  layered with more runtime effects.
- The room response is now 1.55-second mono after spatialization rather than a longer stereo IR.
- Read-only reviewer agents are credited here for verification input; the code and documentation
  changes in this pass were implemented by Codex and recorded as such in `PROVENANCE.md`.

## v2.9.1 — Codex (GPT-5), "rise on the first touch" (2026-07-23)

The owner reported that the visible “touch to rise again” prompt did not respond. The existing
touchscreen automation could revive after a forced terminal state, but it did not cover a natural
player death or embedded browsers that translate a tap to Pointer Events without delivering the
legacy `touchstart` path the engine depended on.

Confirmation now has two layers. The existing 260 ms simulation-time buffer still owns ordinary
title and intro timing. A monotonic confirmation sequence separately records every keyboard,
mouse, touch, semantic, and primary pointer gesture. Death and victory snapshot that sequence on
entry and accept the next gesture after their presentation gate. A terminal tap therefore survives
slow-motion, a focus handoff, a cleared action buffer, or pointer-only event translation without
allowing the attack that killed the player to count as a retry.

The mobile gate now kills the player through `Player.takeDamage`, waits until the actual retry copy
is visible, captures `touch-death.png`, and proves that one real touchscreen tap resets the player
and increments attempts exactly once. It then repeats the death and dispatches only a primary
touch-type `PointerEvent`; that path must also enter the intro with no console errors.

### Changed from v2.9

- Terminal confirmation is deliberately durable and event-counted; combat actions remain
  short-lived buffered commands.
- Pointer Events supplement the existing mouse and Touch Events listeners. Touch joystick and
  action-button geometry still use the established Touch Events bridge.
- No visual, audio, save-schema, combat-balance, or render-budget changes were made.

## v2.10 — Codex (GPT-5), "one trial, one truth" (2026-07-23)

The owner asked whether the nine difficulty settings were scaled correctly. Three independent
review lanes covered curve math, adversarial combat logic, and player experience. Their claims
were reproduced on both v2.9.1 local and production before code changed:

- the semantic dial remained active in combat, so a run could start at +5, switch to −3 live
  damage/i-frame/stagger rules, and still save a +5 record;
- phase two authored three swipes while phase three silently fell back to two;
- at +5 phase two the follow-up hit arrived in about 204 ms while the renderer began 38% through
  a different 331 ms telegraph; phase three fell to about 184 ms;
- no-stagger began abruptly at +3 while the gold poise bar continued promising it could break;
- the second flask disappeared at +4, stacking another cliff before the capstone;
- the title showed the global 0:40 PB while the selected +5 record was 2:00, and the FORSAKEN +5
  text overlapped its final dial pip by about 10 px.

The same probes also established what should not change. A +5 direct hit tops out at 36/110 HP,
post-hit invulnerability prevents a burst from landing multiple times, phase transitions clear
stale hazards, and projectile/ring travel speeds remain readable because they do not inherit the
boss animation multiplier.

### One immutable trial

`difficultyForGrace()` now authors a complete modifier object. `resetFight()` copies it into
`trialMods`; every combat lookup reads that snapshot until the next reset. Both canvas and semantic
trial controls reject changes during intro/fight. A direct stale grace mutation likewise cannot
change live modifiers. The selected setting, modifiers, HUD, and record key therefore describe the
same run.

The curve retains the existing linear speed and damage ramps. Flask counts across −3…+5 are now
`4,4,3,3,3,2,2,2,1`. Poise stays 120 through +2, becomes 162 at +3 and 204 at +4/+5; the stagger
opening narrows from 1.70 s to 1.45 s and 1.25 s. Only +5 refuses stagger. Its HUD says
`IRONBOUND`, and the poise sliver becomes a visibly locked segmented rail.

### A telegraph is the timer

Both late phases now start a three-swipe combo. Touch fresh windups have a 300 ms floor; repeated
swipes have a 240 ms floor. Each chosen windup stores one exact `currentWindup`, and both update
logic and rendering use it, so every tell starts at 0% and completes when its hit becomes active.
Desktop timing and fixed projectile/ring travel retain their authored behavior.

The title record uses `bests[selectedGrace]`; the legacy top-level PB is only a grace-0 migration
fallback. The dial pips move left within their existing plate, with a measured six-pixel minimum
clearance from the full FORSAKEN +5 label.

### Verification and artifacts

`qa/verify.cjs` now enumerates every grace level and asserts strictly increasing speed/damage,
published flask/poise counts, +5-only no-stagger, preview-to-active equality, immutable combat
modifiers, 28 damage from a base-20 +5 hit, +3 breakable poise, +5 reset-without-stagger, semantic
locking, selected records, exact phase-two/three touch timing, three-swipe counts, and measured
title-label clearance. The established desktop/mobile/touch, audio, terminal, palette, performance,
and death/retry coverage remains in the same zero-error gate. `touch-forsaken-title.png` and
`touch-forsaken-ironbound.png` are mandatory visual-review artifacts.

### Changed from v2.9.1

- Difficulty balance, UI truthfulness, and two swipe behaviors changed; save schema, boss HP,
  player damage, projectile/ring travel, music, SFX, arena rendering, and render budgets did not.
- This pass was implemented and documented by Codex after the multi-agent findings were verified
  independently against local and production v2.9.1.

## v2.10.1 — Codex (GPT-5), "the evidence is part of the release" (2026-07-23)

This is a documentation and package-metadata pass; gameplay, rendering, audio, save data, and
deployment code are unchanged. The repo already explained the v2.10 design but did not preserve
the complete acceptance trail in one discoverable document. `info.md` still described the generic
scaffold and a dead `/mnt/agents/output/app` path, the npm package still called itself
`my-app@0.0.0`, and the runbook prescribed a restart helper absent from the actual SSH shell.

`docs/releases/v2.10.md` now records the three reviewer lanes by agent and remit, every reproduced
pre-fix defect, the negative findings that protected good combat behavior from churn, the complete
nine-level curve, implementation invariants, exact local/GitHub/production measurements, merged
SHA, PR/release links, production service/HTTP checks, generated artifact names, the 20.4 ms
timing-only miss and 14 ms accepted rerun, and remaining device/listening limits.

The README links that record from the release summary and structure map. `info.md` is now a concise
current project index. npm metadata is `gracefell@2.10.1`. `AGENTS.md` documents the real
user-systemd production sequence and exact-SHA/public-URL acceptance. `.artifacts/` is ignored so
named local evidence runs remain available without polluting a future commit.

### Changed from v2.10

- Documentation discoverability, package identity, and operational instructions changed.
- No v2.10 gameplay claim was broadened: graphics proposals remain future work and are not
  attributed to the difficulty release.

## v2.11-rc1 — Codex (GPT-5), "the silhouette is the animation" (2026-07-23)

This is a local, not-yet-deployed candidate for GitHub issue #10. Kimi / OKComputer supplied the
original Penitent concept image and brief. The first Codex prototype copied that image's dark hood,
thin gold trim, face ellipse, and line-cross sigil into the existing circular body. The real
`390x844` capture disproved the premise: at the authored `0.55` camera zoom, the body is only about
19 CSS pixels wide, so those internal details became dust and combat states still depended on the
sword.

The owner requested a design-house redesign and selected the second of three generated directions,
the Kite-Veil state strip. It is a derived direction that partially carries Kimi's hooded-penitent
idea, not a full implementation of Kimi's raster. Three read-only studios worked independently:

- character silhouette: make the parchment hood the outer facing contour, not an accessory;
- combat UX: give move, roll, light, heavy, flask, stagger, and death different large masses;
- technical art: keep the player procedural, preserve collision and sword logic, and spend only a
  few flat Canvas2D fills per frame.

### The seven-state grammar

`Player.drawKiteVeilBody()` rotates one local coordinate system into `facing` (or `rollDir`) and
uses the same parchment kite, charcoal torso, and soot-violet veil family in every state:

- move is an arrow with one rear fin;
- roll contracts into a notched spindle, hides the sword, and keeps the established spirit trail;
- light pinches into a spear beneath the existing silver attack ribbon;
- heavy opens into a hammerhead during charge, then collapses for the release;
- flask closes into a seed and replaces costume noise with one large gold diamond;
- stagger breaks the hood/veil angle and temporarily removes the resting sword;
- death becomes a flattened leaf with no sword or gold.

The hitbox remains `r=15`. No input timing, damage, stamina, iframe, camera, boss, save, audio, HUD,
or difficulty behavior changed. The parchment and gold remain decorative/player-owned; the
reserved danger colors are untouched.

### Design validation

The selected source, seven mobile crops, and their same-image comparison live under
`.artifacts/design-house-10/` and `.artifacts/kite-veil/` (ignored local evidence). The first
comparison found that flask and stagger still inherited the resting sword, a moderate fidelity and
readability miss. Suppressing the sword only for roll/flask/stagger/death produced a passing second
comparison. `design-qa.md` records the source dimensions, viewport/density normalization,
full-scene evidence, focused comparison, required fidelity surfaces, iteration history, and
remaining P3 simplification.

The capture matrix covers all seven states at `390x844 @2x` and `1280x800 @1x`, with zero browser
or page errors. The synthetic full-scene render submission remains well below one millisecond per
render in both target contexts; percentage comparisons at that scale are too noisy to be useful,
so the acceptance criterion is the absolute 16.7 ms frame budget plus the full gameplay gate.

### Changed from v2.10.1

- The default player rendering and state silhouettes changed.
- Player mechanics, collision, sword attacks, world effects, boss rendering on the normal route,
  audio, accessibility, persistence, and difficulty did not change.
- The query-gated Blade-Saint experiment from the earlier issue review remains local-only and is
  not part of this candidate's production claim.

## v2.11-rc2 — Codex (GPT-5), "the halo keeps the score" (2026-07-23)

The owner asked for Malakar to receive the same production character pass. Kimi / OKComputer's
GitHub issue #14 supplied the concept image and brief: replace the radial spiked monster with a
Fallen Blade-Saint whose broken sword halo is both identity and volley ammunition. Codex authored
the live Canvas 2D renderer and state logic as a partial translation; painterly detail and literal
raster fidelity were never shipped or claimed.

The earlier `?concept=kimi` route had proven that a pointed, facing-led body, split cape, and nine
orbiting blades read more clearly than the old sphere. It was not production-ready: the default
route remained unchanged, volley depletion was a one-frame conditional, every blade returned
immediately, and the phase-three sword appeared fully formed.

### The Blade-Saint contract

Malakar now uses the Blade-Saint renderer on the default route:

- a narrow charcoal armor ellipse and pointed helm establish facing inside the unchanged `r=34`
  collision circle;
- a split translucent ash cape is present from phase one, with quiet gold/ember edging rather than
  the reserved hazard hue;
- nine sword fragments orbit as the broken halo;
- phase two lights only their tips with `PAL.amber`;
- phase-three transition draws a mirrored shadow coatsword over `0.4 s`, while attack logic remains
  bound to the original weapon and telegraphs;
- the former oversized fireball core becomes one smaller failing amber saint-light.

The halo is now honest state rather than decoration. A phase-one volley spends five fragments,
phase two spends seven, and phase three spends nine. `haloSpent` persists after the attack and
reforges one fragment every `0.8 s`. The established cooldowns and projectile counts are not
changed. During poise stagger, orbit speed falls to `0.22` and each blade receives an independent
radius wobble, so the broken halo itself communicates the opening.

### Validation

The same-image comparison in
`.artifacts/boss-blade-saint/source-vs-mobile-states.png` places the `640x640` Kimi source beside
seven deterministic `390x844 @2x` implementation states: phase one, volley ready, seven fragments
spent, partial reforge, stagger, partial shadow-sword draw, and complete dual swords. Matching
full-scene and `1280x800` evidence is stored in the same ignored artifact directory.

The first full-scene comparison found that the study's central ellipse slightly exceeded the
collision radius. Tightening it to `0.96r × 0.68r` and shortening the helm point restores body-to-
hitbox honesty without shrinking the cape, halo, or weapons. The capture harness reports no page
or console errors. Synthetic phase-three rendering remains below `0.4 ms` per submission in both
target contexts, far below the `16.7 ms` frame budget.

`qa/verify.cjs` now proves phase-two volley consumes seven visible blades while spawning seven
projectiles, exactly one blade returns across the `0.8 s` boundary, the second sword reaches 50%
at `0.2 s` and 100% at `0.4 s`, and the boss hit radius stays 34.

### Changed from v2.11-rc1

- The default boss rendering changes from the radial crown monster to the Fallen Blade-Saint.
- The query-only concept gate is removed because the accepted design is now the default.
- Three visual-state fields were added for halo depletion/reforge and shadow-sword draw.
- Boss health, collision, poise, damage, movement, attack selection, attack timing, projectile and
  ring behavior, audio, difficulty, saves, player rendering, HUD, and arena rendering are
  unchanged.

## v2.11 — Codex (GPT-5), "the focus must return to the blade" (2026-07-23)

The two character candidates became the public v2.11 release through PR #17. The exact merge was
deployed before three independent user personas exercised mobile touch, desktop combat, and
new-player/accessibility paths on the public URL.

The panel found one blocker that deterministic combat-state tests had missed. A keyboard or
assistive-technology user could focus the semantic **Start fight** button and activate it with
Enter. The button then became disabled when combat began, but its React focus handler had already
set `Game.uiFocused=true`. Since a disabled button cannot produce the blur needed to clear that
flag, the fight could remain permanently paused behind an apparently live canvas.

The correction establishes a simple ownership rule: a semantic confirmation is a handoff back to
the game. `confirmFromUi()` performs the confirmation, clears UI focus in the same game action,
and focuses the canvas without scrolling. The QA start path now uses the semantic button on
desktop and proves all four postconditions: the simulation is unpaused, `uiFocused` is false,
the canvas owns document focus, and the animation frame loop is running.

This was deliberately kept separate from character art and combat balance. The follow-up changes
no collision, damage, timing, audio, camera, touch layout, boss logic, or save data. The user panel
also produced non-blocking ideas—close-range silhouette separation, stronger phase-one/phase-two
contrast, a flask completion pulse, clearer trial direction copy, and a brighter retry-prompt
pulse trough—which remain future polish rather than silently expanding the release.

### Validation and release evidence

- lint, production build, and the complete local desktop/mobile/touch gate pass with zero errors;
- desktop semantic Start is exercised with focus plus Enter, not a canvas shortcut;
- the existing interruption regression continues to prove simulation and audio pause on browser
  interruption;
- the exact production revision, CI run, public health, full public QA, issue disposition, persona
  observations, and known physical-device limits live in `docs/releases/v2.11.md`.

### Changed from v2.11-rc2

- Both candidate character directions are now the shipped default production release.
- Semantic confirmation explicitly returns ownership and focus to the game canvas.
- Desktop QA covers the real accessible Start button path and its focus/RAF invariants.
- Documentation now distinguishes initial deployment, post-launch persona evidence, the fixed
  blocker, future polish, and bounded browser/device claims.

## v2.11-doc1 — Codex (GPT-5), "credit the image, keep acceptance open" (2026-07-23)

The owner clarified the provenance and lifecycle boundary after v2.11 shipped. Kimi / OKComputer
created the six original GitHub concept images and briefs in issues #10–#15. Codex did not convert
those images directly into sprites: the live player and boss are procedural Canvas 2D systems that
only partially translate the selected #10 and #14 visual ideas.

For the player, Kimi's hooded Penitent image was an upstream reference. The later Kite-Veil
seven-state strip came from the Codex-led design-house pass and intentionally diverged toward
phone-scale macro-silhouettes. For Malakar, Kimi's Fallen Blade-Saint image and brief supplied the
halo/cape/duelist identity; Codex implemented the persistent ammo halo, reforge timing, stagger
wobble, and animated shadow sword.

Because "partially translated" is not the same as final visual acceptance, graphics issues
#10–#15 were reopened and annotated on GitHub. Their final closure is deferred until the owner's
later review. Completed audio issues remain closed.

### Changed from v2.11

- Attribution now separates Kimi's concept images/briefs from Codex's procedural implementation.
- Documentation no longer implies the selected images were reproduced in full.
- Graphics issue state now reflects deferred acceptance instead of zero open issues.
- No runtime code, asset, gameplay, balance, audio, bundle, or deployment behavior changed.

## v2.11-doc2 — Codex (GPT-5), "close the graphics ledger" (2026-07-23)

The owner completed the later graphics review and explicitly requested closure. Issues #10 and
#14 are closed as completed because their selected concepts have shipped as acknowledged partial
procedural interpretations. Issues #11, #12, #13, and #15 are closed as not planned because those
alternative directions were not selected or implemented.

The attribution boundary from v2.11-doc1 remains unchanged: Kimi / OKComputer supplied all six
concept images and briefs; Codex authored the live Canvas 2D implementation and state logic. Issue
closure records product disposition, not full raster fidelity.

### Changed from v2.11-doc1

- Final graphics issue closure is no longer deferred.
- #10/#14 are completed; #11/#12/#13/#15 are not planned.
- No runtime code, asset, gameplay, balance, audio, bundle, or deployment behavior changed.

## v2.11.1 — Codex (GPT-5), "let the victory land" (2026-07-23)

The boss-defeat screen showed a grade and run statistics, but save schema v2 only persisted wins
and best times. The complete scorecard disappeared on reload. The replay gate also accepted any
confirmation newer than the boss-death snapshot after a short delay, so a celebratory second tap
made during the reveal could remain queued and skip the result as soon as the lock expired.

Save schema v3 adds `lastScore` plus `bestScores[trial]`. Each scorecard preserves grade, time,
trial, attempt, damage dealt, and wounds taken. `onBossDeath()` constructs and persists the
scorecard synchronously with the win, before the first victory frame. Legacy v1/v2 saves still
load; they simply begin without a scorecard until the next victory.

Victory now owns input for 4.5 simulation seconds. Confirmations made during that hold are consumed
and advance the terminal sequence, so they cannot trigger later. The replay prompt appears only
after the hold and requires a fresh input. Its alpha now moves between `0.64` and `0.88` on an
approximately 5.5-second cycle instead of nearly disappearing on the previous faster pulse.
`SCORE SAVED` stays stable beneath the result, and the title remembers the last saved grade.

### Validation

- the scorecard exists in localStorage at `stateT=0`, before the reveal;
- the last score and per-trial best score reload through a new `Game` instance;
- a confirmation at `VICTORY_INPUT_DELAY - 0.4` is discarded and the state remains victory after
  the delay passes;
- a fresh post-prompt click starts the next intro;
- desktop and `390x844` true-touch victory screenshots keep the score and replay prompt in bounds;
- the full gate retains v1 migration, per-trial records, terminal trade, resurrection, and
  semantic control coverage.

### Changed from v2.11

- Save schema changes from v2 to v3 with backward-compatible scorecard fields.
- Victory result pacing and replay input ownership change.
- Combat, scoring/grade rules, difficulty, audio, character rendering, collision, and saves from
  existing players remain otherwise unchanged.

## v2.11.2 — Codex (GPT-5), "three taps must mean three cuts" (2026-07-23)

The authored light string had three damage steps, but the input system represented each action as
one expiring boolean. Repeated ATK presses made before the current swing ended kept refilling the
same slot. A phone or desktop player tapping three times at 50–100 ms spacing therefore produced
only two strikes; waiting roughly one attack cycle between presses produced all three. The combo
logic was intact—the input representation was losing multiplicity.

`Player.queuedLightAttacks` now records at most the two follow-ups a three-hit string can consume.
It accepts only discrete light presses while a light attack is active. Roll still wins when both
are ready at a transition, and the queue clears on roll, heavy, damage, insufficient stamina, or
combo expiry. This deliberately avoids a generic action queue: defensive timing, flask use, and
heavy commitment retain their existing one-slot buffer behavior.

The finisher had a second identity problem. Although it was a light-combo step, its 24 damage
crossed the boss's old `dmg > 20` audio threshold and the player explicitly called
`swingHeavy()`. It sounded like HVY. Player strikes now pass an explicit light/finisher/heavy
impact identity. Step three uses the varied light swing/contact family and a silver damage number;
HVY alone owns the heavy swing/contact cue and gold impact color. Damage, range, arc, lunge,
stamina, hit-stop, camera punch, knockback, poise, and combo timing are unchanged.

### Validation

- deterministic desktop simulation sends three presses 50 ms apart and requires damage steps
  `0, 1, 2`, all marked non-heavy;
- a 390×844 true-touch browser taps the visible ATK circle three times 50 ms apart and requires the
  same sequence;
- cue capture requires `swing-2` and `hit-light-2`, rejects every heavy cue, and proves the queue
  returns to zero;
- lint, production build, and the complete desktop/mobile/touch gate pass with zero errors.

### Changed from v2.11.1

- Rapid repeated light presses retain their count instead of collapsing into one buffered flag.
- The third light hit is sonically and visually distinct from HVY.
- No balance value, boss behavior, difficulty, collision, save schema, UI layout, music asset, or
  rendering asset changes.

## v2.12 — Codex (GPT-5), "easier to finish, harder to master" (2026-07-23)

The owner wanted this genre to welcome a beginner without becoming trivial for a strong player.
The existing nine-position dial was mathematically coherent, but it mixed assistance, baseline
authorship, and mastery into one unexplained row. A new player started on Measured 0 before the
game had taught its defensive loop, while the expert end mostly compressed the same reactions
through speed, damage, flask, poise, and stagger values.

The research pass separated the product promise into three layers:

1. **Journey** is a visible recommended first-completion candidate.
2. **Measured** remains the canonical existing baseline.
3. **Oaths** add learnable decisions for expert rematches.

This follows the shared pattern in Xbox difficulty guidance, Hades' explicit God Mode versus
Hell/Pact paths, Steelrising's barrier-specific assistance, and Dead Cells' granular accessibility
options. It also keeps the FromSoftware-like mastery premise intact: stable rules allow the player
to attribute a win to recognition and execution rather than hidden adaptation.

### Why Journey reuses -2

Journey starts at the existing -2 values instead of inventing a new balance branch: approximately
0.85x boss speed, 0.70x incoming damage, wider roll/perfect windows, and four flasks. Those values
already had nine-level regression coverage and did not remove a boss move or phase. The new work is
mostly disclosure and teaching:

- the title says `recommended · 15% slower · 30% softer · 4 flasks`;
- boss windups name the attack at -3/-2;
- a four-beat contextual rite teaches move → roll → perfect-dodge poise → stagger punish;
- the death screen turns the recorded lethal source into one next-attempt instruction;
- attempt two exposes one explicit step toward Grace.

A truly absent save starts at -2. Existing saves keep a stored `grace`; old saves that never had
the field deliberately remain Measured 0. That distinction prevents a release from silently
reclassifying a returning player's records or preferred timing.

The tutorial persists only when the player strikes a real stagger. Merely calling the instruction
or seeing the state is not completion. Each new beat replaces the previous one because the
phone-scale arena cannot afford a tutorial checklist over combat.

### Why Oaths use packets

An expert already recognizes a faster isolated swipe. Further speed compression eventually tests
reaction hardware and motor speed more than judgment. Oaths therefore keep the v2.10 numeric curve
but add capped authored packets and modest recovery pressure.

Only the four direct attacks may chain:

- volley → charge → swipe;
- charge → swipe → slam;
- swipe → slam → volley;
- slam → volley → charge.

Ring, meteor, and spiral remain isolated because composing area-denial moves can close the arena
without producing an interesting decision. A queued step must still pass its normal range, phase,
and cooldown eligibility. Immediate-repeat weighting is reduced, and the existing touch windup
floors remain load-bearing. Oath I/II may add one follow-up; Oath III/IV increase frequency and
recovery pressure without adding a third beat; Oath V may add two follow-ups. The queue clears on
phase transition and stagger.

The HUD says `OATH CHAIN step/total` because a new rule must be visible while the player is
learning it. The deterministic QA route forces `volley 1/3 → charge 2/3 → swipe 3/3`, then proves
Measured and Journey have no queued packet.

### Combo feedback is contact truth

v2.11.2 made three rapid ATK taps mechanically reliable but did not show the player that the
string was progressing. v2.12 adds a presentation-only contact chain:

- `CHAIN 1/3 ◆◇◇`;
- `CHAIN 2/3 ◆◆◇`;
- `LIGHT FINISHER ◆◆◆`.

The counter advances inside `playerStrike()` only after a valid arc/range contact. A whiff does not
earn visible progress. Damage, heavy, roll, or timer expiry breaks it. This state never drives
damage or attack selection, so presentation cannot become a second combo authority. The finisher
uses the silver/spirit treatment established in v2.11.2 and remains clearly separate from HVY.

### Death input ownership

The Grace offer introduced a subtle terminal-input risk: a touch event also increments the
monotonic confirmation sequence used by **rise again**. If the offer only changed the number, the
same gesture could restart behind it on the next frame. `handleDeathGraceInput()` owns that
sequence, consumes the short confirm flag, and leaves the state dead. A later fresh touch still
retries normally. QA proves both steps and retains the earlier pointer-only resurrection path.

### Save and scoring

Save schema v4 adds `tutorialComplete` and optional scorecard fields for perfect dodges, flasks
used, and Oath rank. Optional fields keep old scorecards valid. The victory card surfaces execution
and the Oath when relevant; per-path bests remain authoritative.

### Rejected alternatives

- **Default phase checkpoints or continuation:** retry has no runback, so this would remove the
  whole-fight endurance arc while adding terminal-state and persistence complexity. Unscored phase
  practice remains a later evidence-driven option.
- **Hidden death-responsive tuning:** assistance is an offer, never an invisible rules change.
- **A large assist dashboard:** a first-time player cannot yet diagnose which of many sliders they
  need. One recommended path and one-step Grace offer keep the choice legible.
- **Chaining hazards:** area denial is excluded from packets.
- **More particles or world detail:** all new feedback uses existing screen-space primitives and
  tiny state fields. The environment and asset footprint stay unchanged.
- **Expert input penalties:** Oaths do not shrink buttons, remove buffering, conceal tells, or
  lower mobile reaction floors.

### Validation and deployment

The candidate `52debee54e3cd012984246a70996ab982330c200` passed lint, build, and the complete
local desktop/mobile/true-touch suite with zero errors. The phone evidence was visually inspected
for the Journey title/tell, Oath packet, combo finisher, and Receive Grace states. GitHub Actions
run `30015973110` passed before PR #26 merged.

Production was fast-forwarded to
`0a9cea3a742edeb9e438aaffe6c6886ffc6e5e7b`, built on the host, and restarted. The service is
active, the loopback and public health endpoints pass, and a second complete suite against
<https://gracefell.alyoechosys.dev> reports zero errors. The host bundle is `347.91 kB`
(`108.35 kB` gzip); no runtime asset was added. Accepted public audio initialization was 14.8 ms
desktop, 12.4 ms mobile, and 19.6 ms on the immediate fresh-phone gesture.

The machine gate establishes coherence, input ownership, UI fit, and rule stability. It cannot
declare the numerical Journey candidate universally optimal. Beginner, intermediate, and expert
human cohorts remain the correct source for later tuning.

### Changed from v2.11.2

- First-time default changes from Measured 0 to disclosed Journey -2; existing/legacy saves retain
  Measured or their stored path.
- Negative Grace gains named beginner tells and slightly longer recovery.
- Positive paths become Oaths with authored direct-attack packets and shorter recovery.
- The perfect-dodge/poise/stagger loop gains a contextual persistent rite.
- Death gains attack-specific advice and a voluntary, input-safe Grace offer.
- Connected light attacks gain transient chain and finisher feedback.
- Save schema changes from v3 to v4 with backward-compatible tutorial/execution fields.
- Boss health, phases, individual attack mechanics, player damage/timing, music, action SFX,
  procedural character art, collision, touch layout, input buffering, and established mobile
  tell floors remain otherwise unchanged.

## v2.12.1 — Codex (GPT-5), "consent, then clarity" (2026-07-24)

Three live-player lanes reviewed every path after v2.12: a 390×844 touch player covered Grace,
a keyboard/accessibility newcomer covered the middle, and a desktop souls veteran covered the
Oaths. The complete production gate separately exercised all nine configurations, authored
packets, phase transitions, victory persistence, and terminal states.

Most alleged defects did not survive cross-checking. Exact pointer tests disproved a reported
double-stepping path selector; shared same-origin browser storage explained one wrong-path reload;
and a debug-assisted renderer shrink never reproduced in natural play. One defect did survive
three independent reproductions: a left movement press buffered immediately before a lethal hit
could be consumed by the newly opened Receive Grace screen. The game silently lowered the trial
without a fresh terminal choice.

### Terminal consent

`onPlayerDeath()` now discards the buffered left press at the state boundary. Held movement is not
turned into a menu command; the player must release and press left again, or tap the visible offer.
The regression reproduces the exact race, advances one frame, proves the path remains Measured,
then submits a fresh left press and proves Grace is still accepted while the death state remains
in control. Confirm-sequence ownership and one-touch resurrection retain their v2.12 behavior.

### Smoothing the first Oaths

Human play showed that Measured is an intentional canonical step, but Oath I compounded a new
two-beat packet with speed, damage, and recovery compression too abruptly. Oath I/II now teach
their authored chains with slightly less raw pressure:

| Oath | Speed | Damage taken | Recovery |
|---|---:|---:|---:|
| I | 1.04x (was 1.06x) | 1.05x (was 1.08x) | 0.99x (was 0.97x) |
| II | 1.10x (was 1.12x) | 1.13x (was 1.16x) | 0.96x (was 0.94x) |

Oath III–V, every Grace path, Measured, flasks, poise, stagger, boss health, attack composition,
damage windows, and mobile telegraph floors are unchanged. The curve remains strictly monotonic;
the first two vows simply emphasize pattern learning before the established expert curve resumes.

### Readability without scene weight

- Named beginner tells and Oath packet progress now use one mutually exclusive backed chip above
  the boss bar. The larger type and border survive motion without occupying the combat center.
- When the player and Malakar overlap, two small spirit arcs lift the player silhouette from the
  boss mass. The path is drawn only at close range and adds no asset or particle system.
- The ATK circle shows up to two tiny diamonds for accepted queued follow-ups. Connected-hit
  progress remains the separate combat-truth counter above the arena.
- On a 390px record-heavy title, run statistics move above the start prompt, use a compact size,
  and receive a maximum width. Settings, trial summary, and touch instruction no longer compete.

### Rejected alternatives

- Measured was not weakened; it remains the canonical authored timing and damage.
- Oath III–V were not softened; expert players retain the accepted capstone curve.
- No extra particles, texture, sprite, post-processing pass, or always-on HUD panel was added.
- The audio budget was not relaxed to hide machine-load variance. One exact candidate run passed
  all budgets; later runs that failed contained only cold-init timing overruns and no gameplay,
  state, layout, console, or audio-graph error.

### Local validation

The exact `index-BkkaBUTU.js` candidate passed lint, TypeScript/Vite production build, and the
complete desktop/mobile/true-touch suite with zero errors. The accepted run recorded 20.8 ms
desktop audio initialization, 14.2 ms mobile, and 13.4 ms on an immediate fresh-phone gesture.
The input regression recorded `grace 0 → 0` across the carried-input frame and `0 → -1` only after
the fresh press.

Screenshots were inspected for Journey and Oath cue chips, the light finisher, close-contact
silhouette separation, title layout, terminal Grace, and a synthetic phone title containing 12
victories, a best time, and a last grade. The full deployment and public replay evidence is kept
in `docs/releases/v2.12.1.md`.

### Changed from v2.12

- Receive Grace requires a fresh post-death directional input.
- Oath I/II raw numerical pressure is eased while their chain rules remain intact.
- Beginner tells and Oath counters gain a backed, larger combat chip.
- Close-range player separation and queued touch-follow-up feedback are added.
- Record-heavy narrow titles gain dedicated spacing.
- Save schema, music, SFX, boss phases/patterns, advanced Oaths, beginner paths, touch geometry,
  collision, scoring, and runtime asset footprint remain unchanged.
