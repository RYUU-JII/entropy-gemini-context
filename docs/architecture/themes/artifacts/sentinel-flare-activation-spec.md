# Sentinel Flare Activation Spec

- Status: Active
- Owner: artifact runtime
- Last validated against code: 2026-10-13
- Path policy: planning-allowed
- Canonical for: sentinel flare activation contract
- Companion to:
  - `docs/architecture/repository/nudge-main-runtime-boundary-map.md`
  - `docs/architecture/repository/nudge-worker-runtime-boundary-map.md`
  - `docs/architecture/themes/artifacts/sentinel-flare-site-furin-chime-spec.md`

이 문서는 `sentinelFlare`의 발동 조건, 상태 표현, 런타임 시퀀스를 정의한다.

## 0) 세계관 의도

`sentinelFlare`는 단순 경고창이 아니다. 사용자가 웹 서비스의 즉시 보상 루프에 다시 동기화되고 있음을 관측하고, 그 순간을 자각하도록 만드는 개입 프로토콜이다.

Zen/Furin 표현에서 후린은 과거의 사용자가 미래의 자신에게 설치한 시뮬레이션 브레이크 호출이다. 유색 식신 잉어는 사용자의 호출을 전달하고, 그 그림자로 위장한 센티넬은 연결이 끊기면 시스템의 복구 프로토콜을 실행한다. 그림자 잉어는 장식용 생물이 아니라 웹 환경 아래에서 움직이던 감시 구조가 드러난 흔적이다. 사용자는 화면을 통과하기 전에 "나는 지금 시뮬레이션 붕괴를 관측하고 있다"는 감각을 받아야 한다. 연출의 감정은 차갑고 우아한 디지털 글리치 코스믹 호러이며, 움직임을 계속 쌓기보다 크기와 정적, 같은 존재의 재등장으로 긴장을 만든다.

프로토콜의 제품 목표는 "너 오늘 이만큼 썼다"를 설명하는 데서 끝나지 않는다. 발동 중에는 사용자가 원래 읽던 글, 보던 영상, 피드 보상 루프에서 심리적으로 멀어져야 한다. 프로토콜 종료 후에는 즉시 원래 콘텐츠 탐닉 리듬으로 복귀하기보다, 잠깐이라도 전두엽의 속도가 낮아지고 나가고 싶은 선택지가 실제 선택처럼 느껴져야 한다.

`site`와 `global`은 같은 artifact에서 파생되지만 세계관 역할이 다르다.

- `site`: 현재 사이트의 사용 목표가 흐트러졌을 때 흩어진 주의를 한 물결로 귀환시키고, 페이지로 돌아갈 이유를 다시 선택하게 하는 프로토콜이다.
- `global`: 예산 초과를 알리는 경보가 아니다. 예산 조건이 미리 설치된 시뮬레이션 균열 장치를 작동시키고, 그 크래시를 복구하기 위해 그림자 잉어/센티넬이 출동해 사용자를 다시 매끈한 콘텐츠 시뮬레이션으로 동기화하려는 프로토콜이다.

따라서 global 프로토콜의 사용자-facing 언어는 "경고", "예산 초과", "관리자 알림"이 아니라 "크래시", "표백", "봉합", "균열", "동기화", "센티넬 복구"여야 한다. 중립 runtime 필드는 계속 `site`, `global`, `scope`, `intensity`, `reason`을 사용한다.

세계관 용어는 표시/연출 계층에서만 사용한다. 정책, storage, background 판단은 `site`, `global`, `scope`, `intensity`, `reason` 같은 중립 계약을 사용한다.

### 0.1) 철학 캐논

이 artifact의 세계관은 선/악 대립이 아니다. 웹 환경은 벗어나야만 하는 악이 아니라 인간의 욕망, 기억, 관계, 노동, 상상력이 축적된 또 하나의 생활권이다. 문제는 그 생활권의 무게중심이 이윤 최적화, 추천 알고리즘, 탐욕적인 설계 압력, 그리고 해킹당한 인간 인지의 결합으로 인해 개인의 주도권 바깥으로 기울어졌다는 점이다.

`sentinelFlare`는 웹을 파괴하거나 사용자를 처벌하는 장치가 아니다. 이 artifact는 기울어진 관성 안에서 사용자가 자신의 리듬과 선택권을 잠시 회수하도록 만든다. 따라서 성공 연출의 감정은 "악한 세계를 무찔렀다"가 아니라 "기울어진 동기화를 끊고 자기 호흡으로 돌아왔다"에 가깝다. 실패 연출 역시 심판이 아니라, 시스템의 항상성이 사용자를 다시 매끈한 흐름에 맞춘 상태다.

### 0.2) 잉어 존재론

Site Furin은 사용자가 정한 사이트 시간의 한 구간이 끝났음을 풍경의 여운으로 알린다. 아티팩트와 같은 Furin이 내려오고 바람에 반응하며, full 2.5초/brief 1초의 표시된 시간 뒤 나가기/계속 보기를 선택한다. 소비 속도나 주의력을 진단하지 않고, 포인터 움직임은 진행 조건이 아니다. Global Sentinel의 simulation break와 Room 478 세계관은 기존 계약을 유지한다.

### 0.3) 적용 범위와 전염 방지

이 세계관은 `sentinelFlare` artifact, 그 하위 `site_furin`/`global_sentinel` 프로토콜, 성공 후 Room 478 감압 공간, 실패 후 global residue/poisoned reward 연출에만 적용한다.

다음으로 확장하지 않는다.

- 다른 artifact family의 canonical 철학
- Zen theme 전체의 기본 세계관
- storage, policy, protection decision, permission, telemetry schema의 용어
- dashboard 일반 copy의 기본 어휘
- 다른 theme의 artifact 표현

공통 아키텍처 문서에서는 이 내용을 "Furin/Sentinel Flare의 하위 연출 캐논"으로만 참조한다. 새 기능이 이 세계관을 써야 한다면 `sentinelFlare`의 하위 기능인지 먼저 확인하고, 아니라면 별도의 artifact 문서에 독립 근거를 남긴다. 임의로 "웹=시뮬레이션", "그림자=시스템", "탈출=성공" 같은 해석을 다른 계층의 기본값으로 승격하지 않는다.

## 1) 범위

- 대상 artifact key: `sentinelFlare` (고정)
- 목적: 설정 변경/탭 이동/실행 중 동기화에서 일관된 개입 동작 유지
- 전제: 내부 로직 용어는 중립, 테마 세계관 용어는 표시 계층에서만 사용

## 2) 발동 데이터 모델

- Site 기준: 사용자가 명시한 사이트 하루 목표와 해당 사이트의 기록이 허용된 실제 activity-day 사용 시간
- Global 기준: 기존 canonical Global cap과 기록된 보호 사이트 전체 사용 시간. 현재 사이트의 기록 제외가 다른 사이트의 유효한 Global 기록까지 지우지 않는다.
- 전역/개별 목표의 owner: protection runtime 입력·dispatch와 정확한 `goalBinding`; 개인 사용 기준/reference target은 목표 Furin을 새로 만들지 않는다.
- `nudgeConfig.enabled`: Furin 사용 여부만 소유
- `nudgeConfig.thresholdMs`: canonical stored shape에서 폐기되었으며 입력 정규화 시 제거한다. 공개 컨트롤이나 runtime fallback으로 복원하지 않는다.
- 명시한 Site 목표와 Global cap이 모두 없으면 정상 목표 발동을 만들지 않고 `protocol_target_unavailable`로 종료한다.

### 2.1) 프로토콜 범위

모든 발동은 runtime payload에서 다음 범위 중 하나로 정규화된다.

