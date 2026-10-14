# Theme Engine Boundary Map

- Status: Active
- Owner: repository architecture, theme architecture
- Last validated against code: 2026-10-07
- Path policy: current-only
- Canonical for: theme public entrypoints, lightweight surface-descriptor and full plugin-manifest lookup, shared widget seams, friction presentation delivery, public research-entry selection, ambient presentation and temporal-authority delivery, and theme preference boundaries
- Companion to:
  - `docs/system-architecture/03-theme-plugin-and-zen.md`
  - `docs/architecture/repository/protection-content-runtime-boundary-map.md`
  - `docs/architecture/repository/settings-command-boundary-map.md`

## Zen first-bloom interaction seam

`src/themes/plugins/zen/api/bonsaiFirstBloom.js` exposes only the fixed region
count, full mask, per-region duration and region-ID validation from the pure
`ZenBonsaiPlumeBloomPresentationContract.js` owner. Dashboard owns admission,
accessible hit targets and the durable claim; the Zen renderer owns actual
flower geometry and transient regional pose. The API closure has no imports,
atlas, renderer, generation or storage dependency. The public-entry guard keeps
app code out of the private Plume geometry and validates this narrow export set.

## Zen Shishi geometry and motion seams

Zen's Garden control and its restrained 200ms left-surface reveal are exposed by
`src/themes/plugins/zen/api/gardenWorkspace.js`. This narrow presentation entry
exports `ZenGardenModeControl`; app-owned Garden request/route admission stays
outside the theme. The rail owns click, keyboard and bounded horizontal drag,
captures pointers only after the swipe threshold, and respects reduced motion.
Its CSS consumes projected theme typography and Zen surface/edge tokens. It
loads no renderer, storage, policy or statistical model.

`src/themes/plugins/zen/widgets/tools/recipes/zenShishiOdoshiGeometry.js` owns
shared Shishi coordinates. SVG/Pixi presentation and the pure physics recipe
import it directly; scene JSX does not re-export a second access path.
`src/themes/plugins/zen/api/shishiOdoshiPresentation.js` remains a narrow public
projection of ground-impact geometry, without renderer/physics imports or a
wildcard export. The shared recipe keeps the lip's static origin on a parent
group separate from its Motion translation.

`src/themes/plugins/zen/api/shishiOdoshiMotion.js` is the separate timing seam.
It projects only the pure runtime recipe's requested-pour strike duration.
Gate uses that duration for its cue/conclusion timeline, while the widget
renders the fill, dump and strike from Gate's `pourStartedAtMs` monotonic origin,
rather than accumulated simulation steps. `check:theme-public-entry-boundaries` guards
both API closures. App code cannot import the internal recipe or a renderer.

Gate owns an unstyled native hit area around the accessibility-hidden bamboo,
with a pour/leave accessible name and keyboard activation. There are no separate
visible Leave/Enter controls; foreground waiting submits Continue. The former
`gripControl` slot is retired. A boolean `pourRequested`
selects the Gate's single pour; null leaves the ambient autonomous simulation
with its existing owner. A requested pour requires a finite start timestamp.
The widget has no entry wait or decision authority.
See `intervention-admission-runtime.md` for the document clock and authorization.

Gate imports the shipped L1 typography tokens and consumes the projected L2
UI/mono families. Its layout fits the full Shishi garden with one transform
using both viewport dimensions, reserving space for the destination hostname. An
upper-edge mask bounds and softens incoming water without relocating its source,
lip splash or ground rings. The shared scene recipe owns the warm gravel and
stone materials; no app-local copy of scene geometry or materials is introduced.
The tube recipe derives the shell silhouette from the cut ellipse's tangents.
Its complete annular cut face is painted above the shell, including the outer
edge and end-grain fibers; the back layer clips the recessed cavity and inner
wall to the same canonical mouth. Curved nodes, longitudinal grain and the
closed tail share this shell. Both SVG and the Pixi material compiler consume
these layer definitions, without a second model or app-local repair.
The mouth's foreshortened minor radius lives in the shared geometry leaf, so
the cavity clip and stream capture use the same projected opening. The tail
ends at a terminal node with continuous shell shading and slight longitudinal
patina; it has no separately painted facing disk. Cut-face and node contrast
remain subdued within that same side-view projection.
The same recipe owns the substantial weathered bamboo supports, shallow top cuts,
grain and a wooden axle aligned to the shared tube pivot. The axle projects
along the supports' shared depth angle. Both posts have a through-bore in the
shell and grain clip. Each opening projects the visible near surface, displaced
along the depth axis from the cylinder's centerline by its projected radius.
The full axle is painted behind the tube and posts. The front layer clips the
recessed end grain to the same near-surface bore; no shaft or contact spur is
painted over the tube at the rotation center. SVG and Pixi tube transforms both
read the shared geometry pivot and placement constants. The fixed axle owns
the contact shading; the rotating
tube has no separate black pivot disk. Soft gravel contacts follow the post centers
and cover their planted ends. The geometry leaf owns one shallow floor basis; its
projected depth sets both post tops/feet and the axle direction, and its principal
ellipse sets top cuts and waves. Gravel contacts and the stone shadow retain
the same shallow aspect but stay screen-level, with no bright planted rim that
would read as a sloping plate. The near post is modestly wider (18 units versus
16), with its bore and axle end derived from that same width. The rear post sits
closer to the front post in projection, with equal physical post heights. Gate
consumes this floor projection through the narrow presentation API rather than
a local tilt. The contact stone uses one asymmetrical shell and clipped
surface planes, restrained mineral grain and a lower contact shadow. Shared rock
placement and a shallow vertical compression move the footprint between the two
post depths while retaining the striking crown. SVG's soft shadow and Pixi's
baked soft shadow use that same geometry-owned contact point; SVG and
the material compiler consume the same support/stone recipes.
Lip coordinate diagnostics identify the sole `lip-splash` Motion group through
its named scene-part marker, independently of decorative stone minerals.

