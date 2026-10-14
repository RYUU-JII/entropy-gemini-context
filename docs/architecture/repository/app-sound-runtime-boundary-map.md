# App Sound Runtime Boundary Map

- Status: Active
- Owner: sound runtime architecture
- Last validated against code: 2026-10-07
- Path policy: current-only
- Canonical for: Entropy-owned app sound cue/scene routing, theme sound packs, runtime audio asset resolution, and sound-intake handling
- Companion to:
  - `docs/system-architecture/03-theme-plugin-and-zen.md`
  - `docs/architecture/repository/theme-engine-boundary-map.md`
  - `docs/architecture/repository/nudge-main-runtime-boundary-map.md`
  - `docs/architecture/sound/sound-lab-architecture.md`

## Purpose

Entropy sound is an app-owned ritual/audio feedback system. It is separate from
page media control such as audio dulling or Sentinel media suppression.

The contract is:

```text
feature/runtime owner
  -> declared sound cue or scene id
  -> app sound runtime
  -> theme sound pack
  -> platform audio adapter
  -> bundled asset, WebAudio synth, or explicit silent descriptor
```

Feature code must not hard-code `public/assets/sounds/**` paths.

## Canonical Owner Table

| Concern | Canonical owner | Canonical path | Source of truth | Forbidden shortcut |
| --- | --- | --- | --- | --- |
| Sound cue and scene IDs | sound domain catalog | `src/domains/sound/catalog/soundCueIds.js` | declared cue/scene ids and mix bus ids | ad hoc string cue ids in feature code |
| App sound runtime | sound domain runtime | `src/domains/sound/runtime/appSoundRuntime.js` | `playCue`, `enterScene`, `exitScene`, descriptor dispatch, bounded diagnostics | direct `new Audio(...)` or WebAudio scheduling in feature code |
| Sound diagnostics | sound domain diagnostics | `src/domains/sound/runtime/soundDiagnostics.js` | missing cue/scene/asset and descriptor failure reporting | silent missing-sound fallback |
| Browser audio primitives | platform audio | `src/platform/audio/**` | AudioContext helpers and extension URL resolution | feature-owned Chrome URL or AudioContext helpers |
| Theme sound pack lookup | theme core sound seam | `src/themes/core/sound/resolveThemeSoundPack.js` | strict theme sound pack lookup with no cross-theme substitution | importing plugin sound packs from feature code |
| Zen sound mappings | Zen plugin sound pack | `src/themes/plugins/zen/sound/zenSoundPack.js` | Zen cue/scene descriptor mapping and Zen-owned synth/asset choices | putting Zen sound paths inside nudge/protection runtime |
| Runtime sound assets | public bundled assets | `public/assets/sounds/**` | accepted extension-bundled audio files | runtime reads from intake/drop folders |
| Sound intake | non-runtime drop box | `sound-intake/README.md` | temporary files and draft naming instructions | importing from `sound-intake/**` |
| Sound design research and feedback | standalone Sound Lab | `scripts/dev/sound-lab/README.md` | versioned research candidates and immutable local review records | treating candidate preference as product integration or importing the lab into product code |

## Function Ledger

| Boundary function | Input | Output | Failure policy |
| --- | --- | --- | --- |
| `assertSoundCueId` / `assertSoundSceneId` | candidate cue or scene id | declared id | unknown ids throw before runtime dispatch |
| `playAppSoundCue` / `createAppSoundRuntime().playCue` | cue id, theme id, cue context | boolean scheduled result | missing pack/cue/descriptor reports diagnostics and returns false; no substitute cue |
| `enterAppSoundScene` / `exitAppSoundScene` | scene id and theme id | loop/scene lifecycle result | placeholder scenes report explicit silent diagnostics until an accepted asset exists |
| `resolveThemeSoundPack` | canonical theme id | theme-owned sound pack | missing theme sound pack throws; app sound runtime catches and reports bounded sound failure |
| `resolveAudioAssetUrl` | accepted asset path | extension URL or path | empty asset path remains empty and is diagnosed by runtime |
| `playZenFurinGlassClinkSynth` | Sentinel Furin context | WebAudio scheduled glass chime | AudioContext/resume/schedule failures report named audio diagnostics |

