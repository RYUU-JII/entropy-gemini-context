# Notifications Release Hardening Plan

- Status: Draft
- Date: 2026-04-11
- Scope: notification delivery hardening, settings/runtime boundary cleanup, click-routing convergence, and release-readiness sequencing
- Depends on:
  - `docs/product/dashboard/notifications-opt-in-runtime-plan.md`
  - `docs/product/dashboard/reflection-entry-surface-plan.md`
  - `docs/system-architecture/02-runtime-storage-boundaries.md`
  - `docs/system-architecture/05-background-runtime-owners.md`
- Owner: dashboard architecture / background runtime
- Last validated against code: 2026-04-11
- Path policy: planning-allowed
- Canonical for: release-sequenced notification hardening tasks and shipping gates after the first implementation review

Scope update:

- reflection has been explicitly deferred out of the initial release baseline
- delayed reminder hardening tasks described below are therefore superseded for the current shipping cut
- the active release baseline is immediate, background-owned notification delivery for schedule-owned events

## 1) One-line decision

The notifications rollout should now harden around one release-safe promise:

- background-owned delivery
- `settings.core.notificationsConfig` as the only durable product setting seam
- `runtime.notification_state` as the only delivery runtime seam
- schedule-owned start/end notifications as the only active shipping family in the current baseline
- reflection is deferred until a dedicated product surface and owner seam exist

This means the next implementation pass is not "add more notification features".

It is:

- narrow scope where needed
- remove boundary leaks
- make delayed delivery survive real MV3 runtime behavior
- make catalog, routing, and verification seams canonical

## 2) Why this plan exists

The first implementation pass created the right broad seam, but the review found several release-blocking or structure-weak areas:

- delayed reflection delivery currently depends on in-memory timers that can disappear on service-worker suspend
- notification catalog metadata is duplicated by service-level copy/routing logic instead of being canonical
- `notificationsConfig` currently leaks into the protection broadcast path
- visible product surface is broader than the actual event-producer set
- Schedule soft opt-in logic is implemented as component-local heuristics rather than a reusable advisory seam
- tests and verification have not fully caught up with runtime shape changes

None of these problems suggest deleting the notification seam.

They do suggest hardening the seam before expanding it.

## 3) Shipping baseline for the next implementation pass

The next coding pass should adopt the following scope decisions.

### 3.1 Guaranteed shipping family

The only notification family that should be treated as guaranteed release scope is:

- schedule window end

Why:

- it already has a concrete producer
- it does not require delayed delivery to be useful
- it has the clearest click-through destination
- it best matches the current Schedule opt-in product story

### 3.2 Conditional family

Reflection suggestion remains conditionally shippable.

It may ship only if the same pass lands:

- suspend-safe delayed scheduling
- boot-time recovery/reconciliation for pending reminders
- route and copy seams that are canonical enough for future reflection surfaces

If those conditions are not met, reflection should remain hidden or disabled in visible product UI for the release candidate.

### 3.3 Deferred families

The following families should not remain first-class visible release promises until their producer seams exist:

- focus session start
- focus session end
- generic session-start copy that implies both focus and schedule producers already exist

They may remain in internal contracts if that simplifies code organization, but they should not shape release-facing settings copy or toggles until their canonical emitters are wired.

### 3.4 Permission model decision for this hardening pass

Do not reopen the permission model into a full optional-permission migration in this pass.

For the current release hardening pass:

- keep the existing manifest permission model
- add explicit capability/readiness handling inside the notification seam and UI
- treat optional-permission migration as later product/platform work unless it becomes a release requirement

This keeps the pass focused on structural correctness rather than reopening platform scope.

## 4) Target end-state for release hardening

The hardening pass is complete only when the following are true.

### 4.1 Delivery survives normal MV3 suspend/resume

Pending reflection reminders must not depend solely on in-memory `setTimeout`.

Acceptable end-states:

- `chrome.alarms` owns delayed firing
- or background boot reconciles `pendingByDeliveryKey` and re-schedules/re-fires safely

Unacceptable end-state:

- pending reminders are cleared on suspend without recovery