Shishi water material is owned by
`src/themes/plugins/zen/widgets/tools/recipes/zenShishiOdoshiWaterMaterial.js`.
The shared SVG recipe uses a transparent cross-sectional gradient and moving
reflection; the Pixi adapter bakes that same recipe once and applies sub-pixel
refraction in its existing shader clock. Broken wave crests, the fixed floor
contact, curved water sheets and refracted teardrops are compiled from the shared SVG
recipe, rather than separate canvas circles/capsules. Both renderers consume the
material leaf's ballistic droplet pose and the runtime recipe's smooth wave
envelope. Ground contact and waves follow the floor projection; the upright water
sheets and three ballistic ground droplets retain vertical gravity. Their contact
point stays fixed while separate width/height envelopes animate the sheets.
The default ground projection flattens waves into the surface plane;
an explicit connected ground projection still supplies its own aspect. Ripple/lip
water colors come from this material, independent of the artifact-family signature used
by surrounding ambient presentation. Fractal/displacement SVG filters, tinted
bloom strips, plasma quality switches and three-turbulence-texture mixing are
removed. There is no retained alternate plasma path. Gate, ambient dashboard,
reference and landing Shishi scenes use the shared recipe. Ground coordinates and the ambient simulation keep their existing owners;
the Gate uses the explicit requested pour described above. Its ground arrival
uses elapsed choice time rather than accumulated ambient filter steps, so a
skipped render cannot postpone contact beyond the short gesture.
The landing closure explicitly admits only the dependency-free water material
leaf alongside the existing Shishi recipe/geometry; it still rejects complete
Tools widgets, their runtime owners, or new undeclared recipe dependencies.

## Installation presentation public seam

`src/themes/core/presentation/installationPresentation.js` is the narrow
dashboard-only lookup for the first committed global Flare installation. It
validates a canonical theme ID and returns that plugin's renderer and palette.
The six plugins own `presentation/installation/*InstallationScene.jsx`; the
app does not enumerate themes or borrow a renderer from another theme.
`installationPresentationContract.js` owns the single nine-second visible-time
shot table and typed frame projection. This seam does not widen the Main
`current` / `first_vision` scene contract or the generic widget registry.

`src/apps/dashboard/guidance/FurinInstallationPresentation.jsx` owns modal DOM,
keyboard focus capture/restoration, first visible-frame ACK, close/completion
callbacks and the 30 Hz bounded clock. A hidden document pauses the clock and
releases its sound. Reduced motion renders the installed device and boundary
without animation and offers an explicit completion button. The Guidance host
owns eligibility, committed settings validation, presentation claims and all
receipts; render callbacks are not installation or protection facts.

Zen reuses the canonical Furin vector/physics presenter. The other plugins
install native devices: Matrix's threshold node, Entropy's industrial relay,
Cyberpunk's signal beacon, Clinical's monitor and SCP's containment seal. Each
device uses the same hang, quiet, first response and return sequence. The
installation renderer never enters an actual Site Furin or Global Sentinel
session, requests fullscreen, consumes a daily receipt or writes usage.
`check:theme-public-entry-boundaries` requires this seam and rejects feature
imports of plugin installation internals. `check:theme-seam-role-architecture`
requires all six explicit declarations and rejects broadened Main/manifest
dependencies.

## Purpose

This map audits the current theme engine after the plugin cutover. It is not a
new source of truth for Zen internals; it is the repository-level path map for
theme reads, document side effects, registry lookup, shared UI seams, and
fallback-free runtime boundaries.

The practical reading question is:

```text
Can a caller reach the exact theme owner it needs without passing through a
retired broad facade, a top-level shared bucket, or a cross-theme fallback?
```

## System Flow

Theme preference and document application flow through the preference owner and
document side-effect seam:

```text
settings command / page bootstrap / storage-change event
  -> themePreferenceRepository
  -> documentTheme
  -> documentThemeProjection -> DOM data-theme + CSS variables + custom CSS
  -> preference mirror/event
```

Explicit visual fixtures use `src/themes/core/documentThemeProjection.js`
directly. This named DOM-only seam validates the canonical theme ID and uses
the same catalog definition; initialization also removes the legacy document
shape attribute. Its transitive source graph has no settings/storage,
preference, plugin runtime, registry or widget owner. It does not read a stored
theme, write a preference mirror or publish `themechange`. Product
`documentTheme.js` preserves its existing apply/init APIs and DOM -> mirror ->
event -> initialization cleanup order by composing the projection. This is an
explicit presentation boundary, not a settings-read fallback.

Theme data and behavior reads use narrow core seams:

```text
theme-aware caller
  -> catalog -> plugin theme definition
  -> profile -> runtime/profileCatalog -> plugin profile DTO
  -> motion / scheduleVisualPolicy -> pluginCatalog -> plugin manifest
  -> registry -> surfaceDescriptor catalog -> plugin surface descriptor
```

Boot-facing widget/navigation reads use a deliberately smaller graph:

```text
dashboard loading policy / theme widget registry / tab icon lookup
  -> core/surfaceDescriptor.js
  -> runtime/surfaceDescriptorCatalog.js
  -> plugins/<themeId>/surfaceDescriptor.js
  -> frozen widget paths + Main widget owner + tab icon variant
```

Each full manifest consumes those same descriptor fields. The descriptor does not
export a theme object, behavior profile, Schedule policy, or renderer, so a widget
capability/ID check does not acquire the full plugin-manifest graph.

Protection friction has a smaller static owner path because background and
content callers need presentation DTOs, not the complete plugin catalog:

