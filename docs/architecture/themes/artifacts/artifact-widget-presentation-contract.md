# Artifact Widget Presentation Contract

- Status: Active
- Owner: dashboard tools artifact renderer
- Last validated against code: 2026-07-14
- Path policy: current-only
- Canonical for: artifact widget presentation contract

## 1. Goal

Artifact widgets must receive one canonical presentation object that cleanly separates:

- execution/runtime truth
- presentation phase
- render tier
- local visual intensity

This contract exists so the dashboard artifact pipeline can stay structurally uniform even when one artifact is decorative, another is parameter-driven, and another runs a private simulation loop.

## 2. Non-Negotiable Principles

- Artifact runtime truth originates outside the widget.
- Widget on/off behavior must not be inferred ad hoc from shell copy or local booleans.
- `ArtifactRenderer` forwards only the canonical render context to theme artifact widgets.
- Time-of-day presentation comes from the dashboard-owned ambient presentation; the gallery and widgets do not own a second clock or a manual day/dusk switch.
- Render tier is explicit metadata, not something each widget re-infers from implementation style.
- Simulation widgets must treat pause/resume/settle behavior as part of the canonical contract, not as private timing trivia.

## 3. Canonical Layers

1. Artifact activation state
- Owns the single tools-tab decision for configured, effective, runtime, and preview activation.
- Source: `src/apps/dashboard/tabs/tools/artifactActivationState.js`

2. Artifact shell
- Owns canonical identity, copy-facing runtime summary, and status text only.
- Source: `src/apps/dashboard/tabs/tools/artifactShells.js`

3. Artifact presentation builder
- Maps shell state into widget-facing activity and presentation state.
- Source: `src/themes/core/tools/artifactPresentation.js`

4. Artifact renderer handoff
- Forwards the canonical render context to the theme widget.
- Source: `src/apps/dashboard/tabs/tools/components/ArtifactRenderer.jsx`

5. Dashboard ambient presentation
- Resolves one theme ambient snapshot for the dashboard shell and injects it through `ThemeAmbientPresentationContext`.
- Zen derives this snapshot from the same canonical solar-environment resolver used by the pond/bonsai world; the dashboard hook owns UI refresh cadence only.
- Sources:
  - `src/apps/dashboard/presentation/useDashboardZenAmbientPresentation.js`
  - `src/themes/core/presentation/ThemeAmbientPresentationContext.jsx`
  - `src/themes/plugins/zen/api/environment.js`

6. Artifact render pipeline
- Owns shared stage sizing, shell transforms, visual weight filters, hover chrome, and render context delivery.
- Consumes the common motion budget (`still`, `ambient`, `full`) so widgets do not re-derive animation eligibility from local booleans.
- Normalizes the injected ambient snapshot into the theme-neutral `environment` render channel.
- Sources:
  - `src/themes/core/tools/ArtifactRenderStage.jsx`
  - `src/themes/core/tools/artifactMotionBudget.js`
  - `src/themes/core/tools/artifactRenderContext.js`
  - `src/themes/core/tools/useArtifactRenderChannels.js`

7. Theme widget
- Owns local drawing, motion, and simulation behavior only.

## 4. Canonical Data Contract

