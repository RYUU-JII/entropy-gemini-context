# Social Metrics Seam Map

- Status: Active
- Owner: nudge visual architecture
- Last validated against code: 2026-10-04
- Path policy: current-only
- Canonical for: social metrics target profiles, hide/cleanup owner map, mutation prefilter seam, host adapter split, content-free targeting health, and runtime scan-cost instrumentation

## Purpose

이 문서는 social metrics hide pipeline이 더 이상 giant manager 하나에 뭉치지 않도록
현재 canonical seam을 고정한다.

### Dirty root containment (2026-09-18)

`core/dirtyRootReducer.normalizeRoots` builds a batch-local Set of connected
Elements, then excludes each root with another candidate in its parentElement
chain. The first occurrence order of surviving roots is preserved, including a
parent arriving after its child and an unrelated root. Detached/non-Element
inputs remain excluded. Document and null full-scan sentinels remain the scan
caller's contract; this reducer does not turn them into body/documentElement.
ShadowRoot is an ancestry boundary, matching native light-DOM contains.

`collectMutationRoots`, `scanController` route flush and `scanRuntimeBridge`
enqueue/merge paths retain this owner. There is no cross-batch ancestry cache,
so reparenting and detach/reconnect are evaluated against current DOM. The
already bounded-by-ancestry `collapseMutationSourceNodes` path is unchanged.
Shorts positive-target classification uses a different owner-local contract;
the two reducers and independent QA oracle are not merged.

The changed containment work is O(candidate count × ancestry depth), with an
O(candidate count) temporary Set. Root-selector QSA, upstream semantic work and
pathological depth are not made constant-time. Regressions:
`tests/socialMetricsDirtyRootReducer.test.js`, existing manager/scan ownership
tests and the fixed-depth operation guards in
`tests/frictionTargetingPerformanceGuards.test.js`. Operation counts are not
Chrome CPU measurements or real-site QA.

## Canonical Map

- compiled-plan adapter:
  - `src/domains/protection/contracts/compiledRuntimeFilterPlanContract.js`
  - `src/domains/protection/content/ProtectionRegistry.js`
- runtime composition root and stable public facade:
  - `src/domains/nudge/visual/socialMetricsManager.js`
- core:
  - `src/domains/nudge/visual/socialMetrics/core/scanController.js`
  - `src/domains/nudge/visual/socialMetrics/core/scanRuntimeBridge.js`
  - `src/domains/nudge/visual/socialMetrics/core/metricCollectionCursor.js`
  - `src/domains/nudge/visual/socialMetrics/core/candidateMatcher.js`
  - `src/domains/nudge/visual/socialMetrics/core/accessibleMetricLabelOwner.js`
  - `src/domains/nudge/visual/socialMetrics/core/runtimeState.js`
  - `src/domains/nudge/visual/socialMetrics/core/cleanupCoordinator.js`
  - `src/domains/nudge/visual/socialMetrics/core/compiledScanPlan.js`
  - `src/domains/nudge/visual/socialMetrics/core/dirtyRootReducer.js`
  - `src/domains/nudge/visual/socialMetrics/core/diagnosticsRuntimeBridge.js`
  - `src/domains/nudge/visual/socialMetrics/core/diagnosticsSnapshotRuntime.js`
  - `src/domains/nudge/visual/socialMetrics/core/diagnosticsValueUtils.js`
  - `src/domains/nudge/visual/socialMetrics/core/debugInstrumentation.js`
  - `src/domains/nudge/visual/socialMetrics/core/mutationGroupRouter.js`
  - `src/domains/nudge/visual/socialMetrics/core/ownedMutationRuntimeBridge.js`
  - `src/domains/nudge/visual/socialMetrics/core/ownedMutationLedger.js`
  - `src/domains/nudge/visual/socialMetrics/core/documentNodeIdentity.js`
  - `src/domains/nudge/visual/socialMetrics/core/selectorDriftRecoveryContract.js`
  - `src/domains/nudge/visual/socialMetrics/core/observerInterestPlan.js`
  - `src/domains/nudge/visual/socialMetrics/core/targetingHealthProjector.js`
- adapters:
  - `src/domains/nudge/visual/socialMetrics/adapters/xMetricEffectOwner.js`
  - `src/domains/nudge/visual/socialMetrics/adapters/tiktokMetricEffectOwner.js`
  - `src/domains/nudge/visual/socialMetrics/adapters/socialMetricTargetProfiles.js`
  - `src/domains/nudge/visual/socialMetrics/adapters/youtubeProfile.js`
  - `src/domains/nudge/visual/socialMetrics/adapters/xProfile.js`
  - `src/domains/nudge/visual/socialMetrics/adapters/instagramProfile.js`
  - `src/domains/nudge/visual/socialMetrics/adapters/facebookProfile.js`
  - `src/domains/nudge/visual/socialMetrics/adapters/tiktokProfile.js`
  - `src/domains/nudge/visual/socialMetrics/adapters/redditProfile.js`
  - `src/domains/nudge/visual/socialMetrics/adapters/youtubeAdapter.js`
  - `src/domains/nudge/visual/socialMetrics/adapters/xAdapter.js`
  - `src/domains/nudge/visual/socialMetrics/adapters/instagramAdapter.js`
  - `src/domains/nudge/visual/socialMetrics/adapters/instagramFeedbackLabel.js`
  - `src/domains/nudge/visual/socialMetrics/adapters/facebookAdapter.js`
  - `src/domains/nudge/visual/socialMetrics/adapters/tiktokAdapter.js`
  - `src/domains/nudge/visual/socialMetrics/adapters/hostUtils.js`
  - `src/domains/nudge/visual/socialMetrics/adapters/hostTextPatternCatalog.js`
- contracts:
  - `src/domains/nudge/visual/socialMetrics/contracts/socialMetricContracts.js`
  - shared content-free envelope: `src/domains/nudge/core/targetingHealthContract.js`
  - shared target-profile mechanics: `src/domains/nudge/targeting/contracts/targetProfileContracts.js`

## Design Rules