### 4.2 Catalog is the single descriptor owner

`notificationCatalog.js` must become the canonical owner of:

- title/message keys
- default copy fallback
- click action
- route contract
- delivery kind metadata

`NotificationService.js` may interpret descriptors, but it must not maintain a second event-specific copy map.

### 4.3 Settings changes stay inside their proper boundary

`notificationsConfig` must:

- refresh background settings cache
- propagate to dashboard state via the existing settings seam

It must not:

- participate in protection broadcast
- trigger content-side protection refresh work
- become a hidden runtime-side config mirror outside `settings.core`

### 4.4 Product surface matches real producers

Visible settings and prompt copy must describe only notification families that can actually emit in the release candidate.

There must not be:

- a shipping toggle for a family with no canonical producer
- release-facing copy that implies focus-session delivery when only schedule delivery exists

### 4.5 Click routing is explicit and extensible

Click handling must remain background-owned, but the route contract should be expressive enough to evolve into:

- richer reflection entry points
- commands-based actions
- side-panel routing

without rewriting the core service again.

Reflection meaning and the first landing-surface shape should follow:

- `docs/product/dashboard/reflection-entry-surface-plan.md`

### 4.6 Schedule advisory logic is reusable

Schedule soft opt-in behavior should come from a reusable advisory rule, not from one component's private ref-based heuristic.

The UI may still own local dismiss visibility, but eligibility should be derived from a named seam.

### 4.7 Verification reflects the new runtime contracts

Tests and acceptance checks must reflect the current storage/runtime shapes.

A release-hardened notification seam is not complete if runtime state shape changes can land without targeted tests being updated.

## 5) Phase plan

## 5.1 Phase 1: Scope reset and contract cleanup

Goal:

- make the release promise smaller and truer before touching behavior

Tasks:

- narrow release-facing settings copy from "session or schedule" to schedule-owned language unless focus emitters are added in the same pass
- decide whether reflection remains visible in settings for the release candidate or is temporarily hidden behind the delayed-delivery hardening gate
- update the notification plan doc and UI text to match the actual producer set
- add an explicit note in code/docs that focus-session families are dormant contracts until canonical emitters exist

Primary files:

- `docs/product/dashboard/notifications-opt-in-runtime-plan.md`
- `src/apps/dashboard/tabs/settings/components/NotificationsPanel.jsx`
- `src/apps/dashboard/tabs/settings/SettingsTab.jsx`
- `src/i18n/locales/en/settings.js`
- `src/i18n/locales/ko/settings.js`

Acceptance:

- visible product copy matches real delivery scope
- no release-facing toggle implies a producer that does not exist

## 5.2 Phase 2: Suspend-safe delayed delivery

Goal:

- make delayed reminders structurally reliable under MV3 worker behavior

Tasks:

- replace timer-only delayed delivery with a recoverable scheduling seam
- keep `pendingByDeliveryKey` as runtime checkpoint state, not as a second product state
- on boot or alarm fire, reconcile pending entries against current runtime state before dispatch
- stop treating `runtime.onSuspend` as a place to silently delete recoverable pending reminders
- ensure dedupe still suppresses duplicate sends after worker restart or alarm replay

Preferred implementation direction:

1. add a notification-owned delayed scheduler backed by `chrome.alarms`
2. keep `runtime.notification_state.pendingByDeliveryKey` as the canonical pending ledger
3. reconcile on bootstrap and alarm receipt

Primary files:

- `src/domains/notifications/background/NotificationService.js`
- `src/domains/notifications/background/notificationStateRepository.js`
- `src/domains/notifications/background/notificationPolicy.js`
- `src/apps/background/services/runtime/backgroundKernelCoreServices.js`
- `src/domains/tracking/background/trackingServiceBootstrap.js`

Acceptance:

- a delayed reflection reminder is not lost merely because the service worker suspends
- restart/suspend recovery does not create duplicate dispatches

## 5.3 Phase 3: Descriptor and routing convergence

Goal:

- make catalog and click-routing seams canonical rather than duplicated

Tasks:

