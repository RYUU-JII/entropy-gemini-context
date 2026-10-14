const GENERAL_HELP = `Entropy QA

Usage:
  npm run qa -- <command> [arguments] [options]

Named verification (no manual browser preparation required):
  npm run qa -- describe <target>
  npm run qa -- run <target> [target options]
  npm run qa -- report <run-id>

Connected exploration (prepare only when needed):
  npm run qa:open
  npm run qa:reload
  npm run qa -- explore
  npm run qa -- explore start

Human feature handoff:
  npm run qa -- setup [site] <feature> [feature options]

Agent mode is the default. Run includes preflight; doctor is optional.
Use list --family=<family> or describe <target> when choosing a new target.
Functional checks and public-site automation use owned headless targets when
declared. Persistent login, physical foreground and human prompts need their
specific contracts. Initial focus is opt-in for a new process only; never
refocus an existing browser or switch profiles to repair a missing prerequisite.
Hidden uses an owned headless process; background attachment keeps the declared
headed Chrome for Testing profile. Personal Chrome requires an explicit user comparison.

Discovery:
  list [--family=<family>]     Find a target
  describe <target>            Show accepted options (--json for full contract)
  doctor <target>              Optional environment/artifact diagnosis

Advanced inspection: browser inventory, artifact status, recovery inspect,
retention inspect. Lifecycle and recovery actions are in their command help.

Use "npm run qa -- help <command>" for details.
`;

