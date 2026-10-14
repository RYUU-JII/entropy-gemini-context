# Theme Artifact Storytelling Guide

- Status: Active
- Owner: theme architecture
- Last validated against code: 2026-04-18
- Path policy: planning-allowed
- Canonical for: theme artifact naming and storytelling guidelines

이 문서는 테마 세계관 표현과 공통 로직 네이밍을 분리하기 위한 운영 가이드다.

## 1) 핵심 가이드라인 (기본값)

- 공통 구조(`features/shared/background`)의 함수명/상태명/주석은 중립 용어를 기본으로 사용한다.
- artifact의 canonical key는 고정한다.
- `lens`, `veil`, `barrier`, `flare`, `echo`, `gate`
- runtime module id(`loopBreaker`, `memoryPurge`, `sentinelFlare`, `timeAnchor`)는 execution detail로만 유지하고, copy/widget contract로 승격하지 않는다.
- 테마 세계관 용어는 표시 계층에서 사용한다.
- i18n context key(`*_entropy`, `*_zen` 등)
- 테마 전용 컴포넌트/비주얼 자산
- 예외가 필요하면 범위(실험/진단/임시)와 종료 조건을 문서화한다.

## 2) Source of Truth

- artifact identity contract:
- `src/themes/core/tools/artifacts.js`
- 보유 필드:
- `id`(canonical protection id)
- `visualKey`(renderer/signature key)
- `copyKey`(i18n lookup key)
- `widgetType`(theme widget registry key)
- `iconKey`(icon registry key)
- 표시 copy:
- `src/i18n/locales/*/tools.json`
- theme definition(`src/themes/definitions/*.js`)는 artifact title/subtitle/description copy를 소유하지 않는다.
- theme는 stage/canvas/widget과 visual policy를 통해 표현을 바꾼다.

## 3) 용어 배치 원칙

- 내부(중립):
- 트리거/상태/신호/스토리지/메시지 타입
- 예: `flareArtifactStatus`, `breachedCount`, `scrollFlow`
- 외부(테마 표현):
- 카드 타이틀/설명/상태 라벨/디버그 문구/내러티브 문구
- 예: Entropy의 `Sentinel`, Zen의 `Decoy`/`Pattern Break`

## 4) Artifact 표현 맵

- `barrier`
- 중립 표현: Barrier
- Zen 표현: The Causality Lantern
- `gate`
- 중립 표현: Gate
- Zen 표현: The Hollow Striker
- 비-Zen 테마는 gatekeeper 계열 비주얼을 사용할 수 있지만, canonical UI contract는 항상 `gate`를 유지한다.
- `echo`
- 중립 표현: Echo
- Entropy 표현: The Lethe
- Zen 표현: Great Wave
- `flare`
- 중립 표현: Flare
- Entropy 표현: Sentinel lore 기반 문구
- Zen 표현: Furin / Flow lore 기반 문구
- Zen/Furin 상세 세계관은 `docs/architecture/themes/artifacts/sentinel-flare-activation-spec.md`가 소유한다. 해당 세계관은 `sentinelFlare`, `site_furin`, `global_sentinel`, Room 478, residue aftermath에만 적용하며 다른 artifact family의 기본 철학으로 승격하지 않는다.
- `lens`, `veil`
- 중립 표현을 유지하되 테마별 stage/canvas 표현으로 톤을 조정한다.

## 5) 구현 체크리스트

- 새 세계관 용어를 추가할 때:
- 1. 공통 코드에는 중립 용어를 우선하고, 세계관 용어는 표시 계층에 배치한다.
- 2. artifact identity는 `src/themes/core/tools/artifacts.js`에만 추가한다.
- 3. 표시 문구는 i18n context 키 경로를 사용한다.
- 4. 가능하면 `en/ko`를 함께 반영한다.
- 5. 해당 테마 문서에 근거(의도/적용 범위)를 남긴다.
- 테마 간 혼선 방지:
- 기본(base) 번역은 항상 중립 용어로 유지한다.
- 세계관 용어는 context 번역에서만 override한다.
- theme definition에 artifact copy를 중복 추가하지 않는다.

## 6) Zen Memory Purge 컨셉(채택)

- 채택: Great Wave
- 의도: “기억 흔적을 한 번에 덮어 지운다”는 메타포를 명확히 전달
- 운영 가이드:
- 모션/사운드는 위협보다 정화/리셋 감각을 우선
- 내부 key/로직은 계속 `memoryPurge`/`lethe` 중립 구조를 유지
