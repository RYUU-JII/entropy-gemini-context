# Sites And Schedule Boundary Map

- Status: Active
- Owner: dashboard sites/schedule, settings command, stats read models, background protection runtime
- Last validated against code: 2026-10-11
- Path policy: current-only
- Canonical for: Sites tab mutation/read-model ownership, Schedule recurring relaxation/isolation editing, isolation sessions, and runtime schedule evaluation
- Companion to:
  - `docs/product/dashboard/sites-tab-prd.md`
  - `docs/architecture/repository/settings-command-boundary-map.md`
  - `docs/architecture/repository/storage-stats-tracking-boundary-map.md`
  - `docs/domains/stats/stats-engine-baseline.md`

## Purpose

`tabs/sites/SitesTab.jsx` is the route adapter for app-owned
`workspaces/sites/SitesManagementSurface.jsx`. Zen's Garden embeds the same
surface in its left work area; policy/query/command owners are unchanged.
The friction architecture guard checks recommendation snapshot/role admission in
`SitesManagementSurface`, while `SitesTab` retains route delegation and the same
prohibition on route-supplied target authority. Both files are required guard inputs.
Standalone Sites unmounts with only its presentation ref surviving. Once admitted,
Zen's embedded sheet keeps its DOM and drafts within the retained Garden host;
closing or leaving Garden sets both presentation and runtime activity false.
Existing parked store projections preserve its closing frame, query owners stop
observing/refreshing while inactive, and reactivation reads canonical state.
No additional business DTO cache is introduced. The ledger keeps remembered
selection but disables selected-detail demand. Notebook reading without a
registration editor enables detail demand for that domain. Root readiness admits
`SitesRegistry`; `SitesNotebookTarget.jsx` owns the declared `sites-notebook-target`
local code boundary and its retry/loading/error state, without replacing Garden
or the ledger. Zen's combined-cap utility occupies that same left work area
without changing ledger/notebook selection or admitting selected-detail IO.
Normal paper-edge entry sends explicit `{ view: 'ledger' }` and overrides a
remembered notebook or utility before admitting detail IO. A domain intent opens
that domain's notebook. Unconsumed explicit domain/add/ledger intents suspend
remembered selected-detail demand and that render's registry reconciliation until
route consumption establishes the intended workspace. Consumption updates local
presentation state even when a domain is reselected, so detail admission resumes
without waiting for another data update. Whole-sheet drag closure preserves drafts.
The dashboard navigation owner registers Sites above Garden: inner controls own
their first Escape, then Back unwinds utility/notebook to ledger and ledger to
Pond. Nonempty search clears first; empty search permits the next Back. Pending
registration/cap saves and release commits consume Back without dismissing their
accepted operation. Mouse button 3 follows that same scoped chain once per
pointer/mouse/auxclick sequence; button 4 remains blocked.
Default data preparation requests a snapshot only; an explicit
preferred domain admits targeted detail through the same cache/in-flight owner.

Sites is the canonical dashboard surface (`sites`, `SitesTab`); Zen displays
길목 / Pathways. The naming owner is the dashboard launch/loading naming
contract. Site-policy rules and `settings.rules` remain settings-domain terms,
not alternate names for this tab.

Sites and Schedule meet at the same protocol surface, but they must not become
two parallel ways to infer policy truth. Sites owns site lists, site goals,
presets, and read-only usage intelligence. Schedule owns two day-rhythm pages
that share one visible 24-hour time-window timeline, plus the entry surface for
a single isolation session. Protection runtime owns the final runtime decision.

The base protection policy is always the baseline. A schedule window selects
the relaxed profile for enabled adaptive filters; it never changes protected
domain membership. Video fullscreen additionally suspends Lens visual effects
in that window when its independent preference is ON. Target exhaustion prevents
both relaxations (friction-filter-injection-architecture §3.5).
Isolation is the only session that changes scope: saved and
temporary allowed sites remain open, while every other web page is redirected
to the extension-owned gate page before any content-script permission check.

The practical reading question is:

```text
Can a dashboard intent become canonical settings state,
and can the runtime/read-model layers consume it without legacy repair paths?
```

## System Flow

Sites mutation flow:

```text
SitesTab / useSitesController
  -> useSitesMutations
  -> useProtocolStore typed command
  -> ProtocolSettingsCommandService owner command
  -> SettingsCommandService runtime action
  -> SettingsService.applySettingsChange
  -> SettingsDocumentRepository
  -> settings cache / propagation / protection broadcast
```

Sites read-model flow:

```text
useSitesController
  -> useSitesPolicySnapshot
  -> shared sitesPolicySnapshotResource / useSitesSnapshot
  -> GET_SITES_SNAPSHOT
  -> statsAnalysisQueryService.getSitesSnapshot()
  -> statsSitesSnapshotReadModel.buildSitesSnapshot()
  -> useSitesSnapshotViewModel
  -> siteRegistry + globalExposureAverage + analysis-tier siteIntels + scoreSetup DTO
```

Before the first policy-matching snapshot arrives, `globalExposureAverage` is
`null` and Sites retains its loading surface. A failed initial query presents
the retryable Sites error surface. Once admitted, `SitesManagementSurface` retains
the `workspaceAdmitted` frame-lifetime boolean while a policy change withdraws the
current snapshot. `SitesWorkspace` may retain context-scoped measured height
numbers as a pending presentation footprint. The surface owns readiness and scroll
offsets, suppresses recording native clamp events until the current snapshot and
selected reading are ready, then restores the reading position. Neither retains
snapshot payloads, policy values or cached analysis. Only a canonical snapshot may supply the
average's date window/reset-hour metadata; the view model must not manufacture
an empty business average while the query is pending.

The completed-window owner `sitesCompletedActivityDays.js` projects the last
seven completed reset-hour activity days once. `statsSitesSnapshotReadModel`
shares those projections with `sitesGlobalExposureAverageReadModel` and
`statsSitesRegistryReadModel`. The registry adds `averageWindow` metadata and
per-entry `usageAverage` (average/total, site observation count, status); it unions
historical-only domains without changing candidate or classification logic.
See the stats baseline for missing-record semantics.

Zen's minimal presentation consumes these same owners. `ZenSiteUsageReading`
is selected by the Zen target widget through the shared workspace's explicit
reading-component slot; other themes keep the shared analytical reading.
`SitesWorkspace` owns the unframed reading placement,
`SitesNotebookHeader` owns the identity line, and application-side
`ZenSiteProtectionToggle` delegates to `SitesTab`'s existing commands/release guard.
`ZenSiteBudgetNote` consumes registry `protectionBudget.remainingMs/overMs` only
when recording and the positive saved cap are admitted. It never subtracts
observed usage from a goal. Registry activity-day usage/charge and selected-detail
completed-calendar-day pattern facts remain separate DTO scopes. In-notebook evidence,
basis disclosures and selected-value readouts own presentation state only; they do
not create storage, query or policy owners.

The Zen selected notebook reads inside one bounded canvas. `ZenSiteUsageReading`
validates `longTermPatterns` and `todayNotes` through `SiteIntelBoundary`;
`ZenSiteLedgerAnnotations` formats the producer's ordered admitted patterns,
available earlier/recent change and first-day terminal today facts. Early pooled
counts name all observed dates rather than active dates. `ZenSiteLedgerField`
projects 24 hourly values per completed date, their observed-only average and a
separate calendar-day today row. It does not classify, rank or infer intervals.
Missing dates, recorded zero and unfinished today keep distinct marks. The overview,
annotation evidence, selected day and basis replace one another in the same body
region rather than extending a document. Annotation and date pagination use the
measured body height and their actual content heights; they do not reduce the
type or silently clip a record to fit. Selecting an annotation changes evidence
on this same surface; `ZenSiteDaySlip` replaces it with the selected date's supplied
facts. Annotation entry anchors the most recent supplied matching date (today for
terminal notes, latest completed-session date for early facts, and the first
observed recent-half date for comparison); its title remains the reading context.
Direct daily-record entry clears that context. The day starts with its total,
completed-session count and longest session together. Session buckets and hourly
quantities are explicitly opened subviews, not a fixed sequence of fact pages.
The hourly subview has one native 0–23 range selector and a persistent exact
quantity readout; the 24 cells describe activity, not session start/end times.
Only essential summary blocks that exceed the measured body are paginated;
a single summary page has no pager. Date-scoped subview, item anchor and selected
hour are UI intent retained across guide, query refresh and policy remount.
Escape closes the current level and restores its originating focus. The
app-owned `notebookNavigation` ref admits that same one-level Back operation to
the existing dashboard navigation owner, fenced by the selected domain and active
notebook. The app toolbar, Escape and mouse Back share save-lock, editor-cancel,
inner-reading and registry ordering. A selected cap exposes only its cancel/lock
operation through a domain-fenced `navigationRef`. Explicit Back cancellation
returns focus to the visible cap trigger while preserving focus outside that
request and never focusing the hidden/inert overview; hidden overview mounting still
preserves its draft, applied ACK and completion timer. The embedded reading does
not duplicate that toolbar Back. It retains presentation intent only, without a query or storage owner. Other
themes retain the shared analytical Summary/Evidence reading.

