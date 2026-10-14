# i18n Architecture Target

- Status: Active
- Owner: i18n architecture
- Last validated against code: 2026-10-07
- Path policy: planning-allowed
- Canonical for: repository-wide i18n target architecture
- Companion map: [i18n-boundary-map.md](/home/ryuji/projects/Entropy/docs/architecture/repository/i18n-boundary-map.md)

## Status
- Target state document
- Scope: repository-wide
- Audience: feature authors, theme authors, CI/contract authors

## Goal
The i18n system must be managed as a single product architecture, not as per-tab or per-feature conventions.

The target state is:
- one metadata source of truth
- one React translation API
- one runtime translation API
- one ownership rule per key family
- locale JSON as the only copy source of truth
- CI contracts that block missing keys, ownership drift, and UI hardcoding regressions

## Non-goals
- This document does not require every mock dataset or user-generated content sample to be localized.
- This document does not require removal of declared language/resource fallback seams that are owned by the i18n runtime.
- This document does not mandate a specific visual language for translated UI.

## Core principles

### 1. Locale JSON is the source of truth
- User-facing copy lives in locale JSON files.
- Generated JS locale modules are build artifacts derived from JSON.
- Code must not become the canonical owner of copy through `defaultValue`, descriptor fallback fields, or key-suffix label generation.

### 2. Translation APIs are layer-specific
- React UI must use `useAppTranslation(namespace)`.
- Non-React code must use `tRuntime('namespace:key', options)`.
- Direct usage of raw `useTranslation`, retired `useThemeTranslation`, `i18n.t`, or ad hoc wrappers must not appear in governed feature code.

### 3. Namespace ownership is explicit
- Each key family is owned by exactly one namespace.
- Copy families must not be duplicated across namespaces as a convenience.
- If multiple product surfaces truly share copy, move that copy into an intentionally shared namespace family.
- Shared-key promotions and retired duplicate paths must be recorded in the locale duplication audit before a new duplication guard is added.
- The shared `guidance` namespace owns contextual app introductions, the five-day journey, artifact setup summaries and installation presentation copy. It is resident in Dashboard and Popup; operating settings and OS notification copy retain their existing namespace owners.

### 4. Contracts enforce architecture
- Missing keys are architecture failures.
- Namespace ownership drift is an architecture failure.
- New raw UI strings in governed surfaces are architecture failures.
- Runtime translation must fail loudly on missing keys instead of quietly degrading to fallback labels in canonical product paths.
- Language persistence and hydration failures must emit diagnosable errors instead of silently defaulting or disappearing.
- Language mutations use the Dashboard preference command channel and background SettingsService; i18n bootstrap and languageChanged handlers only project canonical state. RuntimeLanguageRepository/Store are read/subscription owners and never write settings.ui from a UI context.
- Content language hydration reads `CONTENT_BOOTSTRAP_SNAPSHOT`'s `language`
  operation through the authenticated background route. Content has no raw local
  storage or local-change subscription. Existing `PROTECTION_UPDATE` broadcasts
  invalidate its language read; `app_language` forces a full protection snapshot
  so signature deduplication cannot hide a language update. Extension-page and
  background language read/subscription ownership remains RuntimeLanguageRepository.

### 5. Theme context is an implementation detail
- Theme-aware lookup is valid, but it must not create a second public API surface.
- Theme resolution belongs inside the React wrapper layer.

### 6. Product tone is shared across operational UI
- Core product actions must read as one application, even when the visual theme changes.
- Settings, confirmations, permissions, errors, destructive actions, recovery guidance, and status updates must use a standard product tone rather than per-theme language.
- Theme flavor belongs in atmosphere and presentation, not in behavior-critical wording.

## Tone governance

### Standard product tone is the default for shared UX
The default tone for repository-wide product surfaces is:
- clear
- direct
- calm
- specific
- low-metaphor

This tone applies to:
- `common`
- `sites`
- `settings`
- `tools`
- `filter`
- `main`
- `schedule`
- any shared confirmation, permission, save, error, success, or warning copy

Expected characteristics:
- action labels describe exactly what happens
- error copy names the failure and next step
- confirmation copy states scope and consequence
- success copy confirms the completed action without flourish

### Theme language is an ambient layer
Theme-specific language is allowed only when it does not change the operational meaning of the interface.

Good theme-language surfaces:
- section headers
- empty states
- decorative helper text
- lore or atmosphere copy inside theme-owned widgets
- non-critical explanatory labels that do not affect action clarity

Theme language must not replace or redefine:
- destructive actions
- permission requests
- save/update confirmations
- conflict resolution copy
- settings labels that map to stored behavior
- validation or recovery guidance

### Theme language is not a user mode
- Do not introduce a separate "theme language mode" for core product UX unless product explicitly adopts it as a governed feature.
- Do not duplicate shared operational copy into theme-specific namespaces as a convenience.
- If a theme needs special language, keep it inside theme-owned ambient copy families and preserve the shared operational meaning.

