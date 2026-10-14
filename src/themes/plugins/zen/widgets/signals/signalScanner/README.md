# Zen SignalScanner

## Canonical Doc

- `ZEN_POND_ARCHITECTURE.md`
- `ZEN_POND_VISUAL_QA.md`

## Runtime Model

- Zen Pond is a worker-owned pond runtime.
- The canonical pipeline is `cause -> derived channels -> authoritative frame bundle -> consumers`.
- The main thread sends commands and owns business state.
- The worker owns simulation state, hit-testing, frame resolution, and rendering.
- `domainCandidates` is the single public koi roster source. The pond projects it into a read-only koi roster frame; callers must not inject a rendered roster snapshot back into the scanner.
- A boot visual memory roster is only allowed when the caller passes the
  explicit pond roster authority source `boot_visual_memory`. Empty
  `domainCandidates` from a current stats snapshot must stay empty instead of
  being repaired from roster memory.

## Module Map

### App and UI

- `src/themes/plugins/zen/pond/app/ZenSignalScannerContainer.jsx`: scanner state bridge canonical home
- `src/themes/plugins/zen/pond/app/ZenSignalScannerSurface.jsx`: runtime orchestration entry canonical home
- `src/themes/plugins/zen/pond/app/ZenKoiTunerPanel.jsx`: tuner orchestration entry canonical home
- `src/themes/plugins/zen/pond/roster/zenKoiRosterFrame.js`: domain-candidate to koi roster frame projection policy
- `ui/ZenSignalScannerView.jsx`: presentational surface

### Control Plane

- `src/themes/plugins/zen/pond/control/zenMainSignalScannerRuntime.js`
- `src/themes/plugins/zen/pond/control/ZenPondWorkerRuntimeClient.js`
- `src/themes/plugins/zen/pond/control/useZenWorkerRendererMount.js`
- `src/themes/plugins/zen/pond/control/runtimeClient/`
- `src/themes/plugins/zen/pond/renderers/worker/core/`

widget-facing entry는 `index.js`와 `app/ZenSignalTunerContainer.jsx`만 유지되고,
scanner container와 pond worker/control/render seam의 canonical implementation home은 이제 `src/themes/plugins/zen/pond/*`이다.

### Cause and Frame Resolution

- `src/themes/plugins/zen/pond/app/hooks/useZenPondEnvironmentAuthority.js`
- `src/themes/plugins/zen/pond/runtime/core/zenCauseModel.js`
- `src/themes/plugins/zen/pond/runtime/core/zenChannelAssembly.js`
- `src/themes/plugins/zen/pond/runtime/core/zenEnvCore.js`
- `src/themes/plugins/zen/pond/runtime/core/zenFrameContract.js`
- `src/themes/plugins/zen/pond/runtime/zenWaterDerivation.js`
- `src/themes/plugins/zen/pond/runtime/zenWaterFrameState.js`

### World and Simulation

- `src/themes/plugins/zen/pond/runtime/zenSignalScannerLoop.js`
- `src/themes/plugins/zen/pond/runtime/kernel/`
- `src/themes/plugins/zen/pond/runtime/systems/`
- `src/themes/plugins/zen/pond/runtime/zenAmbientEntitySync.js`
- `src/themes/plugins/zen/pond/runtime/zenFishRosterEntitySync.js`
- `src/themes/plugins/zen/pond/runtime/zenRockLayoutSync.js`
- `src/themes/plugins/zen/pond/runtime/zenSignalScannerConfig.js`

### Rendering

- `src/themes/plugins/zen/pond/renderers/pixi/`
- `src/themes/plugins/zen/pond/renderers/pixi/scene/`
- `src/themes/plugins/zen/pond/renderers/pixi/waterEffects/`

### Domain Modules

- `src/themes/plugins/zen/pond/model/koi/`: fish model, motion, render pipeline
- `src/themes/plugins/zen/pond/model/koi/appearance/`: appearance resolution modules
- `src/themes/plugins/zen/pond/world/decor/`: pond decor entities

### Tuning and Persistence

- `src/themes/plugins/zen/pond/contracts/`
- `src/themes/plugins/zen/pond/tuner/`
- `src/themes/plugins/zen/pond/state/`
- `src/themes/plugins/zen/pond/storage/`

widget subtree에는 `index.js`, `app/ZenSignalTunerContainer.jsx`,
`ui/ZenSignalScannerView.jsx`, `core/ZenSignalScannerOverlay.jsx`,
그리고 tuner leaf UI subcomponent만 남아 있다.
contracts/decor/infra/koi/runtime/state/storage mirror subtree는 제거되었고,
runtime/render/tuner orchestration, schema/env preset/persistence/state owner는 이제
`src/themes/plugins/zen/pond/*` canonical seam에 있다.

## Archive

Historical notes live under `archive/`.
They are not implementation guidance.

## Visual QA

- Run `npm run check:zen:pond-visual-contract` for the automated pond visual contract.
- Use `ZEN_POND_VISUAL_QA.md` for the manual four-case pond sweep and failure triage.
