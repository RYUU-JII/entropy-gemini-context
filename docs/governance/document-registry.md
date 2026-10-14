# Document Registry

- Status: Active
- Owner: repository governance
- Last validated against code: 2026-09-20
- Path policy: current-only
- Canonical for: trusted document entrypoints and governed-doc inventory

현재 문서 시스템에서 먼저 신뢰해야 하는 문서 경로와 governed docs inventory를 함께 정리한다.

## 프로젝트 진입점

- `../../README.md`
- `../README.md`

## 작성 시작점

- template index: `../templates/README.md`
- active template: `../templates/active.md`
- proposed template: `../templates/proposed.md`
- migration template: `../templates/migration.md`
- editor snippet: `.vscode/entropy-docs.code-snippets`

## 현재 1차 신뢰 문서 요약

| Path | Status | Owner | Path policy | Canonical for | Decision / Exit |
| --- | --- | --- | --- | --- | --- |
| `../system-architecture/README.md` | `Active` | `repository architecture` | `current-only` | `architecture reading order and canonical axis index` | - |
| `../system-architecture/01-topology.md` | `Active` | `repository architecture` | `current-only` | `repository topology and root ownership rules` | - |
| `../architecture/runtime/intervention-admission-runtime.md` | `Active` | `protection background runtime / nudge presentation` | `current-only` | `cross-document admission, fenced goal authorization/priority reads, exact cancellation, recovery, preemption and conclusion authority` | - |
| `../architecture/runtime/furin-daily-delivery-policy.md` | `Active` | `protection dispatch / nudge session lifecycle / platform storage` | `current-only` | `Furin full/brief daily delivery, scoped Site ends and V2 actual-presentation receipts` | - |
| `../architecture/guidance/guidance-runtime.md` | `Active` | `guidance domain / dashboard and popup surfaces / platform storage` | `current-only` | `guide receipts, installation intent, presentation claims and journey delivery` | - |
| `../architecture/runtime/tracking-consumption-facts.md` | `Active` | `tracking, behavior consumption, protection, platform storage` | `current-only` | `Confirmed foreground consumption, environment point evidence, shared context, session checkpoint and Gate projection` | `-` |
| `../architecture/runtime/consumption-memory-model-evaluation.md` | `Active` | `behavior consumption / protection policy / evaluation tooling` | `current-only` | `Pure memory law, offline Shishi level candidate, journey replay, physical calibration and adaptive promotion boundary` | `-` |
| `../architecture/runtime/consumption-memory-runtime.md` | `Active` | `tracking / behavior consumption / platform model storage` | `current-only` | `Browser-audible evidence, observed interval join, durable model state/cursor, consent and warm runtime read` | `-` |
| `../architecture/runtime/protected-consumption-flow-architecture.md` | `Proposed` | `tracking, behavior, protection, nudge, stats, platform storage` | `planning-allowed` | `-` | Adopt shared consumption-flow ownership/contracts and bounded Gate/Furin integration before optional feed/input/CLSE interpretation. |
| `../architecture/runtime/cooling-curve-runtime.md` | `Active` | `protection background runtime / protection content runtime / settings domain / platform storage` | `planning-allowed` | `P1 cooling curve, settings, shared Furin boundary and scoped delivery contracts` | P2–P4 remain future scope; real-site support and human interaction evidence remain release gates. |
| `../system-architecture/02-runtime-storage-boundaries.md` | `Active` | `platform storage` | `current-only` | `runtime storage owner/path topology` | - |
| `../system-architecture/03-theme-plugin-and-zen.md` | `Active` | `theme architecture` | `current-only` | `theme plugin seams, public theme access paths, and Zen placement` | - |
| `../system-architecture/05-background-runtime-owners.md` | `Active` | `background app` | `current-only` | `background runtime owner map` | - |
| `../system-architecture/06-dashboard-launch-and-loading.md` | `Active` | `dashboard app` | `current-only` | `dashboard launch/loading owner map` | - |
| `../governance/agent-routing-index.md` | `Active` | `repository governance` | `current-only` | `symptom-to-document investigation routing for agents` | - |
| `../governance/fallback-elimination-policy.md` | `Active` | `repository governance` | `current-only` | `fail-fast structural policy, fallback prohibition, and fallback-exception discipline` | - |
| `../governance/structure-hygiene-audit-checklist.md` | `Active` | `repository governance` | `current-only` | `repository-wide structure/code hygiene audit checklist` | - |
| `../architecture/storage/storage-versioning-and-migration-policy.md` | `Active` | `platform storage, release operations` | `current-only` | `pre-release current-only storage and public-release transition policy` | - |
| `../architecture/security/local-security-vault.md` | `Active` | `platform security, background runtime` | `current-only` | `local key wrapping, unlock admission and encrypted backup lifecycle` | - |
| `../architecture/storage/storage-architecture-target.md` | `Active` | `platform storage` | `current-only` | `storage backend and data-shape detail for the canonical storage boundary` | - |
| `../architecture/repository/storage-stats-tracking-boundary-map.md` | `Active` | `repository architecture, platform storage, stats domain` | `current-only` | `release V1 storage/stats/tracking owners, exact contracts, runtime flow, and failure boundaries` | - |
| `../architecture/repository/protection-content-runtime-boundary-map.md` | `Active` | `repository architecture, protection runtime, tracking runtime` | `current-only` | `protection dispatch, content bootstrap, prepaint/root-visual handoff, and recovery boundary map` | - |
| `../architecture/repository/settings-command-boundary-map.md` | `Active` | `repository architecture, platform storage, dashboard app, background app` | `current-only` | `settings command/query ownership, typed mutation seams, persistence ack, and propagation boundaries` | - |
| `../architecture/repository/theme-engine-boundary-map.md` | `Active` | `repository architecture, theme architecture` | `current-only` | `theme public entrypoints, plugin manifest/runtime lookup, shared widget seams, and theme preference boundaries` | - |
| `../architecture/repository/dashboard-launch-loading-boundary-map.md` | `Active` | `repository architecture, dashboard app` | `current-only` | `dashboard boot sequence, launch context, tab registry/loading gate, main keep-alive exception, and dashboard owner seams` | - |
| `../architecture/repository/background-runtime-boundary-map.md` | `Active` | `repository architecture, background app` | `current-only` | `background service-worker entry, app kernel composition, message routing, stats runtime wiring, storage support split, and retired hub guards` | - |
| `../architecture/repository/i18n-boundary-map.md` | `Active` | `repository architecture, i18n architecture` | `current-only` | `locale metadata/resources, React and runtime translation APIs, runtime language persistence, namespace ownership, dynamic-family contracts, and copy fallback boundaries` | - |
| `../architecture/repository/friction-nudge-effect-boundary-map.md` | `Active` | `repository architecture, nudge runtime, protection runtime` | `current-only` | `content-side friction effect ownership, protection envelope application, nudge/behavior manager boundaries, signal gates, runtime debugger ownership, and bounded recovery rules` | - |
| `../architecture/repository/nudge-main-runtime-boundary-map.md` | `Active` | `repository architecture, nudge runtime, artifact runtime` | `current-only` | `Sentinel Flare content-host activation, global starter gate, ritual/outcome lifecycle, runtime copy/context, debug spawn diagnostics, and navigation recovery boundaries` | - |
| `../architecture/repository/nudge-worker-runtime-boundary-map.md` | `Active` | `repository architecture, nudge runtime, platform workers` | `current-only` | `nudge content worker surface status, OffscreenCanvas session ownership, global starter koi hit testing, worker activation/error flow, and worker spawn telemetry` | - |
| `../architecture/runtime/friction-filter-injection-architecture.md` | `Active` | `nudge runtime` | `planning-allowed` | `friction filter injection and prepaint visual runtime architecture` | - |
| `../architecture/runtime/bootstrap-friction-snapshot-architecture.md` | `Active` | `nudge runtime` | `planning-allowed` | `bootstrap friction snapshot assembly and handoff architecture` | - |
| `../architecture/runtime/feed-flow-runtime-target-architecture.md` | `Active` | `shared feed-boundary runtime / Enso interaction runtime / protection content runtime` | `planning-allowed` | `feed observation validity, native scroll provenance, purpose-specific admission/cancellation, session structure learning, endpoint safety and passive goal-end snapshot ownership` | - |
| `../architecture/runtime/usage-flow-evaluation-scenarios.md` | `Active` | `usage-flow measurement and model evaluation` | `current-only` | `synthetic observation and DOM integration contracts, confirmed-boundary and measured-displacement pressure comparison, timing ambiguity, recovery audit and stable source snapshots; no real-user data prerequisite or intent-accuracy claim` | - |
| `../architecture/runtime/dom-targeting-runtime-architecture.md` | `Active` | `repository architecture, nudge runtime, runtime QA` | `planning-allowed` | `DOM target profile ownership, selector dependency contracts, owner-local resolution pipelines, targeting health evidence, and bounded drift recovery` | - |
| `../architecture/runtime/audio-dulling-runtime-architecture.md` | `Active` | `protection runtime + runtime QA` | `current-only` | `development-only Suikinkutsu tab-audio resolution research and public-release exclusion` | - |
| `../architecture/i18n/i18n-architecture-target.md` | `Active` | `i18n architecture` | `planning-allowed` | `repository-wide i18n target architecture` | - |
| `../architecture/i18n/i18n-robustness-audit.md` | `Active` | `i18n architecture` | `planning-allowed` | `current-state robustness audit of i18n failure behavior` | - |
| `../architecture/i18n/locale-duplication-audit.md` | `Active` | `i18n architecture` | `planning-allowed` | `current duplication audit and shared-key promotion policy` | - |
| `../architecture/workers/worker-runtime-control-plane.md` | `Active` | `platform workers` | `current-only` | `worker runtime surface registry, grouped context/lane budgets, degradation policy, and worker admission` | - |
| `../architecture/workers/worker-runtime-multithreading-spec.md` | `Proposed` | `platform workers` | `planning-allowed` | `-` | Whether the shared worker runtime budget and pool policy becomes the canonical execution baseline for stats, crypto, and Zen workloads. |
| `../architecture/themes/zen/zen-g15-product-engine.md` | `Active` | `zen theme architecture` | `current-only` | `shipping G15 bonsai model, growth clock, and scene ownership` | - |
| `../architecture/themes/zen/zen-g15-research-workspace.md` | `Active` | `zen theme architecture / detached research tooling` | `current-only` | `detached G15 entrypoints, source identity, execution receipts and preservation` | - |
| `../architecture/themes/zen/zen-hybrid-bonsai-research.md` | `Active` | `zen theme architecture / detached research tooling` | `current-only` | `Frozen H1 preservation, native development boundary, lab isolation and experiment identity` | - |
| `../architecture/themes/zen/zen-g15-development-roadmap.md` | `Proposed` | `zen theme architecture` | `planning-allowed` | `-` | Adopt or tune G15 organ history, morphology traits, activation presentation, and release pacing in separate stages. |
| `../architecture/themes/zen/zen-bonsai-growth-continuity-plan.md` | `Proposed` | `zen theme architecture` | `planning-allowed` | `-` | Whether the classic Zen bonsai renderer should adopt the biology-informed growth-continuity contract as the next implementation baseline. |
| `../architecture/themes/zen/zen-theme-definition.md` | `Active` | `zen theme architecture` | `planning-allowed` | `Zen theme canon and ownership rules` | - |
| `../architecture/themes/zen/zen-enso-research-workspace.md` | `Active` | `Zen presentation research` | `current-only` | `Independent Enso brush experiments, local review surface and evidence boundaries` | - |
| `../architecture/themes/zen/zen-artifact-engine-review.md` | `Active` | `Zen artifact presentation, visual QA composition` | `planning-allowed` | `Seven-scene production gallery renderer, comparison and evidence limits` | - |
| `../architecture/themes/zen/zen-main-presentation-scene-architecture.md` | `Active` | `zen dashboard architecture` | `current-only` | `release V1 current/first-vision scene decision, session latch, and Zen projection contract` | - |
| `../apps/dashboard/zen-main-boot-and-data-readiness.md` | `Active` | `dashboard app, zen dashboard architecture` | `current-only` | `Zen main first-viewport readiness, Enso handoff policy, and main-screen pond/rhythm data alignment` | - |
| `../product/dashboard/sites-tab-prd.md` | `Active` | `dashboard product` | `current-only` | `Sites tab information architecture, decision semantics, and safety contract` | - |
| `../product/landing/zen-landing.md` | `Active` | `public landing app, Zen presentation` | `current-only` | `public Zen landing journey, build isolation, and presentation ownership` | - |
| `../product/landing/feed-landing.md` | `Active` | `standalone feed landing app` | `current-only` | `finite social-feed introduction, session interactions, authored friction journey and standalone build isolation` | - |
| `../apps/dashboard/dashboard-boot-shell-worker-architecture.md` | `Proposed` | `dashboard app` | `planning-allowed` | `-` | Whether Dashboard boot should adopt BootShell, worker loader, and prewarm handoff as the canonical launch path. |
| `../operations/ci/quality-gate.md` | `Active` | `CI operations` | `current-only` | `CI quality gate contract` | - |
| `../operations/runbooks/beta-launch-mvp-runbook.md` | `Active` | `release operations` | `current-only` | `2026-04-11 beta MVP gate, forced-ship scope cuts, and release-day execution rules` | - |
| `../operations/runbooks/pre-release-development-profile-reset.md` | `Active` | `release operations, platform storage` | `current-only` | `whole Entropy development-profile reset before release V1 baseline validation` | - |
| `../operations/qa/friction-visual-target-qa-checklist.md` | `Active` | `QA operations` | `current-only` | `friction visual QA target checklist` | - |
| `../operations/qa/mv3-lifecycle-e2e.md` | `Active` | `runtime QA, background and content lifecycle owners` | `current-only` | `real Chromium MV3 worker revival, content continuity, and dashboard cold-reload verification` | - |
| `../operations/qa/storage-data-lifecycle-e2e.md` | `Active` | `release operations, platform storage, stats and CLSE owners` | `current-only` | `release V1 data lifecycle source integration and real Chromium persistence verification` | - |
| `../operations/qa/visual-capture-harness.md` | `Active` | `QA operations, app composition` | `current-only` | `deterministic development-only page and component capture workflow` | - |
| `../operations/qa/worker-runtime-manual-smoke-checklist.md` | `Active` | `QA operations` | `current-only` | `worker runtime manual smoke procedure` | - |
| `../migrations/i18n/i18n-migration-plan.md` | `Migration` | `i18n migration` | `planning-allowed` | `-` | Governed UI and runtime surfaces use canonical translation APIs, ownership checks pass without migration exceptions, and legacy i18n entrypoints are removed. |
| `../migrations/site-intel-analysis-evolution-plan.md` | `Migration` | `stats insights / dashboard Sites` | `planning-allowed` | `Site Intel analysis and presentation migration sequence` | Fact/interpretation/presentation contracts converge on canonical owners, the first Intel product passes validation, and advanced-model/score decisions are recorded. |

