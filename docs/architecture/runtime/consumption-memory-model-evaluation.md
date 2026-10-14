# Consumption memory model evaluation

- Status: Active
- Owner: behavior consumption / protection policy / evaluation tooling
- Last validated against code: 2026-10-07
- Path policy: current-only
- Canonical for: synthetic consumption-memory model, shared Shishi intensity contract, observed journey replay, generated pattern evaluation, and production-promotion boundary

## Scope and ownership

The production model, evidence limits and first Zen entry-intensity consumer
are owned by `consumption-memory-runtime.md`. This evaluator calls the same
pure memory, uncertainty and `shishi_consumption_level_v3` functions. It owns
no production state or alternate hold law. Synthetic response comparisons
remain experiments; their readiness field is not a production-release verdict.
`check-consumption-memory-boundary` confines live selection to the existing
input assembler and admitted session/wait transport.

## Purpose, inputs and outputs

The candidate remembers protected use across changes of tab/domain and gives
partial relief for shorter departures. It does not identify addiction,
cognitive load, intent, task quality or whether a person is rested. It has no
case-specific rule for `30 minutes / 5 minutes / 30 minutes`.

Inputs are a strictly ordered, non-overlapping stream of intervals:
`{ epoch, sequence, startedAt, endedAt, kind }`, in epoch milliseconds.
The admitted intervals must describe one already-resolved protected-set flow:

| Kind | Required meaning | Memory effect |
| --- | --- | --- |
| `protected_use` | Confirmed protected foreground use with intervention time excluded | Smooth accumulation |
| `protected_media` | Confirmed protected media interval outside foreground use; overlap already removed | Same accumulation, never a second simultaneous contribution |
| `outside` | Observed protected-set departure with protected media ruled out for the interval | Faster attenuation; not psychological recovery |
| `unknown` | Missing or incomplete observation | Slow memory aging; no outside/rest receipt |
| `intervention` | Actual presented intervention owns this interval | Freeze; no consumption mass or observed rest |
| `disabled` | Collection unavailable by policy | Slow memory aging, explicit disabled coverage |

Tab/domain identity is intentionally absent from the numeric input. Navigation
alone adds no pressure. Metadata may remain in a producer/evaluation trace;
changing it cannot change this model. Switching interpretation is unevaluated.

The output includes modeled memory [0,1], exact per-kind duration accounting,
source watermark, latest coverage, historical missing/disabled duration and
the distinction between observed outside time and memory aging. The zero start
is explicitly `zero_since_explicit_start`, not proof that a real person arrived
fresh. It must not become a per-tab or per-worker initialization policy.

## One continuous law

For duration `d` and memory `m`:

- protected use or protected media: `m' = 1 - (1 - m) × exp(-d / 30 minutes)`;
- observed outside: `m' = m × 2^(-d / 10 minutes)`;
- unknown or disabled: `m' = m × 2^(-d / 90 minutes)`;
- intervention: `m' = m`.

The analytic update preserves the result when an interval is partitioned.
Memory saturates at one, so long use cannot create unbounded repayment time.
One-second returns have a bounded small effect; there is no rest streak reset
or per-entry penalty. Different sequences still legitimately produce different
results: an extended departure at the end matters differently from one before
use. No rule tries to equalize different temporal stories.

These constants are provisional product choices, **not human-study findings**:
30 minutes gives gradual accumulation at ordinary session scale; after 30
minutes memory is about 0.632. A five-minute outside interval retains about
71% of it; 30 minutes outside retains 12.5%. The 90-minute aging half-life
prevents unsupported long gaps from being treated as equally strong recovery,
while avoiding permanent memory debt. Unknown overnight time remains unknown,
even when the numerical memory has aged substantially.

Historical gaps remain in coverage after observations resume. The point estimate
does not bound a person's unobserved use. This uncertainty and sensitivity of
the aging choice require review before production use.

