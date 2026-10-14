# Visual Capture Harness

- Status: Active
- Owner: QA operations, app composition
- Last validated against code: 2026-10-13
- Path policy: current-only
- Canonical for: deterministic development-only page and component capture workflow
- Companion to: `docs/operations/qa/entropy-qa-control-plane.md`

## Purpose

`visual/feed/shortform-{desktop,mobile,clip,dulled}` renders the actual feed app's
short-form view. Readiness requires decoded original video, all inactive videos
paused and a fitting vertical surface. Desktop admits normal motion and
requires real muted playback advancement; other variants use reduced motion.
The dulled variant advances to a later slot and returns to the first, requiring
friction to remain. Scene-owned navigation is deterministic setup, not trusted
wheel/touch proof. Model tests cover burst grouping and actual app tests cover
source ownership, pause/resume, modal suspension and retained route state.

`visual/feed/landing-desktop` (1440 × 1000) and
`visual/feed/landing-mobile` (390 × 844) render the actual standalone
`src/apps/feed-landing/FeedLandingApp.jsx` with its normal in-memory repository.
Both use reduced motion, the page's own styles and local fonts, and no extension
runtime or stored profile. Readiness requires actual feed content and horizontal
viewport fit. These initial-screen captures prove presentation, not trusted
pointer interaction or the standalone Vite output. Focused
`tests/feedLandingExperience.test.jsx` checks the real app's reaction, comment,
share, bookmark and declarative endpoint flows; the separate feed-landing build checks
the standalone entrypoint. Use the existing finite visual server and run-owned
headless browser; no live preview server is needed.

`visual/feed/landing-horizon` prepares the actual page at its endpoint and
requires accumulated friction to reach its horizon phase and a declarative
Horizon without controls. `visual/feed/landing-reflection` continues to the
afterword and requires its comparison and install action.
`visual/feed/shortform-ending` pages the short-form viewport to its final slot
and requires accumulated friction, a Horizon without controls and the afterword
comparison. Their scene-owned
scroll preparation is deterministic presentation setup, not trusted-input proof.

`visual/zen/type-and-ink-{en,ko}-{day,night}` renders the production rhythm
marker, all three Pressure readiness states, growth reveal card, Lens controls
and history/bookmark review sheets. It installs the canonical ambient projection
for fixed Seoul noon/night epochs and real locale resources. Admission verifies
local Korean serif loading without changing the UI face, the 11px text/12px
control floors, horizontal fit and unclipped controls, at least 4.5:1 small-text
contrast on the computed solid backgrounds, keyboard focus and reduced-motion
placeholder behavior. This contrast check does not sample gradients or renderer
pixels. `-ko-day-motion` uses
normal motion. The growth card shares its production presentation without its
timer or acknowledgement writes; review actions are inert fixture callbacks.
These are component-presentation evidence, not full Dashboard runtime evidence.

`visual/artifacts/tab-management-zen`, `-zen-narrow` and `-matrix` render the
production Barrier card's grouping and protected-tab budget controls through the
actual theme dock. The fixtures keep grouping and budget edits independent and
admit readiness only with a numeric control and no horizontal overflow. These
captures verify layout; they grant no extension permissions and claim no native
tab-group or Gate runtime behavior.

`visual/guidance/installation-<theme>` captures the production
`FurinInstallationPresentation` for each of the six canonical themes with a
declared 60-minute render fixture. Reduced motion provides a deterministic
installed frame and explicit completion control. The Zen `-motion` scene uses
the production visible clock and signals readiness only after the actual
nine-second sequence, leaving its returned frame available for capture. These
source scenes run no Guidance commands, protection admission or settings
writes; their images prove presentation composition only.

The visual capture harness renders production UI through Vite transforms, captures it in Chromium, writes diagnostics and images, and shuts down automatically. It removes the need for a full extension build or a manually managed live server when the target is a render-only page or component scene.

This is a capture and inspection surface. It is not a pixel-golden test suite and it is not a replacement for real MV3 runtime verification.

`dashboard/boot` additionally retains each exact owned page through shell removal
and its first 1000ms of exposed UI by default (`--post-reveal-ms` permits at most
120000ms for idle Zen without Chrome render tracing). `dashboardBootPostRevealProbe.mjs` installs a
bounded long-task observer before navigation, records overlapping long tasks and
rAF gaps from the canonical `shellDismissed` event, and releases the page only
after that observation. Boot-terminal duration keeps its existing endpoint; the
post-reveal window is separate evidence. rAF gaps are page scheduling observations,
not presented FPS or GPU time. Missing/hidden/truncated observation is an explicit
failure; zero tasks is never manufactured from unavailable evidence.
The same document-start probe records its first native rAF callback and bounded
visibility changes. A post-reveal timeout preserves that observation with the
current document visibility/focus in `sourceDiagnostic`; absent frame delivery
must not be attributed to renderer CPU work without further evidence. The probe
does not activate targets, focus windows, emulate visibility, or synthesize frames.

The temporary server enters the exact `entropy-visual-harness` Vite mode. That
mode reuses the repository's source aliases, build-profile definitions, React
transform, and Pixi safety shim, while excluding the CRX manifest/serve plugin
and every extension output plugin. Starting or stopping visual capture must not
create, empty, or rewrite `dist`, `dist-prod`, or another extension artifact
root. The visual harness has no authority to produce an unpacked extension.

