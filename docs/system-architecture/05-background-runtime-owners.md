# 05. Background Runtime Owners

- Status: Active
- Owner: background app
- Last validated against code: 2026-08-12
- Path policy: current-only
- Canonical for: background runtime owner map

- Companion docs:
  - `docs/architecture/runtime/content-runtime-target-architecture.md`
  - `docs/architecture/repository/background-runtime-boundary-map.md`

## Purpose

background runtime에 남아 있는 마지막 large owner를 최종 구조 기준으로 다시 고정한다.
핵심은 `파일을 더 잘게 나누는 것`이 아니라 `누가 어떤 상태와 use case를 canonical로 소유하는가`를 확정하는 것이다.

## Independent Execution Scope

### Protection-ready startup and log admission

`BackgroundBootstrapCoordinator` prepares the sole key record through profile
mutation admission and validates `securityVaultStatusContract` before full init.
`protectionReady` gates protection/tracking/settings bootstrap independently of
the log AES session. Modern log-only locked records remain protection-ready;
full-wrapped locked records wait for explicit unlock or authenticated separation.
`securityVaultMessageRoutes` is the eager, Dashboard-authorized control plane;
normal status and unlock never convert a persisted record. `EventLogRepository`
owns detailed-log admission and returns an explicit `data_locked` receipt before
queuing new detail. HMAC invalidation is separate from log/worker invalidation.
The exact formats, credentials and transition exit are owned by
[Local Security Vault](../architecture/security/local-security-vault.md).

이 문서는 독립 세션이 직접 수행할 수 있는 execution spec이다.

- 대상은 `apps/background runtime` 아래에 남은 orchestration hub와 그 아래에 숨어 있는 stateful owner다.
- 이 문서의 세션은 `TrackingAnalyticsCoordinator`와 `BackgroundStorageSupportService`를 final owner로 해석하는 상태를 끊고, 최종적으로 retired path로 제거해야 한다.
- helper를 더 추가하더라도 old hub가 canonical owner로 남아 있으면 완료가 아니다.

## Big-Bang Cutover Mode

- final owner를 먼저 문서와 코드로 고정한다.
- old hub에서 final owner가 아닌 책임을 같은 세션에서 끊는다.
- 중간 단계 red는 허용하지만, 종료 시에는 build와 관련 검증이 다시 green이어야 한다.
- owner cutover가 끝나면 old facade path는 남기지 않는다.

## Why This Needs Owner Redesign

현재 남은 문제는 line count가 아니라 owner ambiguity다.

- `BackgroundStorageSupportService`는 snapshot/export/import, inspector query, reset/clear, runtime invalidation을 한 파일에서 모두 다룬다.
- `TrackingAnalyticsCoordinator`는 tick buffer, commit cadence, rollover, behavior metrics, browser event reaction을 함께 가진다.
- 이런 구조는 helper를 더 쪼개도 `누가 canonical state를 소유하는가`가 계속 흐려져서 old path 부활, partial reset, invalidation 누락, restart 복구 꼬임을 반복시킨다.

즉, 여기서 필요한 것은 formatting refactor가 아니라 owner cutover다.

## Final App Runtime Shape

```text
src/apps/background/services/runtime/
  BackgroundAppKernel.js
  BackgroundBootstrapCoordinator.js
  BackgroundMessageRouter.js
  backgroundKernelProfileMutationRuntimeLifetimePort.js
  backgroundKernel*.js                     # composition-only helper, thin only
  backgroundKernelRuntimeConfig.js        # runtime constants only
  support/
    BackgroundMaintenanceCoordinator.js
    BackgroundStorageInspectorService.js
    BackgroundStorageSnapshotService.js
    ProfileMutationCoordinator.js
    ProfileMutationRuntimeGate.js
```

해석 규칙:

- `apps/background/services/runtime`는 boot, listener registration, route wiring, cross-domain orchestration만 가진다.
- app runtime 아래의 service/coordinator는 domain state를 직접 canonical로 소유하지 않는다.
- `backgroundKernel*.js`는 cutover helper일 뿐 final business owner가 아니다.
- `BackgroundAppKernel.js`는 `HistoryManager`, `NudgeManager`, `ManagedContentScriptSync`, `trackingRuntimeCoordinator` 같은 low-level runtime owner를 직접 import하지 않는다.
- `backgroundKernelMessageBindings.js`, `backgroundKernelTrackingRuntimeBindings.js`, `backgroundKernelStorageSupportBindings.js`, `backgroundKernelProtectionBindings.js`도 각각 더 작은 helper로 쪼개질 수 있으며, 단일 generic binding hub로 다시 커지면 안 된다.
- message action wiring은 `backgroundKernelAction*.js` 섹션 helper로 분해되고, protection dispatch wiring은 `backgroundKernelProtectionRuntimeBindings.js` 와 `backgroundKernelProtectionDispatcherBindings.js` 로 분해된 상태를 유지해야 한다.
- browser API ports for bootstrap event registration, tracking lifecycle/message work, history/bookmark concealment, notification dispatch, runtime event emission, behavior/CLSE collection, CLSE context tab lookup, gate interstitial navigation, and protection dispatch live in app-runtime `backgroundKernel*` helpers; domain owners receive injected ports instead of reaching into `chrome.*` directly.
- `backgroundKernelBrowserEventBindings.js`는 event-to-handler mapping과
  `runtime.onMessage` 전용 등록만 소유한다. 일반 Chrome event의 Promise rejection 및
  synchronous throw 관측은 `backgroundKernelBrowserEventListener.js`가 소유하며,
  원래 handler return을 보존하고 named diagnostic을 남긴다.
- dev build-capability가 일시적으로 브라우저 action click을 요구할 때도
  `chrome.action.onClicked` 등록은 이 same browser-event mapping을 통과한다.
  feature route는 bounded handler/state만 소유하고 listener를 직접 등록하지 않으며,
  public build-capability route는 action-click handler를 제공하지 않는다.
