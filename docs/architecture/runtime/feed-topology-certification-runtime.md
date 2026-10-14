# Feed Topology Certification Runtime

- Status: Active
- Owner: Content feed topology + background topology certification
- Last validated against code: 2026-09-12
- Path policy: current-only
- Canonical for: structure readiness, shipped topology authority, local certification, persistence and bounded live proof.

The Enso time-policy cutover preserves these structural safety contracts. This document extracts the still-active topology sections from the previous feed architecture; consumption score, dose and tempo policies are outside its scope. [Feed Flow Runtime Target Architecture](feed-flow-runtime-target-architecture.md) owns cadence, content boundaries and episode lifecycle. Structural readiness never creates time eligibility or a content boundary.

## Canonical owner table

Feed paths below are under `src/domains/nudge/feed-flow/` unless fully qualified.

| Concern | Canonical owner | Authority and limit |
| --- | --- | --- |
| Bounded structural observations | `learning/FeedStructureLearner.js` | Session-only readiness and volatility; no content, policy or DOM write |
| Shared topology shape | `src/domains/protection/contracts/feedTopologyAuthorityContract.js` | Exact state/source/version invariant |
| Topology selection | `topology/FeedTopologyRecoveryProtocol.js` | Canonical tuple, live health, certificate and epoch; no DOM query or write |
| Shipped topology declarations | `actuation/feedEndpointAdapterCatalog.js` | Supported lane/scroller/containment and adapter identity |
| Current shipped health | `actuation/FeedShippedTopologyProbe.js`, `actuation/feedEndpointTopologyInspection.js` | Bounded read-only tuple inspection; final resolver shares the same seam |
| Independent continuous reference acquisition | `discovery/FeedContinuousReferenceDiscovery.js`, `confirm/FeedAdvanceCoordinator.js` | Visible same-scroller semantic item and complete local structural proof; no authority or mode promotion |
| Local descriptor | `topology/FeedLocalTopologyProbe.js`, `topology/feedTopologyCertificationContracts.js` | Content-free descriptor and exact fingerprint; no certificate issuance |
| Live proof and document lifecycle | `topology/FeedTopologyCertificationRuntime.js`, `topology/FeedTopologyPersistenceClient.js` | Generation fences, bounded corroboration/invalidation and fresh proof |
| Durable certification | `topology/FeedTopologyPersistentCertificationService.js`, `topology/feedTopologyCertificateModel.js` | Trusted facts, multi-session/day evidence, expiry and epoch-aware CAS |
| Typed persistence | `src/platform/storage/model/FeedTopologyCertificateCheckpointContract.js`, `src/platform/storage/model/FeedTopologyCertificateCheckpointRepository.js` | `model_state` entry `feed_topology_certificate_checkpoint_v1`; strict restore |
| Top-frame message boundary | `src/apps/background/services/runtime/messageRoutes/feedTopologyCertificateMessageRoutes.js` | Sender/document and profile-generation validation |
| Final placement and sole site-feed writer | `actuation/FeedEndpointBoundaryResolver.js`, `terminus/FeedEndpointLease.js` | Exact live plan validation then transactional DOM ownership |

## Structure learning

`FeedStructureLearner`는 surface classification, supply step/demand, dominant
transition, virtual turnover, container reset/stability만 저장한다. 표본은 최대
48개의 session-local rolling window이며 페이지 콘텐츠는 저장하지 않는다.

출력:

- `pending`
- `warming`
- `ready`
- `volatile`
- `invalid`

known profile은 더 적은 표본으로 warm-up할 수 있지만, 동적 corroboration 기준은
unknown profile과 동일하다. 컨테이너 안정성은 progression anchor를 소유하는
`continuous`/`hybrid`에서 readiness 조건이다. `paged`는 corroborated dominant
transition이 progression anchor이므로 보조 scroll container handoff를 계속 기록하되
그 교체만으로 `paged_hold`를 veto하지 않는다.

generic profile은 warming 동안 약 1.5초 간격으로 surface를 다시 분류하며,
`ready` 이후에도 약 10초 간격의 `post-ready validation`을 계속한다. route,
effective surface mode, surface profile signature 중 하나가 바뀌면 기존 학습 표본과
관측 상태, 미예약 opportunity를 재사용하지 않고 neutral observation부터 다시 시작한다.
container root 교체는 observation의 `containerReset`으로 기록한다. anchor-owning
`continuous`/`hybrid`에서는 반복될 때 learner의 변동성 판단으로 수렴시킨다. 단 한
번의 bounded container handoff는 교체율 분모가 작다는 이유만으로 `ready`를 해제하지
않으며, 두 번 이상 반복된 reset부터 readiness 불안정성 증거가 된다. 단, 그 뒤 세
번의 연속 container-stable 표본이 쌓이면 startup handoff가 현재 구조 불안정성으로
영구 잔류하지 않도록 readiness를 회복한다. `paged`에서는 dominant-transition
corroboration이 별도 progression anchor이므로 container reset은 진단 통계로만 남는다.