Named `visual_capture` QA runs admit two simultaneous captures through the
process-held `shared_capture` project slots. The compiler scopes the read-only
source/runtime claims and owned `visual` broker to each run while preserving
the declared environment. Admission occurs before server startup; a third run
is BLOCKED with `QA_BROWSER_CAPACITY_BUSY`. Other owned browser workloads reserve
both slots exclusively; persistent profiles retain their CDP/user-data-root
locks. Each server owns a UUID cache under `.artifacts/visual-harness-cache`
and removes it after successful server close, without a shared optimizer writer.
The pipeline retains its slot through browser and server cleanup; Playwright
only borrows the private matching project reservation. Concurrent screenshots
prove rendering, not performance. Legacy batch and custom research stay exclusive.

The named mode declares `optimizeDeps.entries` as
`src/apps/visual-harness/main.jsx` as its common root. The finite server supplies
that root plus the selected scenes' real source module paths, derived from the
same catalog used by Node discovery. It does not scan the extension's Rollup
entry set or unselected catalog implementations. Dependency include/exclude
lists, automatic discovery, aliases, other modes and extension build inputs
retain their existing contracts; startup deadlines are unchanged. The finite
server owns only its isolated optimizer cache and exact cleanup.

The catalog owns each validated `sourceModule` and optional named `sourceExport`.
Node list/get/load APIs retain all scenes, including shared-module aliases and
named exports. `visualHarnessSelectedScene.mjs` generates one selected virtual
entry from that catalog declaration, containing the validated manifest and a
literal import of only its implementation. The shared browser boot module does
not import the catalog. It installs the existing runtime before loading that
implementation, then preserves prepare/render/readiness and error publication.
Unknown or unadmitted scene ids, non-owned source paths and entry/document
identity mismatches fail explicitly; URL input never supplies a module path.
Navigation/readiness deadlines, output isolation and cleanup are unchanged.
Removing the full catalog from the source graph is a work reduction; startup
latency and capture acceptance still require a fresh canonical run.

The finite server starts public `transformRequest` concurrently for a finite,
deduplicated set: the common boot module, admitted real scene modules, their
actual selected virtual HTML entries and the injected `/@vite/client`. It settles
every transformation, then awaits public `waitForRequestsIdle`, before returning
to the browser owner. It does not use the error-swallowing warmup API,
retry navigation or widen readiness deadlines. A missing transform or native
transform/idle failure closes that exact server and propagates the original
error; a close failure preserves both causes. `source-admission.json` in the
existing visual output root records the finite selected IDs, transformed roots,
server initialization, root transformation, static-import idle and total
admission durations. Returned reports include the same bounded receipt. This
is source-server preparation, not product boot or rendering performance; static
import idle is Vite's first static-crawl boundary; it does not certify that all
optimizer metadata commits, later imports, shaders or GPU execution have finished.

## Owner Map

| Concern | Canonical owner |
| --- | --- |
| Scene identity, source module/export, viewport, locale, theme, browser preferences, capture targets | `src/apps/visual-harness/sceneCatalog.js` |
| Scene validation and manifest shape | `src/apps/visual-harness/visualSceneContract.js` |
| Browser render composition and readiness publication | `src/apps/visual-harness/main.jsx`, `src/apps/visual-harness/VisualHarnessApp.jsx` |
| Selected browser entry and selected optimizer source roots | `scripts/dev/visual-harness/visualHarnessSelectedScene.mjs` |
| Explicit fixture theme DOM initialization | `src/themes/core/documentThemeProjection.js` |
| Production component inputs and explicit visual fixtures | `src/apps/visual-harness/scenes/**` |
| Public target invocation and evidence envelope | `scripts/qa/entropyQa.mjs`, `scripts/qa/protocols/visualCaptureQaProtocol.mjs` |
| Capture engine and legacy batch CLI | `scripts/dev/visual-harness/captureVisualScene.mjs`, `scripts/dev/visual-harness/visualHarnessCli.mjs` |
| Temporary loopback Vite lifecycle and extension-output isolation | `scripts/dev/visual-harness/visualHarnessServer.mjs`, `scripts/dev/visual-harness/visualHarnessViteContract.mjs`, `vite.config.js` named visual-harness mode |
| Chromium launch, display/GPU probe, mute, and repository-wide capacity | `scripts/qa/browser/qaPlaywrightBrowserOwner.mjs` |
| Chromium readiness, screenshots, and browser diagnostics | `scripts/dev/visual-harness/visualSceneCapture.mjs` |
| Source-state and report serialization | `scripts/dev/visual-harness/visualHarnessReport.mjs` |
| Generated output | Entropy QA: `.artifacts/qa/runs/<run-id>/attachments/visual/<scene-id>/**`; legacy batch: `.artifacts/visual-harness/<scene-id>/**` |

The harness applies each declared fixture theme through the named DOM-only
`documentThemeProjection.js` seam. It validates the exact canonical ID and
projects the production catalog's attributes, CSS variables and custom CSS
without loading preference/settings storage, reading a stored theme, writing a
mirror or publishing a preference event. Product preference-aware initialization
retains its existing `documentTheme.js` API. This removes an irrelevant static
settings dependency from source-render startup; it does not establish the cause
of earlier slow transforms or change navigation/readiness bounds or verdicts.