## Shared Shishi intensity and foreground-wait replay

The current mapping is `shishiConsumptionLevel.js`: at most 3600ms extra entry
wait, using the lower possible-memory bound, a 150ms uncertainty influence limit
with continuous taper, 50ms quantization and a 120s read-age limit. The evidence
law and memory model are unchanged by the 2026-10-07 interaction inversion.
See the runtime contract for exact reasons and strict session validation.
The evaluator evolves uncertainty with the same model law and checks
partition/restore invariance of the extension. Nominal memory direction and
uncertainty-sensitive action changes are separate.

Journey replay freezes the selected level and obtains synthetic continue-only
wait from `shishiEntryWait.mjs` using the same `resolveGateShishiWaitMs` as the
UI: 10000ms baseline and 13600ms maximum. This assumes uninterrupted foreground
waiting followed by an explicit synthetic Continue. It does not emulate DOM
focus/visibility, actual user actions, the one-second Leave pour, or every timing
effect of the live 60s producer. The canonical named Gate runtime target owns
browser evidence. The old hold/overflow physical sweeps are historical only;
current pure rendering tests verify one requested strike at 30/45/60/120Hz and
no autonomous Gate strike. Neither comparison certifies human effectiveness.

Neither this intensity law nor its replay changes Gate eligibility/pass grants,
Furin conditions, Enso/Feed/Mukheun tempo or admission recovery.

## Generator and validation

Canonical command:

```powershell
npm.cmd run evaluate:consumption-memory -- --seed=20260909 --per-profile=400
npm.cmd run check:consumption-memory:boundary
npm.cmd run test:file -- tests/consumptionMemoryModel.test.js
```

`scripts/dev/consumption-memory-evaluation/patternGenerator.mjs` is a seeded
semi-Markov generator: state transition weights and state dwell distributions
are independent of model pressure. Five workload families use log-uniform
dwell, occasional very short visits and long persistence, multiple tab/domain
labels, media, intervention, disabled periods and missing coverage. They are
synthetic stress distributions, not estimated population behavior. They do not
adapt to model outputs or provide human ground-truth labels.

`scenarios.mjs` owns explicit stories and relational expectations. `evaluate.mjs`
checks monotonic response by interval kind, bounded hold/memory, exact duration
accounting, metadata invariance via tests, partition invariance, duplicate
idempotence, read purity, serialized restore and small-input continuity. It
retains source seeds and counterexamples; interval-direction failures can be
reduced to the first failing prefix. Representation failures retain the full
trace and are not falsely reported as minimized.

`run.mjs` hashes all owning sources before/after and rejects changing-source
runs. JSON and Markdown are written under `.artifacts/consumption-memory/`.
The model-only runner counts proposed levels at synthetic **potential** entry boundaries;
they do not simulate Gate passes, admission cooldown, or actual exposure rates.
Unknown-to-observed one-second hold changes are audited separately from
explicit collection-mode changes and intervention exclusivity, where returning
from baseline to an eligible decision can still change the next selected level.
Report distributions and invariant pass rates are not human classification
accuracy. Every inspected case/seed is development evidence, not an unseen
holdout. A generator can miss real behaviors; passing it is necessary evidence
for the stated model properties, not sufficient evidence of product usefulness.

## Observed journey replay

`npm.cmd run evaluate:consumption-journeys -- --seed=20260909 --per-profile=50`
runs the separate whole-journey evaluation through the existing production
owners. This is evaluation composition, not another runtime scheduler. The
model-only command above retains its ideal, already-certified interval corpus.

```text
synthetic intent / collection setting / explicit external candidate fixture
  -> existing collection admission + Tracking receipt/environment contracts
  -> observedIntervals (offline evidence join, complete simulated exposure union)
  -> consumptionMemoryModel -> candidate Shishi hold

fresh entry fixture -> ProtectionRuntimeInputAssembler
  -> existing shared Gate entry approval policy -> InterventionAdmissionService
  -> actual simulated presentation or abort -> end / explicit decision
  -> exposure union and next explicit user action
```

