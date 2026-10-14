# Popup Surface Boundary Map

- Status: Active
- Owner: popup app shell, tracking popup controller, background popup block flow, special-session client
- Last validated against code: 2026-10-08
- Path policy: current-only
- Canonical for: popup boot browser boundary, popup site snapshot presentation, protect-site queue/permission/commit flow, current special-session state, popup action status messages, and popup artifact closure
- Companion to:
  - `docs/architecture/repository/storage-stats-tracking-boundary-map.md`
  - `docs/architecture/repository/settings-tab-boundary-map.md`
  - `docs/architecture/repository/notifications-runtime-boundary-map.md`
  - `docs/system-architecture/02-runtime-storage-boundaries.md`

## Purpose

During the registration journey, the protection action opens Main with the
current normalized domain as an uncommitted
`setup=site-registration` URL intent. `buildSiteRegistrationIntent()` is the
canonical site-only contract for URL and internal Dashboard routes. Retired time
fields in incoming URLs are discarded at that input boundary; new internal
intents reject them. This handoff
does not queue a block, request origin permission, or register the domain.
Progression's `siteRegistrationJourneyPolicy.js` decides the shared access DTO;
Popup snapshots expose required booleans `access.requiresDashboardRegistration`
and `access.sitesManagementVisible`. A dashboard visit is a separate receipt
and never enables immediate registration. Direct Popup registration opens after
five protected sites have been registered concurrently or five qualified use
days; the progression-owned completion milestone survives deletion. Development
full access projects this availability without granting a durable milestone.
Both queue/commit routes and the direct protect action reject time fields and
create no time goal. The pending session carries only domain and requestedAt.
Sites owns all time editing. These actions revalidate this owner
decision before any permission queue or new-site mutation. A commit-time handoff
clears the pending UI intent and never fabricates a protected snapshot. Existing
protected-site edits remain available. The Sites link is absent before the first
successful protected registration, then remains available for management.
Existing allowed-only profiles also retain the Sites management link. The
progression query takes both exact canonical membership counts; allowed sites
do not spend protected slots or grant a protected-registration milestone.

Registration admission rejects through the canonical
`src/domains/progression/contracts/siteRegistrationRejection.js` contract.
Popup queue/commit and direct protect-site responses preserve the limited
registration budget, qualified-use-day count and next increase day supplied by
the settings/progression owner. The popup controller validates this response
and shows the current site limit and next qualified use day. It does not compute
the budget, infer calendar days or replace malformed rejection details with
guessed numbers. Permission-time admission races clear the pending intent and
show the same limit guidance without presenting protection as applied.

The popup is the smallest user-facing control plane. It may show a snapshot of
the current site and request a protection action, but it must not become a
parallel settings owner, a silent permission fallback, or a place where runtime
owner failures turn into ordinary inactive state.

The practical reading question is:

```text
Can every popup action be traced from a visible control to the runtime owner
that owns the site snapshot, permission gate, pending protection queue, or
special-session state, with failures staying visible in the popup message?
```

## Investigation Routing

When to read this:

- The popup shows the wrong current-site state, missing metrics, or a broken
  unavailable-site state.
- Protect-site, permission prompt, pending protection, or popup action status
  behavior is wrong.
- Special-session read/action state appears inactive when an owner failure
  should stay visible.

First code entrypoints:

- `src/platform/chrome/popupBrowserClient.js`: popup boot's narrow browser URL
  and UI-language/messaging client; it does not expose the background app kernel.
- `src/i18n/popupConfig.js`: typed language hydration and common-only Popup
  i18n initialization.
- `src/domains/tracking/popup/usePopupSiteController.js`: popup state and
  action orchestration.
- `src/domains/tracking/popup/query/popupSiteSnapshotQueryService.js`: current
  site snapshot owner query.
- `src/domains/tracking/background/trackingPopupBlockFlow.js`: protect-site
  queue and commit owner flow.