```text
friction runtime
  -> friction/presentationCatalog
  -> plugins/<themeId>/frictionPresentation.js
  -> frozen colors + nudge/friction presentation policy
```

`friction/context.js` must not import `catalog.js`, `profile.js`, or
`runtime/pluginCatalog.js`. Those broad seams include widget and renderer
capabilities that do not belong in the background service-worker closure.

Schedule keeps its semantic and interaction owner in the dashboard app while
resolving the selected theme's required visual declaration through the core:

```text
ScheduleTab
  -> getScheduleVisualPolicy(canonicalThemeId)
  -> pluginCatalog strict lookup
  -> manifest.scheduleVisualPolicy
  -> plugin-owned recipes + typography + tokens + timeline
```

Zen uses one pure world-environment kernel while separating the frequently
refreshed UI paint projection from the stable temporal authority delivered to
render runtimes:

```text
solarLocationProfile
  -> dashboard useDashboardZenAmbientPresentation
  -> zen/api/environment
  -> ZenWorldEnvironmentAuthority
  -> Zen world environment kernel -> immutable snapshot
     -> pure ambient projection -> ThemeAmbientPresentationContext
       -> DashboardLayout shell variables
       -> Zen Home RhythmMarker time/light inscription
       -> Tools ArtifactCanvas + ArtifactRenderer environment channels

dashboard appearance clock mode
  -> ZenTemporalAuthority(realtime | fixed)
  -> ThemeTemporalAuthorityContext
  -> Pond/Bonsai environment control
       -> realtime: stable authority; each logical worker owns its local clock
       -> fixed: one explicit authority delta when the selected epoch changes
       -> same world environment kernel at slow refresh cadence
          -> Pond dynamic projection / Bonsai dynamic + bake projection
```

`ThemeAmbientPresentationContext` is a UI paint projection. Its refresh cadence,
snapshot object, and time bucket must never enter a worker runtime-params key.
`runtime/environment/zenWorldSolarContext.js` resolves the stored location profile
and document timezone before authority construction. The shared sampling kernel
consumes only the resulting authority and cannot import the settings location
catalog; the Home worker artifact guard enforces that boundary.
`zenWorldMaterialPalette.projectZenWorldWeatherSkyPalette` supplies the same
cloud/rain/daylight sky pigment to the Bonsai back layer and ambient garden
inscription contrast. Dawn/dusk and night retain their solar pigment; weather
cannot create a second time phase or per-frame sky texture bake.

Shared widget callers enter through explicit public exits:

```text
dashboard / ui-kit / rule presentation caller
  -> src/themes/core/widgets/shared/<surface>/index.js
  -> shared seam internals
  -> plugin panel or registry consumer
```

The registered Node QA protocol
`scripts/qa/protocols/dashboardSitesIntelJourney.mjs` compares the presented
reading with producer-owned source DTOs and no longer imports the shared
presentation projection. Its former private-leaf import exception is retired;
all external shared Sites callers use the public index. The public index contains
JSX and is not a raw Node entrypoint. `check:theme-shared-seams:architecture`
continues to validate the existing `siteIntelPresentation.js` projection's single
function export, raw Node importability and local-JS dependency closure with no
app, platform, plugin or UI owner. Removing an unused QA dependency does not
widen the shared seam or relax the projection's purity contract.

## Canonical Owner Table

