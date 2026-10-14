# Contextual Guidance Runtime

- Status: Active
- Owner: guidance domain / dashboard and popup surfaces / platform storage
- Last validated against code: 2026-10-13
- Path policy: current-only
- Canonical for: contextual guide receipts, first Furin installation intent, presentation claims, development preview isolation and journey notification deduplication

## Ownership

`src/domains/guidance/background/GuidanceService.js` serializes the guide ledger and presentation claims. It reads ProgressionService's effective and canonical release snapshots, First Vision's `effectiveFirstVisionState`, and canonical SettingsService state. It does not grant artifacts, mutate usage, conclude protection interventions or write actual Furin daily receipts.

`backgroundKernelGuidanceSettings.js` awaits SettingsService hydration and projects its current global goal, registered domains and `mergeNudgeConfig` runtime policy. The stored nudge document may be sparse; only its existing settings owner interprets that shape. Guidance validates a concrete boolean enabled state and adds no defaults or raw-storage reads. First Vision reads carry the same `expectedProfileGeneration` captured by guidance context.

`src/apps/background/services/runtime/messageRoutes/guidanceMessageRoutes.js` admits only the exact trusted dashboard and popup pages. Mutations require the profile generation captured by the page-bound shared client. Claims bind the trusted sender document, an opaque host/document identity and a 60-second session lease. A shown receipt requires the owning claim's visible frame ACK. Closed and completed receipts are distinct. Completion is admitted for a confirmed first registration or an installation scene's end; explanatory navigation and reading are dismissal.

The dashboard owns meaningful anchor registration and First Vision/consent/ceremony blocking. Automatic presentation is limited to the actual first-site invitation, Journey summary and inline first-installation receipt; former contextual explanation IDs remain valid in the v1 ledger but their dashboard emitters cannot claim or fabricate viewed/completed receipts. Components do not find anchors through CSS selectors. Protected presentation admission is checked against the protection owner's read-only `readPresentationBusy()` seam before claim and renewal. The busy read validates the canonical session record without reconciliation, settings mutations or a second intervention lease.

`DashboardPresentationAdmission` publishes the Dashboard's accepted foreground,
boot and exclusive-presentation admission. Guidance consumes only
`contextualPresentationAllowed`: a denied admission prevents new claims,
releases the current claim and fences a late claim reply through the existing
presentation admission check. The shared seam owns no eligibility, receipt,
usage fact, animation timer or sound cue. First Vision and ordinary ceremonies
keep their own exact-frame and completion contracts.

`DashboardGuidanceProvider` numbers each owner read locally. Only the latest
admitted reply may replace visible guidance state or clear a current error;
late older success and failure replies are superseded. Unmount fences every
outstanding reply. This sequence is UI read admission, not a second ledger.

`JourneyProgress` owns the shared journey explanation and its details/summary interaction. Canonical guidance stays on Main: non-Zen Home uses the bounded, wrapping action row with first-site registration, and Zen uses the Main-owned corner. In a development Zen landscape dashboard, `DashboardLayout` declares the left HUD's availability through the presentation-only `JourneyProgressDockContext`. Preview guidance appears only inside that HUD's expanded progression panel beside the 0–5 day, full-access, replay and live controls. The Main preview does not register an anchor or acknowledge paint while docked; closing the panel leaves no hidden preview anchor. Layouts without the dock retain the Main explanation. No placement state grants access or writes progression.

After a successful development command, `progressionUnlockDebugClient` validates and commits the returned disclosure snapshot, then emits the existing `notifyGuidanceStateChanged()` UI invalidation. Guidance rereads its background owner so the explanation follows the selected day without requiring navigation or reload. Rejected commands and malformed snapshots do not publish the invalidation. HUD status distinguishes full access, journey preview and canonical use, and retained snapshots cannot hide a command/query failure. Appearance time changes lighting only; it is independent of qualified-use progression and real pressure observations.

Every progression query/command from Dashboard uses
`progressionRequestClient.requestDashboardProgression()`: it captures the
existing page profile-generation lease and validates the current lease and
response generation before accepting the ACK. Clients with downstream awaits
reuse `assertDashboardProgressionGeneration()` before final presentation handoff.
The background `ProgressionService.onCommitted` observer emits the exact
`{ type: PROGRESSION_STATE_CHANGED, profileGeneration }` invalidation after
durable or development-session writes settle, outside its serialized queue.
The event carries no grants, usage values or authoritative state.

