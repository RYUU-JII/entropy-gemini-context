# Memory Purge Artifact Workflow Boundary Map

- Status: Active
- Owner: dashboard Tools selected-family controller, memory purge history/bookmark hooks, background tracking storage support handlers, activation reconciler, ceremony platform
- Last validated against code: 2026-10-04
- Path policy: current-only
- Canonical for: Echo artifact history cleanup, activation catch-up, blocked bookmark destruction preview/backup/confirm, destructive auth handoff, dashboard-side purge ceremony, and page-side bookmark-neutralized ceremony separation
- Companion to:
  - `docs/architecture/repository/tools-artifact-support-boundary-map.md`
  - `docs/architecture/repository/protection-content-runtime-boundary-map.md`
  - `docs/architecture/repository/background-runtime-boundary-map.md`
  - `docs/architecture/repository/settings-command-boundary-map.md`
  - `docs/operations/qa/echo-artifacts-e2e.md`

## Purpose

This map audits the Echo / Memory Purge artifact workflow. The dashboard may
ask for previews, confirmations, backups, and local ceremony playback, but it
must not delete history/bookmarks directly, hide owner failures behind generic
access-denied states, or reuse the page-side bookmark-neutralized ceremony for
dashboard-side destructive actions.

The practical reading question is:

```text
Can a destructive memory-purge action be traced from the Tools artifact card to
the background owner and back to a visible status, without leaking raw URLs or
mixing dashboard purge feedback with content-side bookmark neutralization?
```

## System Flow

Artifact card to selected-family controller:

```text
ToolsTab
  -> useToolsTabController()
  -> selectedArtifactControllerResource (Echo module after intent)
  -> widget + Echo controller ACK before selection commit
  -> SelectedEchoArtifactController
       -> useProtectionBlockedHistoryControl()
       -> useProtectionEchoArtifactControl()
  -> artifactWorkflowReviews.echo
  -> buildMemoryPurgeCard()
  -> ArtifactGalleryView control-rail takeover
  -> MemoryPurgeReviewSurface
```

History cleanup:

```text
historyCleanup toggle
  -> ensureHistoryPermission()
  -> PREVIEW_BLOCKED_HISTORY
  -> optional destructive auth policy
  -> MemoryPurgeReviewSurface(mode="history")
  -> CLEANUP_BLOCKED_HISTORY with authorization
  -> background cleanup / memory-purge confirmation owner
  -> visible history status
  -> dashboard MEMORY_PURGE_TIDE ceremony when records were erased
```

Extension activation catch-up:

```text
fresh extension/browser activation
  -> runtime.history_cleanup_activation session checkpoint read
  -> durable historyCleanupForBlocked consent read
  -> canonical Echo family/global suppression admission
  -> current history permission read
  -> one full blocked-history cleanup when enabled and granted
  -> permission-missing activation completes without repeatedly probing the API
  -> completed session checkpoint
  -> later MV3 service-worker wakes skip the full scan
```

History permission restoration:

```text
chrome.permissions.onAdded(history)
  -> clear runtime.history_cleanup_activation
  -> re-read durable historyCleanupForBlocked consent
  -> canonical Echo family/global suppression admission
  -> require the newly granted history capability
  -> one full blocked-history catch-up
  -> completed session checkpoint
```

Visit-time history cleanup:

```text
history.onVisited(exact URL)
  -> existing full-init/profile admission
  -> HistoryManager.maybeDeleteHistoryForUrl(exact URL, canonical settings)
tabs.onUpdated(complete, exact URL)
  -> existing per-tab FIFO/full-init/profile admission
  -> HistoryManager.maybeDeleteHistoryForUrl before document/protection work
  -> protection ingress freshness, Gate, readiness and dispatch
```

The completed-visit deletion is independent of protection transport, stats reads,
Gate navigation suppression and document supersession. It remains inside the
existing admission owner and does not retry a browser deletion. The history owner
matches YouTube paths/query parameters and `youtu.be` through the existing site
alias contract, and deletes the exact visit URL. A delete failure rejects with
`HISTORY_DELETE_FAILED`; the completion handler reports the named best-effort
`TAB_COMPLETE_HISTORY_DELETE_FAILED` diagnostic and continues protection. The
history-event gate retains its own failure diagnostic. The minute recent-history
sweep and activation catch-up remain their existing reconciliation paths.

