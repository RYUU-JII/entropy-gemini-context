/**
 * Pure scene-command owner for the G15.4 Typed Developmental Scheduler lab.
 *
 * This module owns every graph-to-image decision. Browser Canvas2D and Node
 * diagnostics consume the same JSON-serializable commands; neither renderer is
 * allowed to reinterpret the graph or choose paint geometry independently.
 */
import { projectZenG15GrowthGeometry } from './ZenBonsaiG15GrowthGeometry.js';

(function installRecursiveAxisScene(scope) {
    'use strict';

    const CONTRACT_ID = 'g15_4_typed_developmental_scheduler_shared_scene_commands_v9';
    const ontogenyOwner = scope.ZenBonsaiTypedDevelopmentalSchedulerOntogeny;
    const woodPresentationOwner = scope
        .ZenBonsaiTypedDevelopmentalSchedulerWoodPresentation;
    const canopyTwigVolumeOwner = scope
        .ZenBonsaiTypedDevelopmentalSchedulerCanopyTwigVolume;
    const terminalLabAdapterOwner = scope
        .ZenBonsaiTypedDevelopmentalSchedulerSakuraTerminalLabAdapter;
    const sakuraFloweringOwner = scope
        .ZenBonsaiTypedDevelopmentalSchedulerSakuraFlowering;
    const nebariOwner = scope
        .ZenBonsaiNebariPresentation;
    const pixiPartitionerOwner = scope
        .ZenBonsaiPixiBakingPartitioner;
    const MODES = Object.freeze(['natural', 'tier', 'lineage', 'causal']);
    const CAMERA_FIT_MODES = Object.freeze({
        CONTAIN: 'contain',
        ROOTED_ABOVE_GROUND: 'rooted_above_ground',
    });
    const CAMERA_FIT_MODE_VALUES = new Set(Object.values(CAMERA_FIT_MODES));
    const HORIZONTAL_COMPOSITION_MODES = Object.freeze({
        STRUCTURAL_MASS: 'structural_mass',
    });
    const HORIZONTAL_COMPOSITION_MODE_VALUES = new Set(
        Object.values(HORIZONTAL_COMPOSITION_MODES),
    );
    const DEFAULT_YAW = 0.24;
    const DEPTH_LIFT = 0.065;
    const TIER_COLORS = Object.freeze([
        '#e5b84f',
        '#49c4ad',
        '#b58be3',
    ]);
    const NATURAL_COLORS = Object.freeze([
        '#74503a',
        '#8e6547',
        '#a77b56',
    ]);
    const LINEAGE_COLORS = Object.freeze([
        '#efc86d', '#57c9e8', '#ef7890', '#a18cf0', '#56d29a',
        '#ed954f', '#df78bc', '#4dcec3', '#d6bf4d', '#7c91e7',
        '#d87968', '#7abd70', '#e7a56b', '#64aedc', '#c887dc',
        '#8dcf98', '#e06e9b', '#73c9d2',
    ]);

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

    function numericSequence(item, fallback = 0) {
        return finite(
            item?.sequence
                ?? item?.birthEvent
                ?? item?.registeredAtEvent,
            fallback,
        );
    }

    function pointOf(node) {
        const point = node?.point ?? node?.position ?? node;
        if (
            !point
            || !Number.isFinite(Number(point.x))
            || !Number.isFinite(Number(point.y))
            || !Number.isFinite(Number(point.z ?? 0))
        ) {
            throw new TypeError(
                `[G15_SCENE] Invalid 3D point on ${node?.id ?? 'anonymous node'}.`,
            );
        }
        return {
            x: Number(point.x),
            y: Number(point.y),
            z: Number(point.z ?? 0),
        };
    }

    function assertGraph(graph) {
        if (!graph || typeof graph !== 'object') {
            throw new TypeError('[G15_SCENE] A graph object is required.');
        }
        if (!Array.isArray(graph.nodes) || !Array.isArray(graph.segments)) {
            throw new TypeError('[G15_SCENE] graph.nodes and graph.segments are required arrays.');
        }
        graph.nodes.forEach(pointOf);
    }

    function projectPoint(point, yaw = DEFAULT_YAW) {
        const source = pointOf(point);
        const cosine = Math.cos(finite(yaw, DEFAULT_YAW));
        const sine = Math.sin(finite(yaw, DEFAULT_YAW));
        const x = source.x * cosine - source.z * sine;
        const depth = source.x * sine + source.z * cosine;
        return Object.freeze({
            x: rounded(x, 6),
            y: rounded(source.y + depth * DEPTH_LIFT, 6),
            depth: rounded(depth, 6),
        });
    }

    function normalizeGraphs(graphsOrOptions, possibleOptions) {
        if (
            graphsOrOptions
            && !Array.isArray(graphsOrOptions)
            && Array.isArray(graphsOrOptions.graphs)
            && !Array.isArray(graphsOrOptions.nodes)
        ) {
            return {
                graphs: graphsOrOptions.graphs,
                options: graphsOrOptions,
            };
        }
        return {
            graphs: Array.isArray(graphsOrOptions)
                ? graphsOrOptions
                : [graphsOrOptions],
            options: possibleOptions || {},
        };
    }

    /**
     * Resolves projected world bounds. Passing several graphs produces a
     * common-camera contract suitable for a comparable seed/form matrix.
     */
    function resolveCameraBounds(graphsOrOptions, possibleOptions = {}) {
        const normalized = normalizeGraphs(graphsOrOptions, possibleOptions);
        const graphs = normalized.graphs.filter(Boolean);
        const options = normalized.options;
        if (!graphs.length) {
            throw new TypeError('[G15_SCENE] resolveCameraBounds requires at least one graph.');
        }
        graphs.forEach(assertGraph);
        const yaw = finite(options.yaw, DEFAULT_YAW);
        const projected = [];
        graphs.forEach((graph) => {
            graph.nodes.forEach((node) => projected.push(projectPoint(node, yaw)));
        });
        if (options.includePot !== false) {
            projected.push(projectPoint({ x: -38, y: -34, z: 0 }, yaw));
            projected.push(projectPoint({ x: 38, y: -34, z: 0 }, yaw));
            projected.push(projectPoint({ x: 0, y: 4, z: 0 }, yaw));
        }
        if (!projected.length) {
            projected.push(projectPoint({ x: 0, y: 0, z: 0 }, yaw));
        }
        let minX = Math.min(...projected.map((point) => point.x));
        let maxX = Math.max(...projected.map((point) => point.x));
        let minY = Math.min(...projected.map((point) => point.y));
        let maxY = Math.max(...projected.map((point) => point.y));
        const minimumSpanX = Math.max(1, finite(options.minimumSpanX, 110));
        const minimumSpanY = Math.max(1, finite(options.minimumSpanY, 180));
        if (maxX - minX < minimumSpanX) {
            const center = (minX + maxX) / 2;
            minX = center - minimumSpanX / 2;
            maxX = center + minimumSpanX / 2;
        }
        if (maxY - minY < minimumSpanY) {
            const center = (minY + maxY) / 2;
            minY = center - minimumSpanY / 2;
            maxY = center + minimumSpanY / 2;
        }
        const paddingRatio = clamp(finite(options.paddingRatio, 0.055), 0, 0.4);
        const paddingWorld = Math.max(0, finite(options.paddingWorld, 5));
        const padX = (maxX - minX) * paddingRatio + paddingWorld;
        const padY = (maxY - minY) * paddingRatio + paddingWorld;
        return Object.freeze({
            kind: 'g15_projected_world_bounds_v1',
            minX: rounded(minX - padX, 6),
            maxX: rounded(maxX + padX, 6),
            minY: rounded(minY - padY, 6),
            maxY: rounded(maxY + padY, 6),
            yaw: rounded(yaw, 8),
            sourceGraphCount: graphs.length,
        });
    }

    function normalizeBounds(bounds, yaw) {
        const minX = finite(bounds?.minX ?? bounds?.minimumX, NaN);
        const maxX = finite(bounds?.maxX ?? bounds?.maximumX, NaN);
        const minY = finite(bounds?.minY ?? bounds?.minimumY, NaN);
        const maxY = finite(bounds?.maxY ?? bounds?.maximumY, NaN);
        if (
            ![minX, maxX, minY, maxY].every(Number.isFinite)
            || maxX <= minX
            || maxY <= minY
        ) {
            throw new TypeError('[G15_SCENE] cameraBounds must contain increasing min/max axes.');
        }
        if (
            Number.isFinite(Number(bounds?.yaw))
            && Math.abs(Number(bounds.yaw) - yaw) > 1e-7
        ) {
            throw new Error('[G15_SCENE] cameraBounds yaw must match the requested yaw.');
        }
        return {
            kind: bounds?.kind || 'g15_projected_world_bounds_v1',
            minX,
            maxX,
            minY,
            maxY,
            yaw,
            sourceGraphCount: Math.max(1, Math.round(finite(bounds?.sourceGraphCount, 1))),
        };
    }

    function resolvePadding(width, height, option) {
        if (typeof option === 'number') {
            const amount = clamp(option, 0, Math.min(width, height) * 0.35);
            return { left: amount, right: amount, top: amount, bottom: amount };
        }
        const horizontal = clamp(width * 0.075, 12, 76);
        const top = clamp(height * 0.07, 12, 66);
        const bottom = clamp(height * 0.08, 12, 74);
        return {
            left: clamp(finite(option?.left, horizontal), 0, width * 0.4),
            right: clamp(finite(option?.right, horizontal), 0, width * 0.4),
            top: clamp(finite(option?.top, top), 0, height * 0.4),
            bottom: clamp(finite(option?.bottom, bottom), 0, height * 0.4),
        };
    }

    function resolveProjectedStructuralMass(graph, yaw) {
        const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
        let weightedX = 0;
        let totalWeight = 0;
        let segmentCount = 0;
        graph.segments.forEach((segment) => {
            const from = nodeMap.get(segment.fromNodeId);
            const to = nodeMap.get(segment.toNodeId);
            if (!from || !to) {
                throw new Error(
                    `[G15_SCENE] Structural mass segment ${segment.id ?? '<anonymous>'} references a missing node.`,
                );
            }
            const start = projectPoint(from, yaw);
            const end = projectPoint(to, yaw);
            const length = Math.hypot(end.x - start.x, end.y - start.y);
            const tier = clamp(Math.round(finite(
                segment.tier ?? segment.axisOrder ?? segment.structuralTier,
                0,
            )), 0, 2);
            const averageRadius = Math.max(0.1, (
                finite(segment.startRadius, 1)
                + finite(segment.endRadius, 0.8)
            ) * 0.5);
            const canopyWeight = [0.82, 1, 1.18][tier];
            const radiusWeight = clamp(Math.sqrt(averageRadius), 0.78, 1.42);
            const weight = Math.max(1, length) * canopyWeight * radiusWeight;
            weightedX += ((start.x + end.x) * 0.5) * weight;
            totalWeight += weight;
            segmentCount += 1;
        });
        if (!(totalWeight > 0) || segmentCount === 0) {
            throw new Error('[G15_SCENE] Structural mass requires projected segments.');
        }
        return Object.freeze({
            kind: 'g15_projected_structural_segment_mass_v1',
            projectedX: weightedX / totalWeight,
            segmentCount,
        });
    }

    function createCamera(graph, options, width, height) {
        const suppliedBounds = options.cameraBounds
            ?? options.commonCameraBounds
            ?? (options.camera && typeof options.camera === 'object'
                ? options.camera.bounds ?? options.camera
                : null);
        if (options.camera === 'common' && !suppliedBounds) {
            throw new Error(
                '[G15_SCENE] common camera requires bounds from resolveCameraBounds().',
            );
        }
        const yaw = finite(options.yaw ?? suppliedBounds?.yaw, DEFAULT_YAW);
        const bounds = suppliedBounds
            ? normalizeBounds(suppliedBounds, yaw)
            : resolveCameraBounds(graph, {
                yaw,
                paddingRatio: options.cameraPaddingRatio,
                paddingWorld: options.cameraPaddingWorld,
                minimumSpanX: options.minimumSpanX,
                minimumSpanY: options.minimumSpanY,
            });
        const padding = resolvePadding(width, height, options.padding);
        const usableWidth = Math.max(1, width - padding.left - padding.right);
        const usableHeight = Math.max(1, height - padding.top - padding.bottom);
        const spanX = bounds.maxX - bounds.minX;
        const spanY = bounds.maxY - bounds.minY;
        const maximumScale = Math.max(0.1, finite(options.maximumScale, 4));
        const autoScale = Math.min(
            usableWidth / spanX,
            usableHeight / spanY,
            maximumScale,
        );
        const cameraAnchor = options.cameraAnchor ?? null;
        let anchorProjection = null;
        let anchorViewport = null;
        let requestedAnchorViewport = null;
        let horizontalComposition = null;
        let structuralMass = null;
        let rootShiftPx = 0;
        let cameraFitMode = CAMERA_FIT_MODES.CONTAIN;
        let cameraFitLimiter = 'bounds';
        let scale = autoScale;
        if (cameraAnchor !== null) {
            const worldAnchor = cameraAnchor?.world;
            const viewportAnchor = cameraAnchor?.viewport;
            if (
                !worldAnchor
                || !viewportAnchor
                || ![worldAnchor.x, worldAnchor.y, worldAnchor.z ?? 0]
                    .every((value) => Number.isFinite(Number(value)))
                || ![viewportAnchor.x, viewportAnchor.y]
                    .every((value) => Number.isFinite(Number(value)))
            ) {
                throw new TypeError('[G15_SCENE] cameraAnchor requires finite world and viewport points.');
            }
            cameraFitMode = cameraAnchor.fitMode ?? CAMERA_FIT_MODES.CONTAIN;
            if (!CAMERA_FIT_MODE_VALUES.has(cameraFitMode)) {
                throw new TypeError('[G15_SCENE] cameraAnchor.fitMode is invalid.');
            }
            anchorProjection = projectPoint(worldAnchor, yaw);
            requestedAnchorViewport = {
                x: Number(viewportAnchor.x),
                y: Number(viewportAnchor.y),
            };
            anchorViewport = { ...requestedAnchorViewport };
            if (
                anchorViewport.x < padding.left
                || anchorViewport.x > width - padding.right
                || anchorViewport.y < padding.top
                || anchorViewport.y > height - padding.bottom
            ) {
                throw new RangeError('[G15_SCENE] cameraAnchor viewport point exceeds padded viewport.');
            }
            const minDeltaX = bounds.minX - anchorProjection.x;
            const maxDeltaX = bounds.maxX - anchorProjection.x;
            const minDeltaY = bounds.minY - anchorProjection.y;
            const maxDeltaY = bounds.maxY - anchorProjection.y;
            const resolveAnchoredScale = (viewport) => {
                const scaleLimits = [
                    cameraFitMode === CAMERA_FIT_MODES.ROOTED_ABOVE_GROUND
                        ? { limiter: 'maximum_scale', value: maximumScale }
                        : { limiter: 'bounds', value: autoScale },
                ];
                if (minDeltaX < 0) {
                    scaleLimits.push({
                        limiter: 'left',
                        value: (viewport.x - padding.left) / -minDeltaX,
                    });
                }
                if (maxDeltaX > 0) {
                    scaleLimits.push({
                        limiter: 'right',
                        value: (width - padding.right - viewport.x) / maxDeltaX,
                    });
                }
                if (maxDeltaY > 0) {
                    scaleLimits.push({
                        limiter: 'top',
                        value: (viewport.y - padding.top) / maxDeltaY,
                    });
                }
                if (
                    cameraFitMode === CAMERA_FIT_MODES.CONTAIN
                    && minDeltaY < 0
                ) {
                    scaleLimits.push({
                        limiter: 'bottom',
                        value: (height - padding.bottom - viewport.y) / -minDeltaY,
                    });
                }
                const validScaleLimits = scaleLimits.filter(
                    ({ value }) => Number.isFinite(value) && value > 0,
                );
                if (!validScaleLimits.length) {
                    throw new RangeError(
                        '[G15_SCENE] cameraAnchor leaves no positive camera scale.',
                    );
                }
                return validScaleLimits.reduce((selected, candidate) => (
                    candidate.value < selected.value ? candidate : selected
                ));
            };
            let selectedScaleLimit = resolveAnchoredScale(anchorViewport);
            horizontalComposition = cameraAnchor.horizontalComposition ?? null;
            if (horizontalComposition !== null) {
                if (
                    !HORIZONTAL_COMPOSITION_MODE_VALUES.has(
                        horizontalComposition?.mode,
                    )
                    || !Number.isFinite(Number(horizontalComposition.targetViewportX))
                    || !Number.isFinite(Number(horizontalComposition.maximumRootShiftPx))
                    || Number(horizontalComposition.maximumRootShiftPx) < 0
                ) {
                    throw new TypeError(
                        '[G15_SCENE] cameraAnchor.horizontalComposition is invalid.',
                    );
                }
                const targetViewportX = Number(
                    horizontalComposition.targetViewportX,
                );
                const maximumRootShiftPx = Number(
                    horizontalComposition.maximumRootShiftPx,
                );
                if (
                    targetViewportX < padding.left
                    || targetViewportX > width - padding.right
                ) {
                    throw new RangeError(
                        '[G15_SCENE] Horizontal composition target exceeds padded viewport.',
                    );
                }
                structuralMass = resolveProjectedStructuralMass(graph, yaw);
                for (let iteration = 0; iteration < 3; iteration += 1) {
                    const desiredRootShift = clamp(
                        targetViewportX - (
                            requestedAnchorViewport.x
                            + (structuralMass.projectedX - anchorProjection.x)
                                * selectedScaleLimit.value
                        ),
                        -maximumRootShiftPx,
                        maximumRootShiftPx,
                    );
                    anchorViewport.x = clamp(
                        requestedAnchorViewport.x + desiredRootShift,
                        padding.left,
                        width - padding.right,
                    );
                    selectedScaleLimit = resolveAnchoredScale(anchorViewport);
                }
                rootShiftPx = anchorViewport.x - requestedAnchorViewport.x;
            }
            scale = selectedScaleLimit?.value;
            cameraFitLimiter = selectedScaleLimit?.limiter;
            if (!Number.isFinite(scale) || scale <= 0 || !cameraFitLimiter) {
                throw new RangeError('[G15_SCENE] cameraAnchor leaves no positive camera scale.');
            }
        }
        const contentWidth = spanX * scale;
        const contentHeight = spanY * scale;
        const offsetX = anchorProjection
            ? anchorViewport.x - (anchorProjection.x * scale)
            : padding.left
                + (usableWidth - contentWidth) / 2
                - bounds.minX * scale;
        const offsetY = anchorProjection
            ? anchorViewport.y + (anchorProjection.y * scale)
            : padding.top
                + (usableHeight - contentHeight) / 2
                + bounds.maxY * scale;
        const serializable = Object.freeze({
            kind: 'g15_orthographic_yaw_camera_v1',
            mode: anchorProjection ? 'anchored' : (suppliedBounds ? 'common' : 'auto'),
            fitMode: cameraFitMode,
            fitLimiter: cameraFitLimiter,
            yaw: rounded(yaw, 8),
            depthLift: DEPTH_LIFT,
            scale: rounded(scale, 8),
            offsetX: rounded(offsetX, 6),
            offsetY: rounded(offsetY, 6),
            padding: Object.freeze({
                left: rounded(padding.left),
                right: rounded(padding.right),
                top: rounded(padding.top),
                bottom: rounded(padding.bottom),
            }),
            bounds: Object.freeze({
                minX: rounded(bounds.minX, 6),
                maxX: rounded(bounds.maxX, 6),
                minY: rounded(bounds.minY, 6),
                maxY: rounded(bounds.maxY, 6),
                sourceGraphCount: bounds.sourceGraphCount,
            }),
            aboveAnchorExtentPx: anchorProjection
                ? rounded(Math.max(0, bounds.maxY - anchorProjection.y) * scale, 6)
                : null,
            belowAnchorExtentPx: anchorProjection
                ? rounded(Math.max(0, anchorProjection.y - bounds.minY) * scale, 6)
                : null,
            horizontalComposition: structuralMass
                ? Object.freeze({
                    mode: horizontalComposition.mode,
                    massKind: structuralMass.kind,
                    structuralSegmentCount: structuralMass.segmentCount,
                    structuralMassProjectedX: rounded(structuralMass.projectedX, 6),
                    structuralMassViewportX: rounded(
                        anchorViewport.x
                            + (structuralMass.projectedX - anchorProjection.x) * scale,
                        6,
                    ),
                    targetViewportX: rounded(
                        Number(horizontalComposition.targetViewportX),
                        6,
                    ),
                    maximumRootShiftPx: rounded(
                        Number(horizontalComposition.maximumRootShiftPx),
                        6,
                    ),
                    rootShiftPx: rounded(rootShiftPx, 6),
                })
                : null,
            anchor: anchorProjection
                ? Object.freeze({
                    world: Object.freeze({
                        x: rounded(Number(cameraAnchor.world.x), 6),
                        y: rounded(Number(cameraAnchor.world.y), 6),
                        z: rounded(Number(cameraAnchor.world.z ?? 0), 6),
                    }),
                    viewport: Object.freeze({
                        x: rounded(anchorViewport.x, 6),
                        y: rounded(anchorViewport.y, 6),
                    }),
                    requestedViewport: Object.freeze({
                        x: rounded(requestedAnchorViewport.x, 6),
                        y: rounded(requestedAnchorViewport.y, 6),
                    }),
                })
                : null,
        });
        return {
            serializable,
            map(point) {
                const projected = projectPoint(point, yaw);
                return {
                    x: rounded(offsetX + projected.x * scale),
                    y: rounded(offsetY - projected.y * scale),
                    depth: projected.depth,
                };
            },
        };
    }

    function hashString(value) {
        let hash = 0x811c9dc5;
        for (let index = 0; index < value.length; index += 1) {
            hash ^= value.charCodeAt(index);
            hash = Math.imul(hash, 0x01000193) >>> 0;
        }
        return hash >>> 0;
    }

    function lineageColor(lineageId) {
        const index = hashString(String(lineageId ?? 'lineage-root'))
            % LINEAGE_COLORS.length;
        return LINEAGE_COLORS[index];
    }

    function shadeHex(color, amount) {
        if (!/^#[0-9a-f]{6}$/iu.test(color)) return color;
        const channels = [1, 3, 5].map((offset) => parseInt(
            color.slice(offset, offset + 2),
            16,
        ));
        return `#${channels.map((channel) => clamp(
            Math.round(channel + amount),
            0,
            255,
        ).toString(16).padStart(2, '0')).join('')}`;
    }

    function tierOf(item) {
        return clamp(Math.round(finite(
            item?.tier
                ?? item?.structuralTier
                ?? item?.structuralOrder
                ?? item?.order,
            2,
        )), 0, 2);
    }

    function segmentColor(segment, mode, latest, depth) {
        const tier = tierOf(segment);
        if (mode === 'causal') {
            return latest ? '#ffe178' : '#5c5547';
        }
        if (mode === 'tier') return TIER_COLORS[tier];
        if (mode === 'lineage') {
            return lineageColor(segment.lineageId ?? segment.axisId);
        }
        return shadeHex(
            NATURAL_COLORS[tier],
            clamp(Math.round(-finite(depth) * 0.025), -12, 12),
        );
    }

    /**
     * Depth strata.
     *
     * The command stream is a painter's-algorithm sequence, and a renderer that
     * bakes it has to know which orderings carry meaning. Order *within* a
     * stratum is a nicety — one blossom in front of its neighbour. Order
     * *between* strata is the composition: blossoms behind the wood, the wood,
     * then everything that closes over it. A baker may collapse a stratum; it
     * may never let one leak past another, which is what made front blossoms
     * disappear behind branches they hang off.
     */
    const SCENE_STRATA = Object.freeze({
        GROUND: 0,
        BLOSSOM_BACK: 1,
        WOOD: 2,
        ORNAMENT_FRONT: 3,
    });
    // Set by the one synchronous builder pass below, read by `addCommand`.
    let activeStratum = SCENE_STRATA.GROUND;

    function addCommand(commands, command) {
        commands.push(Object.freeze(
            command.stratum === undefined
                ? { ...command, stratum: activeStratum }
                : command,
        ));
    }

    function addBackground(commands, width, height, mode) {
        addCommand(commands, {
            type: 'fillRect',
            x: 0,
            y: 0,
            width,
            height,
            fill: mode === 'natural' ? '#07100d' : '#080d0e',
        });
        const centerX = width * 0.5;
        const centerY = height * 0.43;
        [
            [Math.max(width, height) * 0.67, 'rgba(35, 60, 45, 0.12)'],
            [Math.max(width, height) * 0.49, 'rgba(45, 73, 54, 0.10)'],
            [Math.max(width, height) * 0.32, 'rgba(70, 91, 64, 0.075)'],
        ].forEach(([radius, fill]) => addCommand(commands, {
            type: 'circle',
            x: rounded(centerX),
            y: rounded(centerY),
            r: rounded(radius),
            fill,
        }));
        for (let index = 0; index < 24; index += 1) {
            addCommand(commands, {
                type: 'circle',
                x: rounded((index * 137.507 + 29) % width),
                y: rounded((index * 83.231 + 47) % height),
                r: index % 5 === 0 ? 0.75 : 0.45,
                fill: 'rgba(225, 211, 178, 0.045)',
            });
        }
    }

    function potGeometry(camera) {
        const base = camera.map({ x: 0, y: 0, z: 0 });
        const scale = camera.serializable.scale;
        const width = clamp(86 * scale, 48, 142);
        const height = clamp(29 * scale, 17, 46);
        return { base, width, height };
    }

    /**
     * Resolves the trunk's projected width and wood materials at the soil line.
     *
     * `woodPresentation.surfaces` is depth-sorted for painter's-order output, so
     * `surfaces[0]` is whatever sits furthest back — usually a twig. The nebari
     * has to be sized against the actual trunk foot, which is the tier-0 surface
     * sample nearest the planting point.
     */
    function resolveTrunkFoot(woodPresentation, trunkBase) {
        const surfaces = woodPresentation?.surfaces || [];
        const trunkSurfaces = surfaces.filter((surface) => surface.tier === 0);
        const candidates = trunkSurfaces.length ? trunkSurfaces : surfaces;
        let best = null;
        candidates.forEach((surface) => {
            (surface.centerline || []).forEach((sample, index) => {
                const distance = Math.hypot(
                    finite(sample.x) - trunkBase.x,
                    finite(sample.y) - trunkBase.y,
                );
                if (!best || distance < best.distance) {
                    best = {
                        distance, surface, index, radius: finite(sample.radius, 0),
                    };
                }
            });
        });
        if (!best) {
            return { width: 16, lean: 0, bodyFill: null, outlineFill: null };
        }
        // How far the trunk drifts sideways per unit of height gained. The flare
        // has to grow out of the trunk it actually has, not out of a vertical
        // axis at the planting point.
        const centerline = best.surface.centerline || [];
        const ahead = centerline[Math.min(best.index + 3, centerline.length - 1)];
        const from = centerline[best.index];
        const rise = ahead && from ? finite(from.y) - finite(ahead.y) : 0;
        const lean = rise > 1e-3
            ? clamp((finite(ahead.x) - finite(from.x)) / rise, -1.4, 1.4)
            : 0;
        return {
            width: Math.max(4, best.radius * 2),
            lean,
            bodyFill: best.surface.bodyFill || null,
            outlineFill: best.surface.outlineFill || null,
        };
    }

    /**
     * The planting surface owner supplies the ground plane. Home plants into the
     * garden bed and passes it in scene-local pixels; the lab pot derives one
     * from its own soil ellipse. Only the pot case owns soil dressing.
     */
    function resolveNebariGroundPlane(options, camera, trunkBase) {
        const supplied = options.groundPlane;
        if (supplied && typeof supplied === 'object') {
            return {
                center: supplied.center || trunkBase,
                halfWidth: supplied.halfWidth,
                frontDepth: supplied.frontDepth,
                rearDepth: supplied.rearDepth,
                drawSoil: supplied.drawSoil === true,
            };
        }
        const { base, width, height } = potGeometry(camera);
        const soilRy = height * 0.22;
        return {
            center: { x: base.x, y: base.y + height * 0.08 },
            halfWidth: width * 0.44,
            frontDepth: soilRy * 1.05,
            rearDepth: soilRy * 0.8,
            drawSoil: options.includePot !== false,
        };
    }

    function addPotBack(commands, camera) {
        const { base, width, height } = potGeometry(camera);
        addCommand(commands, {
            type: 'polygon',
            points: [
                { x: rounded(base.x - width * 0.61), y: rounded(base.y + height * 1.34) },
                { x: rounded(base.x + width * 0.61), y: rounded(base.y + height * 1.34) },
                { x: rounded(base.x + width * 0.42), y: rounded(base.y + height * 1.58) },
                { x: rounded(base.x - width * 0.42), y: rounded(base.y + height * 1.58) },
            ],
            fill: 'rgba(0, 0, 0, 0.28)',
        });
        addCommand(commands, {
            type: 'polygon',
            points: [
                { x: rounded(base.x - width * 0.53), y: rounded(base.y - height * 0.08) },
                { x: rounded(base.x + width * 0.53), y: rounded(base.y - height * 0.08) },
                { x: rounded(base.x + width * 0.46), y: rounded(base.y + height * 0.22) },
                { x: rounded(base.x - width * 0.46), y: rounded(base.y + height * 0.22) },
            ],
            fill: '#12191a',
            stroke: '#354348',
            lineWidth: 1,
        });
        addCommand(commands, {
            type: 'line',
            points: [
                { x: rounded(base.x - width * 0.42), y: rounded(base.y + height * 0.04) },
                { x: rounded(base.x + width * 0.42), y: rounded(base.y + height * 0.04) },
            ],
            stroke: '#40392c',
            lineWidth: Math.max(1, rounded(height * 0.12)),
            lineCap: 'round',
        });
    }

    function addPotFront(commands, camera) {
        const { base, width, height } = potGeometry(camera);
        addCommand(commands, {
            type: 'polygon',
            points: [
                { x: rounded(base.x - width * 0.52), y: rounded(base.y + height * 0.13) },
                { x: rounded(base.x + width * 0.52), y: rounded(base.y + height * 0.13) },
                { x: rounded(base.x + width * 0.38), y: rounded(base.y + height * 1.18) },
                { x: rounded(base.x - width * 0.38), y: rounded(base.y + height * 1.18) },
            ],
            fill: '#1b272c',
            stroke: '#3b4a4f',
            lineWidth: 1.1,
        });
        addCommand(commands, {
            type: 'polygon',
            points: [
                { x: rounded(base.x - width * 0.55), y: rounded(base.y + height * 0.04) },
                { x: rounded(base.x + width * 0.55), y: rounded(base.y + height * 0.04) },
                { x: rounded(base.x + width * 0.5), y: rounded(base.y + height * 0.31) },
                { x: rounded(base.x - width * 0.5), y: rounded(base.y + height * 0.31) },
            ],
            fill: '#24333a',
            stroke: '#526167',
            lineWidth: 1,
        });
        [-1, 1].forEach((side) => addCommand(commands, {
            type: 'polygon',
            points: [
                { x: rounded(base.x + side * width * 0.29), y: rounded(base.y + height * 1.15) },
                { x: rounded(base.x + side * width * 0.13), y: rounded(base.y + height * 1.15) },
                { x: rounded(base.x + side * width * 0.12), y: rounded(base.y + height * 1.35) },
                { x: rounded(base.x + side * width * 0.31), y: rounded(base.y + height * 1.35) },
            ],
            fill: '#10181b',
        }));
    }

    function segmentPolygon(start, end, startRadius, endRadius, expansion = 0) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const magnitude = Math.hypot(dx, dy);
        if (magnitude <= 1e-7) return null;
        const normalX = -dy / magnitude;
        const normalY = dx / magnitude;
        const startWidth = Math.max(0.5, startRadius + expansion);
        const endWidth = Math.max(0.38, endRadius + expansion);
        return [
            {
                x: rounded(start.x + normalX * startWidth),
                y: rounded(start.y + normalY * startWidth),
            },
            {
                x: rounded(end.x + normalX * endWidth),
                y: rounded(end.y + normalY * endWidth),
            },
            {
                x: rounded(end.x - normalX * endWidth),
                y: rounded(end.y - normalY * endWidth),
            },
            {
                x: rounded(start.x - normalX * startWidth),
                y: rounded(start.y - normalY * startWidth),
            },
        ];
    }

    function appendSegment(commands, entry, mode, eventLimit, scale) {
        const { segment, start, end } = entry;
        const startRadius = Math.max(0.5, finite(segment.startRadius, 1) * scale);
        const endRadius = Math.max(0.38, finite(segment.endRadius, 0.8) * scale);
        const latest = numericSequence(segment, 0) === eventLimit;
        const fill = entry.isMilestoneShoot
            ? '#68cbb3'
            : segmentColor(segment, mode, latest, (start.depth + end.depth) / 2);
        const outline = segmentPolygon(start, end, startRadius, endRadius, 0.85);
        const body = segmentPolygon(start, end, startRadius, endRadius);
        if (!body) return;
        addCommand(commands, {
            type: 'polygon',
            points: outline,
            fill: mode === 'natural' ? '#241b17' : 'rgba(4, 10, 10, 0.72)',
        });
        addCommand(commands, {
            type: 'polygon',
            points: body,
            fill,
        });
        addCommand(commands, {
            type: 'circle',
            x: end.x,
            y: end.y,
            r: rounded(endRadius),
            fill,
        });
        if (mode === 'natural' && Math.min(startRadius, endRadius) > 1.15) {
            addCommand(commands, {
                type: 'line',
                points: [
                    {
                        x: rounded(start.x * 0.82 + end.x * 0.18),
                        y: rounded(start.y * 0.82 + end.y * 0.18),
                    },
                    {
                        x: rounded(start.x * 0.12 + end.x * 0.88),
                        y: rounded(start.y * 0.12 + end.y * 0.88),
                    },
                ],
                stroke: 'rgba(236, 202, 148, 0.13)',
                lineWidth: rounded(clamp(Math.min(startRadius, endRadius) * 0.16, 0.35, 1.25)),
                lineCap: 'round',
            });
        }
    }

    function riggedFloweringCommand(command, rigForLineage) {
        const rig = rigForLineage(command.sourceLineageId);
        return rig ? { ...command, rig } : command;
    }

    function appendWoodPresentation(
        commands,
        presentation,
        rigForSurface,
        rigForLineage = null,
    ) {
        // Collar lobes go down first, underneath the strokes.
        //
        // They close the crotch where two axes meet. Painted on top they would
        // lie across strokes that carry their own pooled edge and their own
        // drying, and cut the outline at every fork; underneath they do their
        // one job and the strokes stay whole. Each lobe already carries the
        // lineage of the wood it rides, so the two halves of one collar can sit
        // on two different rigs and still hold together across the joint.
        presentation.junctions.forEach((junction) => {
            const fallbackRig = rigForSurface(junction.id) || null;
            junction.patches.forEach((patch) => {
                const branchLineage = patch.lineageId ?? patch.sourceLineageId;
                const patchRig = (branchLineage != null && typeof rigForLineage === 'function'
                    ? rigForLineage(branchLineage)
                    : null) || fallbackRig;
                addCommand(commands, {
                    type: 'polygon',
                    points: patch.outlinePolygon,
                    fill: patch.outlineFill,
                    rig: patchRig,
                });
            });
        });
        presentation.surfaces.forEach((surface) => {
            const surfaceRig = rigForSurface(surface.id);
            const points = surface.centerline.map((sample) => ({
                x: sample.x,
                y: sample.y,
                w: rounded(Math.max(0.12, sample.radius), 3),
            }));

            // One brush stroke, not an outline plus a fill plus a round cap.
            // The ribbon carries its own pooled edge and dries out along its
            // length, so the contour and the terminal bead that used to stand
            // in for those are gone.
            addCommand(commands, {
                type: 'inkRibbon',
                points,
                fill: surface.bodyFill,
                headFill: surface.headFill || null,
                headBlendFraction: surface.headBlendFraction ?? null,
                dryness: surface.brushDryness,
                tipShift: surface.tipShift,
                seed: hashString(surface.id) % 100000,
                rig: surfaceRig,
            });
            if (surface.rimHighlightBand) {
                addCommand(commands, {
                    type: 'polygon',
                    points: surface.rimHighlightBand.polygon,
                    fill: surface.rimHighlightBand.fill,
                    rig: surfaceRig,
                });
            }
            if (surface.lightBand) {
                addCommand(commands, {
                    type: 'polygon',
                    points: surface.lightBand.polygon,
                    fill: surface.lightBand.fill,
                    rig: surfaceRig,
                });
            }
            if (surface.shadowBand) {
                addCommand(commands, {
                    type: 'polygon',
                    points: surface.shadowBand.polygon,
                    fill: surface.shadowBand.fill,
                    rig: surfaceRig,
                });
            }
            if (surface.ambientOcclusionBand) {
                addCommand(commands, {
                    type: 'polygon',
                    points: surface.ambientOcclusionBand.polygon,
                    fill: surface.ambientOcclusionBand.fill,
                    rig: surfaceRig,
                });
            }
            surface.textureStrokes.forEach((stroke) => addCommand(commands, {
                type: 'line',
                points: stroke.points,
                stroke: stroke.stroke,
                lineWidth: stroke.lineWidth,
                lineCap: 'round',
                lineJoin: 'round',
                rig: surfaceRig,
            }));
        });
    }

    function visibleEvent(graph, eventLimit) {
        return [...(graph.events || [])]
            .filter((event) => numericSequence(event, -1) <= eventLimit)
            .sort((left, right) => numericSequence(right) - numericSequence(left))[0]
            || null;
    }

    function activeFrontierIdsAt(graph, eventLimit, event) {
        if (Array.isArray(event?.activeFrontierIdsAfter)) {
            return [...event.activeFrontierIdsAfter];
        }
        const active = new Set();
        [...(graph.events || [])]
            .filter((candidate) => numericSequence(candidate, -1) <= eventLimit)
            .sort((left, right) => numericSequence(left) - numericSequence(right))
            .forEach((candidate) => {
                if (candidate.consumedFrontierId) active.delete(candidate.consumedFrontierId);
                (candidate.createdFrontierIds || []).forEach((id) => active.add(id));
            });
        return [...active];
    }

    function vectorBetween(left, right) {
        return {
            x: right.x - left.x,
            y: right.y - left.y,
            z: right.z - left.z,
        };
    }

    function normalizedVector(vector) {
        const magnitude = Math.hypot(vector.x, vector.y, vector.z);
        if (magnitude <= 1e-9) return null;
        return {
            x: vector.x / magnitude,
            y: vector.y / magnitude,
            z: vector.z / magnitude,
        };
    }

    function relativeAngleDegrees(parentDirection, childDirection) {
        const parent = normalizedVector(parentDirection || {});
        const child = normalizedVector(childDirection || {});
        if (!parent || !child) return null;
        const dot = clamp(
            parent.x * child.x + parent.y * child.y + parent.z * child.z,
            -1,
            1,
        );
        const magnitude = Math.acos(dot) * 180 / Math.PI;
        const crossZ = parent.x * child.y - parent.y * child.x;
        const sign = Math.abs(crossZ) > 1e-7
            ? Math.sign(crossZ)
            : Math.sign(child.z - parent.z) || 1;
        return rounded(magnitude * sign, 2);
    }

    function splitSequence(split) {
        return numericSequence(split, -1);
    }

    function findParentDirection(split, graph, nodeMap, segmentMap) {
        const explicit = split.parentHeading
            ?? split.parentDirection
            ?? split.headingBefore;
        if (explicit) return explicit;
        const origin = nodeMap.get(split.originNodeId);
        if (!origin) return null;
        const incomingId = origin.incomingSegmentId;
        const incoming = incomingId
            ? segmentMap.get(incomingId)
            : graph.segments
                .filter((segment) => segment.toNodeId === origin.id)
                .sort((left, right) => numericSequence(right) - numericSequence(left))[0];
        if (!incoming) return null;
        const from = nodeMap.get(incoming.fromNodeId);
        return from ? vectorBetween(pointOf(from), pointOf(origin)) : null;
    }

    function firstDefined(...values) {
        return values.find((value) => value !== undefined && value !== null);
    }

    function episodeName(value) {
        const resolved = value?.kind ?? value?.id ?? value?.name ?? value;
        return resolved === undefined || resolved === null
            ? 'unreported'
            : String(resolved);
    }

    function hasLineageRefork(graph, lineageId, afterSequence, nodeMap, frontierMap) {
        if (!lineageId) return false;
        return (graph.splits || []).some((laterSplit) => {
            if (splitSequence(laterSplit) <= afterSequence) return false;
            if (laterSplit.parentLineageId === lineageId) return true;
            const origin = nodeMap.get(laterSplit.originNodeId);
            if (origin?.lineageId === lineageId || origin?.axisId === lineageId) return true;
            const consumed = frontierMap.get(laterSplit.consumedFrontierId);
            return consumed?.lineageId === lineageId || consumed?.axisId === lineageId;
        });
    }

    function normalizeForkReceipt(split, graph, maps) {
        const { nodeMap, segmentMap, frontierMap } = maps;
        const sequence = splitSequence(split);
        const origin = nodeMap.get(split.originNodeId);
        const parentDirection = findParentDirection(split, graph, nodeMap, segmentMap);
        const splitSegments = (split.createdSegmentIds || [])
            .map((id) => segmentMap.get(id))
            .filter(Boolean);
        if (!splitSegments.length) {
            splitSegments.push(...graph.segments.filter((segment) => (
                numericSequence(segment, -2) === sequence
                && segment.fromNodeId === split.originNodeId
            )));
        }
        const incomingSegment = origin?.incomingSegmentId
            ? segmentMap.get(origin.incomingSegmentId)
            : graph.segments.find((segment) => segment.toNodeId === split.originNodeId);
        const sourceChildren = split.children
            ?? split.childReceipts
            ?? split.childDecisions
            ?? [];
        const arity = Math.max(
            finite(split.arity ?? split.splitArity, 0),
            sourceChildren.length,
            (split.resourceShares || []).length,
            splitSegments.length,
        );
        const parentLineage = String(firstDefined(
            split.parentLineageId,
            split.parentAxisId,
            origin?.lineageId,
            origin?.axisId,
            'root',
        ));
        const children = Array.from({ length: arity }, (_, index) => {
            const child = sourceChildren[index] || {};
            const segment = splitSegments[index]
                ?? segmentMap.get(child.segmentId)
                ?? null;
            const targetNode = segment ? nodeMap.get(segment.toNodeId) : null;
            const childDirection = firstDefined(
                child.startDirection,
                child.direction,
                child.heading,
                targetNode && origin
                    ? vectorBetween(pointOf(origin), pointOf(targetNode))
                    : null,
            );
            const lineageId = String(firstDefined(
                child.lineageId,
                child.axisId,
                segment?.lineageId,
                segment?.axisId,
                `child-${index + 1}`,
            ));
            const explicitAngle = firstDefined(
                child.signedStartAngleDegrees,
                child.relativeAngleDegrees,
                child.relativeAngleDeg,
                child.startAngleDegrees,
                child.parentHeadingAngleDegrees,
                child.releaseAngleDegrees,
            );
            const referenceAngle = firstDefined(
                child.referenceAngleDegrees,
                child.referenceHeadingAngleDegrees,
            );
            const tierDecision = split.tierDecisions?.[index];
            const createdFrontier = frontierMap.get(
                child.frontierId ?? split.createdFrontierIds?.[index],
            );
            const hasRefork = Boolean(firstDefined(
                child.hasRefork,
                child.reforked,
                child.laterReforked,
                child.subsequentlyForked,
                hasLineageRefork(graph, lineageId, sequence, nodeMap, frontierMap),
            ));
            return Object.freeze({
                index,
                lineageId,
                share: rounded(finite(firstDefined(
                    child.share,
                    child.resourceShare,
                    split.resourceShares?.[index],
                    segment?.resourceShare,
                    arity ? 1 / arity : 0,
                )), 6),
                tier: tierOf(firstDefined(
                    child.tier !== undefined ? child : null,
                    tierDecision,
                    segment,
                    createdFrontier,
                    { tier: 2 },
                )),
                relativeAngleDegrees: Number.isFinite(Number(explicitAngle))
                    ? rounded(Number(explicitAngle), 2)
                    : relativeAngleDegrees(parentDirection, childDirection),
                referenceAngleDegrees: Number.isFinite(Number(referenceAngle))
                    ? rounded(Number(referenceAngle), 2)
                    : null,
                growthEpisode: episodeName(firstDefined(
                    child.growthEpisode,
                    child.episode,
                    child.episodeKind,
                    child.episodeId,
                    child.growthPhrase,
                    createdFrontier?.growthEpisode,
                    createdFrontier?.episode,
                    createdFrontier?.growthPhrase,
                )),
                hasRefork,
                clusterId: child.clusterId ?? createdFrontier?.clusterId ?? null,
                absoluteDevelopmentalCapacity: finite(
                    child.absoluteDevelopmentalCapacity,
                    0,
                ),
                growthCapacity: finite(child.growthCapacity, 0),
                extensionCapacity: finite(child.extensionCapacity, 0),
                supportCapacity: finite(child.supportCapacity, 0),
                supportAllocation: finite(
                    child.supportAllocation ?? split.supportAllocationShares?.[index],
                    0,
                ),
                extensionAllocation: finite(
                    child.extensionAllocation ?? split.growthAllocationShares?.[index],
                    0,
                ),
                reiterationPotential: finite(child.reiterationPotential, 0),
                axisRetentionPotential: finite(child.axisRetentionPotential, 0),
                axisIdentity: child.axisIdentity
                    ?? split.axisIdentitySignals?.[index]
                    ?? null,
                projectedLoadMoment: finite(child.projectedLoadMoment, 0),
                allocationCharacter: child.allocationCharacter || 'coupled',
                maturationState: child.maturationState || 'active_extension',
                junctionAreaShare: finite(
                    child.junctionAreaShare ?? split.junctionAreaShares?.[index],
                    0,
                ),
                junctionMassShare: finite(
                    child.junctionMassShare
                        ?? split.junctionMassShares?.[index],
                    0,
                ),
                groundVerticalAngleDegrees: Number.isFinite(Number(
                    child.groundVerticalAngleDegrees,
                )) ? rounded(Number(child.groundVerticalAngleDegrees), 2) : null,
                horizontalRelease: Boolean(child.horizontalRelease),
                completionFork: Boolean(child.completionFork ?? split.completionFork),
            });
        });
        return Object.freeze({
            sequence,
            originNodeId: split.originNodeId,
            parentLineage,
            resourceRatio: Object.freeze(children.map((child) => child.share)),
            children: Object.freeze(children),
            grammar: String(split.grammar ?? split.forkArchetype ?? 'unreported'),
            completionFork: Boolean(split.completionFork),
            horizontalRelease: split.horizontalRelease || null,
            successionKink: split.successionKink || null,
            resourceShareReceipt: split.resourceShareReceipt || null,
            realizedSeparationDegrees: Number.isFinite(
                split.siblingSeparationPlan?.afterSeparationRadians,
            )
                ? rounded(
                    split.siblingSeparationPlan.afterSeparationRadians * 180 / Math.PI,
                    1,
                )
                : null,
            apertureDegrees: rounded(finite(
                split.apertureRadians ?? split.divergenceRadians,
            ) * 180 / Math.PI, 1),
            weightedMeanAngleDegrees: rounded(
                finite(split.weightedMeanAngleDegrees),
                2,
            ),
            point: origin ? pointOf(origin) : null,
            junctionRadius: finite(
                incomingSegment?.endRadius,
                Math.max(1, ...splitSegments.map((segment) => finite(
                    segment?.startRadius,
                    1,
                ))),
            ),
        });
    }

    function activeCorridorsAt(graph, eventLimit) {
        return (graph.corridors || []).filter((corridor) => (
            numericSequence({ sequence: corridor.reservedAtEvent }, -1) <= eventLimit
            && (
                corridor.releasedAtEvent === null
                || corridor.releasedAtEvent === undefined
                || corridor.releasedAtEvent > eventLimit
            )
            && Array.isArray(corridor.points)
            && corridor.points.length >= 2
        ));
    }

    function compactLineage(value) {
        const text = String(value ?? 'root')
            .replace(/^lineage[-_:]?/iu, 'L')
            .replace(/^axis[-_:]?/iu, 'A');
        return text.length > 15 ? `${text.slice(0, 13)}..` : text;
    }

    function compactEpisode(value) {
        const text = String(value ?? 'unreported')
            .replace(/[_-]+/gu, ' ');
        return text.length > 17 ? `${text.slice(0, 15)}..` : text;
    }

    function percentRatio(receipt) {
        return receipt.children
            .map((child) => Math.round(child.share * 100))
            .join(':');
    }

    function placeReceiptBox(origin, boxWidth, boxHeight, index, width, height, boxes) {
        let side = origin.x < width * 0.58 ? 1 : -1;
        if (index % 2 === 1 && origin.x > width * 0.3 && origin.x < width * 0.7) {
            side *= -1;
        }
        let x = side > 0 ? origin.x + 27 : origin.x - boxWidth - 27;
        x = clamp(x, 7, width - boxWidth - 7);
        let y = clamp(origin.y - boxHeight * 0.5, 7, height - boxHeight - 7);
        for (let pass = 0; pass < 12; pass += 1) {
            const collision = boxes.find((box) => !(
                x + boxWidth + 5 < box.x
                || x > box.x + box.width + 5
                || y + boxHeight + 5 < box.y
                || y > box.y + box.height + 5
            ));
            if (!collision) break;
            y = collision.y + collision.height + 7;
            if (y + boxHeight > height - 7) {
                y = Math.max(7, collision.y - boxHeight - 7);
                x = clamp(
                    side > 0 ? x + 13 : x - 13,
                    7,
                    width - boxWidth - 7,
                );
            }
        }
        return { x: rounded(x), y: rounded(y), width: boxWidth, height: boxHeight };
    }

    function addForkReceiptOverlays(commands, receipts, camera, options, width, height) {
        const requested = Array.isArray(options.forkReceiptSequences)
            ? new Set(options.forkReceiptSequences.map(Number))
            : null;
        const candidates = receipts.filter((receipt) => (
            receipt.point && (!requested || requested.has(receipt.sequence))
        ));
        const receiptLimit = clamp(Math.round(finite(
            options.receiptLimit,
            requested ? candidates.length : 6,
        )), 1, 40);
        const shown = candidates.slice(-receiptLimit);
        const boxes = [];
        shown.forEach((receipt, index) => {
            const origin = camera.map(receipt.point);
            const grammar = compactEpisode(receipt.grammar);
            const separation = receipt.realizedSeparationDegrees === null
                ? ''
                : ` X${Math.round(receipt.realizedSeparationDegrees)}d`;
            const header = `F${receipt.sequence} ${compactLineage(receipt.parentLineage)} V${percentRatio(receipt)} D${Math.round(receipt.apertureDegrees)}d${separation} ${grammar} err${receipt.weightedMeanAngleDegrees.toFixed(1)}d`;
            const childLines = receipt.children.map((child, childIndex) => {
                const parentAngle = child.relativeAngleDegrees === null
                    ? '?'
                    : `${child.relativeAngleDegrees >= 0 ? '+' : ''}${Math.round(child.relativeAngleDegrees)}d`;
                const referenceAngle = child.referenceAngleDegrees === null
                    ? '?'
                    : `${Math.round(child.referenceAngleDegrees)}d`;
                const cluster = child.clusterId
                    ? ` ${String(child.clusterId).replace('cluster-', 'C')}`
                    : '';
                const worldAngle = child.groundVerticalAngleDegrees === null
                    ? ''
                    : ` W${Math.round(child.groundVerticalAngleDegrees)}d`;
                const horizontal = child.horizontalRelease ? ' H' : '';
                return `${childIndex + 1} V${Math.round(child.share * 100)} I${Math.round(child.axisRetentionPotential * 100)} S${Math.round(child.supportAllocation * 100)} E${Math.round(child.extensionAllocation * 100)} R${Math.round(child.reiterationPotential * 100)} L${child.projectedLoadMoment.toFixed(2)} T${child.tier} P${parentAngle} A${referenceAngle}${worldAngle}${horizontal}${cluster} ${compactEpisode(child.growthEpisode)} refork:${child.hasRefork ? 'Y' : 'N'}`;
            });
            const maximumCharacters = Math.max(
                header.length,
                ...childLines.map((line) => line.length),
            );
            const boxWidth = clamp(20 + maximumCharacters * 5.65, 190, 390);
            const boxHeight = 25 + childLines.length * 14;
            const box = placeReceiptBox(
                origin,
                boxWidth,
                boxHeight,
                index,
                width,
                height,
                boxes,
            );
            boxes.push(box);
            const anchorX = origin.x < box.x ? box.x : box.x + box.width;
            const anchorY = clamp(origin.y, box.y + 8, box.y + box.height - 8);
            addCommand(commands, {
                type: 'line',
                points: [
                    { x: rounded(origin.x), y: rounded(origin.y) },
                    { x: rounded(anchorX), y: rounded(anchorY) },
                ],
                stroke: 'rgba(255, 224, 112, 0.7)',
                lineWidth: 1,
                lineCap: 'round',
            });
            addCommand(commands, {
                type: 'polygon',
                points: [
                    { x: box.x, y: box.y },
                    { x: rounded(box.x + box.width), y: box.y },
                    { x: rounded(box.x + box.width), y: rounded(box.y + box.height) },
                    { x: box.x, y: rounded(box.y + box.height) },
                ],
                fill: 'rgba(7, 13, 13, 0.94)',
                stroke: 'rgba(238, 199, 103, 0.72)',
                lineWidth: 1,
            });
            addCommand(commands, {
                type: 'text',
                x: rounded(box.x + 8),
                y: rounded(box.y + 7),
                text: header,
                fill: '#f0cc79',
                font: '600 10px ui-monospace, SFMono-Regular, Menlo, monospace',
                align: 'left',
                baseline: 'top',
                maxWidth: rounded(box.width - 16),
            });
            childLines.forEach((line, childIndex) => addCommand(commands, {
                type: 'text',
                x: rounded(box.x + 8),
                y: rounded(box.y + 22 + childIndex * 14),
                text: line,
                fill: TIER_COLORS[receipt.children[childIndex].tier],
                font: '9px ui-monospace, SFMono-Regular, Menlo, monospace',
                align: 'left',
                baseline: 'top',
                maxWidth: rounded(box.width - 16),
            }));
        });
    }

    function balanceFieldFor(graph, event, eventLimit, maximumEvent) {
        const field = event?.steering?.balanceField
            ?? event?.balanceField
            ?? event?.referenceFrame?.balanceField
            ?? (eventLimit === maximumEvent ? graph.balanceField : null);
        if (!field) return null;
        const values = [
            field.targetCenterX,
            field.predictedCenterX,
            field.pressureX,
            field.targetCenterZ,
            field.predictedCenterZ,
            field.pressureZ,
            field.predictedMass,
        ];
        return values.every((value) => Number.isFinite(Number(value))) ? field : null;
    }

    function addBalanceOverlay(commands, field, camera, width, height) {
        if (!field) return;
        const baseY = camera.map({ x: 0, y: 0, z: 0 }).y;
        const target = camera.map({
            x: field.targetCenterX,
            y: 0,
            z: field.targetCenterZ,
        });
        const predicted = camera.map({
            x: field.predictedCenterX,
            y: 0,
            z: field.predictedCenterZ,
        });
        const targetX = clamp(target.x, 8, width - 8);
        const predictedX = clamp(predicted.x, 8, width - 8);
        const y = clamp(baseY + 14, 24, height - 22);
        addCommand(commands, {
            type: 'line',
            points: [{ x: targetX, y }, { x: predictedX, y }],
            stroke: 'rgba(255, 213, 104, 0.68)',
            lineWidth: 1.4,
            lineCap: 'round',
        });
        addCommand(commands, {
            type: 'circle',
            x: targetX,
            y,
            r: 4,
            fill: '#69d8b3',
            stroke: '#d9fff2',
            lineWidth: 1,
        });
        addCommand(commands, {
            type: 'circle',
            x: predictedX,
            y,
            r: 4,
            fill: '#f0bd61',
            stroke: '#fff0bf',
            lineWidth: 1,
        });
        addCommand(commands, {
            type: 'text',
            x: clamp(Math.min(targetX, predictedX), 8, width - 235),
            y: clamp(y + 8, 8, height - 18),
            text: `scale support x${rounded(field.predictedCenterX, 1)}/z${rounded(field.predictedCenterZ, 1)} -> x${rounded(field.targetCenterX, 1)}/z${rounded(field.targetCenterZ, 1)} · pressure x${rounded(field.pressureX, 3)}/z${rounded(field.pressureZ, 3)}`,
            fill: '#dfe9df',
            font: '9px ui-monospace, SFMono-Regular, Menlo, monospace',
            align: 'left',
            baseline: 'top',
            maxWidth: 250,
        });
    }

    function describeEvent(event) {
        if (!event) return 'No visible growth event';
        const sequence = Math.round(numericSequence(event));
        if (event.kind === 'emerge') return `${sequence} · root axis emerged`;
        if (event.kind === 'advance') {
            const episode = episodeName(
                event.growthEpisode
                    ?? event.episode
                    ?? event.steering?.growthEpisode
                    ?? event.steering?.episodeKind
                    ?? event.steering?.episodeId
                    ?? event.steering?.growthPhrase,
            );
            const lateral = event.steering?.lateralEmission
                ? ' + live lateral emission'
                : '';
            return `${sequence} · axis advance${lateral} · ${episode}`;
        }
        if (event.kind === 'fork' || event.kind === 'split') {
            const shares = (event.resourceShares || event.children?.map(
                (child) => child.share ?? child.resourceShare,
            ) || []).map((share) => Math.round(finite(share) * 100)).join(':');
            const arity = Math.round(finite(
                event.splitArity ?? event.arity,
                event.createdFrontierIds?.length ?? event.children?.length ?? 0,
            ));
            return `${sequence} · recursive ${arity}-fork${shares ? ` · ${shares}` : ''}`;
        }
        if (event.kind === 'terminate') {
            return `${sequence} · axis completed${event.reason ? ` · ${event.reason}` : ''}`;
        }
        return `${sequence} · ${String(event.kind || 'growth event')}`;
    }

    function signatureFor(sceneCore) {
        const hash = hashString(JSON.stringify(sceneCore));
        return `g15scn-${hash.toString(16).padStart(8, '0')}`;
    }

    function buildSceneCommands(graph, options = {}) {
        assertGraph(graph);
        // One synchronous pass owns the stratum cursor; reset it here so a
        // previous scene's last phase can never stamp this one's backdrop.
        activeStratum = SCENE_STRATA.GROUND;
        const width = Math.max(64, Math.round(finite(options.width, 900)));
        const height = Math.max(64, Math.round(finite(options.height, 900)));
        const mode = MODES.includes(options.mode) ? options.mode : 'natural';
        const events = Array.isArray(graph.events) ? graph.events : [];
        const maximumEvent = Math.max(
            -1,
            ...events.map((event) => numericSequence(event, -1)),
            ...graph.segments.map((segment) => numericSequence(segment, -1)),
        );
        const eventLimit = clamp(
            Math.round(finite(options.eventLimit, maximumEvent)),
            -1,
            maximumEvent,
        );
        const sourceGraph = graph;
        const sourceNodeMap = new Map(graph.nodes.map(node => [node.id, node]));
        const developmentClock = options.developmentClock;
        const eventTime = developmentClock === undefined ? eventLimit : developmentClock.eventTime;
        const completedEventLimit = developmentClock === undefined
            ? eventLimit : developmentClock.completedEventLimit;
        const growthGeometry = projectZenG15GrowthGeometry(graph, developmentClock === undefined
            ? {
                eventLimit, completedEventLimit,
                activeEventSequence: options.subEventProgress === undefined ? null : eventLimit,
                subEventProgress: options.subEventProgress === undefined ? 1 : options.subEventProgress,
            } : developmentClock, finite(options.branchSag, 0));
        graph = growthGeometry.graph;
        if (!ontogenyOwner) {
            throw new Error(
                '[G15_SCENE] Ontogenetic growth owner must load before scene commands.',
            );
        }
        const specimenGrowth = ontogenyOwner.resolveSpecimenGrowthSnapshot(
            graph,
            eventLimit,
            developmentClock,
        );
        const terminalLabFinalView = mode === 'natural'
            && options.showTerminalLabCanopy === true
            && eventLimit >= maximumEvent;
        const cameraOptions = terminalLabFinalView && options.padding === undefined
            ? {
                ...options,
                padding: {
                    left: width * 0.13,
                    right: width * 0.13,
                    top: height * 0.15,
                    bottom: height * 0.085,
                },
            }
            : options;
        const camera = createCamera(graph, cameraOptions, width, height);
        const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
        const segmentMap = new Map(graph.segments.map((segment) => [segment.id, segment]));
        const frontierMap = new Map((graph.frontiers || []).map(
            (frontier) => [frontier.id, frontier],
        ));
        const juvenileRetirementByLineage = new Map(
            (graph.juvenileAxisRetirements || []).map((retirement) => [
                retirement.lineageId,
                retirement,
            ]),
        );
        const visibleSegments = graph.segments
            .filter((segment) => {
                const retirement = juvenileRetirementByLineage.get(
                    segment.lineageId,
                );
                return numericSequence(segment, -1) <= eventLimit
                    && (!retirement
                        || Number(retirement.retiredAtEvent) > completedEventLimit);
            })
            .map((segment) => {
                const from = nodeMap.get(segment.fromNodeId);
                const to = nodeMap.get(segment.toNodeId);
                if (!from || !to) {
                    throw new Error(
                        `[G15_SCENE] Segment ${segment.id ?? '<anonymous>'} references a missing node.`,
                    );
                }
                const start = camera.map(pointOf(from));
                const end = camera.map(pointOf(to));
                return {
                    segment,
                    developmentProgress: growthGeometry.segmentProgress.get(segment.id),
                    fromNodeId: segment.fromNodeId,
                    toNodeId: segment.toNodeId,
                    presentationLineageId: segment.lineageId,
                    start,
                    end,
                    isMilestoneShoot: Boolean(
                        options.isMilestoneActive && numericSequence(segment, -1) === eventLimit,
                    ),
                };
            })
            .sort((left, right) => (
                right.end.depth - left.end.depth
                || numericSequence(left.segment) - numericSequence(right.segment)
                || String(left.segment.id).localeCompare(String(right.segment.id))
            ));
        const structuralOrganEntries = sourceGraph.segments.map(segment => {
            const carrierAvailable = segmentMap.has(segment.id);
            const carrierNodes = carrierAvailable ? nodeMap : sourceNodeMap;
            const start = carrierNodes.get(segment.fromNodeId);
            const end = carrierNodes.get(segment.toNodeId);
            if (!start || !end) throw new Error('ZEN_G15_ORGAN_CARRIER_NODES_REQUIRED');
            return {
                segment,
                fromNodeId: segment.fromNodeId,
                toNodeId: segment.toNodeId,
                presentationLineageId: segment.lineageId,
                carrierAvailable,
                restFrom: pointOf(sourceNodeMap.get(segment.fromNodeId)),
                restTo: pointOf(sourceNodeMap.get(segment.toNodeId)),
                start: camera.map(pointOf(start)),
                end: camera.map(pointOf(end)),
            };
        });
        const event = visibleEvent(graph, eventLimit);
        const balanceField = balanceFieldFor(graph, event, eventLimit, maximumEvent);
        const activeFrontierIds = activeFrontierIdsAt(graph, eventLimit, event);
        const activeCorridors = activeCorridorsAt(graph, eventLimit);
        const receipts = (graph.splits || [])
            .filter((split) => splitSequence(split) <= eventLimit)
            .sort((left, right) => splitSequence(left) - splitSequence(right))
            .map((split) => normalizeForkReceipt(split, graph, {
                nodeMap,
                segmentMap,
                frontierMap,
            }));
        const visibleLateralEmissions = events.filter((candidate) => (
            candidate.kind === 'advance'
                && candidate.steering?.lateralEmission
                && numericSequence(candidate, -1) <= eventLimit
                && !(
                    juvenileRetirementByLineage.get(
                        candidate.steering.lateralEmission.lineageId,
                    )?.retiredAtEvent <= eventLimit
                )
        ));
        const visibleClusters = (graph.clusters || []).filter(
            (cluster) => numericSequence({ sequence: cluster.createdAtEvent }, -1) <= eventLimit,
        );
        const showTerminalLabCanopy = mode === 'natural'
            && options.showTerminalLabCanopy === true
            && eventLimit >= maximumEvent;
        if (showTerminalLabCanopy && !terminalLabAdapterOwner) {
            throw new Error(
                '[G15_SCENE] Sakura Terminal Lab adapter must load before scene commands.',
            );
        }
        const terminalLabCanopy = showTerminalLabCanopy
            ? terminalLabAdapterOwner.buildSakuraTerminalLabCanopy({
                seed: graph.seed ?? graph.options?.seed ?? graph.contract?.seed,
                sequence: eventLimit,
                scale: camera.serializable.scale,
                socketLoad: finite(options.terminalSocketLoad, 0.95),
                density: finite(options.terminalMorphologyDensity, 0.9),
                interiorFill: finite(options.terminalInteriorFill, 0.72),
                clusterCoverage: finite(options.terminalClusterCoverage, 0.9),
                entries: visibleSegments.map((entry) => ({
                    ...entry,
                    startRadiusPx: Math.max(
                        0.5,
                        finite(entry.segment.startRadius, 1) * camera.serializable.scale,
                    ),
                    endRadiusPx: Math.max(
                        0.38,
                        finite(entry.segment.endRadius, 0.8) * camera.serializable.scale,
                    ),
                })),
            })
            : null;
        const visibleTerminalLabEntries = terminalLabCanopy?.entries || [];
        const showCanopyTwigVolume = mode === 'natural'
            && options.showCanopyTwigVolume !== false
            && !showTerminalLabCanopy;
        if (showCanopyTwigVolume && !canopyTwigVolumeOwner) {
            throw new Error(
                '[G15_SCENE] Sakura canopy twig volume owner must load before scene commands.',
            );
        }
        const canopyTwigVolume = showCanopyTwigVolume
            ? canopyTwigVolumeOwner.buildCanopyTwigVolume({
                seed: graph.seed ?? graph.options?.seed ?? graph.contract?.seed,
                yaw: camera.serializable.yaw,
                depthLift: camera.serializable.depthLift,
                sequence: eventLimit,
                eventTime,
                volumeLoad: finite(options.canopyTwigVolume, 1),
                entries: structuralOrganEntries.map((entry) => ({
                    segment: entry.segment,
                    fromNodeId: entry.fromNodeId,
                    toNodeId: entry.toNodeId,
                    from: entry.restFrom,
                    to: entry.restTo,
                })),
            })
            : null;
        const poseCanopyEntry = entry => {
            const source = segmentMap.get(entry.sourceSegmentId);
            const available = Boolean(source);
            let offset = { x: 0, y: 0, z: 0 };
            if (available) {
                const rest = sourceNodeMap.get(source.fromNodeId).point;
                const current = nodeMap.get(source.fromNodeId).point;
                const restEnd = sourceNodeMap.get(source.toNodeId).point;
                const currentEnd = nodeMap.get(source.toNodeId).point;
                offset = Object.fromEntries(['x', 'y', 'z'].map(axis => [axis,
                    current[axis] - rest[axis] + ((currentEnd[axis] - current[axis])
                        - (restEnd[axis] - rest[axis])) * 0.76,
                ]));
            }
            const posed = point => camera.map({
                x: point.x + offset.x, y: point.y + offset.y, z: point.z + offset.z,
            });
            return {
                segment: { ...entry, birthEvent: entry.birthEvent },
                fromNodeId: entry.fromNodeId, toNodeId: entry.toNodeId,
                presentationLineageId: entry.presentationLineageId,
                sourceLineageId: entry.sourceLineageId,
                carrierAvailable: available,
                developmentProgress: entry.developmentProgress,
                restFrom: entry.restFrom, restTo: entry.restTo,
                isCanopyTwig: true, depthLayer: entry.depthLayer,
                start: posed(entry.from), end: posed(entry.to),
            };
        };
        const visibleCanopyTwigEntries = (canopyTwigVolume?.entries || [])
            .map(poseCanopyEntry).filter(entry => entry.carrierAvailable);
        const currentCanopyById = new Map(visibleCanopyTwigEntries.map(entry => [entry.segment.id, entry]));
        const canopyOrganEntries = (canopyTwigVolume?.plannedEntries || []).map(entry => {
            const current = currentCanopyById.get(entry.id);
            const planned = poseCanopyEntry(entry);
            return current ? { ...planned, start: current.start, end: current.end }
                : { ...planned, carrierAvailable: false };
        });
        const visiblePresentationEntries = [
            ...visibleSegments,
            ...visibleTerminalLabEntries,
            ...visibleCanopyTwigEntries,
        ];
        const showWoodPresentation = mode === 'natural'
            && options.showWoodPresentation !== false;
        if (showWoodPresentation && !woodPresentationOwner) {
            throw new Error(
                '[G15_SCENE] Natural wood presentation owner must load before scene commands.',
            );
        }
        const woodPresentation = showWoodPresentation
            ? woodPresentationOwner.buildWoodPresentation({
                seed: graph.seed ?? graph.options?.seed ?? graph.contract?.seed,
                eventLimit,
                eventTime,
                maximumEvent: developmentClock === undefined ? maximumEvent : developmentClock.maximumEvent,
                maturity: developmentClock === undefined ? undefined : developmentClock.progress,
                projectionScale: camera.serializable.scale,
                vitality: options.vitality || 'steady',
                juvenileAxisRetirements: graph.juvenileAxisRetirements || [],
                entries: visiblePresentationEntries.map((entry) => ({
                    ...entry,
                    startRadiusPx:
                        finite(entry.segment.startRadius, 1)
                            * camera.serializable.scale,
                    endRadiusPx:
                        finite(entry.segment.endRadius, 0.8)
                            * camera.serializable.scale,
                    startRadiusWorld: finite(entry.segment.startRadius, 1),
                    endRadiusWorld: finite(entry.segment.endRadius, 0.8),
                })),
            })
            : null;
        const showSakuraFlowering = mode === 'natural'
            && options.showSakuraFlowering !== false;
        if (showSakuraFlowering && !sakuraFloweringOwner) {
            throw new Error(
                '[G15_SCENE] Sakura flowering presentation owner must load before scene commands.',
            );
        }
        const floweringPresentation = showSakuraFlowering
            ? (terminalLabCanopy
                ? sakuraFloweringOwner.buildSakuraTerminalLabFlowerPresentation({
                    seed: graph.seed ?? graph.options?.seed ?? graph.contract?.seed,
                    bloomProgress: finite(options.bloomProgress, 0.84),
                    floweringLoad: finite(options.floweringLoad, 1.2),
                    scale: camera.serializable.scale,
                    terminalMorphology: terminalLabCanopy,
                })
                : sakuraFloweringOwner.buildSakuraFloweringPresentation({
                seed: graph.seed ?? graph.options?.seed ?? graph.contract?.seed,
                eventLimit,
                bloomProgress: finite(options.bloomProgress, 0.84),
                eventTime,
                dryness: finite(options.dryness, 0),
                floweringLoad: finite(options.floweringLoad, 1.2),
                clusterGrammar: options.flowerClusterGrammar
                    || 'terminal_lab_woven_templates',
                scale: camera.serializable.scale,
                // Structural and canopy stations compete for the same fixed
                // organ reservation budget, including their dormant sites.
                entries: [...structuralOrganEntries, ...canopyOrganEntries].map((entry) => ({
                    ...entry,
                    startRadiusWorld: finite(entry.segment.startRadius, 1),
                    endRadiusWorld: finite(entry.segment.endRadius, 0.8),
                })),
                }))
            : null;
        const commands = [];
        if (options.includeBackground !== false) {
            addBackground(commands, width, height, mode);
        }
        if (options.includePot !== false) {
            addPotBack(commands, camera);
        }

        const visibleLateralMeristems = (graph.lateralMeristems || []).filter(
            (meristem) => (
                finite(meristem.createdAtEvent, Number.POSITIVE_INFINITY)
                    <= eventLimit
                && !(
                    finite(meristem.retiredAtEvent, Number.POSITIVE_INFINITY)
                        <= eventLimit
                )
            ),
        );
        if (options.showClusters) {
            visibleClusters.forEach((cluster, index) => {
                const center = camera.map(pointOf(cluster.center));
                const radius = Math.max(
                    9,
                    finite(cluster.radius, 20) * camera.serializable.scale,
                );
                addCommand(commands, {
                    type: 'circle',
                    x: center.x,
                    y: center.y,
                    r: rounded(radius),
                    fill: index % 2 === 0
                        ? 'rgba(105, 205, 164, 0.035)'
                        : 'rgba(117, 164, 222, 0.035)',
                    stroke: index % 2 === 0
                        ? 'rgba(105, 225, 180, 0.52)'
                        : 'rgba(127, 183, 238, 0.52)',
                    lineWidth: 1,
                });
                addCommand(commands, {
                    type: 'circle',
                    x: center.x,
                    y: center.y,
                    r: 2.4,
                    fill: '#a9f3d9',
                });
            });
        }

        if (options.showOccupancy) {
            visibleSegments.forEach(({ segment, start, end }) => {
                addCommand(commands, {
                    type: 'line',
                    points: [
                        { x: start.x, y: start.y },
                        { x: end.x, y: end.y },
                    ],
                    stroke: 'rgba(73, 204, 181, 0.105)',
                    lineWidth: rounded(Math.max(
                        9,
                        (finite(segment.startRadius, 1)
                            + finite(segment.endRadius, 1) + 6)
                            * camera.serializable.scale,
                    )),
                    lineCap: 'round',
                });
            });
        }

        if (options.showCorridors) {
            activeCorridors
                .sort((left, right) => finite(right.tier, 2) - finite(left.tier, 2))
                .forEach((corridor) => {
                    const points = corridor.points.map((point) => {
                        const projected = camera.map(point);
                        return { x: projected.x, y: projected.y };
                    });
                    addCommand(commands, {
                        type: 'line',
                        points,
                        stroke: 'rgba(61, 207, 187, 0.11)',
                        lineWidth: rounded(Math.max(
                            8,
                            (finite(corridor.radius, 1) * 2 + 12)
                                * camera.serializable.scale,
                        )),
                        lineCap: 'round',
                        lineJoin: 'round',
                    });
                    addCommand(commands, {
                        type: 'line',
                        points,
                        stroke: mode === 'lineage'
                            ? lineageColor(corridor.lineageId)
                            : TIER_COLORS[tierOf(corridor)],
                        lineWidth: 1.15,
                        lineCap: 'round',
                        lineJoin: 'round',
                        alpha: 0.72,
                    });
                    points.slice(1).forEach((point, index) => addCommand(commands, {
                        type: 'circle',
                        x: point.x,
                        y: point.y,
                        r: index === points.length - 2 ? 2.3 : 1.25,
                        fill: 'rgba(156, 255, 235, 0.7)',
                    }));
                });
        }

        const trunkBase = camera.map({ x: 0, y: 0, z: 0 });
        const trunkFoot = resolveTrunkFoot(woodPresentation, trunkBase);
        const nebariPresentation = (nebariOwner && options.showNebari !== false && mode === 'natural')
            ? nebariOwner.buildNebariPresentation({
                trunkBase,
                trunkWidth: trunkFoot.width,
                seed: graph.seed || 150031,
                groundPlane: resolveNebariGroundPlane(options, camera, trunkBase),
                growth: options.growth !== undefined ? options.growth : 1.0,
                vitality: options.vitality || 'steady',
                trunkLean: trunkFoot.lean,
                trunkFill: trunkFoot.bodyFill,
                trunkOutlineFill: trunkFoot.outlineFill,
                options,
            })
            : null;

        // Rear roots seat behind the trunk; the collar and the front roots close
        // over it after the wood is painted, below.
        activeStratum = SCENE_STRATA.GROUND;
        if (nebariPresentation) {
            nebariPresentation.backCommands.forEach((command) => addCommand(commands, command));
        }

        // The rig partition is resolved before anything is painted, so each
        // mark can be tagged with the part that carries it. This is the same
        // trunk-core / limb / cluster split the Pixi baker uses; motion and
        // baking have to agree on it or a branch and its blossoms would move
        // apart the moment the crown is animated.
        const pixiBakingPlan = pixiPartitionerOwner
            ? pixiPartitionerOwner.buildPixiBakingPlan({
                graph,
                woodPresentation,
                floweringPresentation,
                nebariPresentation,
                visibleSegments,
                // Canopy twigs are a synthetic sub-graph grafted onto real wood.
                // They carry their own lineage ids, so the partition needs the
                // graft table to route them; without it a twig's blossoms cite
                // an axis the developmental graph has never heard of.
                canopyTwigEntries: canopyTwigVolume?.entries || null,
            })
            : null;
        // Binding is a lookup in the partition's lineage table, not a search.
        //
        // Both of these used to guess. Wood was matched by mangling a surface id
        // into half a dozen candidate lineage spellings, and a blossom whose
        // lineage carried no wood surface fell through to "nearest limb pivot" —
        // which measures distance to a limb's *base*, so a flower at the tip of
        // one bough would routinely be handed to a different bough entirely and
        // then fly off with it. The partition now names an owner for every
        // lineage in the graph, so both questions are answered by reading it.
        const rigOfLineage = new Map(
            Object.entries(pixiBakingPlan?.lineageRigMap || {}),
        );
        const rigOfJunction = new Map(
            Object.entries(pixiBakingPlan?.junctionRigMap || {}),
        );
        const rigOfSurface = new Map();
        (woodPresentation?.surfaces || []).forEach((surface) => {
            const rigId = rigOfLineage.get(String(surface.lineageId));
            if (rigId) rigOfSurface.set(surface.id, rigId);
        });

        const rigForSurface = (surfaceId) => {
            if (!surfaceId) return null;
            return rigOfSurface.get(surfaceId) || rigOfJunction.get(surfaceId) || null;
        };

        const rigForLineage = (lineageId) => {
            if (lineageId === undefined || lineageId === null) return null;
            if (!pixiBakingPlan) return null;
            const rigId = rigOfLineage.get(String(lineageId));
            if (!rigId) {
                // The partition covers every lineage the graph declares. A miss
                // means this mark cites an axis the tree does not have, which is
                // a broken carrier rather than a placement to approximate.
                throw new Error(
                    `ZEN_BONSAI_G15_RIG_LINEAGE_UNKNOWN:${String(lineageId)}`,
                );
            }
            return rigId;
        };

        activeStratum = SCENE_STRATA.BLOSSOM_BACK;
        floweringPresentation?.backCommands.forEach(
            (command) => addCommand(commands, riggedFloweringCommand(command, rigForLineage)),
        );
        activeStratum = SCENE_STRATA.WOOD;
        if (woodPresentation) {
            appendWoodPresentation(
                commands,
                woodPresentation,
                rigForSurface,
                rigForLineage,
            );
        } else {
            visibleSegments.forEach((entry) => appendSegment(
                commands,
                entry,
                mode,
                eventLimit,
                camera.serializable.scale,
            ));
            visibleCanopyTwigEntries.forEach((entry) => appendSegment(
                commands,
                entry,
                mode,
                eventLimit,
                camera.serializable.scale,
            ));
            visibleTerminalLabEntries.forEach((entry) => appendSegment(
                commands,
                entry,
                mode,
                eventLimit,
                camera.serializable.scale,
            ));
        }
        activeStratum = SCENE_STRATA.ORNAMENT_FRONT;
        if (nebariPresentation) {
            nebariPresentation.frontCommands.forEach((command) => addCommand(commands, command));
        }
        if (canopyTwigVolume && options.showCanopyTwigDepth) {
            visibleCanopyTwigEntries.forEach((entry) => addCommand(commands, {
                type: 'line',
                points: [entry.start, entry.end],
                stroke: entry.depthLayer === 'behind_wood'
                    ? 'rgba(92, 155, 255, 0.82)'
                    : (entry.depthLayer === 'in_front_of_wood'
                        ? 'rgba(255, 139, 103, 0.86)'
                        : 'rgba(226, 205, 108, 0.82)'),
                lineWidth: 1.1,
                lineCap: 'round',
            }));
        }
        if (terminalLabCanopy && options.showTerminalLabReceipts) {
            terminalLabCanopy.receipts.forEach((receipt) => {
                const socketPoint = {
                    x: receipt.socket.point[0],
                    y: receipt.socket.point[1],
                };
                addCommand(commands, {
                    type: 'circle',
                    x: socketPoint.x,
                    y: socketPoint.y,
                    r: 4.2,
                    fill: 'rgba(255, 188, 92, 0.18)',
                    stroke: '#FFC66D',
                    lineWidth: 1,
                });
                addCommand(commands, {
                    type: 'line',
                    points: [
                        socketPoint,
                        {
                            x: socketPoint.x + receipt.socket.tangent[0] * 18,
                            y: socketPoint.y + receipt.socket.tangent[1] * 18,
                        },
                    ],
                    stroke: 'rgba(255, 198, 109, 0.78)',
                    lineWidth: 0.9,
                    lineCap: 'round',
                });
            });
        }
        if (floweringPresentation && options.showCanopyWash !== false) {
            for (const family of floweringPresentation.families) {
                const organs = (family.organStates || [])
                    .map(organ => ({ ...organ, washWeight: organ.presence * organ.openFraction }))
                    .filter(organ => organ.washWeight > 1e-6);
                if (!organs.length) continue;
                const weight = organs.reduce((sum, organ) => sum + organ.washWeight, 0);
                if (weight <= 0) continue;
                const x = organs.reduce((sum, organ) => sum + organ.center.x * organ.washWeight, 0) / weight;
                const y = organs.reduce((sum, organ) => sum + organ.center.y * organ.washWeight, 0) / weight;
                const radius = Math.sqrt(organs.reduce((sum, organ) => sum + organ.washWeight
                    * ((organ.center.x - x) ** 2 + (organ.center.y - y) ** 2), 0) / weight)
                    + 3.5 * camera.serializable.scale / 0.64;
                addCommand(commands, {
                    type: 'inkWash', x: rounded(x), y: rounded(y),
                    rx: rounded(radius), ry: rounded(radius * 0.8), fill: '#c6a8ac',
                    alpha: rounded(Math.min(0.08, weight * 0.025), 5), mass: true,
                    organFamilyId: family.id, rig: rigForLineage(family.sourceLineageId),
                });
            }
        }
        floweringPresentation?.frontCommands.forEach(
            (command) => addCommand(commands, riggedFloweringCommand(command, rigForLineage)),
        );
        if (floweringPresentation && options.showSakuraFloweringSites) {
            floweringPresentation.debugCommands.forEach(
                (command) => addCommand(commands, command),
            );
        }

        // A live lateral is a real branch junction, but not a parent-consuming
        // recursive fork. Give it its own marker instead of reusing the yellow
        // fork receipt and erasing that topological distinction.
        const showLateralJunctionMarkers = mode !== 'natural'
            || options.showForkReceipts
            || options.showLateralMeristems;
        let lateralJunctionMarkerCount = 0;
        if (showLateralJunctionMarkers) {
            const meristemMap = new Map(visibleLateralMeristems.map(
                (meristem) => [meristem.id, meristem],
            ));
            visibleLateralEmissions.forEach((emissionEvent) => {
                const emission = emissionEvent.steering?.lateralEmission;
                const meristem = meristemMap.get(emission?.meristemId);
                const origin = meristem ? nodeMap.get(meristem.nodeId) : null;
                if (!origin) return;
                const point = camera.map(pointOf(origin));
                lateralJunctionMarkerCount += 1;
                addCommand(commands, {
                    type: 'circle',
                    x: point.x,
                    y: point.y,
                    r: 3.85,
                    fill: 'rgba(73, 219, 205, 0.12)',
                    stroke: '#55d8cf',
                    lineWidth: 1.05,
                });
                addCommand(commands, {
                    type: 'circle',
                    x: point.x,
                    y: point.y,
                    r: 1.15,
                    fill: '#b8fff4',
                });
            });
        }

        receipts.forEach((receipt) => {
            if (!receipt.point) return;
            const point = camera.map(receipt.point);
            const tier = receipt.children[0]?.tier ?? 0;
            const debug = mode !== 'natural' || options.showForkReceipts;
            if (debug) {
                addCommand(commands, {
                    type: 'circle',
                    x: point.x,
                    y: point.y,
                    r: 5.2,
                    fill: 'rgba(255, 222, 85, 0.18)',
                    stroke: '#f5d265',
                    lineWidth: 1.15,
                });
                addCommand(commands, {
                    type: 'circle',
                    x: point.x,
                    y: point.y,
                    r: 2.05,
                    fill: TIER_COLORS[tier],
                });
            } else if (!woodPresentation) {
                addCommand(commands, {
                    type: 'circle',
                    x: point.x,
                    y: point.y,
                    r: rounded(clamp(
                        receipt.junctionRadius * camera.serializable.scale * 0.78,
                        1.5,
                        18,
                    )),
                    fill: '#805a40',
                });
                addCommand(commands, {
                    type: 'circle',
                    x: point.x - 0.7,
                    y: point.y - 0.6,
                    r: rounded(clamp(
                        receipt.junctionRadius * camera.serializable.scale * 0.36,
                        0.7,
                        7,
                    )),
                    fill: 'rgba(220, 174, 118, 0.13)',
                });
            }
        });

        if (options.showNodes || mode === 'causal') {
            graph.nodes
                .filter((node) => numericSequence(node, 0) <= eventLimit)
                .forEach((node) => {
                    const point = camera.map(pointOf(node));
                    const latest = numericSequence(node, -1) === eventLimit;
                    addCommand(commands, {
                        type: 'circle',
                        x: point.x,
                        y: point.y,
                        r: latest ? 3.1 : 1.55,
                        fill: latest ? '#fff09a' : 'rgba(214, 230, 219, 0.62)',
                        stroke: latest ? '#352e17' : undefined,
                        lineWidth: latest ? 0.8 : undefined,
                    });
                });
        }

        if (options.showFrontiers || mode === 'causal') {
            activeFrontierIds.forEach((frontierId) => {
                const frontier = frontierMap.get(frontierId);
                const node = frontier ? nodeMap.get(frontier.nodeId) : null;
                if (!node) return;
                const point = camera.map(pointOf(node));
                addCommand(commands, {
                    type: 'circle',
                    x: point.x,
                    y: point.y,
                    r: 6.1,
                    fill: 'rgba(76, 225, 202, 0.14)',
                    stroke: '#54d7c2',
                    lineWidth: 1.25,
                });
                addCommand(commands, {
                    type: 'circle',
                    x: point.x,
                    y: point.y,
                    r: 2.1,
                    fill: '#a8ffea',
                });
            });
        }

        if (options.showPixiRigOverlay && pixiBakingPlan) {
            const trunk = pixiBakingPlan.trunkCore;
            if (trunk && trunk.bounds.width > 0) {
                addCommand(commands, {
                    type: 'polygon',
                    points: [
                        { x: trunk.bounds.minX, y: trunk.bounds.minY },
                        { x: trunk.bounds.maxX, y: trunk.bounds.minY },
                        { x: trunk.bounds.maxX, y: trunk.bounds.maxY },
                        { x: trunk.bounds.minX, y: trunk.bounds.maxY },
                    ],
                    stroke: '#4ade80',
                    lineWidth: 1.2,
                    dash: [4, 4],
                    fill: 'rgba(74, 222, 128, 0.05)',
                });
                addCommand(commands, {
                    type: 'circle',
                    x: trunk.pivot.x,
                    y: trunk.pivot.y,
                    r: 4.5,
                    fill: '#4ade80',
                });
                addCommand(commands, {
                    type: 'text',
                    text: 'TIER 1: TRUNK CORE',
                    x: trunk.bounds.minX + 4,
                    y: trunk.bounds.maxY - 6,
                    fill: '#4ade80',
                    font: 'bold 9px monospace',
                });
            }

            pixiBakingPlan.limbs.forEach((limb, idx) => {
                if (limb.bounds.width > 0) {
                    addCommand(commands, {
                        type: 'polygon',
                        points: [
                            { x: limb.bounds.minX, y: limb.bounds.minY },
                            { x: limb.bounds.maxX, y: limb.bounds.minY },
                            { x: limb.bounds.maxX, y: limb.bounds.maxY },
                            { x: limb.bounds.minX, y: limb.bounds.maxY },
                        ],
                        stroke: '#38bdf8',
                        lineWidth: 1.1,
                        dash: [5, 3],
                        fill: 'rgba(56, 189, 248, 0.04)',
                    });
                    addCommand(commands, {
                        type: 'circle',
                        x: limb.pivot.x,
                        y: limb.pivot.y,
                        r: 4.0,
                        fill: '#38bdf8',
                    });
                    addCommand(commands, {
                        type: 'text',
                        text: `LIMB ${idx}: ${limb.limbKey}`,
                        x: limb.bounds.minX + 4,
                        y: limb.bounds.minY + 12,
                        fill: '#38bdf8',
                        font: 'bold 9px monospace',
                    });
                }
            });

            pixiBakingPlan.canopyClusters.forEach((cluster) => {
                addCommand(commands, {
                    type: 'circle',
                    x: cluster.centroid.x,
                    y: cluster.centroid.y,
                    r: cluster.radius,
                    stroke: '#fbbf24',
                    lineWidth: 1.0,
                    dash: [3, 3],
                    fill: 'rgba(251, 191, 36, 0.06)',
                });
                addCommand(commands, {
                    type: 'circle',
                    x: cluster.centroid.x,
                    y: cluster.centroid.y,
                    r: 2.5,
                    fill: '#fbbf24',
                });
                addCommand(commands, {
                    type: 'text',
                    text: `🌸 ${cluster.flowerCount}`,
                    x: cluster.centroid.x - 8,
                    y: cluster.centroid.y + 3,
                    fill: '#fbbf24',
                    font: 'bold 9px monospace',
                });
            });
        }

        if (options.showLateralMeristems || mode === 'causal') {
            visibleLateralMeristems.forEach((meristem) => {
                // Emitted sites already own the teal live-junction marker.
                // Pink remains the state marker for a site that has not yet
                // become branch geometry.
                if (meristem.status === 'emitted') return;
                const node = nodeMap.get(meristem.nodeId);
                if (!node) return;
                const point = camera.map(pointOf(node));
                addCommand(commands, {
                    type: 'circle',
                    x: point.x,
                    y: point.y,
                    r: 4.15,
                    fill: 'rgba(255, 117, 201, 0.13)',
                    stroke: '#ff91cf',
                    lineWidth: 1.05,
                });
                addCommand(commands, {
                    type: 'circle',
                    x: point.x,
                    y: point.y,
                    r: 1.25,
                    fill: '#ffd2eb',
                });
            });
        }

        if (options.includePot !== false) {
            addPotFront(commands, camera);
        }
        if (options.showBalance) {
            addBalanceOverlay(commands, balanceField, camera, width, height);
        }
        if (options.showForkReceipts) {
            addForkReceiptOverlays(commands, receipts, camera, options, width, height);
        }

        const description = describeEvent(event);
        const sceneCore = {
            contractId: CONTRACT_ID,
            width,
            height,
            camera: camera.serializable,
            commands,
            eventLimit,
            mode,
        };
        const signature = signatureFor(sceneCore);
        const renderProvenance = Object.freeze({
            semantics: 'g15_4_scene_render_provenance_v1',
            graphSeed: graph.seed ?? graph.options?.seed ?? graph.contract?.seed ?? null,
            mode,
            eventLimit,
            eventCount: events.length,
            developmentClock: developmentClock === undefined ? null : developmentClock,
            specimenGrowth,
            presentationOptions: Object.freeze({
                naturalWoodSurface: options.showWoodPresentation !== false,
                terminalLabCanopy: options.showTerminalLabCanopy === true,
                canopyTwigVolume: options.showCanopyTwigVolume !== false,
                sakuraFlowering: options.showSakuraFlowering !== false,
            }),
        });
        const metadata = Object.freeze({
            modelId: String(graph.modelId ?? graph.model ?? 'unreported'),
            graphContractId: String(graph.contractId ?? graph.contract ?? 'unreported'),
            commandOwner: CONTRACT_ID,
            cameraMode: camera.serializable.mode,
            mode,
            eventLimit,
            eventCount: events.length,
            renderProvenance,
            visibleSegmentCount: visibleSegments.length,
            specimenGrowth,
            visibleJuvenileSacrificeSegmentCount: visibleSegments.filter(
                (entry) => entry.segment.developmentalRole
                    === 'juvenile_sacrifice_axis',
            ).length,
            realizedJuvenileAxisRetirementCount:
                (graph.juvenileAxisRetirements || []).filter(
                    (retirement) => retirement.retiredAtEvent <= eventLimit,
                ).length,
            activeFrontierCount: activeFrontierIds.length,
            activeCorridorCount: activeCorridors.length,
            visibleClusterCount: visibleClusters.length,
            visibleLateralMeristemCount: visibleLateralMeristems.length,
            visibleLateralEmissionCount: visibleLateralEmissions.length,
            lateralJunctionMarkerCount,
            canopyTwigVolumeVisible: Boolean(canopyTwigVolume),
            canopyTwigVolumeContractId: canopyTwigVolume?.contractId ?? null,
            canopyTwigAnchorCount: canopyTwigVolume?.anchorCount ?? 0,
            canopyTwigTargetAnchorCount: canopyTwigVolume?.targetAnchorCount ?? 0,
            canopyTwigSegmentCount: canopyTwigVolume?.segmentCount ?? 0,
            canopyTwigSplitCount: canopyTwigVolume?.splitTwigCount ?? 0,
            canopyTwigBackCount: canopyTwigVolume?.backTwigCount ?? 0,
            canopyTwigMiddleCount: canopyTwigVolume?.middleTwigCount ?? 0,
            canopyTwigFrontCount: canopyTwigVolume?.frontTwigCount ?? 0,
            canopyTwigProjectedContinuityAdjustedCount:
                canopyTwigVolume?.projectedContinuityAdjustedCount ?? 0,
            canopyTwigMeanProjectedReleaseAngleDegrees:
                canopyTwigVolume?.meanProjectedReleaseAngleDegrees ?? 0,
            canopyTwigMaximumProjectedReleaseAngleDegrees:
                canopyTwigVolume?.maximumProjectedReleaseAngleDegrees ?? 0,
            terminalLabCanopyVisible: Boolean(terminalLabCanopy),
            terminalLabAdapterContractId: terminalLabCanopy?.contractId ?? null,
            terminalLabPlanContract: terminalLabCanopy?.labPlanContract ?? null,
            terminalLabCandidateCount: terminalLabCanopy?.candidateCount ?? 0,
            terminalLabTargetSocketCount: terminalLabCanopy?.targetSocketCount ?? 0,
            terminalLabSocketCount: terminalLabCanopy?.socketCount ?? 0,
            terminalLabAxisCount: terminalLabCanopy?.axisCount ?? 0,
            terminalLabSpurCount: terminalLabCanopy?.spurCount ?? 0,
            terminalLabClusterCount: terminalLabCanopy?.clusterCount ?? 0,
            terminalLabOrganCount: terminalLabCanopy?.organCount ?? 0,
            terminalLabClusterZoneUsage: terminalLabCanopy?.clusterZoneUsage ?? null,
            terminalLabClusterTemplateUsage:
                terminalLabCanopy?.clusterTemplateUsage ?? null,
            woodPresentationVisible: Boolean(woodPresentation),
            woodPresentationContractId: woodPresentation?.contractId ?? null,
            woodSpeciesPresentation: woodPresentation?.speciesPresentation ?? null,
            woodVectorTopologySemantics:
                woodPresentation?.vectorTopologySemantics ?? null,
            woodVectorTopologySignature:
                woodPresentation?.vectorTopologySignature ?? null,
            woodReferenceProjectionScale:
                woodPresentation?.referenceProjectionScale ?? null,
            woodSurfaceCount: woodPresentation?.surfaceCount ?? 0,
            woodJunctionCount: woodPresentation?.junctionCount ?? 0,
            woodLateralJunctionCount: woodPresentation?.lateralJunctionCount ?? 0,
            woodForkJunctionCount: woodPresentation?.forkJunctionCount ?? 0,
            woodTrunkHandoffJunctionCount:
                woodPresentation?.trunkHandoffJunctionCount ?? 0,
            woodTrunkBifurcationJunctionCount:
                woodPresentation?.trunkBifurcationJunctionCount ?? 0,
            woodStructuralTrunkBranchJunctionCount:
                woodPresentation?.structuralTrunkBranchJunctionCount ?? 0,
            woodStructuralTrunkBranchSurfaceCount:
                woodPresentation?.structuralTrunkBranchSurfaceCount ?? 0,
            woodStructuralTrunkBranchHeadInsetCount:
                woodPresentation?.structuralTrunkBranchHeadInsetCount ?? 0,
            woodBasalFlareSurfaceCount:
                woodPresentation?.basalFlareSurfaceCount ?? 0,
            woodTrunkAxisHandoffPatchCount:
                woodPresentation?.trunkAxisHandoffPatchCount ?? 0,
            woodTextureStrokeCount: woodPresentation?.textureStrokeCount ?? 0,
            sakuraOrganLayerEnabled: Boolean(floweringPresentation),
            sakuraFloweringVisible: (floweringPresentation?.entityCount ?? 0) > 0,
            sakuraReservedSiteCount: floweringPresentation?.reservedSiteCount ?? 0,
            sakuraVegetativeBudCount: floweringPresentation?.vegetativeBudCount ?? 0,
            sakuraFloweringContractId: floweringPresentation?.contractId ?? null,
            sakuraFloweringSemantics: floweringPresentation?.semantics ?? null,
            sakuraFloweringClusterGrammar:
                floweringPresentation?.clusterGrammar ?? null,
            sakuraFloweringHabit: floweringPresentation?.habit ?? null,
            sakuraFloweringCandidateCount:
                floweringPresentation?.candidateCount ?? 0,
            sakuraFloweringBudgetBasisEntryCount:
                floweringPresentation?.budgetBasisEntryCount ?? 0,
            sakuraFloweringTargetSiteCount:
                floweringPresentation?.targetSiteCount ?? 0,
            pixiBakingPlanContractId: pixiBakingPlan?.contract ?? null,
            pixiBakingLimbCount: pixiBakingPlan?.limbs?.length ?? 0,
            pixiBakingClusterCount: pixiBakingPlan?.canopyClusters?.length ?? 0,
            pixiBakingReductionPercentage: pixiBakingPlan?.stats?.reductionPercentage ?? 0,
            pixiBakingPlan,
            rigParts: Object.freeze([
                // The trunk is a rig now, not an absence. It barely moves —
                // its girth sees to that — but the fraction of a degree it does
                // move is inherited coherently by everything above it, which is
                // what stops the crown reading as things animated in front of a
                // still photograph.
                pixiBakingPlan?.trunkCore || null,
                ...(pixiBakingPlan?.limbs || []),
            ].filter(Boolean).map((part) => Object.freeze({
                id: part.id,
                // Without these two the rig is not a rig. Motion reads them to
                // tell a bough from the twig hanging off it, and to compose one
                // onto the other; when the projection dropped them every part
                // silently became a top-level bough swinging at full amplitude
                // about its own pivot, which is what made the crown fly apart.
                tier: part.tier,
                parentLimbId: part.parentLimbId ?? null,
                pivot: Object.freeze({
                    x: rounded(part.pivot.x),
                    y: rounded(part.pivot.y),
                }),
                // The partitioner resolves how stiff a piece of wood is, how
                // fast it wants to ring, which way it points, and how far the
                // wind has had to travel to reach it. Motion reads those rather
                // than inventing a second opinion about the same rig.
                length: rounded(finite(part.length, 1), 2),
                baseAngleRad: rounded(finite(part.baseAngleRad, 0), 4),
                stiffness: rounded(finite(part.stiffness, 0.6), 3),
                naturalFrequencyHz: rounded(finite(part.naturalFrequencyHz, 1), 3),
                pathFraction: rounded(finite(part.pathFraction, 0), 4),
            }))),
            nebariContractId: nebariPresentation?.contract ?? null,
            nebariRootCount: nebariPresentation?.rootCount ?? 0,
            nebariRootBaseWidth: nebariPresentation?.rootBaseWidth ?? 0,
            nebariPresentation,
            sakuraFloweringSiteCount: floweringPresentation?.siteCount ?? 0,
            sakuraFloweringBudgetedSiteCount:
                floweringPresentation?.budgetedSiteCount ?? 0,
            sakuraFloweringAccessorySiteCount:
                floweringPresentation?.accessorySiteCount ?? 0,
            sakuraFloweringCanopyTwigSiteCount:
                floweringPresentation?.canopyTwigSiteCount ?? 0,
            sakuraFloweringStructuralSiteCount:
                floweringPresentation?.structuralSiteCount ?? 0,
            sakuraFloweringTargetCanopyTwigShare:
                floweringPresentation?.targetCanopyTwigShare ?? 0,
            sakuraFloweringCanopyCarrierCoverage:
                floweringPresentation?.canopyCarrierCoverage ?? null,
            sakuraFloweringFamilyCount: floweringPresentation?.familyCount ?? 0,
            sakuraFloweringEntityCount: floweringPresentation?.entityCount ?? 0,
            sakuraFloweringRosetteCount: floweringPresentation?.rosetteCount ?? 0,
            sakuraFloweringSpurSegmentCount:
                floweringPresentation?.spurSegmentCount ?? 0,
            sakuraFloweringStageCounts: floweringPresentation?.stageCounts ?? null,
            sakuraFloweringSizeMultiplier:
                floweringPresentation?.flowerSizeMultiplier ?? null,
            sakuraFloweringDisplayScale:
                floweringPresentation?.flowerDisplayScale ?? null,
            sakuraFloweringProjection:
                floweringPresentation?.flowerProjection ?? null,
            sakuraFloweringCoverageCompletion:
                floweringPresentation?.coverageCompletion ?? null,
            sakuraFloweringFloralCompletion:
                floweringPresentation?.floralCompletion ?? null,
            sakuraFloweringCarrierContinuity:
                floweringPresentation?.carrierContinuity ?? null,
            sakuraFloweringProjectedAtlasContract:
                floweringPresentation?.projectedAtlasContract ?? null,
            sakuraFloweringProjectedAtlasCounts:
                floweringPresentation?.projectedAtlasCounts ?? null,
            sakuraFloweringProjectedBlossomCount:
                floweringPresentation?.projectedBlossomCount ?? 0,
            sakuraFloweringFamilyKindCounts:
                floweringPresentation?.familyKindCounts ?? null,
            forkReceiptCount: receipts.length,
            balanceFieldVisible: Boolean(options.showBalance && balanceField),
            nodeCount: graph.nodes.length,
            commandCount: commands.length,
            signature,
        });
        return Object.freeze({
            contractId: CONTRACT_ID,
            width,
            height,
            commands: Object.freeze(commands),
            camera: camera.serializable,
            signature,
            metadata,
            renderProvenance,
            mode,
            eventLimit,
            event,
            description,
            activeFrontierCount: activeFrontierIds.length,
            activeCorridorCount: activeCorridors.length,
            visibleClusterCount: visibleClusters.length,
            visibleLateralMeristemCount: visibleLateralMeristems.length,
            visibleLateralEmissionCount: visibleLateralEmissions.length,
            lateralJunctionMarkerCount,
            visibleSegmentCount: visibleSegments.length,
            specimenGrowth,
            forkReceipts: Object.freeze(receipts),
            floweringFamilies: floweringPresentation?.families ?? Object.freeze([]),
            canopyTwigReceipts: canopyTwigVolume?.receipts ?? Object.freeze([]),
            terminalLabReceipts: terminalLabCanopy?.receipts ?? Object.freeze([]),
            balanceField: balanceField ? Object.freeze({ ...balanceField }) : null,
            viewport: Object.freeze({
                width,
                height,
                scale: camera.serializable.scale,
            }),
        });
    }

    scope.ZenBonsaiTypedDevelopmentalSchedulerScene = Object.freeze({
        contractId: CONTRACT_ID,
        modes: MODES,
        tierColors: TIER_COLORS,
        buildSceneCommands,
        resolveCameraBounds,
        describeEvent,
        projectPoint,
    });
}(globalThis));
