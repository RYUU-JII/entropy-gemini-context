# CWS Runtime Resource Measurement

- Status: Active
- Date: 2026-05-25
- Scope: Chrome Web Store submission resource smoke measurement
- Owner: release operations / QA
- Last validated against code: 2026-10-09
- Path policy: current-only
- Canonical for: Chrome Web Store runtime resource smoke measurement workflow

## Purpose

Use this check to catch release-risky runtime behavior that static bundle checks cannot see:

1. content filter heap growth across repeated protected-page loads
2. DOM churn causing long tasks or leaked managed marks
3. `chrome.storage.local/session` cache growth during filter-only use
4. extension worker targets that remain after protected pages are closed
5. optional MV3 lifecycle continuity, dashboard cold readiness, and service-worker
   cold/warm response latency decomposition

Dashboard rendering remains outside the default resource-smoke workload. The
`--lifecycle` profile deliberately adds it as a cold-revival correctness and
diagnostic signal while the synthetic protected feed remains the resource-budget
owner.

## Command

```bash
npm run perf:cws:runtime
```

Useful variants:

```bash
node scripts/perf/measureCwsRuntime.mjs --no-build --dist=dist-prod
node scripts/perf/measureCwsRuntime.mjs --build --iterations=16 --churn=1000 --idle-ms=30000
node scripts/perf/measureCwsRuntime.mjs --no-build --lifecycle --wake-samples=20
node scripts/perf/measureCwsRuntime.mjs --no-build --lifecycle --pause-worker-on-start
node scripts/perf/measureCwsRuntime.mjs --no-build --lifecycle --headed \
  --dashboard-visual-samples=10 \
  --require-nondegraded-dashboard-frame \
  --require-dashboard-visual-threshold
node scripts/perf/measureCwsRuntime.mjs --no-build --lifecycle \
  --headed-software-gl --dashboard-visual-samples=1
CHROME_BIN=/path/to/chrome node scripts/perf/measureCwsRuntime.mjs --no-build
```

`--browser-profile-dir=/absolute/path` opts into a caller-owned reusable
profile. The harness closes its browser process but never deletes that explicit
profile. Without the option, the harness owns and removes an isolated profile.
If normal browser shutdown needs bounded escalation, Windows process ownership
is admitted only by an exact `--user-data-dir=<profile>` argument match; profile
path prefixes, unrelated arguments, and wildcard-like path characters are not
cleanup authority.
On WSL, a Windows Chrome for Testing executable can be supplied through
`CHROME_BIN=/mnt/c/.../chrome.exe`; the harness allocates the debug port in the
Windows network namespace, converts only browser-facing paths, and keeps the
temporary extension copy on the Linux side. Branded Stable Chrome is not the
canonical unpacked-extension runner; use Chrome for Testing or Playwright
Chromium.

Reports are written to `reports/perf/cws-runtime-*.json`.

Before browser/runtime initialization, every invocation acquires the
repository-wide process-held browser capacity slot. It launches Chromium
through the shared owned-process seam,
which is muted by default, and releases the slot only after CDP, the owned
browser process, probe server, temporary roots, and display lease have finished
their bounded cleanup. A concurrent extension, visual, CWS, or research browser
owner fails as `QA_BROWSER_CAPACITY_BUSY`; the harness never searches for or
terminates an unrelated Chrome process.

The allocated debug port is not treated as browser identity. Immediately after
the CDP socket opens—and before `SystemInfo`, extension discovery, targets, or
settings—the shared process owner verifies the connected command line against
the spawned executable, user-data directory, profile directory, debug port, and
private owner token, plus the exact Linux/WSL-Windows OS process where
available. Linux OS proof is bound to the spawned child PID, its `/proc`
process-start token, executable, and private capability argument; it does not
depend on Chromium retaining its original NUL-separated argv after DevTools is
ready. If that admission fails, cleanup never sends `Browser.close` through the
unverified socket; it disconnects and terminates only the exact spawned
child/owner-token process.

Headless CWS runs allocate no display. `--headed` requires a real host X11 or
Wayland display for Linux Chrome, or the Windows desktop for a Windows Chrome
for Testing executable reached through WSL; it does not silently switch a
foreground run to headless or start Xvfb. An externally supplied virtual
display remains diagnostic only because the shared GPU classifier rejects
software or unclassified evidence when physical-GPU threshold admission is
required.

