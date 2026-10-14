# Zen Shishi-odoshi Friction Runtime Redesign

- Status: Proposed
- Owner: zen theme architecture
- Last validated against code: 2026-07-12
- Path policy: planning-allowed
- Decision needed: Whether Zen feed-terminus rendering should adopt a theme-owned Shishi-odoshi presentation beyond the current gatekeeper/disruption renderer contracts.

## 1) 조사 결과 (현재 상태)
- `Omikuji`는 대시보드 아티팩트 위젯이며 실제 페이지 런타임 개입 코드와 분리되어 있음.
  0회 사용되던 레거시 `DeerScarer.jsx` 목업은 삭제되었고, 시시오도시 표현은 canonical
  `ShishiOdoshi.jsx`와 그 scene/recipe owner를 사용한다.
  - `src/themes/plugins/zen/widgets/tools/Omikuji.jsx`
  - `src/themes/plugins/zen/widgets/tools/ShishiOdoshi.jsx`
  - `src/themes/plugins/zen/widgets/tools/presentation/ZenShishiOdoshiScene.jsx`
- 실제 페이지의 feed horizon은 독립 Barrier 개입이 아니라 Enso runtime episode의 prelude다.
  `EnsoRuntimeEpisodeManager`가 feed-flow/terminus lifecycle을 소유하고, 사용자가 마른
  feed를 다시 당기는 renewed demand가 확인된 때에만 production Enso gate로 이어진다.
  - `src/domains/nudge/interaction/EnsoRuntimeEpisodeManager.js`
  - `src/domains/nudge/feed-flow/terminus/FeedTerminusController.js`
- 이전 `InfiniteScrollManager`/Barrier/Loop Breaker 연결은 retired historical design이며
  새 Zen presentation이 그 경로를 복구하면 안 된다.
- Zen은 `gatekeeperStyle: 'zen'`, `disruptionStyle: 'zen'` 계약을 theme manifest와 core friction variant seam에서 선언.
  - `src/themes/plugins/zen/manifest.js`
  - `src/themes/core/friction/variants/*`
- 사운드 경로는 현재 비어 있어(기본값) 시시오도시 클랙/해제 버스트가 실제 재생되지 않음.
  - `src/lib/assets/index.js`

## 2) 목표
- Zen 테마에서 루프 브레이커가 실제 페이지에서 **시시오도시(Shishi-odoshi) 경험**으로 보이고 동작해야 함.
- 해제 이후 이펙트도 Zen에 맞는 후속 효과(물결/잔향/정적 수렴)로 전환.
- 동시에 다른 테마도 공용 Glitch 잔재에 묶이지 않도록 테마별 렌더러 확장 구조를 확보.

## 3) 비목표
- 대시보드 아티팩트(Omikuji) UI 자체 리디자인은 본 스코프 제외.
- Behavior Engine 실험 기능과의 결합은 제외.

## 4) 설계 원칙
- 공통 책임(상태머신/락/쿨다운)은 feature 레이어에 유지.
- 테마별 시각/모션/해제 연출은 `themes/core/friction` 하위 렌더러로 분리.
- `profile.friction` 계약으로 선택하고, 렌더러는 계약 ID 기반으로 resolve.

## 5) 제안 아키텍처
### 5.1 Gatekeeper 분리
- 현재:
  - old in-page gatekeeper overlay 경로는 retired 상태이며, 현재 gatekeeper variant/renderer 계약은 `themes/core/friction`에서 관리됨.
- 변경:
  - feed terminus core(`FeedTerminusController`)와 theme-owned presentation renderer의 책임을 분리.
  - 인터페이스:
    - `mount({ container, copy, colors, tuning })`
    - `update({ scrollGlow, tugImpulse, isPressing, holdProgress })`
    - `playUnlockIntro()`
    - `unmount()`

### 5.2 Disruption 분리
- 현재:
  - `VisualEffectManager`가 단일 Glitch 루프를 거의 공통 사용.
- 변경:
  - `DisruptionRenderer` 맵 기반 실행:
    - `signal_disruption` (entropy/matrix/cyberpunk/scp 기본)
    - `clinicalPulse`
    - `zenShishiAfterglow`
  - 인터페이스:
    - `play({ root, body, colors, tuning }) => Promise<void>`

### 5.3 Variant 계약 확장
- `gatekeeper` variant:
  - `rendererId`: `default_gatekeeper` | `zen_ishidouro` | ...
  - `interstitialRendererId`: `default_gate_interstitial` | `zen_shishi_odoshi` | ...
  - `unlockPattern`: 기존 유지(호환), 점진적으로 `rendererId` 기반으로 축소
  - `copyVariant`: 기존 유지