## Current Cue Surface

| Cue or scene | Initial owner | Current implementation |
| --- | --- | --- |
| `dashboard.installation.chime` | committed dashboard installation presentation | Six explicit theme-owned finite synth recipes; local sound opt-in, no protection session or daily receipt |
| `ritual.site_furin.prelude_chime` | `SentinelProtocolHost` physical contact or acknowledged Close breeze | Zen WebAudio Furin chime synth, site partials; one explicit closure cue, no Continue reward |
| `ritual.site_furin.submerge_in` | `site_furin` protocol start | Zen WebAudio water-entry transition synth |
| `ritual.site_furin.koi_accept` | `site_furin` accepted koi interaction | Zen WebAudio Furin chime synth, site partials |
| `ritual.site_furin.surface_out` | `site_furin` continue/return transition | Zen WebAudio surface-return transition synth |
| `ritual.site_furin.settle_complete` | `site_furin` reflection/completion | Zen WebAudio completion resonance synth |
| Global rupture / intervention / terminal / failure cues | `nudgeGameAudio.js` global controller, dispatched by `SentinelProtocolHost` | Zen global rift synths |
| `ritual.global_sentinel.repair_telegraph` | global session rhythm snapshot | Stoppable Zen telegraph synth scene; no independent beat clock |
| `ritual.site_furin.soundscape` | site Furin protocol bed/BGM | Zen WebAudio soundscape synth |
| `ritual.site_furin.underwater_loop` | site Furin underwater texture | Zen WebAudio underwater texture synth |
| `zen.shishi_odoshi.water_loop` / `zen.shishi_odoshi.overflow_loop` | Shishi-odoshi gate pour/hold/overflow | Zen WebAudio flowing-water synths |
| `zen.shishi_odoshi.clack` | Shishi-odoshi gate impact | Zen WebAudio bamboo/stone impact synth |

The pack also maps the site koi hydro sequence, Room 478 breathing phases, and
global sentinel rift sequence. `soundCueIds.js` and the sound pack own the exact
inventory. All current Zen mappings have explicit Sound Lab review targets;
the catalog coverage test prevents a declared product sound from disappearing
from the review inventory. A mapping still does not establish that a feature
event fired, that a research candidate is equivalent, or that a build shipped.

## Sound Intake Rule

The dashboard installation is silent until the user enables its local sound
control. No dashboard sound preference currently exists, so the presentation
does not invent or persist one. `createAppSoundRuntime().prepareAudio()` resumes
the shared platform AudioContext during that opt-in gesture; the same runtime
dispatches the installation cue at the first response shot. Browser refusal
remains an explicit sound diagnostic and never blocks protection or completion.
Each recipe schedules finite cancellable voices through
`src/platform/audio/synth/installationChimeSynth.js`. Hide, mute, dismissal and
unmount stop those voices. Replay has the same sound opt-in and no business
side effects.

All six canonical themes now declare sound packs. The five non-Zen packs
currently declare the installation cue only; they do not substitute for Zen's
existing protection sounds. Unmapped cues continue to report
`sound_cue_missing`. The installation cue's Sound Lab review target is separate
from the real Site/Global Furin cue IDs, and scanner lookup uses the canonical
sound-pack seam. The sound lookup validates canonical IDs directly and requires
that ID's explicit sound pack; it does not load full plugin manifests or widget
registries. The theme seam-role guard protects all six registrations and this
sound-only dependency boundary.

`sound-intake/**` is a human/collaboration drop box only. Files there are not
runtime assets and must not be imported. Accepted files move to
`public/assets/sounds/<theme>/<family>/...`, then the owning theme sound pack is
updated in the same change.

