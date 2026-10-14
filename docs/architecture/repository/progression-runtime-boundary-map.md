# Progression Runtime Boundary Map

- Status: Active
- Owner: background progression service, artifact disclosure coordinator/bootstrap, progression facts provider, progression repository, dashboard presentation conductor
- Last validated against code: 2026-10-13
- Path policy: current-only
- Canonical for: progression storage/command ownership, qualified-use facts, independent artifact/registration/Bonsai policy projections, commit propagation, first-vision and first-bloom milestones, and dev-only session projection/replay
- Companion to:
  - `docs/architecture/progression/progression-engine-contract.md`
  - `docs/architecture/progression/progression-policy.md`
  - `docs/architecture/repository/experiment-debug-boundary-map.md`
  - `docs/architecture/repository/storage-stats-tracking-boundary-map.md`
  - `docs/architecture/themes/zen/zen-main-presentation-scene-architecture.md`

## Purpose

This map audits the progression runtime as a staged-disclosure policy owner.
Progression may consume cheap aggregate facts and may degrade non-critical
general snapshot reads when fact collection fails, but it must not evaluate
from a missing facts owner, mutate first-vision state through broad reset
paths, or let presentation surfaces become progression owners. Artifact
disclosure is a narrower durable policy: successful managed-protection activity
advances a fixed sequence, and dashboard/runtime consumers read the resulting
background-owned snapshot instead of reconstructing it from facts or signals.
The background `ProgressionService` instance is the sole production command and
query owner. Dashboard surfaces hold presentation state only and cross one
typed, trusted message boundary for durable progression work.
At service construction it captures the durable profile generation. Every
normal queued read/write revalidates that generation and open lifecycle
admission; only the quiesced maintenance clear bypasses the normal gate.

The practical reading question is:

```text
Can every production progression decision be traced to durable progression
state plus its explicit command/query owner, with development presentation
projected only by the typed session owner and never mistaken for canonical
progress?
```

## System Flow

Background progression owner:

```text
backgroundKernelCoreServices
  -> ProgressionRepository
  -> statsRuntimeService.getStatsFactsRange()
  -> createProgressionFactsProvider(settingsService, canonical facts query)
  -> createProgressionService(repository, profile lifecycle repository, facts provider)
  -> createArtifactDisclosureCoordinator(progressionService)
  -> createArtifactDisclosureBootstrap(service, settings owner)
  -> background runtime consumers
```

Artifact disclosure activity command:

```text
trackingTabActivitySettlement (successful managed protected visit only)
  -> ArtifactDisclosureCoordinator.recordManagedProtectedVisit(atMs)
  -> shared 04:00 activity-day resolver
  -> ProgressionService.recordSuccessfulManagedProtectionActivityDay(dayKey)
  -> queued persistProgressionState() write owner
  -> progression.state.artifactDisclosure (unbounded raw count + grant provenance)
  -> qualifiedUseFacts
  -> independent artifact / registration / Bonsai policy projections
  -> detached onCommitted({ profileGeneration }) after acknowledged mutation
  -> exact PROGRESSION_STATE_CHANGED invalidation, no copied snapshot
```

Artifact disclosure query:

```text
dashboard Tools / navigation cue
  -> GET_ARTIFACT_DISCLOSURE_SNAPSHOT
  -> trusted background progression message route
  -> generation-admitted ProgressionService.readArtifactDisclosureSnapshot()
  -> canonical disclosure DTO + validated unlockProgress policy composition
  -> optional build:dev session override composition
  -> one effective snapshot for Tools, protection runtime, and Main bonsai
```

Synthetic QA profile provisioning:

```text
explicit e2e:sites:provision-profile command
  + canonical scripts/qa/profile/entropyQaProfileMarker.mjs proof
  -> dev-only trusted entropy-e2e.html route
  -> explicit canonical session mode
  -> canonical First Vision presented/spent commands
  -> ProgressionService.recordSuccessfulManagedProtectionActivityDay()
     for the marker-owned monotonic five-day fixture
  -> ProgressionService.readArtifactDisclosureSnapshot() exact day-5 verification
  -> typed progression debug-session owner validates and removes its session row
  -> fixed unpacked-extension slot is replaced with the public artifact
  -> Chrome Extensions.loadUnpacked updates the same extension id in place
  -> public artifact reads the canonical snapshot only
```

Development progression projection:

```text
build:dev, no session record
  -> implicit full_access mode, effective day 5, First Vision presentation spent

DashboardLayout build:dev HUD (day 0-5 / Replay First Vision / Use live)
  -> trusted dev-only progression debug action
  -> ProgressionService shared operation queue
  -> ProgressionUnlockDebugRepository
  -> chrome.storage.session runtime.progression_unlock_debug
  -> explicit develop / first_vision_preview / canonical mode
  -> effective artifact disclosure and First Vision presentation projection
  -> dashboard artifactDisclosureSnapshotResource commit
  -> acknowledged snapshot commit followed by guidance UI read invalidation
  -> shared JourneyProgress explanation inside the expanded left development HUD
```

The HUD explains the current independent schedules together: day three releases
Barrier; day five currently completes family grants, unlimited registration and
full Bonsai form. The preview maximum is derived from these horizons and cannot
control any consumer's policy. Selection uses effective raw facts, while the
artifact roadmap uses its own capped display. The pressure graph's three completed observation days are a separate
readiness threshold and cannot grant artifacts. The appearance clock changes
lighting only. `JourneyProgressDockContext` selects presentation placement;
it owns no usage count, entitlement, stored state or second policy. Main retains
canonical guidance and the preview explanation in layouts without the dock.

