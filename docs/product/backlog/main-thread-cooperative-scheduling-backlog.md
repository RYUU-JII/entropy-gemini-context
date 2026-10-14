# Main-Thread Cooperative Scheduling Runtime

- Status: Active
- Owner: runtime performance / platform scheduling
- Last validated against code: 2026-08-18
- Path policy: current-only
- Canonical for: main-thread cooperative continuation ownership, slice budget, first-consumer rollout, and expansion gates

## Status Notice

- 현재 상태: `ACTIVE (Social Metrics collection rollout 포함)`
- 반복 가능한 페이지 진입/스크롤 관성 체감 끊김을 근거로 좁은 1차 runtime을
  채택했다.
- Web Worker/OffscreenCanvas, `requestIdleCallback`, `requestAnimationFrame`,
  owner-local chunk budget, coalescing 등 현재 최적화 계약은 그대로 유지한다.
- Chromium/Whale public minimum은 Chrome 129로 상향되어
  `scheduler.yield()` capability floor를 충족한다.
- `src/platform/scheduling/mainThreadCooperativeScheduler.js`가
  `scheduler.yield()`와 3ms cooperative slice deadline을 단독 소유한다.
- 현재 consumer는 protection effect owner sequencing, Visual 초기 media
  reconciliation, Visual/Text mutation ingress, Social Metrics candidate
  collection이다. Scroll physics rAF에는 yield/await를 넣지 않는다.
- canonical `youtube:shorts` paged surface는 연속 관성 물리에서 분리했다. 짧은
  의도 누적 뒤 viewport 한 칸을 한 번만 commit하며, 일반 continuous surface만
  Frosted Stone rAF 물리를 사용한다. dev contention ledger는 이를
  `scrollPagedIntent` input/commit으로 계측하며 Shorts QA는 physics frame이 0인
  상태를 별도 계약으로 검증한다.
- `scheduler.postTask()`는 아직 도입하지 않는다.

## 배경

Entropy는 무거운 Zen/Pond/Bonsai 렌더링을 Worker와 OffscreenCanvas로
격리하고, DOM을 직접 다뤄야 하는 Text Shuffle과 Social Metrics 작업은 idle
admission, 3ms work slice, count-bounded cursor, mutation coalescing으로 나눠
처리한다. 개발 런타임은 `PerformanceObserver`와 runtime contention ledger로
Long Task 및 owner별 작업 시간을 관찰한다.

이 기준선 위에서 Prioritized Task Scheduling API를 전역 교체 수단이 아니라
좁은 owner seam으로 채택했다. 페이지 진입 시 protection owner들이 연속으로
적용되고 Visual 초기 media reconciliation이 한 작업에서 수행되면서 일반
스크롤과 관성 스크롤의 frame 기회를 함께 압박하는 경로가 1차 대상이다.

현재 runtime은 protection owner 사이에서 제어권을 반환하고, Visual의 초기 및
mutation candidate filtering/materialization/DOM write, Text mutation ingress,
Social Metrics의 root별 selector query, 64-node candidate filter, YouTube semantic
scope query 및 candidate union/provenance materialization을 3ms budget으로
분할한다. ObserverHub subscriber는
mutation payload를 latest-only queue에 합친 뒤 즉시 반환한다. 브라우저 selector
engine의 단일 `querySelectorAll()` 호출은 분할할 수 없으므로 호출 자체는 여전히
하나의 원자적 단위다. Social Metrics의 기존 idle-admitted 3ms candidate apply
slice와 48ms cleanup deadline은 그대로 유지한다.

## Rollout 범위와 후속 작업

### 1. 실제 blocking owner 측정

- YouTube 기준선 run `20260817142818156-site-feed-runtime-eae11472`,
  `20260817143641382-site-youtube-watch-runtime-558b49e8`,
  `20260817144853947-site-youtube-watch-runtime-8e5d1f7f`에서 Social Metrics
  `candidate_collection` 최대 span이 각각 19.6ms, 11.7ms, 18.9ms로 관찰됐다.
  새 runtime은 phase별 duration/units와 candidate 수를 같은 contention session에
  기록한다.
