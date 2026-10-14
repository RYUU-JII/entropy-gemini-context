# MV3 Lifecycle E2E

- Status: Active
- Owner: runtime QA / background and content lifecycle owners
- Last validated against code: 2026-10-09
- Path policy: current-only
- Canonical for: real Chromium MV3 worker revival, content continuity, and dashboard cold-reload verification

## Purpose

This harness proves lifecycle behavior that source-level Vitest mocks and
built-artifact JSDOM checks cannot prove on their own. It loads a temporary
copy of the unpacked extension in Chromium, promotes only the probe host and
`scripting` permission for the normal runtime scenarios, and runs against a
local probe page. The history-cleanup scenario additionally promotes `history`
only in that temporary copy and loads a run-owned controller extension with
`management` and `history`. The controller disables and re-enables only the
known Entropy extension id and queries only the exact probe URL. It is loaded
beside Entropy in the disposable browser's exact command-line extension set,
then correlated to its exact unpacked path through the canonical extension
harness owner. Ordinary CWS measurement launches only Entropy. The controller
has no independent lifetime: termination of the exact run-owned browser and
removal of its temporary profile/root release both extensions together, and
incomplete process or temporary-root cleanup fails the run.
Controller-page admission uses a separate narrow readiness profile requiring
only `history.getVisits`, `management.get`, and `management.setEnabled`; it does
not widen the controller manifest with unused `storage` permission.

It does not mutate the checked-in manifest, extension profile, or canonical
settings storage.

This is the deterministic local lifecycle owner, not the representative-site
runner. Use `docs/operations/qa/real-site-e2e.md` when the question is whether
site-specific activation, observable effects, cleanup, and runtime cost hold on
public sites in paired diagnostic/public builds.

## Run

The named lifecycle target consumes a prebuilt **public Chrome artifact from a
clean checkout**, matching the current commit, tree, and lockfile. A dirty
development build or a manual browser reload cannot satisfy that contract.
Resolve and review the chosen checkout's changes before committing; preserve
unrelated ongoing work. A separate checkout is useful after the intended
changes are committed, but testing an older clean commit does not verify the
current uncommitted implementation.

```powershell
npm.cmd run build:prod
npm.cmd run qa -- doctor lifecycle/mv3 --mode=agent --presentation=hidden
# Continue only when doctor is READY:
npm.cmd run qa -- run lifecycle/mv3 --mode=agent --presentation=hidden
```

The default public output is `dist-prod/`. If the QA configuration declares a
different public output, set `ENTROPY_EXTENSION_OUT_DIR` for the public build
to that exact path. The runner owns the disposable browser, temporary extension
copy, load/restart sequence, and cleanup; no manual extension reload is needed.
Doctor is read-only and prints the path and required repair steps. Public build
metadata remains dirty after a later commit, so rebuild after committing.

The package alias is `npm run e2e:mv3:lifecycle -- --dist=<build>`. The canonical
public-artifact lifecycle run also accepts `--wake-samples=<count>` (default 3).
Three samples are exploratory; use at least 20 non-pausing samples before a
report can be considered threshold-eligible. `--pause-worker-on-start` is a
failure-diagnostic mode only: CDP pauses and resumes the worker, so its latency
samples are explicitly ineligible for budgets. To run this profile together
with storage/data persistence coverage, use
`npm run verify:release-lifecycle -- --dist=<build>` and follow
`docs/operations/qa/storage-data-lifecycle-e2e.md`.

Named QA execution obtains its executable, presentation, and evidence directory
from the compiled environment contract. The package aliases and lower-level
flags below document harness implementation interfaces, not an alternative
agent launch path or permission to choose a substitute browser. Automated
browser work uses `npm run qa -- ...` and the declared target schema.

The wrapper delegates browser ownership to `measureCwsRuntime.mjs`; only that
inner owner acquires the same process-held browser-capacity slot as Entropy QA,
visual capture, extension harnesses, and research runners. This avoids a nested
self-lease. Browser process creation is muted by default and uses the shared
owned-Chromium seam; raw CDP page create/close calls use the shared target owner
and require a confirmed target-absence receipt. Capacity is released only after
target, process, and temporary-root cleanup. A concurrent owner fails as
`QA_BROWSER_CAPACITY_BUSY`, and no cleanup path scans for or terminates an
unrelated Chrome process.

A headed Linux run consumes an existing X11 or Wayland display and fails
explicitly when none is available; it never silently becomes headless. A WSL
Windows executable consumes the Windows desktop. Headless runs allocate no
display, and physical-GPU admission uses the same `SystemInfo.getInfo`
classifier as CWS and visual capture, so SwiftShader, llvmpipe, WARP, or
unclassified evidence cannot satisfy a hardware-required lane.

