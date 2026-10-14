# Runtime Message Security Hardening

- Status: Active
- Date: June 5, 2026
- Owner: platform security
- Last validated against code: 2026-10-09
- Canonical for: release V1 runtime message sender authorization and High Security Mode
- Scope: MV3 runtime action sender authorization, extension-page data access, and destructive-action security
- Path policy: current-only

## 1) Threat Model

Entropy stores user settings, site rules, stats, local security metadata, and support snapshots on-device. The practical exfiltration risk is not a normal webpage directly reading extension storage. The realistic risk is a confused-deputy path where a sender reaches a background runtime action that returns or mutates sensitive local state without a strict sender boundary.

Primary attack paths:

1. A content-script sender attempts dashboard-only queries or mutations.
2. A compromised extension page attempts destructive storage or export actions.
3. A future runtime action is added without an explicit sender policy.
4. A browser profile compromise reads local extension storage outside the extension runtime.

## 2) Current Controls

1. Runtime action dispatch uses an explicit sender registry.
2. Unregistered runtime actions are denied with `UNREGISTERED_RUNTIME_ACTION`.
3. Sensitive dashboard, stats, storage-support, site-rule, preset, gate, and debug actions are extension-page scoped.
4. Content lifecycle actions are tab-scoped and retain handler-level tab/run validation.
5. Settings reads and writes use the settings access policy for redaction and write-key authorization.
6. Destructive storage actions keep passcode authorization where the local security policy requires it.
7. `StorageTrustCapability` sets the complete `chrome.storage.local` area to
   `TRUSTED_CONTEXTS` before persisted background bootstrap starts. Browser
   listeners still register synchronously during service-worker startup. A failed
   access restriction rejects startup; it never silently restores content access.
8. Content bootstrap reads use the narrow `CONTENT_BOOTSTRAP_SNAPSHOT` type route.
   It permits only `root_visual`, `friction`, and `language`, requires a trusted
   extension content sender with an integer frame id and HTTP(S) `sender.url`, and
   derives the hostname from that frame URL. Neither request fields nor `tab.url`
   can address another host. The route awaits the same storage-trust promise but
   does not await full bootstrap, which may itself be waiting for content startup.

9. Extension pages use own-origin-only connection and resource directives. The
   former HTTPS favicon exception is retired. Icon candidates cannot become
   remote fetch or image destinations; capture/presentation read Chrome's local
   extension favicon cache or validated image data. Missing images show the
   explicit monogram. Native network primitives are source-guarded across content
   isolated worlds as well as extension pages. This does not constrain ordinary
   user browsing or arbitrary trusted-code compromise via navigation APIs.

10. The compact content indicator opens its site's notebook through
    `OPEN_SITE_RECORD`, a trusted-extension-tab action owned by
    `trackingMessageHandlers/indicatorNavigationHandlers.js`. It requires an exact
    top-frame HTTP(S) sender URL and integer tab id, matches the request origin,
    then verifies the current browser tab and any pending navigation against that
    origin. The handler derives the canonical domain from the sender URL and opens
    only the own-extension `src/pages/dashboard.html?tab=sites&domain=...` route
    through the injected browser port. It accepts no destination authority from
    request domain or target fields, returns no site data, and does not expose the
    Dashboard as a web-accessible resource. Missing tabs, changed origins and
    failed tab creation return explicit errors.

11. The Gate document is not web-accessible. Its background owner navigates the
    exact existing tab to the own-extension `src/pages/gate.html` URL; no webpage
    iframe can embed this document. Gate queries and decisions still require the
    exact top-level extension document, current tab, session URL and document
    binding. Removing the former WAR entry grants no new runtime action or
    navigation authority.

Raw local access and local storage-change events are unavailable to content.
Content debug startup uses its existing page-local flags and explicit in-memory
debug leases. It does not refresh the extension-global Chrome-local debug flag;
that helper remains an extension-page capability. Development builds obey the
same content storage restriction as public builds.
The existing prepaint CSS remains the immediate visual owner; exact cached root
and friction handoff now adds a bounded runtime round trip. Content language
hydrates through the same narrow route. Authenticated `PROTECTION_UPDATE`
broadcasts invalidate that language read; `app_language` uses a full broadcast
and forces a snapshot even when the protection signature is otherwise unchanged.
Extension-page language read/subscription ownership remains
`RuntimeLanguageRepository`.

## 3) Sender Scopes

1. `extension_page`: dashboard, popup, gate, and extension-owned pages. Used for stats queries, protected snapshots, storage support, rule/preset mutation, debug actions, and destructive actions.
2. `trusted_extension_tab`: content-script senders with a trusted runtime id and a real web tab. Used for favicon capture, filter indicator requests, sender-bound site notebook navigation, nudge lifecycle callbacks, and field debug launch.
3. `trusted_extension_sender`: low-sensitivity reads or settings transport that must work from both extension pages and content scripts. Handler-level policies still redact sensitive settings and restrict content-script writes.
4. `privileged_settings_flow`: extension pages or internal no-url extension senders. Used for settings propagation.

## 4) High Security Mode

High Security Mode is stored in the security settings document as `highSecurityMode`.

When enabled:

1. A master passcode must be configured.
2. Destructive runtime actions require passcode verification even if reset guard was previously off.
3. Reset guard remains on while the mode is enabled.
4. If malformed current state enables High Security Mode without a passcode, destructive actions fail with `HIGH_SECURITY_PASSCODE_REQUIRED`.

