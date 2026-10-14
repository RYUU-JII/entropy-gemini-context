# Pre-release Development Profile Reset

- Status: Active
- Owner: release operations, platform storage
- Last validated against code: 2026-10-13
- Path policy: current-only
- Canonical for: deleting Entropy development data before validating the release V1 persistence baseline

## When To Use This

Use this procedure for a development extension profile that may contain a
pre-baseline `EntropyDB` or old Chrome storage data. A database can still require
this reset when its IndexedDB version is already `1`: the release-V1 contract is
the exact store set, store key path/auto-increment contract, and index set/index
contract, not the numeric version alone. Product runtime deliberately does not
downgrade, migrate, delete, or silently reset an existing database.

`INDEXED_DB_V1_STORE_SET_MISMATCH`,
`INDEXED_DB_V1_STORE_CONTRACT_MISMATCH:<store>`,
`INDEXED_DB_V1_INDEX_SET_MISMATCH:<store>`, and
`INDEXED_DB_V1_INDEX_CONTRACT_MISMATCH:<store>:<index>` are therefore developer
profile reset signals. Runtime reports them through the canonical
`INDEXED_DB_RELEASE_V1_RESET_REQUIRED` failure while preserving the exact reason.
For example, an older version-1 development database may still contain the
retired standalone `stats_transition_edges` store even though the current frozen
V1 topology does not.

Artifact settings from before the named-profile or Enso interval cutover require
this explicit whole-profile reset when the running bundle is current.
`CANONICAL_BINARY_FILTER_ENTRY_FIELD_INVALID:blur:level`,
`ENSO_INTERVAL_PRESET_INVALID`, and exact filter-settings contract failures are
not instructions to rewrite a field. Reads and cache hydration preserve stored
data and fail explicitly; there is no startup transition or cleanup exception.

The P1-B daily-delivery cutover also requires this reset for an existing V1
`nudge.daily_receipt`. `FURIN_DAILY_RECEIPT_VERSION_UNSUPPORTED:1` preserves that
record and rejects it. Current V2 Site-end evidence cannot be reconstructed from
the old Global suppression rule or session shown markers. Do not delete or
rewrite this one key, manufacture Site receipts, or loosen the current validator.
The operator must select the canonical full reset; ordinary reload preserves
the incompatible data. This error does not by itself add eligibility to a QA
maintenance target's declared recovery contract.

Other immediate boot/runtime failures such as `FILTER_LEVEL_ENTRY_CONTRACT_INVALID:<key>`
or `PROTOCOL_SCHEDULE_CONTRACT_INVALID` after a release-V1 contract cutover are
also reset signals when the running bundle is current. Do not loosen those
validators or repair one field in place; reset the whole development profile so
all persisted owners restart from the same baseline.

This is a whole Entropy development-profile reset, not a list of retired keys.
The ordinary in-product analytics/app reset clears records from known stores. It
does not and cannot remove object stores or indexes, so it cannot repair a V1
topology mismatch. Only successful deletion of `EntropyDB` followed by fresh
creation rebuilds the physical V1 topology.

Classic2 profiles containing the former standalone lineage slot or page-local
bonsai seed/latent/identity state must use this reset before validating the
current `zen_bonsai_profile_aggregate_v1` contract. Runtime does not import,
merge, clean up, or dual-write those predecessor states. The current aggregate
starts from one fresh active identity and thereafter owns that identity and its
`classic2_development_lineage_release_v1` state in one IndexedDB CAS unit.

Record-level development persistence cutovers are stamped on the reserved
ModelState profile header as `developmentBaseline`. An exact pre-baseline header,
a lower baseline, or feature rows without that header produce
`MODEL_STATE_PROFILE_COMPATIBILITY_BASELINE_RESET_REQUIRED` with an exact
`profile_compatibility_recovery_v1` descriptor. The Dashboard then mounts a
reset-only surface even when Settings and the normal Dashboard runtime cannot be
admitted. This does not classify arbitrary corruption as resettable: malformed
state at the current baseline remains fatal, and a profile from a higher baseline
is blocked as a downgrade.

