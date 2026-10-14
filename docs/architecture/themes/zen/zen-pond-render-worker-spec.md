# Zen Pond Render Worker Spec (Unified Home Runtime)

- Status: Active
- Owner: zen theme architecture
- Last validated against code: 2026-10-13
- Path policy: planning-allowed
- Canonical for: Zen pond logical-channel integration inside the unified Home renderer

> Worker control-plane SSOT: worker id, context, lane, task types, and timeout defaults are declared in `src/platform/workers/runtime/WorkerRuntimeRegistry.js`; operational policy is documented in `docs/architecture/workers/worker-runtime-control-plane.md`.

## 1. 목적
- Zen 연못 렌더(FULL)로 인한 부팅 말미 stutter를 구조적으로 완화한다.
- 메인 스레드(UI/React)와 연못 렌더 루프를 분리한다.
- Pond, Bonsai, 아티팩트 갤러리를 하나의 물리 `zen_home_renderer`와 하나의
  admission session으로 통합하되, 각 렌더러의 논리 프로토콜/ACK는 분리한다.
- 기존 `shared worker runtime` 계층에 완전히 통합해 중복 Worker 관리,
  로컬 admission, 재시도 경로를 만들지 않는다.

## 해석 가이드 (고정 계약)
- 이 문서의 `필수/금지/강제/고정` 표현은 Active 런타임 계약이다.
- 물리 Worker, admission lease, logical channel topology를 바꿀 때는 registry,
  owning architecture doc, guard/test를 같은 변경에서 갱신한다.
- 실험도 두 번째 Home Worker, 별도 용량, hidden fallback을 만들 수 없다.

## 2. 문제 요약
- 현재 연못 렌더는
  `ZenPondWorkerRuntimeClient -> ZenHomeRendererWorkerSession -> pond channel -> initializeZenPondRendererWorker`
  경로를 사용한다.
- Pond/Bonsai가 각각 물리 Worker와 presentation lease를 가지면 Home 자체가
  steady presentation 예산을 초과하고 first-frame generation을 분리한다.
- 따라서 물리 수명/용량은 Home 단위로 합치고, 렌더 상태와 ACK는 channel
  단위로 분리해야 한다.

## 3. 핵심 설계 원칙
1. 워커는 계산만 하지 않고 렌더까지 소유한다.
2. 메인↔워커 간 매프레임 상태 전송(물고기 좌표, 태양, 파동)은 금지한다.
   UI ambient refresh snapshot도 worker control input이 아니다.
3. IPC는 저빈도 델타 이벤트만 허용한다.
4. OffscreenCanvas/Worker 계약이 충족되지 않으면 명시적 worker-only 오류로 fail-fast한다.
5. 런타임 통합은 중앙 admission session과 기존 계층(`WorkerRequestClient`, `WorkerExecutionController`, `WorkerTaskQueue`)만 사용한다.
6. 물리 Home Worker는 하나만 활성화하고, 그 안에서 `pond`, `bonsai`, `artifacts` 세
   exact logical channel만 허용한다. 동일 surface의 dual physical render는 금지한다.
7. 날씨는 worker가 명시적 weather authority와 worker clock으로 저빈도 target을
   갱신한다. Weather Event Director는 임의 절대 시각의 전선과 짧은 rain-cell
   schedule만 결정하며, 빗방울 좌표나 파문 목록을 main thread에서 매프레임
   보내지 않는다. 실제 빗방울 파문은 canonical low-resolution surface-field
   shader가 두 개의 procedural candidate로 합성한다. 사용 습관, friction,
   progression, visit/session state는 weather event 입력이 아니다.
8. Main scene projection은 pond와 bonsai에 같은 scene `environmentMode`를
   전달한다. 두 logical channel은 같은 clock/event 결과를 소비하되, pond는
   수면 물리와 파문까지, bonsai는 render light/wind만 반영한다. bonsai 생육
   ledger나 life state를 날씨에서 갱신하지 않는다.
9. 시간 정본은 versioned `realtime | fixed` semantic authority다. realtime은
   logical worker가 local clock으로 해석하고, fixed 선택이 바뀔 때만 main이
   environment-authority delta를 보낸다. 시간은 quality/tuning/water runtime
   params와 같은 invalidation domain에 들어가지 않는다.
10. clock/solar/weather/ambient 해석은
    `src/themes/plugins/zen/runtime/environment/`의 world-environment kernel 하나만
    소유한다. 각 realm은 같은 pure kernel을 느린 cadence에서 샘플링하고 Pond/Bonsai
    projector가 source revision을 보존한 domain target/signature를 만든다.
11. frame fast path는 prevalidated target에 대한 명시적 numeric interpolation만
    허용한다. validator, solar/weather resolver, palette/material projection,
    string color parsing, object-wide numeric discovery, signature 생성은 금지한다.
12. 제품 visual profile은 `floor / plants / rocks / sunlight` 네 축의 strict DTO다.
    main은 기존 `SYNC_RUNTIME_PARAMS`로만 이를 보내고, worker는 profile signature가
    바뀔 때 같은 physical worker 안의 Pixi scene만 dispose/remount한다. 선택 분기는
    scene mount에서 immutable render plan으로 한 번 컴파일하며 frame fast path에서
    dropdown/profile ID를 해석하지 않는다. 내부 scene replacement는 transferred
    OffscreenCanvas의 WebGL context를 보존하고 Pixi resource만 재구성한다. 최종
    channel dispose는 context까지 완전히 해제한다. 모든 제품 sunlight profile은
    `connected_sunweb_v1` 굴절 receiver 투영을 사용한다. Komorebi만 profile별로
    나뉜다: `sunlight=lacy_connected`는 `canopy_branch_visibility_lacy_v6`,
    제품 기본값은 `canopy_branch_visibility_layered_v6`를 선택한다.

## Pixi capability and business boundaries (2026-10-13)

The shared `zenPixiWorkerRuntime.js` registers the admitted Pixi plugins for the
realm. Consumers use static named imports. An injected renderer capability
object contains only the constructors the recipient needs; it must not expose
the module namespace. Plume rain receives exactly `Container`, `Geometry`,
`Mesh` and `Shader`. This keeps new exports from silently entering a renderer's
dependency surface and lets the bundler prune unused exports.

The Home worker consumes render plans and presentation contracts. Progression
policies, Guidance, app/UI code, i18n and storage remain outside its closure;
the artifact gate rejects those paths. Plan validation retains its exact
semantic checks, and the supported classic/G15/Plume backends remain admitted.
The budget includes both static and lazy renderer dependencies, so a lazy
backend is part of the total shipped closure even when it is not loaded at
startup. Narrow imports do not authorize dropping a supported backend or
weakening validation to meet a size gate. Existing baselines and limits remain
unchanged.

The Bonsai backend factory loads its Canvas2D implementation only after an
explicit `canvas2d` selection, just as Pixi backends use their selected admission.
Loading the Bonsai logical channel does not eagerly evaluate the Canvas2D
asset-cache/species/compositor graph. This is a startup dependency boundary;
the lazy Canvas2D branch remains in the total shipped closure budget.

G15's render-only entry imports its exact numeric foundations from
`model/bonsai/g15/ZenBonsaiG15Math.js` and its six terminal morphology/paint
bindings through `ZenBonsaiG15TerminalMorphology.js`. The full developmental
program namespace and full standalone-study API remain available to their
generation/study owners. `ZenBonsaiG15TerminalStudyRuntime.js` publishes the full
API from the same canonical Sakura ESM body instead of a duplicate generated
product bundle. Neither broad namespace may enter the Home Worker closure.
The source architecture guard protects the named binding seam, and the artifact
guard rejects those broad modules in both static and lazy chunks. Render-plan
reconstruction and semantic validation are unchanged.

Artifact scene loaders resolve each declared factory directly. They never hand
the engine a complete module namespace to index by a runtime string. Reference
exports remain available to their explicit comparison consumers without being
retained by production scene admission. These boundaries preserve shader
source, geometry, material compilation, frame clocks, and supported backends;
they do not relocate baking work to the document to satisfy the Worker budget.

The 2026-10-13 production audit measured the complete static and dynamic Worker
closure before and after these changes: 2,067,885 → 2,029,814 minified raw bytes
and 671,724 → 659,866 gzip bytes across the same 44 chunks. Against the unchanged
622,018-byte gzip baseline and 8% failure threshold, remaining gzip capacity
increased from 55 to 11,913 bytes. The 3% warning threshold remains active.
The closure contains 646 modules rather than 645 because canonical ESM leaves
replace two broad generated/generation modules; module count is not a size proxy.
Complete prior graph/scene and Canvas paint receipts protect equivalence.
The preserved inventories and byte comparison are recorded in
`.artifacts/worker-headroom-20261013/comparison.json`. This is shipped-byte
evidence, not a startup, frame-rate or GPU timing claim.

## App-wide petal landing boundary (2026-09-23)

`presentation/petals/ZenAppPetalLayer.jsx` is the only ambient airborne-petal
surface. Its fixed Canvas2D loop is outside the tab panes and does not create a
Worker. The existing Home pond channel receives bounded landing batches only
while its measured canvas receiver is active. CSS viewport geometry and the
canonical `zenCoverMath.js` transform determine the world landing point; bonsai
geometry never participates.

`LAND_PETALS` carries `{ landings, viewportWidth, viewportHeight }`, preserving
petal identity and appearance. Each descriptor requires `depthLayer: surface`;
background/foreground or missing-layer descriptors fail validation. Only the
small surface-layer petals from the single emitter may enter this seam.
After mapping through the canonical cover transform, a valid candidate above
`ZEN_POND_MAX_LANDED_PETAL_SIZE` (six world units) is declined with
`surface_scale_mismatch`, without resizing, spawning, or producing a ripple.
The same one-shot ID history records that rejection. `landPetals()` uses a dedicated, non-coalescing
queue with four pending commands and at most 24 landings per batch. Existing
session/sequence admission remains authoritative. The Worker retains the latest
2,048 petal IDs and their admission result so a repeated ID cannot create another
entity or disturbance. Its landed-entity limit is 32. Inactive receivers, changed
logical viewports, and disabled world-policy petals return no accepted IDs with
an explicit reason. A detached receiver cannot replay its events into a later
session.
The ACK reports applied `acceptedIds`/`rejectedIds` and reason; it does not prove
that a particular frame has rendered. No separate petal render-revision ACK is
introduced. The receiver registers only after its first visible frame and releases
on parking, inactivity, failure or disposal.
The Worker creates a landed entity directly: floating water petals request the
existing `petal` disturbance once, while pad hits become resting petals. Size,
shape, color and rotation come from the airborne field rather than a fresh
randomized spawn. Pond entity synchronization only expires these entities; it
does not seed, target, replenish, or maintain an airborne population.

`zenWorldBotanicalMaterialLighting.js` is the shared pigment response for the
bonsai flowers and airborne/landed petals. The app samples it with its existing
world authority. The Worker compiles its realm-local functions at the slow
environment-target seam, retaining them as a stepped material through numeric
interpolation; those functions never cross IPC. Landing descriptors retain
authored color IDs. A changed 0.05-grain night/moon signature repaints the same
bounded Canvas bakes/Pixi texture sources lazily; unchanged motion frames perform
no palette projection, color parsing, bake or texture upload. There is no new
worker, timer, light variant cache dimension or pond-specific pigment recipe.

The single `externalPetalImpact`/pointer token route and Home bonsai-to-pond
transit are retired. Debug disturbance fixtures remain explicit diagnostic
injections and are not an ambient petal emitter. Standalone ponds have no petal
supply unless the app field receiver is explicitly assembled. Source sampling,
pause/reduced-motion policy and airborne counts belong to the field, never the
Pond Worker or its quality profile.

## Explicit Home render presets (2026-09-06)

The default is `full`. Users may choose `balanced` or `low` (Power saving) in
Settings > Workspace > Zen visual quality. There is no hardware-derived or
frame-pressure-driven automatic quality switch. Graphics quality and output
frame policy are separate runtime axes, bundled into three user presets.

| Preset | Pond / Home Bonsai target fps | Pond simulation Hz | Pond max pixels | Water filter scale | Surface reference edge |
| --- | --- | --- | --- | --- | --- |
| full | 60 / 60 | 60 | 1920 × 1080 | .82 | 384 |
| balanced | 60 / 60 | 60 | 1600 × 900 | .68 | 320 |
| low (Power saving) | 30 / 30 | 60 | 1280 × 720 | .55 | 256 |

Targets are ceilings, not guaranteed device performance. The former fixed Home
Bonsai 36fps override is replaced by the selected Home frame policy; independent
embedded/Lab context defaults remain separate. Bonsai retains context-owned
wind/environment sampling, static bake ownership and its growth model. The
selected pixel-ratio cap and render-quality input reach its existing renderer.

Canonical owners:

- `domains/settings/config/zenRenderPreset.js`: persisted `zen_render_preset`
  enum (`full | balanced | low`), missing-key initialization default `full`,
  strict validation for present values.
- `apps/dashboard/stores/usePreferenceStore.js`: hydration and complete-ACK
  publication through the existing preference `settingsCommandBus` channel.
- `apps/dashboard/tabs/settings/components/ZenRenderQualityPanel.jsx`: user
  choice, pending state and visible save failures; no storage or GPU writes.
- `themes/plugins/zen/runtime/zenRenderQuality.js`: preset-to-graphics/frame
  policy and shared graphics budgets.
- `zenMainWorkerRenderBudget.js` and its hook: one selected Home budget projected
  into Pond/Bonsai channels. `fixed-home` now means fixed explicit selection,
  not forced full quality. `HomeScanWorkspace` consumes the stored selection.
- `pond/runtime/zenSignalScannerConfig.js`: simulation/ambient/field profiles.
- `pond/runtime/zenPondViewportPolicy.js`, `zenPixiSceneViewport.js` and
  `ZenPixiSceneRenderer.js`: target pixel caps at mount and resize.
- `pixiWaterPresentationRuntime.js`: selected water filter scale at filter
  creation/reuse. The filter receives the profile value; its shader does not
  infer a quality tier from a GPU name or screen size.