- Text Shuffle subtree traversal, Worker 결과 materialization, Dashboard 탭 진입
  projection이 Long Task에 기여하는지 owner ledger와 함께 확인한다.
- 단일 작업이 반복적으로 8-16ms 이상이거나 50ms Long Task에 포함될 때만
  scheduler 실험 대상으로 올린다.

### 2. `scheduler.yield()` 제한 도입

- production consumer는 protection effect owner sequencing, Visual 초기 media
  reconciliation과 Visual/Text mutation ingress, Social Metrics candidate
  collection이다.
- Social Metrics는 단순히 호출 전후에 `yield()`를 붙이지 않고 root/semantic
  scope/candidate-batch 단위의 incremental collector로 바꾼 뒤 3ms 예산 경계에서
  yield한다.
- 기존 selector, semantic recovery, exact target identity, cleanup 결과는
  scheduler 유무와 관계없이 동일해야 한다.
- Text Shuffle의 기존 `requestIdleCallback` 3ms apply queue는 유지한다. 새
  cooperative ingress는 removed-subtree ownership 정리와 revalidation/enqueue를
  ObserverHub callback 밖으로 옮기는 앞단이며 기존 apply queue를 대체하지 않는다.

### 3. `scheduler.postTask()` 적용성 검토

- 입력 직후 필요한 최소 UI 후속 작업은 `user-visible` 또는 매우 제한적인
  `user-blocking` 후보로 평가한다.
- 취소 가능한 비필수 준비 작업은 `background`와 기존
  `requestIdleCallback` 중 어느 계약이 더 맞는지 비교한다.
- Dashboard lazy boot, artifact preload, settings secondary preload처럼
  "idle일 때만 시작"이 중요한 작업을 일괄적으로 `postTask()`로 바꾸지 않는다.

### 4. 플랫폼 지원 및 소유권 결정

- Chromium/Whale은 public minimum Chrome 129 계약을 사용한다.
- Firefox/Safari seed는 Chromium manifest floor를 제거하므로, shared runtime에
  도입하기 전에 각 target의 명시적 scheduling support 계약을 결정한다.
- 도입 시 feature 코드마다 선택적 호출을 흩뿌리지 않고 platform scheduling
  owner와 named API를 먼저 둔다.
- target support 계약 변경은 관련 Active 문서, manifest contract, CI를 같은
  변경에서 갱신한다.
- silent fallback이나 입력 경계 밖의 임시 scheduler 대체 경로는 추가하지 않는다.

### 5. 전후 검증

- Long Task count/total/max와 owner별 최대 slice 시간을 비교한다.
- scroll/click 반응, visible effect parity, scan completion latency를 함께 본다.
- scheduler 전환 비용 때문에 전체 완료 시간이 과도하게 늘거나 작업이
  starvation되면 채택하지 않는다.
- 실제 사이트 QA에서는 selector recovery 결과와 disable cleanup/re-enable
  동작이 변하지 않아야 한다.

## 현재 결론

- `scheduler.yield()`: 측정된 동기식 main-thread collection/materialization
  병목이 있을 때 가장 먼저 실험할 후보다.
- `scheduler.postTask()`: 명시적 priority와 cancellation이 필요한 owner 작업에만
  제한적으로 검토한다.
- `navigator.scheduling.isInputPending()`: 조건부 yielding의 기준으로 채택하지
  않는다. 입력 외에도 paint/layout/다른 task를 위해 정기적으로 제어권을
  반환해야 하며, 현재 최적화 후보가 아니다.
- Worker/OffscreenCanvas 렌더링은 이 backlog의 대체 대상이 아니다.

## 실행 계획과 현재 상태

아래는 채택된 최소 변경 단위와 현재 진행 상태다. 확장 단계는 앞 단계의 증거와
계약을 충족해야 다음 단계로 넘어간다.

