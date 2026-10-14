# Artifact Six-Axis Gate Architecture Spec

- Status: Draft
- Date: 2026-04-06
- Scope: `gate` detection ownership, CLSE relationship, permission tiers, session/storage boundaries, content intervention contract, binary guard controls, and protected-tab budget
- Owner: protection runtime / tracking runtime / dashboard product
- Last validated against code: 2026-07-21
- Path policy: planning-allowed
- Canonical for: `gate` owner map, bridge rules, permission model, and v1 intervention contract
- Depends on:
  - `docs/product/dashboard/artifact-six-axis-restructure-prd.md`
  - `docs/system-architecture/02-runtime-storage-boundaries.md`
  - `docs/system-architecture/05-background-runtime-owners.md`
  - `docs/architecture/runtime/content-runtime-target-architecture.md`
  - `docs/architecture/storage/storage-architecture-target.md`
  - `docs/decisions/security/selective-host-permission-security-decision.md`
- Non-goal:
  - moving all `gate` detection into CLSE
  - requiring `history` permission for core `gate` behavior
  - shipping artifact-tab statistics in v1
  - making content-side DOM sensing the canonical owner of tab or re-entry detection

## 1) One-line decision

`gate` must be a first-class protection artifact family with its own core detector stack in tracking/protection runtime.

CLSE may enrich `gate`, but CLSE must not become the canonical owner of `gate` triggers, `gate` session state, or `gate` intervention dispatch.

## 2) Why this decision is correct

`gate` is meant to catch:

- unconscious re-entry
- rapid return after exit
- repeated tab hopping
- same-host tab bursting / parallel clustering

These patterns are mostly:

- browser-event-native
- host-scoped
- short-window
- suitable for deterministic thresholds

They do not fundamentally require:

- long-term baseline learning
- historical analysis
- heavy IndexedDB queries
- content-side behavior sensing

CLSE solves a different problem.

CLSE is best at:

- broader behavior agitation scoring
- loop detection over rolling windows
- baseline-aware anomaly scoring
- optional diagnostics and analysis

If `gate` depends on CLSE as its primary detector, then `gate` becomes tightly coupled to:

- optional behavior permissions
- CLSE feature enablement
- CLSE calibration state
- IndexedDB-backed query paths

That would make a core protection feature less reliable, harder to reason about, and harder to degrade safely.

## 3) Current validated baseline

As of 2026-04-06, code already behaves like this:

- `gate` durable config is top-level `gateConfig`
- `gate` core triggers are computed in protection runtime from browser event state
- CLSE is optional and separate
- CLSE currently contributes only a generic `CLSE_AGITATION` pressure signal into protection
- `gate` does not yet have a dedicated content-side intervention channel

Important current gaps relative to this target:

1. `detourSpreadGuard` must stay tied to the user-selected protected-tab maximum and fresh protected-site entry, not same-host tab counting or recently consumed context history.
2. `returnGuard` is a per-site return lock after the site is fully left (all real tabs gone), not a quick-return question; see `docs/architecture/runtime/intervention-admission-runtime.md` (Return lock).
3. recommendations must explicitly encode the two binary Gate children and the Barrier-owned detour protected-tab budget.
4. the interstitial sidecar must keep using a dedicated gate session owner.

This spec fixes the target direction for those gaps.

## 4) Final architecture

### 4.1 Layer model

`gate` should be implemented as five layers:

1. browser event acquisition
2. gate core evaluators
3. optional CLSE enrichment bridge
4. protection runtime and dispatch
5. content-side gate sidecar

### 4.2 Owner map