## How It Works

The script first uses the public CWS build output. It then copies that output
into a temporary measurement extension and patches only the temporary manifest
so `scripting` and the synthetic probe host are required permissions. Lifecycle
mode additionally promotes `history` in that copy and loads a run-owned
management/history controller extension. That controller disables and
re-enables only the known Entropy extension id and reads visits only for the
exact synthetic URL, allowing the real disabled-extension catch-up to be
measured without permission prompts or an operator profile. The canonical
extension harness owner correlates the controller's exact unpacked path after
Entropy and the controller are admitted together in the disposable browser's
command-line extension set. Normal measurement runs include only Entropy. The
controller shares the run-owned browser/profile lifetime, so exact browser
termination and temporary-root cleanup release both extensions; incomplete
cleanup fails the run.
Its page readiness profile proves only the exact `history.getVisits`,
`management.get`, and `management.setEnabled` APIs used by the scenario rather
than borrowing Entropy's storage-page readiness contract or adding unused
controller permissions.
Before settings mutations, `createCwsSecurityVaultPreparation` uses the shared
`securityVaultQaFixture` owner through its inert Dashboard preparation document.
Fresh default profiles and reactivated local profiles require only the public
status request: the receipt must be version 1, `state: unlocked`, `mode: local`,
and `operation: already_unlocked`. The runner generates no local passphrase and
does not enable optional wrapping. A deliberately wrapped fixture supplies its
explicit strong passphrase, requires `mode: passphrase`, and must take the
actual unlock branch after extension reactivation. Missing modes, mode drift,
and unexpected operations reject before settings work. Only sanitized readiness
receipts enter reports; phrases and key material do not.

The temporary manifest also receives one harness-owned public key so its
extension id remains stable when a caller intentionally reuses a browser
profile. That key is pinned to `amciafhohbkbchlofkghlokclochehko` by a pure
derivation test; no private signing key or release manifest is changed.

The product-neutral Browser QA CDP transport bounds the WebSocket open wait at
10 seconds; a socket that never opens cannot strand initialization. Every CDP
command also has an independent 30-second transport-response bound.
The `Runtime.evaluate.timeout` field only bounds evaluation inside a live
target; it cannot settle a WebSocket request after that target or worker has
failed. The transport owner therefore rejects a missing response with the CDP
method, session, request id, and timeout in the error, and clears its timer on a
result, protocol error, remote close, or explicit local close. The Extension
harness and CWS runner keep their existing APIs through thin adapters over this
one transport state machine. A malformed CDP frame is terminal: the transport
rejects every identified pending request, detaches its listeners, and closes
the socket before another command can be issued. A failed diagnostic snapshot
can no longer leave the harness waiting indefinitely.

The measured domain is `entropy-cws-probe.test`, mapped to localhost by Chrome host resolver rules. Settings are applied through the background `SET_SETTINGS` message from the harness page, so managed content script registration, storage writes, and protection broadcasts use the normal extension pipeline.

CDP page admission is URL-commit aware. A previous `about:blank` document with
`readyState=complete` is never accepted as the requested probe, dashboard, or
extension harness page. The observed URL must equal the expected URL and the
document must be interactive or complete. Every admitted snapshot also carries
a finite, positive `performance.timeOrigin` as its bounded document generation.
For a same-URL `Page.reload`, the harness captures that generation before the
reload and waits until the committed document reports a different generation;
the old document can no longer satisfy readiness just because its URL and
`readyState` still match. A timeout records both `priorDocumentGeneration` and
`currentDocumentGeneration`. For a `chrome-extension:` page, the
same readiness snapshot must also prove `chrome.runtime.sendMessage` and the
`chrome.storage.local/session` APIs are callable before the harness sends a
message or records its page-ready clock.
Raw page-target creation and closure go through the shared CDP target owner.
Every target created by this harness is closed on setup failure and normal
teardown, and cleanup succeeds only after `Target.getTargets` confirms that the
exact target id is absent. Pre-existing pages and unrelated `about:blank`
targets are never cleanup candidates.

