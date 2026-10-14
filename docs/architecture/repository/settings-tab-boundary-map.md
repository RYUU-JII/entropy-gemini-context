# Settings Tab Boundary Map

- Status: Active
- Owner: dashboard Settings tab, platform permission capability, security settings store, protocol settings store, destructive runtime storage actions
- Last validated against code: 2026-10-14
- Path policy: current-only
- Canonical for: release V1 Settings UI ownership, selective permission actions, security status, workspace preferences, and data-lifecycle command handoff
- Companion to:
  - `docs/architecture/repository/settings-command-boundary-map.md`
  - `docs/system-architecture/02-runtime-storage-boundaries.md`
  - `docs/decisions/security/selective-host-permission-security-decision.md`

## Activity-day settings (2026-09-06)

- Workspace owns `DailyRhythmPanel`. Its parked analysis-store selector reads
  `cycleState.resetPolicy` and `cycleError`; Settings' visible cycle demand owns
  refresh, not the panel or a separate storage subscription.
- The initial canonical start hour is 04:00 local time. The selector admits only
  integer hours 00–23 and submits an explicit Save through `setResetHour`.
  `CycleStateManager` remains the sole policy writer through SettingsService.
- Effective and pending hours are distinct presentation values. Changes apply at
  the next boundary of the currently effective policy; saving the effective hour
  cancels a pending change. No mid-day fact reset occurs.
- A recommendation appears only when it differs from the effective hour and no
  change is pending. Accept and Keep current time use existing cycle commands.
  Pattern analysis never changes the start hour itself.
- Failed commands/queries produce visible feedback. The view never invents a
  default policy when canonical cycle state is unavailable.

## Release V1 Contract

### Protection policy surface (2026-10-13)

Settings exposes **General / Protection / Records and insights / Security and data**.
General remains the default. Protection is a named presentation-only secondary
module using the same recovery, idle/intent preload and page-scroll owners.
`SettingsProtectionSection` owns a parked protocol projection and scoped
pending/error feedback. It edits the single cooling preset through
`setCoolingCurvePreset` and Site/Global reminders through `setGoalEndEnabled`.
Controls display acknowledged canonical values. Independent scope saves preserve
each other through serialized commands against the latest background settings.

The exact persisted activation owner is `nudgeConfig.goalEnds: { site, global }`.
Its two booleans replace stored `nudgeConfig.enabled`; only runtime assembly
derives aggregate activation. Legacy presence rejects untouched and requires
the explicit development-profile reset. The existing Global goal installation
journey explicitly enables only Global through this same typed contract.

The authored curve illustration is a preset example, not live progress. A
non-null advanced curve shows an explicit custom state with no preset selected;
choosing a preset clears advanced values through the existing atomic command.
Sites owns time goals and runtime facts. Tools owns enabled effects, strengths,
family curve/fixed modes and Barrier's independent periodic choice. Furin Tools
shows scoped policy/prerequisites and links here; temporary pause is a separate
override. Filter is a development preview with a read-only preset summary.

Shared safety boundaries, actual-only coalescing, new-selection priority and
goal-edit cancellation are explained as guarantees, not editable switches.
Navigation uses the Dashboard callback and internal Settings section selection.
This surface adds no timer, policy store, permission request or usage calculation.

### Observation, records and setup (2026-09-07)

Settings presents **General / Protection / Records and insights / Security and data**. General
is the initial section. It uses the existing Workspace module record and named
pending/error boundary; Permissions remains in the synchronous entry graph.
The shell has one scroll owner and a bounded reading width. Section groups form
a single vertical ledger, with labels and controls aligned within each group.
No section adds its own scroll surface or theme-specific component structure.

