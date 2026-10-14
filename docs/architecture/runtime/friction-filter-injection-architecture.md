# Friction Filter Injection Architecture

- Status: Active
- Owner: nudge runtime
- Last validated against code: 2026-10-14
- Path policy: current-only
- Canonical for: current friction filter injection flow and prepaint visual runtime architecture

- Target-state companion:
  - `docs/architecture/runtime/content-runtime-target-architecture.md`
- Runtime effect companion:
  - `docs/architecture/repository/friction-nudge-effect-boundary-map.md`

> Storage architecture note: the current implementation follows `docs/architecture/storage/storage-architecture-target.md`. Settings are canonical in `chrome.storage.local`, stats facts are canonical in IndexedDB bucket stores, and the old generic `DataManager` path has been retired from app code.

이 문서는 현재 확장 프로그램의 필터 주입 구조를 명확하게 설명한다.  
핵심 목표는 다음 3가지다.

1. 첫 페인트 지연/깜빡임(FOUC) 최소화
2. 정책 계산 결과와의 일관성 유지
3. 예외 로직이 아닌 표준 2단계 초기화(2-phase init) 유지

## 1. 전체 흐름 요약

P1-C의 냉각 곡선은 background에서만 계산한다. `BudgetSnapshotReader`의
진행률을 0–16단계로 양자화하고 같은 modifier 결과를 envelope V2와 bootstrap에
싣는다. Lens의 `frictionModifierScale`은 사용자 세기와 별도인 합성 결과로서,
visual profile을 만들 때 한 번만 적용한다. 프리페인트·root visual·정식 적용은
같은 강도를 사용하며 content가 시간이나 진행률을 다시 계산하지 않는다.
단계 변경과 캐시 TTL 갱신의 소유권은
[Bootstrap friction snapshot](bootstrap-friction-snapshot-architecture.md)을 따른다.

현재 주입은 `document_start` 기준으로 시작되며, 아래 순서로 동작한다.

1. 백그라운드에서 managed content script를 `runAt: document_start`로 등록
2. 등록된 스크립트는 `loader`를 먼저 실행
3. `loader`가 root visual reader와 단일 content bootstrap 엔트리를 병렬 import
4. `loader`가 `bootstrap.root_visual`을 읽고 exact prepaint CSS를 동기적으로 억제한 상태에서 page-owned computed filter만 캡처한 뒤 같은 grayscale strength의 root visual을 inline으로 인계
5. exact root visual handoff가 끝난 뒤에만 `ContentBootstrapController`를 호출하고 bootstrap 상태를 background에 handshake
6. controller가 phase 1 receiver install을 먼저 수행한 뒤 `receiver_ready`를 handshake
7. controller가 sidecar를 기동하고 `active` 상태를 background에 handshake

shell 재진입 규칙:

- active bootstrap이 살아 있는 동안 loader 재주입은 no-op이어야 한다.
- explicit teardown으로 runtime state가 `stale` 또는 `failed`가 되면, 같은 document에서도 loader 재주입이 bootstrap 함수를 다시 호출할 수 있어야 한다.

ownership 고정 규칙:

- registration diff 계산은 `ManagedContentScriptSync`가 담당한다.
- open-tab catch-up 주입, receiver-missing recovery 주입, teardown은 `ContentScriptOrchestrator`만 수행한다.
- dashboard/debug 경로도 content에 직접 주입하지 않고 background action -> orchestrator -> `tabs.sendMessage` 순서를 따라야 한다.
- 최종 target state와 migration contract는 `docs/architecture/runtime/content-runtime-target-architecture.md`를 따른다.

## 2. 파일 책임 분리

### 주입 진입점

- `src/apps/background/services/TrackingService.js`
  - managed content script 파일 목록 소유
- `src/domains/tracking/background/ContentScriptOrchestrator.js`
  - content script 주입/대기/세션 상태 단일 오케스트레이션
  - open-tab catch-up injection / recovery injection / teardown 단일 owner
  - startup catch-up은 bounded concurrency로 수행해 대량 탭 환경에서도 주입 폭주를 피함
- `src/domains/tracking/background/ManagedContentScriptSync.js`
  - `runAt: document_start`로 content script 등록/갱신
  - catch-up 대상 탭 계산만 담당
- `src/domains/tracking/background/TabContentSessionRegistry.js`
  - 탭별 content bootstrap 상태 추적