- The retired `backgroundKernelTickBuffer.js` helper and write-only tick checkpoint must remain absent. `statsTickRuntimeService.js` owns rollover sequencing only; it does not own a second metrics cache.
- content-script registration diff owner는 `ManagedContentScriptSync`, 실제 injection owner는 `ContentScriptOrchestrator`로 분리된 상태를 유지해야 한다.
- `trackingRuntimeCoordinator` delegates schedule reconciliation to `domains/schedule/background/scheduleRuntimeCoordinator.js`. This named seam serializes applied state, awaits dispatcher success before its version-2 receipt and publication, and validates responses through `schedule/contracts/scheduleRuntimeState.js`; the receipt never supplies policy inputs or restart catch-up alerts. The [Active Sites/Schedule boundary map](../architecture/repository/sites-schedule-boundary-map.md) owns this contract.
- Embedded HTML media control uses `domains/protection/background/runtime/FrameMediaControlBroker.js`, subordinate to the existing `InterventionAdmissionService` top-document lease. `backgroundKernelContentScriptBindings.js` only supplies strict permission, exact-document messaging, registry and admission ports. `ContentScriptOrchestrator` forwards navigation/permission invalidation; it does not acquire a second media policy or persist transport leases. The Active friction boundary map owns this contract.
- content runtime 최종 상태 머신, bootstrap phase, legacy removal contract는 `docs/architecture/runtime/content-runtime-target-architecture.md`를 따른다.
- `contentScriptOrchestratorState.js`는 sync snapshot/catch-up summary/diagnostics shape helper일 뿐이며, injection, teardown, dispatch-ready wait는 계속 `ContentScriptOrchestrator`가 소유한다.
- navigation continuity에서 `NavigationContinuityService`는 runtime decision/state persistence owner이고, `navigationContinuityState.js`는 persisted snapshot normalization/selection helper다. 두 파일은 second decision service나 second persistence owner가 아니다.
- tracking browser events에서 `trackingBrowserEventHandlers.js`는 listener reaction sequencing과 side-effect orchestration owner이고, `trackingTabContextSnapshot.js`는 injected browser-port tab-context read helper다. tab-context helper는 event side effects를 소유하지 않는다.

## Final Owner Map

The optional native protected-tab projection is owned by
`domains/protection/background/runtime/ProtectedTabGroupService.js`, composed by
`backgroundKernelTabManagementBindings.js` through the strict browser port and
`ProtectedTabGroupsRepository`. It consumes the canonical protected inventory;
neither the app kernel nor native group membership becomes another protection
policy owner. Browser events use the existing full-init/generation admission and
native effects join profile mutation drain. The Active background boundary map
specifies failure isolation, user organization and Chrome sync limitations.

### Enso research isolation (2026-09-12)

The background kernel no longer creates `FeedTempoPersistentProfileService` or
registers its restore/commit message routes. Personal tempo evaluation is
`offline_only`; enabling history does not grant a new production tempo writer.
The typed historical checkpoint contract remains available to snapshot/reset
storage owners and explicit research tests. Existing checkpoint data is preserved.
`FeedTopologyPersistentCertificationService` remains active because it certifies
endpoint structure rather than judging consumption tempo. Research ownership and
replay commands are recorded in `scripts/dev/enso-model-research/README.md`.

### 1) `BackgroundAppKernel`

Canonical file:

- `src/apps/background/services/runtime/BackgroundAppKernel.js`

Responsibilities:

- service worker entry remains facade-only
- long-lived service instantiation
- owner service wiring
- bootstrap start/init/register 진입점 제공
- lifecycle admission 결과를 해석하지 않고 sole Zen profile-generation initializer에
  전달하며, initializer가 exact generation을 검증한 required atomic ModelState
  initialization 뒤에만 mutable bootstrap owner를 시작하도록 wiring
- terminal reset/import가 성공하면 old worker를 재구성하지 않고 response 이후
  `chrome.runtime.reload()`로 수명을 끝내는 narrow runtime lifetime port wiring
- browser API port composition for bootstrap, notification, tracking, stats, and protection runtime owners

Must not:

- service worker entry에서 optional labs/service initialization 직접 수행
- domain owner 내부에 직접 `chrome.*` 호출을 되돌려 넣기
- runtime message branch logic 소유
- stats tick state 소유
- storage support semantics 소유
- Dashboard/resource에 first-install Zen generation 생성 권한을 위임
- profile mutation 뒤 old participant/repository/gate를 resume, reopen, rotate

### 2) Message Routing

Canonical files:

- `src/apps/background/services/runtime/BackgroundMessageRouter.js`
- `src/apps/background/services/runtime/support/BackgroundStorageSnapshotService.js`
- `src/apps/background/services/runtime/support/BackgroundStorageInspectorService.js`
- `src/apps/background/services/runtime/support/BackgroundMaintenanceCoordinator.js`

Responsibilities:

- route selection
- full-service initialization gate, dashboard boot-read gate, profile-generation
  boot-settlement barrier를 요청 종류별로 선택
- profile-generation readiness 요청은 broad dashboard readiness와 분리하고, 요청 도착
  generation admission을 캡처한 뒤 exact lifecycle + durable ModelState root 검증 route로
  dispatch
- `GET_SETTINGS` / `GET_BOOT_PREWARM_SNAPSHOT` /
  `GET_ANALYSIS_BOOTSTRAP_SNAPSHOT` / `GET_ARTIFACT_DISCLOSURE_SNAPSHOT` /
  `GET_FIRST_VISION_PROGRESSION_SNAPSHOT`은 stats cache, cycle state, settings
  cache, CLSE bootstrap이 settle된 named dashboard boot-read milestone만 기다린다.
  `GET_SETTINGS`는 content와 extension page 모두 같은 설정 hydration 이후에
  기존 SettingsPersistence의 scope 검증·redaction·typed read를 실행하며, bookmark
  sync, global-cap broadcast, managed catch-up 완료를 기다리지 않는다. Router의
  generation capture/acquire와 response lifetime lease는 그대로 유지된다.
