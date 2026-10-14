# themes

Canonical home for theme core contracts, theme data, plugin implementations, and theme-specific assets.

## Structure

- `core/`: canonical ids, catalog, document side effects, profile, registry, loaders, lightweight surface-descriptor catalog, full plugin catalog, Schedule visual-policy resolver/contract, and named shared seams
- `plugins/`: per-theme plugin homes; each plugin owns `surfaceDescriptor.js` for boot-facing widget/navigation declarations and `manifest.js` for the full theme contract
- `styles/`, `definitions/`: theme assets and declarations

There is no current top-level `shared/` owner. Shared theme UI must enter
through `core/widgets/shared/**` public exits, such as `sites/index.js`,
`filter/index.js`, `preview/Common.jsx`, and `homeBrief/index.js`.

Top-level `base.js` and `utils.js` are narrow current entrypoints. Artifact
identity/color roles use `core/tools/artifactColorSystem.js` directly. New theme
concerns use a named `core/` seam or add one with docs and CI guardrails.
Plugin surface descriptors explicitly declare their tab-icon variant, Main
widget owner, and widget loader paths; canonical manifests consume those same
fields rather than duplicating them. `core/surfaceDescriptor.js` is the narrow
boot/loading lookup and does not expose theme definitions or behavior profiles.
Manifest construction does not fill a missing icon variant with `standard`. Dashboard route
labels/titles/descriptions remain localized app-owned tab data, not a second
theme label catalog. The retired `createThemePack`, `runtime/shared.js`, and
`themes/packs` surfaces must not return.

Plugin custom CSS owns root tokens, shell/plugin selectors, and explicit
`.ui-*` primitives. Feature surfaces own their raw input, button, heading, and
layout geometry; global `[data-theme] input` or `[data-theme] button` skins are
not a shared-theme mechanism.

Schedule keeps recurrence, editing, interaction, accessibility, and persistence
semantics in the dashboard app. Every plugin owns its Schedule `recipes`,
`typography`, `tokens`, and `timeline` declaration as frozen pure data. App
callers resolve that required manifest capability through
`core/scheduleVisualPolicy.js`; they do not import plugin policy files, maintain
an all-theme map, execute plugin callbacks during render, or substitute Zen.

`core/schedule/policyContract.js` is the declaration leaf used by plugins and
owns schema versioning plus exhaustive recipe validation. App consumers use its
public re-exported recipe resolver so a new variant fails until every current
consumer handles it. If a theme eventually requires a different Schedule DOM,
add a separate named surface capability that consumes the app-owned view
model/actions instead of widening the visual policy.

## Read next

1. `src/themes/core`
2. `src/themes/plugins`
3. `docs/system-architecture/03-theme-plugin-and-zen.md`
4. `docs/architecture/repository/theme-engine-boundary-map.md`
5. `docs/architecture/themes/zen/zen-theme-definition.md`
