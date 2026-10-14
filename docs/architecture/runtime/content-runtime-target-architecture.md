# Content Runtime Target Architecture

- Status: Active
- Owner: tracking runtime
- Last validated against code: 2026-08-17
- Path policy: planning-allowed
- Canonical for: content runtime target shape, injection/bootstrap owner boundaries, and migration contract

## Purpose

이 문서는 content script 주입과 content bootstrap의 "최종적으로 도달해야 하는 구조"를 고정한다.

중요한 점은 현재 구현을 미화해서 설명하는 것이 아니라, 아래 3가지를 동시에 만족하는 최종형을 명시하는 것이다.

1. 안정적인 `document_start` 부트
2. background/content 책임의 단일화
3. migration 중 레거시 owner의 확실한 제거

이 문서는 implementation backlog보다 우선한다.
코드가 이 문서와 다르면, 코드를 이 문서로 수렴시키는 것이 정답이다.

## Final Principles

1. `executeScript` owner는 오직 `ContentScriptOrchestrator`다.
2. registration diff owner는 오직 `ManagedContentScriptSync`다.
3. content session identity는 `tabId`만으로 충분하지 않으며, 최종적으로 `tabId + documentId`를 canonical identity로 사용한다.
4. background는 "receiver가 메시지를 받을 준비가 됐는지"와 "sidecar가 모두 끝났는지"를 같은 상태로 취급하지 않는다.
5. teardown은 registration 변경의 부수효과가 아니라 explicit runtime contract다.
6. 새 seam을 추가하는 변경은 같은 세션에서 대체되는 legacy path를 함께 제거해야 한다.
7. 문서, 코드, 테스트, CI guard는 같은 owner map을 가리켜야 한다.

## Final Owner Map

### Background

- `ManagedContentScriptSync`
  - 소유 책임: desired registration 계산, managed registration apply, catch-up 대상 탭 계산
  - 금지 책임: `executeScript`, receiver-missing recovery, runtime teardown
- `ContentScriptOrchestrator`
  - 소유 책임: open-tab catch-up injection, recovery injection, ensure-ready, teardown, session registry orchestration
  - 운영 규칙: startup/open-tab catch-up은 bounded concurrency와 deduped tab targeting으로 수행한다.
  - 운영 규칙: 빈 worker-local registry는 loader 재주입의 증거가 아니다. `CONTENT_RUNTIME_PROBE`가 같은 build ID의 dispatch-ready state를 반환하고 read-only top-frame probe가 exact URL/document identity를 증명하면 session만 재결합한다. receiver 부재, build ID 불일치, non-ready state, 또는 document proof 실패일 때만 loader injection으로 진행한다.
  - 금지 책임: settings diff 계산, host permission policy 계산
- `trackingContentRuntimeHandlers`
  - 소유 책임: canonical sender/current top-frame/document/URL을 session mutation 전에 검증하고, dispatch-ready handshake를 canonical session owner에 기록한 뒤 protection catch-up reservation을 만든다.
  - 운영 규칙: ingress profile-mutation admission은 bootstrap 응답 전에 capture하고, 응답을 완료한 뒤 detached reservation을 시작한다. invalid/subframe/stale sender는 admission이나 session을 만들지 않는다.
  - 금지 책임: protection/settings payload 계산, timeout/FIFO/lifecycle state 소유
- `trackingContentProtectionSync`
  - 소유 책임: kernel-owned singleton으로서 document/attempt별 reservation, captured admission 실행, tab FIFO, retry/dedupe, navigation invalidation, tab eviction, typed diagnostics를 소유한다.
  - 운영 규칙: 최초 `receiver_ready`, 실패 시 이어지는 exact `active + bootstrap_active`, MV3 worker revival의 `active + loader_reinjected`만 typed trigger다. identity는 `tabId + documentId + attemptId + startedAt`이며 same-document 동시 중복과 성공 후 중복을 억제한다.
  - 운영 규칙: old-document supersession은 reservation의 exact `tabId + expectedDocumentId`와 비어 있지 않고 trim된 distinct `currentDocumentId`가 함께 증명될 때만 non-error다. transport/admission/transaction mismatch와 post-dispatch assert의 detailed `CONTENT_BOOTSTRAP_PROTECTION_SYNC_DOCUMENT_STALE:document_replaced`만 `bootstrap_protection_sync_document_superseded`로 settle하며, same-current/whitespace/malformed/missing identity와 generic `context_changed`는 hard failure다.
  - 운영 규칙: 실패/timeout은 다음 typed handshake가 있을 때만 최대 2회까지 시도한다. 2초 timer는 `AbortSignal`과 `timeout_pending` diagnostics를 발행하지만 platform send/gate owner의 cancellation ACK가 아니므로, 실제 admitted owner가 settle하기 전에는 FIFO나 profile-mutation lease를 해제하지 않는다.
  - 운영 규칙: 더 높은 `syncAttempt`의 exact same-attempt retry가 이미 `scheduled` 또는 `running`으로 queue를 소유한 상태에서만 1차 실패를 `bootstrap_protection_sync_retry_pending`으로 기록하고 console error 승격을 유예한다. 진단은 `pendingSyncAttempt + pendingStatus`를 포함한다. 다른 attempt, same/lower attempt, settled retry는 유예 증거가 아니며 terminal retry 실패는 hard error다.
  - 운영 규칙: committed navigation 또는 tab remove/replace가 reservation의 captured state generation을 실제로 추월하고, 해당 record의 `AbortSignal.reason`이 lifecycle owner가 발급한 exact cancellation error를 그대로 보존할 때만 `bootstrap_protection_sync_cancellation_settled` non-error로 정착한다. timeout, generic abort, foreign same-shaped error, generation/reason 불일치는 hard failure다.
  - 운영 규칙: protection-update bootstrap 중복 억제는 orchestrator의 실제 inject가 이어지는 `receiver_ready`, 또는 기존 strict identity fence를 통과한 same/unknown-document `active + loader_reinjected`에서만 인증한다. `protection_dispatch_transaction` 또는 `protection_update` base와 실제 transport/orchestrator가 생성하는 `dispatch_ready_retry`, `receiver_missing`, `receiver_missing:dispatch_ready_retry`의 닫힌 조합만 허용한다. suppression diagnostic은 이 content-free closed-enum `bootstrapOwnerReason`을 포함한다. arbitrary active, cross-document, 임의 prefix 및 unrelated catch-up injection은 억제하지 않는다.
  - 운영 규칙: committed top-frame navigation은 profile admission이나 runtime init을 기다리기 전 browser-event ingress에서 해당 tab의 모든 pending record를 invalidate/abort하고, tab remove/replace도 ingress에서 전부 abort한 뒤 settle 시 state를 evict한다. state는 최대 128 tabs이며 pending 없는 LRU만 축출하고 전부 pending이면 fail loud한다.
  - 금지 책임: untrusted/late/stale/subframe bootstrap으로 session owner를 mutate하거나, settings 또는 protection payload를 직접 계산하거나, 임의 timer retry를 생성하는 것
