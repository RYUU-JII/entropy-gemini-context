# Settings Command Boundary Map

- Status: Active
- Owner: repository architecture, platform storage, dashboard app, background app
- Last validated against code: 2026-10-14
- Path policy: current-only
- Canonical for: release V1 settings command/query ownership, commit acknowledgement, cache hydration, and propagation

## Release V1 Rules

Settings Protection edits reminder scopes through the named
`setGoalEndEnabled(scope, enabled)` protocol command. Its tagged `nudgeConfig`
operation is resolved inside serialized preparation against the latest config,
then returns the full canonical config in `committedItems`. This preserves a
concurrent sibling scope change and internal presage/episode values. Stored
`enabled` is retired; `goalEnds: { site, global }` is the only persisted activation
policy. Tools exposes status/navigation and temporary pause, not another config
writer. Cooling preset commands retain the same acknowledged/reconciled path.

Protected-site registration capacity is admitted by the progression owner. Before
any persisted canonical patch adds a domain to `blockedUrls`, SettingsService's
serialized mutation lane awaits its bound `assertSiteRegistrationAdmission`
capability against the latest committed and resulting domain lists. This covers
popup, site-rule commands, generic patches and batches without a second UI gate.
Paused protection still occupies its registered place. Allow-list additions,
existing edits and removal remain available. Day-five unlimited registration is
independent of the five represented pond sites. Existing beta registrations are
preserved through the explicit progression continuity floor; see
[Progression Policy](../progression/progression-policy.md).

The same serialized lane binds `setSiteRegistrationCommitObserver` to the
progression owner's `observeProtectedSiteRegistration`. After persistence and
canonical cache publication, it observes the committed protected-site count
before any later removal can enter the lane. The first-registration and
five-registered-sites milestones therefore survive deletion without treating a
requested patch as evidence. Bootstrap reconciles existing committed membership
through this same observer after disclosure initialization. A failed observer is
an explicit `registration_journey` post-commit failure; the already saved rule
keeps its canonical commit acknowledgement. A later successful observation or
bootstrap retries from current committed membership. No second settings store or
dashboard-local completion flag owns this state.

Setup and Settings compose recording intent through `localUsagePolicy.js` into
the existing protocol keys. `dataCollectionMode=off` closes history admission
without erasing the selected `precisionInsightsMode` / `precisionInsightsSignals`.
The front door commits the matching `insightsConsent` and `insightsMode` in the
same acknowledged patch. There is no additional persisted profile or analysis
switch. Browser permission denial must occur before committing an expanded
recording policy; existing selected scope is never silently widened.

Site-rule registration, redundant registration, protection/allow-list moves,
and Popup protection commits preserve `trackingExcludedUrls`. Protection and
recording exclusion are independent intents. Dashboard Sites and Settings use
the protocol store's `setSiteRecordingExcluded({ domain, excluded })` command;
feature controllers do not reconstruct the exclusion list. The existing typed
list setter and command bus remain its only write/ACK path. A repeated intent
that is still pending or failed requires another acknowledged command; equality
with desired pending state is not evidence of persistence. A value already
acknowledged without pending work remains a no-write no-op. Exclusion removal
does not alter the global collection mode, consent, or protection lists.
The global-cap setter follows the same acknowledged-intent rule: retrying an
unchanged failed/pending draft joins the canonical command lane; desired-state
equality cannot close its editor as though the value had been persisted.
The same rule applies to configuration and preference setters. A no-write no-op
requires equality with committed state and no unsettled or failed intent for
that key. A complete recording selection submits all five policy keys together,
including unchanged fields required by its acknowledgement contract.

Site-goal updates return `appliedMinutes` projected from the complete canonical
`siteGoals` map in the owner acknowledgement. An absent domain means no local
cap; a missing/malformed map or invalid value is an explicit failure. The Sites
editor retains the canonical preview policy, but settles from this acknowledged
value rather than its submitted draft. This projection stays in the protocol
site-rule command owner and does not expose a second policy calculator to UI.

- settings accept only registered current keys and exact current value shapes.
- missing known keys may use their documented initialization defaults.
- unknown, retired, malformed, or wrong-contract values fail loudly.
- cache hydration reads current documents only; it does not mutate storage.
- requested patches are not commit evidence. Callers advance state only from
  validated canonical `committedItems` that cover every pending key.
- no settings migration helper, alias decoder, cleanup write, or read-through
  exists in active runtime.

Security mutations are authorized by `settingsSecurityMutationPolicy.js` inside
the `SettingsService` serialized persistence lane. For security-key patches the
owner reads the latest typed security settings directly through the existing
settings persistence capability; security hashes are not added to the broad
runtime cache. Replacing/removing an existing passcode, disabling an enabled
reset guard, or disabling lock settings requires transient current-passcode
proof. The resulting hash must satisfy the canonical V1 contract, and enabled
lock settings require both a configured passcode and an enabled reset guard.
These checks also apply to synchronous owner mutations and reject before writes.

