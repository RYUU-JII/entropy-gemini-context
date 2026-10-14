# Notifications Runtime Boundary Map

- Status: Active
- Owner: notification background service, notification capability contract, Settings notification controls, dashboard notification launch route contract
- Last validated against code: 2026-10-03
- Path policy: current-only
- Canonical for: notification dispatch ownership, optional notification capability checks, notification click routing, runtime notification state, and schedule notification advisory prompts
- Companion to:
  - `docs/architecture/repository/settings-tab-boundary-map.md`
  - `docs/architecture/repository/background-runtime-boundary-map.md`
  - `docs/architecture/repository/sites-schedule-boundary-map.md`
  - `docs/system-architecture/05-background-runtime-owners.md`

## Purpose

Journey alerts use the explicit `notificationsConfig.journey.enabled` opt-in,
default off and independent of the base cap-alert switch, and `JOURNEY_STAGE_ADVANCED` descriptor. Guidance reserves only the
latest newly earned stage 2–5 before dispatch and owns durable duplicate/uncertain
delivery evidence; NotificationService retains capability and click routing.
The typed SettingsStore initializer upgrades an exact three-field stored
notification config once by adding the off journey field before canonical reads.
Malformed shapes fail; active runtime readers accept only the four-field shape.
Migration and import do not create notification catch-up debt. See
[Guidance Runtime](../guidance/guidance-runtime.md) for ownership and receipt rules.

This map audits the notification runtime as an opt-in background feature. The
system may decline dispatch when permission or browser APIs are unavailable,
but it must not silently create alternate notification owners, keep legacy
click route shapes alive, or treat a missing capability owner as ordinary
unavailability.

The practical reading question is:

```text
Can every notification be traced from event type to policy, capability,
browser dispatch, stored typed route context, and dashboard route without
legacy route fallback or direct Chrome access inside the domain service?
```

## System Flow

Settings opt-in:

```text
SettingsTab
  -> getNotificationCapabilityState(browserPort)
  -> ensureNotificationsPermission()
  -> usePreferenceStore / notificationsConfig write
  -> NotificationsPanel visible enabled/capability state
```

Background dispatch:

```text
tracking/protection/schedule event
  -> scheduleRuntimeCoordinator (temporal edges) / trackingRuntimeCoordinator (global cap)
  -> notificationService.handleEvent()
  -> notificationCatalog descriptor
  -> resolveNotificationCapability(browserPort)
  -> ensureNotificationsConfigReady() + getNotificationsConfig()
  -> notificationPolicy.shouldDispatchNotification()
  -> notificationCopyResolver
       -> RuntimeLanguageRepository
       -> backgroundRuntime / generated backgroundResources leaf
  -> browserPort.notificationsCreate()
  -> notificationStateRepository session context
```

Click route:

```text
chrome.notifications.onClicked
  -> BackgroundBootstrapCoordinator.waitForFullInit()
  -> notificationService.handleClicked()
  -> notificationStateRepository contextByNotificationId
  -> resolveDashboardTabRequestForNotificationRoute()
  -> background runtime tabsCreate(dashboard.html?tab=...)
```

Schedule advisory:

```text
ScheduleTab typed intent=notifications / window-options entry
  -> normalizeScheduleNotificationRouteIntent()
  -> ScheduleBlockWorkbench inline folded settings
  -> ScheduleTab permission check + typed schedule plan command
```

The per-window switch owns explicit `none` / `end` / `both` plan values. New and
unset windows are off; relaxation opt-in is end-only, isolation opt-in is start/end.
Enabling requires the existing strict permission owner and does not change global
notification settings. Only verified applied schedule-transition events carry this
explicit opt-in into dispatch policy, independently of unrelated global families.
Capability checks and delivery-key deduplication still apply. Existing explicit
`auto` values retain the global policy until edited; manual sessions and global-cap
alerts also keep that global owner. An explicit notifications route opens details
on entry. Creating or editing a clock never opens it automatically.

## Owner Table

