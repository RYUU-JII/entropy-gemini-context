# Five Day Journey and Guidance Design

- Status: Active
- Owner: progression domain / dashboard product / guidance runtime / theme presentation
- Last validated against code: 2026-10-09
- Path policy: current-only
- Canonical for: five qualified use day journey experience, first Furin installation presentation and contextual guidance product rules

## 경험의 목표

첫 방문에서 정원의 가능성을 보고, 실제로 사용할 작은 정원으로 내려온다. 그 뒤 다섯 번의 사용일에 걸쳐 보호의 표면과 정원이 함께 넓어진다. 새로운 것을 받는 날에는 다음 행동 하나가 보이고, 실제 보호 상황에서는 설치했던 장치의 의미를 뒤늦게 체감한다.

첫날에도 Lens의 즉각적인 변화, Gate의 진입 경계, Flare를 켤 수 있는 선택이 있어야 한다. 시간은 Sites에서 정하고 Furin은 Tools에서 켜거나 끈다. 실제 Global Protocol의 붕괴와 복구는 사용 시간이 경계에 닿았을 때 남겨둔다. 최소 안내는 사용자가 지금 무엇을 할 수 있고 어떤 결과가 생기는지 설명한다.

공개 일정은 고정하고 체험은 자연스러운 사건에 붙인다. 안내를 닫거나 특정 사이트를 쓰지 않아도 다섯 사용일 뒤 모든 아티팩트를 설정할 수 있다. 공개 구현 정본은 [Progression Policy](./progression-policy.md)와 [Engine Contract](./progression-engine-contract.md), 안내의 상태·admission 정본은 [Guidance Runtime](../guidance/guidance-runtime.md)다.

## 다섯 사용일 공개 정책

사용일은 background tracking owner가 관리 대상 보호 사이트 방문을 성공적으로 기록한 날이다. 현행 04:00 활동일 경계를 유지하고, 같은 활동일에는 한 번만 진행한다. 연속 출석은 요구하지 않는다. 쉬었다 돌아와도 누적 일수는 유지한다. 대시보드 방문이나 설치 후 경과 시간으로 진행시키지 않는다.

| 상태 | 새로 공개하는 아티팩트 | 누적 공개 | 동시에 등록 가능한 보호 사이트 | 분재 공개 점수 | 방문 시 중심 행동 |
| --- | --- | ---: | --- | ---: | --- |
| First Vision | 전체의 형태와 짧은 소개 | 설정 불가 | 기존 등록 진입점 유지 | 이상 정원 별도 연출 | 정원의 가능성을 본다 |
| 현실로 내려온 직후 0일 | Lens, Gate, Flare | 3 | 1 | 0 | 자주 쓰는 사이트 하나를 등록한다 |
| 1일 | 추가 가족 없음 | 3 | 1 | 18 | 첫 사이트에서 보호를 사용한다 |
| 2일 | Brake | 4 | 2 | 35 | 원하면 두 번째 사이트를 등록한다 |
| 3일 | Barrier | 5 | 3 | 53 | 새 장치의 추천 설정을 검토한다 |
| 4일 | Echo | 6 | 4 | 70 | 잔여 흔적을 다루는 방법을 고른다 |
| 5일 | Veil | 7 | 무제한 | 88 | 완성된 정원을 보고 보호 범위를 넓힌다 |

0일의 세 아티팩트는 `first_vision_spent`에서 함께 공개한다. 첫 보호 사용일은 첫날의 장치를 써보는 날이므로 추가 가족을 지급하지 않는다. First Vision 이전에 쌓인 사용일이 있으면 spent 시점에 해당 단계까지 한 번에 정합화한다.

5일차의 보상은 Veil 공개, 전체 일곱 가족 설정 가능, 분재의 온전한 형태, 등록 제한 해제다. 분재는 첫 현실 상태부터 살아 있는 어린 나무이며 매 사용일 자란다. 현행 score 0–88과 stage 경계를 유지하고 `round(min(day, 5) / 5 * 88)`로 공개 나이를 만든다. 건강과 실제 관측은 기존 owner가 계속 다루며 공개 나이를 차감하거나 해금을 막지 않는다.

공개된 가족의 하위 기능은 모두 설정 가능하다. 공개와 활성화는 별도이며, 공개만으로 기존 설정을 바꾸지 않는다. 추천 설정은 사용자가 적용해야 저장한다. Flare의 초기 enabled 값은 false를 유지한다. Gate나 Flare를 숨겨서 켜두지 않는다.

### 사이트 등록과 연못

등록 제한은 현재 등록된 보호 사이트 수에 적용한다. 등록을 유지한 채 효과를 일시정지한 사이트도 자리를 사용한다. 같은 정규화 도메인의 수정은 새 등록이 아니며, 삭제 후 교체는 기존 자리를 쓸 수 있다. 새 등록의 모든 진입점은 background의 동일한 admission 계약을 사용한다. 삭제·일시정지·기존 항목 편집을 제한하지 않는다.