- `TabContentSessionRegistry`
  - 소유 책임: document-scoped session lifecycle 저장
  - 운영 규칙: accepted top-frame session commit마다 registry-global positive generation을 새로 발급하고, `getSnapshot(tabId)`는 그 generation과 frozen session clone을 하나의 atomic read로 반환한다. rejected/late telemetry와 media-frame 관측은 generation을 바꾸지 않으며, tab eviction도 generation을 전진시켜 같은 tab/document/URL 값으로 재생성되는 ABA가 이전 receipt generation을 재사용하지 못하게 한다.
  - 운영 규칙: `noteInjecting`의 pending `bootstrapInjectionReason + bootstrapInjectionGeneration`은 이어지는 exact `receiver_ready`, 또는 strict same/adopted-attempt `active + loader_reinjected`에서만 `bootstrapOwnerReason`으로 인증된다. nonempty previous/incoming document가 다르면 `injecting` 중에도 pending reason/generation과 owner를 제거하며, arbitrary active/failure/stale/replacement/committed navigation도 소유권을 만들지 않는다. 두 dispatch-ready wait가 모두 끝난 terminal `dispatch_ready_timeout`은 exact retry reason+generation이 여전히 current일 때만 pending lease를 제거하고 session status는 failed로 바꾸지 않는다. loader 실행 실패도 `failBootstrapInjection`이 캡처한 exact reason+generation이 current일 때만 `failed`를 커밋하고 pending/generation/owner를 제거한다. 오래된 normal injection 실패는 newer force injection의 pending 또는 ready session을 변경하지 않고 `failedCommitted:false` 진단만 남기며, 실패 커밋은 registry의 최신 URL을 보존한다. 새 injection은 generation fence로 보존되고, 해제 뒤 late ready는 owner 없이 정상 protection catch-up한다. 인증된 protection dispatch가 주입과 최초 policy apply를 소유한 경우에만 receiver-ready sync가 중복 force-snapshot을 만들지 않으며, unrelated injection은 정상 catch-up한다.
  - 운영 규칙: 새 MV3 worker가 identity를 모르는 `injecting` 상태에서 기존 live loader의 exact `active + loader_reinjected` 공표를 받으면, invalidated-document/older-attempt fence를 유지한 채 payload의 `attemptId + startedAt`을 canonical live attempt identity로 채택한다.
  - 금지 책임: injection 수행, tab query, permission query