Zen alone opts into `SitesWorkspace`'s existing registry/selected-pane spread;
narrow widths hide its retained registry while a domain is selected. Back returns
to that same registry instead of stacking it above the reading. Registry query,
selected-detail demand and cap commands
keep their current owners. The loaded today headline and row share the calendar-day
basis; the cap separately states its reset-hour activity day. A pending independent
registry usage snapshot remains explicitly labelled with that different basis.
The fixed Garden canopy and bounded Sites canvas share the immutable full-history
horizontal reading exclusion. The field, slip and click targets remain inside
that width on every page; no blank spacer or smaller bonsai supplies that safety.
The existing anchored site-cap form measures this ink width and the canvas bounds,
then clamps its complete form within them without moving the retained trigger or
changing draft, focus, validation or command ownership. No live-clock marker is manufactured
without a canonical query timestamp. The declared wide/low/narrow notebook
reachability contract measures actual visible bounds and overflow, including
every bounded detail page and complete cap controls. The visual target and explicit P3 differences are recorded in
`docs/architecture/themes/zen/zen-site-ledger-detail-plan.md` §9. P4 removes the
disconnected reading/graph implementation, isolated helpers and unused locale
keys after shared and other-theme consumer checks; it adds no runtime seam.

The public shared `useSitesRegistryModel` owns ledger query/management/sort
presentation state, scope/search interactions, registration callback dispatch and
the stable comparison projection. `StandardSiteRegistryPanel` consumes it for the
shared row presentation; `ZenRegistryPanel` consumes the same model through
`src/themes/core/widgets/shared/sites/index.js` for its own Zen ledger DOM and
`zenRegistryPanel.css`. The hook checks the registry shape, policy fingerprint
and activity-day usage basis; current-policy admission, settings commands and
detail queries remain app owned. Both presentations reuse `SitesRegistryList`
and `SitesRegistryRow` for bounded rendering, selected-row accessibility and
viewport-admitted favicon enrichment. Explicit search, scope, management or sort
changes start a new rendering budget; membership and ordering refreshes within
the same context preserve already admitted batches. The presentation ref retains
only the batch count and its explicit query context across policy withdrawal or
standalone remount. Neither owns a registration form or time
input. Search Enter selects a matching existing row; a new valid domain requires
the visible registration action and then notebook form confirmation. Isolation
allowances use a separate ledger management view. Zen places period/reset-hour
basis and management actions in disclosures instead of permanent ledger bands.
The registry's `policyControl` slot receives the app-owned combined-cap trigger;
it creates no cap editor or command owner. `SitesTab` remains the controlled
selection/scope and ledger/notebook presentation owner; ordering is shared
through `sortSitesRegistryDomains`. Explicit row selection or a site route opens
the notebook; the default entry remains the ledger without selecting its first row.
Protected registration follows the shared progression-owned
`site_registration_journey_v1` projection. A fresh profile with no managed rules
or first-registration milestone keeps Sites navigation hidden. The canonical first-registration
milestone keeps management available after the last protected site is removed;
an existing allowance may expose management without granting that milestone,
while observation alone grants neither. A development full
access projection grants visibility without writing a release milestone.

The actual first protected registration stays with Main's canonical first-use
experience and progression-owned capacity. Once Sites management is visible,
the ledger Add button, search candidate and explicit `{ add: true }` request open
one selected notebook. `SitesRegistrationEditor` confirms only the address and
membership; it does not generate a time goal. Time is edited afterward through
the existing site/global cap editor. Canonical commands still enforce capacity;
the former five-site/five-day presentation route must not send a visible Sites
workspace back through Main. Isolation allowances use the same notebook composer.

`SitesTab` consumes explicit route requests once. Returning to the ledger does
not reopen a consumed request, and opening a notebook issues no registration
command. Cancel retains the address draft. `MainPanel` supplies an app-lifetime
presentation ref for selected notebook, scroll position, measured loading
footprints, registry search/sort/admitted batch count and domain-keyed drafts.
Domain-scoped notebook intent also retains the Zen annotation focus, selected date,
active body, return body and page anchors, and the other themes' shared Evidence page/metric ID. The shared
`SiteDecisionWorkspace` optional `presentationState` prop passes only that intent
to its reading component and shared reading, without caching snapshot/detail DTOs.
Zen captures a one-use hourly-input focus request only when that native range
owns focus as admitted contents withdraw. The same domain, observed date, hour and
hours body must still be selected on remount, and focus must be vacant; otherwise
the request expires. External controls retain focus. Explicit notebook navigation
owns its focus transfer; mounting a day slip alone does not focus its section.
Tab exit releases runtime controllers and DTO subscriptions;
the ref contains no canonical settings or analysis mirror. Missing journey owner state admits no protected
registration: initial management retains an explicit loading/error/retry surface;
an already admitted management frame retains goal/release editors, withdraws the
journey DTO, disables protected Add and exposes the owner retry state.

`useSiteRegistrationJourney` projects hydrated protocol membership and the shared
artifact-disclosure query's canonical registration milestones. The query resource
deduplicates membership-change invalidation through
`revalidateArtifactDisclosureForRegistrationPolicy`, fences reads admitted before
a settings ACK, and refreshes the monotonic milestone after add/remove. Its
membership fingerprint is only a query identity, never a business-data mirror.
Policy refusal remains authoritative and withdraws the rejected DTO. Explicit
retry first refreshes settings through `syncExternalProtocolSettings`, then asks
the strict current-policy query again. When a joined analysis read has queued a
new policy, the resource validates the final exact policy fingerprint and semantic
revision commit instead of mistaking the superseded request's return for
failure. A sequence-fenced Sites supersession receipt can admit one strict
replacement read only while a current active reader remains. Other failures,
parked readers and policy refusals do not use that path. Snapshot failure has one in-flow retry area; cap/detail panes do not
repeat it. Sites mounts `SettingsCommandFeedbackBridge` for protocol command
receipts, keeping persisted settings distinct from runtime propagation failure.
Sites disables only the bridge's save-failure presentation: address/cap forms,
the release guard and recording/protection workspace feedback own those failures.
Their lightweight presentation state retains local pending/error results when
a tab leaves during a command, without retaining query DTOs or runtime subscriptions.
Application busy/failure/timeout and propagation retry remain in the bridge.
Registry protection membership comes only from canonical blocked rules; a goal
or preset may expand recording scope without turning a row into a protected rule.

The presentation comparison stays stable during polling while a site is selected;
no presentation snapshot becomes a new business-data or storage owner.
The selected full-detail projection depends on that detail's own inputs, so a
lightweight registry refresh does not rebuild the retained analysis before the
replacement detail arrives. The independent recorded-usage readout still uses
the latest policy-matching registry snapshot.

Notebook placement is presentation owned: `SitesWorkspaceHeader` puts Back beside
the compact combined-cap readout in the toolbar; `SitesNotebookHeader` owns the
single selected identity (Zen pairs its favicon/domain with protection and recording
controls; other themes retain the site switcher). The shared workspace's `siteCap`
slot owns the canonical site editor outside the conditional analytics/policy body.
Zen's app-owned `SitesCapPresentationSlot` places one stable portal host in its
usage readout or, during snapshot withdrawal, in the existing policy band. The
editor and form keep the same React owner and portal target while admission
changes to `loading/error`; no old statistics DTO is retained. This preserves the
draft, in-flight applied ACK and success timer through policy reload. Zen uses
a compact limit/budget readout beside current usage; other themes retain the shared policy
band beneath the identity. Recording-disabled domains keep a quiet saved-cap inspection
band above their policy-only body, without repeating the body's mark or actions.
These placements do not change command, recording-admission or cap authority.

The shared reading groups the admitted sentence and its measurements in one flow.
Named current/reference comparison rows use aligned labels, number/unit pairs and
a common zero-based scale; narrow layouts put each bar below its own value.
The hourly field exposes its evidence/context relationship and exploration help
beside the range/coverage caption, then replaces that help with the selected hour's
exact value. Independent snapshot usage and its collection basis remain supporting
facts after the shared reading. Zen's ledger headline and today row use the same
calendar-day facts; the saved cap separately names its reset-hour activity day.
Completed rows and annotations consume `longTermPatterns` from the full
selected-detail query: exactly 30 completed calendar dates, excluding today.
Recorded zero is included in observed-date means and missing is excluded; change
requires at least seven observed dates in each exact 15-date half. First-day
annotations consume the terminal `todayNotes` DTO in producer order. Selecting
an annotation changes the existing field's row/hour emphasis and criterion value;
selecting a date opens its supplied facts in `ZenSiteDaySlip`. Period and coverage
remain available, with basis metadata on its own bounded page. `ZenSiteLedgerGlyph`
supplies shared annotation/gutter marks and `zenSiteLedgerFormat` owns their date,
duration, share and same-calendar-date window formatting. No separate analytical
reading is mounted inside the Zen ledger.
The shared protection mark remains presentational; Zen's minimal notebook does
not render it. The shared mark imports no app, platform or theme-plugin owner.

Sites global-cap presentation flow:

```text
theme manifest profile.sites.globalCapVariant
  -> SitesTab strict presentation-policy admission
  -> SitesHud shared cap/editor model
  -> other themes: SitesCapControl inline readout -> numeric input + Apply/Cancel
  -> Zen: ZenSitesGlobalCapTrigger -> SitesWorkspace utilityPane
       -> one retained SitesHud presentation="workspace"
       -> SitesCapControl direct numeric form + Apply/Cancel
  -> completed-day average and its basis disclosed in the same editor flow
  -> typed globalGoal command on explicit apply only
```

`SitesManagementSurface` owns `globalCapOpen`, focus/scroll restoration and the
app-owned `ZenSitesGlobalCapTrigger`. `SitesWorkspace.utilityOpen/utilityPane`
shows `#zen-sites-global-cap` in the same left canvas while retaining the ledger
and notebook subtrees. This is a normal-flow utility surface, without a portal
or dialog. The single `SitesHud` stays mounted there through open/close and
snapshot withdrawal; opening enters the shared form directly rather than
mounting a second editor or expanding the ledger toolbar. Its
`presentation="workspace"`, `isPresented` and `onRequestClose` contract controls
placement and Cancel/applied closure only. Shared draft, save/ACK settlement and
`ready/loading/error` admission still belong to the existing cap owners.
The utility withdraws notebook detail demand and parks notebook target/site-cap
runtime work; opening it requests no chart or full selected-detail data. Global
scope remains the combined recorded protected-sites usage, including the
canonical exclusions, rather than all registry entries.

