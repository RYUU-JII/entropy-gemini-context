# Worker Runtime Manual Smoke Checklist

- Status: Active
- Scope: 공통 워커 런타임(`crypto`, `zen experimental`) 운영 점검
- Last Updated: June 12, 2026

- Owner: QA operations
- Last validated against code: 2026-06-12
- Path policy: current-only
- Canonical for: worker runtime manual smoke procedure

## 1) 목적

이 문서는 워커 런타임 변경 이후, 출시 전 수동 점검을 빠르게 반복하기 위한 체크리스트다.
자동 검증(빌드/테스트)과 수동 검증(확장 실동작)을 분리해 기록한다.

## 2) 자동 검증 실행 기록 (CLI)

실행 날짜: February 18, 2026

1. `npm run build`
- 결과: `PASS`

2. `npm run test -- tests/workerRequestClient.test.js`
- 결과: `PASS` (`2 tests`)

3. `npm run test -- tests/stats*.test.js tests/analysisStoreStatsBridge.test.js tests/analysisStoreInitialize.test.js tests/cycleStateManager.test.js`
- 결과: `PASS` (`12 files`, `31 tests`)

4. `npm run test -- tests/cryptoService.test.js tests/zenWorkerRuntimeFlag.test.js`
- 결과: `PASS`

## 3) 수동 점검 준비

1. 빌드 산출물 준비
- `npm run build:dev`
- `dist/manifest.json` 생성 확인

2. Chrome 확장 로드
- `chrome://extensions`
- `Developer mode` ON
- `Load unpacked`로 `dist` 선택

3. DevTools 열기
- Background(Service Worker) 콘솔
- Dashboard/Popup UI 콘솔

## 4) 핵심 수동 시나리오

## 4.1 Background `crypto` 워커

1. 이벤트 로그 저장/조회 흐름 수행
- 기대: 저장/조회 정상, 복호화 실패 없음

2. worker 오류 fallback 점검
- 유도 방법 예시: `crypto.worker.js` 임시 오류 삽입(개발 브랜치 전용)
- 기대: main-thread 암복호화로 기능 유지

## 4.2 Zen 실험 워커 플래그

플래그 키:
- `worker_runtime_enabled`
- `worker_runtime_zen_experimental_enabled`

1. 기본값(둘 다 unset)
- 기대: Zen 실험 워커 경로 사용 가능

2. `worker_runtime_enabled=false`
- 기대: Zen 실험 워커 비활성

3. `worker_runtime_enabled=true` + `worker_runtime_zen_experimental_enabled=false`
- 기대: Zen 실험 워커만 비활성

점검 방법:
- UI 콘솔에서 `localStorage.setItem(...)` 후 페이지 새로고침
- `ZenABTrialWorkerClient.enabled`, `ZenVNextOptimizerWorkerClient.enabled` 상태 확인

## 5) 텔레메트리 점검

1. Zen 이벤트
- 저장 키: `worker_runtime_events` (Zen 경로도 공통 키 사용)
- 기대 이벤트: `worker_start`, `worker_success`, `worker_fail`, `fallback_used`, `circuit_open`

2. 공통 이벤트(브라우저 컨텍스트)
- 저장 키: `worker_runtime_events` (typed store 기준)
- page runtime은 in-memory snapshot + typed store mirror를 사용하고, background 컨텍스트는 메모리 fallback 사용 가능

## 6) 완료 기준 (Release Gate)

1. 자동 검증 전부 PASS
2. 수동 시나리오 4.1~4.2 PASS
3. 치명 로그 없음
- 무한 재시도
- 지속 timeout
- circuit open 고착

## 7) 점검 결과 기록 템플릿

실행 날짜:

실행자:

자동 검증:
- build:
- workerRequestClient test:
- new worker runtime tests:

수동 시나리오:
- crypto worker:
- zen flags:

이슈:
- 

판정:
- PASS / FAIL