Instagram split quantities (2026-10-13): within the existing article/dialog or
standalone main owner, the observed `role=button` Like total has direct label
and unit Text nodes around one direct numeric leaf SPAN. The profile declares
that control shape separately from labelled leaf candidates. The adapter admits
only a complete Like/count clause with a matching direct count, no nested control,
icon, prose or conflicting accessible action. `instagramFeedbackLabel.js` owns
that bounded structure and exact reply clauses, including `답글 보기(count개)`.
The existing semantic cursor admits these candidates; no class names, extra
observer, document rescue or new scan limit is introduced. The old shape was
visited but rejected before candidate application: the numeric span lacked its
own Like label, and the parenthesized reply did not match either old text clause.
Instagram's semantic mutation interest additionally includes `contenteditable`
so a numeric span becoming editable revokes this projection immediately.

The per-manager Instagram label owner projects only the known Text nodes, retaining
the Like control, numeric SPAN, native Text-node identities and handlers. It reads
newer host count/node replacements as native truth and restores only each exact
last write while its parent identity remains owned. Each child Text-node restore
declares the exact mutation parent's clear disposition through the existing
reconciliation port; ancestor membership never supplies diagnostic authority.
Reply leaf projection retains its native button and icon. Role/scope/prose loss,
detached cleanup and feedback OFF use the same causal cursor and restoration
owner. Regressions: `tests/socialMetricsInstagramMixedLabels.test.js` plus the
existing Instagram real-use, semantic-revalidation and continuation suites.
The profile's split-control selector uses one unnested `:has(> span)`; the helper
checks leaf structure in JavaScript. jsdom accepted a nested `:has()` that native
Chrome rejected on 2026-10-13. Selector changes therefore need native Chrome
grammar evidence as well as DOM-fixture tests; fixture acceptance alone does not
establish browser validity.

YouTube thumbnail freshness badges (2026-10-09): `youtubeProfile.js` discovers
native `badge-shape` components independently of their classes. The YouTube
adapter requires `role="img"`, exact Korean `신규` or English `New` in both the
ARIA label and displayed text, and a `ytd-thumbnail` or `yt-thumbnail-view-model`
ancestor before classifying the complete badge as `timeSignals`. Other badge
types, title prose and out-of-thumbnail labels remain visible. Candidate
discovery retains unqualified badges so native label, role, text and reparenting
mutations revoke obsolete marks through the existing scan and cleanup owners.
Coverage: `tests/socialMetricsYoutubeFreshnessBadge.test.js`.

Real-use detail surfaces (2026-10-01): host profiles declare the bounded owners
used by their adapters. Instagram labelled feedback candidates are leaf spans
inside native or `role="button"` controls under post/dialog owners, or post/dialog
sections. The observed standalone post detail uses `main[role="main"]` without an
article/dialog. This named main owner participates in scan roots, semantic scope,
mutation admission and positive classification; its labelled candidates remain
restricted to native/role button descendants. The adapter requires the entire native
text to be a feedback label plus count, so caption prose and numeric-only action
drift targets retain their previous classification. Passive post totals collapse;
interactive comment counts retain their native action word, control and click
handler. The observed leaf-span `답글 count개 모두 보기` control projects only its
quantity to `답글 모두 보기`, within the same named native/role button owners;
caption prose and controls outside those owners do not qualify.
The per-manager Instagram label owner saves exact text and restores only
its last write; newer host text wins, including whitespace and changed counts.
Facebook photo/theater action owners may exist outside article/FeedUnit roots.
Only named reaction/comment/share action labels qualify numeric leaf candidates;
existing feed roots remain preferred for mutations inside a feed article.
TikTok Cinema mode is an explicitly named dialog owner with the existing direct
action count markers and the observed `cinema-side-panel-comment-count-row`
status row. These owners cover Explore-to-Cinema insertions and preserve the
comment heading/action controls. There is no document text rescue scanner.
TikTok's observed direct one-column detail has a DIV root without a MAIN or
role=main ancestor. `tiktokProfile.js` declares `#main-content-video_detail
article` as the accessible action scope alongside the existing feed and Cinema
owners. Only the four native DIV role=button actions (`like-icon`,
`comment-icon`, `favorite-icon`, `share-icon`) with aria-label and their matching
direct STRONG count markers qualify; the adapter also requires a numeric leaf
and the complete observed Korean action/count clause before projection. Prose,
non-article controls, nested or mismatched count markers and other roots do not
gain accessible-label authority. The existing candidate/scan-root and semantic
mutation seams discover these actions; no new observer or document rescue is
added. Existing label ownership preserves controls, adopts host ARIA updates,
and restores exact native labels on feedback OFF or scope/count/role loss.
Root ID dependencies flow through the existing selector-derived observer
interest; the existing causal cursor handles ID revocation and reparenting.
Regressions: `tests/socialMetricsTikTokDirectAccessibleLabel.test.js`.
X profile heading-adjacent post totals are audience counts, with exact post-count
text qualification and article/tweet exclusion. Profile bio text is not evidence.