`visualSceneCapture.mjs` records bounded source-startup evidence in
`capture.json` at `diagnostics.sourceStartup`. It tracks script and stylesheet
requests only from the exact loopback harness origin and declared source/Vite
paths, with query/hash removed and paths capped at 240 characters. At most 64
rows are retained: new requests evict the oldest settled row; a full set of
pending requests records an explicit omitted count. Observed and evicted counts
remain visible. Rows report monotonic start/finish offsets and pending or settled
age, distinguishing unfinished module loading from failed requests.
On capture failure the existing public runtime read also records
`document.readyState` and `runtimeRead` (`available`, `missing`, or `failed`).
A failed read retains only bounded error name/code/message (80/120/512
characters), without stack or page contents; it is never reported as an absent
runtime. This evidence is observational: no additional navigation, retry,
deadline, browser focus, CDP, or server path is introduced. The original failure
and exact-owned context cleanup remain authoritative.

The Global Sentinel sequence/rift and Room 478 sequence/mobile scenes use the
existing 60-second source navigation/readiness maximum. Repeated native Windows
captures reached the 30-second navigation deadline without an available runtime
observation; the diagnostic run also preserved a destroyed execution context
while the new document was still navigating. The allowance bounds source-server
and document preparation, not the product's 18.5-second entry, 4.8-second Room
arrival, or 54/60-second game policy. The shared maximum, readiness predicate,
blocking browser diagnostics and cleanup requirements remain unchanged.

## Detour spread reveal captures

The detour-spread gate scenes preserve the submit reveal contract: ordinary
selected/first-use/rail captures show the sleeping white core. Named
`gate/detour-spread-opening` and `gate/detour-spread-opening-narrow` seek 320ms
into the existing 1600ms submit presentation, including the short white-core
afterimage and the delayed sector of the opening boundary.
`gate/detour-spread-closing` and `gate/detour-spread-closing-narrow` seek 760ms to show seat-aligned inward folds and
the luminous tab shells after their information dissolves;
`gate/detour-spread-ember` captures the returned core. The fixture
commits the production animations at the declared frame before cancellation;
it adds no product timer, background-command delay or browser owner.

## VideoSkip feedback

The retired Mirage overlay and its three source-render scenes have been removed.
VideoSkip keeps its canonical seek/speed enforcement and frame pulse. Blocked
video and short-form actions share one brief factual reason beside the compact
page indicator; no full-screen reveal or separate banner is mounted. Runtime
manager tests own enforcement and duplicate-feedback suppression.

## Popup design captures

The `visual/popup/protected` target retains the English baseline. The Korean
`visual/popup/protected-ko`, `visual/popup/effects-ko` and
`visual/popup/isolation-ko` targets use the same production PopupPage and
common-only locale resources at 520 × 360. Effects opens the production
control before readiness; isolation uses a declared open-picker fixture.
The Korean scene deadline is 30 seconds to admit cold Vite navigation observed
to exceed 10 seconds on native Windows; it is not a product boot performance
threshold. These captures prove rendering only, not special-session persistence.

## Commands

For an explicitly requested interactive preview, `npm run visual:preview --
zen/bonsai-first-bloom` holds one admitted source scene through the existing
`visualHarnessServer.mjs` owner until Ctrl-C. It prints its exact loopback URL
and writes a small source-admission receipt under `.artifacts/visual-preview`.
Open that URL through `npm run qa -- browser page authenticated --url=<printed-url>`;
the canonical operator-page owner performs the single initial presentation and
hands the tab to the human. The preview launcher never starts or controls a
browser. Keep the server running while the human uses the preview.

`zen/bonsai-first-bloom` presents a mature in-memory specimen using the production
Plume plan, Pixi renderer, five-region partition, first-bloom playback and native
Dashboard bud targets. Its local restart recreates only the fixture. It neither
claims the real first-bloom milestone nor reads/writes progression storage. The
fixed specimen uses seed 151, the established Plume research/regression example,
at healthy day-five full activation and midday. It does not select a tree from
personal preference records; the original reroll research explicitly describes
151 as an entry example rather than a preferred silhouette. The theme-owned
presentation is exposed only through the development preview seam
`src/themes/plugins/zen/api/bonsaiFirstBloomPreview.js`; ordinary runtime callers
must retain the lightweight `bonsaiFirstBloom.js` contract. Source preview checks
appearance and interaction, not Dashboard boot admission, durable claims or worker
integration. Named render captures retain the declared `visual` environment and
their ordinary cleanup; manual preview does not issue a product QA verdict.

Schedule uses `visual/schedule/selected`, `start-focused`, `narrow`, `wrapped`,
`empty`, `invalid`, `matrix`, `options`, and `options-narrow`. `ScheduleEditorScene` renders the production
rhythm workspace, timeline, workbench and utility controls with explicit in-memory
fixtures. The focused and invalid scenes prepare the production input before
readiness; controls are checked against the viewport for clipping. These scenes
verify presentation and geometry, not extension storage or runtime protection.
Controller/editor tests own atomic editing, cancellation, deletion and undo.
The options scenes open recurring-isolation options through the production
disclosure and check that its anchored surface fits the declared viewport.
Notification controls use explicit in-memory fixture state without invoking
extension permissions or settings storage.