| Concern | Evaluation owner | Boundary |
| --- | --- | --- |
| Evidence join | `scripts/dev/consumption-memory-evaluation/observedIntervals.mjs` | Validates existing foreground receipt and environment point shapes; splits overlap against presented exposure intervals. No point extrapolation, browser access or storage. |
| Browser and session I/O fixture | `scripts/dev/consumption-memory-evaluation/admissionHarness.mjs` | Instantiates the real `InterventionAdmissionService` with injected clock, repository and exact-document responses. Production service owns admission, cleanup verification and stale conclusions. |
| Gate eligibility and approval | `scripts/dev/consumption-memory-evaluation/gateReplayPolicy.mjs` | Calls the real assembler and `gateEntryApprovalPolicy` transitions with in-memory fixture state. No host-scoped pass path remains. Entry checkpoint is ON; other Gate children are OFF for paired comparisons. Disclosure is an explicit all-eligible fixture. |
| Journey driver | `scripts/dev/consumption-memory-evaluation/replayJourney.mjs` | Virtual event delivery for explicit intents, 60s observation samples, presentation, end and synthetic response. Reuses `buildGateEntryPresence` independently of collection consent; unknown/disabled fixture intervals expose unavailable window/audio, not fabricated departure. Never schedules a retry at recovery expiry. |
| Named relational contracts | `scripts/dev/consumption-memory-evaluation/journeyContracts.mjs` | Ordinary/mandatory ownership, stale callbacks, abort/retry, service recreation, manual collision, shared approval/departure and fresh-entry-only retries. |
| Paired evaluation and artifacts | `evaluateJourneys.mjs`, `runJourneys.mjs` in the same folder | Same source story and action-keyed response draws for fixed/adaptive holds. Hashes transitive local literal imports and package lock before/after each run. |

All evaluation files remain outside the production import graph. The existing
boundary guard rejects production imports of this evaluation folder and the
candidate Shishi level. Only the named runtime owners may import the pure model.
The live descriptive writer adds no setting, flag, observer or scheduler.

### Evidence honesty

The offline join requires explicit `collectionEnabled` and `exposureCoverage`.
Disabled collection produces disabled intervals. Complete simulated exposure
receipts mask foreground as intervention, with simultaneous exposures unioned
once. With unknown exposure coverage, foreground cannot be called
intervention-free use. Contradictory overlapping foreground receipts reject;
this adapter does not replace Tracking's canonical replay/watermark owner.

Confirmed admitted protected foreground outside complete exposure intervals
becomes protected use. Outside foreground without interval-wide media coverage
remains unknown. Missing foreground remains unknown. Audible, silent and idle
points are validated but never extended to manufacture media or outside time.
Thus **both protected-only and all-sites-minimal runs currently produce zero
certified outside/media duration**. Broader consent alone does not solve that
observation gap. The generator's privileged knowledge is not fed to the model.
No real collection permission is changed by running this evaluation.

The simulated stats-ACK receipts are contract fixtures; this driver does not
execute real stats writes, the Tracking sealer, NavigationContinuityService or
an exposure-history producer. Complete exposure coverage exists only inside
the simulation. A worker-local latest snapshot alone cannot reconstruct that
history. The production interval join now exists under
`consumption-memory-runtime.md`; this evaluator does not execute it and its
simulated complete exposure coverage remains a stronger assumption.

### Response and comparison assumptions

