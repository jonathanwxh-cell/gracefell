# The Forged Reliquary — v2.28 art credits

Kite-Veil and Malakar meshes: original Codex / GPT-6 Blender work, directed by
@jonathanwxh-cell, extending Gracefell's selected character identities.
These are articulated original models, not purchased/scanned character assets.

Arena geometry and Cycles lighting: original Codex / GPT-6 Blender work.
Stone surface: **Rock Boulder Dry**, Poly Haven, CC0.
Photography: Dimitrios Savva. Processing: Rico Cilliers.

- Source: https://polyhaven.com/a/rock_boulder_dry
- License: https://polyhaven.com/license
- Rebuild: `scripts/art/build_reliquary.ps1`
- Hashes and budgets: `art/blender/reliquary/validation.json`
- Source files: `art/blender/reliquary/*.blend`

Models use Meshopt compression. Node pivots and all combat animation ownership
are documented in `docs/releases/v2.28.md`. Character geometry is rendered live;
the 2048px arena is a baked image. Recorded music/SFX retain their own existing
credits and were not changed by this graphics pass.

## v2.29 local articulation extension

Codex / GPT-5 extended the original rigs with Pelvis, Knee_L/R and Foot_L/R
pivots and rebuilt both character GLBs. Mesh authorship remains credited above.
The arena and audio are unchanged. `src/game/render/reliquaryMotion.ts` owns
presentation-only procedural/keyed joint motion; these are not mocap clips or
skinned human scans. The candidate's cache key is `v229-1`.