- `src/ui-kit/popup/PopupPage.jsx`: presentation of controller-owned state.
- `src/ui-kit/Favicon.jsx`: shared favicon presentation, source loading/failure
  state, and `FaviconQueryService` subscription, also used by dashboard and gate.
  The popup controller supplies page/domain identity and owns no favicon cache.

Confirm owner by:

- Follow `System Flow` for the failing read or action.
- Check the `Owner Table` for the canonical owner and forbidden shortcut.
- Check the `Function Ledger` for the boundary function and failure policy.

Common false starts:

- Patching `PopupPage` for failures owned by the background snapshot, permission
  gate, or special-session owner.
- Treating a transport/owner error as an unsupported page or inactive session.
- Adding popup-local settings or permission mutation logic.

## System Flow

Popup bootstrap:

`popup.html` loads `src/apps/popup/popup.css` as its document stylesheet before
JavaScript. This single layout owner styles the static loading shell, runtime
boot shell and mounted app. The HTML must not retain a second inline copy of
Popup layout rules: stale padding, gaps and row sizes survive hydration and
can push action controls outside the fixed 520 × 360 surface. The visual harness
imports the same stylesheet directly. Startup and runtime keep the same geometry.
The document root stacks the optional first-setup guidance and the popup shell
in one fixed-height flex column. Guidance keeps its natural height; the shell
uses the remaining height with a zero minimum. A guidance receipt or dismissal
must not be required to expose the dashboard, protection or media controls.
The vault admission screen also uses semantic classes from this stylesheet;
Popup does not load Dashboard's utility CSS. Checking, failure and locked states
keep the exact Dashboard link available without mounting the private runtime.
The shared prepared-status request admits healthy fresh profiles directly as
`unlocked/local`, without password setup or a Dashboard detour. An unexpected
unprepared state stays busy with a status retry; owner failure exposes a diagnostic
code and retry. Only an existing `locked/passphrase` profile asks for Dashboard
unlock. Incompatible data stays explicit and offers Dashboard recovery without
rewriting or deleting it. Popup never creates keys or changes the optional lock.

The controller's `contextDomain` is the normalized domain resolved by the real
active-tab query. `PopupPage` exposes it on its root as read-only `data-site-domain`,
including while a hidden Popup waits for snapshot refresh. It is an observation
of the bound site, never an input override or a readiness/success claim. The
owned-tab QA preparation waits for this binding before activating its Popup tab;
a loading shell or an elapsed delay cannot prove that the active-tab query ran.

```text
popup.html
  -> src/apps/popup/main.jsx
  -> popupBrowserClient.runtimeGetURL() / runtimeGetUILanguage()
  -> renderPopupBootShell()
  -> parallel admission: popupConfig + documentTheme + PopupApp
  -> popupConfig (typed app_language + common-only resources)
  -> initializeDocumentTheme()
  -> PopupApp
  -> usePopupSiteController()
  -> PopupPage
```

Snapshot freshness (2026-09-19):

- `popupSiteSnapshotRefresh.js` owns query demand for the mounted popup only.
  It consumes the existing validated `STATS_EVENT` and typed protocol-settings
  subscription. There is no new background broadcast, persistent cache or poll.
- The query captures one clock for the activity-day read and returns `refreshAt`
  from the shared activity-day calendar boundary. The popup schedules one read
  at that deadline, including when no usage is being recorded. Local calendar
  arithmetic preserves the next reset hour across 23/25-hour DST days.
- Ordinary stats commits are coalesced to at most one read per second; one
  request and one trailing demand are retained. Settings/reset/day-boundary
  invalidations reject earlier responses. A read straddling the boundary gets
  at most one fresh read before reporting an expired-owner failure.
- Hidden documents do not query or retain timers. Visibility return refreshes;
  pagehide/unmount removes listeners, settings subscription and timers, and
  fences pending replies. The clock does not extrapolate usage.
- Background refresh does not clear action messages. Read failures remain
  visible as `load_error`; a later successful read clears only that read error.
  A protection commit also invalidates any read captured before its ACK.