| Concern | Owner | Key files | Output | Forbidden shortcut |
| --- | --- | --- | --- | --- |
| Notification descriptors | notification catalog | `notificationCatalog.js`, `notificationTypes.js` | kind, copy keys, typed route | descriptor-local literal copy fallback |
| Notification copy resolution | notification copy resolver plus background i18n leaf | `notificationCopyResolver.js`, `backgroundRuntime.js`, `backgroundResources.js` | copy in the canonical stored language from metadata-indexed generated locale projections | hand-maintained background locale registry, service-owned broad UI runtime import, browser-language substitution after a storage error, or literal copy fallback |
| Notification event emission | applied schedule runtime coordinator / tracking global-cap coordinator | `scheduleRuntimeCoordinator.js`, `trackingRuntimeCoordinator.js` | applied transition payload, canonical delivery key inputs, and dispatch result validation | optional notification service, anonymous delivery keys, or swallowed dispatch exceptions |
| Dispatch policy | notification policy | `notificationPolicy.js` | allowed/denied decision with reason | dispatching without an explicit delivery key or config owner |
| Browser capability | notification capability contract plus caller port | `notificationCapability.js`, background/settings browser ports | `{ ready, code }` | domain capability importing ChromeService directly |
| Browser notification I/O | app runtime browser port | `backgroundKernelNotificationBrowserPort.js` | created notification id or explicit error | domain service using `chrome.notifications` |
| Notification dispatch clock | app runtime composition root | `backgroundKernelCoreServices.js`, `NotificationService.js` | dispatch timestamp used for dedupe state | service-local `Date.now()` default or invalid clock result coercion |
| Notification listener lifecycle | notification service plus app bootstrap gate and browser port | `NotificationService.js`, `BackgroundBootstrapCoordinator.js`, `backgroundKernelNotificationBrowserPort.js` | synchronously registered click/close listeners whose callbacks share the full-init FIFO gate, plus explicit removal | ignoring listener add/remove results or callback-local init waits |
| Runtime click state | notification state repository | `notificationStateRepository.js` | session-scoped delivery and click context | localStorage or persistent business mirror |
| Click route contract | notification route contract plus background click action owner | `notificationRoutes.js`, `backgroundKernelNotificationClickAction.js`, `dashboardLaunchContext.js` | typed notification target to dashboard tab request and tab create action | legacy `tabId` route normalization, arbitrary launch `source` params, or dashboard-root fallback |
| Settings UI | Settings tab notification controls | `SettingsTab.jsx`, `NotificationsPanel.jsx` | visible opt-in/capability state | enabling notifications without permission/capability check |
| Schedule opt-in surface | dashboard Schedule command/presentation owners | `ScheduleTab.jsx`, `ScheduleBlockWorkbench.jsx`, `scheduleNotificationAdvisory.js` | one inline fold, permission-gated per-window plan opt-in, and explicit notification-route opening | global setting mutation from a window switch, automatic prompts on clock edits, or feature-local storage writes |

## Function Ledger

