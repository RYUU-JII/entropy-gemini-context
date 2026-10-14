# 02. Runtime Storage Boundaries

- Status: Active
- Owner: platform storage
- Last validated against code: 2026-08-11
- Path policy: current-only
- Canonical for: runtime storage owner/path topology

## Invariants and current implementation policy

- `platform/storage/security/StorageTrustCapability` restricts the entire
  Chrome-local area to `TRUSTED_CONTEXTS` before persisted background bootstrap.
  Browser listeners register synchronously; initialization and early content
  reads await the same access-control promise and fail explicitly on rejection.
  Content never reads local settings, keys, or local change events directly.
  `CONTENT_BOOTSTRAP_SNAPSHOT` is the read-only content seam for this frame's
  `root_visual`/`friction` cache and the runtime language. Its background route
  derives the host from HTTP(S) `sender.url`, rejects caller address overrides,
  and remains independent of full initialization to avoid content-start cycles.
  Content language invalidation uses the existing authenticated protection
  broadcast; language writes force a full snapshot through the one settings
  propagation coordinator.
  Content debug startup uses page-local flags and explicit in-memory debug leases,
  without reading the extension-global Chrome-local debug flag. The trusted-area
  restriction applies to development and public content runtimes alike.
  Debug reload-observe persists its page-local enable/open/capture flags through
  `platform/browser/pageLocalStorage`; a failed write stays visible and prevents
  reload. It cannot recover by writing an extension-global debug flag. Both
  build-selected friction-debug entries expose only page flags and leases.

Contextual guidance uses `platform/storage/guidance/GuidanceRepository.js`.
`guidance_state` is a bounded local receipt/installation/delivery document;
`guidance_presentation_session` is a generation-bound session claim and dev
preview. Both are typed and registered surfaces. Full reset drains and clears
them; analytics reset preserves them; snapshots exclude them. See
[Guidance Runtime](../architecture/guidance/guidance-runtime.md).

