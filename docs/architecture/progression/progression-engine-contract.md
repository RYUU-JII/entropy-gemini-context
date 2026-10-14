# Progression Engine Contract

- Status: Active
- Date: 2026-05-08
- Owner: progression domain
- Last validated against code: 2026-10-13
- Path policy: current-only
- Canonical for: staged disclosure, feature unlocks, site-slot budgets, first-vision transition, and future achievement/badge hooks

Policy values for the current product experience live in `docs/architecture/progression/progression-policy.md`.

The runtime owns qualified-use facts separately from consumer policy:

- `policy/qualifiedUsePolicy.js` and `contracts/qualifiedUseFacts.js`: shared visit/day qualification and unbounded canonical/effective facts.
- `policy/progressionJourneyPolicy.js`: artifact family schedule; `policy/artifactDisclosurePolicy.js`: durable grants and provenance.
- `policy/progressionRegistrationPolicy.js`: registration schedule, direct-entry completion and represented capacity as independent concerns.
- `contracts/progressionBonsaiRelease.js`: Bonsai maturity, one stage threshold table and first-bloom eligibility.
- `policy/progressionUnlockPolicy.js`: combined DTO composition and cross-field validation.
- `policy/progressionPreviewPolicy.js`: derived maximum horizon for preview controls and synthetic QA preparation only.

`policy/progressionPolicy.js` carries experience/presentation metadata and derives site-slot features from the registration owner. The catalog describes identity and presentation; it cannot introduce a second disclosure order, ignored artifact conditions or independent registration thresholds. Paths above are relative to `src/domains/progression/`.

## Purpose

Progression is the extension-wide policy layer for deciding what a user can discover, configure, and run at the current growth stage.

It is separate from:

- Capability: whether permissions, protected sites, and runtime surfaces are available.
- Configuration: whether the user has enabled a feature.
- Runtime: whether the feature is currently active on a page.
- Presentation: how dashboard/theme UI renders the decision.

The canonical order is:

1. Progression evaluates the disclosure journey and projects the current artifact access mode.
2. Capability decides whether the eligible feature can actually execute.
3. Configuration records user intent.
4. Runtime executes only when all relevant gates agree.

## Storage

Progression state is a small durable document in `chrome.storage.local` under `progression.state`.

The state stores durable milestones and cheap counters only:

- first-vision state
- artifact disclosure policy version, day cursor, and per-family grant entries
- manual/grandfathered unlocks
- bounded milestone ids
- bounded active-protection date keys
- cheap counters such as protected visits and friction successes

Large history, usage logs, CLSE buckets, and statistical windows stay in their existing IndexedDB owners. Progression may consume pre-computed aggregate facts from those owners, but content blocking and prepaint decisions must not query IndexedDB for unlock policy.

## Evaluation

The pure evaluator lives in `src/domains/progression/model/progressionEvaluator.js`.

Inputs:

- normalized progression state
- cheap aggregate facts
- the declarative progression catalog

Output:

- phase
- first-vision state
- site-slot budget
- bonsai growth
- active experience presentation policy
- per-feature access state
- diagnostics
- artifact disclosure snapshot

General feature access has three booleans:

- `visible`: may be shown or teased in UI
- `configurable`: may be configured by the user
- `runtime`: may participate in runtime activation

Unknown catalog condition types must throw. Fact-provider failures are represented
by an explicit degraded snapshot with diagnostics so non-critical progression UI
can remain stable without hiding the failure.

The facts provider itself is a required read owner for `readSnapshot()`.
Progression must not evaluate snapshots from an implicit `{ nowMs }` fallback
when the caller forgot to wire a facts owner. Evaluator/catalog failures are not
fact-provider degradation; they must throw so policy bugs are fixed instead of
turned into a minimal unlock snapshot.

Artifact-family disclosure has an explicit five-term projection:

- `catalogued`: the canonical family exists in the release catalog
- `disclosed`: progression has durably granted the family
- `visible`: the family may appear in ordinary product UI
- `configurable`: its release children may be configured
- `runtimeEligible`: its configured behavior may enter runtime planning

Public canonical access is `journey_gated`: durable family grants make all release children configurable and runtime eligible together. An injected development-only owner can project full access; no public settings switch bypasses the journey. Locked catalog introductions are read-only. Capability, configuration, suspension, and current page conditions still determine actual execution.

The strict `progression_unlock_v3` DTO includes:

- `qualifiedUseFacts: { contract: 'qualified_use_facts_v1', canonicalDayCount, effectiveDayCount, lastActivityDayKey }`: unbounded raw facts, with effective count changed only by a development projection.
- `canonicalQualifiedUseDayCount`, `qualifiedUseDayCount`, `targetDayCount`: artifact-journey display fields capped by that schedule alone.
- `canonicalDisclosedFamilyIds`, `effectiveFamilyIds`: durable grants and access projection, preserving legitimate manual grants.
- `siteRegistrationBudget` and `representedSiteLimit: 5`: results from the registration policy; limited budgets are exactly `{ mode: 'limited', limit: positiveInteger }`, unlimited budgets exactly `{ mode: 'unlimited' }`.
- `bonsaiRelease`, `canonicalBonsaiRelease`: effective and real raw age projected by the Bonsai policy alone.
- `bonsaiFirstBloom: { eligible, opened, canonicalFirstVisionSpent }`: explicit opening eligibility and receipt; existing `bonsaiFirstBloomOpened` receipt readers are cross-checked against this view.
- `nextStage`: the next effective raw day and each consumer's result while any independent schedule remains pending; currently day five returns `null`, and day zero's next day has no new family.

