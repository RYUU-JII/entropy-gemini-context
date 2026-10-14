import {zenPlumeKernelRealm} from "../../kernelRealm.js";
/**
 * G15.4 spatial reservation and occupancy owner.
 *
 * This owner previews future corridors and scores bounded candidate steering.
 * It observes committed geometry but never rewrites existing segments.
 */
(function installTypedDevelopmentalSpatialField(scope) {
    'use strict';

    const programs = scope.ZenBonsaiTypedDevelopmentalSchedulerPrograms;
    if (!programs) {
        throw new Error('[G15.4_SPATIAL] developmental-programs.js must load first.');
    }
    const {
        TIERS,
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
        angularDistance,
        constrainDirectionToCone,
        signedPlanarAngle,
        rounded,
    } = programs;

    function createOwner(dependencies) {
        const required = [
            'idFor',
            'nodeById',
            'stabilizeAxisIntent',
            'clusterAttractionScore',
        ];
        const missing = required.filter((name) => (
            !dependencies || typeof dependencies[name] !== 'function'
        ));
        if (missing.length) {
            throw new Error(
                '[G15.4_SPATIAL] Missing owner dependencies: ' + missing.join(', '),
            );
        }
        const {
            idFor,
            nodeById,
            stabilizeAxisIntent,
            clusterAttractionScore,
        } = dependencies;
        function distancePointToSegment(point, start, end) {
            const span = subtract(end, start);
            const denominator = dot(span, span);
            if (denominator <= 1e-9) return distance(point, start);
            const progress = clamp(dot(subtract(point, start), span) / denominator, 0, 1);
            return distance(point, add(start, scale(span, progress)));
        }
    
        function projectedSegmentsCross(leftStart, leftEnd, rightStart, rightEnd) {
            const orientation = (a, b, c) => (
                (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
            );
            const leftA = orientation(leftStart, leftEnd, rightStart);
            const leftB = orientation(leftStart, leftEnd, rightEnd);
            const rightA = orientation(rightStart, rightEnd, leftStart);
            const rightB = orientation(rightStart, rightEnd, leftEnd);
            return leftA * leftB < -1e-6 && rightA * rightB < -1e-6;
        }
    
        function distanceBetweenSegments(leftStart, leftEnd, rightStart, rightEnd) {
            const leftMidpoint = scale(add(leftStart, leftEnd), 0.5);
            const rightMidpoint = scale(add(rightStart, rightEnd), 0.5);
            return Math.min(
                distancePointToSegment(leftStart, rightStart, rightEnd),
                distancePointToSegment(leftEnd, rightStart, rightEnd),
                distancePointToSegment(rightStart, leftStart, leftEnd),
                distancePointToSegment(rightEnd, leftStart, leftEnd),
                distancePointToSegment(leftMidpoint, rightStart, rightEnd),
                distancePointToSegment(rightMidpoint, leftStart, leftEnd),
            );
        }
    
        function prospectiveHorizon(context, episode, episodeAge = 0) {
            const committed = clamp(
                episode.commitmentDuration - episodeAge + 1,
                2,
                5,
            );
            const phenotypeHorizon = clamp(
                Math.round(2 + context.phenotype.corridorForesight * 3),
                2,
                5,
            );
            return clamp(Math.max(committed, phenotypeHorizon), 2, 5);
        }
    
        function corridorBounds(points) {
            return {
                minimumX: Math.min(...points.map((point) => point.x)),
                maximumX: Math.max(...points.map((point) => point.x)),
                minimumY: Math.min(...points.map((point) => point.y)),
                maximumY: Math.max(...points.map((point) => point.y)),
                minimumZ: Math.min(...points.map((point) => point.z)),
                maximumZ: Math.max(...points.map((point) => point.z)),
            };
        }
    
        function corridorBoundsAreSeparated(left, right, clearance) {
            return left.maximumX + clearance < right.minimumX
                || right.maximumX + clearance < left.minimumX
                || left.maximumY + clearance < right.minimumY
                || right.maximumY + clearance < left.minimumY
                || left.maximumZ + clearance < right.minimumZ
                || right.maximumZ + clearance < left.minimumZ;
        }
    
        function sagGravityWeight(age, gravityResponse) {
            return clamp(
                0.14 + age * 0.095 + gravityResponse * 0.16,
                0.24,
                0.62,
            );
        }
    
        function prospectiveCorridorPreview(context, spec) {
            const tier = TIERS[spec.tier];
            const horizon = prospectiveHorizon(
                context,
                spec.episode,
                spec.episodeAge ?? 0,
            );
            const points = [{ ...spec.origin }];
            let direction = normalize(spec.direction);
            let point = spec.origin;
            let sagAge = spec.sag?.age ?? 0;
            for (let step = 0; step < horizon; step += 1) {
                if (step > 0) {
                    const targetTurn = signedPlanarAngle(
                        direction,
                        spec.episode.targetHeading,
                    );
                    const turn = clamp(
                        targetTurn * 0.24 + spec.episode.curvatureVelocity * 0.42,
                        -tier.maximumTurn * 0.74,
                        tier.maximumTurn * 0.74,
                    );
                    direction = rotateGrowthPlane(direction, turn);
                    direction = mixDirection(
                        direction,
                        spec.episode.targetHeading,
                        0.055 + spec.episode.turnPersistence * 0.025,
                    );
                    if (
                        spec.tier >= 1
                        && !spec.sag?.active
                        && spec.axisEntryHeading
                    ) {
                        direction = constrainDirectionToCone(
                            direction,
                            spec.axisEntryHeading,
                            spec.tier === 1
                                ? (spec.horizontalRelease ? 0.92 : 1.04)
                                : 0.84,
                        );
                        if (spec.horizontalRelease && direction.y < -0.06) {
                            direction = normalize({
                                x: direction.x,
                                y: -0.06,
                                z: direction.z,
                            });
                        }
                    }
                }
                if (spec.sag?.active) {
                    sagAge += 1;
                    const gravityWeight = sagGravityWeight(
                        sagAge,
                        spec.episode.gravityResponse,
                    );
                    direction = mixDirection(direction, { x: 0, y: -1, z: 0 }, gravityWeight);
                }
                const stepLength = spec.runLength * (1 - step * 0.052);
                point = pointAt(point, direction, stepLength);
                points.push(point);
            }
            return {
                points,
                bounds: corridorBounds(points),
                horizon,
                radius: spec.radius,
                tier: spec.tier,
                direction: normalize(spec.direction),
                clusterId: spec.clusterId || null,
            };
        }
    
        function corridorConflictScore(context, preview, extraCorridors = []) {
            let score = 0;
            const reservations = [
                ...context.activeCorridorIds,
            ].map((corridorId) => context.corridorIndex.get(corridorId))
                .filter(Boolean)
                .concat(extraCorridors);
            reservations.forEach((reservation) => {
                const sameCluster = Boolean(
                    preview.clusterId
                    && reservation.clusterId
                    && preview.clusterId === reservation.clusterId,
                );
                const proximityScale = sameCluster ? 0.34 : 1;
                const crossingScale = sameCluster ? 0.78 : 1;
                const parallelScale = sameCluster ? 0.24 : 1;
                const sharedOrigin = distance(preview.points[0], reservation.points[0]) < 1e-5;
                const clearance = preview.radius
                    + reservation.radius
                    + 7
                    + context.phenotype.spatialReserve * 8;
                if (corridorBoundsAreSeparated(
                    preview.bounds,
                    reservation.bounds,
                    clearance * 1.45,
                )) return;
                for (let leftIndex = 0; leftIndex < preview.points.length - 1; leftIndex += 1) {
                    const leftStart = preview.points[leftIndex];
                    const leftEnd = preview.points[leftIndex + 1];
                    for (
                        let rightIndex = 0;
                        rightIndex < reservation.points.length - 1;
                        rightIndex += 1
                    ) {
                        if (sharedOrigin && leftIndex === 0 && rightIndex === 0) continue;
                        const rightStart = reservation.points[rightIndex];
                        const rightEnd = reservation.points[rightIndex + 1];
                        const nearest = distanceBetweenSegments(
                            leftStart,
                            leftEnd,
                            rightStart,
                            rightEnd,
                        );
                        const futureWeight = 1 / (1 + (leftIndex + rightIndex) * 0.22);
                        if (nearest < clearance) {
                            score += ((clearance - nearest) / clearance) ** 2
                                * 6.2
                                * futureWeight
                                * proximityScale;
                        }
                        const leftDepth = (leftStart.z + leftEnd.z) * 0.5;
                        const rightDepth = (rightStart.z + rightEnd.z) * 0.5;
                        if (
                            Math.abs(leftDepth - rightDepth) < clearance * 0.42
                            && projectedSegmentsCross(
                                leftStart,
                                leftEnd,
                                rightStart,
                                rightEnd,
                            )
                        ) score += 4.1 * futureWeight * crossingScale;
                        const leftDirection = normalize(subtract(leftEnd, leftStart));
                        const rightDirection = normalize(subtract(rightEnd, rightStart));
                        if (dot(leftDirection, rightDirection) > 0.91 && nearest < clearance * 1.45) {
                            score += (1 - nearest / (clearance * 1.45))
                                * 1.9
                                * futureWeight
                                * parallelScale;
                        }
                    }
                }
            });
            return score;
        }
    
        function reserveFrontierCorridor(context, frontier, sequence) {
            const origin = nodeById(context, frontier.nodeId)?.point;
            if (!origin) return null;
            const tier = TIERS[frontier.tier];
            const runLength = tier.meanLength
                * context.preset.statureScale
                * frontier.temperament.lengthScale
                * frontier.temperament.axisExtentScale
                * frontier.temperament.axisReachScale
                * frontier.episode.segmentLengthScale
                * clamp(0.82 + frontier.vigor * 0.18, 0.78, 1.12);
            const preview = prospectiveCorridorPreview(context, {
                origin,
                direction: frontier.heading,
                runLength,
                radius: frontier.radius,
                tier: frontier.tier,
                episode: frontier.episode,
                episodeAge: frontier.episodeAge,
                sag: frontier.sag,
                clusterId: frontier.clusterId,
                axisEntryHeading: frontier.axisEntryHeading,
                horizontalRelease: frontier.horizontalRelease,
            });
            const corridor = {
                id: idFor(context, 'corridor'),
                frontierId: frontier.id,
                lineageId: frontier.lineageId,
                tier: frontier.tier,
                episodeId: frontier.episode.id,
                points: preview.points.map((point) => Object.freeze({
                    x: rounded(point.x),
                    y: rounded(point.y),
                    z: rounded(point.z),
                })),
                bounds: Object.freeze(Object.fromEntries(Object.entries(
                    preview.bounds,
                ).map(([key, value]) => [key, rounded(value)]))),
                radius: rounded(frontier.radius),
                horizon: preview.horizon,
                reservedAtEvent: sequence,
                releasedAtEvent: null,
                clusterId: frontier.clusterId,
            };
            context.corridors.push(corridor);
            context.corridorIndex.set(corridor.id, corridor);
            context.frontierCorridorIndex.set(frontier.id, corridor.id);
            context.activeCorridorIds.add(corridor.id);
            return corridor.id;
        }
    
        function releaseFrontierCorridor(context, frontierId, sequence) {
            const corridorId = context.frontierCorridorIndex.get(frontierId);
            if (!corridorId) return null;
            const corridor = context.corridorIndex.get(corridorId);
            if (corridor && corridor.releasedAtEvent === null) {
                corridor.releasedAtEvent = sequence;
            }
            context.activeCorridorIds.delete(corridorId);
            return corridorId;
        }
    
        function occupancyScore(
            context,
            origin,
            target,
            radius,
            baseDirection,
            direction,
            clusterId = null,
        ) {
            let score = angularDistance(baseDirection, direction) * 0.8;
            const midpoint = scale(add(origin, target), 0.5);
            context.occupancy.forEach((occupied) => {
                if (context.retiredLineageIds?.has(occupied.lineageId)) return;
                const sharesOrigin = distance(origin, occupied.start) < 1e-6
                    || distance(origin, occupied.end) < 1e-6;
                const sameCluster = Boolean(
                    clusterId && occupied.clusterId && clusterId === occupied.clusterId,
                );
                const clearance = radius + occupied.radius + 10;
                const targetDistance = distancePointToSegment(
                    target,
                    occupied.start,
                    occupied.end,
                );
                const midpointDistance = distancePointToSegment(
                    midpoint,
                    occupied.start,
                    occupied.end,
                );
                const nearest = Math.min(targetDistance, midpointDistance);
                if (!sharesOrigin && nearest < clearance) {
                    score += ((clearance - nearest) / clearance) ** 2
                        * 7
                        * (sameCluster ? 0.42 : 1);
                }
                if (
                    !sharesOrigin
                    && projectedSegmentsCross(origin, target, occupied.start, occupied.end)
                ) {
                    score += 4.8 * (sameCluster ? 0.82 : 1);
                }
            });
            const maximumX = 520
                * context.form.spreadScale
                * context.phenotype.crownSpread
                * context.preset.spreadScale;
            const maximumY = 660
                * context.form.heightScale
                * context.phenotype.stature
                * context.preset.statureScale;
            if (Math.abs(target.x) > maximumX) {
                score += ((Math.abs(target.x) - maximumX) / 80) ** 2 * 3;
            }
            if (target.y > maximumY) {
                score += ((target.y - maximumY) / 90) ** 2 * 2;
            }
            return score;
        }
    
        function crownDepthEnvelopePenalty(context, target) {
            if (!context.nodes.length) return 0;
            let minimumZ = target.z;
            let maximumZ = target.z;
            context.nodes.forEach((node) => {
                minimumZ = Math.min(minimumZ, node.point.z);
                maximumZ = Math.max(maximumZ, node.point.z);
            });
            const targetSpan = Math.max(20, context.phenotype.crownDepthSpanTarget);
            const span = maximumZ - minimumZ;
            if (span <= targetSpan) return 0;
            return ((span - targetSpan) / targetSpan) ** 2 * 18;
        }
    
        function selectAdvanceDirection(
            context,
            frontier,
            origin,
            baseDirection,
            runLength,
            episode,
        ) {
            const continuity = clamp(
                Number(frontier.developmentState?.apicalContinuity ?? 0.5),
                0,
                1,
            );
            const terminal = clamp(
                Number(frontier.developmentState?.terminalAffinity ?? 0.2),
                0,
                1,
            );
            const depth = (0.04 + (1 - continuity) * 0.055 + terminal * 0.02)
                * context.phenotype.depthAffinity * 0.72;
            const maximumLateralOffset = clamp(
                0.055 + continuity * 0.055 + terminal * 0.018,
                0.05,
                0.13,
            );
            const candidateOffsets = [
                [-maximumLateralOffset, 0],
                [-maximumLateralOffset * 0.5, 0],
                [0, -depth],
                [0, 0],
                [0, depth],
                [maximumLateralOffset * 0.5, 0],
                [maximumLateralOffset, 0],
            ];
            const candidates = candidateOffsets.map(([delta, depthDelta]) => {
                const direction = stabilizeAxisIntent(
                    context,
                    frontier,
                    tiltDepth(rotateGrowthPlane(baseDirection, delta), depthDelta),
                );
                const target = pointAt(origin, direction, runLength);
                const corridorPreview = prospectiveCorridorPreview(context, {
                    origin,
                    direction,
                    runLength,
                    radius: frontier.radius,
                    tier: frontier.tier,
                    episode,
                    episodeAge: episode === frontier.episode ? frontier.episodeAge : 0,
                    sag: frontier.sag,
                    clusterId: frontier.clusterId,
                    axisEntryHeading: frontier.axisEntryHeading,
                    horizontalRelease: frontier.horizontalRelease,
                });
                const baseScore = occupancyScore(
                    context,
                    origin,
                    target,
                    frontier.radius,
                    baseDirection,
                    direction,
                    frontier.clusterId,
                );
                return {
                    direction,
                    target,
                    baseScore,
                    corridorPreview,
                };
            }).sort((left, right) => left.baseScore - right.baseScore)
                .map((candidate) => {
                    const corridorScore = corridorConflictScore(
                        context,
                        candidate.corridorPreview,
                    );
                    return {
                        ...candidate,
                        corridorScore,
                        score: candidate.baseScore
                            + crownDepthEnvelopePenalty(context, candidate.target)
                            + clusterAttractionScore(
                                frontier,
                                origin,
                                candidate.target,
                                runLength,
                            )
                            + corridorScore
                                * (1.35 + context.phenotype.spatialReserve * 0.75)
                                * context.corridorStrength,
                    };
                })
                .sort((left, right) => left.score - right.score);
            return candidates[0];
        }
    

        return Object.freeze({
            sagGravityWeight,
            prospectiveCorridorPreview,
            corridorConflictScore,
            reserveFrontierCorridor,
            releaseFrontierCorridor,
            occupancyScore,
            crownDepthEnvelopePenalty,
            selectAdvanceDirection,
        });
    }

    scope.ZenBonsaiTypedDevelopmentalSchedulerSpatialField = Object.freeze({
        createOwner,
    });
}(zenPlumeKernelRealm));
