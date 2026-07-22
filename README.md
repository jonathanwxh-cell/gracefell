# GRACEFELL

A boss-arena souls-like that runs in a single HTML canvas. One knight, one sovereign, one room.

**Built for a phone.** Left thumb steers, right thumb fights. It runs on a desktop too and the
keyboard still works — but the layout, the control sizes, the difficulty dial and the readability
rules are all decided by what works one-handed on a 390px screen.

**Play it: [gracefell.alyoechosys.dev](https://gracefell.alyoechosys.dev)**

Zero art assets, one generated music track. Every stone in the floor, every ember, every wing, and every combat cue is generated at runtime from code — canvas 2D for the visuals and Web Audio for the SFX. A MiniMax Music 3.0 instrumental supplies the score, with the original procedural drone and phase-aware drums kept underneath and available as the offline fallback. The visual game remains one `<canvas>`; a focus-revealed semantic companion exposes controls and safety settings to keyboards and assistive technology without covering the playfield.

The sovereign has an audio language, not one generic warning: swipes whistle, charges rise, volleys crystallise, rings resonate, meteors fall and the spiral winds itself tight. Impacts are layered and positioned across the arena, the stone room supplies a generated reverb tail, and the whole score ducks and limits itself when phase three gets crowded. The shipped MP3 is music only; every combat sound, noise source and room impulse is still synthesized at startup.

---

## Credits

**v1 — written by Kimi (OKComputer).** The original prototype: the engine skeleton, the Input/Player/Boss/Game architecture, souls-style input buffering, the two-phase boss with six attacks, the procedural Web Audio engine, the parchment-and-grace-gold art direction, and the writing ("a boss waits at the end of grace"). That version was already a real game — it just hadn't been polished.

**v2 — extended by Claude (Opus 4.8).** Combat depth, a third phase, a full rendering pass, persistence, and a headless verification gate. Details in [DESIGN.md](DESIGN.md).

**v2.4–v2.5 — audio extended by Codex (GPT-5).** Attack-specific procedural cues, spatial mix protection, and the MiniMax-generated score with a procedural fallback. The generation prompt and file hash are recorded in [`public/audio/README.md`](public/audio/README.md).

Directed by [@jonathanwxh-cell](https://github.com/jonathanwxh-cell), who asked for "AAA grade" and meant it.

Different agents keep working on this. **[PROVENANCE.md](PROVENANCE.md)** is the ledger of
who did which pass, and the rules any future agent follows before touching the code.

---

## Controls

**On a phone** — the way it's meant to be played:

| | |
|---|---|
| drag anywhere on the **left half** | a floating stick appears under your thumb; steer with it |
| **ATK** | slash — tap again in rhythm to chain a 3-hit combo |
| **ROLL** | invincible — roll *into* a swing for a perfect dodge |
| **HVY** | heavy, slow, big poise damage |
| **FLASK** | heal (you get three) |

The buttons scale with your screen and sit clear of the home indicator. Haptics fire on hits and
perfect dodges, and can be switched off on the title screen.

**On a desktop**, if that's what you have: WASD/arrows move, Space or Shift rolls, J or left-click
slashes, K or right-click is heavy, F drinks, M mutes.

## The fight

Malakar has three phases and does not scale to your skill.

1. **Ashen Sovereign** — swipes, slams, charges, volleys. Learn the tells.
2. **The Burning Sovereign** (55% HP) — wings unfurl, everything speeds up, meteors and expanding rings enter the rotation.
3. **Grace-Forsaken** (22% HP) — cooldowns reset, ring attacks come in pairs, meteors come nine at a time, and a two-armed rotating spiral fills the arena with fire.

Break his poise to stagger him; staggered hits do 1.4×. Land a roll *into* an incoming attack for a perfect dodge — slow-motion, stamina back, and poise damage. Defense is how you win.

Victory is graded S through C on time and wounds taken. Your best time and win count persist locally. A no-hit run is an S.

## The grace dial

There's no easy mode. There's one dial on the title screen, running **−3 to +5**.

Turn it down and the sovereign slows, your dodge window widens, his hits land softer, you carry
an extra flask. Turn it up and he speeds up, your flasks disappear, and past +3 he stops
staggering at all.

The rule the design holds to: **aid lengthens the read, it doesn't change the fight.** The pattern
you learn at −3 is the same pattern you execute at +5 — nothing is removed, nothing is simplified,
you're just given more time to see it coming.

And the record carries the setting. Best times are stored per grace level and the victory seal
stamps the trial you ran, so "S at +2" and "S at −1" stay different things. Beating him is
supposed to mean something; it just shouldn't require the same reflexes from everybody.

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

The sparse two-and-a-half-minute dark-fantasy score was generated with MiniMax and ships locally,
with a procedural fallback if it cannot stream. Combat audio is synthesized in the browser: every attack
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

The MP3 is streamed through the Web Audio music bus instead of being fully decoded into memory.
Generated noise and the arena response are prepared before the first gesture, keeping the first
attack responsive while preserving the same spatial mix, ducking, and limiter path.

If the tab loses focus or a phone interruption hides the page, simulation and audio pause together.
Returning resumes from the same fight frame rather than letting Malakar attack an absent player.

## Running it

```bash
npm install     # npm ci fails on this lockfile — use install
npm run build   # tsc -b && vite build
npm run dev     # or just: vite on :3000
npm run qa      # build + portable desktop/mobile/touch Playwright gate
```

Production is a zero-dependency Node static server (`server.mjs`) in front of `dist/`, behind a Cloudflare tunnel.

## Structure

```
src/game/engine.ts   the entire game — Input, Player, Boss, Game + render layer (~2.1k lines)
src/game/audio.ts    hybrid Web Audio: procedural SFX/fallback + generated score
public/audio/        MiniMax score and generation provenance
src/pages/Home.tsx   mounts the canvas + semantic companion controls
qa/run.cjs           starts an isolated 127.0.0.1:8492 QA server
qa/verify.cjs        portable headless Playwright gate — the thing that decides "done"
DESIGN.md            per-version reasoning log
AGENTS.md            operational runbook / don't-undo list
PROVENANCE.md        who built what, and the rules for the next agent
scripts/provenance.sh  regenerates that ledger from git trailers
```

`window.__game` is live in the console if you want to poke at it.

## On "done"

Nothing here ships on a claim. `npm run qa` drives a real Chromium at 1280×800 and 390×844 and asserts the canvas has ink, the console is clean, the generated soundtrack streams through the mix, interruption pause works, touch actions survive hit-stop, semantic controls exist, all three phases trigger, victory computes a grade, saves round-trip, and a perfect dodge refunds stamina without taking damage. Green, or it isn't done.

## License

No license specified — all rights reserved for now. Ask if you want to use it.
