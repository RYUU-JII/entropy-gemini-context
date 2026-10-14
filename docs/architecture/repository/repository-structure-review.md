# Repository Structure Review

- Status: Active
- Owner: repository architecture
- Last validated against code: 2026-08-11
- Path policy: current-only
- Canonical for: current repository map, structural hotspot classification, staged filesystem refactor queue
- Companion to:
  - `docs/system-architecture/01-topology.md`
  - `docs/system-architecture/02-runtime-storage-boundaries.md`
  - `docs/system-architecture/03-theme-plugin-and-zen.md`
  - `docs/system-architecture/05-background-runtime-owners.md`

## Purpose

이 문서는 `docs/system-architecture/` 정본을 대체하지 않는다.
이 문서의 목적은 현재 코드베이스가 실제로 어떤 지형을 가지고 있는지,
그리고 구조 재정립이 필요하다면 어디부터 어떤 순서로 들어가야 하는지를
현재 파일시스템 기준으로 고정하는 것이다.

판정 기준은 아래 두 가지다.

1. 상위 owner 축이 실제 코드에서도 읽히는가
2. 하위 subsystem이 과밀, 분산, shell duplication 없이 자기 집을 갖고 있는가

## Executive Summary

현재 저장소는 전면 재설계가 필요한 상태는 아니다.

- 1차 구조 축은 대체로 건강하다.
  - `src/apps`
  - `src/domains`
  - `src/platform`
  - `src/themes/core`
  - `src/themes/plugins/*`
  - `src/ui-kit`
  - `src/lib`
- storage와 theme canonical owner는 문서와 실제 구현이 대체로 맞아 있다.
- 현재의 문제는 "구조 붕괴"보다 "과성장한 bounded context"와 "남아 있는 일부 owner drift"에 가깝다.

즉, 지금 필요한 것은 big-bang 재설계가 아니라 staged re-map 이다.

## Current Macro Map

2026-07-08 기준 `src` 파일 분포:

| Root | Files |
| --- | ---: |
| `themes` | 863 |
| `domains` | 622 |
| `apps` | 358 |
| `platform` | 153 |
| `i18n` | 39 |
| `ui-kit` | 32 |
| `lib` | 27 |

해석:

- 코드베이스는 `themes`와 `background/content runtime` 축에 무게가 실려 있다.
- 파일 수만 보면 문제처럼 보일 수 있지만, 상위 owner 축 자체는 여전히 읽힌다.
- 따라서 판단의 핵심은 상위 축이 아니라 hotspot 내부 분해 수준이다.

## What Is Structurally Healthy

### 1. Canonical Theme Ownership Is Mostly Real

`themes/core + themes/plugins/<themeId>` 구조는 실제 코드에서 owner로 동작한다.

- theme plugin catalog:
  - `src/themes/core/runtime/pluginCatalog.js`
- Zen canonical home:
  - `src/themes/plugins/zen/manifest.js`
  - `src/themes/plugins/zen/**`

현재 신규 사용 경로는 대부분 `themes/core/*`와 `themes/plugins/*`를 직접 본다.
old dual-home theme 구조가 source of truth로 남아 있는 모습은 크지 않다.

### 2. Storage Boundary Is Mostly Real

`platform/storage/*`가 실제 public surface로 읽히고,
raw backend는 `platform/storage/internal/*` 아래에 닫혀 있다.

현재 확인된 `dbManager` 직접 import는 support capability 안쪽에서만 보였고,
feature/app/theme가 raw backend를 직접 잡는 구조는 두드러지지 않았다.

### 3. Top-Level Layering Still Reads Correctly

대략적인 cross-root import 패턴은 아래처럼 읽힌다.

- `apps -> domains`
- `domains -> platform`
- `apps -> platform`
- `themes -> platform`

즉, 지금 당장 깨진 것은 top-level layering이 아니라,
각 layer 내부에서의 subsystem 집중도다.

## Structural Classification

### Stable Axis

즉시 재편 필요가 없는 구간:

- `src/apps/*` entrypoint home 자체
- `src/platform/*` canonical infra owner 축
- `src/themes/core/*` 와 `src/themes/plugins/*`의 상위 배치
- `src/platform/storage/themes/zen/*` canonical durable state home

### Narrow Forwarders

cross-cutting compatibility shell 1차 묶음은 이미 제거되었다.

