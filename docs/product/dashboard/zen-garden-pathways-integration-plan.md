# Zen 정원·길목 공통 작업면 통합 계획

- Status: Migration
- Owner: dashboard composition / Zen presentation / stats read models
- Last validated against code: 2026-10-10
- Path policy: planning-allowed
- Exit criteria: 공통 작업면 통합과 canonical 검증을 완료하고, 장부 디자인·경량 read model 후속 항목을 해당 소유 문서로 인계한다.
- Decision: 공통 프레임·지속되는 분재·내부 전환 방향을 채택했다. 실제 화면 검증으로 공간 비율을 조정한다.

## Why this proposal exists

Zen의 정원과 길목은 같은 사이트·정책·사용 기록을 서로 다른 깊이에서 다룬다. 그러나 현재는 연못과 장부가 별도 탭의 별도 화면으로 구성되어, 관리 화면으로 이동할 때 같은 세계를 들여다본다는 감각이 끊긴다. 장부의 빈 공간에 장식을 더하기보다 하나의 작업면에서 연못과 길목을 전환하고, 오른쪽 분재가 공간의 연속성을 지키도록 한다.

이번 계획의 우선 범위는 **공통 공간, 분재의 지속성, 전환, 로딩과 실행 수명**이다. 장부의 최종 정보량·서체·행 디자인·그래프·정책 편집의 세부 디자인은 그 공간이 성립하는 것을 확인한 다음 다룬다.

## Adoption progress — 2026-10-10

- 공통 Garden frame과 대상별 activity 분리를 먼저 적용했다. physical Worker와 render admission은 공유하고 Pond/Bonsai logical channel의 실행 수명만 분리한다.
- Zen main/sites를 같은 retained Main pane과 sidebar entry에 연결했다. canonical route·domain/add intent는 보존하고, 최초 Sites intent는 First Vision 이후 admission을 다시 확인해 인계한다.
- 최초의 축소 분재와 74%/26% 배치를 철회했다. 원래 `1.58/.96` 측정 비율과 투명 canopy 확장, `.58/.73` Home framing을 복원하고 식재점만 `.86→.90`으로 옮겼다. 장부는 stage 상단부터 그래프 상단까지, 우측 68% 분재 패널선까지 연못을 덮는다. 세로 topology는 유지한다.
- 상단 mode tabs와 normal-flow header를 제거했다. 연못·비중 그래프 사이의 공통 가장자리를 위로 당겨 장부를 펼치고, 열린 윗변을 아래로 당겨 걷는다. 클릭·Enter/Space·ArrowUp/Down, pointer capture·취소·reduced motion을 지원한다. 닫기 pointer-down에 실제 Pond frame을 준비하고 matching ACK 이후에만 종이 아래를 드러낸다. route commit은 release에서 처리한다.
- 비중 그래프는 두 모드에 남기고 hover/focus의 favicon에서 해당 Intel에 직행한다. 기존 popup과 readout geometry를 제거했다. Esc와 mouse Back은 내부 제어·Intel·장부·연못 순서로 한 단계씩 돌아간다. 최초 입장 이후 Sites DOM은 보존하지만 닫혀 있을 때 query/runtime을 park한다.
- Sites route adapter에서 app-owned workspace를 분리했다. 장부 preload는 snapshot만 요청하고, 기억한 선택과 실제 notebook 상세 수요 및 target widget readiness를 분리했다. 계속 보이는 분재를 감안해 Tools speculative GPU warmup을 막는다.
- 구조·수명·데이터 수요의 focused tests와 canonical capture/journey로 검증한다. 장부 최종 디자인, cap 전용 subview, 경량 목록 read model, 동일 조건 성능 비교는 다음 단계로 남는다.

## Current state

아래는 통합 전 기준선에서 확인한 사실이다. 현재 구현은 위 진행 현황과 Active owner 문서를 따른다. 성능 순위나 개선 수치는 아직 측정하지 않았다.

| 현재 소유자 | 확인한 동작 | 통합에 주는 제약 |
| --- | --- | --- |
| [MainPanel](../../../src/apps/dashboard/layout/MainPanel.jsx), [tab registry](../../../src/apps/dashboard/tabs/registry.js) | Main과 Tools는 keep-alive, Sites는 비활성 시 해제하고 가벼운 presentation state만 보존한다. | 기존 탭 전환만 재사용하면 분재의 실제 활성 상태와 공간이 함께 끊긴다. |
| [HomeScanWorkspace](../../../src/apps/dashboard/tabs/main/home/HomeScanWorkspace.jsx) | 연못·분재·압력 레일을 한 measured stage에 구성하고 scanner/core에 공통 활성 신호를 전달한다. | 연못을 멈추면서 분재는 유지하려면 프레임과 활성 신호를 먼저 분리해야 한다. |
| [composition geometry](../../../src/apps/dashboard/tabs/main/home/zenHomeCompositionLayoutFrame.js), [layout hook](../../../src/apps/dashboard/tabs/main/home/useZenHomeCompositionLayoutFrame.js) | 현재 가로 배치의 물/종이 경계는 stage 폭의 68%이고, geometry 측정에 연못·분재·압력 레일이 결합되어 있다. | 연못과 레일을 단순히 숨기거나 나무에 CSS transform을 적용해서는 안전한 공통 프레임이 되지 않는다. |
| [Bonsai framing](../../../src/themes/plugins/zen/model/bonsai/plume/ZenBonsaiPlumeHomeFraming.js) | 현재 성장 모습만이 아니라 전체 성장 이력의 bounds로 camera를 맞춘다. canopy는 왼쪽 영역까지 확장된다. | 어린 분재에만 맞춘 축소나 장부 위로 겹치는 수관을 허용하면 안 된다. |
| [SitesTab](../../../src/apps/dashboard/tabs/sites/SitesTab.jsx) | 장부·상세·등록의 presentation을 소유한다. 기억한 selected domain과 상세 데이터 수요가 결합되어 있다. | 선택 기억과 실제 상세 조회를 분리해야 장부만 볼 때 분석을 계속하지 않는다. |
| [Sites data preload](../../../src/apps/dashboard/tabs/sites/preloadSitesTabData.js) | snapshot 뒤 기본 사이트 하나의 상세까지 사전 조회한다. | 장부 진입은 snapshot만, 명시적 상세 진입은 해당 domain만 준비하도록 바꿀 수 있다. |
| [loading policy](../../../src/apps/dashboard/tabs/loadingPolicy.js) | Sites의 critical widget 준비는 현재 registry와 target panel을 함께 요구한다. | snapshot-only 조회와 별개로 장부/상세의 code readiness도 분리해야 한다. |
| [stats query service](../../../src/domains/stats/background/query/statsAnalysisQueryService.js), [facts query service](../../../src/domains/stats/background/query/statsFactsQueryService.js) | Main과 Sites가 같은 background query 계층을 사용하며 facts cache와 in-flight 재사용이 이미 있다. | 새로운 거대 통계 모듈이나 별도 cache를 만드는 것보다 기존 수요·revision 계약을 사용한다. |
| [Sites snapshot read model](../../../src/domains/stats/background/query/statsSitesSnapshotReadModel.js) | 장부 snapshot에도 여러 domain의 분석 계획과 Intel 계산이 포함된다. | 화면 필드만 숨겨서는 계산량이 줄지 않는다. 경량 목록 read model은 별도 후속 쟁점이다. |
| [render runtime](../../../src/apps/dashboard/layout/useDashboardRenderRuntime.js) | `activeTabId !== 'main'`을 Main이 쉬는 조건에 사용해 Tools 준비를 허용한다. | 길목에서도 분재가 살아 있으면 이 조건은 실제 GPU 부하를 설명하지 못한다. |
| [DashboardPage](../../../src/apps/dashboard/DashboardPage.jsx), [scene architecture](../../architecture/themes/zen/zen-main-presentation-scene-architecture.md) | 부팅·First Vision 동안 Main을 우선 표시하며 pond/bonsai의 정확한 frame ACK를 사용한다. focus lock은 registration intent 외 route params를 지운다. | 일반 전환을 새 scene으로 추가하지 않는다. First Vision 뒤 domain/add/recovery 인계는 미소비 navigation intent 보존을 새로 구현해야 한다. |