- move all copy resolution to catalog-owned keys and shared descriptor interpretation
- remove service-local event-specific translation branching
- promote click destination handling into a typed routing contract owned by the notification seam or a narrow background routing helper
- keep `routeHint` and `routeParams` as implementation details, not the public conceptual model

Recommended seam:

- `notificationCatalog.js` owns descriptor intent
- `NotificationService.js` owns delivery and click-context persistence
- a narrow background helper owns dashboard URL construction from typed click intent

Primary files:

- `src/domains/notifications/background/notificationCatalog.js`
- `src/domains/notifications/background/NotificationService.js`
- `src/apps/background/services/runtime/backgroundKernelCoreServices.js`
- `src/apps/dashboard/bootstrap/dashboardLaunchContext.js`

Acceptance:

- one descriptor source defines copy and click defaults
- click routing can add richer reflection targets later without reworking delivery logic

## 5.4 Phase 4: Settings/runtime boundary cleanup

Goal:

- remove notification settings leakage into unrelated runtime owners

Tasks:

- remove `notificationsConfig` from protection broadcast key participation
- verify settings cache refresh still works correctly for background reads and dashboard hydration
- confirm no content-side or protection-side runtime behavior depends on notification settings

Primary files:

- `src/domains/settings/config/settingsUpdateKeys.js`
- `src/apps/background/services/SettingsService.js`
- related tests around settings propagation and runtime refresh

Acceptance:

- changing notification settings refreshes only the owners that truly need the data
- protection update fan-out no longer runs for notification-only settings changes

## 5.5 Phase 5: Advisory prompt extraction

Goal:

- keep the Schedule prompt product behavior while moving eligibility rules out of the tab component

Tasks:

- extract a small advisory rule/helper that answers whether notification opt-in should be suggested
- feed it schedule configuration facts and notification configuration facts
- keep local UI concerns such as per-open dismiss state inside the tab
- avoid introducing new durable prompt-dismiss storage in this pass unless product explicitly requires it

Primary files:

- `src/apps/dashboard/tabs/schedule/ScheduleTab.jsx`
- `src/apps/dashboard/tabs/schedule/components/ScheduleGuidancePanel.jsx`
- a new helper under `src/domains/notifications/` or a dashboard-owned advisory seam

Acceptance:

- prompt eligibility rules are reusable and testable
- Schedule tab no longer owns all business semantics of when notification guidance should appear

## 5.6 Phase 6: Verification and release gate

Goal:

- make the hardening work enforceable

Tasks:

- update `trackingRuntimeCoordinator` tests for the new `runtime.schedule_state` object shape
- add notification policy tests for per-kind gating, daily caps, and delayed-delivery decisions
- add notification service tests for dedupe, click-context persistence, and delayed recovery
- add settings propagation tests that prove `notificationsConfig` does not trigger protection broadcast
- run `npm run build` as the default handoff gate

Release gate:

The hardening pass should not be considered ready to ship unless all of the following are true:

1. build passes
2. notification-specific targeted tests pass
3. schedule-end delivery works when enabled
4. delayed reflection reminders either survive suspend safely or are explicitly removed from release-facing UI
5. visible settings copy matches the actual enabled release scope

## 6) Immediate task order for the actual implementation pass

The next coding session should execute in this order:

1. Re-baseline visible scope and copy.
2. Remove `notificationsConfig` from protection broadcast.
3. Rework delayed delivery into a recoverable scheduler.
4. Collapse descriptor/copy ownership into the catalog.
5. Extract Schedule advisory eligibility.
6. Repair and expand targeted tests.
7. Run `npm run build`.

This ordering is intentional.

It narrows user-facing scope first, fixes the clean boundary leak second, then addresses the true release blocker: delayed delivery reliability.

## 7) Explicit non-goals for this hardening pass

Do not expand this pass into:

- commands integration
- side-panel support
- a new reflection tab or dedicated reflection route
- optional-permission migration unless it becomes a hard release requirement
- a generalized reminders framework beyond the current notification seam

Those can follow once the shipping seam is structurally stable.