- `ProtectionDispatcher`
  - 소유 책임: protection/nudge dispatch
  - 운영 규칙: explicit false scripting/exact-origin permission은 content readiness/probe/injection보다 먼저 판정한다. 권한 없는 일반 탭과 nudge START/STOP은 typed skip으로 끝난다. 모든 Gate redirect는 content 권한과 독립적인 serial admission fence 아래 permissionless lane을 사용할 수 있다. Detour는 실제 foreground entry/activation만 후보로 만들고 background child나 settings tick은 opener를 바꾸지 않는다.
  - 운영 규칙: document-bound catch-up은 original `documentId`와 `AbortSignal`을 transport까지 보존한다. `PROTECTION_DISPATCH_EXPECTED_DOCUMENT_STALE`는 distinct expected/current document IDs와 exact tab ID를 운반한다. Gate는 synchronous mutation fence로 session staging 및 `beforeGateNavigation(tabId)` await 뒤 navigation을 검증한다. 성공한 same-tab redirect는 terminal이므로 destroyed original document를 다시 검증하지 않으며, 실패는 exact staged session만 rollback한다. Detour의 active frame-0 Gate query가 `metrics.gateDocumentId`를 bind하고 결정은 그 identity를 요구한다.
  - 운영 규칙: top-frame History event의 exact document ID, ready-session old URL, distinct event new URL, process-local raw-ingress sequence가 모두 맞을 때만 serial-queue invalidation과 함께 monotonic History generation certificate를 만든다. 최신 certificate와 현재 ready session의 document/new URL이 exact match일 때만 admission mismatch에 typed same-document overtake 증거를 부착하며, committed navigation/remove/evict/newer generation은 이전 증거를 제거한다. wall-clock timestamp는 diagnostic metadata일 뿐 causal at-or-after 증거가 아니다.
  - 운영 규칙: top-frame committed event도 canonical URL/document ID가 모두 유효할 때 monotonic committed generation certificate를 만들고 같은 generation을 serial-queue invalidation tag로 사용한다. 이미 claim된 tab-update receipt의 작업이 그 invalidation을 관측한 경우 Dispatcher의 exact catch는 private queue-error provenance, 동일 tab/tag/generation, `receiptIngressSequence < committedIngressSequence`, 완전한 ready identity 또는 완전한 identity 부재, 그리고 실제 document/URL 변화 중 하나를 모두 증명해야만 `protection_committed_navigation_superseded`로 닫는다. malformed commit, equal/reversed sequence, stale/revoked certificate, forged error, 동일 ready document/URL은 hard다.
  - 운영 규칙: History certificate는 one-shot이 아니라 bounded multi-use다. 동일 tab/document/current URL에 대한 반복 late `complete`는 같은 stale proposition이므로 settle할 수 있고, cancellation 성공 자체는 proof를 삭제하지 않는다. 다음 History ingress(새 event identity가 invalid여도), full committed navigation, remove, evict가 lifetime을 끝낸다.
  - 운영 규칙: lazy background binding은 canonical dispatcher가 존재하면 History context를 그대로 전달한다. 첫 dispatch 이전에는 pending queue generation/consumer가 없으므로 lazy instance를 만들지 않고 `false`를 반환하며 certificate도 만들지 않는다. 이후 proof 없는 URL mismatch는 hard error다.
  - 운영 규칙: dispatch-eligible HTTP(S) `tabs.onUpdated` loading/complete는 raw callback에서 frozen one-use receipt(tab/status/exact URL/ingress sequence/ready document identity와 atomic session generation)를 만든다. `ProtectionTabUpdatedDispatchProtocol`은 receipt claim 뒤 결과를 반드시 closed `applied` 또는 `superseded` outcome으로 만들며, 정상 성공도 raw 값으로 빠져나가지 않는다. Dispatcher의 exact `sendProtectionUpdate` catch만 private-owner lifecycle error와 receipt를 결합해 typed supersession을 만들 수 있다. History supersession 직전에는 error snapshot뿐 아니라 현재 live certificate의 generation/tag/sequence/document/old URL/new URL과 current ready session을 모두 재대조하고, committed supersession 직전에는 최신 committed certificate의 generation/tag/sequence/document/URL을 다시 대조한다. 따라서 newer valid/invalid History, committed navigation, removal, eviction으로 revoke된 old error와 같은 값을 재사용한 새 generation은 hard다. direct History certificate가 없는 admission-only URL mismatch에서 live URL이 ready-session URL `S`와 exact match하면 기존 `protection_delayed_tab_update_reconciled` supersession을 유지한다. 반대로 live URL이 receipt requested URL `R`이고 pending URL이 없으며 `R != S`이면 supersede하지 않는다. 불변 atomic snapshot `G/D/S`와 single `tabs.get`을 먼저 증명한 뒤 `ContentScriptOrchestrator`가 exact `documentIds:[D]`에 read-only `location.href` probe를 정확히 한 번 실행한다. 결과 하나의 frame `0`, document `D`, canonical href `R`가 모두 맞아야 `TabContentSessionRegistry`가 `G + D + S -> R` URL-only CAS를 commit하며 status/attempt/bootstrap owner는 보존한다. 다른 canonical writer가 그 사이 generation을 전진시켰더라도 current ready session이 exact same `D/R`로 이미 수렴했고 CAS proof와 재캡처 admission이 그 generation에 일치하면 idempotent convergence로 계속한다. 그 외 CAS/ABA는 hard다. 이 live-URL repair는 queue/content/Gate/delivery/ACK가 시작되기 전 lexical admission catch에만 있다. 별도로 serial 대기 또는 transaction 중 admission URL `R`이 `T`로 바뀐 private context error는 receipt의 exact `G/D/S`와 requested `R`, same-or-newer exact `D/R` admission generation, transaction generation, 더 큰 current generation, current ready `D/T`가 모두 일치할 때만 `protection_same_document_url_superseded`로 settle한다. 따라서 receipt 시점에 `S != R`였더라도 앞선 canonical admission repair가 generation을 전진시켜 exact `D/R`을 증명했다면 이어지는 두 번째 이동까지 닫을 수 있다. ready identity가 없던 `loading` receipt는 recovery가 distinct expected/current document를 운반하고 current ready bootstrap identity와 exact-document probe가 requested URL에 일치할 때만 `protection_document_superseded`가 될 수 있다. wrong/malformed/reused receipt, forged downstream error, lookup/probe failure, missing scripting, wrong result shape/frame/document, pending/third URL, document loss, same/equal generation, 또는 증명되지 않은 CAS/ABA는 hard failure이며 refresh/applied/superseded/rejected diagnostics는 raw URL 없이 content-free generation/equality/probe/CAS fields만 남긴다.
  - 운영 규칙: 위 identity-less `loading` receipt의 recovery/probe 조건은 distinct document replacement에 관한 것이다. Same-document URL context mismatch/stale은 admission이 먼저 non-null exact `D/R`을 캡처했고 같은 `D`가 transaction/current snapshot에서 보존되며 generation이 strictly 증가한 경우에만 `protection_same_document_url_superseded`를 허용한다. Admission document가 null인 loading receipt는 이 경로에서도 hard다.
  - 금지 책임: 주입 판단, bootstrap probing, script recovery injection
- `trackingBrowserEventHandlers`
  - 운영 규칙: outer admission wrapper는 error shape를 분류하거나 consume하지 않는다. raw callback은 await 전에 `ContentScriptOrchestrator.getTabSessionSnapshot()`의 document/URL/generation을 receipt에 그대로 캡처하고 browser live lookup은 수행하지 않는다. exact protection send가 반환한 Dispatcher-issued settlement만 원래 ingress receipt에 재결합해 one-use consume하고 즉시 reaction을 종료한다. 따라서 Gate/stats/nudge 등 뒤 단계의 같은 모양 오류는 계속 hard다. Dispatcher는 strict distinct expected/current document IDs와 exact ready-session 또는 위의 bounded loading-bootstrap proof가 일치할 때만 `protection_document_superseded`, exact monotonic same-document session proof가 맞을 때만 `protection_same_document_url_superseded`, exact prior History certificate와 receipt sequence가 맞을 때만 History disposition, exact committed certificate와 queue invalidation tag가 맞을 때만 `protection_committed_navigation_superseded`를 반환한다. Date.now는 순서 증거가 아니다.
  - 운영 규칙: old `tabs.onUpdated complete`가 profile/init admission에 먼저 들어왔지만 아직 실행 대기 중이고 History가 나중에 들어온 경우에는 동일 exact certificate에 `tabUpdateIngressSequence < historyIngressSequence`를 요구해 별도 `protection_history_pending_tab_update_superseded`로 settle한다. 지연 completion 방향(`>`)과 pending-overtaken 방향(`<`)은 named disposition으로 분리하며 sequence equality는 hard다.
  - 운영 규칙: shipping Gate pre-ACK 예외는 exact `gate_mutation:gate_bridge_after_theme_resolution` 하나뿐이다. serial queue History invalidation tag가 최신 proof generation과 같고, transaction D/A와 current ready D/B 및 proof D/A/B가 exact match하며 `ensureSource === 'session_dispatch_ready'`일 때만 `PROTECTION_DISPATCH_HISTORY_PRE_ACK_CANCELED` wrapper를 만든다. Bridge guard는 이 fence가 controller/repository/presentation/content delivery/ACK보다 앞임을 고정한다. consuming tabs ingress는 exact old URL의 `complete`이고 `tabUpdateIngressSequence < historyIngressSequence`여야 한다. injection/reinjection/session wait, 다른 phase, tag mismatch, prepared/started delivery는 hard다.
  - 진단 규칙: History/committed cancellation의 URL path는 내부 proof로만 사용하고 content-runtime diagnostic에는 status/disposition/error code/tab/document identity/phase/generation/order만 투영한다. 최외곽 hard listener rejection은 URL 없이 queue `reason/phase/tabId/invalidationTag`를 평탄 진단에 포함한다.