- `site`: 현재 도메인의 명시한 하루 목표가 실제로 도달했고 아직 전달되지 않은 경우
- `global`: Global 하루 목표가 실제로 도달했고 아직 전달되지 않은 경우

새 후보는 실제 도달·미전달 Global, Site 순서로 고른다. 둘 다 도달한 현재 사이트만
`combined_goals`로 함께 알릴 수 있다. Global에 가까워졌다는 이유로 미리 승격하지 않으며,
Global 전달 뒤에도 다른 Site 목표는 짧은 Furin으로 남긴다. 실제 표시와 Site 끝맺음의
정본은 [일일 전달 정책](../../runtime/furin-daily-delivery-policy.md)이며,
기존 일반 개입을 빼앗거나 가짜 Site 표시/선택 완료를 만들지 않는다.

### 2.2) Runtime Payload Contract

`NUDGE_START.payload.config`는 다음 중립 필드를 포함할 수 있다.

- `protocolScope`: `site` 또는 `global`
- `protocolIntensity`: `0.35..1.0` 범위의 연출/제동 강도
- `protocolVariant`: 표시 계층에서 사용하는 좁은 변형 id
- `escalationReason`: `site_target`, `global_budget`, `debt_retry`, `debug` 등 진단 가능한 사유. 폐기한 `near_global_combined`는 오류로 거절한다.
- 자동 `NUDGE_START.payload.goalBinding`: 원래 run·tab·document·profile·host·day·목표·전달 범위를 고정하는 중립 계약. 표시용 config나 진단 cache가 권한을 대신하지 않는다.
- `hudVisible`: 기본값 `false`. 좌상단 HUD는 사용자-facing 연출이 아니라 진단 표시로 취급하며, 명시적 debug payload에서만 켠다.

content runtime과 worker는 이 값을 읽어 연출 강도와 pacing을 조정한다. 이 값은 storage source of truth가 아니며, 특정 발동 세션에 대한 runtime command payload다.

## 3) 대시보드 상태 모델

대시보드는 두 계층의 상태를 함께 가진다.

설정 계층은 `sentinelFlare.enabled` 하나뿐이다. 공개 UI는 ON/OFF만
변경하며, 전역 캡과 사이트별 캡은 아래 runtime 상태/target feedback으로
표현한다. 분 단위 preset은 설정 계층에 존재하지 않는다.

Tools의 Furin dock는 ON/OFF와 현재 시간 연결/대기를 한곳에 표시한다. 전체·개별 시간 편집은 Sites만 소유한다. Tools 토글은 `nudgeConfig`만, Sites 전체 한도는 `globalGoal`만 저장하며 새 설치 intent나 별도 설치·replay 진입점은 만들지 않는다.

설정 ON은 시간 미설정이나 기록 OFF에서도 유지된다. `furinTimeAvailability.js`는 `resolveSitesRecordingPolicy`와 `resolveTimeCapAvailability`를 사용하여 기록 가능한 전체·개별 한도 연결만 요약한다. 보호 대상 없음, 시간 미설정, 기록 OFF, 동의 미승인, 기록 제외는 기존 reserved feedback에 대기 사유로 표시하고 필요한 Sites 또는 기록 설정으로 이어지는 행동 하나만 제공한다. 이 설명은 설정의 적용 가능성을 나타내며 foreground·일일 delivery·현재 runtime engagement를 추측하지 않는다. 가족/전체 일시 정지 상태도 ON 설정과 구분한다.

기존 설치 사실과 pending intent는 guidance owner가 유지한다. 지연된 저장 확인의 실제 visible paint/dismiss는 시간 집계나 실제 Furin delivery 성공을 의미하지 않는다.

- 카드 요약 상태:
- `OFF`: artifact disabled
- `UNCONFIGURED`: enabled + 전역/개별 목표 없음
- `MONITORING`: enabled + 하나 이상의 목표 존재 + breach 없음
- `TRIGGERED`: breach 존재

- runtime chip 상태:
- `disabled`: protection runtime에서 artifact 미사용
- `armed`: 조건 대기 중
- `engaged`: 개입 발동 중
- `cleanup`: 정리/후처리 단계
- `unavailable`: 활성 탭 문맥이 없거나 cached runtime snapshot이 없음

표시 라벨 정책:
- base 번역은 중립 용어
- 테마별 context 번역에서만 세계관 용어로 치환

## 4) 런타임 시퀀스

1. Background가 목표/노출량 평가
2. Background가 `protocolScope`, `protocolIntensity`, `protocolVariant`, `escalationReason`을 산출
3. 조건 충족 시 `NUDGE_START` 전송
4. Content가 정확한 목표 binding과 현재 화면의 안전한 경계를 준비
5. 지원 피드에서는 Horizon 실제 만남과 새로운 계속 행동 뒤 같은 lease로 Furin에 진입. 선언한 비피드에서는 준비 허가가 있는 새 콘텐츠 선택만 허용. 목표 변경 시 정확한 이전 준비를 정리하고 새 조건을 재검증.
6. 내부 ramp 진행(`protocol.rampMs`), `hudVisible` debug payload에서만 HUD 표시
7. 사용자 액션:
- continue -> `NUDGE_RESOLVED(reason=continue)`
- dashboard -> `NUDGE_RESOLVED(reason=dashboard)`
- 이탈/종료 -> `NUDGE_ABORTED(...)`

목표 도달은 즉시 화면 표시 허가가 아니다. Site·Global 모두 현재 콘텐츠를 보존하는
검증된 경계에서만 진입한다. 일반 pause/ended·스크롤 정지·idle·시간 만료는 완료 증거가
아니며, 지원하지 않는 화면은 대기/지원 확인 상태를 남긴다. hard cap으로 표시를 강제하지
않는다. 정본은 [공통 피드 경계](../../runtime/feed-flow-runtime-target-architecture.md)와
[개입 admission](../../runtime/intervention-admission-runtime.md)이다.

사용자-facing 진행도는 HUD나 숫자/막대가 아니라 세계의 상태 변화로 표현한다. HUD는 진단용이며 일반 연출의 중심이 아니다.

## 4.1) Site Protocol

사이트 프로토콜은 특정 도메인에 사용자가 다시 동기화되고 있음을 차분하게 드러내는 개입이다.

- 목적: 자동조종을 끊고 현재 사이트에 머무는 이유를 다시 선택하게 한다. 프로토콜이 진행되는 동안 페이지와 미디어에서 심리적으로 한 발 물러나야 한다.
- 의식: 중앙 Furin의 탄력 있는 등장과 한 번의 바람, 짧은 여운, 명시 선택. 길이는 실제 표시된 시간으로만 센다.
- 배경: 페이지 구조를 바꾸지 않는 블러·암전·비네트. 미디어 재생과 배경 스크롤은 선택까지 잠근다.
- 정본: [Site Furin chime spec](./sentinel-flare-site-furin-chime-spec.md). 잉어 귀환 의식은 별도 아카이브이며 활성 호출 경로가 없다.

### 4.3.1) Core Loop

