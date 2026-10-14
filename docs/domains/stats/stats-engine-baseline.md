# Stats Engine Baseline

- Status: Active
- Owner: stats domain
- Last validated against code: 2026-08-09
- Path policy: current-only
- Canonical for: stats domain baseline and persistence/runtime responsibilities

이 문서는 Entropy 통계엔진의 기준선(역할, 책임, 구조, 운영 정책)과 리팩터링 실행 계획을 기준선으로 정리한다.

## 해석 가이드 (유연 모드)

- 이 문서의 `필수/강제/고정/금지` 표현은 운영 기본 가드레일 의미다.
- 실험 단계에서는 근거/범위/복귀 계획을 문서화하면 예외를 둘 수 있다.
- 컷오버 직전에는 예외를 재정리해 baseline 계약으로 수렴한다.

## 1) 제품 기준선

### 1.1 앱의 역할

- 이 앱은 강제 차단 도구가 아니라, 사용자의 의도 회복을 돕는 디지털 마찰 엔진이다.
- 통계는 처벌/감시가 아니라 자기조절을 위한 피드백 인터페이스다.

### 1.2 사용자에게 제공할 것 (출시 범위)

- 오늘/주간 사용 패턴(총량, 시간대, 차단 대상 비중)
- 목표 대비 진행률(일일 캡, 사이트 목표 대비)
- 변화 추세(전일/전주 대비 증가/감소)
- 집중 세션/정책 적용 결과의 해석 가능한 지표

### 1.3 추후 제공할 것 (보류, 확장 슬롯만 확보)

- behavior engine 연동 기반 적응형 조정
- 자동 패턴 탐지/자동 케어
- 개인화 자동 최적화/추천

주의: 위 3개는 본 문서 기준 v1 출시 범위에서 제외한다.

## 2) 설계 원칙 (가이드)

1. 단일 책임: 수집, 집계, 저장, 조회, 출력은 모듈로 분리한다.
2. 단일 작성자: Background만 원본 통계를 쓴다. UI는 읽기 전용이다.
3. 블랙박스 경계: 레이어 간에는 계약 DTO만 주고받고 내부 상태를 공유하지 않는다.
4. 최소 브로드캐스트: 기본은 Zustand pull, 이벤트 push는 필요한 신호만 허용한다.
5. 메모리 최소 상주: hot data만 메모리에 두고 히스토리는 IndexedDB에서 조회한다.
6. 계산 순수성: 핵심 계산은 side-effect 없는 순수 함수로 유지한다.
7. 예측 가능성: 갱신 주기와 산출 지표를 문서화된 정책으로 유지한다.
8. 확장 가능성: 분류 정책(차단/관리/허용/그 외)이 늘어나도 enum/registry 추가만으로 확장 가능해야 한다.

### 2.1 Facts / Lens / Read Model

- Facts:
  - 저장되는 canonical usage 사실
  - 정책 비의존 수치만 source of truth로 둔다
- Lens:
  - 현재 정책으로 facts를 해석하는 순수 projection 계층
  - 기본 의미는 `policyBasis: current`
- Read Model:
  - 홈/사이트/규칙/추세 화면이 직접 소비하는 목적별 DTO

규칙:

- current-policy projection은 category totals를 `domains` facts에서 재계산한다
- stored `byCategory`는 current-policy canonical facts가 아니다
- dashboard는 raw facts를 직접 해석하는 계산 owner가 아니다
- day/week/month query는 `basis: calendar | activity`, `grain: hour | day | week | month`, `resetHour`를 명시하는 temporal protocol을 따른다
- `basis: activity`는 저장된 calendar hour buckets를 사용자 리셋 시간 기준 activity-day lens로 재배열한다
- dashboard-facing read model은 top-level totals/siteDetails가 어떤 projection에서 왔는지 명명된 `basis`/`readModel` metadata를 함께 노출한다
- 기본 facts query는 runtime memory를 overlay하지 않는다. 실시간 overlay가 필요하면 별도 Active spec과 query endpoint를 추가해야 하며, 현재 baseline에는 포함하지 않는다
- background read model의 최소 공개 경로는 `getAnalysisBootstrapSnapshot()`, `getCycleProjection()`, `getStatusSnapshot()`, `getSitesSnapshot()`, `getTrendSummary()`, `getDomainSeries()`이다
- dashboard hot path는 raw range message action을 직접 호출하지 않는다
- top-level `src/domains/stats/query/**` helper seam은 retired 상태이며 다시 도입하지 않는다

## 3) 파이프라인 블랙박스 구조

### Site Furin 회고용 구간 (2026-09-14)

기존 foreground sealer가 수집 허용된 보호사이트에 대해서만
`recordActiveIntervals`를 전달한다. Aggregator는 같은 active watermark로
중복을 제거한 뒤 기존 hourly row 안에 optional `activeUsageIntervals`를
함께 기록한다. 별도 observer, raw input 수집, 저장소, 비동기 writer는 없다.
시간당 도메인별 최대 32구간이며 초과 시 실제 최근 구간만 남긴다.
오래된/잘린 기록은 partial 또는 unavailable로 표시한다. 총량에서 사용
간격을 추측하지 않는다. Activity-day query가 동일 reset hour로 projection을
만들어 protection snapshot과 Site Furin 메시지에 전달한다. 현재 세션의
확정 구간까지 포함하지만 마지막 미확정 시간을 wall clock으로 채우지 않는다.
구간 수는 방문 횟수나 집중력 파편화 점수가 아니다.

### 3.1 단계

1. Collection: 이벤트를 수집하고 정규화된 레코드로 변환
2. Aggregation: 레코드를 일 단위 통계 버킷으로 누적
3. Runtime Cache: today 중심 hot cache/dirty/version 관리
4. Persistence: IndexedDB flush, 보존기간 정리, 복구
5. Facts Query: 기간 조회/정규화/합성
6. Policy Lens Projection: 현재 정책 기준 projection
7. Presenter Adapter / Read Model: Dashboard DTO 변환 및 store 반영

### 3.2 단계별 책임

- Collection은 "무엇이 발생했는지"만 다룬다.
- Aggregation은 "숫자 누적 규칙"만 다룬다.
- Persistence는 "내구성 보장"만 다룬다.
- Facts Query는 IndexedDB-backed repository facts 조회와 짧은 TTL 캐시만 다루며, runtime memory projection을 화면 facts에 overlay하지 않는다.
- Policy Lens Projection은 "현재 정책 해석"만 다룬다.
- Presenter Adapter / Read Model은 "UI 친화 모델"만 다룬다.

### 3.3 인사이트 엔진 파이프라인

확장 가능한 분석은 read model 안에서 즉흥적으로 분기하지 않고 아래 고정 파이프라인을 따른다.

1. Facts: canonical stats facts와 current-policy projection
2. Features: 화면/패턴이 재사용할 feature vector 추출
3. Patterns: detector registry 기반 패턴 판정
4. Synthesis: 다중 패턴을 정렬/억제해 primary insight 생성
5. Snapshot Adapter: status/rules read model에 최소 공개 DTO로 연결

가드레일:

