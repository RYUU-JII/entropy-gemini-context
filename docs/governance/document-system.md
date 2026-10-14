# Document System

- Status: Active
- Owner: repository governance
- Last validated against code: 2026-03-16
- Path policy: current-only
- Canonical for: document metadata, naming, lifecycle, and enforcement rules

이 문서는 Entropy 저장소의 문서 시스템이 어떻게 동작해야 하는지 정의한다.

## 목표

- 문서를 읽는 순서만으로 현재 프로젝트 구조를 파악할 수 있게 한다.
- 같은 질문에 대해 canonical answer가 두 군데 생기지 않게 한다.
- plan, migration, audit, archive를 정본 문서와 명확히 분리한다.
- 시간이 지나도 문서 경로와 네이밍이 다시 평면 구조로 무너지지 않게 한다.

## 문서 타입

- `system-architecture`: 현재 owner와 topology, 보존할 불변 조건을 설명하는 정본
- `governance`: 문서 규칙과 전역 engineering guard
- `architecture`: 현재 구현을 설명하는 세부 기술 설계
- `product`: PRD, IA, UX 방향
- `domains`: domain baseline과 운영 규칙
- `apps`: entrypoint, app shell, boot orchestration
- `operations`: CI, QA, runbook
- `migrations`: 아직 종료되지 않은 전환 문서
- `archive`: audit, evidence, completed plan, retired design

## 배치 규칙

- 전역 구조의 정답은 `docs/system-architecture/` 에 둔다.
- 세부 설계는 `docs/architecture/` 에 둔다.
- 제품 요구사항은 `docs/product/` 에 둔다.
- 코드 탐색용 얇은 owner guide는 코드 옆 `README.md` 에 둔다.
- 에이전트 task/symptom 라우팅은 `docs/governance/agent-routing-index.md` 에 둔다.
- archive 문서는 실행 지시로 해석하지 않는다.

## 라우팅 문서 규칙

라우팅 문서는 수정 위치를 확정하지 않는다. 라우팅 문서는 에이전트가 첫 조사
문서와 첫 코드 entrypoint를 고르게 하는 얇은 index이며, 실제 수정 위치는
관련 `Active` 문서의 owner table, canonical path, system flow, function ledger
로 확인한다.

라우팅 문서에는 아래 표현을 피한다.

- `edit this file`
- `fix here`
- `source of truth` 를 특정 코드 파일에 직접 부여하는 문장

대신 아래 구조를 사용한다.

- `Signal / symptom`
- `Start here`
- `Confirm owner by`
- `First code entrypoints`
- `Common false starts`

`Proposed`, `Draft`, `Hold` 문서는 라우팅 표에서 context only 로만 표현한다.
사용자가 채택/검토를 명시하지 않은 상태에서 authoritative route로 두지 않는다.

## naming 규칙

- active/canonical 문서 파일명에는 버전 suffix를 붙이지 않는다.
- active/canonical 문서 파일명에는 `final` 같은 상태 표현도 넣지 않는다.
- history 구분이 필요하면 archive 경로에서만 날짜나 qualifier를 사용한다.
- 문서 제목은 현재 시점을 기준으로 쓴다.

## 메타 규칙

`docs/system-architecture`, `docs/governance`, `docs/architecture`, `docs/product`, `docs/domains`, `docs/apps`, `docs/operations`, `docs/migrations`, `docs/decisions` 아래의 active 문서는 아래 메타를 필수로 가진다.

- `Status`
- `Owner`
- `Last validated against code`
- `Path policy`
- `Canonical for`

선택 메타:

- `Scope`
- `Supersedes`
- `Superseded by`

`Path policy` 는 다음 두 값만 사용한다.

- `current-only`: inline path 와 markdown link 가 모두 현재 저장소 경로를 가리켜야 한다.
- `planning-allowed`: markdown link 는 현재 경로를 가리켜야 하지만, inline code path 는 계획 중인 파일/슬라이스를 설명할 수 있다.

`Status` 는 다음 제한된 vocabulary 만 사용한다.

- `Active`
- `Draft`
- `Proposed`
- `Hold`
- `Migration`
- `Archived`

상태 해석:

- `Active`: 현재 기준선, 현재 구현 설명, 현재 유효한 결정
- `Draft`: 방향은 유효하지만 아직 구현/합의가 닫히지 않은 문서
- `Proposed`: 아직 채택되지 않은 설계 제안
- `Hold`: 현재 릴리스에서는 보류된 backlog 자산
- `Migration`: 진행 중인 전환 문서
- `Archived`: active tree 바깥으로 내려가야 하는 역사 문서

상태별 추가 메타:

- `Active`: `Canonical for` 가 있어야 한다.
- `Proposed`: `Decision needed` 가 있어야 한다.
- `Migration`: `Exit criteria` 가 있어야 한다.

해석 원칙:

- `Decision needed` 는 “무엇을 채택하거나 거절해야 이 문서가 닫히는가”를 한 문장으로 적는다.
- `Exit criteria` 는 “어떤 조건이 충족되면 migration 상태를 종료할 수 있는가”를 한 문장으로 적는다.

## 계약의 성격과 변경 절차

문서 안의 개별 규칙은 보호할 성질과 현재 구현 선택을 구분해 설명한다.

