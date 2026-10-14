# 06. Dashboard Launch And Loading

- Status: Active
- Owner: dashboard app
- Last validated against code: 2026-10-13
- Path policy: current-only
- Canonical for: dashboard launch/loading owner map
- Companion repository map: `docs/architecture/repository/dashboard-launch-loading-boundary-map.md`

이 문서는 dashboard launch, tab mount, theme widget preload, main heavy-runtime 예외의 canonical owner를 고정한다.

## 1. Final Owners

Tools critical admission prepares the first visible family's controller/schema
and exact widget/scene through `preloadToolsInitialArtifact.js`, sharing the
disclosure resource and selection order with navigation. It runs only in the
existing post-first-frame boot/intent admission. Tools development telemetry
keeps root readiness separate from `workspace:ready` and `presentation:ready`;
the latter acknowledges the actual Zen bitmap commit before the existing two-rAF
paint opportunity completes the trace. No first-frame gate is added to Main.

### Dashboard naming contract

The registry owns canonical tab IDs and copy keys; `dashboard` locale JSON owns
nav/title/description, including theme variants. Theme names are display labels,
never alternate route IDs, API names, storage names, or component prefixes.

| Canonical ID | Product name | Zen navigation (ko / en) |
| --- | --- | --- |
| `main` | Overview | 정원 / Garden |
| `sites` | Sites | 길목 / Pathways |
| `schedule` | Routine | 리듬 / Rhythm |
| `tools` | Artifacts | 기물 / Implements |
| `filter` | Protection | 보호 / Protection |
| `settings` | Settings | 설정 / Settings |
| `experiment` | Dev Lab | 개발실 / Dev Lab |

Sites uses `SitesTab`, `useSitesController`, the `sites` i18n namespace and
`GET_SITES_SNAPSHOT` / `GET_SITES_SITE_DETAIL` queries. There is no `rules` tab
alias. Policy vocabulary (`siteRules`, `rulesMode`, `settings.rules`, and
`protocolRulesSlice`) retains its distinct settings/runtime meaning. A tab
rename must not rename those persisted policy contracts.

Zen's `main`/`sites` share one retained Garden pane while keeping distinct
canonical routes. DashboardLayout groups only sidebar navigation. MainPanel
supplies the lazy Sites slot to MainTab; `workspaces/sites/SitesManagementSurface.jsx`
owns the reused ledger/notebook orchestration, with SitesTab as its route adapter.
The common measured frame and Bonsai remain mounted. Pathways parks Pond and
its interaction; the lower paper edge owns gesture presentation and requests
asynchronous preparation before route commit. The graph is a common domain
entry in both modes. Once admitted, embedded Sites retains its DOM and drafts
behind the closed sheet with runtime/presentation inactive and queries parked.
Other themes retain ordinary Sites mount policy. Pond return uses the actual
scene receipt independently of boot first-frame acceptance. No second router
or persisted mode is introduced.
First Vision's interrupted initial Sites intent is retained by
`bootstrap/useDashboardLaunchIntentHandoff.js` and re-admitted once after unlock.
`useDashboardRenderRuntime` includes the active Pathways Bonsai in live workload
admission rather than treating every non-Main route as an idle render budget.

Product prose uses Sites (optionally 길목 when describing Zen). Code references
use the actual canonical identifier. Other IDs in this table intentionally
remain stable; their product and theme labels do not imply code aliases.

### 1.0 Vault and recording setup admission

`DashboardAdmissionBoundary` captures the existing profile lifecycle before key
admission. A healthy fresh profile reaches prepared `unlocked/local` without
asking for a passphrase. Strict `protectionReady` admits generation readiness even
when a modern log-only vault is locked. Full-wrapped locked profiles retain an
explicit current-passphrase separation action; status/unlock never convert them.
`DashboardSetupAdmission` initializes/subscribes the protocol store and admits
normal boot/Main while consent is UNSET; actual collection remains closed.
The sidebar stays mounted in the normal dashboard geometry, and ordinary tab
navigation does not select or commit a recording policy. Main's existing
registration editor opens on an explicit admitted shadow-koi action or a retained
registration intent, after First Vision, scene, progression, capacity and
registration admission. First use asks for one domain
and initially unchecked basic protected-site recording, then Start. The canonical
serial command commits the site and all five policy keys together, conditional
on current UNSET consent. Only the registered host's existing enforcement
permission is requested. No first-use precision/global permission is added.
Explicit browse commits the complete OFF policy without registering a site.
Denial, malformed ACK or reconciliation failure stays inline with the draft.
An existing non-UNSET profile is not asked again or overwritten. `dataCollectionPolicy.js`
continues to fail closed before consent, independently of presentation.

The shared `DashboardSetupCanvas` keeps preparation failures and full-wrapper transition on one reading
baseline. Its presentation-only `entropy:dashboard-setup-surface` event releases
the decorative boot shell and input cover without acknowledging core/Main/profile
readiness. Boot timers and the Main/First Vision conductor run before first-site
interaction under their existing owners. The existing profile mutation owner unmounts this boundary; asynchronous
permission completion after unmount cannot commit. Setup adds no storage owner,
profile identity, security passphrase path or fallback.

### 1.1 Boot Snapshot Owner

- canonical owner: `src/apps/background/services/boot/BootPrewarmService.js`
- cross-entry business contract owner: `src/apps/boot/bootPrewarmSnapshotContract.js`
- background producer와 dashboard consumer는 같은 app-level contract를 사용한다.
- platform messaging은 prewarm의 domain/settings/theme 의미를 소유하거나 import하지 않는다.
- normal boot는 preference/analysis/clse 초기값을 background prewarm snapshot에서 받는다.
- protocol은 pre-boot setup admission에서 기존 typed store로 한 번 초기화하고, boot는 이미 admitted된 store를 재사용한다.
- dashboard는 bootstrap business state의 second source를 만들지 않는다.
- Protocol hydration, the prewarm snapshot contract and settings canonicalization
  read the pure `domains/protection/catalog/presetContract.js` seam. They do not
  materialize builtin preset definitions through `presetCatalog.js`; runtime
  selection and the Sites preset editor keep that catalog's existing owner.
- After settings hydration succeeds, the prewarm producer requires the actual
  cache and its filter settings. An absent cache or filter record is a diagnosed
  owner failure; this stage cannot recreate first-run defaults.
