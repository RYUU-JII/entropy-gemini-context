# Notifications Opt-In Runtime Plan

- Status: Draft
- Date: 2026-04-11
- Scope: Chrome notification foundation, opt-in product policy, background delivery seam, and staged implementation plan
- Related:
  - `docs/decisions/security/selective-host-permission-security-decision.md`
  - `docs/architecture/repository/sites-schedule-boundary-map.md`
  - `docs/product/dashboard/notifications-release-hardening-plan.md`
  - `docs/product/dashboard/reflection-entry-surface-plan.md`
  - `docs/system-architecture/02-runtime-storage-boundaries.md`
  - `docs/system-architecture/05-background-runtime-owners.md`
- Owner: dashboard product / background runtime
- Last validated against code: 2026-04-11
- Path policy: planning-allowed
- Canonical for: first-release notifications product policy and implementation shape
- Non-goal:
  - replacing in-page friction UI such as furin, gates, or infinite-scroll interventions
  - shipping a full reminders framework or multi-channel orchestration system in the first pass
  - introducing automatic notification opt-in during install or first-run onboarding
  - adding `commands` or `sidePanel` in this rollout

Scope update:

- reflection suggestion has been explicitly deferred out of the initial release baseline
- the active shipping surface is limited to immediate schedule-owned notifications

## 1) Why notifications exist in Entropy

Entropy already has a strong in-page intervention model:

- DOM-inserted friction UI
- theme-driven visual artifacts
- site-local interactive prompts and gates

These remain the primary intervention surface.

`chrome.notifications` is added for a different job:

- surfacing state changes when the user is not looking at the protected page
- reliably delivering lightweight system-level reminders without depending on page DOM
- complementing, not replacing, site-local intervention UX

This rollout should treat notifications as a thin background-owned delivery seam.

## 2) Fixed release decisions

### 2.1 Notifications are opt-in

Notifications must be `OFF` by default.

The release should not request notification permission at install, first boot, or passive dashboard open.

The user must explicitly enable notification behavior through a settings action.

### 2.2 Initial scope is narrow

The first supported notification families are:

- session or schedule start
- session or schedule end

No other reminder families should be added in the first implementation pass.

### 2.3 In-page interventions remain primary

Notifications must not become the main intervention mechanism.

Examples that stay in-page:

- furin and ambient cues
- hard friction overlays
- infinite-scroll interruption
- rich interactive reflection surfaces

Notifications are for lightweight status delivery only.

### 2.4 Suggestion-based opt-in is future work, not V1 shipping scope

The product should eventually be able to suggest notification opt-in from relevant surfaces such as:

- first meaningful use of the Schedule tab
- first completed isolation session
- first reflection-capable session end

However, this rollout only lays the foundation.

Do not couple the first implementation to suggestion surfaces yet.

## 3) Product model

### 3.1 Notification families

#### A. Session or schedule start

Purpose:

- briefly confirm that a relaxation window or isolation session has started

Initial default:

- disabled

Tone:

- calm, declarative, low-pressure

#### B. Session or schedule end

Purpose:

- mark the end of a protected period and support intentional transition

Initial default:

- disabled

Tone:

- closure-oriented, not celebratory, not permissive

#### C. Reflection suggestion

Purpose:

- invite a short review after a meaningful protected period

Initial default:

- disabled

Tone:

- suggestive, not guilt-inducing, not urgent

Release status:

- deferred out of the initial shipping cut

### 3.2 Default behavior

Initial release defaults:

- notifications feature: disabled
- session start notifications: disabled
- session end notifications: disabled
- reflection suggestion notifications: disabled

Reason:

- respects trust and avoids install-time or early-run noise
- aligns with the progressive-permission and explicit-intent posture
- allows the runtime seam to ship safely before product rollout expands

### 3.3 Future suggestion triggers

This document reserves, but does not implement yet, the following future triggers:

- suggest notifications after the user configures schedule controls for the first time
- suggest notifications after the user completes a first meaningful isolation session
- suggest notifications after the user opens a reflection-capable dashboard surface multiple times

These triggers must remain advisory only.

They may prompt the user to enable notifications, but must not silently enable them.

## 4) Architectural principles

### 4.1 Background-owned delivery

All notification creation must be owned by background runtime.

Dashboard, popup, and content scripts may:

- display settings
- send intent
- open routes on click-through

They must not directly create Chrome notifications.

### 4.2 Separate domain events from delivery

Session, schedule, and reflection owners should emit or forward domain events.

A dedicated notification service should:

- interpret those events
- check settings and policy
- create notifications
- record delivery state

This keeps business-state transitions independent from delivery mechanics.

### 4.3 No new fallback paths

