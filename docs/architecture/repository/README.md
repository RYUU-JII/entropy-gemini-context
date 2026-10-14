# Repository Structure

이 경로는 현재 저장소 구조 지도, 구조 집중도, staged refactor queue를 정리한다.

- `repository-structure-review.md`: 현재 파일시스템 배치 평가, hotspot 분류, 단계별 정리 순서
- `system-structure-implementation-audit.md`: 현재 docs-vs-implementation 구조 감사, target structure decision ledger
- `storage-stats-tracking-boundary-map.md`: storage/stats/tracking 경계 감사 지도, path-map 방법론, fallback/legacy cleanup ledger
- `navigation-continuity-runtime-boundary-map.md`: tab/navigation/session continuity, foreground relation, gate entry intent hint 경계 지도
- `protection-content-runtime-boundary-map.md`: protection dispatch, content bootstrap, prepaint/root-visual handoff 경계 지도
- `protection-runtime-snapshot-bridge-boundary-map.md`: dashboard protection runtime snapshot subscription/read/refresh bridge와 malformed snapshot rejection 경계 지도
- `settings-command-boundary-map.md`: settings command/query, typed mutation seam, persistence ack와 propagation 경계 지도
- `settings-tab-boundary-map.md`: Settings 탭 UI owner, permission/security status surface, data lifecycle runtime command handoff 경계 지도
- `popup-surface-boundary-map.md`: Popup site surface, protection queue/permission commit, special-session read/action status 경계 지도
- `sites-schedule-boundary-map.md`: Sites 탭 mutation/read-model, Schedule 편집/저장소 adapter, runtime schedule 평가 경계 지도
- `theme-engine-boundary-map.md`: theme core public seams, plugin manifest lookup, shared widget seam과 fallback-free runtime 경계 지도
- `app-sound-runtime-boundary-map.md`: app-owned sound cue/scene runtime, theme sound packs, bundled sound assets, sound-intake drop box 경계 지도
- `dashboard-launch-loading-boundary-map.md`: dashboard boot, launch context, tab registry/readiness, main keep-alive exception 경계 지도
- `main-tab-home-surface-boundary-map.md`: Main 탭 home surface, theme widget owner, first-frame gate, presentation projection 경계 지도
- `progression-runtime-boundary-map.md`: progression state/facts provider, staged-disclosure snapshot, first-vision milestone/reset 경계 지도
- `dashboard-ai-narration-boundary-map.md`: dashboard AI narration, local provider seam, input redaction, schema-validated copy overlay 경계 지도
- `background-runtime-boundary-map.md`: background entry/kernel/message routing, stats runtime, storage support split과 retired hub guard 경계 지도
- `notifications-runtime-boundary-map.md`: notification dispatch, permission/capability checks, click routing, runtime notification state 경계 지도
- `clse-boundary-map.md`: CLSE dashboard consumption/control readiness, settings mutation, runtime message route, diagnostic storage 경계 지도
- `experiment-debug-boundary-map.md`: Experiment 탭 switchboard, worker runtime telemetry, Sentinel protocol lab, ceremony preview/reset, stats diagnostics 경계 지도
- `tools-artifact-support-boundary-map.md`: Tools 탭 artifact gallery/control plane, storage support controller, background support owner 경계 지도
- `memory-purge-artifact-workflow-boundary-map.md`: Echo/Memory Purge artifact의 history/bookmark destructive workflow, auth, ceremony 분리 경계 지도
- `filter-tab-boundary-map.md`: Filter 탭 설정 editor, preview scenario, protection runtime status, canonical filterSettings setter 경계 지도
- `i18n-boundary-map.md`: locale metadata/resources, React/runtime translation APIs, runtime language persistence, namespace/dynamic-family contracts와 copy fallback 경계 지도
- `friction-nudge-effect-boundary-map.md`: compiled protection envelope 이후 content-side friction/nudge effect manager, signal gate, debugger, cleanup/recovery 경계 지도
- `nudge-main-runtime-boundary-map.md`: Sentinel Flare content-host activation, selected worker runtime, ritual/outcome lifecycle, debug spawn/navigation recovery 경계 지도
- `nudge-worker-runtime-boundary-map.md`: extension-frame nudge worker host, OffscreenCanvas session, worker activation/error flow, spawn telemetry, disabled direct content-worker 경계 지도
- `zen-pond-seam-map.md`: Zen pond subtree 분류, named seam target map, staged relocation order
- `social-metrics-seam-map.md`: social metrics hide/cleanup engine seam map과 owner 규칙
- `site-pull-pattern-boundary-map.md`: site-pull facts/evidence/pattern/calibration/presentation 경계와 proxy/fallback 분류 규칙
- `personal-baseline-boundary-map.md`: 앱 전반 개인 기준점 역할/관측/알고리즘 정책, stats 공용 core, Site Pull/usage/CLSE/trajectory/rhythm owner 및 storage/decision 경계 지도
