# Browser QA Runtime

For everyday operation, start with [the agent QA workflow](../../docs/operations/qa/agent-qa-workflow.md).
Use the relevant owner section here when browser lifecycle details matter.
`qa run` performs preflight; a separate doctor pass is optional.

Automated initial OS focus is off by default. An explicit target opt-in may use
the upper-session initial-window anchor only for the exact managed process
started by that same run. `browserObservation: foreground` then presents the
verified window once; the background preparation route minimizes its new empty
anchor. Attaching to an already running process, retries and new tabs never
renew either grant, even if an old opt-in flag is still true. Actual headless
runs have no host window or focus preparation. Explicit operator open/setup
actions retain their own presentation owner. This preparation is distinct from
steady-state `osFocus: never`.
Native window focus, native document state and frame delivery are independently
observed; visible/focus emulation is not foreground-consumption evidence.
No protocol probe may request focus, restore a minimized window, synthesize
frames or start a substitute browser. See the Active Entropy QA control-plane
contract for target admission, single-use preparation and cleanup semantics.
The `animation` policy instead reuses an existing visible window without initial
focus or a bootstrap anchor; native visible rendering and real frames can be
measured while another app has focus. It certifies no foreground consumption.
The Windows focus owner proves the original target window before restoring it
and applying the single secondary-monitor preparation preference. Its receipt
proves the selected work area and resulting placement; single-monitor placement
is unchanged. No repeated placement or focus repair is performed.

Entropy's owned `journey/protection`, settings concurrency/propagation and Gate
entry-checkpoint runtime/consumption targets can enable one Windows initial
presentation at the upper `QaRunSession` boundary for explicit foreground runs, before
input or consumption observation. They reuse this neutral owner's exact
live-child/CDP identity proof and the existing PID/window-correlated driver. The first tab-proved UI
scenario is mandatory; closed prior UI pages still count. Only a same-epoch,
fully released null-tab runtime-marker `about:blank` reload seed is excluded.
The grant is consumed even on failure and later UI targets cannot renew it.
Verified non-Windows owned processes record the explicit Windows-only
`not_required` receipt; native visible-document admission still applies. Opt-out
and hidden/background runs receive no focus callback. Steady-state `osFocus: never` and
attached/managed process admission are unchanged.

Entropy's finite `settings/permissions --mode=human` target has one separate
opt-in `windows_human_permission_present_once` preparation policy. It is admitted
only for the `settings_permissions` protocol in an owned per-run `ephemeral`
environment, with headed foreground presentation, required native visibility,
active target, `osFocus: never` and `allowInitialWindowFocusOnce: true`. The same
upper single-use owner verifies the first tab-proved UI, exact live child/CDP,
run token and PID/window identity. Its driver and receipt retain the exact declared
policy. No other human target receives a focus grant; this does not use an
attached-window anchor, operator handoff or an until-cancel lifetime. The human
performs the declared native permission decisions; no polling, retry, popup or
later target can renew initial OS focus.

Journey failure attribution observes its already owned tabs/windows and native
process foreground once before capture, without changing activation or focus.
CDP target/window proof and the Windows driver's process MainWindow foreground
scope are separate; this bounded evidence does not prove target-window focus or
occlusion. The Active control-plane contract defines the sanitized receipt.

`scripts/browser-qa` is the product-neutral browser ownership boundary used by
Entropy QA. It is intentionally repository-local today, but its contracts are
structured so they can later move into a standalone package, CLI, or agent
skill without importing Entropy product code.

## Runtime update proof

Entropy's `settings/concurrency` and `settings/propagation` targets use one
run-owned disposable Chrome for Testing process and exact owned Dashboard tabs.
They default to actual headless execution without initial OS focus. Explicit
foreground execution may opt into its new process's single preparation; inputs
and polling never renew that grant. The development propagation fixture requires
run-specific markers in that copied extension's helper and binds its RAM lease
to the real helper sender/document and actual task. It is an Entropy protocol
fixture; the neutral browser runtime gains no storage or fault-control owner.

Entropy's explicit `maintenance/profile-reset --confirm-erase-entropy-data`
target handles an operator-approved invalid settings profile through the product
reset owner and exact Dashboard ACK. It verifies the existing managed identity
before mutation and the unchanged strict fresh-worker runtime proof afterward.
This preparation is owned by the Entropy protocol; the neutral browser runtime,
ordinary reload and diagnostic probes gain no reset capability. See the Active
Entropy QA control-plane contract for the exact eligibility and data scope.

