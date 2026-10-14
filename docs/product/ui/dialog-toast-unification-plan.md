# UI Stability Dialog/Toast Unification Plan

- Status: Draft
- Date: February 23, 2026
- Scope: remove native dialogs, unify confirmation and toast UX, improve accessibility consistency

- Owner: shared UI product
- Last validated against code: 2026-03-16
- Path policy: planning-allowed

## 1) Goal

1. Remove browser-native `alert/confirm` from key UX paths.
2. Standardize confirmation and notification patterns with shared UI components.
3. Improve reliability, accessibility, and i18n consistency.

## 2) Historical Risk Locations (planning snapshot)

1. Dialog-heavy destructive flows were concentrated in Zen main paths:
- `src/themes/plugins/zen/widgets/core/ZenCoreStatusClassic.jsx:844`
- `src/themes/plugins/zen/widgets/core/ZenCoreStatusClassic.jsx:987`
2. Snapshot/report/tuner notification paths were concentrated here:
- `src/themes/plugins/zen/runtime/preview/ZenBonsaiPreviewRuntime.jsx:194`
- `src/themes/plugins/zen/runtime/classic/useZenReportController.js:77`
- `src/themes/plugins/zen/pond/app/ZenKoiTunerPanel.jsx:293`
- `src/themes/plugins/zen/widgets/tools/FurinTuner.jsx:290`
3. The former Tools `HistoryConfirmModal` reference was retired on 2026-07-20:
- contextual dashboard actions now use `src/apps/dashboard/components/InlineActionReviewSurface.jsx`
- dialog primitives remain appropriate only when the action has no stable owning panel

## 3) In Scope

1. Replace native dialogs in Zen/Tools critical paths.
2. Introduce shared confirm and toast primitives in `src/ui-kit`.
3. Migrate message strings to locale keys.
4. Add guard check to prevent reintroduction of native dialogs.

## 4) Out of Scope

1. Full dashboard visual redesign.
2. Product behavior changes beyond dialog/notification mechanism.
3. New feature development unrelated to interaction stability.

## 5) Delivery Plan (PR Units)

### UI-01: Shared primitives

1. Add shared confirm dialog API/component.
2. Add shared toast API/component with queue and dedupe rules.
3. Provide consistent style tokens and minimal docs.

Done when:

1. Shared components are consumable from Zen and dashboard paths.

### UI-02: Zen destructive confirmation migration

1. Replace `window.confirm` in Zen main destructive actions.
2. Ensure async control flow (`await confirm`) with explicit cancel branch.

Done when:

1. Destructive actions no longer use native confirm.

### UI-03: Zen alerts to toast migration

1. Replace `window.alert` and bare `alert()` in Zen preview/report/tuner paths.
2. Map success/error/info messages to unified toast variants.

Done when:

1. No native alert remains in scoped paths.

### UI-04: Accessibility and keyboard behavior

1. Ensure dialog semantics (`role="dialog"`, `aria-modal`).
2. Add focus trap, escape close, and restore-focus behavior.
3. Ensure toasts are screen-reader friendly (`aria-live`).

Done when:

1. Keyboard-only flows are complete and predictable.

### UI-05: CI and test guard

1. Add static check: fail build on `window.alert`, `window.confirm`, or bare `alert(` in scoped runtime paths.
2. Add component/integration tests for confirm and toast behavior.

Done when:

1. Guard check is part of quality gate.
2. Tests cover confirm cancel/approve and toast visibility lifecycle.

## 6) Validation Checklist

1. `npm run build` passes.
2. `npm run test` passes.
3. `npm run gate:ci` passes.
4. Native dialog search in scoped paths returns zero matches.
5. i18n keys exist for all migrated messages.

## 7) Risks and Mitigations

1. Async confirm migration can alter control flow.
- Mitigation: add explicit branch tests and migration in small PR units.
2. Excess toast noise can reduce usability.
- Mitigation: apply dedupe/cooldown policy and severity prioritization.

## 8) Timeline

1. Week 1: UI-01, UI-02
2. Week 2: UI-03, UI-04, UI-05

## 9) Definition of Done

1. No native alert/confirm in scoped runtime paths.
2. Shared confirm/toast pattern adopted in target flows.
3. Accessibility and i18n are validated.
4. CI guard prevents regression.
