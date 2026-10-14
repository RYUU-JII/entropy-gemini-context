# storage

Canonical home for storage public surfaces and storage-internal backends.

## Public Surfaces

These are the coarse owner seams for storage concerns:

- `settings/`
- `runtime/`
- `stats/`
- `logs/`
- `assets/`
- `bootstrap/`
- `clse/`
- `security/`
- `support/`
- `themes/`

`settings/SettingsCommandService.js` is the typed platform command capability.
Its internal Chrome transport consumes the domain-owned command/key/ACK
metadata in `domains/settings/config/settingsCommandContract.js`; transport does
not own a parallel action schema or reconstruct missing owner acknowledgements.

## Typed Facades

Current code also exposes narrower concept-named facades on top of the coarse seams above:

- `model/`: typed repository for `model_state`
- `nudge/`: nudge-owned settings helpers
- `protection/`: protection-owned settings queries
- `protocol/`: protocol/rules command and query helpers
- `progression/`: typed repository for small durable unlock/progression state

There is no compatibility facade. Zen storage callers use `themes/zen/`
directly.

Settings feature code must keep using typed concept seams. The command registry
is contract metadata for those seams, not a public generic key-value facade.

## Release V1 Baseline

- `EntropyDB` is created directly at IndexedDB version `1` with the complete
  current store/index layout.
- The release-V1 store set, store key path/auto-increment contract, and index
  set/index contract are frozen. Numeric version `1` alone is not sufficient:
  an exact same-version topology mismatch is reported as
  `INDEXED_DB_RELEASE_V1_RESET_REQUIRED` with its specific
  `INDEXED_DB_V1_*_MISMATCH` reason preserved.
- snapshot export/import accepts format version `1` only.
- snapshot import performs pure full-envelope preflight, including declared
  document/IndexedDB count equality, before background lifecycle mutation.
- reset/import prepares a destination-epoch Zen bonsai aggregate before storage
  mutation. The IndexedDB transaction installs epoch plus aggregate together;
  merge validates every retained model-state row, drops discardable caches, and
  uses imported, then valid existing, then prepared aggregate priority. Merge
  rejects an installed epoch with no aggregate; prepared selection is limited to
  physically pristine merge or replace. Pure preflight rejects duplicate
  `modelState` primary keys, including duplicate aggregate rows.
- background bootstrap is the sole first-install owner and calls the typed
  `ModelStateRepository.initializeProfileGeneration()` seam before mutable runtime
  admission. It installs the epoch, bonsai aggregate, and empty durable koi roster
  root together; it may repair only that missing roster root for an otherwise valid
  installed generation. `assertProfileGenerationInitialized()` proves the exact
  epoch-plus-aggregate root in one readonly transaction for downstream admission.
  Generic epoch-bound get/set/bootstrap/CAS require the exact installed
  epoch-plus-aggregate root and never install it. Epoch-blind repository access
  and Store CRUD surfaces are closed before IndexedDB access, and generic store mutation cannot target the aggregate key;
  Dashboard/theme code cannot bootstrap a missing aggregate.
- typed stores accept only their current release V1 key and record contract;
  malformed or wrong-contract records fail loudly.
- Feed tempo continuity uses the exact
  `model_state.feed_tempo_adaptive_profile_checkpoint_v1` typed entry. It is a
  decaying online-learning checkpoint owned by
  `FeedTempoProfileCheckpointRepository`, not a permanent baseline. Content
  code reaches it only through the trusted background message owner; direct
  content IndexedDB access and session/Chrome/localStorage fallbacks are
  forbidden.
- security key material has key-specific physical contracts. Malformed
  persisted AES/domain/CLSE material is never treated as absence or rotated by
  a normal runtime read.
- full reset drains all required sibling clears in each ordered phase before
  recovery begins; a phase failure is named and does not leave a late clear
  racing the reload tail.
- ordinary analytics/app reset clears records in known stores; it cannot remove
  object stores or indexes and is not a topology repair path.
- the IndexedDB manager latches a reset-required admission failure for its
  runtime lifetime so typed stores cannot repeatedly reopen the same incompatible
  database; the explicit profile reset is followed by an extension reload.
- Protected consumption memory uses one exact
  `model_state.protected_consumption_memory_v1` row through
  `ConsumptionMemoryCheckpointRepository`. Model state and its applied cursor
  commit together with revision/profile-epoch CAS and domain-usage consent
  admission. Snapshot import rebases both model and source epoch. Explicit
  analytics/runtime erasure writes an empty next revision; terminal profile
  mutation drains Tracking before the storage transaction and discards its warm
  read. See `docs/architecture/runtime/consumption-memory-runtime.md`.
- Zen `model_state` keys route through
  `themes/zen/ZenThemeModelStateContract.js`, which owns one V1 validator and
  one snapshot decision per key. Koi appearance/activity caches are
  discardable and excluded from snapshots; durable/model keys must validate on
  read, write, export, and import. Normal durable/model reads fail when the key
  is missing; only the named `getValueForBootstrap()` / `bootstrapValue()`
  first-run seams may admit absence. Discardable caches alone map absence or a
  wrong cache signature to a cold-rebuild miss.
- normal runtime contains no upgrade branch, old-key read-through, retired-key
  cleanup, or automatic database deletion.
- changing the frozen V1 store/index topology requires a separate public V2
  architecture decision and versionchange contract.
- a developer profile created before this baseline must use the explicit
  [pre-release development profile reset](../../../docs/operations/runbooks/pre-release-development-profile-reset.md).

Chrome Extension Manifest V3, Web Crypto algorithm identifiers such as
`AES-GCM`, dependency versions, and other externally owned versions are not
Entropy persistence-contract versions and remain unchanged.

## Internal backends

- `internal/chrome-storage/`
- `internal/indexeddb/`

## Read next

1. `docs/system-architecture/02-runtime-storage-boundaries.md`
2. `docs/architecture/storage/storage-architecture-target.md`
3. `docs/operations/runbooks/pre-release-development-profile-reset.md`
