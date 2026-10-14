# Dashboard BootShell + Worker Loader Architecture Plan (Superseded)

- Status: Archived
- Owner: dashboard app
- Last validated against code: 2026-07-08
- Path policy: planning-allowed
- Superseded by: `dashboard-boot-sequence-architecture.md` and `zen-main-boot-and-data-readiness.md`

> Current authority note: this is a historical planning document, not the active boot contract. Use `dashboard-boot-sequence-architecture.md` for the current dashboard BootShell lifecycle and `zen-main-boot-and-data-readiness.md` for the current Zen complete first-scene contract. Fallback/rollback wording below is historical vocabulary only and must not be treated as implementation permission unless it has been copied into an Active document with an owner, diagnostic signal, and exit condition.

## Supersession Scope

- Current visible boot release is governed by `bootManager` gate state: `themeReady && coreReady && mainTabFirstFrameReady`.
- Current Zen normal success is complete first-scene readiness evidence, including pond, bonsai, and first-viewport capture readiness.
- Current hard-timeout behavior is forced visual release: BootShell may reveal the root for user-control recovery, but it records `forcedVisualRelease === true` and cannot create clean `ready` or `dismissible` state by itself.
- The worker-loader, feature-flag rollback, and fallback sections below are retained only as historical design context.

## 1. 목적
- Zen 부팅 로더(Enso)의 프레임 드랍/끊김을 구조적으로 제거한다.
- 부팅 시 메인 스레드 병목(청크 로드, 파싱, 초기 마운트, 초기화 작업)과 로더 렌더링을 분리한다.
- 로더 체감 품질을 "빠름"이 아니라 "일관되고 부드러움"으로 보장한다.

## 2. 현재 문제 정의
- 현재 로더는 `SVG + framer-motion + React` 경로이며 메인 스레드 의존이다.
- 부팅 구간에서 아래 작업이 동일 스레드를 점유한다.
  - JS 청크 fetch/parse/eval
  - React 초기 렌더/commit
  - 스타일 계산/레이아웃/페인트
  - store initialize 호출
- 결과적으로 로더 stroke 애니메이션이 long task 구간에서 끊긴다.
- `localhost` 개발환경은 타 확장 content script 주입 영향 가능성이 있어 성능 노이즈가 커질 수 있다.

## 3. 목표 아키텍처 (권장안)
1. **BootShell 분리 (Stage 0)**
- React Dashboard 이전에 독립 부트 셸을 먼저 렌더한다.
- 구성: 초경량 HTML/CSS + minimal JS(상태 전환, handshake).
- BootShell 책임:
  - 초기 로더 캔버스 마운트
  - 부팅 단계 상태 표시
  - 앱 준비 완료 시 전환 제어

2. **Worker + OffscreenCanvas 로더 렌더링 (Stage 1)**
- Enso 렌더를 Worker로 이동한다.
- 메인 스레드는 상태 메시지 전달만 수행한다.
- Worker 책임:
  - 프레임 루프, stroke progression, easing
  - 복잡 질감 렌더(브러시, tail, grain)
  - reduced motion/저사양 fallback

3. **Background prewarm (Stage 2)**
- 부팅 전/유휴 구간에 핵심 데이터 준비를 백그라운드에서 선행한다.
- Dashboard 진입 시점에는 snapshot 읽기 중심으로 최소화한다.
- prewarm 대상(우선순위):
  - preference/protocol snapshot
  - 분석 캐시 메타데이터
  - 테마 런타임 최소 파라미터

4. **React handoff (Stage 3)**
- App chunk 로드/초기 렌더 완료 시 BootShell -> App cross-fade 전환.
- 전환 기준:
  - `appReady` 신호 수신
  - 최소 로더 표시시간 충족
  - fatal boot error 없음

5. **Boot Orchestrator 고도화 (Stage 4)**
- 기존 `bootManager`를 오케스트레이터로 확장:
  - phase contract 적용
  - timeout/fallback 정책
  - telemetry(phase duration, dropped frame 추정, long task count)
  - fail-open/fail-soft 규칙

## 4. 설계 원칙
- 로더 렌더 경로는 React lifecycle에 의존하지 않는다.
- 메인 스레드와 로더 렌더러 간 결합은 메시지 프로토콜로 제한한다.
- 성능 노이즈(`localhost`, 타 확장, devtools)를 계측 단계에서 분리 측정한다.
- 모든 단계는 롤백 가능한 feature flag로 배포한다.

## 5. 모듈 설계

### 5.1 BootShell 엔트리
- 신규 엔트리 후보:
  - `src/pages/dashboard.html`
  - `src/apps/dashboard/bootShell.js`
- 책임:
  - full-screen shell 렌더
  - OffscreenCanvas 지원 여부 체크
  - worker 부팅/정지
  - orchestrator 상태 구독

### 5.2 Loader Worker
- 신규 파일 후보:
  - `src/platform/workers/boot/ensoBootRenderer.worker.js`
  - `src/themes/components/loaders/zen/ensoRendererCore.js` (공유 수학/브러시 모델)
- 메시지 프로토콜 초안:
  - `INIT_CANVAS` `{ canvas, dpr, width, height, qualityMode }`
  - `BOOT_PHASE` `{ phase, progress }`
  - `REDUCE_MOTION` `{ enabled }`
  - `RESIZE` `{ width, height, dpr }`
  - `STOP` `{}`
  - `FRAME_STATS` `{ fps, frameDrops, renderMsP95 }` (worker -> main)

### 5.3 Boot Orchestrator 확장
- 위치:
  - `src/apps/dashboard/bootstrap/bootManager.js`
