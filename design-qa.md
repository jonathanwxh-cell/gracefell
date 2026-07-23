# Gracefell v2.11 character design QA

## Comparison target

- Attribution boundary: Kimi / OKComputer supplied the original GitHub #10 player
  concept image and brief. The later Kite-Veil state strip was produced during
  the Codex-led design-house pass and is a derived direction, not Kimi's final
  sprite. Production only partially carries the original hooded-penitent idea.
- Source visual truth: `.artifacts/design-house-10/option-2-kite-veil-states.png`
  (`2076x758`). This is the selected seven-state character strip, not a complete
  application viewport.
- Implementation evidence:
  `.artifacts/kite-veil/source-vs-mobile-states.png`,
  `.artifacts/kite-veil/mobile-*.png`, and
  `.artifacts/kite-veil/desktop-*.png`.
- GitHub-safe comparison:
  `docs/releases/assets/v2.11/kite-veil-states.png`.
- Mobile viewport: `390x844` CSS pixels at device scale factor `2`; full captures
  are `780x1688`, and focused player crops are `152x152` (`76x76` CSS pixels).
- Desktop viewport: `1280x800` CSS pixels at device scale factor `1`; focused
  player crops are `104x104`.
- States: move, roll, light attack, heavy charge, flask, stagger, and death,
  rendered in the live fight scene with deterministic positions, no particles,
  no iframes, and the authored camera zoom (`0.55` mobile; approximately `0.889`
  desktop).

The concept strip is an enlarged design reference without a declared pixel
density, so a literal pixel-for-pixel normalization would be misleading. The
comparison instead holds the implementation at its real CSS play scale and uses
focused crops only to judge whether the selected macro-silhouette survives that
reduction.

## Full-view comparison evidence

- `.artifacts/kite-veil/mobile-move.png` proves the parchment facing wedge is
  visible inside the complete `390x844` HUD and does not collide with the boss,
  boss telegraph space, health bar, joystick half, or action cluster.
- `.artifacts/kite-veil/desktop-move.png` proves the same silhouette remains
  proportionate at `1280x800`; the desktop camera does not expose distracting
  micro-detail or an oversized player footprint.
- Browser console/page errors recorded by the capture harness: none on mobile or
  desktop.

## Focused comparison evidence

`.artifacts/kite-veil/source-vs-mobile-states.png` puts the selected source strip
and all seven implementation crops in one image. Focused evidence is required
because the player is intentionally only about 19 CSS pixels across in the full
phone scene.

The implementation preserves the selected visual hierarchy:

1. bright parchment kite = facing;
2. soot-violet veil = handedness and state;
3. sword/ribbon = light and heavy motion;
4. spirit afterimage plus compact spindle = roll;
5. gold diamond plus closed seed = flask;
6. broken hood/veil angle with no sword = stagger;
7. flattened leaf with no sword or gold = death.

## Required fidelity surfaces

- Fonts and typography: not applicable to the player asset. Existing HUD type,
  scale, and copy are unchanged in both full-view captures.
- Spacing and layout rhythm: collision remains `r=15`; the main parchment body
  stays within the selected compact envelope, while the veil remains inside the
  previous cape's visual reach. No HUD or playfield layout moved.
- Colors and visual tokens: the body uses Gracefell's parchment, charcoal,
  soot-violet, background-black, and grace-gold families. No decorative
  `PAL.danger` or `PAL.dangerEdge` is introduced.
- Image quality and asset fidelity: the selected derived raster is a design
  source only, and the Kimi #10 image/brief is an upstream partial reference.
  GitHub issue #10 explicitly requires a zero-bitmap procedural Canvas2D player,
  so the production implementation intentionally reduces painterly costume
  detail to the source's large outer masses. The silhouette, state grammar,
  palette, and sword relationship are preserved; no raster placeholder is
  shipped.
- Copy and content: no player-specific text exists in the source or
  implementation. Existing game copy is unchanged.

## Comparison history

### Iteration 1

- Finding `[P2]`: flask and stagger inherited the neutral resting sword. At
  mobile scale this weakened the selected seed/broken-L silhouettes and made
  both states look too similar to move.