Current-profile initialization:

```text
background tracking bootstrap
  -> ArtifactDisclosureBootstrap.initialize()
  -> ProgressionService.initializeArtifactDisclosure()
  -> strict current disclosure snapshot
  -> current protected-registration milestone reconciliation
```

Dashboard First Vision presentation:

```text
useMainPresentationScene()
  -> Dashboard lifecycle admission acquires one page profile-generation lease
  -> firstVisionProgressionClient consumes that shared lease
  -> trusted background progression message route
  -> ProgressionService.readFirstVisionSnapshot(expected generation)
  -> mainPresentationSessionState commit sequence
  -> recordFirstVisionPresented(expected generation) after ideal commit
     -> require exact `presented` command ACK
  -> recordFirstVisionSpent(expected generation) after covered current commit
     -> require exact `spent` command ACK before uncover/artifact disclosure
     -> bounded retry while the opaque release cover remains held
```

Development First Vision replay:

First Vision petals are projected by `zenMainSceneProjection.petals` into the
single app-wide field. `CeremonyOverlay` retains only radiance, opaque cover and
release-gated playback for this event. This cosmetic supply envelope does not
change current composite readiness, presented/spent commands or their ACKs.
The lab exposes the conductor replay below rather than a second standalone
First Vision animation.

```text
HUD or CeremonyPreviewLab
  -> session-only first_vision_preview mode
  -> reload after the session command ACK
  -> ordinary useMainPresentationScene conductor
  -> projected presented/spent ACKs; no canonical milestone writes
  -> exact-descriptor compare-and-set completion on the service queue
  -> return to develop at that day only while its session selection is current

Focused canonical-progression test only
  -> explicit canonical mode
  -> dev-only DEBUG_RESET_FIRST_VISION_PROGRESSION(expected generation)
  -> ProgressionService.resetFirstVisionForDebug(expected generation)
```

Profile mutation admission:

```text
background profile mutation owner
  -> shared background runtime gate close + in-flight drain
  -> quiesce participants in dependency order: producers before queues/stores
  -> ProgressionService.quiesceForProfileMutation()
  -> close admission synchronously and drain the shared operation queue
  -> clearForProfileMutation({ nowMs }) while quiesced when reset requires it
  -> publish durable `committed`, then durable `complete`
  -> seal the old worker gate as local `reload_pending`
  -> commit the successful control response
  -> chrome.runtime.reload()
  -> only the fresh worker constructs a service bound to the new generation
```

Storage owner:

```text
ProgressionRepository
  -> ProgressionStateStore
  -> chrome.storage.local progression.state
  -> normalizeProgressionState()
```

## Owner Table

First bloom is an explicit user opening, separate from the five-day structural
release and First Vision. The existing `completedMilestoneIds` map stores
`milestone.bonsai.firstBloomOpened: true`; its absence in a valid current
progression document means unopened. No new local key, document field, schema
version, pending flag, or migration is introduced. The strict current map admits
explicit milestone receipts and rejects non-true or malformed entries. Profile reset
clears this receipt with the existing progression document; changing a tree's
identity or revisiting Dashboard does not re-arm it.

`readArtifactDisclosureSnapshot()` projects the same strict receipt
`bonsaiFirstBloomOpened` at the parent and `unlockProgress` boundaries, and the
parent carries actual `canonicalFirstVisionSpent`. The nested
`bonsaiFirstBloom: { eligible, opened, canonicalFirstVisionSpent }` view owns
eligibility. Pure initial snapshots seed unopened/unspent explicitly; canonical
service/evaluator snapshots supply actual state. The DTO validator cross-checks
the receipt, mode, actual First Vision state and Bonsai policy's full-form output.
Missing/nonboolean metadata is rejected. Development projections preserve real
facts and receipts, but eligibility remains false and no receipt is consumed.

Only a direct Home click or keyboard activation may request
`CLAIM_BONSAI_FIRST_BLOOM`. The dashboard presentation owner waits for real boot
release, the foreground current Home view, and its exact ready Bonsai frame;
these are presentation gates, not new progression facts. The dashboard-only
trusted route forwards the captured profile generation to queued
`claimBonsaiFirstBloom()`. At execution the background owner verifies canonical
mode, spent First Vision, and the Bonsai policy's canonical full form. It writes
the milestone once and returns `{ opened: true, newlyOpened: true }` only after
the storage ACK. Simultaneous/repeated claims return `newlyOpened: false` and
must not replay. Failure stays explicit; the UI cannot substitute a local receipt.
The receipt records the approved opening, not completion of an animation: an
interrupted page after consumption does not automatically replay on next boot.

After validating the command receipt and request/response profile generation,
`bonsaiFirstBloomClient.js` supersedes pending resource reads and awaits the named
canonical disclosure refresh, then revalidates the page generation before
presentation. The receipt is never patched into a synthetic snapshot. A query
failure remains explicit even when the receipt was durably consumed; it cannot
fabricate eligibility or automatically replay on the next boot. Resource
publication compares both durable `stateUpdatedAtMs` and session
`developmentProjection.updatedAtMs`, preventing an older canonical response with
the same session descriptor from restoring an unopened receipt.