Known current settings-contract failures in `settings.core`, `settings.rules`, or
`settings.ui` also reach that reset-only surface through an exact
`settings_profile_recovery_v1` descriptor. The physical typed validator owns this
classification; an arbitrary error name or message does not authorize recovery.
Generation readiness waits for settings hydration before admitting the Dashboard.
Reset runs the existing terminal clear without rereading the broken settings.
The security document is deliberately excluded: malformed security policy cannot
be replaced by default authorization. If security corruption blocks reset, use
the explicit installation-lifetime wipe below with all feature contexts closed;
never repair individual security fields from a live Dashboard.

A failed reset keeps normal runtime admission closed. The recovery surface shows
the durable lifecycle failure separately from the latest request error; a
non-authentication failure is not evidence that a PIN is configured or incorrect.
`RESET_APP_DURABLE_CLEAR_PHASE_FAILED` identifies a failed required clear wave.
The background console's `[BackgroundMaintenance] Required reset clear failed`
entry retains that phase and each failed task's index/error code, without logging
credentials or discarded records. Some sibling clears may already have committed:
an absent vault alone is not proof that the whole profile reset completed.

The current development baseline is `2`. A baseline-1 profile contains the
pre-articulated Classic2 graph meaning and must reach that reset-only surface
before its aggregate or nested lineage is deep-hydrated.

Do not perform the old procedure that kept an active Dashboard alive while
clearing IndexedDB, `chrome.storage.local`, and `localStorage` one after another.
That creates a window in which the old page or background runtime can repopulate
a newly empty backend from memory. The canonical in-product reset begins by
committing a cross-context `runtime.profile_reset_lifecycle` write-admission
fence; manual physical DB deletion instead requires all Dashboard and extension
write contexts to be closed first.

The durable local lifecycle journal and the IndexedDB epoch fence have different
jobs. The lifecycle journal survives worker/browser restarts, notifies contexts,
closes admission, and lets admitted writes drain. The ModelState reset owner then
clears model state and commits a reserved profile-epoch row equal to that reset's
`resetId` plus a prepared canonical bonsai aggregate in one IndexedDB transaction.
Aggregate bootstrap/CAS compares its top-level `profileEpoch` with that row in
the same transaction. This durable epoch transaction is the linearization point
that prevents an old context from winning a write between notification and
clear, even when revision numbers restart after reset.

Within the background worker, `ProfileMutationRuntimeGate` is the single ingress
drain owner for non-mutation messages, ordinary browser events, and their
detached tasks. The coordinator publishes `resetting`, closes that gate, drains
all leases, quiesces terminal participants, performs the mutation, publishes
`committed` and then `complete`, and seals the old worker gate as local
`reload_pending`. It never rebinds participants or reopens that worker. The
successful `RESET_APP_DATA` or `IMPORT_STORAGE_SNAPSHOT` response carries the
exact `profileMutationHandoff` descriptor
`{ contract: 'profile_mutation_response_handoff_v1', operation, resetId }`.
After the Dashboard has awaited that response Promise, it sends
`PROFILE_MUTATION_RESPONSE_ACK` with the unchanged descriptor. The eager ACK
handler verifies the trusted Dashboard sender, durable `complete` lifecycle,
local `reload_pending` gate, and exact operation/reset identity before it calls
the runtime reload port. There is no timeout/watchdog reload and no same-worker
fallback. Events received while closed are rejected, not replayed after reset.

If a worker or browser stops while the lifecycle is `resetting`, `committed`, or `failed`, the
next Dashboard mounts only the profile-recovery control surface. Its
passcode-authorized full reset carries the exact observed `resetId` and reaches
the mutation coordinator without waiting for normal background initialization.
Do not work around that fence by deleting only localStorage or IndexedDB.

## Reset Procedure