The Dashboard security client submits proof-bearing patches as isolated channel
commands with the current profile generation and complete commit ACK. Proof is
runtime request metadata only: it is never a settings key, pending patch, sync
receipt, log field, or a retried/coalesced generic command. The passcode dialogs
collect current proof for weakening policy; failed authorization leaves the
dialog open. Unauthenticated first setup and strengthening retain the existing
generic command path. A harmless repeat of already committed values needs no
fresh proof after a lost ACK. Full data reset with reset guard disabled retains
its explicit unprotected-reset semantics; secret snapshot import/export has its
own current-passcode rule in the destructive-action owner.
- retired `debugConfig` predecessor fields fail current-shape normalization;
  bootstrap never inspects, rewrites, or uses them to recover stats state.

## Completion receipts (2026-09-16)

Dashboard `buildProtocolSyncResult` and site registration return the background
`propagation` receipt unchanged alongside commit version and applied stages.
`kind: added` means the rule was saved; it does not assert receiver readiness or
effect application. The existing settings feedback owner interprets queued,
failed, timed-out and succeeded propagation. Feature commands do not retry or
recompute these outcomes. The managed-script stage succeeds only after validating
the orchestrator's complete injection summary; startup's sync-only task obeys
the same rule. Partial catch-up remains in the existing checkpoint/retry owner.

Read-only WAIT completion applies the same key-coverage and commit-freshness
rules as an immediate completion receipt. A covering succeeded outcome clears
earlier application failures in the channel without replaying a saved command;
unrelated or older receipts retain those failures. This read-only settlement
does not clear failed saves, including a newer failed intent for the same key.

## Owner Table

Development-only task fault verification is owned by the named
`@settings-propagation-qa-fixture` build seam at the background propagation
composition. Its public projection returns the original broadcast port. Its
development projection may hold or fail one actual broadcast task under an
explicit disposable QA lease. The coordinator, persistence, commit ACK, task
WAIT, retry budget and profile-generation fences remain authoritative. This
does not supply a substitute response, settings mirror or recovery path. The
[QA control plane](../../operations/qa/entropy-qa-control-plane.md) owns exact
copied-helper admission, sender/document binding, lease lifetime and evidence.
The fixture's requested `filterSettings` root includes only declared canonical
feature-change metadata from persistence; it retains the actual task key list
and never substitutes the requested root for the task receipt.

| Concern | Owner | Key seam | Output |
| --- | --- | --- | --- |
| user/domain intent | typed dashboard/domain command | owner-specific command service | canonical intent result |
| command/key/ACK metadata | settings domain | `settingsCommandContract.js` plus the narrow `settingsDashboardCommandContract.js` projection | physical key, owner action, channel, delivery, sender, redaction, and ACK field contracts |
| transport | `settingsTransport` + settings acknowledgement contract | one reliable runtime command/query boundary driven by command metadata | validated owner response |
| serialized mutation | `SettingsService.commitSettingsMutation` | one mutation lane | canonical commit result |
| committed registration observation | `SettingsService` → progression owner | `setSiteRegistrationCommitObserver` → `observeProtectedSiteRegistration` | durable journey milestones after committed membership, before the next serialized mutation |
| canonical key validation | settings domain command contract | `canonicalizeSettingsCommandItems` | independently validated/canonicalized key patch |
| cross-key canonicalization | `settingsCanonicalPatch.js` | `prepareCanonicalSettingsItems` | reconciled exact persisted patch |
| Enso consumption interval | settings config domain | `ensoIntervalPolicy.js`, `normalizeFilterSettings` | exact `ensoGate: { isActive, value: frequent \| standard \| spacious }`; 8/12/20 minutes, default standard |
| persistence | platform settings capability + `SettingsStore` | namespaced local documents | physical changed keys |
| commit acknowledgement | settings acknowledgement contract | complete `committedItems` | semantic commit truth |
| Dashboard profile-generation admission | `useDashboardProfileMutationLifecycle` + `settingsCommandBus` | one page-lifetime generation bind and terminal quiesce | exact generation-stamped `SET_SETTINGS` batch |
| background generation fence | `BackgroundMessageRouter` + `ProfileMutationRuntimeGate` | trusted Dashboard `SET_SETTINGS` admission | exact current-generation lease or named rejection before persistence |
| cache hydration | `settingsCacheState.js` | current-document apply | trusted in-memory cache |
| Dashboard committed/effective projection | typed stores + `protocolStoreCommands` | canonical reads update store; ACK triggers a scoped read; bus intent and narrow reconciling receipts project local intent only | external reads never promote pending intent; a read admitted before a newer ACK cannot overwrite that key |
| Dashboard command completion | `settingsCommandBus` + `settingsSyncState` | command-ID operation records projected into channel state | concurrent generic/owner commands retain independent pending and failure receipts |
| explicit propagation recovery | Dashboard command bus → `SettingsPropagationCommandService` → background propagation owner | `RETRY_SETTINGS_PROPAGATION` with exact generation and acknowledged keys | apply current owner snapshot without replaying saved values; retain failure until a covering succeeded receipt |
| read-only propagation settlement | Dashboard command bus → `SettingsPropagationCommandService` → `SettingsService.waitForSettingsPropagationTask` → Coordinator `waitForTask` | `WAIT_SETTINGS_PROPAGATION` with original task ID, volatile owner epoch, commit version, key coverage and Dashboard profile generation | bounded observation of the same executor; no persistence or effect replay |
| continuous domain-usage admission | `SettingsService` + `settingsCollectionAdmission.js` | `getCollectionAdmission()`; consent/scope fencing before persistence await, uncertainty and hydration invalidation | worker-local enabled/since/revision proof for the descriptive consumption model; no new persisted setting |
| propagation | `BackgroundSettingsPropagationCoordinator` | `runtime.settings_propagation` checkpoint plus `reconcileStartupContentScripts` | per-stage checkpointed effect result and fresh-service catch-up |
| pending Detour policy revalidation | `backgroundKernelSettingsPropagationBindings` → `GateInterstitialController.refreshDetourSessions` | `runtime_adapters` after canonical cache refresh | immediate exact-session inventory revalidation, including hidden Gate pages, before optional native grouping |
| propagation continuation authority | coordinator → `settingsPropagationContext.js` → managed content / dispatcher | worker-local execution AbortSignal; durable unfinished-stage handoff to the latest task | superseded continuations stop; earlier waiters receive the covering task outcome |
| external snapshot/reset mutation | `SettingsService.runExclusiveExternalSettingsMutation` | same mutation lane | mutation result + full reconcile receipt |
| cycle reset policy | tracking cycle reset-policy settings owner | `monitor_cycleSettings` through the same mutation lane | exact committed policy record |

