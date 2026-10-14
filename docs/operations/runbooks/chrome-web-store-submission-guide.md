# Chrome Web Store Submission Guide

- Status: Active
- Date: 2026-07-29
- Scope: Chrome Web Store submission wording, permission explanations, privacy disclosures, and final release checks
- Owner: release operations / product / security
- Last validated against code: 2026-10-09
- Path policy: current-only
- Canonical for: public Chrome Web Store listing copy and reviewer-facing submission notes
- Related:
  - `docs/decisions/security/selective-host-permission-security-decision.md`
  - `docs/product/dashboard/permission-capability-product-structure.md`
  - `docs/architecture/security/security-surface-reduction-plan.md`

## 1) Review Posture

This guide does not guarantee approval. It reduces avoidable review risk by keeping the public submission aligned with Chrome Web Store policy areas that matter most for Entropy:

1. single purpose clarity
2. narrow permission justification
3. accurate user-data disclosure
4. Manifest V3 self-contained logic
5. no misleading health, medical, security, or productivity claims

Primary official references:

1. Chrome Web Store Program Policies: https://developer.chrome.com/docs/webstore/program-policies/policies
2. Manifest V3 additional requirements: https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements
3. Web Accessible Resources manifest reference: https://developer.chrome.com/docs/extensions/reference/manifest/web-accessible-resources

## 2) Current Release Evidence

Use this evidence in release notes or reviewer notes only when asked. Do not over-explain it in the public listing.

1. Public build profile disables internal experiment and debug UI surfaces.
2. `DebugModePanel` is absent from `dist-prod`.
3. `web_accessible_resources` avoids `use_dynamic_url` while the content loader imports bootstrap ESM chunks from protected pages.
4. Build output is scanned for dynamic-code-like patterns.
5. Public source selection removes Zen VNext/ClassicExperiment imports before
   Rollup graph construction. The packaged artifact and Vite manifest contain
   zero `ZenCoreStatusVNext`, `ZenCoreStatusClassicExperiment`,
   `ZenCoreStatusVNextWorkspace`, or `VNextPreferenceModel` research entries.
6. Background, popup, and dashboard-main static closures are checked from the
   Vite manifest with context-specific file/raw/gzip budgets and forbidden
   artifact inventories. `.vite/entropy-module-inventory.json` records only
   project-relative Rollup `chunk.modules`, so a forbidden module merged into a
   generically named chunk still fails without exposing a user path.
7. `entropy-build-info.json` records schema version, commit SHA, tree SHA,
   dirty boolean, lockfile SHA-256, release profile, and extension target. It
   does not record output directories, user paths, or environment values.
8. The Chrome package declares the reviewed functional artifact floor rather
   than only the oldest storage API floor. Chrome 129 is required for the
   adopted Chromium `scheduler.yield()` capability; the emitted UI also retains
   the earlier Chrome 111 `color-mix()` floor. Firefox and Safari profiles remove
   the Chromium-only manifest floor and require their own explicit scheduling
   support contract before shared runtime use.
9. Public artifacts exclude the offscreen page, audio-capture permissions,
   protected-audio bridge/coordinator modules, and capture API signatures while
   the feature remains research-only.
10. `npm run cws:preflight` is a useful build diagnostic, but it is not the
    submission ZIP owner. Final verification and packaging use a clean commit:

```bash
ENTROPY_CWS_EXTENSION_ID="<frozen-32-character-store-id>" \
ENTROPY_CWS_RELEASE_MODE="first" \
VITE_CHROME_STORE_URL="https://chromewebstore.google.com/detail/<slug>/<extension-id>" \
VITE_SUPPORT_URL="https://<public-monitored-support-route>" \
npm run release:rc
```

For an update, use `ENTROPY_CWS_RELEASE_MODE=update` and also provide
`ENTROPY_CWS_PREVIOUS_VERSION=<currently-published-version>`. The release owner
rejects a Store URL whose final ID differs from `ENTROPY_CWS_EXTENSION_ID`, and
rejects an update whose `src/manifest.json` version is not greater than the
declared published version. `src/manifest.json` is the extension release-version
owner; the private root `package.json` version is tooling metadata, not a Store
version. The clean release commit must already carry exactly one canonical CWS
tag, `cws-v<manifest-version>`; legacy milestone tags are not Store release
identity and `release:rc` does not create or move tags.

