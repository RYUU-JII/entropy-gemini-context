# 03. Theme Plugin And Zen

- Status: Active
- Owner: theme architecture
- Last validated against code: 2026-10-10
- Path policy: current-only
- Canonical for: theme plugin seams, public theme access paths, and Zen placement
- Companion repository map: `docs/architecture/repository/theme-engine-boundary-map.md`

## Invariants and current implementation policy

분류 기준은 [Document System](../governance/document-system.md#계약의-성격과-변경-절차)을 따른다.
이 문서의 불변 조건은 theme의 일관된 canonical identity, theme-neutral core와
plugin 구현의 책임 분리, 누락된 theme 계약의 명시적 실패, 다른 theme 구현으로
대체하는 cross-theme fallback 금지다.

현재 지원하는 `matrix`, `entropy`, `cyberpunk`, `clinical`, `scp`, `zen` 목록과
구체적인 경로, 파일, public seam, manifest와 chunk 구성은 현재 구현 정책이다.
현재 정책도 구속력 있는 계약이며 기존 guard의 차단 대상으로 유지된다. 변경은
불변 조건을 보존하면서 구현, 소유 문서와 guard를 함께 갱신한다. Theme ID는
저장된 사용자 선택과 제품 계약에도 참여하므로, 구현 정책이라는 분류만으로
자유롭게 이름을 바꾸거나 제거할 수 없다. ID 변경은 저장 데이터와 소비자의
계약을 함께 다루며 기존 storage 전환 요건을 따른다. 아래의 상세 owner와
public entry 계약은 이 분류로 완화되지 않는다.

## Purpose

theme 시스템과 Zen의 현재 채택된 구조를 정의한다.
핵심은 `theme core + plugin manifest`와 `Zen one-home`이다.

### Utility CSS owner

Tailwind 4 compiles through `@tailwindcss/vite`; `tailwind.config.js` remains the
explicit utility-token declaration loaded by `styles/tailwindTheme.css` with
`@config`. That CSS seam owns the product-only `@source` inventory. The config
consumes `styles/tokens/utilityColorPalette.js` as fixed app colors and retains
the established radius, blur, shadow and L2 `--font-theme-*` family bindings.
There is no Tailwind 3, PostCSS plugin, autoprefixer, or runtime configuration
fallback. Dashboard imports preflight plus its explicit app defaults from
`styles/tailwindPreflight.css`; Gate imports utilities without dashboard resets.

The framework theme variables use the `theme` cascade layer. App styles and
compiled utilities intentionally share the unlayered specificity cascade so
theme `:where(...)` typography cannot outrank the `font-*` utilities. Dashboard
component geometry lives in `apps/dashboard/dashboardStyles.css`, followed by
the utility import. Framework upgrades must preserve this order and the emitted
CSS contract in `tests/tailwind4ThemeContract.test.js`. Outline utilities retain
forced-colors visibility via `outline-hidden`; gradients declare sRGB explicitly.

Dashboard shell geometry in `styles/console.css` projects the theme's existing
`--console-content-overflow` onto the content wrapper as well as its panel.
The wrapper must not independently crop theme-owned exterior chassis paint;
`MainPanel`'s transition profile owns tab clipping, and the theme's frame owns
outer canvas cropping. Entropy's two chassis halves consume one plugin-owned
bezel shadow, including its half-pixel ink rim, so their painted outer contours
agree without changing the six-pixel layout border. Entropy and Cyberpunk restore
both inline borders and remove landscape-only side clipping when their panels
stack in portrait; the shared dock separator and portrait gap retain their owners.
Portrait-desktop navigation keeps its 68px outer dock. Its buttons and settings
group fill the controls content box rather than assuming a fixed 52px inner
height; each theme's actual border determines the available space. The dock
sidebar has no padding: its controls own the single 8px inset, so landscape
sidebar padding cannot consume the same fixed-height space a second time.

### Current Home bonsai scope (2026-09-27)

Main/Home and Experiment default to `plume`; `g15_4` is an explicit comparison.
The [product engine owner](../architecture/themes/zen/zen-g15-product-engine.md#plume-adoption-owners--2026-09-27)
defines the promoted Plume study, life-state adapter and signed display-plan seam.
`resolveZenClassicBonsaiRenderBackend()` selects `pixi_plume` in the existing Home
worker's bonsai logical channel. Shared flower tiles and ordered wood textures
consume materialized geometry. The private F4/study generation and life projection
execute in the strict, nonpersistent `zen_bonsai_model` compute surface. Its
requesting mounted hook retains the completed seed study and latest projection
through tab parking while the task-active worker releases its lease on idle or
parking; no hidden computation runs, and seed/model changes or unmount discard
the retained DTO. The Main descriptor does not import generation. Product source
does not import detached research files.

The Classic2 candidate graph, durable lineage, activation cohorts and fixed
Sakura passes described later apply to explicit comparison consumers. Existing
aggregate identity, five-qualified-day structural release, storage, one-worker
admission and app-wide petal publication owners remain authoritative.

Dashboard's explicit first-bloom touches consume the narrow
`plugins/zen/api/bonsaiFirstBloom.js` region/timing contract. Actual representative
flower coordinates and membership remain in the signed Plume display-plan
compiler; dashboard does not import the private model or a Pixi renderer.
The [Main presentation owner](../architecture/themes/zen/zen-main-presentation-scene-architecture.md#first-bloom-within-current-home)
defines boot/focus admission, the once-only durable claim and transient five-region playback.

## Independent Execution Scope

이 문서는 독립 세션이 직접 수행할 수 있는 execution spec이다.

- 이 문서의 대상은 `theme core/plugin cutover`와 `Zen one-home cutover`다.
- 이 문서의 세션은 theme canonical owner를 실제로 바꾸고, old theme home을 끊어내야 한다.
- manifest나 새 폴더를 추가하는 것만으로는 완료가 아니다.

## Big-Bang Cutover Mode

- theme core는 plugin manifest 기반으로 먼저 고정한다.
- old widget registry canonical path는 같은 세션에서 끊는다.
- Zen은 old dual-home을 유지한 채 새 폴더를 추가하지 않는다.
- 중간에 loader/import/runtime break가 생겨도 old theme owner를 보존하는 방식으로 타협하지 않는다.

이 문서의 목적은 `구조 미화`가 아니라 `theme ownership cutover`다.

## Final Theme Shape

```text
src/themes/
  core/
    boot/
    catalog.js
    documentTheme.js
    documentThemeProjection.js
    ids.js
    sound/
    motion/
    presentation/
      ThemeAmbientPresentationContext.jsx
      ThemeTemporalAuthorityContext.jsx
    capabilities/
    registry/
    loaders/
    runtime/
      surfaceDescriptorCatalog.js
    surfaceDescriptor.js
    friction/
      presentationCatalog.js
    appearance/
    schedule/
    scheduleVisualPolicy.js
  plugins/
    clinical/
      frictionPresentation.js
      manifest.js
      scheduleVisualPolicy.js
      surfaceDescriptor.js
    cyberpunk/
      frictionPresentation.js
      manifest.js
      scheduleVisualPolicy.js
      surfaceDescriptor.js
    entropy/
      frictionPresentation.js
      manifest.js
      scheduleVisualPolicy.js
      surfaceDescriptor.js
    matrix/
      frictionPresentation.js
      manifest.js
      scheduleVisualPolicy.js
      surfaceDescriptor.js
    scp/
      frictionPresentation.js
      manifest.js
      scheduleVisualPolicy.js
      surfaceDescriptor.js
    zen/
      frictionPresentation.js
      manifest.js
      scheduleVisualPolicy.js
      surfaceDescriptor.js
      api/
        environment.js
        landing.js
        learning.js
        researchLearning.js
        structuralAB.js
      runtime/
        buildEntries/
          zenCoreStatusVNext.{dev,public}.js
          zenCoreStatusClassicExperiment.{dev,public}.js
      presentation/
        environment/
        landing/
```

## Theme Core Rules

- core는 capability contract와 registry/runtime orchestration만 가진다.
- core는 일반 plugin 내부 파일 경로를 직접 알지 않는다. Startup-only visible boot shell은 first paint 비용을 줄이기 위해 `src/themes/core/loaders/bootShells.js`의 pre-baked catalog에 명시적으로 mirror할 수 있다.
- giant widget import map은 최종 구조가 아니다.
- widget contract는 explicit plugin-owned loader만 허용한다. 각 plugin의
  `surfaceDescriptor.js`가 widget path, Main widget owner, tab icon variant의 작은
  SSOT이고, full `manifest.js`는 이 세 필드를 descriptor에서 그대로 구성한다.
- dashboard boot/loading/registry는 `src/themes/core/surfaceDescriptor.js`만 읽는다.
  이 seam은 theme object, behavior profile, Schedule policy, renderer를 export하지 않으며
  widget capability/ID 확인 때문에 full plugin manifest graph를 당기지 않는다.
- `src/themes/core/registry/index.js`는 widget lookup/preload만 소유한다. Synchronous
  background/transition lookup은 `src/themes/core/registry/appearance.js`로 분리해 widget
  boot 경로가 appearance → translation/profile → full plugin catalog를 정적으로 횡단하지 않는다.
- public bundle은 descriptor factory/catalog와 plugin별 `surfaceDescriptor.js`를 bootManager가
  이미 쓰는 `dashboard-boot-low-level` manual chunk에 함께 둔다. 이 분류는 broad manifest
  graph보다 먼저 적용되며 full `pluginCatalog.js`와 plugin `manifest.js`는 그 chunk에 들어갈
  수 없다. Definition read는 `catalog.js`가 plugin `theme.js`만, behavior/layout read는
  `profile.js`와 `runtime/profileCatalog.js`가 plugin `profile.js` DTO만 읽는다. Full manifest는
  같은 theme/profile sources를 조립하지만 이 두 read seam의 정적 선행 조건은 아니다.
  Vite는 이 소유권을 각각 `theme-definitions`와 `theme-profiles` manual chunk로 보존하고,
  `pluginCatalog` chunk에는 manifest와 manifest-only policy 조립만 남긴다.
  Plugin별 `frictionPresentation.js`는 broad manifest dependency absorption보다
  먼저 narrow `theme-friction-presentations` owner로 분류해 background friction seam이
  `pluginCatalog`를 당기지 않게 한다. Build artifact/context guard는 bootManager static closure가
  boot-safe descriptor owner를 사용하고 background/boot graph가 full plugin manifest graph를
  포함하지 않는지 module inventory로 검증한다.
- boot loader contract도 explicit plugin-owned loader만 허용한다.
- visible boot shell contract도 explicit plugin-owned shell만 허용한다.
- `widgets.fallbacks` 같은 cross-theme substitution capability는 금지한다.
- `bootLoaders.fallbacks` 같은 cross-theme substitution capability는 금지한다.
- `bootShells.fallbacks` 같은 cross-theme substitution capability는 금지한다.
- missing widget contract는 preload/lookup에서 명시 실패로 surface해야 한다.
- `FilterTest`는 canonical plugin surface descriptor와 거기서 구성된 manifest의 explicit
  development contract로 유지하지만,
  public release의 `@theme-widget-module-map`은 `widgets/filter/**`를 compile-time import
  graph에 넣지 않는다. Dev map만 해당 directory를 포함하며, public loader가 다른 widget을
  대신 고르거나 runtime flag 뒤에 import를 남기는 방식은 허용하지 않는다.
- missing boot loader contract도 variant lookup/preload에서 명시 실패로 surface해야 한다.
- declared visible boot shell module이 resolve되지 않거나 `createBootShellElement()`를 export하지 않으면 명시 실패로 surface해야 한다.
- 모든 canonical plugin manifest는 자기 theme id로 생성하고 freeze한 `scheduleVisualPolicy`를 top-level capability로 선언해야 한다.
- Schedule visual policy lookup은 `src/themes/core/scheduleVisualPolicy.js`의 strict resolver만 사용한다. 누락이나 id 불일치는 다른 theme policy로 대체하지 않고 명시 실패한다.
- full plugin catalog의 runtime read는 `getThemePluginStrict()`만 사용한다. Widget
  capability, Main widget owner, tab icon variant는 lightweight surface descriptor strict
  lookup을 사용하며 manifest도 같은 descriptor에서 해당 필드를 구성한다. Dashboard route
  label/title/description은 i18n tab registry와 그 결과인 tab object가 canonical owner다.
  소비되지 않던 theme `tabLabels` catalog, retired broad `getThemePlugin()`, `createThemePack`,
  pack/runtime facade를 통해 별도 route-copy 진실원이나 fallback을 만들지 않는다.
- definition/profile runtime read는 각각 `assertThemeDefinitionId()`와
  `getThemeProfileStrict()`로 검증하며 `pluginCatalog.js`를 경유하지 않는다. Plugin manifest와
  narrow profile catalog는 같은 plugin-owned `profile.js` definition을 조립하므로 profile
  정책의 두 번째 진실원을 만들지 않는다.
- Tools artifact visual policy는 behavior profile의 convenience re-export를 통과하지 않고
  named public seam인 `src/themes/core/toolsVisualPolicy.js`를 직접 사용한다. 이 분리는
  `theme-profiles`와 manifest-only `pluginCatalog` 사이의 순환 청크를 금지한다.
- theme id fallback은 input boundary canonicalization에서만 허용한다.
- registry, widget loader, boot loader, profile composition 같은 runtime boundary는 canonical theme id를 요구하며, unknown theme를 다른 theme implementation으로 조용히 대체하지 않는다.
- input boundary는 `normalizeThemeId`/`canonicalizeThemeIdInput`로 후보를 canonical id로 올리고, core runtime boundary는 `assertCanonicalThemeId`, `assertThemeSurfaceDescriptorId`, `assertThemePluginId`, `assertThemeDefinitionId`로 이미 canonical인 값을 검증한다.
- nudge/protection message boundary는 외부 payload나 debug override만 `canonicalizeThemeIdInput`로 올릴 수 있다. 비어 있는 override는 canonical preference path로 돌아가지만, 값이 있는 invalid override는 default theme로 조용히 대체하지 않는다. `normalizeNudgeRuntimeContext`가 반환한 뒤의 nudge runtime context, game apply path, worker `SET_THEME`, gate theme presentation은 canonical theme id를 assert한다.
- persisted `app-theme` canonical read failure는 default theme로 덮지 않는다. `themePreferenceRepository`는 invalid stored value만 candidate 없음으로 처리하고, read failure는 caller/boot boundary까지 전파한다.
- 명시적 테마 preview의 DOM-only 초기화는 `src/themes/core/documentThemeProjection.js`가 소유한다. 이미 canonical인 ID를 검증하고 같은 catalog definition의 document attribute, CSS variables, custom CSS를 투영하며 settings/preference 저장소, mirror, `themechange` event를 읽거나 쓰지 않는다. 제품의 `documentTheme.js`는 이 투영을 조합하고 기존 preference mirror/event 순서를 유지한다. Visual harness는 fixture theme를 이 named seam으로 초기화하며 저장된 테마를 대체값으로 사용하지 않는다.

### Friction Presentation Seam

- `src/themes/core/friction/presentationCatalog.js`는 protection runtime이 실제로 쓰는 frozen presentation DTO의 named catalog다.
- 각 plugin의 `frictionPresentation.js`는 필요한 color role, `nudgePreset`, friction style/copy policy만 선언한다. renderer, widget, dashboard component, plugin manifest를 export하지 않는다.
- `friction/context.js`는 이 catalog만 읽고 `catalog.js`, `profile.js`, `runtime/pluginCatalog.js`를 import하지 않는다. 따라서 background gate/nudge 경로가 전체 theme/plugin graph를 정적으로 소유하지 않는다.
- DTO가 없거나 required field가 잘못되면 `FRICTION_PRESENTATION_*` 오류로 실패한다. 다른 theme presentation을 구현 fallback으로 사용하지 않는다.

### Public Zen Research Entry Seam

- `ZenCoreStatus.jsx`와 `ZenCoreStatusClassic.jsx`는 각각 `@zen-core-status-vnext-entry`, `@zen-core-status-classic-experiment-entry`만 import한다.
- dev profile alias는 `.dev.js` entry를 선택하고 해당 entry만 VNext/ClassicExperiment literal dynamic import를 가진다. 이로써 연구·비교 workspace는 dev에서 유지된다.
- public profile alias는 `.public.js` entry를 선택한다. public entry는 연구 module 이름과 `import()`를 포함하지 않으며, runtime false flag 뒤에 import를 남기지 않는다.
- public `.vite/manifest.json`과 packaged artifact에는 `ZenCoreStatusVNext`, `ZenCoreStatusClassicExperiment`, `ZenCoreStatusVNextWorkspace`, `VNextPreferenceModel` entry/file이 0개여야 한다.
- `.vite/entropy-module-inventory.json`은 Rollup `chunk.modules`의 repository 상대 경로만 기록한다. Public/context guard는 이 inventory도 검사하므로 연구 module을 generic chunk에 합치거나 chunk 이름만 바꿔 숨길 수 없다.
- `src/themes/plugins/zen/api/learning.js`는 background pairwise GP에 필요한 `SakuraAdditivePairwiseGPModel`만 export한다. 일반 연구 worker/model surface는 `api/researchLearning.js`를 사용하되 Classic A/B compute worker는 render-free closure만 노출하는 `api/structuralAB.js`를 사용한다. 두 연구 API 모두 public artifact 금지 대상이며 background API를 broad barrel로 되돌리지 않는다.
- MV3 background graph는 static import만 사용한다. service worker `import()`나 manual chunk 이름 변경으로 연구/renderer dependency를 숨기지 않는다.

### Public Theme Widget Packaging Seam

- plugin-owned `surfaceDescriptor.js`의 `widgetLoaders`가 theme-owned widget contract
  선언의 canonical owner다. Full manifest의 `widgets.loaders`는 그 descriptor에서 구성되며
  CI가 descriptor↔manifest 동등성과 dev/public module-map coverage를 함께 검증한다.
  `FilterTest`는 development Filter/Experiment/visual harness가 사용하는 명시 계약이므로
  각 canonical theme가 자기 구현 경로를 계속 선언한다.
- build profile은 Vite의 `@theme-widget-module-map` alias에서만 module inventory를 선택한다.
  Dev map은 filter widget directory를 포함하고, public map은 production widget directory만
  열어 `FilterTest`와 shared scaffold를 Rollup graph에 넣지 않는다.
- `widgets.js`는 `FilterTest` 이름이나 release profile을 알지 않는다. 현재 build map에
  module이 없으면 canonical missing-loader 오류/상태를 반환하며 다른 theme 또는 shared
  preview를 선택하지 않는다.
- public artifact guard는 manifest와 Rollup module inventory 양쪽에서 `FilterTest`를
  금지한다. 따라서 파일명 변경이나 공용 chunk 병합으로 제외 계약을 우회할 수 없다.

### Classic Experiment Learning-State Recovery

- Classic Experiment의 local pairwise GP는 `useZenLearningLab`이 소유하는 단일 writer다. 별도 live bridge/model instance를 함께 load/train/reset하지 않는다.
- `zen_sakura_v2_ab_history`의 canonical envelope는 version 2다. 각 entry는 선택 전에 계산한 strict `prediction` (`pairwiseProbabilityA`, `source=pairwise_compare_pre_feedback`, current writer의 `modelContractId`) 또는 `null`, 그리고 명시적 v1 migration marker 또는 `null`을 가진다. 계약 ID 도입 전 version 2 prediction은 복구/replay를 위해 그대로 읽되 current model reliability 표본으로 인정하지 않는다. 범위 밖 확률, coercion이 필요한 값, 선언되지 않은 extra field는 저장 경계에서 실패한다.
- version 1 history는 일반 read fallback으로 유지하지 않는다. bootstrap migration이 과거 hidden `pick_worse` click을 실제 A/B 선호로 교정하고, score delta와 winner/loser seed를 같은 방향으로 바꾼 뒤 version 2를 즉시 기록한다.
- pairwise model/prediction contract V5는 `preference_basin_v2`의 structural-first 17축과 learning-range normalization을 사용한다. Sakura V2 A/B와 optimizer 후보에서는 이 17축 이외의 canonical latent를 canonical default로 고정해 과거 winner나 Advanced 값이 숨은 confounder로 따라오지 못하게 한다. `scaffold_node_twig_prob`, `twig_length_decay`, `twig_width_decay`, `twig_upward_bias_prob`는 아름다운 골격을 찾는 질문에서 signal을 희석하므로 fixed dressing policy로 제외한다. 구조 전 범위 audit에서 형태 신호가 약했던 `vigor`, `taper_strength`, `scaffold_width_decay`, `ramification_density`도 개인 취향축이 아니라 fixed structural prior로 둔다. 레거시 `preference_basin_v1`은 migration 판독용 25축 계약을 그대로 보존하며, 이 8축 row는 current keyspace 밖으로 분류하고 나머지 호환 evidence만 replay한다. `sakura_generation_semantics_v5`는 explicit `MacroSpineIntentPlanV1`이 rest/flow/articulated event support와 비주기 bend rhythm을 형태 SSOT로 소유하고, bend-aware cubic fit 뒤의 adaptive span을 render-only carrier로 제한하며, biological `structuralMaxDepth`와 physical carrier order `trunkMainDepth`를 분리한 active 의미다. 이 semantics에서 root heading은 수직 constraint이고, curve amplitude/frequency, tilt, sway, kink gate/angle은 각각 curve-event angle, continuous cadence, global posture profile(turn distribution + arc reach), lateral sweep, articulated event에만 투영된다. raw `trunk_main_curve`, `trunk_wave_amp/freq`, `trunk_roughness`는 compile boundary에서 fixed proposal prior로 정규화하며 active Lab controls/presets에는 canonical curve/frequency/tilt/sway/kink 입력만 노출한다. generic branch curvature, legacy roughness, scaffold side identity는 이 trunk learning 축을 mirror하지 않는다. authored/reference guide는 이 intent를 conditioning하고 active guide provenance는 conditioned intent에서 다시 계산한다. 이 의미를 관측하지 않은 V4 이하 row는 현재 형태를 관측한 증거가 아니므로 basin, pairwise replay, prediction reliability에서 `generationSemantics` 사유로 제외한다. 구조적으로 정확한 이전 model 또는 다른 keyspace는 current V5 basis로 reset한 뒤 exact-current semantics history만 oldest-first로 replay한다. `SakuraPairwiseEvidencePolicy`는 controlled within-form preference/cold-start만 latent GP의 live/replay 모집단에 포함하고, exact structural provenance와 versioned morphology evidence를 가진 cross-form discovery는 morphology-only 모집단으로 분리한다. discovery는 global form bias와 coverage evidence를 갱신하지만 basin과 predictive gate 또는 factor attribution에는 들어가지 않는다. 명시적 `BOTH_GOOD` tie는 해당 lane의 sample weight를 history에서 복원하며 UI의 `PASS`는 어떤 model target으로도 변환하지 않는다. 현재 축에서 실제 delta가 없는 legacy row는 학습용 zero vector로 만들지 않고 recovery diagnostics에 skip 사유를 남긴다.
- Neural model v3는 scalar 22개와 32x32 skeleton의 deterministic 8x8 average-pool 64개만 입력으로 사용한다. v1/v2의 1024-cell weight를 새 좌표계로 가장해 옮기지 않고 explicit reset/rewrite하며, optimization admission은 이 보조 neural score가 아니라 controlled pairwise evidence가 소유한다.
- 학습 완료의 진실원은 65차원 점 추정이 아니라 `SakuraPreferenceBasinModel` v2의 선호 영역이다. `SakuraLearningFactorPolicy`가 active/excluded/candidate factor를 분류하고, scheduler는 최근 controlled evidence의 부족 -> 미안정 basin -> stable boundary confirmation 순서로 같은 seed의 단일 축만 묻는다. factor별 persisted spatial ordinal이 explore/broad의 저점·중앙·고점, establish의 monotonic ladder 또는 interior bracket, stable의 accepted boundary를 이동시킨다. establish 매 4번째 질문은 indifference broad와 구분되는 wide spatial probe다. 초기 탐색이 영구히 basin 폭을 오염시키지 않도록 추정은 최근 12개 controlled row를 사용하며, monotonic preference는 서로 다른 중심점과 충분한 관측 span/wide evidence가 있을 때만 stable로 승격한다.
- `BOTH_GOOD` broad probe가 factor별 evidence floor만큼 반복되면 user-indifferent factor로 확정할 수 있다. broad evidence는 일반 recent-12와 별도 최근 ledger를 사용하며, neutral 가능성이 높은 unresolved factor를 broad lane에서 먼저 확인한다. `PASS`는 비교 기권으로만 기록하고 연속 3회면 해당 factor를 일반 질문에서 defer한 뒤 broad recovery lane에서 더 큰 차이로 다시 묻는다. indifferent factor는 일반 confirmation에서 빠지고 독립 broad lane에서 재검사하며, 새 broad decisive answer가 들어오면 즉시 재학습 대상으로 돌아온다. global scheduler cursor와 factor spatial ordinal은 history row cap과 anchor 질문에 종속되지 않는다.
- reliability gate는 active factor별 lifetime 동일 횟수를 강제하지 않는다. 최근 observability-weighted basin evidence, resolved/stable region 비율, 최근 pre-feedback sample/label balance와 calibration, controlled pairwise reliability를 필수 bottleneck으로 평가하며 neural readiness와 active-acquisition AUC는 diagnostic-only다. predictive freshness는 current-profile, current-model-contract controlled non-anchor 질문 160개를 먼저 자르므로 `PASS`도 window를 소모하고, 그 안의 decisive ECE와 `BOTH_GOOD`의 0.5 tie calibration을 분리한다. pairwise gate의 step과 log loss도 이 exact controlled prediction 모집단만 사용한다. reliability는 표본량과 `p=0.5` random baseline 대비 log-loss 개선량 중 더 약한 값이므로, 균형 잡힌 0.5 예측은 ECE나 round 수만으로 통과하지 못한다. cross-form discovery는 latent GP를 갱신하지 않으며 coverage entropy와 morphology posterior confidence로만 별도 보고한다. 반복 tie에서 `|pA - 0.5|`가 큰 posterior와 과도한 controlled pairwise loss는 많은 training step만으로 gate를 통과할 수 없다. 불확실한 경계를 의도적으로 선택하는 stream의 AUC를 unlock gate로 사용하지 않는다. UI 준비도도 가중 평균이 아니라 가장 덜 충족된 필수 gate를 표시한다.
- optimize path는 A/B에서 학습한 latent 좌표를 `BonsaiCandidateEvaluator.modelInput`에 그대로 전달해야 한다. `SakuraPreferenceBasinObjective`는 stable interval 밖에만 soft penalty를 주고 stable midpoint 후보를 1개 보장한다. unresolved factor는 실제 candidate에서도 base 값에 고정하고, indifferent factor만 실제 phenotype의 rule/novelty 탐색을 허용하되 pairwise scoring latent에서는 base 값으로 투영한다. MAP-Elites archive quality와 별개로 global basin-adjusted objective champion을 보존한다. 최신 pairwise state persist, guidance, profile/keyspace 중 하나라도 맞지 않으면 worker 실행 전에 실패한다.

### Structural Morphology Scout

- `SakuraStructuralSpecies.generateStructuralTopology()`은 research-only 골격 생성 seam이다.
  canonical full topology와 같은 trunk/scaffold pass를 사용하되 scaffold 이후
  twig pass, terminal set, canopy bloom layer를 실행하지 않는다. 이 결과는 Main
  identity나 Classic2 lineage를 대체하거나 저장하지 않는다. generation,
  `getPotDimensions`, scene measurement는 이 structural module이 한 번만 소유하고,
  full `SakuraSpecies`는 이를 compose해 Sakura renderer method만 추가한다. 공통 topology
  assembly는 dependency-injected `sakuraTopologyGenerator.js`, trunk/scaffold pass 조립은
  `sakuraTrunkScaffoldGenerator.js`가 소유해 full/structural 구현이 generation logic을
  복제하지 않는다.
- `BonsaiStructuralDescriptorModel`은 render, texture, camera, flower/leaf count를
  입력으로 받지 않는다. trunk root를 pot rim 원점으로 둔 y-down 좌표계와 explicit
  pot bottom을 사용해 lean, path/chord, turn/inflection, descending path, pot-relative
  lowest point, first scaffold attachment, crown band width, drooping tip, structural
  mass를 기술한다. adaptive emission span 수는 morphology feature가 아니다. descriptor는
  전체 trunk를 stable arc 64구간으로 재표본화하고 그중 fixed macro-turn 8구간에서
  mean turn과 inflection을 계산해, 같은 연속 spine의 subdivision만 4개에서 16개로
  바뀌어도 morphology가 달라지지 않게 한다.
- `BonsaiFormClassifier`는 단일 배타 class가 아니라 topology, trunk posture,
  crown behavior의 계층형 membership을 소유한다. `formal_upright`,
  `umbrella_crown`, `slanting`, `informal_upright`, `literati`, `full_cascade`,
  `semi_cascade`, `weeping`, `twin_trunk`, `multi_trunk`는 이 축을 조합한 named
  read model이며 아름다움 점수가 아니다.
- active single-root generation form은 `formal_upright`, `umbrella_crown`,
  `slanting`, `informal_upright`, `literati`, `full_cascade`, `semi_cascade`,
  `weeping`의 정확히 8개다. `BonsaiSingleRootFormCompositionPrior`는 trunk
  posture/curvature, scaffold station density/attachment/side/downward ratio, crown
  envelope, negative-space window를 하나의 composition target으로 만들고,
  `sakuraSingleRootFormCompositionAdapter.js`는 각 target에 한정된 bounded latent
  residual을 더해 같은 form 내부의 취향 변이를 보존한다. classifier는 이 목표를
  생성기로 되먹이지 않는 read model이다. `twin_trunk`와 `multi_trunk`는 현재
  single-root topology에서 fail-loud하며, `low_triangle`은 `formal_upright`의 crown
  composition target이지 아홉 번째 form이 아니다.
- form composition은 명시적 `formCompositionPrior` 또는 `formId + formVariantSeed`
  입력에서만 활성화된다. 입력이 없는 Home 생성은 기존 latent-only 의미를 유지한다.
  full과 structural scout는 같은 canonical plan과 compact provenance를 topology root에
  기록하고, physical trunk subdivision 수가 달라져도 form plan/provenance와 scaffold
  arc attachment는 변하지 않는다.
- full topology 생성의 공통 함수는 `sakuraFullTopologyGeneration.js` 하나다. Main/Home은
  `ZenBonsaiHomeSpeciesRegistry -> SakuraHomeSpecies`의 generation + pot-anchor surface만
  사용하며 `SakuraStructuralABSpecies`, `measureBonsaiSceneBounds`, `SakuraRenderSpecies`,
  main-thread `sakuraRenderer`를 import하지 않는다. Lab의 broad `SakuraSpecies`는 full
  generation, structural A/B, local preview paint가 모두 필요한 surface에만 남는다.
  durable profile identity가 hydration 중일 때의 `treeType: null`은 species 값이 아니라
  unresolved readiness이므로 Home topology owner는 candidate preparation admission 전에는
  species resolution을 보류한다. admission 뒤에는 exact `treeType`을 검증하며 `null`이나
  unsupported 값을 Sakura로 default/fallback하지 않고 명시적으로 실패한다.
- `BonsaiStructuralCandidateEvaluator`는 위 골격 생성과 분류를 묶는 render-free batch
  seam이다. 각 candidate는 `bonsai_morphology_evidence_v1`에 generation semantics,
  descriptor/classifier version, exact target form, 20D vector와 classification snapshot을
  저장하고, 별도의 structural comparison plan에 sampled trunk/scaffold centerline과 exact
  bounds를 저장한다. 이 bounds는 같은 texture-free structural preview segment와 reference
  pot footprint만으로 계산하며 full-scene `measureBonsaiSceneBounds()`나 `ZenPotRenderer`를
  import하지 않는다. latent GP의 입력은 계속 17축 latent이며, morphology preference는
  history의 versioned visual evidence를 replay한 global + per-form posterior가 소유한다.
  global posterior는 exact vector 전체를 학습하고 per-form posterior/form bias는 requested
  target이 아니라 지원되는 classifier primary form에만 귀속한다.
  현재 generator로 과거 row의 descriptor를 재생성하는 fallback은 금지한다. emitted trunk
  factor 배선과 terminal dressing 제외 변경은 generation semantics/keyspace migration으로
  명시한다.
- Sakura trunk geometry의 생성 소유자는 versioned `TrunkPathPlanV1` 안의
  `sakura_macro_spine_intent_bend_aware_v1`이다. topology generator가 explicit
  rest/flow/sweep/knuckle/compound event plan을 한 번 materialize하고 bend-aware fitter가
  그 constraint를 exact cubic carrier로 전달하며 trunk pass는 validated span과 arc interval을
  emit하기만 한다. legacy 32-step segment flow는 `sakura_segment_flow_proposal_v1`
  ablation/proposal API에서만 호출할 수 있고 active morphology 또는 attachment truth가 아니다.
  curve/taper, kink/noise를 branch generator나 pass에서 다시 계산하는 dual path는 금지한다.
- procedural latent guide의 `trunkKinkChance`/`trunkKinkAngle`은 한 integration step에 회전량을
  주입하지 않는다. `sakuraTrunkArticulatedBendFlow.js`가 32-step intent arc에서 사건 발생과
  cooldown을 결정하고, geometry-only `sakuraArticulatedBendKernel.js`가 `sweep`,
  `knuckle(shoulder/core/shoulder)`, `compound(two knuckles + zero-turn bridge)`의 총 회전각을
  유한 support에 분배한다. micro station은 node ID, scaffold station, RNG 소유권을 만들지 않는다.
- `sakuraMacroSpineGuide.js`는 root-to-apex stroke를 normalized maximum arc length에서 자르고
  곡률과 감쇄 간격을 반영한 3–7개 editable macro anchor로 단순화한다. 단순화는 한 점짜리
  V corner보다 같은 부호의 finite-turn region을 먼저 찾고 shoulder/core/shoulder 후보를
  남겨 C/ㄷ형 관절이 사람에게 편집 가능한 macro evidence로 유지되게 한다. anchor chain은
  shared tangent를 가진 exact C1 piecewise cubic Bézier guide로 fitting한다. authored guide의
  `adherence`는 같은 arc station에서 관측한 procedural latent guide와 혼합하며 0은 latent,
  1은 authored shape를 뜻한다. active emission은 곡률/flatness 오차에 따라
  min 8 / base 12 / soft 32 / hard 48 범위에서 guide를 adaptive subdivision한다. 초기 구간과
  curvature split은 arc midpoint를 사용한다. canonical `targetAdjacentArcRatio=4`는
  hard cap 48 안에서 tiny residual/long-span 접합을 줄이는 best-effort 품질 목표다. hard cap은
  생성 유효성의 최종 절대 계약이므로 목표 비율을 달성하지 못해도 valid guide를 실패시키지
  않는다. 결과는 `achievedMaxAdjacentArcRatio`와 `arcBalanceLimitedByHardCap`으로 포화 상태를
  명시한다. macro
  anchor, exact cubic shape, emitted span은 서로 다른 계약이며 span 수를 사용자 편집점 수나
  scaffold 밀도의 진실원으로 사용하지 않는다. fitted subcubic의 두 control point는
  `exactCubicControl`의 local along/normal carrier로 topology, structural preview, bounds,
  descriptor, Canvas/Pixi renderer까지 전달하며 scalar `curveIn/curveOut` 재근사로 guide를
  다시 바꾸지 않는다.
- `sakuraScaffoldArcStationPlan.js`는 scaffold attachment의 active owner다. `stationId`는
  role과 stable selection key로 lineage/RNG를 고정하고, `placementId`만 guide shape,
  `arcNorm`, side를 포함해 편집 결과를 식별한다.
  `resolveSakuraTrunkMacroStationGeometryV1()`은 continuous macro shape의 global arc에서
  root x/y/tangent/taper width/turn sign을 직접 표본화한다. trunk pass의
  `trunkSpanRegistry`는 각 adaptive interval의 render parent와 local `t`만 제공한다.
  physical span geometry/RNG, segment index/depth projection, scheduled scaffold depth,
  nearest-depth fallback, subdivision에 따라 다시 뽑히는 scaffold RNG는 금지한다.
- Classic Single의 `ZenSpineGuideEditor`는 render-local ephemeral draft다. root에서 apex까지
  그린 뒤 3–7 macro anchor를 drag/keyboard로 보정하며, 같은 draft를 지우지 않고
  `Sculpted`와 `Inspired` 해석을 바꾼다. 기본 `Sculpted`는 기존 `adherence`로 authored guide와
  procedural latent guide를 직접 혼합한다. `Inspired`는 기본 likeness `0.72`인 canonical
  `zen_sakura_spine_reference_family_v1`을 만들고, family identity와 topology seed에서
  deterministic low-frequency tangent/normal variation field를 한 번 표본화한 뒤 C1 cubic guide로
  다시 fitting한다. likeness는 이 sampled guide와 procedural guide의 혼합 강도이며 anchor별
  independent jitter가 아니다. likeness `0`은 exact procedural guide, `1`은 variation 없는 exact
  reference guide이고 중간값만 deterministic family variation을 혼합한다. draft, mode, likeness는
  settings, model state, lineage에 저장하지 않는다. Disable은 편집 draft를 보존하고 Reset만
  제거하며 Collection/full-tree 저장 경로가 두 번째 owner가 되어서는 안 된다.
- `zen_sakura_macro_spine_guide_condition_v1`과
  `zen_sakura_spine_reference_family_condition_v1`은 모두 `fixed_generation_context`다. 둘은
  pairwise latent/factor가 아니며 동시에 전달되면 Trial, controller, evaluator, generator가
  fail loudly 한다. enabled condition은 Single topology와 다음 structural A/B trial batch에
  같은 typed contract로 전달하고 candidate render provenance에도 보존한다. direct guide의
  identity/adherence 또는 family identity/likeness가 바뀌면 진행 중인 A/B batch와 stale pair를
  무효화한다. Active identity의 nullable `spineGenerationConditionId`가 이 context의 identity
  owner이며 genesis/default는 `null`이다. ephemeral Single은 현재 condition ID를 complete
  generation identity에 넣고, ID 변경 시 isolated lineage를
  `ephemeral_preview_identity_rotation`으로 교체한다. durable canonical identity와 condition이
  다르면 fail loudly 하며 draft를 기존 lineage 위에 overlay하지 않는다.
- Inspired A/B pair는 같은 canonical family와 같은 topology seed를 사용하므로 양쪽 candidate가
  같은 `variantGuideId`를 공유한다. latent 차이를 reference-family random variation과 혼동하지
  않도록 packer가 family, topology seed, sampled variant 중 하나라도 다르면 실패한다. 새 round의
  shared topology seed는 다시 뽑히므로 family는 유지하면서 sampled variant는 round 사이에서
  달라질 수 있다. 이 condition과 variant provenance는 비교 맥락일 뿐 학습 latent가 아니다.
- Classic Experiment의 사람 A/B candidate 계약은 `structural_scout_v1` 하나다.
  `TrialContract`의 outer release envelope는 `ZEN_TRIAL_CONTRACT_VERSION=1`로
  고정한다. 이 숫자는 구현 revision이 아니라 공개 후 compatibility generation이므로,
  pre-release 구조 변경을 표시하려고 올리지 않는다. 현재 V1 shape 안에서
  `generationDetail=structural_scout`, `objectiveMode=lane_split`, exact form condition,
  canonical question lane, `generationSemantics=sakura_generation_semantics_v5`를 함께
  고정한다. worker는 coverage-only batch에서 pairwise GP를 로드하지 않고 morphology
  evidence만 계산하며, preference/cold-start batch에서만 latent utility를 함께 계산한다.
  full `TreeAnalyzer`, Neural score,
  bloom/foliage rule을 structural candidate에 투영하지 않는다. Worker import는
  `api/structuralAB.js` 하나로 좁히고 frozen `SakuraStructuralABSpecies`의
  `DEFAULT_Phenotype`, `getPotDimensions`, `generateStructuralTopology`만 사용한다.
  default-full `generateTopology`나 measurement/render method는 이 projection에 없다.
  `researchLearning.js`, full/measured Sakura species, canopy/twig emitters, Sakura/pot
  renderer가 해당 worker artifact에 도달하면 architecture failure다.
- A/B preview는 worker topology를 전송하거나 full topology를 재생성하지 않는다.
  canonical render provenance의 stage topology seed와 exact `formId + formVariantSeed`로
  structural topology를 다시 만들고 plan/form/variant attestation을 확인한 뒤
  `renderBonsaiStructuralPreview`가 cubic wood line과 neutral pot reference만 그린다.
  cubic extrema를 포함한 exact structural bounds로 camera를 맞추고, 한 pair는 더 큰
  candidate가 정한 공통 scale을 사용해 상대 크기와 pot-tree proportion을 보존한다.
  comparison chrome용 safe inset 안에서만 그리므로 각 candidate를 따로 확대해 잘라내거나
  크기 차이를 숨기지 않는다.
  terminal sprite, bark texture, environment animation, `species.render`는 이 경로에서
  금지한다. VNext의 materialized topology도 동일 renderer에서 order 0..2만 projection한다.
- Structural A/B 응답은 Neural training과 full-tree liked/reference collection에 섞지 않는다.
  within-form preference/cold-start 선택만 controlled latent pairwise/basin evidence가 되고,
  versioned morphology evidence가 있으면 global + per-form visual posterior에도 반영된다.
  cross-form discovery 선택은 morphology/form-bias evidence로만 기록하며 latent GP,
  basin, predictive reliability를 갱신하지 않는다. candidate-level rule/novelty는 neutral
  prior다. target proposal count/entropy/ratio, classifier-primary realization,
  threshold를 넘긴 supported membership realization, target membership acceptance와
  global/per-form preference confidence는 서로 다른 진단이다. target 균형을 실제 수형
  realization으로 대신 보고하지 않는다.
- 일반 질문은 same-seed single-factor `preference_basin` 4회 뒤 same-seed
  `structural_discovery` 1회를 배치한다. discovery는 같은 latent와 같은 variant seed에서
  서로 다른 exact form을 묻는 `form_discovery_pair`이며, preference는 같은 form 안에서
  latent 차이만 묻는다. 모든 source pair는 최소 지원 card viewport인 240×240 CSS px와 shared
  scale로 측정한 7.5px visible-distance 하한을 통과해야 한다. 실제 card의 어느 한 축이 240px
  미만이면 지원되는 비교 surface가 아니므로 paint하지 않으며, 미달 pair는 완화하거나 제시하지 않고
  다음 planned proposal을 시도한다. Sobol cold-start는 별도 `sobol_cold_start` lane으로
  보존한다. lane, pair type, form/variant/shared-seed provenance가 trial/context/history에서
  어긋나면 candidate를 조용히 대체하지 않고 실패한다. 다음 lane과 form coverage cursor는
  local React counter가 아니라 canonical history의 non-anchor lane-bearing row에서 복구한다.
  history/cold-start load가 끝나기 전에는 첫 자동 generation을 시작하지 않으므로 reload가
  4:1 cadence를 처음부터 되풀이하지 않는다.
- `BonsaiMorphologyInfluenceModel`은 sampled latent와 named-form membership의
  association을 보고한다. 동일 seed block을 반복한 설계를 우선 사용하며 결과는
  명시적으로 non-causal이다. factor를 실제 원인으로 승격하려면 independent
  structural sampling과 held-out seed 재현이 별도로 필요하다.
- `BonsaiMorphologyDiscoveryModel`은 다변량 structural sample pool의 primary form
  분포, p90 reachability, form별 top sample과 driver를 하나의 read model로 묶는다.
  `diagnose:zen:bonsai-structural-morphology`는 단일축 low/mid/high audit와 Halton
  다변량 discovery를 모두 render-free로 실행한다.
- MAP-Elites의 기존 abstract 2D descriptor는 다양성 reservoir일 뿐 named-form
  truth가 아니다. 향후 form-targeted search는 classifier membership과 form-sensitive
  quality를 목적함수로 사용하고, 사람 A/B는 같은 수형 안의 미적 선택에 사용한다.
- 현재 Sakura topology는 single root만 허용한다. 쌍간/다간을 slider로 흉내 내지
  않으며 shared-root multi-trunk topology 계약과 renderer/lineage 지원이 생기기
  전에는 해당 membership을 production target으로 활성화하지 않는다.

### Classic Full-Render Bounds and Viewport Containment

- Classic2 camera는 mature candidate topology가 아니라 development projection까지 끝난
  실제 paint geometry를 측정한다. `createSakuraRenderPlanV1()`이 visible branch graph,
  exact cubic carrier, life/activation presentation, branch sag, terminal reach·scale·sprite·shadow,
  wood stroke, frontier/surface cue와 bounded wind/motion reserve를 한 번 계산한다.
  `measureSakuraFullRenderBounds()`는 그 immutable plan의 camera 호환 projection이며 topology를
  다시 순회하지 않는다. shared `useZenTreeRenderer` core가 만든 같은 plan identity를
  Canvas2D worker/local preview와 Pixi branch rig에 전달하고 worker는 structured clone 뒤
  재검증·재동결한다. Home은 `useZenHomeTreeRenderer`, Lab/A-B/VNext preview는
  `useZenLabTreeRenderer`에서 서로 다른 renderer hook set을 주입하므로 Main closure가
  local/A-B renderer를 정적으로 import하지 않는다. scene snapshot은 plan이 이미 계산한
  topology signature를 전달받아 검증하고 같은 topology를 다시 순회하지 않는다. structural
  A/B의 별도 texture-free comparison bounds는 full-render fit과 합치지 않는다.
- `useZenBonsaiMainWorkerRenderer`는 첫 scene ACK가 없는 `suppressSceneSync`
  상태와 inactive/no-plan 상태를 `waiting_for_current_plan`으로 기록하고
  controller를 park한다. 이 상태는 first-frame ACK를 만들거나 null plan으로
  scene snapshot을 만들지 않는다. 유효 plan과 scene 동기화가 재개되면 기존
  controller를 사용하며, active/unsuppressed 상태의 missing plan은
  `ZEN_BONSAI_MAIN_ACTIVE_RENDER_PLAN_REQUIRED` 계약 오류다. visibility 복귀도
  아직 보유 scene이 없는 suppressed controller를 임의로 활성화하지 않는다.
- camera는 current paint envelope를 우선 fit하고 maximum-motion reserve가 viewport를 넘으면
  reserve envelope를 fit한다. 이는 임의 padding 확대나 전체 축소 fallback이 아니라 동일
  render-plan geometry의 명시적 두 component다. CSS layout, device-pixel canvas 크기,
  world-to-screen camera projection은 서로 다른 좌표계로 진단한다.
- Home garden-bed는 bed mesh가 frame 밖으로 확장될 수 있지만 tree paint는
  `sceneViewport`의 Canvas2D clip과 Pixi mask를 함께 적용한다. renderer backend 전환이
  containment 의미를 바꾸면 안 된다.
- bounds diagnostics는 world `measuredBounds`, projected render-plan bounds, 방향별 predicted
  overflow, maximum-motion reserve overflow, clip 적용 여부를 노출한다. 실제 alpha는 명시적
  one-shot `tree-only-pre-clip-viewport-device-pixel` 관측 계약으로만 추가할 수 있고 scene,
  commit, render plan, materialization, input, surface generation/size/DPR/backend identity가 모두
  맞아야 한다. 최종 framebuffer나 상시 readback은 허용하지 않으며 결과는 transient다.
  sampler가 아직 연결되지 않았거나 요청되지 않았으면 `observedAlphaBounds=null`,
  `observedAlphaBoundsStatus=not-sampled`를 유지하고 conservative prediction만으로
  Canvas2D/Pixi pixel parity나 100-seed alpha containment가 증명됐다고 보고하지 않는다.

### G15.4 Scene-Command Render Plan

- `src/themes/plugins/zen/model/bonsai/rendering/zenBonsaiRenderPlan.js`는
  materialized topology에서 model-specific plan contract를 고르는 narrow seam이다.
  Classic branch topology만 `zen-sakura-render-plan-v1`로 보내고, G15.4는
  `ZenBonsaiG15RenderPlan.js`의 `zen-bonsai-g15-render-plan-v1`로 보낸다.
- G15 plan은 promoted graph에서 만든 exact scene-command stream, topology/scene
  signatures, device surface, background/pot policy를 고정한다. worker hydration은
  전달된 G15 topology에서 scene을 재구축하여 signatures를 exact 검증하며, Classic
  branch root를 합성하거나 다른 모델을 대체하지 않는다.
- G15.4 Home은 기존 unified `zen_home_renderer`의 `bonsai` logical channel을
  유지한 채 Canvas2D backend를 선택한다. 새 worker나 main-thread fallback이 아니다.
  Home garden-bed는 shared back/front layers 사이에서 viewport-local command stream을
  clip/translate한다. Sakura Pixi branch rig와 Sakura actual-alpha observer는 G15 plan에
  허용되지 않는다.

### Boot Presentation Seam

- `src/themes/core/boot/**` 는 boot presentation named seam이다.
- 이 seam은 theme-aware shared scaffold와 profile catalog만 가진다.
- plugin manifest는 자기 React boot loader module을 `bootLoaders`에 명시적으로 선언한다.
- theme가 dashboard visible boot shell을 커스터마이즈해야 하면 `bootShells`에 pure DOM shell module을 별도로 선언하고, startup path가 manifest graph를 끌고 오지 않도록 `src/themes/core/loaders/bootShells.js`의 pre-baked catalog에도 같은 shell을 mirror한다.
- non-theme caller는 plugin presentation internals를 직접 import하지 않고 `src/themes/core/boot/createThemeBootShellElement.js` 또는 boot loader resolver만 사용한다.

### Shared Theme UI Seams

- `src/themes/core/widgets/shared/**`, `src/themes/core/react/**`, `src/themes/core/motion/**` 는 plugin 간 공용 seam만 가진다.
- 이 seam은 themeBridge의 새 이름이 아니다.
- external caller는 아래 public exit만 사용한다.
  - `src/themes/core/widgets/shared/sites/index.js`
  - `src/themes/core/widgets/shared/filter/index.js`
  - `src/themes/core/widgets/shared/preview/Common.jsx`
  - `src/themes/core/widgets/shared/homeBrief/index.js`
  - `src/themes/core/react/useResolvedThemeState.js`
  - `src/themes/core/motion/index.js`
- shared seam 내부 구현은 `apps/**`, `themes/plugins/**`, `platform/**` owner를 직접 import하지 않는다.
- `src/themes/shared/**` 는 retired path이며, 새 shared UI는 위 public exit 중 하나로만 들어온다.
- shared seam이 runtime/storage/domain facade처럼 자라기 시작하면 실패다.

### Theme Style Ownership

Zen inscription typography uses a locally renamed Noto Serif KR 400–700 subset
registered in `src/themes/styles/tokens/typography.css`. Only Zen's
`tokens.typography.serif`/`calligraphy` opt into it; app-neutral L1 stacks stay
unchanged. The face covers KS X 1001 Hangul and current Korean copy; source,
reproduction and OFL provenance are recorded with the font assets. Rhythm
date/phase inscriptions and the growth slip title consume L2 serif; UI text and
clock digits keep their existing roles. Zen type tokens define an 11px auxiliary
floor, 12px control/caption and 13px descriptive body; locale tracking and case
are consumed by owned surfaces, including portrait overrides. Experiment/tuner
surfaces are not included in this product-surface refinement baseline.

- plugin customCSS는 root token, shell class, plugin-owned selector, 명시적 `.ui-*` primitive만 전역 소유할 수 있다.
- feature surface 내부의 raw `input`, `button`, `select`, `textarea`, heading geometry는 해당 surface가 소유한다.
- `[data-theme] input`, `[data-theme] button`, `[data-theme] h1` 같은 raw element selector로 feature control을 덮는 방식은 금지한다. `!important`는 소유권을 얻는 수단이 아니다.
- shared UI는 의미, 상태, 접근성, 이벤트 계약을 공유할 수 있지만 모든 theme에 같은 frame, header, rail, editor geometry를 강제하지 않는다.
- feature가 theme-specific visual role이나 layout recipe를 필요로 하면 app-local cross-theme switch를 키우지 않는다. 각 plugin이 자기 값을 선언하고 core의 새 named policy seam이 strict lookup하는 구조로 올린다.
- feature-local stylesheet는 `data-*-surface`로 범위를 닫고 raw control geometry를 직접 소유할 수 있다. 이 규칙은 theme 확장을 막는 예외가 아니라 theme 간 CSS 충돌을 끊는 기본 경계다.

### Schedule Visual Policy Seam

- Schedule의 recurring relaxation 의미, draft/edit state, pointer/keyboard interaction, 접근성, persistence command는 dashboard Schedule app surface가 소유한다.
- 각 canonical theme plugin은 `scheduleVisualPolicy.js`에서 자기 `recipes`, `typography`, `tokens`, `timeline` 값을 선언하고, manifest의 필수 top-level `scheduleVisualPolicy` capability로 노출한다.
- plugin policy 선언은 cycle을 만들지 않도록 `src/themes/core/schedule/policyContract.js`의 leaf contract를 사용한다. app caller는 plugin 파일이나 leaf contract를 직접 import하지 않고 `src/themes/core/scheduleVisualPolicy.js`만 사용한다.
- `getScheduleVisualPolicy(themeId)`는 canonical plugin manifest를 strict lookup한다. policy 누락 또는 manifest id 불일치는 `SCHEDULE_VISUAL_POLICY_REQUIRED:<themeId>`로 실패하며 Zen이나 다른 theme를 default로 사용하지 않는다.
- policy factory가 schema version을 소유하고 plugin declaration은 frozen pure data만 제공한다. 실행형 render callback, caller 지정 schema version, app-local background builder는 금지한다.
- recipe consumer는 `resolveScheduleRecipeVariant()`로 해당 axis의 모든 선언 variant를 명시한다. 현재 또는 미래 variant를 처리하지 않으면 `SCHEDULE_RECIPE_VARIANT_UNHANDLED`로 실패하며 마지막 branch를 암묵적 default로 사용하지 않는다.
- texture image, size, opacity, blend mode는 timeline policy가 함께 소유한다. dark-theme white-line texture와 Zen paper texture처럼 paint 전제가 다른 자산을 app hardcode blend mode로 덮지 않는다.
- dashboard Schedule subtree에는 canonical theme 전체를 다시 나열하는 palette/profile map, `themeId === zen` layout branch, Zen visual-role fallback을 두지 않는다. UI는 resolved recipe와 token contract만 해석한다. Recipe는 visible geometry를 바꿀 수 있지만 heading, count, guidance, accessible name/state 같은 semantic DOM을 제거하지 않는다.
- 이 policy는 현재의 shared Schedule DOM에 대한 visual/layout recipe다. theme 하나가 실제로 다른 DOM hierarchy를 요구하게 되면 그때 별도 named Schedule surface capability를 manifest에 추가한다. 그 surface는 app-owned view model과 action contract를 받아야 하며, visual policy를 widget registry나 semantic owner로 확대하지 않는다.

### Zen Ambient Presentation Seam

- Authority/snapshot v2는 `modelRevision`을 identity에 포함한다. 물 재질 tuning은 world kernel 입력이 아니다. `realtime`/`fixed`는 epoch 진행 정책이며 동일 epoch·좌표에는 동일한 로컬 천문 계산을 적용한다. `zenWorldSolar.js`는 실제 일출·태양 정오·일몰·일장과 `normal|polar_day|polar_night`를 보존한다. `zenWorldLunar.js`는 같은 epoch·좌표로 실제 달의 위치·위상·밝은 가장자리 방향을 계산하며, 달빛(`moonlight`)은 달이 떠 있을 때만 0보다 크다. 외형 custom hour도 선택 장소의 IANA timezone에서 epoch로 변환한다.
- 스냅샷의 환경 의미는 `environment` 한 경로에 있다. 중복 `ambient`/`weather`/`baseEnvironment` DTO는 제거한다. `solar`는 천문 원본 및 장소 metadata다. `zenWorldLighting.js`는 solar-only 낮/밤과 직접광·확산광을 구분하고, `directSunlight`에 구름 투과율을 한 번 적용한다. 소비자는 구름량에서 밤이나 태양 차폐를 다시 추정하지 않는다.
- `zenWorldCloudField.js`는 world seed와 absolute epoch 기반의 주기적 128² density field를 소유한다. CPU 태양 ray와 GPU 수면 반사 ray는 같은 bytes/UV/threshold를 다른 방향으로 샘플링한다. 구름량, 태양 차폐, 공기 haze, 물 turbidity는 서로 다른 원인이다. 로컬 procedural weather가 현재 유일한 일반 사용자 날씨 source이며 외부 API/사용패턴 adapter나 실패 시 대체 source는 추가하지 않는다.
- Pond의 저속 solar/weather target은 활성 시 최대 60초, 표시 수치 보간과 작은 cloud scalar sample은 100ms cadence다. 먼저 표시 descriptor를 보간한 뒤 같은 값으로 CPU 태양 투과율을 계산하므로 GPU 반사와 원인이 일치한다. fixed epoch는 구름장도 고정한다. RGB 색과 chromatic weight는 명시된 numeric 채널로 보간하고 Pixi는 색 문자열을 다시 parsing하지 않는다. cloud seed가 같으면 sky texture를 재생성하지 않는다.
- Pond 정적 바탕은 재질 pigment와 수심만 bake한다. 기존 surface-field filter가 linear RGB에서 base material에 조명 응답을 한 번 적용하고, 그 다음 sky reflection/윤슬을 합성한다. 윤슬 shoulder는 추가 radiance만 압축한다. canopy는 동일 geometry에서 direct/sky occlusion을 파생하는 단일 Mesh이며 `open sun >= gap > leaf shade`를 유지한다. SCREEN 틈빛이나 별도 cloud wash sprite는 없다.
- Zen 시간/태양/날씨 계산의 semantic SSOT는 `src/themes/plugins/zen/runtime/environment/`다. `zenWorldEnvironmentAuthority.js`가 strict realtime/fixed authority revision을, `zenWorldEnvironmentKernel.js`가 유일한 pure sampling math를, `zenWorldEnvironmentSnapshot.js`가 검증된 immutable sample identity를 소유한다. Pond, Dashboard, Tools, Bonsai는 태양이나 날씨를 자체 재해석하지 않는다.
- semantic SSOT는 main-thread singleton timer를 뜻하지 않는다. Dashboard와 Home Worker는 같은 authority/kernel 계약을 각 realm의 느린 cadence에서 샘플링한다. realtime authority signature는 시간 경과에 안정적이고 fixed authority signature는 epoch, calendar facts, location, world, weather가 바뀌면 달라진다.
- React realm의 authority delivery는 `useZenWorldEnvironmentAuthority.js` 하나가 소유한다. Pond main은 `useZenPondEnvironmentAuthority.js`에서 tuning을 weather authority로만 투영하고 전체 environment sample을 만들지 않는다. Pond sample/projection은 worker slow path가 소유하며, Bonsai main은 Pond hook을 거치지 않고 `useZenBonsaiEnvironmentState.js`의 전용 projector를 소비한다.
- solar `daylightStrength`는 조도 envelope이며 day/night membership이 아니다. `zenWorldEnvironmentKernel.js`는 태양 고도 기반 day phase와 조도 감소를 분리하고, 해가 떠 있는 동안 낮은 조도를 야간 깊이로 해석하지 않는다.
- `zenWorldAmbientGrammar.js`는 `daylight`, `nightDepth`, dawn/dusk weight, warmth, low-sun, twilight, deep-night weight를 한 번 정의하고 `zenWorldMaterialPalette.js`가 scene material role로 해석한다. Pond, bonsai, terrain, Tools canvas는 같은 ivory -> cedar -> plum twilight -> indigo night spine을 소비하고 각 material은 value/chroma response만 달리한다.
- `src/themes/plugins/zen/presentation/environment/zenShellMaterialProjection.js`는 같은 ambient grammar를 dashboard architectural material로 해석하는 유일한 shell projector다. 컴포넌트별 시간 곡선을 만들지 않고 OKLCH 저채도 response로 frame, L2/L3 paper, semantic surface, text, border role을 한 번 투영한다. 야간에는 원래 재질을 유지한 채 조명에 따른 명도 감소와 남색 기운을 표현한다. 외곽 배경은 짙은 남색까지 도달하고 panel은 focal scene보다 작은 chroma response를 갖는 차분한 청회색 종이로 남는다. 기존 night stop에서 이 응답을 정의하며 별도 dim/tint overlay를 겹치지 않는다. 어두운 잉크와 모든 readable surface 사이의 기존 contrast contract는 유지한다.
- shell projector는 실제 L2/L3 및 semantic surface 전체에 대해 body/muted text 4.8:1, subtle text 4.5:1, strong boundary 3:1을 투영 시점에 검증한다. 개별 카드와 component는 `--color-background`, `--color-surface*`, `--color-on-surface*`, `--color-border*` role만 선택하며 hour, sunrise/sunset, warmth/twilight/night weight, palette anchor를 직접 해석하지 않는다.
- domain projector는 snapshot을 다시 해석하지 않고 필요한 invalidation domain만 만든다. Pond의 `zenPondEnvironmentDynamicTarget.js`는 전역 timeline을 바꾸지 않고 Pond material target만 만드는 named seam이며, projection은 `dynamicTarget`과 no-bake signature를 기록한다. Bonsai projection은 별도의 motion `dynamicSignature`와 coarse chromatic `bakeSignature`를 기록하며 둘 다 source authority revision/sample ID를 보존한다.
- bonsai 정적 레이어 cache identity는 coarse day/dusk/night band뿐 아니라 공용 warmth/twilight/deep-night 진행률을 포함한다. 따라서 같은 light band 안에서 색 곡선이 이동해도 오래된 backdrop texture를 재사용하지 않는다.
- `src/themes/plugins/zen/presentation/environment/zenAmbientPresentation.js`는 `ZenWorldEnvironmentSnapshot`을 light direction, validated shell material projection 및 rhythm-inscription CSS variable로 투영하는 pure Zen presentation owner이며 source environment identity를 보존한다.
- `DashboardLayout`은 검증된 CSS variable set을 Zen world host인 `body`에 한 번 설치한다. `theme.js`는 같은 body scope에서 standard semantic material token을 해석하므로 console subtree와 body portal이 동일한 시간 재질을 상속한다. registered property의 daytime initial value를 ancestor alias가 먼저 확정하는 구조는 금지한다.
- non-theme caller는 구현 파일을 deep import하지 않고 `src/themes/plugins/zen/api/environment.js`를 사용한다. 이 API는 Zen ambient build/resolve/refresh, strict temporal authority, world-environment authority/snapshot 계약만 노출한다.
- `src/apps/dashboard/presentation/useDashboardZenAmbientPresentation.js`가 활성 Zen dashboard의 UI refresh timer와 document visibility 재동기화를 하나만 소유한다. Pond/bonsai worker clock lifecycle을 흡수하지 않는다.
- dashboard의 `dashboardAppearanceClock.js`는 Zen 외형 시간만 `realtime` 또는 `custom`으로 투영하는 pure UI clock seam이다. `realtime`은 실제 epoch를 그대로 전달하고 `custom`은 선택 장소의 같은 현지 날짜에서 표시 시각을 계산한다.
- 외형 시간 mode/hour는 dashboard의 ephemeral presentation state이며 settings, background, tracking, stats로 전파하거나 `globalThis.Date`를 교체하지 않는다. `ZenAppearanceTimeControl`은 이 명시적 value/callback 계약만 소비한다.
- `src/themes/core/presentation/ThemeAmbientPresentationContext.jsx`는 계산 없는 theme-neutral delivery seam이다. `DashboardLayout`, Zen Home rhythm marker, Tools canvas, `ArtifactRenderer`가 같은 immutable presentation을 받도록 할 뿐 solar/storage/runtime owner가 되지 않는다.
- `src/themes/plugins/zen/runtime/environment/zenTemporalAuthority.js`는 render runtime에 전달할 versioned `realtime | fixed` 의미와 canonical signature만 소유한다. UI ambient snapshot이나 refresh bucket은 이 authority가 아니다.
- `src/themes/core/presentation/ThemeTemporalAuthorityContext.jsx`는 그 authority의 계산 없는 theme-neutral delivery seam이다. canonical Zen Pond/Bonsai runtime에서 provider가 누락되면 `ZEN_TEMPORAL_AUTHORITY_REQUIRED`로 실패하며 realtime을 암묵적으로 복원하지 않는다.
- realtime authority의 object/signature는 시간 경과에도 안정적이다. Pond와 Bonsai logical worker가 각자의 local clock으로 연속 환경을 갱신하고, main thread는 UI ambient tick마다 태양 snapshot을 worker에 다시 보내지 않는다. custom/fixed epoch가 바뀔 때만 명시적 environment-authority delta를 보낸다.
- Pond의 environment-authority delta는 `SYNC_RUNTIME_PARAMS`와 별도다. 따라서 시간 변화는 quality/tuning/water asset rebuild를 유발하지 않는다. Bonsai 정적 layer는 fine render tick이 아니라 공용 coarse chromatic bake signature가 바뀔 때만 무효화한다.
- Worker의 frame fast path는 prevalidated target의 명시된 continuous/angular/cyclic field만 bounded numeric interpolation한다. solar/weather resolution, schema validation, palette 생성, 문자열 색 parsing, object-wide numeric discovery, signature 재생성은 target refresh/control 경계에서만 허용한다.
- artifact gallery의 수동 day/dusk button, canvas-local time state, `artifactRenderContext.stage.sceneMode`는 금지한다. material/lighting은 continuous environment channel과 공용 chromatic spine을 해석하며 private warm/night curve를 다시 만들지 않는다.
- Zen ambient presentation이 canonical Zen canvas에서 누락되거나 shape가 invalid하면 명시 실패한다. hard-coded day palette나 다른 theme environment를 fallback으로 사용하지 않는다.

### Zen Sites Ledger Presentation

`src/themes/plugins/zen/widgets/sites/ZenSiteUsageReading.jsx` owns the Zen
selected-domain ledger over the existing shared workspace and query boundary.
`ZenSiteLedgerAnnotations` formats admitted producer output without classification
or ranking; `ZenSiteLedgerField` projects calendar-day hourly facts and focuses
their evidence on the same surface. `ZenSiteDaySlip` opens the selected date's
supplied facts, while `ZenSiteLedgerGlyph` and `zenSiteLedgerFormat` share marks
and precise evidence formatting. Today remains outside completed-date annotations
and averages; missing records and observed zero remain distinct. These widgets
consume the existing Zen ink/material tokens and do not own a clock, environment
projection, retained Main renderer or business-data store. P4 removes the unused
clock-color presentation path and its disconnected consumers.

### Zen Public Landing Presentation Seam

- `src/apps/landing` owns the public journey, semantic chapters, copy, CTA,
  sound consent, and visit-only interaction state.
- `src/themes/plugins/zen/presentation/landing/**` owns the lightweight Zen
  visual projection for that journey. It uses CSS/SVG/Canvas2D and must not
  import dashboard stores, Chrome/storage owners, worker runtime, Pixi, or the
  retained Main pond/bonsai renderer.
- `src/themes/plugins/zen/api/landing.js` is the only non-theme import path for
  the landing stage and strict snapshot projection. `src/apps/landing` must not
  deep-import the landing presentation implementation.
- Landing progress, intention, ritual completion, and sound mode are ephemeral.
  They cannot become progression truth or write any extension storage surface.
- The landing is built by `vite.landing.config.js` into `dist-landing/`; it is
  not an extension page or an input to the CRX build.

### Theme Public Surface

- non-theme caller가 보는 canonical theme read surface는 `src/themes/core/catalog.js` 다.
- document `data-theme` 적용, CSS variable injection, theme mirror/event dispatch는 `src/themes/core/documentTheme.js` 가 canonical owner다.
- behavior/layout policy composition은 `src/themes/core/profile.js` 가 canonical owner다.
- tools artifact visual policy composition은 `src/themes/core/toolsVisualPolicy.js` 가 named owner이며, behavior `profile.js`는 이 concern을 import하거나 convenience re-export하지 않는다.
- Schedule visual-policy lookup은 `src/themes/core/scheduleVisualPolicy.js` 가 canonical public owner다. policy declaration schema, factory-owned version, exhaustive recipe resolver는 plugin-only leaf contract인 `src/themes/core/schedule/policyContract.js` 가 소유하고 public seam이 필요한 항목만 re-export한다.
- Zen ambient presentation과 temporal-authority contract의 non-theme public entry는 `src/themes/plugins/zen/api/environment.js`다. dashboard는 `src/themes/plugins/zen/presentation/environment/**` 또는 `runtime/environment/**`를 직접 import하지 않는다.
- Zen public landing presentation의 non-theme public entry는
  `src/themes/plugins/zen/api/landing.js`다.
- `src/themes/core/presentation/ThemeAmbientPresentationContext.jsx`는 theme-neutral delivery owner이며 environment 계산이나 persistence를 소유하지 않는다.
- `src/themes/core/presentation/ThemeTemporalAuthorityContext.jsx`는 theme-neutral temporal-authority delivery owner이며 clock 계산이나 worker lifecycle을 소유하지 않는다.
- artifact color family와 artifact/control/navigation/scene role token은 `src/themes/core/tools/artifactColorSystem.js` 가 canonical owner다. 색 선택은 canonical artifact id로만 수행하며 gallery index/order와 protection domain catalog는 presentation color를 소유하지 않는다.
- dashboard tab transition, workspace reveal, dashboard state transition, interaction motion policy는 `src/themes/core/motion/index.js` 가 canonical owner다.
- app-owned sound cue가 theme-specific sonic identity를 필요로 하면 `src/themes/core/sound/resolveThemeSoundPack.js` 가 theme sound pack lookup의 canonical owner다.
- legacy broad theme facade entrypoints 는 retired 상태다.
- 새 cross-module need가 생겨도 broad facade를 되살리지 않는다.
- read concern이면 `catalog.js`, side effect concern이면 `documentTheme.js` 에 명시적으로 추가한다.
- 새 concern이 둘 중 어디에도 자연스럽게 들어가지 않으면 새 named seam을 추가한다.

### Theme Preference Owner

- `src/themes/core/state/themePreferenceRepository.js` 는 canonical read owner for `app-theme` 다.
- page-local mirror read/write, settings snapshot normalization, storage-change interpretation은 이 owner를 통한다.
- raw page-local `app-theme` mirror storage access는 `src/themes/core/state/themePreferenceMirror.js` 에만 있으며, repository는 이 helper를 통해 mirror read/write를 노출한다.
- raw storage-change subscription은 `src/platform/storage/internal/chrome-storage/storageChangeBus.js` 를 통해 연결하고, repository는 read/normalize owner로만 남긴다.
- dashboard/theme/domain/background caller는 settings command patch나 storage metadata를 선언할 수는 있지만, `app-theme` 를 직접 해석하지 않는다.
- theme preference와 다른 settings를 함께 읽는 caller도 raw key를 인라인하지 않고 repository query/helper를 사용한다.

### Zen Build-Selected Workspace State

- `@zen-development-workspace-state-entry`는 Zen development workspace page-local state의
  유일한 build-selected projection이다. Dev entry만 `ZenWorkspaceState`를 import하고,
  public entry는 exact import-free `zenDevelopmentWorkspaceState = null` contract다.
- Public Classic/Home/runtime은 `ZenWorkspaceState`, `ZenWorkspaceStorage`, VNext factors를
  static closure에 포함하지 않는다. Development tuning이 없는 public build에서는
  production constants/defaults를 사용하며 development mutation 요청은 named error로
  거부한다.
- 제품 Zen의 pond/visual UI-only page-local state는
  `src/themes/plugins/zen/state/ZenProductionUiState.js`가 좁은 theme owner이고,
  `src/platform/storage/themes/zen/ZenUiLocalStorage.js`가 fail-loud low-level owner다.

## Plugin Rules

- 각 plugin은 `manifest.js` 하나로 자신을 설명한다.
- 각 manifest는 같은 plugin home의 `scheduleVisualPolicy.js`를 필수로 선언한다. policy id는 manifest id와 정확히 같아야 하고 `createScheduleVisualPolicy()`로 검증/freeze되어야 한다. Plugin caller는 schema version을 선언하지 않는다.
- plugin은 자기 폴더 안에 닫힌다.
- plugin은 다른 plugin의 component를 직접 import하지 않는다.
- plugin 내부에는 canonical theme id만 흐른다.
- plugin sound pack은 theme-specific cue/scene descriptor mapping만 가진다. playback lifecycle, page media control, asset intake, storage/settings truth는 plugin sound pack이 소유하지 않는다.

## Final Zen Shape

```text
src/themes/plugins/zen/
  manifest.js
  sound/
  api/
    environment.js
  widgets/
    core/
    sites/
    signals/
    tools/
  runtime/
    classic/
      control/
    preview/
    vnext/
  state/
    classic/
  bonsai/
    state/
      ZenBonsaiProfileAggregateResource.js
    storage/
      ZenBonsaiProfileAggregateRepository.js
    runtime/
  presentation/
    classic/
    environment/
  model/
    bonsai/
    classic2/
    gp/
    latent/
    learning/
    vnext/
  worker-clients/
```

## Zen Persistent State Shape

```text
src/themes/plugins/zen/model/
  ZenBonsaiProfileAggregateModel.js
  ZenBonsaiProfileGenerationGenesis.js

src/themes/plugins/zen/contracts/
  ZenBonsaiClassic2IdentityContract.js
  ZenBonsaiProfileGenerationDefaults.js

src/themes/plugins/zen/bonsai/
  state/
    ZenBonsaiProfileAggregateResource.js
  storage/
    ZenBonsaiProfileAggregateRepository.js
  runtime/
    useZenBonsaiProfileAggregateState.js
    useZenBonsaiActiveProfileState.js
    useZenBonsaiAuthoringDraftState.js

src/platform/storage/themes/zen/
  ZenBonsaiProfileAggregateStorageContract.js
  ZenArtifactRepository.js
  ZenModelRepository.js
  ZenWorkspaceRepository.js
  ZenWorkspaceStorage.js
```

## Zen Rules

### Bonsai Model Role Catalog

`src/themes/plugins/zen/model/ZenBonsaiModelCatalog.js`가 model ID, role,
surface admission, 표시명, surface default의 단일 owner다.

| Internal ID | Display | Role | Allowed surface |
| --- | --- | --- | --- |
| `plume` | `Main · Plume Sakura` | production, 유일한 Main | Home, Experiment default/reset |
| `g15_4` | `Comparison · G15.4 Sakura` | comparison reference | explicit Home/Experiment comparison only |
| `classic2` | `Comparison · Classic2` | comparison reference | explicit Home/Experiment comparison only |
| `classic` | `Comparison · Classic` | comparison reference | Experiment only |
| `vnext` | `Research · vNext` | research engine | Research only |

surface owner는 catalog의 명시적 default를 요청해야 한다. unknown ID와
허용되지 않은 surface/model 조합은 즉시 실패하며 다른 모델로 normalize하거나
fallback하지 않는다.

Plume 제품 엔진과 G15.4 비교 경로의 owner, 연구 승격 경계, lifecycle/scene-command 흐름은
`docs/architecture/themes/zen/zen-g15-product-engine.md`가 소유한다. Classic2의
lineage/storage 계약은 비교·진단 경로를 보호하지만 Main의 topology truth나 실패 시
대체 경로가 아니다.

### Preserved Research Namespaces

다음 숫자 표기는 storage/record/cache contract succession이 아니라 독립적인
model 또는 research algorithm identity이므로 이름을 유지한다.

- `SakuraV2`, `model/v2`, `canonical_v2`, `zen_sakura_v2_*`: Sakura latent-space/model namespace. 그 내부 runtime/cache/record contract version은 별도로 release V1을 사용한다.
- `event_fsm_life_v1`, `event_fsm_life_v2`: Pond Lab의 독립 koi 연구 알고리즘 선택지. 서로의 storage migration source/target이 아니다.
- vNext GrowthVM V1/V2/V3: `vnext` research engine 내부의 독립 연구 변형. Main admission과 persistence를 소유하지 않으며 unknown dispatcher input은 즉시 실패한다.

이 분류는 숫자만 근거로 path/model ID를 rename하지 않기 위한 D-classification이다.

- `widgets`는 thin UI shell만 가진다.
- `presentation`은 view-facing derived state와 formatting만 가진다.
- `runtime`은 orchestration만 가진다.
- `state`는 plugin public runtime/state adapter만 가진다.
- theme/plugin consumers는 Zen workspace page-local state를 `state/ZenWorkspaceState.js`를 통해서만 소비하고, `src/platform/storage/themes/zen/ZenWorkspaceStorage.js`나 `ZenWorkspaceRepository.js`를 직접 import하지 않는다.
- theme/plugin consumers는 Zen model-state seam을 `state/ZenThemeModelState.js`와 `state/ZenModelRepository.js`를 통해서만 소비하고, `src/platform/storage/themes/zen/ZenModelRepository.js`를 직접 import하지 않는다.
- release V1 runtime에는 retired Zen page-local key cleanup seam이 없다. baseline 이전 개발 데이터는 전체 profile reset runbook으로만 제거한다.
- `state/classic`은 durable bonsai owner가 아니다. Classic Experiment의 authoring
  state는 page-local React draft이고 `bonsai/runtime`의 aggregate seam을 통해서만
  Main에 적용된다.
- Classic Experiment Single preview는 측정된 viewport로 explicit
  `lab-preview` garden-bed layout frame을 만들고 공용 CSS/device projection을 거쳐
  local Canvas2D renderer에 전달한다. material 선택은 render-only React state이며
  legacy experimental pot storage나 Home layout hook을 source of truth로 삼지 않는다.
  A/B는 inspector와 garden-bed control을 숨기고 두 후보가 같은 neutral planter와
  full-width no-scroll stage를 공유한다.
- `presentation/classic`은 classic view-facing derived model을 가진다.
- Zen main presentation scenes are governed by `docs/architecture/themes/zen/zen-main-presentation-scene-architecture.md`. The app-level conductor emits a typed `first_vision` or `current` decision, the Zen projection adapter turns it into typed scene projections, and pond, bonsai, graph, and overlay components consume those projections. Components must not decide scene state independently.
- first-viewport boot-frame capture is scoped to the exact scene generation. A
  captured `current` frame is discarded when progression admits a different
  `first_vision` generation; it is never held while waiting for cross-generation
  signatures to converge. First Vision becomes committed only when pond and
  bonsai ACK that same exact generation, after which dwell, cover/petal-fall,
  current-scene commit, progression spent, and artifact disclosure may advance.
- `model`은 pure domain model, optimizer, serializer, learning logic만 가진다.
- `worker-clients`는 worker bridge만 가진다.
- Zen model state는 canonical ModelStateStore key만 normal runtime에서 읽는다.
- `src/platform/storage/themes/zen/ZenThemeModelStateContract.js`는 모든 Zen ModelState key의 release V1 value validator, durable/model/discardable-cache 분류, snapshot include/exclude 결정을 한 곳에서 소유한다. Typed read/write와 IndexedDB snapshot preflight는 같은 registry를 사용하며 unknown key와 wrong-contract durable state는 즉시 실패한다.
- Koi appearance/activity profile은 버릴 수 있는 파생 cache이므로 malformed read는 cold rebuild를 위한 miss가 되고 snapshot에서는 제외된다. 나머지 Zen ModelState key는 정확한 V1 contract가 아니면 export/import할 수 없다.
- `ZenThemeModelState.getValue()`는 read-time default를 받지 않으며 durable/model key가 없으면 실패한다. 최초 실행에서 missing을 해석할 수 있는 경로는 feature owner가 명시적으로 호출하는 `getValueForBootstrap()` 또는 canonical 초기값을 쓰는 `bootstrapValue()`뿐이다. Discardable cache는 이 bootstrap API를 사용할 수 없고 normal read의 `null`을 cold rebuild 신호로 사용한다.
- Zen Main Classic2는 `model/classic2/ZenBonsaiClassic2LineageModel.js`가
  all-parent-causal branch development record/observation provenance를 소유하고,
  `contracts/ZenBonsaiClassic2IdentityContract.js`가 canonical identity
  fingerprint를 소유한다. `contracts/ZenBonsaiClassic2CandidateGraphContract.js`는
  role별 persisted descriptor의 exact shape, 단일 macro trunk, exact reverse child edge,
  role/depth hierarchy, cycle 부재, whole-graph root reachability를 함께 소유한다. root와
  fingerprint는 이 전체 검증 뒤에만 resolve되며 lineage prepare/hydrate와 physical storage
  validator가 같은 owner를 소비한다.
  Sakura generator는 continuous macro guide identity/arc length/base width와
  station-root global arc attachment를 topology에 명시하고, lineage preparation은
  이를 최대 2,400-node logical graph와 비저장 physical render binding으로 분리한다.
  render topology traversal은 별도의 2,448-node safety budget을 가지며 두 budget은 서로의
  여유를 사용할 수 없다. Generator는 guide/span count/physical trunk geometry fingerprint를
  `sakura_trunk_macro_render_attestation_v1`로 stamp하고, projection은 branded binding을
  현재 topology와 다시 대조해 exact node coverage/count, root, trunk guide/geometry/arc,
  logical mapping이 모두 일치할 때만 소비한다. Classic2 wood projection은 physical span마다 clock을 만들지 않고
  하나의 continuous global-arc growth frontier와 additive integral을 모든 span에 공유한다.
  `model/ZenBonsaiProfileAggregateModel.js`와
  `bonsai/storage/ZenBonsaiProfileAggregateRepository.js`는 active identity와
  lineage mutation을 하나의 typed ModelState aggregate로 commit한다.
  `platform/storage/themes/zen/ZenBonsaiProfileAggregateStorageContract.js`는
  persisted key와 exact release shape validator를 소유한다. Canonical physical
  key와 aggregate contract는 `zen_bonsai_profile_aggregate_v1`이다.
- aggregate active identity는 Sakura tree type/seed, canonical latent/version,
  structure mode/depth, topology reference height, canonical generation inputs
  (`learningProgress`, canopy distribution, nullable `spineGenerationConditionId`), exact
  `candidateGraphContract`, aggregate-issued
  `identityRevision`을 정확히 함께 가진다. identity fingerprint와 nested lineage의
  identity revision/fingerprint는 이 active identity에서만 유도된다. Genesis/default
  spine condition은 `null`이고 ephemeral authored condition 변경은 complete identity
  fingerprint를 바꿔 isolated preview lineage를 명시적으로 rotate한다. Candidate
  biological descriptor나 macro/station attachment 의미가 바뀌면 graph contract
  cutover와 explicit pre-release profile reset이 필요하다. 같은 guide의 adaptive
  subdivision 변경은 render binding만 바꾸며 identity, request signature, storage,
  CAS를 바꾸지 않는다. 같은 identity 아래 read repair나 암묵적 rotation은 없다.
  현재 articulated-bend/guide-handle cutover는 같은 seed의 guide shape와 station-root
  attachment를 바꿀 수 있으므로 candidate graph contract
  `classic2_macro_lineage_graph_v2`와 development baseline `2`가 함께 소유한다.
  Baseline `1` profile은 aggregate/lineage deep hydration 전에 reset-only recovery로
  진입한다. `exactCubicControl` carrier 자체는 guide shape에서 결정되는 비저장 render
  binding이고 별도의 durable node field나 identity revision을 만들지 않는다.
- aggregate top-level `profileEpoch`는 reserved ModelState profile-epoch row의
  durable reset generation으로 stamp된다. Reserved row가 canonical owner이고 aggregate
  field는 CAS fence다. bootstrap과 모든 identity/lineage CAS는 같은 IndexedDB
  transaction 안에서 reserved row를 읽고 exact epoch equality를 요구한다.
- identity mutation은 complete identity를 받아 expected active identity
  revision/fingerprint를 검증하고, `identityRevision`과 `stateRevision`을 각각 한 번
  올리며, 이전 lineage를 같은 CAS에서 `null`로 만든다. lineage mutation은 그 exact
  active identity를 다시 검증한 뒤 nested lineage와 `stateRevision`만 commit한다.
  Resolver/proposal은 transaction 밖에서 실행되고 conflict latest aggregate는 strict
  normalize 후 최대 네 번 재계산하며 exact-reference no-change는 verify-only다.
  plugin/runtime caller가 generic CAS를 직접 호출하거나 updater-in-transaction
  fallback을 유지하면 안 된다.
- full reset은 durable local `runtime.profile_reset_lifecycle`으로 context write admission을
  먼저 닫은 뒤, background composition factory가
  `model/ZenBonsaiProfileGenerationGenesis.js`를 통해 그 `resetId`용 lineage-null
  canonical aggregate를 준비한다. Genesis는 initial active identity와 aggregate
  조립만 소유하며 mutable aggregate/Classic2 lineage/renderer graph를 import하지 않는다.
  ModelState clear, 새 profile epoch, 새 aggregate는 한 IndexedDB transaction으로
  commit한다. Lifecycle generation은 notification/drain fence이고
  reserved durable epoch가 TOCTOU linearization fence다. Reset 뒤 숫자 revision이
  재사용되어도 old epoch proposal은 새 aggregate를 bootstrap/commit할 수 없다.
- aggregate 외 Zen model state도 context 최초 hydration에서 immutable profile
  generation lease를 잡고, generic get/set/delete/insert-if-missing bootstrap이
  reserved epoch와 canonical aggregate root를 같은 IndexedDB transaction에서 비교한다.
  Generic read/write/bootstrap/CAS는 physically empty store를 initial generation으로
  해석하거나 epoch를 설치할 수 없다. Background bootstrap의 typed profile-generation
  initializer만 pristine store에 exact reserved epoch와
  `zen_bonsai_profile_aggregate_v1`을 한 transaction으로 최초 설치한다. Aggregate
  snapshot/CAS도 lifecycle generation과 reserved epoch 관계를 검증하며 initial
  null/null snapshot 예외를 허용하지 않는다. Read-only
  `assertProfileGenerationInitialized()`가 exact root의 cross-context admission proof를
  제공하고 epoch-blind Store/Repository CRUD는 모두 fail-loud다. Reset/import
  뒤에는 runtime이 새 seed를 합성하지 않는다. resetting/committed/failed에서
  시작된 lease는 completion 뒤에도 재사용하지 않는다. Reset/import 성공 response 뒤
  extension runtime을 reload하고 fresh worker가 새 background model owner를 만든다. Old
  in-memory model에 새 lease를 주거나 같은 worker에서 폐기 후 재생성하지 않는다.
- Zen AB/optimizer worker client는 이미 Dashboard realm에 bind된
  `ZenModelRepository` generation을 최초 요청에서 한 번 capture하고 모든 model-capable
  request에 싣는다. Worker는 첫 request generation에 영구 pin되며 model access 전에
  lifecycle-backed Dashboard repository가 아니라 `ZenWorkerModelRepository`를 그
  generation으로 한 번만 구성한다. Worker repository는 immutable pinned lease만
  소비하고 `ProfileResetLifecycleRepository`, `chrome.storage.onChanged`, Chrome storage
  helper를 import하거나 구독하지 않는다. 모든 typed ModelState read/write는 전달받은
  generation을 `expectedProfileEpoch`로 제출하고 reserved IndexedDB epoch row와 같은
  transaction에서 비교한다. Result/error/progress는
  exact generation ACK를 되돌리고 client는 ACK와 post-response admission을 모두
  재검증한다. Missing/mismatched generation, worker rebinding, old worker의 새 generation
  adoption은 named failure이며 fallback이나 implicit restart로 이어지지 않는다. Pure
  Sobol cold-start 계산은 generation을 pin하되 불필요한 model storage를 열지 않는다.
  Dev worker artifact inventory는 A/B와 latent optimizer closure에 worker-bound repository와
  pinned lease가 포함되고 lifecycle/Chrome-storage composition이 제외되는지 검사한다.
- `ZenModelRepository` 자체도 같은 JS realm에서 다른 generation으로 explicit rebind하는
  요청을 `ZEN_MODEL_PROFILE_GENERATION_ALREADY_BOUND`로 거부한다. React StrictMode처럼
  동일 generation을 재획득하는 경우만 idempotent하게 허용한다. 세대 교체를 위한
  in-place `rotate` API는 없다. Background coordinator가 durable `complete` 뒤 old worker를
  `reload_pending`으로 seal하고 성공 response에 exact handoff descriptor를 반환한다.
  Dashboard의 post-settlement ACK가 durable/local fence를 재검증한 뒤 runtime을 reload하며, fresh worker의 새
  repository만 새 generation을 최초 bind한다.
- current-runtime Home만 aggregate의 durable mode를 사용한다. Experiment는 active
  identity에서 연 page-local draft를 seed/latent/structure/learning step 동안만 바꾸며
  durable write를 만들지 않는다. `Apply to Main`은 complete identity를 정확히 한 번의
  aggregate CAS로 commit한다. First Vision과 debug/read-only presentation scene은
  explicit scene input과 isolated in-memory lineage만 사용하며 aggregate를 읽어 현재
  scene 의미를 덮거나 aggregate에 쓰지 않는다.
- Classic2 candidate topology는 growth 100의 완전한 branch 구조이고 persisted development lineage는 각 branch의 기록/출현 시점과 observation provenance의 진실원이다. 모든 candidate는 최종적으로 존재하며 history score는 topology를 retire/block/delete할 수 없다. renderer와 worker는 이미 투영된 topology만 소비하며 branch membership을 다시 계산하지 않는다.
- Classic2의 current activation은 `model/bonsai/presentation/ZenBonsaiActivationPresentation.js`가 정의한 ephemeral derived value 하나로만 흐른다. `ZenBonsaiExperienceModel`이 canonical scored habit signal에서 이를 만들고 Home scene snapshot이 shared Sakura Canvas/Pixi appearance seam으로 전달한다. activation은 born carrier의 bud/half-open/full cohort, terminal tone/scale/posture, frontier tip cue만 바꿀 수 있으며 lineage identity, persistence, branch/terminal birth, candidate fingerprint에는 들어가면 안 된다.
- Home debug force는 이 하나의 live activation presentation 위에서만 작동하는 render-only projection이다. Force가 없으면 live object를 그대로 유지하고, force가 있으면 같은 canonical presentation factory로 ephemeral 표현만 다시 만든 뒤 같은 scene/Sakura 경로로 보낸다. ModelState, lineage, cultivation, candidate identity를 읽거나 쓰는 두 번째 activation owner가 될 수 없다.
- `model/classic2/ZenBonsaiClassic2GrowthExperienceContract.js`는 wood/carrier/blossom/activation sensitivity의 measurable product target owner다. 진단 matrix는 immutable candidate topology/carrier를 직접 분모로 이 값을 평가하며 growth 100에서 branch/carrier coverage 1을 요구한다. 목표 이탈을 renderer fallback, 자기 자신을 분모로 삼은 작은 최종 상태, 또는 별도 topology truth로 가리면 안 된다.
- Main aggregate/lineage read/write/validation failure를 comparison `classic`,
  depth/hash Classic2 birth, research `vnext`, localStorage, 또는 ephemeral preview로
  대체하면 안 된다. Classic2와 vNext를 Main의 병렬 topology truth로 유지하는 것도
  금지한다.
- release V1 normal runtime에는 canonical ModelStateStore key만 존재한다.
- Zen workspace UI config/tuning과 Sakura runtime flags는 missing-key default만
  허용하고 malformed persisted payload는 즉시 throw해야 한다. Sakura runtime flags는
  `zen_sakura_v2_runtime_flags_v1`의 exact 7-field `version: 1` record와 current
  learning profile만 허용한다. Pre-baseline collision key
  `zen_sakura_v2_runtime_flags`는 active registry와 normal reader에 존재하지 않는다.
  Current key의 predecessor version/profile을 migration하거나 canonical record로
  재저장하지 않으며, pre-release 개발 상태 폐기는 explicit data reset이 소유한다. Zen
  bonsai seed/latent/structure/generation input/revision/lineage는 이 page-local seam에
  들어가면 안 된다.
- `SakuraV2Runtime`의 worker fallback policy는 `strict` 하나만 허용하며, worker failure를 local/main-thread semantic fallback으로 이어 붙이면 안 된다.
- aggregate missing은 Dashboard/theme runtime에서 항상
  `ZEN_BONSAI_PROFILE_AGGREGATE_DISAPPEARED`로 실패한다. Initial identity 생성과 exact
  epoch+aggregate 최초 commit은 mutable runtime admission을 열기 전 background bootstrap
  하나만 소유하며, feature runtime은 default latent나 새 seed로 다시 만들 수 없다.
- Zen bonsai artifact repository는 durable store entry를 strict하게 검증하고 stored
  `treeType`은 정확히 `sakura`만 허용해야 하며, retired legacy localStorage repository
  key를 normal runtime에서 다시 읽지 않는다. Save command에서 tree type 생략은
  `sakura`라는 명시적 기본값이지만 알 수 없는 명시값은 fail-loud다. 모든 artifact
  mutation은 Dashboard-admitted durable aggregate의 exact `profileEpoch`를 요구하고
  `ZenArtifactStore`의 `[zen_artifacts, model_state]` transaction 하나에서 reserved epoch
  compare와 collection delete/put/main-meta put을 함께 수행한다. Epoch-blind individual
  put/delete/meta mutation과 unmount/lifecycle precheck fallback은 없다.
- full reset은 같은 required task 안에서 canonical ModelState epoch/aggregate reset을
  먼저 완료하고 typed artifact clear를 그 다음 실행한다. 따라서 old Dashboard writer가
  먼저 commit하면 clear가 제거하고, reset이 먼저 commit하면 writer가
  `ZEN_ARTIFACT_PROFILE_GENERATION_STALE`로 abort한다. 두 operation을 parallel sibling으로
  배치해 old artifact가 새 profile에 남을 수 있는 ordering을 만들면 안 된다.
- release V1에는 Zen localStorage bonsai business-data mirror, 이전
  `zen_bonsai_classic2_lineage_state_v1`, bootstrap cleanup, migration, read-through,
  또는 dual-write seam이 없다.
- Zen Sobol cold-start cache는 version/profile/TTL mismatch만 cache miss로 취급하고, current-version payload shape 오류는 silent clear 대신 즉시 throw해야 한다.
- Zen Sobol cold-start generation은 feasibility filtering 실패를 deterministic top-up fallback으로 덮지 말고, survivor 부족을 explicit error로 surface해야 한다.
- `SakuraMainSnapshot` import/export는 canonical seed, structure mode/depth, latent
  payload만 허용해야 하며 sanitize/clamp로 malformed snapshot을 살리면 안 된다.
  Main 적용은 aggregate active identity를 한 번 commit하는 owner command이고 seed와
  latent를 별도 write로 나누면 안 된다.
- `SakuraStateReconciler`는 latent를 clamp해서 살리지 말고 canonical latent validator 위에서만 phenotype을 재구성해야 한다.
- `SakuraCompiler`, `SakuraLatentAdapter`, `SakuraSpeciesProfiles`는 canonical latent를 자동 보정하지 말고, unknown profile id나 malformed latent를 compile 시점에 즉시 throw해야 한다.
- `useZenABController` local generation path는 worker gap을 메우기 위해 `trial.latentA/latentB`를 `{}`로 대체하면 안 되며, canonical trial latent가 없으면 그 자리에서 loud failure를 내야 한다.
- `useZenABController`는 `fallback_local_pair`나 emergency candidate를 합성해 질문 생성을 이어가면 안 되며, selected pair를 만들지 못하면 fatal generation error를 render boundary까지 surface해야 한다.
- `SakuraOptimizationResult`, `SakuraLatentOptimizer`, `useZenClassicActionController`는 `recommendedCandidate`, candidate latent, result latent bag을 서로 대체하거나 default phenotype으로 합성하면 안 되며, canonical optimization contract가 깨지면 즉시 throw해야 한다.
- `SakuraLatentOptimizer`는 optimization bootstrap에서 `baseLatent`가 없다고 random latent를 새로 만들면 안 되며, `useZenClassicActionController.handleReApplyBest`도 latest optimization의 `bestLatent`가 없을 때 seed-only reapply로 내려가면 안 된다.
- `SakuraLatentOptimizer`의 adaptive objective는 pairwise latent score와 canonical `SakuraPreferenceBasinObjective` guidance를 함께 사용한다. feature-only fallback으로 A/B latent model을 우회하거나, stable basin 밖 후보를 untracked objective로 추천하거나, indifferent 축을 개인화 효용으로 다시 증폭하면 안 된다.
- `useZenClassicWorkspaceState`와 `useSakuraV2ABPlanning`은 aggregate에서 hydrate한
  canonical active identity를 authoring draft의 base로 삼는다. Draft 값이나 learning
  anchor가 비었다고 `getDefaultSakuraLatent()`를 합성하거나 Main aggregate를
  intermediate step마다 쓰면 안 된다.
- `ZenBonsaiPreview`는 aggregate active identity 또는 strict imported snapshot을
  사용한다. canonical latent가 비었을 때 default latent나 retired localStorage
  scratchpad를 읽어 preview를 합성하면 안 된다.
- `useZenLatentControlController`는 `sakuraV2Latent`가 비었을 때 partial object나 default latent를 합성해 control commit/preset detection을 이어가면 안 되며, canonical current latent를 즉시 요구해야 한다.
- `runtime/classic/control`은 classic A/B, cold-start, optimize interaction control plane의 canonical home이며, `widgets/core/hooks`의 compatibility shim은 삭제된 상태를 유지한다.
- classic Experiment의 학습 writer는 `useZenLearningLab`이 소유한 local neural/pairwise model 한 쌍이다. 같은 feedback을 background `ZenPairwiseGPLiveBridge`에도 보내는 dual-write는 허용하지 않는다.
- `zen_sakura_v2_ab_history` v2는 feedback 이전의 direct pair probability와 migration provenance를 보존한다. v1의 화면에 노출되지 않았던 `WORSE_A/B` 의미는 explicit migration에서 사용자가 실제 클릭한 A/B 선호로 교정하고, pairwise state를 history로 재생한 뒤 v2를 commit한다. keyspace가 바뀌어도 compatible active-factor row는 동일 learning range를 검증한 뒤 preference basin으로 재투영하며 원 기록을 버리지 않는다.
- pairwise GP v3의 random-feature 좌표계는 한 keyspace 안에서 고정한다. axis relevance는 coverage/진단용이며 기존 weight의 입력 basis를 이동시키는 scale로 사용하지 않는다. model version/profile/latent-key mismatch는 explicit migration marker와 history replay를 요구한다.
- `useZenVNextCompareController`, `VNextOptimizationResult`, `VNextComparePairPolicy`는 worker optimize 실패를 local optimizer로 덮거나 `recommendedCandidate`, fallback anchor/pair를 합성하면 안 되며, canonical vnext optimization contract가 깨지면 즉시 surface해야 한다.
- `useZenVNextPersistentState`와 `ZenWorkspaceState`는 seed/factors/reliability/auto-compare/active-section을 normal read path에서 default나 section fallback으로 덮으면 안 되며, first-run VNEXT workspace initialization은 explicit bootstrap seam에서만 수행해야 한다.

## What Must Completely Disappear

- `themes/components/widgets/<themeId>`를 canonical theme home으로 보는 구조
- `themes/zen`과 `themes/components/widgets/zen`의 dual-home 구조
- giant widget registry가 모든 plugin 내부 경로를 수동으로 나열하는 구조
- manifest `widgets.fallbacks`로 다른 theme widget을 대신 쓰는 구조
- cross-theme fallback을 direct component import로 처리하는 구조
- UI component가 model persistence repository를 직접 import하는 구조
- `main/logic` 같은 giant bucket 폴더
- model, serializer, runtime orchestration, worker bridge, UI wiring이 한 파일에 섞인 mega file

release V1에서 old theme path와 forwarding shell은 삭제되어 있어야 한다.
caller는 plugin manifest 또는 plugin-owned canonical path를 직접 사용한다.

## What Counts As Failure

- plugin manifest를 만들었지만 실제 canonical implementation은 old `themes/components/widgets/*`에 남아 있는 상태
- Zen state 일부는 `themes/zen`, 일부는 `themes/components/widgets/zen`, 일부는 ad hoc storage path에 흩어진 상태
- core가 plugin 내부 경로를 계속 직접 import하는 상태
- “fallback”이라는 이름으로 다른 theme implementation을 직접 재사용하는 상태
- manifest가 missing widget contract를 다른 theme loader로 대체하는 상태
- old widget tree를 지우면 실제 theme implementation도 같이 사라지는 상태
- `themes/plugins/zen`이 생겼지만 진짜 Zen owner는 여전히 old `themes/zen`/`themes/components/widgets/zen`인 상태

## Tests And Build Policy

- loader, chunk, registry, theme wiring 테스트가 깨지는 것은 cutover 중 자연스러운 현상이다.
- old theme path를 남겨둔 채 green 유지하는 것은 실패다.
- 깨지는 테스트와 runtime wiring은 새 plugin canonical path 기준으로 같은 세션에서 복구한다.
- 종료 시에는 build와 관련 테스트가 green이어야 하지만, 중간 단계 green은 목표가 아니다.
- `npm run check:theme-public-entry-boundaries`는 dev/public build entry의 import 분리와 background-safe learning API, friction catalog 경계를 고정한다.
- public artifact는 `check-public-build-debug-surface.mjs`로 `researchLearning.js`와 `structuralAB.js`를 포함한 연구 entry 0개를, `check-context-bundle-budget.mjs`로 context별 static closure를 검증한다.

## Hard Completion Criteria

- plugin 하나를 읽으면 그 theme의 구조를 이해할 수 있어야 한다.
- Zen은 `themes/plugins/zen`만 보면 된다.
- plugin-owned durable state는 `platform/storage/themes/<themeId>`에 있다.
- large theme도 동일한 plugin contract 아래에서 수용된다.

다음이 모두 참이어야 `완성`이다.

- `themes/core`는 full concern에는 plugin manifest를, boot-facing widget/copy concern에는
  plugin surface descriptor를 사용한다.
- old giant widget registry는 source of truth가 아니다.
- 각 theme의 canonical owner는 `themes/plugins/<themeId>`다.
- Zen의 canonical owner는 `themes/plugins/zen` 하나다.
- old `themes/zen`과 `themes/components/widgets/zen`는 삭제되어 있다.
- Zen UI가 plugin-owned state/runtime/model 경계 위에서 설명된다.

## Still Not Complete If

- manifest는 생겼는데 registry가 여전히 old widget path를 source of truth로 쓰는 경우
- Zen 관련 파일을 찾으려면 여전히 여러 root를 뒤져야 하는 경우
- cross-theme fallback이 direct import로 남아 있는 경우
- mega file를 몇 개 잘랐지만 owner 구조는 여전히 old bucket 중심인 경우

## No-Compromise Rule

theme/plugin 구조의 목표는 `더 유연한 registry`가 아니다.
`theme implementation의 물리 owner를 하나로 고정하는 것`이 목표다.


### Zen Home reading space (2026-10-12)

`api/homeCanopyReading.js` remains a pure geometry seam. Its v2 receipt carries 64
height bands over immutable full-history anatomy and the canonical maximum sway.
`api/homeReadingSpace.js` separately exports only `ZenHomeReadingSpace` and
`ZenReadingBlock` for React composition. Garden converts matching receipts into
sheet-local CSS bands; individual ledger blocks reserve only their intersecting
height. Neither seam changes the bonsai camera, physical Garden frame, stats owners
or storage. Missing/mismatched committed geometry is pending; invalid shape fails
explicitly. The public-entry boundary guard admits these named seams.
