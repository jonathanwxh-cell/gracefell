# PROVENANCE — who did what

This project is built by multiple AI agents across separate sessions, directed by a human.
**Every agent that changes this repo records itself here.** No exceptions, including for
one-line fixes.

The point isn't bureaucracy — it's that six months from now, someone (probably another
agent) needs to know whether a weird piece of code is load-bearing design or a leftover
from a pass that got abandoned halfway.

---

## The ledger

Newest last. One row per pass. A "pass" = one continuous working session by one agent.

| Version | Date | Agent | Model / harness | Directed by | What it did |
|---|---|---|---|---|---|
| v1.0 | 2026-07-22 | Kimi | OKComputer | @jonathanwxh-cell | Original build: engine architecture (Input/Player/Boss/Game), souls-style input buffering, two-phase boss with six attacks, procedural Web Audio engine, art direction and writing |
| v2.0 | 2026-07-22 | Claude | Opus 4.8 via Hetzner MCP | @jonathanwxh-cell | Perfect dodge, 3-hit combo, phase 3 + spiral attack, baked floor + scorch decals, additive bloom, god rays, boss wings/shards, grades + localStorage, Playwright QA gate, deploy |
| v2.1 | 2026-07-22 | Claude | Opus 4.8 via Hetzner MCP | @jonathanwxh-cell | Public release: README, provenance system, commit trailer convention |
| v2.2 | 2026-07-22 | Claude | Opus 4.8 via Hetzner MCP | @jonathanwxh-cell | Clarity + accessibility: reserved hazard hue with shape coding, grace dial (−3..+5), shake/flash toggles, per-trial bests, save schema v2, menu layout assertions |
| v2.2.1 | 2026-07-22 | Claude | Opus 4.8 via Hetzner MCP | @jonathanwxh-cell | Docs pass: README grace-dial + readability sections, DESIGN v2.1 section backfilled, AGENTS stale entries corrected (save schema, dodge window), listed + featured on sites.alyoechosys.dev |
| v2.3 | 2026-07-22 | Claude | Opus 4.8 via Hetzner MCP | @jonathanwxh-cell | Mobile-first: up-front coarse-pointer detection, responsive safe-area thumb cluster, touch-first copy, haptics, and a real thumbs-only QA pass |
| v2.4 | 2026-07-22 | Codex | GPT-5 / Codex Desktop | @jonathanwxh-cell | Procedural audio clarity pass: attack-specific tells, layered spatial impacts, arena reverb, mastering and ducking, reusable noise, scheduled music, cleanup, combat haptics, and audio-state QA |
| v2.5 | 2026-07-22 | Codex + MiniMax | GPT-5 / Codex Desktop + Music 3.0 free | @jonathanwxh-cell | Generated and integrated an original two-minute dark-fantasy score, crossfaded through the existing music bus with procedural fallback, combat ducking, local asset provenance, and decode QA |
| v2.6 | 2026-07-22 | Codex | GPT-5 / Codex Desktop | @jonathanwxh-cell | Implemented the six open audio enhancements locally: organic boss vocals, centralized non-repeating SFX variation, player-relative distance audio, material impacts and boss foley, adaptive music buses, true-peak protection, and a longer spectrally shaped arena reverb |
| v2.7 | 2026-07-22 | Codex | GPT-5 / Codex Desktop | @jonathanwxh-cell | Responsiveness and performance polish: buffered touch actions through hit-stop, interruption-safe pause/audio lifecycle, streamed MiniMax score, adaptive floor cache, readable mobile HUD, semantic companion controls, clean defeat state, and portable CI playtests |

---

## Rules for agents

### 1. Identify yourself honestly

Use the name you're actually known by and the model you're actually running as. If you
don't know your own model string, say so (`Claude, model unknown`) rather than guessing.
If you're a sub-agent or running inside a harness (Codex, OKComputer, Cursor, Claude Code,
a cron job), name the harness too — it explains a lot about why code looks the way it does.

**Never claim a previous agent's work.** If you extend someone's system, the ledger should
read as extension. If you rewrite it, say "rewrote X (was: Kimi v1.0)" so the replacement
is legible.

### 2. Tag every commit with a trailer

Append to the commit message body, after a blank line:

```
Agent-Pass: Claude / Opus 4.8 / Hetzner MCP
Co-authored-by: Claude (Opus 4.8) <claude@anthropic.invalid>
```

`Agent-Pass` is the parseable one. `Co-authored-by` is a GitHub-native trailer so the
contribution shows up in the UI. Use a `.invalid` domain (RFC 2606, reserved) so the
address can never collide with a real account.

This matters because **the ledger is recoverable from git even if PROVENANCE.md drifts**:

```bash
git log --format='%h %ad %(trailers:key=Agent-Pass,valueonly)' --date=short
```

A commit template lives at `.gitmessage`. Enable it once per clone:

```bash
git config commit.template .gitmessage
```

### 3. Add a ledger row when you finish a pass

Not per commit — per pass. Bump the version: patch for fixes, minor for features, major
for a rewrite. Then write the matching section in `DESIGN.md`.

### 4. DESIGN.md section heading format

```markdown
## v2.0 — Claude (Opus 4.8), "the AAA pass" (2026-07-22)
```

`## vX.Y — <Agent> (<model>), "<what you called it>" (<ISO date>)`

The DESIGN.md section is where *reasoning* goes: what you tried, what you rejected and
why, what surprised you, what's load-bearing. The ledger row is one sentence; the DESIGN
section can be long. Future agents read DESIGN.md to avoid re-litigating decisions you
already worked through.

### 5. If you break something a previous agent built, say so out loud

In the DESIGN section, under a `### Changed from vX.Y` heading. Silent regressions across
agent handoffs are the single most expensive failure mode in this codebase — nobody
notices until a user does.

---

## Why this exists

Multiple agents touch this repo with no shared memory between them. Each one arrives
cold, reads whatever's written down, and acts. Anything not written down did not happen.

Provenance is also just fair. Kimi wrote the engine this game runs on. That should be
visible to anyone who clones it, permanently, not smoothed away by whoever happened to
touch the code last.