For an explicitly authorized development-profile `settings.core.nudgeConfig`
contract failure, `npm run qa -- run maintenance/profile-reset
--confirm-erase-entropy-data` uses the same canonical full-reset coordinator and
Dashboard ACK in the declared persistent Chrome for Testing `authenticated`
profile. It first verifies the served artifact and fresh exact typed recovery
descriptor, then requires worker replacement and normal strict runtime readiness.
This is a maintenance action, not an automatic recovery fallback. Security or
passcode refusal stays terminal; use the product UI for configured authorization.
The [QA control-plane contract](../qa/entropy-qa-control-plane.md) owns its bounded
eligibility, evidence and cleanup. Ordinary `qa:reload` preserves data.

1. If the current bundle can open Settings, use Entropy's **Reset Everything**
   action and let the exact response-ACK handoff finish. This dispatches
   `RESET_APP_DATA`; the background maintenance owner commits
   `runtime.profile_reset_lifecycle` as `resetting` before any durable clear.
   Every extension writer closes admission, and the shared background runtime
   gate drains already-admitted work against that generation before reset phases
   run. The ModelState phase atomically clears its records and writes the same
   `resetId` as the new durable profile epoch together with the new canonical
   aggregate. After terminal participants settle, the coordinator publishes
   `complete` and seals the old worker as `reload_pending`. The successful
   response returns the exact handoff descriptor; only the Dashboard's matching
   `PROFILE_MUTATION_RESPONSE_ACK` authorizes runtime reload. A failed reset or
   invalid/missing ACK leaves a diagnosable closed fence rather than reopening
   writes or relying on a timeout.
2. If Settings cannot open but the Dashboard shows the exact profile-compatibility or settings-contract
   reset surface, use its **Reset Everything** action. The open-lifecycle request
   intentionally has no fabricated `expectedResetId`; the eager background control
   plane waits for failed normal initialization to settle and then starts the same
   full-reset coordinator. After the lifecycle closes, recovery uses its exact
   observed `resetId`. Let the response ACK and runtime reload finish.
3. For an ordinary record-level development reset, stop after that ACK-triggered
   runtime reload and fresh-worker bootstrap. Do not supplement the in-product
   reset with a manual reload or ad hoc per-key deletion.
4. Continue only when `INDEXED_DB_RELEASE_V1_RESET_REQUIRED` or another exact
   physical-topology failure requires deletion of `EntropyDB`. Close every
   Entropy dashboard, popup, options page, extension DevTools window, and other
   extension write context. Do not leave a Dashboard console open as the reset
   executor.
5. From `chrome://extensions`, open a fresh, reset-only service-worker inspection
   console for the unpacked Entropy extension. Do not open a Dashboard. Run only
   the physical deletion:

```js
await new Promise((resolve, reject) => {
  const request = indexedDB.deleteDatabase('EntropyDB');
  request.onsuccess = () => resolve();
  request.onerror = () => reject(request.error);
  request.onblocked = () => reject(new Error('ENTROPY_DB_DELETE_BLOCKED'));
});
```

6. If deletion reports `ENTROPY_DB_DELETE_BLOCKED`, close the remaining Entropy
   extension context and repeat step 5 from a fresh reset-only inspection
   lifetime. Do not add automatic deletion or a runtime migration.
7. Close the inspection console immediately. Do not reopen Entropy or execute any
   feature action between deletion and reload. A `versionchange` makes the old DB
   manager lifetime terminal, but it is still not a general-purpose post-delete
   runtime.
8. Open `chrome://extensions`, find the unpacked Entropy extension, and click
   **Reload**.
9. Open Entropy again. The normal first-run bootstrap creates `EntropyDB` at
   version `1`, initializes only missing current V1 keys, and builds disposable
   caches cold from current inputs.

## Security Corruption: Explicit Development Installation Wipe

Use this only after a malformed `settings.security` document prevents canonical
authorization and the operator explicitly chooses to erase Entropy development
data. Do not substitute raw storage clearing from a live worker or Dashboard.