The runtime adapter refreshes pending Detour sessions once per task containing
`gateConfig`, `artifactControlState`, `blockedUrls`, `allowedUrls`, `filteringMode`
or `relaxationSchedule`. This uses the existing Gate controller's fresh inventory,
current eligibility and exact-URL handoff; it does not wait for the Gate document's
next query or require `tabGroups` permission. The same refresh is absent from the
later protection broadcast stage. It runs before optional native grouping, so a
group permission refusal or native projection failure cannot prevent this Gate
revalidation. Thrown Gate-owner failures use the existing runtime-adapter stage
checkpoint and propagation failure receipt; no substitute success or new retry
owner is introduced. External policy release adds no decision, tutorial receipt
or approval pass.

The document persistence seam is `SettingsDocumentRepository.commitItems` through
the existing `SettingsStore` FIFO. Its `{ changedKeys, previousItems }` receipt
contains the physical changes and prior values from that mutation's single read,
after storage ACK. The capability owns semantic bootstrap-host metadata and keeps
its array result; it no longer performs a preliminary settings-document read.
Key-material preflight remains before document mutation, and caches advance after
all required writes. The receipt is memory-only and never a settings mirror or
transport acknowledgement. Missing physical documents may bootstrap, while
present null/malformed documents reject before mutation.

The propagation context is not persisted and does not contain a settings mirror.
Task/commit/execution diagnostics join the existing document/attempt, envelope
trace/revision and exact cleanup ACK. Completion stays separate from persistence;
see `docs/domains/protection/protection-settings-propagation-policy.md` for the
supersession, checkpoint-failure and already-issued-operation contracts.

### Preset hydration contract

Preset hydration and physical value validation use
`src/domains/protection/catalog/presetContract.js` for IDs, defaults, assignments
and custom definitions. Its builtin ID constants also identify the seeds in
`presetCatalog.js`, which owns builtin materialization, selection and editor
operations. Initial protocol/settings/boot/stat projections never import that
catalog. The split preserves canonical stored shapes and physical rejection;
it adds no settings owner, runtime cache, read repair or alternative catalog.

### Enso interval contract

Enso remains one `filterSettings.ensoGate` concept. Tools' Veil controller owns
ON/OFF and the three interval choices; OFF preserves the selected interval.
There is no separate Horizon preference, model intensity slider, per-site
interval map, permission request, or Insights consent expansion. Existing
protocol command validation, complete ACK and protection propagation apply.

Reads and writes accept the exact current preset shape only. Hydration never
rewrites an earlier boolean value or repairs malformed settings. Pre-baseline
development data uses the explicit profile reset runbook; no read-time migration
or automatic transition remains in the settings persistence owner.