```ts
type ArtifactActivationState = {
  version: 1,
  artifactId: string,
  configuredEnabled: boolean,
  effectiveEnabled: boolean,
  controlSuppressed: boolean,
  capabilityAllowsRuntime: boolean,
  capabilityAllowsPreview: boolean,
  runtimeState: "disabled" | "armed" | "engaged" | "cleanup" | "unavailable" | string,
  isRuntimeActive: boolean,
  isPreviewActive: boolean,
}

type ArtifactActivityState = {
  version: 1,
  artifactId: string,
  renderTier: "static" | "motion" | "simulation",
  runtimeState: "disabled" | "armed" | "engaged" | "cleanup" | "unavailable" | string,
  phase: "parked" | "arming" | "active" | "cooling" | "unavailable",
  weight: number, // 0..1 presentation intensity
  isRuntimeActive: boolean,
  isSystemActive: boolean, // compatibility alias for isRuntimeActive
  configuredActive: boolean,
  motionMode: "none" | "ambient" | "full",
  simulationMode: "none" | "halt" | "settle" | "live",
  shouldRenderEffects: boolean,
  isInteractive: boolean,
}

type ArtifactPresentationState = {
  version: 1,
  artifactId: string,
  visualKey: string,
  renderTier: "static" | "motion" | "simulation",
  activity: ArtifactActivityState,
  visualState: object | null,
}

type ArtifactRenderContext = {
  version: 2,
  artifactId: string,
  visualKey: string,
  themeId: string,
  stage: {
    mode: string,
    coordinateSpace: "artifact_gallery_scene",
    bodyModel: "heterogeneous",
  },
  environment: {
    available: boolean,
    themeId: string,
    source: string,
    phase: "dawn" | "day" | "dusk" | "night" | "neutral" | string,
    daylight: number,      // 0..1
    nightDepth: number,    // 0..1
    solarElevation: number,// 0..1
    dawnWeight: number,    // 0..1
    duskWeight: number,    // 0..1
    warmth: number,        // 0..1
    lowSun: number,        // 0..1
    lightVector: { x: number, y: number }, // each -1..1
  },
  material: {
    signatureColor: string,
    visualWeight: number,
  },
  motion: {
    budget: {
      mode: "still" | "ambient" | "full",
      isStill: boolean,
      isAmbient: boolean,
      isFull: boolean,
      shouldAnimate: boolean,
      visualWeight: number,
    },
    runtime: {
      mode: "still" | "ambient" | "full",
      renderBudget: RenderBudget,
      enabled: boolean,
      targetFps: number,
      simHz: number,
      maxCatchUpSteps: number,
      particleScale: number,
      vectorEffectScale: number,
      allowHeavyEffects: boolean,
      allowImpactEffects: boolean,
    },
  },
}
```

## 5. Render Tier Rules

### 5.1 `static`

- No continuous motion is required.
- Widgets may react through material or lighting only.

### 5.2 `motion`

- Widget owns continuous animation but not a persistent simulation world.
- Typical consumers: decorative motion, parameter-driven manifestation, rhythmic loops.

### 5.3 `simulation`

- Widget owns an internal evolving state or physics loop.
- Canonical pause semantics must come from `activity.simulationMode`.

## 6. Phase Semantics

- `parked`
  - visually present or dormant
  - no active behavior expected
- `arming`
  - configured and meaningful, but not currently engaged
  - ambient motion is allowed
- `active`
  - fully engaged behavior
  - full motion or live simulation allowed
- `cooling`
  - effect has passed but residue/settling may continue
  - ambient motion or simulation settle is allowed
- `unavailable`
  - runtime binding missing or unusable
  - widget should not fake a healthy active state

## 6.1 Preview vs Runtime Gate

- Dashboard preview state follows configured user intent.
- Missing protected sites, site-control permissions, or memory permissions must block runtime execution, not the dashboard artifact preview.
- `capabilityAllowsRuntime === false` keeps `isRuntimeActive === false`.
- `capabilityAllowsPreview === true` lets configured artifacts render as active previews while the status panel explains what is needed before runtime execution can apply.

## 7. Migration Rules