### Change set 0 — 병목 기준선과 비동기 실패 소유권 고정 (완료)

- `candidate_collection`을 최소 `selector_query`, `candidate_filter`,
  `semantic_query`, `union_materialization`으로 나눠 content-free duration과 units를
  기록한다. `querySelectorAll()` 자체와 그 뒤의 JavaScript filtering 비용을 같은
  숫자로 뭉개지 않는다.
- 대형 DOM real-site repeat에서 owner slice, Long Task, wheel/input 반응,
  candidate 수, visible effect 수, 전체 scan completion latency를 같은 run id로
  묶어 기준선을 만든다.
- `update`/`direct`는 scan drain Promise를 lifecycle owner에 반환하고 async
  collection failure를 rollback/reject한다. Mutation scan failure는 diagnostics에
  settle하며 처리되지 않은 rejected Promise를 만들지 않는다.
- 위 YouTube 기준선에서 8-16ms를 넘는 collection span이 반복되어 Change set 2의
  Social Metrics rollout 조건을 충족했다.

### Change set 1 — 좁은 platform scheduling seam (완료)

- 계획 경로는 `src/platform/scheduling/mainThreadCooperativeScheduler.js`다.
- 첫 public API는 continuation을 반환하는 `yieldMainThreadContinuation()` 하나로
  제한한다. 구현은 Chromium/Whale Chrome 129 floor 위에서
  `globalThis.scheduler.yield()`를 직접 소유한다.
- capability가 계약과 달리 없으면 named runtime error로 fail-loud한다.
  `setTimeout(0)`, `requestIdleCallback`, Promise microtask를 scheduler fallback으로
  숨기지 않고 polyfill dependency도 추가하지 않는다.
- feature owner는 global `scheduler`를 직접 읽지 않는다. Platform unit test가
  continuation ordering, rejection 전달, capability mismatch를 고정한다.
- Firefox/Safari artifact는 별도 support decision 전까지 이 seam을 import하지
  않는다. 공용 runtime에 optional call을 퍼뜨리지 않는다.

### Change set 2 — cooperative consumer rollout (완료)

- 1차 consumer는 `ProtectionStateApplier`의 owner sequencing과
  `VisualManager.updateCooperatively()`가 소유한 초기 media reconciliation이다.
  Visual은 selector result의 JavaScript filtering/materialization과 restore/apply
  writes를 3ms budget으로 나누고, exact update token이 달라지면 stale continuation을
  중단한다.
- Visual/Text의 shared-observer subscriber는 DOM 탐색·정리·write를 직접 수행하지
  않는다. `cooperativeMutationBatchQueue`가 연속 flush의 node/mutation identity를
  dedupe하고 최신 flush id를 유지한 뒤 scheduler continuation에서 owner 작업을
  실행한다. Visual은 cooperative media apply로 이어지고 Text는 local ownership
  revalidation 후 기존 idle apply queue로 이어진다.
- `src/domains/nudge/visual/socialMetrics/core/scanController.js`와
  `scanRuntimeBridge.js`가 candidate collection continuation을 소유한다. 기존 3ms
  candidate **apply** slice, 48ms cleanup deadline, idle admission은 그대로 둔다.
- 상태를 `queued -> collecting -> applying -> terminal_cleanup -> settled`로
  명시하고, collection cursor와 dedupe set은 scan runtime closure만 소유한다.
- root별 selector query, 64-node candidate filter, YouTube semantic scope cursor
  step, candidate discovery/provenance batch, union materialization처럼 결과 순서와
  exact node identity를 보존할 수 있는 경계에서 3ms budget을 확인한 뒤
  `yieldMainThreadContinuation()`을 호출한다.
- semantic adapter의 직접 계약은 fallback 없는 `scopes + createScopeCursor(scope)`다.
  Runtime은 `cursor.next()` 한 번만 하나의 `semantic_query` unit으로 실행하고 같은
  scope의 다음 step을 다른 scope보다 먼저 재삽입한다. YouTube cursor는 기존 facet
  순서를 유지하며 watch link와 text 후보를 8개 단위로 나눈다. 동기 수집 API도 같은
  cursor를 끝까지 구동해 협력 경로와 별도 알고리즘을 두지 않는다.