- Cache invalidation also fences in-flight builds and dashboard delivery. An
  obsolete generation cannot publish or return a fresh bootstrap snapshot;
  its consumers receive `BOOT_PREWARM_SNAPSHOT_INVALIDATED`. New requests join
  only the current generation, and an older completion cannot clear its build
  slot. This owner does not automatically retry or substitute stale data.

### 1.2 Launch Context Owner

- canonical owner: `src/apps/dashboard/bootstrap/dashboardLaunchContext.js`
- 이 모듈만 아래를 해석한다.
  - route tab request
  - deep-link params
  - persisted active-tab hint
  - initial fallback tab
  - warmup target tab/theme
- boot-only theme hint owner: `src/apps/dashboard/bootstrap/dashboardBootShellThemeContext.js`
- 이 모듈만 boot shell에서 필요한 theme launch hint mirror를 해석하며, tab registry나 React UI graph를 import하지 않는다.
- `DashboardPage`, `bootSurfaceWarmup`, `bootShell`은 각자 route/localStorage를 직접 해석하지 않는다.
- `bootShell`은 mirror-only `dashboardBootShellThemeContext.js`만 사용하고, prewarm-aware `dashboardBootThemeContext.js`나 full `dashboardLaunchContext.js`를 import하지 않는다.

### 1.2.1 Dashboard Entry Staging And Boot Measurement

- Dashboard boot recovery owners are `DashboardBootRecoverySurface.jsx`,
  `dashboardBootFailureSurface.js`, and `DashboardProfileMutationRecovery.jsx`.
  Initial profile admission and core hydration show explicit pending state;
  an eight-second wait exposes a user-triggered document reload. Required core
  failure never mounts normal presentation/controllers with initial store values.
  React-entry failure can mount the error-only DOM surface before React/i18next
  readiness. `bootEvents.js` carries the presentation-only recovery signal:
  `bootShell.js` releases its opaque overlay/input gate without acknowledging
  core, Main frame, or profile readiness. A dismissed shell stays dismissed if
  a late initial admission starts the canonical boot sequence.
- Settings hydration failure permits full reset only through the physically
  validated `settings_profile_recovery_v1` descriptor for core/rules/UI documents.
  The readiness client reconstructs its exact trusted receipt; the profile gate
  admits only the reset surface, never normal runtime owners. Security corruption
  and unstructured errors retain the generic failure surface without reset.
  Recovery shows failure/document/key metadata, never stored values, and requires
  passcode authorization plus a separate explicit confirmation. A successful reset
  seals its controls and dispatches the original response handoff ACK; synchronous
  ACK-start failure retries only that receipt, never another destructive reset.

- Visible shell owner `bootShell.js` separates paint preparation from input
  release. Once theme/core are ready, the root can paint beneath the opaque
  shell while remaining inert with pointer events blocked. Existing Main frame
  and presentation-completion gates still own dismissal. The overlay prepares
  its opacity compositing from mount; no added delay or browser-presentation ACK
  is inferred from a Worker render submission or paint-preparation trace.
- First-use registration admission belongs to Main's existing editor. The
  actual `boot.shellDismissed` ACK, scene unlock and canonical registration
  availability must be ready before an explicit shadow action or retained
  registration intent opens it. Paint preparation, `dismissible`, or
  reveal-started state cannot replace the dismissal ACK. The existing editor
  focus/escape owner runs after input is restored. UNSET consent does not open
  the editor automatically, hide the sidebar or add a separate navigation lock.
  Only an explicit registration or Browse action can commit the first-use policy.

- dashboard entry stage owners:
  - `src/apps/dashboard/main.jsx`
  - `src/apps/dashboard/dashboardReactHost.jsx`
  - `src/apps/dashboard/bootstrap/dashboardDocumentThemeInitialization.js`
  - `src/apps/dashboard/bootstrap/dashboardEntryStageTraceContract.js`
  - `src/apps/dashboard/bootstrap/dashboardThemeBootRuntimeHandoff.js`
  - `src/i18n/dashboardConfig.js`
- entry는 React host, dashboard i18n, document theme, App을 named dynamic stage로
  열고 dev boot trace에 각 import readiness를 기록한다. 이 순서는 진단 가능한
  module boundary이며 별도 fallback bootstrap을 만들지 않는다.
- All started stage promises join the entry failure owner immediately. A failed
  document-theme stage cannot leave later sibling rejections unobserved. Release
  before theme preparation permanently closes that handoff lifetime; a late
  document-theme completion cannot allocate a new startup reservation.
  Pending handoff cleanup remains owned and observed, while entry failure reaches
  the visible recovery surface immediately instead of waiting for preparation.
- stage trace는 bounded stage/phase를 event name에 포함한다. 따라서 payload를
  생략하는 `marks` mode도 start/ready elapsed 차이로 stage duration을 복원하며,
  QA가 제거된 details를 source of truth로 기대하지 않는다.
- document-theme stage는 prewarm-aware `dashboardBootThemeContext.js`를 직접
  소비한다. Full route/tab owner인 `dashboardLaunchContext.js`를 경유해 tab
  registry 또는 React UI graph를 정적 closure에 포함하면 안 된다.
- launch 성능 측정 owner는 Entropy QA의 `dashboard/boot` target이다. 같은
  dashboard capture protocol과 artifact lease를 재사용하고, 첫 page를 cold,
  같은 owned browser의 이후 page를 warm으로 분류한다.
- 각 boot sample은 exact page session의 console/runtime/network/performance
  checkpoint를 남긴다. bounded CPU self-time summary는 명시적 진단 옵션에서만
  활성화해 표준 cold/warm 측정에 profiler 비용을 섞지 않으며, 일반
  `dashboard/capture`에는 적용하지 않는다.
- Zen Main의 full bonsai/full trace는 `bonsai_model:timing` 요청 ID로 모델
  작업 시작, compute worker 생성/PING readiness, study/projection, 결과 전송,
  검증 및 최초 UI commit을 연결한다. `dashboardBootModelTimingEvidence.mjs`는
  PREPARE 뒤 별도 PROJECT가 필요한 초기 흐름도 같은 준비 체인으로 계산한다.
  각 realm의 monotonic clock 안에서만 duration을 구하고, 겹칠 수 있는 page
  postMessage 시간은 독립 항목으로 둔다. 나머지는 transport/queue/deserialization/
  미계측 client/UI의 결합 잔여 시간이며 structured clone 단독 비용으로 주장하지 않는다.
