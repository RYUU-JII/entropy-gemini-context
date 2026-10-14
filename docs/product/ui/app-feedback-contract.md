# App Feedback Contract

- Status: Active
- Date: October 9, 2026
- Scope: in-app feedback classification, shared overlay feedback, inline status boundaries
- Owner: shared UI product
- Last validated against code: 2026-10-09
- Path policy: current-only
- Canonical for: app feedback surface classification, global overlay provider contract, and inline/dialog feedback boundaries

## 1) Purpose

Entropy feedback must be predictable across surfaces without turning every local UI state into a floating notification. The shared feedback module owns app-level overlay feedback. Feature surfaces own local, contextual feedback.

## 2) Canonical Entry Points

1. Overlay feedback policy: `src/ui-kit/feedback/appFeedbackPolicy.js`
2. Overlay provider and hook: `src/ui-kit/feedback/AppFeedbackProvider.jsx`
3. Compatibility toast exports: `src/ui-kit/ToastProvider.jsx`
4. Dashboard settings bridge: `src/apps/dashboard/components/SettingsCommandFeedbackBridge.jsx`

New code should prefer `useAppFeedback().emit({ kind, payload })` for app-level feedback. Existing `useToast()` calls remain supported for incremental migration.

## 3) Surface Classification

Use global overlay feedback for completed app-level outcomes:

1. Copy/export or other explicit app-level actions without an owning local result surface.
2. Runtime notices where the user needs awareness but no immediate choice.

Use inline feedback for contextual state:

1. Form validation errors.
2. Permission prompts, missing capability guidance, and section-specific status text.
3. Saving, retrying, loading, and dirty state that explains the current panel.
4. Settings command save failures and propagation recovery, beside the affected setting or in the dashboard command-recovery region.
5. Sites registration, policy moves, cap edits, recording changes and release results, in their initiating form, policy row or workspace status region.

Use explicit review for consequential choices:

1. Destructive actions must explain their impact and require a deliberate commit.
2. Security-sensitive actions must retain the owning authentication and admission checks.
3. The review may be inline in the initiating section. A dialog is reserved for an owning flow that requires a blocking surface; destructive or security-sensitive intent alone does not require a modal.

`confirm.destructive_action` remains classified as `dialog` for callers explicitly choosing that shared category. Feature-owned inline reviews do not emit it or route through the overlay provider.

Do not emit a global overlay for a form error or a panel-only warning. Add or update inline UI in the owning component instead.

## 4) Settings Feedback Rule

The settings command bus remains the source of sync state. A successful settings command is quiet: its acknowledged value is the result, and `settings.command.synced` has surface `none`. Save failures, propagation failures and retry progress have surface `inline`.

`SettingsCommandFeedbackBridge` renders unresolved command operations in a normal-flow dashboard recovery region. It preserves the command identity, distinguishes save failure from propagation failure and offers propagation retry only for the latter. It does not emit a saved or failed toast. Feature editors may also retain their own failed draft and local recovery action.

Sites follows the same local-result principle without global toasts. A form stays open on failure, committed policy remains visible until its canonical ACK, and release grace/cancellation or recording undo remains beside the selected policy. Neither opening a review nor showing a preview is a completed outcome.

## 5) Policy Evolution

When a new feedback kind is needed, add it to `APP_FEEDBACK_KINDS` and define its surface in `EVENT_POLICY`. Unknown kinds intentionally throw so accidental, unclassified global messages do not become silent UI drift.
