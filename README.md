# GRACEFELL

A boss-arena souls-like that runs in a single HTML canvas. One knight, one sovereign, one room.

**Play it: [gracefell.alyoechosys.dev](https://gracefell.alyoechosys.dev)**

Zero art assets. Zero audio files. Every stone in the floor, every ember, every wing, and every drum hit is generated at runtime from code — canvas 2D for the visuals, Web Audio for the score and the SFX. The whole thing is one `<canvas>` and about two thousand lines of TypeScript.

---

## Credits

**v1 — written by Kimi (OKComputer).** The original prototype: the engine skeleton, the Input/Player/Boss/Game architecture, souls-style input buffering, the two-phase boss with six attacks, the procedural Web Audio engine, the parchment-and-grace-gold art direction, and the writing ("a boss waits at the end of grace"). That version was already a real game — it just hadn't been polished.

**v2 — extended by Claude (Opus 4.8).** Combat depth, a third phase, a full rendering pass, persistence, and a headless verification gate. Details in [DESIGN.md](DESIGN.md).

Directed by [@jonathanwxh-cell](https://github.com/jonathanwxh-cell), who asked for "AAA grade" and meant it.

Different agents keep working on this. **[PROVENANCE.md](PROVENANCE.md)** is the ledger of
who did which pass, and the rules any future agent follows before touching the code.

---

## Controls

| | |
|---|---|
| **WASD** / arrows | move |
| **Space** / Shift | roll (invincible — and a *perfect* dodge if you time it into the swing) |
| **J** / left click | slash — chains into a 3-hit combo |
| **K** / right click | heavy |
| **F** | flask (you get three) |
| **M** | mute |

On touch: left half of the screen is a floating stick, buttons are bottom-right.

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

## Reading the screen

One colour in this game means *this will hurt you* — a hot red reserved for hostile projectiles,
hostile rings, and attack telegraphs. Nothing decorative is allowed to borrow it; the ambient fire,
the boss's own burning core and his sword glow are all amber instead. There's a test that fails the
build if an ambient particle ever picks up the hazard colour.

Hazards are shape-coded too, so they survive colour blindness and bad displays: projectiles carry a
hard white core and a rotating diamond outline (decoration is round), hostile rings show a bright
leading edge — the part you actually have to clear — and meteors close four ticks inward so the fuse
reads as motion rather than hue.

## Running it

```bash
npm install     # npm ci fails on this lockfile — use install
npm run build   # tsc -b && vite build
npm run dev     # or just: vite on :3000
```

Production is a zero-dependency Node static server (`server.mjs`) in front of `dist/`, behind a Cloudflare tunnel.

## Structure

```
src/game/engine.ts   the entire game — Input, Player, Boss, Game + render layer (~2.1k lines)
src/game/audio.ts    procedural Web Audio: SFX primitives, drone, phase-aware drums
src/pages/Home.tsx   mounts a canvas. that's all it does.
qa/verify.cjs        headless Playwright gate — the thing that decides "done"
DESIGN.md            per-version reasoning log
AGENTS.md            operational runbook / don't-undo list
PROVENANCE.md        who built what, and the rules for the next agent
scripts/provenance.sh  regenerates that ledger from git trailers
```

`window.__game` is live in the console if you want to poke at it.

## On "done"

Nothing here shipped on a claim. `qa/verify.cjs` drives a real Chromium at 1280×800 and 390×844 and asserts the canvas actually has ink in it, that the console is clean, that all three phases trigger, that victory computes a grade, that saves round-trip through localStorage, and that a perfect dodge really does refund stamina without taking damage. Green, or it isn't done.

## License

No license specified — all rights reserved for now. Ask if you want to use it.
