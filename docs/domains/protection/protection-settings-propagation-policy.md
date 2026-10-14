# Protection Settings Propagation Policy

- Status: Active
- Owner: protection domain
- Last validated against code: 2026-10-03
- Path policy: current-only
- Canonical for: protection settings propagation policy

- Companion docs:
  - `docs/architecture/repository/settings-command-boundary-map.md`
  - `docs/architecture/repository/friction-nudge-effect-boundary-map.md`

이 문서는 `filterSettings`/artifact 변경이 콘텐츠 탭에 어떻게 전파되는지, 현재 운영 정책이 무엇인지 정의한다.

## 1) 목표

개발 QA의 설정 전파 실패 검증은 background composition의
`@settings-propagation-qa-fixture` seam만 사용한다. 격리된 실행이 소유한
helper의 nonce·run·profile marker와 실제 sender tab/document을 확인한 뒤,
RAM lease로 한 actual task의 broadcast 단계만 hold/fail한다. 저장 ACK,
동일 task WAIT, 3회 재시도, durable checkpoint, supersession과 generation
fence는 기존 owner가 수행한다. 공개 빌드는 원래 broadcast port를 직접
사용하며 fault route와 상태를 포함하지 않는다. 정확한 허용 범위·해제·
증거 계약은 `docs/operations/qa/entropy-qa-control-plane.md`가 소유한다.

- 새로고침 없이 protection/artifact가 적용되어야 한다.
- 설정 변경 비용(탭 조회, 메시지 전송, DOM 재적용)을 불필요하게 키우지 않는다.
- 과도한 최적화로 동기화 정확도/UX를 해치지 않는다.

## 해석 가이드 (유연 모드)

- 이 문서의 `필수/금지/강제` 표현은 운영 기본 가드레일을 뜻한다.
- 실험 단계에서는 근거와 범위를 남기면 제한적 예외를 둘 수 있다.

## 2) 현재 전파 경로

1. Dashboard에서 설정 변경
2. Dashboard store가 canonical owner path로 command/patch 전송
   - preset/site 같은 cross-key action은 owner-specific command를 우선한다
   - UI/controller는 canonical storage patch를 직접 조립하지 않는다
3. Background `TrackingMessageHandler` / `SettingsService.applySettingsChange`:
   - canonical settings persistence 적용
   - persistence owner가 계산한 실제 base key와 `filterSettings.<featureKey>` semantic changed key 수신
   - canonical `committedItems`와 version을 save ack로 반환
   - cache/version을 갱신하고 post-commit plan을 coordinator에 schedule
4. `BackgroundSettingsPropagationCoordinator`:
   - 첫 schedule write 전에 one-time restore gate로 기존 session checkpoint를 읽는다
   - pending task를 `runtime.settings_propagation` session checkpoint에 기록
   - cache refresh, runtime adapter, content-script sync, protection broadcast를 한 executor에서 순서대로 실행
   - 각 stage가 성공하면 다음 side effect 전에 `appliedStages`를 checkpoint에 기록하고, worker replay는 완료 stage를 건너뛴다
   - content-script sync의 기존 탭 catch-up은 단순 주입 완료가 아니라 `receiver_ready` / `active` 확인까지 성공 기준으로 사용
   - readiness timeout 대상은 pending catch-up target으로 유지하여 해당 stage 재시도와 worker 재시작 복구에서 다시 처리
   - 실패 stage만 bounded retry하고 worker 재시작 시 pending checkpoint replay의 terminal outcome까지 기다린다
   - retry가 소진된 failed stage는 다음 fresh commit에 union하고 retry receipt를 reset한 뒤 다시 연다
   - fresh service init의 기존 탭 catch-up도 별도 best-effort queue가 아니라 같은 durable executor에 schedule한다
5. `ProtectionDispatcher.broadcastSettingsUpdate`:
   - 대상 탭 선택(`full` / `domain-scoped` / `feature-targeted` / `active-only`)
   - 대상 탭별 content-mutation FIFO에서 exact document/URL-bound `PROTECTION_UPDATE` 전송
   - stale receiver revision floor가 검증되면 같은 FIFO transaction 안에서 fresh snapshot을 정확히 한 번 재전송
   - `nudgeConfig` disable은 같은 target transaction에서 update 뒤 `NUDGE_STOP` ACK와 session terminalization까지 완료
   - 각 target을 `acknowledged` / `skipped` / `failed`로 분류하고 aggregate summary 반환