- 새 분석 아이디어는 가능하면 `pattern detector` 추가로 끝나야 한다.
- UI는 raw facts나 detector 내부 규칙을 직접 알지 않는다.
- `statsAnalysisQueryService`는 engine owner가 아니라 query orchestrator다. 목적별 DTO 조립은 Status/Sites/Cycle read-model builder가 소유한다.
- `insightsMode`는 계산 깊이 gate로만 쓰고, canonical facts 구조를 바꾸지 않는다.
- `dataCollectionMode`는 canonical domain usage facts 생성 범위의 SSOT다. protected-only에서는 보호 소유 데이터(`blockedUrls`, `siteGoals`, `protectionPresetAssignments`)가 있는 도메인만 기록하고, all-sites-minimal에서만 unmanaged 도메인 시간 facts를 만든다.
- `insightsConsent`는 수집 범위를 대신하는 두 번째 SSOT가 아니라 그 범위에 대한 명시적 사용자 admission이다. `unset`과 `later`는 mode 값과 무관하게 domain usage와 precision 수집을 모두 막는다. `protected_only`는 `protected_sites`만, `all_sites`는 현재 `dataCollectionMode`가 허용한 범위까지 admission한다. mode/consent 불일치는 더 넓은 범위를 추정하지 않고 fail-closed한다.
- `precisionInsightsMode`는 보호 사이트의 CLSE/navigation 계열 정밀 신호 gate다. 클릭/드래그/입력 원시 패턴은 수집하지 않는다. 이 값은 domain usage facts 생성 여부를 대체하지 않고, behavior/CLSE 수집 경로에서만 해석한다.
- public runtime의 content-flow build capability는 CLSE Labs와 분리되어 있다. 보호 사이트의 precision policy가 허용할 때만 exact V1 `scroll_spike` / `short_media_attention` aggregate가 durable facts로 기록되며, raw scroll/click/input/context payload는 통계 경계에 들어오지 않는다. `scroll_spike`는 content document에서 10초 윈도의 bounded count batch로 합쳐 큰 hourly row의 rewrite 빈도를 제한하고, `short_media_attention`도 여러 video의 `watchMs`를 1초 동안 합쳐 정확한 시청 시간을 하나의 안정된 attention observation으로 만든다. 두 source 모두 one-in-flight 전송만 허용하며 sender 대기를 2초로 제한한다. short-media의 1초 window clock은 이전 ACK가 지연되어도 계속 독립적으로 batch를 닫고, active window의 source report는 10,000개, 완료 queue는 8개로 제한한다. 포화 시 초과 report 또는 새로 닫힌 window만 명시적인 dropped watch-time 진단과 함께 폐기해 window를 무기한 늘리거나 메모리를 키우지 않는다. short-media batch는 같은 날짜 안에서는 마지막으로 승인된 source `observedAt`을 보존하고, 자정을 지나 flush된 경우에만 실제 flush 시각으로 rebasing한다. scroll의 열린 batch는 숫자형 local-hour 경계를 캐시하므로 각 wheel spike마다 `Date`/문자열 hour key를 다시 만들지 않는다. 같은 날짜 안에서는 관측 hour를 보존하고, 자정을 지나 flush된 batch는 exact count를 유지한 채 실제 flush 날짜/hour에 귀속한다. 이는 stale 과거 날짜 쓰기를 피하는 current-day admission이며 historical correction/backfill이 아니다. build capability 또는 admission이 꺼진 상태에서는 counter/timer를 시작하지 않고, admission 철회 시 아직 전송하지 않은 active/completed aggregate를 폐기하며 saturation diagnostic도 다음 admission epoch에서 새로 시작한다. visibility-hidden/page-exit은 short-media partial window를 닫고 best-effort drain만 시작하며 unload durability를 보장하지 않는다. background의 policy 판정은 queue admission의 선형화 지점이다. 그 뒤 이미 시작된 non-idempotent durable write는 철회 시 강제 취소하거나 재시도하지 않으며, 설정 broadcast는 source gate를 즉시 닫아 새 작업과 미전송 aggregate를 차단한다. Aggregate signal background per-tab FIFO는 depth 8, active tab 128이며 queue 대기를 포함한 enqueue-to-response lease를 1.5초로 제한한다. 이 deadline은 sender의 2초 delivery timeout 안에 500ms 응답 여유를 남긴다. 실행 중 timeout은 원래 task가 실제로 끝날 때까지 해당 tab을 poison 처리해 중복 writer를 만들지 않는다. Feed snapshot도 같은 bounded keyed-commit primitive의 별도 per-tab FIFO를 사용하며 captured/trusted hostname 검증, trusted URL lookup, normalize/prepare/durable stats/baseline commit과 ACK까지만 depth 8, active tab 128, 1.5초 background/2초 sender lease 안에 둔다. Feed revision은 서로 다른 durable delta를 가질 수 있으므로 snapshot coalescing은 하지 않는다. Protection refresh는 commit ACK 밖의 derived per-tab lane이다. 탭당 running 1개와 latest pending 1개, active tab 128만 유지하며 1.5초 timeout 이후에도 원 작업이 끝나기 전에는 겹친 refresh를 시작하지 않는다. 실행 직전 `tabsGet` URL의 hostname을 committed source와 다시 대조하고 lookup 실패/URL 부재/navigation mismatch는 named diagnostic과 함께 skip한다. 따라서 refresh 실패·지연·용량 초과는 이미 성공한 durable commit ACK를 실패로 바꾸거나 old-host projection을 새 문서로 보내지 않는다.
- stats domain row의 `collection` metadata는 fact가 어떤 collection/precision policy 아래에서 생성되었는지 남기는 진단 보조값이며, 별도 source of truth가 아니다.

### 3.4 Collection Consent / Permission / Usage Ownership

통계 수집은 "브라우저가 기술적으로 볼 수 있음"이 아니라 "사용자가 이 사이트의 usage fact 생성을 허용했음"을 기준으로 한다.

- `insightsConsent=unset|later`에서는 보호 등록 여부나 기본 `dataCollectionMode`와 관계없이 새 domain usage/precision fact를 만들지 않는다. 사이트 보호 동작 자체는 이 local-analysis consent와 독립적으로 계속 동작할 수 있다.
- collection admission이 active domain session 중 철회되면 해당 session cursor를 abandon하고 session fact를 쓰지 않는다. 이미 `pending_commit`인 restart intent도 현재 policy를 다시 통과해야 하며, 거부되면 stats replay 전에 named policy-rejection discard로 제거한다.
- `protected_sites`는 제품 의미상 registered-sites 수집 모드다. `blockedUrls`, `siteGoals`, `protectionPresetAssignments` 중 하나로 사용자가 명시 등록한 도메인만 usage fact를 만든다.
- `all_sites_minimal`은 별도 opt-in 수집 모드다. 이 모드에서만 미등록 도메인의 최소 usage fact를 만들 수 있다.
- `protected_only` consent는 all-sites mode를 승인하지 않는다. `all_sites` consent 아래에서 사용자가 현재 mode를 protected-only로 좁힌 경우에는 좁은 mode가 우선한다.
- optional host permission은 content script/protection 실행 능력이며, domain usage fact 생성을 단독으로 허용하지 않는다.
- 현재 탭 URL을 순간적으로 읽어 "수집 대상인가"를 판정하는 것은 routing/gating 관측이다. 미등록 사이트에 대해 도메인별 elapsed를 계산하거나 저장 직전에 버리는 방식은 usage fact 수집으로 간주하며 기본 경로에서 금지한다.
- active usage fact의 public owner는 foreground usage ledger이고 실제 단일 write owner는 내부 `trackingForegroundSegmentSealer`다. 이벤트/heartbeat/batch/idle/rollover는 ledger에 segment open/seal 요청만 보내며, sealer 밖에서 active elapsed를 계산해 `statsCollector.recordDomainElapsed({ isActive: true })`를 호출하지 않는다.
- background batch는 active 시간을 보정하지 않는다. 등록 또는 all-sites policy로 허용된 비전경 탭의 background/pressure fact만 쓴다.
- intervention exposure/outcome과 domain hourly intervention fact는 같은 current collection admission을 통과한 후에만 각 owner에 기록한다. admission이 없으면 두 저장 경로 모두가 no-op이며, effect ledger를 consent 밖의 두 번째 usage source로 만들지 않는다. outcome은 같은 `exposureId`의 기존 canonical exposure가 없으면 fail-loud하며 payload context로 `shown`을 합성하지 않는다; exposure-first 동시 호출만 exposure-id queue로 순서를 보존한다.

## 4) 메모리 vs IndexedDB 경계

### 4.1 메모리 (Hot)

- 요청 범위 안에서만 사용하는 `today` StatsDay projection
- 활성 탭 segment와 exact domain-session cursor(`active | pending_commit`)
- dirty 플래그와 버전 카운터(미저장 작업 목록)
- 짧은 TTL 읽기 캐시(대시보드 응답 가속)

원칙: 기본 상주는 `today`(+필요 시 `yesterday`)까지만 허용한다. 화면/분석 facts의 source of truth는 메모리가 아니라 IndexedDB `stats_hourly`/`stats_daily`다.

### 4.2 Runtime Recovery + IndexedDB (Warm/Cold)

- `chrome.storage.session`
  - 활성 탭과 navigation continuity처럼 서비스워커 재시작에 필요한 in-flight checkpoint
  - `runtime.domain_session`은 host별 dwell cache가 아니라 단 하나의 exact intent다. active는 `{ phase, sessionId, hostname, startedAt }`, 종료 중에는 `{ phase, sessionId, hostname, startedAt, endedAt, durationMs, targetDateStr }` pending commit을 보존한다.
  - pending intent는 stats durable commit 성공 전에는 제거하지 않으며, restart replay도 같은 `sessionId`와 날짜/시간을 사용한다. 단, 현재 canonical collection policy가 해당 hostname을 더 이상 admit하지 않으면 stats write 전에 explicit policy-rejection discard로 제거한다. `unset`/`later` pending을 과거 mode 값만 보고 replay하지 않는다.
  - 통계 fact cursor나 canonical source가 아니며, 없어져도 화면 통계는 IndexedDB facts path에서 조회되어야 한다
  - presence-aware read 뒤 exact current validator를 통과해야 하며, full-snapshot write는 owner-local lane에서 직렬화한다
- IndexedDB
  - `stats_hourly`: durable 시간 버킷 fact ledger. 물리 row는 local date/hour 하나이며, domain별 수치는 `domainsDelta`, exact domain-pair 전환 사실은 `transitionEdgesDelta` map에 담는다. 열린 현재 시간은 `status: open`, 닫힌 시간은 `status: sealed`. 각 domain delta는 background 진행점 `committedThroughAt`, foreground 커밋 진행점 `activeCommittedThroughAt`, `collection` checkpoint를 명시적으로 갖는다. `sessionsDelta`는 exact `{ count, totalMs, lastCommit }`이고 session 종료 hour만 `{ sessionId, endedAt }` cursor를 가진다.
  - `stats_daily`: 과거 날짜 materialized summary/read index. 과거 날짜 read path의 필수 입력이며, 삭제/부재 시 normal query가 `stats_hourly`를 대신 읽어 historical day를 만들지 않는다
  - `stats_feature_pack_daily`: exact V1 snapshot/store shape 호환을 위해 남겨 둔 dormant derived store. runtime repository에는 upsert/point-read/range-read API가 없고 lifecycle prune/clear와 exact snapshot import/export만 남긴다. canonical fact source가 아니며 보존 기간은 source stats horizon을 넘지 않는다.
  - `intervention_exposures`: 짧은 보존의 gate exposure/outcome 원장. `exposureId`로 노출과 결과를 연결한다.
  - `intervention_effect_daily`: 장기 보존의 domain/artifact/level 일별 효과 집계. 아티팩트 효용 검증은 이 aggregate에서 시작한다.
  - `usage_logs`: 원시 로그/진단 로그 (필요 시만)