`DashboardSetupAdmission` initializes and subscribes the canonical protocol
store before normal boot. UNSET admits Main while collection remains fail-closed;
it no longer mounts a separate recording setup page. Main's existing first-site
editor offers one domain, an initially unchecked protected-site recording choice,
and Start. Its compound site command conditionally commits the rule and all five
recording keys in the same serialized mutation. Unchecked means OFF, checked means
protected-site/basic with precision off. No daily time goal is requested in this
first action. Explicit Browse without recording conditionally commits all five
OFF policy keys without registering a site. The sidebar is available before
this choice; ordinary navigation leaves UNSET collection closed and commits no
policy. Registration and explicit Browse settle only after canonical
acknowledgement and reconciliation. Existing First Vision, capacity,
shadow identity and concrete site-permission owners remain authoritative.
Chosen profiles are never rewritten by these first-use commands.

All-site records and granular history remain explicit Settings choices.
`localUsagePolicy.js` composes their strict selection into existing typed keys;
it introduces no persisted mode, mirror, or new permission source. Required browser
permission admission completes before the Settings policy is committed. Denied
admission leaves existing policy unchanged and feedback stays at the initiating
surface. Concurrent policy submissions are fenced.

The main records surface contains a usage scope, a collapsed activity-history
summary and selective site-access status. `UsageRecordingControls` shares the
same policy field contract. Activity-history detail controls the existing
`precisionInsightsMode` and two `precisionInsightsSignals` groups: page activity
(`clse`) and tab/site movement (`navigation`). These are history permissions,
not switches claiming to stop every sensor needed by a selected artifact.
Functional observation remains owned by the selected protection features;
analysis-only demand may independently keep an admitted observer alive.

Usage scope and Journey notification controls own their explanations inline in
their existing Settings rows. Neither adds a separate generic help disclosure.
The recording scope retains its guidance anchor; explanation placement creates
no new guidance receipt, policy command, or notification permission owner.

There is no independent public computation/analysis switch. Turning records off
commits `dataCollectionMode=off`, `insightsConsent=later`, and `insightsMode=off`,
while retaining the selected history mode and signal preferences. Current domain
and precision admission therefore closes, including personal-model I/O. Resuming
records explicitly applies the selected scope and rechecks required browser
permissions. Enabling a history preference never silently enables a stopped
record scope. Existing records are retained until the separate delete command.

Excluded-site management is always available in Records and insights, including
an empty list and stopped global recording. Its explicit removal action uses
`setSiteRecordingExcluded({ domain, excluded: false })`; it neither resumes the
global scope nor changes protection membership. The exclusion disclosure owns
its command-pending state, visible failure/retry, and focus restoration after
an acknowledged removal. Exclusion changes never delete historical records.

The existing Dashboard navigation parameters accept
`{ section: 'permissions', focus: 'recording-exclusions' }` for the Sites-to-
Settings handoff. Settings owns section selection and reveals/focuses the
exclusion disclosure once per navigation intent. This is transient navigation
state, not a new persisted preference or a second exclusion-management surface.

The two supported signal groups are not presented as independent feed, writing
and media sensors. A future sensor needs its own collection/consumer contract
before an independent observation control can be published. No new writing
history collection or implicit consent expansion is introduced by this UI.

Display/performance, security policy and stored-data details use a shared native
disclosure. Closed content is unmounted; keyboard focus trapping recognizes the
summary and excludes controls inside closed details. Errors and destructive
confirmation outcomes remain visible outside folded preference details.

The Settings tab composes typed stores and named runtime commands. It does not
own persistence, raw browser permissions, passcode hashing, IndexedDB access, or
destructive storage mutation.

The recording controller commits the complete five-key usage policy, including
unchanged history preferences. Its pending acknowledgement coverage therefore
matches the submitted command. Typed store state reflects canonical reads and
ACKs only; queued intent remains a separate command projection. Repeating an
unacknowledged value joins a fresh acknowledged intent rather than reporting an
early success from equality with desired state.