- retired:
  - `src/themes/friction/**`
  - `src/themes/sceneSpecs/**`
  - `src/themes/data/**`
  - theme state shell entrypoint
  - tools artifact shell entrypoint
  - theme pack shared shell entrypoint
  - legacy Zen artifact storage shell entrypoint

현재 남은 forwarding 성격 경로는 plugin-local shared seam 수준으로 축소되었다.

- `src/themes/plugins/zen/shared/artifactVisualProfile.js`
- `src/themes/plugins/matrix/shared/artifactVisualProfile.js`
- `src/themes/plugins/entropy/shared/artifactVisualProfile.js`
- `src/themes/plugins/cyberpunk/shared/artifactVisualProfile.js`

이 경로들은 broad legacy shell과는 성격이 다르다.
현재는 plugin-local shared seam으로 읽히며, 제거 우선순위는 낮다.

### Congested Subsystem

폴더 하나가 사실상 별도 subsystem 규모로 자란 구간:

| Zone | Approx size | Why it is a hotspot |
| --- | ---: | --- |
| `src/themes/plugins/zen/widgets/signals/signalScanner` | 218 files | Zen widget이 아니라 pond runtime, worker, renderer, tuning, persistence까지 한 subtree에 공존 |
| `src/themes/plugins/zen/widgets` | 297 files | widget home 안에 UI shell 이상 책임이 많이 포함 |
| `src/themes/plugins/zen/model` | 164 files | classic/v2/vnext/sakura/bonsai가 한 집에 과밀 |
| `src/domains/nudge` | 116 files | visual, feed-flow, video-skip, indicator, koi, worker render engine가 한 umbrella 아래 결집 |
| `src/domains/tracking/background` | 69 files | tracking + protection dispatch + runtime/session concerns가 공존 |
| `src/apps/background/services/runtime` | 48 files | background composition seam이지만 binding surface가 빠르게 커지는 중 |

### Owner Split

합쳐져야 할 것이 다른 집에 남아 있는 구간:

1. protection dispatch ownership
- cutover completed:
  - `src/domains/protection/background/ProtectionDispatcher.js`
  - `src/domains/nudge/runtime/session/**`
- broad compatibility shims retired:
  - `NudgeManager` facade
  - `nudgeManagerCore/Session/Shared/Gate/Lease/Pending/Abort/Terminal/Lifecycle` forwarding files

즉, protection dispatch의 canonical file home과
session lease/gate/pending helper edge는 모두 canonical 또는 neutral seam으로 정리되었다.
tracking 쪽 forwarding facade는 삭제되었고, local caller는 필요한 nudge session/terminal owner를 좁게 import한다.

2. Zen widget thin-shell rule drift
- canonical Zen rules는 `widgets`를 thin UI shell로 제한한다.
- 1차 cutover completed:
  - `src/themes/plugins/zen/runtime/preview/ZenBonsaiPreviewRuntime.jsx`
  - `src/themes/plugins/zen/runtime/vnext/ZenCoreStatusVNextWorkspace.jsx`
  - `src/themes/plugins/zen/runtime/classic/useZenClassicWorkspaceSessionRuntime.js`
  - `src/themes/plugins/zen/runtime/classic/useZenClassicHomeWorkspaceRuntime.js`
  - `src/themes/plugins/zen/runtime/classic/useZenClassicWorkspaceRuntime.js`
- 2차 cutover completed:
  - `src/themes/plugins/zen/state/classic/useZenClassicViewPreferences.js`
  - `src/themes/plugins/zen/state/classic/useZenClassicWorkspaceState.js`
  - `src/themes/plugins/zen/bonsai/runtime/useZenBonsaiAuthoringDraftState.js`
  - `src/themes/plugins/zen/presentation/classic/useZenClassicPresentationModel.js`
  - `src/themes/plugins/zen/runtime/classic/useZenReportController.js`
  - `src/themes/plugins/zen/runtime/classic/useZenLatentControlController.js`
- 3차 cutover completed:
  - `src/themes/plugins/zen/runtime/classic/control/useZenABController.js`
  - `src/themes/plugins/zen/runtime/classic/control/useSakuraV2ABPlanning.js`
  - `src/themes/plugins/zen/runtime/classic/control/useZenClassicActionController.js`
  - `src/themes/plugins/zen/runtime/classic/control/useZenABKeyboardShortcuts.js`
  - `src/themes/plugins/zen/runtime/classic/control/useZenModeController.js`