- 하나의 full-document `querySelectorAll()`이 병목이면 호출 전후 yield만으로는
  해결됐다고 보지 않는다. 그 경우에만 bounded `TreeWalker` + `Element.matches()`
  실험을 별도 patch로 만들고 selector syntax failure, `:scope`, root 포함 규칙,
  document order, 중첩 root dedupe의 결과 동일성을 먼저 증명한다. 총 작업량이
  악화되면 채택하지 않는다.
- selector 결과, semantic recovery, provenance, exact target identity와 cleanup
  결과는 scheduler 전후 완전히 같아야 한다. Deep audit는 product collection과
  별도 비용으로 남긴다.

### Change set 3 — cancellation, supersession, failure settlement (완료)

- protection runtime과 Visual update는 증가하는 epoch/token을 소유한다. clear,
  newer update, navigation/configuration supersession은 token을 무효화한다.
- 모든 `await scheduler.yield()` 직후 exact epoch와 scan context를 재검증한 뒤에만
  DOM read/write 또는 진단 기록을 계속한다. 낡은 continuation은 새 scan의 queue,
  candidates, cleanup ownership을 건드리지 않고 `cancelled`로 한 번만 settle한다.
- Visual/Text observer ingress는 release, disable, config supersession에서 generation을
  무효화하고 pending node/mutation identity를 버린다. scheduler 또는 consumer 실패는
  각 feature diagnostics에 기록하며 timer/microtask fallback으로 성공을 합성하지
  않는다.
- collection 중 cancel은 아직 apply되지 않은 후보에 cleanup을 합성하지 않는다.
  apply가 시작된 뒤의 cancel/failure만 현재 exact pending cleanup owner를 기존
  계약대로 flush하며, 실패한 cleanup의 retry ownership도 유지한다.
- 단위 테스트는 cancel-before-yield, cancel-after-yield, disable/re-enable,
  queued full-scan dominance, selector failure, semantic failure, cleanup failure,
  stale continuation을 포함한다.

### 2026-08-18 bounded real-site evidence

- YouTube Shorts combined-contention run
  `20260817184240026-site-feed-runtime-d3ff6cdd`는 diagnostic/release 각 3회와
  extension-disabled control 3회를 같은 trusted seven-wheel action contract로
  실행했다. 제품 lane에는 extension runtime error와 FAIL contract가 없었고,
  control은 3/3 PASS였다. 상위 결과 `INCONCLUSIVE`은 Google Video의 403/DNS
  page-network warning과 재활성화 직후의 bounded media dimension recheck 1건에서
  왔다. 해당 recheck는 disable cleanup에서 0으로 해제되고 반복 polling을 만들지
  않는다.
- 세 diagnostic repeat 모두 paged-scroll intent 7회, snap commit 7회, physics
  frame 0회를 PASS로 증명했다. `scrollPagedIntent` 총 owner span은 repeat별
  1.5–1.9ms, 단일 `snap_commit` 최대는 0.4ms였다. Shorts의 큰 renderer hitch와
  겹친 owner work는 0.1–2.8ms였고 owner style/layout phase overlap과 extension
  forced-style/layout duration은 모두 0ms였다. 따라서 현재 Shorts의 50ms 이상
  frame은 extension paged-scroll actuation이 주원인이라는 증거가 없으며, release
  renderer total도 각 repeat에서 대응 control보다 낮았다. 이 차이는 live-site
  variance를 포함하므로 자동 성능 우위로 승격하지 않는다.
- 같은 run에서 `observerHub` mutation flush 단일 최대는 3.1ms, Text ingress는
  3.1ms, Visual media operation은 2.7ms였다. 추가 scheduler consumer를 열 조건인
  반복 8ms 초과 owner unit은 관찰되지 않았다.