Existing `SYNC_RUNTIME_PARAMS` carries selected quality and target fps. A quality
change replaces only the Pixi scene inside the existing physical worker, retaining
simulation data and canonical world fields. Identical selection does not remount.
There is no dedicated quality channel, mirror preference or boot downgrade.
The exact release V1 boot prewarm DTO carries `preference.zenRenderPreset`; both direct and
prewarmed hydration start from the saved selection, without an initial full frame.

All presets preserve koi simulation at 60Hz, fish roster, shared sun/depth
relationships, shadow opacity, fin shadows and static composition density.
Reduced surface/rain/disturbance/ambient budgets and coarser presentation cadence
lower actual work. Dimmer effect opacity is not counted as an optimization.
Fish-shadow cadence numbers still do not represent a lower draw/update rate.

## 4. 범위

Partial scene mount owns every completed allocation until it returns the scene.
If post-host admission fails, `ZenPixiSceneRenderer` unwinds those allocations,
view binding, diagnostic observers and ticker without returning a live owner.
Successful rollback preserves the original error; failed cleanup attempts still
all run and report `ZEN_PIXI_SCENE_MOUNT_FAILED` with the original error first
and as `cause`. Successful scenes retain their existing final disposal and
`preserveCanvasContext` policy. A failed mount is not a ready-frame ACK.

### 포함
- Zen SignalScanner 연못 렌더 루프 워커 이전
- Water FX 루프 및 품질 프로파일 연동
- boot/handoff 품질 전환
- 텔레메트리(main longtask + worker frame metrics)
- shared worker runtime 통합 규약

### 제외
- 아티팩트 탭 렌더 워커화
- 테마 공통 렌더러 대통합
- Pixi 내부 알고리즘 대규모 재작성

## 5. 기존 Worker Runtime 통합 계약
### 5.1 통합 지점
- Runtime 계층
  - `src/platform/workers/runtime/types.js`
  - `src/platform/workers/runtime/config.js`
  - `src/platform/workers/runtime/WorkerRuntimeAdmissionController.js`
  - `src/platform/workers/runtime/AdmittedWorkerRuntimeSession.js`
  - `src/platform/workers/runtime/WorkerRequestClient.js`
  - `src/platform/workers/runtime/WorkerExecutionController.js`
  - `src/platform/workers/runtime/WorkerTaskQueue.js`
- Zen 연못 adapter
  - `src/themes/plugins/zen/pond/control/ZenPondWorkerRuntimeClient.js`
- Zen Home 물리 session/프로토콜/worker
  - `src/themes/plugins/zen/runtime/worker/ZenHomeRendererWorkerSession.js`
  - `src/themes/plugins/zen/runtime/worker/zenHomeRendererWorkerProtocol.js`
  - `src/themes/plugins/zen/runtime/worker/zenHomeRenderer.worker.js`
- Zen 연못 논리 channel 구현
  - `src/themes/plugins/zen/pond/renderers/worker/zenPondRenderer.worker.js`

### 5.2 Runtime enum/정책
- 물리 registry surface는 `zen_home_renderer`이며 다음 task type을 사용한다.
  - `ZEN_HOME_RENDER_INIT`
  - `ZEN_HOME_RENDER_CONTROL`
  - `ZEN_HOME_RENDER_TELEMETRY`
- Pond data plane과 telemetry는 다음 논리 task type을 유지한다.
  - `ZEN_POND_RENDER_INIT`
  - `ZEN_POND_RENDER_CONTROL`
  - `ZEN_POND_RENDER_TELEMETRY`
- 기본 컨텍스트/레인/우선순위
  - context: `ui`
  - lane: `render`
  - priority:
    - init/resize/scene session: `user_visible`
    - environment authority, runtime params, fish roster, input, telemetry flush: `background`

### 5.3 클라이언트 정책
- Pond는 `WorkerRequestClient` 1개를 자신의 logical channel session 단위로 사용한다.
- registry workerId는 `zen_home_renderer` 하나다. `zen_pond_renderer_runtime`이나
  `zen_bonsai_renderer`를 별도 물리 surface/workerId로 등록하지 않는다.
- `WorkerExecutionController`는 strict fail-fast만 허용하고, 연속 실패 시 circuit open 뒤 `blocked`를 surface한다.
- `ZenHomeRendererWorkerSession`만 중앙 `WorkerRuntimeAdmissionController`의
  `presentation` 그룹/`render` lane lease를 획득하고 물리 Worker를 생성한다.
- Home은 rank `400`, strict, non-preemptible steady presentation lease 하나를
  유지한다. Pond/Bonsai channel acquire는 lease, rank, Worker 수를 늘리지 않는다.
- Pond `WorkerRequestClient`는 `pond` channel의 프로토콜 data plane일 뿐이다.
  연못 로컬 `WorkerPool`, admission 재시도, main-thread renderer, 예산 해석,
  capacity inflation을 두지 않는다.
- Dashboard Boot와 Ceremony는 별도 preemptible burst presentation consumer다.
  이들은 Home steady lease나 Home channel을 대체/복제할 수 없다.
- `WorkerTaskQueue`는 최신 상태 우선 정책으로 dedupe/cancel을 적용한다.
  - resize dedupeKey: `zen_pond:resize`
  - visibility dedupeKey: `zen_pond:visibility`
  - input dedupeKey: `zen_pond:input`
  - scene session dedupeKey: `zen_pond:scene_session`
  - environment authority dedupeKey: `zen_pond:environment_authority`
  - runtime params dedupeKey: `zen_pond:runtime_params`
  - fish roster dedupeKey: `zen_pond:fish_roster`
- Worker canvas는 `FIRST_FRAME_ACK` 전까지 투명 상태로 host에 붙인다. 첫 렌더 프레임이 확인되기 전 WebGL backbuffer/default clear가 사용자에게 노출되면 안 된다.

## 6. 상태 소유권과 수명주기(FSM)
### 6.1 소유권
- Pond logical channel 소유(연못 렌더 단일 소스 오브 트루스)
  - fish/env/water/fx 상태
  - 렌더 타이밍 및 프레임 메트릭
- `ZenHomeRendererWorkerSession` 소유
  - 단일 물리 Worker와 admission lease 수명
  - `pond`/`bonsai` channel session id와 envelope routing
  - 마지막 channel release 시 물리 session 종료
- Bonsai logical channel은 자신의 materialization/render 상태와 ACK를 별도로
  소유한다. 물리 session은 어느 channel의 business/render truth도 합성하지 않는다.
- 메인 소유
  - 사용자 설정 store 원본
  - UI 상태(패널, 탭, 컨트롤)
  - canvas host DOM

Reattaching the same live Pond canvas preserves its confirmed first-frame
visibility in the controller's attachment readiness snapshot. Moving it to or
from the park host is not a new renderer startup. Current presentation-scene
ACK matching remains independent and mandatory; attachment does not fabricate a
fresh scene ACK. This prevents an `attached` notification from withdrawing
invitation input after a Main return whose scene key is already acknowledged.

### 6.1.1 Canonical rain model telemetry
- canonical rain model ID의 단일 owner는
  `src/themes/plugins/zen/pond/contracts/zenWaterSurfaceFieldRainModel.js`의
  `ZEN_WATER_SURFACE_FIELD_RAIN_MODEL_ID`다. 현재 ID는
  `energy_efficient_v1`이다.
- ID는 렌더러 선택 입력이나 호환 alias가 아니다. 활성 모델을 증명하는
  exact telemetry discriminator이며 다음 경로를 그대로 통과한다.
  `ZenWaterSurfaceField.lastProbe.rainModelId`
  -> Pixi scene water pass의 `surfaceFieldRainModelId`
  -> worker frame telemetry
  -> runtime client metrics
  -> water-effects debug summary의 `surfaceField.rainModelId`.
- canonical surface field가 active 또는 ready이면 ID는 필수 string이고 단일
  owner의 현재 값과 정확히 같아야 한다. 누락, 숫자 coercion, unknown ID를
  빈 문자열이나 이전 ID로 보정하지 않고 named error로 fail-loud한다.
- field가 inactive이며 ID가 전달되지 않은 경우에만 telemetry 값 `null`을
  허용한다. shader 구현을 변경하거나 새 rain model을 승격할 때는 owner
  상수, field probe, worker/client normalization, debug summary, focused
  contract test를 같은 변경에서 갱신한다.

### 6.1.2 Canonical yoonseul and benthic material telemetry
- canonical surface-field yoonseul model ID의 owner는
  `src/themes/plugins/zen/pond/contracts/zenWaterSurfaceFieldYoonseulModel.js`다.
  현재 ID는 `orthographic_scatter_v1`이며 top-view blend `0.94..1.0`, analytic
  coverage roughness `0.20..0.38`, coverage weight `0.34..0.24`의 제품 상수를
  함께 소유한다. sharp core와 coverage shoulder는 같은 수면 법선과 실제
  광원 방향을 사용하며 독립 finite-facet 점광을 생성하지 않는다.
- ID는
  `PixiWaterSurfaceFieldFilter.lastProbe.yoonseulModelId`
  -> Pixi scene water pass의 `surfaceFieldYoonseulModelId`
  -> worker frame telemetry
  -> runtime client metrics
  -> water-effects debug summary의 `yoonseul.modelId`
  경로를 통과한다. canonical field가 active/ready이고 yoonseul이 enabled이면
  누락, 타입 오류, unknown ID를 named error로 fail-loud한다.
- benthic pebble material의 단일 owner는 water-effects layer이고 exact owner
  ID는 `zenPondBenthicMaterial.js`의
  `water_effects_single_owner_v1`이다. 정적 scene graph는 별도 pebble
  baseline texture/sprite를 만들지 않는다. 전역 object-blob AO container는
  제거했고, 접촉 AO는 각 장식물의 local material이 소유한다.
- `ZenBenthicMaterialFilter.js`는 기존 primary/detail 텍스처를 빌려 실제
  base/depth backdrop에 hard-light/soft-light를 적용한다. Pixi WebGL의 해당
  enum은 NORMAL로 처리되므로 이 효과를 enum으로 대체하지 않는다. 두 source
  descriptor는 타일 좌표·alpha·캐시 서명을 유지하되 `renderable=false`이며,
  source/visible sprite telemetry는 GPU draw 수가 아니라 descriptor 수다.
  `floorMaterialContainer`만 필터링하므로 바위·잉어는 이 합성 밖에 있다.
  static bake 갱신당 임시 입력 render target 하나와 filter draw 하나가 추가되고,
  cache hit에서는 floor group 전체가 숨겨져 추가 pass가 없다. 공유 텍스처의
  수명은 기존 layer cache가 소유하며 filter detach는 텍스처를 파괴하지 않는다.
- benthic telemetry는 owner ID, source/visible sprite count, primary/detail
  alpha scale을 scene -> worker -> client -> debug summary로 보존한다. source
  sprite 또는 gate가 활성인데 owner ID가 없거나 다르면 fail-loud한다.
- legacy caustic sprite suppression은 retired primary/secondary sprite에만
  적용하며 canonical overlay owner를 대체하지 않는다. canonical overlay의
  daylight-strength suppression은 아래 `daylight_hysteresis_v1` policy가
  소유한다. atmosphere mist는 자신의 `atmosphereGate`만 사용하고, shared
  texture cache signature는 `atmosphere-on|off`를 포함해야 한다.
- debug controller의 짧은 effect 이름(`benthic`, `atmosphere`, `yoonseul`
  등)은 입력 경계에서 즉시 canonical `*Enabled` key로 변환한다.
  `only`, `enable`, `disable`, `profile`은 같은 alias table을 공유하며 unknown
  alias는 계속 fail-loud한다.

### 6.1.3 Komorebi, caustic presentation, fish shadow, disturbance telemetry
- canonical canopy/komorebi owner는 water-effects layer의 single light-transfer
  mesh다. `zenPondCanopyMaterial.js`, `textureBake/canopy.js`,
  `ZenCanopyLightTransferMesh.js`, `pixiWaterEffectsCanopyPass.js`가 geometry,
  atlas, draw와 admission을 소유한다. `zenCanopyLightTransferShaderDialect.js`는
  실제 admitted WebGL version에 맞는 source interface만 선택한다. model ID는
  `canopy_branch_visibility_layered_v6` / `canopy_branch_visibility_lacy_v6`다.
  `visibleWorldBounds`에 배치되는 여섯 crown은 네 corner의 L-support 두 strip과
  두 side accent의 단일 strip, 총 열 quads (40 vertices / 60 indices)를 사용한다.
  두 512² atlas가 1 draw와 covered pixel당 두 texture reads를 공유한다.
  requested/allocated/active, texture, contrast, draw/fetch
  diagnostics는 worker/client/debug까지 보존한다. Canvas bake unavailable은
  기존 explicit `texture_bake_unavailable` failure state이며 white substitute를
  만들지 않는다. 상세 계약은 `zen-top-shadow-spec.md`를 따른다.
- canonical field caustic presentation policy owner는
  `zenPondCausticPresentation.js`이고 현재 model ID는
  `daylight_hysteresis_v1`이다. `ZenWaterBenthicCausticOverlay` superclass는 requested
  strength와 `0.0154 / 0.0196` hysteresis를 적용한 submitted strength,
  active/suppressed, draw/fetch 상태를 보존한다. suppression은 shared field
  simulation time, koi update, Home worker cadence를 변경하지 않는다.
