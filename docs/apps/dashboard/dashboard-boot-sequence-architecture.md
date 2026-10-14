# Dashboard Boot Sequence Architecture

- Status: Active
- Owner: dashboard app
- Last validated against code: 2026-08-09
- Path policy: current-only
- Canonical for: dashboard visible boot shell lifecycle, dashboard boot theme resolution, and theme-owned boot shell handoff

## Purpose

대시보드가 처음 사용자에게 보여주는 부트 화면의 실제 경로와 소유권을 고정한다.
실패 또는 hard-timeout 종료는 rAF 도착에 의존하지 않는다. 프레임 공급이 멈춘
상태에서도 타이머로 renderer를 해제하고 root를 공개하며 실패 상태는 유지한다.
정상 ready 전환만 기존 paint 경계를 기다린다.
핵심은 다음 두 가지다.

- 대시보드 앱은 부트 셸의 수명주기만 소유한다.
- 어떤 부트 화면을 그릴지는 theme seam이 소유한다.

## Canonical Entry Points

- `src/apps/boot/bootPrewarmSnapshotContract.js`
  - background producer와 dashboard consumer가 공유하는 exact V1 business snapshot 계약을 소유한다.
  - settings/protection/schedule/CLSE/theme 의미를 조립하지만 transport나 storage를 소유하지 않는다.
- `src/apps/dashboard/bootShell.js`
  - visible boot shell의 mount, root paint preparation/input release, dismiss, hard-timeout fail-open을 소유한다.
- `src/apps/dashboard/bootstrap/dashboardLaunchContext.js`
  - full dashboard route/tab launch context composition을 소유한다.
- `src/apps/dashboard/bootstrap/dashboardBootShellThemeContext.js`
  - `resolveDashboardBootShellThemeId()`를 통해 mirror-only startup theme resolution을 소유하며, prewarm contract, tab registry, React UI graph를 import하지 않는다.
- `src/apps/dashboard/bootstrap/dashboardBootThemeContext.js`
  - exact V1 prewarm snapshot이 준비된 뒤 launch theme hint resolution을 소유한다.
- `src/themes/core/boot/createThemeBootShellElement.js`
  - non-theme caller가 사용하는 visible boot shell seam이다.
- `src/themes/core/loaders/bootShells.js`
  - startup-only pre-baked visible boot shell catalog와 module resolution을 소유한다.
- `src/themes/core/loaders/bootLoaders.js`
  - manifest-declared React boot loader component resolution을 소유한다.
- `src/themes/core/documentTheme.js`
  - document theme apply/init side effect를 소유한다.
- `src/themes/core/runtime/dashboardBootRuntime.js`
  - canonical theme별 dashboard heavy-runtime preparation 유무와 theme-owned
    reservation loader를 소유한다.
- `src/apps/dashboard/bootstrap/dashboardThemeBootRuntimeHandoff.js`
  - dynamic theme-runtime import부터 reservation 채택 전 반환까지 하나의
    preparation/release handoff를 소유한다.
- `src/apps/dashboard/bootstrap/dashboardEntryStageTraceContract.js`
  - dashboard entry stage/phase event identity와 marks/full projection을 소유한다.
- `src/apps/dashboard/bootstrap/bootManager.js`
  - `themeReady && coreReady && mainTabFirstFrameReady -> dismissible` gate state와 dismissible 전이를 소유한다. Theme와 core는 독립적으로 준비될 수 있다.
  - `isDashboardUserControlReleased()`는 정상 `dismissible` 또는 명시적
    `forcedVisualRelease` 이후의 dashboard navigation 해제를 투영한다.

## Sequence

