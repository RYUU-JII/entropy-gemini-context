# Progression Policy

- Status: Active
- Owner: progression domain
- Last validated against code: 2026-10-13
- Path policy: current-only
- Canonical for: five qualified use day journey, starter artifact disclosure, registration budgets, bonsai release age, and current-only persisted contracts

## Intent and owners

The first launch shows the garden's possibility. Reality begins with one protected site and three usable artifact families. Five distinct days of actual protected use enlarge the garden without requiring a streak, many sites, friction successes, or a particular intervention encounter.

Qualified-use facts are independent of their consumers. [qualifiedUsePolicy.js](../../../src/domains/progression/policy/qualifiedUsePolicy.js) owns visit qualification and reads the shared activity-day boundary; [qualifiedUseFacts.js](../../../src/domains/progression/contracts/qualifiedUseFacts.js) names the unbounded canonical and effective counts. The existing durable document shape remains unchanged.

The artifact stage table is [progressionJourneyPolicy.js](../../../src/domains/progression/policy/progressionJourneyPolicy.js). [progressionRegistrationPolicy.js](../../../src/domains/progression/policy/progressionRegistrationPolicy.js) separately owns registration budgets, direct-registration completion and represented-site capacity. [progressionBonsaiRelease.js](../../../src/domains/progression/contracts/progressionBonsaiRelease.js) owns Bonsai maturity, stage thresholds and first-bloom eligibility. Each consumes raw qualified-use facts under its own schedule. Their present completion dates coincide at five; changing one policy does not change the others. Artifact and registration tables resolve by thresholds, including sparse schedules, rather than using a day as an array index.

Durable grants and provenance belong to [artifactDisclosurePolicy.js](../../../src/domains/progression/policy/artifactDisclosurePolicy.js). [progressionUnlockPolicy.js](../../../src/domains/progression/policy/progressionUnlockPolicy.js) composes and validates the policies' results for Dashboard, protection planning and registration admission. It owns no shared release threshold; its next-stage roadmap checks each consumer's pending schedule. [progressionPreviewPolicy.js](../../../src/domains/progression/policy/progressionPreviewPolicy.js) derives the maximum policy horizon for preview controls and synthetic QA preparation only. Configuration, capability and current runtime conditions remain separate from disclosure.

## First Vision and reality

After a successful canonical First Vision spent ACK, the Dashboard client
supersedes pre-ACK artifact resource reads, awaits a fresh disclosure query, and
invalidates Guidance's UI query through its owned state-change event. Pending
dream snapshots cannot republish over the starter set or be reused by Tools'
freshness cache. Development replay retains its existing debug-owner snapshot
commit, which also supersedes pending reads. No timer grants or query defaults
stand in for the acknowledged owner state.

First Vision is an idealized visual preview. It does not grant, configure, or run artifacts. The existing Main conductor admits exactly `first_vision` and `current`, governed by [Zen Main presentation](../themes/zen/zen-main-presentation-scene-architecture.md).

The minimum twelve-second dream dwell and existing descent admission remain intact. Dwell accumulates only while the shared Dashboard presentation admission is foreground-active; hidden or unfocused time cannot complete it. `first_vision_presented` records actual presentation; only `first_vision_spent` grants Lens, Gate, and Flare together and reconciles pre-earned qualified use. A pending vision cannot be directly spent. A presented command that observes an already-spent state from another Dashboard refreshes disclosure before handing off to current.

Reality begins with a live young bonsai. An empty garden keeps one clickable white invitation koi; it is a registration affordance, never a synthetic site or progression fact. Adding a slot does not create another phantom koi. The existing residence/challenge selector supplies at most five represented protected sites in stable order, independently of how many may be registered.

## Qualified use day schedule

A successfully recorded managed protected visit qualifies the local activity day that begins at 04:00. Duplicate and older activity days are no-op commands. Dashboard opens, raw elapsed time, passive browser-open time, and unprotected visits earn no credit. Days need not be consecutive and never reset after an absence.