Entropy pins complete build artifacts for each run, so another session's source
edits or dist publication cannot replace its running inputs. The harness keeps
one managed load/update path and proves the running background's compiled build
identity on every attach; activation receipt V3 only avoids unnecessary reloads.
The exact dedicated managed slot may be activated during authorized run setup.
External profiles and human capacity are preserved. See the Active Entropy QA
control-plane contract for the 2026-09-11 publication and preparation ownership.

Document liveness, animation supply and real foreground consumption are separate
observation requirements. A functional document test does not impose an FPS gate
or claim human foreground use merely because a visible page responds.

## Boundary

- `scripts/browser-qa/**` owns browser installation/profile descriptors,
  execution leaves, display/GPU admission, process and connection ownership,
  CDP transport/target ownership, and persistent-browser lifecycle actions.
- `scripts/qa/**` is the Entropy adapter. It owns Entropy targets, artifacts,
  protocols, evidence naming, and CLI compatibility.
- The neutral runtime must not import `scripts/qa`, `src`, an Entropy target
  catalog, or an Entropy build artifact.
- Compatibility modules may remain at old `scripts/qa/**` paths while callers
  migrate. They may synthesize a complete execution contract from a legacy
  call shape, but all browser ownership work stays in this directory.

The reusable runtime is not a second test framework. A project supplies its
scenario catalog and assertions; Browser QA supplies a safe browser session.

`cdp/CdpConnection.mjs` is the single raw WebSocket CDP transport. It owns a
bounded connection-open wait, independently bounded requests, exact pending
request identity, event fanout, and deterministic rejection/timeout cleanup on
remote or local close. A malformed protocol frame terminally closes the
connection; callers cannot continue issuing requests on a corrupted stream.
Product adapters may translate its typed errors or event shape, but they do not
create another WebSocket state machine.

After an exact target close returns `success: true`, an identity-verified
run-owned browser may disconnect when its last page closes. That existing
cleanup allowance covers both a pending inspection rejected with
`WEBSOCKET_CLOSED` and an inspection started after disconnect rejected with
`WEBSOCKET_NOT_OPEN`. Attached browsers and closes without that successful ACK
still require target absence inspection.

## Agent-safe defaults

An agent must resolve a named installation, profile slot, and execution
contract before it touches a browser. Runtime discovery never guesses a port,
substitutes a Chrome binary, reuses a different profile, scans tabs by URL, or
falls back to a personal browser.

The neutral Playwright owner requires that complete contract on every launch
and attach. It never reconstructs a contract from `headless`, presentation,
audio, or rendering hints. A redundant legacy scalar may cross the boundary
only as a consistency assertion; a mismatch with the contract is rejected.
Entropy-only legacy synthesis lives in its compatibility adapter and delegates
the resulting complete contract back to the neutral owner.

When a scenario crosses a child-process boundary, the parent serializes the
complete contract in `QA_BROWSER_EXECUTION_CONTRACT` and the browser-owning
child reads and validates it before display, process, connection, or target
admission. Legacy `--headed`/`--headless` and rendering variables are only
consistency assertions when that environment contract is present. A standalone
project adapter may still compile an explicit CLI invocation into a complete
contract, but it must not silently replace or weaken a parent contract.

The execution leaves are deliberately independent:

| Leaf | Question it answers |
| --- | --- |
| process ownership | May this run terminate the browser, or only disconnect? |
| start policy | Is lifecycle run-owned, manually managed, ensured by an upper session before attach, or external? |
| display/headless | Which display resource is required? |
| document visibility | Must the document prove it is visible? |
| target activation | Must this exact owned target be active? |
| OS focus | May the protocol make a bounded native focus request? |
| audio | Must launch be muted or explicitly audible? |
| GPU | Is active hardware rendering required, or merely optional? |
| WebGL | Is a working WebGL context required by this target? |