Current-site snapshot:

```text
usePopupSiteController
  -> ChromeService.tabsQuery(active/currentWindow)
  -> runtimeSendMessageReliable(GET_POPUP_SITE_SNAPSHOT)
  -> popupSiteSnapshotQueryService
  -> settings cache + stats facts + protection runtime snapshot + permission snapshot
  -> normalizePopupSiteSnapshot()
  -> PopupPage
```

Protect-site action:

```text
PopupPage start protection
  -> usePopupSiteController.handleProtectSite()
  -> POPUP_QUEUE_BLOCK_DOMAIN
  -> permission sheet when site access is needed
  -> ensureDomainEnforcementPermissionStrict(domain)
  -> POPUP_COMMIT_BLOCK_DOMAIN
  -> trackingPopupBlockFlow / settings command owner
  -> popup message surface
```

Special-session action:

```text
usePopupSiteController
  -> getSpecialSession()
  -> startSpecialSession() / endSpecialSession() / addSpecialSessionTemporaryAllowedSite()
  -> popup message surface
```

Embedded-media support and permission:

```text
usePopupSiteController (current HTTP(S) tabId)
  -> usePopupMediaSupport / popupMediaSupportClient
  -> GET_MEDIA_FRAME_SUPPORT
  -> FrameMediaControlBroker.snapshot
  -> requireFrameMediaSupportSnapshot
  -> PopupMediaSupport (known-frame evidence or explicit unknown coverage)

PopupMediaSupport listed-origin click
  -> requestEmbeddedMediaOriginPermissionStrict
  -> ChromeService.permissionsRequestStrict (same user gesture)
  -> support re-query + reload guidance
```

The support read never starts a hold. It queries once on popup admission, when
the user opens/refreshes the detail, and after a permission outcome. It adds no
poll or background broadcast. Pending reads are fenced on tab change,
pagehide, unmount, and permission completion. Query failures are explicit;
they do not become zero detected media or ordinary unavailable support.

The detail separates observed media counts, pause/resume capability, command
acceptance, and verified pause evidence. `known_frames` describes only registered
receivers, never complete tab coverage. `unknown` stays visible. Same-origin
frames managed by the top hold do not acquire invented remote verification.
Seek remains unsupported by this remote hold contract. Evidence is a last
reported snapshot, not a live playback meter.

Only an origin in the current validated `requiredOrigins` may enter the click
handler. The security gate accepts one canonical HTTP(S) origin and requests
the exact scheme/host pattern plus scripting through the strict permission
port. It never adds a subdomain wildcard or all-host access. Non-default ports
are rejected because browser host permissions cannot express that narrower
scope. The permission request precedes every await to preserve user activation.
No protection queue, blocked-site setting, or saved policy is changed. Grants
cause a fresh read and instruct the user to reload the tab; immediate injection
into existing frames is not promised. Denial and browser errors remain visible.

## Owner Table

