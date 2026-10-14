# Real-Site Entropy E2E

- Status: Active
- Owner: runtime QA / release operations
- Last validated against code: 2026-08-18
- Path policy: current-only
- Canonical for: allowlisted real-site scenario execution, diagnostic/release lane pairing, QA-profile safety, result classification, and real-site performance baseline policy
- Companion to:
  - `docs/operations/qa/entropy-qa-control-plane.md`
  - `docs/architecture/repository/friction-nudge-effect-boundary-map.md`
  - `docs/architecture/repository/social-metrics-seam-map.md`
  - `docs/operations/qa/mv3-lifecycle-e2e.md`
  - `docs/operations/qa/cws-runtime-measurement.md`

## Purpose

This harness runs Entropy's real settings, protection activation, effects, and
cleanup against explicitly allowlisted public sites. It pairs a development
diagnostic build, where the canonical Runtime Debugger can explain internal
work, with the exact public build, where CDP measures the shipping runtime
without debugger cost. Whenever the public `release` lane runs for the
no-login suite, a third disposable browser repeats the public site flow with
all extensions disabled. That control is an external baseline, not a product
activation lane and not an independent PASS claim about Entropy.

The harness complements rather than replaces the synthetic MV3 lifecycle and
CWS runtime checks. Real sites are volatile, so activation and cleanup contracts
can fail immediately, while unapproved real-site timing, heap, and DOM numbers
remain warning-only evidence.

The `instagram-login-metadata` scenario enables Social Metrics and performs at
most three 800px scroll actions. It does not enable Short-form blocking or
certify sustained pagination, Reel hydration order, scroll-position continuity,
or combined Infinite Scroll/Text Rhythm behavior. Selector-corpus and Feed
Horizon results have their own narrower contracts; an Instagram functional
result must not be presented as acceptance of this combined long-feed workload.

Connected exploratory scroll input is not interchangeable with manual wheel
input. A decrease in `scrollY`, or an intermediate DOM rectangle change, is not
by itself proof of the operator's visible jump. Check a matched extension-OFF
control and retain manual or independent painted-frame evidence; if tool-driven
motion persists while manual use is normal, do not promote it to a product
regression. Record other extensions and separate their hiding markers from
Entropy-owned effects. Page-wide long tasks and heap totals do not attribute
CPU or retained memory to Entropy.

Instagram Home Short-form collapse acceptance must include progression through
native virtualized article-window/padding changes with the feature ON, a matched
OFF control, and continued manual or independently verified painted movement.
Check the Home-only anchoring exclusion and its cleanup on route exit/disable;
absence of a Horizon endpoint must remain distinct from intentional feed gating.

## Owner Map

| Concern | Owner / path | Contract |
| --- | --- | --- |
| Public target invocation, environment/resource coordination, and evidence envelope | `scripts/qa/entropyQa.mjs`, `scripts/qa/protocols/siteRuntimeQaProtocol.mjs` | resolve a named target, delegate one normalized run, validate the full schema-v1 child aggregate plus report ownership/lane coverage, recompute the outcome from runs and controls, and project it without promoting `WARN` or `INCONCLUSIVE` to top-level `PASS` |
| Suite execution engine | `scripts/e2e/siteRuntimeE2E.mjs` | select lanes and scenarios, build isolated artifacts, run repeats, and close Chrome/temp resources |
| Site scenarios | `scripts/e2e/sites/scenarioCatalog.mjs`, `scripts/e2e/sites/scenarioContracts.mjs` | declarative URLs, exact HTTPS allowlisted/redirect origins, settings, expected activation, readiness, safe actions, observable effects, settle conditions, and forbidden actions |
| Site identity and target truth | `src/domains/nudge/targeting/siteIdentityCatalog.js` plus owner-local behavior, interaction, text, visual media, Social Metrics, Short-form, and FeedFlow target modules | scenario site ids resolve through the selector-free production identity catalog; target meaning stays with each product owner and the runner does not own host-specific product behavior |
| Chromium/profile safety | `scripts/qa/profile/entropyQaProfileMarker.mjs`, `scripts/e2e/extensionChromiumHarness.mjs` | the shared strict marker owner proves an explicit QA profile; attach staging occurs only while the harness holds endpoint and user-data-root capacity; external attach requires the exact already-active artifact slot, while an explicitly managed ensure-before-attach session may load only its canonical staged slot; cleanup closes only harness-owned targets without browser close/process termination/extension uninstall |
| Windows child cancellation | `scripts/qa/runtime/qaWindowsChildJob.mjs`, `scripts/qa/runtime/qaChildAbortRegistry.mjs` | the harness registers its canonical close owner before startup; cancellation waits for startup ownership to settle, coalesces concurrent close calls, and acknowledges after cleanup; attached target uncertainty remains FAIL even if the child Job is empty |
| Internal diagnostic evidence | `src/domains/nudge/core/targetingHealthContract.js`, `src/domains/nudge/visual/socialMetrics/core/targetingHealthProjector.js`, `src/domains/nudge/runtime-debugger/RuntimeDebuggerRuntime.js`, `src/domains/nudge/runtime-debugger/RuntimeDebuggerShortFormOracle.js`, `src/domains/nudge/feed-flow/diagnostics/FeedFlowDiagnosticLedger.js`, `src/domains/nudge/runtime-debugger/RuntimeDebuggerProbeCatalog.js`, and `src/domains/nudge/runtime-debugger/core/**` | baseline/latest/delta sessions, shared content-free validity/health vocabulary, bounded independent Short-form opportunity/effect proof, Social owner projection, FeedFlow event/cost evidence, sanitization, and reports remain owned by the existing Runtime Debugger and producers; health evidence does not grant recovery authority |
| Dev-only debugger transport | `src/domains/nudge/runtime-debugger/automation/runtimeDebuggerAutomationContract.dev.js`, its dev content relay, and `src/apps/background/services/runtime/messageRoutes/runtimeDebuggerAutomationMessageRoutes.dev.js` | typed, trusted transport to one explicit target tab; it is not a second session, store, report, or overlay owner |
| Shared dev automation trust and Gate transport | `src/platform/security/qaAutomationHarnessTrust.dev.js`, `src/domains/protection/background/automation/gateQaAutomationContract.dev.js`, `src/apps/background/services/runtime/messageRoutes/gateQaAutomationMessageRoutes.dev.js` | exact `entropy-e2e.html` sender, bounded Gate request, canonical session-commit proof, and idempotent controller-owned cleanup; no raw snapshot or storage injection |
| Sentinel runtime target/protocol | `scripts/qa/runtime/QaRunSession.mjs`, `scripts/qa/resources/QaInitialWindowFocusAnchorLease.mjs`, `scripts/qa/resources/QaAttachedBrowserOsFocusGuard.mjs`, `scripts/qa/protocols/sentinelProtocolQaProtocol.mjs`, `src/domains/nudge/runtime/automation/sentinelProtocolQaAutomationContract.dev.js`, `src/apps/background/services/runtime/messageRoutes/sentinelProtocolQaAutomationMessageRoutes.dev.js` | exact trusted harness sender, stable HTTP(S) tab, agent-only one-time empty-window bootstrap followed by bounded background-focus proofs, canonical Site/Global host route, structured phase evidence, explicit STOP, and opt-in screenshots |
| Feed Horizon target/protocol | `scripts/qa/catalog/qaTargetRegistry.mjs`, `scripts/qa/protocols/feedHorizonQaProtocol.mjs`, `scripts/e2e/feedHorizonCausalE2E.mjs` | select human or agent mode, require the persistent authenticated environment, obtain the dev artifact lease, preserve the existing browser, and route ordinary inspection versus natural production-gate evidence into mutually exclusive completion contracts |
| Attached Reddit surface oracle | `scripts/qa/catalog/qaTargetRegistry.mjs`, `scripts/qa/protocols/siteRuntimeAttachedQaProtocol.mjs` | borrow one unique, already-open `/r/popular/` page in the authenticated managed-persistent browser; re-prove the browser on the exact CDP connection, attach for one DOM observation, detach, and require the PAGE target-set digest to remain exact without artifact, settings, navigation, activation, scroll, target-close, process-close, or OS-focus actions |
| Feed Horizon inspection engine | `scripts/e2e/feedHorizonInspectionE2E.mjs` and `src/domains/nudge/runtime-debugger/feed-horizon-inspection/**` | same-process arm/rearm/disarm, phase HUD, native endpoint morphology evidence, and feedback-only handoff; production builds receive the no-op alias |
| Feed Flow background source identity | `src/domains/tracking/background/trackingSpecialRuntimeHandlers.js`, `src/domains/protection/background/runtime/FeedFlowRuntimeStateOwner.js`, `src/apps/background/services/runtime/ProtectionRuntimeStateCoordinator.js` delegation facade | only a trusted top-frame `tabId + documentId + hostname` source may advance snapshot order or cumulative metrics; navigation fences the old document and same-host tabs never substitute for one another |
| Continuous-feed topology probe | `scripts/e2e/continuousFeedTopologyProbe.mjs` | extension-disabled, content-free X/Instagram/Facebook/YouTube DOM topology snapshots in one headless and audio-muted QA-browser process; this discovers candidate native seams but has no product-actuation authority |
| Artifact activation precondition | `src/domains/progression/policy/progressionUnlockPolicy.js`, `src/apps/background/services/runtime/messageRoutes/progressionMessageRoutes.js` | each scenario declares its canonical artifact family/day; `entriesByFamilyId[familyId].runtimeEligible` is checked before activation or cost judgment, while journey disclosure/day evidence remains separately reportable under pre-release open access |
| External measurements | `scripts/e2e/sites/siteRuntimeBrowser.mjs`, `scripts/e2e/sites/feedConsumptionValidation.mjs`, `scripts/e2e/sites/siteRuntimeMetrics.mjs` | trusted CDP stimulus, independent FeedFlow opportunity matching, CDP metrics, storage summaries, confirmed budgets, and approved-baseline comparison |
| Outcomes and artifacts | `scripts/e2e/sites/siteRunAnalysis.mjs`, `scripts/e2e/sites/siteRuntimeReport.mjs` | activation/effect/cost interpretation plus sanitized JSON and Markdown reports |

## One-Click Command

Artifact staging validates source manifest/trusted-page file shape before copying
and validates the staged files again before publication. Symbolic links (including
Windows junctions) are rejected at that boundary, before platform copy errors
can obscure the owning contract.

Run the default release-candidate suite in a visible browser:

```bash
npm run qa -- run site/release-core --mode=agent --headed
npm run qa -- run site/youtube-root-visual-continuity --mode=agent --presentation=hidden
npm run qa -- run site/scroll-runtime --mode=agent --measurement=contract --presentation=hidden
npm run qa -- run site/scroll-runtime --mode=agent --measurement=contention --samples=3 --presentation=hidden
npm run qa -- run site/scroll-runtime --mode=agent --measurement=benchmark --samples=5 --presentation=hidden
npm run qa -- run site/reddit-surface-attached --mode=agent
```

`site/scroll-runtime` keeps one canonical action script and selects an execution
profile at the QA boundary. `contract` uses one diagnostic-artifact run for
behavior and cleanup contracts without starting the Runtime Debugger or applying a
performance baseline. All three profiles use the diagnostic artifact because
the controlled Scroll Friction scenario owns a diagnostic-only stimulus seam;
`contract` and `benchmark`
still leave Runtime Debugger instrumentation off. `contention` starts the
Runtime Contention Timeline for owner attribution without applying an approved
baseline to the verdict. `benchmark` alone requires at least three repeated
samples and applies the approved median/p95 comparison. The profiles do not
run concurrently on the same browser capacity.

Defaults are `--lane=both`, `--repeat=1`, a disposable profile, existing
declared lane artifacts (`rebuild=false`), an automatic extension-disabled
control paired with `release`, and the run attachment directory as the report
parent. Use explicit `--repeat=3 --rebuild` only for a certification pass that
needs independent samples and fresh artifacts. The lower-level
`e2e:sites` engine remains available for site-level selections that have not
yet been promoted to named targets:

The named QA adapter accepts only one non-symlink owned report directory and a
regular non-symlink `report.json`. It validates the full schema-v1 aggregate,
including report-root and invocation identity, run/control rows, nonempty
coverage for every requested lane, identical scenario/repeat coverage across
lanes, exact release/control pairing, and a recomputed worst outcome. Suite
`WARN` and `INCONCLUSIVE` are projected as top-level `INCONCLUSIVE`; a zero
child exit code is not acceptance evidence by itself. The engine's canonical
exit `1` after a persisted `FAIL` report becomes top-level `FAIL`, while
exit/report disagreement is `QA_SITE_RUNTIME_CHILD_EXIT_OUTCOME_MISMATCH` and
a nonzero child without a valid owned report is
`QA_SITE_RUNTIME_CHILD_REPORT_REQUIRED_AFTER_NONZERO`. Typed infrastructure
failures remain infrastructure failures.

`site/reddit-surface-attached` is a separate access-and-DOM-opportunity oracle,
not an attached form of `site/release-core` or `targeting-core`. It requires the
operator to leave exactly one `https://www.reddit.com/r/popular/` page open in
the declared authenticated managed browser. After host-global capacity is
acquired, the protocol re-proves the declared browser tuple on the exact CDP
connection, attaches to that operator-owned page, takes one bounded DOM sample,
and detaches. The final `attachedBrowserObservation` receipt retains the
same-connection identity correlation, content-free browser-epoch digest, and
PAGE-set preservation proof. It does not build, stage, or reload an artifact; create, navigate,
activate, scroll, or close a target; issue settings or site-rule commands; close
the browser; or request OS focus. The PAGE target-set digest must be unchanged
after detach.

The target declares `extensionRuntime: none`: it does not require, control, or
attribute an extension runtime, while any extensions already present in the
operator profile remain untouched and may affect the page. Browsing can also
change cookies, cache, history, service workers, telemetry, or other
profile/site/runtime state. Those side effects are not measured or restored.
`attach_disconnect_only` proves the absence of a process-close action, not
external process liveness or OS foreground preservation. A `PASS` is limited to
normal route access plus post, metric, media, and text opportunities in the one
sample; it is not product-effect, disable/re-enable, clean-build, or owned
release-lane acceptance.

Catalog selectors remain separately reported primary evidence. An independent
semantic relationship oracle discovers bounded Reddit post roots from
same-origin `/comments/` permalinks, meaningful local text, and at least two
local vote/comment/time/media signals; its counts never depend on the catalog
post selector. If catalog coverage is zero but this relationship evidence is
positive, `structuralRecoveryUsed` and the corresponding degradation categories
must say so. Malformed or internally inconsistent observation shapes fail
loudly. This oracle reports recovery opportunity only and never rewrites the
product selector catalog.

