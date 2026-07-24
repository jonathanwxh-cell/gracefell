# GRACEFELL phase-score provenance

Gracefell v2.18 uses three original instrumental phase cues generated on
2026-07-24 with the MiniMax Music Generation API and finalized by Codex for
gameplay. The user accepted Phase 1 and replacement takes for Phases 2 and 3.
The previous Music 2.6 score was removed from the production bundle.

## Production masters

All three files are 44.1 kHz stereo MP3s at 192 kbps. Loudness values below
come from FFmpeg's `loudnorm` analysis; loop-edge deltas compare the first and
last 250 ms after MP3 encoding.

| Phase | File | 78 BPM form | Duration | LUFS-I | dBTP | LRA | Edge delta | Bytes | SHA-256 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 — Quiet Ash | `gracefell-phase-1-quiet-ash.mp3` | 10 bars | 30.769229 s | -21.26 | -7.03 | 3.30 | 1.19 dB | 739,831 | `7dc474b45b26396d1bc84aab4cfaa6c916735a1a326344b7ae70c61ff9de7474` |
| 2 — The Sovereign Burns | `gracefell-phase-2-sovereign-burns.mp3` | 12 bars | 36.923061 s | -21.27 | -3.31 | 4.60 | 1.64 dB | 887,789 | `be0242728ac6eb7323ab2032570ff2e86fa444fa4f69a9b267553ebb4b40b7ee` |
| 3 — Gracefall | `gracefell-phase-3-gracefall.mp3` | 16 bars | 49.230771 s | -21.26 | -5.88 | 4.80 | 1.33 dB | 1,183,077 | `30be12f46792f0b90571c8a7cfc813dac592921a53407824d4acf2d6f458d130` |

No master contains a sustained silence of 0.8 seconds or longer below -45 dB.
The three masters are matched within 0.01 LU, total 2.81 MB, and retain safe
true-peak headroom before the in-game music and master buses.

## Accepted generations

- Model: `music-3.0`
- Mode: instrumental
- Requested API output: 44.1 kHz, stereo, 256 kbps MP3
- Phase 1 trace: `06b239456fa3b27e9cdbbaba57980656`
- Phase 2 accepted replacement trace:
  `06b23e91d8885c33dc5a53f1012e9deb`
- Phase 3 accepted replacement trace:
  `06b23ff8349fcf776e2d54b2d9d5716e`

### Phase 1 prompt

> Instrumental dark-fantasy boss combat score for Gracefell. Phase 1: Quiet
> Ash / Ash Holds Its Breath. 78 BPM, 4/4, D minor with a Phrygian shadow,
> loop-friendly. An original falling-grace motif D-C-sharp-B-flat-A appears
> incomplete and sparse. Low bowed solo cello, contrabass drone, dry stone
> resonance, one distant cracked bronze bell every eight bars, almost no
> percussion. Lonely, blackened, intimate, controlled dread; broad spaces for
> sword impacts and boss telegraphs. Keep 1.45-3.2 kHz restrained. No vocals,
> choir, brass, taiko, cymbal crashes, trailer rise, heroic melody, busy
> ostinato, rain or wind noise. Stable restrained loudness; no fade-in,
> fade-out, long intro, or ending; seamless-loop character.

### Phase 2 accepted replacement prompt

> Instrumental dark-fantasy chamber battle music. Gracefell Phase 2, The
> Sovereign Burns. 78 BPM in D minor. Begin immediately with low bowed cello
> and contrabass in the same sparse, intimate world as Phase 1, then build
> controlled tension with rough viola, bowed iron and occasional dry frame-drum
> accents. A descending four-note motif D, C-sharp, B-flat, A should recur with
> space between statements. Dark, regal, burned and tragic, not heroic.
> Maintain a steady continuous battle underscore with breathing room for combat
> sounds. Restrained midrange; no vocals, choir, brass, taiko, cymbal crashes,
> trailer climax, synth lead, rain sound, long silence, or fade-out.

### Phase 3 accepted replacement prompt

> Instrumental dark-fantasy chamber boss finale. Gracefell Phase 3, Grace
> Abandons Him. 78 BPM in D minor with restrained Phrygian tension. Use the
> same intimate bowed cello, contrabass and dry stone family as Phase 1, but
> transform the falling motif D, C-sharp, B-flat, A into exposed high viola and
> string harmonics over corrupted rising low strings. Build a steady double-time
> feeling through articulation, not tempo or volume. Tragic, desperate, clear
> and continuous; wider emotion but controlled dynamics. Sparse low frame-drum
> accents and bowed metal only. Leave room for combat cues. No vocals, choir,
> brass, taiko, cymbals, trailer climax, heroic resolution, synth lead, long
> intro, long silence, or fade-out.

## Loop mastering

MiniMax returned composition takes rather than bar-aligned loops. Codex created
the production masters from the accepted matched-loudness previews:

| Phase | Source offset | Kept form | Additional shaping |
| --- | ---: | ---: | --- |
| 1 | 2.175 s | 10 bars | 35 Hz high-pass |
| 2 | 24.275 s | 12 bars | 45 Hz high-pass; -2.5 dB at 110 Hz; -4.5 dB at 2.15 kHz |
| 3 | 17.800 s | 16 bars | 42 Hz high-pass |

Each loop uses a one-second permanent wrap: audio immediately after the chosen
endpoint crossfades linearly into the selected head, then joins the untouched
body. This removes playback-boundary clicks and prevents a fade-out/fade-in
reset. The Phase 2 recut excludes its generated opening dropout. The Phase 3
recut excludes both its quiet introduction and later surge.

The wrapped PCM was normalized in two passes to -21 LUFS-I, -3.5 dBTP and an
8 LU target range, then encoded once to the production MP3. The untracked local
mastering helper records the exact cuts and FFmpeg graph used during this pass.

## Runtime integration

`GameAudio` keeps two permanent streamed media decks. Phase changes wait no
more than 250 ms for a 78 BPM beat, then use a 720 ms equal-power crossfade.
Changing a deck reuses its element and Web Audio nodes, so retries and repeated
fights do not grow the graph. Playback rejection retains the requested phase,
retries twice, and falls back to the procedural score if streaming remains
unavailable.

The route remains:

`MediaElementAudioSourceNode -> deck gain -> soundtrackPresenceDip -> soundtrackFilter -> soundtrackMusic -> music -> master`

The music bus stays at or below 0.24, the soundtrack submix at or below 0.56,
and the broad 1.8 kHz presence dip at -6 dB. Player verbs and all seven boss
windups create stack-safe duck requests; the strongest active request wins.
Separate Music and Combat effects controls are stored locally in save schema
v5. The in-fight MIX panel pauses simulation but deliberately leaves the score
audible, offers a combat-effect test, and closes safely through Done, Escape,
or its input-consuming backdrop.

The API was called only during development. The repository and browser bundle
do not contain the MiniMax API key or temporary download URLs.