Draft naming should use lowercase kebab-case with motif, action, loop/one-shot
intent, and take number when useful, for example:

- `furin-koi-accept-soft-01.wav`
- `site-furin-soundscape-dusk-loop-01.ogg`
- `shishi-odoshi-clack-bamboo-01.wav`
- `shishi-odoshi-water-stream-loop-01.ogg`

## Recovery Versus Fallback

| Class | Allowed? | Rule |
| --- | --- | --- |
| Missing cue id | No | Unknown cue ids throw at the catalog boundary |
| Missing cue mapping in a pack | No substitute | Runtime reports `sound_cue_missing` and returns false |
| Placeholder sound | Bounded | Explicit `silent` descriptors may stand in for planned assets and must report `sound_cue_silent` or `sound_scene_silent` |
| Cross-theme sound substitution | No | A missing theme sound pack or cue does not borrow another theme's sound |
| Asset path missing | No substitute | Runtime reports `sound_asset_path_missing` |
| User gesture / AudioContext blocked | Bounded | Sound failure is diagnostic and does not block the ritual |
| Page media control | Separate owner | Use Sentinel media suppression or audio-dulling owners; app sound runtime does not control page media |

## Verification Targets

Use focused checks when this boundary changes:

- `npm run test:file -- tests/appSoundRuntime.test.js tests/zenShishiOdoshiSoundPack.test.js tests/nudgeGameAudio.test.js tests/nudgePresageSignal.test.js`
- `git diff --check`

### Stoppable synth scenes (September 8, 2026)

The sound runtime passes a fresh `stopRef` object to synth scene descriptors.
A synth with sustained nodes assigns `stopRef.stop`; the runtime stores that
callback only after successful playback and invokes it on `exitScene` or
`stopAll`. Finite one-shot synth scenes need not provide a stop callback.
Global repair telegraph owns a 9ms fade time constant and bounded 40ms oscillator stop;
acceptance, active-window entry, terminal transition and host teardown release
that scene. Tests cover dispatch, cancellation and repeat-entry lifecycle.

### Global cinematic cue ownership (September 9, 2026)

`createGlobalSentinelAudioController` passes the protocol-owned
`GLOBAL_SENTINEL_ENTRY_STAGES` table to the rupture cue. The Zen synth schedules
the initial Furin resonance, the disconnected spy's paired diagnostic clicks,
panel failure, and the returning sentinel's slow pressure tones on one WebAudio
clock. It leaves the white-field false calm and post-repair hush silent. The
same brief diagnostic pair recurs on the first final-act approach; retries do
not replay it. Telegraph duration comes directly from the session snapshot's
`rhythmPhaseRemainingMs`, and its act comes from `rhythmActIndex`.

All global one-shot synth descriptors also accept the existing `stopRef`
context seam. The host audio controller owns those references and cancels
current and future voices on reset, restart, or terminal replacement. Synths
fade toward zero with a 9ms time constant, stop voices within 40ms, and
disconnect nodes on their `ended` event. Natural completion marks the reference
ended so the controller can release it. There are no independent JavaScript
cue timers. Standalone Sound Lab rupture audition plays the contact alone when
no cinematic stage table is supplied; production always supplies the canonical
table, and malformed tables produce a named scheduling diagnostic.

This soundtrack does not filter arbitrary website audio. Sentinel's existing
media-suppression owner still controls page media; tab-wide DSP requires the
separate, development-only Suikinkutsu capture protocol. Browser gesture or
AudioContext suspension can prevent audibility and remains a diagnosed platform
limitation, not an instruction to take over tab audio or add a second audio
clock.

Validation includes `tests/globalSentinelAudioController.test.js` and
`tests/nudgeGameAudio.test.js`: delayed-voice cancellation, canonical cue timing,
silent calm, terminal decay, and one-time final-act identity recall.
