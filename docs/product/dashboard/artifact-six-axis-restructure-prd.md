# Artifact Six-Axis Restructure PRD

- Status: Proposed
- Date: 2026-04-06
- Scope: canonical artifact family expansion from 5 to 6 families, Zen manifestation split, dashboard IA/copy realignment
- Owner: dashboard product / protection runtime
- Last validated against code: 2026-04-06
- Path policy: planning-allowed
- Decision needed: whether Entropy will adopt `gate` as the sixth canonical artifact family and proceed with the storage, dashboard, theme, and runtime rollout described below.
- Depends on:
  - `src/domains/protection/catalog/artifactFamilyCatalog.js`
  - `src/domains/protection/catalog/artifactCatalog.js`
  - `src/domains/protection/contracts/artifactIds.js`
  - `src/themes/core/tools/artifacts.js`
  - `src/apps/dashboard/hooks/useProtectionArtifactSettingsControl.js`
  - `src/apps/dashboard/hooks/useProtectionArtifactsControlPlane.js`
  - `src/apps/dashboard/tabs/tools/artifactCardSchemas.jsx`
  - `src/i18n/locales/en/tools.js`
  - `src/i18n/locales/ko/tools.js`
- Non-goal:
  - immediate runtime implementation of every new `gate` child artifact
  - theme-wide visual redesign of all existing artifacts
  - replacing current `echo` runtime behavior in the same change

> Supersession note (2026-07-21): this file preserves the original six-family
> proposal and its example payloads. The shipped dashboard protocol now has
> seven families including `brake`; current child shapes and control modes are
> canonical in `artifact-tab-canonical-protocol.md` and
> `artifact-protocol-runtime-contract.md`. Do not copy the level-shaped examples
> below into current code or storage.

## 1) Decision Summary

The artifact system should expand from five canonical families to six.

The new canonical family is:

- `gate`

`gate` is the canonical family for:

- entry guard
- rapid re-entry prevention
- multi-tab / tab-hopping prevention
- intentionality restore at the moment of access

Zen manifestation policy:

- `gate` family manifestation in Zen: `The Hollow Striker`
- `echo` family manifestation in Zen remains separate: `The Forgetting Tide`

This preserves both artifacts without collapsing two distinct behavioral roles into one card.

## 2) Why 6 Families Is Correct

The issue is not raw card count. The issue is whether each card owns one distinct behavioral axis.

Five-family structure was beginning to blur two different moments:

- `barrier`: interrupts an already active consumption flow
- `echo`: clears residue after exit

But the product also needs a third moment:

- `gate`: stops unconscious entry or re-entry before the next session re-forms

Without `gate`, the most important “I opened it again without thinking” behavior gets awkwardly squeezed into `barrier` or `echo`.

That weakens all three.

## 3) Canonical Family Model

### 3.1 Final canonical families

1. `lens`
2. `veil`
3. `barrier`
4. `flare`
5. `echo`
6. `gate`

### 3.2 Family semantics

#### `lens`

Purpose:

- reduce sensory reward density
- make visual intake less addictive

User-facing one-line:

- “보이는 자극을 낮춥니다.”

#### `veil`

Purpose:

- hide social comparison and feedback signals
- reduce metric-driven compulsion

User-facing one-line:

- “사회적 신호를 가립니다.”

#### `barrier`

Purpose:

- interrupt an already-active consumption flow
- introduce friction inside the current session

User-facing one-line:

- “소비 흐름을 끊습니다.”

#### `flare`

Purpose:

- make time pressure, budget pressure, and overrun risk visible

User-facing one-line:

- “시간 초과를 경고합니다.”

#### `echo`

Purpose:

- clear residue after exit
- remove traces that pull the user back later

User-facing one-line:

- “떠난 뒤 흔적을 정리합니다.”

#### `gate`

Purpose:

- stop unconscious entry
- slow rapid re-entry
- resist tab hopping and parallel self-fragmentation

User-facing one-line:

- “무의식적 재진입을 막습니다.”

## 4) Temporal Ownership Model

Families should also be legible by when they act.