Accessible metric labels (2026-10-01): X action/group/count-only article labels,
YouTube action labels and the declared TikTok Cinema, feed and direct-detail labels
are projected by their host adapters. Facebook declares the observed
`[role="toolbar"][aria-label="공감한 사람 보기"]` reaction owner and article
reaction buttons. Within those owners, exact `좋아요/최고예요: count 명` and
`공감 count 개, 공감한 사람 보기` clauses remove only their counts. Arbitrary
prose, other toolbars and out-of-article comment controls remain unchanged.
Facebook joins the existing accessible label revalidation cursor through its
compiled host flag: role/scope loss and detached cleanup restore exact native
labels with clear dispositions, while host count updates use apply dispositions.
Facebook photo comment reply controls use the observed
`[role="complementary"] [role="article"] + div` thread owner, or the photo
`[role="main"] + [role="complementary"]` panel's direct-heading comment section.
The latter requires a direct `h2[dir="auto"]` with exact text `댓글`; reply controls
must be inside one of that section's direct thread divs. Plain wrappers between
the comment article and reply action are allowed within this named owner.
Both shapes require the native `[role="button"] > span > span[dir="auto"]` leaf.
Only the complete localized
`답글 count개 보기` label projects to `답글 보기`; the control, icon and click
handler stay native. Its per-manager text owner preserves exact current host
text for cleanup and records target-bound apply/clear dispositions. Arbitrary
comment prose, controls outside the named owner, unrelated nested headings and
pagination summaries are not reply-label evidence. Heading, photo-panel or role
loss revokes the replacement through the existing causal revalidation owner.
TikTok comment-like support is restricted to the named Cinema comment-panel
region and the observed direct-detail right sidebar. The latter requires
`#main-content-video_detail` with named `--RightPanelContainer` /
`--DivCommentMain` wrappers and a direct `--DivCommentListContainer`. A native
comment DIV role-button must carry `data-key-interaction="comment_like"`, a
direct SVG and numeric leaf SPAN, and its `--DivCommentItemWrapper` must contain
the native `comment-level-*` marker. Only the complete Korean like clause is
projected; a comment author, body or arbitrary ARIA button is not evidence.
The sidebar header is the leaf SPAN directly under `--DivCommentCountContainer`
in the same comment main. The existing anchored comment-count classifier
removes only its quantity. The observed recommendation feed
declares `main article` role-button `data-e2e` icon owners only when each owns its
corresponding direct numeric `strong[data-e2e]` count. Cinema reply controls and
the direct-detail sidebar's named comment list use
the exact observed `DivViewRepliesContainer > button > div.TUXButton-content >
div.TUXButton-label` leaf owner; only its reply quantity is removed, retaining
the button, icon and reply action. After direct-detail replies expand, the
continuation uses the same named comment list's direct `--DivCommentObjectWrapper >
--DivReplyContainer > --DivViewMoreRepliesWrapper > --DivViewMoreRepliesOptionsContainer`
chain. Only its native `--DivViewRepliesContainer[data-key-interaction="comment_view_replies"]`
with a direct SVG and direct leaf SPAN qualifies: complete `count개 더 보기`
projects to `더 보기`. The sibling `숨기기` control and comment prose are unchanged.
Marker, icon or scope loss revokes this ownership through the existing causal
cursor; host count updates and OFF restore the latest exact native text. These
use the existing attribute/text
ownership and exact cleanup paths. The existing label marker is a cleanup
candidate seed after positive scope loss; it does not prove metric meaning.
The adapter's private semantic record and current selector/count proof retain
classification authority. A replacement marker with revoked current semantic
proof terminates as no-match in the TikTok candidate matcher; saved native
count text cannot re-enter the generic classifier. Header/reply semantic information
rechecks current named scope and count meaning at apply; cached discovery does
not sustain ownership after revocation. The text owner adopts newer host text
when it differs from the owner's projection, preserves its exact whitespace,
and compares raw text to restore only its own exact last write. Host prose,
whitespace-only rewrites and ARIA changes win at OFF.
Class dependencies retain the existing initial-scan-only observer contract;
admitted ID/role/data/childList mutations revalidate the current named scope.

TikTok mixed-label cleanup (2026-10-04): `tiktokAdapter.js` owns a per-runtime
`createTikTokMetricLabelOwner` ledger for direct text/aria projections. Saved
public artifacts do not grant ownership to another runtime. Group/OFF cleanup
includes detached entries, including controls whose removed wrapper was emptied.
Restore compares the exact original/applied artifact envelope, direct Text-node
identity and last text/aria write; newer host text, node replacement and ARIA win.
Reacquisition after a host Text-node replacement requires fresh native count
syntax rather than the old saved count. Regressions live in
`tests/socialMetricsDetachedLifecycle.test.js`.

YouTube also declares the observed
Shorts `label.ytSpecButtonShapeWithLabelHost > button[aria-label]` owner, including
the native English `along with 35 thousand other people` count clause; its sibling
visual count and icon button retain their existing separate ownership. Count clauses for
active metric keys are removed while action words and control semantics remain.
`accessibleMetricLabelOwner.js` owns only exact `aria-label` writes, not metric
meaning or positive discovery. It keeps native/applied text per manager and
restores only when current text still equals the owner's write. External host
updates are preserved. Configuration cleanup restores exact labels, then the
existing activation scans reapply remaining active groups before update settlement.
Its local ownership cursor uses the existing scan continuation scheduler, visiting
at most 32 elements per step in causal/removed subtrees. Selector/role loss revokes
ownership; detached targets restore and leave the ledger. Cancellation retains
pending removed roots by revision, and group/OFF cleanup includes detached entries.
These checks contribute effect-revalidation evidence and do not manufacture
selector hits or semantic recovery. No new observer, broad classifier or aria
fallback source is introduced. Revalidation writes use the existing exact-target
reconciliation disposition: projection is `apply`, ownership revocation and
detached restoration are `clear`. No-op projection does not consume a visual
numeric-leaf candidate. Only named action/group/article containers retain their
control boundary; numeric leaves continue through the existing visual classifier.
Regressions are in
`tests/socialMetricsRealUseRegression.test.js` alongside existing semantic,
continuation, ownership and lifecycle suites.

X effect revocation (2026-09-16): `xMetricEffectOwner.js` is a per-manager
effect ledger, separate from the transient self-write receipts in
`ownedMutationLedger.js`. Successful X count/companion hiding and news text
replacement register exact targets through the candidate helper port. Public
markers alone never establish ownership. The ledger stores target/group/attribute,
not semantic classifications. `xAdapter.getXMetricInfo()` checks current DOM;
the weak semantic surface map is diagnostic provenance only.

X dirty scans retain local causal roots even after their last positive selector
disappears. Removal-bearing childList records retain their live target in the
shared reducer and the YouTube/action semantic ingress; addition-only records
keep their existing narrow added-node scope. X detached subtrees remain pending
until a local ownership cursor finishes or configuration cleanup succeeds.
Reparented targets are checked in their current context. The cursor visits at
most 32 elements or ledger records per continuation on the existing scan
collection scheduler, with generation checks before resumption. Attribute and
addition-only scans do not enumerate the effect ledger. Actual removals alone
add a cooperative disconnected-record pass after causal subtree traversal so a
removed root emptied before deferred scanning cannot strand ownership. Connected
unrelated records are skipped without semantic reclassification. Group changes
and OFF also enumerate owned records so detached targets are restored. Failed cleanup retains ownership
for retry. Scope/result collection caps are never negative evidence: previously
owned X targets use a fresh local point check independent of the collected union.
The pre-existing local semantic ambiguity/depth limits remain in force; global
X discovery now uses the continuation contract below.
Native removal/emptying coverage is in `tests/socialMetricsDetachedLifecycle.test.js`;
cursor ownership coverage is in `tests/socialMetricsXEffectOwner.test.js`.

Semantic collection completeness (2026-10-04): Instagram, Facebook, Reddit and
TikTok expose the same `scopes + createScopeCursor(scope)` contract as YouTube
and X. `metricCollectionCursor.js` owns only scan-local Element traversal and
identity deduplication; host adapters own all positive meanings and admission of
already-managed Reddit shadow roots. Each step visits at most 32 Elements and
runs at most one host qualification. Initial document discovery and every
admitted mutation root continue to exhaustion without a lifetime root, button
or result cap. Mutation ingress reduces current causal ancestry without doing a
descendant discovery pass. Explicit empty roots remain empty.

`scanRuntimeBridge.js` repeats one stable cursor work unit until it exhausts,
including existing effect-revalidation cursors. Cursor hops do not grow the
work queue or search its processed prefix. Existing generation/context checks,
cooperative scheduler, selector union and owned cleanup remain authoritative.
The operation's `collectionState` distinguishes `pending`, `exhausted`,
`cancelled` and `failed`; collection exhaustion is independent of application
completion, host coverage or an owner-local ambiguous/unsupported verdict.
Configuration/OFF cancels abandoned collection before further reads/writes.
No global scanner, observer, persistent discovery index or confidence policy is
introduced. Reddit still traverses only shadow roots already registered by its
separate bounded shadow observer owner.

Local action evidence remains bounded by the host's numeric-candidate, nearby
button, text and ancestry limits. Candidate retention occurs after current
numeric-text and foreign-button rejection, so decoration spans and another
button's count do not consume the numeric evidence window. A window that
overflows qualified candidates fails closed rather than certifying a partial
winner. Root `querySelectorAll` and cheap predicate walks remain atomic; this
change does not claim a time bound for an individual owner verdict or Chrome CPU
improvement. Instagram grid proof checks the exact current numeric leaf under
its current post-link/list-position owner, without a first-eight selector-hit
cutoff. TikTok cached discovery rechecks all current count/time owners at apply;
a semantic-only target that loses its owner cannot regain authority through raw
text regexes. Tests: `socialMetricsCollectionCompleteness.test.js`,
`socialMetricsInstagramCollectionContinuation.test.js` and
`socialMetricsCollectionFreshness.test.js`.

X final action qualification (2026-10-04): explicit selectors and semantic
discovery share the reciprocal button-to-numeric-target verdict. Equal numeric
leaves and qualified-evidence overflow fail closed before metric effects;
generic numeric patterns cannot bypass this verdict. Positive wrapped controls
mark the qualified numeric leaf, not every equal-text ancestor. Fully labelled
native stat text retains its existing typed-label rule. Native insertion of a
competing leaf revokes the owned effect and its removal allows requalification.
OFF restores original text/labels. Tests: `socialMetricsXQualificationParity.test.js`
and the analytics leaf assertions in `socialMetricsManager.xMetadata.test.js`.

TikTok inverse count/time effects (2026-10-04): `tiktokMetricEffectOwner.js`
owns only exact count/time marker and collapse fields actually written by that
runtime, plus their source metric target. Existing or foreign public markers do
not enroll an effect; fields with a newer host value are preserved. All TikTok
nonreplacement effects, including current Explore and profile indicator
projections, use this owner. The local revalidation cursor runs independently
of positive discovery and checks current meaning and exact projected companions
before classified restore. A post-date separator depends on its current date
source. A profile view indicator depends on its numeric child.

A private WeakMap of dependency-scope reference counts indexes only already
applied effects. It is cleanup authority, never semantic evidence or candidate
discovery: comment-marker sibling loss and profile-view child attribute/text
loss may lift the causal source to its direct parent only if this instance owns
that dependency scope. Every restore deletes its scope reference; OFF releases
connected and detached records. Local mutations walk admitted causal subtrees;
only actual removals permit the cooperative disconnected-record pass needed
when a removed wrapper has been emptied. Generation cancellation remains in the
existing scan runner. Public marker sweeping is skipped for TikTok count/time
cleanup; exact owner cleanup preserves foreign and other-instance fields.
Tests: `socialMetricsTikTokRevocation.test.js` and
`socialMetricsCollectionFreshness.test.js`.

Facebook reply-label self-feedback uses the core attribute SSOT
`SOCIAL_METRIC_ATTRS.FACEBOOK_REPLY_LABEL`, projected by the profile's existing
`FACEBOOK_REPLY_LABEL_ATTR` export, as an exact FastStyle mutation identity in
`ownedMutationRuntimeBridge.js`. The existing ledger's expected-value,
observation-epoch and excess-record gates still apply. This records the owned
marker removal rather than scheduling a redundant empty scan after a classified
native reparent restore; it does not suppress arbitrary marker attributes.

X semantic discovery continuation (2026-09-17): `xAdapter.js` owns
`createXSemanticMetricCandidateCollectionPlan`, wired directly by
`platformSemanticAdapters.js` to the existing scan runtime. Plan creation only
collapses supplied roots (or the explicit initial document root), without a
descendant query. Nested article/tweet/group inputs cannot consume separate
lifetime slots, and broad residual actions remain eligible alongside local cards.
An explicit empty root list stays empty. Non-action filter groups have no semantic
action work. X semantic mutation ingress admits every causal local scope without
a root cap or synchronous descendant enumeration; changes inside primaryColumn retain their
local source rather than widening to that broad ancestor.

Each X scope cursor uses an unfiltered Element NodeIterator, visiting at most 32
elements and resolving at most one action per `next()` call. Reference removal
uses the iterator's live adjustment; detached scope roots terminate. Buttons and
candidate identities dedupe only within that collection plan. The synchronous
collector drains the same cursor. There is no 24-scope, 32-discovered-button or
48-total-result lifetime cutoff. Those numeric limits remain only in the existing
local semantic matcher for nearby buttons, candidate text and ancestors: a cursor
does not make an individual local QSA or ambiguity verdict time-bounded. Product
classification and the independent QA oracle remain separate.

The existing scan owner checks generation/context before each continuation,
rechecks current semantics at apply, and replays queued mutation roots, including
new owners inserted behind the iterator. Configuration/host replacement and OFF
cancel the old generation. This does not add a scheduler, observer, persistent
semantic cache or manager scan facade. `tests/socialMetricsXContinuation.test.js`
covers 0/3/30/100/300 semantic-only cards, flat scopes exceeding 48 results,
overlap, two active groups, native mutation ingress, replay and cancellation.
These are jsdom functional and deterministic cursor-budget checks, not Chrome
CPU or real-site QA. Full-document discovery still visits unrelated elements;
its JS traversal cost is now split rather than claimed to disappear. The shared
selector-root collector and individual selector queries remain synchronous;
this contract does not claim that all mutation admission is cursor-driven.

`effect_revalidation` is product cleanup work and does not manufacture selector
hits, semantic hits, or candidate provenance. Its writes use the existing
`post_chunk_cleanup` capture and exact clear disposition. Scan cleanup ownership
starts during X collection so empty unions, cancellation, and collection failures
still settle decorated ancestors. X rows retain cleanup eligibility after their
last metric disappears. X news replacement restores the saved text only while
the current text equals the owner's last write; newer host text wins, including
after news-role loss and OFF. The replacement weak record is deleted on restore.
This effect ledger is X-specific: other adapters retain their current hide and
replacement ownership contracts; it is not a new universal classifier or observer.
Operation `revalidationEvidenceCount` records checked ownership entries and
queued metadata-cluster evaluations separately from positive discovery. It is
a work count, not a unique-node or CPU measure. A zero-candidate operation with
such work completes rather than claiming `empty`. The health projector requires
this explicit evidence for cleanup without positive candidates; it still rejects
apply claims without positive discovery and preserves unknown effect for
unclassified reconciliation writes. The new scalar is required in operation
snapshots; missing evidence does not silently default to zero.

YouTube Shorts owner coverage (2026-09-16): `youtubeProfile.js` declares modern
Shorts card roots and subhead view-count targets; `youtubeAdapter.js` includes
the same owners in mutation relevance. Dedicated card metadata does not require
a `/shorts/` href. Initial semantic scopes merge nested local wrappers, retain
broad surfaces separately, and schedule later owners through the existing scan
cursor without a global result cutoff. Per-owner text limits and generation
cancellation remain. Tests cover late hydration, more than 160 semantic-only
cards, mixed broad/local scopes, dynamic admission, and OFF restoration in
`tests/socialMetricsYoutubeShortsOwnership.test.js`.

1. Public caller는 canonical single-setting contract만 사용한다. `ProtectionRegistry`
   는 compiled filter map을 persisted settings normalizer에 넣지 않고
   `projectCompiledRuntimeSocialMetricsSetting()`으로 `{ isActive, value }`만
   투영한다.
2. host-specific selector heuristics와 metadata cleanup은 adapter owner다.
3. unrelated mutation filtering은 Social-owned `scanRoots` profile +
   dirty-root reduction에서 먼저 끝낸다.
4. mark/hide의 canonical behavior는 CSS attribute hiding이고, row/cluster cleanup은 host adapter side effect다.
5. giant manager branching을 다시 키우지 않는다. 새 예외는 facade가 아니라 seam에 추가한다.
6. selector query failures are actuator failures, not empty candidate sets: initial
   update scans must roll back, while mutation-driven rescans record diagnostics
   and abort that scan without deactivating unrelated active state.
7. `standard` audit mode measures the production integrated selector query. It
   must not query every configured selector again merely to populate debugger
   breakdowns.
8. Per-selector probing is an explicit, page-session-local `deep` audit mode.
   It is bounded to 8 selectors across 12 collections and reports its own
   `selectorProbeMs`/debug-overhead cost separately from product scan cost.
9. `diagnosticsRuntimeBridge.js` owns mutable diagnostic state in an explicit
   runtime closure: selector/candidate provenance, discovery-ledger projection,
   and measurement epochs. `diagnosticsSnapshotRuntime.js` receives only frozen
   owner/scan/owned-mutation/state ports and owns the content-free targeting-
   health and debugger DTO projections. `diagnosticsValueUtils.js` is their
   dependency-neutral time/compaction seam and is also consumed by scan; scan
   does not import the diagnostics state owner. `debugInstrumentation.js`
   remains the dependency-neutral counter/operation helper. Each record
   carries ObserverHub `flushIds`, full/dirty root scope, candidates/chunks, and
   queue/selector/semantic/idle/apply/terminal-cleanup/total timing so deferred
   work is attributable beyond the synchronous observer callback. The retained
   `post_chunk_cleanup` diagnostic phase is emitted by the coalesced cleanup
   owner at the first runnable opportunity after a 48 ms threshold and at the
   terminal boundary to settle any remaining work. Fast 3 ms slices therefore share exact
   row/cluster cleanup sets without multiplying reconciliation per slice, while
   busy-main-thread idle gaps do not postpone visible settlement by 200 ms for
   every continuation.
   Configuration-driven cleanup is timed separately because it runs outside a
   scan operation. The owner-recorded wall total includes diagnostic work that
   executes inside those paths. Reports therefore expose the instrumented wall
   elapsed value, the measured selector/deep/provenance/write/scan-evidence
   overhead within it, and an estimated product elapsed value after subtracting
   only those known probes. Component timing dimensions remain non-additive, and
   the estimate is not a completeness claim or a substitute for release-lane
   external measurement.
10. Runtime-debugger sessions consume these monotonic diagnostics-runtime-owned
    counters by baseline and delta. Opening a session or setting a new baseline
    must not reset the counters exposed through the stable manager facade; only
    the explicit audit-mode transition may reset its own audit epoch.
11. If the lazy manager loads after a debugger session baseline, that session
    has no lifetime counter origin. A canonically inactive owner may use only the
    diagnostics-runtime-owned, content-free `measurementEpochOperationCount`
    together with its nonnegative safe-integer epoch id and an equal-or-larger validated
    lifetime operation count, plus the exact inactive lifecycle and health
    envelopes. Retained lifetime scan,
    cleanup, timing, audit, or recent-operation history is diagnostic context,
    not current-epoch work authority. Missing or malformed epoch evidence and
    every active/canonical contradiction remain strict
    `broken / targeting_health_probe_contract_invalid`. An active lazy owner may
    still request the real-site runner's single bounded diagnostic rebaseline
    after all physical pending fields and every other required owner settle.
12. Mutation delivery is routed to active metric groups before queue admission.
    `mutationGroupRouter.js` owns the mutation-kind/attribute contract, while
    host adapters remain the owner of root relevance. Owner-marker attributes
    route exactly; YouTube also has group-specific root relevance. Child/text
    root separation for the other adapters remains aggregate fan-out evidence,
    not exact mutation-to-root correlation. Reports must keep that limitation
    explicit. Unknown attribute provenance and relevance failures fail closed
    instead of waking every group.
13. `ownedMutationRuntimeBridge.js` owns its ObserverHub context, scoped
    `FastStyleEngine` mutation recorder, payload-filter lifecycle, and ledger
    state in a product-runtime closure. It is a peer of diagnostics and scan,
    not a diagnostics child or manager mixin.
    Its `ownedMutationLedger.js` state owner consumes social-authored marker/text
    writes only when target, field, expected final value, and observed count agree.
    Mismatch, excess records, expired ownership, detached/foreign targets, and
    mixed external work remain scanner input. ObserverHub's exact observation
    root, monotonic reconnect epoch, and delivery sequence invalidate stale
    ownership; delivery lag is primary and the five-second wall clock is a
    backstop. Expiry, invalidation, mismatch, unobserved-target, and excess
    reasons are privacy-safe scalar evidence. The pending count is part of the
    final settle contract, and a zero-pending fast path performs no DOM reads.
14. Candidate and target repetition uses document-generation plus WeakMap node
    identity, never a DOM path, text, class, or attribute value. Diagnostic
    reports may include bounded sanitized descriptors for reproduction, but
    those descriptors are not identity or deduplication truth.
15. Applied decisions and physical DOM writes are separate counters. Selector-
    only, semantic-only, and overlap provenance is computed from the already
    collected candidate sets; deep selector probes, provenance accounting, and
    write accounting expose their own debugger overhead. FastStyle evidence is
    read lazily only when the active recorder is interested. The public path
    reuses one recorder scope per scan chunk, and ownership record/filter time
    is product cost rather than debugger overhead.
16. Runtime Debugger establishes a Social Metrics measurement epoch by swapping
    only exact-node WeakMap/WeakSet cardinality state before taking its baseline.
    It does not reset producer counters. Candidate decisions, target touches,
    candidate writes, terminal operation cleanup, and configuration cleanup therefore
    retain monotonic baseline deltas without carrying node history across runs.
17. `scanRuntimeBridge.js` owns mutable scan state, candidate collection,
    admission, queue merge, and chunk coordination behind an explicit frozen
    runtime port. The stable manager facade exposes no `_scan*` compatibility
    accessors or forwarded mutable state. `scanController.js` remains the
    dependency-neutral debounce/idle scheduler. Host-specific classification,
    root relevance, replacement, and cleanup stay behind manager-to-adapter
    callbacks and must not move into the scan owner. Scan admission, queue merge,
    and actual execution are separate facts. Semantic collection plans retain
    every admitted causal root after current ancestry reduction and traverse it
    through the existing generation's cursor. No broad ancestor or payload
    ordering can consume lifetime collection slots ahead of a later local
    target. Scan lifecycle state is explicit as
    `queued -> collecting -> applying -> terminal_cleanup -> settled`.
    `scanRuntimeBridge.js` consumes only the platform scheduling seam and yields
    between root selector queries, 64-node selector-filter batches, host semantic
    scope cursor steps, union materialization, and bounded candidate
    discovery/provenance batches. Semantic adapters expose only the direct
    `scopes + createScopeCursor(scope)` contract; the runtime executes one
    `cursor.next()` result per `semantic_query` unit and repeats that stable
    work unit before later scopes. YouTube preserves its existing facet and
    candidate order while batching watch links and their text candidates by eight,
    and its synchronous collector drains that same cursor instead of owning a
    second algorithm.
    Every continuation checks
    the exact scan generation/context before another DOM read; an individual
    `querySelectorAll()` remains atomic. The selector-first then semantic union
    order and exact node identity are unchanged. Candidate apply work remains
    idle-admitted and sliced at 3 ms, while
    accumulated adapter cleanup is coalesced behind a 48 ms scheduling threshold and the
    terminal operation boundary. Cancel or failure attempts the exact pending
    cleanup before state clears; a failed attempt retains retry ownership and
    prevents the next scan from overwriting it. Configuration-driven updates await
    exact scan settlement and roll back lifecycle ownership on asynchronous
    collection failure; mutation-driven failures stay diagnosed and isolated.
    Duplicate scan evidence is produced only for executed scans with an exact
    group, activation signature, document-node root set, and causal flush
    signature. A different flush is not a duplicate; missing causal identity is
    `unavailable`, not zero. A full scan is avoidable only when prevalidated
    dirty roots are code-proven sufficient. Missing proof remains
    `unavailable`. The evidence probe publishes its own overhead.
18. Mutation-rule skips and host-root relevance skips are distinct counters.
    `rootsPrevalidated` may bypass a second host relevance query only when every
    merged route carries the same proof; full scope remains dominant over dirty
    scope during queue merging.
19. `runtimeDebuggerAnalysis.js` converts only proof-carrying structural waste
    into hard scanner contracts. A measured duplicate execution or a measured
    avoidable full rescan fails immediately. `inactive`, `unavailable`,
    `armed_idle`, and `insufficient` remain WARN and can never turn a zero
    counter into PASS; `broken` or an inconsistent measured counter fails the
    diagnostic contract. Admission/merge, full/dirty execution, terminal scan
    outcome, candidate provenance/decision, target identity, work-reason, and
    write-phase counters must satisfy their code-owned conservation equations.
    Write-phase counters measure scan cost only; apply-phase and cleanup-phase
    names do not imply applied or restored product state.
    These equations prove that the instrumented hooks reconcile with each
    other; they do not prove that every possible scanner path is instrumented,
    and reports therefore keep `instrumentationCompletenessProven=false`.
    The phase work ledger normalizes only settled, conserved
    `active_stimulus`, `disable_cleanup`, and `reenable_stimulus` evidence; a
    session/measurement-epoch/counter discontinuity is contract drift rather
    than a synthesized delta. Its selector-only and semantic-only projections
    reuse the already collected candidate union and perform no additional DOM
    reads. A projection with candidate-union loss is rejected before a
    controlled cost experiment; a candidate-union-noninferior projection still
    requires the independent feature oracle. This evidence cannot prove product
    correctness noninferiority or select a winner automatically. A separate
    bounded discovery ledger correlates already-retained Social Metrics and
    Short-form operations by their shared `ObserverHub` flush ids without
    another DOM read. A dev-only shared identity seam now receives only roots,
    candidates, and effect targets already held by each existing owner,
    assigns session-local numeric ids through a `WeakMap`, and records the
    normalized work reason. This proves exact-node and same-node + same-flush +
    same-reason overlap without retaining DOM nodes. Aggregate owner counts
    remain explicitly non-comparable, and even exact overlap is not labeled
    redundant because the owners can derive distinct feature outputs from the
    same scope. The public alias is a no-op and the ledger is not a second scan
    or report owner. Dev record time is measured per owner; the Social Metrics
    share is deducted from its estimated product elapsed time, while Short-form
    record time and snapshot reads remain separate debugger overhead. Dirty-root
    breadth, candidate/write yield, repeated target share, ObserverHub cost,
    and product timing remain human-approved operating-envelope metrics rather
    than arbitrary absolute gates.
20. YouTube incremental root selection distinguishes subtree additions from
    attribute/text churn. An addition inside `#movie_player`, `#related`, a
    watch-next container, or `ytd-watch-flexy` retains the exact added subtree;
    an added broad container decomposes to its discovered watch-link and known
    semantic child roots, falling back to the container only when no narrower
    root exists. Attribute and text changes reuse a watch-link or known local
    metric context and must not promote an unrelated player control to
    `#movie_player`; action-owner roots are still added independently by
    `semanticActionMetricMatcher.js`.