Bookmark destruction:

```text
bookmarkConceal toggle
  -> ensureBookmarksPermission()
  -> PREVIEW_BLOCKED_BOOKMARKS
  -> MemoryPurgeReviewSurface(mode="bookmark_destroy")
  -> optional EXPORT_BLOCKED_BOOKMARKS_HTML backup
  -> confirm setting enable through typed protocol store
  -> preserve settings commit and application receipt separately
  -> visible count-free enabled, pending, or apply-failed status
  -> existing SettingsCommandFeedbackBridge owns application retry
```

Page-side bookmark neutralization stays separate:

```text
background protected-bookmark cleanup / page-side event
  -> content ceremony message
  -> ContentCeremonyHost
  -> BOOKMARK_NEUTRALIZED ceremony
```

## Owner Table

| Concern | Owner | Key files | Output | Forbidden shortcut |
| --- | --- | --- | --- | --- |
| Echo artifact surface | Tools artifact card pipeline | `buildMemoryPurgeCard.jsx`, `ArtifactGalleryView.jsx` | toggle controls and an Echo-owned control-rail review | deleting browser data from card code |
| Echo controller admission | Tools selected-family resource/boundary | `selectedArtifactControllerResource.js`, `SelectedArtifactControllerBoundary.jsx`, `SelectedEchoArtifactController.jsx` | one lazy controller record shared by intent/selection/render, with retry and generation fencing | importing destructive hooks into the base control plane or committing Echo before controller readiness |
| Destructive action review | dashboard inline review UI | `MemoryPurgeReviewSurface.jsx`, `InlineActionReviewSurface.jsx` | compact impact summary, domain counts, cancel, backup, passcode, and approval controls | modal overlays, raw URL lists, or visible actions without workflow handlers |
| History cleanup UI state | dashboard history cleanup hook | `useProtectionBlockedHistoryControl.js` | preview state, auth state, visible status | collapsing owner failures to generic access denied |
| Bookmark destruction UI state | dashboard echo artifact hook | `useProtectionEchoArtifactControl.js` | preview/backup/confirm state and status | restoring or previewing raw bookmark URLs in dashboard |
| Workflow error display | dashboard artifact error helper | `protectionArtifactWorkflowErrors.js` | redacted error code/detail | raw URL-bearing errors in UI status |
| Durable artifact settings | protocol settings store | `useProtocolStore.js` | `historyCleanupForBlocked`, `concealBlockedBookmarks` | direct Chrome storage/localStorage writes |
| Echo destructive admission | background history adapters + protection runtime policy | `backgroundKernelAdapters.js`, `echoArtifactMutationPolicy.js`, `HistoryManager.js`, `BookmarkConcealManager.js` | strict canonical family/global suppression and settings-version/scope currentness before each browser removal | using preserved child consent as effective permission or starting a late batch after pause |
| Activation and permission-restoration history catch-up | background activation reconciler + runtime session checkpoint repository | `BackgroundHistoryCleanupActivationReconciler.js`, `HistoryCleanupActivationCheckpointRepository.js` | one checkpointed activation decision per loaded extension session plus one forced catch-up after each history permission grant; failed permission-grant cleanup leaves the checkpoint absent and retryable | full history scans on every MV3 worker wake or treating a stale completed checkpoint as proof after permission restoration |
| Inactive blocked-tab evaporation | SettingsService policy, tracking alarm admission, TabEvaporationManager execution | `backgroundKernelAdapters.js`, `trackingBrowserEventHandlers.js`, `TabEvaporationManager.js`, `TabEvaporationCheckpointRepository.js` | current-policy-fenced removal ACK and partial failure result; session-only inactivity observation | closing from an old inventory, treating last activation as inactivity start, worker-only timers, or reporting failed removal as success |
| Destructive runtime routes | background tracking support handlers | `storageSupportHandlers.js` | preview/cleanup/export responses | dashboard-side direct history/bookmark APIs |
| Destructive auth policy | background runtime sender/security policy | action sender/destructive policy, security store | auth requirement and passcode validation | UI-only passcode trust |
| Dashboard purge ceremony | ceremony event bus | `requestCeremony()`, `MEMORY_PURGE_TIDE` | dashboard overlay effect | page-side ceremony message reuse |
| Page bookmark neutralization | content ceremony host | `ContentCeremonyHost*`, `BOOKMARK_NEUTRALIZED` | content-page overlay effect | dashboard purge using page-side neutralization route |

