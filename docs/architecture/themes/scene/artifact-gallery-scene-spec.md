# ArtifactGallery Scene Engine Spec

- Status: Active
- Owner: dashboard tools scene runtime
- Last validated against code: 2026-07-14
- Path policy: current-only
- Canonical for: artifact gallery scene runtime contract

## 1. Goal

Tools Tab용 artifact scene runtime은 다음을 만족해야 한다.

- Keeps artifact and background alignment invariant across aspect ratio changes.
- Eliminates mixed coordinate systems (`%`, `px`, implicit local offsets).
- Makes each theme describe layout declaratively through one canonical scene spec.
- Lets each theme own its stage presentation without forking the core gallery runtime.

## 2. Non-Negotiable Principles

- Single source of truth for scene geometry: `SceneSpec`.
- Single coordinate system for all objects: `Normalized World Space`.
- Single projection entrypoint: `projectWorldToScreen(...)`.
- Single dashboard ambient snapshot for shell, canvas, and artifact material lighting.
- No per-widget private positioning math for shared scene anchors.
- No canvas-local clock or manual day/dusk scene mode.
- Theme-specific stage visuals are injected through the widget registry, not core `themeId` branching.

## 3. Canonical Naming

- The gallery component canonical name is `ArtifactGallery`.
- Legacy gallery naming is removed from source.
- Canonical file: `src/apps/dashboard/tabs/tools/components/ArtifactGallery.jsx`.

## 4. Current Runtime Architecture

### 4.1 Layers

1. Scene Spec Layer (theme data only)
- Defines anchors, camera, ground layout, default artifact placements.

2. Scene Runtime Layer (pure math + mapping)
- Resolves viewport, camera, anchors, world transforms.
- Produces screen transforms for all layers.

3. Render Layer (React components)
- `ArtifactGallery` resolves runtime once and passes it down.
- `ArtifactCanvas` theme slot renders the stage shell.
- `ArtifactRenderer` renders the active artifact widget.
- `ArtifactRenderer` also forwards the canonical widget presentation contract.
- `ArtifactRenderStage` owns the shared artifact stage/shell/context envelope.
- `ThemeAmbientPresentationContext` supplies the dashboard-owned ambient snapshot to the gallery controller; the canvas and renderer receive the same object.
- No geometry derivation outside runtime.

### 4.2 Ownership

- `ArtifactGallery` owns viewport measurement, runtime resolution, selection state, and artifact projection.
- `src/themes/core/toolsVisualPolicy.js` owns visual policy composition, including `sceneSpec` overrides.
- `src/themes/core/registry/index.js` owns theme stage injection via `ArtifactCanvas`.
- `src/apps/dashboard/presentation/useDashboardZenAmbientPresentation.js` owns the Zen dashboard UI clock and resolves through `src/themes/plugins/zen/api/environment.js`.
- `src/themes/core/presentation/ThemeAmbientPresentationContext.jsx` owns theme-neutral delivery; it does not calculate solar state.
- `DefaultArtifactCanvas` is the generic fallback stage.
- Theme canvases such as `ZenArtifactCanvas` may render theme-private ground implementations, but they only consume resolved runtime and ambient presentation props.

## 5. Canonical Data Contract

All contracts are JS objects in production code with strict runtime validation.

```ts
type SceneSpec = {
  version: 1,
  worldUnit: "normalized_min_dim" | "normalized_max_dim" | "px",
  fitMode: "contain" | "cover",
  camera: {
    perspective: number,
    center: { x: number, y: number },
  },
  groundLayout: {
    topOffsetWorld: number,
    concentricMask: { rxPercent: number, ryPercent: number },
    ring: {
      count: number,
      baseRxPercent: number,
      baseRxPx: number | null, // fixed inner radius in CSS px; supersedes baseRxPercent when set (Zen: 40)
      baseRyPercent: number,
      stepScale: number,
      tiltDeg: number,
      grooveShadowStrokeWidth: number,
      grooveHighlightStrokeWidth: number,
      grooveHighlightYOffsetPercent: number,
    },
    focus: { rxPercent: number, ryPercent: number, pulseScaleMax: number },
    debugMarker: { outerRadiusPx: number, innerRadiusPx: number },
  },
  anchors: Record<string, { x: number, y: number, z: number }>,
  artifacts: Record<string, {
    anchorId: string,
    offset: { x: number, y: number, z: number },
  }>,
}
```

## 6. Coordinate System Spec

### 6.1 World Space

- Origin for Zen: `karesansui_center` (concentric ring center).
- Axis definition:
- `+x`: right
- `+y`: deeper into zen plane
- `+z`: upward

### 6.2 Unit

- `1.0` world unit equals `min(viewportWidth, viewportHeight)`.
- Keeps relative placement stable on portrait/landscape.

### 6.3 Screen Space

- Final pixel coordinates generated only via `projectWorldToScreen`.
- Render layer receives:
- `screenX`, `screenY`, `scale`, `depth`, `visible`.

## 7. Projection and Layout Rules

### 7.1 Single Projection Function

`projectWorldToScreen(worldPoint, camera, viewport, fitMode)` is the only allowed projection path.

