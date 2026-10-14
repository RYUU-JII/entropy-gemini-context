# i18n Robustness Audit

- Status: Active
- Owner: i18n architecture
- Last validated against code: 2026-06-25
- Path policy: planning-allowed
- Canonical for: current-state robustness audit of i18n failure behavior
- Companion map: [i18n-boundary-map.md](/home/ryuji/projects/Entropy/docs/architecture/repository/i18n-boundary-map.md)

## Status
- Active audit note
- Scope: repository-wide i18n runtime and governed UI surfaces
- Audience: feature authors, architecture reviewers, CI authors

## Summary
The current i18n system is structurally strong.

Strengths:
- one React public API: `useAppTranslation`
- one runtime public API: `tRuntime`
- locale JSON remains the copy source of truth
- namespace ownership is guarded by CI
- governed React/runtime surfaces are guarded by CI

Recent hardening completed:
- missing runtime keys now fail loudly with an explicit sentinel
- notification descriptors no longer keep fallback copy beside locale keys
- runtime language persistence and hydration failures now emit diagnosable errors

## Current strength assessment

### Strong
- React entrypoint governance
- runtime entrypoint governance
- locale ownership contracts
- governed-surface hardcoded-string prevention
- source-of-truth enforcement for locale JSON

### Medium-strong
- runtime language persistence and hydration
- runtime missing-key failure visibility

These areas are now diagnosable and explicit, but still depend on platform storage/runtime behavior.

## Explicit failure policy

### Missing translation keys
- Missing runtime keys must return an explicit sentinel label.
- Missing runtime keys must log a diagnosable error.
- Missing runtime keys must not silently degrade to ad hoc English copy, empty strings, or key suffix labels in canonical paths.

### Persistence and hydration
- Runtime language write failures must log an error.
- Runtime language read/hydration failures must log an error.
- Canonical i18n paths must not swallow failures and continue as if nothing happened.

## Allowed degradation seam

### Runtime language source resolution
`tRuntime` may still resolve language from a bounded platform chain:
- explicit runtime language
- document language
- extension UI language
- browser language
- configured fallback language

Why this is still allowed:
- the runtime must be able to choose a language before all surfaces are bootstrapped
- these are platform/environment inputs, not product-copy fallbacks

Guardrail:
- failures while reading the extension UI language must emit a diagnosable error
- this seam must remain narrow and documented

## Retired fallback patterns
- notification descriptor copy fallback fields such as `defaultTitle` / `defaultMessage`
- runtime key fallback to key suffix labels
- silent persistence promise catches in canonical i18n setup
- silent hydration catches in canonical i18n setup

## Residual risk
- React `i18next` still uses configured language fallback behavior at the library layer
- runtime translation still falls back across supported locale resources to the configured fallback language

These are currently acceptable because they remain within the declared locale-resource system rather than code-owned ad hoc copy.

## Enforcement
- `check:i18n:contract`
- `check:i18n:ownership`
- `check:runtime:i18n-boundaries`
- `check:react:i18n-hook-boundaries`
- `check:ui:i18n-hardcoded-strings`
- `check:i18n:no-default-value`
- `check:i18n:robustness`