- widget-entry compatibility shim은 삭제되었고, 남은 과제는 giant control file 자체를 더 작은 named control slice로 나눌지 여부를 판단하는 것이다.

이 상태는 Zen one-home 원칙 자체를 깨지는 않지만,
plugin 내부에서 `widgets -> model/storage` 직통 경로가 커졌다는 뜻이다.

### Giant File / Giant Module

filesystem 재편 필요성을 강하게 시사하는 대형 코드 파일:

| File | LOC |
| --- | ---: |
| `src/apps/dashboard/tabs/experiment/StatsPipelineDiagnosticsLab.jsx` | 2875 |
| `src/domains/nudge/video-skip/VideoSkipManager.js` | 2248 |
| `src/themes/plugins/zen/model/sakura/sakuraRenderer.js` | 2144 |
| `src/domains/nudge/runtime/SentinelProtocolHost.js` | 2133 |
| `src/apps/dashboard/tabs/experiment/SentinelProtocolLab.jsx` | 1969 |
| `src/domains/nudge/rendering/NudgeProtocolSceneBackground.js` | 1762 |
| `src/themes/plugins/zen/model/ZenPotRenderer.js` | 1750 |
| `src/themes/plugins/zen/model/ZenBonsaiGrowthProjection.js` | 1728 |
| `src/apps/gate/GateInterstitialApp.jsx` | 1680 |

Resource-like locale bundles and binary/font assets are excluded from this
hotspot table.

Current state: `src/domains/nudge/runtime/SentinelProtocolHost.js` is the direct
canonical host and the predecessor `nudgeGame.js` facade is deleted. Remaining
nudge structure pressure belongs to the host shell and adjacent subsystem
owners, not a second entrypoint.

이 목록은 "큰 파일이 있으니 무조건 쪼갠다"는 의미는 아니다.
다만 owner가 이미 분리되어 있어야 하는 곳에서 giant file이 발생하면,
filesystem 단위 재배치가 함께 필요할 가능성이 높다.

## High-Priority Findings

### Finding 1. Cross-Cutting Compatibility Shells Were the Right First Cut

`themes/friction`, `themes/sceneSpecs`, `themes/data`, `themes/state`, `themes/tools`,
그리고 old Zen storage forwarder는 모두 broad compatibility shell 성격이었다.

이 묶음은 이미 retire 되었고, 그 결과:

- canonical path와 legacy path가 동시에 보이던 broad duplication이 줄었다.
- grep noise가 줄었다.
- 새 코드가 theme read path를 `themes/core/*`로 더 일관되게 읽게 되었다.

이제 남은 문제는 compatibility shell보다 owner split과 hotspot 분해다.

### Finding 2. Protection Dispatch Re-home Now Reads as a Real Owner Boundary

`ProtectionDispatcher` 자체는 이제 `domains/protection/background` 아래로 이동했다.

이번 컷에서 dispatcher가 보던 session lease/gate/pending helper는
`domains/nudge/runtime/session/**` 아래 neutral seam으로 이동했다.

즉, 현재 상태는:

- protection dispatch file home은 protection owner로 정리됨
- dispatcher가 보던 session helper owner는 neutral seam으로 정리됨
- tracking 쪽 broad nudge forwarding facade는 삭제됨

즉, protection dispatch는 이제 filesystem 기준으로도
tracking helper에 눌러앉지 않은 owner boundary로 읽힌다.

### Finding 3. Zen Pond Is No Longer "Just a Widget"

`signalScanner` subtree는 이미 독립 subsystem 규모다.
실제 안에는 아래 concern이 모두 들어 있다.

- app/container
- UI
- worker runtime client
- worker core
- runtime kernel
- systems
- Pixi renderers
- water effects pipeline
- koi model/render logic
- decor
- tuner
- local persistence

이 정도 규모면 `widgets/signals/signalScanner`는 feature folder를 넘어서
plugin-owned pond subsystem으로 읽히도록 재배치하는 것이 맞다.

### Finding 4. Zen Widgets Need a Second Boundary Pass

Zen canonical doc는 `widgets`를 thin shell로 두고,
`presentation`, `runtime`, `state`, `model`을 분리하도록 요구한다.

현재 `widgets/core`의 여러 hook과 component는 아래 경향을 보인다.

- `model/*` direct import
- `platform/storage/themes/zen/*` direct import
- UI composition과 experiment/runtime orchestration이 같은 folder에서 결합

즉, Zen은 one-home cutover는 성공했지만,
plugin 내부 2차 seam cutover는 아직 진행 중이다.