selected-domain detail flow:

The selected panel also reads `siteRegistry.byDomain[selectedDomain]` and
`siteRegistry.averageWindow` directly from the policy-matching snapshot for its
independent recorded-usage readout (`SiteObservedUsage`). Current activity-day
usage and the completed-day recorded average remain visible during detail
loading, query failure, unclassified analysis and interpretation render failure.
They never substitute for calendar-day analysis inputs or establish a behavioral
claim. Missing average evidence stays collecting; recording-disabled entries
remain policy-only. The detail panel owns query diagnostics and retry, including
retained-detail refresh errors; the normal-flow workspace status region owns
snapshot and mutation errors. Sites mutations do not emit global toasts.

```text
SitesTab selectedDomain
  -> useSitesSiteDetail / shared sitesSiteDetailResource
  -> GET_SITES_SITE_DETAIL
  -> statsAnalysisQueryService.getSitesSiteDetail()
  -> canonical statsRange day.transitionEdges + intervention-effect range
  -> statsSitesSiteDetailReadModel.buildSitesSiteDetail()
  -> one canonical managed-domain full intel DTO
```

Sites post-first-frame preload flow:

```text
loadingPolicy: sites-snapshot
  -> registry-owned dynamic preloadSitesTabData loader
  -> hydrated canonical protocol policy
  -> shared sitesPolicySnapshotResource
  -> AbortSignal admission after the awaited snapshot and before detail IO
  -> explicit route preferredDomain only (ordinary ledger preparation stops here)
  -> shared sitesSiteDetailResource
  -> response revision mismatch: response-key cache prewarm + exact snapshot refresh
  -> later Sites hooks join the same in-flight promise or completed cache
```

Safe site-rule release flow:

```text
selected policy row -> inline impact review -> useSitesReleaseGuard eight-second grace
  -> cancel: no settings mutation
  -> deadline: useSitesMutations.handleRemove() exactly once
  -> typed protocol command -> canonical settings mutation
```

Schedule editing flow:

```text
ScheduleTab readiness shell
  -> ready only: ScheduleTabReadyContent / useScheduleController
  -> primitive resetHour subscription + stable controller handlers
  -> ScheduleRhythmWorkspace selects today's initial day-group page
  -> day-group bookmarks identify Mon-Fri and Sat-Sun rhythm membership
  -> one TimelineTrack renders and creates windows for the selected page
  -> ScheduleBlockWorkbench edits the selected window without changing layout
  -> scheduleModel normalize/edit helpers
  -> useProtocolStore.setSchedule()
  -> protocolStoreHelpers.buildScheduleSettingsPatch()
  -> relaxationSchedule
  -> SettingsService.applySettingsChange
```

Schedule presentation-policy flow:

```text
ScheduleTab keeps semantic/edit/interaction ownership
  -> getScheduleVisualPolicy(canonicalThemeId)
  -> strict plugin manifest lookup
  -> required per-plugin scheduleVisualPolicy
  -> recipes + typography + tokens + timeline
  -> shared Schedule DOM interprets the declared recipe
```

Schedule runtime flow:

```text
settings cache relaxationSchedule
  -> blockingPolicy.normalizeRelaxationSchedule()
  -> schedulePlan.resolveActiveScheduleWindow()
  -> blockingPolicy.isRelaxationScheduleActive()
  -> ProtectionRuntimeInputAssembler.isScheduleRelaxationActive
  -> TrackingProtectionService schedule_relaxation intent (relaxed named profile)
```

Isolation flow:

```text
Schedule isolation action
  -> loadingPolicy: schedule-special-session named action boundary
  -> shared inline workbench slot (recurring / run once)
  -> lazy ScheduleSpecialSessionWorkspace
  -> useSpecialSessionController + allowedUrls subscription
  -> ScheduleSpecialSessionPanel
or popup
  -> useAppliedScheduleRuntime + specialSessionClient commands
  -> scheduleRuntimeCoordinator serial application
  -> specialSessionRuntime manual input (chrome.storage.session) / recurring plan
  -> scheduleRuntimePolicy / ProtectionScopeResolver allowlist scope
  -> gateInterventionPayload isolation instruction
  -> GateInterstitialController tabs.update(gate.html)
  -> content permission gate is not reached for redirected pages
```

## Owner Table

| Concern | Owner | Key files | Output | Forbidden shortcut |
| --- | --- | --- | --- | --- |
| Rules UI orchestration | dashboard Sites workspace | `SitesTab.jsx`, `src/apps/dashboard/workspaces/sites/SitesManagementSurface.jsx`, `SitesNotebookTarget.jsx`, `SitesWorkspace.jsx`, `SitesWorkspaceHeader.jsx`, `useSitesController.js`, `tabs/sites/controller/*.js` | route adapter and shared readiness shell first; app-owned ledger/notebook mode and controlled selection; notebook-only target readiness/detail demand; retained subtrees and row focus on Back; `isPresented` owns exit DOM while `isRuntimeActive` owns query/timer admission | mounting rules queries before tab readiness, leaving Rules IO active during exit, a widget-local second navigation owner, direct storage writes, or stats reconstruction in UI |
| Sites global-cap presentation | dashboard Sites HUD and app-owned placement | `SitesManagementSurface.jsx`, `SitesWorkspace.jsx`, `ZenSitesGlobalCapTrigger.jsx`, `SitesHud.jsx`, `SitesCapControl.jsx`, `useSitesGlobalCapEditor.js`, `sitesGlobalCapModel.js` | other themes retain the inline readout/editor; Zen's small app-owned trigger opens one retained direct-entry workspace form in the same left canvas; shared draft/save/admission owners and separately named usage/average scopes; recorded protected-sites combined scope | theme-specific business logic in cap widgets, duplicate HUD/editor instances, floating editors or rails, selected-detail IO for the utility, UI reconstruction of average evidence, empty input saving as no limit, dirty-draft timeout discard, or making reinforcement selectable |
| Sites cap data admission and frame continuity | dashboard Sites shared cap controls | `SitesTab.jsx`, `sitesCapAdmission.js`, `SitesHud.jsx`, `SitesSiteCap.jsx`, `SitesCapControl.jsx`, `useSitesCapEditor.js` | frame-only lifetime retention; required `ready/loading/error` admission; current canonical membership and saved goals; focus-preserving read-only input during loading; disabled input on error/recording denial/save lock; exact current DTOs before new mutations; in-flight applied ACK and focus settlement | retaining withdrawn DTOs, inventing recording/cap availability, treating missing evidence as zero, remounting a cap on policy fingerprint changes, or using query admission as `isRuntimeActive` |
| Rules shared widgets | theme shared rules seam | `src/themes/core/widgets/shared/sites/index.js`, `useSitesRegistryModel.js`, `SitesRegistryList.jsx` | public registry interaction model and widgets/helpers; shared query/sort/management state, stable comparison and registration intents; bounded rows with viewport favicon enrichment and selected-row accessibility; `SitesProtectionMark`, grouped readings and common-scale comparisons | theme-local duplicate interaction/comparison owners, deep imports into shared widget internals from external callers, queries/commands in the registry model, interpreting the visual mark as policy/severity truth, or eager favicon reads for offscreen rows |
| Rules theme entrypoints | each canonical theme plugin | `src/themes/plugins/<themeId>/manifest.js` plus plugin-owned Sites wrappers; Zen's `ZenRegistryPanel.jsx`, `zenRegistryPanel.css` | explicit `SitesRegistry` and `SitesTargetPanel` loaders; Zen owns its ledger DOM over the public shared registry model while other wrappers retain the standard presentation | a missing theme widget or another theme used as fallback, theme-owned settings/query authority, or a second comparison/sort implementation |
| Sites mutation | protocol store commands | `useProtocolStore.js`, `protocolStoreHelpers.js`, `ProtocolSettingsCommandService.js` | owner-specific site-rule/preset command result | generic multi-key patch assembled in component code |
| Rules registry read model | stats rules snapshot | `statsSitesSnapshotReadModel.js`, `sitesGlobalExposureAverageReadModel.js`, `statsSitesRegistryReadModel.js`, `sitesGlobalExposureAverageContract.js` | complete cheap `siteRegistry`, activity-day exposure, explicit observed-average evidence, bounded analysis-tier site intel, score setup | UI inferring raw versus charged meaning from generic maps or collapsing missing evidence into zero |
| Selected site detail read model | stats selected-detail query | `sitesSiteDetailContracts.js`, `statsSitesSiteDetailQueryService.js`, `statsSitesSiteDetailReadModel.js`, `statsSiteIntelReadModel.js` | one managed-root full intel/evidence DTO plus canonical `siteDetailRevision`, cached by semantic facts runtime epoch/revision plus policy/cycle identity | building every domain's full detail, issuing a version-zero request, or keying cache validity to wall-clock/range object identity |
| Recurring site-time evidence | stats selected-detail read model | `statsSiteRecurringTimeEvidence.js`, attached by `statsSiteIntelReadModel.js` | explicit completed-day recurring-window DTO with named unavailable states | UI inference from today's buckets, seven-day sums, or weekday labels |
| Selected detail refresh state | dashboard Rules query controller | `useSitesPolicySnapshot.js`, `useSitesSiteDetail.js`, `useSitesController.js`, `SitesTab.jsx` | same-domain stale-while-revalidate state, coalesced stats refresh, typed snapshot/detail errors, exact-revision mismatch admission, and retry | committing a newer detail into an older snapshot, clearing matching full detail on every stats event, retry only by remount, or adding a second mirror cache |
| Sites snapshot prewarm | dashboard Sites data resource | `preloadSitesTabData.js`, `sitesPolicySnapshotResource.js`, `sitesSiteDetailResource.js` | after Main first frame, canonical snapshot plus explicit route detail only; exact cache/in-flight state is shared with Sites hooks; AbortSignal is checked before work and again after snapshot before detail IO | adding Sites data to the critical boot snapshot, starting unrequested detail or detail after a released warmup signal, running before protocol/analysis hydration, or maintaining a warmup-only cache |
| Site-rule release intent | dashboard Sites controller | `useSitesReleaseGuard.js`, `SitesTab.jsx`, `SiteReleaseControl.jsx`, `ZenSiteProtectionToggle.jsx` | inline impact review beside the selected policy, then confirmed cancellable grace intent before canonical remove | list-row immediate removal, floating confirmation, hidden countdown commit or partial re-add undo |
| Schedule edit model | dashboard schedule model/controller | `scheduleModel.js`, `useScheduleController.js` | normalized recurring relaxation DTO plus draft/commit selection state | component-local time-window truth, strengthen modes, or stringified equality copies |
| Schedule semantic and interaction surface | dashboard Schedule app | `ScheduleTab.jsx`, `ScheduleRhythmWorkspace.jsx`, `TimelineTrack.jsx`, `ScheduleBlockWorkbench.jsx`, `scheduleModel.js` | ready-only recurring-relaxation tree, draft/edit state, frame-coalesced pointer preview, accessibility, and command intent | mounting editors/effects before tab readiness, broad store subscriptions, plugin-owned semantics, or theme-id branches |
| Schedule visual policy | each canonical theme plugin through the strict core resolver | `src/themes/core/scheduleVisualPolicy.js`, `src/themes/core/schedule/policyContract.js`, `src/themes/plugins/<themeId>/scheduleVisualPolicy.js`, plugin manifests | required pure-data recipes, typography, visual tokens, texture blend, and timeline paint for the shared Schedule DOM | app-local all-theme map, executable render callback, plugin deep import, missing-policy fallback, or Zen as default |
| Special session surface | dashboard/popup special-session clients | `ScheduleSpecialSessionWorkspace.jsx`, `useSpecialSessionController.js`, `ScheduleSpecialSessionPanel.jsx`, `specialSessionClient.js` | one applied manual or recurring isolation state; dashboard controller/panel load only inside the named user action in the timeline's inline workbench slot; visible action errors | importing the session controller/panel into the base Schedule graph, floating dialog/anchor ownership, or reintroducing separate focus/strengthen session modes |
| Schedule persistence adapter | protocol store helper | `protocolStoreHelpers.buildScheduleSettingsPatch()` | one `relaxationSchedule` plan; configured activity is derived from `blocks.length > 0` | UI writing storage keys directly or persisting a second enabled flag |
| Schedule runtime evaluation | schedule temporal policy | `scheduleRuntimePolicy.js`, `schedulePlan.js`, `ProtectionScopeResolver.js` | one mode/source/occurrence for relaxation attenuation and isolation allowlist scope | independent clocks in UI, input assembly, or indicator policy |
| Applied temporal state | schedule runtime coordinator | `scheduleRuntimeCoordinator.js`, `scheduleRuntimeState.js`, `useAppliedScheduleRuntime.js` | serialized settings/manual/clock application; dispatcher-confirmed receipts and UI subscription | reporting a draft as applied, reading the receipt as policy input, or mutating a stale session identity |
| Global cap reinforcement | protection runtime decision | `protectionRuntimeDecision.js`, `TrackingProtectionService.js`, `EnvelopeAdapter.js` | exhausted global goal produces a protected reinforcement intent; named reinforced profiles cannot be relaxed by schedule/fullscreen, while user OFF stays OFF | persisted/selectable overflow policy, hidden extra strength bands, close action, scope mutation, or force-enabling an inactive filter |
| Schedule intensity projection | tracking protection service | `ProtectionRuntimeInputAssembler.js`, `TrackingProtectionService.js`, `frictionModifierResolver.js` | ephemeral `schedule_relaxation` filter-level modifier | persisting derived modifier state or weakening gesture gates |
| Isolation redirect | protection gate owner | `gateInterventionPayload.js`, `GateInterstitialController.js`, `ProtectionDispatcher.js` | extension gate redirect held until session end | injecting scripts into domains that lack host consent |
| Background schedule cache | background settings cache | `settingsCacheState.js` | normalized cache schedule mirror for runtime readers | read-time legacy fallback from old schedule keys |

