# DOM Targeting Runtime Architecture

- Status: Active
- Owner: repository architecture, nudge runtime, runtime QA
- Last validated against code: 2026-10-04
- Path policy: planning-allowed
- Canonical for: DOM target profile ownership, selector dependency contracts, owner-local resolution pipelines, targeting health evidence, and bounded drift recovery
- Companion to:
  - `docs/architecture/repository/friction-nudge-effect-boundary-map.md`
  - `docs/architecture/repository/social-metrics-seam-map.md`
  - `docs/architecture/runtime/feed-flow-runtime-target-architecture.md`
  - `docs/operations/qa/real-site-e2e.md`

## Decision Summary

Entropy does not need one universal selector engine.

The target architecture keeps four different concerns separate:

1. site identity and immutable profile compilation
2. mechanical selector and mutation primitives
3. owner-local semantic or structural resolution
4. content-free targeting health and independently verified drift evidence

The current runtime is already stronger than a class-name lookup table. Social
Metrics unions explicit selector candidates with host semantic candidates;
Visual Media combines selector, context, geometry, aspect ratio, and exclusion
evidence; Short-form combines route, link, wrapper, and negative-context
evidence; FeedFlow can certify a local structural topology across sessions.

The Phase 0-2 contract floor is implemented: site identity is selector-free,
target declarations are compiled from owner-local schemas, Social Metrics and
Short-form expose content-free health projections, and debugger/QA validity
uses one vocabulary. Social Metrics Phase 4 now binds semantic-only candidates
to exact owner mutation targets for YouTube, X, and five distinct Instagram
surfaces. The X and Instagram evidence remains `candidate_only`: the product
path is enabled and reversibility-tested; Instagram feed and Reels have three
successful document epochs, X has two successful signed-in epochs, and the
profile/dialog surface has three consistent safe refusals. Broader
locale/experiment/time strata still gate certification. The remaining
architecture problem is concentrated in other owner domains, duplicated
mechanical query outcomes, and recovery policies that still lack owner-specific
opportunity and effect proof.

Phase 4 live-corpus acquisition is also owner-separated. The product Social
Metrics resolver is never imported by the corpus collector. Public Korean or
English samples run in one disposable extension-free browser; authenticated
YouTube samples borrow exactly one pre-opened managed-browser route without
navigation, activation, focus, or target creation. The X and Instagram corpus
target instead creates exactly one protocol-owned background page, navigates
without activation, enables execution inside that owned CDP session without OS
focus, and closes only that page. Both paths emit only a bounded redacted
candidate tree and require human oracle selection before a fixture can enter
the executable corpus. This closes the earlier ad-hoc capture gap without
turning live DOM into an automatic selector/profile write path.

The adopted direction is therefore staged separation, not a big-bang rewrite:

```text
site identity
  -> owner-local generic declaration + explicit site exception
  -> strict immutable compile
  -> bounded discovery
  -> owner-local semantic/structural qualification
  -> owner-local apply/restore
  -> content-free health projection
  -> independent QA evidence
  -> optional owner-specific certified recovery
```

## Current-State Audit

### Selector revalidation and recovery progress (2026-10-04)