## Function Ledger

| Boundary function | Input | Output | Failure / missing-data policy |
| --- | --- | --- | --- |
| `handleHistoryCleanupToggle()` | next history cleanup value | preview/confirm state or committed setting | permission API, preview, and setting failures surface redacted detail |
| `preloadToolsSelectedArtifactController('echo')` | Echo navigation intent or selected id | validated controller module ACK shared with render | rejection keeps the currently committed artifact; retry replaces the failed generation and stale completions are ignored |
| selected-controller navigation admission | next disclosed artifact index | selection only when no Echo review/preview/confirmation operation owns the rail | pending destructive work keeps Echo selected until explicit Cancel/Confirm settles it |
| `handleHistoryConfirm()` | optional passcode | cleanup result and enabled state | auth failures stay auth-specific; delivery/owner failures surface detail |
| `reconcile()` | fresh loaded-extension activation | `cleaned`, `disabled`, `paused`, `permission_missing`, or `already_reconciled` | malformed settings/checkpoints and capability read failures reject; paused or failed cleanup is not checkpointed |
| `reconcileAfterHistoryPermissionAdded()` | observed `history` permission grant | forced full cleanup result after clearing the activation checkpoint | a grant that cannot be re-read rejects; failed cleanup leaves the checkpoint absent for a later activation retry |
| `MemoryPurgeReviewSurface` | active workflow review state | right-rail impact summary and visible actions | active review requires confirm/cancel plus mode-specific passcode/backup handlers instead of optional no-ops |
| `handleBookmarkConcealToggle()` | next bookmark destruction value | preview/confirm state or committed setting | permission API, preview, and setting failures surface redacted detail |
| `handleBookmarkBackup()` | current blocked-bookmark owner state | downloaded HTML backup | export/download failures surface detail and backup error; runtime backup result must include non-empty `html`/`filename` and numeric `count`/`domains` |
| `handleBookmarkConfirm()` | pending bookmark confirmation | committed setting plus acknowledged application status | failed/timeout application preserves saved consent and the command bus retry; preview quantities cannot prove removals |
| `describeProtectionArtifactWorkflowError()` | thrown error or owner code | URL-redacted error text | empty errors become stable fallback codes |
| `storageSupportHandlers.CLEANUP_BLOCKED_HISTORY` | trusted runtime request | validated cleanup/confirm response | invalid owner output returns explicit error code |
| `storageSupportHandlers.PREVIEW_BLOCKED_BOOKMARKS` | trusted runtime request | validated preview items | non-extension senders are rejected before owner call |
| `requestCeremony()` | dashboard ceremony request | dashboard event bus overlay request | invalid ceremony id throws; dashboard-side only |

## Recovery Versus Fallback

| Class | Allowed? | Rule |
| --- | --- | --- |
| Permission denied | Yes | visible denied status; no cleanup/preview owner call proceeds |
| Permission API failure | No fallback | visible denied status must include redacted error detail; do not collapse API failure into user denial |
| Empty preview | Yes | may enable durable setting without confirmation because there is nothing to delete |
| Destructive auth required | Yes | confirmation remains open until passcode is provided |
| Auth failure | Yes | visible auth failure; not collapsed into purge failure |
| Active review handler missing | No fallback | confirm/cancel/passcode/backup controls require their workflow handlers when visible |
| Runtime delivery failure | No fallback | visible owner/delivery detail; no local cleanup attempt |
| Invalid owner output | No fallback | background returns explicit invalid-output code; preview/cleanup summary items require `domain` plus numeric count fields |
| Invalid confirm version | No fallback | `confirmMemoryPurge` version must be finite; it must not default to zero |
| Raw URL in UI error | No | dashboard status redacts URL substrings |
| Bookmark application status | Receipt-owned | settings ACK is preserved separately from application success; no preview-derived removed count or ceremony |
| Page-side bookmark neutralized ceremony | Separate | uses `BOOKMARK_NEUTRALIZED` through content ceremony host only |
| Direct browser history/bookmark mutation in dashboard | No | dashboard must use runtime owner routes |

