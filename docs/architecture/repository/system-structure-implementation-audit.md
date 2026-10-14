# System Structure Implementation Audit

- Status: Active
- Owner: repository architecture
- Last validated against code: 2026-07-12
- Path policy: current-only
- Canonical for: current docs-vs-implementation architecture audit, structure findings, and target-structure decision ledger
- Companion to:
  - [repository-structure-review.md](./repository-structure-review.md)
  - [zen-pond-seam-map.md](./zen-pond-seam-map.md)
  - [01-topology.md](../../system-architecture/01-topology.md)
  - [02-runtime-storage-boundaries.md](../../system-architecture/02-runtime-storage-boundaries.md)
  - [03-theme-plugin-and-zen.md](../../system-architecture/03-theme-plugin-and-zen.md)
  - [05-background-runtime-owners.md](../../system-architecture/05-background-runtime-owners.md)

## Purpose

This audit records the current architecture reality and the decision rules for
docs-vs-code mismatches. The goal is not to make implementation obey stale docs
by force. The goal is to preserve the best current structure, then update docs,
code, and guardrails so they point at the same owner map.

## Verification Evidence

Commands run against the current working tree:

- `npm run check:architecture:legacy-free`
- `npm run check:storage:architecture-boundaries`
- `npm run check:theme-public-entry-boundaries`
- `npm run check:docs:paths`
- `npm run check:background-kernel:architecture`
- `npm run check:content-script:ownership`
- `npm run check:content-runtime:bootstrap-contract`
- `npm run check:theme-seam-role-architecture`

All listed checks passed on 2026-04-24.

## Current Source Shape

Current source file distribution:

| Root | Files | Reading |
| --- | ---: | --- |
| `src/themes` | 717 | Largest subsystem; Zen dominates and now has a named pond subsystem. |
| `src/domains` | 398 | Product domain layer is real; `nudge` remains the largest umbrella. |
| `src/apps` | 240 | App shells and background/dashboard/content wiring are active owners. |
| `src/platform` | 103 | Storage, worker, browser, messaging, and security infra are concentrated here. |
| `src/ui-kit` | 31 | Shared UI surface. |
| `src/lib` | 24 | Side-effect-free utility. |
| `src/i18n` | 21 | Locale resources and i18n runtime support. |

Theme plugin distribution:

| Theme plugin | Files |
| --- | ---: |
| `zen` | 519 |
| `matrix` | 22 |
| `cyberpunk` | 19 |
| `entropy` | 18 |
| `clinical` | 12 |
| `scp` | 8 |

## Docs-Vs-Code Decisions

### 1. Root Topology Is Correct And CX Core Is External

`docs/system-architecture/01-topology.md` correctly describes the extension
runtime/product root shape: `apps`, `domains`, `platform`, `themes`, `ui-kit`,
and `lib`.

CX core is owned by the standalone CX project, not by Entropy's `src` tree.
Entropy owns only the declared workspace adapter (`cx.workspace.json` and
`tools/cx/**`) plus workspace-local runtime state under `.cx/**`.

Target decision:

- Keep CX core, CLI, daemon, cockpit, and their tests in the standalone project.
- Keep Entropy-specific domain, harness, and verification declarations in the
  workspace adapter.
- Do not restore CX core under `src` or classify it as an extension app.

### 2. Retired Legacy Roots Are Gone From Tracked Source

The tracked source no longer contains active pre-cutover entry, feature, shared,
old theme-component, old Zen-home, or retired broad theme facade source. The
legacy-free architecture check passes.

If empty retired directories exist in a local working tree, they are not a
canonical implementation owner. If tracked source files reappear under those
roots, the code is wrong, not the topology document.

### 3. Storage Boundary Is An Exact Release V1 Contract

The storage architecture guard passes. Raw IndexedDB and raw Chrome storage
access are closed behind `src/platform/storage/internal/**` and typed public
surfaces.

Runtime language, CLSE, key material, settings, and bootstrap stores accept one
current shape. Missing first-run state uses its named bootstrap seam; malformed,
wrong-contract, or predecessor state fails loudly. Storage-internal code does
not have a separate compatibility budget, read-through key, cleanup write, or
migration bootstrap.

Target decision:

- Feature, app, domain, theme, and storage-internal owners must not read a
  predecessor key or interpret a previous record shape.
