# Artifact Tab Canonical Protocol

- Status: Active
- Date: 2026-04-19
- Scope: Dashboard artifact tab state, semantic handler, and panel-shell boundary contract
- Depends on:
  - `docs/product/dashboard/artifact-protocol-runtime-contract.md`
  - `docs/product/dashboard/artifact-tab-hardening-plan.md`
- Owner: dashboard architecture
- Last validated against code: 2026-10-14
- Path policy: current-only
- Canonical for: artifact tab dashboard-boundary protocol shape, disclosure snapshot consumption, family action semantics, handler mirroring rule, theme panel dock contract

## 1) One-line definition

The artifact tab consumes one background-owned disclosure snapshot plus one
object-keyed canonical family protocol and renders the disclosed subset through
theme-safe panel shells.

At the dashboard boundary, artifacts are plain serializable objects plus semantic handlers.

They are not classes, and they are not index-addressed arrays.

## 2) Final dashboard-boundary shape

The artifact tab works with two parallel trees:

- `artifactFamilies`
- `artifactFamilyHandlers`

They must mirror each other by family and child key.

The gallery also requires `artifactDisclosureSnapshot`. It is a query DTO, not
a third mutable family tree; it decides which family cards are present and in
what order.

```js
{
  artifactFamilies: {
    lens: {
      enabled: false,
      fullscreenVisualRelaxation: { controlMode: "binary", enabled: true, eligible: false, hidden: false },
      children: {
        blur: { controlMode: "range", enabled: false, value: 50, min: 0, max: 100 },
        grayscale: { controlMode: "range", enabled: false, value: 50, min: 0, max: 100 },
        brightness: { controlMode: "range", enabled: false, value: 50, min: 0, max: 100 },
        contrast: { controlMode: "range", enabled: false, value: 50, min: 0, max: 100 },
        saturation: { controlMode: "range", enabled: false, value: 50, min: 0, max: 100 }
      }
    },
    veil: {
      enabled: false,
      children: {
        socialMetrics: { controlMode: "choice", enabled: false, value: "reactions" },
        timeSignals: { controlMode: "binary", enabled: false },
        shortformBlock: { controlMode: "binary", enabled: false }
      }
    },
    brake: {
      enabled: false,
      children: {
        clickPause: { controlMode: "binary", enabled: false },
        scrollFriction: { controlMode: "binary", enabled: false },
        inputVisualBrake: { controlMode: "binary", enabled: false },
        skipFriction: { controlMode: "binary", enabled: false }
      }
    },
    barrier: {
      enabled: false,
      tabManagement: { groupProtectedTabs: false }, // browser presentation, not an intervention child
      children: {
        intentThreshold: { controlMode: "choice", enabled: false, value: "standard" },
        textRhythm: { controlMode: "binary", enabled: false },
        detourSpreadGuard: { controlMode: "choice", enabled: false, value: 1 }
      }
    },
    flare: {
      enabled: false,
      children: {
        sentinelFlare: {
          controlMode: "binary",
          enabled: false
        }
      }
    },
    echo: {
      enabled: false,
      children: {
        historyCleanup: { controlMode: "binary", enabled: false },
        bookmarkConceal: { controlMode: "binary", enabled: false },
        tabEvaporation: { controlMode: "choice", enabled: false, value: 5 }
      }
    },
    gate: {
      enabled: false,
      children: {
        entryCheckpoint: { controlMode: "binary", enabled: false },
        returnGuard: { controlMode: "binary", enabled: false }
      }
    }
  },
  artifactFamilyHandlers: {
    lens: {
      commitConfig(config) {},
      applyRecommendation(recommendationId) {},
      setSuspended(next) {},
      fullscreenVisualRelaxation: { toggle(next) {} },
      children: {
        blur: { toggle(next) {}, setValue(strength) {} },
        grayscale: { toggle(next) {}, setValue(strength) {} },
        brightness: { toggle(next) {}, setValue(strength) {} },
        contrast: { toggle(next) {}, setValue(strength) {} },
        saturation: { toggle(next) {}, setValue(strength) {} }
      }
    },
    veil: {
      commitConfig(config) {},
      applyRecommendation(recommendationId) {},
      setSuspended(next) {},
      children: {
        socialMetrics: {
          toggle(next) {},
          setValue(scope) {}
        },
        timeSignals: { toggle(next) {} },
        shortformBlock: { toggle(next) {} }
      }
    },
    brake: {
      commitConfig(config) {},
      applyRecommendation(recommendationId) {},
      setSuspended(next) {},
      children: {
        clickPause: { toggle(next) {} },
        scrollFriction: { toggle(next) {} },
        inputVisualBrake: { toggle(next) {} },
        skipFriction: { toggle(next) {} }
      }
    },
    barrier: {
      commitConfig(config) {},
      applyRecommendation(recommendationId) {},
      setSuspended(next) {},
      tabManagement: { toggle(next) {} },
      children: {
        intentThreshold: { toggle(next) {}, setValue(interval) {} },
        textRhythm: { toggle(next) {} },
        detourSpreadGuard: { toggle(next) {}, setValue(maxProtectedTabs) {} }
      }
    },
    flare: {
      commitConfig(config) {},
      applyRecommendation(recommendationId) {},
      setSuspended(next) {},
      children: {
        sentinelFlare: {
          toggle(next) {}
        }
      }
    },
    echo: {
      commitConfig(config) {},
      applyRecommendation(recommendationId) {},
      setSuspended(next) {},
      children: {
        historyCleanup: { toggleHistoryCleanup(next) {} },
        bookmarkConceal: { toggleBookmarkConceal(next) {} },
        tabEvaporation: { toggle(next) {}, setValue(timeoutMinutes) {} }
      }
    },
    gate: {
      commitConfig(config) {},
      applyRecommendation(recommendationId) {},
      setSuspended(next) {},
      children: {
        entryCheckpoint: { toggle(next) {} },
        returnGuard: { toggle(next) {} }
      }
    }
  }
}
```

