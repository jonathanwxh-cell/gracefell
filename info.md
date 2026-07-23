# GRACEFELL project facts

- Current package: `gracefell@2.12.0`
- Gameplay release: `v2.12`
- Character release: Kite-Veil Penitent + Fallen Blade-Saint
- Production: <https://gracefell.alyoechosys.dev>
- Repository: <https://github.com/jonathanwxh-cell/gracefell>

GRACEFELL is a mobile-first, single-arena boss game rendered in Canvas 2D. React mounts the
canvas and provides focus-revealed semantic controls; the combat engine lives in
`src/game/engine.ts`, procedural sound and the streamed MiniMax score are managed by
`src/game/audio.ts`, and `server.mjs` serves the production build.

## Runtime and commands

- Node.js 20
- React 19
- TypeScript 5.9
- Vite 7
- Playwright 1.61
- Tailwind CSS 3.4

```bash
npm install
npm run lint
npm run build
npm run qa
```

`npm run qa` is the acceptance gate. It builds the app, starts an isolated server on
`127.0.0.1:8492`, and drives desktop, mobile, and real-touch Chromium paths. See
[`docs/releases/v2.12.md`](docs/releases/v2.12.md) for the current Journey/Oaths, teaching,
death-recovery, visible-combo, save-v4, and production record,
[`docs/releases/v2.11.2.md`](docs/releases/v2.11.2.md) for the rapid-input fix,
[`docs/releases/v2.11.1.md`](docs/releases/v2.11.1.md) for victory-score and result pacing,
[`docs/releases/v2.11.md`](docs/releases/v2.11.md) for character readability, and
[`docs/releases/v2.10.md`](docs/releases/v2.10.md) for the difficulty-integrity record.

## Authoritative documentation

- [`README.md`](README.md) — player-facing overview, controls, balance table, and setup
- [`DESIGN.md`](DESIGN.md) — design decisions and per-version reasoning
- [`AGENTS.md`](AGENTS.md) — operational runbook and invariants future agents must preserve
- [`PROVENANCE.md`](PROVENANCE.md) — contributor ledger and commit-trailer rules
- [`public/audio/README.md`](public/audio/README.md) — generated music provenance
- [`design-qa.md`](design-qa.md) — source-normalized mobile/desktop character comparisons
- [`docs/releases/v2.12.md`](docs/releases/v2.12.md) — v2.12 research, design, QA, deployment, and production evidence
- [`docs/releases/v2.11.2.md`](docs/releases/v2.11.2.md) — v2.11.2 rapid-combo acceptance record
- [`docs/releases/v2.11.1.md`](docs/releases/v2.11.1.md) — v2.11.1 victory score/pacing acceptance record
- [`docs/releases/v2.11.md`](docs/releases/v2.11.md) — v2.11 design, QA, deployment, and playtest record
- [`docs/releases/v2.10.md`](docs/releases/v2.10.md) — v2.10 acceptance and deployment record