5일차부터 등록 수에는 progression 상한이 없다. 대시보드 연못과 압력 바의 대표 사이트는 계속 최대 다섯 개다. 현행 residence/challenge 선택과 안정된 순서를 유지한다. 여섯 번째 잉어나 새 고정 기능을 추가하지 않는다. 대표에서 빠진 사이트도 정상적으로 보호되고 통계에 포함된다.

한도에 닿은 등록 화면에는 다음 사용일의 한도를 설명한다. 예: “지금은 두 곳을 보호할 수 있습니다. 다음 사용일에 한 자리가 더 열립니다.” 단계 진행을 위해 등록 수를 채우라는 안내는 하지 않는다. 한 곳만 계속 사용해도 전체 공개에 도달한다.

출시 전 저장 형식은 현행 계약 하나만 허용한다. 호환되지 않는 프로필은 자동 삭제하거나 변환하지 않고 명시적 오류와 사용자 reset 경로로 처리한다.

등록 여정이 끝나기 전에는 팝업의 보호 시작과 Sites의 추가 등록이 Main의 등록 intent로 이동한다. 팝업은 현재 정규화 도메인과 화면에 표시한 목표 시간을 전달하며, 권한 요청·등록 queue·설정 저장은 하지 않는다. Main에서 사용자가 확정할 때 기존 permission과 원자적 site-rule command를 실행한다. 보호 사이트 다섯 곳을 동시에 등록했거나 누적 다섯 사용일에 도달하면 직접 등록을 공개한다. 완료는 progression milestone으로 유지하므로 삭제 후에도 다시 첫 동선을 강제하지 않는다. 개발용 전체 접근은 가용성만 투영하고 완료 milestone을 만들지 않는다.

Sites 탭은 첫 보호 사이트 등록 성공 후 관리용으로 공개하고, 모두 삭제해도 유지한다. 첫 등록 전 직접 Sites 주소로 들어오면 Main으로 연결한다. 관리용 목표 수정·삭제는 즉시 제공하며, 등록 여정 중 추가 등록 동선만 정원으로 모은다.

기존 허용 사이트만 가진 프로필은 해당 규칙을 관리할 수 있도록 Sites 접근을 유지한다. 현재 canonical 허용 목록을 읽는 관리 접근이며 별도 해금 milestone은 만들지 않는다. 허용 사이트 수는 보호 자리·첫 보호 등록·등록 여정 완료에 포함하지 않는다.

### 하단 압력 바

압력 바는 사용일 보상과 별도의 관측 결과다. [Main surface 정본](../repository/main-tab-home-surface-boundary-map.md)의 완료된 관측 활동일 세 번 이후 ready, 일곱 번 이후 stable 기준을 유지한다. 사용일 3일차에 무조건 완성된 그래프를 약속하지 않는다.

수집 중에는 “관측이 쌓이면 이곳에 사용의 흐름이 나타납니다.”라는 작은 자리 표시를 둔다. 최초 ready 전환이 실제로 일어나면 첫 화면 복귀에서 한 번만 의미를 설명한다. `no_pressure`도 정상 결과이며 채워진 압력을 만들어 보여주지 않는다. stable 전환에는 추가 팝업을 만들지 않는다.

## 대시보드에서 보이는 변화

Main의 작은 진행 문구는 “정원 2/5”처럼 현재 단계와 다음 변화를 함께 보여준다. 상세 도움말에서는 “보호 사이트를 사용한 날에 자랍니다. 쉬는 날에도 쌓인 기록은 남습니다.”라고 설명한다. 사용 시간 카운트다운이나 출석 실패 표시를 넣지 않는다.

새 단계에 도달하면 실제 권한은 즉시 반영한다. 대시보드가 안전하게 보일 때 정원의 성장 변화와 짧은 안내 하나를 함께 제시한다. 2–4일차는 1.2–2초의 주변 변화와 작은 문구로 처리하고, 화면 전체를 매일 막지 않는다. 5일차는 사용자 화면 복귀 후 3–4초의 완성 연출을 한 번 제안하며 닫기와 모션 축소를 지원한다.

| 단계 | 안내 초안 | 대표 행동 |
| --- | --- | --- |
| 2일 | “멈춤의 돌이 놓였습니다. 보호할 곳을 하나 더 둘 수 있습니다.” | 다른 사이트 추가 |
| 3일 | “새로운 경계가 열렸습니다.” | Barrier 살펴보기 |
| 4일 | “남겨진 흔적을 다루는 장치가 열렸습니다.” | Echo 살펴보기 |
| 5일 | “정원이 온전한 모습을 갖췄습니다. 이제 보호할 곳을 자유롭게 늘릴 수 있습니다.” | Veil 살펴보기 |

단계 안내에는 대표 행동 하나만 둔다. 같은 화면에서 사이트 추가와 아티팩트 적용을 연속으로 요구하지 않는다. 사이트 추가 버튼과 Tools의 새 항목 표시는 일반 화면에 남는다. 안내를 닫아도 새 기능은 즉시 사용할 수 있다.