- `src/apps/content/loader.js`
  - `content-bootstrap` 단일 엔트리 import
- `src/apps/content/bootstrapController.js`
  - receiver install -> `receiver_ready` -> sidecar -> `active` 순서 보장
- `src/apps/content/bootstrap/*`
  - bootstrap state publish/control channel/sidecar lifecycle용 내부 helper
  - 독립 owner seam이 아니라 `bootstrapController`의 내부 분해 단위
- `vite.config.js`
  - `content/bootstrap.js`를 독립 번들(`assets/content-bootstrap.js`)로 출력

### 필터 적용

- `src/domains/nudge/visual/visualManager.js`
  - 전역 CSS 변수/속성 기반 스타일 규칙 삽입
  - 자간(`letter-spacing`)은 transition 없이 즉시 반영
- `src/domains/protection/background/runtime/PrepaintVisualPlanCompiler.js`
  - `bootstrap.root_visual` entry를 dynamic CSS content script tier로 투영
- `src/domains/protection/content/prepaintVisualRuntime.js`
  - runtime 확정 apply/clear 시 prepaint CSS를 억제해 중복 filter 합성을 막음
- `src/platform/storage/bootstrap/BootstrapSnapshotRepository.js`
  - canonical `bootstrap.friction` 로드/검증/정리 레이어
- `src/domains/protection/background/runtime/FrictionBootstrapSnapshotBuilder.js`
  - background runtime에서 bootstrap/root visual용 최소 snapshot 구성
- `src/domains/protection/background/runtime/FrictionBootstrapCoordinator.js`
  - background-only write/invalidate 조정

운영 규칙:

- `bootstrap.friction`는 durable backup/export 대상이 아니다.
- reset/import 후에는 stale fast path를 막기 위해 snapshot을 먼저 비운 뒤 background가 다시 rebuild한다.

## 3. 2-Phase Init 상세

## 3.1 Phase 0: Prepaint Visual Tier

목적: 페이지 JS bootstrap보다 먼저 “안전한 핵심 root visual”을 CSS content script로 반영

동작:

1. background runtime이 `bootstrap.root_visual`을 background-owned cache로 기록
2. `ManagedContentScriptSync`가 fresh root visual entry를 prepaint visual plan으로 투영
3. plan은 compiled grayscale의 정수 0–100%와 1:1인 101개 CSS 자산 중 해당 host에 확정된 exact tier만 등록한다. 근사 tier 또는 nearest-tier 선택은 허용하지 않는다.
4. global permission mode에서도 prepaint CSS는 `*://*/*`를 사용하지 않는다
5. content `loader` 또는 runtime truth apply가 시작되면 `data-entropy-prepaint-suppressed="1"`을 설정해 CSS tier를 비활성화한다
6. prepaint registration은 `persistAcrossSessions: false`를 유지한다. CSS만으로는 snapshot의 `staleAfterEpochMs`를 판별하거나 만료 시 스스로 해제할 수 없으므로, 브라우저 재시작을 넘어 보존하면 stale 정책이 새 문서에 false-positive grayscale을 적용할 수 있다. persistent 전환은 restart/cold-start 시 stale registration이 첫 navigation 전에 제거됨을 증명하는 별도 계약 없이는 허용하지 않는다.

Prepaint tier는 새 정책 계산기가 아니다. `settings`를 다시 읽거나 차단 여부를 재판정하지 않고, 이미 확정된 `bootstrap.root_visual` entry에서만 파생된다.

## 3.2 Phase 1: Root Visual Refinement

목적: exact CSS tier를 document-start JS의 page-owned filter 합성으로 무변색 인계

동작:

1. `loader`가 canonical `bootstrap.root_visual` surface를 hostname으로 조회
2. fresh + `decision.shouldApply === true` + `rootFilter` 존재 시 한 synchronous task 안에서 exact prepaint CSS를 먼저 억제하고 page-owned computed filter를 읽은 뒤 같은 grayscale strength의 inline root filter를 적용한다. 따라서 prepaint tier는 baseline에 포함되지 않고 두 DOM mutation 사이에 paint도 발생하지 않으며 grayscale 강도 역시 변하지 않는다.
3. missing/stale/inactive이면 prepaint CSS를 즉시 억제하고 transition shell을 닫는다
4. bootstrap module import는 reader와 병렬로 진행하되 controller 실행은 exact root visual handoff 뒤로 barrier된다