`dashboard/capture --surface=schedule` captures the built Schedule tab in the
declared disposable `ephemeral` browser. Preparation commits explicit weekday
and weekend windows through acknowledged `SET_SETTINGS`; it selects a real block
through its production control before capture. Evidence includes editor geometry,
full-height window hit areas and viewport clipping checks. Named viewport and
resize options retain the ordinary dashboard lifecycle and cleanup owners.

Detour gate captures use a 60-second source-navigation/readiness bound, including
the Korean selected, narrow and transfer scenes. Native Windows cold Vite module
loading exceeded both 10- and 30-second navigation bounds in repeated captures;
this is harness startup allowance, not a gate product performance threshold.
The transfer fixture clicks the production selection control and preserves an
inert copy of its committed animation frame before production cleanup releases
the live ghost. Closing and ember fixtures retain the 1600ms product timeline.
First-use, first-use-ready and first-use-narrow scenes project an explicit false
pruning completion receipt into the production surface; selected and rail scenes
project true. These captures verify the short guidance and below-body action
placement, not durable completion. Controller and typed-store tests own the
successful-close criterion, restart persistence and reset admission evidence.

Settings uses the `visual/settings/records`, `records-dark`, `records-narrow`,
`workspace`, `setup`, and `setup-custom-narrow` component targets. They render the production
Settings shell, general/recording controls and setup dialog with explicit in-memory
fixtures; no settings, site or browser-permission mutation is performed. Record
and custom-setup details are expanded through their production disclosure
controls before readiness. These captures verify presentation and horizontal
overflow, not MV3 persistence or runtime observation admission. Workspace uses
an explicit in-memory analysis-store reset-policy fixture and a fixed daylight
reference; no store initialization, save action or transport is invoked.

The independent brush targets `visual/zen/enso-research` and
`visual/zen/enso-research-retina` use a thin scene adapter to the development-only
workspace `scripts/dev/zen-enso-research`. They compare the canonical Canvas2D
Enso with two experimental painters, emit bounded timing/pixel evidence and
capture the review UI. This explicit research import is limited to the visual
harness; product entrypoints must not import the workspace. The owner contract
is [Zen Enso Research Workspace](../../architecture/themes/zen/zen-enso-research-workspace.md).
These targets do not measure GPU time, actual extension boot, or aesthetic quality.

`visual/zen/bonsai-development` exercises the D1 development-only G15 lab in a
same-origin iframe. The QA server's `servePinnedG15Research.mjs` mounts only the
preserved G15 workspace under `/__zen_g15_research/`, serving source bytes without
Vite rewriting so the lab's source/bundle verifier remains authoritative. It
starts no additional host and writes no extension artifact. The scene checks
  one responsive ending control, ending-mode transitions, neutral A/B, factor enable/edit, exact-version URL replay, pinning, common seed,
eight-seed cohort, wood/full rendering and horizontal overflow before capture.
The local-ending/local-branching modes and finite upper-run diagnostics are
  included in the same user-flow check; no pixel threshold certifies naturalness.
  The child-planned/child-budgeted experiment additionally checks both mode
  transitions, nonempty child-cost receipts and viable child births in the named
  fixture. It returns to local-branching for the full factor/cohort flow; this is
  not a full aesthetic or performance acceptance of the new cost-planning modes.
  D1 v3 also exercises scaffold/branch retention and fork carry controls, verifies
  that each reaches the factor trace, and checks committed retention receipts
  belong to ordinary growth rather than funded terminal plans. Native cohort
  evidence owns cross-seed ending failures; browser PASS certifies this UI flow.
  The V3 flow is the separate named `visual/zen/bonsai-length-allocation` target;
  the established twelve-mode/replay/cohort flow retains its own target. Both
  obey the shared 60-second readiness maximum. The focused V3 target uses a
  240-event fixture for control application and replay, while native research
  runs own the 960-event ending evidence. No shared timeout guard is widened.
The 60-second readiness bound admits source verification and these bounded
worker generations; it is not a product startup target. Download/clipboard and
the aesthetic quality of specimens are outside this browser-flow evidence.
See [G15 research workspace](../../architecture/themes/zen/zen-g15-research-workspace.md).

List scenes:

```bash
npm run qa -- list --family=visual
npm run qa -- list --family=gate
```

Capture one scene:

```bash
npm run qa -- run visual/zen/tomeishi --mode=agent
npm run qa -- run visual/zen/pressure-dock --mode=agent --presentation=hidden
npm run qa -- run visual/zen/pressure-dock-retina --mode=agent --presentation=hidden
npm run qa -- run visual/sentinel/site-furin-sequence --mode=agent
npm run qa -- run visual/sentinel/global-sentinel-sequence --mode=agent
npm run qa -- run visual/popup/protected --mode=agent
npm run qa -- run gate/detour-spread/render --mode=agent
```

