# i18n Boundary Map

- Status: Active
- Owner: repository architecture, i18n architecture
- Last validated against code: 2026-10-11
- Path policy: current-only
- Canonical for: locale metadata/resources, React and runtime translation APIs, runtime language persistence, namespace ownership, dynamic-family contracts, and copy fallback boundaries
- Companion to:
  - `docs/architecture/i18n/i18n-architecture-target.md`
  - `docs/migrations/i18n/i18n-migration-plan.md`
  - `docs/architecture/i18n/i18n-robustness-audit.md`
  - `docs/architecture/i18n/locale-duplication-audit.md`

## Purpose

This map audits the current i18n system as a repository boundary, not as a
locale file inventory. It is meant to answer which owner handles copy source,
resource assembly, React translation, runtime translation, language state,
namespace ownership, and dynamic-key contract coverage.

The practical reading question is:

```text
Can a caller choose the exact translation owner it needs without raw i18next
access, a feature-local copy fallback, or an undeclared dynamic key family?
```

## System Flow

Locale copy is authored in JSON and assembled through generated modules:

```text
src/i18n/locales/en/common.json and sibling locale JSON
  -> scripts/i18n/generate-locale-modules.mjs
  -> src/i18n/locales/en/common.js and sibling generated modules
  -> src/i18n/resources.js
  -> src/i18n/config.js
```

The Dashboard uses an i18n-owned bootstrap projection while preserving those
same generated locale modules and the same i18next instance:

```text
Dashboard entry
  -> src/i18n/dashboardConfig.js
  -> src/i18n/dashboardResources.js (shell and Main)
  -> existing dashboard tab preloader
  -> src/i18n/dashboardDeferredResources.js (requested namespace loaders)
```

The tab module and all of its declared deferred namespaces settle as one readiness
promise. Each namespace has one cached in-flight/ready registration shared by
boot, intent, rendering, and overlapping tabs. All metadata-supported locale
resources must validate before registration; a missing/malformed resource rejects
readiness. A failed namespace and its affected tab admissions are evicted for an
explicit retry while successful sibling namespaces remain ready. Unknown tab or
namespace IDs reject instead of admitting a blanket dictionary set.

Shell/Common/Main/Theme/Guidance remain in the static bootstrap projection. Main module
readiness additionally admits Sites and Tools: its first-site registration sheet
consumes Sites command messages and the Zen pond computes Tools tuner labels.
This ensures complete copy before Main renders and can move those dictionaries
earlier than the former post-first-frame blanket preload. Cold/warm boot evidence
must measure that tradeoff; the source split alone is not a latency claim.

The i18n-owned tab dependency catalog is:

| Tab | Deferred namespaces | Cross-surface reason |
| --- | --- | --- |
| `main` | `sites`, `tools` | first-site registration responses and Zen pond tuner labels |
| `sites` | `sites`, `filter`, `tools` | runtime insights and preset artifact labels |
| `schedule` | `schedule` | Schedule root, editor, and isolation action |
| `filter` | `filter`, `tools`, `settings` | artifact controls and preview mockups |
| `tools` | `tools` | gallery, selected controllers, and storage-support action |
| `settings` | `settings` | permissions, Safety, and Workspace |
| `experiment` | `tools`, `settings` | development hub/workspaces and CLSE lab |

The development HUD is also post-first-frame and joins the cached deferred Tools
dictionary before its module renders.
Main's controlled first-use registration editor owns `main.first_use` copy,
including its unchecked recording choice and explicit Browse action. UNSET
consent adds no dialog, automatic editor or navigation dictionary gate. Ordinary
Settings navigation joins its existing deferred namespace admission before
mounting `UsageRecordingControls`; recording settings copy remains owned by
`settings.recording`. Dictionary admission writes no recording policy and does
not add Settings resources to every Main boot.
Before that bootstrap profile is published, `dashboardConfig.js` hydrates the
active language from the typed runtime-language store and awaits i18next
initialization. It does not evaluate the browser detector's DOM/cookie/localStorage
probe on the launch-critical path; the extension UI language is the explicit
fallback only when typed hydration reports a failure.

The Popup uses the same projection rule at its smaller surface boundary:

```text
Popup entry
  -> src/i18n/popupConfig.js
  -> src/i18n/popupResources.js (common and guidance)
  -> src/domains/settings/i18n/popupRuntime.js (boot-shell copy)
```

The entry paints its lightweight skeleton first, then admits `popupConfig.js`,
the document theme, and `PopupApp` in parallel. `popupConfig.js` hydrates
`app_language` through the same typed repository and initializes the shared
i18next instance before React mounts. The boot-shell runtime translator keeps
the canonical `tRuntime(key, options)` call shape and missing-key semantics while
reading only the Popup projection. The Popup browser client supplies its
extension UI-language fallback without importing the broad `ChromeService`
facade.

The shared `guidance` namespace owns the five-day journey introduction,
contextual hints, artifact setup summaries, notification opt-in explanation,
and installation presentation copy. Dashboard and Popup admit both supported
locales before their hosts render; tab dictionaries remain deferred. Guidance
does not copy operational settings or protection notification strings into its
dictionary. The journey OS notification remains under
`settings.notifications.journey_stage_advanced` and is included in the generated
background notification leaf projection.

The dynamic key contracts expand `guidance.families` and
`guidance.family_descriptions` from the canonical seven-family catalog, and
installation phase copy from the five declared installation shots. Missing
English or Korean entries fail the existing i18n contract gate. Claims and
settings acknowledgements never substitute for locale admission.

Dashboard tab-copy requirements come from the `id`, `navKey`, `titleKey` and
`descriptionKey` declarations in the canonical tab registry and its development
entry owners. `dashboardTabMetadataContract.mjs` reads those declarations without
loading Dashboard runtime modules; the dynamic-family gate requires their exact
localized leaves for every supported language. It also retains whole-Dashboard
shape and nonempty-leaf parity. A locale root is not itself a tab declaration:
`dashboard.garden` contains the retained Garden's mode/action copy, while canonical
`main` and `sites` remain distinct routes. Missing actual tab metadata fails;
action-copy families do not acquire fabricated `nav/title/desc` leaves.

Tools' `artifacts.sentinel_flare.control_status` is the bounded configured-time
status and continuation family (`reason`/`action`), validated by both dynamic-key
expansion and recursive locale parity. It describes ON/OFF, canonical time-cap
availability and one precise next setting; it does not infer runtime engagement.

React UI reads through one public hook:

```text
React component
  -> src/ui-kit/hooks/useAppTranslation.js
  -> react-i18next useTranslation
  -> current theme context injection
```

Non-React runtime copy reads through the settings i18n runtime owner:

```text
runtime caller
  -> src/domains/settings/i18n/runtime.js
  -> src/i18n/resources.js
  -> explicit missing-key sentinel and diagnostic log
```

Schedule helpers use the named narrow runtime projection rather than importing
the full runtime resource assembly:

```text
Schedule constants/utils
  -> src/domains/settings/i18n/scheduleRuntime.js
  -> src/i18n/scheduleResources.js (Common and Schedule generated dictionaries)
  -> shared resourceTranslator.js sentinel/interpolation/context semantics
```

Schedule duration calculation returns a pure `{ key, params }` descriptor from
`utils.js/buildDurationCopyDescriptor`. React surfaces such as the rhythm
workspace resolve that descriptor with the `t` supplied by `useAppTranslation`;
the non-React `formatDuration(totalMinutes)` wrapper resolves it directly through
the narrow Schedule `tRuntime` owner. Helpers do not accept arbitrary translation
callbacks or decide the active React language/context.

Both full and Schedule runtime translators resolve UI language through the
resource-independent `src/domains/settings/i18n/runtimeUiLanguage.js` owner.
It preserves the existing ordering: runtime global, document language, extension
UI language, browser language, then configured fallback. Each source is normalized
with the configured fallback before its supported-locale check; an absent/empty
earlier source therefore selects that default immediately. Extension-read failures
share one once-per-module `[i18n]` diagnostic across both projections. The pure
`language.js` normalizer remains usable by the separate background language owner.

The Schedule projection preserves locale resource fallback, does not copy
dictionary content, and does not initialize another i18next instance. Other
deferred Dashboard namespaces stay outside the Schedule helper static closure.