## Function Ledger

| Boundary function | Input | Output | Failure / missing-data policy |
| --- | --- | --- | --- |
| `useSitesController.handleAdd()` | domain and target type | admission-aware save result | permission denial and save failure return explicit error states |
| `useSitesController.handleConfirmMove()` | domain plus from/to side | move result | missing move or save failure is caller-visible |
| `useSitesController.handleGlobalGoalChange()` | global goal minutes | one typed settings update for `globalGoal` | canonical write failures remain caller-visible; the HUD keeps its draft open |
| `buildSitesGlobalCapViewModel()` | protected exposure, explicit average-evidence DTO, committed or preview goal | neutral goal/average facts and fixed eight-hour average ratio for the shared presentation model; the current editor uses numeric entry and separately labelled evidence | missing or malformed evidence fails explicitly; no goal remains an explicit off state |
| `useSitesRegistryModel()` | admitted registry/recording DTOs, policy fingerprint, controlled selection/scope and presentation ref | query/management/sort state, filtered canonical ordering, stable comparison and app callback intents shared by Standard and Zen | malformed registry, fingerprint or observed-usage basis fails explicitly; no settings writes, detail queries or new admission authority |
| `useAnalysisStore.refreshSitesSnapshot()` | optional current policy input | background rules snapshot DTO | failed or invalid runtime response sets `analysisError`; no UI-side repair or fresh-state mark |
| `buildSitesSnapshot()` | stats range, cycle, policy | compact rules registry DTO | raw observed and charged protection values remain separately named; no evidence read on this light path |
| `buildSitesSiteDetail()` | selected domain, canonical facts range, policy, explicit intervention-effect range | one full-detail site DTO | transition edges come only from `statsRange.dates[*].transitionEdges`; invalid/excluded domains and malformed/missing evidence fail with coded errors |
| Rules detail query cache | canonical facts range plus selected-domain/policy/cycle context | cached/in-flight detail keyed by `readModel.runtimeEpoch` plus `readModel.runtimeRevision` | physical rereads of unchanged facts retain the cache; missing epoch/revision, worker-lifetime change, or real stats invalidation fails/invalidates explicitly |
| `sitesSiteDetailResource` revision admission | requested snapshot revision plus background response revision | matching detail, or a typed mismatch after caching only under the response revision | a mismatched response never resolves to the old caller; the exact old snapshot is marked stale and refreshed, while the response-key cache is reused after coherence is restored |
| `buildSitesSiteRecurringTimeEvidence()` | exact completed-day projections for one selected domain | versioned recurring-window DTO | current partial day is excluded; weak, sparse, or single-day-dominated evidence returns a named unavailable state |
| `useSitesSiteDetail()` | selected domain plus canonical `siteDetailRevision` | waits without IO until the revision exists; then cold loading or retained same-domain detail during revalidation; active-to-inactive parking retains the outgoing presentation without IO | initial inactive mount is idle, domain change clears detail, and same-domain refresh failure retains detail with an explicit retry action |
| `preloadSitesTabData()` | hydrated policy, optional preferred domain, optional AbortSignal | coherent snapshot/detail prewarm sharing the mounted hooks' resources | invalid/aborted signals fail explicitly; abort after snapshot prevents second-stage detail IO; one revision mismatch refresh is admitted and retried without an unbounded loop |
| `useSitesReleaseGuard()` | confirmed domain/type removal intent | grace/committing/failed UI state | canonical remove is not called before the deadline; cancel/unmount leaves settings unchanged |
| `normalizeSchedule()` | dashboard editable schedule | release V1 relaxation plan and did-change flag | invalid edit blocks are rejected before persistence |
| `areSchedulesEqual()` | schedule draft/current values | structural equality | avoids component-local JSON serialization semantics |
| `getScheduleVisualPolicy()` | canonical theme id | selected plugin manifest's frozen Schedule visual policy | missing or mismatched policy throws `SCHEDULE_VISUAL_POLICY_REQUIRED:<themeId>`; no theme substitution |
| `resolveScheduleRecipeVariant()` | recipe axis, declared variant, exhaustive case map | one app-owned visual/layout interpretation | a missing current/future variant throws `SCHEDULE_RECIPE_VARIANT_UNHANDLED`; undeclared or unsupported cases fail explicitly |
| `buildScheduleSettingsPatch()` | editable schedule DTO | canonical settings patch | emits only current storage keys |
| `ScheduleSpecialSessionPanel` | runtime session state, busy state, action error | visible isolation start/end/temporary-allow controls | owner errors must surface detail instead of a generic failed state only |
| `ScheduleTabReadyContent` | ready tab, route params, canonical theme | editor, timeline, and special-session subscriptions | never mounts while tab hydration/readiness is loading or failed |
| `normalizeRelaxationSchedule()` | stored relaxation schedule | normalized runtime schedule | the stored plan is the only schedule truth; an empty `blocks` array means no configured schedule |
| `resolveActiveScheduleWindow()` | recurring schedule plan and timestamp | active recurring relaxation occurrence | day ownership comes from each window's canonical day set |
| `isRelaxationScheduleActive()` | persisted schedule and timestamp | current schedule-relaxation boolean | no enabled input exists; empty plans resolve inactive |
| `resolveGateInterventionInstruction()` | runtime snapshot, host, timestamp | isolation or artifact gate instruction | isolation instruction is emitted before content permission evaluation |
| `releaseIsolationSessions()` | optional host and timestamp | released gate-session count | session end releases all isolation gates; temporary allow releases matching-host gates |

