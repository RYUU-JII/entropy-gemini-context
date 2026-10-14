# Audio Dulling Runtime Architecture

- Status: Active
- Owner: protection runtime + runtime QA
- Last validated against code: 2026-07-30
- Path policy: current-only
- Canonical for: development-only Suikinkutsu tab-audio resolution research and public-release exclusion

`audioDulling` is the development-only research path for lowering the perceptual
resolution of protected-site media audio through local Web Audio processing.
It does not record, upload, or persist audio. The named Zen manifestation is
`suikinkutsu` (`水琴窟`).

The research path is executable through the human-only Entropy QA target
`audio/suikinkutsu`. It is still not a public release feature: Chrome requires
a browser-recognized extension invocation before tab capture. The current
ritual therefore turns the prepared tab's pinned toolbar action into a
short-lived Suikinkutsu action; the one real toolbar click both satisfies that
browser requirement and starts sound processing.

## Runtime Boundary

- Canonical setting key: `filterSettings.audioDulling`
- Public runtime truth: disconnected from the protection feature catalog
- Canonical artifact candidate: `resonance` / Zen manifestation `suikinkutsu`
- Owner: `src/domains/protection/background/audioDulling/AudioDullingCoordinator.js`
- DSP plan: `src/domains/protection/audioDulling/audioDullingResolutionPlan.js`
- Shared page-media activity: `src/domains/nudge/video/VideoElementObserver.js` and `src/domains/nudge/media/PageMediaActivityObserver.js`
- Media evidence projector: `src/domains/nudge/media/mediaConsumptionEvidence.js`
- Suikinkutsu candidate policy: `src/domains/protection/audioDulling/suikinkutsuInterventionCandidate.js`
- Pure admission contract: `src/domains/nudge/runtime/interventionAdmissionKernel.js`
- Opt-in dev admission owner: `src/domains/nudge/runtime/InterventionAdmissionArbiter.js` through `interventionAdmissionRuntime.dev.js`
- Dev shadow observer: `src/domains/nudge/runtime/InterventionAdmissionShadow.js`
- Public disabled entry: `src/domains/nudge/runtime/interventionAdmissionRuntime.public.js`
- Hidden audio worker: `src/pages/offscreen.html`, `src/apps/offscreen/main.js`, and `src/apps/offscreen/audioDullingGraph.js`
- Dev QA route: `src/apps/background/services/runtime/messageRoutes/audioDullingQaMessageRoutes.dev.js`
- Dev QA protocol: `scripts/qa/protocols/audioDullingQaProtocol.mjs`

Content runtime never captures tab audio. In a dev QA run,
`PageMediaActivityObserver` leases the document and open-shadow mutation stream
already owned by `VideoElementObserver`, attaches playback listeners, and emits
one content-free audio/video activity snapshot. It owns no top-document or
shadow `MutationObserver` and has no polling loop. The evidence projector
compresses that snapshot, and the Suikinkutsu policy decides only whether to
request an intervention candidate. `AudioDullingActivationChip` presents one
non-interactive reverse-gravity water ritual and reports only the invitation's
presentation, visual arrival, and expiry. The background route owns the exact
target tab, temporary action takeover, arrival-synchronized badge pulse,
browser-recognized toolbar click, coordinator, stream-id acquisition, offscreen
lifecycle, status projection, restoration, and cleanup.

The public runtime does not register the water drop, instantiate the
coordinator, expose a capture sender action, request audio-capture permissions,
or enable shared intervention admission. Vite keeps
`enableSharedInterventionAdmission` false for both default dev and public builds;
only an explicit dev build with `ENTROPY_ENABLE_SHARED_INTERVENTION_ADMISSION=1`
selects the research owner. Public builds reject that capability and
resolves `@intervention-admission-runtime` to the fail-closed public entry.
The public build excludes the arbiter, shadow observer, pure kernel,
Enso/Suikinkutsu candidate producers, page-media evidence path, offscreen page
input, and every capture-capable dev bridge. Any excluded module or signature
in the public module inventory or artifact is a release failure.

## Permission Model

The Chromium `dev` release profile requires `activeTab`, `offscreen`, and
`tabCapture` for this named experiment. `extensionManifestProfile` adds them
only for that profile and removes them from public and non-Chromium artifacts.

The dev harness cannot manufacture the user invocation and cannot pin the
extension programmatically. Entropy must already be pinned. When the visual
invitation begins, the background snapshots that tab's popup, title, badge,
and badge color, switches from the manifest default to the temporary
Suikinkutsu water icon, sets an unmistakable `水` badge, and disables the popup
for that tab only. The badge begins in a dim blue state; the trusted
visual-arrival event pulses it cyan and settles it to the armed blue state. A
click while the invitation is armed reaches
`action.onClicked`; the background restores the normal action surface before
requesting the current active-tab stream id. Expiry, failure, replacement, and
STOP restore the same snapshot and manifest-default icon without starting
capture.