- 계측 완결성 `COMPLETE|INCOMPLETE|NOT_REQUESTED`는 제품 readiness/health와
  별도다. Full trace의 Zen Main full bonsai는 누락/다른 요청/순서 오류를
  성공으로 취급하지 않는다. Marks trace는 payload 없이도 기존 stage 측정을
  유지하며 모델 내부 계측의 완결성을 요구하지 않는다. Dev-only Zen trace는
  기존 boot 이벤트와 초기 모델 receipt를 함께 보존하도록 최대 512개로 제한한다.
- 명시적 CPU 모드는 exact `zenBonsaiModel.worker` native instance 이름과
  요청 ID를 연결한다. 모델 worker가 idle 종료되기 전, RESULT 직전의 bounded
  진단 handshake로 CPU segment를 저장하며 이 대기 시간은 별도 항목이다.
  일반 실행의 worker lifetime/admission, 모델 DTO와 제품 readiness budget은
  바꾸지 않는다. 세부 계약은 QA control plane의 `dashboard/boot`가 소유한다.
- 별도 명시적 `dashboard/capture --artifact-entry-journey --artifact-ui-diagnostics`
  경로는 첫 Artifacts 진입/복귀의 CPU·browser render trace와 LoAF를 기록한다.
  canonical 계약은 `docs/operations/qa/entropy-qa-control-plane.md`의 Zen artifact
  gallery journey다. 기본 capture의 profiler 정책은 그대로이며, 실험 옵션은
  격리된 QA document에만 적용하고 제품의 준비/표시 정책을 변경하지 않는다.
- Dashboard i18n stage는 DOM/cookie/localStorage detector를 import하지 않는다.
  canonical typed runtime-language store를 먼저 hydrate하고 i18next init 완료를
  stage readiness로 취급한다.
- static artifact closure owner는
  `scripts/qa/protocols/dashboardBootArtifactDiagnostics.mjs`다. 런타임 stage와
  Vite manifest closure를 함께 보되, 측정 편의를 위해 별도 build/launcher를
  만들거나 readiness timeout을 성공으로 완화하지 않는다.
- theme-owned heavy startup runtime의 named seam은
  `src/themes/core/runtime/dashboardBootRuntime.js`다. Document theme가 확정되면
  dashboard entry가 이 seam을 호출해 선언된 runtime preparation을 React mount와
  겹친다. App-owned `dashboardThemeBootRuntimeHandoff.js`가 dynamic seam load부터
  reservation 생성/채택 전 반환까지 하나의 terminal promise로 소유한다. Sibling
  stage failure, profile gate `blocked`/`recovery_required`, React error가 preparation보다
  먼저 도착해도 release intent를 보존하고 late reservation을 반환한다. 이미 Home
  channel이 채택한 reservation은 channel lifecycle이 소유하므로 handoff release가
  이를 종료하지 않는다. Dashboard entry는 Zen worker plugin을 직접 import하지 않는다.

### 1.3 Tab Registry And Loading Policy Owners

- Initial artifact admission keeps worker control outside the Popup HTML and
  `main.jsx` wrapper static closures. Dashboard HTML retains the declared
  `ZenSoftBootShell.js` worker consumer under the existing boot budgets; this
  rendering admission is not deferred to satisfy a chunk count. The exact fourteen
  worker control/typed telemetry modules are declared once in
  `scripts/release/workerRuntimeChunkContract.mjs` for Vite and the Dashboard
  artifact guard. They emit as `worker-runtime-control` and may import only
  the descriptor/base `dashboard-boot-low-level` owner. The reverse edge is
  forbidden. Existing eight theme surface descriptors remain complete in the
  base owner and reachable from `bootManager`; full plugin manifests remain
  excluded. Worker consumers retain their canonical source APIs and existing
  lifecycle admission, without adding another boot readiness gate.

- active registry owner: `src/apps/dashboard/tabs/registry.js`
- 이 모듈만 아래를 선언한다.
  - tab ids
  - tab loader
  - build-profile entry selection; public Filter factory is `null`, while development may expose its disabled entry
  - mode visibility
  - viewport visibility
  - nav/title/description copy keys
- main/tools keep-alive (Tools parks its retained gallery renderer when inactive)
- Tools forwards runtime admission through artifact motion context for every
  theme. Retained DOM and exit presentation do not keep SVG/Framer loops active;
  an active selected artifact still follows the always-on motion contract.
- loading/readiness descriptor owner: `src/apps/dashboard/tabs/loadingPolicy.js`
- 이 leaf 모듈만 아래를 선언한다.
  - route preload
  - non-blocking boot preload scope (`none` / `module` / `critical`)
  - explicit numeric boot preload priority
  - post-first-frame boot data preload ids
  - pointer/focus intent preload scope (`none` / `module` / `critical`)
  - hydration keys
  - theme widget contract
  - per-tab widget theme resolution
  - loading frame identity
  - tab-root 또는 lab-section readiness scope
  - explicitly named local async boundary ids
- `loadingPolicy.js`는 registry나 tab component를 import하지 않는다. Registry와
  `useDashboardTabReadiness`가 이 leaf를 함께 소비하며, active/build-selected tab
  availability는 registry에만 남는다.
- navigation/boot dependency preload owner는
  `src/apps/dashboard/loading/preloadDashboardTab.js`다. Sidebar는 target tab id만
  전달하고 module/widget loader를 직접 소유하지 않는다. Boot warmup도 같은
  module promise와 theme widget loader cache를 사용한다.
- Tools critical preparation also calls the narrow theme seam
  `src/themes/core/tools/artifactGalleryPreparation.js` in parallel with its
  module/widgets. Zen imports the UI Worker client here; selection intent adds
  the requested SVG compiler when needed. This performs no renderer/texture/scene allocation and
  adds no eager all-family work. Existing boot admission still owns when it starts.
- `layout/useDashboardRenderRuntime.js`는 별도의 좁은
  `themes/core/runtime/dashboardRenderRuntime.js`를 통해 Zen dashboard의 기존
  물리 Worker와 artifact session 수명을 보장한다. Shell dismissal 후 Main이 주차되고 idle일 때
  실제 Shoji 한 장면만 준비하며, Tools 선택 시 같은 준비를 module admission과
  병행한다. Host는 같은 renderer/cache를 인계받고 parking 중 frame 생산은 멈춘다.
  이 준비는 Main composite first-frame ACK나 boot completion 조건을 추가하지 않는다.