The shared Dashboard settings feedback owner renders failed saves and application
recovery inline in the Settings workspace for all channels. Tools mounts the same
`SettingsCommandFeedbackBridge` in its normal layout with protocol-only channels
so artifact application waits, failures, and retries remain visible there without
unrelated preference/security errors. Settings command outcomes never create
global toasts, floating panels, or notification dialogs. Sites and Artifacts retain
their local control error feedback. Operation receipts survive tab changes and
unrelated settings saves; reopening Settings exposes unresolved recovery. Its retry action
calls the named background `RETRY_SETTINGS_PROPAGATION` owner with acknowledged
keys and the current Dashboard generation, never earlier setting values. Each
command has an independent pending/error/application receipt. An unchanged
storage ACK cannot erase a failed application receipt; a covering succeeded
propagation outcome resolves it.
Application warnings belong only to commands whose acknowledged keys include
an actual runtime effect in that receipt. Storage-only preference/security
commands and unchanged effect commands do not inherit another command's failed
application outcome from a shared batch. Retry sends only the affected runtime
keys allowed by the named recovery contract.
Typed setting controls wait for a scoped canonical query after storage ACK.
Save success and current UI snapshot reconciliation are separate outcomes: a
failed query preserves the original save receipt and known displayed values,
then reaches the existing visible control error path with `committed: true`.
The reconciling receipt keeps undo intent actionable during that query gap;
same-value retry also performs the query while that key's reconciliation failure
remains. Unrelated successful reads cannot clear another key's failure.

Host access is selective-only:

- base MV3 installation has no global host grant;
- the UI requests only concrete managed origins needed by the selected policy;
- the Settings surface does not pre-grant `scripting` before a managed site exists;
- when existing managed sites lack access, one visible action requests `scripting`
  together with only those missing concrete origins;
- new site registration keeps its just-in-time site permission request, so the
  user is not asked to choose a misleading future auto-approval mode;
- denied, missing, malformed, or rejected permission results remain visible in
  `PermissionGate`;
- there is no global-host mode, broad-grant cleanup action, or permission
  compatibility state.

The App section does not expose a theme selector. Removing that presentation
control does not rewrite, normalize, or silently replace an existing
`app-theme` preference; theme preference reads remain owned by the canonical
theme repository.

The Settings presentation uses one current visual seam:

- `SettingsTab` owns the lightweight hydration/widget readiness shell. Section
  controllers and capability reads mount only after that shell is ready;
- presentation and runtime activity are separate. Exit DOM may remain visible,
  while permission/security requests and destructive-action state are parked as
  soon as `isRuntimeActive` becomes false;
- protocol/security projections retain their last active identity without observing
  background store churn during exit. A permission read admitted while active may
  populate the shared permission resource, but its generation cannot commit to the
  inactive Settings UI;
- the Permissions section remains in the Settings entry graph and is
  immediately usable after tab readiness. Protection, Safety and Workspace are three
  policy-named, presentation-only async boundaries; their store commands,
  capability decisions, and status state remain owned once by `SettingsTab`;
- after the first ready Settings content commits, one bounded idle admission
  warms all three secondary section module records. Pointer, pointer-down, and focus
  intent join those same records. A ready record renders its validated component
  directly without a one-frame lazy fallback; a failed speculative load remains
  an exact local error until explicit retry creates a fresh record;
- `SettingsShell` owns the page header, section navigation, and the only page
  scroll container. Changing the selected section resets that owner's position
  to its heading before paint; updates within the same section retain its scroll
  position and do not remount the owner;
  section attention markers retain their inline slots as permission/security
  reads settle. Only the page scroll owner reserves a stable gutter on both
  edges, keeping the bounded reading field centered under the header and its
  x/width unchanged when disclosure content starts or stops overflowing;
- `SettingsControlPrimitives` owns ledger surfaces, groups, rows, exclusive
  choices, switches, fields, actions, and inline feedback;
- leaf panels compose those primitives and do not import `Panel`, invent local
  switch/radio chrome, or branch their structure with `isZen`;
- each section renders as one continuous ledger separated by hairlines. Nested
  cards, shadows, and per-panel surface treatments are not current UI paths;
- routine successful preference changes are silent. Denials, validation
  failures, owner errors, and destructive-operation results remain visible in
  the initiating group. Warning prose uses normal high-contrast text with amber
  limited to the marker, border, or background rather than the full sentence;