- `INTERVENTION_ADMISSION` / `GET_PROFILE_GENERATION_READINESS` /
  `ISSUE_NUDGE_FRAME_HOST_CAPABILITY` / `CONSUME_NUDGE_FRAME_HOST_CAPABILITY`는
  전용 profile-generation boot-settlement barrier를 기다린다. Frame capability의
  RAM broker는 kernel message bindings 생성 시 bootstrap보다 먼저 구성된다.
  Startup global-cap broadcast가 content `NUDGE_START`와 Global 첫 프레임을
  await하므로 그 자식 frame handshake는 부모 full-init completion을 기다리지
  않는다. 두 capability action도 기존 generation capture/acquire와 response
  lifetime lease를 유지하며, issuer/consumer sender 검증과 one-time token 계약은
  바뀌지 않는다. 기존
  `CONTENT_BOOTSTRAP_STATE` prerequisite와 reset/import control-plane 규칙을
  제외한 다른 message는 full bootstrap init promise를 계속 기다린다.
- support action entrypoint routing
- public nudge render-host admission에서 trusted top-frame content sender에게만
  tab/session/nonce-bound one-time capability를 발급하고, exact
  `nudge-render-host.html` extension frame에서만 이를 consume하도록 routing
- app-wide reset/import after-effects orchestration
- `WORKER_RUNTIME_EVENT_CACHE`는 trusted extension-page route가 fixed-key diagnostic
  요청만 `WorkerRuntimeEventCapability`로 전달한다. Background telemetry는 kernel이
  bootstrap 전에 주입한 local port로 같은 owner를 사용한다. Capability는 공용
  runtime admission과 durable generation을 검사하고 typed store FIFO를 소유한다.
  Reset/import participant가 producer debounce와 write tail을 terminal drain한 뒤
  mutation-only clear를 실행하며 old producer를 새 generation으로 rebind하지 않는다.
- 모든 non-mutation message response lifetime을 하나의 profile mutation runtime
  admission lease로 감싸기
- reset/import control plane은 coordinator가 durable lifecycle을 닫고 공용 gate의
  기존 lease를 drain한 뒤에만 storage mutation을 시작하기
- successful reset/import는 durable `complete`와 local `reload_pending` seal 뒤 exact
  handoff descriptor를 response에 반환하기. Dashboard가 원 response Promise settlement
  뒤 보내는 trusted `PROFILE_MUTATION_RESPONSE_ACK`에서 durable/local fence와 exact
  generation/operation을 재검증한 다음에만 runtime lifetime port로
  `chrome.runtime.reload()` 호출하기

Must not:

- raw storage/backend 직접 호출
- stats runtime state 직접 보유
- 닫힌 generation에서 받은 message를 다음 generation으로 queue/replay
- mutation handler에서 runtime을 reload하거나, exact post-settlement ACK 없이 reload하거나,
  old worker admission을 다시 열기
- dashboard boot read를 bookmark sync, nudge recovery, managed content-script
  catch-up, alarm/focus recovery 같은 무관한 startup tail 뒤에 묶기
- arbitrary website parent의 origin/source나 iframe query 값을 nudge worker
  activation authority로 취급하기
- frame-host capability를 storage에 지속하거나 재사용 가능한 token으로 만들기

### 2.1) Bounded Service-Worker Wake Diagnostics

Canonical files:

- `src/apps/background/services/runtime/support/BackgroundServiceWorkerWakeTelemetry.js`
- `src/apps/background/services/runtime/BackgroundMessageRouter.js`
- `scripts/perf/cwsServiceWorkerWakeContract.mjs`
- `scripts/perf/measureCwsRuntime.mjs`

`BackgroundAppKernel`은 service-worker lifetime마다 strict
`crypto.getRandomValues()`로 fixed-width generation token을 한 번 만들고, sync
listener entry를 감싸는 bounded in-memory diagnostic owner를 설치한다. 이 owner는
public worker graph에도 의도적으로 존재하지만 network/storage/console write를 하지
않고 schemaVersion 1의 `messages`에는 첫 12개 runtime message를 고정 보유한다.
`recentMessages`는 ingress 순서의 마지막 12개, `slowMessages`는 응답 완료 순서의
마지막 12개 중 responseLatencyMs >= 1000인 응답을 보유한다. 세 목록은 각각
resolved messageLimit(기본 12, 최대 32) 이하이며, sequence는 모든 ingress에서
증가한다. `droppedMessageCount`는 기존처럼 첫 `messages`에 포함되지 않은 ingress
수를 나타내며 recent/slow eviction 수를 뜻하지 않는다. Lookup은 세 목록의 union
(최대 3 × messageLimit)만 보유하고 pending은 첫/recent union(최대 2 × messageLimit)
이하이다. 첫/recent 모두에서 제외된 pending 요청의 이후 phase/응답 관측은
폐기한다. 기존 CWS collector는 첫 `messages`와 schemaVersion 1 계약을 계속 사용한다.
action은 canonical `MESSAGE_ACTIONS`
allowlist 또는 masked enum으로만 남긴다. response/milestone error도 closed static
allowlist의 고정 코드만 보존하고, 문법상 코드처럼 보이더라도 목록 밖 문자열은
`NONCANONICAL_ERROR`로 축약한다. sender, payload, URL, settings value는 저장하지
않는다. 공개 global은 non-enumerable read-only
`__ENTROPY_SERVICE_WORKER_WAKE_TELEMETRY__.snapshot()` 하나뿐이며 snapshot의 approved
field 이외 runtime authority를 노출하지 않는다.

