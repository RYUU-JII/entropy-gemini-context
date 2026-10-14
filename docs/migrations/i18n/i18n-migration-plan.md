# i18n Migration Plan

- Status: Migration
- Owner: i18n migration
- Last validated against code: 2026-06-25
- Path policy: planning-allowed
- Exit criteria: Governed UI and runtime surfaces use canonical translation APIs, ownership checks pass without migration exceptions, and legacy i18n entrypoints are removed.
- Companion map: [i18n-boundary-map.md](/home/ryuji/projects/Entropy/docs/architecture/repository/i18n-boundary-map.md)

## Objective
Move the repository from a partially unified i18n system to the target architecture defined in [i18n-architecture-target.md](/home/ryuji/projects/Entropy/docs/architecture/i18n/i18n-architecture-target.md).

## Success criteria
- all new React UI uses one translation wrapper
- runtime code uses one runtime API
- namespace ownership is stable
- governed UI surfaces have no raw copy regressions
- governed source has no code-owned `defaultValue` copy fallback

## Current reality
- metadata/resources are already centralized
- `useAppTranslation` is the governed React public API
- `tRuntime` is the governed runtime public API
- key existence, ownership, dynamic-family, robustness, no-default-value, hardcoded-string, and hook-boundary contracts already exist
- dashboard, popup, and preview have meaningful contract coverage
- `useThemeTranslation` remains as a compatibility wrapper only
- some families still require careful dynamic-family and namespace ownership maintenance
- remaining cleanup is contract inventory, namespace reshaping, and transitional wrapper retirement rather than broad `defaultValue` removal

## Migration strategy
Use phased convergence, not a big-bang rewrite.

## Phase 0. Freeze the target
Status:
- done by documentation

Deliverables:
- target architecture document
- migration plan document

Rule:
- no new i18n surface should be introduced outside the target model

## Phase 1. Public API convergence
Goal:
- reduce author-facing translation APIs to two

Status:
- mostly complete for governed surfaces

Tasks:
- introduce `useAppTranslation(namespace)`
- keep `tRuntime('namespace:key', options)` as the only runtime API
- update feature guidance so React UI does not directly import `useTranslation` or `useThemeTranslation`

Exit criteria:
- new React UI code uses `useAppTranslation`
- no new direct imports of `useTranslation` or `useThemeTranslation` in feature code

## Phase 2. Theme translation consolidation
Goal:
- make theme context invisible to most authors

Status:
- active public behavior is in `useAppTranslation`
- `useThemeTranslation` remains as a thin transitional shim

Tasks:
- implement theme context injection inside `useAppTranslation`
- migrate theme-aware React surfaces from direct `useThemeTranslation` to `useAppTranslation`
- keep existing theme-context behavior functionally identical

Exit criteria:
- feature authors no longer choose between two React translation hooks

## Phase 3. Namespace reshaping
Goal:
- move from legacy namespace boundaries to surface-owned namespaces

Tasks:
- decide final ownership for families currently split or historically duplicated
- reduce `tabs` to actual dashboard/tab metadata only, or replace it with `dashboard`
- move feature copy to surface namespaces:
  - `main`
  - `filter`
  - `sites`
  - `tools`
  - `settings`
  - `schedule`

Recommended order:
1. `tabs` -> `dashboard` metadata definition
2. `filter` surface copy
3. `main` surface copy
4. `sites` surface copy
5. `settings` and preview chrome
6. `tools`

Exit criteria:
- each key family has one clear owner
- `tabs` is no longer a mixed storage area for unrelated surface copy

## Phase 4. Contract expansion
Goal:
- make CI enforcement match the target architecture

Status:
- substantially active
- future work should register newly governed surfaces and new dynamic families as they appear

Tasks:
- update ownership contract as namespaces settle
- expand UI hardcoding contracts to more governed surfaces
- add policy checks that ban new direct React i18n hook usage outside wrapper modules

Recommended contract additions:
- forbid direct `useTranslation` imports in governed feature folders
- forbid direct `useThemeTranslation` imports outside wrapper or bridge modules
- classify exceptions for mock/sample datasets explicitly

Exit criteria:
- new code cannot easily bypass the architecture by accident

## Phase 5. Fallback reduction
Goal:
- stop treating `defaultValue` as an invisible source of truth

Status:
- `defaultValue` is currently banned in `src`
- runtime fallback cleanup now focuses on explicit sentinels, diagnosable failures, and no caller-provided fallback copy

Tasks:
- keep `defaultValue` out of governed source
- migrate any newly discovered descriptor fallback copy into locale JSON
- remove unused fallback helpers that manufacture labels from keys
- keep runtime failure containment inside documented language/resource fallback seams

Policy target:
- governed UI and runtime surfaces should not depend on code-owned fallback copy for normal rendering

Exit criteria:
- copy fallback exceptions are documented owner seams rather than local convenience paths

## Phase 6. Preview/mock normalization
Goal:
- keep preview systems manageable without over-localizing data payloads

Tasks:
- maintain the split between preview chrome and sample content
- localize all preview chrome through `settings.preview.*`
- decide whether sample datasets will remain content fixtures or become localized datasets

Recommended default:
- localize chrome
- keep sample feed bodies/comments as content fixtures unless product requirements change

Exit criteria:
- preview UI is governed and stable
- contract noise stays low

## Phase 7. Runtime cleanup
Goal:
- standardize non-React translation behavior

Tasks:
- audit runtime helpers and ad hoc wrappers
- route non-React translation through `tRuntime`
- remove duplicate interpolation or lookup helpers where unnecessary

Exit criteria:
- runtime translation behavior is predictable and centralized

## Phase 8. Legacy wrapper retirement
Goal:
- remove transitional translation helpers

Likely retirement targets:
- direct feature usage of `useThemeTranslation`
- direct feature usage of raw `useTranslation`
- ad hoc local helpers that only exist to prepend namespace roots
- fallback wrappers such as `resolveText` once keys are complete

Exit criteria:
- wrapper count is low
- translation usage is easy to teach and easy to review

## Order of execution
Recommended implementation order:
1. ship `useAppTranslation`
2. migrate new work to the wrapper immediately
3. stabilize namespace ownership
4. expand contracts to ban old patterns in governed folders
5. reduce `defaultValue`
6. retire transitional helpers

## Risk management

### Risk: noisy contracts
Mitigation:
- keep surface-specific contracts where generic scanning is too noisy
- explicitly classify mock/sample content as exceptions

### Risk: translation regressions during namespace moves
Mitigation:
- move one family at a time
- keep ownership contracts updated
- avoid simultaneous family renames across many namespaces

### Risk: team confusion during transition
Mitigation:
- publish one authoring rule:
  - React UI uses `useAppTranslation`
  - runtime code uses `tRuntime`

## Recommended immediate next steps

### Step 1
Keep the i18n boundary map and migration plan synchronized when a new namespace, runtime wrapper, or dynamic family is introduced.

### Step 2
Retire `useThemeTranslation` after all external compatibility needs are confirmed closed.

### Step 3
Completed: historical runtime fallback parameters were removed after call sites were confirmed to rely only on sentinel behavior. Runtime robustness CI now locks the narrow translator signatures.

## Definition of migration complete
Migration is complete when:
- authors no longer need to know multiple React translation entrypoints
- locale ownership is obvious from namespace names
- contracts guard all important product surfaces
- fallback-heavy code paths are rare
- review of new UI code can enforce one simple rule set