The command refuses a dirty tree or dirty build. It performs a clean install,
production dependency audit, asset-rights verification, full quality gate,
landing build, CWS preflight, source lifecycle checks, and then snapshots the
reviewed extension bytes exactly once. The deterministic STORE ZIP is parsed
and extracted without a system `unzip` dependency. Static checks, an unmodified
artifact Chromium smoke, instrumented runtime budgets, and browser lifecycle
checks run against that extracted snapshot. The source build and extracted
snapshot are rehashed before exclusive no-clobber publication. The final ZIP
and SHA-256 attestation, including browser/report evidence hashes, are written
under `.artifacts/cws/` only after every gate passes. The attestation also binds
the exact Store extension ID/URL, first-or-update version identity, and the full
`dist-landing/` tree digest plus per-file inventory. `release:rc` builds and hashes the landing but does
not deploy it; the hosting owner must produce a separate deployment receipt for
that same digest.

Build evidence under the top-level `.vite` directory remains available for
manifest/module/worker ownership checks and is excluded from the submission
payload. `scripts/release/artifactEvidenceBoundary.mjs` supplies the exact shared
directory contract for CWS inventory and global bundle byte measurement. Other
asset directories and all runtime payload bytes retain their existing gates.

Expected key passes:

```text
[security-surface] PASS
[dist-no-dynamic-code] PASS
[content-runtime-browser-contract] PASS
[background-service-worker-contract] PASS
[public-build-debug-surface] PASS
[context-bundle-budget] PASS background: files=<measured> raw=<measured>B gzip=<measured>B
[context-bundle-budget] PASS popup: files=<measured> raw=<measured>B gzip=<measured>B
[context-bundle-budget] PASS dashboardMain: files=<measured> raw=<measured>B gzip=<measured>B
```

Do not copy an older numeric example into a release record. The attestation and
the current gate output own the measured values for that exact commit.

Optional spot checks:

```bash
rg -l "DebugModePanel" dist-prod
node scripts/ci/check-dist-no-dynamic-code.mjs dist-prod
node scripts/ci/check-public-build-debug-surface.mjs dist-prod
node scripts/ci/check-context-bundle-budget.mjs dist-prod
```

The first command should print nothing. The three checker commands should pass.

## 3) Single Purpose

Use this as the Chrome Web Store single purpose statement:

> Entropy helps users browse more intentionally by applying user-controlled, local friction and limits to distracting websites selected by the user.

Shorter variant:

> User-controlled local friction and limits for distracting websites.

Do not describe Entropy as:

1. addiction treatment
2. therapy or medical care
3. guaranteed productivity improvement
4. security protection against malicious sites
5. parental control or employee monitoring

## 4) Public Listing Copy

### Short Description

Recommended:

> Add local friction and limits to distracting sites so you can browse more intentionally.

Alternative:

> Slow impulsive browsing with user-controlled site limits, nudges, and local insights.

Avoid:

1. Break the Simulation
2. Cure addiction
3. Block every distraction
4. Track your browsing everywhere
5. AI productivity monitor

### Detailed Description

Use this structure:

```text
Entropy helps you browse more intentionally.

Choose the sites you want to protect, then Entropy can add friction such as gates, nudges, visual filters, and limits before you continue. Optional insights help you review local browsing patterns and adjust your rules.

Your settings, usage records, and analysis results are processed and stored on your device and are not automatically sent to external services. Choose what to record and change or delete your records in Settings.

Some features need browser permissions. Entropy asks when you use the related feature, such as site protection, activity history, or history and bookmark cleanup.
```

If screenshots have captions, keep them concrete:

1. Choose protected sites.
2. Add friction before continuing.
3. Review local browsing patterns.
4. Manage permissions and local data.

## 5) Permission Justifications

Use the wording below in Developer Dashboard permission justification fields.

### Required Permissions

`storage`

> Stores the user's local settings, protected-site rules, session state, and local usage summaries. This data stays on the user's device.

`tabs`

> Reads the active tab URL and tab changes so Entropy can recognize the current site, apply user-configured rules, and maintain local session timing.

`alarms`

> Schedules local background checks for limits, session updates, and maintenance tasks.

`favicon`

> Displays familiar site icons in the popup and dashboard for user-selected or recently observed sites.

### Optional Permissions

`notifications`

> Shows optional local reminders for protection sessions, limits, or user-enabled status updates. Entropy requests this permission only when the user turns on system notifications.

`scripting`

> Injects Entropy's protection runtime only on sites the user explicitly chooses or grants access to.

`history`

> Enables user-confirmed preview and cleanup of browsing history entries for protected or blocked sites.