First dashboard entry records only `milestone.dashboard.firstVisit` after the
real boot shell is dismissed, through the dashboard-only, generation-fenced
`RECORD_DASHBOARD_FIRST_VISIT` command. Its receipt is
`{ firstDashboardVisitRecorded: true }` and grants no registration access.
`siteRegistrationJourneyPolicy.js` owns the shared pure
`site_registration_journey_v1` projection of the existing unlock DTO, required
exact canonical protected-site and allowed-site counts, and progression-owned milestone booleans. The
background `readSiteRegistrationJourney()` composes that same projection for
Popup and queue/commit admission. Dashboard consumers share one hook over the
existing artifact snapshot and canonical settings store; they do not reconstruct
count/day thresholds in Main, Sites or Popup.

The canonical settings mutation lane observes successful protected-list commits
through `observeProtectedSiteRegistration()`, and bootstrap observes the current
canonical list once initialization settles. The first real registration records
`milestone.registration.firstProtectedSiteRegistered`; five concurrently
registered protected sites or five real qualified use days record
`milestone.registration.directUnlocked`. Both survive deleting every site. The
earlier `popupQuickEnabled` milestone is inert and is never read for access.
`readArtifactDisclosureSnapshot()` includes strict
`registrationJourneyMilestones: { firstProtectedSiteRegistered,
directRegistrationUnlocked, admittedInvitationCapacity }`. Development age/full
access changes the effective pure projection only, never the durable completion.
A real committed protected-site count remains canonical even in a debug mode.
Current allowed-only/imported profiles retain Sites management access so their
existing allow rules remain editable. Allowed membership never spends protected
slots, completes the registration journey or grants the protected-first milestone.
No extra persisted flag is needed for this existing management access.

`recordSiteRegistrationInvitationsAdmitted({ capacity, expectedProfileGeneration })`
validates capacity 1–5 against the current effective registration budget. The
limited `milestone.registration.invitationCapacity.1` through `.5` ID set stores
monotonic current-scene roster admission; it is not a viewing or onboarding
completion receipt. Development projections return an ephemeral admission ACK.
Newly eligible slots may enter from the bank once; a fresh Dashboard can compose
already admitted slots as resident without replaying the entry film. Storage,
generation and malformed DTO failures stay explicit. First Vision's state and
12-second dwell contract remain independent.