- New artifact widgets must consume `artifactRenderContext` directly or through `useArtifactRenderChannels(...)`.
- Theme-local adapters such as `useZenArtifactRenderChannels(...)` may rename shared channels for motif code.
- Widgets use continuous `environment` weights for material and lighting changes. They must not rebuild a binary `sceneMode`, local time toggle, or private solar calculation.
- Zen's canonical Tools canvas requires the dashboard Zen ambient presentation; missing Zen ambient state is a diagnosable contract failure, not an invitation to substitute a hard-coded day palette.
- `ArtifactRenderer` is no longer a compatibility prop seam for canonical Tools Tab widgets.
- Direct fallback props may remain inside widgets only for non-gallery reuse, and must not be required by the Tools Tab render path.
- Do not add new widget-body activation checks, `useVisibilityGate` gates, or local animation budgets for canonical artifact bodies.
- Any new simulation artifact must implement explicit handling for:
  - `simulationMode === "live"`
  - `simulationMode === "settle"`
  - `simulationMode === "halt"`

## 8. Current Canonical Path

- Artifact definitions and render tier metadata:
  - `src/themes/core/tools/artifacts.js`
- Activation state builder:
  - `src/apps/dashboard/tabs/tools/artifactActivationState.js`
- Card schema registry:
  - `src/apps/dashboard/tabs/tools/artifactCardSchemas.jsx`
- Card runtime-derived state:
  - `src/apps/dashboard/tabs/tools/artifactCards/derivedState.js`
- Card visual-state builders:
  - `src/apps/dashboard/tabs/tools/artifactCards/visualStates.js`
- Presentation state builder:
  - `src/themes/core/tools/artifactPresentation.js`
- Artifact assembly:
  - `src/apps/dashboard/tabs/tools/buildToolsArtifacts.jsx`
- Gallery orchestration:
  - `src/apps/dashboard/tabs/tools/components/useArtifactGalleryController.js`
- Dashboard ambient presentation:
  - `src/apps/dashboard/presentation/useDashboardZenAmbientPresentation.js`
  - `src/themes/core/presentation/ThemeAmbientPresentationContext.jsx`
  - `src/themes/plugins/zen/api/environment.js`
- Renderer handoff:
  - `src/apps/dashboard/tabs/tools/components/ArtifactRenderer.jsx`
- Render stage and context:
  - `src/themes/core/tools/ArtifactRenderStage.jsx`
  - `src/themes/core/tools/artifactMotionBudget.js`
  - `src/themes/core/tools/artifactRenderContext.js`
  - `src/themes/core/tools/useArtifactRenderChannels.js`
- Local maintenance guides:
  - `src/apps/dashboard/tabs/tools/ARTIFACTS.md`
  - `src/themes/core/tools/ARTIFACT_RENDER_PIPELINE.md`
  - `src/themes/plugins/zen/widgets/tools/ARTIFACT_WIDGETS.md`

## 9. Acceptance Criteria

- Every canonical artifact definition declares one render tier.
- Dashboard artifact objects include both `artifactActivity` and `artifactPresentation`.
- Renderer forwards only `artifactRenderContext` to widgets without re-deriving runtime truth.
- The selected theme ambient snapshot reaches the render context as continuous `environment` channels; no artifact gallery day/dusk control or `stage.sceneMode` remains.
- Renderer wraps every widget with the shared artifact render stage and render context.
- Renderer exposes one common motion budget; theme adapters may translate it into local motif behavior, but must not create a second activity model.
- Simulation widgets must route loop FPS, simulation Hz, particle counts, and heavy SVG/canvas effects through `motion.runtime`.
- Release artifacts consume one fixed validated `motion.runtime.renderBudget`; artifact widgets do not own adaptive quality tiers.
- Dashboard card assembly must fail loudly when a canonical artifact lacks a card builder; do not reintroduce default empty card schemas.
- New widget work does not introduce a second ad hoc activity model.
- The local guide files above stay present so future agents see the canonical path near the code they edit.

## 10. Why This Exists Before Shishi Refactor

`ShishiOdoshi` is not just a messy widget; it is the first widget that clearly requires a real simulation-tier contract.

If the contract is not established first:

- shishi refactor risks becoming another one-off local architecture
- simulation pause/settle behavior remains bespoke
- future artifacts repeat the same drift

This contract is therefore a prerequisite seam, not optional documentation.
