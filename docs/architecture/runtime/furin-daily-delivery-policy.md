# Furin daily delivery policy

- Status: Active
- Owner: protection dispatch / nudge session lifecycle / platform storage
- Last validated against code: 2026-10-13
- Path policy: current-only
- Canonical for: Furin daily presentation caps, full/brief delivery, scoped Site-goal ends and actual-display receipts

## Product contract

Settings Protection owns independent Site and Global reminder preferences in
the exact `nudgeConfig.goalEnds: { site, global }` shape. Stored `enabled` is
retired and rejects without conversion or rewriting. Only merged runtime
configuration derives aggregate activation. Presets cannot enable an OFF scope
or hide an enabled scope. Existing global/family pause remains a separate,
visible override; Tools displays the same policy and links to its editor.

Candidate construction filters by the corresponding preference before choosing
or combining goals. A disabled Site cannot earn coverage or a daily receipt
through a Global reminder. Periodic priority observes only enabled, actually
eligible scopes. Policy signatures bind only covered-scope preferences: changing
an unrelated Global choice preserves a valid Site episode, while changing a
covered choice cancels the whole pending combined episode through its existing
owner. The passive goal-end summary reports scope-specific disabled reasons.

The first automatic Site Furin presentation in an activity-day is full, across all
protected hosts. Each later host that reaches its own Site goal receives one brief
ritual with the existing continue/leave choice. Re-entering that same host does
not repeat its Furin during the day. The Site and Global budget conditions remain
separate; rapid tab switching is not a new obligation.

Site attainment requires the current host's admitted activity-day recording.
Global attainment uses the independent canonical recorded Global total whenever
`resolveSitesRecordingPolicy().globalCapAvailable` is true. Excluding the current
host does not erase Global time supplied by other admitted protected hosts.
`ProtectionRuntimeInputAssembler` preserves the canonical cap for that case;
its Site time/session stays unavailable, and the protocol projection applies
its own per-host recording admission to Site targets. Dispatch, binding
validation and `goalEndSummary` read that same Global cap rather than rebuilding
a second total.

Global Furin has its own full presentation once per activity-day. It covers only
the Global goal unless the same episode explicitly conveys the current host's
already-attained, unserved Site goal. Such a combined display records the actual
Global presentation and that host's Site-goal end; it does not fabricate a Site
Furin presentation. Other hosts and later Site goals remain eligible. A Site
Furin after an actual Global display uses the brief form, even if no Site full
has yet been shown. `getNudgeGateState().shown` for a host means its exact Site
end was delivered, rather than suppression merely because Global was shown.

For new selection, reached and unserved Global precedes reached and unserved
Site. Nearness to Global never substitutes for attainment. Once Global has been
delivered it is removed from selection; remaining over that goal cannot absorb
a later Site end. Existing attached or displayed ordinary ownership is retained,
with the shared admission recovery and fresh-boundary rules. No missed periodic
work is queued behind a goal. The public periodic control remains Barrier's
Consumption interval, independent of these daily Site/Global caps.

Actual display consumes the daily opportunity, even if the user then leaves,
switches tabs, or closes the document before choosing. The outcome remains
aborted; it does not become a resolved choice/ACK. A failed or cancelled start
before display does not consume the cap. Manual QA bypasses these production
receipts and never changes them. Shared admission, exact document ownership,
mandatory preemption and common recovery retain their existing contracts.

## Owners and execution

| Concern | Owner | Authority |
| --- | --- | --- |
| Current activity-day and goal evidence | `ProtectionRuntimeInputProvider`, `TrackingProtectionService`, `ProtectionNudgeDispatchContext` | Existing activity-day date/reset-hour and distinct Site/Global targets |
| Candidate selection and exact goal binding | `ProtectionNudgeDispatchContext`, `ProtectionNudgeDispatchRunner`, `goalEpisodeBinding.js` | Actual-attainment candidates, daily-cap filtering and immutable current policy/day/covered-scope binding; no early Global substitution |
| Daily decision and receipt writer | `src/domains/nudge/runtime/session/furinDailyPolicy.js` | Full/brief choice and one atomic actual-presentation/site-end write; no timer/cache/second lane or session-shown conversion |
| Issued delivery | `nudgeSessionDispatchState.beginNudgeRun` | Rechecks the latest receipt under the session lock and stores `pending.deliveryForm`; competing uncompleted full candidates cannot both be issued |
| Owned boundary wait | `nudgeSessionDispatchState.markNudgeEntryWaiting` | Exact same-run/tab accepted `entry_waiting` ACK admits the existing pending phase; no shown receipt, choice or transport-deadline expiry; actual paint or exact cancellation ends it |
| Typed transport | `ProtectionNudgeDispatchMessageBuilder` | Copies issued `deliveryForm` into `payload.config`; scope/variant remain separate |
| Delivery vocabulary | `sentinelFlareDeliveryForm.js` | Exact `full` / `brief`; input-boundary default is full, malformed present values fail |
| Actual presentation | `src/domains/tracking/background/nudgeManagerPresentationState.js` -> `markNudgePresented` | Exact authorized production run commits the durable receipt, then session `presented`; no choice ACK |
| Departure | `nudgeManagerAbortKeyState`, `nudgeManagerAbortTabState` | Exact abort/outbox remains; a shown run does not create/re-create debt |
| Durable storage | `FurinDailyReceiptRepository` -> `FurinDailyReceiptStore` | Registered Chrome-local key `nudge.daily_receipt`; no raw feature storage or session/history fallback |
| Full profile reset | `BackgroundMaintenanceCoordinator` | Drained profile mutation clears the receipt through the same nudge lock; analytics reset preserves it |