현재 기준 문서는 [launch/loading](../../system-architecture/06-dashboard-launch-and-loading.md), [Main ownership](../../architecture/repository/main-tab-home-surface-boundary-map.md), [Sites ownership](../../architecture/repository/sites-schedule-boundary-map.md), [Zen pond seam](../../architecture/repository/zen-pond-seam-map.md), [render budget](../../architecture/repository/render-runtime-budget-boundary-map.md)이다. 이 계획과 충돌하는 현행 계약은 해당 구현 패치에서 소유 문서·guard와 함께 명시적으로 변경한다.

## Proposal

### 1. 사용자에게는 한 공간, 내부에는 명확한 소유권

Zen에는 실제 공통 작업면을 둔다. 바깥 프레임·오른쪽 분재·전환 조작부를 지속시키고, 왼쪽에 연못 또는 길목의 내용을 배치한다. 장부와 사이트 상세는 같은 왼쪽 면에서 깊이를 바꾼다. 오른쪽에 Intel을 다시 붙이지 않는다.

| 영역 | 연못 모드 | 길목 모드 |
| --- | --- | --- |
| 공통 프레임과 배경 경계 | 유지 | 유지 |
| 오른쪽 분재 | 같은 canvas/controller로 계속 표시 | 같은 canvas/controller로 계속 표시 |
| 왼쪽 작업면 | 연못과 그 상호작용 | 장부 → 선택 사이트 상세 → 돌아오기 |
| 압력 레일 | 연못에 속한 현재 기능 | 상시 공통 chrome으로 이식하지 않음 |
| 전환 조작부 | 같은 위치 | 같은 위치 |

canonical route ID인 `main`/`sites`와 기존 domain/add/registration intent는 보존한다. Zen의 sidebar에서는 두 route를 하나의 정원 항목으로 묶고 내부 전환으로 표현한다. 다른 테마의 독립 Main/Sites 구성에는 적용하지 않는다. 길목의 노출·해금은 기존 progression owner를 따른다.

공통 composition은 앱 계층의 새 `src/apps/dashboard/workspaces/garden/` seam에 둔다. MainTab에서 SitesTab을 직접 import하거나 두 기존 탭 전체를 겹쳐 mount하지 않는다. 기존 controller/content를 탭 루트 아래에서 재사용 가능한 소유 경계로 추출하고, Zen의 프레임·모션·렌더링은 theme public seam을 통해 공급한다. 새 Zen 전용 component에는 `Zen` 접두사를 사용한다.

공통 host는 route에 따라 committed mode를 도출한다. 별도의 영구 `gardenMode` 설정이나 두 번째 router를 만들지 않는다. 선택 domain·검색·정렬·상세 복귀 위치·편집 draft·focus는 기존 presentation state 소유권을 확장하여 보존하고, query DTO·구독·business truth를 그 state에 복사하지 않는다.

`current`/`first_vision`이라는 presentation scene과 `pond`/`pathways`라는 작업면 모드는 독립된 축이다. 모드 변경으로 scene commit key를 새로 발급하거나 First Vision을 재시작하지 않는다.

### 2. 분재 폭은 두 모드에서 함께 줄인다

우측 폭과 식재 위치를 한 번 정하고 두 모드에서 공통으로 유지한다. 전환할 때마다 분재를 밀거나 확대·축소하지 않는다. 지속되는 분재가 왼쪽 변화의 기준점이 된다.

첫 가로 배치 실험은 **사용 가능한 stage의 왼쪽 72–74%, 오른쪽 26–28%** 범위다. 이는 화면을 검증하기 위한 시작값이며 확정 사양이나 측정 결과가 아니다. 전체 콘텐츠 패널의 외곽 inset도 같이 줄여 보되, 최종 값은 낮은 높이와 성숙한 수관을 함께 확인하여 정한다.

geometry에 왼쪽 내용의 `contentSafeRect`와 분재의 안전 영역을 명시한다. CSS grid, 측정 resolver, ground/root seam, DPR projection, Plume camera fit을 한 패치에서 맞춘다. 연못 전용 pressure/aperture bounds는 공통 frame과 분리한다. 측정을 통과시키려고 숨겨진 연못·레일 placeholder를 남기지 않는다.

장부의 클릭 영역과 수관이 겹치지 않아야 하며, 분재를 가로로 찌그러뜨리거나 성숙한 가지를 잘라 맞추지 않는다. 동일 모드 안에서 viewport resize는 허용하되 모드 전환 자체는 canvas 크기 변경을 유발하지 않는다.

좁은 세로 화면은 현재의 별도 topology를 존중한다. 동일한 전환과 공통 host를 쓰되 분재는 아래의 지속되는 slot으로 재배치하는 것을 기본안으로 둔다. 데스크톱의 우측 26%를 작은 화면까지 강제하지 않는다. 화면 검증 후에도 모든 폭에서 우측 고정이 필요하다면 그때 별도 선택으로 다룬다.

### 3. 전환 조작부는 프레임의 일부로 만든다

왼쪽 작업면의 **상단 프레임 선 끝, 분재 프레임과 만나는 지점**에 normal-flow 조작부를 둔다. 본문 scroll과 분리해 두 모드에서 같은 위치를 지킨다. 압력 레일은 길목에서 사라지므로 그 레일에 전환을 종속시키지 않는다.

조작부에는 `연못 / 길목`처럼 구별에 필요한 짧은 이름 두 개와 하나의 선택선을 사용한다. 별도의 설명 문장·배지·가이드 카드를 붙이지 않는다. 구체적인 조형은 실제 geometry가 잡힌 다음 결정한다. 접근 가능한 이름과 keyboard 조작은 시각적 라벨 최소화와 별도로 보장한다.

기본 전환은 클릭과 키보드다. swipe는 이 짧은 rail에서만 가능한 수평 drag를 추가하는 방식으로 제한한다. 연못 전체의 swipe는 물고기 선택, 장부의 세로 scroll, 그래프 조작과 충돌하므로 사용하지 않는다. drag의 direction lock·commit threshold·pointer cancel·바깥 release 처리를 명시한다.

본문은 경계에서 짧게 드러나는 수평 reveal과 작은 이동을 사용하고, 선택선이 같은 방향으로 반응하도록 한다. **180–240ms**는 첫 조정 범위다. 분재와 외곽 프레임은 움직이지 않는다. 3D curl·긴 blur·canvas snapshot으로 만든 넘김은 기본 구현에 넣지 않는다. 최초 1회 연출도 기본 범위에서 제외하며, 이후 발견성 문제가 확인될 때 기존 guidance owner를 통해 검토한다.

reduced motion에서는 본문 위치 이동 없이 즉시 전환하거나 짧은 opacity만 사용한다. 전환 중 outgoing 내용은 inert이며 입력·접근성 노출은 incoming 한 면에만 준다. 클릭으로 전환한 뒤에는 조작부 focus를 유지하고, 직접 domain 진입 등 의미 있는 이동만 목적지의 논리적 위치로 focus를 보낸다. 자동 갱신은 focus를 옮기지 않는다.

### 4. 로딩과 모션은 하나의 전환 계약을 따른다

전환 상태는 `committed → preparing → transitioning → committed`와 명시적 preparation failure로 나눈다. pending destination은 아직 committed route가 아니다.