해석 규칙:

- `Active`: 지금 기준으로 따라야 하는 문서
- `Proposed`: 아직 채택 결정을 남겨 둔 문서
- `Migration`: 진행 중 전환 문서이며 `Exit criteria` 가 닫혀야 완료
- `current-only`: 문서 안의 path reference 가 현재 저장소 경로와 일치해야 함
- `planning-allowed`: inline code path 는 계획 경로를 설명할 수 있지만 markdown link 는 현재 경로를 가리켜야 함

## Flat inventory

이 표는 path/status/owner/path-policy 중심의 flat inventory다. 한 줄에 한 문서만 두어 복사 후 정렬/필터하기 쉽게 유지한다.

| Area | Path | Status | Owner | Path policy | Canonical for | Decision needed | Exit criteria |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `system-architecture` | `../system-architecture/01-topology.md` | `Active` | `repository architecture` | `current-only` | repository topology and root ownership rules | - | - |
| `system-architecture` | `../system-architecture/02-runtime-storage-boundaries.md` | `Active` | `platform storage` | `current-only` | runtime storage owner/path topology | - | - |
| `system-architecture` | `../system-architecture/03-theme-plugin-and-zen.md` | `Active` | `theme architecture` | `current-only` | theme plugin seams, public theme access paths, and Zen placement | - | - |
| `system-architecture` | `../system-architecture/04-execution-masterplan.md` | `Active` | `repository architecture` | `current-only` | architecture execution sequencing and cutover order | - | - |
| `system-architecture` | `../system-architecture/05-background-runtime-owners.md` | `Active` | `background app` | `current-only` | background runtime owner map | - | - |
| `system-architecture` | `../system-architecture/06-dashboard-launch-and-loading.md` | `Active` | `dashboard app` | `current-only` | dashboard launch/loading owner map | - | - |
| `system-architecture` | `../system-architecture/README.md` | `Active` | `repository architecture` | `current-only` | architecture reading order and canonical axis index | - | - |
| `governance` | `../governance/document-registry.md` | `Active` | `repository governance` | `current-only` | trusted document entrypoints and governed-doc inventory | - | - |
| `governance` | `../governance/document-system.md` | `Active` | `repository governance` | `current-only` | document metadata, naming, lifecycle, and enforcement rules | - | - |
| `governance` | `../governance/agent-routing-index.md` | `Active` | `repository governance` | `current-only` | symptom-to-document investigation routing for agents | - | - |
| `governance` | `../governance/fallback-elimination-policy.md` | `Active` | `repository governance` | `current-only` | fail-fast structural policy, fallback prohibition, and fallback-exception discipline | - | - |
| `governance` | `../governance/import-boundaries.md` | `Active` | `repository governance` | `current-only` | allowed import boundaries and retired facade policy | - | - |
| `governance` | `../governance/refactoring-playbook.md` | `Active` | `repository governance` | `current-only` | refactor sequencing, cutover discipline, and deletion-first cleanup rules | - | - |
| `governance` | `../governance/structure-hygiene-audit-checklist.md` | `Active` | `repository governance` | `current-only` | repository-wide structure/code hygiene audit checklist | - | - |
| `architecture` | `../architecture/i18n/i18n-architecture-target.md` | `Active` | `i18n architecture` | `planning-allowed` | repository-wide i18n target architecture | - | - |
| `architecture` | `../architecture/runtime/bootstrap-friction-snapshot-architecture.md` | `Active` | `nudge runtime` | `planning-allowed` | bootstrap friction snapshot assembly and handoff architecture | - | - |
| `architecture` | `../architecture/runtime/feed-flow-runtime-target-architecture.md` | `Active` | `shared feed-boundary runtime / Enso interaction runtime / protection content runtime` | `planning-allowed` | feed observation validity, native scroll write provenance, purpose-specific admission, session structure learning, endpoint safety and snapshot ownership | - | - |
| `architecture` | `../architecture/runtime/cooling-curve-runtime.md` | `Active` | `protection background runtime / protection content runtime / settings domain / platform storage` | `planning-allowed` | P1 cooling curve, settings, shared Furin boundary and scoped delivery contracts | P2–P4 remain future scope; real-site support and human interaction evidence remain release gates. | - |
| `architecture` | `../architecture/runtime/usage-flow-evaluation-scenarios.md` | `Active` | `usage-flow measurement and model evaluation` | `current-only` | synthetic observation and DOM integration contracts, confirmed-boundary and measured-displacement pressure comparison, timing ambiguity, recovery audit and stable source snapshots; no real-user data prerequisite or intent-accuracy claim | - | - |
| `architecture` | `../architecture/runtime/dom-targeting-runtime-architecture.md` | `Active` | `repository architecture, nudge runtime, runtime QA` | `planning-allowed` | DOM target profile ownership, selector dependency contracts, owner-local resolution pipelines, targeting health evidence, and bounded drift recovery | - | - |
| `architecture` | `../architecture/runtime/friction-filter-injection-architecture.md` | `Active` | `nudge runtime` | `planning-allowed` | friction filter injection and prepaint visual runtime architecture | - | - |
| `architecture` | `../architecture/runtime/audio-dulling-runtime-architecture.md` | `Active` | `protection runtime + runtime QA` | `current-only` | development-only Suikinkutsu tab-audio resolution research and public-release exclusion | - | - |
| `architecture` | `../architecture/security/security-surface-reduction-plan.md` | `Draft` | `platform security` | `current-only` | - | - | - |
| `architecture` | `../architecture/storage/storage-versioning-and-migration-policy.md` | `Active` | `platform storage, release operations` | `current-only` | pre-release current-only storage and public-release transition policy | - | - |
| `architecture` | `../architecture/security/local-security-vault.md` | `Active` | `platform security, background runtime` | `current-only` | local key wrapping, unlock admission and encrypted backup lifecycle | - | - |
| `architecture` | `../architecture/storage/storage-architecture-target.md` | `Active` | `platform storage` | `current-only` | storage backend and data-shape detail for the canonical storage boundary | - | - |
| `architecture` | `../architecture/repository/storage-stats-tracking-boundary-map.md` | `Active` | `repository architecture, platform storage, stats domain` | `current-only` | release V1 storage/stats/tracking owners, exact contracts, runtime flow, and failure boundaries | - | - |
| `architecture` | `../architecture/repository/protection-content-runtime-boundary-map.md` | `Active` | `repository architecture, protection runtime, tracking runtime` | `current-only` | protection dispatch, content bootstrap, prepaint/root-visual handoff, and recovery boundary map | - | - |
| `architecture` | `../architecture/repository/settings-command-boundary-map.md` | `Active` | `repository architecture, platform storage, dashboard app, background app` | `current-only` | settings command/query ownership, typed mutation seams, persistence ack, and propagation boundaries | - | - |
| `architecture` | `../architecture/repository/theme-engine-boundary-map.md` | `Active` | `repository architecture, theme architecture` | `current-only` | theme public entrypoints, plugin manifest/runtime lookup, shared widget seams, and theme preference boundaries | - | - |
| `architecture` | `../architecture/repository/dashboard-launch-loading-boundary-map.md` | `Active` | `repository architecture, dashboard app` | `current-only` | dashboard boot sequence, launch context, tab registry/loading gate, main keep-alive exception, and dashboard owner seams | - | - |
| `architecture` | `../architecture/repository/background-runtime-boundary-map.md` | `Active` | `repository architecture, background app` | `current-only` | background service-worker entry, app kernel composition, message routing, stats runtime wiring, storage support split, and retired hub guards | - | - |
| `architecture` | `../architecture/repository/i18n-boundary-map.md` | `Active` | `repository architecture, i18n architecture` | `current-only` | locale metadata/resources, React and runtime translation APIs, runtime language persistence, namespace ownership, dynamic-family contracts, and copy fallback boundaries | - | - |
| `architecture` | `../architecture/repository/friction-nudge-effect-boundary-map.md` | `Active` | `repository architecture, nudge runtime, protection runtime` | `current-only` | content-side friction effect ownership, protection envelope application, nudge/behavior manager boundaries, signal gates, runtime debugger ownership, and bounded recovery rules | - | - |
| `architecture` | `../architecture/repository/nudge-main-runtime-boundary-map.md` | `Active` | `repository architecture, nudge runtime, artifact runtime` | `current-only` | Sentinel Flare content-host activation, global starter gate, ritual/outcome lifecycle, runtime copy/context, debug spawn diagnostics, and navigation recovery boundaries | - | - |
| `architecture` | `../architecture/sound/sound-lab-architecture.md` | `Active` | `app sound runtime / sound design research owners` | `current-only` | procedural synthesis research, feature briefs, versioned candidates, local feedback records, and agent/product handoff | - | - |
| `architecture` | `../architecture/repository/nudge-worker-runtime-boundary-map.md` | `Active` | `repository architecture, nudge runtime, platform workers` | `current-only` | nudge content worker surface status, OffscreenCanvas session ownership, global starter koi hit testing, worker activation/error flow, and worker spawn telemetry | - | - |
| `architecture` | `../architecture/i18n/i18n-robustness-audit.md` | `Active` | `i18n architecture` | `planning-allowed` | current-state robustness audit of i18n failure behavior | - | - |
| `architecture` | `../architecture/i18n/locale-duplication-audit.md` | `Active` | `i18n architecture` | `planning-allowed` | current duplication audit and shared-key promotion policy | - | - |
| `architecture` | `../architecture/themes/artifacts/artifact-scene-runtime-core-spec.md` | `Active` | `artifact runtime` | `current-only` | artifact scene/runtime core substrate and tier model | - | - |
| `architecture` | `../architecture/themes/artifacts/artifact-widget-presentation-contract.md` | `Active` | `dashboard tools artifact renderer` | `current-only` | artifact widget presentation contract | - | - |
| `architecture` | `../architecture/themes/artifacts/sentinel-flare-activation-spec.md` | `Active` | `artifact runtime` | `planning-allowed` | sentinel flare activation contract | - | - |
| `architecture` | `../architecture/themes/artifacts/sentinel-flare-site-furin-chime-spec.md` | `Active` | `artifact runtime, nudge runtime` | `current-only` | canonical Return Current concept, phase, gesture, formation, and Canvas performance contract for site Furin | - | - |
| `architecture` | `../architecture/themes/scene/artifact-gallery-scene-spec.md` | `Active` | `dashboard tools scene runtime` | `current-only` | artifact gallery scene runtime contract | - | - |
| `architecture` | `../architecture/themes/scene/camera-coordinate-normalization-plan.md` | `Active` | `dashboard tools scene runtime` | `current-only` | artifact gallery camera and coordinate normalization rules | - | - |
| `architecture` | `../architecture/themes/theme-artifact-storytelling-guide.md` | `Active` | `theme architecture` | `planning-allowed` | theme artifact naming and storytelling guidelines | - | - |
| `architecture` | `../architecture/themes/zen/zen-bonsai-architecture-guards.md` | `Active` | `zen theme architecture` | `planning-allowed` | Zen bonsai architecture guardrails | - | - |
| `architecture` | `../architecture/themes/zen/zen-g15-product-engine.md` | `Active` | `zen theme architecture` | `current-only` | shipping G15 bonsai model, growth clock, and scene ownership | - | - |
| `architecture` | `../architecture/themes/zen/zen-g15-research-workspace.md` | `Active` | `zen theme architecture / detached research tooling` | `current-only` | detached G15 entrypoints, source identity, execution receipts and preservation | - | - |
| `architecture` | `../architecture/themes/zen/zen-hybrid-bonsai-research.md` | `Active` | `zen theme architecture / detached research tooling` | `current-only` | Frozen H1 preservation, native development boundary, lab isolation and experiment identity | - | - |
| `architecture` | `../architecture/themes/zen/zen-g15-development-roadmap.md` | `Proposed` | `zen theme architecture` | `planning-allowed` | - | Adopt or tune G15 organ history, morphology traits, activation presentation, and release pacing in separate stages. | - |
| `architecture` | `../architecture/themes/zen/zen-bonsai-growth-continuity-plan.md` | `Proposed` | `zen theme architecture` | `planning-allowed` | - | Whether the classic Zen bonsai renderer should adopt the biology-informed growth-continuity contract as the next implementation baseline. | - |
| `architecture` | `../architecture/themes/zen/zen-main-presentation-scene-architecture.md` | `Active` | `zen dashboard architecture` | `current-only` | release V1 current/first-vision scene decision, session latch, and Zen projection contract | - | - |
| `architecture` | `../architecture/themes/zen/zen-pond-render-worker-spec.md` | `Active` | `zen theme architecture` | `planning-allowed` | Zen pond worker runtime integration contract | - | - |
| `architecture` | `../architecture/themes/zen/zen-sentinel-render-pipeline.md` | `Proposed` | `zen theme architecture` | `planning-allowed` | - | Whether sentinel flare should adopt the proposed canonical koi render-core split and runtime separation as the next implementation baseline. | - |
| `architecture` | `../architecture/themes/zen/zen-shishiodoshi-runtime-redesign.md` | `Proposed` | `zen theme architecture` | `planning-allowed` | - | Whether Zen loop-breaker rendering should split into theme-specific gatekeeper/disruption renderers before deeper runtime expansion proceeds. | - |
| `architecture` | `../architecture/themes/zen/zen-theme-definition.md` | `Active` | `zen theme architecture` | `planning-allowed` | Zen theme canon and ownership rules | - | - |
| `architecture` | `../architecture/themes/zen/zen-enso-research-workspace.md` | `Active` | `Zen presentation research` | `current-only` | Independent Enso brush experiments, local review surface and evidence boundaries | - | - |
| `architecture` | `../architecture/themes/zen/zen-artifact-engine-review.md` | `Active` | `Zen artifact presentation, visual QA composition` | `planning-allowed` | Seven-scene production gallery renderer, comparison and evidence limits | - | - |
| `architecture` | `../architecture/themes/zen/zen-top-shadow-spec.md` | `Active` | `zen theme architecture` | `planning-allowed` | Zen top-shadow visual contract | - | - |
| `architecture` | `../architecture/workers/worker-runtime-control-plane.md` | `Active` | `platform workers` | `current-only` | worker runtime surface registry, grouped context/lane budgets, degradation policy, and worker admission | - | - |
| `architecture` | `../architecture/workers/worker-runtime-multithreading-spec.md` | `Proposed` | `platform workers` | `planning-allowed` | - | Whether the shared worker runtime budget and pool policy becomes the canonical execution baseline for stats, crypto, and Zen workloads. | - |
| `architecture` | `../architecture/progression/five-day-journey-guidance-design.md` | `Active` | `progression domain / dashboard product / guidance runtime / theme presentation` | `current-only` | five qualified use day journey experience, first Furin installation presentation and contextual guidance product rules | - | - |
| `architecture` | `../architecture/guidance/guidance-runtime.md` | `Active` | `guidance domain / dashboard and popup surfaces / platform storage` | `current-only` | contextual guide receipts, first Furin installation intent, presentation claims, development preview isolation and journey notification deduplication | - | - |
| `product` | `../product/backlog/feature-candidates.md` | `Hold` | `product / nudge runtime` | `planning-allowed` | - | - | - |
| `product` | `../product/backlog/friction-effect-research-backlog.md` | `Hold` | `product research / behavior model` | `planning-allowed` | - | - | - |
| `product` | `../product/backlog/main-thread-cooperative-scheduling-backlog.md` | `Active` | `runtime performance / platform scheduling` | `current-only` | cooperative main-thread continuation seam, current Protection/Visual/Text/Social Metrics consumers, 3ms slice budget, and rollout gate | - | - |
| `product` | `../product/attention-relief-loop-hypothesis.md` | `Draft` | `product narrative / behavior model` | `current-only` | - | - | - |
| `product` | `../product/entropy-manifesto.md` | `Active` | `product narrative` | `current-only` | Entropy의 이름, 제품 철학, 통합 서사와 핵심 주장 지도 | - | - |
| `product` | `../product/prediction-value-learning-model.md` | `Active` | `product narrative / behavior model` | `current-only` | 예측 부호화와 보상 학습의 연결, 기대 가치·행동 비용·시간에 따른 재학습의 설명 모델 | - | - |
| `product` | `../product/entropy-information-theory-model.md` | `Active` | `product narrative / behavior model` | `current-only` | 자극·가치·판단의 엔트로피, 표현 압축과 해독 비용, Entropy 기능의 정보이론적 해석 | - | - |
| `product` | `../product/project-introduction.md` | `Active` | `product narrative` | `current-only` | Entropy 제품 원칙, 현재 기능·테마·기술 구조의 소개 | - | - |
| `product` | `../product/landing/zen-landing.md` | `Active` | `public landing app, Zen presentation` | `current-only` | public Zen landing journey, build isolation, and presentation ownership | - | - |
| `product` | `../product/landing/feed-landing.md` | `Active` | `standalone feed landing app` | `current-only` | finite social-feed introduction, session interactions, authored friction journey and standalone build isolation | - | - |
| `product` | `../product/dashboard/basic-mode-automatic-protection-prd.md` | `Draft` | `dashboard product` | `planning-allowed` | - | - | - |
| `product` | `../product/dashboard/basic-protection-strategy-prd.md` | `Active` | `dashboard product` | `planning-allowed` | basic-mode protection strategy baseline | - | - |
| `product` | `../product/dashboard/basic-strategy-orchestrator-prd.md` | `Draft` | `dashboard product` | `planning-allowed` | - | - | - |
| `product` | `../product/dashboard/home-scan-reflect-structure.md` | `Active` | `dashboard product` | `planning-allowed` | current dashboard information architecture baseline | - | - |
| `product` | `../product/dashboard/information-architecture-basic-pro-tabs-prd.md` | `Draft` | `dashboard product` | `planning-allowed` | - | - | - |
| `product` | `../product/dashboard/pro-mode-policy-studio-prd.md` | `Draft` | `dashboard product` | `planning-allowed` | - | - | - |
| `product` | `../product/dashboard/cooling-cycle-product-note.md` | `Active` | `dashboard product / protection runtime` | `planning-allowed` | P1 cooling-cycle experience, preset and family modes, safe Furin ending and honest phase disclosure | P2–P4 remain future scope; initial site support and lighter periodic interaction need evidence. | - |
| `product` | `../product/dashboard/protection-tab-prd.md` | `Active` | `dashboard product` | `planning-allowed` | protection tab product contract | - | - |
| `product` | `../product/dashboard/sites-tab-prd.md` | `Active` | `dashboard product` | `current-only` | Sites tab information architecture, decision semantics, and safety contract | - | - |
| `product` | `../product/dashboard/site-intel-observation-workspace-proposal.md` | `Active` | `dashboard Sites / stats insights` | `current-only` | - | - | - |
| `product` | `../product/garden/garden-ambient-system-prd.md` | `Active` | `garden product / zen theme architecture` | `planning-allowed` | 정원 분위기의 제품 의미, 자연 날씨와 분재 습관 피드백의 분리 | - | - |
| `product` | `../product/garden/bonsai-habit-feedback-foundation.md` | `Proposed` | `product / stats domain / zen theme architecture` | `planning-allowed` | - | 합의한 기준에 대한 최근 준수를 활성화의 단일 의미로 채택하고, 관측 증거와 일일 마감 계약을 먼저 갖춘 뒤 수치와 표현을 검증한다. | - |
| `product` | `../product/popup/popup-overview-garden-experience-prd.md` | `Draft` | `popup product` | `planning-allowed` | - | - | - |
| `product` | `../product/ui/dialog-toast-unification-plan.md` | `Draft` | `shared UI product` | `planning-allowed` | - | - | - |
| `domains` | `../domains/behavior/behavior-engine.md` | `Active` | `behavior domain` | `current-only` | behavior domain baseline and runtime responsibilities | - | - |
| `domains` | `../domains/protection/protection-settings-propagation-policy.md` | `Active` | `protection domain` | `current-only` | protection settings propagation policy | - | - |
| `domains` | `../domains/stats/score-ledger-architecture.md` | `Active` | `stats domain` | `current-only` | explainable user-rule scoring ledger and score feedback basis | - | - |
| `domains` | `../domains/stats/stats-engine-baseline.md` | `Active` | `stats domain` | `current-only` | stats domain baseline and persistence/runtime responsibilities | - | - |
| `apps` | `../apps/dashboard/zen-main-boot-and-data-readiness.md` | `Active` | `dashboard app, zen dashboard architecture` | `current-only` | Zen main first-viewport readiness, Enso handoff policy, and main-screen pond/rhythm data alignment | - | - |
| `apps` | `../apps/dashboard/dashboard-boot-shell-worker-architecture.md` | `Proposed` | `dashboard app` | `planning-allowed` | - | Whether Dashboard boot should adopt BootShell, worker loader, and prewarm handoff as the canonical launch path. | - |
| `operations` | `../operations/ci/quality-gate.md` | `Active` | `CI operations` | `current-only` | CI quality gate contract | - | - |
| `operations` | `../operations/runbooks/beta-launch-mvp-runbook.md` | `Active` | `release operations` | `current-only` | 2026-04-11 beta MVP gate, forced-ship scope cuts, and release-day execution rules | - | - |
| `operations` | `../operations/runbooks/pre-release-development-profile-reset.md` | `Active` | `release operations, platform storage` | `current-only` | whole Entropy development-profile reset before release V1 baseline validation | - | - |
| `operations` | `../operations/qa/agent-qa-workflow.md` | `Active` | `runtime QA / release operations` | `current-only` | Agent QA entrypoint selection and direct-exploration patterns | - | - |
| `operations` | `../operations/qa/entropy-qa-control-plane.md` | `Active` | `runtime QA / release operations` | `current-only` | QA target identity, execution modes, browser environments, artifact/resource lifecycle, and evidence envelopes | - | - |
| `operations` | `../operations/qa/friction-visual-target-qa-checklist.md` | `Active` | `QA operations` | `current-only` | friction visual QA target checklist | - | - |
| `operations` | `../operations/qa/mv3-lifecycle-e2e.md` | `Active` | `runtime QA, background and content lifecycle owners` | `current-only` | real Chromium MV3 worker revival, content continuity, and dashboard cold-reload verification | - | - |
| `operations` | `../operations/qa/storage-data-lifecycle-e2e.md` | `Active` | `release operations, platform storage, stats and CLSE owners` | `current-only` | release V1 data lifecycle source integration and real Chromium persistence verification | - | - |
| `operations` | `../operations/qa/visual-capture-harness.md` | `Active` | `QA operations, app composition` | `current-only` | deterministic development-only page and component capture workflow | - | - |
| `operations` | `../operations/qa/worker-runtime-manual-smoke-checklist.md` | `Active` | `QA operations` | `current-only` | worker runtime manual smoke procedure | - | - |
| `migrations` | `../migrations/i18n/i18n-migration-plan.md` | `Migration` | `i18n migration` | `planning-allowed` | - | - | Governed UI and runtime surfaces use canonical translation APIs, ownership checks pass without migration exceptions, and legacy i18n entrypoints are removed. |
| `migrations` | `../migrations/site-intel-analysis-evolution-plan.md` | `Migration` | `stats insights / dashboard Sites` | `planning-allowed` | Site Intel analysis and presentation migration sequence | - | Fact/interpretation/presentation contracts converge on canonical owners, the first Intel product passes validation, and advanced-model/score decisions are recorded. |
| `decisions` | `../decisions/security/selective-host-permission-security-decision.md` | `Active` | `security decisions` | `current-only` | selective-only host permission policy and wildcard runtime prohibition | - | - |

## archive

archive는 canonical source가 아니다.

- audit: `../archive/audits/`
- evidence: `../archive/evidence/`
- legacy plan: `../archive/legacy-plans/`
- proposal: `../archive/proposals/`