6. Content `ProtectionController`:
   - `PROTECTION_UPDATE` 수신
   - `ProtectionRegistry` 통해 keyed/global effect mount/unmount

save ack와 propagation completion은 같은 개념이 아니다.
전파 실패는 로그/재시도/후속 sync 문제로 취급하고, persistence 성공 자체를 저장 실패로 다시 해석하지 않는다.
Dashboard는 privileged command에서 terminal propagation outcome을 기다리고, commit은 성공했지만
전파가 실패하거나 timeout이면 dirty/save error가 아닌 `apply_error` 경고로 표시한다.

## 2.1) 저장 ACK와 전파 outbox 계약

- 요청 patch는 commit 증거가 아니다. Background가 canonicalization과 실제 persistence 결과를 반영해 반환한 `committedItems`가 save ACK의 SSOT다.
- `settingsTransport`는 `committedItems`가 plain object가 아니면 `SETTINGS_COMMIT_ACK_INVALID`로 거절한다.
- Dashboard `settingsCommandBus`는 요청 patch가 아니라 검증된 `committedItems`를 store success patch로 사용한다.
- `changedKeys`는 물리 저장 목록이 아니라 후속 effect routing용 semantic 목록이다. `filterSettings`가 바뀌면 실제 feature diff만 `filterSettings.<featureKey>`로 추가하며, domain hash artifact key는 전파 계약에 포함하지 않는다.
- coordinator는 첫 schedule 전에 기존 checkpoint read를 한 번 완료하고, scheduled receipt 전에 pending task를 session checkpoint에 기록한다. 성공하면 checkpoint를 지우고, retry 소진 시 stage/error/retry count를 가진 failed outcome을 보존하고 `failed_retained`로 진단한다. 보존된 failed task는 다음 fresh commit이 오면 failed stage와 changed key를 새 task에 합쳐 다시 연다.
- stage side effect 성공 뒤에는 다음 stage 전에 progress checkpoint를 쓴다. Worker restart replay는 `appliedStages=true`인 stage를 건너뛴다. Side effect 완료와 checkpoint write 사이의 process-loss window는 원자 transaction이 아니므로 각 stage handler는 재실행에 안전해야 하며, checkpoint write 실패 시 downstream stage를 시작하지 않는다.
- `chrome.storage.session`은 브라우저 세션 내 worker restart 복구를 위한 outbox다. canonical settings의 mirror나 장기 이력이 아니며 브라우저 restart로 비워질 수 있다. 브라우저/확장 fresh service init은 canonical registration plan에서 이미 열린 탭을 다시 계산하고, 그 catch-up을 같은 outbox에 새 task로 기록하므로 장기 mirror 없이도 현재 탭을 다시 수렴시킨다.
- diagnostic log는 `taskId`, `commitVersion`, `stage`, `changedKeys`, retry, error code/name/message를 평탄한 필드로 출력한다. error object를 문자열 보간해 `[object Object]`로 숨기지 않는다.
- catch-up readiness 오류의 message는 실패 개수 외에 최대 8개 tabId/reason/error와 생략 개수를 보존한다. reason/error는 각각 240자로 제한하며 별도 URL 필드를 복사하지 않는다. 기존 owner summary는 전체 항목을 유지한다. 예약된 retry가 없으면 `retryDelayMs=not_scheduled`로 기록한다. 이는 실패를 해결하거나 주입 완료를 receiver-ready로 간주하는 변경이 아니다.
- synchronous `SETTINGS_CHANGED`가 terminal propagation failure를 반환할 때 message response는 canonical failure receipt의 `status`, task/version, changed keys, applied stages, `failures[]`를 보존한다. Dashboard와 QA harness는 이를 재구성하거나 generic error string으로 축약하지 않는다.
- Dashboard generic patch와 owner command는 `waitForPropagation`을 privileged extension-page request에만 사용한다. `failed`/`timed_out` outcome도 save ACK를 무효화하지 않으며, command promise는 committed payload로 resolve되고 sync state만 `apply_error`로 분리된다.
- Dashboard는 명령별 저장/반영 receipt를 유지한다. 다른 명령의 성공이나 저장 no-op(`propagation` 없음)은 기존 `apply_error`를 지우지 않는다. 영향을 받은 key를 포함하는 충분히 최신의 성공한 propagation receipt만 해당 경고를 해소한다.
- `SettingsCommandFeedbackBridge`의 명시적 반영 재시도는 `SettingsPropagationCommandService.retrySettingsPropagationViaRuntime` → privileged, profile-generation-bound `RETRY_SETTINGS_PROPAGATION` → `SettingsService.applySettingsChange(persist:false)`를 사용한다. 저장된 현재 설정을 다시 읽고 기존 coordinator/outbox로 적용하며 canonical settings를 다시 쓰거나 version을 올리지 않는다. 실패한 기존 task도 이 fresh propagation task에 합쳐 재개한다.
- 재시도 요청 key는 command channel과 실제 전파 key의 교집합으로 제한한다. coordinator 대기는 15초, transport 대기는 20초이며 실패/timeout/checkpoint 예약 실패 receipt를 그대로 반환한다. Supersession 시 요청 version보다 최신 covering task의 receipt를 허용하되 요청 key coverage를 검증한다. 전송/권한/profile/ACK 오류는 별도 실패로 노출하고 이전 `apply_error`를 유지한다.