```bash
npm run e2e:sites -- --suite=release-core --lane=diagnostic --site=youtube --repeat=1 --headed
npm run e2e:sites -- --suite=targeting-core --lane=diagnostic --site=reddit --repeat=1 --headed
npm run e2e:sites -- --suite=release-core --lane=release --repeat=5 --report-dir=/tmp/entropy-site-report
npm run e2e:sites -- --suite=feed-horizon-login --lane=diagnostic --site=instagram \
  --profile=/absolute/path/to/entropy-qa-profile --headless
npm run e2e:sites -- --suite=targeting-login --profile=/absolute/path/to/entropy-qa-profile --headed
npm run e2e:sites -- --suite=login-required --profile=/absolute/path/to/entropy-qa-profile --headed
```

For the bounded TikTok FeedFlow detector/oracle canonical acceptance entrypoint,
use the named diagnostic-only target. It selects only the existing
`release-core` TikTok scenario and defaults to three repeats. Each requested
repeat owns a fresh harness-launched browser and disposable profile epoch; the
epoch closes through the existing harness owner before the next repeat starts:

```bash
npm run qa -- run site/tiktok-feed-flow --mode=agent --rebuild=true --presentation=hidden
```

Do not substitute `site/feed-runtime` for this verdict. The contention target
preserves independent feed action observations for cost attribution, but its
scenario contract does not own the release-core `feed-consumption-exact-match`
verdict. The acceptance target retains the canonical TikTok settings, seven
trusted 1,100 ms steps, dominant-item oracle, and exact debugger-ledger matcher
without running unrelated release-core sites. It does not clear or reuse an
attached/persistent profile, and it does not add an adaptive input or retry.

The 2026-08-11 current-tree evidence is a correctness characterization rather
than a named-target acceptance PASS. Across three measured TikTok sessions it
observed 11 independent opportunities and 11 detector events: precision and
recall were both 1, with zero false negatives, false positives, or duplicates.
A fourth session had no independent transition opportunity and correctly
retained zero detector events as `armed_idle`; it is a no-false-positive control,
not a measured accuracy sample. Retained named-target cohorts had per-repeat
opportunity counts of `5/1/1` and `5/1/0`, so neither met the per-repeat floor.
Those cohorts predate repeat-browser isolation: all six repeats recorded exactly
seven wheel intents, but each cohort reused one browser/profile and the same
TikTok `sw.js` target while later-repeat page errors accumulated. The fresh-
browser first repeat in both cohorts produced five opportunities. Existing
research evidence also left all ten bounded ArrowDown recoveries armed idle, so
changing or retrying the trusted input is not accepted as the remedy. The
closure isolates the live-site origin/session lifecycle while preserving the
independent oracle, seven wheel actions, detector, and thresholds.
The 2026-08-12 bounded fresh-isolation invocation produced per-repeat
opportunity counts of `0/5/5`. The latter two repeats matched all ten measured
opportunities exactly once, with zero false negatives, false positives, or
duplicates. The first repeat kept one native winner through all seven trusted
wheel steps, so its `0/0` result is seven independently classified true-idle
steps rather than a detector miss. Each repeat used distinct verified browser
and disposable-profile epoch digests and completed exact cleanup.

That invocation's only hard contract was
`extension_uncaught_errors_absent`: superseded old-document protection work was
correctly fenced, but the typed expected/current-document mismatch escaped as a
`tabs.onUpdated` rejection or receiver-ready sync console error. The code-based
closure now consumes only a non-empty, distinct, tab-correlated old/current
document proof as `bootstrap_protection_sync_document_superseded`; same-document,
missing, malformed, URL-only, and attempt-only mismatches remain hard. Focused
dispatcher, transport, browser-event, catch-up, Gate, lazy-removal, and serial
queue regressions prove this boundary without relaxing the detector or gate.

The 2026-08-17 YouTube Shorts combined-contention follow-up closed the remaining
normal-navigation races without weakening the hard-error boundary. Exact
same-document URL work now settles only from private Dispatcher provenance plus
strictly monotonic receipt/admission/transaction/current session generations;
a `loading` receipt without ready identity additionally requires a private
recovery mismatch, current bootstrap identity, and exact-document URL probe.
Run `20260817125757525-site-feed-runtime-c3439aee` recorded zero background
browser-listener rejections, a PASS release lane, and a PASS extension-disabled
control. Its diagnostic lane remained WARN only because the visual scanner was
`armed_idle` with zero candidates, so duplicate/full-rescan absence was inactive
rather than measured. The Shorts paged-scroll contract measured seven intents,
seven commits, and zero physics frames.

Canonical named-target acceptance nevertheless remains pending: the bounded
invocation did not meet the minimum two opportunities in every repeat and was a
dirty diagnostic build. Per the bounded-gate policy it is not rerun repeatedly;
Phase 1/2 closes on code and exact available-opportunity correctness evidence,
while a clean-commit three-repeat PASS remains a later shipping gate.

For repeated scroll-cost attribution on one public feed, use the named control-
plane target rather than reconstructing the lower-level engine invocation:

```bash
npm run qa -- run site/feed-runtime --mode=agent --site=youtube --samples=3
npm run qa -- run site/feed-runtime --mode=agent --site=tiktok --samples=3
```

The target defaults to `--feature=combined`. For causal isolation, select one
canonical effect owner while preserving the same trusted feed actions and the
extension-disabled control:

```bash
npm run qa -- run site/feed-runtime --mode=agent --site=youtube --feature=scroll --samples=3
npm run qa -- run site/feed-runtime --mode=agent --site=youtube --feature=visual --samples=3
npm run qa -- run site/feed-runtime --mode=agent --site=youtube --feature=text --samples=3
```

`combined`, `scroll`, `visual`, and `text` are separate scenario identities.
Do not subtract their diagnostic owner totals from one another: those spans may
nest. Compare each release lane only with its repeat-matched control to measure
shipping renderer and Long Animation Frame deltas.

For the canonical YouTube Watch comment-load attribution target, preflight and
run the same bounded Social Metrics argument set through the control plane:

```bash
npm run qa -- doctor site/youtube-watch-runtime --mode=agent --presentation=hidden \
  --site=youtube --measurement=contention --feature=social --samples=3 --rebuild=true --json
npm run qa -- run site/youtube-watch-runtime --mode=agent --presentation=hidden \
  --site=youtube --measurement=contention --feature=social --samples=3 --rebuild=true
```

This target owns the `watch-runtime-public` paired diagnostic/release lanes and
the automatic extension-disabled control. Its bounded trusted comment-load
probe verifies exact `/watch` and video readiness, requires a comment
opportunity, and then measures Social Metrics activation, effect,
disable-cleanup, re-enable, and owner work without substituting a feed target or
an ad hoc browser invocation.

Pre-release `open` artifact access allows disposable unprovisioned release
profiles to execute every declared family. Pass a dedicated schema-v2 canonical
day-7 QA profile only when the run is intended to validate the seven-day journey
fixture itself or when `PROGRESSION_ARTIFACT_ACCESS_MODE` has been restored to
`JOURNEY_GATED`:

```bash
npm run qa -- run site/feed-runtime --mode=agent --site=youtube --samples=3 \
  --profile=/absolute/entropy-qa-profile
```

This target always selects the paired `both`-lane `contention` profile and one
public site. Every performed trusted wheel/key/touch action records the same
bounded action window in diagnostic, public release, and the automatic
extension-disabled control. CDP supplies renderer task, script, layout, and
style-recalc deltas for all three. Only diagnostic adds the Runtime Contention
union of instrumented Entropy owner spans on the same document monotonic clock.
The report therefore separates the observed public-minus-control delta from the
owner evidence that may explain it. Its renderer residual deliberately means
page + browser + uninstrumented Entropy, not proven page-owned time. The action
window contains the trusted input and its declared dwell but excludes the
independent feed-oracle readiness probes and the later contention-projection
request. No extra product DOM read is introduced by the owner projection.

Supported operator options are:

- `--lane=diagnostic|release|both`
- `--profile=<explicit QA profile path>`
- `--site=<site-id>`
- `--repeat=<1..20>`
- `--report-dir=<path>`
- `--keep-profile`
- `--headed` or `--headless`

On Linux, `--headed` requires an existing X11/Wayland display or an explicit
`xvfb-run` wrapper. The runner does not auto-launch a personal Windows Chrome
from WSL. An explicitly supplied browser must support unpacked extensions.
Chromium and Chrome for Testing use the normal command-line load path. Chrome
branded builds 137 and later ignore that path, so the harness uses the official
CDP `Extensions.loadUnpacked` command with unsafe extension debugging enabled,
targets the exact temporary extension directory, and uninstalls that temporary
extension before closing the browser. Branded Chrome must also have extension
Developer mode enabled; otherwise the runner rejects Chrome's provisional ID
when the exact extension does not become active and recommends Chrome for
Testing. An uninstall failure is a harness failure because a persistent QA
profile must not retain the temporary build.

`--no-build` is an advanced reuse mode. Every selected lane must then supply
its matching `--diagnostic-dist=<path>` or `--release-dist=<path>`. The runner
still validates `entropy-build-info.json` and rejects a lane/profile mismatch.

## Scenario Suites

The catalog validates every scenario at module load against
`SUPPORTED_SITE_IDS` and `resolveSiteId()` from
`src/domains/nudge/targeting/siteIdentityCatalog.js`. It rejects unknown sites,
non-HTTPS URLs/origins, caller-declared host permissions, undeclared
settings/activation contracts, or actions outside the bounded action
vocabulary. This validates site identity only; scenario oracles remain
independent and do not import product target classifiers.

| Suite / scenario | Site and feature group | Automated stimulus and effect evidence |
| --- | --- | --- |
| `runtime-contention` / `example-scroll-runtime-contention` | controlled example.com fixture; Scroll Friction plus bounded Text/Visual mutation work | two independent nested scrollers, initial-settle-isolated single ticks, continuous A/B probes with explicit 32-row DOM influx during active motion, reverse input, cross-scroller ownership, burst duration, wheel-input-to-first-frame/animation-frame timing, owner-span and Long Task overlap |
| `feed-runtime-public` / `youtube-shorts-scroll-runtime-contention`, `tiktok-scroll-runtime-contention` | public paged feeds; Scroll Physics + Text + Visual trusted-action attribution | the existing independent feed action/oracle contracts with dedicated Blur, Scroll Friction, and Text Rhythm activation plus paired diagnostic/release/control action counters, Long Animation Frame blocking evidence, privacy-bucketed script timing, instrumented Entropy owner-span union, and explicitly mixed renderer residual |
| `watch-runtime-public` / `youtube-watch-runtime-{combined,scroll,visual,text,social}` | public YouTube Watch page; isolated or combined runtime attribution | exact Watch-route/video readiness, bounded trusted comment-load opportunity, paired diagnostic/release/control cost evidence, selected-effect activation, disable cleanup, re-enable, and diagnostic owner-span attribution |
| `root-visual-continuity` / `youtube-root-visual-continuity` | public YouTube search-results page; isolated Grayscale ON / normal profile (50%) | trusted click on the same-origin YouTube Home logo, same-document/time-origin proof, per-animation-frame computed grayscale floor, and in-memory compositor-frame probe-pixel chroma floor; no captured frame is written to disk |
| `release-core` / `youtube-public-core` | YouTube; video skip, short-form, and social metrics | public video/Shorts navigation, safe play/pause/seek, scroll, reload, disable/re-enable; video/route/social effect evidence plus diagnostic conditional Short-form completeness proof |
| `release-core` / `youtube-shorts-feed-horizon` | YouTube Shorts; paged feed flow | bounded trusted wheels on the exact Shorts scroller plus independent opportunity and native sequence-lane evidence |
| `release-core` / `reddit-public-metrics` | Reddit; semantic social metrics | public feed scroll/reload and disable/re-enable; candidate/applied social-metric evidence |
| `release-core` / `tiktok-public-feed` | TikTok; paged feed flow | bounded trusted wheel-only steps plus disable/re-enable; independent opportunity matching plus click-delay/infinite-scroll activation and feed-flow evidence; PageDown is excluded because repeated live research showed no dominant-item transition while wheel input remained the stable desktop path |
| `feed-horizon-login` / `instagram-reels-feed-horizon` | Instagram Reels; authenticated paged feed flow | explicit QA profile only; bounded trusted wheels on the exact native snap lane, independent opportunity matching, and endpoint cleanup evidence |
| `feed-horizon-login` / `youtube-home-feed-horizon` | YouTube Home; authenticated continuous rich-grid feed flow | explicit QA profile only; root-scroller progression, direct current lockup candidates, completed flex-wrap row boundary, layout-preserving future-branch isolation, and full-width wrapped-row tail evidence |
| `feed-horizon-login` / `x-home-feed-horizon` | X Home; authenticated continuous feed flow | explicit QA profile only; root-scroller progression, exact absolute virtual-cell lane, layout-preserving future-cell isolation, and absolute native tail evidence |
| `feed-horizon-login` / `instagram-home-feed-horizon` | Instagram Home; authenticated continuous feed flow | explicit QA profile only; root-scroller progression, direct article-column containment, layout-preserving future-article isolation, and flow-tail evidence |
| `feed-horizon-login` / `facebook-home-feed-horizon` | Facebook Home; authenticated continuous feed flow | explicit QA profile only; root-scroller progression, batched role-article branch containment, branch-edge wait semantics, and flow-tail evidence |
| `release-core` / `example-generic-control` | `example.com`; generic Text Rhythm control | stable public control page, bounded reload/scroll, and text-effect/cleanup evidence |
| `targeting-core` / `example-text-targeting` | `example.com`; deterministic Text Rhythm positive control | stable heading/paragraph style delta across active, disabled, and re-enabled states |
| `targeting-core` / `youtube-*-targeting` | YouTube; isolated Blur or Text Rhythm | watch-page load, scroll/reload, disable/re-enable, independent positive target style delta, and avatar/input negative controls |
| `targeting-core` / `reddit-*-targeting` | Reddit; isolated Blur or Text Rhythm | public feed lazy content, scroll/reload, disable/re-enable, independent positive target style delta, and avatar/input negative controls |
| `targeting-core` / `tiktok-*-targeting` | TikTok; isolated Blur or Text Rhythm | public feed media/text loading with FeedFlow, click delay, social metrics, video skip, and short-form owners explicitly inactive |
| `targeting-login` / `x-*-targeting` | X; isolated Blur or Text Rhythm | explicit QA profile only; authenticated tweet media/text positives and avatar/input negatives |
| `targeting-login` / `instagram-*-targeting` | Instagram; isolated Blur or Text Rhythm | explicit QA profile only; authenticated post media/text positives and profile/input negatives |
| `login-required` / `x-login-metadata` | X; authenticated social metrics | metadata-only run in an explicit QA profile |
| `login-required` / `instagram-login-metadata` | Instagram; authenticated social metrics | metadata-only run in an explicit QA profile |
| `login-required` / `facebook-login-metadata` | Facebook; authenticated social metrics and Reels blocking | metadata-only run plus a bounded `/reel/` redirect and Short-form completeness proof in an explicit QA profile |
| `login-required` / `tiktok-login-protections` | TikTok; authenticated social metrics and recommendation-flow blocking | metadata-only run plus `/foryou` to `/explore` redirect, exact navigation pruning, and Short-form completeness proof in an explicit QA profile |

