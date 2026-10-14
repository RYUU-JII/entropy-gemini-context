# Protection Tab PRD

- Status: Active
- Date: 2026-03-07
- Scope: Dashboard Protection tab IA, preview behavior, and control surface
- Depends on:

- Owner: dashboard product
- Last validated against code: 2026-03-16
- Path policy: planning-allowed
- Canonical for: protection tab product contract

  - `docs/product/dashboard/basic-mode-automatic-protection-prd.md`
  - `docs/product/dashboard/pro-mode-policy-studio-prd.md`
  - `docs/product/dashboard/information-architecture-basic-pro-tabs-prd.md`
  - `docs/product/dashboard/basic-strategy-orchestrator-prd.md`
- Non-goal:
  - protection engine contract redesign
  - raw experimental effect removal
  - Garden/Overview redesign

## 1) One-line definition

`Protection is the place where users see how automatic protection behaves, lightly tune its posture, allow artifacts, and preview how interventions land on real content.`

Implementation note:

- canonical artifact family ownership no longer lives in this document alone
- final artifact taxonomy and runtime ownership must follow:
  - `docs/product/dashboard/artifact-protocol-runtime-contract.md`
  - `docs/product/dashboard/artifact-tab-hardening-plan.md`
  - `docs/product/dashboard/artifact-tab-canonical-protocol.md`
- references below to specific intervention examples are illustrative unless they match the canonical artifact family model

## 2) Why this tab exists

Protection must answer a different question than Sites or Overview.

- `Overview` answers: `Is this working?`
- `Sites` answers: `What should I protect and for how long?`
- `Protection` answers: `How is protection behaving, and what will it do when pressure rises?`

This means the tab should not be a raw filter editor anymore.
It should be a live-facing control surface with a mockup preview at the center.

## 3) Core product principles

### 3.1 Keep the mockup

The preview is not decoration.
It proves how protection changes the page and gives the tab legitimacy.
It should stay.

### 3.2 Use user language, not implementation language

The top-level experience should say:

- protection degree
- current state
- allowed artifacts
- preview scenario

Not:

- blur / text opacity / contrast first
- filter categories first
- raw steps first

### 3.3 Preserve extension room

Protection is a good home for:

- theme signatures
- artifact overlays
- subtle Easter eggs
- state-reactive scene changes

Those additions should enrich comprehension, not become a toy loop.

### 3.4 Keep raw tuning, but below the fold

The existing filter editor should not be deleted.
It should move into an `Advanced Tuning` section inside Protection.

## 4) Final tab structure

```text
Protection
├─ Header
│  ├─ Current status badge
│  ├─ Current preset / posture summary
│  └─ Short explanation
├─ Main split
│  ├─ Left: Live mockup preview
│  │  ├─ Platform selector
│  │  ├─ Scenario selector
│  │  └─ Theme-specific ambient response
│  └─ Right: Protection control rail
│     ├─ Automatic Protection
│     ├─ Protection Now
│     ├─ Allowed Artifacts
│     ├─ What Changes
│     └─ Advanced Tuning
└─ Optional future layer
   └─ Scene signatures / hidden interactions
```

## 5) Left panel: Live preview

The left panel keeps the existing preview shell.

Includes:

- browser/platform switch
- live mockup
- current theme rendering

### 5.1 Scenario preview

The preview should support four scenario states:

- `Live`
- `Near target`
- `Over target`
- `Maximum configured pressure`

Purpose:

- `Live`: show the currently configured protection as-is
- `Near target`: show what subtle tightening looks like
- `Over target`: show a stronger intervention state
- `Maximum configured pressure`: show the highest level of filters the user enabled

Important:

These scenarios are preview states, not direct runtime overrides.
They exist to help users understand escalation.

## 6) Right rail: Information architecture

### 6.1 Automatic Protection

Show:

- `Soft / Balanced / Strict`
- read-only global-limit rule: protection reinforces one step when the cap is exceeded
- one-line explanation that the rule uses hidden reinforcement headroom and never force-enables an inactive filter

This is the main control surface.

### 6.2 Protection Now

Show:

- current live state badge
- currently followed host, if available
- active filters count
- active / standby artifacts
- current runtime state summary

This area should reuse the same language as popup.

Examples:

- `Protected`
- `Near target`
- `Over target`
- `Protection active`

### 6.3 Allowed Artifacts

Show:

- `Lens`
- `Veil`
- `Barrier`
- `Flare`
- `Echo`

Behavior:

- non-destructive artifacts can be toggled directly here
- destructive or high-friction artifacts may route to Labs / detailed management
- each card must say what it does in one sentence
- legacy runtime names such as `loopBreaker`, `timeAnchor`, `sentinelFlare`, and `memoryPurge` remain execution details, not the canonical artifact taxonomy

### 6.4 What Changes

Do not lead with raw filter keys.
Instead group the effects by user-facing purpose.

- `Reduce hooks`
- `Slow the pace`
- `Add reading drag`
- `Advanced effects` (only if active)

This section is interpretive, not exhaustive.

### 6.5 Advanced Tuning

Contains the existing filter editor.

Rules:

- collapsed by default
- preview stays visible while tuning
- the user can still access raw controls when needed

This is where hidden affordances and future advanced interactions can live without polluting the main Protection experience.

## 7) Easter egg / signature strategy

Protection is one of the best places for hidden craftsmanship because it already owns:

- a live scene
- a state machine
- a preview context
- artifact-linked overlays

Recommended signature slots:

- ambient motion shift by scenario
- artifact activation micro-scenes
- theme-specific scanner traces
- time-of-day response
- rare but calm interaction details

Guardrails:

- no slot-machine feel
- no click farming
- no rapid reward loop
- effects must remain slow, sparse, and grounded in protection state

## 8) Basic vs Pro behavior

### Basic

Protection is a trust surface.
It should emphasize:

- degree
- current state
- artifact allowance
- preview explanation

### Pro

Protection is a live-facing runtime shell.
It should keep the same structure, but allow:

- advanced tuning
- preset-aware explanation
- deeper artifact visibility
- future scene signatures and debug-adjacent state views

## 9) Implementation strategy

### Phase 1

- rename Filter tab copy to Protection
- keep left preview
- replace right sidebar with new Protection rail
- move raw filter editor into `Advanced Tuning`

### Phase 2

- connect runtime snapshot more deeply
- add richer artifact state summaries
- refine preview scenarios and lane interpretation

### Phase 3

- add theme signature slots
- add subtle scene-linked Easter eggs
- connect preset/explainability data more tightly

## 10) Success criteria

- users understand what Protection is doing without reading implementation terms
- users can preview escalation before it happens
- raw tuning remains available, but no longer dominates the screen
- the tab feels premium and intentional, not like a debug lab
- theme-specific craft can grow here without hijacking the product flow