## Current Findings

### F1. Dashboard cleanup and page-side bookmark neutralization are separate

Status: keep.

Dashboard history cleanup uses the `MEMORY_PURGE_TIDE` overlay only with the
history owner's deletion result. Bookmark settings application carries no actual
removal count, so it displays a count-free state and emits no purge ceremony.
Page-side protected
bookmark neutralization remains a content ceremony route using
`BOOKMARK_NEUTRALIZED`. These must not be merged into one vague ceremony path.

### F2. Background owner routes already validate destructive outputs

Status: keep.

The background storage support handlers reject invalid cleanup, preview, and
backup output shapes before returning success. Trusted sender and destructive
auth policies are enforced outside the dashboard hook state.

### F3. Dashboard workflow failures now stay diagnosable

Status: fixed in the 2026-06-29 Memory Purge artifact workflow pass.

History preview failures, history cleanup delivery failures, bookmark preview
failures, bookmark commit failures, and bookmark backup failures now surface
redacted owner/error detail in the workflow status. The hooks no longer collapse
these paths into a generic `ACCESS_DENIED` result.

### F4. Bookmark backup is a pre-destruction support action, not a source of truth

Status: keep.

`EXPORT_BLOCKED_BOOKMARKS_HTML` produces a local HTML backup for the user before
irreversible bookmark destruction. The backup does not become a canonical
bookmark mirror, and dashboard code does not inspect or restore raw URLs.

### F5. Active destructive reviews require workflow handlers

Status: fixed in the 2026-06-29 handler contract pass; moved inline in the
2026-07-20 control-rail review pass.

`MemoryPurgeReviewSurface` is materialized only for an active Echo workflow. It
requires confirm and cancel handlers, requires the passcode input handler when
auth input is visible, and requires the bookmark backup handler in
bookmark-destruction mode. Destructive UI controls do not collapse to optional
callback no-ops.

### F6. Permission API failures are separated from user denial

Status: fixed in the 2026-06-30 Memory Purge permission pass.

History cleanup and blocked-bookmark destruction now call strict permission
gate entrypoints. If the browser permission API is unavailable, fails, or
returns an invalid boolean result, the workflow status keeps the familiar
permission-denied headline but includes the redacted failure code in detail and
does not call preview or setting owners. A real user denial remains a visible
denied state with empty detail.

### F7. Memory Purge impact review stays inside the selected artifact rail

Status: fixed in the 2026-07-20 control-rail review pass.

The old centered modal has been retired. A pending history or bookmark action
temporarily replaces the Echo artifact controls with a single-column review:
total affected items, domain count, and at most seven domain-level rows. Raw
URLs and favicons are not rendered. Bookmark destruction keeps a local backup
action and requires one irreversible-action acknowledgement; history cleanup
does not add a typed ritual.

### F8. Echo destructive workflow is selected-only

Status: fixed in the 2026-08-09 Tools controller split.

The base protection control plane retains only the persisted Echo setting
projection needed for navigation/runtime summaries. Permission gates, history
preview, bookmark preview/backup, auth state, and confirmation state enter through
`SelectedEchoArtifactController` only when Echo is admitted. Navigation intent
warms that controller through the same resource used by render, and selection
commits only after both the theme widget and controller are ready. A load failure
therefore leaves the current artifact visible with local retry.

An open review, pending preview, backup, or accepted confirmation operation owns
the selected control rail and blocks artifact-away navigation. The user must
explicitly Cancel or let Confirm settle before another artifact can commit. When
the selected controller becomes inactive, a shared workflow generation fence
drops late UI completions so old preview/confirmation state cannot reappear;
already accepted canonical history/bookmark mutations are still allowed to
finish exactly once.