- `SettingsInlineTask` owns task heading, local Escape cancellation and origin
  focus restoration without a portal, backdrop or focus trap. Secondary cancel
  precedes the committing/destructive action. Busy tasks cannot be cancelled by
  Escape and actual security switches stay unchanged before authorization;
- Safety follows source order: optional data lock, protection PIN/policy, encrypted
  backup/restore, cleanup/reset. Backup authorization, encryption and response ACK
  remain in the existing security/background owners.

`DataLockPanel` consumes the admission owner's shared vault controller. Local mode
offers optional passphrase setup in `SettingsInlineTask`; passphrase mode offers
change and removal with current proof. The displayed mode changes only after the
canonical owner acknowledges the same-key operation. Cancel, completion and
runtime inactivity remove temporary secret inputs. This control does not clear
session keys or provide an immediate manual lock. Backup restore keeps its backup
password/PIN authorization and replacement confirmation, but its destination uses
local mode without a new local password. The admission-scoped restore controller
retains the successful receipt across runtime unmount and retries only its ACK.

`PermissionGate` exposes local usage scope first, activity-history detail on
request, and selective site access as status/repair. The retired profile-card
layer must not duplicate those decisions. The product recommendation
is owned by `RECOMMENDED_LOCAL_ANALYSIS_PROFILE_PATCH` in
`localAnalysisProfilePolicy.js`: all-site minimal records plus protected-site
precision. The low-level `protected_sites` / precision-off defaults remain the
pre-consent safety state, but scope defaults are not collection admission:
`insightsConsent=unset|later` fails closed in `dataCollectionPolicy.js` for both
domain usage and precision signals. The onboarding owner obtains the precision permission
bundle before atomically committing the selected scope and consent. Settings
shows current values without repeating recommendation badges for every field.

Settings mode changes preserve that authorization envelope. Protected-only
selection commits `protected_only`; all-sites minimal commits `all_sites`; off
commits `later`. Enabling precision while all-sites minimal remains selected
must preserve `all_sites` instead of silently narrowing consent and invalidating
the active collection contract.

On desktop the controls render as one vertical ledger. Site access shows one current
state/action row beneath the group status instead of a duplicate coverage
summary. Routine success adds no footer. Stored activity records expose one direct JSON export for the most recent 14
days. The existing query validates the payload before a download; pending and
failure remain at the initiating button. No raw-preview dialog is mounted.

The Security & reset section follows the task order visible to the user:

1. `SecurityPanel` manages the app passcode through focused set/change/remove
   tasks immediately beneath the initiating row. Passcode fields mount only while
   that task is open and clear on cancel, success, inactivity or unmount. Its second
   direct grid group is named passcode protection policy, not a separate
   security-mode product concept.
2. The same panel declares which implemented destructive actions require that
   passcode. `highSecurityMode` is presented by its actual effect, keeping the
   destructive-action lock enabled and preventing passcode removal; it does not
   claim storage-at-rest encryption.
3. `DataLifecyclePanel` exposes only analytics cleanup and full app reset. Each
   action reveals its own inline confirmation beneath the initiating row and
   collects authorization inside that task only. Existing command/response-ACK
   and generation handoffs remain authoritative.

Secret-bearing snapshot export (`includeSecrets: true`) and import
(`importSecrets: true`) always require the configured current passcode, including
when the destructive-action reset guard is disabled. Portable imports preserve
the local security document. Disabling the reset guard still deliberately permits
a full app reset without a passcode. These application authorization checks do
not protect against an attacker who can directly read or modify the local browser
profile and its co-located cryptographic keys.

These concerns render in source order. `SecurityPanel` uses display-contents
composition for its passcode group, folded protection policy and visible feedback.
Rows align controls with their labels and stack on narrow screens. Rejected responses and transport
failures from destructive actions remain visible with danger emphasis; completed
actions with warning codes use the shared warning treatment.

Future site-release or tab-visibility locks join the policy list only after an
authorization owner and read boundary exist. Settings does not publish inert
future toggles. Storage snapshot import/export remains a background support
capability and is not part of the primary Settings data-management surface.