| Concern | Canonical owner | Canonical path | Source of truth | Forbidden shortcut |
| --- | --- | --- | --- | --- |
| Theme id canonicalization | theme core ids | `src/themes/core/ids.js` | canonical theme id list and input-boundary normalization | defaulting unknown runtime theme to another implementation |
| Definition/catalog reads | theme catalog | `src/themes/core/catalog.js`, `src/themes/plugins/<themeId>/theme.js`, Vite `theme-definitions` chunk | canonical theme definitions and catalog preview DTOs without manifest admission | retired broad facade or plugin-manifest read |
| Preference-aware document theme application | document theme owner | `src/themes/core/documentTheme.js` | canonical preference value, mirror/event and existing apply/init ordering | component-owned preference writes or preview fixtures loading preference storage |
| Explicit document theme projection | document theme projection owner | `src/themes/core/documentThemeProjection.js` | validated canonical definition projected to document attributes, CSS variables and custom CSS | preference/storage/runtime imports, stored-theme substitution or component-owned `data-theme` mutation |
| Global theme paint | plugin theme definition plus feature surface owner | `src/themes/plugins/<themeId>/theme.js`, feature-local `data-*-surface` styles | plugin root/shell/owned selectors and explicit `.ui-*` primitives; feature raw-control geometry | `[data-theme] input` / `button` / heading selectors that acquire unrelated feature DOM |
| Behavior/layout profile | theme profile owner | `src/themes/core/profile.js`, `src/themes/core/runtime/profileCatalog.js`, `src/themes/plugins/<themeId>/profile.js`, Vite `theme-profiles` chunk | plugin-owned profile definitions composed by the canonical profile builder; manifests consume the same definitions | direct plugin internals, caller-owned profile maps, or manifest admission for profile reads |
| Friction presentation lookup | friction presentation catalog plus plugin DTOs | `src/themes/core/friction/presentationCatalog.js`, `src/themes/plugins/<themeId>/frictionPresentation.js` | the colors, nudge preset, and friction presentation fields used by protection runtime | importing `catalog.js`, `profile.js`, `pluginCatalog.js`, renderer, or widget modules into friction context |
| Tools artifact visual policy | tools visual policy owner | `src/themes/core/toolsVisualPolicy.js` | named public seam for tools scene spec, artifact surface, and artifact family visual policy composition | adding visual policy bulk or a convenience re-export back into `profile.js` |
| Theme ambient delivery | theme-core presentation context | `src/themes/core/presentation/ThemeAmbientPresentationContext.jsx` | one immutable theme presentation object shared by dashboard consumers | calculating solar state, persistence, or theme substitution in theme core |
| Theme temporal-authority delivery | theme-core presentation context | `src/themes/core/presentation/ThemeTemporalAuthorityContext.jsx` | one stable theme authority describing realtime versus fixed time | using the UI ambient snapshot as a renderer clock or silently assuming realtime when the provider is missing |
| Zen world environment authority and sampling | Zen runtime environment seam | `src/themes/plugins/zen/runtime/environment/zenWorldEnvironmentAuthority.js`, `zenWorldEnvironmentKernel.js`, `zenWorldEnvironmentSnapshot.js` | strict authority revision plus deterministic immutable time/solar/weather/ambient sample | component-owned solar/weather resolution, UI timestamp buckets as authority identity, or a main-thread singleton that pushes every tick to workers |
| Zen solar settings input | Zen document-side environment input seam | `src/themes/plugins/zen/runtime/environment/zenWorldSolarContext.js` | canonical location profile projected into coordinates, world ID and document timezone before authority construction | importing settings location catalogs into worker sampling or duplicating profile resolution in components |
| Zen shell material projection | Zen shell presentation projector and cached ambient-owner seam | `src/themes/plugins/zen/presentation/environment/zenShellMaterialProjection.js`, `zenEnvironmentShellMaterials.js` | shared ambient grammar plus canonical cloud/rain/direct/diffuse light interpreted once per immutable environment as low-chroma architectural paper, semantic surfaces/content/boundaries, and verified contrast (projection v2); ambient CSS and landscape canvas frame consume the same validated DTO via `resolveZenEnvironmentShellMaterials` | component-owned time/weather/color curves, direct projector consumption outside the named ambient-owner seam, per-motion-frame projection, or unverified foreground/surface pairs |
| Zen Sites ledger presentation | Zen selected-notebook components and formatters | `src/themes/plugins/zen/widgets/sites/ZenSiteUsageReading.jsx`, `ZenSiteLedgerAnnotations.jsx`, `ZenSiteLedgerField.jsx`, `ZenSiteDaySlip.jsx`, `ZenSiteLedgerGlyph.jsx`, `zenSiteLedgerFormat.js` | producer-ordered annotations, 24 calendar-hour cells per date, same-surface evidence focus and daily slips using Zen ink/material tokens | UI admission/ranking, fabricated intervals, private clock-color palettes, importing retained Main runtime, or treating missing dates as zero |
| Zen ambient projection | Zen presentation owner and public API | `src/themes/plugins/zen/presentation/environment/zenAmbientPresentation.js`, `src/themes/plugins/zen/api/environment.js` | canonical environment projection to continuous shell/scene light channels plus one validated shell material DTO | app deep import, duplicated solar math, local day/dusk state, or another theme as fallback |
| Zen water-lily presentation reuse | Zen pond flower owner and narrow public API | `src/themes/plugins/zen/pond/world/decor/decorLilyPadWaterLily.js`, `src/themes/plugins/zen/api/waterLily.js` | canonical flower stages, silhouette, palette, and renderer reused by non-pond Zen presentation | domain deep import, copied petal geometry, or a second flower implementation |
| Zen app-wide ambient petals | Zen field renderer, runtime, and retained Home source | `src/themes/plugins/zen/api/petalField.js`, `api/petalSource.js`, `presentation/petals/ZenAppPetalLayer.jsx`, `runtime/petals/*`, `state/useZenAppPetalSourceStore.js` | one dashboard-wide airborne emitter with sparse Home biotic updates and appearance-preserving pond landings | app deep imports, Lab overwriting Home supply, bonsai-origin transit, independent pond spawns, or per-frame cultivation reads |
| Zen artifact control garden reuse | Zen control-rail presentation | `src/themes/plugins/zen/api/artifactControls.js` | the named `ZenArtifactControlGarden` export for Visual Harness control scenes | app imports of internal widgets, wildcard exports, or expanding the seam to artifact runtime/state |
| Zen domain environment projection | Pond/Bonsai projectors | `src/themes/plugins/zen/pond/runtime/core/zenPondEnvironmentProjection.js`, `src/themes/plugins/zen/runtime/environment/zenBonsaiEnvironmentProjection.js` | source revision plus explicit dynamic target/signature and domain bake signature | renderer recalculating solar/weather, time-bucket cache keys, or object-wide implicit interpolation |
| Zen temporal authority | Zen runtime owner and public API | `src/themes/plugins/zen/runtime/environment/zenTemporalAuthority.js`, `src/themes/plugins/zen/api/environment.js` | strict versioned `realtime` or `fixed` authority and semantic signature | timestamp buckets in runtime params, mutable global clocks, or implicit realtime fallback |
| Dashboard Zen ambient clock | dashboard presentation hook | `src/apps/dashboard/presentation/useDashboardZenAmbientPresentation.js` | active Zen dashboard UI refresh plus explicit temporal-authority selection | artifact-canvas/widget timers or ownership of pond/bonsai worker clock lifecycle |
| Schedule visual policy lookup | Schedule policy core seam plus each canonical plugin | `src/themes/core/scheduleVisualPolicy.js`, `src/themes/core/schedule/policyContract.js`, `src/themes/plugins/<themeId>/scheduleVisualPolicy.js` | required pure-data manifest policy containing recipes, typography, tokens, texture blend, and timeline paint | app-local all-theme palette map, executable callback, `themeId === zen` geometry, plugin deep import, or another theme as default |
| Theme sound pack lookup | theme core sound seam | `src/themes/core/sound/resolveThemeSoundPack.js` | strict theme sound pack lookup for app sound cue rendering | app/domain feature code importing plugin sound packs or substituting another theme's sounds |
| Boot-facing surface descriptor lookup | theme surface descriptor seam plus each plugin | `src/themes/core/surfaceDescriptor.js`, `src/themes/core/runtime/surfaceDescriptorCatalog.js`, `src/themes/plugins/<themeId>/surfaceDescriptor.js` | widget loader paths, Main widget owner, and tab icon variant consumed by the full manifest | importing full manifests for widget capability/ID checks or duplicating descriptor fields in a manifest |
| Registry and widget lookup | theme widget registry/loaders | `src/themes/core/registry/index.js`, `src/themes/core/loaders/**` | plugin-owned surface descriptor declarations plus the build-selected module map | appearance/translation/profile ownership in the widget registry, giant import map, or cross-theme widget substitution |
| Background/transition component lookup | theme appearance registry | `src/themes/core/registry/appearance.js`, `src/themes/core/appearance/**` | synchronous background and transition component map | importing appearance into the widget preload registry or resolving widget capability through appearance/profile |
| Zen core research entry selection | build-selected Zen entry modules | `src/themes/plugins/zen/runtime/buildEntries/zenCoreStatusVNext.{dev,public}.js`, `zenCoreStatusClassicExperiment.{dev,public}.js` | dev-only literal research imports and public no-import entry contracts selected by Vite aliases | leaving a literal research `import()` behind a public runtime boolean |
| Zen learning API split | Zen plugin API | `src/themes/plugins/zen/api/learning.js`, `src/themes/plugins/zen/api/researchLearning.js` | background-safe pairwise GP export versus dev research/model exports | routing the background GP service through the research barrel |
| Plugin catalog | theme runtime catalog | `src/themes/core/runtime/pluginCatalog.js` | installed plugin manifests | caller-built plugin maps |
| Profile catalog | narrow theme runtime catalog | `src/themes/core/runtime/profileCatalog.js` through `src/themes/core/profile.js` | installed plugin profile DTOs composed without manifests | importing manifests or theme implementations for behavior/layout reads |
| Surface descriptor catalog | narrow theme runtime catalog | `src/themes/core/runtime/surfaceDescriptorCatalog.js` through `src/themes/core/surfaceDescriptor.js` | installed plugin surface descriptors only | profile/theme/policy/renderer exports or manifest fallback reads |
| Main widget theme selection | plugin surface descriptor | `src/themes/plugins/<themeId>/surfaceDescriptor.js` through `src/apps/dashboard/tabs/main/themeRegistry.js` | `mainWidgetThemeId` used by Main widget resolution | reading `profile.widgets.main` as a second selection owner; the manifest/profile field is compatibility validation only |
| Dashboard route copy | dashboard tab registry plus i18n | `src/apps/dashboard/tabs/registry.js`, dashboard locale namespace, resolved tab object | one localized `navLabel` / `title` / `description` object shared by sidebar and tab surface | dormant theme label catalogs or feature-local alternate route titles |
| Shared rule UI | shared rules public seam | `src/themes/core/widgets/shared/sites/index.js`; `useSitesRegistryModel.js` owns the named public hook | exported rule presentation model/components; shared registry interaction state and frozen comparison; bounded registry window plus caller-declared selected-row identity | importing individual shared rule files from outside the seam, moving app-owned commands/DTO admission/detail loading into the model, or scanning every registry row after a caller has declared selection absence |
| Sites workspace widgets | each canonical theme plugin | `src/themes/plugins/<themeId>/manifest.js` plus plugin-owned `SitesRegistry` / `SitesTargetPanel` wrappers | shared Sites semantics with theme-owned presentation entrypoints | missing widget declarations or borrowing another theme's implementation |
| Shared filter UI | shared filter public seam | `src/themes/core/widgets/shared/filter/index.js` | exported filter scaffold/hooks | importing individual shared filter files from outside the seam |
| Shared preview/home brief UI | shared preview/home brief seams | `src/themes/core/widgets/shared/preview/Common.jsx`, `src/themes/core/widgets/shared/homeBrief/index.js` | shared presentation helpers | recreating a retired top-level themes shared bucket |
| Theme preference state | theme preference repository | `src/themes/core/state/themePreferenceRepository.js` | canonical `app-theme` read/mirror interpretation | raw key interpretation in dashboard/domain code |
| Theme implementation | plugin owner | `src/themes/plugins/<themeId>/manifest.js` and sibling plugin folders | plugin-owned manifest/runtime/widgets/state | `src/themes/components/**`, `src/themes/zen/**`, or another plugin as fallback |

