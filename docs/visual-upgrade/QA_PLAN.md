# Gracefell v2.25 Visual-Depth QA Plan

Status: standalone acceptance lane implemented and wired into `qa/run.cjs`
Owner: independent QA/performance lane
Command: `node qa/visual-upgrade.cjs`

## Purpose

The visual-depth proof must demonstrate that the Blender-authored arena is a
replacement for the existing cached floor, not an additional render surface or
an excuse to weaken combat clarity.

`qa/visual-upgrade.cjs` remains directly runnable for focused visual work and is
also called by `qa/run.cjs`. Missing assets, version tokens, diagnostics, or
fallback transitions are explicit readiness failures.

## Required runtime contract

### Query

The accepted production default, including a query-free navigation, is:

```text
?visual=arena-bake&boss=blender-canvas
```

- `visual=arena-bake` selects the Blender-authored cached-floor replacement.
- `boss=blender-canvas` selects the accepted Canvas Malakar treatment.
- The explicit v2.24 comparison baseline is
  `?visual=procedural&boss=current`.
- `?boss=blender-three` remains an opt-in proof and is never selected by
  omission.
- Neither query value is persisted to the save payload.

### Asset

```text
/art/arena/arena-base.webp
/art/models/malakar.glb
```

Required limits:

- HTTP 200;
- `image/webp` or `image/avif`;
- exactly `2048 x 2048`;
- at most `700 KiB`;
- decodes before combat without an uncaught page or console error.

The Malakar GLB must be `model/gltf-binary` and at most `500 KiB`.

Optional phase masks are inspected if present:

```text
/art/arena/phase-2-mask.webp
/art/arena/phase-3-mask.webp
```

Each mask is at most `1024 x 1024`; their combined transfer is at most `400
KiB`. A missing optional mask is not a failure.

Every runtime art URL must carry `?v=v225-2` and return:

```text
Cache-Control: public, max-age=31536000, immutable
```

The lane verifies both direct asset receipts and URLs disclosed by arena/Three
diagnostics. It also requests one unversioned art URL and requires `no-cache`
without `immutable`, so a debug URL cannot pin stale art for a year.

### Diagnostics

The current stable hook is:

```js
window.__game.visualDebugState()
```

It returns JSON-safe data shaped like:

```js
{
  requested: {
    arena: 'arena-bake',
    boss: 'blender-canvas'
  },
  arena: {
    applied: true,
    pending: false,
    stampedPhases: [],
    overlayErrors: { 2: null, 3: null },
    assets: {
      enabled: true,
      base: {
        state: 'ready',       // 'fallback' after load/decode failure
        url: '/art/arena/arena-base.webp',
        width: 2048,
        height: 2048,
        error: null
      },
      phase2: { /* same asset receipt shape */ },
      phase3: { /* same asset receipt shape */ }
    }
  },
  boss: {
    active: 'blender-canvas',
    three: null
  }
}
```

The lane normalises this contract and several obvious aliases. For the arena
candidate, it only treats `arena-bake` as active when the requested mode is
`arena-bake`, the base asset is `ready`, and `arena.applied` is true. For the
failure lane, `base.state: 'fallback'` is normalised to the procedural active
treatment. A missing hook, requested mode, active mode, or arena state is a
hard failure. Diagnostics must report the active treatment; the query string
alone is not evidence that the baked asset rendered.

For the Three proof, `boss.three.renderer` additionally reports `state`,
`modelState`, versioned `modelUrl`, render count, triangles, draw calls,
geometry/texture counts, and the bounded renderer-canvas dimensions. Permanent
GLB failure reports `released: true` with `renderer: null`; recoverable context
loss retains the renderer so restoration can reactivate it.

## Automated lanes

### First-gesture deferral

Every browser page performs a real interaction on the game Canvas before it
waits for arena or boss assets: a mouse pointer click on desktop and a
touchscreen tap in true-touch contexts. The receipt must prove that:

