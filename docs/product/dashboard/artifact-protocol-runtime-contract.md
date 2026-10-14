# Artifact Protocol Runtime Contract

- Status: Active
- Date: 2026-03-17
- Scope: Dashboard artifact/protocol/runtime boundary for artifact-first control surfaces
- Owner: dashboard product
- Last validated against code: 2026-07-21
- Path policy: current-only
- Canonical for: artifact disclosure eligibility, protocol snapshot, artifact configuration/suspension, artifact scope resolution, artifact reaction evaluation, runtime execution handoff

## 1) Final structure

Progression disclosure is a prerequisite to the protection stack. It decides
whether a canonical family is visible, configurable, and runtime-eligible; it
does not decide whether that family is configured or currently active.

After that prerequisite, the protection stack is split into four layers:

1. `protocol`
2. `artifacts`
3. `artifactScopes`
4. `runtime adapters`

Each layer has one job:

- `protocol` decides state
- `artifacts` decide reaction
- `artifactScopes` provide sparse scope overrides
- `runtime adapters` decide execution details

No artifact evaluator may directly interpret raw dashboard store state such as `siteGoals` or theme presentation objects.

The gate order is:

```text
catalogued -> disclosed/runtimeEligible -> configured -> effective after
suspension/global pause -> capability/page conditions -> runtime active
```

Later stages cannot grant an earlier stage. In particular, persisted
configuration or observed runtime evidence cannot disclose a family.

## 2) Authoring model

```js
{
  protocol: {
    strategy: "fixed",
    globalTimeGoalMin: 90
  },
  artifacts: {
    flare: {
      sentinelFlare: {
        enabled: true,
        policy: {
          basis: "global_protocol",
          armOn: "near",
          engageOn: "over"
        }
      }
    }
  },
  artifactScopes: {
    "youtube.com": {
      flare: {
        sentinelFlare: {
          policy: {
            basis: "scope_target"
          }
        }
      }
    }
  },
  sites: {
    "youtube.com": {
      enabled: true,
      targetMinutes: 30
    }
  }
}
```

Notes:

- the protocol snapshot owns both the active global/site target and the site reference target; Furin does not author an independent time threshold
- `sites.targetMinutes` may remain reference-only while still providing site-cap feedback and a site Furin target when no stronger active protocol target is available
- if a site reference target is promoted to an active strategy input, the change happens in the protocol resolver, not in artifact evaluators
- `artifactScopes` are sparse and optional. They override artifact behavior, not protocol truth.
- storage authoring stores canonical artifact preferences. Explicit recommendations are one-shot configuration commands; they are not enable-state fallbacks. Runtime execution IDs are resolved only by `canonicalArtifactRuntimeBinding.js` at the execution boundary.

## 3) Minimal interfaces

### 3.1 Protocol snapshot

`buildProtectionProtocolStateSnapshot(...)` returns a normalized `ProtocolStateSnapshot`.

```js
{
  capturedAt: 0,
  global: {
    targetMinutes: 90,
    usageMinutes: 42,
    status: "safe",
    ratio: 0.47,
    remainingMinutes: 48,
    overMinutes: 0,
    targetSource: "global_protocol"
  },
  scopes: {
    "youtube.com": {
      scopeKey: "youtube.com",
      protected: true,
      budgetRole: "reference",
      usageMinutes: 21,
      referenceTarget: {
        targetMinutes: 30,
        status: "safe",
        ratio: 0.7,
        targetSource: "site_goal"
      },
      activeTarget: {
        targetMinutes: 90,
        status: "safe",
        ratio: 0.47,
        targetSource: "global_protocol"
      }
    }
  }
}
```

### 3.2 Effective artifact config

`resolveArtifactScopeConfig(...)` returns:

```js
{
  effectiveConfig: { ... },
  provenance: {
    artifactId: "flare",
    childId: "sentinelFlare",
    scopeKey: "youtube.com",
    source: "artifact_default" | "scope_override",
    hasScopeOverride: true | false
  }
}
```

### 3.3 Artifact intent / summary

Artifact evaluators accept only:

- `ProtocolStateSnapshot`
- normalized artifact config
- sparse scope overrides

They return normalized intent/summary objects that are canonical and free of runtime module names.

### 3.4 Execution binding

`getCanonicalArtifactRuntimeBinding(...)` defines where a canonical artifact is executed.