Tools는 공개된 가족을 정상 카드로, 앞으로 열릴 가족을 형태와 공개 사용일이 보이는 잠긴 항목으로 보여준다. 이름과 공개 조건은 탐색 줄에서 직접 읽을 수 있다. 추천 설정 적용과 토글은 공개 전에는 사용할 수 없다. 최초 세 가족은 동등하게 접근 가능하되, 첫 선택의 중심은 Lens로 둔다.

잠긴 항목의 durable UI 역할은 `data-artifact-gallery-locked-slot`이다. 익명 노치 대신 canonical family glyph·이름·공개 사용일을 탐색 줄에 직접 표시한다. 소개 팝업이나 설정 선택 handler를 열지 않으며 theme seam guard는 이 역할과 공개일 policy 연결을 검증한다.

여러 단계를 놓친 후 돌아왔을 때는 가장 최근 상태의 변화 안내 하나로 합친다. 지나간 단계의 팝업이나 연출을 순서대로 재생하지 않는다. 공개 이력은 도움말에서 읽을 수 있다.

## Furin 설정 흐름

시간의 편집 위치는 Sites 하나다. 전체 보호 사이트의 한도와 개별 한도는 Sites에서 정하며, 시간을 저장해도 Furin을 자동으로 켜지 않는다. Tools의 Furin은 기존 기물 dock에서 ON/OFF만 제공한다. 별도 시간 입력, “후린 걸어두기” 설치 버튼, 설치 카드, Site-only 상시 설명, 설치 장면 다시 보기 진입점은 두지 않는다.

Furin ON/OFF는 `nudgeConfig`만 저장하고 Sites 시간은 `globalGoal`만 저장한다. 한쪽 변경이 다른 쪽의 값을 다시 커밋하지 않는다. 켜짐 설정과 실제 시간 발동 조건은 구분한다. 시간 미설정·기록 OFF·동의 미승인·기록 제외에서도 ON은 보존하며, 기존 control feedback 영역에 대기 사유와 필요한 설정으로 이어지는 행동 하나만 보여준다. 전체·개별 한도의 연결 요약은 canonical recording/cap availability owner를 사용하며 “작동 중”이나 곧 울린다는 약속으로 바꾸지 않는다. 실제 발동의 foreground, 일일 receipt, 보호 presentation admission은 runtime이 소유한다.

새 설치 intent는 만들지 않는다. 기존 v1 설치 사실·지연 intent·strict ACK·재시작 reconciliation 계약은 유지한다. 이미 남아 있는 `pendingInstallation`은 현재 보이는 Sites 시간 영역 또는 Tools Furin feedback 안에서 “설정을 저장했습니다”라는 중립 사실만 표시한다. 두 실제 visible paint 이후 presented/dismissed를 기록하고 completed나 실제 Furin delivery receipt를 만들지 않는다. replay eligibility는 상시 적용 상태를 의미하지 않으며 저장 확인을 계속 노출하는 조건으로 사용하지 않는다.

9초 설치 presentation은 개발 visual harness에만 남는다. 실제 Site Furin과 Global Protocol은 [Flare activation](../themes/artifacts/sentinel-flare-activation-spec.md), [Site Furin](../themes/artifacts/sentinel-flare-site-furin-chime-spec.md), [daily delivery](../runtime/furin-daily-delivery-policy.md)의 owner와 실제 시간 판정을 그대로 사용한다. 실제 발동의 조작은 그 presentation 안에서 설명하며 별도 튜토리얼 팝업을 열지 않는다.

## 최소 안내 목록

자동 안내는 한 문장과 필요한 행동 하나로 구성한다. 설명은 현재 작업 위치에 모으며 별도 문맥 카드를 자동으로 띄우지 않는다. 아래 ID는 v1 guidance catalog의 의미 계약이며, 상시 설명으로 전환된 항목은 기존 receipt만 보존하고 새 claim을 만들지 않는다.

| ID | 처음 안내할 사건 | 안내와 행동 | 이후 처리 |
| --- | --- | --- | --- |
| `popup.first_setup` | 아직 보호 사이트가 없는 popup | “가장 자주 돌아오는 사이트 하나부터.” / 등록 진입 | 등록 ACK 또는 닫기 |
| `garden.first_site` | First Vision 종료 후 빈 정원 | 그림자 잉어 옆에 “보호할 사이트를 하나 등록하세요.” | 최초 등록 ACK로 완료 |
| `site.goal_scope` | 사이트 시간 편집 | 기존 한도 control의 범위 설명 | 자동 claim 없음 |
| `garden.bonsai_growth` | Journey 상세의 성장 설명 | 실제 보호 사이트를 사용한 날의 성장 | 별도 Main 도움말·자동 claim 없음 |
| `main.pressure_ready` | 압력 bar와 선택된 사이트 읽기 | 기존 선택 상태와 제자리 설명 | 자동 claim 없음 |
| `artifact.<family>.first_setup` | 공개된 가족의 dock | 가족 한 문장과 control 효과·현재 상태 | 자동 claim 없음, 변경은 기존 settings ACK |
| `flare.first_installation` | 기존 설치 사실의 pending receipt | 현재 위치에서 중립 저장 확인만 | 실제 paint 후 presented/dismissed, 새 intent·완료 기록 없음 |
| `schedule.first_setup` | 시간표를 작성 | 적용 대상과 시작·끝의 동작을 입력 옆에 설명 | 자동 claim 없음, 저장은 시간표 ACK |
| `settings.recording_scope` | 기록 설정을 편집 | 수집·삭제되는 로컬 기록의 범위 설명 | 자동 claim 없음, 변경은 settings ACK |
| `settings.notification_opt_in` | 변화 알림을 선택 | 해당 control의 설명과 실제 권한 요청 | 자동 claim 없음, 활성화는 실제 권한과 settings ACK |
| `journey.stage_change` | 새로운 canonical 단계에 도달 | 최신 변화 하나와 다음 행동 | 실제로 보인 단계까지 확인 기록 |

