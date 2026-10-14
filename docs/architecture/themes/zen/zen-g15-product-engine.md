# Zen Bonsai Product Engine — Plume and G15.4 comparison

- Status: Active
- Owner: zen theme architecture
- Last validated against code: 2026-10-13
- Path policy: current-only
- Canonical for: shipping Zen bonsai model identity, promoted-engine boundary,
  product lifecycle adaptation, topology generation, and scene-command rendering

## Product identity

`plume` is the only production bonsai model and the explicit default for Home and
Experiment. `g15_4`, `classic2` and `classic` are comparison models; `vnext` remains
Research-only. Catalog admission must fail loudly for unknown IDs and must never
substitute a comparison or research model when Plume fails.

Plume biotic publication uses the accepted topology's `lifeState` alongside its
observed flower/development receipt. Home and Analysis retain the accepted picture
during a pending life projection; they must not publish it with a newly requested
or temporarily withheld life input. Missing life on an accepted topology is an
explicit error, while a not-yet-materialized topology is the preparation state.

The product entry map is
[`plume/README.md`](../../../../src/themes/plugins/zen/model/bonsai/plume/README.md).
Shared hooks under `runtime/classic/` still host Plume; their filename is not a
model-selection contract. `ZenBonsaiModelCatalog` and the selected topology own
that decision. The inherited `generation/source/research/` directory is promoted,
isolated product generation code, not permission to import the detached research
workspace. Historical G15.4 sections below describe the explicit comparison path.

### Plume adoption owners — 2026-09-27

The promoted source lives at `src/themes/plugins/zen/model/bonsai/plume/`.
`ZenBonsaiPlumeSpecies.js` owns study preparation per durable seed and projects
the canonical life state into a displayed snapshot. Its isolated F4 kernel under
`generation/` is generation-only. It does not import the research workspace at
runtime. The pure `ZenBonsaiPlumeIdentity.js` owns the seed-domain contract and
projection, re-exported by `ZenBonsaiPlumeLifeAdapter.js` for existing callers.
The adapter owns life presentation; the canonical five-qualified-day growth policy,
aggregate identity and storage owners remain authoritative.

Progression's `progressionBonsaiRelease.js` owns five non-consecutive qualified-use
days and the first full structural form at day 5. Recent activation remains a
recoverable appearance input; independent natural weather owns rain, wind and
weather-responsive petal motion. Neither can rewrite structural release age.
The separate seven-evidence-day calibration/confidence windows remain unchanged.
A 30-day calendar-driven post-maturity growth or seasonal cycle is not implemented.

The five-day release ratio is linear; Cultivation projects it through smoothstep
to structural growth `0.5, 0.552, 0.676, 0.824, 0.948, 1`. The internal three-year
spring/summer/winter sequence is a recorded anatomy/development timeline, not a
calendar feature. Spring creates shoots and blossoms; summer records flower-bud
induction and increased wood radius; winter releases bud dormancy before the
next spring. Live growth selects and poses this history toward the fixed third
spring at stage `0.45`. Wood birth/girth checks and fixed camera/reading envelopes
consume the complete history. Removing seasonal observations changes those
contracts; optimizing their preparation must preserve the existing tree and
growth curve.

First-bloom invitation uses the five real representative flowers from
`ZenBonsaiPlumeBloomRegions`. The shared Canvas/Pixi pose presents these closed
buds at 2.4 times their ordinary closed radius, capped by their own final radius.
The enlarged radius interpolates into the final flower throughout opening;
selection never removes a size multiplier abruptly. Other flowers and the
ordinary mature/null presentation retain their exact authored poses.
`ZenBonsaiPlumeBloomPresentation` supplies a fading opacity lift and two 1500 ms
active-time light breaths, staggered 85 ms per region and finished by 3340 ms.
No invitation sprite, filter, atlas upload or separate renderer loop is added.
Pixi `setPlan` synchronously admits flower IDs, rigs, matrices, alpha and atlas
tiles through the private BloomRegions/BloomPresentation validation seams.
Ordinary mature frames have null bloom progress and create no spatial partition
or per-flower delay entries. The first non-null progress compiles and binds the
current plan once; subsequent frames reuse that binding. Plan replacement and
dispose clear it. Canvas and interaction keep the same canonical compilers and
exact partition/presentation output.

The shared Home worker's completed-bloom ACK deduplication retains only the four
scalar scene/materialization/input/event identities. It does not retain a completed
scene or topology. Logical Bonsai disposal clears that identity, receipt and playback
even when another Home surface keeps the physical worker alive.

Dashboard's native `BonsaiFirstBloomPrompt` keeps the center clear to show the
actual bud, adds two matching rose/ivory halo breaths and a small petal-shaped
hover/focus light, then releases the halo into opening on selection. These five
CSS cues pause while the prompt is busy and honor reduced motion. The existing
boot/focus admission, five local activation bits and one durable claim remain
the event owners; decorative light never calculates release age or progression.

### Home diagnostics and current feedback coverage — 2026-10-09

Development Home exposes independent render growth (50–100%), bloom (0–100%)
and activation (0–100%) controls. `bonsai/debug/zenBonsaiDebugOverrides.js` owns
the local, nonpersistent growth/bloom projection; Home includes its exact input
in the materialization signature and the target owner admits it only as a
debug-build `debug_progression_preview` with a `read_only` ledger policy. Reset
returns to the canonical release/habit input. Growth/bloom capture the displayed
committed life state at first force, preserving its ledger-derived health and
imprint until the last force is reset; that baseline is part of the exact request.
The same durable seed study is
reprojected through the normal model worker and signed render-plan path. Public
Home, First Vision, locked scenes and named capture profiles exclude this panel.
Home owns growth, bloom and activation preview intent before presentation-event
admission; any active force excludes ordinary first-bloom presentation. The runtime
consumes Home's controlled activation directly, with local activation ownership
only on explicit standalone surfaces. Activation remains a render-only projection.
Unscored/null is
explicitly shown as unscored with unsuppressed default presentation, never as a
zero score. The panel compares its requested force with the accepted worker
frame's activation ratio and expressed Plume signal; this receipt is diagnostic
and never drives rendering. A forced zero remains a real override until reset.
Development Home admits reroll only after durable identity readiness through the
existing action policy and aggregate identity CAS; ephemeral First Vision/capture
identities cannot reroll. The command changes the stored seed, preserves growth
facts, guarantees a different seed, and exposes pending/error state.

Home's panel is placed in the Dashboard's reserved right port; the app owns its
open state, width and margins while the Bonsai runtime owns controls and commands.
Standalone/Experiment presentation stays inline. Controls follow actual backend
capabilities: frame-seam beds use architectural shell material and expose no
standalone planter material buttons; Plume's authored botanical paint exposes no
legacy ink/natural selector. Those selectors remain on supported comparison
surfaces. Style consumers include style in effect and scene/cache signatures.
Tree-alpha sampling follows the actual render-plan capability; Plume/G15 never
show the unsupported Sakura-only sampler.

Current Plume feedback coverage is narrower than the older comparison engines:

- Qualified-use release controls structural growth. Habit/score evidence supplies
  vitality, stress, dryness, bloom, branch sag and wind response in the life state.
- Plume consumes growth and bloom, derives wood saturation from health, and
  consumes wind response. Activation separately attenuates flower alpha/opening,
  wood saturation and sway. Existing flower identities remain fixed; low activation
  makes the same flowers faint rather than reducing their anatomical count.
- `branchSag` has no Plume posture consumer. Petal pigment has no activation tint.
  Structural imprint, growth segments and growth-event payloads do not currently
  change Plume anatomy or implement recovery shoots, dew, leaf-fall or moss feedback.

These are implementation gaps, not evidence of completed habit-driven morphology.
Adding posture must transform supported wood, flowers and attachment geometry
together through the signed display-plan owner; rotating flower-only family rigs
would separate them from the depth-composed wood. A display-density treatment
must retain canonical flower identities and avoid altering durable seed anatomy.

The record-to-cultivation path also has unresolved integration gaps. The current
Home materialization hook is the reconciliation caller; vitality closes only its
last pending outcome and treats skipped days as bounded neutral drift, rather
than replaying recorded closed activity-day outcomes. Its calendar-date boundary
does not carry the score owner's reset-hour activity-period identity. Calibration
uses rolling protected evidence, so a mature user can re-enter calibration after
inactivity. Structural imprint admission requires `evidenceDays > 7`, while the
normal status input exposes at most seven protected evidence days. These owners
need a closed-period evidence contract before long-term habit feedback can be
described as complete. Local debug previews do not repair that data flow.

`ZenBonsaiPlumeRenderPlan.js` consumes only the materialized snapshot and camera
envelopes and applies ephemeral activation through the shared activation contract.
It owns Plume's activation projection, reads seed projection directly from pure
Identity, and does not import the generation/life adapter. The compute adapter
does not export activation or import the render-plan owner.
RenderPlan signs the display plan and verifies a structured-cloned worker plan by
rebuilding the same command stream and comparing its complete canonical JSON.
The first worker clone retains that reconstruction and deep-freeze validation.
Only locally verified, deeply frozen topology identities may reuse a topology
signature. A single weak reference to the most recent accepted plan allows
repeated SCENE clones to reuse that verification only after the complete plan
and complete topology match by recursive key/value comparison. This path keeps
no serialized plan or topology strings. A signature match alone never admits a
plan; a new seed,
geometry, surface or option rebuilds the canonical stream. No scene or study is
retained by a seed cache, and accepted cloned inputs regain deep immutability.
`createZenBonsaiPlumePixiRenderer.js` admits
`pixi_plume` through the existing `zen_home_renderer` bonsai logical channel and
module-admission owner. There is no second Home worker or renderer fallback.
Its shared flower atlas and ordered wood textures are render resources; study,
F4 history and generation caches must not enter the worker closure. The public
artifact guard enforces that split under the existing byte/module budgets.
Viewport resize retains the bounded wood atlas, crop textures and sprites.
`surfacePending` rejects rendering and readback until a plan for the new dimensions
is admitted. Existing `setPlan` performs the full repack/repaint, retires surplus
resources and clears that pending state; unmount disposes pending resources.
No old-size frame, persistent cache or additional renderer is admitted.

Home and Experiment hooks own study lifetime and request canonical life projection
through `ZenBonsaiPlumeModelClient` and the strict `zen_bonsai_model` compute
surface. `PREPARE_PLUME_STUDY` combines generation and initial projection when
life is available; later structural changes use camera-free `PROJECT_PLUME_TOPOLOGY`.
`ZenBonsaiPlumeProductStudy.js` owns
`zen_bonsai_plume_product_study_v1`: all nine ordered observations retain their
complete nodes, segments, annual units, buds, flowers and attachments; F4 history,
ten mature camera envelopes and durable product identity remain exact. The tray
retains only its height and origin. Observation axes, events, ledgers, metrics,
Cloud audit receipts and policy do not cross the product transport boundary.
Generation still builds and validates the complete reference. The closed generated
preparation entry returns staging data only to GeneratedRequest, whose fixed product
finalizer constructs the retained graph before the last deep freeze. Discarded audit
wrappers do not receive that final freeze. Public/generated full-study entries keep
their complete graphs and original final-freeze semantics. This removes finalization
work only; it does not eliminate annual generation. Product preparation additionally
omits discarded Cloud audit copies and camera-only pose receipts through the
closed owners below; all nine complete organ observations and validation ledgers
are still produced.
The private response validator rejects full-study/unknown-schema transport;
the compute-only GeneratedRequest owns conversion and its named live adapter
supplies the shared projection body explicitly. Species returns the complete
generated study and never imports the transport module into its renderer closure. Product
snapshot metadata omits only those excluded observation audit fields. Complete
organ/development/life results, camera/reading envelopes and render commands stay
equal; topology identity/signatures are rebuilt over the actual compact payload.

`ZenBonsaiPlumeProjectionTransport.js` owns the strict subsequent-PROJECT boundary.
Its `zen_bonsai_plume_projection_study_v1` input preserves all nine observations,
F4 history, tray and product identity and prohibits camera fields. Species returns
`zen_bonsai_plume_projected_snapshot_v1`, also without cameras. The envelope binds
the exact projection key, opaque mounted-owner/preparation generation and canonical
source identity. Client acceptance checks current sequence, binding and retained
study identity. Assembly always attaches that binding's retained camera array;
full-result or optional-camera admission is forbidden. Initial PREPARE retains its
full product-study/topology shape and native shared camera alias. Immutable camera
identity is deliberately shared across later projections and the existing reading
envelope memo. Public Operations and renderer full-topology validation are unchanged.

`ZenBonsaiPlumeLifeAppearance.js` owns pure life normalization/paint projection and
complete immutable admission of native-cloned topologies. Private weak proofs visit
descendants even under frozen parents, retain no graph strongly, and allow only
admitted descendants to skip repeat traversal. PREPARE verifies identity/target/life
immediately and keeps the existing render-plan freeze; complete sharing proof is
obtained lazily before the first same-growth rebind, avoiding an extra boot graph
walk. Structural PROJECT assembly obtains the full proof once. ModelClient retains exactly one
current accepted pose. Equal normalized growth rebinds small topology/snapshot/live/
presentation/product-life wrappers and complete latest life/phenotype metadata to
that pose, without a Worker request. Changed growth still uses anatomical PROJECT.
Initial-form, branch establishment and bloom-transition geometry are applied once;
same-growth binding never reapplies them. Bloom/health update paint controls, while
phase, wind, confidence, imprint and events remain in canonical life for downstream
biotic/petal consumers. Renderer plans still undergo full canonical admission and
new materialization ACK; no old ACK or signature alone acknowledges changed life.