### F9. Echo automatic removals share suppression and final mutation admission

Status: fixed in the 2026-10-04 artifact logic audit.

`echoArtifactMutationPolicy.js` requires the complete canonical
`artifactControlState`. The background history adapters apply its family/global
suppression to activation, permission catch-up, visits, alarm sweeps, settings
effects and inactive-tab expiry. Each admitted mutation captures the settings
version and blocked scope; history and bookmark managers require the resulting
currentness predicate before every browser deletion and subsequent batch.
Automatic full cleanup also requires current history consent; authorized
confirmation retains its explicit OFF-to-ON semantics. A superseded operation
rejects with `ECHO_ARTIFACT_MUTATION_CANCELLED`; browser removals already accepted
may settle once. Paused activation does not mark the session checkpoint complete.
Resume changes suppression only and schedules the existing history/bookmark
cleanup owners. The same settings adapter resets tab inactivity observations so
paused time is not removal proof.

Disabled or paused bookmark synchronization still calls its required canonical
owner with `enabled: false`. The owner returns `status: disabled` or
`status: suppressed` with no bookmark tree read or removal; the adapter does not
invent an empty deletion result or replace a missing owner.

### F10. Bookmark confirmation preserves committed and applied states

Status: fixed in the 2026-10-04 artifact logic audit.

The protocol setter preserves the application receipt. Echo displays pending
or failed cleanup for `timed_out`, `failed`, and `schedule_failed` receipts while
leaving saved consent intact. `SettingsCommandFeedbackBridge` retains the
existing owner-task retry; Echo neither repeats the saved patch nor creates a
second recovery queue. A successful receipt displays bookmark cleanup enabled;
an unchanged acknowledgement without a receipt cannot prove application success.
The preview is an impact estimate, never an actual removed count. Preview,
one-shot HTML backup and deletion share canonical `isSiteRuleMatch` aliases.

## Inactive Tab Evaporation Contract

`tabEvaporationForBlocked` is a separate explicit settings consent from history
cleanup, bookmark destruction, and an intervention's Leave decision. Its scope
is `blockedUrls`, with canonical site-rule matching and the validated
`tabEvaporationTimeoutMinutes` value. `SettingsService` remains the policy owner;
the manager neither reads raw settings storage nor invents a default timeout.
The artifact's timeout choice calls `setTabEvaporationConfig({ enabled: true,
timeoutMinutes })`, which commits both canonical settings in one protocol command.
The child command owns this activation semantics for every theme. OFF writes only
the enabled consent and preserves the selected timeout. Both commands propagate
canonical write failures; the control presentation retains pending intent until
the acknowledgement, then displays canonical props or a redacted failure.
`TabClosureArbiter` continues to authorize intervention conclusions using exact
leases/documents. Ambient inactive-tab expiry uses its own settings/time/live-tab
proof through the same background browser port; it does not fabricate a Furin or
Enso lease and does not close an active tab to complete an intervention.

```text
existing tracking tick alarm -> full init and profile-mutation admission
  -> ensureSettingsCache (canonical settings mutation lane)
  -> enabled + unsuppressed Echo + nonempty scope + no pending evaporation runtime adapter
  -> capture settings version/scope/timeout and current-policy predicate
  -> one joined sweep -> typed session observation read
  -> tabs.query(active:false, pinned:false, audible:false)
  -> first observed inactivity / same interval after worker recreation
  -> elapsed threshold -> tabs.get(id), revalidate current live identity/state
  -> recheck policy -> tabs.remove(id) -> removal ACK -> checkpoint settlement
