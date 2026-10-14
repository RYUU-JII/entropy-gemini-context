# Locale Duplication Audit

- Status: Active
- Owner: i18n architecture
- Last validated against code: 2026-06-25
- Path policy: planning-allowed
- Canonical for: current duplication audit and shared-key promotion policy
- Companion map: [i18n-boundary-map.md](/home/ryuji/projects/Entropy/docs/architecture/repository/i18n-boundary-map.md)

## Status
- Active audit note
- Scope: repository-wide locale JSON duplication and shared-key promotion
- Audience: feature authors, copy authors, CI authors

## Purpose
This document records which locale key families have already been promoted into `common`, which duplicate paths were intentionally retired, and how to decide whether a future duplicate should be centralized or kept local.

The goal is not to remove every repeated word in the repository.

The goal is to keep:
- one source of truth for genuinely shared operational copy
- clear ownership for context-specific copy
- a small CI guard that blocks known duplication regressions without creating noisy false positives

## Promotion rule

### Promote into `common` when all of the following are true
- the copy has the same operational meaning across product surfaces
- the preferred wording is the same in every governed locale
- the phrase is not theme-owned or lore-owned
- reusing one key reduces ambiguity more than it reduces context clarity

### Keep local when any of the following are true
- the phrase has surface-specific meaning
- the phrase is theme-toned or presentation-toned
- the copy family is likely to diverge soon
- the same English string hides different product intent

## Current shared operational families

### Dashboard tab names

`dashboard:<tabId>.nav/title/desc` and their theme variants are the only tab-name
copy family. `tabs/registry.js` owns the key mapping; mounted tabs consume the
registry descriptor or the same dashboard namespace for loading/error labels.
The duplicate `main:main.nav/title/desc` and `tools:tools.nav/title/desc` families,
including theme variants, are retired and guarded by the duplication check.
Sites owns the `sites` namespace; `rules` is not a tab or translation alias.

### `common.status.*`
- `common.status.loading`
- `common.status.error`

Use these for tab loading and generic governed error surfaces.

### `common.action.*`
- `common.action.save`
- `common.action.cancel`
- `common.action.confirm`
- `common.action.delete`
- `common.action.edit`
- `common.action.close`

Use these for standard operational buttons and confirmations.

### `common.*`
- `common.prev`
- `common.next`

These remain top-level in `common` because the current contract tooling and existing usage patterns already validate that shape cleanly.

## Recently retired duplicate paths
- `filter.common.loading`
- `filter.common.error`
- `schedule.common.loading`
- `schedule.common.error`
- `rules.common.loading`
- `rules.common.error`
- `rules.common.prev`
- `rules.common.next`
- `rules.matrix.common.prev`
- `rules.matrix.common.next`
- `main.target_protocol.close`
- `sites.target_protocol.close`

These paths were removed because they duplicated shared operational meaning without adding local context.

## Intentionally local examples

### Keep local to the owning namespace
- `rules.common.status`
: local section label, not a shared runtime status phrase
- `settings.status.loading`
: local status family with additional surface-specific siblings
- `target_protocol.*`
: context-rich analytical labels that belong to the owning surface unless a narrower shared family is explicitly promoted
- theme-specific headers, helper copy, empty states, and atmosphere labels

## Review checklist for new duplicate candidates
- Is this an operational phrase or a context phrase?
- Would the same key name make sense in every consuming surface?
- Is the wording expected to stay identical in both `en` and `ko`?
- Does moving it to `common` reduce duplication without flattening meaning?
- Can a narrow CI guard enforce the promoted shape without catching legitimate local families?

If any answer is unclear, keep the copy local and revisit after usage stabilizes.

## CI guard scope
The duplication guard is intentionally small.

It currently protects only the retired duplicate paths listed above and verifies that their promoted `common` equivalents still exist.

Why the guard stays small:
- broad duplicate detection would create false positives for context-specific families
- the audit document must lead and the CI guard should enforce only already-decided promotions
- new guarded promotions should update this document and the guard in the same change
