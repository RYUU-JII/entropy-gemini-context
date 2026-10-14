# Agent Start Here

- Status: Active
- Owner: repository governance
- Last validated against code: 2026-04-03
- Path policy: current-only
- Canonical for: agent documentation entrypoint and task-to-document routing guide

이 문서는 에이전트가 Entropy 저장소에서 작업을 시작할 때 가장 먼저 읽는 단일 entrypoint다.

## 목적

- 작업 전에 어떤 문서를 기준으로 삼아야 하는지 빠르게 결정한다.
- 문서 전체를 무작정 읽지 않고, task와 직접 관련된 canonical docs만 찾게 한다.
- `Active`, `Proposed`, `Migration`, `Hold` 문서를 어떻게 해석해야 하는지 통일한다.

## 가장 먼저 볼 문서

1. 저장소 전체 구조와 읽기 순서:
- `docs/system-architecture/README.md`
- `docs/governance/document-registry.md`
- `docs/governance/agent-routing-index.md`

2. 문서 규칙과 상태 해석:
- `docs/governance/document-system.md`

3. 구조 타협, compatibility, fallback 판단이 포함된 작업이라면 추가:
- `docs/governance/fallback-elimination-policy.md`

작업 시작 시에는 위 문서들을 우선 확인하고, 그 다음부터는 현재 task에 맞는 canonical docs만 추가로 읽는다.

`agent-routing-index.md` 는 수정 위치를 정하는 문서가 아니다. task나 증상에서
조사 시작점을 고르는 얇은 라우터이며, 실제 수정 위치는 관련 `Active` 문서의
owner table, canonical path, system flow, function ledger로 다시 확인한다.

## 상태 해석 규칙

- `Active`: 현재 기준선이다. 구현/구조/운영 판단의 기본값으로 사용한다.
- `Proposed`: 아직 채택되지 않은 제안이다. 사용자가 그 제안을 검토하거나 채택하려는 경우에만 따른다.
- `Migration`: 전환 중 문서다. 현재 상태와 목표 상태를 함께 설명하므로 cutover 작업에서만 직접 따른다.
- `Draft`: 방향 문서다. 현재 구현보다 우선하지 않는다.
- `Hold`: 참고용 backlog다. 현재 구현 지시로 해석하지 않는다.
- `Archived`: 역사 문서다. active 작업의 기준선으로 사용하지 않는다.

충돌 시 우선순위:

1. `docs/system-architecture/**`의 `Active` 문서
2. 관련 영역의 `Active` 문서
3. 관련 `Migration` 문서
4. `Proposed` 또는 `Draft` 문서
5. `Hold` / `Archived`

## task별 문서 라우팅

증상 기반으로 더 빠르게 시작해야 하면 먼저
`docs/governance/agent-routing-index.md` 의 `Investigation Routes` 표를 본다.
그 표의 `Start here` 는 조사 시작점이고, `Confirm owner by` 가 실제 권위 확인
절차다.

### 1. 저장소 구조, owner map, 어디에 코드를 둬야 하는가

읽을 문서:

- `docs/system-architecture/01-topology.md`
- `docs/governance/fallback-elimination-policy.md`
- `docs/system-architecture/05-background-runtime-owners.md`
- `docs/system-architecture/06-dashboard-launch-and-loading.md`
- `docs/governance/import-boundaries.md`

### 2. storage, persistence, release V1 contract, store ownership

읽을 문서:

- `docs/governance/fallback-elimination-policy.md`
- `docs/system-architecture/02-runtime-storage-boundaries.md`
- `docs/architecture/storage/storage-architecture-target.md`
- `src/platform/storage/README.md`

pre-release profile reset이나 DB V1 재생성이 필요하면 추가:

- `docs/operations/runbooks/pre-release-development-profile-reset.md`

현재 release V1 runtime에는 이전 Entropy storage 계약을 해석하는 migration이
없다. 향후 공개 후 V2가 필요하면 별도 architecture decision을 먼저 추가한다.

### 3. theme engine, Zen, plugin seams, theme public entry

읽을 문서:

- `docs/governance/fallback-elimination-policy.md`
- `docs/system-architecture/03-theme-plugin-and-zen.md`
- `docs/architecture/themes/zen/zen-theme-definition.md`
- `src/themes/README.md`
- `src/themes/plugins/README.md`
- `src/themes/plugins/zen/README.md`

### 4. dashboard, popup, app shell, boot/loading

읽을 문서:

- `docs/system-architecture/06-dashboard-launch-and-loading.md`
- 관련 `docs/product/dashboard/**`
- `src/apps/README.md`

context only:

- `docs/apps/dashboard/dashboard-boot-shell-worker-architecture.md` (`Proposed`; 사용자가 채택/검토를 명시한 경우에만 구현 기준)

### 5. background runtime, tracking, protection, stats

읽을 문서:

- `docs/governance/fallback-elimination-policy.md`
- `docs/system-architecture/05-background-runtime-owners.md`
- `docs/domains/protection/protection-settings-propagation-policy.md`
- `docs/domains/behavior/behavior-engine.md`
- `docs/domains/stats/stats-engine-baseline.md`
- `src/domains/README.md`

### 6. i18n, copy ownership, runtime/UI translation rules

읽을 문서:

- `docs/architecture/i18n/i18n-architecture-target.md`
- 관련 `docs/migrations/i18n/i18n-migration-plan.md`

### 7. CI, guard scripts, validation expectations

읽을 문서:

- `docs/operations/ci/quality-gate.md`
- `docs/governance/document-system.md`

## 작업 방식 규칙

- 문서를 전체 탐색하지 말고, registry와 task 라우팅을 따라 필요한 문서만 읽는다.
- 구현 판단이 필요하면 먼저 `Active` 문서를 찾고, 없을 때만 `Migration`이나 `Proposed`를 참고한다.
- 구조 위반을 fallback으로 덮지 말고, `fallback-elimination-policy.md` 기준으로 fail-fast 여부를 먼저 판단한다.
- `Proposed` 문서를 구현 기준으로 쓰려면, 사용자가 그 제안을 채택하려는지 먼저 확인해야 한다.
- `Migration` 문서를 읽을 때는 `Exit criteria`를 함께 본다.
- `Canonical for`가 적힌 `Active` 문서는 해당 질문의 정본으로 취급한다.

## 코드 작업 후 문서 업데이트 기준

아래 중 하나가 바뀌면 관련 `Active` 문서도 업데이트한다.

- owner가 바뀜
- canonical path가 바뀜
- runtime/storage boundary가 바뀜
- fallback exception policy가 바뀜
- theme public seam이 바뀜
- product baseline이 바뀜
- CI/document guard가 바뀜

아래는 문서 업데이트 없이도 되는 경우가 많다.

- purely local refactor
- naming cleanup without boundary change
- internal implementation detail change that does not affect documented contract

## 에이전트에게 직접 전달할 때 쓰는 짧은 문장

다음처럼 지시하면 된다.

- `먼저 docs/governance/agent-start-here.md 를 읽고, 거기서 task에 맞는 canonical docs를 찾아 기준으로 삼아 진행해줘.`
- `문서 전체를 다 읽지 말고, agent-start-here 기준으로 관련 Active docs만 추려서 보고 작업해줘.`
- `증상이 모호하면 docs/governance/agent-routing-index.md 에서 조사 시작점을 고르고, 실제 수정 위치는 관련 Active 문서의 owner table로 확인해줘.`

## 관련 문서

- `docs/system-architecture/README.md`
- `docs/governance/document-registry.md`
- `docs/governance/document-system.md`
- `docs/governance/fallback-elimination-policy.md`