| Concern | Owner | Key files | Output | Forbidden shortcut |
| --- | --- | --- | --- | --- |
| Durable progression state | typed progression repository | `ProgressionRepository.js`, `ProgressionStateStore.js` | normalized `progression.state` document | direct Chrome storage writes from UI/theme code |
| Qualified-use facts | shared qualification policy, typed facts contract, progression service | `qualifiedUsePolicy.js`, `qualifiedUseFacts.js`, `artifactDisclosureCoordinator.js` | unbounded canonical/effective counts and last canonical activity-day key | using consumer/display horizons to cap raw facts; historical stats windows as entitlement |
| Independent release policies | artifact journey, registration policy and Bonsai contract | `progressionJourneyPolicy.js`, `progressionRegistrationPolicy.js`, `progressionBonsaiRelease.js` | independent threshold lookups, budgets/direct completion and Bonsai stage/full form | one global unlock target; registration completion from represented-koi count; duplicate slot/stage thresholds |
| Artifact disclosure policy/state | progression disclosure policy | `artifactDisclosurePolicy.js`, `progressionArtifactAccessPolicy.js`, `progressionUnlockPolicy.js`, `progressionSnapshot.js` | fixed family order, monotonic disclosure entries/activity-day cursor, latest 180 evidence keys, and one explicit journey-gated/open access owner | planner/signal/UI order becoming business truth, local access bypasses, duplicated access-mode fields, or bounded evidence retention capping qualified use |
| Successful activity write | disclosure coordinator + successful visit settlement | `artifactDisclosureCoordinator.js`, `trackingTabActivitySettlement.js` | one serialized activity-day command after a recorded managed protected visit | counting navigation attempts, unprotected visits, or dashboard opens |
| Current-profile bootstrap | background disclosure bootstrap + progression service | `artifactDisclosureBootstrap.js`, `progressionService.js` | strict snapshot hydration plus canonical protected-registration milestone observation | deriving grants/capacity from old settings or historical calendar evidence |
| Artifact disclosure query | progression service + trusted background route | `progressionService.js`, `progressionMessageRoutes.js` | canonical disclosure snapshot DTO | dashboard importing `ProgressionRepository` or evaluating policy locally |
| Shared unlock projection | progression unlock policy | `progressionUnlockPolicy.js`, `ZenBonsaiUnlockProgression.js` | validated raw facts, capped artifact display, family access, registration budget, effective/canonical Bonsai release and first-bloom view | re-aggregating stats, artifact display as Bonsai age, copied access-mode fields, or local access gates |
| Commit propagation | progression operation queue + typed generation event + Dashboard resource | `progressionService.js`, `progressionStateChanged.js`, `artifactDisclosureSnapshotResource.js` | one detached invalidation per acknowledged changed operation; stale-read fencing and canonical refresh | awaiting a querying observer from the service queue; snapshot-bearing events; UI-only mutation notifications |
| Bonsai growth reveal acknowledgement | Dashboard UI-only presentation state | `bonsaiGrowthRevealState.js`, `BonsaiGrowthReveal.jsx` | last `canonicalBonsaiRelease` age already presented on Main | granting/delaying progression, artifact display as Bonsai age, or debug acknowledgements |
| First-bloom opening receipt | background progression service + trusted Dashboard route + typed progression store | `progressionService.js`, `progressionMessageRoutes.js`, `bonsaiFirstBloomClient.js`, `progressionIds.js` | one generation-fenced explicit opening ACK backed by `milestone.bonsai.firstBloomOpened` | localStorage completion, automatic boot consumption, debug consumption, or using the receipt to change qualified days/weather |
| Development progression projection | progression service + typed session repository + build aliases | `progressionUnlockDebugContract.dev.js`, `ProgressionUnlockDebugRepository.js`, `ProgressionUnlockDebugControl.dev.jsx`, `FirstVisionDevelopmentProjection.dev.js` | default day-5/all-open and spent presentation, explicit day/replay/canonical modes | mutating durable progression state, localStorage, public no-op aliases importing dev owners, or public-build route exposure |
| Synthetic QA progression fixture | dev-only QA route + canonical progression service + E2E profile/artifact-slot owner | `qaProgressionProvisioningMessageRoutes.dev.js`, `provisionSiteQaProfile.mjs`, `qaProfileArtifactSlot.mjs`, `siteRuntimeBrowser.mjs` | marker-proven canonical First Vision spent + exactly five monotonic activity days at provisioning, followed by same-id public verification; later release reuse accepts a larger raw activity-day count only while canonical day remains capped at five, every ordered family is effective, and `veil` is runtime-eligible | raw profile/storage edits, public provisioning routes, uninstall/reinstall assumptions, release-run auto-promotion, or accepting a debug projection/locked family as mature |
| Snapshot evaluation | progression service/evaluator | `progressionService.js`, `progressionEvaluator.js` | phase, budgets, feature access, diagnostics | evaluating snapshots without a facts provider |
| Aggregate observational facts | progression facts provider + canonical stats facts query | `progressionFactsProvider.js`, `statsFactsQueryService.js` | current settings/stats facts; underlying stats-query cache retains its owner revision contract | progression-timestamp cache over settings/stats facts; direct stats repository reads |
| Product policy metadata | experience policy/catalog derived from named release owners | `progressionPolicy.js`, `progressionCatalog.js` | First Vision dwell/experience metadata and derived artifact/site-slot stages | ignored artifact conditions, duplicate release thresholds or widget policy |
| Shared presentation admission | Dashboard presentation owner | `DashboardPresentationAdmission.jsx`, `activePresentationClock.js`, `usePresentationSessionLifetime.js` | one foreground/exclusive/contextual snapshot, admitted dwell and stale-callback fencing | theme widgets as policy owners, duplicate native foreground subscriptions, or a second durable event controller |
| First-vision commands/query | background progression service + trusted route | `progressionService.js`, `progressionMessageRoutes.js`, `firstVisionProgressionClient.js` | generation-bound first-vision snapshot and serialized milestone mutations | Dashboard repository imports, a second service instance, or caller-provided event types |
| First-vision presentation | dashboard presentation conductor | `useMainPresentationScene.js`, `mainPresentationSessionState.js` | boot-scoped renderer commit sequence only | owning durable progression state or nested components writing local completion flags |
| Debug replay | dev session projection + main presentation conductor | `CeremonyPreviewLab.jsx`, `ProgressionUnlockDebugRepository.js`, `FirstVisionDevelopmentProjection.dev.js`, `useMainPresentationScene.js` | normal ceremony over projected First Vision state with no canonical write | durable reset for ordinary replay, broad `reset()`, direct repository access, or a second ceremony implementation |
| Storage maintenance reset | background profile mutation owner + progression participant | `progressionService.js`, background storage maintenance bindings | terminal quiesce, drain, and privileged clear before the worker reload handoff | raw progression clearing while the production owner still admits operations, or rebinding the old service |

## Function Ledger