Model/seed lifetime is separate from active
preparation demand: a parked mounted surface retains its completed private study
and latest accepted projection, cancels unfinished work, and starts no hidden work.
Returning with the same projection key reuses that exact result without another
PREPARE, PROJECT or study clone; a changed life projects only when active again.
Active structural bursts keep at most one physical PROJECT in flight. Each newer demand
invalidates older acceptance; intermediate waiting demands are skipped and the
latest waits for the active result before submitting. A failed active request
propagates to its waiters; no automatic recovery or idle retention is introduced.
Parking/unmount immediately cancel both active work and waiting demand. Seed/model
changes and unmount discard the retained DTO.
The topology hook keeps one accepted graph in its lifetime-owned ref; React state
contains only a revision. Lifetime/seed cleanup clears that graph explicitly,
while parking keeps it available for immediate same-input reuse. Commit effects
retain only a client and scalar identity/revision. Client disposal also clears
its trace-only returned-projection reference; parking preserves it with the pose.
`WorkerRequestClient` terminates and releases the compute lease on idle,
cancellation or unmount. No model persistence,
experimental-worker dependency, idle worker cache or local-generation fallback is
admitted. The renderer-only `ZenBonsaiPlumeSpeciesDescriptor` keeps the generation
closure out of Main. Request/response identity binds seed and exact life/phenotype
inputs; stale responses are discarded. Same-seed pending projections retain the
last accepted topology with a distinct accepted/request key and remain
`modelMaterializationReady=false` until the current result is accepted, preventing
old geometry from acknowledging a new scene. Seed changes cannot reuse that frame.
Home keeps the last submitted topology, life and activation inputs together while
the same-seed projection is pending. Its submitted input ref is cleared when the
profile or tree seed changes, including while parked. Only an ACKed canvas for the same tree and
presentation scene may keep animating; new SCENE submission remains suppressed
and current materialization readiness remains false. Parking still stops motion.
Experiment likewise retains a complete accepted scene input snapshot for the same
profile/seed/model while a candidate is pending, without relabeling its identity.
Structured-clone costs remain part of this boundary and must be observed separately
from generation; the exact study/topology equivalence test guards visual identity.
`useZenBonsaiMaterializationRuntime` serializes ledger read, derivation and write
within a mounted materialization owner. A later input reads only after the prior
write completes, skipping obsolete queued inputs; canceled/unmounted inputs do
not start subsequent transactions. This does not replay skipped historical days
or repair the closed-period evidence gaps listed above.
`useZenBonsaiRenderPlan` reuses equivalent canonical frozen activation records
without replacing their original data. Extra fields, getters, symbols and
noncanonical inputs retain normal factory validation. Plume excludes the Classic
pot override from dependencies because its factory does not consume it.
Cloud clearance prepares one ordered wood/node index per annual growth pass and
appends each accepted shoot immediately, preserving the next bud's obstruction
checks and their order. Distance evaluation keeps the same scalar arithmetic
without per-pair vector allocations. Annual wood clearance evaluates the same
projection and all three residual coordinates before reading the clearance
radius. If any absolute residual reaches that radius, the strict distance test
cannot pass, so the full norm is unnecessary. Remaining pairs retain the original
`Math.hypot` comparison. Exclusion, zero-length errors, first-blocker order and
immediate accepted-wood append remain intact; initial support admission keeps its
original distance path. No prepared geometry enters the model DTO.
Cloud observation copying keeps the complete public source observation under
native `structuredClone`. Its factory-created, unique plain records copy
primitive fields in their original key slots; retained object, function and
symbol values pass through one native clone graph per existing collection.
Those graphs keep nested aliases, opaque scaffold values, built-in types and
clone failures without serializing each record's primitive fields again.
The helper never receives public source records. The factory creates every outer
record without duplication or an escape before observation copying, so retained
values cannot refer to those outer records. Collection order, season boundaries,
separate event/receipt clones and existing attachment construction remain intact.
This adds no cross-observation cache or shape restriction. Full Cloud/study,
camera and life-projection value/key/alias equivalence protects the boundary;
local copying measurements do not establish whole-browser boot improvement.

The model Worker enters through `ZenBonsaiPlumeGeneratedRequest.js`. This owner
accepts the native message's operation, payload and message ID, constructs its
own recorder through `createZenBonsaiPlumeWorkerDiagnostics`, and returns an
ephemeral `{ diagnostics, execute }` handle to `zenBonsaiModel.worker.js` alone.
It accepts no injected callback, producer, copy strategy or admission flag.
`ZenBonsaiPlumeModelOperationCore.js` shares operation validation between this
owner and public `ZenBonsaiPlumeModelOperations.js`.
Public Operations retains its injected-diagnostics parameter and fixes its study
producer and projector to public `createZenBonsaiPlumeStudy` and
`projectZenBonsaiPlumeTopology`; the request owner fixes its pair to private local
`createProductStudy` and `projectProductTopology`. These functions call
`createZenGeneratedBonsaiPlumePreparation` then the fixed product finalizer, and
the explicit full live adapter then `projectZenGeneratedBonsaiPlumePreparedTopology`.
The finalizer completely freezes retained descendants before registering the
camera-array identity in its private WeakSet. GeneratedRequest alone obtains
`requireZenGeneratedBonsaiPlumeFrozenCamera` and passes that exact identity into
the prepared projector, whose local traversal skips only that proven subtree.
Weak membership retains no graph and cannot be reconstructed from native clones
or shallow frozen wrappers. The prepared projector's root/identity check is an
assertion about its fixed trusted caller, not a generic deep-immutability test.
Public and full generated topology projections retain complete recursive freeze.
Subsequent private PROJECT admits its strict camera-free request and calls
`projectZenGeneratedBonsaiPlumeSnapshot` through the camera-free live adapter.
The public/private entries share complete assembly and one anatomical snapshot
body, including all anatomical validators, seed draws, history and camera geometry. Species has no
product-transport import. Public
`diagnostics.measure` return values, mutations and failures keep their existing
effect on subsequent public stages.
The measured `study_deep_freeze` stage includes compact construction on the private
path. Same-growth binding records `projection_life_rebound` with original anatomical
operation provenance and its own UI projection sequence; it is not a physical Worker
operation. UI accept/commit deduplication follows topology identity.

Both generated PREPARE and subsequent native-cloned PROJECT project through
`live/model.js:createZenGeneratedCherryPlumeLiveSnapshot`. It directly creates
the selected stage pose, avoiding a stage-1 template,
compiled object-copy index, template freeze and second pose copy for this one-use
request. Its private `requireZenGeneratedCherryPlumeFlowerDevelopmentInput`
seam admits the seed and all selected-pose flower IDs before F4/history processing,
including flowers that processing discards. The shared flower resolver computes
timing once for retained flowers, without creating, freezing or registering an
intermediate schedule. Public compiled-pose and flower schedule APIs retain their
complete validation, timing and error order.
Every native Worker request has a one-use study identity; a compiled
pose cannot be reused across terminated Worker lifetimes. The public live entry
keeps compiled-pose admission and error semantics. Both entries
share the same clock, F4/foundation, wood, flower and presentation body. No public
strategy flag, caller callback, idle cache or alternate anatomy is introduced.

The generated Species also fixes Scaffold extraction to
`canopy/f4-scaffold.js:extractGeneratedF4Scaffold`. Before the shared read-only
builder runs, this boundary visits every source object, including descendants of
already-frozen parents, and deeply freezes the complete closed graph. A local Set
preserves alias/cycle visitation; non-data values, unsupported prototypes and
accessors fail with `ZEN_CHERRY_F4_GENERATED_SOURCE_NON_DATA`, `_SHAPE` and
`_ACCESSOR`. No outside observer can retain or replace that producer graph.
The public extractor retains its before/after native JSON audit, original
getter/`toJSON` ordering, source-mutation signal and original error propagation.
Proof construction is part of generated extraction cost, not free preparation.
The preparation identity fixture includes the existing camera `woodSegments`
field used by Home reading-space reserves. Removing that field alone restores
every previous study and projection digest across its three baseline seeds;
growth/anatomy values and the preparation optimizations retain their identity.

Only the request-owned Species entries call private
`createZenGeneratedCherryCloudModel` (complete study) and
`createZenGeneratedCherryCloudPreparation` (product staging). Their reference is the direct canonical
F4-to-Rhythm product graph, created with the explicit three-year natural renewal
inputs before any outside data observer can retain, mutate or replace it.
Public Species continues selecting public `createZenCherryCloudModel`, whose
complete source observations use native `structuredClone` resolved at the original
copy point. Its arbitrary-source built-ins, getters, unsupported-data failures and
copy ordering remain public contracts. There is no shape-based dispatch, diagnostic
brand, public fast-copy switch or native-clone recovery path.

`cloud/zenGeneratedRhythmObservationCopy.js` owns copying only this closed
generated observation graph. Ordinary objects/arrays and scalar data enter it;
accessors, Proxy and external metadata are excluded by the producer/recorder owner
contract, rather than certified by a generic runtime classifier. A new observation-local
Map preserves aliases and cycles while creating every object and array independently;
original enumerable key order, array length/holes and scalar values remain intact.
Unexpected function/symbol values, prototypes/symbol keys and `__proto__` keys fail
explicitly with `ZEN_CHERRY_CLOUD_GENERATED_OBSERVATION_NON_DATA`, `_SHAPE` and
`_KEY`. No graph is shared with the original observation, another observation or
the scaffold; outer Rhythm event/history aliases and Cloud-added native clone
scopes remain unchanged. Producer shape/descriptor changes must update this copy
owner, domain evidence, docs and guard together.

The Cloud preparation owner uses the same biological development body and all
complete validation ledgers. It independently copies every retained organ and
attachment collection, but omits source audit/event/metric copies, duplicate
initialization/phase receipt graphs and final top-level module/event clones.
Its owned axes array temporarily shares already validated source axis rows for
the complete ID validator; no row is mutated or retained in product transport.
Public and full generated Cloud keep their complete independent clone contract.
Fixed internal observation owners select this behavior; request data supplies
no strategy flag or copier. Staging is not a public/full Cloud replacement.

The generated wood owner precomputes each annual append-only row's segment
delta, denominator, threshold and outward-rounded conservative capsule bounds.
Points outside those bounds skip the unchanged strict narrow-phase arithmetic.
Accepted wood enters the view before the next bud. Generated input is canonical
finite plain geometry; public Cloud retains its original lazy reads, malformed
input/zero-length failures, radius getter ordering and first-blocker exit.
No spatial tree, global cache, sampling or collision rule change is introduced.

Only generated preparation selects
`plume/model.js:createZenGeneratedCherryPlumeCameraSnapshot`, through private
Cloud pose and Bloom camera entries. Its mature spring constants are fixed.
Shared pose bodies preserve all node/wood/flower/tip geometry, pedicels, seed
draws and anatomical validation while skipping discarded receipt lists,
centroids and summary statistics. Public/full-study poses retain their original
receipt shape, ordering and errors. Inactive-season envelopes remain complete.

F4 generation's existing context owns append-only `segmentIndex` and
`clusterSegmentCounts`, updated at the sole segment append boundary. Retirement
does not remove occupancy or historical segment identity. Completion is computed
once before an event and shared with that event's scheduler/coverage receipt;
post-event completion remains a new observation. Termination and fork decisions
reuse differentiation only for the same unchanged frontier. Continuations and
later queue builds recompute from their new state. Event/receipt order, preview
and execution random addresses, temporary wood rules and full graph output stay
exact. These indexes live only in one generation context; there is no persistent
or whole-queue cache.

The all-src architecture guard permits only static named imports of these private
seams: Worker → GeneratedRequest; GeneratedRequest → generated Species and
projector; Species → generated Scaffold, live pose and Cloud; Cloud → observation
copier; public Operations and GeneratedRequest → ModelOperationCore. GeneratedRequest alone
creates/adapts ProductStudy, Protocol alone admits cloned product studies, and
ModelClient alone consumes the strict product-result validator. Named aliases retain the original symbol
restriction. Namespace/default, dynamic/require and re-export routes through the
protected modules are forbidden. The handle/recorder never enters a study,
topology, renderer, storage or a module-level cache. Worker PING/error/RESULT timing
and the before-RESULT profile barrier retain their existing owner and recorder.
Copy-work measurements alone do not establish a browser first-frame improvement.
Camera envelopes prepare the nine exact
mature observations without unused mutable-copy/development plans. Public
retained-study projections admit those plans lazily; fresh generated preparation
uses only its direct selected-stage pose. Full study and growth
projection digests guard these preparation optimizations. Neither the canonical
geometry nor the composite first-frame readiness/budget changes.

The internal annual-kernel mapping in `rhythm/model.js` copies primitive data
values in their original key slots and structured-clones retained mutable fields
together, preserving their independence and shared references. Vectors and
reference arrays immediately rebuilt by the existing transforms/namespacing,
along with ledger transactions and deferred-bud IDs, avoid a discarded deep copy.
Each freshly owned destination row is finalized in place, retaining native clone,
namespace/transform evaluation and original key slots without intermediate spreads.
This helper is scoped to the kernel's plain enumerable data records; it is not a
generic structured-clone replacement. Every full annual observation, mature camera
envelope, life projection and validation remains intact. The study's data shape,
serialized size, compute transport and surface-owned lifetime remain unchanged;
copy-work reduction does not establish a browser first-frame timing improvement.

Rhythm bud mapping copies only the annual producers' `decisionCycles` number
arrays directly, in their original key slots before namespacing and rotation.
Both annual producers create one independent dense array per bud and append only
validated cycle integers; no other field shares that array. Every phase's complete
source observation remains independent. The full list is copied without a new bound
or truncation. Other retained object/function/symbol values keep their existing
native clone graph, and public scaffold records never enter this private path.
Full value/key/alias and seasonal-history checks protect the producer-owned seam.
Seed draws, transformations, observations, transport and readiness stay unchanged;
local copying measurements do not establish whole-browser boot gains.