popup과 정원 등록 안내는 같은 “첫 사이트 등록” 목표를 공유한다. 한쪽에서 등록했으면 다른 쪽은 설명을 반복하지 않는다. 초기 등록 여정에는 남은 등록 자리마다 시스템 센티넬인 그림자 잉어가 한 마리씩 있다. 검은 몸색의 잉어가 아니라 눈·비늘·반사 없이 반투명하게 움직이는 잉어 그림자다. 등록 성공 ACK가 오면 선택한 그림자의 자리에서 실제 사이트 잉어가 드러나고 해당 자리는 소모된다. 1일차 한 곳을 등록했다면 추가 그림자는 없으며, 새 자리가 열린 뒤 처음 안전한 현실 정원에 진입할 때 경계에서 순차 합류한다. 사용하지 않은 자리는 누적하고 이미 입장한 그림자는 다음 방문에 다시 진입하지 않는다. 현재 정원의 roster admission은 progression의 제한된 invitation-capacity milestone으로 기록하며 실제 시청·체험 완료로 해석하지 않는다. 완료된 등록 여정과 무제한 단계에서는 등록 가능한 경우 한 마리를 반복 입구로 유지한다. 센티넬은 사이트 수·대표 잉어 다섯 마리·사용 기록에 포함하지 않는다. 한도가 찼을 때에는 그림자를 만들지 않고 팝업·장부의 한도 안내가 다음 유효 사용일과 관리 동선을 설명한다. 단순한 대표 사이트 교체는 등록 연출을 재생하지 않으며 추가 자리를 가짜 사이트 잉어나 자동 팝업으로 대체하지 않는다.

| 가족 | 첫 선택의 실용 설명 초안 | 추천 적용에서 유의할 점 |
| --- | --- | --- |
| Lens | “화면의 시각적 자극을 낮춥니다.” | 처음에는 현행 gentle 흑백 추천. 나머지 시각 설정은 바로 편집 가능 |
| Gate | “들어가기 전에 잠깐 멈춥니다.” | 진입과 재진입의 범위를 구분해서 표시 |
| Flare | “정해둔 시간 경계에서 주의를 돌려줍니다.” | 실제 목표 유무와 ON 상태를 함께 표시 |
| Brake | “스크롤과 클릭에 잠깐의 마찰을 더합니다.” | 추천에서 실제 켜지는 하위 기능을 적용 전에 표시 |
| Barrier | “빠르게 이어지는 탐색에 경계를 둡니다.” | 지원하는 상황에서 작동한다는 설명을 유지 |
| Echo | “다시 돌아오게 하는 흔적을 줄입니다.” | 기록 삭제처럼 되돌릴 수 없는 효과는 해당 조작에서 구체적으로 설명 |
| Veil | “숫자와 시간 신호를 가리고, 더 들어갈지 다시 묻습니다.” | 현행 gentle 추천이 모든 Veil 기능을 켜는 것으로 보이지 않게 한다 |

Veil의 의도 경계 등 조건부 기능은 적합한 상황에서 실제로 사용할 때 조작을 설명한다. 해당 상황을 만나지 못한 사용자를 위해 도움말에서 설명과 읽기 전용 장면 소개를 열 수 있게 한다. 소개를 실제 작동 성공으로 기록하지 않는다.

## 안내 우선순위와 반복 억제

실제 보호 presentation과 First Vision의 기존 admission이 가장 먼저다. 기존 pending 저장 확인과 Journey 단계 안내는 안전하고 실제로 보이는 anchor에서만 처리한다. 별도 설치 의식이나 문맥 카드는 열지 않는다. content 보호 장면이 진행될 때 그 위에 안내를 띄우지 않는다.

첫 사이트 자동 안내는 한 dashboard document에서 최대 하나다. 탭 전환이나 컴포넌트 remount로 예산을 새로 만들지 않는다. Journey 단계와 기존 pending 설치 사실은 각 canonical receipt로 중복을 억제한다. popup은 첫 등록 안내 하나만 자동 제공하고, content에서는 보호 조작 자체의 설명을 우선 사용한다.