## 3.3 Phase 2: Truth Sync (Authoritative Path)

목적: 실제 정책/설정을 기준으로 최종 상태를 확정

동작:

1. background protection runtime이 envelope를 content로 dispatch
2. content receiver가 prepaint CSS를 억제한 뒤 authoritative filter effects를 apply/clear
3. background가 protection dispatch 결과에서 다음 `bootstrap.friction`/`bootstrap.root_visual` snapshot을 재생성

핵심 원칙:

- 최종 진실 소스는 항상 background protection runtime 결과
- Prepaint/Root Visual 단계는 이전에 확정된 실행계획의 빠른 투영이다. 설정을 모른다고 임의의 약한 기본값을 먼저 적용하지 않는다. 같은 정책이면 runtime truth 인계 전후 강도는 같으며, 실제 정책이 달라진 경우에만 교정한다
- content는 더 이상 bootstrap snapshot의 canonical writer가 아니다
- `executeScript` ownership은 orchestrator seam 밖으로 새어나가면 안 된다

정책 강도 조정 원칙:

- 런타임 truth는 항상 최종 실행계획(`compiledFeatures`)이다. 엔진의 `filterPlan`은 정책 요청이며, content와 popup 진단은 실행계획만 본다.
- 정책은 사용자가 켜 둔 조절 가능 필터의 strength scale 또는 named band만 조정한다. 사용자가 꺼 둔 필터를 정책이 새로 켜는 것은 금지한다.
- 하드락 강제 활성화 경로와 hidden recipe는 retired 상태다. 사이트 캡, 스케줄, 글로벌 프로토콜도 사용자 설정 밖의 필터를 force-on 하지 않는다.
- Lens의 `blur`/`saturation`/`brightness`/`contrast`/`colorSaturation`은 정수 0–100 strength를 저장하고, `textRhythm`은 binary marker를 저장한다. compiled runtime에서만 `relaxed`/`normal`/`reinforced`와 물리값으로 물질화한다. 물리 child key나 별도 shuffle setting은 존재하지 않는다.
- 정책 modifier는 합산하지 않는다. Furin stay suspension, 목표 초과 강화, schedule relaxation, routine policy strengthening 순으로 판정한 뒤 별도의 전체화면 투영을 한 번 적용한다.
- 실행계획의 각 필터는 `executionSource`를 가진다: `user_config`, `policy`, `runtime_artifact`, `inactive`.

## 3.4 세 가지 적응형 프로필의 SSOT

Lens는 각 효과의 ON/OFF와 정수 0–100 strength를 독립적으로 제공한다.
다섯 저장 entry는 정확히 `{ isActive: boolean, value: integer 0..100 }`이다.
Text Rhythm만 `{ isActive: boolean, value: true }`인 binary marker를 유지한다.
`level`, `step`, `band`, compiled 물리값, `intensityAdjustment`는 저장하지 않는다.
현재 계약과 맞지 않는 presence는 변환·legacy fallback·자동 reset 없이 거부한다.
개발 프로필의 명시적 reset은 아래 §3.6을 따른다.

| 책임 | 단일 owner |
| --- | --- |
| 이름과 modifier intent `-1/0/+1` | `src/domains/settings/config/frictionIntensityBands.js` |
| 흑백·블러·미디어 tone 물리값 | `src/domains/settings/config/visualFrictionProfiles.js` |
| Text Rhythm 복합 물리값 | `src/domains/settings/config/textRhythmProfile.js` |
| 저장 strength/binary → 검증된 실행 profile | `src/domains/settings/config/adaptiveFrictionProfiles.js` |
| modifier 우선순위 판정 | `src/domains/protection/runtime/frictionModifierResolver.js` |
| 전체화면 허용 정책과 단일 프로필 투영 | `src/domains/protection/runtime/fullscreenVisualPolicy.js` |
| prepaint CSS와 등록 파일 identity | `src/domains/protection/content/prepaintVisualAssets.js` |
| 동일 정의에서 CSS asset 생성 | `scripts/release/prepaintVisualAssetsPlugin.mjs` |

다섯 child와 저장 key를 모두 유지한다. 주 조작은 채도·밝기·블러,
보조 disclosure는 대비·그레이스케일이다. `grayscale` child의 기존 `saturation`
저장 key는 페이지 전체 `grayscale()`과 prepaint를 맡고, `saturation` child는
별도 `colorSaturation` key로 이미지·영상의 `saturate()`를 맡는다.
한 효과의 ON/OFF나 strength 변경은 다른 효과를 켜지 않는다.