`annual/zenAnnualObservationCopy.js` owns complete seasonal observation copying
for `annual/model.js` and `rhythm/annual-core.js` only. Both producers build the
same complete observation literal, including metrics and filtered phase events,
before calling it. Their closed factory graph consists of fresh plain scalar
rows and independent dense numeric vectors, decision histories and string-ID
arrays. The copy preserves row/key order and all optional scalar fields through
spreads, then copies each known owned array in its original slot. Every row,
collection, ledger, transaction and metric record is newly owned per observation;
there is no shared object inside this source graph and no escape before copying.
Organs reference other organs by string IDs. No historical records are dropped,
truncated, cached or shared between phases/years. Rhythm's live decision events
and `history` keep their existing same-row aliases outside the copied observations.
Public source/scaffold inputs and profile/policy fields retain native cloning and
their existing failure behavior. This helper is not an arbitrary-input cloning
boundary. Adding a producer mutable field or shared reference requires updating
this copy owner and graph contract together. Complete native-clone value/key/
alias equivalence, public-input errors, all annual variants/treatments/years, full
study/projection/camera identity and observation mutation independence protect
the seam. Storage, transport, study lifetime and readiness remain unchanged;
local generation gains alone do not establish whole-browser boot improvement.

Bloom observation builds only the node and bud lookup Maps that its posing
consumes. Direct insertion avoids temporary entry-pair arrays; segment,
annual-unit and flower collections retain full uniqueness validation through
Sets without unused record-value Maps. Validation still scans each dense model
collection completely before reporting duplicate IDs and keeps the existing
collection/node-position error order and SameValueZero identity rules. Input
structured cloning, snapshot iteration and all returned records remain unchanged.
Full study/camera/projection values, key order, aliases and deep-freeze identity
guard this allocation reduction; local phase timing is not a whole-boot gain.

Camera flower envelopes copy the canonical spring pedicel's `start` and `end`
vectors directly. Bloom posing owns that exact two-key shape and creates
independent vectors; Cloud and Plume posing replace only its end point. Inactive
and F4 envelopes have no flowers. The camera copy retains point independence,
key order and deep immutability without a separate structured-clone call for
each flower. Full study/projection and fitted-camera equivalence protect this
local change; it does not change model transport or preparation lifetime.

Home topology publication remains the source of app-wide petals through the
existing petal source API; the renderer does not emit a second falling-petal field.
Plume multiplies the existing life-based supply by observed flower availability
(`mean(alpha × petalOpacity)` over appearance-retained flowers) and the product bloom alpha. Empty, dormant,
seasonally absent and zero-bloom flowers supply zero petals; the source store's
existing 0.02 quantization remains unchanged.

Plume does not consume Classic latent learning, A/B or optimizer state. Its
capability gate stops those loads and in-flight A/B work and exits collection
mode when selected; explicit Classic comparisons can enable them again. Growth,
reroll and apply-to-main retain their existing product owners. This promotion
adds neither a persisted model state nor a second emission owner.

The G15.4 flow and detailed owners below apply to its explicit comparison path.
Product validation uses `dashboard/capture` and `dashboard/boot`; detached
`visual/zen/cherry-plume-live` evidence is research evidence, not Home acceptance.

### Model preparation timing evidence — 2026-10-03

`ZenBonsaiPlumeModelDiagnostics.js` owns the
`zen_bonsai_plume_model_timing_v1` diagnostic contract. It is enabled only when
`__ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__` is explicitly `true` and the requesting
client has an enabled-trace observer. `ZenBonsaiPlumeModelClient` creates an
operation id before request initialization and names each physical compute worker
`zen-plume-model-<client-identity>-<physical-generation>`. Early page
`operation_start`, `request_start` and `init_start` may precede worker allocation;
later events bind that operation to the exact physical name. These diagnostic ids
are separate from canonical seed/projection identity and do not admit results.

The existing `WorkerRequestClient` optional lifecycle observer covers page-side
initialization, posting, receipt and resolution. READY records model-worker
module-body entry after static dependencies have evaluated, PING receipt and READY
posting; it does not measure individual module fetches or dependency evaluation.
RESULT carries a bounded worker event envelope, separate from `result.study` and
`result.topology`. Operations measure full study generation and selected life
projection, while Species records their canonical generation, validation, camera,
presentation and freeze subphases. Worker event arrays have an 80-event limit;
the client's request identity lookup is bounded to 32 scalar entries, with weak
diagnostic links to returned topologies. No model data is added to the trace.

Each event retains its realm, local monotonic time and time origin. Accounting
uses page spans and worker-local durations; it must not infer transport or CPU
work by subtracting unlike realm clocks. The worker posts a small ordered
`MODEL_DIAGNOSTIC` receipt after RESULT with `result_post_end`, because RESULT
cannot contain the return time of its own native `postMessage`. That span measures
synchronous serialization/enqueue, not receiver deserialization. A receipt lost
to normal idle teardown remains missing/incomplete evidence. Response validation,
UI acceptance and the committed topology are distinct page stages; unexplained
time stays explicit instead of becoming zero or an invented generation duration.

The topology hook emits `ui_accept` before state publication and `ui_commit`
after an accepted matching projection commits. The client deduplicates each UI
stage per operation, marks only its first commit `initialUiCommit=true`, and links
same-key reuse to the operation that produced that topology (PREPARE for a combined
initial projection). A first PROJECT before any committed
topology also names its preparation operation and physical worker, including a
PREPARE that ran before life was available. Later life changes do not charge prior
startup or parked time to their request. None of this changes study/topology DTOs,
random draws, geometry, validation, seed/surface lifetime, storage or readiness.

`ZenBonsaiPlumeModelProfileBarrier.js` is exclusive to canonical CPU profiling.
Only the native binding installed by that collector enables its before-RESULT
wait. The collector stops and archives a segment on the exact attached worker,
restarts profiling for subsequent work and acknowledges the same request. The
worker records `profile_wait_start/end`; a 15-second acknowledgement limit fails
explicitly and clears its temporary acknowledgement/timer. Accounting separates
this diagnostic pause from ordinary work. Without the binding the helper returns
synchronously, so ordinary boot and production gain no wait or retained worker.
Profiles taken with this pause are attribution evidence, not clean startup-speed
benchmarks. Callback failures retain the platform's explicit error/cleanup
contracts rather than silently discarding diagnostics.

### Initial form and pre-bloom anticipation — 2026-10-01

`ZenBonsaiPlumeInitialForm.js`, invoked by the product life adapter, owns the
initial picture's size and closed-bud cue. Canonical minimum growth remains 0.5;
that value already reaches about 81% of the F4 event clock and is not a literal
half-height tree. The displayed tree is scaled about its actual root from 0.6
at initial growth to 1 at full growth, with smooth interpolation. Nodes, wood
radii, living tips and flower geometry use the same projection. Immutable mature
camera envelopes, the planting point and pot retain their original size. Full
growth preserves the exact selected observation.

The `productLife.preBloom` receipt binds each closed pink bud to an actual growing
tip or a recorded previous endpoint and its incoming segment. It swells across
growth 0.5–0.97 and remains through
the earlier anatomical spring/summer/winter passes. It fades in proportion to the
target crown's real bud emergence (`mean(alpha × swelling)`), rather than a fixed
early growth threshold that can leave the tree bare. These
buds are product anticipation marks, not new annual-model organs or flower
capacity. They neither alter canonical bloom/activity nor admit flower sprites
or falling petals. The normal command plan paints them with their support's rig,
depth and visibility; frozen research observations remain a separate explicit
painter without the product receipt. Worker reconstruction verifies the same
receipt and command stream. No stored progression, seed, generation history or
five-qualified-day release rule changes.

`ZenBonsaiPlumeBloomTransition.js` owns the named product opening projection,
invoked by the life adapter after the initial form projection. It retains the
source seasonal/anatomical clock, flower identities and geometry. Earlier annual
crowns have zero display flower availability; the target year-3 spring crown
unfolds from canonical growth 0.955 to 1 using the existing seeded cluster/bud
development schedule. Canonical day 4 has growth `0.948` and remains in pre-bloom
anticipation; day 5 reaches the exact full-growth endpoint. The normalized
opening range is not a separate entitlement or an elapsed-time animation.
Full growth retains the original development and
visibility receipts. `productLife.bloomTransition` records progress, target year,
stage and handoff coverage. The command plan admits closed product buds independently
of canonical bloom/activity, while flower sprites and the existing biotic source
remain multiplied by canonical bloom and actual unfolded-petal opacity. Closed
buds and earlier annual passes supply zero petals. No zero-alpha flower sprites
are materialized. Frozen research observations use their original display clock
and do not invoke this product projection.

### Annual branch establishment — 2026-10-01

`ZenBonsaiPlumeBranchEstablishment.js` owns product-only visibility easing for
new annual shoots. `live/wood-development.js` exposes copied birth-time records
from its existing private study index; the product seam must not reconstruct the
seeded shoot plan. Species invokes this projection before life/initial-form
presentation. Geometry, canonical growth, the anatomical seasonal clock and the
original extension/girth curves remain exact. F4 and the initial foundation retain
their picture. Later annual segments ease from zero to full visibility over 0.85
abstract annual-clock units from their recorded birth, capped at the selected
endpoint time. This is a display duration, not elapsed/qualified days. Full growth
retains the exact original visibility and mature command stream.

`productLife.branchEstablishment` declares the span, annual count, fading count
and visibility weight. A fading projection carries explicit alpha for every
annual segment; an absent/malformed receipt or missing annual visibility fails
loudly. The renderer consumes only these materialized records, never the study
or its birth index. Wood, its paper shadow and extending tips use the same
visibility. No frame-based simulation, new worker/cache or storage owner is added.

Anticipation buds inherit their actual support's establishment. A recorded
same-axis continuation carries the previous endpoint's bud until visibility
reaches the new tip; lateral branches add no invented former endpoint, and
internodes receive no extra cue. The per-bud alpha is applied once. F4/foundation
buds retain their initial screen size, while fine later shoots use smaller buds
that grow with support visibility and readiness. This prevents a mass of full-size
pink cues appearing as soon as the source exposes tiny new shoots. Petal supply
and the independent canonical bloom/activation signals keep their existing owners.

### Home work-area framing and frame seam — 2026-10-10

`zenHomeCompositionLayoutFrame` keeps the landscape bonsai in one bounded right
frame shared by pond and ledger modes. The former 52%-of-pond transparent canopy
allocation is removed: `bedInsetLeftCssPx` is zero. The physical left intrusion
remains 28 CSS px, capped at 6% of pond width, plus the 1 CSS px boundary overshoot.
Both modes share the same content-independent `workAreaRect`, bounded by the
complete tree canvas, rear plane and lower support footing; switching modes does
not change the tree frame or camera. The pond spans both columns with one rear
vertical aperture. The rear paper edge stands at 74% of stage width, with equal
top and bottom coordinates at every aspect ratio; the crown can still cross
onto water.
Its painted edge, water aperture and
input/landing occlusion all use that same measured geometry.
The mandatory landscape `rearPaperEdge` travels in the garden-bed frame as
surface-local CSS coordinates, then compiles through the active DPR into the
worker projection. Planter support carries `null`. The DOM aperture and the
sky clip consume this shared edge, not independent placement rules.
The rhythm marker is absolutely positioned in the upper right, so it no longer
subtracts a row from the bonsai's available height. The full-height measured
scene and bounded paint surface pass through `zenHomeGardenBedCanvasProjection`
for one CSS-to-device compilation. Landscape selects `frame-seam`; Portrait,
Landing and Lab select `planter` with zero inset.

`zenHomeFrameSeamGeometry` supplies the shared CSS occlusion and device-pixel
construction. Its integrated stone bed starts one tenth of a scene width left
of the bonsai slot, with a horizontal front face 9% of scene height and a narrow
top plane 3.8% of scene height. One mesh owns the rim, recessed soil, lower face,
graph endpoint and occlusion footprint. The preferred planting point stays
toward the right frame; the mature camera selects the nearest feasible point
along the horizontal soil seam while reserving the crown and burial depth.
`zenHomeFrameSeamRenderer` retains the existing world-lit soil, moss strokes and
contact shadow. Its landscape-only palette resolver consumes canonical shell
`layers.l3Top` for the top, `boundaries.borderMuted` for the recess and
`layers.l3Bottom` for the front and bevel, continuing the pressure rail's frame
through the narrow cached ambient-owner `resolveZenEnvironmentShellMaterials`
seam. Projected frame colors are not tinted again by the tree's surface mapper.
The seam painters retain the original mesh, bevel and bottom paint reserve;
granite black washes and speckles do not repaint the architectural planes.
Immutable environment identity and surface
mapper identity cache this palette, so motion frames do not repeat the shell
material/contrast projection. Portrait and other planter materials are unchanged.
The actual resolved camera root anchors the contact shadow inside the soil;
there is no detached pot, decorative root model or separate DOM stone face. The landscape
renderer clips `zenBonsaiOpenAirBackdrop` to `resolveZenHomeSkyPlane` from the
shared frame geometry. Its sky, light wash, haze and broad cloud veils use the
canonical world time/weather palette. The horizon is viewport-relative, and
tree position, growth and health cannot tint or vignette the sky. Day keeps a
pale blue-grey upper atmosphere, dusk a cool-to-apricot gradient, and night
indigo with diffuse upper illumination. This wash does not simulate a moon
position. The painter's viewport is the sky plane's bounds rather than the former rectangular bonsai slot;
the tree layer outside the sky plane remains transparent. Home owns the aperture,
sky-colored perimeter and SVG edge/contact shadow, which fades toward the top.
The ambient presentation projects the same sky-top color and contrast-resolved
ink for the inscription over this scene, separately from shell-paper ink.
Atmosphere, stone and soil bake into the existing
static back/front layers. The pressure graph and its inline favicon action end at the bed's
left footing. Its unchanged site shares are laid out in that shorter data width;
no segment is painted or interactive beneath the bed. The transparent tree
canvas does not intercept pond input; shared occlusion
geometry determines the visible plane and landing/hit boundaries.

The 2026-10-02 sky material retires `plume/live/wood-shadow.js`, its signed wood
silhouette recipe, Pixi shadow sprite/mask/texture and Canvas raster cache.
A sky does not receive a cast tree shadow. Root/soil and bed contact shadows
remain in the support renderer. `totalTextureBytes` now counts wood/flower and
the existing static back/front composition textures only; the separate
`treeMetrics.paperShadow`/`shadowTextureBytes` fields are removed. Environment
changes reuse the existing composition bake owner; no per-frame sky painter,
extra clock or cloud emitter is introduced.