```js
{
  lens: {
    executionKind: "filter_settings",
    stateSource: "runtime_filter_plan",
    executionKeys: ["blur", "saturation", "brightness", "contrast", "colorSaturation"],
    stateFilterKeys: ["blur", "saturation", "brightness", "contrast", "colorSaturation"],
    children: {
      grayscale: { stateSource: "runtime_filter_plan", stateFilterKeys: ["saturation"] },
      blur: { stateSource: "runtime_filter_plan", stateFilterKeys: ["blur"] },
      brightness: { stateSource: "runtime_filter_plan", stateFilterKeys: ["brightness"] },
      contrast: { stateSource: "runtime_filter_plan", stateFilterKeys: ["contrast"] },
      saturation: { stateSource: "runtime_filter_plan", stateFilterKeys: ["colorSaturation"] }
    },
    runtimeArtifactIds: []
  },
  veil: {
    executionKind: "filter_settings",
    stateSource: "runtime_filter_plan",
    executionKeys: ["socialMetrics", "clickDelay", "infiniteScrollGuard"],
    stateFilterKeys: ["socialMetrics", "clickDelay"],
    children: {
      socialMetrics: {
        stateSource: "runtime_filter_plan",
        stateFilterKeys: ["socialMetrics"],
        optionKeys: ["feedbackCounts", "viewCounts", "audienceCounts"]
      },
      timeSignals: {
        stateSource: "runtime_filter_plan",
        stateFilterKeys: ["socialMetrics"],
        optionKeys: ["timeSignals"]
      },
      intentThreshold: {
        stateSource: "runtime_filter_plan",
        stateFilterKeys: ["clickDelay"]
      }
    },
    runtimeArtifactIds: []
  },
  barrier: {
    executionKind: "runtime_artifacts",
    stateSource: "runtime_artifacts",
    executionKeys: ["shortFormBlock", "videoSkipGuard", "detourSpreadGuard"],
    runtimeArtifactIds: ["timeAnchor", "detourSpreadGuard"]
  }
}
```

Rules:

- every canonical artifact must have an execution binding
- child telemetry bindings belong to the canonical artifact binding, not to theme presentation objects
- `filter_settings` bindings are execution-aware without manufacturing runtime-artifact IDs
- `stateSource: "runtime_filter_plan"` artifacts derive live state from the normalized runtime filter plan while still executing through filter settings
- child runtime telemetry may attach `intensityLevel` and `intensityMax` for a real numeric level or normalized runtime occupancy, but those fields never authorize a user-facing strength control; semantic policy, scope, and bounded-count choices remain named configuration/context values
- only `stateSource: "runtime_artifacts"` bindings may resolve their explicitly cataloged runtime execution IDs
- dashboard shells may show `configuration`-sourced artifacts as settings-driven, but they must not treat them as unbound
- `infiniteScrollGuard` is an internal Veil execution actuator derived from the existing `intentThreshold`; it is not a dashboard child, a Barrier execution key, or a separately disclosed progression feature
- the Feed Horizon supply-drying prelude and the following Enso re-entry gate are one `intentThreshold` episode, so runtime internals must not manufacture a parallel artifact identity for the prelude

### 3.5 Dashboard artifact control-surface contract

Dashboard artifact surfaces must follow the canonical artifact catalog.

Rules:

- canonical artifact identity/release children come from `artifactFamilyCatalog.js`; visual/widget contract keys come from `src/themes/core/tools/artifacts.js`
- ordinary Tools card inclusion and order come only from the background artifact disclosure snapshot, whose fixed order is `lens -> brake -> gate -> flare -> barrier -> echo -> veil`
- dashboard tab readiness/preload coverage for artifact widgets must be derived from that canonical catalog, not from a hand-maintained partial list
- `Lens` and `Veil` remain first-class artifact families even though their execution kind is `filter_settings`
- theme-specific manifestation widgets may vary, but the required artifact widget contract remains canonical
- all six canonical themes (`matrix`, `entropy`, `cyberpunk`, `clinical`, `scp`, `zen`) implement all seven released families and canonical navigation icons; empty theme declarations do not waive this requirement
- dashboard load failure must remain visible; it must not reveal all families or infer disclosure from configured/runtime state

### 3.6 Configuration, recommendation, and suspension

These states must remain distinct:

- `configured`: one or more release children store active user intent
- `suspended`: the family is temporarily suppressed while configuration remains intact
- `effective`: configured and not suppressed by family suspension/global pause
- `runtime active`: effective, eligible behavior is engaged on the current surface

The family-level action is derived rather than stored as a second enable bit.
When surfaced, an unconfigured family may explicitly apply `gentle_start_v1`;
a configured effective family pauses; a configured suspended family resumes.
Resume only clears suspension. It never reapplies recommendation data or
overwrites child choices.

Recommendation payloads may configure only children owned by the canonical
family catalog. Lens recommends media saturation and brightness ON, with blur,
contrast and independent grayscale OFF, while preserving its
fullscreen relaxation preference. Brake recommends scroll friction and input
visual brake ON, with click pause OFF. Text rhythm belongs to Barrier and is OFF
in its gentle-start recommendation; retired navigation-button-lock fields are
not accepted. The catalog validates child ownership, and the family command
tests exercise recommendation application without changing sibling filters.