`CONTENT_FLOW_SIGNAL` is the only approved type discriminator beyond the existing
masked typed/untyped enums; its kind and payload are excluded. Each message may
add `routePhases`, a deep-cloned map of first local epoch timestamps for exactly
`readiness_started`, `readiness_settled`, `capture_started`, `capture_settled`,
`acquire_started`, `acquire_settled`, `handler_started`, and `handler_returned`.
The listener observer supplies a fourth function callback directly to
`BackgroundMessageRouter.handleMessage`; this callback adds no global authority
and is optional for direct router callers. A supplied diagnostic callback must
be nonthrowing; the production observer guarantees this at its internal port,
while direct router tests may omit the port. Readiness and capture settlement are
observed independently on their existing promises, including rejection.
Acquire covers the existing local/captured profile admission; handler_returned
means the dispatch invocation returned or threw, not that an asynchronous
sendResponse completed. The existing respondedAtEpochMs and responseStatus
continue to describe response completion. The observer's internal callback
records `routePhaseError = BACKGROUND_WAKE_TELEMETRY_ROUTE_PHASE_FAILED` if phase
recording throws, without another clock read or retaining the thrown value.
This bounded explicit failure state preserves handler, lease release and
response behavior; low-level phase validation still fails loudly. Its exit
condition is eviction of that record from all retained lists or worker
retirement. Later requests with a healthy canonical clock continue through the
same owner; there is no alternate clock, persistence or route authority and no
business fallback. A missing
settled phase distinguishes its retained pending boundary only when
routePhaseError is null; an absent phase also covers a skipped boundary.
These diagnostics change no readiness gate, admission lease, await order,
dispatch return, response, timeout or retry.

`INTERVENTION_ADMISSION` is an approved action discriminator, without its operation,
cadence correlation ID, lease or other payload. `BackgroundBootstrapCoordinator`
supplies the required `reportPostDashboardBootStage` port to
`trackingServiceBootstrap`; it accepts only `bookmark_sync`, `nudge_debt`,
`pending_sweep`, `global_cap`, `alarm`, `idle`, `focused_prime`, and
`managed_catchup`, plus the six nested `global_cap_settings`, `global_cap_cap`,
`global_cap_session_read`, `global_cap_session_write`, `global_cap_broadcast`, and
`global_cap_notification` stages defined in the
[Active background boundary map](../architecture/repository/background-runtime-boundary-map.md).
Each records one static `post_dashboard_<stage>_started` and
`post_dashboard_<stage>_settled` milestone. A rejecting awaited stage records
settled status `failed` and still rejects with its original error; best-effort
tasks retain their existing settlement semantics. A started stage without its
settled milestone distinguishes pending work from later stages that have not
started. These local timestamps add no timeout, retry, route, storage, console or
startup scheduling authority. Managed catch-up remains awaited by full init.

내부 clock은 static ESM graph link/evaluation 뒤의
`telemetryInstalledAtEpochMs -> kernel_created -> listener/bootstrap milestones`만
분해한다. 전체 cold wake 판단은 canonical lifecycle harness의 외부
`request sent -> response` RTT다. 기본 collector는 timed cold/warm response가 끝난
후에만 CDP attach하며, pause-on-start는 exception 진단 전용이고 threshold에서 제외한다.
3-sample 결과는 exploratory이고, 20개 이상의 실패 없는 non-pausing sample만 budget
후보가 될 수 있다. 이 diagnostics seam을 payload recorder, durable analytics, remote
telemetry, runtime route, 또는 static module-evaluation clock으로 확장해서는 안 된다.

### 3) Stats Runtime State

Canonical home:

- `src/domains/stats/background/runtime/**`

Required owners:

- `statsTickRuntimeService.js`
- `statsRolloverService.js`

Responsibilities:

- stats mutation-batch delegation
- tick health and durable stats commit cadence through their named owners
- day rollover settle/prime coordination

Mutation-batch admission and required durable acknowledgements follow
`docs/architecture/repository/storage-stats-tracking-boundary-map.md#stats-batch-admission-and-durable-acknowledgement`.
Ordinary batches load and pin the calendar boundary before entering the FIFO;
rollover settle/prime enter through the named rollover batch seam. Recovery
checkpoints and content ACKs cross a required hourly commit barrier before
advancing, including inside a larger batch. Only successful rollover settlement
may finish the historical daily summary.

The retired in-memory tick buffer, `runtime.tick_metrics` backup, and
`runtime.last_tracked_at` checkpoint had no semantic reader. They must not be
reintroduced as diagnostic or compatibility mirrors.

Must not live in:

- retired `apps/background/services/runtime/TrackingAnalyticsCoordinator.js`
- `apps/background/services/runtime/BackgroundAppKernel.js`

### 4) Content-Flow Aggregate Collection

Canonical home:

- `src/domains/stats/background/collection/**`

Required owner:

- `behaviorTelemetryRecorder.js` plus the durable content-flow stats recorder
- `src/domains/protection/background/runtime/FeedFlowRuntimeStateOwner.js` for
  trusted source order, document fencing, cumulative baseline, and prepare/CAS
  commit state; `ProtectionRuntimeStateCoordinator.js` is delegation only

Responsibilities:

- admit only the exact V1 `scroll_spike | short_media_attention` content-flow union
- transform supported content-free signals and prepared feed deltas into durable aggregate facts
- preserve trusted tab/hostname identity for feed-flow deltas
- keep feed baseline mutation after durable stats through prepare -> commit ordering
- keep CLSE short-dwell and tactical page/tab counts with their separate named owners
- do not accumulate a second per-tick metric copy or session backup

Must not live in:

- message router
- background kernel
- storage support service

### 4.1) Gate Runtime State

Canonical home:

- `src/domains/protection/background/runtime/GateRuntimeStateOwner.js`

Required owner:

- `GateRuntimeStateOwner.js` owns per-host Gate state, foreground scope,
  continuity-fact validation/application, intervention pass windows, explicit
  leave/return policy state. Confirmed consumed contexts come from the Tracking
  sealer and `TrackingConsumptionLedger`, interpreted by `gateConsumedContextProjection`.
- `ProtectionRuntimeInputProvider` reads that ledger once per evaluation and
  derives both Gate consumed contexts and the read-only common consumption
  context. Environment points come from the existing Tracking batch and passive
  window port. `behavior/consumption/consumptionContext.js` owns explanation;
  it does not yet change decision assembly, recovery or intervention policy.