### Writing rules for operational copy
- Prefer explicit verbs such as `Move`, `Save`, `Remove`, `Allow`, and `Block`.
- Prefer plain outcomes such as `The rule could not be moved. Wait a moment and try again.`
- Prefer conflict messages that explain the cause, such as overlap, broader coverage, or alias linkage.
- Avoid lore, metaphor, or roleplay language in shared operational copy.
- Keep titles short and action-focused.

Examples:
- Preferred: `Move site rule`
- Preferred: `youtube.com conflicts with youtu.be because they are linked as the same service.`
- Avoid in shared UX: `Seal this domain into the warded registry`

### Ownership implications
- Shared operational copy should live in the owning product namespace, not in theme namespaces.
- Theme namespaces should own ambient copy, presentation copy, and theme-specific explanatory language.
- If the same operational sentence appears across multiple product surfaces, move it into an intentionally shared namespace family instead of duplicating it with stylistic drift.

## Canonical public APIs

### React UI API
All React UI should converge on:

```js
const { t } = useAppTranslation('settings');
```

Usage:

```js
t('preview.youtube.actions.reply');
```

Responsibilities of `useAppTranslation(namespace)`:
- wrap the underlying React i18n hook
- validate or normalize namespace usage
- inject theme context when needed
- provide one stable call pattern for all React UI

### Runtime API
All non-React or shared runtime code should converge on:

```js
tRuntime('common:popup.messages.load_error');
```

Responsibilities of `tRuntime`:
- resolve the active language
- resolve namespace and key
- apply interpolation
- honor fallback language rules
- surface missing-key failures explicitly rather than silently degrading to ad hoc copy
- avoid caller-provided fallback copy in governed runtime paths

### Missing translation sentinel policy
- Missing translations must return one explicit sentinel shape across environments.
- Do not introduce separate dev/prod missing-key render policies for canonical product paths.
- Do not replace missing-key sentinels with silent English fallback, empty strings, or key suffix labels.
- Missing-key sentinels must be paired with diagnosable error logging.

Descriptor-style runtime systems must not keep user-facing fallback copy beside locale keys in canonical paths.

## Pure runtime artifact boundary

`scripts/i18n/runtimeI18nChunkContract.mjs` is the shared Vite/CI artifact
contract for `runtime-i18n-primitives`. Its exact four source modules are
`src/i18n/metadata.js`, `src/domains/settings/i18n/constants.js`,
`src/domains/settings/i18n/language.js`, and
`src/domains/settings/i18n/resourceTranslator.js`. Their narrow source APIs
remain canonical; this chunk does not introduce a product facade or a second
language/resource owner.

The chunk holds metadata, language normalization and translator definitions.
It has no external static/dynamic/CSS dependency, resource dictionaries,
Chrome/DOM access, or eagerly created translator instance. Generated
`backgroundRuntime.js` locale leaves retain their separate exact
`background-i18n-locales` owner. Full UI dictionaries remain admitted by the
owning surface and namespace. `check-background-i18n-leaf-artifact-contract.mjs`
checks exact inventory membership, closure reachability and emitted imports;
missing, duplicated or broadened owners fail the build.

## Namespace model

Namespaces should map to product surfaces, not implementation accidents.

Canonical namespaces:
- `common`
- `dashboard`
- `sites`
- `main`
- `filter`
- `tools`
- `settings`
- `schedule`
- `theme`

Notes:
- A namespace should not become a catch-all for unrelated copy.

## Ownership model

Each key family must have one owner.

Examples of valid ownership:
- `preview.*` -> `settings`
- `target_protocol.*` -> one chosen owner per surface contract
- `worker_runtime.*` -> `tools`
- `popup.*` -> `common`

Examples of invalid ownership:
- `target_protocol.*` duplicated in two namespaces without an explicit split rule
- `filter.*` keys stored in `tabs`
- `settings.*` UI copy stored in `common`

Ownership rules must be encoded in CI contracts, not left as tribal knowledge.

Related audit:
- [Locale Duplication Audit](/home/ryuji/projects/Entropy/docs/architecture/i18n/locale-duplication-audit.md)

## Key design rules

### Preferred key shape
- `section.element.role`
- `surface.section.element`

Examples:
- `preview.youtube.actions.reply`
- `target_protocol.empty.title`
- `dashboard.main_panel.missing_tab_title`

### Avoid
- large sets of unrelated flat keys
- the same semantic copy expressed with different root families in different files
- key naming that depends on component filenames

## Theme-aware translations

Theme-aware translation is allowed, but the public API must stay stable.

Target behavior:
- component authors call `useAppTranslation(namespace)`
- the wrapper injects theme context automatically
- theme-specific variants are resolved through normal i18n context behavior

This means:
- no separate day-to-day authoring rule for "normal" vs "theme-aware" components
- no direct dependency on theme-specific hook choice in feature code

## Fallback policy

### Allowed seams
- runtime language source resolution through the documented platform chain
- locale-resource fallback to the configured fallback locale inside the i18n resource system

### Forbidden in governed product paths
- legacy runtime-language storage migration or alternate storage-key reads
- `defaultValue` as code-owned copy
- descriptor fallback fields beside locale keys
- runtime fallback arguments
- key-suffix label generation for missing translations
- silent empty-string, `null`, `false`, or English fallback for missing canonical copy