1. 조작 즉시 조작부가 반응하고, 목적지의 admission과 필요한 code를 준비한다. 이전 내용은 준비 중까지 현재 면으로 유지한다.
2. 목적지가 안정된 첫 화면을 표시할 수 있으면 route/mode를 commit하고 왼쪽 전환을 시작한다. 길목의 첫 화면은 선언된 loading/error state여도 된다. 모든 통계 응답을 기다리지는 않는다.
3. 분재는 그대로 유지한다. 연못 복귀는 재사용한 pond channel의 실제 frame readiness를 확인하여 검은 면을 넘기지 않는다. 일반 resume은 전환 요청 generation에 대응하는 별도 channel/presentation receipt로 확인한다. boot first-frame acceptance를 다시 열거나 First Vision의 exact scene ACK를 재사용하지 않는다.
4. 빠른 왕복은 마지막 요청에 수렴시킨다. animation queue나 오래된 query 결과로 되돌리는 동작을 만들지 않는다. 준비 admission과 결과에는 generation fence를 적용한다.
5. code 준비 실패는 현재 committed 면을 유지하고 조작부 근처에 재시도를 제공한다. commit 이후 최초 통계 조회가 실패하면 왼쪽 면에 오류를 표시한다. 같은 정책에서 이미 admitted된 DTO의 일반 refresh 실패는 기존 내용과 `refresh_error`를 함께 유지하는 현행 계약을 따른다. 정책/권한 철회·reset으로 무효화된 DTO를 오류 대신 표시하지 않는다.

outgoing DOM이 필요하면 전환 시간 동안만 보존하고 runtime은 이미 비활성화한다. 전체 MainPanel 전환과 내부 전환을 중복 실행하지 않는다. 길목 내부의 상세 조회는 별도 local async boundary로 처리하여 분재나 공통 프레임을 loading 화면으로 교체하지 않는다.

현행 부팅은 Main 우선과 composite ACK를 사용한다. 첫 통합에서도 이 계약을 보존한다. 단, First Vision의 focus lock은 현재 일부 초기 route params를 지우므로, 요청된 길목으로의 인계는 별도 구현이 필요하다. launch/DashboardPage owner가 최초의 미소비 navigation intent를 메모리에 보존하고 unlock 후 progression admission을 재검증하여 한 번 소비한다. 차단 중의 일반 클릭을 모아 자동 재생하지 않으며 등록 command/URL acknowledgement의 기존 소유권도 바꾸지 않는다. 이때 분재와 host는 다시 만들지 않는다.

일반 `current`의 직접 길목 진입이 숨겨진 연못 준비 때문에 실측상 지연된다면, 후속 독립 패치로 목적지별 boot readiness를 도입한다. 그 패치는 launch/loading 소유자와 First Vision의 exact ACK를 분리하여 문서·guard·테스트까지 함께 바꿔야 한다. 이 최적화를 위해 First Vision ACK를 생략하지 않는다.

### 5. 활성 상태는 보이는 대상별로 나눈다

기존 하나의 `isActive` 대신 공통 frame·분재·연못·목록·상세의 수요를 각각 도출한다. 모드를 바꾸기 위해 physical Worker를 재생성하지 않는다. 현재 pond/bonsai의 독립 logical channel과 visibility/active 제어를 사용한다.

| 상태 | 분재 | 연못·압력·연못 입력 | 장부 snapshot | 선택 사이트 상세 |
| --- | --- | --- | --- | --- |
| 연못 | 활성 | 활성 | 필요하지 않으면 demand 없음 | demand 없음 |
| 길목 장부 | 활성 | park | 활성 | 선택을 기억하더라도 demand 없음 |
| 길목 상세 | 활성 | park | 목록/정책에 필요한 범위 | 표시 중인 domain만 활성 |
| 다른 최상위 탭 / document hidden | 기존 수명 정책에 따라 park | park | 숨겨진 갱신 demand 해제 | 숨겨진 갱신 demand 해제 |

오른쪽 분재에 필요한 projection은 기존 analysis store에서 한 번 구독한다. 필드 추적 후 분재에 실제 필요한 cycle/status 범위만 유지하고 연못 전용 계산을 분리한다. 동일 projection의 별도 polling controller를 추가하지 않는다. mode와 무관한 policy/reset/rollover 무효화 및 저장 완료 처리는 기존 owner가 수행한다.

길목에서 연못 loop·hit testing·연못 전용 petal receiver를 멈추되 분재에 필요한 rendering은 유지한다. 공통 host의 keep-alive는 기존 Main의 retained lifetime을 대체하는 명시적 단위로 선언하며, 숨겨진 Sites 전체 tree를 추가하지 않는다.

Tools의 speculative warmup은 tab ID 대신 실제 live scene workload를 기준으로 admission을 판단한다. 길목에 보이는 분재를 무시한 채 GPU 준비를 시작하지 않는다. Tools에 명시적으로 들어가는 요청과 idle prewarm도 구분한다.

### 6. 통계는 기존 서비스에 필요한 범위를 요청한다

사용자가 제안한 API 방식은 이미 있는 background query 계층을 활용하는 방향으로 구체화한다. 코드 공유와 data freshness를 분리하고, 모듈을 불러왔다고 모든 통계를 조회하지 않는다.

| 준비 시점 | 요청할 범위 | 접근 방식 |
| --- | --- | --- |
| Main 최초 진입 | 연못/분재의 실제 초기 수요 | 길목 전체 분석을 boot critical chain에 추가하지 않음 |
| 전환 조작부 hover/focus | 장부 code·locale·widget 준비 | 기존 intent preload owner와 분리한 장부 readiness 사용. 상세 reading chunk와 모든 상세 통계 조회를 붙이지 않음 |
| 길목 장부 진입 | 목록/정책 snapshot | 기본 첫 domain 상세를 자동으로 조회하는 preload 제거 |
| 명시적 domain intent / 상세 진입 | 그 domain의 detail | revision·fingerprint·domain key에 맞는 기존 cache/in-flight 합류 |
| 사용 기록 commit | 현재 demand가 있는 projection | 기존 stale-triggered trailing refresh 사용 |
| policy 변경·reset·missing data·detail revision mismatch | 해당 owner가 요구하는 fresh read | 즉시 철회/refresh admission 등 기존 계약 보존 |
| rollover·재활성화 | 현재 demand의 refresh | Main의 freshness 우회와 Sites의 유효 snapshot 최대 60초 coalescing을 구분 |
| boot 완료 뒤 입력이 조용한 idle | 길목 code와 조건부 목록 준비 | 기존 warmup의 지연·concurrency 1·취소 admission 사용 |

현재 Main cycle/status와 Sites snapshot의 통계 commit 갱신에는 약 60초 trailing coalescing이 있다. 이는 60초마다 무조건 도는 polling이 아니다. 재활성화·rollover에서 Main은 freshness 창을 우회하지만, Sites는 같은 정책의 유효 snapshot이 있으면 `computedAtEpochMs` 기준 최대 60초 coalescing을 유지한다. 이 차이를 임의의 공통 timer로 통일하지 않는다. facts 쿼리의 revision/range cache와 in-flight, Sites detail의 bounded cache도 재사용한다. 새로운 timer·cache mirror·business storage를 추가하지 않는다.

idle은 CPU/GPU가 남는다는 보장이 아니다. code 평가와 GPU resource 준비를 같은 작업으로 취급하지 않는다. model·texture 준비, 전 사이트 Intel 사전 계산은 명시적 수요와 실제 비용 측정 없이 자동 admission하지 않는다. 이미 시작된 dynamic import는 실제 취소가 안 되므로 후속 작업과 결과 채택을 취소한다.

현재 장부 snapshot 자체가 여러 사이트 분석을 수행하는 문제는 따로 남는다. 최종 장부 필드가 확정되면 canonical stats owner에 경량 summary read model을 추가하거나 기존 query 범위를 좁힌다. 기존 full snapshot의 다른 소비자를 조사하고 DTO·read-model 문서·guard를 함께 변경한다. 상세 분석은 명시적 상세 수요에 남긴다. 화면에서 문장을 지우는 것만으로 계산 최적화를 달성했다고 판단하지 않는다.

