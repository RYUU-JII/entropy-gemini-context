# Zen Main Boot And Data Readiness

- Status: Active
- Owner: dashboard app, zen dashboard architecture
- Last validated against code: 2026-08-09
- Path policy: current-only
- Canonical for: Zen main first-viewport readiness, Enso handoff policy, and main-screen pond/rhythm data alignment

## Purpose

This document records the final Zen main-screen boot contract after the Enso handoff stabilization work. It is both a learning record and a reference for future agents: the first dashboard reveal should wait for the complete first viewport, and the pond koi roster plus pressure rail should read one shared visible-domain authority.

## Scope

- In scope:
  - Zen main boot readiness from BootShell to first visible dashboard frame.
  - The first-viewport capture/hold/release policy for pond, bonsai, and rhythm surfaces.
  - The main-screen data path used by the pressure rail, passive rhythm marker, and pond koi roster.
  - Known residual risks and the intended response if they recur.
- Out of scope:
  - Theme-independent dashboard boot shell design. See `dashboard-boot-sequence-architecture.md`.
  - Product layout decisions for Home / Scan and Home / Reflect. See `../../product/dashboard/home-scan-reflect-structure.md`.
  - Low-level Zen pond renderer internals. See `../../architecture/themes/zen/zen-pond-render-worker-spec.md`.

## Current Baseline

Zen main boot intentionally optimizes for a complete reveal rather than the earliest possible reveal. The user-facing invariant is:

> Enso should descend only after the first viewport is visually complete enough that the live dashboard can continue without a visible construction step.

The successful baseline uses three layers:

1. **Boot gate waits for composite main-tab first frame.**
   `bootManager` treats `mainTabFirstFrameReady` as the dashboard dismiss gate, not as optional telemetry. For Zen main, that signal is emitted after the composite surface reports the required first-scene parts, including the pond worker frame, bonsai worker frame, and first-viewport evidence for the rhythm/main snapshot. Normal current boot uses captured evidence; the reserved first-vision stage uses committed live evidence because its scene must remain live.

2. **First viewport is captured during the BootShell hold.**
   While the visible BootShell is still covering the dashboard, `HomeScanWorkspace` captures the ready pond, bonsai, and rhythm frames. The capture is semantic/visual, not a raw object dump: each part owns a compact visual signature.

3. **Release is signature-gated after paint.**
   When BootShell starts revealing the root, the captured first viewport is held until the live pond, bonsai, and rhythm signatures match the captured frame. Only then does the hold clear on the next paint. This prevents the reveal from showing one frame of a completed capture followed by a different live frame.

This is why the final result felt different: the fix was not just "wait longer." The decisive change was waiting for the right completed visual contract, then preventing the captured first viewport and the first live viewport from diverging during the reveal.

## Boot Readiness Contract

### Readiness Is A Visual Contract

Boot readiness is not just React mounted, data loaded, or workers initialized. For Zen main, readiness means:

- Pond has a mounted runtime, a valid roster authority, and a committed first frame.
- Bonsai has one exact materialization and a committed worker frame whose scene commit key, canonical input signature, and materialization key match that prepared materialization. First Vision uses its explicit read-only scene input instead of current stats evidence.
- Rhythm has a first viewport graph frame derived from the same main snapshot.
- The root can reveal without swapping from a captured frame to a materially different live frame.

The bonsai materialization is single-render by contract. Normal current boot
waits for canonical evidence and the cultivation-ledger commit, then admits the
exact target to durable lineage and the worker. It does not hydrate or animate
from a separate visual checkpoint. Candidate topology may prewarm while facts
load, but new-target semantic lineage, scene sync, and exact current-frame
readiness stay closed until the exact request is committed. A last exact-ACK
paint may remain visible only on the same canvas, scene, and active tree identity;
it is a presentation latch and never contributes to boot/composite readiness.
Equivalent reconstructed React inputs reuse the same committed materialization
and lineage request by canonical signature;
object identity alone must not repeat evidence, target, or repository work.

The relevant anchors are:

- `src/apps/dashboard/bootstrap/bootManager.js`
- `src/apps/dashboard/bootShell.js`
- `src/apps/dashboard/tabs/main/MainTab.jsx`
- `src/apps/dashboard/tabs/main/home/HomeScanWorkspace.jsx`
- `src/apps/dashboard/tabs/main/home/useZenHomeFirstViewportBootFrame.js`