`EnvelopeAdapter` resolves the selected preset once into `ensoGate.value.intervalMs`
and the Feed Horizon controller's `intervalMs`. Routine policy and Furin strength
modifiers cannot replace this user interval or turn an OFF Enso on. The interval
is a consumption target; waiting for a safe content boundary or another active
intervention may delay actual presentation. It is not an exact wall-clock alarm.
`ProtectionRegistry` validates the exact compiled `{ intervalMs }` value and
projects it into `InteractionManager.applyEnsoGate(true, config)`; a compiled
object must never be mistaken for that API's boolean activation argument.

## Command Inventory

Consumption memory uses positive continuous consent proof from the existing
SettingsService cache-apply boundary. OFF/ON invalidates the proof even when no
Tracking tick sees OFF. Collection/protection-scope writes suspend admission and
advance proof revision and settings observation version before awaiting storage.
An acknowledged scope-only write resumes the original continuous-consent start;
failed writes, failed hydration, or a changed scope discovered by hydration
invalidate it. The next successful hydration begins new proof. The settings
version is a monotonic observation generation, not a successful-commit count.
It fences model tokens and browser-audible continuity anchors. Ordinary
unchanged apply/refresh preserves proof. First hydration after
worker recreation begins new proof without rewriting settings or deleting model
history. Uncommitted intervals before that proof remain unknown. The detailed
join, failure-isolation and restart contract is owned by
`docs/architecture/runtime/consumption-memory-runtime.md`.

The settings domain contract directory is the canonical inventory.
`settingsCommandContract.js` owns physical key and runtime owner-action facts;
`settingsDashboardCommandContract.js` derives Dashboard channel key sets and
retry/ACK policy from those key facts. The tables below are the human-readable
projection of those contracts.

### Dashboard channels

| Channel | Generic patch keys | ACK requirement | Delivery/profile | Security |
| --- | --- | --- | --- | --- |
| `protocol` | `relaxationSchedule`, `gateConfig`, `filteringMode`, `filterSettings`, `artifactControlState`, `rulesMode`, `globalGoal`, `globalCapNotifyOnExceeded`, `coolingCurve`, `insightsMode`, `insightsConsent`, `dataCollectionMode`, `precisionInsightsMode`, `precisionInsightsSignals`, `permissionMode`, `historyCleanupForBlocked`, `concealBlockedBookmarks`, `indicatorConfig`, `debugConfig`, `nudgeConfig`, `notificationsConfig`, `solar_location_profile`, `trackingExcludedUrls` | `committedItems` must cover every submitted/pending key | command bus: at most 3 exponential-backoff retries; transport retry disabled; exact Dashboard generation | privileged extension settings flow |
| `preference` | `app-theme`, `app_language`, `sidebarDisplayMode`, `zen_render_preset` | same complete canonical ACK | same batching/retry/generation contract | privileged extension settings flow |
| `security` | `masterPasscodeHash`, `requirePasscodeForReset`, `highSecurityMode` | same complete canonical ACK; submitted value may be returned only in privileged write ACK | same batching/retry/generation contract | reads are redacted; value types are strict |
| `clse` | `clse_enabled`, `clse_sensitivity_scale`, `clse_alert_cooldown_ms` | same complete canonical ACK | same batching/retry/generation contract | CLSE control snapshot validation |

The protocol channel also recognizes `blockedUrls`, `allowedUrls`, `siteGoals`,
`siteGoalMeta`, `siteRuleTimeline`, `protectionPresetCatalog`, and
`protectionPresetAssignments` as canonical ACK keys, but excludes them from the
generic patch set because their named owners calculate cross-key mutations.

### Runtime commands

Owner ACK coverage treats validated `bootstrapHostChange:<setting>:<domains>`
entries as invalidation metadata, not stored settings. The named physical key
must still occur in `changedKeys` and be present in `items`. The shared bootstrap
metadata parser rejects malformed payloads; unknown change keys are not exempted.
Metadata remains in the response for propagation consumers. This distinction
prevents successful site-rule commits from being reported as `SETTINGS_COMMIT_ACK_INVALID`.