- Selection itself joins the same intent preparation, even without prior
  pointer/focus events. Tools includes navigation `ArtifactIcons` in its critical
  widget contract so a small icon does not suspend the complete ready workspace.
  Gallery capability checks use the lightweight surface descriptor, without
  creating an uninitialized lazy widget identity during type resolution.
- boot scheduler는 clean Main first frame과 실제 shell dismissal 뒤, 1200ms input-quiet/idle admission을 통과해야 non-main 준비를 시작한다. `bootIdleAdmission.js`가 각 entry의 입력/visibility를 다시 확인하고 concurrency 1로 분산한다.
  하나의 boot generation `AbortSignal`을 interactive/deferred wave에 공유하며,
  forced/degraded/failed release는 아직 시작하지 않은 work를 취소한다. 양수
  `timeoutMs`는 admission 힌트가 아니라 호출 Promise의 wall-clock 반환 상한이다.
  이미 시작한 `import()`는 물리 취소하지 않지만 scheduler는 더 기다리지 않고
  각 admitted entry에 generation/deadline `AbortSignal`을 전달한다. Feature data
  preloader는 후속 I/O admission과 commit 전에 이 signal을 확인한다. 동적 import
  자체는 취소할 수 없으며 완료되면 shared module cache에 남는다. Scheduler는
  `admitted/settled/pending/skipped/cancelled/timedOut`를 telemetry에 그대로 남긴다.
- development tab-entry diagnostics는 `@dashboard-tab-entry-telemetry` build alias가
  소유한다. Module preloader는 cache `miss/join/hit`과 ready/error를 기록하고,
  Sites snapshot/detail, Tools disclosure, Settings/Tools browser-permission resource도
  같은 cache 상태와 실제 runtime-message/browser-permission I/O를 기록한다.
  active readiness owner는 direct-route를 포함해 render trace를 ensure한 뒤
  loading/ready/error/retry를 기록한다. Active surface가 unmount 또는 inactive로 바뀌면
  `readiness:inactive`로 미완료 trace를 닫아 long-task observer를 남기지 않는다.
  Boot-owned module/data events carry `source: boot` and are not queued into a later
  navigation trace; intent/render cache events remain attributable to that entry.
  Public alias는 no-op이며 public bundle에 observer나 debug state를 넣지 않는다.
- post-first-frame data preloader loader owner는 tab registry이고, 실행 순서와
  admission owner는 `bootSurfaceWarmup.js`다. 각 id는 loading policy에 먼저
  선언되어야 하며, feature resource cache와 in-flight promise를 실제 tab hook과
  공유해야 한다.
- hashed module generation recovery owner는
  `src/platform/extension/dynamicImportRecovery.js`다. 이미 열린 extension page가
  새 build generation에서 삭제된 chunk URL을 요청하면 이 seam만 오류를
  분류하고, runtime build id별로 한 번만 document reload를 시도한다.
- 같은 preloader가 tab module promise와 validated resolved component를 함께
  소유한다. boot/intent/render가 같은 record를 사용하며, `MainPanel`은 한 번 고른
  component type을 panel lifetime 동안 유지해 retained Main을 재마운트하지 않는다.
- 과거의 broad `loading/policy.js`와 `utils/tabAccessPolicy.js`는 retired 상태다.

### 1.4 Theme Widget Resolution Owner

- canonical owner:
  - `src/themes/core/registry/index.js`
  - `src/themes/core/loaders/widgets.js`
- dashboard는 theme widget public seam만 사용한다.
- dashboard loading policy는 어떤 widget contract가 필요한지 선언하지만, widget lookup/loader 구현은 theme layer가 소유한다.
- widget chunk의 `idle/loading/ready` 상태도 같은 validated module record가 소유한다.
  boot/intent preload가 완료된 widget을 readiness hook이 별도 cache로 다시
  loading 처리하지 않는다. `preloadWidgetChunk`와 `React.lazy`는 동일 module
  promise를 사용하고, renderable default export가 없으면 record를 ready로
  올리지 않는다. Dashboard readiness는 preload ACK와 canonical ready key를
  함께 검증한다. Lookup이 먼저 lazy identity를 공개했다면 이후 preload가
  완료되어도 그 identity를 유지하고, preload가 lookup보다 먼저 끝난 경우에만
  resolved component를 직접 반환한다.
- widget loader도 자체 reload 규칙을 만들지 않고 platform의
  `dynamicImportRecovery.js`를 사용한다. 같은 build에서 terminal chunk failure가
  반복되면 record를 evict하고 명시적으로 reject한다. Error widget을 ready module로
  캐시하지 않으며 tab/action retry가 새 module record를 만든다.

### 1.5 Experiment Lab Owner

- lightweight home/shell owner:
  `src/apps/dashboard/tabs/experiment/ExperimentHubTab.jsx`
- development-only lab catalog owner:
  `src/apps/dashboard/tabs/experiment/experimentLabCatalog.js`
- selected async lab boundary owner:
  `src/apps/dashboard/tabs/experiment/ExperimentLabOutlet.jsx`
- non-CLSE heavy diagnostic workspace owner:
  `src/apps/dashboard/tabs/experiment/ExperimentWorkspace.jsx`
- Experiment는 앱 소유 개발 진단 허브이며 특정 theme capability가 아니다.
  public build에서는 entry alias가 source graph에서 제외한다.
- Experiment home은 preference/protocol만 확인하고 lab별 widget/runtime을
  요구하지 않는다. Outlet은 선택된 section을 `workspace` 또는 `clse` module
  owner로 묶어 하나의 named nested async boundary에서만 연다.
- 선택된 lab chunk가 build generation 교체로 사라진 경우 Outlet은 같은 stale
  URL을 local retry하지 않는다. shared recovery seam이 build id별 1회 dashboard
  reload를 소유하고, 같은 generation에서 다시 실패한 경우에만 명시적 error
  surface와 user-triggered reload를 남긴다.
- `ExperimentWorkspace`가 non-CLSE section의 readiness profile을 `surfaceId`로
  해석한다. 임의의 lab-local Suspense runtime으로 확장하지 않는다.
- CLSE dashboard UI owner는
  `src/apps/dashboard/tabs/experiment/clse/CLSELab.jsx`다. CLSE runtime, typed store,
  background route, storage owner는 그대로 유지되며 독립 dashboard tab만 없다.

### 1.6 Shared Protection Runtime Owner