`bookmarks`

> Enables user-confirmed preview and concealment or cleanup of bookmarks related to protected or blocked sites.

`idle`

> Improves optional local insights by distinguishing active browsing time from idle time.

`webNavigation`

> Improves optional local insights by detecting navigation patterns such as quick returns and repeated loops.

### Optional Host Permission

`*://*/*`

> Allows Entropy to request concrete site access at runtime for websites the user chooses to protect. Entropy does not expose an all-sites connection path.

## 6) Privacy Policy Requirements

The privacy policy must say what data is handled, how it is used, and whether it is shared.

Recommended core statements:

```text
Entropy stores settings, protected-site rules, local browsing activity summaries, intervention history, and optional cleanup metadata on the user's device.

Entropy uses this data only to provide user-facing features: site protection, friction prompts, limits, local insights, and user-confirmed memory cleanup.

Choose protected-site records, basic records across all sites, or no records before recording begins. You can change the scope, choose activity-history categories, exclude sites, or turn recording off in Settings.

Entropy does not sell user data or use it for advertising. Settings and usage records are not automatically sent to external services.

Entropy does not allow humans to read user data unless the user explicitly provides it for support.

The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.
```

The public page also distinguishes encrypted full backups from readable
activity-history exports, states the limited encryption scope and paused locked
behavior, and separates website hosting logs from extension records.
Site icons use local browser/cache data; do not retain the former remote-icon
request exception. Do not add speculative server or payment plans to release copy.

`scripts/ci/publicPrivacyDisclosureContract.mjs` checks current public disclosure
coverage across README, landing and the privacy page through CWS preflight.
It rejects obsolete remote-icon claims and unscoped encryption/network claims.
Recording choices, deletion, user-directed export sharing and the Limited Use
statement remain required; exact legacy sentences are not the contract.
Manifest CSP and `runtimeNetworkSurfaceContract.mjs` still own runtime enforcement.
The default `cws:preflight` build uses `build:prod`; it must not send a development
publisher command to `dist-prod`.

Be careful with absolute claims. Prefer:

1. "stored locally on your device"
2. "not sold"
3. "not used for advertising"
4. "not sent to an analytics server"

Avoid:

1. "we collect no browsing data" because local browsing-derived summaries exist
2. "anonymous analytics" unless analytics exists and is fully disclosed
3. "zero network access" unless every remote fetch path has been audited
4. "medical-grade" or "clinically proven"

## 7) Data Disclosure Fields

Suggested disclosure posture:

1. Web browsing activity: disclose. After local-analysis consent, Entropy can use active tab, domains, navigation, timing, visits, sessions, and intervention outcomes locally for user-facing protection and insights. `unset` and `later` consent states create no new usage or precision facts.
2. Website content: disclose when the form's definition includes DOM-derived information. Entropy may inspect page structure locally to apply visual filters, content-flow aggregates, and social-metric nudges on protected sites; raw page text and typed contents are not stored as local-insights records.
3. Authentication, financial, health, personal communications: do not claim these categories unless a future feature explicitly handles them.
4. Data sale or advertising use: no.
5. Third-party transfer: no, except user-directed support exports if introduced and disclosed.
6. Deletion/export: state that analytics cleanup and full reset are user actions, exports are generated locally, and exports are never uploaded automatically.

Keep the privacy dashboard, privacy policy, and store listing consistent. Contradictions are review risk.

The public `/support/` page must expose a monitored, publicly reachable contact
or issue URL. A private repository Issues URL, an invented mailbox, or a page
that only points back to the Store listing is not sufficient evidence. Verify
the exact route anonymously before submission.

`VITE_SUPPORT_URL` is the canonical landing support-contact input. Production
landing builds, including the `landing-build` stage of `npm run release:rc`,
fail unless it is either an HTTPS public support route or a syntactically valid
monitored `mailto:` address. Local/private/reserved hosts, placeholder values,
Chrome Web Store loops, and GitHub URLs whose public availability cannot be
proven at build time are rejected. `npm run dev:landing` may omit the value; its
explicit inert development sentinel must never appear in a production output.

## 8) Reviewer Notes

Use this only in the "Notes to reviewer" style field if a reviewer may need context:

