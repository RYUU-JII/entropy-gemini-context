# Worker Runtime Multithreading Spec (Quad-Core Baseline)

- Status: Proposed
- Scope: MV3 확장 기준 Web Worker 운용 체계 통합 (`background` + `UI`)
- Non-goal: Zen 실험 알고리즘 자체의 성능 튜닝, 모델 품질 개선

- Owner: platform workers
- Last validated against code: 2026-03-16
- Path policy: planning-allowed
- Decision needed: Whether the shared worker runtime budget and pool policy becomes the canonical execution baseline for crypto and Zen workloads.

> Active control-plane policy now lives in `docs/architecture/workers/worker-runtime-control-plane.md`. This document remains planning context for multithreading strategy and should not be used as the runtime SSOT for surface ids, lanes, budgets, or degradation modes.

> Canonical path note: worker/runtime owner는 `src/platform/workers/**`, stats domain owner는 `src/domains/stats/background/**` 다. Stats facts read path는 worker runtime surface가 아니며 repository-backed stats owner path에서 직접 읽는다. 아래의 legacy `src/shared/workers/**` / `src/entries/**` 경로는 모두 현재 canonical 경로로 읽어야 하며 새 구현에 다시 사용하면 안 된다.

## 해석 가이드 (유연 모드)

- 이 문서의 `필수/강제/고정`은 운영 기본값을 뜻한다.
- 단계적 실험 중에는 측정 근거와 롤백 경로를 남기면 예외 적용이 가능하다.
- 릴리즈 단계에서는 예외를 재평가해 안정 정책으로 수렴한다.

## 1) 목적

현재 프로젝트는 워커를 이미 사용 중이지만, 워커 초기화/타임아웃/실패처리/텔레메트리가 기능별로 분산되어 있다.

이 문서의 목표는 다음 4가지를 동시에 만족하는 멀티스레딩 운영 스펙을 정의하는 것이다.

1. 확장성: 테마별 실험 기능이 추가되어도 공통 런타임 위에서 관리 가능
2. 안정성: 워커 실패/타임아웃/회로차단(circuit breaker) 정책 일관화
3. 유지보수성: 워커 계약(Request/Response/Cancel/Timeout) 단일화
4. 직관성: 쿼드코어 기준으로 이해 가능한 자원 예산 모델 제공

## 2) 전제 조건 및 철학

1. 최소 하드웨어 가정
- 최소 `4 logical cores` 환경을 기준으로 UX를 설계한다.
- 단, 코어는 브라우저/OS/타 앱과 공유되므로 전용 자원으로 가정하지 않는다.

2. 자원 운영 원칙
- `main thread`는 항상 사용자 상호작용을 우선 보장한다.
- 워커는 `메인 스레드 보호` 목적이며, 최대 병렬도는 보수적으로 운용한다.

3. 현실적 제약 (MV3)
- `UI 컨텍스트`와 `Service Worker(background)`는 서로 분리된 실행 컨텍스트다.
- 따라서 “절대 전역 워커 개수” 하드캡 대신, 컨텍스트별 예산 + 소프트 조정 정책을 사용한다.

## 3) 현행 상태 인벤토리

### 3.1 이미 사용 중인 워커

1. `crypto.worker`
- 파일: `src/platform/workers/crypto.worker.js`
- 호출부: `src/platform/security/CryptoService.js`
- 현재 용도: `ENCRYPT_BATCH`, `DECRYPT_BATCH`

2. `zenAbTrialEvaluator.worker`
- 파일: `src/themes/plugins/zen/workers/zenAbTrialEvaluator.worker.js`
- 호출부: `src/themes/plugins/zen/model/ZenABTrialWorkerClient.js`
- 현재 용도: A/B trial 평가 + Sobol cold start pool 생성

3. `zenVNextOptimizer.worker`
- 파일: `src/themes/plugins/zen/workers/zenVNextOptimizer.worker.js`
- 호출부: `src/themes/plugins/zen/model/vnext/ZenVNextOptimizerWorkerClient.js`
- 현재 용도: vNext factor optimizer

4. `zenVNextPreferenceTrainer.worker`
- 파일: `src/themes/plugins/zen/workers/zenVNextPreferenceTrainer.worker.js`
- 호출부: `src/themes/plugins/zen/model/vnext/ZenVNextPreferenceTrainerWorkerClient.js`
- 현재 용도: vNext preference model training

### 3.2 현행 구조 문제

1. 워커 클라이언트 구현 중복
- init/ready/pending/timeout/reject/fallback 흐름이 기능별로 중복

2. 스케줄링 분산
- Zen 내부는 자체 풀 운용, crypto는 단일 워커 운용
- 우선순위와 자원 충돌 정책이 공통화되지 않음

3. 텔레메트리 분산
- Zen은 `WorkerExecutionController` + runtime event 저장이 있으나, crypto는 동일 체계가 아님

## 4) 목표 아키텍처

## 4.1 컨텍스트별 워커 예산 (Quad-Core Baseline)