앵커가 실제로 보이고, 현재 surface가 visible이며, 해당 기능을 사용할 수 있을 때만 제시한다. 개발자가 등록한 의미상의 anchor ID를 사용하고 CSS class나 임의 DOM selector로 대상을 추정하지 않는다. 화면을 자동으로 다른 탭으로 바꾸거나 사용자의 스크롤을 강제하지 않는다.

| 상태 또는 기록 | 의미 |
| --- | --- |
| `unseen` | 해당 revision의 안내가 실제로 보였다는 기록 없음 |
| session claim | 한 host가 일시적으로 제시 권한을 얻음. 시청 기록 아님 |
| `presentedAtMs` | 실제 visible 첫 화면 ACK가 도착함 |
| `dismissedAtMs` | 사용자가 명시적으로 닫음. 이해 또는 기능 성공으로 해석하지 않음 |
| `completedAtMs` | 안내별로 정의한 실제 동작 ACK나 presentation 종료가 확인됨 |
| `presentation_failed` | renderer 또는 첫 화면 ACK 실패. 설정·권한과 별도로 오류를 알림 |

presented 이후의 설명은 자동으로 재등장하지 않는다. pending 설정 명령은 시청 기록과 무관하게 기존 오류·재시도 UI를 유지한다. 표시 전에 host가 사라지면 claim을 반납하고 다음 적합한 surface에서 제시할 수 있다. 설치 장면의 공개 다시 보기 진입점은 없다.

catalog revision 변경은 모든 안내를 다시 띄우는 스위치로 쓰지 않는다. 동작 의미가 바뀐 항목만 새로운 안내로 정의한다. 실제 기능 완료 사실은 revision이 바뀌어도 유지한다.

## 상태와 명령의 소유권

### 현재 owner와 새 seam

ProgressionService는 공개와 사용일을, SettingsService는 실제 보호 설정을, nudge owner는 실제 Flare 발동을 계속 소유한다. 새 GuidanceService는 안내 eligibility, 시청 기록, 설치 presentation의 의미 기록만 소유한다. 안내에서 progression 권한을 승인하거나 보호 시간과 효과 성공을 판정하지 않는다.

| 책임 | 현재 owner | 저장과 전달 |
| --- | --- | --- |
| 사용일·공개·분재 release age | `src/domains/progression/model/progressionService.js` | 기존 ProgressionRepository |
| 전체 목표·Flare 활성화 | 기존 settingsCommandBus / SettingsService | 검증된 `committedItems`와 propagation receipt |
| 안내 policy와 catalog | `src/domains/guidance/contracts/guidanceState.js` / GuidanceService | 명시적 catalog와 소유 service |
| 안내 command/query | background GuidanceService | trusted route, profile generation 검증 |
| 안내와 설치 기록 | GuidanceRepository / typed GuidanceStateStore | `chrome.storage.local`의 등록 key `guidance_state` |
| 제시 중 claim과 host lease | GuidanceRepository / typed GuidanceSessionStore | `chrome.storage.session`의 `guidance_presentation_session` |
| dashboard·popup의 안내 host | 각 app의 얇은 GuidanceHost adapter | typed transport와 의미 anchor 등록 |
| 설치 장면의 화면과 소리 | 각 theme plugin의 named presentation seam / 기존 sound owner | 정규화된 theme ID와 사용자 설정 |
| 실제 Site·Global Flare | 기존 protection / nudge runtime | 실제 admission, 시간 사실과 일일 receipt |
| 변화 알림 | 기존 NotificationService | catalog, capability, typed click route |

새 store는 [storage topology](../../system-architecture/02-runtime-storage-boundaries.md)와 [backend 계약](../storage/storage-architecture-target.md)에 등록한다. feature에서 raw Chrome storage나 DB manager에 접근하지 않는다. 현재 Tools의 localStorage nav cue는 UI 장식으로만 남기거나 제거하며, 새 durable 안내 기록과 두 개의 확인 owner를 만들지 않는다.

Main의 [current와 first vision 계약](../themes/zen/zen-main-presentation-scene-architecture.md)은 유지한다. Furin installation의 theme presentation은 개발 visual harness에만 남으며 공개 overlay를 열지 않는다. window custom event 자체를 설치 사실의 증거로 인정하지 않는다.

### 공개 snapshot

`progression_unlock_v3`에서 일수와 가족 수의 결합을 제거한다. `journeyStageCount = 5`와 canonical 가족 catalog 7개를 각각 검증한다. ordered family prefix를 일수만큼 잘라 공개하지 않고, 명시적인 stage table을 사용한다. Tools의 여정 표시 순서는 Lens, Gate, Flare, Brake, Barrier, Echo, Veil로 두며, family ID와 하위 기능 catalog는 순서 변경 때문에 다시 정의하지 않는다.