| Boundary function | Input | Output | Failure / missing-data policy |
| --- | --- | --- | --- |
| `getNotificationCapabilityState()` | explicit browser port | ready state and stable code | missing port/method or malformed method result throws; unavailable APIs return `api_unavailable` |
| `createNotificationService()` | runtime owners, browser port, and clock owner | notification service API | missing owner throws at construction |
| `registerListeners()` | notification browser-port listener methods and canonical `waitForFullInit` owner | registered click/close listeners | missing or changed gate owner throws; add-listener failure throws and close-listener failure rolls back the click listener |
| `dispose()` | registered notification listeners | listener removal | remove-listener failure rejects and keeps unresolved listener ownership visible |
| `getNotificationDescriptorForEvent()` | notification event type | canonical descriptor with kind, copy keys, route, and event type | unknown event returns unsupported; declared event without a valid descriptor throws |
| `requireNotificationDescriptor()` | descriptor candidate | canonical descriptor | malformed kind/copy keys/route/interaction flag throws `NOTIFICATION_DESCRIPTOR_INVALID` |
| `createNotificationCopyResolver()` | typed runtime-language repository | async descriptor-to-copy resolver | missing repository, malformed stored language, or malformed descriptor keys throws before browser dispatch |
| `createTrackingRuntimeCoordinator()` notification dispatch | global-cap/schedule state edges | notification event payload sent to service | missing notification service owner, malformed cap state/date, legacy schedule state, and thrown dispatch failures reject |
| `handleEvent()` | notification event with explicit delivery key | dispatched result or explicit denied reason | unsupported event/policy denial returns reason; supported events without delivery key, malformed config/capability owner output, and browser create failure reject |
| `shouldDispatchNotification()` | descriptor, config, runtime state | allowed decision | malformed descriptor/config throws; missing delivery key/disabled kind denies with reason |
| `normalizeNotificationRoute()` | typed route candidate | normalized typed route or null | legacy tab route shape is not accepted; malformed params throw |
| `buildNotificationRoute()` | typed route target | normalized typed route | unsupported target or malformed params throw |
| `resolveDashboardTabRequestForNotificationRoute()` | typed notification route | dashboard tab request | invalid route resolves to no tab request |
| `createNotificationClickAction()` | background browser port | click action owner | missing browser methods, invalid route request, URL failure, or tab create failure throws explicit `BACKGROUND_NOTIFICATION_CLICK_*` errors |
| `buildDashboardNotificationQuery()` | dashboard tab and route params | encoded dashboard query | missing tab or malformed params throws; invalid params are not dropped |
| `readDashboardRouteRequest()` | dashboard URL query | route request and typed params | schedule notification source is preserved only when `source=notification` |
| `handleClicked()` | notification id | route opened boolean | unknown valid notification id returns false; invalid id, missing stored typed route, malformed action result, and action owner failure reject |
| `handleClosed()` | notification id | session context removal | unknown id is a no-op |
| `normalizeScheduleNotificationRouteIntent()` | typed schedule route intent | canonical notifications intent or null | route input canonicalization only; no config write |
| `resolveSettingsNotificationCapability()` | Settings notification capability port | visible notification capability state | malformed owner output becomes exact status/capability code; do not coerce into `api_unavailable` |
| `NotificationsPanel` visible opt-in | Settings notification handler | one all-notification toggle click | the visible enabled control requires its declared handler |
| `ScheduleBlockWorkbench` notification controls | ScheduleTab permission owner and per-window plan command | fixed-policy opt-in | permission denial writes no plan; errors stay visible; asynchronous completion revalidates current selection and pending edit before committing through the canonical schedule owner |

## Recovery Versus Fallback