1. `armed`: background 조건은 충족됐지만 화면 commit은 아직 보류한다. 가능한 경우 reward entry, feed/item boundary, media transition, scroll stop, short idle을 기다린다.
2. `awaiting_start`: commit 후 즉시 전체 LCD 장면으로 덮지 않는다. 페이지는 살아 있는 것처럼 보이고, 사용자는 스크롤로 현재 페이지가 여전히 존재함을 확인할 수 있다. 유색 식신과 붙어 있는 그림자가 접촉을 기다린다. 다른 입력은 protocol gate가 흡수하고 starter koi가 반응한다.
3. `starter_click`: 사용자가 starter koi를 명시적으로 클릭/탭하거나 동등한 semantic action을 실행하면 그 지점이 한 판의 crack origin이 된다. 포인터 입력은 적중 좌표를, semantic action은 worker가 선택한 실제 starter 중심을 사용한다. 이 입력은 permission prompt가 아니라 diegetic consent: 사용자가 "시뮬레이션 표면을 찢는" 첫 행위다.
4. `rupture_reveal`: 신뢰된 첫 입력에서 전체화면을 요청하고 적중 잉어와 클릭 비율을 예약한다. viewport 안정 후 보정한 접촉점에서 게임과 18.5초 공통 진입 시퀀스를 시작한다. `GLOBAL_SENTINEL_ENTRY_STAGES`가 첫 금(0–350ms), 그림자 분리(350–1700ms), 독립한 그림자의 이탈(1700–6100ms)을 소유한다. 독립 유색 식신의 해제는 같은 진입 시계에서 2200–3400ms에 투영된다. 그림자가 이탈하는 동안 RGB 행/열 결함과 구획별 소등(2350–6700ms)이 겹치며, 완전 암전(6700–7350ms), 첫 금 전체가 남은 어두운 파손 LCD의 정적(7350–9500ms), 같은 센티넬의 거대한 복귀 및 화면을 따라 진행하는 복구(9500–17000ms), 정적(17000–18500ms)으로 이어진다. 거대 잉어의 머리가 지난 자리는 흰 백라이트가 돌아오고 꼬리가 지난 자리는 같은 유리 균열이 봉합된다. 두 표시 전선은 동일한 actor pose를 사용하며 금의 seed/origin과 모든 공개 단계 시각은 고정한다. 면이나 공간은 아직 열리지 않는다.
5. `repair_race`: 한 번에 한 센티넬만 기존 균열의 복구 접점에 접근한다. 사용자의 세 번의 승인 개입은 `discovery -> system_surge -> final_decision`을 각각 완료한다. 다음 막은 직전 승인 입력 이후의 정적에서 시작하며 고정 메트로놈으로 자동 진행하지 않는다. 실수하면 현재 막만 반복하고 이미 완료한 막과 안정 균열은 유지한다.
6. `terminal_swing`: 성공/실패 임계치 중 하나가 먼저 도달하면 화면 상태가 되돌릴 수 없는 방향으로 기운다.
7. `release`: 원래 페이지로 복귀하더라도, 즉시 콘텐츠 탐닉 리듬으로 snap back하지 않도록 짧은 여운을 둔다.

### 4.3.2) Internal State

초기 구현은 다음 세 상태를 중심으로 고정한다.

- `awaitingStart`: global commit 후 본게임 시작 전 상태다. 이 동안 `syncPressure`와 repair clock은 진행되지 않고 starter koi만 사용자의 명시 입력을 기다린다.
- `syncPressure`: 센티넬 복구와 시간 경과로 상승한다. 높을수록 화면은 표백되고 매끈하게 봉합된다. 실패 조건의 주 상태다.
- `fracture`: 사용자의 유효 개입으로 상승한다. 높을수록 균열, 색 누출, 유리 파손, simulation noise가 강해진다. 성공에는 스타터와 세 번의 저항 개입이 모두 필요하며 마지막 승인 입력이 정본 임계값을 완성한다. 큰 impulse 설정으로 중간 막을 건너뛸 수 없다.
- `sentinelIntegrity`: 개별 센티넬 또는 현재 wave의 복구 능력이다. hit는 센티넬을 단순 제거하는 것이 아니라 `fracture` impulse와 `syncPressure` 저하를 만든다.
- `ruptureReveal`: 승인된 스타터 시각을 원점으로 하는 18.5초 순수 연출 투영이다. `GLOBAL_SENTINEL_ENTRY_STAGES`와 `resolveGlobalSentinelEntryRuptureTimeline`이 모든 화면·소리 경계를 소유한다.
- `rhythmActIndex` / `rhythmActId`: 승인 stroke 수에서 파생한 세 막의 정본 투영이다. `rhythmAttemptIndex`는 현재 막의 재시도만 나타낸다. `rhythmPhaseRemainingMs`와 `fractureRepairBeatIndex`를 표시·오디오·진단으로 전달하며 각 소비자가 별도 박자나 봉합 위치를 재구성하지 않는다.

시간 제한은 내부 pacing 장치로만 존재한다. 일반 사용자-facing 화면에는 숫자 countdown, progress bar, score를 표시하지 않는다.

### 4.3.3) Player Action

v1 조작은 click/tap을 기본으로 하되, 의미는 "적 처치"보다 "봉합 개입"에 둔다.

- `awaiting_start`에서는 modifier 없는 wheel, single-touch pan, scroll key, middle-button autoscroll 같은 native page scroll만 허용한다. pinch/modified-wheel zoom, 링크 클릭, 버튼 클릭, 텍스트 입력, 비스크롤 단축키성 입력은 페이지로 전달하지 않고 starter koi feedback으로 되돌린다.
- 첫 starter가 승인된 뒤에는 surface claim이 해제될 때까지 wheel/touch, middle-button autoscroll, Arrow/Page/Home/End/Space 계열의 페이지 스크롤을 ritual surface 안팎에서 모두 막는다. semantic action의 Enter/Space activation은 이 스크롤 잠금과 분리한다.
- 막힌 입력은 scolding copy가 아니라 starter koi 내부의 봉합 코어, 편광 seam 수축, quiet ripple 같은 피드백으로 "이 개입을 시작하려면 잉어를 클릭해야 한다"를 알려준다.
- 캔버스와 별도로 pointer-transparent semantic button 하나를 유지한다. selected worker runtime의 first-frame readiness 전에는 hidden+disabled로 유지하고, overlay가 실제로 표시되고 readiness가 승인된 뒤 `awaiting_start` control을 focus한다. `repair_race`에서는 label을 갱신한다. active global phase의 Tab/Shift+Tab은 이 단일 control에 머물며 숨은 페이지로 focus가 빠지지 않는다. keyboard/screen-reader activation은 worker/main engine이 선택한 실제 starter 또는 canonical repair entity 중심을 같은 interaction serial/commit 계약으로 처리하며 임의의 viewport 중심을 추측하지 않는다. 비시각 사용자에게 보이지 않는 vulnerability timing을 요구하지 않도록 repair semantic action은 center-window quality `1`로 처리한다. live repair entity가 없는 경우에도 현재 막의 접근 구간이 열렸을 때만 spawn budget/engine control을 지키며 canonical repair entity를 생성한다. 진입 시퀀스와 막 사이의 정적에서는 입력이 장면을 건너뛰지 않는다. 포인터 입력의 취약 시간창과 효율 계약은 바꾸지 않는다.
- starter koi click/tap은 본게임 시작, crack origin 고정, local rupture 시작을 동시에 수행한다.
- 센티넬 또는 봉합 취약점에 맞춘 click/tap은 `fracture`를 올리고 `syncPressure`를 낮춘다.
- 센티넬이 균열/봉합선을 지나는 순간의 정확한 개입은 더 큰 impulse를 준다.
- 맹목적인 연타는 최적해가 아니어야 한다. 같은 영역의 과도한 반복 입력은 효율이 낮아지거나, 표면이 과보정되어 `syncPressure`를 더 빨리 올릴 수 있다.
- 실패 입력은 scolding copy로 처벌하지 않는다. 세계가 반응하지 않거나, 오히려 더 매끈하게 봉합되는 식으로만 알려준다.

향후 hold/short drag를 추가할 수 있지만, v1 구현은 click/tap 루프를 먼저 안정화한다. hold/drag는 별도 단계에서 봉합선을 뜯어내는 상호작용으로 추가한다.

