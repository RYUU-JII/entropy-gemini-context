/**
 * Detachable three-dimensional terminal-twig volume for the completed G15.4 graph.
 *
 * This owner adds no developmental nodes, events, lineages, resources, or fork
 * receipts. It derives a presentation-only tertiary crown from real world-space
 * segment endpoints so blossoms can occupy projected canopy interiors instead
 * of accumulating only on the structural silhouette.
 */
import { ZEN_G15_ORGAN_CONTRACT, zenG15OrganSample, resolveZenG15OrganAge, reserveZenG15Organs } from './ZenBonsaiG15OrganDevelopment.js';

(function installSakuraCanopyTwigVolume(scope) {
    'use strict';

    const CONTRACT_ID = 'g15_4_detachable_sakura_canopy_twig_volume_v4';
    const DEFAULT_DEPTH_LIFT = 0.065;
    const clamp = (value, minimum, maximum) => Math.max(
        minimum,
        Math.min(maximum, value),
    );

    function finite(value, fallback = 0) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function rounded(value, precision = 5) {
        const power = 10 ** precision;
        const result = Math.round(finite(value) * power) / power;
        return Object.is(result, -0) ? 0 : result;
    }

    function hashString(value) {
        let hash = 2166136261;
        const source = String(value);
        for (let index = 0; index < source.length; index += 1) {
            hash ^= source.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    function randomUnit(key, channel = 0) {
        let value = hashString(`${key}:${channel}`) || 1;
        value ^= value << 13;
        value ^= value >>> 17;
        value ^= value << 5;
        return (value >>> 0) / 4294967296;
    }

    function point(value, label) {
        const source = value?.point ?? value?.position ?? value;
        if (
            !source
            || !Number.isFinite(Number(source.x))
            || !Number.isFinite(Number(source.y))
            || !Number.isFinite(Number(source.z ?? 0))
        ) {
            throw new TypeError(`[G15_CANOPY_TWIG] ${label} requires a finite 3D point.`);
        }
        return {
            x: Number(source.x),
            y: Number(source.y),
            z: Number(source.z ?? 0),
        };
    }

    function add(left, right) {
        return {
            x: left.x + right.x,
            y: left.y + right.y,
            z: left.z + right.z,
        };
    }

    function subtract(left, right) {
        return {
            x: left.x - right.x,
            y: left.y - right.y,
            z: left.z - right.z,
        };
    }

    function multiply(vector, scalar) {
        return {
            x: vector.x * scalar,
            y: vector.y * scalar,
            z: vector.z * scalar,
        };
    }

    function dot(left, right) {
        return left.x * right.x + left.y * right.y + left.z * right.z;
    }

    function cross(left, right) {
        return {
            x: left.y * right.z - left.z * right.y,
            y: left.z * right.x - left.x * right.z,
            z: left.x * right.y - left.y * right.x,
        };
    }

    function magnitude(vector) {
        return Math.hypot(vector.x, vector.y, vector.z);
    }

    function normalize(vector, fallback = { x: 0, y: 1, z: 0 }) {
        const length = magnitude(vector);
        if (length < 1e-7) return { ...fallback };
        return multiply(vector, 1 / length);
    }

    function distance(left, right) {
        return magnitude(subtract(right, left));
    }

    function freezePoint(value) {
        return Object.freeze({
            x: rounded(value.x),
            y: rounded(value.y),
            z: rounded(value.z),
        });
    }

    function normalizeEntry(entry, index) {
        const segment = entry?.segment || {};
        const from = point(entry?.from ?? entry?.startWorld, `entry ${index} from`);
        const to = point(entry?.to ?? entry?.endWorld, `entry ${index} to`);
        return {
            id: String(segment.id ?? entry.id ?? `canopy-source-${index}`),
            lineageId: String(segment.lineageId ?? entry.lineageId ?? `lineage-${index}`),
            fromNodeId: String(entry.fromNodeId ?? segment.fromNodeId ?? `${index}:from`),
            toNodeId: String(entry.toNodeId ?? segment.toNodeId ?? `${index}:to`),
            sequence: finite(segment.sequence ?? segment.birthEvent, index),
            tier: clamp(Math.round(finite(segment.tier ?? segment.axisOrder, 1)), 0, 2),
            startRadius: Math.max(0.05, finite(segment.startRadius, 1)),
            endRadius: Math.max(0.05, finite(segment.endRadius, 0.8)),
            scaffoldFamilyTerminalLoadScale: clamp(finite(
                segment.scaffoldFamilyTerminalLoadScale,
                1,
            ), 0.78, 1),
            from,
            to,
            length: distance(from, to),
            tangent: normalize(subtract(to, from)),
        };
    }

    function viewDepthFor(yaw) {
        return normalize({
            x: Math.sin(yaw),
            y: 0,
            z: Math.cos(yaw),
        }, { x: 0, y: 0, z: 1 });
    }

    function projectedDirection(direction, yaw, depthLift = DEFAULT_DEPTH_LIFT) {
        const cosine = Math.cos(yaw);
        const sine = Math.sin(yaw);
        const depth = direction.x * sine + direction.z * cosine;
        return normalize({
            x: direction.x * cosine - direction.z * sine,
            y: direction.y + depth * depthLift,
            z: 0,
        }, { x: 0, y: 1, z: 0 });
    }

    function projectedAngle(left, right, yaw, depthLift) {
        const projectedLeft = projectedDirection(left, yaw, depthLift);
        const projectedRight = projectedDirection(right, yaw, depthLift);
        return Math.acos(clamp(dot(projectedLeft, projectedRight), -1, 1));
    }

    /**
     * A depth-bearing twig may be modest in world space yet look orthogonal
     * after yaw projection. Keep its visible grain attached to the source
     * segment while retaining as much of the sampled 3D release as the camera
     * can show without a false elbow.
     */
    function preserveProjectedGrain(tangent, candidate, options) {
        const { yaw, depthLift, maximumTurn } = options;
        const rawProjectedAngle = projectedAngle(
            tangent,
            candidate,
            yaw,
            depthLift,
        );
        if (rawProjectedAngle <= maximumTurn) {
            return {
                direction: candidate,
                rawProjectedAngle,
                projectedAngle: rawProjectedAngle,
                candidateRetention: 1,
                adjusted: false,
            };
        }
        let minimumRetention = 0;
        let maximumRetention = 1;
        for (let iteration = 0; iteration < 16; iteration += 1) {
            const retention = (minimumRetention + maximumRetention) * 0.5;
            const blended = normalize(add(
                multiply(tangent, 1 - retention),
                multiply(candidate, retention),
            ));
            if (projectedAngle(tangent, blended, yaw, depthLift) <= maximumTurn) {
                minimumRetention = retention;
            } else {
                maximumRetention = retention;
            }
        }
        const direction = normalize(add(
            multiply(tangent, 1 - minimumRetention),
            multiply(candidate, minimumRetention),
        ));
        return {
            direction,
            rawProjectedAngle,
            projectedAngle: projectedAngle(tangent, direction, yaw, depthLift),
            candidateRetention: minimumRetention,
            adjusted: true,
        };
    }

    function buildAnchorCandidates(entries, seed) {
        // A slender distal leader can carry laterals too. Excluding all order-0
        // wood left the crown's apex bare even after the tree fully matured.
        return entries.filter(entry => (entry.tier > 0 || entry.endRadius <= 3.3) && entry.length >= 8
            && entry.endRadius <= 6.6
            && zenG15OrganSample(seed, entry.id, 'twig-permit') > 0.18)
            .map(entry => {
                const attachment = add(entry.from, multiply(subtract(entry.to, entry.from), 0.76));
                return {
                    id: `canopy-anchor:${entry.id}`,
                    key: `${seed}:${entry.id}:canopy-anchor`,
                    lineageId: entry.lineageId,
                    birthEvent: entry.sequence + 16 + zenG15OrganSample(seed, entry.id, 'twig-birth') * 10,
                    restPoint: attachment,
                    point: attachment,
                    entry,
                    internal: true,
                    height: attachment.y,
                };
            });
    }

    function selectAnchors(candidates, _entryCount, seed, volumeLoad) {
        const target = Math.round(30 * clamp(volumeLoad, 0, 1.6));
        return {
            target,
            selected: reserveZenG15Organs(candidates, { limit: target, spacing: 20, lineageLimit: 3 }),
            interiorBias: rounded(0.58 + randomUnit(seed, 'canopy-interior-bias') * 0.2),
        };
    }

    function releaseDirection(anchor, viewDepth, seed, index, projection) {
        const key = `${seed}:${anchor.key}:release:${index}`;
        const tangent = anchor.entry.tangent;
        let side = normalize(cross(viewDepth, tangent), { x: 1, y: 0, z: 0 });
        if (Math.abs(dot(side, tangent)) > 0.08) {
            side = normalize(cross({ x: 0, y: 1, z: 0 }, tangent), { x: 1, y: 0, z: 0 });
        }
        const around = normalize(cross(tangent, side), viewDepth);
        const lateralSign = randomUnit(key, 'lateral-sign') > 0.5 ? 1 : -1;
        const depthSign = randomUnit(key, 'depth-sign') > 0.46 ? -1 : 1;
        const orbitalAngle = 0.58 + randomUnit(key, 'orbital-angle') * 0.54;
        const radial = add(
            multiply(side, Math.cos(orbitalAngle) * lateralSign),
            multiply(around, Math.sin(orbitalAngle) * depthSign),
        );
        const radialWeight = anchor.internal ? 0.56 : 0.44;
        const tangentWeight = anchor.internal ? 0.62 : 0.72;
        let direction = normalize(add(
            add(multiply(tangent, tangentWeight), multiply(radial, radialWeight)),
            { x: 0, y: 0.08 + randomUnit(key, 'lift') * 0.12, z: 0 },
        ));
        const depthAlignment = dot(direction, viewDepth);
        if (Math.abs(depthAlignment) < 0.24) {
            direction = normalize(add(
                direction,
                multiply(viewDepth, depthSign * (0.34 - Math.abs(depthAlignment))),
            ));
        }
        if (direction.y < -0.28) {
            direction = normalize(add(direction, { x: 0, y: 0.32, z: 0 }));
        }
        const maximumProjectedTurn = anchor.internal
            ? 0.5 + randomUnit(key, 'projected-turn-envelope') * 0.12
            : 0.36 + randomUnit(key, 'projected-turn-envelope') * 0.1;
        const grain = preserveProjectedGrain(tangent, direction, {
            yaw: projection.yaw,
            depthLift: projection.depthLift,
            maximumTurn: maximumProjectedTurn,
        });
        direction = grain.direction;
        return {
            direction,
            side,
            depthSign,
            depthAlignment: dot(direction, viewDepth),
            orbitalAngle,
            maximumProjectedTurn,
            rawProjectedAngle: grain.rawProjectedAngle,
            projectedAngle: grain.projectedAngle,
            candidateRetention: grain.candidateRetention,
            projectedContinuityAdjusted: grain.adjusted,
        };
    }

    function advancedDirection(direction, side, key, step) {
        return normalize(add(
            add(
                multiply(direction, 0.88),
                multiply(side, (randomUnit(key, `bend:${step}`) - 0.5) * 0.28),
            ),
            { x: 0, y: 0.06 + randomUnit(key, `lift:${step}`) * 0.08, z: 0 },
        ));
    }

    function createEntry({
        id,
        lineageId,
        sourceLineageId,
        fromNodeId,
        toNodeId,
        from,
        to,
        startRadius,
        endRadius,
        sequence,
        branchRole,
        depthLayer,
        scaffoldFamilyTerminalLoadScale,
    }) {
        return Object.freeze({
            id,
            lineageId,
            presentationLineageId: lineageId,
            sourceLineageId,
            fromNodeId,
            toNodeId,
            from: freezePoint(from),
            to: freezePoint(to),
            startRadius: rounded(startRadius),
            endRadius: rounded(endRadius),
            sequence,
            tier: 2,
            axisOrder: 2,
            isCanopyTwig: true,
            branchRole,
            depthLayer,
            scaffoldFamilyTerminalLoadScale: rounded(
                scaffoldFamilyTerminalLoadScale,
            ),
        });
    }

    function buildTwig(anchor, options) {
        const { seed, viewDepth, sequence, growthScale } = options;
        const index = anchor.entry.id;
        const key = `${seed}:${anchor.key}:twig:${index}`;
        const release = releaseDirection(anchor, viewDepth, seed, index, options.projection);
        const parentLength = anchor.entry.length;
        const firstLength = clamp(
            parentLength * (0.27 + randomUnit(key, 'first-length') * 0.14),
            11,
            28,
        ) * growthScale;
        const secondLength = firstLength * (0.72 + randomUnit(key, 'second-length') * 0.2);
        const thirdLength = secondLength * (0.66 + randomUnit(key, 'third-length') * 0.18);
        const fullRootRadius = clamp(anchor.entry.endRadius * 0.38, 0.78, 2.05);
        const fullMiddleRadius = Math.max(0.56, fullRootRadius * 0.75);
        const rootRadius = fullRootRadius * growthScale;
        const middleRadius = fullMiddleRadius * growthScale;
        const tipRadius = Math.max(0.36, fullMiddleRadius * 0.64) * growthScale;
        const root = anchor.point;
        const firstDirection = release.direction;
        const secondDirection = advancedDirection(firstDirection, release.side, key, 1);
        const first = add(root, multiply(firstDirection, firstLength));
        const second = add(first, multiply(secondDirection, secondLength));
        const rootLineageId = `canopy-twig:${index}:stem`;
        const firstNodeId = `canopy-twig:${index}:node:1`;
        const secondNodeId = `canopy-twig:${index}:node:2`;
        const depthLayer = release.depthAlignment >= 0.08
            ? 'behind_wood'
            : (release.depthAlignment <= -0.08 ? 'in_front_of_wood' : 'middle_wood');
        const entries = [
            createEntry({
                id: `canopy-twig:${index}:segment:1`,
                lineageId: rootLineageId,
                sourceLineageId: anchor.entry.lineageId,
                fromNodeId: `canopy-twig:${index}:anchor`,
                toNodeId: firstNodeId,
                from: root,
                to: first,
                startRadius: rootRadius,
                endRadius: middleRadius,
                sequence,
                branchRole: 'oblique_depth_stem',
                depthLayer,
                scaffoldFamilyTerminalLoadScale:
                    anchor.entry.scaffoldFamilyTerminalLoadScale,
            }),
            createEntry({
                id: `canopy-twig:${index}:segment:2`,
                lineageId: rootLineageId,
                sourceLineageId: anchor.entry.lineageId,
                fromNodeId: firstNodeId,
                toNodeId: secondNodeId,
                from: first,
                to: second,
                startRadius: middleRadius,
                endRadius: tipRadius * 1.12,
                sequence: sequence + 0.01,
                branchRole: 'oblique_depth_stem',
                depthLayer,
                scaffoldFamilyTerminalLoadScale:
                    anchor.entry.scaffoldFamilyTerminalLoadScale,
            }),
        ];
        const split = randomUnit(key, 'terminal-split') < 0.68;
        if (split) {
            const spread = 0.32 + randomUnit(key, 'split-spread') * 0.28;
            [-1, 1].forEach((sign, childIndex) => {
                const childDirection = normalize(add(
                    advancedDirection(secondDirection, release.side, key, childIndex + 2),
                    multiply(release.side, sign * spread),
                ));
                const childLength = thirdLength * (
                    childIndex === 0
                        ? 0.86 + randomUnit(key, 'left-length') * 0.18
                        : 0.8 + randomUnit(key, 'right-length') * 0.24
                );
                entries.push(createEntry({
                    id: `canopy-twig:${index}:segment:${childIndex + 3}`,
                    lineageId: `canopy-twig:${index}:child:${childIndex}`,
                    sourceLineageId: anchor.entry.lineageId,
                    fromNodeId: secondNodeId,
                    toNodeId: `canopy-twig:${index}:tip:${childIndex}`,
                    from: second,
                    to: add(second, multiply(childDirection, childLength)),
                    startRadius: tipRadius * 1.05,
                    endRadius: Math.max(0.25 * growthScale, tipRadius * 0.56),
                    sequence: sequence + 0.02 + childIndex * 0.001,
                    branchRole: 'terminal_depth_fan',
                    depthLayer,
                    scaffoldFamilyTerminalLoadScale:
                        anchor.entry.scaffoldFamilyTerminalLoadScale,
                }));
            });
        } else {
            const thirdDirection = advancedDirection(secondDirection, release.side, key, 3);
            entries.push(createEntry({
                id: `canopy-twig:${index}:segment:3`,
                lineageId: rootLineageId,
                sourceLineageId: anchor.entry.lineageId,
                fromNodeId: secondNodeId,
                toNodeId: `canopy-twig:${index}:tip:0`,
                from: second,
                to: add(second, multiply(thirdDirection, thirdLength)),
                startRadius: tipRadius * 1.05,
                endRadius: Math.max(0.25 * growthScale, tipRadius * 0.54),
                sequence: sequence + 0.02,
                branchRole: 'terminal_depth_wand',
                depthLayer,
                scaffoldFamilyTerminalLoadScale:
                    anchor.entry.scaffoldFamilyTerminalLoadScale,
            }));
        }
        return {
            entries,
            receipt: Object.freeze({
                id: `canopy-twig-receipt:${index}`,
                birthEvent: anchor.birthEvent,
                anchorId: anchor.id,
                sourceSegmentId: anchor.entry.id,
                sourceLineageId: anchor.entry.lineageId,
                scaffoldFamilyTerminalLoadScale: rounded(
                    anchor.entry.scaffoldFamilyTerminalLoadScale,
                ),
                anchorNodeId: anchor.entry.toNodeId,
                anchorPoint: freezePoint(anchor.point),
                height: rounded(anchor.height),
                internalAnchor: anchor.internal,
                depthLayer,
                depthAlignment: rounded(release.depthAlignment),
                orbitalAngleRadians: rounded(release.orbitalAngle),
                rawProjectedReleaseAngleDegrees: rounded(
                    release.rawProjectedAngle * 180 / Math.PI,
                    3,
                ),
                projectedReleaseAngleDegrees: rounded(
                    release.projectedAngle * 180 / Math.PI,
                    3,
                ),
                projectedTurnEnvelopeDegrees: rounded(
                    release.maximumProjectedTurn * 180 / Math.PI,
                    3,
                ),
                projectedCandidateRetention: rounded(release.candidateRetention, 4),
                projectedContinuityAdjusted: release.projectedContinuityAdjusted,
                firstLength: rounded(firstLength),
                totalSegmentCount: entries.length,
                terminalSplit: split,
            }),
        };
    }

    function buildCanopyTwigVolume(options = {}) {
        const entries = (options.entries || []).map(normalizeEntry);
        if (!entries.length) {
            return Object.freeze({
                contractId: CONTRACT_ID,
                entries: Object.freeze([]),
                plannedEntries: Object.freeze([]),
                receipts: Object.freeze([]),
                candidateCount: 0,
                targetAnchorCount: 0,
                anchorCount: 0,
                segmentCount: 0,
            });
        }
        const seed = options.seed ?? 'unseeded';
        const yaw = finite(options.yaw, 0.24);
        const depthLift = finite(options.depthLift, DEFAULT_DEPTH_LIFT);
        const candidates = buildAnchorCandidates(entries, seed);
        const selection = selectAnchors(
            candidates,
            entries.length,
            seed,
            finite(options.volumeLoad, 1),
        );
        const viewDepth = viewDepthFor(yaw);
        const eventTime = options.eventTime;
        if (!Number.isFinite(eventTime)) throw new Error('ZEN_G15_CANOPY_CLOCK_REQUIRED');
        const twigs = selection.selected.map(anchor => buildTwig(anchor, {
            seed, viewDepth, growthScale: 1, sequence: anchor.birthEvent,
            projection: { yaw, depthLift },
        }));
        const plannedEntries = twigs.flatMap(twig => twig.entries.map((entry, index) => ({
            ...entry,
            sourceSegmentId: twig.receipt.sourceSegmentId,
            birthEvent: twig.receipt.birthEvent + Math.min(index, 2) * 6,
            restFrom: entry.from,
            restTo: entry.to,
        })));
        const points = new Map();
        const volumeEntries = [];
        for (const entry of plannedEntries) {
            const age = resolveZenG15OrganAge(eventTime, entry.birthEvent);
            if (age.extension <= 0) continue;
            const from = points.get(entry.fromNodeId) || entry.from;
            const to = add(from, multiply(subtract(entry.to, entry.from), age.extension));
            points.set(entry.toNodeId, to);
            volumeEntries.push(Object.freeze({
                ...entry, from: freezePoint(from), to: freezePoint(to),
                startRadius: entry.startRadius * Math.sqrt(age.girth),
                endRadius: entry.endRadius * age.girth,
                developmentProgress: age.extension,
            }));
        }
        const receipts = twigs.map(twig => Object.freeze({
            ...twig.receipt,
            ...resolveZenG15OrganAge(eventTime, twig.receipt.birthEvent),
        }));
        return Object.freeze({
            contractId: CONTRACT_ID,
            semantics: ZEN_G15_ORGAN_CONTRACT,
            layer: 'causal_canopy_support_presentation',
            seed,
            yaw: rounded(yaw),
            depthLift: rounded(depthLift),
            volumeLoad: clamp(finite(options.volumeLoad, 1), 0.25, 1.6),
            interiorBias: selection.interiorBias,
            candidateCount: candidates.length,
            targetAnchorCount: selection.target,
            anchorCount: receipts.filter(receipt => receipt.extension > 0).length,
            reservedAnchorCount: selection.selected.length,
            segmentCount: volumeEntries.length,
            splitTwigCount: receipts.filter((receipt) => receipt.terminalSplit).length,
            backTwigCount: receipts.filter((receipt) => receipt.depthLayer === 'behind_wood').length,
            middleTwigCount: receipts.filter((receipt) => receipt.depthLayer === 'middle_wood').length,
            frontTwigCount: receipts.filter((receipt) => receipt.depthLayer === 'in_front_of_wood').length,
            projectedContinuityAdjustedCount: receipts.filter(
                (receipt) => receipt.projectedContinuityAdjusted,
            ).length,
            meanProjectedReleaseAngleDegrees: rounded(receipts.reduce(
                (total, receipt) => total + receipt.projectedReleaseAngleDegrees,
                0,
            ) / Math.max(1, receipts.length), 3),
            maximumProjectedReleaseAngleDegrees: rounded(Math.max(
                0,
                ...receipts.map((receipt) => receipt.projectedReleaseAngleDegrees),
            ), 3),
            entries: Object.freeze(volumeEntries),
            plannedEntries: Object.freeze(plannedEntries),
            receipts: Object.freeze(receipts),
        });
    }

    scope.ZenBonsaiTypedDevelopmentalSchedulerCanopyTwigVolume = Object.freeze({
        contractId: CONTRACT_ID,
        buildCanopyTwigVolume,
    });
}(globalThis));