Promotion to public still requires a fresh UX review, Chrome Web Store
justification, and CI/security contract update in the same change.

## State Flow

The public release exclusions remain:

1. `audioDulling` is not part of `PROTECTION_FEATURE_CATALOG`.
2. `audioDulling` is not part of `EXTENSION_CONTEXT_RUNTIME_FILTER_KEYS`.
3. `resonance` is not part of release artifact definitions or runtime bindings.
4. `ProtectionRegistry` does not register `AudioDullingActivationChip`.
5. The eager background dispatcher binding does not instantiate `AudioDullingCoordinator`.
6. `ProtectionDispatcher`, its app binding, and `ProtectionRuntimeCoordinator`
   expose no audio capture method or coordinator seam.
7. The public Rollup input excludes `src/pages/offscreen.html`.
8. `BUILD_ENABLE_SHARED_INTERVENTION_ADMISSION` is false and the public alias
   exposes only `build_capability_disabled`.

The dev QA path uses one typed, synthetic research snapshot. Coordinator
reconcile input still follows the validated protection runtime snapshot shape:
`dispatch.shouldApply` plus `envelopeResult.state.compiledFeatures`. Missing
`audioDulling` inside `compiledFeatures` is the expected public inactive state;
malformed runtime snapshots or malformed present `audioDulling` entries fail
instead of silently becoming inactive.

```text
trusted QA harness PREPARE
  -> exact target web tab + content readiness
  -> coordinator ARMED with the requested resolution plan
  -> shared page-media activity snapshot
  -> expiring media-consumption evidence
  -> Suikinkutsu policy requests a candidate after sustained audible playback
  -> opted-in dev admission arbiter reserves Suikinkutsu only when no Enso lease/gap blocks it
  -> AudioDullingActivationChip mounts and commits the reservation as presented
  -> one large drop condenses low in the viewport and rises toward the toolbar
  -> trusted content sender marks INVITATION_PRESENTED
  -> exact-tab action temporarily becomes the dim badged Suikinkutsu action
  -> local edge glow, contracting ripples, and reverse splash absorb the drop
  -> trusted content sender marks INVITATION_ARRIVED
  -> exact-tab 水 badge pulses cyan and settles to its armed blue
  -> operator clicks the pinned Entropy toolbar icon once
  -> action.onClicked restores the popup and obtains the current-tab stream id
  -> offscreen graph connects directly at the requested resolution plan
  -> harness observes raw / processed / dry-recovery phases
  -> STOP closes stream, AudioContext, graph, and content surface
  -> arbiter releases the presented lease and begins the shared 45-second gap
```

The canvas is visual-only (`pointer-events: none`). It has no hit target,
pointer-proximity slowdown, or repeating cycle. Its approximate 2.4-second
story is condensation, reverse ascent, then upper-right absorption. The final
absorption beat uses a local edge glow, three contracting ripples, and a small
reverse splash; it does not draw a broad top-edge success flash. Exact browser
toolbar coordinates are unavailable to content, so the canvas exits through
the upper-right viewport edge and the arrival-synchronized `水` action badge
completes the continuity. The action window is bounded to 10 seconds by
default.

## Intervention Evidence and Admission

The media observer reports facts; it does not know Enso, Suikinkutsu, or any
presentation policy. `projectPageMediaConsumptionEvidence` validates and
compresses those facts into short-lived evidence.
`evaluateSuikinkutsuInterventionCandidate` applies only Suikinkutsu's sustained
audible-media rule and returns either an explicit rejection or an expiring
candidate. It does not choose among interventions or mutate runtime state.

`reduceInterventionAdmission` is the pure shared decision contract.
`InterventionAdmissionArbiter` is its stateful dev owner. One request produces
exactly one explicit `emit`, `swallow`, or `defer` decision. An emitted
candidate first owns a reservation lease. Cooldown begins only after a
presented lease is released, and aborting an unpresented reservation consumes
no cooldown. `defer` is a caller-owned retry instruction, not a hidden kernel
queue.

The explicitly opted-in dev build connects both existing Enso sources and
Suikinkutsu to this owner. The default dev build retains the same disabled path
as release so ordinary Feed Horizon debugging has no hidden shared-admission
decision. `EnsoSpawnPolicy` still owns source-specific Enso first grace
(`click_intent` configured, `feed_horizon` zero), click/feed source leases, the
content-local cross-source presentation cooldown, and its local permit. A successful Enso local
reservation additionally reserves one shared lease; Enso commit, abort, and
release mirror the same lifecycle into the arbiter. Suikinkutsu reserves only
after its current audible-media candidate is eligible. If Enso owns the lease,
the chip subscribes to arbiter state, then re-evaluates fresh media evidence
after release rather than queuing an old candidate. A presented Suikinkutsu
lease remains active through the toolbar action window and releases on
activation, expiry, failure, or teardown.

