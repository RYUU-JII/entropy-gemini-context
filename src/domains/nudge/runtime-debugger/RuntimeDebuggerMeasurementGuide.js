function createGuide({ probeId = null, title, purpose, steps, validSignals, caution }) {
  if (!title || !purpose || !Array.isArray(steps) || steps.length === 0) {
    throw new Error('RUNTIME_DEBUGGER_MEASUREMENT_GUIDE_INVALID');
  }
  return Object.freeze({
    probeId,
    title,
    purpose,
    steps: Object.freeze(steps.map((step) => Object.freeze({ ...step }))),
    validSignals: Object.freeze([...(validSignals || [])]),
    caution,
  });
}

export const RUNTIME_DEBUGGER_MEASUREMENT_GUIDES = Object.freeze({
  observer: createGuide({
    title: '공통 실측 순서',
    purpose: '한 세션에는 한 기능과 한 사용자 시나리오만 우선 담습니다.',
    steps: [
      {
        label: '대상 격리',
        text: '대시보드에서 현재 사이트와 측정할 효과 하나만 활성화하고 설정 적용을 기다립니다.',
      },
      {
        label: '기준점 선택',
        text: '초기 장착·전체 스캔은 새로고침 관측, 안정 상태의 변이 비용은 관측 시작 후 새 기준점을 사용합니다.',
      },
      {
        label: '대표 동작',
        text: '같은 스크롤·열기·경로 전환을 3~5회 반복하고 대상 카드가 측정됨으로 바뀌는지 확인합니다.',
      },
      {
        label: '증거 고정',
        text: '일시정지한 뒤 항목 요약과 개별 로그를 복사합니다. 교차 효과 비교가 필요할 때만 전체 리포트를 씁니다.',
      },
    ],
    validSignals: [
      '대상 probe가 측정됨이고 작업 변화량이 1 이상',
      '계측 오류가 없고 기준점 이후 이벤트가 존재',
    ],
    caution: '비활성·사용 불가·대기 중·0/0은 좋은 성능이 아니라 측정되지 않은 상태입니다.',
  }),
  protection: createGuide({
    probeId: 'observerHub',
    title: 'Observer Hub 실측',
    purpose: '공유 MutationObserver의 flush 비용과 실제 구독자 전달 비용을 분리해 봅니다.',
    steps: [
      {
        label: '활성 조건',
        text: 'observer를 쓰는 효과를 하나 이상 켜고 구독자 수가 1 이상인지 확인합니다. 단일 효과만 켜야 귀속이 선명합니다.',
      },
      {
        label: '기준점',
        text: '초기 구독 비용은 새로고침 관측으로, steady-state 비용은 페이지가 안정된 뒤 새 기준점으로 잡습니다.',
      },
      {
        label: 'DOM 자극',
        text: '피드 스크롤, 댓글·모달 열기, SPA 경로 전환처럼 실제 DOM 변화를 만드는 동작을 3~5회 반복합니다.',
      },
      {
        label: '판독',
        text: '최근 flush의 mutation 수·시간과 구독자별 호출·동기 전달 시간을 함께 복사합니다.',
      },
    ],
    validSignals: [
      'flush와 mutation 변화량이 모두 1 이상',
      'recent flush와 subscriber counter가 같은 구간에 존재',
    ],
    caution: 'Observer Hub의 전체 mutation 수는 공유 입력량입니다. 특정 효과 처리량으로 직접 해석하지 않습니다.',
  }),
  social: createGuide({
    probeId: 'socialMetrics',
    title: 'Social Metrics 실측',
    purpose: 'selector·semantic 후보 폭, 결정 수율, 반복 target 처리를 실제 활성 세션에서 측정합니다.',
    steps: [
      {
        label: '활성 조건',
        text: 'Veil을 켜고 feedbackCounts·viewCounts·timeSignals·audienceCounts 중 하나 이상을 켭니다. active key, metric key, plan, observer를 확인합니다.',
      },
      {
        label: '초기 비용',
        text: '새로고침 관측으로 시작해 초기 full scan을 포함합니다. 소유자가 기준점 뒤에 로드됐다면 준비 후 새 기준점을 누릅니다.',
      },
      {
        label: '표준 감사',
        text: '심층 감사를 끈 채 피드 스크롤, 댓글 열기, SPA 전환을 반복해 product selector와 semantic 비용을 먼저 측정합니다.',
      },
      {
        label: '심층 감사',
        text: 'selector별 hit가 필요할 때만 별도 기준점에서 짧게 켜고 같은 동작 한 세트를 반복한 뒤 즉시 끕니다.',
      },
    ],
    validSignals: [
      'activeFilterKeys에 socialMetrics, activeMetricKeys가 1개 이상',
      'compiledPlanCount > 0, observerAttached=true, scan operation > 0',
      'selector 또는 decision 분모가 1 이상',
    ],
    caution: '심층 감사의 selector probe 시간은 디버거 오버헤드입니다. 표준 감사 결과와 같은 세션처럼 섞지 않습니다.',
  }),
  visual: createGuide({
    probeId: 'visual',
    title: 'Visual Media Filter (Blur) 실측',
    purpose: '미디어 후보 탐색, dirty-root 축소, 중복 style write와 재검사 비용을 봅니다.',
    steps: [
      {
        label: '활성 조건',
        text: 'Blur를 켜고 media filter active와 observer 연결을 확인합니다. Grayscale 같은 root-only 효과는 이 probe 대상이 아닙니다.',
      },
      {
        label: '초기 비용',
        text: '기존 이미지·영상의 initial_full 비용은 새로고침 관측으로 잡습니다.',
      },
      {
        label: '동적 비용',
        text: 'lazy image/video 로드, carousel·modal 열기, SPA 전환으로 새 미디어와 관련 root를 만듭니다.',
      },
      {
        label: '판독',
        text: 'incoming/relevant roots, discovered/unique targets, writes/noops/restores와 dimension recheck를 비교합니다.',
      },
    ],
    validSignals: [
      'initial_full 또는 observer operation이 1회 이상',
      '대상 시나리오에서 relevant root 또는 discovered target이 증가',
    ],
    caution: 'Grayscale만 켠 상태의 inactive는 정상입니다. Blur에서 같은 미디어의 writes가 계속 늘거나 incoming 대비 relevant root가 지나치게 낮으면 누수 후보입니다.',
  }),
  text: createGuide({
    probeId: 'textShuffle',
    title: 'Text Shuffle 실측',
    purpose: '초기 text traversal, mutation queue, unchanged 재방문 비용을 측정합니다.',
    steps: [
      {
        label: '활성 조건',
        text: 'Text Rhythm에서 Text Shuffle이 실제 활성되는 단계(현재 Lv3)를 켜고 active와 observer 연결을 확인합니다.',
      },
      {
        label: '초기 비용',
        text: '새로고침 관측으로 initial chunk와 초기 queue drain을 포함합니다.',
      },
      {
        label: '동적 비용',
        text: '댓글·본문 펼치기, 피드 caption 추가, SPA 전환처럼 새 텍스트 subtree가 생기는 동작을 반복합니다.',
      },
      {
        label: '판독',
        text: 'visited/processed/unchanged, queue wait, coalesced node, pending queue가 안정 후 0으로 수렴하는지 봅니다.',
      },
    ],
    validSignals: [
      'initial_chunk 또는 mutation_flush operation이 1회 이상',
      'visited와 processed 변화량 및 queue wait가 기록',
    ],
    caution: 'visited 대비 unchanged가 반복해서 크거나 대기 queue가 줄지 않으면 불필요한 재방문 후보입니다.',
  }),
  short: createGuide({
    probeId: 'shortForm',
    title: 'Short-form Block 실측',
    purpose: '초기·URL·observer refresh가 같은 short-form 후보를 반복 처리하는지 확인합니다.',
    steps: [
      {
        label: '활성 조건',
        text: 'Short-form Block을 켜고 YouTube Shorts·Instagram Reels 같은 지원 surface에서 active와 observer를 확인합니다.',
      },
      {
        label: '초기 비용',
        text: '지원 경로에서 새로고침 관측으로 initial refresh와 기존 후보 정리를 포함합니다.',
      },
      {
        label: '동적 비용',
        text: 'short-form 항목을 3~5개 이동하고 일반 경로↔short-form 경로 전환을 한 차례 반복합니다.',
      },
      {
        label: '판독',
        text: 'initial/url/observer roots와 candidates, pruned, hidden/removed, noops의 증가 구간을 비교합니다.',
      },
    ],
    validSignals: [
      'initial, url_event/url_poll 또는 observer operation이 1회 이상',
      '지원 surface에서 candidate와 prune 결과가 기록',
    ],
    caution: '지원하지 않는 경로나 이미 제거된 surface의 0은 효율이 아닙니다. URL poll과 observer가 같은 후보를 겹쳐 처리하는지 봅니다.',
  }),
  'video-observer': createGuide({
    probeId: 'videoObservation',
    title: 'Video Element Observer 실측',
    purpose: '공유 video registry의 문서·shadow-root 탐색과 subscriber 전달 중복을 측정합니다.',
    steps: [
      {
        label: '활성 조건',
        text: 'Video Skip Guard처럼 video registry를 소비하는 기능을 켜고 subscriber와 observer 연결을 확인합니다.',
      },
      {
        label: '초기 비용',
        text: '기존 player가 있는 페이지에서 새로고침 관측으로 initial scan과 include-existing 전달을 포함합니다.',
      },
      {
        label: '동적 비용',
        text: 'SPA 영상 전환, Shorts 이동, player 재마운트로 video 추가·제거를 3~5회 만듭니다.',
      },
      {
        label: '판독',
        text: 'videos found/unique, added/removed, delivery attempts/deliveries/skips, retries와 shadow observer 수를 비교합니다.',
      },
    ],
    validSignals: [
      'initial/include-existing/observer operation이 1회 이상',
      '실제 video 변화에 맞춰 unique video와 delivery가 증가',
    ],
    caution: '이 탭은 공유 video 발견 비용입니다. seek 차단 판단은 스킵 탭과 분리해 읽습니다.',
  }),
  click: createGuide({
    probeId: 'clickGate',
    title: 'Click Gate 실측',
    purpose: '실제 클릭의 target resolution, bypass, delay, Enso admission 판정을 검증합니다.',
    steps: [
      {
        label: '활성 조건',
        text: '의도 문턱(ensoGate)을 켜고 active 상태를 확인한 뒤 새 기준점을 잡습니다. 클릭 일시정지는 clickDelay로 별도 확인합니다.',
      },
      {
        label: '대상 세트',
        text: '보상성 링크·일반 버튼·YouTube 재생 컨트롤처럼 지연 대상과 bypass 대상을 각각 실제로 클릭합니다.',
      },
      {
        label: '반복',
        text: '같은 종류를 3회 정도 반복해 delayed/bypassed/blocked/replayed 판정과 selector·boundary 근거를 모읍니다.',
      },
      {
        label: '의식 UI',
        text: 'Enso 강제스폰은 표시·제스처 확인용 별도 세션에서만 사용하고 실제 admission 측정과 섞지 않습니다.',
      },
    ],
    validSignals: [
      'click_routing_decision이 1회 이상',
      'raw target, resolved target, selector ladder와 boundary 근거가 존재',
    ],
    caution: '강제스폰 성공은 production Enso admission 성공을 뜻하지 않습니다. 실제 클릭 판정과 별도로 보고합니다.',
  }),
  video: createGuide({
    probeId: 'videoSkip',
    title: 'Video Skip Guard 실측',
    purpose: 'video attach 시점과 user/programmatic seek 분류, 차단·복원 흐름을 확인합니다.',
    steps: [
      {
        label: '활성 조건',
        text: 'Video Skip Guard를 켜고 HTML video가 있는 페이지에서 새로고침 관측을 시작합니다.',
      },
      {
        label: '장착 확인',
        text: 'video_attached와 video_handlers_attached가 보인 뒤 seek 테스트를 시작합니다.',
      },
      {
        label: 'seek 세트',
        text: '진행 막대·키보드로 사용자 seek를 하고, 가능하면 자동 전환·player 내부 programmatic seek도 한 차례 관측합니다.',
      },
      {
        label: '판독',
        text: '마지막 seek 판단의 gestureRecent/mediaContext/event 신뢰도와 blocked/allowed, revert 완료를 함께 봅니다.',
      },
    ],
    validSignals: [
      'video와 handler 장착 이벤트가 존재',
      'seeking 뒤 decisive seek event가 1회 이상',
    ],
    caution: '레벨별 cooldown·hard block 정책이 다릅니다. 장착 실패와 정책상 허용을 같은 실패로 해석하지 않습니다.',
  }),
  feed: createGuide({
    probeId: 'feedFlow',
    title: 'Feed Flow 실측',
    purpose: 'feed supply step, demand, semantic readiness와 endpoint 관측 비용을 측정합니다.',
    steps: [
      {
        label: '활성 조건',
        text: 'Feed Horizon 계열 기능을 켜고 지원 feed에서 active, container key, readout 존재를 확인합니다.',
      },
      {
        label: '기준점',
        text: '새로고침 관측으로 feed container 발견부터 포함하거나, container가 안정된 뒤 새 기준점으로 steady-state를 분리합니다.',
      },
      {
        label: '스크롤',
        text: '새 항목이 실제 공급되도록 연속 스크롤하고 totalSteps가 최소 4 이상 증가할 때까지 한 차례 멈춤·재개를 포함합니다.',
      },
      {
        label: '작동 분리',
        text: '먼저 Horizon → Enso의 admission 차단 사유와 phase를 읽습니다. Terminus dry-run은 passive 비용 캡처를 끝낸 뒤 별도 기준점에서 endpoint 구조만 확인하고 바로 끕니다.',
      },
    ],
    validSignals: [
      'totalSteps 변화량이 1 이상이고 container key가 안정적이며, 이는 공급 관측 신호로 해석',
      'probe operationCount는 prefetch를 포함할 수 있는 totalSteps가 아니라 ledger.counters.advanceCount delta로 판정',
      'semantic state와 readiness가 stale이 아닌 현재 판정',
    ],
    caution: 'dry-run은 debug-only admission으로 실제 DOM endpoint를 쓰지만 production Enso를 열지는 않습니다. 관측 전용 세션과 섞으면 비용 결과를 오염시킵니다.',
  }),
  sentinel: createGuide({
    probeId: 'sentinel',
    title: 'Sentinel Protocol 실측',
    purpose: 'sender-tab 범위의 launch·phase·terminal timeline 연결을 확인합니다.',
    steps: [
      {
        label: '기준점',
        text: '새 기준점을 잡고 Site Furin 또는 Global Sentinel 중 하나만 선택합니다.',
      },
      {
        label: '실행',
        text: '선택한 버튼으로 protocol을 열고 진입·완료 또는 취소까지 한 흐름을 수행합니다.',
      },
      {
        label: '동기화',
        text: 'last launch 결과와 timeline update 시각이 갱신될 때까지 기다립니다.',
      },
      {
        label: '판독',
        text: 'timeline entry의 phase/status/source/scope와 Global Sentinel game telemetry를 함께 복사합니다.',
      },
    ],
    validSignals: [
      'lastLaunch success 또는 명시적 error가 존재',
      'timeline totalEntries가 기준점 이후 증가',
    ],
    caution: '디버거 launch는 protocol 표시·연결 검사입니다. production admission 빈도를 측정한 것으로 해석하지 않습니다.',
  }),
  log: createGuide({
    title: '캡처 마감과 복사',
    purpose: '세션이 진단 가능한 상태인지 확인한 뒤 가장 작은 증거 묶음을 복사합니다.',
    steps: [
      {
        label: '정지',
        text: '대표 동작이 끝나면 일시정지해 샘플 구간을 고정합니다.',
      },
      {
        label: '오류 확인',
        text: '디버거 오류와 최근 개별 작업을 확인하고 sample_tick·render·copy 오류가 있으면 먼저 분리합니다.',
      },
      {
        label: '항목 복사',
        text: '한 효과 진단은 해당 탭의 항목 요약과 개별 로그를 사용합니다.',
      },
      {
        label: '전체 복사',
        text: '여러 probe의 상관관계가 필요할 때만 전체 리포트를 복사하고, 원본 재현이 필요할 때 JSON을 추가합니다.',
      },
    ],
    validSignals: [
      '변화 샘플과 개별 이벤트가 대표 동작 시간대에 존재',
      '진단 대상 probe가 측정됨 상태',
    ],
    caution: '샘플 읽기 횟수는 처리량이 아닙니다. producer operation과 event 변화량을 증거로 사용합니다.',
  }),
});

export function getRuntimeDebuggerMeasurementGuide(tabId) {
  const normalizedTabId = String(tabId || '').trim();
  const guide = RUNTIME_DEBUGGER_MEASUREMENT_GUIDES[normalizedTabId];
  if (!guide) {
    throw new Error(`RUNTIME_DEBUGGER_MEASUREMENT_GUIDE_REQUIRED:${normalizedTabId || 'empty'}`);
  }
  return guide;
}

export default getRuntimeDebuggerMeasurementGuide;