```text
Entropy is a Manifest V3 extension. Its core logic is packaged with the extension. The public build does not load remote executable code. User settings, site rules, local browsing summaries, and intervention history are stored locally in Chrome extension storage and IndexedDB.

Host access is optional. The product model uses site-by-site access: when a user protects a website, Entropy requests access for that site so it can apply the chosen friction effects there. Optional permissions such as history, bookmarks, idle, webNavigation, and scripting are tied to user-facing features and are requested from the UI when needed. The public build does not request offscreen, activeTab, or tabCapture; those permissions remain confined to the development-only Suikinkutsu research target.
```

## 9) Screenshot Checklist

Submit screenshots that make the permission story easy to understand:

1. popup on a normal site with a clear protect-site action
2. settings permissions page showing selective access as the default path
3. protected-site friction or gate UI
4. local insights or dashboard view
5. data lifecycle / privacy controls

Avoid screenshots that foreground internal experiment labels, debug controls, console-style diagnostics, or medical claims.

## 10) Web Accessible Resources

`web_accessible_resources` does not grant Entropy access to target websites. It controls which packaged extension files a matching website can request by extension URL.

Current posture:

1. `use_dynamic_url` is intentionally disabled for the current Chrome package because Chrome content-script ESM imports can fail when dynamic web-accessible URLs are enabled.
2. Host access remains governed separately by optional host permissions and Settings consent.
3. The current asset globs support content runtime chunks, content worker bundles, theme visuals, and icons used by in-page protection surfaces.
4. Extension-internal request workers such as crypto and stats are bundled by their owner modules and must not be exposed through raw `src/platform/workers/*.js` web-accessible paths.
5. `src/pages/nudge-render-host.html` is public only as a render container. An arbitrary website parent cannot start its worker: the trusted top-frame content runtime must obtain a short-lived, one-time background capability, the exact render-host frame must consume it, and the command/event data plane then moves to the transferred `MessagePort`.

Future hardening:

1. inventory the exact content/gate runtime chunks emitted by Vite
2. narrow `assets/*` and `assets/**/*` to only those needed by content runtime, workers, icons, fonts, and active protection visuals
3. keep a build check that fails if new web-accessible resources are added without release review

Do not narrow this list manually during submission prep unless the loaded extension has been tested on protected pages. Over-narrowing can break lazy visual chunks and make page friction fail only after install.

The reviewed extension-page CSP permits only own-origin connections and local
script, style, font, frame and worker resources. Image data/blob URLs and
media blob URLs support local rendering; no directive authorizes an HTTP(S)
resource. Native form navigation, HTML base elements and objects are disabled.
Extension-context workers use packaged modules with exactly `worker-src 'self'`.
Chrome MV3 rejects `blob:` in that directive; local image/media blob allowance is
independent. The platform worker-CSP contract validates profile inputs/outputs,
and `check:security:surface` also pins the exact manifest policy.

Runtime native fetch belongs only to the exact own-extension asset adapter,
including the Chrome `_favicon/` local-cache endpoint. The former remote icon
fetch exception is retired. Icon observations never become HTTP(S) destinations,
raw remote image candidates are rejected, and an unavailable local image shows
an explicit monogram. Chrome's extension favicon API disables server fallback.
The guard covers content isolated-world source too; browser navigation itself
and arbitrary compromised trusted navigation APIs are outside this resource
loading claim.

Direct HTML injection points are recorded in the schema 2 inventory at
`docs/operations/security-surface-html-sinks.json`. The contract records the
reviewed file, direct operator count, and rationale; a new file or count drift
fails `check:security:surface`. Counts remain a change detector, not proof that
a string is safe.

The generic `FastStyleEngine.setHtml()` primitive is retired. Dynamic indicator
badges use DOM construction and `textContent`. Static HTML mounting belongs to
the non-exported `mountIndicatorTemplate(shadow)` in
`src/domains/nudge/indicator/view.js` and `mountNudgeOverlayTemplate(shadow)` in
`src/domains/nudge/runtime/NudgeOverlayHost.js`. Each accepts only its target
ShadowRoot and mounts fixed packaged constants; callers cannot supply HTML.
Indicator CSS/markup constants and the overlay's `NUDGE_GAME_TEMPLATE` keep
their reviewed source provenance. There is no generic `setTrustedHtml` API.
The security guard checks these two owner contracts and their constant
provenance, and rejects restoration of the retired primitive.

Other inventoried sinks, including React-owned CSS, the development runtime
debugger, popup boot markup, and the room error surface, retain their separate
review rationale. This change does not certify or rewrite every HTML sink.
Reviewers must still trace dynamic values to their text/escaping boundary or
reviewed template owner. `outerHTML`, `insertAdjacentHTML`, and `document.write`
remain unconditionally rejected by the guard.

