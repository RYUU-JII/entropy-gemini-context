# Zen Pond Visual QA

Last Updated: 2026-03-06

## Purpose

This document defines the manual pond sweep that complements the automated visual contract tests.

Use it after:

- frame-bundle changes
- Pixi water/render changes
- worker world-sync changes
- koi roster or dummy-fish changes
- tuner/env preset changes

## Fast Gate

Run this first:

`npm run check:zen:pond-visual-contract`

That command covers:

- frame bundle authority
- four-case brightness ordering
- water-layer mapping stability
- ambient frame authority
- worker world-plane fish sync

If that command fails, do not trust manual impressions yet.

## Manual Sweep

Open the Zen pond surface and use the env preset panel.

Primary presets:

- `정오 맑음` (`noon_clear`)
- `정오 흐림` (`noon_cloudy`)
- `야간 맑음` (`night_clear`)
- `야간 흐림` (`night_cloudy`)

Source preset file:

- `src/themes/plugins/zen/pond/tuner/env/envPresetModel.js`

### 1. Brightness Ordering

Expected ordering:

- `정오 맑음` > `정오 흐림` > `야간 맑음` > `야간 흐림`

Visual pass criteria:

- `정오 맑음`: pond surface is clearly readable, highlights are active, bottom reads cleanly
- `정오 흐림`: scene is visibly dimmer than `정오 맑음`, but still daytime
- `야간 맑음`: scene is dark, but moonlit surface and koi silhouettes remain legible
- `야간 흐림`: darkest case, with the weakest yoonseul and lowest perceived contrast

### 2. Day/Night Chroma

Expected:

- both noon presets keep the same warm daylight chroma family
- both night presets keep the same cool moonlit chroma family
- cloudiness changes brightness more than hue

Failure signs:

- cloudy noon shifts to night-like blue
- clear night becomes warm/yellow like noon

### 3. Water Clarity Separation

Use the same time/cloud preset and compare:

- high clarity: `envWaterClarity ~= 0.9`
- low clarity: `envWaterClarity ~= 0.3`

Expected:

- scene brightness should stay almost unchanged
- bottom visibility should drop sharply in the low-clarity case
- caustics and yoonseul energy should weaken with low clarity

Failure signs:

- low clarity makes the whole scene globally darker
- bottom stays equally readable at both clarity levels

### 4. Fish Visibility

Expected:

- an empty roster intentionally renders zero koi; first-vision or real site data must provide roster entries when koi should be visible
- real roster fish render without relying on dummy koi
- pointer hover/select should not delete fish presence

Failure signs:

- pond opens with zero visible koi while the roster contains visible entries
- changing presets removes all koi until reload
- fish only appear after roster changes, not on first mount

### 5. Ambient Population

Expected:

- petals/glimmers respond to frame state, not arbitrary raw env drift
- ambient counts should change when the semantic frame changes
- unrelated layout edits should not thrash ambient populations every frame

Failure signs:

- petals/glimmers flicker or rebuild when the scene is otherwise static
- pad layout changes rebuild everything, including unrelated fish/ambient state

## Failure Triage

If brightness or chroma ordering is wrong:

- `src/themes/plugins/zen/pond/runtime/zenWaterDerivation.js`
- `src/themes/plugins/zen/pond/runtime/core/zenChannelAssembly.js`
- `tests/themes/zenWaterPresetRegression.test.js`

If water highlights or yoonseul feel wrong:

- `src/themes/plugins/zen/pond/renderers/pixi/pixiFrameChannels.js`
- `src/themes/plugins/zen/pond/renderers/pixi/pixiWaterSurfaceUniformResolver.js`
- `src/themes/plugins/zen/pond/renderers/pixi/pixiWaterEffectsFrameStaticResolver.js`
- `tests/themes/zenWaterLayerMapping.test.js`

If petals/glimmers are wrong:

- `src/themes/plugins/zen/pond/runtime/zenAmbientPopulationPlan.js`
- `src/themes/plugins/zen/pond/runtime/zenAmbientEntitySync.js`
- `src/themes/plugins/zen/pond/runtime/zenRockLayoutSync.js`
- `tests/themes/zenAmbientFrameAuthority.test.js`

If koi are missing:

- `src/themes/plugins/zen/pond/renderers/worker/core/zenPondWorkerWorldSync.js`
- `src/themes/plugins/zen/pond/runtime/zenFishRosterEntitySync.js`
- `tests/themes/zenWorkerWorldPlaneSync.test.js`

## Notes

This terminal session can validate the numerical and renderer-contract side automatically, but it cannot directly eyeball the live canvas.

Use this checklist with the automated contract so manual visual review stays aligned with the canonical pond model.
