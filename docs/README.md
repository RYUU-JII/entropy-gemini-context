# Entropy Documentation Map

이 디렉터리는 현재 코드와 현재 owner 구조를 기준으로 정리된 문서 진입점이다.

## 가장 먼저 읽을 문서

1. `../README.md`
2. `system-architecture/README.md`
3. `governance/document-system.md`
4. `governance/document-registry.md`
5. `architecture/README.md`

## 문서 분류

- `system-architecture/`: 최종 구조와 최종 owner를 고정하는 정본
- `governance/`: 문서 운영 규칙, naming, registry, engineering guard
- `architecture/`: storage, runtime, i18n, workers, themes 세부 설계
- `product/`: PRD, information architecture, UX direction
- `domains/`: behavior, protection, stats 등 도메인 baseline
- `apps/`: background, dashboard 등 entrypoint/app shell 문서
- `operations/`: CI, QA, runbook
- `migrations/`: 현재 진행 중인 전환 문서
- `archive/`: historical evidence와 legacy plan

## 읽기 원칙

- 제품 철학과 이름의 전체 이야기는 [선언문](product/entropy-manifesto.md), 개별 이론과 가설의 책임은 [제품 문서 지도](product/README.md)를 본다.
- “현재 구조의 정답”을 찾을 때는 먼저 `system-architecture/` 를 본다.
- 세부 구현 규칙을 찾을 때는 `architecture/` 와 `domains/` 를 본다.
- 제품 요구사항과 화면 구조는 `product/` 를 본다.
- 완료되었거나 폐기된 계획은 `archive/` 에서만 읽는다.

## 현재 핵심 정본

- topology / owners: `system-architecture/README.md`
- storage detail: `architecture/storage/storage-architecture-target.md`
- runtime injection: `architecture/runtime/friction-filter-injection-architecture.md`
- i18n target: `architecture/i18n/i18n-architecture-target.md`
- theme canon: `architecture/themes/zen/zen-theme-definition.md`
- document rules: `governance/document-system.md`

## 현재 문서 시스템의 의도

이 구조의 목적은 문서를 한 곳에 몰아넣는 것이 아니라,
질문의 종류마다 “정답이 사는 경로”를 명확히 고정하는 것이다.