### 진행 작업의 최신 설정 인계와 추적

비활성 탭 퍼지의 `blockedUrls`, `tabEvaporationForBlocked`,
`tabEvaporationTimeoutMinutes` 변경도 기존 `runtime_adapters` stage에 포함한다.
이 stage는 해당 owner의 진행 작업을 무효화하고 session 관찰 checkpoint를
지운 뒤 완료된다. `hasPendingRuntimeSettingsAdapters(keys)`는 coordinator가
소유한 pending/processing/retained-failed stage를 조회한다. 퍼지는 canonical
settings mutation lane 뒤 이 조회로 시작을 제한하며, 진행 중에도 version과
미완료 reset을 확인한다. 재시작 후 복원된 실패도 이 제한을 유지한다. 전체
content-script sync 완료를 퍼지의 선행조건으로 만들지 않는다.

`BackgroundSettingsPropagationCoordinator`는 새 post-commit task를 받으면 진행 중인
이전 실행의 worker-local AbortSignal을 checkpoint 쓰기 await 전에 철회한다.
다음 stage는 시작하지 않고, 미완료 stage/changed key를 최신 task에 합쳐 durable
checkpoint 인계를 완료한 뒤 최신 실행을 시작한다. 이미 완료된 독립 stage는
유지하며 새 task가 다시 요구한 stage만 재개한다. 인계 저장이 실패하면 후속 효과를
실행하지 않고 failed receipt와 재개할 의무를 보존한다.

이전 task를 `succeeded`로 조기에 종료하지 않는다. 기존 coalesced waiter 계약에 따라
이전 caller도 자신을 포함하는 최신 task의 terminal outcome을 받는다. 예를 들어
v1 주입 준비 중 v2 OFF가 저장되면 v1 caller의 propagation은 v2 task의 결과까지
기다린다. save ACK의 v1 `committedItems`와 v2 propagation 완료는 서로 다른 사실이다.
새 terminal status나 checkpoint schema를 추가하지 않는다.

`settingsPropagationContext.js`는 worker-local `taskId`, `commitVersion`, `executionId`,
AbortSignal 전달 계약이다. coordinator가 실행마다 생성하고 managed sync/readiness와
broadcast가 소비한다. execution ID는 retry/restart마다 새로 만들며, signal과 실행
context는 저장·메시지 전송하지 않는다. `runtime.settings_propagation`은 기존 task,
stage flag와 완료 여부만 보존한다. commitVersion은 인과관계의 표지이며 별도의 설정
snapshot이나 정책 원본이 아니다. 설정 전파 외의 독립 runtime 호출에는 context가 없다.

실제 broadcast composition의 `applyScheduleRuntimeSettings` →
`ProtectionRuntimeCoordinator` → `ProtectionDispatcher`는 같은 실행 context와
스케줄 판정 시각 `nowOverride`를 그대로 전달한다. runtime coordinator는 bootstrap
snapshot 정리·dispatch·prepaint 등록의 await 뒤 취소를 확인하고, prepaint managed sync도
같은 context로 실행한다. runtime await 경계에서 취소된 continuation은 이후 효과나
스케줄 적용 기록으로 진행하지 않는다. 이미 발행된 쓰기의 원자적 취소를 보장하지는 않는다.