1. `bootShell.js`가 `dashboardBootShellThemeContext.js`의 `resolveDashboardBootShellThemeId()`로 초기 theme id를 결정한다.
2. `bootShell.js`는 `createThemeBootShellElement(themeId, ...)`만 호출해서 visible shell을 만든다.
3. `createThemeBootShellElement.js`는 `bootShells.js`의 startup-only pre-baked catalog를 따라 visible shell 모듈을 찾는다.
4. 해당 boot shell module이 `createBootShellElement()`를 export하면 그 theme-owned shell을 사용한다.
5. pre-baked custom shell entry가 없으면 `createDefaultBootShellElement()`가 core shared shell을 만든다.
6. visible shell이 mount되면 `bootShell.js`는 정상 경로에서 두 번의 animation frame을 기다려 첫 paint를 양보한다.
7. hidden/background/occluded document에서 rAF가 멈추면 `BOOT_SHELL_INITIAL_PAINT_TIMEOUT_MS`가 같은 admission을 한 번만 결제한다. 정상 두-frame 경로가 먼저 끝나면 timeout을 취소하고, timeout이 먼저 끝나면 늦은 rAF를 취소·무시한다. 이 liveness admission은 clean readiness나 renderer ACK를 만들지 않는다.
8. admission 뒤 `bootShell.js`는 renderer readiness를 기다리는 동시에 root를 숨긴 채 idempotent `startDashboardImport()`로 `main.jsx` import를 시작한다. Renderer ACK가 오면 `reportThemeReady()`로 첫 번째 gate를 올린다. `themeReady && coreReady`가 되면 opaque shell 아래 root의 visibility를 복원해 DOM/canvas paint 준비를 Main readiness와 겹친다. Root의 `inert`와 pointer 차단은 기존 dismiss release까지 유지한다.
9. `main.jsx`는 가벼운 bootstrap leaf로 평가되고 `startDashboardRuntime()`가 React host,
   Dashboard-profile i18n, document-theme initializer, App graph를 각각 명시적인 동적 stage로 admission한다.
   `bootShell.js`는 bootstrap module import와 전체 runtime-start Promise를 구분해 trace한다.
   Dashboard i18n은 shell/Main namespace만 먼저 admission하며, Tools를 포함한 나머지 tab
   dictionary는 Main first frame 뒤 기존 tab preloader와 같은 readiness Promise로 settle한다.
   development HUD도 shell dismiss 뒤 같은 deferred Tools resource Promise를 기다린다.
10. Document-theme stage가 준비되면 `dashboardDocumentThemeInitialization.js`가 같은
   `dashboardBootThemeContext.js`의 `resolveDashboardBootThemeId()`와
   `initializeDocumentThemeForThemeId()`를 사용해 document theme를 먼저 적용하고,
   React host, i18n, App와 theme-runtime preparation Promise가 모두 준비되면
   `dashboardReactHost.jsx`가 React를 한 번 mount한다. Document-theme stage는 full
   `dashboardLaunchContext.js`나 tab registry를 정적으로 import하지 않는다.
   Document-theme stage가 먼저 settle하면 entry는 동시에
   `dashboardThemeBootRuntimeHandoff.js`를 통해 `dashboardBootRuntime.js`를 열어
   active theme의 declared startup runtime을 준비한다. Zen은 shared Home
   renderer의 bounded startup reservation을 만들고 world-runtime import를 React
   mount 전에 시작하며, 첫 Pond/Bonsai channel이 그 reservation을 채택한다.
   Sibling stage, profile gate, React runtime이 채택 전에 실패하면 handoff owner가
   pending release intent를 보존하고 늦게 준비된 reservation까지 반환한다.
11. `bootManager.js`는 `themeReady`, `coreReady`, `mainTabFirstFrameReady`를 각각 추적하고 세 gate가 모두 true일 때만 `dismissible`로 승격한다. Explicit terminal main visual first-frame failure는 boot 전체를 `failed`로 승격하지 않고, diagnostic error와 `mainTabFirstFrameDegraded`를 남긴 뒤 degraded readiness로 release gate를 만족시킨다.
12. `bootManager.js`가 `dismissible === true` 스냅샷을 emit하면 `bootShell.js`가 cross-fade dismiss를 수행한다.
13. `BOOT_SHELL_HARD_TIMEOUT_MS`에 도달하면 shell은 먼저 idempotent `startDashboardImport()`를 다시 호출해 dashboard entry 시작을 보장한 뒤 사용자 제어 회복을 위해 fail-open으로 제거될 수 있다. 이 경로는 `bootManager.reportForcedVisualRelease()`로 `forcedVisualRelease === true`와 `phase === "forced_visual_release"`를 먼저 기록하며, 정상 `ready` 성공을 대체하지 않는다.