압력의 가중 지표, 실제 관측 사용량, 한도의 차감량은 의미와 시간 범위가 다르다. 공통 API를 쓰더라도 하나의 숫자나 임의의 공통 기간으로 합치지 않는다. 정책 fingerprint 변경·기록 권한 철회·`STATS_SITES_POLICY_CHANGED`·reset에서는 기존 DTO를 철회한다. 일반 stats invalidation·rollover에서는 같은 정책의 admitted DTO를 유지하며 `refreshing/refresh_error`를 드러내는 현행 계약을 보존한다.

## Tradeoffs

- Benefits: 분재의 실제 지속성과 같은 프레임 안의 탐색을 얻는다. 왼쪽 변경에만 모션과 로딩을 집중할 수 있다. 연못·목록·상세의 실행 비용을 표시 여부에 맞춰 제어한다.
- Risks: 길목에서도 분재가 계속 렌더링되므로 기존 독립 Sites보다 GPU 비용이 높을 수 있다. 줄어든 왼쪽 영역은 최종 정보량 절감을 요구한다. geometry와 첫 frame 계약을 단순 CSS 변경보다 넓게 다뤄야 한다.
- Alternatives considered: 기존 두 탭을 시각적으로만 연결하면 수명·ACK·geometry를 이중으로 조율해야 한다. 반대로 Main에 모든 controller와 분석을 eager하게 합치면 boot 비용과 숨겨진 작업이 커진다. 공통 host와 독립 demand를 채택한다.

## Adoption plan

2026-10-10 첫 구현 패치는 단계 1의 기반을 추출한다. 공통 stage frame과
독립 surface activity를 연결하고 기존 물리 Worker·budget·park 정책·화면을
보존한다. MainPanel의 실제 family lifetime 승격, pending launch intent 인계,
Tools의 새로운 workload admission은 길목을 실제 공통 host에 연결하는 후속
패치에서 진행한다. 현재 경로에서는 양면이 함께 표시되므로 기존 동작을 유지한다.

각 단계는 별도 검토 가능한 패치다. 구조 변경과 세부 장부 디자인을 한 diff에 섞지 않는다. 아래 순서는 기본 흐름이며, 실제 수명·데이터 경계의 정확성은 첫 동작 패치부터 충족해야 한다.

### 0. 기준선과 소유 계약 고정

**핵심 쟁점:** 실제 비용·현재 수명·직접 진입 계약을 확인해야 통합의 성능을 판단할 수 있다.

- Main cold/warm boot, Main↔Sites, Sites 장부/상세, Sites→Tools에서 module 평가·쿼리 수·주요 long task·worker/channel 생성 수를 기준선으로 기록한다. Main이 가장 무겁고 Tools가 두 번째라는 가정은 검증 대상으로 둔다.
- scene 종류, progression gate, navigation intent, 등록 draft, 통계 revision의 소유 표를 확정한다.
- 기존 변경 파일은 보존한다. 새 작업이 건드릴 동일 소유 seam의 diff를 먼저 검토한다.

**결과물:** 짧은 기준선 기록과 패치 범위. 아직 시각 개편은 없다.

### 1. 공통 host와 runtime 수명 추출

**핵심 쟁점:** 분재를 재생성하지 않고 연못만 멈출 수 있어야 한다.

- `HomeScanWorkspace`의 공통 frame/bonsai와 pond 전용 영역을 분리한다. 공통 활성·분재 활성·연못 활성 신호와 실제 projection demand를 연결한다.
- 앱의 garden workspace owner와 theme public presentation seam을 만들고 tab끼리의 직접 import를 금지하는 기존 guard를 유지한다.
- 기존 Main keep-alive 수명과 첫 frame coordinator의 소유권을 명시적으로 이전한다. 모드에 따른 React key로 Bonsai를 remount하지 않는다.
- First Vision에 의해 표시가 보류되는 최초 launch intent의 transient owner를 명시한다. scene lock과 요청 목적지를 구분하고 영구 mode/router state를 추가하지 않는다.
- `useDashboardRenderRuntime`의 speculative 준비 조건을 실제 scene 활동 기준으로 고친다. 이 수정은 분재가 Sites에서 활성화되기 전에 들어간다.

**주요 패치 위치:** `HomeScanWorkspace.jsx`, `MainTab.jsx`, MainPanel/registry의 family lifetime 경계, 새 app workspace seam, Zen public frame seam, render runtime owner.

**완료 조건:** 기존 연못 화면이 동일하게 동작하고, 연못만 park해도 같은 분재 controller/channel을 유지한다. First Vision의 composite ACK가 유지된다.

### 2. 더 좁은 분재와 공통 geometry 확정

**핵심 쟁점:** 넓은 수관·낮은 창에서도 왼쪽 작업면과 분재가 실제로 공존하는가.

- 72:28과 74:26을 시작점으로 외곽 inset·왼쪽 safe rect·오른쪽 식재 위치를 함께 비교한다. 길목 자리에 단순한 측정용 내용만 넣어 검증한다.
- pure geometry resolver를 공통 frame과 pond-only bounds로 나눈다. CSS·ground/root seam·camera·DPR를 함께 맞춘다.
- mature history, young/seedling, 낮은 높이, portrait resize에서 식재 접점·입력 차폐·내용 겹침을 확인한다.

**주요 패치 위치:** `zenHomeCompositionLayoutFrame.js`, `useZenHomeCompositionLayoutFrame.js`, `homeScanWorkspace.css`, `ZenHomeGardenPlanes.jsx`, `homeGardenBed` public seam, Bonsai frame/camera owners.

**완료 조건:** 두 모드가 같은 geometry를 사용할 수 있고 전환으로 오른쪽 canvas 크기·카메라가 흔들리지 않는다. 이 단계의 실제 화면으로 최종 폭을 정한다.

### 3. 길목 내용을 왼쪽 outlet에 연결

**핵심 쟁점:** 별도 탭의 business 흐름을 보존하면서 하나의 공간으로 연결해야 한다.

- Sites의 controller와 내용 경계를 추출하여 공통 host의 왼쪽에 장부/상세/등록을 배치한다. 기존 Sites의 외곽 카드·중복 헤더·footer를 통째로 넣지 않는다.
- Zen sidebar의 family projection과 canonical main/sites route를 연결한다. 다른 테마는 기존 독립 탭을 유지한다.
- domain/add intent, popup 등록 intent, 장부 복귀 위치, 검색/정렬, 선택 domain과 draft를 보존한다. URL 해석은 `dashboardLaunchContext`에 남긴다.
- 최초 미소비 Sites domain/add/recovery intent는 First Vision unlock 뒤 admission을 다시 확인해 한 번 인계한다. focus lock이 params를 지우는 현행 동작을 보존 성공으로 오인하지 않는다.
- remembered selection과 detail demand를 분리한다. 장부일 때 상세 query를 멈추고, 빠른 전환의 늦은 응답을 revision/generation으로 배제한다.
- 이 단계에서 default domain의 full-detail preload도 제거하여 장부 snapshot-only 준비를 완성한다. `loadingPolicy.js`의 registry/target panel critical widget 계약을 장부/상세 readiness profile로 나누어 상세 code까지 불필요하게 기다리지 않게 한다.
- 등록/정책 변경의 기존 command owner와 명시적 확인·저장 실패 처리를 보존한다. pending command를 이유로 새로운 전체 navigation trap을 만들지 않는다.
- global cap의 긴 inline editor를 공통 프레임에 재사용하지 않는다. 필요한 편집 진입을 왼쪽의 전용 subview로 rehost하여 header 높이를 고정한다. 최종 조형과 정보 예산은 후속 디자인에서 정한다.

**주요 패치 위치:** `SitesTab.jsx`, `SitesWorkspace.jsx`, Sites controller/detail hooks, `preloadSitesTabData.js`, `loadingPolicy.js`, MainPanel/registry, DashboardPage의 nav projection, launch intent adapter, 기존 cap/editor owner.

