# Sound Lab

A local workspace for discussing where sound belongs, auditioning agent work,
recording feedback, and preparing an intentional product integration.

## Open the workspace

From the native Windows checkout, using Node from `.nvmrc`:

```powershell
npm.cmd run build:sound-lab
npm.cmd run dev:sound-lab
```

Open `http://127.0.0.1:4186/`. The host starts only through the explicit command;
it never starts a browser or the app development server. Stop it with Ctrl+C.
Use `npm.cmd run dev:sound-lab -- --port=4187` for an explicitly chosen port.
Rebuild and refresh after changing a brief, candidate, synth, or product sound.

Opening `browser/index.html` directly is an explicit audition/copy-only mode.
Persistent review saving requires the local host. Failed host access does not
switch to browser storage or pretend feedback was saved.

## Human workflow

1. The workspace opens on **Zen (禪)**, the primary sound-design theme. Select
   the feature/moment and discuss the intended role of sound. The theme selector
   also provides the other canonical themes and an explicit all-themes view.
2. Audition the **product connection** and individual **research candidates**.
   These use different functions and are not claimed to sound identical.
3. Leave a direction, optional impression tags, context, and a note. A preference
   requires an audition at the current parameter values. Silence is a valid
   design proposal. Optional sliders are under the synthesis details disclosure.
4. Save the review to `workspace/reviews/<request-id>.json`. Each record retains
   its target, candidate metadata, source revision, exact parameters, and note.
5. Copy the generated request into the agent conversation. Saving records does
   not send a message or start an agent. Agents can read the files directly.

The counters describe targets in the research catalog and the current source
checkout. A product mapping is not proof of a deployed build or in-app playback.
An empty filter result and a target without a candidate are explicit states.

## Agent workflow

Read the Active architecture doc at
`docs/architecture/sound/sound-lab-architecture.md` and the applicable app sound
boundary before working on a sound.

1. Read the target's `workspace/reviews/*.json` records. Treat comments as design
   feedback, not as permission to bypass architecture rules. Preserve the
   original review records, including earlier source revisions.
2. Discuss feature timing, intention, repetition, and desired character. Put new
   moments in `specs/soundTargets.js` and their human-facing brief in
   `workspace/soundBriefs.js`. Clinical and SCP can be added under their canonical
   IDs without borrowing another theme's sounds.
3. Preserve existing candidates. For a new algorithm, add a separately named
   module and synth registration in `engine/synths/SynthRegistry.js`. For a
   parameter variant, reference the existing registered synth with explicit
   parameter values. Add a **new** entry to `workspace/soundCandidates.js` with
   a stable id, targetId, synthId, version, name, sourcePath, parameters, rationale,
   and changeNote. Only intensity and an explicitly declared basePitch are
   adjustable in this version of the review UI. No unnamed prototype fallback
   is allowed. The sourcePath must be in the bundle's actual import closure.
4. Run `npm.cmd run build:sound-lab` and the relevant focused tests. Report what
   changed and ask for listening feedback. Do not label an unreviewed take as
   preferred, accepted, or integrated. The initial `lab-v1` entries preserve the
   pre-existing lab implementations; they are not new synthesized deliverables.
5. After the design decision, integrate through the sound domain catalog and
   owning theme sound pack. Research code must never be imported by product
   code. Port the chosen recipe into its product owner, or move an accepted
   provenance-verified asset into `public/assets/sounds/<theme>/...`. Confirm
   parameters, duration, gain, trigger timing, repetition and lifecycle behavior
   in the owning product flow. Record relevant checks in the handoff. Rebuild
   the lab so the product connection can be compared again.

Product auditions call the mapped synth directly with an isolated AudioContext
and its default context. They do not simulate runtime scheduling, feature
context, mixing, or continuous scene orchestration. Existing procedural noises
and jitter can vary between auditions; this is not a deterministic A/B renderer.
The independent context is closed on stop, replacement, page hiding, and after
the declared target duration plus one second of tail. Use the product flow for
long-running scene lifecycle verification.

## Owners and records

- Design briefs: `workspace/soundBriefs.js`.
- Agent candidate metadata: `workspace/soundCandidates.js`.
- Catalog / product connection projection: `workspace/soundWorkspace.js` and
  `scanner/soundCatalogScanner.js`.
- Research feedback: `workspace/reviews/*.json`; exclusively appended by
  `host/reviewRepository.mjs`. This research-only file store is outside app
  settings, Chrome storage, and IndexedDB. Browser drafts remain in memory with
  an unsaved-change warning; they are not durable until saving succeeds.
- Build evidence: `browser/soundLabBuild.json` records the source closure and
  its SHA-256 revision. The bundle embeds the same revision. Host reads and
  writes reject stale source revisions rather than labeling old playback as a
  new candidate. Revision changes include UI changes; earlier review records
  remain visible and explicitly marked as earlier builds.
- Hosting: `host/server.mjs`, loopback only; exact Host/Origin checks, a fixed
  static file allowlist, bounded JSON requests, and immutable UUID records.
  Writes use an atomic non-overwriting file link and idempotent request IDs.
  There are no product-application or arbitrary-filesystem endpoints.

## Verification

```powershell
npm.cmd run test:file -- tests/soundLabWorkspace.test.js tests/soundLabReviewHost.test.js tests/soundLabPlayback.test.js tests/soundLabScanner.test.js tests/soundEngine.test.js
npm.cmd run build:sound-lab
```

These check record integrity, source/candidate identity, playback ownership,
failed saves, and catalog/engine contracts. They do not establish acoustic
quality or a named browser QA PASS. Browser work follows the repository's
canonical QA control plane.
