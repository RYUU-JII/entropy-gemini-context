# Native Windows development

- Status: Active
- Owner: local development / browser QA
- Last validated against code: 2026-10-08
- Path policy: current-only
- Canonical for: Native Windows toolchain, checkout paths and local browser roles
- Canonical checkout on this workstation: `C:\Users\113ji\projects\Entropy`
- WSL migration archives: `C:\Users\113ji\projects\WSL-archive-20260905` (Ubuntu was unregistered after backup verification)

## Toolchain

Use native Git and the Node version in `.nvmrc` (24.14.0). The migration installed
an isolated official Node distribution with npm 11.18.0 under
`%LOCALAPPDATA%\Entropy\node-v24.14.0-win-x64`. It did not replace system Node.
The machine-local `.codex/config.toml` supplies that directory first in PATH for
agent commands. It is excluded through `.git/info/exclude`.

In a new PowerShell terminal, initialize this session before npm commands:

```powershell
. .\scripts\dev\enter-windows.ps1
npm.cmd run doctor:runtime
npm.cmd run build
```

`npm.cmd` avoids depending on PowerShell script execution policy. To use the
prepared environment without loading a PowerShell script, open
`.artifacts\windows-migration\Open-Entropy-Terminal.cmd`.

Do not share `node_modules` with WSL. Install with `npm.cmd ci`. Clean verification
worktrees also install their own native dependencies so emitted module inventories
retain dependency ownership. `scripts/installGitHooks.mjs` resolves the hook
directory through `git rev-parse --git-path hooks`, including linked worktrees
and `core.hooksPath`; `.git` may be a file rather than a directory. Environment
assignments in package scripts go through `scripts/dev/run-with-env.mjs`, which
uses the current Node executable and npm CLI without a platform shell.

`run-local-command.mjs` and `run-fast-test-file.mjs` share
`scripts/dev/localCommandRunner.mjs`. It accepts only `node`, `vite`, and
`vitest`, launches the current Node executable with the checkout's installed
JavaScript CLI entrypoints, and always uses `shell: false`. Working directory,
environment, inherited input/output, and child exit/signal propagation stay with
the existing wrappers. Arguments containing `&`, `|`, or `%` are literal values;
do not add shell escaping or execute Windows `.cmd` shims through these wrappers.

Tailwind 4 is compiled by `@tailwindcss/vite` in the extension, visual harness,
and pond research host. There is no root PostCSS or autoprefixer pipeline.
The landing uses its app-owned CSS without Tailwind. The shared
`src/themes/styles/tailwindTheme.css` explicitly loads `tailwind.config.js` and
scans only product `src` templates. Dashboard includes preflight; Gate loads
utilities only. `npm.cmd run test:file:fast -- tests/tailwind4ThemeContract.test.js`
checks the compiled CSS contract without starting a server or writing a bundle.

Extension and landing Vite development/preview servers bind to `127.0.0.1`.
They are local development tools and must not be exposed to a LAN or public
interface. This reduces development-server reachability alongside toolchain
security updates. A deliberate network preview requires a separate review
of the toolchain version, served files, and access boundary. Do not pass
`--host 0.0.0.0` or change the bind as a routine preview workaround.

## Codex desktop cutover

In Settings > General, choose **Windows native** for **Agent environment**.
The integrated terminal shell is an independent setting; select PowerShell.
Open `C:\Users\113ji\projects\Entropy` as the project. An already running WSL
task does not turn into a native Windows process when repository files move.
Verify `node -p process.platform` prints `win32` in the new native task.
Then set up Chrome under Computer Use and enable full CDP access under Browser
if interactive developer inspection is needed. Connection and MV3 target access
must be verified in that native task.

## Browser QA

Use the same `npm.cmd run qa -- ...` control plane. The machine-local
`.artifacts/entropy-qa.local.json` declares native drive paths and installation
platform `windows`. The existing dedicated Chrome for Testing installation and
profile remain at `C:\EntropyQA`; credentials and profiles are not copied.
The native adapter uses the existing Windows CIM process tuple proof, owner
nonce, profile occupancy, CDP identity, focus guard, and exact-target cleanup.
Only WSL execution uses `windows_via_wsl` and `wslpath` conversion.

```powershell
npm.cmd run qa -- browser inventory
npm.cmd run qa -- browser status authenticated
npm.cmd run qa -- browser ensure authenticated
npm.cmd run qa -- browser page authenticated --url=about:blank
```

