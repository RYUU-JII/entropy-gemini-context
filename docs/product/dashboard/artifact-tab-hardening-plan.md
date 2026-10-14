# Artifact Tab Hardening Plan

- Status: Draft
- Date: 2026-03-22
- Scope: Tools/Artifacts tab structural hardening for canonical artifact convergence, settings ownership, runtime synchronization, and theme contract stability
- Depends on:
  - `docs/product/dashboard/artifact-protocol-runtime-contract.md`
  - `docs/product/dashboard/artifact-tab-canonical-protocol.md`
- Owner: dashboard architecture
- Last validated against code: 2026-03-22
- Path policy: planning-allowed
- Canonical for: artifact tab completion criteria and phased hardening plan

Final dashboard-boundary protocol shape now lives in:

- `docs/product/dashboard/artifact-tab-canonical-protocol.md`

## 1) One-line decision

`Lens` and `Veil` remain canonical artifacts.

Their historical origin as filter elements is preserved only at the execution layer through `executionKind: "filter_settings"`.

That history must not create a second-class control-surface model, preload contract, or runtime-sync path.

## 2) Why this plan exists

The current structure is close to the intended artifact-first model, but it is not fully converged.

Today the tab mixes four different axes:

- canonical artifact identity
- filter-backed execution details
- theme presentation widgets
- settings/runtime refresh behavior

This is why `Lens` and `Veil` still feel structurally different from `Barrier`, `Flare`, and `Echo`.

The main problem is not that they are filter-backed.
The main problem is that their filter-backed history still leaks into authoring and coordination seams that should already be canonical.

## 3) Current structural gaps

### 3.1 Catalog drift

Canonical artifact definitions already include `lens` and `veil`, but tab-level preload wiring is still partly hand-maintained.

That allows the tab readiness contract and the canonical artifact contract to drift apart.

### 3.2 Split settings ownership

Some artifact settings flow through the protocol store and command bus, while others are read and written through separate direct settings helpers.

This creates uneven pending-state behavior, uneven retry semantics, and a greater chance of stale reads or last-write-wins races.

### 3.3 Inconsistent runtime refresh semantics

Some artifact-affecting changes participate naturally in protection broadcast and runtime snapshot refresh, while others rely on ad hoc UI refresh behavior.

That is acceptable for experimentation, but not for a finished artifact architecture.

### 3.4 Semantic actions are not first-class yet

Some family-level user intents are still implemented as chains of lower-level child toggles.

That makes the structure harder to reason about and leaves too much mutation knowledge in card-schema code.

## 4) Target end-state

The finished architecture should satisfy the following rules.

### 4.1 One canonical artifact model

All five artifact families are the same kind of thing at the dashboard boundary:

- `lens`
- `veil`
- `barrier`
- `flare`
- `echo`

Each family has four layers:

1. canonical identity
2. user-facing configuration
3. runtime execution binding
4. theme manifestation

Only layer 3 may differ between filter-backed and runtime-artifact-backed families.

Implication:

- `Lens` and `Veil` are not "filter UI pretending to be artifacts"
- `Barrier`, `Flare`, and `Echo` are not the only "real" artifacts
- execution differences stay behind `canonicalArtifactRuntimeBinding`

### 4.2 Single source of truth per concern

The finished state should have one primary owner for each concern.

#### Canonical artifact contract

- owner: `src/themes/core/tools/artifacts.js`
- responsibilities:
  - canonical artifact ids
  - order
  - visual keys
  - widget contract keys

No tab-level static list should duplicate canonical artifact widget types by hand.

#### Runtime execution binding

- owner: `src/domains/protection/runtime/canonicalArtifactRuntimeBinding.js`
- responsibilities:
  - execution kind
  - runtime state source
  - child execution bindings
  - legacy runtime expansion when required

#### Effective artifact settings

- owner: dashboard settings store surface backed by command-bus semantics
- responsibilities:
  - current effective values
  - pending values
  - write ordering
  - retry behavior

The artifact tab may keep local state only for:

