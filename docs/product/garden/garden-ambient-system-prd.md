# Garden Ambient System PRD

- Status: Active
- Owner: garden product / zen theme architecture
- Last validated against code: 2026-10-11
- Path policy: planning-allowed
- Canonical for: 정원 분위기의 제품 의미, 자연 날씨와 분재 습관 피드백의 분리
- Scope: Zen Home의 하늘·shell·연못·분재·낙화, 향후 Popup/Overview ceremony의 제한

## 1) 제품 의미

정원에는 사용습관과 독립적으로 시간이 흐르고 날씨가 변한다. 비와 흐린 하늘은
사용자에 대한 경고나 벌이 아니다. 좋은 사용습관을 유지해도 비를 볼 수 있어야 하며,
비를 보기 위해 사용습관을 일부러 나쁘게 만들 필요가 없어야 한다.

사용습관의 피드백은 분재의 누적 성장과 최근 생기·개화에 맡긴다. 자연 날씨가
가지 구조, 개체 정체성, 성장 점수나 활성화를 바꾸지 않는다. 반대로 습관 점수,
friction, 방문 횟수, 세션 길이가 구름·비·바람 일정을 바꾸지 않는다.

이 문서는 현재 점수식을 재설계하지 않는다. 점수와 생명 모델의 구현 계약은
[점수 원장](../../domains/stats/score-ledger-architecture.md)과
[분재 생명 모델](../../architecture/themes/zen/zen-bonsai-vitality-growth-spec.md)에 있다.
[습관 피드백 설계](bonsai-habit-feedback-foundation.md)의 새 평가식과 일일 마감 정책은
별도 Proposed 결정으로 남는다.

## 2) 입력과 책임

| 관심사 | 권위와 허용 입력 | 표현과 제한 |
| --- | --- | --- |
| 자연 날씨 | 공통 environment kernel, world identity와 현지 달력·계절·시각 | 구름, 강수, 바람, 흐린 날의 광량. 사용습관 입력 금지 |
| 태양과 시간 | 공통 clock/solar owner, 위치와 시간대 | 새벽·낮·황혼·밤 색을 유지하고 날씨 감쇠를 겹친다 |
| 분재 생명 | 기존 stats/cultivation/vitality owner | 누적 구조와 최근 활성화·개화를 구분한다. 날씨가 생명 상태에 쓰이지 않는다 |
| 낙화 공급 | 기존 꽃·활성화·계절 입력을 사용하는 petal field | 같은 날씨라도 현재 꽃 공급에 따라 양이 다를 수 있다 |
| 비 뒤 낙화 | 실제 관측한 강수 front와 기존 petal event director | 가시 상태에서 확인한 비 뒤 한 번의 짧은 방출. 성장 보상이나 방문 보상 아님 |
| 비의 수면 반응 | 기존 pond field의 procedural rain | 화면 빗줄기마다 CPU entity·파문을 하나씩 만들지 않는다 |
| 꽃잎 착수 | 실제 낙화 landing 좌표와 기존 semantic disturbance budget | 연못에 닿은 잎만 파문을 만들며, 중복·가려짐·오래된 landing은 거절한다 |

구현의 canonical owner, 갱신 경계와 renderer 전달 경로는
[Zen seam map](../../architecture/repository/zen-pond-seam-map.md)의 world environment 및
app petal 항목이 소유한다. 이 PRD는 두 번째 weather authority를 만들지 않는다.

## 3) 자연 날씨와 전이

현재 `procedural_event_v1`은 현지 날짜에 고정된 날씨 전선을 사용한다. 같은 world,
날짜와 시각에서는 앱을 다시 열어도 같은 날씨가 나온다. 맑음·흐림 사이에
passing shower, steady rain, sunshower가 들어갈 수 있다. 비를 구름량으로 다시
판정하지 않으므로 햇빛이 남아 있는 소나기도 허용된다.

전선은 정렬된 5일 블록마다 최소 하나를 배정한다. 임의의 연속 5일마다 비가
반드시 온다거나 사용자가 방문한 시간에 비를 보게 된다는 보장은 아니다.
앱 밖의 실제 기상 관측이나 예보와 동기화하지 않는다.

구름 접근 → 강수 → 약화 → 비 뒤 잔광은 같은 전선 envelope에서 나온다.
하늘·패널·연못이 각자 날씨를 추측하거나 별도 상태 머신을 갖지 않는다.
잔광은 기존 태양·구름·강수 채널 안에서 표현하고, 밤을 낮처럼 밝히지 않는다.
화면 복귀 시 현재 시간을 다시 샘플링하며, 보이지 않던 동안의 비·꽃잎 이벤트를
몰아서 재생하지 않는다. 시계가 뒤로 이동해도 이벤트를 누적하지 않는다.

날씨 축은 현지 civil time을 따른다. DST 반복 시각은 같은 현지 시각의 날씨를
다시 샘플링하고, 건너뛴 시각의 연출을 재생하지 않는다. 태양 계산은 canonical
timestamp와 시간대 owner를 계속 따른다.

## 4) 비와 낙화 연출

