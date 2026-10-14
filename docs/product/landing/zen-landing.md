# Zen Landing

- Status: Active
- Owner: public landing app, Zen presentation
- Last validated against code: 2026-10-09
- Path policy: current-only
- Canonical for: public Zen landing journey, build isolation, and presentation ownership

## Purpose

Zen Landing V4 is a short public reading experience for Entropy. Its center is
not an artifact catalog or a reduced dashboard. A visitor reads product-owned
manifesto material while lightweight Zen artifacts change the reading surface,
the rhythm of progress, and the persistent garden around it.

The page has one product job: let a visitor feel that Entropy returns a quiet,
textured interval between impulse and attention, then offer a direct Chrome Web
Store invitation.

## Runtime Shape

The landing is a static multi-page website built separately from the MV3
extension:

```text
src/apps/landing/**
  + src/themes/plugins/zen/api/landing.js
    -> src/themes/plugins/zen/presentation/landing/**
       -> named, pure Zen presentation/model seams
  -> vite.landing.config.js
  -> dist-landing/
```

`vite.config.js` and the CRX manifest graph do not own this website. The landing
build must not become an extension Rollup input, and landing assets must not be
copied into the extension package through the root `public/` directory.

The separate build is an ownership boundary, not a requirement to redraw every
Zen object by hand. Landing adapters may now consume the named shared seams in
this document. They do not acquire the Dashboard runtime owners behind those
seams.

## Owner Map

| Concern | Owner | Contract |
| --- | --- | --- |
| HTML entry, reading composition, copy, CTA, privacy/support pages | `src/apps/landing` | semantic public page with real links |
| raw scroll, mediated time, artifact effect state | `src/apps/landing/experience` | immutable V4 snapshot |
| deterministic Lens text projection | `src/apps/landing/experience/resolveLandingLensTextProjection.js` | fixed-seed projection over pure text/profile utilities; no DOM scanner or settings owner |
| Zen visual interpretation | `src/themes/plugins/zen/presentation/landing` | landing adapters over named shared scenes, geometry, materials, and pure projections |
| non-theme import | `src/themes/plugins/zen/api/landing.js` | narrow landing-only Zen public exit |
| build and output isolation | `vite.landing.config.js` | `dist-landing`, no CRX plugin or root public copy |
| Store identity and destination | `ENTROPY_CWS_EXTENSION_ID`, `VITE_CHROME_STORE_URL` | production build fails unless the URL is a canonical HTTPS Chrome Web Store detail URL whose final ID exactly matches the frozen extension ID |
| build provenance | `vite.landing.config.js`, `entropy-landing-build-info.json` | commit/tree/lockfile/dirty state plus Store/support identity; clean RC rehashes the complete output tree |
| deployment | external hosting owner | repository build does not deploy; release record needs a receipt tied to the attested landing tree digest |

## V4 Composition

The page has three persistent planes.

1. A full-viewport garden stage owns the pond, light, sun path, koi, and the
   bottom-right bonsai garden bed.
2. One fixed-width reading plane owns the manifesto and product explanation.
3. A containerless vertical artifact trace at the left shows which force is
   acting on the reading plane. It adapts the Tools horizon-incision grammar;
   it is not a setting rail or an artifact selector.

Pond and bonsai remain present throughout the entire journey. They must not be
wrapped in cards or introduced as separate content chapters. Bonsai growth is
an authored accumulation from sapling through trunk, scaffold, twig, canopy,
and blossom. It must not use a vertical reveal wipe.

The garden uses one shallow top-view spatial grammar. Water is the primary
scene plane; the moving sun reads as reflected ambient light rather than a
separate landscape sky, and the bonsai bed shares the pond's architectural
datum. A side-view mountain horizon must not be mixed with top-view koi.
Landing koi use canonical appearance, body material, silhouette, and appendage
geometry through `api/landingKoi.js`, while the pond remains a landing-owned
Canvas2D optic layer. The bonsai projects the production Classic2 development
model from a fixed synthetic growth input and renders it through the Sakura
Canvas2D species renderer. Neither becomes a canonical Home entity, roster
member, repository record, lineage snapshot, or persisted model.

