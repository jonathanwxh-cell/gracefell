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
| v2.7.1 | 2026-07-22 | Codex | GPT-5 / Codex Desktop | @jonathanwxh-cell | Release hardening: resampled prepared Web Audio data to the runtime context rate so 44.1 kHz browsers can initialize arena reverb and start the fight; added CI coverage for the invariant |
| v2.8 | 2026-07-22 | Codex + MiniMax | GPT-5 / Codex Desktop + Music 2.6 | @jonathanwxh-cell | Replaced the overbearing score with a sparse low-loudness underscore; lowered and presence-shaped the music bus, added action-triggered ducking, and reserved critical voices for player verbs and boss windups |
| v2.9 | 2026-07-23 | Codex | GPT-5 / Codex Desktop | @jonathanwxh-cell | Fixed by Codex after three read-only game-developer reviews: deterministic combat and input fixes, clearer light impacts, mobile/semantic UX repairs, phase-safe presentation, low-cost arena storytelling, and expanded local/live regression coverage |
| v2.9.1 | 2026-07-23 | Codex | GPT-5 / Codex Desktop | @jonathanwxh-cell | Fixed the reported mobile resurrection failure with Pointer Events support, durable terminal-screen confirmation, and real-touch plus pointer-only death/retry regressions |
| v2.10 | 2026-07-23 | Codex | GPT-5 / Codex Desktop | @jonathanwxh-cell | Fixed by Codex after a three-lane difficulty review: immutable trials, nine-level balance coverage, fair mobile swipe tells, restored phase-three combo and +3/+4 poise play, honest records/layout, and an explicit +5 IRONBOUND HUD |
| v2.10.1 | 2026-07-23 | Codex | GPT-5 / Codex Desktop | @jonathanwxh-cell | Documentation-completeness pass: durable v2.10 acceptance/deployment evidence, current README/info/package metadata, corrected production runbook, known limits, and explicit separation from future graphics proposals |
| v2.11-rc1 | 2026-07-23 | Codex + design-house agents | GPT-5 / Codex Desktop | @jonathanwxh-cell | Local candidate for issue #10: three-studio redesign, user-selected Kite-Veil direction, seven procedural player silhouettes, mobile/desktop comparison evidence, and design QA; not deployed |
| v2.11-rc2 | 2026-07-23 | Codex implementation + Kimi image/brief | GPT-5 / Codex Desktop | @jonathanwxh-cell | Local candidate for issue #14: a partial procedural translation of Kimi's Fallen Blade-Saint concept image, with persistent nine-blade volley halo, stagger wobble, phase-three shadow-sword draw, mobile/desktop comparison evidence, and regression coverage; not deployed |
| v2.11 | 2026-07-23 | Codex + live user panel | GPT-5 / Codex Desktop | @jonathanwxh-cell | Published partial procedural interpretations of the selected Kimi-backed #10/#14 concepts, verified production, ran mobile/desktop/accessibility personas, fixed the semantic Start focus trap, and added durable local/CI/public evidence; graphics issue closure was later deferred |
| v2.11-doc1 | 2026-07-23 | Codex attribution correction | GPT-5 / Codex Desktop | @jonathanwxh-cell | Clarified that Kimi supplied six concept images and briefs while the shipped Canvas 2D work only partially translates #10/#14; reopened graphics issues #10–#15 so final visual acceptance and closure can happen later |
| v2.11-doc2 | 2026-07-23 | Codex issue closeout | GPT-5 / Codex Desktop | @jonathanwxh-cell | Closed graphics issues at the owner's request with attribution intact: #10/#14 completed as shipped partial interpretations; #11/#12/#13/#15 not planned as unselected alternatives |
| v2.11.1 | 2026-07-23 | Codex | GPT-5 / Codex Desktop | @jonathanwxh-cell | Persisted complete boss-defeat scorecards in save schema v3, added a visible saved-state confirmation, blocked queued victory skips behind a 4.5-second hold, slowed the replay pulse, and expanded desktop/touch regression and screenshot evidence |
| v2.11.2 | 2026-07-23 | Codex | GPT-5 / Codex Desktop | @jonathanwxh-cell | Fixed rapid light taps collapsing into two attacks, preserved three distinct combo inputs with roll priority, separated the step-three finisher from HVY audio/visual identity, and added desktop plus true-touch regressions |
| v2.12 | 2026-07-23 | Codex | GPT-5 / Codex Desktop | @jonathanwxh-cell | Added the disclosed first-run Journey, contextual combat rite, lethal-source hints, voluntary repeated-death Grace, authored expert Oath packets, visible player combo progress, v4 execution scores, and complete local/CI/production acceptance |
| v2.12.1 | 2026-07-24 | Codex | GPT-5 / Codex Desktop | @jonathanwxh-cell | Fixed pre-death movement accepting Grace without consent, eased Oath I/II raw pressure, strengthened boss-cue and close-contact readability, surfaced queued touch attacks, and decluttered record-heavy phone titles |
| v2.13 | 2026-07-24 | Codex | GPT-5 / Codex Desktop | @jonathanwxh-cell | Added explicit PAUSE/RESUME for phone and desktop with a 44px touch control, P/Escape shortcuts, a frozen-state overlay, audio suspension, interruption-safe ownership, and ghost-input clearing |
| v2.14 | 2026-07-24 | Claude | Opus 4.8 / Hetzner MCP | @jonathanwxh-cell | Feel & spectacle from a gamer's-eye polish review: dynamic combat camera (tightens a clean 1v1, widens for area-denial), stagger execution (once-per-break heavy riposte, ~109 vs 42), and phase-2/3 arena deterioration via the offscreen scorch canvas — each guarded by a numeric QA assertion; no save-schema, layout, audio-contract, or reserved-hue change |
| v2.15 | 2026-07-24 | Claude | Opus 4.8 / Hetzner MCP | @jonathanwxh-cell | Offense pass: hold-to-charge heavy (charge by holding through the wind-up — a quick tap is the unchanged heavy; release fires up to 1.75× damage + a poise-breaker feeding the stagger execution; new `Input.touchPoints` + `heavyInputHeld()` for touch, gold charge ring) and a phase-3 musical lift folded into the existing adaptive buses via `setPhase`/`updateCombatState` (no new nodes, no MP3 change); four numeric QA assertions |
| v2.16 | 2026-07-24 | Claude | Opus 4.8 / Hetzner MCP | @jonathanwxh-cell | Hygiene A (audit issues #38/#41/#44/#45/#46, no gameplay change): server.mjs security headers (nosniff/Referrer-Policy/DENY) + immutable `/audio/` caching; removed the opaque `kimi-plugin-inspect-react` build plugin; adopted `npm ci` (the "broken lockfile" note was stale — verified exit 0) across README/AGENTS/info/CI; added `LICENSE` + package `license` field; new QA header assertion. #37 dead-dep prune deferred to its own pass |
| v2.16.1 | 2026-07-24 | Claude | Opus 4.8 / Hetzner MCP | @jonathanwxh-cell | Hygiene B (audit issue #37, no behaviour change): deleted the unreachable shadcn tree (`src/components/ui/` 50 files + `use-mobile`/`lib/utils`/`App.css`/`components.json`) and pruned 43 unreachable production deps (all `@radix-ui/*` + cmdk/recharts/etc.), keeping only react/react-dom/react-router. `src/` is now the six game files; CSS bundle 80 KB → 10.6 KB, JS unchanged. Build (`tsc`) + full gate are the safety net |
| v2.17 | 2026-07-24 | Claude | Opus 4.8 / Hetzner MCP | @jonathanwxh-cell | Web polish (audit issues #39/#40, no gameplay change): self-hosted Cinzel + Cormorant Garamond (latin woff2 bundled + hashed into `/assets/`, `@font-face` in index.css) so the page makes zero third-party font requests; added a code-drawn `favicon.svg`, headless-rendered apple-touch/192/512 PNGs, `manifest.webmanifest`, and description/OG/Twitter meta. New QA assertion for no-CDN + manifest/favicon |
| v2.17.1 | 2026-07-24 | Claude | Opus 4.8 / Hetzner MCP | @jonathanwxh-cell | Code quality (audit issues #43/#42, no behaviour change): added Vitest + `src/game/engine.test.ts` (14 tests — math helpers, `seededRandom`, the `difficultyForGrace` −3..+5 balance contract, the `isVictoryScore` save-v4 validator), extracting `difficultyForGrace` to a pure exported fn (method delegates) and exporting `isVictoryScore`; wired `npm test` into CI; removed the redundant `as any` on all 10 `Game.prototype` render assignments. Closes out all ten repo-audit issues |
| v2.18 | 2026-07-24 | Codex + MiniMax | GPT-5 / Codex Desktop + Music 3.0 | @jonathanwxh-cell | Integrated the parallel v2.16–v2.17.1 stream, generated/re-cut/mastered three background-safe phase cues, added permanent two-deck streaming, sub-second transitions, retry/fallback and pause safety, stack-safe ducking, persisted Music/SFX controls, a live MIX dialog, save schema v5, expanded desktop/mobile/touch QA, and fixed immutable audio caching on Windows |
| v2.19 | 2026-07-24 | Codex + three player-review agents | GPT-5 / Codex Desktop | @jonathanwxh-cell | Fixed the reviewed combat-clarity findings, added a safe battle-to-title MENU and responsive dated SCORES chronicle, migrated saves to v6, serialized Web Audio pause ownership, and expanded desktop/mobile/true-touch acceptance |
| v2.20 | 2026-07-24 | Codex | GPT-5 / Codex Desktop | @jonathanwxh-cell | Added cost-optimal fixed-pool phase weather: Quiet Ash, Ember Gale, and Gracefall Storm reuse 64 batched motes, existing rays/embers/backdrop, pause-safe transitions, reduced-motion softening, and measured desktop/mobile/touch acceptance without changing combat or assets |
| v2.21 | 2026-07-25 | Codex | GPT-5 / Codex Desktop | @jonathanwxh-cell | Implemented issues #57/#58/#60/#62/#63/#64 as a coherent mastery release: safe buffered roll slash, rear-arc flank reward, terminal chronicle, explicit one-step Ascension, offline victory PNG sharing, mirrored saved touch controls, save v7, and expanded local/public acceptance |
| v2.21.1 | 2026-07-25 | Codex | GPT-5 / Codex Desktop | @jonathanwxh-cell | Fixed the short-phone saved-result title distortion by anchoring the complete copy stack to the measured settings plate, preserving tap geometry and adding true-touch separation assertions |
| v2.21.2 | 2026-07-25 | Codex + three game-menu review agents | GPT-5 / Codex Desktop | @jonathanwxh-cell | Merged, deployed, and publicly verified two-round desktop-coherence release: repaired the saved-score/prompt collision, introduced the named plain-language Trial Seal and one dominant start action, quieted safety settings, scaled the shared hierarchy on wide desktops, fitted the wordmark on narrow phones, and added a veiled structured semantic controls grid with native disclosure ownership |
| v2.22 | 2026-07-25 | Codex + audio runtime, gameplay integration, mastering, and acceptance agents; source masters by Kimi/OKComputer | GPT-5 / Codex Desktop; Moonshot source generation | @jonathanwxh-cell | Audited and selectively remastered the supplied 50-cue combat library, admitted 45 cues through a bounded priority loader with procedural fallback, gave charged-heavy and boss/player actions explicit lifecycle ownership, added phone-safe contact edges and constrained-network acceptance, and documented exact asset processing, exclusions, and hashes |
| v2.22.1 | 2026-07-26 | Codex | GPT-5 / Codex Desktop | @jonathanwxh-cell | Fixed the reported iPhone combat HUD collision by separating player resources from a consistent 44px utility rail, centralizing protected HUD geometry, and adding cross-layer mobile collision acceptance |
| v2.23 | 2026-07-26 | Claude | Opus 5 / Claude Code | @jonathanwxh-cell | Added `qa/perf.cjs`, a deterministic op-census render-cost gate (gradient ceiling, gradients-per-projectile slope, shadowBlur and draw-call caps, two-frame determinism), because the v2.20 timing budget asserts a 0.5 ms delta against ±20% measured drift and cannot detect what it claims. Implemented and then **rejected all four** candidate optimisations on interleaved same-build-control evidence: glow-particle sprites **+17.6% slower**, projectile sprite −1.5%/−3.5%, text double-draw −1.4%, baked vignette +1.9%, against a +0.5% control. `src/` unchanged — `git diff v2.22.1 -- src/` is empty. Finding: a worst-case phase-three frame is ~1.7 ms of a 16.7 ms budget, so visual work should not be gated on draw-path headroom; the open risks are per-frame allocation and low-end mobile GPUs |
| v2.24 | 2026-07-26 | Claude | Opus 5 / Claude Code | @jonathanwxh-cell | Impact frames, presentation only: sword trail rebuilt as one continuously tapered filled strip (was up to nine constant-width strokes that banded at the joins), a swing stretches the player along facing and squashes across it over 0.16 s, and a hit makes the boss's drawn body give ground while its shadow stays planted. The stretch is applied to the transform *around* `drawKiteVeilBody`, never to the authored path data, so the `design-qa.md` macro-silhouette contract holds. `attackStretchImpulse` extracted as a pure exported fn with unit tests; new `qa/v224.cjs` lane proves a hit records recoil without moving `boss.x/y` and that `render()` mutates no simulation state — and that lane was **mutation-tested** to confirm it can fail. Boss rim-light scoped then dropped (competes with the halo read). No combat, timing, difficulty, scoring, save, audio, or weather change |
| v2.25 | 2026-07-26 | Codex + Blender-art, runtime, review, QA, audio-timing, and player-playtest agents | GPT-5 / Codex Desktop | @jonathanwxh-cell | Added a reproducible Blender-assisted 2.5D pipeline, an 84 KiB cached Ashen Reliquary floor, 41 KiB of phase-boundary masks, and a clearer read-only Canvas Malakar; measured and rejected the query-gated Three proof as a production default, preserved the procedural/Canvas fallback, separated native/audio-graph timing, removed the unnecessary vulnerable one-route router, and expanded native-size, asset-failure, WebGL-recovery, side-effect, performance, and full gameplay acceptance |
| v2.26 | 2026-07-26 | Codex | GPT-5 / Codex Desktop | @jonathanwxh-cell | Completed the open combat-audio consequence pass: release-frame charged-heavy weight, three received-damage tiers, one-shot projectile closest passes, non-consuming stamina denial, latched arena-ward contact, and a terminal grade stamp; hardened phase-crossfade endpoint writes against sub-quantum Linux Chromium overlap; retained the 45-cue manifest, startup graph, simulation, difficulty, rendering, and save-v7 contracts; expanded real-browser acceptance; closed #70–#76 only after exact-SHA production verification; and published the durable v2.26 release record |
| v2.27 | 2026-07-27 | Codex | GPT-5 / Codex Desktop | @jonathanwxh-cell | Implemented the stress-tested earned-offense thesis as a contact-gated `ATK · ATK · HVY` Sunder branch, a 100-point run-local Resolve meter, and a full-charge Gracebreak with whiff spending, Execute priority, FORSAKEN protection, bounded Journey recovery, named hybrid audio, compact mobile/semantic HUD feedback, and a dedicated deterministic browser acceptance lane; preserved save-v7, score/path identity, the four-button touch cluster, existing assets, and bounded render/audio architecture |

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