### 4.3.4) Win/Loss Contract

성공:

- 스타터 이후 세 막의 승인 입력이 완료되고 마지막 개입이 `fracture` 성공 임계치를 완성한다. 진행 중인 막의 실패한 접촉은 앞 막의 완료를 되돌리지 않는다.
- 센티넬 복구가 끊기고, 균열끼리 연결되며 원래 페이지의 색/잡음이 틈으로 돌아온다.
- 사용자는 "센티넬을 다 잡았다"가 아니라 "재동기화가 끊겼다"는 상태로 빠져나온다.

실패:

- `syncPressure`가 실패 임계치에 먼저 도달하거나 내부 hard time이 끝난다.
- 균열은 거꾸로 아물고 페이지는 과하게 깨끗한 washi/LCD 표면으로 봉합된다.
- 원래 페이지가 돌아와도 미디어는 `RELEASE`로 일시정지 상태를 유지한다. 사용자가 직접 재생하며 실패가 자동 재생의 보상이 되지 않는다.

성공/실패 모두 보호 escalation과 session outcome 기록은 유지한다. 글로벌 프로토콜은 사용자가 빨리 통과했다고 보호 비용을 회피하는 통로가 되면 안 된다.

### 4.3.5) Diegetic Progress Contract

사용자-facing 진행도는 다음 세계 상태로만 읽혀야 한다.

- 지고 있음: white/washi bleaching, repair seam 증가, 색상 감소, 표면 smoothing, 센티넬 궤적 안정화
- 이기고 있음: crack impulse, LCD channel fault, attached glass facet, line defect breakage, 센티넬 궤적 불안정화
- 거의 성공: 균열들이 서로 연결되고 화면 바깥으로 빠져나가는 탈출감이 생김
- 거의 실패: 모든 균열이 부드럽게 봉합되고 센티넬이 콘텐츠 표면 안으로 녹아듦
- 시작 전: starter koi가 명시 입력 대상이며, 페이지는 스크롤로 살아 있음을 보여준다. 막힌 입력은 starter koi feedback으로 귀환한다.
- 시작 순간: 전체화면 안정 뒤 클릭 지점에서 금이 발생한다. 식신이 해제된 자리에서 그림자 꼬리만 계속 움직이고, 독립한 센티넬이 짧은 글리치 식별점을 남긴 뒤 이탈한다. 이 분리를 읽은 다음 전기적 고장을 시작한다. 650ms 암전 뒤에는 파손 LCD의 정적이 남고, 거대 센티넬의 단 한 번의 통과가 흰 복구 필드로 바꾼다. 작은 센티넬의 세 봉합 시도 뒤에는 거대 배경 실루엣을 반복하지 않는다. OS 오류 문구는 쓰지 않는다. Reduced motion은 기존 시각에서 파손·흰 복구면·잔여 균열을 불연속 상태로 보여주며 RGB 주소 글리치와 거대 이동을 생략한다.

HUD, score, countdown, visible meter는 debug surface로만 허용한다. user-facing copy는 최소화하고, 시작과 첫 두 번의 승인 입력까지만 한 줄 타이밍 힌트를 허용한다. 이후에는 취약 코어의 벌어짐과 고리로 입력 시점을 알린다.

### 4.3.6) Room 478 Decompression Contract

Room 478은 global success의 보상 화면이나 별도 breathing utility가 아니라,
사용자가 열린 균열을 통과한 뒤 자기 호흡을 회수하는 선택적 감압 공간이다.
이 공간은 standalone extension page이며 Sentinel worker canvas의 수명을
연장해 렌더하지 않는다.

Owner 경계는 다음과 같다.

- handoff URL shape와 content request: `src/domains/nudge/nudge/nudgeGameControl.js`
- trusted same-tab navigation: `nudgeCycleHandlers.js`의
  `OPEN_NUDGE_ROOM_478` route -> background `tabsUpdate(senderTabId, { url })`
- seed/origin capture: `SentinelProtocolGlobalEntryRuntime` + active renderer stats ->
  `SentinelProtocolHost` -> `SentinelProtocolTerminalController`
- 공간 composition, timeline, accessibility: `src/apps/room-478/**`
- 선택된 실사 하이브리드 정원 배치·등록 수면·이미지 수명:
  `src/apps/room-478/room478Garden.js`
- 같은 LCD fracture panel의 전경 이탈과 제한된 material cache:
  `src/apps/room-478/room478Arrival.js`
- extension page shell: `src/pages/room-478.html`
- copy: `tools.sentinel_flare_protocol.room_478_*`
- deterministic visual proof: `sentinel/room-478-sequence`

진입 handoff는 해당 activation의 `simulationBreakSeed`와 최초 crack origin의
정규화 좌표를 반드시 포함한다. 기본 `direction_distributed` 균열은 정규화
공간에서 seed로 고정된 6–7개 방향을 분산시킨 제품 설계이며, prototype의
화면 비율 의존 generator를 그대로 복사하지 않는다. Room은 production
`resolveGlobalSentinelRiftAperturePlan`의 작은 32-point impact bleed contour를
같은 seed/origin으로 첫 프레임에 재현한다. LCD와 Rift는
`globalSentinelFractureGeometry`의 같은 contour를 소비하고, 선택된 primary
path 첫 번째/두 번째 node는 별도의 crack ledger로 유지한다. Rift의 검은 내부와
edge는 작은 contour 안에만 그려 주변 흰 LCD/균열을 보존한다. 투명한 최소
44px 클릭 영역은 시각적 구멍 크기를 키우지 않는다. resize는 같은 정규화
geometry를 재투영하며 invalid 입력이나 누락된 handoff를 새 seed, 중앙 origin,
local storage, run id hash 또는 corner 대체 균열로 추측하지 않는다.

연출 순서는 다음과 같다.

1. 기존 `4800ms` arrival 동안 작은 최초 파손부는 확대하지 않는다. Global과
   같은 seed/origin의 canonical LCD panel들을 동일한 흰 LCD material로 투영한
   뒤 각 조각이 바깥으로 벌어져 고정된 정원을 드러낸다. 전경은 종료 때 제거한다.
   이 projection은 Global의 픽셀이나 원본 페이지를 복사하지 않으며, 제품 3막의
   scalar fracture 계약을 연구의 5경합 경로별 상태로 가장하지 않는다.
2. 숫자 countdown 없이 한 번의 `4s inhale -> 7s hold -> 8s exhale`만 안내한다.
   원형 달과 작게 등록된 수면 반사가 호흡 공간의 표현을 소유한다.
3. guided breath 뒤에는 자동 종료나 완료 modal 없이 무기한 `still` 상태를
   유지한다. 이때 작은 return action과 선택적 `한 호흡 더`를 드러내며 상시 exit와 Escape는
   계속 접근 가능하다.

가시 텍스트는 짧은 phase verb와 마지막 return/repeat action만 허용한다. Room label,
큰 숫자, 설명문, progress rail은 표시하지 않는다. screen reader status는
phase boundary에서만 갱신하며 per-frame countdown을 live region에 쓰지 않는다.
숨겨진 return action은 `hidden + disabled`로 tab order에서도 제외한다.

`prefers-reduced-motion`에서는 traversal만 `480ms`로 축약하고 incidental drift를
멈추되 4-7-8 호흡 시간은 유지한다. page visibility가 hidden이면 timeline도
함께 멈춰 background 시간 경과로 phase가 건너뛰지 않게 한다.