## Reading Journey Contract

The canonical semantic phase sequence is:

1. `threshold` (`0.00..0.10`)
2. `manifesto` (`0.10..0.27`)
3. `friction` (`0.27..0.43`)
4. `pause` (`0.43..0.59`)
5. `reflection` (`0.59..0.82`)
6. `invitation` (`0.82..1.00`)

`landingJourneyContract.js` owns exact semantic ranges. Copy, anchor geometry,
and focused tests must derive from this contract rather than duplicating phase
boundaries.

V4 separates two progress axes:

- `scrollProgress` is the visitor's raw position in the natural document.
- `globalProgress` is the mediated garden and reading time.

Outside the Shishi dwell they move continuously together through a contract
projection. During the raw `0.43..0.53` interval, `globalProgress` stays at
`0.43`: water fills during `0.43..0.49`, the bamboo strikes during
`0.49..0.51`, and the scene releases during `0.51..0.53`. After release, the
remaining raw range maps continuously to the remaining global range.

`resolveLandingScrollProgressForGlobalProgress` owns the inverse projection
used to size semantic section anchors. App code must not reconstruct that
mapping.

The controller uses passive `scroll`, `resize`, and pointer listeners. It does
not cancel wheel/touch input, trap focus, or lock the Store invitation. Reduced
motion bypasses the dwell and maps raw progress directly to global progress.

## Artifact Meaning

Artifacts are operators over the same reading stream, not the subjects of
successive feature cards.

- **Shoji / Lens** appears during `friction`. It projects desaturation, expanded
  tracking, and deterministic text interference over the reading plane. The
  object itself is the shared `ZenShojiVisualCore`; the Dashboard widget and
  landing adapter supply their own context around the same paper-and-joined-cube
  presentation. Text projection uses the production text shuffle utility and a
  pure text-rhythm profile, but never mounts the DOM scanning runtime.
- **Shishi-odoshi / Gate** appears during `pause`. Continued natural scroll is
  spent filling, striking, and releasing the gate while semantic time remains
  still. Dashboard and landing use the same stateless Shishi scene and material
  recipe. The landing converts its bounded dwell snapshot into scene pose using
  pure recipe math; it does not mount the Tools simulation, controller, or Gate
  runtime.
- **Furin / Flare** appears once at the start of `reflection`. It is a restrained
  boundary signal that lets urgency residue recede; it is not a repeated reward
  or a chapter-sized hero. The shared stateless Furin scene supplies the real
  glass, striker, washi, and tanzaku grammar. Landing supplies one deterministic
  pose without importing the Dashboard simulation or synth. After explicit
  consent, the app-owned landing audio engine may play its existing one-shot cue.

Artifact colors come from the dependency-free canonical Zen role seam
`zenArtifactColorTokens.js`. Dashboard `artifactColorSystem.js` consumes and
re-exports that same object, so the landing does not need the theme plugin
catalog to share Lens, Gate, and Flare colors. Color is limited to the selected
trace mark, the artifact's material accent, and a faint local scene tint.

Kakejiku is not a canonical artifact and has no V4 chapter or presentation
component. Return Current is also outside this reading journey. Paper,
inscription, and koi remain environmental vocabulary rather than substitute
feature mappings.

The removed Shadow Koi finale also remains outside V4. It may return only after
the real protocol meaning and its necessity to the landing conclusion are
accepted as a separate product decision; it is not an automatic atmospheric
epilogue.

## Content Contract

Public copy takes its philosophical arc and naming from
`docs/product/entropy-manifesto.md`, its product principles and capabilities from
`docs/product/project-introduction.md`, and its concise summary from `README.md`.
`docs/product/prediction-value-learning-model.md` owns prediction and value
learning; `docs/product/entropy-information-theory-model.md` owns entropy levels,
compression and decoding cost. The Draft
`docs/product/attention-relief-loop-hypothesis.md` owns motivational context.
The manifesto's claim map connects the public narrative to these analyses;
model hypotheses are not established effects or new feature promises.

The sequence communicates:

- effortless continuation can leave the work of stopping to the user;
- Entropy returns friction to the external interface;
- visual and interaction friction changes displayed cues and repetition costs,
  with reduced attraction and renewed choice as intended effects;
- consistent changes in experience may change what users expect from that
  environment; this is a product hypothesis, not a required learning outcome;
- the goal is a textured pause, not punishment or moral instruction;
- settings and usage reflection stay local to the device.

The landing must not invent capabilities, metrics, progression rewards, or
remote services that the extension does not own.
The disorder/heat/shield vocabulary can express the manifesto's contrast between
external friction and internal order. Analysis names the relevant level of
uncertainty or representation; the metaphor does not claim neural measurement
or guaranteed recovery. A pause that offers a choice must not imply
that every precommitted protection boundary can be bypassed.

Documentation review (2026-09-20): `src/apps/landing/content/landingCopy.js`
still contains the earlier direct-channel, brain-shield and reward-reduction
wording. Its Korean and English copy need a separate presentation pass against
the manifesto and this contract, especially where lower reward is stated as a
guaranteed result; this documentation change does not update the rendered landing.

## Presentation Boundary

The landing owns composition, timing, input projection, and rendering adapters.
It intentionally shares only these production visual seams:

| Reuse class | Named seam | Landing input and ownership |
| --- | --- | --- |
| ambient and artifact materials | `runtime/environment/zenWorldMaterialPalette.js`, `zenArtifactColorTokens.js` | landing time is projected through the dependency-bounded canonical ivory-to-cedar-to-plum-to-indigo material interpreter without importing the world clock/kernel, Pond runtime, or theme plugin catalog |
| Lens text effect | `textShuffle.js`, `textRhythmProfile.js`, `frictionIntensityBands.js` | fixed namespace seed, canonical pure band vocabulary and synthetic effect progress; no settings read or DOM ownership |
| Shoji | `presentation/artifacts/shoji/ZenShojiVisualCore.jsx` | landing opacity, night depth, and reduced-motion budget |
| Shishi-odoshi | `widgets/tools/presentation/ZenShishiOdoshiScene.jsx`, pure functions in `zenShishiOdoshiRuntimeRecipe.js` | landing dwell/fill/strike snapshot projected into a stateless pose |
| Furin | `widgets/tools/presentation/ZenFurinScene.jsx` | one bounded landing signal pose; Dashboard simulation, particles, and synth stay outside the shared visual seam |
| bonsai | Classic2 development projection, normalized life/growth contracts, Sakura species Canvas2D renderer, garden-bed geometry/material and camera seams | fixed seed `478` and synthetic `0..1` landing growth; render-local asset cache only |
| koi | `src/themes/plugins/zen/api/landingKoi.js` | landing-bounded export of canonical appearance, body material tones, body contour, and appendage profile/geometry for one to three deterministic presentation fish; no roster or pond tuning closure |

The following owners remain forbidden in the landing bundle:

- Dashboard layout, Home workspace, retained Home/Pixi renderer, and complete
  Tools widget components;
- Zustand stores, settings command/transport owners, Chrome storage, IndexedDB,
  storage services, and any persistence side effect;
- model repositories, candidate or lineage persistence, profile generation,
  canonical Home entities, progression, roster, history, or user-derived data;
- workers, worker admission, worker leases, runtime clients, messaging, and
  background/content extension owners;
- broad runtime hooks, controllers, managers, simulations, and Dashboard or
  extension audio/synth owners. The app-owned, gesture-gated one-shot landing
  audio engine remains inside the public app boundary.

Missing or unsuitable visual seams must fail loudly or be extracted as a new
narrow named seam with this document and its guard updated in the same change.
They must not be replaced by a fake fallback or by mounting a broader owner.