- `gate`: `pre_entry`, `reentry`, `context_switch`
- `lens`: `active`
- `veil`: `active`
- `barrier`: `active`
- `flare`: `active`
- `echo`: `exit`, `post_exit`

This is the key distinction between `gate`, `barrier`, and `echo`.

### 4.1 `gate` vs `barrier`

- `gate` acts before or during return
- `barrier` acts after a session is already underway

### 4.2 `gate` vs `echo`

- `gate` slows the next entry
- `echo` clears what remains after exit

## 5) Canonical Child Artifact Reallocation

### 5.1 `lens`

Keep:

- `grayscale`
- `blur`
- `textRhythm`

Future-compatible candidates:

- `contrastFlatten`
- `noveltyDrain`
- `colorMute`

### 5.2 `veil`

Keep:

- `socialMetrics`
- `timeSignals`
- `socialSurface`

Future-compatible candidates:

- `trendBadgeMute`
- `audienceSignalMute`
- `recommendationStatusMute`

### 5.3 `barrier`

Keep / clarify:

- `loopBreaker`
- `timeAnchor`
- `shortformBlock`
- `videoSkipGuard`
- `scrollFlow`
- `skipFriction`

Meaning:

- in-session intervention after a consumption path already exists

### 5.4 `flare`

Keep / expand:

- `sentinelFlare`

Future-compatible candidates:

- `budgetNearExhausted`
- `overrunAlarm`
- `sessionHeatAlert`

Decision:

- `timeSignals` stays under `veil`
- rationale: it hides freshness, recency, and time-stamp exposure signals in the web surface rather than surfacing the user's own budget state

### 5.5 `echo`

Keep / expand:

- `memoryPurge`
- `historyCleanup`
- `bookmarkCleanup`
- `sessionResidueCleanup`

Future-compatible candidates:

- `watchLaterCleanup`
- `searchResidueCleanup`

Decision:

- `echo` remains the cleanup-and-residue family
- Zen `The Forgetting Tide` remains the manifestation here

### 5.6 `gate`

New family:

- `entryCheckpoint`
- `returnGuard`
- `detourSpreadGuard`

Future-compatible candidates:

- `intentHold`
- `reopenFriction`

Decision:

- Zen `The Hollow Striker` is the primary manifestation for `gate`

## 6) Theme Manifestation Policy

Canonical families are not theme names.

Theme manifestations are presentation layers attached to canonical families.

### 6.1 Required separation

- canonical family id: stable, theme-neutral
- manifestation title: theme-specific, world-specific

### 6.2 Recommended Zen mapping

- `lens` -> `Shoji`
- `veil` -> `Enso`
- `barrier` -> `The Causality Lantern` or existing Zen barrier manifestation
- `flare` -> `Dreamscape Furin`
- `echo` -> `The Forgetting Tide`
- `gate` -> `The Hollow Striker`

### 6.3 Example non-Zen mapping

- `gate`
  - entropy: `Airlock`
  - cyberpunk: `Checkpoint`
  - matrix: `Sentinel Gate`
  - clinical: `Intake Lock`
  - scp: `Containment Gate`

The family is stable. The artifact name changes by theme.

## 7) Dashboard Card Order

Recommended canonical dashboard order:

1. `lens`
2. `veil`
3. `barrier`
4. `flare`
5. `echo`
6. `gate`

### 7.1 Why `gate` is last

`gate` is behaviorally foundational, but visually and conceptually it works best as the final card because:

- it reads like a deliberate higher-order commitment axis
- it stands apart from “while using” and “after leaving” interventions
- it creates a strong final artifact beat in the tab

### 7.2 Alternative order if intent-first framing is desired later

Possible later order:

1. `gate`
2. `lens`
3. `veil`
4. `barrier`
5. `flare`
6. `echo`

This document does not recommend that for the first rollout.

## 8) Card Copy Draft

### 8.1 Canonical family copy

#### `lens`

- title: `Lens`
- subtitle: `Reduce visual reward density`
- description: `Flatten sharp visual novelty so scrolling and skimming arrive with less automatic pull.`

#### `veil`

