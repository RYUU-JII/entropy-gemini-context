# Entropy Project Harness

This directory is Entropy's CX-independent process boundary for reusable
domain tools. CX may consume it, but Entropy owns the adapter semantics,
resource locks, cleanup, and canonical evidence.

The command surface is:

```text
npm run harness -- list
npm run harness -- describe <adapter> --target=<target-id>
npm run harness -- plan <adapter> --request=<absolute-json> --out=<absolute-json>
npm run harness -- run <adapter> --request=<absolute-json>
  --expected-plan-digest=<sha256>
  --out=<absolute-json>
```

`plan` is side-effect-free. `run` recompiles and checks the frozen plan, makes
one attempt, and returns the domain runner's terminal status. Neither operation
invokes a model or retries automatically.

Before either command enters its adapter, `--out` is reserved in the target
directory and checked for no-overwrite publication support. The final JSON
path stays absent until a complete envelope is linked into place atomically.
An existing result, an active reservation, or an unpublishable directory fails
before the domain run begins.

The first adapter, `entropy-qa`, wraps the existing QA control plane rather
than duplicating its build, browser, resource-lock, cleanup, or evidence
owners. Its output is a small binding envelope; the canonical domain report
remains the QA run's `run.json`. The plan digest binds both the generic harness
runtime revision and the adapter revision. A result is emitted only after the
adapter verifies the canonical report's contract, mode, target, run, and
terminal status; the envelope records the SHA-256 digest of the exact
`run.json` bytes.

The `zen-bonsai-morphology` adapter wraps the existing structural experiment
CLI as the exact target
`bonsai/morphology/structural-smoke-once`. Its only preset is
`contract-min-v1`: 8 rounds, a 4-candidate pool, 4 training seeds,
4 held-out seeds, and one atlas case. It performs no build, browser run,
Rust shadow, image audit, model call, retry, or production cutover.

This is deliberately an execution and artifact smoke contract. `PASS` means
that one deterministic small-sample experiment produced and validated the
exact structured artifact set. A non-passing observed small-sample gate sets
`reviewRecommended` but does not turn this smoke into a scientific verdict or
trigger a model/retry. It is not scientific sufficiency, visual-quality
evidence, or permission to change Classic2. The adapter hashes the relevant
experiment/kernel source snapshot, validates `attachments/result.json`
without reading stdout for status, and publishes a separate small `run.json`
with artifact SHA-256 digests.

The `zen-bonsai-developmental` adapter targets the newer research-only
`successor/developmental` lane as
`bonsai/developmental/one-proposal-smoke`. Its fixed
`active-v10-one-proposal-v1` preset creates exactly one proposal through the
canonical V10 lifecycle: 11 active-growth cycles followed by 2 settling
cycles. This is one complete proposal run, not one internal growth-cycle call.
It performs no build, browser run, network or model call, retry, or product
cutover.

The developmental result preserves the candidate tree, structural graph,
evaluation, evidence, source snapshot, and content digests. `PASS` means that
the canonical contracts, phase completion, provenance, serialization, and
artifacts were valid. A marginal or pathological structural-normality result,
reason code, or viable-archive shortfall remains a diagnostic
`PASS + reviewRecommended`; it never triggers another sample automatically.
This one-proposal smoke is not visual-quality evidence and its output remains
explicitly ineligible for Classic2 or other production use.

When adding an adapter:

1. Wrap an existing canonical runner.
2. Give it exact request, plan, result, and revision contracts.
3. Keep planning free of builds, browser launch, leases, and run-directory
   creation.
4. Reject plan or adapter revision drift before execution.
5. Publish terminal output atomically after cleanup.
6. Use stable local parsers or heuristics for deterministic interpretation.
7. Report ambiguity for explicit review; do not call a model or repeat.

CX recipes live in `tools/cx/harnesses`. They declare conservative admission
claims and fixed adapter inputs. Adapter parameters use the adapter's public
request names (`cliName` for `entropy-qa`), not its normalized internal plan
field names. Dynamic project claims and canonical evidence remain owned here.
