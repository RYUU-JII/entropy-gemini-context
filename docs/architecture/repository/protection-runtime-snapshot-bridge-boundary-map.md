# Protection Runtime Snapshot Bridge Boundary Map

- Status: Active
- Owner: background protection runtime snapshot handlers, protection runtime snapshot contract, dashboard runtime subscription bridge
- Last validated against code: 2026-10-13
- Path policy: current-only
- Canonical for: dashboard protection runtime snapshot read/refresh/subscription, pushed runtime snapshot messages, fallback polling, and malformed snapshot rejection
- Companion to:
  - `docs/architecture/repository/protection-content-runtime-boundary-map.md`
  - `docs/architecture/repository/tools-artifact-support-boundary-map.md`
  - `docs/architecture/repository/main-tab-home-surface-boundary-map.md`
  - `docs/architecture/repository/filter-tab-boundary-map.md`

## Purpose

P1-C adds required `runtime.coolingCurve` with exact
`{ state: 'active'|'no_budget'|'no_basis', step: 0..16, ended, preset }`.
Only the background budget/curve owners create it; the bridge validates the
projection and retains it through unavailable/released snapshots. Filter uses
the reason to explain fixed behavior without a goal or recording basis.
No raw usage ratio, clock or user settings copy crosses this seam.

This map audits the runtime snapshot bridge used by dashboard surfaces. The
bridge may cache, subscribe, and poll for protection runtime snapshots, but it
must not create runtime truth, accept malformed successful payloads, or turn
fallback polling into a second runtime source.

The practical reading question is:

```text
Can every dashboard runtime status read be traced to the background protection
runtime snapshot owner, with malformed success payloads rejected before they
reach shared subscribers?
```

## System Flow

Background owner:

```text
GET_PROTECTION_RUNTIME_SNAPSHOT / REFRESH_PROTECTION_RUNTIME_SNAPSHOT
  -> protectionRuntimeHandlers
  -> readRuntimeSnapshot / refreshRuntimeSnapshot owner
  -> final RuntimeSnapshotBuilder plan with materialized compiled filter entries
  -> compiledRuntimeFilterPlanContract
  -> buildProtectionRuntimeSnapshotResponse()
  -> canonical artifact telemetry projection
  -> snapshot payload contract
```

Dashboard bridge:

```text
useProtectionRuntimeSubscription()
  -> default ProtectionRuntimeSubscriptionBridge
  -> runtime listener for PROTECTION_RUNTIME_SNAPSHOT_UPDATED
  -> cached GET snapshot
  -> REFRESH snapshot on cache miss
  -> optional fallback poll of GET snapshot
  -> shared subscriber snapshot
```

Consumers:

```text
MainTab / Tools artifact control plane / Filter runtime model
  -> useProtectionRuntimeSubscription()
  -> display/runtime insight projection
```

## Owner Table

| Concern | Owner | Key files | Output | Forbidden shortcut |
| --- | --- | --- | --- | --- |
| Runtime snapshot construction | background protection runtime handlers | `protectionRuntimeHandlers.js` | normalized snapshot response | dashboard runtime recomputation |
| Compiled runtime filter-plan contract | protection contracts domain | `compiledRuntimeFilterPlanContract.js` | validated materialized entries plus narrow telemetry/social-metrics projections | passing compiled `level + value` entries back through persisted settings normalization |
| Snapshot payload contract | protection contracts domain | `protectionRuntimeSnapshotBridge.js` | build/is/assert helpers and snapshot messages | accepting object-shaped payloads without contract checks |
| Dashboard subscription bridge | dashboard shared hook bridge | `protectionRuntimeSubscriptionBridge.js` | shared cached snapshot and subscriber notifications | tab-local runtime snapshot bridges |
| Dashboard hook | dashboard shared hook | `useProtectionRuntimeSubscription.js` | snapshot/read/refresh API plus read error state; optional stable display selector over the same shared snapshot | tab-specific imports or sibling-tab wrappers |
| Runtime display consumers | dashboard surfaces | Main, Tools, Filter runtime models | display-only runtime state | writing runtime truth from dashboard |