| Concern | Canonical owner | Why |
| --- | --- | --- |
| tab/window/navigation event reaction | `trackingBrowserEventHandlers` and tracking runtime owners | raw browser event ownership already lives here |
| host-scoped gate session memory | new typed session owner for gate runtime state | short-window runtime state should survive service worker restarts without becoming history |
| `gate` trigger evaluation | protection runtime input/provider/assembler | hot path, host-scoped, deterministic thresholds |
| CLSE loop/aggression detection | CLSE domain | separate behavior intelligence owner |
| bridge from CLSE to protection | read-only adapter owned by protection runtime | keeps CLSE optional and non-canonical for `gate` |
| durable user config | `gateConfig` settings owner | user-facing configuration belongs in settings |
| content-side gate feedback | protection content sidecar + dispatcher | intervention belongs to protection dispatch/content runtime, not CLSE |

### 4.3 Hard boundary rules

1. `gate` must not write canonical trigger history into CLSE stores.
2. CLSE must not write back into `gateConfig`.
3. content-side signals must not become the canonical owner of re-entry or tab-burst detection.
4. hot `gate` runtime decisions must not require IndexedDB reads.
5. `gate` intervention dispatch must stay under `ProtectionDispatcher` and content runtime boundaries.

## 5) Detection split: what belongs where

### 5.1 `gate` core detectors

The following must remain core `gate` detectors:

| Detector | Canonical owner | Reason |
| --- | --- | --- |
| `entryCheckpoint` | tracking/protection runtime | based on fresh foreground entry and entry pass windows |
| `returnGuard` | tracking/protection runtime | based on a per-site lock armed when an entered protected site has no real tab left |
| `detourSpreadGuard` | tracking/protection runtime | based on a fresh protected-site entry exceeding the protected-tab maximum |

These detectors are valid without:

- CLSE
- `idle`
- `webNavigation`
- `history`

### 5.2 CLSE-owned signals

The following stay CLSE-owned:

- page/site loop detection
- tab aggression score
- navigation aggression score
- scroll aggression score
- media skimming / seek aggression score
- baseline-aware anomaly scoring

This data lives in CLSE stores and CLSE memory, not inside `gate` session state.

### 5.3 Bridge rule

CLSE may enrich `gate`, but only through a read-only bridge.

Allowed bridge behaviors:

- corroborate a core `gate` trigger and increase confidence
- upgrade copy or severity when CLSE and `gate` agree
- emit a soft advisory hint when CLSE sees a loop pattern relevant to `gate`

Disallowed bridge behaviors:

- CLSE as the only source of a hard `gate` intervention
- CLSE directly dispatching `gate` content UI
- CLSE mutating `gateConfig`
- CLSE becoming the durable source of `gate` metrics

## 6) Permission tiers

### 6.1 Tier A: core gate runtime

Required:

- baseline extension permissions already granted in manifest such as `tabs`

Not required:

- `scripting`
- host permissions
- `idle`
- `webNavigation`
- `history`

This tier is sufficient for:

- runtime `gate` trigger calculation
- artifact runtime state
- telemetry generation
- dashboard reflection

### 6.2 Tier B: site control / live intervention

Required:

- `scripting`
- matching host permission for the domain

This tier is required for:

- content runtime injection
- in-page `gate` feedback
- any live intervention surface shown on the target website

This is the same permission boundary already used by protection dispatch and managed content sync.

### 6.3 Tier C: behavior sensing

Required:

- `idle`
- `webNavigation`

This tier enables:

- CLSE runtime collection
- optional `gate` enrichment from behavior context

This tier must remain optional for `gate`.

### 6.4 Tier D: analysis

Required:

- `history`
- Tier C behavior sensing permissions

This tier is only for:

- retrospective analysis
- historical pattern review
- future diagnostics and tuning support

It must not be required for:

- core `gate` trigger detection
- live `gate` intervention

### 6.5 Product rule

Settings and copy should describe these tiers clearly:

1. site control powers intervention
2. behavior sensing powers optional pattern enrichment
3. analysis powers retrospective review

`gate` v1 should not be blocked on analysis permission.

## 7) Storage model

### 7.1 Durable config

Durable user configuration remains:

```js
gateConfig = {
  entryCheckpoint: { enabled: boolean },
  returnGuard: { enabled: boolean },
  detourSpreadGuard: { enabled: boolean, maxProtectedTabs: integer /* 1..20; default 1 */ },
};
```

