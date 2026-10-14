# Zen Enso Research Workspace

- Status: Active
- Owner: Zen presentation research
- Last validated against code: 2026-09-07
- Path policy: current-only
- Canonical for: independent Enso brush experiments, local review surface and evidence boundaries

## Boundary and owners

This workspace studies quality and cost before any production renderer change.
The user's first visual review rejected E01-A/B. The canonical Enso remains the
quality reference. The research workspace is not a production implementation seam.

| Concern | Owner |
| --- | --- |
| Questions, primary sources, assumptions, negative results | `scripts/dev/zen-enso-research/research/E01.md` |
| Deterministic candidate gesture and painters | `scripts/dev/zen-enso-research/engine/zenEnsoGesture.js`, `zenEnsoPainters.js` |
| Bounded measurement and numerical/pixel evidence | `scripts/dev/zen-enso-research/engine/zenEnsoBenchmark.js` |
| Interactive local review | `scripts/dev/zen-enso-research/app/**` |
| Single-file HTML packaging, no live server | `scripts/dev/zen-enso-research/build.mjs`, package script `build:zen:enso-research` |
| Thin development-only scene adapter | `src/apps/visual-harness/scenes/ZenEnsoResearchScene.jsx` |
| QA identity, DPR and capture selectors | `src/apps/visual-harness/sceneCatalog.js` |
| Browser ownership and evidence envelope | Existing Entropy QA control plane and visual capture owners |
| Generated review and portable results | `reports/zen-enso-research-2026-09-07/**` |

Research may read `src/themes/plugins/zen/presentation/ZenEnsoCanvas.js` to render
the actual baseline. Imports flow from this development workspace to production
code, never from product entrypoints to this workspace. The visual harness adapter
may import the research UI; this explicitly scoped development edge must not be
copied to the dashboard or theme widget registry. No settings or storage owner is
introduced. User reference pixels remain display-only in the local lab.

## Experiment and QA contract

`visual/zen/enso-research` and `visual/zen/enso-research-retina` render the same lab
at 1440×1000, DPR 1 and 2. They execute 8 fixed consecutive seeds × 3 painters,
record new-surface setup, drawing submission and forced RGBA readback separately,
check progressive growth/replay, emit `ZEN_ENSO_RESEARCH_REVIEW`, and capture the
overview, storyboard, daily grid and results. No ad hoc browser runner is allowed.

The baseline retains its own geometry, scale, transparency and COMPLETE form.
It is not an equal-image benchmark. Forced readback is not normal animation or
GPU time. Hardware browser admission does not certify every Canvas2D allocation
uses the GPU. Pixel correctness and named QA PASS do not prove aesthetic quality.
Research records user and visual rejection independently of mechanical checks.

## Next decision

### E02: preserve the canonical stroke

The user authorized continuing with the current drawing's appearance preserved.
`scripts/dev/zen-enso-research/e02` owns a frozen, SHA-256 checked copy of the
pre-E02 renderer, three explicitly generated variants and a comparison UI.
`generateVariants.mjs` is the sole generated-source owner. Generated modules
must never be imported by production; their only added instrumentation is a
readable ink-layer handle and explicit CPU readback-surface option, common to
all comparison implementations. The immutable fixture is a research reference,
not a legacy runtime or fallback path.

`visual/zen/enso-e02` and `visual/zen/enso-e02-retina` have the same 1440×1000
viewport, DPR 1/2. Each times four dates with rotating execution order, checks
both `practice` and `complete` at four stroke stages for two dates (including a
before/before repeat control), checks rewind/replay, and measures one 1850ms
rAF stroke per implementation. During measurement the four comparison canvases
occupy a bounded fixed viewport strip; only one is animated at a time, with no
readback in its frame loop. This does not move OS focus. `ZEN_ENSO_E02_REVIEW`
contains exact alpha differences and timing, without claiming GPU timer data.
The setup and drawing/raster work occur inside the measured first render;
the final forced readback is reported separately. Correctness uses separate
read-friendly CPU surfaces to prevent a changing raster backend from polluting
byte equality. Cold renderer preparation is not shader/driver-cold browser startup.

