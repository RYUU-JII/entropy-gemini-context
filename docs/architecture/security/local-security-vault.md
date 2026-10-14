# Local Security Vault

- Status: Active
- Owner: platform security, background runtime
- Last validated against code: 2026-10-09
- Path policy: current-only
- Canonical for: local key wrapping, protection/log admission and encrypted backup lifecycle

## Scope and threat model

Entropy remains device-local and starts without a user password. A random local
keyring encrypts detailed logs but stores their key in the trusted browser profile.
This default does not protect keys against someone copying that profile.
Optional data locking protects the log AES key with a user passphrase. Protection
HMAC keys remain locally available so site protection and aggregate statistics
continue while detailed logs are locked. Settings, aggregate statistics, model
state and protection keys remain readable in the profile. This is not whole-profile
encryption. Encrypted exports protect the complete snapshot with an independent
backup password. There is no server, key escrow or password recovery.

Extension resources are local-only: CSP closes remote resource destinations.
Site icons use bounded provided/persisted data or Chrome's extension-owned
`_favicon/` cache endpoint with server fallback disabled; a miss shows a local
monogram. Optional host permission does not authorize remote icon downloads.
Content isolated-world transport primitives have their own source guard. Ordinary
navigation is outside this boundary. See the
[security decision](../../decisions/security/selective-host-permission-security-decision.md).

This design does not protect a compromised OS, browser or trusted extension page
while unlocked. JavaScript strings cannot be reliably zeroized. Temporary byte
buffers and UI proof fields are cleared; passwords are never persisted. CSP,
trusted storage access and sender authorization remain independent requirements.

## Canonical owners

| Concern | Owner |
| --- | --- |
| Fixed KDF, bounds and authenticated envelopes | `src/platform/security/vaultCryptography.js` |
| Public status/admission schema | `src/platform/security/securityVaultStatusContract.js` |
| Strict current key-record discriminators | `securityKeyRecordContract.js` |
| Serialized key ownership, preparation and explicit separation | `KeyMaterialRepository.js` |
| One durable local record | typed `KeyStore`, `keys.security_vault` |
| Digest-bound unlocked session | typed `SecurityVaultSessionStore`, `runtime.security_vault_keyring` |
| Trusted access before secret reads | `StorageTrustCapability` |
| AES/worker references | `CryptoService`, `encryptedLogContract`, crypto worker |
| New detailed-log admission and receipt | `EventLogRepository` |
| Status/enable/unlock/change/remove/separate authorization | `securityVaultMessageRoutes.js` |
| Protection-ready startup and shared resume | `BackgroundBootstrapCoordinator` |
| Dashboard/Popup admission and inline unlock | shared vault client/controller, vault boundaries, `DataLockPanel` |
| Encrypted snapshot preflight | platform `storageSnapshotService` |
| Replace/drain/epoch/response ACK | existing background snapshot/profile mutation owners |

Feature code cannot read raw keys or create another vault. New key types must
extend the typed versioned owner. Settings PINs never replace encryption phrases.

## One persistent record and strict formats

The sole `keys.security_vault` slot has three explicit V1 discriminators:

| Format | Exact payload | Admission |
| --- | --- | --- |
| `entropy-local-keyring` | `format,version,id,keyring` | Protection and logs available without a phrase |
| `entropy-log-key-vault` | `format,version,id,protectionKeys,envelope` | Protection available; log AES requires a valid session |
| `entropy-security-vault` | Existing authenticated full-keyring envelope | All keys require a valid session until an explicit separation |

Local keyrings contain independently random 256-bit AES, domain HMAC and CLSE
HMAC secrets. Log-only `protectionKeys` has exactly `version:1,domainHmacSecret,
clseHmacJwk`. Its inner `entropy-log-key-envelope` V1 wraps exactly
`{version:1,logCryptoJwk}`. AAD binds the canonical outer ID and protection keys;
the session digest binds the complete persisted record. Malformed/unknown records
reject without another source or shape. Retired individual raw keys remain
incompatible, not bootstrap absence.

AES-256-GCM uses fresh 96-bit IVs and 128-bit tags. PBKDF2-HMAC-SHA-256 uses a
fresh 128-bit salt and exactly 600,000 iterations. Fixed headers are authenticated.
Passphrases need at least 16 Unicode code points and at most 128 UTF-8 bytes;
one-character repetitions and malformed Unicode reject. Spaces and Unicode are
preserved exactly. Exact fields, versions, algorithms, canonical base64url and
size bounds are checked before derivation; imported work factors cannot vary.

Both Chrome storage areas must be `TRUSTED_CONTEXTS` before secret access.
Sessions bind the unwrapped keyring to the exact record ID and SHA-256 digest.
Stale/malformed sessions remain locked, never a second durable source. Browser
restart/reload/disable/update clears sessions; MV3 worker suspension preserves
them. Local mode restarts directly. Modern optional locks restart protection
directly with only detailed logs locked.