Headless launch preserves Chromium's default graphics backend and does not add
`--disable-gpu`. The hidden presentation contract controls display visibility,
not WebGL availability. Functional lifecycle admission still requires the same
core readiness and dismissibility; an actual degraded first frame remains
explicit invalid visual evidence, even when the functional scenarios pass.

The headed visual threshold lane is:

```bash
CHROME_BIN=/absolute/path/to/chrome-for-testing \
npm run e2e:mv3:lifecycle -- --no-build --headed \
  --dashboard-visual-samples=10 \
  --require-nondegraded-dashboard-frame \
  --require-dashboard-visual-threshold \
  --browser-profile-dir=/absolute/path/to/entropy-mv3-profile
```

The explicit profile is caller-owned and retained across runs. An implicit
profile remains harness-owned and disposable. Bounded Windows process cleanup
matches only the exact `--user-data-dir=<profile>` launch argument and never
treats a path prefix or unrelated command-line text as ownership. Initialization
failure removes only the temporary extension root and an implicitly owned
profile; it never removes an explicit caller-owned profile. WSL may point
`CHROME_BIN` at a Windows Chrome for Testing executable. The harness uses
Windows-native debug port/path admission while the temporary extension stays
isolated from the checked-in artifact. A harness-only public manifest key keeps
the temporary extension id stable at `amciafhohbkbchlofkghlokclochehko` for
reusable profiles. `--headed-software-gl` is a rendering diagnostic only and
cannot produce release-threshold evidence.

## Contract Scenarios

1. The disposable native profile first prepares its default local keys through
   the public Dashboard status route using `securityVaultQaFixture.mjs`. Its
   preparation tab blocks Dashboard application assets and never seeds secret
   storage. The default requires a version-1 `local / unlocked /
   already_unlocked` receipt without a passphrase or setup/unlock command.
   Explicitly wrapped fixtures require `mode: passphrase` and retain their
   supplied strong phrase only in the caller closure; the runner never silently
   enables wrapping. Reports retain only the safe readiness receipt. Canonical settings commands
   then establish a protected probe host and await the
   terminal `succeeded` propagation receipt before opening the scenario page.
   `scripts/perf/cwsProbeSettings.mjs` owns the shared CWS/MV3 settings intent.
   Its regression test submits that exact intent to the real `SettingsService`
   mutation boundary and the physical settings owner's `requireSettingsStoredValue`
   validator before accepting a write. Nudge settings clone the complete current
   `DEFAULT_NUDGE_SETTINGS` contract, including presage and episode fields; the
   retired `thresholdMs` is rejected rather than stripped. Retired filter keys
   and malformed nested fields also remain errors. The inactive infinite-scroll
   guard uses the settings owner's current value contract, and the harness
   performs no legacy-field cleanup.
2. Chrome's missing dynamic-registration result is reconciled through
   unregister/register and the managed loader becomes registered.
3. `pushState -> replaceState -> back` preserves the same content document id
   and produces no content bootstrap/inject/teardown event growth.
4. The extension service-worker target is stopped and a trusted extension read
   wakes a different target. Default local keys remain available; an explicitly
   wrapped fixture retains its unlocked Chrome session keyring. Neither requires
   another passphrase after worker suspension. Open-tab catch-up must preserve the same live
   document and finish it dispatch-ready without requiring loader churn. A
   same-build document may remain owned by the restored session registry or be
   rebound through `existing_runtime_probe_recovered`; a missing or previous-
   build runtime may instead report `loader_reinjected`. The revived worker must
   emit `catch_up_readiness_completed` for `service_init` with at least one
   attempted target, every target ready, and zero failures.
5. The dashboard reaches `coreReady + dismissible`, the worker is stopped, and
   a cold reload reaches the same non-fatal readiness contract on the revived
   worker.
6. In the release matrix, the source owner-chain step proves that the real
   runner writes pending+lease in one patch before `NUDGE_START`. The browser
   step independently seeds that exact issued-run physical shape in its
   temporary profile, sends lifecycle messages from the trusted protected-tab
   world, proves `dispatching -> presented`, restarts the service worker, and
   proves the same run can still end as `aborted` with pending/lease removed and
   its run-keyed terminal outbox fully drained.
   Direct `e2e:mv3:lifecycle` execution covers only the browser half.