The row presentation supports five declared input modes: `binary`, `choice`,
`level`, `number`, and `range`. The family DTO and its semantic handler remain
the source of each row's meaning; a row can project a choice-shaped numeric
family value as a `number` input without changing that family contract.

- Lens exposes five independent `range` children with ON/OFF and integer 0–100 strengths.
- Binary children include Text Rhythm, input visual brake, time signals, scroll friction, entry/return guards, shortform blocking, and skip friction. Skip friction uses the canonical hard-block policy.
- Choice children include social-metric scope, the periodic consumption interval, Echo's idle-tab timeout, and the protected-tab maximum. The maximum uses a `number` row for direct 1–20 editing.
- `level` remains available for an explicitly declared ordered discrete value; it is not a compatibility field on current binary, choice, or range settings.

The visual profile owner compiles Lens strengths for the runtime-only adaptive
bands `relaxed`, `normal`, and `reinforced`. Incompatible pre-release data
rejects without rewriting or wiping. UI, settings
reads and cache hydration never infer or convert an older shape; the explicit
reset owner is documented in
`docs/architecture/runtime/friction-filter-injection-architecture.md` §3.6.

Lens exposes `fullscreenVisualRelaxation` as an always-visible auxiliary
preference outside `children`. Its state and handler mirror each other at the
family level. New settings default ON; current reads preserve an explicit stored
choice. Eligibility means at least one Lens visual effect is enabled, not that Video
Skip is enabled. The toggle remains editable while ineligible and cannot enable
any effect or make an otherwise empty Lens family active. Video fullscreen
projects the compiled visual policy once: ordinary profiles step down, scheduled
relaxation suspends the visual filters, and exhausted site/global targets block
the benefit. Saved effect switches remain unchanged.

Lens presents saturation, brightness and blur as its primary effect rows,
then contrast and grayscale inside an app-owned disclosure group. All five
remain canonical release children with independent commands and strengths;
the group changes presentation only and adds no settings or progression state.
Grayscale keeps the existing page-wide
`saturation` feature binding; the saturation child binds `colorSaturation`
for media-only `saturate()`. Blur, brightness, contrast and saturation share
media targeting but do not imply one another. New settings and explicit
recommendations enable media saturation and brightness, with blur, contrast and
grayscale OFF. Existing configured values are preserved;
users can compare individual effects and combinations without changing another
effect. Editing a Lens strength while OFF preserves OFF. All children share the
existing Lens disclosure stage.

The enabled grayscale follows the late `text` slot in Lens curve mode; fixed
mode applies the configured strength immediately. OFF never becomes ON through
the curve. Brightness, contrast and media saturation retain `tint`, and blur
retains `blur`. These runtime bindings belong to the canonical curve owner,
not to the control group's collapsed/open state.

