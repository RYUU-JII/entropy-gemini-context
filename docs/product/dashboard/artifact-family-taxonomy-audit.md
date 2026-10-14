# Artifact Family Taxonomy Audit

- Status: Draft
- Date: 2026-07-21
- Scope: canonical artifact family child taxonomy review, control-mode fit review, and dashboard/runtime alignment recommendations
- Owner: dashboard product / protection runtime
- Last validated against code: 2026-07-21
- Path policy: planning-allowed
- Canonical for: current audit conclusions and recommended next taxonomy cleanup order
- Depends on:
  - `src/domains/protection/catalog/artifactFamilyCatalog.js`
  - `src/apps/dashboard/hooks/useProtectionArtifactSettingsControl.js`
  - `src/apps/dashboard/hooks/useProtectionArtifactsControlPlane.js`
  - `src/apps/dashboard/hooks/useProtectionEchoArtifactControl.js`
  - `src/apps/dashboard/hooks/artifactSettings/useGateArtifactSettingsFamily.js`
  - `src/domains/settings/config/gateConfig.js`
  - `docs/product/dashboard/artifact-tab-canonical-protocol.md`
  - `docs/product/dashboard/artifact-six-axis-gate-architecture-spec.md`
- Non-goal:
  - immediate runtime redesign of every artifact family
  - final visual redesign of artifact cards
  - changing protection strategy escalation logic in the same pass

## 1) One-line decision

The seven canonical families now expose only controls that match real user
decisions: perceptual levels where degree matters, binary switches where one
curated behavior is sufficient, and named semantic choices where the options
change policy or scope.

- each child represents one real user-facing behavior
- each child uses the right control mode
- workflow or runtime overlay state does not masquerade as durable family truth

## 2) Audit criteria

Each family was reviewed against four questions.

1. Does the family own one coherent behavioral axis?
2. Is each child a real user-facing feature rather than an internal detector or workflow artifact?
3. Does the child use the right control mode:
   - `binary`
   - `level`
   - `choice`
4. Does the dashboard contract match the runtime and settings contract closely enough to avoid hidden semantics?

## 3) Summary

| Family | Taxonomy verdict | Control-mode verdict | Recommended action |
| --- | --- | --- | --- |
| `lens` | good | good | binary grayscale and blur; runtime-only adaptive profiles |
| `veil` | good | good | keep social scope semantic and the other children binary |
| `brake` | good | good | keep both curated effects binary |
| `barrier` | good | good | keep skip policy and protected-tab budget semantic |
| `flare` | acceptable | acceptable | keep single-child family for now |
| `echo` | good | good | keep workflow state outside the two binary children |
| `gate` | good | good | keep the two checkpoint guards binary |

## 4) Family-by-family audit

### 4.1 `lens`

Current children:

- `grayscale`
- `blur`
- `textRhythm`
- `inputVisualBrake`

Verdict:

- taxonomy is strong
- all four children belong to one sensory-density/input-rhythm axis
- grayscale, blur, and Text Rhythm have runtime-only adaptive profiles
- Text Rhythm shares the named bands; input visual brake has a fixed binary profile

Recommended control modes:

- `grayscale`: `binary`
- `blur`: `binary`
- `textRhythm`: `binary`
- `inputVisualBrake`: `binary`

Recommendation:

- keep the current child taxonomy
- keep family-level recommendation support
- reject obsolete level-shaped values for binary children instead of migrating them
- do not replace the two real levels with raw sliders in the main artifact surface

### 4.2 `veil`

Current children:

- `socialMetrics`
- `timeSignals`
- `intentThreshold`

Verdict:

- family axis is correct: hide compulsive social cues
- all three children are runtime-backed release behavior
- social metric scope changes which cue classes are hidden, while time signals
  and the intent threshold only need a curated on/off behavior

Recommended control modes:

- `socialMetrics`: `choice`
- `timeSignals`: `binary`
- `intentThreshold`: `binary`

Recommendation:

- keep `socialMetrics`
- keep `timeSignals`
- keep `intentThreshold`
- expose the named social scope rather than independent low-level metric toggles

### 4.3 `barrier`

Current children:

- `shortformBlock`
- `skipFriction`
- `detourSpreadGuard`

Verdict:

- family axis is correct: in-session interruption of an already active consumption flow
- the child split matches product semantics
- runtime module names such as `loopBreaker` and `timeAnchor` should remain execution detail, not user-facing child names

Recommended control modes:

- `shortformBlock`: `binary`
- `skipFriction`: `choice` between cooldown and hard block
- `detourSpreadGuard`: bounded-count `choice` for the maximum protected tabs

Recommendation:

- keep the family and child split
- keep policy names and tab budget explicit rather than encoding them as fake levels
- reject old numeric skip levels and the old Gate-owned detour shape