const COMMAND_HELP = Object.freeze({
  list: `Usage: npm run qa -- list [--family=<family>] [--json]

Lists immutable target manifests. Family filtering is optional.
`,
  describe: `Usage: npm run qa -- describe <target> [--json]

Prints browser requirements, native observation, initial-focus default and
accepted options. Add --json for the full contract and resource claims.
`,
  doctor: `Usage: npm run qa -- doctor <target> [--mode=<mode>] [target options] [--json]

Optional read-only diagnosis; run already performs fresh admission. Agent mode
is the default. Compiles the same mode and target parameters as a real run, inspects the named
environment, and reports whether the canonical artifact will be reused, built,
blocked, or delegated to a declared child protocol. Doctor never starts a
browser, creates a tab, or builds an artifact.
The compact result shows the compiled browser execution and exact initial
preparation policy. OS focus, document visibility and tab activation are
separate; a visible document or headed presentation grants no focus by itself.
`,
  browser: `Usage:
  npm run qa:open
  npm run qa:reload [-- --rebuild]
  npm run qa -- browser inventory [--json]
  npm run qa -- browser status <environment> [--json]
  npm run qa -- browser start <managed-environment> [--timeout-ms=<ms>]
  npm run qa -- browser ensure <managed-environment> [--timeout-ms=<ms>]
  npm run qa -- browser open <managed-environment> [--timeout-ms=<ms>]
  npm run qa -- browser page <managed-environment> [--url=<http(s)-url|about:blank>] [--timeout-ms=<ms>]
  npm run qa -- browser shortcut <install|validate> [--json]

Inventory and status are observation-only. Start and ensure accept only a
declared managed_persistent environment and never request OS focus. Open is an
explicit operator action for declared managed Windows Chrome: it ensures the
browser, creates a blank page only when none exists, makes the window visible,
requests focus once, and hands the page to the operator. Page always creates
one exact new tab, optionally navigates it without invoking a product QA
protocol, requests the same bounded operator focus, and hands that tab off.
The managed profile's installed extension remains enabled.
qa:open uses browser page authenticated --url=about:blank for manual/exploratory testing in the
same persistent Chrome for Testing profile. qa:reload runs qa/extension-reload:
it prepares the current development artifact through the existing owners,
reloads when preparation has not already refreshed runtime, verifies the live
background build/readiness, then closes only its own helper tabs. Existing
settings, site logins and tabs persist. Refresh the site after extension reload.
For an operator-approved invalid settings.core.nudgeConfig development profile,
run maintenance/profile-reset --confirm-erase-entropy-data through the QA run
command. It erases Entropy data through the canonical reset/Dashboard ACK and
requires fresh exact recovery evidence plus strict replacement-worker readiness.
Security/passcode refusal stays terminal; ordinary qa:reload never resets data.
Shortcut is the exact Windows desktop-link owner for the default
browser page authenticated --url=about:blank operator action. Install writes
only that exact link through a staged replacement; validate is read-only.
`,
  artifact: `Usage:
  npm run qa -- artifact status [--json]
  npm run qa -- artifact pin [--json]
  npm run qa -- artifact release --pin-id=<exact-pin-id> [--json]

Pin preserves the existing dist path, extension identity and settings. It keeps
that complete publication for ordinary Chrome real-use exploration while builds
and automated QA consume the separately published latest artifact. It persists
until explicit release; release requires the exact pin ID and promotes latest.
Pin and release require an operator extension reload and site refresh. These
commands never launch a browser or change its profile/settings, and issue no QA
verdict. Status is observation-only. Corrupt state fails explicitly.
`,
  recovery: `Usage:
  npm run qa -- recovery inspect [--json]
  npm run qa -- recovery recover <run-id> [--json]

inspect is observation-only and exits 2 when evidence needs attention. recover
refuses a live runner, mismatched browser epoch, undeclared profile, or target
nonce mismatch. It preserves attached browser processes and mutates only exact
journal-owned targets, owned browser processes, and resource locks.
`,
  retention: `Usage:
  npm run qa -- retention inspect [--json]
  npm run qa -- retention prune [--json]
  npm run qa -- retention pin <run-id> --reason="Why this evidence matters" [--json]
  npm run qa -- retention unpin <run-id> [--json]

Inspect is observation-only. Default policy: 7 days, newest 3 runs per target,
24-hour grace, 10 GB (10,000,000,000 bytes) admission budget. Expired or surplus completed runs are
eligible; oldest completed runs can also be selected to meet the budget.
Pins, incomplete cleanup and unsafe trees stay protected. Prune explicitly
deletes eligible run directories and writes a receipt. Pin requires a reason.
New runs above budget are blocked until evidence is pruned or pins are reviewed.
No worktrees, research reports, profiles, build slots or source files are pruned.
`,
  setup: `Usage:
  npm run qa -- setup <feature> [feature options]
  npm run qa -- setup <site> <feature> [feature options]

Prepares the authenticated QA browser with the real dev extension, opens only
run-owned tabs, activates the requested product feature, focuses the exact
target window once, and prints QA_HUMAN_SETUP_READY. The default site is
YouTube. The runner keeps ownership until Ctrl-C, then stops the feature and
closes only its own tabs. Use list --family=human to see canonical targets and
describe the selected target to see feature-specific options.
`,
  run: `Usage: npm run qa -- run <target> [--mode=<mode>] [target options]

Agent mode is the default. Run performs preflight and prints a compact evidence
summary after QA_RUN_COMPLETE. Use describe for an unfamiliar target; doctor is
optional when diagnosing environment or artifact cost. No separate build is
needed for targets whose artifact owner builds on demand.
`,
  explore: `Usage:
  npm run qa -- explore [--comparison=regular-chrome] [--json]
  npm run qa -- explore start [--json]
  npm run qa -- explore note <session-id> --actions=<text> --observation=<text> --uncertainty=<text> [--json]
  npm run qa -- explore show <session-id> [--json]
  npm run qa -- explore recover <session-id> [--json]

Default inspection is read-only: it shows the declared CfT authenticated profile,
current browser identity/resource use and the latest exact reload evidence.
Past reload evidence never proves the current live build. Regular Chrome dist
pins are inspected only for the explicit comparison option.
Start reserves the already-running exact CfT profile through the canonical
broker/capacity owners until Ctrl-C. It never launches, reloads or closes browser
tabs/processes. Prepare with qa:open / qa:reload before start when needed.
Verify the exact connected browser profile/tab separately, then use the existing
browser tool. Note stores bounded actions/observation/uncertainty in that active
session's evidence. Show separates recorded READY from current ACTIVE,
ABANDONED or UNVERIFIED using runner start identity and exact resource claims.
Recover requires the original runner to be proved absent and the exact broker/
capacity to be exclusively available. It writes a separate recovery receipt,
preserves the original session/notes and browser, and refuses foreign owners.
Older pid-only evidence stays UNVERIFIED and cannot authorize recovery.
No action issues a named QA verdict. Read docs/operations/qa/agent-qa-workflow.md
for reusable patterns.
`,
  report: `Usage: npm run qa -- report <exact-run-id> [--json]

Reads only this run's bounded evidence. Shows its recorded verdict, cleanup,
first-frame degradation, measurement limits and evidence gaps. Never guesses a
latest run or upgrades exploratory observations to a release PASS. Exit codes
follow the recorded verdict: PASS=0, FAIL=1, BLOCKED=2, INCONCLUSIVE=3.
`,
  help: `Usage: npm run qa -- help [command]

Shows general help or details for one public command.
`,
});

export const ENTROPY_QA_HELP_TOPICS = Object.freeze(Object.keys(COMMAND_HELP));

export function renderEntropyQaHelp(topic = null) {
  if (topic === null) return GENERAL_HELP;
  const normalized = typeof topic === 'string' ? topic.trim() : '';
  const help = COMMAND_HELP[normalized];
  if (!help) throw new Error(`QA_CLI_HELP_TOPIC_UNKNOWN:${normalized || 'missing'}`);
  return help;
}

export function formatEntropyQaUsageError(error) {
  const message = error instanceof Error ? error.message : String(error || '');
  const code = message.split(':', 1)[0];
  const detail = message.slice(code.length + (message.includes(':') ? 1 : 0));
  return `${code}${detail ? `: ${detail}` : ''}\nRun "npm run qa -- help" for usage.\n`;
}

export function isEntropyQaUsageError(error) {
  const message = error instanceof Error ? error.message : String(error || '');
  return [
    'QA_CLI_',
    'QA_HUMAN_SETUP_',
    'QA_OPERATOR_HANDOFF_',
    'QA_TARGET_',
    'QA_RUN_MODE_',
  ].some((prefix) => message.startsWith(prefix));
}
