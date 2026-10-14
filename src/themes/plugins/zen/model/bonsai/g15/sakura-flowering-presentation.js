/**
 * Detachable, locally aged organs for the G15.4 developing wood graph.
 *
 * Flowering never writes geometry back to the developmental graph. Every visible
 * family follows one stable station on a real projected wood segment; rest-world
 * reservations and local age are independent of current bloom and camera.
 */
import { ZEN_G15_ORGAN_CONTRACT, zenG15OrganSample, zenG15OrganRamp, resolveZenG15OrganAge, reserveZenG15Organs } from './ZenBonsaiG15OrganDevelopment.js';
import {
    SAKURA_CLUSTER_COMPOSITION_TEMPLATES,
    createSakuraBlossomPose,
    resolveProjectedBlossomAtlasDescriptor,
} from './ZenBonsaiG15TerminalMorphology.js';

(function installSakuraFloweringPresentation(scope) {
    'use strict';

    const CONTRACT_ID = 'g15_4_detachable_sakura_flowering_presentation_v7';
    const FLORAL_COMPLETION_SEMANTICS =
        ZEN_G15_ORGAN_CONTRACT;
    const TWO_PI = Math.PI * 2;
    const FLOWER_SIZE_MULTIPLIER = 1.3;
    const FLOWER_DISPLAY_SCALE = Object.freeze({
        flower_eye: 0.82,
        bud: 0.94,
        half_open: 1.12,
        full: 1.27,
    });
    const FLOWER_PROJECTION_CONTRACT = Object.freeze({
        id: 'camera_relative_bloom_projection_v1',
        referenceCameraScale: 0.64,
        minimumProjectionScale: 0.34,
        maximumProjectionScale: 1.08,
        minimumEntityRadiusPx: 3.2,
        maximumEntityRadiusPx: 9.8,
    });
    const CANONICAL_CLUSTER_TEMPLATES = SAKURA_CLUSTER_COMPOSITION_TEMPLATES;
    const clamp = (value, minimum, maximum) => Math.max(
        minimum,
        Math.min(maximum, value),
    );

    function finite(value, fallback = 0) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function rounded(value, precision = 4) {
        const power = 10 ** precision;
        const result = Math.round(finite(value) * power) / power;
        return Object.is(result, -0) ? 0 : result;
    }

    function resolveFlowerProjectionScale(cameraScale) {
        return clamp(
            finite(cameraScale, FLOWER_PROJECTION_CONTRACT.referenceCameraScale)
                / FLOWER_PROJECTION_CONTRACT.referenceCameraScale,
            FLOWER_PROJECTION_CONTRACT.minimumProjectionScale,
            FLOWER_PROJECTION_CONTRACT.maximumProjectionScale,
        );
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

    function canonicalBlossomPose(attachmentAngle, key) {
        let sampleIndex = 0;
        return createSakuraBlossomPose(
            attachmentAngle,
            () => randomUnit(key, `canonical-pose:${sampleIndex++}`),
        );
    }

    function distance(left, right) {
        return Math.hypot(right.x - left.x, right.y - left.y);
    }

    function normalize(vector) {
        const magnitude = Math.max(1e-7, Math.hypot(vector.x, vector.y));
        return { x: vector.x / magnitude, y: vector.y / magnitude };
    }

    function rotate(vector, angle) {
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);
        return {
            x: vector.x * cosine - vector.y * sine,
            y: vector.x * sine + vector.y * cosine,
        };
    }

    function directionAngle(left, right) {
        return Math.acos(clamp(
            left.x * right.x + left.y * right.y,
            -1,
            1,
        ));
    }

    function pointAlong(start, direction, amount) {
        return {
            x: rounded(start.x + direction.x * amount),
            y: rounded(start.y + direction.y * amount),
            depth: finite(start.depth),
        };
    }

    function mixPoint(start, end, ratio) {
        return {
            x: rounded(start.x + (end.x - start.x) * ratio),
            y: rounded(start.y + (end.y - start.y) * ratio),
            depth: rounded(start.depth + (end.depth - start.depth) * ratio),
        };
    }

    function pointOnPolyline(points, progress) {
        if (points.length <= 1) return { ...points[0] };
        const lengths = points.slice(1).map((point, index) => (
            distance(points[index], point)
        ));
        const totalLength = lengths.reduce((total, length) => total + length, 0);
        let target = clamp(progress, 0, 1) * totalLength;
        for (let index = 0; index < lengths.length; index += 1) {
            if (target <= lengths[index] || index === lengths.length - 1) {
                return mixPoint(
                    points[index],
                    points[index + 1],
                    target / Math.max(1e-7, lengths[index]),
                );
            }
            target -= lengths[index];
        }
        return { ...points.at(-1) };
    }

    function commandLine(points, stroke, lineWidth, alpha = 1) {
        return {
            type: 'line',
            points: points.map((point) => ({ x: rounded(point.x), y: rounded(point.y) })),
            stroke,
            lineWidth: rounded(lineWidth),
            lineCap: 'round',
            lineJoin: 'round',
            alpha,
        };
    }

    function commandPolygon(points, fill, stroke = undefined, lineWidth = undefined) {
        return {
            type: 'polygon',
            points: points.map((point) => ({ x: rounded(point.x), y: rounded(point.y) })),
            fill,
            stroke,
            lineWidth,
        };
    }

    function commandCircle(point, radius, fill, stroke = undefined, lineWidth = undefined) {
        return {
            type: 'circle',
            x: rounded(point.x),
            y: rounded(point.y),
            r: rounded(radius),
            fill,
            stroke,
            lineWidth,
        };
    }

    function commandProjectedBlossom(point, size, pose, stage, openness, color = '#E3BEC0') {
        const blossom = Object.freeze({
            projectionMode: 'projected',
            bloomStage: stage,
            openness: clamp(finite(openness, stage === 'half_open' ? 0.42 : 0.96), 0, 1),
            facingYaw: clamp(finite(pose.facingYaw), -Math.PI, Math.PI),
            facingPitch: clamp(finite(pose.facingPitch), -Math.PI * 0.5, Math.PI * 0.5),
        });
        const atlas = resolveProjectedBlossomAtlasDescriptor(blossom);
        return {
            type: 'projectedSakuraBlossom',
            x: rounded(point.x),
            y: rounded(point.y),
            // The canonical sprite owns a 64-unit logical canvas with roughly
            // a 10-unit floral radius. This keeps the visible radius equal to
            // the former procedural `size` while retaining the atlas padding.
            drawSize: rounded(size * 6.4),
            screenRoll: rounded(finite(pose.screenRoll), 6),
            alpha: rounded(clamp(finite(pose.alpha, 1), 0, 1), 4),
            color,
            blossom,
            atlasId: atlas.atlasId,
            opennessId: atlas.opennessId,
            viewId: atlas.viewId,
            mirrorX: Boolean(atlas.mirrorX),
        };
    }

    function normalizeEntry(entry, index) {
        const segment = entry?.segment || {};
        const start = entry?.start;
        const end = entry?.end;
        if (!start || !end) {
            throw new TypeError(`[G15_FLOWERING] Entry ${index} requires projected endpoints.`);
        }
        const id = String(segment.id ?? entry.id ?? `flower-source-${index}`);
        const canopyCarrierMatch = id.match(/^(canopy-twig:[^:]+)/u);
        if (!entry.restFrom || !entry.restTo || !Number.isFinite(segment.birthEvent)) {
            throw new Error('ZEN_G15_FLORAL_REST_CARRIER_REQUIRED');
        }
        return {
            id,
            birthEvent: segment.birthEvent,
            branchRole: segment.branchRole,
            carrierAvailable: entry.carrierAvailable === true,
            restFrom: entry.restFrom,
            restTo: entry.restTo,
            lineageId: String(
                entry.presentationLineageId
                    ?? segment.lineageId
                    ?? entry.lineageId
                    ?? `lineage-${index}`,
            ),
            fromNodeId: String(entry.fromNodeId ?? segment.fromNodeId ?? `${index}:from`),
            toNodeId: String(entry.toNodeId ?? segment.toNodeId ?? `${index}:to`),
            sequence: finite(segment.sequence ?? segment.birthEvent, index),
            tier: clamp(Math.round(finite(segment.tier ?? segment.axisOrder, 2)), 0, 2),
            isCanopyTwig: Boolean(entry.isCanopyTwig),
            canopyCarrierId: canopyCarrierMatch?.[1] ?? null,
            depthLayer: entry.depthLayer || null,
            startRadiusWorld: Math.max(0.01, finite(
                entry.startRadiusWorld ?? segment.startRadius,
                1,
            )),
            endRadiusWorld: Math.max(0.01, finite(
                entry.endRadiusWorld ?? segment.endRadius,
                0.8,
            )),
            scaffoldFamilyTerminalLoadScale: clamp(finite(
                entry.scaffoldFamilyTerminalLoadScale
                    ?? segment.scaffoldFamilyTerminalLoadScale,
                1,
            ), 0.78, 1),
            start: {
                x: finite(start.x),
                y: finite(start.y),
                depth: finite(start.depth),
            },
            end: {
                x: finite(end.x),
                y: finite(end.y),
                depth: finite(end.depth),
            },
        };
    }

    const HABITS = Object.freeze([
        Object.freeze({ id: 'mixed_spur_cloud', density: 1.05 }),
        Object.freeze({ id: 'terminal_constellation', density: 0.98 }),
        Object.freeze({ id: 'laden_short_spurs', density: 1.15 }),
        Object.freeze({ id: 'airy_asymmetric_bloom', density: 0.92 }),
    ]);

    function buildCandidates(entries, seed) {
        const candidates = entries.filter(entry => {
            const length = Math.hypot(entry.restTo.x - entry.restFrom.x,
                entry.restTo.y - entry.restFrom.y, entry.restTo.z - entry.restFrom.z);
            const twigTip = !entry.isCanopyTwig || ['terminal_depth_fan', 'terminal_depth_wand'].includes(entry.branchRole);
            // The fork's short shoots finish around 6 world units; the structural
            // internode's 8-unit threshold excluded almost every floral carrier.
            // Extension wands retain that threshold, and all admitted buds still
            // obey the shared spacing, birth, age and flowering budgets.
            const minimumLength = entry.isCanopyTwig && entry.branchRole === 'terminal_depth_fan' ? 4 : 8;
            const distalWood = entry.tier > 0 || entry.endRadiusWorld <= 3.3;
            return distalWood && entry.endRadiusWorld <= 7.2 && length >= minimumLength && twigTip;
        }).map(entry => {
            const ratio = entry.isCanopyTwig ? 1 : 0.76;
            const key = `${entry.id}:station:0`;
            const tangent = normalize({ x: entry.end.x - entry.start.x, y: entry.end.y - entry.start.y });
            const restPoint = Object.fromEntries(['x', 'y', 'z'].map(axis => [axis,
                entry.restFrom[axis] + (entry.restTo[axis] - entry.restFrom[axis]) * ratio,
            ]));
            const kind = entry.isCanopyTwig ? 'terminal_tip' : 'axillary_spur';
            return {
                id: `flower-site:${key}`, key, kind, entry,
                birthEvent: entry.birthEvent + 12 + zenG15OrganSample(seed, key, 'floral-birth') * 6,
                restPoint, point: mixPoint(entry.start, entry.end, ratio), tangent, flowTangent: tangent,
                lineageId: entry.lineageId,
                isCanopyTwig: entry.isCanopyTwig, canopyCarrierId: entry.canopyCarrierId,
                organKind: zenG15OrganSample(seed, key, 'organ-kind') < 0.16 ? 'vegetative_bud' : 'floral_bud',
                clusterRole: entry.isCanopyTwig ? 'tip'
                    : ['inner', 'middle', 'edge'][Math.floor(zenG15OrganSample(seed, key, 'role') * 3)],
                clusterId: null, clusterAffinity: 0, clusterPadTangent: null,
                radius: entry.endRadiusWorld, height: 0, slenderness: 1, radial: 0,
                arc: 0, lineageLength: 0,
                scaffoldFamilyTerminalLoadScale: entry.scaffoldFamilyTerminalLoadScale,
            };
        });
        return {
            candidates, junctionCandidates: [],
            coverageCompletion: Object.freeze({ contractId: ZEN_G15_ORGAN_CONTRACT,
                semantics: 'birth_order_rest_world_reservations', active: true }),
        };
    }

    function selectSites(candidates, entries, seed) {
        const habit = HABITS[Math.floor(randomUnit(seed, 'flowering-habit') * HABITS.length)];
        const target = Math.round(76 * habit.density);
        const sites = reserveZenG15Organs(candidates, { limit: target, spacing: 17, lineageLimit: 5 });
        const canopyCount = sites.filter(site => site.isCanopyTwig).length;
        return { habit, target, budgetBasis: entries.length, sites,
            volumeTarget: canopyCount, volumeShare: canopyCount / Math.max(1, sites.length),
            sampledVolumeShare: 0, canopyCarrierCount: new Set(candidates.map(site => site.canopyCarrierId).filter(Boolean)).size };
    }

    function resolveFloralCompletion(candidates, selectedSites) {
        const terminalCandidates = candidates.filter(site => site.kind === 'terminal_tip');
        const selectedTerminals = selectedSites.filter(site => site.kind === 'terminal_tip');
        return Object.freeze({
            semantics: FLORAL_COMPLETION_SEMANTICS, authority: 'shared_causal_organ_budget',
            createsWood: false, changesGrowthResources: false,
            terminalCandidateCount: terminalCandidates.length, primaryTerminalCount: selectedTerminals.length,
            terminalCompletionCount: 0, bareTerminalCount: terminalCandidates.length - selectedTerminals.length,
            structuralTerminalCompletionCount: 0, canopyTwigTerminalCompletionCount: 0,
            junctionCandidateCount: 0, junctionAccentTarget: 0, junctionAccentCount: 0,
        });
    }

    function familyKindFor(site, habit, seed) {
        const sample = randomUnit(seed, `${site.key}:family-kind`);
        if (habit.id === 'terminal_constellation' && site.kind === 'terminal_tip') {
            if (sample < 0.54) return 'direct_rosette';
            if (sample < 0.86) return 'short_floral_spur';
            return 'paired_spray';
        }
        if (habit.id === 'laden_short_spurs') {
            if (sample < 0.54) return 'short_floral_spur';
            if (sample < 0.82) return 'paired_spray';
            if (sample < 0.94) return 'direct_rosette';
            return 'bud_chain';
        }
        if (sample < 0.28) return 'direct_rosette';
        if (sample < 0.65) return 'short_floral_spur';
        if (sample < 0.88) return 'paired_spray';
        return 'bud_chain';
    }

    function appendSpur(commands, points, width = 1) {
        commands.push(commandLine(points, 'rgba(22, 21, 19, 0.72)', width * 1.8));
        commands.push(commandLine(points, '#3B3830', width * 1.1));
        commands.push(commandLine(points, '#565045', Math.max(0.4, width * 0.65)));
        if (points.length >= 2) {
            commands.push(commandCircle(points[0], Math.max(0.8, width * 0.9), '#2E2B25'));
        }
    }

    function stageFor(progress) {
        if (progress < 0.23) return 'flower_eye';
        if (progress < 0.48) return 'bud';
        if (progress < 0.7) return 'half_open';
        return 'full';
    }

    function appendFlowerEye(commands, center, angle, size) {
        const direction = { x: Math.cos(angle), y: Math.sin(angle) };
        const normal = { x: -direction.y, y: direction.x };
        const length = size * 1.05;
        const width = size * 0.52;
        const base = pointAlong(center, direction, -length * 0.2);
        const tip = pointAlong(center, direction, length * 0.8);
        commands.push(commandPolygon([
            base,
            { x: center.x + normal.x * width, y: center.y + normal.y * width },
            tip,
            { x: center.x - normal.x * width, y: center.y - normal.y * width },
        ], '#A57880', 'rgba(40, 30, 32, 0.5)', 0.42));
        commands.push(commandLine([
            pointAlong(center, normal, -width * 0.5),
            pointAlong(center, normal, width * 0.5),
        ], 'rgba(186, 148, 154, 0.28)', 0.34));
    }

    function appendBud(commands, center, angle, size, key) {
        const direction = { x: Math.cos(angle), y: Math.sin(angle) };
        const normal = { x: -direction.y, y: direction.x };
        const length = size * 1.35;
        const width = size * 0.72;
        const base = pointAlong(center, direction, -length * 0.34);
        const tip = pointAlong(center, direction, length * 0.66);
        commands.push(commandPolygon([
            base,
            { x: center.x + normal.x * width, y: center.y + normal.y * width },
            pointAlong(tip, normal, width * 0.22),
            tip,
            pointAlong(tip, normal, -width * 0.22),
            { x: center.x - normal.x * width, y: center.y - normal.y * width },
        ], randomUnit(key, 'bud-tone') > 0.5 ? '#D8AFB3' : '#C89AA1', '#7E5C63', 0.46));
        commands.push(commandPolygon([
            base,
            pointAlong(center, normal, width * 0.44),
            pointAlong(center, direction, length * 0.02),
            pointAlong(center, normal, -width * 0.44),
        ], '#7E5C63'));
    }

    function appendOpenFlower(commands, center, size, pose, stage, openness) {
        commands.push(commandProjectedBlossom(
            center,
            size,
            pose,
            stage,
            openness,
        ));
    }

    function summarizeProjectedAtlas(commands) {
        return Object.freeze(commands.reduce((counts, command) => {
            if (command.type !== 'projectedSakuraBlossom') return counts;
            counts[command.atlasId] = (counts[command.atlasId] || 0) + 1;
            return counts;
        }, {}));
    }

    function summarizeCarrierContinuity(families) {
        const receipts = families
            .map((family) => family.continuity)
            .filter(Boolean);
        const mean = (field) => rounded(receipts.reduce(
            (total, receipt) => total + finite(receipt[field]),
            0,
        ) / Math.max(1, receipts.length), 3);
        const maximum = (field) => rounded(Math.max(
            0,
            ...receipts.map((receipt) => finite(receipt[field])),
        ), 3);
        return Object.freeze({
            receiptCount: receipts.length,
            meanLocalToFlowAngleDegrees: mean('localToFlowAngleDegrees'),
            maximumLocalToFlowAngleDegrees: maximum('localToFlowAngleDegrees'),
            meanCarrierReleaseAngleDegrees: mean('carrierReleaseAngleDegrees'),
            maximumCarrierReleaseAngleDegrees: maximum('carrierReleaseAngleDegrees'),
            maximumCarrierBendAngleDegrees: maximum('carrierBendAngleDegrees'),
        });
    }

    function appendFloralEntity(commands, origin, entity, options) {
        const { seed, siteKey, index, bloomProgress, eventTime, floweringLoad } = options;
        const entityKey = `${seed}:${siteKey}:entity:${index}`;
        const birthEvent = options.birthEvent + zenG15OrganSample(seed, entityKey, 'birth') * 5;
        const age = resolveZenG15OrganAge(eventTime, birthEvent);
        const threshold = zenG15OrganSample(seed, entityKey, 'activation') * 0.8;
        const presence = age.extension * zenG15OrganRamp(floweringLoad / 1.2, threshold, 0.14);
        const progress = age.floralMaturity * clamp(bloomProgress
            + (randomUnit(entityKey, 'phase') - 0.5) * 0.18, 0, 1)
            * (options.forceBud ? 0.44 : 1);
        const stage = presence > 1e-6 ? stageFor(progress) : 'dormant';
        const direction = { x: Math.cos(entity.angle), y: Math.sin(entity.angle) };
        const reach = (0.18 + zenG15OrganRamp(progress, 0, 0.8) * 0.82) * age.extension;
        const center = pointAlong(origin, direction, entity.distance * reach);
        const normal = { x: -direction.y, y: direction.x };
        const control = {
            x: origin.x + direction.x * entity.distance * reach * 0.48 + normal.x * finite(entity.pedicelBend) * reach,
            y: origin.y + direction.y * entity.distance * reach * 0.48 + normal.y * finite(entity.pedicelBend) * reach,
        };
        const state = Object.freeze({ id: entityKey, birthEvent, stage, presence, progress,
            openFraction: zenG15OrganRamp(progress, 0.43, 0.1),
            center: Object.freeze(center) });
        if (stage === 'dormant') return state;
        const strokeScale = options.scale / FLOWER_PROJECTION_CONTRACT.referenceCameraScale;
        const firstCommand = commands.length;
        commands.push(commandLine([origin, control, center], '#7A666B', 0.6 * strokeScale));
        const bud = zenG15OrganRamp(progress, 0.19, 0.09);
        const open = zenG15OrganRamp(progress, 0.43, 0.1);
        const full = zenG15OrganRamp(progress, 0.66, 0.1);
        // Preserve the established eye/bud/open/full silhouette while blending
        // continuously: organ age controls opening, not a second size reduction.
        const eyeSize = 0.42 * FLOWER_DISPLAY_SCALE.flower_eye;
        const budSize = 0.62 * FLOWER_DISPLAY_SCALE.bud;
        const halfSize = 0.86 * FLOWER_DISPLAY_SCALE.half_open;
        const displayScale = eyeSize
            + (budSize - eyeSize) * bud
            + (halfSize - budSize) * open
            + (FLOWER_DISPLAY_SCALE.full - halfSize) * full;
        const size = entity.size * displayScale * FLOWER_SIZE_MULTIPLIER;
        const layers = [
            { weight: 1 - bud, paint: target => appendFlowerEye(target, center, entity.angle, size) },
            { weight: bud * (1 - open), paint: target => appendBud(target, center, entity.angle, size, entityKey) },
            { weight: open * (1 - full), paint: target => appendOpenFlower(target, center, size,
                { screenRoll: entity.screenRoll, facingYaw: entity.yaw, facingPitch: entity.pitch }, 'half_open', 0.48) },
            { weight: full, paint: target => appendOpenFlower(target, center, size,
                { screenRoll: entity.screenRoll, facingYaw: entity.yaw, facingPitch: entity.pitch }, 'full', entity.openness) },
        ];
        for (const layer of layers) {
            if (layer.weight <= 1e-6) continue;
            const marks = [];
            layer.paint(marks);
            commands.push(...marks.map(command => ({ ...command,
                alpha: (command.alpha === undefined ? 1 : command.alpha) * layer.weight,
                lineWidth: command.lineWidth === undefined ? undefined : command.lineWidth * strokeScale,
            })));
        }
        for (let i = firstCommand; i < commands.length; i += 1) {
            commands[i] = { ...commands[i], organId: entityKey,
                alpha: (commands[i].alpha === undefined ? 1 : commands[i].alpha) * presence };
        }
        return state;
    }

    function rosetteEntities(key, count, baseAngle, baseSize) {
        return Array.from({ length: count }, (_, index) => {
            const centered = count <= 1 ? 0 : index / (count - 1) - 0.5;
            const fan = centered * (1.6 + randomUnit(key, 'fan') * 0.7);
            const angle = baseAngle
                + fan
                + (randomUnit(key, `angle:${index}`) - 0.5) * 0.34;
            const pose = canonicalBlossomPose(angle, `${key}:entity:${index}`);
            return {
                angle,
                distance: 9 + randomUnit(key, `distance:${index}`) * 10.5,
                size: baseSize * (0.82 + randomUnit(key, `size:${index}`) * 0.34),
                yaw: pose.facingYaw,
                pitch: pose.facingPitch,
                screenRoll: pose.screenRoll,
                openness: [0.42, 0.68, 0.96][Math.floor(
                    randomUnit(key, `openness:${index}`) * 3
                )],
                phaseOffset: centered * 0.64,
            };
        });
    }

    function familyGeometry(site, familyKind, seed, scale) {
        const key = `${seed}:${site.key}:${familyKind}`;
        const side = randomUnit(key, 'side') > 0.5 ? 1 : -1;
        const releaseAngle = side * (0.42 + randomUnit(key, 'release') * 0.5);
        const releaseDirection = normalize(rotate(site.tangent, releaseAngle));
        const familyScale = 0.86 + randomUnit(key, 'family-scale') * 0.34;
        const projectionScale = resolveFlowerProjectionScale(scale);
        const baseSize = clamp(
            (7.1 + scale * 0.9) * familyScale * projectionScale,
            FLOWER_PROJECTION_CONTRACT.minimumEntityRadiusPx,
            8.8,
        );
        if (familyKind === 'direct_rosette') {
            return {
                spurPaths: [],
                rosettes: [{
                    origin: pointAlong(site.point, site.tangent, 1.5),
                    baseAngle: Math.atan2(site.tangent.y, site.tangent.x),
                    count: 5 + Math.floor(randomUnit(key, 'count') * 4),
                    baseSize,
                    forceBud: false,
                }],
            };
        }
        const firstLength = 7.5 + randomUnit(key, 'first-length') * 6.5;
        const secondLength = 7 + randomUnit(key, 'second-length') * 9;
        const middle = pointAlong(site.point, releaseDirection, firstLength);
        const secondDirection = normalize(rotate(
            releaseDirection,
            side * (randomUnit(key, 'bend') - 0.42) * 0.42,
        ));
        const end = pointAlong(middle, secondDirection, secondLength);
        if (familyKind === 'paired_spray') {
            const branchAngle = 0.38 + randomUnit(key, 'spray-angle') * 0.32;
            const leftDirection = rotate(secondDirection, -branchAngle);
            const rightDirection = rotate(secondDirection, branchAngle * 0.84);
            const left = pointAlong(middle, leftDirection, secondLength * 0.86);
            const right = pointAlong(middle, rightDirection, secondLength * 0.94);
            return {
                spurPaths: [[site.point, middle], [middle, left], [middle, right]],
                rosettes: [
                    {
                        origin: left,
                        baseAngle: Math.atan2(leftDirection.y, leftDirection.x),
                        count: 3 + Math.floor(randomUnit(key, 'left-count') * 3),
                        baseSize: baseSize * 0.93,
                        forceBud: false,
                    },
                    {
                        origin: right,
                        baseAngle: Math.atan2(rightDirection.y, rightDirection.x),
                        count: 3 + Math.floor(randomUnit(key, 'right-count') * 3),
                        baseSize: baseSize * 0.96,
                        forceBud: false,
                    },
                ],
            };
        }
        return {
            spurPaths: [[site.point, middle, end]],
            rosettes: [{
                origin: end,
                baseAngle: Math.atan2(secondDirection.y, secondDirection.x),
                count: familyKind === 'bud_chain'
                    ? 4
                    : 6 + Math.floor(randomUnit(key, 'count') * 5),
                baseSize: familyKind === 'bud_chain' ? baseSize * 0.72 : baseSize,
                forceBud: familyKind === 'bud_chain',
            }],
        };
    }

    function buildLegacyFamily(site, habit, options) {
        const familyKind = familyKindFor(site, habit, options.seed);
        const geometry = familyGeometry(site, familyKind, options.seed, options.scale);
        const layer = site.isCanopyTwig && site.entry.depthLayer !== 'middle_wood'
            ? site.entry.depthLayer
            : (randomUnit(options.seed, `${site.key}:depth-layer`) < 0.36
                ? 'behind_wood'
                : 'in_front_of_wood');
        const commands = [];
        geometry.spurPaths.forEach((path, index) => appendSpur(
            commands,
            path,
            Math.max(0.62, 1.08 - index * 0.12),
        ));
        const stageCounts = {
            flower_eye: 0,
            bud: 0,
            half_open: 0,
            full: 0,
        };
        let entityCount = 0;
        geometry.rosettes.forEach((rosette, rosetteIndex) => {
            const rosetteKey = `${options.seed}:${site.key}:rosette:${rosetteIndex}`;
            const entities = rosetteEntities(
                rosetteKey,
                rosette.count,
                rosette.baseAngle,
                rosette.baseSize,
            );
            entities.forEach((entity, entityIndex) => {
                const stage = appendFloralEntity(commands, rosette.origin, entity, {
                    seed: options.seed,
                    siteKey: `${site.key}:r${rosetteIndex}`,
                    index: entityIndex,
                    bloomProgress: options.bloomProgress,
                eventTime: options.eventTime, birthEvent: site.birthEvent,
                floweringLoad: options.floweringLoad, scale: options.scale,
                    forceBud: rosette.forceBud,
                });
                if (stage.stage !== 'dormant') stageCounts[stage.stage] += 1;
                entityCount += 1;
            });
        });
        return {
            id: `flower-family:${site.key}`,
            siteId: site.id,
            sourceSegmentId: site.entry.id,
            sourceLineageId: site.lineageId,
            sourceKind: site.kind,
            sourceCanopyTwig: site.isCanopyTwig,
            sourceCanopyCarrierId: site.canopyCarrierId,
            clusterId: site.clusterId,
            clusterAffinity: rounded(site.clusterAffinity),
            scaffoldFamilyTerminalLoadScale: rounded(
                site.scaffoldFamilyTerminalLoadScale,
            ),
            kind: familyKind,
            templateRole: null,
            layer,
            entityCount,
            rosetteCount: geometry.rosettes.length,
            spurSegmentCount: geometry.spurPaths.reduce(
                (total, path) => total + Math.max(0, path.length - 1),
                0,
            ),
            stageCounts,
            commands,
        };
    }

    function canonicalTemplatesForRole(role) {
        if (!Array.isArray(CANONICAL_CLUSTER_TEMPLATES)
            || CANONICAL_CLUSTER_TEMPLATES.length === 0) {
            throw new Error(
                '[G15_FLOWERING] Canonical Sakura cluster templates must load before flowering.',
            );
        }
        const templates = CANONICAL_CLUSTER_TEMPLATES.filter(
            (template) => template.roles.includes(role),
        );
        if (!templates.length) {
            throw new Error(`[G15_FLOWERING] No canonical cluster template owns role ${role}.`);
        }
        return templates;
    }

    function resolvePedicelAttachmentAngle(emergenceAngle, length, bend) {
        const tangentX = Math.cos(emergenceAngle);
        const tangentY = Math.sin(emergenceAngle);
        const normalX = -tangentY;
        const normalY = tangentX;
        return Math.atan2(
            tangentY * length * 0.48 - normalY * bend,
            tangentX * length * 0.48 - normalX * bend,
        );
    }

    function wovenClusterGeometry(site, options) {
        const key = `${options.seed}:${site.key}:woven-cluster`;
        const carrierScale = options.scale / FLOWER_PROJECTION_CONTRACT.referenceCameraScale;
        const role = site.clusterRole;
        const templates = canonicalTemplatesForRole(role);
        const template = templates[Math.floor(
            randomUnit(key, 'template') * templates.length,
        )];
        const side = randomUnit(key, 'carrier-side') > 0.5 ? 1 : -1;
        const terminalCarrier = site.kind === 'terminal_tip';
        const flowTangent = site.flowTangent || site.tangent;
        const familyPadAuthority = site.clusterPadTangent
            ? clamp(site.clusterAffinity * 0.18, 0, 0.18)
            : 0;
        const baselineTangent = familyPadAuthority > 0
            ? normalize({
                x: flowTangent.x * (1 - familyPadAuthority)
                    + site.clusterPadTangent.x * familyPadAuthority,
                y: flowTangent.y * (1 - familyPadAuthority)
                    + site.clusterPadTangent.y * familyPadAuthority,
            })
            : flowTangent;
        let carrierLength = terminalCarrier
            ? (3.2 + randomUnit(key, 'carrier-length') * 3.8)
            : (7.5 + randomUnit(key, 'carrier-length') * 6.5);
        // Grain flow alignment: release angle gently hugs the baseline branch tangent
        let releaseAngle = terminalCarrier
            ? side * (randomUnit(key, 'release') - 0.5) * 0.10
            : side * (0.14 + randomUnit(key, 'release') * 0.18);
        let releaseDirection = normalize(rotate(baselineTangent, releaseAngle));
        let middle = pointAlong(
            site.point,
            releaseDirection,
            carrierLength * (terminalCarrier ? 0.65 : 0.52),
        );
        let bendDirection = normalize(rotate(
            releaseDirection,
            side * (randomUnit(key, 'carrier-bend') - 0.48) * (terminalCarrier ? 0.08 : 0.16),
        ));
        let tipPoint = terminalCarrier
            ? pointAlong(site.point, releaseDirection, carrierLength)
            : pointAlong(middle, bendDirection, carrierLength * 0.48);

        const carrierPath = [site.point, middle, tipPoint].map(point => ({
            ...point,
            x: site.point.x + (point.x - site.point.x) * carrierScale,
            y: site.point.y + (point.y - site.point.y) * carrierScale,
        }));

        const baseAngle = Math.atan2(bendDirection.y, bendDirection.x);
        const templateMirror = randomUnit(key, 'template-mirror') < 0.5 ? -1 : 1;
        const templateTurn = (randomUnit(key, 'template-turn') - 0.5) * 0.10;
        const zoneScale = role === 'inner' ? 0.92 : (role === 'middle' ? 0.96 : 1);
        const pedicelLengthScale = role === 'inner'
            ? 0.85
            : (terminalCarrier ? 0.98 : 0.92);

        const slotCount = template.slots.length;
        const entities = template.slots.map((slot, slotIndex) => {
            const slotKey = `${key}:slot:${slotIndex}`;
            const progressAlongSpur = slotCount <= 1
                ? 0.7
                : 0.25 + (slotIndex / (slotCount - 1)) * 0.75;
            const stationOrigin = pointOnPolyline(carrierPath, progressAlongSpur);
            // Template-local fan damping follows the already resolved carrier grain.
            const bendDamping = terminalCarrier ? 0.42 : 0.76;
            const angleDamping = terminalCarrier ? 0.55 : 0.72;
            const angle = baseAngle
                + slot.pedicelAngleOffset * angleDamping * templateMirror
                + templateTurn
                + (randomUnit(slotKey, 'angle') - 0.5) * 0.05;
            const length = slot.pedicelLength
                * pedicelLengthScale
                * (0.92 + randomUnit(slotKey, 'length') * 0.12);
            const bend = slot.pedicelBend
                * bendDamping
                * templateMirror
                * (0.88 + randomUnit(slotKey, 'bend') * 0.24);
            const budChance = role === 'inner' ? 0.35 : (role === 'tip' ? 0.18 : 0.25);
            const attachmentAngle = resolvePedicelAttachmentAngle(angle, length, bend);
            const pose = canonicalBlossomPose(attachmentAngle, slotKey);
            return {
                origin: stationOrigin,
                angle,
                distance: length * carrierScale,
                pedicelBend: bend * carrierScale,
                attachmentAngle,
                screenRoll: pose.screenRoll,
                // Calibrate the original template radius at the reference
                // camera, then project once. These bounds are reference units,
                // not screen-pixel floors that enlarge flowers on a small tree.
                size: clamp(
                    (14.6 + FLOWER_PROJECTION_CONTRACT.referenceCameraScale * 0.8)
                        * slot.scale * zoneScale
                        * (0.94 + randomUnit(slotKey, 'size') * 0.12),
                    FLOWER_PROJECTION_CONTRACT.minimumEntityRadiusPx,
                    FLOWER_PROJECTION_CONTRACT.maximumEntityRadiusPx,
                ) * carrierScale,
                yaw: pose.facingYaw,
                pitch: pose.facingPitch,
                openness: slot.openness,
                phaseOffset: (slot.openness - 0.68) * 0.34,
                forceBud: Boolean(
                    slot.budAllowed && randomUnit(slotKey, 'bud-admission') < budChance
                ),
            };
        });
        return {
            role,
            template,
            carrierPath,
            entities,
            continuity: Object.freeze({
                terminalCarrier,
                localToFlowAngleDegrees: rounded(
                    directionAngle(site.tangent, baselineTangent) * 180 / Math.PI,
                    3,
                ),
                carrierReleaseAngleDegrees: rounded(
                    directionAngle(baselineTangent, releaseDirection) * 180 / Math.PI,
                    3,
                ),
                carrierBendAngleDegrees: rounded(
                    directionAngle(releaseDirection, bendDirection) * 180 / Math.PI,
                    3,
                ),
            }),
        };
    }

    function buildWovenTemplateFamily(site, options) {
        const geometry = wovenClusterGeometry(site, options);
        const familyAge = resolveZenG15OrganAge(options.eventTime, site.birthEvent - 6);
        const origin = geometry.carrierPath[0];
        const unfold = point => ({ ...point,
            x: origin.x + (point.x - origin.x) * familyAge.extension,
            y: origin.y + (point.y - origin.y) * familyAge.extension,
        });
        geometry.carrierPath = geometry.carrierPath.map(unfold);
        geometry.entities = geometry.entities.map(entity => ({ ...entity, origin: unfold(entity.origin) }));
        const layer = site.isCanopyTwig && site.entry.depthLayer !== 'middle_wood'
            ? site.entry.depthLayer
            : (randomUnit(options.seed, `${site.key}:depth-layer`) < 0.42
                ? 'behind_wood'
                : 'in_front_of_wood');
        const commands = [];
        if (familyAge.extension > 0) {
            appendSpur(
                commands,
                geometry.carrierPath,
                (site.isCanopyTwig ? 0.72 : 0.95) * familyAge.girth * options.scale / 0.64,
            );
        }
        const spurCommandCount = commands.length;
        const stageCounts = { flower_eye: 0, bud: 0, half_open: 0, full: 0 };
        const organStates = [];
        geometry.entities.forEach((entity, entityIndex) => {
            const stage = appendFloralEntity(commands, entity.origin, entity, {
                seed: options.seed,
                siteKey: `${site.key}:${geometry.template.id}`,
                index: entityIndex,
                bloomProgress: options.bloomProgress,
                eventTime: options.eventTime, birthEvent: site.birthEvent,
                floweringLoad: options.floweringLoad, scale: options.scale,
                forceBud: entity.forceBud,
            });
            if (stage.stage !== 'dormant') stageCounts[stage.stage] += 1;
            organStates.push(stage);
        });
        for (let index = 0; index < spurCommandCount; index += 1) {
            commands[index] = { ...commands[index],
                alpha: familyAge.girth,
            };
        }
        return {
            id: `flower-family:${site.key}`,
            siteId: site.id,
            sourceSegmentId: site.entry.id,
            sourceLineageId: site.lineageId,
            sourceKind: site.kind,
            sourceCanopyTwig: site.isCanopyTwig,
            sourceCanopyCarrierId: site.canopyCarrierId,
            clusterId: site.clusterId,
            clusterAffinity: rounded(site.clusterAffinity),
            scaffoldFamilyTerminalLoadScale: rounded(
                site.scaffoldFamilyTerminalLoadScale,
            ),
            kind: geometry.template.id,
            templateRole: geometry.role,
            layer,
            birthEvent: site.birthEvent,
            anchorPoint: Object.freeze({ ...site.point }),
            restAnchorPoint: Object.freeze({ ...site.restPoint }),
            organStates: Object.freeze(organStates),
            entityCount: organStates.filter(organ => organ.stage !== 'dormant').length,
            rosetteCount: 1,
            spurSegmentCount: Math.max(0, geometry.carrierPath.length - 1),
            continuity: geometry.continuity,
            stageCounts,
            commands,
        };
    }

    function buildVegetativeFamily(site, options) {
        const age = resolveZenG15OrganAge(options.eventTime, site.birthEvent);
        const length = (2.4 + randomUnit(site.key, 'vegetative-size') * 1.5)
            * options.scale / 0.64 * age.extension;
        const tangent = normalize(rotate(site.tangent, 0.32));
        const side = { x: -tangent.y, y: tangent.x };
        const tip = pointAlong(site.point, tangent, length);
        const middle = pointAlong(site.point, tangent, length * 0.55);
        const dryness = clamp(options.dryness, 0, 1);
        const channel = (fresh, dry) => Math.round(fresh + (dry - fresh) * dryness);
        const tone = `rgb(${channel(106, 119)},${channel(128, 99)},${channel(84, 76)})`;
        const commands = age.extension > 0 ? [{ ...commandPolygon([
            site.point, pointAlong(middle, side, length * 0.27), tip,
            pointAlong(middle, side, -length * 0.27),
        ], tone), alpha: age.extension, organId: `${site.key}:vegetative` }] : [];
        return {
            id: `flower-family:${site.key}`, siteId: site.id,
            sourceSegmentId: site.entry.id, sourceLineageId: site.lineageId,
            sourceKind: site.kind, sourceCanopyTwig: site.isCanopyTwig,
            sourceCanopyCarrierId: site.canopyCarrierId,
            scaffoldFamilyTerminalLoadScale: site.scaffoldFamilyTerminalLoadScale,
            clusterId: null, clusterAffinity: 0, kind: 'vegetative_bud', templateRole: 'vegetative',
            birthEvent: site.birthEvent, anchorPoint: site.point, restAnchorPoint: site.restPoint,
            organStates: Object.freeze([{ id: `${site.key}:vegetative`, birthEvent: site.birthEvent,
                stage: age.extension > 0 ? 'vegetative_bud' : 'dormant', presence: age.extension,
                center: tip }]),
            layer: 'in_front_of_wood', entityCount: 0,
            vegetativeBudCount: age.extension > 0 ? 1 : 0,
            rosetteCount: 0, spurSegmentCount: 0, continuity: null,
            stageCounts: { flower_eye: 0, bud: 0, half_open: 0, full: 0 }, commands,
        };
    }

    function buildFamily(site, habit, options) {
        if (site.organKind === 'vegetative_bud') return buildVegetativeFamily(site, options);
        if (options.clusterGrammar === 'legacy_floral_families') {
            return buildLegacyFamily(site, habit, options);
        }
        if (options.clusterGrammar !== 'terminal_lab_woven_templates') {
            throw new Error(
                `[G15_FLOWERING] Unknown flower cluster grammar ${options.clusterGrammar}.`,
            );
        }
        return buildWovenTemplateFamily(site, options);
    }

    function siteDebugCommands(sites) {
        return sites.flatMap((site) => [
            commandCircle(site.point, 3.2, 'rgba(206, 160, 168, 0.12)', '#CFA0A6', 0.8),
            commandLine([
                site.point,
                pointAlong(site.point, site.tangent, 8),
            ], 'rgba(216, 175, 179, 0.72)', 0.75),
        ]);
    }

    function terminalLabStage(organ, bloomProgress, seed) {
        if (organ.kind === 'bud') return 'bud';
        const localProgress = clamp(
            bloomProgress
                + (randomUnit(seed, `${organ.id}:phase`) - 0.5) * 0.52
                + (finite(organ.openness, 0.68) - 0.68) * 0.2,
            0,
            1,
        );
        return stageFor(localProgress);
    }

    function terminalLabOrganCommands(organ, options) {
        const commands = [];
        const stage = terminalLabStage(
            organ,
            options.bloomProgress,
            options.seed,
        );
        const base = {
            x: finite(organ.base?.x),
            y: finite(organ.base?.y),
        };
        const control = {
            x: finite(organ.control?.x),
            y: finite(organ.control?.y),
        };
        const end = {
            x: finite(organ.end?.x),
            y: finite(organ.end?.y),
        };
        const appearanceScale = stage === 'flower_eye'
            ? 0.48
            : (stage === 'bud' ? 0.68 : (stage === 'half_open' ? 0.88 : 1));
        const visibleEnd = mixPoint(base, end, appearanceScale);
        const visibleControl = mixPoint(base, control, appearanceScale);
        appendSpur(commands, [base, visibleControl, visibleEnd], 0.62);
        commands.push(commandCircle(visibleEnd, 1.25, '#5C564A'));
        const size = clamp(
            (7.6 + options.scale * 0.8)
                * (0.86 + finite(organ.scale, 0.46) * 0.32)
                * resolveFlowerProjectionScale(options.scale),
            FLOWER_PROJECTION_CONTRACT.minimumEntityRadiusPx,
            8.8,
        ) * appearanceScale * FLOWER_DISPLAY_SCALE[stage] * FLOWER_SIZE_MULTIPLIER;
        const angle = finite(
            organ.pose?.screenRoll,
            organ.pedicel?.attachmentAngle,
        );
        if (stage === 'flower_eye') {
            appendFlowerEye(commands, visibleEnd, angle, size);
        } else if (stage === 'bud') {
            appendBud(commands, visibleEnd, angle, size, `${options.seed}:${organ.id}`);
        } else {
            appendOpenFlower(commands, visibleEnd, size, {
                screenRoll: angle,
                facingYaw: finite(organ.pose?.facingYaw),
                facingPitch: finite(organ.pose?.facingPitch),
            }, stage, organ.openness);
        }
        return { commands, stage };
    }

    function buildSakuraTerminalLabFlowerPresentation(options = {}) {
        const terminalMorphology = options.terminalMorphology;
        if (!terminalMorphology || !Array.isArray(terminalMorphology.organs)) {
            throw new TypeError(
                '[G15_FLOWERING] Terminal Lab presentation requires adapter organs.',
            );
        }
        const seed = options.seed ?? terminalMorphology.seed ?? 'unseeded';
        const bloomProgress = clamp(finite(options.bloomProgress, 0.84), 0, 1);
        const buildOptions = {
            seed,
            bloomProgress,
            scale: Math.max(0.1, finite(options.scale, 1)),
        };
        const layers = {
            behind_wood: [],
            in_front_of_wood: [],
        };
        const stageCounts = { flower_eye: 0, bud: 0, half_open: 0, full: 0 };
        const familyMap = new Map();
        terminalMorphology.organs.forEach((organ) => {
            const result = terminalLabOrganCommands(organ, buildOptions);
            stageCounts[result.stage] += 1;
            const layer = organ.depthLane === 'back'
                ? 'behind_wood'
                : 'in_front_of_wood';
            const stampedCommands = result.commands.map((command) => (
                organ.sourceLineageId == null
                    ? command
                    : { ...command, sourceLineageId: organ.sourceLineageId }
            ));
            layers[layer].push(...stampedCommands);
            if (!familyMap.has(organ.clusterId)) {
                familyMap.set(organ.clusterId, {
                    id: organ.clusterId,
                    socketId: organ.socketId,
                    sourceNodeId: organ.sourceNodeId,
                    sourceLineageId: organ.sourceLineageId,
                    templateId: organ.templateId,
                    templateRole: organ.templateRole,
                    zone: organ.zone,
                    depthLane: organ.depthLane,
                    entityCount: 0,
                    stageCounts: { flower_eye: 0, bud: 0, half_open: 0, full: 0 },
                });
            }
            const family = familyMap.get(organ.clusterId);
            family.entityCount += 1;
            family.stageCounts[result.stage] += 1;
        });
        const families = [...familyMap.values()].map((family) => Object.freeze({
            ...family,
            stageCounts: Object.freeze({ ...family.stageCounts }),
        }));
        const debugCommands = terminalMorphology.organs.flatMap((organ) => [
            commandCircle(organ.base, 2.6, 'rgba(210, 168, 175, 0.1)', '#CFA0A6', 0.7),
            commandLine([organ.base, organ.end], 'rgba(218, 180, 186, 0.58)', 0.58),
        ]);
        const projectedAtlasCounts = summarizeProjectedAtlas([
            ...layers.behind_wood,
            ...layers.in_front_of_wood,
        ]);
        return Object.freeze({
            contractId: CONTRACT_ID,
            semantics: 'canonical_terminal_lab_cluster_projected_atlas_v2',
            sourceAdapterContractId: terminalMorphology.contractId,
            sourceLabPlanContract: terminalMorphology.labPlanContract,
            layer: 'detachable_completed_graph_terminal_lab_flowering',
            habit: 'terminal_lab_socket_morphology',
            bloomProgress,
            floweringLoad: finite(options.floweringLoad, 1.2),
            flowerSizeMultiplier: FLOWER_SIZE_MULTIPLIER,
            flowerDisplayScale: FLOWER_DISPLAY_SCALE,
            flowerProjection: Object.freeze({
                ...FLOWER_PROJECTION_CONTRACT,
                cameraScale: rounded(buildOptions.scale),
                resolvedProjectionScale: rounded(
                    resolveFlowerProjectionScale(buildOptions.scale),
                ),
            }),
            coverageCompletion: Object.freeze({
                contractId: 'g15_terminal_lab_socket_coverage_v1',
                active: false,
                reason: 'terminal_lab_adapter_owns_socket_coverage',
            }),
            candidateCount: terminalMorphology.candidateCount,
            budgetBasisEntryCount: terminalMorphology.socketCount,
            targetSiteCount: terminalMorphology.clusterCount,
            targetCanopyTwigShare: 1,
            targetCanopyTwigSiteCount: terminalMorphology.clusterCount,
            siteCount: terminalMorphology.clusterCount,
            canopyTwigSiteCount: terminalMorphology.clusterCount,
            structuralSiteCount: 0,
            familyCount: families.length,
            entityCount: terminalMorphology.organs.length,
            rosetteCount: families.length,
            spurSegmentCount: terminalMorphology.spurCount,
            stageCounts: Object.freeze(stageCounts),
            projectedAtlasContract: 'sakura_projected_blossom_3x4_atlas_v1',
            projectedAtlasCounts,
            projectedBlossomCount: Object.values(projectedAtlasCounts).reduce(
                (total, count) => total + count,
                0,
            ),
            familyKindCounts: terminalMorphology.clusterTemplateUsage,
            clusterZoneUsage: terminalMorphology.clusterZoneUsage,
            backCommands: Object.freeze(layers.behind_wood),
            frontCommands: Object.freeze(layers.in_front_of_wood),
            debugCommands: Object.freeze(debugCommands),
            families: Object.freeze(families),
        });
    }

    function buildSakuraFloweringPresentation(options = {}) {
        const entries = (options.entries || []).map(normalizeEntry);
        if (!entries.length) {
            return Object.freeze({
                contractId: CONTRACT_ID,
                backCommands: Object.freeze([]),
                frontCommands: Object.freeze([]),
                debugCommands: Object.freeze([]),
                families: Object.freeze([]),
                siteCount: 0,
                canopyTwigSiteCount: 0,
                structuralSiteCount: 0,
                budgetedSiteCount: 0,
                accessorySiteCount: 0,
                floralCompletion: Object.freeze({
                    semantics: FLORAL_COMPLETION_SEMANTICS,
                    terminalCandidateCount: 0,
                    terminalCompletionCount: 0,
                    bareTerminalCount: 0,
                    junctionCandidateCount: 0,
                    junctionAccentTarget: 0,
                    junctionAccentCount: 0,
                }),
                entityCount: 0,
                spurSegmentCount: 0,
                stageCounts: Object.freeze({ flower_eye: 0, bud: 0, half_open: 0, full: 0 }),
            });
        }
        const seed = options.seed ?? 'unseeded';
        const candidatePlan = buildCandidates(entries, seed);
        const { candidates } = candidatePlan;
        const selection = selectSites(candidates, entries, seed);
        if (!Number.isFinite(options.scale) || options.scale <= 0) {
            throw new Error('ZEN_G15_ORGAN_PROJECTION_SCALE_REQUIRED');
        }
        const buildOptions = {
            seed,
            eventTime: options.eventTime,
            dryness: options.dryness,
            floweringLoad: options.floweringLoad,
            scale: options.scale,
            bloomProgress: clamp(finite(options.bloomProgress, 0.84), 0, 1),
            clusterGrammar: options.clusterGrammar || 'terminal_lab_woven_templates',
        };
        const floralCompletion = resolveFloralCompletion(candidates, selection.sites);
        const families = selection.sites.filter(site => site.entry.carrierAvailable).map(
            (site) => buildFamily(site, selection.habit, buildOptions),
        );
        const coveredCanopyCarriers = new Set(families
            .map((family) => family.sourceCanopyCarrierId)
            .filter(Boolean));
        // Each mark carries the lineage of the wood it grows on, so the scene
        // can put a blossom on the same rig part as the branch holding it.
        // Without that a limb would sway out from under its own flowers.
        const stampLineage = (family) => family.commands.map((command) => (
            family.sourceLineageId === undefined || family.sourceLineageId === null
                ? command
                : { ...command, sourceLineageId: family.sourceLineageId }
        ));
        const backCommands = families
            .filter((family) => family.layer === 'behind_wood')
            .flatMap(stampLineage);
        const frontCommands = families
            .filter((family) => family.layer === 'in_front_of_wood')
            .flatMap(stampLineage);
        const stageCounts = families.reduce((total, family) => {
            Object.keys(total).forEach((stage) => {
                total[stage] += family.stageCounts[stage];
            });
            return total;
        }, { flower_eye: 0, bud: 0, half_open: 0, full: 0 });
        const projectedAtlasCounts = summarizeProjectedAtlas([
            ...backCommands,
            ...frontCommands,
        ]);
        return Object.freeze({
            contractId: CONTRACT_ID,
            semantics: buildOptions.clusterGrammar === 'terminal_lab_woven_templates'
                ? 'causal_real_wood_organs_projected_atlas_sakura_v3'
                : 'real_wood_anchored_mixed_spur_projected_atlas_sakura_v2',
            layer: 'detachable_developing_graph_organs',
            habit: selection.habit.id,
            clusterGrammar: buildOptions.clusterGrammar,
            bloomProgress: buildOptions.bloomProgress,
            floweringLoad: clamp(finite(options.floweringLoad, 1.2), 0, 1.6),
            flowerSizeMultiplier: FLOWER_SIZE_MULTIPLIER,
            flowerDisplayScale: FLOWER_DISPLAY_SCALE,
            flowerProjection: Object.freeze({
                id: 'world_relative_bloom_projection_v2',
                referenceCameraScale: FLOWER_PROJECTION_CONTRACT.referenceCameraScale,
                cameraScale: rounded(buildOptions.scale),
                resolvedProjectionScale: rounded(
                    buildOptions.scale / FLOWER_PROJECTION_CONTRACT.referenceCameraScale,
                ),
            }),
            coverageCompletion: candidatePlan.coverageCompletion,
            floralCompletion: Object.freeze({
                semantics: floralCompletion.semantics,
                authority: floralCompletion.authority,
                createsWood: floralCompletion.createsWood,
                changesGrowthResources: floralCompletion.changesGrowthResources,
                terminalCandidateCount: floralCompletion.terminalCandidateCount,
                primaryTerminalCount: floralCompletion.primaryTerminalCount,
                terminalCompletionCount: floralCompletion.terminalCompletionCount,
                bareTerminalCount: floralCompletion.bareTerminalCount,
                structuralTerminalCompletionCount:
                    floralCompletion.structuralTerminalCompletionCount,
                canopyTwigTerminalCompletionCount:
                    floralCompletion.canopyTwigTerminalCompletionCount,
                junctionCandidateCount: floralCompletion.junctionCandidateCount,
                junctionAccentTarget: floralCompletion.junctionAccentTarget,
                junctionAccentCount: floralCompletion.junctionAccentCount,
            }),
            carrierContinuity: summarizeCarrierContinuity(families),
            candidateCount: candidates.length,
            junctionCandidateCount: candidatePlan.junctionCandidates.length,
            budgetBasisEntryCount: rounded(selection.budgetBasis),
            targetSiteCount: selection.target,
            targetCanopyTwigShare: rounded(selection.volumeShare),
            targetCanopyTwigSiteCount: selection.volumeTarget,
            canopyCarrierCoverage: Object.freeze({
                carrierCount: selection.canopyCarrierCount,
                coveredCarrierCount: coveredCanopyCarriers.size,
                bareCarrierCount: Math.max(
                    0,
                    selection.canopyCarrierCount - coveredCanopyCarriers.size,
                ),
                sampledBudgetShare: rounded(selection.sampledVolumeShare),
                realizedBudgetShare: rounded(selection.volumeShare),
            }),
            reservedSiteCount: selection.sites.length,
            siteCount: families.filter(family => family.entityCount > 0 || family.vegetativeBudCount > 0).length,
            budgetedSiteCount: families.filter(family => family.entityCount > 0).length,
            accessorySiteCount: 0,
            canopyTwigSiteCount: selection.sites.filter((site) => site.isCanopyTwig).length,
            structuralSiteCount: selection.sites.filter((site) => !site.isCanopyTwig).length,
            familyCount: families.length,
            entityCount: families.reduce((total, family) => total + family.entityCount, 0),
            vegetativeBudCount: families.reduce((total, family) => total + (family.vegetativeBudCount || 0), 0),
            rosetteCount: families.reduce((total, family) => total + family.rosetteCount, 0),
            spurSegmentCount: families.reduce(
                (total, family) => total + family.spurSegmentCount,
                0,
            ),
            stageCounts: Object.freeze(stageCounts),
            projectedAtlasContract: 'sakura_projected_blossom_3x4_atlas_v1',
            projectedAtlasCounts,
            projectedBlossomCount: Object.values(projectedAtlasCounts).reduce(
                (total, count) => total + count,
                0,
            ),
            familyKindCounts: Object.freeze(families.reduce((counts, family) => {
                counts[family.kind] = (counts[family.kind] || 0) + 1;
                return counts;
            }, {})),
            scaffoldFamilyDominance: Object.freeze({
                attenuatedFamilyCount: families.filter((family) => (
                    family.scaffoldFamilyTerminalLoadScale < 1
                )).length,
                minimumTerminalLoadScale: rounded(Math.min(
                    1,
                    ...families.map(
                        (family) => family.scaffoldFamilyTerminalLoadScale,
                    ),
                )),
            }),
            backCommands: Object.freeze(backCommands),
            frontCommands: Object.freeze(frontCommands),
            debugCommands: Object.freeze(siteDebugCommands(selection.sites)),
            families: Object.freeze(families.map((family) => Object.freeze({
                id: family.id,
                birthEvent: family.birthEvent,
                anchorPoint: family.anchorPoint,
                restAnchorPoint: family.restAnchorPoint,
                organStates: family.organStates,
                vegetativeBudCount: family.vegetativeBudCount || 0,
                siteId: family.siteId,
                sourceSegmentId: family.sourceSegmentId,
                sourceLineageId: family.sourceLineageId,
                sourceKind: family.sourceKind,
                sourceCanopyTwig: family.sourceCanopyTwig,
                sourceCanopyCarrierId: family.sourceCanopyCarrierId,
                clusterId: family.clusterId,
                clusterAffinity: family.clusterAffinity,
                scaffoldFamilyTerminalLoadScale:
                    family.scaffoldFamilyTerminalLoadScale,
                kind: family.kind,
                templateRole: family.templateRole,
                completionReason: family.completionReason ?? null,
                layer: family.layer,
                entityCount: family.entityCount,
                rosetteCount: family.rosetteCount,
                spurSegmentCount: family.spurSegmentCount,
                continuity: family.continuity ?? null,
                stageCounts: Object.freeze({ ...family.stageCounts }),
            }))),
        });
    }

    scope.ZenBonsaiTypedDevelopmentalSchedulerSakuraFlowering = Object.freeze({
        contractId: CONTRACT_ID,
        flowerProjectionContract: FLOWER_PROJECTION_CONTRACT,
        buildSakuraFloweringPresentation,
        buildSakuraTerminalLabFlowerPresentation,
    });
}(globalThis));