### Content

- `loader.js`
  - 소유 책임: document별 once-only shell guard와 단일 bootstrap entry load
  - 지원 문서 경계: HTTP(S)의 HTML/XHTML top document만 bootstrap한다. browser/extension/new-tab 문서와 SVG 문서는 state 생성이나 module import 전에 종료하며 favicon capture도 같은 경계를 지킨다.
  - 운영 규칙: `window.top !== window`인 child document는 state 생성, root visual read, module import, bootstrap telemetry 전에 진입을 종료한다. top-frame 등록만으로 이 경계를 대신하지 않는다. child-frame media inventory/control은 `mediaFrameProbe.js`만 소유한다.
  - 금지 책임: 여러 엔트리 분기, feature별 직접 import 조립
- `bootstrapController`
  - 소유 책임: bootstrap phase ordering, state publish, teardown channel wiring
  - 금지 책임: background policy 계산, ad hoc retry/injection logic
- `src/apps/content/bootstrap/*`
  - 내부 helper만 허용하며, 독립 owner로 취급하지 않는다.
- `ProtectionController`
  - 최종 목표 책임: protection message receiver install과 sidecar init을 분리
  - 금지 책임: bootstrap lifecycle 전체 소유

## Final Session Model

최종 세션 키는 아래 형태다.

```text
tabId + documentId
  `- attemptId + startedAt
```

registry는 document identity를 `sessionKey`로 materialize하고, 같은 document 안의 bootstrap
재시도는 monotonic `attemptId`와 `startedAt`으로 구분한다. current top-frame dispatch lookup
편의를 위해 `tabId` 인덱스를 함께 유지할 수 있다.

허용 상태는 아래와 같다.

```text
absent -> injecting -> bootstrapping -> receiver_ready -> active
                                 \-> failed