`release-core` never needs a personal browser profile. `feed-horizon-login`
is the one automated authenticated Feed Horizon suite: it fails closed without
an explicit dedicated QA profile and never reads credentials or attempts login.
It remains separate from `login-required`, whose entries are metadata-only.
`login-required` does
not enter credentials or bypass authentication; without an explicit QA profile
it writes an `INCONCLUSIVE / auth_required` takeover checkpoint without
starting Chrome or building the lanes. The automatic extension-disabled
control is public/disposable only. It never reuses a logged-in QA profile, and
is reported as `not_applicable` for `login-required`.

`targeting-core` is a correctness suite, not a personal- or approved-baseline
producer. Each scenario enables exactly one canonical effect (`blur` or
`textRhythm`) and explicitly disables every other filter. The browser probe
uses catalog-owned positive and negative oracle selectors rather than
re-reading the product's `visualMediaCandidates` or `textEffectTargets`.
Where a live site has no guaranteed selector-based negative peer, the exact
oracle schema may instead declare a closed QA-owned semantic negative control.
TikTok Text declares `html_video_element / minimum=1`; the probe resolves it by
HTML interface (`HTMLVideoElement`), never by importing or copying a product
media selector, and retains only visible positive-geometry instances under
`semantic:html_video_element:<ordinal>` keys.
Rendered positive samples must change across the active-to-disabled style
boundary and change again after re-enable. Rendered negative controls must stay
unchanged in both active-to-disabled and re-enabled-to-disabled comparisons
through the existing `targeting_negative_controls_unchanged` contract. A
semantic minimum that is not observed remains insufficient `WARN`, never PASS.
Missing positive samples or missing declared negative controls remain
explicit insufficient `WARN` evidence; scenarios that intentionally declare no
negative control report that portion as not applicable. An observed positive
miss or changed negative control is a correctness `FAIL`. Samples retain only
bounded selector ordinals and computed style values, never page text or media
URLs.

The 2026-08-11 current-tree release acceptance had zero correctness `FAIL`
contracts. Example, YouTube, and TikTok each passed positive effect, scoped
disable cleanup, re-enable, and every declared independent negative comparison.
Reddit Media/Text remained `INCONCLUSIVE / http_403` before opportunity
measurement, so the result is not evidence for or against its selectors. The
2026-08-12 operator diagnosis then opened the same `/r/popular/` route in the
headed managed-persistent QA Chrome through the product-QA-protocol-free
`browser page` owner. The signed-out page rendered a normal feed; Reddit itself
declined login as a risky sign-in, so no credential or authentication flow was
attempted. The contrast with the disposable/headless extension-disabled 403s is
diagnostic evidence consistent with an execution- or profile-trust difference,
but it neither isolates the cause nor proves anything about Entropy's product
effects. The manual page is not formal release acceptance. The named
`site/reddit-surface-attached` target makes only the narrower access and
structural-opportunity observation canonical; even its `PASS` cannot replace
the owned release lane, native extension-disabled baseline, or disable/re-enable
effect gate. The original suite-wide outcome therefore remains inconclusive and
a clean-commit owned-lane rerun remains the shipping gate.

Readiness-condition phase ownership is explicit. Document state, route, and
media readiness contracts use the bounded readiness observation that admitted
the site flow. A `selector_any_present` opportunity contract instead uses the
canonical post-activation settled observation and records
`observationPhase: active_settled`. Broad site-shell readiness can precede an
asynchronously hydrated target, so the earlier readiness snapshot cannot own
the final selector verdict. This is not an OR fallback and does not demote a
miss to `WARN`: zero matches in the active-settled observation remain `FAIL`
even when the earlier readiness snapshot contained a match.

`targeting-login` uses the same single-effect and independent-oracle contract
for X and Instagram, but remains metadata-only until the operator supplies an
explicit QA profile. It never reads credentials or attempts authentication.

### X and Instagram selector-drift candidate corpus

`site/social-selector-drift-corpus-authenticated` is the independent Phase 4
candidate collector for X post actions and Instagram feed, Reels, profile,
grid, and post-dialog surfaces. It is not a product-effect test. The protocol
creates exactly one owned background page in the managed authenticated browser,
navigates it without target activation, enables page execution inside the
owned CDP session without OS focus, collects bounded redacted structure, closes
the exact page, and proves the prior page-target set unchanged.

The product Social Metrics resolver is never imported. X and Instagram action
identity, numeric-leaf uniqueness, profile clusters, grid-hover opportunity,
and dialog ambiguity are recomputed by an observation-only oracle. X, Instagram
feed, and Reels can pass with a unique Like metric. The combined profile/grid/
dialog case remains inconclusive unless all three strata are observed and the
opened dialog exposes one uniquely owned Like metric. This prevents a nearby
caption, comment count, or unowned number from being laundered into recovery
evidence.

The 2026-08-14 candidate corpus contains seven human-reviewed fixtures: five
positive owner-local targets and two ambiguity/fail-closed cases. The real
product owner produced zero false positives, zero false negatives, zero
duplicates, and exact apply/restore/re-enable parity across the seven fixtures.
Live X, Instagram feed, and Reels observations passed; the live Instagram
profile/grid/dialog run remained correctly inconclusive at the dialog ownership
gate. These results are `candidate_only` and do not authorize an automatic
profile update.

## Paired Measurement Lanes

| Lane | Artifact contract | Evidence |
| --- | --- | --- |
| `diagnostic` | isolated unpacked build with `ENTROPY_RELEASE_PROFILE=dev` | canonical Runtime Debugger snapshot/report plus the same CDP measurements used by release |
| `release` | isolated exact build with `ENTROPY_RELEASE_PROFILE=public` | CDP heap, DOM, long-task, worker, storage, lifecycle, and error evidence only |

`control` is intentionally not accepted by `--lane`. It is an automatic
companion measurement when `release` is selected for `release-core`. The
harness starts a separate disposable Chrome with `--disable-extensions`, does
not copy or promote a manifest, does not install Entropy, and opens ordinary
CDP page targets without a trusted extension page. One inert `about:blank`
target remains open for the whole control lane so every repeat uses the same
Chrome process; scenario targets still close after each repeat, and the
harness closes the sentinel and browser together at lane teardown. It repeats
the release lane's public navigation, reload, scroll, click, and media actions.
Entropy settings disable/re-enable phases are `not_applicable`; their product
cost is therefore part of `release - control`. The control attempts to match
the total release observation window and records clock drift, but live-site
phase timing is still noisy.

The release artifact must pass
`scripts/ci/check-public-build-debug-surface.mjs` before Chrome starts. The
public aliases expose no automation actions and no functional debugger relay;
the harness must never add Runtime Debugger code back to a public artifact.

Both product lanes run the same catalog scenario and bounded stimulus. The runner copies
each selected artifact to a temporary extension directory and promotes only
`scripting` plus exact `https://host/*` permissions derived from the selected
scenarios' declared URL origins and explicit redirect origins. It does not add
HTTP schemes, apex hosts, or wildcard subdomains. It never widens the checked-in
manifest or the source build output. The production dispatch permission gate
checks the exact current-tab origin, so an exact grant is not misclassified as
missing merely because it does not cover another scheme or subdomain.

Scenario actions run in their declared order. A bounded `wait` is a synchronization
step, not a page interaction; it lets a declared navigation expose lazy content
before the next bounded scroll. Diagnostic sessions rotate only around declared
navigation/reload boundaries, so scroll and media evidence stays attached to the
document in which it occurred. Feed-consumption actions use CDP trusted wheel,
key, or touch input; page-script `window.scrollBy()` remains available only to
non-FeedFlow generic scenarios and is not accepted as FeedFlow opportunity
proof. Media playback is started only through a
catalog-declared visible control and a CDP trusted primary click; the harness
does not call page-script `video.play()` to manufacture user activation. The
action records whether playback was already active, whether a trusted click was
required, and whether playing state was observed before its bounded dwell. A
trusted seek retains its bounded revert
observation window, then restores only the same media element's pre-seek
paused/playing state. The action report records whether restoration was
unnecessary, succeeded, failed, or was unavailable; restoration does not add
navigation, clicks, or any account-changing interaction.
Catalog actions marked `requiredForEvaluation` must complete before their
feature contract is considered evaluable. If a live-site or media-delivery
condition makes that stimulus unavailable, the run retains all collected
activation, effect, and cost evidence but is classified
`INCONCLUSIVE / required_scenario_action_unavailable`; a performed stimulus
followed by an incorrect feature effect remains a correctness `FAIL`.

Before applying scenario settings, the diagnostic lane explicitly selects the
dev-only `develop` projection at the largest disclosure day required by the
catalog. It never relies on the build:dev implicit day-7 default. During
shutdown it writes explicit `canonical` mode; deleting the session record would
restore that development default. The release lane never calls any progression
debug route. A fresh disposable release profile uses the public
profile-generation readiness and First Vision commands to disclose only the
canonical starter Lens family. Later Barrier or Veil scenarios remain
`INCONCLUSIVE / artifact_disclosure_locked` until a normally progressed,
explicit QA profile makes those families runtime-eligible. This state is not an
activation failure and its zero work is never judged efficient. For an explicit
persistent QA profile the runner only reads the canonical artifact-disclosure
snapshot; it never advances First Vision or progression.

In the diagnostic lane the trusted extension harness page sends a typed request
through background and content relays to one explicit target tab. The contract
supports `DEBUG_RUNTIME_SESSION_START`, `RESET`, `SNAPSHOT`, `REPORT`, and
`STOP`. The route verifies the extension id, trusted extension-page origin and
path, HTTP(S) target tab, stable target URL, and main-frame delivery. It does not
use page-world globals or scrape the Runtime Debugger Shadow DOM.

Scenario settings writes explicitly request a bounded wait for the canonical
`BackgroundSettingsPropagationCoordinator` task. Persistence acknowledgement
remains separate from propagation completion: the report records `succeeded`,
`failed`, or `timed_out`, then independently verifies that the disabled effect
was removed from the target document before cleanup can pass.
The settled coordinator receipt is the completion authority because content
runtime dispatch events do not carry a task or commit correlation key. A
`succeeded` receipt with `broadcast: true` and no failures is therefore not
overturned by an uncorrelated retry-attempt event. While only a scheduled
receipt exists, the bounded waiter uses the latest target dispatch terminal
event after its cursor: an intermediate `dispatch_failed` remains pending for a
later `dispatch_succeeded`, while a failure that is still latest at the timeout
remains fail-loud.

Targeting style coverage uses the same activation state as the enclosing
observable-effect contract. An active-settled positive miss is still `FAIL`
after measured activation. When activation itself remains `armed_idle`, the
initial positive comparison is `WARN / armed_idle`; disable and re-enable are
still measured independently, and an available re-enabled positive comparison
must satisfy its existing hard coverage contract.
The release lane does not promote a last-read background strategy into a
document-correlated activation failure: that snapshot has no matching content
envelope revision, dispatch acknowledgement, or opportunity identity. Initial
activation latency therefore remains a separate `WARN` when it is not measured.
Conversely, exact active-settled style, owned-root, or applied-target evidence is
physical effect authority and cannot be downgraded by that uncorrelated latency
state. A hard initial lifecycle failure requires a diagnostic lane proof that
correlates the same document, opportunity, activation envelope, and settle
window; re-enable coverage remains hard in either lane.

Navigation and reload replace the content-script world. The runner closes the
current canonical debugger session at each document boundary only after its
pending queues settle, retains its owner-produced evidence, waits for the next receiver-ready document, then
starts and resets the same Runtime Debugger owner before continuing. Reports
keep these lifecycle segments separate from the final live segment. The final
settled `SNAPSHOT` payload is the segment measurement SSOT; the later `STOP`
response only acknowledges that segment's termination and never replaces the
accepted settle endpoint. The final live session separately reports its
post-measurement `REPORT`/`STOP` overhead. Before each
reset baseline, the runner requires the current debugger session's pending
queues to settle. This prevents work admitted before the measurement epoch from
appearing after reset without its causal flush identity. Event contracts search
all retained document-session payloads, while state/path contracts continue to
read their declared current or final-settle snapshot. Every retained segment's
settle result and code-owned scanner structural checks are promoted into the run
contracts, so an earlier route cannot hide a duplicate scan or avoidable full
rescan behind a clean final document. When Text Shuffle is active, settle also
requires its pending text nodes, subtree roots, subtree tasks, flush timer, and
idle chunk to clear. Each diagnostic settle retains a bounded attempt trajectory
containing only elapsed time plus numeric/boolean ObserverHub, Social Metrics,
and Text Shuffle pending signals. The trajectory preserves the first and most
recent attempts when bounded, contains no URL, page text, DOM content, or user
data, and is explanatory evidence only. It never replaces the final settled
`SNAPSHOT` as the measurement SSOT, and the existing five-second timeout and
FAIL contract remain unchanged.

## Activation, Effect, and Cleanup Judgment

Diagnostic scenario settle conditions may explicitly declare `waitTimeoutMs`
(integer 1–30,000) for current-value `debug_path_equals`, `debug_path_in`, or
`debug_paths_match` conditions. The final re-enabled segment waits on those
conditions using the same canonical debugger snapshot and condition evaluator
as acceptance. Media recheck conditions declare 18,000ms, covering the existing
15-second product load grace with a bounded scheduling margin. An empty media
queue is still required: deadline expiry retains the condition's WARN/FAIL and
last observed value. Missing evidence never becomes a measured zero.

Core ObserverHub/Social/Text settle retains its five-second budget and failure
semantics. A media wait cannot extend a still-unsettled core queue past that
deadline. `conditionWait` separately records condition budgets, pending ids,
deadline expiry, and elapsed time; the bounded trajectory now includes numeric
`visualPendingRechecks`. The accepted final SNAPSHOT remains the measurement
endpoint. Additional wait time is part of the diagnostic measurement window,
not an improvement in product latency; a changed scenario fingerprint requires
a new compatible baseline. Release runs do not read debugger state or inherit
this diagnostic wait.

