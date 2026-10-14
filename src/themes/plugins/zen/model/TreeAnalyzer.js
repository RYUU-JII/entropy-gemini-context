import { BranchGeometryModel } from './bonsai/geometry/branchGeometryModel';
import {
    EPS,
    clamp01,
    clamp,
    lerp,
    safeDiv,
    mean,
    stdDev,
    round,
    distanceSq,
    segmentsIntersect,
    convexHull,
    polygonArea,
    normalizeAroundTarget,
    computeGridNegativeSpace,
    computeSkeletonGrid,
    nearestNeighborDistance,
} from './treeAnalyzer/metricsMath';
import {
    extractReferenceBloomRatio,
    extractReferenceFeatureValue,
    vectorizeReference,
} from './treeAnalyzer/referenceFeatures';
import {
    isTrunkOrderSegment,
    resolveTrunkDynamics,
    resolveBackboneMetrics,
} from './treeAnalyzer/trunkMetrics';
import {
    TREE_FEATURE_KEYS,
    FACTOR_META,
    FACTOR_WEIGHTS,
} from './treeAnalyzer/featureConfig';

export { TREE_FEATURE_KEYS };

export const TreeAnalyzer = {
    analyze: (topology, width, height, options = {}) => {
        if (!topology) {
            return null;
        }

        const allPoints = [];
        const branchPoints = [];
        const branchSegments = [];
        const straightSegments = [];
        const branchAngles = [];
        const branchWidths = [];
        const branchLengths = [];
        const widthRatios = [];
        const lengthRatios = [];
        const branchDepths = [];
        const terminalDepths = [];

        const foliagePoints = [];
        const flowerPoints = [];

        let branchCount = 0;
        let flowerCount = 0;
        let leafCount = 0;
        let maxDepthReached = 0;
        let totalLength = 0;

        let massX = 0;
        let massY = 0;
        let totalMass = 0;
        let leftMass = 0;
        let rightMass = 0;

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        const rootVisual = topology.visualPhenotype || {};
        const rootPotScale = rootVisual.potScale || 1;

        const updateBounds = (x, y) => {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        };

        const addMass = (x, y, mass) => {
            massX += x * mass;
            massY += y * mass;
            totalMass += mass;
            if (x < 0) leftMass += mass;
            else rightMass += mass;
        };

        let branchId = 0;

        const traverse = (node, currentX, currentY, currentAngle, depth, parent = null) => {
            if (!node || node.type !== 'branch') {
                return;
            }

            maxDepthReached = Math.max(maxDepthReached, depth);
            branchCount += 1;
            branchDepths.push(depth);
            totalLength += node.length;
            branchLengths.push(node.length);
            branchWidths.push(node.width);

            updateBounds(currentX, currentY);

            const segment = BranchGeometryModel.createSegment({
                startX: currentX,
                startY: currentY,
                angle: currentAngle,
                length: node.length,
                curve: node.curve || 0,
                curveIn: node.curveIn,
                curveOut: node.curveOut,
                exactCubicControl: node.exactCubicControl,
            });
            const endX = segment.endX;
            const endY = segment.endY;

            const samples = [];
            const sampleCount = 7;
            for (let i = 0; i < sampleCount; i += 1) {
                const t = i / (sampleCount - 1);
                const p = BranchGeometryModel.pointAt(segment, t);
                samples.push(p);
                allPoints.push(p);
                branchPoints.push(p);
                updateBounds(p.x, p.y);
            }

            const localBranchId = branchId;
            branchId += 1;

            for (let i = 0; i < samples.length - 1; i += 1) {
                straightSegments.push({
                    a: samples[i],
                    b: samples[i + 1],
                    branchId: localBranchId,
                    depth,
                });
            }

            branchSegments.push({
                id: localBranchId,
                depth,
                branchOrder: Number.isFinite(Number(node?.branchOrder))
                    ? Number(node.branchOrder)
                    : null,
                branchOrderName: typeof node?.branchOrderName === 'string'
                    ? node.branchOrderName
                    : null,
                parentId: parent?.id ?? null,
                width: node.width,
                length: node.length,
                curveRatio: Math.abs(node.curve) / Math.max(EPS, node.length),
                start: { x: currentX, y: currentY },
                end: { x: endX, y: endY },
                angle: currentAngle,
            });

            const segMass = Math.max(0.6, node.width) * Math.max(4, node.length);
            const massPoint = BranchGeometryModel.pointAt(segment, 0.5);
            addMass(massPoint.x, massPoint.y, segMass);

            if (parent) {
                widthRatios.push(node.width / Math.max(EPS, parent.width));
                lengthRatios.push(node.length / Math.max(EPS, parent.length));
            }

            const branchChildren = Array.isArray(node.branches) ? node.branches : [];
            const terminalChildren = Array.isArray(node.terminals) ? node.terminals : [];

            if (branchChildren.length || terminalChildren.length) {
                branchChildren.forEach((child) => {
                    if (!child?.obj) return;
                    let childStartX = endX;
                    let childStartY = endY;
                    let childBaseAngle = currentAngle;
                    if (Number.isFinite(child?.t)) {
                        const attachT = clamp(Number(child.t), 0, 1);
                        const attach = BranchGeometryModel.pointAndAngleAt(segment, attachT);
                        childStartX = attach.x;
                        childStartY = attach.y;
                        childBaseAngle = attach.angle;
                    }
                    const childOffset = Number(child.angleOffset || 0);
                    const nextAngle = childBaseAngle + childOffset;
                    branchAngles.push(childOffset);
                    traverse(child.obj, childStartX, childStartY, nextAngle, depth + 1, {
                        id: localBranchId,
                        width: node.width,
                        length: node.length,
                    });
                });

                const terminalBaseAngle = BranchGeometryModel.angleAt(segment, 0.99);
                terminalChildren.forEach((child, index) => {
                    const terminalAngle = terminalBaseAngle + Number(child.angle || 0);
                    const tipDistance = Number.isFinite(child.dist)
                        ? child.dist
                        : (4 + (child.scale || 0.6) * 7);
                    const fx = endX + Math.cos(terminalAngle) * tipDistance;
                    const fy = endY + Math.sin(terminalAngle) * tipDistance;

                    foliagePoints.push({ x: fx, y: fy, type: child.type, depth });
                    allPoints.push({ x: fx, y: fy });
                    updateBounds(fx, fy);

                    terminalDepths.push(depth + 1 + index * 0.01);

                    const foliageMass = 0.7 + (child.scale || 0.5) * 0.8;
                    addMass(fx, fy, foliageMass);

                    if (child.type === 'flower') {
                        flowerCount += 1;
                        flowerPoints.push({ x: fx, y: fy });
                    } else {
                        leafCount += 1;
                    }
                });
            }

        };

        traverse(topology, 0, 0, topology.initialAngle || -Math.PI / 2, 1);

        if (branchCount === 0 || !Number.isFinite(minX) || !Number.isFinite(maxX)) {
            return null;
        }

        const treeWidth = Math.max(1, Math.abs(maxX - minX));
        const treeHeight = Math.max(1, Math.abs(maxY - minY));
        const foliageCount = flowerCount + leafCount;
        const canvasWidth = Math.max(1, width || treeWidth);
        const canvasHeight = Math.max(1, height || treeHeight);

        const centerOfMassX = safeDiv(massX, totalMass, 0);
        const centerOfMassY = safeDiv(massY, totalMass, 0);

        const trunkDynamics = resolveTrunkDynamics(topology, branchSegments);
        const curveMean = mean(branchSegments.map((b) => b.curveRatio));
        const branchChaos = stdDev(branchAngles);

        const taperError = mean(widthRatios.map((ratio, idx) => {
            const depth = branchDepths[Math.min(branchDepths.length - 1, idx)] || 1;
            const depthNorm = depth / Math.max(1, maxDepthReached);
            const target = 0.7 - depthNorm * 0.18;
            return Math.abs(ratio - target);
        }));
        const taperMonotonicPenalty = mean(widthRatios.map((ratio) => (ratio > 1.05 ? Math.pow(ratio - 1.05, 1.5) : 0))); // Relaxed monotonic penalty: minor swellings are okay
        const taperContinuity = clamp01(1 - taperError * 1.0 - taperMonotonicPenalty * 2.8);

        const rhythmMean = mean(lengthRatios);
        const rhythmStd = stdDev(lengthRatios);
        const branchRhythm = clamp01(
            normalizeAroundTarget(rhythmMean, 0.68, 0.3) * 0.65
            + normalizeAroundTarget(rhythmStd, 0.15, 0.2) * 0.35,
        );

        // [OPTIMIZATION] Spatial Hashing & Twig Exclusion
        // We only care if MAJOR branches cross (bad structure). 
        // Twigs crossing is natural and adds density.

        let majorCrossCount = 0;
        const majorSegments = straightSegments.filter(s => s.depth <= 4); // Only check Trunk & Main Branches
        const gridCellSize = Math.max(1, treeWidth / 8);
        const spatialGrid = new Map();

        const getGridKey = (x, y) => `${Math.floor(x / gridCellSize)},${Math.floor(y / gridCellSize)}`;

        // Populate Grid
        majorSegments.forEach(seg => {
            // Add start and end points to grid buckets
            const keys = new Set([
                getGridKey(seg.a.x, seg.a.y),
                getGridKey(seg.b.x, seg.b.y),
                getGridKey((seg.a.x + seg.b.x) / 2, (seg.a.y + seg.b.y) / 2) // Midpoint
            ]);

            keys.forEach(key => {
                if (!spatialGrid.has(key)) spatialGrid.set(key, []);
                spatialGrid.get(key).push(seg);
            });
        });

        // Check Collisions within Buckets
        const checkedPairs = new Set();

        spatialGrid.forEach((segmentsInCell) => {
            if (segmentsInCell.length < 2) return;

            for (let i = 0; i < segmentsInCell.length; i++) {
                const first = segmentsInCell[i];
                for (let j = i + 1; j < segmentsInCell.length; j++) {
                    const second = segmentsInCell[j];

                    if (first.branchId === second.branchId) continue;

                    // Unique Pair ID to avoid double counting across buckets
                    const pairId = first.branchId < second.branchId
                        ? `${first.branchId}-${second.branchId}`
                        : `${second.branchId}-${first.branchId}`;

                    if (checkedPairs.has(pairId)) continue;
                    checkedPairs.add(pairId);

                    // Quick Distance Check
                    if (
                        distanceSq(first.a, second.a) < 0.25 ||
                        distanceSq(first.a, second.b) < 0.25 ||
                        distanceSq(first.b, second.a) < 0.25 ||
                        distanceSq(first.b, second.b) < 0.25
                    ) continue;

                    if (segmentsIntersect(first.a, first.b, second.a, second.b)) {
                        majorCrossCount++;
                    }
                }
            }
        });

        // Normalize by Major Branch Count (not total, to be fair)
        const crossingRate = safeDiv(majorCrossCount, Math.max(1, majorSegments.length), 0);
        // Only start penalizing if crossed a lot
        const branchCrossing = clamp01(1 - Math.max(0, crossingRate - 0.05) / 0.12);

        const verticalRatio = treeHeight / Math.max(EPS, treeWidth);
        const silhouetteIntent = clamp01(Number(topology?.geneProfile?.silhouetteTarget ?? 0.5));
        const verticalTarget = lerp(1.18, 2.08, silhouetteIntent);
        const verticalTolerance = lerp(1.6, 1.02, silhouetteIntent);
        const verticalFlow = normalizeAroundTarget(verticalRatio, verticalTarget, verticalTolerance);

        const massOffset = Math.abs(centerOfMassX) / Math.max(EPS, treeWidth * 0.48);
        const massBalanceCenter = clamp01(1 - Math.pow(massOffset, 1.2)); // Smoother falloff
        const lateralAsym = safeDiv(Math.abs(leftMass - rightMass), totalMass, 0);
        const asymmetryTarget = 0.2; // Allow slightly more asymmetry
        const asymmetryGrace = clamp01(
            massBalanceCenter * 0.45 + normalizeAroundTarget(lateralAsym, asymmetryTarget, 0.32) * 0.55,
        );
        const massBalance = clamp01(massBalanceCenter * 0.65 + normalizeAroundTarget(lateralAsym, 0.2, 0.3) * 0.35);

        const grid = computeGridNegativeSpace(allPoints, minX, maxX, minY, maxY);
        const negativeSpace = normalizeAroundTarget(grid.ratio, 0.19, 0.2);

        const hull = convexHull(allPoints);
        const hullArea = polygonArea(hull);
        const branchFill = branchSegments.reduce((acc, seg) => acc + seg.length * Math.max(0.75, seg.width) * 0.52, 0);
        const foliageFill = foliageCount * 14;
        const fillRatio = safeDiv(branchFill + foliageFill, Math.max(EPS, hullArea), 0);
        const fillTarget = lerp(0.44, 0.32, silhouetteIntent);
        const silhouetteBase = clamp01(
            normalizeAroundTarget(fillRatio, fillTarget, 0.28) * 0.68
            + normalizeAroundTarget(verticalRatio, verticalTarget, verticalTolerance * 1.1) * 0.32,
        );
        const heightCoverageTarget = lerp(0.68, 0.8, silhouetteIntent);
        const widthCoverageTarget = lerp(0.56, 0.34, silhouetteIntent);
        const heightCoverage = clamp01(treeHeight / (canvasHeight * heightCoverageTarget));
        const widthCoverage = clamp01(treeWidth / (canvasWidth * widthCoverageTarget));
        const scalePresence = clamp01(heightCoverage * 0.66 + widthCoverage * 0.34);
        const silhouetteFill = clamp01(silhouetteBase * 0.74 + scalePresence * 0.26);

        const density = safeDiv(foliageCount, branchCount, 0);
        const densityTarget = 1.7;
        const densityHarmony = normalizeAroundTarget(density, densityTarget, densityTarget * 0.85);

        const topBandY = minY + treeHeight * 0.28;
        const topFoliage = foliagePoints.filter((p) => p.y <= topBandY);
        const apexCandidates = topFoliage.length ? topFoliage : foliagePoints;
        const apexSpread = stdDev(apexCandidates.map((p) => p.x)) / Math.max(EPS, treeWidth * 0.5);
        const apexCenterOffset = Math.abs(mean(apexCandidates.map((p) => p.x))) / Math.max(EPS, treeWidth * 0.45);
        const apexFocus = clamp01(1 - (apexSpread * 0.68 + apexCenterOffset * 0.5));

        const foliageLeft = foliagePoints.filter((p) => p.x < 0).length;
        const foliageRight = foliagePoints.length - foliageLeft;
        const foliageLateralBalance = 1 - safeDiv(Math.abs(foliageLeft - foliageRight), Math.max(1, foliagePoints.length), 0);
        const depthSpread = stdDev(terminalDepths) / Math.max(1, maxDepthReached);
        const foliageDistribution = clamp01(
            foliageLateralBalance * 0.56 + normalizeAroundTarget(depthSpread, 0.18, 0.18) * 0.44,
        );

        const references = Array.isArray(options.referenceFeatures) ? options.referenceFeatures : [];
        const referenceBloomRatios = references
            .map((ref) => extractReferenceBloomRatio(ref))
            .filter((value) => Number.isFinite(value));
        const referenceClusterScores = references
            .map((ref) => extractReferenceFeatureValue(ref, 'bloomClustering'))
            .filter((value) => Number.isFinite(value));

        const bloomRatio = safeDiv(flowerCount, Math.max(1, foliageCount), 0);
        const baseBloomTarget = 0.42;
        const bloomRefMean = referenceBloomRatios.length ? mean(referenceBloomRatios) : baseBloomTarget;
        const bloomRefStd = referenceBloomRatios.length ? stdDev(referenceBloomRatios) : 0;
        const bloomTarget = referenceBloomRatios.length >= 4
            ? clamp((baseBloomTarget * 0.45) + (bloomRefMean * 0.55), 0, 1)
            : baseBloomTarget;
        const bloomTolerance = referenceBloomRatios.length >= 4
            ? clamp(
                0.18 + bloomRefStd * 1.5,
                0.16,
                0.45,
            )
            : 0.35;
        const bloomBalance = normalizeAroundTarget(bloomRatio, bloomTarget, bloomTolerance);

        const rootSpreadRaw = 0.3;

        const expectedPotHeight = 32 * rootPotScale;
        const trunkOffset = Math.abs(rootVisual.trunkOffsetX || 0);
        const treeToPotRatio = safeDiv(treeHeight, Math.max(1, expectedPotHeight), 0);
        const ratioTarget = 5.0;
        const ratioTolerance = 2.4;
        const potProportion = clamp01(
            normalizeAroundTarget(treeToPotRatio, ratioTarget, ratioTolerance) * 0.72
            + normalizeAroundTarget(trunkOffset, 0.12, 0.18) * 0.28,
        );

        const depthComplexityMid = normalizeAroundTarget(
            maxDepthReached,
            8.1,
            3.4,
        );
        const depthComplexityTail = clamp01(
            safeDiv(maxDepthReached - 8.1, 16, 0),
        );
        const depthComplexity = clamp01(
            depthComplexityMid * 0.66 + depthComplexityTail * 0.34,
        );
        const branchComplexityMid = normalizeAroundTarget(
            branchCount,
            28,
            18,
        );
        const branchComplexityTail = clamp01(
            safeDiv(
                Math.log1p(Math.max(0, branchCount)) - Math.log1p(28),
                Math.log1p(900) - Math.log1p(28),
                0,
            ),
        );
        const branchComplexity = clamp01(
            branchComplexityMid * 0.54 + branchComplexityTail * 0.46,
        );
        const spreadStd = stdDev(branchDepths);
        const spreadComplexityMid = normalizeAroundTarget(
            spreadStd,
            2.3,
            1.6,
        );
        const spreadComplexityTail = clamp01(
            safeDiv(spreadStd - 2.3, 4.8, 0),
        );
        const spreadComplexity = clamp01(
            spreadComplexityMid * 0.62 + spreadComplexityTail * 0.38,
        );
        const structuralComplexity = clamp01(
            depthComplexity * 0.28 + branchComplexity * 0.48 + spreadComplexity * 0.24,
        );

        const flowerNeighborDistance = nearestNeighborDistance(flowerPoints);
        const clusterTightness = flowerPoints.length > 1
            ? clamp01(1 - safeDiv(flowerNeighborDistance, treeWidth * 0.22, 1))
            : 0.42;
        const baseExpectedCluster = clamp01((topology.geneProfile?.seasonalBloomBias ?? 0.5) * 0.7 + 0.15);
        const clusterRefMean = referenceClusterScores.length ? mean(referenceClusterScores) : baseExpectedCluster;
        const clusterRefStd = referenceClusterScores.length ? stdDev(referenceClusterScores) : 0;
        const expectedCluster = referenceClusterScores.length >= 4
            ? clamp((baseExpectedCluster * 0.4) + (clusterRefMean * 0.6), 0, 1)
            : baseExpectedCluster;
        const seasonalTolerance = referenceClusterScores.length >= 4
            ? clamp(0.22 + clusterRefStd * 1.1, 0.2, 0.5)
            : 0.45;
        const seasonalCoherence = normalizeAroundTarget(clusterTightness, expectedCluster, seasonalTolerance);

        const rolePrimarySegments = branchSegments.filter((segment) => {
            const order = Number(segment?.branchOrder);
            const name = String(segment?.branchOrderName || '');
            return (
                order === 1
                || order === 2
                || name === 'main'
                || name === 'lateral'
            );
        });
        const primarySegments = rolePrimarySegments.length
            ? rolePrimarySegments
            : branchSegments.filter((segment) => {
                const order = Number(segment?.branchOrder);
                const name = String(segment?.branchOrderName || '');
                const isTrunkOrder = order === 0 || name === 'trunk';
                return !isTrunkOrder && segment.depth >= 2 && segment.depth <= 5;
            });
        const downwardRatio = safeDiv(
            primarySegments.filter((segment) => Math.sin(segment.angle) > 0).length,
            Math.max(1, primarySegments.length),
            0,
        );
        const upwardEnergy = primarySegments.length
            ? mean(primarySegments.map((segment) => -Math.sin(segment.angle)))
            : 0.5;
        const downwardComfort = 0.26;
        const downwardTolerance = 0.24;
        const downwardOverload = clamp01(
            safeDiv(
                Math.max(0, downwardRatio - downwardComfort),
                downwardTolerance,
                0,
            ),
        );
        const primaryBranchLift = clamp01(
            normalizeAroundTarget(downwardRatio, 0.16, 0.22) * 0.42
            + normalizeAroundTarget(upwardEnergy, 0.58, 0.38) * 0.58
            - downwardOverload * 0.4,
        );
        const backboneMetrics = resolveBackboneMetrics(topology, branchSegments);
        const backboneAlignment = clamp01(Number(backboneMetrics?.alignmentScore ?? 0.5));
        const backboneCurveConsistency = clamp01(Number(backboneMetrics?.curveMatchScore ?? 0.5));
        const backboneDepth1Alignment = clamp01(
            Number(backboneMetrics?.depth1Alignment ?? backboneAlignment),
        );
        const backboneDepth2Alignment = clamp01(
            Number(backboneMetrics?.depth2Alignment ?? backboneAlignment),
        );
        const backboneHarmony = clamp01(
            backboneAlignment * 0.4 + backboneCurveConsistency * 0.3 + backboneDepth1Alignment * 0.15 + backboneDepth2Alignment * 0.15
        );

        const trunkCurveMean = trunkDynamics.chain.length ? trunkDynamics.curveMean : curveMean;
        const trunkCurveStd = trunkDynamics.chain.length
            ? trunkDynamics.curveStd
            : stdDev(branchSegments.map((segment) => Number(segment?.curveRatio || 0)));

        const trunkFlow = clamp01(
            trunkDynamics.continuity * 0.38
            + trunkDynamics.smoothness * 0.24
            + trunkDynamics.sweepScore * 0.18
            + trunkDynamics.leanBalance * 0.08
            + backboneHarmony * 0.12,
        );

        const curveControl = clamp01(
            normalizeAroundTarget(trunkCurveMean, 0.028, 0.024) * 0.34
            + normalizeAroundTarget(trunkCurveStd, 0.012, 0.016) * 0.2
            + normalizeAroundTarget(branchChaos, 0.35, 0.5) * 0.2
            + backboneCurveConsistency * 0.26,
        );

        // [NEW] directionalFlow
        const horizontalVelocity = branchSegments.length ? mean(branchSegments.map((s) => Math.cos(s.angle))) : 0;
        const massOffsetNormalized = centerOfMassX / Math.max(EPS, treeWidth * 0.5);
        const directionalMomentum = massOffsetNormalized * horizontalVelocity;
        const directionalFlow = clamp01(normalizeAroundTarget(directionalMomentum, 0.25, 0.4) * 0.6 + Math.abs(horizontalVelocity) * 0.4);

        // [NEW] foliageTiering
        const sliceCount = 12;
        const sliceCounts = new Array(sliceCount).fill(0);
        foliagePoints.forEach((p) => {
            const normalizedY = clamp01((p.y - minY) / Math.max(EPS, treeHeight));
            const sliceIdx = Math.min(sliceCount - 1, Math.floor(normalizedY * sliceCount));
            sliceCounts[sliceIdx]++;
        });
        const activeSlices = sliceCounts.filter((c) => c > 0);
        const sliceVariance = activeSlices.length > 1 ? stdDev(activeSlices) / Math.max(1, mean(activeSlices)) : 0;
        const padDefinition = clamp01(sliceVariance / 1.5);
        const tieringSpread = clamp01(activeSlices.length / sliceCount);
        const foliageTiering = clamp01(padDefinition * 0.7 + tieringSpread * 0.3);

        const trunkSegments = trunkDynamics.chain.length
            ? trunkDynamics.chain
            : branchSegments.filter((segment) => segment.depth <= 3);
        const twigSegments = branchSegments.filter((segment) => !isTrunkOrderSegment(segment));
        const trunkCurvature = mean(trunkSegments.map((b) => b.curveRatio));
        const twigCurvature = mean(twigSegments.map((b) => b.curveRatio));
        const trunkToTwigContrast = clamp01(
            (trunkCurvature * 2.0) - (twigCurvature * 1.5) + 0.3,
        );

        const taperStd = stdDev(widthRatios);
        const taperStability = clamp01(1 - taperStd * 2.5);
        const taperQuality = clamp01(taperContinuity * 0.6 + taperStability * 0.4);

        const rawBloomDist = flowerNeighborDistance;
        const rawBloomClustering = clamp01(1 - safeDiv(rawBloomDist, treeWidth * 0.1, 0.5));
        const bloomClusteringScore = referenceClusterScores.length >= 4
            ? normalizeAroundTarget(
                rawBloomClustering,
                clamp(clusterRefMean, 0, 1),
                clamp(0.16 + clusterRefStd * 1.2, 0.14, 0.38),
            )
            : rawBloomClustering;

        const bloomClustering = clamp01(seasonalCoherence * 0.5 + bloomClusteringScore * 0.5);

        const baseFeatures = {
            trunkFlow,
            curveControl,
            backboneHarmony,
            taperQuality,
            branchRhythm,
            branchCrossing,
            verticalFlow,
            massBalance,
            directionalFlow,
            asymmetryGrace,
            negativeSpace,
            silhouetteFill,
            densityHarmony,
            foliageTiering,
            apexFocus,
            foliageDistribution,
            bloomBalance,
            bloomClustering,
            potProportion,
            structuralComplexity,
            primaryBranchLift,
            trunkToTwigContrast,
        };

        let novelty = 0.5;
        if (references.length) {
            const vector = TREE_FEATURE_KEYS.map((key) => baseFeatures[key] ?? 0);
            let minDistance = Infinity;
            references.forEach((ref) => {
                const refVector = vectorizeReference(ref, TREE_FEATURE_KEYS);
                if (!refVector) return;
                const d = Math.sqrt(
                    mean(vector.map((v, index) => {
                        const diff = v - refVector[index];
                        return diff * diff;
                    })),
                );
                minDistance = Math.min(minDistance, d);
            });
            if (Number.isFinite(minDistance)) {
                novelty = clamp01(minDistance / 0.35);
            }
        }

        const features = { ...baseFeatures };

        const totalWeight = Object.values(FACTOR_WEIGHTS).reduce((acc, cur) => acc + cur, 0);
        const components = TREE_FEATURE_KEYS.map((key) => {
            const score = clamp01(features[key] ?? 0);
            const weight = FACTOR_WEIGHTS[key] || 0;
            const contribution = safeDiv(score * weight, totalWeight, 0);
            return {
                id: key,
                label: FACTOR_META[key].label,
                weight: round(weight, 3),
                score: round(score, 4),
                contribution: round(contribution, 4),
                status: score >= 0.7 ? 'strong' : score >= 0.45 ? 'neutral' : 'weak',
            };
        });

        const weighted = components.reduce((acc, cur) => acc + cur.score * cur.weight, 0);
        const ruleScore = clamp01(safeDiv(weighted, totalWeight, 0));

        const strongest = [...components]
            .sort((a, b) => b.contribution - a.contribution)
            .slice(0, 4);
        const weakest = [...components]
            .sort((a, b) => a.score - b.score)
            .slice(0, 4);

        const skeleton = computeSkeletonGrid(branchPoints, minX, maxX, minY, maxY, 32);

        return {
            skeleton, // [NEW] Raw input for MLP
            structural: {
                width: round(treeWidth, 1),
                height: round(treeHeight, 1),
                totalLength: round(totalLength, 1),
                branchCount,
                maxDepth: maxDepthReached,
                crossings: majorCrossCount,
            },
            density: {
                flowers: flowerCount,
                leaves: leafCount,
                ratio: round(density, 3),
            },
            features: TREE_FEATURE_KEYS.reduce((acc, key) => {
                acc[key] = round(features[key], 4);
                return acc;
            }, {}),
            factors: {
                verticalRatio: round(verticalRatio, 4),
                fillRatio: round(fillRatio, 4),
                bloomRatio: round(bloomRatio, 4),
                rootSpreadRaw: round(rootSpreadRaw, 4),
                heightCoverage: round(heightCoverage, 4),
                widthCoverage: round(widthCoverage, 4),
                scalePresence: round(scalePresence, 4),
                crossingRate: round(crossingRate, 4),
                negativeSpaceWindows: grid.windows,
                centerOfMassX: round(centerOfMassX, 3),
                centerOfMassY: round(centerOfMassY, 3),
                trunkDynamics: {
                    chainDepth: trunkDynamics.chain.length,
                    meanOffsetDeg: round((trunkDynamics.meanOffsetAbsRad * 180) / Math.PI, 2),
                    flipDensity: round(trunkDynamics.flipDensity, 4),
                    netLeanDeg: round((trunkDynamics.netLeanRad * 180) / Math.PI, 2),
                },
                backboneMetrics: backboneMetrics
                    ? {
                        alignment: backboneAlignment,
                        curveConsistency: backboneCurveConsistency,
                        depth1Alignment: backboneDepth1Alignment,
                        depth2Alignment: backboneDepth2Alignment,
                        depthStability: Number(backboneMetrics.depthStability),
                        angleErrorMeanDeg: Number.isFinite(Number(backboneMetrics.angleErrorMeanDeg))
                            ? Number(backboneMetrics.angleErrorMeanDeg)
                            : null,
                        curveErrorMean: Number.isFinite(Number(backboneMetrics.curveErrorMean))
                            ? Number(backboneMetrics.curveErrorMean)
                            : null,
                        depthCount: Number(backboneMetrics.depthCount),
                        depthLogs: Array.isArray(backboneMetrics.depthLogs)
                            ? backboneMetrics.depthLogs.map((log) => ({
                                depth: Number(log.depth),
                                angleErrorDeg: Number.isFinite(Number(log.angleErrorDeg))
                                    ? Number(log.angleErrorDeg)
                                    : null,
                                curveError: Number(log.curveError),
                            }))
                            : [],
                    }
                    : null,
            },
            evaluation: {
                ruleScore: round(ruleScore, 4),
                noveltyScore: round(novelty, 4),
                confidence: round(clamp01(0.45 + Math.min(0.55, branchCount / 36)), 4),
                components,
                strongest,
                weakest,
            },
            featureOrder: [...TREE_FEATURE_KEYS],
            timestamp: new Date().toISOString(),
        };
    },
};