receiver_ready -> stale
active -> stale
failed -> absent
stale -> absent
```

상태 의미:

- `injecting`
  - orchestrator가 현재 document에 loader를 넣는 중
- `bootstrapping`
  - content bootstrap controller가 phase execution 중
- `receiver_ready`
  - protection message receiver와 teardown receiver가 설치되었고 background dispatch를 받을 수 있음
- `active`
  - receiver install, sidecar init, and runtime control channel setup까지 끝난 steady state
- `stale`
  - navigation, permission shrink, scope shrink, explicit teardown으로 current document가 더 이상 authoritative하지 않음
- `failed`
  - current document bootstrap이 terminal failure로 끝남

핵심 불변식:

1. stale document는 이후 `receiver_ready`나 `active`로 current session을 되살릴 수 없다.
2. old document에서 늦게 도착한 bootstrap message는 새 document 상태를 덮어쓸 수 없다.
3. background dispatch는 `receiver_ready` 이상에서만 허용한다.
4. 같은 document의 더 오래된 attempt가 보낸 `receiver_ready` 또는 `failed`는 최신 attempt 상태를 덮어쓸 수 없다.
5. attempt identity가 확립된 document에는 identity 없는 후속 bootstrap telemetry를 수용하지 않는다.

## Final Bootstrap Phases

### Phase 0. Shell Guard

- `loader.js`가 document별로 exactly-once guard를 건다.
- loader는 `attemptId + startedAt + AbortSignal`로 이루어진 단일 in-flight lease를 만든다.
- stale recovery는 age만 보고 새 Promise를 추가하지 않는다. 기존 cancellable lease를 먼저 revoke한 뒤 교체 attempt를 시작한다.
- shell은 bootstrap entry 하나만 실행한다.

### Phase 1. Receiver Install

- Programmatic catch-up/recovery uses `injectImmediately: true` for the loader,
  media-frame probe and read-only document identity probes. Managed registration
  already uses `document_start`; neither path may add Chrome's default
  `document_idle` wait before Gate dispatch. Immediate injection is scheduling,
  not readiness: the existing exact-document receiver capability, permission
  revision and navigation fences still authorize every mutation.
- build identity를 포함한 read-only runtime probe와 teardown listener 설치
- protection receiver 설치
- bootstrap controller는 이 시점까지는 아직 dispatch-ready를 publish하지 않는다.

### Phase 2. Dispatch Ready

- prepaint CSS tier는 loader/root visual path에서만 처리
- content bootstrap은 settings fallback 없이 receiver readiness만 publish
- background에 `CONTENT_BOOTSTRAP_STATE: receiver_ready` 전송
- dispatch-ready handshake는 capability version을 포함하고, background orchestrator는 trusted sender의 exact `documentId`, bootstrap `attemptId + startedAt + receiverReadyAt`, registry session generation을 하나의 issued capability proof로 결속한다. receiver-missing 강제 재주입은 이 proof를 받은 뒤 한 번만 전송하며 고정 지연이나 반복 send를 사용하지 않는다.
- local commit과 background 전송 직전·직후에 동일 attempt lease가 current인지 확인
- background route는 trusted extension tab sender, frame `0`, sender `documentId`, sender/payload
  canonical web URL 일치를 먼저 검증한다. 검증을 통과한 뒤에만 session owner를 mutate한다.
- accepted handshake에서 profile-generation admission을 먼저 capture하고 응답을 반환한 뒤,
  그 admission으로 `ProtectionDispatcher`의 document-bound `forceSnapshot`을 실행한다. 최초 trigger는
  `receiver_ready`; 정상 `active + bootstrap_active`는 앞선 시도가 실패했을 때의 두 번째
  bounded attempt이다. same-build MV3 worker revival은 `CONTENT_RUNTIME_PROBE`와 exact top-frame
  document proof로 background session만 재결합하며 새 protection catch-up을 만들지 않는다.
  receiver가 없거나 build identity가 바뀌어 실제 loader injection이 필요한 경우의
  `active + loader_reinjected`만 revival/replacement trigger다.
- catch-up은 원래 `documentId`를 `ProtectionRuntimeCoordinator -> ProtectionDispatcher ->
  ProtectionDispatchTransport`에 `expectedDocumentId`로 보존한다. 각 await 뒤, content send,
  bootstrap refresh, nudge 직전과 final return 전에 exact current document를 다시 증명한다.
  expected-document 경로는 coordinator-level prepaint/runtime snapshot side effect를 만들지 않는다.
- `ProtectionDispatcher`의 per-tab content-mutation FIFO는 bootstrap catch-up, settings broadcast,
  normal refresh, Gate prepare/send/settle, production `NUDGE_START`, 그리고 settings-disable의
  update -> `NUDGE_STOP` ACK -> session terminalization을 한 causal lane으로 직렬화한다. ready
  session은 enqueue admission에서 exact document와 canonical URL을 캡처하며, non-ready target은
  queued body에서 readiness를 성립시키고 exact document/URL을 얻기 전에는 semantic dispatch를
  시작하지 않는다. 모든 await/send/commit은 queue generation + document + URL/hostname fence를
  다시 확인한다. forced debug start는 trusted debug admission을 거치는 별도 public seam이며
  production lane의 ordering authority로 사용하지 않는다.
- settings broadcast planner는 HTTP(S) 탭 중 실행 가능한 document가 있는 탭만 fan-out
  대상으로 삼는다. `chrome.tabs.Tab.discarded === true`인 탭은 exact content ACK를 낼 수
  없으므로 broadcast 성공 조건에서 제외하며, 재활성화 뒤 canonical bootstrap/tab lifecycle
  catch-up이 현재 settings snapshot을 적용한다. discarded 탭에 inject retry를 반복하거나 ACK를
  추정하지 않는다.
- Broadcast inventory 이후 raw tab remove/replace가 해당 private FIFO task를 취소하면,
  `getTaskInvalidation(error, task)`의 exact task/tab 및 `tab_removed`/`tab_replaced`
  증거에 한해 대상은 `skipped`로 정착한다. ACK/applied 성공으로 계산하지 않으며
  `protection_broadcast_target_cancelled`와 기존 propagation의 cancelled settlement를
  남긴다. enqueue 대기와 readiness/transaction 중 취소 모두 같은 경계를 사용한다.
  닫힌 탭의 취소가 global-cap bootstrap 전체를 실패시키지 않지만, 같은 문자열의
  downstream error, 다른 task/queue의 증거, navigation invalidation, 실제 적용 또는
  nudge 정리 실패는 기존 hard failure다. 제거 owner의 terminal cleanup 책임은 유지한다.
- exact stale ACK는 mutation 성공이 아니다. stale reason/revision shape와 receiver floor를 검증한
  뒤 같은 owned transaction에서 fresh snapshot을 한 번만 재전송하고 exact applied ACK를 요구한다.
  두 번째 stale은 nudge를 시작하지 않는 terminal target failure이며, 가장 높은 floor는 다음
  durable retry가 strictly newer snapshot을 만들도록 유지한다.
- Gate 경로는 Dispatcher-owned synchronous `mutationFence`를 Bridge/Controller에 전달한다.
  모든 Gate는 같은 탭의 top-level page이며 content overlay/iframe ACK/prepare-settle protocol은 없다.
  `ProtectionRuntimeInputProvider.readProtectedTabInventory({now})`가 current settings와 exact live Gate
  originalURL projection으로 global count/list/cap을 읽는다. count/list는 Detour enablement 및 native groups와 독립적이다.
  `detourEnabled`는 canonical Barrier/global pause overlay를 반영하며, 현재 tab의 exact original URL이 더 이상 보호
  inventory에 없으면 현재 Gate는 일반 admitted resume으로 해제된다. settings propagation과 authorized GET은 같은
  사실을 재평가한다. 선택 없는 policy 해제는 decision/pass/tutorial receipt를 만들지 않는다. optional host/scripting
  또는 tabGroups 권한은 기존 permissionless full-page Gate 해제 조건이 아니다.
  선택 전과 kept-current resume 전에 inventory를 새로 검증하며, selected targets/current tab은 하나의
  arbiter batch로 닫는다. current를 유지하면 exact original URL로 자동 복귀한다. 외부 수동 close가 budget을
  만족해도 synthetic decision/pass/tutorial receipt는 만들지 않는다. 일반 protection transport는 cooperative
  abort 이후 반환된 response를 먼저 normalize하지만 그 응답이 abort를 우회하는 권한이 되지 않는다.
  `documentDisposition: redirected`는 terminal이며 이후 original-document post-assert가 없다.
- tab별 FIFO는 same-document concurrent duplicate를 억제한다. 성공은 terminal dedupe이고,
  실패/timeout만 다음 typed handshake에서 최대 2회까지 재시도할 수 있다. 2초 timeout은
  cooperative `AbortSignal`과 `timeout_pending`을 남기되, hard-cancel ACK가 없는 downstream owner가
  실제 settle하기 전에는 FIFO/profile admission을 풀지 않는다. navigation은 모든 pending record를
  invalidate하고, remove/replace는 raw ingress에서 dispatcher admission을 먼저 닫은 뒤 settle 후 tab
  state를 evict한다. Dispatcher는 listener registration 전에 eager 생성되고,
  `ProtectionTabLifecycleLedger`가 raw removal 시점에 tombstone을 직접 기록한다. 따라서 별도 lazy wrapper,
  bounded replay buffer, publish-before-replay 전환 상태는 없다. profile admission rejection이나
  terminalization failure에서도 exact dispatcher tab state와 `ContentScriptOrchestrator` session을 같은
  removal-owner cleanup에서 final-evict한다.
  catch-up tab state는 128개로 bounded하며 pending 없는 LRU만 축출한다.
- scheduled/succeeded/suppressed/timeout/failed/invalidation/eviction 결과는
  `ContentRuntimeDiagnostics`의 `bootstrap_protection_sync_*` typed event로 기록한다. payload는
  hostname, opaque document/session/attempt identity, bounded counters, fixed error code만 포함하며 raw URL과
  arbitrary error text를 포함하지 않는다. real-site sanitizer는 이 typed evidence를 보존한다. exact
  distinct-document supersession은 `bootstrap_protection_sync_document_superseded` non-error diagnostic만
  기록하고 console high severity를 만들지 않는다. exact lifecycle cancellation도
  `bootstrap_protection_sync_cancellation_settled`만 기록한다. 그 외 실패는 `[object Object]`가 되지 않는
  bounded flat code-bearing console high severity도 병행하되 diagnostics owner를 대체하지 않는다.

이 단계 종료가 background dispatch 허용 기준이다.

### Phase 3. Sidecar Activation

- behavior signal / visual effect bridge
- CLSE overlay
- favicon capture
- 기타 non-critical sidecar

Status indicator는 성공적으로 적용한 `PROTECTION_UPDATE`의 보호 상태와
`indicatorConfig`로 초기화한다. 이 sidecar 단계는 별도 설정 조회나 unblocked
기본값으로 이미 적용한 표시 상태를 덮지 않는다.

이 단계가 끝나면 `CONTENT_BOOTSTRAP_STATE: active`를 publish한다.
이 단계에서 실패가 발생하면 receiver 설치 상태를 폐기하지 않는다. bootstrap은
`receiver_ready`를 유지하되 `reason: bootstrap_receiver_ready_degraded`와 오류
진단을 publish한다. teardown이나 reinjection으로 epoch가 이미 stale이 된 경우,
늦은 sidecar 실패는 `CONTENT_BOOTSTRAP_ATTEMPT_STALE_NOOP`으로 분류하고 최신 상태를
`failed`로 덮지 않는다. early snapshot read도 effect 적용 직전에 같은 lease를 확인한다.

## Final Teardown Contract

### Catch-up completion and retry admission

Registration, open-tab receiver readiness, and protection application are separate
receipts. The settings propagation coordinator validates the orchestrator's
injection summary (including count conservation); a partial catch-up cannot mark
the managed-sync stage successful. Its existing checkpoint and bounded retry
owner retains that unfinished stage, including startup's sync-only task.

A failed catch-up target is not durable execution authority. Every subsequent
sync removes pending entries outside the latest registered permission scope;
an injection-enabled retry also re-reads the current tab inventory and drops
gone, discarded, and out-of-scope tabs. The same inventory is reused for tracked
session reconciliation. Tab eviction removes its pending target. New discarded
tabs are not catch-up injection targets; their existing activation/restore path
owns later readiness. Cancellation of a retry does not assert cleanup of an
already-started document: the exact document/attempt teardown guard stays intact.

### In-flight readiness revocation and handoff

`ContentScriptOrchestrator` owns each in-flight per-tab readiness operation. Its
local `readinessId`/AbortSignal authorizes continuations, not registration scope,
settings policy or document identity. Normal/forced ensure calls retain their
existing deduplication rules within that operation; a changed requested URL
cannot join the previous URL's work. `TabContentSessionRegistry` continues to own
document/attempt/session generation and accepts a per-waiter AbortSignal solely
to release that waiter, its timer and abort listener.

Explicit teardown, navigation, same-document URL change and tab eviction revoke
pending readiness. Permission/probe/injection/receiver-wait continuations check
revocation before publishing readiness, issuing a media sidecar or reinjecting.
Scope reconciliation includes preparing operations even before their first
registry publication; a missing session alone does not prove cleanup unnecessary.
Cancellation is `content_readiness_cancelled`; it is neither receiver readiness
nor cleanup completion. `readiness_revoked` records intent immediately and
`ensure_ready_cancelled` records the continuation's termination phase. The local
readiness ID is not a durable settings-revision or cross-worker trace ID.

Teardown revokes dispatch eligibility immediately when identity is known, waits
for existing readiness work to settle, then obtains the current exact
document/attempt cleanup identity and validates its teardown ACK. Chrome's
already issued `executeScript` is not aborted by this signal. If a started
runtime still has no cleanup identity, teardown fails explicitly; it must not be
classified as `runtime_absent`. A new ensure waits for teardown settlement and
returns `content_cleanup_pending` while a same-document cleanup failure remains.
An explicit teardown retry can clear that gate. A request waiting for this
handoff is itself cancelled if navigation/URL change or tab eviction overtakes it.

After managed-scope reconciliation receives an exact successful teardown ACK,
the Orchestrator retains a local scope-retirement receipt bound to that registry
generation, document, attempt and URL. While current registration still excludes
the host, Dispatcher consumes this observation as a skipped target before
receiver preparation; the same settings broadcast must not reinject the runtime
it just removed. A generic stale session, missing identity, failed cleanup or
nudge preferences being OFF grants no such receipt. Registration re-entry,
registry change, new readiness preparation, permission invalidation, navigation
or eviction revokes it. It grants neither receiver readiness nor cleanup of any
later attempt/document and does not survive a worker restart.
The request's permission revision, per-tab retirement revision and exact URL
fence ACK proof creation, promotion and reads. New readiness intent advances the
retirement revision before any asynchronous preparation, so a late ACK cannot
restore authority after permission revocation, navigation, URL change, eviction
or a waiting ensure request. Same-attempt stale telemetry may update the registry
generation without creating a new lifetime; the final proof still binds the
exact post-ACK generation and identity.

When a settled cleanup gate still names the registry's old document, the
Orchestrator may perform one read-only native top-frame location probe per
explicit ensure request. Exactly one frame-0 result must bind a nonempty,
distinct document ID to the exact requested HTTP(S) URL; the registry generation,
cleanup owner/error, navigation revision and permission revision must remain
unchanged across the probe, and the requesting settings signal must remain live.
This proves document exit even without an optional
webNavigation event, ends only the old document's gate, and resumes ordinary
readiness admission. It never reports old cleanup as successful. Same-document,
missing/malformed/failed, wrong-frame and wrong-URL proofs keep cleanup pending
with `cleanup_document_replacement_refused` / `cleanup_document_probe_failed`;
concurrent ownership changes cancel the request. `cleanup_document_replaced`
records the native replacement proof. There is no timer or automatic retry.

A top-frame committed navigation or tab eviction ends this gate's authority over
the current tab/document; a synthetic receiver-missing reset does not. An actual
registry document replacement accepted from bootstrap telemetry also ends the
old gate when the accepted document matches the trusted top-frame sender. The
orchestrator advances the same readiness/document-exit fences at that accepted
transition. Same-document reinjection, rejected telemetry and missing or
mismatched sender identity preserve the gate. An older
teardown cannot clean or stale a replacement document, and its failure is still
reported to its original caller. Releasing an old gate is not evidence that the
old page's effects were cleaned, especially with BFCache. This local gate does
not survive service-worker restart and is not a replacement for content cleanup
ownership, BFCache policy or dispatcher admission checks. Managed registration
and settings propagation keep their serialized queues. A newer post-commit task
revokes the earlier settings execution through `settingsPropagationContext.js`
before its checkpoint await; the orchestrator binds that signal to its readiness
owner and stops future catch-up work. An already-issued registration batch still
settles and contributes its unfinished catch-up targets to the next current-scope
admission. Cancellation does not drop those targets or assert teardown success.
Independent runtime callers have no settings context and do not share another
execution's revocable readiness promise. The coordinator owns the durable stage
handoff and earlier waiters' covering outcome; the orchestrator owns execution
and cleanup. See the Active protection settings propagation policy for that seam.

### Explicit runtime teardown

The protection receiver and its sidecars have separate cancellation epochs.
An old receiver operation may not enter a newly installed receiver after a lazy
host import. Debugger flag/import continuations and behavior-effect imports must
check their owning epoch before arming or playing. The visual bridge supplies an
AbortSignal through theme preparation, disruption rendering and audio; abort
removes the renderer's overlay, cancels its animation frame and restores its page
mutations. Renderer completion and cancellation are both idempotent.

Receiver and sidecar cleanup attempt independent owners, collect failures, and
await asynchronous debugger teardown before their completion is acknowledged.
Client context invalidation delegates to this same content owner, marks the local
attempt stale, and omits only the unavailable background publication. This
explicit platform termination seam does not claim to observe every reload or to
automatically repair an old content context; a new document/build is required.

teardown은 단순한 "다음부터 inject 안 함"이 아니다.

탭 navigation/URL 관측은 content 주입 전에도 registry에 `absent` record를 만든다.
Orchestrator는 실행 직전 current session이 `status: absent`, `documentId: null`,
`attemptId: null`, `attemptCount: 0`인 경우에만 정리 의무가 없는
`runtime_absent`로 분류하고 `teardown_not_required` 진단을 남긴다. 이 경우에는
메시지나 ACK가 필요하지 않으며 registry 상태를 변경하지 않는다. 시작된 runtime의
identity 누락, `failed`/`stale` 상태, ACK 실패는 이 분류로 우회하지 않는다.
여러 탭의 정리 실패를 집계할 때는 `AggregateError.errors`와 함께 최대 8개 탭의
ID/code/message 및 생략 수를 bounded message에 남겨 propagation checkpoint에서도
실제 원인을 보존한다.

필수 동작:

1. background가 `CONTENT_RUNTIME_TEARDOWN`을 보낸다.
2. content는 current attempt의 write lease를 먼저 revoke하고 `stale` transition을 commit한다.
3. content는 applied effects와 transient UI를 clear한다.
4. content는 `stale` 상태를 background에 publish한다.
5. background session registry는 해당 document를 더 이상 dispatch target으로 보지 않는다.

teardown trigger:

- host permission 제거
- registration scope shrink
- top-frame committed document navigation
- explicit reset/import flows

`tabs.onUpdated` loading/complete만으로는 document 경계를 판정하지 않는다.
History API same-document navigation에서도 해당 신호가 발생할 수 있으므로,
top-frame `webNavigation.onCommitted`와 document-scoped bootstrap telemetry가
canonical identity 전환을 소유한다. `onHistoryStateUpdated`는 현재 receiver/document를
유지하고 canonical session URL과 navigation continuity를 갱신하며, 이전 URL로 admission된
dispatcher transaction은 즉시 invalidate한다. 이미 exact `NUDGE_START` ACK가 반환된 뒤 같은
document URL만 바뀐 경우에는 content overlay와 background run을 함께 보존하고 다음 route
transaction이 reconcile한다. exact Gate START/STOP ACK도 같은 ready document의 History URL change에는
terminal delivered/reconciled로 끝나지만, committed document replacement는 기존 dispatch/session을
abort한다. `tabs.onUpdated` reaction은 exact expected/current document mismatch가 distinct하다고 증명된
경우에만 `protection_document_superseded`로 consume한다. 같은 document의 URL 경합은 receipt/admission/
transaction/current generation이 strictly monotonic하고 exact document가 보존된 경우에만
`protection_same_document_url_superseded`로 consume한다. missing/malformed identity, equal generation, 또는
generic URL/attempt `context_changed`는 숨기지 않고 hard failure로 유지한다.

Automatic Furin의 세션도 같은 문서 경계를 따른다. loading/complete와 top-frame committed
ingress는 `ProtectionDispatcher.revalidateNudgesForTab`을 호출하고, teardown coordinator가 exact active run
bindings와 native frame-0 documentId를 비교한다. 같은 문서의 모든 phase는 유지하고 실제로
교체된 문서에 묶인 captured runIds만 기존 terminal/outbox/debt owner로 종료한다. 현재 committed
ingress sequence와 removal/eviction fence는 native document probe와 session lock/read/write 사이에도 재확인하며,
확인되지 않은 문서나 stale proof를 사라진 문서로 취급하지 않는다. 정책/권한 변경은 기존 settings,
ordinary dispatch와 privileged-transition invalidator의 cleanup ACK 판정을 유지한다. 표시된 daily cap은 그대로 유지한다.
Admission URL mismatch의 단일 live-tab lookup 도중 canonical session이 먼저 요청 URL로
수렴한 경우에는, after snapshot이 strictly newer generation의 동일 ready document와 exact
requested URL을 보존하고 live/pending URL도 requested URL과 모순되지 않으며 fresh admission이
그 exact generation을 다시 캡처할 때만 정상 transaction으로 이어간다. 문서 변경, third URL,
equal/ABA generation, recapture mismatch는 계속 hard failure다.
ready identity가 없던 `loading` receipt의 same-document URL 경합은 admission이 먼저
non-null exact document/requested URL을 캡처하고 같은 document가 transaction/current
snapshot에서 보존되며 generation이 strictly 증가한 경우에만 typed URL supersession으로
settle한다. admission document가 null이면 계속 hard failure다.
처음에는 ready identity가 없던 `loading` receipt가 content send 뒤 document replacement를
만난 경우도 private fence의 transaction/current generation 증가, 새 bootstrap session의
`invalidDocumentIds`에 기록된 이전 transaction document, exact 새 document/URL probe, 전후
atomic snapshot의 같은 attempt가 모두 증명될 때만 typed supersession으로 settle한다.

## Migration Contract

이 영역의 migration은 "새 구조 추가"가 아니라 "최종형으로 수렴"이어야 한다.

각 변경은 아래 규칙을 지켜야 한다.

1. 먼저 final owner를 문서에 고정한다.
2. 다음으로 새 owner seam을 코드에 연결한다.
3. 같은 변경 또는 바로 다음 변경에서 대체된 legacy owner path를 삭제한다.
4. 삭제가 끝난 seam은 CI guard로 다시 봉인한다.
5. "일단 공존" 상태를 장기화하지 않는다.

금지 패턴:

- orchestrator와 dispatcher가 동시에 injection owner인 상태 유지
- target architecture 문서 없이 임시 fallback을 늘리는 것
- legacy seam을 "compat" 이름으로 오래 남기는 것
- 새 상태 머신을 만들고 테스트/문서/CI를 같이 갱신하지 않는 것

## Required Migration Loop

반복 작업은 항상 아래 순서를 따른다.

1. target architecture 갭을 문서 기준으로 명시한다.
2. 한 owner seam만 선택해서 최종형으로 수렴시킨다.
3. 해당 seam의 legacy path를 같은 흐름에서 제거한다.
4. 테스트를 추가해 old behavior revival을 막는다.
5. CI guard 또는 ownership check를 추가한다.
6. 다음 seam으로 넘어간다.

이 순서를 건너뛰고 helper만 늘리는 refactor는 완료로 간주하지 않는다.

## Current Gaps To Close

2026-03-23 기준 남은 핵심 갭은 아래와 같다.

- 현재 owner map 기준 핵심 구조 gap은 없다.
- 후속 작업이 필요하더라도 feature-specific hardening 또는 perf 개선이어야 하며, injection/bootstrap owner migration 자체는 완료로 본다.

## Operational Proof After Migration

owner migration이 끝난 뒤의 표준 작업은 새로운 seam 추가가 아니라, 현재 구조를 실제 브라우저 조건에 가깝게 증명하고 관찰 가능하게 만드는 것이다.

필수 운영 hardening:

1. browser-like contract test가 `inject -> receiver_ready -> dispatch -> receiver_missing -> stale -> reinject` 복구 경로를 검증해야 한다.
2. background는 bounded in-memory diagnostics ring buffer를 유지해 recent bootstrap/dispatch/teardown events를 남겨야 한다.
3. startup/open-tab catch-up diagnostics는 requested/attempted/failure counts를 함께 남겨야 한다.
4. diagnostics surface는 trusted extension page support action으로만 노출한다.
5. active loader 재주입과 teardown/rebootstrap 뒤 runtime/storage listener cardinality가 원래 active cardinality로 돌아와야 한다.
6. service-worker target 재생성 뒤 open-tab catch-up은 같은 build의 live document를 `CONTENT_RUNTIME_PROBE` + exact document proof로 재결합하고 loader를 다시 실행하지 않아야 한다. build mismatch 또는 receiver 부재에서는 실제 injection 뒤 `loader_reinjected` 공표로 복구해야 한다.
7. SPA history navigation은 document id와 content lifecycle event count를 보존하고 navigation continuity만 갱신해야 한다.
8. 실제 Chromium 증명은 `docs/operations/qa/mv3-lifecycle-e2e.md`와 `scripts/e2e/mv3LifecycleE2E.mjs`를 따른다.
9. 이 단계는 owner map 변경이 아니므로, 새 owner/seam refactor보다 우선순위가 높다.
10. delayed attempt를 취소한 뒤 newer attempt가 active가 된 경우, delayed resolve/reject와 publish timeout은 local loader/bootstrap state 및 background session을 변경하지 않아야 한다.
11. protection catch-up은 sender validation 전 session mutation, profile-generation interleaving,
    original-document rebinding, timeout만으로 FIFO/profile lease를 조기 해제하는 overlap을 허용하지
    않아야 한다. downstream hard cancellation이 생기기 전까지 timeout은 pending owner settlement를
    명시적으로 진단하는 fail-closed contract다.
12. worker-revival injection timestamp는 기존 live loader의 attempt timestamp를 덮지 않아야 하며,
    committed navigation/remove/replace는 init 또는 profile admission이 닫히거나 정지해 있어도 event
    ingress에서 pending catch-up을 먼저 invalidate/evict해야 한다.

## Done Criteria

아래가 모두 참이면 이 문서 기준 migration 완료다.

1. active code에서 `executeScript` 호출이 orchestrator 밖에 없다.
2. `ManagedContentScriptSync`는 registration/catch-up target 계산만 담당한다.
3. session registry가 document-scoped identity를 사용한다.
4. dispatcher는 exact document identity가 있는 dispatch-ready `receiver_ready` 또는 `active` current
   session에만 dispatch하며, catch-up trigger는 위의 typed handshake로 제한한다.
5. bootstrap state가 `receiver_ready`와 `active`를 분리한다.
6. permission shrink와 navigation이 explicit teardown contract로 연결된다.
7. 문서, 테스트, CI guard에서 legacy owner가 다시 허용되지 않는다.
8. teardown 이후 non-critical sidecar가 duplicate install 없이 deterministic하게 유지되거나 재개된다.
9. loader, content bootstrap state, background registry가 동일 attempt identity로 conditional commit한다.