| Class | Allowed? | Rule |
| --- | --- | --- |
| Notification permission denied | Yes | visible user outcome; do not mutate config into enabled runtime state |
| Browser notification API unavailable | Yes | capability state is `api_unavailable` only when an explicit port reports missing APIs |
| Missing or malformed capability owner | No | throw `NOTIFICATION_CAPABILITY_BROWSER_PORT_REQUIRED`, `NOTIFICATION_CAPABILITY_BROWSER_PORT_METHOD_REQUIRED`, or `NOTIFICATION_CAPABILITY_BROWSER_PORT_RESULT_INVALID` |
| Malformed Settings notification capability owner | No fallback | render the exact capability owner error in `NotificationsPanel`; do not persist notification enablement |
| Malformed config owner result | No fallback | throw `NOTIFICATION_CONFIG_RESULT_INVALID` instead of reporting `notifications_disabled` |
| Malformed policy descriptor or config input | No fallback | throw `NOTIFICATION_POLICY_DESCRIPTOR_INVALID` or `NOTIFICATION_POLICY_CONFIG_INVALID` instead of policy-denying as no-op/disabled |
| Schedule alert opt-in | No automatic activation | explicit inline switch only; permission denial writes no plan; typed command failures remain visible in the folded surface and canonical sync error owner |
| Malformed capability resolver result | No fallback | throw `NOTIFICATION_CAPABILITY_RESULT_INVALID` before config reads, browser dispatch, or runtime state writes |
| Missing or malformed notification dispatch clock | No fallback | throw `NOTIFICATION_CLOCK_OWNER_REQUIRED` or `NOTIFICATION_CLOCK_RESULT_INVALID`; do not coerce to `Date.now()` inside the service |
| Malformed notification descriptor | No fallback | throw `NOTIFICATION_DESCRIPTOR_INVALID` or `NOTIFICATION_DESCRIPTOR_MISSING` instead of dispatching with partial catalog data |
| Blank or missing notification copy | No fallback | throw `NOTIFICATION_COPY_INVALID` before browser dispatch or runtime state writes |
| Missing or malformed notification language owner | No fallback | throw `NOTIFICATION_COPY_LANGUAGE_REPOSITORY_REQUIRED` or `NOTIFICATION_COPY_LANGUAGE_INVALID`; only an absent stored setting may use the typed repository's declared configured fallback |
| Missing or malformed notification icon URL | No fallback | throw `NOTIFICATION_ICON_URL_UNAVAILABLE` before browser dispatch or runtime state writes |
| Notification click route/browser failure | No fallback | throw `BACKGROUND_NOTIFICATION_CLICK_*` instead of returning `false` after opening dashboard root or dropping params |
| Malformed notification route params | No fallback | throw `NOTIFICATION_ROUTE_PARAMS_INVALID` instead of dropping params, trimming duplicate keys into one value, or overwriting notification-owned launch params |
| Tracking notification service missing | No fallback | throw `TRACKING_RUNTIME_COORDINATOR_NOTIFICATION_SERVICE_REQUIRED` during coordinator construction |
| Malformed tracking notification dispatch result | No fallback | throw `TRACKING_RUNTIME_COORDINATOR_NOTIFICATION_RESULT_INVALID` instead of treating an unknown owner result as success |
| Malformed global-cap notification date/state | No fallback | throw `TRACKING_RUNTIME_COORDINATOR_GLOBAL_CAP_*` instead of coercing exceeded state or building `unknown_day` delivery keys |
| Legacy or incomplete schedule notification state | No fallback | throw `TRACKING_RUNTIME_COORDINATOR_SCHEDULE_*` instead of rebuilding anonymous `schedule_window` delivery keys |
| Missing service delivery key for a supported event | No fallback | throw `NOTIFICATION_DELIVERY_KEY_REQUIRED` instead of synthesizing from `sessionId`, `windowKey`, or descriptor kind |
| Unsupported event type | Bounded | return `unsupported_event`; do not synthesize descriptors |
| Duplicate delivery key | Yes | explicit `already_shown` policy denial |
| Browser notification API missing, create error, or missing platform id | No fallback | browser port returns explicit error result and service rejects dispatch; do not write shown state |
| Notification listener registration/removal failure | No fallback | throw `NOTIFICATION_*_LISTENER_*_FAILED`; do not mark listeners as registered when add failed |
| Legacy tab route context | No | session state must use typed route targets only |
| Stored click context without typed route | No fallback | throw `NOTIFICATION_STATE_CONTEXT_ROUTE_REQUIRED` or `NOTIFICATION_CLICK_CONTEXT_ROUTE_INVALID` instead of returning false |
| Untyped dashboard launch source | No fallback | schedule launch params must not preserve arbitrary `source` values as notification context |
| Malformed runtime notification state | No fallback | throw explicit `NOTIFICATION_STATE_*` errors instead of resetting delivery/click maps or collapsing duplicate normalized keys |
| Visible notification toggle handler missing | No fallback | throw explicit `NOTIFICATIONS_PANEL_*_HANDLER_REQUIRED` errors instead of rendering clickable no-ops |
| Visible schedule utility handler missing | No fallback | throw explicit `SCHEDULE_UTILITY_*_HANDLER_REQUIRED` errors instead of rendering clickable no-ops |
| Missing click context for a valid id | Bounded | click returns false; no dashboard route is invented |
| Listener callback failure | Visible through service logger | direct `handleClicked`/`handleClosed` still reject for tests and owners |

## Current Findings

### F1. Notification service owner injection is strict

Status: keep.

`createNotificationService()` requires config, readiness, click action, browser
port, runtime session repository, and capability resolver owners. The
background architecture guard already rejects empty owner defaults and direct
Chrome access in the domain service.

### F2. Capability fallback to ChromeService was removed

Status: tightened in the 2026-07-01 notification route boundary pass.

`getNotificationCapabilityState()` no longer imports ChromeService or accepts a
missing port as a platform fallback. Background and Settings callers must pass
an explicit browser port shape. A missing owner is a structural error; API
absence remains a normal `api_unavailable` capability result. Port capability
methods must also return booleans; truthy/falsy owner output is not coerced into
readiness.

### F3. Legacy tab-based notification routes were retired

Status: fixed in the 2026-06-29 notification boundary pass.

Notification click context is session-scoped and catalog descriptors already
write typed route targets. `normalizeNotificationRoute()` now rejects legacy
`tabId` route shapes and `buildNotificationRoute()` throws for unsupported
targets instead of producing a null route. Notification click handling now uses
only the stored typed route; the retired `clickAction` axis no longer acts as a
second route source. Route params are also strict: invalid param maps,
trim-colliding param keys, and conflicting notification-owned schedule launch
params now throw `NOTIFICATION_ROUTE_PARAMS_INVALID` instead of being filtered
down to a partial dashboard launch context.