- Fix: the resting sword is now suppressed only during roll, flask, stagger, and
  death. Light and heavy still own the sword and ribbon; neutral keeps the
  resting weapon.

### Iteration 2

- Post-fix evidence:
  `.artifacts/kite-veil/source-vs-mobile-states.png`.
- Flask now reads as a closed parchment seed with one gold diamond.
- Stagger now reads as an unarmed broken hood/veil shape.
- No remaining P0, P1, or P2 fidelity issues were found.

## Follow-up polish

- `[P3]` The source art contains cloth tears and armor modeling that are
  intentionally absent from the phone-scale implementation. Adding those
  details would not survive `0.55` zoom and would work against the selected
  macro-shape strategy.

## Fallen Blade-Saint boss comparison

- Attribution boundary: Kimi / OKComputer supplied the GitHub #14 concept image
  and brief. Codex authored the live Canvas 2D renderer and state logic as a
  partial translation rather than a raster-to-sprite conversion.
- Source visual truth:
  `.artifacts/boss-blade-saint/reference.jpg` (`640x640`) plus the canonical
  procedural requirements in GitHub issue #14.
- Same-image comparison:
  `.artifacts/boss-blade-saint/source-vs-mobile-states.png`.
- GitHub-safe comparison:
  `docs/releases/assets/v2.11/blade-saint-states.png`.
- Full-view evidence:
  `.artifacts/boss-blade-saint/mobile-*.png` and
  `.artifacts/boss-blade-saint/desktop-*.png`.
- Mobile viewport: `390x844` CSS pixels at device scale factor `2`; focused
  boss crops are `300x300` output pixels (`150x150` CSS pixels).
- Desktop viewport: `1280x800` CSS pixels at device scale factor `1`; focused
  boss crops are `230x230`.
- States: phase-one stalk, full volley windup, seven-blade volley depletion,
  five-blade partial reforge, poise stagger, partial phase-three sword draw,
  and the completed dual-sword phase.

The partial production translation preserves the concept's hierarchy at real
play scale: broken blade halo first, split ash cape second, pointed consecrated
armor and failing amber core third. Painterly surface detail and literal
silhouette fidelity are not claimed. The body is elongated along facing and
stays inside the existing collision circle; the cape, coatswords, and halo are
non-collision silhouette and telegraph elements.

### Boss fidelity and gameplay truth

- The default route now uses the Blade-Saint; the earlier `?concept=kimi`
  comparison gate was removed.
- Nine halo blades are visible at rest. Phase-two volley consumes seven,
  leaving two visible; one blade reforges every `0.8 s`. The capture board
  shows full, depleted, and partial-reforge counts.
- Phase two gives every blade an amber tip without using `PAL.danger`.
- Stagger slows the halo to `0.22` orbit speed and adds independent radius
  wobble, making the broken halo sufficient to identify the opening.
- Phase three draws a mirrored shadow coatsword from zero to full length over
  `0.4 s`; the partial and completed captures remain distinct at `0.55` mobile
  camera zoom.
- Boss collision remains `r=34`; health, damage, attack selection, cooldowns,
  windup timing, projectile speeds, and all seven attack behaviors are
  unchanged.
- Browser console/page errors recorded by the capture harness: none on mobile
  or desktop.
- Median synthetic phase-three render submission was approximately `0.36 ms`
  on mobile and `0.28 ms` on desktop, comfortably below the `16.7 ms` frame
  budget.

### Boss comparison history

#### Iteration 1

- The query-only study demonstrated the correct halo/cape direction but kept
  the old default boss, faked volley depletion only during one render state,
  restored all blades instantly, and showed the second sword immediately.

#### Iteration 2

- The Blade-Saint became the default renderer.
- Volley depletion and `0.8 s` reforge cadence became persistent boss state.
- The phase-three shadow sword gained a real `0.4 s` visual draw.
- The armor ellipse and helm were tightened after full-scene review so the
  central body remains inside the unchanged circular hitbox while the
  non-collision cape and weapons retain the intended silhouette.

No remaining P0, P1, or P2 fidelity issues were found.

## Final result

final result: passed