### 7.2 Aspect Handling

- `contain`: preserve full scene and add letterbox/pillarbox.
- `cover`: fill viewport, allow crop, keep camera constants fixed.
- No viewport-dependent camera angle changes.

### 7.3 Anchor Invariance

- For a fixed scene spec and camera, anchor world relations must not change by viewport ratio.
- Only screen mapping changes.

## 8. Render Composition Spec

### 8.1 ArtifactGallery Responsibilities

- Read theme visual policy from `getToolsVisualPolicy(themeId, visualKey)`.
- Resolve runtime transforms once per relevant dependency change.
- Provide resolved transforms to:
- `ArtifactCanvas`
- artifact renderer
- optional debug overlays

### 8.2 ArtifactCanvas Responsibilities

- Own theme-specific stage visuals and presentation chrome.
- Consume runtime camera/anchor/ground props without recomputing canonical positions.
- Consume the injected ambient presentation continuously for light direction, material warmth, and night depth.
- Delegate artifact rendering back through `renderArtifact()` without inventing a scene-mode argument.
- Do not own a day/night toggle, local timer, or independent solar resolver.

### 8.3 Artifact Responsibilities

- Render local visual animation.
- Consume canonical presentation state from the renderer.
- Consume `artifactRenderContext` for shared stage, material, motion budget, environment, and scene channels as widgets migrate.
- Theme-specific adapters such as `useZenArtifactRenderChannels` may translate the shared context into motif-level names without inventing a new activity model.
- Treat `motion.budget.mode` as the common animation budget: `still`, `ambient`, or `full`.
- Treat `motion.runtime` as the common runtime cost policy for simulation loops, particle counts, and heavy vector/canvas effects.
- Must not apply scene-level positional corrections.

## 9. Current Canonical Path

- Core:
- `src/apps/dashboard/tabs/tools/components/ArtifactGallery.jsx`
- `src/apps/dashboard/tabs/tools/components/sceneRuntime.js`
- `src/apps/dashboard/tabs/tools/components/DefaultArtifactCanvas.jsx`
- `src/themes/core/tools/ArtifactRenderStage.jsx`
- `src/themes/core/tools/artifactMotionBudget.js`
- `src/themes/core/tools/artifactRenderContext.js`
- `src/themes/core/tools/useArtifactRenderChannels.js`
- `src/themes/core/presentation/ThemeAmbientPresentationContext.jsx`
- `src/apps/dashboard/presentation/useDashboardZenAmbientPresentation.js`
- `src/apps/dashboard/tabs/tools/ARTIFACTS.md`
- `src/themes/core/tools/ARTIFACT_RENDER_PIPELINE.md`
- `src/themes/plugins/zen/widgets/tools/ARTIFACT_WIDGETS.md`
- Widget presentation contract:
- `docs/architecture/themes/artifacts/artifact-widget-presentation-contract.md`
- Theme injection:
- `src/themes/core/registry/index.js`
- `src/themes/plugins/zen/widgets/tools/ZenArtifactCanvas.jsx`
- `src/themes/plugins/zen/api/environment.js`
- Policy source:
- `src/themes/core/toolsVisualPolicy.js`

## 10. Legacy Removal Rules (Hard Cut)

- Remove all `%`/`px` scene anchor logic from child components.
- Remove `anchorUnit` switching logic for scene anchors.
- Remove duplicated ground/artifact offset conversion paths.
- Remove fallback path that computes position separately for ground and artifact.
- Remove gallery-local day/dusk state, controls, and `stage.sceneMode` propagation.
- Remove widget-local time/solar calculations; use continuous render-context environment channels.
- Remove any comment or naming referencing legacy gallery identifiers.

No compatibility layer is permitted.

## 11. Remaining Hardening Tasks

- Keep runtime validation warnings in `sceneRuntime.js`.
- Ensure theme canvases stay stage-only and do not reintroduce scene math.
- Add and maintain contract tests for widget registry, artifact definitions, and viewport invariance.

## 12. Acceptance Criteria

### 12.1 Geometry Invariance

- On 16:9, 4:3, 21:9, 9:16:
- Relative vector from `karesansui_center` to each artifact remains constant in world coordinates.
- Concentric center debug marker projects to expected anchor.

### 12.2 Runtime Behavior

- Artifact change re-renders scene tree but does not remount stable background layer.
- No visible anchor drift during resize.

### 12.3 Code Health

- `rg` lookup for the legacy gallery identifier returns no source hits.
- One projection path only.
- No dual coordinate model in render code.

## 13. Risk and Mitigation

- Risk: Theme canvas implementations reintroduce private anchor math.
- Mitigation: Keep canonical anchor projection in `sceneRuntime.js` and treat canvas as a view-only layer.

- Risk: Child components still apply hidden local offsets.
- Mitigation: Require transform props and ban scene-level offsets inside child components.

- Risk: Shell, Karesansui, and artifact materials drift because each starts its own time source.
- Mitigation: Resolve one dashboard ambient snapshot and pass that exact presentation through context to both canvas and renderer.

- Risk: Debug confidence gap.
- Mitigation: Keep anchor debug marker toggle during migration and remove after stabilization if desired.
