# Storage And Data Lifecycle E2E

- Status: Active
- Owner: release operations / platform storage / stats and CLSE owners
- Last validated against code: 2026-10-09
- Path policy: current-only
- Canonical for: release V1 data lifecycle source integration and real Chromium persistence verification

## Purpose

This profile closes the gap between storage unit contracts and real Manifest V3
process behavior. It proves the owner chains for completed-day personal
baselines, CLSE materialized baselines, and nudge issued-run lifecycle in source
tests, then proves fresh profile creation, snapshot rejection, reset/restore,
and service-worker revival against an unpacked extension in Chromium.

The browser harness uses a fresh temporary profile and the base checked-in
permission profile. It copies the built extension only to add a trusted static
extension test page; it does not elevate `scripting` or host permissions and it
does not mutate the checked-in manifest, repository `dist`, or a user profile.


## Run

Use a clean checkout with the intended changes committed, then build its public
Chrome artifact. The artifact must match the current commit, tree, and lockfile;
an old or dirty build cannot pass admission.

```bash
npm run build:prod
```

Run only the source owner-chain and architecture profile:

```bash
npm run qa -- doctor release/lifecycle --mode=agent --source-only=true --presentation=hidden
# Continue only when READY:
npm run qa -- run release/lifecycle --mode=agent --source-only=true --presentation=hidden
```

Run only the data browser profile:

```bash
npm run qa -- doctor lifecycle/data --mode=agent --presentation=hidden
# Continue only when READY:
npm run qa -- run lifecycle/data --mode=agent --presentation=hidden
```

Run the complete release lifecycle matrix, including the existing MV3
worker/content/dashboard and nudge session-revival profile:

```bash
npm run qa -- doctor release/lifecycle --mode=agent --presentation=hidden
# Continue only when READY:
npm run qa -- run release/lifecycle --mode=agent --presentation=hidden
```

The compiled named environment owns browser selection, temporary profiles,
extension loading, and cleanup. No manual browser reload is required. The
default public artifact is `dist-prod/`; a configured alternate path must be
built explicitly through `ENTROPY_EXTENSION_OUT_DIR`. Lower harness options
are not permission to bypass target parameters or substitute a browser.

## Development settings journey

`journey/protection` complements this public release profile with the current
development artifact in one run-owned disposable profile. It checks the fresh
canonical boot defaults and actual Sites UI before preparing its declared
fixture; actual Sites and Lens/Echo inputs then survive Dashboard document
reload and owned service-worker stop/wake. Encrypted export stays in memory;
the independent per-run backup passphrase remains in the caller closure. The
shared preparation helper accepts fresh `GET_SECURITY_VAULT_STATUS` admission
only as `unlocked`, `mode: local`, `operation: already_unlocked`; this journey
neither supplies an app password nor invokes password setup. Its exact owned
Dashboard preparation tab executes no application and writes no secret storage.
A retired Enso value in an import is rejected before generation/journal or
durable data changes, then full reset and replace import use the existing
`mv3ProfileMutationHandoff.mjs` owner and prove different workers plus restored
canonical settings and actual control selection. Replace import omits
`restorePassphrase`, requires the result's local/unlocked mode, and proves the
same automatic local admission after the response-ACK worker reload.

The closed physical fixture owner is
`scripts/qa/protocols/integratedSettingsLifecycleFixture.mjs`. It may clone and
replace only `settings.core` in the exact verified owned profile and temporary
extension root, from the exact packaged trusted-page origin/path. Its two
invalid values are a retired Enso boolean and a malformed global artifact pause.
The next fresh worker must reject them; reads and Dashboard recovery must leave
the invalid bytes unchanged. The actual recovery UI opens its diagnostics and
explicit reset confirmation, then owns RESET and response ACK. Fresh canonical
defaults, a different worker and healthy Sites UI complete recovery. Security
corruption, personal profiles and arbitrary physical-key writes are outside
this fixture contract.

```powershell
npm run qa -- run journey/protection --presentation=hidden --theme=zen
npm run qa -- run journey/protection --presentation=hidden --theme=cyberpunk
```

See the Integrated protection section of `entropy-qa-control-plane.md` for
ordered stages and exact evidence. Reports retain synthetic settings intent,
counts, diagnostic codes, safe vault receipts and worker identities; encrypted
envelopes, decrypted snapshots, passphrases, physical
settings documents and secret bytes are never logged. Development journey PASS
does not certify the independent public lifecycle target or relax its clean
committed-artifact admission. A dirty working tree keeps that release gate
blocked until an appropriate public artifact can be produced.

## Source Contract Scenarios

1. A stats day remains excluded while current/open, enters historical personal
   baselines only after rollover/finalization, and preserves missing, observed
   zero, and ineligible semantics through Usage and Site Pull reads.
2. CLSE compares the previous same-grain baseline before observing the current
   60-second bucket, advances `sparse -> forming -> stable`, flushes, and
   survives repository/manager/service recreation.