Inventory and status are read-only. Ensure/start are explicit lifecycle actions;
page/open and `qa:open` are explicit operator-focus requests. Automated target focus
opt-ins default to false. Even explicit `--allow-initial-window-focus-once=true`
can prepare only a managed process newly started by that same QA run; attaching
or retrying an already running process never creates a focus anchor or restores,
minimizes, moves or refocuses its window. Missing native focus stops the test
without repair. Actual headless runs never touch OS focus or use a headed retry.
Browser shortcut installation
uses the native Node executable and this checkout on Windows. Native Windows
headed execution uses the Windows desktop and prefers a connected secondary
monitor at launch or the single initial/operator presentation; a single monitor
keeps its placement. Headless-capable automated targets default to hidden
execution, including Dashboard WebGL capture. There is no implicit Linux/Xvfb
substitution. Existing observation-only attached windows are not repositioned
during steps; use the canonical operator preparation when placement is needed.

## Browser roles

For automated QA, the named target in `scripts/qa/catalog/qaTargetRegistry.mjs`
selects `environmentId`; local configuration resolves that environment to its
installation/profile and the compiler produces its ownership contract. Use
`describe` for an unfamiliar target; `run` performs fresh preflight and separate
`doctor` is optional. Start with the [agent workflow](../qa/agent-qa-workflow.md)
for direct exploration and reusable investigation patterns. Being an automated or repeatable check
does not by itself select `authenticated`. The environment classes are defined
in [Entropy QA control plane](../qa/entropy-qa-control-plane.md#environment-classes).

| Purpose | Browser and identity | Control and evidence |
| --- | --- | --- |
| Named QA requiring persistent login or the managed authenticated session | Chrome for Testing; declared `authenticated` environment; `C:\EntropyQA\site-e2e-profile`, `Default` | Only `npm run qa -- ...`; attach to the exact declared identity and preserve the persistent process/profile |
| Isolated extension fixtures, including `dashboard/boot` and `dashboard/capture` | Declared `ephemeral` environment; configured Chrome for Testing installation with a fresh run-owned profile/process | Only `npm run qa -- ...`; protocol owns fixture state and exact reverse cleanup; never reuse `authenticated` or personal profiles |
| Render-only scene capture | Declared `visual` environment; configured Chrome for Testing installation with a run-owned browser | Only `npm run qa -- ...`; screenshot evidence does not certify extension runtime behavior |
| Clean release/lifecycle checks whose target declares `release` | Declared `release` environment; configured Chrome for Testing installation with a clean run-owned profile/process | Only `npm run qa -- ...`; use the target's public artifact and exact cleanup contract |
| Manual real-use checks, login-dependent exploration and operator-visible reproduction | The same Chrome for Testing `authenticated` environment; `C:\EntropyQA\site-e2e-profile`, `Default` | `qa:open` / `qa:reload` prepare through the canonical owners; direct UI exploration uses the connected ChatGPT browser extension in this exact profile; observations are exploratory evidence, not an automated product QA PASS |

All automated roles preserve their declared visibility, focus, artifact and
cleanup requirements. A shared Chrome installation does not imply a shared
profile. Do not override a target's environment, attach it to a different
profile, or replace an unavailable browser to get a passing run.

The former regular-Chrome `Entropy QA` profile is retained as operator data,
not the default real-use testing surface. Its executable is `C:\Program Files\Google\Chrome\Application\chrome.exe`.
Its `Profile 2` shares the regular Chrome user-data root with other personal
profiles. It is not a separate managed user-data root and must not be registered
as the QA `authenticated` slot, started with a guessed CDP port, copied into the
CfT profile, or given the QA dedicated-profile marker. Preserve user logins,
settings, tabs and browser processes; do not terminate the shared Chrome process.

For connected UI exploration, discover connected browsers and verify the exact profile
and tab identity before acting. A generic `Chrome` label is insufficient when
multiple profiles are possible. If connection or identity is missing, ask the
operator to connect/open the declared CfT `authenticated` profile; never
substitute regular Chrome's `Default`, `Profile 1`, `Profile 2` or the in-app browser. Use the connected browser tool for this
role, with only the UI actions needed by the user's request. Do not mix that
control with an active automated QA run on the same browser/target.

Manual and automated persistent QA share one browser/profile. Operator commands:

```powershell
npm run qa:open
npm run qa:reload
npm run qa -- browser status authenticated --json
```

`qa:open` delegates to `browser page authenticated --url=about:blank`, preserving
existing pages and creating one blank tab whose exact browser window is presented
once. This target/window correlation also works with multiple existing windows.
`qa:reload` delegates to the named
`qa/extension-reload` target: the artifact/session owners build when needed,
stage the complete artifact into the same profile's canonical extension slot,
activate/reload it and prove the live background's build ID and readiness. If
preparation already refreshed runtime, the protocol avoids another reload;
otherwise it explicitly reloads the same extension through the existing harness.
Its PASS covers only activation/readiness. It writes no product settings, changes
no login state and closes only helper targets owned by the run. Refresh tested
site tabs afterward. Use `npm run qa:reload -- --rebuild` to force a fresh build.
The existing desktop shortcut also opens this CfT profile. Status/inventory are
observation-only. Named QA and direct UI exploration must not overlap on the same
browser. `npm run qa -- explore start` verifies the already-running declared
profile and retains the same broker/capacity during connected UI exploration.
Keep that runner alive and end it with Ctrl-C when finished. `explore note
<session-id>` records bounded observations under the exact active owner;
`explore show <session-id>` reads the evidence. No session issues a named QA
verdict or proves the current live worker from historical reload context.

Initial operator setup in the persistent QA Chrome:

1. Run `npm run qa:open` and `npm run qa:reload`. The CLI verifies the declared
   executable/profile/CDP identity and uses `C:\EntropyQA\site-e2e-profile.entropy-extension-slot`.
2. Install the official ChatGPT browser extension through the desktop app's
   browser setup link, then connect this exact profile and verify that it
   appears in the browser tool inventory.
3. Log in to the sites needed for real-use checks. After future builds, reload
   Entropy in this profile and refresh the page being tested before reproducing.

For an explicitly requested regular-Chrome comparison alongside parallel development builds, keep the same
unpacked path and pin its current complete publication through the canonical
artifact owner:

```powershell
npm run qa -- artifact status --json
npm run qa -- artifact pin --json
```

Record the returned pin ID/build/digest, then reload Entropy in the same profile
and refresh tested site tabs. While pinned, `dist` keeps its exact bytes and
extension identity/settings; builds and automated dev QA use the declared latest
publication. These commands control artifacts only and do not launch or control
a browser. Pinning reuses an already identical complete latest publication only
after build ID, input digest and every artifact byte match under the publisher
lock; otherwise the existing publication transaction applies. The pin survives
process exits and QA cleanup until explicit release:

```powershell
npm run qa -- artifact release --pin-id=<exact-returned-id> --json
```

Release promotes latest to the same `dist` path and requires another operator
reload. For an authorized repair/retest, build and verify latest while pinned,
release the exact current pin and pin the complete publication again before
reload; record the new pin ID. Routine turn cleanup keeps the pin active.
Restart a dev watcher once if it was started before adopting this
publisher version. Pin/release afterward need no watcher restart. See the
[publication lifecycle](../qa/entropy-qa-control-plane.md) for validation,
concurrency and failure recovery ownership.

Setup is only complete after the exact profile connection and the loaded
Entropy runtime have been verified. Finding the profile folder alone does not
prove either. When an exploratory finding needs repeatable verification, add or
use a named QA target through the existing control plane.

## Migration archives

The six pre-migration feature commits are preserved in the archived WSL Git history. Windows preparation
is on `codex/windows-native-migration`. The pre-existing Windows directory was
preserved at `C:\Users\113ji\projects\Entropy-preexisting-20260904`.
The benchmark directories remain frozen. Four tracked Linux research-venv
symlinks are represented by Git as link text (`core.symlinks=false`); recreate
that research environment for Windows before using it. Fourteen tracked
`:Zone.Identifier` download metadata files were removed from the migration
branch and archived with the migration evidence; their history is preserved.

## Development preflight repair

The migration exposed an existing VideoSkip observer-ownership violation on
both platforms. `VideoSkipControlSurfaceRuntime` now consumes the shared
`VideoElementObserver.subscribeMediaMutations` seam supplied by its manager.
There is no per-player observer; late control discovery remains limited to
tracked player scopes. The original structural gate remains enabled.