## Function Ledger

| Boundary function | Input | Output | Failure policy |
| --- | --- | --- | --- |
| `normalizeThemeId` / `canonicalizeThemeIdInput` | external or persisted candidate | canonical theme id or candidate absence | allowed only at input boundaries |
| `assertThemePluginId` / `assertCanonicalThemeId` | runtime theme id | canonical theme id | throws on unknown ids; no default substitution |
| `assertThemeDefinitionId` | catalog read id | existing definition id | throws on missing definition |
| `applyThemeToDocument` | canonical theme preference | document attributes, CSS variables, mirror/event | storage read/write failures surface to caller |
| `injectCustomCSS` | selected plugin stylesheet | one document theme stylesheet | CI rejects raw element selectors that cross into feature-owned controls; `!important` does not widen ownership |
| `getThemePluginMap` / `getThemePluginStrict` | canonical theme id | plugin manifest | strict lookup fails loudly on missing plugin |
| `getThemeSurfaceDescriptorStrict` / `hasDeclaredThemeWidget` | canonical theme id and optional widget type | lightweight frozen descriptor or exact capability result | invalid/missing ids throw; missing widget returns `false` and never borrows another theme |
| `getThemeFrictionPresentation` | canonicalizable theme candidate | frozen theme-owned friction DTO | missing presentation or required colors/profile fields throw `FRICTION_PRESENTATION_*`; no plugin catalog or renderer lookup |
| `createThemeManifest` | explicit canonical theme declaration including the theme-owned icon contract | frozen plugin manifest | missing `contracts.copy.tabIcons` fails at construction; no implicit standard icons and no retired `createThemePack` alias |
| `resolveZenAmbientPresentation` | canonical solar location profile plus current epoch | immutable solar-derived Zen ambient presentation | invalid time/environment fields throw named Zen ambient errors; no hard-coded day or cross-theme substitute |
| `resolveZenAmbientRefreshIntervalMs` | valid Zen ambient presentation plus document visibility | canonical UI refresh interval | missing/non-Zen presentation throws `ZEN_AMBIENT_PRESENTATION_REQUIRED` |
| `buildZenTemporalAuthority` / `requireZenTemporalAuthority` | explicit `realtime` mode or fixed epoch | frozen versioned authority with canonical semantic signature | missing provider, invalid mode/epoch, or forged signature throws a named `ZEN_TEMPORAL_AUTHORITY_*` error |
| `buildZenWorldEnvironmentAuthority` / `requireZenWorldEnvironmentAuthority` | canonical world, clock, location, and weather facts | frozen signed world authority DTO | missing, non-canonical, extra, or forged payload throws a named `ZEN_WORLD_ENVIRONMENT_AUTHORITY_*` error |
| `sampleZenWorldEnvironment` | valid world authority plus optional epoch and cause tuning | immutable snapshot with authority revision and sample ID | resolver/schema work is restricted to slow sampling boundaries; no runtime fallback or cross-theme substitute |
| `projectZenPondEnvironment` / `projectZenBonsaiEnvironment` | valid authority or world snapshot | domain target plus deterministic dynamic/bake signatures | source identity is mandatory; dynamic-only changes must not invalidate unrelated static layers |
| `createScheduleVisualPolicy` | plugin-owned schedule visual declaration without a caller-supplied version | frozen factory-versioned policy | invalid theme ids fail the canonical theme-id assertion; invalid recipes, typography, tokens, texture blend, or timeline fields throw `SCHEDULE_VISUAL_POLICY_FIELD_INVALID` |
| `resolveScheduleRecipeVariant` | recipe axis, selected variant, exhaustive handler map | app-owned visual/layout interpretation | missing current/future handlers and undeclared/unsupported variants fail loudly; there is no final-branch default |
| `getTabIcons` | canonical theme id plus surface-descriptor icon variant | complete tab icon set | unknown or incomplete variants throw named errors; reads do not borrow `standard` |
| `getScheduleVisualPolicy` | canonical theme id | selected manifest's required Schedule policy | missing or mismatched policy throws `SCHEDULE_VISUAL_POLICY_REQUIRED:<themeId>`; no Zen/default substitution |
| registry widget/boot lookup | theme id, widget/variant key | declared loader/module | missing declarations or invalid modules are explicit failures |
| `loadZenCoreStatusVNext` / `loadZenCoreStatusClassicExperiment` | selected release profile | dev lazy research module or public build-time absence | only dev entry modules contain literal dynamic imports; public entry modules contain no research module reference |
| `SitesRegistry` / `SitesTargetPanel` surface-descriptor lookup | canonical theme id | explicit plugin-owned Sites widget pair | every canonical theme declares both; no cross-theme substitution |
| `useSitesRegistryModel` through the shared Sites public seam | admitted registry/recording DTOs, policy fingerprint, selected domain, controlled scope, presentation state, and app callbacks | query/management/sort state, scope/search/registration dispatch, and frozen registry comparison shared by Standard and Zen presentation | invalid registry shape, fingerprint, scope, or activity-day usage throws; ordinary facts polling preserves comparison, while membership/selection/window/policy/sort changes recreate it; commands, canonical DTO admission, and selected-detail queries remain app-owned |
| `SitesRegistryList` | ordered registry items plus optional caller-resolved `selectedIndex` | initial bounded row window plus at most one pinned selected row | explicit `-1` means selection absence and skips element inspection; only an omitted index retains the compatibility element-detection pass |
| `resolveThemeSoundPack` | canonical theme id | theme-owned sound pack | missing pack is explicit failure; app sound runtime may report bounded sound failure, but must not borrow another theme pack |
| shared seam index exports | public shared concern | stable exported UI/model helpers | external deep import is a CI failure |

