# Artifact Scene And Runtime Core Spec

- Status: Active
- Owner: dashboard tools artifact renderer
- Last validated against code: 2026-05-07
- Path policy: current-only
- Canonical for: artifact scene/runtime core skeleton

## 1. Goal

Artifact implementations must converge on one durable substrate that separates:

- presentation truth
- scene authoring
- runtime behavior
- render output

The target is not one giant identical implementation style for every artifact. The target is one engine skeleton with explicit behavior tiers.

## 2. Canonical Layers

1. Presentation layer
- canonical activity and presentation state
- source: `src/themes/core/tools/artifactPresentation.js`

2. Scene layer
- scene graph nodes
- svg id scoping
- stage/viewBox ownership
- sources:
  - `src/themes/core/artifacts/scene/sceneGraph.js`
  - `src/themes/core/artifacts/scene/ArtifactSvgStage.jsx`
  - `src/themes/core/artifacts/scene/useArtifactSvgIdScope.js`

3. Runtime layer
- simulation mode resolution
- shared render-loop entrypoint
- sources:
  - `src/themes/core/artifacts/runtime/simulationRuntime.js`
  - `src/themes/core/artifacts/runtime/runArtifactSimulationLoop.js`

4. Render pipeline layer
- shared artifact stage and render context
- keeps heterogeneous artifact bodies inside one lifecycle, material, motion budget, and shell contract
- sources:
  - `src/themes/core/tools/ArtifactRenderStage.jsx`
  - `src/themes/core/tools/artifactMotionBudget.js`
  - `src/themes/core/tools/artifactRenderContext.js`
  - `src/themes/core/tools/useArtifactRenderChannels.js`

5. Recipe layer
- artifact-specific geometry and behavior authoring
- examples:
  - `ShishiOdoshi.jsx`
  - `Furin.jsx`

## 3. Non-Negotiable Rules

- Widgets must not invent a second hidden activity model.
- SVG defs must be scope-safe and instance-safe.
- Scene geometry should move toward derived geometry, not hand-placed layer piles.
- Simulation artifacts must treat `live / settle / halt` as canonical runtime semantics.
- Renderer and runtime are shared seams; artifacts should only customize recipes.

## 4. Behavior Tiers

### 4.1 Motion tier

- no persistent simulation world
- continuous visual motion allowed
- reacts to `activity.weight`, `motionMode`, and the shared `motion.budget.mode`

### 4.2 Simulation tier

- owns evolving state
- canonical simulation modes:
  - `live`
  - `settle`
  - `halt`
- `halt` means parked/rest pose, not “keep old rAF running invisibly”

## 5. Current Migration Baseline

- `ShishiOdoshi` and `Furin` now consume canonical simulation runtime helpers.
- `ArtifactRenderer` now delegates shared stage/shell behavior to `ArtifactRenderStage` and delivers one `artifactRenderContext` to all artifact bodies.
- Artifact bodies consume the shared render context through `src/themes/core/tools/useArtifactRenderChannels.js` or a theme-local adapter such as `src/themes/plugins/zen/widgets/tools/useZenArtifactRenderChannels.js` while preserving heterogeneous geometry and simulation internals.
- Motion eligibility now flows through the shared `motion.budget.mode` channel: `still` disables continuous motion, `ambient` permits low-cost idle/settle loops, and `full` permits active/live motion.
- Runtime cost now flows through `motion.runtime`. Release default is fixed full quality: `qualityMode === "full"` keeps 60Hz/60fps, full particles, and heavy effects for any running activity mode.
- `motion.runtime.enabled` still follows the activity budget, so `still` prevents continuous runtime loops even though the quality policy remains full.
- Adaptive/runtime quality reduction is intentionally not active until a future graphics-quality setting owns that policy.
- In development, simulation loops can be inspected through the local `window.__ENTROPY_ARTIFACT_RUNTIME_METRICS__` bridge. This is diagnostic-only and is not a storage or telemetry source of truth.
- Folder-local guides in `src/apps/dashboard/tabs/tools/ARTIFACTS.md`, `src/themes/core/tools/ARTIFACT_RENDER_PIPELINE.md`, and `src/themes/plugins/zen/widgets/tools/ARTIFACT_WIDGETS.md` are part of the active maintenance surface.
- New work must extend the shared core instead of adding fresh widget-local loop semantics.
- Geometry migration remains in progress; the current baseline mainly hardens runtime ownership and SVG identity safety.

## 6. Desired End State

- All artifact widgets share one scene substrate.
- Simulation widgets share one runtime substrate.
- Artifact recipes describe geometry and behavior, not low-level lifecycle plumbing.
- Dashboard and gate surfaces reuse the same native artifact scene without CSS-scale hacks as the primary sizing model.
- `ArtifactRenderer` remains a context-only handoff instead of a compatibility prop dispatcher.

## 7. Next Migration Target

The next canonical milestone is:

1. move `ShishiOdoshi` geometry into a derived scene recipe
2. eliminate hardcoded split-mouth/separate-backfront seam logic where possible
3. reuse the same simulation substrate for `Furin` and future simulation artifacts