등록 owner는 permission/plan 준비 완료 뒤 첫 쓰기 전에 취소를 확인한다. 이미 발행한
등록 batch는 실제 signature commit까지 완료하고, Orchestrator는 취소된 batch의
catch-up 의무를 기존 pending 목록에 보존해 최신 scope로 다시 판정한다. readiness
owner는 다음 주입·sidecar·재시도를 차단한다. 서로 다른 실행 context의 ensure는
하나의 취소 가능한 promise를 공유하지 않는다. 이미 발행한 browser 호출은 settlement를
기다리며, begun teardown은 새 설정이 와도 정리 ACK까지 완료한다.

권한 이벤트는 설정 commit/version으로 위장하지 않는다. scripting/origin 변경은
`trackingServiceBootstrap` ingress에서 dispatch permission receipt와 content 준비
revision을 즉시 철회한 뒤 기존 full-init/profile admission으로 실제 등록·정리를
진행한다. Orchestrator의 `assertPermissionsCurrent`는 등록 owner의 준비 구간과
첫 쓰기 전까지 전달되며, 발행한 batch와 정리 ACK의 settlement 의무는 유지한다.
회수→재부여는 새 revision이므로 이전 조회·허가·readiness handoff를 되살리지 않는다.
등록 후 취소된 catch-up 의무는 최신 권한과 열린 탭 목록으로 다시 판정한다.
권한 취소 오류는 설정 저장 실패나 효과 해제 완료를 뜻하지 않는다. 이미 실행된
효과의 해제는 기존 정확한 document/attempt teardown ACK로만 확인한다.

Broadcast는 plan 조회 뒤·target 시작 전·document transaction의 각 기존 abort 경계에서
신호를 확인한다. 이전 OFF 작업이 취소되면 아직 시작하지 않은 NUDGE_STOP/terminalization을
시작하지 않는다. 이미 시작한 STOP의 정리는 기존 FIFO 안에서 끝낸다. 취소된 broadcast는
full-sweep 성공 cache를 갱신하지 않는다. Profile mutation quiesce도 같은 실행 신호를
철회한 뒤 진행 중인 stage와 checkpoint 작업을 drain한다.

진단 연결은 아래와 같다.

- command save ACK의 version/task → coordinator의 task/version/execution 및 stage checkpoint
- 같은 context → readiness ID/document/attempt 또는 teardownId의 요청·정리 ACK
- 같은 context → `settings_propagation_dispatch_bound`의 envelope trace/revision/document
- content의 기존 trace 기반 ACK → `settings_propagation_content_ack`, target settlement
- 최신 covering task → terminal propagation receipt

취소되기 전에 완료한 side effect와 취소 후 늦은 응답을 구분한다. 취소된 전파는 일반
stage failure/retry 경고로 중복 기록하지 않으며, 실제 cause는 stage cancellation 진단에
남긴다. 이 연결은 bounded 기존 diagnostics를 사용하고 정책 판단이나 별도 영구 이력을
소유하지 않는다. 모든 지연 admission request/lease와 효과 내부 자원까지 연결한 통합
trace를 주장하지 않으며, runtime reload/worker 종료의 실제 Chrome 보장은 별도 QA다.

## 2.2) 필터 실행계획 원칙

- 사용자 설정은 필터 capability의 기준이다.
- `ProfileResolver`가 계산하는 artifact family의 활성 상태와 각 자식 필터의 ON/OFF는 서로 다른 계약이다. Barrier의 `timeAnchor`가 `armed`/`engaged`/`cleanup`이어도 `shortFormBlock`과 `videoSkipGuard`를 함께 켜지 않는다. `EnvelopeAdapter`의 artifact ownership 단계는 앞선 설정·family suppression·modifier 판정에서 이미 활성인 필터에만 `runtime_artifact` 실행 출처를 붙이며, 비활성 필터의 설정과 suppression metadata를 유지한다.
- release V1 정책은 사용자가 켠 조절 가능 필터만 한 단계 강화하거나 완화한다. 꺼진 필터를 정책이 새로 활성화하지 않는다.
- `blur`/`saturation`/`textRhythm`은 공통 named `relaxed`/`normal`/`reinforced` runtime profile을 사용한다. `clickDelay`, `scrollFriction`, `inputVisualBrake` 같은 binary profile은 강도 조절 대상이 아니다.
- 세 adaptive feature의 저장 진실은 `{ isActive, value: true }`뿐이다. 자간·투명도·미세 블러·문장 경계 셔플은 compiled runtime profile에서 함께 물질화되며 별도 setting key나 사용자 level이 아니다.
- schedule의 `hardBlockWindow`는 사이트 접근 시간대 계약이며 필터 강제 활성화 상태가 아니다.
- content runtime, bootstrap truth, popup diagnostics는 모두 최종 실행계획(`compiledFeatures`)을 기준으로 한다. 엔진의 `filterPlan`은 정책 요청이며 UI에 “적용 중”으로 노출하지 않는다.
- 각 실행 필터는 `executionSource`를 포함한다. Popup은 이를 통해 사용자 설정, 적응 정책, 런타임 artifact 중 무엇이 해당 필터를 실행 중인지 표시한다.