기본 정책:
- 메인 스레드 보호를 위해 워커 총량을 보수적으로 시작
- 기본 운용은 `메인 1 + 워커 2`, 버스트 시점에만 워커 3 허용

권장 예산:

1. Background 컨텍스트
- `maxWorkers = 2`
- lane
`secure: 1` (`crypto`)
`compute: 1` (공용 연산)

2. UI 컨텍스트
- `maxWorkers = 1`
- `burstMaxWorkers = 2`
- `burstWindowMs = 15000`

3. Zen 실험 기능
- 기본은 feature flag 뒤에서 실행
- 출시 SKU에서 비활성 또는 경량 경로로 대체 가능해야 함

## 4.2 공통 런타임 계층

신규 공통 모듈:
- `src/platform/workers/runtime/`

핵심 구성요소:
1. `WorkerRuntimePolicy`
- 하드웨어/컨텍스트 기반 예산 계산

2. `WorkerExecutionController` (공용화)
- fallback policy, circuit breaker, failure counter

3. `WorkerTaskQueue`
- priority queue + cancellation + dedupe

4. `WorkerPool` (경량)
- lane별 워커 인스턴스/슬롯 관리

5. `WorkerTelemetry`
- 공통 이벤트 스키마, 성능/오류 메트릭 수집

## 4.3 작업 계약 표준

Request:
```ts
type WorkerTaskRequest = {
  id: string;
  type: string;
  lane: 'secure' | 'compute';
  priority: 'interactive' | 'user_visible' | 'background';
  timeoutMs: number;
  cancelKey?: string;
  dedupeKey?: string;
  payload: Record<string, unknown>;
};
```

Response:
```ts
type WorkerTaskResponse<T = unknown> = {
  ok: boolean;
  mode: 'worker' | 'fallback' | 'worker_error' | 'fallback_error' | 'blocked';
  result?: T;
  error?: string;
  metrics?: {
    queuedMs: number;
    execMs: number;
    retries: number;
  };
};
```

## 5) 우선순위 및 스케줄링 규칙

1. 우선순위
- `interactive`: 즉시 UI 반응 필요 (예: optimize 버튼 클릭)
- `user_visible`: 화면 반영 중요 (예: 대시보드 계산)
- `background`: 지연 허용 (예: 정기 정규화, 청소 작업)

2. 공정성
- 같은 priority 내 FIFO
- starvation 방지를 위해 대기시간이 임계치 초과 시 한 단계 승격(aging)

3. 취소 정책
- `cancelKey` 단위 취소 지원
- 최신 요청이 이전 요청을 무효화하는 UI 경로는 stale 작업 즉시 취소

4. 중복 제거
- 같은 `dedupeKey`가 실행 대기열에 있으면 새 요청을 병합 또는 기존 Promise 공유

## 6) 기능별 목표 운용 정책

1. `crypto` (핵심)
- lane: `secure`
- priority: `user_visible`
- fallback: main thread 허용
- timeout: 30s

2. `stats` (핵심)
- lane: `compute`
- priority: `background` 기본, UI 요청 시 `user_visible`
- fallback: main thread 허용
- timeout: 30s

3. `zen_ab_trial_eval` (실험/옵션)
- lane: `compute`
- priority: `interactive`
- fallback: `strict` only, semantic main-thread/local fallback 금지
- timeout: 120s

4. `zen_cold_start_pool` (실험/옵션)
- lane: `compute`
- priority: `background` 또는 `user_visible` (화면 블로킹 여부에 따라)
- timeout: 180s

5. `zen_optimize` (실험/옵션)
- lane: `compute`
- priority: `interactive`
- timeout: 180s

## 7) 실패 모델 및 안정성 규칙

1. Circuit Breaker
- 작업 유형별 연속 실패 임계치 초과 시 circuit open
- open 기간에는 fail-fast `blocked` 반환

2. Timeout
- 모든 요청은 명시적 타임아웃을 기본 적용
- timeout 시 pending 정리 + 텔레메트리 기록

3. Worker Crash
- 슬롯 단위 worker reset 후 재초기화
- 재초기화 실패 시 정책에 따라 fallback

4. Degrade 모드
- `hardwareConcurrency < 4` 또는 repeated failure 환경에서 자동 축소
`maxWorkers`를 보수값(1)으로 강등

## 8) 관측성 (Telemetry) 표준

공통 이벤트:
- `worker_start`
- `worker_success`
- `worker_fail`
- `worker_timeout`
- `fallback_used`
- `circuit_open`
- `queue_dropped`
- `request_canceled`

핵심 태그:
- `taskType`
- `lane`
- `priority`
- `context` (`ui` | `background`)
- `workerId`

핵심 KPI:
1. P95 queue wait
2. P95 execution time
3. fallback rate
4. timeout rate
5. circuit open count/day

## 9) 구현 계획 (순차 실행용)

## Phase 0: 스펙 정리 및 플래그 정의

작업:
1. 런타임 플래그 키 정의
- `worker_runtime_enabled`
- `worker_runtime_zen_experimental_enabled`
- `worker_runtime_debug_telemetry_enabled`
2. task type/lane/priority enum 기준 정의
3. 컨텍스트별 예산 기본값 코드화