Arrival은 기존 experience의 활성 `frame.elapsedMs`를 소비한다. 30Hz paint bucket은
새 clock이나 loop를 만들지 않으며, 정착 이후에는 paint와 두 Canvas cache가 모두
해제된다. 각 cache는 최대 `1600×1000`이고 resize는 같은 정규화 균열을 재투영하여
이전 cache를 해제한다. Canvas2D가 없으면 `room_478_arrival_canvas_unavailable`로
실패하며 기존 portal이나 다른 정원으로 대체하지 않는다. reduced motion에서는
조각 이동을 제거하고 같은 `480ms` 동안 전경을 줄인다.

정원 presentation의 제품 기본안은 독립 연구의 `04 · 실사 정원 + 작은 움직임`이다.
`room478Garden.js`는 가로·세로·초광폭 WebP plate 중 viewport 비율이 `<= 0.95`이면
세로, `>= 2`이면 초광폭, 나머지는 가로를 선택하고 동일한 cover 배율·잘림 좌표를
작은 수면 반사에도 적용한다. 가까운 후린은 원본 alpha와 배치 crop metadata를 보존하며,
좁은 crop에서는 지붕 안쪽으로 이동해 줄이 위에서 내려오도록 한다. 나무·돌·모래·목재와
전체 plate는 움직이지 않는다. 후린의 16초 미세 회전과 수면의 13초 작은 이동은 bounded
CSS surface만 사용하며 별도 JavaScript frame loop, fluid grid, pixel readback을 추가하지 않는다.
달은 한 지름으로 width/height를 결정하고 동일한 배율로 호흡한다.

정원은 기존 `applyRoom478Frame`의 viewport 갱신과 experience의 pause/resume/resize/destroy를
소비한다. hidden-at-start와 visibility/pagehide/명시 pause는 기존 활성 timeline 및 CSS 주변
움직임을 멈추고, reduced motion에서는 두 주변 움직임을 없애되 4-7-8 시간은 유지한다.
정본 `room478ReducedMotion`은 같은 experience에서 한 번 결정해 presentation으로 투영한다.
이미지는 Room 소유의 packaged asset URL만 사용한다. plate/후린 load error는
`room_478_garden_asset_unavailable:<role>` 명시 error state와 console error로 정착하고
timeline을 멈추며, 다른 정원·숨겨 둔 원본·재시도로 대체하지 않는다. 정확한 두 error
listener는 destroy에서 제거한다. 생성 원본과 전체 prompt 기록은
`prototypes/room-478/assets/hybrid-v4-prompts.md`, 제품 파일 hash와 생성 provenance는
`docs/operations/release-asset-provenance.json`이 소유한다. 연구의 비교 UI·fixture·Global
5경합/4놓침 정책은 이 presentation 채택 범위에 포함하지 않는다.

## 4.4) Incremental Implementation Plan

작업은 다음 순서로만 진행한다. 각 단계는 이전 단계의 룰을 다시 흔들지 않고 독립적으로 검증 가능해야 한다.

### Phase 0: Canon Lock

- 이 문서와 `zen-sentinel-render-pipeline.md`가 global protocol의 의미, 금지 방향, owner boundary를 가진다.
- 구현 전에는 "budget warning", "HUD game", "Zen pond scene"으로 되돌리는 변경을 하지 않는다.

Definition of done:

- 문서 guardrail 통과
- `global_sentinel`의 성공/실패 의미와 user-facing 금지 요소가 문서에 명시됨

### Phase 1: Game State Contract

- runtime/worker가 `syncPressure`, `fracture`, `sentinelIntegrity`에 해당하는 내부 상태를 계산할 수 있게 한다.
- 기존 hit/remove 동작을 바로 갈아엎지 말고, 먼저 outcome state가 diagnostics에서 읽히도록 만든다.
- 사용자-facing HUD는 그대로 두더라도, 새 상태값의 단일 owner를 먼저 확정한다.

Implementation note, 2026-07-04: this phase is implemented as a contract layer.
`nudgeGameGlobalSentinelProtocol`, `NudgeSwarmEngine`, worker stats, and runtime
diagnostics now expose `syncPressure`, `fracture`, and `sentinelIntegrity`
without changing the existing user-facing HUD or terminal outcome behavior.

Definition of done:

- global session에서 success/failure가 새 상태값으로 설명 가능함
- debug diagnostics로 상태 변화가 재현 가능함
- 기존 site_furin 동작에 영향 없음

### Phase 2: v1 Interaction Loop

- click/tap hit를 `fracture` impulse와 `syncPressure` 감소로 연결한다.
- 시간 경과와 센티넬 생존/복구 행동이 `syncPressure`를 올리게 한다.
- 성공은 `fracture` threshold, 실패는 `syncPressure` threshold 또는 내부 hard time으로 판정한다.
- 무작정 연타가 최적해가 되지 않도록 hit window, local diminishing return, 또는 overcorrection 중 하나를 최소 단위로 둔다.

Implementation note, 2026-07-04: this phase is implemented for the v1
click/tap loop. A valid hit now adds a `fracture` impulse and `syncPressure`
relief, and failure uses sync-pressure threshold plus a hard cap instead of only
raw hit count. In v1.2 the default tempo owner moved from rapid-hit diminishing
return to sentinel vulnerability cadence.

Implementation note, 2026-07-04: v1.1 changes `fracture` from a permanent
click score into the current amount of open simulation breakage. A hit still
opens fracture immediately and still relieves sync pressure, but after a short
post-hit hold the simulation begins repairing open fracture according to
`syncPressure`. This is the first tug-of-war layer: success requires keeping the
break open long enough to reach the threshold, not merely accumulating five
historical hits. The v1 failure clock, hard cap, rapid-hit efficiency, and
terminal outcome contract remain unchanged.

The v1.1 repair model is deliberately scalar, not per-crack. It exists so we can
tune the game loop without committing yet to a crack ledger or sentinel role AI.
Future versions may split the scalar into branch states such as `open`,
`repairing`, and `sealed`, but that should be a separate owner change.

Implementation note, 2026-07-04: v1.2 fixes the first playable rhythm.
Hands-off failure targets roughly 60s, with a 70s hard cap. Normal attentive
play should resolve in roughly 30s, not by clicking every koi as soon as it
appears, but by interrupting the short sealing moment when a sentinel exposes a
repair core. A click outside that vulnerable window is a no-op, not a punishment:
the world simply has nothing exposed to interrupt yet. Rapid-click diminishing
returns are therefore retired from the default loop; tempo now comes from
sentinel vulnerability cadence.

Current defaults (2026-09-09 three-act cinematic sequence):

- Entry duration: `18500ms`; first repair approach: `20300ms`; first active contact: `22900ms` after starter acceptance.
- `syncDurationMs`: `54000`; `hardTimeLimitMs`: `60000`.
- `fractureThreshold`: `0.92`; `fractureImpulse`: `0.25`; `collapseHoldMs`: `2400`.
- `syncPressureReliefPerHit`: `0.12`; stable impulse share: `0.72`.
- `missRepairImpulse`: `0.08`; `missRepairDurationMs`: `1200`.
- Base approach: `2600ms`; base lock: `600ms`; base active window: `1800ms`.
- Discovery uses the base timings and `0.34x` active motion.
- System surge begins `2600ms` after the preceding accepted hit, approaches for `3000ms`, locks for its final `760ms`, and offers a `2000ms` contact window at up to `0.24x` motion.
- Final decision begins `3400ms` after the preceding accepted hit, approaches for `3600ms`, locks for its final `920ms`, then holds a generous `4500ms` contact window at `0.1x` motion throughout.
- A missed contact repeats only that act after `2400ms` recovery; accepted acts and stable fracture remain. The final valid act decisively reaches the exact fracture threshold before the hard deadline.
- Starter plus three accepted resistance acts is the fixed minimum stroke budget, including custom impulse policies. The settled ending and space formation follow the final accepted act.
- Success banishment lasts `1800ms`, then the unchanged fracture remains for `4000ms`. Failure sealing lasts `1600ms`, then also holds for `4000ms`. Only afterward does the host advance the outcome; successful space formation takes `2600ms` before the explicit invitation becomes actionable.
- The debug HUD remains off by default. Main and selected worker project the same act, phase, remaining time and missed repair beat, without reconstructing another schedule in diagnostic or audio consumers.

