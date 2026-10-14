/**
 * G15.4 ink ribbon brush.
 *
 * Expands one `inkRibbon` scene command — a centreline with a half-width and
 * an arc length per sample — into the marks a loaded brush actually leaves.
 *
 * The grammar is the product's existing one, from the brake ritual's
 * `InkBrushCanvasRenderer`: bristle lanes offset across the width with a stable
 * and a fine sine wander, ink pooling at the edges, and the stroke drying out
 * along its length. One thing is done differently on purpose.
 *
 * That renderer breaks a stroke up with `destination-out`, erasing down to a
 * background it owns. This executor paints onto a finished composite — sky,
 * garden bed, other branches — so erasing would punch holes straight through
 * them. Instead the ribbon is *built* from longitudinal bands and simply stops
 * laying some of them down as it dries. The white that flies is the scene
 * showing through where no bristle touched, which is what flying white is, and
 * it costs no compositing tricks: the output is opaque polygons, so it stays
 * bakeable when this moves to Pixi.
 */
(function installInkRibbonBrush(scope) {
    'use strict';

    const CONTRACT_ID = 'g15_4_ink_ribbon_brush_v1';

    // Where the ink runs out and the bristles start to separate.
    const DRY_START = 0.42;
    // A stroke narrower than this is a single hair. Banding one produces
    // confetti rather than bristles, so anything this fine stays a solid
    // tapering ribbon.
    const HAIRLINE_HALF_WIDTH = 2.2;
    // Bands nearer the centreline than this never break. A drying brush frays
    // at its edges; it does not sever the branch it is drawing, and a gap in
    // the spine reads as damage rather than as texture.
    const PROTECTED_SPINE = 0.42;
    // Ceiling on how often an outer band lifts, at the driest point of the
    // driest stroke.
    const MAXIMUM_DROPOUT = 0.5;
    // Target spacing for the frames the bands are built on. Sparse centrelines
    // turn bands into faceted blocks and gaps into missing chunks.
    const FRAME_SPACING = 3.4;
    // Adjacent bands are grown into each other by this much before filling.
    // Two opaque polygons that merely share an edge do not join on a canvas:
    // each antialiases its own boundary at part coverage, and the pair leaves a
    // pale seam down the stroke. The overlap is invisible — the bands are
    // opaque — and it is what makes them read as one mark.
    const BAND_BLEED = 0.4;
    // A hairline cannot fray, so it breaks. Kept well under the banded ceiling:
    // a twig that vanishes reads as a gap in the tree, not as dry brush.
    const HAIRLINE_DROPOUT = 0.34;
    // The last stretch of any stroke never lifts. Dryness climbs toward the
    // tip by design — the bristles are furthest from the ink source there —
    // but the tip is also where a twig hands off to whatever is rigidly
    // attached beyond it: a joint, a terminal cluster. A brush always touches
    // back down to finish a stroke; losing contact at the exact point
    // something else is anchored reads as the tree breaking, not as texture.
    const PROTECTED_TIP = 0.05;
    // Heavy strokes soak into the paper past their own edge. Twigs do not —
    // there is not enough ink on the brush — so the halo is gated on girth.
    const BLEED_MINIMUM_HALF_WIDTH = 3.2;
    // Flying white belongs to a thin, fast, half-dry stroke. A trunk is the
    // opposite — the brush is fully loaded and moving slowly — and it must not
    // break up.
    //
    // `PROTECTED_SPINE` alone cannot express that: it protects a *proportion*
    // of the width, while the damage scales with the *absolute* width. On a
    // twig the outermost band is a fraction of a pixel and a lifted run reads
    // as texture; on a trunk that same band is several pixels deep, so the run
    // becomes a clean-edged rectangular bite out of the silhouette and reads as
    // the trunk being chipped through. So dropout fades out as the stroke
    // thickens, and heavy wood simply does not break.
    //
    // Device pixels, matching every other girth threshold in this module
    // (`HAIRLINE_HALF_WIDTH`, `BLEED_MINIMUM_HALF_WIDTH`, `bandCountFor`).
    const DROPOUT_FULL_HALF_WIDTH = 4;
    const DROPOUT_SILENT_HALF_WIDTH = 11;
    const BLEED_RINGS = Object.freeze([
        { spread: 0.34, alpha: 0.1 },
        { spread: 0.17, alpha: 0.13 },
    ]);

    /**
     * How each style lays the stroke down.
     *
     * `ink` is a drying brush: bristles separate, the edge pools, the paper
     * soaks. `natural` is a loaded one on a round branch — nothing breaks up,
     * nothing soaks, and the cross-section darkens toward both edges so the
     * limb reads as round. The darkening is symmetric on purpose: the plan is
     * light-direction independent, and a baked-in highlight side was exactly
     * what made the old wood look moulded.
     */
    const BRUSH_STYLES = Object.freeze({
        ink: Object.freeze({
            dropout: 1,
            bleed: true,
            bandScale: 1,
            edgePooling: -0.05,
            centreLift: 0.028,
            grain: 1,
        }),
        natural: Object.freeze({
            dropout: 0,
            bleed: false,
            // More bands across the width, so a symmetric falloff reads as a
            // curved surface rather than as steps.
            bandScale: 1.5,
            edgePooling: -0.1,
            centreLift: 0.055,
            grain: 0.45,
        }),
    });

    function resolveBrushStyle(style) {
        return BRUSH_STYLES[style] || BRUSH_STYLES.ink;
    }

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const clamp01 = (value) => clamp(Number(value) || 0, 0, 1);
    const lerp = (a, b, t) => a + ((b - a) * t);

    function hashUnit(seed) {
        let hash = 0x811c9dc5;
        const source = String(seed);
        for (let index = 0; index < source.length; index += 1) {
            hash ^= source.charCodeAt(index);
            hash = Math.imul(hash, 0x01000193);
        }
        return ((hash >>> 0) % 100000) / 100000;
    }

    function parseInk(color) {
        const raw = typeof color === 'string' ? color.trim() : '';
        if (raw.startsWith('#')) {
            const body = raw.length === 4
                ? raw.slice(1).split('').map((c) => c + c).join('')
                : raw.slice(1);
            if (body.length === 6) {
                return {
                    r: parseInt(body.slice(0, 2), 16),
                    g: parseInt(body.slice(2, 4), 16),
                    b: parseInt(body.slice(4, 6), 16),
                };
            }
        }
        const channels = raw.match(/[\d.]+/gu);
        if (channels && channels.length >= 3) {
            return {
                r: Number(channels[0]) || 0,
                g: Number(channels[1]) || 0,
                b: Number(channels[2]) || 0,
            };
        }
        return { r: 45, g: 43, b: 39 };
    }

    function shiftInkAlpha(ink, amount, alpha) {
        const shift = amount * 255;
        return `rgba(${
            Math.round(clamp(ink.r + shift, 0, 255))},${
            Math.round(clamp(ink.g + shift, 0, 255))},${
            Math.round(clamp(ink.b + shift, 0, 255))},${alpha})`;
    }

    /**
     * The wet halo a loaded stroke leaves in the paper around itself.
     *
     * Nested rings stand in for a falloff on a flat-fill command stream, the
     * same way the nebari's ground contact does. It is widest at the base,
     * where the brush was carrying the most ink.
     */
    function paintBleed(ctx, frames, ink, dryness) {
        BLEED_RINGS.forEach((ring) => {
            ctx.beginPath();
            const outward = (frame, sign) => {
                const soak = 1 + (ring.spread * (1 - (frame.t * 0.65)) * (1 - (dryness * 0.5)));
                const offset = frame.halfWidth * soak * sign;
                return {
                    x: frame.x + (frame.nx * offset),
                    y: frame.y + (frame.ny * offset),
                };
            };
            frames.forEach((frame, index) => {
                const point = outward(frame, 1);
                if (index === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
            });
            for (let index = frames.length - 1; index >= 0; index -= 1) {
                const point = outward(frames[index], -1);
                ctx.lineTo(point.x, point.y);
            }
            ctx.closePath();
            ctx.fillStyle = shiftInkAlpha(ink, 0.03, ring.alpha);
            ctx.fill();
        });
    }

    function shiftInk(ink, amount) {
        const shift = amount * 255;
        return `rgb(${
            Math.round(clamp(ink.r + shift, 0, 255))},${
            Math.round(clamp(ink.g + shift, 0, 255))},${
            Math.round(clamp(ink.b + shift, 0, 255))})`;
    }

    /**
     * Per-sample frame: centre, unit normal, half width, normalized arc.
     */
    /**
     * Resamples the centreline to an even spacing before framing it.
     *
     * Wood surfaces arrive with however many samples their growth produced,
     * which can be a handful across a long branch. Bands built straight onto
     * that read as facets, and a single dropped sample becomes a chunk-sized
     * hole rather than a bristle gap.
     */
    function resample(points) {
        const dense = [points[0]];
        for (let index = 1; index < points.length; index += 1) {
            const previous = points[index - 1];
            const current = points[index];
            const span = Math.hypot(current.x - previous.x, current.y - previous.y);
            const steps = Math.max(1, Math.ceil(span / FRAME_SPACING));
            for (let step = 1; step <= steps; step += 1) {
                const ratio = step / steps;
                dense.push({
                    x: lerp(previous.x, current.x, ratio),
                    y: lerp(previous.y, current.y, ratio),
                    w: lerp(Number(previous.w) || 0, Number(current.w) || 0, ratio),
                });
            }
        }
        return dense;
    }

    function buildFrames(rawPoints) {
        const points = resample(rawPoints);
        const count = points.length;
        const frames = [];
        let arc = 0;
        for (let index = 0; index < count; index += 1) {
            const current = points[index];
            const before = points[Math.max(0, index - 1)];
            const after = points[Math.min(count - 1, index + 1)];
            const dx = after.x - before.x;
            const dy = after.y - before.y;
            const magnitude = Math.max(1e-6, Math.hypot(dx, dy));
            if (index > 0) {
                arc += Math.hypot(current.x - before.x, current.y - before.y);
            }
            frames.push({
                x: current.x,
                y: current.y,
                nx: -dy / magnitude,
                ny: dx / magnitude,
                halfWidth: Math.max(0.18, Number(current.w) || 0.18),
                arc,
            });
        }
        const total = Math.max(1e-6, frames[frames.length - 1].arc);
        frames.forEach((frame) => {
            frame.t = clamp01(frame.arc / total);
        });
        return frames;
    }

    /**
     * Lateral offset of one bristle lane, in half-width units.
     *
     * Two sine terms, one slow and one fine, keep a lane from reading as a
     * ruled line without ever leaving the stroke.
     */
    function laneOffset(frame, lane, seed, laneIndex) {
        const s = frame.arc;
        const stable = Math.sin((s * 0.095) + (seed * 0.37) + (laneIndex * 1.73));
        const fine = Math.sin((s * 0.23) + (seed * 0.11) + (laneIndex * 0.83));
        return lane + ((stable * 0.05) + (fine * 0.022));
    }

    function bandCountFor(maximumHalfWidth, bandScale = 1) {
        const base = (() => {
            if (maximumHalfWidth >= 7) return 6;
            if (maximumHalfWidth >= 3.6) return 5;
            if (maximumHalfWidth >= 2) return 4;
            return 3;
        })();
        return Math.max(3, Math.round(base * bandScale));
    }

    /**
     * Emits one band as runs of contiguous present segments.
     *
     * A band that dries out is not thinner — it is interrupted. Splitting the
     * run at each gap is what leaves paper showing between bristles.
     */
    function paintBand(ctx, frames, {
        band,
        boundaries,
        seed,
        dryness,
        fillStyle,
        centreness,
    }) {
        const gapPhase = hashUnit(`${seed}|gap|${band}`) * Math.PI * 2;
        let run = [];
        const flush = () => {
            if (run.length < 2) {
                run = [];
                return;
            }
            ctx.beginPath();
            ctx.moveTo(run[0].outer.x, run[0].outer.y);
            for (let index = 1; index < run.length; index += 1) {
                ctx.lineTo(run[index].outer.x, run[index].outer.y);
            }
            for (let index = run.length - 1; index >= 0; index -= 1) {
                ctx.lineTo(run[index].inner.x, run[index].inner.y);
            }
            ctx.closePath();
            ctx.fillStyle = fillStyle;
            ctx.fill();
            run = [];
        };

        frames.forEach((frame, index) => {
            const dryProgress = clamp01((frame.t - DRY_START) / (1 - DRY_START));
            // Outer bands lose contact first: that is where the brush lifts.
            // Inside the protected spine nothing lifts at all.
            const edgeBias = 1 - centreness;
            const exposure = clamp01((edgeBias - PROTECTED_SPINE) / (1 - PROTECTED_SPINE));
            const tipGuard = frame.t > 1 - PROTECTED_TIP ? 0 : 1;
            const lift = dryProgress * dryness * exposure * MAXIMUM_DROPOUT * tipGuard;
            // A bristle that leaves the paper stays off it for a while. Rolling
            // each sample independently bites square notches out of the edge;
            // two slow waves instead lift the band for a run at a time, which
            // is the long thin gap a dry brush actually leaves.
            if (lift > 0.01) {
                const contact = (Math.sin((frame.arc * 0.085) + gapPhase) * 0.62)
                    + (Math.sin((frame.arc * 0.031) + (gapPhase * 1.73)) * 0.38);
                if (contact > 1 - (2 * lift)) {
                    flush();
                    return;
                }
            }
            const offsets = boundaries[index];
            const innerOffset = offsets[band] - BAND_BLEED;
            const outerOffset = offsets[band + 1] + BAND_BLEED;
            run.push({
                inner: {
                    x: frame.x + (frame.nx * innerOffset),
                    y: frame.y + (frame.ny * innerOffset),
                },
                outer: {
                    x: frame.x + (frame.nx * outerOffset),
                    y: frame.y + (frame.ny * outerOffset),
                },
            });
        });
        flush();
    }

    /**
     * A stroke too fine to band still dries.
     *
     * It cannot fray — there is only one hair — so it breaks instead, lifting
     * off the paper for a run and coming back down. This is where most of a
     * painting's dry-brush character lives, since twigs are where the brush has
     * least ink left.
     */
    function paintHairline(ctx, frames, { seed, dryness, fillStyle }) {
        const gapPhase = hashUnit(`${seed}|hair`) * Math.PI * 2;
        let run = [];
        const flush = () => {
            if (run.length < 2) {
                run = [];
                return;
            }
            ctx.beginPath();
            ctx.moveTo(run[0].left.x, run[0].left.y);
            for (let index = 1; index < run.length; index += 1) {
                ctx.lineTo(run[index].left.x, run[index].left.y);
            }
            for (let index = run.length - 1; index >= 0; index -= 1) {
                ctx.lineTo(run[index].right.x, run[index].right.y);
            }
            ctx.closePath();
            ctx.fillStyle = fillStyle;
            ctx.fill();
            run = [];
        };
        frames.forEach((frame) => {
            const dryProgress = clamp01((frame.t - DRY_START) / (1 - DRY_START));
            const tipGuard = frame.t > 1 - PROTECTED_TIP ? 0 : 1;
            const lift = dryProgress * dryness * HAIRLINE_DROPOUT * tipGuard;
            if (lift > 0.01) {
                const contact = (Math.sin((frame.arc * 0.13) + gapPhase) * 0.6)
                    + (Math.sin((frame.arc * 0.048) + (gapPhase * 1.51)) * 0.4);
                if (contact > 1 - (2 * lift)) {
                    flush();
                    return;
                }
            }
            const half = frame.halfWidth + BAND_BLEED * 0.5;
            run.push({
                left: {
                    x: frame.x + (frame.nx * half),
                    y: frame.y + (frame.ny * half),
                },
                right: {
                    x: frame.x - (frame.nx * half),
                    y: frame.y - (frame.ny * half),
                },
            });
        });
        flush();
    }

    /**
     * Paints one ink ribbon. `command.fill` has already been through the
     * scene's light, so every tone here is derived from it.
     */
    function paintInkRibbon(ctx, command, style) {
        const points = command.points;
        if (!Array.isArray(points) || points.length < 2) return;
        const frames = buildFrames(points);
        const ink = parseInk(command.fill);
        const headInk = command.headFill ? parseInk(command.headFill) : ink;
        const headBlendFraction = clamp(
            Number(command.headBlendFraction) || 0.32,
            0.08,
            0.46,
        );
        const seed = Number(command.seed) || 1;
        const dryness = clamp01(command.dryness ?? 0.4);
        const tipShift = Number.isFinite(Number(command.tipShift))
            ? Number(command.tipShift)
            : 0;
        const maximumHalfWidth = frames.reduce(
            (largest, frame) => Math.max(largest, frame.halfWidth),
            0,
        );
        const seedUnit = hashUnit(`${seed}|ribbon`) * 100;
        const brush = resolveBrushStyle(style);
        const girthGate = 1 - clamp01(
            (maximumHalfWidth - DROPOUT_FULL_HALF_WIDTH)
            / (DROPOUT_SILENT_HALF_WIDTH - DROPOUT_FULL_HALF_WIDTH),
        );
        const effectiveDryness = dryness * brush.dropout * girthGate;

        if (maximumHalfWidth < HAIRLINE_HALF_WIDTH) {
            // Too fine to band. One tapering hair, slightly diluted.
            paintHairline(ctx, frames, {
                seed: seedUnit,
                dryness: effectiveDryness,
                fillStyle: shiftInk(ink, (0.035 * dryness) + (tipShift * 0.5)),
            });
            return;
        }

        if (brush.bleed && maximumHalfWidth >= BLEED_MINIMUM_HALF_WIDTH) {
            paintBleed(ctx, frames, ink, dryness);
        }

        const bands = bandCountFor(maximumHalfWidth, brush.bandScale);

        // Lane boundaries are resolved once per frame and shared by the bands
        // on either side of them. Wandering each band's two edges independently
        // leaves them disagreeing about where the boundary is, which shows up
        // as a dither of slivers and overlaps down the whole stroke.
        const boundaries = frames.map((frame) => {
            const offsets = [];
            for (let index = 0; index <= bands; index += 1) {
                const lane = -1 + ((index / bands) * 2);
                offsets.push(laneOffset(frame, lane, seedUnit, index) * frame.halfWidth);
            }
            return offsets;
        });

        // 1 for a twig, up to ~1.9 for the trunk.
        const poolingSpread = 1 + (0.9 * clamp01(maximumHalfWidth / 11));
        const head = frames[0];
        const tail = frames[frames.length - 1];
        const straightLine = Math.hypot(tail.x - head.x, tail.y - head.y) > 0.5;

        for (let band = 0; band < bands; band += 1) {
            const inner = -1 + ((band / bands) * 2);
            const outer = -1 + (((band + 1) / bands) * 2);
            const centreness = 1 - Math.abs((inner + outer) * 0.5);
            // Ink pools at the edges of a wet stroke and thins in the middle,
            // and the wider the stroke the further apart those two get. On a
            // trunk this is what opens the middle up so the mark reads as a
            // brushed form rather than a filled shape.
            const pooling = lerp(brush.edgePooling, brush.centreLift, centreness)
                * poolingSpread;
            const grainJitter = (hashUnit(`${seed}|band|${band}`) - 0.5)
                * (0.035 + (0.05 * (poolingSpread - 1)))
                * brush.grain;
            const baseShift = pooling + grainJitter;
            // Value runs along the stroke rather than sitting flat across it:
            // the base is loaded and dark, and the stroke lightens as it thins
            // and dries. Without this a thick trunk is one uniform slab.
            const endShift = baseShift + tipShift + (0.06 * dryness);
            let fillStyle;
            if (straightLine) {
                fillStyle = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);
                fillStyle.addColorStop(0, shiftInk(headInk, baseShift));
                if (command.headFill) {
                    fillStyle.addColorStop(
                        headBlendFraction,
                        shiftInk(ink, lerp(baseShift, endShift, headBlendFraction * 0.42)),
                    );
                }
                fillStyle.addColorStop(0.5, shiftInk(ink, lerp(baseShift, endShift, 0.42)));
                fillStyle.addColorStop(1, shiftInk(ink, endShift));
            } else {
                fillStyle = shiftInk(ink, baseShift);
            }
            paintBand(ctx, frames, {
                band,
                boundaries,
                seed: seedUnit,
                dryness: effectiveDryness,
                centreness,
                fillStyle,
            });
        }
    }

    /**
     * A pooled wash: pigment spread into wet paper, with no edge of its own.
     *
     * Polygons cannot express this. A flat-filled shape at low alpha still has
     * a crisp boundary, and at canopy scale that reads as a cut-out blob rather
     * than as a mass the flowers sit on. A radial falloff is the whole point of
     * the mark, so it gets its own command instead of being approximated.
     */
    function paintInkWash(ctx, command, washScale = 1) {
        const radiusX = Number(command.rx);
        const radiusY = Number(command.ry);
        if (!(radiusX > 0) || !(radiusY > 0)) return;
        const ink = parseInk(command.fill);
        const alpha = clamp01((command.alpha ?? 0.12) * washScale);
        if (alpha <= 0.002) return;
        ctx.translate(Number(command.x) || 0, Number(command.y) || 0);
        ctx.scale(1, radiusY / radiusX);
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radiusX);
        gradient.addColorStop(0, shiftInkAlpha(ink, 0, alpha));
        gradient.addColorStop(0.52, shiftInkAlpha(ink, 0, alpha * 0.66));
        gradient.addColorStop(1, shiftInkAlpha(ink, 0, 0));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, radiusX, 0, Math.PI * 2);
        ctx.fill();
    }

    scope.ZenBonsaiInkRibbonBrush = Object.freeze({
        CONTRACT_ID,
        DRY_START,
        paintInkRibbon,
        paintInkWash,
    });
}(globalThis));