Decision:

- `entryCheckpoint` and `returnGuard` are the two product-facing binary Gate children
- `detourSpreadGuard` is a Barrier child with a direct protected-tab maximum;
  it remains in `gateConfig` because tracking/protection runtime owns the shared
  browser-event detector and interstitial sidecar
- runtime thresholds live in `gateConfig.js`, not in user-facing per-child sliders

### 7.2 Session state

`gate` needs one typed session owner for host-scoped runtime memory.

Target contents:

- `lastEnteredAt`
- `lastExitAt`
- `lastReturnAt`
- `lastReturnLatencyMs`
- recent host-scoped switch-in timestamps
- recent host-scoped return timestamps
- foreground host/tab scope
- active cooldown windows

Canonical backend:

- `chrome.storage.session`

Reason:

- survives service-worker restart inside the same browser session
- stays out of durable history
- matches storage architecture for in-flight runtime state

Until that seam exists, any in-memory map is transitional only and must not be treated as the final owner.

### 7.3 Historical analytics

If future analytics are added:

- optional diagnostics go to `usage_logs`
- CLSE histories stay in CLSE stores

Neither is allowed to become the hot runtime source of truth for `gate`.

## 8) CLSE bridge contract

### 8.1 Bridge output shape

Future CLSE to `gate` bridge output should be normalized into a small read-only object:

```ts
type GateBehaviorHint = {
  hintType: 'revisit_loop' | 'tab_agitation' | 'nav_agitation' | 'mixed';
  severity: 1 | 2 | 3;
  confidence: number;
  detectedAt: number;
  source: 'clse';
};
```

### 8.2 Bridge usage rules

`GateBehaviorHint` may:

- add explanation text
- increase intervention emphasis by one step at most
- choose a stronger copy variant
- mark telemetry as corroborated

`GateBehaviorHint` may not:

- create a durable setting
- replace the core detector
- exceed one-step severity amplification
- bypass normal domain scope rules

### 8.3 Rollout rule

`gate` v1 ships without requiring the bridge.

The bridge is phase-two enrichment, not a launch blocker.

## 9) Gate intervention model

### 9.1 Product direction

`gate` needs a live intervention, but v1 should keep it simple.

Decision:

- one unified `gate` sidecar
- three trigger variants
- lightweight, theme-aware presentation
- no separate mini-game per child in v1

### 9.2 V1 behavior

| Child | Purpose | Core trigger | V1 intervention |
| --- | --- | --- | --- |
| `entryCheckpoint` | ask once before protected entry | fresh foreground entry without an active entry pass | Hollow Striker entry ritual before deliberate continue |
| `returnGuard` | keep a fully left site closed for a while | fresh foreground entry while the site's 15m return lock holds | no decision: the Hollow Striker waits out the lock, pouring closes the tab |
| `detourSpreadGuard` | reduce parallel protected-site spread | a fresh protected-site entry that exceeds the selected protected-tab maximum | two-sided keep/close selection rail plus one final commit |

### 9.3 V1 UX rules

1. feedback is shown in-page, not in the dashboard
2. artifact tab remains configuration-first
3. live telemetry may exist but is not the primary product surface
4. intervention copy should stay concise and contextual
5. repeated firing should respect per-child cooldowns
6. `detourSpreadGuard` is the hard-budget exception: once a selection returns
   the protected-tab count to budget, the next fresh entry above budget must
   trigger again without a host-wide pass window

## 10) Message contract

### 10.1 Separation rule

`PROTECTION_UPDATE` remains the state synchronization message.

`gate` intervention should use a dedicated typed message instead of being hidden inside `PROTECTION_UPDATE`.

Reason:

- `PROTECTION_UPDATE` is persistent state application
- `gate` intervention is an eventful sidecar action

### 10.2 Target message types

```ts
MESSAGE_TYPES.GATE_INTERVENTION_START
MESSAGE_TYPES.GATE_INTERVENTION_STOP
```

### 10.3 Start payload

