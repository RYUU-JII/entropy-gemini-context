# theme plugins

Each canonical theme id owns one plugin home under this directory.

A plugin should contain only theme-owned runtime, widgets, assets, and theme-specific state.

Every canonical plugin owns a lightweight `surfaceDescriptor.js`. It is the
single declaration for widget loader paths, the Main widget owner, and the tab
icon variant used by boot/loading/registry. `manifest.js` consumes those exact
fields and adds the full theme definition, profile, Schedule policy, and boot
capabilities; callers must not duplicate the descriptor into a second map.

Every canonical plugin manifest declares a frozen `scheduleVisualPolicy` from
its sibling `scheduleVisualPolicy.js`. The declaration owns only Schedule
`recipes`, `typography`, `tokens`, texture blend, and `timeline` paint as pure
data for the shared app-owned surface. It does not own recurring-relaxation
meaning, draft/edit behavior, commands, semantic DOM, or accessibility.

Plugin Schedule declarations use `core/schedule/policyContract.js`. App callers
use the strict `core/scheduleVisualPolicy.js` resolver and must not import a
plugin declaration directly. Missing policy is a manifest/runtime contract
failure; there is no Zen/default policy. The factory owns schema versioning, and
recipe consumers must exhaustively handle every declared axis variant.

`theme.js` may paint root tokens, shell/plugin-owned selectors, and explicit
`.ui-*` primitives. It must not target raw headings, inputs, selects, textareas,
or buttons below `[data-theme]`, nor acquire Schedule ownership through
`[data-schedule-*]`; those controls belong to their feature surface.

A genuinely different Schedule DOM is a future separate manifest surface
capability, not a reason to add theme-id branches to the app or semantic logic
to `scheduleVisualPolicy`.

## Current focus

- `zen/` is the most detailed plugin home and its architecture docs live in `docs/architecture/themes/zen/`.
