# Navigation Continuity Runtime Boundary Map

As of 2026-09-11, ordinary Gate Continue uses the shared session approval owned
by `GateRuntimeStateOwner` under `../runtime/intervention-admission-runtime.md`.
Navigation continuity supplies entry/return boundaries, never host approval
timers or causal pass relays. The remaining timed pass covers only the tab kept
at detour review; no navigation callback creates or renews shared approval.

- Status: Active
- Owner: tracking background navigation continuity service, tracking browser event handlers, Gate runtime state owner
- Last validated against code: 2026-09-09
- Path policy: current-only
- Canonical for: tab creation context, committed/completed navigation continuity, foreground host/session continuity, media-maintenance return signals, and gate entry intent hints
- Companion to:
  - `docs/architecture/repository/storage-stats-tracking-boundary-map.md`
  - `docs/system-architecture/05-background-runtime-owners.md`
  - `docs/system-architecture/02-runtime-storage-boundaries.md`

## Purpose

Navigation continuity is the tracking runtime's short-lived memory of how a tab,
host, and foreground session moved. It prevents ordinary browser lifecycle noise
from being counted as new intent, and it gives protection gate state enough
context to avoid treating media-maintenance returns as fresh site entry.

The practical reading question is:

```text
Can every entry/return decision be traced from browser event to continuity
state, session persistence, and gate hint without volatile-storage fallback or
second decision ownership?
```

## System Flow

Background construction:

```text
backgroundKernelCoreServices
  -> RuntimeSessionRepository.getInstance()
  -> backgroundKernelTrackingRuntimeBindings
  -> backgroundKernelTrackingBrowserBindings
  -> createTrackingBrowserEventHandlers(sessionStore)
  -> createNavigationContinuityService(sessionStore, runtime.tab_navigation_state)
```

Navigation event path:

```text
chrome/webNavigation/tabs/windows event
  -> trackingBrowserEventHandlers.waitForInit()
  -> navigationContinuity.ensureLoaded()
  -> NavigationContinuityService mutation/decision
  -> navigationContinuity.persist()
  -> TabTimeTracker / protectionRuntimeStateCoordinator / stats intent owner
```

Protection gate hint path:

```text
NavigationContinuityService continuity DTO
  -> GateRuntimeStateOwner.noteGateForegroundTab() / noteGateActiveNavigation()
  -> normalizeGateContinuityFacts()
  -> resolveContinuityEntryIntent()
  -> gate host runtime state patch
```

## Owner Table

| Concern | Owner | Key files | Output | Forbidden shortcut |
| --- | --- | --- | --- | --- |
| Session persistence owner | runtime session repository injected from background kernel | `RuntimeSessionRepository.js`, `backgroundKernelTrackingRuntimeBindings.js` | `runtime.tab_navigation_state` snapshot | missing session store falling back to in-memory continuity |
| Browser event sequencing | tracking browser event handlers | `trackingBrowserEventHandlers.js` | ingress-time profile admission plus one ordered event body across init, tracking, protection, and persistence | detached tick/session mutation or direct continuity mutation without `ensureLoaded()` and `persist()` |
| Continuity decisions | navigation continuity service | `NavigationContinuityService.js` | visit intent, foreground relation, gate continuity DTO | moving decision branches into state normalization helpers |
| Snapshot contract | navigation continuity checkpoint validator | `navigationContinuityCheckpoint.js` | exact top-level and nested current record | coercing or dropping malformed current entries |
| Snapshot normalization | navigation continuity state helpers | `navigationContinuityState.js` | bounded, TTL-filtered already-valid snapshot arrays | treating normalization as malformed-data recovery |
| Gate entry hint consumption | Gate runtime state owner behind the app delegation facade | `GateRuntimeStateOwner.js`, `ProtectionRuntimeStateCoordinator.js` | gate entry intent, media-maintenance patches and foreground/return policy state | app coordinator-owned Gate state or recomputing navigation continuity from gate state alone |
| Confirmed consumed contexts | Tracking foreground sealer / consumption ledger, interpreted by Gate projection | `trackingForegroundSegmentSealer.js`, `TrackingConsumptionLedger.js`, `gateConsumedContextProjection.js` | closed, collection-admitted protected usage; session-checkpointed source watermark | treating a Gate entry/exit timestamp or an unprotected host as protected consumption |

## Function Ledger