**완료 조건:** 실제 route 왕복에서 분재가 유지되고, 장부→상세→장부와 등록/정책 저장이 이어진다. 경로마다 활성 통계 수요가 정확하다.

### 4. 프레임에 붙은 전환과 짧은 모션

**핵심 쟁점:** 전환 위치가 자연스럽고 cold/warm 상태 모두 즉각적인 조작 감각을 제공하는가.

- 상단 seam의 normal-flow 전환 조작부와 하나의 local motion owner를 추가한다.
- preparing/commit/error와 마지막 요청 우선 처리를 연결한다. 부모 MainPanel의 전역 tab motion은 같은 family 전환에서 중복 실행하지 않는다.
- 먼저 클릭·keyboard·reduced motion을 완성한다. 이후 짧은 rail drag가 이득을 주는 경우만 추가한다. swipe가 통합 완료의 필수 조건은 아니다.
- 전환 시간 동안 outgoing input을 막고 focus를 유지한다. 데이터 로딩은 왼쪽 local boundary 안에서 처리한다.

**주요 패치 위치:** 새 workspace transition/controller, Zen 전환 component와 named local motion seam, MainPanel motion 분기, loadingPolicy의 선언된 boundary.

**완료 조건:** 빠른 연속 조작·cold import·준비 실패·reduced motion에서 빈 면이나 애니메이션 대기열이 없고 오른쪽 분재가 흔들리지 않는다.

### 5. 사전 로딩과 통계 수요 최적화

**핵심 쟁점:** 통합으로 Main boot와 숨겨진 작업이 늘지 않는가.

- 단계 3에서 분리한 code/data 준비와 장부/상세 readiness의 실제 비용을 확인한다. explicit domain intent의 targeted preload와 idle 우선순위를 조정한다.
- existing boot warmup owner의 input-quiet admission을 재사용한다. 숨겨진 연못 작업과 길목 상세 demand가 실제로 해제되는지 확인한다.
- 같은 projection/cache/in-flight key를 공유하고 기존 stale-triggered coalescing을 유지한다. 새 주기 timer는 추가하지 않는다.
- 직접 길목 boot의 비용을 측정한다. 숨겨진 pond 준비가 의미 있는 병목일 때만 별도 readiness 패치를 연다. First Vision은 기존 exact pond/bonsai ACK를 보존한다.
- 경량 장부 read model은 최종 필드가 아직 미정이므로 이 단계에서 임의 DTO를 확정하지 않는다. 현재 비용과 분리 지점만 기록하여 다음 디자인 패치에 전달한다.

**주요 패치 위치:** `preloadSitesTabData.js`, existing tab/code preload와 `bootSurfaceWarmup.js`, projection demand hooks, 필요 시 canonical stats query/read-model owner. 부팅 최적화는 독립 diff로 분리한다.

**완료 조건:** Main 초기 경로에 full Sites 분석이 추가되지 않고, 장부 진입에 무관한 detail 요청이 없다. 재활성화·정책 변경의 freshness는 유지된다.

### 6. 통합 검증과 소유 문서 갱신

**핵심 쟁점:** 예쁜 한 장의 화면보다 탐색·수명·저장·접근성의 지속되는 계약을 검증한다.

- 구조·성능 변화와 직접 관련된 기존 테스트만 갱신한다. 새 테스트는 navigation/lifecycle/readiness/geometry/data demand 같은 durable contract에 한정한다.
- launch/loading, Main/Sites owner map, pond seam, render budget, theme public seam 문서와 guard를 해당 구현 패치에 함께 반영한다. 시각 class나 문구를 고정하는 테스트는 추가하지 않는다.
- canonical QA로 최초 진입·왕복·낮은 창·성숙 분재·portrait·First Vision을 확인하고, 기준선과 같은 조건에서 성능을 비교한다.

**결과물:** 검증 가능한 공통 작업면. 이후 장부의 필수 정보만 남기는 디자인 논의로 넘어간다.

### 다음 디자인 단계로 넘길 항목

이번 구조 패치에서 최종 결정하지 않을 항목은 장부 행의 정보 예산, global cap의 최종 조형, 통계 그래프 선택, empty state, 기간 표기다. 다만 다음 원칙은 즉시 적용한다.

- 도메인 주소·수치·상태가 스스로 의미를 전달하면 같은 의미를 이름표로 반복하지 않는다.
- 장식으로 빈자리를 채우지 않는다. 사용에 필요한 형태·실제 값·조작과 연결되는 시각만 남긴다.
- 기록 기준/하루 시작 같은 전역 설정을 장부의 상시 설명 영역으로 유지하지 않는다. 필요한 설정 진입과 해당 관측의 해석에 필수인 기간·단위는 구분한다.
- 기존 UI를 좁혀 넣기 위해 모든 글자와 행을 줄이지 않는다. 내용의 우선순위를 먼저 줄이고 남은 내용을 새 작업면에 맞춘다.
- 장부와 상세의 최종 필드가 정해진 뒤 경량 목록 read model의 API 계약을 확정한다.

## Acceptance signal

### 공간과 상호작용

- 동일 viewport에서 모드 전환만으로 분재 canvas/controller/channel identity, 식재 접점, 오른쪽 geometry가 바뀌지 않는다.
- 장부는 투명 canopy canvas의 전체 bounds 때문에 축소하지 않는다. 분재가 패널을 침범하는 형상을 유지한다. 수관에 가려지는 텍스트와 실제 조작 대상의 최종 배치는 사용자 요청으로 다음 디자인 단계에서 결정한다. full/young/seedling 분재와 low/compact/wide/portrait를 확인한다.
- 같은 위치의 전환 조작으로 왕복하고, 장부·상세·등록의 복귀 상태를 보존한다. 모션이 끝나면 비활성 본문 DOM은 필요한 수명만 남긴다.
- keyboard·빠른 왕복·pointer cancel·reduced motion·code 실패·통계 실패가 각각 명시적인 상태로 끝난다. 자동 갱신은 focus와 패널 크기를 흔들지 않는다.

### 런타임과 데이터

- 길목에서 연못 전용 animation/input이 park되고, 분재는 실제로 계속 동작한다. 다른 최상위 탭과 document hidden에서는 선언된 수명 정책에 따른다.
- 장부만 볼 때 remembered selected domain의 상세 GET/분석 demand가 없다. 동일 key의 동시 요청은 기존 in-flight로 합쳐진다.
- 정책 fingerprint 변경·기록 권한 철회·명시적 policy-changed·reset의 철회 이후 무효한 DTO를 표시하지 않는다. 일반 stats invalidation·rollover와 refresh 실패는 같은 정책의 admitted 내용 및 refresh 상태를 보존한다. pending mutation과 late response가 현재 mode/선택을 덮지 않는다.
- Main boot의 module graph/critical query에 full Sites 분석이 새로 들어가지 않는다. 계속 보이는 분재를 감안해 Tools warmup admission을 판단한다.
- cold/warm 전환의 입력 반응, 목적지 표시, module 평가, query 횟수, long task, worker/channel 생성, frame 공백을 각각 기록한다. 모션 180–240ms를 loading 시간의 보장으로 오인하지 않는다.

### 검증 경로

읽기 전용 target discovery에서 `dashboard/boot`와 `dashboard/capture`의 환경은 모두 `ephemeral`, 기본 presentation은 `hidden`임을 확인했다. 실제 구현 검증은 다음 canonical 경로를 사용한다. 계획 작성 당시에는 브라우저·서버를 실행하지 않았으며, 이후 구현 검증은 아래 기록을 따른다.

```powershell
npm run qa -- describe dashboard/boot
npm run qa -- describe dashboard/capture
npm run qa -- run dashboard/boot --theme=zen
npm run qa -- run dashboard/capture --theme=zen --surface=main --viewport=desktop-wide --bonsai-state=full
npm run qa -- run dashboard/capture --theme=zen --surface=sites --viewport=desktop-low --bonsai-state=full
```