빗줄기는 드물고 비교적 굵은 근경·원경 두 층으로 표현한다. 밝은 패널에서도
읽히되 수면과 분재보다 주목을 끌지 않는 강도를 목표로 한다. 구름과 비는 공통
색상·광량 투영을 소비하며, 패널 위에 별도 전면 검정 막을 추가하지 않는다.

비가 오는 동안 낙화는 사라지지 않는다. 공급과 흔들림을 줄이고 하강을 조금
빠르게 해서 젖은 꽃잎의 인상을 준다. 비 뒤 방출도 현재 꽃 공급과 공통 airborne
상한을 지키므로 꽃이 적은 나무에서 만개 수준의 잎이 갑자기 생기지 않는다.

비 뒤 방출은 기존 낙화 상태 머신 안에서 처리한다. 일정 시간 관측한 비가 그친
뒤의 짧은 확인 구간, 전선 식별자와 cooldown으로 중복을 막는다. 화면이 숨겨짐,
opening/cover 또는 다른 shower와 충돌하는 시점의 기회는 버리고 대기열을 만들지
않는다. 전선 내부의 일시적인 소강을 비가 끝난 것으로 취급하지 않는다.

착수는 화면의 실제 연못 aperture 안에 들어온 꽃잎만 기존 수면 disturbance로
전달한다. 수련 위에 놓인 잎은 수면 충격을 만들지 않는다. 빗줄기 수와 연못의
procedural ripple 수를 일대일로 맞추지 않는다.

## 5) 실행 비용과 갱신 원칙

- 날씨 일정과 태양은 기존 저빈도 갱신 owner에서 샘플링한다. 프레임마다 다시 계산하지 않는다.
- frame 경로는 기존 numeric interpolation, rain motion, petal motion과 수면 shader만 소비한다.
- 정적 배경 texture는 실제 paint 입력이 달라질 때만 갱신한다. wind/event metadata만 바뀌어 다시 굽지 않는다.
- shell·하늘·연못의 세밀한 갱신 주기는 달라도 하나의 canonical weather sample을 따른다.
- 비를 위해 추가 timer, canvas, render pass 또는 빗방울별 수면 entity를 만들지 않는다.
- 비 뒤 방출은 기존 field 상한과 credit을 공유하며 숨겨진 시간의 낙화를 보충하지 않는다.

측정 조건과 현재 비용의 근거는
[weather motion 연구](../../../scripts/dev/zen-weather-motion-research/README.md)에 기록한다.
눈, 번개, 강풍 입자와 별도 weather control UI는 이번 범위에 포함하지 않는다.

## 6) Popup/Overview ceremony는 보류

기존 `GardenAmbientSnapshot` 계약·catalog·surface별 일회 소모 skeleton은 아래에 남아
있으며 현재 제품 surface에 연결되어 있지 않다.

- `src/domains/nudge/garden/ambient/contracts/gardenAmbientContracts.js`
- `src/domains/nudge/garden/ambient/catalog/gardenAmbientCatalog.js`
- `src/domains/nudge/effects/gardenAmbient/GardenAmbientRuntime.js`

이 skeleton의 `clear`, `overcast`, `recovery`, `haze`, `glow` 이름을 활성 weather 입력으로
사용하지 않는다. 향후 연결하려면 자연 날씨를 덮어쓰지 않는 ceremony 의미와 소비
경계를 먼저 정해야 한다. 기존 snapshot을 새로 저장하거나 stats compiler를 연결하지 않는다.

향후 ceremony는 낮은 빈도, 짧은 길이, 비상호작용을 원칙으로 한다. Popup은 작은 motif,
Overview는 제한된 snapshot, Shell은 짧은 의식 수준을 넘지 않는다. 보호 단계 상승,
artifact 발동, Home 방문마다 즉시 보상을 재생하지 않는다. 장기 생명 변화는 기존 분재
owner에 두고 별도 ambient 성장 모델을 만들지 않는다.

관련 surface의 추가 계획은
[Popup/Overview PRD](../popup/popup-overview-garden-experience-prd.md)와
[Basic protection PRD](../dashboard/basic-mode-automatic-protection-prd.md)를 따른다.
그 문서의 미래 ceremony 예시가 자연 날씨와 충돌하면 이 문서의 분리 원칙을 우선한다.

## 7) 검증 기준

1. 동일 world·현지 날짜·시각에서 날씨가 재현되고 stats/session/visit 입력이 없어야 한다.
2. 평년·윤년·연말·자정의 전선 ID와 envelope가 올바르게 이어져야 한다.
3. cloudy/rain/easing/after-rain 변화가 공통 paint 입력에 반영되고 새벽·황혼·밤을 보존해야 한다.
4. 한 전선의 소강·화면 복귀·시간 이동으로 비 뒤 낙화가 반복되거나 충돌하지 않아야 한다.
5. 꽃 공급이 낮음·중간·만개일 때 clear/rain 낙화의 비율과 기존 상한을 지켜야 한다.
6. 반복 draw에서 같은 sky palette를 재사용하고 paint와 무관한 변화가 texture를 다시 굽지 않아야 한다.