- canonical owner:
  - `src/apps/dashboard/hooks/useProtectionRuntimeSubscription.js`
  - `src/apps/dashboard/hooks/protectionRuntimeSubscriptionBridge.js`
  - `src/apps/dashboard/hooks/useProtectionArtifactsControlPlane.js`
  - `src/apps/dashboard/hooks/artifactSettings/`
  - `src/apps/dashboard/hooks/artifactSettings/useArtifactSettingsCommands.js`
  - `src/apps/dashboard/hooks/useProtectionBlockedHistoryControl.js`
  - `src/apps/dashboard/utils/protectionArtifactsControlPlane.js`
  - `src/apps/dashboard/tabs/tools/artifactActivationState.js`
  - `src/domains/protection/runtime/canonicalArtifactTelemetry.js`
- `filter`, `tools`, `main`은 shared protection/runtime seam을 여기서만 본다.
- `tabs/tools/**` 는 tools UI만 소유한다.

### 1.7 Main Retention And Heavy Runtime Owner

- Analysis refresh admission owner: `src/apps/dashboard/hooks/useAnalysisProjectionDemand.js`
  and `src/apps/dashboard/stores/useAnalysisStore.js`. Active visible consumers lease
  their required projections. Main needs cycle/status; Schedule and Settings need
  cycle only. The policy declares these projections, and readiness/retry uses their
  individual loaded/error state. `analysisError` is aggregate diagnostics only.
- Stats events and canonical settings-document changes invalidate cached projections
  even without visible demand; they do not eagerly query hidden or unrelated surfaces.
  Reactivation refreshes stale demanded projections. Sites retains its own coalesced
  summary/selected-detail query admission. Initial bootstrap/prewarm remains boot-owned.
- Ordinary committed events coalesce both cycle and status reads within a 60-second
  freshness window. Each projection has one trailing timer, cancelled when visible
  demand ends. Loaded snapshots remain available during refresh; event bursts and
  commits received during an in-flight read do not create continuous read loops.
  Explicit reads, settings changes, resets, rollovers, and visible reactivation bypass
  this event-only window; reset still clears pre-reset snapshots immediately.
- Bootstrap, cycle, status, and Sites transport responses share per-projection request
  admission sequences. A newer overlapping read or reset/policy invalidation prevents an
  older response from replacing that projection. Errors clear only when the same
  projection recovers. A successful unrelated read cannot manufacture readiness.
- The protection runtime bridge pauses its recovery interval when the document is
  hidden, revalidates on visible return, and joins in-flight reads of the same action.
  Pushed snapshots supersede older pending response commits.

- tab-retention owner: `src/apps/dashboard/tabs/registry.js`
- tab-render owner: `src/apps/dashboard/layout/MainPanel.jsx`
- heavy runtime owners: `src/themes/plugins/zen/pond/control/zenMainSignalScannerRuntime.js` and the Main Classic2 bonsai worker renderer chain
- standard tabs는 inactive 전환 시 unmount 된다.
- `main` tab retention is a narrow registry-declared exception for persistent presentation/runtime continuity.
- `MainPanel`은 pane lifetime을 세 값으로 분리한다. `isRuntimeActive`는 현재 선택된
  tab에만 true이고, `isPresented`는 현재 tab 또는 stacked exit pane에 true이며,
  `isExiting`은 exit motion lifetime만 나타낸다. 기존 `isActive` prop은 migration
  기간의 presentation 호환 값이며 새 controller/effect/worker admission에 사용하지 않는다.
- stacked exit는 이전 pane DOM을 motion 종료까지 보존하지만 navigation commit 즉시
  `isRuntimeActive=false`를 전달한다. 따라서 exit motion이 status refresh, capability
  request, worker animation, polling의 2중 실행 권한이 될 수 없다.
- retained Main의 Zen pond와 Classic2 bonsai canvas runtime만 inactive 시 controller/canvas identity를 보존한 채 렌더를 park/resume할 수 있다. 0×0 측정이나 일시적인 lineage 준비 대기는 OffscreenCanvas controller 폐기 사유가 아니다.
- Classic2 bonsai의 exact current readiness는 scene/input/materialization ACK를 계속 요구한다. 다만 같은 physical canvas/scene/active-tree identity 안의 input/materialization 전환은 마지막 exact-ACK paint를 readiness와 분리해 유지하며, scene/tree identity 또는 canvas가 바뀌면 새 exact ACK 전까지 paint를 숨긴다.
- generic runtime registry는 만들지 않는다.

### 1.8 Main Presentation Scene Owner

- target owner: `src/apps/dashboard/presentation/useMainPresentationScene.js`
- architecture: `docs/architecture/themes/zen/zen-main-presentation-scene-architecture.md`
- The launch/loading layer gates readiness only. It does not decide first vision or current-cycle presentation.
- The scene conductor emits one typed presentation decision after boot/progression/status readiness is known.
- The conductor owns the commit-driven scene state machine: ideal surface commit, healthy reveal, opaque cover, current surface commit, progression `SPENT`, and uncover run in that order.
- `DashboardPage` observes native document visibility/focus once through
  `presentation/DashboardPresentationAdmission.jsx`. It supplies explicit
  `presentationActive` to the conductor and publishes the same passive
  exclusive/contextual admission snapshot to Home and Guidance. Admission owns
  no eligibility, durable receipt, renderer ACK or new event ledger. General
  Dashboard ceremony waits behind boot/scene release and First Vision's complete
  exclusive lifecycle; request generations fence replacement/completion.
- `usePresentationSessionLifetime.js` synchronously fences each theme/boot
  generation, including late command completions and cover/overlay callbacks.
  An already committed background fact remains progression-owned. Dream dwell
  accumulates monotonic admitted foreground time after actual shell dismissal;
  hidden or blurred time cannot consume the existing duration.
- A presented command's valid canonical `SPENT` ACK from another Dashboard tab
  selects an explicit opaque-cover/current-frame handoff. It does not fake a
  presented ACK, throw a persistence failure, repeat the spent write, or bypass
  the exact current composite ACK before uncover.
- Zen-specific expression belongs to the Zen projection adapter, not the launch/loading layer or nested view components.
- `DashboardPage`, `MainTab`, and `HomeScanWorkspace` must not grow parallel special-state booleans for first vision, recap, or future main presentation scenes.
- First Vision reuses the normal dashboard DOM and geometry. It must not hide, translate, unmount, or make the sidebar/lower rhythm surfaces inert; paint-only emphasis may be added through a separately owned Zen visual token.
- `PRESENTED && !SPENT` is explicitly resumable on a later healthy boot. Boot fail-open may defer the ceremony with diagnostics, but it must not silently select normal current and leave artifact disclosure waiting forever.