| Command/family | Canonical keys | ACK requirement | Retry/profile | Sender/security |
| --- | --- | --- | --- | --- |
| `SET_SETTINGS` | all registered physical settings keys; generic authorization rejects owner-only keys | `committedItems`; Dashboard separately requires complete submitted/pending-key coverage | runtime default 0 retries; optional exact client generation | trusted extension sender; sensitive read redaction and privileged write ACK policy |
| `RETRY_SETTINGS_PROPAGATION` | acknowledged effect keys, no setting values | version, changed keys and strict propagation receipt | bounded explicit application attempt; exact Dashboard generation | extension page only; current owner snapshot applied without persistence replay |
| `UPSERT_SITE_RULE`, `REMOVE_SITE_RULE` | `blockedUrls`, `allowedUrls`, `siteRuleTimeline`, `siteGoals`, `siteGoalMeta`, `protectionPresetAssignments`; UPSERT may include the five first-use policy keys | strict `items`, ordered normalized `changedKeys`, version/applied receipt, and exact action fields | runtime default 0 retries; background gate plus Dashboard settlement | extension page only |
| `COMPLETE_FIRST_USE` | `dataCollectionMode`, `precisionInsightsMode`, `precisionInsightsSignals`, `insightsMode`, `insightsConsent` | all five canonical items, ordered `changedKeys`, version/applied receipt | conditional UNSET check inside the existing serialized settings mutation; OFF only | extension page only |
| `UPDATE_SITE_RULE` | `siteGoals`, `siteGoalMeta`, `protectionPresetAssignments` | same strict owner ACK plus `domain` | same | extension page only |
| `CREATE_PROTECTION_PRESET`, `UPDATE_PROTECTION_PRESET` | `protectionPresetCatalog` | same strict owner ACK plus matching `presetId`/`preset` | same | extension page only |
| `DELETE_PROTECTION_PRESET` | `protectionPresetCatalog`, `protectionPresetAssignments` | same strict owner ACK plus boolean deletion result | same | extension page only |
| `ASSIGN_GLOBAL_PROTECTION_PRESET` | `protectionPresetAssignments` | same strict owner ACK plus matching assigned preset ID | same | extension page only |
| content nudge `SET_SETTINGS` | `indicatorConfig`, `isAnchorUnlocked` | canonical `committedItems` from the same runtime command | single best-effort attempt; background generation gate only | trusted extension tab, key allowlist |
| cycle reset-policy owner | `monitor_cycleSettings` | exact committed record before runtime revision advances | serialized SettingsService lane/profile fence | named background owner; generic write forbidden |

First-use intent is evaluated by `siteRuleCommandService` against the latest
snapshot inside `SettingsService.commitSettingsMutation`. `firstUseRecording`
accepts only a boolean on a protected rule with a null goal; it composes the
five-key patch through `firstUsePolicy` and rejects non-UNSET consent. No new
persisted mode or storage owner is added. Its optional typed action receipt
`firstUseResult` is required by the Dashboard first-use client and distinguishes
`registered` from `already_protected` before reconciliation. Normal upserts keep
their existing receipt contract. Exact existing protection acknowledges policy
without adding a domain; non-exact covered redundancy is explicitly rejected.
Browse uses `COMPLETE_FIRST_USE` in the same serial lane and can commit OFF only.

`changedKeys` is semantic effect-routing metadata, not the list of physical
storage keys. Generic `SET_SETTINGS` therefore does not require each semantic
effect key to appear in `committedItems`; the Dashboard instead validates every
physical submitted/pending key. Owner commands declare complete
`changedKeys`-to-`items` coverage because their semantic keys are also the
canonical owner projection consumed by the Dashboard.

## Transport Routing

- extension-origin settings reads may call the platform persistence capability
  owned by `settingsTransport`.
- non-extension documents cannot read that capability directly. They must use
  the runtime `GET_SETTINGS` relay and accept only its validated response.
- a missing runtime, relay delivery failure, explicit error response, or
  malformed response rejects with `SETTINGS_READ_RELAY_REJECTED`. None of these
  conditions may fall through to a direct scoped persistence read.

## Command Flow

```text
typed UI/domain intent
  -> owner command service
  -> settingsCommandBus bound to exact Dashboard profile generation
  -> settingsTransport with expectedProfileGeneration
  -> BackgroundMessageRouter captured-generation equality check
  -> SettingsService mutation lane
  -> prepareCanonicalSettingsItems
  -> SettingsStore serialized write
  <- canonical committedItems + semantic changedKeys
  -> BackgroundSettingsPropagationCoordinator
  -> runtime.settings_propagation checkpoint + per-stage progress + ordered effects
  -> fresh service-init open-tab catch-up through the same executor
```

Cross-key site-rule, preset, decision-history, and security-artifact actions use
their named owners. Generic `SET_SETTINGS` cannot claim those invariants.
The site-rule and protection-preset transport shares one reliable command
runner, while the domain registry declares each action's exact acknowledgement
fields. A successful
response must supply its own canonical action fields, `items`, `changedKeys`,
`version`, and complete `applied` receipt. The transport never reconstructs a
missing `domain`, rule `type`, preset identity, deletion result, or assignment
result from the request payload.

Protection registration admission is a pre-persistence rejection. The owning
`progression/contracts/siteRegistrationRejection.js` validates the public failure
response `{ success: false, error: 'PROGRESSION_SITE_REGISTRATION_LIMIT_REACHED',
siteRegistrationBudget: { mode: 'limited', limit }, qualifiedUseDayCount,
nextIncreaseDay }`. The settings handler and transport retain these owner details;
the Dashboard bus keeps them on the failed operation, and Sites, invitation
registration, confirmed whitelist-to-protection moves, and Popup render the
current capacity and actual next qualified use day. They do not derive calendar
dates or present this expected policy boundary as a generic save failure.
Malformed matching details reject with `SITE_REGISTRATION_REJECTION_INVALID`.

