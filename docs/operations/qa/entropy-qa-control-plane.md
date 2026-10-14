# Entropy QA Control Plane

- Status: Active
- Owner: runtime QA / release operations
- Last validated against code: 2026-10-14
- Path policy: current-only
- Canonical for: QA target identity, human/agent execution modes, local browser environments, artifact leases, resource serialization, lifecycle cleanup, and evidence envelopes
- Companion to:
  - `docs/operations/qa/real-site-e2e.md`
  - `docs/operations/qa/visual-capture-harness.md`
  - `docs/operations/qa/mv3-lifecycle-e2e.md`
  - `docs/operations/qa/storage-data-lifecycle-e2e.md`

## Purpose

### Minimal agent interface

Start with [agent QA workflow](agent-qa-workflow.md). Direct exploration uses the
connected browser tool in the declared CfT `authenticated` profile. `qa explore`
inspects that browser and historical reload context without starting a session
or claiming the current live build. `qa explore start` holds the existing
broker/capacity until Ctrl-C; named runs cannot borrow the profile meanwhile.
`qa explore note <session-id>` records bounded actions, observation and
uncertainty under that exact active owner; `qa explore show <session-id>` reads
its evidence. No exploration operation issues PASS. Regular-Chrome pin checks
require explicit `qa explore --comparison=regular-chrome`.
Repeatable checks use `qa run <target>` (agent mode by default). The run
performs fresh admission, so a separate `doctor` is optional. Compact `describe`
shows accepted options; `--json` retains the complete target contract.

`qa report <exact-run-id>` reads bounded, explicitly referenced evidence from
that run and separates its recorded verdict from cleanup, degradation and
coverage/measurement limitations. Runs print the same summary after their exact
`QA_RUN_COMPLETE` marker. Summary failure is diagnosed without changing the
recorded run verdict. No latest-run guessing or exploration certification occurs.

`qa run` prints `QA_RUN_COMPILED` with the compiler's exact run ID, environment
and evidence root before admission. It names pending work, not READY or PASS.
Phase observers use that exact root; they do not guess the latest directory.

Exploration READY receipts record the canonical runner start token and exact
broker/capacity lease identities. `explore show <session-id>` separates the
original recorded status from ACTIVE, ABANDONED, UNVERIFIED or RECOVERED.
Recovery applies after READY publication. An interruption before that point
may leave an empty evidence directory but grants no recovery authority; its
process-held broker/capacity reservations still end with the runner.
PID-only historical READY records remain UNVERIFIED and grant no recovery
authority. `explore recover <session-id>` requires the original runner to be
proved absent, revalidates the declared environment and exact resource scopes,
then proves exclusive availability by acquiring and releasing the existing
broker and physical capacity owners. A null observation is never that proof;
a live or unverified runner, occupied resource or foreign successor blocks
reconciliation. No process or browser target is terminated. The original
`session.json` and notes stay unchanged; a separate bounded `recovery.json`
binds the source-session digest and exact proof/cleanup receipts. The evidence
owner publishes the completed temporary receipt atomically without replacing
an existing receipt; interrupted or competing writers cannot publish a partial
result or overwrite the winner. Repeated
recovery reads this validated historical receipt without taking resources.
RECOVERED reconciles that old session and certifies no current browser readiness.

Command owners load on demand. The canonical publisher overlaps metadata and
file IO in bounded batches while consuming the identical sorted digest records
and copying those exact bytes. There is no timestamp cache or skipped freshness
check; existing artifact pins remain digest-compatible.

Git worktree observation is read-only as well: visual capture Git reports, Vite
build provenance and public QA source admission invoke `git --no-optional-locks
status` with their existing output options. They preserve dirty/clean and path
evidence without refreshing the shared Git index or acquiring its optional
`index.lock`. This grants no authority to remove or rewrite an existing lock.

Every protocol must return a serializable object with its own explicit terminal
status. Missing results/statuses and invalid statuses fail; success is never
inferred from the absence of an exception. Error classification uses the root
code, not arbitrary message details. Aggregate failures remain FAIL, including
preflight rollback failure. Browser cleanup is registered before acquisition;
failed rollback retains its exact broker handle for cleanup retry.

`run.json` records the protocol and whether its declared report is required.
Bounded summaries project build, verdict scope, readiness, activation and counts
from `run.result`; they do not duplicate that source in another report. A missing
required report remains an evidence gap. Older envelopes explicitly expose
`legacy_unknown` report requirements rather than assuming an attachment is
mandatory. Recorded verdicts never change through summary projection.

The immutable plan separates `artifactAdmissionClaims` from the full
`resourceClaims` union. Ordinary dev runs acquire the union, pin a private
`isolation: immutable_run_copy` under the artifact lease owner, then release
only `artifact:dev_extension` and journal `QA_ARTIFACT_ADMISSION_RELEASED`.
Browser admission follows. Runtime/browser/profile claims remain held until
reverse cleanup. Protocol-owned child artifact lanes and `rebuildDuringRun`
retain their artifact claim for the entire run. A missing or foreign pin cannot
release admission. Release is token/run-fenced and failed claims remain owned.

Two independent runs may reach development artifact preparation together. Only
the compiler-declared `artifactAdmissionClaims` may wait for that shared startup
owner: `QaResourceCoordinator` retries the ordinary exclusive create operation
for at most 180 seconds, using the run's cancellation signal. It records
`QA_ARTIFACT_ADMISSION_WAITING`, then `QA_ARTIFACT_ADMISSION_WAIT_COMPLETE` with
ACQUIRED, ABORTED or TIMED_OUT. An acquired private immutable pin still releases
admission before browser setup. Waiting never deletes, rewrites or steals an
owner's lock. Timeout is `QA_ARTIFACT_ADMISSION_TIMEOUT` / BLOCKED and preserves
the foreign owner. Runtime claims, shared profiles, browser capacity,
during-run rebuilds and child artifact lanes retain immediate conflict handling;
this bounded startup wait grants no additional browser or focus authority.

Development snapshots and the Vite build wrapper consume the ordered artifact
checks in `scripts/ci/extensionArtifactCheckCatalog.mjs`. The fingerprint covers
those checks and actual Vite/build tooling dependencies, plus source, public
assets, lockfile and toolchain version. Unrelated structural/QA guards are
verification provenance, not artifact build inputs. Their CI gates still run
independently. An input-catalog change invalidates the existing publication once;
no legacy digest or timestamp reuse path is introduced.

### Favicon cache and app surfaces

`assets/favicon` is the agent-only disposable `dev_extension` target owned by
`scripts/qa/protocols/faviconQaProtocol.mjs`. One run-owned `ephemeral` Chrome
harness verifies content discovery, durable capture, revisit reuse, source changes,
clear before delivery of a successful native cache Response, and Dashboard/Popup/Gate image reads. It uses
canonical settings, site-rule and cache-maintenance commands; the real-use profile
is outside its mutation scope. It requests no OS focus.
Before runtime admission, the exact owned Dashboard admits that disposable
profile through `GET_SECURITY_VAULT_STATUS` and requires version 1,
`state: unlocked`, `mode: local`. No app passphrase or setup/unlock command is
supplied. Artifact identity and strict runtime readiness remain required; admission neither
bypasses the vault nor rewrites storage directly.

Dashboard and Gate use a 1280×900 viewport. Surface evidence requires a loaded,
meaningful image whose center is in the viewport and unobscured; Dashboard boot
shell dismissal is required before capturing its exact Sites row. Gate inspection
binds the actual shadow-DOM iframe's frame ID to its renderer through the owned
parent session, supporting both local frames and out-of-process iframes without
navigating away from the page that owns the Gate session.

The loopback page first supplies native data-image observations, then serves an
actual HTTP PNG at its fixed `/native-icon.png` path to warm Chrome's favicon DB.
That one-way native HTTP stage also owns the initial HTML of every subsequent
fixture navigation, including the Gate page. It never feeds Chrome's resized
cache PNG back into page markup as a new data-image observation.
An exact owned extension-page cache read must decode the expected fixture pixels;
its PNG hash is preparation evidence, separate from the worker measurement phase.
The public cache-clear command removes the app cache before that phase. Chrome's
own `_favicon/?pageUrl=<owned loopback page>&size=64` GET must complete successfully,
and native response bytes must match both the prepared PNG hash and the durable
product capture. CDP may expose an empty internal-loader response body, so its
body diagnostics never establish the positive PNG proof.

`faviconQaResponseDeliveryFixture.mjs` is a protocol-only response-delivery owner
installed in the exact disposable extension worker. It delegates the original
receiver/arguments to native fetch, reads only a clone of that exact local GET's
Response for bounded PNG/hash evidence, and returns the original unconsumed
Response object. One armed call holds only delivery of a successful native
Response for at most 1.5 seconds. After the canonical clear acknowledgement, the
same unchanged object is released before the product's 2.5-second timeout.
No response status, headers or body is fabricated or rewritten, and the network
request itself is never claimed to be paused. Abort, expiry and cleanup release
cannot prove clear fencing. Cleanup settles owned calls and restores the original
fetch property descriptor/identity; ownership or restoration failure is fatal.

Two synthetic HTTPS icon addresses cross the real content-message boundary as
observations; they are never inserted into page markup. They must produce zero
external worker requests and only the exact local-cache read. Exact synthetic
URL interception fails and blocks any attempted request; worker Network events
independently reject HTTP(S) requests and positively correlate each completed
local GET with the native response observer and exact prepared PNG hash.
Revisit must preserve durable bytes and
timestamp without another local-cache read. Evidence records these counts and
bounds the no-egress claim to this worker and fixture phase, not all browser
traffic or arbitrary compromised trusted navigation. Product CSP is unchanged.
The first synthetic capture and its unchanged repeat require exactly one local
GET in total. Before preparing UI, a content-source rebind to the exact native
HTTP icon must acknowledge unchanged durable bytes and exactly two total local
GETs; normal page observations then share the selected native source. After UI
preparation, both owned page icon URLs and a fresh native cache read must still
match that HTTP stage and the original prepared PNG hash. All observed worker
reads must remain completed, bounded original PNG responses with that hash and
zero external requests. The armed clear race adds exactly the third local GET;
neither later native observations nor a changed cache encoding are ignored.
Before asserting the first synthetic capture, the protocol records its bounded
response shape, elapsed time, exact local Network completion/failure counts and
safe CSP directive/disposition tokens from a passive owned-worker listener.
The listener is removed before detaching. Diagnostics omit response bodies,
unexpected request URLs, console text, and CSP blocked URI/original policy;
zero observer events never substitute for the required positive cache evidence.
The exact disposable worker disables its HTTP/memory request cache during this
phase and restores it during cleanup; Chrome's favicon DB is retained. Local response
diagnostics retain only status, MIME/Content-Type tokens and cache flags. An exact
observed local response body may be read for its byte count and PNG-signature
boolean; no payload or arbitrary header values enter evidence. A completed native
GET alone does not satisfy native PNG or response-delivery race proof. Internal
extension-loader requests are not required to emit a Fetch pause; the native
Response observer plus successful Network completion supplies the independent
positive evidence instead.

Unit contracts cover local admission, freshness, byte/type bounds and request
coalescing separately. No substitute CDP connection, browser process, remote
certificate policy or product debug API is introduced.

Run `npm run qa -- run assets/favicon`. The protocol report and decisive surface
captures retain the exact build, observations, terminal verdict and cleanup result.

### Echo real browser artifact execution

`artifacts/echo` is the agent-only disposable `dev_extension` target owned by
`scripts/qa/protocols/echoArtifactsQaProtocol.mjs`. It uses one ephemeral harness,
temporary history/bookmark permission promotion, canonical settings/site-rule
commands, real browser specimens and real minute/five-minute deadlines.
Verified disposable ownership precedes every fixture API call. Fixture APIs
cannot delete, write storage, grant permissions or replace alarms; measured
removals belong to the existing product executors. It owns no personal profile,
OS focus grant or substitute lifecycle. Exact worker and checkpoint continuity,
alias deletion, OFF/pause preservation and safe controls are required evidence.
See [Echo Artifact E2E](echo-artifacts-e2e.md) for the ordered scope and limitations.

### Native protected tab groups

`artifacts/tab-management` is the agent-only `ephemeral` / `dev_extension` target
owned by `scripts/qa/protocols/tabManagementQaProtocol.mjs`. It uses the ordinary
immutable artifact lease and one owned `ExtensionChromiumHarness`, hidden by
default with no OS focus grant. One initial scenario tab is active; later specimens
use the existing `sameWindowAs` owner and remain inactive. Canonical Dashboard
vault setup precedes strict runtime readiness; its random passphrase stays only
in process memory. Only the disposable manifest promotes `tabGroups`,
`scripting` and `http://tab-management.localhost/*`; shipped permissions and personal
profiles are untouched. Every fixture API call rechecks disposable ownership.
Canonical `SET_SETTINGS` and site-rule commands cause every measured product
grouping. Native API fixture mutations only pin a specimen, seed a separate user
group, and simulate explicit manual detachment. The fixture reads native groups,
the whole-count badge and the typed session checkpoint; it cannot write storage,
grant permissions, create browser windows or invoke a runtime executor.

The six ordered stages prove initial native grouping, preservation of pinned and
user-grouped tabs, manual-detach continuity after exact worker revival, removal
after unprotected navigation, and grouping OFF without changing the Gate budget
or dismantling existing groups. Evidence is `attachments/tab-management.json`
with exact run/build identity and ordinary cleanup receipts. This one-window
backend target does not certify native permission prompts, Dashboard controls,
Gate navigation, incognito or multiwindow browser behavior; focused service tests
cover per-window grouping and Gate admission. Run `npm run qa -- run
artifacts/tab-management --presentation=hidden`.

### Integrated protection journey

`journey/protection` is owned by
`scripts/qa/protocols/integratedProtectionQaProtocol.mjs`. It runs one continuous
functional journey in **one** run-owned `ephemeral` browser, headless by default, using the
ordinary dev artifact lease and `ExtensionChromiumHarness` lifecycle. It does not
compose child `qa run` commands, launch a preparation browser, borrow a personal
profile, or create a second scheduler. The target registry and protocol registry
remain its public registration owners.

Fresh/reset profiles must return automatic local key admission from the shared
asset-fenced Dashboard fixture: `state: unlocked`, `mode: local`,
`operation: already_unlocked`. First registration and reset preparation supply
no app passphrase and need no setup/unlock. The separate optional log-lock stage
explicitly enables wrapping, reloads the extension, proves locked Dashboard and
content protection, and only then unlocks. Each vault operation uses a newly
created asset-fenced Dashboard sender through the shared fixture owner. Its
scenario Dashboard/Popup documents are retired before the extension reload and
opened again through the existing page owner afterward; phase evidence identifies
any failed operation without dumping vault responses. Its
portable backup still requires an independently generated strong backup
passphrase. Replace import omits `restorePassphrase`
and requires local/unlocked result metadata, then the ordinary response-ACK
handoff and fresh-worker admission. Credential rotation and explicit wrapped
restore coverage remain in the independent data lifecycle target.

```powershell
npm run qa -- describe journey/protection --json
npm run qa -- doctor journey/protection --mode=agent --presentation=foreground --theme=zen --json
npm run qa -- run journey/protection --mode=agent --presentation=foreground --theme=zen
npm run qa -- run journey/protection --mode=agent --presentation=foreground --theme=cyberpunk
```

| Stage | Input | Required evidence |
| --- | --- | --- |
| Fresh profile defaults | Before preparing configuration, query validated boot prewarm and canonical Day0 progression; explicitly open Main's first-site form, cancel, reopen, and register the loopback site with recording unchecked | Current defaults and theme match before fixture configuration; Sidebar is visible and the form is initially closed; Zen has one resident shadow koi with no entering invitation and no debug day projection. Native entry, cancellation, and reopening retain that resident population. Actual Start commits the site with no time goal and all five OFF policy keys; after reconciliation prepare the declared development feature projection and admit Sites input. Remove only that loopback rule through the acknowledged product command before the unprotected baseline |
| Baseline | Canonical settings fixture; open actual Sites and Popup documents plus the existing local native-video fixture | Site absent; real native seek works; Popup reports the fixture host unprotected |
| Register | Trusted input in Sites search, open the matching candidate's notebook registration form, verify its prefilled domain, then confirm; use the existing Settings recording selector, return to that note and explicitly save 45 minutes through its cap editor | Canonical settings first contain the exact protected domain without a time goal; recording remains OFF and its cap is inactive. Only the explicit Settings choice admits protected-site recording. The cap ACK, settled notebook, and current policy agree on the selected domain and 45 minutes |
| Apply | Same web document, without reload | Canonical content diagnostics enable VideoSkip; native timeline disappears; trusted input at its former position cannot seek |
| Cross-surface | Activate the already-open Popup document; open/close its effects detail; follow its actual Sites URL through the owned Dashboard target | Popup query and actual UI agree on protection; action controls fit the fixed root and pass hit tests; reloaded Dashboard renders the selected recording-enabled notebook, retains the explicitly saved 45-minute cap and exact recording policy, and has no pending command or error |
| Optional data lock | Enable the log-only passphrase, reload the exact extension through the harness owner, then open the protected site's Dashboard notebook and reload the protected web fixture before unlocking | A different worker reports `locked`, `lockScope: logs`, `protectionReady: true`; the current recording-enabled notebook and 45-minute cap remain ready, encrypted export is refused, and current content diagnostics plus blocked native seek prove protection. Only then unlock and compare the same keyring and every original encrypted log row |
| Lens settings | In the same Dashboard, select Tools family `lens` and child `blur`; trusted input toggles its native switch ON, OFF, then ON for lifecycle checks | Actual `aria-checked` state settles without a row error or pending intent; canonical `GET_SETTINGS.filterSettings` reflects each choice; OFF restores the prior full value including strengths and siblings. Each choice also proves a newer successfully applied envelope in the same protected native-video document, matching received/applied trace and revision, canonical compiled strength, actual computed filter and single additive media effect; OFF removes that effect and restores the baseline filter while the root filter stays unchanged |
| Echo settings | Select Tools family `echo`, child `tabEvaporation`, timeout 10 then OFF; select baseline timeout 5 and OFF, then retain timeout 10 | One UI selection yields canonical activation and timeout 10; OFF preserves its timeout; the baseline round trip preserves siblings; the retained choice is active at 10 for lifecycle checks |
| Artifact lifecycle | Reload that Dashboard and protected content document, stop the owned service worker, wake it through the canonical query, and reload Tools again | The content refresh proves a new exact document with retained blur strength, matching received/applied envelope identity and actual media effect; the worker revival proves those facts again, allowing an unchanged content revision. A different worker target returns the exact retained Lens/Echo settings and protected rule; actual Lens ON and Echo 10 selections settle in both reloaded UIs; export one portable snapshot without secrets, then restore baseline artifact controls, prove actual media blur removal, and return to the same recording-enabled 45-minute site notebook before the release stages |
| Cancel | Confirm release inside the Sites notebook, then cancel through that owner's grace control | Rule remains continuously present past the 8-second deadline; content protection remains active |
| Release | Confirm again and allow the product's real grace timer to expire | Canonical rule disappears after the grace interval; unrelated allowed rules are unchanged |
| Restore effect | Same web document and already-open Popup | Native seek works again; DOM ownership is removed; either a disabled envelope has applied or exact canonical out-of-scope teardown is proved; Popup query and UI report unprotected |
| Snapshot lifecycle | Reject a cloned portable snapshot with retired boolean Enso value; commit the existing reset once from the owned Dashboard, close that document before its response ACK, and reenter through the ordinary recovery UI; replace-import through the existing response-ACK handoff owner | Malformed import returns exactly `{success:false,error:'SETTINGS_STORED_VALUE_INVALID:filterSettings'}` before lifecycle mutation; settings, portable state, journal and generation remain unchanged. Reset reentry retains the same COMPLETE generation and same closed worker, exposes one restart-retry control with no PIN or destructive confirmation, and only its trusted click dispatches ACK. The actual old worker exits, a different worker admits the unchanged reset generation, and a fresh healthy Dashboard proves canonical Day0 before Main's recording-free Browse choice. Import readback, different-worker revival and actual Lens/Echo UI match the export, including restored protected-site recording consent, the protected domain and its 45-minute goal, and absence of the first-use form |
| Settings corruption recovery | Bind the completed import/reset journal's current generation, verify healthy readiness, physically seed `settings.core` with retired boolean Enso or malformed artifact pause in that disposable profile; stop/wake the worker and open a fresh Dashboard | Dedicated profile-generation readiness fails with the exact physical settings error and six-field recovery descriptor without altering the seeded document; that descriptor reaches visible diagnostic metadata; trusted UI input opens full-reset confirmation and then performs its own reset/ACK; a new worker has canonical defaults, and the healthy Dashboard completes its actual first-use OFF choice before Sites input |
| Cleanup | Restore changed configuration through acknowledged settings commands | Prepared fixture baseline configuration and rule membership match; exact owned pages/browser, fixture and artifact lease are released |

Lens queries `GET_PROTECTION_RUNTIME_SNAPSHOT` with `hostname` for its compiled
host projection (`scope.tabId: null`). Its cached revision belongs to the last
host evaluation and is not the exact document's delivery counter. The isolated
content diagnostic read and canonical probe bind the current document/build;
its latest accepted delivery attempt must match the successfully applied
envelope's source, trace and revision, without error, stale delivery or resync.
Only user toggles require advancement from the prior revision in that same
document. Refresh requires a different document; worker revival may preserve
the existing applied revision. Both still require the canonical compiled blur
value and actual visible media effect to agree.

Zen notebook actions first open the current site's native management disclosure
through trusted pointer input when closed; an already-open disclosure stays open.
Recording settings, cap editing and release keep their existing hit-test and ACK
checks. Notebook restoration reads the registry's canonical `data-recording-scope`
and exact saved recording policy; the non-Zen policy header remains an additional
recording assertion only for themes that render it.

The fresh Main entry is checked at canonical Day0 before feature preparation:
the existing development `CLEAR_UNLOCK_OVERRIDE` route first acknowledges live
mode before opening each fresh/reset Dashboard. An absent development session row
would otherwise select the documented full-access Day5 default. This preparation
writes only the existing session projection; it neither earns days nor seeds a
First Vision receipt. The normal presentation owner completes its own transition.
Sidebar is available, the registration editor waits for explicit native input,
and cancellation returns to the one resident shadow. The existing public renderer
counters prove population and arrival state, not exact fish entity identity.
`fishRosterSyncCount` counts applied payloads, including editing-state updates;
it is diagnostic and must not be treated as a fish reconstruction counter.
The existing debug mount identity, scene-session count and latest applied roster
scene key must remain stable across entry/cancel/reopen. The latest roster event
must carry the current sync count so an old scene key cannot satisfy the check.
Exact object/UID reuse across those updates is covered by the existing entity
sync and invitation transit tests. Reset preparation also explicitly opens the same
entry before its recording-free Browse action. The actual Main first-use action
and its five-key reconciliation are checked before feature preparation. A truly empty current profile routes Sites intent to
Main, so this development-only feature journey then explicitly acknowledges the
existing day-five debug projection, reloads the same owned Dashboard, and selects
Sites through its real navigation control. Each reset repeats that preparation
only after its fresh defaults and recording-free Browse action have been proved. The report
records the projection and `canonicalWrites: false`; this target does not certify
the canonical First Vision journey or earned progression days. No product route,
registration admission, or disclosure guard is changed for the fixture.

All seventeen stages must pass in order. An early failure leaves later stages `NOT_RUN`,
retains stage timing, page diagnostics and bounded failure captures, and still
runs settings restoration and reverse cleanup. Control DOM presence does not admit
trusted pointer input: the Dashboard boot shell must be gone, the control must be
visible and enabled outside an inert subtree, and its center must hit the control.
The Popup is created inactive in the exact content fixture's window through the
harness `sameWindowAs` owner. Its site binding must complete before activation.
The protocol retains the activation receipt and separately admits native document
visibility, correlating the exact tab and both CDP target windows. A selected tab
in a hidden or minimized window cannot satisfy Popup readiness; the bounded failure
retains these identities and native visibility without emulation or repeated focus.
The Sites search additionally proves stable focus before `Input.insertText` and
the exact resulting input value afterward; readiness failures retain hit, focus,
geometry and boot-shell diagnostics. A fresh profile has no persisted
settings, so the first stage proves defaults before the user chooses a recording
policy and preparation commits a declared baseline with VideoSkip off,
then snapshots it through the canonical settings query. Restoration compares
against that fixture baseline, not a nonexistent personal settings snapshot.
Evidence is
`attachments/integrated-protection.json` plus twenty-eight successful-stage PNGs
(nine original captures, the fresh-profile Sites capture, artifact revival and
import captures, error/confirmation/recovered captures for each corruption case,
the protected content after log lock/reload, four Main first-use captures before commit,
four closed Day0 entry captures, and the committed reset's reentry handoff surface),
`events.jsonl`, and the canonical cleanup envelope. Rule timeline audit entries
are not rewritten; they disappear with the disposable profile.

The reset reentry case uses the existing trusted Dashboard's `RESET_APP_DATA`
message contract once and deliberately leaves `PROFILE_MUTATION_RESPONSE_ACK`
unsent until the newly opened Dashboard's existing `retry_handoff` button is
clicked. The harness closes only the exact run-owned original document and
archives its diagnostics; it does not inject lifecycle/storage state, intercept
product events, weaken admission, send a second reset, or send ACK on the UI's
behalf. Evidence retains the response tuple, unchanged COMPLETE journal, exact
closed and reentered target IDs, same worker before ACK, the canonical generation
readiness refusal, the hit-tested recovery control, and the different worker plus
healthy canonical Day0 entry after ACK. The reentry document is then retired
through the existing held-target lifecycle because runtime reload can invalidate
its extension API channel.

`completeIntegratedFirstUseOffPolicy` owns the actual first-use actions at fresh
boot, snapshot reset and both corruption resets. Its shared `readIntegratedFirstUseUi`
reader requires canonical `insightsConsent: 'unset'`, Main's existing
`data-main-first-use-registration` form, an unchecked native recording checkbox,
absence of standalone setup, and an unobstructed Browse control. Fresh boot uses
trusted domain input and Start, proves the site and absent time goal alongside
the exact OFF policy, then removes that fixture rule through the product owner.
Each reset instead uses the explicit recording-free Browse action. Before either
choice, `openIntegratedFirstUseRegistration` requires the visible, hit-tested
Sidebar Main control and the existing accessible pond entry, then drives that
entry through native pointer input, cancellation and reopening. This checks the
native entry control rather than a fish-body hit coordinate. The
form capture waits for the editor's own entrance animation to finish and its
computed opacity to reach one; it does not disable motion or wait for the pond's
continuous animations. The bounded
choice control state is retained as `firstUse.initialChoiceControl`, and the
report distinguishes `trusted_start_pointer` from `trusted_browse_pointer`.
It never forces DOM focus, refocuses the OS browser, seeds a consent/onboarding flag or substitutes
a settings write for these actions. `readIntegratedFirstUsePolicy` queries the
canonical `GET_BOOT_PREWARM_SNAPSHOT` owner with `force: true`, requires all five
raw protocol keys to exist, validates the full current snapshot through
`requireBootPrewarmDashboardSnapshot`, and projects only those keys without
fallback. Completion requires exact readback of
`dataCollectionMode: 'off'`, `precisionInsightsMode: 'off'`,
`precisionInsightsSignals: { clse: true, navigation: true }`,
`insightsMode: 'off'` and `insightsConsent: 'later'`, together with first-use
form/setup/boot-shell absence, no pending commit or first-use errors and hit-ready Sites input. A successful storage ACK alone cannot admit the next
stage while the UI's canonical reconciliation is still pending or failed.
Only the post-commit observer treats an explicit failed
`BOOT_PREWARM_SNAPSHOT_INVALIDATED` response as a cancelled generation and reads
again within its existing 45-second bound. It records
`first_use_policy_invalidated` and the bounded `invalidatedPolicyReads` count;
the standalone reader still rejects that response, and every other error,
malformed snapshot or missing canonical field fails immediately. No prior
snapshot or default policy can satisfy completion.
An optional protocol-owned `afterCommit` hook runs once only after the exact
five-key OFF policy, dismissed dialog, absent boot shell and no errors are
proved. It may prepare the next surface with trusted UI navigation; the helper
then reads canonical policy and UI again and still requires hit-ready Sites
input. `settings/concurrency` uses this hook to select Sites after Zen's first
vision has released navigation, before any domain fixture is seeded. Both settings
concurrency and the protection journey read the canonical document theme and the
actually presented `data-dashboard-active-tab`: an already presented Sites
workspace needs no navigation click. Zen returns from Tools/Settings through the
Main sidebar and then the Garden ledger edge; other themes use their Sites
sidebar control. Before the one Garden edge input, its actual Pond mode,
absence of a pending request, idle sheet/threshold transform transitions and
enabled, unobstructed edge are required. Main's settled presentation phase alone
cannot admit a moving paper edge. Read-only diagnostics retain that Garden mode,
pending request, edge geometry/hit state and those two owners' running transform
transitions; unrelated decorative animations do not delay entry.
Trusted input remains hit-tested, and the presented Sites state
requires Zen's actual Pathways mode, no pending request or transition error,
and idle transforms from those same two owners before any registry or domain
interaction. A committed Sites route alone cannot admit a still-moving sheet.
URL intent does not
satisfy that proof.
The receipt is retained as `fresh_profile_defaults.result.firstUse`,
`snapshot_data_lifecycle.result.reset.firstUse`, and
`settings_corruption_recovery.result.cases[].firstUse`. The replace-import stage
also verifies the restored five-key policy and dialog absence.

Cleanup first queries only blocked/allowed rule membership through canonical
`GET_SETTINGS`, so a healthy sparse post-reset profile does not have to contain
the prepared fixture configuration before restoration. It then writes the known
baseline configuration and requires the existing full strict readback to match;
ordinary journey reads do not acquire additional defaults.

Content restoration keeps the existing disabled-envelope check and adds one
canonical teardown branch. Both require VideoSkip inactive, zero owned control
roots and no lock, followed by actual native seek. The teardown branch reads
`CONTENT_RUNTIME_PROBE` in the exact owned tab, top frame and document, plus the
same isolated inspection's bootstrap state, attempt lease and receiver-installed
flag. `runtime.documentProof` retains frame/document/URL, the before-release
document/URL/build fence, and those current observations. The current probe,
bootstrap and lease must share a positive attempt ID and start time; the lease
must be aborted with the same exact reason ending in `:out_of_scope`. The current
state must be stale, inactive and not dispatch-ready, with no receiver capability
or error, and the receiver-installed flag must be explicitly false. A same-document
rebind may have a newer attempt than the before-release fence. Last-applied
activation diagnostics remain intact after teardown; they cannot substitute for
this current proof. Earlier failed runs without `documentProof` cannot receive a
retroactive PASS.

For a previously protected document's restored native seek, the existing target
activation, pointer reveal and 200 ms native-control preparation are followed by
one exact-document content read before inspecting or pressing the UA timeline.
`content_restored_after_native_preparation` retains bounded current ownership and
attempt evidence. The same disabled-envelope or canonical teardown predicate must
still pass; a newly active protection attempt cannot borrow the earlier teardown
proof. This check adds no polling, delay or requirement that attempt IDs never
change. The initial unprotected baseline has no prior content receiver to inspect.

A native-seek failure retains its original error and captures one additional
exact-document content read as `content_after_native_seek_failure` and
`error.diagnostic.afterFailure`. This bounded observation preserves the current
bootstrap/lease/receiver/probe identity, latest activation attempt and applied
revision/timestamps, and VideoSkip active/count/lock state. It performs no
polling, target reactivation or state mutation; read or evidence-write failures
remain supplementary diagnostics and cannot replace the original strict failure.

The permission baseline pregrants only `*://native-video.localhost/*` and
`*://*.native-video.localhost/*` through the temporary manifest. These two literal
entries are the bounded exception in `chromiumHarnessManifestPromotion.mjs`:
Sites' permission owner requests both schemes and subdomains for registration.
Other wildcard hosts, wildcard `.localhost`, all-URL and LAN grants remain
forbidden. The fixture server still accepts only its exact hostname and paths.
Popup runs its **real app/controller** in an
owned tab: initialization reads the active fixture tab. Preparation waits for the
controller's read-only `data-site-domain` binding before activation exercises
the existing visibility/commit refresh owner; no elapsed delay substitutes for
that actual query result. No DOM or clock mock is injected. The only invalid
physical storage fixture is `settings.core` in the verified run-owned disposable
profile, cloned from its current valid document with one malformed field. The
fixture verifies exact trusted extension-page identity, owned browser/profile
paths and readback, preserves the corrupted bytes until explicit reset, and emits
only document/key metadata. It cannot write a personal or attached profile or act
as a product migration/repair path. Before each seed, the typed completed lifecycle
journal supplies its exact current reset ID and healthy readiness is verified.
The post-seed `GET_PROFILE_GENERATION_READINESS` response must reject that same
generation with the fixture's exact error and `settings_profile_recovery_v1`
descriptor (contract, kind, failureCode, recoveryAction, documentKey and key).
Broad `GET_SETTINGS` waits cycle/settings boot readiness and may report a cycle
hydration wrapper; it is not this physical settings recovery oracle. No generic
failure code can satisfy the dedicated check or the subsequent actual recovery UI.
Portable snapshot commands use the actual
export/reset/import owners. This proves Popup content and data propagation, not native
toolbar-popup open/close behavior or a browser permission prompt. It also does
not certify real-site adapters, foreground consumption, the independent public MV3 lifecycle gate,
historical statistics, or Dashboard boot performance. Those keep their existing
named targets and previously recorded failures; this functional journey cannot
overrule their results. Theme is selectable; the default is `zen`.
The settings stages use the existing family navigation identity and canonical
child/option identity emitted by the control models, together with the rendered
`radio`/`aria-checked` or button/`aria-pressed` selection contract. They perform
ordinary input through the same run-owned Dashboard, read canonical settings,
and wait for the presentation command to settle; they do not write fixture
settings in place of those actions. Echo's actual idle-close deadline and artifact
command failure injection remain outside this journey. Promise/error/retry and
single-command atomicity remain covered by the focused artifact/store tests.

### Native site permission denial and reapproval

`settings/permissions --mode=human` is a finite, human-assisted target owned by
`scripts/qa/protocols/settingsPermissionsQaProtocol.mjs`. It uses `ephemeral`,
the canonical `dev_extension` publication and one run-owned headed Chrome for
Testing process in Zen. Its copied manifest has no required scripting or host
grants. No fixture pregrant, browser permission override, direct permission
request, synthetic response or raw storage write can satisfy this target.

Preparation completes the actual first-use OFF flow and seeds one managed
`native-video.localhost` rule and its goal through canonical command owners.
The actual Settings permission repair button opens Chrome's native prompt.
The operator first chooses Cancel/Deny, then chooses Allow on the second prompt
opened by the same product button. All other actions and assertions belong to
the protocol. Each native response has a 120-second deadline; the complete run
has a 420-second deadline and always uses the existing exact-target/profile
cleanup. This is a finite run, without operator setup handoff or indefinite
browser retention.

The denial must produce the actual inline denial state and a fresh read-only
Chrome permission query must show the required grants absent. Reapproval must
produce Connected, prove all required grants through Chrome's actual permission
owner, and restore the admitted content runtime. Canonical settings, rule and
goal must remain unchanged after denial, approval and Dashboard reload. The
full typed boot snapshot supplies a fixed public settings projection; evidence
lists its exact `canonicalSettingsKeys`, including rule, goal, first-use policy,
permission mode and artifact settings. Evidence
records the product response and native permission API result with
`nativeClickObserved: false`: the protocol cannot independently identify the
operator's native button click. PASS certifies this human-assisted response and
recovery flow, not automated native-popup actuation or native toolbar lifetime.

Only this exact human target/protocol may opt into
`windows_human_permission_present_once`. The upper session presents the first
exact journaled UI target once, with the same live child, PID, CDP endpoint,
owner token, cancellation fence and single-use receipt as owned agent
preparation. The policy must match between the declared plan, request and
receipt. Later steps, response polling and measurements cannot renew OS focus.
No persistent/personal process or profile participates.

### Settings concurrency and actual task fault verification

`settings/concurrency` and `settings/propagation` are repeatable settings targets
owned by `scripts/qa/protocols/settingsConcurrencyQaProtocol.mjs` and
`scripts/qa/protocols/settingsPropagationQaProtocol.mjs`, respectively,
in `ephemeral` using the canonical `dev_extension` publication and Chrome for
Testing. Each owns one headless process by default and exact targets; explicit
foreground runs use the existing single Windows initial presentation before
the first Dashboard input. Hidden/background runs request no native focus.
Tab activation for input does not renew OS focus. Their functional PASS
does not certify native permission prompts, toolbar popup lifetime, external
site adapters, foreground consumption or performance. Persistent and personal
profiles, unrelated tabs and source publications are preserved.

Concurrency prepares canonical Day0 through the existing session debug owner,
then opens A without a domain scope. The shared first-use entry owner proves
the closed entry, cancellation without policy or rule mutation, and reopened
entry before the actual first-use OFF completion admits the Sites registry
search. Only after that commit does the existing day-five debug command prepare
and verify all seven disclosed families for the artifact cases. After the canonical rule seed,
trusted Sites input selects the exact domain row; B and subsequent reloads
retain that domain scope. Concurrency opens two real Dashboard lifetimes. A keeps its uncut Sites goal
draft while B changes the committed goal; A's subsequent owner ACK must apply
the thirty-minute increase limit against B's latest committed value. Canonical
settings, both views and reload must agree. Trusted rapid artifact inputs must
produce an observed pending operation and retain the final canonical setting,
including sibling fields, across both views, reload and actual worker revival.
No synthetic store mutation or fake UI response can satisfy those assertions.
Cap inspection and editing first admit the exact selected notebook and use the
shared trusted summary input to open Zen's management disclosure when closed.
Before each cap save, a QA-owned readonly MutationObserver binds the exact domain
cap, its nested inline form and stable form ID, the number input's actual form
owner, and the submit button. The inline editor replaces its readout trigger;
that removed trigger is not required to prove an open editor. It captures
the native trusted save click, then latches only actual DOM `success`, its
applied input value and absence of errors. The immutable receipt survives the
editor's subsequent idle/close transition; idle alone never proves a save.
Node replacement, missing admission, untrusted input, errors, wrong applied
values and the 30-second observation deadline fail explicitly.
On failure, bounded readonly diagnostics retain each captured node's connection
and exact identity comparison, original/current cap phase, form phase, trusted
submit and saving observations, number input values and document visibility.
These fields distinguish popover withdrawal from workspace replacement; a
removed editor with a success attribute still cannot skip identity validation.
The observer,
click listener and timer stop at settlement or expiry; `finally` disposes and
verifies deletion of the private probe. Cleanup failures remain diagnostic
without replacing an earlier operation failure. Canonical goal readback and
both Dashboard/reload checks remain mandatory.

Propagation faults live only in the development composition selected by
`@settings-propagation-qa-fixture`. `settingsPropagationQaFixture.public.js`
returns the original
`broadcastSettingsUpdate` function, and public build-capability routes remain
empty. The normal coordinator, settings service, commit ACK, WAIT command,
retry budget, checkpoint and generation fences are unchanged. The fixture can
hold or fail the actual broadcast handler for one matching `filterSettings`
task; it cannot write settings or produce substitute completion receipts.
ARM retains the single requested root key `filterSettings`. Actual task matching
also accepts its canonical feature-change tokens emitted by
`SettingsPersistenceCapability` through the protection feature catalog, such as
`filterSettings.blur`. The complete task metadata is retained in the lease and
validated by the same closed matcher; other setting roots, unknown feature tokens,
duplicates and noncanonical token spelling cannot bind the lease.

ARM/READ/RELEASE require the exact trusted `/entropy-e2e.html` sender, actual
tab/document identity, run ID, ephemeral profile declaration and UUID nonce.
Three matching meta markers are installed through `trustedPageSource` only in
the run-owned copied extension helper; the route validates that packaged helper
before accepting a lease. The helper document is revalidated after asynchronous source inspection through
the native read-only `runtime.getContexts` identity before accepting a lease.
The canonical development publication and default
persistent helper have no markers. CLI admission additionally proves the owned
per-run browser/profile and copied extension before arming. A RAM lease binds
to the first actual matching task ID and commit version; later tasks cannot
inherit it. Abort/supersession disarms it. Its forty-five-second lease limit,
explicit release and exact cleanup prevent an indefinite hold. Expiry is an
explicit failure, not a silent release into success. No fault is persisted;
worker replacement destroys it while the canonical checkpoint remains.

Before the fault scenarios, the existing development day-five preparation must
acknowledge the exact seven-family disclosure, without earning progression days
or changing canonical settings. The current viewport must present both actual
Zen Path edge thresholds inside the artifact aperture and viewport, enabled,
at least 44px in each dimension and passing native center hit testing. The seven
stepping stones are decorative inventory, not click targets. A bounded walk of
seven trusted next inputs must settle every neighbor and return to the initial
family, proving the complete unlocked inventory reachable. Settings selection
uses the shorter settled neighbor path; other themes retain direct quickbar
input. All three settings/protection protocols share this read-only navigation
projection and keep input in their existing native pointer drivers. The viewport
is not widened to hide a navigation fit failure. On a failure,
both settings protocols reuse `observeIntegratedFailureWindows` to record one
read-only exact owned tab/window/foreground attribution before screenshots;
they never reactivate or refocus the browser to repair evidence.
The four propagation scenarios require real elapsed time beyond the normal
fifteen-second observer timeout, Tools `applying` without a failure overlay,
same-task WAIT settlement, terminal stage failure with actual inline Retry,
old-worker observation rejection with saved values retained, and superseded
intent isolation. The feedback owner exposes semantic row/channel/status/task
metadata for observation, with no raw values, error text, epoch or secrets.
Each scenario records exact task/commit observations, canonical value checks,
real worker identities and terminal UI state. Failure remains FAIL with cleanup
reported separately. Development fixture path/action/signature exclusion is
enforced by public-artifact checks in the same change.

Managed unpacked-extension preparation proves developer mode before the single
CDP load/update command. `ExtensionChromiumHarness.withExtensionManagementPage`
reuses the existing exact-owned management-page lifecycle for disposable browsers
and, only under verified dedicated managed identity, capacity and artifact-slot
admission, the QA profile. It prepares `inDeveloperMode: true`, records the receipt,
then closes its exact page without focus. No direct preferences writes, extension
uninstall, `runtime.reload()` fallback or activation of foreign unpacked slots is
allowed. Chrome disable reason `DISABLE_UNSUPPORTED_DEVELOPER_EXTENSION` is a
preparation failure, not a product or frame-rate failure.

Development builds and QA use one publication owner,
`scripts/dev/devExtensionArtifactPublisher.mjs`. A build captures the declared
input paths into a temporary snapshot, checks the captured bytes against the
source, and bundles only that snapshot. Three short capture attempts are allowed
when an editor save overlaps copying; later saves do not invalidate bundling.
Concurrent npm dependency installation is excluded: node_modules is the shared
native toolchain, while its lockfile is captured. No branch/worktree is required.

The owner serializes publishers and short artifact-copy readers with its existing
publication lock (bounded 180-second wait). A completed snapshot's digest and build
ID travel in `entropy-dev-publication.json` with atomic publication. QA pins
one complete publication into its own temporary `artifact-leases` directory under
that same lock. It releases the lock before browser work and releases its pinned
copy during reverse cleanup. Changes to source/dist after acquisition belong to
later runs. A crashed run's leftover copy is not runtime authority and is never
silently reused. Doctor is read-only; it predicts reuse/build work, not a guarantee
that a concurrently edited source tree will remain current at execution time.

On native Windows, an `EPERM` from an atomic publication rename is retried on
the same verified source/destination after 100, 500 and 2000 ms. Each retry emits
`DEV_EXTENSION_PUBLICATION_RENAME_RETRY`; no artifact path or transaction changes.
Other errors fail immediately, and persistent `EPERM` keeps its native cause in
the final failure. Promotion and rollback use the same bounded operation. This
does not reclaim a publication lock, recover a QA run or modify another process.

If promotion and its rollback both fail, the exact `previous` tree remains the
rollback proof; an interrupted pinned `latest` promotion uses `latest-previous`.
Before any subsequent build preparation, the publisher holds its existing lock
and explicitly recovers an absent active path from that exact previous path.
It validates a complete development publication, including matching build and
publication metadata, then performs the same bounded atomic rename. A pinned
consumer must also match its durable pin's complete artifact digest; a released
latest publication must match the release receipt. Recovery emits
`DEV_EXTENSION_PUBLICATION_INTERRUPTED_PROMOTION_RECOVERED` with exact paths and
build ID. It neither replaces a present active path nor changes the pin record.
Invalid proof or a denied rename fails with
`DEV_EXTENSION_ARTIFACT_INTERRUPTED_PROMOTION_RECOVERY_FAILED`, preserves that
proof, and prevents preparation, input capture and bundling. The transaction
itself refuses to discard a previous tree while its active path is absent
(`DEV_EXTENSION_PUBLISH_RECOVERY_REQUIRED`). After resolving the external cause
of a persistent rename denial, rerun the existing build command; no raw copy,
forced deletion, alternate artifact path or browser/profile intervention is a
publication recovery mechanism. QA run recovery remains a separate owner.

Lock metadata is published atomically. A forcibly killed publisher's abandoned
lock fails explicitly with `DEV_EXTENSION_PUBLICATION_LOCK_ABANDONED`; waiters
never delete an observed dead owner's path because concurrent reclaimers could
delete a successor's lock. Before diagnosing abandonment, a waiter retries the
same exclusive publication and re-reads the exact owner record. Normal release
and exit snapshots, disappeared paths, and changed successor records remain
within the existing bounded wait; no waiter removes an observed owner's lock.
Recovery must verify the exact recorded owner is dead
and no build/pin process is running before removing that one lock. Ordinary
completion and handled build failures release it. Watch captures use the same
input-path declaration and wait for a new edit after three busy captures.

The immutable-artifact guarantee currently covers `dev_extension` leases. Source
rendering, child-owned `site_runtime_lane` builds and public release artifacts
retain their separate declared contracts; they are not certified as immutable dev
leases by this change. Regular Chrome's explicit real-use consumer pin below
preserves its loaded directory without granting a named QA verdict.

The same publisher owns the artifact-only real-use pin. Its durable
`.artifacts/dev-extension-builds/real-use-pin.json` record names `consumerId:
real_use`, a unique pin ID, exact absolute `consumerDir: <root>/dist` and
`latestDir: <root>/.artifacts/dev-extension-builds/latest`, pinned build ID,
captured input digest, full artifact-tree SHA256 and creation time. Pin creation
validates the current complete publication under the existing short publication
lock. If an existing complete `latest` has the identical build ID, input digest
and full artifact-tree SHA256, it atomically commits only the pin record and
preserves that identical tree. This avoids an unnecessary Windows folder rename;
metadata equality alone is insufficient. A missing or different valid `latest`
uses the existing staged copy and transactional record commit. An invalid
existing latest fails loudly. Pin creation never changes any
byte or path in `dist`, manifest identity, browser profile or extension settings.

While the record is `pinned`, development publishers promote new complete builds
to `latest`; its prior complete publication uses `latest-previous`. Canonical
default QA leases and read-only doctor resolve this same source through
`resolveDevExtensionArtifactSource`. Each QA run still owns its separate
temporary immutable copy. Explicit custom configured artifact paths keep their
own authority and are not redirected. Builds and copy readers release the lock
before browser work; the real-use pin holds no long-running lock.
Execution acquisition reads initial pin/publication admission under that same
short lock, releases it before invoking a build, then resolves again under its
copy lock. It waits through ordinary promotion/release rename gaps. Read-only
doctor and pin status remain unlocked and may diagnose a concurrent transaction's
temporary unavailable state; they never create a lock or mutate the owner.
When adopting this publisher version, restart any already-running dev watcher
once so it loads the new canonical routing code. Later pin/release changes are
read under the publication lock by that running owner; they require no watcher
restart and never suspend other development builds.

The pin has no expiration and cannot be reclaimed from a crashed run or by QA
cleanup. A second pin fails explicitly. Status validates the record, complete
latest publication and exact pinned consumer build/input/tree digest without
creating files or taking a publication lock. Corrupt records, foreign paths,
missing latest, missing record with an existing latest, or altered consumer
bytes fail loudly; neither owner substitutes an old chunk or another artifact.
Invalid pin prerequisites block QA admission; build and publication execution
failures remain failures.

Release requires the exact pin ID. It stages a complete copy of latest and uses
the existing promotion transaction to replace `dist`, preserving the retired
consumer in `previous`. The transaction commits an atomic `state: released`
receipt only after promotion; a failed receipt replacement moves the promoted
tree back to staging and restores the exact retired consumer. Latest and the
active pin record remain intact on that failure. The released receipt retains
the original pin identity plus release time and promoted build/input identity;
latest remains a declared complete archive. Inactive publishers use `dist`, and
a later explicit pin validates identical latest bytes for record-only creation
or replaces a different valid latest through the same transaction. Forced
termination during a multi-file transaction may leave a diagnosable invalid
state and preserved recovery trees; it is never silently treated as unpinned.
Only validated exact owner paths are removed. Artifact pin/release commands
return a manual reload receipt and never launch, reload or manipulate Chrome.

For an authorized repair and retest within the same real-use task, finish and
verify the new publication in latest while the current pin remains active.
Then explicitly release its exact pin ID and pin the resulting complete
publication before operator reload. Record both receipts and the new pin
identity. The same unpacked path preserves extension identity/settings; routine
turn completion and QA cleanup never release this consumer.

An ordinary dev QA run that needs a build invokes the same npm build owner.
QA no longer compares the entire mutable source tree again after bundling or
maintains a second build-provenance cache. Evidence names the actual pinned build
and the initially requested input digest separately. Full development/release
gates remain explicitly selected commands. Public release provenance stays strict.

Manual real-use exploration defaults to the same Chrome for Testing
`authenticated` profile as persistent automated QA, documented in
`../runbooks/windows-native-development.md#browser-roles`. `qa:open` delegates to
the managed operator-window owner; `qa:reload` runs `qa/extension-reload` through
the existing artifact/session/harness owners and proves live build/readiness.
The reload verdict covers infrastructure only. Connected browser UI exploration
must verify this exact profile and must not overlap a named run. Subjective
real-use observations remain exploratory evidence. The former regular Chrome
Profile 2 is preserved for explicit comparison requests; it is not a managed
environment or an automatic substitute.

`Entropy QA` is the public control plane for development diagnostics. An
operator or agent selects a named target and mode; the control plane resolves
the target contract, local environment, artifact, exclusive resources,
protocol, evidence directory, and cleanup policy. Callers do not reconstruct
Chrome flags, build commands, profile paths, report roots, or signal handling.

The control plane coordinates existing domain harnesses. It does not become a
second owner of Feed Horizon behavior, Gate behavior, Suikinkutsu DSP,
visual scene rendering, site scenarios, or MV3 lifecycle semantics.

Browser installation, persistent profile-slot, identity, and lifecycle
contracts live in the product-neutral `scripts/browser-qa` boundary. Entropy
maps its target/environment vocabulary onto that boundary; the reusable core
does not import Entropy targets, protocols, artifacts, or product runtime code.
This keeps a future standalone package or agent skill extraction mechanical
without making this repository depend on an unpublished tool.

## Owner Map

| Concern | Canonical owner | Contract |
| --- | --- | --- |
| Public CLI and argument boundary | `scripts/qa/entropyQa.mjs`, `scripts/qa/cli/qaCliHelp.mjs`, `scripts/qa/cli/qaCliOutput.mjs` | only `entropyQa.mjs` reads `process.argv`; commands are `help`, `explore`, `run`, `report`, `list`, `describe`, `doctor`, `browser`, `artifact`, `recovery`, `retention`, and `setup`, while help/error/output rendering stays in narrow CLI seams |
| Manual extension reload preparation | `scripts/qa/protocols/extensionReloadQaProtocol.mjs`, `scripts/qa/catalog/qaTargetRegistry.mjs` | `qa/extension-reload` in authenticated prepares/activates the canonical dev slot and proves live background build/readiness; no settings/session/site writes or extra process lifecycle owner |
| Authorized invalid-profile maintenance | `scripts/qa/protocols/profileResetMaintenanceQaProtocol.mjs`, `scripts/qa/protocols/attachOnlyActivePageAdapter.mjs` | `maintenance/profile-reset` in authenticated requires explicit data-erasure authorization and current exact settings recovery evidence, invokes canonical full reset and Dashboard ACK, then requires unchanged strict fresh-worker readiness |
| Target identity and parameters | `scripts/qa/catalog/qaTargetRegistry.mjs`, `scripts/qa/contracts/qaTargetContract.mjs` | immutable data-only manifests; no browser, build, or DOM work |
| Exploration guide / exact-run summary | `scripts/qa/cli/qaExplorationGuide.mjs`, `scripts/qa/evidence/qaRunReport.mjs` | read-only receipt/guide and bounded evidence interpretation; no browser ownership or verdict rewriting |
| Exploration commands and session ownership | `scripts/qa/cli/qaExplorationArgs.mjs`, `scripts/qa/cli/qaExplorationCommand.mjs`, `scripts/qa/exploration/qaExplorationSession.mjs` | bounded commands; existing authenticated browser only; shared broker and physical capacity held through terminal cleanup; no named verdict or browser mutation |
| Exploration identity, readiness and evidence | `scripts/qa/exploration/qaExplorationEnvironment.mjs`, `scripts/qa/exploration/qaExplorationReadiness.mjs`, `scripts/qa/exploration/qaExplorationEvidence.mjs` | current declared CfT identity, explicitly historical reload context, exact session records and bounded observations; connected UI identity remains separately verified |
| Exploration crash inspection and reconciliation | `scripts/qa/exploration/qaExplorationRecovery.mjs`, `scripts/qa/recovery/QaRecoveryJournal.mjs` | canonical runner start identity, exact resource-scope verification and exclusive availability proof through existing owners; separate immutable recovery receipt, original evidence and foreign/browser ownership preserved |
| Development artifact check inputs | `scripts/ci/extensionArtifactCheckCatalog.mjs`, `scripts/dev/devExtensionArtifactPublisher.mjs`, `scripts/ci/run-vite-build-with-content-bootstrap-check.mjs` | one ordered build-check catalog shared by snapshot fingerprint and build wrapper; structural QA guards remain independent verification gates |
| Human setup composition | `scripts/qa/catalog/qaHumanSetupCatalog.mjs`, `scripts/qa/catalog/qaTargetRegistry.mjs` | a closed site catalog and five feature identities compose at the CLI boundary; aliases normalize once to canonical site, feature, and target ids, and URL overrides must retain the selected site's exact declared origin |
| Reusable browser execution leaves | `scripts/browser-qa/contracts/browserExecutionContract.mjs` | process connection ownership, lifecycle start authority, headless mode, display, document visibility, target activation, OS focus, audio, GPU, and extension runtime remain independently typed and cross child-process boundaries intact |
| Entropy browser requirements and presentation | `scripts/qa/contracts/qaBrowserRequirementContract.mjs` | target-owned authentication, extension, rendering, audio, visibility, activation, and focus requirements plus an Entropy presentation preset compile to the reusable leaf contract |
| Protocol selection | `scripts/qa/catalog/qaProtocolRegistry.mjs` | one lazy protocol implementation per named protocol id |
| Execution plan | `scripts/qa/contracts/qaExecutionPlanContract.mjs`, `scripts/qa/runtime/QaRunCompiler.mjs` | resolved immutable target, mode, parameters, browser execution, environment, artifact paths, full resource claims, bounded artifact admission claims, and run root |
| Local machine configuration | `scripts/qa/environment/qaLocalConfig.mjs` | schema-versioned environment facts only; no credentials and no runtime state |
| Dedicated Entropy QA profile proof | `scripts/qa/profile/entropyQaProfileMarker.mjs` | strict schema-1/schema-2 marker read and slot/path-bound managed-lifecycle proof; no automatic marker creation |
| Environment preflight | `scripts/qa/environment/qaDoctor.mjs` | path, dedicated-profile proof, and loopback-CDP readiness; observation only |
| Browser inventory and status | `scripts/qa/environment/qaBrowserInventory.mjs` | read-only executable inventory plus broker owner, declared-environment/CDP identity, and target counts; never starts, focuses, or stops Chrome |
| Reusable browser resource and lifecycle contract | `scripts/browser-qa/lifecycle/browserResourceRegistry.mjs`, `scripts/browser-qa/lifecycle/persistentBrowserLifecycle.mjs` | named installation/profile slots, exact loopback CDP identity, and explicit `start`/`ensure`/`stop`; `stop` terminates only processes whose command line carries the declared slot's exact `--user-data-dir`, refuses a port-only occupancy, and confirms absence before returning; no Entropy target imports |
| Entropy persistent-browser lifecycle adapter | `scripts/qa/browser/qaPersistentBrowserLifecycle.mjs` | maps one `managed_persistent` environment to the reusable lifecycle, shared broker, process owner, and Playwright identity verifier |
| Explicit operator-visible managed window/page | `scripts/qa/browser/qaOperatorBrowserWindow.mjs`, `scripts/qa/drivers/windowsChromeToolbarDriver.mjs` | `browser open` focuses the exact managed WSL-Windows slot without duplicating an existing page; `browser page` creates, optionally navigates, activates, focuses once, and hands off one exact new page without invoking a product QA protocol |
| Operator desktop shortcut | `scripts/qa/desktop/entropyQaDesktopShortcut.mjs`, `scripts/qa/drivers/windowsEntropyQaDesktopShortcut.ps1` | exact staged install and read-only validation of the Windows shortcut that invokes the default blank `browser page` action; no product protocol ownership |
| Artifact ownership | `scripts/qa/resources/QaArtifactLease.mjs`, `scripts/dev/devExtensionArtifactPublisher.mjs`, `scripts/qa/runtime/QaRunSession.mjs` | source render, reusable dev extension, or prebuilt public extension; QA and the canonical dev publisher share one source-input fingerprint, doctor projects exact reuse/build/blocked work without mutation, public reuse requires a clean current commit/tree/lockfile match, and a run finishes artifact admission before browser lifecycle, broker, or display admission |
| Artifact admission failure semantics | `scripts/qa/contracts/qaArtifactAdmissionContract.mjs`, `scripts/qa/contracts/qaEvidenceContract.mjs` | exact prerequisite codes remain BLOCKED in doctor and run; execution/build failures remain FAIL; public repair instructions are returned by the artifact owner without committing, rebuilding, or reloading automatically |
| Environment browser broker | `scripts/browser-qa/resources/BrowserBroker.mjs`, `scripts/qa/resources/QaBrowserLease.mjs` | reusable process-held broker plus the Entropy admission adapter; authenticated sessions are attach-only and an observation file is never lock authority |
| Display, GPU, and WebGL capability | `scripts/browser-qa/resources/DisplayLease.mjs`, `scripts/browser-qa/browser/gpuCapability.mjs`, `scripts/browser-qa/browser/chromiumGraphicsArguments.mjs` | foreground requires a real host desktop, background headed Linux may own one bounded Xvfb, hidden has no display, physical-GPU admission requires active hardware-renderer evidence, and a target must explicitly require WebGL before an owned managed-Xvfb browser opts into SwiftShader WebGL |
| Browser process and Playwright ownership | `scripts/browser-qa/browser/chromiumProcessOwner.mjs`, `scripts/browser-qa/browser/playwrightBrowserOwner.mjs` | the only raw Chrome-process and Playwright launch/attach seams; requires a complete reusable execution contract, applies display/audio/GPU/capacity policy, and owns reverse cleanup |
| Native Windows launch monitor preference | `scripts/browser-qa/browser/windowsLaunchPlacement.mjs`, `scripts/browser-qa/browser/windowsMonitorInventory.ps1` | read-only display inventory and DPI-aware secondary-monitor launch coordinates for fresh headed processes; headless has no host-window placement, explicit coordinates stay authoritative, and existing windows are never moved at this seam |
| Managed startup diagnostics | `scripts/browser-qa/browser/chromiumStartupStderr.mjs`, `scripts/browser-qa/lifecycle/persistentBrowserLifecycle.mjs`, `scripts/qa/evidence/qaBrowserStartupDiagnostics.mjs` | bounded pre-READY stderr/process/readiness evidence; the adapter persists failure evidence after exact rollback and lease release, while CLI/run receipts expose only a reference and scalar summary |
| Legacy Playwright call-shape adapter | `scripts/qa/browser/qaPlaywrightBrowserOwner.mjs` | synthesizes a complete contract only for repository-local legacy callers, rejects conflicts through the neutral owner, and never launches, attaches, or owns Playwright itself |
| CDP WebSocket transport | `scripts/browser-qa/cdp/CdpConnection.mjs` | the only raw CDP WebSocket state machine; bounds open and request waits, clears pending ownership on every terminal path, and serves thin Extension/CWS compatibility adapters |
| Browser target ownership | `scripts/browser-qa/browser/cdpTargetOwner.mjs`, `scripts/browser-qa/resources/BrowserTargetLease.mjs`, `scripts/e2e/extensionChromiumHarness.mjs` | the only raw CDP page-target create/close seam plus browser-epoch-scoped baseline and owned-target ledger; ownership is released only after a confirmed close receipt; old `scripts/qa/**` paths are compatibility re-exports |
| Cross-run browser capacity | `scripts/browser-qa/resources/BrowserCapacityLease.mjs`, `scripts/browser-qa/resources/browserResourceScope.mjs` | owned browsers use the Git-common project scope; shared attach/managed resources acquire independent, sorted host-global locks for the normalized CDP origin and canonical user-data root; profile directory remains exact identity evidence but cannot split the root-scoped capacity lock |
| Concurrency | `scripts/qa/runtime/QaResourceCoordinator.mjs` | atomic, sorted, token-fenced resource claims; exact selective release after immutable artifact proof, retained failed claims, and reverse final cleanup; no automatic stale-lock deletion |
| Child-process lifecycle | `scripts/qa/runtime/qaChildProcess.mjs`, `scripts/qa/runtime/qaSignalCoordinator.mjs` | a proved abort is `INCONCLUSIVE`; Linux uses bounded signals, native Windows delegates to the private Job owner; cleanup failure outranks cancellation |
| Windows child Job and identity | `scripts/qa/runtime/qaWindowsChildJob.mjs`, `scripts/qa/drivers/windowsQaChildJob.ps1`, `scripts/qa/drivers/windowsQaChildJob.cs` | atomic kernel Job membership, private cancellation pipe, creation-time/executable evidence, bounded termination of only the held Job, and active-process-zero receipt; no PID-tree scan or broad process kill |
| Cooperative child cleanup | `scripts/qa/runtime/qaChildCooperativeAbort.mjs`, `scripts/qa/runtime/qaChildAbortRegistry.mjs`, `scripts/e2e/extensionChromiumHarness.mjs` | root-only Node preload invokes protocol cleanup then reverse resource cleanup, refuses new work after cancellation, and acknowledges only completed cleanup; shared harness close is coalesced |
| Run and cleanup lifecycle | `scripts/qa/runtime/QaRunSession.mjs` | for a compiled `managed_ensure_before_attach` plan, idempotently ensures the exact managed slot before constructing the attach lease; otherwise preserves external/per-run lifecycle semantics; then owns unique cleanup names, reverse release, and one terminal report |
| Evidence | `scripts/qa/evidence/QaEvidenceWriter.mjs` | append-only events plus `run.json` and `cleanup.json`, including protocol/report requirement provenance; command protocols must read the target-declared report prefix/schema/outcome from the current attachment root before projecting PASS or FAIL |
| Evidence retention planning | `scripts/qa/evidence/qaEvidenceRetention.mjs` | observation-only 7-day/3-per-target planning, 24-hour grace and 10 GB admission budget; pinned, incomplete and unsafe evidence is protected |
| Explicit evidence pruning and pins | `scripts/qa/evidence/qaEvidencePruner.mjs`, `scripts/qa/cli/qaRetentionArgs.mjs` | retention-only lock, exact plain run roots, revalidated fingerprints, quarantine and incremental receipts; no browser, build, worktree or research ownership |
| Recovery inspection | `scripts/qa/recovery/qaRecoveryInspector.mjs` | observation-only active/abandoned/unresolved classification, age and proof requirements, with matching resource-lock counts; grants no process or target mutation authority |
| Durable recovery journal | `scripts/qa/recovery/QaRecoveryJournal.mjs` | mode-0600 atomic run/session, runner-start, config/environment, process-token, browser-epoch, target-nonce, and resource-lock identity ledger |
| Atomic QA JSON publication | `scripts/qa/evidence/qaAtomicJson.mjs` | same-path Windows `EPERM` rename retries after 100/500/2000 ms with `QA_ATOMIC_JSON_RENAME_RETRY`; original record survives exhausted retries, non-`EPERM` errors fail immediately, and only the exact writer-owned temporary file is cleaned |
| Explicit recovery execution | `scripts/qa/recovery/qaRecoveryRunner.mjs` | after proving the runner absent, re-acquires canonical browser owners and mutates only exact journal-proven process, target, and lock identities; attached managed Chrome is preserved |
| Dev-only Gate automation | `src/domains/protection/background/automation/gateQaAutomationContract.dev.js`, `src/apps/background/services/runtime/messageRoutes/gateQaAutomationMessageRoutes.dev.js` | trusted harness requests one bounded entry-checkpoint snapshot; canonical Gate controller presents, certifies the committed session, and removes it |
| Dev-only Suikinkutsu research | `scripts/qa/protocols/audioDullingQaProtocol.mjs`, `scripts/qa/drivers/windowsChromeToolbarDriver.mjs`, `src/apps/background/services/runtime/messageRoutes/audioDullingQaMessageRoutes.dev.js` | human mode preserves operator control; agent mode prepares one exact tab, verifies or performs the one-time toolbar pin, drives audible media, captures the reverse-gravity ritual, and invokes the armed canonical action through the tab target |
| Dev-only Sentinel runtime QA | `scripts/qa/protocols/sentinelProtocolQaProtocol.mjs`, `src/domains/nudge/runtime/automation/sentinelProtocolQaAutomationContract.dev.js`, `src/apps/background/services/runtime/messageRoutes/sentinelProtocolQaAutomationMessageRoutes.dev.js` | trusted attach-only Site/Global start, structured host/session snapshots, human observation or canonical input driving, natural Global rift-to-Room-478 completion, failure-only or Site STOP, and opt-in page screenshots |
| Real-site goal-end lifecycle QA | `scripts/qa/protocols/goalEndsRealSiteQaProtocol.mjs`, `src/domains/nudge/feed-flow/FeedBoundaryEpisodeCoordinator.js`, `src/domains/nudge/runtime/session/readFurinGoalEndState.js` | an owned ephemeral headless browser exercises public feeds with ordinary recorded Site/Global facts, acknowledged goal edits, Horizon-to-Furin admission, exact cancellation, combined receipts, recovery and later brief Site delivery; trusted passive reads observe typed receipts/exposure without manual realization or OS focus |
| Dev-only human foreground setup | `scripts/qa/protocols/humanSetupQaProtocol.mjs`, `scripts/qa/runtime/QaRunSession.mjs`, `scripts/qa/browser/qaOperatorBrowserWindow.mjs` | the `setup` command alone grants one exact PID/window-correlated operator focus preparation before feature realization, emits `QA_HUMAN_SETUP_READY` only after real feature readiness, retains runner ownership until explicit cancellation, then stops the feature and closes exact run-owned targets while preserving the managed browser |
| Dev-only VideoSkip control-surface QA | `scripts/qa/protocols/videoSkipControlSurfaceQaProtocol.mjs`, `src/domains/nudge/video-skip/automation/videoSkipControlSurfaceQaContract.dev.js`, `src/apps/background/services/runtime/messageRoutes/videoSkipControlSurfaceQaMessageRoutes.dev.js` | seven named YouTube/X/Instagram/TikTok/Reddit targets borrow the authenticated managed browser, activate VideoSkip only in one exact QA tab without settings or site-rule writes, prove the canonical hard-block behavior through trusted player input, and remove only the QA-owned session |
| Dev-only browser-native VideoSkip QA | `scripts/qa/protocols/nativeVideoSkipQaProtocol.mjs`, `scripts/qa/protocols/nativeVideoSkipFixture.mjs` | `video-skip/native-controls` owns an ephemeral dev-extension browser and original local 180-second VP8/Opus fixture; canonical acknowledged settings and one exact localhost site rule activate protection in the disposable profile; native UA DOM/AX identity and trusted input prove timeline removal, expired/pending keyboard focus handling, former-rail coordinate attempts, native clock/play/volume/fullscreen and OFF restoration; `observe` certifies observation execution only, never protection |
| Dev-only dashboard boot and capture | `scripts/qa/protocols/dashboardCaptureQaProtocol.mjs`, `scripts/qa/contracts/dashboardCaptureViewportContract.mjs`, `scripts/qa/protocols/dashboardCaptureDiagnostics.mjs`, `scripts/qa/protocols/dashboardBootArtifactDiagnostics.mjs`, `src/apps/dashboard/qa/zenMainCaptureProfileContract.js`, `src/apps/dashboard/qa/zenMainCaptureProfile.dev.js` | `dashboard/boot` and `dashboard/capture` share one protocol, artifact lease, owned-browser/Xvfb contract, and exact-session diagnostics; when boot built the dev artifact in the same run it first completes one unmeasured disposable-browser preparation, then measures one cold and bounded warm samples in a fresh owned browser, while capture selects a named surface and the Zen Main profile composes isolated koi/weather/time state plus canonical bonsai progression |
| Dev-only Feed consumption research | `scripts/qa/protocols/feedConsumptionResearchQaProtocol.mjs`, `scripts/qa/feedConsumptionResearchSuite.mjs`, `scripts/e2e/feed-consumption-research/**` | named attach-only platform targets run fixed model-blind DOM journeys, capture content-free product-model curves, fence research episodes out of personal-profile commits, preserve the managed browser, and aggregate pairwise separation without reconstructing Chrome/CDP ownership |
| Feed Horizon inspection and real Gesture Gate QA | `scripts/qa/catalog/qaTargetRegistry.mjs`, `scripts/qa/protocols/feedHorizonQaProtocol.mjs`, `scripts/e2e/feedHorizonInspectionE2E.mjs`, `scripts/e2e/feedHorizonCausalE2E.mjs` | target declares manual versus natural authority; protocol validates current manual lease/endpoint evidence; inspection owns bounded native execution/capture and trusted input; both paths share Gate neutral/backward verification; no policy clock or browser owner is duplicated |
| Attached Reddit surface oracle | `scripts/qa/catalog/qaTargetRegistry.mjs`, `scripts/qa/protocols/siteRuntimeAttachedQaProtocol.mjs` | `site/reddit-surface-attached` borrows one unique, already-open `/r/popular/` page from the authenticated managed-persistent browser, re-proves the declared browser identity on the exact CDP connection, attaches for one bounded DOM observation, and detaches; it creates, navigates, activates, scrolls, or closes no target and issues no settings, site-rule, extension-reload, or OS-focus action |

The Windows operator-handoff driver correlates the verified PID and exactly one
native window with the selected CDP target's bounds before any foreground action.
For minimized windows it reads `GetWindowPlacement` restored bounds and converts
workspace coordinates to screen coordinates, matching CDP's restored-bounds
contract; it never restores candidate windows to discover their identity. Normal
windows retain the existing `GetWindowRect` comparison. Zero or multiple matches
still fail, and the error includes the expected and candidate geometry.

Dashboard entry stage marks use the bounded event identity declared by
`src/apps/dashboard/bootstrap/dashboardEntryStageTraceContract.js`. `marks` mode
does not retain details, so the report derives each duration from the matching
stage-specific start/ready elapsed values; a null stage id is a contract failure,
not an acceptable low-detail sample.

## Execution Flow

### Cross-origin frame media hold

`media/frame-hold --mode=agent --presentation=hidden` declares the `ephemeral`
environment and `dev_extension` artifact. `mediaFrameHoldQaProtocol.mjs` owns one
disposable Chrome through `ExtensionChromiumHarness`; `mediaFrameHoldFixture.mjs`
owns a loopback-only server and three exact `.localhost` origins. Each real
document contains native audio and video elements backed by a local WAV asset.
One real button input in each exact document establishes normal playback
eligibility; measured iframe rectangles address descendant buttons. No
autoplay launch switch or emulated permission replaces this preparation.
The child and nested child have different origins from their parent. Nonce-bound,
origin-checked fixture messages read actual native media state; no media method,
clock, Chrome API, receiver, or broker response is replaced.

Before admission, each descendant receives two bounded native DOM mutation
rounds: an eleven-element nested addition with overlapping mutation roots, then
removal. The protocol reads the existing probe's debug snapshot from each exact
owned Chrome frame/document in the isolated world; it adds no product message or
page bridge. Each addition must visit eleven nodes in one subtree scan, and each
removal must prune the cache with zero subtree visits. Neither may cause a full
document scan or interrupt the original native media. The first active hold then
waits for its real fifteen-second renewal: an unchanged inventory must receive
one renew, no repeated begin, and no DOM scan, while forced READY recovery remains
observable. These are deterministic work-count assertions, not CPU-time or
real-site long-task certification. The evidence records actual elapsed time
without a performance pass/fail threshold.

The existing Sentinel development START/STOP realization enters the product hold
path. Evidence requires both actual paused media and separate accepted/verified
broker receipts. It covers replay while held, child document replacement and
re-enrollment. Before replacement, a real Furin Continue activation resolves
the Site interaction through its ordinary completion ACK; the known originally
playing six-element cohort must resume without a fixture play request and the
broker must report verified per-frame resume counts. A later STOP instead checks
manual playback after release: one trusted top Play-button click forwards the
fixture's explicit play requests, after which all six native clocks must advance.
Individual descendant clicks are required only for initial autoplay preparation;
their delivery after navigation is not an extra product release criterion. This
keeps manual release separate from automatic restoration. It also covers
nested-frame host permission revocation, release, and top-document
navigation cleanup. Iframe seek capability must remain `unsupported`. This is
runtime actuation and lifecycle evidence, not ordinary intervention admission,
physical foreground use, audio-output quality, or third-party-player coverage.

The copied manifest promotes only `scripting` and the three exact loopback hosts.
The existing `withExtensionManagementPage` owner opens and closes its own
`chrome://extensions/` target. Its real Chrome site-access backend configures
specific-site access and removes the nested host; `chrome.permissions.contains`
independently verifies the resulting grant. The helper rejects attach-only or
unverified processes. It never edits an operator profile or changes the shipped
manifest. No browser launch flags, separate CDP connection, or manual target
lifecycle is introduced.

Navigation readiness is tied to the exact main frame and committed loader
acknowledged by CDP, with document URL and ready state checked between stable
frame-identity reads. Reload requires a new loader; same-document navigation
retains its previous loader and reaches the exact requested URL.
`DOMContentLoaded` is diagnostic evidence rather than a mandatory readiness event.
Management-page preparation retains its five-second bound and never activates
or refocuses the tab. Timeouts retain bounded frame, document, and error diagnostics
without URL queries or fragments.

The target claims Sentinel runtime capacity. Only `--rebuild` is configurable
beyond the common mode/presentation contract. `media-frame-hold.json` records
bounded native snapshots, document identities, feature support, and permission
receipts. Reverse cleanup stops an active Sentinel, writes evidence, closes the
exact owned browser, and closes the loopback server. A stubbed unit test is only
an evidence-contract check; a browser PASS requires the named target's completed
run and successful cleanup envelope.

### Cross-intervention collision runtime

`intervention/collision/runtime --mode=agent --presentation=hidden` owns one
ephemeral dev browser, two exact loopback pages and a loopback fixture server.
The existing harness promotes optional `scripting` and those two exact host
permissions only in its copied disposable artifact; the published manifest is unchanged.
`chromiumHarnessManifestPromotion.mjs` admits explicit HTTPS hosts and HTTP
loopback hosts (`localhost`, one named label under `.localhost`, `127.0.0.1`).
Wildcard hosts (apart from the two literal integrated-journey loopback grants
documented above), arbitrary HTTP/LAN origins and port-bearing match patterns
remain rejected. Chrome host-permission match patterns are port-independent; the protocol
binds its server to loopback and retains the exact run-owned page URLs separately.
It claims both Gate and Sentinel runtime capacity. It never attaches to or
terminates a human/managed browser. Only `--rebuild` is configurable.

The dev-only `QA_INTERVENTION_COLLISION` route requires the trusted harness and
`collision-a.localhost` / `collision-b.localhost` (read/retired-lease replay also
admit the existing Gate page). A fixed Site/Global/combined candidate enters the existing
`maybeTriggerProtectionNudge` serialized dispatcher with `force: false` and its
existing runtime-override seam. It writes no usage history, model score or clock.
Candidates include the verified target hostname and canonical unavailable Site
reflection DTO: null observation times, no represented history, and empty segments.
Real run issuance, pending/debt, content entry seam, FIRST_FRAME, admission and
absorption remain authoritative. Its isolation fixture invokes the existing
Gate controller. Gate automation preserves explicit admission refusal codes so
an invalid presentation is not mistaken for successful exclusion. Read-only
evidence uses typed session repositories; retired Enso
end/closure replay goes through the actual admission/closure owners and rejects
a still-owned lease or an absent successor before any destructive request.

Existing runtime-debugger Enso realization accepts an explicit `admissionMode:
ordinary` for this detector fixture. Human/default debug remains manual. This
checks the ordinary shared admission path, not detector timing or human intent.
Candidate conditions are fixtures; they must not be reported as observed usage.
Concurrent Furin requests attach success and rejection handlers before input
preparation. A known failed request suppresses its pending input, and every
started request settles before an input/route failure reaches session cleanup.
Input waits for a fresh entry-seam armed receipt in the exact current document
or an early request settlement; fixed elapsed time is not evidence of readiness.
Route failures retain bounded permission phase/revision evidence; they must not
escape as an unhandled rejection that skips the owned cleanup stack.
Ordinary Enso also requires its consumption cadence independently of recovery.
The protocol first requires a pre-due refusal with no owner or surface, then uses
the payload-free `prepare_enso_candidate` operation on the existing trusted
collision route. Its dev-only protection automation owner serializes through the
actual admission `run`/`save` boundary and refuses an active owner, recovery,
inactive tab, disabled policy, or pending observation. It prepares the current
interval's due counter and a synthetic consuming anchor; its immutable before/after
receipt records `synthetic: true` and `naturalConsumptionObserved: false`.
The subsequent ordinary request remains `manual: false` under unchanged production
admission, and actual isolation preemption must reset cadence to zero. This fixture
accepts no arbitrary timestamp, duration, history, kernel, or entry-approval writes.
It certifies prepared-candidate arbitration, not natural consumption timing, and
the operation is omitted from public builds.
Before those fixtures, an ordinary navigation triggers Shishi and its real
Continue establishes shared entry approval. The run waits out that presentation's
actual recovery, checks the same decision in the second protected tab, and
requires it to survive Enso, Site/Global Furin, worker recreation and the remaining
collision sequence. Entry approval must never become an Enso/Furin exemption.
Entry is enabled while the active source is the existing harness marker page,
then one protected navigation begins the scenario. Enabling it on a freshly
entered protected page could trigger the Gate during settings propagation before
the intended navigation. The marker is validated against this run's extension ID
and the canonical trusted-page path; `openPage('about:blank')` intentionally
retains that ownership marker until the first web navigation.

The scenario requires ordinary Enso/Furin/Gate exclusion, unshown candidate
rollback, renewed-demand retry, matching Site absorption only after Global
presentation, mandatory cleanup including input/media, stale callbacks,
manual/automatic isolation, competing tabs, worker recreation, and actual
45-second recovery without automatic queue replay. The run records a bounded
trace. Product-policy unit regressions remain necessary for simultaneous-arrival
ordering and failure windows that this fixed browser journey does not induce.
Daily order is full Site A, manual Site B exclusion, still-eligible brief Site B
and Gate competition, then first Global A presentation and Site absorption.
The competition proves pending brief state and arms native input before the Gate
request. Evidence distinguishes a shared-admission refusal from cancellation by
Gate navigation; the latter does not certify that both requests reached admission.
Exact winner cleanup and real recovery precede the next candidate. Daily receipts
are never reset or moved to another date to keep a fixture eligible.
After navigating its manual Furin target, the protocol waits for a new active
bootstrap receipt before its single START; a cached prior-document readiness
receipt is not sufficient fixture preparation. START is never retried.

### Managed runtime activation and concurrent builds (2026-09-11)

`ExtensionChromiumHarness` owns the single preparation sequence: exact managed
profile/slot admission, staged pinned artifact, necessary load/update, and live
runtime proof. The existing CDP `Extensions.loadUnpacked` owner also activates an
inactive **exact canonical managed slot** once; it validates unchanged extension
ID and active readback. This is declared QA run preparation, not an alternate
profile, uninstall/reinstall loop, generic recovery or an external-browser action.
Foreign unpacked paths, unknown identity and live human capacity still block.

First installation uses `Extensions.loadUnpacked`. Existing-extension reload
uses Chrome's `developerPrivate.reload` in one exact owned extension-management
page as its sole strategy: re-registering an unchanged loader URL through
`loadUnpacked` was observed to replace the worker target while retaining old
compiled background code. Reload keeps the managed load anchor/target protections,
checks the exact enabled extension ID, reports any returned load error, waits for
old worker exit and replacement, and never calls runtime.reload or reinstall as
a second strategy. Foreign/external profiles remain outside this reload authority.
Activation receipt V3 decides whether an update is needed. Every run, including
receipt reuse, proves the running background's compiled build ID and profile via
the existing trusted `DEBUG_GET_TRACKING_RUNTIME_STATE` response. On-disk metadata
and manifest are separate artifact/permission facts; neither substitutes for that
live response. Existing `ENTROPY_RUNTIME_BUILD_INFO` is the code identity owner.

The `document` observation policy verifies an active, visible, non-minimized page
without claiming OS focus, Tracking foreground consumption or a minimum frame
rate. `animation` additionally requires native frame supply; `foreground` also
requires real focus and Tracking admission. The functional protected-site entry
journey uses document policy; performance/consumption evidence retains stronger
requirements. No probe takes focus to repair a missing prerequisite.
Document-only targets may use background presentation and human/agent modes;
they require the existing managed visible window and grant no initial focus.
Animation/foreground declarations retain their agent-only foreground presentation
contract. OS foreground snapshots record window state, not who caused a change.
The shared adapter raises `QA_ATTACH_EXECUTION_UNAVAILABLE` if a valid native
observation loses its required capability; the evidence owner classifies that as
INCONCLUSIVE. Invalid responses and build identity mismatches remain failures.

`qa/runtime-stability --mode=agent --presentation=foreground` exercises this
infrastructure on one exact owned blank page. It asserts compiled runtime identity,
worker replacement/wake and document liveness. `--rebuild-during-run` invokes the
canonical npm build owner while that QA runtime remains live, then proves pinned
artifact identity and the same running code across another worker wake. It does
not create product sessions, alter usage/settings, interact with social sites,
restart the browser or request OS focus. Repeated separate runs cover update and
reuse through the same managed owner. All targets/pins/leases are exact-run cleanup.

`qa/extension-reload` is the narrower repeatable manual preparation target behind
`npm run qa:reload`. It uses `authenticated`, the same artifact admission and
managed stage/activation owners, and exact helper-target cleanup. When startup
already loaded/reloaded the admitted build it preserves that proof; when startup
reused an active runtime it explicitly reloads from the same canonical slot and
repeats artifact/tracking readiness proof. No product setting, approval, usage
fixture or site tab is created or changed. `QA_EXTENSION_RELOAD_READY` records
build ID, extension ID, activation and live readiness. PASS proves this limited
infrastructure scope. A failed reload/readiness proof remains terminal. Existing
operator pages, login data and the persistent browser are retained. Site pages
need an operator refresh before judging changed content behavior.

After the readiness response, this target reads the existing bounded
`__ENTROPY_SERVICE_WORKER_WAKE_TELEMETRY__.snapshot()` through
`ServiceWorkerCdpDiagnostics` and records `QA_EXTENSION_RELOAD_WAKE_TELEMETRY`.
The exact replacement worker is attached without pause only after the measured
startup has responded, and the diagnostic session is detached before harness
cleanup. Missing telemetry or collector/cleanup failure remains a failure;
the target adds no product message, payload recorder, storage write or retry.
This finite startup observation is exploratory timing evidence, not a latency
budget certification or a claim about unobserved site requests.

`maintenance/profile-reset --confirm-erase-entropy-data` is an explicit destructive
maintenance target for the approved development-profile `settings.core.nudgeConfig`
contract failure. Run it only after the operator authorizes erasing Entropy data
in the declared persistent `authenticated` Chrome for Testing profile. The flag
defaults to false and omission rejects before harness startup. This command uses
the same artifact admission, exact browser/profile identity, managed stage and
target cleanup owners as ordinary reload; it requires no connected browser tool.
Its preparation callback verifies the served build and reads fresh typed profile
readiness. Only `SETTINGS_STORED_VALUE_INVALID`, matching current generation, and
the exact `settings_profile_recovery_v1` / `settings_contract_reset` / `full_reset`
descriptor for that document and key admit mutation. Unknown, malformed, absent
or different recovery evidence is terminal. The descriptor alone grants no reset.

The callback sends one canonical `RESET_APP_DATA` request. Existing security and
passcode authorization remain authoritative; refusal is terminal and no passcode
is guessed or bypassed. No raw storage clear, database deletion, extension removal,
per-key repair or alternate profile is allowed. The successful `full_reset`
handoff must be ACKed from a real, exact owned Dashboard page by the existing MV3
handoff helper. The old worker must exit and a new worker must pass the unchanged
`proveEntropyAttachedArtifactRuntimeReadiness` checks before harness admission
can succeed. A separate maintenance receipt records the admitted recovery,
canonical reset, ACK and worker replacement; the ordinary activation receipt
does not erase that history. It contains no raw settings, journal, generation,
secret or passcode. PASS covers the authorized reset and fresh runtime readiness,
not product journeys or foreground consumption. Failure after a committed reset
remains a failed maintenance run and never causes automatic destructive retry.
Ordinary `qa:reload`, diagnostics and lower browser admission never reset data.

The shared tracking readiness probe records a closed response shape label and
an exact allowlisted named rejection code in its bounded failure message. An
unknown error value is `unclassified`; raw response data, error text, runtime
snapshots, URLs and settings are not exported by this diagnostic projection.
Explicit non-ready replies remain terminal. The response label distinguishes a
negative ACK from missing or malformed response/runtime shapes; it does not
certify the cause of a failed full initialization or authorize profile reset.

After a tracking readiness failure, the same adapter observes one canonical
`GET_SETTINGS({keys:[]})` through the existing trusted helper before startup
cleanup. This empty read tests the earlier Dashboard boot-read gate and returns
only `earlyReadinessDiagnostic`: `readable`, `rejected` with an exact static
allowlisted owner code, `unknown`, or `unavailable` with a closed reason. No
settings values, raw response, journal or error text cross
that projection. Known security blocks preserve only the exact named codes
`SECURITY_VAULT_INCOMPATIBLE`, `SECURITY_VAULT_PLAINTEXT_PROFILE_UNSUPPORTED`
or `SECURITY_VAULT_ENVELOPE_INVALID`; they remain rejected diagnostics without
granting recovery or exposing vault contents. The query uses at most the
existing two-second probe budget
inside the original twelve-second absolute readiness deadline, reserves the
existing delivery grace, and joins the child protocol cancellation owner.
Expired deadlines and closing sessions skip the query; lost callbacks, transport
failure and cancellation stay explicit. A readable result does not change the
original strict reload FAIL, retry initialization, or authorize profile reset.

An exact named rejection also admits one diagnostic-only current-generation
read: the injected read-only `ProfileResetLifecycleStore` reads only
`PROFILE_RESET_LIFECYCLE_STORAGE_KEY` through that trusted helper, and
`ProfileResetLifecycleRepository.read()` validates the private packet before
`resolveProfileResetGeneration` and the canonical epoch validator supply the
request generation. An absent lifecycle uses the owner's initial generation;
present null, undefined or malformed lifecycle remains invalid. No raw journal
or generation identifier is retained in evidence. One
`GET_PROFILE_GENERATION_READINESS` then records `profileReadinessDiagnostic`:
`ready`, `rejected`, `unknown`, `invalid` or `unavailable`, an exact allowlisted
code, a closed reason, `generationMatch`, and only a normalized settings/profile
compatibility recovery descriptor. Own descriptor presence, exact schema and
outer failure code must agree; no descriptor authorizes an automatic reset.
The lifecycle read and dedicated query share one two-second probe deadline
inside the original absolute deadline and existing child cancellation owner.
Closure, cancellation or budget exhaustion prevents the next request; callbacks
after settlement cannot alter evidence. A ready diagnostic retains the original
strict reload FAIL. This seam writes no storage and performs no recovery action.

### Protected-site automatic journey

The 2026-09-11 entry contract also verifies shared approval after Continue and
reload, waits 46 real seconds beyond common recovery, reapplies settings and
navigates the same owned tab to X. The exact approved session/decision must remain
and no Gate may replay. Existing approval yields BLOCKED and is preserved. Cleanup
releases only the approval whose session ID this run actually presented, through
`QA_GATE_RELEASE_ENTRY_APPROVAL`; no raw storage restore or foreign release occurs.
The trusted dev read includes `entryApproval`. Manual PRESENT fixtures never grant
production approval. The local consumption-entry protocol now asserts this approval
across restart/switch/settings; the collision protocol remains the positive proof
of recovery admission refusal between independent interventions.

`consumption/protected-sites --mode=agent` uses the managed `authenticated`
browser and exact dev artifact. It follows YouTube → X → YouTube → example.com
with fixed wheel-only input and ordinary Tracking beats, then enables entry
through settings and navigates a fresh document to YouTube. No candidate, model,
clock, foreground, history, Furin or Enso detector fixture is injected. It checks
the automatic Gate's frozen reason, real Continue outcome, successor document
readiness, same-URL reload identity and absence of duplicate Gate after Continue.
Successor readiness must have a different document ID and begin after the
specific Continue/reload boundary; a ready pre-Gate document cannot certify it.
The shared entry approval prevents this duplicate; it is not a positive proof of
the shared recovery policy (the collision/consumption-entry targets own that).
Unknown outside intervals must never become certified rest.

The target accepts `--scope=journey|entry` (journey by default), `--verify-departure`,
`--rebuild` and `--allow-initial-window-focus-once`. Both scopes verify shared
approval beyond the 45-second recovery, settings reapplication, another protected
domain, multiple protected tabs and worker recreation. Entry skips the consumption
soak; its PASS certifies these entry boundaries, never measured multi-site use.
`--verify-departure` additionally observes real wall-clock departure through the
existing Tracking heartbeat: approval survives five observed minutes away, ends
after ten, and a subsequent protected navigation produces a fresh Gate session.
No read, injected observation or shortened timer may advance that boundary.
Unobserved or interrupted departure is INCONCLUSIVE; failure to preserve approval
or expiry without the required evidence is FAIL. This operational entry signal
is distinct from certified consumption recovery: confirmed browser departure
with no protected audio can end entry approval without proving user rest.
The target registry declares observation policy by scope, validated by
`qaBrowserObservationContract.mjs`: `entry` resolves to `document`, `journey`
to `foreground`. The compiler resolves this once; lifecycle/protocol owners
consume that result, not their own target/scope branches.
Entry reuses an already visible managed window and makes **no initial OS focus
request**, even if the general `allowInitialWindowFocusOnce` parameter is true.
An empty browser requires an existing page; the run does not create an anchor
to focus/minimize it. Native visible/active-tab state and responsive execution
are sufficient for this scope. Frame supply, window focus, `document.hasFocus()` and Tracking
foreground-source admission are recorded but not entry acceptance conditions.
Its PASS does not certify foreground consumption. No focus/visibility emulation.

Journey foreground observation requires an already suitable managed browser
window by default; `allowInitialWindowFocusOnce` defaults to false. An explicit
`--allow-initial-window-focus-once=true` permits `QaInitialWindowFocusAnchorLease`
with `agent_present_once` only when this same run's lifecycle owner actually
started the exact verified process. Attaching/retrying an `already_ready` process
never creates a focus anchor or restores/minimizes/moves its window, even with
the old opt-in still true. `qa:open` remains an explicit operator presentation
request. Steady-state OS focus remains `never`.
At least two minutes of confirmed protected consumption, three
committed ≥30-second source contexts in the requested YouTube → X → YouTube order,
and an actual automatic Gate are required for PASS. Setup history cannot supply
those contexts. The final protected context is read after switching away so an
unfinished segment cannot certify the return. Actual outside foreground may
produce certified outside time bounded by its observed interval; unknown evidence
cannot become rest. No focus, visibility, time or model value is emulated.
The bounded `protected-sites-trace.json` records boundary evidence. Touched
settings are restored through SET_SETTINGS, existing site rules/budgets are
preserved, and only rules added by this run are removed through REMOVE_SITE_RULE.
History deletion and bookmark concealment are disabled during this journey and
the shared real-site runtime scenario configuration. Managed processes and all
unowned targets are preserved. This target does not certify local Enso timing;
`feed/gate/x-home` remains the natural feed-to-Gate causal-chain target.
If exact-tab Tracking admission fails during preparation, the protocol reads
actual Chrome window focus through the trusted harness. Only confirmed absence
of every focused browser window permits an explicit INCONCLUSIVE result with
no continuation of dependent steps; other admission failures remain FAIL.
Before the soak, periodically within each phase, and before the Shishi gesture,
`attachOnlyActivePageAdapter.mjs` reads native tab/window state, Tracking's exact
source IDs, and a passive 1.2-second animation-frame sample. Native window focus,
native document visibility/focus, Tracking admission and at least 10 frames/second
are independent execution prerequisites for journey. Entry requires a visible
native active tab and responsive document, without a frame-rate or focus minimum.
Missing valid prerequisites yield
INCONCLUSIVE with the exact reason and no dependent continuation. Malformed
evidence or an outcome failure under valid prerequisites remains FAIL. This is
a QA prerequisite, not a product performance threshold. Probes never repair
focus/minimization, fabricate frames, or continue through unavailable evidence.

### Real-site goal ends

```powershell
npm run qa -- run consumption/goal-ends
```

`consumption/goal-ends` uses the canonical development artifact and existing
owned `ephemeral` extension harness with a fresh disposable profile. Its fixed
public surfaces are YouTube Shorts
(`https://www.youtube.com/shorts/3_YhyeHjOWI`) and TikTok ForYou
(`https://www.tiktok.com/foryou`). It accepts only `--rebuild` in addition to the
common presentation parameter. The target defaults to `presentation: hidden`;
the protocol requires actual owned headless execution and rejects foreground or
background presentation before constructing or starting its harness. It has no
initial-window focus option or presentation policy. Chrome starts with no visible
window and no OS focus request. There is no headed retry, authenticated-profile
copy or substitution of an existing persistent browser.
The disposable manifest promotes exactly `idle`, `scripting` and `webNavigation`
plus the two public origins through the existing promotion owner. Permission is
verified before recording or goal authorization. Idle supplies normal tracking;
webNavigation supplies the exact document fence. This target does not test the
permission prompt.

The target omits the persistent-headed `browserObservation` policy. Its own
documents must be naturally visible/active within headless Chrome and provide
real renderer/input evidence. Tab selection uses
`activateOwnedEphemeralPageWithoutWindowFocus`; focus/visibility emulation is not
admitted. Ordinary Tracking must actually record the headless browser's native
tab/window facts and advance the canonical Site/Global activity. This is
functional browser-runtime evidence, not certification of physical OS foreground,
natural human consumption or a physical display. If public feed readiness,
ordinary recording or an input boundary is unavailable, the exact failure or
prerequisite classification remains visible. Login, CAPTCHA, empty feeds and
unsupported topology never authorize profile replacement or a headed fallback.

The recording setup uses real visible site media and normal play/unmute actions
while the browser process retains `audioPolicy: muted`. Host audio stays muted.
Native OS idle state and `Tab.audible` are observed independently: an active idle
state permits ordinary collection; an idle state requires the existing real
audible-media exception. Media playback alone is not an audible receipt. The
protocol changes neither OS idle state nor elapsed time and never resumes media
during an intervention. The recording wait does not scroll to a different muted
player. Native Tracking source admission is observed before the wait;
unavailable source, media or recording evidence cannot count as attainment.
Windows idle is the host's real inactivity state; CDP interaction in a headless
document does not manufacture OS input. If the host is idle and the muted tab
has no native audible receipt, this ordinary-recording scenario remains BLOCKED.
That prerequisite grants no focus/input injection and does not impose a headed
mode on other functional targets.

The protocol temporarily enables the Site/Global goal preferences through
canonical acknowledged settings, leaves periodic Barrier reflection OFF and
registers its required rules through the existing site-rule command owner.
Ordinary Tracking observations supply actual recorded activity. Goal edits may
arrange attained/unattained eligibility against those recorded facts; there is
no stats, candidate, history, clock, foreground or manual START/force injection.
This is public-site boundary and policy-lifecycle evidence, not certification of
a naturally occurring 15-second goal threshold, physical foreground time or user
benefit.

The ordered assertions require a Site-owned Horizon while Global is unattained,
retained exact Site ownership when an acknowledged Global-goal edit makes Global
attained, and exact Site cancellation both before and after actual Horizon
encounter. Changed bindings cannot retain the endpoint, reuse the old forward
input or write a final receipt. Fresh selection when both scopes are actually
attained must deliver one combined Global episode: actual Horizon encounter,
fresh deliberate continuation, actual Global Furin paint, one Global receipt
and a matching current-host `siteEnds` receipt, with no fabricated Site Furin
presentation.

For TikTok's pre-endpoint readiness input, QA uses the existing declared
native feed-step owner with its independent before/after DOM oracle and bounded
native media evidence. A stalled wheel uses that owner's native ArrowDown
action. The action receipt alone cannot pass readiness: the unchanged product
semantic/topology, admission and armed-endpoint observation must still succeed.
YouTube input, endpoint encounter and continuation retain their existing owners.
Continuation first observes the exact run/lease's encountered,
active endpoint with live controls and no remaining hold in the visible native
document. After the real wheel-gesture quiet boundary, it uses the existing
trusted endpoint demand action and records its native input receipt. A fixed
delay is not controls-readiness proof, and a lone 320px wheel cannot cross the
production 480px pull threshold. Combined and later Site paths use the same
readiness/input sequence; read-only polling cannot complete continuation.
If the debugger relay rejects a snapshot because an item URL changed during
its readiness check, QA records that exact error and permits one fresh snapshot
through the same strict relay only after proving the same owned tab, native
time origin, canonical document/session key, origin/host and semantic surface.
It rechecks those identities after the read and requires the same debugger
capture start and kind. This never starts or resets a debugger session, follows
a replacement document, or relaxes the runtime URL guard. Missing identity,
another route/capture, a second relay failure or incomplete evidence stays FAIL.
Increasing the goal after acknowledged paint preserves the original
actual-delivery receipt. A subsequent explicit nudge-policy OFF ends the live
Global surface; changing an already-delivered goal alone is not assumed to
cancel the shown experience.

After that whole episode ends, the protocol waits 15 real seconds, makes the
already-recorded secondary site's goal attained through its canonical goal
command, and verifies no presentation during the common 45-second recovery.
The end anchor is the committed, settled `presented` exposure interval containing
the Global receipt's actual paint timestamp, not DOM disappearance or the
independently received nudge terminal timestamp.
Recovery expiry alone must not start an intervention; only a fresh supported
boundary can admit that site's brief Furin. Global's previous delivery cannot
absorb this distinct Site end. Re-entry/reload and another same-host tab must
preserve the exact host/day cap without another final display. Near-goal timing
here measures wall time between actual episodes and acknowledged policy edits;
it does not assert that Tracking naturally observed two thresholds 15 seconds
apart.
Later Site acceptance proves the actual Site surface and canonical brief receipt;
it does not observe private renderer configuration or bypass the production
ownership exclusion on manual Sentinel snapshots.

`QA_SENTINEL_GOAL_STATE` is the one dev-only passive observation action on the
existing Sentinel channel. It accepts an empty payload and validates the trusted
harness sender and exact web target before reading `readFurinGoalEndState()` and
`InterventionAdmissionService.readExposureSnapshot()`. It returns
`{ goalEndState: { dailyReceipt, pending, terminal }, interventionExposure }`.
It does not prepare content, dispatch to the page, reconcile admission or write
state. Existing START/SNAPSHOT/STOP production ownership exclusion remains in
force. The coordinator's existing debug snapshot additionally projects its
passive `goalEntry` identity and encounter/handoff phase; ordinary periodic
diagnostics retain their original meanings.

The exact run retains decisive phase, binding/run/lease, exposure, actual receipt
and cleanup evidence. Settings and affected rules use canonical command and
propagation ACK owners in the disposable profile. Real daily presentation
receipts remain intact throughout the ordered scenario; they cannot be reset,
retagged or fabricated to make later steps eligible. Exact receipt evidence is
retained before the owned browser/profile teardown. Existing user tabs, profiles,
settings and persistent browser processes are never attached or modified.
Cleanup closes only the run-owned browser/targets and its disposable profile
through the existing harness lifecycle. PASS requires the full ordered scenario
and confirmed cleanup, not a successful manual Furin or an isolated Horizon
screenshot. A debugger `episode: null` means the lazy Feed coordinator provider
has not registered yet; the observer records that readiness state and waits
when a prelude is expected. A registered inactive coordinator instead supplies
its explicit snapshot and endpoint state. Recovery and a fresh capped document
can legitimately have no Feed coordinator; absence assertions still require
the authoritative goal-runtime state and actual document/DOM evidence. They
cannot treat an unavailable goal owner as proof that nothing was displayed.
An actual new `primary_media_boundary_unproven` abort ends the boundary wait
promptly and retains its exact binding plus a read-only native media inventory.
This diagnostic exposes containment, root-host ancestry and geometry without
relaxing the product safety decision. Cleanup retains exact rule-removal replies;
an incomplete restoration remains a cleanup failure alongside the original cause.
While waiting for a goal prelude, a content entry must retain its exact canonical
pending run. A missing run fails immediately and preserves the sample before
collecting existing global and per-tab runtime diagnostics. Handoff or actual
final-presentation evidence is assessed by its later lifecycle assertions.

### Goal delivery with controlled budget facts

```powershell
npm run qa -- run intervention/goal-ends
```

`intervention/goal-ends` is a separate agent-only functional target. It uses the
same public sites, owned disposable `ephemeral` profile and development artifact
as `consumption/goal-ends`, with required hidden/headless execution, muted host
audio and no OS-focus grant. It verifies Horizon encounter, Furin paint, nearby
Site/Global ownership, recovery, daily display caps and goal-edit cancellation.
It does not certify ordinary time collection or naturally occurring attainment.
An ordinary collection FAIL or BLOCKED run remains a separate recorded result.

The development-only `QA_GOAL_DELIVERY_CHARGE` fixture adds explicitly synthetic
V2 observed/protected facts through the StatsCollector batch and durable-save
owner. Pre-registration observed facts have zero protected charge; registration
must not retrocharge them. Post-registration protected facts require canonical
recording and effective protection scope. The bounded additive request never
changes native idle state, clocks, foreground admission, candidates, presentation
receipts or recovery timers. The protocol never automatically retries an
additive request with an unknown outcome.

Admission requires the exact functional target/protocol, development artifact,
owned headless execution and per-run private copied extension. A packaged helper
seal binds its nonce, run, target, scope, ephemeral profile kind and execution;
the route proves its actual top-level extension sender/document and current
profile generation before committing. Metadata alone is not proof of a private
browser: the CLI/harness must independently prove ownership. Attached browsers,
persistent profiles and load-in-place artifacts are ineligible. Production
builds exclude the fixture action, route and mutation adapter.

The evidence marks every fixture receipt synthetic and sets
`naturalCollectionCertified: false`. Actual public-site renderer/input evidence,
goal decisions, the full 45-second recovery, actual paint and final daily
receipts remain required. PASS covers only this functional scope and confirmed
cleanup. The ordinary target exposes no option to select this fixture.

### Observed consumption to entry checkpoint

`gate/entry-checkpoint/consumption --mode=agent --presentation=foreground` uses the
existing ephemeral owned Chrome environment and exact dev artifact. It exposes
`--rebuild` and `--allow-initial-window-focus-once` (default false), and accepts no
model, time, or intensity override. The existing upper-session owner prepares
the first exact owned UI tab once before observation; explicit focus opt-out
makes no request. The protocol owns a loopback-only fixture server and five exact pages
(`a.localhost`, `b.localhost`, `outside.localhost`). Settings go through
`SET_SETTINGS` and site rules through `UPSERT_SITE_RULE`, with successful propagation
ACK for changes in that disposable profile. Reapplying unchanged settings requires
an explicit empty `changedKeys`, matching committed values and `propagation: null`;
it does not fabricate a propagation job. All target
activation uses the harness's no-window-focus owner.

Real browser ingress and ordinary 60-second Tracking beats must produce at least
approximately five minutes of committed protected use across two domains
(minimum 290 seconds, avoiding a whole extra beat for millisecond boundary jitter). Only then is entry
enabled through settings and a new tab's ordinary protected navigation required to produce a
nonzero, non-fixture intensity. The real authorized Gate session must retain its
value across service-worker stop/revival and complete via real foreground wait/native Enter.
The scenario verifies one completed exposure and the same explicit Continue
approval after another worker restart, a protected tab switch and settings
reapplication. Ordinary entry stays enabled through further committed protected
use, five minutes of outside points interpreted as unknown intervals, and return
to the earlier protected tab. More use or the short departure must not revoke
approval, erase durable memory or replay a Gate. The final exposure snapshot must
still contain exactly one presentation. Run time is approximately 13–17 minutes,
bounded per phase.

`QA_GATE_READ_CONSUMPTION` is a trusted-harness, dev-only read of the existing
Tracking flow/warm memory and Gate session (including its frozen policy reason).
It neither advances a batch/model nor requests admission, creates a session,
persists history, or selects another policy. It reads no protection/statistics
query during polling; revision races are not hidden by a QA fallback or score
substitution. The protocol records a bounded phase trace under its run
attachments, including failure boundaries. This is
synthetic local-page browser evidence, not human attention/rest evidence or a
replacement for the public `lifecycle/mv3` target. The separate runtime target's
baseline/maximum fixtures remain actuator tests.

```text
target id + mode + parameters
  -> target registry
  -> local environment resolution
  -> named browser installation + profile-slot resolution
  -> browser requirement + named presentation resolution
  -> orthogonal reusable browser execution leaves
  -> immutable execution plan
  -> durable run/session recovery journal
  -> non-browser exclusive resource claims
  -> artifact lease and optional build
  -> for managed_ensure_before_attach only: exact managed-slot ensure
  -> environment browser broker
  -> browser preflight/lease
  -> display lease
  -> one target protocol
     -> process-held browser capacity
     -> owned launch or attach-only connection
     -> GPU classification
     -> target ledger
  -> reverse-order cleanup
  -> terminal evidence envelope
  -> terminal journal state, or active recovery-required state after incomplete cleanup
```

There is no best-effort target discovery, browser-profile substitution,
artifact-profile substitution, generic visual fallback, or automatic recovery
from an unknown lock owner. Missing canonical input is `BLOCKED` or `FAIL`, not
an implicit alternate path.

The environment broker and capacity owner are process-held loopback endpoints,
not persistent lock files. The environment broker serializes one declared
browser/profile/extension slot for a QA run. Its
`.artifacts/qa/browser-broker/<environment>.json` file is observation only; a
live endpoint is canonical, so a killed agent leaves historical evidence but
cannot strand the next run behind a stale lock. `ExtensionChromiumHarness`, the
deterministic visual capture engine, CWS measurement, MV3 lifecycle wrappers,
and standalone research runners acquire capacity before attaching to or
launching Chromium. Run-owned browsers use one Git-common project scope so
worktrees of the same repository cannot bypass each other. An attach or managed
persistent browser acquires two independent host-global identities: its
normalized loopback CDP origin and its canonical user-data-directory root.
Existing profile paths resolve symbolic links or Windows junctions before host
case normalization, so an alias of one physical profile cannot acquire a second
capacity slot. Windows drive paths and their explicit WSL spelling share that
same canonical identity.
`profileDirectory` remains part of exact browser identity verification, but it
does not partition capacity: Chromium singleton ownership and Entropy's
extension artifact slot are both shared by the user-data root. Consequently the
same endpoint with a conflicting root, or the same root exposed on a conflicting
endpoint or profile directory, cannot be manipulated by another checkout.
Acquisition is sorted, partially acquired locks roll back in
reverse order, and an identity probe nested inside lifecycle admission may only
borrow a reservation whose private held identities prove it is a subset of the
outer lease. A concurrent owner fails with
`QA_BROWSER_CAPACITY_BUSY` and is reported as `BLOCKED`, including when that
marker crosses a QA child-process boundary. The operating system returns the
lock endpoints if their Node owner dies, so an interrupted Codex/app session
cannot leave a stale capacity lock. That is lock recovery only: it is not proof
that a process or target created before the crash disappeared. Normal release
occurs only after the owned browser and temporary server cleanup path has run.
This contract never scans for or terminates personal Chrome, an operator-owned
authenticated QA Chrome, or a browser started by another repository.

Concurrency is resource-keyed rather than globally single-process: observation,
source-only, and other runs whose declared claims and physical browser
identities are disjoint may proceed together. Named `visual_capture` protocols
with the `source_render` artifact and run-owned `visual` environment compile
`captureConcurrency: shared_capture`. Their read-only source/runtime claims and
owned environment broker are run-scoped. Each run owns a separate server port,
UUID Vite cache, Chromium and evidence root. `BrowserCapacityLease.mjs` admits
two captures in the Git-common project scope before source-server startup.
Each slot is process-held; its responder thread stays available while the
caller transforms source. A third capture returns `QA_BROWSER_CAPACITY_BUSY`
without starting a server. Unknown or old exclusive owners never authorize
another slot.

Targets may explicitly declare `concurrency: isolated_functional` for ordinary
functional assertions. The default is `exclusive_measurement`. The compiler
admits the functional class only with a run-owned, `per_run` development
extension environment, no shared profile/profile directory/CDP/extension slot,
no physical-GPU requirement, no during-run rebuild or child artifact lane, and
steady-state `osFocus: never`. Its `runtime:*` claims and owned browser broker
are scoped to the exact run only for compiled hidden/headless execution.
Selecting foreground/background on an eligible target compiles exclusive
capacity and unpartitioned runtime/broker claims, preserving native window/input
isolation and its explicitly authorized initial presentation. The shared development artifact claim remains
global until the artifact owner proves and pins an immutable run copy.

`consumption/goal-ends`, `intervention/goal-ends`, `settings/concurrency`, `settings/propagation`,
`intervention/collision/runtime`, `video-skip/native-controls`, and
`gate/entry-checkpoint/runtime` opt in. Their protocols pass the compiled
`browserCapacityMode: isolated_functional` to `ExtensionChromiumHarness`; the
harness rejects headed, shared-profile, attached, missing-execution-proof or physical-GPU
sharing. The neutral capacity owner admits at most two functional/capture
browsers combined in the existing Git-common project pool. A third returns
`QA_BROWSER_CAPACITY_BUSY`; an unknown/exclusive owner cannot authorize another
slot. Cleanup retains each exact lease until its browser closes and releases
only that reservation. Sharing does not certify CPU, GPU, boot or scheduler
performance.

Other owned browser workloads retain `exclusive` reservation: they acquire both
project slots with reverse rollback, so owned performance measurements cannot
overlap captures or functional runs. Persistent/attached environments retain their host-global
CDP/root locks and cannot use shared capture reservations or run-scoped profile
brokers. Playwright borrows a capture reservation only when its private lease
proves the same project and mode; browser cleanup releases only that borrow.
The pipeline keeps the parent slot until browser and source-server close.
Only `visual_capture` uses the `shared_capture` class; functional extension
targets use their distinct explicit contract. Custom research protocols and legacy batch
runners retain their exclusive contract. Concurrent screenshots and source
startup timings do not certify CPU, GPU, scheduler or product performance.

Process-held lock recovery alone is not process or target crash recovery. Every
new upper QA run therefore writes a mode-`0600` `recovery-journal.json` under its
exact run root. The journal binds the run id and session nonce to the Node PID
and canonical Windows filetime or Linux proc start token, exact resource-lock tokens, the declared config
path and environment snapshot, browser epoch, and target records. Targets opened
through `ExtensionChromiumHarness` receive a non-enumerable per-run runtime
nonce before navigation; the managed extension-load anchor instead retains its
exact one-use ownership URL. Run-owned harness Chromium additionally records
the private process-owner token and complete executable/profile/debug-port
tuple plus its spawned PID and Linux process-start token. Atomic replacement
keeps the last complete journal state available if the Node owner dies between
mutations.

Each journal write still rejects its caller on failure and emits
`QA_RECOVERY_JOURNAL_WRITE_FAILED`. Its sequencing barrier settles so later
cleanup facts can be committed after IO recovers. Resource-release mutations
describe physical actions already performed; they are not rolled back to an incorrect
acquired state. A release retry requires the same resource key and fencing token,
retains the original release timestamp, and persists that exact claim again.
The resource coordinator registers an acquired lease before journaling it, so
acquisition rollback owns the failed claim too. Failed cleanup keeps that lease
registered and visible; no silent unlink discards its authority or failure.

`npm run qa -- recovery inspect` remains observation-only and always reports
`automaticMutationAllowed: false`. When a valid active journal exists, it also
checks the recorded runner PID/start token and exposes a manual recovery command
only after the original runner is absent. `npm run qa -- recovery recover
<run-id>` is that explicit mutation boundary. It re-reads the same session
nonce, blocks on config drift, re-acquires the declared browser broker and
physical capacity, re-proves dedicated-profile ownership and attached-browser
identity, requires the exact browser epoch, and closes only targets whose
runtime nonce or one-use ownership URL still matches. An attach-only managed
persistent Chrome process is always preserved. A run-owned harness browser can
be terminated only while its exact private owner token, spawned PID,
process-start token, and executable still match. PID reuse proves the original
process absent and never grants authority over the replacement. Resource locks
are removed only when their run id, resource key, token, and runner PID match
the journal. Unknown, legacy, invalid, or mismatched evidence grants no
mutation authority; recovery never scans URLs broadly or sends `Browser.close`
to an attached browser.

The durable process record currently belongs to the
`ExtensionChromiumHarness` owner. Other owned browser implementations may still
produce a journal without a process record; recovery can reconcile their exact
resource locks only when no admitted durable target exists, and does not infer
or terminate an unrecorded process.
The inspector recognizes report contract v2 as current terminal evidence and
contract v1 as an explicitly labeled `historicalTerminalRunCount`; both still
require a matching run id and parseable cleanup report. This historical evidence
admission is confined to observation and grants no runtime compatibility or
cleanup authority.
Two archived site runs also carry a superseded recovery-journal contract v2.
The inspector may classify that shape only when the journal is already terminal,
`cleanupComplete` is true, every claim is released, the target ledger is empty,
the owned ephemeral browser has no process record, the terminal report status
matches, and no matching lock exists.
`readQaRecoveryJournal` and `recovery recover` continue to accept only the current
journal contract, so this compatibility cannot grant mutation authority.

An external authenticated environment broker does not act as a Chrome daemon.
It never starts, restarts, focuses, kills, or deletes the profile of a declared
`persistent_authenticated` browser. It only serializes an attach, performs one bounded preflight,
and records the declared next action if CDP is unavailable. A disconnected CDP
therefore ends that admission attempt with `QA_CDP_UNAVAILABLE`; agents do not
loop over guessed ports or silently launch a replacement authenticated Chrome.
The shared Playwright attach owner closes its own connected client handle on
release so the CDP socket cannot leak; for a browser returned by
`connectOverCDP`, this disconnects that client and does not send the CDP
`Browser.close` command or terminate the external Chrome process.
Owned environments delegate process creation to the protocol but retain the
same broker identity and cleanup envelope.
For an identity-verified run-owned Chromium process, closing the final exact
leased page can make Chromium terminate its CDP socket immediately. That narrow
cleanup path accepts the disconnect only after `Target.closeTarget` returned
`success: true`. The socket can close while post-close inspection is pending
(`WEBSOCKET_CLOSED`) or before that inspection starts (`WEBSOCKET_NOT_OPEN`);
both retain the same successful ACK and exact owned-browser requirement.
Attached browsers and unconfirmed closes still require a live
post-close target inspection and fail loudly if it cannot be performed.

Run-owned CDP endpoints have an additional post-launch admission boundary. A
free debug port is inherently subject to a bind race and therefore grants no
cleanup authority. `ExtensionChromiumHarness` and the CWS runtime enable bounded
browser command-line evidence, then require the connected endpoint to carry
executable evidence plus the exact user-data directory, optional profile
directory, debug port, and private process-owner token produced for that spawn.
Linux and WSL-Windows also prove the matching OS main-process tuple. When
`Browser.getBrowserCommandLine` on Windows reports only the matching executable
basename, admission still requires the exact command-line
profile/port/private-token tuple and an
exact Windows CIM proof of the declared full executable and tuple; a basename
mismatch is terminal before that OS query. No extension, target, GPU, or scenario
command runs before that proof. On mismatch or missing evidence the CDP client
is only disconnected; `Browser.close` is forbidden and rollback is limited to
the authenticated spawned child/owner-token process.

On native Windows, a direct `ChildProcess` signal timeout remains provisional
until the existing exact Windows owner-token termination/absence check finishes.
Only a successful Windows cleanup receipt together with an exit code or signal
on that original spawned handle reconciles the earlier specific timeout. Windows
absence alone, identity-verification errors, and signal-delivery errors remain
terminal. This reconciliation adds no wait or timeout budget.

`managed_persistent` is a separate opt-in lifecycle contract. Its profile slot
must explicitly name a managed lifecycle, a dedicated absolute user-data
directory, one installation, one loopback CDP endpoint, and `focusPolicy: never`.
The label is not ownership proof. Before any lifecycle lease or browser
mutation, the Entropy adapter validates the canonical
`.entropy-e2e-qa-profile.json` inside that exact user-data root and returns a
slot/path-bound dedicated-profile receipt to the neutral lifecycle. The proof
is checked again under the lifecycle lease before launch and before persistent
handoff. Strict schema 1 remains a valid natural/unprovisioned QA profile;
missing, malformed, provisioning, or symbolic-link markers are BLOCKED. The
runtime never auto-creates this marker and never substitutes a path denylist
for positive ownership proof.
For an exact `managed_ensure_before_attach` execution that requires the
extension runtime, run admission may report a missing canonical
`<user-data-dir>.entropy-extension-slot` as `pending_stage`. This is an
observation-only receipt: preflight does not create or populate the directory.
The mutating harness must acquire the endpoint-and-canonical-user-data-root
capacity first, revalidate the QA profile marker, stage that exact slot, and
retain the capacity through its CDP work and cleanup. After exact browser
identity is re-proved, a `managed_ensure_before_attach` session may explicitly
load an absent exact slot with `Extensions.loadUnpacked`; an external session
remains discovery-only and requires that exact slot to be already active. An
external session never stages files or issues `Extensions.loadUnpacked` for
artifact refresh. Both forms preserve the extension and browser on detach.
A missing external slot, a noncanonical managed slot, or any execution that
does not require the extension remains BLOCKED.

Managed staging has one persistent content-identity contract. The canonical
artifact lease supplies its `inputDigest`, build id, artifact id, and release
profile. The Entropy adapter combines those fields with the normalized
temporary-manifest promotion and the fixed trusted-page path/source digest.
The canonical slot contains a schema-versioned receipt for that identity plus
an integrity digest of every staged file. Under endpoint-and-user-data-root
capacity, an exact receipt and a matching tree produce `reused_exact_slot`;
missing, changed, or integrity-mismatched content is copied into a sibling
staging directory and promoted as `staged_changed` by one explicit two-rename
transaction while the endpoint-and-user-data-root lease remains held. The
transaction records retired and published state. If publishing the prepared
directory fails, it restores the exact retired directory; if that restoration
also fails, it reports both typed failures and preserves the retired directory
for diagnosis instead of deleting or hiding it. The source build
identity and source-tree stability are checked around that copy. There is no
legacy-read or partial-copy fallback. An absent receipt or a well-formed receipt
whose identity/tree no longer matches is a synchronization miss and is replaced
from the canonical artifact. A receipt that cannot itself be trusted because it
is malformed JSON, a symbolic link, or a non-file is BLOCKED rather than
silently repaired.

A content receipt alone does not prove that the persistent browser applied the
  files. A separate activation receipt is bound to the content digest, exact CDP
browser epoch, and extension id. A changed slot, missing activation receipt,
or changed browser epoch causes exactly one managed load/reload. The harness
then invokes the Entropy runtime-readiness adapter through the trusted extension
page. The newly opened exact trusted URL first fetches the served
`entropy-build-info.json` without cache and verifies its schema, build id, and
release profile, then checks the live MV3 manifest against every promoted
required permission and exact host permission. The identity proof and the
subsequent canonical background-router answer share one 12-second
cold-readiness window, including creation and navigation of the owned trusted
page target, before the activation receipt may be written. The poll stops 250ms
inside that absolute host deadline so its complete counters can cross CDP
without converting an ordinary bounded failure into a transport timeout. Each
pending callback has a two-second watchdog, so a lost callback can be retried
without flooding the full-init queue. `runtime.lastError` is also retryable, but
an explicit `{ success: false }` response is terminal: this router dispatches
the debug action only after its canonical init promise settles, so such a
response represents an init/dispatch/trust/handler failure rather than a normal
cold transition. Readiness accepts a successful canonical
runtime snapshot without comparing `lastActiveTabId`; it is explicitly not
target-admission evidence. An enabled extension, service-worker target, an
`Extensions.loadUnpacked` response, or a router response from a runtime serving
the wrong artifact is not sufficient.
The activation receipt is valid only inside the managed profile slot's
broker-and-capacity single-writer contract. External attach never reads or
writes it and never receives the runtime-readiness callback. A manual DevTools
reload or any other out-of-band extension mutation in the managed browser
violates that contract; because a same-epoch, same-id mutation cannot be inferred
safely, the operator must restart the exact managed browser (changing its CDP
epoch) before another QA admission. There is no silent same-epoch recovery.
The harness constructor keeps runtime readiness as an injected product seam, but
the architecture guard permits only Sentinel, Audio, and Feed to wire the
canonical Entropy adapter. The harness independently revalidates its exact
artifact identity and promoted manifest receipt before committing activation.
If load or readiness fails, no activation receipt is committed, so the next run
cannot misclassify the old runtime as reusable. A matching content, activation,
epoch, and exact active extension path skips both filesystem staging and reload;
the ordinary exact-tab tracking admission retains its short warm bound. Run
evidence records `stageAction`, `activationAction`, `runtimeRefresh`,
`reloadIssued`, the verified artifact runtime identity, and complete bounded
readiness diagnostics. Missing or malformed diagnostic counters invalidate the
proof instead of being projected as zero. A missing or well-formed but
nonmatching activation receipt requests that one refresh; a malformed activation
receipt is BLOCKED.

Every raw owner-created page uses a fresh UUID capability generated inside the
canonical CDP target owner and an exact inert `about:blank` fragment. Target
discovery is subscribed before creation. A normal create response is admitted
only after the returned id is a page at that exact capability URL. If the CDP
response times out or is malformed, cleanup may close only the sole page proven
by the exact capability URL or its exact `targetCreated` event id; generic blank
pages and a mismatching response id are never inferred as owned. Discovery,
creation, identity inspection, and normal readiness share the caller's absolute
deadline. Exact cleanup may use one bounded safety grace after that deadline.
If ownership remains unresolved, the run is BLOCKED and records only the browser
epoch, owner purpose, UUID capability, and causally observed target id; no
profile path is exposed and no broad target close is attempted.
`browser start` and `browser ensure` serialize that exact slot, launch
through the shared process owner with `--no-startup-window` plus the declared
`--enable-unsafe-extension-debugging` capability needed for exact-slot CDP
activation, and leave the
managed QA browser running after the command. `ensure` is idempotent; `start`
fails if the exact slot is already ready. Neither command may operate on a
`persistent_authenticated` external slot. A listening port is insufficient:
READY requires the shared attach owner to prove the executable, exact
`--user-data-dir`, profile directory, and debug port from the browser command
line. Missing identity evidence is BLOCKED, never an inferred match.
For Linux and WSL-Windows Chrome, prelaunch admission independently proves that
no Chromium main process uses the declared user-data root, even when its
executable, profile directory, debug port, or owner token differs, and that the
declared loopback port does not accept a TCP connection. Chromium's process
singleton is user-data-root scoped; checking only the intended profile-directory
and port could accidentally hand launch arguments to an older process. Other
Chrome user-data roots are outside this check. These broad absence checks grant
no cleanup authority. The pre-ready owner binds rollback to the newly launched
owner token, and READY/handoff still requires the exact executable,
profile-directory, debug-port, CDP, and OS-process evidence. It cannot terminate
an older occupant merely because readiness failed.
If the OS profile/port inspector itself cannot classify absence or occupancy,
the Entropy lifecycle adapter returns
`BROWSER_QA_MANAGED_PROCESS_SLOT_INSPECTION_BLOCKED` before launch. This is a
`BLOCKED` environment/admission result, not a product `FAIL`. The terminal
receipt retains the typed wrapper and the bounded named inspector cause; the
append-only public event records only those codes, never a PowerShell command,
private owner token, or profile path.
Identity admission follows the same bounded-evidence rule. The reusable
inspection result records `identity_verifier_failed`, the named allowlisted
`causeCode`, and `declared_identity_verification`; it never copies the verifier
message. A pre-existing endpoint failure is tagged `prelaunch_identity`, while
a browser that reached CDP after managed launch but failed exact tuple proof is
tagged `post_launch_identity`. The lifecycle error retains a sanitized cause
whose message is only that code, then rolls back the exact pre-ready owner-token
process before releasing its leases.

Managed launch failures now write one unique local
`.artifacts/qa/browser-startup/<uuid>.json` report after cleanup. It records the
last TCP/CDP/identity check, stage, elapsed time and poll count, pre-rollback
PID/exit/signal state, up to 32 KiB of warning/error stderr complete lines, and
both rollback and lease-release results. Owner tokens are redacted; raw browser
logs stay in this local file and may contain browser-generated local/site details.
The writer requests owner-only file permissions (Windows uses the containing
directory's ACL). Successful and already-ready starts write no report.
These standalone startup reports are outside named-run retention; they have
unique names and are never automatically deleted or overwritten.

The standalone CLI emits `QA_BROWSER_STARTUP_DIAGNOSTICS` with the relative report
path and a scalar summary. Named runs retain the same `startupEvidence` reference
in their error event and terminal error. Neither public surface copies stderr,
full process arguments or profile paths. A report-write failure is explicit
`QA_BROWSER_STARTUP_DIAGNOSTICS_WRITE_FAILED`, retains the original startup
failure and summary, and never skips process/lease cleanup. Startup timeout and
cleanup-failure verdicts retain their existing semantics.

Abort cleanup authority is process-lineage scoped. The exact spawned child gets
the graceful `SIGINT`; on Linux, only descendants discovered from that PID are
tracked through bounded `SIGTERM`/`SIGKILL` escalation and verified exit. Other
platforms retain direct-child escalation because no process-tree discovery seam
is declared. If the tracked Linux tree cannot be proven stopped within the
bound, `qaChildProcess` raises `QA_CHILD_PROCESS_TREE_CLEANUP_INCOMPLETE` rather
than reporting successful cleanup.

Browser-page cleanup is target-identity scoped. Raw `Target.createTarget` and
`Target.closeTarget` calls are confined to `qaCdpTargetOwner`; the architecture
guard rejects new bypasses. At attach time the harness
snapshots the external QA Chrome's existing target ids as a baseline. Those
targets—including pre-existing `about:blank` pages—can never be promoted into
the harness lease. Every helper or scenario page created afterward is recorded
with browser epoch, owner, purpose, target id, and optional tab id. Closing a
tab is not complete until CDP confirms that the target is absent. A failed or
unconfirmed close remains owned and makes cleanup fail; the harness does not
silently forget it. There is deliberately no browser-wide URL-matching sweep
for `about:blank`, because that could delete an operator or another application
task's tab.

The explicitly managed exact-slot `Extensions.loadUnpacked` path has one
additional narrow ownership rule because Chromium can create a page while that
command runs. Temporal target-list deltas never grant close authority. Before
each managed load or in-place reload, the harness creates one background
`about:blank` anchor through the canonical target owner and immediately records
the exact returned target id in its browser-epoch lease as
`managed_extension_load_anchor`. It blocks before mutation if another page
appears between the baseline and anchor snapshot. After the load settles and
again after exact extension activation, any page outside the baseline and
anchor is preserved and produces a bounded typed BLOCKED quarantine receipt;
no URL, opener, or timing inference promotes it into ownership. Finally, the
harness closes only its causally created anchor by exact id and confirms its
absence, even if that owned anchor navigated. Workers, browser UI targets,
baseline pages, unexpected page deltas, and external attach discovery are
never closed by this rule.

Crash reconciliation is deliberately narrower than normal cleanup. Process-held
broker and capacity endpoints disappear when their Node owner dies, but an
owned Chrome process or exact target may outlive that owner. The upper Entropy
adapter persists a run journal before acquiring resources and records each
resource token and each admitted target's `browser epoch + runtime nonce + exact
target id`. An `ExtensionChromiumHarness` owned process also records its private
owner-token tuple, spawned PID, and process-start token. Explicit recovery first
proves the original Node PID/start token absent and then re-proves those records
under the canonical owners. It
does not treat a released process-held lock as cleanup evidence and never
guesses by URL, port, or profile prefix. Runs without the journal, and browser
implementations without a required durable process or target record, remain
diagnostic-only for that unknown resource.

## Detached Zen rain streak research target (2026-10-10)

`visual/zen/rain-streaks` runs the independent
`scripts/dev/zen-weather-motion-research/browser.mjs` fixture through the custom
`zen_rain_streaks` protocol. It declares `source_render`, the run-owned `visual`
environment, required WebGL, no extension or authentication, muted audio, and
`OWNED_BACKGROUND_OBSERVATION_REQUIREMENTS`: hidden/headless by default, a visible
native document, active target, and no OS focus requests. Its custom protocol
keeps `captureConcurrency: exclusive` and the shared project claims
`artifact:source_render` and `runtime:visual-capture`; it does not enter the
`visual_capture` shared-capture path.

Run `npm run qa -- run visual/zen/rain-streaks`. This target accepts only the
canonical browser presentation options; it does not accept an arbitrary entry,
server, profile or renderer. `zenRainStreaksSourceLease.mjs` bundles the named
entry with esbuild (`write: false`, `bundle: true`, `metafile: true`, browser ESM).
Its loader captures the exact input bytes used by the compiler. The source
manifest records each metafile input's path, byte count and SHA-256, compiler
version, and bundle byte count/SHA-256. A compiler discovery pass identifies
package `browser: false` inputs so esbuild retains their virtual empty-module
meaning; these manifest entries use `kind: browser_disabled`, zero bytes and the
empty-byte digest. Real files use `kind: file` and the exact captured bytes;
unsupported real source types still fail. The manifest's SHA-256 is the run's
`sourceHash`. Source digests are checked after compilation and before/after the
experiment; a concurrent source change fails the run instead of changing its
served input. An OS-assigned loopback server serves only the captured ESM bundle
and its fixed HTML entry. Unknown routes fail without reading live files. There
is no Vite server, HMR, directory watcher or dependency on an operator's host.

The fixture exposes `window.__ZEN_RAIN_STREAKS_QA__` with `ready`, `runStudy`,
`capture` and `dispose`. `runStudy` returns the
`zen_rain_streaks_study_v1` receipt: bounded cases, baseline/rain CPU and GPU
observations, GL draw/upload counts and bytes, mesh receipts, and explicit
geometry/resource assertions. The protocol requires nonempty cases/assertions,
every fixture assertion passing, finite nonnegative ordered CPU statistics,
and no console errors, page errors or failed requests. The fixture owns checks
for finite/bounded geometry, zero-rain work, retained uploads and draw/byte
bounds. GPU timer unavailability or disjoint samples remain explicit measurement
limits in `gpuTiming`; they do not substitute another runtime or invent a
performance result. No CPU/GPU timing threshold is an acceptance gate.

The sparse/thicker candidate also samples 30 active seconds at 60 samples/s
outside the timed GPU phases. Its receipt records mean/max visible streaks,
blank fraction and explicit populated/gap times. A populated sample must change
only sky pixels; a gap must match baseline pixels and native GL draw/upload work.
Gaps are analytic seeded periods, with no per-drop timers or pending queue.

The same source-pinned fixture also owns `waterImpactStudy.mjs`, a field-only
cost comparison using the shipping `ZenWaterSurfaceField` and petal disturbance
model. At a fixed 1280 × 720 world it measures ABBA no-impact/impact pairs with
4/12 slots at field long edge 384, 10 slots at 320 and 8 slots at 256, plus
no-rain/rain .72 at edge 384.
An additional controlled comparison uses 12 slots and rain budget 36 at edge
256, isolating field resolution from the full preset's slot/rain budgets; it
is a research condition, not a new product preset. The fixtures use explicit
synthetic physical channels and real `.32` petal impulses held at representative
.2-second age. Each phase
has 30 warm-up and 60 measured frames. Native counters require one warm field
draw and zero texture uploads; same-time field framebuffer readback must change
for real impulses/rain. The protocol requires the nonempty
`zen_water_impact_cost_study_v1` receipt and finite ordered CPU observations.
The measured scope includes encoding and the one guarded field pass, excluding
pond consumers, caustics, koi, worker transport and browser compositing. It
changes neither product quality policy nor semantic slot capacity; GPU timings
have no acceptance threshold and retain the existing capability/disjoint limits.

`productionRainStudy.mjs` measures the shipping `runtime/rain` projection and
two retained meshes at rain 0/.72/1 plus night pigment, inside the fixture's
existing 640 × 480 CSS-pixel back/tree composition. Each fresh rain owner uses
monotonic active time and ABBA warm/measured phases. For nonzero rain, real
poses first warm both visible buckets (bounded at 1800 active-time samples),
because sparse first visibility can occur after the ordinary 30-frame warm-up;
this separates initial index uploads from recurring vertex traffic. Layout/weather revisions
must remain unchanged through sampling. Maximum whole-composition work is four
draws and 944 uploaded bytes per warm frame (512 rain vertex bytes plus the
existing sprite batch), with zero warm texture uploads. Zero rain matches the
baseline. Its `zen_production_rain_cost_study_v1` receipt is required. The night
condition exercises the pigment and GL program against the same study sky;
actual night composition requires the separate Home capture. This synthetic
measurement does not certify integrated worker/compositor FPS.

The protocol captures the original rain intensities `0.72` and `1`, rainy-noon
and darker-sky comparisons, the earlier readability correction, and sparse
rain at `0.72` and `1`, at a fixed `640 × 480`,
pixel ratio `1` and time `4.25` inside a `1100 × 850` viewport that retains the
fixture caption and controls without cropping the canvas. It also exports the
same captured bundle as self-contained `preview.html`: one inline module, escaped
script terminators, no server or external requests, with file digest and source
hash recorded in the report. The fixture's Play/Pause/Clear controls support
offline inspection without participating in the timed study.
The preview starts paused on the sparse candidate. Its selector retains the
continuous readability correction for direct human comparison.
It verifies `dispose` reports zero remaining
meshes/queries and a lost context. `zenRainStreaksQaProtocol.mjs` launches only
through `launchQaPlaywrightBrowser` with the compiled contract, records
`readQaPlaywrightBrowserReceipt`, and registers exact page/context/browser/server
cleanup in the outer QA envelope. Each resource closes in reverse acquisition
order, including failed runs. It does not reuse personal/persistent profiles or
repeatedly focus a browser.

Evidence lives in `attachments/rain-streaks/report.json`, `study.json`,
`preview.html` and seven named PNGs under the exact `QA_RUN_COMPLETE.runId`.
The report retains the source
manifest, protocol digest, browser/GPU identity, raw study/capture/dispose
receipts, diagnostics and cleanup. A PASS certifies this independent geometry
and resource contract; it does not certify shipping integration, physical GPU,
visual quality or a frame-rate budget.

## Detached Cherry Plume Live research target (2026-09-26)

`visual/zen/cherry-plume-live` owns the exact detached
`current/research/cherry-plume-live/index.html` experiment. It is not the older
D1 `visual/zen/bonsai-development` scene or the shipping `dashboard/capture`
surface. It declares `source_render`, the run-owned `visual` environment,
required WebGL, no extension/authentication, muted audio, and hidden presentation
by default. A WebGL pass does not certify a physical GPU, frame-rate budget,
product admission, or the Home worker integration.

The target requires `--source=<64-character source hash>` and accepts
`--seed=<positive uint32>` (default 151) and the canonical `--presentation`.
Use `describe` when choosing an unfamiliar target. Optional `doctor` uses exactly
the intended run arguments; fresh admission always occurs in
`run`. The target never builds or restamps the source to satisfy a requested pin.

`scripts/qa/protocols/zenCherryPlumeLiveSourceLease.mjs` invokes the study's
version verifier with a capturing reader. It checks the requested Live manifest
identity and captures the actual transitive verification reads, including
predecessor manifests, into an immutable in-memory source closure. Its temporary
loopback server binds an OS-assigned port and serves only those bytes. An unknown
source path fails instead of reading arbitrary live repository files. The
operator's port-4184 research host is neither reused nor stopped.

`scripts/qa/protocols/zenCherryPlumeLiveQaProtocol.mjs` uses the existing
`launchQaPlaywrightBrowser` owner with the compiled execution contract. It owns
one disposable context/page, records the browser/GPU receipt, and closes its
context, browser and loopback server in reverse order. Their release proof is
registered in the outer QA cleanup envelope. It never reconstructs Chromium
flags, chooses a different profile or repeatedly focuses the browser.

The detached UI exposes `window.__ZEN_CHERRY_PLUME_LIVE_QA__` with a `ready`
promise and async `read`, `set`, `playback`, `resize`, `comparePixels` and `dispose` methods.
The API supports `seed`, `growth`, `activation`, `year`, `phase`, `stage`,
`yaw`, `view`, `woodStyle`, `flowerStyle` and `wind` through the same UI state owner. This protocol
selects the seed at entry, keeps the default seasonal conditions, and exercises
growth, activation, wood style/view, wind and resize. It records the source
hash, state, snapshot counts, wood/rest-flower hashes and renderer metrics.
`resize` dimensions are backing pixels: 320×400 at DPR 1 and 768×960 at DPR 2
represent the prescribed observations; DPR 2 has a 384×480 logical surface.
Both Canvas and Pixi DOM bounds must match backing dimensions divided by the
requested pixel ratio; changing only the backing buffer is not a DPR check.

The initial state is mature growth/activation 1, year 3, spring stage .45,
yaw/wind 0, flower view and continuous wood. The bounded journey checks growth low/high/low
replay, activation low/high/low without changing wood or rest-flower identity,
flowering recovery, Canvas/Pixi pixel parity, resize and explicit disposal.
The activation range also receives real Home/End key input through the owned
page, followed by the UI's settled-state receipt; the API is not the only tested
control path. Disposal must leave zero renderer textures and sprites.
The wood comparison captures the previous reference and new continuous surface
in wood view, switches through the actual select control, and requires unchanged
wood/rest-flower hashes. Continuous wood also receives a Canvas/Pixi pixel check
before returning to flower view. These invariants do not automatically grade
the new texture's aesthetic quality; the screenshots require visual inspection.
Both the long-lived comparison Canvas and fresh atlas canvases use the same
explicit `willReadFrequently: true` context owner in `raster-context.js`. This
avoids a repeated-readback heuristic changing only one arm's rasterization.
The compositor remains required Pixi/WebGL. The protocol records Canvas context
attributes and reference pixel hashes, requires exact same-state raster recovery,
and repeats readback three times without changing the image or loosening parity
thresholds. This raster policy is specific to the detached comparison/bake owner.
With wind enabled, the visible document must naturally deliver three additional
renderer frames without changing rest geometry. The protocol never synthesizes
frames or refocuses the window; this is a functional frame-delivery check, not
a sustained performance measurement. This first detached bridge uses one shared
rigid root wind transform for the tree's ordered paint slices. The check does not
certify independent branch deformation or the shipping hierarchical rig. These
wind frames must reuse the same bake count.
The `zen_cherry_plume_live_qa_v3` contract additionally exercises natural elapsed
growth playback, pause/quiet/resume through the actual button, same-seed restart,
manual-seek ownership and exact mature-endpoint recovery. The playback API accepts
`{action: 'play'|'pause'|'restart', durationSeconds?: 10..180}`. Receipts expose
boolean `inFlight`, at most one outstanding commit and one scheduled RAF,
requested/committed growth, counters and measured frame costs. Tests observe real
RAF delivery without injecting time or refocusing the window. These are bounded
functional observations, not a sustained FPS benchmark. Disposal during playback
must drain work and release textures/sprites. Same-size repeated plans must paint,
upload and allocate nothing; a compatible partial growth update must retain
resources, repaint changed slices and preserve actual Canvas/WebGL parity.
The successor `zen_cherry_plume_live_qa_v4` retains those playback checks and
defaults to shared flowers. It explicitly captures `flowerStyle=procedural`,
switches back through the actual select, and requires unchanged rest wood/flower
identity plus exact shared-state Canvas recovery. Shared command count must be
less than half of the procedural count. The shared material has 24 tiles in one
512×256 atlas; its allocation/bake/upload counters stay at one through growth,
activation, view/style changes, backing resize and an alternate-seed round trip.
Identical-plan and activation updates must retain flower sprites. Returning to
the original seed must restore geometry and DPR-2 pixels. Disposal leaves zero
wood textures, flower atlas textures and sprites. Receipts report combined GPU
usage under the unchanged 64 MiB limit, including any retained flower material.
These checks establish candidate Canvas/Pixi parity and anatomy preservation;
the intentional shared-petal approximation requires before/after visual review.
The `zen_cherry_plume_live_qa_v5` successor additionally observes the independent
wood/bloom development receipts and captures bud swelling, partial opening and
full bloom in one selected tree. It checks original flower rest identity while
paint poses change, within-cluster timing, same-state recovery and Canvas/Pixi
parity through development. The preceding playback, resource lifetime, memory,
seed-return and cleanup requirements remain. Native endpoint and phase-boundary
geometry checks accompany these browser observations; screenshots alone do not
prove continuity or a biological growth law.
The compatible partial-repaint fixture uses post-bloom growth `.980` → `.981`.
During bud opening, disappearing bud marks change wood command-slice bounds, so
the earlier `.960` → `.961` probe can legitimately require a full slot repack
while retaining atlas resources. The strict partial-reuse assertion remains at
the compatible fixture; bud-stage parity and resource checks remain separate.
Reports include the loaded protocol's SHA-256 so repeated runs can establish
that they exercised the same fixture revision.
The `zen_cherry_plume_live_qa_v6` successor retains every preceding check and adds
three rounds of five fixed growth observations: F4, foundation, swelling,
opening and mature. Five distinct states exceed the UI's four-entry pose cache;
the study, canonical pose preparation and material remain warm. The draw-owned
timings exclude later diagnostic receipt hashing and separate camera, model,
plan, comparison Canvas and Pixi work. These are measured observations without
an FPS or fixed-duration acceptance gate. Archived/current alternating native
samples provide the controlled before/after comparison; historical browser runs
are contextual rather than a paired benchmark. A yaw change must alter the
projection while preserving rest geometry; returning to zero yaw must restore
the exact mature Canvas pixels. Existing resize and seed-return cases cover the
other camera-cache invalidation inputs.
The `zen_cherry_plume_live_qa_v7` successor preserves every v6 check and uses
the existing observations to verify renderer resource retention. An identical
zero-wind redraw at the exact same time must skip every unchanged sprite matrix without increasing
transform-application or wood frame-texture allocation counters. Existing fixed
growth updates must exercise at least one full paint repack with unchanged run
count and one retained wood atlas; its wood sprites and frame textures must not
be reallocated. Naturally advancing wind must still apply changed transforms.
Disposal must release all wood frame textures. These additive counters describe
actual resource ownership and transform calls, not GPU execution time or FPS.
Pixel parity compares actual Canvas pixels with Pixi extraction: mean absolute
RGBA error must be at most 2/255, and at most 2% of pixels may differ by more
than 8/255 in any channel. This allows bounded raster/compositing differences,
not arbitrary visual replacement. Opaque surface pixel counts alone do not prove
tree paint, so each image must also contain more than ten nontransparent pixels
whose RGB channels are all below 175. Declared screenshots and organ receipts
accompany those checks; the dark-pixel count is not an aesthetic score.

Evidence is `attachments/cherry-plume-live/report.json` and its named PNGs in
the exact `QA_RUN_COMPLETE.runId` directory. The report preserves source-file
digests, each state/renderer receipt, pixel differences, browser diagnostics and
cleanup. A failed source pin, assertion or cleanup is never converted to a
passing screenshot. The study's fixed source manifest remains separate from
the product artifact publication contract.

## Environment Classes

The named target's `environmentId` is the environment selection authority.
`describe` exposes that selection; `doctor` compiles it with local installation
and profile configuration into the browser execution contract. Automated QA is
not restricted to `authenticated`. On native Windows, follow the purpose rows
in [Browser roles](../runbooks/windows-native-development.md#browser-roles)
without substituting the declared target environment.

`dashboard/boot` and `dashboard/capture` declare `ephemeral` and require an owned
browser. Their isolated fixture state and cold/warm sampling must not run in the
persistent `authenticated` profile. `visual` owns render-only capture, and
`release` owns clean public-artifact runs when selected by their named target.
The browser installation can be shared across these environments; profile and
process ownership cannot.

| Class | Process owner | Intended use |
| --- | --- | --- |
| `persistent_authenticated` | external operator; QA attaches only | logged-in TikTok, YouTube, Instagram, X, and Facebook diagnosis without browser restart; focus remains unchanged unless a named agent protocol declares and records a bounded real-Chrome UI action |
| `managed_persistent` | browser-QA lifecycle; QA runs attach only | dedicated long-lived QA Chrome that an operator or agent explicitly starts or ensures without a startup window; it is never substituted for an external authenticated slot |
| `ephemeral_extension` | target protocol | isolated dashboard boot/capture, disposable MV3 and real-site automation |
| `deterministic_visual` | visual protocol | render-only scene capture with a temporary loopback server and owned Chromium |
| `release_clean` | release protocol | prebuilt public artifact and clean lifecycle verification |

The authenticated environment must name an absolute Chrome executable, an
absolute dedicated QA profile, the profile directory, and a loopback CDP
endpoint. The extension slot is derived from the profile by the existing
`qaProfileArtifactSlot` contract. Entropy QA never reads login credentials,
starts a replacement authenticated browser, calls `Browser.close`, or uninstalls
the extension. The Suikinkutsu agent protocol alone may foreground this dedicated
QA Chrome long enough to perform a missing one-time toolbar pin; it records that
focus change and does not use the exception for routine action activation.

Local configuration is ignored by Git and lives at
`.artifacts/entropy-qa.local.json`:

```json
{
  "schemaVersion": 1,
  "browserResources": {
    "installations": {
      "qa_chrome": {
        "executable": "/absolute/path/to/chrome",
        "platform": "linux",
        "distribution": "chrome_for_testing"
      }
    },
    "profileSlots": {
      "authenticated": {
        "installationId": "qa_chrome",
        "userDataDir": "/absolute/path/to/external-authenticated-profile",
        "profileDirectory": "Default",
        "cdpEndpoint": "http://127.0.0.1:8245",
        "lifecyclePolicy": "external",
        "focusPolicy": "never",
        "launchAudioPolicy": "audible"
      },
      "managed": {
        "installationId": "qa_chrome",
        "userDataDir": "/absolute/path/to/managed-qa-profile",
        "profileDirectory": "Default",
        "cdpEndpoint": "http://127.0.0.1:8246",
        "lifecyclePolicy": "managed",
        "focusPolicy": "never",
        "launchAudioPolicy": "muted"
      }
    }
  },
  "environments": {
    "authenticated": {
      "browserClass": "persistent_authenticated",
      "profileSlotId": "authenticated"
    },
    "managed": {
      "browserClass": "managed_persistent",
      "profileSlotId": "managed"
    }
  },
  "artifacts": {
    "devExtension": "/absolute/repository/path/dist",
    "publicExtension": "/absolute/repository/path/dist-prod"
  }
}
```

The existing inline `persistent_authenticated` fields remain accepted and are
canonicalized once at the configuration boundary into generated resource IDs;
new configuration should use the named registry. Platform and distribution are
explicit for named installations, so execution never guesses a Chrome binary
or swaps a Linux and WSL-Windows installation.

Artifact output paths must be absolute, distinct, non-overlapping, outside any
browser profile or extension slot, and may not be the repository root or one
of its ancestors. An existing dev output must be a real directory, not a
symbolic link. Unknown configuration and target-parameter keys fail loudly.
These constraints keep a mistyped local path from turning a bundle build into
profile or repository mutation.

## Commands

Discover and inspect contracts without starting a browser:

```bash
npm run qa -- help
npm run qa -- list
npm run qa -- list --family=feed
npm run qa -- describe feed/instagram-reels
npm run qa -- doctor feed/instagram-reels --mode=agent --hold-ms=10000
npm run qa -- browser inventory
npm run qa -- browser status visual
npm run qa -- browser status authenticated
npm run qa -- recovery inspect
npm run qa -- recovery recover <run-id>
npm run qa -- retention inspect
```

`doctor` accepts the same mode and target-owned parameters as `run`. It compiles
the exact immutable plan, inspects the environment, and projects the artifact as
`reuse_exact`, `build_on_run`, `rebuild_forced`, `reuse_prebuilt`, `use_source`,
`protocol_owned`, or a typed blocked state. `protocol_owned` is an explicit
delegation for the legacy site-runtime lane engine, not a claim that no artifact
work exists. Doctor never acquires resources, starts a browser, creates a tab,
or builds. The default output is compact; `--json` exposes the complete
mode, parameters, browser execution leaves, resource claims, environment checks,
and artifact decision. This is a read-time prediction; `run` revalidates the
artifact digest and browser identity after acquiring their canonical leases.

`recovery inspect` is also observation-only. `ATTENTION` means evidence is
incomplete or invalid and requires exact owner diagnosis; it is not permission
to delete a run root, release a lock, terminate a process, or close a target.
`CLEAN` exits 0 and `ATTENTION` exits 2 so automation can stop for review. A row
with `manualRecoveryAllowed: true` names the exact `recovery recover <run-id>`
command. That command still revalidates every identity under the canonical
broker/capacity owners and fails loudly if state changed after inspection.

Inspection separates active runners from abandoned journals, exposes their age
and unresolved capability reasons, and treats 24-hour abandoned entries as
stale. These counts are not counts of live Chrome processes. Explicit recovery
preserves `run.json`, `cleanup.json` and the original verdict; only its recovery
receipt/journal records the verified resolution. All released attached targets
with no pending reservations or child jobs require no current browser attach.
Reserved targets or missing child cleanup capability remain unresolved.

For historical owned-browser journals missing the private process capability,
the explicit recovery owner may prove absence through the canonical process
owner's read-only exact recorded profile occupancy. The current declared
installation must still match executable/platform. A present or uninspectable
process blocks recovery; this historical absence seam grants no termination
authority and is never an ordinary runtime fallback. Journals with private
capability continue to use their exact token/process identity. No URL sweep or
unproved terminal journal rewrite is permitted.

`retention inspect` remains read-only. Ordinary QA evidence is disposable:
retain at most seven days and three completed runs per target, with a 24-hour
grace before pruning. Either age expiry or surplus count makes a completed run
eligible. If the measured run tree exceeds 10 GB, additional oldest completed
runs outside the grace period are eligible until the projected total meets the
budget. This applies to PASS and unsuccessful terminal runs equally; valuable
failure evidence must be explicitly pinned. New named runs/setup through
`runQaTarget` are blocked with `QA_EVIDENCE_BUDGET_EXCEEDED` before session/browser
admission when the existing run tree exceeds 10 GB. The budget is an admission
threshold, not a per-write quota: admitted/concurrent runs can overshoot it.
Inspection reports measured and projected bytes; protected evidence can prevent
reaching the budget. Nothing is silently discarded to admit a run. The shared
default is 10,000,000,000 bytes, explicitly approved by the user on 2026-10-12;
age/count/grace and pin protections are unchanged.

`retention prune` is the explicit destructive owner, scoped solely to
`.artifacts/qa/runs/<validated-run-id>`. It acquires `evidence:retention` through
the existing resource coordinator, checks root ancestors for links, selects only
valid terminal reports with complete released cleanup, and excludes unresolved
recovery journals, pins, links, `.git` entries and unusual filesystem types.
Before each deletion it verifies the directory identity and file metadata
fingerprint, moves the exact directory into the plain sibling `retention-trash`,
verifies again, then deletes it. Inspection and pruning never rewrite QA verdicts.
An incremental receipt in `.artifacts/qa/retention` records policy, candidates,
deleted run IDs/bytes and failure. Any unfinished quarantine blocks further
pruning for manual review; it never triggers automatic recovery/deletion.
Unmeasurable trees stay protected and prevent a reliable whole-disk total.
Retention does not own external concurrent edits to completed evidence;
ordinary writers create unique runs and never reopen them.

`retention pin <run-id> --reason="..."` creates `retention-pin.json` in the exact
plain run under the same retention lock. Presence protects the run even when its
contents are invalid; `retention unpin <run-id>` explicitly releases protection.
No silent pin eviction exists. Pruning never touches research reports, Git
worktrees, profiles, build slots, artifact pins or source trees. Those require
their owning lifecycle and review.

`browser inventory` reports declared Linux/WSL-Windows executables, the pinned
Playwright Chromium path, and whether each environment broker is currently
available or leased. `browser status <environment>` additionally checks the
declared files and, for attach-only environments, reads
`/json/version` and `/json/list` to report the browser epoch plus total page and
exact `about:blank` counts. Persistent status additionally proves the declared
process identity through the shared attach owner. Attach-only run admission
uses that same verifier after acquiring the broker, so a status check and a
real target run cannot disagree about which executable/profile owns CDP.
Before creating an HTTP request, status and managed lifecycle inspection share
a short connection-only loopback TCP probe. An absent port returns immediately
without leaving an HTTP connection attempt alive; a reachable port is not
trusted and must still pass the bounded CDP and exact-identity checks.
Managed status and doctor inspection also run that canonical dedicated-profile
proof, so they cannot report READY for a slot that automatic ensure would reject
before launch.
`BUSY` names the live broker owner; a stale
observation record does not make the environment busy. Status skips CDP while
another run holds that environment broker, so inspection does not add polling
traffic to the active attach-only session. Both inspection commands are
observation-only. They do not
launch a replacement browser, reconnect by guessing a port, create a tab,
activate a window, or terminate a process.

`browser start <environment>` and `browser ensure <environment>` remain the
manual persistent-lifecycle preflight commands. They accept only
`managed_persistent`; use `--timeout-ms=<1000..120000>` for a bounded startup
admission. A normal `qa run` compiled with
`startPolicy: managed_ensure_before_attach` invokes the same idempotent
`ensure` action once at the upper session boundary, before it constructs the
attach lease. Thus the run command is sufficient for a dedicated managed QA
Chrome, while `browser ensure` remains useful as a standalone readiness check.
Neither path opens a startup window, requests OS focus, creates a target, or
stops the browser at command completion. Low-level broker, Playwright, and CDP
attach owners never start a browser. External authenticated disconnection
continues to return `QA_CDP_UNAVAILABLE` and a reconnect action instead of
becoming a managed launch.

`browser open <environment>` is the separate, explicit operator boundary for a
visible managed WSL-Windows QA Chrome. It first runs the same idempotent
`ensure`, then re-acquires the declared browser broker and physical capacity,
re-proves the dedicated profile and exact process identity, and uses the
canonical CDP target owner. If the browser has no page it creates exactly one
owned blank page; otherwise it preserves all existing pages. The Windows driver
then restores the exact declared Chrome window and requests foreground once.
The focus driver binds the pre-proved browser PID to the declared CDP port. A
new-page receipt also carries its CDP window bounds, which must match exactly
one visible top-level HWND for that PID before focus. Thus multiple managed
Chrome windows are supported without guessing. The reuse-only `browser open`
path has no target-window receipt and therefore still requires exactly one
visible top-level window.
The receipt records `operator_request_once`, process id, page count, and whether
the command created or reused the window. A newly created page is closed on a
focus failure; on success it is deliberately handed to the human operator and
remains open. This command does not alter the profile slot's `focusPolicy:
never`, does not grant focus to automated target runs, and is unsupported for
non-Windows managed slots rather than falling back to an ad hoc launcher.

`browser page <environment>` uses that same identity, broker, capacity, CDP
target-owner, and bounded focus boundary but always creates one exact new page.
The target owner first creates a nonce-owned blank page, then an optional
`--url` navigation is bound to that exact target before activation and human
handoff. Only exact `about:blank` and userinfo-free `http:`/`https:` URLs are
accepted; because the command line and shortcut are inspectable, operators must
not pass secrets in the query or fragment. Creation, navigation, target correlation, process correlation, or
focus failure attempts exact cleanup of only the page created by this command;
ambiguous create/close evidence remains a loud quarantined failure rather than
claiming absence. Success deliberately preserves the handed-off page and managed Chrome
while disconnecting the CDP client. This is product-QA-protocol-free: it does not run
Sentinel, Furin, Feed, targeting, artifact build, or tracking admission. It is
not extension-disabled; normal product behavior from the extension already
installed in the managed profile may still apply to the opened document.
Handoff is intentionally non-exclusive: after the command returns, broker and
capacity leases are released while the browser and page remain operator-owned.
Do not run an automated target against the same authenticated environment
during manual inspection, because a later admitted run may activate its own
exact tab without requesting OS focus.

### Human foreground setup

`npm run qa -- setup [site] <feature>` is the product-aware human-test entrypoint.
It composes a closed site preset with one feature instead of publishing every
site/feature pair as a target. Omitting `site` selects `youtube`; the other
canonical site ids are `youtube-shorts`, `x`, `instagram`, `instagram-reels`,
`tiktok`, `reddit`, and `facebook`. An optional `--url` must have exactly the
declared origin of the selected site. There is no custom-site or cross-origin
fallback.

| Accepted feature input | Canonical feature id | Canonical target |
| --- | --- | --- |
| `furin`, `site-furin`, `site_furin` | `site_furin` | `human/site-furin` |
| `global-furin`, `global-sentinel`, `global_sentinel` | `global_sentinel` | `human/global-furin` |
| `shishi-odoshi`, `shishi_odoshi` | `shishi_odoshi` | `human/shishi-odoshi` |
| `enso-gate`, `enso_gate` | `enso_gate` | `human/enso-gate` |
| `detour-spread-guard`, `tab-spread-guard`, `detour_spread_guard` | `detour_spread_guard` | `human/detour-spread-guard` |

All five targets use the managed `authenticated` environment and the
`dev_extension` artifact. `setup` fixes the execution mode to `human` and the
presentation to `foreground`; callers cannot override either. Before starting
a live session, preflight the resolved target with the same site and feature
options, for example:

```bash
npm run qa -- doctor human/global-furin --mode=human --site=youtube --presentation=foreground
npm run qa -- setup global-furin
```

Site Furin's retired `--ritual-version=original` option is no longer accepted. All current/full/brief manual invocations use the chime contract; the koi implementation is an offline archive only.

The protocol creates only ledger-owned page targets and prepares the requested
real product surface. Site Furin and Global Furin use the Sentinel runtime;
Shishi-odoshi presents the real entry-checkpoint Gate. Enso Gate uses the real
Interaction Manager realization while intentionally bypassing detector
admission. Detour spread guard likewise presents a real Gate session/UI without
detector admission, and every protected tab in its payload is a tab created and
owned by that QA run. Pre-existing operator tabs are never enrolled in that
scenario.

Detour setup accepts `--max-protected-tabs=1..20` and
`--open-tab-count=2..25`, with the open count strictly above the selected limit.
The canonical controller redirects the exact owned tab into the full-page Gate;
readiness checks the exact session URL, top-level document, Detour root, and tab
quota. The former `--presentation-mode` option, inline notice, and iframe
surface are retired. `gate/detour-spread/render` continues to capture the actual
full-page selection; the old rail and notice render scenes are removed.

Human Site/Global Furin opens its exact owned tab with the shared adapter's
`document` observation. It uses native document/overlay visibility, without
focus emulation or requiring production tracking's `lastActiveTabId` to match
before operator handoff. The trusted manual START already validates the exact
web tab, stable URL and content readiness; it does not claim natural consumption
or automatic admission. `QA_HUMAN_SETUP_TARGET_ADMITTED` records the native
observation contract and `not_required_for_document` tracking evidence. Running
build identity, exact target/window ownership, production-session exclusion and
rendered feature readiness remain mandatory. Other setup features and automatic
runtime targets retain their existing admission requirements.

The upper session first correlates the exact owned target and tab with its CDP
window receipt, the exact managed Chrome PID and one native window, then uses
the sole `operator_request_once` to prepare that window before feature START.
This restores a minimized window through the existing owner and applies the
secondary-monitor preference after original-window proof. Its receipt validates
the expected placement and preserved normal/maximized state. No second focus
request is permitted during readiness polling or after display. Only after both
that receipt and real feature readiness succeed does the protocol print
`QA_HUMAN_SETUP_READY` with status `READY_FOR_HUMAN`. The low-level
`QA_OPERATOR_HANDOFF_READY` receipt proves window preparation only, not a ready
product feature.
Sentinel setup verifies worker first-frame readiness and the actual visible,
connected document/overlay/scene/iframe; Global also requires its first koi in
`awaiting_start`. `active` alone is insufficient. `QA_HUMAN_SETUP_SENTINEL_INVOKED`
records the initial runtime and surface evidence, and `QA_HUMAN_SETUP_STAGE_READY`
records attachment, target admission, operator window preparation and visible
feature durations.
`setup ... global-furin --capture-screenshots=true` (also Site Furin) retains an
opt-in initial display PNG in the run attachments. This direct realization does
not shorten any budget, detector threshold, or product animation duration.
Human Site/Global setup defaults `hudVisible` to false for an unobstructed
experience; use `--hud-visible=true` to opt into the current diagnostic panel.
This does not disable structured runtime/surface observations.
After handoff, Sentinel setup observes without activation/focus or synthetic
input. It writes `human-sentinel-latest.json` and emits
`QA_HUMAN_SETUP_STATE_CHANGED` only for state changes; lost sessions and transport
errors remain visible rather than leaving a stale READY claim. Observation never
restarts the feature, changes settings, or expires the human session. Screenshot
opt-in also captures the display after handoff. Production takeover is reported
as `SENTINEL_PROTOCOL_QA_PRODUCTION_SESSION_ACTIVE`.
Windows attached identity combines exact command-line evidence with the canonical
OS process proof even when the executable is absolute. This ensures a verified
PID reaches window correlation; missing/ambiguous PID remains a hard failure.
`foreground` presentation alone does not grant OS focus: the compiled reusable
browser contract remains `osFocus: never`, and only the explicit top-level
`setup` command authorizes this separate one-time operator handoff. Direct
`run human/...` invocation is rejected.

The READY marker is a live handoff, not a terminal result. The runner retains
the resource lease, feature session, and all owned tabs with no wall-clock
expiry while the person tests. It must remain running until the operator presses
Ctrl-C in that exact QA terminal. Cancellation runs typed STOP or dismissal
first, closes and proves absence of only the exact run-owned tabs, releases the
session resources in reverse order, and disconnects from—but does not stop—the
managed authenticated browser or its profile.

The operator desktop shortcut targets the default blank-page form of this
command, not a product runtime protocol:

```text
npm run qa -- browser page authenticated --url=about:blank
```

The shortcut is itself an exact, typed local resource. Install or revalidate it
through the public QA CLI; the installer first proves a staged `.lnk`, then
replaces only the declared desktop link and re-reads every field:

```bash
npm run qa -- browser shortcut install
npm run qa -- browser shortcut validate
```

```bash
npm run qa -- browser start authenticated
npm run qa -- browser ensure authenticated
npm run qa -- browser open authenticated
npm run qa -- browser page authenticated --url=https://www.reddit.com/r/popular/
```

## Browser Presentation Contract

Every browser target declares a `BrowserRequirementContract`; the Entropy
compiler combines it with local environment facts and emits the reusable
`BrowserExecutionContract`. `foreground`, `background`, and `hidden` are named
display presets, not execution authority. Protocols consume the compiled leaves
instead of reconstructing behavior from a free-floating `headed` boolean.
The neutral Playwright owner rejects launch or attach without that complete
contract. If a transitional caller also supplies `headless`, presentation,
audio, or rendering values, they are consistency assertions only and a
contradiction fails before browser admission. Contract synthesis from those
legacy values is confined to `scripts/qa/browser/qaPlaywrightBrowserOwner.mjs`;
the reusable owner never performs it.
Connection ownership is also separate from lifecycle authority. `automatic`
means the run owns start and cleanup. `managed_explicit` is the lifecycle
identity-probe/manual-command policy. `managed_ensure_before_attach` means the
upper run session may idempotently ensure only its declared managed profile
slot before handing control to an attach-only lease. `external` means only the
operator owns lifecycle. Both persistent forms remain `attach_only` from the
browser connection owner's perspective; neither grants start authority to the
low-level attach path.

| Presentation preset | Owned display/process mode | Attach-only display/process mode |
| --- | --- | --- |
| `foreground` | headed, run-owned automatic start, real host display required | external display and process preserved |
| `background` | headed, run-owned automatic start, host display or one managed Xvfb | default for authenticated QA Chrome; external display and process preserved |
| `hidden` | headless, no display surface; only targets declaring `hiddenAllowed` | rejected because an already-running visible browser cannot truthfully become hidden |

Choose the entrypoint by operator intent, not by the `human`/`agent` execution
mode. Those modes select protocol behavior and never grant visibility or focus:

| Intent | Canonical entrypoint | Visibility and focus contract |
| --- | --- | --- |
| Unattended, user-invisible automation | owned target with explicit `--presentation=hidden` | run-owned headless browser, no display, `osFocus: never`, exact run cleanup |
| Visible attached automation that must not steal focus | authenticated target with `--presentation=background` | existing external window preserved, exact tab may be active, no OS-focus request |
| Human asks to reveal the existing QA window | `browser open authenticated` | one bounded `operator_request_once`; existing page preserved when present |
| Human asks for a new visible tab | `browser page authenticated [--url=...]` | one exact new tab plus one bounded `operator_request_once`, then explicit handoff |
| Human asks to prepare a live product feature | `setup [site] <feature>` | one exact PID/window-correlated `operator_request_once` prepares the window before START; READY still requires the real feature; runner retains exact targets until Ctrl-C |

`background` is not a synonym for invisible: an owned headed run may use the
host display or a managed Xvfb, and an attached browser already has an external
window. Only `hidden` proves no display surface. Conversely, `foreground` on
an attach-only target still compiles to external display preservation and does not override `osFocus: never`;
it is not an operator-focus command. The operator-only `browser open`, `browser
page`, and `setup` commands each own an explicit bounded exception; only
`setup` couples that exception to a live product feature and retains runner
ownership through human inspection.
The current authenticated managed slot deliberately declares `focusPolicy:
never`, so a protocol such as `audio/suikinkutsu` that requires
`osFocus: request_once` remains blocked until a separately declared compatible
environment exists. It must not borrow the operator page command's focus
authority.

A `managed_persistent` target run still connects as `attach_only`; its
independently typed `startPolicy` is `managed_ensure_before_attach`, not
`external`, per-run `automatic`, or the manual lifecycle command's
`managed_explicit`. The upper `QaRunSession` performs that named ensure before
constructing `QaBrowserLease`; external and per-run plans never enter this
step. The lifecycle lease is released before the attach lease is acquired, so
the attach boundary reclaims broker/capacity and re-proves exact identity. If
another session wins that interval, the run fails loudly as `BLOCKED`; it does
not retry, guess, or launch a substitute. Atomic reservation transfer across
that boundary is a future refinement, not a hidden fallback.

Document visibility, tab activation, and OS focus are separate target-owned
leaves. Ordinary visual and runtime targets require a visible document and an
active target while declaring `osFocus: never`; activating a tab inside a browser
must not be treated as permission to take the operator's keyboard focus. A
protocol that truly needs real browser chrome interaction must declare and
record its bounded exception at that protocol boundary. The Suikinkutsu toolbar
pin driver remains that narrow `request_once` exception and is admitted only
when the named external profile declares `focusPolicy: request_once`; it is not
inherited by ordinary page activation. Inline authenticated configurations and
managed profiles remain `never`, so an unpinned toolbar in those environments
is BLOCKED for operator configuration rather than silently focused.

Attach-only runtime pages are first created with `active: false`. The adapter
then proves visible/focused document semantics through focus emulation,
activates only its exact owned tab without calling `chrome.windows.update`, and
requires the production tracking snapshot to admit that tab as
`lastActiveTabId`. The receipt records background creation, exact tracking
admission, and `windowFocusRequested: false`; a missing admission fails the run.
Each in-page tracking-message probe has its own callback watchdog inside the
single overall admission deadline. Ordinary exact-tab tracking retains its
two-second overall and 500ms per-probe warm bounds. A lost callback is fenced
from later probes and retried; exhausting the deadline fails as tracking
admission rather than hanging until the outer CDP evaluation timeout. Receipts
and typed failures retain bounded attempt, callback, late-callback, watchdog,
runtime-error, dispatch-error, mismatch, and elapsed-time counters. This
liveness boundary does not grant alternate target evidence, a window-focus
request, or a fallback path.

### Attached Reddit Surface Oracle

```bash
npm run qa -- run site/reddit-surface-attached --mode=agent
```

This target uses the authenticated `managed_persistent` environment with
`attach_only` process ownership, `extensionRuntime: none`, background document
visibility, background target activation, and `osFocus: never`. Here `none`
means the oracle neither requires nor controls an extension runtime; extensions
already present in the operator profile remain untouched and may affect the
page. Before reading the page, the protocol acquires browser capacity, connects
to the declared CDP endpoint, and re-proves the declared executable, profile,
profile directory, debug endpoint, product, protocol version, and browser epoch
on that same connection. The final report retains those results under the
non-colliding `attachedBrowserObservation` receipt, with the epoch projected as
a content-free SHA-256 digest beside the exact PAGE-set proof.

The operator must already have exactly one `https://www.reddit.com/r/popular/`
page open. Zero matches is a typed next-action result and more than one is an
ambiguity failure. The protocol attaches to that operator-owned target, takes
one bounded DOM observation, and detaches. It does not stage or reload an
artifact, create a target, navigate, activate, emulate focus, scroll, close a
target, or request OS focus. The exact PAGE target-set digest must remain
unchanged. `attach_disconnect_only` is action evidence that the protocol did
not request process termination; it is not an external process-liveness or OS
foreground observation.

This oracle has deliberately narrow authority. Browsing may still change
cookies, cache, history, service workers, telemetry, extension state, or other
profile/site/runtime data; those side effects are neither measured nor
restored. The target has no native extension-disabled baseline and does not
attribute product effects, certify disable/re-enable behavior, or claim parity
with the owned clean-commit release lane. A `PASS` means only that the exact
route was accessible and the sampled DOM contained post, metric, media, and
text opportunities.

Catalog selector counts and the independent relationship oracle remain separate.
The latter discovers bounded Reddit post owners from same-origin `/comments/`
permalinks, meaningful owner-local text, and at least two local
vote/comment/time/media signals without consulting the catalog post selector.
A catalog miss with positive relationship evidence is reported through
`structuralRecoveryUsed` plus explicit degradation categories; malformed or
internally inconsistent observations fail loudly. The oracle never writes a
replacement selector.

Headless-capable owned QA targets default to `hidden`, `muted`, active-target rendering, and
no OS-focus request. An explicit repeated run
can stay offscreen, for example:

```bash
npm run qa -- run site/release-core --mode=agent --repeat=10 --presentation=hidden
npm run qa -- run site/youtube-root-visual-continuity --mode=agent --presentation=hidden
```

`site/youtube-media-membership` selects the existing `youtube-media-targeting`
scenario from `targeting-core` with `site=youtube` and `feature=media`. It admits
one to three repeats and either diagnostic or release lane (default diagnostic).
The existing site-runtime owner runs a required `visual_media_membership_probe`:
one exact owned plain thumbnail fixture with local image data exercises candidate src
revocation, requalification, host inline filter preservation and absence of a
retained effect on ineligible reattachment. An adjacent ineligible image is a
negative control. Its plain element avoids site custom-element lifecycle work
on the fixture's child nodes. The fixture is removed in `finally`; the probe starts no
observer, browser or network request and imports no product classifier. Missing,
timed-out or contradictory effect evidence cannot pass its contract. Page-world
animation enumeration returned empty despite an applied extension filter in the
initial Chrome runs; the oracle uses computed filter deltas instead. After a
bounded 1500ms removal-settlement window, reattachment is sampled synchronously
before another mutation callback can repair a retained effect. This does not
claim access to isolated-world animation handles or a universal cleanup SLA.
This is controlled DOM evidence in Chromium on a YouTube page, not evidence of
the frequency of this reuse pattern on real site cards or a CPU benchmark.
The effect probe is omitted from the extension-disabled performance control;
that control cannot certify an installed effect's lifecycle.
The named target reuses the declared ephemeral browser and artifact lifecycle;
it does not authorize a raw CDP/browser entrypoint.

The same required action also runs `visualShortFormContextProbe.mjs` (2026-09-20).
Controlled portrait fixtures in `grid-shelf-view-model` exercise both Shorts
lockup versions with the unmodified production profile: wrapped evidence addition,
movement between two grids, wrapper removal followed by evidence extraction in
the same task, and final removal. A further positive/negative pair removes a
wrapper, awaits one microtask so native observer delivery can finish, then empties
the detached wrapper before the deferred frame/cooperative consumers run. It
requires normal-strength restoration for both lockup versions without adding a
probe observer or accessing product internals. A third initially positive grid
tests removal independently of late-addition success. The independent computed
filter oracle requires exactly one blur term matching the reported strength,
and checks unchanged neighboring media and host inline filters; it
imports no product classifier. All fixture roots are removed in `finally`, and
missing, timed-out or incomplete phase evidence fails the additional contract.
This is Chromium controlled-DOM correctness evidence, not a live-card frequency
sample, OFF cancellation proof, or CPU benchmark.

`site/youtube-media-removal-cost` reuses that scenario and the same ephemeral
browser/artifact owners in the diagnostic `contention` profile. It defaults to
three samples (one to three are admitted), each in the existing
`fresh_disposable_browser` repeat isolation so accumulated use cannot carry
between samples. Only contention-mode membership
actions add the bounded removal-cost probe; ordinary membership runs do not
pay its cost. Each sample prepares 0/3/300 portrait media and 24 metadata nodes
for outside-grid, positive-grid and base-grid removal. Fixture preparation,
initial effect settlement and final computed-filter checks are outside the
measured action. Real site DOM/scripts remain active, so counts refer to fixture
targets and do not claim a document with no other managed media.
The existing action metric/contention/causal-window projection records the
mutation window. `visualRemovalCostProbe.mjs` enables CDP CPU sampling at 100us
only on that already-owned page session, stops/disables it in finally, bounds
profile input and returns only declared Visual owner groups from the exact
owned extension ID. Empty profiles are rejected. Inclusive sampled
groups overlap; zero samples are insufficient resolution, not zero cost.
Sampling and runtime diagnostics overhead are included. The profiler surrounds
the action helper including metric snapshots and contention projection;
`runtimeCost.window` covers its inner mutation action. Their durations must not
be combined or normalized as one window. No raw stack URLs,
new browser, focus action, observer or product classifier is introduced.
Exact UUID fixture roots are removed in finally. The additional contract
requires all nine fixed workloads, nonempty owner-scoped samples, available
runtime metrics and preserved effects; a PASS certifies
fixture execution, not performance improvement. The contention profile reports
the approved operating-envelope baseline as not evaluated, consistently with
the existing contention protocol; paired cost interpretation remains separate.

`site/youtube-root-visual-continuity` is a release-lane-only contract target,
separate from `site/release-core`. It performs one trusted same-origin YouTube
search-results-to-Home logo transition, requires the original document/time origin to survive,
samples the computed root grayscale on every animation frame, and analyzes a
known QA probe pixel from an in-memory bounded page screencast. Encoded frames
are never attached or written; the report retains only frame counts, bounded
filter strings, chroma summaries, and `persistedFrameCount: 0`.
The target fixes `measurement=contract` and one repeat so the generic approved
performance-baseline evaluator cannot dilute this correctness verdict.

Authenticated targets default to `background` to protect unrelated work in the
operator-owned Chrome. Audio-sensitive targets declare `audible_required` and
compile to `audioPolicy: audible`; their existing runtime preflight still
proves that the external browser was not launched with `--mute-audio`.
`--headed`, `--no-headed`, `--headless`, and `--no-headless` remain accepted at
the control-plane boundary and translate to `foreground` or `hidden`; new
callers should use `--presentation`.

`DisplayLease` resolves the display before browser launch from `displayPolicy`
rather than from target-activation or focus hints. Foreground is
truthful: Linux requires an existing `DISPLAY` or `WAYLAND_DISPLAY`, WSL may use
the declared Windows Chrome desktop, and a missing desktop fails as
`QA_DISPLAY_FOREGROUND_HOST_REQUIRED`; it never silently becomes headless or
Xvfb. A headed background Linux run may create one child-owned Xvfb and exports
only that lease's `DISPLAY`. Hidden runs are headless and allocate no display.
Xvfb is a virtual X server, not a GPU, so a physical-GPU requirement is rejected
on that path.

Chrome for Testing is a reproducible Chrome distribution, while Linux and
Windows builds are distinct executables. The declared absolute executable is
the authority: a Linux binary consumes the Linux display lease; a Windows
`.exe` reached through WSL consumes the Windows desktop and Windows-native
profile paths. The control plane never substitutes one platform build for the
other. After connection, `SystemInfo.getInfo` is projected by one shared GPU
classifier. Device inventory may prove `hardwareAvailable`, but only the active
GL renderer may prove `hardwareActive`. SwiftShader, llvmpipe, WARP, and related
active renderers are software even when a physical GPU is also installed; known
active vendor evidence is hardware; ambiguous data stays unclassified. Only
`physical_gpu_required` fails without active-hardware evidence. Headless or Xvfb
evidence must not be reported as proof of end-user physical-GPU behavior.

The architecture guard rejects raw Playwright launch/attach, Chrome process
spawn, and CDP page-target create/close calls outside these owners. The sole
Playwright exception is `scripts/generate-icons.mjs`: it is a build-time asset
renderer, creates no QA environment or persistent profile, and remains outside
the test-browser control plane.

Audio is similarly explicit. Owned browser launches are muted by default via
the process owner. `audible_required` is a named exception and attach-only
audio QA separately proves that the external Chrome was not started muted.

Run authenticated Feed Horizon in explicit human or agent mode:

```bash
npm run qa -- run feed/instagram-reels --mode=human
npm run qa -- run feed/x-home --mode=agent --hold-ms=10000
npm run qa -- run feed/gesture/instagram-reels --mode=agent --require-video=true --capture-screenshots=true
```

Feed endpoint inspections and the Reels manual Gesture Gate target declare
`browserObservation: document`. The parent and child retain read-only OS focus
receipts with `preserved:null`; selecting Chrome on a secondary monitor is not
a failure. Neither owner requests focus, minimizes, restores, moves or resizes
the existing window. Native tab activation/visibility and capture admission stay
independent requirements. A minimized or unavailable capture surface still stops
the run with the existing typed outcome, without repairing the operator's window.
Declared native observation disables focus emulation. Before-arm, actual Gate
and completion probes run independently of `capture-screenshots`; their bounded
receipts use `AGENT_EXECUTION_OBSERVED`. A valid lost prerequisite emits
`AGENT_EXECUTION_UNAVAILABLE` (before-arm BLOCKED, later INCONCLUSIVE). The parent
rechecks the exact declared observation and native evidence, rejects contradictory
completion markers, and never converts an invalid receipt into an environment
excuse. No failure screenshot is attempted on that unavailable surface.

`feed/gesture/instagram-reels` uses the existing dev inspection capability with
`handoffMode: production` and an explicitly **manual** admission lease. Production
handoff means the real `requestEnsoGate` presentation/outcome path, not production
cadence eligibility. It drives the same native endpoint, waits the requested hold,
then sends renewed demand, verifies one actual Gate, presses Escape for neutral,
and scrolls backward. PASS requires the Gate gone, native scroll decreased, the
same committed Horizon endpoint retained, and no new forward advance. It does
not certify a completed Continue gesture, episode termination or a 12-minute
usage interval. Setup and teardown remain exact run-owned targets/capabilities.

Both manual completion markers carry `admissionMode: manual`,
`timingPolicyEvaluated: false`, and schema-1 `inspectionEvidence`: the unmodified
v2 inspection snapshot, surface grain, confirmed advances, admitted decision and
document-bound manual Enso lease. The actual-Gate marker records that evidence
at display, before neutral resolution. The protocol rejects a natural/ordinary
lease, wrong handoff mode, missing identity, mismatched hold, missing morphology
or invalid backward evidence. Live tempo research is no longer a prerequisite
for manual presentation PASS after the time-policy cutover. The three historical
`feed/gate/*` natural-driver contracts remain separate and require migration to
current cadence evidence before use as time-policy release certification; they
are not silently downgraded to manual checks.

The endpoint inspection targets accept `--capture-screenshots=true`. Their existing
owned page is captured before ARM, at rest, and on a thrown failure before cleanup;
each phase has a second sample after 900 ms without input or focus.
`AGENT_HORIZON_CAPTURED` references the phase's `horizon-presentation*.json`
(viewport, text, geometry, and bounded visible-video readiness/error/frame counters)
and its two PNGs. A missing endpoint has `textStable:null`, never a successful
stability result. These are appearance/stability evidence, distinct from
the native endpoint and renewed-demand assertions. No separate browser owner or
production presentation path is introduced.

Before each capture phase, the existing attached-page observation owner records
the native tab/window state and a bounded 1.2-second frame sample in
`horizon-<phase>-execution.json`. Focus-emulated `visible`/`hasFocus` does not
admit a minimized native window. The shared document classifier checks an active,
visible, non-minimized surface without imposing an FPS threshold or claiming
foreground consumption. A proved unavailable surface before ARM returns
`AGENT_CAPTURE_UNAVAILABLE` / `BLOCKED`; loss at ready-to-arm/rest returns
`INCONCLUSIVE`. The protocol revalidates the observed reason and rejects any
simultaneous completion claim. Malformed evidence or a screenshot timeout on an
admitted surface remains FAIL. An unavailable surface is not captured a second
time merely to illustrate that failure. If another product error is already
primary, failure-capture loss cannot turn it into an environment-only result.
The probe never restores/minimizes/focuses a window or substitutes a capture
backend; the operator's window state remains authoritative.

Paged feed QA uses the same trusted wheel driver with `scrollPageRatio:0.9`,
measured from the scroll candidate's actual client height and capped at the existing
1,800px input limit. It is exclusive with fixed `deltaY`/`maximumDeltaY`. Fixed
520px input at a 1,785px portrait viewport returned Reels to the same native snap
after every dwell. This change adjusts the authored QA gesture, not production
advance/admission thresholds. Every feed wheel step retains existing scroll and
dialog evidence. Reels' endpoint oracle checks native lane identity and native
branch snap alignment separately from the temporary `scroll-snap-type:none` that
holds the readable footer; requiring native `y` snap during footer rest is stale.

Paged inspection targets additionally accept `--require-video=true` in agent mode
with `--capture-screenshots=true`. The existing bounded warmup waits for a decoded,
non-inert video covering at least 42% of the viewport (the paged observation scale)
as well as canonical ready/safe evidence. It captures `ready-to-arm`, then requires
the two rest samples to show advancing decoder frames and changing playback time
(including loop wrap) on the same non-paused video element. Adaptive intrinsic
resolution is not identity. A capture-local WeakMap assigns opaque element IDs
to at most eight visible video samples; finally removes that temporary registry.
Photos, a frozen decoder, missing identity, another element, hidden/transparent
or quarantined media cannot certify video preservation.
Rest evidence now binds both samples to the exact endpoint anchor branch:
canonical anchor/marker/tail adjacency and the tail's terminus prove ownership;
only that anchor's videos are sampled. Both samples require the same opaque
branch and video element IDs, vertical viewport intersection of at least 42%,
and horizontal intersection of at least half the smaller video/viewport width.
Actual bounds are retained and revalidated with frame/time progress. A missing
or replaced branch cannot fall back to an unrelated visible video. Only the
pre-endpoint ready-to-arm sample may declare viewport scope. These are DOM
identities, not content-URL identities or evidence of viewer attention.
The completion envelope verifies `videoPlaybackObserved:true`. The default still
allows photo slides. This changes only the authored QA fixture, never product
eligibility, and never searches without the existing warmup bounds.

Natural Gate backward probes retain the existing bounded observation ledger before
and after the action alongside the strict unchanged-advance assertion. Initial
readiness login, CAPTCHA, two-factor and consent proofs produce `AGENT_PAGE_BLOCKED`
schema-2 evidence with their exact observed flag. The protocol validates the flag
and reason together. A generic readiness timeout remains FAIL; it is not silently
reclassified as a login requirement. A failure capture can identify a missing
content prerequisite for the operator without rewriting the historical run status.

Natural Gate evidence reports `seamWaitMs` from the final canonical seam's
`waitedMs`, and preserves `observedArmToInterruptMs` as a separate elapsed-time
diagnostic. First sampled eligibility may precede invalidation and rearming;
it is not the current seam's clock. The protocol requires matching fired
`finalSeam` evidence, `seam_reached`, a nonnegative wait below the same 90s limit,
ordered eligibility/admission/endpoint milestones, and the complete production
Horizon/Gate/neutral/backward chain. It never relabels a historical FAIL after a
projection correction. Gate completion retains up to 16 sampled admission and
transport states, and failure logging preserves nested AggregateError causes.

Automatic QA never obtains OS focus permission from a target's need for a
foreground document. `allowInitialWindowFocusOnce` defaults to false throughout
the catalog. A user-authorized explicit opt-in allows at most one initial
preparation for the exact managed browser process started by that same run.
`QaRunSession` loads the protocol before managed browser ensure or presentation;
an unavailable protocol cannot open or focus a browser. Artifact and environment
admission still precede presentation. Existing-process attach and every retry
with `lifecycleAction: already_ready` withhold the grant even if a normalized
old flag remains true. They create no focus anchor and never restore, minimize,
move or refocus the existing window. Missing native prerequisites stop the test;
they do not authorize repair. New tabs and cleanup cannot renew a grant.

For an explicitly opted-in newly started empty managed process, the existing
anchor owner may accept the first-window side effect, minimize that exact window
and prove background state. A foreground-observation target instead uses
`agent_present_once`. Both routes verify the lifecycle's launched PID and browser
epoch against the currently admitted identity before creating an anchor. Failed
preparation consumes that run's attempt, and a later attach to the live process
cannot renew it. No new persistent grant store or alternate lifecycle is used.
Actual headless execution has no native focus/anchor grant even with an explicit
flag. Human Feed inspection still requires an existing page; explicit
`qa:open`, `browser page/open` and authorized operator/human handoff retain their
separate one-action presentation semantics.

The same upper-session anchor lease owns the bounded initial preparation.
`qaOperatorBrowserWindow.mjs` shares exact PID/window correlation between initial
preparation and operator handoff, whose authority and lifetimes remain separate.
`QaAttachedBrowserOsFocusGuard` retains its background assertion by default.
Native animation/foreground observation instead emits read-only `QA_BROWSER_OS_FOCUS_OBSERVED`
receipts (`preserved: null`), allowing the user to switch away without repair.
The protocol checks its own execution prerequisites and stops if they are lost.
Cleanup closes only journaled owned targets, without minimizing/restoring an
operator's existing window or substituting a browser/profile/headless mode.

The Windows driver first correlates the original native window with the exact
PID and CDP bounds. Its one initial/operator preparation prefers a secondary
monitor, retains a window already on a secondary monitor, and otherwise moves
only that proved window into the selected work area. Normal size is preserved
unless it must fit the work area; maximized state is retained. A single monitor
keeps its placement. The receipt validates original, expected and resulting
geometry with the declared native-frame tolerance. Enumeration/placement errors
remain explicit. No observation, polling, retry or later input may reposition
or repair focus. Fresh native-Windows Chromium/Playwright launches use
`windowsLaunchPlacement.mjs` and `windowsMonitorInventory.ps1` for the same
secondary preference, with physical/DIP and DPI conversion; explicit launch
positions remain authoritative. These launch hints never move an existing
external browser or grant focus authority.

The owned `journey/protection`, `settings/concurrency`, `settings/propagation`,
`gate/entry-checkpoint/runtime` and `gate/entry-checkpoint/consumption` targets declare
`initialWindowPresentation: windows_agent_present_once`, default to
`presentation: hidden` except real consumption, and default `allowInitialWindowFocusOnce` to false.
`QaRunSession` supplies its single-use `requestInitialOwnedWindowPresentation`
only for those opted-in agent/owned/per-run/foreground contracts. Each protocol
requests it for the first tab-proved product UI scenario page, after exact tab activation
and before input or consumption observation. The upper owner verifies target/tab/browser-epoch
membership and the run's owned-process fingerprint; `qaOperatorBrowserWindow`
then consumes the neutral owner's live child/CDP identity proof, reads the exact
target window and calls the existing PID/bounds-correlated Windows driver once.
No attached/managed identity rule or steady-state `osFocus: never` is widened.
Failure consumes the grant, cancellation/closed-session checks fence each async
read before focus, and the session drains the admitted operation before process
cleanup. Every tab-proved UI scenario remains in that initial-history count even
after it was closed, so a later UI page cannot renew preparation. A null-tab
native disposable reload seed is excluded only when it is already released with
`runtime_marker`, `about:blank`, exact browser epoch and proved `closed` or
`already_absent` cleanup. An admitted or otherwise unproved null-tab scenario
still rejects preparation. The canonical management/startup marker and cleanup
owners are unchanged. Receipts contain only target/tab/window/process IDs, status and
bounded native presentation evidence; owner tokens and launch arguments are
never projected. A verified non-Windows owned process explicitly returns
`not_required / non_windows_presentation_contract` without focus: this declared
preparation concerns Windows native windows only. Native document visibility
remains required on every platform. Background presentation or explicit focus
opt-out receives no callback and still must satisfy visible-document admission.
Creating another tab, a failed visibility gate or a retry never renews focus.

On a journey failure, `integratedProtectionQaProtocol` records one read-only
`failure_window_attribution` before screenshots. Only its currently admitted
scenario target/tab/browser-epoch records and already existing owned trusted
helper are eligible. The helper reads exact tabs and the active tab in each
owned target window; `qaOperatorBrowserWindow.observeQaOwnedBrowserWindows`
revalidates the neutral live-child/CDP process identity and correlates each CDP
target window with that tab's window ID. It inspects native foreground once via
the existing Windows driver without activating a tab, focusing/restoring a
window, creating a helper or retrying a measurement. That native value has
`scope: verified_process_main_window` and `targetWindowCorrelated: false`:
it cannot certify foreground for a particular target window or prove occlusion.
Document visibility/readiness/focus remain separate bounded observations.
Headless runs retain owned target/tab/document evidence and explicitly report
native window attribution as `not_applicable / headless_no_host_window`; they
never probe or present a host desktop window for failure evidence.
Receipts exclude URLs, page text, window titles, launch arguments and owner
tokens. An unavailable read records only a closed named error code and preserves
the original failure. Non-Windows native inspection is explicitly
`not_supported / non_windows_observation_contract`; it changes no admission.

Run the human or one-command agent Suikinkutsu audio-resolution experiment
against the attach-only QA browser:

```bash
npm run qa -- describe audio/suikinkutsu
npm run qa -- doctor audio/suikinkutsu --mode=agent
npm run qa -- run audio/suikinkutsu --mode=human --rebuild
npm run qa -- run audio/suikinkutsu --mode=agent
```

Run Site Furin or Global Sentinel against one explicit QA-profile web tab:

```bash
npm run qa -- doctor sentinel/site-furin/runtime --mode=agent
npm run qa -- run sentinel/site-furin/runtime --mode=human --url=https://example.com/
npm run qa -- run sentinel/site-furin/runtime --mode=agent --capture-screenshots=true
npm run qa -- run sentinel/site-furin/runtime --mode=agent --delivery-form=brief --capture-screenshots=true
npm run qa -- run sentinel/global/runtime --mode=agent --url=https://example.com/
```

Site/Global runtime targets use native `document` observation. They reuse the
existing visible managed window, retain read-only focus receipts and never
emulate document focus or require Chrome to be outside the OS foreground.
Before start, after actual start and at completion the shared execution probe
checks native active/visible/non-minimized document liveness. This functional
run does not certify natural foreground time accrual or an FPS threshold.
Unavailable native execution retains the shared INCONCLUSIVE outcome.
Site `--delivery-form=full|brief` selects the actual product variant through the
trusted manual QA start contract; it does not change daily receipts, force
production eligibility or override animation durations. Global has no brief
parameter. Site terminal evidence currently certifies arrival at reflection;
the final QA STOP is cleanup, not a user continue/leave decision.

Global Sentinel's background agent driver activates its exact semantic button
inside the overlay without injecting browser user activation. It verifies the
windowed semantic flow; native fullscreen is exercised through actual operator
input in `setup global-furin`. Fullscreen transitions can raise Chrome's window
on navigation and therefore do not fit the background `osFocus: never` contract.
The driver verifies accepted starter progression within five seconds, then follows the
observed production contact windows once per act/attempt. It does not shorten the
sequence or reconstruct a separate QA tempo. Captured stages retain actual
document fullscreen state and viewport dimensions. After all fish disappear,
the driver preserves the completed aperture for another 2.2 seconds before
selecting it. PASS requires the natural same-tab Room 478 handoff with the
canonical seed/origin and destination readiness. A navigation that remains on
the original page for five seconds records the runtime snapshot and scoped
Sentinel warning/error diagnostics, then fails explicitly. It never substitutes
a forced navigation or treats STOP as successful completion.

Run one fixed, model-blind Feed consumption journey or a bounded platform matrix:

Since 2026-09-08, browser checkpoints additionally retain `sensorObservation`
from the canonical live content producer. This content-free geometry/coverage/
unknown-source displacement snapshot is separate from model observations and
never changes journey selection or the existing verdict. Missing snapshots are
null, not observed zero. A research PASS does not certify the new sensor's item
boundaries, coverage accuracy or user attribution; those require independently
authored DOM expectations. Synthetic replays do not manufacture live sensor data.

```bash
npm run qa -- doctor feed/research/youtube-shorts --mode=agent --journey=steady_forward
npm run qa -- run feed/research/youtube-shorts --mode=agent --journey=steady_forward
npm run qa -- run feed/research/instagram-home --mode=agent --journey=steady_forward --feature-profile=feed_social
npm run qa -- run feed/research/instagram-home --mode=agent --journey=steady_forward --feature-profile=feed_video_skip
npm run qa -- run feed/research/instagram-home --mode=agent --journey=steady_forward --feature-profile=feed_social_video_skip
npm run qa -- run feed/research/core-matrix --mode=agent
npm run qa -- run feed/research/core-matrix --mode=agent --allow-initial-window-focus-once=true
npm run qa -- run feed/research/x-completion --mode=agent --allow-initial-window-focus-once=true
```

The research protocol uses the same attached Feed inspection child and exact
target cleanup owner as Feed Horizon, but never arms Feed Horizon or requests a
production Gate. Journey steps are fixed before execution. Runtime
load/detection/admission outputs are observations only and cannot select the
next action. Recovery branches are owned only by the independent DOM oracle:
an unavailable score may preserve the requested trusted input without scoring,
and a stalled TikTok desktop wheel opportunity may receive one bounded
ArrowUp/ArrowDown retry inside the same requested transition. A run
requires a confirmed FeedTempo research write fence, rejects content-bearing
trace keys, reports insufficient DOM measurement as `INCONCLUSIVE`, and keeps
the authenticated Chrome process/profile alive. The suite calls only the
canonical `runQaTarget` API and groups pairwise curve separation by platform.
Single research targets accept the closed `featureProfile` values `feed_only`,
`feed_social`, `feed_video_skip`, and `feed_social_video_skip`; matrix targets
remain `feed_only`. The optional suffixes preserve each feature's canonical
value while activating Social Metrics and/or Video Skip, so one exact journey
can compare FeedFlow, ObserverHub, Social Metrics, Video Skip subscriber work,
and shared contention. The summary records monotonic counter deltas over the
exact initial-to-final debugger window as `runtimeCostEvidence`; a missing,
reset, or malformed counter fails the run instead of being defaulted.
The same window also owns `stabilityEvidence`: a content-free QA page observer
records large upward scroll discontinuities, resets near the top, Layout Shift
entries (including sources intersecting Social Metrics owner markers), and
aggregate visible action-control gap geometry. The probe never retains DOM
nodes in evidence, publishes its callback overhead, and is removed before the
owned target closes.
Every run also records a content-free measurement reason ledger: DOM opportunity
state/reason counts, primary-input recovery reasons, input kinds, runtime surface
modes, and production advance delta. `INCONCLUSIVE` therefore distinguishes an
unready oracle, performed input without DOM progress, and an uninitialized
runtime feed observation instead of collapsing them into one coverage number.
Each checkpoint keeps the real production admission separate from a
research-only mature-session projection that explicitly assumes an inhibitor-
free confirmed-advance Feed Horizon opportunity and clears time-based surface/
session grace without advancing a virtual clock or mutating product state. The
projection is detector/endpoint analysis, not observed gate-timing evidence. Technical
collection status remains `PASS/INCONCLUSIVE`; the versioned journey window
diagnostic is reported independently as
`MATCH/MISMATCH/INSUFFICIENT_EVIDENCE`, and a matrix containing a mismatch uses
`REVIEW_REQUIRED` as its research verdict rather than failing the QA lifecycle.
Matrix reprojection preserves the per-checkpoint observation and feed-decision
directionality aggregates, so a measured backward/revisit gesture cannot become
a false `directionality_evidence_missing` result in the suite report. Pairwise
similarity still reports aligned-prefix curve collisions, but
`effectiveTriggerCollision` additionally compares each full journey's terminal
trigger outcome. A deliberate prefix and a longer burst that becomes admissible
only after resumption are therefore recorded as geometrically similar but
intervention-separated, not as an effective trigger collision.
Collision reporting then joins the versioned journey expectation policy. Only an
effective collision between `required` and `forbidden` intervention semantics is
`harmful_policy_collision`/`actionable`; optional overlaps remain review or
informational evidence. The matrix additionally reprojects the stored pressure
curve at bounded candidate thresholds without replaying the browser. Virtual
personal dwell references are reported separately as detector-invariant research
metadata until an explicit product architecture promotion gives them detector
authority.
Within a matrix, an exact child-target CDP loss (`Session with given id not
found`) is recorded as `browser_target_session_lost`/`INCONCLUSIVE` and the next
bounded journey may continue. Other child, focus, ownership, artifact, or
cleanup contract failures still fail the upper run. This preserves completed
curves without turning an unknown infrastructure failure into model evidence.
The fixed `x_completion` matrix is the bounded resume lane for the three X
journeys that follow a lost X target. It shares one upper-session anchor and,
after those curves finish, runs the canonical TikTok feedback-only Feed Horizon
canary before cleanup. The canary must finish at `enso_would_open` with
`productionGateCount: 0`; it is not a production Gate invocation.
An attach-only plan combining `visible_required`, active target execution, and
`osFocus: never` uses one pre-existing page as its default admission baseline.
Creating a browser's first page can cause the host window manager to foreground
Chrome even when neither CDP nor the extension requests window focus. Doctor
therefore reports `no_focus_baseline_page_missing` for targets without an
explicit initial-window capability instead of misclassifying first-window
foregrounding as no-focus activation.

The shared upper-session policy permits one narrower agent-only exception,
disabled by default. An explicit `allowInitialWindowFocusOnce: true` is potential
new-process authority, not permission to refocus an observed running browser.
Only `run`'s actual `lifecycleAction: started` and exact admitted PID/browser epoch
can grant it. `already_ready` keeps the normal existing-page requirement, even
when its page count is zero or the old flag is true. Doctor remains observation
only and cannot grant a future lifecycle transition. An admitted fresh-process
run creates one CDP-owner-tokenized blank anchor and records its epoch,
reservation, exact target id and initial URL. For the background preparation
route, the unavoidable first-window side effect is bounded once. The session calls
`ShowWindowAsync(..., SW_MINIMIZE)`, which neither requests foreground nor
synthesizes UI input, and requires a read-only `GetForegroundWindow` receipt
proving Chrome is no longer foreground. The anchor stays open for the protocol,
then reverse-order cleanup closes only that exact target and preserves the
managed browser process and profile. Human inspection keeps the existing
page baseline. Feed research keeps the flag opt-in. Native document targets,
including Feed Horizon, Site Furin and Global Sentinel, require an existing
visible managed page and do not use the initial focus bootstrap even if the
legacy general flag is present. Other targets retain their declared bootstrap
policy.

After bootstrap, `osFocus: never` remains absolute. The upper session gives
every WSL Windows agent run compiled as attach-only `osFocus: never` a shared
focus guard. It reads the browser main-window foreground relation at bounded
protocol checkpoints using only `GetForegroundWindow`; it never calls
`SetForegroundWindow`, UI Automation clicks, or cursor APIs. An already-
foreground baseline is BLOCKED because preservation cannot be proven. Any
later foreground acquisition is the fail-loud
`QA_BROWSER_OS_FOCUS_CONTRACT_VIOLATION`. Feed research retains its child
activation proof, while Sentinel agent runs prove background state before
protocol execution, after harness start, after target activation, and after
protocol completion. The upper session closes exact protocol targets, records
`after_protocol_targets_closed_before_anchor_release` while the minimized
main-window anchor still exists, then closes that exact anchor and releases the
browser lease. Every checkpoint uses
`QA_BROWSER_OS_FOCUS_PRESERVED` evidence.

Run deterministic render capture or an existing lifecycle engine:

```bash
npm run qa -- run gate/detour-spread/render --mode=agent
npm run qa -- run gate/entry-checkpoint/runtime --mode=agent
npm run qa -- run visual/sentinel/site-furin-sequence --mode=agent
npm run qa -- run visual/sentinel/global-sentinel-sequence --mode=agent
npm run qa -- run visual/popup/protected --mode=agent
npm run qa -- run lifecycle/mv3 --mode=agent
npm run qa -- run release/lifecycle --mode=agent --source-only
npm run qa -- run site/tiktok-feed-flow --mode=agent --rebuild=true --presentation=hidden
npm run qa -- run site/feed-runtime --mode=agent --site=youtube --samples=3
```

Dashboard runtime capture is one extension-owned target, not one target per tab
and not a visual-harness page scene:

`dashboard/capture --locale=en|ko` optionally commits `app_language` through the
existing trusted settings command in the run-owned ephemeral profile. A matching
commit ACK and actual `document.documentElement.lang` are required. Omitting the
option preserves existing language behavior. The capture snapshot records the
document locale, Rhythm date/phase computed font family and size, and whether
the shipped Zen Korean serif loaded. No personal profile or language mirror is used.

`dashboard/capture --development-tools-journey` checks the development HUD in
an isolated landscape Zen Main capture. Its declared `entropy-qa-development-tools=true`
presentation option admits the normally hidden HUD without changing the fixture
data. Native CDP input opens the combined
appearance-time/progression panel, checks its viewport bounds and reserved space
outside the console, changes the time range without changing progression, and
closes it with Escape and the close button. It requires focus restoration,
retained custom time, and restored console geometry. Each layout change joins
the existing current-size pond and exact Bonsai scene-frame ACK checks before
capture or the next layout change. With `--resize-to`, the
same journey runs before and after the declared resize. It cannot combine with
First Vision, first-site, Main return or pressure-rail journeys. Decisive closed
and opened images and `development-tools-initial.json` / `development-tools-resized.json`
are run-owned evidence; no extra browser or profile is created.

`dashboard/capture --bonsai-debug-journey` uses ordinary Home in its disposable
profile, with canonical development progression provisioning and durable Bonsai
identity; it deliberately installs no isolated Zen capture projection. Native
input checks the reserved right panel, forces activation to zero, retains it
through later frames and bloom reprojection, resets to unscored presentation,
and rerolls through the aggregate identity command. Accepted worker-frame
receipts and decisive images are saved in `bonsai-debug-journey.json` and
`bonsai-debug-*.png`. The existing viewport/resize options apply. This journey
cannot combine with other interactive dashboard journeys. It modifies only the
run-owned profile; it cannot certify a personal profile's state.

```bash
npm run qa -- describe dashboard/capture
npm run qa -- doctor dashboard/capture --mode=agent --presentation=background --surface=main
npm run qa -- run dashboard/capture --mode=agent --presentation=background --surface=main
npm run qa -- run dashboard/capture --mode=agent --surface=main --koi-state=sparse --bonsai-state=young --appearance-time=19:10 --weather=rain --pressure-state=collecting
npm run qa -- run dashboard/capture --mode=agent --surface=main --pond-effects=no-benthic
npm run qa -- run dashboard/capture --mode=agent --surface=artifacts --theme=zen
npm run qa -- run dashboard/capture --mode=agent --surface=settings --theme=zen
npm run qa -- run dashboard/capture --mode=agent --presentation=background --surface=pond-lab --theme=zen
```

The same capture surface catalog includes Settings. It uses the ordinary
Settings route without mutating a setting beyond the existing disposable
capture fixture. Readiness requires the actual selected section and measurable
`settings-content-area`; a loading shell is insufficient.

`dashboard/capture --surface=settings --settings-section=workspace|protection|permissions|safety`
selects the requested section through the existing Settings navigation after
the normal layout/scroll-owner journey. Omission captures `workspace` (General),
preserving the existing default. The option is rejected on any other surface.
Final readiness, including after an optional resize, requires the exact selected
section, completed section loading and measurable content. The run records the
requested/actual section and captures it in the existing `dashboard-settings.png`;
it adds no settings write, browser, tab, profile or navigation owner.

Selecting `protection` also captures the expanded policy disclosure at the bottom
of the existing content scroller in `settings-protection-details.png`. The
`settings-protection-layout.json` receipt checks labelled preset radios and goal
switches, horizontal bounds, disclosure/Barrier-action visibility, and exact
restoration of the original disclosure and scroll position. The helper uses the
same owned page and changes display state only; it never activates a preset,
goal switch or navigation action. This is layout/accessibility evidence, not
settings-persistence or site-goal-delivery evidence.

`dashboard/capture --surface=main --theme=zen --first-vision-journey` prepares
the existing typed `first_vision_preview` session in its run-owned ephemeral
  profile at the derived preview horizon through
  `PROGRESSION_DEBUG_PREVIEW_TARGET_DAY_COUNT`. This fixture covers each independent
  artifact, registration and Bonsai schedule without changing their thresholds.
  Per-sample petal gates use the DOM-committed presentation phase, published
with the same React commit as the petal props; passive trace events still prove
the ordered milestone history but must not label a newer DOM sample.
It runs the real conductor without the fixed Zen capture projection,
requires the ordered ideal commit, dwell, opaque cover, current composite ACK,
spent acknowledgement, uncover and settled phases, and saves
`first-vision-journey.json` plus available presenting/covered/settled images.
The terminal sample waits for both the painted settled DOM state and its owner
trace effect; a DOM commit alone cannot end ordered trace sampling.
The same evidence records the app petal field's identity, mode, population and
landing gate. The journey requires one ready field from opening through settled
ambient, a nonempty opening population within the shared 48-petal cap, and no
landing admission during covering/current replacement/uncovering. Available
nonempty presenting frames are saved as `first-vision-petals.png`.

`dashboard/capture --surface=main --theme=zen --first-site-journey` uses the same
owned ephemeral profile and target. It clears the development projection to
canonical mode, checks fresh popup admission before navigation, and carries an
uncommitted `native-video.localhost` candidate into Main.
It first verifies that the URL opens the pond-owned compact candidate with the
focus on its native submit control without registering. Editing
must expose that same address without time controls in the inline editor. It cancels, then
uses native mouse input in that existing target to open/cancel/reopen through
the shadow, with initial focus on the address input. Native input fills the
address, proves that no goal slider or numeric time input exists, and submits
registration. It proves the protected site commit without a time goal, retained
early Dashboard registration requirement and durable management access after
removing the final site. Popup commit must still return an uncommitted Dashboard
handoff; restoration goes through the Main editor. The harness pregrants only
`scripting` and the already allowlisted exact
loopback fixture's product host-permission patterns in its disposable artifact.
No external host or permission allowlist is widened; this is application-flow
evidence, not evidence of Chrome permission prompt behavior. It saves
`first-site-journey.json` and invitation/picker/completion/registered images.
After native registration it additionally requires an in-viewport pond-local
receipt whose own element exposes `role=status` and `aria-live=polite`, with the
saved domain, and observes exactly one visible
`firstSiteRevealCount`, one assigned site and no shadow through the existing
read-only pond worker metrics API. Filling the one-site budget leaves
`fishCount: 1`, `shadowSentinelCount: 0`, `invitationEnteringCount: 0` and no
registration-shadow entry. The protocol saves `first-site-slot-filled.png`.
A second Popup request must hand off with `pending: false` and must not register.
This observation neither triggers the reveal nor synthesizes a renderer frame.
Native submit observations additionally retain editor-close latency, independent
main-document rAF delivery gaps and sampled Worker frame/entity-sync costs.
The maximum gap retains its submit-relative interval and editor presence. A
bounded native Long Animation Frame observer records overlapping document
script and style/layout timing for attribution; it does not profile Worker CPU
or isolate GPU/display time. Observer records are drained and disconnected with
the existing native input trace lifetime.
The protocol waits for each 3.5-second submit observation to finish before
capturing completion or proceeding to removal/re-registration, so later QA
actions do not enter its maximum-gap observation.
`dashboardRegistrationTimingProbe.mjs` observes development timing console events
on the existing Dashboard session and the exact verified extension service worker
through the supplied harness connection. Its worker attachment is detached on
success or failure; it creates no targets and changes no focus or product API.
`first-site-settings-timings.json` retains the observed stream even on failure.
The bounded 512-event stream records persistence, propagation wait, canonical
read, reconciliation, registration readiness and guidance settlement in each
submit window. Persistence measures the canonical persistence capability;
propagation measures the requested terminal wait, not total executor CPU time;
reconciliation includes the required scoped canonical read and any read drain.
These stages are not an exhaustive additive breakdown of registration latency.
Additional phase observations distinguish permission admission, canonical
projection/publication, command-ACK/status publication, private cache readback,
journey receipt, feedback and editor-close requests. Each includes its document
or worker epoch start. A bounded editor-parent MutationObserver separately
latches native editor removal, distinguishing commit from subsequent rAF delivery.
`--first-site-ui-diagnostics` requires `--first-site-journey` and is off by
default. It samples the existing Dashboard session with the CPU Profiler at
1ms, using the existing bounded/sanitized Dashboard profile evidence validator
(25,000 nodes, 250,000 samples, 32MiB). It saves `first-site-ui.cpuprofile` and
its `.clock.json` epoch bracket and always stops/disables profiling. This
instrumented run attributes document JS; it is not a latency baseline or
GPU/display measurement and does not profile Worker CPU.
Worker attachment can keep it awake, so these instrumented observations do not
claim cold-worker latency. The completion check also requires the actual
`garden.first_site` completed receipt after the observation window, preserving
guidance completion evidence when registration no longer awaits it.
Starter artifact access checks run after the first registration and completion
receipt, because navigating away from Main intentionally releases an active
guidance claim. The journey first requires its actual presented receipt.
The artifact return precedes final-site removal and re-registration, so the
restored shadow's real hover/click also protects retained-canvas input admission.
The first registration must expose an intermediate `firstSiteMaterialPresence`
and then a complete material, proving the retained silhouette-to-pigment transition.
These are bounded observations, not native input-to-display or FPS certification.
Combining
`--first-vision-journey` keeps all existing phase and petal gates and runs them
against the canonical first entry. Resize and other Main journeys are excluded.
Canonical Main readiness uses settled presentation, shell dismissal and painted
scene geometry at the declared viewport, without a desktop-width minimum. The
first-site journey first scans the bounded invitation water region for actual
worker hit feedback and opens the editor by clicking the koi; the native button
is used for the first reopening step. After final-site removal, the completed
discovery guide no longer exposes that entry by itself. Restoration therefore
reacquires the restored shadow's actual worker hit and clicks its body rather
than forcing native-entry visibility or focus. It also saves
`first-site-invitation-hover.png`.
The hover flag projects the worker's actual body hit result, separately from
the broader simulation attendance radius. After the hover capture, native
pointer leave clears the old acknowledgement and a bounded scan reacquires a
live hit before clicking. The journey receipt records both points and the
final hit-to-input interval, including restoration; capture coordinates are
never reused as click proof. Editor captures wait for native visibility,
in-viewport geometry and computed opacity exactly one, recording
`editorCaptureReadiness` instead of assuming its opening fade has elapsed.
Before invitation, completion and final registered captures, the protocol reads
`GET_GUIDANCE_STATE` from the exact owned Dashboard document, not the generic QA
helper sender. Each new runtime response must expose `guidance_state_v1`, matching
envelope/state profile generation, canonical non-preview progression, spent
FirstVision and valid receipt timestamps. Later reads bind to the first observed
generation. `first-site-journey.json` records these independent reads and their
request/completion timing; it does not invent a server-side freshness timestamp
or infer query health from UI wording or a screenshot.
Immediately after the initial guidance read, the same Dashboard sender reads
the canonical artifact disclosure and must observe the three starters at day
zero. Native sidebar input then enters Tools. In compact portrait, native input
first opens the existing `aria-controls="dashboard-sidebar"` menu control and
requires the drawer's public hidden/inert/expanded state to settle before
selecting the tab. Tab selection must close the drawer again; returning to Main
uses the same responsive navigation flow. These actions record
`navigationEvidence` without forcing DOM focus, visibility or tab selection.
The actual public gallery must
show Lens, Gate and Flare as visible, enabled selection buttons, and native
selection must reach each family's control rail. These condition-based gates
have a ten-second limit and never wait for the thirty-second resource freshness
budget. No recommendation, toggle or global time setting is committed. The
protocol saves `first-site-starters.png`, records `starterAccess` in the existing
journey receipt, returns to Main through its native sidebar button, and continues
the original koi/editor/registration flow. Combined `--first-vision-journey`
therefore covers the canonical spend ACK through immediate starter access in
the same owned document.
It rejects other themes/surfaces and resize. No durable progression reset or
additional browser owner is introduced; ordinary captures retain their fixed
profile policy.

Before dashboard boot/capture navigation, the diagnostics owner prepares the
exact owned pre-navigation tab once with the existing no-window-focus activation owner,
verifies native active-tab and visible-document receipts, and records them in
`nativePagePreparation`. The extension harness retains its nonce marker page when
`openPage('about:blank')` attaches to the tab; the observed initial URL is evidence,
not an `about:blank` admission requirement. Exact session/tab ownership remains
the activation owner's contract. A bounded top-document visibility observer retains the
first native hidden state during navigation and initial readiness. A lost or
unavailable visible document fails as an explicit QA native capability error;
it does not authorize focus, emulation, retries, or a wider product boot budget.
The observer is removed after initial readiness, before deliberate Main-return
tab hiding. Native window occlusion or another external cause of visibility loss
is not inferred from this receipt. The existing 8-second product readiness gate
and its sticky over-budget evidence remain unchanged.

Main-return and dashboard boot-sample cleanup attempt every exact-owned cleanup
even when another one fails. A combined failure preserves the original operation
error as the first `AggregateError.errors` entry and `cause`, followed by cleanup
errors. Boot samples snapshot diagnostics before observer disposal and serialize
the failure in `errorDetail`; incomplete trace projection cannot replace an
already-failed sample's receipt. Successful traced samples still require all
declared stages. Cancellation continues to propagate, and the upper run owner
retains its existing abort-reporting policy. No readiness, timeout or PASS gate
is relaxed by this error preservation.

The Zen-only `pond-lab` surface enters the real Experiment hub and captures
`scene`, `water`, `koi` and `inspect` into `pond-lab-<section>.png`. Its declared
journey (`dashboardPondLabJourney.mjs`) checks that section changes and effect
isolation/restore retain the same canvas, then clicks cache hard reset in the
run-owned ephemeral profile and requires a replacement canvas with a committed
first frame. It never resets the operator's profile. The journey writes
`dashboard-pond-lab-journey.json`; requested effect values are UI evidence, not
per-effect worker ACK or GPU proof. No test step refocuses the browser.

`dashboard/capture --surface=main --theme=zen --main-return-journey` checks three
Pathways-to-Pond returns through the actual Garden mode control, three rapid
Tools/Rhythm/Tools sidebar returns without waiting for artifact readiness or a
settled dwell, three settled sidebar returns, then one real browser-tab
return. It requires clean Main boot-shell dismissal before the journey. Internal
Pathways visits require the same visible Bonsai canvas while Pond is parked;
Pond returns require the same Pond canvas and resumed Worker progression. Rapid
visits record departure time and actual artifact readiness; a rapid visit does
not by itself certify a pending-import cancellation. Settled Tools
visits wait for the actual artifact canvas to be ready before leaving, exercising
the shared Home Worker with its artifact renderer admitted. Settled sidebar visits park
for two seconds. The browser-tab visit retains native hidden state for ten
seconds by default; `--main-return-away-ms=300000` selects a five-minute visit
(accepted range: 10,000–600,000 ms). After returning, two further progress checks
ten seconds apart require continued Worker frames, followed by a final capture.
The existing harness opens one additional inactive owned blank tab in the exact
owned Main page's window, deriving its `windowId` through `resolveTabForPage`.
The `sameWindowAs` page option requires exact owned ephemeral extension identity
and validates the created tab's window and activation state. The journey records
both tabs' window/active state before leaving Main, after selecting the blank tab
and after returning; a window or activation mismatch fails explicitly. It selects
only those exact owned tabs without requesting window focus and closes the extra
target during cleanup. Native hidden/visible document state is observed, never emulated.
`dashboardMainReturnJourney.mjs` requires the retained Pond canvas identity,
visible nonempty backing dimensions, and advancing Worker `sampleFrames` after
each return. Missing metrics, hidden-state admission, canvas replacement, stalled
frames, or incomplete cleanup fail explicitly. Each readiness/progress wait is
bounded to 20 seconds; the declared away duration is a separate bounded dwell.
`dashboard-main-return-journey.json` records return timings, blank rAF observations,
parked/runtime snapshots, requested/observed hidden duration, sustained progress
and activation receipts; `dashboard-main-*-return*.png`
captures follow the first observed visible-canvas paint opportunity. These images
are not the exact first compositor frame, an FPS measurement, or physical display
latency evidence. The option defaults off and cannot combine with resize or
first-vision journeys. Example preflight and run:

```bash
npm run qa -- doctor dashboard/capture --mode=agent --presentation=background --surface=main --theme=zen --main-return-journey --json
npm run qa -- run dashboard/capture --mode=agent --presentation=background --surface=main --theme=zen --main-return-journey
npm run qa -- run dashboard/capture --presentation=hidden --surface=main --theme=zen --main-return-journey --main-return-away-ms=300000
```

`dashboard/capture --pressure-rail-journey` is an opt-in native CDP input check
for ready Zen Main with `--koi-state=full`. It cannot combine with first-vision,
first-site or main-return journeys; it may run after the declared same-page resize.
The existing fixture supplies stable domain allocations without injecting a
selection store. This journey additionally registers its first two pressure
domains through acknowledged canonical site-rule commands in the disposable
profile, then verifies their membership through the Sites snapshot owner.
It adds no historical records. Native mouse hover reveals the segment's favicon action;
click opens that domain's Sites notebook directly. Consecutive Escape inputs
return notebook to ledger, then ledger to Pond. The same page also checks
the populated ledger's native management disclosure, combined-cap entry and
Cancel focus return to the visible closed summary. Its header, domain rows and
visible controls must remain inside the straight ink edge projected from the
full-history canopy and maximum sway envelope; the paper still covers Pond.
No per-frame canopy sampling or layout mutation supplies that boundary.
The same page also checks
Tab/Space entry with visible favicon keyboard focus, one native mouse-back
gesture returning only notebook to ledger, upward/downward paper-edge dragging,
and a sub-threshold drag that cancels without changing the committed route.
During a closing drag, native pointer capture stays pressed while the stage's
`data-pond-presentation-ready` current-scene ACK fence prepares Pond. Before
that fence is ready, the sheet must remain fully covering the pond; preparation
does not commit a route before release. These waits are bounded to 20 seconds
and use the product's real state rather than fixed animation delays.
After that receipt, the held pointer sends another native move before the probe
requires visual dragging. This respects gesture takeover admission without
changing the current-scene fence or accepting a route commit before release.
The same native journey holds a prepared close drag at a partial paper position
and Tabs to the last available ledger control. All three presentation clips must
keep zero scroll offsets while embedded Sites remains the content scroll owner.
Release below the commit distance restores the ledger without changing its route.

Every observation preserves segment domain/share/width allocations, rejects
retired lock/readout UI, and requires exactly one continuously retained visible
Bonsai canvas. In landscape, the opaque sheet and its clipping viewport cover
the stage's top-left corner through the actual Bonsai panel line and down to
the graph's top; portrait uses the actual Pond slot. Transparent crown paint
may overlap the sheet and is not a content exclusion rectangle. Native hover
and keyboard focus also read the existing on-request Pond metrics bridge,
requiring one hovered fish, zero selected fish and visible focus glow.

Each committed return waits for an accepted current presentation ACK or exact
retained ACK replay after its observation watermark, the Pond route, settled
sheet/edge motion, retained visible Pond canvas and advancing Worker samples
before capture. Full trace records accepted ACK index/reason/scene commit key
in `pondResumeSamples`. Explicit `off`/`marks` traces report unavailable ACK
measurement while retaining the product's ACK-gated route and Worker progress
checks; retained canvas paint alone never proves resume.
`dashboard-pressure-rail-journey.json` retains ordered observations and bounded
fish-focus/resume receipts plus the last 32 native pointer/capture events for
drag cancellation attribution. Drag packets declare the held left button and
its pressed bit together, as in the existing native Furin drag protocol.
`pressure-rail-{idle,hover,intel,ledger,ledger-menu,escape-pond,
keyboard-intel,drag-ledger,held-focus,final-pond}.png` retain decisive views. These are
functional input and visual observations, not physical input latency, FPS or
exact compositor-frame evidence. Browser lifecycle, visibility, target
activation and steady-state OS focus remain unchanged.

```bash
npm run qa -- doctor dashboard/capture --mode=agent --presentation=foreground --surface=main --theme=zen --pressure-state=ready --koi-state=full --pressure-rail-journey --json
npm run qa -- run dashboard/capture --mode=agent --presentation=foreground --surface=main --theme=zen --pressure-state=ready --koi-state=full --pressure-rail-journey
```

Capture supports the named `--viewport` presets `desktop-wide` (1784×849,
default), `desktop-low` (1440×720), `desktop-compact` (1280×849),
`portrait-narrow` (560×960), `portrait-desktop` (1080×1920), and
`desktop-landscape` (2200×849), all at DPR 1, plus `desktop-retina`
(1784×849 at DPR 2) and `desktop-fractional` (1537×867 at DPR 1.25).
The optional `--resize-to`
accepts the same presets. It resizes the same
ledger-owned page after initial readiness and settle, waits for the requested
viewport and painted pond/bonsai regions, then settles again before taking the
final screenshot. It does not open another page, restart the extension, or alter
browser/display/focus ownership. Main readiness is based on its rendered scene
regions and existing first-frame/paint contracts, not a fixed 900-pixel width.
Zen captures retain the sidebar/content/stage outer-edge rectangles. Landscape
sidebar and content share the shell's upper and lower edges and meet without a
gap or overlap. The Garden stage and graph must always reach the content's
lower edge: no support/footer output is admitted beneath them. Portrait checks
the common outer width and the dock/content joint against its declared gap.
Pixel appearance still requires inspection of the actual capture.
Bounded diagnostics also retain document dimensions and the shell/slot
client/scroll sizes, overflow modes, border widths, shadows and clip paths.
A paint reserve in a non-scrolling clipped layer is distinct from a new scroll
owner; a larger scrollWidth alone does not prove a visible frame gap.
The ready pre-resize view is also saved as `dashboard-<surface>-before-resize.png`
and referenced by the resize-start event, so failures retain the initial geometry.

```bash
npm run qa -- doctor dashboard/capture --mode=agent --presentation=background --surface=main --viewport=desktop-wide --resize-to=desktop-compact
npm run qa -- run dashboard/capture --mode=agent --presentation=background --surface=main --viewport=desktop-wide --resize-to=desktop-compact --settle-ms=5000
```

`dashboard-capture.json` records the initial and final viewport;
Zen captures also record `bonsaiCanvas.pondOverlapHitTest`: computed canvas
pointer policy and a 4-by-4 DOM hit-test grid inside the canopy/pond overlap.
The probe independently classifies each point against the computed pond aperture
and rear-plane/foreground/rock occlusion polygons. Exposed water must route to the pond;
covered points must not. At least one exposed sample is required when the
rectangles overlap. A routing mismatch or an intercepting canvas fails
`QA_DASHBOARD_CANOPY_BLOCKS_POND_INPUT`; unsupported clip shapes fail explicitly.
This proves pointer routing at the sampled positions, not fish interaction or
renderer pixel coverage.
`dashboard-resize.json` and the resize start/finish events record the exact page,
same-document proof, scene-seed declaration, controller mount/first-frame
identity, before/after scene bounds, and available read-only debug sync counters,
including `viewportReflowCount` and committed `sceneLayout`.
A changed document, unapplied viewport, or changed/missing declared Zen scene seed
fails the resize run. Controller remounts and first-frame changes are observations,
since viewport quality policy can permit remounts; they do not alone fail the run.
Missing live metrics remain explicitly unavailable. This evidence does not claim
GPU resource identity or infer texture reallocations from sync counts. Boot keeps
the original desktop-wide viewport and accepts neither capture viewport option.

Zen Main capture and traced boot additionally verify the accepted bonsai worker
first-frame ACK through `dashboardBonsaiRenderIdentity.mjs`: backend
`pixi_plume`, renderer `zen_bonsai_worker_pixi_plume`, model `plume`, signed
`zen-bonsai-plume-render-plan-v1`, and nonempty scene/materialization/input
identities. Explicit `--trace=off` boot and marks-only traces without ACK payloads
record no renderer identity claim; full-trace capture/boot owns product acceptance.
The existing Zen trace sanitizer represents signatures over 180 characters as
`{length, preview}` with the original integer length and a 180-character prefix
followed by `...`. The check accepts exactly this summary shape as presence
evidence and records `identityEvidence: accepted_ack_trace_presence_only`; it
does not claim exact signature equality from a truncated trace. The materialization
key remains a required nonempty trace string.
A painted canvas or the catalog default alone does not pass this
check. Capture records `QA_DASHBOARD_PLUME_RENDER_IDENTITY_VERIFIED`; both
protocols retain `bonsaiRenderIdentity` in the observed page snapshot. Other
themes and surfaces keep their existing admission contracts.

The first-site native-input and Main-return journeys retain the capture-ready and final trace
observations because pointer movement, registration and repeated returns can evict the first ACK
from the page's bounded 512-event ring. `requireDashboardBonsaiJourneyRenderIdentity`
requires the same page URL and one nonempty trace session across both observations,
then checks the latest observed ACK with the unchanged identity guard. A newer
invalid ACK, changed session/document, or missing final trace fails explicitly.
The evidence records `observationWindow: capture_ready_to_final`; it still claims
accepted ACK presence, not exact final-frame/signature equality.
After its final registration mutation the first-site journey waits through the
existing capture-ready owner for the settled, accepted painted bonsai/pond
before taking the registered screenshot. A fixed elapsed delay is not readiness.

Dashboard boot measurement is a specialized target on that same protocol, not
a second browser or build harness:

`dashboard/boot --canopy-preparation=native|before-first-draw` defaults to
`native`. The explicit `before-first-draw` development research mode requires
Zen, fixed noon/full Pond effects, idle interaction and `--gpu-timing=true`.
It moves exactly one native canopy Shader preparation to the existing first
asset-preparation boundary before any Pond draw. It changes no source, pixels,
quality, GL queries or browser lifecycle. The separate research owner is
`pond/renderers/pixi/telemetry/zenCanopyPreparationResearch.js`; program
diagnostics remain observation-only. Request and URL evidence retain the
declared mode. Compare all startup programs, not only first-tick programs:
the same canopy must be generated once and later native bind must reuse it.
Moving preparation outside the first tick is not a latency saving. Shared
Home Canvas and driver queues can still contribute to its wall time. This
mode is never a product default and its invocation code is removed from
production artifacts. Remove this option and seam together when the cost
ownership investigation no longer needs the comparison.

```bash
npm run qa -- describe dashboard/boot
npm run qa -- doctor dashboard/boot --mode=agent --presentation=background --theme=zen --samples=3
npm run qa -- run dashboard/boot --mode=agent --presentation=background --theme=zen --samples=3
npm run qa -- run dashboard/boot --mode=agent --presentation=background --theme=zen --samples=3 --trace=marks
npm run qa -- run dashboard/boot --mode=agent --presentation=background --theme=zen --samples=3 --trace=off
npm run qa -- run dashboard/boot --mode=agent --presentation=background --theme=zen --samples=3 --trace=marks --pond-effects=no-benthic
npm run qa -- run dashboard/boot --mode=agent --presentation=background --theme=zen --samples=1 --cpu-profile=true
```

Artifact admission completes before browser lifecycle, broker, and display
admission, so an in-run bundle build does not hold an idle browser slot or Xvfb.
When artifact ownership is `built_for_run`, the boot protocol then starts one
disposable owned browser, commits the same fixed capture state, waits for one
clean unprofiled Main boot, records
`dashboard-boot-artifact-preparation.json`, and fully releases that browser.
Only then does it create the fresh measurement browser. This is a declared
preparation phase, not a measured sample or a fixed-delay fallback. An exactly
`reused` artifact records a typed skipped receipt and goes directly to
measurement.

The first page in the fresh measurement browser is classified as `cold`; later
pages are `warm` and reuse that exact browser cache and extension worker lifetime.
Each sample creates, observes, and closes only its exact owned page target. It
stops at clean `dismissible` readiness, explicit boot failure, forced visual
release, or a bounded terminal timeout. `dashboard-boot.json` contains the
sample summary and complete samples, `dashboard-boot-sample-<n>.json` keeps each
exact-session trace/resource/console/network/performance record and, when
`--cpu-profile=true`, bounded CDP CPU-profile summaries for the dashboard
page, its exact `zenHomeRenderer.worker`, and its exact
`zenBonsaiModel.worker` dedicated workers, ranked by JavaScript self time.
Worker profiling uses page-scoped auto-attach before navigation and starts
profiling before releasing debugger startup. Every attached worker is resumed
in `finally`, including unrelated workers and failed profiler setup. Model
targets are selected only by the compiled `zenBonsaiModel.worker-*.js` asset
URL, carry the native `self.name` physical-instance identity, and are a
distinct `model_worker` evidence kind. Missing Home coverage is unclean;
the Zen Main bonsai fixture also requires complete model operation coverage.
The regular timing mode never enables auto-attach or CPU sampling. Meanwhile,
`dashboard-boot-module-graph.json` reports the Vite static closure of the
bootstrap, React host, i18n, document-theme, and App stages. The bootstrap
entry is resolved from the dashboard HTML's exact dynamic import and must carry
`src/apps/dashboard/main.jsx` provenance in the emitted module inventory; a
generated Vite facade key is neither treated as a missing source entry nor
accepted without that provenance. `dashboard-boot.json`
also embeds the artifact-preparation receipt so a result cannot hide whether it
measured directly after exact reuse or after the disposable preparation phase.
Preparation remains fail-closed for runtime, console, network, forced-release,
core-wait, theme-shell, and first-frame degradation. The sole non-failing
exception is a completed, error-free first frame whose only issue is the visual
wait budget on an actively classified software renderer; the receipt records
`accepted_software_visual_wait`, while hardware evidence never receives this
exception. This keeps SwiftShader cache preparation separate from the measured
samples without relabeling it as physical-GPU performance.
The target takes no
screenshots and has no visual settle delay. CPU sampling defaults off so cold/warm
timing remains representative; it can be enabled only by this specialized boot
operation. Normal `dashboard/capture` does not pay its runtime cost or publish a
CPU profile. Any unclean sample makes the run
`FAIL`; warm evidence is still collected after an unclean cold sample when the
browser remains valid.

`dashboard/boot --post-reveal-ms=1000..120000` retains the one-second default.
Extended observation requires Zen, `--interaction=none` and `--render-trace=false`;
the existing Chrome trace buffer is not a long-duration recorder. The page probe
retains timestamped rAF intervals, overlapping long tasks and serial 500ms
canonical Worker metrics snapshots, including spike/Home renderer journals.
The QA-only evidence carrier is explicitly versioned as
`workerMetrics.projection: dashboard_boot_worker_metrics_v1`. Snapshot zero has
`metricsKind: initial_full` and retains the complete first native metrics response.
Later `metricsKind: steady` snapshots explicitly retain renderer/path/quality and
worker-rAF identity, viewport/scene layout, frame counts/interval totals/overrun
and sync counters, `mainMetrics`, surface disturbance telemetry and the optional
worker performance sample. They do not copy unrelated startup fields from the
first response. No selected field is rounded or converted by this projection.
`runtimeHealth`, `spikeJournal`, `homeRendererJournal` and `lastSpike` retain their
complete canonical shapes when first observed or changed. Only byte-identical
JSON values are represented by `metricsReferences: { <field>: <snapshotIndex> }`
instead of repeating that field in `metrics`. Each index names an earlier
snapshot that directly owns the complete field, never another reference.
Changed entries, origins, counters or any other journal/health content are
preserved as a new complete value. `resolveDashboardPostRevealWorkerMetricsSnapshot`
in the probe owner reconstructs the snapshot, rejects unknown/forward/conflicting
or missing-owner references, and preserves the original journal clocks and entry
shapes. Result admission rechecks the reconstructed finite frame counter and
both canonical journal shapes. This removes repeated startup evidence, rather
than truncating journals or increasing the existing 8MiB JSON evidence budget.
The 500ms interval, 242-snapshot limit, visibility/reset/error checks, collection
timeout, retention and all observation limits remain unchanged. Historical
failed evidence is not relabeled after this tooling change.
Request/receipt timestamps expose sampling latency; repeated frame counters can
be stale transport evidence. Hidden, invalid or overflowed observations fail.
Artifact preparation stays at 1000ms. `--environment-clock=fixed|realtime`
defaults to fixed noon; realtime uses the canonical appearance clock while
preserving the full koi/bonsai and clear-weather fixture. The declared clock
must match the page's profile evidence before and after observation.
A 100000ms observation permits separating its first 10000ms from 90000ms of
later evidence. PASS means complete observation, not absence of long frames.
`--cpu-profile=true` also saves bounded chronological page/Home/model Worker
`.cpuprofile` attachments through `dashboardBootCpuProfileEvidence.mjs` (25000
nodes, 250000 samples, 32MiB per profile). Host-epoch `Profiler.start` brackets
record clock-alignment uncertainty; sampling gaps do not alone prove continuous
CPU execution. The target uses its owned ephemeral browser and takes no PNGs.
Model evidence is named `dashboard-boot-<sample>-model-worker-<segment>.cpuprofile`,
separately from `home-worker` attachments. The exact attached model target gets
the native `__ENTROPY_QA_ZEN_MODEL_PROFILE_READY__` CDP binding only in this
diagnostic mode. Before each RESULT, the development worker reports its
operation/request/physical-instance identity and awaits
`__ENTROPY_QA_ZEN_MODEL_PROFILE_ACK__` for at most 15 seconds. The collector
stops, validates and saves that operation's segment while the worker remains
alive, restarts profiling, then acknowledges through the same exact session.
Ordinary boot has no binding, asynchronous pause or lifetime change.
`profile_wait_start/end` explicitly records this diagnostic pause; it is
excluded from model work accounting and is not an uninstrumented boot baseline.
Per-target segments retain completion receipts, start/stop host brackets,
profile errors and bounded evidence rejections (at most 64 segments). Each
segment ends before its operation's RESULT serialization; a later segment may
include the preceding result-post/acknowledgement tail. Runtime stage receipts
identify those intervals; segments are not additive pure algorithm CPU totals.
A final profiled idle tail may be lost to the canonical
zero-delay worker termination after RESULT and is recorded as
`trailingProfileLost`; it cannot substitute for a completed operation segment.
Missing, terminated-before-capture, rejected or identity-mismatched completed
model evidence remains an explicit unclean diagnostic sample even when another
model target produced a valid profile. Collection never prolongs the ordinary
idle admission lifetime or changes product readiness budgets.

Zen Main full-bonsai `--trace=full` additionally retains correlated
`bonsai_model:timing` development receipts under
`zen_bonsai_plume_model_timing_v1`. Each logical operation has an operation ID;
native Worker name identifies its physical instance, and the message ID identifies
its request. The bounded page history is 512 events and each model operation is
limited to 80 worker receipts. Diagnostic envelopes never enter model DTOs,
storage, or renderer commands. `dashboardBootModelTimingEvidence.mjs` projects
the first accepted UI commit, including a separate initial PREPARE-to-PROJECT
dependency when life arrives after preparation. Later commits cannot substitute
for an evicted first-commit receipt.

Each sample's `modelTiming` and the report's `modelTimingSummary` describe
`COMPLETE`, `INCOMPLETE`, or `NOT_REQUESTED` independently of product health.
Completeness is required only for full-trace Zen Main full-bonsai requests.
Marks trace remains valid without these payloads; missing marks payloads are an
explicit incomplete diagnostic, not a product failure. Missing stages, mismatched
identities, inconsistent order/clocks and negative residuals fail completeness.
Worker-local duration includes study/projection and synchronous result posting;
the following ordered diagnostic message supplies `result_post_end`. The page
records initialization wait, synchronous request posting, result validation and
UI acceptance/commit. Durations use each realm's own monotonic clock. Page request
posting may overlap worker execution and is not added to exclusive work totals.
The residual explicitly combines transport, event queues, deserialization and
unmeasured client/UI time; it is not a measurement of structured clone alone.
CPU mode matches every required request to its exact saved native Worker segment
and reports its profiler pause separately. A missing segment cannot be filled by
a different physical worker. Neither completeness nor CPU coverage increases
the existing first-frame budget or relabels a slow boot as healthy.
The public-build debug-surface guard rejects this timing-contract signature and
both QA profile-binding names from public runtime assets; their development-only
capability must eliminate them from the production closure.

Zen Main의 `--pond-effects`는 제품 설정을 바꾸지 않는 dev-only 초기 렌더
비교 축이다. `full`을 기준으로 `no-benthic`, `no-caustics`,
`no-atmosphere`, `no-god-rays`, `no-cloud-reflection`, `no-komorebi`,
`no-yoonseul`, `no-fish-shadows`, `no-layer-effects`, `no-surface-effects`,
`minimal-water`를 같은 고정 장면에 적용한다. 이 토글은 worker가 최초
water-effects layer를 만들기 전에 Main의 canonical renderer props로 전달되므로,
런타임에서 효과를 껐다 켜는 FPS 실험과 달리 절차적 텍스처 생성·업로드를 포함한
첫 화면 비용을 비교한다. Boot evidence의 각 sample은 `pondStartupCost`를,
상위 report는 각 비용 필드의 표본 중앙값 `pondStartupCostSummary`를 기록한다.
여기에는 scene mount, first-frame asset preparation, first render, texture upload
개수/바이트/시간 및 실제 활성 효과 gate가 포함된다. Product neutral-depth floor가
packaged gzip RGBA8 asset을 사용하는 경우에는 renderer module admission에서 관측한
`staticBenthicAssetPrepareMs`와 `staticBenthicAssetBytes`도 함께 기록한다. Prepare는
first-frame asset preparation 전에 시작되므로 procedural texture build 절감과
packaged asset fetch/decompression 비용을 서로 다른 구간으로 비교해야 한다.

Zen Main capture also reads one canonical Worker metrics snapshot immediately
before its final screenshot and saves `dashboard-pond-water-effects.json` plus
`dashboard-capture.json.pondWaterEffects`. It contains the current normalized
water-effects probe and selected caustic/Yoonseul model, request, gate, strength
and draw fields. This is separate from the startup first-frame ACK, which may
precede deferred effect admission. Missing current metrics fail explicitly;
the observation adds no per-frame bridge, GPU readback, or exact compositor-frame
claim. A requested caustic toggle alone is not proof that its daylight gate drew.

`--trace=full|marks|off`는 동일한 부트 계약을 유지한 채 진단 probe 비용을
비교한다. `full`은 bounded metadata와 console trace를 남기고, `marks`는 event와
timestamp만 보존하며 console 출력을 만들지 않는다. `off`는 Zen trace를 완전히
비활성화한다. 성능 측정 기본값은 `marks`이고 원인 분석 실행만 `full`을 명시한다.
Readiness 판정은 세 모드 모두 boot manager snapshot만 사용한다.

`surface` currently accepts `main` and `artifacts` (`artifacts` maps to the
canonical dashboard `tools` tab); adding another dashboard destination extends
this surface catalog instead of creating another browser protocol. `theme`
accepts every canonical theme. Zen Main defaults to `koi-state=full`,
`bonsai-state=full`, `appearance-time=12:00`, `weather=clear`, and
`pressure-state=ready`. Koi accepts
`full`, `sparse`, or `empty`; bonsai accepts
`full`, `flower-bud`, `pre-bloom`, `trained`, `young`, `seedling`, or `first-sight`;
these project 7, 6, 5, 4, 3, 1, and 0 qualified days respectively through the
canonical progression release owner. The middle-day presets cover branch
establishment and closed-bud transitions without a custom browser fixture.
Weather accepts
`clear`, `overcast`, or `rain`; pressure accepts `collecting`, `ready`, or
`no-pressure`; appearance time is `HH:MM` on a ten-minute step. Main-only axes
are ignored outside the Zen Main surface. The owned
ephemeral state first writes the requested theme and the canonical Recommended
local-analysis profile, then, for Zen Main, writes the mapped progression day
through existing trusted runtime commands. The dev-only Zen
Main profile then supplies a data-isolated koi roster, one fixed weather
authority shared by pond, bonsai, and ambient shell, and one fixed temporal
authority. It also pins the pond scene generation key and a capture-only bonsai
presentation identity so repeated runs compare the same world rather than a new
random pond or durable-profile genesis. It also projects the selected pressure presentation through the
public capture alias at the final Main scan-snapshot seam: `ready` contains
deterministic pressure strata, while `collecting` and `no-pressure` exercise
their distinct readiness presentations. It does not seed raw Chrome storage,
clone a dashboard surface into a page fixture, or mutate a personal profile.
The screenshot is named
`dashboard-<surface>.png`; the composed runtime diagnostic is
`dashboard-capture.json`, and `dashboard-boot.json` always projects the exact
artifact identity, pre-navigation page-session timeline, DOM/load and resource
timings, boot snapshot, development boot telemetry, console warnings/errors,
uncaught exceptions, browser-log entries, network load failures, successful
resource timings, an isolated capture-only Zen boot trace, and the resulting
boot-health verdict. The protocol first opens and registers one owned
blank page, installs those observers on its exact CDP session, and only then
navigates that same page to the dashboard. It therefore does not lose module,
renderer, or startup errors emitted before the dashboard DOM becomes ready.
Forced visual release, hard-timeout/renderer-timeout warnings, degraded boot or
Main first frame, uncaught exceptions, console errors, browser-log errors, and
non-cancelled resource failures make the target `FAIL`. Evidence is still
written, and a best-effort `dashboard-<surface>-failure.png` is retained when a
normal screenshot was not reached. Artifact build ownership remains in
`QaArtifactLease`; this diagnostic does not duplicate the build runner or add a
second dashboard launcher. Capture waits 800ms after canonical surface
readiness by default; callers may request a longer bounded settle only for a
specific temporal composition.
The target defaults to headless `hidden` presentation and declares WebGL as a
required browser-execution leaf. Both real Zen Worker renderers must initialize
Pixi/WebGL and pass the same readiness/first-frame assertions in that mode;
WebGL itself does not require a displayed window. Headless failure never
silently selects a headed run or substitutes a renderer. Explicit headed runs
remain available for comparisons, and boot timing comparisons must retain the
presentation/GPU context. The explicit `dawn-eager` startup experiment retains
its headed-only launch admission. On Linux an explicitly headed background run
may own one bounded Xvfb without requesting OS focus. Only that isolated
owned-Xvfb path opts into Chromium's explicit
SwiftShader WebGL backend; host displays and attached browsers retain their
declared browser renderer and receive no unsafe software-WebGL launch switch.

The legacy site-runtime engine remains the owner of its diagnostic/release
lane artifacts while it is coordinated as a named target. Entropy QA
serializes both declared extension artifact paths, supplies the resolved
Chromium executable, and lets that engine either build isolated lane artifacts
or consume the explicitly configured prebuilt paths. It does not treat one
public artifact as the owner of a `both`-lane run.
Its scenario settings payload clones the current canonical
`DEFAULT_NUDGE_SETTINGS` with Sentinel Flare disabled. Retired fields such as
`nudgeConfig.thresholdMs` are forbidden; fixture preparation must satisfy the
same stored-value validator as ordinary settings writes without relaxing
product storage admission or resetting a persistent profile.
After the child exits, the adapter requires one non-symlink report root with
exactly one owned report directory and a regular non-symlink `report.json`.
It validates the complete schema-v1 aggregate shape, report-root ownership,
suite/options/repeat identity, requested lane set, nonempty per-lane run
coverage, identical scenario/repeat coverage across requested lanes, and exact
release-run/control coverage when controls exist. It then recomputes the
aggregate outcome from every run and extension-disabled control; a disagreement
is `QA_SITE_RUNTIME_REPORT_OUTCOME_MISMATCH`. A child `WARN` or `INCONCLUSIVE`
becomes control-plane `INCONCLUSIVE`; process exit success alone can never
produce a false control-plane `PASS`.

Each measured site row also owns a scenario-local
`contentRuntimeSettlementEvidence` ledger. The child folds only the bounded
`protection_tab_updated_admission_url_reconciled`,
`protection_tab_updated_dispatch_settled` and
`protection_tab_updated_dispatch_rejected` records from its existing lifecycle
checkpoints, dedupes their exact `(recordedAt,id,event)` identity, and records
the diagnostic-window capacity metadata. This prevents a final rolling tail
from masquerading as complete evidence without widening console introspection
or treating a larger query limit as durability. When a page exists, blocked
and exception rows take the same final content-runtime snapshot and retain the
exact lane build identity before returning.
The projection may include only the receipt/error/session generation integers,
closed probe/CAS error codes, and closed equality booleans emitted by the
Protection owner. A successful admission URL reconciliation has no dispatch
error code and is evidence that the exact document probe and registry CAS completed
before the ordinary transaction; it
is not a benign settlement. Raw current, requested, pending, probe-result, or
History URLs remain outside the report.

`site/youtube-selector-drift` is the Phase 4 Social Metrics observation
entrypoint. It reuses only the canonical `release-core` YouTube scenario in the
diagnostic lane and fixes three fresh disposable browser/profile epochs. It
does not mutate the page to manufacture drift and does not treat a current
canonical-selector hit as failure. Organic semantic-only recovery is
`observed`; exact effect, settings-owned restore, re-enable parity, settled
queues, and three unique isolation receipts produce `certified` plus
`selector_drift_recovered_human_review_required`. No observation writes a
runtime selector or canonical profile. The minimum repeat is three because a
smaller invocation cannot satisfy the certification contract.

```bash
npm run qa -- run site/youtube-selector-drift --mode=agent --rebuild=true --presentation=hidden
```

The selector-drift acceptance target above remains a product-effect test. Live
DOM candidate acquisition has separate, observation-only targets so the product
resolver never grades or trains itself:

```bash
npm run qa -- run site/youtube-selector-drift-corpus-public --mode=agent --surface=watch --locale=ko --presentation=hidden
npm run qa -- run site/youtube-selector-drift-corpus-public --mode=agent --surface=shorts --locale=ko --presentation=hidden
npm run qa -- run site/youtube-selector-drift-corpus-authenticated --mode=agent --surface=watch --presentation=background
```

`site/youtube-selector-drift-corpus-public` owns one disposable extension-free
browser and one exact watch or Shorts navigation. It accepts only `en` or `ko`,
defaults to Korean, binds browser locale plus `Accept-Language` before the exact
navigation, requests no OS focus, and closes only its owned browser.
`site/youtube-selector-drift-corpus-authenticated` never opens, navigates,
activates, focuses, or closes a page. It attaches to exactly one already-open
watch or Shorts tab in the declared `authenticated` managed browser, reads it,
detaches, and requires the complete operator-owned page target set to remain
unchanged. If the tab is absent or ambiguous, the run blocks instead of
substituting a public profile or another route.

Both targets wait for a bounded 500 ms mutation-quiet window, capped at six
seconds, then serialize at most eight owner-relevant surfaces, 96 nodes per
surface, and six descendant levels. Page text is reduced to redacted content,
separator tokens, or digit-shape-only metric/time evidence; accessible labels
become the closed action identity plus locale and count shape. Stable YouTube
`like-button-view-model` / `dislike-button-view-model`
component roles may provide the same closed action identity when an accessible
label is absent or not yet recognized; they do not by themselves identify a
mutable numeric leaf. Cookies, account
identity, raw URLs, content titles, comment text, `ytcfg`, experiment flags,
SVG path data, raw accessible labels, full-page HTML, product-generated
selectors, and automatic profile writes are forbidden. The resulting
`youtube-selector-drift-corpus.json` is a candidate artifact for independent
human oracle selection. A `PASS` proves route/locale/authentication/opportunity
coverage only; it never certifies product recovery or edits a canonical
profile.
For Shorts, a matching `/shorts/<id>` route plus unrelated Share controls is
not sufficient: at least one independently classified Like action/component
must be present before the player-action opportunity is admitted.

X and Instagram use a separate authenticated candidate-corpus target:

```bash
npm run qa -- run site/social-selector-drift-corpus-authenticated --mode=agent --surface=x_post --presentation=background
npm run qa -- run site/social-selector-drift-corpus-authenticated --mode=agent --surface=instagram_feed --presentation=background
npm run qa -- run site/social-selector-drift-corpus-authenticated --mode=agent --surface=instagram_reels --presentation=background
npm run qa -- run site/social-selector-drift-corpus-authenticated --mode=agent --surface=instagram_profile_grid_dialog --presentation=background
```

This target borrows the declared authenticated managed browser but owns one new
background page per invocation. The protocol records exact create, navigation,
detach, and close receipts; never calls `Target.activateTarget`; enables visible
document execution only inside the owned CDP session; issues no OS-focus
request; and requires the operator's baseline page-target set to be unchanged
after cleanup. Its capture is independent from the product X/Instagram
adapters, bounded to twelve surfaces, eighty nodes per surface, and five
descendant levels, and removes raw URLs, account identity, captions, accessible
labels, experiment flags, SVG paths, full HTML, and product selectors.

X post, Instagram feed, and Instagram Reels require a uniquely owned Like
metric and return `PASS` only when route and authentication match. The combined
Instagram profile/grid/dialog surface additionally performs one bounded hover
reveal and one owned grid-link interaction. Profile and grid evidence without a
unique Like metric in the opened dialog remains `INCONCLUSIVE`; a nearby number
is not promoted to an action count. All resulting fixtures stay
`candidate_only`, require human oracle review, and cannot write a runtime or
canonical selector profile.

`site/tiktok-feed-flow` is the bounded FeedFlow exact-match acceptance
entrypoint. It reuses the canonical `release-core` TikTok scenario through the
site-selection seam instead of copying its settings, trusted seven-step journey,
independent dominant-item oracle, or debugger matcher. Its target contract
admits only `site=tiktok` and `lane=diagnostic`, defaults to three repeats, and
does not select a measurement profile, so the Runtime Debugger FeedFlow ledger
remains available to the independent matcher. A release lane, extension-disabled
control, and the broader release-core site matrix are outside this target.
The target also fixes `repeatIsolation=fresh_disposable_browser`. The child
creates one owned browser/disposable-profile harness epoch per requested repeat,
requires distinct profile paths and exact scenario/repeat coverage, rejects a
retained temporary extension or browser-build identity drift, and completes the
existing harness cleanup before starting the next epoch. Persistent/retained
profiles and a release lane fail admission; no site storage is cleared in an
operator-owned browser.
The explicit `repeat=1..20` override remains available for bounded diagnosis;
the gate evaluates every row requested by that invocation. “Three repeats” is
the canonical default invocation, not a hidden minimum that rewrites the flag.
After validating the owned schema-v1 aggregate, the upper `site_runtime`
adapter applies the target-declared `feed_consumption_exact_match` report gate;
this does not add a second report schema or change other site targets.
The generic report validator first proves exact lane/repeat coverage. The gated
rows must then persist `siteId=tiktok` and the target-declared canonical
`scenarioId=tiktok-public-feed`; either identity drifting fails loudly before
contract evidence is accepted.
The report options must also retain the target-declared
`repeatIsolation=fresh_disposable_browser`; missing or substituted isolation
proof is `QA_SITE_RUNTIME_REPORT_OPTIONS_REPEAT_ISOLATION_MISMATCH` rather than
an acceptance sample. Every gated run also records a versioned content-free
isolation receipt under its existing `configuration` envelope: exact epoch
ordinal, SHA-256 scalars derived from the harness-verified owned-browser token
and disposable profile path, owned browser process, disposable/non-retained
profile and temporary extension, and completed harness cleanup. The lower
runner requires both digests to be unique across repeat epochs only after the
owned process has terminated and the exact harness temp root is absent. The
upper adapter independently requires digest uniqueness and correlates the
receipt with null/non-retained report options, the aggregate disposable profile,
and removed temporary-extension build metadata. A missing, malformed, reused,
contradictory, or incomplete receipt fails with the typed
`...EVIDENCE_INVALID`, `...EPOCH_REUSED`, or `...TOPOLOGY_INVALID` boundary.
Other site-runtime
targets retain their existing shared-browser repeat behavior and report shape;
an unexpected isolation option or per-run receipt on those targets is
`QA_SITE_RUNTIME_REPORT_REPEAT_ISOLATION_UNEXPECTED`
instead of silently changing the workload. Aggregate reproduction commands keep
the invocation's requested repeat count, while each individual run artifact
retains its bounded one-epoch reproduction command.
Acceptance requires the `feed-consumption-exact-match` contract to pass in every
requested repeat row (three by default) with at least two measured opportunities
per row, zero insufficient steps, false negatives, false positives, and
duplicates, and exact precision/recall of `1`. The persisted aggregate may
still carry warnings from other TikTok scenario contracts; those warnings do
not substitute for or erase an exact-match failure. A valid exact-match PASS row
below the opportunity floor is workload insufficiency. The same is true for the
canonical zero-opportunity control shape: contract `WARN`, evidence version `1`,
state `armed_idle`, reason
`bounded_inputs_produced_no_independent_opportunity`, positive armed-idle count,
zero opportunity/detector/correctness counts, and null precision/recall. For
either shape the adapter emits the typed
`QA_SITE_RUNTIME_ACCEPTANCE_OPPORTUNITY_FLOOR_UNMET` projection and keeps the
target `INCONCLUSIVE`. Missing or malformed evidence, a contract outside the
exact measured-PASS or armed-idle-WARN shapes, nonzero detector/correctness
evidence in the armed-idle shape, or a count-conservation mismatch fails loudly
as `QA_SITE_RUNTIME_ACCEPTANCE_GATE_FAILED`.

Paged detector confirmations that retain a positive `gestureSequence` correlate
only with the same canonical `feed-step-N` gesture. A confirmation that lands a
few milliseconds inside the next step's temporal window therefore remains
owned by its causal gesture and cannot become a false negative plus a
cross-sequence false positive. The existing lead/tail bounds independently
grade confirmation timing: an exact sequence match outside those bounds remains
attributed to its gesture, preserves its measured latency, and fails the journey
as `detector_confirmation_timing_out_of_bounds` instead of being reassigned.

`site/feed-runtime` is the narrow real-feed contention entrypoint. It accepts
only `youtube` or `tiktok`, fixes the child lane/profile to paired `both`-lane
`contention`, selects only the public feed-runtime suite, and passes the exact
selected site into the engine. `--feature=combined` is the default; `scroll`,
`visual`, and `text` select strict single-owner scenario profiles without
changing the trusted feed action contract. This yields diagnostic owner attribution, the
shipping public lane, and its automatic extension-disabled control under the
same action contract. Its optional absolute `--profile` is forwarded only to
the canonical site engine, which validates the dedicated QA marker and
canonical progression fixture before release actions. The adapter
validates that same site in persisted report options, so a broader suite run
cannot be mistaken for the requested cohort. Its per-action attribution keeps
public-minus-control renderer and Long Animation Frame evidence separate from
instrumented Entropy owner coverage and CDP renderer residual; the residual is
not a page-owner verdict. The diagnostic lane also correlates its bounded scalar
owner/subscriber timeline with the sanitized LoAF script timeline and
`styleAndLayoutStart` phase. It reports same-frame and style/layout-phase overlap
as temporal evidence only; incomplete timing retention cannot produce a
measured attribution.

The site engine deliberately persists a valid aggregate before exiting `1`
when any run or control is `FAIL`. The adapter therefore reads that owned
report after the canonical nonzero exit and projects top-level `FAIL`. Exit `0`
with a `FAIL` report, a nonzero exit with a non-`FAIL` report, or a noncanonical
exit code is `QA_SITE_RUNTIME_CHILD_EXIT_OUTCOME_MISMATCH`. A typed
infrastructure failure is never reclassified as a suite result, and a nonzero
child without a readable valid owned report fails loudly as
`QA_SITE_RUNTIME_CHILD_REPORT_REQUIRED_AFTER_NONZERO`. Missing paths,
symlinks, file-read failures, and malformed JSON retain typed report-boundary
errors rather than leaking raw filesystem or parser errors. When the readable
owned report reaches the target-specific acceptance gate, its typed
`QA_SITE_RUNTIME_ACCEPTANCE_GATE_FAILED` verdict remains primary even after the
canonical child exit `1`; the adapter does not relabel that accepted report
boundary as a missing child report.
The command and site-runtime adapters also serialize the complete reusable
browser execution leaf contract into the child environment; `--headed` or
`--headless` remains only a compatibility input for legacy engines. Every
browser-owning child entry reads that environment before display, process,
connection, or target admission and rejects a disagreement with its CLI or
legacy rendering variable. Direct standalone invocation without a parent
environment remains supported through the child's explicit CLI contract; it
does not provide a fallback when a serialized parent contract is malformed or
contradictory. Each Extension Chromium process also checks the extension-runtime
leaf against whether that process actually loads an extension. The site-runtime
extension-disabled control browser receives an explicit `none` projection that
preserves every other admitted execution leaf; it never silently reuses or drops
the product browser's `required` leaf. Site-runtime tab activation is
lane-specific and never requests OS window focus. The `diagnostic` lane uses
the development-only background owner with the exact harness sender, unchanged
web target, and `focusWindow: false`; its
`diagnostic_tracking_admission` receipt still requires the production tracking
snapshot to report the exact target as `lastActiveTabId`. The `release` lane
does not call or ship that QA route. Its owned ephemeral harness first proves
the exact page target and tab in its target ledger, then uses the trusted
extension page for `chrome.tabs.update(tabId, { active: true })` and an
independent `chrome.tabs.query` readback. Only that
`release_external_active_tab` proof is required from the public artifact lane;
production tracking internals are not a release activation oracle. Neither
path calls `chrome.windows.update`, `Target.activateTarget`, or falls back to
the other lane. Attach-only activation and process-preservation contracts stay
separate and unchanged.

`human` and `agent` are execution contracts, not presentation aliases.
Feed-human yields while inspection is inactive, the endpoint lease is idle, and
the boundary is unreached. It sends no synthetic feed input; confirmed operator
advances establish readiness and arm inspection, and later operator input reaches
the endpoint. A later structured human terminal marker with phase `failed`
invalidates that handoff instead of allowing the earlier readiness marker to
produce a false PASS. A clean inactive episode does not end the human process
or close its inspected tab, and passive operator-arm waiting has no wall-clock
expiry. The page remains operator-visible until the target or run is explicitly
closed. Feed-agent alone drives the synthetic bounded canary and requires
committed-lease, boundary, completed-hold, final feedback phase, and zero
production-Gate evidence; intermediate phase snapshots may legitimately advance
while the harness reads them. Feedback-only Feed inspection never requests a
production Enso Gate.

Gate `*/render` targets are deliberately render-only.
`gate/detour-spread/runtime` owns one isolated `ephemeral` development browser
and three inert loopback web tabs. It prepares the disposable vault through
`securityVaultQaFixture`, uses canonical settings/site-rule commands to enable
Detour at budget one, and asks the existing dev-only `PRESENT_DETOUR_SPREAD`
route for canonical full-page presentation. This explicitly bypasses the
foreground entry detector; it certifies controller admission, live inventory,
Gate rendering and real close/resume behavior instead. The source tab stays
active and no polling or input requests OS focus or emulates visibility.
The first case manually closes an exact owned sibling and requires automatic
same-tab return to the exact original URL, including query and fragment. The
next authorized Gate read must still report `pruningTutorialCompleted: false`,
proving the external close did not record a tutorial receipt. The parked third
tab supplies this second protected sibling without creating another web tab.
The fixture waits the real canonical `INTERVENTION_RECOVERY_MS` between these
presentations without changing admission policy or the clock. Each Gate capture
requires no visible alert/error after a real periodic refresh; selection repeats
that check before input.
Native pointer selection then submits that sibling through the real Gate UI,
requires its exact target to disappear and the kept current tab to resume.
`gate-detour-runtime.json` records these finite steps and worker failure
diagnostics. No raw storage, fabricated receipt, clock override or new product
debug path is used. Decision-history and kept-tab-pass persistence remain
covered by focused product tests because this target has no canonical runtime
read for those records; tutorial persistence is observed through authorized
session reads. Current-selected closure, foreground detector behavior,
multiwindow scope, permission prompts and incognito are outside this target.

`gate/entry-checkpoint/runtime` is the live runtime target: a trusted dev-only
message asks the canonical `GateInterstitialController` for one bounded
entry-checkpoint presentation, verifies the exact repository-owned session
commit, observes the real `gate.html` surface, waits for foreground Continue and
confirms return to the original URL. The protocol never seeds or reads raw
storage. After opening the real scenario tab and completing any admitted
initial window presentation, the runtime target prepares its disposable
profile through `securityVaultQaFixture` and the canonical Dashboard setup route.
The randomly generated passphrase remains in memory for that preparation and is
never recorded. `QA_GATE_SECURITY_VAULT_READY` records only the sanitized unlock
and Dashboard isolation receipt. Setup failure stops before Gate presentation;
personal and persistent profiles are never admitted by this fixture.
Entry runtime defaults to headless and retains actual document
visibility/focus and input/wait assertions; consumption requires headed
foreground evidence. Both expose `--allow-initial-window-focus-once` with default false,
matching the shared agent preparation policy. The existing upper-session
`windows_agent_present_once` owner prepares the first exact owned UI tab once
and records its receipt before input or consumption observation only for a
headed foreground run. Hidden/background runs receive no native callback. Explicit
`--allow-initial-window-focus-once=false` makes no request and must satisfy
native foreground admission without repair. Polling and inputs never renew OS focus
or emulate visibility/focus.

`--decision=continue|leave` selects the outcome (Continue by default). Leave
clicks the bamboo's native hit area before waiting completes, samples the real pouring scene
at approximately 180ms, 450ms and 800ms (pour, dump and return),
requires the pour to latch disabled without completing entry and confirms the exact owned target
closes within a bounded 5s failure deadline. The harness immediately releases
that confirmed closed target through its existing page-lease owner before
browser cleanup. Its observed close latency and
`gate-runtime-pour.png`
and `gate-runtime-motion.json` are evidence. Dump and return retain geometry only:
repeated compositor/PNG work can outlast this real one-second close. Samples record actual elapsed time,
tube angle and visible water opacity without changing the product clock or
stage; screenshot latency can move a capture later than its requested time.
Leave motion reads action layout and geometry in one DOM evaluation per slot,
including the first choice latch, so duplicate CDP round trips do not race the
bounded product close. The phase labels name observation slots; actual angles do not necessarily
reach the corresponding physical phase under frame delays. These checks
certify coordinate placement, not completion of the gesture, audiovisual
synchronization or subjective effect.
Ground geometry samples the three indexed `ground-ripple` groups at their local
`(0,0)` origins, since each wave now consists of broken vector arcs rather than
one ellipse. The same canonical impact point, cardinality and 1.5 CSS pixel
placement tolerance apply; lip and wave origins are checked during all slots.

For Leave, `--input=keyboard|pointer` selects native Tab-to-bamboo plus Enter
(default), or a primary click on the actual bamboo body. Continue takes no input:
the protocol waits for its genuine focused foreground wait to navigate to the
original URL, with a 25s failure deadline. It never
injects a stage, clock or enabled state. Both paths record
`gate-runtime-interaction.json` and `QA_GATE_RUNTIME_INTERACTION_VERIFIED`:
stage and inscription must remain within 1 CSS pixel across the observed outcome.
The native action must be hittable, at least 44 CSS pixels high and on screen,
without horizontal overflow. Separate visible controls in the inscription fail.
Hook/lifecycle regressions separately cover
blur/hidden pause, cancellation, reauthorization and repeated/mixed decisions.
These checks do not certify subjective affordance, touch hardware or
screen-reader quality.

`--recent-use=empty|recorded` controls a labeled manual description fixture
(default empty). Recorded freezes 32 minutes of confirmed foreground use ending
18 minutes before evaluation into the session, without writing any history.
The runtime checks the authorized DTO and requires the minimal Gate to omit its
summary for both fixtures. The actual Shishi SVG must use the canonical clear
water gradient without turbulence/displacement filters. Evidence is
`QA_GATE_RECENT_USE_AND_WATER_VERIFIED` plus interaction samples/captures.
This certifies transport and rendering, not real observed history or the
dashboard's Pixi/GPU behavior.

The same target accepts
`--viewport=landscape|portrait|wide-short|compact-portrait` (1440x900, 390x844,
844x390 or 320x568, DPR 1; landscape by default). `--resize-to=none|landscape|portrait`
(none by default) optionally resizes the same live waiting document once,
recording before/after layout and geometry in `gate-runtime-resize.json` plus
`gate-runtime-resized.png`. Resizing does not refocus the window or reset the
Gate clock. Waiting and ready screenshots capture the actual
lazy-loaded scene. All three ripple centers are sampled against the shared
stream-impact coordinate using live SVG screen matrices; the lip splash must
also match its shared source coordinate. The lip probe requires exactly one
named `lip-splash` scene part, so decorative circles such as stone minerals
cannot be mistaken for water. More than 1.5 CSS pixels displacement
fails, including across responsive transforms and all three Leave motion
captures. Computed host font size, colors and interactive bounds are recorded with
the interaction samples for visual review. Full waiting samples are recorded in
`gate-runtime-geometry.json`. This is coordinate evidence, not a subjective
material/animation quality score.

`--audit-layout=true` optionally captures all four declared viewports in the
same live waiting document, then restores the selected viewport before the
decision. It uses the same owned tab and native document, without refocusing,
changing copy/clock or injecting a product stage. The four captures and
`gate-runtime-layout-audit.json` record font styles, action bounds, scroll
extents, painted bamboo/stone bounds and water matrices. The run fails if any
audited action or painted bamboo/stone is clipped, or any audited water center
exceeds the existing 1.5px tolerance. Leave samples also check painted bounds.
These are CSS
viewport checks, not real mobile hardware or browser zoom certification.

`--intensity=baseline|maximum` freezes a labeled canonical session value: 0 or
the policy maximum (3600ms) foreground wait extension. It never writes
consumption history. The verifier reads the same cap, validates the authorized
session and records `QA_GATE_RUNTIME_INTENSITY_VERIFIED`, then automatically enters
after the live 10s/13.6s wait. This certifies fixture-to-session-to-wait behavior,
not a live multi-hour producer/calibration or human-effectiveness study.

The trusted dev-only `QA_GATE_READ_EXPOSURE` action reads the admission owner's
committed interval projection. The same runtime target checks that its open Gate
is uncertain and its confirmed end produces one presented interval, recording
`gate-runtime-exposure.json` and `QA_GATE_RUNTIME_EXPOSURE_VERIFIED`. It does not
seed history, claim measured gaze/visibility duration, or certify worker revival.
Runtime presentation defaults to hidden and muted; explicit headed runs remain
available. Only the real-consumption target rejects hidden execution.
The dev automation modules are excluded from public artifacts by the Vite capability
alias and public-build debug-surface guard.

Failed Gate presentations also retain the existing extension service-worker error collector in
presentation diagnostics. This distinguishes a worker startup exception from
a Gate rendering or decision failure without changing readiness or message
deadlines. The collector detaches through the run's cleanup owner.

Browser navigation events are timestamped at ingress, and Gate presentations
are serialized per tab. A presentation transaction plus its committed
navigation-observation watermark prevents delayed pre-redirect events from
deleting the new session after asynchronous runtime admission. Once a
Gate is `pending` or `resuming`, that blocking session remains the
tab SSOT: routine inactive protection snapshots cannot release it. Detour uses
the same authorized top-level document and has no inline notice, iframe, or
content START/STOP acknowledgement path. Actual
post-watermark escape navigation retains fail-closed close behavior.
Authorization, stale presentation, inactive ownership, and escape decisions
are recorded in the canonical content-runtime diagnostic ledger and included
in failed Gate run evidence.

`audio/suikinkutsu` is a human/agent live-effect target. On a managed profile,
both modes synchronize the identity-receipted dev artifact with `scripting`
and the configured URL's exact origin into the canonical profile-adjacent slot.
An external profile is discovery-only and must already expose that exact active
slot and permission contract. Both modes attach without taking process
ownership and mount the actual `AudioDullingActivationChip`. Human mode opens the media
URL without activating the window and requires Entropy to be pinned already.
Agent mode verifies `chrome.action.getUserSettings()` first. If the extension
is not pinned, its Windows Chrome driver performs one bounded, recorded pin
only under a compiled `osFocus: request_once` plan backed by the named external
profile's matching focus capability, then verifies the canonical API again.
With the default `focusPolicy: never`, the operator must pin the extension
manually or opt into that named external-profile capability before compiling
the target. When
audible media remains active past the baseline/reveal delay, one large,
non-interactive drop condenses low in the viewport, rises against gravity, and
is absorbed toward the upper-right toolbar boundary through a local blue edge
glow, contracting ripples, and a small reverse splash. During the bounded
invitation, the exact tab's toolbar action shows a dim `水` badge and
temporarily has no popup. The badge pulses cyan when the visual reaches the
boundary, then settles to its armed blue. In human mode one real click on that
icon reaches `action.onClicked`. In agent mode the protocol resolves the exact
CDP `tab` target and calls Chrome's `Extensions.triggerAction`; both paths
restore the normal popup action and start capture directly with the requested
resolution plan.

The target's `ramp-ms` controls whether the drop applies immediately or eases
into the effect. Its QA default is `0` so an agent or operator can identify the
transition immediately; an explicit positive value tests the production-like
ramp. The protocol holds the processed state for listening, then
returns the stable offscreen graph to dry. Human mode does not request native
window focus, unmute media, change media volume, or drive playback. Both modes
admit only their owned QA tab through the no-window-focus adapter; agent mode
starts its largest media element with a user-gesture CDP
evaluation, makes that element audible, captures `forming`, `rising`, and
`absorbing` screenshots, and then drives the armed action. It fails as
`BLOCKED` before playback if the attached Chrome command line contains
`--mute-audio`. The target is
dev-artifact-only and the public-build guard rejects its contract, route,
graph, and offscreen capture signatures. Invitation expiry, failure, STOP, and
session replacement restore the tab's prior popup, title, badge text, and
badge color.

The toolbar driver separates discovery from the stabilized execution path.
Normal runs use the canonical pin check and a fixed Chrome-150 toolbar/menu
relationship; they do not dump the browser UI tree. If that relationship
drifts, the pin fails loudly and writes one bounded toolbar diagnostic to the
run attachments. Names cross the Windows PowerShell boundary as base64 inside
a UTF-8 JSON envelope, so localized Windows output is not interpreted as the
automation contract and cannot produce mojibake progress logs.

The VideoSkip control-surface family publishes these agent targets:

```text
video-skip/youtube-watch
video-skip/youtube-shorts
video-skip/x-video
video-skip/instagram-feed
video-skip/instagram-reels
video-skip/tiktok
video-skip/reddit
```

For example:

```bash
npm run qa -- doctor video-skip/youtube-watch --mode=agent
npm run qa -- run video-skip/youtube-watch --mode=agent
npm run qa -- run video-skip/reddit --mode=agent --policy=hard_block
```

All seven use the authenticated managed-persistent browser, the dev extension,
background presentation, active target rendering, muted audio, and
`osFocus: never`. The protocol opens one exact owned page through the shared
attach-only adapter and never writes settings or site rules. A trusted harness
request reaches only the validated top frame; the content relay rejects START
when the normal product runtime already owns VideoSkip, records one QA session
identity, and permits STOP to remove only that session. The protocol exposes
only the canonical `--policy=hard_block`: the run must install the player-local
style, project the document lock, and prevent a trusted timeline click from
advancing the paused video. The rail must still receive pointer input, expose
its restrained-seek cursor, and produce visible blocked-attempt feedback from
that trusted click. A non-advancing video behind a non-hit-testable rail is a
failure, not proof of working input interception. Broad selector matches are discovery candidates
only. When a video becomes tracked, the product validates and eagerly marks
timelines inside that exact player, then observes only that player's child-list
hydration instead of scanning the document. Instagram also accepts a
geometry-bounded Reels media envelope when stable player attributes are absent.
Explicit progress semantics or sufficiently wide horizontal range geometry are
still required, so square volume controls remain outside the admitted
timeline-target marker without depending on localized accessible labels.
If video elements exist but all are outside the viewport, the opportunity loop
may center exactly one positive-area video once in the run-owned tab; it does
not browse the feed or perform an unbounded scroll search.
Teardown must remove the lock attribute, every admitted marker, every
player-local observer, and every document/open-shadow style before the exact
target is closed.

A route with no visible video is `BLOCKED` because the required media
opportunity was not present. A visible video with no independently valid
player-owned timeline is also `BLOCKED` because no timeline interaction can be
graded. When an independently valid timeline exists but the product has not
admitted it, the result is `FAIL` and is treated as selector drift. Canvas
controls, closed shadow roots, and child-frame controls remain unsupported
product boundaries; the QA protocol does not reinterpret them through a broad
slider fallback. `--url` may point a target at a known video-bearing route, but
its hostname must still resolve to the target's canonical site id.

The two Sentinel runtime targets synchronize the dev artifact with `scripting`
and only the requested URL origin when the profile is managed. External attach
requires the exact slot and contract to be pre-provisioned and performs no
filesystem or extension-load mutation. The trusted background route verifies
the exact harness sender, an HTTP(S) target tab, a
stable URL, and main-frame content readiness. Site mode applies the canonical
integrated-prelude entry policy, then human mode leaves the pointer flow to the
operator. Site agent mode sends one native hover move with buttons=0 to the
observed overlay canvas. It no longer clicks the semantic button or hits a
moving fish. The product confirms the worker-selected canonical guide and owns
attunement, readiness, five-koi assembly (one in brief), visible assistance,
actual-guide dwell and descent. The hover event is recorded; the QA driver
polls the normal outcome without synthesizing progress or completion.
Keyboard activation remains the production accessibility seam and is covered
by focused input-contract tests and human setup.
Global agent mode likewise invokes its overlay semantic
action, which resolves an eligible worker target and commits the returned
protocol outcome through the canonical session controller.
Both modes poll `NUDGE_DEBUG_SNAPSHOT`; the snapshot is a read of host and
selected-worker diagnostics, not a second protocol state owner.
In agent mode, both Sentinel targets also own the shared initial-window policy:
an empty managed Windows browser may create and immediately minimize one exact
anchor before harness start, while every subsequent focus checkpoint must
remain background, including the post-cleanup checkpoint after all exact owned
targets close. Human mode keeps the existing-page requirement so an operator-
visible run never acquires that exception implicitly.

Every newly observed Site phase, school count, return-point/dwell state, or
Global phase/fracture bucket is written to `sentinel-protocol-stages.json` and
the append-only event stream. Global keys additionally include the active hit
aftermath phase, accepted-impact serial, terminal-hit flag, and 0/25/50/75
percent progress bucket. This keeps final `fracture`, `reverse-recall`, and
`repair-seam-annulment` evidence distinct during the 1.48-second success
envelope. The production diagnostics boundary clears aftermath fields when the
scene leaves `ritual`; the following QA key is therefore `aftermath-idle` plus
the actual terminal scene phase rather than a stale success phase.

All Sentinel screenshot runs open a bounded page screencast before protocol
start and save the first compositor frame strictly after each observed stage.
This keeps both the 1.8-second Site collective descent and the shorter Global
aftermath evidence aligned with their diagnostic snapshots instead of blocking
the driver on a standalone screenshot request while the protocol clock
advances. Each such stage records `frameEvidence.source`, frame serial, capture
timestamp, and capture lag beside the PNG attachment; Site descent progress is
also bucketed at 0/25/50/75 percent before quiet-hold/reflection, so the
collective sink is a short filmstrip rather than one ambiguous endpoint.
An unfocused attach-only tab may leave several seconds between compositor
frames, so capture waits up to four seconds for a frame strictly newer than the
stage observation; it never substitutes the previous frame.
For Global Sentinel, `scenePhase: rift` is an invitation state, not QA
completion. The protocol keeps polling the product-owned aperture progress and
records the fully opened rift before it invokes the semantic
`nudgeRiftInviteButton` action in agent mode. It then follows the same exact
owned page target through the product's natural `enterGlobalRift()` path and
requires the same-extension `/src/pages/room-478.html` URL, complete
`source/runId/seed/originX/originY` handoff, and a rendered Room 478 scene root.
The dev-only START bridge assigns its already-validated request ID as the debug
Sentinel run ID, so this handoff exercises the same required run-identity
contract as a production Sentinel session rather than fabricating it at the
navigation boundary.
Only that ready receipt is a Global PASS. The product stops the Sentinel host,
then requests the trusted background `OPEN_NUDGE_ROOM_478` route; that route
rebuilds the canonical extension URL and updates only the exact sender tab.
Successful Global completion therefore sends no QA STOP.
An unexpected destination, invalid handoff, or Room startup error fails loudly.
Timeout before navigation remains `INCONCLUSIVE` and retains failure cleanup.

Screenshots are disabled by default
because the protected page remains visible below the overlay.
Global screenshot runs also record computed opacity/filter/blending for the
known page ancestors, Sentinel root, scene, canvas and frame. The Sentinel root
must have opacity 1 (`QA_SENTINEL_ROOT_OPACITY_NOT_OPAQUE`); otherwise page CSS
can defeat both the final blackout and the opaque white LCD. Per-pixel worker
transparency still owns the original-page survivors during entry collapse.
`--capture-screenshots=true` is explicit consent to persist that page content
in the run attachments. Results retain only the target origin, never the query
or fragment. Timeout is `INCONCLUSIVE`; protocol, frame stream, harness, and
attach-only browser cleanup preserve the browser process. Site runs and Global
runs that have not reached natural same-target navigation still send typed STOP
during terminal or abort cleanup; a Global run that has navigated through the
product handoff never sends the redundant QA STOP.

Sentinel STOP is destructive and idempotent, so its transport has one narrow
reconciliation rule: a four-second timeout or connection loss retries STOP
exactly once. A second `stopped:true` or `stopped:false` confirms the runtime is
inactive and records `reconciled` plus the first transport error. Logical or
authorization failures are not retried, and START/SNAPSHOT never inherit this
policy.

Every Sentinel poll preserves the worker render-pressure, effective-DPR, EMA,
and frame-work diagnostics. `result.renderPerformanceEnvelope` and the stage
manifest retain a bounded aggregate across all polls, including pressure
changes that do not create a new semantic stage. A screenshot run uses a
continuous page screencast, so its envelope is visual/QA-stress evidence; use
`--capture-screenshots=false` for a cleaner worker-cost pass. These fields
measure worker update/render command work and scheduling pressure, not direct
GPU completion or page-backdrop compositor time.

## Evidence and Cleanup

Every run writes:

```text
.artifacts/qa/runs/<run-id>/
  events.jsonl
  recovery-journal.json
  run.json
  cleanup.json
  recovery.json          # only after explicit crash recovery
  attachments/
```

`events.jsonl` is append-only during execution. A run-error event records the
terminal classification plus bounded top-level/cause codes and the named
admission stage; it does not copy command lines or local profile paths. `run.json` is the terminal summary
and records the resolved mode, lane, parameters, environment policy, artifact
identity, result, and structured error/cause. `cleanup.json` records each
release in reverse ownership order. A run root is exclusive and cannot be reused.
Terminal files are written atomically through the shared QA JSON evidence owner.
Journal, terminal evidence and nonexclusive exploration writes retry native
Windows `EPERM` on the same candidate-to-destination rename after 100, 500 and
2000 ms, emitting `QA_ATOMIC_JSON_RENAME_RETRY` with exact paths and attempt.
Success commits that candidate; exhausted retries preserve the old complete
record and expose the original failure, together with any candidate cleanup
failure. Other errors fail immediately. This platform seam neither changes
authority nor permits an alternate evidence path or default result.
`cleanup.json` is committed first and
`run.json` last, so the latter is the durable completion marker. Any failed
cleanup changes the final status to `FAIL`, even when the original condition
was blocked or inconclusive. `recovery-journal.json` is also atomically replaced
and mode `0600`. It becomes terminal only when every journaled target and lock
has been released; otherwise it remains active so a later explicit recovery can
re-prove ownership. `recovery.json` is a receipt, never a source of authority.

Tab, observer, feedback, endpoint, audio session, and debugger cleanup remain
owned by the target protocol and product harness. The control plane owns
child-process abort, browser attach/owned policy, resource locks, and evidence
finalization.
For attach-only runs, browser cleanup means detaching and preserving the
browser process. Owned Chromium engines share
`scripts/e2e/chromiumHarnessTempCleanup.mjs` for bounded profile/temp-root
cleanup after process termination; an `ENOTEMPTY`, `EBUSY`, `EACCES`, or
`EPERM` race is retried, while a persistent failure still fails loudly.

`npm run check:qa:architecture` is part of the repository prebuild check
cadence. It pins the target/protocol registry closure, cleanup and abort
contracts, canonical adapters, dev-only Gate and Suikinkutsu boundaries,
structured Feed completion evidence, and removal of the retired temporary
launcher. It also pins Feed research target/protocol closure, content-free
model-blind evidence, actual-versus-mature admission separation, diagnostic
expectation verdicts, and the personal-profile write fence.

## Migration Policy

Existing npm commands may remain as thin compatibility adapters while callers
migrate. They may translate legacy names into a canonical target and invoke
the control plane, but they must not retain their own build freshness,
configuration, CDP preflight, Chrome launch, signal, or report-root logic.
New diagnostics are added as target manifests and protocol implementations,
not as new public one-off launchers.

The reusable surface is currently a set of narrow named modules under
`scripts/browser-qa`, not a broad root facade. That keeps ownership and
dependency direction explicit while the contracts are still repository-local.
The next extraction milestone is a small public API and generic CLI over those
owners, followed by project adapters and an agent skill that calls the API/CLI.
The skill must not re-encode launch flags, focus rules, cleanup heuristics, or
CDP state in prompt instructions.

## Native Windows execution

Artifact prerequisite failures use the exact admission-code set in
`qaArtifactAdmissionContract.mjs`. A changed checkout after doctor, dirty public
metadata, missing manifest/build metadata, or commit/tree/lockfile mismatch
blocks the subsequent run before browser startup. Build execution failures,
source changes during a build, and unknown contracts remain FAIL. Public
doctor output includes `repair.path`, clean-source requirements, and ordered
manual repair instructions; it does not commit or discard changes. Commit
first, then build the configured public output and repeat the exact doctor/run.
The protocol owns browser loading, so a manual reload is not a prerequisite.

Child-process completion waits for `close` (pipe EOF), not merely `exit`, so
the last stderr blocker and report output cannot race terminal classification.
Pipe closure has a two-second bound; an inherited pipe that remains open fails
as `QA_CHILD_STDIO_CLOSE_TIMEOUT` instead of hanging or reporting success.

Child cleanup failures outrank cancellation. The run writes a failed
`child_process_cleanup_proof` cleanup entry and retains an incomplete recovery
journal; an abort signal cannot relabel that failure as ordinary INCONCLUSIVE.
Native Windows children are created with `PROC_THREAD_ATTRIBUTE_JOB_LIST` and
`CREATE_SUSPENDED`: the Job owns them atomically, before any code can run. Its
limits include `KILL_ON_JOB_CLOSE` and exclude breakaway. Only standard IO
handles are inherited; the Job and control-pipe handles are not. The parent
journals the random Job reservation before launch and its executable, PID and
Windows creation-time token before authorizing resume. Before launching work,
the hidden supervisor installs a console handler that ignores Ctrl-C/Break;
only the parent's private request can interrupt Job cleanup.

On cancellation, the root Node preload receives a private file request, invokes
registered protocol/resource owners, and writes a matching acknowledgment only
after cleanup completes. Descendants inherit Job membership but not the root's
cooperative channel. After the five-second grace period the held Job alone may
be terminated; termination is followed by a bounded active-process-zero query.
A root that exits while descendants remain gets two seconds before Job cleanup;
an otherwise successful run becomes `QA_CHILD_PROCESS_DESCENDANTS_OUTLIVED_ROOT`,
not PASS. Parent transport loss triggers Job termination. Supervisor death
closes its noninherited Job handle, so the kernel terminates that Job's members.
Missing receipts remain `QA_CHILD_PROCESS_TREE_CLEANUP_UNVERIFIED`.

The v1 journal has an additive `childJobs` capability. New writers always record
it; absence in an older writer means no registered Windows Job and never proves
old child cleanup. Entries progress through reserved/admitted/released and carry
the native zero-process receipt. Recovery first proves runner absence (including
Windows creation-time tokens), then observes the named Job absent or empty. It
does not reopen a journal-provided name to terminate processes. It releases
stale claims only after those observations. An attached child without a
cooperative acknowledgment remains `unverified_targets`; process absence cannot
prove that its targets in an external/managed browser closed, and recovery stops
with `QA_RECOVERY_CHILD_TARGET_PROOF_REQUIRED`. Other platforms without an
implemented descendant owner retain explicit UNVERIFIED cancellation.

A rejected cooperative cleanup remains `cleanup_failed`, even if the Job later
becomes empty; cancellation cannot replace `QA_CHILD_COOPERATIVE_CLEANUP_FAILED`.
Historical terminal journals remain inspectable. Active journals without the
child-Job capability require explicit diagnosis (`QA_RECOVERY_CHILD_JOB_CAPABILITY_REQUIRED`)
instead of treating missing child ownership evidence as successful recovery.

Browser process/target owners remain unchanged: this generic child supervisor
passes commands through and constructs no Chrome arguments, profile, or CDP
target. Windows Job semantics follow Microsoft's [Job Objects contract](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects)
and [atomic process assignment guidance](https://devblogs.microsoft.com/oldnewthing/20230209-00/?p=107812).

The named installation platform `windows` runs the existing Windows Chrome
process, profile, CDP, recovery, and OS-focus contracts directly from Node on
Windows. `windows_via_wsl` retains explicit WSL path translation. Platform
classification and PowerShell selection are owned by
`scripts/browser-qa/browser/windowsPlatform.mjs`. Native Windows paths are
absolute drive paths; they are never passed to `wslpath`. Both Windows modes
use exact CIM executable/profile/debug-port proof and the same nonce-bound
cleanup. The focus guard and initial-window anchor apply to both modes. See
`docs/operations/runbooks/windows-native-development.md` for workstation setup.

Native Windows managed-persistent launch detaches the Chrome process from the
launching console, ignores stdin/stdout, and captures bounded startup stderr.
Verified handoff stops collection and unrefs the draining stderr stream as well
as the child, so diagnostics cannot pin the launching console. The process lease still owns exact
pre-READY rollback; only verified profile/CIM/CDP handoff unrefs it. Per-run
browsers retain their normal owned launch lifetime. Revalidate persistent
readiness with a separate `browser status` command after `browser ensure` exits.

Installation and profile paths normalize using their declared platform rather
than the test/inspection host. Physical-capacity identities map explicit WSL
drive paths to the same Windows user-data directory before Windows host path
resolution, so native and WSL declarations cannot split a profile lock.

## Zen artifact gallery journey

`dashboard/capture --surface=artifacts --artifact-runtime-journey` adds an
opt-in runtime comparison in the same owned `ephemeral` document for any canonical
theme. The named owner is `dashboardArtifactRuntimeJourney.mjs`. It selects all
seven families three times through the actual controls, records heap/node/listener
  checkpoints, compares visible active, Rhythm-parked and Tools-returned windows for
  every family, and finishes with the same comparison for Lens. Its disposable fixture explicitly applies
  canonical development `SET_UNLOCK_DAY(5)` to every theme and retains the complete
  seven-family disclosure ACK. Missing or non-configurable families fail fixture admission.
Every two-second window uses the same finite native rAF/subtree-mutation probe;
hidden documents, missing canonical widgets, malformed metrics and uncommitted
Zen generations fail explicitly. It writes `dashboard-artifact-runtime.json` and
one `artifact-runtime-<family>.png` per family through the existing screenshot
owner, outside the timed runtime windows. The same owned tab provides all seven
decisive visual states; the journey creates no extra browser targets.
Selection requires the shared stage's actual ready ACK; Zen additionally requires
the requested scene and matching bitmap receipt. Active and returned windows
must show multiple exact submits and displayed frames during that window, rather
than counting the single PREPARE/commit frame as resumed animation.
  The positive integer engine ID and Worker channel session must both remain
  identical throughout all selections and measurement windows; a replacement Worker can reuse its local
  engine counter and must not be mistaken for retained runtime ownership.
Standalone themes require ongoing widget-subtree mutations near the end of each
active/returned window or a running infinite animation. Probe rAF alone cannot
certify artifact motion.
  Every family's parked window also rejects unpaused indefinite SVG timelines;
  Framer/WAAPI animation inventory and DOM mutations alone do not observe SMIL.
  Static OFF families must return with their selected presentation ready. A family
  that was animated before parking must demonstrate ongoing motion again within
  its return window; a single prepared bitmap cannot certify resumed animation.
Default captures pay none of this work. No setting, runtime clock, OS focus,
browser target or product method is changed by this probe.

CDP task/script duration deltas include the diagnostic probe and describe document
main-thread busy time, not pure-product/process CPU or Worker/GPU cost. Mutation
observer overhead depends on the observed activity. rAF gaps describe native document frame
supply, not artifact bitmap or physical presentation FPS. Initial/pass memory
checkpoints follow explicit document GC outside the timed CPU/frame windows;
the timed windows retain normal GC behavior. Heap/node/listener samples and
Zen's source texture accounting are retained separately and do not prove absence
of GPU leaks. Zen parking uses exact DRAW ACK counters after pending
requests drain; full physics/p95/texture diagnostics retain their 1200ms sampling
cadence. Non-Zen widget-subtree mutations or infinite animations, growing exact
submit counters, pending bitmap requests and a stale return ACK fail the runtime
journey. A bounded OFF spring must settle to a quiet baseline first. Aperture-wide
ambient mutations remain diagnostic; the dashboard-owned Zen ambient clock is
allowed to project presentation while the Worker is parked.
Missing artifact widgets cannot be counted as motion coverage.

Zen Main resize capture also waits for the Pond Worker's current CSS viewport,
raw DPR, backing dimensions and world aspect, then observes another rendered
sample before capture. Zen Main and embedded Sites additionally require a
post-resize Bonsai `update_scene` with `requiresFrameAck=true` at the current
canvas CSS size, followed by the runtime's accepted `scene_frame_committed`
event with no newer pending dispatch. The runtime performs exact scene,
materialization and input identity checks; bounded trace-signature lengths are
never treated as identity. Backing dimensions must retain the CSS aspect within
raster rounding. `dashboard-resize.json.bonsaiFrame` records the dispatch/commit
indices and dimensions. Trace-off/marks retain their explicit measurement
degradation and report this frame evidence unavailable rather than verified.
The existing `--settle-ms` delay alone is insufficient: retained paint and old
first-frame ACKs do not certify a resize. Both waits are bounded to 20 seconds;
failures are `QA_DASHBOARD_POND_RESIZE_FRAME_STALE` or
`QA_DASHBOARD_BONSAI_RESIZE_FRAME_STALE`, with current viewport/canvas evidence
and Worker metrics or Bonsai wait reason preserved. These checks do not certify
physical monitor presentation.

`dashboard/capture --surface=artifacts --theme=zen --artifact-journey` extends the
owned ephemeral extension capture with one cold and one warm lap of the Zen
artifact path (seven forward steps each), followed by all 14 directed neighbour
pairs (a forward and a backward lap) through the actual edge thresholds,
continuous shared-canvas identity observations, rapid latest intent (three
forward presses as separate tasks land three families on), and parked/returned
renderer checks. The Zen gallery is sequential: non-neighbour families are
unreachable by design, so the journey does not select them directly.
`dashboardArtifactGallerySelection.mjs` is the one page-side selection owner for
the journey, the runtime journey and the per-family captures: quickbar themes
click the family control; the Zen path walks the shorter way round, one settled
neighbour at a time. Parking leaves Tools through the sidebar's Rhythm
(`schedule`) control, which every theme's sidebar carries; Zen's garden keeps
Sites out of the sidebar, so a Sites control is not a parking route. `artifactJourney` defaults to false and is
rejected for other surfaces/themes. The named protocol writes
`dashboard-artifact-journey.json`. Selection does not invoke destructive artifact
actions. Submit/second-rAF timing is not physical display latency.

Artifacts initial and resize readiness requires both tab and control-panel width
and height to exceed 1 CSS pixel, without a fixed desktop-width minimum. This
admits the supported compact 379px panel and portrait-narrow vertical controls
while rejecting missing or collapsed regions. Exact requested viewport, theme,
active tab, font-state and native visibility checks retain their existing owners.
The journey separately waits (bounded to 20 seconds) for a committed current
client generation at the current DPR (capped at 2), then verifies its backing
dimensions. `ready` from an earlier DPR/generation is insufficient. The initial
assertion is inside failure capture: `resolutionEvidence` preserves expected DPR,
canvas width/height, snapshot generations/pending counts and the actual receipt.
Failure remains `QA_ARTIFACT_JOURNEY_RESOLUTION_STALE`; no fixed extra sleep or
resolution tolerance substitutes for the current commit.

`--artifact-entry-journey` additionally starts on Sites in the same owned page,
then clicks the actual Tools sidebar control without synthetic hover lead time.
`--artifact-entry-from=main` explicitly selects direct Main-to-Tools entry;
`sites` is the default, and non-default entry origin requires the entry journey.
The source tab reaches its normal readiness before `--settle-ms` and the click.
Main origin additionally requires clean first-frame/dismissible readiness and an
actually dismissed boot shell; a measurable Main tab alone is not sufficient.
The origin boot receipt is stored separately and degraded Main fails explicitly.
After either origin, returns leave Tools through the actual Rhythm (`schedule`)
sidebar control; Zen's retained garden Sites control is not a sidebar parking
route. The entry receipt records `fromTab` and `parkTab` separately. Compare the
first-entry starting conditions separately.
It measures one first entry and three returns, preserving canvas identity and
requiring parked loops to stop. `dashboardArtifactEntryJourney.mjs` owns bounded
ready/paint waits and long-task/frame-gap observations; `dashboard-artifact-entry.json`
records timings, observed DOM phases, the existing tab-entry telemetry snapshot,
engine snapshots and render receipts. Observers attach before the click task;
long-task inclusion uses interval overlap and records full and clipped durations
separately. `firstRafMs` includes the initial frame wait. The dev-only
`zen-artifact-frame` event freezes the first commit's UI timestamp, host request,
Worker request ID, generation and DPR before later frames can overwrite a
dataset receipt. Bounded per-entry prepare/commit events (128, overflow fails)
record input-identity changes; no per-animation-frame diagnostic stream is added.
This option requires Zen
Artifacts without resize, and composes with `--artifact-journey`. It does not
certify native input latency, physical display latency, or cold module caches:
the normal app boot/intent preparation policy remains enabled.

`--artifact-ui-diagnostics` requires `--artifact-entry-journey` and is off by default.
It samples only the owned document's entry/return journey with the CPU Profiler
(1ms interval, 25,000 nodes/200,000 samples limit), saves
`dashboard-artifact-entry.cpuprofile`, and adds bounded LoAF/resource entries
(512 each) to `dashboard-artifact-entry.json`. The named owner is
`dashboardArtifactUiEntryDiagnostics.mjs`; it always stops/disables profiling
and disconnects observers, including on failure. Unsupported/overflow diagnostics
fail explicitly. These instrumented timings are not the uninstrumented baseline.
The same flag records `dashboard-artifact-entry.trace.json` through the existing
`startDashboardRenderTraceCapture` bounded browser trace owner in
`dashboardBootRenderTrace.mjs` (64MiB trace buffer, 128MiB stream limit, stream
close on completion/failure). Boot retains its original reveal summary wrapper;
the artifact journey emits separate click/ready/paint user-timing marks. Only
the target-owned ephemeral browser is eligible, with no persistent profile trace.
LoAF rendering tails do not isolate GPU completion, raster, or physical display
latency. Default diagnostics change no product code, document style, preload,
target, or focus.

The closed `--artifact-ui-experiment` enum (`none` by default) requires UI
diagnostics. `without-grain-filter`, `without-nav-backdrop`, and `without-ground`
temporarily override exactly the named fine-grain filter, navigation backdrop,
or ground display during the entry/return journey. They preserve product code,
storage, dimensions of the surrounding workspace, and the renderer protocol.
The probe records computed-style application and removes its exact style node
on completion or failure, before normal screenshots. These are diagnostic
ablations, not proposed production visuals or a visual acceptance PASS. Compare
them only with identically instrumented `none` runs on the same build/device.

`warm-bitmap-sink` is an additional preparation experiment. Before the timed
click it presents one opaque gray pixel using a temporary 1×1 bitmaprenderer
canvas at the owned Sites page's bottom-left corner and waits two rAF callbacks.
It consumes/closes the bitmap and removes the exact canvas in `finally`, records
the separate preparation duration, and starts the ordinary entry journey after
removal. This tests browser presentation-cache reuse, not zero total cost or a
production warmup implementation. It creates no Worker, timer loop, or extra tab.

`--artifact-startup-diagnostics` requires `--artifact-entry-journey`. The named
`dashboardArtifactStartupProbe.mjs` instruments only the owned page's first
entry, observes main-document canvas context creation and an explicit set of
native shader/texture/buffer/query/draw calls, and restores all method descriptors
before the return journeys. It performs no extra WebGL query, readback, flush or
synchronization and never instruments Workers or changes focus. Evidence is
bounded to 4096 calls; overflow or restoration ownership conflict fails QA.
`dashboard-artifact-entry.json.startupDiagnostics` records the contexts, call
intervals and restoration receipt. Engine snapshots expose the renderer
constructor interval and explicit clock domain/time origin; production artifact
rendering uses the Worker clock, and its native calls are outside this document
probe. Render receipts expose submission intervals in that renderer's clock.
Do not subtract timestamps across realms without their time origins. Classify
observed document calls by their own intervals without adding nested
phase totals together. CPU call time may include driver waits and does not
measure GPU execution. Instrumented samples require an uninstrumented control
under the same target/build; this probe is off by default and is absent from
application bundles.

During each cold/warm selection, the journey samples the retained canvas's CSS
bounding rectangle while its outgoing scene is still marked `preparing`. The
outgoing rectangle must remain within 0.25 CSS px of the pre-selection rectangle;
drift fails as `QA_ARTIFACT_JOURNEY_PENDING_PLACEMENT_DRIFT`. Evidence includes
`pendingPlacementChecks` and bounded `placementViolations`. This detects DOM
placement/scale discontinuity, not the scene's internal animated pixel bounds;
a cached selection can finish without a sampled pending frame.

Paint-opportunity waits are bounded to 10 seconds. A failed journey preserves
its exact step, document visibility, engine status/snapshot, completed transitions
and pending-placement samples in the failure diagnostic. A hidden document that
stops receiving animation frames is a failed visible-required run, never a PASS
or a reason to refocus the browser during measurements.

The kinetic capture checks renderer progress and the declared simulation mode.
Furin snapshots expose simulation mode and physics time as observation only.
Its canonical `settle` mode has zero ambient wind: a pendulum already at rest
may keep its pose, but both render frames and physics time must advance. In
`live`, pose motion is additionally required; advancing counters alone cannot
pass a frozen live pose. Missing mode/time is invalid evidence. ShishiOdoshi
retains its pose-change requirement. `dashboardArtifactMotionEvidence.mjs`
owns these assertions and preserves before/after snapshots on failure.

The journey captures seven per-family PNGs after its measured traversal (the
Gate capture includes a 6.5-second dump interval). `--viewport=desktop-retina`
uses the same 1784x849 CSS viewport at DPR 2. Capture/encoding time is separate
from the traversal measurements.

The artifact journey captures also enable the first binary setting of Furin and Shishi-odoshi through the isolated dashboard controls, after transition timing has finished. The protocol records renderer frames and declared-mode simulation evidence in `kineticMotion`; it does not modify the operator profile or claim protection-action verification.

Boot diagnostic options are declared on `dashboard/boot`: optional
`--render-trace` (Chrome rendering trace), `--gpu-timing` (debug-only actual Pond
context timer), and `--interaction=none|immediate|warmup` (trusted Sites navigation).
Defaults remain uninstrumented idle boot; application `--trace` retains its
existing meaning. See `visual-capture-harness.md` for owners, evidence limits,
and cleanup requirements. Artifact preparation disables all three diagnostics.

The declared `--render-trace-profile=gpu-startup` selects a sparse native Chrome
GPU/startup trace for extended Zen idle boot observation up to the existing
120-second limit. Beyond 30 seconds of observation, tracing starts at the first
existing status poll in the final 30 seconds. The actual native/page anchor
offset is retained for original-window alignment, with explicit clock limits.
It requires `--render-trace`; the default `rendering` trace
keeps its one-second post-reveal limit. The trace owner records the selected
profile and bounded collector spans without source-bearing arguments. Browser
launch policy, graphics backend, artifacts, focus and stream/evidence limits
remain governed by their existing owners. See the visual harness contract for
the exact closed categories and attribution limits.

The closed `--gpu-info-collection=off|browser-default|dawn-eager` boot research
enum defaults to `off`. Active modes are restricted to the single-sample,
realtime 120s, Zen full-quality idle sparse-trace scenario documented in the
visual harness. The protocol verifies actual hardware rendering, passes the
named policy only into its measurement harness and records live argv projection
plus bounded browser-visible Dawn histogram evidence. The neutral GPU-info
launch owner admits eager scheduling only for run-owned native Windows headed
WebGL contracts. It adds one fixed switch, forbids attach/raw conflicts, and
preserves the existing execution leaves, graphics backend and process lifecycle.
Missing GPU histogram evidence remains unknown; startup eager requests may be
skipped without an existing GPU host. This research seam is not a default
product launch change. The owners and interpretation limits live in
`scripts/browser-qa/README.md` and `visual-capture-harness.md`.

The optional Chrome rendering trace includes `gpu.angle` native compiler/link
tasks. ANGLE's GLSL/HLSL source and compiler-error arguments stay in the bounded
local raw attachment of the owned ephemeral fixture; summaries and runtime
program telemetry do not project them. Existing 64 MiB recorder / 128 MiB stream
failure limits remain unchanged. This does not introduce GL calls, prewarming,
compiler ownership, scheduling or product readiness changes. See the rendering
diagnostic contract in `visual-capture-harness.md` for attribution and retention.

### Site chime verification (2026-09-13)

The Site runtime target also accepts `--exit-choice=leave` (default `continue`).
In agent mode it reaches the same reflection state, records completion evidence
and stops its capture stream before a native pointer sweep and release on the
real wind surface. That explicit gesture starts the product's acknowledged,
visible-frame-owned ink reveal, contact cue and closing sequence. Only
Chrome's explicit absence of that exact run-owned tab passes closure. Transport
errors, a removed overlay, or a different missing tab do not. QA does not remove
the tab to satisfy this assertion. The managed browser remains preserved.

The MV3 child measurement owner writes a schema-3 failed report even if extension
configuration or initial measurement fails after resource admission. This report
contains failure stage and cleanup receipts, without unexecuted measurements or
invented budgets. Cleanup failure also marks an existing report failed. The outer
command's child-report requirement remains strict.

Build-identity mismatch failures retain the expected and observed compiled build
IDs/profiles in the error evidence. They remain terminal; no polling or reload
fallback is introduced. The MV3 synthetic issued-nudge fixture must use an ISO
activity-date key and an explicit `deliveryForm`, matching the daily-receipt
contract; the per-attempt `runId` carries uniqueness.

The same `sentinel/site-furin/runtime` target waits 3.2 seconds and asserts that arrival exposes choices without passively completing or resolving the session. It sends a real captured pointer sweep followed by Escape and release, verifying that cancelled intent does not resolve the interaction. Hover and wheel input must not choose an exit or scroll the page. It verifies one canonical Furin SVG, zero koi/worker activity, media hold and page inertness, then activates the real Continue control once and checks acknowledged teardown. The dev-only realization route supplies an explicitly labelled 30-minute/four-interval QA fixture without writing stats; the surface displays only the committed total and goal. This is debug realization evidence, not production threshold, historical collection, or real-user benefit evidence. HTML media reach is reported explicitly; inaccessible frame media is not claimed paused.

Furin redesign verification uses `visual/zen/artifact-collection` (standalone SVG / Pixi) and `visual/sentinel/site-furin-sequence` (blank arrival, wind choice, all six inscription/meaning pairs, narrow width). The Site preview injects deterministic samples into the production inscription selector, uses the actual wind control's keyboard/assistive semantic activation and advances the canonical acknowledged exit clock to 1500 ms (1000 ms for the narrow reduced-motion panel); it does not freeze a separate Web Animation or reconstruct the reward timing. Its acknowledgement and usage facts remain synthetic, while native pointer capture, cancellation and tab closure belong to the runtime target. Both targets measure actual SVG attachment matrices before capture readiness; gaps above 0.02 SVG units are explicit failures. This protects joint continuity, not perceptual smoothness or pixel equality. The shared refined glass silhouette, glass material and contact dimensions are used by both renderers; Site selects the recipe's plain thread support.

The collection target also configures Furin with the canonical enabled-but-unengaged
artifact state (`armed` / `settle`). Over a fixed 10-second frame sequence it verifies
nonzero movement in all three Pixi joints and invariant paint-local coordinates,
records the angle ranges in `poses.furinArmed`, and captures `furin-armed`.
This closes the gap left by the unconfigured active replay; it does not certify
dashboard settings delivery, MV3 activation, sound playback or perceived naturalness.

`furin-impact` additionally replays the shared canonical wind to 89.2 seconds,
captures SVG and Pixi at a real rim contact and requires a nonzero physical
contact count and visible cue envelope. No forced effect or alternate physics
fixture is used. The shared paper curve and impact projection are covered by
focused attachment, frame-partition and collision tests.

The collection report's `furinCordPaint` additionally rasterizes the upper cord
from the actual compiled material, retaining its shared paint definitions. It
requires visible alpha across at least 95% of sampled rows; an otherwise identical
`objectBoundingBox` negative control must paint zero rows. This catches an invisible
stroke even when attachment matrices are continuous. Glass-rod readability and
contrast in the complete composition still require reviewing the captured images.
Furin attachment diagnostics also compare the spatial rift's center with the
moving upper cord's pivot (`riftTie`), using actual SVG transforms.

### Sites recording scope and refresh continuity (2026-10-09)

`dashboard/capture --surface=sites --sites-scenario=recording-refresh` extends the
existing owned ephemeral development dashboard harness. `none` remains the
ordinary capture default. The scenario cannot combine with `--resize-to` or a
non-Sites surface; it uses the declared theme, viewport, presentation and cleanup
and never touches an operator profile.

Both Sites journeys use the existing `waitForCaptureReady` deadline before their
first interaction. Every final surface capture, including Sites and artifact panels, must coincide with the boot owner's
`shellDismissed=true`, an absent boot shell and `#root.inert=false`. Root paint
under the opaque shell is insufficient input admission; the protocol observes
the natural release without removing inertness or extending the readiness timeout.

The protocol selects the notebook's current reading intent, then opens the global
cap's numeric form through the current presentation's actual trigger. Zen selects
an available annotation without manufacturing one (or the historical record when
no annotation exists) and visits today's date through the paged field. The real
canonical `GET_SITES_SITE_DETAIL` response strictly selects one declared case:
`observed-hourly` opens the hourly subview and selects hour 17 with native
End/ArrowLeft input; `unobserved-summary` retains the missing-day summary and
requires the absence of numeric metrics, session/hour actions, range, hourly
cells and selected-hour readout. Both open the basis view. This disposable
profile generates no usage, so a run whose real day is unobserved proves summary
refresh continuity; it does not prove selected-hour retention. Source-fixture
Intel journeys and focused reading tests certify their separate hourly cases.
Other themes select the shared Evidence page.
Zen opens the dedicated utility pane and parks notebook detail demand; other
themes retain the in-place form. It requests a canonical reset-hour
change 20 seconds into a 65-second real-time observation so the background's
15-second snapshot cache has aged. It requires the same workspace and input
nodes, a focused unsaved draft and a reachable utility form in Zen. The inline
presentation additionally preserves its Evidence reading intent after admission;
every presentation withdraws old analysis when canonical policy changes. Both require
absence of query errors; stable width without horizontal overflow; and an
increased admitted snapshot timestamp. Zen's notebook remains a bounded canvas
with no vertical document or reading-body overflow; other themes retain their
existing document reflow contract. No fake clock, stats write, runtime replacement or repeated OS focus is
used. The reset-hour command supplies an acknowledged setting change and schedules
the next activity-day boundary; the effective boundary need not change in this run.

Cancel must preserve the saved cap. After another 20-second cache-aging interval,
the protocol observes the visible selected notebook and requests one more canonical
saved global-cap change (`120 → 121` minutes), which changes current query policy;
reset-hour ACK alone may only schedule a later activity boundary. A bounded
observer must witness withdrawal and newer admission,
absence of the old business reading while pending, the same scroll/workspace
owners, stable scroll offset/width, and restored reading intent: active body,
annotation, selected date, basis return target/page, day subview, selected hour,
stable day-item anchor, field anchor and annotation anchor in Zen, or Evidence
in other themes. Zen keeps offset zero and requires no vertical overflow; other
themes exercise an admitted nonzero document scroll offset. Only
presentation geometry and selection may survive withdrawal; no source fixture,
stats write or old DTO supplies that phase. Native scroll clamping is observed
across the final paint boundary. Zen then uses the visible common Back control
to leave the basis view and requires the same date, annotation, subview and
item anchors. An observed day additionally restores hour 17 and its named visible
readout; an unobserved day restores the summary and again rejects fabricated
numeric metrics or detail controls. The continuity receipt declares the canonical
day observation and exercised case. The protocol then restores the saved
cap and commits recording off,
protected-only consent/scope and a protected site's exclusion through acknowledged
settings commands. Canonical snapshot/detail DTOs, withdrawn analysis, retained
saved values and disabled numeric cap input/Apply are checked. Each editor remains
in its owning cap row with reachable Cancel, no slider and no dialog.
The dashboard-admitted `REFRESH_PROTECTION_RUNTIME_SNAPSHOT` must return an
available runtime with zero declared/effective targets, budget pressure and
budget ratio. Protected-only queries suppress an outside domain; an excluded
protected entry retains policy controls. `dashboard-sites-recording-journey.json`
records each phase and continuity probe. Observers/timers are removed and the
harness owns the disposable settings/browser lifetime.

This checks real refresh presentation and query/runtime cap admission. It does
not generate foreground browsing, establish collection-write absence during active
browsing or certify protection actuation. Zero returned usage alone cannot prove them.

`dashboard/capture --surface=sites --theme=zen --sites-scenario=observed-reading-refresh`
is a separate, bounded UI continuity case. It reuses the existing development-only
`mixed` source observations through `buildRuleSiteIntel`, the canonical long-term
and today-note contracts, and the existing capture projection. The selected noon
hour contains 3,600,000 ms. No historical store write or new debug route seeds
stored statistics. The real canonical detail response's day observation is
recorded separately from the admitted source fixture.

The single-sheet journey selects today's date and the hourly subview, then uses
native range input to select hour 12. It requires the exact positive duration,
named range/readout, unchanged reading context and focused range. After opening
the basis view and aging the real query cache for 20 seconds, an acknowledged
canonical global-cap change (`120 → 121` minutes) must withdraw the old business
reading and admit a newer snapshot with the same reading intent. The in-body
return control must restore the same date, hour, context and anchors.
Before, basis and after states retain strict text/control bounds and zero-scroll
checks; the restored hourly canvas must keep its geometry and all 24 source values.
Only the decisive before/after screenshots and
`dashboard-sites-observed-reading-refresh.json` are added. The receipt explicitly
declares producer-source observations with real settings/query invalidation,
without stored-record or collection certification. It does not replace the
fixture-free `recording-refresh` receipt. The case is Zen/Sites-only, cannot
combine with `--resize-to`, and retains the same disposable ownership and cleanup.

### Stored Sites reading refresh (2026-10-12)

`dashboard/sites-stored-reading-refresh --viewport=desktop-wide` uses an owned
ephemeral development browser with declared foreground observation. The same
protocol also admits `portrait-narrow`. Its run-owned loopback document supplies
only a real page to visit; source fixtures, capture projections, injected stats,
private database access and fake clocks are forbidden. Production browser
activation events and the foreground segment sealer produce the records.
The existing `DEBUG_FORCE_SAVE` owner acknowledges their durable save;
canonical snapshot/detail queries must expose the observed positive hourly facts.
A service-worker restart and a fresh canonical query verify the saved hourly,
session and collection observations before the UI journey. The lifecycle owner
retains the declared single initial window preparation, exact owned targets and
normal cleanup. Actual foreground use requires a headed window; this is a
collection assertion, not a render-only visibility assertion. With explicit
`--allow-initial-window-focus-once=false`, the protocol only waits for and
verifies native foreground state, without making an OS focus request. Later
tab activation does not renew OS focus.

`scripts/qa/protocols/dashboardSitesStoredReadingJourney.mjs` strictly admits the
actual full detail and rejects the capture URL/marker. In the fresh one-day
profile it uses the in-body date chooser and hourly subview without requiring or
inventing an annotation, then uses native range keys to change the hour from the
product's initial zero selection. A positive nonzero hour is preferred; when only
midnight has records, hour one is selected with its real observed zero value.
The first positive bucket remains the separately declared `growthHour`.
A continuity observer starts while that hourly screen is open. The lifecycle
callback revisits the real tracked page, collects more elapsed use and returns a
new canonical detail with increased usage in `growthHour`, increased daily total
and an additional completed session. After real cache aging, an acknowledged
saved global-cap change (`120 → 121` minutes) must produce
withdrawal and a newer admitted snapshot while preserving the complete reading
intent, date, hour and anchors. A new canonical detail query and all 24 rendered
hour values must match the saved record, including the positive increase; the
named exact readout must remain usable, and both actual document focus and native
range focus must be present after the hourly readmission.

The same selected hour then opens the basis view. When its measured layout has
multiple pages, Next opens a non-first page before the second refresh; its page
index, page count and visible contents must remain identical afterward. A second
acknowledged policy change (`121 → 120`) must again withdraw and readmit a newer snapshot without
changing its return target or reading intent. The in-body return control restores the
same hourly selection, exact duration, anchors and range focus. Strict whole-text
and control bounds, zero document/body/nested scrolling and stable canvas
geometry apply to the decisive states. Two before/after screenshots and a compact
reading receipt supplement the lifecycle's actual collection, save and restart
proof. This target certifies stored-record UI refresh continuity; the separate
producer-source `observed-reading-refresh` case and fixture-free missing-day
`recording-refresh` case retain their narrower, distinct claims.

### Sites Intel reading presentation (2026-10-11)

`dashboard/capture --surface=sites --sites-scenario=intel-reading` uses the same
owned ephemeral development dashboard, canonical theme and named viewport.
It cannot combine with `--resize-to`. The development-only projection accepts a
closed source-fixture ID through `entropy-qa-sites-intel`; its public counterpart
is identity-only. Model output is never accepted as source.

The journey visits long, repeated, mixed, distributed hourly use, personal
comparison, increasing/decreasing completed history, intervention, sub-minute,
partial, observed-zero, missing and unclassified records in the same page. Each
source goes through `computeSitePullProfile`; historical observations use the
canonical long-term producer. The full registry/policy workspace stays mounted
and the reading is marked as QA example records. No storage writes or runtime,
query or record-owner replacement are introduced.

Zen selects the ledger-specific branch in
`scripts/qa/protocols/dashboardSitesIntelJourney.mjs`; capture readiness requires
its bounded ledger viewport. The loaded today summary/cap is the first paged
overview item; it does not consume height in the evidence, slip or basis body.
Its loaded today headline and today row share the
calendar-day basis, while the saved cap retains its separately labelled reset-hour
activity day. The field's historical range is the selected-detail owner's 30
completed calendar dates, excluding today. Increasing/decreasing fixtures preserve
session counts and rhythm while changing measured long-session duration between
the exact 15-date halves. The UI does not infer a form or choose a primary pattern.

For every existing source fixture, the Zen branch compares status, period,
annotation order across every overview page and the leading-missing collapse with the source-derived
`longTermPatterns`/`todayNotes` DTOs. It checks the observed-only average row,
oldest-to-newest dates followed by today across every evidence page (with no
missing or duplicate dates), distinct missing/zero/today row kinds,
24 cells on observed rows and admitted-pattern gutter marks from `matchedDates`.
The field group, annotation buttons and date buttons must be named and connected
by their accessibility controls/pressed state. Each available annotation is
activated by native keyboard input; the resulting row dimming and recurring/today
window bands are compared with supplied evidence. Selecting an annotation
replaces the overview with evidence and retains its context title into the
selected day's summary. Its initial visible page must contain the latest supplied
`matchedDates` entry for a pattern, today for a today note, the latest observed
day with completed sessions for an early observation, or the first observed day
inside the recent comparison half for change. These are reading anchors, not
new representative-day or cause classifications. Escape returns to the overview
and restores focus to the selected annotation. Direct history entry clears the
annotation context and still exposes every displayed date and today; the existing
leading-missing group stays collapsed.
Unavailable annotations have no placeholder stage.

Selecting a date replaces the evidence body with a named daily summary. Observed
days expose explicit session and hourly subviews instead of a fixed sequence of
daily pages. The session view shows the three supplied duration-bin counts;
the middle count is total minus short minus long. The hourly view keeps all 24
source cells and one named native range (`0..23`, step 1), with a continuously
visible time/value readout and matching accessible value text. Every hour is
selected by native keyboard input, including Home/End and both arrow directions;
the mixed fixture additionally exercises pointer selection. Exact source values
and sub-minute precision are checked. Observed zero retains real zero values and
subview access, while an unobserved date has no manufactured zero/session/hour
detail. Required summary blocks may be split only by measured available space.

Basis replaces the same bounded body and exposes every explanation page. Returning
must restore the previous daily subview, stable item anchor and selected hour;
returning to hours also restores range focus. A single common Back control, Escape
and native mouse Back follow the same one-level chain: daily subview to summary,
summary to the same date on its retained evidence page, evidence to overview,
then registry. There is no duplicate daily close/X or overview jump. All three
inputs cancel an open local cap editor before leaving its notebook; saved values,
trigger focus and surrounding geometry must remain unchanged. Existing pending
save/navigation guards remain authoritative. Selecting the same date again must
reopen its populated summary. Re-dispatching the same source
route must preserve the panel, bounded viewport and keyboard focus; this source-fixture
continuity probe is not a canonical live-data refresh test. Back returns to a
visible registry, restores row/search focus and retains hidden detail. Reopening
the same notebook must retain its panel/viewport and use the existing registry and
selected pane in the Zen-only spread, rather than create another workspace owner.
Every visible overview/evidence/slip/basis page must fit without horizontal or
vertical scroll, including the document, notebook, workspace, selected pane,
reading viewport and their clipping ancestors. The probe checks complete control
bounds and visible text Range rectangles against the viewport and all clipping
owners; hidden/off-flow measurement copies are excluded. It also requires the
entire local cap form, numeric input, Apply and Cancel controls to remain visible
while surrounding today/body geometry stays stable. These are usability and
accessibility assertions; painted bonsai overlap still requires image review.
Hourly checks retain compact successful geometry/count receipts; failures retain
the full existing diagnostic. This changes evidence size, not assertion coverage.

Zen captures base, available annotation-focus and day-slip states for `first-day`,
`partial`, `mixed`, `repeated`, `unclassified`, `zero` and `missing`, plus ledger
return and notebook reopening. The Zen-only `first-day` source has 30 unobserved
completed dates and an observed today with 14 minutes, eight completed sessions,
six shorter than two minutes and a four-minute maximum. It goes through the same
`buildRuleSiteIntel` producer: historical status remains `missing` with zero
observed dates and no admitted patterns, while terminal today notes contain the
ordered short-session, peak-window and visit-interval facts. The journey requires
only today's row, no average row, native annotation selection including the peak
window band, daily summary/session/hour access, basis state restoration,
same-source continuity and navigation.
The original 13-case non-Zen visit list remains separate and unchanged. All 14 Zen
sources, including populated first-day, passed the historical P3 three-viewport
journeys below. Those receipts predate the §12 daily-subview/navigation follow-up
and do not certify its changed interactions; fresh named runs are required.
The six target images remain design references, distinct from exact-run evidence.

The initial P3 verification attempts
`20261011082937005-dashboard-capture-5d662e30` and
`20261011083720133-dashboard-capture-dcf918ed` failed in canonical publication /
pre-build recovery before browser launch. These historical FAILs produced no
presentation assertion result. After explicit operator authorization and exact
scene/port/PID verification, only the existing previews at PID 11728 / port 7110
and PID 14468 / port 6144 were stopped through the native process owner; their
Ctrl-C/server-close owners were inaccessible in this session. Browser tabs were
preserved. Attempt `20261011084504119-dashboard-capture-a1bcf19d` subsequently
emitted `DEV_EXTENSION_PUBLICATION_INTERRUPTED_PROMOTION_RECOVERED` and restored
the presence of `dist`. That attempt successfully built and published input digest
`993a68d9aa5fb47f14e7431f30853ae835911d3d7a9121c16cb7f6bce216f0f3`
as build `20261011084550-42cb4a5944f0-dirty`, then failed in the browser at
`QA_ZEN_SITE_NOTEBOOK_NOT_ACCESSIBLE:ledger-partial`. Missing generated-runtime
translations painted raw `usage_ledger` keys and caused real horizontal overflow;
the geometry assertion was valid. Authored locale JSON already contained the new
keys, but the artifact-only build had not synchronized its generated `.js` leaves.
The canonical `npm run i18n:sync:modules` then exited 0 and updated the two Sites
runtime resources. The resilience test now consumes those `.js` modules rather
than testing authored JSON alone. Locale generation/resource ownership remains
`docs/architecture/repository/i18n-boundary-map.md`; no feature copy fallback or
guard relaxation was introduced. The absent-`dist` and pending authorization
conditions are no longer current. The six focused files passed 148/148 again
with runtime-resource imports, and the hourly-context file passed 7/7, for
155/155 focused tests. The i18n contract and dashboard i18n contract checks also
passed again. Fresh desktop-wide run
`20261011085324911-dashboard-capture-32f37fc9` built input digest
`3301fefdc2e1bf9a35aff6c5907ba72cf66085336472ddbc0ebffc55f70f47d7`
as build `20261011085357-42cb4a5944f0-dirty` and passed.

P3 presentation verification is complete, with all 14 Zen sources passing at
each named viewport:

| Viewport | Exact run | Build | Result |
| --- | --- | --- | --- |
| desktop-wide, 1784 × 849 | `20261011085324911-dashboard-capture-32f37fc9` | `20261011085357-42cb4a5944f0-dirty` | PASS |
| portrait-narrow, 560 × 960 | `20261011085555031-dashboard-capture-9565e5ac` | `20261011085613-42cb4a5944f0-dirty` | PASS |
| desktop-low, 1440 × 720 | `20261011085800814-dashboard-capture-8f394b16` | `20261011085820-42cb4a5944f0-dirty` | PASS |
| desktop-wide, final scrollbar material | `20261011090136268-dashboard-capture-b141a7b0` | `20261011090152-42cb4a5944f0-dirty` | PASS; pinned |

The final run used input digest
`950917e5744c7d4ab5072a2aa48091e43711982bf3a8cf497cf7df68d6a8311c`;
cleanup completed 7/7, active resources were 0, and app errors, warnings and CSP
violations were 0. The narrow and low runs also completed cleanup 7/7 with 0 active
resources; narrow logs had no app errors, warnings or CSP violations, and low logs
had no app errors. Direct inspection of final first-day and mixed-slip captures
confirmed translated content, no numeric-content occlusion and removal of the white native
scrollbar rail. The final correction replaces an invalid gradient-valued
`scrollbar-color` with a token-mixed thumb color and transparent track. It changes
neither width nor scroll ownership or geometry. Only desktop-wide was rerun after
that final material correction; the other two viewport receipts precede it.
Old components, exports and unused locale removal remain deferred to P4. These
source-fixture results do not certify collection behavior or production release.

An intervening attempt was blocked by `QA_EVIDENCE_BUDGET_EXCEEDED`. Canonical
default retention pruning removed 54 eligible completed runs / 27,557,952 bytes
before the final PASS. Closing retention inspection/pruning reported 318 runs,
0 candidates, 286 protected runs and 2,167,828,087 retained bytes against the
2,147,483,648-byte budget (`BUDGET_EXCEEDED`); no further runs were removed.
Additional QA admission may be blocked by protected evidence, without changing
these completed PASS outcomes. See the ledger plan's P3 verification record for
the full chronology.

The non-Zen branch retains its existing analytical checks. Details selects the
same reading field. Its Summary/Evidence pages must expose
the terminal-selected primary metric IDs, headline pattern, source temporal
evidence and the same primary-evidence hourly series. At most two secondary public
claims appear in the canonical presentation builder's admitted order, excluding
the primary claim. Analytical queries are scoped to this reading so its period
cannot be confused with the default 30-day graph. A same-site presentation refresh
retains detail, reading and hourly nodes, Evidence selection and keyboard focus.
In that branch, Evidence Escape returns to Summary first; notebook Escape returns to Time.
Time activation also returns through the normal nav without a focus trap.

The journey records reachable notebook controls and the actual Back/reopen flow.
The legacy analytical branch also retains its protection/recording/cap captures.
Both branches end in the notebook.
`dashboard-sites-intel-journey.json` and `sites-intel-*.png` are presentation
evidence, not collection or model-accuracy certification. Real facts refresh and
recording withdrawal remain the separate `recording-refresh` scenario.

The required viewport set remains three separate named runs: `desktop-wide`
(1784×849), `desktop-low` (1440×720) and `portrait-narrow` (560×960), DPR 1.
The viewport owner remains `dashboardCaptureViewportContract.mjs`; no substitute
viewport or resize route is admitted. Ordinary Sites capture opens the ledger;
hidden retained detail or a wide skeleton cannot establish notebook readiness.

The notebook reachability boundary is `[data-sites-fit="notebook"]`. The protocol
records actual vertical/horizontal extents and offsets for the document, Sites
tab, notebook, workspace, selected pane, detail, reading and ancestors. The Zen
bounded notebook allows no vertical or horizontal scrolling; the legacy analytical
branch retains its normal vertical document flow. Required identity, policy, basis and date/hour
controls must be rendered and reachable through that flow. Zen additionally
requires its annotation/ledger/slip controls; the analytical branch retains its
summaries, reading navigation and evidence controls. Horizontal overflow, hidden clipping and
unreachable controls fail with bounded geometry under
`QA_ZEN_SITE_NOTEBOOK_NOT_ACCESSIBLE`. An overflow-hiding style cannot satisfy the
contract. Closed native footnotes and inactive reading subtrees are not required
to paint their hidden contents, while their visible entry controls remain required.
Missing history retains its period/message and creates no zero-valued hourly marks.

The non-scrolling `.zen-home-frame` and `.zen-home-stage` paint extents are
checked against their actual fractional width plus the declared one-pixel
`--zen-home-frame-paint-bleed`, rounded up to the browser's integer scroll extent.
This does not widen notebook overflow tolerance: all reading/scroll owners and
the document retain their existing checks, and every clipping ancestor still
participates in control reachability.

In the legacy analytical branch, hourly focus/pin/dismiss within each fixture records the inspection
height and following basis position in notebook content coordinates. A change
over one CSS pixel fails `QA_SITES_GRAPH_INSPECTION_LAYOUT_SHIFT`; unrelated
fixture heights and intentional notebook scroll for keyboard reachability are
not compared as layout movement.

Reachability is checked for each source case, same-source continuity, basis
open/collapse and ledger reopening. Zen uses annotation-anchor/context, daily
summary/session/hour selection, basis/hour restoration and the common one-level
Back stages; the legacy analytical branch retains axis evidence/return,
Details Summary/Evidence, Time return/Escape and policy-control stages. Neither
identical geometry across unrelated source records nor an extra focus scope is
required. In the legacy analytical branch, scrollable long analysis stays in
the notebook/document; it never creates an additional popup or focus scope.

The source-period, current-day exclusion, usage/session facts, missing/zero
distinctions and keyboard/readout behavior remain authoritative. Clock-reference
colors assert neither weather nor severity; date intensity describes its named
usage measure. Fixtures preserve feasible daily/hourly totals and interpretation
v3 observation explanations; styling alone cannot establish any of these facts.
### Schedule mode capture (2026-10-01)

The schedule capture fixture includes nonoverlapping relaxation and isolation
windows. Readiness requires an applied runtime mode, then captures relaxation
and selects isolation through the actual timeline control. The preparation first
selects the weekday rhythm through its actual tab and waits for `qa-evening` to
be visible, independently of the wall-clock day on which the product opens.
It never changes the product's default day selection or fixture day ownership.
The selected editor
requires two exclusive mode controls. Block hit-height and horizontal control
geometry gates remain in the same run-owned ephemeral target.

The existing editor sequence expands and collapses its real options control.
After the workbench's existing placement transition settles, attached-paper,
portrait and low-height stages must retain the rhythm, track and workbench
x/y/width within 0.25 CSS pixels while the workbench's height grows. The actual
Schedule scroll owner reserves its gutter; the shared scrollbar style is unchanged.
The stylesheet owns both default centering and conditional top alignment.

Settings capture opens only public disclosures, scrolls the retained content
owner where the viewport permits it, reselects Permissions, then enters Safety
and Workspace. Same-section reselection preserves the scroll position; changing
section resets it before paint without replacing the sole scroll-owner node.
`QA_DASHBOARD_SETTINGS_SECTION_NAVIGATION` records whether the origin actually
overflowed, so a non-scrolling viewport cannot claim scroll retention coverage.


### Zen single-sheet capture contract revision (2026-10-12)

`dashboard/capture --surface=sites --sites-scenario=intel-reading` uses the same
ephemeral source-fixture and lifecycle owners. The Zen branch now asserts direct
calendar/day composition instead of the superseded overview/evidence/slip chain:
no permanent registry spread, every calendar date reachable by bounded date pages,
missing/zero distinction, no per-date hourly micrographs, exact 24 hourly values
through native keyboard range input, source session-bin counts, and complete basis
pages. The existing strict whole-text/control/scroll access inspector remains.
It also checks painted text and controls against the physical foreground stone
polygon's conservative bounds, independently of the reading-block calculation.
CSS overflow checks alone cannot detect that front-plane occlusion.
Decisive captures are first-day, mixed, missing, requested hours and root registry;
other fixture states retain assertions without redundant screenshots. These
source-fixture checks do not certify collection or personal-profile records.

`--sites-scenario=observed-reading-refresh` also changes the same owned page to
desktop-low, portrait-narrow and its initial viewport after an explicit date/hour
selection. The existing dashboard viewport and bonsai-frame owners perform those
resizes; no new browser/target or focus operation is introduced. Each stage checks
the complete reading intent, range focus and strict text/control/scroll access.
The acknowledged settings invalidation then exercises actual query withdrawal and
readmission while keeping the selected criteria page and return target. Displayed
observations remain explicitly declared production-source fixtures.