Family `commitConfig` commands follow the same rule. A supplied child object
must contain exactly the fields declared by its family command schema:
`{ enabled }` for binary and the optional `fullscreenVisualRelaxation` preference,
`{ enabled, strength }` for Lens strengths, `{ enabled, scope }` for social scope,
`{ enabled, interval }` for periodic consumption, and
`{ enabled, maxProtectedTabs }` for detour spread. Echo keeps its existing flat
destructive-workflow command schema. Unknown children, missing
fields, and compatibility fields fail before any settings owner is mutated.

Non-family artifact tab state may exist beside this tree only for cross-family UI coordination such as:

- `showExperimental`
- `spawnTargetTabId`
- `spawnTargetTabs`
- `flareStatusNotice`
- `echoWorkflowState`
- `debugConfig`

## 3) Invariants

### 3.1 Object-keyed, not array-indexed

Family identity and child identity are semantic, not positional.

Use stable object keys:

- `lens`
- `veil`
- `brake`
- `barrier`
- `flare`
- `echo`
- `gate`

and stable child keys such as:

- `blur`
- `socialMetrics`
- `intentThreshold`
- `shortformBlock`
- `scrollFriction`
- `tabEvaporation`
- `skipFriction`
- `sentinelFlare`
- `historyCleanup`
- `bookmarkConceal`
- `entryCheckpoint`
- `returnGuard`
- `detourSpreadGuard`

Do not model these as `[{ id, ... }]` arrays unless a UI-specific projection explicitly needs ordering.

Release membership belongs to the protection catalog. The displayed disclosure
order belongs to the progression disclosure snapshot, not to this object-keyed
protocol shape or the theme manifestation catalog.

### 3.2 Plain data, not classes

At the dashboard boundary, artifact state must remain plain serializable data.

Do not introduce custom classes for:

- family state
- child state
- handler containers
- runtime snapshot wrappers

Reason:

- plain objects serialize cleanly through stores and tests
- plain objects work well with React/Zustand selector patterns
- class instances add prototype semantics without buying meaningful domain clarity here
- class-based shapes make fixtures, equality, and command-bus synchronization harder

### 3.3 Handler tree mirrors state tree

The handler tree should follow the same path shape as the state tree.

Examples:

- `artifactFamilies.lens.children.blur`
- `artifactFamilyHandlers.lens.children.blur`
- `artifactFamilies.echo.children.historyCleanup`
- `artifactFamilyHandlers.echo.children.historyCleanup`

Card schema code must not reconstruct semantic ownership from unrelated low-level setters.

### 3.4 Family-level meaning stays semantic

Family state has four distinct projections:

- `configuredEnabled`: at least one child stores active user intent
- `suspended`: this family is temporarily suppressed
- `globallyPaused`: the protection-wide pause is suppressing families
- `enabled`: effective configured state after family/global suppression

The family action derives from those projections:

- unconfigured -> `applyRecommendation("gentle_start_v1")`
- configured and effective -> `setSuspended(true)`
- configured and suspended -> `setSuspended(false)`

`commitConfig` is the family-specific configuration owner used by the explicit
recommendation command. It is not a generic family toggle. Resume must never
call `commitConfig`, reapply a recommendation, or rewrite child settings.

Echo's recommendation must leave `historyCleanup` disabled because that action
is destructive and owns a separate confirmation/auth workflow.

### 3.5 Runtime telemetry is derived, not merged back into durable family truth

Runtime child state is derived from runtime snapshot seams and may be projected into card state for display.

Examples:

- `lensRuntimeChildren`
- `flareRuntimeChildren`
- `echoRuntimeChildren`
- `gateRuntimeChildren`

These are display/runtime overlays.

They must not become the durable source of truth for artifact configuration.

### 3.6 Disclosure is a background query, not dashboard inference

The ordinary Tools surface consumes the snapshot returned by
`GET_ARTIFACT_DISCLOSURE_SNAPSHOT`. Its `orderedFamilyIds` owns card order and
its `entriesByFamilyId[familyId].disclosed` field owns inclusion.

The release order is exactly:

```text
lens -> brake -> gate -> flare -> barrier -> echo -> veil
```

The dashboard must not import `ProgressionRepository`, run the adaptive
experiment planner, inspect configured children, or inspect runtime telemetry
to grant/reorder family access. Loading or contract failure is a visible error,
not permission to reveal all cards. Navigation-cue seen ids are UI-only and
cannot grant disclosure.

One family disclosure grants every child declared by
`artifactFamilyCatalog.releaseChildren`. Child controls do not carry separate
progression levels.

