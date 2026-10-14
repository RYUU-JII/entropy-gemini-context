# Storage Versioning and Migration Policy

- Status: Active
- Owner: platform storage, release operations
- Last validated against code: 2026-10-14
- Path policy: current-only
- Canonical for: pre-release compatibility removal and post-release storage/import transition decisions

## Scope and current decision

Entropy has not released a public data baseline. Pre-release development data is
not a supported migration source. Runtime reads, startup, import and typed stores
accept the exact current contract; they do not convert previous settings, debug
sessions, learned models or progression records. A missing optional row may
bootstrap through its owner. A present incompatible row must return an explicit
contract/version/reset-required error and remain unchanged.

There is no automatic profile wipe, database deletion, key regeneration or
reset-to-default repair for incompatible data. The operator may deliberately
reset the exact development profile through the existing reset runbook.
Neither a failed migration nor an incompatible build authorizes erasure.

This policy governs future implementation decisions. The post-release migration
coordinator described below is required before a public schema transition; it is
not an already implemented capability. Current IndexedDB remains release V1.

The topology owners remain
[Runtime Storage Boundaries](../../system-architecture/02-runtime-storage-boundaries.md)
and [Storage Target](storage-architecture-target.md). Reset/import drain,
generation and fresh-worker handoff remain owned by the current background
profile mutation coordinator.

## Classify a candidate before changing it

| Case | Meaning | Required treatment before release |
| --- | --- | --- |
| Actual migration | Reads an old version/shape and writes a different current representation | Remove the old decoder/converter and automatic call chain; reject old presence |
| Read-through compatibility | Tries old keys, old storage, aliases of persisted fields, or historical model versions | Remove alternate source of truth; keep one current read |
| Import normalization | Validates current transport envelope, makes a private copy, checks finite values and exact keys | Keep validation; remove conversions of old payload versions |
| IndexedDB first creation | onupgradeneeded creates the exact V1 topology for a genuinely absent database | Keep; it is not an existing-data upgrade |
| Input canonicalization | URL/hostname/theme ID normalization at the declared untrusted input seam | Keep when it produces the current contract; do not make stored corruption valid |
| Current derived state | Recomputes declared disposable hashes/projections from valid canonical sources | Keep its named owner and error policy; never substitute it for lost personal facts |
| Invalid canonical repair | Treats a present invalid row as missing, resets a posterior, changes a key or hides a read error | Remove; expose error and preserve the bytes |
| Explicit reset | User/QA-selected reset, analytics erasure or validated terminal restore | Keep authorization, admission, drain and generation fencing; not a startup migration |
| Explicit current credential separation | User-authenticated full wrapped V1 to log-only V1, same keys/ID in one slot | Only `SEPARATE_SECURITY_VAULT_PROTECTION_KEYS`; never status/startup/unlock conversion |
| Source/module migration | Repository moves, developer notes, previous Promise in a queue, scientific evidence lanes | Review semantics; a keyword is not evidence of data compatibility |

Input canonicalization never authorizes runtime dual reads. Current replay or
statistical recomputation over valid evidence is distinct from converting old
evidence, and must not become an automatic recovery for an incompatible model.

## Current cleanup ledger