| 필드 | 계약 |
| --- | --- |
| `canonicalQualifiedUseDayCount` | durable 원래 사용일 수를 0–5 공개 단계로 투영한 값 |
| `qualifiedUseDayCount` | public에서는 canonical과 같음. dev에서는 명시적 session projection |
| `disclosedFamilyIds` | 고정 일정과 보존된 grants의 합집합 |
| `canonicalDisclosedFamilyIds` | dev projection과 무관한 durable 공개 집합. 실제 새 항목 확인과 알림의 기준 |
| `effectiveFamilyIds` | 해당 빌드·접근 모드에서 실제 설정·runtime eligibility에 쓰는 집합 |
| `newlyGrantedFamilyIds` | 한 commit에서 새로 공개된 전체 가족. 단일 last family로 대체하지 않음 |
| `siteRegistrationBudget` | `{ mode: 'limited', limit: positiveInteger }` 또는 `{ mode: 'unlimited' }`의 정확한 union. 현행 여정의 limit은 1–4 |
| `representedSiteLimit` | 항상 5. 등록 budget의 대용으로 사용하지 않음 |
| `bonsaiRelease` | 동일한 effective 사용일의 0–88 score·stage·fullFormReady |
| `nextStage` | 다음 사용일의 변화 묶음. 5일차 이후에는 없음 |

무제한을 999, Infinity, 누락된 limit 또는 임의 null로 표현하지 않는다. 등록 admission은 union을 검증하고 settings mutation lane에서 최신 등록 수와 함께 판정한다. 동시에 여러 등록을 요청해도 제한을 초과하지 않는다. 최종 보호 snapshot을 만드는 owner도 같은 공개 결과를 적용한다.

### Guidance command 계약

| 명령 또는 query | 판정과 결과 |
| --- | --- |
| `GET_GUIDANCE_STATE` | 현재 profile generation과 surface에 맞는 좁은 read model |
| `CLAIM_GUIDANCE` | 현재 권한·앵커·visible 상태·우선순위를 검증하고 host/document에 묶인 lease 발급 |
| `MARK_GUIDANCE_PRESENTED` | 일치하는 claim의 visible 첫 화면 ACK만 수용 |
| `DISMISS_GUIDANCE` | 닫기 기록 후 lease 종료. 권한·설정 변화 없음 |
| `COMPLETE_GUIDANCE` | catalog가 정한 실제 사건의 trusted receipt 검증. UI의 “이해함”을 효과 사실로 승격하지 않음 |
| `PREPARE_FURIN_INSTALLATION` | 보존된 v1 trusted 계약. dashboard의 새 emitter는 없음 |
| 내부 `RECORD_FURIN_INSTALLATION` | 기존 intent의 전체 settings ACK를 엄격히 검증. 새 UI가 값을 합성하지 않음 |
| `RELEASE_GUIDANCE` | navigation, hide, unmount, preemption 시 해당 lease 종료 |

자동 단계 안내는 progression snapshot의 최신 canonical 단계와 guidance의 마지막 제시 단계를 비교해 구한다. 매일 새 이벤트를 영구 queue에 쌓지 않는다. 안내 ledger의 크기는 catalog 항목 수와 첫 설치 intent 한 개로 제한한다.

설치 사실은 권한을 지급하지 않으므로 새 progression milestone로 중복 저장하지 않는다. Guidance의 installation record는 설치한 설정 revision과 실제 저장 결과를 가리키며, 현재 ON 상태는 언제나 canonical settings에서 읽는다. 과거 설치 기록으로 현재 OFF를 ON처럼 보여주지 않는다.

### 저장 후 중단과 복구

새 UI는 독립적인 설정 명령만 저장하며 설치 intent를 만들지 않는다. 기존에 생성된 intent·설정 ACK·설치 사실 사이의 비원자적 기록과 복구 계약은 보존한다. 실행 중인 설정 요청의 성공은 검증된 `committedItems`만으로 인정한다.

저장과 installation 기록 사이에 worker가 종료되면 다음 안내 초기화에서 남은 intent를 canonical settings와 정합화한다. 정확한 ACK가 복원되지 않은 경우에는 현재 설정 일치를 확인한 `configuration_reconciled` 출처로 기록하고 과거 commit 시간이나 실행 성공을 만들어내지 않는다. 현재 설정이 다르면 intent를 종료한다. 이 복구는 설정을 다시 저장하거나 사용자의 새 선택을 덮어쓰지 않는다.

기존 pending 저장 확인의 claim 직전에 target·Flare ON·profile generation·적용 오류를 다시 확인한다. stale intent나 full profile reset 이전의 ACK는 거절한다. reset 시 기존 maintenance quiesce 안에서 guidance local/session store를 함께 비운다. 일반 analytics reset은 안내·설치 기록을 보존한다. 개발 장면 preview는 read-only presentation mode를 사용한다.

guidance의 시청·delivery·설치 intent 기록은 export/import 대상에서 제외한다. settings import는 기존 guidance 기록을 덮어쓰지 않고 진행 중인 claim을 generation fence로 종료한다. import된 유효 목표와 Flare ON을 처음 인식한 경우에는 `existing_configuration`으로 초기화하고 설치 영상을 자동으로 틀지 않는다. 공개 entitlement의 import와 정합화는 기존 progression owner가 맡는다.