## Recovery Versus Fallback

| Class | Allowed? | Rule |
| --- | --- | --- |
| Schedule storage shape adapter | Yes | release V1 defines the physical persisted schedule contract. Every window has `intent: relaxation`; the physical key name does not define product behavior. |
| Previous schedule schema | No | release V1 has no settings-cache conversion or old-mode read path. |
| Input-boundary normalization | UI edit only | UI drafts may be normalized before commit; stored/cache-hydrated records must match the exact current contract. |
| Sites snapshot cache | Yes | cache keys include policy fingerprint, cycle/rhythm-day context, stats range identity, and TTL. |
| Sites evidence empty values | Yes | an observed canonical stats day may contain an exact empty `transitionEdges` map, and the explicit intervention-effect range may be empty. Missing stats days remain unobserved; malformed maps or missing intervention evidence fail. |
| Sites read-model null fields | Yes | missing projections may surface as null/empty DTO fields, but the UI must not rebuild them from raw facts. |
| Deep shared rules import | No | external callers use `@/themes/core/widgets/shared/sites/index.js`. |
| Duplicate schedule evaluator | No | time-window runtime checks go through `blockingPolicy` and `schedulePlan`; retired `isFrictionTime` style helpers must stay deleted. |
| Missing Schedule visual policy | No fallback | Every canonical plugin manifest declares one; the strict resolver never borrows Zen or another theme. |
| Schedule app-local cross-theme palette/profile map | No | The app consumes the resolved policy and must not enumerate all canonical themes or branch on `themeId === zen`. |
| Schedule-owned scope switch | No | recurring schedule windows keep the base blocklist/allowlist scope unchanged. |
| Isolation content injection | No | disallowed isolation hosts are redirected through `tabs.update` before scripting/host permission checks. |
| UI-owned storage patch | No | schedule and rules writes go through typed store/command seams. |
| Read-time repair | No | previous or malformed schedule/rules shapes are rejected rather than repaired or interpreted as fallback truth. |
| Special-session owner failure | No fallback | failed start/end/temporary-allow actions must keep the runtime owner error visible on the panel. |

## Current Findings

### F1. Rules shared seam is closed

Status: keep.

Rules shared presentation imports use the public
`@/themes/core/widgets/shared/sites/index.js` seam. CI also scans external
callers so `TargetBehaviorProfile.js` and sibling internals do not become public
entrypoints again.

### F2. Rules read model is named and one-way

Status: keep.

`buildSitesSnapshot()` owns the compact Rules registry DTO. The tab receives
`siteRegistry`, charged exposure, bounded analysis-tier `siteIntels`, and score setup
without rebuilding them from dashboard-local raw stats. Full evidence is owned
by `GET_SITES_SITE_DETAIL` for the selected managed root only. Its transition
index is built from the full canonical stats range before usage projection is
scoped to owned domains, so unrelated global top-K traffic cannot erase a
selected site's edge and external endpoints remain available for scope filtering.

### F3. Schedule activity has one persisted truth

Status: fixed in the 2026-07-13 SSOT pass.

The persisted shape is one `relaxationSchedule` plan. Configured activity is
defined exclusively by whether its canonical `blocks` array is non-empty, and
current relaxation activity is resolved from those blocks plus the timestamp.
There is no persisted/cache/runtime enabled flag. A `scheduleActive` field may
appear only as an outgoing UI/indicator read-model projection derived from the
same plan; it is never accepted as schedule input or stored as independent
state.

### F4. Retired schedule runtime evaluator removed

Status: fixed in the 2026-06-29 re-audit.

`isFrictionTime()` was an unused broad-lib helper with partial schedule
semantics. It has been deleted so future runtime code has one active schedule
evaluation path: `blockingPolicy -> schedulePlan`.

### F5. Schedule draft comparison is model-owned

Status: fixed in the 2026-06-29 re-audit.

`useScheduleController` and `TimelineTrack` no longer keep duplicated
`JSON.stringify()` schedule comparisons. They share `areSchedulesEqual()` from
the schedule model, which makes draft/commit equality part of the schedule edit
contract rather than component-local behavior.

### F6. Special-session panel surfaces owner error detail

Status: fixed in the 2026-06-30 special-session panel pass.

`ScheduleSpecialSessionPanel` already received the hook-owned runtime error, but
rendered only a generic failed state. The panel now keeps the generic headline
while also rendering the owner error message/code, so failed start/end/session
allow actions are diagnosable from the schedule surface.

### F7. Schedule is one timeline viewed through two day-rhythm pages

Status: fixed in the 2026-07-13 single-timeline pass.

The workspace keeps Mon-Fri and Sat-Sun as two exhaustive data groups, but only
the selected group owns the single visible 24-hour timeline. The group that
contains today is the initial page. Its actual day labels are page bookmarks;
weekday/weekend names are not separate editing modes. Empty time means base
protection and each visible window means one-step relaxation. Page selection is
presentation-only and is not persisted. The time-centered workbench sits directly
below the timeline in the same scrollable stage. Its reserved height is unchanged
between idle and selected states; selection never moves the timeline. Day-label
movement between the groups remains a future interaction and is not part of
this pass.

The shared DOM and semantic contract remain app-owned. Every canonical theme
plugin declares a required `scheduleVisualPolicy` containing its recipes,
typography, tokens, texture blend, and timeline paint as frozen data; the core
resolver retrieves that policy strictly from the selected manifest. Recipe
consumers resolve every declared variant exhaustively, so adding a third recipe
cannot silently inherit one of the existing two implementations. Recipes may
change layout and paint, but they never remove headings, counts, guidance,
accessible names, or state descriptions from the semantic DOM. The Schedule
subtree does not maintain an all-theme palette map, compare the theme id with
Zen, execute plugin callbacks during render, or substitute Zen when a declaration
is missing. A future theme that genuinely needs a different DOM hierarchy must
introduce a separate named Schedule surface capability consuming the app-owned
view model and actions. That future capability must not widen the visual policy
or move recurrence/edit/persistence semantics into the plugin.

Zen projects that contract through an internal section-cut time-field visual
language. One flat time stage owns the day-group bookmarks, ruler, and timeline
and provides a deliberate content apron plus thin horizontal seams. Explanatory
prose does not overlay the ruler or time field; the adjacent workbench owns its
editing guidance. Within the timeline, the
content panel is the lighter top plane, a narrow dark upper occlusion and thin
lower reflected edge expose the cut, and the single darker/cooler time-of-day
field sits below them. The field is not enclosed by a four-sided border; thin,
asymmetric end-depth marks may expose the section cut, but substantial side
walls, rounded wells, bevels, and inset boxes are outside this grammar. The
deep time field remains one flat declared surface; its low-opacity paper texture
uses the Zen plugin's validated multiply blend and does not become a second
gradient paint path. Relaxation windows do not add another raised plane; they
modulate the full height of that same field with a clearly readable flat
translucent sage. While the selected day group holds no window at all, the
field carries one raked-sand relief beneath the windows and inline add action: karesansui
furrows drawn as lit and shaded edge pairs rather than as single lines, sized in
fixed pixels so the sweep does not stretch with the field. The workspace owns a
transient random seed; resizing regenerates the continuous sweep without changing
that seed, and editing never rerolls it. Empty-state 4-hour measure seams ease back.
The relief may not be seigaiha, however
close the two sit: seigaiha is the Lethe / memory-purge signature and has to keep
meaning one thing. The guide is an
empty-state invitation only: the add action disappears the moment one window exists,
while the sand remains and the seams return to full weight. Selection and the current instant are measurement annotations expressed
by precise brass selection edges and a muted current-time line with a small dot.
The current-time label occupies the upper apron; the current protection status
stays beside the day bookmarks. The time ruler sits below the field. A single
duration caption interrupts the selected interval's dimension line between field
and ruler. Reset-hour wrapped windows retain two dimension segments and their
actual start/end edges, with the caption on the longest segment.
The `attached_paper` workbench recipe creates an opaque warm paper plane with a
thin enclosing border, up to 400 CSS pixels wide. Its center follows the longest
visible segment and clamps to the field edges. A leader continues from the
dimension line through the ruler to the paper's upper seam; when a live interval
moves beyond a frozen paper, a short horizontal jog keeps that connection exact.
Placement and sand geometry use layout CSS pixels before dashboard scaling;
pointer-to-clock mapping continues to use the rendered track bounds.
Focus anywhere inside the paper freezes placement, including Tab between clocks,
name, modes and folded settings. Leaving the whole editor releases the anchor.
Selection changes ease into position; direct dragging has no positional easing.
The first line contains exclusive mode controls, editable name, conditional undo,
delete and a named details control. Large start/end clocks remain below. On narrow
screens undo/delete flank the clocks with separate hit targets. Accessible field
names remain permanent without duplicate visible clock or duration labels.
Details expand in document flow inside the same border. They expose one per-window
alert switch and, for isolation, a shared passing-site list plus a canonical Sites
navigation action. There is no popup, all-day shortcut, inherited-rule selector or
global alert control in this editor. Escape folds details and returns trigger focus.
Attached-paper, portrait and low-height stages keep their day bookmarks, timeline
and editor's top anchor fixed when details open or close. The time stage reserves
its scrollbar gutter so overflow cannot narrow or move those fields. The stylesheet
owns both default centering and these top-aligned variants; an inline alignment
must not override them. The existing dashboard capture Schedule journey waits for
the editor's own placement transition to settle, then measures all three anchors'
x/y positions and widths across an open/close cycle. Only editor height may grow.
New windows start with alerts off; opt-in fixes relaxation to end-only and isolation
to start/end. Existing explicit `auto` DTO values retain their canonical global
projection and show its actual rule until the user changes mode or the alert switch.
Idle and selected workbench states must remain distinguishable
by luminance and boundary contrast, not only by tiny opacity changes. This metaphor is presentation
only. Accessible names and visible control labels keep the canonical product
terms such as base protection, relaxation window, start time, end time,
duration, and all-day relaxation; they must not expose section, garden, shade,
or light metaphor names as settings concepts. Timeline windows remain one
keyboard control per canonical block even when reset-hour projection splits
one block into two visual segments. Pointer interaction keeps endpoint resize,
window-body move, and click selection as distinct gestures. Windows fill the entire
field height so their upper/lower areas cannot create a different window. Dragging
updates the editor and bridge without positional easing; feedback does not appear
before the movement threshold, and pointer cancellation clears only the interaction
draft, preserving a pending acknowledged settings write.