Tab activation and keyboard focus remain separate effects. Authorized browser
work includes focus needed for initial browser launch or a new tab's initial
preparation, without another confirmation. The adapter records that bounded
preparation through its lifecycle/target owner. The generic runtime default
`osFocus: never` governs steady-state execution: test steps, polling, retries,
and measurements must not repeatedly take focus. Creating extra tabs does not
renew preparation authority. A product adapter may expose a narrow focus-consuming
protocol only when the protocol declares the effect, records it in evidence,
and cannot satisfy its semantic test without it. An attach-only connection may
carry explicit `osFocus: request_once` when its independently declared external
profile grants that capability and the target is active; attach ownership by
itself neither grants nor forbids focus. Managed profiles remain focus-safe by
policy. Merely launching a headed
browser on the operator's desktop can still be disruptive; unattended loops
default to headless execution when their visibility/GPU contract allows it.
Headed native-Windows launches prefer a connected secondary monitor; the
existing bounded initial/operator window preparation applies the same
preference after exact process/target-window proof. Single-monitor placement
is unchanged. Neither monitor selection nor a presentation preset grants
additional focus authority, and observation/polling/retries never move a window.

An owned managed-Xvfb run receives Chromium's explicit SwiftShader WebGL
switches only when its versioned execution contract declares
`webglRequirement: required`. Optional-WebGL targets, host displays, and
attach-only browsers retain the browser default.

Headless presentation selects `--headless=new` without disabling the GPU.
Both the extension harness and CWS/MV3 adapter preserve the browser's default
graphics backend; display selection does not imply a graphics capability.
GPU classification and the declared WebGL requirement remain separate admission
checks. A headless render success is still ineligible for physical-GPU release
thresholds.

## Bounded GPU information collection research launch

`browser/chromiumGpuInfoCollectionArguments.mjs` owns the closed launch-only
policies `browser-default` and `dawn-eager`. The latter adds only Chromium's
`--collect-dawn-info-eagerly`; it is admitted only with a validated automatic,
run-owned, headed, WebGL-required native Windows execution contract. Attach,
non-Windows, headless and conflicting raw collection/backend arguments fail
before launch. The receipt records the policy and one applied switch without
private process ownership tokens. Default argument order and graphics backend
remain unchanged. This research policy is not a new capability leaf and does
not reconstruct or widen the versioned execution contract.

The Entropy adapter admits this policy only for its declared isolated
`dashboard/boot` GPU-startup contrast scenario. Artifact preparation uses the
default policy. Persistent/external profiles never receive this diagnostic.
The switch removes the startup Dawn request delay but does not force creation
of a GPU host: early collection can be skipped when that host is absent.
Actual argv and positive collection evidence must be retained; missing late
events or histograms alone never prove that collection moved earlier. This is
an experiment, not a production launch preference or a GPU/WebGPU disablement.

## Explicit human setup handoff

Direct connected-UI exploration can hold the same broker and physical capacity
through Entropy's `qa explore start` owner. Its lifetime ends at explicit
cancellation; it starts no browser, creates no target, changes no artifact and
has no QA verdict. Named runs and operator CLI preparation cannot acquire the
profile meanwhile. Exact-session notes retain observation evidence separately
from the recorded historical reload context and current browser identity.

A foreground presentation is still only a display selection. It does not grant
OS focus, change `osFocus: never`, or authorize a native window operation. A
product adapter that needs to place one prepared surface in front of a human
must carry a separate top-level handoff policy and an explicit command-scoped
authorization. That authorization must not be inferred from `human` mode,
headed execution, target activation, or the `foreground` preset.

Entropy's `npm run qa -- setup [site] <feature>` adapter is the current example.
Its five human targets use the managed `authenticated` profile and the
`dev_extension` artifact. Each plan declares exactly
`focus: operator_request_once`, `lifetime: until_explicit_cancel`, and
`cleanup: exact_owned_targets`; only the `setup` command supplies the matching
authorization. Invoking the same `human/*` target through the generic `run`
command is rejected rather than borrowing this authority.

The protocol must first prove the product feature ready on an exact ledger-owned
target. The upper session then correlates that target and tab with its CDP
window receipt, the already-proved managed browser PID, and exactly one visible
native window before making the one bounded focus request. Only a complete
`operator_request_once` receipt permits the product adapter to emit
`QA_HUMAN_SETUP_READY`.

Windows attached identity always includes an exact OS process proof, including
when CDP returns an absolute executable. The command-line tuple remains
authoritative and OS verification supplies the PID required by the window
correlation. Missing or ambiguous OS identity is terminal; this grants no focus
authority to ordinary attached runs.