Notification enablement and runtime delivery must follow existing storage and settings boundaries.

Do not add:

- localStorage mirrors for notification business state
- duplicate storage owners for enablement
- content-side fallback delivery when background cannot send

If notification delivery fails, fail visibly in logs and keep the business event intact.

### 4.4 Runtime state is session-scoped

Delivery bookkeeping such as dedupe and daily caps is runtime state, not durable product history.

It belongs in `chrome.storage.session`, not IndexedDB and not UI-only local storage.

## 5) Proposed ownership and file layout

## 5.1 New domain seam

Create a small dedicated notification domain:

- `src/domains/notifications/contracts/notificationTypes.js`
- `src/domains/notifications/background/notificationCatalog.js`
- `src/domains/notifications/background/notificationPolicy.js`
- `src/domains/notifications/background/notificationStateRepository.js`
- `src/domains/notifications/background/NotificationService.js`

### 5.1.1 `notificationTypes.js`

Owns:

- notification event types
- notification kinds
- click action identifiers

This file defines stable contracts only.

### 5.1.2 `notificationCatalog.js`

Owns:

- mapping from event type to notification descriptor template
- i18n keys
- notification kind metadata
- default click actions

This file must not contain runtime storage logic.

### 5.1.3 `notificationPolicy.js`

Owns:

- enablement checks
- per-kind gating
- dedupe rules
- minimum session thresholds
- reflection daily limits
- optional delays

This file should be pure or near-pure where possible.

### 5.1.4 `notificationStateRepository.js`

Owns:

- session-scoped delivery state read/write
- canonical runtime state shape

This file must be the only owner of notification delivery session state.

### 5.1.5 `NotificationService.js`

Owns:

- receiving domain events
- resolving descriptors from catalog
- consulting policy and runtime state
- calling `chrome.notifications.*`
- mapping notification ids back to click actions and context

This service is the only module that should talk to the Chrome notifications API directly.

## 5.2 Integration points in existing runtime

The notification service should be composed in background bootstrap, not lazily created from multiple callers.

Primary integration areas:

- background composition root
- settings cache / settings service
- schedule or isolation-session runtime owner
- reflection proposal owner when that exists

Likely existing files to touch:

- `src/manifest.json`
- `src/apps/background/index.js`
- `src/apps/background/services/runtime/backgroundKernelCoreServices.js`
- `src/apps/background/services/SettingsService.js`
- `src/domains/settings/config/settingsUpdateKeys.js`
- `src/platform/storage/internal/chrome-storage/storageKeyRegistry.js`

Additional runtime owners will call into the service once the seam exists.

## 6) Event contract

The notification seam should consume narrow domain events rather than raw settings diffs or UI actions.

Proposed event types:

- `ISOLATION_SESSION_STARTED`
- `ISOLATION_SESSION_ENDED`
- `SCHEDULE_WINDOW_STARTED`
- `SCHEDULE_WINDOW_ENDED`
- `REFLECTION_SUGGESTION_ELIGIBLE`

Recommended payload examples:

```js
{
  type: 'ISOLATION_SESSION_ENDED',
  occurredAt: 1712800000000,
  sessionId: 'isolation:1712796400000',
  startedAt: 1712796400000,
  endedAt: 1712800000000,
  durationMs: 3600000,
  endedBy: 'timeout',
}
```

```js
{
  type: 'SCHEDULE_WINDOW_STARTED',
  occurredAt: 1712800000000,
  windowKey: 'weekday-evening',
  startedAt: 1712800000000,
  expectedEndAt: 1712803600000,
}
```

```js
{
  type: 'REFLECTION_SUGGESTION_ELIGIBLE',
  occurredAt: 1712800000000,
  sourceEventType: 'ISOLATION_SESSION_ENDED',
  sessionId: 'focus:1712796400000',
  durationMs: 3600000,
  frictionEventsObserved: true,
}
```

This contract should stay internal to background runtime in the first pass.

Do not add public message actions unless a UI surface truly needs them.

## 7) Settings model

## 7.1 Canonical storage owner

Notification product settings should live in canonical settings documents under `settings.core`.

They should be readable through existing settings seams and normalized by `SettingsService`.

## 7.2 Proposed setting keys

Add one primary feature object:

- `notificationsConfig`

Recommended shape:

```js
{
  enabled: false,
  sessionStart: {
    enabled: false,
  },
  sessionEnd: {
    enabled: false,
  },
  reflection: {
    enabled: false,
    minSessionMs: 900000,
    dailyLimit: 2,
    delayMs: 180000,
    requireFrictionEvent: false,
  },
}
```

Rationale:

- one stable root key
- future additions do not proliferate top-level settings keys
- UI can render a coherent notifications settings family