Echo's recommendation must keep destructive history cleanup disabled. That
child may be enabled only through its dedicated confirmation/auth workflow.
Echo automatic history/bookmark cleanup and inactive-tab evaporation share the
family/global suppression policy. Suspension retains child consent, fences each
pending removal, and resume schedules the existing cleanup executors without
rewriting child intent. A saved bookmark setting is not evidence of completed
deletion; failed or pending propagation must remain distinguishable from applied
configuration, and preview counts cannot be reported as actual deletion counts.

Flare's public release surface contains only the binary `sentinelFlare`
ON/OFF control. Its global-cap and site-cap state is runtime feedback, not a
second configuration control. The old `nudgeConfig.thresholdMs` field is
retired from the canonical stored shape and is removed during input
normalization; neither artifact config nor runtime dispatch may reconstruct
it as an independent Furin trigger target. When the protection policy exposes
no active or reference target, normal dispatch stops with
`protocol_target_unavailable`. Presage is an internal always-on, one-shot
warning step in a scheduled Flare episode. It has no public
disclosure/configuration identity and no repeat or follow-up recurrence
setting.

### 3.7 Release V1 reinforcement boundary

Rules:

- Artifact and filter planning may only apply ordinary level/lane decisions and runtime modifier deltas.
- Policy deltas can strengthen or relax configured filters, but they must not force-enable filters the user left off.
- Exceeding the global cap always raises the effective protection posture by one step; this is a runtime invariant, not a persisted or selectable policy.
- Schedule `hardBlockWindow` is an access-window decision and does not create a hidden filter state.
- Plan state is exactly `{ level, reasons }`; artifact preferences are exactly `{ enabled, autoTrigger }`.
- Unknown plan, policy, telemetry, and artifact-preference fields fail at their canonical boundary.

## 4) Future-proofing rule

If site target time later becomes an active strategy input:

- only the protocol resolver changes
- `ProtocolStateSnapshot.scopes[*].budgetRole` can flip from `reference` to `active`
- `activeTarget` can start resolving from site target semantics
- artifact evaluators continue to read the same snapshot contract

This is the required stability guarantee.

## 5) Non-negotiable invariants

- `protocol` owns over-limit truth
- progression disclosure owns family runtime eligibility and fixed release order
- configuration, telemetry, evidence, and UI-local seen state never grant or reorder disclosure
- `artifactScopes` never redefine protocol truth
- artifact evaluators never read raw `siteGoals`
- theme manifestation names never become protocol or storage identifiers
- runtime module ids such as `sentinelFlare`, `timeAnchor`, and `detourSpreadGuard` remain execution details only
- execution binding decides which surface owns realization of a canonical artifact
- artifact-impacting settings keys must participate in an explicit runtime-impact rule so dashboard runtime telemetry does not depend on ad hoc UI refresh guesses

## 6) Release V1 Current Contract

The current release path is already direct:

1. Flare evaluation consumes `ProtocolStateSnapshot + scope config resolver + flare evaluator`.
2. Dashboard hooks do not interpret per-site policy independently.
3. `canonicalArtifactRuntimeBinding.js` is the sole canonical-artifact to runtime-execution mapping owner.
4. The background progression query is the sole dashboard artifact-disclosure snapshot owner.
5. Runtime planning suppresses a family that is not `runtimeEligible`, even if persisted child configuration exists.
6. No predecessor artifact ID, old settings shape, or dashboard-local runtime/disclosure reconstruction is accepted as a second source of truth.

## 7) Runtime telemetry contract

`buildProtectionRuntimeSnapshot(...)` now carries canonical artifact telemetry at the snapshot boundary:

```js
{
  capturedAt: 0,
  scope: { host: "youtube.com", tabId: 1, source: "active_tab" },
  runtime: { ... },
  telemetry: {
    runtime: {
      available: true,
      revision: 3,
      level: 2
    },
    artifacts: {
      lens: {
        summary: { state: "engaged", stateSource: "runtime_filter_plan" },
        children: {
          blur: { state: "engaged", intensityLevel: 2, intensityMax: 3 },
          grayscale: { state: "disabled", intensityLevel: 0, intensityMax: 3 }
        }
      }
    }
  }
}
```

Rules:

- background/runtime owns construction of `snapshot.telemetry`
- dashboard/UI consumes `snapshot.telemetry` as the canonical artifact runtime view
- dashboard/UI never recomputes artifact truth from another raw snapshot shape; an absent canonical runtime snapshot remains explicitly unavailable
- `Flare` detail telemetry such as `basis`, `overallStatus`, `targets`, and `topTargets` lives in runtime telemetry metadata instead of dashboard-local summary adapters