The extension service worker uses a metadata-indexed generated narrow resource
closure:

```text
metadata.js supported locales + settings.json/tools.json canonical copy
  -> background-locale-projection.mjs
  -> locales/<locale>/backgroundRuntime.js
  -> generated backgroundResources.js locale registry
  -> backgroundRuntime.js
  -> notificationCopyResolver / nudgeCopy
```

The generated `settings.js` and `tools.js` modules compose those same projected
objects back into the UI namespaces, so the leaf is a build-graph projection,
not a second copy source.

Vite coalesces only metadata-derived `locales/*/backgroundRuntime.js` leaves into
the named `background-i18n-locales` chunk. Namespace admission can split full
English/Korean UI dictionaries without fragmenting that shared worker copy
projection. The chunk contains no translator, language, notification/runtime
owner, full UI dictionary, or static/dynamic/CSS dependency. The background i18n
artifact contract verifies its exact metadata-derived inventory and emitted
imports; background business modules remain in Rollup's natural static graph.

Runtime language mutation flows through the serialized background settings owner:

```text
LanguagePanel -> usePreferenceStore.setLanguage
  -> generation-bound preference settings command bus (app_language)
  -> SettingsService mutation lane
  -> src/platform/storage/internal/chrome-storage/stores/SettingsStore.js
```

The canonical ACK admits the UI language change. i18n boot and languageChanged
handlers only project language; they never persist it. RuntimeLanguageRepository
and RuntimeLanguageStore provide reads/subscriptions only, and the i18n profiles
subscribe to committed language changes across contexts. This prevents a Popup
or Dashboard-local settings.ui rewrite from racing the background writer.

Dynamic keys are allowed only when the source pattern and locale family are
declared together:

```text
dynamic runtime/UI key source
  -> scripts/ci/check-i18n-contract.mjs
  -> scripts/ci/check-i18n-dynamic-family-contracts.mjs
  -> en/ko locale JSON shape parity
```

## Canonical Owner Table