The Plume back/front composition key excludes `renderOptions.lifeState`:
neither painter consumes that input, including the frame-seam, planter and
standalone sky paths. A life-only options change therefore preserves the same
composition pixels and does not repaint its two static textures. Actual
environment, palette, geometry, seed and root inputs retain their invalidation
contract. Life still controls motion through `resolveZenBonsaiPlumeMotion`;
biology, growth and bloom changes retain their separate signed render-plan owner.

Development report diagnostics belong to `createZenBonsaiPlumePixiRenderer` and
the existing `zenBonsaiRenderer.worker` `FRAME_RENDERED` receipt. Only the build
debug capability together with the internal `includeReportDiagnostics` request
admits extra clock reads and scalar bookkeeping; ordinary animation frames and
public builds retain their existing three renderer clock reads. Report events
remain SCENE, resize and worker environment refresh; no timer, IPC, polling,
GPU query or new reporting cadence is added. `rendererPlanValidationMs` covers
the existing signed-plan admission call, `rendererPresentationResolveMs` the
presentation projection, and `rendererCompositionBakeMs` the complete existing
release/back/front resource bake and mask update. `rendererCompositionBackPaintMs`
and `rendererCompositionFrontPaintMs` cover their existing painter calls and are
nested within composition bake, not additional exclusive costs. `rendererTreeSetPlanMs`
covers compositor resize plus setPlan, including command validation, atlas comparison,
repaint and texture-update requests. `rendererTreeMotionMs` covers motion projection
and compositor transforms/metrics; `rendererPixiDrawMs` covers synchronous Pixi
submission, including any native upload/submission wait. These are wall durations,
not model generation, CPU usage or measured GPU execution. Known skipped composition
and setPlan work records zero; non-requested frames carry no additional fields.

Eight explicitly named numeric scalars travel alongside these durations in
`workerTiming` and survive the bounded Home work journal's fixed scalar allowlist.
`rendererTreeSetPlanApplied` is 0/1. `rendererTreeFullBakeCount`,
`rendererTreePartialBakeCount`, `rendererTreeReuseCount` and
`rendererTreeFlowerAtlasBakeCount` are cumulative within that renderer lifetime.
`rendererTreePaintedRuns`, `rendererTreeReusedRuns` and `rendererTreeUpdatedAtlases`
are current-event counts from the applied setPlan's `lastUpdate`; each is zero
when setPlan was skipped, rather than reusing a previous update. Existing
`branchRigRebuilt` records the signed display-plan change: with setPlan applied
and that flag false, the trigger is a material signature change. This can repaint
existing atlases without a full packing bake or new tree generation. A repeated
`sceneSequence` identifies an environment-only report; its inherited scene timing
fields describe the earlier SCENE, not a second scene build. Journal capacity,
eviction, realm clock identity and missing-evidence semantics remain unchanged.

`resolveZenHomeGardenBedCanopyViewport` gives Plume the bounded paint viewport,
including the physical left footing even with zero extra canopy allocation;
Classic/G15 comparisons retain their original scene viewport. Both Plume painters
consume the same geometry, signed plan and canopy mask.
`ZenBonsaiPlumeHomeFraming` owns `home-work-area-frame-v7`: its target is a mature
root-to-top history envelope occupying 73% of the full paint height. This is a
target, not a current-growth zoom or an unconditional minimum for every seed.
Width, top clearance and the admitted planting seam can reduce the scale; the
camera reports `envelopeHeightRatio`, `widthLimited` and `heightLimited`, plus
the selected root and crown margins. Geometry
retains its aspect ratio, and the complete history still reserves wood and bloom
extents before fitting. The complete history already includes maximum flower,
scaffold and paint reserves. Extra screen padding is 3.5% of the shorter paint
dimension above and pondward, but 0.25% at the right frame. This removes duplicate
right-side whitespace without clipping those reserves. The preferred seam root
is at 86% of the measured bonsai slot; actual feasibility still owns its position.
Broad full-history envelopes occupy at most 88% of the bounded paint width,
preserving uniform scale within the persistent frame. Narrow crowns retain the 73%
height target. `envelopeWidthRatio`, `maximumWidthRatio` and
`compositionWidthLimited` expose that presentation constraint. It uses no
current-growth bounds, preserves every paint reserve and shares the same root
with the foreground, shadows and all growth stages.

Pond-facing orientation is chosen from immutable history. The snapshot with the
largest F4 scaffold volume supplies a volume-weighted wood centroid
(`length * meanRadius²` per segment). The farther full-history crown endpoint
faces the left pond, placing the wood centroid in the right half of the envelope.
A farther right endpoint sets `horizontalSign=-1`; otherwise it remains `1`,
including exactly symmetric spans. There is no blended mass/reach score.
`scaffoldCenterX` and `decisionBasis: scaffold-center-span` expose the decision.
The decision does not read current growth, flower visibility,
activation or viewport size. `annual/render.js` owns the explicit
`zen-plume-rooted-orthographic-v2` projection for both points and directions:
reflection changes screen x while preserving positive scale and depth order.
Wood, flower bases, flower instance matrices and rig pivots share this projection.
It is not a CSS canvas flip or a 180-degree yaw, and source anatomy is unchanged.
`ZenBonsaiPlumeRenderPlan` records the projection and camera in the canonical plan;
structured-cloned worker admission rebuilds and compares that full signed plan.

### Product raster and material owners — 2026-09-28

`zenMainWorkerRenderBudget` owns `ZEN_HOME_BONSAI_FULL_PIXEL_RATIO_CAP=2`, also
consumed by the shared Classic workspace configuration for Home. Balanced and low
presets retain cap 1. The existing 4,665,600-pixel budget charges the entire
expanded surface; the effective DPR can be lower when that allocation requires
it. Pixi's `resolution:1` is intentional because its canvas and plan already use
device pixels. Worker mount diagnostics expose delivered size/DPR, and Plume
tree metrics expose texture allocation and byte limits. The shared flower atlas
uses 72 reusable view/opening poses in three crown-light tone banks (216 tiles in one
logical 1024-unit sheet of 64-unit tiles). Only the 72 untinted body poses are painted;
the shade and sun banks copy those pixels with alpha-preserving tint. Wood atlas allocation stays bounded and fails explicitly rather
than introducing a hidden quality downgrade.

Since 2026-10-13 `resolveZenCherryPlumeFlowerAtlasRaster` sets the flower
atlas's texel density from the product camera's fixed median mature-blossom
radius (`medianRestRadius × scale × flowerRadiusScale`). Mature openings, depth
scale and pose spread display that blossom at about 0.78 of its rest radius
(Home seeds: p10 0.61, p90 0.96), so the raster matches 0.8 of it, at the
nearest 1/16 step within 0.25–1. The typical sprite therefore samples near 1:1
instead of minifying a 50-texel bake two to five times (the visible
stair-stepping and shimmer at DPR 1), and most draws stay near mip level 0.
The sheet is painted into the top-left of the next power-of-two surface (for
the Home layout, 512 px at DPR 1 and 1024 px at DPR 2) and uploaded with
mipmaps (`resolution` = scale, so frames, instance matrices and tile selection
are unchanged); buds, partial openings and depth poses use trilinear levels.
Every rebake bumps the base texture's style id because Pixi regenerates mip
levels only on a style upload. The budget counts the full level chain. A camera
without a crown policy (the explicit comparison painter and Canvas comparison
renderer) keeps the full 1:1024 raster. A viewport change resizes the same base
texture; no tile texture or sprite identity is reallocated.

Plume's authored wood pigment is owned by `live/wood-surface.js` (`BARK`) and its
supplied life/activation saturation. `zenWorldBotanicalMaterialLighting` applies
canonical `nightDepth`/`moonlight` to the actual paint and gradient stops after
that biological presentation. Day is byte-identical to the authored material.
Night preserves bark bands and markings with blue-grey shadow values and silver
highlights, while blossoms become subdued silver-pink that keeps half of its
authored chroma (2026-10-13; 30% read as grey cotton). The world already owns
moon phase/cloud attenuation; no moon bearing or second weather source is inferred.
Material channels use the existing coarse 0.05 grain. Canvas and Pixi share this
projection, keeping plan/geometry/alpha/depth ordering unchanged. Static tray and
background commands retain their support owners. Pixi repaints existing wood and
flower atlas canvases only on changed material signatures or geometry; texture,
crop and sprite identities remain reusable. Flower-atlas signature is tracked
independently so returning blooms receive the current light after a bloom-free
interval. Motion frames do not rebake or upload material and no extra filter,
render pass, atlas, glow or timer is added. The shared blossom painter is
`live/flower-material.js`, using `sakuraPetalMaterial.js` for lamina shape and
pigment shared with airborne/landed petals. `ZenBonsaiPlumePresentation` uses
generic `zenBonsaiInkTint` only to tint the support palette; its wood/accent tint
functions do not recolor the Plume tree. Contrast changes therefore belong in
the actual product materials or the composition behind them, while biological
bloom/activation alpha and saturation remain authoritative. No new atlas,
emitter, per-frame support loop or runtime material fallback is introduced.

### Crown appearance and depth — 2026-09-28

`ZenBonsaiPlumeCrownAppearance.js` owns product blossom selection and selective
scaffold girth. Source anatomy, organ IDs, developmental schedules and cluster
receipts remain the accepted research observation. The command plan records
source/retained counts separately and both Canvas and Pixi consume that same
plan. The local cluster pass keeps three flowers: crowded four-flower clusters
can lose one interior blossom, and five-flower clusters can lose two. A narrowly
crowded-pocket exception can remove the final unprotected interior of a triple
when two protected flowers on other clusters lie within the sum of their
rest radii. Those witnesses can belong to the same other cluster. The two flow
endpoints/fringe remain, and the protected witnesses never disappear, so removal
cannot cascade or depend on traversal order. Selection reads immutable rest positions, never
current visibility, camera, bloom or activity. The biotic owner uses the identical
selection, so omitted blossoms cannot contribute observed falling-petal supply.
No global removal budget reranks existing flowers. Distant cohorts cannot affect
selection; a nearby protected flower can correctly affect the local exception.
A protected-only spatial grid uses twice the clearance factor times the largest
retained rest radius as its cell width and checks 27 neighboring cells, stopping
after two witnesses. This keeps the neighbor search complete at the chosen clearance. This work
runs at scene/supply compilation, not in the renderer's animation loop.

The product camera fits the complete history with node endpoint radius reserves
and the maximum blossom gain. From the final nonempty spring envelope it derives
one median rest radius. Blossom size targets 1.58% of the full paint viewport's shorter
dimension with a bounded 1.35–2.28 radius multiplier; this reduces seed variation
without changing relative core/fringe sizes or 3D positions/orientations. The
multiplier is independent of current growth and activity, scales with DPR, and
multiplies the existing swelling/unfolding pose rather than imposing a minimum
bud size. The full-history camera and soil anchor remain fixed through growth.
Different crown aspect ratios remain different; there is no anisotropic stretch.
The v6 appearance keeps the existing immutable retained-flower IDs and maximum
history reserves, while reducing overlapping blossom disks. Scaffold girth and
the initial closed-bud cue retain their existing owners and sizes.

The 2026-09-28 flower material adapts the F4/terminal lab's tapered shoulders,
shallow cleft and broad light-to-shaded-fold value separation. The adaptation
is product-owned; no detached research renderer enters the runtime.
`sakuraPetalMaterial.js` owns three shared laminae and their diffuse body/fold
gradient with a small warm throat. Plume projects five laminae with opening-dependent spread and cup
depth, ordering petals, flower throat, stamens and calyx by depth. Atlas v4's 72
base poses include front, oblique, profile and back views at three opening poses.
Instances select from their actual 3D organ frame and use uniform scale plus
screen rotation/reflection; they do not flatten a top-view tile or compensate
its cosine. The additional development `foldWidth` squeeze is absent on this
path. Each of the five petals has a modest fixed per-shape difference in length,
rise and twist; a sampled lamina normal supplies a restrained diffuse shade
when baking the existing 72 poses. This breaks the flat repeated-petal reading
without extra atlas banks, per-petal sprites or dynamic lighting. The azimuth
bins remain a discrete approximation; the asymmetry is deliberately small.
Tapered shoulders leave gaps between the five lobes at small screen sizes.
A broad diffuse body, shaded tip and opaque undercoat separate the five petals
without a glossy rim or rear contour bleed-through. Airborne and landed petals share
the same lamina and pigment. Atlas allocation and per-organ 3D frames remain
bounded and shared by Canvas/Pixi; no per-flower texture or emission is added.

The 2026-10-13 center and tip revision targets the sizes blossoms actually
display (about 12 px across at DPR 1). Front poses whose cup mouth is visible
add a warm hypanthium floor just above the calyx, so the gaps between tapered
petal claws no longer expose the dark outer calyx as a five-point star. Sixteen
pale filaments reach about a third of the petal with small gold anthers, reading
as a soft stamen halo. The body fold and tip are clean rose values rather than
the darkest dusty mauve, so crown edges no longer grey out when minified; the
boundary stroke and sampled lamina shade still separate the lobes. Calyx and
sepal values are slightly lifted for profile/back poses. Pose count, depth
banks, alpha coverage and tile padding are unchanged.

Crown appearance v5 uses one raw radius sum for the two-protected-neighbor
clearance (previously 0.75). Only the redundant interior of an occupied triple
can leave; its flow endpoints/fringe and at least two flowers remain. This
opens crowded pockets without changing size, anatomy, camera, bloom or wind.
The existing rest-space spatial grid and shared petal-supply selection remain
the owners; no screen-dependent reranking or per-frame neighbor work is added.