원칙: session checkpoint는 복구/진단 보조 상태이고, dashboard/projection facts는 durable hourly bucket을 기준으로 한다. "오늘"은 저장소 종류가 아니라 activity-day lens이며 기본 window는 04:00부터 현재까지다. 보존기간은 90일 기본 정리(job) 기준.

DB/read-cache contract:

- `stats_hourly` is the durable current-day fact ledger. `stats_daily` is the required historical read index after rollover. Dashboard snapshots, rules snapshots, and runtime facts range caches are downstream accelerators only.
- `sealed`는 clock-closed 상태이지 current runtime day의 절대 불변 marker가 아니다. late session/elapsed처럼 owner가 명시적으로 dirty로 표시한 이전 hour는 같은 primary key에 완전한 bucket으로 교체한다. historical finalize가 완료된 날짜만 normal runtime에서 불변이며, diagnostic replay를 두 번째 persistence truth로 만들지 않는다.
- Category switch, per-domain switch marginals, and exact domain-pair transition facts are one stats mutation and one hourly commit. Persistence retry overwrites the same bucket; a separate additive transition store, auxiliary retry ledger, or pre-query global top-K source is forbidden.
- Every stats service-worker lifetime owns one non-persisted 128-bit `runtimeEpoch`, created exactly once by the runtime-state owner through browser `crypto.getRandomValues`. A missing crypto owner or malformed/injected epoch fails explicitly; timestamp/counter/random fallback is forbidden. Runtime reset preserves the epoch, while a new worker lifetime creates a new one.
- Every successful durable hourly write must invalidate facts range reads and bump the stats runtime revision. Every durable facts read model carries both its runtime epoch and numeric revision, and smaller ranges derived from a cached superset preserve both fields exactly.
- Facts read caches may be reused only when the cache covers the requested span/window and its epoch/revision identity matches the current stats runtime. A larger fresh range may serve a smaller range by slicing dates; an identity mismatch is a cache miss or explicit invalidation error, never an empty-range fallback.
- `statsFactsQueryService.getStatsFactsRange` owns one immediate fresh read after its privately branded `STATS_FACTS_QUERY_REVISION_CHANGED` invalidation. It reacquires the same canonical repository/cache under the current revision, including shared in-flight queries; no stale result is returned or cached. The bounded recovery emits `STATS_FACTS_QUERY_REVISION_RETRY` at debug severity and ends when that second attempt settles. A second invalidation, repository rejection, invalid payload, or an external error with the same code remains terminal. There is no timer, write replay, alternate source, or retry by the browser listener.
- release V1 hourly row는 `committedThroughAt`, 명시적인 `activeCommittedThroughAt`, `bucketUtcOffsetMinutes`를 정확히 포함해야 한다. 누락 값을 timestamp에서 추론하거나 이전 row shape를 변환하지 않는다.
- 정상 hourly write/read와 V1 backup import의 최종 검증은 같은 canonical row 계약을 사용한다. `dateStr`는 실제 local calendar date여야 하며 `dateStr`/`hour`/`bucketStartTs`/east-positive `bucketUtcOffsetMinutes`는 현재 OS timezone과 독립적인 단일 identity다. offset은 정수 `[-840, 840]` 범위여야 한다. `domainsDelta` key는 lowercase hostname/IP key만 허용하며 URL/path, delimiter, 공백, `__proto__`/`constructor`/`prototype` 예약 key는 거부한다. daily import는 current V1 `dayData`가 없는 date-only row를 빈 날로 승격하지 않는다. `replace` backup import는 단 하나의 rejected row라도 있으면 event-log flush나 Chrome Storage/IndexedDB 변경 전에 전체를 거부한다.
- Sites snapshot caches must be downstream of the facts range object identity plus policy/activity-day cache key. They must not keep a stale projection alive after facts cache invalidation.
- Repository facts range는 query boundary에서 한 번만 deep-normalize한다. 같은 query의 Cycle/Status/Rules builder는 직렬화 shape을 변경하지 않는 opaque capability token으로 같은 normalized graph identity를 공유하며, standalone builder는 자신의 입력 경계에서 여전히 strict normalization을 수행한다.
- Raw storage inspector/ledger diagnostics are audit evidence, not product read models for dashboard UI.
- Feature-pack store는 dormant V1 compatibility surface이며 fallback read path가 아니다. Store/repository의 runtime upsert/point-read/range-read seam은 구조 가드로 금지한다. lifecycle clear의 성공 기준은 object-store request success가 아니라 readwrite transaction completion이며, transaction error/abort는 named failure로 노출한다. 미래에 model input으로 다시 활성화하려면 별도의 named writer/consumer, source-revision 규칙, source horizon 내 backfill, docs/CI를 같은 변경에서 추가한다.

Read-model direction contract:

- `statsAnalysisQueryService` is orchestration only: read durable facts, read cycle/settings context, then call purpose-specific read-model builders.
- Status, Sites, and Cycle read models must not import or fallback to each other. Shared math/domain-intel helpers must live below them in common query/projection helpers. Status-specific visible-domain and habit-feedback derivation lives in its own status helper instead of the top-level status DTO assembler.
- Standalone status and rules queries may use cycle context internally, but transport only `statusSnapshot` or `sitesSnapshot`; only the cycle query owns standalone `cycleState`/`cycleSnapshot` refreshes.
- Status carries one activity-day projection under `currentActivityDay`. Retired `today` and `rhythmDay` aliases must not duplicate the same domain/hour payload across the runtime message boundary; UI adapters may expose view-specific names that point to the canonical object.
- Status recent comparison is owned only by `rollingPressureModel`. Each domain carries an exact `recentTrajectory` DTO over previous completed activity days (`role=recent_trajectory`, `grain=day`, `excludeCurrent=true`); `statsStatusSnapshotReadModel`, domain-candidate projection, Home, and AI narration must consume it instead of slicing stored date keys or recomputing an average. Missing source coverage and an observed zero are distinct evidence states.
- `sitesSnapshot.globalExposureAverage` is built by `sitesGlobalExposureAverageReadModel.js` for `SitesHud`: `{ averageMs: number | null, observedDayCount, windowDayCount: 7, windowStartDateStr, windowEndDateStr, resetHour }`. The date fields label the first and last of seven **completed activity days**, each beginning at the configured reset hour and ending at that hour the next day; the unfinished activity day is excluded. Query admission requests at least nine calendar dates to cover the entire window even before today's reset. Calendar-day `globalExposureSeries` remains unchanged for its existing consumers.
- The average uses the same `buildSitesProtectedExposureDetails` charged-time projection as the current cap, including current managed roots and protected category semantics. Observation requires in-window collection evidence or recorded activity/visits from the canonical activity-window projection, independently of protected charge. An empty calendar-day container alone is not timed observation evidence. Observed protected zero remains numeric `0`; missing days do not enter the denominator; no observations yields `averageMs: null`. The DTO validates its seven-day date span and integer reset hour. This is read-only adjustment context, not a personal baseline, score reference, normative goal, or policy write input.
- Dashboard controllers consume their own background DTO (`statusSnapshot`, `sitesSnapshot`, `cycleSnapshot`) and must not repair missing fields by reading a sibling DTO.
- `statusSnapshot`은 `src/domains/stats/contracts/statsStatusSnapshotContract.js`의
  JSON-canonical DTO 계약을 producer와 transport boundary가 공유한다. plain object,
  dense array, JSON-stable finite number, string, boolean, explicit `null`만 허용하며 `undefined`,
  non-finite number, cycle, class instance를 path가 포함된 named error로 거부한다.
  `buildStatusSnapshot`은 empty/final DTO를 publish하기 전에 이 계약을 assert하고,
  Dashboard response contract는 message admission에서 한 번 더 검증한다. 이미 검증된
  response를 Zustand state patch가 다시 deep-walk하지 않으며, prewarm direct entry는
  full BootPrewarm envelope boundary가 검증을 소유한다. Insight
  `featureSummary.trendRole`은 `recent_trajectory | null`이고 missing role을
  `undefined`로 materialize하지 않는다. JSON stringify sanitize, field omission 복구,
  frontend defaulting을 canonicalization으로 사용하지 않는다.