## UI hardcoding policy

### Forbidden in governed UI
- user-facing labels
- button text
- headings
- tooltips
- empty states
- action copy

### Allowed exceptions
- user-generated content
- mock/sample content payloads classified as content rather than UI chrome
- technical literals such as `https://`, `.io`, `%`, `ms`
- explicit brand names where localization is not desired

## Preview/mock policy

Preview and mock surfaces must split into two categories:

### UI chrome
- navigation labels
- platform selector labels
- search placeholders
- modal titles
- action labels
- sort/filter labels

This must use locale keys.

### Sample content
- fake post bodies
- fake comments
- fake usernames
- dataset-like example captions

This may remain as mock content unless product requirements call for localization.

## Metadata and resources

The following must remain single-source:
- supported locales
- namespace registry
- fallback language
- default namespace
- resource assembly

These must feed:
- React i18n config
- runtime translator
- locale module generation
- key existence contracts

## Required CI contract layers

### 1. Metadata contract
Checks:
- namespace registry is canonical
- supported locales are canonical
- locale directories match metadata

### 2. Key existence contract
Checks:
- referenced static keys exist in all supported locales
- allowed dynamic key patterns expand to real locale keys
- recursive/flat dynamic family shapes stay aligned across locales

### 3. Namespace ownership contract
Checks:
- governed product surfaces resolve the correct key families through the correct namespace

### 3a. Duplicate-path guard
Checks:
- already-retired duplicate locale paths do not reappear
- promoted shared operational keys still exist in `common`

### 4. UI hardcoding contract
Checks:
- governed UI surfaces do not add raw user-facing copy

### 5. Surface-specific contracts
Checks:
- special surfaces such as preview/mock follow their own stricter rules where generic contracts would be too noisy
- React and runtime entrypoint boundaries stay on the public seams

## Target repository shape

### Locale source
- `src/i18n/locales/<locale>/<namespace>.json`

### Generated modules
- `src/i18n/locales/<locale>/<namespace>.js`

### Metadata
- `src/i18n/metadata.js`
- `src/i18n/resources.js`
- `src/i18n/popupResources.js`
- `src/i18n/dashboardResources.js`
- `src/i18n/dashboardDeferredResources.js`
- `src/i18n/scheduleResources.js`

Dashboard deferred admission is namespace-scoped inside the i18n owner. Its tab
dependency catalog includes nested dialogs, widgets, and labs; every required
namespace registers all metadata-supported locales before the existing tab
module readiness promise resolves. Concurrent surfaces share namespace records,
failed records are retryable, and unknown tab IDs reject. The catalog and the
cross-surface reasons are canonical in the companion i18n boundary map.

### Runtime
- `src/i18n/config.js`
- `src/i18n/popupConfig.js`
- `src/i18n/dashboardConfig.js`
- `src/domains/settings/i18n/runtime.js`
- `src/domains/settings/i18n/popupRuntime.js`
- `src/domains/settings/i18n/dashboardRuntime.js`
- `src/domains/settings/i18n/scheduleRuntime.js`
- `src/domains/settings/i18n/runtimeUiLanguage.js`

Schedule's non-React helpers use the named Common/Schedule resource projection
through the shared runtime translator factory. The `tRuntime` call contract,
language chain, interpolation, theme context, and explicit missing-key diagnostics
remain the same; importing the full runtime assembly in those helpers would
recombine otherwise deferred Dashboard dictionaries.

Full and Schedule runtime projections share `runtimeUiLanguage.js` for the
existing UI language precedence and per-source defaults, with one extension-read
failure diagnostic. This owner imports metadata and the pure `language.js`
normalizer, never a resource assembly. Background and Popup retain their separate
declared language seams; the pure normalizer must not depend on UI/platform state.

### Contracts
- `scripts/ci/check-i18n-contract.mjs`
- `scripts/ci/check-i18n-dynamic-family-contracts.mjs`
- `scripts/ci/check-i18n-duplication-guard.mjs`
- `scripts/ci/check-i18n-namespace-ownership.mjs`
- `scripts/ci/check-i18n-no-default-value.mjs`
- `scripts/ci/check-i18n-robustness.mjs`
- `scripts/ci/check-react-i18n-hook-boundaries.mjs`
- `scripts/ci/check-runtime-i18n-boundaries.mjs`
- `scripts/ci/check-settings-preview-i18n-contract.mjs`
- `scripts/ci/check-ui-i18n-hardcoded-strings.mjs`
- `scripts/ci/check-dashboard-i18n-contract.mjs`
- surface-specific contracts as needed

## Definition of done
The i18n architecture is considered in target state when all of the following are true:
- React UI uses one public translation wrapper
- runtime code uses one public runtime translator
- locale JSON is the only copy source of truth for governed UI
- namespace ownership is stable and contract-enforced
- direct raw UI strings are blocked in governed surfaces
- code-owned copy fallback is blocked in governed source
- the `defaultValue` guard inspects translation call options; unrelated domain-model
  fields with the same property name are outside the i18n contract
- theme-aware translation does not require a separate authoring API
- new UI work cannot bypass contracts without an intentional architecture change