General starts with the activity-day boundary, language and region, and one
system-notification opt-in. Sidebar density and current-theme rendering quality
are under Display and performance. Language and region
contains two compact rows rather than restoring a fourth solar card. Its
daylight-reference row exposes device-timezone auto-follow and a fixed region
choice directly. Selecting a valid region commits the complete profile once;
choosing fixed mode alone does not invent or commit a region. It does not request geolocation or expose latitude/longitude
editing. An existing manual or non-region profile stays visible as the current
fixed value until the user chooses auto-follow or a named region, so stored
state never becomes a hidden preference.

The notification control maps deterministically to the complete current
notification policy shape; event-kind booleans remain a runtime/config detail
rather than three parallel Settings switches. Developer lab visibility is
owned by the dev build entry; the former debug Settings panel remains retired
while dev builds expose Experiment directly.

## Owner Flow

```text
SettingsTab
  -> lightweight readiness shell
  -> ready content mounts section-owned controllers
  -> Permissions presentation is synchronous
  -> bounded idle or section intent
       -> Settings-owned Safety / Workspace module record
       -> policy-named local pending/error/retry boundary
  -> typed protocol/security/preference store or named runtime action
  -> metadata-driven channel client -> settingsCommandBus / settingsTransport
     or named background action owner
  -> canonical persistence or browser capability
  <- validated acknowledgement or explicit error
  -> status rendered by the initiating Settings section
```

## Owner Table

| Concern | Owner | Canonical seam | Failure policy |
| --- | --- | --- | --- |
| section composition | `SettingsTab` / `SettingsShell` | three-section registry + one Shell scroll owner | missing visible handler rejects |
| secondary presentation loading | Settings section module resource + `SettingsSecondarySectionBoundary` | one validated promise/error/component record each for Safety and Workspace, shared by idle/intent/render | exact module failure remains on the selected section; explicit retry alone clears the record |
| Settings visual grammar | `SettingsControlPrimitives` | ledger/group/row/control primitives | leaf-local card, switch, or theme branch is owner drift |
| selective permission snapshot | dashboard permission snapshot resource + platform capability gate | one bounded, in-flight-deduplicated strict permission query shared with Tools + one validated origin matcher per snapshot | malformed/read failure is visible; never an empty synthetic snapshot; permission mutations invalidate and force re-read |
| concrete origin grant | platform capability gate | managed-origin request | denial and owner failure remain visible |
| recommended local-analysis profile | `localAnalysisProfilePolicy.js` | `RECOMMENDED_LOCAL_ANALYSIS_PROFILE_PATCH` | Settings and onboarding must not restate the recommendation |
| local-analysis collection admission | `dataCollectionPolicy.js` | `insightsConsent` checked with canonical collection/precision modes | `unset`, `later`, and mode/consent mismatch deny collection; malformed consent rejects |
| collection and precision settings | protocol store | typed settings commands | unknown or malformed values reject |
| channel wiring and ACK completeness | settings domain command registry + `settingsCommandBus` | channel client factory and canonical pending-key coverage | submitted/pending key missing from `committedItems` rejects and stays dirty |
| command lifetime and application recovery feedback | `settingsCommandBus` + shared `SettingsCommandFeedbackBridge` in Settings (all channels) and Tools (protocol only) | independent operation receipts plus inline save failure/application retry | no global command toast or floating panel; unrelated completions retain failures; rejected recovery remains visible and does not replay saved values |
| security snapshot | `SecuritySettingsQueryService` | exact current security document | only missing known keys bootstrap defaults; malformed values reject |
| passcode material | `src/platform/security/passcode.js` | PBKDF2 release V1 envelope | malformed stored hash fails strict runtime authorization |
| app preferences (navigation density, language, daylight reference, notifications) | typed preference/protocol stores | current settings command lane | persistence failure remains visible in the initiating row/task |
| analytics cleanup / full reset | background storage action owners | runtime messages | dashboard never mutates storage directly |

## Function Ledger