| Qualified days | New family grants | Total families | Registration budget | Bonsai release score |
| ---: | --- | ---: | --- | ---: |
| 0 after descent | Lens, Gate, Flare | 3 | 1 | 0 |
| 1 | none | 3 | 1 | 18 |
| 2 | Brake | 4 | 2 | 35 |
| 3 | Barrier | 5 | 3 | 53 |
| 4 | Echo | 6 | 4 | 70 |
| 5 | Veil | 7 | unlimited | 88 |

The explicit release order is `lens, gate, flare, brake, barrier, echo, veil`. Seven-family cardinality is not the five-day clock. Before First Vision is spent, qualified activity is stored without ordinary journey grants. Spending First Vision reconciles the applicable stage in one monotonic write. Already granted or explicitly grandfathered families are never revoked.

After day five, the durable qualified activity count continues to increase. Only the artifact journey's display projection saturates at its own final day; the sequence never restarts. `activeProtectionDateKeys` retains only the latest 180 validated keys, while `qualifiedActivityDayCount` and `lastProcessedActivityDayKey` retain unbounded monotonic provenance. A wall-clock regression cannot reduce document timestamps.

`unlockProgress.qualifiedUseFacts` is the strict `qualified_use_facts_v1` view with `canonicalDayCount`, `effectiveDayCount` and `lastActivityDayKey`. Canonical mode has equal raw counts; a development preview changes only the effective count. The existing `canonicalQualifiedUseDayCount`, `qualifiedUseDayCount` and `targetDayCount` are artifact-journey display fields, never the input to another consumer's policy. The combined DTO validator cross-checks raw facts, display caps, family grants/access, registration budgets and Bonsai projections. Missing fields and contradictory values fail explicitly; no read-time compatibility shape is accepted.

## Bonsai and pressure observation

Bonsai release age is `round(min(day, 5) / 5 * 88)`. Health, confidence, habitual evidence, and bounded structural imprint remain owned by the existing model and never subtract release age or gate the full readable form.

`bonsaiRelease` projects effective raw age; `canonicalBonsaiRelease` projects real raw age. Each saturates under `PROGRESSION_BONSAI_FULL_FORM_DAY_COUNT` alone. Growth catch-up acknowledgement reads `canonicalBonsaiRelease.qualifiedUseDayCount`, so a different artifact horizon cannot cap what the user may see. Stage descriptors and classification share one threshold table in the Bonsai contract.

First bloom is a separate explicit opening. The existing milestone receipt remains `milestone.bonsai.firstBloomOpened`; it neither changes age nor grants artifacts. The background supplies actual `canonicalFirstVisionSpent` and projects `bonsaiFirstBloom: { eligible, opened, canonicalFirstVisionSpent }`. Eligibility requires canonical mode, spent canonical First Vision, the Bonsai policy's full form and an unopened receipt. Development previews cannot consume it. Home adds presentation readiness and explicit user input to this domain eligibility; it never reconstructs the day threshold. The queued claim verifies the same policy and writes once after its storage ACK.

The client awaits a fresh canonical disclosure snapshot after the claim ACK and rechecks its generation before animation. It never patches receipt booleans into an older snapshot. A refresh failure stays explicit even after the receipt was consumed; it cannot fabricate a new eligibility decision or re-arm the receipt.

| Score | Stage |
| ---: | --- |
| 0–8 | first sight |
| 9–23 | seedling |
| 24–43 | young bonsai |
| 44–59 | trained shape |
| 60–84 | flower bud |
| 85–100 | full bloom |

The pressure rail uses real observed completed activity days. Its collecting/ready/stable thresholds remain in the [Main surface owner](../repository/main-tab-home-surface-boundary-map.md): three completed observations for ready, seven for stable. Journey day three does not manufacture a graph, pressure, or observed history.

## Registration admission and represented sites