## Protection and detailed-log admission

Public status has `state`, `version:1`, `mode`, `lockScope`, `protectionReady`,
and an optional explicit diagnostic `reason`. The shared strict contract accepts:

| State/mode | Scope | Protection ready |
| --- | --- | --- |
| `unlocked/local` | null | true |
| `locked` or `unlocked/passphrase`, log-only record | logs | true |
| `locked/passphrase`, full wrapped record | profile | false |
| `unlocked/passphrase`, full wrapped record | profile | true |
| `setup_required` or `incompatible`, null mode | null | false |

`ensureLocalVault` is the sole automatic preparation owner. Inside profile mutation
admission, it provisions only genuine absence and verifies the committed record.
Boot and trusted status await it; repository getters remain read-only. Invalid
presence and backend errors do not regenerate or erase keys. Preparation errors
pause readiness and surface their exact code; an explicit successful status retry
resumes the shared attempt. A closed lifecycle cannot use that retry to write.
When a validated status blocks protection, bootstrap preserves its optional
canonical `reason` code; only statuses without a reason use the state code.
This diagnostic propagation does not change admission or incompatible data.

Listeners register synchronously. Bootstrap and Dashboard generation binding
require `protectionReady`, not log AES. Log-only locked profiles retain Main,
settings, site controls, protection and consented aggregate recording.
`requireProtectionKeys()` admits domain/CLSE HMAC for those profiles.
`requireUnlocked()` and log AES access still require log admission.

`EventLogRepository.append` refuses new detail before the plaintext queue with
`{accepted:false,reason:'data_locked'}`. A persisted append returns
`{accepted:true}`. Callers consume that receipt rather than reporting skipped
logs as saved or as storage failures. Already accepted/persisted logs are never
silently dropped. Unlock does not reconstruct missing detail. Empty flush, clear
and profile mutation drain need no AES. Raw encrypted store reads retain strict
unlock requirements. Log record V2 authenticates version and timestamp as AAD;
old/plaintext records reject and a failed read never replaces keys.

Log lock/denial invalidates AES/worker references through `onLock`. HMAC consumers
subscribe to `onProtectionKeysInvalidated`; log-only denial cannot interrupt
concurrent signing. Clear, restore and key replacement invalidate both scopes.
Credential-only successful wrapping preserves admitted CryptoKeys. There is no
public manual-lock action; a future action needs an explicit drain/fence lifecycle.

## Explicit commands and preservation

Only the actual same-extension Dashboard may enable, unlock, change, remove or
separate protection keys. Dashboard and Popup may read prepared status. Requests
accept exact declared fields and never return keys/envelopes. Routes bypass
full-init readiness, preserving sender checks and profile mutation leases through
the response. Content scripts and arbitrary extension documents cannot invoke them.

- `SETUP_SECURITY_VAULT({passphrase})` wraps the existing local log key, or
  provisions genuinely absent keys, using the new log-only format.
- `UNLOCK_SECURITY_VAULT({passphrase})` authenticates the existing record and
  installs its bound session without changing its representation.
- `CHANGE_SECURITY_VAULT_PASSPHRASE({currentPassphrase,newPassphrase})` preserves
  keys and the current discriminator, including a full wrapped record.
- `REMOVE_SECURITY_VAULT_PASSPHRASE({currentPassphrase})` verifies proof and
  persists the same keys in the local record.
- `SEPARATE_SECURITY_VAULT_PROTECTION_KEYS({passphrase})` is the sole explicit
  full-wrapped V1 to log-only V1 transition. It authenticates current proof,
  preserves ID and all three keys, then replaces the one record. Logs/settings
  and profile generation do not change. Wrong proof/malformed data leave source
  bytes untouched. It never runs on status, boot or ordinary unlock.

The explicit separation is a named current credential transition, not an old-key
fallback or general migration. Its source remains supported until the first
release compatibility review explicitly retires it. Unknown/retired records still
reject. The storage versioning policy records this narrow exception and exit.

Repository mutations serialize. Public reads await the mutation barrier and retry
only an overlapping snapshot against the completed owner revision; private
mutation reads avoid self-deadlock. Consumers use the canonical background
instance. Another document cannot create an independent key consumer/barrier.

Wrapping commits before its new session binding. A failed durable write preserves
the old session. Durable success followed by session failure reports
`SECURITY_VAULT_PASSPHRASE_CHANGED_SESSION_COMMIT_FAILED`, clears the session and
invalidates log consumers. Cleanup failure reports
`SECURITY_VAULT_PASSPHRASE_CHANGED_SESSION_CLEAR_FAILED`; current admission remains
locked even if a stale session row persists. The committed phrase is effective;
status retains the reason until successful unlock. Protection admission follows
the committed record scope. Remove verifies proof, clears session, then commits
local keys. Local commit failure leaves the wrapper intact and reports
`SECURITY_VAULT_PASSPHRASE_REMOVAL_COMMIT_FAILED` for unlock/retry.