The mode currently guards destructive local data actions. It does not encrypt all stats at rest, because blanket encryption would add reliability and recovery cost without clear product value for most users.

### Security setting mutations

`SettingsService` reads the latest typed `DEFAULT_SECURITY_SETTINGS` snapshot
inside its serialized mutation lane for any security-key patch. Replacing or
removing an existing passcode, disabling an enabled destructive-action guard, or
disabling an enabled fixed-lock policy requires the current passcode. The final
state must satisfy `highSecurityMode -> configured passcode + reset guard`.
Nonempty replacement hashes must satisfy the canonical PBKDF2 V1 envelope.

The Dashboard supplies current-passcode proof through the security channel's
isolated owner command. Plaintext proof is transient request authorization; it
must never enter persisted settings, general batching, queued retry state, or
diagnostic output. UI validation is feedback only; the background owner enforces
the policy against the latest committed state.

### Cryptographic boundary

Passcode V1 fixes PBKDF2-SHA256 to 210,000 iterations, a random 16-byte salt and a
32-byte digest. Stored/imported parameters must use that exact iteration string
and canonical unpadded base64url encodings. A malformed envelope fails strict
authorization before running the KDF, preventing weaker imported work factors or
unbounded attacker-selected work. Changing the work factor requires a separate
versioned contract rather than silently reinterpreting V1 records.

Normal use requires no password. The admitted preparation owner creates one strict
local keyring only for genuine absence. Optional locking uses the current
entropy-log-key-vault V1: protection HMAC keys remain trusted local, and only log
AES is wrapped by entropy-log-key-envelope V1 with fixed PBKDF2-SHA256 600,000
iterations, random salt/IV and authenticated outer ID/protection keys. The same
passphrase bounds and no-normalization rules apply. Session binding covers the
complete persisted record. A modern locked status retains protectionReady:true;
site protection and aggregate statistics continue, while new detail admission
returns an explicit data_locked receipt before queuing plaintext. Log unlock and
full backup export still require the AES key.

Full-wrapped entropy-security-vault V1 remains exact and is not automatically
converted. Only Dashboard's SEPARATE_SECURITY_VAULT_PROTECTION_KEYS with current
passphrase proof replaces it with the log-only record, preserving ID and all keys.
Ordinary unlock preserves its format. Unknown/retired/malformed presence rejects
without deletion or regeneration. Public status validates five explicit core
fields plus a bounded optional diagnostic reason. Enable/unlock/change/remove/
separate/status bypass full-init but retain sender and profile-mutation admission.
Log-only invalidation cannot interrupt protection HMAC signing; reset/import/key
replacement invalidate both key scopes. See Local Security Vault for exact owners.

Event log record V2 authenticates the format/version/timestamp as AAD. Unknown
versions, malformed byte arrays, wrong keys and altered ciphertext fail explicitly.
Crypto workers receive nonextractable CryptoKeys by structured clone, and vault
lock/reset/restore invalidates key caches and terminates workers. Settings, domain
rules, statistics and model data remain plaintext on-device; the vault does not
provide whole-profile encryption or protect a compromised running extension.
The existing settings-protection PIN remains a separate local-action guard.

Every backup is an `entropy-encrypted-storage-snapshot` V1 envelope encrypted
under a separately supplied strong backup passphrase. The complete current-schema
payload, settings-security document and keyring are encrypted together; there is
no plaintext/portable/secret-opt-in backup mode. Maximum plaintext payload size is
32 MiB, keeping the base64 envelope within Chrome's [64 MiB JSON message limit](https://developer.chrome.com/docs/extensions/develop/concepts/messaging#message_size_limits). Preflight authenticates the envelope and all log records, validates every
current settings/progression/IndexedDB shape, and prepares the destination key
record before destructive lifecycle admission. Restore is replace-only and
defaults to local mode when `restorePassphrase` is omitted; an explicitly supplied
strong phrase selects log-only wrapped mode and ends log-locked with protection ready. Empty/weak supplied phrases
reject rather than choosing local mode. The prepared payload stays behind an ephemeral
one-shot capability and never becomes a runtime response or stored cache.

## 5) UX Impact

The explicit registry should not reduce normal user experience. It preserves required content-script flows while closing accidental action exposure.

In Settings, High Security Mode is labeled by its concrete behavior as
`Keep lock settings fixed` (`잠금 설정 고정`). The control keeps destructive
action passcode protection enabled and prevents passcode removal. It must not
be described as encryption or as broader privacy protection.

Potential future UX-affecting controls should be introduced behind High Security Mode:

1. Shorten export/import authorization windows.
2. Add profile-compromise warnings near export/import and reset controls.
3. Optionally reduce cached diagnostic detail and blocked URL previews.

## 6) Change Policy

The default-deny sender registry, user-visible High Security Mode, and strict
destructive-action authorization are the release V1 baseline. Any future
authorization or storage-at-rest contract change requires an explicit security
decision and must update the sender-policy tests and CI guard in the same
change. Do not add speculative compatibility or alternate sender paths.

## 7) Verification

1. Run `node scripts/ci/check-runtime-message-sender-boundaries.mjs`.
2. Run `node scripts/ci/check-security-surface.mjs`.
3. Run focused tests for action sender policy, settings contract, destructive action security, nudge lifecycle, and favicon capture.
4. Run `tests/indicatorSiteRecordNavigation.test.js` for the indicator's fixed
   destination, trusted top-frame sender, current-tab origin and failure contract.