The registration budget counts `blockedUrls`, regardless of global/family
artifact pause or feature OFF settings. Those operations retain protection
registration and its place. A confirmed move to `allowedUrls` is a whitelist
conversion that removes protection metadata; explicit removal unregisters the
site. Standalone whitelist rules do not consume the protection budget. The Home
pond's broader managed-site candidate union is a presentation input, not the
registration admission owner.

Cycle reset-hour, recommendation accept/dismiss, pending-boundary apply, and
adaptive-policy updates use the tracking domain's named reset-policy owner.
`monitor_cycleSettings` is owner-only, its physical V1 record is validated by
`settingsCanonicalPatch.js`, and in-memory policy revision advances only from the
validated `committedItems.monitor_cycleSettings`. Runtime activity checkpoints are
not part of that settings commit.
Full app reset clears settings inside `runExclusiveExternalSettingsMutation`, then
bootstraps the cycle policy only after that external lane has drained; nesting a
normal cycle policy commit inside the external lane would self-wait on the same
settings mutation tail.

The Dashboard settings bus is one-generation-only. Admission binds it to the
exact lifecycle generation before `DashboardRuntime` mounts. A profile fence or
runtime handoff synchronously quiesces the bus, clears its retry timer, rejects
queued/in-flight command promises with
`SETTINGS_COMMAND_BUS_PROFILE_MUTATION_QUIESCED`, and never reopens that module
lifetime. Generic React/StrictMode cleanup releases the page lease but does not
terminally quiesce the bus, so a same-generation development remount may reuse
the binding. Every dispatched batch retains its captured generation across
bounded transport retries. The background compares that stamp with the shared
runtime gate's captured generation; a missed lifecycle event therefore cannot
replay an old Dashboard patch into the next profile generation.

Dashboard patch and owner-command transports request a bounded propagation
outcome. The save ACK remains `committedItems`; a `failed`, `timed_out`, or
`schedule_failed` propagation receipt advances the acknowledged version/keys without
leaving the command dirty. Only an operation whose submitted keys intersect both
the allowed runtime effect keys and the receipt's actual `changedKeys` exposes
application state. `failed` and `schedule_failed` expose `apply_error`.
`timed_out` is a live task with an expired observer wait, not application failure:
the bus keeps `applying` and joins the same owner/task through bounded read-only
`WAIT_SETTINGS_PROPAGATION` requests until a terminal outcome. A worker owner-epoch
change or transport/receipt rejection retains the saved ACK and exposes an explicit
completion-observation error; it cannot acknowledge a different worker's task.
Storage-only preference/security
operations and unchanged effect operations stay saved when another command in
the batch fails application. Missing receipt key coverage rejects explicitly.
Each command keeps its own completion record; an unrelated successful
save cannot erase that record or acknowledge another pending command. The
Dashboard feedback owner presents unresolved save/application recovery inline in
the Settings workspace for all channels and the Tools/Sites workspaces for the protocol
channel, with an explicit application retry action. `SettingsCommandFeedbackBridge`
subscribes only to its declared channels; Tools does not surface unrelated
preference/security failures. Sites passes `includeSaveFailures={false}` because
its address/cap/release/recording owners present save failures beside their task
or in the existing workspace feedback region. The bridge still retains and shows
Sites application-busy/application-failed receipts and the same propagation-only
retry; suppression never removes a bus operation. All mounts use the same bus operation receipts
and render in normal workspace layout. Settings command
outcomes never enqueue global toasts or floating panels. Pending tasks show busy
state without failure copy or an enabled retry. Actual control failures remain
visible in their local Sites/Artifacts/Settings surfaces. A covering terminal
success removes its recovery state, including a continuation that completed after
the initial command wait. `retrySettingsPropagation(channel, commandId)` joins the named
background recovery command using the originating operation's affected runtime
keys from its acknowledged keys and captured
profile generation. It never resubmits the earlier settings patch. A storage
no-op ACK without a succeeded propagation receipt cannot clear an application
failure. The background remains the only propagation/checkpoint retry owner.
Versions are worker-local observation counters. A succeeded response to an
explicit retry resolves that exact originating operation even after worker
recreation; unrelated ACKs or a storage no-op cannot do so. Earlier failures
remain visible when an ordinary later receipt cannot prove actual propagated
key coverage and sufficient `commitVersion` freshness. Recovery
visibility follows the command and read-only continuation lifetime, rather than
the number of stage diagnostics. Profile quiescence or a covering newer command
ends the old continuation's authority before any late outcome can update UI.

The protocol and preference Zustand state advances through current canonical
read snapshots. Every save ACK triggers one scoped query of the affected keys;
the original commit/propagation receipt stays intact, while its older values
cannot overwrite a newer committed snapshot. Reads carry local key observation
revisions and drain requests arriving during the read, without using a permanent
worker-local version floor. A quiesced Dashboard rejects read application.