## Dashboard flow and lifecycle ownership

`DashboardAdmissionBoundary` owns one lifecycle subscription, one vault controller
and the profile mutation controller for Settings reset and encrypted restore. Closed/failed lifecycle reaches recovery before any
key-dependent initialization, even when a partial reset has removed keys. Old
documents stay sealed through COMPLETE and await the runtime handoff.

Healthy fresh use reaches Main without a password or recording setup page.
The existing first-site editor offers initially unchecked recording. Site plus
complete five-key policy commit through one canonical serialized command;
explicit browse commits OFF. UNSET still denies collection. Existing chosen
profiles are never overwritten. First Vision, capacity, progression, permissions
and scene admission keep their existing owners. Legacy full-wrapped locked
profiles use the explicit separation action once. Modern log unlock lives inline
in Settings or the backup export disclosure. Presentation shell release cannot
acknowledge security/profile/Main readiness.

Settings PINs authorize sensitive/destructive actions independently of log keys.
An encrypted backup does not bypass a configured PIN. The reset UI forwards empty
proof when no PIN is supplied; only `RESET_AUTH_REQUIRED`/`RESET_AUTH_FAILED`
ask for PIN correction. Other failures show their exact diagnostic code.

Initiating reset/restore owners retain successful receipts before response ACK.
Lifecycle closure unmounts normal consumers without discarding pending ownership.
A synchronous ACK-start failure retries only that receipt, never the destructive
request. Failure without a successful receipt yields to canonical lifecycle
recovery. Secret drafts clear on cancel/inactivity/success; controls publish only
acknowledged status. No UI action erases or converts data implicitly.

If the initiating document closes before ACK, a new Dashboard may receive the
exact `PROFILE_MUTATION_RUNTIME_ADMISSION_CLOSED` error while reading vault status
before generation readiness can run. The root lifecycle owner re-reads the
canonical lifecycle; only a durable COMPLETE at the same captured generation
reaches the existing handoff recovery action. That explicit action constructs the
existing exact descriptor from the lifecycle and sends only
`PROFILE_MUTATION_RESPONSE_ACK`, for either reset or restore. It does not recreate
the destructive request, initialize keys or admit normal consumers. Background
still validates trusted Dashboard sender, COMPLETE, local `reload_pending` and
exact operation/resetId. Explicit negative ACKs retain their code and retry;
reload-closed channels do not turn committed data into a failed mutation. Other
vault failures/locked states and mismatched generations retain strict admission.

## Encrypted backup and restore

Every export is `entropy-encrypted-storage-snapshot` V1 under an independent
strong backup phrase, containing complete settings/history/models/keyring.
Export requires log unlock; the inline export form supplies that step. Errors do
not omit keys/datasets. No plaintext, secret-omission or merge mode exists.

Decrypted payloads are bounded to 32 MiB and outer files below Chrome's 64 MiB
message bound. Restore authenticates the backup, validates all current schemas
and log V2 records, and prepares the destination before destructive admission.
Prepared payloads remain in a module-private single-use capability, never runtime
responses. Wrong phrase/tamper/unsupported/oversized input leaves the profile
untouched. Restore uses existing configured PIN and explicit replacement proof.

Omitting `restorePassphrase` selects local mode. An explicitly strong value selects
new log-only protection; empty/null/weak values reject. The source PIN is restored.
Replace/drain/generation/ACK remain with the existing profile mutation owner.
Local restore starts directly; optional locked restore also starts protection
directly. Backend failure after admission follows explicit recovery, not a claim
of cross-backend rollback.

## Validation and release

Follow [Storage Versioning and Migration Policy](../storage/storage-versioning-and-migration-policy.md).
Vault, log and snapshot formats have independent versions; no public baseline
exists yet. Tests cover exact crypto bounds, Unicode, wrong proof, outer/header/
ciphertext/log tamper, stale sessions, concurrent HMAC versus log denial,
credential byte/key preservation, explicit separation, preflight preservation,
sender contracts and reset/restore receipt ownership. Real Chromium evidence must
prove first-site and browse flows, optional reload-lock with continued protection,
locked export refusal, unlock and same-key/log preservation in a disposable
profile. Unit tests do not replace that lifecycle proof.

Full at-rest encryption or server sync needs a separate reviewed data-shape,
network/auth and recovery design. Never upload local keys, a passphrase or raw
snapshot as an incidental transport payload.