The editor commits start, end and name as one transaction on Enter or when focus
leaves the whole editor. Moving between its inputs does not write settings. Escape
restores the selected window. `editScheduleBlock` validates exact 10-minute clock
values, the 30-minute minimum and overlaps before publishing; it never substitutes
a nearby valid range. Invalid input remains visible with an accessible error.
Full-day intervals use the same enabled clocks (00:00–24:00), and validation cannot
remove overlapping windows. A one-step, non-expiring undo belongs
to `useScheduleController`; it restores the previous schedule and selection through
the existing `setSchedule` owner. This transient UI history and the presentation-only
`scheduleTimelineGeometry` projection and focus/placement hook create no new storage source of truth.

The experimental hourly-trace presentation, its projection model, phase-marker
contract, and former Zen inscription surface are retired. Reintroducing that
concept requires a new product decision and a newly owned data/presentation
contract; dead locale keys or unmounted models are not retained as placeholders.
The dashboard's localized tab object is the only route-copy source. The expanded
sidebar owns the visible route identity, so Zen Schedule does not repeat a
generic page header; its screen-reader heading uses the same tab title. When the
sidebar is icon-only or absent in portrait layout, the app surface exposes the
same tab navigation label as a small context mark instead of inventing an
alternate Schedule title or restoring a second full header. Themes whose recipe
keeps a page header also render that tab object's title and description.

### F8. Isolation is the only special session

Status: fixed in the 2026-07-10 isolation pass.

The former focus/strengthen split has been removed from the client, runtime
state, notification names, and popup/dashboard entry surfaces. Isolation uses
saved plus session-temporary allowed hosts. Other pages are redirected to the
existing gate interstitial and are released when the session ends or the host
is explicitly allowed for that session.

### F9. Rules enrichment follows visible work and stable facts identity

Status: fixed in the 2026-08-08 loading-cost pass.

The shared registry mounts favicon queries only when an item enters the viewport
or its 200px approach margin, using one shared observer. Offscreen rows retain an
immediate text placeholder and do not create individual IDB requests. Registry
arrays marked by the canonical ordering helper are reused instead of sorted a
second time by a theme wrapper. `useSitesRegistryModel` owns the common frozen
comparison: ordinary facts polling does not reorder or rescale a selected ledger;
membership, selection, comparison window, sort and policy changes establish a
new comparison. Zen's independent DOM consumes that projection rather than
implementing a second sorting or usage interpretation path.

The stats runtime creates one compact 128-bit epoch per service-worker lifetime
through browser cryptographic randomness and never persists it. The facts query
stamps every durable and derived range with that epoch plus the canonical numeric
runtime revision. Selected-site detail cache and in-flight identity use the pair
rather than the physical range object's identity, so a TTL reread of unchanged
facts does not evict valid detail, an actual stats mutation does, and a restarted
worker cannot collide with an older dashboard cache at the same numeric revision.
The snapshot then publishes one versioned `siteDetailRevision` combining that
facts revision with policy, insights, and cycle/activity-day identity. The
frontend resource, background query, and first-detail preloader all validate the
same field. A missing revision stays in a loading state without emitting a
version-zero detail request; `computedAtEpochMs` remains diagnostic/admission
metadata and is not cache identity.

Because the background intentionally evaluates detail against its current facts,
its response revision can advance past the caller's snapshot revision. The
frontend stores that response only under the returned revision and rejects the
old request with a typed mismatch; it never commits newer detail into the older
registry snapshot. Only when the current store still owns the exact requested
revision is that snapshot marked stale and admitted for immediate refresh. Once
the refreshed snapshot publishes the returned revision, the hook or preloader
reuses the already-warmed response cache without another detail runtime message.

Repeated `stats_committed` invalidations for the same policy are admitted at
most once per 60-second window with one trailing refresh. Cold or policy-mismatch
reads remain immediate. Snapshot and selected-detail failures retain any
matching evidence and expose separate retry actions. During stacked tab exit,
`isPresented` keeps the DOM and its last selected detail/runtime projection
available for motion while `isRuntimeActive` parks snapshot/detail reads,
runtime-insight messages, selection effects, and release timers immediately.
An initially inactive Rules mount remains idle and starts no IO.

Schedule follows the same presentation/runtime split. Its schedule controller,
notification projection, and reset-hour analysis projection retain the last active
values during exit without observing protocol/analysis store churn; interval,
keyboard, route-prompt, and Special Session effects remain runtime-active only.

The retained rule-diagnostic helpers share one suffix/alias index rather than
comparing every domain with every other rule. The current compact registry does
not project those extra diagnostic badges into rows; diagnostic matching and
policy engines are unchanged.

`SitesTab` also keeps the snapshot/detail controller outside its loading and
error shell. Widget/hydration preparation therefore no longer competes with the
rules snapshot request, registry projection, selection effects, and detail
controller in the first entry frame.

After Main first frame, `sites-snapshot` dynamically loads the Sites data
preloader. It prepares the canonical snapshot and only an explicitly route-selected
detail through the same resources consumed by the mounted tab.
Cold clicks join the existing promise; warm clicks read the completed bounded
cache. The scheduler's AbortSignal is validated before work and checked again
after snapshot completion, immediately before starting detail IO, so a forced or
degraded warmup release cannot begin the second phase. Protocol/analysis-not-ready,
invalid-signal, and aborted calls fail explicitly, and the critical boot snapshot
shape remains unchanged. Resource telemetry labels these calls as `source: boot`;
mounted hooks use `source: render`, so deferred prewarm IO is not charged to a
later navigation trace.

### F10. Schedule mounts and recomputes only ready interaction work

Status: fixed in the 2026-08-08 loading-cost pass.

`ScheduleTab` owns the readiness shell, and the editor/controller tree mounts
only in `ScheduleTabReadyContent` after the tab gate is ready. The isolation
controller, allowlist subscription, and panel remain outside that base graph and
load only when the policy-declared `schedule-special-session` action opens. The
ready tree subscribes to the primitive reset hour instead of the broad analysis
slice, keeps controller handlers and derived UI props stable, and memoizes the
workspace/timeline/workbench boundaries. Timeline hover geometry and candidate
projection are coalesced to one animation-frame callback rather than running on
every pointermove event.

## Re-Audit Checklist

- Run `npm run check:theme-shared-seams:architecture` after shared rules widget changes.
- Run `npm run test:file -- tests/sitesRegistryThemeContract.test.jsx tests/sitesRegistryOrdering.test.js tests/sitesRegistryList.scalability.test.jsx tests/sitesRegistryFavicon.enrichment.test.jsx` after shared registry-model extraction or theme ledger presentation changes. Protect search/selection/registration, retained comparison state, bounded rows and viewport favicon admission rather than identical theme DOM.
- Run `npm run test:file -- tests/sitesHud.test.jsx tests/sitesHudLoadingContract.test.jsx tests/sitesSiteCap.test.jsx tests/sitesWorkspaceFeedback.test.jsx tests/settingsCommandFeedbackRecovery.test.jsx` after cap placement changes. Cover one retained HUD, direct-entry utility form, draft/admission/ACK continuity, Cancel/applied closure and focus restoration as well as the unchanged inline mode.
- Check `dashboardSitesIntelJourney.mjs` notebook access/global-cap trigger probes and `dashboardSitesRecordingJourney.mjs` cap open/close helpers against both placements. Keep selected-detail IO, keyboard reachability and horizontal-overflow assertions; opening Zen's utility must not create a detail request.
- Run `npm run check:theme-seam-role-architecture` and `npm run test:file -- tests/themes/themeScheduleVisualPolicy.test.js` after Schedule visual-policy or plugin-manifest changes.
- Run `npm run check:stats:read-model-architecture` after Sites read-model or stats query changes.
- Run `npm run test:file -- tests/useSitesPolicySnapshot.test.jsx tests/useSitesSiteDetail.test.jsx tests/statsSitesSiteDetailQueryService.test.js tests/rulesRegistryFavicon.enrichment.test.jsx tests/sitesRegistryOrdering.test.js tests/siteRuleDiagnostics.test.js` after Rules cache, admission, or registry diagnostics changes.
- Run `npm run check:release-v1:baseline` after schedule persistence/cache/runtime contract changes.
- Run `npm run test:file -- tests/statsSitesSnapshotReadModel.test.js tests/protocolStoreSettingsSync.test.js tests/scheduleCore.test.js tests/scheduleModelMinDuration.test.js tests/scheduleRhythmWorkspaceContract.test.jsx` after Sites/Schedule protocol or runtime changes.
- Run `npm run test:file -- tests/scheduleSpecialSessionPanelContract.test.jsx tests/specialSessionPolicy.test.js tests/gateInterstitialBootstrap.test.js tests/protectionDispatcherPermissionGate.test.js` after isolation-session changes.
- Run `npm run test:file -- tests/useScheduleControllerCanonicalStore.test.jsx tests/scheduleRhythmWorkspaceContract.test.jsx tests/scheduleTimelineInteraction.test.jsx` after Schedule mount/subscription/interaction changes.
- Confirm `rg "\bisFrictionTime\b" src tests` stays empty.