The headed dashboard visual lane adds a presentation contract without changing
generic probe admission. For the initial document and again before every
measured reload, it resolves the target's owning window with
`Browser.getWindowForTarget`, restores it through `Browser.setWindowBounds` only
when it is minimized, and re-reads `Browser.getWindowBounds` to prove it is no
longer minimized. Maximized and fullscreen windows keep their viewport. The
harness then activates the target and calls `Page.bringToFront` on its attached
page session. It requires the bounded
`document.visibilityState` to be exactly `visible` for the initial, pre-reload,
and new-document readiness snapshots. Pre-reload presentation and visible
admission happen before service-worker cold quiescence; after the continuous
no-worker window succeeds, the next page-affecting command is `Page.reload`.
This prevents a visibility event or dashboard effect from reviving the worker
between cold proof and navigation. Hidden pages remain valid for non-visual
harness work, but can never contribute dashboard visual timing. Each admitted
visual sample preserves its before/after document generation and visibility in
`documentReadiness`; the initial document uses `initialDocumentReadiness`. A
failed reload retains that sample plus `completedVisualSampleReadiness` for the
successfully admitted prefix instead of discarding the presentation evidence.
Presentation evidence records the bounded window id, initial/final window state,
and whether a restore occurred. It is retained beside initial and pre-reload
readiness, and in the failed sample diagnostics when visible admission,
quiescence, or reload admission fails.
The harness does not use an operating-system focus-stealing API. Keyboard focus
is not an admission signal, but minimizing or fully covering the Chrome window
can make Windows report the page as hidden. A release visual run therefore needs
an uncovered Chrome window (for example, side-by-side or on another display) for
the full sample series; ordinary non-visual and wake measurements may run while
the workstation is in use.

## Reading Results

Focus on these fields first:

1. `budgetChecks`: pass/fail summary for heap growth, storage growth, long tasks, and worker leftovers
2. `scenarios.reloads[*].metrics.summary`: per-reload heap, DOM, long-task, and visible filter markers
3. `storage.final.local`: final local storage byte count and per-key byte summaries
4. `targets.afterCloseAndIdle.extensionTargets`: workers/service workers still visible after the protected page closes
5. `diagnostics.final.snapshot.events`: content bootstrap and dispatch history
6. `scenarios.lifecycle.workerRevival`: same-document loader reinjection plus
   successful service-init catch-up. The former is latched from the protected
   tab stream and the latter from the global content-runtime stream because the
   catch-up completion event is intentionally tabless.
7. `scenarios.lifecycle.workerWakeMeasurement.summary`: strict numeric cold/warm
   p50, nearest-rank p95, and max. The default three samples are exploratory;
   at least 20 successful `non_pausing_measurement` samples are required for
   `thresholdEligible=true`.
8. `scenarios.lifecycle.workerWakeMeasurement.samples[*].runtimeContract`: the
   generation, listener/bootstrap milestones, cold-first classification, and
   correlated warm response used to admit each external RTT sample. Its timing
   also records the Node-host `timedPairDispatchAtHostEpochMs` and
   `timedPairCompletedAtHostEpochMs` bracket around the page evaluation. The
   sibling `coldQuiescence` records the successful quiet-window duration, close
   attempts, and last closed target id.
9. `scenarios.lifecycle.dashboardColdReload`: separate
   `navigationToBootReadyMs` and `pageReadyToBootReadyMs` clocks plus the boot
   performance origin/stages. Its initial and per-reload document-readiness
   evidence proves target visibility and a new document generation. Failed
   dashboard and worker scenarios remain in schema-V3 `failures` and the report
   is written before the command exits nonzero.
10. `scenarios.lifecycle.dashboardColdReload.visualFirstFrameMeasurement`:
   non-degraded cold visual-frame samples and strict p50/nearest-rank p95/max.
   Ten valid samples are the minimum threshold candidate. A release threshold
   additionally requires a headed default-graphics run whose CDP GPU evidence
   positively identifies the active GL renderer as a known physical GPU vendor,
   or uses a trusted known-vendor `vendorId + deviceId` pair only when the active
   renderer is inconclusive and the device list has no software adapter evidence.
   A secondary Microsoft Basic Render Driver cannot override an explicitly
   active NVIDIA/AMD/Intel renderer, but it prevents a device-list-only hardware
   inference when the active renderer is unknown. SwiftShader, llvmpipe,
   softpipe, WARP/Microsoft
   Basic Render Driver, and other explicit software renderers are software
   evidence. An unknown label or merely missing software marker remains
   unclassified. Headless, unclassified,
   degraded, forced-release, and headed-software samples remain diagnostic and
   cannot set `releaseThresholdEligible=true`.