The intended read is a repair contact under tension: one sentinel approaches an existing seam, the player interrupts that local restoration, and the same fracture spreads. The following dated v1 notes are historical descriptions of the earlier fixed-cadence implementation; these current defaults and section 4.3 take precedence.
Implementation note, 2026-08-13: v1.3 replaces independently offset entity
windows with one protocol-wide rhythm beat. Exactly one live Sentinel owns the
current target. Its screen-space timing mark contracts as a true circle through
`approach -> lock -> active -> recovery`; the `220ms` lock and early portion of
the `760ms` active window slow actor motion to `0.34x` without slowing the
protocol clock. Pointer input remains active-window strict, while the semantic
action remains available during the owned approach for accessibility. A
semantic activation received after that beat has been consumed is the same
non-destructive no-op as an off-window pointer; main and worker runtimes must
clear the input attempt without promoting `global_semantic_rhythm_closed` into
a protocol recovery failure.

Fracture is now split into `stableFracture` and `volatileFracture`. Each accepted
impulse assigns `72%` to stable damage and the remainder to volatile damage. A
missed active window seals at most `0.08` of volatile damage over `860ms`; it
does not continuously drain stable damage and repeated idle time therefore
cannot rapidly reset the whole simulation. `syncPressure` still owns the
failure clock and attempted-repair atmosphere, but it no longer owns a second
render-only fracture mask. Normal miss closure is the reverse reveal of the
canonical skeleton plus a narrow healing front. Broad white masking remains
terminal-resync-only.

Implementation note, 2026-07-04: the vulnerability window must be telegraphed
diegetically before it opens. A body-contained repair core and polarized seam
contraction should make
the 1.3s window feel like the climax of a longer track-and-time gesture, not a
raw reaction-speed test. A valid intervention may report its normalized impact
point for sentinel-local disappearance feedback, but crack topology must not be
seeded from the hit point. Crack growth belongs to the activation-stable
simulation-break skeleton.

Implementation note, 2026-08-08: the existing schedule is rendered as three
beats without adding an input state: `approach/repair-contact -> seam/core
contraction -> rupture-window`. The September 8 repair pass replaces the short
actor-local rails with a fine double filament reaching an actual section of
the activation-stable primary fracture. That section visibly seals as the core
contracts. A miss completes its repair; an accepted intervention sends a pulse
back along the same filament, releases the seal and grows the existing damage.
`GlobalSentinelRepairMaterial.js` owns this material projection. The engine
captures the site, normalized actor source and pre-hit fracture in the existing
aftermath record; both scene passes converge from pre-hit to current fracture
over 18–60% of that bounded aftermath, without delaying the game outcome. The
white field remains a flat system-recovery display; only post-success `rift`
forms a space from the surviving crack contour. The
engine also forwards `attemptedRepairPressure = baseSyncPressure` independently
from effective `syncPressure`, so successful hit relief cannot make the repair
system's intent disappear. This signal is render-only and does not change
vulnerability, quality, fracture, click count, or outcome math.

Implementation note, 2026-08-08: accepted repair interventions now retain the
removed sentinel pose for one bounded render-only aftermath:
`fracture -> reverse-recall -> repair-seam-annulment`. `1080ms` is the normal
maximum and `1480ms` is the terminal maximum. The engine derives each stored
burst lifetime from its owning game-policy window, leaving a `20ms` margin:
normal aftermath is bounded by `hitAftermathWindowMs`, while terminal
aftermath is bounded by `collapseHoldMs`. A window at or below the margin emits
no aftermath; a short positive window compresses the same bounded three-phase
path without changing game timing. The
reverse recall pulls only sentinel ink and repair residue into the activation's
first stable fracture origin. `repair-seam-annulment` means the Sentinel repair
seam collapses and disappears; it never heals the success crack or closes its
aperture. The removed actor briefly holds at the accepted point, loses its
silhouette there, and becomes one coherent multi-lobed ink current; the intact
actor must not travel to the origin. Two thin capillary feeds may clarify the
absorption path while detached dot particles are omitted. Its two repair rails
are erased in sequence. Actor, ink-current, capillary-feed, and repair-seam
opacity and geometry converge to zero
at the stored lifetime. Actual crack/seam closure remains exclusive to failure
resync, whose terminal transition immediately discards any still-live accepted-hit
aftermath; success preserves its bounded render-only path. Success banish holds
the composed breach and global koi completely still for its first `200ms`, then
re-normalizes visual progress across the remaining terminal duration; the
terminal clock and outcome timing do not change.

The engine/raw-worker diagnostic contract exposes active count, named phase,
normalized progress, terminal weight, and accepted-hit serial. Canonical worker
stats normalization, the selected runtime diagnostics, and main Sentinel
diagnostics preserve the same five fields so attach-only QA can wait on actual
engine time. Main-host diagnostics expose those fields only while `scenePhase`
is `ritual`, fencing a stale worker stats frame during banish or resync. Malformed
aftermath clocks, durations, actor snapshots, serials, coordinates,
or active diagnostic phase/serial combinations fail loudly at their owning
boundary. These fields do not participate in hit eligibility, fracture
arithmetic, completion, reward, or input authority.

Definition of done:

- global protocol이 "센티넬을 클릭하면 금이 팍 생기고 재동기화가 밀린다"로 읽힘
- 빨리 없애기보다 timing/attention이 더 좋은 플레이가 됨
- debug HUD 없이도 성공/실패 로그가 일관됨

### Phase 3: HUD Quarantine

- visible HUD, countdown, progress meter를 user-facing 기본값에서 제거한다.
- 필요한 상태 확인은 debug payload, diagnostics, preview harness로 옮긴다.
- 제거 후에도 사용자가 현재 유리/불리 상태를 세계 변화로 읽을 수 있어야 한다.

Implementation note, 2026-07-04: global user-facing guide/meter UI is now
quarantined behind explicit debug HUD visibility. Normal `global_sentinel`
sessions do not show the ritual guide or progress meter; state remains available
through worker stats, runtime diagnostics, CSS variables, and debug `hudVisible`
launches.

Definition of done:

- 일반 발동에서 HUD가 보이지 않음
- debug 발동에서는 상태값 확인 가능
- visible meter 없이도 QA가 win/lose direction을 눈으로 판별 가능

### Phase 4: Diegetic Progress Rendering

- `syncPressure`를 washi bleaching, LCD repair field, repair seam density, smoothing에 연결한다.
- `fracture`를 stable crack growth, LCD channel fault, glass chip, line defect breakage에 연결한다.
- terminal_swing에서 성공/실패의 화면 방향이 명확히 갈라지게 한다.

Implementation note, 2026-07-04: global canvas rendering now receives
`syncPressure` and `fracture` as first-class inputs. The white LCD/washi field,
repair seams, and host veil are driven by `syncPressure`; foreground crack
spread, glass chips, line defects, and flat display channel faults are
driven by `fracture`. The older `syncLevel` and `progress` inputs remain only as
compatibility fallbacks at the renderer boundary.