| Concern | Owner | Key files | Output | Forbidden shortcut |
| --- | --- | --- | --- | --- |
| Popup shell | popup app entry | `src/apps/popup/main.jsx`, `popupBootShell.js`, `PopupApp.jsx` | loading/error shell and React popup mount | business-data reads or direct settings writes in the shell |
| Popup i18n profile | i18n surface projection | `src/i18n/popupConfig.js`, `src/i18n/popupResources.js`, `src/domains/settings/i18n/popupRuntime.js` | typed persisted language plus common-only React and boot-shell copy | importing full `i18n/config.js`, `i18n/resources.js`, or the full runtime translator into Popup boot |
| Popup boot browser boundary | narrow platform client | `src/platform/chrome/popupBrowserClient.js` | extension URL, extension UI language, and popup-scoped browser operations without a background-kernel facade | importing `ChromeService` or background app/kernel modules into popup boot |
| Popup controller | tracking popup hook | `src/domains/tracking/popup/usePopupSiteController.js` | current popup view state and action handlers | panel-local permission/settings mutation logic |
| Popup snapshot freshness | popup lifetime refresh owner | `src/domains/tracking/popup/popupSiteSnapshotRefresh.js` | bounded signal-driven reads and one owner-issued activity-day deadline | a popup usage clock, hidden polling, stale responses after reset or disposal |
| Popup site snapshot | background popup query service | `popupSiteSnapshotQueryService.js`, `popupSiteSnapshot.js` | normalized popup snapshot | treating malformed permission/stats/settings owner output as empty unsupported site state |
| Protection queue/commit | background popup block flow and message routes | `trackingPopupBlockFlow.js`, `popupBlockMessageRoutes.js` | pending block, commit result, permission-required result | direct popup settings patch or no-op popup owner |
| Site permission | capability gate | `capabilityGate.js` | concrete domain permission grant result | global host grant or permission denial hidden as success |
| Embedded-media support | popup media hook/client and background broker | `usePopupMediaSupport.js`, `popupMediaSupportClient.js`, `FrameMediaControlBroker.js`, `frameMediaProtocol.js` | validated current-tab receiver capabilities and command/verification evidence | interpreting detection, accepted commands, or partial receiver inventory as verified tab-wide enforcement |
| Embedded host permission | narrow capability gate | `requestEmbeddedMediaOriginPermissionStrict()` in `capabilityGate.js` | explicit exact-host permission result | registering protection targets, broad host patterns, implicit grant requests, or claiming existing frames were injected |
| Special-session state | special-session client/runtime owner | `specialSessionClient.js`, `specialSession.js` | normalized special-session state and action results | read failure becoming inactive session without a visible message |
| Popup presentation | UI kit popup page | `src/ui-kit/popup/PopupPage.jsx`, `src/lib/popup/popupPresentation.js` | visible readouts, permission sheet, message text | text-only status without controller-owned action state |

## Function Ledger

| Boundary function | Input | Output | Failure / missing-data policy |
| --- | --- | --- | --- |
| `renderPopupBootShell()` | popup boot mode and copy | loading/error shell HTML | bootstrap failure gets explicit shell error text |
| `popupConfig` initialization | typed `app_language`, extension UI-language fallback, common locale projection | initialized i18next instance and document/runtime language | storage or extension-language failures are diagnosed; no detector or full-resource fallback is admitted |
| `popupBrowserClient.runtimeGetURL()` / `runtimeGetUILanguage()` | popup-owned relative extension path or language query | extension URL/UI language or declared UI-only degradation | boot does not import `ChromeService` or a background runtime facade |
| `usePopupSiteController()` init | active tab URL and popup snapshot response | normalized popup state | unsupported browser pages show `page_unavailable`; snapshot owner failures show `load_error` |
| `normalizePopupSiteSnapshot()` | runtime snapshot DTO | popup snapshot DTO | current contract normalizes missing optional fields; query owner must reject malformed required owner outputs before this boundary |
| `getPopupSiteSnapshot()` | current page request and background owners | popup site snapshot | missing facts/settings/permission owners throw; malformed facts range or permission snapshot throws |
| `handleProtectSite()` | current domain | queued protection or permission prompt | typed registration limit shows `registration_limit_reached` with the owner limit and next qualified use day; other owner failures show `protect_error`; no silent local settings write |
| `handleConfirmPermissionPrompt()` | domain permission prompt state | permission grant plus commit result | typed registration limit clears pending intent and shows the same owner guidance; other permission/commit failures show `protect_error`; denial shows `permission_required` |
| `getPopupMediaSupport()` | current HTTP(S) tabId | strict broker support snapshot | transport, owner and DTO failures surface as failed support reads |
| `usePopupMediaSupport().requestOrigin()` | user-clicked current required origin | grant/deny/failure plus refreshed support | unlisted origins never reach the permission API; stale lifetime replies cannot update the popup |
| `requestEmbeddedMediaOriginPermissionStrict()` | one canonical HTTP(S) origin | strict browser permission result | malformed, broad or non-default-port input throws before browser dispatch; never calls a protection mutation |
| `clearPendingPopupPermissionIntent()` | pending domain | pending block cancel message | cancellation is best-effort cleanup only; it is not a source of protection truth |
| `getSpecialSession()` effect | special-session owner state | normalized session state | read failure shows `special_session_load_error`; it must not look like normal inactive state |
| `handleStartFocusSession()` | default focus duration | started session | owner failure shows `special_session_error` |
| `handleEndSpecialSession()` | active session | ended session state | owner failure shows `special_session_end_error` |
| `handleAllowCurrentSiteForSession()` | current domain during isolation session | updated session state | owner failure shows `special_session_site_allow_error` |