| Boundary | Current rule | Implementation owner |
| --- | --- | --- |
| Goal-end preferences | Stored `nudgeConfig.goalEnds` is exactly two booleans `site` and `global`. Stored `nudgeConfig.enabled`, missing goalEnds in a present config, or malformed preferences reject untouched; no master-to-scopes conversion | nudgeConfig policy, settingsCommandContract, SettingsDocumentRepository and settingsCacheState |
| Lens visual strengths | Exact `{ isActive: boolean, value: integer 0..100 }`; boolean, compiled or predecessor shapes reject without rewrite or wipe | visualFrictionProfiles, normalizeFilterSettings, SettingsStore / snapshot preflight |
| Notification settings | Exact four-field notification shape; no journey initializer on read/write/import | SettingsStore, notificationsConfig, snapshot preflight |
| Progression | Exact current disclosure shape; no old-policy conversion, calendar grandfathering, configured beta grant or registration floor | progressionSnapshot, artifactDisclosurePolicy, ProgressionStateStore, progressionService |
| Progression debug session | Current debug contract only; old session contracts reject without rewrite | ProgressionUnlockDebugRepository |
| Zen neural model | Current neural version and dimensions only; old weights are not reset during load | NeuralZen and ZenThemeModelStateContract |
| Zen pairwise model | Current model version, keyspace and generation semantics; no replay marker creation or startup replay | SakuraAdditivePairwiseGPModel and useZenLearningLab |
| Zen history | Current A/B history envelope only; no v1 click reinterpretation or historical profile inference | useZenLearningLab and typed model contract |
| FeedTempo checkpoint | Current schema only; old checkpoints are not projected as absent | FeedTempoProfileCheckpointRepository |
| Furin daily receipts | Exact V2 `{ version, dateStr, fullSite, global, sites, siteEnds }`; V1 or malformed presence rejects untouched. No import of session shown markers or synthetic presentation receipts | furinDailyReceiptContract, FurinDailyReceiptRepository and the existing serialized furinDailyPolicy writer |
| Cooling curve settings | Exact `coolingCurve` in `settings.core`; only an absent key receives its policy default. Present invalid settings and retired `globalFrictionLevel` reject unchanged; explicit development-profile reset only | coolingCurvePolicy, settingsCommandContract, SettingsDocumentRepository and settingsCacheState |
| IndexedDB | Exact V1 store/index topology; fresh creation only; version/schema mismatch rejects | DBManager and dbSchema |
| CLSE | Strict canonical baseline read; explicit reset/import may replace unreadable data through its existing lifecycle | BaselineManager and CLSEService |
| Security credential separation | Exact full wrapped `entropy-security-vault` V1 to `entropy-log-key-vault` V1 only after current passphrase proof; preserve AES/HMAC keys and record ID | KeyMaterialRepository serialized `separateVaultProtectionKeys`, Dashboard-only route; first release compatibility review owns retirement |

Current Zen envelopes contain no migration marker fields. Historical markers,
old history versions and unversioned prediction records reject; no decoder,
old-model reset or boot-time migration replay remains.

The 2026-10-14 Lens presentation/default/curve refinement preserves all five
visual setting keys and their numeric shape. Existing ON/OFF and strengths
remain unchanged; new defaults apply only at the existing absent-state boundary,
and recommendation changes require an explicit command. Bootstrap cache
generation 6 invalidates only derived compiled visual snapshots so the updated
brightness mapping and late enabled-grayscale curve cannot reuse old values.
It is not a user-data migration, profile reset or settings rewrite.

The P1-B Furin cutover requires an explicit development-profile reset for a
profile containing V1 `nudge.daily_receipt`. Its former Global-wide suppression
and session shown markers cannot prove which Site goal was actually conveyed.
The current reader reports `FURIN_DAILY_RECEIPT_VERSION_UNSUPPORTED:1` and keeps
the record unchanged; it does not derive `siteEnds`, delete the row, or mint
`actual_presentation` evidence. An absent row may receive its first V2 record
from the normal actual-presentation writer. Follow the
[development-profile reset runbook](../../operations/runbooks/pre-release-development-profile-reset.md)
when the operator chooses to reset; this schema change does not authorize an
automatic reset.

Cryptographic key/envelope/vault versioning and secret snapshot authorization
must follow [Local Security Vault](../security/local-security-vault.md).

P1-C retires the pre-release `globalFrictionLevel` key and its 1–5 selector.
`coolingCurve` owns the single preset and four family modes; `advanced` is an
exact nullable field from its first version. A stored predecessor key is not
mapped to a preset or removed during hydration/import. Current contracts reject
it and preserve the document for the operator-selected full-profile reset above.
An absent `coolingCurve` is initialized at the existing settings default boundary,
without changing any user's ON/OFF choices or Barrier consumption interval.
A passcode prompt does not itself encrypt a
backup. Version changes must not introduce unauthenticated decrypt, replace a
missing configured key, or store cleartext proof in a migration journal.