```ts
type GateInterventionStart = {
  hostname: string;
  gateKind: 'entryCheckpoint' | 'returnGuard' | 'detourSpreadGuard';
  severity: 'low' | 'mid' | 'high';
  holdDurationMs: number;
  holdUntil: number;
  directTriggers: string[];
  pressureSignals: string[];
  metrics: Record<string, unknown>;
  issuedAt: number;
};
```

### 10.4 Stop payload

```ts
type GateInterventionStop = {
  hostname: string;
  gateKind: 'entryCheckpoint' | 'returnGuard' | 'detourSpreadGuard';
  reason: 'resolved' | 'navigation' | 'permission_shrink' | 'teardown';
};
```

### 10.5 Dispatch rules

1. `ProtectionDispatcher` owns send/no-send decision.
2. content runtime must already be `receiver_ready` or `active`.
3. permission failure must skip intervention cleanly without corrupting runtime state.
4. teardown must clear any active gate UI.

## 11) Tuning model

### 11.1 User-facing rule

For v1, controls must be limited to:

- binary toggles for entry and return guards
- a named `1..3` maximum-protected-tabs choice for detour spread

Do not expose:

- raw thresholds
- debug counters
- freeform numerical sliders

### 11.2 Runtime threshold mappings

`entryCheckpoint`

- 1.5s hold
- 15m entry pass window after presentation

`returnGuard`

- lock: 15m from the moment the site's last real tab is gone
- entered: a real tab stayed 5s on the site
- forgiveness: reopening within 10s withdraws the lock

`detourSpreadGuard`

- the persisted value is an integer maximum protected-site tab count from 1 through 20; the default remains 1 and the recommended value remains 3 independently of the control's upper bound
- no inverted level map or compatibility level is accepted
- the intervention appears only on a fresh foreground protected-site entry when the new total is above that maximum
- recently consumed protected contexts remain telemetry only and cannot trigger this intervention
- tab closure is staged in the interstitial and committed only after the user confirms a selection that leaves no more than the configured maximum
- a successful inline selection requests an authoritative protection resync before the surface resolves so visual, media, and interaction artifacts are active on every kept protected tab
- detour selection does not mint a host-wide cooldown or pass; session reuse handles duplicate delivery while the same unresolved selection remains open

## 12) Preset and profile rules

Built-in protection presets must explicitly include `gate`.

Rule:

- `gate` must not disappear at runtime simply because a non-default preset is active

Allowed behaviors:

- presets may choose on/off Gate defaults
- presets may disable specific `gate` children intentionally

Disallowed behavior:

- silent omission that resolves to `gate` off by accident

## 13) Rejected architectures

The following are rejected:

1. putting `gate` trigger ownership inside CLSE
2. requiring `history` permission before `gate` can work
3. letting content-side observers become the canonical source of re-entry or tab-hopping detection
4. writing `gate` history into both CLSE stores and a separate gate store
5. using artifact-tab live stats as the primary feedback surface
6. hiding `gate` intervention inside generic `PROTECTION_UPDATE` without a typed sidecar contract

## 14) Execution order

1. lock this architecture decision
2. keep `returnGuard` a per-site lock on whole-site departure with no decision while it holds
3. keep `detourSpreadGuard` on fresh protected-site entry plus the user-selected protected-tab maximum
4. keep dedicated `gate` intervention message types and the gate interstitial sidecar
5. explicitly encode the two binary Gate children and the Barrier detour budget in recommendations
6. add CLSE bridge only after core `gate` path is stable

## 15) Success criteria

This spec is satisfied when all of the following are true:

1. `gate` core detection works without CLSE and without analysis permission.
2. `gate` live intervention works with site-control permissions only.
3. CLSE can enrich `gate` but cannot become its canonical owner.
4. `gate` runtime session memory has one typed session owner.
5. built-in presets explicitly encode `gate` behavior.
6. dashboard controls are binary or direct protected-tab choices, never fake levels or raw detector thresholds.
7. content-side gate feedback uses a dedicated typed message contract.