Generated stories retain five workload families and eight-hour horizons. Tab
IDs address eight stable fixture documents across four protected hosts. The
generator's separate domain metadata is not interpreted as document navigation.
At a protected tab entry, the actual assembler checks entry TTL, foreground and
shared approval. A successful simulated Continue grants one decision across
protected hosts/tabs; production policy ends it after ten observed minutes away.
The virtual heartbeat does not create Gate candidates. This replay exercises
the pure approval transitions, not `GateRuntimeStateOwner` storage/restart I/O;
the real-owner integration tests and named browser QA cover those boundaries.
A blocked candidate is discarded; another fresh entry is required.
The real service retains the 45-second end-based recovery interval. Furin and
Enso fixtures supply candidate conditions; their production trigger/debt and
episode-absorption owners are not being simulated or replaced.

The fixed policy uses the baseline foreground wait. The adaptive comparison
calls the shared intensity policy and the same session-to-wait resolver.
The selected value is frozen before reservation.
A 100 ms presentation transport and 4% synthetic failure rate exercise aborts;
neither is a proposed product timer. Continue grants the existing host pass;
leave grants none. An incompatible next scripted intent explicitly cancels the
simulated Gate with cleanup, invalidating its scheduled completion. The driver
must never auto-continue or grant a pass in an abandoned hidden Gate.

Response distributions are sensitivity assumptions:

| Response family | Continue | Leave until next scripted action | Immediate tab switch |
| --- | ---: | ---: | ---: |
| continue_only | 100% | 0% | 0% |
| mixed | 70% | 20% | 10% |
| leave_heavy | 30% | 50% | 20% |

Draws are keyed to the original action, independent of policy and event-loop
branch count. They intentionally do **not** assume that longer waits improve
decisions. Therefore this evaluation can expose added burden and timing
effects; it cannot estimate real intervention efficacy. Differences in shown
counts can arise from shifted cooldown/pass endpoints or cancellation and must
not be labeled learned intelligence. The two consent views and six policy/
response comparisons per source story are not independent human samples.

Reports include eligible candidates, rejection reasons, actual simulated
exposures, total Gate exposure duration as a waiting proxy, short-visit and
long-departure burden, abandoned Gates and unobserved outside time. Pending
exposures at the horizon are censored explicitly. Seeded counterexamples retain
the full source trace; this runner does not claim failure minimization.
Named contract PASS and deterministic replay do not establish MV3 durability,
real gesture/screen cleanup, human awareness or reduced annoyance.

`tests/consumptionJourneyEvaluation.test.js` checks the evidence boundary,
abandoned callbacks, deterministic comparisons and named owner contracts.
Browser QA remains a later named `npm run qa` task when live wiring changes;
this offline command neither builds `dist/` nor touches a browser session.

## Further rollout prerequisites

The runtime now joins bounded Tracking foreground/browser-audible evidence and
admission exposure, commits the descriptive model and source cursor atomically,
and exposes a warm read. See `consumption-memory-runtime.md` for exact evidence,
consent, generation, reset and retention limits. There is still **no certified
outside producer**: silence is insufficient, including with broader consent.
The offline journey driver must not be described as executing this production
join end-to-end. Before expanding adaptive actuation:

1. Review observed coverage and the conservative unknown aging behavior. Current
   browser-audible continuity is not exact playback or silent-video evidence;
   the live model cannot use the candidate's faster outside attenuation yet.
2. Keep the existing domain-usage consent. Protected-only observation must not
   silently expand to all-site or precision input collection.
3. Verify the implemented typed state/cursor CAS through actual browser worker
   lifecycle QA. Transaction tests and fresh-browser boot do not establish an
   actual MV3 restart PASS. Blocking reads must remain warm and storage-free.
4. Preserve the implemented assembler/session/wait path. ON/OFF, entry
   eligibility/pass rules, exact callback ownership and shared admission remain
   authoritative; no other consumer is promoted by this first Zen entry scope.
5. Verify through named `npm run qa` targets and a bounded human-use evaluation.
   Offline candidate results do not certify browser lifecycle or user benefit.

The prior overall plan remains in `protected-consumption-flow-architecture.md`;
the current production facts remain in `tracking-consumption-facts.md`.