21. YouTube metadata cleanup is owner-scoped. Group-specific mark cleanup must
    not globally restore artifacts that still belong to another active metric
    group, fresh activation must not clean groups the manager did not previously
    own, and the adapter restores only display/visibility state carrying its own
    marker. Hidden items and orphaned delimiters collapse their layout space;
    when every item in a metadata row is hidden, the adapter collapses the row
    instead of retaining an invisible gap. Repeated row synchronization must not
    emit unchanged FastStyle mutation attempts once the desired owner state is
    already present.
22. X target and metadata writes are state-transition scoped. Repeated candidate
    decisions remain visible in diagnostic target-touch counters but must not
    reissue an already-satisfied metric marker write. The X adapter collapses
    hidden metadata items, orphaned separators, and empty clusters, marks only
    nodes whose inline display it actually overrides, stores that node's
    original inline display in the owner marker, and restores exactly that value
    during cleanup. When a hidden middle item leaves two separators between the
    same surviving neighbors, exactly one separator remains. Repeated cluster
    synchronization at the same desired state must emit no FastStyle mutation
    attempt.
23. Instagram metric-leaf collapse and time-cluster writes are state-transition
    scoped. Exact count leaves keep their host text unchanged and receive the
    adapter-owned collapse marker, so hidden localized replacement strings
    cannot retain unequal layout widths. Time candidates likewise keep their
    host text unchanged and therefore do not store or restore an original-text
    snapshot. Repeated collapse, metric-marker, and cluster-display
    synchronization at the same desired state emits no FastStyle mutation
    attempt, while cleanup removes only the adapter-owned collapse marker and
    restores adapter-owned inline display state.