## 2.3) Release V1 global cap reinforcement

Global cap 초과는 사용자 선택이나 저장 설정이 아니라 protection runtime의 고정
불변식이다. `protectionRuntimeDecision.js`는 cap이 초과되면 effective posture를 한
단계 강화해 평가하며, 이미 `strict`인 posture는 `strict`에서 포화된다. 이 강화로
policy plan이 사용자 ON 상태인 `blur`/`saturation`/`textRhythm`을 요청하면
`EnvelopeAdapter.js`가 일반 정책 강화 modifier를 생성한다. resolver는 상위
우선순위 완화·강화·suspension과 함께 판정해 named profile을 선택한다.
저장 filter level 비교나 hidden 추가 band는 없다. 물리값과 전달 계약의 owner는
`docs/architecture/runtime/friction-filter-injection-architecture.md` §3.4를 따른다.

Global cap은 사이트를 닫거나 scope를 바꾸지 않고, 사용자가 꺼 둔 필터를 새로
활성화하지도 않는다. 별도 overflow policy key나 cap-derived settings key를 만들지
않으며 Dashboard는 목표 시간만 편집하고 초과 시 강화 규칙은 읽기 전용으로 알린다.

## 2.4) 강화·완화 충돌과 포화 정책

Time-budget admission additionally consumes the same current collection
decision as the stats writer (`dataCollectionPolicy.js`). The runtime settings
snapshot carries collection mode, consent and exclusions. Recording OFF or
denied consent disables global time-cap evaluation; a domain exclusion also
disables that domain's individual/global time-budget projection. Saved goals
and ordinary protection membership are preserved. The assembler suppresses
stale historical activity/session budget inputs for an unrecorded domain,
while the activity-day query filters facts by current admission and invalidates
its cache on recording-policy changes. No alternate stopwatch or history
collection path is allowed. Non-time protection, isolation admission and
explicitly enabled artifacts retain their existing owners and policy.

`protocolStateSnapshot.js` owns recording admission for protocol budgets and
requires canonical `recordingPolicy`. Both the runtime assembler and the
filter-indicator message handler use that owner. The indicator distinguishes
saved `globalGoalMinutes` from applicable `protocolTargetMinutes` and
`referenceTargetMinutes`; unrecorded use cannot show a live budget there either.

- 강도 조정은 누적 합산하지 않고 feature마다 `-1`, `0`, `+1` 중 하나로 포화한다. 같은 방향 modifier가 여러 개 와도 두 단계 이상 이동하지 않는다.
- 반대 방향이 겹치면 source의 선언된 priority가 높은 방향 하나만 선택한다.
- background 순서는 `furin_stay_suspension` > `furin_overrun` > `schedule_relaxation` > `policy_strengthening`이다. `EnvelopeAdapter`가 목표 소진 비율 >= 1에서 `furin_overrun`을 생성한다.
- 따라서 일반 정책 강화 중에도 schedule 완화가 활성화되면 Text Rhythm은 `relaxed`가 되고 shuffle은 꺼진다. 예외적 Furin overrun이 함께 활성화되면 `reinforced`가 된다.
- suspend modifier는 강도 선택보다 먼저 feature를 비활성화한다. 정책과 modifier는 사용자 OFF를 뒤집지 않는다.
- 전체화면은 modifier가 아닌 최종 투영이다. background의 `fullscreenPolicy`가 일반 상태의 한 단계 완화, 스케줄 중 시각 효과 일시 해제, 목표 초과 중 완화 금지를 결정한다. content는 그 결과만 소비한다. 독립 `filterSettings.fullscreenVisualRelaxation`은 Lens에서 상시 노출하며 스킵 방지와 무관하다.

## 3) 현재 브로드캐스트 정책

### 3.1 기본