| Boundary function | Input | Output | Failure / missing-data policy |
| --- | --- | --- | --- |
| `createTrackingBrowserEventHandlers()` | runtime owners, browser port, session store, session key | browser event handler API with a failure-resilient ingress-order sequence | missing session store/key throws at construction; one rejected event stays visible but cannot poison later events |
| `createNavigationContinuityService()` | runtime session store and session key | continuity service API | missing session store/key throws at construction |
| `ensureLoaded()` | presence-aware session read | exact checkpoint or missing bootstrap | only an absent key bootstraps; existing null/malformed state rejects |
| `persist()` | invocation-time continuity snapshot | serialized session snapshot write | writes preserve request order; own failure rejects without poisoning the next write |
| `noteCommittedNavigation()` | webNavigation commit details | committed navigation entry | invalid tab/host returns null and does not synthesize host data |
| `resolveTabCompleteVisitIntent()` | tab complete event | visit-intent decision | missing tab/host is explicit `tab_context_unavailable` |
| `noteForegroundTab()` | active tab foreground facts | foreground continuity DTO | missing host clears foreground scope and returns unavailable relation |
| `noteActiveNavigation()` | active loading navigation facts | foreground continuity DTO | same service decision path as foreground tabs |
| `normalizeGateContinuityFacts()` | continuity DTO plus gate host/tab | gate-safe continuity facts | absent continuity returns null; malformed host/tab/relation/entry intent/time throws; mismatched host/tab returns null |
| `observeGateDetourSpreadLevel()` | current protected count and exact unique tab IDs from the runtime input provider | clamped noticed/reviewed spread levels and last observed membership | contradictory count/IDs fail; exact tab removal clamps known membership without a second query or storage owner |

## Recovery Versus Fallback

| Class | Allowed? | Rule |
| --- | --- | --- |
| Stale persisted entries | Yes | TTL selectors drop stale entries during hydration; this is state hygiene, not alternate authority |
| Invalid tab id or hostname in an event | Bounded | return explicit unavailable/null result and avoid recording synthetic facts |
| Session store missing at construction | No | throw `TRACKING_BROWSER_EVENTS_SESSION_STORE_REQUIRED` or `NAVIGATION_CONTINUITY_SESSION_STORE_REQUIRED` |
| Session key missing at construction | No | throw `TRACKING_BROWSER_EVENTS_TAB_NAVIGATION_STATE_KEY_REQUIRED` or `NAVIGATION_CONTINUITY_SESSION_KEY_REQUIRED` |
| Session read failure | No fallback | `ensureLoaded()` rejects and leaves load state retryable |
| Session write failure | No fallback | `persist()` rejects; caller/event failure is visible |
| Existing null/malformed checkpoint | No fallback | throw `TAB_NAVIGATION_STATE_CONTRACT_INVALID:*`; do not coerce or partially hydrate |
| Gate continuity absent | Bounded | gate can use its own foreground scope heuristic, but must not recreate tab navigation state |
| Malformed gate continuity DTO | No fallback | throw `PROTECTION_GATE_CONTINUITY_FACTS_INVALID:*`; do not borrow gate host/tab/time, default missing entry intent, or collapse malformed media-maintenance facts |
| Browser API unavailable in tab-context snapshot | Separate seam | tab-context query failures reject through `trackingTabContextSnapshot.js`; they are not continuity persistence fallbacks |

## Current Findings

### F1. Continuity decisions and snapshot shaping are split

Status: keep.

`NavigationContinuityService.js` owns mutable maps and decision branches.
`navigationContinuityState.js` owns normalization, TTL filtering, and bounded
snapshot selection. `check:navigation-continuity:architecture` rejects moving
state-shape helper functions back into the service.

### F2. Session persistence is a required runtime owner

Status: fixed in the 2026-06-29 navigation-continuity pass.

The continuity service no longer treats a missing or failing session store as a
valid in-memory fallback. Runtime construction requires the session owner and
session key, `ensureLoaded()` rejects read failures, and `persist()` rejects
write failures.

### F3. Gate state consumes continuity hints, but does not own continuity

Status: tightened in the 2026-07-01 gate-continuity consumer pass.

`GateRuntimeStateOwner` accepts the continuity DTO through
`noteGateForegroundTab()` and `noteGateActiveNavigation()`. It normalizes and
validates host/tab alignment before applying entry-intent or media-maintenance
patches. A missing continuity object still lets gate-local heuristics preserve
existing behavior, but a malformed continuity DTO now throws
`PROTECTION_GATE_CONTINUITY_FACTS_INVALID:*` instead of borrowing the gate host,
tab, current time, or defaulting malformed media-maintenance facts to
ordinary non-media returns. This keeps upstream continuity service bugs from
silently rewriting entry intent or suppressing audible-return signals.
`ProtectionRuntimeStateCoordinator` preserves the public app-runtime API but
does not own Gate maps, foreground scope, continuity normalization, intervention
windows, or consumed protected-context state.