- 모든 제품 sunlight profile은 `ZenWaterConnectedCausticOverlay`의
  `connected_sunweb_v1`을 선택한다. `lacyKomorebi`만 profile-specific이다.
  이 모델은 같은 presentation gate를 유지하면서 canonical bathymetry에서
  scene-lifetime `48 x 32 RGBA8` depth/normal receiver texture (6,144 pixel bytes)를
  만들고, 다섯 surface-field sample의 굴절 수렴을 바닥 좌표로 투영한다.
  바닥은 1 draw, field 5회 + receiver 1회 lookup을 사용한다. 기존 koi body
  draw는 같은 shader로 field 5회 lookup을 사용하고 새 draw를 추가하지 않는다.
  Night/off/suppressed 상태는 caustic draw/fetch가 0이며, 기존 koi body draw는
  caustic binding만 비활성화한다. 새 pass, worker, field owner는 없다.
  Shared receiver shader는 그림자와 동일한 48 world units 수심 변환과
  world-metric Jacobian의 principal contraction을 사용한다. 굴절 이동과
  authored contrast gain은 분리한다. 수렴 중심을
  밝히며 과집중 영역 양쪽의 determinant-zero 윤곽을 중복해서 그리지 않는다.
  aperture는 기존 수면 높이·receiver 깊이·탁도로 변하고 sample 수는 유지한다.
  수면 field는 내부 texel 밀도를 유지한 guard 영역을 추가해 crop 밖의
  입사광을 보존한다. `ZenWaterLightTransport`는 기존 canopy atlas/배치/투영을
  재사용하는 최대 256-long-edge RGBA8 map 하나를 상태 변경 시 갱신한다.
  카우스틱스는 entry/receiver 2회, 수면 반사·윤슬은 공유 1회 lookup으로
  부드러운 직접광·하늘광 투과를 분리하며 기존 canopy 합성의 중복 감쇠를
  제한적으로 보정한다. 추가 비용은 작은 map refresh draw 최대 1회이며
  별도 시계·readback·ray marching·worker는 없다.
  이는 physical meter나 별도 moving pattern이 아닌 bounded refracted gather
  approximation이다. 정확한 aperture/광량 식은
  `zen-water-surface-field-architecture.md`의 Caustic Contract가 소유한다.
  `ZenWaterBenthicCausticOverlay`의 one-tap curvature shader는 shared
  lifetime/admission superclass에 남지만 active product algorithm 선택이나
  missing-receiver fallback으로 사용하지 않는다. receiver model ID,
  surface/receiver/total fetch 수는 scene -> worker -> client -> debug summary
  경로를 보존하며 connected model에서 receiver가 누락되면 fail-loud한다.
- fish shadow는 koi body renderer의 필수 대체 owner가 아니라 scene fish sync가
  소유하는 독립 presentation sub-effect다. debug-only
  `fishShadowEnabled`는 worker runtime params까지 전달되고 per-fish
  requested/enabled/texture/geometry/point-write 및 texture-cache
  entry/reference 수를 보고한다. disable 시 rope/tail을 먼저 숨기고 shadow
  texture 참조를 제거한 뒤 cache reference를 release한다. 같은 render tick이
  참조할 수 있는 texture를 즉시 destroy해서는 안 된다.
- Frame observation DTO의 필드·숫자 정밀도·model ID 검증은
  `contracts/zenPondFrameMetrics.js`가 한 번 정의한다. Worker telemetry와
  main runtime client는 같은 projection을 사용하고, 정상적인 gain `0`을
  기본값 `1`로 바꾸지 않는다. Worker는 샘플링·first-frame ACK·journal을,
  client는 메시지 envelope와 소비자 snapshot을 계속 소유한다. 기존
  `normalizeTopShadowProbe` export는 이 계약의 water-effects projection을
  직접 재노출하며 별도 DTO 정의를 갖지 않는다.
- fish `shadowLighting` DTO는 `contracts/zenPondShadowLightingMetrics.js`의
  한 reader가 worker/client/debug 전 구간에서 소유한다. 필드는
  `directStrength`, `bottomVisibility`, `waterVisibility`, `alphaFactor` 네 개이며
  공통 광원과 receiver 응답을 그대로 보고한다. 과거 cloud/night 곡선 필드를
  복원하지 않는다. 아직 샘플이 없으면 `null`, 존재하는 샘플에 필수 숫자가
  없거나 범위를 벗어나면 명시적 오류이며 0으로 대체하지 않는다.
- canonical semantic disturbance owner는 `zenSurfaceDisturbance.js`다.
  `koi_wake`, `tap`, `petal` source별 requested/admitted/suppressed/active
  telemetry를 simulation owner에서 누적하고 worker/client 경로로 전달한다.
  presentation probe나 stale toggle snapshot을 source requested truth로
  승격하지 않는다.
- `koiWakeDisturbanceEnabled`, `tapDisturbanceEnabled`,
  `petalDisturbanceEnabled`는 debug-only source admission gate다. 기존 top-12
  shared surface-field budget과 physical simulation owner는 하나로 유지하며,
  source별 별도 ripple renderer나 fallback owner를 만들지 않는다.
- debug fixture injection은 explicit worker protocol action이고 durable state를
  쓰지 않는다. malformed source/event 또는 unknown action은 fail-loud하며,
  ambiguous post-commit timeout을 자동 retry해서 event를 중복 주입하지 않는다.
- quality `full`은 koi, surface field, pond presentation, bonsai channel의
  full-frame 계약을 유지한다. fish-shadow의 양수 `2/3/4` 값은 현재 모두 매
  rendered frame update로 해석되므로 실제 cadence tier나 비용 절감으로
  보고하지 않는다.

### 6.1.4 Static bathymetry, dynamic surface field, and shadow cutover
- Pond palette stops are authored material pigments for every preset, including
  `zen_garden`. Main must not substitute the world's already-lit water palette
  before the worker illuminates those pigments. Time/weather changes do not
  rebake the pigment texture or require a React-side world sample.
- `pixiWaterSurfaceFieldUniformResolver.js` owns moonlit display adaptation in
  the existing material/sky pass. A continuous night-depth response preserves
  pigment contrast in a dark silver-blue range and keeps reflected sky subdued under
  moonlight. The 2026-10-02 linear-light response is `nightDepth * (0.18 +
  moonlight * 0.14)` with RGB weights `[1.02, 1.12, 1.86]`; its bounded lunar slope
  raises pale living material while dark pigment retains depth. Sky
  strength is `nightDepth * (0.06 + moonlight * 0.16) * (1 - cloudiness * 0.5)`.
  These replace the prior visibility coefficients in the same pass; no later
  tint, exposure overlay or additional correction stage is applied.
  Near the horizon, a continuous twilight visibility bridge covers the interval
  between night-depth fading and direct sunlight becoming available; it fades
  out by roughly ten degrees of solar elevation.
  The shader uses linear RGB for illumination and luminance-based desaturation;
  it does not lift every pixel to a constant RGB floor. This is presentation
  exposure, not a new world irradiance source or a fallback for missing state.
  The canonical sun vector, physical direct/diffuse channels, caustic admission,
  and directional shadows remain unchanged. Koi's body-only authored moon key
  is described in the locomotion/fin contract and is not a world moon bearing.
  Daytime has zero moonlit chroma/sky contribution. No extra texture, sampler,
  renderer pass, worker message, or animation loop is allocated.
- Koi scene tint yields its night attenuation to that material pass only while
  the canonical field surface filter is actually attached. The effects pass
  reports this scalar ownership to entity sync; an algorithm ID alone cannot
  establish attachment. Night-depth continuously neutralizes the redundant
  CPU scene tint, so white koi remain silver against the readable night floor.
- Submerged rock tint likewise yields its duplicate night attenuation only
  under that confirmed attachment. Floating pads own silver-green pigment
  tint above water optics; existing decor meshes reveal convex form from the
  shared night/moon scalars. See `zen-pond-shadow-and-viewport-spec.md` for
  material/cache ownership. Daytime calibration and physical shadows remain.
  Daytime tint, slot pigment/alpha, physical mesh lighting and shadow projection
  are unchanged. Lab/no-filter paths retain their own scene-tint behavior.
  `resolveZenKoiMoonlightPresence` projects the same required world night/moon
  channels into one bounded body uniform only while this pass is attached. The
  existing curved form provides pose-dependent silver sheen with no extra draw,
  texture, silhouette or physical-light feedback.
- canonical bottom geometry contract는
  `contracts/zenPondBathymetryContract.js`, product SSOT는
  `world/fields/zenPondBathymetryField.js`다. 기본 표현은 scene seed와 world
  크기로 결정되는 immutable `48 x 32 Uint16` field이고 depth semantic은
  `zero_surface_positive_bottom`이다. 누락, forged descriptor, invalid
  coordinate는 flat bottom이나 baked texture로 보정하지 않고 fail-loud한다.
- `zenPondWorkerWorldSync.js`가 scene-generation key, field 생성, 검증,
  `bathymetryFieldRef` 갱신을 소유한다. 같은 field ref는 Pixi bottom-material
  및 shadow presentation consumer에 전달되지만, 실제 causal consumer가 없는
  generic simulation kernel에는 전달하지 않는다. renderer/quality remount만으로
  다시 생성하지 않으며 world 크기, scene generation, seed, field
  model/version/grid가 바뀔 때만 key가 바뀐다.
- bathymetry는 정적인 pond-bottom geometry이고
  `waterSurfaceField/ZenWaterSurfaceField.js`는 매 frame 갱신되는 동적
  height/slope/curvature presentation field다. 둘을 한 texture, cache key,
  lifecycle owner로 합치지 않는다. bathymetry-specific depth-texture export는
  one-way presentation projection일 뿐이며 Canvas/GPU readback은 geometry
  입력이 될 수 없다. Field ref 배선이나 projection export가 존재하는 것만으로
  active product depth-material resolver가 cutover된 것으로 보지 않는다.
- active product shadow projection은 `runtime/zenPondShadowProjection.js`와
  `contracts/zenPondShadowGeometry.js`를 쓴다. `pixiFrameChannels.shadowLight`는
  기존 sun vector와 direct/diffuse channels를 한 번만 투영한다. scene fish
  sync와 rock sync가 immutable bathymetry의 bottom depth를 읽고, `48` logical
  world units/depth의 presentation 변환으로 receiver gap을 구한다. 돌 기부는
  bottom에 고정되고 윗면 footprint까지 이어지는 cast를 만든다. 연잎은 수면의
  얇은 면, 꽃은 그 위의 raised silhouette다. `PixiKoiFish`는 scene이 전달한
  explicit offset을 소비하여 shared Nudge domain의 고정 offset을 대체한다.
  이 변경은 geometry receiver의 좁은 product port이며 새 continuous depth
  simulation이나 koi-on-koi effect를 도입하지 않는다.
- `model/koi/zenKoiShadowTransport.js`와
  `pixiKoiBodyReceiverEffectLease.js`는 detached research용 pure geometry/local
  attachment seam으로 남아 있고 active product 투영의 authority가 아니다.
  후자는 요청될 때만 existing rope points를 공유하며 기본 node/RT를 만들지
  않는다. 공용 material resolver를 import하는 research candidate도 새 explicit
  shadow light contract를 만족해야 한다.
- bathymetry depth-material cutover, sparse koi-on-koi receiver shadow,
  continuous 2.5D koi depth 및 후보별 lifecycle/performance 비교는 여전히
  `scripts/dev/zen-pond-render-research/**`의 research-only 구현이다.
  product에서 research module을 import하지 않는다. 이번 그림자 변경의
  시각/구조 검증은 runtime total-frame 또는 p95/Home-contention 성능 인증을
  대신하지 않는다. 상세 owner/height/cache 계약은
  `zen-pond-shadow-and-viewport-spec.md`를 따른다.
- 위 research-only 목록은 `connected_sunweb_v1`의 좁은 benthic-light
  receiver projection을 포함하지 않는다. 그 projection은 bottom material이나
  koi shadow owner를 교체하지 않고 immutable bathymetry를 조명 receiver로만
  소비한다.

### 6.2 세션 상태
- 물리 Home session: 첫 channel acquire에서 생성되고 마지막 channel release에서 종료된다.
- Pond channel: `idle` -> `initializing` -> `running` -> `stopping` -> `disposed`
- Pond/Bonsai channel은 독립적으로 mount/release할 수 있지만, 같은 channel의
  동시 acquire는 `ZEN_HOME_RENDERER_CHANNEL_ALREADY_ACQUIRED`로 fail-loud한다.
- Bonsai logical renderer는 `ACTIVE=false`에서 자신의 continuous loop를 실제로
  정지한다. 비활성 scene/resize 메시지와 진행 중이던 비동기 render의 완료는
  scheduler를 다시 시작하지 않는다. `ACTIVE=true` 전환은 보존된 scene/frame
  identity로 즉시 render를 요청하고 새 loop를 시작하므로 정지 중 elapsed time을
  simulation catch-up으로 소비하지 않는다. 반복된 active 메시지는 loop를 중복
  생성하지 않으며 `dirty` mode는 재활성화해도 continuous loop를 갖지 않는다.
  이 수명은 Bonsai channel이 소유하며 physical Worker/admission 수명과 분리된다.
- Bonsai의 `RESIZE`와 투영된 `SCENE`은 별도의 FIFO 메시지다. surface의 CSS 크기,
  backing 크기 또는 pixelRatio가 마지막 scene의 크기와 다르면 해당 scene은
  새 renderer 크기에 그리지 않고 명시적인 surface-pending 상태로 대기한다.
  비동기 renderer 준비 이후에도 같은 조건을 검사한다. 새 scene 수신에서만
  크기 commit을 갱신하며, 빠른 resize가 원래 commit 크기로 돌아오면 그 exact
  scene을 다시 그릴 수 있다. 이전 sky/soil device geometry를 잘라 맞추거나
  비 효과 검증을 완화하지 않는다.
- 물리 또는 channel 실패 시 explicit error/telemetry를 surface한다.
  main-thread semantic fallback이나 새 물리 Worker 재시도는 두지 않는다.
- channel runtime의 uncaught throw/rejection은 physical terminal failure로
  승격한다. rejected FIFO를 유지한 채 sibling만 동작시키는 부분 생존 상태는
  허용하지 않는다.
- physical Worker callback은 generation-fenced다. 종료된 Worker의 late
  message/error/revocation은 새 physical session에 적용하지 않는다.
- Pixi Worker environment 설치는 physical Home entry가 한 번만 소유한다.
  Pond/Bonsai logical runtime은 준비 상태만 assert하며
  `window/globalThis.devicePixelRatio`를 읽거나 쓰지 않는다.
- Physical Home Worker의 Pixi package surface는
  `src/themes/plugins/zen/runtime/worker/zenPixiWorkerRuntime.js` 하나가 소유한다.
  Pond와 Bonsai renderer는 이 seam의 명시적 Application/core/display/graphics/
  mesh/sprite/text API만 소비한다. `pixi.js` umbrella, accessibility, assets,
  compressed-textures, text-html package는 worker admission graph에 넣지 않는다.
  Worker adapter의 `@pixi/settings` 접근은 별도 environment seam만 소유한다.