Page network errors use `page_network_errors_absent` while page execution
errors retain `page_uncaught_errors_absent`. Both remain WARN unless the
scenario explicitly declares the source advisory. Reports include source/kind
counts without page content. Extension errors remain a separate hard FAIL;
network classification is not proof that an effect succeeded.

The evaluation order is contractual:

1. Confirm every scenario feature's canonical artifact family is
   `runtimeEligible`; record locked families before attempting activation.
2. Confirm the protection envelope's exact `activeFilterKeys` before reading
   efficiency counters.
3. For Social Metrics, also confirm exact `activeMetricKeys`,
   `compiledPlanCount`, and `observerAttached`.
4. Confirm the catalog's observable effect after representative stimulus.
5. Disable the feature and confirm cleanup, then re-enable and confirm renewed
   activation. Scenario-specific navigation, reload, and scroll actions run in
   the same flow.
6. Confirm pending work returns to the settled state and close the target page
   before worker-cardinality checks.

Tab admission is an explicit lane contract before those product checks. A
diagnostic artifact must return `diagnostic_tracking_admission` from its
development-only owner, including exact `trackingObserved` evidence. A public
release artifact has no such route: the owned ephemeral harness activates only
its target-ledger page with trusted `chrome.tabs.update`, confirms the exact
active tab with an independent `chrome.tabs.query`, and returns
`release_external_active_tab`. Release never treats a missing debug response as
a reason to add the route to the public bundle or to fall back to diagnostic
evidence. The content-free `scenario_tab_activation_proof` run contract records
only the lane's required boolean proof and `windowFocusRequested: false`; it
does not promote the other lane's oracle. Both paths forbid OS-window focus,
and the attach-only browser lifecycle remains outside this disposable site-run
lane.

Root signals are presence-based unless a scenario declares
`observableEffects.rootAttributeActiveValues`. That map gives each owned root
attribute its exact active value and is reused by disable-cleanup judgment.
Therefore a retained diagnostic state marker such as
`data-click-delay-active="none"` is reported in `rootAttributeValues` but does
not masquerade as an active owner or a cleanup failure.

The YouTube public scenario additionally declares a generic layout-cycle
oracle for metadata-row collapse, user-settings restore, and re-enabled
collapse. Its typed `youtube_watch_info_view_time_only` classifier transiently
reads accessible leaves only inside `ytd-watch-info-text`. It accepts an
explicit Korean or English view count plus a strict Korean or English relative-
time signal, rejects a row with any additional non-metric text leaf, and never
uses an owner marker as classification input. The native opportunity classifier
never consults an extension owner marker.
The owner marker proves that Social Metrics claimed that independently observed
opportunity; independently declared watch-metadata candidates prove the actual
layout. The probe retains only strict content-free counts: native opportunities,
collapsed owned containers correlated to the exact same native-opportunity row,
visible native opportunities, document marker count, total
restored candidates, candidates carrying the marker themselves, unique marker
descendants inside candidates, declared container markers, visible declared
container markers, collapsed owned-metadata containers, visible restored
candidates that are the same as or an ancestor of a collapsed owned container,
directly marked candidates that remain visible, all `display:none` plus
zero-geometry candidates, and visible restored candidates. A collapsed owned-metadata
container must itself carry the collapse marker, directly match one of the
scenario's independently declared `collapsedContainerSelectors`, contain a
distinct descendant with an extension-owned Social metric marker, and have
`display:none` with zero geometry. It receives PASS authority only when that
exact container is also the independently classified native-opportunity row.
YouTube bounds those container identities to
watch-info, scoped legacy metadata, structured metadata-row, and scoped
`[role="group"]` variants. Candidate ancestry is diagnostic evidence only; it
cannot grant container identity, but a visible restored candidate that contains
an accepted collapsed container proves residual layout and is FAIL. Every
declared collapsed-container selector is also required to be a restore candidate
so that this accounting cannot drift. This excludes arbitrary nested wrappers as well as
individual metric, delimiter, and icon markers from container authority. The
probe retains no page text, raw URL, or DOM identity; raw accessible text exists
only transiently inside the page evaluation.

`layout_cycle_active_collapsed`, `layout_cycle_disabled_restored`, and
`layout_cycle_reenabled_collapsed` are appended to observable-effect contracts
only when a scenario emitted layout-cycle observations. Any visible exact
declared-container marker, any visible restored ancestor retaining space around
an accepted collapsed container, any exact declared-container marker surviving
disable regardless of geometry, or a present disabled candidate that remains
invisible is FAIL. Active and re-enabled collapse passes only with an exact
collapsed owned-metadata container correlated to the same native-opportunity
row, no visible declared peer, and no visible layout-bearing restored ancestor.
The disabled phase also requires the native row and each of its classified
signal leaves to be visible; a visible outer row with a retained hidden signal
is FAIL. Without an independently classified native opportunity, document-
global markers, outer candidate-descendant relation alone, and individual
metric/delimiter/icon markers remain WARN-only non-evaluable evidence. Once the
native opportunity exists, a missing owner marker, descendant-only marker, or
collapsed owner container on a different row is FAIL rather than an acceptance
warning. An unrelated visible sibling does not become an ancestor failure. A
missing independently classified live opportunity
or missing restore candidate;
a non-layout-oracle scenario receives no layout-cycle contracts.

If the lazy Social Metrics owner becomes active after the initial debugger
baseline, an exact owner operation delta cannot be proven. That stale-baseline
shape is
`broken / targeting_health_probe_contract_invalid`, not a cumulative count from
the latest snapshot. During pre-baseline settle, the runner permits one
diagnostic `RESET` and one re-settle only when the last payload proves that exact
Social transition, every physical pending field is known-settled, and every
other required owner is settled. The normal measurement `RESET` then establishes
the measurement baseline. During active-stimulus capture, the existing bounded
rebaseline path applies another bounded stimulus before recapture. A failed
re-settle, malformed health/counter evidence, or another broken or unavailable
owner remains fail-loud and receives no further reset.

Baseline-settle exceptions retain only fixed content-free evidence: aggregate
state/reason, allowlisted owner `state`, `reason`, `ownerState`, `ownerReason`,
unsettled/unavailable field ids, and the exact Social/Short-form targeting-health
contract-error provenance. Page text, URLs, selectors, DOM identity, and unknown
owners or fields are not retained.

Runtime Debugger validity remains explicit: `inactive`, `unavailable`,
`armed_idle`, `insufficient`, `broken`, or `measured`. Release-lane debugger
availability remains `not_in_release`. Social Metrics and Short-form health
probes additionally require exact probe-status/health-validity agreement, and
`measured` requires a positive nonnegative safe-integer session operation
count. The operation count is owner scan work, not an opportunity denominator:
an independent `armed_idle` opportunity ledger can coexist with positive owner
scans that found no opportunity. The site-run analyzer revalidates these
relations instead of coercing malformed or fractional counters to zero.

Canonical Social inactivity passes only with the owner-local exact inactive
envelope. If that inactive owner was absent from the debugger baseline, then
the unloaded baseline must contain no operation-counter alias or retained
recent/audit work evidence. The loaded snapshot must keep `active`,
`activeEngagement`, `activeExposure`, active metric keys, active scan groups,
compiled plan count, metric-root selector length, and observer attachment in
one exact inactive shape. Every present lifetime `operations`,
`stats.operations`, and `stats.scanOperations` alias must remain a mutually
equal nonnegative safe integer, but retained lifetime scan, cleanup, timing,
audit, and recent-operation evidence is diagnostic context rather than a
current-epoch verdict. Lazy inactive authority comes only from the
diagnostics-runtime-owned nonnegative safe-integer
`measurementEpochOperationCount` paired with its exact
nonnegative safe-integer measurement-epoch identity, and the epoch count must
not exceed the validated lifetime operation count. Zero is explicitly `not_required_inactive`;
positive exact epoch work is preserved as `measurement_epoch_exact`. Missing or
malformed epoch evidence remains fail-loud. When both lifetime counters exist
and are monotonic, the exact inactive delta stays visible for diagnosis. An
active owner with a missing baseline, or an active owner with a missing,
malformed, or regressed counter, remains fail-loud. An active owner envelope
paired with canonical inactivity remains an activation mismatch. This narrow
inactive epoch rule is not a counter fallback and does not convert active owner
failure into a valid measurement.

Short-form correctness is conditional on observed opportunity, not on a brittle
assumption that every route must render a Shorts shelf immediately. The dev-only
oracle observes the same bounded scenario window through the shared
`ObserverHub`, but keeps its opportunity classifier separate from the product
prune rule. Both owners observe `href` as well as child-list mutations. The
product classifier promotes a changed link to its allowlisted media wrapper;
the broad legacy `ytd-rich-item-renderer` wrapper is admitted only on an
explicit channel Shorts route. A wrapper must contain a resolved YouTube
`/shorts/<media>` link and no `/watch`, `/live`, or `/clip` media link. This
keeps community posts and mixed/non-Shorts cards outside the destructive
surface. Product hides are reversible: when YouTube recycles the same wrapper
into a non-Shorts card, the owner removes its marker and records a `restored`
operation.

The aggregate accepts `siteId: null` only for canonical `inactive` or
`unavailable` segments, where no site-scoped Short-form owner is required.
`armed_idle`, `insufficient`, `broken`, and `measured` segments remain
site-scoped and fail closed without a non-empty `siteId`; inactive/unavailable
segments also do not participate in cross-site identity comparison.

With no opportunity the oracle reports `armed_idle` and the site contract is
WARN, never PASS. When opportunities exist, every current opportunity must
reach a hidden or removed terminal effect after settle; a remaining visible
target is `broken`/FAIL. A terminal effect is `measured` only when an Entropy
owner marker or a Short-form-owned WeakMap tuple on the exact owner target
matches a retained owner operation by generation, operation id, flush id,
delivery sequence, and action. A card removed with its owner shelf may inherit
that proof only through its actual retained DOM ancestor chain and an owner
`mode=remove` tuple. A sibling or unrelated target in the same flush cannot
inherit it.
The WeakMap retains no page copy and is neither iterable nor an automation API;
the public build resolves the seam to a stateless no-op.
The oracle validates the resolved YouTube/Instagram/Facebook/TikTok host and does not treat a
detached anchor or an arbitrary marked descendant as product proof. A connected
wrapper that stops being a Shorts opportunity is excluded from the current
opportunity denominator only when it had prior product proof and the same
target carries an exactly matched owner `restored` operation. Reports therefore
retain `observedOpportunityCount`, `opportunityCount`, and `retiredCount`
separately. Unproven terminals and bounded-ledger/query gaps are
`insufficient`/WARN. Reports retain only structural evidence categories and
generated node ids, not page text or raw URLs, and list oracle probe/snapshot
time as debugger overhead.

FeedFlow correctness uses a separate action-boundary oracle rather than asking
the browser-driving agent or the product detector to grade itself. For every
catalog-declared `feedStepId` in the diagnostic lane, the harness first waits
within the catalog-declared bound until a dominant visible candidate is
measurable and the same opaque dominant token survives the declared consecutive
stability-sample count, uses that successful sample as the pre-input boundary, dispatches
one trusted bounded input, waits the declared dwell, and requires the same
stability condition again for the post-input boundary. A transient hydration
signature therefore cannot end one action and push the product's settled
transition into the next action. It does
not spend a trusted gesture while the page is merely selector-ready but the
consumption oracle is still unobservable. The oracle retains only a page-session pseudonymous
token and scalar geometry counts. It binds a page-session alias to the one-way
content signature so a virtualized card remount does not become a false
transition, treats the first empty-to-known signature hydration on an existing
node as identity initialization, falls back to a page-session node token only
when no signature exists, and gives a visible,
ready, currently playing media candidate precedence over geometry ties. Sampled
raw URLs, text, and DOM references do not enter the report. Release and control dispatch the same input
without oracle reads, so shipping cost samples do not include oracle layout
work. Diagnostic action evidence reports readiness-probe count/wait, pre-boundary
probe time, post-boundary probe time, and their total, including the
content-signature/node-fallback and active-media
evidence categories. A changed paged dominant token, or the
declared continuous/hybrid viewport progress, creates one measured opportunity.
No movement is `armed_idle`, not a false negative. An unavailable sample or
unperformed trusted input is `insufficient`.

The dev-only FeedFlow ledger retains at most 32 mixed semantic intent/advance
events, matching the Runtime Debugger transport bound, and keeps scan cost as
scalar counters instead of filling the event ring. Confirmed advances also have
their own 32-entry ring and retention ledger, so scroll-intent volume cannot
silently evict correctness evidence. A separate 24-entry dominant-scan trace
retains only timestamp, counts, active-media ownership, and a one-way opaque winner token so
detector/oracle disagreements are auditable without exposing the underlying
item key.
Each confirmed paged advance also retains its owning gesture sequence/kind,
confirmation path and delay, previous/current opaque winner tokens,
active-media state, bounded identity-source class, and media-change flag in the
independent 32-entry advance ring. This causal capsule survives dominant-scan
trace eviction, but still contains no raw item identity, URL, selector, text, or
DOM reference.
Both sides admit only paged-content route links as stable link identity; generic
profile/share links are excluded, and media fallback strips query/fragment
churn. This keeps the oracle independent while preventing auxiliary-link
replacement from becoming a false consumption opportunity.
It records input kind/direction, exact confirmed advances, dominant-scan
raw/collapsed/nested candidate and geometry-read counts, mutation-discovery
breadth, scan elapsed time, and paged-scan
scheduling/coalescing/execution plus same-gesture transition suppression. On a
paged surface, native scroll-snap motion schedules settled observation but does
not create another demand gesture. A shared-observer paged mutation batch also
reschedules that bounded scan while the explicit gesture is recent even when it
adds no new candidate, covering virtualized attribute/media swaps without a
second observer. Before the first transition is confirmed, the same single
timer owner preserves the earliest already-scheduled 140 ms scan instead of
letting continuous mutation churn move it toward the deadline. If that scan
finds no transition, the owner retains one final confirmation at the 1,400 ms
owning-gesture deadline. After a same-gesture transition is confirmed, later
winner observation returns to trailing-edge coalescing rather than repeatedly
executing immediate scans, but any changed winner remains provisional and is
not committed into the adapter baseline. Timer callback lateness is added to
the scan timestamp so tempo dwell is not backdated to an ideal schedule.
Before the first explicit gesture, the same timer also caps baseline settlement
at 320 ms so page-load mutation churn cannot leave the adapter unseeded.
One catalog input can therefore produce at most one confirmed
transition. Immediately before the next explicit demand changes the DOM, the
owner non-emittingly reconciles the current settled winner into the adapter
baseline; a transient same-gesture winner cannot return as a zero-delay
next-gesture transition. Surface start/reset and gesture-outside settled
mutation or media-play observations also seed that identity without emitting an
advance, so the first trusted step has a product baseline. The TikTok diagnostic dwell is
1,100 ms and is followed by stable post-action sampling; the matching window
stays with that step until the next trusted input, so the final confirmation
remains in its owning interval. The public alias disables all recording. The
diagnostic matcher requires exactly one retained advance in each measured
opportunity window: zero is a false negative, more than one is a duplicate, and
an advance during an `armed_idle` step is a false positive.
If fewer than two independent oracle transitions occur, a still-warming
readiness/capability result is reported as `WARN` with
`measurementState=workload_insufficient`, never as PASS. Exact detector matching
remains independently enforceable; with two or more opportunities, an unmet
readiness contract remains FAIL.
The report includes every step's action bounds, matching window, matched event
timestamps, the advance timeline, and the bounded dominant-scan timeline.
Advance-ring retention loss or missing oracle evidence is WARN/`insufficient`;
mixed-ring intent loss remains explicit but does not invalidate complete
advance evidence. A measured
mismatch is FAIL/`broken`. Detection correctness stays separate from Terminus
actuation and from cumulative semantic counters.