| Boundary function | Input | Output | Failure / missing-data policy |
| --- | --- | --- | --- |
| `createProgressionService()` | progression repository, profile lifecycle repository, optional facts provider | progression service API | either required repository missing throws |
| `readSnapshot()` | stored state plus explicit facts provider | evaluated or degraded snapshot | missing facts provider throws `PROGRESSION_FACTS_PROVIDER_REQUIRED`; fact read errors become degraded diagnostics |
| `readFirstVisionSnapshot()` | captured document profile generation | strict first-vision state/timestamp DTO plus `effectiveFirstVisionState` from the injected presentation owner | service validates open lifecycle admission and exact current generation at queued execution time |
| `recordFirstVisionPresented()` / `recordFirstVisionSpent()` | captured document profile generation; no caller-owned event type | persisted first-vision DTO | stale generations throw `PROFILE_RESET_GENERATION_STALE`; service owns the clock and exact event |
| `claimBonsaiFirstBloom()` | captured Dashboard profile generation after explicit input and presentation readiness | `{ opened: true, newlyOpened: boolean }` after the shared queued write | canonical day below five or unspent First Vision throws `BONSAI_FIRST_BLOOM_NOT_ELIGIBLE`; debug day projections throw `BONSAI_FIRST_BLOOM_CANONICAL_MODE_REQUIRED`; stale generation, maintenance and storage failures remain explicit |
| `readArtifactDisclosureSnapshot()` | durable progression state plus optional dev session override | fixed ordered/disclosed family DTO with `unlockProgress` | validates owned profile generation, then runs on the shared queue; malformed debug state throws rather than inventing UI defaults |
| `buildProgressionUnlockSnapshot()` | canonical disclosure snapshot plus optional effective debug day | strict `progression_unlock_v3` with raw `qualifiedUseFacts`, artifact display, independent budgets/Bonsai outputs and first-bloom view | no global policy horizon; parent alone owns access mode; missing/contradictory facts fail |
| `requireArtifactDisclosureSnapshot()` | complete parent and nested unlock DTO | validated same DTO | checks entry/map order, access, raw provenance, current/next budgets, independent Bonsai caps and first-bloom facts/receipt |
| `isProgressionBonsaiFirstBloomEligible()` | canonical mode, actual First Vision spent, own Bonsai release and receipt | strict boolean | missing/malformed facts throw; debug, unspent First Vision, immature form or spent receipt cannot open |
| `persistProgressionState()` | current and candidate state inside an admitted operation | acknowledged state with strictly increasing logical `updatedAtMs`, plus operation-local changed mark | sole ordinary repository write call; unchanged state skips writing; no commit signal before storage ACK |
| `onCommitted({ profileGeneration })` | acknowledged changed operation | detached canonical read invalidation | invoked once per operation and never awaited by the queue; observer failure diagnosed; no copied state authority |
| `completeProgressionUnlockDebugReplay()` | captured exact v3 descriptor and Dashboard generation | applied flag plus effective owner snapshot | queued compare-and-set refuses an outdated selection; logical revision orders same-millisecond/clock-regression commands |
| `clearProgressionUnlockDebugSessionForQa()` | trusted dedicated QA request with exact generation and canonical mode | typed session cleanup proof | shared queue admits generation before removal; absence restores default only for the dedicated artifact/provisioning lifecycle, never ordinary Dashboard cache continuity |
| `setProgressionUnlockDebugMode()` / `setProgressionUnlockDebugDay()` / `clearProgressionUnlockDebugOverride()` | build:dev mode plus day 0-5 | effective disclosure snapshot carrying its typed development projection | unavailable outside debug builds; `clear` means explicit canonical mode because an absent record means default full_access/day 5; invalid session contracts fail loudly |
| `QA_PROVISION_CANONICAL_PROGRESSION` | trusted injected QA extension page, current profile generation, exact five-key fixture | canonical day-5 disclosure snapshot, spent First Vision, typed session-cleanup proof | dev artifact only; rejects malformed/non-monotonic keys, count/cursor/family-prefix contradictions, day counts above five, and untrusted senders |
| `prepareLaneArtifactDisclosure()` synthetic release verification | ready schema-v3 marker plus canonical public snapshot and First Vision state | reusable canonical day-5/all-families release admission | raw activity-day provenance may exceed five after later real activity, but canonical/effective day must remain exactly five, First Vision must be spent, the full ordered family set must be effective, and `veil` must be runtime-eligible; debug projection or any missing family fails loudly |
| `ProgressionUnlockDebugRepository.clearStoredProjectionForQaProvisioning()` | validated dev session row after canonical provisioning | `{ absent: true }` | malformed rows fail before removal; this narrow cleanup is not the ordinary `Use live` contract |
| `recordManagedProtectedVisit()` | successful visit timestamp | serialized activity-day disclosure command plus optional detached qualified-day observer | invalid timestamps/day keys or missing progression owner throw; rejected optional follow-up is diagnosed without failing committed tracking |
| `recordSuccessfulManagedProtectionActivityDay()` | canonical activity-day key and timestamp | persisted disclosure snapshot plus `activityDayOutcome` (`qualifiedDayRecorded`, `newlyGrantedFamilyIds`) | duplicate/stale days are no-op reads with no repository rewrite; a new day advances the unbounded count while only the latest 180 evidence keys are retained |
| `initializeArtifactDisclosure()` | current durable state through the shared service queue | strict current disclosure snapshot | incompatible presence rejects without conversion; missing state uses the current default |
| `assertSiteRegistrationAdmission()` | exact committed/current and resulting normalized protected-domain lists | admitted budget or `PROGRESSION_SITE_REGISTRATION_LIMIT_REACHED` | new registrations use the current stage budget; existing edits/removals do not spend places |
| `evaluateProgressionSnapshot()` | normalized state, facts, catalog | strict progression snapshot | unknown feature/condition/catalog failures throw |
| `buildDegradedProgressionSnapshot()` | state, partial facts, diagnostics | minimal safe progression snapshot | allowed only after fact-provider failure, not after policy/catalog bugs |
| `resetFirstVisionForDebug()` | explicit canonical dev mode plus current state | durable first-vision pending state | focused canonical test seam only; rejects implicit develop/preview mode and preserves counters, unlocks, milestones, and creation timestamp |
| `quiesceForProfileMutation()` | profile mutation admission request | quiesced acknowledgement after queue drain | closes operations synchronously; repeated calls reuse the in-flight/already-closed barrier for recovery |
| `clearForProfileMutation({ nowMs })` | canonical maintenance timestamp | persisted default progression document | available only while quiesced; invalid timestamp, missing terminal reset owner, or open admission throws; does not decode the discarded document |
| `ProfileMutationCoordinator.runExclusiveMutation()` | terminal reset/import task | durable complete lifecycle plus a locally sealed `reload_pending` runtime | never resumes the progression instance; the mutation response returns an exact handoff descriptor and only the trusted Dashboard post-settlement ACK may revalidate it and invoke runtime reload |
| `createProgressionFactsProvider()` | settings snapshot owner, required canonical `getStatsFactsRange` owner | cheap aggregate facts | either missing owner throws; zero protected domains skips the read |
| `ProgressionStateStore.writeState()` | candidate state | normalized persisted state | validates candidate and existing document; incompatible presence rejects without rewriting; equivalent writes are skipped |
| `ProgressionStateStore.resetForProfileMutation()` | required current replacement document from the quiesced full-reset service | replacement persisted after its storage ACK | validates only the replacement, then performs one local write without reading or removing the discarded document; write failure rejects |