```

Chrome's `lastAccessed` is the time the tab last became active, not the time it
became inactive ([Tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs#property-Tab-lastAccessed)).
The first eligible observation starts `inactiveSince`. The saved URL and
`lastAccessed` must remain equal; reactivation or navigation starts a new interval.
Missing metadata, loading or pending navigation, active, pinned, audible and
out-of-scope tabs cannot authorize removal. Active means selected in its own
window, regardless of OS focus. This is sampled eligible inactivity, not proof
that pin/audio state never changed between alarm samples.

`runtime.tab_evaporation` contains only versioned inactivity observations and a
scope/timeout signature. It is not a settings mirror or removal permission.
Worker recreation reuses matching observations but repeats all browser/policy
checks. Browser-session loss starts observation anew. No timer or extra poll is
introduced. An enabled sweep performs one filtered inventory, one final read per
mature candidate, and at most one checkpoint write when observations change.
Overlapping sweeps join one promise; paused/disabled/empty-scope calls skip the manager.

Changes to `artifactControlState`, `blockedUrls`, `tabEvaporationForBlocked`, or
`tabEvaporationTimeoutMinutes` schedule the existing durable `runtime_adapters`
stage. Its reset synchronously revokes the manager generation, drains the old
sweep and clears its checkpoint before succeeding. Failure retains reset work.
The coordinator's `hasPendingRuntimeSettingsAdapters(keys)` is a read of owned
pending/processing/retained-failed work, not another policy cache: new sweeps wait
for that stage, including after worker restoration. In-flight sweeps also check
the canonical worker settings version, so OFF/ON ABA does not revive them.
Unrelated content catch-up failure does not block an already settled reset.

An exact missing-tab result is a settled disappearance, not evaporation success.
Other lookup, removal, checkpoint and callback failures remain explicit. One
tab failure does not skip independent candidates. Partial ACKed removals and
failures survive error reporting, including cancellation after a failure. No
retry loop is added; later existing alarms re-read the browser. A Chrome removal
already issued cannot be revoked by a later OFF. `tabs.get` and `tabs.remove`
are separate APIs without atomic conditional removal: a last-moment activation
after the final read remains a platform race, not a guaranteed cancellation.

## Session Amnesia retirement — 2026-09-19

Echo has three children: history cleanup, bookmark concealment/destruction, and
inactive tab evaporation. Session Amnesia is retired by product decision: periodic
logout across protected domains is not an intended friction mechanism. No cookie
permission, cookie browser port, cookie deletion manager, cadence, control, or
runtime cleanup result remains. Existing security guards continue to forbid the
cookies permission and browser cookies API.

Normal settings commands/reads reject the two former settings. Startup does not
erase or translate them; incompatible development profiles use the explicit
whole-profile reset in `docs/operations/runbooks/pre-release-development-profile-reset.md`.
No settings read accesses or deletes site cookies. History/bookmark consent and
workflow ownership are unchanged.

## Re-Audit Checklist

- Run `npm run test:file -- tests/memoryPurgeReviewSurface.test.jsx tests/toolsArtifactCardSchemaContract.test.js tests/artifactGallerySmoke.test.jsx tests/useProtectionBlockedHistoryControl.test.jsx tests/useProtectionEchoArtifactControl.test.jsx` after dashboard memory-purge workflow changes.
- Run `npm run test:file -- tests/trackingMessageHandlerSecurity.test.js tests/trackingMessageHandlerOwnerVisibility.test.js` after background destructive route or auth changes.
- Run `npm run lint -- src/apps/dashboard/hooks/protectionArtifactWorkflowErrors.js src/apps/dashboard/hooks/useProtectionBlockedHistoryControl.js src/apps/dashboard/hooks/useProtectionEchoArtifactControl.js tests/useProtectionBlockedHistoryControl.test.jsx tests/useProtectionEchoArtifactControl.test.jsx` after dashboard workflow/error-surface edits.
- Confirm dashboard-side purge feedback continues to use `MEMORY_PURGE_TIDE`.
- Confirm content/page-side bookmark neutralization continues to use `BOOKMARK_NEUTRALIZED`.
- Confirm no dashboard code calls browser history/bookmark APIs directly.
- Run `npm run test:file -- tests/tabEvaporationManager.test.js tests/tabEvaporationCheckpointRepository.test.js tests/backgroundKernelTabEvaporationSettings.test.js tests/backgroundKernelAdaptersMemoryPurge.test.js tests/backgroundKernelHistoryBrowserPort.test.js tests/backgroundSettingsPropagationCoordinator.test.js` after evaporation lifecycle changes. Use deferred inventory/final-read/removal/reset gates; do not substitute a model for the product manager.