The dashboard main tab is intentionally not a page scene in this harness. Its
composition depends on the extension service worker, progression/settings
owners, the pond worker, the bonsai worker, and the dashboard first-frame
handshake. Use `npm run qa -- run dashboard/capture --mode=agent --surface=main`
instead. That target owns an ephemeral dev extension and accepts independent
`--koi-state`, `--bonsai-state`, `--appearance-time`, `--weather`, and
`--pressure-state` (`collecting`, `ready`, or `no-pressure`)
presentation inputs while preserving those runtime owners. The visual harness
must not replace them with an undeclared page fixture. Dashboard capture opens
one owned page session before navigation so `dashboard-boot.json` can retain
startup console warnings/errors, uncaught exceptions, resource-load failures,
navigation/resource timing, the dashboard boot snapshot, development boot
telemetry, and one isolated capture-only Zen boot trace. A degraded or
forced-release dashboard can therefore preserve its
screenshot while the named target still returns `FAIL`; final DOM readiness is
not treated as proof of a clean boot.
Use `dashboard/boot` instead when the question is launch performance rather
than composition. It reuses the same extension/browser protocol but omits
screenshots and visual settle time, and records one cold plus bounded warm boot
samples with artifact-closure and performance checkpoints. Before measurement,
the protocol prepares an isolated security vault through the public Dashboard
runtime routes. `securityVaultQaFixture.mjs` creates one canonical harness-owned
preparation tab, disables that tab's page scripts, and blocks all non-document
asset requests before navigating to the exact Dashboard URL. Fresh canonical
status admission returns automatic local keys without an app passphrase or
setup command; only an explicitly wrapped fixture uses its supplied phrase to
unlock. The fixture never writes key/session storage directly. It leaves for
`about:blank` before restoring the tab's script/network settings and closing it.
The first measured cold sample therefore remains the first Dashboard application
execution and asset load in that browser; the preparation document itself and
background/settings initialization precede measurement. Warm samples keep the
existing same-browser meaning. Fixture receipts include state, mode and operation,
never the passphrase, wrapped envelope, or session keyring. Attached, persistent,
foreign-profile and incompatible profiles are rejected rather than reset.
Each boot sample also records a bounded exact-session CPU self-time summary so a slow launch can
be attributed to a function and built chunk without retaining an unbounded raw
profile. Pass `--cpu-profile=true` for that diagnostic rerun; it defaults off for
representative cold/warm timing and is never enabled for `dashboard/capture`.

`visual/zen/pressure-dock` and its 2x device-scale companion
`visual/zen/pressure-dock-retina` are component-only fixtures, not Main page substitutes.
It imports the production `ZenHomePressureDock`, composition-frame resolver, and
registered PressureRail widget with explicit pressure/rectangle inputs. Wide,
portrait, long-domain compact, and height-constrained specimens check that the
action (including focus clearance) stays in the safe host, details do not
overflow horizontally, and the readout and data area remain flush/aligned.
The 80% and 96% dominant-pressure specimens additionally exercise the 32 CSS-pixel
segment floor, total-width conservation, and 24px favicon clearance. A local
synthetic 16px/64px raster pair shows the former framed 18px presentation beside
the unframed 24px presentation. This pair verifies raster presentation, not the
native resolution available for a real domain in the browser favicon cache.
It does not claim pond/bonsai Worker, full Home stacking, or first-frame evidence;
those still belong to `dashboard/capture`.

`visual/zen/enso-gate` captures the production Barrier consumption boundary: one desktop composition and four native-scale states (armed, drawing, leave-ready, enter-ready). Scripted input uses the current lateral gesture; no circle, ink resume or sakura outcome remains. This is render-only evidence, not proof of production cadence admission or pointer feel. `visual/artifacts/lens-strength-{zen,zen-narrow,matrix}` captures all five independent strength controls and rejects missing sliders or horizontal overflow.

Capture every catalog scene with one temporary Vite server and one Chromium process:

```bash
npm run visual:capture:all
```

The batch command remains a legacy engine convenience while individual target
invocation, resource serialization, and standard evidence are owned by Entropy
QA. New automation should call the canonical targets.

Entropy QA browser presentation:

```bash
npm run qa -- run visual/zen/tomeishi --mode=agent --presentation=foreground
npm run qa -- run visual/zen/tomeishi --mode=agent --presentation=hidden
```

The named QA target defaults to a hidden, automatically started, muted
owned browser for repeated/offscreen capture. `foreground` is an explicit
headed presentation. Legacy `--headed` and `--headless` flags are translated at the public
control-plane boundary. The standalone `visual:capture:*` batch CLI retains its
own legacy defaults because it is a lower capture-engine entrypoint, not the
browser policy owner.

The shared Playwright owner acquires the same process-held browser-capacity slot
used by the extension, CWS, and research harnesses. It applies the resolved
display environment, muted audio, and the shared GPU classifier before capture.
A concurrent browser owner fails as `QA_BROWSER_CAPACITY_BUSY`; Entropy QA
reports that environment condition as `BLOCKED`. The slot and any managed Xvfb
are released after Chromium and Vite cleanup, and the operating system releases
the capacity endpoint automatically if the runner process dies. The runner
never closes a pre-existing personal or authenticated QA Chrome.

Foreground capture requires a real host display and never silently moves to
Xvfb. Explicit `hidden` capture is headless and remains the offscreen choice for
repeated runs. The capture report records the display backend and GPU
classification; headless, Xvfb, SwiftShader, or unclassified evidence is not a
physical-GPU certification.

The runner always closes Chromium and Vite after capture. A failure returns a non-zero exit code and preserves `capture.json`, `debug.html`, and `debug.png` when the browser produced them.

The named Vite-mode selection is guarded by
`tests/visualHarnessViteIsolation.test.js` and
`npm run check:qa:architecture`. The test resolves the real root Vite config
and proves that visual serve contains no `crx:*`, extension-output-isolation,
artifact-inventory, or manifest-finalize plugin, while ordinary development
serve retains those owners.