## Recovery Versus Fallback

| Class | Allowed? | Rule |
| --- | --- | --- |
| Unsupported active tab | Yes | explicit `page_unavailable` state; no runtime snapshot request |
| Popup snapshot transport failure | No fallback | show `load_error`; do not fabricate current-site metrics |
| Malformed popup facts range | No fallback | reject the snapshot query; do not present empty usage or `hasTodayStats=false` as if stats were genuinely absent |
| Missing permission grant | Visible user outcome | show permission sheet or `permission_required`, not success |
| Permission owner failure | No fallback | show `protect_error` with owner detail |
| Pending protection cancel on unmount | Best effort | cleanup only; protection truth remains in background owner |
| Favicon cache/read failure | UI-only | hide cached favicon and continue with extension favicon candidates |
| Special-session read failure | No inactive fallback | show `special_session_load_error` and keep the action owner failure visible |
| Special-session action failure | No fallback | show the action-specific error message |

## Current Findings

### F1. Protect-site owner failures already stay visible

Status: keep.

The popup protect flow already separates queue, permission grant, commit, and
permission denial. Queue and commit owner failures are visible as
`protect_error`, while user denial is visible as `permission_required`.

### F2. Special-session read failures no longer become inactive state

Status: fixed in the 2026-07-01 popup surface pass.

The popup read of the current special session previously caught owner failures
and replaced them with `normalizeSpecialSessionState(null)`. That made a broken
special-session owner look like an ordinary inactive session.

Resolution:

- `usePopupSiteController` now keeps the normalized inactive state only as a UI
  placeholder while surfacing `special_session_load_error` in the popup message.
- the message includes the owner error detail, falling back to
  `SPECIAL_SESSION_LOAD_FAILED` when the owner gives no detail.
- locale resources and controller tests cover the read-failure path.

### F3. Pending protection cleanup cannot hide the action owner outcome

Status: fixed in the 2026-07-01 popup cleanup boundary pass.

`clearPendingPopupPermissionIntent()` is cleanup-only. It may try to cancel a
background pending block intent, but that cancellation result is not the source
of truth for whether queue, permission grant, or commit succeeded.

Resolution:

- pending-intent cancel now logs and returns `false` on cleanup failure instead
  of throwing through the visible popup action path.
- commit and permission-confirm failures keep their original `protect_error` or
  `permission_required` message even when the cleanup cancel message fails.

### F4. Popup facts range owner output is validated before metrics projection

Status: fixed in the 2026-07-04 stats/tracking audit.

`getPopupSiteSnapshot()` consumes stats facts from the background stats owner.
Malformed facts output must not be converted into `hasTodayStats=false`,
`todayMs=0`, or an ordinary empty current-site snapshot.

Resolution:

- popup site snapshot query now requires a plain facts range with a plain
  `dates` object before deriving current-site metrics.
- malformed facts range output fails with
  `POPUP_SITE_SNAPSHOT_QUERY_FACTS_RESULT_INVALID`.
- `check:stats:projection-architecture` keeps the required validation token and
  rejects the old optional `statsRange?.dates` read.

### F5. Popup boot owns a narrow static language and browser closure

Status: tightened in the 2026-08-15 Popup i18n projection pass.