- input drafts
- modal visibility
- temporary UI notices
- animation/debug state

It should not own durable artifact configuration truth.

### 4.3 Semantic mutation APIs

The artifact tab should mutate settings through semantic actions, not by manually stitching together unrelated low-level setters in card code.

Examples of finished-state actions:

- `setLensEnabled(enabled)`
- `updateLensChildren(patch)`
- `setVeilEnabled(enabled)`
- `updateVeilChildren(patch)`
- `setBarrierEnabled(enabled)`
- `updateBarrierConfig(patch)`
- `setFlareEnabled(enabled)`
- `updateFlareConfig(patch)`
- `setEchoEnabled(enabled)`
- `updateEchoConfig(patch)`

Rule:

one user intent should map to one semantic mutation boundary, ideally one patch write.

### 4.4 Explicit runtime-impact contract

Any durable setting that can change artifact availability, behavior, or runtime telemetry must participate in one explicit runtime-impact rule.

That contract must not depend on whether the family is filter-backed or runtime-artifact-backed.

In the finished state:

- `filterSettings` changes participate
- `nudgeConfig` changes participate
- `autoPurgeNewSites` changes participate
- `noHistoryForBlocked` changes participate
- other artifact-owned settings participate if they affect runtime truth

The UI should not need artifact-specific "refresh because this one is special" workarounds.

### 4.5 Theme layer stays presentation-only

Theme-specific names such as `Shoji` and `Enso` remain manifestation names only.

Theme code may customize:

- panel rendering
- canvas rendering
- visual widgets
- scene specs

Theme code may not redefine:

- canonical ids
- execution semantics
- storage ownership
- runtime telemetry meaning

### 4.6 Testable and enforceable seams

The finished state is not complete unless CI can catch regression drift.

At minimum, CI or tests should fail when:

- a canonical artifact widget contract exists but the tools preload contract omits it
- an artifact-impacting settings key does not participate in runtime refresh/broadcast rules
- tools shared control-plane code starts bypassing the canonical dashboard settings ownership seams
- a theme fails to implement a required canonical artifact widget contract

## 5) Decision for Lens and Veil

### 5.1 Accepted model

`Lens` and `Veil` stay inside the canonical artifact family model.

They are first-class artifacts with filter-backed realization.

Their structural difference is expressed only as:

- `executionKind: "filter_settings"`
- `stateSource: "runtime_filter_plan"`

This is a valid difference in execution binding, not a reason to demote them at the UI architecture layer.

### 5.2 Rejected alternatives

#### Alternative A: move Lens and Veil back out of artifacts

Rejected because it reintroduces a permanent split between "artifact-like" and "filter-like" control surfaces.

That would undo the artifact-first IA direction.

#### Alternative B: keep Lens and Veil in the tab, but treat them as special pseudo-artifacts forever

Rejected because it preserves ambiguity in preload, settings ownership, and runtime sync.

This is the exact class of drift the hardening work should remove.

## 6) Patch strategy

Implementation should move in phases so each step tightens one seam and lowers drift risk before deeper refactors.

### Phase 0: Lock the target state in tests and helpers

Goal:

- make drift visible before behavior changes

Changes:

- add a helper that derives all canonical tools artifact widget types from `TOOLS_ARTIFACT_DEFINITIONS`
- make tab preload wiring consume that helper instead of a hand-maintained partial list
- add tests that assert tools preload coverage matches canonical artifact widget definitions exactly

Expected result:

- `Lens` and `Veil` can no longer be omitted from the tools readiness contract by accident

### Phase 1: Converge tools tab contract on the catalog

Goal:

- remove duplicate structural knowledge from the tools tab

Changes:

- derive tools widget preload lists from the canonical artifact catalog plus explicit non-artifact widgets such as `ArtifactPanel`, `ArtifactCanvas`, `ArtifactIcons`, and `FluxToggle`
- keep the canonical artifact catalog as the only owner of artifact widget-type identity

Expected result:

- artifact identity, ordering, and widget contract become structurally aligned