## Topology recovery and certification

`feedTopologyAuthorityContract`가 state/source/version invariant의 SSOT이고,
`FeedTopologyRecoveryProtocol`은 structure learner의 readiness를 endpoint permission으로
직접 해석하지 않는다. shipped exact tuple과 현재 document의 live shipped-topology
health가 `resolved`이면 `canonical_verified`를 즉시 발행하고, dynamic learner는
startup을 막지 않는 shadow validation으로 계속 돈다. live health가
`pending`/`unavailable`이면 learner가 ready여도 `canonical_learning`에 머문다.
live mismatch 또는 learner의 mode/volatility 불일치는 `drift_suspected`, invalid
evidence는 `quarantined`다. generic ready 자체도 작동 가능으로 승격하지 않고
`shadow_learning`에 머문다.

`FeedShippedTopologyProbe`는 현재 content-local anchor가 shipped candidate selector와
catalog-declared lane/scroller/containment tuple을 여전히 만족하는지만 읽는다. declared
tuple 해석은 `feedEndpointTopologyInspection` 한 seam을 early health probe와 final
`FeedEndpointBoundaryResolver`가 공유한다. probe는 replacement selector를 만들거나 DOM을
쓰지 않는다. live mismatch가 확인되면 shipped authority는 즉시 `drift_suspected`로
fail closed한다. 동일 hostname/profile/semantic surface에 이미 발급된 durable local
certificate와 현재 generic structural fingerprint가 모두 맞을 때만
`locally_certified`로 회복하며, shipped tuple이 다시 resolved되면 shipped profile이
우선권을 되찾는다. local certificate는 shipped catalog를 수정하거나 덮어쓰지 않는다.
catalog가 exact endpoint topology를 선언한 surface의 early probe는 local anchor에서
공유 tuple을 직접 검증하며 document-wide candidate enumeration을 수행하지 않는다.
actual continuous scroll에서 shipped selector로 reference를 얻지 못하면
`FeedContinuousReferenceDiscovery`가 현재 scroller의 visible 영역을 3×3 hit-test하고,
각 point의 최상위 paint hit에서만 HTML article/listitem boundary의 ancestry를 최대
8단계 읽는다. SVG hit는 같은 tree의 HTML owner로 올라가며, scroller 밖의 top hit나
nav/aside/header/footer와 navigation/complementary/dialog/menu region이 덮은 point는
버린다. arbitrary overlay 아래의 paint hit도 visibility 증거로 사용하지 않는다.
가려지지 않은 다른 point는 독립적으로 검사하며 최대 9개의 reference만 획득한다.
각 semantic reference는 동일
`FeedLocalTopologyProbe`의 repeated lane와 future-branch qualification을 통과해야 하고,
future branch 수와 purity는 같은 lane의 다른 item에 재사용하지 않고 reference별로
다시 확인한다.
서로 다른 lane이 경쟁하면 pending이다. hit-test API가 없거나 scroller가 보이지 않으면
explicit unavailable result로 비개입을 유지하며, 현재 hit-test와 structural proof가 다시
resolved될 때만 이 상태를 벗어난다. 이 content-local acquisition은 selector를 바꾸거나
pending을 mismatch로 덮지 않는다. 획득된 실제 reference를 shipped health probe가 다시
검사하고, 확인된 mismatch와 기존 durable certificate 및 fresh live proof가 모두 있어야
local authority를 사용할 수 있다. known-site mode 자동 재분류는 이 seam의 범위가 아니다.
selector-only shipped adapter만 repeated-lane 판단을 위해 bounded outermost candidate
collection을 사용한다. declared tuple에 scroll-snap axis/alignment 조건이 있을 때만
computed style을 읽으며, 해당 조건이 없는 continuous topology는 style/layout flush를
유발하지 않는다.
shipped health probe는 advance/supply/lifecycle 같은 authority 갱신 이벤트에서만 실행한다.
debugger와 statistics의 read-only state snapshot 및 content-local actuation-context read는
마지막 decision에 실린 authority를 그대로 읽으며, polling 자체가 새 DOM query나
topology epoch를 만들지 않는다. endpoint commit은 final resolver의 exact tuple 검증을
그대로 거친다. 동일 surface signature, reference anchor, active scroller에서 반복되는
supply authority 갱신은 shipped health를 최대 750ms만 공유한다. 이 셋 중 하나가 바뀌면
cadence와 무관하게 즉시 다시 probe하며, 이 bounded cache는 replacement topology나
certificate source로 사용하지 않는다.

이 protocol은 DOM을 읽거나 쓰지 않는다. classifier와 discovery도
`genericFeedItemFeatures`가 만든 동일 read-only 사실만 소비하고 서로의 threshold나
state를 갱신하지 않는다. endpoint resolver는 protocol이 선택한 adapter identity를
catalog와 최종 대조할 뿐 별도 adapter authority를 만들지 않는다. lease는 plan의
contract version, state/source, topology epoch를 모두 검증한 뒤에만 유일한 site-feed
DOM writer가 된다.