### 1.9 Boot User-Control Release Owner

- canonical owner: `src/apps/dashboard/bootstrap/bootManager.js`
- Main-to-boot callback lifetime owner:
  `src/apps/dashboard/bootstrap/dashboardMainBootReadiness.js`. Dashboard removes
  these callbacks after the first accepted ready/degraded ACK; retained or stale
  callbacks consult the canonical gate before forwarding. Later theme/canvas
  visual lifetimes cannot reopen the document's completed boot gate. The manager's
  direct duplicate-ACK invariant remains strict. An eventual first ACK after a
  forced release retains the existing degraded state.
- clean boot readiness remains `dismissible`; hard-timeout recovery remains
  `forcedVisualRelease` and must not manufacture clean readiness.
- `isDashboardUserControlReleased()` is the sole dashboard projection that
  unlocks tab navigation after either boundary.
- `DashboardPage` may force Main only while that projection is false. A forced
  release selects degraded/current presentation and leaves First Vision
  unconsumed for a later healthy boot.

### 1.10 Profile Compatibility Recovery Owner

- profile lifecycle/readiness gate owner:
  `src/apps/dashboard/bootstrap/useDashboardProfileMutationLifecycle.js`
- lifecycle/vault composition owner:
  `src/apps/dashboard/bootstrap/DashboardAdmissionBoundary.jsx`; one lifecycle
  subscription captures closed admission before local preparation/unlock. A failed
  reset with absent keys shows recovery directly. Generation readiness and lease
  binding remain disabled until the same vault controller reports protectionReady.
  Initiating reset response/ACK state survives subscription changes; a closed
  document stays sealed through completion and awaits the existing runtime handoff.
  `security/DashboardProfileMutationController.jsx` holds an initiating Settings full-reset or backup
  restore request and successful receipt outside key-dependent runtime. Closed
  lifecycle unmounts those consumers; a synchronous ACK-start failure retries
  only that receipt. A request failure without a receipt yields to canonical recovery.
- profile compatibility response contract owner:
  `src/platform/storage/model/ProfileCompatibilityContract.js`
- reset-only UI owner:
  `src/apps/dashboard/bootstrap/DashboardProfileMutationRecovery.jsx`
- `DashboardPage`는 normal Dashboard runtime을 mount하기 전에 lifecycle과 exact
  profile-generation readiness를 통과해야 한다. Current-only development baseline보다
  오래된 profile은 readiness failure의 branded
  `profile_compatibility_recovery_v1` descriptor로만 `recovery_required`가 된다.
- `recovery_required`에서는 tab/settings/theme runtime을 mount하지 않고 passcode와
  `RESET_APP_DATA`만 가진 reset-only surface를 mount한다. 아직 reset lifecycle이 열린
  상태이므로 요청에 임의의 `expectedResetId`를 합성하지 않는다. Background eager control
  plane은 일반 initialization failure가 settle된 뒤에도 이 reset을 dispatch할 수 있다.
- reset이 시작되어 lifecycle이 닫히면 기존 lifecycle recovery 계약으로 전환하고 exact
  observed `resetId`를 제출한다. 성공 응답의 handoff ACK와 runtime reload ownership은
  기존 profile-mutation 경계를 그대로 사용한다.
- malformed recovery descriptor, 현재 baseline의 malformed persisted state, unknown
  readiness error는 recovery UI로 완화하지 않고 fatal error로 surface한다. Dashboard가
  임의의 contract error 문자열을 reset 신호로 해석하거나 자동 reset하면 안 된다.

## 2. Final Rendering Rules

### 2.1 Active-Only Mount With Registry Exceptions

- standard dashboard tab tree는 active tab만 mount한다.
- hidden global keepAlive tab tree는 없다.
- `main`은 registry-declared keep-alive exception이며 loading policy에는 포함되지 않는다.
- Zen의 `main`/`sites`는 같은 retained Garden pane을 사용한다. Sites subtree는
  길목 최초 진입에서 mount한 뒤 종이 닫힘과 draft를 위해 보존한다. 닫힌 상태의
  runtime/query는 park하며, 공통 분재와 연못의 activity는 별도로 판정한다.
- tab-local React state 보존은 구조 목표가 아니다.
- stacked transition의 outgoing DOM retention은 runtime activity retention이 아니다.
- Sites/Schedule/Tools/Settings의 outgoing pane은 마지막 presentation projection을
  유지하되 큰 protocol/analysis/security Zustand slice는 runtime inactive 즉시
  park한다. Settings/Tools permission read가 그 뒤 완료되어도 shared resource cache만
  갱신할 수 있고 비활성 local UI state에는 commit하지 않는다.

### 2.2 Single Semantic Gate

- standard tab은 tab-root readiness gate 하나만 가진다.
- leaf/widget 단위의 의미 있는 fallback은 금지한다. 다만 loading policy가 id로
  명시한 local action/enrichment boundary는 현재 tab truth를 유지한 채 별도
  pending/error를 가질 수 있다. 현재 named boundary는 Main의
  `main-session-summary-ai`, Sites의 `sites-notebook-target`, Schedule의
  `schedule-special-session`, Tools의 `tools-selected-artifact-controller`와
  `tools-storage-support`, Experiment의
  `experiment-lab-section`, Settings의 `settings-safety`와
  `settings-workspace`뿐이다.
- pending UI는 canonical loading frame 또는 이미 진실과 무관하게 그릴 수 있는
  shell만 허용한다. shell-first UI의 조작부는 owner data가 준비될 때까지
  `disabled`/`inert` 상태여야 하며 business 값을 꾸며내지 않는다.
- failure UI는 명시적으로 보여야 한다.
- preference/protocol hydration 실패는 loaded state로 위장하지 않고 tab-root readiness error로 surface한다.
- tab-root retry는 실패한 canonical preference/protocol/analysis owner만 다시
  initialize/refresh하고, widget failure면 canonical widget preload만 재시도한다.
  retry가 synthetic snapshot/default business data를 만들어 ready로 바꾸는 경로는 없다.
- hashed chunk fetch failure의 1회 document reload는 새 build generation으로
  진입하기 위한 asset recovery이며 semantic fallback이 아니다. 같은 runtime
  build id에서 반복되면 더 이상 자동 reload하지 않고 명시적 failure로 남긴다.
