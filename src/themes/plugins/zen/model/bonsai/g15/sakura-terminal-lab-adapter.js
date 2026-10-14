/**
 * G15.4 -> canonical Sakura Terminal Morphology Lab adapter.
 *
 * This owner negotiates completed projected wood into TerminalSocket inputs and
 * translates the canonical lab plan back into paint-ready wood/organ records.
 * It owns no terminal branching, spur, cluster-template, or blossom-pose rule.
 */
import {
    createSakuraTerminalMorphologyPlan,
    SAKURA_TERMINAL_MORPHOLOGY_PLAN_CONTRACT,
} from './ZenBonsaiG15TerminalMorphology.js';

(function installSakuraTerminalLabAdapter(scope) {
    'use strict';

    const CONTRACT_ID = 'g15_4_sakura_terminal_lab_socket_adapter_v1';
    const LAB_PLAN_CONTRACT = 'zen_sakura_terminal_morphology_plan_v2';
    if (
        SAKURA_TERMINAL_MORPHOLOGY_PLAN_CONTRACT !== LAB_PLAN_CONTRACT
    ) {
        throw new Error(
            '[G15_TERMINAL_ADAPTER] Canonical Sakura Terminal Morphology Lab runtime is required.',
        );
    }

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

    function randomUnit(seed, channel) {
        let value = hashString(`${seed}:${channel}`) || 1;
        value ^= value << 13;
        value ^= value >>> 17;
        value ^= value << 5;
        return (value >>> 0) / 4294967296;
    }

    function point(value, label) {
        if (
            !value
            || !Number.isFinite(Number(value.x))
            || !Number.isFinite(Number(value.y))
        ) {
            throw new TypeError(`[G15_TERMINAL_ADAPTER] ${label} requires a projected point.`);
        }
        return {
            x: Number(value.x),
            y: Number(value.y),
            depth: finite(value.depth),
        };
    }

    function normalize(vector, fallback = { x: 0, y: -1 }) {
        const magnitude = Math.hypot(vector.x, vector.y);
        if (magnitude < 1e-7) return { ...fallback };
        return { x: vector.x / magnitude, y: vector.y / magnitude };
    }

    function distance(left, right) {
        return Math.hypot(right.x - left.x, right.y - left.y);
    }

    function normalizeEntry(value, index) {
        const segment = value?.segment || {};
        const start = point(value?.start, `entry ${index} start`);
        const end = point(value?.end, `entry ${index} end`);
        return {
            id: String(segment.id ?? value.id ?? `terminal-source-${index}`),
            lineageId: String(
                value.presentationLineageId
                    ?? segment.lineageId
                    ?? value.lineageId
                    ?? `terminal-lineage-${index}`,
            ),
            fromNodeId: String(value.fromNodeId ?? segment.fromNodeId ?? `${index}:from`),
            toNodeId: String(value.toNodeId ?? segment.toNodeId ?? `${index}:to`),
            tier: clamp(Math.round(finite(segment.tier ?? segment.axisOrder, 2)), 0, 3),
            sequence: finite(segment.sequence ?? segment.birthEvent, index),
            startRadiusPx: Math.max(0.25, finite(value.startRadiusPx, 1)),
            endRadiusPx: Math.max(0.2, finite(value.endRadiusPx, 0.7)),
            start,
            end,
            length: distance(start, end),
        };
    }

    function boundsFor(entries) {
        const points = entries.flatMap((entry) => [entry.start, entry.end]);
        const minX = Math.min(...points.map((item) => item.x));
        const maxX = Math.max(...points.map((item) => item.x));
        const minY = Math.min(...points.map((item) => item.y));
        const maxY = Math.max(...points.map((item) => item.y));
        return {
            minX,
            maxX,
            minY,
            maxY,
            width: Math.max(1, maxX - minX),
            height: Math.max(1, maxY - minY),
            centerX: (minX + maxX) * 0.5,
        };
    }

    function candidateRole(candidate) {
        if (candidate.height > 0.72 && candidate.radial < 0.48) return 'apex-rise';
        if (candidate.radial > 0.56) return 'outer-edge';
        return 'pad-interior';
    }

    function buildSocketCandidates(entries, seed) {
        const bounds = boundsFor(entries);
        const outgoing = new Map();
        entries.forEach((entry) => {
            if (!outgoing.has(entry.fromNodeId)) outgoing.set(entry.fromNodeId, []);
            outgoing.get(entry.fromNodeId).push(entry);
        });
        const maximumRadius = Math.max(...entries.map((entry) => entry.endRadiusPx));
        const candidates = entries
            .filter((entry) => entry.length >= 10)
            .map((entry) => {
                const childCount = (outgoing.get(entry.toNodeId) || []).length;
                const tangent = normalize({
                    x: entry.end.x - entry.start.x,
                    y: entry.end.y - entry.start.y,
                });
                const height = clamp((bounds.maxY - entry.end.y) / bounds.height, 0, 1);
                const radial = clamp(
                    Math.abs(entry.end.x - bounds.centerX) / (bounds.width * 0.5),
                    0,
                    1,
                );
                const slenderness = clamp(
                    1 - entry.endRadiusPx / Math.max(0.5, maximumRadius * 0.62),
                    0,
                    1,
                );
                const terminal = childCount === 0;
                const baseScore = slenderness * 0.28
                    + height * 0.18
                    + (terminal ? 0.08 : 0.2)
                    + (1 - Math.abs(radial - 0.48)) * 0.12
                    + randomUnit(seed, `socket-candidate:${entry.id}`) * 0.22;
                const candidate = {
                    id: `terminal-socket-candidate:${entry.toNodeId}`,
                    entry,
                    point: entry.end,
                    tangent,
                    normal: { x: -tangent.y, y: tangent.x },
                    childCount,
                    terminal,
                    height,
                    radial,
                    slenderness,
                    baseScore,
                };
                candidate.role = candidateRole(candidate);
                return candidate;
            })
            .filter((candidate) => (
                candidate.height >= 0.2
                && candidate.entry.endRadiusPx <= maximumRadius * 0.58
            ));
        return { candidates, bounds };
    }

    function selectSocketCandidates(candidates, bounds, seed, socketLoad) {
        const target = clamp(Math.round(
            (4 + Math.sqrt(candidates.length) * 0.26)
                * clamp(socketLoad, 0.4, 1.35),
        ), 4, 8);
        const selected = [];
        const available = [...candidates];
        const minimumSpacing = clamp(bounds.width * 0.16, 48, 92);
        while (available.length > 0 && selected.length < target) {
            let bestIndex = -1;
            let bestScore = Number.NEGATIVE_INFINITY;
            available.forEach((candidate, index) => {
                const nearestDistance = selected.length
                    ? Math.min(...selected.map((owned) => distance(owned.point, candidate.point)))
                    : minimumSpacing * 1.4;
                const spacing = clamp(nearestDistance / minimumSpacing, 0, 1.6);
                const sameLineage = selected.some(
                    (owned) => owned.entry.lineageId === candidate.entry.lineageId,
                );
                const sameRoleCount = selected.filter(
                    (owned) => owned.role === candidate.role,
                ).length;
                const internalNeed = selected.length >= 2
                    && selected.filter((owned) => !owned.terminal).length
                        < Math.ceil((selected.length + 1) * 0.46);
                const score = candidate.baseScore
                    + spacing * 0.42
                    + (internalNeed && !candidate.terminal ? 0.22 : 0)
                    - (sameLineage ? 0.28 : 0)
                    - sameRoleCount * 0.035
                    + randomUnit(seed, `socket-selection:${selected.length}:${candidate.id}`) * 0.04;
                if (score > bestScore) {
                    bestIndex = index;
                    bestScore = score;
                }
            });
            if (bestIndex < 0) break;
            const [winner] = available.splice(bestIndex, 1);
            if (
                selected.length >= 2
                && selected.some((owned) => distance(owned.point, winner.point) < minimumSpacing * 0.62)
            ) {
                continue;
            }
            selected.push(winner);
        }
        return { selected, target, minimumSpacing };
    }

    function strategyFor(seed, index, role) {
        const roleSpread = role === 'pad-interior' ? 0.08 : (role === 'apex-rise' ? -0.07 : 0.03);
        return Object.freeze({
            forkFrequency: rounded(clamp(
                0.48 + randomUnit(seed, `terminal-strategy:${index}:fork`) * 0.32,
                0,
                1,
            )),
            forkSpread: rounded(clamp(
                0.43 + randomUnit(seed, `terminal-strategy:${index}:spread`) * 0.25 + roleSpread,
                0,
                1,
            )),
            lateralVigor: rounded(clamp(
                0.5 + randomUnit(seed, `terminal-strategy:${index}:vigor`) * 0.26,
                0,
                1,
            )),
        });
    }

    function socketFromCandidate(candidate, context, index) {
        const { bounds, seed, scale, density, interiorFill, clusterCoverage } = context;
        const roleLength = candidate.role === 'pad-interior'
            ? 0.35
            : (candidate.role === 'apex-rise' ? 0.29 : 0.33);
        const regionLength = clamp(
            Math.min(bounds.width, bounds.height) * roleLength
                * (1.55 + randomUnit(seed, `socket:${index}:length`) * 0.24),
            240,
            340,
        );
        const halfWidth = clamp(
            regionLength * (
                candidate.role === 'pad-interior' ? 0.52 : 0.44
            ),
            104,
            168,
        );
        const geometryScale = clamp(
            0.59 + randomUnit(seed, `socket:${index}:geometry-scale`) * 0.08,
            0.58,
            0.69,
        );
        const sideSign = randomUnit(seed, `socket:${index}:side`) < 0.5 ? -1 : 1;
        const localInteriorFill = clamp(
            interiorFill
                + (candidate.role === 'pad-interior' ? 0.1 : -0.04)
                + (randomUnit(seed, `socket:${index}:interior`) - 0.5) * 0.1,
            0.25,
            1,
        );
        const localDensity = clamp(
            density + (randomUnit(seed, `socket:${index}:density`) - 0.5) * 0.12,
            0.35,
            1,
        );
        const localCoverage = clamp(
            clusterCoverage
                + (randomUnit(seed, `socket:${index}:coverage`) - 0.5) * 0.12,
            0,
            1,
        );
        const twigBudget = clamp(Math.round(10 + localDensity * 5), 10, 15);
        const spurBudget = clamp(Math.round(12 + localDensity * 6), 12, 18);
        const clusterBudget = clamp(Math.round(9 + localDensity * 5), 9, 14);
        const socket = Object.freeze({
            id: `g15-terminal-socket:${candidate.entry.toNodeId}`,
            terminalId: `g15-terminal:${candidate.entry.toNodeId}`,
            parentAxisId: candidate.entry.lineageId,
            point: Object.freeze([rounded(candidate.point.x), rounded(candidate.point.y)]),
            tangent: Object.freeze([rounded(candidate.tangent.x), rounded(candidate.tangent.y)]),
            normal: Object.freeze([rounded(candidate.normal.x), rounded(candidate.normal.y)]),
            sideSign,
            terminalRadius: rounded(clamp(candidate.entry.endRadiusPx * 0.72, 0.62, 2.4)),
            order: candidate.entry.tier + 2,
            depth: candidate.entry.tier + 2,
            terminalRegion: Object.freeze({
                length: rounded(regionLength),
                halfWidth: rounded(halfWidth),
            }),
            budget: Object.freeze({
                twig: twigBudget,
                spur: spurBudget,
                cluster: clusterBudget,
            }),
            crownMassId: `g15-crown:${candidate.role}`,
            padId: `g15-pad:${candidate.entry.toNodeId}`,
            seed: hashString(`${seed}:terminal-socket:${candidate.entry.toNodeId}`),
        });
        return {
            socket,
            density: localDensity,
            branching: strategyFor(seed, index, candidate.role),
            interiorFill: localInteriorFill,
            clusterCoverage: localCoverage,
            geometryScale,
            scale,
        };
    }

    function cubicPoint(segment, ratio) {
        const oneMinus = 1 - ratio;
        const a = oneMinus ** 3;
        const b = 3 * oneMinus ** 2 * ratio;
        const c = 3 * oneMinus * ratio ** 2;
        const d = ratio ** 3;
        return {
            x: segment.p0[0] * a + segment.p1[0] * b + segment.p2[0] * c + segment.p3[0] * d,
            y: segment.p0[1] * a + segment.p1[1] * b + segment.p2[1] * c + segment.p3[1] * d,
        };
    }

    function presentationPoint(value, origin, scale) {
        return {
            x: origin.x + (value.x - origin.x) * scale,
            y: origin.y + (value.y - origin.y) * scale,
        };
    }

    function depthOffset(lane) {
        if (lane === 'back') return 18;
        if (lane === 'front') return -18;
        return 0;
    }

    function segmentEntries(segment, context) {
        const sampleCount = segment.role === 'short-spur' ? 2 : 3;
        const lane = segment.depthLane || context.depthLane;
        const depth = context.baseDepth + depthOffset(lane) + finite(segment.depth) * 0.7;
        const points = Array.from({ length: sampleCount + 1 }, (_, index) => (
            presentationPoint(
                cubicPoint(segment, index / sampleCount),
                context.origin,
                context.geometryScale,
            )
        ));
        return points.slice(1).map((end, sampleIndex) => {
            const start = points[sampleIndex];
            const startRatio = sampleIndex / sampleCount;
            const endRatio = (sampleIndex + 1) / sampleCount;
            const startWidth = finite(segment.startWidth, 1)
                + (finite(segment.endWidth, 0.6) - finite(segment.startWidth, 1)) * startRatio;
            const endWidth = finite(segment.startWidth, 1)
                + (finite(segment.endWidth, 0.6) - finite(segment.startWidth, 1)) * endRatio;
            const id = `terminal-lab-entry:${segment.id}:${sampleIndex}`;
            return Object.freeze({
                id,
                segment: Object.freeze({
                    id,
                    lineageId: `terminal-lab-lineage:${segment.id}`,
                    tier: 2,
                    axisOrder: 2,
                    sequence: context.sequence + sampleIndex * 0.001,
                    startRadius: rounded(startWidth * 0.5 / context.scale),
                    endRadius: rounded(endWidth * 0.5 / context.scale),
                }),
                fromNodeId: sampleIndex === 0
                    ? context.anchorNodeId
                    : `terminal-lab-node:${segment.id}:${sampleIndex}`,
                toNodeId: `terminal-lab-node:${segment.id}:${sampleIndex + 1}`,
                presentationLineageId: `terminal-lab-lineage:${segment.id}`,
                sourceLineageId: context.sourceLineageId,
                isTerminalLabTwig: true,
                terminalSocketId: context.socketId,
                depthLayer: lane === 'back'
                    ? 'behind_wood'
                    : (lane === 'front' ? 'in_front_of_wood' : 'middle_wood'),
                start: Object.freeze({ x: rounded(start.x), y: rounded(start.y), depth: rounded(depth) }),
                end: Object.freeze({ x: rounded(end.x), y: rounded(end.y), depth: rounded(depth) }),
            });
        });
    }

    function resolveOrganGeometry(cluster, organ) {
        const tangentX = Math.cos(organ.pedicel.emergenceAngle);
        const tangentY = Math.sin(organ.pedicel.emergenceAngle);
        const normalX = -tangentY;
        const normalY = tangentX;
        const base = { x: cluster.base[0], y: cluster.base[1] };
        return {
            base,
            control: {
                x: base.x + tangentX * organ.pedicel.length * 0.52 + normalX * organ.pedicel.bend,
                y: base.y + tangentY * organ.pedicel.length * 0.52 + normalY * organ.pedicel.bend,
            },
            end: {
                x: base.x + tangentX * organ.pedicel.length,
                y: base.y + tangentY * organ.pedicel.length,
            },
        };
    }

    function buildSakuraTerminalLabCanopy(options = {}) {
        const entries = (options.entries || []).map(normalizeEntry);
        if (!entries.length) {
            return Object.freeze({
                contractId: CONTRACT_ID,
                labPlanContract: LAB_PLAN_CONTRACT,
                entries: Object.freeze([]),
                organs: Object.freeze([]),
                receipts: Object.freeze([]),
                socketCount: 0,
                targetSocketCount: 0,
                axisCount: 0,
                spurCount: 0,
                clusterCount: 0,
                organCount: 0,
            });
        }
        const seed = options.seed ?? 'unseeded';
        const scale = Math.max(0.1, finite(options.scale, 1));
        const density = clamp(finite(options.density, 0.9), 0.35, 1);
        const interiorFill = clamp(finite(options.interiorFill, 0.72), 0, 1);
        const clusterCoverage = clamp(finite(options.clusterCoverage, 0.9), 0, 1);
        const candidateResult = buildSocketCandidates(entries, seed);
        const selection = selectSocketCandidates(
            candidateResult.candidates,
            candidateResult.bounds,
            seed,
            finite(options.socketLoad, 0.95),
        );
        const plans = selection.selected.map((candidate, index) => {
            const negotiated = socketFromCandidate(candidate, {
                bounds: candidateResult.bounds,
                seed,
                scale,
                density,
                interiorFill,
                clusterCoverage,
            }, index);
            const plan = createSakuraTerminalMorphologyPlan({
                socket: negotiated.socket,
                density: negotiated.density,
                branching: negotiated.branching,
                interiorFill: negotiated.interiorFill,
                clusterCoverage: negotiated.clusterCoverage,
            });
            if (plan.contract !== LAB_PLAN_CONTRACT) {
                throw new Error('[G15_TERMINAL_ADAPTER] Terminal Lab returned an unexpected plan.');
            }
            return { candidate, negotiated, plan, index };
        });
        const presentationEntries = [];
        const organs = [];
        const receipts = [];
        plans.forEach(({ candidate, negotiated, plan, index }) => {
            const socketDepthLane = randomUnit(seed, `socket:${index}:depth`) < 0.36
                ? 'back'
                : (randomUnit(seed, `socket:${index}:depth`) > 0.78 ? 'front' : 'middle');
            const entryContext = {
                scale,
                sequence: finite(options.sequence, entries.length) + index * 0.1,
                baseDepth: candidate.point.depth,
                depthLane: socketDepthLane,
                anchorNodeId: candidate.entry.toNodeId,
                sourceLineageId: candidate.entry.lineageId,
                socketId: negotiated.socket.id,
                origin: {
                    x: negotiated.socket.point[0],
                    y: negotiated.socket.point[1],
                },
                geometryScale: negotiated.geometryScale,
            };
            [...plan.axes, ...plan.spurs].forEach((segment) => {
                presentationEntries.push(...segmentEntries(segment, entryContext));
            });
            plan.clusters.forEach((cluster) => {
                cluster.organs.forEach((organ, organIndex) => {
                    const geometry = resolveOrganGeometry(cluster, organ);
                    const origin = entryContext.origin;
                    const base = presentationPoint(
                        geometry.base,
                        origin,
                        negotiated.geometryScale,
                    );
                    const pedicelScale = 1
                        + randomUnit(seed, `${cluster.id}:pedicel-scale`) * 0.14;
                    const control = {
                        x: base.x + (geometry.control.x - geometry.base.x) * pedicelScale,
                        y: base.y + (geometry.control.y - geometry.base.y) * pedicelScale,
                    };
                    const end = {
                        x: base.x + (geometry.end.x - geometry.base.x) * pedicelScale,
                        y: base.y + (geometry.end.y - geometry.base.y) * pedicelScale,
                    };
                    organs.push(Object.freeze({
                        id: `${cluster.id}:organ:${organIndex}`,
                        socketId: negotiated.socket.id,
                        sourceNodeId: candidate.entry.toNodeId,
                        sourceLineageId: candidate.entry.lineageId,
                        clusterId: cluster.id,
                        templateId: cluster.templateId,
                        templateRole: cluster.templateRole,
                        zone: cluster.zone,
                        depthLane: cluster.depthLane,
                        kind: organ.kind,
                        scale: rounded(organ.scale),
                        openness: rounded(organ.openness),
                        pose: organ.blossomPose,
                        pedicel: organ.pedicel,
                        base: Object.freeze({
                            x: rounded(base.x),
                            y: rounded(base.y),
                            depth: rounded(candidate.point.depth),
                        }),
                        control: Object.freeze({
                            x: rounded(control.x),
                            y: rounded(control.y),
                            depth: rounded(candidate.point.depth),
                        }),
                        end: Object.freeze({
                            x: rounded(end.x),
                            y: rounded(end.y),
                            depth: rounded(candidate.point.depth + depthOffset(cluster.depthLane)),
                        }),
                    }));
                });
            });
            receipts.push(Object.freeze({
                id: `terminal-lab-receipt:${candidate.entry.toNodeId}`,
                sourceNodeId: candidate.entry.toNodeId,
                sourceSegmentId: candidate.entry.id,
                sourceLineageId: candidate.entry.lineageId,
                socketRole: candidate.role,
                terminal: candidate.terminal,
                height: rounded(candidate.height),
                radial: rounded(candidate.radial),
                socket: negotiated.socket,
                density: rounded(negotiated.density),
                branching: negotiated.branching,
                interiorFill: rounded(negotiated.interiorFill),
                clusterCoverage: rounded(negotiated.clusterCoverage),
                geometryScale: rounded(negotiated.geometryScale),
                usage: plan.usage,
                attachmentUsage: plan.attachmentUsage,
                clusterZoneUsage: plan.clusterZoneUsage,
                clusterTemplateUsage: plan.clusterTemplateUsage,
            }));
        });
        const sumUsage = (key) => plans.reduce(
            (total, item) => total + finite(item.plan.usage?.[key]),
            0,
        );
        const clusterZoneUsage = plans.reduce((counts, item) => {
            ['inner', 'middle', 'edge'].forEach((zone) => {
                counts[zone] += finite(item.plan.clusterZoneUsage?.[zone]);
            });
            return counts;
        }, { inner: 0, middle: 0, edge: 0 });
        const clusterTemplateUsage = plans.reduce((counts, item) => {
            Object.entries(item.plan.clusterTemplateUsage || {}).forEach(([id, count]) => {
                counts[id] = (counts[id] || 0) + count;
            });
            return counts;
        }, {});
        return Object.freeze({
            contractId: CONTRACT_ID,
            semantics: 'completed_g15_graph_to_canonical_terminal_socket_plan_v1',
            layer: 'detachable_terminal_lab_canopy_presentation',
            labPlanContract: LAB_PLAN_CONTRACT,
            seed,
            candidateCount: candidateResult.candidates.length,
            targetSocketCount: selection.target,
            socketCount: plans.length,
            axisCount: sumUsage('twig'),
            spurCount: sumUsage('spur'),
            clusterCount: sumUsage('cluster'),
            organCount: organs.length,
            clusterZoneUsage: Object.freeze(clusterZoneUsage),
            clusterTemplateUsage: Object.freeze(clusterTemplateUsage),
            entries: Object.freeze(presentationEntries),
            organs: Object.freeze(organs),
            receipts: Object.freeze(receipts),
        });
    }

    scope.ZenBonsaiTypedDevelopmentalSchedulerSakuraTerminalLabAdapter = Object.freeze({
        contractId: CONTRACT_ID,
        labPlanContract: LAB_PLAN_CONTRACT,
        buildSakuraTerminalLabCanopy,
    });
}(globalThis));