That marker transfers interaction, not resource ownership. The runner holds the
feature session, browser/capacity leases, and exact target ledger indefinitely;
there is no human-test timer. Ctrl-C at the owning terminal initiates reverse
cleanup: the product adapter sends its typed STOP or dismissal, the target owner
closes and proves absence of only the run-owned tabs, and attach owners
disconnect while preserving the managed browser process and profile. Entropy's
Detour setup constructs its protected-tab set exclusively from those owned
tabs. Its Enso and Detour setups realize the real product UI while explicitly
bypassing detector admission; this changes scenario admission, not browser
ownership or cleanup authority.

## Lifecycle classes

- `external`: the operator owns start, stop, profile, and process. A run may
  attach and disconnect, but never terminate the browser.
- `managed`: `start`/`ensure` may launch one explicitly declared persistent QA
  profile without a startup window. A product session may compile
  `managed_ensure_before_attach` and invoke that idempotent ensure before it
  creates the low-level attach lease; the same lifecycle action remains
  available as a manual preflight. The attach owner still only connects and
  preserves the process. Startup owns rollback until exact identity is ready,
then makes an explicit persistent handoff.
- `per_run`: the run owns launch and reverse-order cleanup.

`ensure` is idempotent only for the exact declared identity. A listening CDP
port alone is not proof. Executable, user-data directory, profile directory,
debug port, and browser epoch are validated where the platform exposes them.
Unclassified or contradictory evidence is a blocking result, not permission
to continue.