- Sites의 목록 DTO와 선택 상세 DTO는 분리한다. `sitesSnapshot.siteRegistry`는 모든 행의 경량 `usage.observedMs`와 `protectionBudget.chargedMs`를 제공하고, `GET_SITES_SITE_DETAIL`만 선택한 canonical managed domain의 30일 baseline, transition/intervention evidence, site-pull profile, `recurringTimeEvidence`를 계산한다. snapshot과 detail은 facts runtime epoch/revision, policy fingerprint, insights mode, cycle/activity-day 경계를 합친 versioned `siteDetailRevision`을 공유한다. epoch은 같은 숫자 revision이 다른 service-worker lifetime에서 재사용되어도 detail cache identity가 충돌하지 않게 한다. dashboard는 이 semantic revision이 없는 snapshot으로 detail을 요청하지 않으며, `computedAtEpochMs`를 캐시 identity로 사용하지 않는다. Background detail이 요청보다 최신 revision으로 계산되면 frontend는 response revision key만 예열하고 old snapshot caller에는 typed mismatch를 반환한다. 현재 store가 여전히 그 old revision을 소유할 때만 snapshot을 stale로 표시해 즉시 refresh하며, 갱신 뒤 예열된 detail을 재사용한다. 서로 다른 revision의 snapshot/detail은 한 화면 상태로 commit하지 않는다. 반복 시간대 DTO는 현재 부분일을 제외한 정확한 30개 calendar-day projection만 읽고, 자격을 충족하지 못하면 named unavailable status를 낸다. 이 상세 projection은 raw range normalization 전에 canonical root와 실제 하위 hostname만 남기며, DTO의 `projectionScope.projectedDomainCount`로 적용 범위를 드러낸다. 서로 다른 domain 상세가 같은 calendar evidence range를 동시에 요구하면 range read만 shared in-flight로 합치고, domain projection과 detail cache key는 계속 분리한다.
- 등록된 managed root는 자신과 모든 하위 hostname을 하나의 사용자-facing domain group으로 집계한다. 가장 긴 suffix match가 owner이며 usage, visits, sessions, behavior, weekly/baseline series, transition edges, intervention effects가 모두 같은 root로 합쳐져야 한다. 단, 양 끝점이 모두 같은 managed root 안에 있는 transition edge는 외부 이탈/복귀 근거가 아니므로 제외한다. unmanaged hostname만 exact host 단위를 유지한다.
- 선택 FULL 상세의 행동 time/session/behavior/intervention/navigation 및 baseline current 값은 현재 달력일을 사용한다. transition/intervention evidence도 같은 현재 날짜를 사용하며 `calendar-date-set` basis와 실제 `dateStrs`를 명시한다. 활동일 목표 사용은 별도 `goalContext`로 전달하고 행동 비교에 섞지 않는다.
- Selected FULL detail also publishes `longTermPatterns` through `statsSiteLongTermPatterns.js` and the public `siteLongTermPatternContract.js`. It reuses exactly the same 30 completed calendar-day baseline projections, excluding today. Repetition requires several qualifying dates; pooled counters or one current-day spike cannot establish it. The required additive `observations` bundle has its own `sites-site-observation-axes-v1` contract: simultaneous way/rhythm/change facts, with coexisting short/long repetition, the qualified recurring window and exact first/last 15-date comparisons. Each comparison half needs at least seven observed dates; recorded zeros are included, missing dates excluded, and zero reference means have no ratio. Public day rows preserve measured sessionTotalMs/maxSessionMs independently of activeMs; no session duration is reconstructed from active usage. Hourly session counters belong to ending hours, preserve measured source totals, and never become individual session intervals. Missing, observed zero, insufficient history and unclassified are distinct. Registry seven-completed-activity-day average and current activity-day usage remain independent. No storage or collector change is introduced.
- Bootstrap may transport multiple DTOs in one response for load efficiency, but it must not create a new combined source of truth.

Temporal query protocol:

- `statsActivityDayUsageQueryService` owns the compact usage range consumed by
  protection daily budgets, the filter indicator, and popup usage. Its sources
  are the canonical facts query and effective cycle reset policy. Its disposable
  cache keys include fact graph identity, policy, start date, reset hour and span.
  Current usage and the completed-day protection trajectory use the same
  `activity-day` basis. Calendar storage rollover is not a user-budget reset.
- Charged daily usage is active time in that activity day across popup, filter
  indicator, daily budgets and Sentinel. Background time remains a separate
  pressure metric. Sentinel episode keys and terminal release decisions carry
  the same canonical activity date as the evaluated usage.
- The compact range carries `basis`, `resetHour`, activity start `dateStr`, and
  bounded domain active/background and total usage. It is never persisted or
  passed into a facts store. Queries read one extra calendar day for the boundary.
  Missing collection evidence is not an observed zero-use day.
- Default start hour is 04:00 local time. User-selected integer hours take effect
  at the next currently effective boundary. Recommendations need at least seven
  completed days with activity, excluding today's partial record and empty days,
  without fixed night-time weights. They require a reliable differing candidate,
  no pending change and an expired seven-day decision cooldown. Only explicit
  acceptance schedules a change. Unconfirmed legacy `adaptive` pending changes
  are cancelled once at the policy boundary; accepted changes remain valid.

- `basis: calendar`: 저장 calendar date/hour 그대로 day/week/month를 묶는다.
- `basis: activity`: `resetHour` 기준으로 `YYYY-MM-DD resetHour:00`부터 다음날 `resetHour - 1`시까지를 하나의 activity day로 묶는다.
- 명시적 trend range의 날짜는 실제 calendar date여야 하고 순서가 보존되어야 하며 최대 90일을 넘을 수 없다. 위반은 facts read 전에 coded failure로 드러나며 swap/clamp/empty fallback으로 숨기지 않는다.
- `resetHour`가 생략된 activity query는 cycle reset policy의 `effectiveResetHour`를 사용한다.
- `resetHour: 0`은 자정 리셋이며 calendar day와 동일한 00~23시 window가 된다.
- 저장된 facts는 재작성하지 않는다. 리셋 시간 변경은 read/projection lens 변경으로 과거 hourly facts를 재해석한다.
- 보호/예외 같은 사이트 규칙 membership은 raw usage fact를 재작성하지 않는다. `siteRuleTimeline`이 있는 도메인은 read-time projection에서 hour-boundary 기준으로만 category/exposure에 반영한다.
- 신규 보호 등록은 등록 시각이 포함된 hour 전체를 소급 청구하지 않는다. 현재 hourly fact 모델에서는 다음 hour bucket부터 protected exposure로 계산하며, 등록 이전 사용량은 raw site usage/관찰 근거로만 남는다.
- Sliding-window read models use an explicit ordered period series. Callers pass projected periods, not calendar date strings that each model reinterprets with local overlap rules.
- Read-model cache keys must include basis, grain/window kind, resetHour, timezone, requested range, facts runtime epoch/revision, read-model schema version, and policy fingerprint when policy categories affect projection.
- A reset-hour change is a derived read-model invalidation/cache miss. It may regenerate affected status/sites/rolling-pressure projections and unspent typed semantic snapshots, but it never rewrites raw hourly facts.
- Dashboard components consume projected DTOs with basis/range metadata. They must not receive resetHour as permission to select their own stats window or repair missing read-model fields from sibling DTOs.

## 5) 갱신/저장 주기 계약

1. 수집: 이벤트 발생 즉시
2. 요청 범위 projection 갱신: 수집 직후 즉시
3. DB 저장: 같은 수집 batch 안에서 dirty closed hour `sealed` bucket과, 실제로 현재 시간이 dirty일 때만 그 시간의 `open` bucket을 materialize해서 upsert한다. closed-hour correction이나 clean force drain은 unchanged open row를 다시 쓰지 않는다. 이미 모든 closed hour가 반영된 clean force는 projection/health lane에도 들어가지 않으며, 비어 있는 closed hour의 watermark만 전진한 경우에도 facts cache invalidation, revision 증가, commit event를 발생시키지 않는다.
4. 자정 롤오버: 이전 일자 active ledger와 기존 domain session을 먼저 settle하고 durable finalize한 뒤, 새 일자를 load하고 새 foreground/session cursor를 prime
   - MV3 cold start는 오늘을 바로 load하기 전에 보존 범위의 hourly/daily commit marker와 active/pending domain-session checkpoint 날짜를 대조한다. 이 discovery는 `stats_hourly.dateStr`의 `nextunique` key cursor, `stats_daily` primary-key range, 기존 `stats_daily.finalizedAt` index의 key-only cursor를 한 readonly transaction에서 교차 확인하며, finalized 정상 날짜의 큰 fact payload를 clone/normalize하지 않는다. finalized cursor는 canonical date primary key와 primitive finite-number index key를 둘 다 검증하고, daily primary key에 정확한 finalized marker가 없으면 손상으로 즉시 실패한다. 검증된 두 날짜 집합의 차집합인 실제 orphan 날짜만 기존 strict `getHourlyBuckets` 경계로 full row를 읽는다. 복구할 checkpoint 날짜는 runtime day로 설치해 정상 rollover settlement를 거친다. 나머지 orphan hourly day는 이미 strict read를 통과한 durable bucket을 다시 day→hour로 전개하지 않는다. `finalizeRecoveredHistoricalDayFacts`가 같은 transaction 안에서 저장 행이 discovery 결과와 동일한지 확인하고, 기존 `sealed` 행은 쓰지 않은 채 필요한 `open → sealed` 메타데이터 행과 누락된 `stats_daily`만 기록한다. 당일 `pending_commit`은 stats cache 설치 직후 canonical settings를 hydrate해 현재 consent/scope를 통과한 경우에만 settings/foreground prime 전에 replay한다.
5. 대시보드 조회: 진입 시 full pull + 활성 상태 경량 갱신
6. reset: 모든 named cache/IndexedDB/session owner의 완료를 await하고, 부분 실패를 명시적으로 보고하며, 같은 reset을 안전하게 재실행할 수 있게 유지