24. Facebook candidate discovery is adapter-owned. Localized accessible action
    labels may admit only numeric descendants, labeled counts must resolve to
    the deepest single-kind text owner, and compact timestamps must be tied to a
    Facebook permalink. An unlabeled numeric share count is admitted only when
    its preceding sibling owns Facebook's stable
    `data-ad-rendering-role="share_button"` signal. Share, repost, and reshare
    counts belong to `feedbackCounts`; localized punctuation is part of the
    adapter contract. Timestamp metadata cleanup collapses the time item and
    deduplicates its adjacent separators while preserving the surviving
    metadata items and one separator between them. Broad article text traversal
    is not a valid fallback.
25. TikTok post-detail metric ownership stays inside `tiktokAdapter.js`.
    Browse action counts and comment-like leaves hide as exact numeric targets;
    the author date also owns its immediately preceding dot separator.
    Comment-tab and view-more-replies controls preserve their interactive
    element and icon while replacing only the direct count-bearing text and
    accessible label. Every TikTok target that is actually hidden also receives
    the adapter-owned collapse marker so it contributes no layout box; buttons,
    icons, and mixed control labels do not. Cleanup removes the collapse marker
    and restores the exact original text and aria label.
26. `socialMetricsManager.js` is the stable orchestration facade and explicit
    runtime composition root. `createSocialMetricsRuntime()` constructs one
    lifecycle closure plus independent diagnostics, owned-mutation, and scan
    runtime instances through frozen narrow ports. The default export is one
    factory-created singleton with only the seven public methods; fresh tests
    use the same factory. There is no manager-bound `this`, spread mixin,
    `Object.defineProperties` forwarding, private-field facade, or compatibility
    accessor. Peer runtimes may coordinate shared evidence and work only;
    host-specific classification, selector relevance, replacement, and cleanup
    remain adapter-owned.