- audio was uninitialised before the interaction and initialised by it;
- `visualProofsPrepared` is still false immediately after the handler;
- the 120 ms visual-preparation timer is pending;
- neither arena assets nor the Three proof have been allocated in the
  synchronous audio-unlock window.

The established interaction lane in `qa/verify.cjs` owns the strict desktop
and touch audio-initialisation timing budgets. This visual lane deliberately
does not duplicate that timing assertion; it owns the ordering and allocation
boundary, then waits for the deferred assets before collecting visual
evidence.

### 1. Asset receipt

The harness fetches the arena images and GLB in Chromium, records the actual
byte counts, MIME types, image dimensions, version tokens, response URLs, and
cache headers, then applies the specification budgets. This catches incorrect
server paths, HTML fallbacks served as art, stale unversioned URLs, oversized
exports, and corrupt WebP output.

### 2. Native viewport captures

The candidate is captured at:

- `390 x 844`, true-touch context, DPR 2;
- `1280 x 800`, desktop context, DPR 1.

For each viewport the lane records:

- quiet-weather ring windup;
- severe-weather ring windup;
- the same deterministic camera, player, boss, health, and telegraph state.

Artifacts use names such as:

```text
mobile-accepted-ring-quiet.png
mobile-accepted-ring-severe.png
desktop-accepted-ring-quiet.png
desktop-accepted-ring-severe.png
```

Explicit procedural/current baseline captures and procedural-arena controls
using the accepted Canvas boss are generated alongside the candidate.

### 3. HUD and telegraph protection

The lane:

- samples 48 points around the authoritative ring boundary;
- requires at least 90% of that boundary to differ visibly from the same scene
  without a telegraph;
- repeats under Quiet Ash and Gracefall Storm;
- measures Canvas ink in the player-resource and boss-bar regions;
- verifies MENU, MIX, PAUSE, and SOUND stay inside the viewport, remain at
  least `44 x 44`, and do not overlap `playerHudRect()`;
- verifies touch action discs do not overlap the boss HUD.

This is a focused signal check, not a replacement for human native-size review.
The screenshots still require inspection at 100% scale.

### 4. Deterministic render cost

Per `AGENTS.md` and `qa/perf.cjs`, CI does not assert single-frame timings.
Canvas submits work asynchronously, and historical timings drift too much to
support a sub-millisecond release gate.

Instead, the lane runs the same pinned Phase-3 stress scene on:

1. `visual=procedural&boss=blender-canvas`;
2. `visual=arena-bake&boss=blender-canvas`.

It counts Canvas operations twice per page and fails if the count is not
deterministic. Holding the boss renderer constant isolates the baked floor.
Because the asset replaces `floorCanvas`, candidate deltas are:

| Metric | Maximum increase |
| --- | ---: |
| `drawImage` | 0 |
| radial gradients | 0 |
| linear gradients | 0 |
| non-zero `shadowBlur` assignments | 0 |
| total draw calls | 4 |

Existing absolute tripwires remain:

| Metric | Cap |
| --- | ---: |
| radial gradients | 52 |
| non-zero `shadowBlur` assignments | 12 |
| total draw calls | 1100 |

The lane also inventories Canvas surfaces reachable from `Game`. The candidate
must not increase DOM canvas count or total permanent Canvas pixels.

The accepted v2.24 receipt at `.artifacts/v224-perf-baseline.json` is included in
the report when available:

- mobile: `drawImage=2`, `drawCalls=908`, reported median `4.62 ms`;
- desktop: `drawImage=2`, `drawCalls=889`, reported median `3.92 ms`.

Those timings are context only. Physical phones own the actual frame-time
decision.

### 5. Decode-failure fallback

A separate true-touch page intercepts the arena request and returns invalid
image bytes over a successful HTTP transport. The runtime must:

- report `requestedVisual=arena-bake`;
- report procedural/classic as the active treatment;
- report the arena state as fallback/failed;
- preserve a non-empty procedural floor;
- preserve at least 90% ring-boundary coverage;
- avoid uncaught page and console errors;
- avoid adding a Canvas surface.

This proves a real decode fallback rather than a network redirect or a query
flag that was ignored.