새 설정과 명시적 추천은 채도·밝기 ON, 블러·대비·그레이스케일 OFF다.
기존 사용자의 ON/OFF와 strength는 그대로 읽는다. 아래는 scale 1000에서
현재 기본 strength를 profile owner로 컴파일한 값이며 곡선 초기값이 아니다.

| 효과 | 기본 strength / 새 설정 | 완화 | 기본 | 강화 | 적용 영역 |
| --- | --- | --- | --- | --- | --- |
| 그레이스케일 | 70 / OFF | 42% | 70% | 95% | 페이지 전체 / prepaint |
| 블러 | 20 / OFF | 0.96px | 1.6px | 2.16px | 이미지·영상 |
| 밝기 | 20 / ON | 0.964 | 0.94 | 0.919 | 이미지·영상 |
| 대비 | 20 / OFF | 0.916 | 0.86 | 0.811 | 이미지·영상 |
| 채도 | 45 / ON | 0.73 | 0.55 | 0.39 | 이미지·영상 |

profile owner는 먼저 사용자 strength에 `strengthPermille / 1000`을 적용해
반올림한 뒤 band 배율 `0.6 / 1 / 1.35`를 적용·반올림하고 100으로 제한한다.
밝기의 최대 감소량은 0.3이다. 숫자는 이 owner에서만 결정하며 renderer·설정
UI·prepaint가 별도 강도표를 갖지 않는다. `buildMediaVisualFilterValue`는 활성화된 media child만
순서대로 합성하며 runtime과 dashboard preview가 같은 정의를 소비한다.
네 media child 중 하나만 활성화되어도 기존 media target/observer lifecycle을
사용한다. root/prepaint는 media tone을 적용하지 않는다. portrait short-form 보정은
블러에만 적용하며 기존 수치의 절반인 `min(1.3px, blur * 1.8 + 0.175px)`다.
이 geometry 보정은 추가 사용자 레벨이 아니다.

수정자는 레벨에 가산하지 않고 이름을 선택한다. 기본은 `normal`, 유효한
완화는 `relaxed`, 강화는 `reinforced`다. 같은 방향을 여러 번 적용해도
누적되지 않는다. 반대 방향의 우선순위가 같으면 `normal`이다.
일반 정책 강화(220) < 스케줄 완화(300) < Furin
초과 강화(400)이며 suspension(900)은 비활성화한다. 꺼진 설정은 켜지지 않는다.

백그라운드 실행계획과 bootstrap snapshot은 `band`, 그 band의 정확한
`value`, modifier의 양/음 방향 최고 우선순위와 출처를 함께 보존한다.
전체화면은 modifier 경쟁에 참가하지 않는다. background가 결정한
`fullscreenPolicy`를 소비해 한 번 투영한다. 종료 시 현재 background plan을
사용하며 local 결과를 다음 base로 누적하지 않는다.
설정·정책 변경 때에는 저장 strength와 binary에서 새 실행계획을 만든다.

Lens의 curve 모드에서 명시적으로 ON인 그레이스케일은 늦은 `text` slot을
사용한다. 채도·밝기·대비는 `tint`, 블러는 `blur` slot이다. standard의 16-step
양자화에서 그레이스케일의 첫 양수 단계는 목표 진행률 약 80.5%다. fixed 모드는
켜 둔 설정 strength를 즉시 사용하고, OFF는 마지막 단계에서도 켜지지 않는다.
이론적 경계와 실제 tracking 갱신 시점은 구분한다. slot·양자화의 단일 정의는
[Cooling curve runtime](cooling-curve-runtime.md) §4.2–4.3을 따른다.

렌더러는 검증된 실행값만 소비하고 저장 설정을 재물질화하지 않는다. popup과
indicator는 named band를 표시한다. artifact telemetry의 1/2/3 ordinal은
표현용 비율일 뿐 저장값·정책 입력·물리값 선택 근거가 아니다.
초기 CSS는 101개 자산 중 해당 host의 확정 grayscale tier 하나만 등록한다. 여러 번 필터링하는
구조가 아니며, 새 저장소 조회나 timer/observer 단계를 추가하지 않는다.

## 3.5 전체화면의 독립 시각 정책