### F4. Browser-created notification id is authoritative

Status: fixed in the 2026-06-30 notification runtime pass.

The background browser port returns the id actually produced by
`chrome.notifications.create()`. `NotificationService` stores click context
under that returned id, and a missing platform id rejects dispatch instead of
falling back to the requested id or writing delivery state.

### F5. Runtime notification state stays session-scoped

Status: tightened in the 2026-06-30 notification state repository pass.

`notificationStateRepository` stores delivery dedupe and click context in the
runtime session repository. It does not create a persistent mirror or a
dashboard-owned notification truth source. A missing session key still means an
empty runtime notification state, but an existing malformed state now throws an
explicit `NOTIFICATION_STATE_*` error instead of resetting dedupe/click maps or
collapsing duplicate keys after trimming. Stored click contexts must carry typed
routes; no-route contexts are not a supported current runtime shape.

### F6. Capability resolver output is now shape-checked

Status: tightened in the 2026-07-01 notification policy boundary pass.

`NotificationService` still treats an explicit `{ ready:false,
code:"api_unavailable" }` capability result as a normal non-dispatch decision.
Malformed capability resolver output now throws
`NOTIFICATION_CAPABILITY_RESULT_INVALID` before notification config reads,
browser dispatch, or runtime notification state writes. This keeps capability
owner bugs from being reported as ordinary platform unavailability.

Notification config owner output is shape-checked for the canonical
`enabled/sessionStart.enabled/sessionEnd.enabled` booleans before policy
evaluation. Malformed config owner output now throws
`NOTIFICATION_CONFIG_RESULT_INVALID` instead of becoming a normalized disabled
config. `notificationPolicy` applies the same shape requirement at its own
boundary with `NOTIFICATION_POLICY_CONFIG_INVALID`, so direct policy callers
cannot reinterpret malformed config as disabled notifications. Policy
descriptors are strict as well; missing or unsupported kinds now throw
`NOTIFICATION_POLICY_DESCRIPTOR_INVALID` instead of becoming `missing_descriptor`
or `unsupported_kind` denial reasons. The permissive
`normalizeNotificationsConfig()` helper remains the storage/UI normalization
seam for partial persisted values; runtime policy/advisory boundaries use
`requireCanonicalNotificationsConfig()` instead.

### F7. The Settings notification opt-in requires its handler

Status: fixed in the 2026-06-30 notification settings panel pass.

`NotificationsPanel` exposes one app-level opt-in instead of separate master,
session-start, and session-end switches. Enabling it writes the exact current
policy with all three booleans enabled; disabling it clears all three. Its copy
identifies base-status notifications (global cap and immediate-session expiry),
with per-window alerts owned by each window. It also gates existing explicit
`auto` plans; it does not override an explicit window opt-in. The
visible switch throws `NOTIFICATIONS_PANEL_MASTER_HANDLER_REQUIRED` when its
handler is missing. A capability-disabled control may omit the handler because
it cannot be used.

### F8. Schedule opt-in follows the inline folded-settings owner

Status: aligned with the current Schedule owner in the 2026-10-03 pass.

`scheduleNotificationAdvisory` owns input-boundary route normalization only.
`ScheduleTab` passes an explicit notification route through `notificationControl`
and `ScheduleRhythmWorkspace` to `ScheduleBlockWorkbench`'s inline details.
The switch awaits `ensureNotificationsPermissionStrict` before the existing typed
schedule plan command. It revalidates the current selection and draft after that
await. Permission denial and command failure remain visible in the fold. Creating or editing a
window does not activate an automatic prompt.

The unused automatic-advisory predicate and its private trigger validation are
retired. The dashboard architecture guard follows the current route, permission,
typed command and inline-control owners; it rejects reintroduction of the
retired predicate/state. Existing Special Session async admission and utility
handler requirements remain guarded.

### F9. Notification descriptor and copy output is strict

Status: tightened in the 2026-08-09 background i18n leaf pass.

`notificationCatalog` now validates declared descriptors through
`requireNotificationDescriptor()`. Unknown event types still return the bounded
`unsupported_event` result, but declared events with missing descriptors,
invalid kinds, missing copy keys, invalid typed routes, or missing
`requireInteraction` ownership throw instead of becoming browser notifications
with partial data.