저장 원칙:
- `statsHourlyProjectionCommitter`가 projection을 canonical `stats_hourly` row로 변환한다.
- `StatsAggregateStore.upsertHourlyFactBuckets`는 current-day durable hourly ledger writer다. historical close는 `finalizeHistoricalDayFacts`가 `stats_hourly`와 `stats_daily`를 같은 IndexedDB transaction에서 원자적으로 확정하며, 단독 daily writer는 공개하지 않는다.
- 일반 historical close와 cold-start orphan repair는 별도 named seam이다. 전자는 runtime day를 sealed hourly row로 materialize하지만, 후자의 `readHistoricalMaterializationDateIndex`는 hourly unique date, daily primary key, daily finalized-index marker의 payload-free discovery만 소유한다. 실제 orphan payload는 날짜별로 직렬 조회하며 `finalizeRecoveredHistoricalDayFacts`는 discovery에서 넘긴 canonical hourly row를 transaction 안에서 재검증한다. 이미 sealed인 row는 재기록하지 않는다. 따라서 정상 cold start가 전체 보존 범위의 full payload를 읽거나, 다수의 IndexedDB payload transaction을 동시에 fan-out하거나, repair가 전체 날짜의 domain map을 다시 스캔하고 24개 시간 row를 무조건 덮어쓰는 경로가 되어서는 안 된다.
- historical close는 hourly+daily fact transaction 하나만 commit marker로 확정한다. dormant feature-pack store는 rollover hot path에서 쓰지 않는다.
- current-hour hot update는 dirty domain/transition key만 다시 materialize하고 cache-owned map을 그대로 재사용한다. Materializer가 만든 canonical hourly bucket은 out-of-band registry marker로 저장 경계까지 전달되어 같은 전체 domain checkpoint를 다시 순회하지 않는다. Marker는 top-level key/reference snapshot과 재사용 `domainsDelta`/`transitionEdgesDelta` map revision을 보유한다. 저장소는 DB handle을 확보한 뒤 marker를 한 번만 consume하며, 더 새 materialization이 같은 map을 재사용했거나 top-level reference가 바뀐 marker는 거부한다. Map 내부의 raw mutation은 의도적으로 다시 순회하지 않으므로 registrar의 materializer-only CI ownership과 serialized stats save lane이 그 불변식을 책임진다. marker가 없는 외부/snapshot/recovery row는 read 경계와 동일한 exact 15-key/nested-payload V1 계약을 통과해야 하며 문자열 timestamp/hour/count, 음수 값, 누락된 schema, 추가 legacy field를 보정하지 않고 거부한다. 여러 hourly row의 동기 `put`/structured-clone 중 하나라도 throw하면 transaction을 즉시 abort해 앞선 staged write도 남기지 않는다. Monolithic hourly row의 IndexedDB structured clone은 남으므로 scroll/short-media source batching으로 write 빈도도 함께 제한한다.
- runtime day는 repository 경계에서 한 번 준비하고, 이후 commit은 dirty hour의 변경된 domain/transition-edge key만 재물질화한다. scope가 없는 기존 caller는 full-scan으로 승격하여 정확성을 보존하고, top-level totals/session/category는 매 commit에 재계산한다.
- stats mutation handler는 완료 전에 durable commit을 await한다.
- runtime date owner는 단조 증가한다. 동시 load/rollover 요청은 진행 중 작업을 await한 뒤 요청 날짜를 다시 판정하고, 더 최신 날짜 요청은 이어서 catch up한다. 이미 finalize된 과거 timestamp 요청은 새 날짜 cache에 기록하지 않고 `STATS_LOAD_TARGET_BEFORE_RUNTIME_DATE`로 실패한다.
- session duration은 `[start, end)` 구간이다. 시간별 session count/max/short/long은 마지막으로 점유한 시각에 귀속하므로 자정에 끝난 세션은 이전 날 23시 bucket에 기록한다.
- tracking/stats의 epoch는 background가 읽는 실제 runtime wall clock만 사용한다. theme preview나 dashboard 외형 시간은 stats timestamp source가 될 수 없고, 전역 `Date` 교체 또는 settings를 통한 clock override는 금지한다.
- browser handler 전체를 FIFO로 묶지 않는다. tick, idle, suspend, tab/window/navigation의 stats 및 foreground mutation만 `runStatsMutationBatch`가 직렬화하고, 각 mutation은 queue 실행 시점에 owner가 제공한 실제 timestamp를 사용한다. 일반 tick의 idle refresh·탭 inventory·창 focus 조회는 lane 밖의 `prepareTabActivityObservation`에서 끝내고 `settleTabActivityObservation`이 single-use receipt, browser/settings revision, foreground revision, idle, 날짜를 진입 시와 첫 mutation 직전에 다시 검증한다. pre-mutation supersession만 lane 밖에서 1회 새 조회를 허용한다. 관찰 시각은 fact 정산 시각으로 덮어쓰지 않는다. scope/session 조회와 durable settlement는 lane 안에 남는다. Historical rollover도 `prepareRolloverTabActivityObservation`으로 FIFO 밖에서 inventory를 준비하고, 이전 날짜/정확한 자정 경계에 묶인 receipt와 scope를 확인한 뒤 foreground·domain session을 닫는다. 무효화된 pre-mutation 관찰만 1회 재획득하며 부분 정산/저장 실패는 재실행하지 않는다. 기존 calendar barrier와 historical finalize → 새 날짜 load → prime 순서는 유지한다. Rollover는 idle의 event-owned cached state를 읽어 idle callback → 같은 calendar barrier의 재진입 교착을 피한다. 상세 계약은 storage/stats/tracking boundary map을 따른다.
- pending domain-session replay conflict(`STATS_SESSION_COMMIT_OUT_OF_ORDER` 포함)는 bootstrap을 실패시키고 exact pending checkpoint를 진단/idempotent retry를 위해 그대로 유지한다. retired clock settings는 migration marker가 아니며 stats intent를 폐기할 권한도 없다.
- session count/total의 exactly-once owner는 day `sessions.lastCommit { sessionId, endedAt }`이다. 같은 intent replay는 day/domain count를 다시 올리지 않지만 hourly projection durable commit은 다시 await한다. 같은 ID의 다른 종료시각, 또는 더 오래된 새 ID는 coded conflict/out-of-order failure다.
- reset은 독립된 IndexedDB와 `chrome.storage` transaction을 가로지르는 단일 원자 연산이 아니다. `runStatsReset` barrier가 기존 load/mutation/save를 배수하고 새 수집을 막은 동안 named store를 비운 뒤 runtime을 다시 열며, 한 backend에서 함께 묶을 수 있는 per-store group은 원자적으로 처리한다. 전체 coordinator는 idempotent/rerunnable해야 한다.
- debounce/주기 flush/suspend flush는 보조 안전장치이며 canonical save boundary가 아니다.
- stats runtime-health는 canonical fact가 아닌 진단 projection이다. 모든 `record*`는 동기 RAM 접수이며 force/failure도 저장 ACK가 아니다. 기존 owner가 진행 중 write 1개와 최신 RAM만 유지하고, 정상 alarm/tick/save/seal은 5초 throttle와 단일 trailing timer로 합친다. force/failure/중요 incident는 다음 즉시 write를 요청한다. 저장 완료는 해당 revision과 mirror metadata만 갱신하며 더 최신 RAM을 덮어쓰지 않는다. 초기 read 중 기록은 고정 크기 field overlay와 counter delta로 한 번 합치고, read 실패 시 unavailable/error를 유지하며 읽지 못한 원장을 덮어쓰지 않는다. 저장 실패는 dirty/error와 시도별 로그를 남기며 자체 재시도 loop를 만들지 않는다. 명시적 `init`은 초기 복원·저장 barrier로 유지된다. reset/import는 stats producer drain → health admission close·drain → 삭제 순서다. producer drain 실패 시 삭제를 막고 terminal retry의 진단 consumer를 유지하며, health drain 실패 시 admission을 닫은 채 재시도한다. worker 종료로 미저장 진단은 유실될 수 있지만 facts/checkpoint의 durable ACK는 그대로다. RAM/저장 revision·pending·hydration 상태는 runtime read DTO의 `persistence`에서 구분한다. 상세 계약은 storage/stats/tracking boundary map을 따른다.
- 대시보드 range cache TTL: 10~15초
- Facts range read cache TTL: 10~15초. TTL만으로는 fresh 판정이 불충분하며, runtime epoch/revision identity가 다르면 TTL 안에서도 반드시 다시 읽어야 한다.
- Rules registry snapshot은 facts range cache와 별개로 짧은 TTL 메모리 캐시를 둘 수 있다. 캐시 키는 최소한 requested `daysBack`, dashboard policy fingerprint, `insightsMode`, cycle start/reset hour/activity-day window, 그리고 동일 facts range object identity를 포함한다. 이 경량 경로는 transition/intervention evidence를 읽지 않는다.
- Rules registry site intel은 `analysis_index_selected_full_detail` 전략을 쓴다. 모든 domain은 경량 registry entry로 제공하되 overview의 7일/current-activity-day `analysis` tier는 `analysisLimit` 안에서 managed-first, observed-usage 순으로 제한한다. `siteIntelBuildState`는 registry/analysis/deferred count를 각각 명시하고 `fullDetailCount`는 `0`이다. 선택 상세만 동일 facts range identity와 policy/activity-day key를 쓰는 bounded LRU를 사용하며, 동일 detail key의 진행 중 query는 한 promise로 합친다. 여러 domain이 요구하는 동일 intervention-effect calendar range는 별도의 bounded 5초 cache/in-flight lane에서 한 번만 읽고, 실패는 cache하지 않는다. TTL `0`은 각 완료 결과 캐시를 비활성화한다.
- `siteRegistry.entries[].usage.observedMs`는 현재 activity day의 실제 관찰량이고, `protectionBudget.chargedMs`는 `siteRuleTimeline`의 hour-boundary 이후 보호 적용량이다. 목표 잔여/초과는 charged 값으로 판단하며 등록 전 관찰량을 소급 청구하지 않는다.