- title: `Veil`
- subtitle: `Silence social reward signals`
- description: `Hide counts, comparison cues, and social proof that intensify reflexive checking.`

#### `barrier`

- title: `Barrier`
- subtitle: `Interrupt active consumption flow`
- description: `Break endless movement and force a conscious pause once a session is already in motion.`

#### `flare`

- title: `Flare`
- subtitle: `Warn when time pressure rises`
- description: `Surface overrun risk before a session quietly exceeds the day’s intended bounds.`

#### `echo`

- title: `Echo`
- subtitle: `Clear residue after exit`
- description: `Remove traces that make tomorrow’s return easier than today’s decision.`

#### `gate`

- title: `Gate`
- subtitle: `Stop unconscious re-entry`
- description: `Slow reflexive return, tab hopping, and parallel self-fragmentation before another session starts.`

### 8.2 Zen manifestation copy

#### `gate` / Zen manifestation: `The Hollow Striker`

- title: `The Hollow Striker`
- subtitle: `Break the return impulse`
- description: `A measured strike at the threshold. It interrupts rapid re-entry, tab hopping, and unintentional opening before momentum reforms.`

#### `echo` / Zen manifestation: `The Forgetting Tide`

- title: `The Forgetting Tide`
- subtitle: `Wash away residue`
- description: `It clears the traces that invite another return after you have already chosen to leave.`

## 9) Runtime Artifact Model

The current catalog mixes canonical family identity with runtime execution identity.

The next structure should preserve that separation:

- canonical family: dashboard and user-facing grouping
- runtime artifact: execution unit

### 9.1 Recommended canonical family ids

```js
export const PROTECTION_CANONICAL_ARTIFACT_IDS = Object.freeze({
  LENS: 'lens',
  VEIL: 'veil',
  BARRIER: 'barrier',
  FLARE: 'flare',
  ECHO: 'echo',
  GATE: 'gate',
});
```

### 9.2 Recommended runtime artifact ids

```js
export const PROTECTION_RUNTIME_ARTIFACT_IDS = Object.freeze({
  LOOP_BREAKER: 'loopBreaker',
  TIME_ANCHOR: 'timeAnchor',
  SENTINEL_FLARE: 'sentinelFlare',
  MEMORY_PURGE: 'memoryPurge',
  ENTRY_CHECKPOINT: 'entryCheckpoint',
  RETURN_GUARD: 'returnGuard',
  DETOUR_SPREAD_GUARD: 'detourSpreadGuard',
});
```

### 9.3 Recommended runtime catalog shape

```js
export const RUNTIME_ARTIFACT_CATALOG = Object.freeze({
  loopBreaker: Object.freeze({
    id: 'loopBreaker',
    artifactId: 'barrier',
    familyId: 'barrier',
    phase: 'active',
    featureKeys: ['infiniteScrollGuard'],
    armsWhenEnabled: true,
    armTriggers: [],
    engageTriggers: ['INFINITE_SCROLL_DETECTED'],
    cleanupTriggers: [],
    cooldownMs: 10_000,
  }),
  timeAnchor: Object.freeze({
    id: 'timeAnchor',
    artifactId: 'barrier',
    familyId: 'barrier',
    phase: 'entry',
    featureKeys: ['shortFormBlock', 'videoSkipGuard'],
    armsWhenEnabled: true,
    armTriggers: [],
    engageTriggers: ['SHORT_FORM_ENTRY', 'VIDEO_SEEK_ABUSE'],
    cleanupTriggers: [],
    cooldownMs: 5_000,
  }),
  sentinelFlare: Object.freeze({
    id: 'sentinelFlare',
    artifactId: 'flare',
    familyId: 'flare',
    phase: 'active',
    featureKeys: [],
    armsWhenEnabled: false,
    armTriggers: ['BUDGET_NEAR_EXHAUSTED'],
    engageTriggers: ['BUDGET_EXCEEDED'],
    cleanupTriggers: [],
    cooldownMs: 30_000,
  }),
  memoryPurge: Object.freeze({
    id: 'memoryPurge',
    artifactId: 'echo',
    familyId: 'echo',
    phase: 'post_exit',
    featureKeys: [],
    armsWhenEnabled: false,
    armTriggers: [],
    engageTriggers: [],
    cleanupTriggers: ['SESSION_END', 'SITE_EXIT'],
    cooldownMs: 0,
  }),
  entryCheckpoint: Object.freeze({
    id: 'entryCheckpoint',
    artifactId: 'gate',
    familyId: 'gate',
    phase: 'pre_entry',
    featureKeys: [],
    armsWhenEnabled: true,
    armTriggers: [],
    engageTriggers: ['ENTRY_CHECKPOINT_REQUIRED'],
    cleanupTriggers: [],
    cooldownMs: 900_000,
  }),
  returnGuard: Object.freeze({
    id: 'returnGuard',
    artifactId: 'gate',
    familyId: 'gate',
    phase: 'reentry',
    featureKeys: [],
    armsWhenEnabled: true,
    armTriggers: [],
    engageTriggers: ['RETURN_GUARD_REQUIRED'],
    cleanupTriggers: [],
    cooldownMs: 90_000,
  }),
  detourSpreadGuard: Object.freeze({
    id: 'detourSpreadGuard',
    artifactId: 'gate',
    familyId: 'gate',
    phase: 'context_switch',
    featureKeys: [],
    armsWhenEnabled: true,
    armTriggers: [],
    engageTriggers: ['DETOUR_SPREAD_DETECTED', 'PROTECTED_TAB_CLUSTER', 'PROTECTED_CONTEXT_CONSUMED'],
    cleanupTriggers: [],
    cooldownMs: 30_000,
  }),
});
```

