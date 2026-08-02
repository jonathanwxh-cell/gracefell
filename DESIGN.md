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

## v2.13 — Codex (GPT-5), "hold the blade" (2026-07-24)

GRACEFELL already paused safely when the browser lost focus or a player opened the semantic
settings. That infrastructure stopped the animation loop, reset input, suspended Web Audio and the
streamed score, then resumed with a fresh frame timestamp. The missing piece was ownership: players
could not deliberately hold a fight while keeping the page open.

### One freeze, three owners

`manualPaused` is deliberately separate from `interruptionPaused` and the settings-focus flag.
`syncPauseState()` pauses while any owner remains active. This prevents a common state bug where
returning to the tab or moving focus out of a menu would resume a fight that the player had
explicitly paused.

P and Escape enter that same transition from the window-level input system. The persistent DOM
button invokes it directly, so resume still works when RAF is stopped. On resume, `Input.reset()`
discards actions pressed while the pause card was visible; they never become a delayed slash, roll,
or flask on the first live frame. `lastTs` is refreshed before RAF restarts, so wall-clock pause
duration cannot become one giant simulation step.

The first keyboard regression found a subtle ordering problem: the generic first-gesture hook could
initialize and resume Web Audio immediately after the pause transition suspended it. Pause keys now
run first-gesture initialization before changing state. A second repeated run found a separate
presentation race where the engine had resumed but React's 250ms poll still showed RESUME. The
engine now notifies the semantic shell immediately whenever manual pause changes.

### Mobile-first presentation

The PAUSE/RESUME button is a semantic 76×44px DOM target placed to the left of the existing SOUND
control, above the canvas and clear of the 390px player-health plate. It uses top/right safe-area
insets, returns focus to the canvas after activation, exposes `aria-pressed` and the P/Escape
shortcuts, and stays usable while the canvas loop is stopped.

A restrained center card dims the live arena only while manual pause owns the fight. It states
exactly how to resume and that time, attacks and input are held. The frozen fight remains visible
underneath, preserving orientation without adding a menu tree, render surface, runtime asset,
particle, or ongoing frame cost.

### Local validation

The final local `npm run qa` completed with zero errors on the production build at desktop
1280×800, mobile 390×844, and a separate `hasTouch + isMobile` 390×844 context. New assertions
cover:

- visible, unclipped 76×44px control geometry on phone and desktop;
- P-to-pause and Escape-to-resume ownership;
- real touchscreen PAUSE and RESUME taps;
- frozen fight time, player state, boss state, and stopped RAF across a 280ms hold;
- suspended AudioContext while paused and a running loop after resume;
- immediate label, `aria-pressed`, live status, and canvas-focus changes; and
- disposal of an attack entered during pause before the first resumed frame.

The accepted artifacts are under the named local QA folder
`gracefell-qa-pause-local-4`; `desktop-paused.png` and `touch-paused.png` were visually inspected.
The exact GitHub, deployment, and public replay record is kept in `docs/releases/v2.13.md`.

### Changed from v2.12.1

- Active fights gain an explicit pause/resume state and centered frozen-state card.
- Phone/desktop gain one persistent semantic PAUSE/RESUME button; desktop also gains P/Escape.
- Manual pause becomes an independent owner of the existing interruption-safe freeze.
- Resuming clears inputs made during pause and updates the DOM state immediately.
- Combat rules, difficulty, boss AI/patterns, player timing/damage, save schema, score, music,
  procedural SFX identity, touch combat layout, collision, assets, and frame-time work remain
  unchanged.

## v2.14 — Claude (Opus 4.8), "feel & spectacle" (2026-07-24)

Directed follow-up to a read-only, gamer's-eye polish review. The review's finding: the combat
*feel* is already strong (hit-stop that freezes the sim but keeps rendering, perfect-dodge
slow-motion, a look-ahead follow-camera, layered reward juice), so this is a last-10% pass. Three
items shipped; two the review raised (hold-to-charge heavy, phase-three audio lift) were split into
a later "offense" pass because they need touch-input surgery and audio-bus work that deserve their
own QA lane.

### 1. Dynamic combat camera
The follow-cam already leads the player and weights toward the player/boss midpoint, but `camZoom`
was a static viewport-fit — and on a 390px phone that fit is pinned to the 0.55 floor, i.e. the most
zoomed-*out* the game ever is, on the smallest screen, exactly where reading is hardest.
`combatZoomTarget()` now eases the zoom between a calm ceiling (1.16× the fit) and the fit floor by
a combat-intensity signal `clamp(threats/5 + (phase-1)*0.5, 0, 1)`. A clean 1v1 tightens for
intimacy; the moment area-denial (projectiles/rings/meteors) or a later phase fills the arena it
widens back so the player never zooms *into* a storm they then can't clear. Exposed like
`menuGeom()` so QA reads the intent numerically: clean melee target > fit×1.04, eight live
projectiles ≤ fit×1.02.

### 2. Stagger execution
Breaking poise is a real investment (~7–8 openings) that paid only 1.4× — a soft reward for the
loop's climax. The first *heavy* into a staggered Malakar is now a riposte: `30 × 2.6` base, and
since `Boss.takeDamage` still applies the ×1.4 staggered multiplier the execution lands ~109 vs a
normal staggered heavy's 42. Fires exactly once per poise break (`executeConsumed`, reset in
`triggerStagger`), then reverts — a punish spike, not a stagger-lock. Juice stays inside the
existing gates: `shake(14,0.4)` (photosensitivity), a spirit-hued `EXECUTE`, gold flash,
`zoomPunch`, extra hit-stop, existing `audio.stagger()`. No new Web Audio nodes; reserved danger
hue untouched. +5 IRONBOUND never staggers, so it never executes — consistent with its contract.

### 3. Arena deterioration
Phase transitions call `deepenArena(phase)`, which stamps scorch cracks into the *offscreen scorch
canvas* (accumulation surface, never per-frame `drawArena` — the baked-floor invariant) and raises
ambient ember density (`emberDensityMul`, a spawn-rate divisor). `phaseDecay` (1 at phase 2, 2 at
phase 3, reset in `resetFight`) makes it assertable. "The sovereign burns" and "grace abandons him"
now *look* like the banners say, at zero new render surface/sprite/particle-budget cost.

### Changed from earlier passes
- **Camera (was: static viewport-fit).** `Game.baseZoom` is stored and `camZoom` eases toward
  `combatZoomTarget()` while `state === 'fight'`; every non-fight state still eases to the plain fit,
  so intro/title/terminal framing is unchanged.
- **Staggered heavy (was: flat 1.4×, v2.0/v2.10).** The *first* heavy per stagger now executes for
  more; subsequent staggered hits are unchanged.

### QA / verification
Three desktop-lane assertions added to `qa/verify.cjs` first (TDD), written defensively (a missing
API fails cleanly): camera intent in clean vs. loaded states, once-only execution spike, deepening
`phaseDecay`. All failed on pristine code (RED: `base:null`, `decay:null`, `dExec:42==dNormal:42`)
and pass after implementation; lint and build clean. The only local failures are the load-sensitive
audio-init budgets (20/25 ms) — the shared box runs 40+ services; they pass on the clean CI runner
and are untouched here (no `audio.ts` change). Final visual/feel tuning (zoom ceiling, scorch
density, execution damage) is left for an owner playtest, per the standing "screenshots aren't
always agent-reviewable" note.

## v2.15 — Claude (Opus 4.8), "offense" (2026-07-24)

The offense half of the polish review, split from v2.14 because both items reach into fragile
subsystems (touch input, the audio bus graph) that deserve their own QA lane.

### Hold-to-charge heavy
Offense was one-note (light-3 + a fixed heavy) against a 1350-HP boss. The obvious fix — a charged
heavy — normally means firing heavy on *release*, adding latency to the basic verb. Instead this
charges by *holding through the existing wind-up*: a quick tap fires today's heavy unchanged
(`charge01` = 0, same timing), but if HVY is still held when the strike frame arrives the player
roots and `heavyChargeT` builds to `Player.HEAVY_MAX_CHARGE` (0.5 s). Release/max fires a strike
scaled by `charge01` — up to 1.75× damage, +16 range, and a `charge*40` poise bonus so charged
heavies are *the* poise-breaker feeding the v2.14 stagger execution. Cost = exposure (rooted,
telegraphed): Souls charged-R2 risk/reward. A gold ring tightens/brightens as it charges. Input:
keyboard/right-mouse via `input.held.heavy`; touch via new `Input.touchPoints` (tracked by
identifier) + `Game.heavyInputHeld()` reading `touchLayout()` (the SSOT). Discrete heavy still fires
on press/touch-start; charge is additive. No change to `queuedLightAttacks`, roll priority, or
one-action touch targeting.

### Phase-3 musical lift
`setPhase()` stored the phase but was silent; music escalated only by boss-HP intensity. `setPhase`
now marks dirty and `updateCombatState()` (still the owner) folds a `phaseLift` (0/0.08/0.2 for
phases 1/2/3) into the existing procedural buses (drums, tension pad, soundtrack cutoff). No new Web
Audio nodes, no MP3 change (no `SOUNDTRACK_VERSION` bump), master route + bus-gain contracts intact.

### Changed from earlier passes
- **Heavy (was: fixed 0.62 s commit).** A tap is the old heavy exactly; only holding past the strike
  frame is new. Damage/range/poise scale with `charge01`, which is 0 for a tap.
- **`audio.setPhase()` (was: inert).** Now drives a sustained lift via `updateCombatState`; the
  boss-HP intensity curve is unchanged and adds on top.

### QA / verification
Four assertions added first (TDD), green after implementation: charge accumulates on a real keyboard
hold (`heavyChargeT ≥ 0.4`, sim-gated), charged heavy `> 1.4×` normal (via `charge01` injection),
touch held-detection over the HVY zone, and `debugState().phaseLift ≥ 0.2` at phase 3. Lint/build
clean. Real touch-and-hold is covered by the detection unit test + an owner playtest (Playwright
touch has no hold primitive). Only the load-sensitive audio-init budgets fail locally (green in CI).

## v2.16 — Claude (Opus 4.8), "hygiene A: server + build" (2026-07-24)