## Function Ledger

| Boundary function | Input | Output | Failure / missing-data policy |
| --- | --- | --- | --- |
| `buildProtectionRuntimeSnapshot()` | host, tab id, runtime, telemetry context | normalized runtime snapshot | malformed enum values or explicit capture timestamps throw at builder boundary |
| `requireCompiledRuntimeFilterPlan()` | final runtime `plan.filterPlan` entries | cloned compiled entries | unknown features and malformed entries throw; adaptive band/materialized-value validation delegates to `requireAdaptiveFrictionEntry`, which owns visual-value and text-rhythm-profile agreement |
| `projectCompiledRuntimeSocialMetricsSetting()` | final runtime filter plan | canonical `{ isActive, value }` social-metrics setting | missing social entry or malformed compiled siblings throw; no full-map settings normalization |
| `projectCompiledRuntimeFilterPlanForTelemetry()` | validated compiled filter plan | inactive-complete display projection containing only telemetry-owned fields | missing entries remain inactive for display; malformed provided entries throw rather than being coerced through settings defaults |
| `isProtectionRuntimeSnapshotPayload()` | candidate snapshot | boolean contract result | object-only snapshots are rejected |
| `assertProtectionRuntimeSnapshotPayload()` | candidate snapshot and context | valid snapshot or thrown error | malformed success payload throws `PROTECTION_RUNTIME_SNAPSHOT_INVALID` |
| `isProtectionRuntimeSnapshotMessage()` | pushed runtime message | boolean message contract result | malformed pushed snapshot messages are ignored |
| `requestSnapshot()` | runtime action | valid snapshot, null cache miss, or explicit read error state | `success:true` without valid snapshot throws; `snapshot:null` remains cache miss |
| `syncSnapshot()` | bridge connection | cached snapshot, refresh result, or bridge error state | cached miss may refresh; malformed/read failures are not committed as snapshots |
| fallback poll | active connections and poll interval | repeated GET snapshot attempts plus bridge error state | polling only asks the same owner; errors do not fabricate snapshot state |

The hook accepts an optional stable `selectSnapshot` function. It must return
referentially stable output for unchanged selected data (useSyncExternalStore
contract). Tools projects only the selected canonical family and removes the
observation clock/revision from display invalidation; it never recomputes
runtime truth. This creates no second listener, polling loop or snapshot owner.
Errors remain a separate subscription even when selected data is unchanged.

## Recovery Versus Fallback

| Class | Allowed? | Rule |
| --- | --- | --- |
| Cached read miss | Yes | `snapshot:null` may trigger explicit refresh |
| Runtime listener unavailable | Bounded | bridge may still poll/read through runtime owner actions |
| Polling | Bounded | polling reads the same canonical snapshot action; it is not another owner |
| `success:false` response | Visible as bridge error state | no snapshot is committed |
| Runtime message rejection | Visible as bridge error state | no snapshot is committed |
| Missing `snapshot` on success | No fallback | throws missing snapshot error |
| Malformed successful snapshot | No fallback | throws invalid snapshot error and does not update subscribers |
| Malformed explicit snapshot capture time | No fallback | throw `protection_snapshot_captured_at_invalid`; do not replace owner-provided bad time with `Date.now()` |
| Missing compiled runtime value | No fallback | non-adaptive entries throw `COMPILED_RUNTIME_FILTER_ENTRY_VALUE_REQUIRED:<key>`; adaptive entries must pass their strict materialized-profile validator. Materialization belongs upstream. |
| Compiled band/value disagreement | No fallback | visual profiles throw `VISUAL_FRICTION_ENTRY_VALUE_MISMATCH:<key>`; text rhythm validates its runtime profile and throws `ADAPTIVE_FRICTION_ENTRY_BAND_MISMATCH:textRhythm` for band disagreement. Telemetry must not repair executable truth. |
| Malformed pushed message | No fallback | ignored by message contract |
| Dashboard mutation of runtime snapshot | No | consumers can display/project only |