`filterSettings.fullscreenVisualRelaxation`은 Lens의 독립 binary preference다.
새 설정의 기본값은 ON이며 VideoSkipGuard와 저장·표시·실행 의존성이 없다.
Lens 보조 토글은 항상 보인다. 다섯 시각 효과가 모두 OFF여도 선택을 보존하고
적용 조건을 안내한다. 이 preference는 자체 CSS effect가 아니다.

background resolver가 다섯 visual entry에 `fullscreenPolicy`를 선언한다.
content는 source 이름이나 목표·스케줄을 재해석하지 않는다.

| 기준 정책 | 전체화면 정책 | 최종 결과 |
| --- | --- | --- |
| 기본 | `step_down` | 완화 |
| 일반 강화 | `step_down` | 기본 |
| 스케줄 완화(일반 강화보다 우선) | `suspend_visuals` | 시각 효과 일시 해제 |
| 목표 소진/초과 | `blocked` | 강화 유지 |

`EnvelopeAdapter`는 canonical plan trace의 `budgetRatio >= 1`에서 목표 초과를
판정하고 adaptive feature에 `furin_overrun` intent를 생성한다. 전역 목표 소진은
`TrackingProtectionService`가 확정 policySummary의 `globalCapExceeded`에서 같은
intent를 생성한다. OFF 효과는 정책 근거를 보존해도 활성화하지 않는다. Furin
renderer 이벤트나 미연결 session writer를 기다리지 않는다. Text Rhythm은
목표 초과 강화를 따르지만 전체화면 대상은 아니다. 사용자 OFF와 scope 비활성,
명시적 suspension은 force-on하지 않는다.

`ProtectionFrictionModifierRuntime`은 video 또는 video를 포함한 fullscreen
element만 추적한다(F11/극장 모드는 아님). 중복 이벤트는 추가 apply를 만들지
않는다. 스케줄 종료·목표 소진·설정 변경은 새 background plan으로 재투영한다.
일시 해제는 `visualSuspensionReason: scheduled_fullscreen`인 실행 상태이며
저장 ON을 바꾸지 않는다. 앱 소유 blur·tone·grayscale만 제거하고 사이트 소유
filter와 다른 보호는 유지한다. 이 local 결과를 host bootstrap에 저장하지 않는다.

## 3.6 현재 설정 계약과 개발 프로필 초기화

SettingsPersistenceCapability는 저장된 filterSettings의 정확한 현재 계약을
read/write 경계에서 검증한다. cache hydration은 storage write를 만들지 않으며,
구형 visual level, 조합된 click/Enso 형식, Enso boolean 또는 빠진 필드는
변환·삭제·기본값 보정 없이 명시적으로 실패한다. 신규 프로필의 부재 값만
문서화된 초기값을 사용한다. 현재 계약과 맞지 않는 개발 프로필은
`docs/operations/runbooks/pre-release-development-profile-reset.md`의 명시적
whole-profile reset을 완료한 뒤 검증한다.

이번 Lens 분리 이전의 filterSettings에는 `brightness`/`contrast`/`colorSaturation`
entry가 없으므로 같은 현재 계약 검증에서 거부된다. 기존 기록이 있는 개발
프로필을 자동 보정하거나 초기화하지 않는다. 비교는 깨끗한 테스트 프로필에서
시작하거나 사용자가 명시적으로 선택한 whole-profile reset 이후에 수행한다.

현재 값은 `frequent | standard | spacious`이며 `ensoIntervalPolicy.js`가
8/12/20분을 단독 소유한다. normalizer와 renderer는 옛 boolean을 읽지 않는다.
public Tools의 Enso 선택은 모델 강도가 아니라 소비 시간 간격이다.
`EnvelopeAdapter`가 클릭과 Feed Horizon 양쪽에 같은 `intervalMs`를 전달하며,
정책 강화는 이 간격이나 OFF 선택을 바꾸지 않는다.

검증/읽기 실패는 hydration을 거부하며 통계·목표·사이트 목록·모델·보안 데이터를
수정하지 않는다. 이번 Lens 정리는 다섯 저장 key와 strength shape를 유지한다.
새 기본값은 기존 설정을 덮어쓰지 않으며 추천은 명시적 적용 때만 실행한다.
disposable-cache generation 6은 밝기 물리값과 늦은 그레이스케일 곡선이 이전
실행값과 섞이지 않도록 파생 bootstrap 문서만 무효화한다. 저장된 사용자
ON/OFF·strength와 통계·사이트·목표 데이터는 바꾸지 않는다.