Managed startup enables warning/error stderr logging through the canonical
launch spec. The process owner's `chromiumStartupStderr.mjs` retains at most
32 KiB of complete lines (4 KiB per line), redacts the private owner token,
and reports omitted/incomplete lines and stream errors. It does not collect
verbose logs or create a continuously growing Chrome log file. Windows stderr
does not guarantee [sandboxed-child logs](https://www.chromium.org/for-testers/enable-logging/); empty or unavailable output is recorded
explicitly and is never proof that Chrome had no error.

The launch receipt's `readStartupDiagnostics()` snapshots process exit/spawn
state before rollback. On verified handoff, stderr collection stops, retained
data is cleared, and the stream drains without keeping the launching Node
process alive. The pipe is not destroyed during handoff. Native Windows still
detaches the browser, and exact pre-READY rollback ownership remains unchanged.

Lifecycle startup errors retain the last completed readiness inspection, failure
stage, elapsed time, poll count, process snapshot, and rollback/lease-release
outcomes, including when cleanup itself fails. Arbitrary verifier/fetch messages
and endpoint URLs are excluded from this inspection projection. The product
adapter owns durable evidence naming and persistence after cleanup; diagnostics
never participate in browser admission, retry, identity or termination decisions.

Managed launch has two independent absence gates before process creation.
First, the declared `userDataDir` root must have no live Chromium main process,
regardless of executable, `profileDirectory`, debug port, or owner token;
Chromium's process singleton is rooted at the user-data directory. Second, the
declared loopback CDP port must not accept a TCP connection. A process using a
different user-data root is outside this occupancy check. Neither broad check
grants cleanup authority: termination and READY handoff continue to require the
exact executable/profile-directory/debug-port tuple and, for an owned launch,
the private owner token plus OS-process proof.

A managed profile is not trusted merely because configuration labels it
`managed`. The neutral lifecycle requires its product adapter to return a
profile-slot- and user-data-root-bound `dedicated_profile_verified` receipt
before it acquires a lifecycle lease, and rechecks that proof under the lease
before launch and before persistent handoff. The neutral core does not know a
product marker format and never creates a marker automatically. Entropy's
adapter consumes the existing strict `.entropy-e2e-qa-profile.json` validator;
schema 1 remains the valid natural/unprovisioned dedicated QA profile proof.
Missing, malformed, provisioning, or symbolic-link markers block lifecycle
admission rather than falling back to a personal Chrome profile.

The connection-only loopback preflight sends no bytes, has a short bounded
timeout, destroys its socket on every result, and is shared by persistent
lifecycle inspection and product status adapters. An absent port therefore
returns before an HTTP client is created. A reachable port is only an occupancy
signal; the bounded `/json/version` probe and exact identity verifier must still
classify it as the declared browser or block it as invalid.

`managed_ensure_before_attach` is authority for an upper session/orchestrator,
not for Playwright, a broker, or a CDP client. If an implementation releases
its lifecycle reservation before acquiring the attach reservation, intervening
contention must fail loudly and re-run exact admission; it must not retry by
guessing, launch a replacement, or weaken identity proof.

The same rule applies to `per_run` launches. Ephemeral-port allocation is only
a candidate address, never ownership proof. Before the first CDP mutation, the
process owner matches the connected browser's executable, user-data directory,
profile directory, debug port, and private 128-bit spawn token; Linux and
WSL-Windows additionally prove the exact live OS process tuple. Linux pins the
spawned child PID, `/proc` process-start token, executable, and private
capability argument; it does not rediscover ownership by reparsing Chromium's
mutable process-title argv after startup. The full profile/debug-port tuple
remains authoritative through `Browser.getBrowserCommandLine`. If admission
fails, callers disconnect and roll back only the exact spawned process/token.
They must not send `Browser.close` to the unverified endpoint.

Windows Chrome reached through WSL must use a profile slot under
`/mnt/<drive>/...`. Linux-only profile paths are rejected at registry load so
the native Windows process identity and the launched `--user-data-dir` cannot
diverge after path translation.

## Standard agent loop

1. Describe the scenario and compile its browser execution leaves.
2. Inspect the named browser resource; do not mutate during discovery.
3. For `managed_ensure_before_attach`, let the upper session idempotently ensure
   the exact managed slot; manual `ensure` remains an optional standalone
   preflight. For an external slot, return the declared operator action when it
   is unavailable and never start it.
4. Acquire the host-global browser lease before attaching or launching.
5. Verify browser identity and record the browser epoch.
6. Snapshot pre-existing targets, then register every newly created target by
   exact target id and purpose.
7. Run bounded actions and collect bounded, privacy-safe evidence.
8. Close only registered targets and prove absence. Disconnect attach-only
   clients; terminate only run-owned processes.
9. Release resources in reverse order. Incomplete cleanup fails loudly.

For a shared attach or managed browser, that lease consists of independent
locks for the normalized loopback CDP origin and the canonical `userDataDir`
root. `profileDirectory` is still required for exact browser identity, but it
never creates a separate capacity partition: Chromium's process singleton and
the project adapter's profile-adjacent artifact slot are root-scoped.

This sequence is the intended primitive for test loops, real-use inspection,
visual feedback, and future autonomous QA. Scenario-specific behavior remains
outside the runtime.

An adapter may explicitly reserve `shared_capture` capacity for an isolated,
run-owned browser without an extension or persistent profile. The Git-common
project has two process-held capture slots; exclusive owned workloads reserve
both. A capture responder thread keeps live ownership proof available while
source compilation blocks the caller. Unknown owners remain blocking.
The adapter must isolate its server, cache and output, reserve capacity before
preparation, and retain the parent until browser and server cleanup finish.
Playwright accepts a preheld capture reservation only through a private matching
project/mode borrow. Attach-only profile/CDP reservations cannot be partitioned
or converted. Entropy admits only its named `visual_capture` protocol to this
policy; performance claims remain outside shared capture.

Entropy's Feed consumption research is one such adapter. Its suite calls named
`feed/research/*` targets through the upper QA session; it does not attach,
start, focus, enumerate, or close Chrome itself. Each target creates and closes
only its exact scenario target through `ExtensionChromiumHarness`, then the
attach-only owners disconnect while preserving the managed browser and profile.
Scenario-tab activation and tracking admission are a single typed development-only
background request; a helper page never owns post-deactivation polling, and the
request cannot consume OS focus.
Disposable real-site release runs use a separate public-artifact-safe seam: the
owned harness validates its exact target-ledger page and tab, activates that
tab through its trusted extension page, and independently reads back the
active tab. It neither calls the development-only tracking route nor asks the
public bundle to expose one. Tab activation never grants
`chrome.windows.update` or another OS-focus action, and this owned-process seam
does not alter attach-only browser preservation.
For an attach-only headed contract that requires an active visible target while
forbidding steady-state OS focus, an existing page is the default admission
baseline. First-page creation can foreground a new host window independently
of the `focused` API flag, so an empty browser is blocked unless the named
agent target explicitly owns the one-time initial-window capability.
When that capability is compiled, the upper QA session creates one
recovery-journaled `about:blank` anchor, accepts the unavoidable first-window
foreground side effect once, and immediately minimizes the exact declared
Windows Chrome window without calling `SetForegroundWindow`, moving the
cursor, or synthesizing input. The session proves Chrome is no longer
foreground, keeps that owned anchor alive for the protocol, and closes only
that exact target during reverse-order cleanup. Human runs never inherit this
capability. Targets that expose `allowInitialWindowFocusOnce`, including Feed
research and VideoSkip, enable it by default so `qa run` is self-contained in an
empty managed browser. An explicit false value requests a strictly focus-free
start; agents must not inject that restriction merely because steady-state
`osFocus` is `never`.
All child protocols retain `osFocus: never` after bootstrap.
All WSL Windows agent runs compiled as attach-only `osFocus: never` then compare
Chrome's main window with
`GetForegroundWindow` at bounded checkpoints. They block an already-foreground
baseline and fail if later harness start, target activation, or protocol work
brings Chrome back to the foreground. The upper session checks once more after
all exact protocol targets close while an optional minimized anchor still owns
the main window, then closes that anchor before releasing the attach lease.
These observers never share the toolbar driver's focus- or click-consuming
operations.
The adapter reports attached-browser collection status separately from its
research verdict. Real admission remains untouched. The content-free
`mature_session_feed_horizon_opportunity` projection explicitly assumes an
inhibitor-free confirmed-advance seam and clears time/spawn-policy blocks so
detector/endpoint admissibility can be inspected without waiting eight minutes
or changing production state. It is not observed gate-timing evidence.
The run ledger preserves DOM opportunity reasons and runtime advance/surface
coverage, including a single DOM-owned TikTok ArrowUp/ArrowDown retry when a
desktop wheel input is performed but does not advance the dominant item. Matrix
reports classify geometric collisions by journey intervention semantics and
reproject candidate thresholds offline. Personal dwell references remain
explicitly detector-invariant research metadata.
The fixed `feed/research/x-completion` target resumes the three bounded X
journeys and runs one canonical TikTok feedback-only canary while the same
upper-session anchor is still owned, avoiding another first-window cycle.

## Extraction path

The current milestone establishes the dependency direction and stable data
contracts. A future standalone tool can add, in order:

1. a package-level public API and generic CLI over the existing neutral owners;
2. adapter packages for project catalogs and evidence stores;
3. an agent skill that invokes the CLI/API rather than reconstructing Chrome
   flags or CDP calls in prompts.

Crash recovery must never become a URL sweep or a broad browser cleanup. Until
an adapter supplies durable identities, an uncatchable owner death may leave a
run-owned Chromium process or owned target behind even though its process-held
capacity lock is released. Normal cleanup retains failed in-memory ownership
records and reports an incomplete release; neutral owners still classify
unknown residual processes or targets instead of guessing, scanning by URL, or
terminating them. A managed persistent process that already completed exact
handoff is intentionally preserved and is not crash residue.

The Entropy adapter now supplies that durable layer for upper QA runs. It writes
a restricted run journal containing runner identity, exact lock tokens, browser
epoch, per-target nonce proof, and—when `ExtensionChromiumHarness` owns the
browser—the private process-owner tuple. `npm run qa -- recovery inspect`
remains read-only and denies automatic mutation. The explicit `npm run qa --
recovery recover <run-id>` path first proves the original runner absent, then
re-acquires the declared broker/capacity and revalidates every identity. It
preserves attached managed Chrome, closes only exact nonce-proven targets, and
terminates only an exact run-owned owner-token process. Older runs without this
journal remain diagnostic-only.

## Native Windows execution

The named installation platform `windows` runs the existing Windows Chrome
process, profile, CDP, recovery, and OS-focus contracts directly from Node on
Windows. `windows_via_wsl` retains explicit WSL path translation. Platform
classification and PowerShell selection are owned by
`scripts/browser-qa/browser/windowsPlatform.mjs`. Native Windows paths are
absolute drive paths; they are never passed to `wslpath`. Both Windows modes
use exact CIM executable/profile/debug-port proof and the same nonce-bound
cleanup. The focus guard and initial-window anchor apply to both modes. See
`docs/operations/runbooks/windows-native-development.md` for workstation setup.