generic topology의 승격은 별도 pipeline이다. `FeedLocalTopologyProbe`는 현재 anchor와
candidate selector를 입력으로 direct sibling lane, one-candidate-per-branch,
scroller kind, block/flex-column layout, vertical snap contract와 future-branch purity를
읽기만 한다. candidate discovery는 document 순서의 첫 320개를 선택하지 않고 현재
reference의 ancestor lane에서 reference와 동일한 candidate depth까지만 읽는다.
모든 ancestor 시도와 nonmatching element를 합쳐 최대 320개의 element visit만 허용하고
현재 active scroller 밖의 lane은 검사하지 않는다. local result의 `discovery`는
complete/truncated, visit count와 visit-limit reason을 명시하며, truncated result는
pending이고 일부 future branch만 읽은 상태로 certificate나 actuation proof를 발행하지
않는다. lane을 완전히 검사한 뒤에만 기존 one-candidate/future-branch purity 조건을
적용한다. 저장되는 것은 이 사실을 enum과 depth로 축약한
`feed_local_topology_descriptor_v1`와 그 exact fingerprint뿐이다. DOM node, selector,
class, text, path는 content boundary를 넘지 않는다.

`FeedTopologyCertificationRuntime`은 같은 document session에서 최소 750ms 간격의
fingerprint가 세 번 연속 일치하고 learner의 durable fact 표본 기준도 충족한 뒤
surface/outcome/fingerprint별 corroboration fact 하나만 보낸다. known profile의 session
readiness가 먼저 충족되어도 durable fact 기준 전에는 live proof만 축적한다.
10초 동안 새 live sample이 없으면 연속 proof는 만료되어 다시 세
표본을 요구한다. 세 표본을 만든 뒤에는 certified topology는 2.5초, 아직 shadow인
제출 완료 topology는 10초 validation cadence로 낮춰 hot path DOM scan을 제한한다.
이 runtime은 unknown/generic뿐 아니라 allowlisted known surface에도 동일한 class-independent
probe를 shadow로 실행해 shipped DOM 변경 전에 local baseline을 준비한다. shipped
candidate selector는 이 학습 입력으로 전파하지 않는다. unknown/generic surface와
exact shipped surface 모두 초기 live proof 3표본은 최소 750ms 간격으로 관찰한다.
proof가 실제로 만료되거나 lifecycle reset으로 지워지면 제출 완료 여부와 무관하게
같은 초기 cadence로 다시 축적한다. restored certified backup도 fresh live proof를 위해
750ms 초기 3표본과 2.5초 certified cadence를 유지한다. background
`FeedTopologyPersistentCertificationService`는 current profile epoch 아래 서로 다른
observation ID 세 개, 서로 다른 UTC day 두 개, decay 후 effective evidence 2.4 이상을
만족해야 certificate를 발행한다. evidence half-life는 14일, certificate TTL은
마지막 corroboration부터 30일이다. fingerprint drift는 이전 evidence를 섞지 않고 새
learning revision으로 회전하며 learner `volatile/invalid`는 explicit invalidation을
commit한다. CAS retry는 strict current checkpoint를 다시 읽는 최대 네 번의
epoch-fenced update다.

복원된 certificate만으로는 `locally_certified`가 되지 않는다. 현재 document에서
동일 fingerprint가 다시 세 번 안정화되고, actuation 직전에 probe가 exact lane/scroller/
branch ownership을 한 번 더 확인해야 한다. tab hide는 live proof를 지우고, reload/route
change/stop은 content generation을 fence한다. certificate expiry, persistence failure,
live mismatch, learner drift 중 하나라도 있으면 `shadow_learning` 또는 fail-closed
비개입으로 돌아간다. server/network lookup과 session-memory certificate fallback은 없다.

local certification, actuation 직전 재검증, shipped health probe의 비용은 debug flag가 켜진
경우에만 `FeedFlowDiagnosticLedger`의 content-free `topology_probe` event로 측정한다.
phase/status/surface mode, 후보·future-branch 개수, duration만 bounded trace/counter에
남기며 selector, DOM node, hostname, text/path는 기록하지 않는다.
독립 reference acquisition도 같은 ledger의 `local_reference_acquisition` phase로
status와 duration을 기록하며 실패 이유와 completeness는 content-local result에 남는다.

## Verification

`check:friction-runtime:architecture` retains topology owner/import, probe purity, checkpoint, CAS, message and live-proof checks. Focused contracts live in `tests/feedTopologyRecoveryProtocol.test.js`, `tests/feedTopologyLocalCertification.test.js`, `tests/feedActuationSafetyJudge.test.js` and endpoint tests. Persisted shape and backend ownership are also specified by [Storage Architecture Target](../storage/storage-architecture-target.md).