7. A separate repeated `stop -> GET_SETTINGS -> GET_SETTINGS` measurement records
   the external request-send-to-response cold and warm RTT. The first timed read
   must be the first runtime message of a new service-worker generation and is
   cross-checked against the bounded worker snapshot. The snapshot must contain
   listener/bootstrap/dashboard/full-init milestones and both correlated
   responses. A message before the cold probe, missing milestones, dropped probe
   records, or collector failure makes the sample ineligible instead of turning
   a missing duration into `0ms`. The trusted message page is opened before the
   stop and reused for the series, so creating the transport cannot itself win
   the cold-message race. Before each probe, the stop owner closes the current
   worker and every pre-probe successor, and admits cold dispatch only after a
   100ms continuous no-worker window within its bounded eight-second deadline.
   Continuous reactivation fails with bounded target/close diagnostics, while
   the last closed target id remains the revival exclusion id. Page/worker
   request-response ordering stays entirely
   in the Chrome clock domain. The Node host separately brackets the evaluation
   with `timedPairDispatchAtHostEpochMs` and
   `timedPairCompletedAtHostEpochMs`; target observation must fall inside that
   host window and diagnostics attachment must follow its completion.
   Windows/WSL clock skew is never compared across those domains.
8. The existing runtime smoke budgets still verify storage growth, long tasks,
   dedicated-worker cleanup, and project service-worker cardinality.
9. An optional dashboard visual series repeats cold worker stop plus dashboard
   reload. A sample is admitted only when core readiness, dismissibility, and
   the Main first-frame ACK are all present without degradation or forced
   release. Ten valid headed-hardware samples are required for release p95;
   headless, explicit software renderers, and GPU evidence without a positive
   known physical-vendor signal are explicitly ineligible.
10. Source-owner checks cover teardown races that the browser revival fixture does
   not synthesize: settings disable, tab switch, window blur, document loading,
   tab removal, and tab replacement all converge on the canonical teardown
   coordinator. Bulk terminalization preserves the issued actual hostname,
   atomically enqueues the aborted outbox, and schedules any pending entry for
   the same tab.
11. The history-cleanup lifecycle scenario enables the canonical cleanup
    setting, writes a deliberately invalid activation sentinel, and uses the
    run-owned controller extension to disable only the known Entropy extension
    id. While Entropy is disabled, an exact protected probe navigation must
    produce at least one visit visible to the controller. Re-enabling Entropy
    must replace the old worker and clear the session sentinel and vault session
    binding as part of the real extension lifecycle. Before the first general
    settings read, the shared preparation owner must report `local /
    already_unlocked` for the default profile, or `passphrase / unlock` for a
    deliberately wrapped fixture. A missing mode, mixed pair, or already-unlocked
    wrapped receipt fails. Successful preparation resumes full initialization,
    runs one full activation catch-up, removes every visit
    for the exact probe URL, and write the valid completed checkpoint. The
    evidence retains both worker target ids, disable/re-enable and safe readiness receipts, the
    exact navigation-history proof, the pre-reactivation visit count, and the
    final zero visit count.

Worker-revival evidence deliberately comes from two diagnostic scopes.
`loader_reinjected` and `existing_runtime_probe_recovered` are accepted as
route diagnostics when present, while `catch_up_readiness_completed` is the
required tabless orchestrator completion read from the global content-runtime
stream. The canonical success proof is stricter than a route event: catch-up
must attempt at least one target, report every target ready with zero failures,
and leave the protected tab active on the exact pre-restart document id. This
also admits the normal storage-session path, where the revived worker restores
an already dispatch-ready session and correctly performs no content mutation.
The harness requests the global stream only for this scenario and latches the
completion across bounded ring snapshots, so later ring eviction cannot turn
successful revival into a timing-dependent failure.
The `service_init` correlation reason is preserved through the tracking runtime
coordinator into the content-script orchestrator; dropping it would make a
generic sync indistinguishable from startup catch-up and is a contract failure.
`CONTENT_BOOTSTRAP_STATE` is the narrow full-init prerequisite route: it is
handled as soon as synchronous listeners exist because full init itself awaits
open-tab catch-up readiness. General runtime messages remain behind the full-init
gate, preventing the startup cycle from being solved by weakening unrelated
message admission.

Every lifecycle page transition waits for the exact expected URL commit;
`about:blank` with a complete document is not page readiness. Extension-page
admission additionally requires callable `chrome.runtime.sendMessage` and
`chrome.storage.local/session` APIs. Each admitted snapshot must also expose a
finite, positive `performance.timeOrigin` document generation. Before a
same-URL dashboard `Page.reload`, the runner captures that generation and
rejects the still-live old document until a different generation commits;
timeout evidence includes `priorDocumentGeneration` and
`currentDocumentGeneration`. Dashboard page-ready timing therefore starts after
the new dashboard document, not the target's provisional or prior document, has
satisfied that contract.