27. Host-specific text-pattern policy is owned by
    `adapters/hostTextPatternCatalog.js`. The manager injects that resolver into
    `core/runtimeState.js` and `core/compiledScanPlan.js`; core compiles selectors
    and groups but does not define host regexes. A missing resolver or non-array
    adapter result is an explicit contract failure, not an empty-pattern
    fallback.
28. Observer attribute interest is compiled from the active selector/root
    dependencies, adapter-declared semantic mutation attributes, and exact
    Social Metrics owner attributes. `class` and `style` dependencies remain
    initial-scan-only unless this owner explicitly opts them into live
    observation with bounded cost evidence. Mutation group routing consumes the
    same per-group attribute contract, so an observed `title`, `datetime`,
    `data-e2e`, or `role` transition cannot be discarded by a stale static
    routing allowlist. Attribute names are validated and lowercased before the
    HTML observer filter is compiled; Reddit's light/shadow semantic owners
    share one declaration that also covers `name`, `upvote`, `downvote`, and
    `number`. The compiled activation signature includes the canonical host and
    exact scan-root selector, so a scan-root-only runtime override triggers an
    initial rescan rather than reusing stale configuration identity.
29. `targetingHealthProjector.js` projects only scalar evidence already owned by
    the scan/diagnostic runtime. It performs no DOM read, selector query,
    persistence, profile mutation, or recovery. A terminal measured result may
    report `drift=clear`; incomplete or ambiguous evidence remains
    `not_evaluable`. Terminal effect evidence must come from the latest exact
    scan operation in the current measurement epoch with the current site id,
    activation signature, and execution ordinal; cumulative audit totals or an
    older decision are not terminal authority. The exact operation privately
    folds the last semantic disposition by effect-target identity and exposes
    only `terminalDisposition` plus conserved apply/clear/unknown target counts
    and an unclassified reconciliation-write count. Adapter-owned reconciliation
    may add an exact apply/clear disposition only while the owned-mutation runtime
    proves that the physical write target is the same declared element; a target
    mismatch or missing identity increments the unclassified count instead. A
    homogeneous apply or clear set is measurable only when every effect target
    is classified and the unclassified count is zero. Mixed/unknown targets,
    missing target identity, or any unclassified post-chunk actual write remain
    insufficient; phase write counters cannot fill that gap. Repeated-epoch
    `suspected` promotion is not a Social
    Metrics Phase 1 authority.