### Finding 5. Social Metrics Hide Pipeline Now Has a Real Internal Home

기존 `src/domains/nudge/visual/socialMetricsManager.js`는 observer, selector scan, host-specific cleanup,
Instagram classifier, runtime state 해석을 한 파일에서 모두 들고 있었다.

현재는 canonical seam이 아래처럼 분리되었다.

- facade:
  - `src/domains/nudge/visual/socialMetricsManager.js`
- core:
  - `src/domains/nudge/visual/socialMetrics/core/*`
- adapters:
  - `src/domains/nudge/visual/socialMetrics/adapters/*`
  - host-owned target declarations in `adapters/*Profile.js`
- contracts:
  - `src/domains/nudge/visual/socialMetrics/contracts/*`

또한 `adapters/socialMetricTargetProfiles.js`의 strict owner profile은 각 host
`*Profile.js`가 선언한 `scanRoots`를 mutation prefilter root로 컴파일한다.

이 변화로:

- 전체 mutation 구독 후 늦은 selector filtering 비용이 줄었다.
- YouTube/X cleanup과 Instagram classifier owner가 분리되었다.
- manager는 giant module에서 facade에 가까운 형태로 축소되었다.

이 구간은 이제 구조적으로는 hotspot rescue를 끝낸 상태로 본다.

### Finding 6. `domains/nudge` Is a Bounded-Context Umbrella, Not a Single Slice

현재 `domains/nudge`는 아래를 모두 포함한다.

- `feed-flow`
- `visual`
- `indicator`
- `infinite-scroll`
- `video`
- `video-skip`
- `koi`
- worker render engine / protocol scene
- `nudge` mini-game

이 정도면 "nudge"는 단일 feature라기보다 상위 umbrella다.
같은 집 아래 둘 수는 있지만, 현재 구조는 umbrella 내부의 2차 지도와
public seams가 더 명확해져야 한다.

## Refactor Queue

### Phase 1. Completed: Retire Cross-Cutting Compatibility Shells

완료된 항목:

- `src/themes/friction/**`
- `src/themes/sceneSpecs/**`
- `src/themes/data/**`
- theme state shell entrypoint
- tools artifact shell entrypoint
- theme pack shared shell entrypoint
- `src/platform/storage/zen/**`

결과:

- theme data / friction / scene spec read path는 canonical `themes/core/*`로 정리되었다.
- broad legacy path가 source-of-truth처럼 보이던 문제는 크게 줄었다.
- 남은 forwarding 성격 경로는 plugin-local shared seam 위주다.

### Phase 2. Completed: Re-home Protection Dispatch

목표:

- protection runtime dispatch ownership이 filesystem에서도 `domains/protection`으로 읽히게 만든다.

완료 상태:

- `src/domains/protection/background/ProtectionDispatcher.js`
- `src/apps/background/services/runtime/backgroundKernelProtectionDispatcherBindings.js`
- `src/domains/nudge/runtime/session/**`

현재 후속 watchpoint:

- tracking local caller는 broad nudge forwarding facade 대신 필요한 nudge session/terminal owner를 직접 본다.
- 이 shim은 broad owner ambiguity를 만들지는 않지만, 장기적으로는 retire 후보다.

원칙:

- tracking에서 protection을 호출하는 것은 허용된다.
- protection semantics 자체가 tracking 집에 눌러앉아 있으면 안 된다.
- caller ownership과 domain ownership을 구분한다.

Exit criteria:

- protection dispatch planner/runtime orchestration이 `domains/protection/background/**` 아래에서 읽힌다.
- dispatcher가 broad tracking facade 대신 neutral session seam만 본다.
- tracking 쪽에는 tracking-owned caller와 좁은 nudge session/terminal owner import만 남는다.

### Phase 3. Split Zen Pond into Named Seams

목표:

- `signalScanner`를 widget subtree가 아니라 named pond subsystem으로 읽히게 만든다.

working map:

- `docs/architecture/repository/zen-pond-seam-map.md`

initial landing:

- `src/themes/plugins/zen/pond/app/*`
- `src/themes/plugins/zen/pond/control/*`
- `src/themes/plugins/zen/pond/control/runtimeClient/*`
- `src/themes/plugins/zen/pond/renderers/pixi/*`
- `src/themes/plugins/zen/pond/renderers/worker/*`
- `src/themes/plugins/zen/pond/runtime/*`
- `src/themes/plugins/zen/pond/model/koi/*`
- `src/themes/plugins/zen/pond/world/*`
- `src/themes/plugins/zen/pond/contracts/*`
- `src/themes/plugins/zen/pond/state/*`
- `src/themes/plugins/zen/pond/storage/*`
- `src/themes/plugins/zen/pond/tuner/*`
- `src/themes/plugins/zen/pond/app/ZenSignalScannerSurface.jsx`
- `src/themes/plugins/zen/pond/app/ZenKoiTunerPanel.jsx`
- `src/themes/plugins/zen/pond/app/hooks/*`
- widget subtree entrypoints now thin-shell into these canonical homes

추천 분리 축:

- UI shell
- pond runtime
- pond worker bridge
- pond renderer
- pond simulation model
- pond contracts
- pond state
- pond tuning/persistence

중요:

- 이 단계의 목표는 폴더를 예쁘게 만드는 것이 아니다.
- "pond runtime의 canonical owner가 어디인가"를 filesystem에서 한 번에 읽히게 만드는 것이다.

Exit criteria:

- `widgets/signals`는 thin view/container seam으로 축소된다.
- worker/runtime/renderer/model/world owner가 widget tree 바깥 named seam으로 읽힌다.
- pond 관련 신규 작업자가 `widgets/signals/signalScanner` 전체를 뒤지지 않아도 된다.

### Phase 4. Restore Zen Widget Thin-Shell Boundary

목표:

- `widgets/core`의 direct model/storage 의존을 `presentation`, `state`, `runtime` seam 뒤로 줄인다.

완료된 대표 cutover:

- `src/themes/plugins/zen/state/classic/useZenClassicWorkspaceState.js`
- `src/themes/plugins/zen/state/classic/useZenClassicViewPreferences.js`
- `src/themes/plugins/zen/runtime/classic/control/useZenABController.js`

Exit criteria:

- widget component가 persistence repository를 직접 import하지 않는다.
- UI intent와 state orchestration은 named seam을 거친다.
- model compile/storage details는 widget layer 바깥에서 숨겨진다.

### Phase 5. Sub-classify `domains/nudge`

목표:

- `domains/nudge`를 한 덩어리 feature가 아니라
  `visual`, `feed-flow`, `interruptions`, `indicator`, `sentinel` 등
  2차 bounded context로 읽히게 만든다.

추천 방식:

- 상위 umbrella는 유지하되, public API와 ownership README를 먼저 만든다.
- 이후 giant module부터 순차 cutover 한다.

우선 후보:

- `SentinelProtocolHost.js`의 DOM/lifecycle/input routing 분리
  - next-touch cleanup only; current protocol state already lives in controllers.
- `VideoSkipManager.js`
- `feed-flow/terminus/TerminusSurface.js`
- `visual/socialMetricsManager.js`

Exit criteria:

- `domains/nudge` 내부에서 어떤 파일이 infra인지, 어떤 파일이 runtime인지, 어떤 파일이 UI/overlay인지 한 번에 읽힌다.
- 새 기능이 umbrella root에 무분별하게 추가되지 않는다.

### Phase 6. Secondary Cleanup

후순위 검토 대상:

- dashboard giant tabs/components
- `platform/storage/internal/indexeddb/dbManager.js` 내부 세분화

이 축은 우선순위가 낮다.
현재 시스템 이해도와 runtime owner 혼란에 미치는 영향은
Phase 1~5보다 작다.

## Recommended Working Order

실행 순서는 아래를 권장한다.

1. protection dispatch re-home
2. Zen pond named seam 분리
3. Zen widget thin-shell 복원
4. nudge umbrella 재분류
5. dashboard / dbManager 후순위 정리

이 순서를 권장하는 이유:

- cross-cutting shell 정리가 끝나서 이제 가장 큰 owner ambiguity를 먼저 다룰 수 있다.
- 그 다음 theme hotspot과 widget boundary를 줄이고,
- 마지막에 큰 subsystem 내부 재배치를 이어갈 수 있다.

## Non-Goals

이 문서의 목표는 아래가 아니다.

- monorepo 전환
- package split을 먼저 강제하는 것
- 테스트 전략 전면 교체
- runtime behavior 자체를 한 세션에서 재설계하는 것

지금의 목표는 "현재 저장소가 어디까지 건강하고, 어디서부터 다시 지도를 그려야 하는가"를
파일시스템 관점에서 명확히 고정하는 것이다.