The Sentinel filmstrips are executable render fixtures, not hand-painted phase
mocks. Site Furin composes the production `NudgeOverlayHost`,
`createZenFurinPresentation`, and `SiteFurinReflectionView` with the pure
chime-state functions for arrival, awaiting Catch, and reflection. Its committed
facts are synthetic fixtures and its visible frames advance deterministically;
it does not instantiate a koi school or prove production admission, media hold,
or lifecycle receipts. Global Sentinel uses the production engine plus
`SentinelProtocolSessionController` for the starter and follow-up hits.
Its 32-state filmstrip follows the canonical 18.5-second entry from
`GLOBAL_SENTINEL_ENTRY_STAGES`: paired messenger
and shadow, independent shadow departure, partial panel collapse, blackout,
false calm, readable giant silhouette, overwhelming scale, and fixed-origin
recovery. It then captures one protocol-owned repair contact through approach,
lock, and active-window frames, including one intentionally missed window in
the bounded `miss-seal` repair frame. Discovery, `system-surge`, and
`final-decision` advance relative to actual accepted actions rather than a
second filmstrip beat schedule. The production aftermath clock continues
through `final-fracture`, `reverse-recall`, `repair-seam-annulment`, and the
quiet `terminal-banish` surface, then the complete terminal hold elapses before
`rift-unfold` and `rift-ready`. These last two frames explicitly retain zero
live actors and the won fracture. A separate
independent production engine/session advances to its canonical expiry and
failure terminal before rendering `failure-resync-closure`; the losing-state
comparison is executable rather than a hand-authored renderer snapshot.
Success never closes the won crack: the Sentinel dissolves and the original
fracture remains while the world acquires depth. The success fixture refuses
readiness unless the production aftermath phase, impact serial, terminal-hit
flag, and progress match each requested frame; its canonical final aftermath
must end on an open fracture, then the fixture advances to the session's exact
integer `readyAtMs` boundary before starting terminal banish. The second impact
also exercises an off-centre accepted point through the semantic integration
seam and asserts that impact and actor-source coordinates differ; physical
pointer proof remains owned by the attach-only runtime target. The Global
fixture injects a deterministic engine clock and binds the whole synchronous
render fixture—including koi internals—to one seeded random source; consecutive
Global captures of unchanged code therefore produce the same PNG bytes.
The Global filmstrip evaluates the whole composition in a fixed 1280 × 720
representative desktop coordinate space, then CSS scales each canvas into its
16:9 evidence card. This preserves production-relative actor, wake, fracture,
success-annulment, and failure-closure geometry; the card's displayed size is
not a 1:1 CSS-pixel size assertion. Site renders its real DOM/SVG in three
height-bounded specimen cards, not the Global canvas coordinate space.
Global engine initialization or protocol-progress drift fails before `signalReady`.
These scenes prove deterministic rendering only. Use the named
`sentinel/*/runtime` targets for extension messaging, Global's selected frame
worker, Site's presented-visible clock and choice lifecycle, real pointer/semantic
input, and attach-only QA-profile evidence.

## Scene Contract

The Zen comparison targets `visual/zen/artifact-collection` and
`visual/zen/artifact-collection-retina` extend the first two artifact-engine
targets to Enso, TomeIshi, Ishidouro, Furin and ShishiOdoshi. They require WebGL,
capture canonical presentation references beside retained candidates, and
check bounded cache eviction, reuse, idle suspension and disposal. GPU timers
cover the candidate renderer only. Frozen secondary effects and water/material
approximations are documented in
`docs/architecture/themes/zen/zen-artifact-engine-review.md`; a named capture
PASS is not visual equivalence or production gallery certification.

`visual/zen/artifact-engine` and `visual/zen/artifact-engine-retina` compare the
Shoji CSS and GreatWave SVG widgets with one retained Pixi renderer at DPR 1/2.
Both require WebGL. The fixture measures each backend separately before static
capture, checks warm resource reuse, stale admission, idle stop and disposal,
then emits `ZEN_ARTIFACT_ENGINE_REVIEW` JSON into the captured console evidence.
Page rAF intervals do not measure presented FPS or whole-browser CPU usage;
GPU timer samples cover the candidate renderer only. This is component evidence,
not a Tools-tab performance verdict. The full contract lives in
[`zen-artifact-engine-review.md`](../../architecture/themes/zen/zen-artifact-engine-review.md).

Every catalog entry explicitly declares:

- a lowercase path-style scene id;
- `component` or `page` kind;
- locale and optional canonical theme id;
- viewport, device scale factor, reduced-motion preference, and color scheme;
- a readiness timeout;
- one or more named viewport or selector captures;
- one module loader.

Every scene module default-exports a validated implementation with:

- a React `Component`;
- an optional asynchronous `prepare` function.

The component receives `signalReady`. The runner will not capture until the scene calls it. Font loading, image completion, and two animation frames are awaited after that signal. Selector captures require exactly one visible match.

Scene copy must use a locale whose glyphs are reproducible in the pinned Chromium environment. A locale that depends on an undeclared host font is not a valid deterministic scene; bundle or explicitly provision the font before adding that locale variant.

## Failure Contract

The following are hard failures:

