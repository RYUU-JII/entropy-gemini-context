# Dashboard AI Narration Boundary Map

- Status: Active
- Owner: dashboard AI panels/hooks, AI narration domain service, Chrome built-in AI provider seam
- Last validated against code: 2026-08-08
- Path policy: current-only
- Canonical for: dashboard AI narration request flow, input redaction, model availability/preparation state, schema-validated final copy, and deterministic-copy recovery
- Companion to:
  - `docs/architecture/repository/main-tab-home-surface-boundary-map.md`
  - `docs/architecture/repository/personal-baseline-boundary-map.md`
  - `docs/system-architecture/02-runtime-storage-boundaries.md`

## Purpose

This map audits the dashboard AI narration feature. AI narration is a local
copy assistant layered on top of deterministic dashboard facts. It must not
become a stats owner, a policy decision engine, a storage writer, or a hidden
fallback that changes the meaning of runtime data.

The practical reading question is:

```text
Can AI narration improve display copy while all facts, labels, policy decisions,
and persisted state remain owned by deterministic systems?
```

## System Flow

Session summary narration:

```text
HomeScanWorkspace
  -> buildSessionSummaryDraftFromHomeScanSnapshot()
  -> deterministic brief commits
  -> non-Zen post-first-frame idle admission
  -> main-session-summary-ai local async boundary
  -> SessionSummaryAiPanel chunk mounts
  -> useSessionSummaryNarration()
  -> dashboardAiClient
  -> AiNarrationService
  -> ChromeBuiltInAiProvider
  -> schema-validated narration
  -> applySessionSummaryNarrationToBrief()
```

Usage insight narration:

```text
UsageInsightAiPanel
  -> useUsageInsightNarration()
  -> buildUsageInsightNarrationInputSignature()
  -> dashboardAiClient
  -> AiNarrationService
  -> ChromeBuiltInAiProvider
  -> schema-validated narration state
```

Domain service:

```text
create*Request()
  -> deterministic input builder
  -> redactAiInput()
  -> task registry
  -> provider availability / prepare / generate
  -> JSON parse and schema validation
  -> ok / unavailable / error result
```

## Owner Table

| Concern | Owner | Key files | Output | Forbidden shortcut |
| --- | --- | --- | --- | --- |
| Home deterministic facts | home scan/status owners | `buildHomeScanSnapshot.js`, status controller hooks | deterministic brief and metrics | AI generating facts or labels |
| Session summary presentation adapter | dashboard AI pure adapter | `sessionSummaryPresentation.js` | deterministic draft, display-result identity, bounded copy overlay | importing task/provider runtime into Main first-frame graph |
| Session summary request adapter | dashboard AI input adapter | `sessionSummaryNarrationInput.js` | redaction-ready request signature | raw runtime snapshot sent directly to provider |
| Session summary enrichment admission | Main local async boundary | `SessionSummaryAiEnrichment.jsx` | non-Zen post-first-frame idle mount and explicit local retry | capability check during Zen/boot or before panel mount |
| Usage insight input | dashboard/domain AI input adapter | `usageInsightNarrationInput.js`, `buildUsageInsightNarrationInput.js` | bounded insight/home input | page text, URLs, or raw logs in AI prompt |
| Input redaction | AI orchestration domain | `AiInputRedactor.js` | bounded local prompt input | case-sensitive privacy blocklist gaps |
| Task registry and schemas | AI domain | `AiTaskRegistry.js`, task schemas | registered task, response schema | accepting provider text without schema validation |
| Provider implementation | platform AI seam | `ChromeBuiltInAiProvider.js` | local LanguageModel availability/prep/generate result | dashboard component calling provider directly |
| Dashboard AI hooks | dashboard AI hooks | `useAiNarrationTaskRuntime.js`, `useSessionSummaryNarration.js`, `useUsageInsightNarration.js` | shared UI phase, availability, error, download progress | per-task hook reimplementing its own runtime state machine |
| Final copy overlay | dashboard AI display adapter | `applySessionSummaryNarrationToBrief()` | brief display copy plus `aiNarration` metadata | changing chips/actions/metrics/policy fields |