## Ownership Rules

- dashboard app은 theme-specific boot DOM/CSS를 직접 inline하면 안 된다.
- non-theme caller는 plugin presentation internals를 직접 import하지 않고 `createThemeBootShellElement()`만 사용한다.
- theme가 custom visible shell을 원하면 manifest의 `bootShells[activeVariant]`에 theme-owned pure DOM shell module을 명시하고, `bootShells.js` startup catalog에도 같은 경로를 pre-bake한다.
- custom shell이 없을 때 허용되는 공유 경로는 core default shell 하나뿐이다.
- boot dismiss contract는 `themeReady && coreReady && mainTabFirstFrameReady` 조합으로만 열린다.
- Boot shell은 fade 전 viewport를 완전히 덮는 opaque cover다. 수명 owner는 mount부터
  `will-change: opacity`를 선언해 fade용 합성을 준비하고 shell removal로 해제한다.
  `boot_shell:root_paint_prepared`는 root paint가 가능해졌다는 뜻일 뿐 브라우저의
  raster/presentation 완료 ACK가 아니다. 준비 때문에 새 timer, readiness gate,
  강제 layout 또는 인위적인 대기를 추가하지 않는다. 정상 fade와 failure/hard-timeout
  release는 root의 기존 visibility, pointer-events, inert 상태를 보존·복원한다.
- hard-timeout root reveal은 forced visual release boundary다. Shell은 root와 사용자
  navigation을 열 수 있지만 `dismissible`이나 clean `ready`를 만들 수 없고, 이후
  세 gate가 완성되더라도 최종 release는 degraded readiness로 남는다.
- initial-paint liveness timeout은 `bootstrap/bootConfig.js`가 소유한다. 이 timeout은
  rAF가 정지한 문서에서 dashboard entry 시작만 보장하며, frame·theme·core readiness를
  추정하거나 다른 source of truth를 만들 수 없다. Normal rAF, timeout, hard-timeout
  경로는 모두 같은 idempotent dashboard import gate로 수렴한다.
- `DashboardPage`의 boot 중 Main 고정은 `dismissible`을 직접 해석하지 않는다.
  `isDashboardUserControlReleased()`가 false인 동안에만 고정하며, forced visual
  release 뒤에는 원래 요청된 접근 가능 탭으로 이동할 수 있다.
- forced visual release는 Main presentation에 degraded 신호로 전달된다. 아직
  완료되지 않은 First Vision은 `PRESENTED`/`SPENT`로 기록하지 않고 `DEFERRED`
  current scene으로 전환하여 다음 healthy boot에 남긴다.
