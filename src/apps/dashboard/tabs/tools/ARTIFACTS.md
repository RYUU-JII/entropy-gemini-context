# Tools Artifact Pipeline

This folder owns dashboard Tools Tab artifact assembly. It does not own theme
drawing internals.

Lens exposes independent grayscale, blur, brightness, contrast and saturation
ON/OFF controls with integer 0–100 strengths through the canonical release-child
catalog. Grayscale is page-wide; the other four effects target media. Each input
writes its own settings entry through the selected controller and command bus.

## Canonical Flow

1. `artifactActivationState.js`
   - single source of truth for configured, runtime, preview, and visual
     activation.
   - dashboard preview follows configured user intent; runtime execution remains
     gated by site, permission, and live runtime capability.
2. `createToolsSelectedArtifactBuilder.js` / `artifactCardMaterialization.jsx`
   - assembles the selected card from its lazy controller's family-owned schema.
   - does not make independent activation decisions.
   - consumes the canonical background disclosure snapshot. Initial critical
     preparation and navigation share its visible family order.
   - `buildToolsArtifacts.jsx` and `artifactCardSchemas.jsx` are full-collection
     fixture/harness owners; live selected controllers do not import them.
3. `artifactCards/*`
   - builds card schema and visual state.
   - missing canonical card builders must fail loudly.
4. `components/ArtifactGallery.jsx`
   - owns gallery selection and scene runtime.
5. `components/ArtifactRenderer.jsx`
   - builds the widget render state/context and hands only render context to the
     active theme widget.
   - selected artifact motion is always-on in the Tools Tab; do not throttle it
     with document visibility or viewport visibility gates.
   - the tab's `isRuntimeActive` admission parks motion through the canonical
     render context while Tools is inactive; CSS hiding alone is insufficient.

## Rules For New Work

- Do not infer artifact activation from status copy, local booleans, or widget
  internals.
- Do not add quiet fallback card schemas.
- Do not write business artifact state to `window.localStorage`.
- Pass activity/presentation through the canonical pipeline instead of adding a
  parallel widget prop model.
- Do not add render-saving visibility gates to the selected artifact renderer.
- If a new persisted data class is needed, add or extend a typed store first.

## Renderer Handoff

Every row declares a stable `childKey` and the app-owned `Control` component.
`components/ArtifactControlRowInput.jsx` renders binary, choice, level, number and
range inputs; themes receive this owner instead of importing dashboard code.
The disclosed presentation keeps ON/OFF separate from option/strength changes.
Editing an OFF numeric input retains OFF. Pending intent and failures stay with
`useArtifactControlCommit` and the canonical settings command/read owners.

`ArtifactRenderer` forwards `artifactRenderContext` as the canonical widget
handoff. Theme widgets may keep fallback props for non-gallery reuse, but the
Tools Tab path must not depend on direct `isActive`, `shouldAnimate`,
`activityWeight`, or `artifactVisualState` props.


## Artifact realignment — 2026-10-09

Current ownership supersedes previous family examples: Veil owns socialMetrics, timeSignals and shortformBlock; Brake owns clickPause, scrollFriction, inputVisualBrake and skipFriction; Barrier owns textRhythm, intentThreshold and detourSpreadGuard, plus the existing auxiliary tabManagement preference. The canonical catalog and runtime binding apply this ownership to disclosure, family pause, configuration, execution and telemetry. Feed Horizon and the cadence remain one Barrier episode; no parallel actuator is added.

Lens release children expose independent ON/OFF plus integer 0–100 strengths. Persisted visual filter values are numeric strengths, and the visual profile owner compiles strength/effectiveStrength and physical CSS for the current adaptive band. Present boolean visual settings are incompatible pre-release data and reject without rewriting or wiping. The 101 quantized grayscale prepaint assets match the exact compiled strength; only admitted host tiers are registered.

The periodic boundary uses a single horizontal gesture: drag from the center left to finish, right to continue; at least 420 ms and the declared travel distance are required, and release confirms. Keyboard arrow hold/release is equivalent. Partial strokes retry without retained ink; cancel is neutral and cannot replay or navigate. Existing admission, cadence, feed endpoint, replay and tab-closure authorities remain mandatory. The Zen skip attempt is represented by a Tome Ishi stone resistance pulse inside the video boundary, with reduced motion honored.