기존 capture의 `first-vision-journey`, `first-site-journey`, `main-return-journey`, `sites-scenario`, viewport/resize 계약을 우선 재사용한다. 새 family 전환의 관측이 부족하면 canonical protocol/control-plane에 필요한 durable journey를 확장한다. headless/hidden 검증을 우선하며 실제 사용자 조작은 별도의 정식 explore 수명과 정확한 profile 연결을 따른다. ad hoc CDP/Playwright/브라우저 flag를 만들지 않는다.

기존 검증 자산은 `mainPanelUnmountContract`, `mainPanelMotionProfileContract`, `dashboardLaunchContext`, `zenHomeFirstVisualCoordinatorState`, `zenHomePresentationSceneAckCoordinator`, `zenHomeCompositionLayoutFrame`, `sitesTabDataPreload`, `useSitesPolicySnapshot`, `useSitesSiteDetail`, `analysisProjectionLifecycle`, `analysisSnapshotRefreshPolicy`다. 실제 변경 경계에 맞는 항목만 실행한다.

구조 guard는 dashboard owner/boot artifact, stats projection/read-model, theme seam/public entry, typography layering, docs paths 중 해당 패치에 관련된 것만 선택한다. 전체 suite나 release build는 이번 통합 패치의 검증에 포함하지 않는다. QA 실행 후에는 정식 retention owner로 보존·정리를 처리한다.

## Implementation verification — 2026-10-10

최종 통합 source의 focused tests는 22개 파일, 263개 테스트가 통과했다. 전환의 준비/취소/실패/복귀 receipt, keyboard/drag/focus, retained canvas 수명, family route/launch intent, snapshot-only preload, notebook-only 상세 수요, bounded camera와 fractional-DPR 외곽 allocation을 포함한다. 별도 geometry focused set도 5개 파일 74개 테스트가 통과했다(통합 set과 중복되므로 합산하지 않는다).

Dashboard owner architecture, docs paths, typography layering, i18n contract, Zen architecture, 개발 빌드와 해당 boot artifact contract는 통과했다. 전체 suite와 release/shipping gate는 실행하지 않았다. 동일 조건 성능 비교는 아직 하지 않았으므로 조회/실행 수요를 줄인 동작을 성능 개선 수치로 해석하지 않는다.

Canonical browser evidence는 `ephemeral`/`hidden`으로 실행했다. 최신 개발 artifact는 `20261010074906-42cb4a5944f0-dirty`이며 다음 두 run은 통합 수명과 상세 흐름의 결정적 증거로 pin했다.

| Run | 결과 | 확인 범위 |
| --- | --- | --- |
| `20261010075133327-dashboard-capture-5cfa8b4c` | PASS | 성숙 분재, 길목↔연못 3회 및 browser return, 동일 canvas와 실제 Pond resume frame |
| `20261010074846963-dashboard-capture-71958e94` | PASS | 장부/상세 복귀, reading/evidence/recording/protection 흐름, scroll/control 접근성, bounded canvas 외곽 |
| `20261010075223075-dashboard-capture-951ad56f` | PASS | 같은 최신 artifact에서 desktop-low 장부 → portrait-narrow resize와 지속 slot 배치 |

발견 후 수정한 실패도 유지한다. 최초 Main capture의 옛 hit-test guard는 넓은 canopy canvas가 연못과 겹친다는 전제를 요구했다. bounded canvas에 맞춰 실제 hit route와 Pathways/canvas 비중첩을 검증하도록 owner를 갱신했다. 최초 intel run(`20261010074315075-dashboard-capture-97470bd5`)은 scene padding과 추가 overshoot/ceil로 생긴 2px ancestor overflow를 검출했다. geometry owner에서 외곽 allocation을 바로잡은 뒤 최신 intel run이 통과했다. 각 run cleanup은 7/7 release로 완료했다.

변경 범위 밖에서 관찰한 실패는 남겨 둔다.

- `check:theme-public-entry-boundaries`: 수정하지 않은 `BarrierTabManagementScene.jsx`가 `ZenArtifactSwitchBand.jsx` 내부 widget을 직접 import한다.
- `check:theme-seam-role-architecture`: 수정하지 않은 `ArtifactGalleryView.jsx`에 guard가 요구하는 `LockedArtifactIntroduction` token이 없다.
- `zenBonsaiPlumeProductIntegration.test.js`의 성장 단계 검증 3건: pre-bloom alpha, 5일 release contract에 대한 6일 fixture 입력, 이전 branch endpoint fading 기대가 실패한다. 모두 camera/render-plan 생성 전 계산에서 실패하며 이번 frame/camera owner 변경을 소비하지 않는다. baseline 비교 실행은 하지 않았으므로 발생 시점은 확정하지 않는다.

## Minimal ledger implementation — 2026-10-10

공통 Garden 프레임 위에서 Zen 장부를 별도 조형으로 교체했다. 검색·등록·목록은 외곽 카드 없이 하나의 면을 사용한다. 행은 도메인, 한 가지 시간값, 짧은 실제 상태와 상세 진입만 남긴다. 비교선은 실제 관측값이 있을 때만 공통 scale로 표시한다. 관측된 0분과 기록 부재를 구분하며 일반 polling 중 순서·scale을 고정하는 기존 계약도 유지한다. 기록 기간/하루 시작과 관리 진입은 요청할 때 펼치는 disclosure로 이동했다.

공유 `useSitesRegistryModel`은 기존 검색·정렬·선택·등록·비교 snapshot의 presentation logic만 담당한다. canonical DTO admission, stats query, command, storage owner는 앱에 남긴다. 다른 테마의 Standard DOM은 유지하고 Zen DOM/CSS는 plugin이 소유한다. 공유 stylesheet의 이전 Zen 전용 registry override는 제거했다.

전체 한도는 작은 committed-value trigger로 진입하는 왼쪽 전용 편집면이다. 단일 `SitesHud`/form을 유지하여 header를 확장하거나 편집을 재생성하지 않는다. 명시적 적용, applied ACK, 실패 재시도와 draft를 보존하고 취소/복귀는 현재 연결된 trigger로 focus를 돌린다. 정책 snapshot 철회 중에는 admitted 복구를 기다리되 사용자 focus 이동이나 비활성 전환을 침범하지 않는다. 편집면이 열린 동안 숨겨진 상세/target/site-cap 수요와 기록 review/보호 해제 grace를 해제한다. 도메인/등록 route intent는 편집면을 닫고 요청한 탐색을 표시한다. 새로운 storage, cache, polling timer는 추가하지 않았다.

최종 focused verification은 17개 파일, 179개 테스트가 통과했다. registry 상호작용과 목록, shared ordering/scalability/favicon, cap admission/실패 회복/명시적 저장, 실제 notebook→한도→복귀 focus, release grace와 상세 demand 계약을 포함한다. CSS 정리 후 canonical 개발 빌드를 다시 생성했다. 다음 run은 모두 `ephemeral`/`hidden`, artifact `20261010082024-42cb4a5944f0-dirty`를 사용했다.

| Run | 결과 | 확인 범위 |
| --- | --- | --- |
| `20261010082001053-dashboard-capture-86a2452d` | PASS | 실제 65초 및 canonical invalidation을 거친 편집 입력값·focus·form/workspace continuity, 기록 범위별 cap admission |
| `20261010082420761-dashboard-capture-0b32bd6d` | PASS | 새 장부/상세 왕복, notebook의 외부 전체 한도 trigger 접근, 기존 reading/정책/기록 흐름 |
| `20261010082505750-dashboard-capture-4185521f` | PASS | desktop-low→portrait-narrow resize, 장부와 지속 slot 배치 및 overflow contract |

세 run 모두 cleanup 7/7 release를 완료했고 페이지 console error/warning/CSP 위반은 0건이다. 이 관측은 UI continuity와 현재 정책의 admission을 확인하며, 실제 foreground 사용량 생성이나 동일 조건 성능 benchmark를 의미하지 않는다. 전체 suite와 production/release gate는 실행하지 않았다.

