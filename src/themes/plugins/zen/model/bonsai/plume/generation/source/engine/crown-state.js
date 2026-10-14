import {zenPlumeKernelRealm} from "../../kernelRealm.js";
/**
 * G15.4 crown state owner.
 *
 * Local terminal clusters, registered biomass, future-only balance pressure,
 * and specimen-level completion observation live here. Completion can stop a
 * specimen but cannot prescribe an axis action.
 */
(function installTypedDevelopmentalCrownState(scope) {
    'use strict';

    const programs = scope.ZenBonsaiTypedDevelopmentalSchedulerPrograms;
    const constructionAccount = scope
        .ZenBonsaiTypedDevelopmentalSchedulerConstructionAccount;
    const architectureOwner = scope
        .ZenBonsaiTypedDevelopmentalSchedulerCrownArchitecture;
    const compositionOwner = scope
        .ZenBonsaiTypedDevelopmentalSchedulerCrownComposition;
    if (!programs || !constructionAccount || !architectureOwner || !compositionOwner) {
        throw new Error(
            '[G15.4_CROWN] programs, construction account, crown architecture, and crown composition owners must load first.',
        );
    }
    const {
        TIER_NAMES,
        TIERS,
        CLUSTER_SEMANTICS,
        BALANCE_SEMANTICS,
        CROWN_INTERIOR_EXPOSURE_SEMANTICS,
        COMPLETION_SEMANTICS,
        clamp,
        add,
        subtract,
        scale,
        distance,
        dot,
        normalize,
        mixDirection,
        pointAt,
        rotateGrowthPlane,
        tiltDepth,
        rounded,
        sum,
    } = programs;
    const { affordableLength } = constructionAccount;
    const { resolveCrownArchitectureProfile } = architectureOwner;
    const {
        createScaffoldFamilyGesture,
        resolveClusterEnvelope,
        clusterEnvelopeDistance,
    } = compositionOwner;

    function createOwner(dependencies) {
        const required = ['idFor', 'nodeById', 'frontierById', 'heightBandFor'];
        const missing = required.filter((name) => (
            !dependencies || typeof dependencies[name] !== 'function'
        ));
        if (missing.length) {
            throw new Error('[G15.4_CROWN] Missing owner dependencies: ' + missing.join(', '));
        }
        const { idFor, nodeById, frontierById, heightBandFor } = dependencies;
        function createTerminalCluster(context, spec) {
            const tier = clamp(spec.tier, 1, 2);
            const tierConfig = TIERS[tier];
            const compactness = clamp(
                spec.temperament.clusterCompactness
                    * 0.72
                    + context.phenotype.tierClusterBias[tier] * 0.28,
                0.28,
                0.96,
            );
            const familyTurn = context.rng.range(-0.12, 0.12)
                * (1.08 - compactness * 0.28);
            const familyDepth = context.rng.range(
                -tierConfig.depthVariation,
                tierConfig.depthVariation,
            ) * 1.5;
            const centerHeading = tiltDepth(
                rotateGrowthPlane(spec.heading, familyTurn),
                familyDepth,
            );
            const familyGesture = spec.familyGesture
                || createScaffoldFamilyGesture(context, {
                    axisOrder: spec.tier,
                    origin: spec.origin,
                    heading: centerHeading,
                    parentGesture: spec.parentGesture || null,
                    lineageKey:
                        `${spec.parentLineageId}:${spec.birthEvent}:${spec.tier}`,
                    parentLineageId: spec.parentLineageId,
                    sequence: spec.birthEvent,
                    temperament: spec.temperament,
                });
            const reach = tierConfig.meanLength
                * (tier === 1 ? 5.2 : 3.8)
                * context.preset.statureScale
                * spec.temperament.lengthScale
                * spec.temperament.axisReachScale
                * (0.88 + spec.resourceShare * 0.24);
            const radius = tierConfig.meanLength
                * (2.42 - compactness * 0.82)
                * context.phenotype.crownSpread;
            const capacity = Math.round(clamp(
                (tier === 1 ? 11 : 8)
                    * (1.14 - compactness * 0.2)
                    * (0.9 + context.phenotype.ramificationTempo * 0.22),
                tier === 1 ? 9 : 6,
                tier === 1 ? 15 : 11,
            ));
            const envelope = resolveClusterEnvelope(
                familyGesture,
                radius,
                compactness,
            );
            const cluster = Object.freeze({
                id: idFor(context, 'cluster'),
                semantics: CLUSTER_SEMANTICS,
                parentClusterId: spec.parentClusterId || null,
                originLineageId: spec.parentLineageId,
                tier,
                axisTier: spec.tier,
                center: Object.freeze(Object.fromEntries(Object.entries(
                    pointAt(spec.origin, centerHeading, reach),
                ).map(([key, value]) => [key, rounded(value)]))),
                heading: Object.freeze(Object.fromEntries(Object.entries(
                    centerHeading,
                ).map(([key, value]) => [key, rounded(value)]))),
                radius: rounded(radius),
                compactness: rounded(compactness),
                familyTurn: rounded(familyTurn),
                familyDepth: rounded(familyDepth),
                familyGesture,
                envelope,
                resourceBias: rounded(spec.temperament.resourceBias),
                capacity,
                createdAtEvent: spec.birthEvent,
            });
            context.clusters.push(cluster);
            context.clusterIndex.set(cluster.id, cluster);
            context.clusterSegmentCounts.set(cluster.id, 0);
            return cluster;
        }
    
        function clusterTargetFor(frontier) {
            if (!frontier.cluster) return null;
            const cluster = frontier.cluster;
            const lateral = cluster.envelope?.majorAxis
                || normalize({
                    x: cluster.heading.y,
                    y: -cluster.heading.x,
                    z: 0,
                });
            const depthAxis = cluster.envelope?.depthAxis || { x: 0, y: 0, z: 1 };
            const slotBias = clamp(
                (frontier.temperament.resourceBias - 0.5) * 1.35
                    + (frontier.temperament.balanceBias - 0.5) * 0.45
                    + frontier.temperament.clusterSlot * 0.82,
                -1,
                1,
            );
            const depthBias = clamp(
                (frontier.temperament.eccentricityExponent - 1.55) * 0.55,
                -0.5,
                0.5,
            );
            return add(
                add(cluster.center, scale(lateral, slotBias * cluster.radius * 0.58)),
                scale(depthAxis, depthBias * cluster.radius * 0.24),
            );
        }
    
        function resolveChildCluster(context, parent, spec) {
            // Terminal envelopes organize lateral and twig families. They have
            // no ownership over the recursive order-0 load path.
            if (spec.tier === 0) return null;
            const terminalAffinity = Number(
                spec.developmentState?.terminalAffinity ?? 0.5,
            );
            const continuity = Number(
                spec.developmentState?.apicalContinuity ?? 0.3,
            );
            if (terminalAffinity < 0.42 && continuity >= 0.34) return null;
            if (parent.cluster) {
                const residentCount = context.clusterSegmentCounts.get(parent.cluster.id);
                if (residentCount < parent.cluster.capacity * 0.82) return parent.cluster;
                return createTerminalCluster(context, {
                    origin: spec.origin,
                    heading: spec.heading,
                    tier: spec.tier,
                    resourceShare: spec.resourceShare,
                    temperament: spec.temperament,
                    parentClusterId: parent.cluster.id,
                    parentLineageId: parent.lineageId,
                    birthEvent: spec.birthEvent,
                    parentGesture: parent.scaffoldFamilyGesture || null,
                    familyGesture: spec.familyGesture || null,
                });
            }
            const entersCrownOrder = spec.tier > parent.tier || spec.tier >= 1;
            if (!entersCrownOrder) return null;
            return createTerminalCluster(context, {
                origin: spec.origin,
                heading: spec.heading,
                tier: spec.tier,
                resourceShare: spec.resourceShare,
                temperament: spec.temperament,
                parentClusterId: null,
                parentLineageId: parent.lineageId,
                birthEvent: spec.birthEvent,
                parentGesture: parent.scaffoldFamilyGesture || null,
                familyGesture: spec.familyGesture || null,
            });
        }
    
        function clusterAttractionScore(frontier, origin, target, runLength) {
            if (!frontier.cluster) return 0;
            if (frontier.sag?.active) return 0;
            const cluster = frontier.cluster;
            const familyTarget = clusterTargetFor(frontier);
            const originDistance = distance(origin, familyTarget);
            const targetDistance = distance(target, familyTarget);
            const radius = Math.max(12, cluster.radius);
            const affinity = 0.42 + cluster.compactness * 0.58;
            let score = 0;
            const envelopeDistance = clusterEnvelopeDistance(cluster, target);
            if (envelopeDistance !== null && envelopeDistance > 1.48) {
                score += (envelopeDistance - 1.48) ** 2 * 12 * affinity;
            }
            // The cluster is an envelope with inherited family slots. It may
            // guide a remote shoot into that envelope, but once inside it must
            // not collapse independent axes onto one convergence point.
            if (originDistance > radius * 1.08) {
                const targetHeading = normalize(subtract(familyTarget, origin));
                const candidateHeading = normalize(subtract(target, origin));
                if (dot(targetHeading, candidateHeading) <= 0.04) score += 1.25;
                const normalizedProgress = clamp(
                    (originDistance - targetDistance) / Math.max(1, runLength),
                    -1,
                    1,
                );
                score -= normalizedProgress * 1.15 * affinity;
            }
            const innerEnvelope = 0.16 + (1 - cluster.compactness) * 0.1;
            if (envelopeDistance !== null && envelopeDistance < innerEnvelope) {
                score += ((innerEnvelope - envelopeDistance) / innerEnvelope) ** 2 * 4.8;
            }
            return score;
        }
    

        function registerSegmentMass(context, segment, startPoint, endPoint) {
            const segmentMass = segment.length
                * (segment.startRadius ** 2 + segment.endRadius ** 2)
                * 0.5;
            const centerX = (startPoint.x + endPoint.x) * 0.5;
            const centerZ = (startPoint.z + endPoint.z) * 0.5;
            context.totalMass += segmentMass;
            context.massMomentX += segmentMass * centerX;
            context.massMomentZ += segmentMass * centerZ;
            const meanRadius = (segment.startRadius + segment.endRadius) * 0.5;
            const silhouetteWeight = segment.length * Math.sqrt(Math.max(0.25, meanRadius));
            context.silhouetteWeight += silhouetteWeight;
            context.silhouetteMomentX += silhouetteWeight * centerX;
            context.silhouetteMomentZ += silhouetteWeight * centerZ;
        }

        function retireSegmentMass(context, segment, startPoint, endPoint) {
            const segmentMass = segment.length
                * (segment.startRadius ** 2 + segment.endRadius ** 2)
                * 0.5;
            const centerX = (startPoint.x + endPoint.x) * 0.5;
            const centerZ = (startPoint.z + endPoint.z) * 0.5;
            const meanRadius = (segment.startRadius + segment.endRadius) * 0.5;
            const silhouetteWeight = segment.length
                * Math.sqrt(Math.max(0.25, meanRadius));
            context.totalMass = Math.max(0, context.totalMass - segmentMass);
            context.massMomentX -= segmentMass * centerX;
            context.massMomentZ -= segmentMass * centerZ;
            context.silhouetteWeight = Math.max(
                0,
                context.silhouetteWeight - silhouetteWeight,
            );
            context.silhouetteMomentX -= silhouetteWeight * centerX;
            context.silhouetteMomentZ -= silhouetteWeight * centerZ;
        }
    
        function estimateFrontierBiomass(context, frontier) {
            const origin = nodeById(context, frontier.nodeId)?.point;
            if (!origin) return null;
            const state = frontier.developmentState || {};
            const remainingSteps = Math.max(
                1,
                Number(frontier.axisHardLimit || frontier.axisStepLimit || 1)
                    - Number(frontier.axisAge || 0),
            );
            const stepLength = TIERS[frontier.tier].meanLength
                * context.preset.statureScale
                * frontier.temperament.lengthScale
                * frontier.episode.segmentLengthScale
                * Number(frontier.constructionPortfolio?.plannedLengthScale || 1)
                * (0.78 + Number(state.extensionDrive ?? 0.5) * 0.22);
            const requestedExtent = stepLength * remainingSteps;
            const constructionExtent = affordableLength(context, frontier);
            const futureExtent = Math.min(requestedExtent, constructionExtent);
            const reiterationRatio = clamp(
                Number(state.reiterationReadiness || 0)
                    / Math.max(0.48, Number(state.reiterationThreshold || 0.7)),
                0,
                1.4,
            );
            const subtreeMultiplier = 1 + reiterationRatio
                * (0.22 + Number(state.apicalContinuity || 0) * 0.3);
            const mass = frontier.radius ** 2
                * futureExtent
                * subtreeMultiplier
                * clamp(0.72 + frontier.resourceReserve * 0.22, 0.62, 1.12);
            const centroid = pointAt(
                origin,
                frontier.heading,
                futureExtent * 0.46,
            );
            const silhouetteWeight = futureExtent
                * Math.sqrt(Math.max(0.25, frontier.radius))
                * (1 + reiterationRatio * 0.18);
            return {
                mass,
                silhouetteWeight,
                centroidX: centroid.x,
                centroidZ: centroid.z,
                futureExtent,
                constructionExtent,
                remainingSteps,
            };
        }
    
        function resolveFutureBalanceField(context, focusFrontier = null) {
            let predictedMass = context.totalMass;
            let predictedMomentX = context.massMomentX;
            let predictedMomentZ = context.massMomentZ;
            let predictedSilhouetteWeight = context.silhouetteWeight;
            let predictedSilhouetteMomentX = context.silhouetteMomentX;
            let predictedSilhouetteMomentZ = context.silhouetteMomentZ;
            const seen = new Set();
            const include = (frontier) => {
                if (!frontier || seen.has(frontier.id)) return;
                seen.add(frontier.id);
                const estimate = estimateFrontierBiomass(context, frontier);
                if (!estimate) return;
                predictedMass += estimate.mass;
                predictedMomentX += estimate.mass * estimate.centroidX;
                predictedMomentZ += estimate.mass * estimate.centroidZ;
                predictedSilhouetteWeight += estimate.silhouetteWeight;
                predictedSilhouetteMomentX += estimate.silhouetteWeight
                    * estimate.centroidX;
                predictedSilhouetteMomentZ += estimate.silhouetteWeight
                    * estimate.centroidZ;
            };
            [...context.activeFrontierIds]
                .map((frontierId) => frontierById(context, frontierId))
                .forEach(include);
            include(focusFrontier);
            const predictedCenterX = predictedMomentX / Math.max(1, predictedMass);
            const predictedCenterZ = predictedMomentZ / Math.max(1, predictedMass);
            const predictedSilhouetteCenterX = predictedSilhouetteMomentX
                / Math.max(1, predictedSilhouetteWeight);
            const predictedSilhouetteCenterZ = predictedSilhouetteMomentZ
                / Math.max(1, predictedSilhouetteWeight);
            const targetCenterX = context.phenotype.targetMassOffsetX
                * 320
                * context.form.spreadScale
                * context.preset.spreadScale;
            const targetCenterZ = 0;
            const massPressureX = clamp(
                (targetCenterX - predictedCenterX) / 520,
                -0.16,
                0.16,
            );
            const massPressureZ = clamp(
                (targetCenterZ - predictedCenterZ) / 420,
                -0.14,
                0.14,
            );
            const silhouettePressureX = clamp(
                (targetCenterX - predictedSilhouetteCenterX) / 420,
                -0.16,
                0.16,
            );
            const silhouettePressureZ = clamp(
                (targetCenterZ - predictedSilhouetteCenterZ) / 360,
                -0.14,
                0.14,
            );
            const pressureX = clamp(
                massPressureX * 0.42 + silhouettePressureX * 0.58,
                -0.16,
                0.16,
            );
            const pressureZ = clamp(
                massPressureZ * 0.42 + silhouettePressureZ * 0.58,
                -0.14,
                0.14,
            );
            const field = Object.freeze({
                semantics: BALANCE_SEMANTICS,
                targetCenterX: rounded(targetCenterX),
                targetCenterZ,
                predictedCenterX: rounded(predictedCenterX),
                predictedCenterZ: rounded(predictedCenterZ),
                predictedSilhouetteCenterX: rounded(predictedSilhouetteCenterX),
                predictedSilhouetteCenterZ: rounded(predictedSilhouetteCenterZ),
                predictedMass: rounded(predictedMass),
                predictedSilhouetteWeight: rounded(predictedSilhouetteWeight),
                supportMomentX: rounded(predictedMomentX - predictedMass * targetCenterX),
                supportMomentZ: rounded(predictedMomentZ),
                pressureX: rounded(pressureX),
                pressureZ: rounded(pressureZ),
                massPressureX: rounded(massPressureX),
                massPressureZ: rounded(massPressureZ),
                silhouettePressureX: rounded(silhouettePressureX),
                silhouettePressureZ: rounded(silhouettePressureZ),
                pressureAgreementX: Math.sign(massPressureX)
                    === Math.sign(silhouettePressureX),
                pressureAgreementZ: Math.sign(massPressureZ)
                    === Math.sign(silhouettePressureZ),
                liveFrontierCount: seen.size,
            });
            context.lastBalanceField = field;
            return field;
        }

        function primaryScaffoldLineageId(context, lineageId) {
            let lineage = context.lineageIndex.get(lineageId);
            while (lineage) {
                const parent = context.lineageIndex.get(lineage.parentLineageId);
                if (
                    Number(lineage.axisOrder ?? lineage.tier ?? 0) >= 1
                    && Number(parent?.axisOrder ?? parent?.tier ?? -1) === 0
                ) return lineage.id;
                lineage = parent;
            }
            return null;
        }

        function smoothstep(value) {
            const progress = clamp(Number(value || 0), 0, 1);
            return progress * progress * (3 - 2 * progress);
        }

        function inactiveCrownInteriorExposure(spec = {}) {
            return Object.freeze({
                semantics: CROWN_INTERIOR_EXPOSURE_SEMANTICS,
                applicable: false,
                reason: spec.reason || 'no_distinct_older_crown_support',
                parentAxisOrder: Number(spec.parentAxisOrder ?? 0),
                sourceScaffoldLineageId: spec.sourceScaffoldLineageId || null,
                targetScaffoldLineageId: null,
                crownBaseHeight: spec.crownBaseHeight ?? null,
                referenceLength: rounded(Number(spec.referenceLength || 0)),
                supportSampleCount: 0,
                verticalGap: null,
                horizontalGap: null,
                threeDimensionalGap: null,
                normalizedVerticalExposure: 0,
                normalizedHorizontalSeparation: 0,
                pressure: 0,
                bridgeDirection: null,
                targetPoint: null,
                architectureProfile: spec.architectureProfile || null,
            });
        }

        /**
         * Observe a causal, live 3D gap between an order-1 axis and an older,
         * distinct scaffold family. This is not a completed-silhouette hole
         * detector and it grants no meristem, construction, or cadence rights.
         * The lateral owner may use the bounded direction hint only after its
         * normal station and construction checks have already succeeded.
         */
        function resolveCrownInteriorExposure(
            context,
            frontier,
            origin,
            sequence,
        ) {
            const parentAxisOrder = Number(
                frontier?.axisOrder ?? frontier?.tier ?? 0,
            );
            const referenceLength = TIERS[1].meanLength
                * context.preset.statureScale
                * Number(frontier?.temperament?.lengthScale || 1);
            const architectureProfile = resolveCrownArchitectureProfile(
                context,
                frontier,
                origin,
            );
            const sourceScaffoldLineageId = primaryScaffoldLineageId(
                context,
                frontier?.lineageId,
            );
            if (parentAxisOrder !== 1 || !sourceScaffoldLineageId) {
                return inactiveCrownInteriorExposure({
                    reason: 'secondary_bridge_requires_order_one_parent',
                    parentAxisOrder,
                    sourceScaffoldLineageId,
                    referenceLength,
                    architectureProfile,
                });
            }
            const permanentScaffoldBirths = context.lineages
                .filter((lineage) => {
                    const parent = context.lineageIndex.get(
                        lineage.parentLineageId,
                    );
                    return Number(lineage.axisOrder ?? lineage.tier ?? 0) === 1
                        && Number(parent?.axisOrder ?? parent?.tier ?? -1) === 0
                        && lineage.developmentalRole
                            !== 'juvenile_sacrifice_axis'
                        && !context.retiredLineageIds.has(lineage.id);
                })
                .map((lineage) => {
                    const firstSegment = context.segmentIndex.get(lineage.segmentIds[0]);
                    return firstSegment
                        ? nodeById(context, firstSegment.fromNodeId)?.point
                        : null;
                })
                .filter(Boolean);
            const crownBaseHeight = permanentScaffoldBirths.length
                ? Math.min(...permanentScaffoldBirths.map((point) => point.y))
                : null;
            if (
                crownBaseHeight === null
                || origin.y < crownBaseHeight + referenceLength * 0.55
            ) {
                return inactiveCrownInteriorExposure({
                    reason: 'crown_interior_not_yet_established',
                    parentAxisOrder,
                    sourceScaffoldLineageId,
                    crownBaseHeight,
                    referenceLength,
                    architectureProfile,
                });
            }

            const exposureThresholdScale = clamp(
                1.12
                    - architectureProfile.crownInteriorContinuity * 0.12,
                0.9,
                1.12,
            );

            const groups = new Map();
            context.segments.forEach((segment) => {
                if (
                    Number(segment.birthEvent || 0) > Number(sequence || 0)
                    || Number(segment.axisOrder ?? segment.tier ?? 0) < 1
                    || Number(segment.axisOrder ?? segment.tier ?? 0) > 2
                    || segment.developmentalRole === 'juvenile_sacrifice_axis'
                    || context.retiredLineageIds.has(segment.lineageId)
                ) return;
                const scaffoldLineageId = primaryScaffoldLineageId(
                    context,
                    segment.lineageId,
                );
                if (
                    !scaffoldLineageId
                    || scaffoldLineageId === sourceScaffoldLineageId
                ) return;
                const start = nodeById(context, segment.fromNodeId)?.point;
                const end = nodeById(context, segment.toNodeId)?.point;
                if (!start || !end) return;
                const center = {
                    x: (start.x + end.x) * 0.5,
                    y: (start.y + end.y) * 0.5,
                    z: (start.z + end.z) * 0.5,
                };
                if (center.y >= origin.y - referenceLength * 0.24) return;
                const weight = Math.max(
                    1,
                    Number(segment.length || 0)
                        * Math.sqrt(Math.max(
                            0.35,
                            (Number(segment.startRadius || 0)
                                + Number(segment.endRadius || 0)) * 0.5,
                        )),
                );
                const group = groups.get(scaffoldLineageId) || [];
                group.push({ center, weight });
                groups.set(scaffoldLineageId, group);
            });
            const candidates = [...groups.entries()].map(([
                scaffoldLineageId,
                samples,
            ]) => {
                const maximumY = Math.max(...samples.map(
                    (sample) => sample.center.y,
                ));
                const upperSamples = samples.filter(
                    (sample) => sample.center.y >= maximumY - referenceLength * 0.9,
                );
                const totalWeight = sum(upperSamples.map(
                    (sample) => sample.weight,
                ));
                const targetPoint = {
                    x: sum(upperSamples.map(
                        (sample) => sample.center.x * sample.weight,
                    )) / Math.max(1e-8, totalWeight),
                    y: sum(upperSamples.map(
                        (sample) => sample.center.y * sample.weight,
                    )) / Math.max(1e-8, totalWeight),
                    z: sum(upperSamples.map(
                        (sample) => sample.center.z * sample.weight,
                    )) / Math.max(1e-8, totalWeight),
                };
                const verticalGap = Math.max(0, origin.y - maximumY);
                const horizontalGap = Math.hypot(
                    targetPoint.x - origin.x,
                    targetPoint.z - origin.z,
                );
                const threeDimensionalGap = distance(origin, targetPoint);
                return {
                    scaffoldLineageId,
                    samples,
                    targetPoint,
                    verticalGap,
                    horizontalGap,
                    threeDimensionalGap,
                    score: verticalGap * 0.68 + horizontalGap * 0.32,
                };
            }).filter((candidate) => (
                candidate.verticalGap
                    >= referenceLength * 1.15 * exposureThresholdScale
                && candidate.horizontalGap
                    >= referenceLength * 0.7 * exposureThresholdScale
            )).sort((left, right) => left.score - right.score);
            if (!candidates.length) {
                return inactiveCrownInteriorExposure({
                    parentAxisOrder,
                    sourceScaffoldLineageId,
                    crownBaseHeight,
                    referenceLength,
                    architectureProfile,
                });
            }
            const selected = candidates[0];
            const normalizedVerticalExposure = smoothstep(
                (selected.verticalGap - referenceLength * 1.15)
                    / Math.max(1e-8, referenceLength * 2.6),
            );
            const normalizedHorizontalSeparation = smoothstep(
                (selected.horizontalGap - referenceLength * 0.7)
                    / Math.max(1e-8, referenceLength * 2.3),
            );
            const rawPressure = clamp(
                normalizedVerticalExposure
                    * (0.58 + normalizedHorizontalSeparation * 0.42),
                0,
                1,
            );
            // Preserve ordinary scaffold variation while making genuinely
            // exposed interiors dominate the response continuously.
            const pressure = clamp(
                smoothstep((rawPressure - 0.28) / 0.72)
                    * architectureProfile.crownInteriorContinuity,
                0,
                1,
            );
            const liftedTarget = {
                x: selected.targetPoint.x,
                y: selected.targetPoint.y + selected.verticalGap * 0.24,
                z: selected.targetPoint.z,
            };
            const bridgeVector = subtract(liftedTarget, origin);
            const bridgeDirection = Math.hypot(
                bridgeVector.x,
                bridgeVector.y,
                bridgeVector.z,
            ) > 1e-8 ? normalize(bridgeVector) : null;
            if (!bridgeDirection || pressure < 0.06) {
                return inactiveCrownInteriorExposure({
                    reason: 'bounded_exposure_pressure_below_steering_threshold',
                    parentAxisOrder,
                    sourceScaffoldLineageId,
                    crownBaseHeight,
                    referenceLength,
                    architectureProfile,
                });
            }
            return Object.freeze({
                semantics: CROWN_INTERIOR_EXPOSURE_SEMANTICS,
                applicable: true,
                reason: 'distinct_older_scaffold_exposes_live_crown_interior',
                parentAxisOrder,
                sourceScaffoldLineageId,
                targetScaffoldLineageId: selected.scaffoldLineageId,
                crownBaseHeight: rounded(crownBaseHeight),
                referenceLength: rounded(referenceLength),
                supportSampleCount: selected.samples.length,
                verticalGap: rounded(selected.verticalGap),
                horizontalGap: rounded(selected.horizontalGap),
                threeDimensionalGap: rounded(selected.threeDimensionalGap),
                normalizedVerticalExposure: rounded(normalizedVerticalExposure),
                normalizedHorizontalSeparation: rounded(
                    normalizedHorizontalSeparation,
                ),
                pressure: rounded(pressure),
                exposureThresholdScale: rounded(exposureThresholdScale),
                architectureProfile,
                bridgeDirection: bridgeDirection
                    ? Object.freeze(Object.fromEntries(Object.entries(
                        bridgeDirection,
                    ).map(([key, value]) => [key, rounded(value)])))
                    : null,
                targetPoint: Object.freeze(Object.fromEntries(Object.entries(
                    liftedTarget,
                ).map(([key, value]) => [key, rounded(value)]))),
            });
        }

        function terminalLineageCount(context) {
            const activeLineages = new Set([...context.activeFrontierIds]
                .map((frontierId) => frontierById(context, frontierId)?.lineageId)
                .filter(Boolean));
            return context.lineages.filter((lineage) => (
                lineage.developmentalRole !== 'juvenile_sacrifice_axis'
                && (
                    activeLineages.has(lineage.id)
                    || (lineage.endKind && lineage.endKind !== 'fork')
                )
            )).length;
        }
    
        function resolveCrownCompletionStatus(context) {
            const densityScale = Math.sqrt(context.density * context.preset.densityScale);
            const targetStructuralCost = context.phenotype.structuralCostTarget
                * densityScale;
            const minimumSegmentBudget = Math.max(18, Math.round(
                context.form.segmentBudget[0]
                    * densityScale
                    * context.phenotype.complexityScale,
            ));
            const maximumSegmentBudget = Math.max(
                minimumSegmentBudget + 4,
                Math.round(
                    context.form.segmentBudget[1]
                        * densityScale
                        * context.phenotype.complexityScale,
                ),
            );
            const targetScaffoldAttachments = Math.max(2, Math.round(
                context.phenotype.scaffoldAttachmentTarget * densityScale,
            ));
            const targetScaffoldBands = context.phenotype.scaffoldBandTarget;
            const targetTerminalLobes = Math.max(3, Math.round(
                context.phenotype.terminalLobeTarget * densityScale,
            ));
            const targetTerminalRamifications = Math.max(1, Math.round(
                context.phenotype.terminalRamificationTarget * densityScale,
            ));
            const permanentSegments = context.segments.filter(
                (segment) => (
                    segment.developmentalRole !== 'juvenile_sacrifice_axis'
                ),
            );
            const tierLength = TIER_NAMES.map((_, tier) => sum(
                permanentSegments
                    .filter((segment) => segment.tier === tier)
                    .map((segment) => segment.length),
            ));
            const firstSegments = context.lineages
                .filter((lineage) => {
                    const parent = context.lineageIndex.get(lineage.parentLineageId);
                    return lineage.tier === 1
                        && parent?.tier === 0
                        && lineage.developmentalRole
                            !== 'juvenile_sacrifice_axis'
                        && lineage.segmentIds.length;
                })
                .map((lineage) => context.segmentIndex.get(lineage.segmentIds[0]))
                .filter(Boolean);
            const attachmentNodeIds = new Set(firstSegments.map(
                (segment) => segment.fromNodeId,
            ));
            const attachmentBands = new Set([...attachmentNodeIds].map((nodeId) => (
                heightBandFor(nodeById(context, nodeId)?.point || { y: 0 })
            )));
            const attachmentSides = firstSegments.reduce((counts, segment) => {
                const start = nodeById(context, segment.fromNodeId)?.point;
                const end = nodeById(context, segment.toNodeId)?.point;
                if (!start || !end) return counts;
                counts[end.x - start.x < 0 ? 0 : 1] += 1;
                return counts;
            }, [0, 0]);
            const terminalLobeIds = new Set(permanentSegments
                .map((segment) => segment.clusterId)
                .filter(Boolean));
            const terminalRamificationCount = context.lineages.filter((lineage) => {
                const parent = context.lineageIndex.get(lineage.parentLineageId);
                return lineage.developmentalRole
                        !== 'juvenile_sacrifice_axis'
                    && lineage.tier === 2
                    && parent?.tier === 1;
            }).length;
            const orderZeroForkCount = context.rawSplits.filter(
                (split) => split.parentTier === 0,
            ).length;
            const structuralCost = tierLength[0] / TIERS[0].meanLength * 3.25
                + tierLength[1] / TIERS[1].meanLength * 1.55
                + tierLength[2] / TIERS[2].meanLength * 0.58
                + attachmentNodeIds.size * 2.4
                + terminalLobeIds.size * 1.4;
            const maximumGenerationDepth = Math.max(
                0,
                ...context.frontiers.map((frontier) => frontier.generationDepth),
            );
            const targetGenerationDepth = Math.min(
                context.phenotype.crownGenerationDepthTarget,
                5,
            );
            const tips = terminalLineageCount(context);
            const remainingReiterationCredit = [...context.activeFrontierIds].reduce(
                (total, frontierId) => total
                    + Math.max(
                        0,
                        Number(frontierById(context, frontierId)
                            ?.developmentState?.reiterationCredit || 0),
                    ),
                0,
            );
            const viableReiterationCredit = [...context.activeFrontierIds].reduce(
                (total, frontierId) => {
                    const frontier = frontierById(context, frontierId);
                    if (
                        !frontier
                        || frontier.vigor < 0.29
                        || frontier.resourceReserve < 0.16
                    ) return total;
                    return total + Math.max(
                        0,
                        Number(frontier.developmentState?.reiterationCredit || 0),
                    );
                },
                0,
            );
            const immaturePlannedAxisCount = [...context.activeFrontierIds]
                .map((frontierId) => frontierById(context, frontierId))
                .filter((frontier) => (
                    frontier
                    && frontier.constructionPortfolio
                    && frontier.constructionPortfolio.cursor
                        < frontier.constructionPortfolio.plannedInternodeCount
                )).length;
            const unresolvedApicalIntentCount = [...context.activeFrontierIds]
                .map((frontierId) => frontierById(context, frontierId))
                .filter((frontier) => Boolean(
                    frontier?.pendingForkIntent
                    || frontier?.growthUnit?.pendingApicalIntentId,
                )).length;
            const immatureStructuralAxisCount = [...context.activeFrontierIds]
                .map((frontierId) => frontierById(context, frontierId))
                .filter((frontier) => (
                    frontier
                    && (
                        Number(frontier.developmentState?.apicalContinuity || 0)
                            >= 0.34
                        || Number(frontier.developmentState?.supportInvestment || 0)
                            >= 0.36
                    )
                    && frontier.constructionPortfolio
                    && frontier.constructionPortfolio.cursor
                        < frontier.constructionPortfolio.plannedInternodeCount
                )).length;
            const orderZeroForkDeficit = Math.max(
                0,
                context.phenotype.orderZeroForkTarget - orderZeroForkCount,
            );
            const structuralReleaseDeficit = Math.max(
                0,
                context.phenotype.minimumOrderOneChildren - firstSegments.length,
            );
            const attachmentDeficit = Math.max(
                0,
                targetScaffoldAttachments - attachmentNodeIds.size,
            );
            const bandDeficit = Math.max(0, targetScaffoldBands - attachmentBands.size);
            const terminalLobeDeficit = Math.max(
                0,
                targetTerminalLobes - terminalLobeIds.size,
            );
            const terminalRamificationDeficit = Math.max(
                0,
                targetTerminalRamifications - terminalRamificationCount,
            );
            // Completion observes the tree; it never prescribes another order-0
            // fork or a released child. A single atomic order-0 fork establishes
            // the recursive skeleton. Further succession and tier release remain
            // local outcomes of inherited axis state and resource allocation.
            const skeletonComplete = context.rawSplits.some(
                (split) => split.parentTier === 0,
            );
            // Descendant coverage is deliberately a broad semantic floor. Exact
            // lobe, attachment, and height-band counts are observations, not a
            // recipe that the scheduler is allowed to bolt onto selected nodes.
            const coverageComplete = terminalLobeIds.size
                >= Math.min(2, targetTerminalLobes);
            const structuralVolumeComplete = permanentSegments.length
                >= minimumSegmentBudget
                && structuralCost >= targetStructuralCost * 0.82;
            const settled = skeletonComplete
                && coverageComplete
                && immaturePlannedAxisCount === 0
                && unresolvedApicalIntentCount === 0
                && (
                    structuralVolumeComplete
                    || permanentSegments.length >= maximumSegmentBudget
                );
            return Object.freeze({
                semantics: COMPLETION_SEMANTICS,
                phase: skeletonComplete ? 'structural_completion' : 'skeleton',
                settled,
                targetStructuralCost: rounded(targetStructuralCost),
                structuralCost: rounded(structuralCost),
                minimumSegmentBudget,
                maximumSegmentBudget,
                targetSegments: Math.round(targetStructuralCost),
                targetTips: targetTerminalLobes,
                targetGenerationDepth,
                targetDepthSpan: rounded(context.phenotype.crownDepthSpanTarget),
                segmentCount: permanentSegments.length,
                tipCount: tips,
                maximumGenerationDepth,
                segmentDeficit: Math.max(0, targetStructuralCost - structuralCost),
                tipDeficit: terminalLobeDeficit,
                generationDepthDeficit: Math.max(
                    0,
                    targetGenerationDepth - maximumGenerationDepth,
                ),
                axisSuccessionCount: orderZeroForkCount,
                orderZeroForkCount,
                targetOrderZeroForks: context.phenotype.orderZeroForkTarget,
                orderZeroForkDeficit,
                orderZeroForkTargetRole: 'diagnostic_only',
                structuralReleaseCount: firstSegments.length,
                minimumStructuralReleases: context.phenotype.minimumOrderOneChildren,
                structuralReleaseDeficit,
                structuralReleaseTargetRole: 'diagnostic_only',
                scaffoldAttachmentCount: attachmentNodeIds.size,
                targetScaffoldAttachments,
                attachmentDeficit,
                attachmentTargetRole: 'diagnostic_only',
                scaffoldBandCount: attachmentBands.size,
                targetScaffoldBands,
                bandDeficit,
                bandTargetRole: 'diagnostic_only',
                terminalLobeCount: terminalLobeIds.size,
                targetTerminalLobes,
                terminalLobeDeficit,
                terminalRamificationCount,
                targetTerminalRamifications,
                terminalRamificationDeficit,
                terminalRamificationTargetRole: 'diagnostic_only',
                attachmentSides: Object.freeze([...attachmentSides]),
                coverageComplete,
                structuralVolumeComplete,
                remainingReiterationCredit,
                viableReiterationCredit,
                immatureStructuralAxisCount,
                immaturePlannedAxisCount,
                unresolvedApicalIntentCount,
            });
        }
    

        return Object.freeze({
            createTerminalCluster,
            clusterTargetFor,
            resolveChildCluster,
            clusterAttractionScore,
            registerSegmentMass,
            retireSegmentMass,
            estimateFrontierBiomass,
            resolveFutureBalanceField,
            resolveCrownInteriorExposure,
            terminalLineageCount,
            resolveCrownCompletionStatus,
        });
    }

    // Only the envelope born by this transaction may follow its realized axis.
    // Inherited clusters and their already-grown residents stay immutable.
    function bindClusterBirthFrame(context, cluster, familyGesture, origin, heading, sequence) {
        if (!cluster || cluster.createdAtEvent !== sequence) return cluster;
        if (context.clusterSegmentCounts.get(cluster.id)>0) throw new Error('ZEN_G15_CLUSTER_FRAME_ALREADY_COMMITTED');
        const reach=Math.hypot(cluster.center.x-origin.x,cluster.center.y-origin.y,cluster.center.z-origin.z);
        const centerHeading=tiltDepth(rotateGrowthPlane(heading,cluster.familyTurn),cluster.familyDepth);
        const updated=Object.freeze({...cluster,heading:Object.freeze(centerHeading),
            center:Object.freeze(pointAt(origin,centerHeading,reach)),familyGesture,
            envelope:resolveClusterEnvelope(familyGesture,cluster.radius,cluster.compactness),
            frameAuthority:'committed_axis_birth_direction'});
        const index=context.clusters.findIndex(c=>c.id===cluster.id);
        if (index<0) throw new Error('ZEN_G15_CLUSTER_FRAME_OWNER_REQUIRED');
        context.clusters[index]=updated;context.clusterIndex.set(updated.id,updated);
        return updated;
    }

    scope.ZenBonsaiTypedDevelopmentalSchedulerCrownState = Object.freeze({
        createOwner,
        bindClusterBirthFrame,
    });
}(zenPlumeKernelRealm));