30. The YouTube selector-drift pilot does not add a second target resolver.
    `scanRuntimeBridge.js` records provenance from the selector and semantic
    candidate sets it already owns. `diagnosticsRuntimeBridge.js` joins a
    semantic-only candidate to the exact terminal effect target captured by
    `ownedMutationRuntimeBridge.js`; `debugInstrumentation.js` retains only
    document-local WeakMap identity and content-free scalar evidence.
    `selectorDriftRecoveryContract.js` closes the pilot to YouTube
    `feedbackCounts`, `viewCounts`, and `timeSignals`. No raw selector, class,
    text, DOM path, or generated runtime selector enters the report.
31. YouTube semantic action recovery is ambiguity-first. The semantic owner
    must reject negative actions and foreign button ownership, require a valid
    numeric leaf in the same connected action scope, and require the best
    candidate to beat the runner-up by the declared score margin. The existing
    Social Metrics apply/restore ledger remains the only mutation owner.
    QA labels one run only as observed recovery. It emits
    `selector_drift_recovered_human_review_required` only after exact effect,
    disable restore, re-enable effect, settled queues, and three independently
    owned disposable-browser epochs. Runtime selector generation and automatic
    canonical profile writes remain false by contract.
32. `youtubeSelectorDriftMetamorphic.test.js` owns the deterministic
    same-document `BEFORE -> AFTER` scenario matrix. Its data-only fixture
    covers watch Like, Shorts Like, metadata view counts, wrapper/reparent and
    hidden-node changes, the previously user-observed unitless `8.7천`
    metadata row, late hydration, ambiguity, and foreign-action controls.
    Test-only oracle attributes are converted to node references and
    removed before `SocialMetricsManager` runs, so the product resolver cannot
    satisfy the test by reading its expected answer. The test drives the real
    `ObserverHub` mutation subscriber and proves exact effect, cleanup restore,
    and re-enable parity. Independently sanitized real-site captures may extend
    this corpus, but live DOM downloads, full-page snapshots, and product
    scoring logic are not fixture oracles.