- 추가 책임:
  - UI phase와 data phase 분리
  - stage timeout (`critical`, `firstPaint`, `hydration`, `idle`)
  - recoverable/non-recoverable error 분류
  - shell handoff 시점 결정

### 5.4 Background prewarm 서비스
- 위치 후보:
  - `src/apps/background/services/boot/BootPrewarmService.js`
- 책임:
  - 주기/이벤트 기반 prewarm
  - snapshot 버전 관리
  - stale policy (TTL, invalidation)

## 6. 단계별 실행 계획

### Phase A. 계측 및 기준선 수립
- 작업:
  - 부팅 구간 long task, LCP 유사 지표, 로더 표시시간 기록
  - `localhost` vs `chrome-extension://` 성능 프로파일 분리 수집
- 산출물:
  - 기준선 리포트 (`docs/archive/evidence/performance/dashboard-boot-phase-a-baseline-report.md`)
- 완료 기준:
  - 재현 가능한 병목 구간과 원인 분류가 문서화됨

### Phase B. BootShell 도입
- 작업:
  - React 앱 이전 렌더 경로 분리
  - 기존 loader mount 경로를 shell 기준으로 전환
- 완료 기준:
  - App chunk load 여부와 무관하게 로더가 즉시 표시됨
  - 기존 기능 회귀 없음

### Phase C. OffscreenCanvas Worker 렌더 전환
- 작업:
  - Worker 렌더 파이프라인 구현
  - unsupported 환경 fallback(Canvas2D main thread 단순 모드)
- 완료 기준:
  - 병목 시점에서도 로더 프레임 드랍이 현저히 감소
  - fallback 경로 동작 확인

### Phase D. Background prewarm + snapshot handoff
- 작업:
  - prewarm service 구현
  - dashboard entry에서 warm snapshot 우선 적용
- 완료 기준:
  - 대시보드 진입 시 초기화 시간 분산
  - 메인 진입 long task 빈도 감소

### Phase E. 운영 안정화
- 작업:
  - telemetry 대시보드, 에러 코드 정리, 시나리오별 smoke 자동화
  - feature flag 점진 rollout
- 완료 기준:
  - 실패율/회귀율 임계치 만족

## 7. 테스트 계획

### 7.1 자동 테스트
- unit:
  - worker 메시지 프로토콜 validation
  - boot phase state machine transitions
- integration:
  - shell -> app handoff 시나리오
  - timeout/fallback 시나리오
- e2e:
  - cold start/warm start
  - tab 전환 직후 복귀
  - reduced motion on/off

### 7.2 수동 성능 검증
- Chrome Performance 프로파일:
  - long task 수
  - main thread blocking time
  - 로더 표시 구간 frame pacing
- 환경 매트릭스:
  - `localhost` (타 확장 ON/OFF)
  - `chrome-extension://` 페이지
  - 저사양/고사양 장치

## 8. 성공 기준 (SLO)
- 로더 구간 체감 프레임 안정성: 끊김 체감 최소화(주관 평가 + frame drop 계측 동시 충족)
- 부팅 phase 완료율: non-fatal 오류 시에도 fail-soft로 UI usable 유지
- 회귀 조건:
  - 탭 진입 기능 회귀 0
  - boot 관련 fatal error 0 (릴리즈 후보 기준)

## 9. 리스크 및 대응
- OffscreenCanvas 미지원/제약:
  - 대응: Canvas2D 단순 fallback + 품질 단계화
- Worker 초기화 실패:
  - 대응: shell fallback 애니메이션 즉시 전환
- prewarm 데이터 stale:
  - 대응: snapshot 버전/TTL 검증, mismatch 시 cold init
- 타 확장 간섭(개발환경):
  - 대응: 독립 프로필 성능 기준선 병행 운영

## 10. 롤백 전략
- feature flag:
  - `boot.shell.enabled`
  - `boot.loader.worker.enabled`
  - `boot.prewarm.enabled`
- 단계별 롤백:
  - Worker 문제 시 shell 유지 + 단순 로더 fallback
  - shell 문제 시 기존 React loader 경로로 즉시 복귀

## 10.1 Timeout 의도 분리 규칙
- `BOOT_CORE_TIMEOUT_MS`:
  - 목적: boot orchestrator(core gate)가 기대 budget을 넘긴 시점을 진단 이벤트로 고정
  - 의미: 데이터/초기화 게이트의 대기 budget 경계이며, 단순 시간 초과만으로 `failed`/`ready`를 판정하지 않는다.
- `BOOT_SHELL_HARD_TIMEOUT_MS`:
  - 목적: UI 가림막이 남아 사용자 조작을 막는 상황을 최종 fail-open으로 해제
  - 의미: 사용자 상호작용 보장 경계(가시성/사용성 안전장치)
- 조정 규칙:
  - `BOOT_SHELL_HARD_TIMEOUT_MS`는 반드시 `BOOT_CORE_TIMEOUT_MS`보다 커야 한다.
  - prewarm/critical warmup timeout은 `BOOT_CORE_TIMEOUT_MS`를 넘지 않는다.
  - 정책 상수 소유자는 `src/apps/dashboard/bootstrap/bootConfig.js` 단일 경계로 유지한다.

## 11. 구현 순서 (권장)
1. 계측/기준선
2. BootShell 분리
3. Worker 렌더(OffscreenCanvas)
4. prewarm + snapshot handoff
5. 운영 안정화/점진 배포

## 12. 비범위(이번 변경에서 제외)
- Zen 로더 아트 디테일 미세조정(브러시 미학 자체 튜닝)
- 전체 탭 렌더링 구조 재작성
- 테마 엔진 공통 API 재설계