For headed visual samples, the runner resolves the dashboard target's owning
window with `Browser.getWindowForTarget`, restores it through
`Browser.setWindowBounds` only when minimized, and verifies the result through
`Browser.getWindowBounds`. Maximized and fullscreen viewport state is preserved.
The runner then activates the target and calls `Page.bringToFront` after
attachment. It repeats that presentation before every reload. Initial,
pre-reload, and post-reload admission fails closed unless the
bounded `document.visibilityState` is exactly `visible`. Presentation and
pre-reload visible admission precede service-worker cold quiescence. Once the
continuous no-worker window is proven, the runner issues `Page.reload` without
another page-side evaluation so visibility effects cannot silently turn the
cold sample warm. This restriction is visual-lane-only: generic lifecycle pages
may remain hidden. The report retains each visual sample's before/after
generation and visibility plus the pre-reload window presentation evidence;
failed admission retains the same evidence. Background-page throttling therefore
cannot be mistaken for foreground first-frame performance.
The runner does not seize native operating-system focus. Keyboard focus itself
is not required, but a minimized or fully occluded Chrome window can legitimately
transition to `hidden`; keep the test window uncovered for the complete visual
series, or defer only that gate while continuing non-visual lifecycle work.

Every CDP request has a separate 30-second transport-response timeout. This is
independent of the in-target `Runtime.evaluate.timeout`: a failed worker or
target that never answers is rejected with method/session/request diagnostics,
and pending timers are cleared when a result or WebSocket close settles the
request.

Headless rendering may produce explicit degraded main-frame metadata. That is
accepted only when the dashboard remains `status=ready`, `coreReady=true`, and
`dismissible=true`; fatal status or duplicate readiness signals fail the run.

The report schema is V3. It preserves dashboard failure diagnostics and still
runs the independent wake measurement before returning a deferred non-zero
failure. Dashboard timing distinguishes navigation-to-boot-ready from
page-ready-to-boot-ready. Worker timing names the internal origin
`telemetryInstalledAtEpochMs`/`kernel_created`, because the static service-worker
module graph has already linked and evaluated before that clock. Only external
send-to-response RTT represents end-to-end cold wake.

## Companion Checks

- `npm run e2e:sites -- --suite=release-core --headed` — allowlisted real-site
  activation/effect/cost coverage; see `docs/operations/qa/real-site-e2e.md`
- `npm run e2e:mv3:data-lifecycle -- --dist=<build>`
- `npm run verify:release-lifecycle:source`
- `node scripts/ci/check-content-runtime-browser-like-contract.mjs <dist>`
- `npm run check:background-service-worker:contract`
- `npm run check:content-runtime:bootstrap-contract`
- `npm run check:content-script:ownership`
- focused tests:
  - `tests/backgroundBootstrapCoordinator.test.js`
  - `tests/trackingBrowserEventHandlers.test.js`
  - `tests/managedContentScriptSyncPermissionMode.test.js`
  - `tests/contentScriptOrchestrator.test.js`
  - `tests/contentScriptOrchestratorState.test.js`
  - `tests/nudgeSessionRuntimeContracts.test.js`
  - `tests/nudgeManagerConcurrencyContract.test.js`
  - `tests/nudgeTerminalEffectCoordinator.test.js`
  - `tests/protectionNudgeTeardownCoordinator.test.js`
  - `tests/nudgeGameLifecycle.test.js`
  - `tests/nudgeWindowBlurController.test.js`
  - `tests/protectionNudgeDispatchRunner.test.js`
  - `tests/protectionControllerNudgeDebugSpawn.test.js`
  - `tests/sentinelProtocolHostSessionModel.test.js`
  - `tests/supportDebugPolicy.test.js`
  - `tests/trackingBrowserEventHandlers.test.js`
  - `tests/trackingMessageHandlerNudgeLifecycleContract.test.js`
  - `tests/trackingServiceBootstrap.test.js`
  - `tests/backgroundHistoryCleanupActivationReconciler.test.js`
  - `tests/historyCleanupActivationCheckpointRepository.test.js`
  - `tests/cwsHistoryCleanupLifecycleScenario.test.js`

## Gate Policy

This remains a release-candidate/manual shipping gate and is not a default
local build step. A real browser process, local loopback server, and unpacked
extension are required. GitHub Actions runs the full release lifecycle matrix
nightly and on manual dispatch through
`.github/workflows/mv3-lifecycle-nightly.yml`; those scheduled runs are drift
detection with uploaded evidence, not a substitute for the clean RC gate or the
headed physical-GPU visual threshold lane.