`NotificationService` resolves copy only after descriptor validation through an
injected `notificationCopyResolver`. That owner reads the canonical stored
runtime language and translates from the generated background leaf instead of
importing the broad UI resource graph. Storage read failures and malformed
stored languages reject; they do not switch to a browser-language source.
The generator and public artifact guard both derive their locale inventory from
`I18N_SUPPORTED_LOCALES`; adding a supported locale without its projected leaf
or background registry entry is a fail-loud contract violation.
Blank copy and the runtime i18n missing-key sentinel still throw
`NOTIFICATION_COPY_INVALID` before `notificationsCreate()` or runtime
notification state writes. A catalog contract test also checks that every
descriptor copy key exists in every runtime locale.

### F10. Notification listener lifecycle validates browser-port results

Status: fixed in the 2026-06-30 notification listener lifecycle pass.

`NotificationService.registerListeners()` now treats click/close listener
registration as an owned runtime boundary. The service no longer marks
listeners as registered when the browser port returns a failed add result. The
listener API availability check is separate from add/remove validation. It also
requires one stable `waitForFullInit` owner: listener registration remains
synchronous, but click/close callback bodies enter the coordinator FIFO only
after full init succeeds. Pending init therefore calls no notification owner,
and rejected init records `BACKGROUND_FULL_INIT_EVENT_GATE_REJECTED`. Optional
notification permission absence reports
`NOTIFICATION_LISTENER_API_UNAVAILABLE` without attempting registration, while
an add/remove failure after the API is available still rejects. If close-listener
registration fails after the click listener was added, the click listener is
rolled back. `dispose()` also validates remove results and leaves unremoved
listener ownership visible by rejecting with
`NOTIFICATION_*_LISTENER_REMOVAL_FAILED`.

### F11. Notification click handling separates stale clicks from state corruption

Status: fixed in the 2026-06-30 notification click-context pass.

`NotificationService.handleClicked()` still returns `false` for a valid
notification id that has no stored context, because browser click events can
arrive after state cleanup. It now rejects invalid ids, malformed click action
owner results, and stored contexts without a typed route. `notificationStateRepository`
also rejects `route:null` in `contextByNotificationId`, so the service no
longer preserves inert no-route click actions as a parallel runtime path.

### F12. Notification click routing has a dedicated owner

Status: fixed in the 2026-06-30 notification click-action pass.

Dashboard click-through URL construction moved out of
`backgroundKernelCoreServices.js` into `backgroundKernelNotificationClickAction`.
The composition root now injects this action into `NotificationService` instead
of hosting local query-building fallback logic. Invalid routes, malformed route
params, missing runtime URL support, and failed tab creation now throw
`BACKGROUND_NOTIFICATION_CLICK_*` errors. Direct `handleClicked()` calls reject
for tests and runtime owners; browser callbacks delegate async failure
classification to the shared full-init event gate.

### F13. Tracking notification emission is no longer optional

Status: fixed in the 2026-06-30 tracking notification emission pass.

`trackingRuntimeCoordinator` now requires a notification service owner at
construction. Global-cap and schedule edge events still allow normal
`NotificationService` non-dispatch results such as disabled notifications,
unavailable platform capability, or duplicate delivery, but owner failures and
malformed dispatch results are no longer swallowed with `console.warn`.
Global-cap dates, previous global-cap session state, and structured schedule
runtime state are also validated before delivery-key construction, so malformed
owner output cannot collapse into anonymous `unknown_day` or `schedule_window`
dedupe keys. This keeps event emission bugs visible while preserving
policy-level opt-out semantics inside `NotificationService`.

### F14. Notification service does not synthesize delivery keys

Status: fixed in the 2026-06-30 notification delivery-key pass.

`NotificationService.handleEvent()` now requires supported notification events
to provide an explicit delivery key. The service no longer rebuilds missing
keys from `sessionId`, `windowKey`, or descriptor kind, because that would hide
payload bugs after the tracking runtime coordinator already chose the canonical
dedupe identity. Direct policy callers still receive a normal
`missing_delivery_key` denial, but the runtime service boundary treats a
missing key as `NOTIFICATION_DELIVERY_KEY_REQUIRED`.

### F15. Notification dispatch time is an injected owner

Status: fixed in the 2026-06-30 notification clock-owner pass.