### 4.4 `brake`

Current children:

- `scrollFriction`
- `navigationButtonLock`

Verdict:

- both children slow an already-formed navigation impulse
- scroll friction has one canonical 1000ms light material profile
- navigation lock is inherently on/off

Recommended control modes:

- `scrollFriction`: `binary`
- `navigationButtonLock`: `binary`

Recommendation:

- keep physical tuning internal to the canonical scroll profile
- do not let schedules, recommendations, or policy strength manufacture a
  second public scroll-strength axis

### 4.5 `flare`

Current children:

- `sentinelFlare`

Verdict:

- a single-child family is acceptable here because the family still owns a distinct axis: warning and wake-up signaling
- the family does not yet need more child breakdown to be coherent

Recommended control modes:

- `sentinelFlare`: `binary`

Recommendation:

- keep `sentinelFlare` as the only release child for now
- do not expand child count until new alert behaviors become semantically distinct

### 4.6 `echo`

Current dashboard children:

- `historyCleanup`
- `bookmarkConceal`

Verdict:

- family axis is still good: clear residue after exit
- both durable choices are independent binary children
- confirmation and operation status remain outside canonical family child truth

Boundary evidence:

- `historyCleanupEnabled` and `bookmarkConcealEnabled` are real user-facing feature choices
- `pendingConfirmation` is not a feature choice
- `status` is not a feature choice
- the current artifact workflow maps own `pendingConfirmation` and status

Canonical taxonomy:

- canonical family: `echo`
- canonical children:
  - `historyCleanup`
  - `bookmarkConceal`

Recommended control modes:

- `historyCleanup`: `binary`
- `bookmarkConceal`: `binary`

Boundary rule:

- keep `pendingConfirmation` out of canonical family child state
- keep `status` out of canonical family child state
- keep both in the named non-family dashboard workflow state

Manifestation rule:

- `memoryPurge` may remain the manifestation or card identity in lore/presentation
- it should not force two durable sub-features plus workflow state into one canonical child

### 4.7 `gate`

Current shipped dashboard child shape:

- `entryCheckpoint`
- `returnGuard`

Current historical document/storage pressure:

- older drafts described trigger-shaped controls and placed detour spread under Gate

Verdict:

- family axis is correct and important
- the two checkpoint guards are the complete Gate release-child contract
- detour spread belongs to Barrier because it limits an active consumption detour

Why the 2-child model is stronger:

- `entryCheckpoint` is one understandable user-facing action
- `returnGuard` is one understandable user-facing action
- each guard has one canonical behavior and no user-meaningful strength degree

Recommended target taxonomy:

- canonical family: `gate`
- canonical children:
  - `entryCheckpoint`
  - `returnGuard`

Recommended control modes:

- `entryCheckpoint`: `binary`
- `returnGuard`: `binary`

Boundary rule:

- do not expose legacy detector names as canonical child state
- do not return detour spread to Gate or keep fake `level` controls
- if stepped tuning returns later, it must produce meaningfully different user-visible behavior before reintroducing `level`

## 5) Control-mode recommendations

### 5.1 Children that should stay `binary`

- `lens.textRhythm`
- `lens.inputVisualBrake`
- `veil.timeSignals`
- `veil.intentThreshold`
- `brake.scrollFriction`
- `brake.navigationButtonLock`
- `barrier.shortformBlock`
- `echo.historyCleanup`
- `echo.bookmarkConceal`
- `gate.entryCheckpoint`
- `gate.returnGuard`

### 5.2 Children that should stay `level`

- `lens.grayscale`
- `lens.blur`

### 5.3 Children that should stay semantic `choice`

- `veil.socialMetrics`: named hidden-cue scope
- `barrier.skipFriction`: cooldown or hard block policy
- `barrier.detourSpreadGuard`: maximum protected-tab budget

## 6) Convergence result

### 6.1 `echo`

Completed boundary:

- separate canonical child intent from destructive-action workflow state

### 6.2 `gate` and `barrier`

Completed boundary:

- keep Gate to its two checkpoint guards
- place detour spread under Barrier and expose its protected-tab budget directly

### 6.3 User-facing strength cleanup

- keep grayscale and blur ON/OFF only; select named profiles in runtime, not settings
- keep curated physical/temporal effects binary
- use named choice values for semantic policy, scope, and bounded count
- reject obsolete shapes; do not add pre-release migration or read fallback

## 7) Final recommendation

The family map itself should remain:

1. `lens`
2. `veil`
3. `brake`
4. `barrier`
5. `flare`
6. `echo`
7. `gate`

The main taxonomy work should focus on making child identity honest.

That means:

- no workflow state inside canonical child truth
- no internal detector names pretending to be product-facing children
- no fake level controls where behavior is actually binary or semantic
- no migration layer that preserves pre-release level-shaped settings