Dreamscape Furin's public child set is exactly the binary `sentinelFlare`
ON/OFF control. Global-cap and site-cap progress remain runtime feedback; the
card must not expose a private minute threshold or preset list. Warning-koi
presage remains an internal, always-on, one-shot episode step; there is no
public `presage`, `repeatPresage`, recurrence, or follow-up control.

#### 3.6.1 `build:dev` may project disclosure for the gallery only

The Tools tab may expose a development-only rail that replays the canonical
`orderedFamilyIds` as zero, previous, next, all, or timed prefix stages. This is
an in-memory presentation projection, not a second disclosure owner.

The canonical snapshot remains the source for boot success, progression,
runtime eligibility, configuration eligibility, and Sidebar navigation cues.
The projected snapshot is passed only to Tools card assembly and gallery
navigation. It may replace presentation fields (`disclosed`, `visible`,
`next`, `disclosedFamilyIds`, `nextFamilyId`) while preserving canonical
`configurable` and `runtimeEligible` values.

The development rail must never:

- write progression or storage state
- send a background/settings command
- synthesize qualified activity days or disclosure timestamps
- mark navigation cues seen
- appear in a public bundle

Vite selects the development implementation through the debug-tools release
capability and selects an identity/no-op module for public builds. The public
debug-surface check owns the bundle-absence guard. Controls inside a projected
artifact card still use their normal settings handlers; the rail must label
that those settings writes are real even though disclosure is simulated.

### 3.7 Theme panels are presentation-only shells

Theme-specific panels may style:

- header rendering
- typography
- container chrome
- dock visuals

They must not redefine:

- family ids
- child ids
- settings semantics
- runtime meaning

The shared panel contract is:

1. header
2. summary/body
3. control dock

The control dock owns:

- primary control label
- family recommendation/pause/resume action slot
- child control tray
- advanced disclosure

The default presentation is implemented through
`src/themes/core/tools/ArtifactControlDock.jsx`. Zen projects the same declared
control-row models through `ZenArtifactControlGarden` in
`ZenArtifactSwitchBand.jsx`. Every row has a stable semantic `childKey`, its
declared `controlProps`, and an app-injected `Control` renderer owned by
`ArtifactControlRowInput.jsx`. The theme places `<Control>` and supplies world
verbs; it does not import dashboard inputs or implement their settings commands.
All five input modes follow this same path. The primary `enabled`/`onToggle`
contract and declared `value`/`options`/`min`/`max`/`onValueChange` detail contract
remain intact. Choice feedback describes selected meaning; ranges describe the
declared strength. Neither is inferred from visual arrangement.

A rows block may declare `disclosure: { id, label, Control }`. The shared app
builder injects `ArtifactControlGroupDisclosure`; both the default dock and Zen
place that same owner around their own row rendering. Native `<details>` keeps
children mounted and reports their configured active count. The canonical
family's `releaseChildGroups` partitions all release children exactly once;
group identity and open state never become another feature catalog or setting.
Collapsing cancels uncommitted numeric drafts before focus/blur can commit them,
while pending canonical commands keep their acknowledgement owner.

### 3.8 The Tools workspace uses a portal-and-rail shell

The artifact gallery macro layout is owned by
`src/apps/dashboard/tabs/tools/components/ArtifactGalleryView.jsx` together with
`artifactWorkspace.css`, and has three ordered regions:

1. a narrow threshold seam after the global dashboard sidebar
2. a full-bleed artifact aperture that owns the scene and gallery navigation
3. a full-height, tab-scoped control rail that owns the active theme panel

The global dashboard sidebar remains the higher, persistent navigation layer.
The control rail may share its material language, but it is one semantic tier
lower because it belongs only to the selected artifact workspace. The artifact
aperture is the recessed world layer between them.

In landscape those regions form the threshold/aperture/right-rail composition.
In portrait the same owner stacks the aperture above the control rail and
collapses the sidebar threshold, without changing panel or artifact semantics.

The macro shell must not be rebuilt as an inset control card over a generic
content panel. External gallery padding, floating-panel margins, and rounded
outer card chrome do not own artifact meaning and must not reduce the aperture
or rail into nested cards. Theme panels may still own their internal padding,
typography, material treatment, and dock visuals.

The Zen control rail has two presentation regions: artifact identity and the
scrollable control garden. The artifact name has the largest type, generous top
space, and one quiet inscription below it. Small screens may wrap the inscription;
copy must not be clipped to enforce a literal one-line layout.