### 7.2.1 Why not separate top-level booleans

Avoid introducing:

- `notificationsEnabled`
- `notificationSessionStartEnabled`
- `notificationSessionEndEnabled`
- `notificationReflectionEnabled`

as separate canonical top-level keys.

Those flatten quickly into settings sprawl and make later evolution noisier.

## 7.3 Normalization

Add a dedicated config module:

- `src/domains/settings/config/notificationsConfig.js`

It should own:

- `DEFAULT_NOTIFICATIONS_CONFIG`
- `normalizeNotificationsConfig`

This follows the same pattern as `nudgeConfig`, `gateConfig`, and similar settings families.

## 7.4 Settings propagation

Required integration points:

- `storageKeyRegistry` mapping for `notificationsConfig`
- `SettingsPersistenceCapability` known key validation
- `SettingsService` defaults and normalization
- `settingsUpdateKeys` cache refresh set

Notification settings should refresh background settings cache.

They do not need content-script sync by default.

They do not need protection broadcast by default unless a later feature explicitly depends on that.

## 8) Runtime delivery state

## 8.1 Canonical session key

Add a new session storage key:

- `runtime.notification_state`

Suggested registry addition:

- `STORAGE_SESSION_KEYS.NOTIFICATION_STATE`

## 8.2 Runtime shape

Recommended shape:

```js
{
  shownByDeliveryKey: {
    'session_end:focus:1712796400000': 1712800000000,
  },
  lastShownAtByKind: {
    session_start: 1712796400000,
    session_end: 1712800000000,
    reflection: 1712800300000,
  },
  reflectionCountByDay: {
    '2026-04-11': 1,
  },
  pendingByDeliveryKey: {
    'reflection:focus:1712796400000': {
      scheduledAt: 1712800180000,
      fireAt: 1712800360000,
    },
  },
  contextByNotificationId: {
    'entropy:notification:abc123': {
      kind: 'session_end',
      clickAction: 'OPEN_DASHBOARD',
      routeHint: 'schedule',
    },
  },
}
```

Notes:

- `shownByDeliveryKey` prevents duplicate sends per session-like unit
- `reflectionCountByDay` supports daily caps
- `pendingByDeliveryKey` allows delayed reminders without hidden fallback state elsewhere
- `contextByNotificationId` enables clean click handling

## 8.3 Durability rules

This state is runtime-operational, not durable product history.

It should not be mirrored into local storage documents.

Losing it across browser restarts is acceptable.

## 9) Catalog and i18n

## 9.1 Catalog shape

The catalog should define descriptors by notification kind:

- `session_start`
- `session_end`
- `reflection`

Each descriptor should include:

- title i18n key
- message i18n key
- default click action
- dedupe kind
- optional require-interaction preference

## 9.2 i18n keys

Add a dedicated notification namespace or a structured branch under existing settings/runtime locales.

Recommended key shape:

- `notifications.session_start.title`
- `notifications.session_start.body`
- `notifications.session_end.title`
- `notifications.session_end.body`
- `notifications.reflection.title`
- `notifications.reflection.body`

The first version should use neutral product language.

Do not theme-lock copy in the initial rollout.

Theme flavor can be added later via catalog branching if needed.

## 10) Click behavior

## 10.1 Initial click actions

Support a very small action set:

- `OPEN_DASHBOARD`
- `OPEN_SCHEDULE_TAB`
- `OPEN_REFLECTION_SURFACE`
- `DISMISS`

In the first pass:

- session start click can open the Schedule tab
- session end click can open the dashboard home or Schedule tab
- reflection click can open a reflection-capable dashboard route when that surface exists

## 10.2 Ownership

The notification service should own notification-id to click-context mapping.

Actual page opening should be delegated to a small background helper or existing dashboard-opening helper.

Do not hardcode `chrome.tabs.create(...)` calls in multiple notification paths.

## 11) Permission policy

## 11.1 Manifest

Add `notifications` to manifest permissions when implementation begins.

This permission is extension-scoped and does not require host access.

## 11.2 Product request posture

Even if the manifest includes the permission, product behavior should still remain opt-in:

- feature disabled by default
- no notification shown until user enables it
- no first-run notification prompt

This keeps product trust and runtime behavior aligned.

## 12) Suggested policy rules for V1

## 12.1 Session start

Allowed when:

- `notificationsConfig.enabled === true`
- `notificationsConfig.sessionStart.enabled === true`
- the delivery key has not already been shown

Blocked when:

- duplicate within the same session or schedule window

## 12.2 Session end

Allowed when:

- `notificationsConfig.enabled === true`
- `notificationsConfig.sessionEnd.enabled === true`
- the delivery key has not already been shown