The narrow `check:storage:versioning-policy` guard prevents the removed runtime
chains from returning. Its implementation is `scripts/ci/check-storage-versioning-policy.mjs`;
it does not replace semantic, lifecycle or crash tests. A future exception must
name its released source, decision record, owner and deletion deadline in this
ledger, and update the guard in the same reviewed change. The sole narrow
pre-release exception is the explicit credential separation above. It is not
automatic repair: invalid/unknown/retired presence still rejects untouched,
ordinary unlock preserves its format, and source record replacement is one
awaited Chrome-local commit. Session binding follows that committed record;
failure keeps log admission closed and the named recovery reason explicit.

## Release 1 gate

The 2026-10-14 protection-charge cutover sets daily/hourly stats fact schema to
V2. Mandatory domain `protectedActive`/`hourlyProtectedActive` and hourly delta
`protectedActive` cannot be inferred from V1 observed totals or optional intervals.
Typed reads and snapshot import reject V1 or missing fields without rewriting or
removing the source. Only fresh absent facts initialize V2. Existing development
profiles may use the explicit full-profile reset owner; ordinary load/reload never
resets them. DB topology/version, snapshot envelope and the independent stats
event schema remain V1. This is a pre-release contract cutover, not a public
upgrade transition or an implicit migration.
Bootstrap cache generation 7 invalidates only disposable compiled protection
snapshots derived from the earlier observed-time goal basis; it does not alter
settings or reconstruct old statistics.

Release operations records the first public baseline with exact identifiers for:
database topology, each independently versioned document/model, snapshot format,
crypto envelope and key-vault contract. Version numbers already used in
development are not proof that a public upgrade path exists.

Before the first release:

- [ ] Inventory persisted entrypoints and classify every old-format branch.
- [ ] Remove pre-release converters and import leniency together with their calls.
- [ ] Verify absent-state initialization still works; current reads do not write.
- [ ] Verify malformed/current, older and newer presence reject without removal.
- [ ] Verify explicit reset still works even when normal hydration fails.
- [ ] Verify current encrypted export/import round-trip, key ownership and exact preflight.
- [ ] Run the declared architecture/storage/security checks and lifecycle tests.
- [ ] Validate a fresh disposable release profile; do not reset a personal profile.
- [ ] Record the exact published build, schema identifiers and check evidence.

## Public-release transition decision

Before a later release changes a durable shape, the feature data owner and
platform storage owner must approve one decision record containing:

1. Exact source and target versions, affected keys/stores/indexes and readers.
2. A release compatibility matrix: supported direct upgrades, skipped-release
   upgrades, fresh install, imported versions and unsupported versions.
3. Lossless mapping rules and explicit treatment of facts that cannot be derived.
   A conversion may report unavailable evidence; it may not invent observations.
4. The physical transaction/activation design, resource bounds and rollback plan.
5. Security review for permissions, passcode proof, key availability, encrypted
   payload integrity and backup handling.
6. Test fixtures for every supported public source and failure boundary.
7. Named implementation/release owners, removal deadline and the gate that blocks
   shipping before migration completion criteria pass.

A semantic/schema change increments the owning version. Do not broaden the
current validator to accept arbitrary historical shapes. Migration decoding lives
in one explicit versioned transition owner, outside normal typed reads.

## Atomic and resumable transition protocol

The background profile mutation owner is the only mutation admission authority.
A feature cannot start a private converter during a read.

1. **Admit and inspect.** Verify the exact source manifest and security
   prerequisites; check available space. Capture the current profile generation
   and block conflicting settings/history writes. Drain all admitted owners.
2. **Prepare.** Persist a bounded migration journal containing migration ID,
   source/target versions, source generation, stage, cursor and verification
   result. Exclude passwords, session tokens and raw content from diagnostics.
3. **Stage.** Write target data under a new generation/namespace in bounded
   IndexedDB transactions. A batch and its cursor commit together in that same
   backend transaction. Stable row IDs make retry idempotent. Preserve the source.
4. **Verify.** Validate the complete target with current strict validators and
   declared invariants: counts, identities, references, chronology, crypto
   integrity and policy semantics. Record verifiable completion before activation.