The control garden renders one accordion row for every declared child and
auxiliary control. A collapsed summary contains its name, a small filled/empty
ink dot, and a short value when relevant. It does not expose a switch. Clicking
the summary opens that row's description and app-owned input together; opening
another row closes the previous one. Stable `childKey` identity owns expansion
and React keys; display order and labels are not identities.
Summary buttons expose `aria-expanded` and `aria-controls`, details have labelled
regions, and Escape closes a detail and restores focus to its summary.

The expanded input offers a world verb such as binding or releasing. Binary
inputs expose that one action. Choice and level inputs add declared radio
options with arrow/Home/End navigation. Number inputs keep their canonical
bounds; range inputs use their native slider semantics and integer step. Range
support does not turn semantic choices or discrete levels into continuous
strengths. Every input still calls its declared `onToggle` or `onValueChange`;
the family handler owns any setting effect of that call. OFF preserves the
remembered value, and Lens strength editing cannot turn an OFF effect ON.

`useArtifactControlCommit()` owns only immediate pending intent and explicit
mutation errors. Pending or error feedback remains visible in the detail, and
an error opens its row. Settled values come from the controlled row projection.
Permissions, Furin prerequisites, and Echo's review/auth/backup/destructive
workflow remain explicit app-owned controls. Supplemental actions and status
blocks stay after the rows; they are not recast as feature values.

Collapsed ink and short values follow the row's canonical controlled props.
Opening a row changes only local disclosure state and never changes settings,
runtime activity, or animation eligibility. Child rows have no business ordinals.

Gallery navigation consumes the theme profile's declared variant. Zen uses a
walked path: two edge thresholds step to the previous or next disclosed family,
wrapping at both ends. Keyboard, wheel and swipe use that same step owner;
locked families are skipped. There is no visible position index or reserved
lower band. The selected panel owns the visible artifact name, while the path's
polite live region announces the artifact and position. Read-only DOM metadata
exposes inventory and selection to the existing QA readers. Other declared
quickbar variants keep their normal-flow navigation beneath the aperture.

Direct selection is requested before it is committed. The gallery must retain
the current artifact and panel until the target theme widget has a successful
preload acknowledgement and canonical ready state. A cold or failed target may
mark only its horizon slot pending/error with retry; it must not suspend or
replace the whole artifact workspace.

### 3.9 Feed Horizon and the consumption boundary form one Barrier episode

`barrier.children.intentThreshold` is the single dashboard control for the
periodic consumption boundary. The stable runtime key remains `ensoGate`.
When feed exploration crosses the runtime attention threshold, Feed Horizon
first lets supply run dry; renewed demand opens the same consumption boundary.
This prelude and boundary form one episode. Slide the central boundary left
to end the visit or right to continue, then release. Both directions require
the same travel and minimum duration; arrow keys provide the equivalent choice.

The dashboard protocol must not expose a parallel `feedHorizon`, `scrollFlow`,
or `infiniteScrollGuard` child. Those names do not belong in card rows, family
action mapping, disclosure signals, or progression features. Barrier owns
`textRhythm`, `intentThreshold`, and `detourSpreadGuard`; its suspension includes
the whole feed episode. Veil owns `shortformBlock`, and Brake owns `skipFriction`.

Its independent `tabManagement` presentation control groups protected tabs on
first entry with optional Chrome permission. It is outside the intervention
child catalog and adds no runtime intervention status. Detour's UI uses a
numeric `number` row (1–20, default 1), backed by the existing choice-shaped
family value and Gate count contract. Numeric editing preserves the review
switch, and the recommended configuration retains a keep target of 3.

## 4) Why this is better than classes or double arrays

### 4.1 Better than classes

This protocol is primarily:

- store-facing
- test-facing
- serialization-friendly
- UI composition-friendly

That makes plain objects the right fit.

Classes would introduce lifecycle and identity concerns without reducing actual complexity.

### 4.2 Better than double arrays

A double-array shape such as:

```js
[
  ["lens", [/* children */]],
  ["veil", [/* children */]]
]
```

would make the protocol harder to read, easier to misuse, and more fragile under refactors.

The artifact tab needs:

- direct keyed lookup
- semantic references in tests
- stable path-based contracts
- clear handler mirroring

Objects do that better than arrays here.

## 5) Current fit assessment

This protocol is not mathematically perfect, but it is the best current fit for the project.

It is:

- explicit
- testable
- drift-resistant
- compatible with protocol-store ownership
- theme-safe