`NotificationService` no longer owns a hidden `Date.now()` default or coerces
invalid dispatch timestamps into a fresh current time. The app runtime
composition root injects the service clock explicitly, and malformed clock
results throw `NOTIFICATION_CLOCK_RESULT_INVALID` before browser notification
creation or runtime notification state writes. This keeps dedupe timestamps
tied to the same owner path that created the notification service.

### F16. Notification browser port exposes platform failures explicitly

Status: codified in the 2026-06-30 notification browser-port pass.

`backgroundKernelNotificationBrowserPort` is the only active runtime seam that
touches `chrome.notifications` for notification creation and listener
registration. The port returns explicit error results for missing create APIs,
Chrome callback errors, and missing platform notification ids; `NotificationService`
turns those into dispatch rejection before writing `shownByDeliveryKey` or click
context. Listener availability is also exposed through `notificationsCanListen`
and add/remove boolean results rather than silently installing inert callbacks.

### F17. Settings notification capability errors stay visible

Status: fixed in the 2026-06-30 settings notification capability pass.

`SettingsTab` still uses the shared notification capability contract, but it no
longer lets malformed capability owner output crash the render path or collapse
into a generic unavailable state. `resolveSettingsNotificationCapability()`
captures the exact `NOTIFICATION_CAPABILITY_*` code and passes it to
`NotificationsPanel` as both status and capability text. Enable attempts reuse
the same resolver, so malformed capability owner output stops before
`setNotificationsConfig()`.

### F18. Notification icon URL owner output is strict

Status: fixed in the 2026-07-01 notification icon URL pass.

`NotificationService` now treats a blank or malformed icon URL from the
runtime browser port as `NOTIFICATION_ICON_URL_UNAVAILABLE`. The service rejects
before `notificationsCreate()` and before writing notification delivery or
click state, so a broken runtime URL owner cannot become a partially dispatched
notification.

## Re-Audit Checklist

- Run `npm run test:file -- tests/backgroundKernelNotificationBrowserPort.test.js tests/settingsTabSecurityFailureSurface.test.jsx tests/trackingRuntimeCoordinator.test.js tests/backgroundKernelNotificationClickAction.test.js tests/notificationCatalogContract.test.js tests/notificationCapability.test.js tests/notificationCopyResolver.test.js tests/notificationRoutes.test.js tests/notificationPolicy.test.js tests/notificationService.test.js tests/notificationStateRepository.test.js tests/dashboardLaunchContext.test.js tests/notificationsPanelContract.test.jsx tests/scheduleNotificationAdvisory.test.js tests/scheduleUtilityDockContract.test.jsx` after notification route/capability/copy/state/settings-panel/schedule-advisory changes.
- Run `npm run check:background:i18n-leaf` after changing notification copy keys, the copy resolver, or locale projection ownership.
- Run `npm run check:background-kernel:architecture` after notification owner or background browser-port changes.
- Confirm new notification descriptors use `buildNotificationRoute()` with typed `NOTIFICATION_ROUTE_TARGETS`.
- Confirm new dashboard notification UI capability reads pass an explicit port to `getNotificationCapabilityState()`.
- Confirm dispatch failures do not write `shownByDeliveryKey` or `contextByNotificationId`.


## Schedule transition emission (2026-10-01)

Schedule/isolated-session emission belongs to `domains/schedule/background/
scheduleRuntimeCoordinator.js`, composed by trackingRuntimeCoordinator. The
owner emits only after protection dispatch succeeds. Bootstrap, explicit
settings edits, manual start/end, same-mode metadata changes, and boundaries
observed more than 90 seconds late are quiet. At a shared boundary one event
announces the destination; a boundary ending into default relaxation announces
that end. Global-cap entry suppresses a simultaneous schedule event.

Explicit schedule opt-in requests the existing optional notification permission
and persists only the selected window's `notificationMode: none | end | both`.
Unset windows are silent. The applied-transition event forwards that mode to
the existing dispatch policy; `end`/`both` are independent of global settings for
schedule start/end descriptors only. Capability and deduplication remain mandatory.
Existing explicit `auto` means relaxation end only and isolation start/end subject
to the global enabled/family gates. Manual expiry can emit
an end event, while explicit manual actions use inline applied-state feedback.
Delivery keys use stable calendar occurrence IDs, not observation timestamps.
The existing catalog/policy/capability/browser/state owners remain the only OS
notification dispatch path. Failed application cannot publish a success receipt
or emit an alert. No preview or stored receipt can trigger notification replay.