The normal sequence is current usage -> source readiness -> daily decision and
issued run -> safe entry preparation -> shared admission -> required Horizon
encounter/fresh continuation on a qualified feed, or an exact prepared
new-content action on a declared non-feed screen -> actual rendered host ->
durable presentation receipt -> user choice or departure. Barrier interval OFF
does not remove the Furin feed prelude. Primary-media contexts without exact
semantic completion proof remain unsupported rather than using generic
pause/ended as permission; see [Feed-flow runtime](feed-flow-runtime-target-architecture.md).
There is no queued full/brief replay or new deadline timer.

An accepted `entry_waiting` dispatch ACK records only the existing session's
owned wait. It may outlive the short dispatch timeout while the current item is
read, and worker restart retains its exact run/tab owner. Attachment and actual
Horizon encounter are not Furin presentation and cannot consume the daily cap
or absorb a Site cause. Actual host paint still invokes `markNudgePresented`.
Only the exact covered scopes of that displayed run may receive a Site end.
Prelude-only departure stays unserved under the existing unshown abort/debt
policy. A policy/day change invalidates its old goal binding and cannot create
a final receipt from attachment, encounter or dispatch acceptance.

## Persistence and version boundary

The exact V2 record is `{ version: 2, dateStr, fullSite, global, sites, siteEnds }`.
It retains only the latest receipted activity-day and at most 1024 entries in
each host map. Exceeding the bound is an explicit error; hosts are not evicted
to create repeat permission.
The next day's first presentation replaces the old day. A prior-day late callback
cannot overwrite a newer day and fails explicitly. Run keys retain their original
activity-day; stale callbacks do not silently acquire a new day's permission.

`global`, `sites[host]` and `fullSite` retain exact actual-Furin presentation
evidence with `source: 'actual_presentation'`. Site entries carry `deliveryForm`;
`fullSite` also carries `hostname` and identifies the one actual Site full
opportunity. Global choosing brief for later Sites does not create `fullSite`.

Each `siteEnds[host]` is exactly `{ runId, presentedAt, renderer, scopes }`.
The admitted renderer/scope pairs are `site_furin` with `['site']`,
`combined_global_furin` with `['global', 'site']`, and the P2-ready
`budget_horizon` with `['site']`. The latter is a storage vocabulary, not a
currently implemented Horizon-only delivery route. An actual Site Furin writes
both `sites[host]` and its matching `siteEnds[host]` in one typed commit. A combined
Global writes `global` and its matching Site end in one commit and leaves
`sites[host]` untouched. Validation requires matching run/timestamp evidence for
these Furin renderers and rejects fabricated, mismatched or duplicate full facts.

Receipt state is a durable presentation
cap, distinct from in-flight pending/lease, debt, outcome ACK and the terminal
outbox in session storage. It is excluded from export/import, preserves browser
and worker restarts, and is cleared by full profile reset.

An absent row stays absent until the first actual-presentation write creates
the current V2 day. Reads and dispatch do not import session shown markers,
synthesize receipts, or stamp predecessor pending shapes. A present V1 row
rejects with `FURIN_DAILY_RECEIPT_VERSION_UNSUPPORTED:1` and remains untouched.
Its former Global-wide suppression cannot prove scoped Site delivery. Use the
explicit [development-profile reset](../../operations/runbooks/pre-release-development-profile-reset.md)
for an incompatible development profile; no automatic transition or wipe exists.
The [storage versioning policy](../storage/storage-versioning-and-migration-policy.md)
governs a future public data transition.

Durable presentation commits before the session presentation patch. If the latter
fails, the actual display remains capped after restart and the exact pending run
can still terminate; it does not become a user ACK. A failed durable write reports
failure and does not advance session presentation. An unavoidable process loss
between the actual rendered surface and its first delivered receipt cannot be
proved from persistence; daily correctness is based on acknowledged actual-display
evidence, not a claim of atomic DOM/storage transactions.

## Verification

`furinDailyPolicy.test.js` and `furinDailyReceiptContract.test.js` protect actual
start/presentation/abort owners, manual rejection, cross-site full/brief caps,
scoped Global coverage, exact combined evidence, worker/session loss, day
rollover, late callbacks, write failures and incompatible-presence rejection.
Dispatch runner/message tests protect actual-attainment selection, issued
identity and scope transport; concurrency tests retain stale-owner and outbox
contracts. Maintenance tests protect full-reset clearing and analytics-reset
preservation. These deterministic lifecycle contracts do not certify real-site
support, user efficacy, or whether two genuine nearby goals feel sufficiently
different; the cooling proposal retains that separate experience review.