## Current Findings

### F1. The bridge remains a shared dashboard seam

Status: keep.

Main, Tools, and Filter runtime surfaces use the shared
`useProtectionRuntimeSubscription` hook instead of tab-local runtime snapshot
bridges. Ownership tests already guard against resurrecting the old Tools-local
hook.

### F2. Polling is recovery, not runtime truth

Status: keep.

Fallback polling calls `GET_PROTECTION_RUNTIME_SNAPSHOT`, the same background
owner action used for cached reads. It does not recompute protection state in
dashboard code.

Recovery polling is admitted only while the dashboard document is visible. The
bridge stops its interval while hidden and revalidates through the same canonical
read/refresh route on return. Overlapping reads of one action join one promise;
pushed snapshots and newer action admissions fence older pending responses, so
late GET completions cannot overwrite a newer push. This changes query admission,
not the canonical runtime owner or the permitted cache-miss refresh seam.

### F3. Successful malformed snapshots are now rejected

Status: fixed in the 2026-06-29 protection runtime snapshot bridge pass.

The contract now exposes payload validation helpers. The dashboard bridge
rejects `success:true` responses that omit `snapshot` or provide a malformed
snapshot object, and pushed snapshot messages must pass the same payload
contract before subscribers are updated. Explicit malformed capture timestamps
now fail at the builder boundary instead of being restamped with the current
time, preserving the snapshot owner's clock truth.

### F4. Runtime snapshot read failures are now state, not absence

Status: fixed in the 2026-06-29 Tools artifact capability/runtime pass.

The shared bridge keeps `error` separately from `snapshot`. Cache misses may
still be represented by `snapshot:null`, but `success:false`, rejected runtime
messages, and malformed successful payloads now update the bridge error state
so dashboard consumers can avoid presenting owner read failures as ordinary
inactive runtime state.

### F5. Persisted settings and compiled runtime plans have separate contracts

Status: fixed in the 2026-07-13 compiled filter-plan contract pass.

`RuntimeSnapshotBuilder.plan.filterPlan` is executable truth: level-based entries
already contain both the public `level` and its materialized `value`, followed by
execution/modifier metadata. `canonicalArtifactTelemetry` previously merged that
plan into inactive defaults and called `normalizeFilterSettings()`, whose current
persisted V1 contract correctly rejects `value` on a level entry. The snapshot
bridge now validates compiled entries through
`compiledRuntimeFilterPlanContract.js`, while artifact telemetry consumes a
display-only projection from that same contract. Runtime metadata remains on the
snapshot plan, telemetry sees only its owned state fields, and no consumer turns
compiled entries back into persisted settings.

The same contract also owns the content registry's narrow social-metrics
projection. `SocialMetricsManager` receives one canonical setting instead of the
whole compiled map, so unrelated materialized level entries cannot cross its
settings boundary.

## Re-Audit Checklist

- Run `npm run test:file -- tests/compiledRuntimeFilterPlanContract.test.js tests/protectionRuntimeSnapshotBridge.test.js tests/canonicalArtifactTelemetryProfiles.test.js tests/protectionRuntimeCoordinator.test.js tests/useProtectionRuntimeSubscription.test.jsx tests/protectionRuntimeSnapshotAccess.test.js` after snapshot contract/bridge changes.
- Run `npm run check:dashboard:owner-architecture` after changing the compiled-plan/telemetry ownership seam or dashboard runtime-subscription imports. This structural owner supersedes the retired source-string ownership test.
- Run `npm run lint -- src/domains/protection/contracts/protectionRuntimeSnapshotBridge.js src/apps/dashboard/hooks/protectionRuntimeSubscriptionBridge.js tests/protectionRuntimeSnapshotBridge.test.js tests/useProtectionRuntimeSubscription.test.jsx` after bridge edits.
- Confirm new dashboard runtime consumers use `useProtectionRuntimeSubscription()` rather than a tab-local bridge.
- Confirm background snapshot handlers return `buildProtectionRuntimeSnapshotResponse()` or explicit failure responses.