- YouTube Watch exact named-target run
  `20260818011714957-site-youtube-watch-runtime-c3ad2567`은 diagnostic/release 각
  3회와 extension-disabled control 3회를 실행했다. control은 3/3 PASS였고 모든
  product effect apply/disable/re-enable 및 final pending-queue settle 계약도 PASS였다.
  상위 결과 `INCONCLUSIVE`은 모든 lane에서 관찰된 Google Video 403/DNS page-network
  error와 diagnostic 최종 re-enable snapshot의 `terminal_effect_ambiguous`에서 왔다.
  후자는 active-stimulus phase의 측정 가능성과 counter conservation을 무효화하지
  않지만 final snapshot 기반 scanner 계약을 WARN으로 남긴다.
- 세 diagnostic action은 owner timeline 295/411/318개를 전부 보존했고 dropped owner
  work와 Long Task는 0이었다. Social Metrics fine phase를 합치면
  `selector_query` 152회(p95 0.2ms, max 1.5ms), `semantic_query` 537회(p95 0.7ms,
  max 2.9ms), `candidate_discovery` 24회(p95 0.5ms, max 0.9ms)였다.
  나머지 measured collection phase 최대는 0.3ms 이하였고 8ms 초과 fine phase는
  0건이었다. `scan_chunk`도 47회, p95 3.1ms, max 3.2ms였다. 이전 bounded run의
  단일 `semantic_query` 16ms spike는 broad-root decomposition과 semantic cursor
  batching 후 재현되지 않았다.
- diagnostic renderer task median은 1521.16ms, release는 1780.56ms, control은
  2458.73ms였다. 이는 live-site variance가 큰 informational comparison이므로 자동
  성능 우위로 승격하지 않는다. diagnostic의 action-window owner overlap은
  32.1-46.6ms였지만 owner style/layout phase overlap과 extension forced-style/layout은
  세 repeat 모두 0ms였다. 현재 증거상 Social Metrics를 더 잘게 나눌 기준인 반복
  8ms 초과 owner unit은 없으며, 다음 작업은 scheduler 확대가 아니라 final
  re-enable targeting-health ambiguity의 QA 계약을 별도로 좁히는 것이다.
- 후속 exact named-target run
  `20260818014647903-site-youtube-watch-runtime-fd69f797`은 같은 Watch/Social 인자로
  diagnostic, release, extension-disabled control을 각각 3회 실행해 전부 PASS했다.
  diagnostic의 active, disable, re-enable, final snapshot은 세 repeat 모두 정확한
  `target_resolved_effect_applied -> feature_inactive ->
  target_resolved_effect_applied` 전이를 보였고, 최종 operation count는 14/13/11,
  pending queue는 모두 0이었다. 이전 `terminal_effect_ambiguous`는 YouTube metadata
  row reconciliation의 실제 쓰기 대상을 의미 없는 post-chunk write로만 세던 계약
  불일치였다. 어댑터가 apply/clear 의미를 선언하고 owned-mutation runtime이 선언
  대상과 실제 쓰기 대상의 동일성을 증명한 경우에만 terminal target fold에 넣도록
  수정했다. 대상 불일치나 식별 실패는 계속 unclassified로 남아 fail-open하지 않는다.
- 같은 PASS run의 Social Metrics fine phase는 `semantic_query` 669회(p95 0.7ms,
  max 5.2ms), `selector_query` 183회(p95 0.2ms, max 5.2ms),
  `candidate_discovery` 31회(p95 0.4ms, max 0.6ms)였다. `scan_chunk`는 73회 중
  p95 3.2ms였지만 첫 diagnostic repeat의 mutation scan 한 건이 14.2ms였다.
  나머지 두 repeat 최대는 3.1ms와 5.2ms였으므로 즉시 slice budget을 다시 줄이는
  근거로 삼지 않고, 다음 Watch 반복에서 같은 flush/candidate 경로가 재현되는지
  확인한다. trusted-action diagnostic owner overlap median은 63.1ms였지만
  owner style/layout phase overlap과 extension forced-style/layout은 모두 0ms였다.

