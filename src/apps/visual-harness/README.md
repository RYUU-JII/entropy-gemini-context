# visual-harness

Development-only composition surface for deterministic page and component captures.

- `sceneCatalog.js` is the single catalog for scene identity, viewport, browser preferences, readiness timeout, and capture targets.
- `visualSceneContract.js` validates catalog entries and scene implementations before rendering.
- `main.jsx` loads exactly one requested scene and publishes strict browser readiness/error state.
- `scenes/**` imports production components and supplies explicit view-model fixtures or canonical presentation inputs.
- `scripts/dev/visual-harness/captureVisualScene.mjs` is the thin command entrypoint.
- `scripts/dev/visual-harness/visualHarnessServer.mjs` owns the temporary loopback Vite lifecycle.
- `scripts/dev/visual-harness/visualSceneCapture.mjs` owns Chromium readiness, screenshots, and browser diagnostics.
- `scripts/dev/visual-harness/visualHarnessReport.mjs` owns source-state and report serialization.

Canonical operating guidance: `docs/operations/qa/visual-capture-harness.md`.

Do not place product behavior, storage truth, Chrome runtime emulation, or copied UI implementations here. A scene that requires a real extension runtime must declare that need through a future named runtime-capture seam instead of substituting mock behavior in this app.