11. `scenarios.lifecycle.historyCleanupReactivation`: exact controller-owned
   disable/re-enable receipts, the protected URL's nonzero visit count while
   Entropy is disabled, old/new worker target ids, the valid post-reactivation
   session checkpoint, and the final zero visit count.

`--require-nondegraded-dashboard-frame` rejects any degraded or forced-release
sample. `--require-dashboard-visual-threshold` additionally requires at least
ten samples and headed-hardware evidence. `--headed-software-gl` exists to make
rendering failures diagnosable on Xvfb/CI; it is never release p95 evidence.

Temporary-root initialization is transactional. If profile-directory creation
or any later pre-launch initialization step fails, cleanup removes the
harness-owned temporary extension root and any implicitly owned profile root.
An explicit `--browser-profile-dir` remains caller-owned in success and failure
paths and is never a cleanup target.

One run is a smoke signal, not a proof. Compare reports over time and rerun with larger `--iterations`, `--churn`, and `--idle-ms` before release candidates.

The default CDP collector does not pause or attach to the new service worker
until both timed responses finish. `--pause-worker-on-start` can capture startup
console/exception evidence, but the debugger pause perturbs the path and always
marks the sample threshold-ineligible.
The trusted extension-page message transport is opened before each measurement
series and kept alive while every worker generation is stopped. Opening the
transport after the stop is forbidden because extension-page startup can wake
the worker with an unrelated typed message before the timed `GET_SETTINGS` read.
Before dispatch, the cold-stop owner detaches and closes the current service
worker plus every successor that appears, then requires 100ms of continuously
observed no-worker state. This quiescence must complete inside the existing
eight-second stop deadline, and the last closed target id becomes the exclusion
id for revival admission. A product alarm or other source that continuously
reactivates the worker therefore produces a bounded
`CWS_SERVICE_WORKER_COLD_QUIESCENCE_TIMEOUT` diagnostic with close counts and at
most 20 recent target ids; it is never mistaken for a successfully stopped cold
generation.
Wake ordering is validated inside two explicit clock domains. Page request and
response timestamps, worker message timestamps, and RTT stay in the Chrome page
realm. The WSL/Node host separately requires
`timedPairDispatchAtHostEpochMs <= targetObservedAtEpochMs <= timedPairCompletedAtHostEpochMs`
and `diagnosticsAttachedAtEpochMs >= timedPairCompletedAtHostEpochMs`. No ordering
comparison crosses from the Windows Chrome clock into the WSL Node clock, so
clock skew cannot admit or reject a sample. A target already observed before
host dispatch or diagnostics attached before host completion still fails closed.
Internal
`telemetryInstalledAtEpochMs -> kernel/listener/bootstrap` values decompose work
after `BackgroundAppKernel` creation; they do not include static module
link/evaluation. External request-send-to-response is the canonical end-to-end
cold latency. No wake budget is raised by this measurement change; rebaseline
only from a separately reviewed threshold-eligible sample set.

Storage snapshots are reduced inside the temporary extension before they cross
the DevTools boundary. Reports retain only storage-area totals plus key names and
per-key byte counts; settings values, records, secrets, and serialized JWKs are
never written to the runtime report.

Service-worker runtime telemetry is also payload-free: it retains a compact
per-lifetime random generation token, named milestone timestamps, and at most 12
normalized message action/response records. It never stores sender identity,
message payloads, URLs, settings values, or network data. Non-allowlisted actions
and every error outside a closed static code allowlist are masked. Uppercase or
code-shaped text is not sufficient for admission. The public worker exposes only a
read-only local `snapshot()` diagnostic capability; reports that use pause-mode
console capture remain local-sensitive QA artifacts and must not be published.

## Relation to Real-Site E2E

This synthetic CWS measurement remains the owner of its stable probe workload
and confirmed storage/worker smoke budgets. The real-site harness in
`docs/operations/qa/real-site-e2e.md` reuses those confirmed limits, then treats
unapproved site-specific heap, DOM, listener, and timing values as WARN-only
median evidence. It must not replace this public-artifact probe or silently
promote a volatile real-site number into a hard budget.

For paired internal-cause and shipping-cost evidence, run:

```bash
npm run e2e:sites -- --suite=release-core --lane=both --headed
```