좁은 창 첫 capture의 layout 계약은 통과했지만, 실제 이미지는 resize 직후 이전 render plan을 새 surface에 그린 중간 프레임이었다. 별도 진단 run `20261010082753791-dashboard-capture-34e2fe60`에서 기존 canonical `--settle-ms=5000` 옵션으로 최종 형상이 정상임을 확인했다. 이는 지속적인 camera aspect 오류와 구분한다. Worker의 RESIZE/SCENE 사이 중간 표시를 없애는 atomic publication은 이번 장부 패치에 추가하지 않는다. 캡처 계약은 임의의 더 긴 sleep 대신 현재 크기의 최신 ACK 필요 scene update 이후 승인된 commit을 기다리도록 보강한다.

중간 표시의 후속 수정은 client가 canonical `canvasMetrics`의 surface identity를 SCENE에 전달하고, worker가 동일 surface의 size/scene을 함께 commit하는 경계에서 진행한다. continuous loop/ACTIVE/async renderer 준비 이후도 같은 identity를 검사해야 하므로 RESIZE의 단일 `renderFrame()` 호출만 지우지 않는다. `renderPlan.surface`는 정상 canopy viewport와 전체 canvas가 다를 수 있어 동일성 판단에 사용하지 않는다. CSS resize 동안 이전 pixels가 늘어나는 문제까지 막으려면 새 surface frame ACK까지의 짧은 표시 보류도 함께 설계해야 한다.

추가 QA 계약 검증은 resize frame/viewport/render identity 3개 파일 69개 테스트와 `check:qa:architecture`를 통과했다. 기존 두 실제 run을 재투영했을 때 처음 눌린 이미지는 `pending/current_scene_ack_pending`, 5초 후 이미지는 `ready`로 구분했다. trace-off/marks 측정은 이 계약을 우회해 성공으로 표현하지 않고 `unavailable/currentFrameVerified:false`를 명시한다.

최종 canonical 재실행 `20261010083302556-dashboard-capture-985c09fb`은 기본 settle 옵션 그대로 PASS했다. `dashboard-resize.json.bonsaiFrame`은 현재 532×255 surface의 dispatch 353→commit 355를 `ready/currentFrameVerified:true`로 기록했고, 실제 portrait 이미지의 분재 비율도 확인했다. cleanup 7/7, 페이지 console error/warning/CSP 0건이다. 이 run과 위의 recording-refresh/intel-reading run을 최종 증거로 pin했다.

Theme shared seam, typography layering, dashboard owner, theme widget no-fallback, i18n/dashboard i18n, docs paths, Zen architecture guard와 `git diff --check`가 통과했다. 이전 owner를 고정하던 personal-baseline/Sites widget guard는 실제 앱/지연 notebook owner로 갱신하되 strict admission·explicit Apply·applied ACK·모든 테마의 필수 widget pair·대체 구현 금지는 유지했다. 변경 범위 밖의 실패는 별도로 남긴다: `check:personal-baseline:architecture`의 수정하지 않은 `CLSEService.js` full-reset marker와 `check:theme-public-entry-boundaries`의 위에 기록한 visual-harness 내부 widget import다.

## Design correction — lower-edge ledger, 2026-10-10

사용자 피드백으로 위의 작은 mode tabs와 bounded Bonsai frame을 제품 목표에서 철회했다. 분재는 원래 크기의 수관이 작업면을 침범하며 식재 위치만 조금 오른쪽으로 옮긴다. 전환은 연못과 비중 그래프 사이 경계에서 장부를 펼치고 걷는 동작이다. 아래 수정은 제품 소스에 적용했으며, 실제 검증 기록은 이 문서 끝에 덧붙인다.

### 공간과 입력

- 닫힌 장부의 얇은 종이 끝이 그래프 바로 위의 경계에 있다. 경계를 위로 당기면 장부가 아래에서 올라오며 그 경계가 장부의 윗변이 된다. 열린 윗변을 아래로 당기면 장부 전체를 걷는다. 클릭/Enter/Space도 같은 가장자리에서 가능하게 하고 ArrowUp/Down을 지원한다. 별도 상단 mode tabs와 그 44px header를 제거한다.
- drag는 경계에서만 시작한다. 내용 scrolling, selection, form editing에 swipe를 걸지 않는다. pointer capture·거리/방향 판정·취소·드래그 후 click 억제를 한 owner가 담당한다. reduced motion과 빠른 역방향 요청을 유지한다.
- 비중 그래프는 아래에 남겨 두 모드의 공통 입구로 사용한다. 단순 경계 진입은 명시적인 ledger intent이며 이전 notebook을 임의로 복원하지 않는다. favicon은 별도의 domain intent로 해당 intel에 직접 진입한다.
- 기존 클릭 popup/action drawer를 제거한다. 현재 hover 또는 keyboard focus의 favicon 하나만 표시하며 도메인을 accessible name으로 둔다. rail↔favicon 사이를 하나의 interaction region으로 연결한다. favicon은 interactive button이며 tooltip이나 nested button이 아니다. touch는 첫 tap으로 favicon을 보이고 favicon tap으로 진입한다. 실제 작은 비중을 클릭 편의 때문에 부풀리지 않는다.
- Esc/마우스 Back은 내부 evidence/편집 → intel → 장부 → 연못 순서로 한 단계씩 복귀한다. 아래로 당기기는 전체 장부를 걷는 동작이다. 저장 잠금·내부의 defaultPrevented·editable/contenteditable·IME를 존중한다. 앱 route는 React state이므로 browser history를 새 navigation SSOT로 도입하지 않는다.

### 다음 구현 순서와 실제 owner

1. **분재의 크기와 침범 복원.** `homeScanWorkspace.css`의 분재 측정 비율을 원래 `1.58/.96`으로 되돌리고, `zenHomeCompositionLayoutFrame.js`의 투명 canopy 확장과 `ZenBonsaiPlumeHomeFraming.js`의 원래 `.58` width ratio를 함께 복원한다. `.73` height ratio를 유지한다. `zenHomeFrameSeamGeometry.js`의 preferred planting point `.86→.90`을 시작 후보로 사용한다(450px 측정폭에서 약 18px). 2px 외곽 overflow 보정과 frame-seam/DPR/exact ACK 계약은 유지한다. rear plane은 원형 `.68`을 시작점으로 삼는다.
2. **공통 가장자리와 세로 전환.** `ZenGardenFrame`과 theme-specific edge presentation이 두 모드 공통 손잡이를 소유한다. `ZenHomePressureDock`은 공통 그래프 배치만 소유하며 두 모드에서 활성 상태를 유지한다. `useGardenModeTransition`의 code 준비와 실제 Pond resume receipt를 거치며 drag 중에는 표현용 진행도, release에서 route 요청을 처리한다. 좌우 fade/translate와 상단 tabs를 세로 sheet reveal로 교체했다.
3. **그래프에서 intel 직행.** `ZenPressureSegments`에서 segment/hover와 favicon action을 분리하고 `ZenPressureRail`의 drawer 및 selected-lens Escape 처리를 함께 제거한다. 앱의 `handleManageSites(domain)→onTabChange('sites',{domain})`와 기존 Sites domain 소비 계약으로 연결한다. `onSelectDomain=null`로 전체 segment를 disable하는 수정은 하지 않는다.
4. **닫기 계층.** `useDashboardNavigationButtonLock`는 현재 3·4번 마우스 버튼의 다섯 이벤트를 capture에서 모두 차단한다. 이 owner에 활성 workspace의 Back callback을 연결하고 한 physical gesture에 한 번만 실행한다. 새 local listener를 겹쳐 추가하지 않는다. Escape는 내부에서 소비된 뒤 bubble 단계에서 판단한다. 장부 복귀의 row/search RAF focus도 현재 workspace가 활성이고 focus를 소유할 때만 실행한다.
5. **검증 계약 수정.** 전체 Bonsai canvas와 작업면의 비중첩은 잘못된 제품 전제다. 투명 canvas 중첩을 허용하고 불투명 장부가 연못 상단·패널선·그래프 상단까지 덮는지 검증한다. content bounds를 canopy bounding box 전체 밖으로 밀어내지 않는다. text/수관 겹침의 최종 디자인은 유보한다. mature/low/portrait와 직접 domain 진입·ledger intent·drag 취소·Esc·mouse Back·focus 복귀·reduced motion·exact resume를 canonical QA에서 확인한다. 새 storage/query owner나 주기 timer는 추가하지 않는다.