- A future public V2 requires a separate architecture decision and explicit
  migration owner; release V1 keeps no dormant migration framework.

### 4. Theme Architecture Is Ahead Of The Older Hotspot Summary

The theme public-entry and theme seam checks pass. Zen has moved beyond the old
"giant widget subtree" state: the pond runtime, renderer, worker bridge, model,
world, storage, tuner, state, and contracts now live under `src/themes/plugins/zen/pond`.

The current correct target is the existing `zen/pond` named subsystem. Do not
move pond logic back under `widgets/signals` merely to match older language in a
review document. The remaining Zen work is second-order:

- keep `widgets/core/hooks` compatibility shims deleted; widget-local hooks may remain only when they own widget behavior
- split large control/render/model files by owner responsibility
- keep `widgets` as UI shell and manifest-facing entry only

### 5. Background And Content Runtime Owners Are Aligned

Background and content guardrails pass:

- `BackgroundAppKernel` remains composition-root focused.
- `ContentScriptOrchestrator` owns `executeScript`.
- content bootstrap keeps the `receiver_ready` / `active` split.

The current better structure is the documented owner split, not a new hub. The
watchpoint is file proliferation in `src/apps/background/services/runtime`: many
small binding files are acceptable while they stay composition-only, but they
should not become hidden domain owners.

### 6. Repository Review Needs Refresh, Not Reversal

`repository-structure-review.md` remains directionally right, but its counts and
some hotspot descriptions are stale against the current tree. The current code
has progressed especially in Zen pond and background/runtime boot ownership.

Correct action:

- refresh the review with current counts and evidence
- keep its staged approach
- do not undo newer named seams simply because an older review still describes
  the pre-move hotspot

## Findings

### P1

No P1 architecture finding was confirmed by the guardrails run in this audit.

### P2

1. Release V1 storage has one exact typed owner per persisted class. Runtime
   language, CLSE, key material, and tracking bootstrap reject malformed present
   state; there is no compatibility budget, upgrade path, or migration bootstrap
   in the product runtime.

### P3

1. Large owner files remain the main structure-pressure signal:
   - `src/apps/dashboard/tabs/experiment/StatsPipelineDiagnosticsLab.jsx`
   - `src/domains/nudge/video-skip/VideoSkipManager.js`
   - `src/themes/plugins/zen/model/sakura/sakuraRenderer.js`
   - `src/domains/nudge/runtime/SentinelProtocolHost.js`
   - `src/apps/dashboard/tabs/experiment/SentinelProtocolLab.jsx`
   - `src/domains/nudge/rendering/NudgeProtocolSceneBackground.js`
   - `src/themes/plugins/zen/model/ZenPotRenderer.js`
2. `src/domains/nudge/runtime/SentinelProtocolHost.js` is the direct canonical
   protocol host and the predecessor `nudgeGame.js` facade is deleted. The
   remaining nudge pressure belongs to the host shell and umbrella owner map.
3. `src/domains/nudge` is still an umbrella bounded context. It needs an owner
   README/public seam map before more subsystem moves.
4. Tracking-side nudge forwarding facades and Zen widget hook forwarding shells
   are retired. New call sites should import the narrow nudge session/terminal
   owner or widget-local hook directly.

## Target Structure

The best current architecture is:

1. Product/runtime code follows the root topology in `01-topology.md`.
2. CX core stays in the standalone CX project; Entropy retains only its
   workspace adapter and workspace-local state.
3. storage has one owner per data class and raw backends stay in platform
   internals.
4. theme implementation lives in `themes/plugins/<themeId>`, with shared theme
   seams only under named `themes/core` exits.
5. Zen large subsystems use named plugin-local seams such as `zen/pond`, not
   widget buckets.
6. background/content app code owns wiring and lifecycle, while domain state and
   product semantics stay in domains/platform.
7. storage/runtime contracts are current-only; external input canonicalization
   remains confined to its explicitly named boundary.

## Recommended Next Moves

1. Keep CX runtime ownership external and keep Entropy's workspace declarations
   aligned with the installed standalone CX contract.
2. Keep `repository-structure-review.md` current as large-file pressure moves.
   The 2026-07-08 refresh records the `nudgeGame.js` facade cutover and the new
   `SentinelProtocolHost.js` hotspot.
3. Add a nudge-domain owner README to classify the nudge umbrella before moving
   more code.