- an unknown or malformed scene id;
- an invalid viewport, theme id, browser preference, or capture declaration;
- scene preparation or React render failure;
- readiness timeout;
- selector cardinality other than exactly one;
- browser console errors, uncaught page errors, or failed requests;
- missing pinned Chromium.
- admission of a CRX or extension-output plugin into visual-harness Vite mode.

There is no fallback from a failed selector to a viewport capture, from a missing theme widget to another theme, or from a runtime-dependent page to a simplified mock page.

## Page Versus Extension Runtime

`page` means a complete render surface that can be driven by explicit presentation inputs. It does not imply a live extension runtime.

If a page requires service-worker state, Chrome messaging, extension storage, or content-script execution to be truthful, this harness must fail or omit that scene until a separate runtime-capture seam exists. Replacing those dependencies with undeclared runtime mocks would make the image misleading.

## Adding A Scene

The Sites workspace and policy-editor targets below render production components
with explicit presentation inputs, each theme's declared cap variant and Korean
locale resources. Editing enters through production controls. Fixture save
callbacks do not certify settings persistence or a full dashboard runtime result.

1. Add one explicit catalog entry in `sceneCatalog.js`.
2. Add one scene module under `scenes/` that imports the production component or page.
3. Build fixture data at a presentation/view-model boundary or through canonical builders.
4. Call `signalReady` only after the rendered target is ready for capture.
5. Run the individual scene and inspect both its PNG files and `capture.json`.

Do not copy product JSX or CSS into a scene. Do not add incidental pixel assertions to CI. Stable geometry may receive a separate intentional regression contract later, but that is not the default behavior of this harness.

### Sites scope-frame captures

`visual/sites/daily-cap-zen` and `visual/sites/daily-cap-matrix` compose the real
workspace, registry, selected-site cap and theme Intel with explicit fixture DTOs.
Both theme widgets are preloaded/resolved through the production widget registry;
the fixture does not replace a theme's registry or Intel with a hand-picked component.
The registry fixture is unified: an unprotected site leads average ordering,
with mixed policies, relative full-row fills, partial records, observed zero and
an unknown average. The largest average fills one row regardless of policy;
filter/search stability and explicit registration remain covered by targeted
production-widget interaction tests.
Workspace captures cover desktop, 360px narrow, empty, exception, observing,
long domain, site overflow and a dynamically appearing save-error notice. They
assert full registry width after rail removal, no always-mounted range, relative
usage ordering and unchanged geometry when notices appear.

`visual/sites/cap-editors-zen` and `visual/sites/cap-editors-matrix` exercise the
production readouts through explicit open, numeric draft and submit interactions,
and capture the inline forms within a 1440x3200 viewport. Cases cover unchanged,
staged, unlimited, below/equal/above average, average overflow, collecting,
partial, saving, error, canonical site increase preview, site overflow/unset and
expanded evidence. The actual 360x800 viewport targets
`visual/sites/cap-editor-narrow-zen` and `visual/sites/cap-editor-narrow-matrix`
verify the same production form at a narrow browser width.
Readiness requires the form to remain in its readout's document flow, below its
scope label and inside the viewport, with labeled numeric input, connected
feedback and non-overlapping actions. The global maximum remains 480 minutes;
site caps have no global maximum. Missing-average handling and the canonical
applied-value preview remain required.
All editors are real production components with fixture saves; no settings writes
or classification quality are certified. Unit interaction tests cover explicit
save/retry, locked dismissal, draft retention, cancellation/focus and late replies.

### Boot rendering and trusted input diagnostics (2026-09-07)

`dashboard/boot --render-trace` adds a bounded Chrome rendering trace through
`dashboardBootRenderTrace.mjs`, using only the target's ephemeral owned browser.
This is separate from `--trace=full|marks|off`, which controls application marks.
The raw JSON attachment and summary align to `entropy-qa:boot-shell-dismissed`.
Missing alignment, trace data loss, oversized output, or stream cleanup failure
are explicit failures. Nested trace spans must not be added as independent cost.
rAF intervals and GPU submissions do not prove a frame reached the display.

`dashboard/boot --render-trace --render-trace-profile=gpu-startup` is a separate,
closed sparse trace profile for a Zen idle observation of up to 120 seconds.
It records only `gpu`, `startup`, `latency` and `blink.user_timing`, retaining the
owned ephemeral browser, trace size limits,
data-loss failures and exact cleanup. The default `rendering` profile retains
its one-second post-reveal limit and existing categories. The sparse profile
requires `--render-trace` and Zen idle; it adds no Chrome launch switches or
application GPU queries. Collector spans such as DirectX and Dawn information
collection are observed browser work, distinct from Pond-context GPU timers.
Temporal overlap identifies a measured association; it does not by itself prove
that a collector caused a frame gap. Keep an uninstrumented control and the exact
publication, visibility and graphics receipts alongside the instrumented run.
For observations longer than 30 seconds, this profile records only the final
30 seconds, beginning at the existing serial status poll without a new timer,
focus action or application render change. A native user-timing anchor and its
actual page `startTime`, together with the observation's page start time, align
that late trace to the original window. The receipt exposes this offset and
keeps clock uncertainty explicit. Shorter observations use the original reveal
mark. Export deadlines and byte limits are unchanged; failure is never repaired
by admitting a partial trace.

