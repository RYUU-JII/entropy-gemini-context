/**
 * G15.4 Zen Bonsai Developmental Scheduler · Nebari (根張り) Presentation Module
 *
 * Deterministic surface roots: articulated buttresses radiating on the planting
 * ground plane, root-valley moss, and the contact darkening that seats the tree
 * in its soil. The basal flare itself belongs to the trunk wood ribbon; this
 * module must never cover that ribbon with a second correction surface.
 *
 * Two contracts matter here.
 *
 * 1. The ground plane is supplied by whoever owns the planting surface. Home
 *    plants into the garden bed, the lab plants into a pot; this module never
 *    assumes a pot exists. It receives one scene-local `groundPlane`
 *    ({ center, halfWidth, frontDepth, rearDepth, drawSoil }) and lays roots on
 *    it. `potGeometry` remains accepted as the legacy pot-derived shorthand.
 *
 * 2. Roots have depth. Rear roots belong behind the trunk and front/lateral
 *    roots emerge from behind it before their exposed distal runs come forward,
 *    so the output is split into `backCommands` and `frontCommands` and the
 *    scene builder brackets the wood with them.
 */
(function installNebariPresentation(scope) {
    'use strict';

    const CONTRACT_ID = 'g15_4_nebari_presentation_v3';

    // Neutral ink values, matching the wood scale. The scene builder passes the
    // trunk's projected fills to the root buttresses; these only stand in when
    // it cannot. Like the wood, nothing here encodes a time of day — the runtime
    // tint owns that.
    const NEBARI_PALETTE = Object.freeze({
        barkBody: '#2B2926',
        barkOutline: '#1E1C19',
        barkHighlight: '#6E695E',
        barkShadow: '#1E1C19',
        shadowBand: 'rgba(20, 19, 17, 0.18)',
        aoBand: 'rgba(16, 15, 13, 0.24)',
        contactShadow: 'rgba(18, 17, 15, 0.12)',
        contactCore: 'rgba(14, 13, 11, 0.16)',
    });

    const MOSS_PALETTES = Object.freeze({
        thriving: Object.freeze(['#4C5940', '#5C6B4C', '#3C4733', '#697A55', '#414C37']),
        steady: Object.freeze(['#4A5341', '#57603D', '#3A4232', '#636B4C', '#414937']),
        strained: Object.freeze(['#54543C', '#5D5A41', '#42422F', '#67623F', '#484634']),
        withered: Object.freeze(['#4A473F', '#524D45', '#3A3730', '#5B5549', '#403D36']),
    });

    // Moss recedes as the tree loses health; the roots themselves do not move.
    const MOSS_VITALITY_LOAD = Object.freeze({
        thriving: 1,
        steady: 0.76,
        strained: 0.42,
        withered: 0.18,
    });

    const SOIL_PALETTE = Object.freeze(['#33241b', '#241a13', '#402e23', '#1c130d']);

    /**
     * Root azimuths, measured with 0 pointing at the viewer and +x to the right.
     * Bonsai convention: the two strongest roots run hard left and hard right,
     * quarter-front roots fill the gaps, the rear pair only has to break the
     * silhouette, and nothing points straight at the viewer. Ordered by
     * structural priority so a young tree simply shows fewer of them.
     */
    const ROOT_SLOTS = Object.freeze([
        Object.freeze({ id: 'left_main', azimuth: -0.5 * Math.PI, weight: 1, reach: 1 }),
        Object.freeze({ id: 'right_main', azimuth: 0.5 * Math.PI, weight: 0.98, reach: 0.98 }),
        Object.freeze({ id: 'right_front', azimuth: 0.31 * Math.PI, weight: 0.72, reach: 0.6 }),
        Object.freeze({ id: 'left_front', azimuth: -0.29 * Math.PI, weight: 0.68, reach: 0.56 }),
        Object.freeze({ id: 'left_rear', azimuth: -0.72 * Math.PI, weight: 0.58, reach: 0.54 }),
        Object.freeze({ id: 'right_rear', azimuth: 0.74 * Math.PI, weight: 0.54, reach: 0.5 }),
        Object.freeze({ id: 'front_filler', azimuth: 0.11 * Math.PI, weight: 0.4, reach: 0.34 }),
    ]);

    const MINIMUM_ROOT_COUNT = 3;

    function hashUnit(seed) {
        let hash = 0x811c9dc5;
        const str = String(seed);
        for (let i = 0; i < str.length; i += 1) {
            hash ^= str.charCodeAt(i);
            hash = Math.imul(hash, 0x01000193);
        }
        return ((hash >>> 0) % 10000) / 10000;
    }

    function rounded(value, decimals = 2) {
        const factor = 10 ** decimals;
        return Math.round(Number(value) * factor) / factor;
    }

    function clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }

    function clamp01(value) {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? clamp(numeric, 0, 1) : 0;
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function point(x, y) {
        return { x: rounded(x), y: rounded(y) };
    }

    function cubicBezierPoint(p0, p1, p2, p3, t) {
        const mt = 1 - t;
        const mt2 = mt * mt;
        const mt3 = mt2 * mt;
        const t2 = t * t;
        const t3 = t2 * t;
        return {
            x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
            y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
        };
    }

    function cubicBezierTangent(p0, p1, p2, p3, t) {
        const mt = 1 - t;
        const mt2 = mt * mt;
        const t2 = t * t;
        return {
            x: 3 * mt2 * (p1.x - p0.x) + 6 * mt * t * (p2.x - p1.x) + 3 * t2 * (p3.x - p2.x),
            y: 3 * mt2 * (p1.y - p0.y) + 6 * mt * t * (p2.y - p1.y) + 3 * t2 * (p3.y - p2.y),
        };
    }

    /**
     * Normalizes the planting surface into one scene-local ground plane.
     *
     * `frontDepth` / `rearDepth` are how far the visible soil runs toward and
     * away from the viewer at the trunk. They are what turns a flat fan of
     * spokes into a foreshortened radial root system.
     */
    function resolveGroundPlane({ groundPlane, potGeometry, trunkBase }) {
        if (groundPlane && typeof groundPlane === 'object') {
            const center = groundPlane.center || trunkBase;
            const soilY = Number(center.y) || 0;
            // Roots grow from the trunk, not from the planting point. The camera
            // may shift the tree sideways for composition, so the surface owner's
            // centre supplies the soil line and the reach budget while the trunk
            // itself supplies where the flare stands.
            const trunkX = Number.isFinite(Number(trunkBase?.x))
                ? Number(trunkBase.x)
                : (Number(center.x) || 0);
            const drift = Math.abs(trunkX - (Number(center.x) || 0));
            const halfWidth = Math.max(
                6,
                (Number(groundPlane.halfWidth) || 0) - drift,
            );
            return {
                center: { x: trunkX, y: soilY },
                halfWidth,
                frontDepth: Math.max(2, Number(groundPlane.frontDepth) || halfWidth * 0.34),
                rearDepth: Math.max(1.5, Number(groundPlane.rearDepth) || halfWidth * 0.24),
                drawSoil: groundPlane.drawSoil === true,
            };
        }
        // Legacy pot shorthand: the soil ellipse of a lab pot.
        const potWidth = potGeometry?.width || 180;
        const potHeight = potGeometry?.height || 55;
        const base = potGeometry?.base || trunkBase;
        const soilRy = potHeight * 0.22;
        return {
            center: { x: Number(base.x) || 0, y: (Number(base.y) || 0) + potHeight * 0.08 },
            halfWidth: potWidth * 0.44,
            frontDepth: soilRy * 1.05,
            rearDepth: soilRy * 0.8,
            drawSoil: true,
        };
    }

    function buildRootRibbon({
        slotSeed,
        start,
        end,
        control1,
        control2,
        startWidth,
        endWidth,
        sampleCount,
    }) {
        const leftPoints = [];
        const rightPoints = [];
        const centerPoints = [];
        for (let step = 0; step <= sampleCount; step += 1) {
            const t = step / sampleCount;
            const at = cubicBezierPoint(start, control1, control2, end, t);
            const tangent = cubicBezierTangent(start, control1, control2, end, t);
            const mag = Math.max(0.001, Math.hypot(tangent.x, tangent.y));
            const nx = -tangent.y / mag;
            const ny = tangent.x / mag;

            // A buttress is thickest where it leaves the trunk and keeps a
            // slight belly before it runs out into the soil.
            const taper = (1 - t) ** 1.15;
            const belly = Math.sin(Math.PI * t) ** 1.4;
            const width = Math.max(
                endWidth,
                startWidth * taper + endWidth * t + startWidth * belly * 0.16,
            );
            const roughness = (hashUnit(`${slotSeed}|r|${step}`) - 0.5) * width * 0.14;
            const lw = width * 0.52 + roughness;
            const rw = width * 0.48 - roughness;

            leftPoints.push(point(at.x + nx * lw, at.y + ny * lw));
            rightPoints.push(point(at.x - nx * rw, at.y - ny * rw));
            centerPoints.push({
                x: at.x, y: at.y, width, t, nx, ny,
            });
        }
        return { leftPoints, rightPoints, centerPoints };
    }

    function expandedPolygon(centerPoints, leftPoints, rightPoints, expansion) {
        const left = centerPoints.map((cp, index) => point(
            leftPoints[index].x + cp.nx * expansion,
            leftPoints[index].y + cp.ny * expansion,
        ));
        const right = centerPoints.map((cp, index) => point(
            rightPoints[index].x - cp.nx * expansion,
            rightPoints[index].y - cp.ny * expansion,
        ));
        return [...left, ...right.reverse()];
    }

    /**
     * Paint one continuous section of a buttress.
     *
     * Front roots are deliberately split with an overlap. Their proximal
     * section is painted before the trunk and disappears beneath its basal
     * flare; only the section that has travelled far enough to leave the trunk
     * silhouette is painted in front. `bodyLead` lets the body begin one frame
     * behind its outline so the exposed section has no transverse outline cap.
     */
    function appendRootSection(target, {
        centerPoints,
        leftPoints,
        rightPoints,
        startIndex,
        endIndex,
        bodyLead = 0,
        startWidth,
        outlineFill,
        bodyFill,
    }) {
        const start = clamp(Math.round(startIndex), 0, centerPoints.length - 2);
        const end = clamp(Math.round(endIndex), start + 1, centerPoints.length - 1);
        const centers = centerPoints.slice(start, end + 1);
        const left = leftPoints.slice(start, end + 1);
        const right = rightPoints.slice(start, end + 1);
        const bodyStart = Math.max(0, start - Math.max(0, Math.round(bodyLead)));
        const bodyLeft = leftPoints.slice(bodyStart, end + 1);
        const bodyRight = rightPoints.slice(bodyStart, end + 1);

        target.push({
            type: 'polygon',
            points: centers
                .map((cp, index) => point(
                    right[index].x,
                    right[index].y + Math.max(0.8, cp.width * 0.16),
                ))
                .concat(right.slice().reverse()),
            fill: NEBARI_PALETTE.contactShadow,
        });
        target.push({
            type: 'polygon',
            points: expandedPolygon(
                centers,
                left,
                right,
                Math.max(0.45, startWidth * 0.06),
            ),
            fill: outlineFill,
        });
        target.push({
            type: 'polygon',
            points: [...bodyLeft, ...bodyRight.slice().reverse()],
            fill: bodyFill,
        });

        const shadowOuter = centers.map((cp) => point(
            cp.x + cp.nx * cp.width * 0.2,
            cp.y + cp.ny * cp.width * 0.2,
        ));
        const shadowInner = centers.slice().reverse().map((cp) => point(
            cp.x + cp.nx * cp.width * 0.52,
            cp.y + cp.ny * cp.width * 0.52,
        ));
        target.push({
            type: 'polygon',
            points: [...shadowOuter, ...shadowInner],
            fill: NEBARI_PALETTE.shadowBand,
        });

        if (startWidth >= 3.4 && centers.length >= 4) {
            [-0.2, 0.24].forEach((offsetRatio, grainIndex) => {
                target.push({
                    type: 'line',
                    points: centers.slice(1, -1).map((cp) => point(
                        cp.x + cp.nx * cp.width * offsetRatio,
                        cp.y + cp.ny * cp.width * offsetRatio,
                    )),
                    stroke: grainIndex === 0
                        ? NEBARI_PALETTE.barkHighlight
                        : NEBARI_PALETTE.barkShadow,
                    lineWidth: 0.8,
                });
            });
        }
    }

    /**
     * Builds the complete Nebari presentation.
     */
    function buildNebariPresentation({
        trunkBase = { x: 450, y: 720 },
        trunkWidth = 24,
        seed = 150031,
        groundPlane = null,
        potGeometry = null,
        growth = 1.0,
        vitality = 'steady',
        trunkLean = 0,
        trunkFill = null,
        trunkOutlineFill = null,
        options = {},
    } = {}) {
        const growthNorm = clamp01(growth);
        const ground = resolveGroundPlane({ groundPlane, potGeometry, trunkBase });
        const mossPalette = MOSS_PALETTES[vitality] || MOSS_PALETTES.steady;
        const mossLoad = MOSS_VITALITY_LOAD[vitality] ?? MOSS_VITALITY_LOAD.steady;
        const bodyFill = trunkFill || NEBARI_PALETTE.barkBody;
        const outlineFill = trunkOutlineFill || NEBARI_PALETTE.barkOutline;

        const effectiveTrunkWidth = Math.max(4, Number(trunkWidth) || 0);
        const trunkHalf = effectiveTrunkWidth * 0.5;

        // Nebari spread is read against the trunk, not against the container.
        // A mature flare runs roughly three trunk-half-widths out; the planting
        // surface only ever clips that ambition.
        const reachX = Math.min(
            ground.halfWidth * 0.9,
            trunkHalf * lerp(1.6, 3.4, growthNorm),
        );
        const frontDepth = Math.min(ground.frontDepth, reachX * 0.42);
        const rearDepth = Math.min(ground.rearDepth, reachX * 0.3);
        const collarRise = clamp(
            effectiveTrunkWidth * lerp(0.26, 0.44, growthNorm),
            3,
            (frontDepth + rearDepth) * 1.4,
        );
        const rootBaseWidth = rounded(reachX * 2);
        const lean = clamp(Number(trunkLean) || 0, -1.4, 1.4);

        /**
         * Centre of the flare at height parameter `t` (0 at the collar top,
         * 1 at the soil). The collar leaves the soil upright and only picks up
         * the trunk's lean as it rises, so the two silhouettes meet without a
         * step and the roots still enter the ground vertically.
         */
        const collarCenterX = (t) => ground.center.x + lean * collarRise * ((1 - t) ** 1.35);
        const collarCenterY = (t) => ground.center.y - collarRise * (1 - t);

        const activeSlotCount = clamp(
            Math.round(lerp(MINIMUM_ROOT_COUNT, ROOT_SLOTS.length, growthNorm)),
            MINIMUM_ROOT_COUNT,
            ROOT_SLOTS.length,
        );
        const activeSlots = ROOT_SLOTS.slice(0, activeSlotCount);

        const backCommands = [];
        const frontCommands = [];
        const frontRootCommands = [];
        const rootSpecs = [];

        // 1. Ground contact. Nested low-alpha rings stand in for a radial
        //    falloff on a flat-fill command stream; one hard ellipse reads as a
        //    stain rather than as shade.
        const contactRings = 4;
        for (let ring = 0; ring < contactRings; ring += 1) {
            const spread = 1 - (ring / contactRings) * 0.72;
            const polygon = [];
            const steps = 26;
            for (let i = 0; i < steps; i += 1) {
                const theta = (i / steps) * Math.PI * 2;
                polygon.push(point(
                    ground.center.x + Math.cos(theta) * reachX * 1.02 * spread,
                    ground.center.y
                        + frontDepth * 0.14
                        + Math.sin(theta) * (frontDepth + rearDepth) * 0.56 * spread,
                ));
            }
            backCommands.push({
                type: 'polygon',
                points: polygon,
                fill: ring === contactRings - 1
                    ? NEBARI_PALETTE.contactCore
                    : NEBARI_PALETTE.contactShadow,
            });
        }

        // 2. Soil granules, only where this module owns the soil. The garden
        //    bed paints its own surface and must not be double-dressed.
        if (ground.drawSoil) {
            const granuleCount = Math.round(16 + growthNorm * 12);
            for (let i = 0; i < granuleCount; i += 1) {
                const u = (hashUnit(`${seed}|soil_u|${i}`) - 0.5) * 2;
                const v = (hashUnit(`${seed}|soil_v|${i}`) - 0.5) * 2;
                if (u * u + v * v > 1.0) continue;
                backCommands.push({
                    type: 'circle',
                    x: rounded(ground.center.x + u * ground.halfWidth * 0.82),
                    y: rounded(ground.center.y + v * ground.frontDepth * 0.9),
                    r: rounded(1.2 + hashUnit(`${seed}|soil_r|${i}`) * 2.2),
                    fill: SOIL_PALETTE[i % SOIL_PALETTE.length],
                });
            }
        }

        // 3. Root buttresses on the ground plane.
        const sampleCount = 16;
        activeSlots.forEach((slot) => {
            const slotSeed = `${seed}|nebari_root|${slot.id}`;
            const azimuth = slot.azimuth
                + (hashUnit(`${slotSeed}|az`) - 0.5) * 0.16;
            const lateral = Math.sin(azimuth);
            const depth = Math.cos(azimuth);
            const isRear = depth < -0.04;

            // Lateral roots carry the eye outward, so they run longer and
            // flatter than the quarter-front ones.
            const lateralBias = 0.82 + Math.abs(lateral) * 0.3;
            const reachFactor = slot.reach * lateralBias
                * (0.86 + hashUnit(`${slotSeed}|len`) * 0.28);
            const endX = ground.center.x + lateral * reachX * reachFactor;
            const endY = ground.center.y
                + depth * (depth >= 0 ? frontDepth : rearDepth) * reachFactor;

            // The root leaves the flare at its own azimuth, staggered up the
            // collar so the buttresses do not all radiate from one point, then
            // dives to the surface and runs out flat.
            const originT = clamp(
                0.68 + (hashUnit(`${slotSeed}|origin`) - 0.5) * 0.36,
                0.44,
                0.94,
            );
            const startX = collarCenterX(originT) + lateral * trunkHalf * 0.62;
            const startY = collarCenterY(originT)
                + depth * (depth >= 0 ? frontDepth : rearDepth) * 0.18;
            const start = { x: startX, y: startY };
            const end = { x: endX, y: endY };
            const spanX = endX - startX;
            const sway = (hashUnit(`${slotSeed}|sway`) - 0.5) * reachX * 0.16;

            const control1 = {
                x: startX + spanX * 0.3,
                y: startY + (endY - startY) * 0.24 + collarRise * 0.34,
            };
            const control2 = {
                x: startX + spanX * 0.72 + sway,
                y: endY - (endY - startY) * 0.1,
            };

            const startWidth = Math.max(
                2.4,
                effectiveTrunkWidth * (0.2 + slot.weight * 0.17) * lerp(0.72, 1, growthNorm),
            );
            const endWidth = Math.max(0.9, startWidth * 0.2);

            const ribbon = buildRootRibbon({
                slotSeed,
                start,
                end,
                control1,
                control2,
                startWidth,
                endWidth,
                sampleCount,
            });
            const { leftPoints, rightPoints, centerPoints } = ribbon;
            const rootPolygon = [...leftPoints, ...rightPoints.slice().reverse()];
            const section = {
                centerPoints,
                leftPoints,
                rightPoints,
                startWidth,
                outlineFill,
                bodyFill,
            };
            if (isRear) {
                appendRootSection(backCommands, {
                    ...section,
                    startIndex: 0,
                    endIndex: sampleCount,
                });
            } else {
                // The overlap is hidden by the trunk at rest and remains wider
                // than the sub-pixel antialias fringe when the tree stirs.
                const silhouetteExitIndex = clamp(
                    Math.round(sampleCount * (0.2 + Math.abs(lateral) * 0.05)),
                    3,
                    sampleCount - 4,
                );
                appendRootSection(backCommands, {
                    ...section,
                    startIndex: 0,
                    endIndex: silhouetteExitIndex + 1,
                });
                appendRootSection(frontRootCommands, {
                    ...section,
                    startIndex: silhouetteExitIndex,
                    endIndex: sampleCount,
                    bodyLead: 1,
                });
            }

            rootSpecs.push({
                id: `nebari_root_${slot.id}`,
                slot: rounded(lateral, 4),
                azimuth: rounded(azimuth, 4),
                depthLayer: isRear ? 'behind_trunk' : 'in_front_of_trunk',
                start: point(startX, startY),
                end: point(endX, endY),
                startWidth: rounded(startWidth),
                endWidth: rounded(endWidth),
                points: rootPolygon,
            });
        });

        rootSpecs.sort((left, right) => left.slot - right.slot);

        // 4. Moss in the valleys between buttresses. Most of it seats under the
        //    front roots so the roots read as sitting in it, not on it.
        const mossPatchCount = Math.round((12 + growthNorm * 16) * mossLoad);
        const mossUnderFront = [];
        const mossOverFront = [];
        for (let i = 0; i < mossPatchCount; i += 1) {
            const theta = hashUnit(`${seed}|moss_theta|${i}`) * Math.PI * 2;
            const radial = 0.38 + hashUnit(`${seed}|moss_radial|${i}`) * 0.5;
            const lateral = Math.sin(theta);
            const depth = Math.cos(theta);
            const mx = ground.center.x + lateral * reachX * radial;
            const my = ground.center.y
                + frontDepth * 0.18
                + depth * (depth >= 0 ? frontDepth : rearDepth) * radial;
            const mr = Math.max(1.2, (1.6 + hashUnit(`${seed}|moss_r|${i}`) * 2.1)
                * lerp(0.7, 1, growthNorm));
            const target = depth < -0.04
                ? backCommands
                : (i % 4 === 0 ? mossOverFront : mossUnderFront);
            // Three overlapping lobes read as a tuft instead of a bead.
            [
                { dx: 0, dy: 0, scale: 1, tone: 0 },
                { dx: 1.05, dy: 0.6, scale: 0.7, tone: 2 },
                { dx: -0.9, dy: 0.45, scale: 0.58, tone: 4 },
            ].forEach((lobe, lobeIndex) => {
                const wobble = hashUnit(`${seed}|moss_w|${i}|${lobeIndex}`) - 0.5;
                target.push({
                    type: 'circle',
                    x: rounded(mx + mr * lobe.dx * (0.8 + wobble * 0.5)),
                    y: rounded(my + mr * lobe.dy * (0.6 + wobble * 0.3)),
                    r: rounded(mr * lobe.scale),
                    fill: mossPalette[(i + lobe.tone) % mossPalette.length],
                });
            });
        }

        frontCommands.push(
            ...mossUnderFront,
            ...frontRootCommands,
            ...mossOverFront,
        );

        const frozenBack = Object.freeze(backCommands.map((command) => Object.freeze(command)));
        const frozenFront = Object.freeze(frontCommands.map((command) => Object.freeze(command)));

        return Object.freeze({
            contract: CONTRACT_ID,
            trunkBase,
            trunkWidth: rounded(effectiveTrunkWidth),
            groundPlane: Object.freeze({
                center: point(ground.center.x, ground.center.y),
                halfWidth: rounded(ground.halfWidth),
                frontDepth: rounded(ground.frontDepth),
                rearDepth: rounded(ground.rearDepth),
                drawSoil: ground.drawSoil,
            }),
            collarRise: rounded(collarRise),
            basalFlareOwner: 'wood_ribbon',
            basalCollarCommandCount: 0,
            rootBaseWidth,
            rootCount: rootSpecs.length,
            rootSpecs: Object.freeze(rootSpecs),
            backCommands: frozenBack,
            frontCommands: frozenFront,
            commands: Object.freeze([...frozenBack, ...frozenFront]),
        });
    }

    scope.ZenBonsaiNebariPresentation = Object.freeze({
        CONTRACT_ID,
        NEBARI_PALETTE,
        MOSS_PALETTES,
        ROOT_SLOTS,
        buildNebariPresentation,
    });
}(globalThis));
