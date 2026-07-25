# GRACEFELL combat-SFX library provenance

Gracefell v2.22 adds a recorded-timbre combat SFX library: fifty cues generated
on 2026-07-25 with the Moonshot `agent-gw` sound-effects API and initially
mastered locally by Kimi. Codex performed the final asset audit and a
conservative four-cue mobile-clarity pass on 2026-07-25. Recorded cues are
supporting material for the existing Web Audio voices, not permission to
remove the procedural fallback.

Every cue was prompted as dry, close-miked combat foley ("no reverb, no
music") so the engine's arena convolution, spatial pan/distance, ducking, and
voice budget can place the samples consistently.

## Shipping status

- Runtime-eligible masters: all files except the five held-back alternates
  `dodge-2`, `near-miss-2`, `player-step-1`, `swing-2`, and `swing-3`.
- Held-back files remain unchanged for provenance and later A/B work. They must
  not enter randomized runtime rotation.
- `execute-1`, `boss-step-1`, `boss-step-2`, `tele-meteor`, `tele-slam`,
  `meteor-1`, `meteor-2`, `slam-1`, `slam-2`, and `death-sting` are
  intentionally low-frequency support layers. Measurements found 89-100% of
  their energy below 250 Hz. EQ could not create missing midrange honestly, so
  runtime must pair them with a restrained procedural presence transient for
  phone and mono-speaker clarity.
- Codex remastered only `charge-loop`, `ring-release`, `swing-1`, and
  `swing-heavy-2`. Blanket re-encoding was rejected because the source is
  already lossy; per-cue runtime gain and the shared limiter own final headroom.

## Production masters

All files decode successfully as 44.1 kHz mono MP3. The four Codex remasters
use LAME `-q:a 2`; the remaining Kimi masters use `-q:a 4`. Loudness is
FFmpeg 8.1.1 `loudnorm` EBU R128 integrated loudness measured once from the
final shipped bytes; dBTP is its measured input true peak. Duration is decoded
stream duration, excluding MP3 encoder padding.

| Cue | Decoded duration (s) | LUFS-I | dBTP | Bytes | SHA-256 |
| --- | ---: | ---: | ---: | ---: | --- |
| `blade-draw.mp3` | 0.800 | -15.9 | -4.3 | 9,145 | `b1a72b1cc99cef3f84b0d1b46681cf30a65a3b38dfa274469ce6dd3bb25bccca` |
| `boss-step-1.mp3` | 0.480 | -17.4 | -1.5 | 4,705 | `9c2850905566978a196b37265c76ca4103abe869156777619a1c66576bdf752d` |
| `boss-step-2.mp3` | 0.480 | -17.6 | -1.5 | 5,596 | `8cf8eaa380a248489b5c6526432e22d730dee30d073f9202b35864444e6fd333` |
| `charge-loop.mp3` | 1.080 | -16.8 | -4.7 | 11,860 | `d9f0a1787e1cadf751ebc05ca84193a8fb7c5bdc66f50b2bee4587f5785563f4` |
| `charge-scrape-1.mp3` | 0.600 | -15.8 | -2.0 | 6,691 | `5eeb6e38f7782ea4b3d4e1d7f9bd26f090e33e1565be80b40857ea748a381eca` |
| `charge-scrape-2.mp3` | 0.600 | -16.0 | -3.8 | 6,877 | `40944b334541870fa7f68405a548abafbc13f994356136063b0ed3ab823f422f` |
| `death-sting.mp3` | 2.480 | -16.2 | -1.5 | 20,479 | `98991c537c6dfa813dd0d11e7d87c38586823efc3ae80dd38ed187faa92818de` |
| `dodge-1.mp3` | 0.480 | -18.3 | -1.5 | 5,649 | `4a191e41fcbe228f4a954b0f7c8bc70a2f78e56d1fde7547fcaac963d4aa6e0c` |
| `dodge-2.mp3` | 0.480 | -21.9 | -1.1 | 5,440 | `fc74ed4e7bbeac32b67d13cbd73737bdc69cc943e81b373b469b50cdf38b2d5a` |
| `execute-1.mp3` | 1.200 | -17.8 | -1.5 | 10,300 | `d7036e9248ab136179bba58d41dd07791b5ebc6e9da94c581fbb9352e578d240` |
| `flask-1.mp3` | 1.000 | -19.4 | -1.4 | 11,079 | `276e9d74ee5152d1fdbdc594dc80bfa4345ab5b120674a3244a5b220bdc4906b` |
| `flask-empty.mp3` | 0.480 | -17.1 | -1.4 | 4,758 | `16567c1237acc09185f08d1282978ee9f9ccfe2e5cc4602f8e061b4178e342b2` |
| `hit-heavy-1.mp3` | 0.800 | -16.8 | -0.1 | 7,758 | `7219bd98aa5e4f5ccb4d78c1d3c650b15985e6fb74879bd04cf05a5386b09059` |
| `hit-heavy-2.mp3` | 0.800 | -15.9 | -2.9 | 6,763 | `05475c9ed198d695bb1b861530d3bf838b3300b6c549d0db851c88742ae53fcf` |
| `hit-light-1.mp3` | 0.480 | -17.1 | -0.6 | 5,048 | `2814a70c8f75eb0adba938dff111fe9aa3b047cc4a14bc31837a5ace9e2c0555` |
| `hit-light-2.mp3` | 0.480 | -19.1 | -1.2 | 5,701 | `415303e75247c36f1e39fd881c3af1c68c8a130b762cef559f0c9ce332a025c3` |
| `hit-light-3.mp3` | 0.480 | -19.1 | -1.3 | 5,912 | `0100156ab7f99aac34ce6b02aa7def6b84f10b9308b8317978fc4b7036e0ef9c` |
| `hurt-heavy-1.mp3` | 0.680 | -15.9 | -2.6 | 7,526 | `4749eeff19e78ef5aed34d00a876b1c24eb2298d36df8ed0bd179628d4920ef5` |
| `hurt-light-1.mp3` | 0.480 | -16.1 | -2.2 | 5,491 | `af82b4b1e407bc3396b104c1edf06f925c8a211a3fa68b78926dacee123dc508` |
| `meteor-1.mp3` | 1.200 | -17.8 | -1.2 | 11,957 | `0f84259caf9e3fde763f0f90b536f2094c0c6e05f8963129eab0dd0d33d5b997` |
| `meteor-2.mp3` | 1.200 | -17.4 | -0.9 | 11,827 | `3a8ceb89232b974167e6b28f1ea4f17a5c9a819a4f5041819a8e1f66689a9a20` |
| `meteor-warning.mp3` | 1.000 | -15.9 | -7.8 | 9,377 | `03d067ebb72c575cdd037dd60ebb01486737a390e1808e3b4869234fa132f112` |
| `near-miss-1.mp3` | 0.480 | -17.3 | -1.5 | 5,911 | `d29dc8d8f0de9e5e86a63c33145571fd6f33acfd9bf755ab39aad34d3896577f` |
| `near-miss-2.mp3` | 0.480 | -20.1 | -1.3 | 5,227 | `0e2f7a955fae1f26ac2d57e5a9bb3dfac6a2c717b7ac63a821075aa1109bab27` |
| `parry-spark.mp3` | 0.600 | -15.9 | -1.4 | 7,081 | `be7c87117dcc203e269491071f86b3dfaeb4ea5d656fe09c9b7d0450b65b9373` |
| `player-step-1.mp3` | 0.480 | -17.9 | -1.2 | 5,597 | `713292ee76757ca23342e766397d85e20e9741ea788e03ceaeed5e0abdfcfe9e` |
| `player-step-2.mp3` | 0.480 | -23.9 | -1.5 | 5,754 | `7e5dcd26f4eef4f1e9e0600ef01026196b2eefe1c6d2c4d1f21660d52072b48f` |
| `projectile-1.mp3` | 0.480 | -18.3 | -1.5 | 5,464 | `1f399fe318a0ca34f3fcb96499ac733092c55cecf6cd08f8d20b26700262cf04` |
| `projectile-2.mp3` | 0.480 | -17.9 | -1.2 | 5,333 | `f393c39357a98bc4e7260c10f1be7339bece8f45268afb035914219ab5171461` |
| `ring-release.mp3` | 1.000 | -19.8 | -3.8 | 9,708 | `0606a60b8b540dcc700ac82d36d24a240f7c6d76dcfd9d3097b36b7ed4504453` |
| `roar-big.mp3` | 2.480 | -16.0 | -5.8 | 23,572 | `996445a3e2546bf74b2cae08ed601be49417af2d097611ac5b82b3d544a9c225` |
| `roar-small.mp3` | 1.480 | -16.0 | -5.1 | 14,488 | `fd02d8157d604718f026a818c55755d2495131407906ad7459c9ff290b3b23c3` |
| `slam-1.mp3` | 1.000 | -17.2 | -1.4 | 9,866 | `1995f7735d661758bbe823c24ff313848e156e4233e4745bb2d31b922150907f` |
| `slam-2.mp3` | 1.000 | -19.1 | -1.2 | 9,756 | `f48b0fab1fa8e2d54281534f67106b30a9d85fcaafeb86724f82f618d0f46fc3` |
| `stagger.mp3` | 0.800 | -17.3 | -0.7 | 7,915 | `f3ffce32836528364b3e84206fa253d1a50712d2db38496a217a487fa41eb61c` |
| `stamp.mp3` | 0.480 | -18.9 | -1.3 | 5,756 | `274dc77c694ce3f7b5996b0f6df8919099b01b934a75e37c5ff36ca1adc3471e` |
| `swing-1.mp3` | 0.480 | -20.6 | -3.9 | 5,467 | `c049cd876ad5641da115e6c09a49534f868d9188e6bd9cbc35fa15b43ad7fa2f` |
| `swing-2.mp3` | 0.480 | -17.8 | -1.0 | 5,099 | `1822542b5c22d3fd9068ed51242d3d1487ffe578ee70ae56ddfc17fcf0c8f4e3` |
| `swing-3.mp3` | 0.480 | -20.1 | -0.9 | 5,783 | `4d769c160a4598816a004493471e099bfa9a7c75c7ebf27f4c7bbba832078480` |
| `swing-heavy-1.mp3` | 0.680 | -16.8 | -1.1 | 6,504 | `c772ef6b2ae24830c4b91d07dee1b642476112b65f2ffbdd6c43d6cbcda49ce1` |
| `swing-heavy-2.mp3` | 0.680 | -17.9 | -3.8 | 6,350 | `cd81242fa9612aa4cbbd7df4f24c887809ed0ed9d555cf5f4e4b867e6c739234` |
| `tele-charge.mp3` | 0.680 | -16.5 | -1.5 | 7,317 | `d88f345be47879f0158d557c144c842d32bba11adb2869cbc8046d04a6db0544` |
| `tele-meteor.mp3` | 0.800 | -16.0 | -2.1 | 6,994 | `0eeac30755bfb87da6a9cb6c3bf64d4f555da6a974228e7d340fe3d088422f5d` |
| `tele-ring.mp3` | 0.800 | -15.9 | -2.3 | 7,020 | `fefd89fd84587f41c3155a8012a21b7b93470b655c15db9130413a15c66ed3cc` |
| `tele-slam.mp3` | 0.680 | -16.0 | -1.5 | 6,450 | `81c029b7cec36314d5ebc15d288d35fb297a69331a4ccde2096a6a1764c20b87` |
| `tele-spiral.mp3` | 0.800 | -15.8 | -2.9 | 8,520 | `73cac88d491882d6dc959b176502fa6eafe5822933b77cf400eadaed9a0b1303` |
| `tele-swipe.mp3` | 0.600 | -15.9 | -6.8 | 6,772 | `dbfd2297eb10f468c2a1301bfdbdbcb147f37988e882242e478309feb118c9c5` |
| `tele-volley.mp3` | 0.600 | -16.2 | -1.3 | 6,826 | `12553a8b87dff29a70f0dcbc18ad31e84d6107e319e1cf111984dbb677cfdc57` |
| `ui.mp3` | 0.480 | -18.1 | -1.3 | 5,703 | `7114bc5e431dafad7db5af29494588ef53b6063ebc695ee3f887fe8eecc83876` |
| `ward-chime.mp3` | 0.600 | -16.0 | -1.4 | 7,452 | `fba701f8097d3dcf895ae92bd9662990548998a9e6ae7177d335e66325814fb8` |

Total library size: 393,624 bytes (approximately 384.4 KiB) across 50 files.

## Final mastering chain

The 46 accepted Kimi masters remain byte-for-byte identical to the supplied
library. The four Codex masters add one deliberate lossy generation from those
MP3 sources; this was accepted only where the measured mobile-clarity and
headroom improvement was material.

- `swing-1`: 60 Hz two-pole high-pass; +2 dB at 1 kHz, Q 0.9; limiter ceiling
  0.63, 1 ms attack, 20 ms release; LAME `-q:a 2`.
- `ring-release`: 40 Hz two-pole high-pass; -1.5 dB low shelf at 130 Hz;
  +1.5 dB at 900 Hz, Q 0.9; the same safety limiter; LAME `-q:a 2`.
- `swing-heavy-2`: 40 Hz two-pole high-pass; -1.5 dB low shelf at 140 Hz;
  +1.5 dB at 850 Hz, Q 0.9; the same safety limiter; LAME `-q:a 2`.
- `charge-loop`: circular steady-state filtering using three concatenated
  copies, then the middle copy only; 35 Hz two-pole high-pass, -2 dB low shelf
  at 120 Hz, and +1.5 dB at 700 Hz. A final 882-sample (20 ms) tail/head
  crossfade keeps the loop boundary continuous. Decoded duration changed from
  1.100 s to 1.080 s. LAME `-q:a 2`.

No noise reduction, stereo widening, exciter, synthesized harmonics, dynamic
`loudnorm`, or reverb was applied.

## Objective A/B gate

| Cue | Source dBTP | Final dBTP | Source <120 Hz | Final <120 Hz | Source 1-5 kHz | Final 1-5 kHz |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `charge-loop` | -2.5 | -4.7 | 50.8% | 36.7% | 0.0% | 0.0% |
| `ring-release` | -1.0 | -3.8 | 76.0% | 31.1% | 3.5% | 9.6% |
| `swing-1` | -1.3 | -3.9 | 79.5% | 6.6% | 2.1% | 9.4% |
| `swing-heavy-2` | -1.6 | -3.8 | 45.0% | 36.6% | 1.5% | 2.3% |

For `charge-loop`, decoded sample-boundary discontinuity improved from
0.004839 to 0.003427 after the circular crossfade. This check guards against a
click that the first simple-EQ attempt introduced and was rejected.

## Runtime contract

- Load only the approved runtime manifest, in small priority batches; do not
  fetch and decode all fifty cues simultaneously.
- Keep procedural synthesis as fallback for missing/late/failed samples and as
  the presence layer for the LF-only support cues listed above.
- Version asset URLs because production caching is immutable.
- Apply per-cue gain before the shared limiter. A source master above -3 dBTP
  is not authorization to run it at unity gain.
- Stop sustained cues on release, interruption, death, victory, return to title,
  reset, and audio destruction.

The API was called only during development. This directory contains no API
key, temporary download URL, or generation credential.

## Generation prompts

All prompts were submitted in English. Shared suffix discipline ("cinematic
dark fantasy combat foley, dry recording, no reverb, no music") kept the
takes mix-ready for the engine's own spatial layer.
- **swing-1**

  > Fast light sword swing whoosh, sharp air cutting swish, cinematic dark fantasy combat foley, dry recording, no reverb, no music
- **swing-2**

  > Quick agile sword slash whoosh, thin blade cutting air, swift swish, cinematic combat foley, dry, no reverb
- **swing-3**

  > Short snappy sword swing, crisp air slice, light melee weapon swish, dry studio foley, no reverb
- **swing-heavy-1**

  > Heavy two-handed greatsword swing, deep powerful whoosh, weighty blade cutting air, cinematic dark fantasy, dry, no reverb
- **swing-heavy-2**

  > Massive slow blade swing, low heavy whoosh with weight, giant sword sweeping air, dry foley, no reverb
- **hit-light-1**

  > Sword striking metal armor, sharp punchy clang with brief metallic ring, close combat hit, dry, no reverb
- **hit-light-2**

  > Quick steel impact on plate armor, crisp metallic crack, melee hit foley, dry, no reverb
- **hit-light-3**

  > Sharp blade hit on armor, bright metallic snap clang, punchy and short, dry, no reverb
- **hit-heavy-1**

  > Massive sword impact on heavy armor, deep metallic clang with ringing resonance, powerful cinematic blow, dry, no reverb
- **hit-heavy-2**

  > Devastating heavy strike on steel plate, low crushing clang, weighty metal impact, dry, no reverb
- **execute-1**

  > Devastating execution strike, deep cinematic impact boom with shattering metal armor and dramatic low whoosh, epic finishing blow, dry, no reverb
- **dodge-1**

  > Quick cloth and light armor rustle whoosh, fast dodge roll movement, subtle agile foley, dry, no reverb
- **dodge-2**

  > Swift fabric swoosh with soft leather movement, combat dodge roll, dry foley, no reverb
- **hurt-light-1**

  > Short pained male grunt with light body impact thud, warrior taking a hit, restrained, dry, no reverb
- **hurt-heavy-1**

  > Heavy pained male grunt with deep body impact, warrior struck hard, cinematic, dry, no reverb
- **flask-1**

  > Drinking from glass bottle, liquid gulps with gentle glass clink, fantasy potion foley, dry, no reverb
- **flask-empty**

  > Empty glass bottle clink and rattle, short dry foley
- **charge-loop**

  > Rising deep tension energy hum, resonant power charging up, ominous sustained buildup, steady and even, dry, no reverb
- **blade-draw**

  > Sword drawn from scabbard, bright metallic shing, steel sliding on leather, cinematic, dry, no reverb
- **roar-small**

  > Deep menacing creature growl, armored demon king, guttural roar with metallic edge, dark fantasy boss, dry, no reverb
- **roar-big**

  > Massive enraged demon king roar, deep guttural bellow with metallic distortion, terrifying dark fantasy boss, powerful, dry, no reverb
- **slam-1**

  > Huge ground slam impact, deep earth-shaking boom with stone debris, giant weapon smashing floor, cinematic, dry, no reverb
- **slam-2**

  > Massive crushing slam on stone, deep boom with rumble and rock debris, dry, no reverb
- **meteor-warning**

  > Falling meteor whistle, descending high-pitched incoming projectile whistle, ominous, dry, no reverb
- **meteor-1**

  > Meteor impact explosion on stone, deep boom with fire burst and rock debris, cinematic, dry, no reverb
- **meteor-2**

  > Fiery meteor crash landing, explosive impact with flame whoosh and rubble, dry, no reverb
- **ring-release**

  > Massive shockwave ring blast, deep air-pressure whoosh explosion, dry, no reverb
- **projectile-1**

  > Fire ember projectile launch, quick magical fire bolt whoosh, dark fantasy, dry, no reverb
- **projectile-2**

  > Burning bolt shot, fast flame projectile release whoosh, dry, no reverb
- **boss-step-1**

  > Heavy armored footstep on stone, deep metallic boot thud, giant knight walking, dry, no reverb
- **boss-step-2**

  > Massive steel boot stomp on rock, heavy armored thud with plate rattle, dry, no reverb
- **charge-scrape-1**

  > Metal blade scraping across stone floor, harsh grinding scrape, dry, no reverb
- **charge-scrape-2**

  > Steel dragging on rock, rough metallic grind, dry, no reverb
- **stagger**

  > Heavy armor collapsing clatter, giant knight dropping to one knee, metallic crash, dry, no reverb
- **parry-spark**

  > Bright metallic parry ping, sword deflected with ringing spark, crisp, dry, no reverb
- **tele-swipe**

  > Rising blade whistle, sword wind-up whoosh building tension, warning cue, dry, no reverb
- **tele-slam**

  > Deep war drum boom with rising rumble, ominous warning cue, dry, no reverb
- **tele-charge**

  > Beast snort with rumbling buildup, charging bull warning cue, dry, no reverb
- **tele-volley**

  > Fire igniting burst whoosh, flame projectiles charging up, warning cue, dry, no reverb
- **tele-meteor**

  > Ominous falling sky rumble, descending doom drone warning, dry, no reverb
- **tele-ring**

  > Deep ominous bell toll, dark chapel bell warning cue, dry, no reverb
- **tele-spiral**

  > Spinning blade whir, rotating metal whirlwind, warning cue, dry, no reverb
- **player-step-1**

  > Light armored footstep on stone, quick boot tap, subtle foley, dry, no reverb
- **player-step-2**

  > Quick leather boot step on rock, soft tap, dry, no reverb
- **ward-chime**

  > Soft magical barrier chime, gentle golden bell resonance, dry, no reverb
- **near-miss-1**

  > Fast projectile flying past, quick doppler whoosh flyby, dry, no reverb
- **near-miss-2**

  > Swift object passing close by ear, airy flyby whoosh, dry, no reverb
- **stamp**

  > Heavy wax seal stamp press, deep thud with paper press texture, dry, no reverb
- **death-sting**

  > Dark low ominous death swell, deep somber drone impact, dramatic game over stinger, no melody, dry, no reverb
- **ui**

  > Soft parchment page tap, subtle menu tick, dry, no reverb