Click's escape/utility bypass proof belongs to the resolved action itself. Generic
control recognition compares whole English/Korean names, and label heuristics use the action's
whole label rather than URL, identity tokens, ancestor labels, or words inside a
content title. Native gesture policy and explicit owner control declarations stay
with the Interaction owner. Valid `aria-labelledby` IDREFs resolve within the
action's tree in author order and take precedence over `aria-label`, including an
empty referenced name. Direct referenced text/aria names do not follow another
`aria-labelledby` edge. Generic aria-label selectors no longer override this
name precedence; content text precedes the lower-priority title. This is narrow
action-name evidence, not a full browser accessibility-tree implementation; see
[Accessible Name Computation 1.1](https://www.w3.org/TR/accname-1.1/#step2B).
`tests/clickBoundaryClassifier.test.js` and
`tests/clickTargetResolverProfile.test.js` protect content-entry classification and
the resulting click gate alongside real Back/Close control bypass, referenced
name changes, Korean controls and ShadowRoot reference isolation.

Feed topology gathers the first three fresh live samples at its 750ms minimum
cadence on both known and generic surfaces. Submitted shadow proof backs off only
after stability; actual 10-second expiry returns to initial acquisition without
duplicating the submitted fact. Known-profile readiness with six samples does not
authorize a durable fact before its eight-sample admission floor. The certification
owner, TTL, decay, quarantine and final actuation preflight remain unchanged; see
`feed-topology-certification-runtime.md` and
`tests/feedTopologyLocalCertification.test.js`.

Instagram's remembered metric meaning is revalidated against the current action,
visible numeric leaf and structural owner before an effect remains active. The
existing instance ownership Map tracks labels and collapses together; attribute
and addition changes use a causal subtree cursor with at most 32 element visits
per step. Actual removals additionally check disconnected ownership records so a
removed wrapper emptied before deferred scanning cannot strand an effect. This
shares the existing scan generation and OFF cancellation boundary and restores
only owned effects. `tests/socialMetricsInstagramSemanticRevalidation.test.js`
covers action reuse, ambiguity, scope loss, removal, local work and cancellation.

X actual removals likewise owe cooperative disconnected-record cleanup after
causal subtree traversal; emptied removed roots cannot retain owned effects.
TikTok mixed control labels have instance-local exact text/aria ownership and
restore detached labels during engagement configuration/OFF cleanup. Public
markers alone cannot grant ownership; host-authored replacements survive exact
restore. Native regressions live in `tests/socialMetricsDetachedLifecycle.test.js`
and `tests/socialMetricsXEffectOwner.test.js`.

Short-form observer interests compile the declared hide-selector dependencies plus
YouTube role/label/structural ID and TikTok `data-e2e` interests. YouTube's declared
`id` interest revalidates ID-only `#items` loss/restoration through existing local
mutation admission. Nested enclosing shelves selecting the same first horizontal
list reconcile together; ordinary metadata/unselected nested ID changes retain
the relevance gate. Native identity and local-work regressions live in
`tests/shortFormHorizontalShelfMutation.test.js`. Facebook Reel and TikTok
navigation/feed hides emit negative intents when their evidence disappears;
restoration requires the exact instance-owned actuation reason. TikTok no longer
discards follow-ups after the first 32 candidates: its existing synchronous query
feeds an operation-local Set and processes the full result. This restores
completeness, not a selector-engine time budget, and retains the existing
first-item selection contract. Native hydration/revocation, Facebook href reuse,
unowned-marker rejection and large-feed hide/restore regressions live in
`tests/shortFormBlockManagerLifecycle.test.js`,
`tests/shortFormFacebookRules.test.js` and `tests/shortFormTikTokRules.test.js`.
The friction architecture guard retains resolver purity and requires TikTok's
canonical restore/revocation vocabulary plus its exact owned-release reason.

### Drift acquisition, inverse invalidation and collection completion (2026-10-04)

When a continuous Feed surface loses its shipped item attributes, the Coordinator
can acquire a same-scroller semantic article/listitem through the independent
`FeedContinuousReferenceDiscovery` owner. Visible hit-test samples and ancestor
inspection are bounded. `FeedLocalTopologyProbe` walks only the reference's
ancestor lanes and reports complete versus truncated inspection; incomplete or
competing lanes remain pending. Discovery grants no intervention authority: the
existing certificate, shipped/local mismatch and final lease checks still apply.
Native document-scroll regressions in `tests/feedRecoveryDiscoveryIntegration.test.js`
prove recovery with a valid certificate and nonintervention without one.

YouTube Short-form revalidates both positive and revoked filter-chip evidence.
The manager passes a read-only lookup of its exact owned hide reason so a lost
role, tablist or context can restore a previously hidden chip without treating a
foreign public marker as ownership. Continuation hydration observes `active`,
`hidden` and `is-watch-page`, then follows only the changed spinner/continuation
or watch-page owner. `tests/shortFormSemanticInvalidation.test.js` exercises native
ObserverHub delivery, inverse transitions, sibling evidence and unrelated churn.

Social semantic collection retains per-operation cursors rather than stopping
after the first root/candidate quota. Each step shares the current generation,
cooperative budget and owner qualification; completion records exhausted,
cancelled or failed collection. Point qualification still has bounded evidence
limits and must refuse incomplete or ambiguous proof. Exhausting discovery does
not prove recall or grant independent opportunity evidence. X explicit and
semantic paths share the same reciprocal action-to-numeric-leaf qualification;
remembered Instagram/TikTok meaning is rechecked against the current owner at
the write boundary. TikTok count/time effects additionally retain private
instance records in `tiktokMetricEffectOwner`: causal subtree cursors revisit
applied effects after their positive discovery evidence disappears, and release
only the exact owned mark/collapse. Companion indicators retain their source
metric identity. Actual removals owe disconnected-record cleanup; OFF clears
the instance ledger and preserves foreign markers. Native large-wrapper,
cancellation, owner revocation and exact OFF regressions live in the Social
collection/qualification tests and its owning seam map.

These changes preserve owner-specific recovery. They do not automatically
reclassify a known Feed route or independently identify TikTok's current video.

### Text Shuffle marker-independent revalidation (2026-09-16)

The ownership ledger's `iterateMutationRevalidation` is a lazy, batch-local
cursor. Attribute roots walk local elements with `NodeIterator` and resolve
owned text from the exact-parent index; public markers are not ownership proof.
Child-list roots retain the narrow ancestor target-owner lookup. Each ancestry,
element and indexed-text visit yields a work step, even when it finds no owned
text, so discovery shares the manager's existing 3ms cooperative ingress budget.
The mutation queue and ledger remain independent peers; no new scanner, observer,
global tracked-set scan or persistent index is added.

The manager rechecks the current generation and live text eligibility before
restoring or rebasing a yielded node. OFF and configuration replacement cancel
the cursor through the existing ingress generation. Host-authored replacement
text survives exact restore, and eligible reparenting retains its original-text
ownership. NodeIterator allows traversal to continue if its reference element
is removed during a continuation. Existing pending mutation batches still own
new DOM changes; this is not a frozen snapshot of a changing subtree.

Coverage: `tests/textShuffleOwnershipLedger.test.js` and
`tests/textShuffleManagerLifecycle.test.js`, including native jsdom
MutationObserver/ObserverHub delivery. Local DOM results do not certify Chrome
performance. Detached-subtree collection and fresh-target discovery retain
their existing synchronous query boundaries; neither is claimed to be sliced
by this change.

### Visual media membership freshness (2026-09-16)

Visual's synchronous collector may reuse a selector query as membership proof
only within that synchronous discovery. Cooperative discovery rechecks each
candidate because its static query result can outlive a yield. Both apply and
restore recheck current membership, connectivity, context and exclusion at the
write boundary. A previously owned media element that loses candidate membership
must have its additive effect cancelled without overwriting the host's inline
filter. Regained membership reconciles to the current filter without cancelling
a valid effect. Update generations are checked after completed asynchronous phases as
well as explicit scheduler yields, including OFF and newer-filter supersession.

Coverage lives in `tests/visualManagerMediaGate.test.js` and
`tests/visualManagerLifecycle.test.js`. Owned style-only mutations now check
current discovery membership before the cheap no-op path: retained membership
preserves host-filter composition without qualification replay, while lost
background-image/CDN membership enters exact local effect cancellation. The
observer interests and addition-only discovery boundary remain unchanged.

### Behavior mutation discovery (2026-09-19)

BehaviorHub reduces connected added Elements to outer light-DOM roots within
each CLSE-demand-owned mutation callback, using a batch-local Set and current
`parentElement` ancestry. Detached additions do not consume feed node novelty;
if reconnected later, they can be counted then. The receipt's `addedNodes` stays
the original payload length, including non-element additions. The existing
WeakSet still describes node novelty within the observation epoch, not content
identity. Seed and synchronous subtree query results need only the owner's
semantic root check (including MAIN/role=main exclusion); only a supplied root
needs a selector match. No persistent root cache or observer is added.

`tests/behaviorHubLifecycle.test.js` covers overlap/disjoint 0/3/300 fixtures,
seed/semantic exclusions, reparenting, disconnected additions, node reuse,
native ObserverHub delivery and demand OFF/reseed. Root reduction stops at a
ShadowRoot because the host's query cannot cover its children; this does not
add shadow observation. Ancestry work depends on root count and depth, and each
remaining selector query is still synchronous. Local operation counts do not
certify Chrome CPU improvement.

### Media inventory and topology admission (2026-09-28)

`VideoElementObserver` snapshots the suspended TreeWalker cursor ancestry before
yield and retains weak ancestor-to-root identities for that job. A delayed removal
replays only the affected root even if the job has already advanced to a later root.
Unrelated removals do not replay completed or active discovery. Continuation checks
parent identity before advancing to cover detached/cross-parent cursors whose
ObserverHub delivery is still pending. Same-parent reorder whose entire job has
finished before delayed delivery remains an existing completeness limitation;
this is not a frozen DOM snapshot.
The debug counters `removalReplayChecks`, `removalReplaysQueued` and
`removalReplaysAvoided` expose the decision. The 0/10/1000 unrelated-removal fixture
retains six inventory visits and zero replays in all cases.

`FeedLocalTopologyProbe` rejects absent, detached or non-candidate reference items
before querying document candidates. Eligible references retain the existing global
document-order first-320 certification semantics. The cap bounds evidence retained,
not selector engine work. Local-first discovery is deferred until its changed
certification opportunities have an explicit authority and oracle contract.

### Visual local ownership revalidation (2026-09-28)

Attribute and promoted-context reconciliation uses a lazy `NodeIterator` over
the causal light-DOM scope and membership in the existing owned-media Set.
Discovery membership loss still restores the exact effect. Overlapping local
roots collapse and restore identities deduplicate within the operation. Every
visited element, including non-media elements, is a cooperative planning unit
counted as `ownershipElementVisits`; `trackedTargetVisits` counts owned media.
Document/body configuration reconciliation retains the full ownership route.
Attribute/context-only batches skip disconnected cleanup. Actual removals retain
that global cleanup because detached subtrees can be emptied after delivery.
No persistent index, semantic cache, extra observer or batching delay is added.
Live commit checks and generation/OFF cancellation remain authoritative.

The native-observer regression fixes two changed targets while increasing
unrelated owned targets to 10/100/1000: all cases use two local element visits,
two owned-target visits and zero global Set iterations. Ancestor revocation uses
five local visits in each case and restores/reacquires both targets. Shadow
boundaries and removal of the iterator reference during yield are covered.
Admission and context probes remain synchronous; local selector calls are atomic.
These operation counts do not certify browser CPU or input latency improvement.

### Visual mutation admission (2026-09-19)

The Visual observer classifies its existing addition-only batch before root
admission, after attribute filtering and declared short-form context promotion.
It passes the same `reconcileExistingTargets` decision to root admission and
cooperative application. An added root is checked directly against the owned
media Set, then against the existing local discovery selector; discovery-only
batches do not enumerate unrelated tracked media. Unclassified direct calls
default to reconciliation. Attribute, removal and promoted-context batches
retain tracked-descendant admission through the causal light-DOM scope so losing discovery membership cannot
prevent restoration. No reverse index, observer or persistent cache is added.

`tests/visualManagerMutationAdmission.test.js` covers native jsdom observer
delivery with 0/3/300 tracked targets, late direct/wrapped Reels links, attribute
revocation, removal and reparenting. Counts describe explicit JavaScript tracked
visits, not selector-engine visits or Chrome CPU time. Local selector discovery
and the profile's declared context-promotion coverage are unchanged; this does
not add general invalidation for arbitrary relational selectors or child text.

Visual's YouTube grid `:has(lockup)` dependency has its own structural mutation
declaration (2026-09-20). `mediaTargetProfiles.js` declares grid contexts and the
two lockup tags separately from Instagram's descendant-link contexts;
`mediaFilterController.js` compiles them into its immutable targeting plan.
The existing observer queue admits childList additions/removals containing that
evidence only inside a declared context. Live mutation targets identify all
enclosing grids, including the old owner after evidence moves or disappears.
Batch-local target/context Sets and Maps collapse repeated records/overlapping
roots. A batch-local removed-node/parent map retains the former owner when a
removed wrapper loses its evidence before observer delivery; traversal combines
current and recorded parent edges with a visited Set and admits only connected
grids. It stops at ShadowRoot and retains no state after the batch. There is no
semantic cache or new subscription. Element-free records skip structural
ancestry entirely. Because detached nodes can be rewritten after native delivery
but before either deferred consumer runs, removal contexts also check their
current evidence once per batch. A context with no remaining evidence is admitted
only if a connected, active non-base effect from the existing media ownership
cache still lives beneath it. This is a conservative revocation obligation, not
cached semantic truth: final membership and strength are resolved from live DOM.
Metadata removal in a still-positive grid or a base-only grid does not replay
media classification or geometry. The no-evidence case walks only the revoked
context subtree; that local probe and the atomic context query remain synchronous.
Actual removal batches still perform disconnected ownership cleanup.
The current classifier still owns eligibility
and strength, and the cooperative generation still cancels stale/OFF work.
`tests/visualShortFormContextMutation.test.js` covers native jsdom delivery with
an explicit single-arm selector limitation; `site/youtube-media-membership`
uses the full shipped profile and an independent computed-filter oracle.

### Shorts/Reels owner discovery (2026-09-16)

Short-form removal discovers declared Shorts lockups, explicit Shorts entry
links, and previously hidden media owners. Ordinary YouTube cards are not
enumerated for per-card link classification during initial discovery. Shared
cards reached through a Shorts link still check conflicting standard media
links. A dedicated `ytm-shorts-lockup-view-model(-v2)` card is structural
evidence before href hydration; explicit standard-media hrefs revoke its hide.
Nested lockup versions resolve to one outer owner.

YouTube's feed-item resolver collapses positive owners using batch-local Sets
and `parentElement` ancestry (2026-09-18). Only a positively classified ancestor
can suppress a positive descendant; a mixed/negative candidate still permits
local positives and previously hidden negative targets still emit restoration.
Positively pruned shelves use the same local membership walk when excluding
their cards. Discovery/classification and intent order remain unchanged. The
Sets live for one synchronous resolve call; reparenting is read on the next call.
Ancestry stops at ShadowRoot, preserving light-DOM `contains` semantics.

Containment work scales with candidate count times ancestry depth, rather than
all candidate pairs. This is not a constant-time or CPU budget for the resolver:
selectors, URL/semantic reads and deeply nested trees retain their own costs.
`tests/shortFormTargetingOwnership.test.js` protects positive/negative nesting,
mixed/unknown shelves and reparenting; fixed-depth 0/3/100/300 operation guards
live in `tests/frictionTargetingPerformanceGuards.test.js`.

Horizontal `ytd-shelf-renderer` lists hide as a whole only when their `#items`
slots are all declared Shorts lockups without conflicting standard media.
Mixed or unknown slots preserve the shelf and use individual Shorts owners.
The existing declared grid-shelf policy remains separate. Whole-shelf intents
suppress nested card classification for that operation.

The YouTube mutation resolver also admits existing childList records when an
Element is added to or removed from the classifier-selected `#items` slot list
(2026-09-19). This includes unknown slots with no positive Shorts/link evidence:
addition can revoke a whole-shelf hide, and removal can make it eligible again.
Only the exact first horizontal list and its first `#items` selected by the
classifier qualify. Nested shelves sharing that selected list are reconciled
together; duplicate roots collapse within the batch. Metadata descendants,
unselected duplicate IDs, and direct Text/comment-only changes do not qualify.
Disconnected targets are ignored; selector failures use the existing diagnostic
and fail-closed path. Subscription, actuation, and OFF cleanup remain owned by
`ShortFormBlockManager`. Native jsdom observer regressions are in
`tests/shortFormHorizontalShelfMutation.test.js`; no browser timing is implied.

Mutation work retains removal targets so a disconnected link can revoke its
live owner's hide. Unrelated metadata additions do not promote an entire
YouTube shelf. Instagram link/video additions promote to their article; final
targets are deduplicated and previously hidden owners with no remaining Reels
link receive restore intents. Generic structural container inspection has a
bounded element cursor rather than an unbounded `querySelectorAll('*')` followed
by a size check. No new observer or persistent classification cache is added.

On YouTube, the existing ShortFormBlockManager subscription also requests
`characterData`. Added Text nodes and characterData payloads, plus live parents
of removed label children, pass through the YouTube resolver's local label-owner
gate: channel tabs, guide entries, and filter tabs inside chip contexts. Text
metadata outside these owners cannot promote a card or shelf scan. Added wrappers
containing supported labels remain discoverable without requiring an href.
Other platforms retain their previous observer interests, and ObserverHub keeps
filtering each subscriber's payload independently.

A previously hidden channel tab with no remaining label/self-href evidence emits
a reason-qualified restore intent. The manager checks its instance-local weak
actuation record before removing the effect; an unowned marker or another reason
is insufficient. Successful hide/no-op revalidation updates owned reasons,
successful restore deletes them, and successful OFF cleanup resets the weak map.
This record never substitutes for current DOM classification. A positive intent
for the same target in one resolution batch takes precedence over a negative
intent. Selector failures cannot be interpreted as negative channel evidence.
Guide entries keep their declared physical-removal policy; this does not invent
reconstruction of removed site DOM. Native jsdom observer coverage lives in
`tests/shortFormBlockManagerLifecycle.test.js`; Chrome performance/real-site QA
remains a separate verification layer.

Social Metrics declares Shorts cards in its metric-root and relevance profiles.
Their view-count metadata has an explicit selector path plus the existing
semantic text qualification path; neither requires a hydrated Shorts URL.
Initial semantic discovery schedules all known local owners and merges nested
local wrappers. Broad surfaces remain independently eligible for metrics outside
known owners. There is no lifetime scope/result cap that discards later cards:
the existing cancellable scan runtime yields between scope/cursor units, while
local text-discovery bounds remain. The independent debugger oracle remains
separate from product resolution.

X semantic discovery (2026-09-17) also uses the existing Social Metrics scope
cursor port. The X adapter starts from collapsed causal roots or the initial
document root and discovers action buttons incrementally with an unfiltered
Element NodeIterator. Each step visits at most 32 elements and resolves at most
one action; no global scope/button/result cutoff discards the tail. Broad
residual content remains included, while nested article/group inputs share a
single traversal. Local ambiguity, nearby-button and text limits remain semantic
policy, and their individual selector reads are still atomic. Existing generation
cancellation, apply-time freshness and queued mutation replay own lifecycle;
no second scanner, observer or persistent classification cache is introduced.
Coverage and measurement limits are recorded in
`reports/content-dom-runtime-p5-2026-09-17.md`.

Regression coverage: `tests/shortFormTargetingOwnership.test.js` and
`tests/socialMetricsYoutubeShortsOwnership.test.js`, alongside the existing
YouTube selector safety, Instagram, Social Metrics metadata and targeting
performance suites. Offline call-count evidence is in
`reports/short-form-targeting-audit-2026-09-16.md`; it is not browser timing proof.

| Area | Current state | Decision |
| --- | --- | --- |
| Host normalization and site identity | `targeting/siteIdentityCatalog.js` owns selector-free aliases and canonical site ids | keep as the only cross-owner site identity seam |
| Target profile schema | `targeting/contracts/targetProfileContracts.js` validates and freezes owner-local declarations under explicit merge policies | keep mechanics shared and target meaning owner-local |
| Social Metrics | selector and semantic candidates are independently collected, unioned, attributed, reconciled, and projected by explicit lifecycle/diagnostics/owned-mutation/scan runtime peers | keep the frozen-port composition and adapter-owned profile fragments |
| YouTube metadata | explicit row hints are followed by structural and semantic row resolution, then reversible row/item/separator reconciliation | keep in the YouTube adapter; a class name is a hint, not sole authority |
| Visual Media | deterministic context and geometry gates with bounded observation | keep owner-local; add independent opportunity evidence before claiming drift |
| Click targeting | site hints plus weighted semantic evidence and a fail-closed boundary result | keep scoring owner-local; do not call the score calibrated confidence |
| Text targeting | direct selector roots, bounded mutation work, original-text ownership, and exact restore are split across resolver, queue, and ledger peers | keep deterministic and preserve strict canonical context admission |
| Short-form | lifecycle/actuation consumes frozen generic and platform action intents while the debugger oracle stays independent | keep product/oracle classifiers independent and platform resolvers mutation-free |
| Video | one shared live video registry with bounded subscriber retry | keep as a video registry, not a general target scanner |
| FeedFlow | owner-local structural learning, drift suspicion, multi-session certificate, quarantine, and immediate preflight | keep as the reference for high-authority recovery, not as a generic engine |
| Runtime Debugger | single diagnostic shell; Social Metrics and Short-form publish the shared health envelope, while other probes often cannot distinguish idle from missed opportunity | extend only through owner facts and pure projectors; do not add another scanner or overlay |

## Confirmed Structural Findings

### 1. The owner-first profile cutover is complete

`src/domains/nudge/targeting/siteIdentityCatalog.js` now owns only hostname
normalization and canonical site ids. Generic validation, explicit merge
policy, immutable compilation, and provenance live in
`src/domains/nudge/targeting/contracts/targetProfileContracts.js`.

Target meaning is no longer coupled through one cross-owner profile. Behavior,
interaction, text, visual media, Social Metrics adapters, and FeedFlow each own
their declaration. In particular, behavior feed observation, interaction
reward/container judgment, visual media context, Social scan roots, and Feed
surface discovery are distinct fields behind distinct owner APIs. There is no
forwarding facade to a retired aggregate catalog.

### 2. Domain-local compilers are valid; silent backup paths are not

Media, click, text, social, feed, and short-form do not have the same target
meaning. Each owner may compile its own runtime plan. Those compilers must
consume a complete validated declaration and may not widen a malformed or
missing owner field to a broad generic selector.

Valid inheritance, selector extension, and map merge are declared in the
owner's compile policy. Cross-field meaning is not inferred by the generic
contract: when a visual container and media context intentionally share a
value, the Visual Media owner declares both. A missing canonical field at
runtime is not derivation and must fail loudly.

### 3. Mechanical selector behavior was duplicated

Many owners implement local `matches`, `closest`, `querySelector`, and
`querySelectorAll` wrappers. Their final failure policies are intentionally
different: click can pause, scroll can fail closed, text retains a failure
sentinel, and mutation sidecars can abort only one scan.

Only the mechanical layer may be shared:

- selector shape and dependency compilation
- a future discriminated execution outcome
- connected mutation-root normalization and ancestor collapse

The shared layer must never choose fail-open, fail-closed, retry, scoring,
diagnostics ownership, or actuation.

### 4. Observer interest must be compiled from actual dependencies

A selector or semantic matcher can depend on `title`, `datetime`, `data-e2e`,
`role`, or another attribute even when the subscriber observes only
`aria-label`, `data-testid`, and `href`. ObserverHub correctly filters per
subscriber, so an undeclared dependency can cause a real incremental miss.

The canonical observer-interest flow is now:

```text
explicit selector attribute dependencies
  + adapter-declared semantic mutation attributes
  + extension-owned reconciliation attributes
  -> observed attributes
  + explicit initial-scan-only high-churn attributes
```

`class` and `style` are initial-scan-only by default. An owner may opt them into
live observation only with a bounded cost rationale and focused evidence.
Attribute names are validated, deduplicated, and lowercased before entering the
HTML `MutationObserver.attributeFilter`; a malformed dependency fails loudly.
Reddit's semantic declaration independently includes the attributes read by its
matcher (`name`, `upvote`, `downvote`, and `number` included), and the document
and shadow-root observers consume that same declaration.

Social Metrics also treats the resolved scan root as configuration identity.
The compiled signature includes the canonical host and exact `rootSelector`, so
a runtime override that changes only `scanRoots` forces the required initial
scan instead of being mistaken for an unchanged plan. Malformed observer groups,
selector lists, and root selectors are contract failures, not silently omitted
interest plans.

### 5. Drift cannot be inferred from a zero hit count

Zero resolved targets can mean:

- the feature was inactive
- no relevant content existed
- observation had not settled
- the owner scope was unavailable
- a selector or semantic contract broke

Targeting health must therefore include an opportunity denominator. Product
owners may project facts they already hold, while real-site QA keeps an
independent oracle. Product and oracle target classifiers must not be deduped,
because that would make the product grade itself.

## Canonical Owner Model

| Concern | Owner | Current or target seam | Boundary |
| --- | --- | --- | --- |
| Site id and hostname aliases | site identity catalog | `src/domains/nudge/targeting/siteIdentityCatalog.js` | selector-free normalization and canonical site id only |
| Target profile mechanics | content-free target profile contract | `src/domains/nudge/targeting/contracts/targetProfileContracts.js` | strict owner schema, explicit merge policy, immutable result, and provenance; no target meaning |
| Behavior target declaration | Behavior owner | `src/domains/nudge/behavior/behaviorTargetProfiles.js` | behavior feed-observation selector only |
| Selector attribute dependencies | generic DOM mechanical contract | `src/lib/dom/selectorAttributeDependencies.js` | no owner failure policy or DOM actuation |
| Social observer interests | Social Metrics core | `src/domains/nudge/visual/socialMetrics/core/observerInterestPlan.js` | selector dependencies plus adapter semantic attributes |
| Media target declaration and qualification | Visual Media owner | `src/domains/nudge/visual/mediaTargetProfiles.js`, `mediaFilterController.js` | media context, geometry, exclusion, qualification, zero-duration filling additive filter-effect ownership, document-scoped capability proof, cache-owned active state, and exact cancellation remain local; repeated no-op scans do not read browser animation timing state, owned style-only mutations skip qualification only while current discovery membership survives, and host inline filters remain untouched as the underlying value |
| Text target declaration, qualification, and restore | Text owner | `src/domains/nudge/text/textTargetProfiles.js`, `src/domains/nudge/textShuffleManager.js` | text eligibility and original-text ownership remain local |
| Click target declaration and judgment | Interaction owner | `src/domains/nudge/interaction/interactionTargetProfiles.js`, `ClickBoundaryClassifier.js`, `clickTargetResolver.js` | action meaning and brake policy remain local |
| Social target declaration, judgment, and row cleanup | Social host adapters | `src/domains/nudge/visual/socialMetrics/adapters/socialMetricTargetProfiles.js`, the named `youtubeProfile.js` / `xProfile.js` / `instagramProfile.js` / `facebookProfile.js` / `tiktokProfile.js` / `redditProfile.js` modules, and host adapters | metric vocabulary, semantic classification, replacement, collapse, and restore remain local |
| Feed surface and recovery | FeedFlow registry/topology owners | `src/domains/nudge/feed-flow/**` | feed actuation safety and certification remain local |
| Short-form route/target/restore | Short-form owner | `src/domains/nudge/short-form/**` | destructive classification remains platform-specific |
| Target health vocabulary | cross-nudge content-free contract | `src/domains/nudge/core/targetingHealthContract.js` | exact frozen vocabulary and fail-loud create/validate/project mechanics; no DOM, selector, text, path, storage, or recovery authority |
| Owner health projections | Social Metrics and Runtime Debugger | `src/domains/nudge/visual/socialMetrics/core/targetingHealthProjector.js`, `src/domains/nudge/runtime-debugger/core/runtimeDebuggerShortFormTargetingHealth.js` | project already-held scalar facts only; no new scan or classifier authority |
| Independent opportunity proof | Runtime Debugger and real-site QA | existing debugger oracle and `scripts/e2e/sites/**` | must not reuse product classification authority |
| Independent YouTube drift corpus | QA corpus protocol | `scripts/qa/protocols/youtubeSelectorDriftCorpusQaProtocol.mjs` | extension-free product-influence-zero candidate collection; public disposable or exact existing authenticated route; human review required |

## Target Health Contract

The shared health envelope is content-free and materialized only at an
owner decision or debug snapshot boundary. It does not wrap every hot-path
candidate.

Minimum vocabulary:

```text
ownerId / contractVersion / siteId
activation: unknown | inactive | active
opportunity: unknown | absent | observed
opportunitySource: owner | shadow | independent
resolution: unknown | resolved | unresolved | invalid | unavailable
effect: unknown | not_applicable | pending | applied | restored | failed
settled / pendingCount / evidenceGapCount
validity: inactive | unavailable | armed_idle | insufficient | broken | measured
drift: not_evaluable | clear | suspected
reasonCode
```

Forbidden payloads:

- DOM nodes or serialized DOM paths
- selector strings
- page text
- URL paths
- raw class/id values

The contract may state `drift=suspected`; it cannot promote a selector, mutate
a profile, persist a replacement, or authorize actuation.

`validity=measured` describes settled, exact terminal effects for the observed
target set. It does not prove that discovery found every opportunity.
`drift=clear` additionally requires `opportunitySource=independent` and the
existing terminal evidence invariants. Owner or shadow hit counts cannot serve
as their own completeness denominator. Social Metrics retains measured
apply/restore evidence with `drift=not_evaluable` and the explicit reasons
`observed_target_effect_applied_coverage_unknown` or
`observed_target_effect_restored_coverage_unknown`. Its projector performs no
new DOM scan; independent corpus/site QA owns recall and false-positive proof.

## Recovery Authority Levels

| Level | Allowed response | Required evidence |
| --- | --- | --- |
| Observe | record invalid selector, unavailable owner scope, or unresolved opportunity | one owner-local fact |
| Shadow compare | compare existing selector and semantic/structural candidates without changing output | bounded same-session evidence |
| Suspect drift | expose a diagnostic/QA failure | active, settled, known opportunity, unresolved result, repeated across epochs |
| Reconcile | repeat an idempotent apply/restore against an already-owned target | exact ownership and reversible mutation |
| Same-session recovery | use an already-declared structural path for reversible style/attribute/hide effects | bounded proof and immediate revalidation |
| Certified recovery | authorize behavior-changing or destructive actuation | owner-specific multi-session certificate, decay/TTL, quarantine, and immediate preflight |

Generic runtime selector generation, automatic profile writes, and remote
selector hotpatches are not approved recovery seams.

## Current Filesystem

The implemented owner-first shape is:

```text
src/domains/nudge/core/
  targetingHealthContract.js

src/domains/nudge/targeting/
  siteIdentityCatalog.js
  contracts/
    targetProfileContracts.js

src/domains/nudge/behavior/
  behaviorTargetProfiles.js

src/domains/nudge/visual/
  mediaTargetProfiles.js

src/domains/nudge/text/
  textTargetProfiles.js
  textShuffleTargetResolver.js
  textShuffleMutationQueue.js
  textShuffleOwnershipLedger.js

src/domains/nudge/interaction/
  interactionTargetProfiles.js

src/domains/nudge/visual/socialMetrics/adapters/
  socialMetricTargetProfiles.js
  youtubeProfile.js
  xProfile.js
  instagramProfile.js
  facebookProfile.js
  tiktokProfile.js
  redditProfile.js

src/domains/nudge/visual/socialMetrics/core/
  targetingHealthProjector.js

src/domains/nudge/runtime-debugger/core/
  runtimeDebuggerShortFormTargetingHealth.js

src/domains/nudge/feed-flow/registry/
  feedSurfaceProfiles.js

src/domains/nudge/short-form/
  rules.js
  shortFormTargetResolver.js
  platforms/youtubeShortFormResolver.js
  platforms/tiktokShortFormResolver.js
```

Site files are not split merely to reduce line count. A file moves when its
field meaning, compile policy, and runtime owner move together. The Text
resolver/queue/ledger and Short-form platform resolvers above are current
runtime owners: lifecycle managers compose them without private compatibility
facades, and Runtime Debugger/QA classifiers remain independent.

## Roadmap

### Phase 0 — Contract floor and dead-data removal

Status: completed by the first groundwork change.

- strict owner target-profile schemas and exact Social Metrics option keys are enforced
- the explicit merge-policy table requires complete field coverage
- unknown, malformed, empty, duplicate, and alias-colliding declarations fail loudly
- supported site ids are exposed as a frozen selector-free identity vocabulary
- dead Social Metrics aliases and the unused raw config accessor are removed
- Social Metrics observer interests compile from selector and semantic attribute
  dependencies
- high-churn attributes are explicit initial-scan-only dependencies
- focused contract tests and architecture guards cover this floor

### Phase 1 — Content-free targeting health

Status: implemented, focused-verified, and independently exercised on public
real sites from the 2026-08-11 working tree. A clean-commit shipping rerun is a
separate release gate.

- `core/targetingHealthContract.js` owns the frozen versioned vocabulary and
  fail-loud create/validate/project contract
- Social Metrics projects existing selector/semantic/write evidence without a
  new scan
- Runtime Debugger projects the independent Short-form opportunity/outcome
  completeness ledger without sharing the product classifier
- Runtime Debugger and site-run analysis reuse the same six-state validity
  vocabulary
- Social terminal health is attributable only to the latest exact operation
  from the current measurement epoch, site id, activation signature, and
  execution ordinal; cumulative audit totals and an older last decision cannot
  prove the current effect. Within that operation, the diagnostic owner folds
  only the latest semantic `apply`/`clear` disposition for each exact effect
  target and serializes content-free scalar counts. Only a homogeneous,
  fully-classified apply or clear target set with zero unclassified
  reconciliation writes may become measured. Mixed or unknown target
  dispositions, unidentified effect targets, and every actual post-chunk
  reconciliation write remain insufficient. Apply/cleanup phase counters are
  scan-cost facts only and are not terminal-effect authority.
- the Social and Short-form debugger consumers validate exact nonnegative safe-
  integer operation deltas, require `measured` to have session work, and reject
  a probe-status/health mismatch. The operation delta is owner scan work, not an
  opportunity denominator; an independent `armed_idle` opportunity ledger may
  therefore coexist with positive owner scan work.
- canonical Social inactivity is accepted only with the owner's exact inactive
  envelope; an active owner envelope remains a fail-loud activation mismatch.
  The current-session owner delta is retained beside inactive health rather than
  being rewritten to zero.
- a single Short-form failure remains `drift=not_evaluable`; Phase 1 does not
  gain repeated-epoch drift or recovery authority
- the diagnostic `release-core` acceptance completed every non-blocked scenario
  without a targeting-health contract error or extension error. Social active
  phases produced both measured homogeneous-apply evidence and conservative
  insufficient evidence for ambiguous reconciliation; disabled phases remained
  exact inactive. Short-form produced both measured opportunity completion and
  independent armed-idle states without operation-count coercion

No new DOM traversal, persistence, or actuation is introduced in this phase.

### Phase 2 — Site identity and owner-first profile cutover

Status: implemented and focused-verified. Independent public-site targeting is
accepted for Example, YouTube, and TikTok on the 2026-08-11 working tree;
Reddit's named headless/disposable lanes remain externally blocked by HTTP 403.
A 2026-08-12 product-QA-protocol-free operator page in the headed
managed-persistent QA Chrome rendered the same signed-out `/r/popular/` route
normally, which makes the blocker environment-specific rather than selector or
Entropy failure. That manual persistent-profile observation is diagnostic, not
formal owned-lane acceptance, so the full cross-site matrix and a clean-commit
shipping rerun remain pending.

- `targeting/siteIdentityCatalog.js` owns selector-free host normalization and
  canonical site id resolution
- `targeting/contracts/targetProfileContracts.js` owns shared compile mechanics
  but no target meaning
- empty host input remains the declared unknown-site boundary, while non-string,
  URL-shaped, multiply terminal-dotted, or otherwise malformed hostname input
  fails loudly; one terminal dot is canonicalized before alias resolution
- profile declarations accept only canonical own enumerable data, dense arrays,
  and schema-valid values; compiled schemas, merge policies, and profiles are
  immutable, and empty no-op map/selector overrides are rejected
- behavior, media, text, interaction, Social adapters, and FeedFlow own their
  respective profile declarations
- Media, Text, and Interaction runtime overrides pass their owner validators
  instead of falling back to another field, while FeedFlow assigns every
  supported site explicitly and validates route pathname input
- Social Metrics snapshots its compiled plan, selector lists, filter keys, and
  pattern map as immutable owner data before runtime consumption
- Social host vocabulary is colocated in adapter profile modules
- the aggregate settings-owned catalog and compiler have been deleted without
  a forwarding facade
- the public `targeting-core` acceptance observed exact positive effects,
  disable cleanup, and re-enable on every reachable Media/Text scenario, with
  independent negative controls unchanged. The YouTube metadata layout cycle
  separately proved one native view/time-only opportunity collapsed, restored,
  and collapsed again. The current-tree TikTok FeedFlow evidence is a correctness
  characterization rather than a named acceptance PASS: three measured sessions
  matched 11/11 detector events exactly once (no false negative, false positive,
  or duplicate), and an additional zero-opportunity session stayed armed idle
  with zero detector events. Retained named-target cohorts were `5/1/1` and
  `5/1/0`; they shared one browser/profile and one TikTok service-worker target
  inside each cohort even though page targets were fresh. The canonical target
  now owns a fresh disposable browser/profile epoch for every repeat while
  preserving the wheel journey and independent oracle. Each completed epoch is
  linked to content-free digests derived from the harness-verified browser owner
  token and disposable profile path; lower and upper QA boundaries reject digest
  reuse, retained topology, or isolation evidence on an unrelated target. The
  aggregate reproduction command preserves the requested repeat count.
  A bounded fresh-isolation invocation then produced `0/5/5` opportunities. The
  measured repeats matched 10/10 exactly once with no false negative, false
  positive, or duplicate; the zero-opportunity repeat stayed true idle for all
  seven trusted inputs. Its only hard contract was old-document protection
  supersession leaking as extension console errors. The runtime now consumes
  only exact distinct expected/current document proof as a typed non-error and
  keeps same-document or malformed evidence hard. Phase 1/2 therefore closes on
  code plus available-opportunity correctness evidence; clean-commit canonical
  acceptance remains pending until every repeat contains at least two measured
  opportunities and the full named target passes

### Phase 3 — Runtime object and large-owner decomposition

Status: implemented in the current runtime.

- Social Metrics now composes lifecycle, diagnostics, owned-mutation, and scan
  as explicit closure-state peers behind frozen ports; its default facade is a
  factory-created singleton with no `this`-bound mixin or `_scan*` forwarding.
  Uncapped dirty-root discovery may collapse nested sources completely. Capped
  semantic discovery instead resolves local owners before broad subtree
  discovery within its declared cap and caches nested selector ancestry. The
  3 ms candidate slices coalesce row/cluster reconciliation behind one 48 ms
  scheduling threshold plus the terminal boundary rather than multiplying
  cleanup on every fast slice or deferring it across repeated 200 ms idle gaps.
- Text Shuffle now separates the canonical target resolver, bounded mutation
  queue, and ownership ledger from lifecycle/observer orchestration. The
  resolver rejects missing or alternate target contexts, the queue preserves
  the exact work budgets and one coalesced replay for mutations behind an
  active cursor, and the ledger alone owns conditional restore, SPA rewrite
  release, marker-independent local removed-subtree restore, and
  parent/target-owner local indexes. Relational child-list
  revalidation uses deepest dependency roots and batch-deduped local nodes, so
  it preserves both eligibility directions without scanning the global ledger.
- Short-form lifecycle/actuation now consumes frozen action intents from the
  generic target resolver and explicit YouTube/TikTok platform resolvers.
- Runtime Debugger and QA classifiers remain independent from product
  resolvers; no product owner imports a debugger oracle and no oracle imports a
  product platform resolver.

### Phase 4 — Drift policy and bounded recovery

Status: implemented as an owner-local Social Metrics policy catalog for
YouTube, X, and Instagram. YouTube retains its original pilot and X/Instagram
remain `candidate_only` until their declared independent strata and repeated
epochs are complete.

- `selectorDriftRecoveryContract.js` owns the closed policy vocabulary:
  YouTube `feedbackCounts`, `viewCounts`, and `timeSignals`; X action-group
  feedback/view counts; and Instagram feed, Reel, profile-stat, grid-overlay,
  and dialog feedback/audience counts. Every entry requires semantic-only
  provenance, an exact declared surface, and a three-independent-epoch
  certification threshold.
- the product scanner still evaluates the already-declared explicit selector
  set and owner-local semantic set once, then unions them. Phase 4 adds no new
  whole-document traversal, timer, polling loop, observer, or storage write.
- during the same terminal scan operation, an operation-local `WeakMap` binds
  each candidate to `selector_only`, `semantic_only`, or overlap provenance.
  The diagnostics owner joins only a semantic-only candidate to the exact
  document-node identity written through the Social Metrics owned-mutation
  ledger. Candidate presence by itself is not recovery proof.
- every semantic action candidate must clear its adapter-owned action-kind,
  negative-vocabulary, numeric-leaf, connected-root, and foreign-button gates.
  The best score must also beat the runner-up by the owner-declared minimum
  margin. A tie or near-tie produces no semantic target and no actuation.
- product recovery remains the existing reversible owner operation. It may
  apply or restore only Social Metrics-owned text/style/marker state; it does
  not click, redirect, remove a feed endpoint, or transfer authority to a
  generic recovery engine.
- a run reports recovery only when the semantic-only candidate reaches an
  exact terminal apply target with known write disposition and all owner queues
  settle. Release/QA certification additionally requires applied effect,
  user-settings disable restore, re-enable reapplication, and three independently owned disposable-browser epochs.
- certification emits `selector_drift_recovered_human_review_required`. It does
  not generate a runtime selector, update the canonical profile, persist page
  text/class/DOM paths, or authorize a remote hotpatch. Canonical profile
  changes remain human-reviewed source changes.
- fixed hydration delays are not drift authority. The existing owner queue,
  terminal operation boundary, owned-mutation pending count, and final QA settle
  define stabilization. A candidate that has not reached this boundary is
  pending or not evaluable.
- the owner test contract includes a same-document metamorphic
  `BEFORE -> AFTER` matrix. It mechanically replaces canonical YouTube watch,
  Shorts, and metadata surfaces with class-churned, wrapped/reparented,
  hidden-node-inserted, locale-order-varied, or late-hydrated equivalents.
  Ground-truth oracle attributes are resolved and removed before the product
  runtime runs. The matrix therefore checks the real resolver and mutation
  ingress against an independent expected node, including ambiguity and
  foreign-action negative controls, exact apply/restore parity, and re-enable;
  it does not copy the product score into the oracle.
- synthetic transformations are a deterministic regression layer, not proof
  that the scenario corpus represents current YouTube experiments. Sanitized
  real captures must be collected by an independently owned QA workflow,
  reduced to the bounded target/ancestor/sibling context, and reviewed before
  entering the fixture corpus. CI must never download live DOM or retain full
  pages, account data, experiment flags, raw URLs, or page text as a selector
  authority.
- an independently sanitized corpus remains explicitly `candidate_only` until
  its declared strata are represented. The current signed-out corpus contains
  English and Korean watch metadata/actions plus a Korean Shorts player Like
  rail. Across seven admitted fixtures it proves three exact positives, zero
  false negatives, zero false positives, two ambiguity/fail-closed cases, zero
  duplicates, and exact apply/restore/re-enable parity. It still does not
  certify current YouTube drift because signed-in and broader experiment
  variants are absent. Candidate fixtures use hard assertions against the real
  owner; audit-only logging is not a test.
- the X/Instagram authenticated corpus contains seven human-reviewed fixtures:
  five positive owner-local targets and two ambiguity/fail-closed cases. The
  product owner produced zero false positives, zero false negatives, zero
  duplicate targets, and exact apply/restore/re-enable parity for all seven.
  Live X, Instagram feed, and Instagram Reels routes passed the independent
  opportunity oracle. Follow-up protocol-owned documents bring Instagram feed
  and Reels to three PASS epochs each; X has two signed-in PASS epochs plus one
  signed-out `INCONCLUSIVE` epoch. Instagram profile stats and hover-grid
  structure were observed across three epochs, but the opened post dialog did
  not expose a unique Like-to-number ownership edge and therefore remained
  `INCONCLUSIVE`. This refusal is part of the contract, not missing test
  coverage to be bypassed.
- lifecycle-local semantic-only writes do not become a drift certificate when
  the terminal post-navigation/reload operation no longer needs semantic-only
  recovery. This is evidence that bounded recovery executed, not proof that a
  stable canonical selector drift survived to the final effect-parity
  boundary. Navigation/runtime errors remain separately owned failures.
- SVG path fingerprints and page experiment flags are not product authority.
  They may be considered later as bounded QA-only evidence, but neither can
  identify or authorize a Social Metrics target.
- use FeedFlow-style certification only where behavior-changing recovery has a
  stable structural invariant and a typed persistence owner
- accept a release optimization only when the resolved-target/effect/restore
  set remains equivalent while total owner work or terminal latency improves;
  a smaller time slice alone is responsiveness evidence, not total-cost evidence

#### Phase 4 owner catalog and remaining certification work

The product scope now includes three adapter-owned policies rather than one
universal recovery engine:

1. **YouTube Social Metrics.** Watch, Shorts, and metadata semantics remain in
   `youtubeAdapter.js` and retain the original repeated-epoch pilot contract.
2. **X Social Metrics.** `xAdapter.js` owns post action-group identity and a
   nonzero score margin. `data-testid`, class tokens, and label substrings are
   only evidence. Equal numeric leaves and adjacent Share/body numbers remain
   fail-closed.
3. **Instagram Social Metrics.** `instagramAdapter.js` keeps feed, Reels,
   profile stats, grid overlays, and dialogs as five distinct recovery
   surfaces. Like/Comment metrics require one visible numeric leaf within the
   action boundary; Save/Share, captions, hidden copies, and unowned dialog
   numbers are negative or ambiguity evidence.

The shared catalog declares only mechanical eligibility: site id, filter keys,
surfaces, and epoch threshold. It does not share scores or target meaning across
sites. A bare allowlist, learned selector, runtime profile write, or remote
hotpatch remains prohibited.

X and Instagram may move from `candidate_only` to certified only when all of
these entry conditions hold:

- the current release build and canonical lifecycle/site gates are green;
- the platform owner has a sanitized independent corpus rather than only
  product-authored fixtures;
- the adapter has explicit ambiguity and adjacent-action negative controls;
- apply, disable restore, re-enable, duplicate absence, and exact target
  identity are testable through the existing mutation ledger;
- repeated document epochs must be supplemented by independent locale,
  experiment-bucket, or time-separated strata rather than treating repeated
  pages in one authenticated profile as universal site certification;
- any signed-in capture uses a declared browser owner; an attach-only target
  must not mutate an operator page, while a protocol-owned background target
  must prove exact create/navigate/no-activation/no-focus/close receipts.

TikTok, Reddit, Facebook, and other owners may be evaluated only after this
policy catalog continues to demonstrate that shared proof mechanics do not
move site meaning out of the adapter.

Main-thread cooperative scheduling is a separate post-release performance
backlog (`docs/product/backlog/main-thread-cooperative-scheduling-backlog.md`).
It must not be coupled to selector-recovery expansion or used to weaken
candidate identity, cancellation, effect parity, or fail-closed behavior.

### Phase 5 — Maintenance cadence

- run focused selector/profile fixtures on every relevant change
- run independent real-site targeting suites before a release and when health
  evidence reports a regression
- prefer semantic redundancy and evidence-triggered releases over frequent
  speculative selector churn
- keep per-selector deep probes bounded and development-only

## Explicit Non-Goals

- one score shared by media, text, click, feed, social, and short-form
- a whole-document generic scanner
- production re-query of every configured selector for diagnostics
- a machine-learned selector generator in the extension
- raw DOM, selector, text, or path persistence
- remote selector hotpatch as a second source of truth
- automatic Store releases for every zero-hit observation
- merging product and independent QA classifiers

## Verification

The implemented Phase 0-2 floor is covered by focused contracts and owner
regressions including:

- `tests/targetProfileContracts.test.js`
- `tests/siteTargetProfiles.test.js`
- `tests/targetingHealthContract.test.js`
- `tests/socialMetricsTargetingHealthProjector.test.js`
- `tests/runtimeDebuggerShortFormTargetingHealth.test.js`
- `tests/runtimeDebuggerShortFormOracle.test.js`
- `tests/runtimeDebuggerProbeCatalog.test.js`
- `tests/siteRuntimeE2E.test.js`
- `tests/selectorAttributeDependencies.test.js`
- `tests/socialMetricObserverInterestPlan.test.js`
- `tests/socialMetricMutationGroupRouter.test.js`
- `tests/socialMetricsManager.xMetadata.test.js`
- `tests/feedSurfaceProfiles.test.js`
- `tests/clickTargetResolverProfile.test.js`
- `scripts/ci/check-friction-runtime-architecture.mjs`

The implemented Phase 3 decomposition is additionally covered by:

- `tests/socialMetricsManager.apiContract.test.js`
- `tests/socialMetricsManagerDebugInstrumentation.test.js`
- `tests/socialMetricsDiagnosticsSnapshotRuntime.test.js`
- `tests/socialMetricsRuntimePeerContracts.test.js`
- `tests/textShuffleDirectSelectors.test.js`
- `tests/textShuffleMutationQueue.test.js`
- `tests/textShuffleOwnershipLedger.test.js`
- `tests/textShuffleManagerLifecycle.test.js`
- `tests/shortFormBlockManagerLifecycle.test.js`
- `tests/shortFormYoutubeSelectorSafety.test.js`
- `tests/shortFormTikTokRules.test.js`

These are source-level and synthetic checks. They are not evidence that the
owner-first cutover has been certified on current real-site DOMs.