The baseline's layers, point count, random sequence, placement and alpha are
the preservation target. Candidate A removes per-stamp canvas transforms with
the native ellipse rotation argument. B additionally uses numeric alpha and
hoists repeated bundle noise. C only hoists that pure repeated noise evaluation.
Follow-up candidate D retains the original coordinate transforms and only
replaces RGBA string parsing with fixed black plus numeric alpha, together with
the pure noise hoist. At DPR 1 it initially matched all 16 stages exactly; at
DPR 2, three stages of one date differed by a single alpha level in one pixel.
Explicit float32 rounding did not remove that discrepancy and was discarded.
For D, the appearance-preservation criterion is at most one 8-bit alpha level
in at most 0.01% of the canvas pixels, on both raw ink and composed output.
This is a disclosed quantization allowance, not a claim of universal bit equality.
Before/before and same-renderer replay must still be exact. Raw differences and
exact-stage counts remain in the report, including earlier strict-equality FAILs.
The faster direct-placement candidate B has greater antialias changes and is
not admitted by this D criterion. Pixel differences remain evidence even if a candidate is faster. A successful
research candidate may be applied to the production owner only as its minimal
reviewed source change, with no research flags or generated-module dependency.

D promotion completed on 2026-09-07: the canonical `ZenEnsoCanvas.js` now uses
fixed black plus numeric alpha inside the existing saved transform, and hoists
the pure bundle wobble outside the lane loop. Public exports, worker/scene
callers, static cache ownership and drawing timing remain the same. The actual
production source was compared with the studied D patch, and the ordered stamp
arguments were checked against the frozen baseline across eight dates and both
forms. Detailed evidence and the quantization allowance are recorded in
`scripts/dev/zen-enso-research/research/E02.md` and
`reports/zen-enso-research-2026-09-07/e02-review.md`.

Separate preserving the current drawing's appearance at lower execution cost
from developing a different contact/ink model. A/B results remain negative
evidence. No product adoption follows from lower timing numbers alone. A future
integration needs a named production owner, boot-worker/artifact context review,
recipe versioning, canonical storage contracts if persistence is added, and
measurements of the actual first-frame and playback paths.

### E03: open gestures over the preserved brush

The user authorized expressive research based on the existing Enso, including
different starts, clockwise/counterclockwise travel and intentionally open ends,
with open strokes preferred for boot exploration. `e03/zenEnsoGestures.js` owns
three authored gesture recipes and bounded seeded variation. It modifies the
path before tangent/normal construction and supplies pressure memory, drying,
central contact width and ink consumption to the preserved layered brush.
`e03/generateGestureRenderer.mjs` is the sole research source-generation owner;
it derives from the checked E02 preserved variant, never the mutable working
production source. This is an artistic distance-domain contact approximation,
not a physical brush/fluid simulation. Existing deposition order, bundle count
and incremental growth remain; the static snapshot cache is not used.

The standalone `e03-lab.html` defaults to `practice` (open), with `complete` as
an explicit comparison. Neither boot nor artifact entrypoints adopt E03. The
existing boot worker already defaults to `practice`; E03 broadens the visible
gap, location, direction and pressure expression instead of claiming to fix a
currently closed boot path. Its daily seeds are session-only research inputs.

`visual/zen/enso-e03` and `visual/zen/enso-e03-retina` use 1440×1000 at DPR 1/2.
They capture overview, selected gesture stages, three-date grid and results.
`ZEN_ENSO_E03_REVIEW` contains three-date, rotated-order, uncached 480px first
render timings and stamp counts. Separate 320px CPU surfaces check increasing
ink and exact rewind reproduction across both forms. Pixel readback is reported
separately and is not GPU timing. Node research tests protect finite/bounded
geometry across 64 seeds, deterministic direction and open endpoints, unchanged
canonical stamp arguments, and frame-partition-independent deposition. Results
are mechanical evidence; a visual review remains a separate, provisional judgment.