The registration budget applies to current normalized `blockedUrls` protection registrations, including temporarily paused protection. Allow-list registrations consume no protection slot. Existing entry edits, removal, and replacement within the current budget remain available. A move from allowed to blocked is a new protection registration.

[SettingsService](../../../src/apps/background/services/SettingsService.js) invokes its bound progression admission owner inside the serialized settings mutation lane before every persisted patch that adds blocked domains. All canonical entrypoints, including popup, site-rule commands, generic allowed settings patches, and batch additions, obey the same decision. Concurrent commands cannot spend the same remaining place twice. The guard checks resulting registration cardinality, not an optimistic dashboard draft.

The owner receives exact `currentDomains` and `nextDomains`. A limit rejection is `PROGRESSION_SITE_REGISTRATION_LIMIT_REACHED`, with the current budget, qualified day, and next increase day. `siteRegistrationRejection.js` preserves these exact details through the settings and popup public failure responses, transport, and Dashboard command bus. Local registration controls and shared operation feedback explain the current capacity and actual next qualified use day. The next increase search uses the current stage owner; day four points to unlimited access at day five. Malformed matching details fail with `SITE_REGISTRATION_REJECTION_INVALID`. At day five the budget is `{ mode: 'unlimited' }`, not a numeric sentinel, `Infinity`, or a sixth koi.

The represented pond/rail limit stays five. Sites outside this representation remain protected and contribute to statistics. No pinning or display-selection migration is introduced.

Direct registration currently completes after five real qualified-use days or five concurrently protected registrations. These are independent policy constants; represented koi count is not a registration completion condition. The general evaluator's site-slot features and their catalog stages derive from the registration budget table, so they cannot carry a second list of day thresholds.

## Disclosure and configuration

Public canonical access is `journey_gated`. A disclosed family makes every release child configurable and runtime eligible together. Locked families can retain a read-only catalog introduction; their settings and recommendation actions remain disabled.

Disclosure does not alter any settings. Flare remains disabled by default. Its installation ceremony follows explicit acknowledged configuration and does not spend an activity day, enable a hidden timer, fabricate an overrun, or consume real Furin delivery receipts.

Family actions retain their existing meaning: applying a recommendation explicitly configures a conservative starting set; pause/resume changes suspension without overwriting child settings. Echo recommendation keeps destructive history cleanup off. Actual execution still depends on configuration, suspension, capability, global pause, and current conditions.

The existing Shoji realization milestones remain presentation facts. They do not gate the starter set. Adaptive recommendation/experimental evidence never changes the fixed schedule.

## Development and QA

Development session contract `progression_unlock_debug_v3` has `full_access`, `develop`, `canonical`, and `first_vision_preview` modes. A missing session row means full access at day five, with First Vision treated as spent only for presentation. The full-access button remains explicit after selecting a preview.

Selecting day 0–5 writes `develop` and uses the exact journey gate for families, registration budget, and bonsai. Day zero always previews the post-descent starter trio. Selecting a debug day never changes durable grants, counters, settings, site cardinality, historical observations, or lineage.

`Use live` writes the canonical sentinel. Removing the session row restores full-access default. First Vision replay uses session-only projected acknowledgements. Completion compares the exact captured four-field v3 descriptor inside the service queue before returning to `develop`; a newer selection makes completion a no-op. `updatedAtMs` is a monotonic logical revision (`max(clock, previous + 1)`), preventing same-millisecond and clock-regression collisions without changing the session shape. Preview controls select `qualifiedUseFacts.effectiveDayCount`, not the capped artifact display. Durable reset remains a separate canonical-mode-only debug command. Public artifacts expose none of these controls or dev signatures.

## Commit propagation and presentation ownership

All ordinary durable mutations pass through `ProgressionService.persistProgressionState()` on the shared operation queue. After an acknowledged durable or session mutation, the operation emits one detached `onCommitted({ profileGeneration })` invalidation. It still emits when a later result projection fails; a rejected storage write never emits. The observer may query progression and is never awaited from that queue. General `readSnapshot()` performs a current facts-owner read instead of caching by progression timestamp, which cannot represent settings or stats revisions.