| Boundary | Input | Result |
| --- | --- | --- |
| `createOriginPermissionMatcher()` | one strict browser-origin snapshot | reusable exact/wildcard host index for the whole domain batch |
| `readDashboardPermissionSnapshot()` | 15-second maximum age or explicit force | frozen strict permission snapshot with cross-tab in-flight/fresh-result reuse; failures reject and are not replaced with empty permissions |
| `projectSettingsPermissionState()` / `refreshPermissionState()` | fresh shared strict browser permission snapshot + managed domains | one exact flags/coverage projection; equivalent cached completion preserves object identity, while uncached/read failures remain explicit; grant/revoke paths invalidate and force a new read |
| `scheduleSettingsSecondarySectionPreloads()` | first ready Settings content + runtime activity | Safety and Workspace module admission in one idle callback with a 1200 ms maximum wait for admission | inactivity cancels unstarted admission; started imports remain module-record work, never tab readiness |
| `preloadSettingsSecondarySectionIntent()` | pointer, pointer-down, or focus section id | join the matching Safety/Workspace module record; Permissions is a no-op | undeclared section ids do not create work |
| `grantManagedSiteAccess()` | current managed-site count + concrete missing origins | one selective `scripting` + origin request; no wildcard expansion or empty-workspace pre-grant |
| `handleUsagePolicyChange()` | exact scope, history mode and signal selection | serialized local submission, required browser permission result, complete typed settings acknowledgement |
| `normalizeSecuritySettingsSnapshot()` | scoped security document | exact current values; malformed present values throw |
| `handleSavePasscode()` / `handleRemovePasscode()` | validated passcode input | current PBKDF2 V1 hash mutation acknowledgement |
| `handleNotificationsEnabledToggle()` | one visible opt-in | exact enabled/session-start/session-end policy + optional permission result |
| `handleSolarLocationSave()` | device-timezone auto or fixed named region | canonical solar-location profile acknowledgement; existing manual input may only be retained or replaced |
| destructive reset confirmation | action identity + task-scoped authorization | validated runtime result, warning-coded completion, or visible transport/owner error |

## Failure Policy

| Condition | Result |
| --- | --- |
| permission denied | visible user outcome |
| permission API/read malformed | explicit permission section error |
| unknown or wildcard origin request | reject |
| malformed security value | `SECURITY_SETTINGS_SNAPSHOT_INVALID` |
| malformed stored passcode hash in destructive runtime auth | `RESET_AUTH_HASH_INVALID` |
| settings write rejection | initiating panel keeps explicit failure status |
| local-analysis consent unset or deferred | protection remains available, but usage and precision collection stay off |
| collection mode exceeds consent scope | fail closed; do not infer or upgrade consent |
| destructive runtime transport rejection | initiating data group keeps exact failure status with danger emphasis |
| invalid snapshot JSON/envelope | reject before runtime storage mutation |
| malformed runtime success payload | reject; never display success |
| Safety or Workspace module rejection | selected section shows the exact local error and retry; Permissions and tab truth remain intact |

## Data Lifecycle Baseline

`DataLifecyclePanel` exposes analytics cleanup and full app reset only. The
separate encrypted backup surface retains the vault-owned export/restore flow.
Snapshot support actions still accept the exact current release V1 envelope and
current store shapes, but they are not composed into `DataLifecyclePanel`. They
do not convert predecessor formats or partially accept rows. Development state
from before this baseline is removed with
`docs/operations/runbooks/pre-release-development-profile-reset.md`, not a
Settings runtime migration.

## Guardrails

Recording restoration failures are owned by `PermissionGate`'s excluded-site
disclosure, which keeps pending, retry and visible error feedback together.
The security-surface guard checks that owner; `SettingsTab` continues to own
the usage-policy and host-permission action status.

- `npm run check:release-v1:baseline`
- `npm run check:security:surface`
- `npm run check:storage:architecture-boundaries`
- focused Settings security, permission, data-lifecycle, section module-record,
  section intent, and local retry tests

Any post-public contract or permission-model change requires a separate
architecture decision. Release V1 keeps no dormant migration or broad-host
compatibility path.