### Phase 2: Unify durable artifact settings ownership

Goal:

- remove split-brain configuration flow

Changes:

- move `nudgeConfig` and `autoPurgeNewSites` reads/writes behind the same effective dashboard settings surface semantics used by protocol-backed settings
- keep direct settings helper functions as internal transport utilities if needed, but stop using them as artifact-tab state ownership seams
- let the tools control plane read effective values from store-backed selectors that honor pending patches

Expected result:

- `Lens`, `Veil`, `Barrier`, `Flare`, and `Echo` all read durable state through one consistent ownership model

### Phase 3: Introduce semantic artifact mutation actions

Goal:

- make family-level intent explicit and atomic

Changes:

- add semantic actions for family-level toggles and grouped edits
- stop implementing parent artifact toggles as imperative chains of child setter calls from schema code
- keep child-level edits available, but route family-level intent through grouped mutation helpers

Expected result:

- one family toggle produces one coherent patch boundary and one predictable pending state

### Phase 4: Harden the runtime-impact contract

Goal:

- make runtime refresh behavior explicit and uniform

Changes:

- define or extend a keyset/rule for artifact-runtime-impacting settings
- ensure `nudgeConfig`, `autoPurgeNewSites`, and `noHistoryForBlocked` are covered when they affect canonical artifact truth
- ensure settings pipeline refresh/broadcast rules update protection runtime snapshots consistently for those keys
- reduce or remove ad hoc artifact-specific refresh dependency lists in the tools control plane where the runtime bridge can already supply truth

Expected result:

- artifact runtime badges and telemetry update because the architecture guarantees it, not because the UI guessed when to refresh

### Phase 5: Optional convergence cleanup for child metadata

Goal:

- reduce hand-authored artifact child wiring duplication

Changes:

- evaluate moving child-definition metadata closer to canonical artifact execution binding or a dedicated child-catalog seam
- keep card-schema code focused on presentation and control composition, not on re-explaining artifact ontology

Expected result:

- `Lens` and `Veil` stop feeling structurally special inside card-schema code

### Phase 6: Cleanup and ratification

Goal:

- make the new structure the default, not a partial migration

Changes:

- remove obsolete duplicate helpers and stale comments
- refresh docs that mention artifact settings ownership or runtime sync
- add regression tests for runtime-impact coverage and semantic mutation grouping

Expected result:

- the artifact tab reads as a single coherent architecture instead of a merge of old filter UI and newer artifact UI

## 7) Definition of done

This hardening work is complete only when all of the following are true.

### 7.1 Canonical contract

- the tools tab preload contract is derived from the canonical artifact catalog
- no canonical artifact widget type can drift out of preload coverage

### 7.2 Ownership

- durable artifact settings read through one effective settings ownership surface
- direct transport helpers are not used as durable state ownership seams inside the tools control plane

### 7.3 Mutation quality

- family-level artifact actions are semantic and grouped
- card schema code does not need to coordinate unrelated persistence writes manually

### 7.4 Runtime coherence

- all artifact-impacting settings participate in one explicit runtime-impact contract
- changing `Flare` or `Echo` settings is no more structurally special than changing `Lens`, `Veil`, or `Barrier`

### 7.5 Theme safety

- theme manifestation remains presentation-only
- every theme satisfies required canonical artifact widget contracts

### 7.6 Regression protection

- tests or CI enforce preload coverage, theme widget coverage, and runtime-impact coverage

## 8) Out of scope

This plan does not require:

- restoring a separate `Filter` top-level tab
- redesigning the protection strategy engine from scratch
- deleting all legacy runtime module names immediately
- replacing theme manifestation storytelling
- full runtime-policy redesign beyond the settings ownership and synchronization seams needed for artifact tab stability

## 9) Recommended implementation order

The recommended patch order is:

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 4
5. Phase 3
6. Phase 5
7. Phase 6

Reason:

- first stop structural drift
- then unify ownership
- then harden runtime truth propagation
- then make semantic mutation APIs sit on top of stable ownership and sync rules