- Experiment는 named section exception이다. 허브 shell은 유지하고 선택된 lab section만
  section readiness/loading/error를 가진다. 허용된 nested async boundary는
  `ExperimentLabOutlet` 하나뿐이다.
- Tools artifact 전환은 current artifact를 committed surface로 유지한다. target
  navigation의 pointer/pointer-down/focus intent는 widget과 selected-family controller를
  같은 resource record로 예열하고, 두 ACK와 canonical `ready` state가 확인된 뒤에만
  selection을 commit한다. Echo destructive workflow hook은 이 selected controller에만
  존재한다. preview/review/backup/confirm이 진행 중이면 Echo가 selection admission을
  소유해 명시적 Cancel/Confirm이 끝날 때까지 artifact-away를 막고, controller가
  inactive가 된 뒤 도착한 UI completion은 generation fence로 폐기하되 이미 수락된
  canonical mutation은 완료한다. 로드 실패는 해당 navigation slot의 local retry로 남는다.
- Tools storage support는 `Alt+Shift+I` action 전까지 visibility hook만 유지한다.
  action 후에만 `StorageSupportWorkspace` chunk와 inspector controller/panel을 열며,
  이 boundary는 artifact tab readiness나 artifact gallery truth를 대체하지 않는다.
- Schedule special session은 격리 action 전까지 controller/panel과 `allowedUrls`
  구독을 base Schedule graph에 넣지 않는다. action 후에만
  `ScheduleSpecialSessionWorkspace` chunk를 열며, pending/error는 schedule tab
  readiness가 아니라 `schedule-special-session` local action boundary가 소유한다.
- Settings의 기본 Permissions는 tab readiness 직후 동기적으로 사용할 수 있다.
  Safety와 Workspace의 presentation graph만 각각 named boundary로 분리한다.
  ready content commit 뒤 bounded idle과 section pointer/pointer-down/focus intent가
  같은 module record를 예열하며, ready record는 `React.lazy` fallback 없이 검증된
  component를 직접 렌더한다. controller/store/capability truth는 `SettingsTab`에 한
  번만 남고 module 실패는 선택 section의 명시 retry가 소유한다.
- action boundary의 명시 retry가 필요한 caller는 `loadAction`/`renderAction`
  contract를 사용한다. Boundary가 attempt마다 새 `React.lazy` identity를 만들고
  `renderError`에 `retry`를 제공하며, 동일하게 rejected된 module-scope lazy
  객체를 단순 remount하는 방식은 복구 계약이 아니다.
- Main session-summary AI는 deterministic brief나 Main readiness의 일부가 아니다.
  Zen에서는 module admission이 0이고, non-Zen에서만 clean Main first frame 뒤
  `bootShellDismissed`와 local idle admission을 모두 통과한 후
  `SessionSummaryAiPanel` chunk를 mount한다. capability 확인도 이 mount 뒤에만
  시작하며 chunk failure는 `main-session-summary-ai` local retry가 소유한다.
- Sites의 `sites-snapshot`은 Main first frame 뒤 deferred boot wave에서
  dynamic import된다. canonical Sites snapshot을 예열하며, 명시적 route domain이
  있을 때만 그 detail을 준비한다. Sites hook은 동일 resource cache/in-flight를
  사용한다. 장부의 remembered selection은 상세 수요가 아니다. target widget은
  `sites-notebook-target` local boundary에서 상세를 표시할 때 준비한다.

### 2.3 Registry-declared retention

- `main`은 registry-declared keep-alive 예외로 한 번 방문한 뒤 inactive에서도 mount를 유지한다.
- Zen Sites에서는 이 같은 Main pane이 활성 Garden host다. 분재는 유지하고,
  Pond만 park한다. Sites presentation은 app-owned `SitesManagementSurface`를
  재사용하며 별도 숨겨진 Sites tree나 두 번째 router를 만들지 않는다.
- inactive Main pane은 inert/hidden 상태가 되고, Zen pond와 Classic2 bonsai renderer는 controller/canvas identity를 보존한 채 `park/resume` 된다.
- Main status/cycle/protection subscriptions and refresh effects use `isRuntimeActive`.
  Parked Zustand projections retain the last active display identity without observing
  background updates; reactivation reads the current canonical stores before resuming.
  이 retained projection은 source-of-truth cache나 storage fallback이 아니다.
- optional session-summary AI enrichment는 inactive 전환 시 unmount되어 generation과
  preparation을 abort하며, 재진입 시 이미 admission된 chunk만 다시 mount할 수 있다.
- `tools`도 registry-declared keep-alive로 방문 후 gallery canvas와 cache를 유지한다.
  inactive Tools는 inert/hidden이며 controller subscriptions와 rendering은
  `isRuntimeActive`를 따른다. 복귀는 현재 입력의 새 frame을 준비해 공개한다.
- 이 예외는 `main`과 `tools`의 명시된 수명 계약이며 dashboard-wide policy가 아니다.

## 3. Final Flow

1. background가 canonical prewarm snapshot을 만든다.
   - cold service-worker startup에서는 stats/cache/cycle/settings/CLSE가 준비된
     dashboard boot-read milestone 뒤 prewarm/analysis read를 먼저 열고,
     bookmark/nudge/content-script/alarm/focus startup tail은 계속 병렬로 진행한다.
2. boot shell은 boot-only theme context로 theme hint만 먼저 해석한다.
3. visible shell은 startup-only pre-baked boot shell catalog에서 만들어지며, full theme manifest/widget graph를 import하지 않는다.
4. `main.jsx`는 bootstrap leaf로 평가된 뒤 React host, Dashboard-profile i18n,
   document-theme, App graph를 명시적인 동적 stage로 병렬 admission한다. 각 stage의 import
   Promise가 fetch/compile/evaluation 시간을 소유하며, 모든 stage가 준비된 뒤
   document theme를 적용하고 React render를 요청한다. i18n bootstrap projection은
   shell/Main namespace만 포함하고, Tools를 포함한 나머지 tab dictionary는 Main first-frame
   이후 canonical tab-module preload Promise에 합류한다.
5. dashboard launch context가 route/storage hint를 한 번 해석한다.
6. profile lifecycle/readiness gate가 current generation을 검증하고, 과거 개발 baseline이면
   normal runtime 대신 reset-only recovery surface를 선택한다.
7. tab loading policy가 frame/intent/preload/readiness contract를 선언하고, tab registry가
   현재 mode/theme/context에서 허용된 active tab/loader에 그 contract를 결합한다.