- 도메인/스케줄/룰 변경은 기존 정책대로 `full` 또는 `domain-scoped` 전파를 사용한다.
- production `tabs.query` 경계는 결과 배열의 모든 항목을 plain tab record로 검증하고, tab id를 `0`을 포함한 0 이상의 정수로 요구한다. 잘못된 항목을 무시해 무대상 성공으로 바꾸지 않고 query stage를 명시적으로 실패시킨다.
- 탭 수신자가 없으면 recovery 주입 경로를 사용한다(`sendMessageWithRecovery`).
- fan-out 함수가 resolve되었다는 사실이나 terse `{ ok: true }`만으로 성공 처리하지 않는다. 일반 `PROTECTION_UPDATE`는 content가 snapshot/patch 적용 source, `staleIgnored:false`, null revision-mismatch evidence를 가진 exact acknowledgement를 반환해야 dispatch ledger와 target acknowledgement를 commit한다. Gate START는 exact `{ ok:true, operation:'start', sessionId, mode }`, STOP은 exact `{ ok:true, operation:'stop', sessionId, dismissed:true }` ACK만 허용하며 prepared operation/session/mode와 일치해야 한다. 요청한 STOP session이 이미 absent인 것은 `dismissed:true`의 idempotent postcondition이지만, 다른 session이 active이면 negative ACK로 실패한다.
- content가 stale snapshot/patch를 무시한 응답은 성공 ACK가 아니다. background는 stale reason과 `received < expected` revision 관계를 검증하고 수신자가 증명한 revision floor만 in-memory ledger에 남긴다. `ProtectionDispatcher`는 public queue에 재진입하지 않고 같은 tab transaction 안에서 그 floor보다 큰 fresh snapshot을 정확히 한 번 즉시 재전송하며, 두 번째 응답이 exact applied ACK일 때만 target을 성공 처리한다. 두 번째 stale 또는 transport/ACK failure는 terminal target failure이고 durable Coordinator retry로 넘어가며, 중간 실패는 가장 높은 floor를 지우지 않는다. 성공 commit, 실제 document navigation, tab eviction만 해당 recovery fact를 종료한다.
- content diagnostics는 모든 delivery를 last-attempt evidence로 기록하되, `activeFilterKeys`를 포함한 last-applied activation은 effect mutation이 성공한 뒤에만 교체한다. stale/resync/rejected no-op 또는 mutation exception은 applied state를 덮지 않으며, Runtime Debugger의 canonical activation과 owner health 독립 대조를 보존한다.
- ready session이 이미 있으면 public enqueue 시점에 exact `documentId`와 canonical URL을 admission identity로 캡처한다. non-ready admission은 FIFO body에서 readiness를 먼저 성립시킨 뒤 exact document/URL을 캡처하기 전에는 runtime/Gate/payload side effect를 시작하지 않는다. 전송 자체는 `{ frameId: 0, documentId }`에 결박하고 모든 await/send/commit 경계에서 queue generation, document, canonical URL/hostname을 다시 확인한다. top-frame committed navigation은 content session과 dispatcher transaction을 같은 raw browser-event ingress에서 invalidate하며, same-document History API URL change는 document를 유지하되 session URL을 갱신하고 이전 URL transaction을 invalidate한다. 따라서 queue 대기나 늦은 ACK가 새 document 또는 새 route에 재결박되거나 revision floor를 주입할 수 없다.
- 응답 누락·malformed exact shape·source/stale 모순은 `PROTECTION_UPDATE_ACK_INVALID`로 실패한다. `RESYNC_REQUIRED` content response도 성공 commit하지 않으며 transport는 그 response metadata를 진단 경계까지 보존한다.
- summary는 `mode`, `attemptedCount`, `acknowledgedCount`, `skippedCount`, `failedCount`, 구조화된 `failures`를 포함한다. Coordinator는 count가 non-negative integer인지, attempted count가 세 분류의 합인지, failure 배열 길이와 success 값이 failed count와 일치하는지 검증한다.
- target 하나라도 실패하면 summary는 `success: false`이고 coordinator가 broadcast stage를 재시도한다. retry 가능한 stage 및 checkpoint write attempt는 `console.warn`으로 기록한다. retry budget이 소진되어 failed checkpoint를 보존한 failure와 최종 success/failure checkpoint 자체를 확정하지 못한 terminal durability failure만 `console.error`다. successful full sweep timestamp도 실패 attempt에서는 commit하지 않는다.
- terminal failed checkpoint의 error message에는 최대 8개 target failure의 tab/url/code/reason과 생략 수를 bounded JSON으로 남겨 worker restart 후에도 원인을 잃지 않는다.
- `nudgeConfig` 변경은 별도 dashboard notification action을 만들지 않는다. canonical
  broadcast stage가 비활성화된 설정을 확인하면 같은 target/recovery 경로에서
  동일 tab content-mutation FIFO를 유지한 채 `PROTECTION_UPDATE` 뒤 `NUDGE_STOP` ACK와
  canonical session terminalization까지 완료한다. production `NUDGE_START`도 exact content
  ACK 또는 terminal skip까지 같은 FIFO에서 await하므로 disable 뒤 늦은 START가 부활할 수
  없다. 명시적인 content `{ ok: true }` 응답만 stop acknowledgement로 인정하며,
  누락/실패는 target failure로 집계해 coordinator checkpoint/retry에 남긴다.

