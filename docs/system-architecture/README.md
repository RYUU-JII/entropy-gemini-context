# System Architecture

- Status: Active
- Owner: repository architecture
- Last validated against code: 2026-04-24
- Path policy: current-only
- Canonical for: architecture reading order and canonical axis index

이 경로가 시스템 구조 관련 문서의 유일한 canonical home이다.

이 문서 세트는 현재 채택된 구조와 canonical owner를 정의한다. 구현을 바꿔도
보존할 불변 조건과 그 조건을 실현하는 현재 구현 정책을 함께 설명한다.

## Contract Interpretation

분류와 변경 절차의 정본은
[Document System](../governance/document-system.md#계약의-성격과-변경-절차)이다.
`Active`는 현재 유효한 계약이라는 뜻이며, 모든 파일명이나 폴더 구성이 영구히
고정된다는 뜻은 아니다. 현재 구현 정책도 채택된 변경으로 대체되기 전까지
구현과 CI를 구속한다.

| 영역 | 보존할 불변 조건 | 현재 구현 정책의 예 |
| --- | --- | --- |
| Topology | canonical state의 단일 소유권, 책임 분리, 공개 경계 준수 | `01-topology.md`의 root 배치와 dependency edge |
| Storage | 제품 데이터의 로컬 처리, typed owner 경계, 명시적인 실패 | `02-runtime-storage-boundaries.md`의 backend 할당과 owner 경로 |
| Theme | canonical identity, 테마별 독립 소유권, cross-theme substitution 금지 | `03-theme-plugin-and-zen.md`의 public seam·manifest·chunk 구성 |

각 문서의 `Final`, `Hard Completion`, `What Must Completely Disappear`는 해당
구조 전환에서 충족할 완료 조건이다. 이를 근거로 미래의 정책 변경을 금지하거나,
반대로 정책이라는 이유로 지금의 경계를 우회하지 않는다. 정책을 바꿀 때는 보존할
성질을 밝히고 코드·owner 문서·관련 guard를 같은 변경에서 갱신한다. 상세 owner와
계약은 아래 문서들이 계속 소유하며, 이 표는 별도 규칙 등록부가 아니다.

## Canonical Doc Set

1. `01-topology.md`
2. `02-runtime-storage-boundaries.md`
3. `03-theme-plugin-and-zen.md`
4. `05-background-runtime-owners.md`
5. `06-dashboard-launch-and-loading.md`
6. `04-execution-masterplan.md`

Storage companion note:

- storage owner/topology의 canonical source는 이 폴더와 특히 `02-runtime-storage-boundaries.md` 다.
- `docs/architecture/storage/storage-architecture-target.md` 는 current backend/data-shape detail companion이며, 여기의 owner/path 규칙을 덮어쓰지 않는다.

Zen main presentation companion note:

- dashboard launch/loading owner 판정은 `06-dashboard-launch-and-loading.md`가 우선한다.
- theme plugin placement and Zen boundary 판정은 `03-theme-plugin-and-zen.md`가 우선한다.
- `docs/architecture/themes/zen/zen-main-presentation-scene-architecture.md` 는 Zen main release V1 `current`/`first_vision` decision, boot-scoped session latch, and scene projection contract를 구체화한다.

해석 규칙:

- `01~03`은 실제 구현 세션이 직접 따라야 하는 독립 execution spec이다.
- `05`는 background runtime owner 재설계를 고정하는 독립 execution spec이다.
- `06`은 dashboard launch/loading owner 구조를 고정하는 독립 execution spec이다.
- `04`는 조정과 판정용 문서다.
- `04`를 구현 대상으로 따로 맡기는 것이 아니라, `01~03`과 `05`를 어떻게 밀어붙이고 언제 완료로 볼지 판단하는 기준으로 쓴다.

## Reading Order

1. `01-topology.md`
2. `02-runtime-storage-boundaries.md`
3. `03-theme-plugin-and-zen.md`
4. `05-background-runtime-owners.md`
5. `06-dashboard-launch-and-loading.md`
6. `04-execution-masterplan.md`

## Non-Negotiable Interpretation Rules

- 이 문서에서 `완전히 사라져야 한다`고 적힌 것은 compatibility layer를 제외하면 canonical 구조에서 제거 대상이다.
- 이 문서에서 `아직 실패`라고 적힌 상태는 build가 통과해도 구조 작업은 미완료다.
- `새 경로를 추가했지만 old 경로가 계속 canonical로 남아 있는 상태`는 완료가 아니다.
- `wrapper만 추가하고 owner는 그대로인 상태`도 완료가 아니다.
- 이 폴더 밖의 audit/report/plan 문서는 참고용 historical snapshot일 뿐이며, 여기와 충돌하면 canonical 근거로 쓰면 안 된다.
- 예외적으로 `docs/architecture/storage/storage-architecture-target.md` 는 storage detail companion으로만 사용한다. owner/path/topology 판정은 이 폴더를 우선한다.
- 예외적으로 `docs/architecture/themes/zen/zen-main-presentation-scene-architecture.md` 는 current Zen main presentation scene detail companion으로 사용한다. dashboard launch/loading owner 판정은 `06`, theme placement 판정은 `03`을 우선한다.

## Final North Star

현재 채택된 구조의 중심축은 아래뿐이다.

- `src/apps`
- `src/domains`
- `src/platform`
- `src/themes/core`
- `src/themes/plugins/<themeId>`
- `src/ui-kit`
- `src/lib`

최종 구조에서는 `entries`, `features`, `shared`가 중심축이 아니다.

## Why This Is One Folder

이전처럼 `refactor`와 `target`을 분리하면, 사람이 문서를 읽을 때
`그래서 정답이 뭔가`를 두 번 해석해야 한다.

이 경로는 그 해석 비용을 없애기 위한 단일 구조 정본 경로다.
