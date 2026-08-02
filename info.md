# GRACEFELL project facts

- Current package: `gracefell@2.27.6`
- Current release: [`v2.27.6`](https://github.com/jonathanwxh-cell/gracefell/releases/tag/v2.27.6), Sunder/Execute king reactions
- Release receipt: [`docs/releases/v2.27.6.md`](docs/releases/v2.27.6.md)
- Previous release: [`v2.27.5`](https://github.com/jonathanwxh-cell/gracefell/releases/tag/v2.27.5)
- v2.27.6 reviewed head: `c0d206254518b7d0afb5474fa9f36af161167a4b`
- v2.27.6 implementation PR: [#110](https://github.com/jonathanwxh-cell/gracefell/pull/110)
- v2.27.6 PR CI: [run 30454794423](https://github.com/jonathanwxh-cell/gracefell/actions/runs/30454794423), passed
- v2.27.6 runtime merge: `a693a4a92adfd20b7732d2f05b63ac27adc89980`
- v2.27.6 runtime-main CI: [run 30455115531](https://github.com/jonathanwxh-cell/gracefell/actions/runs/30455115531), passed
- v2.27.6 production bundle: `assets/index-C9hWQYkd.js`
- v2.27.6 bundle SHA-256: `3245E3C69DCE63E43A8330C32F7BAC1365BE2F9324770BF784305B1F2192513B`
- v2.27.5 reviewed head: `62aa91848ef6e794d5e9b849b8dab48bf07e3b10`
- v2.27.5 implementation PR: [#108](https://github.com/jonathanwxh-cell/gracefell/pull/108)
- v2.27.5 PR CI: [run 30446253514](https://github.com/jonathanwxh-cell/gracefell/actions/runs/30446253514), passed
- v2.27.5 runtime merge: `fca01e8c324aa227e8bb63f217aba5788f79b53e`
- v2.27.5 runtime-main CI: [run 30446537473](https://github.com/jonathanwxh-cell/gracefell/actions/runs/30446537473), passed
- v2.27.5 production bundle: `assets/index-C6-AvkyV.js`
- v2.27.4 reviewed head: `8302a12957bc369b604332070811eff1eebc013f`
- v2.27.4 implementation PR: [#106](https://github.com/jonathanwxh-cell/gracefell/pull/106)
- v2.27.4 PR CI: [run 30436996211](https://github.com/jonathanwxh-cell/gracefell/actions/runs/30436996211), passed
- v2.27.4 runtime merge: `c954d3eb6f3b52239a7dce13dc6051752474eecf`
- v2.27.4 runtime-main CI: [run 30437329942](https://github.com/jonathanwxh-cell/gracefell/actions/runs/30437329942), passed
- Gameplay foundation merge: `88b71eef8ad4cafb3bac06a62f8aa3721ff33aed` (v2.27)
- Combo runtime merge: `ad9b7d31c228a9ea3a1ccab566a858e5da4587ba`
- Audio acceptance-hardening merge: `c89e43d53a0b480c5dbf37e585519d9ed6a2e280`
- Accepted gameplay merge: `32501728ac5436463ad6ebb3ef539c81ac43f16d`
- Final acceptance merge: `abae223b24f2d3600f25f1c72b15446a6ea9956b`
- Final runtime-main CI: [run 30317910728](https://github.com/jonathanwxh-cell/gracefell/actions/runs/30317910728), passed
- Final acceptance-main CI: [run 30318778678](https://github.com/jonathanwxh-cell/gracefell/actions/runs/30318778678), passed
- Production-receipt merge: `b1cca605d325122830ac01737f32a097165b1ed9`
- Receipt-main CI: [run 30316920447](https://github.com/jonathanwxh-cell/gracefell/actions/runs/30316920447), passed
- Production bundle: `assets/index-C9hWQYkd.js`
- Visual release: Blender-authored cached arena + Canvas-first Malakar
- Character foundation: Kite-Veil Penitent + Fallen Blade-Saint
- Production: <https://gracefell.alyoechosys.dev>
- Repository: <https://github.com/jonathanwxh-cell/gracefell>

GRACEFELL is a mobile-first, single-arena boss game with an authoritative Canvas
simulation and one visible Canvas. React mounts the canvas and provides
focus-revealed semantic controls; `src/game/engine.ts` owns combat and
presentation; `src/game/render/` owns the v2.25 cached-arena and boss treatments;
`src/game/audio.ts` manages bounded recorded SFX, procedural fallback, and three
streamed MiniMax phase cues; and `server.mjs` serves the production build.

## Runtime and commands

- Node.js 20
- React 19
- TypeScript 5.9
- Vite 7
- Playwright 1.61
- Tailwind CSS 3.4

```bash
npm ci
npm run lint
npm run build
npm run qa
```

`npm run qa` is the acceptance gate. It builds the app, starts an isolated server on a
free `127.0.0.1` port (set `GRACEFELL_QA_PORT` to pin one), and drives desktop, mobile, and real-touch Chromium paths. See
[`docs/releases/v2.27.2.md`](docs/releases/v2.27.2.md) for Execute/Sunder
priority, recovery input, truthful combo feedback, pause recipes, and release
evidence,
[`docs/releases/v2.27.1.md`](docs/releases/v2.27.1.md) for the short-phone
camera/tutorial lanes, combined Oath-chain/IRONBOUND plate, and stronger
Sunder/Break presentation,
[`docs/releases/v2.27.md`](docs/releases/v2.27.md) for Sunder route ownership,
Resolve gains, Gracebreak spending/priority, HUD/audio integration, and release
evidence,
[`docs/releases/v2.26.md`](docs/releases/v2.26.md) for charged-heavy,
hurt-tier, closest-pass, denial, ward, and grade-seal audio ownership,
[`docs/releases/v2.25.md`](docs/releases/v2.25.md) for Blender source assets,
Canvas-first runtime integration, fallback behavior, visual QA, and release
evidence,
[`docs/releases/v2.22.md`](docs/releases/v2.22.md) for recorded-foley integration, priority loading,
sustained-cue lifecycle, asset mastering, and release evidence,
[`docs/releases/v2.20.md`](docs/releases/v2.20.md) for the current fixed-pool phase-weather
implementation and production acceptance record,
[`docs/releases/v2.21.md`](docs/releases/v2.21.md) for roll slash, flank reward, terminal mastery
feedback, Ascension, victory sharing, mirrored touch controls, and save-v7 acceptance,
[`docs/releases/v2.19.md`](docs/releases/v2.19.md) for the current battle-menu, score-history,
semantic combat, save-v6, and production acceptance record,
[`docs/releases/v2.18.md`](docs/releases/v2.18.md) for the adaptive-score, live MIX,
save-v5, and resilient-streaming record,
[`docs/releases/v2.13.md`](docs/releases/v2.13.md) for the original pause/resume and input-ownership
record, [`docs/releases/v2.12.1.md`](docs/releases/v2.12.1.md) for the
previous balance and HUD record, [`docs/releases/v2.12.md`](docs/releases/v2.12.md) for the
original Journey/Oaths, teaching, death-recovery, visible-combo, and save-v4 design,
[`docs/releases/v2.11.2.md`](docs/releases/v2.11.2.md) for the rapid-input fix,
[`docs/releases/v2.11.1.md`](docs/releases/v2.11.1.md) for victory-score and result pacing,
[`docs/releases/v2.11.md`](docs/releases/v2.11.md) for character readability, and
[`docs/releases/v2.10.md`](docs/releases/v2.10.md) for the difficulty-integrity record.

## Authoritative documentation

- [`docs/releases/v2.27.2.md`](docs/releases/v2.27.2.md) — v2.27.2 combo truth, recovery input, acceptance, and production evidence
- [`docs/releases/v2.27.3.md`](docs/releases/v2.27.3.md) — v2.27.3 touch BREAK activation, real-touch QA, and release evidence
- [`README.md`](README.md) — player-facing overview, controls, balance table, and setup
- [`DESIGN.md`](DESIGN.md) — design decisions and per-version reasoning
- [`AGENTS.md`](AGENTS.md) — operational runbook and invariants future agents must preserve
- [`PROVENANCE.md`](PROVENANCE.md) — contributor ledger and commit-trailer rules
- [`public/audio/README.md`](public/audio/README.md) — generated music provenance
- [`public/audio/sfx/README.md`](public/audio/sfx/README.md) — combat-SFX prompts, mastering truth, measurements, exclusions, and hashes
- [`design-qa.md`](design-qa.md) — source-normalized mobile/desktop character comparisons
- [`docs/visual-upgrade/BLENDER_2_5D_VISUAL_SPEC.md`](docs/visual-upgrade/BLENDER_2_5D_VISUAL_SPEC.md) — v2.25 art direction, budgets, renderer decision, and acceptance contract
- [`docs/visual-upgrade/ASSET_PIPELINE.md`](docs/visual-upgrade/ASSET_PIPELINE.md) — reproducible Blender generation, optimisation, cache, and fallback instructions
- [`docs/releases/v2.27.1.md`](docs/releases/v2.27.1.md) — v2.27.1 live-review HUD/camera fixes and release evidence
- [`docs/releases/v2.27.md`](docs/releases/v2.27.md) — v2.27 Sunder, Resolve, Gracebreak, acceptance, and deployment evidence
- [`docs/releases/v2.26.md`](docs/releases/v2.26.md) — v2.26 combat-audio consequence contracts and release evidence
- [`docs/releases/v2.25.md`](docs/releases/v2.25.md) — v2.25 implementation, QA, and deployment record
- [`docs/releases/v2.20.md`](docs/releases/v2.20.md) — v2.20 fixed-pool Ash Gale weather and production acceptance
- [`docs/releases/v2.21.md`](docs/releases/v2.21.md) — v2.21 combat mastery, terminal actions, sharing, handedness, and save-v7 acceptance
- [`docs/releases/v2.22.md`](docs/releases/v2.22.md) — v2.22 recorded combat foley, loader/lifecycle acceptance, and production evidence
- [`docs/releases/v2.19.md`](docs/releases/v2.19.md) — v2.19 battle menu, score chronicle, combat clarity, audio-state race fix, and production acceptance
- [`docs/releases/v2.18.md`](docs/releases/v2.18.md) — v2.18 phase score, MIX controls, save v5, and local acceptance
- [`docs/releases/v2.17.1.md`](docs/releases/v2.17.1.md) — v2.17.1 unit-test and engine-typing quality pass
- [`docs/releases/v2.17.md`](docs/releases/v2.17.md) — v2.17 self-hosted fonts, icons, manifest, and metadata
- [`docs/releases/v2.16.1.md`](docs/releases/v2.16.1.md) — v2.16.1 hygiene B: pruned the unreachable shadcn tree + 43 prod deps
- [`docs/releases/v2.16.md`](docs/releases/v2.16.md) — v2.16 hygiene A: server headers + immutable audio, kimi-plugin removal, npm ci, LICENSE
- [`docs/releases/v2.15.md`](docs/releases/v2.15.md) — v2.15 offense: hold-to-charge heavy, phase-3 musical lift
- [`docs/releases/v2.14.md`](docs/releases/v2.14.md) — v2.14 feel & spectacle: dynamic camera, stagger execution, arena deterioration
- [`docs/releases/v2.13.md`](docs/releases/v2.13.md) — v2.13 pause/resume design, QA, and production evidence
- [`docs/releases/v2.12.1.md`](docs/releases/v2.12.1.md) — v2.12.1 input, balance, visual-polish, QA, and production evidence
- [`docs/releases/v2.12.md`](docs/releases/v2.12.md) — v2.12 research, design, QA, deployment, and production evidence
- [`docs/releases/v2.11.2.md`](docs/releases/v2.11.2.md) — v2.11.2 rapid-combo acceptance record
- [`docs/releases/v2.11.1.md`](docs/releases/v2.11.1.md) — v2.11.1 victory score/pacing acceptance record
- [`docs/releases/v2.11.md`](docs/releases/v2.11.md) — v2.11 design, QA, deployment, and playtest record
- [`docs/releases/v2.10.md`](docs/releases/v2.10.md) — v2.10 acceptance and deployment record
