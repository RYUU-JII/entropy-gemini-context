# Zen Pond

이 경로는 Zen pond subsystem의 canonical home이다.

현재 landed seam:

- `app/`: widget-facing container composition
- `control/`: shared runtime lease, worker renderer client bridge
- `control/runtimeClient/`: worker runtime client canonical internals and private internal slices
- `renderers/pixi/`: Pixi scene orchestration, frame-channel consumers, water effects layer
  - `renderers/pixi/visualProfiles/`: scene-mount render-plan compiler and promoted visual strategies
- `renderers/worker/`: worker boot file and worker-owned control/runtime handlers
- `roster/`: canonical koi roster snapshot contracts and projections
- `runtime/`: cause, channels, frame contract, sim loop, kernel, systems
- `model/koi/`: koi entity, appearance, motion, render math, receiver-agnostic shadow transport
- `world/`: decor entities, palette surface, immutable world-space fields
- `contracts/`: renderer/debug contracts and bathymetry field contract
- `state/`: pond-specific store/selectors/ownership contracts
- `storage/`: pond persistence stores and repositories
- `tuner/`: tuner schema, env presets, non-React control logic

아직 widget subtree 아래에 남아 있는 concern:

- widget-facing view shell
- thin public scanner/tuner entries
- tuner UI subcomponents

즉, 이 루트는 Zen pond를 named subsystem으로 드러내는 첫 landing seam이며,
worker/control/runtime canonical owner는 이제 `zen/pond/*`에 있고,
후속 컷에서는 남은 widget public entry를 더 얇게 유지하는 작업이 중심이다.

필드 경계:

- `world/fields/zenPondBathymetryField.js`는 정적인 pond-bottom geometry SSOT다.
- `renderers/pixi/waterSurfaceField/ZenWaterSurfaceField.js`는 동적인
  height/slope/curvature field이며 bathymetry와 lifecycle/key를 공유하지 않는다.
- depth texture, caustic, shadow는 field consumer/projection이지 geometry owner가 아니다.
- 제품 visual profile은 `contracts/zenPondVisualProfile.js`의 네 독립 축
  (`floor`, `plants`, `rocks`, `sunlight`)만 허용한다. UI 선택은 typed Zen
  workspace repository에 저장되고 `SYNC_RUNTIME_PARAMS`로 같은 pond worker에
  전달된다. profile 변경은 worker를 늘리지 않고 현재 Pixi scene만 교체한다.
- `sunlight=lacy_connected`는 명시적으로 등록된 `leaf_gap_lacy_v1` Komorebi와
  `connected_sunweb_v1` caustic presentation을 컴파일한다. 두 model ID는 허용된
  profile variant지만 제품 기본값은 계속 `leaf_gap_layered_v1`과
  `daylight_hysteresis_v1`이다.
- Pixi는 scene mount에서 `compileZenPondVisualRenderPlan`을 한 번 실행한다.
  frame loop는 이미 선택된 texture/layout/effect 전략만 호출하며 연구소의
  descriptor, Vite replacement, compare slot을 제품에서 import하지 않는다.
- `renderers/pixi/pixiKoiBodyReceiverEffectLease.js`는 scene presentation
  owner를 위한 lazy local slot/stencil seam이며 `PixiKoiFish`는
  texture/transform/destroy 훅만 호출한다. receiver 선택이나 shadow ordering은
  소유하지 않고, 호출 전 product-default display node 비용은 0이다.
- bathymetry depth-material cutover, bottom-distance/receiver shadow,
  continuous koi depth는 아직 Pond Lab research-only이며 active product
  scene에 cutover되지 않았다.