The parent disclosure snapshot owns access mode and carries actual `canonicalFirstVisionSpent`. `requireArtifactDisclosureSnapshot()` validates the parent, entries/map, nested facts, access, budgets and first-bloom view together. No other policy consumes an artifact display cap or the preview maximum as its own release threshold. A later Bonsai completion can coexist with an earlier artifact route. Family count and represented-site count never substitute for age or direct-registration completion.

## First Experience

The first launch may show the idealized vision garden. Once that vision is actually presented, callers must record `first_vision_presented`; once the transition is complete, callers record `first_vision_spent`. Recording `first_vision_spent` durably grants Lens, Gate, and Flare together and reconciles pre-earned qualified activity against the explicit stage table.

The first vision is not spent on the same instant it is presented. The policy gate requires its minimum foreground-admitted dwell and product triggers such as staying on the dashboard long enough, a later dashboard boot, or the first protected-site registration before the descent ceremony can run. The shared Dashboard presentation admission owns foreground and competing presentation gates; progression owns durable state only.

After the vision is spent, the default phase becomes `seedling_reality` until the user earns the next protected-site slot.

First-vision transition choreography is policy-owned. UI callers may render it differently by surface, but they must preserve the policy phase order and milestone semantics.

In `build:dev`, ordinary visual replay is a session-only presentation projection.
It makes the existing Dashboard conductor observe an effective `pending` state,
records projected presented/spent acknowledgements without writing
`progression.state`, and conditionally returns to the selected development day after the
ceremony. Completion compares the exact captured session descriptor on the same
service queue; it cannot overwrite a newer day/mode selection. The existing
four-field v3 shape uses a monotonic logical `updatedAtMs` revision. The canonical First Vision state and every counter, disclosure, and
milestone remain unchanged. A separate low-level durable reset may set only
`firstVision` back to `pending` and clear only its timestamps, but it is admitted
only in explicit canonical mode for focused canonical-progression tests. Public
builds contain neither replay/reset actions nor the development projection.

The real-site E2E harness may prepare a dedicated, explicitly marked synthetic
QA profile through a dev-only trusted provisioning route. That route does not
change policy: it invokes the same canonical First Vision and qualified
activity-day commands, verifies the fixed family prefix and Veil eligibility,
removes its typed development session row, and then updates the same unpacked
extension id in place to the guarded public artifact. Public artifacts contain
no provisioning action or route, and an ordinary release run may only read and
verify the prepared snapshot.

Dashboard presentation selection is not owned by progression. For the Zen main tab, first vision is the one high-priority special scene selected by the main presentation conductor in `docs/architecture/themes/zen/zen-main-presentation-scene-architecture.md`; progression owns only its eligibility/spent state, and the conductor otherwise selects `current`.

## Artifact Disclosure Route

The release route is fixed and is distinct from catalog insertion order,
manifestation names, configuration state, runtime telemetry, and experiment
scores:

1. `lens` — Shoji (starter)
2. `gate` — Shishi-odoshi (starter)
3. `flare` — Dreamscape Furin (starter)
4. `brake` — TomeIshi (day 2)
5. `barrier` — Ishidouro (day 3)
6. `echo` — The Forgetting Tide (day 4)
7. `veil` — Enso (day 5)

The timing contract is:

- First Vision is preview-only; spending it grants the starter trio.
- Only a successfully recorded managed protected visit qualifies activity.
- Activity days use the shared local 04:00 boundary.
- The first distinct qualified day experiences the starter set and discloses no additional family.
- Beginning with the second distinct qualified day, at most one next family is
  disclosed per day.
- Missed days do not accumulate catch-up releases, and the route never loops
  after Veil.
- Runtime/configuration signals, observation evidence, and experiment scores
  never gate or reorder this route.

Signals may still be used to explain a recommendation or run an observe-only
experiment. Such output has no entitlement authority.

Initial artifact realization remains milestone-owned. The Shoji ceremony is
anchored to `milestone.firstProtectedEntry`,
`milestone.artifact.shojiObserved`, and
`milestone.artifact.initialSetRealized`; UI code must not replace those with
component-local booleans. These milestones own presentation only and do not
gate Lens disclosure.

## Explicit grants and persisted contracts

Manual and advanced-mode commands may record explicit grandfathered feature IDs. They are current domain operations and never a stored-shape converter. Only the current exact progression/artifact contract is accepted at repository, normalizer, export, and import-preflight boundaries. Incompatible pre-release documents are left unchanged and fail explicitly; an explicit reset can create a new profile.

