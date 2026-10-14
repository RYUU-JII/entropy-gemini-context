# Real-Site Performance Operating Envelopes

This directory contains human-approved, read-only performance envelopes for the
real-site harness. The runner reads `<suite>.json`; it never creates or updates
these files.

Do not approve an envelope from a single run. First verify activation,
observable effect, cleanup, and structural scanner contracts, then review a
representative repeat cohort. Keep changed site contracts in a new workload
cohort instead of reusing a stale fingerprint.

## Version 1 entry

The harness writes the current fingerprint, workload, normalized medians, raw
medians, and per-key `metricSampleCounts` into `report.json`. Copy reviewed
values explicitly into an entry with this shape:

```json
{
  "schemaVersion": 2,
  "entries": {
    "reddit-public-metrics": {
      "diagnostic": {
        "headed": {
          "operatingEnvelopeVersion": 1,
          "browserProduct": "Chromium/140.0.0.0",
          "approval": {
            "state": "approved",
            "approvedAt": "YYYY-MM-DD",
            "owner": "runtime QA / release operations"
          },
          "workloadFingerprint": {
            "id": "sha256:<copy from a reviewed report>"
          },
          "workload": {
            "minimumSampleCount": 5,
            "dimensions": {
              "resolvedCandidates": {
                "minimum": 10,
                "maximum": 200
              },
              "observerMutations": {
                "median": 1000,
                "maxDeviationPercent": 75
              }
            }
          },
          "metrics": {
            "normalized": {
              "selectorHitsPerResolvedCandidate": {
                "median": 2,
                "maxRegressionPercent": 20,
                "maxRegressionAbsolute": 0.25
              },
              "physicalWritesPerUniqueAppliedTarget": {
                "median": 1,
                "maxRegressionAbsolute": 0.2
              },
              "phase.active_stimulus.unchangedWriteAttemptShare": {
                "median": 0.1,
                "maxRegressionAbsolute": 0.05
              }
            },
            "raw": {
              "longTaskMaxMs": {
                "median": 250,
                "maxRegressionPercent": 25,
                "maxRegressionAbsolute": 50
              }
            }
          }
        }
      }
    }
  }
}
```

`browserProduct` remains an optional entry selector. The workload fingerprint
also records browser family and major so a browser cohort change cannot silently
reuse the old envelope.

Workload dimension mismatches are warnings and suppress cost comparison.
Fingerprint drift is inconclusive contract drift. Only an approved metric that
exceeds its explicit upper headroom can produce a performance failure.

Normalization is performed per eligible repeat before taking the median.
Session-level target-decision, repeat-touch, and write ratios cover the complete
debugger measurement epoch. Phase-local scanner work-ledger ratios use dotted
keys of the form `phase.active_stimulus.<metric>`,
`phase.disable_cleanup.<metric>`, or
`phase.reenable_stimulus.<metric>`. Approve only phases whose start/end
boundary, settle state, conservation audit, and work-ledger state are valid.
For `active_stimulus`, start means the debugger session baseline; later phases
use consecutive captured endpoints. Conservation proves the emitted counters
reconcile with each other, not that every possible scanner path has a hook;
`instrumentationCompletenessProven` therefore remains false and cannot be used
as a completeness claim.
Exact-node identity ratios remain absent when phase identity cardinality is
only partial; do not replace them with zero.
Scanner elapsed normalization uses `estimatedProductElapsedMs`: the
owner-recorded instrumented wall elapsed minus only the measured in-path
selector/deep, provenance, write, and scan-evidence probes. Review both the
instrumented and overhead fields; the estimate does not prove that every
diagnostic cost has been identified.

`minimumSampleCount` applies separately to every metric named by the envelope.
For example, five total repeats with only two finite eligible values for
`phase.active_stimulus.unchangedWriteAttemptShare` are insufficient. The
harness reports `metric_sample_insufficient` and the per-key counts under
`metricSampleCounts`; it does not compare that partial median. Diagnostic
internal samples are eligible only after activation/effect/cleanup correctness,
settle, scanner structural and conservation PASS, and a measured work ledger.

Never lower medians or headroom automatically after a faster run. Promote a new
envelope only after human review confirms equal-or-better correctness and an
intentional operating-bound change.