## 10) Dashboard State Shape Recommendation

The dashboard family state should evolve to support the new `gate` family without forcing runtime implementation in the same step.

### 10.1 Recommended `artifactFamilies` state shape

```js
const artifactFamilies = Object.freeze({
  lens: {
    enabled: true,
    children: {
      grayscale: { controlMode: 'binary', enabled: true },
      blur: { controlMode: 'binary', enabled: true },
      textRhythm: { controlMode: 'binary', enabled: false },
    },
  },
  veil: {
    enabled: true,
    children: {
      socialMetrics: {
        enabled: true,
        optionCount: 2,
        optionMax: 3,
      },
      timeSignals: {
        enabled: true,
      },
      socialSurface: {
        enabled: true,
        ready: true,
      },
    },
  },
  barrier: {
    enabled: true,
    children: {
      shortformBlock: { enabled: true },
      scrollFlow: { enabled: true, distancePx: 3200, viewportRatio: 0.85 },
      skipFriction: { enabled: false },
    },
  },
  flare: {
    enabled: true,
    children: {
      sentinelFlare: { enabled: true },
    },
  },
  echo: {
    enabled: true,
    children: {
      memoryPurge: {
        enabled: true,
        historyCleanupEnabled: true,
        bookmarkConcealEnabled: false,
      },
    },
  },
  gate: {
    enabled: true,
    children: {
      entryCheckpoint: { enabled: true },
      returnGuard: { enabled: true },
      detourSpreadGuard: { enabled: false },
    },
  },
});
```

## 11) Required File-Level Refactor Plan

### 11.1 Canonical catalog

Update:

- `src/domains/protection/catalog/artifactFamilyCatalog.js`

Changes:

- add `GATE`
- set order to 6
- add title/description key
- add release children:
  - `entryCheckpoint`
  - `returnGuard`
  - `detourSpreadGuard`

### 11.2 Runtime ids and catalog

Update:

- `src/domains/protection/contracts/artifactIds.js`
- `src/domains/protection/catalog/artifactCatalog.js`

Changes:

- add four new runtime artifact ids
- add `phase` field to runtime catalog entries
- add `gate` bindings

### 11.3 Dashboard tools catalog

Update:

- `src/themes/core/tools/artifacts.js`

Recommended new definition:

```js
gate: Object.freeze({
  id: 'gate',
  manifestationKey: 'threshold',
  visualKey: 'gate',
  widgetType: 'Artifact_Gate',
  iconKey: 'gate',
}),
```