## 4. Text Rhythm의 snapshot/runtime 분리

`bootstrap.friction`의 visual filter document에는 materialized `textRhythm`
profile이 포함될 수 있지만, document-start loader는 이 중 DOM text mutation을
실행하지 않는다. loader prepaint는 root filter만 보정하고, authoritative envelope가
도착한 뒤 `TextPipeline`이 profile의 CSS text 값과 shuffle 하위 profile을 함께
적용한다.

이유:

1. 자간·투명도·미세 블러와 문장 경계 셔플은 하나의 feature truth를 공유해야 함
2. DOM text mutation은 랜덤/상태 의존성이 있어 prepaint에서 실행하면 복원 점프가 생길 수 있음
3. shuffle manager는 authoritative compiled profile과 selector context를 받은 뒤에만 소유권을 잡아야 함
4. `relaxed` profile은 shuffle을 끄고, `normal`/`reinforced`만 exact canonical shuffle sub-profile을 전달함

따라서 public/storage key는 `textRhythm` 하나이고 `textShuffleManager`는 내부
실행 owner 이름일 뿐이다. `normal`/`reinforced`의 shuffle은 bounded word-order
displacement와 단어 내부 글자 교환을 함께 적용한다. 두 동작은 같은 canonical
profile과 정보성 토큰 보호 규칙을 사용한다. Retired lock trace metadata,
omission recipes, and content shield mounting are not active runtime paths.

### 4.1 Social identity and action text boundary (2026-10-01)

`src/domains/nudge/text/textTargetProfiles.js` owns the site-local shuffle exclusions.
Instagram anchor/role-link text represents account identity, mentions/hashtags, or
navigation/actions and is preserved. Reading prose outside those links remains
eligible. The link boundary also preserves identifiers when a host splits `@`/`#`
and its label across text nodes; no DOM token reassembly or second classifier is
introduced. TikTok creator-profile links (`/@...`, including canonical absolute
representations) are preserved separately from `/video/` reading destinations.
Generic reading links and YouTube video-title links retain their existing behavior.
The resolver/ledger still revalidate ownership on reparenting and on selector-owned
attribute changes, restoring text when its destination becomes excluded. Coverage:
`tests/textShuffleSocialIdentity.test.js` verifies identity/action preservation,
intentional prose shuffle, host rewrites, destination changes and disable restore.

## 5. 안정성 보장 포인트

1. `hostname` 스코프 분리
   - 다른 도메인 snapshot 오적용 방지
2. TTL 제한
   - 오래된 snapshot 재사용 방지
3. Best-effort bootstrap cache
   - background write 실패/early read 실패 시 fast path를 억제하고 authoritative runtime truth를 기다린다
4. 재동기화 우선
   - 항상 실제 정책 계산 결과가 최종 상태를 덮어씀

운영 hardening 표준:

- recovery 경로는 unit test만이 아니라 browser-like contract test로 검증한다.
- built artifact 경로는 `check-content-runtime-browser-like-contract.mjs`에서 `loader -> bootstrap -> teardown -> rebootstrap`까지 확인한다.
- recent content runtime event는 background bounded diagnostics buffer에 남기고, support action으로만 조회한다.
- startup/open-tab catch-up diagnostics는 requested count, deduped attempted count, failure count를 함께 남긴다.

## 6. 신규 필터 추가 시 규칙

어떤 필터를 early 적용할지 결정할 때 아래 기준을 사용한다.

1. Fast Path 허용
   - 단순 시각 효과
   - 부작용이 작고 즉시 적용 이득이 큼
2. Truth Only 권장
   - DOM 변형/랜덤/고비용 스캔/행동 개입
3. 공통
   - Phase 1/2 모두 동일한 적용 API를 사용
   - 별도 예외 분기 로직 추가 금지
4. 프로필 결정성
   - semantic Text Rhythm은 exact canonical profile만 허용하고 물리 child 값을 독립 조절하지 않음

## 7. 현재 구조의 설계 결론

현재 필터 주입 구조는 “예외 패치”가 아니라,  
`snapshot fast path -> authoritative truth sync`로 정형화된 표준 초기화 패턴이다.

이 구조는 첫 페인트 체감 개선과 정책 일관성을 동시에 만족시키며,  
유지보수 시에도 책임 경계(로드/검증/적용/동기화)가 명확하다.
