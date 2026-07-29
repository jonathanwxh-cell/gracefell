# GRACEFELL

A boss-arena souls-like that runs in a single HTML canvas. One knight, one sovereign, one room.

**Built for a phone.** Left thumb steers, right thumb fights. It runs on a desktop too and the
keyboard still works — but the layout, the control sizes, the difficulty dial and the readability
rules are all decided by what works one-handed on a 390px screen.

**Play it: [gracefell.alyoechosys.dev](https://gracefell.alyoechosys.dev)**

Current release: **[v2.27.5](https://github.com/jonathanwxh-cell/gracefell/releases/tag/v2.27.5)** —
one earned stagger now owns its complete
opening even when the poise-breaking hit also crosses a phase threshold.
Execute is the single next-action truth across the central HUD, semantic combat
status, and contextual heavy button until consumed; afterward the same opening
returns to ordinary HVY without spending Resolve. Damage, stamina, poise,
timings, difficulty, saves, scores, audio, assets, and touch geometry are
unchanged. Exact candidate, CI, deployment, public QA, and five-role evidence
are recorded in [`docs/releases/v2.27.5.md`](docs/releases/v2.27.5.md).

The **v2.27.2** combo-truth foundation remains intact. A poise-breaking second
light can no longer let Sunder steal
the earned Execute. One deliberate combat input now survives the 320 ms wound
recovery, with a later ROLL retaining priority. The transient lane and touch
HVY button name the next valid action (`SUNDER` or `EXECUTE`), explain
miss/wound/roll/expiry resets, and the pause card keeps the three technique
recipes available without adding permanent HUD weight. The 600 ms contact
window, damage, difficulty, scores, save schema, audio, assets, and touch
geometry remain unchanged. Evidence is recorded in
[`docs/releases/v2.27.2.md`](docs/releases/v2.27.2.md); the durable GitHub
checkpoint is [v2.27.2](https://github.com/jonathanwxh-cell/gracefell/releases/tag/v2.27.2).
The same acceptance pass also hardened graceful charge-loop cleanup when a
backgrounded browser suspends its AudioContext clock; the 90 ms fade remains
unchanged and a 160 ms idempotent wall-clock backstop prevents a reserved voice
from leaking. Final clean-runner replay also made score-chronicle dismissal
deterministic: Escape now removes the dialog and restores keyboard focus to
RECORDS in the same committed layout, without a timer race.

The **v2.27** earned-offense foundation remains intact. Two connected light
hits can branch into **Sunder** with HVY; successful play fills the run-local
**Resolve** rail; and full Resolve plus a fully charged HVY becomes
**Gracebreak**. Its balance, priority, and release evidence remain in
[`docs/releases/v2.27.md`](docs/releases/v2.27.md).

The **v2.22** audio foundation remains a four-role software-house pass that turns the supplied
Kimi/Moonshot combat library into a bounded, production-safe recorded-foley layer. Forty-five
accepted cues load in critical/phase/cosmetic order with two to four workers, while every important
verb keeps its existing synthesized fallback. Player and boss releases are distinct; charged heavy,
damage weight, dry flask, footsteps, near misses, phase changes, execution, and all seven boss tells
now have explicit ownership. Sustained charge audio is deduplicated and stops on release, damage,
retry, title return, death, victory, or teardown.

The release preserves combat timing, damage, difficulty, score persistence, music, weather, input,
and save schema v7. Four bass-led masters received conservative phone-clarity/headroom work; five
weak alternates remain documented but cannot enter runtime rotation. Complete asset hashes and
measurements live in [`public/audio/sfx/README.md`](public/audio/sfx/README.md), while the design,
loader and lifecycle contract, local acceptance, GitHub receipts, exact-SHA deployment, and public
verification are recorded in [`docs/releases/v2.22.md`](docs/releases/v2.22.md).
Local, clean-runner, and complete public desktop/mobile/true-touch acceptance all passed with zero
errors; production serves the exact reviewed merge and immutable versioned SFX.

The six v2.21 mastery and access features still form one coherent combat loop. Attack during a roll buffers a post-dodge slash without cancelling
invulnerability; rear-arc hits earn a disclosed FLANK reward; terminal chronicles explain damage
mix, phase splits, recent wounds, and the next grade threshold. Victory offers explicit REMAIN,
one-step ASCEND, and an offline-generated share PNG. Touch controls can be mirrored for a
left-handed player and persist in save schema v7.
Every active battle also has a safe **MENU** route back to the title, and the
title has a **RECORDS** chronicle for the latest 20 victories.
Rapid light taps acknowledge queued follow-ups, the combat HUD labels HP, stamina,
and flasks, and assistive technology receives current player, boss, telegraph, and
combo state without turning changing percentages into live-announcement spam.
Save schema v7 migrates older settings and scores while defaulting handedness to the established layout.
The adaptive MiniMax phase score, MIX controls, Journey/Oath curve, retry behavior,
and combat timing are unchanged. The v2.21.1 hotfix evidence is in
[`docs/releases/v2.21.1.md`](docs/releases/v2.21.1.md); the complete v2.21 implementation,
CI, deployment, and public verification record is in
[`docs/releases/v2.21.md`](docs/releases/v2.21.md); the v2.20 weather record remains in
[`docs/releases/v2.20.md`](docs/releases/v2.20.md), and the v2.19 navigation and score
chronicle record remains in [`docs/releases/v2.19.md`](docs/releases/v2.19.md).

Three compact Canvas art textures, one query-only low-poly proof, three generated music tracks,
and one bounded recorded combat-SFX library. Character combat presentation, swords, halo state,
telegraphs, weather, and effects remain driven at runtime by Canvas 2D; the Blender-authored arena
base and phase masks occupy existing cached surfaces instead of adding a render loop. Three MiniMax
Music 3.0 instrumentals supply the phase score, with the original procedural drone and phase-aware
drums kept underneath and available as the offline fallback.
Recorded combat foley adds authored texture through the existing Web Audio spatial, reverb, ducking,
voice-pressure, and limiter graph; synthesis remains the cold-start, network-failure, and held-back
asset fallback. The visual game remains one `<canvas>`; a focus-revealed semantic companion exposes
controls and safety settings to keyboards and assistive technology without covering the playfield.

The sovereign has an audio language, not one generic warning: swipes whistle, charges rise, volleys
crystallise, rings resonate, meteors fall and the spiral winds itself tight. Recorded bodies are
layered selectively with phone-safe procedural contact edges, positioned across the arena, and
placed inside the generated stone-room reverb. The score ducks and the master limits itself when
phase three gets crowded; no downloaded cue is allowed to make a cold fight silent.

---

## Credits

**v1 — written by Kimi (OKComputer).** The original prototype: the engine skeleton, the Input/Player/Boss/Game architecture, souls-style input buffering, the two-phase boss with six attacks, the procedural Web Audio engine, the parchment-and-grace-gold art direction, and the writing ("a boss waits at the end of grace"). That version was already a real game — it just hadn't been polished.

**v2 — extended by Claude (Opus 4.8).** Combat depth, a third phase, a full rendering pass, persistence, and a headless verification gate. Details in [DESIGN.md](DESIGN.md).

**v2.4–v2.22.1 — audio, responsiveness, combat integrity, character readability, progression, victory persistence, player-controlled pause, adaptive phase scoring, navigation/accessibility polish, fixed-pool phase weather, and mastery feedback extended by
Codex (GPT-5).** Attack-specific procedural cues, spatial mix protection, the MiniMax-generated
score family, mobile/accessibility hardening, trustworthy combat and retry behavior, the verified
Grace-to-Oaths mastery path, and the production Kite-Veil/Blade-Saint silhouettes. The v2.11 player
direction was selected from three independent design-house proposals. Kimi / OKComputer supplied
the six original issue concept images and briefs (#10–#15); the shipped player and boss are
Codex-authored procedural interpretations that only partially translate the selected #10 and #14
images. Kimi/OKComputer also supplied the v2.22 Moonshot combat masters; Codex's audio software-house
pass audited, selectively remastered, integrated, load-hardened, and verified them. Music generation
prompts and hashes are recorded in [`public/audio/README.md`](public/audio/README.md); combat-SFX
prompts, measurements, hashes, exclusions, and processing truth are recorded in
[`public/audio/sfx/README.md`](public/audio/sfx/README.md).

**v2.23–v2.24 — measured and authored by Claude (Opus 5).** The deterministic
render-operation census established real visual headroom, rejected four noisy optimisations on
evidence, and added presentation-only impact frames without changing hit geometry.

**v2.25 — implemented and verified by Codex (GPT-5) with specialist agents.**
Codex generated the new concept boards, built the reproducible Blender-to-Canvas asset lane,
integrated the accepted arena and boss treatment, implemented and measured the rejected Three.js
comparison, and ran independent code, player, performance, failure, and release QA. These v2.25
boards and Blender assets are Codex work and must not be attributed to Kimi.

**v2.26 — combat-audio polish implemented and verified by Codex (GPT-5).**
Codex tightened event ownership around heavy release, damage severity, projectile
closest passes, stamina denial, ward contact, and the terminal grade seal, then
expanded the real-browser audio/gameplay contract without adding runtime assets.

**v2.27 — Sunder, Resolve, and Gracebreak implemented and verified by Codex
(GPT-5).** Codex converted the reviewed gameplay thesis into one contact-gated
mixed combo, one earned run-local meter, one hold-heavy release, named hybrid
audio, a compact semantic/mobile HUD, and a dedicated browser acceptance lane.

**v2.27.1 — live-review readability fixes implemented and verified by Codex
(GPT-5).** Codex repaired the short-phone opening composition and Oath-chain /
IRONBOUND collision, strengthened Sunder/Break teaching, and added deterministic
360×640 plus combined-status browser contracts.

**v2.27.2 — combo truth implemented and verified by Codex (GPT-5).** Codex
repaired Sunder/Execute priority, retained one player-chosen recovery command,
made connected-hit requirements and route loss explicit, and added
combat-authoritative browser and phone-screenshot acceptance.

Directed by [@jonathanwxh-cell](https://github.com/jonathanwxh-cell), who asked for "AAA grade" and meant it.

Different agents keep working on this. **[PROVENANCE.md](PROVENANCE.md)** is the ledger of
who did which pass, and the rules any future agent follows before touching the code.

---

## Controls

**On a phone** — the way it's meant to be played:

| | |
|---|---|
| drag on the **movement side** | a floating stick appears under your thumb; defaults left and can be mirrored |
| **ATK** | slash — connect three light hits for a finisher, press during a roll for a recovery slash, or connect two then use HVY for Sunder |
| **ROLL** | invincible — roll *into* a swing for a perfect dodge |
| **HVY** | heavy, slow, big poise damage; after two connected light hits it becomes Sunder, and at full Resolve it becomes BREAK — tap once to complete the charge and release Gracebreak |
| **FLASK** | heal (Journey starts with four; the selected path is shown before the fight) |
| **MIX** | freezes combat while the score remains audible; set Music/Combat effects, test SFX, then Done |
| **PAUSE / RESUME** | freezes the fight and audio; no time, attack, or input advances |
| **MENU** | opens a safe confirmation; resume the same frame or abandon this battle and return to the title |

The buttons scale with your screen and sit clear of the home indicator. Haptics fire on hits and
perfect dodges, and can be switched off on the title screen.
The title’s TOUCH LAYOUT row mirrors the joystick and the complete action cluster; the visible
controls, hit-tests, heavy-hold detection, tutorial copy, and saved preference all change together.

**On a desktop**, if that's what you have: WASD/arrows move, Space or Shift rolls, J or left-click
slashes, K or right-click is heavy, F drinks, M mutes, and P or Escape pauses/resumes. MENU is
also available as a visible button after a battle begins.

## The fight

Malakar has three phases. Every path keeps the same core move vocabulary; Grace changes how much
room the player receives, while expert Oaths can compose direct attacks into disclosed follow-up
packets.

1. **Fallen Blade-Saint** — nine broken halo blades expose his volley ammunition while swipes,
   slams, charges, and volleys teach the core tells.
2. **The Burning Sovereign** (55% HP) — halo tips ignite, everything speeds up, and meteors plus
   expanding rings enter the rotation.
3. **Grace-Forsaken** (22% HP) — he draws a second sword, cooldowns reset, ring attacks come in
   pairs, meteors come nine at a time, and a two-armed rotating spiral fills the arena with fire.

Break his poise to stagger him; staggered hits do 1.4×. Land a roll *into* an incoming attack for a perfect dodge — slow-motion, stamina back, and poise damage. Defense is how you win.

Connected attacks and deliberate defensive play build the thin **Resolve**
rail under stamina. Light hits grant 1/1/3 across the string; Sunder grants 6,
a roll slash 4, a perfect dodge 8, a sufficiently charged heavy 6, a flank 4,
and an Execute 12. Resolve never persists between attempts. At 100, touch
players tap BREAK once to complete its charge; keyboard and mouse players hold
HVY through the charge. Quick or partial desktop heavy attacks leave the meter
ready for later.

Victory is graded S through C on time and wounds taken. Your best time and win count persist locally.
The title-screen **SCORES** chronicle keeps the latest 20 victories on this device with their grade,
fight time, path, attempt, damage, wounds, flask use, perfect dodges, and local completion date.
A no-hit run is an S.

## Grace, Measured, and Oaths

The title **Path** runs from **−3 to +5** and tells you what its current choice changes.

A player with no save begins on **JOURNEY −2 — recommended**: Malakar is about 15% slower, wounds
land 30% softer, dodge windows are wider, four flasks are available, and windups name the incoming
attack above the boss bar. Journey −2 and −3 also grant 4 Resolve for a
non-lethal wound, capped at 12 per attempt; this disclosed recovery cannot fill
even one eighth of the meter. The sovereign, health pool, phases, move set, and
victory requirements are unchanged. Existing saves keep their chosen path; an
old save that never stored a path remains on **MEASURED 0**.

Positive paths are **Oaths**. They retain the established speed, damage, flask, poise, and stagger
curve, then add authored follow-up packets and shorter recovery. The HUD says
`OATH CHAIN step/total` while one is active. Area-denial moves are never chained; the packet routes
use only swipe, slam, charge, and volley, and every step still obeys its normal range, cooldown,
phase, and touch-telegraph floor.

| Path | Boss speed | Damage taken | Flasks | Boss poise | Added read or pressure |
|---:|---:|---:|---:|---:|---|
| −3 | 0.78× | 0.55× | 4 | 120 | named tells, longest recovery |
| −2 JOURNEY | 0.85× | 0.70× | 4 | 120 | recommended, named tells |
| −1 | 0.93× | 0.85× | 3 | 120 | wider dodge |
| 0 MEASURED | 1.00× | 1.00× | 3 | 120 | canonical timing |
| +1 OATH I | 1.04× | 1.05× | 3 | 120 | two-beat packets, 0.99× recovery |
| +2 OATH II | 1.10× | 1.13× | 2 | 120 | two-beat packets, 0.96× recovery |
| +3 OATH III | 1.18× | 1.24× | 2 | 162 | more frequent packets, 1.45 s stagger |
| +4 OATH IV | 1.24× | 1.32× | 2 | 204 | more frequent packets, 1.25 s stagger |
| +5 OATH V | 1.30× | 1.40× | 1 | 204, IRONBOUND | three-beat packets, no stagger |

The rule the design holds to: **make the fight easier to finish without making it easier to
master.** Grace is visible and voluntary. Oaths change recognition and recovery decisions without
shrinking touch targets, hiding tells, removing the input buffer, or shortening established mobile
reaction floors.

The first contextual rite teaches movement, rolling through the blade, perfect-dodge poise damage,
and striking a real stagger. It disappears permanently once completed. If the player dies, the
screen names one response to the attack that landed the final wound. From attempt two, an explicit
**Receive Grace** control can lower the path by one step; it never changes difficulty silently and
does not consume the subsequent **rise again** tap.

The record carries the setting. Best times and scorecards stay separate by path; v2.12 scorecards
also retain perfect dodges, flask use, and Oath rank. “S at Oath II” and “S on Journey” remain
different achievements.

Also on the title screen: **screen shake** and **flash reduction** toggles. The low-health vignette
pulses at about 5Hz by default, which is a photosensitivity concern — reduced mode makes it a
steady glow and drops the full-screen flashes to a quarter strength.
New players whose system requests reduced motion start with shake off and reduced flashes; an
existing saved preference remains authoritative.

## Reading the screen

One colour in this game means *this will hurt you* — a hot red reserved for hostile projectiles,
hostile rings, and attack telegraphs. Nothing decorative is allowed to borrow it; the ambient fire,
the boss's own burning core and his sword glow are all amber instead. There's a test that fails the
build if an ambient particle ever picks up the hazard colour.

Hazards are shape-coded too, so they survive colour blindness and bad displays: projectiles carry a
hard white core and a rotating diamond outline (decoration is round), hostile rings show a bright
leading edge — the part you actually have to clear — and meteors close four ticks inward so the fuse
reads as motion rather than hue.

## Listening to the fight

Three sparse dark-fantasy phase cues were generated with MiniMax Music 3.0, mastered to exact
78 BPM loop forms, and ship locally with a procedural fallback. Two permanent streaming decks move
from Quiet Ash to The Sovereign Burns to Gracefall with no more than 250 ms of beat quantization
and a 720 ms equal-power crossfade. Combat audio is synthesized in the browser: every attack
has a stable tell, repeated swings and impacts receive subtle non-repeating variations, and hits use
different metal, flesh, and low-frequency layers. Malakar has a layered organic roar plus footsteps
and charge-scrape foley.

World sounds are mixed relative to the player, so distance changes level, brightness, stereo pan,
and how much of the stone arena tail you hear. Low player health introduces a tension layer, the
last 30% of boss health raises intensity, and a stagger clears the drums to expose the opening. A
compressor and -1 dBFS peak ceiling protect dense phase-three collisions. Headphones give the best
spatial read, but the transient and sub limits are designed to remain legible on a phone speaker.

Combat owns the mix. The score sits on a lower bus with a broad 1.8 kHz presence dip, while every
player verb and boss windup briefly ducks it before the action lands. Those cues use the reserved
critical voices, so a dense projectile storm cannot spend the voice budget needed for a warning.

Light sword contact has its own short 1.45–3.2 kHz critical crack and an immediate score duck.
That presence-band layer replaces an expendable ultrasonic transient, so ordinary hits remain
clear on a phone speaker and under phase-three voice pressure without adding another sound layer.
Sunder and Gracebreak reuse that bounded hybrid graph with named release and
contact accents. Resolve-ready uses one restrained rising acknowledgement;
none of these verbs adds a file, looping layer, startup request, or unbounded
voice.

The MP3s are streamed through the Web Audio music bus instead of being fully decoded into memory.
Only Phase 1 is eagerly prepared; later phases remain deferred. Playback failures retain and retry
the requested phase without creating new nodes, then fall back to the procedural score.
Generated noise and the arena response are prepared before the first gesture, keeping the first
attack responsive while preserving the same spatial mix, ducking, and limiter path.

Music and Combat effects have separate persistent sliders (85% and 100% defaults). MIX pauses the
simulation while deliberately leaving the score audible, provides a TEST SFX action, and closes
through Done, Escape, or the backdrop without passing that input into combat. A manual PAUSE still
suspends both simulation and audio and temporarily disables MIX.

If the tab loses focus or a phone interruption hides the page, simulation and audio pause together.
Returning resumes from the same fight frame rather than letting Malakar attack an absent player.
An explicit PAUSE/RESUME control now uses the same safe freeze while keeping its own ownership:
returning to the tab cannot cancel a pause the player chose.

## Fixed by Codex — v2.9–v2.9.1 combat polish

Three read-only game-developer reviews covered adversarial play, combat systems, and combat UX
before this pass was implemented. The fixes include:

- one explicit same-frame trade policy (victory wins), clean terminal persistence, and no damage
  after combat has ended;
- intro isolation, hit-stop-safe simulation-time input buffering, refresh-rate-independent lunges
  and boss damping, preserved heavy knockback, corrected meteor cadence, and a real volley windup;
- one-action mobile touch targeting even where expanded fingertip regions overlap, action-state
  button feedback, first-action tutorial dismissal, and a visibly unavailable empty flask;
- semantic controls that own Enter/Space and pause combat while focused, plus unclipped mobile
  phase banners, boss names, and phase pips;
- deterministic irregular flagstone wear, four subtle outer-arena landmarks, capped footprints,
  sharper impact cracks, phase-damaged wards, and a handful of grace flakes. These reuse the
  existing baked floor, scorch canvas, and 64-mote budget—no new render surface or particle load.

The regression gate now reproduces the reported failures directly, tests 30/60/120 Hz motion,
checks first-tap audio under 20 ms, samples the expanded touch overlap, and drives DOM focus,
desktop, mobile, and real-touch paths. The completed local gate reports zero errors.

v2.9.1 fixes the reported “touch to rise again” failure. Terminal screens now record a durable
confirmation gesture across keyboard, mouse, Touch Events, Pointer Events, focus handoffs, and
slow-motion instead of relying only on a short combat-action buffer. QA kills the player through
the real damage path, captures the visible death prompt, rises with one touchscreen tap, then
repeats the flow with a pointer-only event used by some embedded mobile browsers.

## Fixed by Codex — v2.10 difficulty integrity

Three independent game-review lanes examined the curve mathematically, adversarially, and as
players before implementation. The verified build now freezes the selected trial and all of its
modifiers when a run starts; title and semantic controls cannot turn a recorded +5 attempt into a
hybrid easier fight. The title shows the best time for the selected trial rather than a global best.

Phase two and three both deliver the authored three-swipe combo. On touch devices, a fresh boss
windup is never shorter than 300 ms and a combo follow-up is never shorter than 240 ms; the
telegraph renderer reads the exact same stored duration as the hit logic. Projectile and expanding
ring travel speeds remain fixed because the review found them readable already.

The gate enumerates all nine settings and asserts the published table, active snapshot, damage,
poise, stagger duration, semantic lock, selected record, FORSAKEN label clearance, IRONBOUND HUD,
touch timing, death/retry, and the existing combat/audio/performance regressions. It also produces
dedicated phone screenshots for the +5 title and combat states.

For the complete pre-fix reproduction, reviewer lanes, unchanged-system decisions, exact test
measurements, GitHub records, production SHA, and known limits, see the
[`v2.10 acceptance record`](docs/releases/v2.10.md).

## Designed and fixed by Codex — v2.11 character readability

The Penitent and Malakar now communicate state through outer shape instead of phone-scale costume
detail. The player uses seven Kite-Veil silhouettes: arrow/fin movement, compact roll spindle,
light spear, heavy hammerhead, flask seed, broken stagger, and flattened death leaf. The resting
sword disappears when it would blur the roll, flask, stagger, or death read.

Malakar is now a procedural interpretation of the Fallen Blade-Saint from Kimi's issue #14 image
and brief. The implementation partially preserves its halo, ash cape, pointed armor, and
dual-sword hierarchy; it is not the raster image or a verbatim sprite conversion. His nine-blade
halo is a real volley counter: phase one spends five fragments, phase two spends seven, phase
three spends nine, and one blade reforges every 0.8 seconds. Phase-two tips ignite amber, stagger
slows and breaks the orbit, and phase three visibly draws a second shadow sword over 0.4 seconds.
Boss collision, health, damage, movement, cooldowns, and attack timing are unchanged.

Both designs remain procedural Canvas 2D, so the production bundle gains no sprite sheet, texture,
model, or per-frame render surface. Their source-to-implementation comparisons are committed below:

- [Kite-Veil seven-state comparison](docs/releases/assets/v2.11/kite-veil-states.png)
- [Fallen Blade-Saint mobile-state comparison](docs/releases/assets/v2.11/blade-saint-states.png)

The post-launch accessibility playtest also fixed the semantic **Start fight** path: keyboard and
assistive-technology activation now hands focus back to the canvas instead of leaving combat
silently paused behind a disabled button.

The complete design-house process, acceptance criteria, automated assertions, performance
measurements, attribution, deployment evidence, and post-launch user playtests are recorded in the
[`v2.11 release record`](docs/releases/v2.11.md).

## Fixed by Codex — v2.11.1 victory score and pacing

Defeating Malakar now persists a version-three scorecard at the same moment victory is awarded.
The last result and the best-time scorecard for each trial survive reloads, while the existing
per-trial best-time and win count remain backward compatible.

The victory screen says **SCORE SAVED**, stays in control for at least 4.5 simulation seconds, and
discards celebratory double-clicks made during the reveal. Once the replay prompt appears it
requires a fresh input and breathes slowly instead of flashing rapidly. The title remembers the
last saved grade.

## Fixed by Codex — v2.11.2 rapid light combo

Rapid ATK taps now use a two-entry light-only follow-up queue, so three real presses produce the
authored three-hit string instead of collapsing into two attacks. The queue cannot invent extra
hits, clears on damage, roll, heavy, insufficient stamina, or combo expiry, and never outranks a
roll that is ready at the transition.

The third hit remains the stronger light finisher, but now calls the light swing and impact family
with a silver damage number. HVY keeps its separate heavy cue and gold impact identity. Desktop
and true-touch regression paths both perform three 50 ms-spaced ATK presses and require steps
`0, 1, 2`, no heavy flag or heavy cue, and an empty queue afterward.

## Designed and fixed by Codex — v2.12 Journey and Oaths

A research-led difficulty pass now separates first-completion support from expert rematch
pressure. New players start on the transparent Journey candidate while old saves retain their
choice. One contextual rite teaches the actual defensive loop; lethal-source hints and the
voluntary repeated-death Grace offer turn failure into a specific next action without silently
changing the rules.

Expert Oaths preserve the established curve and add capped, learnable boss packets with visible
step counts and recovery pressure. Ring, meteor, and spiral never join those packets. Connected
player light hits now show the full chain and finisher, and victory scorecards retain perfect
dodges, flask use, and Oath rank. Save schema v5 also persists separate Music and Combat effects
levels; older saves migrate to 85% / 100%.

The complete local suite, GitHub Actions run, exact-SHA host deployment, public health checks, and
full production replay all passed. See the
[`v2.12 release record`](docs/releases/v2.12.md) for the rationale, rejected alternatives, authored
routes, migration rules, measurements, evidence names, and known human-testing limits.

## Fixed and polished by Codex — v2.12.1 consent and combat clarity

Three live player lanes and a separate all-path production gate found one reproducible
input-ownership defect: a left movement press buffered immediately before death could accept the
new Receive Grace offer without a fresh choice. The death transition now discards that carried
press. A regression proves the path stays at Measured across the first terminal frame and changes
only after a new left press; touch acceptance and one-touch resurrection remain intact.

The same review showed an experience cliff at the first Oath. Oath I/II keep their two-beat packet
rules but begin with 1.04×/1.10× speed, 1.05×/1.13× damage, and 0.99×/0.96× recovery. Measured,
Grace, and Oath III–V retain their accepted values.

Performance-neutral presentation polish makes the rules easier to read:

- one larger backed chip owns either a Journey `READ` tell or an `OATH CHAIN` counter;
- two small spirit arcs separate the player from Malakar only when their silhouettes overlap;
- the ATK circle shows accepted queued follow-ups while the arena counter remains connected-hit
  truth;
- record-heavy 390px titles give wins, best time, and last grade their own compact line.

No runtime asset, particle system, save migration, boss phase, attack packet, collision rule,
touch geometry, music, or SFX contract changed. The exact merged revision, CI run, host build,
public metrics, screenshots, rejected false positives, and timing-variance reruns are recorded in
[`docs/releases/v2.12.1.md`](docs/releases/v2.12.1.md).

## Added by Codex — v2.13 pause and resume

Every active fight now exposes one persistent **PAUSE / RESUME** control. It sits beside SOUND on
the phone, meets the 44px fingertip target, respects top/right safe areas, and remains a semantic
DOM button above the canvas. Desktop players can use the same control or press **P / Escape**.

Pausing stops the RAF loop, combat clock, player, boss, hazards, streamed score, and Web Audio
context on the same frame. The centered card explains the frozen state. Manual pause is stored
separately from settings-focus and browser-interruption pause, so returning focus cannot resume a
fight the player deliberately held. Inputs made while paused are cleared on resume instead of
becoming a surprise attack or dodge.

The QA gate now exercises keyboard and true-touch pause end to end, asserts a frozen combat clock,
suspended audio, stopped RAF, 76×44px on-screen geometry, immediate label/ARIA changes, retained
canvas focus, and a clean first resumed frame. See [`docs/releases/v2.13.md`](docs/releases/v2.13.md).

## Added by Claude — v2.14 feel and spectacle

A gamer's-eye polish review found the combat feel already strong, so this is a last-10% pass, in
three parts — each guarded by a numeric QA assertion, none touching a save, layout, audio, or
reserved-hue contract:

- **The camera breathes.** A clean one-on-one tightens the frame for intimacy; the instant the
  arena fills with projectiles, rings, or meteors — or a later phase begins — it widens back to the
  phone's viewport-fit so you never zoom *into* a storm you then can't clear.
- **Stagger execution.** Breaking Malakar's poise is a real investment, so it now pays like one: the
  first heavy into a staggered sovereign is a riposte that spikes damage once, then reverts to the
  normal staggered multiplier until you break him again.
- **The arena falls with him.** Each phase transition scorches the floor and thickens the embers
  through the existing offscreen surfaces, so "THE SOVEREIGN BURNS" and "GRACE ABANDONS HIM" now
  look like what the banners promise — at no new asset or particle-budget cost.

Two further ideas from the same review — a hold-to-charge heavy and a phase-three musical lift — are
deliberately held for a later offense pass, because they need touch-input and audio-bus work that
deserve their own QA lane. Full rationale and evidence: [`docs/releases/v2.14.md`](docs/releases/v2.14.md).

## Added by Claude — v2.15 offense

The offense half of the same review, split out because it reaches into touch input and the audio bus
graph — both fragile enough to want their own QA lane:

- **Hold to charge.** Tap HVY for the heavy you already know; *hold* it and the knight roots and
  winds up — release for a smash that hits up to 1.75× harder and breaks poise hard enough to set up
  a stagger execution. The cost is the wind-up: you stand exposed while a gold ring tightens. A quick
  tap is byte-for-byte the old heavy, so nothing you've learned changes.
- **Phase three finds its voice.** The final phase's music now lifts — more drums, an open filter —
  through the existing procedural buses, so "GRACE ABANDONS HIM" sounds like it looks. No new audio
  nodes, no new track.

Full rationale and evidence: [`docs/releases/v2.15.md`](docs/releases/v2.15.md).

## Fixed by Codex — v2.18 adaptive phase score

- **Three accepted cues, mastered for combat.** MiniMax Music 3.0 generated one
  related piece per phase. Codex removed Phase 2's generated dropout and Phase
  3's quiet intro/surge, then built exact bar-aligned wrap loops matched within
  0.01 LU. The old larger single score is gone.
- **Fast, resilient transitions.** Two permanent streaming decks reuse their
  Web Audio nodes. A phase waits at most 250 ms for a beat and crossfades in
  720 ms; rejected playback retries safely and persistent failure returns to
  the procedural score.
- **Actions stay clear.** Strongest-wins ducking protects a boss warning from a
  later weaker action. The established full SFX / low music / presence-dip
  contract remains unchanged.
- **Tune by ear, safely.** MIX freezes combat but keeps the score audible.
  Music and Combat effects are separate, persisted controls; TEST SFX,
  Done, Escape, and the backdrop never leak a combat input.
- **Verified failure paths.** Desktop, 390×844, and true-touch QA now cover
  crossfade pause/resume, rejected playback, fixed node count, duck expiry,
  save-v5 migration, and MIX focus/dismissal as well as every earlier game flow.

Full rationale, measurements, and evidence:
[`docs/releases/v2.18.md`](docs/releases/v2.18.md) and
[`public/audio/README.md`](public/audio/README.md).

## Fixed by Codex — v2.19 battle navigation, score chronicle, and combat clarity

- **Leave safely.** MENU is available during intro, combat, defeat, and victory.
  It opens a focus-trapped confirmation and pauses both simulation and audio
  during a live fight. Resume returns control to the canvas with no ghost
  action; Return to main menu abandons only the current battle.
- **Review real results.** SCORES opens a responsive title-screen chronicle.
  New victories receive an ISO completion timestamp; the latest 20 are retained.
  Old v5 saves migrate their last score with “Date unavailable” rather than a
  fabricated date.
- **Read the fight sooner.** HP, STAM, and FLASKS are named directly on the HUD.
  Rapid taps show queued light attacks before they connect, narrow keyboard copy
  wraps instead of clipping, and desktop help text sits clear of the viewport edge.
- **Assistive combat state.** The semantic companion now exposes health,
  stamina, flasks, boss health/phase/poise/action, combo hits, and queued attacks.
  Only meaningful state/telegraph changes use the polite live status.
- **One audio race removed.** Web Audio suspend/resume requests are serialized,
  so quickly moving between MENU, manual pause, focus loss, and gameplay cannot
  let an older asynchronous transition restore the wrong final state.
- **Verified locally.** Sixteen unit tests, lint, production build, and the full
  desktop/mobile/true-touch Playwright gate pass. In-app browser checks at
  1280×800 and 390×844 covered the title, empty and populated score views,
  battle confirmation, return flow, focus restoration, and an empty error log.

Full rationale and evidence: [`docs/releases/v2.19.md`](docs/releases/v2.19.md).

## Added by Codex — v2.20 fixed-pool phase weather

- **Quiet Ash.** Phase one keeps the room restrained: short, slow ash with
  steady grace rays and the existing neutral backdrop.
- **Ember Gale.** Phase two pushes warm diagonal streaks across the arena,
  leans existing embers with the same wind, warms the backdrop, and increases
  ray movement while keeping every combat signal above the weather.
- **Gracefall Storm.** Phase three reverses the wind into longer pale streaks,
  cools and darkens the room, and weakens the rays. The change crossfades over
  2.4 seconds with the phase score rather than switching randomly.
- **Depth without growth.** The original 64 motes remain the complete pool:
  48 low-alpha motes sit above the cached floor but below telegraphs, entities,
  hazards, and world effects; 16 edge-only motes sit below the HUD.
- **Comfort and performance.** Flash-reduced or shake-disabled play lowers
  weather motion to 45% and shortens its streaks. Across two green full runs,
  all phase profiles stayed at 0.4–0.5 ms median and 0.6–1.0 ms p95; the worst
  observed Phase 3 increase was 0 ms median and 0.4 ms p95.

No image, video, fog surface, shader, particle pool, audio loop, dependency,
network request, save field, or gameplay value was added. Full rationale and
evidence: [`docs/releases/v2.20.md`](docs/releases/v2.20.md).

## Added by Codex and specialist agents — v2.25 Blender-assisted visual depth

- **A dimensional arena without a second render loop.** The default fight now
  uses a Blender-authored 2048px Ashen Reliquary plate copied into the existing
  adaptive floor cache. The old procedural arena remains the automatic failure
  fallback and the explicit `?visual=procedural&boss=current` comparison.
- **Phase art stays on combat boundaries.** Two compact transparent masks stamp
  once into the existing scorch surface at the Phase 2 and Phase 3 transitions.
  Late assets wait for a safe reset instead of appearing during a dodge.
- **Malakar reads as a knight.** The accepted Canvas treatment strengthens his
  cape, helm, core, halo, windup, stagger, second sword, and recoil silhouettes
  while consuming only read-only presentation state.
- **Three.js was measured, not assumed better.** `?boss=blender-three` retains
  an offscreen low-poly GLB comparison for development. It is dynamically
  imported, never starts a second animation loop or visible canvas, and falls
  back to Canvas on GLB, renderer, or WebGL failure. Native-size player review
  did not justify making it the production default.
- **Small shipping payload.** The arena is about 84 KB, both phase masks about
  41 KB combined, and the proof GLB about 11 KB. Versioned immutable URLs prevent
  stale art without changing save schema v7.
- **Failure and performance gates.** Automated QA covers native mobile/desktop
  captures, quiet/severe weather tells, delayed and corrupt assets, atomic floor
  replacement, phase-stamp failure, Canvas/WebGL fallback, renderer disposal,
  operation census, and existing gameplay invariants.

The complete specification, concept boards, asset regeneration instructions,
and QA contract live under
[`docs/visual-upgrade/`](docs/visual-upgrade/BLENDER_2_5D_VISUAL_SPEC.md).
Combat, difficulty, saves, scoring, audio, input, and telegraph geometry are
unchanged.

## Fixed by Codex — v2.26 combat-audio consequence pass

- **Heavy actions land on the picture.** HVY speaks when the blade actually
  releases, not when the button is first pressed. Charge amount lowers and
  weights the same release/contact families; the sustained charge bed fades in
  90 ms and cuts immediately if the player is hurt.
- **Damage severity is readable.** Adjusted damage routes to light (up to 12),
  medium (13–20), or heavy (21+) hurt profiles with bounded pitch, body, phone
  transient, reverb, and music ducking differences.
- **The room acknowledges close calls and boundaries.** A hostile projectile
  gets one closest-pass whoosh only after it safely recedes; a damaging contact
  can never also claim that cue. The arena ward chimes once on a meaningful
  outward collision and stays latched while the player slides along it.
- **Denials and results answer back.** A low-stamina roll, light, or heavy
  request gets a restrained warning without consuming the existing 260 ms input
  buffer. The grade seal stamps once at its established 1.5-second reveal, with
  a small S-rank lift.
- **No new performance cost at rest.** No MP3, request, loader worker, startup
  node, render operation, particle, or save field was added. All new synthesis
  is event-bound and routes through the established voice budget, ducking, room,
  and limiter.

Full rationale, deterministic contract checks, publication receipts, and public
desktop/mobile verification: [`docs/releases/v2.26.md`](docs/releases/v2.26.md).

## Fixed by Codex — v2.27 earned offense

- **One mixed combo, no fifth button.** `ATK · ATK · HVY` becomes Sunder only
  after both light contacts. Its 24-damage ender brings the route to 50 damage,
  70 poise, and 44 stamina. `ATK · ATK · ATK` remains 50 damage, 50 poise, and
  36 stamina.
- **Defense and variety earn the limit break.** A 100-point run-local Resolve
  meter rewards connected strings, Sunder, roll slash, perfect dodge, charged
  heavy, flank, and Execute. It is presentation plus combat state, never a save
  migration or score modifier.
- **Gracebreak stays a decision.** Full Resolve changes only a fully held HVY.
  The release spends on whiff, restores 20 stamina only on contact, never
  clears hazards or grants invulnerability, yields to staggered Execute, and
  cannot stagger Oath +5.
- **The interface teaches without crowding.** A four-segment rail fits between
  stamina and flasks; full meter changes the existing touch HVY label to
  BREAK. Sunder and Resolve technique copy reuse the established chain lane,
  while the semantic combat panel exposes the same state to assistive
  technology.
- **Performance stays bounded.** No asset, request, particle pool, render
  surface, persistent field, or continuous audio layer was added. The measured
  worst-case frame remains at 39 gradients, 2 image draws, and 9 shadow-blur
  writes; the interface adds five simple draw calls.

Complete balance contract, route-priority decisions, local acceptance, release
receipts, and production verification:
[`docs/releases/v2.27.md`](docs/releases/v2.27.md).

## Fixed by Codex — v2.27.1 live combat readability

- **Short phones protect the opening tell.** At 360×640, the fight uses a
  slightly wider crop and a less player-biased vertical camera target. Malakar
  stays below the utility rail while the player remains above the boss HUD.
- **Teaching moves into reserved space.** The short-phone tutorial card sits
  between the boss HUD and action cluster; its duplicate lower hint is
  suppressed. The first card also teaches `ATK×2 → HVY SUNDER`.
- **Oath state has one owner.** During compact FORSAKEN packets, `OATH CHAIN`
  and `IRONBOUND` render together in the boss-title lane. The separate label is
  withheld only while that combined plate is active.
- **Resolve is easier to read.** The four-segment rail is thicker, full meter
  says `BREAK READY`, the touch button remains `BREAK`, and desktop explicitly
  says to hold K.
- **The patch stays presentation-only.** No combat number, boss pattern,
  difficulty modifier, save-v7 field, score, audio event, asset, touch target,
  or persistent state changed.

Complete reproduction, design rationale, regression matrix, publication, and
production evidence: [`docs/releases/v2.27.1.md`](docs/releases/v2.27.1.md).

## Fixed by Codex — v2.27.3 touch BREAK activation

- **The visible command now works on tap.** At full Resolve, tapping the
  contextual touch `BREAK` button latches the existing charged-heavy sequence
  until its authored 0.5-second maximum, then releases exactly one Gracebreak.
- **The ritual remains readable.** Ready copy says
  `FULL RESOLVE · TAP BREAK · GRACEBREAK`; the button stays visibly active
  during the charge, and the existing release banner/damage number confirms
  success.
- **Desktop depth remains intact.** Keyboard and mouse still require a manual
  hold. Releasing early remains a normal partial heavy and does not spend
  Resolve.
- **Combat authority remains intact.** Sunder and stagger Execute keep their
  established priority. Damage, poise pressure, stamina, whiff spending,
  Resolve gain, difficulty, saves, score, boss actions, audio mix, assets,
  touch geometry, and render budgets do not change.

Implementation, real-touch reproduction, screenshots, regression evidence,
publication, and exact-SHA deployment receipts:
[`docs/releases/v2.27.3.md`](docs/releases/v2.27.3.md).

## Fixed by Codex — v2.27.2 combo truth

- **Execute keeps its payoff.** If the second connected light breaks poise,
  the pending HVY route resolves as the established stagger Execute, never
  Sunder. ROLL still owns simultaneous priority.
- **A wound no longer swallows the next decision.** One ATK, HVY, FLASK, or
  ROLL pressed during the 320 ms recovery is held until movement returns; a
  later ROLL replaces an earlier choice.
- **Contact state owns the copy.** The lane now says `1 HIT · LAND NEXT ATK`,
  `SUNDER READY · TAP HVY`, `EXECUTE READY · TAP HVY`, or
  `CHAIN LOST · <reason>`. The existing HVY button becomes `SUNDER` or
  `EXECUTE` only while that action is authoritative.
- **Recipes remain discoverable.** Pause lists Light Finisher, Sunder, and
  Gracebreak. The semantic combat panel exposes the queued recovery action and
  the optional Combat tips explain that misses, wounds, rolls, and delay reset
  Sunder.
- **Balance remains measured.** The connected-hit window stays 600 ms. No
  damage, stamina cost, boss action, difficulty modifier, score/save field,
  audio event, runtime asset, touch target, or persistent setting changed.
- **Graceful audio cleanup cannot stall.** The existing 90 ms charge-loop fade
  now has a 160 ms wall-clock cleanup backstop for suspended AudioContexts. It
  adds no voice, node, cue, or mix change.
- **The score chronicle returns focus deterministically.** Closing it with
  Escape or CLOSE restores focus to RECORDS during the committed React layout,
  so keyboard control cannot trail dialog removal by a timer tick.

Complete implementation, local acceptance, GitHub publication, and exact-SHA
production receipts: [`docs/releases/v2.27.2.md`](docs/releases/v2.27.2.md).

## Improved by Codex — v2.27.4 room to read

- **The first Journey opening is playable teaching time.** An unfinished
  tutorial on a negative Journey path gives Malakar one 3.2-second stalking
  approach before attack selection. Returning players, Measured, and every
  Oath retain the established 0.4-second opening.
- **The intro no longer spends the tutorial clock.** The opening MOVE message
  receives its full 4.5 seconds after control begins. On touch, the faint MOVE
  target remains visible until movement is learned even if another action is
  tried first.
- **Teaching leaves the exchange sooner.** Moving advances to the existing
  roll lesson for four seconds rather than six, reducing banner competition
  during close combat without adding a new tutorial screen.
- **Instructions match the device.** Combat tips are three short techniques.
  Touch says `tap Break`; keyboard and mouse say `hold Heavy through the
  charge`.
- **The combat stays Gracefell.** No new action, button, mode, boss pattern,
  reward, damage value, stamina value, save field, asset, or touch geometry was
  added.

Five independent agent-simulated gamer roles scored the exact candidate
8.0–9.0/10. Research, local acceptance, scorecards, and the bounded-change
record are in [`docs/releases/v2.27.4.md`](docs/releases/v2.27.4.md).
That record includes reviewed CI, exact-SHA deployment, and complete public QA.

## Improved by Codex — v2.27.5 stagger authority

- **The earned opening cannot be stolen.** A poise break that also crosses the
  55% or 22% phase threshold keeps its complete authored stagger. The existing
  ring transition begins once after that opening ends.
- **Every surface names the same next action.** `boss.executeReady` owns the
  central prompt, semantic combat status, touch heavy label, Resolve rail, and
  live status. Sunder and Gracebreak cannot advertise over an available
  Execute; a full stored meter says `RESOLVE FULL` until stagger ends.
- **Consumption is truthful.** The successful Execute announces `EXECUTE`.
  While the remaining stagger animation finishes, the button returns to
  ordinary `HVY`; a second heavy remains ordinary and preserves full Resolve.
- **The combat stays Gracefell.** No damage, poise, stamina, stagger duration,
  phase timing, difficulty, score, save, audio, asset, control, or geometry
  value changed.

Research, adversarial review, exact-duration and exact-once checks, genuine
touch/keyboard actions, and semantic-DOM evidence are in
[`docs/releases/v2.27.5.md`](docs/releases/v2.27.5.md). Five exact-bundle
agent-simulated gamer roles scored it 9.0–9.6/10 with no zero category or
blocker; the same record contains reviewed CI, exact-SHA deployment, and the
complete public QA receipt.

## Running it

```bash
npm ci          # deterministic install from the committed lockfile
npm run build   # tsc -b && vite build
npm run dev     # or just: vite on :3000
npm run qa      # build + portable desktop/mobile/touch Playwright gate
```

Production is a zero-dependency Node static server (`server.mjs`) in front of `dist/`, behind a Cloudflare tunnel.

## Structure

```
src/game/engine.ts   the entire game — Input, Player, Boss, Game + render layer (~3.3k lines)
src/game/audio.ts    hybrid Web Audio: recorded SFX + procedural fallback + generated score
public/audio/        MiniMax score and generation provenance
docs/releases/       durable release acceptance and production evidence
docs/visual-upgrade/ Blender-assisted 2.5D specification and concept boards
art/blender/          reproducible Blender sources, review proof, and receipts
public/art/           optimized versioned runtime arena and Malakar assets
scripts/art/          deterministic Blender build and asset validator
src/pages/Home.tsx   mounts the canvas + semantic companion controls
qa/run.cjs           starts an isolated 127.0.0.1:8492 QA server
qa/verify.cjs        portable headless Playwright gate — the thing that decides "done"
DESIGN.md            per-version reasoning log
AGENTS.md            operational runbook / don't-undo list
PROVENANCE.md        who built what, and the rules for the next agent
info.md              concise current package/runtime/documentation index
scripts/provenance.sh  regenerates that ledger from git trailers
```

`window.__game` is live in the console if you want to poke at it. A local production build is
served at `http://127.0.0.1:8491/` when `node server.mjs` is running.

## On "done"

Nothing here ships on a claim. `npm run qa` drives real Chromium at 1280×800 and 390×844,
plus an emulated real-touch phone. It checks canvas output, console health, streamed audio, cold
first-tap cost, explicit keyboard/touch pause, battle-menu ownership, title score history,
save-v6 migration, semantic combat state, accessibility focus/pause, intro and terminal isolation, expanded touch targeting,
hit-stop buffering, 30/60/120 Hz combat motion, meteor cadence, heavy impulse, phase cleanup,
victory/grade/persistence, touch and pointer-only resurrection, and genuine perfect-dodge behavior.
It also enumerates the Journey/Oath curve, forces a complete expert boss packet, performs the
contextual rite, verifies lethal-source advice and Receive Grace ownership, and requires visible
queued-input plus 1/3 → 2/3 → finisher feedback from a real three-tap touch chain. Green, or it isn't done.

## License

No license specified — all rights reserved for now. Ask if you want to use it.