다중 dashboard가 같은 안내를 동시에 보여주지 않도록 background가 동일 profile의 claim을 직렬화한다. session lease는 bounded 만료와 visible host의 갱신을 갖고, worker 재시작 후 stale host를 검증한다. 실제 보호의 lease/admission을 복제하지 않고 기존 개입 상태와 연결한다. 갱신 과정에서 창 활성화나 OS focus를 요청하지 않는다.

renderer 실패는 진단 가능한 오류와 lease 해제를 남긴다. 설정 저장과 보호는 유지하고 시청 완료를 조작하지 않는다. 다른 테마 renderer로 대신 재생하지 않는다.

## 변화 알림

알림은 명시적 opt-in이다. 첫 등록 완료 뒤 작은 선택으로 “정원의 변화를 알림으로 받기”를 제안할 수 있으며, 선택했을 때만 기존 capability owner를 통해 권한을 요청한다. 설정 화면에서 언제든 바꿀 수 있게 한다.

알림 대상은 canonical 2–5일 단계 공개다. 등록 자리와 새 가족을 하루 하나의 변화로 합친다. 권한이 즉시 열린다는 사실은 알림의 성공 여부에 의존하지 않는다. 대시보드에서 그 단계를 실제로 보고 확인했으면 OS 알림을 억제한다. 단지 dashboard tab이 존재한다는 이유로 억제하지 않는다.

문구는 “정원에 새 장치가 놓였습니다. 보호할 곳을 하나 더 둘 수 있습니다.”처럼 현재 변화를 말한다. 클릭은 typed route로 Main의 최신 변화에 도착하고, 적절한 상태에서 대표 행동을 제공한다. Flare를 실제로 발동시키거나 임의 content tab을 열지 않는다.

기존 [NotificationService 경계](../repository/notifications-runtime-boundary-map.md)에 journey event·설정 필드·copy·click route를 추가한다. 현재 session dedupe만으로 재시작을 넘는 일회성을 약속하지 않는다. GuidanceState의 최신 단계 delivery record를 dispatch 전에 reserve하고 결과를 기록한다. browser dispatch와 저장 사이의 불확실한 중단은 `delivery_uncertain`으로 두고 자동 재전송하지 않는다. 중복 방지를 우선하며, 놓친 변화는 대시보드에서 확인할 수 있다.

권한 거절이나 알림 OFF는 일반 상태다. 이전 단계의 발송 부채를 쌓지 않는다. 새 단계가 오면 최신 단계 하나로 대체하고, 같은 활동일에 progression 알림을 반복 발송하지 않는다. tracking commit 이후의 알림 실패가 사용일 기록이나 보호를 실패시키지 않도록 후속 처리를 분리한다.

명시적 reset이나 현행 snapshot import 자체는 OS 여정 알림을 발송하지 않는다. 실제 새 사용일의 공개만 발송 후보가 된다.

## 출시 전 저장 계약과 개발 빌드

출시 전에는 기존 프로필 migration을 제공하지 않는다. progression, artifact disclosure와 개발 projection은 현행 exact shape만 읽는다. old policy, beta configured-state grant, calendar replay, 등록 continuity floor를 위한 initializer와 read-time write를 두지 않는다. 현행 문서의 부재만 신규 초기화로 처리하고, 형식 불일치는 원본을 보존한 명시적 version/contract 오류다. 사용자가 명시적으로 reset한 뒤 새 프로필을 만들 수 있다.

snapshot import도 현행 계약 preflight를 통과해야 한다. 기존 설정을 공개 entitlement나 설치 성공으로 전환하지 않는다. 정상 여정, explicit manual/advanced grant, 보존된 설치 ledger와 현재 등록 milestone은 유지한다. 출시 후 upgrade/downgrade, 원자적 activation, 중단 재개, skip-release와 sunset은 [저장소 버전·migration 정책](../storage/storage-versioning-and-migration-policy.md)의 별도 릴리스 결정으로 구현한다.

내부 개발 빌드는 현재의 전체 접근을 유지한다. public beta와 release는 같은 여정 정책을 사용한다. 개발 HUD에는 전체 접근과 여정 미리보기를 명시적으로 구분한다. 0–5일을 선택한 여정 미리보기에서는 해당 일수의 gated 권한을 사용해 아티팩트·분재·등록 admission을 함께 투영한다. 전체 접근을 유지한 채 카드만 잠긴 것처럼 그리지 않는다. 압력 바 준비 상태와 실제 사용 통계는 날짜 선택으로 위조하지 않는다.