The shared artifact disclosure resource owns one reference-counted listener per
Dashboard document. A matching-generation event supersedes older pending reads;
visible documents query the canonical owner and hidden documents defer IO until
normal reentry. Guidance independently rereads its own owner for that event.
Immediate command ACKs still commit through the resource before the local
guidance invalidation. The session owner's strictly increasing
`developmentProjection.updatedAtMs`, together with the durable owner's strictly
increasing `stateUpdatedAtMs`, prevents an older cross-document ACK/read from
replacing a newer accepted projection; the original command ACK remains its
receipt. First-bloom ACKs rehydrate the owner snapshot instead of reconstructing
an opened DTO locally. Named post-mutation refresh follows an explicitly
superseding canonical read while the captured profile generation remains
admitted; ordinary query failures and generation changes remain terminal.
A replaced profile generation remains blocked until the
existing runtime handoff reloads a fresh page, so its resource cannot be rebound
to a new generation. No invalidation payload, cached projection or guidance receipt can
grant access or earn usage.

An anchor can declare `presentation: 'anchor'` when its owning interaction renders the explanation in place. `useGuidancePresenter(guideId)` exposes only that guide's current claim and claim-bound paint, dismiss and complete callbacks; it does not create another claim or receipt. The provider does not also render a contextual card for an anchor presentation. Zen's first-site hint belongs to the pond, acknowledges its actual visible painted frame, and completes only after the canonical registration acknowledgement. Hiding the hint while editing does not invent dismissal or completion. A route carrying a site-registration intent may enter the editor without ever presenting a hint; that path fabricates no viewed receipt.

`useGuidanceInteraction` registers transient document interaction admission. The site-registration interaction suppresses unrelated automatic explanations and retains an already-owned `garden.first_site` claim while editing, so its completion can follow the real settings acknowledgement. Other active explanations release their claims, including when an unrelated claim resolves after editing has started. Interaction registration carries no persistent viewed state and disappears with its owning component. Hidden documents, First Vision/consent blocking and tab changes retain the provider's existing release policy.

Visible-frame ACKs and completion revalidate First Vision, family entitlement and real protection admission. Installation claims bind the accepted canonical global goal; changing that goal or turning Flare OFF preempts the scene before a later ACK can consume a receipt.

`src/apps/shared/guidance/guidanceClient.js` binds its first accepted profile generation for the page lifetime. Later reads and callbacks cannot silently bind to a reset/import generation. A stale page must reload through the existing profile mutation lifecycle.

## Persistence

`src/platform/storage/guidance/GuidanceRepository.js` exposes two typed stores. `GuidanceStateStore` initializes the absent `guidance_state` document explicitly and strictly validates every subsequent read. It retains at most the fixed catalog's receipts, one installation fact/intent, the highest presented journey stage and the latest notification delivery. `GuidanceSessionStore` owns `guidance_presentation_session`, one bounded claim and development preview state.

Both surfaces are registered in `storageSurfaceRegistry.js`. Guide state is excluded from export/import, preserved on analytics reset and settings import, and cleared in full reset's drained durable wave. Claims carry the profile generation and cannot survive reset/import admission. Session loss does not erase canonical viewed receipts. Changing a development preview day resets only its session receipts and claim; canonical viewed stages are never consumed.

## Installation

Time boundaries are edited only in Sites; its global-goal command commits only `globalGoal`. Tools exposes one Furin ON/OFF control whose command commits only `nudgeConfig`, preserving the latest canonical nudge document. Neither command emits a new installation intent or commits the other setting. The independent installation form, installation action and public manual-replay entry are retired. Failed writes and propagation retain the existing settings command feedback and recovery owner.

The durable v1 installation ledger and trusted service methods remain intact for already-recorded facts and unfinished intents. `recordFurinInstallation` still requires the complete global-goal/Flare acknowledgement and current canonical matches; the UI cutover does not relax that contract or synthesize an ACK.

Worker startup reconciles an unfinished intent once against current settings. Matching settings create `configuration_reconciled` evidence with no invented settings version or historical commit timestamp. A changed configuration retires that intent. Pre-existing/imported valid Flare configuration initializes `existing_configuration` without an automatic receipt or ceremony. The original installation fact is separate from current ON/OFF and goal settings.