Bootstrap hydrates current disclosure state and observes canonical protected-site count for presentation milestones. It performs no calendar replay, configuration-derived grant, beta capacity preservation, or durable migration. Registration capacity is the current five-day stage only. Released-profile upgrades must use the separately reviewed [storage versioning and migration policy](../storage/storage-versioning-and-migration-policy.md).

## Registration command owner

SettingsService binds `setSiteRegistrationAdmissionOwner(progressionService.assertSiteRegistrationAdmission)`. Before persistence, its serialized mutation lane checks any resulting blocked list that adds a domain. The progression service reads the effective owner snapshot and rejects overflow with `PROGRESSION_SITE_REGISTRATION_LIMIT_REACHED`. Allow-list additions, existing edits and removals do not spend protection places. Bulk, popup and site-rule commands share this seam; UI budget previews are never admission authority.

## Development projection and qualified-day follow-up

Development contract v3 defaults to `full_access` at day five when its session row is absent. Explicit day 0–5 selection is `develop` with the exact journey gate; `canonical` restores durable policy. Current and effective day are distinct; stats/pressure history remains real. The First Vision query always exposes `effectiveFirstVisionState` from the injected projection owner without requiring public Guidance code to import debug modes.

After a successful activity write, the service returns the disclosure snapshot plus `activityDayOutcome: { qualifiedDayRecorded, newlyGrantedFamilyIds }`. Duplicate/stale days return false and an empty set. The coordinator's optional `onQualifiedDayRecorded(result, {activityDayKey, atMs})` runs detached only for true outcomes. Its rejected follow-up is diagnosed and cannot fail tracking or progression.

Dedicated QA cleanup enters `clearProgressionUnlockDebugSessionForQa()` with the exact profile generation, requires canonical mode, and removes the typed session row on the service queue. Ordinary Dashboard lifecycle does not use this seam or preserve mounted query caches across it. QA routes import no debug repository and cannot mutate a session before generation admission.

## Command serialization and commit propagation

The background kernel constructs one production `ProgressionService`; every normal command/query enters its generation-admitted operation queue. `persistProgressionState()` is the sole ordinary repository write helper. An operation tracks acknowledged writes and invokes detached `onCommitted({ profileGeneration })` once after a change. A later projection failure does not hide a committed write; a failed write cannot publish a commit. The observer may query this service, so the queue must never await it. Terminal maintenance replacement remains the explicitly quiesced reset seam.

The production observer sends exact `PROGRESSION_STATE_CHANGED` invalidation with profile generation. One Dashboard resource listener fences prior reads and refreshes the authoritative snapshot; hidden documents wait for viewing reentry. Guidance refreshes separately, and qualified-day follow-up owns optional notification. Events carry no copied state and do not become a second durable truth. General snapshots read the current facts owner each time; progression timestamps cannot cache settings/stats revisions.

Changed durable and session writes strictly increase their existing `updatedAtMs` fields as logical owner revisions. Dashboard snapshot publication rejects an older response on either dimension, including equal-session responses with older durable receipts. No new persisted revision field is added. First-bloom claim ACKs await the canonical refresh and generation recheck; they never synthesize an optimistic receipt snapshot. Post-consumption refresh failure remains explicit.

First-bloom eligibility comes from the Bonsai domain helper using actual canonical First Vision spent, canonical mode, full form and an unopened receipt. Its queued claim revalidates those facts and consumes the existing milestone once. Home adds explicit user input and shared contextual presentation admission only. Growth catch-up acknowledges canonical Bonsai age already seen; it cannot grant or delay progression.

Guidance consumes actual artifact-stage threshold identities for presentation receipts and notification delivery. Sparse no-grant days can catch up to an earlier unpresented stage but cannot invent a new release day. Claim/receipt bounds follow the artifact horizon; session preview identity remains an independently validated safe raw count.

## Boundaries

- Do not place progression `if` statements directly inside feature widgets.
- Do not read `ProgressionRepository` from the dashboard to decide artifact visibility; consume the background disclosure snapshot.
- Do not use configuration, runtime telemetry, novelty, rhythm, supply, or other evidence to gate/reorder artifact disclosure.
- Do not expose release children as separately earned progression levels; family disclosure grants the complete release child set.
- Do not derive entitlement or registration capacity from pre-release settings or historical calendars.
- Do not make progression depend on live IndexedDB reads on blocking or prepaint hot paths.
- Do not treat hidden features as missing catalog entries.
- Do not silently default unknown feature ids or condition types.
- Do not provision release E2E progression by editing Chrome profile files or
  storage backends, uninstalling/reinstalling an assumed-stable extension, or
  exposing the QA provisioning route in a public artifact.
- Do not duplicate product policy values in UI or catalog code; use the named consumer policy seam.
- Do not add a global unlock horizon or derive raw qualified-use age from capped display fields.
- Do not await a progression-querying observer from its serialized command queue.
- Do not store artifact observation or first-realization state in component-local persistence.
- Do not use progression first-vision state as a general dashboard presentation conductor; it owns first-vision eligibility/spent state only.
- New condition types must be added to the contract, evaluator, tests, and catalog in the same change.