Implementation note, 2026-07-07: vNext diegetic crack feedback should follow the
stable-skeleton growth plan in
`docs/architecture/themes/zen/zen-sentinel-render-pipeline.md`. A single global
activation may vary its crack archetype by `simulationBreakSeed`, but hit serials
and hit coordinates must not reseed crack topology. The intended loop is:
early hairline stress, mid-stage propagation and branching, late-stage aperture
and flat pixel damage, with `syncPressure` reducing damage before erasing the
hairline skeleton.

Definition of done:

- 이기면 화면이 더 "깨지고 살아나며", 지면 더 "하얗고 매끈하게 봉합"된다.
- 금이 생기는 타이밍이 click/tap 피드백과 즉각적으로 연결됨
- visual QA에서 HUD 없이도 상태가 읽힘

### Phase 4B: Click-Consented Rupture Entry Milestone

Goal: global commit 후 화면을 즉시 고장난 LCD처럼 덮지 않고, 사용자가 starter koi를 직접 클릭해 본게임을 시작하는 장면 전환을 완성한다. 이 milestone은 Phase 4의 diegetic rendering을 유지하면서 Phase 5의 armed/commit seam 뒤에 붙는 user-facing entry contract다.

Patch order:

1. Input Gate Contract
   - 목표: `awaiting_start` 동안 native page scroll만 페이지 생존 신호로 통과시키고 starter koi/ritual overlay 안의 의도된 입력만 허용한다. 첫 starter 승인 뒤에는 surface claim이 해제될 때까지 ritual 안팎의 모든 scroll-affecting input을 protocol gate가 흡수한다.
   - 완료 상태: 시작 전에는 페이지가 실제로 스크롤되지만 링크/버튼/텍스트 입력/비스크롤 단축키는 전달되지 않는다. 시작 뒤에는 wheel/touch/middle-button/scroll key가 전달되지 않는다. context menu와 auxclick은 ritual surface 안에서도 열리지 않으며 차단 입력은 진단 가능한 이벤트 또는 테스트 가능한 feedback trigger를 남긴다.
2. Starter Koi Feedback
   - 목표: 차단 입력과 hover/near miss가 starter koi의 glow, ring contraction, ripple로 귀환한다.
   - 완료 상태: 텍스트 설명 없이도 starter koi가 클릭 대상임을 알 수 있고, feedback은 debug HUD 없이 관찰 가능하며, Site Furin 풍경 의식과 섞이지 않는다.
   - 접근성 완료 상태: pointer-transparent semantic button이 자동 focus되고 start/repair phase label을 제공한다. Enter/Space 및 screen-reader activation은 정본 engine input으로 합류하며, repair action은 비시각 vulnerability cue를 추측하게 하지 않는 deterministic center-window accommodation을 사용한다.
3. First Click Rupture
   - 목표: starter koi click/tap이 `awaiting_start -> rupture_reveal -> repair_race`를 시작하고, 클릭 좌표를 activation-stable crack origin으로 고정한다.
   - 완료 상태: 첫 클릭 전에는 `syncPressure`/repair clock이 진행되지 않고, 첫 클릭 후에만 `fracture` impulse와 `syncPressure` relief가 발생한다. `simulationBreakSeed`는 한 판의 골격을 고정하고, click point는 origin만 고정한다.
4. Local Reveal Envelope
   - 목표: 적중 잉어의 압축 반응 중 전체화면을 안정시킨 뒤, 보정한 클릭점에서 지연된 크래시와 LCD 신호 고장을 시작한다.
   - 완료 상태: viewport 안정 후 공통 18.5초 시퀀스에서 첫 금 → 식신 해제와 그림자 분리/이탈 → RGB 행/열 결함과 구획 소등 → 완전 소등 → 파손 LCD의 정적 → 거대한 센티넬의 통과가 흰 복구면을 작성 → 작은 센티넬의 잔여 균열 봉합 시도로 이어진다. 승인 입력은 그 봉합을 끊어 같은 균열을 확장하고, 공간은 성공 시퀀스 이후 그 윤곽에서 처음 형성된다.
5. Integration And Safety Tuning
   - 목표: main host ritual state, worker stats, HUD/debug telemetry, terminal outcome이 같은 phase를 읽게 한다.
   - 완료 상태: worker and main diagnostics show `awaiting_start`, `rupture_reveal` or equivalent visual envelope, then `repair_race` in order; normal HUD remains hidden; screen-reader/user-facing copy does not claim device/browser failure; focused tests cover engine, worker entry, protocol progress, and render skeleton origin.

Historical implementation note, 2026-08-01: the original short reveal milestone below was implemented end to end. Its 1440ms schedule is superseded by the current 18.5-second three-act contract in section 4.3.
`NudgeSwarmEngine` and `nudgeGameGlobalSentinelProtocol` expose
`awaiting_start`; starter koi is click-ready near the center; first click starts
the repair race and fixes the stable crack origin. Active Sentinel Flare
surfaces route page-input blocking through the `ritualSurfaceArbiter` dominant
input policy, with blocked-input feedback kept on the global awaiting-start
path. Native scroll remains available only before starter acceptance; afterward
the dominant claim locks wheel, touch, middle-button autoscroll, and scroll keys
through terminal teardown. A focused semantic action provides keyboard and
screen-reader parity without taking canvas pointer ownership. The protocol-owned
local reveal completes in `1440ms`. The same hit also
drives a short point-local backlight/RGB impact envelope without changing the
activation's seeded crack topology.

The `1440ms` envelope is one shared choreography rather than separate koi,
host-CSS, and canvas clocks. The starter pose briefly holds and loses material
at its source while a coherent ink body transfers into the accepted pointer
point. A dense impact star and seeded crack fronts break the flat display.
Fracture-bounded sectors retain portions of the original page, develop clipped
RGB source-driver faults, and die in sequence before complete power loss.
The whole-frame white LCD cut at 475ms retains the complete first fracture. A giant
shadow crosses at 600–1320ms while the outer branches retract along unchanged
coordinates at 700–1320ms. A damaged core remains at 1440ms, before small-koi
approach starts at 1550ms. Worker canvas owns the rupture contour; host presentation
is limited to a short uniform exposure pulse. The giant recovery shadow ends
before handoff; small koi arrive through the engine's spawn owner without a
placeholder shadow. Spawn, split and input stay closed during entry
recovery; the first active window starts at 2600ms.

Definition of done:

- A first-time user can infer that Entropy is asking for a deliberate click, not that the display/browser broke.
- Before starter click, page liveliness is visible through presentation and native scrolling; page navigation/editing and non-scroll shortcuts remain blocked. After the starter is accepted, scroll-affecting inputs are blocked until the ritual surface claim is released.
- The first accepted click produces a satisfying local rupture and then hands off to the existing `repair_race`.
- The transition remains diegetic and digital-display specific. The September 8 material pass permits a single panel outage after impact; countdowns, warning HUDs, and scare-popup copy remain excluded.
- Site furin behavior and calm ritual timing remain unchanged.

### Phase 5: Armed -> Commit Timing

- background 조건 충족과 화면 commit을 분리한다.
- content boundary 후보를 reward entry/continuation click, media transition, feed/item boundary, scroll stop, short idle 순으로 감지한다.
- 회피 방지를 위한 hard cap을 둔다.

Implementation note, 2026-07-04: v1 armed -> commit timing is implemented at
the content entry seam in `ProtectionController` and
`nudgeEntrySeamGate`. Debug launches still commit immediately. Normal `site`
sessions keep the existing tide-like idle seam. Normal `global` sessions now arm
first, show a short simulation presage, then commit on interactive click/key
boundaries, media pause/end transitions, idle, or a hard cap. Commit diagnostics
are recorded through protection environment history with `protocolScope`,
`committedBy`, `commitReason`, `eventType`, and `waitedMs`.