## Recovery Versus Fallback

| Class | Allowed? | Rule |
| --- | --- | --- |
| Fact-provider read failure | Yes, explicit degraded snapshot | diagnostics must name the failure code/message; no progression-timestamp fact cache |
| Commit observer failure | Optional post-commit delivery seam | explicit diagnostic; cannot undo a stored mutation or block the queue; canonical viewing-boundary reads remain authoritative |
| Superseded debug replay completion | No-op by exact command contract | newer selection remains intact; do not retry an old descriptor against new state |
| QA removal of session row | Explicit synthetic-profile lifecycle only | generation and canonical-mode check precede repository cleanup; absent/default revision zero does not replace a newer mounted Dashboard projection |
| Missing facts provider on `readSnapshot()` | No | throw `PROGRESSION_FACTS_PROVIDER_REQUIRED` |
| Evaluator/catalog failure | No degraded fallback | throw so progression policy bugs are fixed |
| Missing canonical stats facts query | No | throw `PROGRESSION_FACTS_STATS_RANGE_SOURCE_REQUIRED` |
| Unknown event type | No fallback | `recordProgressionEvent()` throws a progression event contract error |
| First-vision visual replay | Narrow | session-only presentation projection; canonical first-vision judgment/timestamps are unchanged |
| First-vision durable reset | Restricted | dev-only, explicit canonical mode, focused canonical-progression tests only |
| Development progression projection | Narrow | absent session state means full_access/day 5; explicit canonical mode returns to live; every mode leaves canonical progression unchanged except the separately admitted durable reset |
| Synthetic canonical QA fixture | Narrow | explicit CLI and dedicated marker only; all durable writes use the canonical progression service, then the dev session row is removed before public-artifact verification |
| Retired development session contracts | No | the dev-only typed repository accepts current v3 only; older, malformed or unknown rows reject unchanged |
| Full progression reset | Restricted | maintenance/full reset owner only; not ceremony preview |
| Stale Dashboard generation | No retry/fallback | every First Vision request/response carries the document-captured generation; background execution throws `PROFILE_RESET_GENERATION_STALE` on mismatch |
| Progression operation during profile mutation | No | service rejects while quiescing/quiesced; it never races or retries around maintenance |
| UI-local progression flags | No | first-vision and unlock state live in `progression.state` |
| Widget-level progression checks | No | widgets consume snapshot/access output, not policy conditions |
| Dashboard artifact disclosure reconstruction | No | Tools and navigation consume the trusted background snapshot only |
| Evidence-driven artifact ordering/gating | No | observation signals may inform experiments/recommendations only; they never reorder or block disclosure |
| Historical calendar entitlement / beta settings continuity | No | no pre-release migration exists; current activity commands and explicit grants are the only entitlement writes |

## Current Findings

### F1. Snapshot reads now require a facts owner

Status: fixed in the 2026-06-29 progression boundary pass.

`createProgressionService()` may still be used for write-only commands such as
`resetFirstVisionForDebug()`, but `readSnapshot()` now throws
`PROGRESSION_FACTS_PROVIDER_REQUIRED` when no facts provider is wired. This
prevents repository-only services from silently evaluating progression from a
`nowMs` fallback.

### F2. Fact read failure remains a deliberate degraded seam

Status: keep.

If an explicit facts provider is present but fails, the service returns a
diagnostic degraded snapshot. This keeps non-critical progression UI stable
while preserving the failure code. It is not used for catalog/evaluator bugs.

### F3. Dashboard first vision uses the sole background owner

Status: fixed in the 2026-07-14 progression single-owner pass.

`useMainPresentationScene()` no longer creates a progression service or imports
the repository. The Dashboard lifecycle gate acquires one page-scoped profile
generation before feature runtime mount, and the client consumes that exact
lease instead of performing a second storage read. It sends the narrow
read/presented/spent actions through the trusted background route. The one
background service validates lifecycle admission and that exact generation when
each queued operation executes. A Dashboard left open across reset therefore
cannot write its old presentation result into the new profile. The client also
revalidates the page lease immediately after every awaited response, so an old
ACK cannot be consumed after the Dashboard lifecycle gate has closed.
Presented/spent commands also validate the returned state exactly. The current
scene remains behind the release-gated opaque cover until an exact durable
`spent` ACK arrives. Spent persistence uses a bounded retry; exhaustion leaves a
named `spent_persist_failed` diagnostic in `CURRENT_COMMITTED` instead of
fabricating `UNCOVERING` and exposing a still-locked Tools state.
The progression owner rejects `pending -> spent` with
`PROGRESSION_FIRST_VISION_SPENT_REQUIRES_PRESENTED`; only a durable
`presented` state (or an idempotent existing `spent` state) may advance the
disclosure transaction.

### F4. First Vision replay is a non-durable projection

Status: fixed in the 2026-07-22 development-projection pass.