## Lower-edge implementation verification — 2026-10-10

제품 패치를 적용하고 개발 artifact `20261010095655-42cb4a5944f0-dirty`를 `dist/`에 발행했다. 장부의 불투명 종이는 분재 rear panel line까지 연못을 완전히 덮고, canopy는 원래 크기로 그 위를 침범한다. pressure data의 논리적 끝과 화단 시작은 기존 같은 좌표를 유지한다. fractional rasterization의 밝은 틈만 기존 paint overshoot로 덮었으며 데이터 배분과 hit bounds는 바꾸지 않았다. 퇴역한 drawer·hover echo·readout layer·readout geometry는 제거했다.

닫기 gesture는 준비된 현재 scene의 ACK 뒤에만 연못을 드러낸다. 준비 완료 후 오래 잡고 있어도 timeout하지 않으며, Escape는 먼저 현재 drag를 취소하고 ArrowDown은 준비된 receipt를 그대로 승격한다. Sites의 미소비 domain/add/ledger intent는 이전 상세 수요와 오래된 registry reconciliation을 차단한다. unmanaged X에서 Y로 반복 진입할 때 이전 passive effect가 새 notebook을 덮던 경합과, 같은 도메인 재진입에서 상세 admission이 멈추던 문제도 수정했다. 새 cache·storage reader·자동 갱신 timer는 추가하지 않았다.

최종 focused set은 13개 파일 244개 테스트를 통과했다. geometry/framing, retained renderer readiness, Home/Garden frame과 native-control 계약, navigation button 중복 방지, MainPanel family retention, Main loading, Sites route/detail admission과 준비/취소/실패 수명을 포함한다. theme shared/public seams·typography layering·Zen architecture·dashboard owner·widget no-fallback·i18n/dashboard i18n·QA architecture·docs paths·`git diff --check`와 개발 build artifact checks도 통과했다. 전체 suite, production/release gate, 동일 조건 성능 benchmark는 실행하지 않았다.

| Exact run | 결과 | 확인 범위 |
| --- | --- | --- |
| `20261010095902487-dashboard-capture-c16f3f73` | PASS | desktop-wide, favicon hover/click·Tab/Space Intel 직행, Esc Intel→장부→연못, mouse Back 한 단계, 위/아래 drag·짧은 drag 취소, 전체 덮기·배분 불변·같은 분재 canvas·Pond ACK와 Worker 진행 |
| `20261010100007122-dashboard-capture-8b40247f` | PASS | populated Sites 장부 desktop-low→portrait-narrow resize, overflow/배치 및 현재 532×275 분재 surface의 exact scene ACK dispatch 351→commit 353 |
| `20261010100054638-dashboard-capture-b2ebd5f7` | PASS | DPR 2에서 동일 native 전환 여정·장부 전체 덮기·그래프/화단 접합·분재 지속·세 번의 승인된 Pond 복귀 |

세 run 모두 선언된 `ephemeral`/`hidden` 환경을 사용했고 cleanup 7/7, 페이지 console error/warning/CSP 0건이다. 결정적 이미지를 직접 확인하고 해당 run을 pin했다. QA의 두 측정 결함은 소유 protocol에서 수정했다: CSSOM이 생략하는 기본 gradient 방향을 정규화하면서 두 stop의 alpha를 계속 검사하고, native drag는 기존 Furin owner와 동일하게 held left button 및 pressed bit를 함께 전달한다. 마지막 32개 native pointer/capture event를 제한적으로 기록해 제품 cancel과 입력 전달 실패를 구별한다. 이는 기능·시각 관측이며 물리 입력 latency/FPS 또는 성능 개선 수치를 의미하지 않는다.

남은 디자인 항목은 수관과 텍스트의 겹침, 장부 정보량·행 구성, 전체 한도와 설정 진입의 최종 조형이다. 이번 패치에서 분재 축소로 그 문제를 회피하지 않았다.

## Frame edge correction — 2026-10-10

사용자가 지적한 상단의 미세한 높이 차이와 하단의 추가 종이 띠를 구조 소유 지점에서 수정했다. `Scaler`는 landscape 프레임을 실제 비대칭 margin padding 안에 배치한다. 최종 프레임 크기와 위치 계산은 유지하면서, flex 중앙 배치 뒤 fractional translate를 더하던 중간 rasterization 좌표를 제거한다. 개별 패널을 1px씩 옮기거나 새 외곽선을 덧대지 않는다.

Home의 Bonsai support portal host는 내용이 비어 있을 때 공간을 차지하지 않는다. 기존 빈 래퍼가 항상 남기던 하단 8px padding을 없애 그래프와 화단이 직접 아래 프레임을 이루게 했다. 실제 지원 메시지가 생기면 기존처럼 측정 stage 밖의 정상 흐름에서만 공간을 사용한다. 연못·분재 geometry, renderer/ACK, 전환과 query 수명은 변경하지 않는다.

추가 수정은 개발 artifact `20261010102714-42cb4a5944f0-dirty`로 검증했다. viewport/capture/Home lifecycle 집중 테스트 3개 파일 33개, dashboard owner·QA architecture·docs paths·`git diff --check`가 통과했다. `dashboard/capture` exact run `20261010102655629-dashboard-capture-352fa891`(desktop-wide)와 `20261010102915117-dashboard-capture-6a023130`(desktop-retina→desktop-compact resize)는 모두 PASS이며 native 전환 여정과 기존 ACK 계약을 유지했다. 두 run 모두 `ephemeral`/`hidden`, cleanup 7/7, 페이지 error/warning/CSP 0건이다. DPR 2 초기 화면과 resize 후 장부를 포함한 결정적 캡처를 직접 확인했다.

wide 화면에서 frame/sidebar/stage top은 모두 28px이며, stage/그래프 bottom은 기존 824px에서 실제 shell bottom인 832px에 닿는다. resize 후에도 frame/sidebar/stage top 106px, stage/그래프 bottom 754px가 일치한다. PNG 첫 행을 읽어 sidebar의 기존 반투명 top row가 사라지고, 하단의 별도 밝은 행도 제거됐음을 확인했다. QA protocol은 이 외곽 정렬과 support host 점유 여부를 기록하고 검사한다. 전체 suite나 release/performance gate는 실행하지 않았다.

## Unconditional lower-frame boundary — 2026-10-10

최신 사용자 요청이 위의 조건부 support host 처리를 대체한다. Home 하단은 콘텐츠·로딩·분재 상태와 관계없이 출력 영역이 없는 경계다. support host DOM과 padding, portal, 전용 FeedbackLens, footer 전용 adapter·전달 prop 및 영어·한국어 번역을 삭제했다. 실제 Bonsai 경험·습관 신호와 Lab의 기능성 진단은 기존 owner에 남는다. 하단 프레임은 그래프와 화단 자체다.

공유 셸의 6개 테마와 Zen 탭의 경계 소유권을 추가 조사했다. 확정 결함·수정·정확한 브라우저 증거와 보존한 표현은 [frame boundary audit](../../../reports/dashboard-frame-boundary-audit-2026-10-10.md)에 기록한다. QA 외곽 검증은 support host 점유 여부에 따른 예외를 없애고, 가로 Garden의 stage와 graph가 항상 콘텐츠 하단에 닿도록 검사한다. 이전 artifact의 PASS는 최신 소스 검증을 대신하지 않는다.