## Function Ledger

| Boundary function | Input | Output | Failure / missing-data policy |
| --- | --- | --- | --- |
| `buildSessionSummaryDraftFromHomeScanSnapshot()` | home scan snapshot | deterministic summary draft or null | missing focus domain/brief means no AI panel |
| `buildSessionSummaryPresentationSignature()` | summary draft and locale | current deterministic overlay identity | does not replace the AI request signature |
| `resolveSessionSummaryNarrationReadiness()` | summary draft | ready/reason code | no request is built when deterministic copy/labels are missing |
| `buildSessionSummaryNarrationInputSignature()` | draft, locale, tone | stable request signature | not ready returns empty signature |
| `redactAiInput()` | task input | depth/item/string-bounded redacted input | URL/raw document/log keys and URL substrings redact before provider input |
| `AiNarrationService.generate()` | validated task request | ok/unavailable/error result | provider errors and schema failures return error results |
| `parseAndValidateAiJsonResult()` | provider text and schema | parsed value or validation error | invalid JSON/extra fields do not reach display copy |
| `ChromeBuiltInAiProvider.availability()` | provider options | availability state | missing LanguageModel API is explicit unavailable state |
| `useAiNarrationTaskRuntime()` | task id, readiness, input signature, task-specific prepare/generate functions | shared hook state for capability, preparation, generation, cancellation, and download progress | task hooks do not fork async failure/abort semantics |
| `applySessionSummaryNarrationToBrief()` | deterministic brief and narration | display brief copy overlay | null/invalid narration returns original brief object |

## Recovery Versus Fallback

| Class | Allowed? | Rule |
| --- | --- | --- |
| AI unavailable | Yes | show unavailable/preparation state; deterministic UI remains authoritative |
| AI generation failure | Yes | show AI error state; do not mutate deterministic facts |
| AI enrichment chunk failure | Yes | keep deterministic brief, show local explicit retry, and create a fresh lazy attempt |
| Invalid provider output | No fallback output | schema validation returns error and blocks generated copy |
| Malformed AI success timestamp | No fallback | generation/preparation success metadata must use the service-owned timestamp; do not replace invalid timestamps with `Date.now()` |
| Provider-owned metadata collision | No fallback | provider metadata must not overwrite service-owned `providerId`, `generatedAt`, or `preparedAt` |
| Deterministic brief when AI absent | Yes | this is the canonical display source, not a secondary runtime source |
| Partial AI copy overlay | Bounded | only title/body display copy may overlay; chips/actions/metrics stay deterministic |
| Raw URL/page/log input | No | redactor blocks URL/raw document/log keys case-insensitively and redacts URL substrings in allowed string values |
| AI storage writes | No | AI narration state is UI/session state only |
| AI policy decisions | No | task policy says no new facts, no diagnosis, no policy decision |
| AI request protocol | No compatibility interpretation | `AI_TASK_PROTOCOL_VERSION = 1`; the envelope has one exact field set and invalid provided locale/tone/object fields fail loudly |
| Home session-summary draft | No alias read | `home-focus-session-summary-v1` is the sole draft contract; `draftVersion`, `labelIds`, alternate copy containers, and alternate action fields are rejected |

## Current Findings

### F1. AI narration is a copy layer, not a facts owner

Status: keep.

The feature starts from deterministic home scan/session summary data and applies
successful AI output only to display copy fields. Metrics, chips, actions,
labels, policy decisions, and storage remain owned by the deterministic systems.

### F2. Provider output is schema-validated before display

Status: keep.

`AiNarrationService` parses provider text as JSON and validates it against the
task response schema. Extra fields, malformed JSON, or missing required fields
produce an AI error result instead of a quiet best-effort display update.

### F3. AI input redaction handles URL/log/raw document variants and URL substrings