- 같은 package seam은 공개 `extensions.add`/`ExtensionType.RendererPlugin`으로
  native `BatchRenderer`의 좁은 subclass를 `batch`에 한 번 등록한다.
  `pond/renderers/pixi/zenPondSpriteBatchShader.js`는 Pixi import 없는 source/class
  factory이며, seam이 native `BatchRenderer`/`BatchShaderGenerator`/`Program`을
  주입한다. 명시적으로 소유한 다섯 Zen renderer host만 생성 options에
  `zenPondSpriteBatchDialect: true`를 넣는다: Pond host,
  `createZenBonsaiPlumePixiRenderer`, `createZenBonsaiG15PixiRenderer`,
  `createPixiBonsaiRenderer`, `zenArtifactEngine`. 기존 flag 이름은 공개 hook
  계약으로 유지한다. Flag 없는 renderer는 원래 `setShaderGenerator(options)`를
  호출한다. Flag가 있는 renderer의 공개 `generateShader`는 native context admission 뒤 실제
  `renderer.context.webGLVersion`으로만 source를 선택한다. WebGL1은 원래
  `BatchShaderGenerator.generateShader`를 그대로 호출한다. WebGL2는 lazy native
  `Program`의 JS source 준비를 통해 원래 vertex/fragment precision 및 platform
  downgrade 정책을 먼저 적용하고, `createZenPondSpriteBatchWebGL2Sources`가 이
  source의 interface만 GLSL300으로 표현한다. 이 source-preparation Program은
  compile/bind하지 않는다. Cached native WebGL2 generator는 원래 linear sampler
  ladder의 `texture2D` 호출만 `texture`로 바꾼다. Sampler 수, 상수 index, 모든
  half-step 구간, 색상 곱 및 transform 수식을 바꾸지 않는다.
  명시적 attribute 위치는 native 이름순인 `aColor=0`, `aTextureCoord=1`,
  `aTextureId=2`, `aVertexPosition=3`이고 fragment output은 location 0이다.
  원래 Pixi compiler는 GLSL300에서 자신의 네 attribute bind와 두 번째 link를
  생략한다. Reflection, uniform/cache, context restore, geometry packing/pool,
  blend/alpha/transform, draw 순서와 disposal은 Pixi가 그대로 소유한다.
  실제 version이 1/2가 아니거나 없으면
  `ZEN_POND_SPRITE_BATCH_WEBGL_VERSION_INVALID`, source의 native attribute 계약이
  다르면 `ZEN_POND_SPRITE_BATCH_ATTRIBUTE_LAYOUT_INVALID`로 실패한다.
  별도 compiler/metadata, 추가 external GL query, global settings/prototype 변경,
  생성 뒤 재초기화, shader 실패 재시도 또는 quality/readiness 변경은 허용하지 않는다.
  Pond는 `Graphics`를 사용하지 않는다. Native Graphics의 pluginName별 shared
  direct-shader cache에 Pond GLSL300 program을 넣으면 다른 context의 WebGL1
  Graphics에 재사용될 수 있으므로, 새 Pond Graphics 경로는 별도 이름/캐시
  경계 검토와 matching guard 변경 없이 추가하지 않는다.
  균형 sampler-tree source 후보는 실제 program 준비 시간이 증가해 제거했다.
  이 source 변경의 동등성은 latency 증명을 대신하지 않는다. 첫 native program,
  첫 tick 및 전체 reveal의 실제 비교 후 성능 결론을 기록한다.
- 같은 package seam은 공개 `extensions.add`로 native `TilingSpriteRenderer`의
  좁은 subclass를 `tilingSprite`에 한 번 등록한다. 기존 `batch` 등록과 합쳐
  두 named renderer plugin만 specialize한다. `pond/renderers/pixi/zenPondTilingSpriteShader.js`는
  Pixi import 없는 source/class factory이고 seam만 native `TilingSpriteRenderer`와
  `Shader`를 주입한다. 위의 같은 다섯 Zen host만
  `zenPondTilingSpriteDialect: true`를 생성 options에 명시한다.
  공개 `contextChange`는 flag가 있을 때 실제
  `renderer.context.webGLVersion`이 1/2인지 먼저 검증하고 native
  `super.contextChange()`를 정확히 한 번 호출한다. Flag 없는 renderer와
  WebGL1의 두 shader/source는 원래 그대로다. Flag가 있는 WebGL2는 공개
  `simpleShader.program`의 준비된 source 한 쌍만 GLSL300으로 변환하고 공개
  `Shader.from`으로 `simpleShader`를 교체한다. 이전 Shader의 `uniformGroup`을
  그대로 전달하므로 plain uniform object, `globals`, 일반 tiling shader와의
  공유 관계를 보존한다. 교체된 임시 native Shader는 `destroy()`로 해제하며
  Program/cache와 GL handle을 직접 수정하거나 해제하지 않는다.
  `createZenPondTilingSpriteWebGL2Sources`는 기존 `#version 100` 행을 교체하고
  attribute/varying/output 및 `texture2D` 문법만 바꾼다. 양 stage의 명시적
  `precision lowp float`, 원래 UV/transform/color 수식과 uniform은 유지한다.
  명시적 attribute 위치는 native 이름순인 `aTextureCoord=0`,
  `aVertexPosition=1`이고 fragment output은 location 0이다. 이미 native
  GLSL300인 일반 tiling shader는 바꾸지 않는다. Native `render`, `QuadUv`,
  repeat/clamp 선택, tint/alpha/blend, draw 순서/횟수 및 context/disposal 수명은
  그대로다. 실제 version이 1/2가 아니거나 없으면
  `ZEN_POND_TILING_SPRITE_WEBGL_VERSION_INVALID`, source의 version/precision/
  varying/attribute/sampling 계약이 다르면 `ZEN_POND_TILING_SPRITE_SOURCE_INVALID`로 실패한다.
  별도 compiler/metadata/cache, 추가 GL query, global settings/prototype 변경,
  render/lifecycle 재구현 또는 shader 실패 재시도는 허용하지 않는다.
  Native compiler가 GLSL300에서 자신의 attribute bind/relink를 생략하는
  효과와 latency 개선은 구분하며 실제 program/first-tick/reveal 비교로 판단한다.
- Pond scene의 renderer/stage/view/destroy 소유자는
  `pond/renderers/pixi/createZenPondPixiRendererHost.js`다. Pond projection의 공개
  `Renderer`와 `Container`를 직접 생성하고 scene의 기존 AA, DPR, transparency,
  autoDensity, view 및 render options를 그대로 전달한다. WebGL-only Pond admission은
  임시 canvas/context를 만드는 Application auto-detection을 실행하지 않는다.
  실제 renderer context의 stencil은 필수이며 누락 시
  `ZEN_POND_PIXI_STENCIL_REQUIRED`로 실패하고 생성한 renderer를 정리한다.
  실제 WebGL context 생성, context-loss 처리, rendering system 및 viewport resize는
  공개 Pixi Renderer가 계속 소유한다. Shared `Application` export는 Bonsai 비교
  구현의 기존 계약을 위해 유지한다.
- 같은 host의 renderer admission 관측은 debug build capability와 기존 explicit
  render telemetry opt-in일 때만 설치한다. Worker engine은 기존 timeline에
  `startup_renderer_admission`을 기록한다. `constructorMs`는 원래 공개 Renderer
  생성 전체를, `stencilReadMs`는 이미 필수인 실제 context attribute read를 감싼다.
  Stencil 검증은 관측 여부와 무관하게 유지하며 추가 context/GL query를 만들지 않는다.
  Disabled 관측은 clock/GL 호출을 추가하지 않고 관측 실패는 native 결과/오류를
  변경하지 않는다. 두 span은 driver/shared Home Canvas raster queue wait를 포함할
  수 있는 inclusive native wall time이며 순수 context 생성, shader compile 또는
  GPU 실행 시간으로 해석하지 않는다.
- Pond frame scheduling은 worker engine 또는 scene의 explicit `useTicker` loop가
  소유한다. Pixi Application ticker/resize/event plugin을 설치하거나 소비하지 않는다.
  Host dispose는 기존 stage options와 removeView를 그대로 전달하며 stage 해제가
  실패해도 renderer 해제를 시도하고 각 오류를 aggregate로 전달한다. Canvas/context
  보존 정책은 scene dispose의 기존 exact owner가 유지한다.
  Regression: `tests/themes/zenPondPixiRendererHost.test.js`는 단일 실제 renderer
  생성, 실제 stencil 검증, 정확한 options/view, allocation 실패 및 독립적인 owned
  resource cleanup을 검증한다. Latency와 full-quality ACK는 별도 실제 boot로 확인한다.
- Pond shader compilation, reflection/default metadata, context cache, binding 및 GL
  handle disposal은 원래 Pixi 7.4.3의 공개 `ShaderSystem`이 그대로 소유한다.
  Custom compiler, metadata clone, single-link 및 selected-water batch 후보는
  통제된 Tools 복귀 측정에서 준비 latency가 증가해 제거했다. 이 compiler-owner
  후보들과 별개로, `waterSurfaceField/zenWaterSurfaceFieldShaderDialect.js`는
  `ZenWaterSurfaceField` 한 쌍의 source dialect만 실제
  `renderer.context.webGLVersion`에서 생성 전에 한 번 선택한다. WebGL1은 기존
  GLSL ES 1.00 source를 byte-for-byte 보존하고 WebGL2는 동일 field 수식을
  GLSL ES 3.00으로 표현한다. 이 field dialect seam은 다른 Pond shader를 변경하지 않는다.
  GLSL300의 명시적 attribute 위치는 기존 Pixi 이름순 위치인
  `aTextureCoord=0`, `aVertexPosition=1`이며 출력은 location 0이다. 양 stage의
  highp, uniform, geometry, 수식, field 크기, texture/draw 수 및 full effects는
  동일하다. Shader interface와 ES300 예약어 `sample`/`active`의 식별자만
  변환한다. Context 생성/조회, global settings, metadata 또는 GL compiler를
  교체하지 않는다. 원래 Pixi generator가 version300 source에서 자신의
  attribute bind/relink 분기를 생략하며 이후 reflection/cache/binding/disposal은
  계속 소유한다. WebGL version이 1/2가 아니거나 없으면 allocation 전에
  `ZEN_WATER_SURFACE_FIELD_WEBGL_VERSION_INVALID`로 실패한다. 이는 지원되는
  두 context의 명시적 source dialect 경계이며 compile 실패를 catch해서 다른
  shader로 재시도하는 경로가 아니다. Quality, scheduling 및 두 실제 prime frame의
  first-frame ACK 계약은 그대로다. Link 호출이 하나 줄었다는 사실만으로
  latency 절약을 확정하지 않으며 실제 프로그램 전체/first tick/reveal과
  field 출력의 비교가 필요하다.
- 별도 consumer seam `waterSurfaceField/zenWaterSurfaceFieldFilterShaderDialect.js`는
  `PixiWaterSurfaceFieldFilter` 생성 시 presentation이 전달한 실제 WebGL version만
  소비한다. WebGL1의 `super(null, selectedFragment)`와 원래 production/optics
  fragment는 그대로 유지한다. WebGL2는 공개 `Filter.defaultVertexSrc`의 UV/crop
  수식과 authored highp fragment를 동일한 GLSL300 interface로 표현한다.
  `aVertexPosition=0`, smooth `vTextureCoord`, location-0 output만 명시하며
  production 35개 / optics 40개 combined uniforms와 모든 texture/math를 보존한다.
  Native Filter apply, compiler/reflection/cache/disposal과 기존 resolution,
  pass/draw 수, 두 실제 prime frame의 ACK는 바꾸지 않는다. 버전 누락/불일치는
  native allocation 전에 `ZEN_WATER_SURFACE_FIELD_FILTER_WEBGL_VERSION_INVALID`,
  변환 interface 불일치는 `ZEN_WATER_SURFACE_FIELD_FILTER_SHADER_SOURCE_INVALID`다.
  Capability probe나 compile retry는 없으며 실제 latency/pixel 검증은 canonical
  QA가 맡는다. 상세 owner/계약은 `zen-water-surface-field-architecture.md`를 따른다.
- `zenKoiMaterialShaderDialect.js`는 실제 scene WebGL version을 entity sync,
  `PixiKoiFish`, display factory, `ZenKoiMaterialRope`에 전달하여 body source만
  선택한다. WebGL1은 원본 `Shader.from` 입력을 보존하고 WebGL2는 동일 effective
  highp, 25 uniforms, 다섯 smooth varyings와 material/solar/moonlit/caustic 수식을
  GLSL300으로 표현한다. 원래 이름순 위치 `aKoiAcross=0`, `aTextureCoord=1`,
  `aVertexPosition=2`와 fragment output 0을 명시한다. Native compiler의 세
  attribute bind와 두 번째 link만 생략되며 reflection/cache/geometry/draw/lifetime은
  Pixi가 유지한다. Shadow는 아래 별도 material seam으로 선택하며 body 변환과
  source/metadata를 섞지 않는다. 잘못된 version은
  texture lease/display/rope allocation 전에 `ZEN_KOI_MATERIAL_WEBGL_VERSION_INVALID`,
  변환 interface 불일치는 `ZEN_KOI_MATERIAL_SHADER_SOURCE_INVALID`다. Quality와
  두 실제 prime-frame ACK는 그대로이며 wall-time 이득은 canonical QA로 검증한다.
  상세 body 계약은 `zen-koi-locomotion-and-fin-presentation.md`를 따른다.
- `waterSurfaceField/zenWaterConnectedCausticShaderDialect.js`는 presentation의
  connected factory branch가 전달한 실제 `renderer.context.webGLVersion`만
  소비한다. WebGL1은 connected overlay 원본 pair를 보존하고 WebGL2는 동일
  highp, 18 combined uniforms, smooth `vTextureCoord`, shared receiver/transport
  수식을 GLSL300으로 표현한다. 기존 위치 `aTextureCoord=0`, `aVertexPosition=1`와
  output 0을 명시하여 native Pixi의 두 attribute bind와 두 번째 link만 생략한다.
  Native `Shader.from`, reflection/context cache, quad/SCREEN draw, visibility,
  superclass 임시 shader disposal과 receiver/borrowed texture lifetime은 그대로다.
  잘못된 version은 superclass/receiver allocation 전에
  `ZEN_CONNECTED_CAUSTIC_WEBGL_VERSION_INVALID`, interface 불일치는
  `ZEN_CONNECTED_CAUSTIC_SHADER_SOURCE_INVALID`로 실패한다. Comparison superclass,
  koi body, quality, scheduling과 두 실제 prime-frame ACK는 변경하지 않으며
  capability query, compiler 교체, global 변경이나 retry는 없다. 상세 계약은
  `zen-water-surface-field-architecture.md`, 실제 latency/pixel 검증은 canonical
  QA가 맡는다.