- `ProtectionRuntimeStateCoordinator.js` composes and delegates this API; it
  does not own a second Gate map, normalizer, or lifecycle.

Responsibilities:

- preserve exact foreground entry, exit, return, and tab-close timing
- apply navigation continuity DTOs without recomputing tracking-owned facts
- reject malformed continuity/context facts with named Gate contract errors
- keep entry, return, and detour intervention windows on one canonical state
- expose cloned host snapshots; Gate's consumed-context projection alone applies
  dwell/window/limit filtering to Tracking's confirmed protected intervals
- require `TrackingProtectionService` to validate its complete runtime-state
  port at construction; missing FeedFlow or Gate methods must not degrade to a
  call-time `null` or skipped state update

Must not live in:

- browser event bindings
- protection runtime input projection
- app runtime coordinator state

### 5) Browser Event Reactions

Canonical home:

- `src/domains/tracking/background/trackingBrowserEventHandlers.js`
- `src/domains/tracking/background/TabTimeTracker.js`
- `src/domains/tracking/background/trackingActiveTabRuntimeState.js`
- `src/domains/tracking/background/trackingDomainSessionRuntimeState.js`
- `src/domains/tracking/background/trackingIdleLifecycle.js`
- `src/domains/tracking/background/trackingScopePolicy.js`
- `src/domains/tracking/background/trackingStatsSettlement.js`
- `src/domains/tracking/background/trackingTabActivitySettlement.js`
- `src/domains/tracking/background/trackingSessionDurationRecorder.js`

Responsibilities:

- tab/window/history/browser listener reaction
- tracking-side sequencing
- history/bookmark/permission/notification callback execution은 app bootstrap
  coordinator의 단일 FIFO `waitForFullInit` gate를 통과한다. listener 등록은
  MV3 wake-up을 위해 동기적으로 유지한다.
- 모든 ordinary browser callback은 full-init 이후 공용
  `ProfileMutationRuntimeGate` lease 안에서 실행된다. callback이 시작한 detached
  best-effort task도 독립 lease를 획득하므로 reset/import drain이 그 write를 놓치지
  않는다. Bootstrap prewarm과 startup favicon capture도 `init()` 종료 전에 독립
  lease를 동기 획득한다. 닫힌 generation의 event는 다음 generation으로 replay하지
  않는다.
- tab lifecycle callback은 admission body 전에 `TabLifecycleEventQueue`의 tab별 FIFO에
  들어간다. 같은 tab의 loading/complete/History/commit/remove/replace/create/activate는
  순서를 추월하지 않고, 다른 tab은 병렬로 진행한다. `ProtectionTabLifecycleLedger`가
  raw ingress 순서, 최신 URL/status, History proof, removal tombstone의 유일한 owner이며
  오래된 tab-update reaction은 protection work 전에 종료한다.
- tracking `AlarmScheduler`가 소유한 단일 `oneMinuteTick`은
  `CLSEServiceClient.runCLSEHeartbeat()`를 호출한다. CLSE는 별도 alarm을 등록하거나
  service-worker interval을 시간 소유자로 사용하지 않는다. Heartbeat와 background
  collector의 runtime-message/webNavigation/tab/window/idle callback은 같은 gate의
  arrival-time capture token을 사용한다.
  `CLSEServiceClient`는 background composition에서 주입된 `capture`/`runCaptured`
  포트만 전달하며, navigation persistence와 heartbeat storage queue가 끝나기 전에는
  lease를 해제하지 않는다. Response-bearing CLSE message는 기존 `return true` 수명을
  유지하고 admission 실패 시 ring buffer나 storage owner를 호출하지 않는다.
- Collector-triggered CLSE checkpoint request는 별도 timer 없이 최대 5초당 한 번만
  write lane에 admission된다. Heartbeat는 activity elapsed-time settle, loop prune,
  rollup, baseline flush 뒤 compact `runtime.clse_checkpoint` write를 강제 admission하고
  commit까지 await한다. Snapshot은 exact schema 아래 최근 닫힌 10초 bucket 3개와 current
  bucket, activity/loop/aggregation cursor를 보존한다. Worker restart는 이 checkpoint를
  검증·복원하며, disable/reset/quiesce는 pending commit을 drain한 뒤 명시적으로 clear한다.
- tracking idle bootstrap은 initial query를 await한다. Initial/query/state-change mutation은
  각각 local admitted lease 안에서만 실행되어 profile drain이 idle transition을 놓치지
  않는다.
- permission owner는 popup intent 처리와 managed-content resync Promise를 반환해
  FIFO slot이 실제 propagation 완료 전 해제되지 않게 한다. `history` grant는
  bookmark sync로 축약하지 않고 activation checkpoint를 지운 뒤 serialized full
  cleanup catch-up을 await하며, `bookmarks` 변화만 bookmark sync owner로 보낸다.
  notification listener 등록 재시도는 이미 등록된 browser listener family를 중복
  추가하지 않는다.
- `runtime.onSuspend`는 full init을 기다리지 않는 명시적 예외다. suspend
  budget 안에서 terminal settlement/flush를 즉시 시도하고 named diagnostic을
  남긴다. Notification dispose와 tactical/event log flush Promise를 owning admitted
  task 안에서 await한 뒤에만 lease를 해제한다. Nudge debt는 mutation과 같은 session
  lock 안에서 이미 commit되므로 suspend flush/controller를 두지 않는다. 따라서 profile
  mutation runtime gate는 우회하지 않으며 닫힌 generation의 in-memory state를 flush하지 않는다.