`ZenBonsaiPlumeFlowerDepth` compiles the final nonempty spring envelope's 10th–90th
percentile camera depth into the fixed product camera. Command-plan presentation
normalizes each source flower's actual depth against that range, independently
of alpha or the developing bud's temporary pedicel position. Flat envelopes are
explicitly neutral. Far petals use a restrained rose-mauve bank, middle petals a light
tint, and near petals their original material. Radius varies only from 94% to
100%; no bloom/activation alpha changes, blur or new translucency are introduced.
Canvas and Pixi choose the same tile and transform. The explicitly selected
comparison painter supplies neutral depth rather than inventing a product range.
(Tone banks revised as crown light below; the radius cue is unchanged.)

Since 2026-10-13 the tone banks carry crown-scale light instead of view depth
alone (atlas `zen_cherry_plume_flower_atlas_v5`). `ZenBonsaiPlumeCrownLight`
shades each retained blossom by the retained blossoms between it and the
screen-fixed upper-left key that the baked laminae and bark already use, with a
steep (mostly overhead) direction so each puff's underside, the interior near
the limbs and the lower crown fall into shade while sunlit tops stay clear.
Each occluder passes most of the light (thin translucent petals) and softens
with distance; a 2.5-radius scatter mean keeps one blossom from flipping tone
against its own bunch; the stable 10th–90th front/back rank contributes 15%.
A fixed tone curve, not crown statistics, maps that light to exposure, so a
growing or thinning crown never renormalizes the other blossoms. It reads rest
points, rest radii and the product paint gain only: bud emergence, opening,
bloom and activation alpha cannot change a blossom's light, and every retained
blossom shades the others whether or not it is visible yet. The light is
reflected with a mirrored camera, so a mirrored crown keeps every blossom's
light. Exposure picks one of three banks through a stable per-blossom threshold:
neighbors differ by at most one bank and a smooth gradient never shows contour
bands. Shade deepens toward a clean rose (not grey or lilac), the untinted
body bank is the painted geometry, and sun lifts toward white. Night material
mapping applies to all three. Canvas and Pixi choose the same tile; there is no sprite tint,
filter, pass or per-frame work, and atlas size and memory are unchanged. Two
bounded uniform grids over the crown keep compilation near 8 ms (warm) for about
1,150 Home blossoms, once per plan. The explicitly selected comparison painter
has no crown policy and always selects the untinted body bank.

Continuous wood painting adds up to 38% only to F4 scaffold endpoint radii, using
a smooth gain between 13% and 45% of the mature scaffold radius stock. Fine F4
tips at or below 13%, annual flowering wood and cloud carriers retain their
supplied girth. Gain follows continuous posed radii with no newborn width floor.
Existing seam blending and bark texturing operate on the enlarged surface.
The `f4-ink-grain-cherry-v1` material (revised as v2 below) adapts the standalone F4 baseline
wood's neutral gray-brown ink, logarithmic girth value and continuous bristle
bands. It is distinct from the session's old REFERENCE segment painter.
Each axis shares one root-girth tone and nine seeded soft bands, encoded in the
existing opaque cross-section gradient. Bands follow the connected tube without
extra line strokes, alpha buildup or per-internode random restarts. Girth and
the existing bark-development signal change continuously; fine wood smoothly
loses the band contrast. Symmetric edge pooling replaces the directional glossy
crest. Lenticels retain their world-space stations and size but read as dark
creases with quiet raised lips; existing mottled patina is restrained.
This is a material adaptation, not the research renderer: no ribbon smoothing,
junction collars, root flare or dropout is copied. Source geometry, depth order,
mark counts, texture allocation and draw operations remain unchanged. More
gradient stops are baked into the same bounded wood atlas; no dynamic pass is added.
The explicitly selected frozen research painter has no product camera crown
policy and retains original counts/sizes; this is a comparison arm, not recovery
for an invalid product policy. No new atlas, emitter, storage or generation path
is introduced.

The 2026-10-13 `f4-ink-grain-cherry-v2` revision supersedes the "no ribbon
smoothing, junction collars, root flare" exclusion above, as display geometry
inside `live/wood-surface.js` only; it reads the joined graph and writes no
radius, node, station or depth back to the model, and no research module enters
the runtime. Each segment's display centerline is a cubic between its projected
nodes whose end tangents are the shared seam tangents, so a limb's outline is
smooth (one tangent and radius at every seam) rather than a mitred polygon; a
segment whose inner edge would fold keeps a straight strip with the shared seam
normals, and bark marks follow the displayed centerline. An axis that ends where
a departing axis begins within 50° and at least half its girth hands off to it:
the pair joins like one axis (no overlapping end caps) and shares maturity,
bristle bands and bark stations. Ink value now follows girth eased along the
limb over about 2.5 radii, so a limb lightens as it tapers and a fork's girth
step fades in instead of drawing a ring. A lateral branch base is painted just
behind the limb it leaves until it clears that silhouette, so its start cap
never reads as a lighter knob; a cubic fillet collar (after the G15.4 research
geometry: 1.45 radii span, 0.55 fullness) is painted beneath both tubes to close
each notch. Only those base layers change paint order. Product trunks flare by
up to 45% over 2.6 base radii toward the soil and rise vertically from it: the
always-buried root has no end-on cap and is cut level with the bed. A restrained key (±0.045 value) from the blossom atlas's
upper-left light, reflected with the tree like the blossom sprites, replaces the
symmetric cross-section; edge pooling and the no-gloss rule remain. Lenticels
use three staggered lanes of shorter pores at a slightly finer pitch, because
wide evenly spaced pores read as rings or bamboo nodes on a small trunk.

### Release morphology decision — 2026-09-12

The 2026-09-12 decision excluded downward pendant/weeping growth programs from
future release selection. At that date the accepted exclusion existed only in
the detached F4 candidate's gravity/sag birth decisions. The 2026-09-27 Plume
promotion above now carries that accepted F4 anatomy into the product; this
historical decision does not modify the explicit G15.4 comparison generator.