### BootPrewarm Status Coherence

`BootPrewarmService` admits only a JSON-canonical stats `statusSnapshot` into its
in-memory cache. The stats read-model builder owns the semantic DTO assertion;
the BootPrewarm envelope owns the background-to-dashboard transport assertion.
An invalid fresh source rejects readiness with the exact canonical path and is
never cached. If a previously admitted private in-memory envelope becomes
incomplete before delivery, the service emits
`[BootPrewarmService] Invalidated cached dashboard snapshot`, clears that one
cache entry, rebuilds from current owners once, and validates the rebuilt
envelope. It does not JSON-sanitize the DTO, coerce fields, return the invalid
snapshot, or ask `BootPrewarmClient` to ignore it. A rebuild failure remains a
named boot failure. This cache-only invalidation is not a storage fallback and
does not survive a service-worker lifetime.

### Timeouts Are Not The Success Path

Timeouts remain useful as diagnosable fail-open or degradation boundaries, but they must not define normal Zen success. Device performance varies, so the normal path should wait for readiness evidence rather than assuming a fixed duration is enough.

The practical rule:

- If a slow device needs longer to produce the required first frame, waiting is acceptable.
- If a worker or data authority never reaches readiness, release with traceable degraded state rather than revealing a partially built main screen as clean success.
- BootShell hard timeout is a last-resort user-control boundary, not a replacement for the readiness contract.

### Failure Vocabulary Is Layered

Zen first-visual startup uses three different failure scopes:

- Pond worker readiness `failed` is a renderer/runtime owner signal. It must remain a hard worker failure with an explicit `ZEN_POND_WORKER_HARD_FAIL:*` reason.
- Zen home first-visual `failed` is a terminal composite visual signal. It is emitted only for explicit terminal milestones such as `pond:readiness:failed` or `bonsai:failed_mount_or_update`, not from loose string matching.
- Dashboard boot receives that first-visual terminal signal as degraded readiness. It records `BOOT_MAIN_FIRST_FRAME_FAILED`, marks `mainTabFirstFrameDegraded`, and releases the visible shell without promoting the whole dashboard boot to `failed`.

## First-Viewport Capture Policy

`useZenHomeFirstViewportBootFrame` owns the first-viewport hold behavior. It receives live pond, bonsai, and rhythm frames plus signatures, captures ready parts while BootShell is active, and returns either the captured frame or live frame depending on lifecycle state.

Important rules:

- Capture is active only while Zen BootShell is holding the root.
- Pond, bonsai, and rhythm are captured independently, but the lifecycle is ready only when all required parts are captured.
- The reserved first-vision stage intentionally disables capture hold. It may report the first-viewport part from validated live pond, bonsai, and rhythm inputs after the Home commit; pond and bonsai worker first-frame acknowledgements remain independently required.
- First-viewport notification is keyed by the exact bonsai scene commit key,
  input signature, and materialization key. A same-scene rematerialization must
  notify again so the composite coordinator can rebase without waiting for a
  stale viewport token until hard timeout.
- On release, live signatures must match captured signatures for all parts.
- If signatures do not match, the captured frame stays held instead of revealing a partial or changed live viewport.
- After a matching live frame has painted, captured state is cleared and the surface becomes live.

The current visual signatures are intentionally narrow:

- Pond signature: visible domain candidates, scanner target count, status snapshot readiness/currentness, and roster authority.
- Bonsai signature: evidence authority, score/limit/protection metrics,
  registered-site signature, presentation mode, scene commit key, canonical
  materialization input signature, and exact bonsai materialization key.
- Rhythm signature: selected lens, pressure summary/readiness, marker pressure profile/evidence, and top-site domains/ranks/shares/dispositions.

This keeps the first-viewport release tied to what the user can perceive instead of to incidental object identity.

## Main-Screen Data Authority

The main screen uses `statusSnapshot.visibleDomainCandidates` as the shared visible-domain authority for current Zen Scan. The path is:

1. `useStatusSnapshot()` provides the status read model.
2. `useStatusController()` exposes `ctrl.visibleDomainCandidates`.
3. `buildHomeScanSnapshot()` passes those candidates into `buildRhythmTopSitesViewModel()` for the compact pressure rail.
4. `HomeScanWorkspace` passes the same candidates to the Zen signal scanner/pond path.
5. The pond roster policy trusts `visibleRank` when candidates are already preselected, so the koi roster does not run a second independent selection pass.
6. The status read model also emits `pressureRailReadiness` and each candidate's canonical `policyDisposition`.
7. `ZenPressureRail` renders the upstream curated pressure shares exactly, maps `policyDisposition` to Zen paint, and expands only pointer hit-testing for undersized segments.
8. `ZenRhythmMarker` reads the separately projected rolling-pressure hour profile and never owns site discovery.

Canonical anchors:

- `src/apps/dashboard/hooks/useStatusController.js`
- `src/apps/dashboard/tabs/main/home/buildHomeScanSnapshot.js`
- `src/apps/dashboard/tabs/main/home/rhythmTopSitesViewModel.js`
- `src/apps/dashboard/tabs/main/home/HomeScanWorkspace.jsx`
- `src/domains/stats/background/query/statsStatusVisibleDomainReadModel.js`
- `src/themes/plugins/zen/pond/roster/zenKoiRosterPolicy.js`
- `src/themes/plugins/zen/widgets/core/ZenPressureRail.jsx`
- `src/themes/plugins/zen/widgets/core/ZenRhythmMarker.jsx`

### Pressure Rail And Rhythm Marker

The former full-width rhythm board is split into two deliberately smaller meanings:

- The pressure rail reads recent rolling-pressure shares from `rhythmTopSites` and shares selection/hover with the pond.
- The passive marker consumes the dashboard's canonical Zen ambient presentation for current time, solar phase, and inscription tone. When a domain is selected, an aligned `dailyFlow.pressureProfile` may add that domain's hourly `targetPressureMs` as ink traces on the day arc; it does not start a second clock, infer a typical window, or substitute aggregate pressure.
- The rail reads one live recent-pressure share contract; boot does not inject a period-summary or current-day substitute.
- The rail stays in a neutral `collecting` state until three completed activity days are observed. Seven completed days changes evidence maturity to stable but is not the initial reveal gate.
- Readiness is one transition from `collecting` to `ready`. A ready rail carries `contentState=pressure` or `contentState=no_pressure`; the latter is a completed calm result, not another waiting phase.
- Positive-day, total-pressure, and visible-candidate evidence must agree. A partial positive tuple fails loudly instead of being mislabeled as no recent pressure.

Neither surface independently discovers sites or accepts hour clicks. They receive prepared view models from `buildHomeScanSnapshot()` / the presentation projection and render them.

### Pond Koi Linkage

The pond koi roster receives the same visible candidate set that the pressure rail uses. The important field is `visibleRank`:

- If every candidate has `visibleRank`, pond treats the list as preselected and preserves rank order.
- The pressure-rail top-site model also preserves `visibleRank` when a visible set exists.
- Before readiness, rhythm remains collecting according to `pressureRailReadiness`. Once ready, a genuinely empty pressure tuple becomes the completed `no_pressure` result. Positive pressure without a visible set is an inconsistent read-model failure; rhythm never reselects current-day projection totals.

Fish count must not be hardcoded to six. Six is the interactive maximum/default visual budget, not the data invariant. If the user has fewer managed/protected sites, or if all-sites-minimal tracking is disabled, the visible candidate set may contain fewer domains.

## Interaction Contract

Selection and hover should flow through the shared main surface state:

- Selecting a rhythm/koi domain calls the dashboard controller selection seam (`setLockedTarget` / rhythm lens).
- Hovered koi domain is read from the Zen interaction store and may be reflected in the pressure rail.
- Presentation scenes may provide a read-only lens and domain candidates. In that mode, Scan renders the scene projection instead of mutating current-cycle selection state.

The current-cycle path and presentation-scene path should remain explicit. Do not make Scan rebuild a past or closed day from current controller data.

## Why This Closed The Visual Bug

Earlier attempts improved worker readiness and data speed but still allowed a reveal gap:

- Boot could declare the main tab ready before every first-viewport part was visually stable.
- Pond, bonsai, and rhythm could continue switching from a captured/temporary state to live state while Enso was descending.
- The former bottom board and pond roster could read the same candidates but sort/present them through slightly different rules.