`scripts/ci/check-zen-landing-reuse-boundary.mjs` scans every source file under
`src/themes/plugins/zen/presentation/landing/**` and the app-owned Lens
projection adapter. Relative imports that remain inside the presentation
directory are unrestricted. Any import that crosses out of it, and every Lens
utility import, must resolve to the exact file allowlist in the guard; stale
allowlist entries also fail. The guard additionally fixes the exact import and
export inventory of `api/landingKoi.js`, and requires the Zen artifact color
seam to remain dependency-free with an exact public/token inventory. Starting
from the actual `src/apps/landing/main.jsx` entry, it then recursively resolves
the complete repository-local app, presentation, Lens, and CSS side-effect
import closure. Only `react`, `react-dom`, `framer-motion`, and the locally
bundled `@fontsource-variable/noto-sans-kr` package entrypoints are admitted;
Dashboard, runtime, state, storage, repository, and worker owner paths are
rejected at any depth. This makes widening the landing closure an explicit
architecture change instead of an incidental transitive import.

The visual stage is decorative and `aria-hidden`. App-owned DOM retains all
headings, copy, progress semantics, buttons, links, and focus behavior.

## First-Paint Readiness

`index.html` owns one textless dawn boot surface. It must not contain a second
hero or copy truth.

Before the application is revealed:

1. locale is resolved before first paint;
2. React mounts and the experience controller emits its first measured
   snapshot;
3. `LandingApp` dispatches `entropy:landing-layout-ready` after that snapshot
   commits;
4. canonical font readiness and two stable animation frames complete;
5. `main.jsx` atomically marks the root ready and removes the boot surface.

The page uses the shared dashboard typography tokens. Korean uses a locally
bundled, subsetted Noto Sans KR variable face so the public page does not depend
on a host operating system font or a remote font request. Required webfonts
settle behind the textless boot surface, so visible Sunflower/DejaVu swapping is
not part of V4. A boot readiness failure must leave a visible, diagnosable
error rather than silently revealing an incorrect initial scene.

## Interaction and Accessibility

- Scroll is the primary interaction and remains native.
- Pointer movement may supply a short-lived wind impulse, but no gesture is
  required to understand or finish the page.
- Sound starts muted and requires an explicit user gesture.
- The visual timeline is reversible; one-shot audio cues are not.
- Reduced motion preserves the phase order through still authored tableaux and
  removes transient text shuffling and the Shishi dwell.
- The Store invitation remains reachable through normal reading order and the
  keyboard skip link.
- No landing state is written to localStorage, Chrome storage, IndexedDB,
  dashboard stores, or extension messaging.

## Public Web Contract

- `/` owns the interactive journey.
- `/privacy/` owns the public privacy statement.
- `/support/` owns support routing guidance.
- The Chrome Web Store invitation is a real external anchor.
- There is no visitor analytics SDK, account system, or backend API.
- Public copy describes current data handling: settings, usage records and analysis
  results stay on the device and are not automatically sent to external services.
  The installation invitation owns this concise notice. Reflection explains the
  usage feedback; it does not repeat the notice or display a backend-topology seal.
- The privacy page keeps recording choices, purposes, deletion, export sharing,
  encryption scope and website request logs readable without storage-engine or
  internal protocol terminology. Icons come from local browser/cache data; the
  removed remote icon-download exception must not remain in public disclosures.
- `scripts/ci/publicPrivacyDisclosureContract.mjs`, called by CWS preflight,
  checks disclosure coverage. It does not replace the runtime network/CSP guards.
- `landingDebug=1` is a development-only query surface. Production builds
  compile it out and fail if its query marker or `LandingDebugHud` module remains
  in an emitted JavaScript chunk.
- `dist-landing/entropy-landing-build-info.json` identifies source and public
  destinations. A successful build is not deployment evidence.

## Verification

- `npm run check:zen-landing:reuse-boundary`
- `npm run test:file -- tests/landingReadingJourneyContract.test.js tests/landingJourneyExperience.test.js tests/landingExperienceController.test.js tests/landingSemanticSurface.test.jsx`
- `ENTROPY_CWS_EXTENSION_ID=<frozen-store-id> VITE_CHROME_STORE_URL=<matching-real-store-detail-url> VITE_SUPPORT_URL=<public-monitored-route> npm run build:landing`
- confirm `entropy-landing-build-info.json` matches the release commit/tree and
  preserve an external deployment receipt for the attested landing SHA-256
- `git diff --check`

The full extension build is not required for landing-only visual/copy changes.
It is required if a change alters shared extension build, theme, storage, or
runtime contracts outside this bounded seam.