- Tactical flush의 browser inventory는 `trackingActiveTabRuntimeState.buildBackgroundContext`
  한 번의 조회가 소유한다. 기존 context DTO는 `totalTabs`, `audibleTabs`, `idleTabs`를
  함께 전달하며 총개수에는 non-web tab도 포함한다. `backgroundKernelTacticalLogs`의
  필수 callback을 `TacticalIntelligenceLogger`가 소비하고 별도 browser port/query는
  두지 않는다. callback 부재는 버퍼 소비 전 명시적 failed flush다. 조회/DTO 실패는
  기존 bounded log 진단 `TACTICAL_BACKGROUND_CONTEXT_FAILED`를 남기고 tactical fact와
  로그 저장을 보존한다. 이때 0/빈 context는 진단이 동반된 미확인 placeholder이며
  관측된 zero나 policy/stats authority가 아니다. 별도 count 조회가 없어
  `TACTICAL_TAB_COUNT_FAILED` 실패 지점도 두지 않는다.
- runtime side effects delegated through injected narrow interfaces
- Completed-visit history deletion runs before protection ingress freshness,
  Gate navigation and content dispatch, within the existing admitted tab FIFO.
  Protection failure/supersession must not skip that exact URL deletion.
  `HistoryManager` rejects browser deletion failure with `HISTORY_DELETE_FAILED`;
  completion observes `TAB_COMPLETE_HISTORY_DELETE_FAILED` and continues the
  independent protection work. The Active memory-purge workflow map owns the
  visit-time and catch-up contracts.
- favicon capture admission, candidate selection, failure cooldown and in-memory
  cache coordination stay in `src/domains/tracking/background/FaviconService.js`.
  `src/platform/browser/faviconFetch.js` owns the service-worker-safe local Chrome
  `_favicon/` cache read through the own-origin asset adapter, timeout, byte limit,
  bounded PNG signature/header/dimension validation, worker decoding and canonical
  PNG data-URL conversion, independent of Chrome's proprietary response MIME.
  Persisted/provided MIME admission remains unchanged. Observed HTTP(S) icon URLs
  never become request destinations; host permissions grant no egress exception.
  Chrome's extension API disables favicon-server fallback. Extension UI uses that
  local endpoint, validated persisted/provided data, and an explicit monogram when
  no usable image exists. `backgroundKernelCoreServices.js` injects the required
  reader; the domain must not import `apps/**`, and missing enabled capture ports
  fail with `FAVICON_FETCH_PORT_REQUIRED`.
- favicon data-URL shape validation remains in
  `src/platform/storage/assets/faviconDataUrlPolicy.js`; durable cache access
  remains behind `FaviconRepository` / `FaviconStore`.
- nudge teardown는 `ProtectionDispatcher`의 named boundary를 통한다. 살아 있는 tab의 production `NUDGE_START`와 settings-disable의 `PROTECTION_UPDATE -> NUDGE_STOP ACK -> session terminalization`은 Dispatcher-owned per-tab content-mutation lane에서 settle한다. tab switch/window blur도 `stopNudgeForTab`으로 같은 lane의 content stop과 session terminalization을 함께 수행한다. forced debug start는 trusted debug seam이며 production ordering authority가 아니다.
- `ProtectionDispatcher`는 background composition에서 eager 생성된다. raw top-frame committed/history/removal ingress는 profile admission을 기다리지 않고 lifecycle ledger와 dispatcher lane을 즉시 invalidate한다. committed navigation은 content session도 같은 tick에 stale 처리한다. top-frame commit은 정의상 document 교체이므로 URL delta가 관측되지 않아도 무조건 invalidate하며, invalidate 시 pending dispatch-ready waiter는 이전 status와 무관하게 해제된다. receiver가 있었던 적 없는 `absent` session은 `absent`로 남지만 waiter는 동일하게 해제되므로, 이미 떠난 document를 기다리며 lane을 점유하지 않는다. `tab_removed`와 `tabs.onReplaced`의 removed ID는 raw ingress에서 queue admission을 닫고 ledger에 removal tombstone을 남긴다. 같은 tab의 앞선 reaction은 FIFO상 removal handler보다 먼저 settle하므로 admitted handler가 nudge terminalization을 await하고 dispatcher/content/gate/feed-flow state를 최종 evict할 때 exact tombstone도 삭제한다. 더 최신 lifecycle이 이미 관측됐다면 이전 removal finalizer는 그 ledger state를 지우지 않는다. profile admission rejection이나 terminalization failure에서도 shared `evictRemovedTabRuntimeOwners` cleanup이 exact dispatcher lane/tombstone과 `ContentScriptOrchestrator` session을 모두 final-evict한다. `tabs.onReplaced(addedTabId, removedTabId)`는 그 owner order를 마친 뒤 added ID를 현재 tab 상태에 맞는 protection update 경로로 처리하며 replacement를 일반 tab close 통계로 기록하지 않는다.
- `ProtectionTabUpdatedDispatchProtocol`은 raw `tabs.onUpdated` ingress receipt와 receipt-bound `applied | superseded` outcome의 유일한 발급/claim/consume owner다. Dispatcher가 receipt를 claim한 뒤 정상 성공을 raw 값으로 반환하거나 listener가 same-shaped 오류를 재분류하는 경로는 허용하지 않는다. Top-frame committed ingress는 canonical URL/document와 monotonic generation/tag certificate를 ledger에 남기며, exact later sequence와 private queue provenance가 일치하는 in-flight receipt만 `protection_committed_navigation_superseded`로 닫는다.
- dispatch cancellation 판정은 `ProtectionDispatchSettlementProofs`(순서 있는 증명자)와 `ProtectionLiveAdmissionReconciliation`(단계형 live-admission 파이프라인)이 소유하며, 둘 다 `ProtectionDispatchLifecyclePrimitives`의 owned-error brand와 exact identity reader를 공유한다. 이 분리는 두 모듈이 Dispatcher를 역참조하지 않게 하기 위한 것이므로 primitives를 Dispatcher로 되돌리면 안 된다. lane 재진입은 런타임으로 판별할 수 없어(정상 큐잉과 구분 불가) `tests/protectionDispatchLaneReentrancy.test.js`의 정적 계약으로 강제한다.
- settlement 판정 결과는 `ProtectionDispatchLifecyclePrimitives`의 세 생성자(`settledDispatchInspection` / `readmittedDispatchInspection` / `refusedDispatchInspection`)로만 만든다. `inspectTabUpdatedDispatchSettlement`는 if-체인이 아니라 순서 있는 검사자 테이블이며, 공유 사실은 `readTabUpdatedSettlementFacts`가 한 번만 읽어 전달한다(분기별 재조회 금지). settlement diagnostic payload는 `ProtectionDispatchSettlementDiagnostics`의 순수 빌더가 필드 테이블로 소유하며, 모든 필드는 정확한 기대 타입이거나 `null`인 narrowing projection이다. 기록 자체는 Dispatcher가 소유한다.
- Gate 규칙은 permitted/permissionless 두 경로가 공유한다. 두 경로는 권한만 다른 같은 기계이므로 `acceptGateRedirectCommittedOvertake`(redirect controller phase는 자신이 유발한 committed navigation을 통과할 수 있다)와 `settleGateInterstitialPresented`(Gate 제시의 공통 종결부)를 각 경로가 사본으로 갖지 않는다. bootstrap refresh와 fence assertion은 경로마다 실제로 다르므로 공유하지 않는다. `sendProtectionUpdateAttempt`의 Gate 레그는 `runGateDispatchLeg`로 분리되어 `{ done: true, result }`(시도 종료) 또는 `{ done: false, gateThemePresentation }`(content 레그로 인계)만 반환하고, Gate가 누적하는 상태는 `gateOvertakeArbiter`가 소유한다.
- dispatch lifecycle invariant가 모듈을 옮기면 `check:content-runtime:bootstrap-contract`와 `check:background-kernel:architecture`를 같은 변경에서 함께 옮긴다. 두 guard는 `npm run build`에 포함되지 않으므로 소유권이 어긋나도 조용히 실패한다.
- receiver-missing recovery는 `ContentScriptOrchestrator`가 발급한 exact document/attempt/session-generation capability ACK를 `ProtectionDispatchTransport`가 검증한 뒤 한 번만 재전송한다. 시간 지연 사다리와 반복 `tabs.sendMessage`는 readiness 증거가 아니다.
- background/content의 공개 console 진단은 `runtimeDiagnosticConsole`의 명시적 `debug|info|warn|error` severity와 단일 평탄 문자열을 사용한다. typed lifecycle supersession/cancellation은 diagnostics owner에 기록하고 hard rejection만 high severity로 올린다. Hard browser-listener rejection은 URL/content 없이 lifecycle queue의 `reason`, `phase`, `tabId`, positive `invalidationTag`만 추가 투영한다.
- permissionless protection admission이 async settings/runtime 작업 중 추월되면
  Dispatcher가 생성한 branded lifecycle error와 exact current atomic snapshot을
  함께 검증한 뒤 `protection_permissionless_admission_superseded`로 settle한다.
  코드 문자열만 같은 외부 오류나 snapshot proof mismatch는 계속 hard failure다.