3. CLSE reset and replace-import rehydrate the materialized baseline without
   mixing 10-second learning input into the 60-second grain.
4. Encrypted snapshot V1 authenticates its bounded envelope, then validates exact
   current documents, keyring, state and IndexedDB rows before app-level lifecycle
   side effects. The Node release protocol fixture uses real WebCrypto to prove
   rejection oracles, credentials isolation and required locked resume; it does
   not replace the browser persistence gate.
5. Full reset drains every sibling in a required clear wave before recovery,
   even when one sibling fails.
6. Nudge dispatch persists pending plus lease in one patch before `NUDGE_START`,
   keeps `presented` and `episode_completed` monotonic and outside the dispatch
   TTL, rejects orphan/tab-mismatched lifecycle writes, and keeps force-debug
   dispatch out of production session maps.

## Chromium Contract Scenarios

Before scenario operations, the harness enables extension developer mode in
each run-owned disposable profile through the packaged `chrome://extensions/`
profile configuration API and verifies its readback. The scenario report
records `reloadSetup.inDeveloperMode` and whether setup changed the value.
Initial command-line loading is not proof of reload eligibility: Chrome 150
can disable the same unpacked extension after product reload with
`unsupportedDeveloperExtension=true` when developer mode is off. This setup
never edits an external or managed-persistent profile, requests OS focus, or
reenables an extension after a failed scenario. Manifest permissions stay at
the base contract. See Chromium's
[profile configuration and disable-reason contract](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/chrome/common/extensions/api/developer_private.webidl).

1. A fresh profile retains the base permission set and creates the exact
   `EntropyDB` version-1 stores, keys, and indexes. Its existing packaged trusted
   page attempts a synthetic `https://egress.invalid/` fetch and image request.
   Both must produce actual `securitypolicyviolation` events with respectively
   `connect-src` and `img-src`, that exact blocked URL, and `enforce` disposition.
   A network failure or report-only event cannot satisfy the no-egress proof.
2. Each fresh profile prepares automatic local keys through the canonical public
   status route, without a user password or explicit password setup command.
   The shared helper receipt must report `mode: local` and `already_unlocked`.
   The storage inspector retains count-only diagnostics. A single encrypted V1
   export includes the current documents and complete keyring; the envelope
   alone crosses the export boundary. Reports retain only cipher metadata and
   validated key-contract booleans. There is no plaintext or secret-optional
   export, and QA never seeds physical AES/HMAC keys.
   The encrypted-keyring scenario explicitly opts into the declared recording
   fixture through one canonical settings command, verifies all five policy keys
   and propagation ACK/readback, then runs the shared closed credential protocol.
   This opt-in does not change the fresh-profile recording-free defaults.
   It explicitly enables optional passphrase protection through public
   `SETUP_SECURITY_VAULT`, verifies `mode: passphrase`, and compares the entire
   portable state to prove that enabling protection preserved the same data keys.
   Existing wrapped fixtures remain wrapped and require their exact phrase:
   wrong unlock and wrong current-passphrase rotation must return the exact
   authentication refusal, preserve unlocked admission and leave the complete
   decoded portable state unchanged. Successful rotation must preserve those
   data keys. After closing its preparation tab, the canonical harness
   `reloadExtensionFromSource()` owner reloads the exact extension and proves a
   different worker. A fresh asset-fenced Dashboard preparation tab must observe
   a log-only locked vault with `protectionReady: true`, read canonical site settings
   successfully and require exact locked refusal of encrypted export. It then
   rejects the old phrase while remaining locked, unlocks with the
   new phrase and prove the same keyring, all non-log portable state, and every
   original encrypted log row unchanged. The baseline must contain at least one
   encrypted log; all preserved rows authenticate through the canonical version-2
   AES-GCM decoder using the keyring obtained after new-phrase unlock.
   Closing an owned preparation tab causes `trackingBrowserEventHandlers` to
   flush `TacticalIntelligenceLogger` with `reason: tab_closed`. The reload
   comparison admits exactly one additional authenticated row of that type,
   with exact logger shape, null hostname, no audible hosts or video interventions,
   typed counts/duration, canonical fresh-default tactical state, and a timestamp
   inside the fixture-close/comparison interval. Other event types and reasons,
   extra metadata, failed authentication, missing/modified originals or a different
   append count fail. Internal page loading/activation also increments the logger's
   navigation counters. Their explicit upper bounds follow this closed operation:
   first preparation open/Dashboard/blank (3 loads), reload management page (1),
   second preparation open/Dashboard (2); three page creations plus the first two
   closures permit at most five tab activations. Final preparation cleanup occurs
   after comparison. These counters are not browsing identity or an exemption for
   arbitrary runtime rows. Evidence reports preserved/decrypted/validated counts
   separately and does not claim byte equality for the appended log collection.
   The private scope retains all four distinct transient phrases and decrypted comparisons;
   evidence contains only refusal codes, booleans, safe preparation receipts and
   worker identities. This uses no new named target, ad hoc CDP target or raw
   key-storage operation, and does not bypass profile-mutation ACK ownership.
   A failed complete-state comparison remains terminal. Its diagnostic identifies
   the exact credential phase and bounded changed schema paths, types and collection
   counts; unrecognized dictionary names are replaced with numeric property slots.
   No compared value, dynamic dictionary key, passphrase or key byte is emitted.