Implementation note, 2026-07-07: presage, Enso gate feedback, and active
Sentinel Flare overlays claim tab-local ritual surface ownership through
`ritualSurfaceArbiter`. Pairwise collision rules must stay there: presage is a
low-priority hint, Enso is an input gate surface, site furin is an active ritual
surface, and global sentinel is the stronger active protocol surface. Dominant
active protocol surfaces also carry the tab-local input policy: page input
outside the overlay root is absorbed by the arbiter-owned guard, while intended
overlay interactions continue through the composed event path.

Definition of done:

- 조건 true 즉시 화면을 덮지 않고, 가능한 경우 사용자의 집중 흐름이 살짝 끊긴 틈에 들어감
- hard cap 후에는 반드시 commit됨
- activation diagnostics에 armed duration과 commit reason이 남음

### Phase 6: Terminal Release And Media Semantics

- 성공 release는 원래 콘텐츠의 매혹이 한 박자 빠진 상태로 돌아오게 한다.
- 실패 release는 over-clean resync, 감시 비네트, 필요 시 미디어 자동 재생 같은 독든 보상 언어로 정리한다.
- site protocol의 calm release와 global protocol의 crash/resync release를 분리한다.

Implementation note, 2026-07-04: Phase 6A is the failure repair-illusion pass.
It intentionally preserves the v1 rule contract from Phase 2. `fracture`,
`syncPressure`, thresholds, failure duration, and hit efficiency do not change.
The pass only changes how the existing state is read by the world:

- During `repair_race`, rising `syncPressure` draws deterministic repair masks
  over already-open crack branches. A high sync state should look like lines are
  being overwritten by the simulation, even though per-crack repair state is not
  yet part of the game model.
- During `resyncing`, the terminal sequence pushes the renderer toward an
  over-clean white/LCD state, fades visible cracks under repair strokes, and
  makes the failure feel like a snap re-synchronization rather than a passive
  timeout.
- The September 8 contract supersedes automatic poisoned-reward playback: media
  suppression is released without calling play. Residue remains a visual handoff.
- The post-failure residue remains owned by the protection release payload and
  should feel like the sentinels have dissolved into the content layer: vignette,
  scanline drift, brief glitch cuts, and subtle shadow traces.

Out of scope for Phase 6A:

- No new win/loss math.
- No per-crack repair ledger.
- No sentinel role AI or crack-targeting movement.
- No visible HUD/countdown restoration.

Definition of done:

- 종료 후 즉시 "보던 것 계속 봐야지"로 snap back하는 느낌이 줄어듦
- 성공/실패가 서로 다른 감정적 잔상을 남김
- media pause/resume 정책이 protocol scope와 outcome을 구분함

### Phase 7: Tuning Pass

- 난이도, wave 수, hit radius, threshold, duration, visual intensity를 실제 페이지 위에서 조정한다.
- 숫자 목표는 내부 tuning surface에만 두고, 사용자-facing 화면에는 노출하지 않는다.
- Site Furin과 Global Sentinel은 admission과 lifecycle을 공유하며, 의식과 렌더 소유권은 각각 분리한다.

Definition of done:

- global은 이질적이고 충격적이지만, 불필요하게 스트레스를 키우는 popup처럼 읽히지 않음
- site는 차분하고 가라앉는 프로토콜로 남음
- 두 프로토콜 모두 "빨리 해치우고 돌아가기"를 최적 행동으로 만들지 않음

## 4.5) Roadmap

1. Runtime payload에 `site/global` scope와 intensity를 추가한다.
2. Background 평가에서 global budget 초과를 전역 프로토콜로 승격한다.
3. Site Furin은 host DOM/SVG, Global Sentinel은 기존 worker visual profile을 사용한다.
4. Copy를 scope별로 분기하되 storage나 정책 계층에는 세계관 문자열을 넣지 않는다.
5. HUD/숫자/막대가 아닌 diegetic 진행 언어를 기본 사용자-facing 연출로 만든다.
6. Background/content 경계에서 armed -> commit 타이밍을 분리하고, reward entry/continuation, 미디어 전환, feed boundary, idle pause 같은 발동 틈을 활용한다.
7. Global commit 후 starter koi, ritual-surface input gate, local rupture reveal을 완성한다.
8. Dashboard에 Site Furin, Global Sentinel 설정 섹션을 추가한다.
9. 반복 무시, domain hopping, 일일 총량 초과 신호를 escalation input으로 확장한다.
10. global protocol 통과 조건을 site보다 무겁게 만들고 테스트한다.

## 5) 동기화 정책

- 설정 변경 즉시 반영:
- `filterSettings` 변경은 `active-only` 전파
- 백그라운드 탭은 활성화/업데이트 경로에서 지연 동기화
- 새로고침 없이 적용되어야 한다.
- 대시보드 runtime 조회:
- `GET_PROTECTION_RUNTIME_SNAPSHOT`: cached read only
- `REFRESH_PROTECTION_RUNTIME_SNAPSHOT`: 명시적 재평가 후 snapshot 갱신
- polling은 기본적으로 `GET`만 사용하고, cold start나 설정 변경 시 `REFRESH`를 사용한다.

## 6) 성능/안정성 규칙

- 설정 write는 diff 기반으로만 저장한다.
- 전파는 변경 키 기준으로 선별한다.
- world-specific 문자열은 로직 분기 기준으로 사용하지 않는다.
- world-specific 문자열은 표시 목적(i18n context)으로만 사용한다.
- `global` protocol은 강한 연출을 쓰더라도 worker runtime과 Nudge 소유의 render-pressure budget을 유지한다.
- severe pressure에서도 검은 실루엣과 브라우저 가장자리 암전 신호는 유지한다.

### September 8, 2026 — glass material and intentional exits (historical)

- The accepted art direction is a failed holographic projection with glass/LCD material. A validated starter press reserves its position; fullscreen settles before the game and delayed crash begin. Over 1440ms, hairlines and accumulating RGB faults lead to fracture-bounded sector failure with live-page survivors, complete blackout, then a whole-frame white LCD cut. The existing crash contour acquires spatial depth only after success.
- `GlobalSentinelGlassMaterial.js` owns glass edge shading and the final power-cut pass. `GlobalSentinelLcdMaterial.js` derives flat failed sectors, a bounded impact microfracture web, RGB driver ribbons and edge emission from the canonical skeleton; these details never own the success aperture. `NudgeProtocolSceneBackground.js` keeps seed/origin, topology and post-success aperture ownership. No page screenshot or DOM cloning is used.
- `prefers-reduced-motion` is sampled at activation by the host and projected into the worker config. The new blackout and RGB electrical cut are omitted when enabled; geometry and game timing are unchanged.
- Initial pointer guidance is shown through the first two accepted strokes. A wider, opening core marks the same 760ms acceptance window. Unaccepted clicks do not add punishment; held Enter/Space repeats are blocked while individual semantic activations keep the accessibility accommodation.
- The success invitation is visibly labelled. Its 16s timeout releases the paused page without navigation; explicit invitation activation is the only Room 478 entry. Failure also releases paused media without autoplay.
- Room 478 starts a single 19s breath after arrival, without the previous default grounding gate or four-cycle assignment. Stillness exposes return and optional repeat. A repeat restarts breathing without replaying arrival; hidden/paused time never consumes a breath. Departure copy does not claim the user's emotional state.
- Global audio dispatch uses `nudgeGameAudio.js` through declared sound IDs: starter rupture, rhythm approach/lock, accepted hit, terminal breach, failure seal. Telegraph scenes stop on acceptance, terminal transition, or teardown. They use the session rhythm snapshot, never another beat clock.