1. Verify the intended development browser/profile, Entropy extension ID, and
   exact unpacked checkout path. Record the identity before removal.
2. Close every Entropy Dashboard, popup, options page, extension DevTools window,
   and other extension context. In that profile's `chrome://extensions`, remove
   only the verified Entropy development extension. Removal terminates its
   installation lifetime and deletes its local/session settings, security
   metadata, secrets, IndexedDB history/model state, and derived caches.
3. Use **Load unpacked** with the same verified native checkout publication path.
   Recheck the extension ID before opening the fresh Dashboard. A changed
   manifest key or path can change identity; never assume it remained equal.
4. Verify missing-settings defaults and a freshly initialized current profile
   generation. Import only a current, strictly preflighted snapshot if desired.

This is an operator action, not an agent-initiated wipe or runtime recovery
fallback. It removes data belonging to that extension installation and preserves
the browser profile's unrelated data and other extensions. Chrome documents
extension storage removal in its [Storage API contract](https://developer.chrome.com/docs/extensions/reference/api/storage?hl=en);
the [extension data deletion owner](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/chrome/browser/extensions/data_deleter.cc)
also clears extension-origin storage and the extension storage frontend.

The in-product reset owns `chrome.storage.local` and
`chrome.storage.session` clearing. Old bonsai localStorage business keys have no
runtime reader in the current bundle and therefore cannot seed the aggregate.
If an exact origin-wide developer wipe is required, clear extension-origin Local
Storage through Chrome's Application storage UI only after all Entropy pages are
closed; never turn a live Dashboard into the reset coordinator.

## Verification

- DevTools **Application > IndexedDB > EntropyDB** reports version `1` and the
  current store/index layout.
- `chrome.storage.local` contains only keys created by the current first-run
  bootstrap; session storage starts empty except for new runtime checkpoints.
- `model_state` contains `zen_bonsai_profile_aggregate_v1` immediately after an
  in-product reset/import (or after the only allowed physically pristine initial
  bootstrap) and does not contain
  `zen_bonsai_classic2_lineage_state_v1`.
- the aggregate active identity contains seed, canonical latent, structure,
  canonical generation inputs, one `identityRevision`, and the current durable
  `profileEpoch`; its nested lineage is either `null` or stamped with that same
  identity revision and fingerprint.
- the aggregate `profileEpoch` exactly matches the reserved ModelState epoch row.
  That row also carries the current `developmentBaseline`. A reset may restart
  numeric revisions, but an aggregate proposal carrying the previous epoch fails
  without writing.
- a pre-baseline or lower-baseline record-level profile reaches the reset-only
  Dashboard surface; a malformed current-baseline profile and a higher-baseline
  profile do not.
- export format V1 can be exported, the reset repeated, and that same V1 export
  imported. Any other format/record contract must fail explicitly.
- a higher-version database or a same-version exact V1 schema mismatch produces
  `INDEXED_DB_RELEASE_V1_RESET_REQUIRED:db=EntropyDB:requestedVersion=1` with its
  exact reason preserved until this developer reset is completed; runtime must
  not hide it or repeatedly retry periodic event-log flushes against the
  incompatible database.
- a live connection receiving `versionchange` closes and stays terminal for that
  JavaScript lifetime. It must not reopen the new DB and replay old in-memory
  bonsai state before extension reload.

## Data Scope

Deleted Entropy-owned data includes settings, policy snapshots, theme/workspace
state, security metadata and extension secrets, runtime/session checkpoints,
historical stats and logs, CLSE data, model state, assets, and derived caches in
the selected development extension profile.

This procedure does not delete browsing history, bookmarks, cookies, website
storage, downloads, saved passwords, data owned by other extensions, or files
outside the Entropy extension profile. Uninstall/reinstall may use a different
extension identity; use the explicit procedure above when validating the same
unpacked extension identity.