## Recovery Versus Fallback

| Class | Allowed? | Rule |
| --- | --- | --- |
| Input-boundary theme alias normalization | Yes | Legacy aliases may be canonicalized immediately at the boundary |
| Missing persisted theme candidate | Bounded | Treat as candidate absence only where the preference owner documents that behavior |
| Strict runtime theme substitution | No | Runtime boundaries assert canonical ids and must not fall back to another theme |
| Missing Schedule visual policy | No substitute | Every canonical manifest declares one policy; resolver failure is caller-visible and never borrows Zen or another plugin policy |
| Missing Zen ambient presentation in canonical Zen canvas | No substitute | surface the contract failure; do not assume day, restore a mode toggle, or borrow another theme environment |
| Missing Zen temporal authority in a canonical Zen render runtime | No substitute | surface `ZEN_TEMPORAL_AUTHORITY_REQUIRED`; do not silently enable a local realtime clock |
| Missing or forged Zen world environment authority | No substitute | surface the strict world-authority error; do not rebuild it from renderer defaults, an ambient presentation, or a timestamp bucket |
| Non-Zen/direct generic artifact environment | Neutral unavailable channel | theme-neutral render context may expose `environment.available === false`; this is not valid input for the canonical Zen canvas |
| App-local cross-theme Schedule map | No | Theme plugins own their declarations; the app interprets resolved recipe/token contracts without enumerating canonical themes |
| Global raw-element theme skin | No | Plugin customCSS targets root/shell/plugin-owned selectors or explicit `.ui-*` primitives; feature surfaces own raw control geometry |
| Manifest `widgets.fallbacks` / `bootLoaders.fallbacks` / `bootShells.fallbacks` | No | Cross-theme substitution is forbidden |
| Public research entry disabled at runtime | No | Public source selection removes the import itself; a false flag around a literal dynamic import is still a packaging regression |
| Missing theme sound pack or sound cue | No substitute | Sound runtime reports a missing pack/cue diagnostic instead of borrowing another theme's sound |
| Top-level `src/themes/shared/**` | No | Shared theme UI lives under `src/themes/core/widgets/shared/**` public exits |
| Retired broad facade entrypoints | No | Do not reintroduce broad top-level theme facade files or a core index facade |
| Test-only plugin internals | Bounded | Tests may target plugin internals; app/domain/platform/ui-kit code must use public seams |