| 구분 | 의미 | 예 |
| --- | --- | --- |
| 불변 조건 (`invariant`) | 구현 변경에도 보존할 제품·보안·정확성·소유권 성질 | 기기 내 데이터 처리, canonical state의 단일 소유권, typed storage 경계, 신뢰 경계 검증, cross-theme substitution 금지 |
| 현재 구현 정책 (`current implementation policy`) | 불변 조건을 현재 구현하는 경로·구성·운영 선택 | owner 파일 배치, named public seam의 파일 구성, chunk 배치, checker 실행 순서와 CLI 이름 |

`Active`는 문서의 현재 권위를 나타내며 위 구분과 독립적이다. 현재 구현 정책도
코드·소유 Active 문서·영향받는 guard/test가 같은 변경에서 갱신되기 전까지
의무적인 계약이며 기존 CI 차단 효력을 유지한다. 정책이라는 분류만으로 storage,
security, runtime ownership 경계를 우회하거나 검사를 advisory로 바꿀 수 없다.
분류를 아직 적지 않은 기존 규칙의 효력도 달라지지 않는다.

규칙을 변경할 때는 보존할 불변 조건, 바꿀 정책과 그 이유, 영향을 받는 owner와
검증 근거를 관련 Active 문서에 필요한 만큼 기록한다. 변경 범위가 owner/path,
runtime/storage boundary, theme public seam, product baseline 또는 guard 계약에
닿으면 기존 `agent-start-here.md`의 갱신 기준에 따라 코드·문서·해당 guard/test를
함께 맞춘다. 문서화된 계약을 유지하는 국소 리팩터링은 추가 문서 작업을 요구하지 않는다.

불변 조건 자체의 변경은 제품·보안·정확성 의미를 바꾸는 결정이므로 일반적인
구현 선호 변경으로 처리하지 않는다. 기존 소유 문서와 의사결정 절차에서 그 이유와
영향을 명시한다. Fallback 예외는 `fallback-elimination-policy.md`를, persistence
계약 진화는 `docs/architecture/storage/storage-architecture-target.md`와 관련
architecture decision의 더 엄격한 기존 조건을 계속 따른다.

이 구분은 필요한 규칙을 설명하기 위한 것이다. 별도 registry, 필수 메타데이터,
새 상태나 승인 절차를 추가하지 않으며 전체 문서를 일괄 재분류하지 않는다.

## 코드 근접 README 규칙

코드 옆 README는 아래만 담당한다.

- 이 디렉터리가 무엇을 소유하는가
- 어떤 하위 디렉터리부터 읽어야 하는가
- 관련 canonical docs 가 어디에 있는가

긴 spec, PRD, migration plan은 코드 옆에 두지 않는다.

## 템플릿과 작성 시작점

새 governed doc는 아래 템플릿 중 하나에서 시작한다.

- `docs/templates/active.md`
- `docs/templates/proposed.md`
- `docs/templates/migration.md`

빠르게 시작해야 할 때는 editor snippet도 함께 사용한다.

- snippet file: `.vscode/entropy-docs.code-snippets`
- snippet prefix:
  - `doc-active`
  - `doc-proposed`
  - `doc-migration`

기본 규칙:

- 현재 기준선을 설명하면 `active.md`
- 채택 결정을 기다리면 `proposed.md`
- 전환 문서면 `migration.md`

## archive 규칙

- archive에는 증적 가치나 재검토 가치가 있는 문서만 둔다.
- prep 메모, private tooling note, low-signal prompt asset은 archive에 남기지 않는다.
- active docs 와 archive docs 가 같은 질문에 동시에 답하지 않게 유지한다.

## 자동 점검

문서 구조가 다시 흐트러지지 않도록 최소한의 자동 점검을 둔다.

`check:docs:paths`는 build check 등록부의 `prebuild` phase에 포함되며,
`prebuild:release` hook과 release 구조 검사 프로필에서 실행한다. 개발용
`npm run build`의 `--artifact-only` 경로에는 이 검사가 포함되지 않는다.

- `npm run check:docs:paths`

이 체크는 다음을 본다.

- active docs 에 버전/`final` 네이밍이 다시 생기지 않았는가
- governed active docs 에 `Status`, `Owner`, `Last validated against code`, `Path policy` 가 있는가
- `Status` 값이 허용된 vocabulary(`Active`, `Draft`, `Proposed`, `Hold`, `Migration`, `Archived`) 안에 있는가
- `Active` 문서에 `Canonical for` 가 있는가
- `Proposed` 문서에 `Decision needed` 가 있는가
- `Migration` 문서에 `Exit criteria` 가 있는가
- `Last validated against code` 형식이 `YYYY-MM-DD` 인가
- `Path policy` 값이 허용된 값(`current-only`, `planning-allowed`)인가
- markdown link 와 대표적인 path reference 가 실제 경로를 가리키는가
- `docs/` 루트에 예기치 않은 top-level 문서가 다시 생기지 않았는가
- `docs/` 바로 아래 Markdown이 옛 entry/shared/feature 경로나 `StatsCache.js`를
  언급할 때 `> Historical path note:` 표시를 갖는가. 이 검사는 본문과 fenced
  code 모두에 적용하며, 기존 audit-/security- 접두사 문서 제외를 유지한다.
  하위 spec/archive까지 범위를 확대하지 않으며 기존 경로 유효성 검사를 면제하지 않는다.
