import {zenPlumeKernelRealm} from "../../kernelRealm.js";
/**
 * G15.4 fork-development field owner.
 *
 * This owner evaluates inherited axis intent, spatial candidates, handoff
 * rhythm, and future reiteration capacity. It proposes developmental choices
 * but neither projects final geometry nor mutates the graph.
 */
(function installTypedDevelopmentalForkField(scope) {
    'use strict';

    const programs = scope.ZenBonsaiTypedDevelopmentalSchedulerPrograms;
    const meristemCadenceOwner = scope
        .ZenBonsaiTypedDevelopmentalSchedulerMeristemCadence;
    if (!programs || !meristemCadenceOwner) {
        throw new Error(
            '[G15.4_FORK_FIELD] programs and axis-meristem-cadence owner must load first.',
        );
    }
    const {
        TIERS,
        ANGLE_SEMANTICS,
        clamp,
        distance,
        dot,
        mixDirection,
        pointAt,
        rotateGrowthPlane,
        rotateWorldAzimuth,
        tiltDepth,
        angularDistance,
        constrainDirectionToCone,
        stabilizeOrderZeroHeading,
        signedPlanarAngle,
        rounded,
    } = programs;
    const { resolveMeristemCadenceInfluence } = meristemCadenceOwner;

    function createOwner(dependencies) {
        const required = [
            'resolveFutureBalanceField',
            'resolveCrownCompletionStatus',
            'prospectiveCorridorPreview',
            'occupancyScore',
            'corridorConflictScore',
            'crownDepthEnvelopePenalty',
            'clusterAttractionScore',
        ];
        const missing = required.filter((name) => (
            !dependencies || typeof dependencies[name] !== 'function'
        ));
        if (missing.length) {
            throw new Error(
                '[G15.4_FORK_FIELD] Missing owner dependencies: ' + missing.join(', '),
            );
        }
        const {
            resolveFutureBalanceField,
            resolveCrownCompletionStatus,
            prospectiveCorridorPreview,
            occupancyScore,
            corridorConflictScore,
            crownDepthEnvelopePenalty,
            clusterAttractionScore,
        } = dependencies;

        function resolveForkReferenceFrame(context, frontier, shares, forkSide, archetype) {
            const contrast = Math.max(...shares) - Math.min(...shares);
            // A fork partitions the incoming axis momentum; it does not own an
            // extra trunk bend. Strong hierarchy therefore reduces, rather than
            // amplifies, the episode-target contribution.
            const episodeWeight = clamp(0.3 - contrast * 0.18, 0.16, 0.3);
            let heading = mixDirection(
                frontier.heading,
                frontier.episode.targetHeading,
                episodeWeight,
            );
            let orderZeroSupportReceipt = null;
            if (frontier.axisOrder === 0) {
                const support = programs.resolveOrderZeroSupport(context);
                if (support) {
                    const worldUp = { x: 0, y: 1, z: 0 };
                    const leanBefore = angularDistance(worldUp, heading);
                    const pressure = clamp(
                        (leanBefore - support.softLeanRadians)
                            / Math.max(
                                1e-8,
                                support.maximumLeanRadians - support.softLeanRadians,
                            ),
                        0,
                        1,
                    );
                    if (pressure > 0) {
                        heading = mixDirection(
                            heading,
                            worldUp,
                            0.16 + pressure * 0.3,
                        );
                    }
                    heading = stabilizeOrderZeroHeading(
                        context,
                        heading,
                        3 * Math.PI / 180,
                    );
                    heading = constrainDirectionToCone(
                        heading,
                        frontier.heading,
                        support.continuationTurnRadians,
                    );
                    orderZeroSupportReceipt = Object.freeze({
                        semantics: support.semantics,
                        leanBeforeRadians: rounded(leanBefore),
                        leanAfterRadians: rounded(angularDistance(worldUp, heading)),
                        pressure: rounded(pressure),
                        softLeanRadians: rounded(support.softLeanRadians),
                        maximumLeanRadians: rounded(support.maximumLeanRadians),
                    });
                }
            }
            const dominantTurn = 0;
            const balanceField = resolveFutureBalanceField(context, frontier);
            const completionStatus = resolveCrownCompletionStatus(context);
            const balanceApplied = completionStatus.phase === 'structural_completion'
                && frontier.tier >= 1;
            const balanceTurn = balanceApplied
                ? balanceField.pressureX
                    * context.phenotype.completionBalanceStrength
                    * 1.25
                : 0;
            if (balanceTurn) heading = rotateGrowthPlane(heading, balanceTurn);
            if (balanceApplied && Math.abs(balanceField.pressureZ) > 1e-8) {
                heading = tiltDepth(
                    heading,
                    balanceField.pressureZ
                        * context.phenotype.completionBalanceStrength
                        * 0.9,
                );
            }
            return Object.freeze({
                semantics: ANGLE_SEMANTICS,
                heading: Object.freeze({ ...heading }),
                parentHeading: frontier.heading,
                episodeTargetHeading: frontier.episode.targetHeading,
                episodeWeight: rounded(episodeWeight),
                dominantTurnRadians: rounded(dominantTurn),
                balanceTurnRadians: rounded(balanceTurn),
                balanceApplied,
                completionStatus,
                forkSide,
                archetype,
                balanceField,
                orderZeroSupport: orderZeroSupportReceipt,
            });
        }

        function selectForkDirection(
            context,
            frontier,
            origin,
            baseDirection,
            runLength,
            radius,
            tierIndex,
            siblingTargets,
            cluster,
            directionContinuity,
            temperament,
            supportEnvelope = null,
        ) {
            const depthScale = TIERS[tierIndex].depthVariation
                * context.phenotype.depthAffinity;
            const minimumForwardDot = frontier.terminalRamification
                ? -0.28
                : (frontier.axisOrder === 0 ? 0.08 : 0.34);
            const siblingCorridors = siblingTargets
                .map((sibling) => sibling.corridorPreview)
                .filter(Boolean);
            const lateralOffset = frontier.axisOrder === 0 && tierIndex === 0
                ? 0.055
                : (frontier.terminalRamification ? 0.22 : 0.15);
            const reverseSign = Math.sign(signedPlanarAngle(
                frontier.heading,
                baseDirection,
            )) || 1;
            const candidateOffsets = frontier.terminalReverseFill
                ? [
                    [0, -depthScale],
                    [0, 0],
                    [0, depthScale],
                    [reverseSign * lateralOffset * 0.5, -depthScale * 0.5],
                    [reverseSign * lateralOffset * 0.5, depthScale * 0.5],
                    [reverseSign * lateralOffset * 0.5, 0],
                ]
                : [
                    [-lateralOffset, 0],
                    [-lateralOffset * 0.5, 0],
                    [0, -depthScale],
                    [0, 0],
                    [0, depthScale],
                    [lateralOffset * 0.5, 0],
                    [lateralOffset, 0],
                ];
            const candidates = candidateOffsets
                .map(([delta, depthDelta]) => {
                    let direction = frontier.terminalRamification
                        ? rotateWorldAzimuth(baseDirection, delta + depthDelta)
                        : tiltDepth(
                            rotateGrowthPlane(baseDirection, delta),
                            depthDelta,
                        );
                    if (dot(frontier.heading, direction) < minimumForwardDot) return null;
                    if (
                        supportEnvelope
                        && (
                            angularDistance(frontier.heading, direction)
                                > supportEnvelope.maximumTurnRadians + 1e-8
                            || angularDistance({ x: 0, y: 1, z: 0 }, direction)
                                > supportEnvelope.maximumWorldLeanRadians + 1e-8
                        )
                    ) return null;
                    if (
                        !frontier.terminalRamification
                        && directionContinuity < 0.45
                        && angularDistance(frontier.heading, direction)
                            < angularDistance(frontier.heading, baseDirection) - 0.035
                    ) return null;
                    const target = pointAt(origin, direction, runLength);
                    const previewEpisode = {
                        ...frontier.episode,
                        targetHeading: direction,
                        commitmentDuration: clamp(
                            frontier.episode.commitmentDuration,
                            2,
                            5,
                        ),
                        curvatureVelocity: frontier.turnVelocity * 0.42,
                        gravityResponse: 0,
                    };
                    const corridorPreview = prospectiveCorridorPreview(context, {
                        origin,
                        direction,
                        runLength,
                        radius,
                        tier: tierIndex,
                        episode: previewEpisode,
                        episodeAge: 0,
                        sag: { active: false, age: 0 },
                        clusterId: cluster?.id || null,
                    });
                    let baseScore = occupancyScore(
                        context,
                        origin,
                        target,
                        radius,
                        baseDirection,
                        direction,
                        cluster?.id || null,
                    );
                    siblingTargets.forEach((sibling) => {
                        const separation = distance(target, sibling.target);
                        if (separation < runLength * 0.42) {
                            baseScore += (1 - separation / (runLength * 0.42))
                                * (cluster && sibling.clusterId === cluster.id ? 2.1 : 5);
                        }
                    });
                    baseScore += clusterAttractionScore(
                        { cluster, temperament, sag: { active: false } },
                        origin,
                        target,
                        runLength,
                    );
                    return {
                        direction,
                        target,
                        baseScore,
                        delta,
                        depthDelta,
                        corridorPreview,
                        clusterId: cluster?.id || null,
                    };
                })
                .filter(Boolean)
                .sort((left, right) => left.baseScore - right.baseScore)
                .map((candidate) => {
                    const corridorScore = corridorConflictScore(
                        context,
                        candidate.corridorPreview,
                        siblingCorridors,
                    );
                    return {
                        ...candidate,
                        corridorScore,
                        score: candidate.baseScore
                            + crownDepthEnvelopePenalty(context, candidate.target)
                            + corridorScore
                                * (1.35 + context.phenotype.spatialReserve * 0.75)
                                * context.corridorStrength,
                    };
                })
                .sort((left, right) => left.score - right.score);
            const fallbackDirection = baseDirection;
            return candidates[0] || {
                direction: fallbackDirection,
                target: pointAt(origin, fallbackDirection, runLength),
                score: 0,
                delta: 0,
                depthDelta: 0,
                corridorPreview: prospectiveCorridorPreview(context, {
                    origin,
                    direction: fallbackDirection,
                    runLength,
                    radius,
                    tier: tierIndex,
                    episode: frontier.episode,
                    episodeAge: 0,
                    sag: { active: false, age: 0 },
                    clusterId: cluster?.id || null,
                }),
                corridorScore: 0,
                clusterId: cluster?.id || null,
            };
        }

        function resolveForkSidePlan(context, frontier, shares, decisions, requestedSide) {
            const inheritedSide = Math.sign(
                requestedSide
                    ?? frontier.successionTurnSign
                    ?? frontier.nextTurnSign
                    ?? context.phenotype.asymmetrySign,
            ) || 1;
            const releasedIndices = decisions
                .map((decision, index) => ({ decision, index }))
                .filter(({ decision }) => decision.orderTransition)
                .map(({ index }) => index);
            const curveAngle = signedPlanarAngle(
                frontier.heading,
                frontier.episode.targetHeading,
            );
            const curveSign = Math.sign(curveAngle)
                || Math.sign(frontier.episode.turnSign)
                || inheritedSide;
            const stationSignal = (
                Math.sin(
                    frontier.temperament.developmentalPhase * 4.17
                        + frontier.temperament.forkContrastBias * 2.43
                        + frontier.temperament.resourceBias * 1.37
                        + frontier.temperament.clusterSlot * 1.19,
                ) + 1
            ) * 0.5;
            const curveConditioned = requestedSide === undefined
                && frontier.axisOrder === 0
                && shares.length === 2
                && releasedIndices.length === 1
                && Math.abs(curveAngle) >= 0.018
                && stationSignal >= 0.16;
            const baseSide = curveConditioned ? curveSign : inheritedSide;
            const cadenceInfluence = resolveMeristemCadenceInfluence(frontier);
            // In a binary handoff the transitioned child is projected opposite
            // forkSide when it is the second child, and with forkSide when it
            // is the first. Translate the occupied physical side into that
            // reference frame before blending it with curve and handoff intent.
            const cadencePreferredForkSide = cadenceInfluence.occupiedSide
                && releasedIndices.length === 1
                && shares.length === 2
                ? cadenceInfluence.occupiedSide
                    * (releasedIndices[0] === 1 ? 1 : -1)
                : 0;
            const cadenceAuthority = cadencePreferredForkSide
                ? clamp(
                    cadenceInfluence.pressure
                        * (1.02 + cadenceInfluence.investment * 0.65),
                    0,
                    0.88,
                )
                : 0;
            const sideScore = baseSide * (1 - cadenceAuthority)
                + cadencePreferredForkSide * cadenceAuthority;
            const side = Math.sign(sideScore) || baseSide;
            const cadenceAdjusted = side !== baseSide;
            return Object.freeze({
                side,
                source: cadenceAdjusted
                    ? 'continuous_axis_meristem_cadence'
                    : (curveConditioned
                        ? 'outside_curve_preference'
                        : 'inherited_handoff_rhythm'),
                baseSide,
                curveSign,
                outsideCurveSign: -curveSign,
                curveAngleRadians: rounded(curveAngle),
                stationSignal: rounded(stationSignal),
                releasedChildIndex: releasedIndices.length === 1 ? releasedIndices[0] : null,
                cadencePreferredForkSide,
                cadenceAuthority: rounded(cadenceAuthority),
                sideScore: rounded(sideScore),
                cadenceAdjusted,
                meristemCadence: cadenceInfluence,
            });
        }

        function resolveNextHandoffPlan(frontier, forkSide, lineageResponse = null) {
            const priorRepeatCount = frontier.handoffRepeatCount ?? 0;
            const baseRhythmSignal = (
                Math.sin(
                    frontier.temperament.developmentalPhase * 3.91
                        + frontier.temperament.forkContrastBias * 2.17
                        + frontier.temperament.resourceBias * 1.73
                        + frontier.temperament.clusterSlot * 1.43,
                ) + 1
            ) * 0.5;
            const lineagePhase = clamp(lineageResponse?.handoff_phase ?? 0, -1, 1);
            const rhythmSignal = clamp(baseRhythmSignal + lineagePhase * 0.32, 0, 1);
            const repeat = priorRepeatCount === 0 && rhythmSignal >= 0.68;
            return Object.freeze({
                sign: repeat ? Math.sign(forkSide) : -Math.sign(forkSide),
                repeated: repeat,
                repeatCount: repeat ? 1 : 0,
                baseRhythmSignal: rounded(baseRhythmSignal),
                lineagePhase: rounded(lineagePhase),
                rhythmSignal: rounded(rhythmSignal),
            });
        }

        function resolveChildReiterationForecasts(
            context,
            parent,
            decisions,
            allocations,
            fieldPotentials = [],
            lineageResponses = [],
        ) {
            return Object.freeze(allocations.map((allocation, index) => {
                const response = lineageResponses[index] || {};
                const potential = clamp(
                    0.03
                        + allocation.reiterationShare * 0.15
                        + allocation.extensionShare * 0.1
                        + allocation.supportShare * 0.06
                        + (fieldPotentials[index] || 0) * 0.14
                        + (response.axis_extent || 0) * 0.05
                        + (response.allocation_coupling || 0) * 0.04
                        - (response.fork_rhythm || 0) * 0.035,
                    0.06,
                    0.58,
                );
                return context.rng.next() < potential ? 1 : 0;
            }));
        }

        function resolveChildReiterationReserves(
            parent,
            decisions,
            allocations,
            fieldPotentials = [],
            lineageResponses = [],
        ) {
            const parentReadiness = clamp(
                Number(parent.developmentState?.reiterationReadiness || 0),
                0,
                1.25,
            );
            return Object.freeze(allocations.map((allocation, index) => {
                const response = lineageResponses[index] || {};
                return rounded(clamp(
                    parentReadiness * 0.24
                        + allocation.reiterationShare * 0.28
                        + allocation.extensionShare * 0.12
                        + allocation.supportShare * 0.08
                        + (fieldPotentials[index] || 0) * 0.22
                        + (response.axis_extent || 0) * 0.06
                        - (response.fork_rhythm || 0) * 0.035,
                    0.14,
                    0.86,
                ));
            }));
        }

        function prospectiveExtent(context, child) {
            const tierMultiplier = child.tier === 0
                ? 0.78
                : (child.tier === 1 ? 0.62 : 0.4);
            return child.runLength
                * (1 + (child.reiterationReserve || 0) * tierMultiplier)
                * Math.exp((child.temperament?.lineageResponse?.axis_extent || 0) * 0.12)
                * context.phenotype.biomassHorizonScale;
        }

        return Object.freeze({
            resolveForkReferenceFrame,
            selectForkDirection,
            resolveForkSidePlan,
            resolveNextHandoffPlan,
            resolveChildReiterationForecasts,
            resolveChildReiterationReserves,
            prospectiveExtent,
        });
    }

    scope.ZenBonsaiTypedDevelopmentalSchedulerForkField = Object.freeze({
        createOwner,
    });
}(zenPlumeKernelRealm));
