# Camera/Coordinate Normalization Plan

- Status: Active
- Owner: dashboard tools scene runtime
- Last validated against code: 2026-03-16
- Path policy: current-only
- Canonical for: artifact gallery camera and coordinate normalization rules

## 1. 목적

Zen Artifact Gallery에서 화면 비율(가로/세로, ultra-wide, portrait) 변화 시 발생하는:

- 가레산스이 각도 체감 변화
- 동심원 중심점과 아티팩트 상대좌표 드리프트
- 아티팩트 전환 시 위치 튐

문제를 구조적으로 제거한다.

핵심 원칙은 `좌표계 1개 + 카메라 1개 + 투영 함수 1개`다.

## 해석 가이드 (유연 모드)

- 이 문서의 `필수/금지/강제/고정`은 기본 아키텍처 가드레일 의미다.
- 실험적 예외가 필요하면 근거/적용 범위/복귀 계획을 함께 남긴다.
- 본선 반영 전에는 예외 경로를 정리해 단일 경로로 수렴한다.

---

## 2. 의의 (왜 필요한가)

### 2.1 레이아웃 안정성

기존 `%/px/컴포넌트별 보정` 혼합 방식은 화면비가 바뀔 때 오차가 누적된다.  
정규화된 월드 좌표와 단일 카메라 투영은 배경/아티팩트가 같은 수학을 따르므로 상대 위치가 유지된다.

### 2.2 테마 엔진 범용성

테마는 “렌더 계산”이 아니라 “Scene Spec 데이터”와 “stage view”를 제공해야 한다.  
새 테마 추가 시 core `ArtifactGallery` 수정 없이 visual policy와 `ArtifactCanvas`만 추가하면 된다.

### 2.3 유지보수성과 디버깅

이상 현상이 발생하면 `Scene Spec`과 `projectWorldToScreen`만 확인하면 된다.  
좌표 버그 원인을 찾는 시간이 대폭 줄어든다.

### 2.4 성능 예측 가능성

연산 비용은 대부분 상수 시간(앵커/오브젝트 수 비례)이며 작다.  
병목은 필터/블러/복잡 SVG이므로 최적화 포인트가 명확해진다.

---

## 3. 최종 목표 아키텍처

## 3.1 계층

1. Scene Spec 계층 (데이터)
- 위치: `src/themes/core/toolsVisualPolicy.js`의 visual policy / scene spec override
- 역할: 카메라, 앵커, 배치 파라미터 정의

2. Scene Runtime 계층 (수학)
- 위치: `src/apps/dashboard/tabs/tools/components/sceneRuntime.js`
- 역할: world->screen 투영, viewport 해석, 정규화

3. Render 계층 (표현)
- 위치: `ArtifactGallery`, `DefaultArtifactCanvas`, theme `ArtifactCanvas`, Artifact 컴포넌트
- 역할: runtime 결과를 그리기만 함

## 3.2 주의사항 (기본 가드레일)

- 렌더 컴포넌트 내부에서 scene-level `%/px` 보정 계산은 지양
- 테마별 임시 보정 상수 하드코딩은 지양
- legacy 경로와 신규 경로 동시 유지는 지양

---

## 4. Canonical Data Contract

```ts
type SceneSpec = {
  version: 1
  worldUnit: "normalized_min_dim" | "normalized_max_dim" | "px"
  fitMode: "contain" | "cover"
  camera: {
    perspective: number
    center: { x: number; y: number }
  }
  groundLayout: {
    topOffsetWorld: number
    concentricMask: { rxPercent: number; ryPercent: number }
    ring: {
      count: number
      baseRxPercent: number
      baseRyPercent: number
      stepScale: number
      grooveShadowStrokeWidth: number
      grooveHighlightStrokeWidth: number
      grooveHighlightYOffsetPercent: number
    }
    focus: { rxPercent: number; ryPercent: number; pulseScaleMax: number }
    debugMarker: { outerRadiusPx: number; innerRadiusPx: number }
  }
  anchors: Record<string, { x: number; y: number; z: number }>
  artifacts: Record<string, { anchorId: string; offset: { x: number; y: number; z: number } }>
}
```

---

## 5. 완전 적용 로드맵

## Phase A (완료됨)

- `ArsenalGallery` -> `ArtifactGallery` 리네임
- `sceneRuntime` 도입
- `sceneSpec`를 theme visual policy 경로에서 합성
- Zen stage를 core 하드코딩 대신 `ArtifactCanvas` widget slot으로 분리

## Phase B (우선)

### B1. Runtime API 안정화
- `resolveArtifactGallerySceneRuntime(...)` 반환 스키마를 기준화
- 런타임 validator 추가 (잘못된 spec 값 clamp + 경고 로그)

### B2. 렌더러 정합성 점검
- `DefaultArtifactCanvas`/theme `ArtifactCanvas`/`ArtifactGallery`가 runtime 외 좌표 계산하지 않도록 점검
- scene-level 좌표 연산 유틸을 runtime로 단일화

### B3. 전환 안정화
- 아티팩트 전환 시 anchor는 고정, keyed layer는 offset만 적용(현재 구조 유지)
- 필요 시 offset spring 보간 추가 (진동/튐 방지)

## Phase C (권장, 3D 완성 단계)

### C1. 카메라 모델 확장
- `camera`에 `fovDeg/pitchDeg/yawDeg/near/far` 추가
- 행렬 기반 `projectWorldToScreen` 도입

### C2. Plane 개념 도입
- `groundPlane` normal/xAxis/yAxis 추가
- 동심원/배경 path를 plane 좌표 기준 생성

### C3. Debug HUD
- 월드축(X,Y,Z), 앵커명, 스크린 좌표, worldUnit px 표시
- portrait/landscape 비교 디버깅 단축

---

## 6. 수용 기준 (Acceptance Criteria)

1. Geometry invariance
- 16:9 / 4:3 / 21:9 / 9:16에서  
  `karesansui_center` 대비 아티팩트 월드 벡터가 동일

2. Visual stability
- 아티팩트 전환 시 점프/튀는 이동이 보이지 않음
- 하늘/지면 경계가 비율 변화에도 안정 유지

3. Code integrity
- scene-level 좌표 계산 함수는 runtime만 사용
- legacy 보정 상수 직접 사용 지양
- theme별 값은 visual policy scene spec에서만 관리

4. Performance
- resize/selection 시 프레임 드랍 유의미 증가 없음
- 성능 병목은 렌더 효과(blur/mask)에서만 관측

---

## 7. 리스크와 대응

1. Risk: 오래된 테마 정책 필드 잔존
- Mitigation: `toolsVisualPolicy.js`에서 scene spec 합성 경로를 단일화하고, theme canvas는 runtime consumer로만 유지

2. Risk: 렌더러 내부 임의 보정 재유입
- Mitigation: lint 규칙/코드리뷰 체크리스트에 “scene math in runtime only” 추가

3. Risk: 3D 행렬 도입 시 초기 시각 변화
- Mitigation: 단계적 전환 (camera params 고정 후 점진 활성)

---

## 8. 롤아웃 전략

1. mainline 단일 경로 유지 (dual runtime 지양)
2. Phase B 완료 후 QA 기준 통과 시 배포
3. Phase C는 feature flag로 실험 후 hard cut

---

## 9. 실행 체크리스트

1. sceneRuntime validator 추가
2. Debug HUD 추가
3. 렌더러 좌표 연산 grep 점검
4. 화면비 스냅샷 비교 자동화
5. 전환 모션 spring 보간 옵션 적용
6. Phase C 카메라 행렬 설계 확정