Current code already follows this model in:

- `src/apps/dashboard/hooks/artifactSettings/useArtifactSettingsCommands.js`
- `src/apps/dashboard/hooks/useProtectionEchoArtifactControl.js`
- `src/apps/dashboard/hooks/useProtectionArtifactsControlPlane.js`
- `src/domains/protection/catalog/artifactFamilyCatalog.js`
- `src/domains/protection/catalog/artifactRecommendationCatalog.js`
- `src/apps/dashboard/artifacts/artifactDisclosureClient.js`
- `src/apps/dashboard/tabs/tools/buildToolsArtifacts.jsx`
- `src/apps/dashboard/tabs/tools/artifactCardSchemas.jsx`
- `src/themes/core/tools/ArtifactControlDock.jsx`

## 6) Continuing hardening rules

The following refinements must preserve the current owner split.

### 6.1 Extend descriptors without creating another catalog

`artifactFamilyCatalog.js` already owns canonical family identity and release
children. `src/themes/core/tools/artifacts.js` owns manifestation/widget
metadata, while `artifactCardSchemas.jsx` and per-family builders own dashboard
assembly. Runtime-derived state and visual-state builders are separated into:

- `src/apps/dashboard/tabs/tools/artifactCards/derivedState.js`
- `src/apps/dashboard/tabs/tools/artifactCards/visualStates.js`

If more static presentation metadata is needed, extend the narrow owning
descriptor instead of creating another family/order list. Candidate fields
include:

- child ordering
- control row kinds
- copy keys
- which children have stepped levels, binary toggles, or semantic choices
- which children expose advanced controls

Such metadata must not duplicate release membership, disclosure order,
recommendation values, or runtime bindings.

### 6.2 Maintain protocol-shape contract coverage

Contract coverage must continue to assert:

- every canonical family has exact release-child/card/theme/runtime coverage;
- every disclosed family exposes `setSuspended` and `applyRecommendation`; and
- Furin exposes only `sentinelFlare` as a public child.

Update the owning guard/test with intentional catalog changes rather than
weakening exact coverage.

### 6.3 Consider lightweight schema validation

If the family protocol grows, a lightweight runtime validator or narrow JSDoc typedef layer may help.

Do this only as a thin contract aid.

Do not convert the boundary into class instances.

### 6.4 Keep debug controls outside the canonical family core

`flare` currently carries production family state plus debug support living beside it in tab state.

That is acceptable, but debug controls should remain clearly secondary and never become part of the family durability contract.

## 7) Anti-patterns

The following should be treated as regressions.

- reintroducing flat duplicate fields such as `lensEnabled` beside `artifactFamilies.lens.enabled`
- cards manually composing family intent from unrelated top-level setters
- dashboard code deriving disclosure from configuration, telemetry, or a local planner
- family pause/resume implemented by rewriting child configuration
- resume reapplying a recommendation
- theme panels importing dashboard-private owners
- adding class instances as dashboard-boundary protocol values
- converting family state to order-dependent arrays
- mixing runtime telemetry back into durable settings truth


## Artifact realignment — 2026-10-09

Current ownership supersedes previous family examples: Veil owns socialMetrics, timeSignals and shortformBlock; Brake owns clickPause, scrollFriction, inputVisualBrake and skipFriction; Barrier owns textRhythm, intentThreshold and detourSpreadGuard, plus the existing auxiliary tabManagement preference. The canonical catalog and runtime binding apply this ownership to disclosure, family pause, configuration, execution and telemetry. Feed Horizon and the cadence remain one Barrier episode; no parallel actuator is added.

Lens release children expose independent ON/OFF plus integer 0–100 strengths. Persisted visual filter values are numeric strengths, and the visual profile owner compiles strength/effectiveStrength and physical CSS for the current adaptive band. Present boolean visual settings are incompatible pre-release data and reject without rewriting or wiping. The 101 quantized grayscale prepaint assets match the exact compiled strength; only admitted host tiers are registered.

The periodic boundary uses a single horizontal gesture: drag from the center left to finish, right to continue; at least 420 ms and the declared travel distance are required, and release confirms. Keyboard arrow hold/release is equivalent. Partial strokes retry without retained ink; cancel is neutral and cannot replay or navigate. Existing admission, cadence, feed endpoint, replay and tab-closure authorities remain mandatory. The Zen skip attempt is represented by a Tome Ishi stone resistance pulse inside the video boundary, with reduced motion honored.