5. **Activate once.** Switch one authoritative version/generation manifest only
   after every required backend is ready. Readers and writers require that
   manifest; mixed source/target generations are never a valid read.
6. **Resume.** On MV3 worker recreation, inspect the durable journal and manifest.
   Resume the exact unfinished stage or surface a blocked state. Never infer
   completion from elapsed time, a RAM promise or the mere presence of one row.
7. **Retire.** After activation, invalidate caches, perform the existing
   fresh-worker/readiness handoff and verify consumers. Remove source staging only
   after the documented rollback retention period and an explicit cleanup stage.

Chrome-local and IndexedDB do not share an atomic transaction. A transition
spanning them must implement generation staging plus a single activation fence,
or use another reviewed design that proves the same all-or-nothing visibility.
A sequence of unrelated writes followed by a success flag is not sufficient.
Unavailable space, blocked connections or verification failure leave the source
intact and return an actionable failure; they do not trigger profile deletion.

## Downgrade, import and lifecycle rules

A build must reject a newer unsupported durable version before writes. An older
binary may not remove fields, lower a version or reinterpret a target row.
Rollback is allowed only when its decision record proves the older build can
read the still-authoritative source or supplies a verified reverse transition.
Otherwise keep the newer state and require the supported build.

Import is a separate versioned ingress. Parse and preflight a private immutable
copy before quiescence. Reject unsupported/future envelopes without touching
backends. Convert only explicitly supported public sources through the same
transition owner, then validate current output. Current snapshots are encrypted, replace-only and contain the complete source
keyring. Restore requires the backup passphrase and defaults to the current local
key record; an explicitly supplied strong `restorePassphrase` selects optional
log-only passphrase protection. Existing valid full wrapped profiles are never
automatically converted; the explicit credential separation is the sole named
transition. All three record variants use the same typed owner and exact
discriminator validation. There is
no portable/secret-omission mode or merge. Any future portable format
needs a separate version and security decision. Import/export requires the
security owner's authority; imported flags cannot authorize themselves.

Reset, import and migration cannot overlap. Every staged write and completion
receipt binds the admitted generation. A reset/restore rotates that generation,
cancels stale work and drains all participating owners. Analytics erasure must
not resurrect observations from a retained staging area. A lock during migration
stops secret access and resumes only through fresh security admission.

## Required tests and release evidence

| Test | Required result |
| --- | --- |
| Each supported public source and skipped-release source | Correct target, source untouched until activation |
| Fresh/missing optional state | Declared bootstrap only; no historical decoder |
| Malformed current / unknown old / unsupported future | Exact error and byte-preserving failure |
| Worker stopped at every journal/batch/activation boundary | Deterministic resume; no duplicate facts or half-visible state |
| Concurrent read/write and stale generation | No mixed view; stale writer cannot commit |
| Quota, write rejection, blocked DB and crypto failure | No activation, no deletion, retry retains source |
| Reset/import/analytics erasure during transition | One lifecycle authority, no late resurrection |
| Supported downgrade or unsupported downgrade | Verified reverse path or pre-write rejection |
| Current and supported imported snapshots | Strict preflight, security boundary and post-import readiness |
| Cleanup and removed converter | Deadline enforced; no runtime old-key read or dangling API |

Evidence is local and bounded; do not add server telemetry to measure migration.
Release operations owns the compatibility matrix and publish gate; platform
storage owns transaction/journal/activation proofs; feature owners own semantic
fixtures; security owns secrets and authorization; QA owns crash and lifecycle
coverage.

## Expiration and removal

Each supported historical converter declares an earliest removal release and
date at introduction. Default review is after two stable target releases and
90 days, whichever is later; this is a review deadline, not permission to erase
an offline user's data. The release owner verifies supported-source coverage and
announces any end-of-support policy before deleting a public upgrade path.

When support ends, remove the decoder, fixtures that assert its availability,
registry entry and temporary exception in one change. Keep rejection tests for
unsupported versions. If direct upgrade is no longer supported, ship an explicit
preserving error and documented supported intermediate release or offline
conversion route. A user can skip releases; a disappeared converter never
licenses a silent reset.