- `waterSurfaceField/zenWaterLightTransportShaderDialect.js`는 existing renderer의
  실제 context version을 transport allocation 전에 검증한다. WebGL1 generated
  six-crown pair는 byte-for-byte 유지하고 WebGL2는 같은 highp, 12 uniforms,
  `uLayout[6]`, `uCrownProjection[6]`과 atlas/composition 수식을 GLSL300으로
  표현한다. `aTextureCoord=0`, `aVertexPosition=1`, smooth `vUv`, output 0을
  명시해 native Pixi의 두 attribute bind와 두 번째 link만 생략한다. Native
  `Shader.from`, array reflection/context cache, guarded target/quad draw,
  change-only refresh와 borrowed canopy arrays/atlases lifetime은 그대로다.
  Version 누락/불일치는 `ZEN_WATER_LIGHT_TRANSPORT_WEBGL_VERSION_INVALID`,
  malformed interface는 `ZEN_WATER_LIGHT_TRANSPORT_SHADER_SOURCE_INVALID`로
  target/geometry/shader 생성 전에 실패한다. Capability query, compiler 교체,
  global 변경이나 retry는 없으며 quality와 두 실제 prime-frame ACK는 유지한다.
  상세 계약은 `zen-water-surface-field-architecture.md`, latency/pixel evidence는
  canonical QA를 따른다.
- `pond/renderers/pixi/zenPondMaterialShaderDialect.js`는 네 fixed owner
  (`decor_material`, `decor_shadow`, `koi_shadow`, `benthic_material`)의 source
  interface만 실제 scene context에서 선택한다. Entity sync와 Koi display는
  admitted numeric version을 각 mesh/rope/tail에 전달하고, water presentation의
  sprite binder는 같은 version을 floor Filter에 전달한다. 누락/지원하지 않는
  version과 잘못된 source는 native geometry/shader/filter allocation 전에
  `ZEN_POND_MATERIAL_WEBGL_VERSION_INVALID` /
  `ZEN_POND_MATERIAL_SHADER_SOURCE_INVALID`로 실패한다. Unknown owner는
  `ZEN_POND_MATERIAL_PROGRAM_ID_INVALID`다.
  Owner ID는 primitive string으로만 받으며 boxed/coerced 값이나 alias는 허용하지 않는다.
  WebGL1 입력은 byte-for-byte 유지하며 floor는 원래 null vertex로 native default
  Filter를 사용한다. WebGL2는 mesh의
  `aTextureCoord=0`, `aVertexPosition=1`, floor의 `aVertexPosition=0`과 output 0을
  명시한다. Authored smooth varyings, effective highp, uniforms, texture reads,
  cast/contact/relief 수식과 기존 geometry/blend/draw/cache/lifetime은 유지한다.
  Default Filter vertex에 native highp를 명시한다. Native fragment 준비의 기본
  mediump/highp prefix는 뒤따르는 authored highp에 의해 재선언되므로, 그 prefix를
  생략한 GLSL300도 실제 material precision을 낮추지 않는다. Native Pixi는
  compilation/reflection/default values/context caches를 계속 소유하며 자신의
  attribute bind와 두 번째 link만 생략한다. Compiler/cache 교체, query, global
  precision 변경, fallback/retry, scheduling/quality 또는 두 prime-frame ACK 변경은 없다.
- `runtime/pixi/zenPixiOwnedShaderDialect.js`는 추가 여섯 fixed owner
  (`shoji`, `great_wave`, `shishi_water`, `bonsai_paper`,
  `water_surface_comparison`, `benthic_caustic_comparison`)의 동일한 source-only
  경계다. Artifact engine이 실제 renderer version을 scene factory에 전달하고,
  G15 paper는 실제 Application renderer version을 Filter factory에 전달한다.
  Water comparison consumers는 기존 presentation renderer version을 전달한다.
  Unknown version/owner/source는 named `ZEN_PIXI_OWNED_SHADER_*` 오류로 allocation
  전에 실패하며 owner ID는 coercion 없는 primitive string이다.
  Shishi scene의 기존 construction cleanup은 owned root children/local shaders를
  해제한 뒤 원래 failure를 다시 던진다. 이 lifecycle catch는 source 재시도나
  대체 scene 반환을 허용하지 않는다. WebGL1 raw source와 Filter null vertex는 유지한다. WebGL2는
  fixed typed attributes, matching smooth varying, output 0과 texture 호출 문법만
  바꾼다. Shoji의 projective UV와 Shishi water의 authored mediump fragment를
  포함한 모든 수식/정밀도/texture/draw/lifetime은 그대로다. 정밀도가 없는 native
  default Filter/Shishi vertex에는 원래 effective highp를 명시한다. 이 seam은
  arbitrary Pixi source를 감싸거나 다른 theme에 적용하지 않으며 native Graphics의
  shared direct-shader cache를 변경하지 않는다. Source 동등성과 호출 감소는
  focused native tests로, 실제 latency/pixel 결과는 canonical QA로 각각 검증한다.
- Koi cold texture resource는 `koiTextureCache/createPixiKoiTextureCacheCore.js`가
  소유한다. `bakeBody.js`의 body form과 `packShadow.js`의 packed body/tail coverage
  세 map은 완성된 opaque RGBA8 `Uint8Array`를 공개 `BaseTexture.fromBuffer`에
  직접 전달한다. 정확한 byte/size, 기존 resolution, LINEAR sampling,
  MIPMAP_OFF, anisotropy와 `BaseTexture.defaultOptions` (Canvas 경로의 alpha mode
  포함)를 보존하며 output Canvas, `putImageData` 또는 data mirror를 만들지 않는다.
  Source kind/type, 양의 정수 dimension (최대 8192), 정확한
  `width * height * 4` byte length가 잘못되면
  `ZEN_PIXI_KOI_RGBA8_SOURCE_INVALID`로 실패하고 clamp나 대체 source를 쓰지 않는다.
  Body/fin/tail vector raster, shadow silhouette 및 blur/readback Canvas와 그
  context options는 그대로다. Cache key/admission, Texture-owned shadow bounds,
  refcount와 기존 deferred destroyBase 수명이 BufferResource 해제를 계속 소유한다.
- `runtime/worker/zenPixiProgramDiagnostics.js`는 scene renderer 인스턴스의
  원래 `ShaderSystem.generateProgram`만 감싸는 작은 관측 owner다.
  `installZenPixiProgramDiagnostics`는 shared package seam과 Pond projection을
  통해 노출되며 `__ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__` capability **및** 기존
  `qualityProfile.telemetry.enabled === true` opt-in (`--gpu-timing`)일 때만 설치한다.
  기본 DEV와 production은 owner가 null이고 원래 Pixi method를 그대로 사용한다.
  별도 version failure, GL/caps/KHR query, bind override, cache/metadata owner,
  compiler scheduling, global prototype patch 및 deep import는 추가하지 않는다.
- `pond/renderers/pixi/telemetry/zenCanopyPreparationResearch.js`는 관측 owner와
  분리된 개발 전용 준비 순서 실험이다. Canonical `dashboard/boot`의
  `--canopy-preparation=before-first-draw`만 이를 요청하며 Zen, 고정 noon/full
  fixture, idle interaction 및 명시적 `--gpu-timing=true`를 요구한다. 기본값
  `native`와 production은 실험을 만들거나 실행하지 않는다. 별도 storage,
  page/global probe 또는 새 브라우저 owner는 없다.
  Fresh scene의 첫 `prepareFirstFrameAssets`에서 layer READY를 확인한 뒤,
  아직 첫 Pond draw가 시작되기 전에 실제 canopy Shader를 공개
  `renderer.shader.generateProgram(shader)`에 정확히 한 번 전달한다. Pixi가
  원래 compilation/reflection/context cache를 소유하고 이후 native bind가
  그 결과를 재사용한다. GL query, bind, upload, draw, cache 조회/수정, async
  yield, retry 및 compiler 구현 교체는 금지한다. 두 번째 준비 호출과 잘못된
  admission은 명시적 오류로 실패하며 native 오류도 그대로 전달한다.
  `canopy_pre_draw_prepare` phase는 기존 observer가 호출을 식별하는 label이며
  관측 owner 자체는 scheduling을 변경하지 않는다. 모든 startup program을
  포함하여 동일 canopy의 한 번 생성, 총 program/native call 수와 readiness를
  확인해야 한다. 첫 tick 밖으로 옮겨진 시간을 절약으로 계산하지 않는다.
  이 실험은 앞선 Pond draw 의존성만 제거한다. 공유 Home Canvas/driver queue
  대기는 남을 수 있어 순수 compiler CPU/GPU 비율을 확정하지 않는다.
  Production closure guard가 실험 실행 코드와 marker 제거를 검사한다.
  준비 비용의 소유 관계가 해결되어 이 비교가 더 필요하지 않으면 해당
  QA 옵션과 실험 seam을 함께 제거한다.
- 최대 24 native call과 2 context UID의 stable source-derived name, source length,
  bounded phase, program admission ordinal/parent ordinal, 전체 native-call wall
  time 및 성공/실패를 기록한다. Pixi의
  `SHADER_NAME` ordinal만 fingerprint에서 제거하며 source text, uniform 값,
  사용자 data 또는 native error payload는 전송하지 않는다. Overflow count와
  `observationFailureCount`/`lastObservationFailureName`은 기존 lifecycle summary에
  보존한다. 관측 clock/metadata 실패가 원래 native return/error를 변경하지 않는다.
- 첫 실제 ACK 뒤 finish 및 scene dispose는 exact original method descriptor를
  복원한다. 다른 instance owner가 설치한 새 wrapper는 덮어쓰지 않는다.
  기존 `startup_program_context:<uid>`, `startup_program_compile:<index>` 및
  summary/finished milestone과 ACK/metrics transport만 사용한다. Steady-frame
  관측, 별도 timer/message loop 또는 page/global GL probe는 추가하지 않는다.
  `totalMs`는 driver wait와 opt-in 관측 비용을 포함하는 Worker wall time이며
  GPU 실행 시간으로 해석하지 않는다.
  같은 GPU service의 Canvas raster queue 대기도 native `generateProgram` wall에
  포함될 수 있으므로 이를 해당 shader의 순수 compile 비용으로 단정하지 않는다.
  Regression: `tests/themes/zenPixiProgramDiagnostics.test.js`는 원래 공개 Pixi
  output/metadata/cache/GL call parity, 정확한 receiver/argument/return/error,
  관측 실패, bounded evidence, finish/dispose restoration 및 disabled admission을 검증한다.
- `runtime/worker/zenPixiProgramGlCallDiagnostics.js`는 동일 debug capability와
  명시적 telemetry opt-in 안에서만 원래 `generateProgram` 실행 중의 GL instance
  method를 관찰한다. Native receiver/arguments/return/error와 원래 own/inherited
  descriptor를 보존하며 prototype은 변경하지 않는다. Shader compile, first link,
  relink, 기존 LINK_STATUS/ACTIVE_ATTRIBUTES/ACTIVE_UNIFORMS 조회, 기존 attribute/
  uniform reflection 및 location/bind, create/source/attach/delete/setup call을
  고정 operation group으로 집계한다. 추가 GL query, compile/link, flush, sync,
  readback, KHR 조회, task yield 또는 quality/readiness 변경은 없다.
- Contract `zen_pixi_program_gl_calls_v1`은 모든 관찰 call의 group count, 관측
  count, failure count, total/max wall time과 최대 6개의 가장 느린 call을 원래
  호출 순서로 보관한다. 세부 기록에는 Worker-local start/end, call ordinal,
  당시 link ordinal, method/group만 포함하며 source/uniform 값/GL object는
  포함하지 않는다. Nested program은 active owner stack으로 구분하고 관찰
  admission 범위를 넘은 하위 호출은 부모 집계에 섞지 않는다. Program/GL wall
  span은 inclusive 관찰이므로 서로 더하지 않는다. Nested native GL call이
  재진입하면 외부 wall에 내부 작업이 포함될 수 있다.
- `startup_program_gl_summary:<programOrdinal>`은 group 집계를 bounded primitive
  key로 펼치고 `startup_program_gl_call:<programOrdinal>:<callOrdinal>`은 slow call을
  같은 program name/context/phase/ordinal로 연결한다. 기존 runtime-health
  ring은 64건 그대로이며 unique milestone은 ring eviction 뒤에도 보존된다.
  Disabled/unavailable 관찰은 null 시간과 explicit reason으로 구분하며,
  clock 실패는 null start/end/duration과 incomplete/failure count를 남긴다.
  GL wrapper 부분 설치 실패는 설치된 descriptor를 즉시 rollback하고 원래 native
  호출을 진행하며 관측 실패를 보고한다. Native exception에도 finally로 복원하고,
  나중에 설치된 owner는 덮어쓰지 않고 conflict를 기록한다. 관측 오류는 원래
  native return/error를 바꾸지 않는 debug-only degradation이며 runtime, storage
  또는 renderer 대체 경로가 아니다. 첫 실제 ACK/dispose가 관측 수명의 종료 조건이다.
  Public compilation은 observer/clock/metadata/contract marker를 제거하며 public
  worker artifact guard가 marker 부재를 검사한다.
- Native `compileShader`/`linkProgram`은 enqueue 비용만 드러낼 수 있고,
  LINK_STATUS/reflection 또는 relink 뒤 첫 `getUniformLocation`에 이전 GL 작업의
  completion/driver 대기가 포함될 수 있다. 개별 call wall이 실제 shader의 순수
  compile/link 시간이나 GPU service 내부 CPU/GPU 비율을 확정하지는 않는다.
- Pond DPR은 `runtimeState.dpr`의 explicit input이다. active Pixi scene이
  renderer resolution, world render texture resolution, canvas backing-store
  resize를 원자적으로 소유하고, worker canvas lifecycle은 이들을 직접
  변경하지 않는다.