Preserve natural tree variation while pursuing the earlier seed-151 preference:
legible left/right trunk rhythm, connected substantial branch layers and distinct
flower clouds. This preference does not require fixed silhouette or zigzag
templates. Broaden bare lower-stem length so the first major crown fork can begin
around one quarter of tree height through developmental timing, without relocating
completed geometry. See the [F4 owner and evidence](./zen-g15-research-workspace.md#developmental-factors-04)
for the actual implementation, measured range and unresolved crown grouping.

## G15.4 comparison runtime flow

```text
canonical ZenBonsaiLifeState
  -> product-life-state-adapter.js / ZenBonsaiG15DevelopmentClock.js
  -> ZenBonsaiG15Species.generateG15Topology()
  -> typed developmental scheduler graph
  -> ZenBonsaiG15GrowthGeometry.js (current shared carrier coordinates)
  -> ZenBonsaiG15OrganDevelopment.js + twig/flower owners (local age and reservations)
  -> zenBonsaiRenderPlan.js
  -> ZenBonsaiG15RenderPlan.js (immutable scene-command plan)
  -> unified Home worker / bonsai logical channel (pixi_g15 backend)
  -> createZenBonsaiG15PixiRenderer.js
  -> canonical Canvas2D command executor bakes ordered (stratum, rig) buckets
  -> cropped textures / rig sprites
  -> shared hierarchical rig motion at paint time
```

Home and Experiment may provide different presentation inputs, but neither owns a
second topology truth. G15.4 does not read or repair Classic2 lineage state. The
existing lifecycle/materialization owner remains responsible for canonical product
evidence before topology generation is admitted.

G15.4 does not enter `createSakuraRenderPlanV1()`. That contract requires the
Classic branch-root graph and remains the Canvas/Pixi presentation owner for the
comparison models. `ZenBonsaiG15RenderPlan.js` instead freezes the promoted
engine's exact scene-command output, source topology signature, device surface,
background/pot policy, and optional scene-local planting camera anchor. The scene
builder remains the sole G15 camera owner: for Home it keeps world origin within a
bounded soil-safe offset from the garden-bed planting anchor, then horizontally
balances the projected structural-segment mass without admitting blossom geometry
into camera placement; for ordinary surfaces it retains its intrinsic auto-fit
camera. The scene snapshot and worker hydrate that plan through
`zenBonsaiRenderPlan.js`; structured-clone input is rebuilt from the materialized
G15 topology and must match the submitted scene and plan signatures exactly.

`resolveZenClassicBonsaiRenderBackend()` now selects `pixi_g15` for G15.4.
`createZenBonsaiG15PixiRenderer.js` executes the canonical Canvas2D commands when
baking textures in `(stratum, rig)` buckets, using a static bucket key for commands
without an admitted rig. Commands retain their original relative order within
each bucket; buckets are ordered by stratum, then their first command index.
Commands from the same rig and stratum are combined even when another rig's
commands intervened in the source stream. Each bucket is cropped using
`zenBonsaiG15CommandBounds.js`. This batching seam was rechecked on 2026-09-26.
Ordinary frames apply the shared
`resolveZenBonsaiRigMotion()` transforms to those sprites. The existing
`zen_home_renderer` physical worker and `bonsai` logical channel remain the
owners; this does not admit another worker or a main-thread recovery path.
`ZenBonsaiG15RenderSpecies.js` retains the Canvas2D execution surface for explicit
consumers. The comparison Sakura Pixi branch rig and Sakura-only actual-alpha
observer are not admitted for a G15 plan.

Home garden-bed composition draws shared back/front bed layers around the
clipped, viewport-local G15 command stream. The model-neutral open-air backdrop
and lighting read the canonical Zen environment; the shared rig motion reads
wind and life-state response. Weather does not currently become a G15 growth
kernel input or a persisted branch-history input.

The app-wide ambient petal field is outside the G15 command stream. Home's existing
topology publication remains the source; the Home workspace callback forwards it
to `state/useZenAppPetalSourceStore.js` through `api/petalSource.js`. This creates
no new lifecycle owner. Its unit fields are quantized to 0.02 and unchanged
signatures do not publish. The field retains that cosmetic snapshot across tabs;
it does not add materialization, storage reads, cultivation subscriptions, or
per-frame source synchronization. Lab/preview publishers cannot replace the Home
source. Home unmount clears only its exact owner identity. First Vision uses the
same field with its projected Home life input. `runtime/petals/zenAppPetalField.js` converts capacity,
bloom and fall readiness into one continuous emission rate; growth preview remains
sparse and low vitality/dryness reduce supply through the existing signal model.
The bonsai canvas is not an emitter or an origin. Pond receives only landed field
petals and owns floating/resting lifetime; it has no independent initial or falling
petal population. Renderer generation changes do not create a second supply path.

## Current growth and identity semantics

These are implementation facts, not a claim of biological fidelity or completed
growth-continuity acceptance.

| Concern | Current owner and behavior |
| --- | --- |
| Product structural release | `ZenBonsaiLifeState.js` starts at growth `0.5`; `ZenBonsaiCultivationPolicy.js` maps qualified-use release to `0.5 + 0.5 * smoothstep(releaseRatio)`. Five non-consecutive qualified-use days unlock the first full form. Cultivation health, current activation and flowering remain separate inputs. |
| Product identity | `useZenBonsaiActiveProfileState.js` reads the durable aggregate's seed and canonical Sakura latent. It compiles the latent into the existing Sakura phenotype. |
| G15 generation controls | `ZenBonsaiG15Species.js` consumes only phenotype `preset`, `form`, `trait`, `density`, and `corridorStrength`; the current Sakura compiler emits none of these fields. Consequently ordinary Home uses `moyogi`, `central_recursive_meander`, `balanced_natural`, density `0.9`, and corridor strength `0.85`, with specimen variation generated from the seed. The canonical Sakura latent is not yet mapped into G15 morphology. |
| Developmental clock | `ZenBonsaiG15DevelopmentClock.js` maps growth to `C = 2 + (M - 2) * (0.85*g + 0.15*g^1.35)`. Product uses `M=160`: `floor(C)` completed events and, when fractional, one pending event. Species passes `ceil(C)` as the kernel's absolute `eventBudget`, without the direct-kernel preset multiplier or 32-event floor. Event count is scheduler work, not biological time or equal visible growth. |
| Topology continuation | The deterministic kernel regenerates the current event prefix from the same seed. It has axis growth units, developmental roles, resource allocation, lateral/apical succession, spatial corridors, and completion state. G15 does not consume Classic2 lineage or cultivation structural imprint as a persistent developmental history. |
| Wood maturation | `wood-presentation.js` reads continuous event time for secondary thickness and weights new supported load by its extension progress. Product maturity is the normalized product growth, independent of the generated prefix's last event. Existing scheduler nodes remain immutable; current extension/sag is a render-only pose. |
| Scene materialization | `buildG15Scene()` validates the materialized clock and gives it to the scene builder. `ZenBonsaiG15GrowthGeometry.js` projects current shared nodes once; wood, junctions and floral/twig carriers read that geometry. Only segments born in the pending event extend. Paint order never selects an axis to truncate. |
| Additional twig volume | `sakura-canopy-twig-volume.js` derives short 3D carrier twigs from stable source-segment stations. Seed/segment identity fixes geometry and birth; length and girth read individual age through `ZenBonsaiG15OrganDevelopment.js`. Birth-order reservations use rest-world spacing and a fixed lineage/total cap. These remain presentation carriers, not scheduler-grown axes. |
| Flowering | Stable wood stations reserve floral or vegetative buds. Each floral organ has deterministic birth and age; explicit bloom controls continuous presence/opening at that same station. Eye/bud/half-open/full drawings crossfade. Fixed seed cohorts retain some buds. The former `bloom<=0.05` gate and unbudgeted terminal/junction completion are removed. This is a replayable local-age presentation, without persisted seasonal induction, chilling or abscission. |
| Environment | Time/weather affect backdrop, lighting, and motion through existing environment/render owners. They do not currently alter G15 branch birth or long-term developmental history. |

## Known continuity and presentation gaps

The [2026-09-05 product review](../../../../reports/zen-g15-product-review-2026-09-05/report.md)
records the pre-clock-patch source findings and a reproducible, non-browser API
audit. It is historical review evidence, not a replacement runtime contract or a
QA PASS. The [development roadmap](./zen-g15-development-roadmap.md) separates
the implemented clock and causal-organ patches from remaining spatial quality,
neutral morphology traits, activation/recovery, and calendar pacing. The
[organ patch report](../../../../reports/zen-g15-organ-development-2026-09-05/report.md)
records current validation and visual limitations.

- The default `growth=0.5` intentionally skips early development. Product now
  supports a first visible shoot at growth 0, but seed coats, cotyledons and
  physiological germination are not modeled. Home's start age remains `0.5`;
  the current public qualified-use release completes on day 5. The historical
  clock patch did not itself own that release-policy choice.
- Fractional extension now shares current geometry, but this is not an organ
  lifecycle or a wall-clock animation controller. Daily product growth updates,
  event kinds with no extending segment, radial birth and axis retirement still
  need explicit presentation pacing. The adapter's milestone labels remain
  descriptive; obsolete target event counts and phase event ranges were removed.
  Product growth 1 still does not guarantee `completionStatus.settled`.
- Organ identity, birth and placement now replay from stable source stations.
  This does not store environmental/habit-dependent birth history. The kernel
  may still retire a supporting axis; its missing carrier suppresses attached
  presentation, while its reservation is retained. A visible retirement
  transition is still needed.
- Fixed rest-world spacing removes camera-dependent reranking, but is not a
  projected canopy-area budget. Some seeds still have sparse mature crowns and
  exposed straight or abruptly tapered structural ends. Coverage must be
  improved through branch development and local organ distribution, not by
  restoring unbounded terminal flowers.
- Camera bounds use graph nodes, while wood/twigs/flowers have additional paint
  extent. The camera keeps structural mass independent from bloom, which should
  be preserved; that independence does not prove full rendered-envelope fit.
- Dryness now reaches the small vegetative-bud tone response. Broader leaf,
  bark and recoverable activation responses remain incomplete; structural
  imprint and milestone fields still do not establish a G15 structural response.

Improvements must retain one product identity, one developmental owner, one
scene-camera owner, and the existing local storage/environment boundaries.
Adding persistent G15 genotype, growth-history, or organ state requires an
explicit typed-store contract; no Classic2 read-through or renderer-side history
may substitute for that design.

## Development clock and carrier contract

`ZenBonsaiG15DevelopmentClock.js` is a pure product time owner shared by generation
and scene validation. `progress` is product growth; `materializedEvents` includes
the pending event. Event sequences are zero-based: at `C=70.25`, events 0–69 are
complete, event 70 is pending at 25%, and continuous `eventTime=69.25`. At an exact
integer there is no pending event: the previously completed axis never resets to
zero length. Growth 0 materializes root emergence and the first visible shoot.

The kernel's named `eventBudget` input accepts absolute integer counts 2–240.
Its existing `maximumEvents` input retains preset-scaled semantics for explicit
direct-kernel experimentation; the product species uses only `eventBudget`.
If the kernel settles before the requested prefix ends, no pending axis exists.
Wood time and product maturity can continue without re-extending its last axis.
An explicit `subEventProgress` scene override is accepted only for an existing
pending event. Invalid clock/budget/count inputs fail loudly.

`ZenBonsaiG15GrowthGeometry.js` owns render-only node projection, including shared
sagged junctions, and never mutates the source graph. All segments born in the
pending event expand from their current parent endpoint; completed segments keep
their full displacement. Retirement is applied when its event completes. The
scene computes the camera and presentation carriers from this posed graph, then
paints complete prepared wood surfaces exactly once. No painter-specific clipping
or renderer history participates. Direct graph diagnostics may still use explicit
event-limit scene inputs; that path is not a second product clock.

## Causal organ and flowering contract

`ZenBonsaiG15OrganDevelopment.js` is a pure renderer-side owner of deterministic
sampling, local age curves, and birth-order spatial reservations. It reads no
wall clock, storage or generation service. The twig and flower owners share it.
The global canopy maturity ramp from the first clock patch has been replaced.

- Stations depend on source segment identity and a fixed local fraction (0.76
  on structural wood, the full tip on a canopy terminal). They do not switch
  between tip/internode as the graph grows. The 0.76 station lies on the existing
  wood smoother's carrier. Twig shape keys use source IDs, never selected-array rank.
- Source rest geometry, including retired and not-yet-visible reservations,
  decides eligibility and spacing. Current projected carriers decide where to
  paint. A new event cannot reassign an older organ's reserved slot. Missing or
  retired carriers paint nothing; reservations are not recycled.
- Twig births follow the source event by 16–26 events. Subsequent twig sections
  follow in six-event steps; fork siblings share a birth. Extension unfolds over
  ten events, girth over eighteen. Floral sites follow their source by 12–18
  events, individual slots add 0–5, and floral maturity begins five events after
  birth. These are compressed presentation schedules, not calibrated species physiology.
- Default canopy reservations cap at 30, with 20 world-unit spacing and three
  anchors per lineage. Floral/vegetative stations share one seed-specific cap
  (approximately 70–87), 17 world-unit spacing and five sites per lineage across
  structural and canopy wood. Dormant reservations consume capacity. These are
  caps, not quotas: no second fill pass guarantees a full crown.
- Slender distal order-0 wood (end radius at most 3.3 world units) can carry
  canopy laterals and floral stations; the thick trunk remains excluded.
  Forked `terminal_depth_fan` short shoots admit buds from four world units,
  matching their roughly six-unit mature carrier. Structural internodes and
  `terminal_depth_wand` extension shoots retain the eight-unit threshold.
  The shared birth, age, spacing, vegetative cohort and total reservation caps
  still apply; this does not force flowers onto every terminal.
- The retained canopy release-direction policy reads scene yaw/depth projection.
  Continuity is verified at Home's fixed yaw and across viewport scales, not
  arbitrary camera rotations. A view-independent 3D organ plan remains future
  work; rest-world reservations must not be presented as proof of that property.
- A fixed seeded subset of sites carries vegetative buds. Floral presence and
  opening are separate from structural age, and every flower waits for its own
  birth. Bloom zero removes floral paint while retaining the same stations and
  vegetative buds. Reopening returns to those identities; it does not regenerate
  the wood or claim a persisted flowering season.
- Default woven-template flowers, pedicel reach and carrier lengths use one
  world-relative scale (reference camera scale 0.64). Primitive eye/bud drawings
  and atlas stages crossfade at a common continuous position/size. The Canvas2D
  executor applies primitive command alpha once inside a saved context; atlas
  and brush executors keep their own alpha authority.
  Template radii retain the established calibration (14.6 + 0.64 × 0.8,
  bounded to 3.2–9.8 at the reference camera), then project once. Continuous
  stage-size interpolation retains the eye/bud/half/full display factors;
  an organ reaches adult radius when the full-open crossfade finishes at 0.76.
  Bloom beyond that point does not enlarge an already open flower. This restores
  the blossom silhouette without changing the structural growth clock or adding
  a screen-pixel size floor.
- Canopy wash derives only from actual opening organs, weighted continuously by
  presence and opening, and follows the same lineage rig. Empty graph clusters
  no longer paint a false flower mass.

`sakuraOrganLayerEnabled` reports admission of the whole organ layer;
`sakuraFloweringVisible` means at least one non-dormant floral organ.
`sakuraReservedSiteCount` includes dormant reservations,
`sakuraVegetativeBudCount` counts visible vegetative buds, and floral entity
counts include eyes and buds, not just open flowers. Families expose stable IDs,
births, rest/current anchors and per-organ stage/presence/opening receipts.

Explicit Terminal Lab and legacy family-grammar diagnostics remain separate
presentation modes; their pixel caps and non-causal lab organ projection are
not evidence for Home's default woven-template contract. No renderer-side
history or new storage schema was introduced. Seasonal dormancy, flower-bud
induction, abscission, leaf expansion and supporting-axis retirement fades remain
future work.

## Promoted research boundary

The implementation under
`src/themes/plugins/zen/model/bonsai/g15/` is product-owned source promoted from the
detached morphology workbench. Product runtime must never import
`scripts/dev/zen-bonsai-morphology-research`. After promotion, research and product
copies evolve independently through explicit reviewed ports.

`ZenBonsaiG15Species.js` owns product generation. `ZenBonsaiG15RenderSpecies.js`
`ZenBonsaiG15Scene.js`, `ZenBonsaiG15RenderPlan.js`, and `render-runtime.js` own
the smaller graph-to-scene surface used by renderer
workers; that surface must not import scheduling, mutation, or graph-inspection
owners. `index.js` temporarily owns the ordered installation of the full promoted
engine into the current JavaScript realm. New product consumers must not read those
internal globals directly. Browser lab controllers, workbench hosts, capture scripts,
and research fingerprint tests are not part of the shipping engine.

`ZenBonsaiG15Math.js` owns the exact `clamp` and `rounded` foundations shared by
generation and ontogeny. The render runtime imports that pure leaf through
ontogeny; it must not install the generation-only developmental program namespace
to obtain those two functions. Full generation through `index.js` retains its
complete programs, presets and public exports.

`ZenBonsaiG15TerminalMorphology.js` exposes six named canonical Sakura bindings:
cluster templates, the morphology contract, blossom pose, terminal plan, projected
blossom paint and atlas descriptor. The terminal adapter, flowering presentation
and Canvas executor import those bindings directly. They must not read the full
generated terminal-lab global namespace. The canonical Sakura study source and
its standalone fixtures/drawing APIs remain unchanged.

`ZenBonsaiG15TerminalStudyRuntime.js` installs the complete 14-entry study namespace
for `index.js` from that same canonical ESM owner. It preserves the former global's
`__esModule` marker, ordered enumerable read-only getters, plain object prototype
and extensibility, without bundling a second compiled implementation. Renderer
workers do not import this full-study bridge. The unreferenced product
`sakura-terminal-lab-runtime.generated.js` copy has been removed. Its implementation
was identical to the unchanged detached research IIFE apart from the product-only
global assignment footer. Bridge parity tests read that preserved research IIFE as
a test-only reference; product runtime never imports it. The detached research IIFE
producer and archived copies are unchanged. Canonical render-plan regeneration and
all four comparison models remain complete; neither is a bundle-budget reduction seam.

The Home component loads its runtime behind a React lazy boundary. This keeps the
dashboard and Zen workspace shells independent from G15 generation cost without
introducing a timeout, polling loop, or secondary state owner.

## Verification ownership

The detached workbench's current entry, owner map, fixed learning source boundary,
common preview/receipt contract and historical version mapping are governed by
[G15 Research Workspace](./zen-g15-research-workspace.md). `/g15-4/current/research.html`
is its directory; existing study/learning/analysis URLs remain valid. The 66-file
learning snapshot cannot be edited or re-stamped in place. This organization does
not change the product, accepted treatments, generation or render defaults.

Morphology iteration follows the user's research-first workflow: prepare an
explicit, source-hashed snapshot of the current G15.4 baseline in the detached
G15.4 workbench, then develop and compare there using its local kernel and
Canvas2D command renderer. Snapshot preparation is a one-time source port, not
a runtime read-through or an automatic mirror of product state. The detached
`g15-4-typed-developmental-scheduler/current/` snapshot now includes the current
clock and causal organs. Fifteen seed/growth combinations match the product's
complete graph and scene hashes. Its terminal candidate remains research-only;
no candidate morphology has been promoted by this snapshot update. The older
parent lab keeps its historical generation controls and fingerprints.
`npm run dev:zen:g15-research` starts the G15-only ES-module host without building
the app or other research labs. See the
[baseline and terminal experiment](../../../../reports/zen-g15-terminal-development-2026-09-05/report.md).
The later [symbolic crown experiment](../../../../reports/zen-g15-crown-balance-2026-09-05/report.md)
adds viewport-aware petals, projected family spacing and mature distal accents
only in that detached snapshot. It does not change this product contract or
claim physiological maturation at the event horizon. Product flower sizing and
causal organ admission remain unchanged until an explicit promotion.
Subsequent user-seed review did not accept that crown candidate as a visual
improvement. The [structural model investigation](../../../../reports/zen-g15-structural-model-2026-09-05/report.md)
records renewal-origin loss, curvature cancellation, twig/flower eligibility
mismatch, and disconnected brush paint as the next research priorities.
That investigation changes no product or detached engine behavior.
Its follow-up [connection/construction patch](../../../../reports/zen-g15-continuity-foundation-2026-09-05/report.md)
is now implemented only in the detached lab: continuous ink-ribbon cores,
origin-anchored drying, and actual position/axis-role inputs at growth-unit
renewal. Explicit historical treatments preserve the old graph/paint behavior
for comparison; they are never selected as recovery for missing state.
The lab's `foundation` study compares both corrections with crown completion and
terminal taper disabled, using a shared camera enclosing both mature graphs.
These fixes do not yet change the product owners described above, resolve
twig/flower anatomy, or establish a biological completion clock.
The later [shoot-organ candidate](../../../../reports/zen-g15-shoot-organs-2026-09-05/report.md)
addresses the lab's twig/flower ownership mismatch through explicit terminal
buds, exclusive source sockets, retained closed buds, and support-relative
pedicels. It preserves the same graph and wood paint for its A/B comparison.
The lab's `organTreatment` option is not a product option; all production
organ admission, event budgets and lifecycle contracts above remain unchanged.
The subsequent [proportion study](../../../../reports/zen-g15-proportions-2026-09-05/report.md)
adds six isolated/combined comparisons in the detached lab's
`study=proportions` page. Construction demand and cycle count are changed before
growth commits; shoot layout and symbol size stay in the presentation owners.
No extra construction stock, scene-specific terminal filling, or seed exceptions
are introduced. Wider scaffold growth can also lengthen bare leaders; the
combined candidate can increase floral crowding. None is promoted or accepted as
a general crown solution at that stage. Its `proportionTreatment` is a research option only.
The user subsequently selected F as the next research baseline and requested
finished, flowering framework tips at growth 1. The [first-form maturation patch](../../../../reports/zen-g15-first-form-maturation-2026-09-05/report.md)
implements `study=maturation` as the lab default: F on both sides, the same final
graph established by .94, then 80 units of organ-only maturation through 1.
Fixed visible framework endpoints own small floral buds outside the ordinary
axillary quota, without evicting existing sites. Bloom activation remains the
authority for opening. The canonical product clock and event budget above are
unchanged; the lab's `maturationTreatment` is not a product option. This marks
graphic completion of the first form, not physiological or seasonal completion.
Full dashboard/pond/worker rendering is reserved for the selected change's
product integration and final checks. Product must never import the workbench.
The [next research plan](../../../../reports/zen-g15-growth-quality-plan-2026-09-05.md)
defines the diagnostic comparisons and narrow final integration checks.

- `tests/themes/zenBonsaiG15DevelopmentClock.test.js` protects low-age event
  admission, absolute product budgets, pending-event projection, integer-boundary
  node continuity, shared carriers, maturity, and early-settlement behavior.
- `tests/themes/zenBonsaiG15OrganDevelopment.test.js` protects born-organ
  continuity across three seeds, local birth, the former low-bloom threshold,
  world-relative blossom size, actual-organ wash and primitive alpha isolation.
- `tests/themes/zenBonsaiG15ProductIntegration.test.jsx` protects catalog,
  lifecycle, topology, scene-command, and renderer integration.
- `npm run check:zen:architecture` protects the product/research source boundary,
  excludes workbench controllers, and keeps the renderer worker independent from
  the full generation engine. This source invariant is owned by the structural gate
  instead of a duplicate source-string test.
- [Clock-patch gallery and source evidence](../../../../reports/zen-g15-product-review-2026-09-05/growth-patch-evidence.json)
  record an offline canonical Canvas2D-command comparison at fixed per-seed
  mature camera bounds. They do not certify Home browser composition or GPU cost.
- `scripts/ci/check-zen-home-renderer-worker-artifact-contract.mjs` measures the
  complete worker closure against the G15.4 production baseline and forbids the full
  G15 engine entry from re-entering that closure.
- Detailed morphology fingerprints and counterfactual studies run in
  `npm run test:research`; they do not define CWS admission.

## Detached distal-crown candidate (2026-09-05)

The preserved `study=ramification` compares the selected
F plus maturation baseline with a distal-crown candidate. This is not a promoted
product change. The local `ZenBonsaiG15DistalCrown.js` owns unbranched-path extension
demand and a staggered short-shoot plan. The local construction account applies
that demand before funding extension and when evaluating flush renewal; the
fork-law owner bounds distal dominance damping. The twig/flower owners reserve a
small shoot family once and distribute its floral capacity among owned buds.
Planned mature shoot points may enter `resolveCameraBounds` through the explicit
`presentationPoints` option; the common camera stays fixed during growth.

Short-shoot wood volume and junction area are conserved presentation proxies,
not new physiological grants. These shoots still lack scheduler meristems and
resource competition. Some original framework tips lengthen, and local floral
density increases; the candidate is not a universal shape repair. Earlier
studies retain their exact generator baselines. See the
[comparison, limitations and validation](../../../../reports/zen-g15-distal-crown-2026-09-05/report.md).

## Detached apical succession candidate (2026-09-05)

The preserved `study=succession` compares the preceding distal-crown candidate
on the left and a funded apical transition on the right. This is research only.
The local `ZenBonsaiG15ApicalPlanning.js` owns a viable descendant commitment and
a within-flush fork window. `axis-construction-account.js` reserves the commitment
from the same family grant and protects it from conversion into more longitudinal
construction. The kernel's fork opportunity consumes the window; health, immutable
fork identity and visible-scaffold permission remain authoritative.

`developmental-tier-architecture.js` owns two accompanying rules: new station
claims scale separation to local calibre, and an eligible slender framework need
not preserve a main-axis child forever. Both successors may become crown axes.
The original sampler still supplies shares/directions and the child budget owner
still divides one finite grant. Existing claims are not edited to force admission.

The local `apicalPlanningTreatment` defaults to baseline; historical comparisons,
product code and the 160-event horizon are unchanged. This addresses the transition
from elongation to branching, not all bare runs: additional-sample mean height
changes by about -0.9%, while the role-independent maximum unsupported span rises
about 3.3%. Role-zero terminal-run reduction alone cannot demonstrate improvement,
because this experiment changes role assignment. See the
[implementation, evidence and limitations](../../../../reports/zen-g15-apical-planning-2026-09-05/report.md).


## Detached physical branch development candidate (2026-09-05)

The preserved `study=coherence` compares the preceding funded-apical candidate
is on the left. This remains outside product runtime. The local
`ZenBonsaiG15AxisDevelopment.js` owns a physical lateral-placement plan and a
post-lateral fork gap. Birth/renewal accounts bind that plan to committed radius,
reference internode length and available lateral funds. `terminal-ramification`
measures actual arc in the current flush; the account records the actual released
site, so an overshooting internode cannot collapse the following spacing.
`axis-meristem-cadence` derives the next fork gap from the same physical scale,
while the original resource and permission owners still authorize execution.

The plan changes placement/capacity, not the sum of construction allocations.
Physical timing replaces the old station/progress arrays on participating axes.
The graph inspector explicitly requires empty station arrays, finite physical
geometry and a funded capacity. A birth construction receipt records the account
before this placement binding; its budget balances are unchanged by the binding.
Existing order-zero visible-scaffold timing and apical plans retain their owners.

The crown-composition owner binds the family frame after final birth-direction
projection. The crown-state owner may reorient only a newly created, unoccupied
cluster at that birth event; it preserves inherited occupied clusters and rejects
attempts to rebind committed residents. No extra random samples are drawn for
these bindings. Earlier study graphs and the product worker closure are unchanged.

54 seed graphs preserve the prior baseline. The 16 initially unseen seeds show
about 2.3% less maximum scaffold entry run and 0.25% less height on average; local
floral crowding is nearly unchanged and upper flower pixels decrease. Physical
spacing produces most of the visible effect; frame binding alone is not a proven
crown-quality solution. Small flower shoots still live in presentation and remain
a separate integration task. See [evidence and limits](../../../../reports/zen-g15-axis-coherence-2026-09-05/report.md).


## Detached crown allocation candidate (2026-09-06)

The preserved allocation comparison is `study=allocation`. Both sides use the preceding
coherence skeleton. The local `ZenBonsaiG15CrownAllocation.js` owns a continuous
calibre competence and per-lineage anatomical support account. Carrier birth
order owns reservation history. Local length/calibre contributes support;
previously reserved crown centres reduce new support continuously. There is no
final-shape classifier, global shoot limit, tier quota, camera or bloom input.

`sakura-canopy-twig-volume.js` consumes those reservations and assigned shares
in the candidate. `ZenBonsaiG15ShootBuds.js` divides the same shoot's floral
capacity among its buds, including integer remainders. Wood volume is bounded
by the assigned share of that source's reference shoot, and child root radius
cannot exceed half the actual carrier radius. The population's total decorative
wood is not conserved relative to the old candidate, because source selection
and reference size change. This is not physiological construction accounting.

The presentation option `crownAllocationTreatment` defaults to `baseline`;
`supply` and `candidate` are report ablations. `scene-command-builder.js`
forwards it and exposes `metadata.crownAllocationReceipts` only for this study.
The laboratory camera owner includes both planned mature presentations and
retains that union through growth. Invalid new allocation inputs fail explicitly.

54 seeds preserve the preceding structural graph. Tests protect causal organ
prefixes, budgets, branch attachment, carrier calibre and bloom-independent
identity. The 16 initially unseen seeds have about 3.3% less peak pixel density,
but 2.3% fewer upper flower pixels. The unopposed supply ablation is much denser.
Residual structural flower sites remain a separate allocation route, and the
52-unit occupancy kernel approximates a crown envelope rather than evaluating
its actual projected flowers. Product runtime and worker imports are unchanged.
See [implementation, counterfactuals and limits](../../../../reports/zen-g15-crown-allocation-2026-09-06/report.md).

## Accepted allocation baseline and geometry study (2026-09-06)

The user accepted the right side of `study=allocation`. The preserved detached
comparison is `study=community&community=geometry`, seed 176. Its left side uses that
exact accepted treatment; 55 pre-edit graph, organ-plan and paint hashes verify
preservation. Both sides keep the accepted structural graph. No product owner,
worker import or shipping growth policy is changed by this promotion in research.

The detached `ZenBonsaiG15CrownCommunity.js` owns weighted shoot footprints and
causal occupancy receipts. `sakura-canopy-twig-volume.js` supplies the actual
funded six-segment shoot geometry. Weights follow segment arc length and terminal
bud positions; only earlier reservations influence a new source. New treatments
use a fixed anatomical birth frame, rather than using the current camera to plan
organs. Bloom and subsequent growth do not rearrange accepted reservations.

The local `crownCommunityTreatment` defaults to `baseline` at the engine boundary.
`geometry` changes occupancy only. `shared` and `candidate` are optional research
ablations which reserve part of each source's presentation support for compact
structural buds, with separate lineage shoot/bud balances and no double ownership
of one source socket. `sakura-flowering-presentation.js` consumes explicit funded
structural capacities instead of its separate global structural quota in these
two variants. An empty reservation array is authoritative. The existing apical
first-form maturation owner remains separate; this is not full physiological
resource integration. All numerical wood/flower costs are visual model choices.

The lab camera unions all four mature presentations and holds that view during
growth and ablation switching. Historical study inputs keep their prior behavior.
On 16 initially unseen seeds, geometry changes visible flowers by -1.4%, upper
flower pixels by -3.1%, and peak pixel density by +1.7%. The combined variant
reduces flowers by 22.2% and is not selected as the default candidate. See the
[community evidence](../../../../reports/zen-g15-crown-community-2026-09-06/report.md).

## Detached whole-tree composition experiment (2026-09-06)

The preserved composition study is `study=composed&composition=0.45`, seed 151. Left is
the accepted allocation candidate; right selects strength 0, .45 or .85. Zero
preserves the accepted graph and paint. This does not promote a product change
or supersede the user-accepted research baseline. No automatic frequency for
strongly composed specimens is selected yet.

The detached `ZenBonsaiG15ComposedCrown.js` is the explicit owner of a seeded
world-space envelope, a slowly varying trunk tangent and inherited family regions.
Its profile uses no finished graph, viewer setting, bloom activation or user
behavior. `generate.js` validates the strength; the kernel creates the plan once
per generation and retains it in the graph only when active.

`crown-composition-field.js` creates a new family's region and applies bounded
birth proposals. A first-generation region is bound to the final birth heading
before commitment; descendants inherit it. `frontier-growth-kernel.js` blends
future extension headings and retains its cone/spatial constraints.
`axis-construction-account.js` applies a bounded length-demand scale before the
existing continuity and affordability calculation. These owners do not receive
new construction stock or permission to reshape committed geometry.

The region preserves an ascending central family's potential apex role even
after scheduler axis order changes. Other families retain an outward flow with
bounded elevation relative to their layer; overshooting never reverses them to
pursue a point. The lab's `sakura-canopy-twig-volume.js` builds future decorative
shoots forward from the real socket using that region and a fixed birth frame.
Reference arc length and wood cost remain unchanged before the existing support
funding. Missing regions for active non-framework carriers fail explicitly.

The first implementation steers structure and uncommitted decorative shoot
geometry. It does not implement a full scheduler choice among extension, lateral
branching and short floral shoots, nor guarantee a filled triangular crown or
complete negative-space preservation. Flower count can decrease when structure
changes. Camera bounds include all three mature variants and remain fixed through
growth, influence switching and flowering. Evidence: 37 seeds, 333 native scenes,
91 focused tests; see [results and limits](../../../../reports/zen-g15-composed-crown-2026-09-06/report.md).

## Detached decision consolidation experiment (2026-09-06)

The preserved consolidation study is `study=consolidation&consolidation=candidate`, seed 151.
The user-accepted allocation profile remains the exact left baseline. Right-side
`consolidationTreatment` accepts `baseline`, `random` or `candidate`; its engine
default is `baseline`. Active consolidation and nonzero `compositionStrength`
are explicitly incompatible. This adds no runtime fallback or product owner.

| Detached owner | Contract |
| --- | --- |
| `ZenBonsaiG15DevelopmentDecisions.js` | Validates treatment and observes extension factors, heading stages and committed fork roles through optional `onDevelopmentDecision`. Records stay outside graph/organ/paint identity. Original multiplication order is retained in A. |
| `ZenBonsaiG15DecisionRandom.js` | B and C address draws by seed, developmental ancestry, local station/flush and purpose. Fork identity, fork development, extension and lateral development have separate streams. Nested work restores the enclosing stream, and reserved fork intent validates its original checkpoint. |
| `ZenBonsaiG15AxisHorizon.js` | C uses calibre maturity and local framework travel/straightness for one extension/renewal pressure; the funded apical window owns timing, and shared maturity owns role completion. World-up angle, final height and a silhouette target are not inputs. |
| `axis-construction-account.js` | C framework extension replaces the old proportion, distal-run, maturation and terminal-age factors with the horizon and trajectory input. Inherited traits, rhythm, capacity, continuity and affordability remain explicit. No construction stock is added. |
| `ZenBonsaiG15ApicalPlanning.js`, `developmental-tier-architecture.js` | Consume the shared maturity while retaining existing reservation and permission contracts. C retains a longer funded apical window; completion is not gated by travel a second time. |
| `lab-model.js` | Names the accepted profile, provides `makeAcceptedSpecimen` and one camera union across A/B/C and growth. Historical studies remain available. |

Addresses are a private generation map, not persistent global lineage IDs. Root
phenotype generation is unchanged. B guarantees stable addressed draws, not an
unchanged tree after spacing/resource/occupancy changes; those still affect
development. Some older deterministic ID-derived phases remain outside the new
stream ownership and require a separate audit before claiming complete decoupling.

This is the first consolidation of framework length, continuation and role
completion. Fork direction stages, branch-family hierarchy and floral support
are not yet one common developmental proposal. No single rule count or diversity
score constitutes completion. A preserves existing output; C remains experimental
because the exploration distribution retains a taller/narrower bias. See the
[implementation, frozen-cohort evidence and review](../../../../reports/zen-g15-consolidation-2026-09-06/report.md).

## Detached resource/flow proposal experiment (2026-09-06)

The current lab defaults to `study=flow&flow=0.5`. The accepted allocation specimen
is still the fixed left baseline. Right-side comparisons are B (`flow=0`), D with
partial/shared priority (`flow=0.5` / `1`), and the previous C (`flow=previous`).
D is not a baseline promotion. All five presentations use one mature camera.

`ZenBonsaiG15ForkAllocation.js` owns `forkAllocationStrength` (finite 0–1,
default 0) and a single pre-mutation allocation proposal. A positive strength
requires `consolidationTreatment=random`; C and composition cannot be stacked
onto D. The proposal moves the existing resource and inherited flow priorities
toward a common normalized geometric mean. It introduces no stock, topology
permission, geometry clamp, height target or new random draw.

`fork-transaction.js` prepares the joint resource vector and direction weights
before child capacity/identity and cadence permission are planned. Delayed forks
retain that intent. Commit-time absolute capacity and construction still come
from `child-development-budget.js`; the new priorities do not convert those
quantities into one interchangeable physical resource. Stock settlement and
portfolio spending owners are unchanged. This is priority coordination, not a
photosynthesis/transport or geometry-cost demand model.

Active plans declare `joint_fork_allocation_flow_v1` and retain input claims,
strength and both outputs. Historical plans keep their original semantics.
`graph-inspector.js` recomputes joint plans, checks their ordered resource shares
and flow weights, and verifies event/intent/graph-contract agreement. Unknown
or forged joint contracts remain errors. Strength 0 preserves B exactly.

Reference 8, exploration 96 and independently frozen validation 128 seeds were
rendered in five variants. D-half avoids C's taller distribution in these cohorts,
but held-out peak flower density rises 4.3% and normalized skeleton diversity
distance falls 2.7%. D-full's broad-form frequency differs sharply between the
two cohorts; stronger agreement is not a beauty or diversity guarantee.

A 24-seed sensitivity audit also finds role-threshold discontinuities: continuous
priority changes can still switch discrete axis roles, permission timing and
subsequent shape. The next owning problem is continuous growth responsibility
versus tier-based geometry authority. Actual branching and permission remain
discrete; their safeguards must not be removed to smooth appearance. See the
[implementation and sensitivity review](../../../../reports/zen-g15-flow-allocation-2026-09-06/report.md).

## Detached human preference laboratory (2026-09-06)

`current/learning/index.html` is a separate human-feedback surface on the existing
G15 host. It reuses the accepted generator and scene owners without changing their
code. Controlled flow, corridor conflict and composition questions have separate
factor fits; accepted/B/C/D comparisons have a categorical model fit. The learner
does not read Classic2 latent keys, histories, product profiles or storage.

The named detached owners are `ZenG15PreferenceContract.js` (evidence),
`ZenG15PreferenceModel.js` (question selection and utility fitting),
`ZenG15PreferenceAdapter.js` (exact source verification, existing generation and
common-camera rendering) and `ZenG15PreferenceRepository.js` (typed local store).
The store is IndexedDB `zen_g15_detached_human_preferences`, version 1, `sessions`.
It contains only research responses, has atomic revision checks and explicit
errors, and is not product business state or a storage fallback. Import makes a
validated copy; old source versions stay exportable and cannot train the current
model. `version.json` plus graph/command/camera hashes identify rendered evidence.

Full/partial/wood/multiple-view responses are separated. Every sixth question uses
validation-only seed parity and cannot train the utility model. Joint rejection
is recorded without inventing a relative ranking. Recurring broad probes and all
model pairs remain eligible; evaluation descriptors never become generation caps.
The new pairwise logistic learner adopts Classic2 evidence principles but does not
port its full GP or confidence machinery. It does not optimize product morphology.
See [implementation and verification limits](../../../../reports/zen-g15-preference-learning-2026-09-06/report.md).

`ZenG15PreferenceDiagnostics.js` owns read-only evidence coverage and winner
forecast reporting. A/B Brier is compared with constant-50% (.250), excluding
joint judgments from binary scoring. It reads the original pre-feedback forecast,
not a model refitted on the answer. These observation-only summaries are outside
the source manifest; changing them neither retires a session nor updates its
semantics. Generation, question planning, fitting and rendering owners remain in
the existing manifest. A 502-response audit found chronological replay intact but
no established winner generalization. Shape descriptors and explicit joint
approval/rejection remain unconsumed by the live learner; they must not be described
as learned aesthetic understanding. See the [diagnosis and next boundary](../../../../reports/zen-g15-preference-diagnosis-2026-09-06/report.md).

## Detached relational reanalysis (2026-09-06)

`current/learning/analysis/index.html` is a separate analysis/viewer over the
collector's immutable records. `ZenG15RelationReplay.js` requires exact original
graph, command and camera hashes before `ZenG15RelationFeatures.js` observes 18
projected path, branching and flower-distribution relationships. It does not
rewrite hashes, skip mismatches or substitute another runtime. All 502 existing
questions passed in their original browser. A full two-graph Node/browser diff
found only numeric differences, maximum 5.55e-16; no structure/type differences.
The graph checksum remains strict rather than being rounded to permit Node replay.

`ZenG15RelationModel.js` separates A/B utility from joint approval/rejection.
Neither model consumes validation labels, reason tags or free text. The fixed
research policy compares six old descriptors, relations, and contextual relations
using prior-only scaling and chronological fitting. Model contribution readouts
are observational model calculations, not causal generator authority. The original
collector fit and planner are unchanged. `version.json` for features and
`model-version.json` for fitting are separate from the original learning manifest.

`ZenG15RelationRepository.js` exclusively owns completed derived observations in
IndexedDB `zen_g15_relation_analysis` v1, store `analyses`. Its key is the feature
version plus exact source-session hash; validation binds every row to original
evidence. Completed records are append-only. Absent exact matches are unanalysed
states; no older-source lookup, raw-graph persistence or product storage path is
introduced. Original sessions are read and closed through their existing typed
owner, without writes or version upgrades. Analysis exports are explicit local
portable copies, not a secondary automatic storage path.

`ZenG15AnalysisApp.js` owns progress/cancellation, bounded imports, export,
version checks and the case viewer; `model-worker.js` runs fitting. Completed
analyses reload without regenerating the trees. An updated source session
currently requires a new run. See [policy and exact features](../../../../scripts/dev/zen-bonsai-morphology-research/g15-4-typed-developmental-scheduler/current/learning/analysis/README.md)
and [results](../../../../reports/zen-g15-preference-diagnosis-2026-09-06/relations.md).

`ZenG15PreferenceAtlas.js` and `ZenG15AtlasView.js` add a read-only case atlas to
that surface. Joint approval/rejection and relative winners remain separate.
View-local descriptor ranks, four equally weighted geometry groups and coverage
retrieval select examples to inspect; they do not define aesthetic quality,
preference strength, learned types or generator constraints. Nearby opposite
judgments are from different comparison contexts, not identified user errors.
Original pair rendering and exact evidence checks remain mandatory. At most
12 verified canvas pairs are held in memory; no new persistent class or source
write is introduced. The atlas is outside the frozen fit and feature manifests.
See [case review and next observation boundary](../../../../reports/zen-g15-preference-diagnosis-2026-09-06/atlas-review.md).

`analysis/flow.html` adds explicit parent–cloud research. `ZenG15FlowRelations.js`
links organ/family/structural-source identities and observes signed local flow,
fork descendants/roles and sampled void passages. `ZenG15FlowStudy.js` requires
exact original evidence then compares baseline versus geometry community on
the same graph/camera. The study's `flow-version.json` is separate from the
existing feature/model manifests. `ZenG15FlowStudyApp.js` holds at most three
studies in memory and exports explicit local snapshots; no new persistent class
or source writes are introduced. These observations are not generator targets.
The existing 24-pair study found weak changes in average directional distribution
and a largely saturated void-openness descriptor. See [results and authority
boundary](../../../../reports/zen-g15-preference-diagnosis-2026-09-06/flow-review.md).

`current/research/inheritance/` adds an isolated four-arm developmental experiment.
It separates the existing fork station, station removal, continuous direction
inheritance, and added birth-curvature inheritance. Frozen engine sources are
verified and overlaid only at build time; an explicit experiment contract and
recomputed fork receipts replace the original station requirement in that bundle.
Other resource, role, permission and atomicity inspections remain active. The
baseline bundle arm must exactly match the unchanged generator. The study reads
the original typed repository, holds a case in memory and exports locally;
there is no product runtime or new persistent owner.

Eight old question pairs and 32 new seeds produced 192 mature scenes. New-seed
apical departures became smaller, but trunk curvature also fell and a previously
approved asymmetric reference degraded. Existing episodes already inherit parent
curvature: the earlier authority gap concerns a specific station policy, not loss
of all directional memory. This candidate is not promoted. See [experiment,
counterexamples and next boundary](../../../../reports/zen-g15-preference-diagnosis-2026-09-06/inheritance-review.md).

`current/research/joint-frame/` is the next isolated experiment. It reuses the
kernel's heading evolution for a local two-step orientation forecast and rotates
the sibling set as one frame. Existing order-zero support is enforced before and
after spatial projection. Five arms separate station removal, common frame,
curvature-change transport and removal of the fork projector's role-based world
elevation band. No product source or original preference model is promoted.

The research host's `jointFrameResultWriter.mjs` owns the explicit same-origin
`POST /__research/joint-frame-result` artifact boundary: current version, complete
48 × 5 cohort, 3 MiB limit, fixed content-addressed report directory, no client
path and no preference-store mutation. Browser completion requires a confirmed
saved path/hash. These JSON files are local research evidence, not business state.
See [joint-frame implementation and findings](../../../../reports/zen-g15-preference-diagnosis-2026-09-06/joint-frame-review.md).

`current/research/branch-space/` isolates the next non-trunk composition authority.
Two unchanged fork foundations (original and joint) each compare original steering,
steering removal and a soft birth-family boundary. Only non-trunk directional
composition is overlaid; trunk guidance, length scales and construction owners stay
canonical. The initial experiment applied the policy to both structural growth
and presentation twigs. After the user rejected its full-scene appearance, the
presentation application was reverted to the original composition owner. The
structural boundary policy remains. This does not unify the two systems.

`ZenG15BranchSpace.js` owns synchronous scopes and the boundary hypothesis;
`candidate-entry.js` scopes generation, render and per-arm planned crown bounds.
`runtime.js` owns exact old evidence checks and common preview inputs;
`study.js` owns the full fixed comparisons and relational observations.
The viewer reads the original repository and introduces no persistent
owner. Its selected mature pair shares one camera across growth. Local Node reports
use a six-arm camera and explicitly do not claim original-browser evidence replay.
Ten original specimens plus 24 controlled reused seeds show less alignment but
taller/narrower distributions and exposed long presentation twigs. No promotion.
See [branch-space implementation and findings](../../../../reports/zen-g15-preference-diagnosis-2026-09-06/branch-space-review.md).

The user selected joint + boundary with the restored original presentation as
the research baseline, without product promotion or rewriting preference records.
The viewer's explicit seed route offers same-seed reroll comparisons without
opening the preference repository. Seed and view settings remain in the URL;
one custom specimen is held in memory and no ratings or storage writes occur.
The previous branch-space comparison uses `preview.js` to generate the selected pair only,
reusing its mature geometry/camera and returning just drawing commands and small
summaries. One prepared pair, one non-mature state and one frame are retained;
seed/model/source changes invalidate them. The six-arm hash/relational audit stays
in `study.js` and is not rerun by the reroll button. Original labelled-case evidence
is still verified exactly before preview; unlabelled preview retains generation
contracts without claiming a full baseline replay on every interaction.
Arbitrary rerolls exposed the common-frame solver's assumption that incoming
order-zero directions were already inside their existing support cone. The
branch-space-only `patch-frame-support.mjs` now calls the canonical support
projector before that solver when needed and records the input correction.
Admissible proposals are identical, support limits are unchanged, and failing
seeds are neither discarded nor resampled.
The miniature bonsai appearance takes precedence over adding botanical detail.
The proposed new flowering units are deferred; the requested branch-skeleton and
flower-bearing branch references have not yet been located. See [restoration and
verification](../../../../reports/zen-g15-preference-diagnosis-2026-09-06/branch-space-restoration.md).

The later model-drift review distinguishes that joint + composition research
baseline from the learning original. `branch-space/runtime.js` owns explicit
profile/arm inputs, and `original-comparison.js` owns their preview cache for
`comparison=learning` on the same reroll page. The left
uses one of the frozen learning adapter's five model profiles with composition
zero and original fork rules. The right separates composition, joint, both, and
both with structural boundary braking; identity shows the original twice.
Only the accepted profile supports nonzero composition in the frozen engine;
other profiles expose identity and joint, with invalid explicit inputs rejected.
The previous .6375 strength is a research setting, not a learned preferred value.

One seed/profile/strength family shares a mature camera across all its available
arms (five geometries for accepted; two otherwise). Right-arm changes reuse the
left scene and camera; only visible scenes are rendered. Geometry, one growth
state and one view frame are held in memory. The source manifest includes this
viewer owner; all 66 frozen sources and the existing engine bundle are unchanged.
Direct parity checks cover all five original adapter/graph/scene profiles,
displayed left commands, fixed camera, identity and cache invalidation. They do
not score beauty or gate density, balance or diversity. Existing `foundation` /
`mode` URLs and `comparison=branch` retain the previous selected-pair comparison;
recorded-case evidence replay and preference storage remain unchanged.
See [model drift](../../../../reports/zen-g15-preference-diagnosis-2026-09-06/learning-current-model-drift.md)
and the [viewer contract](../../../../scripts/dev/zen-bonsai-morphology-research/g15-4-typed-developmental-scheduler/current/research/branch-space/README.md).