### Sites unified registry: completed-window recorded average (2026-09-14)

- Owner: `sitesCompletedActivityDays.js` builds seven completed activity-day
  projections, excludes the current day, and records the reset-hour and actual
  start/end activity dates. The snapshot query reads at least nine calendar days
  so both edges of seven completed reset-hour days are available.
- `siteRegistry.averageWindow` contains basis
  `completed-activity-days-recorded`, common `observedDayCount`, `windowDayCount: 7`,
  `windowStartDateStr`, `windowEndDateStr` and `resetHour`.
- The common denominator includes a day if any projected domain has explicit
  collection observation, positive total time, or a visit. It does not depend on
  the selected policy filter or the days each individual site was used.
- `usageAverage.totalMs` sums recorded active time for that domain/root;
  `averageMs` divides it by the common denominator. `observedDayCount` counts
  distinct dates with that site's evidence. Status is `recorded` only at seven
  observed site-days, otherwise `partial`. With no site evidence, total/average
  are null and status is `collecting`. An explicitly observed zero remains zero.
- Current facts do not certify per-domain continuous permission/tracking
  coverage. Partial averages are recorded normalized amounts, not inferred
  absence on missing site-days. Presentation exposes that limitation and never
  imputes time or substitutes current-day use.
- The registry includes historical-only observed hostnames, preserves longest
  managed-root grouping and tracking exclusions, and remains a cheap projection.
  Current-day usage/protected-charge fields and bounded analysis-tier scheduling
  remain distinct. No recommendation or collection engine changes follow.
- The existing global protected-charge average reuses the same completed-day
  projections while retaining its existing DTO and charge semantics. Standalone
  current-day registry/detail builders do not query an average window themselves.

인사이트 recompute 권장 수치:
- light recompute: `stats_committed`, 규칙 변경, dashboard/rules 진입 시
- heavy recompute: 5분 주기 또는 idle 구간
- baseline refresh: rollover 이후 daily/weekly 기준선 재계산 시

### 5.1 Active heartbeat classification incident (2026-06-09)

증상:

- 보호 효과/아티팩트는 적용되는데 main/rules 통계가 0으로 남았다.
- `oneMinuteTick` alarm은 존재했고 tick 로그도 돌았다.
- `dataCollectionMode=protected_sites`에서 보호 사이트 사용시간이 올라오지 않았고, `all_sites_minimal`에서도 전체 사이트 사용시간이 올라오지 않았다.

원인:

- `trackAllTabsBatch()`는 `focusedWindowId`가 없으면 `tab.active=true`인 탭도 background로 분류했다.
- Chrome/MV3 서비스워커 재개, DevTools/대시보드 포커스 이동, window focus 이벤트 누락 구간에서는 `tabs.query({})` 결과에 `tab.active=true`가 있어도 focused window id가 `null`일 수 있다.
- 이 상태에서 active elapsed가 한 번도 `active` fact로 들어가지 않아 durable hourly facts와 sites/main projection도 0으로 보였다.
- 이전 전경 시간을 정산할 때 `lastActiveTabId`를 Chrome `tabs.get()`으로 다시 읽어 URL을 복구하려 했다. 그러나 포커스/탭 전환 이후에는 그 tab id가 이미 inactive, internal focus, closed, stale URL 상태일 수 있어 "그 기간 동안 전경이었던 segment"의 source가 될 수 없다.
- `startedAt: null`을 숫자로 강제 변환하면 `0`으로 해석되어 닫힌 전경 segment가 다시 열린 것처럼 보일 수 있다. 통계 경계에서 `null`은 0ms가 아니라 "시작되지 않음"이다.

수정 계약:

- `focusedWindowId`가 유효하면 기존 계약을 유지한다: `tab.active && tab.windowId === focusedWindowId`인 탭만 active다.
- heartbeat batch는 Chrome의 `tabs.query({ active: true, lastFocusedWindow: true })` 결과를 우선 active source로 사용한다.
- 이 source가 trackable tab이면 해당 tab id만 active로 인정하고, extension/dashboard/internal page가 focused이면 외부 사이트는 active로 보정하지 않는다.
- focused-active source가 없고 `focusedWindowId`도 없거나 `WINDOW_ID_NONE`이면 `resolveFocusUnavailableActiveTabId()`가 단 하나의 명확한 후보만 active로 인정한다.
- 후보 우선순위는 started runtime `activeTabInfo.tabId`, `lastActiveTabId`, 단일 trackable active tab 순서다.
- 후보가 없거나 여러 active tab이 모호하면 active로 추정하지 않는다.
- 이 경로는 runtime memory를 dashboard facts source로 쓰는 overlay가 아니며, durable hourly facts에 들어가기 전 collection classification만 보정한다.
- 전경에서 이미 지난 시간은 runtime의 `activeTabInfo { tabId, hostname, startedAt }` segment로 먼저 active elapsed에 닫힌다. focus가 dashboard/internal page로 이동한 뒤의 외부 사이트 시간만 background/pressure 계열로 들어간다.
- 전경 segment를 여는 source도 명시한다. 탭 활성화, 창 포커스, 전경 네비게이션처럼 Chrome 이벤트가 전경 탭을 직접 관측한 호출은 `foregroundObserved`로 `startedAt`을 연다. heartbeat batch는 `idleStateNow === 'active'` 또는 audible일 때만 같은 계약을 사용한다. 서비스워커 부트스트랩은 idle detector를 force-read해서 active일 때만 전경으로 prime한다.
- heartbeat batch가 전경 탭을 처음 관측했을 때는 그 시각부터 segment를 연다. domain `lastTrackedTime`이나 background batch 상태로 과거 active 시간을 역산하지 않는다.
- active elapsed의 durable idempotency는 domain `activeCommittedThroughAt`이 소유한다. IndexedDB hourly commit 뒤 `chrome.storage.session`의 `activeTab.startedAt` 갱신 전에 worker가 종료되어도 재시작 seal은 이 cursor 이후 구간만 적용한다. 전체 domain session은 별도의 exact active/pending intent와 stats `lastCommit`이 소유하며 host별 dwell 누적 mirror를 두지 않는다. 보호 runtime의 현재 경과 시간은 active cursor `startedAt`에서 파생한다. `lastTrackedTime`은 background 진행점으로 남고 active 중복 방지에 사용하지 않는다.
- `settlePreviousTab()`은 Chrome tab id 재조회로 시간을 복구하지 않는다. 저장된 foreground segment를 닫고, segment missing/tab mismatch/not-started/policy-rejected 같은 상태는 `lastPreviousTabSettlement` 진단으로 노출한다.
- heartbeat batch는 현재 focus 기준으로 외부 사이트를 background 처리하기 전에 열린 foreground segment가 다른 tab으로 바뀌었는지 확인하고, 바뀌었다면 먼저 active로 닫는다.
- 같은 탭 안에서 도메인이 바뀌는 navigation도 새 URL로 `activeTabInfo`를 덮기 전에 기존 foreground segment를 닫는다.
- 서비스워커 bootstrap/resume은 새 focused tab 관측값으로 `activeTabInfo`를 덮기 전에 열린 foreground segment를 reconcile한다. 같은 tab id/hostname이 실제 focused foreground로 확인되면 닫고, 확인되지 않으면 active elapsed를 추정하지 않으며 `foreground_segment_resume_ambiguous` 진단으로 드러낸 뒤 열린 시작점을 지운다.
- 서비스워커 suspend는 best-effort로 열린 foreground segment를 먼저 닫고 force-save한다. MV3 suspend는 비동기 완료를 보장하지 않으므로 이 경계는 최종 보증이 아니라 손실 창을 줄이는 seal 지점이며, heartbeat와 foreground event settlement가 여전히 기본 durability 경계다.
- `startedAt`이 `null`/`undefined`이면 정산하지 않고 `foreground_segment_not_started`로 드러낸다. 이 값을 `0`으로 강제하지 않는다.

검증 계약:

- `tests/tabTimeTrackerBackgroundPressure.test.js`는 focused-active browser source가 all-tabs snapshot의 stale active flag를 보정하는지, dashboard/internal page focus 중에는 외부 사이트를 active로 세지 않는지, 같은 도메인의 inactive tab이 먼저 처리되어 active elapsed를 지우지 않는지를 함께 검증한다.
- `tests/trackingTabActivityBatchDiagnostics.test.js`는 focus-unavailable 후보 선택이 명확한 경우에만 active id를 반환하는지 검증한다.
- `tests/tabActivityCollector.test.js`는 `resolveTabActivityState()`의 active/background 분류 계약을 고정한다.
- `tests/tabTimeTrackerBackgroundPressure.test.js`는 Chrome tab snapshot 재조회 없이 stored foreground segment를 닫는지, segment가 없을 때 tab-id 복구를 하지 않고 diagnostic으로 남기는지도 검증한다.

