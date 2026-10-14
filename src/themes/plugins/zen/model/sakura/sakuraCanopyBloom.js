import { CanopyBloomPolicyModel } from '../bonsai/generation/canopyBloomPolicyModel';
import {
    resolveSakuraBlossomFacing,
    resolveSakuraFlowerScale,
} from '../bonsai/generation/sakuraBlossomPolicyModel';
import { TerminalGenerationPolicyModel } from '../bonsai/generation/terminalGenerationPolicyModel';
import { BranchGeometryModel } from '../bonsai/geometry/branchGeometryModel';
import {
    clamp,
    lerp,
} from './sakuraMath';

export const createSakuraCanopyBloomLayer = (context = {}) => {
    const {
        currentStage,
        canopyBloomDensity,
        canopyBloomRadius,
        nextRandom,
        config,
    } = context;

        const collectBranchTips = (node, x, y, angle, depth = 1, out = []) => {
            if (!node || node.type !== 'branch') {
                return out;
            }
            const segment = BranchGeometryModel.createSegment({
                startX: x,
                startY: y,
                angle,
                length: node.length,
                curve: node.curve || 0,
                curveIn: node.curveIn,
                curveOut: node.curveOut,
                exactCubicControl: node.exactCubicControl,
            });
            const endX = segment.endX;
            const endY = segment.endY;
            const branchChildren = (node.branches || []);
            if (!branchChildren.length) {
                out.push({ node, endX, endY, angle, depth });
                return out;
            }

            branchChildren.forEach((child) => {
                let startX = endX;
                let startY = endY;
                let baseAngle = angle;
                if (Number.isFinite(child?.t)) {
                    const attachT = clamp(Number(child.t), 0, 1);
                    const info = BranchGeometryModel.pointAndAngleAt(segment, attachT);
                    startX = info.x;
                    startY = info.y;
                    baseAngle = info.angle;
                }
                collectBranchTips(
                    child.obj,
                    startX,
                    startY,
                    baseAngle + Number(child.angleOffset || 0),
                    depth + 1,
                    out,
                );
            });
            return out;
        };

        const addCanopyBloomLayer = (root, nodeRandom) => {
            const stageFlowerChance = clamp(currentStage?.flowerChance ?? 0, 0, 1);
            const stageLeafChance = clamp(currentStage?.leafChance ?? 1, 0, 1);
            if (
                !root
                || canopyBloomDensity < 0.12
                || (stageFlowerChance <= 0 && stageLeafChance <= 0)
            ) {
                return;
            }
            const tips = collectBranchTips(root, 0, 0, root.initialAngle || -Math.PI / 2, 1, []);
            if (!tips.length) {
                return;
            }
            const budgetPlan = CanopyBloomPolicyModel.resolveSakuraBudget({
                stageDepth: currentStage?.depth,
                canopyBloomDensity,
                flowerChance: stageFlowerChance,
                leafChance: stageLeafChance,
            });
            let remainingBudget = budgetPlan.budget;
            if (!remainingBudget) {
                return;
            }

            const anchors = CanopyBloomPolicyModel.selectSakuraAnchors({
                tips,
                canopyBloomDensity,
            });
            if (!anchors.length) {
                return;
            }

            const canopyWidth = CanopyBloomPolicyModel.resolveSakuraCanopyWidth({
                rootLength: root.length,
                canopyBloomRadius,
            });
            const flowerBias = CanopyBloomPolicyModel.resolveSakuraFlowerBias({
                flowerChance: stageFlowerChance,
                canopyBloomDensity,
            });
            const canopyTuning = currentStage?.canopyTuning || {};
            const localRatioOverride = Number.isFinite(Number(canopyTuning?.localRatio))
                ? clamp(Number(canopyTuning.localRatio), 0.4, 0.85)
                : null;
            const globalNodeCapOverride = Number.isFinite(Number(canopyTuning?.globalNodeCap))
                ? clamp(Math.round(Number(canopyTuning.globalNodeCap)), 1, 5)
                : null;
            const repairBudgetScale = Number.isFinite(Number(canopyTuning?.repairBudgetScale))
                ? clamp(Number(canopyTuning.repairBudgetScale), 0, 1)
                : 0.45;
            const minPerAnchorOverride = Number.isFinite(Number(canopyTuning?.minPerAnchor))
                ? clamp(Math.round(Number(canopyTuning.minPerAnchor)), 0, 4)
                : null;
            const branchAffinitySigmaPx = Number.isFinite(Number(canopyTuning?.branchAffinitySigmaPx))
                ? clamp(Number(canopyTuning.branchAffinitySigmaPx), 4, 28)
                : 12;
            const maxGapPx = Number.isFinite(Number(canopyTuning?.maxGapPx))
                ? clamp(Number(canopyTuning.maxGapPx), 4, 30)
                : 12;

            const budgetSplit = CanopyBloomPolicyModel.resolveSakuraBudgetSplit({
                budget: remainingBudget,
                anchorCount: anchors.length,
                canopyBloomDensity,
                localRatioOverride,
                minPerAnchorOverride,
            });

            const tipKey = (tip, index) => (
                tip?.node?.nodeId
                    ? `node:${tip.node.nodeId}`
                    : `tip:${index}:${Math.round(Number(tip?.endX) || 0)}:${Math.round(Number(tip?.endY) || 0)}`
            );
            const pickPaletteColor = (palette, fallback, localRng, decisionType) => {
                if (!Array.isArray(palette) || !palette.length) {
                    return fallback;
                }
                const index = Math.floor(nextRandom(localRng, decisionType) * palette.length);
                return palette[index] || fallback;
            };
            const buildSpreadOrder = (entries = []) => {
                const sorted = entries
                    .map((entry, index) => ({ entry, index }))
                    .sort((a, b) => (a.entry?.endX || 0) - (b.entry?.endX || 0))
                    .map((item) => item.index);
                const order = [];
                let left = 0;
                let right = sorted.length - 1;
                while (left <= right) {
                    order.push(sorted[left]);
                    if (right !== left) {
                        order.push(sorted[right]);
                    }
                    left += 1;
                    right -= 1;
                }
                return order;
            };

            const minTipY = tips.reduce((acc, tip) => Math.min(acc, Number.isFinite(tip?.endY) ? tip.endY : 0), Number.POSITIVE_INFINITY);
            const maxTipY = tips.reduce((acc, tip) => Math.max(acc, Number.isFinite(tip?.endY) ? tip.endY : 0), Number.NEGATIVE_INFINITY);
            const ySpan = Math.max(1, maxTipY - minTipY);
            const nodeLoadMap = new Map();
            const appendTerminal = (tip, tipIndex, terminal) => {
                if (!tip?.node || !terminal || remainingBudget <= 0) {
                    return false;
                }
                tip.node.terminals.push(terminal);
                remainingBudget -= 1;
                const key = tipKey(tip, tipIndex);
                nodeLoadMap.set(key, (nodeLoadMap.get(key) || 0) + 1);
                return true;
            };
            const buildFallbackTerminal = (tip, slot, decisionPrefix = 'canopy_fallback') => {
                const fallbackRandom = nodeRandom.fork({
                    depth: 0,
                    nodeRole: decisionPrefix,
                    nodeSlot: slot,
                    decisionType: 'fallback',
                });
                const flowerEligible = stageFlowerChance > 0
                    && nextRandom(fallbackRandom, `${decisionPrefix}_${slot}_flower_gate`) < (flowerBias * stageFlowerChance);
                const type = flowerEligible
                    ? 'flower'
                    : (stageLeafChance > 0 ? 'leaf' : 'flower');
                const isFlower = type === 'flower';
                const xNorm = clamp((Number(tip?.endX || 0) / Math.max(18, canopyWidth)), -1, 1);
                const angle = xNorm * 0.35 + (nextRandom(fallbackRandom, `${decisionPrefix}_${slot}_angle`) - 0.5) * 0.9;
                const dist = isFlower
                    ? Math.max(3.8, canopyWidth * (0.11 + nextRandom(fallbackRandom, `${decisionPrefix}_${slot}_dist`) * 0.14))
                    : Math.max(2.4, canopyWidth * (0.08 + nextRandom(fallbackRandom, `${decisionPrefix}_${slot}_dist`) * 0.1));
                const openness = clamp(
                    0.72 + (nextRandom(fallbackRandom, `${decisionPrefix}_${slot}_openness`) * 0.16),
                    0.64,
                    0.9,
                );
                const petalFall = clamp(
                    0.04 + (nextRandom(fallbackRandom, `${decisionPrefix}_${slot}_petal_fall`) * 0.18),
                    0,
                    0.28,
                );
                const blossomFacing = isFlower
                    ? resolveSakuraBlossomFacing({
                        rng: fallbackRandom,
                        nextRandom,
                        context: 'fallback',
                        index: slot,
                        angle,
                        openness,
                        exposure: 0.54,
                        distanceRatio: clamp(dist / Math.max(3.8, canopyWidth * 0.25), 0, 1),
                    })
                    : null;
                return {
                    type,
                    scale: isFlower
                        ? resolveSakuraFlowerScale({
                            rng: fallbackRandom,
                            nextRandom,
                            context: 'fallback',
                            index: slot,
                            flowerDominance: stageFlowerChance,
                            distanceRatio: clamp(dist / Math.max(3.8, canopyWidth * 0.25), 0, 1),
                            outerBias: clamp(Math.abs(xNorm), 0, 1),
                        })
                        : (0.6 + nextRandom(fallbackRandom, `${decisionPrefix}_${slot}_leaf_scale`) * 0.16),
                    color: isFlower
                        ? pickPaletteColor(config.flowerColors, '#FFCDD2', fallbackRandom, `${decisionPrefix}_${slot}_flower_color`)
                        : pickPaletteColor(config.leafColors, '#6B7D52', fallbackRandom, `${decisionPrefix}_${slot}_leaf_color`),
                    angle,
                    dist,
                    ...(isFlower
                        ? {
                            pedicelLength: Math.max(2.2, dist * 0.7),
                            pedicelBend: (nextRandom(fallbackRandom, `${decisionPrefix}_${slot}_pedicel_bend`) - 0.5) * 0.36,
                            blossom: {
                                bloomStage: stageFlowerChance > 0.76 ? 'full' : 'half_open',
                                form: 'open',
                                layers: 1,
                                petalCount: 5,
                                openness,
                                petalLength: 0.7,
                                petalWidth: 0.44,
                                ruffle: 0.04,
                                coreSize: 0.2,
                                innerScale: 0.3,
                                warmth: 0.5,
                                petalFall,
                                lightExposure: 0.54,
                                notchDepth: 0.58,
                                translucency: 0.28,
                                stamenBurst: 0.58,
                                centerDepth: 0.58,
                                ...blossomFacing,
                            },
                        }
                        : {}),
                };
            };
            const buildClusterTerminals = (tip, tipIndex, clusterCount, slot, decisionType = 'cluster') => {
                const yNorm = clamp(((tip?.endY || minTipY) - minTipY) / ySpan, 0, 1);
                const apexWeight = 1 - yNorm;
                const xNorm = clamp((Number(tip?.endX || 0) / Math.max(18, canopyWidth)), -1, 1);
                const centerBias = xNorm * Math.PI * 0.44;
                const clusterRandom = nodeRandom.fork({
                    depth: 0,
                    nodeRole: 'canopy_cluster',
                    nodeSlot: slot,
                    decisionType,
                });
                return TerminalGenerationPolicyModel.resolveSakuraCanopyCluster({
                    rng: clusterRandom,
                    clusterCount: Math.max(1, Math.round(clusterCount)),
                    canopyBloomRadius,
                    canopyWidth,
                    apexWeight,
                    centerBias,
                    flowerBias,
                    flowerVisualGate: stageFlowerChance,
                    leafVisualGate: stageLeafChance,
                    flowerColors: config.flowerColors,
                    leafColors: config.leafColors,
                });
            };
            const applyGlobalAffinity = (terminal, slot) => {
                if (!terminal || typeof terminal !== 'object') {
                    return null;
                }
                const isFlower = terminal?.type === 'flower';
                const safeSigma = Math.max(4, Number(branchAffinitySigmaPx) || 12);
                const rawDist = Math.max(0.1, Number(terminal.dist) || 0.1);
                const normalizedDist = rawDist / safeSigma;
                const affinity = clamp(Math.exp(-0.5 * normalizedDist * normalizedDist), 0.08, 1);
                const affinityRandom = nodeRandom.fork({
                    depth: 0,
                    nodeRole: 'canopy_affinity',
                    nodeSlot: slot,
                    decisionType: 'sigma_gate',
                });
                const survival = clamp(
                    (isFlower ? 0.28 : 0.2) + affinity * (isFlower ? 0.78 : 0.85),
                    0.22,
                    0.98,
                );
                if (nextRandom(affinityRandom, `affinity_survival_${slot}`) > survival) {
                    return null;
                }
                const scale = Math.max(0.48, (Number(terminal.scale) || 1) * lerp(0.9, 1.03, affinity));
                const cling = isFlower
                    ? lerp(0.72, 1.04, affinity)
                    : lerp(0.45, 1, affinity);
                const dist = isFlower
                    ? Math.max(
                        3.2,
                        2.4 + (scale * 1.6),
                        rawDist * cling,
                        (Number(terminal?.pedicelLength) || 0) + 0.9,
                    )
                    : Math.max(1.4, rawDist * cling);
                return {
                    ...terminal,
                    dist,
                    scale,
                    ...(isFlower
                        ? {
                            pedicelLength: Math.min(
                                Math.max(1.8, (Number(terminal?.pedicelLength) || dist * 0.66) * lerp(0.94, 1.04, affinity)),
                                Math.max(2.2, dist - 0.88),
                            ),
                            pedicelBend: clamp((Number(terminal?.pedicelBend) || 0) * lerp(0.92, 1.08, 1 - affinity), -0.8, 0.8),
                        }
                        : {}),
                };
            };

            const anchorOrder = buildSpreadOrder(anchors);
            const localQuotaByAnchor = new Array(anchors.length).fill(0);
            let localRemaining = Math.min(remainingBudget, budgetSplit.localBudget);
            const minPerAnchor = Math.max(0, Math.min(
                budgetSplit.minPerAnchor,
                Math.floor(localRemaining / Math.max(1, anchors.length)) || budgetSplit.minPerAnchor,
            ));

            for (let i = 0; i < anchorOrder.length && localRemaining > 0; i += 1) {
                const anchorIndex = anchorOrder[i];
                const give = Math.min(minPerAnchor, localRemaining);
                localQuotaByAnchor[anchorIndex] += give;
                localRemaining -= give;
            }

            let roundRobinCursor = 0;
            let safety = 0;
            while (localRemaining > 0 && anchorOrder.length && safety < 512) {
                const anchorIndex = anchorOrder[roundRobinCursor % anchorOrder.length];
                if (localQuotaByAnchor[anchorIndex] < budgetSplit.maxPerAnchor) {
                    localQuotaByAnchor[anchorIndex] += 1;
                    localRemaining -= 1;
                }
                roundRobinCursor += 1;
                safety += 1;
            }

            for (let i = 0; i < anchorOrder.length && remainingBudget > 0; i += 1) {
                const anchorIndex = anchorOrder[i];
                const anchor = anchors[anchorIndex];
                const quota = Math.max(0, Math.round(localQuotaByAnchor[anchorIndex] || 0));
                if (!anchor || !quota) {
                    continue;
                }
                const cluster = buildClusterTerminals(anchor, anchorIndex, quota, anchorIndex, 'local_cluster');
                let added = 0;
                for (let clusterIdx = 0; clusterIdx < cluster.length; clusterIdx += 1) {
                    if (!appendTerminal(anchor, anchorIndex, cluster[clusterIdx])) {
                        break;
                    }
                    added += 1;
                }
                for (let repairIdx = added; repairIdx < quota && remainingBudget > 0; repairIdx += 1) {
                    appendTerminal(anchor, anchorIndex, buildFallbackTerminal(anchor, repairIdx, 'canopy_local_repair'));
                }
            }

            let globalRemaining = Math.min(remainingBudget, budgetSplit.globalBudget);
            const globalTargets = [...tips];
            const globalOrder = buildSpreadOrder(globalTargets);
            const globalNodeCap = Number.isFinite(globalNodeCapOverride)
                ? globalNodeCapOverride
                : Math.max(1, Math.min(3, Math.round(1 + canopyBloomDensity * 1.3)));
            let globalCursor = 0;
            let globalAttempts = 0;
            while (globalRemaining > 0 && remainingBudget > 0 && globalOrder.length && globalAttempts < globalOrder.length * 8) {
                const targetIndex = globalOrder[globalCursor % globalOrder.length];
                globalCursor += 1;
                globalAttempts += 1;
                const target = globalTargets[targetIndex];
                const key = tipKey(target, targetIndex);
                if ((nodeLoadMap.get(key) || 0) >= globalNodeCap) {
                    continue;
                }
                const one = buildClusterTerminals(target, targetIndex, 1, globalCursor, 'global_cluster');
                if (!one.length) {
                    continue;
                }
                const adjustedTerminal = applyGlobalAffinity(one[0], globalCursor);
                if (!adjustedTerminal) {
                    continue;
                }
                if (appendTerminal(target, targetIndex, adjustedTerminal)) {
                    globalRemaining -= 1;
                    globalAttempts = 0;
                }
            }

            const sparseTips = tips.filter((tip) => (tip?.node?.terminals?.length || 0) === 0);
            if (!sparseTips.length || remainingBudget <= 0) {
                return;
            }
            const longGapTips = sparseTips.filter((tip) => Number(tip?.node?.length || 0) >= maxGapPx);
            const repairTargets = longGapTips.length ? longGapTips : sparseTips;
            const repairBudget = Math.min(
                remainingBudget,
                Math.max(1, Math.round(anchors.length * repairBudgetScale)),
            );
            const repairOrder = buildSpreadOrder(repairTargets);
            let usedRepair = 0;
            for (let i = 0; i < repairOrder.length && usedRepair < repairBudget && remainingBudget > 0; i += 1) {
                const repairIndex = repairOrder[i];
                const tip = repairTargets[repairIndex];
                if ((tip?.node?.terminals?.length || 0) > 0) {
                    continue;
                }
                if (appendTerminal(tip, repairIndex, buildFallbackTerminal(tip, i, 'canopy_gap_repair'))) {
                    usedRepair += 1;
                }
            }
        };

    return addCanopyBloomLayer;
};