Protocol storage invalidations for keys covered by an unacknowledged local
command retain only their key names until that command settles. Its mandatory
post-ACK canonical query consumes those earlier invalidations; unrelated keys
still read immediately. Invalidations arriving after ACK continue through the
existing read drain. A pre-ACK failure drains deferred keys once no other
unacknowledged command covers them, so external edits are not lost. This
transient invalidation bookkeeping neither queues commands nor supplies values.

The bus remains the only admission-to-ACK queue and pending-intent owner.
`getEffectiveProtocolState` also projects immutable reconciling intent receipts
only between ACK and canonical query completion, so an undo during that gap is
submitted. Latest locally acknowledged intent sequences suppress superseded
document keys or sparse filter fields without discarding unrelated fields.
These receipts never update committed state and are removed when reconciliation
settles. Read failure preserves known state and reports
`SETTINGS_COMMITTED_RECONCILIATION_FAILED`, `committed: true`, the original ACK,
and a failed `reconciliation` receipt through existing control error paths.
The key-scoped failure ledger and exposed `reconcileErrorKeys` prevent an unchanged
retry from silently skipping the required query. Only a successful current read
of that key clears its failure. Unrelated key reads preserve the diagnostic.
Each canonical read publishes its value patch and current reconciliation-error
ledger in one store update. Unchanged values/status retain snapshot identity and
do not notify subscribers, while the mandatory query still runs. Consumers
therefore cannot observe a newly read value paired with a superseded read error.
A failed sparse filter intent retains only uncertain field names; retry explicitly
submits the requested values for those fields, without copying a stale full
snapshot or using the ACK as a read-failure fallback. No receipt is a second
storage source.

`filterSettings` command input is a sparse feature/field intent owned by
`filterSettingsMutation.js`. Dashboard derives only the changed fields from its
local before/after projection; pending batches compose those fields through the
key's registered `mergePending` policy. SettingsService applies the intent to the
latest cache inside its existing mutation lane, then canonicalizes and persists
the complete filter snapshot. Durable data, subscriptions and `committedItems`
remain complete snapshots. Thus unrelated feature changes from another page are
preserved, including nested social metric options; a whole snapshot submitted
explicitly is still an explicit assignment of all included fields.

Language changes use `usePreferenceStore.setLanguage` and the same generation-
bound command bus. The UI changes i18next from the canonical ACK; a rejected
commit stays a visible command failure. RuntimeLanguageRepository/Store expose
only reads and subscriptions. i18n boot and `languageChanged` projection do not
write settings, so Popup/Dashboard module lifetimes cannot create independent
read-modify-write owners for `settings.ui`.

Content nudge settings writes are deliberately different: the content runtime
does not own the Dashboard profile-generation lease, so `indicatorConfig` and
`isAnchorUnlocked` use one best-effort `SET_SETTINGS` delivery with
`retryCount: 0`. The background shared runtime gate admits and drains that one
delivery. A content-side timer must not replay it after a reset; adding retries
requires a real content generation lease and an explicit boundary revision.

### Read-only propagation settlement

`WAIT_SETTINGS_PROPAGATION` observes the original live Coordinator task through
`SettingsService.waitForSettingsPropagationTask`; it does not enqueue effects or
resubmit saved values. An extension-page request supplies the original `taskId`,
`ownerEpoch`, `commitVersion`, `changedKeys` as `keys`, and the captured Dashboard
profile generation. The background uses the existing 15-second task waiter; the
transport uses 20 seconds. A timeout only ends that observation and leaves the
executor alive. Subsequent observations may return the same owner's terminal
result or a newer covering result, with key coverage and commit freshness
validated before the Dashboard can settle its operation.

The Coordinator's `ownerEpoch` is a volatile UUID added to scheduled and public
outcome receipts, outside the persisted checkpoint shape. A recreated owner
rejects an earlier receipt with `SETTINGS_PROPAGATION_OWNER_CHANGED` before
interpreting its worker-local task ID. Profile quiescence, transport loss and
malformed receipts are explicit observation failures; none proves successful
application or authorizes settings replay. The existing explicit retry remains
the effect recovery owner after an actual failure.

## Cache Contract

Dashboard external settings subscriptions diff canonical document fields and
intersect changed keys with that store's canonical read keys. Overlapping events
batch those keys into the next read, with protocol pre-ACK invalidations coalesced
as described above. CLSE-only and cycle-only changes do not
reread the protocol snapshot; a protocol read applies the canonical patch before
overlaying still-pending sparse filter intent.

Development-only `[SETTINGS_FLOW][timing]` console observations measure settings
boundaries through `platform/diagnostics/settingsFlowTiming.js`; detailed phases
also expose permission, projection and subscriber publication costs with epoch
starts for cross-context attribution. They measure wall time rather than CPU,
including persistence, requested propagation settlement, canonical reads and
ACK reconciliation separately. They contain durations, key names and volatile
receipt identifiers, never setting values or persisted diagnostic state. The
propagation wait retains its terminal-outcome validation and the mandatory
post-ACK query remains part of registration success.