- boot prewarm snapshot은 startup 가속/진단 입력일 뿐이다. unavailable/slow/rejected 상태는 모든 build profile에서 optional diagnostic으로 기록하고, `bootManager.js`는 `prewarmSnapshot: null`로 preference/protocol 초기화를 계속한다.
- background cold start 중 prewarm/analysis bootstrap read는 full service init을 기다리지 않는다. `BackgroundBootstrapCoordinator`가 stats cache, cycle state, settings cache, CLSE bootstrap settle과 prewarm 시작 뒤 dashboard boot-read milestone을 열고, `BackgroundMessageRouter`는 두 read action만 이 milestone으로 gate한다. bookmark sync, nudge recovery, managed content-script catch-up, alarm/focus recovery는 이 gate의 선행조건이 아니다.
- prewarm transport/response/schema 실패는 optional이지만 silent unavailable로 축약하지 않는다. dashboard client는 `BOOT_PREWARM_REQUEST_TIMEOUT`, `BOOT_PREWARM_REQUEST_FAILED`, `BOOT_PREWARM_RESPONSE_*`, `BOOT_PREWARM_SNAPSHOT_INVALID` 중 하나를 telemetry/error에 보존한다.
- Explicit terminal main visual first-frame failure는 storage/protocol/core boot failure와 분리한다. 실패는 `errors`, trace, telemetry에 남기되 visible shell을 막는 fatal boot state로 승격하지 않는다.
- React-only loader component가 존재하더라도 dashboard visible boot path로 간주하지 않는다.
- React boot loader module과 visible boot shell module은 분리하는 것을 기본으로 한다. 같은 구현을 공유해야 하면 React module이 boot shell module을 import/re-export할 수 있지만, dashboard visible boot path가 React module을 import하면 안 된다.
- custom shell이 transient render loop나 listener를 만든다면 shell element에 `__entropyBootShellDispose()`를 attach할 수 있고, dashboard shell lifecycle은 DOM removal 직전에 이를 호출한다.

## Explicit Non-Goals

- cross-theme boot fallback
- dashboard app 내부의 theme별 special-case DOM builder
- storage mirror/debug cache를 별도 boot source of truth로 취급하는 것

## Current Notes

- `ThemeLoader.jsx` 같은 미사용 React boot wrapper는 dashboard canonical path가 아니므로 제거한다.

## Dev Diagnostics

- Dev builds expose `BootDiagnosticsLab` under the Experiment tab. It reads the current `bootManager` snapshot, dev `bootTelemetry` report history, and Zen trace history as diagnostic evidence only.
- Heavy boot tracing is one-shot and should be activated through the Experiment tab's reload diagnostics action. Do not arm long-lived boot tracing as part of normal dashboard startup.
- `dashboard/boot`는 probe 비용 대조를 위해 `full`, `marks`, `off` trace mode를
  명시한다. `marks`는 event/timestamp만 보존하고 console을 쓰지 않으며, `off`는
  trace를 만들지 않는다. 성능 측정 기본값은 `marks`이고, 어느 모드도 boot
  readiness source가 될 수 없다.
- Entry stage event는 `dashboard_entry:stage_import:<stage>:<phase>`의 bounded
  identity를 사용한다. 따라서 `marks`가 details를 제거해도 QA는 동일 stage의
  start/ready elapsed 차이로 duration을 복원하며 null stage를 허용하지 않는다.
- The boot release gate is `bootManager` state, not trace or telemetry. State commits for `themeReady`, `coreReady`, and especially `mainTabFirstFrameReady` must complete before any heavy diagnostic trace/storage side effect can run.
- First-frame trace payloads must stay compact. Raw pond/bonsai/scanner runtime metadata can be passed to the runtime owner, but trace/telemetry history should keep only timing, readiness, and renderer summaries through `src/apps/dashboard/bootstrap/mainFirstFrameDiagnostics.js`. That seam is diagnostic-only and must not decide readiness.
- `bootTelemetry.dev.js` may persist a short-lived local `entropy_debug_dashboard_boot_report_history` record so reload-only boot failures remain copyable after the dashboard becomes usable. This is a debug artifact, not a boot source of truth.
- The lab separates copy targets for summary, timing, errors, state, trace, and full JSON. Use this to distinguish background/prewarm pressure, core init duration, and main first-frame/pond worker failures before changing boot timing.
- Boot prewarm pressure includes both the dashboard request duration and the background snapshot diagnostics under `prewarm.payload.diagnostics`: `build` records settings/theme/analysis/CLSE substep timings, while `delivery` records cache-hit/in-flight/build mode for the dashboard request.
- The main-frame copy target isolates the `core_ready -> main_frame_ready` window, lazy tasks overlapping that window, long tasks inside the same boot-relative window, and first-frame trace milestones for pond/bonsai readiness.
- `bootShell.js`는 visible shell mount 후 정상적으로 두 frame을 양보한다. rAF가
  정지하면 bounded initial-paint liveness timeout으로 같은 single-settlement gate를
  통과시켜 dashboard entry import가 영구 정지하지 않게 한다.