- `disruption` variant:
  - `rendererId`: `signal_disruption` | `clinical_pulse` | `zen_afterglow`
  - 기존 tuning(`shakeAmplitudePx` 등)은 renderer별 사용/무시를 명시

## 6) Zen 전용 상세 스펙
### 6.1 Gatekeeper (잠금 상태)
- 하단 오버레이에 시시오도시 모티프 추가:
  - 대나무 튜브(수위 fill), 지지대, 받침석.
  - downward tug 시 수위 증가 + 튜브 미세 기울기 + 글로우 증가.
  - 임계치 도달 시 `clack` 모션(짧은 반동) 1회.
- Hold 버튼은 기존 UX 유지(길게 누르기 해제), Zen copy 유지.

### 6.2 Unlock Intro (게이트 해제 직전)
- 기존 pattern random 대신 Zen 기준 시퀀스:
  - `clack frame` -> `ring ripple` -> `mist fade`.
- 색상은 테마 컨텍스트(`accent/accentSecondary/text`) 기반.

### 6.3 Unlock After Effect (DISRUPTION 대체)
- Zen에서는 Glitch invert/hue jitter를 지양.
- `zenShishiAfterglow`:
  - 짧은 백색/청록 bloom + 동심원 파동 + 미세 카메라 복원(translate decay).
  - 300~450ms 내 종료.

### 6.4 Audio
- 선택 사운드 슬롯 추가:
  - `FRICTION_ASSET_PATHS.gatekeeper.zenClack`
  - `FRICTION_ASSET_PATHS.effects.zenRelease`
- 경로가 비어 있으면 명시적 무음 상태로 유지.

## 7) 타 테마 적용 전략
- Entropy/Cyberpunk/Matrix/SCP:
  - 현재 신호 왜곡 스타일을 `signal_disruption` 렌더러로 캡슐화하고 유지.
- Clinical:
  - 대비/색반전 최소의 `clinicalPulse`로 분리.
- 효과적으로 “공용 코어 + 테마 렌더러” 구조만 공유.

## 8) 파일 단위 변경안
- 신규(제안):
  - `src/themes/core/friction/renderers/gatekeeper/index.js`
  - `src/themes/core/friction/renderers/gatekeeper/defaultGatekeeperRenderer.js`
  - `src/themes/core/friction/renderers/gatekeeper/zenIshidouroRenderer.js`
  - `src/themes/core/friction/renderers/disruption/index.js`
  - `src/themes/core/friction/renderers/disruption/signalDisruptionRenderer.js`
  - `src/themes/core/friction/renderers/disruption/clinicalPulseRenderer.js`
  - `src/themes/core/friction/renderers/disruption/zenAfterglowRenderer.js`
- 수정(핵심):
  - `src/domains/nudge/feed-flow/terminus/FeedTerminusController.js`
  - `src/domains/nudge/effects/VisualEffectManager.js`
  - `src/themes/core/friction/variants/gatekeeper/*.js`
  - `src/themes/core/friction/variants/disruption/*.js`
  - `src/lib/assets/index.js`

## 9) 단계별 실행 계획
### Phase 1: 구조 분리
- Gatekeeper/Disruption 렌더러 인터페이스 도입.
- 기존 동작을 `default_gatekeeper` 렌더러로 그대로 이전(회귀 방지).

### Phase 2: Zen 구현
- `zen_ishidouro` 게이트키퍼 렌더러 구현.
- `zen_afterglow` 해제 이펙트 렌더러 구현.

### Phase 3: 타 테마 정리
- Clinical 전용 after effect 분리.
- 나머지 테마는 signal disruption renderer로 유지하되 variant 계약 정돈.

## 10) 완료 기준 (Acceptance Criteria)
- Zen 테마에서 루프 브레이커 발동 시 시시오도시 시각 요소가 명확히 보일 것.
- Zen 해제 이후 이펙트에 invert/hue-distortion이 나타나지 않을 것.
- 다른 테마 기능 회귀가 없고 기존 발동/쿨다운/해제 정책 동일할 것.
- assets 미설정 환경에서도 오류 없이 동작할 것.

## 11) 리스크와 대응
- 리스크: feed terminus core와 theme presentation이 다시 결합되면 회귀 가능성.
- 대응: Phase 1에서 기존 renderer contract를 유지한 상태로 presentation만 교체.
