# Friction Visual Target QA Checklist

- Status: Active
- Owner: QA operations
- Last validated against code: 2026-08-11
- Path policy: current-only
- Canonical for: friction visual QA target checklist

## 목적
- 컨텐츠 블러가 사이트 DOM 변경에 견고하게 유지되는지 확인한다.
- UI 아이콘/아바타 오탐(과도한 블러)을 줄이고, 실제 컨텐츠 미디어 누락(미블러)을 줄인다.

## 현재 owner-specific 모델
- Behavior `feedObservationItemTargets`: 행동/피드 아이템 관측
- Visual Media `visualMediaCandidates`: 실제 블러 후보 미디어
- `visualMediaContexts`: 후보가 속해야 하는 owner-local 컨텍스트
- `visualMediaOverlayExempt`: 확장 자체 UI처럼 미디어 블러를 피해야 하는 오버레이
- `visualMediaMinWidth/MinHeight/MinArea`: 최소 크기 게이트
- `visualMediaExcludeKeywords`: 오탐 회피 키워드
- Interaction의 `rewardContainerTargets`, `rewardContentItemTargets`,
  `clickBoundaryHints`는 클릭 의미 판정 owner이며 Visual Media profile을
  fallback으로 사용하지 않는다.

참고 구현:
- `src/domains/nudge/targeting/siteIdentityCatalog.js`
- `src/domains/nudge/behavior/behaviorTargetProfiles.js`
- `src/domains/nudge/visual/mediaTargetProfiles.js`
- `src/domains/nudge/interaction/interactionTargetProfiles.js`
- `src/domains/nudge/visual/visualManager.js`
- `src/domains/nudge/behavior/BehaviorHub.js`

## 사이트별 기준값 (2026-08-11)
- Default
  - `minWidth`: `80`
  - `minHeight`: `48`
  - `minArea`: `3600`
  - `minLongestEdge`: `88`
  - `smallSquareEdgeMax`: `72`
- YouTube
  - `minWidth`: `64`
  - `minHeight`: `36`
  - `minArea`: `2300`
  - `minLongestEdge`: `72`
  - `smallSquareEdgeMax`: `64`
  - `wideAspectMinRatio`: `1.45`
  - `wideAspectMinArea`: `1700`
  - `wideAspectMinLongestEdge`: `58`
  - 주요 후보: `ytimg.com/vi*`, `ytd-thumbnail img`, `yt-thumbnail-view-model img`
- X
  - `minWidth`: `88`
  - `minHeight`: `60`
  - `minArea`: `5000`
  - `minLongestEdge`: `96`
  - `smallSquareEdgeMax`: `84`
  - 주요 후보: `tweetPhoto`, `card.wrapper`, `pbs.twimg.com/media`, `pbs.twimg.com/card_img`
  - 주요 제외 키워드: `avatar`, `profile`
- Instagram
  - `minWidth`: `90`
  - `minHeight`: `90`
  - `minArea`: `6200`
  - `minLongestEdge`: `100`
  - `smallSquareEdgeMax`: `92`
  - 주요 제외 키워드: `avatar`, `profile`

## 수동 검증 시나리오
1. YouTube 홈 피드
   - 일반 영상 썸네일 블러 적용 확인
   - 쇼츠 카드 썸네일 블러 적용 확인
   - 채널 아바타/배지 미블러(또는 hideIcons 정책대로 동작) 확인
2. YouTube 검색 결과
   - 리스트 썸네일 블러 적용 확인
   - 재생시간 배지/아이콘에 과도한 블러가 없는지 확인
3. X 피드
   - 트윗 내 이미지/비디오 블러 적용 확인
   - 프로필 아바타/작은 아이콘 미블러 확인
4. Instagram 피드/모달
   - 포스트 이미지/영상 블러 적용 확인
   - 프로필 썸네일/아이콘 오탐 여부 확인
5. 일반 사이트(unknown host)
   - 기사 썸네일, 카드 이미지가 블러되는지 확인
   - 네비게이션 로고/작은 아이콘 오탐 여부 확인

## 성능 체크
1. 첫 진입 후 스크롤 10초 동안 프레임 드랍 여부 확인
2. DOM 변동이 큰 피드에서 CPU 스파이크 여부 확인
3. `MutationObserver` 추가 노드 유입 시 블러 적용 지연 체감 확인

## 튜닝 규칙
1. 미블러가 많으면 `visualMediaMinArea`를 먼저 낮춘다.
2. 오탐이 많으면 `visualMediaExcludeKeywords`를 먼저 확장한다.
3. 작은 정사각형 오탐은 `visualMediaSmallSquareEdgeMax`를 조절한다.
4. 작은 가로 썸네일 미검출은 `visualMediaMinLongestEdge`를 먼저 낮춘다.
5. 그래도 해결 안 되면 사이트별 `visualMediaCandidates`를 더 구체화한다.
6. 후보가 맞지만 컨텍스트에서 빠지면 `visualMediaContexts`를 조정한다.
7. Behavior `feedObservationItemTargets`, Interaction reward/click targets,
   Visual Media `visualMediaCandidates`/`visualMediaContexts`를 owner별로 분리
   유지한다. 한 profile을 다른 owner의 fallback으로 쓰지 않는다.

## "작은 썸네일" 정의 (현재)
- 예시: `60x34`, `72x40` 같은 소형 가로 썸네일
- 특징: 절대 크기는 작지만, 가로 비율(대략 16:9 계열)이 뚜렷함
- 정책:
  - 기본 게이트(`minWidth/minHeight/minArea`)에 못 미쳐도,
  - YouTube에서 `wideAspectMin*` 조건을 만족하면 블러 적용 대상으로 인정
