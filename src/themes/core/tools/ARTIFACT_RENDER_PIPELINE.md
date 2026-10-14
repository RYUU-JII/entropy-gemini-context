# Artifact Render Pipeline

This folder owns the common render envelope for Tools Tab artifacts.

## Canonical Pieces

- `artifacts.js`
  - artifact identity, visual keys, widget types, and render tiers.
- `artifactPresentation.js`
  - transforms dashboard activity into widget-facing render state.
- `artifactMotionBudget.js`
  - resolves `still`, `ambient`, and `full` motion budget modes.
  - owns one validated fixed render budget for release artifacts.
- `artifactRenderContext.js`
  - builds the single render context passed to artifact widgets.
- `../toolsVisualPolicy.js`
  - owns declarative theme/family stage effects, including whether the common
    wrapper preserves the body's scale, opacity and color across activity states.
- `useArtifactRenderChannels.js`
  - reads inherited/provided render context and exposes widget-friendly material,
    activity, motion, visual-state, and runtime channels.
- `../artifacts/scene/artifactSvgCoordinateSystem.js`
  - owns SVG viewBox origin generation, filter coordinate units, and reusable
    filter regions for artifact widgets.
- `ArtifactRenderStage.jsx`
  - owns shared stage sizing, shell transform, readiness, hover chrome, and
    context provider delivery.
- `useArtifactPresentationCommit.js`
  - owns the complete requested/candidate/committed frame and its layout-phase
    renderer submission; placement and stage FX have no separate commit owners.
- `artifactStageGeometry.js`
  - owns the logical stage size without importing a React component.
- `artifactGalleryRenderer.js`
  - resolves the same declared gallery/standalone widget for navigation,
    selected-controller admission and rendering.
- `artifactGalleryPreparation.js`
  - prepares declared gallery client code from tab intent/admitted boot work,
    and the requested SVG compiler from selection intent/admission.
  - module preparation allocates no renderer, scene, textures or animation loop;
    dashboard lifetime is separate, through `runtime/dashboardRenderRuntime.js`.
    Zen's Worker scene engine retains sole ownership of GPU resources.

## Runtime Policy

- `motion.budget.mode` is the activity budget.
- `motion.runtime.renderBudget` is the fixed release render budget.
- Adaptive quality is intentionally not active for artifact widgets.
- `still` disables continuous loops without changing the fixed render budget.
- Zen declares `rendererFx.preserveBodyAppearance` once in its theme policy.
  `ArtifactRenderStage` consumes that flag to preserve whole-body scale, opacity
  and color and omit wrapper glow across ON/OFF and partial activity. Entry
  reveal, local 3D classification and motion admission keep their existing
  contracts; scene-owned light, wind, water and internal materials remain local.
- Tools Tab selected artifact rendering does not use document visibility or
  viewport visibility throttles. Active selected artifacts stay animated unless
  reduced-motion disables motion.

## Rules For New Work

Entropy's seven vector instruments consume `useEntropyArtifactPresentation.js`
and share only materials/coordinates through `EntropyArtifactFrame.jsx`. Their
configured mechanical poses remain separate from activity and have no private
clock, including Echo's memory cartridge. Entropy's declared static artifact bay
and physical control carriage use the same gallery/controller contract. The
central dashboard motion registry owns its finite family-change docking stroke;
reduced motion skips the stroke, and settings updates do not remount the carriage.
Matrix/Cyberpunk Brake bodies are independent of Barrier. Their Lens and Veil
strictly require their released child projections at the widget boundary.

Clinical and SCP retain the shared flat stage and register seven standalone
instrument bodies. Their `useClinicalArtifactPresentation.js` and
`useSCPArtifactPresentation.js` adapters consume the common render channels;
`ClinicalArtifactInstrument.jsx` and `SCPArtifactFrame.jsx` own only SVG material,
instance IDs and coordinates. Child configuration comes from each family schema's
`buildVisualState`; it is not a widget-local store read or runtime activity claim.
Motion loops stop immediately with the shared still budget and resume from the
current projection. Repeated Framer motion starts from each body's scalar still
posture on first mount; `initial: false` suppresses the loop itself and must not
be used to remove an entrance reveal. These vector scenes do not require a duplicate Zen Worker or
retained bitmap commit protocol.

- Add shared stage, material, motion, or runtime fields to
  `artifactRenderContext.js`.
- Add artifact identity or render-tier metadata to `artifacts.js`.
- Do not add widget-local animation eligibility models.
- Do not add document visibility or viewport visibility gates to the selected
  artifact render path.
- Use `isVisuallyActive` only for static visual state such as opacity, posture,
  or material intensity. Continuous loops must derive from
  `shouldAnimateMotion`, `shouldAnimateAmbient`, `shouldAnimateFull`, or
  `shouldAnimateActiveVisual`. Simulation loops must derive from
  `useArtifactSimulationController`.
- Do not add renderer branches for theme-specific body behavior.
- SVG filters must use `ARTIFACT_SVG_FILTER_REGIONS` or explicitly declare
  `filterUnits` at the filter definition.
- SVG viewBoxes should use `createArtifactSvgViewBox(...)` for artifact bodies
  so origin and extent are generated from the shared coordinate contract.
- Simulation widgets must route timing through
  `src/themes/core/artifacts/runtime/useArtifactSimulationController.js`.

## Current Boundary

`ArtifactRenderer` assembles one frame request containing its context/state/FX,
visibility and the gallery's pure `renderFrame` placement closure.
`useArtifactPresentationCommit` is the only displayed-frame owner. A declared
retained `ArtifactGalleryVisual` prepares materials without drawing and publishes
an `onPrepared(submit)` candidate. Only a candidate for the current request is
rendered. The owner applies DOM placement/FX and calls the synchronous submit
function in a layout effect, before paint. A superseded receipt restores the
previous complete frame in that layout phase; malformed receipts fail explicitly.
Late candidates, interrupted React batches, and unmounted hosts cannot advance
the displayed frame. The owner rebases its request during render, so a stale
publication cannot replace the current candidate within the same React batch.
No `flushSync` or callback chain between separate placement
and FX state owners is used. Readiness follows submission and remains distinct
from asynchronous preparation.

`ArtifactRenderStage.presentationContext` supplies the displayed shell motion
budget while the context provider still delivers the requested inputs to the
preparing host. A retained gallery uses `synchronousPresentation`: shell CSS
scale/filter/opacity do not interpolate across scene swaps. Scene animation
remains with its renderer. Standalone widget stage transitions are unchanged.

All canonical Tools Tab artifact widgets consume `artifactRenderContext`.
Theme-local adapters may rename the channels, but they must not create a second
activation or motion model.