### 3.2 `filterSettings` 전용 최적화

- 변경 키가 `filterSettings`만인 경우 `active-only` 전파를 사용한다.
- 변경 키가 `filterSettings.<featureKey>`를 포함하면 `feature-targeted` 전파를 사용한다.
- 즉시 적용 대상은 현재 활성 웹 탭이다.
- 백그라운드 탭은 탭 활성화/업데이트 이벤트 경로(`sendProtectionUpdate`)에서 동기화된다.

## 4) Artifact 적용 정책

- Artifact UI는 Dashboard 카드(`tools` 탭)에서 값만 편집한다.
- 실제 주입은 `ProtectionRegistry` keyed effect가 담당한다.
- Enso의 공개 설정은 canonical `clickDelay`/`ensoGate` 계약이 소유한다. 사용자가 별도의
  infinite-scroll/Barrier artifact를 켜지 않는다.
- `EnvelopeAdapter`는 최종 Enso 실행계획에서 content 전용 `infiniteScrollGuard` controller
  config를 한 방향으로 파생한다. 이 key는 설정 또는 artifact의 독립 source of truth가 아니다.
- 파생 controller가 활성화되면 `ProtectionRegistry`는
  `EnsoRuntimeEpisodeManager.apply(value)`를 호출한다. 이 manager는 FeedFlow sensing과
  feed-local Terminus prelude를 준비하지만, renewed forward demand가 있기 전에는 Enso를 열지 않는다.
- FeedFlow snapshot은 background 통계·진단 입력으로만 보존한다. 이를 generic protection
  pressure/direct trigger나 Barrier/Loop Breaker artifact activation으로 승격하지 않는다.
- 결론: artifact는 "UI가 주입"하는 것이 아니라 "설정 기반 런타임 manager"가 주입한다.

### 4.1 Extension-context runtime filters

- 현재 release runtime에는 extension-context filter가 없다.
- `audioDulling` / `resonance` / `suikinkutsu`는 인간 참여형 dev QA에서만 실행한다. Chrome tab-audio activation UX 제약 때문에 출시 설정·artifact·runtime 파이프라인에는 등록하지 않는다.
- dev 연구 경로와 public exclusion 경계는 `docs/architecture/runtime/audio-dulling-runtime-architecture.md`를 따른다.

## 5) UX 기준

- 핵심: 사용자가 수동 새로고침 없이 효과를 경험해야 한다.
- 허용: 백그라운드 탭은 활성화 시점에 동기화될 수 있다.
- 지양: 설정 변경 때마다 전체 탭 전파로 불필요한 부하를 만드는 설계.

## 6) 오버엔지니어링 방지 기준

다음 조건이 없으면 구조를 더 복잡하게 만들지 않는다.

- 실제 병목 지표(전송 실패율, 지연 체감, 탭 수 증가 시 CPU 상승)가 확인됨
- 기존 정책에서 UX 이슈(적용 누락/심한 지연)가 재현됨
- 최적화 변경이 기존 정확도(정책 판단, 탭별 적용 일관성)를 낮추지 않음

## 7) 향후 확장(조건부)

필요 시에만 아래를 검토한다.

- 탭 인덱스 캐시 기반 선택 전파(전체 `tabs.query` 최소화)
- 설정 버전 기반 lazy sync(탭별 마지막 적용 버전 비교)
- 활성화 직후 시각 효과 램프업(적용 순간 이질감 완화)

위 항목은 "효과가 실제로 검증될 때"만 도입한다.