33. The independently sanitized YouTube corpus is provenance-bearing but
    `candidate_only`. Its test must assert the observed target, exact negative
    controls, duplicate absence, cleanup restore, and exact-node re-enable
    parity; console output alone is not acceptance. The current corpus covers
    English/Korean signed-out watch surfaces and a Korean Shorts player Like
    rail, but missing signed-in and broader experiment strata still prevent a
    representativeness claim. A
    lifecycle-local `recovered` operation followed by a terminal
    `not_observed` operation remains non-certifying rather than being folded
    into a persistent success.
34. The current release freezes certified selector-drift recovery at the
    YouTube pilot. X and Instagram keep their existing selector-plus-semantic
    product paths, but they do not inherit YouTube certification by changing a
    site allowlist. Post-release expansion is sequenced as X actions, Instagram
    feed/Reels, then Instagram profile/grid/dialog. Every step must add its own
    ambiguity margin, adjacent-action negative controls, independent corpus,
    and exact mutation-ledger effect/restore/re-enable proof. Shared machinery
    may own provenance and certification mechanics; the host adapter continues
    to own target meaning.
35. Instagram mutation scans retain the exact connected causal sources instead
    of promoting every descendant change to the containing article/header.
    Semantic discovery may widen only to the nearest adapter-owned action or
    profile scope. A previously collapsed metric leaf may reuse its stable
    disposition only during a mutation scan, only while both owner markers are
    intact, and only when no causal source intersects its cached local scope.
    Reparenting, local label/text/attribute work, configuration scans, time
    clusters, and missing causal evidence all force normal reclassification.

## Current Notes

- `socialMetricTargetProfiles.js` owns the strict `metricSelectors` and
  `scanRoots` schema, while the named host profile modules listed above own
  their declarations. Host adapters continue to own semantic classification
  and cleanup behavior.
- `diagnosticsRuntimeBridge.js` records operation-local diagnostic state;
  `diagnosticsSnapshotRuntime.js` projects the content-free Social Metrics
  health snapshot through `targetingHealthProjector.js` and exposes the exact
  content-free `measurementEpochOperationCount`. The target fold retains no DOM
  node, raw text, or target identity in terminal facts; the snapshot owner adds
  no observer or query and never equates zero candidates with proven absence.
- YouTube와 X metadata cleanup은 adapter seam으로 이동했다.
- Instagram은 아직 가장 무거운 classifier이지만, fast reject를 collection/match 단계 양쪽에 둬서 deep scan 비용을 줄였다.
- Candidate collection now reports `candidate_selector_query`,
  `candidate_semantic_query`, and `scan_collect_failed` diagnostics. This keeps
  broken configured selectors from looking like a valid "no metrics found" scan,
  while preserving mutation rescans as bounded sidecar work after activation.
- `core/runtimeState.js` resolves visibility directly from the canonical
  `socialMetrics` setting. It must not rebuild a full settings map or call the
  persisted full-map normalizer; unrelated materialized entries such as
  `blur.band + blur.value` are outside this owner.
- 승인된 실사이트 baseline이 생기기 전에는 새 scan/write 지표를 WARN
  evidence로만 사용한다. 자동 baseline 갱신이나 임의의 DOM/time hard
  budget은 이 owner의 책임이 아니다.
