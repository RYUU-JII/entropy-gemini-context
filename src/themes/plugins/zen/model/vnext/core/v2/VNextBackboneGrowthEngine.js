import { buildStructuralNodeId } from '../../../bonsai/random/StructuralHashRandom';
import {
    buildTopContributions,
    clamp,
    clamp01,
    lerp,
    round,
    toNumber,
} from './VNextGrowthMath';
import { buildVNextBackboneSpineModel } from './VNextBackboneSpineModel';

const dot2 = (a = [0, 1, 0], b = [0, 1, 0]) => (
    (toNumber(a?.[0], 0) * toNumber(b?.[0], 0))
    + (toNumber(a?.[1], 0) * toNumber(b?.[1], 0))
);

const cross2 = (a = [0, 1, 0], b = [0, 1, 0]) => (
    (toNumber(a?.[0], 0) * toNumber(b?.[1], 0))
    - (toNumber(a?.[1], 0) * toNumber(b?.[0], 0))
);

const resolveTurnDeg = (previousHeading = null, nextHeading = null) => {
    if (!previousHeading || !nextHeading) {
        return 0;
    }
    const dot = clamp(dot2(previousHeading, nextHeading), -1, 1);
    return Math.acos(dot) * (180 / Math.PI);
};

const resolveBackboneEventType = ({
    previousHeading = null,
    nextHeading = null,
    progress = 0,
    backbone = {},
} = {}) => {
    if (!previousHeading || !nextHeading) {
        return 'extend';
    }
    const turnDeg = resolveTurnDeg(previousHeading, nextHeading);
    const curveEnergy = clamp01(backbone.curveEnergy);
    const apexSoftness = clamp01(backbone.apexSoftness);
    if (
        progress > Math.max(0.32, toNumber(backbone.firstSplitHeightRatio, 0.42))
        && turnDeg > lerp(5.5, 11.5, apexSoftness)
    ) {
        return 'leader_substitution';
    }
    if (turnDeg > lerp(9.5, 16, curveEnergy)) {
        return 'compression_kink';
    }
    if (turnDeg > 4) {
        return 'wire_redirect';
    }
    return 'extend';
};

const serializeBackboneAttractor = (attractor = {}) => ({
    id: typeof attractor?.id === 'string' ? attractor.id : 'attractor',
    kind: typeof attractor?.kind === 'string' ? attractor.kind : 'seek',
    progress: round(clamp01(toNumber(attractor?.progress, 0)), 6),
    position: [
        round(toNumber(attractor?.position?.[0], 0), 4),
        round(toNumber(attractor?.position?.[1], 0), 4),
        0,
    ],
    weight: round(clamp01(toNumber(attractor?.weight, 0)), 6),
    radiusX: round(Math.max(0, toNumber(attractor?.radiusX, 0)), 4),
    progressRadius: round(clamp01(toNumber(attractor?.progressRadius, 0)), 6),
});