- `TabTimeTracker`는 thin facade이고, active-tab state / domain-session state / idle lifecycle / settlement owner를 직접 구현하지 않는다

Must not own:

- tick buffer canonical state
- storage snapshot/reset semantics
- direct `abortNudgesForTab` calls that bypass the protection teardown coordinator

### 6) Storage Support Control Plane

Canonical split:

- `src/platform/storage/support/*`
  - low-level capability/query contract only
- `src/apps/background/services/runtime/support/*`
  - app-wide reset/import/inspector/snapshot orchestration only

Rules:

- snapshot export/import capability is separate from inspector query capability
- reset/clear/repair/retention orchestration is separate from snapshot/inspector
- terminal reset/import는 shared ingress drain 뒤 producer부터 downstream queue/store
  순서로 participant를 quiesce한다. Participant sequence는 dependency order이며 병렬
  fan-out이 아니다. Guarded order는 tracking tick -> nudge window/terminal effects ->
  cycle -> settings -> settings propagation -> CLSE -> stats -> progression -> event log ->
  Zen background model이다.
- destructive task 성공 뒤 durable lifecycle은 `committed -> complete`, local runtime
  gate는 `reload_pending`으로 seal된다. Handler는 exact handoff descriptor를 성공
  response로 반환하고 reload하지 않는다. Dashboard가 원 response settlement 뒤 시작한
  narrow ACK에서 trusted sender와 durable/local exact fence를 재검증한 뒤에만 lifetime
  port가 `chrome.runtime.reload()`를 호출한다.
- old worker participant, progression service, Zen repository, runtime gate에는
  resume/reopen/rotate fallback이 없다. Failed mutation의 exact-generation recovery는
  terminal task를 다시 drain할 뿐 normal admission을 복구하지 않는다. 새 generation은
  fresh worker bootstrap만 bind한다.
- one generic `BackgroundStorageSupportService` hub is not final state
- retired `BackgroundStorageSupportService.js` path must not return

## Retired Paths

아래 파일은 final owner가 아니며, cutover가 끝난 현재는 삭제되어야 한다.

- retired analytics coordinator path
- retired storage support hub path

## Concrete Execution Plan

### Phase A. Owner Lock And CI

목표:

- final owner map을 문서/CI에 먼저 고정

작업:

1. 이 문서와 관련 canonical doc를 갱신
2. `TrackingAnalyticsCoordinator.js`와 `BackgroundStorageSupportService.js`가 retired path로 다시 생기지 못하게 CI rule 추가
3. helper가 final owner처럼 비대해지지 않도록 size/import guard 유지

완료 기준:

- 새 세션이 문서만 읽어도 tick state와 storage support의 정답 owner를 바로 찾을 수 있다

### Phase B. Storage Support Split

목표:

- snapshot / inspector / maintenance를 별도 owner로 분리

작업:

1. `BackgroundStorageSupportService`에서 snapshot orchestration을 `BackgroundStorageSnapshotService`로 이동
2. inspector DTO assembly를 `BackgroundStorageInspectorService`로 이동
3. reset/import/clear runtime invalidation을 `BackgroundMaintenanceCoordinator`로 이동
4. old hub path는 삭제

완료 기준:

- reset과 inspector와 snapshot이 서로 다른 public surface를 가진다
- `BackgroundStorageSupportService` path를 지워도 owner semantics 설명이 유지된다

### Phase C. Stats Tick State Migration

목표:

- tick/rollover/commit coordination을 stats runtime owner로 이동하고 의미 없는 backup state는 삭제

작업:

1. rollover settle/prime 흐름을 stats runtime owner로 이동
2. durable stats commit과 runtime-health owner를 명시
3. 소비자 없는 tick buffer, backup timer, last-tracked checkpoint를 삭제

완료 기준:

- retired `TrackingAnalyticsCoordinator` path가 없어도 stats runtime mutable state 설명이 유지된다

### Phase D. Behavior/Event Split

목표:

- behavior metric accumulation과 browser event reaction을 분리

작업:

1. 소비자 없는 `recordBehaviorEvent` / per-tick metric accumulation 경로 삭제
2. durable content-flow projection은 `behaviorTelemetryRecorder.js` 한 경로만 유지
3. browser event handler에서 active-tab/tick side effects와 metric accumulation 결합 제거

완료 기준:

- browser event reaction을 바꿔도 durable content-flow owner는 변하지 않는다

### Phase E. Tracking Runtime Owner Split

목표:

- `TabTimeTracker`를 thin facade로 제한하고 tracking runtime 내부 owner를 명시적으로 분리

작업:

1. active tab/session checkpoint는 `trackingActiveTabRuntimeState.js`로 이동
2. exact `active | pending_commit` domain-session intent는 `trackingDomainSessionRuntimeState.js`가 소유하고, host별 dwell mirror/API는 두지 않는다
3. idle transition은 `trackingIdleLifecycle.js`로 이동
4. sites/category 해석은 `trackingScopePolicy.js`로 이동
5. browser event성 tab settlement는 `trackingTabActivitySettlement.js`로 이동
6. session duration 기록은 `trackingSessionDurationRecorder.js`, active/tab settlement는 `trackingTabActivitySettlement.js`로 분리
7. `trackingStatsSettlement.js`는 owner가 아니라 composition facade로 유지

완료 기준:

- `TabTimeTracker.js`는 helper owner를 조립하는 thin facade로 읽힌다
- browser event logic와 tick/rollover logic가 서로 다른 owner 파일을 가진다
- CI가 direct policy import / inline idle lifecycle / oversized tracker를 실패시킨다

### Phase F. Coordinator Collapse

목표:

- `TrackingAnalyticsCoordinator` path를 완전히 제거

작업:

1. app runtime에는 analytics wiring만 남기고 stateful logic 제거
2. helper/runtime wiring이 직접 owner service를 보도록 교체
3. routing/boot/wiring 외 app runtime state owner 제거

완료 기준:

- `TrackingAnalyticsCoordinator` path 삭제
- stats runtime owner를 kernel 밖에서도 파일 경로만 보고 바로 설명할 수 있다

### Phase G. Shell Removal And Final Guards

목표:

- transitional shell 재유입 차단

작업:

1. old hub import 금지
2. old shell 내부 stateful token 금지
3. 영향권 테스트와 build 갱신

완료 기준:

- old hub를 지워도 system explanation이 무너지지 않는다

## What Must Completely Disappear

- `TrackingAnalyticsCoordinator`가 tick buffer/rollover/backup의 canonical owner인 상태
- `BackgroundStorageSupportService`가 snapshot/inspector/reset/import를 한 허브에서 모두 소유하는 상태
- app runtime helper가 domain/platform owner를 대신하는 상태
- browser event reaction과 stats runtime state가 같은 owner에 남아 있는 상태

## What Counts As Failure

- helper를 더 만들었지만 실제 stateful semantics는 old hub가 계속 소유하는 경우
- `apps/background`가 `domains/stats/background/runtime`를 대신해 today tick state를 canonical로 쓰는 경우
- `platform/storage/support` capability가 app-wide reset policy까지 직접 소유하는 경우
- old hub를 지우면 어떤 owner가 정답인지 다시 설명할 수 없는 경우

## Hard Completion Criteria

- stats tick/rollover/backup state는 `domains/stats/background/runtime/**`가 canonical owner다
- storage snapshot/inspector/reset은 서로 다른 owner surface를 가진다
- `TrackingAnalyticsCoordinator.js`와 `BackgroundStorageSupportService.js`는 삭제되어 있으며 retired path guard가 있다
- `BackgroundAppKernel.js`는 composition root 설명만으로 충분하다
- 새 파일을 만들 때 `apps / domains / platform` 중 어느 owner에 두는지 즉시 결정 가능하다

## No-Compromise Rule

`조금 더 읽기 좋아진 runtime helper`는 목표가 아니다.
`old hub가 canonical owner 지위를 잃는 것`이 목표다.

## Cross-intervention admission (2026-09-09)

The Active [intervention admission contract](../architecture/runtime/intervention-admission-runtime.md)
owns the shared browser-session policy. `InterventionAdmissionService` serializes
reservations, actual presentation, cleanup, recovery and destructive conclusions.
Its typed session repository persists the active owner and 45-second post-end
deadline across worker restart, tab switches and document replacement.

Ordinary Enso, Site/Global Furin, Presage, Gate review/notice and Suikinkutsu
presentations cannot preempt one another. Only an active isolation Gate is a
mandatory boundary. Screen/input ownership stays in `ritualSurfaceArbiter`;
priority metadata cannot grant preemption or authorize a stale tab close.
Candidates are bounded and re-evaluated at producer boundaries, never replayed
from a cooldown queue. Automatic Furin STOP carries the captured run IDs through
content cleanup and background terminalization. Manual Furin keeps its isolation.