### 6. Malakar five-state comparison

At both native viewports, the lane captures the explicit current, accepted
Canvas, and opt-in Three treatments in the specification's five pinned states:

1. phase-one guard;
2. swipe release;
3. ring-cast anticipation;
4. stagger;
5. phase-three dual-sword reveal.

Each receipt includes the exact combat state, repeated pixel signature, Canvas
operation census, renderer diagnostics, and screenshot. Repeated renders must
be deterministic and must not mutate authoritative boss/player state, health,
timers, hazards, encounter arrays, input/confirm buffers, the exact
`localStorage.gracefell` payload, or stable audio mode/mute/volume/phase fields.
The warm core must remain detectable and the five states must produce five
distinct signatures.

The Three proof additionally requires:

- authored GLB state `asset-ready`;
- `256 x 256` renderer surface;
- at most `5000` reported triangles;
- at most `45` reported WebGL draw calls;
- finite geometry and texture diagnostics;
- no console or page errors.

### 7. Malakar failure and recovery

The corrupt-GLB lane returns invalid GLB bytes over HTTP 200. The engine must
activate `blender-canvas-fallback`, release the permanently failed Three
renderer/context, retain a readable core, and disclose `released: true`.

The context lane uses the real `WEBGL_lose_context` extension. Loss must retain
the recoverable renderer but activate the Canvas fallback; restoration must
return to `asset-ready` Three rendering without reloading gameplay state.

### 8. Delayed and failed arena uploads

A delayed-load lane holds the base and both masks while an unpaused fight
starts. It verifies:

- the live floor and stamp set do not change;
- a late base becomes `pending` instead of applying mid-fight;
- late masks do not stamp from load callbacks;
- reset atomically applies the queued base;
- the ready Phase-2 mask stamps only at the next authored transition.

Two isolated `drawImage` failure lanes then simulate upload/memory failures:

- base failure must keep the existing procedural floor and report fallback;
- phase failure must not escape the render loop, must remain unstamped, and
  must populate `overlayErrors`.

## Current comparison decision

The 2026-07-26 automated packet is technically green for all three boss
treatments. The live Three proof is bounded (`404–456` triangles and `12–16`
draw calls in the five states), restores after real context loss, and releases
after permanent GLB failure.

It is not the production winner. Native-size screenshot review shows the
authored Three body reading too dark and fragmented against the arena,
especially in ring anticipation and the phase-three dual-sword state. The
Canvas proof retains substantially clearer shoulders, helm, blade pose, core,
and halo relationships. This is why the accepted default remains
`blender-canvas`; `blender-three` stays an explicit engineering/art proof.

## Manual gates not replaced by this lane

- Inspect every capture at 100% CSS size, greyscale, and silhouette-only.
- Confirm arena ornament remains subordinate to the player, boss, and safe
  route.
- Confirm no ruin edge resembles a touch control or reserved danger edge.
- Run five novice and five experienced-player action-recognition sessions.
- Run the complete existing `npm run qa` gate.
- Complete the physical-device matrix from
  `BLENDER_2_5D_VISUAL_SPEC.md`: recent iPhone, older iPhone, and mid-range
  Android, ten minutes of Phase-3 stress, with p50/p95/p99, thermal trend,
  input latency, first-action hitch, and context-loss receipts.

## Release instructions

1. Keep `qa/visual-upgrade.cjs` after `qa/perf.cjs` in `qa/run.cjs`.
2. Set `GRACEFELL_VISUAL_QA_DIR` for a named release receipt when the default
   `%TEMP%/gracefell-qa/visual-upgrade/` directory is not appropriate.
3. Run:

   ```powershell
   npm run lint
   npm test
   npm run build
   node qa/visual-upgrade.cjs
   npm run qa
   ```

4. Inspect the arena/weather captures, all thirty five-state comparison
   captures, and the mobile fallback/lifecycle captures.
5. Do not weaken missing-diagnostic, fallback, telegraph, surface, or operation
   checks merely to make the first candidate green.