The active-stimulus Runtime Debugger payload also carries
`feedFlow.episode`, projected by `EnsoRuntimeEpisodeManager`. The TikTok report
must read `admission.status`, exact `blockers`, surface-entry grace, endpoint
resolution, and the `observing → withheld → endpoint_pending → feed_drying →
feed_dry → enso_pending` phase from that owner. `FeedFlow.semantic.state` remains
useful detector context but is not the Horizon presentation authority. The
short lane requires the admission owner to produce either an exact `withheld`
or `admitted` result; it does not require presentation because a bounded lane
cannot guarantee natural dose+seam placement, endpoint resolution, travel to the
actual dry boundary, and renewed demand. A withheld result retains the
dopamine-binge, readiness/safety/capability, two-minute semantic-surface grace,
and spawn-policy blockers as evidence. The separate conditional
`feed-horizon-presented` check remains `WARN` when admission is not reached,
not evidence that an unlocked Veil failed to mount.

The short `e2e:sites` lane deliberately does not force the full user-visible
Horizon journey. Native endpoint morphology and the complete causal chain have
a separate, opt-in diagnostic owner:

```bash
npm run e2e:feed-horizon -- --dry-run-only --headless
npm run e2e:feed-horizon -- --skip-dry-run --headless \
  --max-minutes=10 --dwell-ms=2600
npm run e2e:feed-horizon -- --profile=/absolute/path/to/entropy-qa-profile \
  --chrome=/absolute/path/to/chrome --headless --skip-dry-run
npm run e2e:feed-horizon -- --site=youtube --dry-run-only --headless \
  --profile=/absolute/path/to/entropy-qa-profile \
  --chrome=/absolute/path/to/chrome
npm run e2e:feed-horizon -- --site=instagram --dry-run-only --headless \
  --profile=/absolute/path/to/entropy-qa-profile \
  --chrome=/absolute/path/to/chrome
npm run e2e:feed-horizon -- --site=x --dry-run-only --headless \
  --profile=/absolute/path/to/entropy-qa-profile \
  --chrome=/absolute/path/to/chrome
npm run e2e:feed-horizon -- --site=instagram-home --dry-run-only --headless \
  --profile=/absolute/path/to/entropy-qa-profile \
  --chrome=/absolute/path/to/chrome
npm run e2e:feed-horizon -- --site=facebook --dry-run-only --headless \
  --profile=/absolute/path/to/entropy-qa-profile \
  --chrome=/absolute/path/to/chrome
npm run e2e:feed-horizon -- --site=youtube-home --dry-run-only --headless \
  --profile=/absolute/path/to/entropy-qa-profile \
  --profile-directory='Profile 1' \
  --chrome=/absolute/path/to/chrome
npm run qa -- run feed/instagram-reels --mode=human
npm run qa -- run feed/instagram-reels --mode=agent
npm run e2e:feed-horizon:topology -- \
  --sites=x,instagram,facebook,youtube \
  --profile=/absolute/path/to/entropy-qa-profile \
  --profile-directory='Profile 1' \
  --chrome=/absolute/path/to/chrome \
  --headless
```

The first command uses a typed, dev-only Runtime Debugger action to arm the real
endpoint lease without changing production admission thresholds. TikTok is the
default; `--site=youtube` selects the canonical
`youtube-shorts-feed-horizon`, while `--site=instagram` selects the authenticated
`instagram-reels-feed-horizon`. `--site=x`, `--site=instagram-home`, and
`--site=facebook` select the existing authenticated continuous Home scenarios;
`--site=youtube-home` selects exact YouTube `/` and never Subscriptions/Search.
Every authenticated site key requires an explicit QA profile; the runner never
reads credentials or performs login. When the authenticated Chrome user-data root
contains more than one browser profile, `--profile-directory` is mandatory operational
evidence for the intended profile and is forwarded to the same browser process used by
`arm` and `rearm`. Inspection and topology runners default to headless execution;
opening a test window requires the explicit `--headed` flag.

`npm run qa` is the canonical repeated-inspection entrypoint. Ordinary `feed/*`
targets accept only an explicit `--mode=human|agent` and target-owned experience
settings such as `--hold-ms` or `--dwell-ms`. Machine-specific browser paths
live in the ignored `.artifacts/entropy-qa.local.json`; callers do not
reconstruct low-level profile, Chrome, CDP, artifact, or site-id arguments.
The attach-only environment is preflighted before artifact work. The dev
artifact lease fingerprints its declared source inputs, reuses only the exact
matching build id, and fails if inputs change during a rebuild.
`rebuild=false` is a cache-reuse preference, not a prohibition on building: a
missing output, stale input digest, mismatched output path, or mismatched build
id causes one canonical dev bundle build before the stable slot is staged.

`--mode=human` emits `READY_FOR_HUMAN` without synthetic feed input, inspection
arm, endpoint commit, or boundary arrival. The operator scrolls the native feed;
after the configured number of confirmed human advances and ready/safe endpoint
evidence, the harness arms inspection without moving the feed. Continued human
input then reaches the native endpoint and boundary normally. No `warmup`, `arm`,
`rearm`, or `status` command is part of the handoff. The passive human wait has
no wall-clock expiry: it remains attached until confirmed human advances arm the
inspection, or until explicit stop/tab/browser lifecycle cleanup cancels it.
For the ordinary `feed/*` targets, `--mode=agent` drives synthetic warmup,
boundary, hold, feedback-only renewed demand, morphology evidence, and cleanup,
then exits with `AGENT_CANARY_COMPLETE`. That completion marker also carries the content-free
FeedTempo measurement selected from the current or latest episode. The protocol
requires observe-only IndexedDB ownership, at least one eligible dwell, an
eligibility window containing the requested `--dwell-ms`, the canonical
two-second rapid threshold, zero bounded-canary retention loss, full retention
coverage, and a distribution count equal to the eligible count. Missing or
internally inconsistent evidence fails with
`QA_FEED_AGENT_TEMPO_CONTRACT_INVALID`; no URL, item identity, selector, DOM
reference, or raw dwell array enters the transcript. Both ordinary modes keep
`requestEnsoGate` disabled.

The agent-only `feed/gate/*` targets are a separate production path inside the
same attach-only session owner. A positive target-owned `--gate-drive-ms`
selects the canonical production causal chain and makes feedback-only inspection
unreachable for that run. These targets therefore do not publish or accept the
inspection-only `--hold-ms` override; the endpoint owner's shipped `stillGateMs`
remains the sole timing authority. The child consumes the native feed until the
shipped sensing and seam decision own Horizon, waits for the endpoint owner's demand
capture, opens exactly one real Enso gesture Gate with renewed trusted demand,
uses Escape to return to neutral Horizon, and verifies backward traversal while
the endpoint remains owned. It emits `AGENT_GATE_COMPLETE`; the QA protocol
rejects an inspection canary, any active inspection state, a missing production
Gate, or an incomplete causal chain. This separation prevents an already-active
production episode from being followed by a contradictory debug `arm` request.
Armed, opportunity, and seam milestones are captured from the canonical
FeedFlow decision before the content-free report summary is projected; that
summary intentionally omits those transient judge fields and is not milestone
authority.
Because this production drive may exceed the 64-sample raw dwell window, its
`ordered_tail` may report dropped samples. The protocol accepts that bounded
overflow only when retained plus dropped equals the whole eligible count,
coverage matches that ratio, retained active time stays below whole-episode
active time, and the content-free histogram still accounts for every eligible
sample. Ordinary `feed/*` canaries retain their zero-loss requirement.
After Escape, the causal runner records a fresh neutral endpoint baseline and
dispatches exactly one oracle-free, surface-native backward wheel gesture. It
separately proves trusted input, native scroll retreat, committed Horizon and
endpoint morphology, and an unchanged forward `advanceCount`.
Paged renewed-demand input targets the visible native scroller (or viewport-owned
TikTok lane), never the endpoint tail; the tail is an off-rest supply-isolation
buffer rather than a trusted-input destination.
Instagram Home continuous input targets its declared
`main[role="main"] div:has(> article)` lane instead of the viewport midpoint, so
fixed navigation or messaging chrome cannot silently absorb an otherwise trusted
wheel gesture. Its first warmup wheel also records a bounded, content-free
root/nearest-scroll-owner delta, overflow-lock state, hit containment, and rendered
dialog count. It never records page text, URLs, classes, IDs, or DOM content.
If both the root and the same nearest scroll-owner candidate remain at zero while
the rendered dialog persists and either intercepts the exact lane hit or owns a
generic scroll lock, agent QA exits immediately as `BLOCKED`. It does not
dismiss, click, or infer the dialog's content, and it does not misreport the
external page state as a FeedFlow endpoint failure. A missing/offscreen lane, an
exhausted scroller without dialog interception, or an unproven owner identity
cannot satisfy this blocker contract.

The separate `feed/research/*` targets reuse this attach-only target/session
owner but do not arm inspection. They execute fixed skim, steady, deliberate,
burst/pause, or bounded revisit journeys and persist only content-free
observation/evidence/detection curves. Forward and backward gestures are
explicit trusted-input directions; a DOM oracle may recover an unscored input,
but model output never branches the journey. Research activation taints the
current FeedTempo episode so the QA session cannot update the authenticated
profile's personal pace checkpoint. The trace records the production runtime's
actual admission and a separate research-only mature-session counterfactual.
The latter preserves the same detector and endpoint readiness/safety facts while
explicitly projecting a mature-session, inhibitor-free confirmed-advance seam
and clearing surface/session grace, cooldown, and active-episode blocks. It is
not an observed gate or virtual clock, does not call a production Gate, and
cannot change product timing.
Journey-window mismatch is therefore a research verdict, separate from whether
the attached-browser run gathered enough independent DOM measurements.
Curve analysis rejects missing declared checkpoints or required numeric model measurements with explicit `FEED_CONSUMPTION_RESEARCH_OBSERVATION_INCOMPLETE` / `INVALID` errors; it never drops them or fills them with zero before computing a research verdict.
Suite reprojection retains directionality aggregates from those individual
curves. Pairwise collision diagnostics compare both their aligned prefixes and
their complete trigger outcomes, preventing a longer resume phase from being
discarded merely because the shorter comparison journey ended first.

Canonical topology mismatch is a preflight blocker, not an operator wait state.
Once readiness is mature but the shipped scroller/topology is mismatched and
actuation is unsafe, both modes stop with
`FEED_HORIZON_INSPECTION_PREFLIGHT_BLOCKED` before asking a person to scroll.
The low-level `e2e:feed-horizon:inspect` CLI remains an engine/debug surface, not
the normal agent invocation contract.