`CeremonyPreviewLab` and the development HUD request the typed session preview
mode and reload only after its background-owned ACK. The existing Main
presentation conductor then executes the real First Vision scene and ceremony,
but the dev projection supplies presented/spent acknowledgements without
mutating canonical progression. Completion compares the captured
`{ contract, mode, dayCount, updatedAtMs }` descriptor and returns to `develop`
only if it still matches. The repository maintains logical monotonic
`updatedAtMs` without adding a version field. The ordinary replay UI does not import storage, create a second service,
call broad `reset()`, or invoke the low-level durable reset action.

### F5. Profile mutation has an explicit service participant

Status: fixed in the 2026-07-14 progression single-owner pass.

The service captures the durable lifecycle generation at construction and
serializes every normal read and write through one operation queue plus one
generation/admission gate. This keeps artifact bootstrap, activity writes, and
general snapshots closed even when a service worker restarts while the durable
lifecycle is `resetting` or `failed`.
`quiesceForProfileMutation()` closes admission before it awaits that queue and
also drains the initial generation capture. It is reusable while already
closing/closed so an explicit recovery mutation can finish after `FAILED`, but
that recovery remains a terminal control-plane operation. `clearForProfileMutation()`
is privileged to the quiesced phase. After the coordinator publishes durable
`complete`, it seals the old worker gate as `reload_pending`; neither the
progression instance nor the gate has a resume/reopen path. The terminal clear
uses `ProgressionRepository.resetForProfileMutation()` and the same named typed
store seam to validate and write the prepared current default in one storage
operation. It never decodes the discarded progression document, so incompatible
pre-release presence cannot block an explicitly authorized full reset. Normal
reads and writes still reject incompatible presence without rewriting it. A
missing replacement or failed storage ACK rejects the reset; successful return
follows that ACK. The successful
control response carries an exact `{ contract, operation, resetId }` descriptor.
Only after that response Promise settles does the Dashboard start the narrow ACK;
the eager background path revalidates durable `complete` and local
`reload_pending` before `chrome.runtime.reload()` terminates the old JavaScript
lifetime. Only fresh-worker bootstrap captures and binds the new generation.

### F6. Artifact disclosure is a fixed activity-day policy

Status: fixed in the 2026-07-12 artifact system pass.

The explicit stage owner is `progressionJourneyPolicy.js`. Spending First Vision grants `lens, gate, flare` together. Successfully recorded managed protected visits qualify one local 04:00 activity day; day one experiences the starter set, day two grants Brake, day three Barrier, day four Echo, and day five Veil. Pre-earned days reconcile when First Vision is spent. Duplicate/stale days, gaps, calendar elapsed time, dashboard opens, site count and friction evidence cannot accelerate this schedule. Durable raw activity count remains unbounded.

### F7. Dashboard disclosure reads have one background owner

Status: fixed in the 2026-07-12 artifact system pass.

Tools and the navigation cue use `GET_ARTIFACT_DISCLOSURE_SNAPSHOT`. The trusted
background route calls the progression service, and the returned snapshot owns
family order plus `catalogued`, `disclosed`, `visible`, `configurable`, and
`runtimeEligible` state. Dashboard code does not import the progression
repository, reuse the adaptive experiment planner, or derive entitlement from
runtime/configuration signals.

Artifact family/child catalog entries carry identity, presentation order and
the shared journey's family stage only. The retired visit/friction/7-or-10-day
`reveal`/`unlock` conditions have been removed; `assertProgressionCatalogValid`
rejects any artifact entry that reintroduces those independent condition fields.
The evaluator consumes family disclosure for every child rather than presenting
an ignored second policy as current configuration.
The Experiment planner's diagnostic `disclosureCycleIndex` also reads the same
family unlock-day table; it cannot show Brake at day one or Veil at day four
by deriving a second schedule from family position. Its evidence scores and
opened-card state remain observational and never grant access.

### F8. Pre-release storage accepts the current contract only

Status: current-only cleanup in the 2026-10-08 release preparation pass.

Progression store, development session repository, and snapshot preflight reject
retired or malformed present state without rewriting it. Background bootstrap
hydrates current disclosure and reconciles current registration milestones.
There is no historical calendar replay, configured-beta grant, pending migration
marker, or registration capacity floor. Explicit manual/advanced grants remain
current commands. Future released-profile transitions follow the
[storage versioning and migration policy](../storage/storage-versioning-and-migration-policy.md).

### F9. Independent release policies share unbounded qualified-use facts

Status: separated and validated in the 2026-10-13 architecture pass.

`buildArtifactDisclosureSnapshot()` attaches `unlockProgress`, and the
background progression query composes the development session projection before
the DTO reaches any consumer. Tools no longer creates a React-memory disclosure
projection. Protection runtime reads the same effective `runtimeEligible`
entries. `qualifiedUseFacts` preserves raw canonical/effective counts. Artifact
display fields alone cap at the artifact journey horizon; registration and
Bonsai consume raw facts under independent schedules. Threshold lookup supports
sparse schedules and never indexes a table by another policy's target.
Main consumes the nested `bonsaiRelease` DTO; its structure is a pure
projection of effective raw age under the Bonsai policy, while usage statistics and habit signals
shape only vigor and bounded imprint. In `build:dev`, missing session state
deliberately means `full_access` at day 5. An explicit day changes effective
qualified use and family projection without overwriting durable activity count
or fabricating visits, domains, scores, or tracked days. It uses the current
durable identity with an ephemeral lineage and read-only cultivation policy, so
inspecting day 0-5 cannot cap on old lineage or write new history. `Use live`
writes an explicit `canonical` sentinel; removing the key would restore the
development default. Dashboard tab changes cannot clear or reconstruct either
mode.