### Sites workspace policy readouts and cap editors

`SitesWorkspace.jsx` projects the app-owned `ledger | notebook` presentation mode
onto the work surface; Zen binds registry and notebook into its existing spread.
Other themes keep the combined cap in the
compact page header. Zen's ledger passes one small `ZenSitesGlobalCapTrigger`
through the registry's `policyControl` slot; its notebook header presents the
same trigger role. Both open the dedicated utility in the same left canvas.
Global scope is explicitly recorded protected-sites combined, not all registry
entries. The notebook presents Back/site identity,
recorded usage, its theme's reading and site policy controls. Zen places protection
beside the domain, recording in its own row and the compact cap/budget line beside
current calendar-day usage. Other themes keep the shared policy band. Both use inline
impact review and local mutation feedback rather than floating menus.

`SitesTab` keeps the selected domain when returning to the ledger. Registry and
detail subtrees remain mounted while their presentation is hidden within Sites.
App-lifetime presentation state preserves selection, query/sort, scroll and
domain drafts when Sites itself unmounts; DTOs are readmitted by their owners. Back
restores the ledger's scroll position and selected row focus, or search focus when
that row is absent from the filtered list; an explicit site route opens the notebook
without replaying on later snapshot refreshes. Detail queries remain under the
existing selected-domain owner rather than a second visibility-based cache or
timer. The existing tab presentation/runtime admission split still parks work on
tab exit. Zen's selected notebook fits the existing canvas with measured pages;
annotations, hourly date rows, daily slips and reading criteria replace the visible
body inside the horizontal canopy exclusion. The overview subtree remains mounted
but hidden and inert while other bodies are visible. The app's stable selected-cap
portal also preserves the draft, ACK and success settlement when the conditional
reading is withdrawn for a policy query; the admission props still use current
`ready/loading/error` state. Today's summary and cap occupy the
first overview page. Narrow selected notebooks park the registry until Back.
Other themes retain their full-width notebook and shared Summary/Evidence reading.

`SitesCapControl` owns the shared numeric form. Its default `presentation="inline"`
retains readout/open state: opening replaces the value with its input and
Apply/Cancel, focuses the input and retains normal Tab order. In Zen's explicit
`presentation="workspace"`, the form is mounted once in the retained utility
pane and enters numeric editing when presented; the app owns the separate
trigger and pane visibility. `isPresented` does not become data admission or
command authority. `onRequestClose('cancel' | 'applied')` returns to the retained
ledger/notebook only after the shared editor's cancel or successful settlement.
Global average details expand in that form's flow. No portal, slider rail,
floating action strip or repeated goal editor is retained.

`useSitesCapEditor` continues to own drafts, locking, failure/retry and save
settling; `useSitesGlobalCapEditor` adapts the existing global command.
`SitesSiteCap` keys its editor by domain/membership, previews through
`resolveSiteGoalChange`, retains the requested minutes in its numeric draft,
and requires the command's applied value. Inline feedback previews the policy
projection without replacing that request. `useSitesMutations` submits the uncut request;
the site-rule command owner evaluates the thirty-minute increase cap against the
latest committed goal inside `SettingsService.commitSettingsMutation.prepare`,
for both goal updates and an existing rule's upsert. Decreases and first-time
goals retain their existing policy. Cross-window changes therefore affect the
owner's actual applied value rather than making a stale UI preview authoritative.
The editor never shrinks persisted values to a visual axis. Outside clicks and
blur do not dismiss or save; Cancel/Escape restores committed state. Successful
saves close and restore trigger focus only if the removed task held focus;
they preserve focus moved to another connected control. Failed ACKs retain the draft and Retry.
Global drafts survive selection changes; old local replies remain isolated.
The global editor remains page-level. Zen retains one `SitesHud` in
`SitesWorkspace.utilityPane` even while hidden; it does not move the same editor
between separately mounted header/utility trees. `globalCapOpen` changes neither
`workspaceMode` nor `selectedDomain`, and returning restores the invoking
surface's scroll/focus without pulling focus from another connected control or
from a hidden late ACK. While open, `useSitesController.detailEnabled` is false
and selected notebook runtime consumers are parked. The utility uses the cheap
snapshot's global exposure/average and canonical saved goal only. Returning to
the ledger hides the local
cap without committing or discarding its draft, closes inline recording review, and cancels a
pending release grace without changing canonical policy. Ledger scroll position is
restored alongside the selected row's focus.

`SitesWorkspaceNotices` occupies a normal-flow workspace status region with
retry/live announcements. Recording undo stays in its policy row. Cap failures stay beside their numeric draft;
registration/move errors stay in the composer or selected policy row. Sites does
not emit global mutation toasts. Guidance/Furin installation receipts and
snapshot/command feedback remain in this notices owner when Zen reduces the
ledger chrome or presents the cap utility; disclosures cannot hide these errors
or receipts.

Theme registry panels retain controlled selection/scope, canonical sorting and
bounded rendering. Matrix and Clinical now delegate to `StandardSiteRegistryPanel`,
as do the other non-Zen wrappers. Standard and Zen consume the public
`useSitesRegistryModel`; Zen owns its compact ledger composition and CSS rather
than inheriting the standard panel DOM. Both retain Average/Today/Name sorting,
the same search and selection semantics, bounded accessible rows and one
selected-notebook address composer. Zen's two-line header groups search/add/more
above scope and the numeric basis. Its basis disclosure owns sorting together
with completed activity-day period/reset-hour metadata; Name sorting retains
the selected average or Today measure and keeps that numeric basis visible.
This separately retained basis is Zen-only presentation intent. The more
disclosure contains the combined-cap entry, recording settings, exclusions and
isolation-allowance management. Rows place policy/recording state beside the
domain and align one fixed-width time column, without relative comparison bars
or repeated navigation chevrons. Protected scope omits the repeated visible
protection label while retaining its accessible meaning and recording, missing
evidence and pending-release exceptions. `SitesWorkspace` supplies
`--zen-ledger-inset` and `--zen-ledger-ink-width`: the latter is the usable
text/control width after the left inset, with the Garden's canonical canopy
occlusion removed. The standalone panel uses symmetric 24px viewport insets.
Only text, controls, click targets and focus stay inside that stable width;
row rules and paper hover/selection surfaces continue across the canvas. These
are presentation changes, not new recording or policy owners. Typing only filters;
Enter selects an existing result. A complete valid unregistered domain opens the
composer only through its visible protection action. Explicit form submission
includes the address and, for a move, its impact explanation and source type.
It never includes a goal draft. Isolation allowances use a separate ledger
management view and the same selected-notebook composer.
`SiteReleaseControl` owns inline review/grace presentation; Zen delegates protection
from its identity's explicit protection action to the same release guard. Recording exclusion has its
own labelled row and inline impact review with post-ACK undo.
Intel has no recommendation/actions. Duplicate
header goal editors are removed. Existing average DTO, protected-charge facts,
classification/recommendation engines and storage owners are unchanged.
Recording-disabled policy-only details own policy facts without an analytical
reading. Their selected identity owns the single recording-settings action and
retains the protection and recording controls, while the policy band remains
mounted with saved-cap inspection. The unavailable
cap editor shows the saved value with input and Apply disabled;
the band does not repeat the policy detail's protection mark, title or protect action.

### Recording admission and refresh continuity

Recording decisions have one domain owner:
`domains/settings/config/dataCollectionPolicy.js`. SettingsService supplies the
current committed policy; `sitesCurrentPolicy.js` validates dashboard policy
fingerprints against it. Site rows and selected detail publish strict
`recording` and `capAvailability` DTOs through `sitesRecordingContracts.js`.
The snapshot additionally publishes the aggregate recording scope. App/theme
components project these DTOs and never reconstruct admission from settings.

`statsSitesSnapshotReadModel` owns list membership and average projection.
`statsSitesSiteDetailQueryService` owns analysis admission: denied valid domains
return `mode: policy_only`, one canonical settings row and `intel: null` without
fact, cycle, transition or intervention evidence reads. Protected settings remain
in the list while denied historical-only entries do not reappear. Policy-only
presentation belongs to SitesTab's `SitesPolicyDetail`, outside theme analytics.

All UI exclusions use `setSiteRecordingExcluded` through protocol store commands.
Settings owns excluded-rule management and the disclosure deep link; a child
covered by an excluded parent opens management rather than silently removing a
different rule. Cap commands return acknowledged applied values. UI previews never
become command authority, and protection changes never clear recording exclusions.

`sitesPolicySnapshotResource` and `sitesSiteDetailResource` remain the only Sites
query caches. Their identity includes current policy/consent/preset/insight
semantics and domain/revision. A valid response racing a stats invalidation is
accepted while remaining stale for the next coalesced refresh. Recoverable detail
revision mismatch stays pending; it is not a transient user error.
Same-domain, exact-policy data remain visible during ordinary refresh/failure.
A policy change or `STATS_SITES_POLICY_CHANGED` immediately removes old analysis,
even before a delayed settings broadcast. No mirror cache or UI polling timer is added.