The `--cdp-endpoint` inspection form is attach-only. The endpoint must be an explicit
loopback HTTP origin with a port, the marked QA profile is validated without requiring
its active Chrome lock to be removed, and that browser must already have the exact
`<qa-profile>.entropy-extension-slot` unpacked extension enabled. Attach mode rejects
`--headless` and `--headed` because it does not own browser presentation. It stages and
reloads the repo artifact in that existing extension slot, creates its trusted helper
target and scenario tab in the background, and may activate the scenario tab without
focusing the OS window. Activation and the production tracking-ownership poll are one
typed development-only background command: the trusted helper only submits the exact
target id, so deactivating that helper cannot suspend the ownership poll. The command
revalidates the exact harness sender, web target, and unchanged target URL, rejects OS
focus requests, performs only the required target-tab activation (no redundant helper
activation), and returns the observed `lastActiveTabId`. A headed attach-only run with
`osFocus: never` is admitted only when the QA browser already has one page: otherwise
creating its first window may foreground Chrome at the host-OS layer despite a
background target request, so upper QA preflight blocks before child launch.
Canonical agent Feed Horizon targets cross that boundary by default; Feed
research does so only when the upper command explicitly supplies
`--allow-initial-window-focus-once=true`. The upper session owns one blank
anchor for the entire upper session, journals its exact CDP identity, accepts
the unavoidable first-window foreground once, immediately minimizes Windows
Chrome without a foreground request or synthetic input, and proves Chrome is
background before launching the first child. Each child still runs under
`osFocus: never`; cleanup closes the anchor target rather than the browser. On
WSL-managed Windows Chrome the child also compares the read-only
`GetForegroundWindow` result before harness start and after scenario activation;
an already-foreground baseline is BLOCKED, and any background-to-foreground
transition fails the run. The probe never invokes a focus, cursor, or UI click API.
Human Feed Horizon runs never receive this exception and still require a
pre-existing page baseline.
Because an unfocused
attached target can otherwise report
`document.visibilityState=hidden` and correctly suspend the production runtime, the
attach-only harness applies CDP-session-local focus and active-lifecycle emulation to
the harness-owned scenario target. It never calls a window-focus or target-activation
API; closing that target/session removes the emulation, so production hidden-tab
cleanup semantics remain unchanged outside the diagnostic target. Quit, signal cleanup,
or startup failure disarms the diagnostic
episode and closes only targets created by the harness; it never launches or restarts
Chrome, closes pre-existing tabs/startup pages, sends `Browser.close`, kills the
process, or uninstalls the extension. Missing CDP capability, profile evidence, or an
exact active extension path fails loudly; there is no install/discovery fallback.
The probe passes only when the native
marker/tail/isolation-ledger order, named site topology and isolation contract,
viewport-sized silent tail, mode-appropriate tail/snap contract, continuous
spring displacement returning to the near-rest 10% envelope, or paged
`terminal_snap` displacement returning to the last real anchor instead of
settling on a full-screen blank tail, before native geometry capture,
still-gate transition to `controlsLive`, one
trusted renewed-demand wheel burst, and its complete canonical restore are
observed on the live page.
Instagram validation additionally requires
`main[role="main"] > div:first-child` to remain the exact vertical snap
scroller/lane, every owned Reel branch to retain `scroll-snap-align: start`,
future React-owned branches to remain connected and use the named
layout-preserving visibility isolation (not `display:none`), native scroll
extent to remain bounded without a bottom-sentinel preload loop,
and the toolbar sibling outside that lane to remain untouched. A non-snap lane
shape is contract drift; the runner does not add a generic overlay fallback.
X Home validation requires the exact root-scrolled relative virtual lane,
direct absolute `cellInnerDiv` branches, preserved future-cell geometry, and an
`absolute_anchor_edge` tail. Instagram Home requires a direct normal-flow
article lane and flow tail. Facebook Home requires a direct branch containing
`role=article`; if the active branch still owns a later article, the endpoint
must remain pending until that batch is consumed. Sentinel/helper children are
not isolated. All three preserve future branch layout with visibility/inert
isolation and restore it without reparenting.
YouTube Home validation requires the exact root-scrolled
`ytd-rich-grid-renderer #contents` flex-wrap lane. Only direct current
`ytd-rich-item-renderer:has(yt-lockup-view-model)` nodes are candidates; direct rich
sections and continuation nodes are bounded future branches. The boundary must be the
maximum native flow edge of a completed item row, including trailing item margin and
lane row gap, and the site-painted tail must start as a full-width
`wrapped_row_flow` row. Subscriptions/Search shape drift remains
`observe_only`; the runner does not add a generic browse overlay or selector fallback.
On 2026-07-25, the three authenticated Home scenarios each completed both
`arm` and `rearm` in one headless/audio-muted Chrome process per site. X used
its absolute virtual-cell tail, Instagram Home used its article-column flow
tail, and Facebook waited for the final article in a batched branch. Every
cycle reached the boundary, completed the bounded structural hold, retained
native topology through feedback, and reported `productionGateCount: 0`. These
checks used a one-second inspection override to verify lifecycle structure; the
production default remains ten seconds.
On 2026-07-26, X, Instagram Home, and Facebook Home each completed three
production-default 10-second feedback-only cycles (`arm`, `rearm`, `rearm`) in
one headless/audio-muted authenticated Chrome process per site. Each site's
three cycles retained one document `timeOrigin`, reached its named native
boundary, preserved future branch geometry, reached `enso_would_open`, and
reported `productionGateCount: 0`. X advanced its absolute virtual lane from
approximately 1.9Kpx to 3.8Kpx to 5.3Kpx. Instagram retained four future
article branches with a native-painted flow tail. Facebook advanced from
approximately 2.4Kpx to 4.4Kpx to 6.3Kpx while preserving 11, 13, and 10 future
batched branches. A continuous surface may require more commit-driving input
than a paged surface, so the repo-owned runner gives `continuous` at most 32
trusted steps and `paged` at most 12; this is a diagnostic driver budget, not a
production endpoint fallback. The Facebook run also confirmed that renewed
demand must target the center of the visible tail intersection rather than a
viewport-edge-clamped point.
On 2026-07-26, YouTube Home completed three production-default 10-second
feedback-only cycles (`arm`, `rearm`, `rearm`) in one headless/audio-muted
Chrome process using the explicit logged-in `Profile 1`. All three cycles
retained one document `timeOrigin`, reached a completed three-item rich-grid
row boundary, preserved the native 32px card trailing margin, and reached
`enso_would_open` with `productionGateCount: 0`. The cycles preserved 17 of 49,
7 of 49, and 19 of 73 bounded direct branches under the original lane with
nonzero geometry. The final cycle also proved that the current viewport row can
move beyond the retained DOM sample prefix without losing its canonical anchor.
No cycle committed while native future supply was absent. Cleanup left no QA
Chrome process or profile lock, and the checked YouTube authentication-cookie
names remained present.
The topology-only command deliberately launches the extension-disabled control
in the same headless/audio-muted Chrome process across the selected sites. It
is for rechecking live DOM ownership before changing selectors, not proof that
the extension endpoint committed.
It also never creates or refreshes
`feed_topology_certificate_checkpoint_v1`. Local generic certification belongs
to the normal content probe -> trusted background service -> epoch-aware
ModelState pipeline and requires evidence from at least three document sessions
over two UTC days. Inspection must not seed, backdate, or bypass that evidence.
A same-day real-site run can prove only that an uncertified generic surface
stays `shadow_learning`, that the read-only probe emits no DOM mutation, and
that shipped site adapters still commit and restore normally. A later natural
session may claim `locally_certified` only when the restored certificate,
three fresh live fingerprint samples, and the immediate pre-actuation topology
probe all match. Tab hide clears the live samples, so a resumed tab must
re-establish the three-sample proof before any local endpoint can commit.
Known shipped surfaces run the same class-independent structural probe in
shadow while `FeedShippedTopologyProbe` separately checks only the exact
catalog-declared anchor/lane/scroller/containment tuple. A shipped mismatch
fails closed as `drift_suspected`; it can recover as `locally_certified` only
when an already-issued durable certificate and the current live fingerprint
both match. The probe never derives a replacement selector or edits the DOM,
and a later resolved shipped tuple immediately reclaims shipped authority.
With Runtime Debugger cost collection enabled, shipped health, local
certification, and the final local actuation recheck appear only as bounded
content-free `topology_probe` counters and durations. Selectors, DOM nodes,
hostnames, text, and paths must not appear in those events.
Before opening the measured page, `configureScenario` follows the site-rule
commit with the canonical `SETTINGS_CHANGED` reconciliation for
`blockedUrls`/site-goal metadata and requires a completed protection broadcast.
This makes a redundant rule from a prior QA run re-armable without raw storage
edits or a Chrome restart.
The repo-owned inspection entrypoint uses the typed
`DEBUG_RUNTIME_CONTROL_FEED_HORIZON_INSPECTION` action. It may run only in an
active dev automation session, refuses `warming`, unsafe, or `observe_only`
endpoint state, and forces only detector/surface-grace/spawn-timing admission
inputs. Arm/rearm captures that exact canonical `ready/safe` decision only until
the endpoint lease commits, so the inspection's own quiet sample cannot tear
down a still-resolving diagnostic endpoint. The named
`driveInspectionEndpointCommit` runner seam continues bounded trusted native
feed input while the endpoint is preparing, so a long continuous-feed card or
virtualized branch is actually consumed before the lease commits. A passive
timeout or merely blocked scroll is not commit evidence. The bound is owned by
`resolveInspectionEndpointCommitDrivePolicy`: paged surfaces allow at most 12
trusted steps and continuous surfaces at most 32 because one native article can
span substantially more than one viewport. Commit immediately
returns decision authority to the canonical FeedFlow snapshot; live actuation context,
topology/geometry resolution, lease validation, invalidation, and sustained pull
remain the normal runtime contracts.

The entrypoint starts one audio-muted Chrome process and keeps it alive until
`quit`; use `--headless` for a zero-window arm/rearm lifecycle, or omit it for
headed native-paint inspection. It does not call `chrome.windows.update({ focused: true })` or
`Target.activateTarget`; arm/rearm only activate the scenario tab inside that
existing Chrome window. The OS can still surface a newly launched headed
process once, so unattended/background repetitions use the default headless
causal runner. Its `arm` command drives one complete feedback-only cycle through
`endpoint 준비 → boundary 도달 → 10초 hold → Enso would open`; `rearm` performs
the same cycle again in the current content session without restarting Chrome.
An operator-visible no-focus canary must not launch or restart Chrome while the
operator is using another window. It may attach only to an already-running,
dedicated logged-in QA Chrome process that explicitly exposes a CDP endpoint;
it must not attach to a personal browser or infer a profile from process
recency. If no such reusable process exists, record the authenticated visual
canary as `pending` and keep the structural/headless evidence—do not open a new
headed window to manufacture the check. Attaching must not call
`Browser.close`, `Target.activateTarget`, or any OS focus API, and teardown
closes only the diagnostic target/session it created, never the browser
process.
Trusted demand aimed at a viewport-clipped native tail uses the center of the
tail's visible intersection, never a coordinate clamped to the viewport edge.
This keeps CDP hit testing inside the owned native endpoint on fixed-navigation
sites such as Facebook.
The independent dominant-item oracle also selects visible canonical candidates
before applying its sample bound. It must not retain only the first N DOM
matches: long-lived continuous feeds such as YouTube Home keep older rich items,
so the current viewport row can legitimately move beyond that retained prefix.
An allowlisted endpoint remains `pending` with
`feed_endpoint_future_supply_missing` when the current native anchor has no
following containment branch. The driver continues bounded trusted demand; it
must not treat a transient native supply gap as a committed drying endpoint.
One `rearm` command first releases the committed diagnostic endpoint, restores
the native feed, waits for the canonical episode owner's endpoint decision to
return to `ready/safe`, and then starts the next cycle. A drying endpoint can
legitimately leave observation `pending`, so rearm does not bypass readiness by
reusing a previously committed lease. Runtime Debugger probe readiness remains
diagnostic evidence and is not the inspection admission authority.
The inspection admission does not synthesize a production FeedFlow interrupt
latch. An already-absent latch is a confirmed idempotent retreat only while an
active production episode admission or active named inspection still owns the
endpoint lifecycle. Without either ownership boundary, an absent latch is not
a release acknowledgement.
After an operator reload, use `arm` to bind the new content session in the same
browser process. `disarm`, `status`, `dom`, `warmup`, `help`, and `quit` are also
available. There is no background interval monitor or inactive-state log loop.

The phase HUD is dev instrumentation, not an endpoint fallback. The product
surface remains the silent native tail. The tail-local end-face may paint only
the low-contrast non-interactive horizon mark and its screen-reader status; it
must not show a question, button, countdown, progress, or continue hint and
must not move focus. The runner fails loudly unless
marker/tail/quarantine are singleton adjacent siblings in the native lane, the
tail follows the native anchor, matches the native item/lane content width and
declared paint profile, keeps viewport height, preserves paged snap only on
paged surfaces, matches the named continuous tail layout on Home surfaces, and
contains no product-facing text. Continuous tails must match inherited opaque
native paint. Paged tails use transparent native-paint bleed so the last card's
own filter/glow can cross its branch edge; they must not synthesize or overlay a
replacement glow.
TikTok's adapter does not reparent React-owned feed cards. It keeps following
cards under the same native lane, records their exact inline display/inert/
aria-hidden state, applies in-place inert isolation, and restores those values
without moving a card even if TikTok reused it under another parent. This is a
profile/mode allowlist entry, not a generic overlay or mutation fallback.
YouTube Shorts uses the same lease state machinery through a different named
adapter. `youtube_shorts_sequence_lane` requires `#shorts-container` as the
exact snap scroller, `#shorts-inner-container` as the lane, and a current
`div.reel-video-in-sequence-new` branch containing the single recycled
`ytd-reel-video-renderer`. Only following sequence branches are isolated;
`DOM-REPEAT`, `DOM-IF`, and overlay control nodes stay owned and visible to
YouTube. The live morphology proof requires every isolation marker to remain
effectively `display:none`, inert, and aria-hidden; lease validation reasserts
those values if YouTube rehydrates a tracked branch without replacing its saved
restore snapshot. Its endpoint boundary is the next matching native sequence branch
start, so the measured snap stride includes both the 576px branch and YouTube's
16px native gap inside a shorter clipped scroller. This does not widen the
generic paged viewport-ratio bound. Sequence branches remain endpoint-only
topology and are not added to production candidate/supply selectors.
The exact native `ytd-shorts #navigation-button-down button` and Instagram
Reels direct-toolbar last ARIA button remain usable while the user is above the
terminal anchor. At the last real item only, the endpoint forward-control lease
applies native/ARIA disabled semantics, a capture-phase input guard, and a
subdued visual state; backward navigation restores the exact prior state.
While the paged scroller is above that anchor, wheel and forward-key input also
remain native and are not converted into extension-owned pixel scrolling.
Paged elastic displacement temporarily suppresses native snap only during the
small terminal pull and restores the original inline snap declaration at rest.
Backward wheel/key preparation restores that declaration synchronously before
the first native backward default, so reverse navigation retains slot snapping
instead of leaking through as linear scrolling.
Agent morphology also requires the Reels ARIA control's exact terminal marker,
`aria-disabled`, `tabindex=-1`, and subdued opacity; preserving the outside-lane
toolbar alone is not sufficient evidence.
Agent renewed-demand input follows the runner's named
`INSPECTION_RENEWED_DEMAND_POLICY`: a bounded sustained burst with one explicit
action cadence, retry ceiling, and feedback-observation window. The architecture
guard protects that named policy seam rather than freezing its tuning values.
Single retries separated by multi-second feedback waits are invalid evidence
because the product accumulator intentionally decays between them.
Agent morphology capture waits for `settling:false` and the exact near-zero
motion epsilon before asserting native snap preservation; a merely near-rest
spring frame is not stable evidence.
Feedback-only requires an explicit bounded still gate and never invokes
`requestEnsoGate`; it leaves the endpoint committed and marks the exact point
where Enso would have opened. Production handoff remains available only through
the same named seam's explicit `production` mode and retains canonical
`requestEnsoGate` plus outcome handling. Terminus dry-run and inspection remain
mutually exclusive.