The final stable shape closed those gaps:

- Composite readiness waits for the meaningful Zen first-frame parts.
- First viewport is captured while covered, then released only when live visual signatures match.
- Pond and rhythm share `visibleDomainCandidates` and preserve `visibleRank`.
- Bonsai and stats read from authoritative current snapshots instead of doing expensive or speculative reconstruction during reveal.

The result is allowed to take a little longer. The product goal is not instant dashboard access; it is a complete, calm first reveal.

## Stabilization Plan

### Significance

Zen boot has two separate obligations that must not be collapsed into one shortcut:

- **Visual completeness:** the first revealed dashboard scene must already be complete enough that the user does not watch pond, bonsai, or rhythm construct themselves after Enso descends.
- **User-control recovery:** if the normal readiness path cannot complete, the shell must not trap the user forever behind a loader.

The architecture goal is to keep those obligations in different layers. Normal success is owned by readiness evidence. Emergency release is owned by the visible BootShell safety boundary. Trace, telemetry, local debug history, and elapsed-time budgets are evidence only; they must not become release authority.

The guiding rule for follow-up work is:

> First-scene completeness is the normal release contract. Smoothness is achieved by BootShell coverage and first-viewport hold/release, not by weakening the readiness gate.

### Target Completion State

This cleanup is complete only when all of the following are true in current code, docs, and tests:

1. **The normal Zen release gate names the complete first scene.**
   `mainTabFirstFrameReady` may remain the theme-neutral `bootManager` field, but the Zen caller must treat it as a complete first-scene contract, not merely a pond/bonsai callback bundle. The required Zen scene parts must be explicit in code and docs:
   - pond runtime mounted with roster authority and committed first frame,
   - bonsai authoritative input plus committed first frame,
   - rhythm first-viewport frame derived from the same main snapshot, unless an Active doc explicitly excludes rhythm from the normal release gate and explains why capture/hold is sufficient.

2. **The first-viewport hold and the boot release gate cannot disagree silently.**
   Normal current boot requires every captured first-viewport part before `reportMainTabFirstFrameReady()`. The named exception is a reserved first-vision stage: capture hold is disabled there, so the Home commit may provide validated live viewport evidence while the coordinator still requires pond and bonsai worker first-frame acknowledgements. Any other release before captured evidence must be represented as degraded/forced release metadata, not as clean readiness.

3. **Hard timeout is a forced visual release, never a clean success.**
   `BOOT_SHELL_HARD_TIMEOUT_MS` may reveal the root as a last-resort user-control boundary, but the resulting state, trace, telemetry, and diagnostic report must distinguish it from normal `ready` release. A hard-timeout reveal with missing `mainTabFirstFrameReady` is acceptable only if it is visibly diagnosable as forced release.

4. **Release-state commits happen before diagnostic side effects.**
   For every terminal boot release signal, the canonical state mutation must happen before heavy trace, telemetry history, localStorage writes, or diagnostic serialization. This includes `mainTabFirstFrameReady`, `dismissible`, and shell-dismiss reporting paths.

5. **Diagnostic payloads are compact and derived.**
   First-frame trace/telemetry history may keep timing, readiness, renderer status, and summary counters. It must not persist raw pond/bonsai/rhythm runtime objects, large signatures, or worker diagnostics blobs as normal boot trace payloads.

6. **Dev diagnostics are opt-in and one-shot.**
   Heavy boot tracing is activated only by the Experiment tab reload diagnostics action or an equivalent explicit developer command. Ordinary dashboard boot must not carry long-lived diagnostic tracing from prior sessions.

7. **Legacy/proposed boot plans cannot override this contract.**
   Proposed or superseded boot-shell/worker-loader documents must point back to this document and `dashboard-boot-sequence-architecture.md` for current authority. Any remaining fallback language in proposed docs is historical unless copied into an Active doc with owner, signal, and exit condition.

### Current Known Gaps

As of the 2026-07-08 audit:

- The Zen first-visual coordinator now treats first-viewport readiness as a required normal-release part alongside pond and bonsai. Future work should keep that contract named and avoid reducing it back to a pond/bonsai-only callback bundle.
- `bootShell.js` can reveal the root on hard timeout even if the complete Zen first scene did not reach normal readiness. This is a valid safety valve, and current code records it as `forcedVisualRelease === true` with `phase === "forced_visual_release"` instead of treating it as clean readiness.
- Terminal release traces for main first-frame readiness, dismissible readiness, shell dismissal, forced visual release, and the DashboardPage callback now run after the canonical state commit they describe. Future trace additions should preserve this state-before-diagnostics order.
- First-frame metadata compaction is owned by `src/apps/dashboard/bootstrap/mainFirstFrameDiagnostics.js`. This seam is diagnostic-only; readiness must continue to come from the first-visual coordinator state and `bootManager` gates.
- `dashboard-boot-shell-worker-architecture.md` is now marked Superseded and points to the Active boot documents. Its rollback/fallback wording remains historical context only.

### Work Packages

#### P1. Name The Complete Zen First Scene Contract

Define a single internal contract for the required Zen normal-release parts. The contract should answer whether rhythm is a hard release input or a presentation hold input.

Done when:

- The contract has a named helper or reducer state, not scattered booleans.
- The contract is documented in this file under "Boot Readiness Contract".
- Tests cover the ready and not-ready combinations for pond, bonsai, and rhythm/capture policy.

#### P2. Feed First-Viewport Readiness Into The Gate

Wire the complete-scene contract into the path that currently reports `mainTabFirstFrameReady`:

```text
HomeScanWorkspace first-viewport lifecycle
  -> Zen first-visual coordinator
  -> DashboardPage callback
  -> bootManager.reportMainTabFirstFrameReady()
```

Done when:

- Zen normal release cannot call `reportMainTabFirstFrameReady()` while a required first-viewport part is missing.
- The `main_tab:ready_notify` and `boot_manager:main_tab_first_frame_ready` metadata summarize the required parts and their readiness sources.
- Existing pond/bonsai worker first-frame regressions remain covered.

#### P3. Split Normal Ready From Forced Visual Release

Make hard-timeout release explicit. The shell may reveal the root for user control, but that event should not read as normal readiness.

Done when:

- Hard timeout with incomplete first scene records a forced visual release signal distinct from normal `ready`.
- Boot diagnostics report forced release separately from `main_first_frame_degraded`.
- Tests assert that hard timeout with `mainTabFirstFrameReady: false` is not clean success.

#### P4. Enforce State-Before-Diagnostics Ordering

Move or defer remaining terminal-release trace calls that occur before state commits.

Done when:

- `reportMainTabFirstFrameReady()`, `maybePromoteDismissible()`, DashboardPage first-frame callback, and shell-dismiss reporting have tests or assertions proving the state is already committed before their descriptive trace is emitted.
- No first-frame trace path performs synchronous storage or large serialization ahead of a release-state mutation.

#### P5. Extract The First-Frame Diagnostic Metadata Seam

Consolidate compact metadata shaping into one owner seam.

Done when:

- `bootManager` and the Zen first-visual coordinator no longer maintain divergent field allowlists for the same pond/bonsai first-frame diagnostics.
- The shared seam is explicitly diagnostic-only and does not decide readiness.
- Tests prove raw large fields such as signatures, full diagnostics arrays, or worker payload blobs do not enter boot trace history.

#### P6. Retire Or Mark Superseded Boot Plans

Clean up planning docs that still describe old fallback/rollback options as if they were viable current architecture.

Done when:

- `dashboard-boot-shell-worker-architecture.md` either becomes clearly superseded/historical or has its current valid timeout notes moved into Active docs.
- Active docs agree that normal Zen success is readiness-evidence based, while hard timeout is a forced visual release boundary.
- `git diff --check` passes for documentation-only changes.

### Verification For This Plan

Use the following checks while implementing the packages above:

```bash
npm run test:file -- tests/bootCoordinator.test.js tests/dashboardBootShellStartup.test.js tests/dashboardBootDiagnosticsReport.test.js
npm run test:file -- tests/zenHomeFirstViewportBootFrame.test.jsx tests/mainTabLoadingContract.test.jsx
npm run test:file -- tests/rhythmTopSitesViewModel.test.js tests/themes/zenRhythmCandidateParity.test.js tests/homeScanSnapshotRhythmDay.test.js tests/zenPressureRail.test.jsx tests/zenRhythmMarker.test.jsx
npm run check:boot:timeout-contract
git diff --check
```