3. An authenticated payload with an unsupported version, a wrong backup
   passphrase, modified ciphertext and an invalid import mode are rejected
   without changing the canonical seeded setting, decrypted durable state,
   generation or lifecycle journal. The decrypted comparison inputs remain in
   memory and are excluded from evidence.
4. A canonical setting is seeded and exported, changed, cleared by full app
   reset, then restored through encrypted `replace` import. Reset creates fresh
   automatic local keys through canonical status admission without a password;
   this release scenario deliberately opts into rewrapping the authenticated keyring with a
   restore passphrase and returns a locked vault. The handoff wake reader must
   observe the shared helper taking the public unlock branch before reading
   restored settings. Safe mode-bearing status/unlock receipts remain in the report. After each successful
   mutation, `mv3ProfileMutationHandoff.mjs` validates the exact response handoff,
   opens one owned packaged Dashboard, sends `PROFILE_MUTATION_RESPONSE_ACK`,
   waits for the old worker's absence and exact unpacked path/id reactivation,
   and uses the next canonical read to wake
   and prove a different worker. The product owns
   `chrome.runtime.reload()`; the QA helper neither bypasses `reload_pending`
   nor forces a worker stop to replace the required Dashboard acknowledgement.
   ACK return-channel invalidation is allowed by the product handoff contract;
   a new worker and the subsequent value read are required completion evidence.
   Both worker identities and the operation are recorded in the report.
   Before sending the ACK, the extension harness releases its exact cached
   trusted-page target; the old JavaScript context is invalid after extension
   reload. The Dashboard is released through the held CDP target lease directly,
   so cleanup does not require extension APIs while reload is in flight. This explicit lifecycle
   step is shared with the harness's existing source-reload path and is not a
   read-time retry or target-discovery fallback.
5. The service worker is stopped after restore; the shared helper must report
   `already_unlocked` before a trusted read returns the restored canonical value
   from a different target. Stopping only the MV3 worker preserves Chrome session
   storage; extension reload after import instead requires the public `unlock`
   branch in scenario 4. Restored keyring equality is checked privately.
6. The encrypted keyring export scenario validates the vault-generated canonical
   AES/domain/CLSE keyring through its production contract. It reports only
   presence, algorithm, count and contract booleans, never key bytes or JWKs.
7. Before reset and replace import, a trusted-page request captures the current
   generation and seeds the worker diagnostic cache through its typed background
   owner. After each product handoff, the cache key is physically absent. An old
   captured-generation write is rejected by the revived worker and cannot recreate
   that key. Reports retain only seed/readback/clear/rejection summaries.

Calendar rollover stays in deterministic source integration because a real
wall-clock date boundary would make the Chromium gate slow and flaky. Worker
death, extension-origin messaging, browser storage, and IndexedDB schema remain
real browser checks because mocks cannot prove those boundaries.

## Failure Interpretation

On scenario failure, the owned disposable browser's extension-management page
projects only the exact extension's state, disable reasons, developer-mode
boolean, and up to eight bounded manifest/runtime error messages. The exact
diagnostic target is released through its target lease. A diagnostic failure
is recorded as unavailable and never replaces the original scenario failure.
No raw preference files, complete extension inventory, or key material are
collected.

- Preflight rejection is atomic: no stats flush, CLSE pause, settings lane,
  session cleanup, or backend mutation may have started.
- Chrome Storage plus IndexedDB commit is an explicit saga, not a cross-backend
  transaction. A commit-time failure must surface and enter the canonical
  reconcile/reload tail; a later retry must converge.
- A malformed existing key is corruption. It must not become `missing`, rotate
  installation identity, or silently disable CLSE loop identity.
- A failed reset clear phase must fully drain before recovery. Late orphaned
  clears after reload are a contract failure.

## Report Safety

Default reports are written below `/tmp/entropy-mv3-data-lifecycle-e2e` and
`/tmp/entropy-release-lifecycle-matrix`. They contain counts, schema names,
contract booleans, diagnostic codes, synthetic probe URLs, and extension worker
target identity only. Encrypted envelopes, decrypted snapshots, settings documents, IndexedDB rows,
passphrases, secrets, JWK key bytes, browsing-origin URLs, and user data must not be written
to the report.

## Gate Policy

This is a release-candidate/manual gate. It is intentionally absent from the
default `npm run build` and `npm run gate:ci` flows because it requires a real
Chromium process and temporary extension profile. The source architecture and
unit guards remain in ordinary build/test profiles; promote the browser matrix
only when CI guarantees Chromium extension support.