| Concern | Canonical owner | Canonical path | Source of truth | Forbidden shortcut |
| --- | --- | --- | --- | --- |
| Supported locales and namespace list | i18n metadata | `src/i18n/metadata.js` | locale list, namespace list, fallback language, default namespace | hardcoded locale or namespace lists in feature code |
| Locale copy | locale JSON | `src/i18n/locales/en/common.json`, `src/i18n/locales/ko/common.json`, and sibling namespace JSON | authored user-facing copy | feature-local `defaultValue`, inline English copy, or generated JS manual edits |
| Generated locale modules | i18n generator | `scripts/i18n/generate-locale-modules.mjs` | JSON-derived ESM modules | editing generated locale JS as the canonical copy source |
| Resource assembly | i18n resources | `src/i18n/resources.js`, `src/i18n/popupResources.js`, `src/i18n/dashboardResources.js`, `src/i18n/dashboardDeferredResources.js`, `src/i18n/scheduleResources.js` | frozen full resource object plus surface-owned projections and namespace loaders from the same generated locale modules | caller-built resource maps, copied dictionaries, or feature-owned locale imports |
| Background locale projection | i18n generator projection | `scripts/i18n/background-locale-projection.mjs`, `src/i18n/locales/*/backgroundRuntime.js` | exact notification and Sentinel copy paths projected from namespace JSON | hand-authored background copy, duplicated locale JSON, or adding a consumer key without updating the projection contract |
| Background resource assembly | i18n generator plus background i18n resources | `scripts/i18n/generate-locale-modules.mjs`, `src/i18n/backgroundResources.js` | narrow frozen locale map generated for every `I18N_SUPPORTED_LOCALES` entry | hand-maintained locale imports/maps, importing `src/i18n/resources.js`, or admitting any locale JS module other than a metadata-derived `backgroundRuntime.js` leaf into the worker |
| React i18n init and document language | React i18n config | `src/i18n/config.js`, `src/i18n/popupConfig.js`, `src/i18n/dashboardConfig.js` | full-profile or surface-profile i18next initialization, document language, persistence hook; Popup and Dashboard hydrate language from the typed settings store before publishing readiness | feature-owned i18next initialization or launch-critical DOM/cookie/localStorage language detection |
| Dashboard deferred namespace admission | i18n projection plus Dashboard tab preloader | `src/i18n/dashboardResources.js`, `src/i18n/dashboardDeferredResources.js`, `src/apps/dashboard/loading/preloadDashboardTab.js` | i18n-owned tab dependency catalog, per-namespace shared registration, complete supported locales, and canonical tab module readiness | blanket admission, unknown-ID defaults, rendering a tab before its namespaces settle, or importing dictionaries from Dashboard feature code |
| React translation API | app translation hook | `src/ui-kit/hooks/useAppTranslation.js` | public React hook and theme context injection | direct `useTranslation` import in feature code |
| Retired theme hook bridge | removed shim | retired `useThemeTranslation` hook name | deleted; React UI uses `useAppTranslation` directly | reintroducing or importing `useThemeTranslation` |
| Runtime translation API | settings i18n runtime | `src/domains/settings/i18n/runtime.js`, `src/domains/settings/i18n/popupRuntime.js` | canonical `tRuntime` call shape, full-resource runtime owner, Popup boot-shell resource projection, missing-key sentinel | raw `i18n.t`, ad hoc `translate`, key-suffix labels, fallback arguments, or full runtime resources in Popup boot |
| Schedule runtime translation projection | settings i18n runtime | `src/domains/settings/i18n/scheduleRuntime.js`, `src/i18n/scheduleResources.js` | canonical `tRuntime` call shape, generated Common/Schedule dictionaries, and shared translator semantics | Schedule helpers importing the full runtime/resource assembly or feature-owned copy maps |
| Background runtime translation API | settings i18n background runtime | `src/domains/settings/i18n/backgroundRuntime.js`, `src/domains/settings/i18n/resourceTranslator.js` | `tBackgroundRuntime`, explicit-language translation, shared sentinel/interpolation semantics | broad runtime/resource imports in notification or Sentinel background copy paths |
| Full/Schedule runtime UI language resolution | settings i18n UI language owner | `src/domains/settings/i18n/runtimeUiLanguage.js` | shared metadata-based source ordering, existing per-source default normalization, and one extension-read diagnostic | copied language chains in resource projections, broad resource imports into the language owner, or making the pure normalizer depend on UI/platform state |
| Runtime language normalization | settings i18n language helpers | `src/domains/settings/i18n/language.js`, `src/domains/settings/i18n/constants.js`, `src/domains/settings/i18n/runtimeLanguageState.js` | supported-language normalization and sidecar language state | unrelated code writing language globals directly |
| Runtime language persistence | background settings command owner; typed read/subscription repository | `src/apps/dashboard/stores/usePreferenceStore.js`, `src/apps/background/services/SettingsService.js`, `src/platform/storage/settings/RuntimeLanguageRepository.js` | canonical `app_language` ACK and stored settings.ui field | UI-owned settings document writes or boot persistence |
| Sentinel Flare nudge copy | settings i18n nudge wrapper | `src/domains/settings/i18n/nudgeCopy.js` | narrow tools-copy runtime wrapper | general-purpose runtime translation wrapper outside this owner |
| Namespace ownership contracts | i18n ownership CI | `scripts/ci/check-i18n-namespace-ownership.mjs` | root family to namespace ownership rules | moving copy families without updating ownership rules |
| Dynamic family contracts | i18n dynamic CI | `scripts/ci/check-i18n-contract.mjs`, `scripts/ci/check-i18n-dynamic-family-contracts.mjs`, `scripts/ci/dashboardTabMetadataContract.mjs` | approved recursive/flat dynamic key families and registry-declared Dashboard tab-copy leaves | unregistered dynamic keys, treating every locale root as a tab, or one-script-only contract updates |
| Robustness contracts | i18n robustness CI | `scripts/ci/check-i18n-robustness.mjs`, `scripts/ci/check-runtime-i18n-boundaries.mjs` | missing-key and runtime boundary failure policy | silent catches, fallback labels, or runtime fallback args |
| React hook boundary contracts | React i18n CI | `scripts/ci/check-react-i18n-hook-boundaries.mjs` | governed component namespace and hook expectations | raw hook imports or namespace drift in governed React surfaces |
| Hardcoded UI contract | UI i18n CI | `scripts/ci/check-ui-i18n-hardcoded-strings.mjs` | governed raw-string prevention | adding unlocalized UI chrome in governed surfaces |
| Duplication policy | locale duplication audit and guard | `docs/architecture/i18n/locale-duplication-audit.md`, `scripts/ci/check-i18n-duplication-guard.mjs` | promoted shared keys and retired duplicate paths | convenience duplication across namespaces |