Run `npm run build:quick` only when boot entrypoints, Vite/bundle boundaries, manifest wiring, or worker imports change.

## Residual Risks

- **Very slow devices:** first reveal may take longer. This is acceptable unless it becomes indistinguishable from a stuck boot. Add better progress diagnostics before weakening readiness.
- **Signature drift:** if a future visual field changes what the user sees but is not represented in a signature, BootShell may release too early. Update the relevant visual signature with the same change.
- **Presentation-scene override:** first-vision projection may intentionally replace current-cycle candidates. Keep that ephemeral read-only path explicit.
- **Empty visible set:** an empty visible set can mean no relevant sites, missing status snapshot, or policy mismatch. Future work should distinguish these states diagnostically rather than silently inventing koi or graph rows.
- **Koi expression intensity:** shared candidate order does not mean every visual property is identical to the graph. Koi expression can still use activity/risk signals after roster selection.

## Verification Slice

Use this focused slice when touching the Zen first viewport, visible-domain candidate path, koi roster parity, pressure rail, or rhythm marker projection:

```bash
npm run test:file -- tests/zenHomeFirstViewportBootFrame.test.jsx tests/rhythmTopSitesViewModel.test.js tests/themes/zenRhythmCandidateParity.test.js tests/homeScanSnapshotRhythmDay.test.js tests/zenPressureRail.test.jsx tests/zenRhythmMarker.test.jsx tests/statsStatusSnapshotReadModel.test.js tests/statsStatusDomainCandidatePool.test.js
```

For boot timeout contract changes, also run:

```bash
npm run check:boot:timeout-contract
```

For documentation-only edits, `git diff --check` is usually enough.

## Change Guidance

When changing this area:

- Start from the visible symptom, then trace the authority path before changing timing.
- Prefer readiness evidence over duration-based success.
- Do not add a second domain-selection path for the graph, koi, or scanner.
- Preserve `visibleRank` once the status read model has selected the visible domain set.
- Keep presentation-scene data separate from current-cycle data.
- If a fallback is unavoidable, document the owner, boundary, telemetry signal, and exit condition in the same change.

## Stable model inputs at boot-frame release (2026-09-07)

`useZenClassicHomeTopologyRuntime` compares the small G15 generation input
(seed, life state, phenotype) by value before calling the kernel. Replacing an
identical presentation object during the captured-to-live handoff must not
regenerate the graph. Actual input changes still generate a new topology.
`useZenBonsaiRenderPlan` memoizes device geometry by value and topology by identity;
G15 plans do not subscribe to the Classic life/activation/growth projection fields
that their builder does not consume. Classic retains those dependencies.

The captured first viewport, its generation/signature checks and its release
acknowledgement remain intact. Reveal-start and shell-dismissal retain their
separate meanings. The fix removes model work caused by their renders instead
of bypassing the visual handoff protocol. Blossom's existing 3400ms first-transit
delay remains; the growth reveal is a toast, and AI enrichment is ineligible in
Zen. These effects are not treated as three simultaneous animation loops.

The boot timeout geometry guard checks the current `rhythmMarkerSlot` binding,
not the retired `pressureRailSlot` name, while retaining its prohibition on
viewport-width utility breakpoints for canonical Zen Home geometry.

### Completed renderer exit (2026-09-07)

`bootShellRendererContract.js` owns the optional `prepareThemeBootShellForExit`
capability. A declared handler releases rendering resources while preserving
its completed pixels and DOM for the existing fade. `bootShell.js` invokes it
once at fade start, after the existing completion/readiness admission; it does
not change the 420 ms fade, first-frame gate, hard timeout, or dismissal clock.
Undeclared themes keep their existing lifecycle; invalid handlers fail explicitly.

Zen registers its idempotent resource cleanup. Worker termination and admitted
lease release begin before the fade rather than after shell removal. The final
OffscreenCanvas picture and shell styles remain mounted through the fade; the
ordinary removal callback may invoke cleanup again without a second termination.
Resize/motion listeners are no longer needed once the exit has begun. Error and
forced-release paths keep their existing disposal behavior.