The existing analysis lifecycle drives refresh, with in-flight deduplication and
bounded selected-detail caching shared by prewarm and mounted hooks. SitesTab
projects controller status independently from data readiness, so a background
refresh cannot unmount a ready Intel or replace a focused cap draft. Explicit route
selection is consumed once; refreshed list arrays cannot replay an old route.
Nonvisual snapshot revision/computed-at attributes expose these canonical facts
for continuity QA, without becoming state or scheduling inputs.

The admitted Sites frame survives policy-fingerprint invalidation using only
`workspaceAdmitted`. Registry, analysis, recording, privacy and average DTOs still
withdraw immediately under their full current-policy query identity. Reading
areas show explicit loading or retryable error while absent; prior DTOs are not
kept for presentation. Canonical protocol membership and saved goal values retain
the selected cap keyed by domain/type, independently of those query payloads.

`sitesCapAdmission.js` owns the strict UI tuple matrix. A present current snapshot
with `ready`, `refreshing` or `refresh_error` yields `admissionStatus=ready`;
an absent snapshot with `loading` or `error` yields the matching admission status.
All other tuples throw `SITES_CAP_SNAPSHOT_ADMISSION_INVALID`. Every shared cap
requires one of `ready/loading/error`; unknown or omitted states throw
`SITES_CAP_ADMISSION_STATUS_INVALID`. Loading keeps the same numeric input
focusable with native `readOnly`, preserving its focused draft and caret while
Apply remains disabled. Readiness removes `readOnly` without refocusing or
selecting the input again; focus moved to another connected control stays there.
Error admission, recording denial and save locks use disabled input semantics.
All unavailable states preserve saved-cap inspection and editor drafts. Draft
mutation and Apply require ready admission plus the current validated recording
or cap-availability DTO. Missing availability never becomes permission to edit;
the command guard rejects it as `SITES_CAP_MUTATION_NOT_ADMITTED`.

An already-admitted save retains its actual applied ACK, saving/error/success
feedback and 420ms success settlement while query data reload. The live-tab
`isRuntimeActive` query/timer lifecycle remains separate from data admission, so
policy invalidation does not close the editor or discard its acknowledgement.


## Shared Intel reading consumer (2026-09-15)

SitesTab keeps the canonical selected detail and policy command owners.
SiteDecisionWorkspace wraps SiteIntelReadingSurface in SiteIntelBoundary; every
theme opts into that same composition. The previous independent Zen zones and
duplicate release/action assembly are removed. SitesRecordingActions in the selected
policy band reuses SiteReleaseControl. SitesWorkspaceNotices exposes pending release
Undo even with the menu closed. Confirmation, grace and late-response authority
stay in the existing controller/command owners. Recommendation-only tab assembly is retired.

siteIntelPresentation validates interpretation v3, formats the terminal-selected
IDs once and declares only presentation comparison relationships. Numeric values,
units, original fields, periods and provenance remain attached to formatted
measurements. There is no classifier, baseline calculation, IO, timer or storage
owner in this seam. No output is fed back to facts or personal baselines.

The existing detail resource retains admitted evidence during refresh. The
reading root, summary/evidence tabs and hourly controls are not keyed by revision or pattern.
Recording revocation still withdraws the old evidence. Rendering contract errors
are contained to Intel and remain diagnosable; fresh admitted profiles can recover.

App-owned `presentation/siteIntelViewState.js` admits only a recording-enabled,
ready selection into `buildTargetPanelViewModel`. A withdrawn snapshot or pending
detail must not pass its domain-only placeholder to the analytical projection.
Projection failures are explicit error values passed to the same Intel boundary;
the list and policy commands stay mounted. Neither pending nor invalid data is
replaced with fabricated zero usage.

The build-selected @sites-intel-capture-profile adapter is identity-only in public
builds. Development's named intel-reading QA scenario projects explicit source
fixtures through the existing model into the selected reading, without storage
writes or replacing snapshot/detail resources. It visibly labels the fixture;
real refresh/recording behavior is verified separately by recording-refresh.

### Intel temporal display facts and observation notebook (2026-10-03)

statsSiteIntelReadModel.js publishes temporalContext only after full detail is built.
src/domains/stats/contracts/siteIntelTemporalContext.js owns version v1 and projects
recent usage, today usage, and today visits from existing query facts. It contains
source ID, period, local-calendar basis, unit, bucket meaning, actual range, day-record
coverage, availability and 24 values. It consumes no interpretation and never enters
facts/baseline/classifier inputs. It is not a new query, persistent store or cache.

siteIntelReading.js preserves original numbers and period descriptors.
siteIntelHourlyContext.js owns the finite temporal display link allowlist and validates
matching field/family/unit/period/total. It performs coordinate scaling only. No link
exists for session location, feed content, background occupancy or 30-day recurrence.
These remain numeric aggregate evidence alongside explicitly separate recent context.
SiteIntelReadingSurface owns same-area Summary/Evidence, max-two evidence budget,
grouped sentence/measurements, aligned common-scale comparison rows, Escape
restoration and domain-scoped ephemeral page selection. SiteIntelHourlyField owns
visible exploration help, roving hour focus and the exact selected-hour readout in
that same help area. Neither stores business state nor polls.
The terminal interpretation v3 publishes validated explanation keys. The formatter
translates them; the view places the observation explanation before limits. The
first primary evidence owns the chart's subject in both Summary and Evidence;
secondary metric inspection does not replace its period, unit or hour selection.

The existing resource owns admission and permission withdrawal. Same-domain refresh
keeps the reading subtree and page mounted; site selection resets page/hour selection.
Malformed temporal facts fail locally and visibly. Theme tokens supply material
and typography. `SitesProtectionMark` owns the shared policy mark; it does not
encode severity or runtime policy and is absent from Zen's minimal notebook. The
shared site policy band sits beneath the selected identity, while Zen uses a
policy margin and identity-level switch, with Back
and the combined cap in the page toolbar. Zen's notebook reading and evidence use
the same bounded body with page packing measured from the actual available size.
QA traverses every note, date, daily-detail and basis page, protecting complete
text/control bounds, no document or nested scrolling, stable body geometry and
same-site selection/focus continuity. Other themes retain content-height reading.
The schedule blueprint remains documentation-only in the adopted observation proposal;
no interval API, hypothetical projection or dormant setting is shipped by this patch.


## Applied temporal policy (2026-10-01)

`relaxationSchedule` remains the single physical settings key; its version-1
blocks carry `intent: relaxation | isolation`. Base protection is the timeline
background. `scheduleRuntimePolicy.js` is the temporal SSOT used by scope and
filter attenuation. Storage normalization rejects unknown kinds, duplicate or
missing window IDs, and overlapping weekly occurrences, including spillover
across midnight and the Sunday/Monday boundary. The UI uses that same weekly
conflict predicate for atomic time edits.

Occurrence identity is window ID plus the local calendar start day; its start
and end timestamps are calendar times, independent of polling and metadata.
Manual isolation wins over routine windows. Isolation affects allowlist scope;
relaxation only adds the existing named attenuation modifier and never enables
user-disabled filters. The global cap suppresses relaxation, while isolation
continues to declare the allowed scope.

`scheduleRuntimeCoordinator.js` serializes clock reconciliation, settings
application, manual mutations, and end-this-occurrence. It awaits the dispatcher
success summary before writing the version-2 `runtime.schedule_state` receipt,
publishing `SCHEDULE_RUNTIME_CHANGED`, or emitting a notification. The receipt
is observation, never an input or recovery source. A worker restart derives
policy from canonical settings and session inputs and emits no catch-up alert.
`runtime.schedule_occurrence_skip` stores one occurrence ID through
RuntimeFlagRepository/RuntimeFlagStore in chrome.storage.session; it is cleared
when that occurrence leaves the plan. Ending an occurrence never deletes its
recurring block or returns to a remembered pre-session mode.

The Schedule header reads GET_SCHEDULE_RUNTIME_STATE and the published receipt;
it never derives live mode from optimistic editor drafts. Pending/failed reads
are visible. The adjacent editor presents a time pair beneath a mode/name/action
header, with restrained kind-colored fill/edges; focus/selection retain their separate
marker. Duration appears once beneath the selected timeline interval. Inline folded
settings own per-window alert opt-in and isolation's shared passing-site list with
canonical Sites navigation. Global notification settings remain in Settings.
The current-state area owns
the immediate-start/occurrence-end entry; it is absent from the utility dock.

Popup, Schedule, and the immediate-session panel share useAppliedScheduleRuntime.
It consumes applied receipts without reinterpreting their time or kind. Published
updates invalidate older in-flight reads; unavailable reads disable runtime
actions and remain visible. Recurring isolation has no ad-hoc temporary-host
editor; it uses the shared saved allowlist.

Manual end/temporary-host commands carry the displayed session ID. The same
serial queue checks the current applied identity before mutating it, rejects
stale actions, and prevents replacing an already-active manual session.
Canonical session reads reject missing identity/timestamps instead of inventing
a session or extending its expiration.


### Zen reading composition revision (2026-10-12)

The single-sheet revision removes the notebook's permanent registry spread and
nested overview/evidence/slip sequence. `SitesManagementSurface` retains command,
query and portal lifetimes. Zen presentation owns dates, sibling day/hour/session
choices and cumulative evidence, preserving per-domain reading intent on admission.
The Garden's v2 canopy geometry and named `homeReadingSpace` React seam provide
height-scoped CSS widths; no stats or storage owner moves. See the current Zen
revision in the Sites PRD and §13 of the detail plan for accepted UX.