- CSS 크기와 DPR signature는 `zenPondViewportMetrics.js`가 함께 만든다.
  mount client의 단일 resolution media-query observer가 DPR-only 변경을
  전달하고 dispose 시 해제한다. Surface의 dprCap은 기기 DPR과 독립적인
  pixel-budget 상한이다. renderer는 새 viewport state를 먼저 commit한 뒤
  cover transform/visible bounds/filter crop을 갱신한다. 200ms settled resize는
  `zenPondViewportPolicy.js`로 패널 비율의 월드를 확정하고 기존 renderer,
  simulation kernel, entity identity를 보존하며 공간만 갱신한다. world 크기에
  의존하는 bathymetry/바닥 캐시는 갱신하고 시드와 애니메이션은 유지한다.
  입력은 viewport 좌표로 전달해 worker의 현재 camera에서 변환한다.
  상세 정책은 shadow/viewport spec을 따른다.

### 6.3 Strict Mode/중복 실행 대응
- mount 호출이 중복되어도 channel별 `channelSessionId` 기준으로 단일 활성
  session만 유지한다.
- outer envelope의 channel/session이 현재 owner와 다르면 late response로 폐기하며,
  Worker 내부의 active channel session 불일치는 fail-loud한다.
- channel dispose는 idempotent여야 하고, 다른 channel의 수명을 종료하면 안 된다.
- Dashboard renderer replacement is serialized by
  `control/runtimeClient/zenPondRendererHandoff.js`. The next controller may attach
  its canvas immediately but cannot initialize the pond channel before the old
  controller's disposal promise settles and releases that channel. A waiting
  controller cancelled by another reset never starts; its successor still waits
  for the original release. Worker initialization errors retain the request
  client's concrete disable reason.
- `useZenSessionStore.requestHardReset` coalesces concurrent requests and waits
  for canonical appearance/activity/roster cache deletion before publishing a
  new `hardResetToken`. Its transient `hardResetStatus`/`hardResetError` report
  storage completion or explicit failure; they do not claim renderer readiness.
  The Pond Lab reads `onRuntimeReadinessChange` from the scanner's canonical
  readiness snapshot to display actual worker/first-frame/failure state.
- sibling channel이 살아 있는 상태의 abrupt release는 outer
  `zen_home_renderer_channel_release`를 exact `channelSessionId`로 전송한다.
  Worker는 해당 logical runtime만 dispose한 뒤 immediate reacquire를 순서대로
  받으며, inner `DISPOSE` 누락을 fallback이나 고아 상태로 남기지 않는다.

## 7. 메시지 프로토콜 (Race-Free)
### 7.1 공통 envelope
- 물리 Worker 경계의 outer envelope는
  `{ type: 'zen_home_renderer_channel', channel, channelSessionId, message }`이며
  `channel`은 `pond|bonsai`만 허용한다.
- outer owner-only release message는
  `{ type: 'zen_home_renderer_channel_release' }`이고 반드시 기존 exact envelope
  안에서만 전달한다.
- dev boot trace가 활성화된 경우에만 physical owner는 channel command보다 먼저
  `{ type: 'zen_home_renderer_diagnostics_configure', enabled: true }`를 보낸다.
  Worker는 owner-only diagnostic envelope로 entry readiness, Pond/Bonsai logical
  runtime import, initializer, Home-world prepare 시간을 반환한다. 이 envelope는
  data-plane channel에 전달되지 않으며 readiness를 결정하지 않는다. Public/no-trace
  runtime은 configure message와 diagnostic emission을 만들지 않는다.
- 같은 opt-in에서 Bonsai INIT는 `channelSessionId`와 realm-local
  `initAttemptOrdinal`로 page `bonsai_init_posted`/`bonsai_ready_received` trace,
  Worker owner `bonsai_init_received`/`bonsai_init_ready` diagnostic을 연결한다.
  business DTO에 clock/diagnostic flag를 추가하지 않는다. Worker의 최종
  `zen_bonsai_init_timing_v1` summary는 physical receipt, outer channel FIFO 시작,
  logical-runtime await, logical FIFO enqueue/실행, INIT 진입, READY post 시작/종료를
  한 envelope로 기록한다. 누락/역전된 stamp는 `incomplete`이며 0으로 대신하지 않는다.
  Worker diagnostic ring은 기존 32건을 유지하고 INIT마다 두 건만 추가한다.
  Page와 Worker의 `performance.now()` 절대값을 직접 빼지 않는다. 각 realm의
  duration과 page post-to-receipt wall time에서 Worker receipt-to-READY-post-start
  duration을 뺀 transport/scheduling/deserialization residual을 비교한다. 이 residual은
  CPU/GPU 원인을 확정하지 않으며 READY는 실제 first-frame ACK를 대체하지 않는다.
  `zenBonsaiInitDiagnosticsCapability.js`의 독립 compile capability는 기존
  `__ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__`에 묶인다. Public build에서는 INIT
  counters, clocks, logical diagnostic callback과 summary factory를 제거하며
  runtime opt-in만으로 이 코드를 남기지 않는다. Work-journal capability를
  INIT diagnostic의 behavior switch로 재사용하지 않는다.
  기존 public Home-worker artifact guard는 compiled closure의
  `zen_bonsai_init_timing_v1` marker를 금지하여 observer가 제거됐는지 확인하며,
  기존 entry/context size budget은 완화하지 않는다.
  Debug trace는 관찰된 native `pageTimeOriginMs`/`workerTimeOriginMs`도 기록한다.
  양쪽 origin과 stamp가 유한할 때만 `(timeOrigin + performance.now)`를 같은 host의
  shared epoch로 정렬하여 page post→Worker receipt, Worker READY post→page receipt를
  분리한다. Origin을 얻지 못하면 `null`/unavailable로 남기며 `Date.now()`나 합성
  clock origin으로 채우지 않는다. Realm 내부 duration 판독은 origin 없이도 유지한다.
- Dashboard theme-runtime preparation은 owner-only
  `{ type: 'zen_home_renderer_world_prepare' }`를 한 번 보내 Pond/Bonsai logical
  imports와 Pond renderer module admission을 React mount 전에 시작한다. 이 명령은
  logical channel/session을 만들거나 readiness ACK를 대신하지 않는다. 첫 실제
  channel이 startup reservation을 채택하며, 채택 전 dashboard 초기화 실패는
  reservation release를 통해 physical worker와 admission을 함께 정리한다.
  Dashboard app의 handoff owner는 dynamic runtime import보다 먼저 preparation
  promise를 등록하므로 sibling stage failure가 먼저 settle되어도 release intent를
  잃지 않는다. Profile gate `blocked`/`recovery_required`와 React error boundary도
  같은 handoff release를 사용한다. 이미 채택된 reservation은 release하지 않으며
  active channel unmount가 physical worker 수명을 종료한다.
- Pond channel acquire는 같은 exact envelope 안에서 owner-only
  `{ type: 'zen_home_renderer_channel_prepare' }`를 PING보다 먼저 보낸다. 이 신호는
  물리 Worker나 channel lease를 추가하지 않고, 실사용 generation에서 Pond scene,
  water-effects, Pond logical runtime, Bonsai logical runtime의 단일 terminal admission을
  겹쳐 시작한다. prepare Promise는 data-plane queue에서 await하지 않으며 실제 channel
  command는 이미 시작된 logical-runtime Promise를 재사용한다. 이 prewarm은 Bonsai
  renderer factory를 포함하지 않는다. 현재 Home PLUME의 `pixi_plume`, G15의
  `pixi_g15`, Sakura의 `pixi` factory는 각각 exact backend INIT에서 demand-admit한다.
  Canvas2D INIT는 Pixi factory를 admit하지 않는다.
- Pond channel 내부에서는 shared `WorkerRequestClient`가
  `{ type, id, payload }` request envelope를 소유한다.
- Zen pond 세션 메타는 `payload.__session = { id, seq, ts, type }` 형태로 포함한다.
- `PING`과 `FLUSH_METRICS`만 session-free이다.
- `PING`은 bootstrap readiness check일 뿐이며 활성 session gate를 reset하지 않는다.
- `DISPOSE`를 포함한 세션 명령은 `sessionId` 불일치 시 워커가 stale로 폐기한다.
- `seq`는 단조 증가; 이전 seq 메시지는 stale로 폐기한다.

### 7.2 Main -> Worker
- `INIT_CANVAS`
  - payload: `{ canvas, viewportWidth, viewportHeight, width, height, dpr, themeId, qualityMode, seed, active, runtimeParams, fishRoster }`
  - transfer: `[canvas]`
  - initial `scene/runtime/fish` payload is authoritative for first mount; React mount effects must use probe-gated non-force sync so they do not rebuild duplicate payloads before worker startup completes.
  - every bound-domain fish carries a complete canonical `activityProfile` DTO
    built on the main thread. The worker imports only worker-safe normalization
    and energy math; it never imports Pond storage, model repositories, model
    state, or a snapshot builder. Missing/invalid activity profiles fail with a
    named worker snapshot contract error rather than reading storage.
- `RESIZE`
  - payload: `{ width, height, dpr }`
- `SYNC_SCENE_SESSION`
  - payload: `{ sceneSession }`
- `SYNC_ENVIRONMENT_AUTHORITY`
  - payload: `{ envAuthority }`
  - payload는 strict `zen.world.environment.authority` DTO이며 forged signature,
    undeclared field, non-canonical clock/location/weather shape는 fail-loud한다.
  - realtime authority는 worker-clock marker로 probe/dedupe하므로 UI ambient
    refresh나 main-thread timestamp 경과가 메시지를 만들지 않는다.
  - fixed epoch, location, world, 또는 weather authority가 실제로 바뀔 때만
    environment target과 ambient entities를 갱신한다. water-layer apply seam과
    runtime-param counter에는 진입하지 않는다.
- `SYNC_RUNTIME_PARAMS`
  - payload: `{ runtimeParams }`
  - init 이후 payload에는 environment authority를 넣지 않는다. 이 채널은
    quality, tuning, water palette, renderer/effect controls, strict visual
    profile DTO만 소유한다.
  - visual profile contract owner는
    `pond/contracts/zenPondVisualProfile.js`다. 제품 UI는 네 축을 독립적으로
    선택하며 A/B compare는 research Studio에만 남는다. profile delta는 두 번째
    worker나 renderer slot을 만들지 않고 현재 pond scene의 texture/layout/effect
    resources를 dispose한 뒤 같은 worker에서 재구성한다.
  - water-layer material signature(toggle asset identity + reflection algorithm)가
    바뀌거나 quality remount가 필요할 때만 worker는 Pixi presentation runtime의
    generation-fenced apply를 await한 뒤에만 `RESULT`를 보낸다. RESULT는
    narrow `waterLayerChanged`, `waterLayerApplyRequired`, `waterLayerApplied`와
    `waterLayerApply`의 requested/active signature, `status`, `ready`, `error`를
    포함한다. material identity가 그대로인 다른 runtime-param delta는 현재
    apply state만 읽고 layer build/apply를 다시 요청하지 않는다.
  - quality 또는 visual-profile 전환이 scene remount를 요구하면 worker는 remount Promise와 새
    scene의 water-layer apply를 차례로 await한다. active scene 없이 remount
    completion을 관측할 수 없는 경계에서만 `scene_remount_pending`,
    `waterLayerApplied: false`를 명시한다. 이 ACK는 surface uniform/filter의
    next-frame 적용까지 포괄하는 `presentationApplied` 계약이 아니다.
- `SYNC_FISH_ROSTER`
  - payload: `{ fishRoster }`
- `SET_INPUT_STATE`
  - payload: `{ pointer, pointerSpace, lockedTarget, selectedFishUid, clickPulseToken, clickPointer, clickPointerSpace }`
- `SET_VISIBILITY`
  - payload: `{ active }`
- `DISPOSE`
  - payload: `{ reason }`

### 7.3 Worker -> Main
- `READY`
  - payload: `{ supportsWorkerRaf, renderer: 'pixi-offscreen' }`
- `FIRST_FRAME_ACK`
  - payload: Pond의 exact first rendered frame metadata. 물리 Home `READY`나
    Bonsai `FRAME_RENDERED`는 이 ACK를 대체할 수 없다.
- `RESULT`
  - payload: request result, including metrics for `FLUSH_METRICS` and final metrics for `DISPOSE`
- `ERROR`
  - payload: request error string
- `RENDERER_EVENT`
  - payload: explicit debug/warn/error/probe event
  - startup 동안 exact event `worker_startup_progress`는 strict bounded
    `{ stage, reason }` DTO만 전달한다. stage/reason은
    `zenPondWorkerStartupContract.js`의 열거형에 한정되며 임의 문자열, stack,
    URL, renderer diagnostics object를 progress payload로 전달하지 않는다.

### 7.3.1 First-frame startup liveness and diagnostics
- Pond logical readiness의 성공 신호는 계속 `FIRST_FRAME_ACK` 하나다. main의
  first-frame ACK 대기 예산은 `10,000ms`로 유지하며 startup scheduler watchdog,
  progress event, renderer error 처리는 이 예산을 늘리거나 새 readiness 신호를
  만들 수 없다.
- worker는 engine start, renderer module load, scene mount, first-frame asset
  preparation, runtime-loop mount, prime render, deferred readiness, runtime-frame
  wait 같은 startup 전이를 bounded progress로 보고한다. main ACK gate는 마지막으로
  검증된 progress를 보존하고 ACK timeout 및 hard-worker-failure diagnostics에 같은
  `{ stage, reason }`을 포함한다. 검증되지 않은 progress는 기본값으로 보정하지 않고
  경계에서 fail-loud한다.
- Pond readiness failure가 Home presentation fatal로 승격될 때도 검증된
  `startupStage`와 `startupReadinessReason`을 error details에 보존한다. 두 값은
  lowercase bounded token으로 다시 검증되며, local QA error surface가 마지막 stage를
  읽을 수 있도록 fatal message에도 `startup_stage` / `startup_reason`으로 투영한다.
  stack, URL, renderer object 또는 임의 error text는 이 suffix에 들어갈 수 없다.
