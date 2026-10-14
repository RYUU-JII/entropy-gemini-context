# Architecture Docs

이 경로는 `docs/system-architecture/` 정본을 보조하는 현재 구현 설명 문서들을 모은다.

## 우선순위

1. 시스템 전체 topology와 owner 판정은 `../system-architecture/`
2. storage detail은 `storage/`
3. runtime detail은 `runtime/`
4. i18n, workers, security, themes는 각 하위 폴더

## 구성

- `repository/`: 현재 저장소 구조 지도, hotspot 분류, staged refactor queue
- `runtime/`: injection, bootstrap, launch/runtime behavior
- `progression/`: five qualified-use-day release policy and progression owners
- `guidance/`: contextual guide receipts, presentation admission and first installation
- `storage/`: backend selection, data shape, evolution policy
- `security/`: permission, surface reduction, security decisions companion
- `i18n/`: translation architecture
- `workers/`: worker runtime architecture
- `themes/`: theme and zen-specific design docs