Public artifact access is `journey_gated`. Development's absent session record is `full_access` at the derived preview maximum, currently five; explicit day selection uses effective raw facts. The parent snapshot owns access mode and entries; nested `progression_unlock_v3` composes effective families, canonical grants, registration budget, represented-site limit, independent Bonsai releases and first-bloom eligibility. Its validator rejects contradictory nested and parent state. Current registration reaches unlimited on day five, independently of five represented koi and the direct-entry completion thresholds.

The SettingsService mutation lane invokes `assertSiteRegistrationAdmission` before every patch adding a protected domain, using current and resulting blocked lists. There is no UI-only gate or separate popup budget. Existing edits/removals and allow-list registrations remain admitted. Normal reads and bootstrap never infer grants or registration capacity from existing settings.

Main may present a short catch-up reveal when canonical Bonsai release age advanced
while the Dashboard was closed. Its page-local acknowledgement only records
what the user has already seen. It ignores debug projections and can neither
grant nor delay structure, artifact eligibility, or First Vision.

### F10. Committed mutations invalidate every admitted Dashboard

Status: commit propagation added in the 2026-10-13 architecture pass.

The service's sole ordinary persistence helper marks the queued operation after
each storage ACK. It dispatches one detached invalidation even if a later result
projection rejects. Session mutations use the same operation mark. The observer
can query the owner and must never be awaited from its queue. General snapshots
read current facts each time rather than caching by progression.updatedAtMs.
Both durable and session commit timestamps strictly increase for changed writes
within their owner, even when wall-clock time repeats or regresses. They are
logical commit revisions in the existing document shapes. Resource publication
rejects a response older on either owner dimension; a newer session revision
cannot conceal an older durable receipt.

The typed `PROGRESSION_STATE_CHANGED` event carries generation only. One
ref-counted resource listener per document verifies that generation, fences
pending reads and refreshes the canonical query. Hidden pages defer IO. Guidance
has an independent query refresh, and qualified-day follow-up sends optional
notifications only. The shared Dashboard query resource also revalidates when the document becomes
visible and whenever the user enters Main. A previously validated snapshot
remains mounted during the refresh; loading or error replaces Main only when no
canonical snapshot has ever been obtained. This is stale-while-revalidate
presentation, not a secondary source of truth: the resource retains the exact
last background DTO and publishes any refresh failure through its error state.

Guidance receipts and notification delivery use the actual artifact stage
threshold rather than the current raw/display day. This preserves one catch-up
receipt on sparse schedules and suppresses no-grant-day alerts. Artifact
receipt/claim bounds follow the artifact horizon; session preview identity uses
safe raw age independently of that horizon.

## Re-Audit Checklist

- Run `npm run check:progression:architecture` after progression service, first-vision ceremony, or experiment reset changes.
- Run `npm run test:file -- tests/progression/progressionStorageService.test.js tests/progression/progressionSingleOwnerService.test.js tests/progression/firstVisionProgressionClient.test.js tests/useMainPresentationScene.test.jsx tests/ceremonyPreviewLabProgressionReset.test.jsx tests/backgroundMessageRouter.test.js` after progression runtime changes.
- Run `npm run test:file -- tests/progression/progressionPolicySeparation.test.js tests/progression/progressionUnlockDebug.test.js tests/progression/siteRegistrationJourneyPolicy.test.js` after qualified-use/policy/DTO changes; cover different horizons, sparse schedules, raw days beyond five and contradictory DTOs.
- Confirm new progression snapshot consumers pass an explicit facts provider.
- Confirm artifact disclosure consumers use `readArtifactDisclosureSnapshot()` through the background query route rather than importing the repository.
- Confirm Dashboard source contains neither `ProgressionRepository` nor `createProgressionService`.
- Confirm every First Vision request and response carries the shared page-admission generation and that the client performs no independent lifecycle read.
- Confirm profile mutation uses terminal progression quiesce/drain, seals the old worker, and lets only fresh-worker bootstrap bind the new generation.
- Confirm only successfully recorded managed protected visits reach `recordManagedProtectedVisit()`.
- Confirm active disclosure order and pacing remain owned by `artifactDisclosurePolicy.js`; evidence/planner signals must not gate or reorder it.
- Confirm retired/malformed present state rejects unchanged and bootstrap never derives grants or capacity from configuration.
- Confirm ordinary First Vision replay changes only the typed session projection, runs through the existing presentation conductor, and performs no durable progression write.
- Confirm the low-level durable First Vision reset rejects every mode except explicit canonical and remains unreachable from ordinary UI.
- Confirm build:dev missing session state means full_access/day 5, `Use live` persists explicit canonical mode, and all dev modes return one effective owner DTO.
- Confirm public aliases, routes, module inventory, and emitted chunks contain no progression debug action, contract, repository, or First Vision development-projection signature.
- Confirm raw facts remain unbounded and consumer thresholds live only in their named artifact, registration or Bonsai owner; the preview maximum is display/control only.
- Confirm ordinary writes use the service persistence helper and commit observers remain detached from its queue.
- Confirm first-bloom UI consumes domain eligibility and catch-up uses canonical Bonsai age.