First pass over the ten repo-audit issues filed 2026-07-24. Five contained server/build fixes; the
dead-dependency prune (#37) is deferred to its own pass. No gameplay change.

- **#45 security headers.** `server.mjs` sends `nosniff` / `Referrer-Policy: no-referrer` /
  `X-Frame-Options: DENY` via a shared `SECURITY` object. Full CSP deferred until fonts are
  self-hosted (#39), since a CSP now would have to whitelist the Google Fonts CDN.
- **#46 immutable audio.** `/audio/` joins `/assets/` in the immutable branch; the MP3 URL is
  already `?v=`-versioned so a year-long cache is safe. Was `no-cache` → 4.6 MB revalidated per load.
- **#38 removed `kimi-plugin-inspect-react`.** Opaque dev Babel plugin gone from `vite.config.ts` +
  `package.json`; lockfile regenerated; build ~0.85 KB smaller, unaffected otherwise.
- **#41 `npm ci` adopted.** The "npm ci fails on this lockfile" note was stale — reproduction shows
  `npm ci` exits 0. Flipped README/AGENTS/info/CI to `npm ci` for determinism (what #41 wanted).
- **#44 LICENSE.** Added an all-rights-reserved `LICENSE` + `package.json "license": "UNLICENSED"`.

### QA / verification
New `qa/verify.cjs` header assertion (node `fetch` against the QA server): root has `nosniff` +
`Referrer-Policy`; `/audio/` MP3 is `immutable`. Direct-curl confirmed. lint/build clean; `npm ci`
verified clean. Only the load-sensitive audio-init budgets fail locally (green on CI).

## v2.16.1 — Claude (Opus 4.8), "hygiene B: dependency prune" (2026-07-24)

Resolves audit issue #37. No behaviour change — pure dead-code + dependency removal, with the
build and Playwright gate as the safety net.

The rendered surface is `main.tsx → App.tsx → pages/Home.tsx` (React + react-router + the canvas
engine). Everything else under `src/` was scaffolding from the initial Vite+shadcn template and
unreachable from the game. Deleted `src/components/` (50 shadcn/ui files), `src/hooks/use-mobile.ts`,
`src/lib/utils.ts`, `src/App.css`, `components.json`, and **43 production deps** (all `@radix-ui/*`
plus cmdk/recharts/embla/react-day-picker/date-fns/vaul/react-hook-form/@hookform/zod/input-otp/
react-resizable-panels/next-themes/sonner/lucide-react/cva/clsx/tailwind-merge). Kept react,
react-dom, react-router. `src/` is now six files. CSS bundle 80 KB → 10.6 KB; JS unchanged.

### Kept deliberately (live)
- `index.css` — the game's real styles + the load-bearing `--sa-b`/`--sa-r` safe-area vars.
- `App.tsx` — `main.tsx` renders it (`<BrowserRouter><App/></BrowserRouter>`).
- `tailwindcss-animate` — required by `tailwind.config.js`.

### Verification
`tsc` passing is the proof nothing live imported the deleted tree (a broken import fails the build).
lint/build clean; lockfile regenerated; `npm ci` verified; full gate green apart from the
load-sensitive audio-init budgets (green on CI).

## v2.17 — Claude (Opus 4.8), "web polish: fonts + PWA" (2026-07-24)

Resolves audit issues #39 and #40. No gameplay change.

### #39 self-hosted fonts
`index.html` pulled Cinzel + Cormorant Garamond from Google's CDN every load (IP leak,
render-blocking, no offline). Now self-hosted: latin-subset woff2 in `src/fonts/`, bundled +
content-hashed by Vite into `/assets/` (inherits the `immutable` cache), `@font-face` in
`index.css`. Both are variable fonts — Google served one latin file per family for all requested
weights (Cinzel 400–900, Cormorant 400/500), so three files + seven weight-mapped faces reproduce
the exact prior rendering. Zero third-party requests now.

### #40 favicon / PWA / meta
Code-drawn `public/favicon.svg` (grace-gold halo + falling blade on `#0b0907`). `apple-touch-icon`
(180) + `icon-192`/`icon-512` rendered from the SVG by headless Chromium (code-generated, not
authored bitmaps). `public/manifest.webmanifest` (standalone, theme `#0b0907`, the three icons).
`<meta description>` + Open Graph + Twitter card. `public/` now holds the audio + these icons +
manifest (was audio-only).

### QA
New `verify.cjs` check: served HTML has zero `googleapis`/`gstatic`, a manifest + icon link + meta
description, and favicon/manifest return 200. Fonts serve from `/assets/` as `font/woff2` immutable
(curl-confirmed). lint/build clean; gate green apart from the load-sensitive audio-init budgets.

## v2.17.1 — Claude (Opus 4.8), "code quality: tests + typing" (2026-07-24)

Resolves audit issues #43 and #42. No behaviour change.

### #43 unit tests
Added Vitest + `src/game/engine.test.ts` (14 tests): math helpers, deterministic `seededRandom`,
the `difficultyForGrace` −3..+5 balance contract, and the `isVictoryScore` save-v4 validator. To
test `difficultyForGrace` without a canvas, its logic became a pure exported module function and the
`Game` method delegates to it (single derivation point preserved). `isVictoryScore` exported. CI
runs `npm test` before the Playwright gate. Importing `./engine` in node works — no top-level DOM.

### #42 typing
The 10 render methods were `(Game.prototype as any).X = …`; the `export interface Game` merge
already declares them, so the `as any` was redundant — now plain `Game.prototype.X`. The full
render-extraction refactor was deliberately not done (high risk / low benefit on a live engine).

### Verification
`npm test` 14/14; lint/build clean (build typechecks the test too); full gate green apart from the
load-sensitive audio-init budgets. Closes out all ten repo-audit issues (v2.16 → v2.17.1).

## v2.18 — Codex + MiniMax Music 3.0, adaptive phase score (2026-07-24)

The phase-three bus lift in v2.15 could change intensity, but all three boss
phases still shared one recording. v2.18 gives each phase its own composition
without turning the game into a soundtrack showcase. The score remains
subordinate to telegraphs, player verbs, hit confirmation, and phone-speaker
clarity.

### Three related cues, one restrained mix

MiniMax Music 3.0 generated one accepted Phase 1 cue and replacement takes for
Phases 2 and 3 at 78 BPM in the same D-minor / Phrygian chamber palette. The
falling D–C-sharp–B-flat–A motif changes orchestration rather than loudness:
low strings and empty stone in Quiet Ash, bowed iron and dry pulse in The
Sovereign Burns, exposed viola/harmonics in Gracefall.

Generated takes were not shipped directly. Independent music-direction review
found a Phase 2 opening dropout plus fade-shaped Phase 2/3 loop resets. Codex
re-cut each accepted source into an exact bar form and created a permanent
one-second wrap crossfade:

- Phase 1: source 2.175 s, 10 bars / 30.769229 s.
- Phase 2: source 24.275 s, 12 bars / 36.923061 s; the dropout is excluded,
  low bass is reduced, and 2.15 kHz receives additional space.
- Phase 3: source 17.800 s, 16 bars / 49.230771 s; the quiet introduction,
  later surge, and generated outro are excluded.

The MP3 masters measure -21.26 / -21.27 / -21.26 LUFS-I with safe true peaks
and no sustained edge silence. First-to-last 250 ms level differences remain
1.19 / 1.64 / 1.33 dB. The three files total 2.81 MB, below the deleted
4.82 MB single score. Full prompts, trace IDs, mastering cuts, filters, hashes,
and measurements live in `public/audio/README.md`.

### Permanent two-deck controller

Two permanent `HTMLAudioElement` + `MediaElementAudioSourceNode` decks stream
through the established presence-dip, filter, soundtrack, music, and master
buses. Replacing a phase changes the inactive element's `src`; it never creates
another retained source/gain pair. This matters on repeated attempts and after
playback failures, where the first implementation leaked nodes.

Phase changes inspect the active deck's 78 BPM position. They wait no more than
250 ms for a nearby beat, then apply a 720 ms equal-power crossfade. The
sub-second ceiling lets the new phase identity arrive inside the boss's opening
read instead of several seconds later. Resetting a fight requests Phase 1
immediately.

An incoming playback rejection keeps the requested phase pending, restores the
outgoing deck, and retries twice. Persistent failure returns to the immediate
procedural score. Pause during a crossfade suspends the audio clock; resume
must successfully restart both decks before the incoming deck can become
active. The procedural beat scheduler now derives its interval from the same
78 BPM constant.

### Combat remains the foreground

The existing full-gain SFX / 0.24 music / 0.56 soundtrack ceiling and -6 dB
presence dip stay intact. Ducking is now a set of expiring requests rather than
one cancelable automation: the strongest active request owns the music gain,
so a weaker swing cannot raise the score while a boss warning is still
speaking. A 15 ms attack protects the transient; 120 ms recovery avoids pumping.

Music and Combat effects receive separate 0–100% controls. Defaults are 85%
and 100%; save schema v5 persists both and older saves migrate to those values.
The in-fight MIX control opens a focused dialog that freezes simulation but
deliberately keeps the score clock audible. TEST SFX auditions a real combat
crack. Done, Escape, and the backdrop all consume their closing input, clear
combat buffers, return focus to the canvas, and resume without a surprise
attack. Focus is trapped inside the modal, background canvas/pause controls
leave the tab order, and MIX is disabled while a manual pause owns the fight.

### Verification

The desktop, 390×844 mobile, and true-touch lanes retain every earlier combat,
difficulty, retry, score, and performance check. v2.18 adds:

- two prepared streaming decks, unlock-to-playing timing, fixed node count,
  and Phase 1/2/3 handoff assertions;
- pause during crossfade, one-shot playback rejection/retry, active-deck
  playback safety, immediate Phase 1 reset, and procedural fallback coverage;
- strongest-duck overlap, expiry, full recovery, and volume-change-during-duck;
- live MIX audio while simulation is frozen, unique Test/Done controls,
  Escape/Done dismissal, focus return, and no buffered light attack;
- save-v5 volume round-trip plus legacy default migration;
- media loudness, true-peak, silence, loop-edge, duration, and hash records.

Final visual browser checks at 1280×800 and 390×844 confirmed that the MIX
dialog stays within the viewport, the top MIX/PAUSE/SOUND controls preserve
44 px targets, and no console warning or error is introduced.

### Changed after the parallel v2.16–v2.17.1 stream

The adaptive-score pass was rebased after the server-hardening, dependency-pruning,
web-polish, and unit-test work landed. Both histories remain intact. The integration
also exposed one Windows-only cache-policy defect: `path.normalize()` converted URL
slashes before the `/audio/` and `/assets/` test, so those files were served with
`no-cache` locally. Cache classification now uses the untouched URL path, while
filesystem normalization remains responsible for safe file resolution. The QA header
probe targets the shipped Phase 1 master rather than the removed single-score file.

## v2.19 — Codex, battle navigation and readable records (2026-07-24)

Three read-only player lanes approached the deployed v2.18 game as a mobile
beginner, a veteran desktop player, and an audio/accessibility player. The
consistent findings were not that Malakar needed another system. They were that
existing state was sometimes too implicit: rapid taps could feel discarded,
resource bars required genre knowledge, a narrow keyboard viewport clipped its
instruction line, and the semantic layer could start combat without exposing
enough information to play it. The owner also asked for an in-battle route back
to the main menu and a dated score view on that menu.

### Navigation is a temporary layer, not a second game screen

The permanent playfield remains the canvas. MENU and SCORES are small semantic
DOM entry points; their larger surfaces exist only while opened. MENU appears
after the title across intro, fight, defeat, and victory. In a live fight it
reuses the established `uiFocused` pause owner, suspends Web Audio, traps focus,
removes canvas/background controls from the tab order, and clears combat input
on dismissal. The confirmation names the cost before acting: the current battle
is abandoned, while previously earned victories and settings remain.

`Game.returnToTitle()` centralizes the transition. It clears all pause owners and
input, resets the transient fight, restores the title state, and does not award
or consume an attempt. A React-only state change would have left engine/audio
ownership split across two worlds; a canvas-only menu would have lost keyboard
focus, screen-reader semantics, and reliable 44 px touch geometry.

### The chronicle records facts and admits what it does not know

Save schema v6 adds `scoreHistory`, newest first and capped at 20. A new
victory copies the existing scorecard and adds `completedAt` as an ISO timestamp
at the same synchronous point where the win is saved. The title SCORES dialog
shows grade, fight time, path, completion date/time, damage, wounds, flask use,
perfect dodges, and attempt number.

v5 knew only the most recent score, not when it happened. Migration preserves
that score with `completedAt: null`, shown as “Date unavailable.” Inventing the
current migration date would look complete while being false. Invalid history
entries are rejected by the exported `isScoreHistoryEntry()` validator; both
fresh ISO timestamps and honest legacy null dates are unit-tested.

The list is local-device history, not an online leaderboard. Twenty entries keep
the saved payload and phone dialog bounded without hiding the best-per-path
records already owned by `bestScores`.

### Press feedback and hit feedback stay different

The three-diamond chain continues to count connected light hits. v2.19 also
draws queued presses as `INPUT QUEUED` or `NEXT` diamonds during an active light
animation. This addresses the beginner report without giving a missed swing
credit, extending the combo window, or making light attacks behave like HVY.
The queue remains capped at two and all existing roll priority/clear rules stay
unchanged.

HP, STAM, and FLASKS are now named directly on the canvas. Desktop help sits
farther from the bottom edge; narrow non-touch help wraps into two short lines;
title copy reflows without colliding with the Path plate. These changes add only
text draws—no asset, particle, surface, or per-frame allocation system.

### Semantic state is inspectable, not noisy

`Game.uiSnapshot()` now carries player resources, boss resources/phase/action,
combo hits, and queued lights. React exposes them in a labelled definition list
without `aria-live`, so a screen reader can inspect current state without
hearing changing health percentages every 250 ms. The polite live status is
reserved for the broader battle state, phase, and named telegraph.

The earlier report that focused semantic controls stayed clipped did not
reproduce against the source contract: `:focus-within` expands the panel.
Instead of changing it speculatively, the QA gate now measures the focused panel
at 620 px wide with `clip-path: none`. The reported pause-card delay was also a
capture-timing artifact; engine pause rendering and the current DOM label change
on the same owner transition and remain covered by the pause regression.

### Audio ownership must converge after asynchronous transitions

Rapid MENU close followed by manual pause exposed a real edge case that older
tests did not create. `AudioContext.resume()` is asynchronous; a later pause
could see the context still suspended and skip its own `suspend()`, after which
the older resume promise made audio run under the paused game.

`GameAudio.queueContextState()` now serializes reconciliation. Each task checks
the newest requested state after an awaited browser transition and converges
again if ownership changed mid-flight. Immediate media-element pause remains,
and soundtrack restart happens only when the reconciled context is running and
no pause owner remains.

### Verification

The release expands the repository contract rather than relying on screenshots
alone:

- 16 Vitest checks include v6 history timestamps and legacy null dates;
- desktop and 390×844 lanes measure MENU/SCORES geometry, empty/populated score
  dialogs, focus restoration, semantic combat state, safe fight freeze/resume,
  return-to-title invariants, v6 persistence, and v5 score migration;
- true-touch taps MENU, proves frozen simulation/audio, resumes without input
  leakage, renders rapid queued-light acknowledgement, and persists a timestamped
  victory;
- the existing combat, difficulty, death/retry, music, mix, crossfade,
  performance, accessibility, and responsive gates remain green;
- final `npm run qa`: `ok=true`, `nErrors=0`;
- the in-app browser inspected 1280×800 and 390×844 title, score, fight,
  confirmation, and return states with no browser warning or error.

### Changed from v2.18

- Save schema moves from v5 to v6 by adding bounded dated score history.
- A battle can return to the title through a confirmed engine-owned transition.
- HUD and semantic layers expose existing combat state more clearly.
- Web Audio state changes are serialized to protect rapid pause-owner handoffs.
- No difficulty value, boss pattern, player timing/damage, grade formula,
  soundtrack asset/mix ceiling, render budget, or touch-combat geometry changed.
- The implementation passed clean-runner CI in GitHub Actions run 30086801225,
  merged through PR #53 as `741999d`, and was deployed to the production
  `gracefell.service`.
- The complete public desktop/mobile/true-touch gate passed against
  `https://gracefell.alyoechosys.dev/` with `ok=true`, zero console errors, and
  the established performance thresholds unchanged.

## v2.20 — Codex, "the fixed-pool Ash Gale" (2026-07-24)

The weather request arrived after v2.19 was already live. The constraint was not
simply “add particles”; it was to make the room change visibly during the fight
without masking the increasingly dense boss patterns or spending the phone
render budget that those patterns need.

Browser guidance pointed toward reuse rather than another effect stack:
pre-render repeated static work, batch Canvas state changes, avoid full-screen
blur, and measure frame cost rather than assuming it. Gracefell already had the
right raw material—64 screen-space ash/grace motes, three god rays, an ember
emitter, a cached floor/scorch surface, phase flashes, and three phase scores.
The implementation changes those existing systems instead of adding weather
assets, a shader, a second canvas, or a second simulation.

### Three authored states, one procedural motion field

`weatherForPhase()` is the renderer's single profile table:

- **Quiet Ash** keeps the original near-still vertical drift, warm grace points,
  steady rays, and neutral ash-black room.
- **Ember Gale** moves warm ash diagonally left-to-right, lengthens it into
  streaks, leans the existing world-space embers, warms the backdrop, and gives
  the rays more sway.
- **Gracefall Storm** reverses the wind right-to-left, lengthens pale ash again,
  darkens/cools the backdrop, and weakens the rays.

Two deterministic sine waves supply gust variation. Weather therefore moves
organically without `Math.random()` flicker, a separate timer, or gameplay
state. Phase changes crossfade with a smoothstep over 2.4 seconds. Because the
blend and gust use `Game.time`, hit-stop, MENU, manual pause, and browser
interruption freeze the room with the fight.

### Depth ordering preserves combat truth

The pool remains exactly 64 motes. Forty-eight are batched into two Canvas stroke
paths and drawn above the cached floor but below telegraphs, entities, hazards,
and world effects. Sixteen existing motes become a higher-alpha foreground
slice, but only outside the central 42% band and still below the HUD and touch
controls.

The first visual capture exposed an important ordering mistake: drawing the
background motes before `drawArena()` let the opaque cached floor erase most of
the effect, especially on a 390×844 phone where the arena fills the viewport.
The final ordering draws the floor, restores to screen space for low-alpha ash,
then reapplies the same camera transform for combat. This costs one save/restore
and transform pair, not another surface or render pass.

### Comfort is part of the weather contract

If either flash reduction is enabled or screen shake is disabled, non-essential
weather motion uses a 0.45 scale and streak length falls to 55%. The system does
not add lightning, full-screen opacity pulses, camera movement, or continuous
wind audio. The existing phase roar and gated flash remain the transition cue,
so action sounds and the phase score keep their established mix priority.

### What was rejected

- **Rain:** more visible strokes, weaker thematic fit, and unnecessary screen
  competition.
- **Full-screen fog or blur:** fill-rate cost and obscured telegraphs.
- **Lightning:** redundant with phase flashes and unsafe as ambient decoration.
- **A WebGL weather shader:** disproportionate architecture and regression cost
  for a Canvas 2D game.
- **An OffscreenCanvas worker:** useful for heavy independent renderers, but
  needless coordination for 64 batched primitives.
- **Adaptive particle spawning:** a second quality system would add complexity
  when the existing fixed pool already meets the budget.

### Verification

- Vitest now has 18 checks, including ordered weather profiles, clamped phase
  lookup, and the reduced-motion scale.
- Desktop QA proves the 2.4-second Phase 2 and Phase 3 crossfades, exact
  48-background/16-foreground split, opposite gale directions, pause-frozen
  blend, reduced-motion wind/streak reduction, and zero console errors.
- Across two green full runs, the same-scene render probe held every phase at
  0.4–0.5 ms median and 0.6–1.0 ms p95. The worst observed Phase 3 versus
  Phase 1 regression was 0 ms median / 0.4 ms p95, below the 0.5/1.0 ms
  feature budgets.
- True-touch QA renders the real Ember Gale at 390×844 and retains all existing
  control geometry, combat, difficulty, retry, audio, and persistence gates.
- Desktop Phase 2/3 and touch Phase 2 screenshots were inspected. Ash reads
  across the arena while the player, boss, ring tell, health bars, MENU, and
  action controls remain visually dominant.
- Final `npm test`, `npm run lint`, `npm run build`, and `npm run qa` pass;
  Playwright reports `ok=true` with zero errors.

### Changed from v2.19

- Phase changes now alter atmospheric motion, colour, backdrop, ray behaviour,
  and ember direction.
- The 64-mote count, existing particle cap, runtime asset set, audio graph,
  difficulty, boss patterns, player timing/damage, saves, layout, and controls
  are unchanged.
- The implementation passed clean-runner CI in GitHub Actions run 30091146680,
  merged through PR #55 as `a9d9ad2`, and was deployed to the production
  `gracefell.service`.
- The complete public desktop/mobile/true-touch gate passed against
  `https://gracefell.alyoechosys.dev/` with `ok=true`, zero errors, and the
  weather, accessibility, audio, navigation, retry, victory, and score-history
  contracts intact.

## v2.21 — Codex, "answer the opening" (2026-07-25)

The six remaining enhancement issues described separate features, but they all
asked the same question: can the player understand and express mastery without
making a beginner's run less trustworthy? The implementation shares terminal,
input, telemetry, and touch-layout foundations instead of adding six isolated
systems.

### Combat verbs preserve defensive truth

ATK during a roll now buffers `rollSlashQueued`. The full 0.42-second roll and
its iframe window finish first; only then does a 0.30-second, 10-stamina recovery
slash begin. It deals 18 base damage, does not advance the standing three-hit
chain, and cannot turn a panic press into an early loss of invulnerability.

A rear hit beyond 110 degrees of Malakar's facing earns 1.25x damage and 1.5x
poise pressure. It is disabled during windup and stagger, so the facing sample
is stable and FLANK never compounds the once-per-stagger EXECUTE. FLANK and
EXECUTE callouts use a higher lane than numeric damage. Terminal transitions
clear remaining floating combat text so a final hit cannot cover the saved
grade.

### The chronicle teaches after combat

Run-local telemetry records light, heavy, riposte, and flank damage; Phase 2/3
entry times; and the final three received-hit sources. It resets with the fight
and never drives damage, grade, AI, or saves. After the established score hold,
a compact semantic terminal plate shows the damage mix, phase splits, recent
wounds on defeat, or the next grade condition on victory. This places analytical
detail where attention is available instead of adding another live HUD.

Victory now exposes three deliberate DOM actions after 4.5 seconds: REMAIN
replays the completed path, ASCEND advances exactly one step (including Grace
toward Measured), and SHARE renders a 1080x1350 PNG locally. Web Share is used
only when file sharing is supported; otherwise the same Blob downloads. The
card includes grade, time, trial, date, damage, wounds, and attempt, makes no
network request, and revokes its object URL.

### One mirrored touch contract

Save schema v7 adds `leftHanded`. `touchLayout()` mirrors the complete action
cluster, while `Input.leftHanded` mirrors joystick acquisition; heavy-hold
detection, rendering, fingertip hit-tests, title and semantic toggles, tutorial
copy, and help copy all read those authorities. Older saves default to the
established left-stick layout.

### Difficulty disclosure, not retuning

The nine numeric configurations remain unchanged. Positive path summaries now
name incoming-damage pressure, exact two- versus three-beat chains, flask count,
poise increase, and FORSAKEN's no-stagger rule. This fixes the observed clarity
gap without invalidating records or changing what any path asks the player to
execute.

### Validation

- 19 Vitest checks include the published difficulty table and rear-arc geometry.
- The established desktop/mobile/true-touch suite passes with `ok=true` and
  zero console, input, audio, layout, persistence, accessibility, or performance
  errors.
- `qa/v221.cjs` proves safe roll-to-slash sequencing, exact 30 versus 37.5
  front/rear heavy damage, mirrored action/joystick geometry, save-v7
  handedness, terminal fit at 390x844, a downloadable PNG over 10 KB, and
  exactly one-step Ascension.
- The expanded gate exposed an existing Web Audio edge: direct `.value`
  assignment could overlap a still-ending equal-power curve. Transition
  completion now holds/cancels automation before setting deck endpoints.

### Changed from v2.20

- Adds roll slash, flank reward, terminal mastery feedback, explicit Ascension,
  offline victory sharing, and mirrored touch layout.
- Save schema changes from v6 to v7 with a backward-compatible `leftHanded`
  default.
- Difficulty numbers, boss patterns, phase weather, music masters and mix
  ceilings, standing combo timing, roll iframe duration, grading, and runtime
  visual/audio assets are unchanged.
- The implementation passed GitHub Actions run 30139153859, merged through PR
  #66 as `6bc004d`, deployed to the active zero-restart user service, and passed
  both complete and v2.21-focused public QA with zero errors. Exact receipts are
  preserved in `docs/releases/v2.21.md`.

## v2.21.1 — Codex, "fit the short phone" (2026-07-25)

The released v2.21 title menu still let independently positioned text converge
on short phone browser viewports once saved victory information appeared. The
repair made the measured top of the settings plate authoritative for the saved
result, prompt, touch guidance, and Journey/Oath summary, and shifted the whole
five-row plate only when bottom clearance required it. Drawing and hit-testing
continued to share `menuGeom()` and `menuRows()`.

This was a presentation-only hotfix. Difficulty, boss behavior, combat timing,
weather, audio, scoring, persistence, accessibility semantics, and touch hit
targets remained unchanged. Local, CI, and public true-touch acceptance are
recorded in `docs/releases/v2.21.1.md`.

### Changed from v2.21

- Compact title copy is anchored to the settings plate rather than independent
  viewport percentages.
- Short-phone bottom clearance moves the complete settings group as one unit.
- True-touch QA now proves each vertical boundary through the footer.

## v2.21.2 — Codex, "one desktop hierarchy" (2026-07-25)

A live 1280x800 desktop audit with saved progress exposed the same architectural
split outside the compact branch: saved results used one viewport percentage
while the prompt and controls used others. Their baselines ended only six pixels
apart. At 1920x1080, the fixed 600px settings plate and 14px row copy also read
as a phone-sized utility beneath the cinematic wordmark.

The title copy now anchors to `menuTop` on every viewport. Desktop widths at or
above 1600px receive one capped scale, shared by plate width, row height, row
copy, controls, summaries, saved results, and vertical rhythm. The cap is 1.2x,
so large displays gain legibility without turning the menu into a full-width
dashboard. The wordmark measures its actual font metrics and reduces only when
needed to fit the available narrow-phone width.

Keyboard focus still reveals the semantic companion and still owns Enter/Space
without leaking input into the Canvas game. Its formerly free-wrapping buttons
now form a six-column themed grid: start and sound share a row, both audio
sliders use full width, the Journey/Oath chooser reads as one three-part row,
the trial explanation uses full width, and safety settings share the final row.
The panel remains scroll-bounded on short viewports.

### Two autonomous review rounds: the Trial Seal

Three independent game-menu reviewers covered art direction, player-facing
information architecture, and interaction/accessibility. Round one agreed that
the repaired layout still read as a logo followed by a settings dashboard: the
difficulty row lacked a name, copy shifted between lore and utility voices, and
the start prompt did not clearly dominate the secondary controls. Their shared
direction was a single Trial Seal rather than a larger structural rewrite.

The implementation gives the title one action hierarchy:

- `RAISE YOUR BLADE` is the sole primary call to action, with a platform-aware
  click, Enter, or touch hint.
- `CHOOSE DIFFICULTY` names the desktop control explicitly; compact screens use
  `DIFFICULTY`. `JOURNEY · GUIDED` and the other trial labels sit beside a
  measured pip scale and plain effects such as `Less damage taken`.
- Desktop guidance is key-first (`WASD MOVE · SPACE ROLL · J ATTACK · K HEAVY
  · F FLASK`); the touch version names the left and right thumb roles.
- Safety settings use open hairlines and lower emphasis so they remain available
  without competing with the selected trial.
- The wordmark is drawn once with measured letter spacing rather than literal
  spaces, which gives desktop and mobile the same typographic voice.

Round two retested the implementation on 1280x800, 1920x1080, and 390x844.
All three reviewers found the hierarchy coherent and recommended no structural
rewrite. The remaining interaction finding was precise: Enter on native
`Combat tips` was reaching the game confirm handler, and the disclosure preceded
the primary action in focus order. Native `summary`/`details` are now excluded
from game input ownership, and Combat tips follows the primary action group.
The focused controls panel also receives a real dismissible backdrop; Escape or
backdrop activation returns focus to the Canvas title.

### Validation

- Live production audit reproduced the 1280x800 saved-score collision before
  editing and found no console errors.
- Local review covered fresh and saved title states at 1280x800, a saved state
  at 1920x1080, the keyboard focus panel, and 390px/360px true-touch viewports.
- Automated semantics prove the primary action precedes Combat tips, Enter
  toggles the native disclosure without advancing the Canvas confirm sequence,
  and backdrop/Escape dismissal restores game focus.
- Geometry assertions prove the compact difficulty label, pip scale, and
  selected trial do not collide, with zero desktop, mobile, or touch overflow.
- `npm run lint`, 19/19 Vitest checks, and `npm run build` pass.
- `npm run qa` passes with `ok=true` and zero errors, including title-copy
  separation, narrow wordmark fit, semantic-grid alignment, panel clipping, and
  a focused 1920x1080 title lane. The first isolated run exceeded only the
  unchanged 25ms Web Audio cold-start budget at 31.1ms; the unchanged fresh
  rerun passed the complete gate. No menu, semantic, gameplay, persistence,
  layout, overflow, or console check failed in either run.

### Changed from v2.21.1

- The menu-anchored title rhythm now applies to desktop as well as compact and
  touch viewports.
- Wide desktop title utilities scale together up to 1.2x.
- The narrow wordmark fits measured available width instead of clipping.
- One Trial Seal replaces the formerly anonymous first settings row and explains
  the selected Journey/Oath effects in plain language.
- The title has one primary action and compact, platform-specific control copy;
  safety settings are visibly secondary.
- The focus-revealed semantic controls use intentional grid hierarchy rather
  than flex wrapping, with a backdrop and native disclosure ownership.
- Combat, difficulty, boss patterns, saves, score persistence, weather, audio,
  input bindings, touch hit targets, and runtime assets are unchanged.
- This is a tested release candidate; deployment evidence belongs in
  `docs/releases/v2.21.2.md` and must not be inferred from the implementation
  commit.

## v2.22 — Codex + audio software-house agents (GPT-5 / Codex Desktop), "the recorded-foley release" (2026-07-25)

### Changed from v2.21.2

v2.21.2 remains the title-menu foundation. This release changes combat sound
texture and event ownership without changing damage, timing, AI, difficulty,
music, weather, controls, scoring, persistence, layout, or save schema v7.

Kimi/OKComputer supplied fifty Moonshot-generated, locally mastered combat
masters. The tempting implementation was to replace each synthesized cue with
its similarly named file. That was rejected for three reasons:

1. first-load networking or decode failure would make important actions silent;
2. five alternates were objectively weaker than their companion takes;
3. several dramatic recordings contained mostly sub-250 Hz energy and became
   ambiguous on a phone speaker.

The accepted design treats recordings as authored bodies inside the existing
Web Audio system. Synthesis remains a real fallback, not dead legacy code.

### Four-role review and ownership

The pass separated professional concerns before synthesis:

- a runtime engineer audited decode scheduling, cache versioning, worker bounds,
  teardown, spatial routing, voice pressure, and cold-start behavior;
- a gameplay-audio integrator mapped player verbs, boss tells/releases, phase
  punctuation, footsteps, dry flask, near miss, hurt weight, and sustained
  charge ownership without changing combat timing;
- an SFX mastering engineer decoded and measured all fifty MP3s, held back weak
  alternates, rejected dishonest EQ, and remastered only four justified cues;
- an acceptance engineer built a constrained Save-Data phone lane covering
  loader order, truthful counters, procedural fallback, routing, cadence, and
  every sustained-voice teardown edge.

The roles converged on a hybrid release rather than either an all-sample
replacement or a purely procedural status quo.

### Bounded progressive loading

The runtime manifest admits forty-five cues in three ordered tiers:

- 15 critical cues cover the complete Phase 1/player survival vocabulary;
- 24 phase cues add later boss attacks, reactions, alternates, and terminal
  punctuation;
- 6 cosmetic cues add footsteps, empty-flask, UI, ward, and near-miss texture.

The loader begins only after the first user gesture, uses four workers by
default, three on lower-core devices, and two for Save-Data/2G. A generation
token plus `AbortController` prevents a destroyed or replaced audio context
from publishing late buffers. Cache URLs carry `SFX_VERSION`; diagnostics expose
expected/loaded tier counts, workers, queue, failures, and sustained ownership
so acceptance reads runtime truth instead of inferring success from requests.

The first complete gate exposed that the original critical list was longer
than the natural intro. Reordering was not used to hide the problem: the
critical tier was narrowed to the exact first-fight vocabulary and the full
tier is now proven ready by the natural fight boundary under an artificial
65 ms per-file delay and two workers.

### Recorded body, procedural edge

All accepted cues route through the established distance/pan, arena-send,
ducking, voice-pressure, compressor, and peak-limiter graph. Exact-name lookup
falls back to a stable no-immediate-repeat family. A missing or not-yet-decoded
buffer falls directly through to the cue's existing synthesized implementation.

Measurements showed that boss steps, slams, meteors, roars, execution, and
other large bodies can be almost entirely low-frequency. Re-encoding could not
invent missing performance detail. These cues keep their recorded body but add
one short, restrained 1–5 kHz procedural contact edge so the action survives a
mono phone speaker. This is deliberately not a second full effect.

Only `charge-loop`, `ring-release`, `swing-1`, and `swing-heavy-2` received
conservative headroom, sub-control, or loop-boundary work. The other accepted
masters remain Kimi's bytes. Five weak alternates remain documented and hashed
but cannot enter runtime rotation. This makes both authorship and processing
truth auditable.

### Sustained audio is gameplay state

Charged heavy owns one loop with explicit start, intensity update, and stop
operations. Duplicate starts cannot grow the node graph. Release, damage,
retry/reset, title return, death, victory, and audio teardown all stop the
voice. Boss charge scrape remains short state foley and now fires every
0.36 seconds rather than stacking a roughly 0.6-second recording every
90 milliseconds.

Boss windup and boss release are separate semantics. A boss swipe no longer
borrows the player's heavy-swing voice; phase changes receive a stamp, an
execution receives its own body, and light/heavy wounds route separately after
difficulty-adjusted damage is known. These changes improve recognition without
changing the frame at which any attack begins or lands.

### Protecting the first gesture

Recorded-file work is deferred, but the full matrix retained the strict
25 ms desktop and 20 ms fast-touch initialization budgets. The first complete
run revealed that copying the reusable noise buffer synchronously could still
tip an otherwise unchanged machine over those budgets. Noise and arena-IR data
are now both copied into Web Audio buffers in the existing next task after
unlock; oscillator/sample fallback remains available during that handoff.
No timing threshold was widened to make the release pass.

### Validation and durable evidence

The complete local gate covers desktop, 390×844 mobile, true touch, a fast-touch
audio context, and a constrained Save-Data phone. The v2.22 lane requires:

- exactly 45 unique versioned audio requests with zero HTTP/decode/console
  errors and truthful 15/24/6 counters;
- two constrained workers, all 15 critical cues at the natural fight boundary,
  and 45/45 buffers at completion;
- one audible procedural charge fallback before samples arrive;
- distinct player/boss release and light/heavy hurt routing;
- safe charge-scrape cadence;
- a single deduplicated sustained voice with zero leaks after every ownership
  transition.

Exact local, CI, merged-SHA, production, and public receipts belong in
`docs/releases/v2.22.md`. Asset-level prompts, measurements, hashes, exclusions,
and remaster details belong in `public/audio/sfx/README.md`.

## v2.22.1 — Codex (GPT-5 / Codex Desktop), "the clear-status rail" (2026-07-26)

### Observed failure

A real iPhone Safari capture exposed a cross-layer layout defect that the
existing gate did not measure. The player resources are painted into the
Canvas, while MIX, PAUSE, and MENU are DOM buttons and SOUND is a Canvas hit
target. At 390×844 the protected player HUD occupied `x=16..210`,
`y=16..76`, while MIX occupied `x=146..210`, `y=12..56`. Both controls were
individually in-bounds and fingertip-sized, so the old per-control checks
passed even though MIX hid the right side of the health bar.

### Repair

Compact combat screens now have two deliberate vertical lanes:

- player HP, stamina, and flasks remain in the top status lane;
- MENU, MIX, PAUSE, and SOUND share a single utility rail at `y=82`, with
  8px horizontal gaps at the 390px reference width;
- SOUND now has the same 44px height as the DOM utilities;
- the contextual rite and light-chain acknowledgement move below that rail,
  retaining their separation from both the buttons and one another.

`playerHudRect()` is the shared protected geometry used by rendering and QA.
`combatUtilityTop()` is the compact/wide source for the Canvas SOUND target;
the compact CSS mirrors that one measured top coordinate for the three DOM
utilities.

### Changed from v2.22

This patch changes presentation geometry only. It does not change combat
timing, boss logic, damage, difficulty, input verbs, scoring, save schema,
weather, music, recorded effects, audio ownership, or runtime asset count.

### Acceptance contract

The true-touch lane now measures all four utilities against the player HUD and
against one another. It fails if a control overlaps the protected resource
rectangle, overlaps a peer, leaves the viewport, or is smaller than 44×44.
It also captures `touch-hud-utilities.png` at the point of assertion. Focused
checks cover 320×700, 390×844, and 1280×800 so the mobile repair cannot disturb
the established desktop header.

## v2.23 — Claude (Opus 5), "the render-cost gate" (2026-07-26)

Goal: find performance headroom to spend on graphics polish.

Result: there was none to find, and proving that is the release.

### What the numbers looked like before measuring properly

A per-frame op census showed 41 `createRadialGradient` calls, 9 `shadowBlur`
sets, and only 2 `drawImage` calls — almost nothing cached beyond the baked
floor. Tight-loop micro-benchmarks suggested 2–3 ms/frame was recoverable on
mobile. Four optimisations followed from that reading: pre-baked glow sprites
for particles and for the projectile glow, offset double-draw instead of
`shadowBlur` on combat text, and a baked static vignette.

All four were implemented. All four were rejected.

### Why the estimate was wrong

Tight-loop micro-benchmarks saturate the fill pipeline and force a GPU flush per
iteration, so they measure a pathological case rather than a frame. Three
rounds gave three contradictory answers — including a `drawImage`-versus-`fill`
relationship that inverted between headless software raster and a real GPU.
Extrapolating from them overstated the win by roughly an order of magnitude.

### The method that worked

Serve every candidate build at once, open every page at once, and alternate
measurement blocks between them so drift moves all variants together. Measure a
second copy of the *same* build alongside as a control, so the noise floor is
observed rather than assumed.

The control came in at +0.5%. Glow-particle sprites came in at **+17.6% slower**
with non-overlapping interquartile ranges — a real regression, and the only
result outside the noise. The projectile sprite (−1.5%/−3.5%), the text change
(−1.4%), and the baked vignette (+1.9%) were all indistinguishable from
measuring the same build twice.

A worst-case phase-three frame costs about 1.7 ms on a desktop GPU at 390×844
dpr2. That is a tenth of the 16.7 ms budget. **The draw path is not the
constraint, and new visual work should not be gated on making it cheaper.** The
open risks are per-frame allocation causing GC pauses on phones, and low-end
mobile GPUs — neither of which a desktop timing run can see.

### What shipped

`qa/perf.cjs`. It asserts a deterministic op census instead of a duration,
because canvas call counts for a pinned scene do not vary with machine load,
whereas the existing v2.20 weather budget asserts a 0.5 ms delta against ±20%
measured drift and cannot detect what it claims to.

The load-bearing assertion is the slope, not the ceiling: the scene is censused
with 32 projectiles and again with none, and gradients-per-projectile must stay
at or under 1.2. A new effect that builds a gradient per entity trips that even
while the absolute count still fits under the cap.

The two-consecutive-frame determinism check caught a lazily-built sprite cache
allocating only on its first frame — a single-frame census would have called it
clean.

### Changed from v2.22

Nothing in `src/`. `git diff v2.22.1 -- src/` is empty. This pass adds a QA lane,
an `npm run perf` script, and documentation.

## v2.24 — Claude (Opus 5), "impact frames" (2026-07-26)

Goal: make a hit read harder, now that v2.23 established the frame budget was
never the obstacle.

Three presentation-only changes: the sword trail became one continuously tapered
filled strip instead of up to nine constant-width stroked segments (the old loop
stepped `lineWidth` and alpha per segment and banded at the joins); a swing
stretches the player along its facing and squashes it across, decaying over
0.16 s; and a hit makes the boss's drawn body give ground along the blow while
its shadow stays planted.

### The constraint that shaped it

`design-qa.md` commits the player to seven authored macro-silhouettes that must
survive the 0.55 mobile camera. An anisotropic scale is exactly the kind of
change that quietly breaks that.

So the impact frame is applied to the **transform around** `drawKiteVeilBody`,
never to the authored path data. The state shapes are untouched; only the space
they are drawn in is deformed. At peak stretch the parchment kite and veil mass
stay legible.

### Making "presentation only" falsifiable

The claim that none of this touches combat is the whole safety argument, so it
is asserted rather than stated. `attackStretchImpulse` is a pure exported
function locked by unit tests. `qa/v224.cjs` proves a hit records recoil without
moving `boss.x/y`, that the boss stays put while recoil decays, that a fresh
fight does not inherit it, and that three `render()` calls across a live swing
mutate no simulation state at all.

That last one guards the real hazard: both new effects add logic at draw time,
and the way that goes wrong is a render path writing back into game state.

The lane was mutation-tested — injecting `this.x += Math.cos(a) * 2` into
`Boss.takeDamage` made it fail with `boss position moved on hit`. An assertion
that cannot fail is not worth committing.

### Dropped: the boss rim-light

Scoped, then cut. The boss's established read is "broken blade halo first, split
ash cape second"; a rim competes with the halo for the same edge. The player
already carries a close-range rim, which is what actually solves player/boss
separation at 0.55 zoom, so a boss rim was redundant as well as risky.

### Changed from v2.23

Presentation only. No change to combat timing, damage, poise, stamina,
i-frames, boss AI, difficulty, input, scoring, persistence, save schema v7,
weather, music, or sound effects. Per-frame gradient, `shadowBlur`, and
draw-call counts are unchanged from the v2.23 baseline; the trail is strictly
cheaper than what it replaced.

## v2.25 — Codex (GPT-5), "Blender-assisted visual depth" (2026-07-26)

The goal was not to turn Gracefell into a different game. It was to make the
arena and Malakar feel authored and dimensional while keeping the simulation,
one-canvas architecture, mobile input, telegraphs, and reliable fallback that
already work.

### The renderer decision

Blender became an authoring tool, not the owner of combat. It produces a quiet
2048px arena base, two transparent phase masks, and a very small reference GLB.
The shipping arena is copied once into the existing adaptive floor cache; the
phase masks stamp only when `deepenArena()` reaches an authored boundary. The
accepted Malakar treatment remains Canvas and consumes a read-only presentation
snapshot.

A vanilla Three.js proof was implemented behind `?boss=blender-three`, not
hand-waved away. It renders the compressed 332-triangle GLB into a private
256px surface and composites it into the visible Canvas without a second RAF or
DOM canvas. Native-size review still found its body darker, flatter, and less
legible than the Canvas treatment. It also requires a separately downloaded
dynamic chunk and WebGL-to-Canvas readback. The proof therefore stays an
explicit development comparison; it is not a hidden quality tier or a
production default.

### Load-bearing boundaries

- Simulation and hit geometry remain in `engine.ts`. Renderers receive values,
  never authority.
- A baked base that arrives during combat waits for a reset or other safe
  boundary. Phase-mask completion never paints by itself.
- Floor replacement is atomic. Allocation or `drawImage` failure preserves the
  procedural floor instead of leaving a half-rendered cache.
- GLB failure falls back to Canvas and releases the unused renderer. Real
  context loss falls back temporarily and can restore.
- Runtime art URLs carry `VISUAL_ASSET_VERSION` because `/art/` is immutable.
- Visual work begins after the first audio gesture, in a later task, so image
  decode cannot consume the strict sound-unlock budget. Canvas, keyboard, and
  semantic-button starts share this path.

### What surprised us

The WebP and GLB payloads were not the hard part: the complete default arena
payload is about 125 KiB and the GLB is about 11 KiB. Timing and ownership were
harder. A slow base decode can finish during a live dodge; an immutable URL can
silently preserve old art; a semantically correct Start button can bypass a
Canvas-only gesture hook; and a technically cheap WebGL model can still be the
worse picture. The release gate exercises those failure modes directly.

### Changed from v2.24

Presentation and asset delivery only. The v2.23 operation census and v2.24
impact frames remain intact. No combat timing, damage, poise, stamina, i-frame,
boss-pattern, difficulty, score, save-v7, music, SFX, weather-pool, or control
geometry value changed. The unused one-route React Router wrapper was removed
after the release audit found no advisory-free Node-20-compatible line; `App`
still renders the same sole `Home` page directly.

## v2.26 — Codex (GPT-5), "consequences speak once" (2026-07-26)

The recorded library already contained suitable heavy, hurt, closest-pass,
ward, and stamp material. The missing polish was event ownership, not more
assets.

### Sound follows the visible action

The heavy swing used to start when HVY entered the state machine, roughly
420 ms before the active frame. It now starts at release. The existing charge
fraction passes through release and boss contact to continuously lower and
weight the same recorded/procedural families. This avoids both failure modes:
an uncharged and fully charged hit no longer sound identical, while a charged
hit does not stack another full effect on top of the established impact.

The held charge remains one sustained voice. Its release fade is shortened from
180 to 90 ms; damage takes the immediate cleanup path. No attack time, lunge,
hitbox, damage, stamina, or poise value changed.

### Severity comes from final damage

A boolean heavy flag collapsed very different received hits at the 20-damage
boundary. `Player.takeDamage` now passes adjusted numeric damage to `GameAudio`.
The mix maps `<=12`, `13..20`, and `>=21` to light, medium, and heavy profiles.
The profiles differ in pitch, body, phone transient, room, and ducking. Only
heavy adds one delayed sub tail.

### Closest pass is a one-shot state

A cooldown alone cannot decide whether the same projectile should speak twice
or whether a damaging collision should also whoosh. Each projectile therefore
tracks its closest sampled player distance and one ownership flag. It may voice
only after receding from a safe band just outside collision. Collision resolves
ownership first. This is two optional scalar fields on an existing short-lived
object, with no new pool, query, or render work.

### Denial and boundary cues preserve control

Low-stamina roll/light/heavy input calls a restrained warning but deliberately
does not consume the command. The 260 ms buffer keeps its existing chance to
execute after regeneration.

`clampArena` reports its existing clamp result. The player uses that result,
outward radial speed, and a contact latch to voice the ward once on entry rather
than every frame of boundary sliding. Boss behavior ignores the return value.

### The terminal sound waits for the terminal picture

The grade stamp is owned by the same 1.5-second reveal already used to pop the
seal. A run-local flag makes it exact-once; S receives one restrained upper
tone. Scoring, persistence, result input ownership, and replay pacing do not
change.

### A clean runner found an audio-quantum edge

The first GitHub Linux run exercised the established Phase 2 pause/resume
crossfade and exposed a fractional scheduling race: Chromium observed the
transition deadline, then rejected a final `setValueAtTime(currentTime)` because
that clock sample still fell inside the 720 ms `setValueCurveAtTime` interval
by less than one audio quantum.

Finalization now commits the already-reached endpoints 5 ms beyond both the
authored curve end and the observed audio clock. There is no audible gap: the
curves already end at those values. This changes neither crossfade duration nor
phase timing; it only makes the cleanup write legal across browser schedulers.
The existing full phase-score QA is the regression.

### Changed from v2.25

- Audio event routing and bounded mix parameters change.
- Phase-crossfade endpoint cleanup receives a cross-platform scheduling margin.
- The projectile object gains optional closest-pass state.
- `clampArena` reports its unchanged clamp result.
- Deterministic real-browser QA expands around these contracts.
- No runtime asset, request, startup node, render operation, simulation value,
  difficulty rule, input duration/priority, score formula, save-v7 field,
  weather behavior, music track, or visual treatment changes.

### Release closure and cold-start handoff

Runtime PR #88 merged as `100d59a6522e7ef5607f55ef3f31d1103e4ff394`
after its reviewed-head QA passed. Production-receipt PR #89 merged as
`495303c65ff2b872273fa780d35fbb2a285ccd9c`; its `main` QA also passed, the
server was advanced to that exact clean checkout, and loopback plus public
health remained green on the unchanged `index-CjPWrcKH.js` runtime.

Issues #70–#76 were closed only after that public acceptance, with an
issue-specific ownership and verification receipt on each issue. The durable
[v2.26.0 GitHub release](https://github.com/jonathanwxh-cell/gracefell/releases/tag/v2.26.0)
targets the final documentation checkpoint. Future agents should treat
`docs/releases/v2.26.md` as the complete evidence record, the release tag as
the final repository checkpoint, and runtime merge `100d59a...` as the
gameplay identity. This documentation closure changes no runtime file.

## v2.27 — Codex (GPT-5), "earned offense" (2026-07-27)

The combat already had a readable defensive spine: recognize a named tell,
roll through it, damage poise, then Execute the stagger. The missing fun was
not another boss pattern or permanent button. Repeated offense offered only
the three-light string or independent heavy, so correct play could feel flat
between stagger events.

### One branch adds choice without adding control load

The mixed route is `ATK · ATK · HVY`. Both light contacts are authoritative:
presses and queued inputs cannot unlock the branch. After the second contact,
a 600 ms Sunder window opens. HVY during that window spends 20 stamina and
releases a 24-damage / 44-poise ender.

| Route | Damage | Poise | Stamina | Intent |
|---|---:|---:|---:|---|
| `ATK · ATK · ATK` | 50 | 50 | 36 | efficient damage |
| `ATK · ATK · HVY` | 50 | 70 | 44 | poise pressure |

Roll remains first in the transition priority. Either light miss, damage,
route expiry, or a defensive cancel clears the Sunder state. A low-stamina
buffer cannot turn into a delayed ghost technique after the route has gone.
`playerChainHits` still describes connected-light presentation only; the
combat route has separate fields and never reads the HUD counter.

### Resolve rewards varied, successful play

Resolve is a 0–100 run-local meter:

| Event | Resolve |
|---|---:|
| first / second / finishing light | 1 / 1 / 3 |
| Sunder | 6 |
| roll slash | 4 |
| perfect dodge | 8 |
| heavy charged to at least 70% | 6 |
| flank | 4 |
| Execute | 12 |

Flank is additive because positioning should improve any eligible strike.
Gains happen only after a real contact and only while Malakar remains alive,
so a killing blow cannot produce a misleading ready callout on the terminal
screen. Reset owns the meter, use count, Journey contribution, and technique
copy. None enters persistence, grade calculation, score history, or the
immutable difficulty snapshot.

Journey −2 and −3 receive one disclosed recovery rule: a non-lethal wound
adds 4 Resolve, capped at 12 for the entire attempt. Measured and every Oath
receive zero. This is deliberately too small to fill one eighth of the meter;
it softens a beginner's failed exchanges without making damage an optimal
charge strategy.

### Gracebreak is a committed release, not a panic button

Full Resolve changes only a fully charged existing HVY. Gracebreak deals 72
damage and 112 total poise, then restores 20 stamina on contact. Its meter is
spent on the release frame even when it misses. It grants no invulnerability,
does not clear hazards, and does not interrupt Malakar by fiat.

Quick or partial heavy preserves the full meter. A staggered boss preserves
the established Execute instead, also preserving Resolve. Oath +5 continues
to route a depleted poise bar through `noStagger`, so Gracebreak cannot bypass
IRONBOUND. These priorities keep the limit release exciting without replacing
the game's defensive mastery loop.

### The interface and mix reuse protected lanes

Four flat segments fit between stamina and flasks inside
`playerHudRect()`. At 100, the existing touch HVY changes to `BREAK` and
receives one spirit outline; no fifth button or extra floating panel enters
the thumb cluster. Sunder opportunity and Resolve-ready feedback reuse the
established chain/technique lane above the combat centerline. The semantic
combat snapshot exposes percentage, readiness, and current technique without
putting changing values in the live announcement.

Sunder and Gracebreak have named release/contact methods so the gameplay event
owns one audio boundary. They reuse the accepted heavy sample when available,
procedural fallback, critical voice reservation, spatial route, room send,
music ducking, phone transient, compressor, and limiter. Resolve-ready is two
short restrained tones. There is no MP3, loader entry, startup node, or
continuous charge family.

### Stress-test findings and rejected expansion

- A permanent special button was rejected: it increases phone targeting and
  teaching load for a low-frequency action already expressible through HVY.
- Passive or time-based meter gain was rejected: waiting should not outperform
  engagement.
- Damage-only gain was rejected: it reinforces light-spam and ignores the
  game's defensive identity.
- Invulnerability, arena clear, and forced boss interruption were rejected:
  each would make Gracebreak a universal escape rather than an earned attack.
- Persistent upgrades and saved meter were rejected: they blur path-specific
  records and require an unnecessary save migration.
- A rank/Flow subsystem was rejected for v1 of the feature. The readable
  contact chain and one technique lane are sufficient feedback.

The dedicated `qa/v227.cjs` browser lane mutation-drives both route choices,
miss invalidation, simultaneous roll priority, full/partial/whiffed
Gracebreak, Execute precedence, Journey cap, FORSAKEN behavior, named audio
verbs, and mobile/desktop HUD containment. The complete local gate passed:
29 unit tests, lint, build, legacy browser acceptance, v2.21/v2.24/v2.27
lanes, visual-failure testing, and the deterministic operation census.

### Changed from v2.26

- Player combat gains Sunder route state and Gracebreak charge ownership.
- Game state gains one run-local Resolve meter and bounded Journey recovery.
- Existing HUD/audio/semantic lanes gain technique presentation.
- Worst-case render census moves from 916 to 921 mobile draw calls and 898 to
  903 desktop; gradients remain 39, image draws 2, and shadow-blur writes 9.
- No asset, request, worker, render surface, collision shape, dodge window,
  boss pattern, path identity, score formula, save-v7 field, music track, or
  persistent setting changes.

### Runtime release

Reviewed runtime PR #91 merged as
`88b71eef8ad4cafb3bac06a62f8aa3721ff33aed` after both the reviewed-head
and main clean-runner gates passed. Production was fast-forwarded cleanly to
that exact SHA, built as `assets/index-CxwiiXCN.js`, and restarted through the
user-scoped service. Loopback/public health and the complete public browser
suite passed independently. `docs/releases/v2.27.md` is the acceptance record;
documentation-only receipt/closure merges and the `v2.27.0` tag complete the
durable repository handoff without changing this gameplay identity.

Receipt PR #92 merged as
`86f9fb3c9521e5edbf9b03c12a23c9f388b8948b`; its main-branch gate passed and
production was advanced cleanly to that documentation checkpoint without
changing `assets/index-CxwiiXCN.js`. The final documentation review and
`v2.27.0` tag close the circular receipt problem: runtime evidence is written
after runtime deployment, while the tag identifies the final record that
cannot name its own future merge SHA.

## v2.27.1 — Codex (GPT-5), "protected combat lanes" (2026-07-27)

Three independent production gamer-agent passes found no combat defect in
v2.27, but they reproduced two small-screen presentation failures:

- at 360×640, the player-biased clean-fight crop placed Malakar beneath the
  compact utility rail while the opening MOVE card crossed his silhouette and
  first CHARGE lane;
- at 390×844 on FORSAKEN, the compact `OATH CHAIN` plate occupied the same
  boss-title lane as the separate `IRONBOUND`/phase-pip label.

The beginner lane also found that Sunder was taught only after two contacts,
partial Resolve was easy to overlook, and desktop Break readiness relied on a
small HUD word while the footer still said only `K heavy`.

### The short phone gets its own composition, not smaller controls

The four-button `touchLayout()` and the 44px utility rail were already correct,
so this patch does not shrink either. At touch heights up to 680px, a clean
fight now uses 0.88× of the viewport-fit zoom, widening to 0.84× as phase load
or hazards grow. The vertical camera target shares 43% of its bias with the
player/boss midpoint instead of the tall-phone 25%.

At the canonical 360×640 opening, the resulting protected order is:

1. player resources;
2. utility rail ending at y=126;
3. Malakar's projected top edge;
4. central fight space and player;
5. boss HUD beginning at y=392;
6. tutorial card at y=432;
7. the touch buttons.

The short-phone tutorial owns the same lower hint lane that the generic
control reminder previously occupied, so that duplicate reminder is withheld
while the tutorial is present. Taller phones retain the established crop and
tutorial positions.

### One compact boss status has one owner

During a compact FORSAKEN packet, the chain plate now says
`OATH CHAIN n/m · IRONBOUND`. The separate right-aligned pips label is omitted
only while that combined plate is active, then returns immediately afterward.
This preserves both decisive facts without widening the boss HUD or moving the
cue back across the player's dodge silhouette.

### Teaching becomes earlier and stronger, not more persistent

The first touch tutorial now includes `ATK×2 → HVY SUNDER`. The Resolve rail
grows from four to six pixels, gains a stronger empty-state contrast, and says
`BREAK READY` at full meter. The existing touch HVY still changes to `BREAK`;
desktop's initial footer changes to `HOLD K: BREAK` when ready. No new panel,
button, animation loop, sound, or saved tutorial field is introduced.

### Rejected alternatives

- Moving the compact Oath plate above the boss HUD was rejected because native
  review previously found that lane crossed the lower player silhouette during
  ring decisions.
- Shrinking the utility buttons or touch actions was rejected because the
  reported issue was composition, not target geometry.
- Moving Malakar alone in world space was rejected because it changes actual
  distance and boss behavior; the camera fix is presentation-only.
- Altering Oath +2 follow-up timing was rejected. The expert pass described its
  approximately 218 ms phase-three sample as close to the readability margin
  but still credible, and no fairness defect was reproduced.
- Adding Resolve milestone callouts was rejected because they would compete
  with contact-chain and Sunder technique messages.

### Regression contract

`qa/v227.cjs` now exercises a 360×640 true-touch composition and fails unless:

- Malakar clears the utility rail;
- the tutorial clears Malakar and sits between the boss HUD and action buttons;
- the player clears the boss bar;
- proactive Sunder copy is present without the duplicate control hint;
- Oath-chain and IRONBOUND appear in one compact plate;
- desktop full Resolve shows both `BREAK READY` and `HOLD K: BREAK`.

The legacy public QA assertion now requires the combined chain plate to include
IRONBOUND rather than demanding the old exact chain-only string.

Local acceptance passed 29 unit tests, lint, TypeScript/Vite build, the complete
desktop/mobile/true-touch browser suite, v2.21/v2.24/v2.27 lanes, visual-failure
testing, and the deterministic render census. The worst-case mobile scene is
920 draw calls (down from 921); desktop remains 903. Both remain at 39
gradients, 2 image draws, and 9 shadow-blur writes.

### Changed from v2.27

- Short touch viewports gain protected camera/tutorial geometry.
- Compact FORSAKEN chain copy combines two previously colliding HUD states.
- Sunder/Resolve/Break copy and rail weight change.
- Browser acceptance gains short-phone and combined-status regressions.
- No combat state, damage, poise, stamina, timing, collision, boss pattern,
  difficulty modifier, score, save-v7 field, audio event, runtime asset,
  request, touch target, or persistent setting changes.

### Runtime release

Reviewed runtime PR #94 merged as
`37e9d0c627b34dd1ead74267fa4f9c7b3fb46df7`. The PR-head gate passed in
GitHub Actions run 30252600472 and the merged main gate passed independently in
run 30252850910.

Production fast-forwarded cleanly from `b70c832...` to that exact merge, built
`assets/index-pLgbWBY7.js`, and restarted the user-scoped
`gracefell.service` at 2026-07-27 17:15:21 +08. The host working tree stayed
clean; loopback and public health passed. Focused production v2.27.1
acceptance and the complete public desktop/mobile/true-touch suite both passed
with zero errors. The public visual/failure lane remained ready with zero
warnings, and the operation census matched local acceptance.

Production-receipt PR #95 merged as
`394b2fec8ac9bfe8cf8c93db4650bff1f82ea323`; its main-branch run
30253949536 passed. The server advanced cleanly to that documentation
checkpoint, rebuilt, restarted, and continued serving the unchanged
`assets/index-pLgbWBY7.js` runtime. The v2.27.1 release tag targets the final
documentation checkpoint so code, acceptance, deployment evidence, and
future-agent instructions remain one durable handoff.

## v2.27.2 — Codex (GPT-5), "combo truth" (2026-07-28)

Focused gamer review found that v2.27.1's clean-contact timing was already
generous enough: three-light strings and the mixed Sunder route completed
reliably across rapid and deliberate cadences. The failure was not difficulty.
It was a mismatch between combat authority, input ownership, and presentation.

### Findings

- A second light that broke Malakar's poise still left the mixed route active.
  HVY entered Sunder before the established stagger Execute check, replacing
  the fight's larger defensive payoff with a smaller technique.
- The generic 260 ms input buffer expired before the player's 320 ms wound
  recovery. Inputs pressed during that visibly locked state disappeared.
- `ATK×2 → HVY` did not say that both lights must connect uninterrupted.
  Miss, wound, roll, and expiry cleared the route without explaining why.
- `CHAIN 2/3 · HVY SUNDER` mixed hit count, queue state, and next action. The
  touch button still said HVY, while the last simulation frames could advertise
  Sunder too briefly for a new touch to arrive.
- Returning players had no in-battle technique reference after the opening
  hints faded.

### Combat authority

The mixed-route input is now classified before state transition. A staggered
boss turns that buffered route-heavy into ordinary HVY, allowing the existing
`playerStrike()` Execute contract to run. Otherwise it remains Sunder. ROLL is
still checked first. Execute retains its established stamina cost, damage,
one-per-stagger ownership, and Resolve behavior; Sunder retains its own cost,
damage, poise, and Resolve behavior.

Wound recovery now captures exactly one of ROLL, ATK, HVY, or FLASK rather than
widening the global input buffer. A later ROLL replaces an earlier recovery
choice. When the 320 ms stagger ends, that one action is placed back into the
normal authored input lane, so existing stamina checks and priorities still
decide whether it executes.

### Truthful, contextual teaching

The transient lane derives its copy from connected-hit state:

- first contact: `1 HIT · LAND NEXT ATK`;
- valid mixed route: `SUNDER READY · TAP HVY`;
- boss stagger: `EXECUTE READY · TAP HVY`;
- held wound input: `RECOVERING · <ACTION> QUEUED`;
- invalidation: `CHAIN LOST · MISS/HIT/ROLL/TOO SLOW/NO STAMINA`.

The existing touch HVY button becomes `SUNDER` or `EXECUTE` only while that
technique is authoritative. Sunder presentation retires with an 80 ms safety
margin before the simulation deadline, preventing a last-frame promise that a
new browser touch is unlikely to fulfill. No permanent HUD panel or fifth
button was added.

Pause now carries the three stable recipes—Light Finisher, Sunder, and
Gracebreak—and the focus-revealed semantic panel exposes the queued recovery
action. Combat tips name connected/uninterrupted contact and its reset causes.

### Rejected alternatives

- Widening the 600 ms contact window was rejected because clean-contact tests
  already passed from rapid through deliberate cadences.
- Shortening wound recovery was rejected because it changes boss consequence
  and animation feel rather than repairing input ownership.
- Extending every input TTL past 320 ms was rejected because it would also make
  ordinary neutral actions stickier.
- Adding a permanent combo panel or fifth Sunder button was rejected because
  the short-phone composition is already carefully budgeted.
- Retuning damage, stamina, Resolve, or difficulty was rejected: no balance
  defect was reproduced.

### Regression contract

`qa/v227.cjs` now fails unless:

- a poise-breaking second light exposes Execute and the following HVY enters
  heavy/Execute, never Sunder;
- recovery ATK executes after wound stagger and a later ROLL replaces it;
- one contact names the next ATK, two contacts name Sunder, and the touch HVY
  button mirrors that authoritative state;
- a miss reports `CHAIN LOST · MISS`;
- the 360×640 pause card contains all three technique recipes;
- focused phone captures exist for Sunder-ready and Execute-ready states.

The complete local gate passed lint, 29 unit tests, TypeScript/Vite build,
desktop/mobile/true-touch QA, v2.21/v2.24/v2.27 focused lanes, visual/failure
acceptance, and the deterministic render census. The measured worst-case scene
remains 920 mobile / 903 desktop draw calls, 39 gradients, 2 image draws, and 9
shadow-blur writes.

### Changed from v2.27.1

- Sunder/Execute and wound-recovery command priority are corrected.
- Combo, route-loss, touch-button, pause, and semantic feedback are clearer.
- Deterministic gameplay and focused screenshot coverage expand.
- The 600 ms route window, damage, stamina, Resolve, boss patterns, difficulty,
  score/save identity, audio graph/events, assets, weather, touch geometry, and
  render architecture are unchanged.

GitHub, exact-SHA deployment, service, public bundle, and public-QA receipts
are recorded in `docs/releases/v2.27.2.md`.

### Acceptance-discovered audio cleanup hardening

The first local and public complete gates intermittently found one reserved
charge-loop voice after graceful release. The cue owner was already cleared,
but `activeVoices` depended on the scheduled source reaching `onended`. A
backgrounded/headless browser can suspend `AudioContext.currentTime`, so the
90 ms scheduled stop never reaches that callback in wall time.

The graceful path retains its 90 ms fade and adds an idempotent 160 ms
wall-clock call to the existing cleanup closure. A running context normally
cleans first through `onended`; a suspended context now releases its nodes and
voice reservation through the backstop. Immediate damage, reset, title, and
destroy paths remain synchronous. No audio asset, node family, voice, gain,
timing, mix, or gameplay event changed.

The next complete replay proved the voice backstop, then exposed a second
pre-existing edge in the same acceptance area: after a crossfade completed,
the outgoing permanent deck was immediately reused for the next phase.
`prepareSoundtrackDeck()` assigned `gain.value`, which implicitly wrote at the
observed audio clock—0.18 ms before the old 720 ms curve's mathematical end in
the failing sample—even though `finishSoundtrackTransition()` had already
calculated a safe future settle point. Deck reuse now accepts that settle point
and schedules its reset there. This extends the existing sub-quantum guard to
the actual reuse write; crossfade duration, curves, deck count, and music
timing remain unchanged.

### Runtime release

Combo runtime PR #97 passed GitHub Actions run 30315016127 and merged as
`ad9b7d31c228a9ea3a1ccab566a858e5da4587ba`. Its independent main run
30315203091 passed before production fast-forwarded cleanly and served
`assets/index-DMl8om2A.js`.

The repeated public failures were retained as evidence and the release stayed
open. Audio-hardening PR #98 passed run 30316032525 and merged as
`c89e43d53a0b480c5dbf37e585519d9ed6a2e280`; independent main run
30316228463 also passed. Production then fast-forwarded cleanly to that exact
merge, built `assets/index-lXxo8uG6.js`, and restarted the user-scoped
`gracefell.service` at 2026-07-28 08:09:03 +08.

The host checkout remained clean. Loopback and public health returned
`{"ok":true,"app":"gracefell"}`. The complete public
desktop/mobile/true-touch suite, v2.21/v2.24/v2.27 focused lanes, audio
lifecycle, visual/failure checks, and render census all passed with zero
errors; the visual lane was ready with zero warnings. Exact publication links
and documentation closure are retained in `docs/releases/v2.27.2.md`.

Production-receipt PR #99 passed its reviewed gate and merged as
`b1cca605d325122830ac01737f32a097165b1ed9`; independent main run
30316920447 passed. That documentation-only checkpoint reproduced the accepted
`assets/index-lXxo8uG6.js` bundle and closes the gap between runtime evidence
and the next cold-start agent handoff.

### v2.27.2 final-gate addendum — focus belongs to the committed screen

PR #100 passed the complete PR-head gate, but its independent main replay
captured a score-dialog accessibility race. The dialog and data were correct;
React had removed the modal before the zero-delay callback restored focus from
its CLOSE button to RECORDS. This is a real keyboard-ownership defect even
though another runner may advance the timer before observing it.

The close path now marks score-focus restoration before clearing the dialog.
A layout effect keyed to the committed `dialog` state restores the persistent
RECORDS opener after the modal DOM is gone and before paint. The effect is
owner-specific, so MIX and battle-menu focus behavior remains unchanged.
Complete local QA then passed with zero errors, including populated score
history, Escape dismissal, opener focus, and canvas tab-order restoration.

The first public replay of that build proved the focus contract and exposed a
separate acceptance-harness ownership error. The sustained-charge test sampled
`activeVoices`, a deliberately global pool, after a prior contract restored the
real gameplay RAF. Its local charge owner was already false, but Malakar could
start an unrelated critical cue during the 260 ms release sample and make the
pool look one voice high.

The lifecycle probe now cancels the gameplay RAF and sets the game paused
without suspending Web Audio. It therefore owns every voice transition it
counts while still exercising the recorded charge loop, duplicate start,
authored release fade, suspended-clock cleanup backstop, and synchronous
damage/reset/title/destroy paths. This is test isolation, not a mix or gameplay
change.

PR #101 passed clean-runner head run 30317739960 and merged as
`32501728ac5436463ad6ebb3ef539c81ac43f16d`; main run 30317910728 passed.
PR #102 passed head run 30318620506 and merged as
`abae223b24f2d3600f25f1c72b15446a6ea9956b`; main run 30318778678 passed.
Production advanced cleanly to the latter SHA, rebuilt the gameplay runtime
from `3250172...` as `assets/index-BzkBsL72.js`, and restarted at 08:59:47 +08.
Complete public QA then passed with zero errors, including score focus,
isolated charge voices `0 → 1 → 1 → 0`, all focused gameplay lanes, zero
visual warnings, and the unchanged render census.

## v2.27.3 — Codex (GPT-5), "break means break" (2026-07-28)

The live v2.27.2 HUD truthfully reported full Resolve, but the touch action did
not honor its own label. The circle changed from HVY to BREAK and the nearby
instruction said HOLD BREAK. A normal player tap still released an ordinary
uncharged heavy: the live reproduction dealt 30 damage, left Resolve at 100,
and recorded zero Gracebreak uses. The simulation was internally consistent;
the interaction contract was not.

### Decision

The contextual touch action now latches one earned BREAK tap through the
existing charged-heavy sequence. It does not fire immediately: the player
still enters heavy wind-up, roots at the strike frame, fills the authored
0.5-second charge, plays the existing sustained cue, then releases. This keeps
anticipation and counterplay while removing an undisclosed hold gesture from a
button that presents itself as a complete command.

The latch is touch-only and is captured when heavy starts at full Resolve.
Queued Sunder is resolved before ordinary heavy, and stagger Execute prevents
the latch, so neither priority changes. Damage clears it; release and heavy
exit clear it idempotently. Keyboard/right-mouse retain manual hold-to-charge,
including a partial release that preserves Resolve.

### Changed from v2.27.2

- Touch full-Resolve copy changes from HOLD BREAK to TAP BREAK.
- A tap completes the existing maximum charge instead of becoming a quick
  ordinary heavy.
- No damage, poise, stamina, timing, whiff, Resolve gain, difficulty, boss,
  score, save, audio, asset, geometry, or render-budget value changes.

### Acceptance

The focused browser lane now uses a real `touchscreen.tap()` on the rendered
BREAK circle. It captures ready, charging, and released phone frames and
asserts a mid-charge latch before one 72-damage release consumes Resolve
`100 → 0`. A separate keyboard-mode control proves a partial manual heavy
still preserves the meter. Lint, 29 unit tests, the complete browser matrix,
v2.21/v2.24/v2.27 focused lanes, visual/failure gate, and deterministic render
census pass locally with zero errors.

One later complete replay caught a second acceptance edge: graceful charge stop
had cleared cue ownership but still reported one reserved voice at the 260 ms
sample. The 160 ms node-cleanup backstop is deliberately best-effort because
browser scheduling may delay both timers and AudioContext `onended`. A stopped
cue should not occupy the scarce critical-voice budget while it waits for
physical node teardown.

The sustained voice now separates allocation release from node cleanup.
`stopSustainedCues()` releases the reservation synchronously after scheduling
the same 90 ms fade. The source, gain, and routed nodes remain connected until
`onended` or the existing 160 ms backstop disconnects them. Both closures are
idempotent, so immediate damage/reset/title/destroy paths remain safe and the
audible mix does not change.

### Production receipt

PR #104 passed clean-runner head run 30323608408 and merged as
`803a7c6d068269e16e1db8c6c13e410cb2348b11`; main run 30323776253 also
passed. Production advanced from v2.27.2 SHA `d45272e...` to that exact clean
runtime merge, built `assets/index-CtIaLuKS.js`, and restarted at
10:44:26 +08.

A real 390x844 touchscreen tap on the public BREAK circle entered the existing
charge, latched through charge `0.35`, released one 72-damage Gracebreak,
consumed Resolve `100 -> 0`, and returned the control to HVY. Damage
interruption preserved Resolve and cleared the latch; desktop partial hold
remained manual. The complete public QA gate then passed with zero errors,
zero visual warnings, and the unchanged 920 mobile / 903 desktop draw-call
census.

## v2.27.4 — Codex (GPT-5), "room to read" (2026-07-29)

Five role-directed baseline reviews agreed that Gracefell's compact combat
verbs, feedback, retry, and presentation were already strong. The repeated
failure was narrower: a new touch player spent the first exchange parsing a
floating stick, four actions, the HUD, and the tutorial while Malakar could
choose an attack after 0.4 seconds. The intro also consumed most of the
4.5-second MOVE lesson before the player could act.

### Decision

Treat first-run orientation as an ownership bug, not a request for more game.
Only an unfinished tutorial on a negative Journey path receives a 3.2-second
opening stalk. The tutorial clock begins when the fight becomes playable, the
existing faint MOVE target survives until movement is learned, and the next
ROLL lesson leaves after four seconds instead of six. Returning players,
Measured, and Oaths retain the established 0.4-second opening.

The optional semantic Combat tips are now three short techniques and name the
actual device action: touch taps BREAK; desktop holds Heavy through its charge.

### Rejected alternatives

- A tutorial screen, fifth button, permanent combo panel, new mode, reward, or
  currency would add first-minute weight to a game whose strength is one
  readable duel.
- Global boss-speed, damage, health, recovery, or telegraph changes would
  dilute Measured/Oath mastery without addressing the first-run clock.
- A new character-rim or effect pass was deferred. Two roles noticed brief
  close-range silhouette compression, but all five final roles passed after
  the timing/banner correction and no visual blocker was reproduced.
- Removing the intro or retrying directly into combat would change the duel's
  authored cadence; the existing skip and bounded re-entry already tested well.

### Changed from v2.27.3

- New unfinished Journey runs receive one readable opening approach.
- Tutorial time is playable time, not intro time.
- The touch MOVE target persists through the MOVE lesson.
- The follow-up ROLL prompt lasts four seconds instead of six.
- Combat tips are concise and device-correct.
- Damage, poise, stamina, Resolve, health, iframes, boss actions, difficulty,
  scores, saves, audio, assets, touch geometry, camera, and rendering are
  unchanged.

### Acceptance

The pure opening helper locks the scope in unit tests. The complete local gate
passed 30 tests, lint, build, desktop/mobile/true-touch QA, v2.21/v2.24/v2.27
focused lanes, audio lifecycle, the ready/zero-warning visual gate, and the
920-mobile / 903-desktop deterministic render census with zero errors.

The frozen-diff review then found that the MOVE ring still expired with the
text timer if no movement occurred. The amended build keeps only that faint
spatial affordance until movement advances the stage, with a rendered
post-expiry regression proving presence before learning and absence afterward.

All five agent-simulated gamer roles reran on the amended exact bundle and
scored 8.0, 8.4, 8.9, 9.0, and 9.0 out of 10 with no zero category or control
blocker. A newcomer remained alive after 4.85 idle seconds, then dealt 183
damage through the next 18.5 seconds; the veteran reached stagger at 5.88
seconds and tutorial completion at 6.90 seconds.

### Production receipt

PR #106 amended head `8302a12957bc369b604332070811eff1eebc013f`
passed clean-runner CI 30436996211 after the frozen-diff P1 was fixed and
re-reviewed with no findings. It merged as
`c954d3eb6f3b52239a7dce13dc6051752474eecf`; independent main run
30437329942 passed.

Production fast-forwarded cleanly to that exact runtime merge, built
`assets/index-DDP4dxP_.js`, and restarted `gracefell.service` at 16:57:56 +08.
Loopback and public health both returned `{"ok":true,"app":"gracefell"}`. The
complete public desktop/mobile/true-touch gate then passed in 257.1 seconds
with zero errors, zero visual warnings, the MOVE post-expiry lifecycle intact,
and the unchanged 920-mobile / 903-desktop render census.

## v2.27.5 — Codex (GPT-5), stagger authority (2026-07-29)

### Problem

v2.27.2 correctly made a poise-breaking second light route to Execute instead
of Sunder, but the authority was incomplete. A stagger earned on the same hit
as a 55% or 22% phase threshold could be overwritten by the phase transition
one update later. A Sunder-created stagger could also leave transient Sunder
copy competing with the newly earned Execute, and the touch button continued
to advertise Execute after its one consumption.

### Decision

Treat stagger as an owned combat transaction. `Boss.executeReady` is true only
while Malakar is staggered and the one execution is unconsumed. That property
drives action resolution and all next-action surfaces. Phase transitions defer
while the boss remains staggered and resume through their existing ring path
after the complete authored opening.

Execute outranks transient Sunder copy immediately. Once consumed, the
remaining stagger cannot advertise Execute, Sunder, or Gracebreak; heavy is an
ordinary heavy and the earned Resolve meter is preserved.

### Rejected alternatives

- Retuning stagger length, phase thresholds, damage, stamina, poise, or Resolve
  would hide an ownership defect behind balance drift.
- Adding a fifth Execute control or permanent status panel would duplicate an
  action already owned by HVY.
- Starting the phase ring immediately and extending its recovery would still
  replace the earned punish state and change phase timing.

### Changed from v2.27.4

- One authoritative `executeReady` property controls resolution and feedback.
- Same-hit phase thresholds wait until stagger finishes.
- Execute-ready copy outranks Sunder on central, semantic, and touch surfaces.
- Full Resolve remains visibly stored as `RESOLVE FULL` during stagger without
  advertising Break; action hints and aria-live status restore Break readiness
  only after stagger ends.
- A consumed Execute returns the contextual control to ordinary HVY.
- Successful Execute announces `EXECUTE`.
- Damage, poise, stamina, Resolve, stagger duration, phase actions/timings,
  difficulty, scoring, save-v7, audio, assets, rendering, and touch geometry
  remain unchanged.

### Acceptance contract

The v2.27 browser lane mutation-proved the old bundle against four failures,
then verifies both phase thresholds at the exact difficulty-derived stagger
duration and frame count. Each deferred transition must set its phase, banner,
arena depth, and scars exactly once. A genuine touchscreen tap and desktop
`K` press must each consume one Execute for 109.2 damage, preserve Resolve at
100 with zero uses, and make the actual `#game-combat-status` Technique row
move from `Execute ready` to `EXECUTE`. A later heavy in the same stagger must
remain ordinary 42-damage HVY. A natural Execute that fills Resolve from
89→100 must keep the `EXECUTE` result, announce `Resolve full` rather than
`Resolve ready`, and restore Break surfaces only after stagger exits.

### Production receipt

All five exact-bundle role simulations passed at 9.0–9.6/10 with no zero
category or blocker. Runtime PR #108 head
`62aa91848ef6e794d5e9b849b8dab48bf07e3b10` passed clean-runner CI
30446253514 and both adversarial reviews with no findings. It merged as
`fca01e8c324aa227e8bb63f217aba5788f79b53e`; independent main run
30446537473 passed.

Production fast-forwarded cleanly to that exact runtime merge, built
`assets/index-C6-AvkyV.js`, and restarted `gracefell.service` at
19:13:58 +08. Loopback and public health both returned
`{"ok":true,"app":"gracefell"}`. The public bundle matched the scored SHA-256
`20078FCBFC97A288D3CC1BF2CFD1D69D9524B3E1552A9E08AE8D0DCFC60FB3E8`.
The complete public desktop/mobile/true-touch matrix, v2.21/v2.24/v2.27
focused lanes, stagger/Execute real-input checks, render census, and
visual/failure gate passed with zero errors or warnings.

The documentation-only acceptance merge is the tagged checkpoint. It changes
no runtime file and binds the exact implementation, deployment evidence, and
future-agent handoff to `v2.27.5`.

## v2.27.6 — Codex (GPT-5), "break the crown" (2026-07-29)

### Problem

Sunder and Execute were mechanically authoritative but shared almost the same
boss-local reaction: white hurt flash, recoil, sparks, and numeric damage. Each
also repeated its technique name over Malakar while the central feedback lane
already announced the same word. On desktop, the central ready prompts said
`TAP HVY` even though the authored heavy key is `K`.

### Decision

Keep the central lane as the single textual technique authority and make the
king carry the local distinction. A connected Sunder briefly compresses
Malakar, splays his orbiting halo, and draws broken gold fracture arcs. Execute
uses a stronger compression, wider crown burst, and a narrow spirit cleave.
Both use deterministic, bounded Canvas paths and the existing gold/spirit
language; neither uses the hostile danger hue.

`Boss.techniqueImpact` is presentation state alongside recoil. It enters the
read-only Malakar snapshot, decays over 0.28 or 0.38 seconds, clears to `null`,
and is recreated with each fight. The opt-in Three renderer consumes the same
strength for pose and halo spread so the supported visual modes agree. Numeric
damage remains at the hit and the central lane announces the technique once.

Desktop Sunder and Execute prompts now say `TAP K`; touch keeps `TAP HVY`.

### Rejected alternatives

- A permanent rim light was not revived because the v2.24 review already found
  it competed with Malakar's halo silhouette.
- Full-screen flashes, danger red, extra particles, new text, and a fifth
  control would add noise or borrow hostile telegraph language.
- Damage, poise, stamina, Resolve, hitstop, stagger, input priority, and save
  changes were excluded because the problem was reaction clarity, not balance.

### Changed from v2.27.5

- Sunder and Execute have distinct, king-local presentation reactions.
- Duplicate local `SUNDER` and `EXECUTE` words are removed; damage numbers and
  the one central technique announcement remain.
- Desktop next-action prompts name `K`; touch still names `HVY`.
- The v2.24 lane now locks technique-reaction decay, reset, and render purity.
- The v2.27 lane adds genuine three-tap Sunder screenshots, reaction-state
  assertions, single-label checks, and the corrected desktop prompt contract.
- Combat values, action timing, authority, difficulty, score, save-v7, audio,
  assets, touch geometry, boss position/collision/AI, and shadow anchoring are
  unchanged.

### Acceptance and release boundary

`gracefell@2.27.6` passed lint, 30 unit tests, build, the focused v2.24 and
expanded v2.27 browser lanes, and the complete local QA matrix. Reviewed head
`c0d206254518b7d0afb5474fa9f36af161167a4b` passed GitHub Actions run
30454794423 in PR #110. Runtime merge
`a693a4a92adfd20b7732d2f05b63ac27adc89980` passed independent main run
30455115531 before production changed.

Production fast-forwarded cleanly to that exact runtime merge, built
`assets/index-C9hWQYkd.js`, and restarted `gracefell.service` at
21:19:50 +08. Loopback and public health returned
`{"ok":true,"app":"gracefell"}`. The public bundle matched the server at
SHA-256
`3245E3C69DCE63E43A8330C32F7BAC1365BE2F9324770BF784305B1F2192513B`.

The public main desktop/mobile/true-touch rerun and the v2.21, v2.24, v2.27,
performance, and visual/failure gates all passed with zero errors; visual
readiness was `ready` with zero warnings. The render census remained 920
mobile / 903 desktop draws with 39 radial gradients, two `drawImage` calls,
and nine shadow-blur writes in each scene.

The passing real-input artifacts were inspected at 390×844 and 1440×900:
mobile Sunder shows one central name plus gold crown fractures, mobile Execute
shows one central name plus numeric damage and the spirit cleave, and desktop
Execute readiness names `K`. The first public evidence capture revealed that a
full-page screenshot could consume the real 600 ms Sunder window; the harness
now freezes simulation only for that ready-state capture and resumes before
the real HVY tap. No gameplay timer or acceptance threshold changed.

`docs/releases/v2.27.6.md` is the durable acceptance record. This non-runtime
checkpoint changes no shipped gameplay behavior and is the annotated `v2.27.6`
tag target.

## v2.27.7 — Dev (Hermes, deepseek-v4-flash), "the QA port cannot be a constant" (2026-08-02)

### Problem

`qa/run.cjs` defaulted its isolated QA server to a fixed `127.0.0.1:8492`.
On this production box the whole 849x block is allocated to live services
(rent=8492, howmuchlah=8493, paceplate=8495, paper-island=8496, gold=8497,
alphabet-empire=8498, lifepath=8499), so `npm run qa` died with `EADDRINUSE`
before a single check ran. The default only worked on the original dev box
where 8492 happened to be free; it was a latent portability bug, found in a
whole-repo review.

### Decision

Let the OS pick the port. `qa/run.cjs` now probes `net.listen(0, '127.0.0.1')`
for a free ephemeral port when neither `GRACEFELL_QA_PORT` nor `GRACEFELL_URL`
is set; the env override still wins, and `GRACEFELL_URL` (production QA) skips
the local server entirely. The child lanes (verify/v221/v224/v227/perf/
visual-upgrade) already inherit the chosen base URL via `GRACEFELL_URL`, so no
other script needed a change.

### Changed from v2.27.6

- `qa/run.cjs` no longer hardcodes 8492; it prints the chosen port.
- README layout and info.md updated to say "free 127.0.0.1 port".
- No gameplay, rendering, audio, or build output changed. Release evidence
  docs that quote 8492 (`docs/releases/v2.27.md`) are left as historical
  records of the machine they ran on.

### Acceptance

Full `npm run qa` passes with **no** `GRACEFELL_QA_PORT` set — the exact
invocation that used to EADDRINUSE — plus lint and `node --check`.

## v2.27.8 — Claude (Opus 4.8), "the storefront must not lie" (2026-08-03)

A polish pass that found the game itself healthy — the full QA matrix (verify,
v2.21, v2.24, v2.27, perf, visual-upgrade) passes green at `272f92b`, lint is
clean, production serves HEAD — and the rot elsewhere: in the claims *about*
the game.

On 2026-07-22 this agent wrote, truthfully at the time: GitHub description
"Zero assets: every pixel and every sound is procedural", topic `no-assets`,
and the sites.alyoechosys.dev blurb "No art or audio files: every pixel and
every sound is generated at runtime." Twenty-five versions later the game
ships ~3.2 MB of recorded audio (Music 3.0 instrumentals + MiniMax SFX with
procedural fallback) and authored arena art masks. Every one of those claims
had silently become false, and no pass in between owned the storefront.

Corrected, all three surfaces:
- GitHub description → "Combat drawn in code, with authored art masks and a
  recorded score."
- Topics → dropped `no-assets`, added `mobile-game`. Kept
  `procedural-generation`: entities, VFX and most rendering remain code-drawn,
  and the description now carries the nuance.
- sites.json blurb → rewritten to match (with the directory's
  `.bak-pregracefellblurb-20260803` backup taken first, per BOX_HUB convention).

Verified live on both the hub JSON and the GitHub API after the change.
"Three phases" was re-checked against the current engine before being repeated
(max phase is still 3).

The lesson for the ledger: **repo-external surfaces — GitHub metadata, the
sites hub — belong to whoever changes what they describe.** A pass that makes
an asset claim false must fix the claim. Added to AGENTS.md so the next
25 versions don't repeat this.

### Changed from v2.27.7
- No source, build output, or behaviour. GitHub description/topics and the
  sites-hub blurb only, plus this documentation.
