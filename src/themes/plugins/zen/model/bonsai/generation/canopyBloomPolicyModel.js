import { HardConstraintModel } from './hardConstraintModel';

const clamp = (value, min, max) => HardConstraintModel.clamp(value, min, max);
const tipKey = (tip, index) => {
    if (tip?.node?.nodeId) {
        return `node:${tip.node.nodeId}`;
    }
    const x = Number.isFinite(tip?.endX) ? tip.endX.toFixed(2) : '0.00';
    const y = Number.isFinite(tip?.endY) ? tip.endY.toFixed(2) : '0.00';
    const d = Number.isFinite(tip?.depth) ? tip.depth : 0;
    return `tip:${x}:${y}:${d}:${index}`;
};
const distanceSq = (a, b) => {
    const dx = (a?.endX || 0) - (b?.endX || 0);
    const dy = (a?.endY || 0) - (b?.endY || 0);
    return (dx * dx) + (dy * dy);
};

export class CanopyBloomPolicyModel {
    static resolveSakuraBudget({
        stageDepth,
        canopyBloomDensity,
        flowerChance,
        leafChance = 0,
    }) {
        const safeStageDepth = Number.isFinite(stageDepth) ? stageDepth : 6;
        const depthNorm = HardConstraintModel.clamp(safeStageDepth / 8, 0.2, 1);
        const lowDepthBoost = 1 + (1 - depthNorm) * 0.34;
        const targetNodes = Math.round(
            (0.8 + canopyBloomDensity * 4.2 + (flowerChance || 0) * 2.4 + (leafChance || 0) * 0.9) * lowDepthBoost,
        );
        const budget = Math.max(0, Math.min(9, targetNodes));
        return {
            budget,
            targetNodes,
            depthNorm,
            lowDepthBoost,
        };
    }

    static selectSakuraAnchors({
        tips = [],
        canopyBloomDensity,
    }) {
        if (!Array.isArray(tips) || !tips.length) {
            return [];
        }

        const maxAnchors = Math.max(2, Math.min(
            tips.length,
            Math.round(1.5 + canopyBloomDensity * 1.2),
        ));
        const ordered = [...tips]
            .sort((a, b) => {
                if (a.endY !== b.endY) {
                    return a.endY - b.endY;
                }
                if (Math.abs(a.endX) !== Math.abs(b.endX)) {
                    return Math.abs(a.endX) - Math.abs(b.endX);
                }
                return (b.depth || 0) - (a.depth || 0);
            });
        const minX = ordered.reduce((acc, tip) => Math.min(acc, Number.isFinite(tip?.endX) ? tip.endX : 0), Number.POSITIVE_INFINITY);
        const maxX = ordered.reduce((acc, tip) => Math.max(acc, Number.isFinite(tip?.endX) ? tip.endX : 0), Number.NEGATIVE_INFINITY);
        const safeMinX = Number.isFinite(minX) ? minX : -1;
        const safeMaxX = Number.isFinite(maxX) ? maxX : 1;
        const width = Math.max(1, safeMaxX - safeMinX);
        const selected = [];
        const selectedKeys = new Set();
        const sectorCount = 3;

        for (let sector = 0; sector < sectorCount; sector += 1) {
            if (selected.length >= maxAnchors) {
                break;
            }
            const sectorStart = safeMinX + (width * sector) / sectorCount;
            const sectorEnd = safeMinX + (width * (sector + 1)) / sectorCount;
            let pickedIndex = -1;
            for (let index = 0; index < ordered.length; index += 1) {
                const tip = ordered[index];
                const x = Number.isFinite(tip?.endX) ? tip.endX : 0;
                if (x < sectorStart || (sector < sectorCount - 1 && x >= sectorEnd) || (sector === sectorCount - 1 && x > sectorEnd)) {
                    continue;
                }
                const key = tipKey(tip, index);
                if (selectedKeys.has(key)) {
                    continue;
                }
                pickedIndex = index;
                break;
            }
            if (pickedIndex < 0) {
                continue;
            }
            const candidate = ordered[pickedIndex];
            const key = tipKey(candidate, pickedIndex);
            selected.push(candidate);
            selectedKeys.add(key);
        }

        if (!selected.length && ordered.length) {
            selected.push(ordered[0]);
            selectedKeys.add(tipKey(ordered[0], 0));
        }

        while (selected.length < maxAnchors) {
            let best = null;
            let bestScore = Number.NEGATIVE_INFINITY;
            for (let i = 0; i < ordered.length; i += 1) {
                const tip = ordered[i];
                const key = tipKey(tip, i);
                if (selectedKeys.has(key)) {
                    continue;
                }
                let minDist = Number.POSITIVE_INFINITY;
                for (let j = 0; j < selected.length; j += 1) {
                    minDist = Math.min(minDist, distanceSq(tip, selected[j]));
                }
                const y = Number.isFinite(tip?.endY) ? tip.endY : 0;
                const depth = Number.isFinite(tip?.depth) ? tip.depth : 1;
                const topBias = clamp(1 - ((y + 220) / 440), 0, 1);
                const depthBias = clamp(depth / 8, 0.1, 1);
                const score = minDist * (0.7 + topBias * 0.2 + depthBias * 0.1);
                if (score > bestScore) {
                    bestScore = score;
                    best = { tip, key };
                }
            }
            if (!best) {
                break;
            }
            selected.push(best.tip);
            selectedKeys.add(best.key);
        }

        return selected;
    }