### Change set 4 — 비교 실험과 후속 rollout (대기)

- 동일 브라우저/profile과 fresh page target에서 baseline/experiment를 각각 최소
  10회 반복한다. candidate/effect/cleanup 결과 parity는 모든 유효 repeat에서
  exact match여야 한다.
- 채택 최소선은 scheduler owner의 cooperative slice max `<= 8ms`, 새 50ms Long
  Task 없음, primary scroll/input jank 지표 하나 이상 `20%` 개선이다. 전체 scan
  completion p95가 baseline보다 `15%` 넘게 악화되거나 starvation이 한 번이라도
  발생하면 채택하지 않는다.
- disable/restore/re-enable과 SPA navigation supersession을 별도 repeat로 검증한다.
  Runtime flag를 상시 이중 경로로 남기지 않으며, 비교 실험 종료 후 canonical
  implementation 하나만 유지한다.
- `scheduler.postTask()`는 이 rollout에 포함하지 않는다. yield 실험 후에도
  priority/cancellation owner가 필요한 별도 작업이 측정될 때 새 proposal로 연다.

## 계획된 검증 산출물

1. 플랫폼 seam unit contract와 Chrome capability floor contract.
2. collection order/dedupe/error/cancellation parity tests.
3. Runtime Debugger의 content-free phase/slice evidence.
4. canonical Browser QA repeat report와 baseline/experiment artifact identity.
5. 채택 시 Active runtime 문서, owner/function ledger, CI architecture guard의 같은
   변경 내 갱신.

이 runtime은 `Active`다. production의 protection/Visual 초기 적용, Visual/Text
mutation ingress, Social Metrics candidate collection은 cooperative cursor 경로를
사용한다.
friction-debug 측정 모드는 현재 기존 단일-operation attribution을 보존하기 위해
Visual 초기 reconciliation을 동기식으로 유지한다. Visual mutation operation은
scheduler 대기 시간을 active work duration에서 제외한다. Social Metrics는
`selector_query`, `candidate_filter`, `selector_probe`, `semantic_scope_discovery`,
`semantic_query` cursor step,
`union_materialization`, candidate discovery/provenance/finalize span을 별도로 남긴다.
남은 rollout 단계는 반복 비교 QA와 결과 parity 검증이다.

## 비목표

1. scheduler API를 모든 runtime에 전역 도입한다.
2. 모든 `requestIdleCallback`, `requestAnimationFrame`, `setTimeout`을 기계적으로
   교체한다.
3. 이미 Worker에 격리된 Zen 렌더링을 main-thread scheduler로 되돌린다.
4. selector 자가복구나 canonical targeting 계약을 성능 실험 때문에 완화한다.
5. 측정 없이 새로운 abstraction이나 polyfill dependency를 추가한다.

## 후속 확장 조건

다음 조건이 모두 충족될 때 추가 consumer를 연다.

1. 출시 후 실제 사이트에서 반복 가능한 main-thread 병목 증거가 있다.
2. 병목의 canonical owner와 분할 가능한 작업 단위가 확인됐다.
3. selector recovery 등 인접 기능 변경이 안정화됐다.
4. Chrome 지원 범위와 fallback-elimination 계약이 결정됐다.
5. 전후 비교에 사용할 Long Task, owner duration, 입력 반응, 결과 동일성 기준이
   준비됐다.

## 관련 문서와 코드

- `../../architecture/workers/worker-runtime-control-plane.md`
- `../../architecture/runtime/dom-targeting-runtime-architecture.md`
- `../../architecture/repository/social-metrics-seam-map.md`
- `../../../src/domains/nudge/visual/socialMetrics/core/scanController.js`
- `../../../src/domains/nudge/text/textShuffleMutationQueue.js`
- `../../../src/domains/nudge/runtime-debugger/contention/runtimeContentionLedger.dev.js`
- `../../../src/manifest.json`