## Function Ledger

| Boundary function | Input | Output | Failure policy |
| --- | --- | --- | --- |
| `useAppTranslation` | namespace | React translation object with theme context | direct raw hook usage is a CI failure in governed surfaces |
| `tRuntime` | `namespace:key`, interpolation options | localized runtime string | missing key returns sentinel and logs once; governed callers must not pass fallback copy |
| `tRuntimeWithLanguage` | language, `namespace:key`, interpolation options | localized runtime string for an explicit language | invalid language resolves through the documented runtime language chain |
| `tBackgroundRuntimeWithLanguage` | language, projected `namespace:key`, interpolation options | localized string from the narrow generated leaf | missing projected key returns the explicit sentinel; callers cannot supply copy fallback arguments |
| `createRuntimeResourceTranslator` | declared resource map and language owners | isolated runtime translator | missing resources or language owners throw; missing keys log once and return the sentinel |
| `resolveRuntimeUiLanguage` | runtime global, document, extension UI, and browser language sources | metadata-supported UI runtime language | each source preserves existing default normalization; extension-read failure logs once across full/Schedule projections and continues the declared source chain |
| `setRuntimeLanguage` | requested language | resolved runtime language global | unsupported language resolves to the configured fallback language only inside the i18n owner |
| `usePreferenceStore.setLanguage` | canonical supported language | background committed language ACK | persistence/admission failures reject before UI language application |
| `RuntimeLanguageStore.get` | typed settings document | persisted runtime language | read failures surface through repository/config diagnostics |
| `RuntimeLanguageStore.subscribe` | settings document changes | language change callback | storage read failures log and do not emit a fabricated fallback value |
| locale module generation | locale metadata and JSON files | generated locale JS files plus `backgroundResources.js` registry | every metadata-declared locale must have a projected leaf and generated registry entry; missing input or output fails generation/CI |
| `preloadDashboardTabI18nResources` | canonical Dashboard tab ID | shared tab readiness after every declared namespace and supported locale is registered | undeclared IDs and failed/invalid dictionaries reject; retry only restarts failed namespace owners |

## Recovery Versus Fallback

| Class | Allowed? | Rule |
| --- | --- | --- |
| Runtime language source chain | Yes | full/Schedule `tRuntime` use the shared UI language owner: runtime global, document, extension UI, browser, then configured fallback; each source keeps its existing default normalization |
| Locale resource fallback | Bounded | Missing selected-locale resource may resolve from configured fallback locale inside the resource system |
| Background locale projection | No independent fallback | Background leaves are generated from the same canonical locale JSON and UI modules recompose that leaf; a missing namespace/path fails generation or the leaf contract |
| Missing translation key | No silent fallback | Return the explicit `[missing i18n: ...]` sentinel and log a diagnosable error |
| `defaultValue` in `src` | No | `check:i18n:no-default-value` blocks code-owned copy fallbacks |
| Runtime fallback arguments | No | Runtime robustness CI locks `tRuntime`/`tRuntimeWithLanguage` signatures, and runtime boundary CI limits governed surface call arity |
| Raw `i18n.t` or feature-local `translate` wrappers | No | Runtime governed surfaces must use `tRuntime` or the declared `nudgeCopy` wrapper |
| Direct React `useTranslation` feature usage | No | Governed React surfaces use `useAppTranslation` |
| `useThemeTranslation` usage | No | The transitional shim is retired; use `useAppTranslation` |
| Dynamic key families | Bounded | Add or update both dynamic-family contract layers when introducing a dynamic family |
| Top-level `app_language` storage key | No | release V1 reads `settings.ui.app_language` only and rejects the retired top-level key |