Confirmed consumption has a separate fact boundary documented in
`docs/architecture/runtime/tracking-consumption-facts.md`. Gate no longer derives
consumed contexts from these navigation callbacks. Its other return/pass fields
remain policy state; this does not make all Gate history restart-persistent.

### F4. Tab removal waits for background initialization

Status: fixed in the 2026-07-12 MV3 lifecycle pass.

`handleTabRemoved()` now follows the same `waitForInit()` gate as the other tab,
window, alarm, and navigation handlers. A tab closing during cold startup cannot
race continuity hydration, protection/content eviction, or active-session
settlement against partially initialized owners.

### F5. SPA history signals do not invalidate the content document

Status: fixed in the 2026-07-12 MV3 lifecycle pass.

Chrome may emit `tabs.onUpdated` loading/complete during History API traversal,
so those coarse tab signals no longer mark the content session stale. Top-frame
`webNavigation.onCommitted` owns document-navigation invalidation;
`onHistoryStateUpdated` records continuity intent while preserving the current
document id and receiver. When `webNavigation` is not granted, new document
bootstrap telemetry and bounded receiver-missing recovery still establish the
current document without treating a same-document route as a full navigation.

### F6. Current checkpoints are exact and full-snapshot writes are ordered

Status: fixed in the 2026-07-14 release hardening pass.

The session repository now exposes presence-aware reads, so a missing key is
distinct from an existing null value. `navigationContinuityCheckpoint.js`
validates every nested entry before hydration; TTL pruning applies only after
that validation. `persist()` captures the snapshot at invocation time and uses
an owner-local write tail, preventing a delayed older session write from
overwriting a newer navigation state. The tail recovers after a rejection while
each failed caller still observes its own error.

### F7. Foreground event owner failures remain observable

Status: fixed in the 2026-07-29 browser-event failure-visibility pass.

`handleTabActivated()` and `handleWindowFocusChanged()` do not wrap the
foreground tab/window read, stats mutation, continuity checkpoint, gate-state
update, or protection dispatch in a broad catch. A failure from those canonical
owners rejects the admitted handler Promise and reaches
`backgroundKernelBrowserEventListener.js`, which records the named ordinary
browser-event rejection. Event bodies do not share a rejection tail, so that
failure cannot poison a later event.

Only explicitly non-authoritative work remains isolated behind named
best-effort diagnostics, such as favicon capture, memory-purge artifact cleanup,
tab-switch nudge stopping and bounded settings-propagation waiting. Detour has
no opener notice delivery.

### F8. Spread inventory follows live tabs and exact removal

Status: fixed in the 2026-09-27 Gate lifecycle pass.

The protected-tab inventory counts a first pending web navigation while a new
tab still reports a non-web document. A redirected Gate session contributes its
original protected URL only while the live tab is on that exact session's Gate
page. Closed tabs, replaced Gate pages and Back navigation to an outside site
cannot remain in the count solely through an asynchronously cleaned session.

The existing Gate owner retains only the exact IDs from its last inventory.
Every tab removal, including background tabs, evicts Gate pass state and clamps
settled spread levels when the removed ID was observed as protected. Closing
then immediately reopening a tab therefore rearms the guard even if no snapshot
observed the temporarily smaller count. Unrelated and duplicate removals do not
lower the levels. A subsequent inventory also clamps levels to retained tab IDs,
so equal totals cannot hide a protected tab leaving the set and a new one joining.
Reordering and same-tab protected navigation preserve membership and the settled
level. The inventory remains the sole source of protected membership;
there is no extra browser query, persistence key or independent tab classifier.

Background creation/loading enters the canonical global inventory without
notifying or replacing the opener. Only explicit foreground entry/activation
projects `gateEntryObserved`; settings/timer snapshots cannot invent it. Loading/
complete Gate lifecycle calls still carry the protection ingress receipt and
watermark; a top-level Gate keeps ownership until exact validated resume or escape.
External manual tab closes revalidate pending Detour sessions through the same
inventory owner and can resume their exact original URL without a decision/pass.

## Validation

- `check:tracking-browser-events:architecture` verifies media-revision receipt
  acquisition and single-use validation in `trackingTabActivityObservation`;
  environment construction and settlement remain checked in their separate owner.
- `npm run check:navigation-continuity:architecture`
- `npm run check:tracking-browser-events:architecture`
- `npm run check:background-kernel:architecture`
- `npm run test:file -- tests/navigationContinuityService.test.js tests/navigationContinuityState.test.js tests/trackingBrowserEventHandlers.test.js tests/protectionRuntimeStateCoordinator.test.js`
- `node scripts/e2e/mv3LifecycleE2E.mjs --dist=<built-extension-dir>`