Status: fixed in the 2026-06-29 dashboard AI narration pass and hardened in the 2026-07-01 dashboard AI redaction pass.

`redactAiInput()` now normalizes blocked key names before matching and includes
common URL key variants such as `rawUrl`, `documentUrl`, `pageUrl`, and
`fullUrl`. It also blocks URL-suffix fields such as `sourceUrl`,
`referrerUrl`, and `canonicalUrls`, plus raw document/log text variants such as
`rawPageText` or `textContent`. Allowed string fields redact common URL-like
substrings before prompt construction, including web, extension, and file URL
schemes. This keeps prompt input bounded even when upstream adapters or debug
objects use different casing, separators, or embedded URLs.

### F4. Deterministic copy recovery is acceptable here

Status: keep.

Returning the original deterministic brief when AI is unavailable or invalid is
not a business-data fallback. It is the primary display contract. AI narration
is optional decoration around local deterministic facts.

### F5. AI narration hook runtime is shared across task adapters

Status: fixed in the 2026-06-30 dashboard AI hook runtime pass.

`useSessionSummaryNarration()` and `useUsageInsightNarration()` previously
implemented matching capability, prepare, generate, abort, download-progress,
and error-state logic independently. That duplicated the most failure-sensitive
part of the UI runtime and made future fixes likely to land in only one
narration surface.

Resolution:

- `useAiNarrationTaskRuntime()` owns the shared prepare/generate state machine,
  stale-request checks, cancellation, download progress, and capability refresh
  behavior.
- task-specific hooks now only build readiness/input signatures and wire their
  registered AI task prepare/generate functions.
- focused hook-runtime tests cover successful generation, schema/error result
  visibility, and explicit preparation unavailability.

### F6. AI success metadata is owned by the service clock

Status: fixed in the 2026-07-01 dashboard AI metadata pass.

AI unavailability still falls back to deterministic dashboard copy, but AI
success metadata is not decorative copy. `createAiTaskOkResult()` and
`createAiPreparationOkResult()` now require finite service-owned timestamps and
keep canonical `providerId`, `generatedAt`, and `preparedAt` from being
overwritten by provider metadata. `useAiNarrationTaskRuntime()` also rejects an
`ok` preparation result that lacks `metadata.preparedAt` instead of filling it
with a local `Date.now()` value.

### F7. AI request and session-summary presentation contracts are release V1 exact

Status: fixed in the 2026-07-11 release V1 baseline pass.

`aiRequestProtocol.js` owns the exact V1 request envelope. The Home narration
path emits `home-focus-session-summary-v1`, and the session-summary input owner
accepts only that current field set. Unknown/extra fields and predecessor alias
shapes are rejected before redaction or provider invocation.

### F8. Home AI runtime is not part of Main first-frame correctness

Status: fixed in the 2026-08-08 Main loading pass.

Home imports the deterministic presentation adapter through its narrow module.
The panel, hooks, client, task registry, and Chrome provider remain behind the
`main-session-summary-ai` chunk. Zen never mounts it. Non-Zen waits for the clean
Main frame and a local idle slot; only the mounted panel may begin capability
I/O. Inactive Main unmounts the panel, while dynamic-import failure stays inside
the brief slot with an explicit retry and cannot replace deterministic copy.

## Re-Audit Checklist

- Run `npm run test:file -- tests/aiInputRedactor.test.js tests/sessionSummaryAiNarration.test.js tests/mainSessionSummaryAiEnrichment.test.jsx tests/aiNarrationProtocol.test.js tests/aiNarrationTaskRuntime.test.jsx` after AI input/redaction/task/result-contract/hook-runtime changes.
- Run `npm run lint -- src/domains/ai/orchestration/AiInputRedactor.js tests/aiInputRedactor.test.js` after redactor changes.
- Confirm new AI tasks use deterministic bounded input builders plus `redactAiInput()`.
- Confirm provider outputs are schema-validated before any dashboard display adapter uses them.
- Confirm generated AI output never writes to settings, stats, storage, rules, or runtime policy.