- shell dismiss는 boot data gate와 별개로 최소 표시시간을 보장할 수 있으며, 실제 shell removal 시 loader visibility telemetry를 닫는다.
- Main hydration에 필요한 analysis initialization은 prewarm handoff 직후 preference/protocol과 함께 시작한다. `coreReady`는 계속 preference/protocol만 소유하지만 Main readiness가 필수 analysis를 뒤늦게 직렬 시작하지 않는다.
- Boot 중 실제 render target은 `main`이므로 critical surface warmup도 Main chunk/widgets만 소유한다. Persisted/deep-link target과 idle preload는 Main first-frame 뒤 deferred warmup으로 이동한다.
- Zen Main은 pond + bonsai + first viewport의 composite ACK를 요구한다. Non-Zen Main은 tab-root readiness 뒤 실제 Home workspace post-paint commit을 별도 ACK로 사용한다.
- Build chunking pins only the low-level modules shared by the visible shell into `dashboard-boot-low-level`; background kernel chunks must not enter the dashboard HTML entry's static closure. `check:dashboard:boot-artifact-contract` verifies this against the built Vite manifest.

## Boot presentation completion and post-release admission (2026-09-07)

- `bootEnsoPresentation.js` owns the two-tier Zen playback policy. After the
  synchronous paper shell paint, it reads `DashboardBootPresentationStore`
  asynchronously. No localStorage mirror is added. An absent record explicitly
  means this browser session has not completed this presentation.
- Every playback draws the canonical **open practice stroke** until the worker
  reports `stroke_complete`: 3300ms for the first completed presentation of the
  browser session, 2200ms for subsequent visits. Both include the 360ms brush-head
  hold; exit fade is separate. This is a session policy, not cache-temperature
  measurement. Browser restart or extension session reset starts the longer
  presentation again. Concurrent first windows may both use 3300ms; interrupted
  strokes do not mark completion.
  Stroke completion is independent of renderer first-frame readiness and the
  three business/visual boot gates. Reduced motion completes statically.
- `bootShellRendererContract.js` owns the optional completion Promise. Healthy
  dismissal waits for completion, while failed/degraded/hard-timeout release
  remains bounded and does not fabricate readiness. The 18-second hard timer
  stays armed while waiting for presentation. Completion never closes the circle.
- Completion writes `{ version: 1, ensoCompleted: true }` monotonically through
  the typed `chrome.storage.session` store. Read/write failures emit explicit
  renderer diagnostics. This is a presentation receipt, independent of First
  Vision progression. Full reset clears it; export/import does not transport it.
- `ZenSoftBootShell.worker.js` keeps its stroke clock/progress across resize,
  ignores identical dimensions, and emits completion once. Scoped boot CSS is retained once per document so removing the shell does not remove a global stylesheet. The shared renderer
  skips unchanged ink composites; both existing blur halos remain intact.
- Noncritical boot warmup waits for a clean **shellDismissed** snapshot, then
  `bootIdleAdmission.js` requires 1200ms of input quiet and a real idle slot.
  Pointer/key/wheel/touch input and visibility changes restart the quiet clock.
  Initial admission expires after 12 seconds; each wave retains its own hard
  wall-clock deadline. Every speculative entry rechecks admission, with one
  entry in flight. Deadline expiry skips work, never forces an import. Existing
  timer degradation is limited to environments without requestIdleCallback.
  Intent-driven navigation retains its separate immediate preload path.
- `dashboard/boot` observes the first 1000ms after actual shell dismissal.
  Dismissible is still the original duration endpoint; post-release long tasks
  and rAF gaps are reported separately and are not GPU timings.