## 11) Final Pre-Submission Checklist

Before uploading:

1. Confirm every bundled font, sound, release image, and icon has a verified row, immutable hash,
   rights basis, licence, source evidence, and notice in
   `docs/operations/release-asset-provenance.json`.
   The current `release-static-image-and-icon-inventory` row intentionally stays
   `review_required` until a human supplies that evidence; do not change it to
   `verified` merely to make the gate pass. Deterministically generated Zen pond
   assets remain under their generator/digest guard. Research references are not
   release-approved assets and must remain absent from the public module graph.
   The provenance checker discovers media across all of `src/` and `public/`;
   only the two generated pond previews and the one research reference are
   explicitly delegated to those separate guards, so a new image cannot evade
   review by being placed in an unlisted feature directory.
2. From a clean, intentional release commit, run `npm run release:rc` with the
   real `ENTROPY_CWS_EXTENSION_ID`, release mode/version inputs,
   `VITE_CHROME_STORE_URL`, and `VITE_SUPPORT_URL` values shown above.
   Confirm the commit already has the exact `cws-v<manifest-version>` tag.
3. Upload only the ZIP named by the matching `.attestation.json`; independently
   compare its SHA-256 with the attestation before upload.
4. Confirm the attestation identifies the intended commit/tree/lockfile,
   `releaseProfile: public`, `extensionTarget: chrome`, a clean build ID,
   Chrome 129 floor, all gates passed, and actual browser evidence.
5. Confirm the public description is concrete and single-purpose.
6. Confirm the privacy policy URL is live and matches the Developer Dashboard disclosures.
7. Confirm the built `/support/` English and Korean links resolve to the exact
    `VITE_SUPPORT_URL`, then verify that route anonymously and confirm it is monitored.
8. Deploy only the attested `dist-landing/` tree, then preserve a hosting receipt
   containing its public origin, deployment identity, deployment time, and the
   attested landing SHA-256. Verify `/`, `/privacy/`, and `/support/` anonymously.
9. Confirm screenshots do not show debug or internal experiment UI.
10. Complete the real-site and user-granted-permission matrix separately; an
   automated artifact gate does not replace that manual product check.

## 12) First Release and Update Cutover

For the first public release:

1. Freeze the intended extension version, canonical Chrome extension ID, release
   commit, Store listing copy, privacy URL, support route, and signed-off asset
   ledger before producing the RC.
   Use `ENTROPY_CWS_RELEASE_MODE=first` and omit
   `ENTROPY_CWS_PREVIOUS_VERSION`.
2. Keep release V1 storage shapes current-only. Do not add a silent legacy read,
   mirror, or backup source to make submission testing look successful.
3. Install the exact ZIP on a fresh Chrome profile and complete the separate
   real-site/permission matrix before upload. Record the Store upload hash and
   attestation together as the release record.
4. Use a staged Store rollout where available and watch the monitored support
   route for install, permission, and data-lifecycle failures before widening.

For every later update:

1. Test both fresh install and update from the currently published version with
   retained settings, rules, consent, session recovery, history, and IndexedDB.
   Use `ENTROPY_CWS_RELEASE_MODE=update` and set
   `ENTROPY_CWS_PREVIOUS_VERSION` to the exact currently published Store
   version after independently checking the Developer Dashboard.
2. Any new persisted shape needs an explicit typed-store migration and current
   architecture/CI update. Never add normal-runtime legacy read-through as an
   undeclared rollback mechanism.
3. Preserve the previous approved ZIP, its attestation, listing disclosures,
   and release notes until the new rollout is stable. A rollback decision must
   consider whether the newer version wrote data the older version cannot read.
4. Re-run the complete RC owner; do not reuse an old `dist-prod`, ZIP, runtime
   report, browser result, or attestation for a new commit.

## 13) Known Residual Risks

1. `*://*/*` is still present as an optional host permission pattern so Chrome can allow runtime requests for arbitrary user-chosen sites. The app should continue requesting concrete site origins in product flows.
2. Shared runtime message constants still include some `DEBUG_*` names. Public debug UI and content debug launcher artifacts are disabled and absent from `dist-prod`; avoid exposing debug entrypoints in screenshots or listing copy.
3. `web_accessible_resources` still exposes broad asset globs because content/runtime visual assets need page access. Future work can narrow the resource list after asset loading is fully inventoried, or restore `use_dynamic_url` after the content bootstrap no longer depends on page-context ESM imports.