산출물:
- `src/platform/workers/runtime/config.js`
- `src/platform/workers/runtime/types.js`

완료 기준:
- 기존 기능 동작 영향 없이 enum/config import 가능

## Phase 1: 공통 런타임 코어 구축

작업:
1. `WorkerExecutionController` 공용 모듈로 이동
2. `WorkerTaskQueue` 추가 (priority + cancel + dedupe)
3. `WorkerTelemetry` 추가 (공통 이벤트 스키마)
4. `WorkerPool` 추가 (lane별 slot 관리)

산출물:
- `src/platform/workers/runtime/WorkerExecutionController.js`
- `src/platform/workers/runtime/WorkerTaskQueue.js`
- `src/platform/workers/runtime/WorkerTelemetry.js`
- `src/platform/workers/runtime/WorkerPool.js`
- `src/platform/workers/runtime/index.js`

완료 기준:
- 단위 모듈 로드 가능
- 기존 zen 전용 컨트롤러와 동등 기능 확보

## Phase 2: Background 핵심 워커 이관

작업:
1. `statsRuntimeService`의 워커 요청 경로를 공통 런타임으로 이관
2. `CryptoService`의 워커 요청 경로를 공통 런타임으로 이관
3. timeout/error/fallback 로그를 공통 텔레메트리로 통일

대상 파일:
- `src/domains/stats/background/runtime/statsRuntimeService.js`
- `src/platform/security/CryptoService.js`

완료 기준:
- stats/crypto 기능 회귀 없음
- fallback/circuit 이벤트가 동일 포맷으로 기록됨

## Phase 3: Zen 실험 워커를 플러그인 모드로 분리

작업:
1. `ZenABTrialWorkerClient`, `ZenVNextOptimizerWorkerClient`, `ZenVNextPreferenceTrainerWorkerClient`를 공통 런타임 어댑터 위로 재구성
2. Zen 실험 기능은 `worker_runtime_zen_experimental_enabled` 플래그로 완전 on/off
3. 출시 SKU에서 실험 워커 제거해도 core runtime 영향 없도록 경계 분리

대상 파일:
- `src/themes/plugins/zen/model/ZenABTrialWorkerClient.js`
- `src/themes/plugins/zen/model/vnext/ZenVNextOptimizerWorkerClient.js`
- `src/themes/plugins/zen/model/vnext/ZenVNextPreferenceTrainerWorkerClient.js`
- `src/themes/plugins/zen/runtime/classic/control/useZenABController.js`
- `src/themes/plugins/zen/widgets/core/ZenCoreStatus.jsx`

완료 기준:
- Zen 실험 off 상태에서 워커 관련 에러 없이 기능 degrade
- on 상태에서 기존 동작/fallback 정책 유지

## Phase 4: 대시보드 집계 경로 최적화 (선택)

작업:
1. `aggregates.js`/`cycleScoring.js`의 고비용 집계를 compute lane job으로 분리 검토
2. UI 프레임 드랍 구간만 선택적으로 워커화

대상 파일:
- `src/apps/dashboard/stats/index.js`
- `src/domains/stats/analysis/cycleScoring.js`

완료 기준:
- 체감 성능 개선이 있을 때만 채택
- 코드 복잡도 증가가 이득을 초과하면 보류

## Phase 5: 하드닝 및 운영 가이드

작업:
1. 운영 문서에 장애 대응 시나리오 추가
2. debug telemetry 조회 유틸 추가
3. 릴리즈 체크리스트에 worker runtime 점검 항목 추가

완료 기준:
- 장애 시 fallback 경로/복구 절차 문서화
- 운영자가 queue/timeout/circuit 상태를 추적 가능

## 10) 롤아웃 전략

1. `Phase 2`까지는 핵심 워커(stats/crypto) 우선 안정화
2. Zen 실험은 별도 플래그로 단계적 활성화
3. 기본값은 보수 정책 유지
- background 2, ui 1, burst 2

## 11) 리스크 및 대응

1. 리스크: 워커 공통화 과정에서 초기 회귀
- 대응: 기존 클라이언트 래퍼를 한 단계 유지하고 내부 구현만 교체

2. 리스크: 과도한 큐 관리 복잡도
- 대응: 초기 slice는 최소 기능(priority/cancel/timeout)만 도입하고, retry/backoff는 후속 slice로 분리

3. 리스크: 컨텍스트 분리로 전역 예산 오차
- 대응: 하드캡 대신 컨텍스트 상한 + 소프트 텔레메트리 기반 조정

## 12) 최종 결정 요약

1. 쿼드코어 기준은 타당하며, 구현은 “코어 고정”이 아니라 “워커 예산 정책”으로 간다.
2. 출시 핵심은 공통 연산(stats/crypto) 안정화이며, Zen 고비용 워커는 플래그 기반 실험 레이어로 분리한다.
3. 공통 런타임(`src/platform/workers/runtime`)을 중심으로 확장성/안정성/유지보수성을 확보한다.