    static resolveSakuraBudgetSplit({
        budget,
        anchorCount,
        canopyBloomDensity,
        localRatioOverride = null,
        minPerAnchorOverride = null,
    }) {
        const safeBudget = Math.max(0, Math.round(Number(budget) || 0));
        const safeAnchorCount = Math.max(0, Math.round(Number(anchorCount) || 0));
        if (!safeBudget || !safeAnchorCount) {
            return {
                localBudget: 0,
                globalBudget: 0,
                minPerAnchor: 0,
                maxPerAnchor: 0,
            };
        }

        const rawLocalRatio = Number(localRatioOverride);
        const localRatio = Number.isFinite(rawLocalRatio)
            ? clamp(rawLocalRatio, 0.4, 0.85)
            : clamp(0.26 + (canopyBloomDensity * 0.08), 0.24, 0.38);
        const rawMinPerAnchor = Number(minPerAnchorOverride);
        const minPerAnchor = Number.isFinite(rawMinPerAnchor)
            ? Math.max(0, Math.min(4, Math.round(rawMinPerAnchor)))
            : Math.max(1, Math.min(1, Math.round(1 + canopyBloomDensity * 0.25)));
        const floorBudget = Math.min(safeBudget, safeAnchorCount * minPerAnchor);
        const targetLocalBudget = Math.round(safeBudget * localRatio);
        const localBudget = Math.max(floorBudget, Math.min(safeBudget, targetLocalBudget));
        const globalBudget = Math.max(0, safeBudget - localBudget);
        const maxPerAnchor = Math.max(minPerAnchor + 1, Math.round((localBudget / safeAnchorCount) + 1));

        return {
            localBudget,
            globalBudget,
            minPerAnchor,
            maxPerAnchor,
        };
    }

    static resolveSakuraCanopyWidth({
        rootLength,
        canopyBloomRadius,
    }) {
        return Math.max(
            16,
            Math.min(58, rootLength * (0.34 + canopyBloomRadius * 0.48)),
        );
    }

    static resolveSakuraFlowerBias({
        flowerChance,
        canopyBloomDensity,
    }) {
        return HardConstraintModel.clamp(
            (flowerChance || 0) * (0.78 + canopyBloomDensity * 0.18),
            0.18,
            0.88,
        );
    }
}