분류 기준은 [Document System](../governance/document-system.md#계약의-성격과-변경-절차)을 따른다.
이 문서의 불변 조건은 데이터의 기기 내 보관, 데이터별 단일 canonical owner와
source of truth, typed storage/command 경계, feature의 raw backend 우회 금지,
실패를 성공이나 대체 데이터로 숨기지 않는 명시적 오류 처리다.

구체적인 owner 파일명과 경로, `chrome.storage.local` / `chrome.storage.session` /
IndexedDB 사이의 데이터 배치, key와 schema topology는 현재 구현 정책이다.
현재 정책도 구속력 있는 계약이며 기존 guard의 차단 대상으로 유지된다. 이를
바꾸려면 불변 조건을 보존하면서 구현, 소유 문서와 guard를 함께 갱신한다.
특히 backend나 schema 변경은 지속성, 세션/worker 재시작, reset과 import의
의미를 보존하고 [storage target](../architecture/storage/storage-architecture-target.md)의
기존 migration 결정 요건을 따른다. 이 분류는 legacy read나 보조 저장소를
새로운 source of truth로 허용하지 않는다.

## Data-pipeline verification (2026-09-06)

Protection goal charge uses mandatory V2 stats facts `protectedActive` and
`hourlyProtectedActive[24]`, recorded by the existing foreground collector and
typed hourly/daily persistence owners. `projectProtectionBudgetWindow` is the
shared disposable activity-day projection for Sites, curve, Site Furin and
Global. Policy registration/release seals the old segment in the existing stats
mutation lane before canonical settings publication; goal edits do not reset
usage. No extra clock, backend or read-time reconstruction participates. V1 or
missing charge facts reject untouched; DB topology and snapshot envelope remain
V1. See the storage target and versioning policy for the explicit development
profile cutover.

Gate pruning first-use completion is small presentation metadata owned by
`platform/storage/presentation/GatePruningPresentationStore.js`. Its typed local
store owns `presentation.gate_pruning`; only Gate's successful selected-tab close
writes it under profile-mutation admission. Full app reset clears it; analytics
reset preserves it. It contains no browsing data and is excluded from snapshots.
The authorized Gate session query projects it; the UI never writes it.

- Chrome local/session callback adapters reject `chrome.runtime.lastError` before
  acknowledging reads/writes/removals; Promise ports preserve rejection semantics.
- RuntimeLanguageRepository/Store own language query/subscription only.
  `app_language` commands use the preference command channel, generation stamp,
  and SettingsService. Bootstrap and i18next events do not write `settings.ui`.
- Dashboard generation readiness awaits strict settings hydration between durable
  generation checks. Only branded physical-contract failures in core/rules/UI
  settings produce `settings_profile_recovery_v1` and admit a reset-only surface;
  security corruption keeps canonical authentication strict. Terminal reset
  clears settings without hydrating the rejected document. Snapshot preflight
  applies the same strict document/value contract before profile quiescence and
  preserves present `{}` versus absent `null` through import/export. The
  background owner captures one private snapshot before asynchronous admission.
- A `filterSettings` command carries sparse changed feature/field intent. The
  canonicalizer merges it against the latest SettingsService cache; persisted
  documents and ACKs remain complete snapshots. This prevents sibling-field loss
  across independent dashboard documents. `schedule_failed` is a saved command
  with an explicit apply error, never an indefinitely applying command.
- Activity-day start policy remains `monitor_cycleSettings` in local settings;
  in-flight cycle checkpoints remain session data. User-day usage is a disposable
  hourly-fact projection, not another daily aggregate owner. Calendar facts and
  finalization remain owned by stats persistence.
- CLSE daily-summary `dateStr` rows are durable completion markers. A heartbeat
  discovers retained source buckets and fills missing completed local dates before
  source pruning, including after a worker restart. Completion waits until 00:05
  to close rolling five-minute windows; the RAM cursor is only an optimization.
  This adds no session cursor or parallel summary store. Failed writes prevent
  cursor advancement and pruning; already-pruned historical input is not invented.
- Projection reads carry per-projection response generations and error/readiness
  state. Physical settings changes invalidate only affected projections; visible
  consumers own refresh demand. A hidden or parked view does not poll for data.

## Current settings hydration ownership

`ensureSettingsCache` guarantees canonical committed-cache hydration, rather
than waiting for every pending writer. An already hydrated read still checks
profile/preparation admission and sees the complete old raw-rule/hash snapshot
until publication, then the complete new snapshot. Unloaded or failed-cache
state must hydrate through the Settings FIFO. This avoids a Settings-to-Stats
policy-boundary deadlock without introducing another cache or recovery source.
The Settings FIFO calls the kernel-bound `createTrackingPolicyMutationOwner`:
the existing Stats FIFO seals the old foreground prefix, persists settings and
publishes its canonical private readback at one admitted timestamp. Registration
observers and propagation run after that Stats boundary is released, so they can
await Stats work. Sealing failures prevent the settings write; a successful
settings write retains its ACK with explicit post-commit failure reporting.

SettingsService reads the current settings document in its mutation lane.
SettingsPersistenceCapability validates the exact present filter-settings
contract for reads and writes; hydration never performs a storage mutation.
Retired or incompatible settings fail explicitly. Development profiles use the
whole-profile reset in
`docs/operations/runbooks/pre-release-development-profile-reset.md`; startup
cannot convert or erase predecessor settings as a recovery path.

## Purpose

Gate history keeps ownership in the existing typed stores: `InterventionEffectStore`
commits exposure/effect and immutable first-event `historyFacts`; `StatsAggregateStore`
commits `interventionHistoryReceipts` with hourly domain counters. The receipt is
aggregate provenance, not another policy source or retry queue. Daily summary
storage omits these receipts. Profile lifetime is still owned by the existing
profile mutation admission/drain. The precise optional V1 capabilities, capacity,
and explicit missing-fact behavior are in `storage-architecture-target.md`.

`runtime.intervention_admission` also holds the bounded `ensoCadence` capability
under the same serialized admission writer. It is an operational browser-session
interval policy (enabled/interval, accrued milliseconds, observation/reset/away
watermarks and revision), independent of analytics consent and historical stats.
Existing Tracking browser/idle ingress and inventory provide its foreground
receipts. A live anchor, one unsettled closed receipt and one exact content
receiver are worker-local; restart restores the committed counter but never
extrapolates the missing interval. See the Enso consumption interval section of
`docs/architecture/runtime/intervention-admission-runtime.md` for reset and delivery.

`runtime.intervention_admission` also owns a bounded optional `exposureWindow`
in the same typed session commit as ownership/recovery. Its first lifecycle
commit starts coverage; absent or trimmed history is unknown. Read-only runtime
input composition uses this window alongside Tracking facts without a second
writer, stats reconstruction, new key, or IndexedDB decision read. The exact
shape and partial/open/disappeared semantics are owned by
`docs/architecture/runtime/intervention-admission-runtime.md`.

Confirmed foreground consumption uses the registered session checkpoint
`runtime.consumption_flow`, owned by `TrackingConsumptionRepository` and
`TrackingConsumptionLedger`. This bounded runtime projection and its applied
source watermark are one record; IndexedDB remains historical stats truth.
The same ledger's browser environment point is worker-local and appears only
on its read DTO. It is not in the checkpoint: worker recreation requires a new
point while retaining confirmed usage. No media elapsed time or recovery
grant is inferred from that point.

The ledger also owns bounded worker-local browser-audible continuity evidence
between stable existing batches. `ConsumptionMemoryService` runs in its
post-fact lane, joins foreground/media with admission exposure, and commits
`model_state.protected_consumption_memory_v1` through
`ConsumptionMemoryCheckpointRepository`. State and applied cursor are one
profile-epoch/revision CAS; no session mirror or stats-history reconstruction
exists. Source facts and derived model tasks have separate Tracking-owned tails;
profile quiescence drains both, while stats/protection do not wait for the
descriptive task. Model failures expose a failed read and diagnostic without
stopping source/protection execution. SettingsService's worker-local continuous
domain-usage admission proof bounds every joined interval and fences writes;
OFF/ON and first hydration do not certify earlier operational exposure. This
adds no persistent settings mirror. Runtime decisions receive only a warm
descriptive read, never an IndexedDB query. See
`docs/architecture/runtime/consumption-memory-runtime.md` for evidence limits,
reset/import behavior and the bounded Zen entry-intensity consumer. Derived
work retains one active and one latest pending observation; explicit erasure is
a barrier. Optional uncertainty bounds share the model row/CAS, and unresolved
admission intervals stop the commit cursor. The input assembler selects a value
once for the existing Gate session; UI reads never become model writes.
See `docs/architecture/runtime/tracking-consumption-facts.md` for the shared
scope, commit ordering, Gate read projection and incomplete recovery coverage.

### Inactive tab observation (2026-09-18)

`TabEvaporationManager` uses the typed `TabEvaporationCheckpointRepository` over
`RuntimeSessionRepository` for `runtime.tab_evaporation`. The checkpoint holds
sampled inactivity continuity across worker restart, not settings or removal
permission. The current settings owner and final browser read authorize removal.
The existing durable settings runtime-adapter stage owns reset on OFF, scope or
timeout changes; pending and failed resets prevent new sweeps. There is no
localStorage, IndexedDB or worker-RAM fallback. See the Memory Purge workflow map
for timing, cancellation and non-atomic browser API limits.

### Site Furin reflection coverage (2026-09-14)

The existing foreground sealer explicitly enables `recordActiveIntervals` only
for collection-admitted protected scope. The stats aggregator records optional
`activeUsageIntervals` alongside active totals and their watermark in the same
hourly IndexedDB row/transaction. This introduces no store, writer, session mirror,
raw content event or collection timer. Ordinary all-sites-minimal totals retain
their existing granularity. At most 32 exact intervals per domain/hour survive;
missing/trimmed timing is partial or unavailable coverage, never zero usage.
The activity-day query sends a read-only reflection DTO through the existing
protection runtime snapshot and Site Furin start message. Presentation cannot
change cadence, totals, goals, daily delivery or history. The chime spec owns
the gesture/graph contract and the storage target owns the optional row shape.

### Feed history durable admission (2026-09-07)

`FeedContentFlowHistoryAccumulator` produces permission-scoped, per-hour cumulative
observations. `statsCollector` owns receipt comparison, and the existing typed
`StatsAggregateRepository` barrier writes both facts and optional
`feedHistoryReceipts` in one hourly row transaction. The live protection owner
owns source ordering/TTL only; it cannot acknowledge or reconstruct historical
counts. There is no session mirror. Optional receipt absence denotes no receipted
contribution; malformed presence fails. Receipts inherit stats retention/export,
are validated against persisted bucket identity and supporting domain counts,
and are bounded to 256 source generations per hour.

Analytics erasure clears historical rows and installs a timestamp-only
`feedHistoryResetAt` fence atomically in the empty current-hour row. The same
history admission returns a reset request for a still-live pre-reset interval;
the producer rotates/rebases without replaying deleted observations. Full
profile reset keeps its terminal lifecycle. See the storage/stats/tracking
boundary map for transport loss limits and the current-only optional row contract.

### FeedTempo purpose admission (2026-09-07)

FeedTempo's IndexedDB model checkpoint is personal history, independently gated
from Enso runtime sensing. `feedTempoHistoryAdmission` in background composition
binds current precision-insights/CLSE consent, protected-site scope, SettingsService
change version, and the trusted live top-frame document to service reads and writes.
An ephemeral restore admission binds worker/settings/document generations; commits
must carry it. Expired admissions drop the episode and require a fresh canonical
restore for future observations, without replaying an old write or persisting tokens.
`FeedTempoPersistentProfileService` requires this admission; its typed checkpoint
repository requires `assertCommitAllowed`. The model-state CAS owner executes that
synchronous assertion after asynchronous database reads and immediately before put.
An asynchronous assertion is invalid. Other model classes retain their own admission
contracts; this optional low-level assertion does not grant them new storage access.
Already admitted writes are not retroactively deleted; disabling history suppresses
new admission and stale content hydration, while existing reset/deletion owners remain
responsible for deletion. Topology certificates remain separately owned functional
layout data, never a fallback source for personal pace learning.

runtime, messaging, storage의 최종 owner를 고정한다.
핵심은 `platform만 low-level을 소유한다`는 원칙을 물리 구조로 강제하는 것이다.

## Adaptive friction settings and runtime projections

Grayscale (`saturation`), blur, and Text Rhythm settings persist only
`{ isActive: boolean, value: true }` through the canonical settings owners.
Runtime-only `band` and physical `value` belong to compiled execution plans,
not settings. Background-owned bootstrap caches preserve that compiled profile
and modifier priority evidence; they must not strip it or re-normalize it as
settings. The profile and handoff owner contract is
`docs/architecture/runtime/friction-filter-injection-architecture.md` §3.4.
Normal reads remain current-only and never reset user data. There is no
pre-hydration artifact settings converter. Incompatible development shapes fail
without rewriting the source, under the
[Storage Versioning and Migration Policy](../architecture/storage/storage-versioning-and-migration-policy.md).

## Independent Execution Scope

이 문서는 독립 세션이 직접 수행할 수 있는 execution spec이다.

- 이 문서의 대상은 `platform/runtime/messaging/storage cutover`다.
- 이 문서의 세션은 storage public path와 low-level ownership을 새 canonical 구조로 강하게 점프시켜야 한다.
- 새 `platform/storage`를 추가하는 것만으로는 완료가 아니다.

## Big-Bang Cutover Mode

- public storage surface를 먼저 `platform` 쪽으로 고정한다.
- old `shared/storage` canonical path는 같은 세션에서 끊는다.
- raw backend access는 `platform/internal`로 몰아넣는다.
- 중간에 import error, failing test, broken wiring이 생기더라도 old canonical path를 유지하지 않는다.

이 문서의 목적은 점진 개선이 아니라 `owner cutover`다.

## Final Platform Shape

```text
src/platform/
  chrome/
    tabs/
    alarms/
    scripting/
  messaging/
    runtime/
    contracts/
  security/
    hashing/
    crypto/
  workers/
    runtime/
    clients/
  storage/
    settings/
    runtime/
    stats/
    logs/
    assets/
    bootstrap/
    clse/
    security/
    support/
    themes/
      zen/
    internal/
      chrome-storage/
      indexeddb/
```

이 tree는 owner seam을 설명하기 위한 representative map이다.
현재 실제 디렉터리는 더 평평할 수 있고, `platform/chrome/dev` 같은 보조 경로나
`platform/storage/model`, `platform/storage/nudge`, `platform/storage/protection`,
`platform/storage/protocol` 같은 typed facade가 추가로 존재할 수 있다.
중요한 기준은 low-level backend owner가 계속 `platform/storage/internal/**` 안에 닫혀 있고,
typed facade가 두 번째 backend contract를 만들지 않는다는 점이다.

## Canonical Access Pattern

- `apps -> domains public API`
- `domains -> platform public surface`
- `platform public surface -> platform/internal`
- `platform/internal -> raw browser API / raw storage backend / IndexedDB`

## Storage Rules

- raw `chrome.storage.local/session` access은 `platform/storage/internal/**` 아래에만 존재한다.
- IndexedDB client는 `platform/storage/internal/indexeddb/**` 아래에만 존재한다.
- business data는 feature/app/theme가 직접 generic storage helper에 쓰지 않는다.
- settings, runtime, stats, logs, assets, bootstrap, CLSE, theme-owned state는 각자 하나의 public surface만 가진다.
- fallback은 확률적 사건이 아니라 owner, input contract, bootstrap, observability 중 하나가 느슨해졌다는 신호로 취급한다.
- 정상 runtime에서는 fallback을 정교하게 늘리지 말고, fallback이 필요해지는 원인부터 제거한다.
- 입력 경계에서 canonicalization을 끝내고, 내부 runtime/storage 경계는 이미 canonical인 값을 요구한다.
- canonical settings snapshot read가 storage/backend 오류로 실패하면 `SETTINGS_READ_FAILED`를 surface한다. 요청 defaults는 missing-key initialization contract일 뿐 read failure fallback 값이 아니다.
- `SettingsStore`의 flat-key read-modify-write, whole-document write, clear는 하나의 instance queue에서 직렬화한다. 같은 `settings.*` 문서에 대한 병렬 mutation이 서로의 필드를 덮는 것을 허용하지 않는다.
- `SettingsStore`의 명시적 notification schema initializer도 같은 queue에서 한 번 실행한다. `writeDocuments`와 `commitItems`는 호출 시점에 FIFO 자리를 확보하고 그 callback 내부에서 initializer 완료를 기다린다. queue 진입 전에 초기화를 await하여 나중 `clear`보다 뒤로 밀리는 mutation은 금지한다. `clear`가 완료된 뒤에만 initializer promise를 비운다.
- settings command 성공의 source of truth는 요청 patch가 아니라 background가 돌려준 canonical `committedItems`다. transport는 ACK shape를 검증하고 dashboard command bus는 pending canonical key가 모두 포함됐는지 확인한 뒤 acknowledged payload만 적용한다. sensitive settings read는 계속 redacted이고, privileged write ACK만 제출된 security value를 되돌릴 수 있다.
- settings command의 physical canonical key, owner action, runtime delivery, sender/redaction, ACK field contract의 canonical metadata owner는 `src/domains/settings/config/settingsCommandContract.js`다. Dashboard channel key/retry/ACK projection은 `settingsDashboardCommandContract.js`가 그 key metadata에서 파생한다. client/transport/message policy/ACK validator는 이 named contract들을 소비하며 같은 action/key 목록을 별도 source of truth로 복제하지 않는다.
- settings persistence가 반환하는 `changedKeys`는 물리 저장 key 목록이 아니라 후속 effect routing을 위한 semantic contract다. `filterSettings` 변경은 실제로 바뀐 `filterSettings.<featureKey>`를 함께 내보내고, hash artifact 같은 파생 저장 key는 노출하지 않는다.
- `runtime.settings_propagation`은 `chrome.storage.session`의 worker-restart outbox이며 canonical settings mirror가 아니다. Coordinator는 각 side effect 성공 뒤 다음 stage 전에 `appliedStages` progress를 기록하고 replay에서 완료 stage를 건너뛴다. Side effect와 progress write 사이의 좁은 process-loss window 때문에 stage handler는 idempotent해야 하고, progress write가 실패하면 downstream stage를 실행하지 않는다. Fresh service init의 existing-tab catch-up도 이 owner에 새 task로 들어가 브라우저-session checkpoint 부재를 canonical registration plan에서 다시 수렴시킨다.
- `SettingsPropagationCheckpointRepository` reads this outbox through
  `RuntimeSessionRepository.readOptional`. Only physical key absence is an empty
  outbox. Present `null`, `undefined` or malformed records reject with
  `SETTINGS_PROPAGATION_CHECKPOINT_INVALID` instead of silently skipping restore.
- Initial propagation admission captures a normalized outstanding-intent snapshot
  before entering the checkpoint queue. A queued admission cannot become a clear
  because an older execution changes live state. The processing loop also waits
  for the latest admission ACK and rechecks admission identity and lifecycle
  generation before running effects. Admission rejection produces a failed
  outcome without effects; unfinished obligations use the existing six-stage
  failed-checkpoint schema, while `checkpoint_sync` remains a transient diagnostic.
  The already-committed canonical settings ACK remains valid and reports
  `schedule_failed`. If both admission and failed-retention writes reject, the
  latest intent has no durable restart guarantee. Existing bounded retry behavior
  for previously admitted work is unchanged.
- `runtime.history_cleanup_activation`은 URL이나 history row가 아니라 현재 loaded-extension session의 catch-up 결정 완료만 기록한다. Fresh activation은 durable `historyCleanupForBlocked`와 현재 optional `history` 권한을 읽고, 권한이 없으면 API를 반복 호출하지 않는 completed decision을 기록한다. `permissions.onAdded(history)`는 이 checkpoint를 먼저 지운 뒤 동일 background owner의 serialized full cleanup을 강제하고, 실패 시 checkpoint를 비워 다음 activation retry를 보장한다.
- site-rule/preset처럼 캐시에서 cross-key patch를 계산하는 명령은 `SettingsService.commitSettingsMutation` 안에서 최신 canonical cache를 읽고 계산해야 한다. queue 진입 전 cache read/ID 생성/whole-map assembly는 serialized storage write만으로 막을 수 없는 lost-update 경로이므로 금지한다.
- settings cache refresh도 같은 mutation lane을 통과한다. cache hydration은 current settings document만 읽고 storage write를 만들지 않는다. 현재 계약과 맞지 않는 개발 설정은 명시적 whole-profile reset으로 정리하며 startup/일반 read는 옛 값을 변환하거나 삭제하지 않는다. persistence rejection 뒤에는 cache를 untrusted로 표시하고 다음 mutation 전에 canonical storage에서 다시 hydrate한다. owner prepare callback은 synchronous/non-reentrant 계약이며 live cache가 아니라 deep-cloned snapshot만 받고, 반환 patch도 첫 await 전에 다시 capture한다.
- domain-hash repair처럼 runtime을 계속 사용하는 `SettingsStore` 밖 mutation은
  `SettingsService.runExclusiveExternalSettingsMutation` 안에서 raw mutation, cache
  rehydrate, durable reconcile을 직렬화한다. 반면 snapshot import와 full app reset은
  settings와 propagation participant가 terminal quiesce된 뒤
  `runExclusiveTerminalSettingsMutation`만 사용한다. Old worker에서 cache를 rehydrate하거나
  full reconcile을 schedule하지 않으며 fresh worker bootstrap이 새 canonical settings를
  읽는다. 두 exclusive API의 owner callback은 synchronous function으로 첫 downstream
  owner를 즉시 호출하고 그 promise chain을 반환해야 한다. Native `async` callback은
  SettingsService 재진입과 self-deadlock 가능성을 만들기 때문에 호출 전에 거부한다.
- snapshot import admission은 background lifecycle side effect 전에 암호화 envelope
  인증, current-only settings/progression/IndexedDB 검증, log V2 AEAD 검증, 복원 대상
  key record 준비를 끝낸다. 백업 암호와 선택적인 복원 후 vault 암호는 transient 인자로만 받는다.
  준비된 payload는 module-private one-shot capability에 머물며 runtime response로
  내보내지 않는다. restore는 replace만 허용한다. restorePassphrase 생략 시 기본 local 모드,
  강한 암호를 명시하면 passphrase 모드로 설치 후 locked가 된다. 빈 암호는 거부한다.
- `keys.security_vault`는 세 민감키의 유일한 durable owner다. 기본 `entropy-local-keyring`
  V1은 TRUSTED_CONTEXTS local에 exact keyring을 저장하며 사용자 암호 없이 시작한다.
  이 모드는 복사된 프로필의 키 추출을 막지 않는다. 새 선택 잠금 `entropy-log-key-vault` V1은
  protectionKeys를 trusted local에 두고 `entropy-log-key-envelope` V1으로 log AES만 감싼다.
  outer id와 protectionKeys는 envelope AAD 및 session digest에 결합된다. 기존 full wrapped
  `entropy-security-vault` V1은 자동 변환 없이 유지하며 Dashboard의 현재 암호 proof를 받는
  `SEPARATE_SECURITY_VAULT_PROTECTION_KEYS`만 같은 키와 id를 보존해 명시 전환한다.
  wrapping은 AES-256-GCM, 고정 PBKDF2-SHA256 600,000회, random salt16/IV12 bytes와
  header AAD를 쓴다. passphrase 모드의 unwrapped keyring은 TRUSTED_CONTEXTS session에,
  실행 CryptoKey는 nonextractable로 둔다. retired raw JWK/secret은 presence 진단만 하며 incompatible
  profile로 surface한다; 자동 wipe, migration, secret 재생성은 없다.
- `ensureLocalVault`는 profile mutation gate 안에서 genuinely absent key만 생성하는
  명시적 pre-init owner다. boot와 trusted GET status에서 준비 완료 뒤 읽으며 repository
  getters는 쓰지 않는다. vault enable/unlock/remove/status는 full-init와 독립이며
  bootstrap/generation은 strict status의 protectionReady를 따른다. 기본 local 모드는
  재시작에도 암호 없이 열리고, log-only passphrase 모드는 보호를 바로 시작하면서 상세 로그만
  잠긴다. 기존 full wrapped locked만 전환 또는 unlock까지 정지한다. 잠금 전환은 같은 키를 보존한다.
  설정 보호 PIN은 별도의 로컬 행위 승인용이다. Settings,
  stats, model state와 보호용 HMAC은 on-device plaintext이며 새 선택 잠금은 log AES와
  상세 logs를 보호한다. 잠긴 신규 append는 큐 진입 전에 explicit data_locked receipt를
  반환한다. 기존 admitted/persisted logs를 버리지 않으며 잠긴 기간의 상세 로그를 소급 생성하지 않는다.
  log AES invalidation과 보호 HMAC invalidation은 분리하고 reset/import는 둘 다 무효화한다.
- full app reset은 어떤 durable clear보다 먼저
  `runtime.profile_reset_lifecycle`을 `resetting`으로 commit한다. 모든 extension
  context는 이 generation을 write-admission fence로 관찰하고 새 write를 거부한 뒤
  이미 admission된 write를 drain해야 한다. 그 뒤의 병렬 clear phase는 한 sibling
  실패 시에도 모든 sibling을 drain한 뒤 named phase error를 surface한다.
  recovery/reload가 아직 실행 중인 late clear를 추월해서는 안 된다.
- background의 `ProfileMutationRuntimeGate`는 message와 Chrome browser-event의
  공용 in-flight admission owner다. Mutation coordinator가 durable fence를 닫은 뒤
  이 gate를 동기적으로 닫고 기존 lease가 0이 될 때까지 기다린 다음 producer에서
  downstream queue/store 방향의 composition 순서로 participant를 하나씩 quiesce한다.
  앞 owner가 실패해도 뒤 owner는 모두 close 시도하므로 producer가 열린 채 store만
  지워지는 상태를 만들지 않는다. Fence가 닫힌 동안 도착한 일반
  ingress는 새 generation으로 queue/replay하지 않고
  `PROFILE_MUTATION_RUNTIME_ADMISSION_CLOSED`로 끝난다. Reset/import control action만
  이 gate 밖의 trusted control plane을 쓰며, 닫힌 profile recovery는 Dashboard가
  관찰한 exact `resetId`를 제출해야 한다.
- `resetting` 최초 write의 ACK가 실패하면 실제 저장 여부를 추정하지 않는다.
  `ProfileResetLifecycleRepository`가 발행한 write-attempt receipt만 coordinator가
  처리하며, 같은 local gate와 participant 순서를 닫고 drain한 뒤 journal을 재조회한다.
  조회된 전체 record가 attempted `resetting` 또는 write 직전 record와 정확히 같을 때만
  해당 attempt의 `failed` record를 새 write로 commit한다. 다른 record는 덮어쓰지 않는다.
  원 write 오류는 그대로 surface하고, reconciliation/read/write/quiesce 오류는
  `getProfileMutationLifecycleWriteFailure()` receipt에 남긴다. 실패 fence의 ACK를
  확인할 수 없으면 old lifetime은 닫힌 상태를 유지하며 reload가 필요하다.
  Write 전에 끝난 validation/read/admission 오류는 이 terminal 경로에 들어가지 않는다.
- `worker_runtime_events` 진단 cache의 sole writer는 background
  `WorkerRuntimeEventCapability`다. Dashboard와 Worker telemetry는
  `WorkerRuntimeEventRepository`의 fixed-key transport를 쓰고, background는 같은
  capability의 injected local port를 쓴다. Producer는 debounce 예약 전에 generation을
  capture하며 같은 lifetime에서 재발급하지 않는다. Trusted route와 공용 gate,
  durable generation 검증을 통과한 요청만 typed store FIFO에 진입한다.
  Full reset과 snapshot import는 telemetry 예약을 취소하고 admitted write와 FIFO를
  drain한 뒤 mutation-only typed clear로 cache를 제거한다. Old lifetime의 늦은
  요청은 cache를 다시 만들 수 없으며 persistence failure는 memory 진단에 남긴다.
- bootstrap readiness를 기다려야 하는 message/browser event는 도착 시점에 open
  generation admission token을 먼저 capture한다. Token은 durable generation뿐 아니라
  lifecycle read 전에 표본한 monotonic local fence revision도 소유하며, close/fail,
  terminal `reload_pending` seal, authorized failed-mutation recovery는 그 revision을
  전진시킨다. Capture와 acquire의 awaited lifecycle read 전후 및 실제 owner
  실행 직전에 두 fence를 다시 검증한다. Cold recovery fence 뒤에서 발생한 ingress,
  close/seal 경계를 가로지른 ingress, readiness 대기 중 generation이 바뀐 ingress는 새
  profile에서 실행되지 않는다.
- ordinary ingress 적용 범위에는 tracking alarm/tab/window/navigation뿐 아니라
  shared `oneMinuteTick`에서 위임된 CLSE heartbeat와 CLSE
  runtime-message/webNavigation/tab/window/idle collector도
  포함된다. CLSE는 `CLSEServiceClient`가 background composition의 동일 gate에서
  `capture`/`runCaptured` 두 함수만 주입하고, listener 진입에서 첫 Promise turn 전에
  token을 capture한다. Navigation의 loop persistence enqueue와 heartbeat의 serialized
  storage tail까지 owning lease 안에서 await하며, runtime-message response는 lease가
  끝날 때까지 `return true` 채널을 유지한다. Admission 실패 뒤 collector task를 직접
  실행하는 경로는 없다.
- CLSE activity/loop 정리는 service-worker `setInterval`에 의존하지 않는다.
  Collector mutation은 timer-free scheduler에서 최대 5초당 한 번만 checkpoint write로
  admission되고, `oneMinuteTick` heartbeat는 elapsed activity settle과 loop prune 뒤 최종
  write를 강제 admission한다. `runtime.clse_checkpoint`는 exact schema를 유지하되 최근
  닫힌 10초 bucket 3개와 current bucket만 담는 compact recovery snapshot이다. Admitted
  FIFO operation은 실행 시점의 최신 activity/loop/aggregation cursor 상태를 캡처한다.
  따라서 worker suspension 직전 최대 5초 mutation과 더 오래된 RAM ring history는
  복구되지 않을 수 있으며, durable history는 IndexedDB rollup이 소유한다. Fresh worker는
  compact snapshot을 검증·복원한 뒤 initial idle query를 같은 mutation queue에서 await한다.
- tracking `IdleDetector`는 bootstrap에서 initial idle query를 await하고, initial query,
  state-change callback, later state query를 각각 공용 gate의 local admitted lease 안에서
  수행한다. 따라서 idle state transition도 닫힌 generation에서 실행되거나 bootstrap
  완료 뒤로 무소유 replay되지 않는다.
- lifecycle publish 순서는 `resetting -> committed -> complete`다. Durable clear/import
  뒤 `committed`, `complete`를 기록하고 old worker의 공용 gate를 local
  `reload_pending`으로 seal한다. Reset/import handler는 성공 response에 exact
  `{ contract, operation, resetId }` descriptor를 담고 reload하지 않는다. Dashboard가
  원 mutation response Promise의 settlement 뒤 동일 descriptor로 narrow
  `PROFILE_MUTATION_RESPONSE_ACK`를 시작하면 eager background control path가 trusted
  Dashboard sender, durable `complete`, local `reload_pending`, exact generation/operation을
  재검증한 뒤에만 runtime lifetime port에서 `chrome.runtime.reload()`를 호출한다. Participant,
  repository, gate에는 resume/reopen/rotate 경로가 없고 새 generation bind는 fresh worker
  bootstrap만 수행한다. 어느 단계든 실패하면 lifecycle과 runtime gate 모두
  fail-closed로 남는다. 같은 worker의 exact-generation recovery는 terminal mutation을
  다시 drain/완료할 수만 있으며 normal owner를 되살리지 않는다.
  원 Dashboard 문서가 ACK 전에 닫혔다면 새 문서의 vault status/readiness read도 old
  worker의 `PROFILE_MUTATION_RUNTIME_ADMISSION_CLOSED`로 거부된다. Dashboard lifecycle
  owner는 이 exact 오류와 동일 generation의 durable `complete`를 다시 확인한 경우에만
  기존 handoff recovery 화면으로 연결한다. 사용자의 기존 재시작 요청 action은
  canonical lifecycle의 `{ contract, operation, resetId }`만 기존 ACK로 전달한다.
  Reset/import를 재송신하거나 정상 owner를 admit하지 않으며 background의
  `complete` + `reload_pending` + exact tuple 검증은 동일하다. Explicit negative ACK는
  오류 code와 재시도를 남기고 reload에 따른 channel 종료는 committed mutation 실패로
  재해석하지 않는다. 다른 vault 오류, 미완료 lifecycle, 새 generation은 이 경로로
  정상 admission을 얻지 않는다.
- durable local lifecycle journal은 cross-context notification/admission owner이고
  IndexedDB linearization point는 아니다. ModelState reset owner는 `model_state` clear와
  reserved profile-epoch row, background composition factory가 미리 만든 canonical
  bonsai aggregate의 commit을 같은 IndexedDB transaction에서 수행한다. Reserved row가
  canonical epoch이고 bonsai aggregate의 top-level
  `profileEpoch`는 그 값으로 stamp된 비교용 fence다. 둘이 다른 aggregate
  bootstrap/CAS는 write 없이 stale-generation failure로 끝난다.
- background bootstrap은 lifecycle admission이 열리기 전에 mutable owner를
  시작하지 않는다. admission이 반환한 exact generation을 shared runtime-gate lease
  안에서 다시 검증하고, typed `ModelStateRepository.initializeProfileGeneration()`으로
  reserved epoch row, canonical bonsai aggregate, 그리고 빈 canonical koi roster
  memory를 원자적으로 install 또는 reuse한 후에만 stats/tracking을 포함한 나머지
  mutable owner를 시작한다. 별도 readonly
  `assertProfileGenerationInitialized()`는 Dashboard admission handshake가 사용한다. 이 required step은
  best-effort가 아니며 Dashboard/resource에는 alternate bootstrap 권한이 없다. full
  reset과 snapshot import만 별도 trusted recovery control plane으로 dispatch된다.
  성공한 control plane은 같은 bootstrap promise를 이어 가지 않고 old worker를
  `reload_pending`으로 남긴 뒤 runtime reload로 끝낸다.
- Feed tempo cross-session continuity is the typed
  `model_state.feed_tempo_adaptive_profile_checkpoint_v1` entry. The content
  runtime never opens IndexedDB: trusted top-frame requests route to
  `FeedTempoPersistentProfileService`, which resolves the current lifecycle
  generation and uses `FeedTempoProfileCheckpointRepository` over the existing
  epoch-aware ModelState CAS. The record is an online-learning checkpoint, not a
  permanent baseline. Its current value envelope is schema V2 even though the
  stable physical key remains `_v1`. It applies 30-day evidence decay, 7-day
  confidence decay, a 4% per-eligible-episode center-step limit, paged dwell,
  and continuous-screenful evidence. Only eligible unassisted episodes write.
  Missing current state may be created by the first admitted episode. The typed
  repository recognizes only a readable lower schema as the explicit V1→V2
  cutover, deletes that non-convertible row, and relearns; malformed,
  current-invalid, higher-schema, stale-epoch, and CAS exhaustion fail without
  session-memory, Chrome-storage, or localStorage recovery.
- Generic feed topology certification is the typed
  `model_state.feed_topology_certificate_checkpoint_v1` entry. Content keeps
  DOM nodes, selectors, classes, text, and paths in document-local memory and
  sends only an exact structural descriptor/fingerprint plus learner scalars
  through the trusted top-frame message route. `FeedTopologyPersistentCertificationService`
  resolves the current lifecycle generation and uses
  `FeedTopologyCertificateCheckpointRepository` over the same epoch-aware
  ModelState CAS. The checkpoint requires three distinct observation IDs across
  at least two UTC days, applies a 14-day evidence half-life, and issues a
  30-day certificate. Content-side live admission separately requires three
  matching probes at least 750ms apart and expires that proof after ten seconds.
  Fingerprint drift rotates to fresh learning and
  learner volatility/invalidity commits explicit invalidation. Missing state is
  first-observation absence only; malformed/version-mismatched state, stale
  epochs, transport failure, and CAS exhaustion fail closed without server,
  session-memory, Chrome-storage, or localStorage recovery. Snapshot export/import
  includes the strict current checkpoint and rebases only its `profileEpoch`.
- profile-generation boot settlement는 initializer의 최초 시도가 더 이상 진행 중이지
  않다는 worker-local 순서 barrier일 뿐 current generation의 진실원이 아니다. 성공과
  실패 모두 settlement를 닫지만 terminal reset/import 성공 뒤 이 barrier를 재사용하지
  않는다. Runtime reload가 만든 fresh worker가 새 settlement와 mutable owner를 구성한다.
  Dashboard는 lifecycle을 먼저
  캡처하고 settlement 뒤 background의 trusted readiness route에 exact generation을
  제시한다. Router는 요청 도착 시 shared runtime-gate admission을 캡처하고,
  background readiness owner가 그 lease 안에서 lifecycle admission -> 단일 readonly
  `assertProfileGenerationInitialized()` -> lifecycle admission을 재검증한 뒤 같은
  generation을 ACK한다. Dashboard generation lease와 `ZenModelRepository` bind는 이
  ACK 뒤에만 가능하다. 이 route는 초기화, retry, broad dashboard-boot readiness,
  최신 generation 채택을 소유하지 않는다. ACK 대기 중 named runtime-fence rejection이
  먼저 도착하면 Dashboard는 readiness를 재시도하지 않고 canonical lifecycle을 정확히
  한 번 다시 읽는다. 닫힌 lifecycle은 recovery surface로 block하고, 열린 lifecycle의
  generation이 달라졌으면 runtime handoff 대기로 block하며, 동일한 열린 generation이면 불변식 위반으로
  fail-loud한다.
- encrypted storage snapshot의 replace import도 같은 profile-generation 경계를
  사용한다. preflight 이후 background가 새 reset lifecycle을 시작하고 그
  `resetId`를 destination epoch로 전달하고, storage mutation 전에 그 epoch용 aggregate를
  준비한다. IndexedDB import transaction은 `imported -> valid existing merge -> prepared`
  우선순위로 aggregate 하나를 선택해 reserved epoch row와 함께 commit한다. merge는
  기존 `model_state` 전체를 검증하고 epochless/unknown/malformed durable row와
  installed epoch-without-aggregate를 거부하며 discardable cache를 삭제한다. Prepared
  aggregate는 physically pristine merge destination 또는 replace에서만 선택할 수 있다.
  Snapshot preflight는 duplicate `modelState` primary key를 aggregate 중복까지 포함해
  거부한다. storage layer가 seed나 identity를 합성하지 않는다.
  portable snapshot의 source epoch를 현재 설치의 concurrency authority로 재사용하지
  않는다. 성공 response의 exact post-settlement ACK 뒤 extension runtime 전체를 reload하며 quiesced lifetime을 store
  reinitialize로 되살리지 않는다.
- theme-owned page-local state가 `window.localStorage`를 쓸 수 있는 범위는 UI-only,
  debug-only convenience state뿐이다. seed, latent, structure, generation input,
  identity revision, lineage 같은 Zen bonsai business data를 page-local storage에
  쓰거나 mirror하면 안 된다.
- `dashboard.bonsai_growth_reveal.v1`은 Main이 이미 보여 준 canonical qualified-use
  day만 기억하는 UI-only acknowledgement다. debug projection은 기록하지 않으며,
  progression entitlement, bonsai release age, lineage 또는 cultivation 입력으로
  읽을 수 없다. Profile reset으로 canonical day가 낮아지면 조용히 맞출 뿐
  business state를 복원하지 않는다.
- `dashboard.artifact_gallery_position.v1`은 Tools 아티팩트 길에서 마지막으로 서 있던
  artifact id만 기억하는 UI-only 위치 기록이다. owner는
  `apps/dashboard/tabs/tools/artifactGalleryPositionState.js`이고 갤러리의 진입
  위치만 고른다. disclosure, progression entitlement, artifact configuration으로
  읽을 수 없으며, 기억된 family가 disclosed 상태가 아니면 canonical order에서 다음
  disclosed family로 진입한다. 기록이 없거나 쓰기에 실패하면 첫 disclosed family에서
  시작하는 것이 이 UI convenience의 문서화된 degradation이다.
- durable Zen bonsai artifact collection mutation은
  `ZenArtifactRepository.replaceArtifactCollectionForProfileGeneration()` 하나만
  사용한다. Dashboard가 admission 뒤 읽은 canonical bonsai aggregate의
  `profileEpoch`를 exact expected generation으로 제출하고, `ZenArtifactStore`는
  `[zen_artifacts, model_state]` 단일 readwrite transaction에서 reserved epoch row를
  먼저 비교한 뒤 해당 collection의 removed-row delete, next-row put, main-entry meta
  put을 함께 commit한다. Split put/delete/meta API와 lifecycle precheck는 write
  authority가 아니며 active seam에 존재하지 않는다. Reset/import로 epoch가 바뀐 old
  page command는 `ZEN_ARTIFACT_PROFILE_GENERATION_STALE`로 아무 artifact도 쓰지 못한다.
- full reset의 required durable-clear task는 `model_state` epoch reset을 완료한 뒤에만
  typed `ZenArtifactRepository.clearForProfileMutation()`을 실행한다. Old artifact
  transaction이 먼저 선형화되면 뒤 clear가 그 결과를 제거하고, epoch reset이 먼저
  선형화되면 old transaction의 exact-epoch compare가 abort한다. 이 둘을 parallel
  sibling clear로 실행해서 `artifact clear -> old write -> epoch rotate` 순서를 허용하면
  안 된다.
- Zen workspace UI config/tuning과 Sakura runtime flags는 missing key에서만 default를
  허용한다. Sakura runtime flags의 release V1 저장 계약은
  `zen_sakura_v2_runtime_flags_v1`의 exact 7-field `version: 1` record 하나다. 같은
  숫자 version을 사용했던 pre-baseline `zen_sakura_v2_runtime_flags`는 retired key이며
  reader, migration, cleanup 대상이 아니다. Current key의 비정상 또는 predecessor
  record는 명시적으로 거부하고 normal read에서 변환하거나 재저장하지 않는다. 개발 중
  폐기할 전체 상태는 data reset 경계에서 제거한다. Worker execution failure를
  main-thread/local semantic fallback으로 덮으면 안 된다.
- `ZenWorkspaceState`와 VNext factor/storage graph는 development build 전용이다.
  `@zen-development-workspace-state-entry`가 dev build에서는 그 owner를 projection하고
  public build에서는 import-free `null` capability를 제공한다. Public Classic/Home은
  development state를 읽거나 쓰지 않고 production constant/default contract만 사용한다.
- 제품 Zen의 순수 visual UI convenience state는
  `src/themes/plugins/zen/state/ZenProductionUiState.js`를 통한다. Low-level strict owner는
  `src/platform/storage/themes/zen/ZenUiLocalStorage.js`이며 storage unavailable, I/O failure,
  malformed typed payload를 조용히 default로 바꾸지 않는다.
- `zen_pond_visual_profile_v1`은 제품 연못의 `floor / plants / rocks / sunlight`
  선택만 담는 UI-only tuning snapshot이다. typed owner는
  `zenVisualProfileRepository.js`이고 exact contract/version/profile shape를
  검증한다. missing key만 제품 기본 profile로 초기화하며 malformed JSON,
  unknown axis/option, version mismatch는 normal read에서 fail-loud한다. 이 값은
  progression, identity, lineage, 통계 또는 다른 business state의 입력이 아니다.
- Zen current-runtime Main Classic2의 durable owner는 typed
  `ZenBonsaiProfileAggregateRepository`가 읽고 쓰는 IndexedDB `ModelStateStore`의
  `zen_bonsai_profile_aggregate_v1` 하나다. 이 aggregate는 active identity의
  `treeSeed`, canonical latent, structure mode/depth, topology reference height,
  canonical generation inputs, `identityRevision`, identity fingerprint와 현재
  `lineageState`, transaction-facing `stateRevision`, durable `profileEpoch`를 한
  CAS 단위로 소유한다.
  identity commit은 expected revision/fingerprint를 검증하고 identity/state revision을
  각각 정확히 한 번 전진시킨 뒤 이전 lineage를 `null`로 만든다. lineage commit은
  같은 aggregate 안의 active identity revision/fingerprint가 정확히 일치할 때만
  허용한다.
- physically pristine initial profile의 최초 생성은 background bootstrap의 typed
  profile-generation initializer만 소유한다. 이 initializer가 reserved profile-epoch row와
  aggregate를 같은 IndexedDB transaction에서 설치하기 전에는 generic model
  get/set/bootstrap/CAS가 모두 `MODEL_STATE_PROFILE_GENERATION_NOT_INITIALIZED`로 실패한다.
  Dashboard/theme runtime은 aggregate를 bootstrap하지 않으며, aggregate가 없으면
  missing epoch 또는 `ZEN_BONSAI_PROFILE_AGGREGATE_DISAPPEARED`로 실패한다. Initial
  generation의 null/null pristine 예외는 없다. Epoch-blind Store/Repository CRUD는
  IndexedDB를 열기 전에 명시적으로 거부된다. Durable mutation은 strict
  read/validation 뒤 transaction 밖에서 synchronous proposal을 만들고
  `stateRevision` 기반 typed CAS로 commit한다.
  `ModelStateStore.compareAndSetEntryWithProfileEpoch()`의 짧은 transaction은 reserved
  epoch와 target entry의 get/compare/optional-put만 소유한다. conflict `latestValue`는
  strict validation 후 최대 네 번의 bounded retry 입력이 되며 exact-reference
  no-change는 verify-only CAS로 freshness만 확인한다. malformed conflict와 retry
  exhaustion은 loud failure이고 updater-in-transaction fallback은 없다.
- reserved profile-epoch row는 concurrency용 `profileEpoch`와 별개로 current-only
  `developmentBaseline`을 소유한다. `ProfileCompatibilityContract`가 현재 baseline 숫자와
  exact reset descriptor를 소유하고, `ZenProfilePersistenceDescriptor`가 aggregate,
  active identity, candidate graph, spine condition namespace의 현재 조합을 한 곳에
  열거한다. 저장 계약 조합을 바꾸는 개발 cutover는 이 descriptor와 baseline guard를
  함께 갱신하고, 이전 baseline은 normal runtime에서 읽거나 변환하지 않는다.
  baseline field가 없는 정확한 pre-baseline header, 현재보다 낮은 baseline, 또는 feature
  row가 존재하지만 header가 없는 profile만
  `MODEL_STATE_PROFILE_COMPATIBILITY_BASELINE_RESET_REQUIRED`와 exact
  `profile_compatibility_recovery_v1` descriptor로 분류한다. 같은 현재 baseline의 malformed
  header/aggregate/feature row는 corruption으로 fail-loud하며 reset-required로 재분류하지
  않는다. 더 높은 baseline은 `MODEL_STATE_PROFILE_COMPATIBILITY_DOWNGRADE_BLOCKED`로
  차단한다. 이 경계에는 read-time migration, old descriptor registry, automatic reset,
  per-key repair가 없다.
  현재 baseline은 `2`이며 current Classic2 candidate graph contract는
  `classic2_macro_lineage_graph_v2`다. Baseline `1`의 개발 profile은 aggregate의
  old graph shape를 deep-validate하기 전에 canonical reset-only recovery로 분류한다.
- Dedicated Zen model worker는 Dashboard의 durable-local lifecycle journal을 직접 읽거나
  `chrome.storage.onChanged`를 구독하지 않는다. Dashboard client가 exact generation을
  요청에 pin하고 응답 뒤 lifecycle admission을 다시 확인하며, worker-local
  `ZenWorkerModelRepository`는 그 generation을 `ModelStateStore`의 transaction-scoped
  `expectedProfileEpoch`로만 사용한다. 따라서 lifecycle notification fence와 IndexedDB
  linearization fence의 owner가 실행 context를 가로질러 섞이지 않는다.
- revision은 epoch-local이다. Reset 뒤 `stateRevision`/`identityRevision`이 다시 작은
  값에서 시작해도 stale runtime은 이전 `profileEpoch`를 들고 있으므로 같은 번호의
  새 identity/aggregate를 commit할 수 없다. Durable compare unit은 최소
  `(profileEpoch, stateRevision)`이고 identity/lineage mutation은 여기에 exact
  identity revision/fingerprint를 더한다.
- current Home만 aggregate의 durable active identity와 lineage를 소비한다. First
  Vision과 debug/read-only presentation scene은 explicit input으로 만든 isolated
  in-memory lineage이고 aggregate를 바꾸지 않는다. Experiment는 aggregate에서 한 번
  연 page-local draft만 편집하며, `Apply to Main`만 complete identity를 정확히 한 번의
  CAS로 commit한다. Experiment의 intermediate seed/latent/structure/learning step은
  durable write가 아니다.
- release V1 runtime에는 이전 bonsai localStorage business key,
  `zen_bonsai_classic2_lineage_state_v1`, old-key alias, read-through, dual write,
  cleanup, upgrade, repair라는 이름의 compatibility path를 두지 않는다. 이전 개발
  profile은 runtime이 변환하지 않고 명시적 전체 profile reset으로만 폐기한다.

### Release V1 Persistence Baseline

- `EntropyDB` version은 `1`이고 현재 object store/index 전체를 최초 생성 경로에서 만든다.
- release V1의 object store set, store key path/auto-increment, index set/index
  contract는 frozen topology다. 숫자 version이 이미 `1`이어도 이 exact contract가
  다르면 `INDEXED_DB_RELEASE_V1_RESET_REQUIRED`로 실패하며 raw
  `INDEXED_DB_V1_*_MISMATCH` reason을 보존한다.
- export/import format은 `1` 하나만 허용한다.
- current record/key/contract가 없을 때만 명시적 bootstrap을 허용한다. 값이 존재하지만 malformed이거나 contract가 다르면 즉시 실패한다.
- `SettingsStore`와 `KeyStore`는 key-array 조회와 실제 key 존재 여부로 누락을
  판별한다. 저장된 `null`/`undefined`는 누락이 아니며, settings 문서는
  `SETTINGS_DOCUMENT_CONTRACT_INVALID`, key material은
  `KEY_MATERIAL_STORED_VALUE_INVALID`로 거부한다. 명시적 삭제 command의
  `null` 입력은 저장된 손상 값의 읽기와 별개다.
  `ProfileResetLifecycleStore`도 같은 physical-presence 규칙을 따른다. 존재하는
  null/undefined lifecycle journal은 `ProfileResetLifecycleRepository`에서
  `PROFILE_RESET_LIFECYCLE_STATE_INVALID`로 거부하며 virgin-profile admission을 열지 않는다.
- settings의 `commitItems`는 기존 document FIFO 안의 단일 read/modify/write에서
  실제 `changedKeys`와 그 key의 `previousItems`를 반환한다. 이 receipt는
  메모리 전용이며 별도 저장·설정 mirror·transport ACK가 아니다. capability는
  receipt로 semantic invalidation metadata를 계산하고, settings를 선행 재조회하지
  않는다. key material 검증은 document commit 전에, cache 갱신은 모든 필요한
  storage ACK 뒤에 수행한다.
- record-level 개발 persistence cutover는 reserved ModelState profile header의 current-only
  `developmentBaseline`으로 판별한다. 예상된 과거 baseline만 in-product full reset 진입면을
  열며, physical object-store/index topology mismatch는 계속 별도
  `INDEXED_DB_RELEASE_V1_RESET_REQUIRED` 절차를 사용한다.
- 더 높은 pre-release DB를 발견해도 runtime은 삭제, downgrade, 변환, silent reset을 수행하지 않는다.
- ordinary analytics/app reset은 알려진 store의 record만 clear한다. object store나
  index topology를 제거하거나 고칠 수 없으며, same-version V1 mismatch는 named
  developer profile reset으로 `EntropyDB` 전체를 삭제한 뒤 fresh-create해야 한다.
- `DBManager`는 canonical reset-required failure를 현재 extension runtime 수명 동안
  terminal로 latch한다. 다른 typed store가 같은 incompatible DB를 반복 open/validate
  하지 않으며, 명시적 profile reset 뒤 extension reload가 새 manager 수명을 연다.
- 열린 DB가 `versionchange`를 받으면 현재 JavaScript lifetime의 connection owner도
  terminal이 된다. 현재 handle과 late open result를 모두 닫고, 같은 살아 있는
  Dashboard/background runtime이 삭제 뒤 fresh DB를 다시 열어 이전 in-memory state를
  재생성하지 못하게 한다. 새 DB admission은 extension reload가 만든 새 lifetime에서만
  열린다.
- frozen V1 topology의 추가/삭제/변경은 허용되지 않는다. 공개 후 topology 변경이
  필요하면 별도 V2 architecture decision과 versionchange 계약을 먼저 추가해야 한다.
- 개발자 초기화 절차와 삭제/보존 범위는 `docs/operations/runbooks/pre-release-development-profile-reset.md`가 소유한다.
- Manifest V3, `AES-GCM`, dependency와 브라우저 API version은 외부 표준이므로 이 baseline의 재번호 대상이 아니다.

## Canonical Public Surfaces

- `platform/storage/settings/*`
- `platform/storage/runtime/*`
- `platform/storage/stats/*`
- `platform/storage/logs/*`
- `platform/storage/assets/*`
- `platform/storage/bootstrap/*`
- `platform/storage/clse/*`
- `platform/storage/security/*`
- `platform/storage/support/*`
- `platform/storage/themes/zen/*`

허용되는 narrow typed facade 예시는 아래와 같다.

- `platform/storage/model/*`
- `platform/storage/nudge/*`
- `platform/storage/protection/*`
- `platform/storage/protocol/*`

단, 이 경로들은 owner-specific client surface일 뿐이며, 별도 low-level backend owner가 되어서는 안 된다.

## What Must Completely Disappear

- `shared/storage`를 canonical storage home으로 보는 해석
- app/domain/theme 코드의 direct `dbManager` import
- app/domain/theme 코드의 raw `chrome.storage.*` helper import
- 하나의 persisted concept가 여러 public path로 노출되는 구조
- platform public surface가 다시 shared helper를 우회해서만 작동하는 이중 구조
- snapshot/reset/repair owner가 cache refresh, bookmark/CLSE/runtime adapter, managed script, protection broadcast를 직접 이어 붙이는 duplicate settings propagation path

release V1 tree에서 old storage path와 forwarding shell은 모두 삭제한다.
canonical caller는 `platform/storage`의 named seam을 직접 사용한다.

## Messaging Rules

- Chrome listener registration은 `apps/background`가 소유한다.
- route registration은 `apps/background` 또는 `platform/messaging`이 소유한다.
- domain action/query contract는 owner domain 또는 owner app에서만 노출한다.
- 핵심 사용자 액션은 generic patch만 강제하지 않는다. owner-specific command를 둘 수 있지만, 최종 persistence owner/path는 하나여야 한다.
- feature UI/controller는 canonical storage key patch를 직접 조립하지 않는다. UI는 intent를 보내고, owner command/service가 canonical patch를 만든다.
- 여러 key invariant가 엮인 사용자 액션은 generic `SET_SETTINGS`보다 owner-specific command를 우선한다.
- generic patch/`SET_SETTINGS`는 infra primitive로 남을 수 있지만, feature-level public hot path의 주 계약이 되면 안 된다.
- generic `SET_SETTINGS`의 semantic `changedKeys`와 physical `committedItems`는 동일 집합이라고 가정하지 않는다. Dashboard bus는 제출/pending physical key의 complete ACK를 검사하고, strict owner command는 registry가 선언한 경우에만 `changedKeys`의 `items` coverage까지 요구한다.
- `bootstrapHostChange`는 정본 parser로 검증한 무효화 metadata다. strict owner ACK는 metadata 문자열을 저장 key로 요구하지 않고, 그것이 가리키는 physical key가 `changedKeys`와 `items` 모두에 있는지 검사한다. 잘못된 metadata나 실제 저장값 누락은 계속 거부한다.
- generic settings query path는 full snapshot dump를 제공하지 않는다. full export/import/inspection은 support capability 전용 surface로 분리한다.
- generic settings mutation/query path에서 unknown key는 fallback 저장소로 흘리지 않고 즉시 실패한다.
- persistence ACK와 runtime propagation completion은 별도 계약이다. 저장 성공을 요청 echo나 전파 완료로 해석하지 않으며, 전파 실패 때문에 이미 commit된 canonical settings를 저장 실패로 되돌리지 않는다.
- post-commit stage 실행자는 `BackgroundSettingsPropagationCoordinator` 하나다. `SettingsService`는 plan과 task만 만들고, coordinator는 required handler 검증, 순서 실행, bounded retry, completion/idle outcome을 소유한다.
- coordinator는 첫 schedule write 전에 one-time restore gate로 기존 `runtime.settings_propagation` checkpoint를 읽고, scheduled receipt를 반환하기 전에 pending task를 기록한다. worker 재시작 시 bootstrap은 pending replay의 terminal outcome까지 기다리고, 성공 시 clear하며, retry 소진 시 failed outcome을 보존한다. 보존된 failed stage는 다음 fresh commit에 union되어 retry budget을 reset한 뒤 다시 열린다.
- normal external/full-document settings mutation은 `{ settingsChanged, result }`를
  명시하고, no-change repair는 hydrate만 하며 version/fan-out을 만들지 않는다. Terminal
  snapshot/reset은 같은 outcome shape를 검증하되 old worker propagation을 만들지 않는다.
  Profile mutation participant가 기존 `runtime.settings_propagation` tail을 drain하고 durable
  checkpoint를 clear한 뒤에만 snapshot session cleanup이 전체 runtime session을 지운다.
- protection broadcast는 fan-out Promise 완료만으로 성공하지 않는다. 각 target을 acknowledged/skipped/failed로 분류한 summary가 count/success invariant를 만족하고 `success: true`여야 broadcast stage가 완료된다. Failed checkpoint는 bounded target diagnostic을 canonical error message에 보존한다.
- cycle reset policy 같은 user-durable preference는 settings seam에 남기고, current cycle checkpoint 같은 runtime in-flight state는 session seam으로 분리한다.
- `monitor_cycleSettings` mutation은 tracking domain의 named reset-policy owner가
  `SettingsService.commitSettingsMutation`과 exact `committedItems`를 통해서만
  전진한다. Generic `SET_SETTINGS`와 runtime repository parallel path는 이 key를
  소유하지 않는다.
- foreground activity touch는 `runtime.cycle_checkpoint` owner의 immutable snapshot과
  owner-local Promise tail만 사용한다. 평시 touch가 cycle settings를 다시 쓰거나,
  settings/session write를 하나의 best-effort `Promise.all`로 합치는 경로는 금지한다.
- Furin's small activity-day presentation cap uses registered Chrome-local
  `nudge.daily_receipt` through `platform/storage/nudge/FurinDailyReceiptRepository`.
  The existing nudge lock is its sole writer; it stores actual shown receipts,
  not usage, debt, leases or outcome ACK mirrors. Explicit pre-dispatch schema
  initialization imports current-day prior session shown once (excluding Site
  absorption) and stamps former full-only pending candidates. Normal reads never
  perform that transition. Full reset clears it through the same lane; analytics
  reset preserves it and snapshots exclude it. See
  [Furin daily delivery policy](../architecture/runtime/furin-daily-delivery-policy.md).
- nudge debt/ack/pending 같은 runtime lifecycle state는 session seam이 canonical이며,
  model-state fallback이나 parallel durable mirror를 두지 않는다. Debt mutation은 같은
  session lock 안에서 즉시 commit하고, bootstrap은 ACK된 debt만 그 lock 안에서 한 번
  reconcile한다. 별도 debounce/schedule/flush persistence controller는 두지 않는다.
- nudge production run은 `NUDGE_START` 전 같은 session lock 안에서 lease와
  actual site hostname을 포함한 `dispatching` pending을 한 patch로 발급한다. Global
  protocol day key의 `__global_protocol__` pseudo-host는 outcome attribution으로 쓰지
  않는다. `presented`와
  `episode_completed`는 dispatch TTL 대상이 아니며, lifecycle mutation은 exact
  issued `(key, runId, tabId)` owner가 있을 때만 허용한다. Debug transport는 dedicated
  message type을 사용하고 lifecycle은 content-local이며, background production
  lifecycle handler는 debug mode 요청을 거부한다.
- resolved/aborted terminal commit은 같은 session patch에서 runId-keyed
  `runtime.nudge_terminal_outbox` intent도 발급한다. 동일 `(key, runId, tabId,
  status)` 재전송은 idempotent ACK이고 반대 owner/status는 conflict다. Recovery
  tracking, global outcome propagation, stay decision은 outbox stage별 checkpoint를
  남기며 settings propagation restore 뒤 bootstrap에서 미완료 stage를 다시 drain한다.
  이 outbox는 terminal truth의 mirror가 아니라 post-commit delivery 상태다.
- settings disable/tab switch/window blur처럼 live document가 남은 teardown은 content
  stop을 시도한 뒤 canonical tab terminalization을 수행한다. navigation/tab removal/tab
  replacement는 떠나는 document에 재주입하지 않고 terminalization을 먼저 await한다.
  Bulk abort도 terminal+outbox를 한 patch로 쓰고 같은 tab의 pending outbox drain을
  schedule하며, bootstrap replay가 worker restart 경계를 보완한다.
- 두 요일 리듬의 정규 완화 창은 release V1 `settings.core.relaxationSchedule` 계약 하나가 소유한다. `blocks.length > 0`이 configured activity의 유일한 진실이며 별도 enabled key를 저장하지 않는다. runtime 의미는 강도 1단계 완화이고 schedule read path가 domain scope를 바꾸면 안 된다.
- 격리의 실행 중 timer와 temporary allowed hosts는 `runtime.special_session`이 소유한다. durable allowed sites는 settings에 남고, 종료된 session state를 local/settings fallback으로 복구하지 않는다.
- giant central action switch는 최종 상태가 아니다.

## Final Settings Mutation Structure

최종 구조는 아래처럼 읽혀야 한다.

```text
feature component / hook / controller
  -> typed seam
     - owner-specific command      # cross-key invariant action
     - typed setter                # single concept / single-key action
     - typed query service/store   # repeated owned reads
  -> app/domain owner layer
  -> platform settings command/query surface
  -> platform/internal transport
  -> background owner / SettingsService
  -> SettingsPersistenceCapability
  -> SettingsStore serialized document write
  <- canonical committedItems + semantic changedKeys
  -> BackgroundSettingsPropagationCoordinator
  -> runtime.settings_propagation checkpoint + ordered effects
```

해석 규칙:

- `typed seam`은 “무슨 설정 key를 어떻게 조립하는가”가 아니라 “사용자 의도와 도메인 개념이 무엇인가”를 드러내는 public contract다.
- cross-key invariant action은 `upsertSiteRule`, `updateSiteRule`, `createProtectionPreset`처럼 owner-specific command여야 한다.
- single concept update는 `setTheme`, `setDataCollectionMode`, `setPrecisionInsightsMode`, `setCLSEEnabled` 같은 typed setter여야 한다.
- `dataCollectionMode`가 수집 범위의 유일한 persisted/runtime SSOT다. `trackingScope` 입력이나 저장 값은 release V1 계약에 속하지 않으며 거부한다.
- `insightsConsent`는 범위를 재정의하는 별도 SSOT가 아니라 수집 admission이다. `unset`/`later`는 domain usage와 precision collection을 fail-closed하고, `protected_only`는 protected scope만, `all_sites`는 현재 `dataCollectionMode`가 허용한 범위까지만 승인한다. host permission이나 보호 등록만으로 consent를 추정하지 않는다.
- `insightsMode`는 분석 계산 깊이, `dataCollectionMode`는 domain usage facts 생성 범위, `precisionInsightsMode`는 high-resolution behavior collection 범위다. `precisionInsightsSignals`는 정밀 수집 내부의 신호별 제외 맵이며, collection scope 자체를 대체하지 않는다. 이 개념들을 한 setter나 implicit mapping으로 다시 결합하면 storage boundary regression이다.
- `localAnalysisProfilePolicy`는 onboarding/settings front door에서만 쓰는 product-intent composition layer다. `rhythm_map`과 `protected_start`는 기존 canonical keys를 명시적으로 patch하는 프리셋이며, persisted SSOT나 runtime fallback key가 아니다. background/runtime/stats 경계는 계속 `dataCollectionMode`, `precisionInsightsMode`, `precisionInsightsSignals`, `insightsMode`를 직접 해석해야 한다.
- 반복해서 읽는 owned state는 `SecuritySettingsQueryService`, typed store selector, owner query service처럼 concept-named seam으로 읽어야 한다.
- feature component / hook / tab / controller는 `SettingsCommandService`, `dispatchSettingsCommand`, `applySettingsPatchViaRuntime`, `readSettingsSnapshot`를 business concept의 public API처럼 직접 사용하지 않는다.
- dashboard optimistic/requested patch는 commit 증거가 아니다. `settingsCommandBus`는 transport가 검증한 `committedItems`만 성공 patch로 사용한다.
- `settingsPostCommitEffects.js`는 plan/diagnostics helper이고 executor가 아니다. ordered effect execution을 이 파일이나 `SettingsService`에 다시 만들면 owner regression이다.

## What Stays In The Final Structure

아래는 남아도 되는 정도가 아니라, final structure에 남는 것이 더 좋은 infra primitive다.

- `platform/storage/settings/SettingsCommandService`
- `platform/storage/settings/SettingsQueryService`
- transport의 generic `SET_SETTINGS`
- app-level batching / sync bus (`settingsCommandBus` 같은 thin infra)
- domain-owned settings command metadata (`settingsCommandContract.js`)

단, 조건이 있다.

- 이 primitive는 feature hot path의 public contract가 아니라 owner/store/client 내부 capability여야 한다.
- caller는 이 primitive의 raw patch shape보다 typed seam을 먼저 보게 되어야 한다.
- generic primitive가 component/hook/controller에서 직접 보이면 final structure가 아니다.

## What Must Disappear In The Final Structure

아래는 “나중에 정리하면 좋은 것”이 아니라 최종적으로 지워져야 하는 구조다.

- feature UI/controller/hook/tab가 canonical settings patch를 직접 조립하는 구조
- feature UI/controller/hook/tab가 `dispatchSettingsCommand`를 직접 호출하는 구조
- feature UI/controller/hook/tab가 `applySettingsPatchViaRuntime`를 직접 호출하는 구조
- feature UI/controller/hook/tab가 owner 없는 business key literal을 흩뿌린 채 `readSettingsSnapshot`로 직접 읽는 구조
- owner-specific command가 생긴 뒤에도 old generic mutation path를 같은 개념에 대해 병행 유지하는 구조
- compatibility shell이 아닌 old feature mutation path를 “임시로” 남겨두는 해석

## What Counts As Failure

- `platform/storage/...`를 만들었지만 실제 canonical path는 여전히 `shared/storage/...`인 상태
- domain이 raw storage backend나 generic store shape를 직접 아는 상태
- `platform` public API가 사실상 wrapper 한 장이고 진짜 owner는 다른 경로인 상태
- runtime messaging이 다시 giant policy/handler hub 하나로 재응축되는 상태
- feature controller나 popup/dashboard UI가 cross-key business patch를 직접 만드는 상태
- feature component/hook/tab가 `dispatchSettingsCommand`, `applySettingsPatchViaRuntime`, `readSettingsSnapshot`를 owner 없는 business surface처럼 직접 쓰는 상태
- 한 business concept에 대해 typed seam과 old generic mutation path가 동시에 canonical처럼 남아 있는 상태
- old `shared/storage` 경로를 지우면 실제 구현 owner까지 사라지는 상태
- public repository/service/capability를 만들었지만 호출자들이 여전히 old helper를 직접 쓰는 상태

## Tests And Build Policy

- 테스트와 build는 cutover 후 수렴 검증이다.
- old storage path를 살려두기 위해 테스트를 통과시키는 것은 실패다.
- 깨지는 테스트는 새 canonical path 기준으로 같은 세션에서 고친다.
- 중간 단계 red는 허용되지만, 종료 시에는 build와 관련 검증이 다시 green이어야 한다.

## Hard Completion Criteria

- app/domain/theme는 repository, query service, command service, capability만 사용한다.
- `dbManager`와 raw storage helper는 platform/internal 안으로 닫힌다.
- storage concept마다 `one owner, one public path`가 성립한다.
- content/protection hot path는 IndexedDB query에 의존하지 않는다.

다음이 모두 참이어야 `완성`이다.

- `platform/storage/**`가 canonical public surface다.
- `shared/storage/**`는 삭제되어 있다.
- app/domain/theme 코드에서 raw backend import를 제거해도 시스템 설명이 유지된다.
- `dbManager`는 `platform/internal` 밖에서 더 이상 business-facing contract가 아니다.
- runtime message route와 storage mutation path가 owner 기준으로 읽힌다.
- feature UI는 owner-specific command/typed setter를 호출하고, canonical storage shape 조립은 owner layer로 내려가 있다.
- 같은 business concept에 대해 feature hot path에서 old generic mutation path가 제거되었다.

## Still Not Complete If

- `platform/storage`가 생겼지만 `shared/storage`가 여전히 source of truth인 경우
- old helper를 지우면 call site들이 줄줄이 깨지는 경우
- platform public API가 self-contained하지 않고 old shared helper를 계속 semantic owner로 두는 경우
- storage cutover를 했다고 하지만 `one concept, one public path`가 아직 성립하지 않는 경우

## No-Compromise Rule

`platform 경계를 만든 것`만으로는 완료가 아니다.
실제 canonical read/write path가 platform 안으로 들어가야 완료다.

## Zen render preference (2026-09-06)

`zen_render_preset` is a small UI setting in canonical `settings.ui` on
`chrome.storage.local`, registered in `storageKeyRegistry` and the preference
settings command contract. Values are `full | balanced | low`; absent settings
initialize to `full`, while unknown present values fail. The preference store
publishes only a complete committed ACK. The exact release V1 boot prewarm DTO includes
`preference.zenRenderPreset`, with the same query/default/validator as direct
hydration. It is an ephemeral derived snapshot, not a second settings owner.
The stored value does not enter protection or Bonsai cultivation state.

## Native tab grouping preference (2026-10-09)

`tabManagement: { groupProtectedTabs: boolean }` is an independent small durable
preference in Chrome-local `settings.core`, registered in the settings command
contract and physical key registry. Default absence is OFF; invalid present
shapes are rejected. The protocol store's typed `setTabManagement` publishes the
complete canonical ACK and direct/prewarm hydration uses the same normalizer.
This browser presentation setting is separate from Gate policy, stats and
intervention admission. It has no localStorage mirror or content bootstrap
projection. Runtime managed-group/session ownership is documented by the native
protected-tab grouping owner; the durable preference never stores group IDs.

## Native protected-tab group ownership (2026-10-09)

`ProtectedTabGroupsRepository` is the typed owner of
`runtime.protected_tab_groups` in `chrome.storage.session`.
`ProtectedTabGroupService` is its sole business writer. Its exact V1 shape is
`{ version: 1, groupsByWindowId, processedTabIds, memberTabIds }`.
The window map identifies groups created in this browser session; processed IDs
preserve manual-organization decisions across worker restarts; member IDs identify
only tabs actually inserted by Entropy. It stores no URLs, titles or content.
Absent state starts an empty session. Malformed presence and IO failures reject
without rewriting or wiping. There is no durable mirror or title-based recovery.
Full profile reset and backup restore clear this registered session surface after
the shared mutation gate drains; portable exports exclude it. The durable
`tabManagement` preference remains in `settings.core` and contains no native IDs.

Chrome itself owns native-group saving and sync. This receipt does not control
that browser feature and cannot assert local-only native tab metadata.

## Dashboard boot presentation receipt (2026-09-07)


`src/platform/storage/presentation/DashboardBootPresentationStore.js` is the
public typed owner for `presentation.dashboard_boot` in chrome.storage.session.
Its internal store admits absence as the first presentation in this browser
session, otherwise requires exact V1 `{ version: 1, ensoCompleted: true }`.
The dashboard policy always animates: 3300ms before session completion and
2200ms afterward, including the initial brush hold. Reduced motion stays static.
Writes are monotonic/idempotent across windows; browser/extension session reset
and full reset clear the receipt. It is excluded from portable snapshots.
The former chrome.storage.local receipt is retired and never read or mirrored.
Storage failures remain explicit presentation diagnostics.

## Shared intervention checkpoint (2026-09-09)

`InterventionAdmissionRepository` is the typed owner of `runtime.intervention_admission`
in `chrome.storage.session`. `InterventionAdmissionService` is its only domain
writer. The versioned state contains the existing admission kernel, one ordinary
lease, mandatory isolation owners and the latest exact terminal identity. Recovery
is 45 seconds after actual presentation ends. Settings application and document
replacement do not reset it; browser/extension session reset can. Absent state
initializes a browser session; malformed persisted state fails explicitly. There
is no localStorage mirror, second timer authority or queued candidate store.

See [intervention admission](../architecture/runtime/intervention-admission-runtime.md) for
reservation expiry, lost-document handling and the observable first-paint limit.

### Gate entry approval session checkpoint

`GateEntryApprovalRepository` is the typed access owner of
`runtime.gate_entry_approval` in `chrome.storage.session`.
`GateRuntimeStateOwner` is its sole business writer. The exact V1 shape is
`{ version, decisionAt, sessionId, approved, observedAt, awaySince }`.
Absence means no explicit entry approval in this browser session; malformed
presence and IO errors fail explicitly. There is no settings/local/IDB mirror,
legacy host-pass read, periodic write timer or analytics history. Owner-serialized
writes preserve the last decision identity after expiry to reject replay.
The existing Tracking tick and browser event lanes drain through the existing
profile mutation gate before session reset. See
`docs/architecture/runtime/intervention-admission-runtime.md` for policy.

### Gate return lock session checkpoint

`GateReturnLockRepository` is the typed access owner of
`runtime.gate_return_lock` in `chrome.storage.session`.
`GateRuntimeStateOwner` is its sole business writer, through
`gateReturnLockPolicy.js`. The exact V1 shape is
`{ version, observedAt, present: { [siteKey]: since }, locks: { [siteKey]: { presentSince, leftAt, until } } }`,
keyed by base-domain site. Absence means nothing is held in this browser
session; malformed presence and IO errors fail explicitly. Turning the return
guard off writes the empty state, so no stale presence can arm a lock later.
There is no settings/local/IDB mirror or analytics history. Browser restart
clears it with the rest of session storage. See
`docs/architecture/runtime/intervention-admission-runtime.md` for policy.

Schedule runtime session inputs: RuntimeFlagRepository owns
`runtime.special_session` (manual checkpoint) and
`runtime.schedule_occurrence_skip` (one skipped local-calendar occurrence ID).
`runtime.schedule_state` is a version-2 applied receipt from
scheduleRuntimeCoordinator, not a settings mirror or policy input. These session
keys are registered in storageSurfaceRegistry and excluded from durable user
settings; recurring blocks remain in the CORE `relaxationSchedule` document.