export const growVNextBackbone = ({
    tree,
    occupancyField,
    lightField,
    styleField,
    runtime,
    constraints,
    sampleRandom,
    pushEvent,
} = {}) => {
    const backbone = runtime?.backbone || {};
    const baseRadius = lerp(
        6.8,
        10.6,
        clamp01((clamp01(backbone.vigor) * 0.62) + (clamp01(backbone.curveEnergy) * 0.24) + (clamp01(backbone.taperStrength) * 0.14)),
    );
    const records = [];
    const spines = [];
    const guides = [];

    for (let trunkIndex = 0; trunkIndex < Math.max(1, Math.floor(toNumber(backbone.trunkCount, 1))); trunkIndex += 1) {
        const spine = buildVNextBackboneSpineModel({
            trunkIndex,
            runtime,
            constraints,
            occupancyField,
            lightField,
            styleField,
            sampleRandom,
        });
        const trunkRecords = [];
        spines.push({
            trunkIndex,
            beamWidth: Math.max(1, Math.floor(toNumber(spine?.beamWidth, 1))),
            xOffset: round(toNumber(spine?.xOffset, 0), 4),
            totalHeight: round(toNumber(spine?.totalHeight, 0), 4),
            controlPointCount: Math.max(0, Math.floor((spine?.controlPoints || []).length)),
            attractorCount: Math.max(0, Math.floor((spine?.attractors || []).length)),
            attractors: (Array.isArray(spine?.attractors) ? spine.attractors : []).map((entry) => serializeBackboneAttractor(entry)),
        });
        spine.controlPoints.slice(1).forEach((point) => {
            const contributions = point.contributions || {};
            const total = Object.values(contributions).reduce((acc, value) => acc + Number(value || 0), 0);
            pushEvent?.(Math.max(0, Math.round(point.progress * 4)), 'ACTION_SELECTED', {
                action: 'backbone_select_knot',
                phase: 'trunk',
                candidateCount: Math.max(1, Math.floor(toNumber(point.candidateCount, 1))),
                scoreTotal: round(total, 6),
                topPositive: buildTopContributions(contributions, { positive: true }),
                topNegative: buildTopContributions(contributions, { positive: false }),
            }, {
                seedKey: point.seedKey,
                randomValue: point.randomValue,
                contributions,
            });
        });

        let parentId = null;
        let previousHeading = null;
        let previousLateralBias = 1;

        for (let segmentIndex = 0; segmentIndex < Math.max(0, spine.samples.length - 1); segmentIndex += 1) {
            const current = spine.samples[segmentIndex];
            const next = spine.samples[segmentIndex + 1];
            if (!current || !next) {
                continue;
            }
            const progress = clamp01(next.progress);
            const heading = current.heading || next.heading || previousHeading || [0, 1, 0];
            const turnDeg = resolveTurnDeg(previousHeading, heading);
            const eventType = resolveBackboneEventType({
                previousHeading,
                nextHeading: heading,
                progress,
                backbone,
            });
            const depth = segmentIndex;
            const radius0 = Math.max(
                0.34,
                baseRadius * lerp(1.08, 0.24, Math.pow(progress, lerp(0.68, 1.06, clamp01(backbone.taperStrength)))),
            );
            const radius1 = Math.max(0.26, radius0 * lerp(0.84, 0.95, clamp01(backbone.taperStrength)));
            const p0 = [...current.position];
            const p1 = [...next.position];
            const segmentLength = Math.max(1.2, Math.hypot(
                toNumber(p1[0]) - toNumber(p0[0]),
                toNumber(p1[1]) - toNumber(p0[1]),
            ));
            const nodeId = buildStructuralNodeId({
                parentNodeId: parentId || 'root',
                depth,
                nodeRole: 'trunk',
                nodeSlot: trunkIndex,
                decisionType: `backbone_spine_${eventType}_${segmentIndex}`,
            });
            const node = tree.addNode({
                id: nodeId,
                parentId,
                depth,
                order: 0,
                role: 'trunk',
                p0,
                p1,
                dir: heading,
                length: segmentLength,
                radius0,
                radius1,
                age: segmentIndex,
                vigor: clamp01(backbone.vigor),
                lightBudget: clamp01(0.46 + (heading[1] * 0.28)),
                resourceBudget: clamp01(0.66 - (progress * 0.18)),
                liveVeinRatio: 1,
                sapFlow: clamp01(0.72 - (progress * 0.12)),
                tags: [
                    'engine:v2',
                    'phase:trunk',
                    'backbone:spine',
                    `event:${eventType}`,
                    'species:sakura',
                ],
            });
            if (!node) {
                continue;
            }
            occupancyField?.addSegment(p0, p1, {
                nodeId,
                phase: 'trunk',
            });

            const continuity = previousHeading
                ? clamp01((dot2(previousHeading, heading) + 1) * 0.5)
                : 1;
            const bendEnergy = clamp01(turnDeg / lerp(18, 38, clamp01(backbone.curveEnergy)));
            const contributions = {
                backbone_spine: round(0.18 + (bendEnergy * 0.06), 6),
                trunk_movement: round(clamp01(backbone.curveEnergy) * 0.22, 6),
                trunk_vigor: round(clamp01(backbone.vigor) * 0.16, 6),
                backbone_alignment: round(continuity * 0.12, 6),
                continuity_penalty: round(-clamp01(turnDeg / 42) * 0.16, 6),
            };
            if (eventType !== 'extend') {
                contributions.backbone_turn_expression = round(bendEnergy * 0.08, 6);
            }
            pushEvent?.(segmentIndex, 'ACTION_SELECTED', {
                action: eventType === 'extend' ? 'backbone_extend' : 'backbone_redirect',
                phase: 'trunk',
                candidateCount: 1,
                scoreTotal: round(
                    Object.values(contributions).reduce((acc, value) => acc + Number(value || 0), 0),
                    6,
                ),
                topPositive: buildTopContributions(contributions, { positive: true }),
                topNegative: buildTopContributions(contributions, { positive: false }),
            }, {
                nodeId,
                seedKey: `backbone_spine_segment_${trunkIndex}`,
                randomValue: sampleRandom(`backbone_spine_segment_${trunkIndex}`, segmentIndex),
                contributions,
            });
            pushEvent?.(segmentIndex, 'SEGMENT_EMITTED', {
                action: eventType,
                phase: 'trunk',
                nodeId,
                parentId,
                length: round(segmentLength, 4),
                order: 0,
            }, {
                nodeId,
            });

            records.push({
                nodeId,
                parentId,
                trunkIndex,
                segmentIndex,
                depth,
                p0,
                p1,
                heading,
                radius0,
                radius1,
                progress,
                eventType,
                lateralBias: (() => {
                    const cross = previousHeading ? cross2(previousHeading, heading) : 0;
                    const derived = cross === 0
                        ? (toNumber(heading?.[0], 0) === 0 ? previousLateralBias : Math.sign(toNumber(heading?.[0], 0)))
                        : Math.sign(cross);
                    previousLateralBias = derived || previousLateralBias || 1;
                    return previousLateralBias;
                })(),
            });
            trunkRecords.push(records[records.length - 1]);
            parentId = nodeId;
            previousHeading = heading;
        }

        const mappedGuideSamples = (Array.isArray(spine?.guideSamples) ? spine.guideSamples : spine?.samples || [])
            .map((sample, sampleIndex) => {
                const mappedRecord = trunkRecords.length
                    ? trunkRecords.reduce((best, record) => {
                        const progressDistance = Math.abs(toNumber(record?.progress, 0) - toNumber(sample?.progress, 0));
                        if (!best || progressDistance < best.progressDistance) {
                            return {
                                record,
                                progressDistance,
                            };
                        }
                        return best;
                    }, null)?.record
                    : null;
                return {
                    guideIndex: sampleIndex,
                    progress: round(clamp01(toNumber(sample?.progress, 0)), 6),
                    position: [
                        round(toNumber(sample?.position?.[0], 0), 4),
                        round(toNumber(sample?.position?.[1], 0), 4),
                        0,
                    ],
                    heading: [
                        round(toNumber(sample?.heading?.[0], 0), 6),
                        round(toNumber(sample?.heading?.[1], 1), 6),
                        0,
                    ],
                    trunkIndex,
                    parentNodeId: mappedRecord?.nodeId || null,
                    segmentIndex: Math.max(0, Math.floor(toNumber(mappedRecord?.segmentIndex, 0))),
                    lateralBias: Math.sign(toNumber(mappedRecord?.lateralBias, 0)) || 1,
                };
            });
        guides.push({
            trunkIndex,
            xOffset: round(toNumber(spine?.xOffset, 0), 4),
            totalHeight: round(toNumber(spine?.totalHeight, 0), 4),
            samples: mappedGuideSamples,
        });
    }

    return {
        records,
        spines,
        guides,
    };
};