### 5.2 Hourly read-bound normalization incident (2026-06-11)

증상:

- 실험실 raw hourly ledger에는 `stats_hourly` usage row가 존재했다.
- 같은 row 안의 `domainsDelta.youtube.com.active`, `domainsDelta.chzzk.naver.com.active` 값도 실제로 증가했다.
- 그러나 `getStatusSnapshot()`, `getSitesSnapshot()`, `getTrendSummary()`, `getDomainSeries()`로 이어지는 facts/read model은 `todayActiveMs=0`, `siteDetails={}`, `available=false`로 보였다.
- 팝업 사이트 스냅샷도 `hasTodayStats=false`, `todayMs=0`, `trackedTodayMs=0`처럼 표시되어 "수집이 안 됨"처럼 보였다.
- 수집/저장 헬스는 pass였고, runtime heartbeat와 durable hourly commit도 정상으로 보였기 때문에 collection, permission, popup projection, dashboard cache를 번갈아 의심하게 만들었다.

진짜 원인:

- `normalizeStatsHour(value)`가 `Number(value)`로 먼저 값을 숫자화했다.
- JavaScript에서 `Number(null) === 0`이므로, 생략된 hour bound인 `null`이 "hour 0"으로 정규화되었다.
- `getStatsHourlyBuckets({ dateStr })`는 호출자가 `startHour`/`endHour`를 넘기지 않는 정상 조회다.
- 그러나 내부에서 `startHour=null`, `endHour=null`이 각각 `0`으로 변환되면서, 이 조회가 사실상 `dateStr` 전체 조회가 아니라 `dateStr + hour 0` 조회가 되었다.
- 그 결과 raw `stats_hourly`에는 20시/22시 usage row가 있어도 repository-normalized facts read path는 0시 row만 통과시켰다.
- 0시 row가 없거나 0시 row에 usage가 없으면 read model은 완전히 빈 facts처럼 보였다.

왜 "잠깐 된 것"처럼 보일 수 있었는가:

- 이 버그는 모든 데이터를 버린 것이 아니라, 생략된 hour bound를 `0..0`으로 오해한 것이다.
- 따라서 사용량이 우연히 0시 bucket에 들어간 날이나, 검증 데이터가 0시 row 중심이었던 순간에는 read model이 정상처럼 보일 수 있다.
- 반대로 대부분의 실제 사용 시간인 낮/저녁 bucket은 raw ledger에 저장되어도 repository read에서 탈락한다.
- 그래서 "예전에는 됐던 것 같은데", "어떤 순간에는 보였던 것 같은데", "지금은 계속 0이다"라는 현상이 동시에 성립한다.

도입 경로:

- 2026-05-11 `d2098ff1a` (`refactor: split indexeddb manager internals`)에서 `dbStatsNormalizers.js`가 분리되며 `normalizeStatsHour(value)`가 도입되었다.
- 이 함수는 row 안의 실제 `hour` 값을 검증하는 목적에는 대부분 맞았지만, optional query bound의 `null`/`undefined`를 처리하는 계약까지 함께 맡기에는 부적절했다.
- 2026-06-02 `cd479203` (`Persist current stats buckets durably`)에서 현재 hourly ledger를 durable `stats_hourly` read path로 읽는 흐름이 강화되었다.
- 이때 `getStatsHourlyBuckets({ dateStr, startHour = null, endHour = null })`가 optional bound를 같은 normalizer로 정규화하면서, 누락된 bound가 0시 필터로 바뀌는 문제가 facts query path에 본격적으로 연결되었다.

왜 늦게 잡혔는가:

- raw storage inspector는 `stats_hourly.getAll()` 또는 ledger 요약을 직접 보았기 때문에 "저장은 됨"까지만 증명했다.
- dashboard/read model은 repository-normalized facts range를 소비했기 때문에 "저장된 row가 query에서 살아남는가"를 별도로 보지 않으면 원인이 보이지 않았다.
- 기존 query/service 테스트는 `aggregateStore.getHourlyBuckets()`를 mock으로 대체해 DB manager의 hour-bound normalization을 지나가지 않았다.
- projection 테스트는 이미 들어온 hourly bucket을 current-policy lens로 잘 바꾸는지만 검증했기 때문에 projection 계층은 정상으로 보였다.
- `startHour=0`, `endHour=23` 같은 명시적 범위 테스트는 통과한다. 실패 조건은 `dateStr`만 주고 hour bound를 생략하는 정상 호출이었다.
- runtime diagnostics가 facts query 전에 찍힌 cache 상태를 보여주던 구간에서는 `lastRead`가 비어 보여서 storage read boundary를 특정하기 어려웠다.

수정 계약:

- optional query bound에서 `null`, `undefined`, 빈 문자열은 "0시"가 아니라 "bound 없음"이다.
- `normalizeStatsHour(null)`과 `normalizeStatsHour(undefined)`는 반드시 `null`을 반환해야 한다.
- row 자체의 `hour` 검증과 query bound의 생략 상태는 같은 함수로 처리할 수 있지만, `Number()`의 암묵 변환이 결계를 넘지 못하게 해야 한다.
- facts/read model은 raw ledger fallback을 하지 않는다. canonical path는 계속 `stats_hourly` -> repository normalized rows -> facts range -> policy lens/read model이다.
- 실험실 진단은 raw hourly ledger와 repository-normalized facts read 결과를 나란히 보여야 한다. raw ledger에만 usage가 있고 repository read rows가 0이면 storage read boundary가 원인이다.
- diagnostics는 facts query 이후 runtime cache/read diagnostics를 다시 읽어야 한다. query 이전 snapshot만 보면 방금 수행한 read의 `lastRead`를 볼 수 없다.

회귀 방지 검증:

- `tests/dbStatsNormalizers.test.js`는 생략된 hour bounds가 midnight-only filter로 바뀌지 않는지 고정한다.
- `tests/statsTrendQueryService.test.js`는 mock store라도 실제 `filterStatsHourlyBucketRowsForRead()`를 지나가게 해서 storage read filtering 계약을 함께 검증한다.
- 같은 테스트는 20시 YouTube, 22시 Chzzk open-hourly row와 `visits: 0` 형태가 trend/domain read model로 투영되는지 검증한다.
- `StatsPipelineDiagnosticsLab`는 raw ledger, repository read rows, facts cache/read model을 분리해서 보여야 한다. 이 세 값이 갈라질 때 어느 경계가 끊겼는지 바로 보여주는 것이 목적이다.

검증된 명령:

- `npm run test:file -- tests/dbStatsNormalizers.test.js tests/statsTrendQueryService.test.js tests/statsFactsQueryService.test.js tests/statsRepositoryReadPath.test.js tests/statsRuntimeServiceRuntimePath.test.js tests/statsFactsRepositoryReadUtils.test.js tests/trackingServiceBootstrap.test.js`
- `node scripts/ci/check-stats-read-model-architecture.mjs`
- `git diff --check`
- `npm run build:quick`

교훈:

- "저장됨"과 "canonical read model에 투영됨"은 다른 증거다.
- raw DB ledger는 감사 증거이고, product stats의 source는 repository-normalized facts read path다.
- `Number()` 같은 일반 변환은 storage/runtime boundary에서 너무 관대하다. 결측값은 명시적으로 결측으로 남겨야 한다.
- 이번 문제는 collection/popup/dashboard 권한 문제가 아니라, durable row를 읽는 storage filter의 의미 오염이었다.

## 6) 브로드캐스트와 Zustand 정책

1. 기본 경로는 Zustand pull (`refreshAnalysisSnapshot`, `refreshCycleProjection`, `refreshStatusSnapshot`, `refreshSitesSnapshot`)이다.
2. 크로스 컨텍스트 push는 다음 이벤트만 허용한다.
3. `stats_committed`
4. `stats_rollover`
5. `stats_reset`

push payload는 전체 통계가 아니라 `changedDates[]`, `version`, `reason`만 전송한다.

Rules가 활성인 동안 `stats_committed`로 stale 표시된 동일 정책 snapshot은 최근 완료 시각 기준 60초 admission window 안에서 trailing refresh 하나로 합친다. 정책 fingerprint가 바뀌었거나 semantic `siteDetailRevision`이 아직 없는 cold snapshot은 즉시 읽는다. Detail response revision mismatch는 현재 snapshot이 정확히 요청 revision과 같을 때만 이 시간 창을 건너뛰는 immediate refresh로 admission한다. 이미 다른 snapshot이 앞서간 경우에는 stale 상태를 되돌려 쓰지 않는다. 이 wall-clock window는 요청 admission에만 쓰이며 snapshot/detail cache identity는 아니다.

## 7) 계산 엔진 구조와 배치

### 7.1 계산 계층

- `domains/stats/background`: 수집, 집계, runtime cache, persistence, query owner
- `apps/background/services/runtime`: background wiring과 cross-domain orchestration
- `apps/dashboard/stores`: 표시용 selector/adapter와 Zustand 연동
- `platform/workers`: stats facts read path의 owner가 아니다. background facts query는 repository-normalized `stats_hourly`/`stats_daily` range를 직접 사용한다.