`dashboard/boot --gpu-info-collection=browser-default|dawn-eager` is a closed
startup contrast research scenario; `off` is the ordinary default. Both research
modes require one cold Zen sample, realtime 120s, idle interaction, full Pond,
native canopy preparation, application marks, sparse `gpu-startup` render trace,
no CPU/GPU timer profiling, and actual hardware rendering. The compiled enum
crosses the existing harness to the neutral named GPU-info launch policy. Only
the measurement browser receives it; artifact preparation stays uninstrumented.
The eager mode adds only `--collect-dawn-info-eagerly`, leaving the independent
DirectX delay and normal graphics backend intact. Attached/persistent browsers
and undeclared/raw launch flags are rejected by the owning boundaries.

`dashboardBootGpuInfoCollectionProbe.mjs` verifies the exact owned browser's
live collection switch count before the fixture and after observation, without
retaining raw argv or process ownership tokens. It also reads the bounded exact
`GPU.Dawn.InfoCollectionTimeMS` histogram. CDP reads the browser recorder without
forcing a current GPU-subprocess histogram merge; missing records are explicit
`not_recorded`/null, and unchanged counts do not prove no new collection.
Positive records before the fixture demonstrate that at least one sample was
visible by then. The per-run launch receipt and observed native spans are the
primary scheduling evidence. Eager requests do not force a GPU host, so an
earlier collector must be observed to distinguish relocation from a skipped
request. These diagnostic calls never change product state, readiness, focus,
GPU quality or browser cleanup. Compare exact artifact/viewport/renderer inputs
and use a return-to-default control for host drift; no raw trace limits expand.

The optional rendering trace also admits native `gpu.angle` compiler/link-task
events alongside `gpu` and `disabled-by-default-gpu.service`. This is a Chrome
trace category change, not a new product GL query or compiler/scheduler owner.
ANGLE can attach complete GLSL/HLSL source and compiler error text to its native
events. Those arguments remain only in the local raw JSON of this ephemeral,
fixed-fixture browser; do not print source bodies or include them in summaries.
The runtime's source-free program observer and its primitive transport remain
unchanged. Native summary projection keeps names, thread/clock intervals and
callsite metadata, without projecting compiler source/error arguments.
The recorder retains the existing 64 MiB buffer and 128 MiB stream limits,
record-until-full behavior, explicit overflow/data-loss failure and owned-stream
cleanup. These limits are not raised to admit more categories. Compiler tasks,
thread CPU and driver waits may overlap and are not additive GPU execution time;
missing program IDs remain an attribution limit. Keep source-bearing analysis
local and bounded to lengths/hashes or owned shader-name correspondence.

`--interaction=immediate|warmup` uses `dashboardBootInteractionProbe.mjs` to send
trusted CDP pointer hover and click to the visible Sites navigation button after
canonical shell dismissal (immediate, or 1400 ms later). The 60 ms hover interval
also exercises intent preloading. Actual event offsets, capture queue delay,
Event Timing (16 ms reporting threshold), destination readiness, and the next
rAF are recorded separately. These are scenario measurements, not field INP or
physical input-to-photon latency. `none` preserves the idle baseline. No test
step activates or refocuses the browser. Preparation runs disable these probes.

`--gpu-timing` is an opt-in Zen idle-scenario probe. The boot QA URL enables
`zenPondQaTelemetry.js` only in a debug-tools build with the declared
`entropy-qa-capture=zen-main-v1` profile. `ZenSignalScannerSurface` carries the
telemetry option through the existing quality/control channel before renderer
creation. `pixiGpuFrameTimer.js` measures that actual Pond WebGL context; the
existing water-effects metrics reader retrieves its asynchronous samples.
This is neither Bonsai GPU timing nor whole-window compositor time. Default
runs do not issue timer queries. Hardware classification, timer enablement,
extension support, pending samples and measured values remain distinct; absent
measurements are null with a reason, never zero. Hardware availability comes
from the existing browser `gpuCapability.mjs` owner. The flag is invalid with
non-Zen themes or interaction scenarios, which may unmount the measured surface.

Rendering summaries also report deduplicated `AnimationFrame::Presentation`
feedback for the marked page process/thread. This is Chrome's reported
presentation timestamp, not photodiode evidence. Missing feedback is unavailable,
not a zero gap. GPU records retain cumulative startup-inclusive counters and a
separate steady window after the first post-reveal second (at least 600 ms,
with up to 2000 ms additional bounded collection for published telemetry samples). The latter's
mean derives from cumulative sample-count/mean deltas; it must not be confused
with startup maxima or GPU utilization. Timer queries measure elapsed time
between GPU commands, including queue/submit gaps, not exclusively busy time.

A thrown boot probe error is a failed sample even if the page itself is healthy.
`classifyDashboardCaptureHealth` includes `dashboard_boot_probe_failed`; missing
GPU samples, incomplete input, or invalid trace capture must never produce PASS.

### Sites recording states (2026-09-14)

The existing visual/sites/daily-cap-zen and daily-cap-matrix scenes now include
named workspace-protected-only, workspace-recording-off and workspace-excluded
captures. Fixtures obtain admission from the canonical recording policy helper.
Readiness asserts policy-only detail, no usage fills while recording is off, and
no redundant scope tabs in that mode. Existing editor and narrow-editor targets
retain their explicit draft, failure and geometry checks. Functional privacy/read
admission is covered by domain/controller tests and the owned dashboard journey;
static visual fixtures alone do not certify collection behavior.
