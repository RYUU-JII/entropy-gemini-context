# Entropy Sound Lab & Procedural Synthesis

- Status: Active
- Owner: app sound runtime / sound design research owners
- Last validated against code: 2026-09-07
- Path policy: current-only
- Canonical for: procedural sound synthesis research, sound targets, candidate reviews, and human-agent sound design workflow

## Purpose

The Sound Lab is the interface between a human's sound-design decisions and an
agent's synthesis work. The main sequence is **feature moment → intention →
audition → feedback → agent revision → product integration**. Synthesis factors
and waveform/FFT inspection are optional tools, not the main workflow.

The standalone lab lives outside the extension. Product code never imports the
research workspace. Canonical themes remain `matrix`, `entropy`, `cyberpunk`,
`clinical`, `scp`, and `zen`. A theme without a sound implementation never borrows
another theme's implementation. Silence can be proposed as a design decision.

## Owner table

| Concern | Owner / path | Contract |
| --- | --- | --- |
| Sound target specs | `scripts/dev/sound-lab/specs/soundTargets.js` | Identity, theme, kind, bus, duration and acoustic design specification |
| Feature discussion brief | `scripts/dev/sound-lab/workspace/soundBriefs.js` | Moment, intention, accessible name and listening question; design context is not runtime event evidence |
| Agent deliverables | `scripts/dev/sound-lab/workspace/soundCandidates.js` | Explicit versioned candidate, registered synth identity, parameters, source, rationale and changes |
| Research synth implementation | `scripts/dev/sound-lab/engine/synths/SynthRegistry.js` | Exact registered handler; missing handler throws |
| Product connection scan | `scripts/dev/sound-lab/scanner/soundCatalogScanner.js` | Current sound pack descriptor, independently of lab candidate availability |
| Review contract / projection | `scripts/dev/sound-lab/workspace/soundWorkspace.js` | Strict candidate/target/revision validation and agent handoff text |
| Research feedback persistence | `scripts/dev/sound-lab/host/reviewRepository.mjs` | Immutable, idempotent JSON records in `scripts/dev/sound-lab/workspace/reviews/` |
| Local host | `scripts/dev/sound-lab/host/server.mjs` | Explicit loopback-only host, allowlisted reads and bounded same-origin review writes |
| Lab build | `scripts/dev/sound-lab/build.mjs` | Bundle plus source-closure revision manifest; stale sources reject review writes |
| Review UI | `scripts/dev/sound-lab/browser/src/main.js` | Feature selection, product/candidate auditions, per-candidate drafts, review history and copyable request |
| Audition lifecycle | `scripts/dev/sound-lab/browser/src/playback/SoundLabPlayer.js` | One owned AudioContext per audition; close on stop/replacement/hide/end |
| Product runtime / theme integration | `src/domains/sound`, `src/themes/core/sound`, `src/themes/plugins/zen/sound` | Owned by the companion app sound boundary; never imports research code |

The research file repository is not an app storage backend. It does not change
settings, bootstrap state, historical product data, or runtime session state.
App storage rules continue to apply to all product integration work.

## Separate decisions from observations

Three concepts have independent owners:

- **Research availability** comes from registered, explicitly named candidates.
- **Human feedback** records discussion, revision request, preference, hold or
  silence proposal. It never mutates a product mapping. Preference requires a
  browser-reported audition at the current parameter values, not a claim that
  listening quality was automatically validated.
- **Product connection** comes from the currently built source checkout's
  sound pack. It is not proof of feature timing, product mix, deployment, or
  acoustic equivalence to a research candidate.

The UI computes counters from these owners instead of hard-coded completion
numbers. A candidate is never marked integrated just because a person prefers
it. A missing candidate disables playback and leaves discussion available.
The feature ledger opens with the `zen` filter selected. Zen is the first visible
theme choice; the remaining canonical themes and an explicit all-themes view
remain available. Header inventory counters continue to describe the full catalog.

## Review and agent handoff

A saved review includes the selected target, candidate snapshot, source revision,
parameters, whether the current settings were auditioned, context, tags, direction,
free text, request ID and save timestamp. Records are append-only; retried requests
return the existing record, while a conflicting reuse of an ID fails. Historical
records remain attached to their original build even after source changes.

The page holds unsaved drafts separately for each target/candidate. It warns on
leaving with unsaved changes and reports failed saves visibly. It never substitutes
localStorage or an undeclared cache as persistence. Direct file opening is an
explicit audition/copy-only mode; durable saves require the local host.

The host and browser must agree on the bundle revision. The host hashes the
recorded source closure before reads/writes and rejects stale sources. Rebuild
and refresh after an agent changes code. Candidate source paths must belong to
the actual bundle closure. Initial `lab-v1` candidates register existing lab work
without claiming a new synthesis or equivalence to the product implementation.

A copied request includes the moment, goal, selected candidate/version, source
revision, exact listening conditions and feedback. It directs the agent to read
the saved review records, preserve old candidates, register new work, and rebuild
the lab. Saving and copying do not send an agent message or start synthesis.

## Synthesis and product application

The current research engine uses WebAudio modules and physical/digital synthesis
primitives. Product primitives live under `src/platform/audio/synth/`; product
synths and sound-pack mappings belong to their theme. Procedural synthesis avoids
unverified recordings but still has a code footprint. Existing noise and jitter
are stochastic, so repeated auditions are not deterministic acoustic captures.

Product baseline auditions invoke the actual mapped synth with an injected
AudioContext and default context. Research auditions invoke the candidate's exact
registered handler and declared parameters. Product auditions do not pass through
feature runtime scheduling or bus policy. All auditions are bounded to target
duration plus one second of tail; continuous scenes require product-flow checks.

A selected take still needs deliberate product integration: port the chosen
algorithm/parameters into the owning product synth or register an accepted asset,
wire the canonical cue/scene, and verify timing, gain, repetition and lifecycle.
Never introduce direct feature-owned WebAudio or asset paths.

## Operations and verification

The executable workflow and candidate registration contract are documented in
`scripts/dev/sound-lab/README.md`. The host runs only after an explicit
`npm run dev:sound-lab`; routine implementation does not start it or a browser.

Focused verification:

- `tests/soundLabWorkspace.test.js`: independent product/research state,
  candidate drafts, audition-dependent preference and handoff identity.
- `tests/soundLabReviewHost.test.js`: file persistence, idempotency, concurrent
  non-overwrite, stale revision, origin and candidate validation.
- `tests/soundLabPlayback.test.js`: exact playback function, owned-context
  cleanup and racing selection protection.
- `tests/soundLabScanner.test.js`, `tests/soundEngine.test.js`: catalog/engine contracts.
- `npm run build:sound-lab`: workspace metadata/source closure and browser bundle.

Use `docs/architecture/repository/app-sound-runtime-boundary-map.md` for product
integration, and the repository QA control plane for named browser verification.