Automatic pending presentation requires the original installed goal to remain current. The retained service replay DTO projects the current canonical positive goal while Flare remains ON and available; it is not a claim that usage is being recorded or an intervention is armed. No shipping dashboard control invokes replay. Replay semantics never rewrite the original installation fact.

An existing pending installation presents only the neutral saved-settings fact inside a registered, visible Sites goal/Furin feedback host. `FurinInstallationReceipt` is absent after the pending receipt settles, even while the service retains replay eligibility. The Tools feedback host registers only while Tools is the active dashboard tab, so a retained hidden panel cannot replace the Sites anchor. `useInlineGuidanceReceipt` acknowledges two committed visible frames and settles that explanation as dismissed, never completed. An absent/offscreen host defers presentation without navigation or a fake receipt. The provider and inline paint hook observe registered anchors through `guidanceAnchorVisibility.js`: viewport or nested scroll-owner re-entry reevaluates admission without polling or React state changes. Bounded anchor-ancestry attribute observation and animation/transition-end events also cover tab-entry opacity changes; only a changed visibility boolean publishes a revision, never every animation style update. CSS-hidden/transparent anchors and clipped scroll descendants cannot acknowledge paint. Leaving visibility cancels pending paint; re-entry requires two fresh visible frames. Re-entry while release is pending waits for the previous lease's ACK and canonical state refresh before admission is reevaluated. Hidden documents cannot acknowledge paint. Its claim retains the existing goal, Flare, protection and profile-generation admission checks.

The nine-second theme installation presentation remains only in the development visual harness, with no shipping automatic or manual entry. It acknowledges visible paint, supports local keyboard exit and reduced motion, pauses while hidden and requests sound only after an explicit local opt-in gesture. Preview consumes no first-installation fact/receipt, usage, progression days, friction outcomes, nudge results or actual Furin delivery receipts. Main retains its existing current/first_vision scene kinds.

Journey stage changes appear in the existing summary and acknowledge only its visible painted frames. They require no automatic card, full-screen glow or close action. Journey shows the current notification opt-in state and routes changes to Settings; the Journey and base cap-alert preferences remain independent. Guidance failures render at the local artifact/support reading position, never in a fixed global alert box.

## Journey notifications

Only newly recorded canonical qualified days can nominate an alert within the
artifact schedule (currently stages 2–5). Journey receipts, claim/delivery days
and notification bounds consume that schedule's own horizon. Development
session `previewDay` is a safe nonnegative raw qualified-day identity and may
exceed the artifact horizon independently. NotificationService owns permission,
configured opt-in, copy and typed Main routing. Guidance reserves the latest
stage/activity-day delivery before dispatch; known outcomes become sent or
skipped. An interrupted reservation becomes `delivery_uncertain` on
initialization and is never automatically resent. A stage already presented on
dashboard suppresses delivery. Migration, import, development projection and
duplicate/stale activity days do not issue catch-up alerts.

Journey alerts have their own explicit opt-in, independent of the base cap-alert switch. Enabling them preserves base and session preferences; notification permission remains required.

`MESSAGE_TYPES.PROGRESSION_STATE_CHANGED` is the progression commit invalidation
for every relevant durable/session mutation, including an actual qualified day.
Surfaces reread through trusted generation-bound queries. Guidance UI invalidation
remains an independent local read trigger. Observer failure is diagnosed without
rolling back already committed progression or tracked activity.

Detached qualified-day follow-up holds the existing profile-mutation runtime admission lease through invalidation and notification settlement. Closing ingress and draining that owner prevents optional follow-up from crossing reset/import generation boundaries.

## Verification

`tests/guidanceService.test.js` covers one-host claims, frame/dismiss ordering, protection preemption, complete installation ACKs, restart reconciliation, session-only preview, stale profile callbacks and durable stage delivery. `tests/dashboardGuidanceAnchorPresentation.test.jsx` covers anchor-owned paint, retained editing claims, completion ordering and stale presenter callbacks. `tests/furinToolsControlFlow.test.jsx` covers canonical recording-aware time connections, independent ON/OFF persistence and precise continuation routes; `tests/furinInstallationReceipt.test.jsx` covers retained-hidden-host admission, pending-only display and visible paint/dismiss ordering. Installation preview and surface tests cover keyboard/lifecycle behavior. Storage and background architecture guards retain their existing raw-access and composition boundaries.