Blocked when:

- duplicate end for the same session or window

## 12.3 Reflection

Allowed when:

- `notificationsConfig.enabled === true`
- `notificationsConfig.reflection.enabled === true`
- session duration meets `minSessionMs`
- daily limit not exceeded
- optional friction requirement is met if enabled
- reflection delivery key has not already been shown or scheduled

Blocked when:

- short session
- daily limit exceeded
- duplicate for same session

## 13) Deferred suggestion framework

This rollout should reserve a clean extension point for future opt-in suggestions.

Proposed future seam:

- `NotificationOptInSuggestionService`

Possible future triggers:

- first schedule configuration commit
- first manual schedule enable
- first isolation session completion above threshold

Important:

- this service must only suggest enablement
- it must not mutate `notificationsConfig.enabled` without explicit user action

Do not implement this service in the first coding pass unless it materially simplifies the current wiring.

## 14) Implementation plan

## 14.1 Phase 1: foundation only

Goal:

- create the seam without turning the feature on

Tasks:

- add `notifications` manifest permission
- add `notificationsConfig` settings config module
- register `notificationsConfig` in settings storage and settings service
- add `runtime.notification_state` session key
- implement notification contracts, catalog, policy, state repository, and service
- wire service into background composition

Acceptance:

- build passes
- no notification is emitted by default
- settings snapshot can carry `notificationsConfig`

## 14.2 Phase 2: session end notification

Goal:

- support one concrete path with the smallest product risk

Tasks:

- identify canonical session-end and schedule-end event points
- forward those events to `NotificationService`
- support click-through to dashboard or schedule

Acceptance:

- when manually enabled in settings, session-end events can produce one notification
- duplicate sends are suppressed
- default-off behavior remains intact

## 14.3 Phase 3: session start notification

Goal:

- add optional start confirmation

Tasks:

- hook start events
- reuse delivery seam

Acceptance:

- start notifications emit only when explicitly enabled

## 14.4 Phase 4: reflection suggestion

Goal:

- add the first post-session reflective reminder

Tasks:

- define eligible reflection source event
- enforce duration and daily-cap policy
- open a valid reflection-capable route on click

Reflection meaning and landing-surface behavior should follow:

- `docs/product/dashboard/reflection-entry-surface-plan.md`

Acceptance:

- reflection notifications stay rare and policy-bounded

## 15) Candidate file changes for implementation

New files:

- `src/domains/settings/config/notificationsConfig.js`
- `src/domains/notifications/contracts/notificationTypes.js`
- `src/domains/notifications/background/notificationCatalog.js`
- `src/domains/notifications/background/notificationPolicy.js`
- `src/domains/notifications/background/notificationStateRepository.js`
- `src/domains/notifications/background/NotificationService.js`

Expected edits:

- `src/manifest.json`
- `src/platform/storage/internal/chrome-storage/storageKeyRegistry.js`
- `src/domains/settings/config/settingsUpdateKeys.js`
- `src/apps/background/services/SettingsService.js`
- `src/apps/background/services/runtime/backgroundKernelCoreServices.js`
- `src/apps/background/index.js`

Possible later edits:

- schedule runtime owner
- isolation-session runtime owner
- dashboard settings UI
- dashboard schedule UI

## 16) Testing and verification plan

### 16.1 Immediate verification for foundation

- `npm run build`

This is the required baseline after structural changes.

### 16.2 Targeted tests to add when implementation begins

- config normalization tests for `notificationsConfig`
- policy tests for per-kind enablement and reflection daily caps
- service tests for dedupe behavior
- settings service tests proving `notificationsConfig` normalization and cache update

### 16.3 Behavioral checks

- feature disabled by default after clean install and after settings read
- enabling notifications does not trigger old session events retroactively
- service restart does not create duplicate immediate sends for the same session-end event
- notification click opens the intended route only once

## 17) Open decisions for implementation session

These decisions should be resolved before wiring event emitters:

1. What is the canonical owner for isolation-session lifecycle in current code?
2. What is the cleanest existing helper for opening dashboard routes from background?
3. Should `notifications` live in baseline permissions or optional permissions for the release build?

Current recommendation:

- treat notifications as manifest permission with product-level opt-in
- keep event contract internal
- ship foundation first, then wire one event family at a time

## 18) Summary of the intended first implementation

The first implementation should build a durable seam, not a large feature surface.

Specifically:

- add a dedicated background-owned notifications domain
- store user preference in canonical settings as `notificationsConfig`
- keep delivery bookkeeping in `runtime.notification_state`
- default every notification path to disabled
- do not implement suggestion prompts yet
- wire the system so session-end notification can be added next with minimal churn
