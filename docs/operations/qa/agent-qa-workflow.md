# Agent QA workflow

- Status: Active
- Owner: runtime QA / release operations
- Last validated against code: 2026-10-14
- Path policy: current-only
- Canonical for: agent QA entrypoint selection and direct-exploration patterns

## Choose the smallest useful path

Use direct exploration for an unfamiliar symptom, UI review, or a one-off user
journey. Use a named target when its existing assertions answer the question,
or when repeatability and controlled fixtures matter. A new investigation does
not require a new target, protocol, test, or full release gate.

For named verification, the run owns preparation; `qa:open`, `qa:reload` and a
connected browser session are not prerequisites:

```powershell
npm run qa -- describe <target>
npm run qa -- run lifecycle/mv3 --presentation=hidden
npm run qa -- report <exact-run-id>
```

Connected exploration instead uses `qa explore` for read-only inspection and
`qa explore start` for the held session described below. `qa:open` and
`qa:reload` prepare that persistent browser only when the exploration needs it.

`explore` inspects the declared CfT identity and resource occupancy and prints
historical reload context. That receipt does not prove the current live build.
It does not open a browser, acquire a session, or issue a QA verdict. An explicit
`--comparison=regular-chrome` adds the comparison dist-pin check. Control
the declared persistent Chrome for Testing through the existing connected browser tool. Confirm its exact
`authenticated` profile/tab against the [browser roles](../runbooks/windows-native-development.md#browser-roles)
once per connection; reconnecting or changing profiles requires a fresh check.
Use `qa:reload` to admit/stage the complete development artifact into the same
persistent profile and prove its live build. Source builds do not replace that
slot until the next canonical preparation. Preserve any existing regular-Chrome
dist pin across turns unless explicitly ending that comparison.

When the operator requests browser launch or extension reload, use `npm run
qa:open` or `npm run qa:reload` for the same persistent CfT QA profile. Reload's
named verdict covers infrastructure activation/readiness, not the product
journey. Refresh tested site tabs afterward. `qa browser status authenticated`
is read-only. Before connected UI actions, run `qa explore start` and keep its
runner alive: it verifies the already-running profile and holds the existing
broker/capacity until Ctrl-C, excluding named runs on that browser. It starts
no browser and changes no tab or artifact. Stop this runner when the exploration
ends; its cleanup preserves operator tabs and the persistent process.

An operator-approved invalid `settings.core.nudgeConfig` development profile can
use `qa run maintenance/profile-reset --confirm-erase-entropy-data` through the
canonical full-reset and Dashboard ACK owners. It verifies fresh exact recovery
evidence before erasure and strict fresh-worker readiness afterward. This explicit
maintenance action erases Entropy data; ordinary reload and diagnostic failures
never authorize it. Security/passcode refusal remains terminal. See the
[reset runbook](../runbooks/pre-release-development-profile-reset.md).

`run` defaults to agent mode and performs fresh artifact/environment/resource
admission. A separate `doctor` or manual build is optional. For a new target,
`list --family=<family>` and compact `describe <target>` show browser requirements,
native observation, the initial-focus default and accepted options;
`describe --json` retains the full contract. `doctor` is useful for diagnosing a
blocker or predicting artifact work without starting anything. Its compact
output shows compiled process ownership, headless/presentation state, visibility,
activation, OS focus and the exact initial-window policy. These fields describe
separate effects; a visible document is not proof of physical foreground use.

`run` emits `QA_RUN_COMPILED` with its exact run ID and evidence root before
resource admission. This identifies a pending run for bounded phase observation;
it is neither READY nor a verdict. `run` preserves the exact `QA_RUN_COMPLETE` marker and prints a short evidence
summary. `report <run-id>` reopens that exact run without rerunning it. It shows
the recorded status separately from cleanup, degradation, measurement limits,
and evidence gaps. Use `--json` only when structured output helps. Read raw
attachments when the summary leaves a relevant uncertainty; inspect decisive
images when appearance matters.

## Headless execution and secondary monitors

Choose the target from the evidence the task needs, then honor its declared
environment. A real website does not by itself require a persistent profile or
a physical window.

`hidden` starts an owned headless browser with no host window. `background` on
an attached browser keeps the existing headed process and avoids taking OS
focus; it does not turn that process into headless. `osFocus: never` and tab
activation likewise do not decide whether a physical window exists.

| Evidence needed | Browser choice |
| --- | --- |
| Functional rendering, settings, delivery, cancellation or duplicate prevention, including public real sites | Prefer a declared owned `ephemeral` headless target. Require actual document/renderer readiness and ordinary recorded facts where the scenario needs them. This does not certify physical OS foreground, human consumption or a physical display. |
| Persistent login, an existing account/session or an explicitly declared attached-site contract | Use the exact `authenticated` profile and preserve its process, login and tabs. An existing headed process cannot be changed into headless or copied to bypass the target contract. |
| Production physical foreground consumption, native-window behavior or physical GPU certification | Use the target's declared native observation and measurement environment. Missing focus/frame/tracking evidence stays unavailable; do not emulate or refocus to repair it. |
| A person tries a feature, direct desktop interaction or a real permission prompt | Use the declared human/setup/prompt owner and its displayed surface. READY is a handoff, not an automated PASS. |

Personal or regular Chrome is used only for a comparison explicitly requested by
the user, through its documented comparison path. It is never a replacement for
an unavailable declared QA browser. If a public site needs login or challenges
the disposable run, retain the unavailable evidence rather than switching profiles.

Automated run-owned targets that admit headless rendering default to
`presentation=hidden`. This includes source-render screenshots, Dashboard
boot/capture with required WebGL, settings concurrency/propagation, the
integrated protection journey, the fixture-driven Gate runtime and the public
real-site goal-end lifecycle target. Native
document visibility, real input outcomes, renderer readiness and required
WebGL remain assertions; hidden execution must not spoof OS focus or replace
the renderer. Record presentation/GPU context when comparing boot timings.
If a required capability is unavailable, report the exact failure instead of
silently reopening the test headed. An explicit headed investigation is available
only where the target admits that presentation; it does not expand the evidence scope.
`consumption/goal-ends` and `intervention/goal-ends` declare `rendering: headless_required`: their accepted
presentation is only `hidden`. Both `foreground` and `background` reject during
compilation, before browser/resource preparation. This policy compiles to
the existing renderer capability plus explicit headless/no-display/no-focus leaves;
it adds no separate browser lifecycle or focus authority.

Choose `consumption/goal-ends` when ordinary native Tracking collection is part
of the assertion. Windows idle may block it; CDP interaction does not create OS
input. Choose `intervention/goal-ends` for goal delivery, duplicate prevention
and cancellation using explicitly synthetic canonical budget facts. The latter
keeps real site/input/paint/recovery assertions and certifies no natural time
collection. Preserve each run's own verdict; a functional PASS cannot replace an
ordinary collection failure. Neither target requests a physical window or asks
the operator to keep generating input for functional verification.

Automated initial focus is OFF by default. An explicit
`--allow-initial-window-focus-once=true`, where declared, can authorize only the
run's newly started process through its existing preparation owner. An already
running process, retry, poll or new tab receives no refocus grant. Owned headless
runs have no OS-focus action even if such an option is supplied. If a native
foreground prerequisite is missing, stop with the exact unavailable state.
Explicit `qa:open`, `browser page` and `qa setup` operator handoffs remain
separate actions; they are not automatic preparation for named verification.

Headed native-Windows launches and the existing single initial/operator focus
preparation prefer a connected secondary monitor. The launch/window owners
record selection and any placement change; a single display keeps its current
placement. Observation, polling, retries and test measurements never move or
refocus a window. Existing external/personal windows remain operator-owned.
Connected direct UI work uses a secondary monitor when its tool supports it;
Windows mouse/keyboard input is still shared across monitors.

The remaining headed cases have different reasons:

| Case | Why hidden execution is not admitted |
| --- | --- |
| `human/*`, `qa setup`, connected human/direct UI work | A person or desktop-control tool needs a displayed surface. |
| `settings/permissions` | The test requires a real browser permission prompt and human denial/reapproval; pregranting would change the assertion. |
| `gate/entry-checkpoint/consumption`, `consumption/protected-sites --scope=journey`, `dashboard/sites-stored-reading-refresh` | They certify production focused consumption or stored foreground collection time. A headless document's visibility/focus is not evidence of a real foreground browser window. |
| Existing `authenticated` attach-only targets: Feed, Sentinel, audio, real-site video, corpus checks, reload/runtime stability and maintenance | They attach to the exact running persistent browser and preserve its login/profile/process. A running headed process cannot be switched to headless; duplicating or replacing its profile is not authorized by a test. This is a lifecycle constraint, not a claim that all site behavior intrinsically needs a window. |
| Explicit `dashboard/boot` `dawn-eager` GPU-startup research | This experiment's launch contract is headed-only. Request a headed presentation for that experiment; ordinary boot/capture stays headless. |
| Physical-display/foreground or physical-GPU release certification | Use only the target's declared measurement environment. Headless rendering alone does not certify the physical display path or the same performance baseline. |

## Local output lifecycle

Capture only decisive states for ordinary exploration. Optional screenshot
streams stay off unless needed to answer a visual question. Preserve the named
target's required evidence; do not weaken its assertions to save disk space.
Use `qa retention inspect` at task close; when eligible completed QA runs exist,
use `qa retention prune` through the canonical evidence owner. Default retention
is seven days/three completed runs per target, a 24-hour grace and a 10 GB
admission budget. Important evidence needs an explicit reasoned `retention pin`.
The user approved 10,000,000,000 bytes on 2026-10-12; this is the shared default,
not a per-run override.
Incomplete cleanup and unsafe trees require owner review, not forced deletion.

New one-off research raw output belongs in a task-specific `.artifacts` directory,
not `reports`. Prefer small conclusions/reproduction instructions in `reports`
when useful. At task close, identify raw output as disposable or give an explicit
reason to preserve it. Do not commit bulk captures/specimen output by default.
Existing research archives and dirty worktrees are not retroactively disposable;
use their owning contract and Git lifecycle before removal. Do not use hardlinks
or remove individual attachments to shrink immutable QA evidence in place.

## Reusable exploration patterns

| Question | Smallest useful pattern |
| --- | --- |
| UI or interaction feels wrong | Reproduce in the connected profile, inspect the visible state, capture the decisive screen, change one thing, repeat the same actions. |
| Setting does not reach another surface | Change through the actual UI, observe the existing content/dashboard diagnostics and visible effect. Record acknowledgment and observed state separately. |
| Reload, navigation, or worker wake loses state | Explore the trigger, then use an existing lifecycle target for repeatable state/cleanup assertions. |
| Renderer is slow or degraded | Record build, viewport, visibility, GPU and warm-up context. Use the owning render/boot target for comparable measurements. A screenshot alone proves no performance claim. |
| Reset/import or storage ownership is suspect | Use the existing isolated data-lifecycle target and typed boundary evidence; avoid destructive exploration in a real-use profile. |
| Human wants to try a prepared feature | Use `qa setup [site] <feature>`. Keep its runner alive after READY; stop it only on the person's request. |

Record only the useful facts: build/pin, actions, observation, decisive evidence,
and remaining uncertainty. `qa explore note <session-id> --actions="..."
--observation="..." --uncertainty="..."` records them while the exact session
owner is active; `qa explore show <session-id>` reopens its bounded evidence.
Evidence lives in `.artifacts/qa/explorations/<session-id>` and has no named QA
verdict. Connected-tool profile verification remains necessary. Promote
a pattern into a named target when it repeatedly catches a regression or needs
deterministic cleanup, not merely because an agent executed it once.

After an unexpected runner exit, `qa explore show <session-id>` keeps the
recorded READY separate from the observed ACTIVE/ABANDONED/UNVERIFIED state.
Use `qa explore recover <session-id>` only for that exact abandoned session.
It proves the original runner absent and exclusive broker/capacity availability
through their canonical owners, preserves the browser and original evidence,
and records a separate recovery receipt. A foreign successor remains protected;
end its own session before recovering the old one. Historical PID-only READY
records cannot authorize recovery. RECOVERED describes reconciliation, not a
new QA verdict or live browser proof.

## Ownership

The CLI loads only the selected command's owners. Exploration guidance lives in
`scripts/qa/cli/qaExplorationGuide.mjs`; session/evidence ownership lives in
`scripts/qa/exploration/`; exact-run summaries live in
`scripts/qa/evidence/qaRunReport.mjs`. Guidance and summaries own no browser actions or changes
the canonical verdict. Browser/artifact/evidence lifecycle owners remain in the
[control plane](entropy-qa-control-plane.md) and [browser QA foundation](../../../scripts/browser-qa/README.md).
No additional exploration server, action DSL, automatic retries, or scheduler is
required. Preserve profile identity, pinned artifacts, exact owned cleanup and
storage/security boundaries; procedural shortcuts do not change those owners.

Source-render visual captures use the finite server in
`scripts/dev/visual-harness/visualHarnessServer.mjs`. It disables HMR and
filesystem watching: a capture does not need to crawl generated build, trace or
browser-profile directories. Source changes take effect in a new run. The
awaited loopback-port reservation remains referenced until its bind/close
handshake settles; the run owns server shutdown through its existing lifecycle.