Automation stop and inspection `disarm` canonically release the endpoint,
permit/prelude, HUD, and Runtime Debugger probes. Tab hide aborts the inspection
episode and removes endpoint/HUD state; `pagehide`/`beforeunload` additionally
stop FeedFlow observers and timers and release listener/source leases.
If endpoint ownership genuinely invalidates while the tab remains visible, the
phase HUD retains an explicit terminal failure reason instead of disappearing
into a black tail. The next arm preparation, disarm, automation stop, tab hide,
or page exit removes that retained diagnostic state.
The second command keeps production admission intact and drives trusted feed
inputs for a bounded 8–20 minute window. PASS requires the owning episode to
reach Horizon, renewed forward demand to open Veil, Escape to return to neutral
Horizon, and the surface-native trusted backward scroll to move through retained
native history while the
same endpoint lease and Horizon episode remain owned. The attach-only
`feed/gate/*` QA targets call this same causal-chain owner rather than duplicating
the sequence in the inspection engine. Scenario teardown, not
backward navigation, proves final endpoint and Gate cleanup. Once the exact dry
boundary is observed, the driver polls the
internal demand-capture gate at 100 ms cadence for the endpoint owner's reported
`holdRemainingMs` plus a bounded 4.5-second observation allowance. The runner
does not duplicate the owner-controlled `stillGateMs` as its own timeout. It
sends two 1,800 px wheel pulses at 100 ms cadence as soon as `controlsLive` is
owned.
That burst models a sustained physical pull against the 450 ms decay contract;
it does not lower the product threshold. Endpoint
ownership loss and still-gate timeout are separate fail-loud outcomes rather
than one generic incomplete-chain result. After eight consecutive bounded
inputs without a dominant
transition, the causal lane may click the singleton, visible native
`nav-foryou` control to request a fresh feed batch. That refresh is valid only
when the canonical For You surface (`/foryou` or `/`) remains in the same
document, the opaque media-supply fingerprint changes, and the refresh itself
produces no passive FeedFlow advance.
An unchanged-supply click is recorded as retryable `NO_EFFECT`. The bounded
recovery may then click the visible singleton Following control only as a
verified no-op primer: the page must remain on the same For You surface and
document, its supply must remain unchanged, and no modal may appear. The final
For You reselection is `PASS` only when it changes the opaque supply fingerprint
without a passive FeedFlow advance. Any intermediate surface change, modal,
document discontinuity, route drift, or passive advancement is a blocking
`FAIL`. The CLI requires exactly one stage, `--dry-run-only` or
`--skip-dry-run`, so morphology stimulation cannot contaminate a production
causal soak. Automated Chromium is launched
with audio muted, including headed diagnostic runs. Both commands use a
diagnostic profile with the Day-7 disclosure override, record
content-free state and cost evidence only, and never save screenshots or page
text. This lane is diagnostic evidence, not an automatic approval to change
admission, grace, or intervention thresholds.
On 2026-07-26, the production causal lane completed one paged and one continuous
handoff canary under the then-current explicit-retreat contract. TikTok reached
the native dry boundary over 490 seconds with 108 actions and 56 independently
measured transitions; renewed demand opened exactly one production Gate,
Escape retained `feed_dry`, and the explicit retreat/teardown step returned to
`observing` with marker/tail/quarantine/Terminus/Gate artifacts all at zero.
X Home reached its `x_home_timeline_tail`
`absolute_anchor_edge` boundary over 478 seconds with 145 actions and 143
independently measured transitions. It preserved two future absolute branches,
opened exactly one production Gate, retained `feed_dry` after Escape, and its
explicit teardown returned the same five artifact counts to zero. These are
historical cleanup-chain results, not evidence that backward navigation should
release the current endpoint. The current contract keeps the endpoint while
the user traverses retained history and delegates cleanup to scenario teardown.
The canaries do not change admission, dwell, grace, or intervention thresholds.
If the independent page oracle temporarily reports `feed_oracle_not_ready`,
the dedicated causal driver still dispatches the bounded trusted input that a
user would have supplied. That recovery input is explicitly unscored and cannot
count as independent consumption evidence; only a later settled oracle
transition is counted. This prevents an idle-video diagnostic deadlock without
turning the product detector into its own correctness oracle.
The dedicated driver also supplements the shared action helper's bounded
two-second settle so `--dwell-ms` is the actual minimum per-item observation
tempo. The production causal binge lane uses the explicit rapid-consumption
dwell; a 6–7 second dwell is a useful non-candidate control and should not be
expected to reach Horizon. If an already-active For You click is a safe
`NO_EFFECT`, the driver uses the strictly inert Following primer and final
For You reselection contract above. Once admission commits the endpoint, the
driver first requires the owned marker/tail/quarantine morphology, uses trusted
PageDown input to travel through the controller-owned boundary, and sends
renewed wheel demand to the endpoint tail itself. A generic viewport-center
wheel is not accepted as endpoint evidence because it may begin outside the
committed nested scroller after TikTok virtualizes or quarantines feed cards.
The intermediate `endpoint_pending` phase still receives normal trusted feed
input so the product can settle a visible anchor and commit its lease; boundary
input begins only from `feed_drying` or a later endpoint-owned phase.
Use the explicit QA-profile form when the anonymous TikTok surface stops
supplying new cards. It accepts only a marked dedicated Entropy QA profile,
stages the diagnostic artifact through the canonical in-place extension slot,
and fails loudly on a live profile lock; a personal Chrome profile is outside
this contract.

Diagnostic readiness and observable-effect conditions are evaluated from the
accepted active-stimulus snapshot captured before disable. Only settle
conditions read the final re-enabled settle snapshot. This phase ownership
prevents a fresh post-reenable learner from replacing the state that actually
observed the declared consumption journey. A readiness equality condition may
also attach the complete content-free readiness object as failure context.
The FeedFlow supply `pendingStep` check is an active observable condition, not a
post-reenable settle condition, because it belongs to the journey that created
the supply readout.
The FeedTempo settle conditions are deliberately cross-session. Runtime disable
closes the open observation episode and commits one eligible update through the
background CAS owner. When the independent feed oracle observed at least one
opportunity, re-enable resets the content projection and the final snapshot must
restore a positive `feedFlow.tempo.profile.sampleCount`, a non-negative
`checkpointStateRevision`, and `checkpoint.state=ready`. Together those facts
prove that the new content session restored the typed IndexedDB checkpoint; a
content-local session learner cannot satisfy the contract. When the bounded
independent oracle remains `armed_idle` with `opportunityCount=0`, however, a
fresh disposable profile legitimately retains `sampleCount=0` and a null
checkpoint revision. The two numeric restore contracts then report
`WARN / workload_insufficient`; they become `FAIL` for missing or below-floor
values as soon as `opportunityCount >= 1`.

The same accepted active-stimulus snapshot now proves the paged tempo shadow
path independently of the existing detector matcher:

- `feed-tempo-observe-only` requires `feedFlow.tempo.mode=observe_only`.
- `feed-tempo-persistence-owner` requires
  `feedFlow.tempo.persistence=indexeddb_checkpoint`.
- `feed-tempo-checkpoint-ready` requires the active session restore to settle at
  `feedFlow.tempo.checkpoint.state=ready`.
- `feed-tempo-cost-measured` requires
  `feedFlow.tempo.cost.measurementState=measured`.
- `feed-tempo-dwell-observed` requires a positive delta at
  `feedFlow.tempo.trajectory.counters.eligibleDwellCount`.
- `feed-tempo-profile-restored` requires an absolute final-settle
  `feedFlow.tempo.profile.sampleCount >= 1` after at least one independent feed
  opportunity.
- `feed-tempo-checkpoint-revision-restored` requires a non-negative final
  `feedFlow.tempo.profile.checkpointStateRevision` after at least one independent
  feed opportunity.
- `feed-tempo-persisted-ready` requires the re-enabled session checkpoint owner
  to settle at `ready`.

The dwell/profile conditions do not let the product grade its own transition. The
trusted-input/content-signature oracle still owns TP/FN/FP/duplicate matching;
the tempo counter only proves that confirmed product advances reached the
episode assembler and yielded at least one eligible dwell. The strict debugger
projection exports scalar summaries and counters only, with no dwell sample
array, URL, pathname, selector, DOM reference, or item identity. Its
operation count plus total/average/maximum milliseconds measure the incremental
synchronous tempo path separately from dominant/mutation scans. Checkpoint
round-trip count plus total/average/maximum milliseconds separately measure the
message/IndexedDB path; neither metric is folded into observer scan cost.

The deterministic first gate replays paged DOM movement, no-movement, missed,
duplicate, and retention-gap cases without a live site:

```bash
npm run test:file -- tests/feedConsumptionValidation.test.js tests/feedTempoEpisodeAssembler.test.js tests/feedTempoProfileLearner.test.js tests/runtimeDebuggerFeedProbe.test.js
```

Live validation then uses the ordinary paired command:

```bash
npm run e2e:sites -- --suite=release-core --lane=both --site=tiktok --repeat=3 --headed
```

The ledger's internal scan totals explain where FeedFlow spent diagnostic work.
Shipping cost still comes from the public `release` lane relative to the
extension-disabled control; internal debug timing is not treated as release
cost, and no live timing becomes a hard gate without an approved operating
envelope.

For Social Metrics diagnostic runs, JSON and Markdown include a code-owned
scanner verdict. Exact duplicate executions and code-proven avoidable full
rescans are structural FAIL contracts. A zero counter passes only when its
evidence state is `measured`; inactive, unavailable, armed-idle, or insufficient
evidence is WARN. Distribution-sensitive live-site signals such as root breadth,
repeated target share, candidate/write yield, queue time, and product timings
remain baseline-only until an approved baseline exists. The harness does not ask
an agent to invent thresholds for those metrics.

Fine Social Metrics owner-span analysis uses the selected diagnostic action's
contention timeline at
`runtimeCost.contentionWindow.entropy.timeline.entries`. Include only entries
whose `ownerId` is `socialMetrics`. The timeline must be `measured` with
`droppedEntryCount=0`, and the enclosing contention window must be `measured`
with `retention.complete=true` and `ownerWorkComplete=true`. Timeline-local
completeness cannot recover owner work that was already evicted from the source
ledger; a session-level recent-work tail is not a complete substitute. Group
the retained operation durations by `phase` and report
`n`, minimum, median, p95, maximum, and the count strictly greater than 8 ms
for `selector_query`, `candidate_filter`, `selector_probe`,
`semantic_scope_discovery`, `semantic_query`, `union_materialization`,
`candidate_discovery`, `candidate_provenance`, and `collection_finalize`.
These are per-operation duration distributions, not additive shipping-cost
totals. The cooperative rollout's existing `max <= 8 ms` criterion is met only
when every applicable observed phase has no operation above 8 ms.

Use the machine state `not_applicable` (rendered as `N/A`) when Runtime Debugger
is absent in release/control, when standard audit intentionally does not run
`selector_probe`, or when a complete measured workload proves that a
conditional unit was not created. A phase required by the selected scenario or
observed workload but missing from the timeline is `insufficient`, as is any
phase read from an incomplete or truncated timeline; neither case becomes zero
or `N/A`. Fine-span timing does not override the run verdict: a diagnostic
`WARN` still contributes suite `WARN`, which the named QA adapter projects to
top-level `INCONCLUSIVE` under the result-classification contract above.

The already collected selector-only, semantic-only, overlap, and resolved
candidate counts also feed a zero-extra-read shadow challenge. Any strategy
that loses a member of the current candidate union is rejected before a cost
experiment. A candidate-union-noninferior strategy may enter a controlled cost
experiment only while the independent feature oracle remains active. This does
not prove product-correctness noninferiority, does not select a winner
automatically, and currently describes only the Social Metrics discovery owner;
it is explicitly not a cross-owner comparison.

A separate bounded cross-owner ledger reuses Runtime Debugger session events
from Social Metrics and Short-form and correlates only their `ObserverHub`
flush identities. It reports how many mutation flushes caused both owners to
work, retains at most 32 numeric shared flush ids, and performs no additional
DOM reads. This is co-activity evidence, not duplicate-work proof: each owner
keeps different root, candidate, decision, and effect semantics, so their raw
counts are marked non-comparable and never become an automatic hard gate.
The dev-only identity extension assigns numeric ids with a session-scoped
`WeakMap` to roots, candidates, and effect targets that those owners already
hold. It retains no DOM node and performs no selector, traversal, text,
attribute, or layout read. The report can therefore prove exact same-node
overlap and the stronger same-node + same-`ObserverHub`-flush + same-work-reason
overlap without scraping the page. Even that stronger overlap is not labeled
redundant automatically: the two owners may legitimately derive different
feature outputs from the same scope. Retention gaps make completeness
`insufficient`, while a positive retained overlap remains positive evidence.
The ledger measures record overhead per owner and snapshot-read overhead
separately. Only the Social Metrics record share is subtracted from the Social
scanner's instrumented elapsed time; Short-form record time and snapshot reads
remain explicit debugger overhead instead of being charged to product work.
The alias resolves to a no-op module in public/release builds.

## Cost Evidence and Baselines

Diagnostic reports keep product work separate from debugger work. They include
the dev-only Runtime Contention Timeline: physics-scroll frame interval,
wheel-input-to-first-frame latency, and callback cost; refresh-rate-relative
late animation/input-frame classification; exact temporal overlap with
ObserverHub/subscriber and Social/Text/Visual owner spans; browser long-task
overlap, retention completeness, and ledger overhead. Temporal overlap
is correlation evidence rather than proof that the overlapping owner caused the
late frame. A representative diagnosis therefore uses repeated identical action
sets and compares owner/phase concentration across captures before changing
scheduling or Worker ownership. It also includes per-trusted-action renderer
task/script/layout/style-recalc deltas, the union of instrumented Entropy owner
spans in the same monotonic window, per-owner non-additive coverage, and a
renderer residual that remains explicitly mixed until stronger tracing proves
its owner. Nested owner spans are unioned rather than summed, and incomplete
ledger retention makes the action attribution unavailable rather than silently
undercounted. Renderer coverage is nevertheless projected from the independent
`runtimeCost.renderer.state` leaf: a `trusted_content_load_probe` can retain a
measured renderer delta while its composite `runtimeCost.state` is unavailable.
When a contention window was requested but owner-work retention is incomplete,
the aggregate contention state is `partial` rather than `not_requested`, and a
diagnostic contract that requires contention remains FAIL. A complete bounded
timeline may still support LoAF correlation, but it does not override
`ownerWorkComplete=false` or dropped owner-work evidence. Public release and
the extension-disabled control reuse those trusted-action boundaries without
loading Runtime Debugger. Long Animation
Frames overlapping each boundary expose severe user-visible hitches, blocking
duration, and script timing bucketed only as Entropy extension, page,
third-party, or unknown; raw script URLs are not persisted. Unsupported LoAF
APIs remain `unavailable`, never measured zero. For the diagnostic lane, the
same action projection carries a bounded scalar owner/subscriber timeline and
each LoAF carries a bounded sanitized script timeline. Their shared document
`performance.now()` clock supports exact same-frame, style/layout-phase, and
extension-script/owner temporal overlap counts without another DOM read.
Timeline truncation is `incomplete`, and a positive overlap is never promoted
to causal invalidation ownership. It also includes
duplicate scans and avoidable full rescans when their owner exposes those
counters (otherwise explicit `unavailable`), Social Metrics full/root scan
shape, dirty-root breadth, ObserverHub attribute/child/mixed/tiny flush shape,
queue wait and subscriber callback cost,
selector/candidate/resolved/applied yield, semantic decision yield,
zero-candidate collections, repeated versus unique target decisions,
selector/semantic/idle/apply/post-chunk cleanup/configuration cleanup/total
timing, pending queues, snapshot-read cost, ObserverHub debug bookkeeping, and
`selectorProbeMs` deep-audit overhead.

