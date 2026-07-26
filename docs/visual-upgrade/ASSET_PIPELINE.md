# Blender asset pipeline

This folder documents the reproducible Blender asset lane for Gracefell's
Canvas-first 2.5D runtime and its query-gated Malakar comparison.

## Rebuild

Requirements:

- Blender 5.2 LTS at `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`
- Node.js and npm
- network access for the pinned `@gltf-transform/cli@4.4.1` invocation

From the repository root:

```powershell
& .\scripts\art\build_assets.ps1
```

The script runs Blender in background factory-startup mode, renders the arena and
phase masks, saves compressed `.blend` sources, exports a raw Malakar GLB,
optimizes the proof with Meshopt without flattening its named hierarchy, and
writes a validation receipt.

## Authored outputs

```text
art/blender/source/ashen-reliquary.blend
art/blender/source/malakar.blend
art/blender/review-renders/malakar-proof.png
art/blender/exports/malakar-raw.glb
art/blender/receipts/generation.json
art/blender/receipts/validation.json
public/art/arena/arena-base.webp
public/art/arena/phase-2-mask.webp
public/art/arena/phase-3-mask.webp
public/art/models/malakar.glb
```

Only `public/art/**` is delivered at runtime. The compact Malakar PNG is the
tracked visual review receipt. Blender still generates lossless arena and phase
PNG masters during a rebuild, but `.gitignore` excludes those reproducible
5.3 MB files; the committed `.blend` sources and generator recreate them. The
raw GLB keeps the optimization stage inspectable.

The source `.blend` files are each below 250 KiB and intentionally use normal
Git in this release. Git LFS is unnecessary at that size. Revisit the policy
before adding source files measured in multiple megabytes.

## Arena contract

- 2048x2048 phase-neutral base.
- 1024x1024 transparent phase masks.
- Central 65% remains free of high-contrast or tall ornament.
- Relief, rubble, blades, buttresses and background arches stay in the outer ring.
- No player, boss, telegraph, weather, HUD, vignette, danger red or camera effect
  is baked into the base.
- Phase 2 adds only amber outer seams.
- Phase 3 adds only pale grace fractures and sparse perimeter emphasis.
- Maximum authored vertical relief is 0.78 Blender metres and the camera is
  near-top-down, so the asset has no foreground gameplay occluder.

## Malakar proof contract

The GLB is deliberately a static, restrained proof rather than a production
animation library.

- Root node: `Malakar_Root`, origin at ground contact.
- Facing convention in Blender: `+Y`.
- Named meshes: `Malakar_Body`, `Malakar_Core`,
  `Halo_Fragment_Prototype`.
- The halo file contains one prototype fragment. Gameplay state remains
  responsible for the nine live instances and their spent/reforge state.
- Two materials maximum: charcoal-bronze body and amber core/fragment.
- No root motion and no animation clips.
- glTF Transform uses Meshopt while preserving the named hierarchy.

The runtime proof must still sample presentation from the authoritative combat
state. Nothing in this asset decides a hitbox, telegraph, attack window, phase,
damage or halo count.

## Runtime integration

- `?visual=arena-bake` copies the authored base into a replacement cached floor
  and swaps it only after a successful draw.
- Phase masks stamp into the existing scorch surface only at an authored phase
  transition; a late mask waits for another run.
- `?boss=blender-canvas` uses the bounded state-driven Canvas treatment.
- `?boss=blender-three` dynamically imports the offscreen Three.js/GLB proof and
  composites it into the existing visible Canvas.
- Decode, upload, GLB, renderer, or WebGL-context failures retain or return to
  Canvas without changing simulation.
- Runtime `/art/` URLs include `VISUAL_ASSET_VERSION`; the production server
  gives only those versioned requests immutable caching. Unversioned art uses
  `no-store, max-age=0` plus `Cloudflare-CDN-Cache-Control: no-store` so the
  zone-wide four-hour browser TTL cannot pin a stale debug or fallback URL.

## Validation

`scripts/art/validate_assets.mjs` rejects:

- a base above 700 KiB;
- combined overlays above 400 KiB;
- wrong image dimensions or missing overlay alpha;
- a Malakar proof above 500 KiB, 5000 triangles or two materials;
- a missing stable node or non-origin root;
- an uncompressed final GLB;
- a generation receipt that admits reserved danger red or less than a 65%
  protected centre.

Exact byte sizes and SHA-256 values are regenerated into
`art/blender/receipts/validation.json`.

## Current limitations

- Automated Chromium acceptance covers live Canvas composition, native mobile
  and desktop viewports, asset failure, delayed delivery, phase stamping,
  telegraph coverage, operation census, and WebGL fallback.
- Physical-phone thermal, upload-hitch, and context-loss measurements remain
  owner/device gates; desktop emulation cannot replace them.
- Malakar's GLB is static and unrigged. Runtime-owned core, swords, halo, and
  body transforms communicate state, but the Three proof remains experimental
  until it beats the Canvas treatment at native size on physical phones.