## First-Pass Findings

### F1. Theme public seams are already guarded

Status: keep.

The active guard set blocks broad facade imports, plugin widget internals from
non-theme callers, shared seam deep imports, manifest widget fallbacks, app-level
Sites widget substitution, and boot loader fallback declarations. Every canonical
theme must declare both Sites widget loaders, and `SitesTab` must surface a
diagnosed missing-widget state before workspace rendering. This matches the
current-only architecture in the system document.

### F2. Top-level theme README still implied a retired shared bucket

Status: fixed in this pass.

`src/themes/README.md` described `shared/` as a normal top-level theme folder,
but the current tree does not have `src/themes/shared/**`, and CI treats that
path as retired. The README now points shared callers to the canonical
`core/widgets/shared/**` public exits instead.

### F3. Top-level theme entrypoints stay narrow

Status: watch.

`src/themes/base.js` and `src/themes/utils.js` are narrow current entrypoints.
Artifact identity/color roles use
`src/themes/core/tools/artifactColorSystem.js` directly; the retired
`artifactSignatures.js` facade does not exist. New cross-module needs use
`core/catalog.js`, `core/documentTheme.js`, `core/profile.js`, `core/motion`, or
a new named seam.

### F4. `profile.js` remains a large owner

Status: partially reduced; follow-up inventory remains.

The profile owner carried behavior/layout lookup plus tools artifact visual
policy composition. Size alone was not a failure, but tools scene specs,
artifact surface policy, and artifact-family visual overrides are a real owner
line separate from plugin profile lookup.

Resolution:

- `src/themes/core/toolsVisualPolicy.js` owns tools artifact visual policy
  composition, scene spec overrides, artifact surface policies, and strict
  tools policy theme-id assertion.
- `src/themes/core/tools/artifactColorSystem.js` owns canonical artifact-id
  keyed color families and role tokens for artifact, control, navigation, and
  scene presentation. Gallery order and protection-domain catalogs do not own
  theme color selection.
- `src/themes/core/profile.js` remains the behavior/layout profile public seam
  and re-exports `getToolsVisualPolicy` for existing public callers.
- shared artifact visual profile code now imports the tools visual policy owner
  directly instead of pulling the broad profile seam.
- `check:tools-scene-normalization` and `check:theme-seam-role-architecture`
  require the new owner split.

Remaining follow-up: if profile grows again, split only along real owner lines
such as behavior policy or layout policy. Do not create a second profile facade
that callers can use interchangeably.

### F5. Global theme paint no longer owns feature controls

Status: fixed, including the Schedule visual-policy extraction.

Zen customCSS previously targeted raw headings, text/number inputs, focus states,
and buttons under `[data-theme='zen']`. Those selectors could override a
feature-owned control's border, radius, background, typography, and transition,
so adding Schedule-local detail did not reliably change the rendered result.

Resolution:

- Zen global paint now targets explicit `.font-heading`, `.ui-input`,
  `.ui-input-alert`, and `.ui-btn` primitives instead of raw HTML elements.
- Schedule marks its surface and fields explicitly and owns the time-field and
  workbench geometry locally.
- `check:theme-seam-role-architecture` scans every plugin `theme.js` and rejects
  direct raw heading/input/select/textarea/button selectors below `[data-theme]`.
- Every canonical plugin now declares a schema-validated, frozen
  `scheduleVisualPolicy` on its manifest. The plugin owns its recipes,
  typography, tokens, texture blend, and timeline paint as pure data; none of
  those values live in an app-local all-theme table or executable render callback.
- `src/themes/core/scheduleVisualPolicy.js` resolves that declaration through
  `getThemePluginStrict()` and throws
  `SCHEDULE_VISUAL_POLICY_REQUIRED:<themeId>` when the capability is absent or
  mismatched. It does not normalize to or borrow Zen.
- Schedule keeps recurring-relaxation meaning, draft/edit behavior,
  pointer/keyboard interaction, accessibility, and persistence in the dashboard
  app. Components resolve every declared recipe variant exhaustively rather than
  defaulting to the last branch, and visual recipes do not remove semantic or
  accessibility DOM. Plugin global CSS is forbidden from acquiring Schedule
  ownership through `[data-schedule-*]` selectors.
- Runtime theme reads and tab-icon reads use strict plugin/variant lookup.
  Dashboard route copy stays localized and app-owned; the unused theme label
  catalog and retired broad plugin/pack/runtime facades do not remain as
  compatibility paths.

The visual policy deliberately assumes the current shared Schedule DOM. If a
future theme requires a genuinely different hierarchy, add a separate named
Schedule surface capability backed by the app-owned view-model/action contract.
Do not turn the visual policy into a widget registry, move schedule semantics
into plugins, or make Zen's DOM the implicit default.

### F6. Zen ambient presentation and render time have separate delivery contracts