Both product lanes and the extension-disabled control collect heap, DOM
nodes/documents, JS listeners, page-side
Mutation/Intersection/ResizeObserver and Worker cardinality, task/script/layout
duration, long-task count/total/maximum, Long Animation Frames, trusted-action
renderer deltas, worker targets, lifecycle cleanup, and sanitized page errors.
Product lanes additionally collect Entropy's extension storage and extension
service-worker errors. Control extension storage remains explicitly
`inactive / extension_disabled`; it is never represented as zero.

Extension service-worker error attribution is scenario-local. After the
collector's initial worker attachment, protocol enablement, and queued-event
drain complete, the runner records an opaque,
collector-owned monotonic error cursor before applying that scenario's settings.
Only runtime errors recorded after that cursor feed
`extension_uncaught_errors_absent`; a current-scenario error still fails without
an allowlist. Collector attachment, restart, and coverage errors retain their
full lifecycle visibility. Neither the cursor nor internal sequence values enter
the content-free report, so attaching a fresh collector cannot reassign a prior
scenario's buffered service-worker error to the next scenario.

Only existing confirmed CWS budgets are hard limits without a site baseline:

- `chrome.storage.local` growth is at most 1 MiB.
- Extension dedicated/shared workers after page close are zero.
- Extension service workers after idle are at most one.

Real-site heap, DOM, listener, storage, and long-task deltas are summarized by
the median across repeats. Approved operating envelopes are read only from
`scripts/e2e/sites/baselines/<suite>.json`, keyed by scenario, lane, display
mode, and optionally browser product. The current envelope contract is
`operatingEnvelopeVersion: 1`; an unversioned or unsupported entry is
`WARN / contract_drift` and can never become a hard performance gate.

An operating envelope is not a ratchet that demands a lower number after every
successful run. It is a read-only, explicitly reviewed upper bound for a fixed
workload cohort. An entry must contain:

- approval state, review timestamp, and owner;
- the exact harness-generated workload fingerprint;
- a minimum repeat count and any reviewed live-workload ranges;
- at least one normalized cost metric with an approved median and explicit
  relative or absolute headroom;
- optional raw cost metrics when their site variance was separately reviewed.

The fingerprint binds the scenario/site, diagnostic or release lane, display
mode, browser family/major, primary route, active feature keys, and the
declarative action/readiness/effect contract, including any FeedFlow
action-boundary oracle contract. A fingerprint mismatch is
`INCONCLUSIVE / contract_drift`, not a performance regression. Insufficient
samples, unavailable workload dimensions, or live workload outside the approved
range are `WARN`; metric gates are skipped rather than comparing unlike work.
Before comparison, the harness assigns code-owned eligibility separately to
external CDP samples, diagnostic-internal samples, and phase metrics. A
correctness, activation, effect, or cleanup FAIL excludes the sample and still
fails the run. Unknown WARN contracts fail closed. Page-runtime noise remains a
visible advisory, a settled lifecycle segment whose scanner state is
`armed_idle` does not invalidate aggregate work, and a diagnostic-only WARN may
exclude internal metrics without discarding otherwise valid external CDP
evidence. Invalid phase evidence is excluded metric by metric by the phase
ledger. Reports retain the advisory/blocker reasons, eligible/excluded repeat
counts, and per-metric sample counts. Diagnostic internal
samples count only when efficiency evidence settled and the code-owned scanner
structural and conservation audits passed and the scanner work ledger is
measured. Conservation proves self-consistency among the code-owned counters,
not completeness of every possible instrumentation path; reports explicitly
retain `instrumentationCompletenessProven=false`. Identity-normalized values
additionally require measured exact-node
identity cardinality. A fast run that missed a required target can therefore
never produce an operating-envelope PASS.

Normalized diagnostic signals include selector and semantic candidates per
resolved candidate, decisions/writes/repeated touches per unique applied target,
dirty-root breadth per routed mutation group, ObserverHub queue wait per flush,
subscriber callback cost per thousand mutations, and scan elapsed time per
resolved candidate. The scan elapsed numerator is an estimate obtained by
subtracting measured in-path selector/deep, provenance, write, and scan-evidence
probe time from the owner-recorded instrumented wall elapsed value. Snapshot
reads and ObserverHub bookkeeping stay separate; unknown instrumentation is not
claimed absent. External normalized signals include task/script/layout and
long-task work per observed time.

Normalization happens per valid repeat before the harness takes the median; it
never divides one component median by another. Target-decision, repeat-touch,
and write ratios describe the complete debugger measurement epoch and must not
be interpreted as phase-local evidence. Separately, the diagnostic lane emits
work-ledger ratios for `active_stimulus`, `disable_cleanup`, and
`reenable_stimulus`. Those ratios are exposed as
`phase.<phase-id>.<ledger-metric>` and are computed only from validated
boundaries. `active_stimulus` validates the session baseline against its active
endpoint; disable and re-enable validate consecutive phase endpoints. A
boundary with a different tool, session, full-scope contract, URL,
social-metrics measurement epoch, or
non-monotonic capture time or owner counter is `contract_drift`, not a usable
delta. Phase
identity ratios remain unavailable unless exact identity cardinality is
measured for that scope. The scan elapsed ratio includes the owner-recorded
selector, semantic, scheduling/idle, apply, and cleanup path after subtracting
only known in-path diagnostic probes; it is an estimate, not CPU time or a proof
that all instrumentation overhead was found.

The suite records `metricSampleCounts` independently for every raw and
normalized metric, including every phase-prefixed metric. The total repeat
count alone is not enough: every metric named by an approved envelope must
have at least that envelope's `minimumSampleCount` finite, eligible per-run
values. Otherwise comparison stops with
`WARN / INCONCLUSIVE / metric_sample_insufficient`; a median from a partial
cohort is never promoted to PASS.

Each approved metric is an upper operating bound. A lower observation passes
but never rewrites or tightens the checked-in envelope. A zero approved median
must provide absolute headroom; percentage-only comparison against zero is
incomplete and therefore `WARN`. The harness never creates, accepts, updates,
or auto-promotes a baseline. The schema and review template live in
`scripts/e2e/sites/baselines/README.md`.

For each scenario the suite report also records the measured control median,
`release - control`, and `diagnostic - control`. Only control runs whose flow
measurement state is `measured` enter those medians; blocked, broken, or
insufficient samples remain visible but are excluded. These attributable deltas
are informational and never become a hard gate automatically. Negative values
are retained as live-site variance rather than clamped to zero.

## Results and Reports

The four run outcomes are `PASS`, `WARN`, `FAIL`, and `INCONCLUSIVE`.
Correctness, activation, effect, cleanup, and confirmed-budget violations can
fail immediately. Site blockers retain one of `auth_required`, `blocked`,
`contract_drift`, or `inconclusive` and cannot become PASS merely because no
work was measured. Canonical artifact disclosure locks use
`INCONCLUSIVE / artifact_disclosure_locked`. CAPTCHA, 2FA, login,
terms/consent, robot challenges, and
site blocking end that scenario at a takeover checkpoint while the remaining
catalog scenarios continue. CAPTCHA classification requires a rendered,
non-zero-size surface; hidden provider infrastructure such as X's dormant
reCAPTCHA iframe is not a takeover blocker.

The default artifact shape is:

```text
reports/e2e/sites/<suite>-<timestamp>/
  report.json
  summary.md
  runs/<lane>/<scenario>/repeat-<N>/
    run.json
    summary.md
    runtime-debugger.json  # diagnostic evidence only, when available
    runtime-debugger.md    # diagnostic evidence only, when available
  controls/<scenario>/repeat-<N>/
    run.json
    summary.md
```

Every run records site, sanitized route/URL, scenario, feature activation,
observable effect, costs, debugger overhead, failed contracts, artifact paths,
and a one-epoch reproduction command. The aggregate report commands preserve the
original requested repeat count so a repeat-scoped acceptance workload can be
rerun without silently shrinking its sample set. URLs keep only safe HTTP(S)
origin/path data;
credentials, query, and hash are removed. The process exits nonzero for FAIL,
and also for INCONCLUSIVE when `--fail-on-inconclusive` is supplied.

A control run also uses `PASS`, `WARN`, or `INCONCLUSIVE`, but its result means
only that the extension-disabled measurement flow was valid, partial, or
unavailable. Its Markdown states explicitly that a control PASS is not an
Entropy activation PASS. Control outcomes participate in the suite's worst
outcome so a missing baseline run cannot be hidden behind a product PASS.

## Profile, Privacy, and Safe Interaction

The default profile is disposable and is removed when the harness closes.
`--keep-profile` retains that disposable directory for diagnosis. The runner
never attaches to a personal Chrome profile automatically.

Chrome creates an initial `about:blank` page for each harness launch. With a
disposable profile, the harness records only exact blank-page target ids present
at startup, waits until the scenario page is ready, revalidates that each
recorded target still points to exactly `about:blank`, and closes it. A recorded
target that navigated away, and every nonblank tab, remains untouched.

An explicit Entropy QA profile is a dedicated test surface rather than a
personal browsing profile. For that profile only, the harness records every
page target already present at startup and closes those recorded targets after
the newly owned scenario page is ready. This removes restored Facebook,
TikTok, and other prior-scenario tabs without admitting a later-created tab or
worker into cleanup ownership.

To make the production usage-budget owner observable in that isolated profile,
the runner explicitly sets local collection to `protected_sites` with
`protected_only` consent. Collection remains limited to the scenario's
allowlisted site rule, never expands to all sites, never leaves the device, and
is discarded with the disposable profile unless `--keep-profile` was explicit.

`--profile` is only for a dedicated Entropy QA profile. The resolved directory
must exist, must not be a symlink, must not contain an active Chrome singleton
lock, and must contain `.entropy-e2e-qa-profile.json` with this marker
contract. `scripts/qa/profile/entropyQaProfileMarker.mjs` is the canonical
validator shared by the harness, status/doctor, and managed lifecycle adapter.
Schema version 1 remains a natural/unprovisioned QA profile marker.
The explicit canonical day-7 provisioning command upgrades or creates schema
version 2:

```json
{
  "purpose": "entropy-site-e2e-qa-profile",
  "schemaVersion": 2,
  "fixtures": {
    "canonicalProgression": {
      "qualifiedUseDayCount": 7,
      "synthetic": true,
      "status": "ready",
      "activityDayKeys": [
        "YYYY-MM-DD",
        "YYYY-MM-DD",
        "YYYY-MM-DD",
        "YYYY-MM-DD",
        "YYYY-MM-DD",
        "YYYY-MM-DD",
        "YYYY-MM-DD"
      ]
    }
  }
}
```

Create and provision that profile separately:

```bash
npm run e2e:sites:provision-profile -- \
  --profile=/absolute/entropy-qa-profile \
  --progression-day=7
```

The command is idempotent. It presents and spends First Vision through the
background progression owner, records only the missing suffix of the marker's
seven strictly increasing past activity-day keys, and rejects an over-seven
count, cursor mismatch, family-prefix contradiction, malformed marker, symlink,
or active Chrome lock. It never reads site login data.

Provisioning uses one fixed harness-owned unpacked-extension slot beside the QA
profile. Chrome is not uninstalled. After the dev-only route completes and its
typed session projection row is absent, the slot is atomically replaced with
the public artifact and `Extensions.loadUnpacked` performs an in-place update.
The command requires the extension id to remain exact, verifies the public
build profile/build id and canonical day-7 snapshot, closes Chrome, relaunches
the same profile, and verifies both again. This avoids the data deletion risk
of uninstall/reinstall and the stale-service-worker risk of file replacement
without an explicit update.

Subsequent release runs may legitimately advance the durable raw activity-day
count above seven. Reuse therefore requires a canonical, non-debug projection
whose capped qualified-use day remains seven, whose complete ordered family set
is effective, and whose `veil` family is runtime-eligible; it does not require
the unbounded raw activity-day provenance count to remain exactly seven.

An ordinary release run remains read-only with respect to progression:

```bash
npm run e2e:sites -- \
  --suite=release-core \
  --lane=release \
  --site=tiktok \
  --profile=/absolute/entropy-qa-profile \
  --repeat=1
```

For a schema-v2 fixture the runner requires First Vision `spent`, canonical
source, both qualified-use counts equal to seven, the exact family prefix, and
Veil runtime eligibility before any scenario action. It never promotes a
profile. JSON and Markdown reports identify
`synthetic_canonical_progression`; missing or malformed markers fail loudly.
The public-build guard forbids both QA provisioning action strings/routes and
the existing progression/Runtime Debugger surfaces.

Allowed actions are allowlisted navigation/reload, bounded scroll, safe
play/pause/seek, non-destructive UI open/close or click, and Entropy development
setting changes inside the QA profile. The catalog forbids credential reads or
writes, post/comment/like/follow, purchase, download/upload, account/privacy or
security changes, form submission, deletion, CAPTCHA/2FA/terms bypass, and the
scenario-specific external-link/profile interactions listed as forbidden.

Reports never persist page bodies, usernames, messages, input values, settings
values, records, secrets, or serialized keys. Apart from the explicit in-memory
probe exception below, the current runner captures no screenshots or traces;
adding either requires an explicit opt-in contract and the same URL/content
privacy review.

`root-visual-continuity` owns one narrower reviewed exception to the no-capture
default. It inserts a 64px, pointer-inert solid-red QA patch under the filtered
document root, reattaches it before paint if the SPA rebuild removes it, and
consumes a bounded `Page.startScreencast` only in memory. The
runner decodes the single known probe pixel from each compositor frame, retains
only chroma/count summaries and frame serials, reports `persistedFrameCount: 0`, and
discards every encoded frame. It never retains the surrounding page image,
DOM text, media, or link query. This proves actual compositor-frame continuity
for the declared same-document transition without turning the suite into a
screenshot artifact path.
YouTube CDN/network console failures are retained in the report but are
advisory for this target only; page-script and extension-runtime errors keep
their normal non-pass semantics.

That statement applies to the legacy `site_runtime` suites above. The separate
`sentinel_runtime` protocol implements the reviewed exception: it writes no
page DOM or text, retains only the URL origin, and defaults
`captureScreenshots` to false. When an operator explicitly passes
`--capture-screenshots=true`, full page screenshots may contain authenticated
page content and are stored only under that QA run's attachments. Site and
Global Sentinel both use one bounded page screencast and bind each PNG to the
first compositor frame after its structured stage snapshot; the manifest keeps
the frame serial, timestamp, and capture lag with that stage.
An agent Sentinel run is also self-contained when the managed Windows QA
browser has no page. The upper session may accept the first native window
foreground side effect exactly once, creates a recovery-journaled blank anchor,
immediately minimizes Chrome, and proves it is no longer foreground. The
protocol then records background preservation before and after harness start,
after target activation, after STOP, and once more after every exact owned
target closes; any later foreground acquisition is a contract failure. Human
mode does not receive this initial-window capability.