- `FIRST_FRAME_ACK` 전 render tick에서 발생한 첫 예외는 즉시 terminal
  `worker_runtime_error`다. 이 경로는 3회 누적 breaker를 기다리지 않으며,
  `startup_render_failed / render_exception` progress와 bounded canonical error
  code, URL/제어문자 제거 및 길이 제한이 적용된 message만 main으로 보낸다.
  raw stack과 무제한 renderer 객체는 startup failure payload에 포함하지 않는다.
- `FIRST_FRAME_ACK` 이후의 render exception은 원래 worker stack을 오류 변환
  단계에서도 보존한다. 최종 hard-failure 로그의 첫 문자열에 원인과 stack을
  포함해 Chrome extension error 목록에서 `[object Object]`만 남지 않게 한다.
  구조화된 details도 유지하며, startup progress의 bounded 계약은 바꾸지 않는다.
- `renderer_module_admission_start/end`는 Pond runtime-state reset 뒤에도 원래 worker
  clock timestamp로 복원하고, engine의 실제 잔여 await인
  `renderer_module_load_start/end`와 분리해 보고한다. 이 계측은 module graph의
  fetch/evaluation과 renderer/asset/frame 작업을 구분하며 readiness 의미나 시각 품질을
  바꾸지 않는다. Admission end는 parallel scene module, water module, admitted water
  factory commit 시간을 각각 bounded millisecond 값으로 함께 보존한다.
- Product `neutral-depth` benthic primary/detail material은 scene input이 아닌 고정
  seeded 1024px build asset이다. `npm run generate:zen:pond-static-assets`가 기존
  canonical material generator를 Node Canvas에서 실행해 고정 PNG preview 두 장,
  같은 픽셀의 gzip RGBA8 runtime asset 두 장, source digest manifest를 같은 generated
  directory에 교체 기록한다. 파일명에는 version을 붙이지 않으며 generator는 이
  다섯 파일 외 이전 generation 잔여물을 제거한다.
  `prebuild:release`와 QA가 사용하는 `build:bundle`은 Vite보다 먼저 이 생성을 완료한다.
- Pond renderer module admission은 scene/water module import와 동시에 두 packaged
  RGBA8 asset을 `fetch -> DecompressionStream('gzip') -> ArrayBuffer`로 준비한다.
  Water layer는 검증한 정확한 `width * height * 4` byte buffer를 Pixi
  `BaseTexture.fromBuffer`에 직접 넘겨 PNG decode와 8 MiB package read를 첫 프레임
  경로에서 제거한다. PNG는 같은 build canvas에서 나온 사람이
  확인할 수 있는 preview이며 runtime source가 아니다. 이 read는
  `src/platform/extension/packagedAssetFetch.js`가 소유하며 현재 extension runtime과
  protocol/host가 정확히 같은 package URL만 허용한다. 외부 web URL이나 다른
  extension ID는 요청 전에 거부한다. Water layer는 ready RGBA8 buffer만
  BaseTexture source로 사용하고 런타임 procedural benthic generation, missing-asset
  white texture, texture-bundle no-op fallback을 사용하지 않는다. Manifest signature,
  asset fetch, byte length, pixel format 또는 admission이 실패하면 같은 terminal
  worker failure로 surface한다. Admission telemetry는 asset preparation duration과
  packaged RGBA8 byte count를 별도 기록한다.
- Water-effects module admission은 검증한 exact layer factory를
  `pixiWaterEffectsLayerLoader.js`의 단일 loader cache에도 commit한다. 첫 프레임
  transition은 이 admitted factory를 재사용해야 하며 같은 module을 별도 dynamic-import
  lookup으로 다시 소유하지 않는다. 서로 다른 factory가 같은 worker generation에
  들어오면 conflict로 실패한다.
- Pond logical worker의 잉어 roster는 `KoiSimulationFish.js`를 직접 소유한다.
  Canvas draw adapter/body/fin/debug 메서드는 public `KoiFish.js` subclass에만 붙이며,
  Pixi worker bundle은 이를 admission하지 않는다. 장식 엔티티도 `world/entities.js`
  broad barrel 대신 정확한 decor seam으로 가져와 Canvas Koi graph의 우발적 유입을
  막는다. 두 클래스는 같은 simulation constructor/update/appearance/geometry/behavior
  구현을 공유하므로 motion, 난수 소비, appearance, hit geometry는 동일하다.
- `first_frame_assets_prepare_start/end`와 `first_frame_assets_ready`는 scene mount 이후
  water-layer request/await, factory load, layer build/activation, surface filter/field ensure,
  texture build/cache 상태를 bounded primitive timing으로 분해한다. 이 계측은 debug
  runtime-health에만 속하며 ACK 의미,
  asset admission, texture resolution, effect cadence를 바꾸지 않는다. Canvas2D seamless
  texture bake는 중앙 draw와 실제 tile 경계에 닿는 wrapped copy만 실행할 수 있다.
  완전히 clip되는 나머지 tile copy 제거는 같은 draw 순서, 난수 소비, 색/합성, 크기,
  해상도를 보존하는 presentation work-elision이고 quality tier가 아니다. 같은 bake
  내부의 periodic noise는 이미 생성된 Float32 lattice 값을 period별로 재사용할 수
  있지만 noise table 생성, 표본 좌표, interpolation, alpha 식은 그대로 유지한다.
- `pixiWaterEffectsTextureBake.js`의 mist blur는 완성된 blur Canvas를 Texture에
  직접 전달한다. 마지막 같은 크기 identity copy만 제거하며 기존 nine wrapped
  blur draw, filter, 크기, RNG, source `{ alpha: true, willReadFrequently: true }`,
  blur `{ alpha: true }`, no-blur/unavailable 경로와 Texture/base disposal 수명을
  보존한다. `tests/themes/zenMistTextureBakeEquivalence.test.js`는 원본의 전체 RGBA hash,
  dimensions/RNG와 독립적인 output lifetime을 검증한다. Selected-source Canvas/GPU
  readback은 해당 source의 pixel correctness 근거이며 whole startup latency 개선이나
  named QA PASS로 해석하지 않는다. Decor Canvas backend는 그대로 유지한다.
- First-tick texture diagnostics use the existing `pixiFirstRenderTextureUploadProbe.js`
  only with debug build capability and explicit render telemetry. Observation starts
  before `onTick`, covering water, cloud/floor/decor bake submissions and world/stage
  rendering; it restores the original instance method after the tick, including failures.
  Counts cover every native `updateTexture` call; time/byte/phase totals cover successful
  observations regardless of retained detail. Collection stays capped at 16 upload
  details and 16 phase totals. Observer failures are counted without
  replacing native return values or errors. No additional GL query/upload/flush is issued.
  `totalBytes` is an RGBA8 area estimate across calls, not unique resident GPU memory;
  `sourceBytes` identifies actual typed-buffer length where available. Native wall time
  includes texture style and driver waits and is not GPU execution time. Floor and rock
  bake spans also include nested compilation, so their wall times are not pure raster cost.
  QA summaries use the complete first-tick totals, never the retained top-16 detail sum.
  Disabled observation remains unknown in the summary rather than zero measured cost.
- Each retained upload detail preserves a one-based call-admission `ordinal` and
  `startedAtMs` / `completedAtMs` on the existing Worker-local clock. These reuse
  the two clocks already read for duration; no new clock or native operation is
  issued. Nested calls keep admission order even when the inner call completes
  first. The 16 slow-detail retention and complete aggregate count/bytes/phase
  totals are unchanged. Invalid/non-finite/negative/reversed clock pairs are
  explicitly null with an observation failure; native return/error is preserved.
  The existing `first_render_texture_upload` event transports these fields while
  retaining its duration rank and first-tick-end report timestamp. That report
  timestamp is not the upload execution time; omitted details are not a complete
  chronological upload ledger. Chrome trace clock alignment and GPU completion
  require independent evidence, never inference from submission wall alone.
- `telemetry/pixiFirstTickRenderCallProbe.js` observes the same first tick through
  the original public renderer instance's `render` method, admitted only by the
  debug build capability and the existing explicit render-telemetry opt-in.
  It starts before `onTick`, preserving the existing water/cloud/floor/rock/world/
  stage order and inputs. Native receiver, arguments, return and thrown error
  remain unchanged. Tick `finally`, mount rollback and scene disposal restore
  the original instance descriptor; a later owner is retained and reported.
  No GL query, upload, flush, readback, new frame, GPU synchronization or scheduling
  change is introduced. Disabled observation does not inspect the renderer or clock.
- The `zen_pond_first_tick_render_calls_v1` summary retains at most 32 admission-
  ordered call details and 16 phase totals. Each detail carries bounded phase,
  ordinal/parent/depth, Worker-local start/end stamps, wall duration, failure state
  and public screen/texture target dimensions/resolution sampled after the native
  call. Nested inclusive wall is separate from the non-overlapping top-level total;
  `selfMs` subtracts only directly nested `render` calls and is **not** pure CPU time.
  Native wall includes Pixi traversal, program generation, texture upload, other GL
  calls and driver waits. Existing program and upload spans are nested observations,
  not additional costs to sum onto this total. Missing/failed clock observations
  remain null per call with explicit completeness/failure counts. Aggregate sums
  cover all successfully observed calls even when detail retention overflows.
- Existing `first_render_tick_end` records the render-call aggregate and completeness.
  Debug primitive milestones `first_render_call_summary`, `first_render_call:<ordinal>`
  and `first_render_call_phase:<phase>` preserve the bounded evidence, including a
  failed first tick before disposal. The existing runtime-health ring stays at 64;
  ordinal milestones retain early calls after ring eviction. Observation ends after
  the first tick and adds no steady-frame wrapper or readiness authority. Production
  compilation removes the observer, clocks, metadata and its contract marker; the
  existing public worker artifact guard forbids the marker without changing budgets.
- Zen Pond는 canonical `runRenderLoop`에만 startup liveness를 opt-in한다. exact
  조건은 `frameScheduler: 'auto'`, ACK 전 startup pending, `120ms` watchdog이다.
  startup pending은 active 여부와 무관하게 ACK 전까지 유지하고, inactive frame은
  canonical paused cadence가 activity를 재관찰한다. 따라서 inactive 시작 또는 ACK 전
  inactive 전환 뒤에도 active 복귀가 dead worker rAF 뒤에 영구 park되지 않는다.
  이 조건에서만 한 번의 frame schedule이 worker rAF callback과 timeout을 race하며,
  먼저 도착한 쪽이 다른 handle을 취소하고 frame callback을 정확히 한 번 실행한다.
  watchdog이 이기면 bounded `raf_liveness_fallback / raf_callback_stalled`
  progress를 남기고 같은 worker render loop를 진행한다.
- ACK가 오거나 startup pending이 false가 되면 watchdog race는 종료되고 normal
  hardware 및 post-ACK 경로는 순수 rAF cadence를 유지한다. explicit `raf` 또는
  `timeout` scheduler의 의미도 바꾸지 않는다. post-ACK render exception은 기존
  3-strike breaker를 유지한다.
- startup timeout winner는 semantic renderer fallback, second Worker, quality
  downgrade, admission retry가 아니다. 동일 loop의 callback liveness만 보장하는
  scheduler-level degradation seam이며 10초 ACK deadline을 재시작하거나 연장하지
  않는다.
- Headed software renderer 샘플은 QA diagnostic class다. hardware headed 경로가
  정상이고 software-only sample만 readiness를 충족하지 못하면 canonical 10초
  timeout과 명시적 degraded failure를 유지한다. GPU/UA 문자열에 따른 제품 quality
  branch, 더 짧은 임의 timeout, forced ACK 또는 silent renderer fallback을 추가하지
  않는다. Chromium `SharedImageManager` stderr가 timeout 뒤에 나타난 사실만으로는
  causal render failure로 분류하지 않는다.

### 7.4 충돌 방지 불변식
1. 물리 경로 단일성: Zen Home runtime은 admitted `zen_home_renderer` Worker
   하나만 활성하고 `pond`/`bonsai`/`artifacts` 세 logical channel만 사용한다.
2. 전환 원자성: hidden semantic fallback, second Home Worker, dual render
   전환은 허용하지 않는다.