`classifyInterventionConsumptionPattern` now projects the current
`dopamineBingeDetection` and expiring page-media evidence into one immutable
`neutral`, `reward_wandering`, `feed_binge`, `audible_media`, or `mixed`
profile. It creates no new observer and retains no DOM/media identity.
Reward/feed pressure raises the Enso candidate weight; sustained audible media
raises the Suikinkutsu candidate weight. Malformed present evidence fails
loudly, dopamine-binge input expires after 90 seconds, and media evidence keeps
its shorter canonical `validUntil`.

The opted-in dev admission runtime retains only the latest validated evidence references
and reprojects the profile at request time. Enso supplies the exact detection
that admitted its click/feed attempt; Suikinkutsu supplies the exact media
evidence that made its candidate eligible. Both remain in the same priority
tier, so a request set is ordered by current profile weight without moving
sensing, reveal policy, or presentation into the arbiter. The arbiter still
serializes independently arriving requests immediately; it does not hold a
hidden batching window or stale candidate queue. The public build retains the
existing Enso-only `EnsoSpawnPolicy` behavior because its build-selected
admission runtime is disabled.

`InterventionAdmissionShadow` is the next dev-only observation seam. After the
real arbiter has made its unchanged immediate decision, the runtime mirrors the
content-free weighted candidate and actual decision into a bounded 160 ms
epoch. Epoch completion runs the same pure kernel against a fresh open state
and records the counterfactual winner, actual accepted winner, collision,
comparability, and agreement. It never reserves/releases a real lease, delays
presentation, changes retry scheduling, or writes evidence. Repeated attempts
with the same request id coalesce onto the latest weight/timing while kind,
evidence revision, priority, and exclusivity remain immutable.

Explicit dev QA `SNAPSHOT` requests obtain the content-local admission,
consumption-profile, and shadow snapshots through the authenticated
`CONTENT_SNAPSHOT` relay. Normal invitation events do not pay this diagnostic
round trip. This makes real-session mismatch evidence available without a
page-global debug API or public-build surface.

## Audio Resolution Contract

The graph is intentionally one stable topology. Updates ramp existing
`AudioParam` values; they do not tear down and rebuild the media graph.

- spatial detail: progressively narrowed stereo width through symmetric
  crossfeed;
- spectral detail: raised sub-bass floor, lowered upper bandwidth, and a
  high-shelf reduction;
- transient detail: progressively softer dynamic contrast;
- loudness control: bounded compensation avoids presenting simple volume
  reduction as the entire effect;
- transition: configurable linear ramp, with a 12-second product-research
  default and an 8-second QA comparison default.

The only canonical preset is `resolution`. Character presets such as radio,
room, or bit-crush effects are excluded because the intended question is
whether coordinated sensory-resolution reduction changes reward salience, not
whether an obvious novelty effect is entertaining.

## QA Contract

`audio/suikinkutsu` is human-only, attach-only, authenticated, and dev-artifact
only. The harness stages and reloads the dev artifact with `scripting` and only
the selected media URL's exact origin promoted for content readiness, opens the
media target in the background, and never focuses the browser or changes
audio/mute state.
It waits for the operator ritual, then records the offscreen plan during a dry
baseline, processed hold, and dry recovery. Cleanup stops the exact prepared
session before detaching while preserving the QA browser process and profile.

Sender trust is split by action:

- only the trusted QA harness may prepare, update, inspect, or stop;
- only the exact prepared top-frame content sender may report invitation
  presentation or expiry;
- only the browser's real `action.onClicked` event on the exact prepared tab
  may request activation;
- content mount/status/remove messages must come from the extension background.

## Release Artifact Contract

`scripts/ci/check-public-build-debug-surface.mjs` rejects the offscreen page,
resolution graph and research modules, dev QA contracts/routes/relays,
tab-capture/getUserMedia signatures, and background audio-capture method
surfaces in every public artifact. `cws:preflight` runs
that contract through the public build post-check; checking manifest
permissions alone is insufficient.

## Public Promotion Exit Conditions

Public promotion requires all of the following in one owned change:

1. an interaction contract that makes the browser-required invocation
   understandable without pretending it is automatic;
2. a public sender-policy and target-resolution seam;
3. protection feature/catalog, settings, and artifact ownership;
4. manifest permission and Chrome Web Store disclosure updates;
5. lifecycle, cleanup, accessibility, and failure-state evidence;
6. security and public-artifact guard updates.

## Non-Goals

- Do not lower network bitrate or rewrite streaming media requests.
- Do not use `MediaElementAudioSourceNode` as the canonical path for third-party media.
- Do not store audio samples or derived audio buffers.
- Do not add a fallback that silently changes `<video>` or `<audio>` volume when tab capture is unavailable.
- Do not let the harness synthesize or obscure the browser-required invocation.