The manifestation key is intentionally canonical-neutral.
Zen-specific naming should happen in translation/content layers, not in the canonical id.

### 11.4 Dashboard card schema

Update:

- `src/apps/dashboard/tabs/tools/artifactCardSchemas.jsx`
- `src/apps/dashboard/tabs/tools/artifactCards/derivedState.js`
- `src/apps/dashboard/tabs/tools/artifactCards/visualStates.js`

Changes:

- add `buildGateCard`
- add `extendGateDerivedState`
- do not add per-card configured-active resolvers; tools-tab activation flows through `src/apps/dashboard/tabs/tools/artifactActivationState.js`
- keep card runtime-derived state and card visual-state builders out of the shared card UI helper module

### 11.5 Dashboard control plane

Update:

- `src/apps/dashboard/hooks/useProtectionArtifactSettingsControl.js`
- `src/apps/dashboard/hooks/useProtectionArtifactsControlPlane.js`

Changes:

- expose `gate` family state and handlers
- keep `echo` separate from `gate`
- keep `timeSignals` owned by `veil`

### 11.6 Runtime telemetry selection

Update:

- `src/domains/protection/runtime/canonicalArtifactTelemetry.js`

Changes:

- add `gateRuntimeChildren`
- contextual metrics can later include:
  - `recentReturnCount`
  - `protectedTabCount`
  - `consumedProtectedContextCount`
  - `contextSwitchRate`
  - `cooldownUntil`

### 11.7 I18n

Update:

- `src/i18n/locales/en/tools.js`
- `src/i18n/locales/ko/tools.js`
- JSON mirrors if they remain canonical in the locale flow

Changes:

- add `artifacts.gate.*`
- add gate child labels / descriptions / level feedback
- keep `timeSignals` copy under `veil`
- preserve Zen `The Forgetting Tide` copy under `echo`
- add Zen `The Hollow Striker` copy under `gate`

### 11.8 Theme icons

Update:

- `src/themes/plugins/zen/widgets/tools/ArtifactIcons.jsx`
- other theme icon files as available

Changes:

- add `gate`
- in Zen, `gate` icon should resolve to `The Hollow Striker`

## 12) Gate Family Card Shape

Recommended card content:

- `entryCheckpoint` toggle
- `returnGuard` toggle
- `detourSpreadGuard` toggle

### 12.1 Preset behavior

#### `sealed`

- all `gate` children off

#### `recommended`

- `entryCheckpoint` on
- `returnGuard` on
- `detourSpreadGuard` off

#### `strong`

- `entryCheckpoint` on
- `returnGuard` on
- `detourSpreadGuard` on

## 13) Migration Rules

### 13.1 Existing five-family installs

On first rollout:

- no current setting should silently disappear
- `timeSignals` should not migrate families
- `gate` should default to:
  - enabled if Zen `The Hollow Striker` is already conceptually active in experimental tooling
  - otherwise recommended-off or recommended-on based on product launch decision

### 13.2 No fallback sprawl

Do not create dual ownership for `timeSignals`.

Canonical owner remains:

- `veil`

## 14) Recommended Rollout Order

### Phase 1

- freeze this taxonomy
- add `gate` to canonical catalogs and tool definitions
- keep `timeSignals` ownership in `veil`
- no runtime behavior change yet

### Phase 2

- add dashboard `gate` card
- add icon and copy
- expose disabled or mock telemetry safely if runtime is not finished

### Phase 3

- implement runtime `entryCheckpoint`
- implement `returnGuard`
- implement `detourSpreadGuard`
- wire Zen manifestation to `The Hollow Striker`

## 15) Final Product Position

The six-axis artifact system should read as:

- `Lens`: reduce visual reward density
- `Veil`: hide social comparison signals
- `Barrier`: interrupt active consumption flow
- `Flare`: warn when time pressure rises
- `Echo`: clear residue after exit
- `Gate`: stop unconscious re-entry

Zen then maps the last two to:

- `The Forgetting Tide` for `Echo`
- `The Hollow Striker` for `Gate`

This is the cleanest way to preserve both artifacts while giving re-entry prevention the first-class status it deserves.