`SettingsService.refreshSettingsCache()` reads canonical documents and delegates
application to `settingsCacheState.js`. Hydration:

- performs no storage write,
- does not interpret predecessor keys,
- requires exact `dataCollectionMode` and current schedule/rules shapes,
- marks the cache untrusted after persistence failure and rehydrates before the
  next mutation.

Domain-rule persistence computes the private HMAC/hash artifacts. Before a
persisted domain mutation is acknowledged, `SettingsService` reads its HMAC
secret and the affected blocked/allowed/goal hash fields through the same typed
persistence capability, inside the serialized mutation lane. It validates and
applies the public rule patch and computed private fields together in one cache
update. The write ACK retains only the public committed patch; no private hash
or HMAC material is added to it. This also applies to a no-op rule write whose
persistence owner has still evaluated its computed artifacts.

If that canonical readback fails after storage committed, the cache stays at
its prior consistent snapshot and becomes untrusted. The public committed ACK
is preserved with a `schedule_failed` propagation receipt (`taskId: null`,
`cache_readback` failure). No effects are scheduled from the stale snapshot.
The failed branch still invalidates the boot prewarm snapshot and its in-flight
publication; an invalidation error is added to the same failure receipt without
discarding the durable ACK.
Existing explicit propagation retry hydrates canonical storage before applying
the current effects. Production `ProtectionRuntimeInputProvider` must join
`SettingsService.ensureSettingsCache()` even when it receives the stable cache
object; that object does not bypass the mutation/hydration admission barrier.
Cache-only injected test owners retain their existing isolated fixture contract.

## Failure Policy

| Condition | Result |
| --- | --- |
| unknown settings key | reject |
| malformed existing canonical value | reject with typed settings error |
| partial/malformed commit acknowledgement | reject; pending keys remain dirty |
| owner-command response with a missing or malformed action result field | reject with `SETTINGS_COMMIT_ACK_INVALID`; do not reconstruct from request intent |
| persistence rejection | reject and mark cache untrusted |
| non-extension settings relay unavailable or rejected | reject; do not read persistence directly |
| propagation failure after durable commit | preserve save success, retain the visible retry checkpoint, return the canonical propagation receipt, and show Dashboard `apply_error`; do not pretend rollback or leave the commit dirty |
| synchronous `SETTINGS_CHANGED` reconcile failure | reject with a stable error code and preserve the canonical structured failure receipt across message and QA evidence boundaries |
| Dashboard settings batch from an old profile generation | reject before settings-owner dispatch with `PROFILE_MUTATION_RUNTIME_ADMISSION_GENERATION_CHANGED` |
| missing Dashboard generation stamp | reject before persistence with `PROFILE_MUTATION_RUNTIME_CLIENT_GENERATION_REQUIRED` |
| profile mutation while a Dashboard retry is queued | terminally cancel the old bus; no resume/rebind fallback in that page lifetime |
| previous key or value shape | reject; use the developer profile reset for pre-baseline data |

## Guardrails

- `npm run check:release-v1:baseline`
- `npm run check:storage:architecture-boundaries`
- `npm run check:dashboard:owner-architecture`
- dashboard owner and settings synchronization tests

## Adding A Settings Command

`tabManagement` is a protocol-channel physical key in `settings.core`. Its exact
current shape is `{ groupProtectedTabs: boolean }`; absence initializes OFF and
malformed presence fails. The dashboard uses typed `setTabManagement` through
the same command bus, complete committed ACK, canonical rehydration and runtime
adapter stages. Direct hydration and the boot prewarm DTO carry the same value.
It affects background native-tab presentation only, so it refreshes the settings
cache/runtime adapter without content protection broadcast or bootstrap plan
invalidation. Optional `tabGroups` permission is requested in the initiating
Barrier gesture before committing an enabled value. Gate config retains its
independent intervention policy and is never widened to store grouping state.

1. Register the physical key, channel/owner, validation, redaction, and delivery
   facts in `settingsCommandContract.js`.
2. For a new owner action, add one owner command entry with its canonical key
   set, exact ACK fields, and transport method name. Add its executable request
   normalization to the adjacent narrow `settingsCommandRequestBuilders.js`
   seam. Keep the typed public/domain service method; do not expose a generic
   untyped map API.
3. Implement the owner mutation and route handler, then add registry, ACK,
   command-bus, and owner-service tests. Update this Active map and the matching
   CI contract when the public seam or ownership changes.

Do not add a second action/key list in a client, transport, sender policy,
redaction policy, or ACK validator. Those consumers derive their wiring from the
domain registry.

Any post-public settings V2 requires a separate architecture decision. Release
V1 keeps no dormant compatibility framework.