Status: fixed in the 2026-08-03 temporal-authority pass.

The Zen plugin now owns a pure ambient projection over its existing canonical
solar environment and exposes it through `api/environment.js`. The dashboard
owns one visibility-aware UI refresh hook and provides the resulting immutable
object through the theme-core presentation context. Shell paint, the Zen Home
rhythm inscription, Karesansui, and artifact material lighting therefore
consume one time snapshot instead of starting independent clocks. The rhythm
marker uses the projection's canonical `dawn/day/dusk/night` phase and its
ambient rhythm color variables; it does not start a private minute timer or
maintain a second fixed-hour palette.

Render runtimes do not consume that UI snapshot. The dashboard separately
delivers a versioned `realtime` or `fixed` temporal authority. Realtime identity
is stable and Pond/Bonsai resolve time inside their logical worker loops; a
fixed appearance selection sends one low-frequency authority delta. Therefore
the UI refresh timer cannot invalidate Pond runtime params, water assets, or
Bonsai static layers. Bonsai worker static caches use the canonical environment
bake signature, while finer render signatures remain dynamic-frame state.

The Tools gallery no longer owns a persisted or local day/dusk choice.
`artifactRenderContext.environment` carries continuous daylight, night depth,
dawn/dusk weights, warmth, low-sun weight, solar elevation, and light direction.
Non-theme callers may use the Zen public API but CI rejects direct imports of
`zen/presentation/environment/**`.

### F7. Shared Rules registry selection admission is caller-resolved

Status: fixed in the 2026-08-08 loading-cost pass.

Every production theme wrapper already resolves selection from its filtered
registry and passes `selectedIndex`. The shared list now distinguishes an
omitted prop from an explicit `-1`: declared absence renders only the initial
bounded window, while a declared offscreen index adds exactly one pinned row.
The older render-element detection remains available only when the prop is
omitted, so compatibility does not turn the normal no-selection path into an
O(N) materialization pass before the first 40 rows appear.

## Public Release Artifact Boundary

The public widget graph is selected before Rollup builds its module graph.
`@theme-widget-module-map` resolves to a build-profile-specific inventory: the
development map includes plugin `widgets/filter/**` modules for Filter and
Experiment harnesses, while the public map admits production widget directories
only. Canonical manifests still declare each plugin-owned `FilterTest`; the
build-neutral widget loader neither branches on that name nor substitutes another
implementation when its selected inventory has no matching module. Consequently,
public artifacts contain neither the six theme `FilterTest` modules nor
`ThemeFilterTestScaffold`.

`@zen-core-status-vnext-entry` and
`@zen-core-status-classic-experiment-entry` resolve to dev entry modules only
for the dev release profile. Their public modules export build-time absence and
do not mention the research implementation. The public Vite manifest and
packaged files therefore contain zero `ZenCoreStatusVNext`,
`ZenCoreStatusClassicExperiment`, `ZenCoreStatusVNextWorkspace`, or
`VNextPreferenceModel` research entries. Dev keeps the two lazy research
imports.

The background learning path uses `zen/api/learning.js`, whose contract is the
pairwise GP model needed by the background service. Research workers and UI use
`zen/api/researchLearning.js`; they do not widen the background API. Likewise,
friction runtime reads the pure-data presentation catalog, so plugin manifests,
widgets, pond renderers, and dashboard components are not background
dependencies.

Rollup may still name true vendor and dashboard-boot leaf chunks, but it does
not manually classify background-kernel or Zen pond modules. Context ownership
is measured from the natural static graph. The build emits project-relative
Rollup `chunk.modules` as `.vite/entropy-module-inventory.json`; public and
context guards join it to the manifest closure, so chunk renaming or merging a
forbidden module into a generic chunk is not accepted as a closure reduction.

## Verification Targets

Use these checks when this boundary changes:

- `npm run check:theme-public-entry-boundaries`
- `node scripts/ci/check-public-build-debug-surface.mjs <public-build-dir>`
- `node scripts/ci/check-context-bundle-budget.mjs <public-build-dir>`
- `npm run check:theme-seam-role-architecture`
- `npm run check:theme-shared-seams:architecture`
- `npm run test:file -- tests/rulesRegistryList.scalability.test.jsx`
- `npm run check:theme-widget:no-fallbacks`
- `npm run check:theme-boot-loader:contract`
- `npm run check:theme-preference:owner-architecture`
- `npm run check:ui-kit:owner-boundaries`
- `npm run check:ui-kit:concept-icons`
- `npm run check:dashboard:owner-architecture`
- `npm run test:file -- tests/themes/zenAmbientPresentation.test.js`
- `npm run test:file -- tests/themes/themeScheduleVisualPolicy.test.js tests/themes/themeWidgetRegistry.test.js tests/themes/themeBootLoaderRegistry.test.js tests/themes/themeRuntimeThemeIdContract.test.js tests/themePreferenceRepository.test.js tests/targetBehaviorPresentation.test.js`


## Retained artifact gallery seam

`core/tools/artifactGalleryRenderer.js` resolves a declared `ArtifactGalleryVisual`
widget for the gallery, otherwise the canonical per-family widget. Zen declares
the shared host; standalone `Artifact_*` lookup is unchanged. Tools critical
preparation includes the host. It receives `artifactRenderContext`, `isEnabled`
and post-submit `onReady`, with no settings-service ownership.

`core/runtime/dashboardRenderRuntime.js` is the narrow dashboard theme-lifetime
seam. Zen retains the admitted physical session and its artifact channel; the
other canonical themes explicitly declare `not_declared`. It accepts canonical
ambient presentation input and exposes prepare/release only. It does not own
storage, Main readiness, an alternate renderer, or a cross-theme substitution.
UI module preparation remains in `core/tools/artifactGalleryPreparation.js`.