`src/apps/popup/main.jsx` uses `popupBrowserClient` for the extension URL needed
by its loading/error shell and for the extension UI-language fallback. The
tracking popup controller remains the owner of site snapshot and action
orchestration; the boot client does not absorb that business role.

The Popup previously initialized `src/i18n/config.js` and imported the full
runtime translator before painting its skeleton. That admitted every locale
namespace, including Schedule and the generated background-runtime projection,
into the Popup's static closure. Popup now uses a common-only resource/runtime
projection, paints the skeleton from that projection, and dynamically admits
typed language hydration, React i18n, document theme, and `PopupApp` in parallel
before the React mount.

Rollup no longer manually captures background-kernel dependencies into a chunk
that Popup imports. The public manifest's imports-only closure for
`src/pages/popup.html` is `8` JS files, `299,426B` raw, and `93,217B` gzip.
`check-context-bundle-budget.mjs` fails if that closure exceeds its limited
headroom or reaches background-kernel, pond, plugin-catalog, or Zen research
artifacts. Reachability is checked against both manifest keys/files and the
project-relative Rollup module ids in `.vite/entropy-module-inventory.json`, so
a generic chunk name does not hide a forbidden owner.

### F6. Popup uses one fixed field with progressive disclosure

Status: adopted in the 2026-09-09 popup design pass.

- The 520 × 360 surface keeps an 80px utility rail. Today usage is the primary
  readout; an existing positive goal shows progress and remaining/over-target time
  in one ink-colored band. Canonical zero shows no time target and no progressbar;
  a protection action never substitutes a 60-minute default.
- Site protection status is visible text. The today-share metric is no longer
  shown in the first view; its snapshot ownership is unchanged.
- `buildPopupEffects()` projects all active filters and engaged artifacts, with
  a total count and grouped descriptions behind one disclosure. Standby
  artifacts and policy-only preferences do not enter the active-effect count.
  Every runtime effect must have an explicit Popup label/description mapping;
  missing mappings fail visibly rather than silently disappearing.
- The rail has labeled isolation and dashboard controls, without a decorative
  brand cell. Isolation opens a fixed-area management dialog; it never squeezes
  the site readout. An active session opens management before end/allow actions.
- Effect and isolation dialogs use the shared focus owner for initial focus,
  Escape and focus restoration. Action messages remain visibly dismissible.
- Presentation still consumes controller snapshots and handlers; no additional
  settings, runtime or storage owner is introduced.

## Re-Audit Checklist

- Run `npm run test:file -- tests/usePopupSiteController.test.jsx tests/popupPage.layout.test.jsx tests/popupPresentation.test.js` after popup surface changes.
- Run focused `tests/popupMediaSupport.test.jsx`, `tests/capabilityGateSelectivePermissions.test.js`, and `tests/frameMediaHoldClient.test.js` after embedded support/permission contract changes.
- Run `npm run test:file -- tests/popupSiteSnapshotContract.test.js tests/popupSiteSnapshotQueryService.test.js tests/trackingMessageHandlerPopupActions.test.js tests/trackingPopupBlockFlow.test.js` after popup snapshot or background popup-block owner changes.
- Run `node scripts/ci/check-context-bundle-budget.mjs <public-build-dir>` after popup boot/import or Rollup graph changes.
- Run `npm run check:docs:paths` after updating this map.

## Applied boundary state (2026-10-01)

usePopupSiteController consumes useAppliedScheduleRuntime from the schedule
client seam. GET_SCHEDULE_RUNTIME_STATE and SCHEDULE_RUNTIME_CHANGED include
both manual and recurring isolation after successful dispatcher application.
An unavailable owner remains visible and disables session actions. Manual
start/end/temporary-host commands refresh the applied state; their mutation DTO
is not a replacement live-state source. A recurring boundary ends through
END_SCHEDULE_OCCURRENCE and preserves its routine. Temporary hosts belong only
to manual isolation. No settings or runtime storage mirror is owned by Popup.