주의:

- retired `TrackingAnalyticsCoordinator.js` path는 final stats owner가 아니며 다시 만들지 않는다.
- rollover settle/prime은 `statsTickRuntimeService`가, content-flow aggregate는
  `behaviorTelemetryRecorder`와 durable stats owner가 맡는다. 소비자 없는 today
  tick buffer, tick-metrics backup, last-tracked session checkpoint는 재도입하지 않는다.

### 7.2 계산 항목 (v1 출시 핵심)

- 일별 총량: active/background, category별 합계
- 시간대 분포: 24시간 버킷
- 세션/전환: session count, dwell, switches
- 백그라운드 압력: `backgroundMediaMs`, `backgroundLingerMs`, `staleTabMs`
  - `background`는 뒤에 열린 총 시간을 유지한다.
  - media/linger/stale은 active 사용시간에 합산하지 않는 behavior fact다.
- 목표 지표: cap 대비 퍼센트, 초과량, 전일/전주 변화
- 점수 원장: 사용자 설정 기준 기반 감점/회복/중립 관찰 항목
- 요약 DTO: main/sites/tools 탭 공통 소비 모델

점수 원장 기준은 `docs/domains/stats/score-ledger-architecture.md`를 따른다.

### 7.3 공개 이후 별도 결정이 필요한 확장 후보

- 자동 패턴 클러스터링
- 위험도/회복탄력성 지표
- 개인화 추천 점수

## 8) 분류 정책 확장 규약

현재 분류는 `blocked | managed | allowed | other`를 기본 계약으로 둔다.

확장 규칙:
1. 새 분류 추가 시 `src/domains/stats/contracts/statsContracts.js`의 `STATS_CATEGORY_IDS` 계약에 정의
2. Aggregation 매핑 규칙 추가
3. Query projection 맵 추가
4. UI adapter label 추가

기존 수집/저장 파이프라인은 수정 없이 동작해야 한다.

## 9) 목표 파일/폴더 구조

```text
src/
  domains/stats/facts/
    domainUsageSummary.js
  domains/stats/shared/
    dateMath.js
  domains/stats/contracts/
    statsContracts.js
    statsEvents.js
    interventionEffectContracts.js
  domains/stats/background/
    contracts/
      statsEventBridge.js
      statsEventPolicy.js
      statsReadModelContracts.js
    collection/
      statsCollector.js
      behaviorTelemetryRecorder.js
      tabActivityCollector.js
    aggregation/
      statsAggregateScaffold.js
      statsAggregator.js
    runtime/
      statsRuntimeCache.js
      statsRuntimeHealthLedger.js
      statsRuntimeService.js
      statsTickRuntimeService.js
    persistence/
      statsBucketMaterializer.js
      statsHourlyProjectionCommitter.js
      statsRepository.js
      statsRetentionJob.js
      statsRuntimePersistenceService.js
    query/
      statsFactsRepositoryReadUtils.js
      statsFactsQueryService.js
      statsAnalysisQueryService.js
      statsAnalysisQueryShared.js
      statsStatusSnapshotReadModel.js
      statsStatusVisibleDomainReadModel.js
      statsSitesSnapshotReadModel.js
      statsSiteIntelReadModel.js
      statsSiteRecurringTimeEvidence.js
      statsSiteLongTermPatterns.js
      statsSiteIntelMetricStats.js
      statsSiteTransitionEdges.js
      statsTrendQueryService.js
  domains/stats/analysis/
    scoringEngine.js
    cycleScoring.js
    policySnapshot.js
  domains/stats/insights/
    contracts/
      siteInsightContracts.js
    features/
      buildSiteFeatureVector.js
    patterns/
      evaluateSitePatterns.js
    synthesis/
      synthesizeSiteInsight.js
    buildSiteInsightModel.js
  apps/background/services/runtime/
    BackgroundAppKernel.js
    BackgroundBootstrapCoordinator.js
    BackgroundMessageRouter.js
  apps/dashboard/stores/
    useAnalysisStore.js
```

주의: Zustand 구조는 유지한다. Store API는 안정적으로 유지하고, 내부 구현만 교체한다.
retired `TrackingAnalyticsCoordinator.js` path는 복구하지 않는다. stats runtime owner는 `domains/stats/background/**` 아래만 허용한다.

## 10) 현재 유지 가드

### Sites current recording admission (2026-09-14)

`dataCollectionPolicy.js` owns `resolveUsageRecordingScope`,
`resolveDomainUsageRecording`, `resolveTimeCapAvailability` and
`resolveSitesRecordingPolicy`. Usage collection, Sites queries and protection
time-budget admission consume those same decisions. Canonical protected
collection membership includes blocked roots, exact site-goal registrations
and `protectionPresetAssignments.sitePresetIds`; the global preset does not
register a domain. Consent is independent of registration. No setting, timer,
history writer or hidden time accumulator is introduced.

The dashboard policy fingerprint now includes `insightsConsent`, `insightsMode`
and canonical preset assignments as well as collection mode, exclusions and
site rules. Sites query `policyInput` is a current-policy precondition against
the SettingsService snapshot, never a simulation override. A mismatch fails
with `STATS_SITES_POLICY_CHANGED` and the current fingerprint.

`statsRecordingScope.js` resolves admitted projection domains once per facts
range. Projection keeps the original facts immutable. An explicit empty
domain filter means no domains and cannot read unfiltered hourly rollups.
`statsActivityDayUsageQueryService` uses the same current admission and full
policy cache identity, so retained history cannot continue driving a revoked
time cap. Current registered-but-unrecorded Sites rows remain editable policy
rows; historical-only domains outside current admission are omitted.

`sitesSnapshot.recording` carries configured mode, effective scope
(`all_sites`, `protected_sites`, `off`), reason, global-cap availability and
the count of protected registrations touched by exclusions (including child
exclusions). Each registry row carries `recording` and `capAvailability`.
Disabled use is `null`, `usageAverage.status=disabled`, and protected budgets
retain the saved goal with `state=inactive`; disabled is neither zero nor
collecting. Off-state global averages keep their real activity-day window but
have no mean or observed count. The existing seven completed activity-day
mean, shared observed-day denominator, observed-zero/missing distinction and
no-backfill contract remain unchanged for admitted records.

Selected detail is discriminated by `mode=analysis|policy_only`. Policy-only
detail has a valid registry entry, recording/cap decisions and `intel=null`.
The non-background `stats/shared/sitesDomainScope.js` owns selection identity
for both controller navigation and detail building: admitted children resolve
to their most specific managed root, while denied requested hostnames remain
exact so a recording exclusion cannot turn into a parent Intel/action target.
The detail query reads settings first and, for denied collection, validates
the requested revision's policy before returning without facts, cycle or
intervention evidence IO. Present malformed DTOs fail shared
`sitesRecordingContracts.js` / `sitesSiteDetailContracts.js` validation. Policy
changes preserve historical storage and saved goals; data deletion remains a
separate explicit owner command.

- `check:stats:projection-architecture`: retired stats query/projection paths and dashboard cross-owner imports stay deleted.
- `check:stats:read-model-architecture`: Stats query orchestration, Status read model, Rules read model, site-intel helpers, and dashboard controllers stay one-way.
- `tests/statsFactsQueryService.test.js`: DB-backed facts reads remain revision-bound, reacquire one invalidated read, and surface repeated invalidation or repository failure instead of returning stale or empty fallback facts.
- `tests/statsAnalysisQueryService.test.js`: `statsAnalysisQueryService` stays orchestration/cache focused.
- `tests/statsStatusSnapshotReadModel.test.js`, `tests/statsStatusVisibleDomainReadModel.test.js`, and `tests/statsSitesSnapshotReadModel.test.js`: purpose-specific DTO behavior lives with the purpose-specific builders.
- `tests/statsRuntimeServiceRuntimePath.test.js`: runtime collection and facts query integration remain covered at the service boundary.

### Site Intel analysis basis and input authority

FULL selected detail uses `todayBasis: calendar-day` and
`todayHorizon: calendar_today`. Its current sample and completed 30-day
personal baseline no longer overlap across a user reset boundary. The weekly
series retains its current-inclusive seven calendar slots. Lightweight registry
and ANALYSIS projections keep their existing activity-day meaning; they do not
supply a FULL personal-baseline comparison.

The selected-site query reuses the same normalized, scoped 31-day range to build
seven completed activity-day policy projections through
`sitesCompletedActivityDays.js`. `goalContext` carries protected charged use
for the current activity day and completed observed/active/over-limit counts.
No additional repository read, timer, persistent cache, or storage key is added.
The existing snapshot cycle key includes the current calendar date as well as
activity reset/cycle identity, so midnight and reset-hour changes invalidate the
appropriate in-memory detail. In-flight deduplication and bounded cache owners
remain unchanged.

Analysis facts and diagnostic profile are v2. Source admission, observation
state, one-way dependencies and terminal interpretation are owned by the
[Site Pull boundary](../../architecture/repository/site-pull-pattern-boundary-map.md).
The view model validates `todayTotal` against `todayHourly`; activity-day
`totalMs` and historical `habitHourly` cannot repair a missing current source.