Durable `updatedAtMs` and session `updatedAtMs` strictly increase on changed owner writes, using existing fields as logical commit revisions. Dashboard publication compares both dimensions, so an old durable response with a newer/equal session descriptor cannot restore an earlier receipt or grant. No extra persisted revision field or shape migration is introduced.

The production observer publishes the exact `PROGRESSION_STATE_CHANGED` generation envelope. Dashboard's one ref-counted artifact resource listener fences old reads and queries the canonical owner; the event carries no grant, snapshot or receipt. Hidden documents defer IO to ordinary viewing reentry. Guidance independently refreshes its query for the event; qualified-day follow-up owns optional notification only. Observer failures are diagnosed; viewing-boundary canonical reads remain the read mechanism.

Guidance's presented-stage and notification identities use the artifact stage's actual threshold, including catch-up on a later sparse day. A raw day with no artifact grant cannot nominate a new release alert. Guidance's claim/receipt bounds follow the artifact horizon, while session `previewDay` retains safe raw preview identity independently; a later Bonsai preview cannot invalidate that session.

`DashboardPresentationAdmission` owns the shared foreground/exclusive/contextual presentation decision. First Vision retains its conductor and exact scene/cover acknowledgements; ordinary ceremonies wait behind it. First bloom and contextual Guidance require the same contextual admission. This is presentation coordination, not another progression clock, grant controller or durable event log.

Dedicated E2E fixtures use five monotonic keys through canonical presented/spent/activity commands. Marker schema v3 records day-five synthetic provenance. Legacy schema-v2 seven-key fixtures require reprovisioning; the runtime does not reinterpret their marker as current evidence. Public release lanes only verify prepared fixtures and never manufacture activity.

QA session cleanup is an explicit generation-admitted service command on the same queue. It requires canonical mode and removes the typed session row only through its repository owner. This returns a dedicated synthetic profile to absent/default development state before replacing its artifact; it is outside the ordinary Dashboard lifecycle and does not preserve mounted Dashboard caches. An absent session's default logical revision zero cannot overwrite a newer accepted Dashboard projection.

## Persisted contract and release transitions

Pre-release profiles have no compatibility guarantee. `ProgressionStateStore`, development session projection, and portable snapshot preflight accept only their current exact contracts. The first public artifact policy baseline is V1 and contains activity provenance and disclosed families; it contains no beta configuration grants, migration markers, or registration continuity floor. An incompatible present document fails before any rewrite. Absence alone initializes a new current profile.

Explicitly authorized full reset is a terminal replacement operation. After
the profile mutation owner closes admission and quiesces progression, its
typed `resetForProfileMutation` seam validates the prepared current default
and awaits one storage write without decoding the discarded document. This
does not change strict normal reads, ordinary writes, or import validation;
storage failure keeps the reset failed and the old runtime terminal.

Background initialization hydrates the canonical disclosure snapshot and reconciles the current protected-registration milestones. It does not consult historical calendar entitlement or turn configuration into grants. Explicit manual/advanced grants remain current commands. Import validates current data before lifecycle admission and backend writes; it does not upgrade old policy documents.

Future released-profile transitions follow [storage versioning and migration policy](../storage/storage-versioning-and-migration-policy.md). No automatic profile wipe, read-time converter, or historical initializer is retained for unreleased data.

## Boundaries

- User guidance and presentation receipts cannot grant families or use days.
- Theme widgets consume owner DTOs; they do not recompute registration or release thresholds.
- Protection/prepaint hot paths do not read IndexedDB for progression eligibility.
- Settings commits cannot skip the canonical registration admission lane.
- Existing pre-release configuration cannot grant entitlement or increase registration capacity.
- Unknown durable shapes, catalog IDs, debug states, or condition types fail explicitly.