현행 [debug contract](../../../src/domains/progression/debug/progressionUnlockDebugContract.dev.js)와 [day control](../../../src/apps/dashboard/progression/dev/ProgressionUnlockDebugControl.dev.jsx)을 0–5로 바꾸고 기본 full projection은 5일로 설정한다. canonical/live와 First Vision preview의 의미를 유지한다. 설치·문맥 안내도 durable 기록을 쓰지 않는 별도 preview를 제공한다. 공개 빌드에는 debug mode·명령·repository·HUD를 포함하지 않는다.

QA synthetic fixture는 다섯 실제 owner 활동일 기록으로 일곱 가족이 열리는 것을 검증하도록 전환한다. fixture marker와 계약을 함께 바꾸고, 기존 일곱 날 fixture를 새 정책의 증거로 재사용하지 않는다.

## 구현 순서와 완료 기준

| 순서 | 구현 묶음 | 함께 바꾸는 정본과 확인 |
| --- | --- | --- |
| 1 | 명시적 5일 stage table, v3 snapshot, unlimited admission, current-only persistence, dev 0–5 | progression policy·engine·runtime boundary, site mutation 계약, 관련 구조 guard와 순수 정책 검사 |
| 2 | Guidance catalog·typed stores·background service·claim·최신 단계 안내 | storage·background·dashboard owner 문서, generation/reset와 중복 host 검증 |
| 3 | Sites 시간·Tools ON/OFF 분리, 기존 pending 설치 receipt 보존 | goal-only·nudge-only 저장, 실패·기록 OFF·제외·실제 paint ACK 검증 |
| 4 | popup·Main·Tools·설정의 의미 anchor와 도움말 | 각 surface 문서, i18n namespace·generated resources·접근성 확인 |
| 5 | opt-in journey 알림, 실제 보호 설명 연결, release fixture | notifications·nudge boundary와 QA target contract, 공개 빌드 closure 확인 |

설치 presentation의 theme seam은 개발 visual harness용으로 유지한다. 공개 Furin 설정은 여섯 테마 모두 동일한 ON/OFF와 시간 연결/대기 의미를 사용하되 각자의 기존 dock 표현을 따른다. theme 구현이 빠진 상태에서 Zen을 교차 fallback으로 사용하지 않는다. 기능 공개 일정과 안내 상태는 테마를 바꿔도 공유한다.

| 검증 장면 | 완료 조건 |
| --- | --- |
| 신규 현실 0일 | 사이트 한 곳, 시작 세 가족, 살아 있는 어린 분재가 함께 보임 |
| 사용일 1–5 | 한 곳만 사용해도 순서대로 진행하고 같은 날 반복·쉬는 날은 공개를 바꾸지 않음 |
| 5일차 | 가족 일곱 개, fullFormReady, 추가 사이트 등록 허용. 연못과 압력 바 대표는 최대 다섯 |
| 압력 관측 지연 | journey day 3이어도 관측 미충족이면 수집 중. 실제 ready에서만 안내 |
| Furin ON/OFF 저장 실패 | canonical 토글 복원, 제자리 오류·재시도 유지. Sites 시간 재저장 없음 |
| 시간 미설정·기록 OFF·제외 | ON 보존, 정확한 대기 이유와 필요한 설정으로 이어지는 행동 하나 |
| 기존 pending 저장 확인 | 실제 visible paint 후 dismissed, 일일 Furin receipt·사용량·완료 기록 변화 없음 |
| 실제 목표 도달 | 기존 Site·Global dispatch와 daily policy 적용. 설치 receipt가 실제 첫 full을 소비하지 않음 |
| 안내 중 real intervention | 안내가 자리를 내주고 실제 보호의 lease·결과가 정상 종료 |
| 두 dashboard와 worker 재시작 | 동일 자동 안내 중복 표시를 억제하고 stale ACK를 거절 |
| 기존 beta 상태 전환 | 기존 사이트·설정·grants 보존, 미구성 가족은 새 일정 사용 |
| import와 profile reset | 새 schema와 정책으로 명시적 정합화. reset 이전 명령·claim·ACK 거절 |
| dev와 public | dev preview는 durable 사실을 바꾸지 않으며 public closure에서 debug 코드 제외 |
| 키보드·모션·사운드 | 모든 공개 control 접근 가능, 사용자 설정 준수, 개발 preview와 실제 보호 renderer 분리 |

제품 평가는 초기 경로가 복잡한지와 실제 보호를 만나기 전 기대가 유지되는지에 집중한다. 로컬에서 등록 ACK, 사용일, 단계 안내 제시·닫기, 설정 적용, 보존된 pending 저장 확인을 구분해 살펴볼 수 있다. 안내 시청을 효과 성공으로 계산하거나 추가 온라인 telemetry를 도입하지 않는다.

다섯 사용일은 한 번의 방문으로 모두 열리길 원하는 사용자에게 지연으로 느껴질 수 있다. 첫날 세 가족과 즉시 확인 가능한 Lens, 다음 변화의 명료한 표시로 이 부담을 낮춘다. Furin ON과 실제 발동은 다르므로 일정·권한을 실제 발동에 묶지 않고, 기존 control feedback에서 실제 시간 연결과 대기 조건을 읽을 수 있게 한다.