## First-Pass Findings

### F1. Public API convergence is mostly complete

Status: keep.

Governed React surfaces use `useAppTranslation`, governed runtime surfaces use
`tRuntime`, and the retired `useThemeTranslation` wrapper is deleted.
The remaining risk is not multiple public APIs, but forgetting to register a
new governed surface or dynamic family when a feature grows.

### F2. The old `defaultValue` migration note is stale

Status: fixed in this pass.

The source tree is already guarded by `check:i18n:no-default-value`, and the
current scan found no `defaultValue` usage in `src`. The migration document now
describes fallback cleanup as a runtime/contract inventory task rather than a
large component-by-component `defaultValue` removal effort.

### F3. Dynamic family ownership is intentionally split across two guards

Status: documented watch.

`check-i18n-contract.mjs` validates referenced static and approved dynamic keys,
while `check-i18n-dynamic-family-contracts.mjs` validates recursive/flat family
shape parity. A new dynamic family should update both layers in the same change
unless the family is genuinely covered by an existing rule.

### F4. The runtime translator fallback parameters were removed

Status: fixed in this pass.

`tRuntime`, `tRuntimeWithLanguage`, and the internal resolved-language helper no
longer expose the historical `fallback` parameter. Runtime robustness CI locks
the narrow signatures, while runtime boundary CI continues to block oversized
calls in governed runtime surfaces.

### F5. A dead key-suffix fallback helper was removed

Status: fixed in this pass.

`defaultLabelFromKey` in `src/domains/settings/i18n/runtime.js` was unused and
would have reintroduced the exact missing-key fallback shape the robustness
policy retired. Removing it keeps missing runtime copy on the sentinel path.

### F6. The service-worker copy closure is a generated leaf

Status: added in the 2026-08-09 background i18n pass.

Notification and Sentinel background copy no longer pull the full UI locale
resource graph into the extension worker. The projection manifest is checked
against the exact static consumer keys, generated leaves are deep-compared with
their canonical JSON projection, and `backgroundResources.js` is generated from
the canonical `I18N_SUPPORTED_LOCALES` list. The artifact contract derives the
only allowed locale modules from that metadata and rejects every other
`src/i18n/locales/**/*.js` owner in the worker closure. Adding a locale therefore
expands the public leaf contract automatically, while a missing projected leaf,
an unsupported/stale locale module, or a metadata-undeclared namespace module
fails loudly instead of leaving a hand-maintained locale allowlist behind.

### F7. Popup boot uses a common-only i18n projection

Status: fixed in the 2026-08-15 Popup static-closure pass.

Popup uses only the `common:popup.*` family but previously imported the full
React config and runtime resource graph. That made Schedule, Settings, Tools,
Theme, and the generated background-runtime locale leaf statically reachable
from `popup.html`.

`popupResources.js`, `popupConfig.js`, and `popupRuntime.js` now keep the Popup
on generated `common` modules while preserving typed `app_language` hydration,
the canonical runtime call shape, missing-key diagnostics, and resource fallback
semantics. The lightweight boot translator stays static; typed language and
React i18n initialize in parallel with the other deferred Popup stages before
React mounts. Robustness CI rejects either full i18n entrypoint returning to the
Popup boot graph.

## Verification Targets

Use these checks when this boundary changes:

- `npm run check:i18n:contract`
- `npm run check:i18n:duplication-guard`
- `npm run check:i18n:no-default-value`
- `npm run check:i18n:dynamic-families`
- `npm run check:i18n:ownership`
- `npm run check:i18n:robustness`
- `npm run check:background:i18n-leaf`
- `npm run check:runtime:i18n-boundaries`
- `npm run check:settings:preview-i18n-contract`
- `npm run check:react:i18n-hook-boundaries`
- `npm run test:file -- tests/dashboardI18nResources.test.js tests/scheduleRuntimeI18n.test.js tests/runtimeUiLanguage.test.js tests/dashboardTabIntentPreload.test.js`
- `npm run check:ui:i18n-hardcoded-strings`
- `npm run check:dashboard:i18n-contract`
- `npm run check:background:i18n-leaf-artifact`
- `npm run check:docs:paths`