3. late metrics 무시: shell dismiss/dispose 이후 metrics 이벤트는 기록만 하고 UI 반영을 지양.
4. resize 폭주 억제: rAF 단위 coalescing(마지막 값만 전달), 200ms trailing `settled: true`에서 한 번 공간 갱신.
5. dispose 보장: session-scoped `DISPOSE` 전송 후 request `RESULT` 대기(최대 120ms), 이후 terminate 수행.
6. worker는 hover badge anchor를 프레임 단위로 push하지 않는다. hover/selection facts는 `SET_INPUT_STATE` 결과의 interaction feedback으로만 main thread에 반영한다.
7. worker artifact isolation: the worker-build module inventory must contain the
   unified Home worker entry and its allowed Pond/Bonsai/artifact renderer modules, and
   must reject storage, workspace state, VNext/research, and other main-thread-only
   modules regardless of emitted chunk name.
   The artifact checker also enforces bounded raw/gzip size.
   The historical 2026-08-04 visual-profile capability measurement was
   `entry 745729 / 230663 gzip`, `closure 1600887 / 484895 gzip`, and
   `585 project modules`; the existing hard limits remain unchanged. This
   baseline includes the independently selectable floor, plant, rock, and
   sunlight strategies while the product default still mounts one scene in one
   physical Home worker.
   Current public `zenHomeRenderer` budget authority is
   `scripts/ci/quality-gate.config.json`. The 2026-09-27 Plume promotion updates
   only its measured module-count baseline from `536` to `583`: the original
   build correctly failed at `583 / 536` (`+8.77%`, above the `+8%` limit).
   The emitted closure contains 17 used Plume render owners, no zero-byte
   modules, and no Plume/F4 study-generation owner. This is explicit admission
   of the added product renderer, with no second physical worker or file merging
   to evade the count. The full 47-module historical delta is not attributed
   solely to Plume: other shared-worker changes predate this promotion.

   Measured entry bytes are `27531 raw / 9107 gzip`; closure bytes are
   `1900937 raw / 610420 gzip`. All four remain within the existing `+8%`
   byte gates and hard caps, while retaining their `+3%` warnings. Byte baselines
   remain `26078 / 8703` and `1808989 / 572320`; hard caps remain
   `900000 / 280000`, `2084498 / 634956`, and `680` modules. Warning/failure
   fractions and forbidden module paths are unchanged. Evidence is
   the initial build failure log
   (`reports/zen-cherry-plume-product-2026-09-27/initial-build-prod.log`, kept
   locally only because `*.log` is gitignored) and [exact emitted inventory](../../../../reports/zen-cherry-plume-product-2026-09-27/initial-prod-worker-inventory.json)
   (SHA-256 `fd0985605f26bc2116b077dfd237c4f12ad676a23b180d3b17f93313904a0809`).
   These are the 2026-09-27 admission measurements. The approved 2026-09-29
   baseline is `27531 / 9109` entry raw/gzip, `1933443 / 622018` closure
   raw/gzip, and `593` modules, reflecting the ten subsequently adopted Plume
   appearance/depth/framing, frame-seam, wood-shadow, water-light-transport and
   petal-depth owners. Current closure hard caps are `2250000 / 725000` bytes;
   entry/module caps, the `+3%` warning / `+8%` failure fractions, and forbidden
   module paths are unchanged. The current values and rounding policy are in
   [CI Quality Gate](../../../operations/ci/quality-gate.md#예산-설정).
   The 2026-10-13 dependency review reapproves only the module-count baseline
   at `645`: the retained 640-module inventory plus four admitted underwater
   optics/fin-shadow owners and the renderer-independent shadow material
   contract. Byte baselines, warning/failure fractions, hard caps and forbidden
   boundaries remain unchanged. The material contract removes cold bake imports
   of GPU mesh implementations; no file merging is used to reduce the count.
   The artifact unit guard pins this explicit policy and source exclusions.
8. ACK 분리: physical Worker readiness와 logical channel readiness는 다른
   계약이다. Home composite commit은 Pond와 Bonsai의 exact ACK를 각각 요구한다.
9. 용량 불변식: channel 오류/거부/해제는 admission 재시도, 별도 lane 차용,
   burst 상향, 두 번째 물리 Worker 생성을 유발하지 않는다.
10. water-layer 동적 전환은 기존 layer를 새 layer build 성공 전까지 active로
    유지하고 성공 시 원자적으로 교체한다. stale Promise는 generation fence로
    폐기하며, probe는 `waterLayerRequestedSignature`,
    `waterLayerActiveSignature`, `waterLayerApplyStatus`,
    `waterLayerApplyReady`, `waterLayerApplyError`,
    `waterLayerRetainedActive`를 보고한다. pending 동안 이전 layer를 유지하면
    이전 visibility/gate probe를 보존하되 apply reason은 pending으로 명시한다.
    pending/failed/
    signature mismatch는 `water_layer_probe_unavailable`로 뭉개지 않는다.
11. 시간 경계 단방향성: `ThemeAmbientPresentationContext`의 object identity,
    refresh cadence, time bucket은 Pond/Bonsai worker 제어 signature에 포함하지
    않는다. realtime worker clock과 explicit fixed authority만 renderer time
    input이며, 환경 delta는 `SYNC_RUNTIME_PARAMS`를 유발하지 않는다.
12. Bonsai static-layer invalidation은 canonical environment bake signature만
    사용한다. fine-grained worker render signature는 uniforms/dynamic render
    state를 갱신할 수 있지만 매 tick static-layer rebake를 유발하지 않는다.
13. environment source identity: Pond/Bonsai projection은 같은 strict authority
    revision과 exact sample ID를 기록한다. time bucket 자체는 dynamic 또는 static
    cache key가 아니며, projector 결과가 실제로 변할 때만 해당 signature가 변한다.
14. frame environment apply: Pond는 declared continuous/angular/cyclic field만
    bounded interpolation한다. 새 numeric field는 자동 보간되지 않고, no-op frame은
    authority validator와 environment resolver에 진입하지 않는다.
15. water optimization projection: `zenPondOptimizationMaster.js`의 scene-local
    resolver는 선언된 quality/toggle 입력이 바뀔 때만 profile을 생성한다.
    고정된 입력의 frame path에서는 toggle 정규화, signature 생성과 profile
    allocation을 반복하지 않는다. Mutable Lab 입력도 실제 scalar 변화로
    invalidation하며, quality 선택이나 simulation cadence는 변경하지 않는다.

## 8. 부팅/Handoff 정책
- boot 단계
  - 현재 canonical Home runtime은 하나의 strict steady presentation Worker로 시작한다.
  - Pond는 그 Worker의 `pond` channel에서 저장된 명시적 preset으로 시작한다. 기본값은 `full`이다.
  - 목표: main thread 입력/애니메이션 안정성 확보를 worker isolation으로 달성한다.
- handoff 단계
  - 품질/효과 변화가 필요하면 `SYNC_RUNTIME_PARAMS` 하나로 전달한다.
  - 별도 quality 전용 control channel은 두지 않는다.
  - fixed/custom time, location, weather authority 변화는
    `SYNC_ENVIRONMENT_AUTHORITY`로 전달하고 runtime params에 섞지 않는다.
  - development Experiment Pond Lab은 Home에서 park한 동일 controller/canvas를
    재부착하며 `pond` channel을 새로 acquire하지 않는다. 대시보드 안의 Pond Lab은
    scanner 하나만 소유하고, A/B는 서로 분리된 외부 연구소 page lifetime에서만 한다.
    Lab은 data mode와 synthetic seed를 포함한 자체 presentation-scene commit key를
    보내며, 재부착 후 실제 다음 worker frame ACK가 오기 전에는 surface를 ready로
    승격하지 않는다.
  - tab transition 중 새 surface가 먼저 attach된 경우 이전 surface의 늦은 release는
    monotonic lease id로 폐기한다. stale release가 새 host의 canvas를 park하거나 새
    surface의 park timeout을 예약해서는 안 된다.
  - React에 남아 있는 비활성 탭은 mount gate를 닫고 기존 lease를 release한다.
    전역 hardResetToken이나 저장 프로필 변경으로 hidden Home이 active Lab의
    controller/canvas를 다시 획득해서는 안 된다. document visibility는 animation
    pause에만 관여하며, 활성 탭의 lease를 반환시키지 않는다.
  - `useZenViewStateController`의 animation ref commit, `useZenWorkerRendererMount`의
    lease attach/release와 runtime gate sync는 React layout effect 순서로 처리한다.
    내부 탭 복귀의 첫 paint 전에 보관된 canvas를 host에 연결하고 최신 animation
    상태를 전달한다. 브라우저 탭 복귀는 같은 lease/canvas를 유지한 채 재개한다.
    Worker 초기화와 asset 준비는 기존 비동기 owner가 계속 담당한다.
- 중요 규칙
  - 연못 로딩은 Enso 종료 이후가 아니라 boot 진행과 겹쳐 시작해야 한다.
  - Pond channel acquire는 renderer/water module graph admission을 즉시 시작하고,
    INIT_CANVAS engine start는 같은 terminal Promise를 재사용해야 한다.
  - Dashboard Boot/Ceremony Worker는 bounded burst consumer이며 Home steady
    session의 대체 경로나 추가 capacity가 아니다.
  - 단, main 과부하를 피하려고 worker init과 heavy asset decode를 분리해 순차 예산을 둔다.

### 개발용 긴 프레임 기록 (2026-09-27)

`__ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__`가 켜진 빌드에서만
`zenRendererWorkJournal.js`가 최대 16건, 단조 증가 `sequence`, `droppedCount`,
Worker `performance.timeOrigin`을 가진 기록 형식을 소유한다. Pond telemetry는
프레임 간격이 기존 `over50` counter와 같은 50ms 이상이면 해당 간격의 끝인 `atMs`, `frameCount`, sync
counters와 기존 `mainMetrics`를 `metrics.spikeJournal`에 보관한다. 일반 프레임이나
metrics 조회로 기록을 지우지 않으며, client normalization은 이 기록과 기존
`lastSpike`를 보존한다. `atMs`와 `previousFrameStartedAtMs`는 각각 현재/이전
프레임의 environment preflight 및 `scene.tick` 이전 시작 시각이다.
`previousSceneTickFrameMs`는 이전 `scene.tick`이 반환한 `frameMs`를 scalar로
복사한 값이며 environment preflight를 포함하지 않는다. 현재 `mainMetrics`는
간격 뒤에 실행된 이번 tick이므로 빠른 현재 tick만으로 긴 간격의 원인을
외부 스케줄링이나 다른 프로세스로 단정하지 않는다. 첫 프레임이나 시작 시각이
reset/역행한 경우 이전 진단값은 명시적 `null`이다. 측정 불가능한 이전 tick
기간도 `null`이며 0으로 대체하지 않는다. pause 동안 clock이 유지되면 기존
start-to-start 간격 의미를 유지하며, 이 기록만으로 pause/CPU/GPU/OS 원인을
분류하지 않는다. 용량은 16건이며 추가 timer, IPC, storage 또는 per-frame
metrics 전송을 만들지 않는다. Shared Home owner의 `zenHomeRendererWorkJournal.js`는
기존 Bonsai `FRAME_RENDERED`를 관찰해 `metrics.homeRendererJournal`에 새
`sceneSequence`당 `bonsai_scene` 한 건과 보고된 `bonsai_frame`을 남긴다.
`sceneSyncMs`는 기존 `scenePreRenderRequestMs`이며, frame 항목은 기존
scene build/preflight/bake/draw timing을 보존한다. 후속 환경 갱신 frame에 포함된
이전 `sceneBuildMs`를 새 SCENE 작업으로 해석하지 않는다. `atMs`는 각각 실제
scene 처리 시작/프레임 요청 시각이고 `receivedAtMs`는 shared owner가 기존
FRAME_RENDERED를 받은 시각이다. 모든 시각은 같은 Worker clock이며
`timeOrigin + atMs`로 외부 관찰과 정렬한다. 이 기록은 기존 Pond metrics RESULT에만
첨부하며 별도 타이머, 주기 메시지, 프레임 전송 또는 성능 변경을 만들지 않는다.

## 9. 구현 단계 (통합 + 정리)
### Phase 0: 계측 기준선
- bootTrace와 worker metrics를 동일 세션으로 수집
- FULL에서 stutter 구간, longtask 분포, worker frame 지표 기준선 확보

### Phase 1: Runtime 통합 골격
- `ZenHomeRendererWorkerSession`에서 단일 admission/physical Worker 수명 소유
- `ZenPondWorkerRuntimeClient`를 exact `pond` channel에 연결
- `WorkerRequestClient + WorkerExecutionController`와
  `INIT_CANVAS/RESIZE/DISPOSE` strict worker-only data plane 연결

### Phase 2: 소유권 이전
- fish/env/water 상태를 워커로 이동하고 main은 semantic environment authority만 전달
- 메인의 프레임 상태 계산/보관 로직 제거

### Phase 3: 부팅 품질 정책
- worker-only `full` runtime을 기본값으로 고정
- 추가 품질/효과 변화는 `SYNC_RUNTIME_PARAMS`로만 전달

### Phase 4: 컷오버/정리
- Pond/Bonsai 기본 경로를 unified Home Worker의 exact channel로 전환
- 미사용 코드 라인과 죽은 분기 삭제
- 빌드 산출물에서 unified Home worker chunk 하나와 허용 module inventory 검증

## 10. 미사용 코드 제거 정책 (기본)
### 10.1 삭제 원칙
- 기능 플래그로 영구 비활성된 분기는 남기지 않는다.
- 워커 통합 후 호출되지 않는 helper/import/option은 즉시 삭제한다.
- owner-local platform environment adapter만 문서화된 degraded seam으로 유지할 수 있다.

### 10.2 삭제 체크리스트
1. `ZenRendererAdapter`에서 더 이상 사용하지 않는 legacy mount 경로 import 제거
2. 메인 렌더 전용 상태 계산 루프와 retired worker compat shim 경로 제거
3. 중복 lifecycle 훅(이중 dispose, 이중 resize 핸들러) 제거
4. 미사용 task type/telemetry 키 제거 또는 정식 등록

### 10.3 삭제 검증
- `rg`로 dead symbol 0건 확인
- `npm run build` 통과
- boot 진입/해제 10회에서 메모리 누수(고아 worker) 없음

## 11. 성능 목표(SLO)
- 부팅(Enso 구간) main longtask: P95 < 50ms
- worker FULL 프레임: `over24` 비율 기존 대비 40% 이상 감소
- 체감 기준: Enso tail stutter 빈도 유의미 감소

## 12. 리스크 및 대응
- OffscreenCanvas/Pixi 제약
  - 대응: worker-only contract violation을 즉시 surface하고, telemetry/manual smoke로 진단한다.
- GPU 포화 잔존
  - 대응: FULL 효과 예산(마이크로 하이라이트/2nd caustic) 동적 제한
- 메시지 폭주
  - 대응: dedupe + coalescing + debounce
- 세션 경합
  - 대응: exact channel/channelSessionId envelope, channel 내부 sessionId/seq
    기반 stale 폐기, 단일 물리 Home session invariant

## 13. 수용 기준
1. FULL 재진입 10회에서 Enso tail stutter가 기준선 대비 감소
2. ECO/FULL 전환 시 설정 persistence와 시각 상태 일관성 유지
3. worker 계약 위반이나 init 실패가 hidden fallback 없이 explicit error/telemetry로 surface된다.
4. `npm run build`와 관련 테스트 통과
5. 물리 `zen_home_renderer`는 하나이며 Pond/Bonsai는 exact channel/ACK를 유지한다.
6. worker/main 동시 활성(경쟁 렌더), admission 재시도, capacity inflation,
   hidden semantic fallback 케이스 0건

## 14. 의사결정 요약
- 질문: 워커가 계산만 하고 데이터를 메인에 매프레임 보내야 하나?
  - 답: 아니오. 렌더까지 워커가 소유해야 효과가 크다.
- 질문: 총 비용이 더 높아질 수 있나?
  - 답: IPC 오버헤드는 소폭 증가하지만, main 병목 완화 이득이 더 크다.
- 질문: 기존 워커 매니저와 충돌 위험은?
  - 답: Home의 물리 owner/admission은 `ZenHomeRendererWorkerSession` 하나로
    단일화하고, Pond/Bonsai는 exact logical channel/session 불변식으로 분리한다.