8. boot 중 실제 visible target인 `main` chunk와 theme widgets만 correctness-critical warmup한다.
   명시 preload된 widget이 module-owned runtime preparation을 선언했다면 그 단일
   preparation Promise도 widget ACK 전에 시작한다.
9. clean Main first frame이 commit된 뒤, policy가 `bootPreloadScope`로 선언한 enabled tab을
   명시 `bootPreloadPriority` 내림차순(launch target은 최우선)으로 최대 2개씩
   low-priority interactive wave에서 예열한다. `module` scope는 tab module만,
   `critical` scope는 module과 tab-root critical widgets만 같은 group에서 준비한다.
   현재 first-entry latency 대상은 Sites, Schedule, Tools뿐이며 Settings는
   `none`으로 남아 navigation intent 때만 module을 준비한다.
10. sidebar pointer/focus/pointer-down intent는 named preload seam을 통해 target의
   declared module 또는 critical widgets까지만 예열한다.
11. active tab chunk가 로드된다.
12. MainPanel renders the active tab, a stacked outgoing presentation pane when applicable,
    plus registry-declared `main` retention. Only the selected pane receives runtime activity.
13. readiness gate가 해당 tab 또는 Experiment lab section의 hydration + canonical
    widget preload state를 확인한다.
14. hydration/read failure가 있으면 owning tab/lab error로 멈춘다.
15. 준비 전에는 policy가 지정한 geometry-matched frame을 보인다. 준비된
    truth-independent shell은 controls를 inert하게 유지한 채 먼저 보일 수 있다.
16. critical readiness 뒤의 enrichment는 명시적인 local pending/error로 갱신하며
    전체 탭을 다시 skeleton으로 교체하지 않는다. Main session-summary AI는
    non-Zen clean first frame 이후 idle slot에서만 module/capability graph를 연다.
    Settings는 기본 Permissions를 먼저 유지하고 ready commit 뒤 Safety/Workspace
    presentation module만 local idle/intent record로 예열한다.
17. main presentation scene conductor emits the `current` or `first_vision` decision.
18. Zen projection adapter turns the decision into pond/bonsai/rhythm/overlay/interaction projections.
19. interactive wave가 budget 안에서 끝난 뒤에는 policy가 별도로 선언한 data
    preload와 non-critical enrichment widget만 bounded deferred wave로 준비한다.
    generic `CorePreview`/`CoreStatus`/`ActivityGraph` 목록은 scheduler가 임의로
    추가하지 않는다. Sites data preload는
    snapshot과 실제 첫 detail resource를 tab hook과 공유하며, 전체 artifact
    manifestation catalog를 일괄 예열하지 않는다.
20. retained `main`의 Zen pond와 Classic2 bonsai renderer는 필요시 park/resume 된다.

## 4. Forbidden Structures

- `DashboardPage`, `bootSurfaceWarmup`, `bootShell` 각각이 tab/theme hint를 따로 읽는 구조
- `bootShell`이 full dashboard launch/tab registry graph를 import하는 구조
- tab metadata를 여러 컴포넌트가 각자 조립하는 구조
- loading policy에 id로 선언되지 않은 nested semantic/async boundary
- loading policy 밖에서 tab skeleton geometry나 intent/boot preload 범위를 재선언하는 구조
- dashboard tab이 sibling tab controller/UI/preview 구현을 직접 import하는 구조
- hidden global keepAlive resurrection beyond the registry-declared main/tools exceptions
- outgoing presentation lifetime을 controller/worker active authority로 사용하는 구조
- generic surface runtime framework 도입
- distributed first-vision/recap booleans that let nested components compete for main presentation scene ownership
- using `boot.dismissible` directly as the dashboard navigation lock after a forced visual release
- putting Zen pond/bonsai/rhythm projection fields inside the app-level presentation decision
- treating arbitrary boot/readiness errors as profile reset signals or mounting normal Dashboard
  runtime behind the reset-only compatibility surface

## 5. Removed Compatibility Seams

아래 경로는 canonical 구조에서 제거 대상이며 다시 생기면 회귀다.

- retired broad loading-policy compatibility helper
- retired tab access policy helper path
- old tools-local protection runtime subscription hook path
- old tools-local protection runtime bridge path
- retired generic tools utils path
- retired tools-local artifact runtime state path
- retired independent CLSE dashboard tab, `@dashboard-clse-tab-entry`, and
  `labEntries/clseEntry.*`

## 6. Completion Criteria

아래가 모두 만족되어야 dashboard launch/loading 구조는 합격이다.

- launch context owner가 단일하다.
- active tab/loader registry owner와 loading/readiness descriptor owner가 각각 단일하다.
- readiness hook은 dynamic tab loader registry를 역참조하지 않는다.
- standard tabs는 tab-root gate 1개 규칙을 지키며 Experiment만 named lab-section
  exception을 가진다.
- Suspense와 readiness surface는 loading policy의 동일한 frame identity를 쓴다.
- intent/boot preload는 named dashboard loading seam을 통해서만 일어난다.
- `FilterTab`이 `Tools` controller에 의존하지 않는다.
- dashboard tab이 sibling tab directory를 직접 import하지 않는다.
- registry에 명시된 Main/Tools 외 standard tabs에는 keepAlive가 없다.
- `main` retention은 registry-declared exception으로만 남는다.
- stacked exit pane은 DOM을 유지하되 즉시 runtime-inactive가 되고, retained Main은
  inactive store updates나 refresh request를 소비하지 않는다.
- build와 loading-contract 테스트가 통과한다.
- old development baseline은 reset-only surface로 진입하고 current-baseline corruption은
  fatal로 남는다.

## 7. Residual Acceptable Exceptions

- top-level async boundary는 shell과 active-tab chunk 로드에 한해 허용된다.
- theme widget loading은 public theme registry seam 안에서 비동기로 남을 수 있다.
- Experiment의 `ExperimentLabOutlet` 하나는 selected development lab을 위한 named
  nested async boundary로 허용된다. Experiment shell과 다른 lab은 유지되어야 한다.
- Schedule의 `schedule-special-session`과 Tools의 `tools-selected-artifact-controller`,
  `tools-storage-support`는
  loading policy에 선언된 user-invoked action에만 허용된다. 두 경계의
  pending/error는 현재 tab의 canonical surface를 대체하지 않는다.
- retained Main의 Zen pond와 Classic2 bonsai renderer `park/resume`은 local heavy-runtime optimization으로 허용된다.
