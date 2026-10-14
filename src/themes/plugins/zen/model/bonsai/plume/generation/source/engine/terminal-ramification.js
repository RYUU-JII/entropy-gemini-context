import {zenPlumeKernelRealm} from "../../kernelRealm.js";
import {familyLateralBirth} from "../research/factor-growth-4/ZenG15ReleaseGrowth.js";
/**
 * G15.4 live lateral-axis owner.
 *
 * Order-0 and order-1 axes may emit one order-higher lateral axis at a node
 * while their apical continuation is committed. The site is never revisited
 * by a delayed scheduler. Gravity owns elevation while the parent growth plane
 * supplies a visible left/right deflection.
 */
import { bindZenG15AxisDevelopment, zenG15AxisLateralOpportunity, resolveZenG15AxisDevelopment } from './ZenBonsaiG15AxisDevelopment.js';
import {zenG15LateralAddress,withZenG15DecisionRandom} from './ZenBonsaiG15DecisionRandom.js';
(function installTypedDevelopmentalTerminalRamification(scope) {
    'use strict';

    const programs = scope.ZenBonsaiTypedDevelopmentalSchedulerPrograms;
    const constructionAccount = scope
        .ZenBonsaiTypedDevelopmentalSchedulerConstructionAccount;
    const axisStateOwner = scope.ZenBonsaiTypedDevelopmentalSchedulerAxisState;
    const meristemCadenceOwner = scope
        .ZenBonsaiTypedDevelopmentalSchedulerMeristemCadence;
    const lateralJunctionField = scope
        .ZenBonsaiTypedDevelopmentalSchedulerLateralJunction;
    const tierArchitectureOwner = scope
        .ZenBonsaiTypedDevelopmentalSchedulerTierArchitecture;
    if (
        !programs
        || !constructionAccount
        || !axisStateOwner
        || !meristemCadenceOwner
        || !lateralJunctionField
        || !tierArchitectureOwner
    ) {
        throw new Error(
            '[G15.4_TERMINAL] programs, construction-account, axis-state, meristem-cadence, lateral-junction, and tier-architecture owners must load first.',
        );
    }
    const {
        LATERAL_MERISTEM_SEMANTICS,
        TIERS,
        clamp,
        pointAt,
        angularDistance,
        constrainDirectionToCone,
        mixDirection,
        normalize,
        subtract,
        signedPlanarAngle,
        rotateGrowthPlane,
        directionAzimuth,
        directionElevation,
        directionFromAzimuthElevation,
        rounded,
        inheritTemperament,
        createLateralLineageResponse,
        createScaffoldFamilyDominanceClaim,
        inheritScaffoldFamilyDominanceClaim,
        resolveScaffoldFamilyDominance,
    } = programs;
    const {
        createChildDevelopmentState,
        resolveAxisRadiusProfile,
    } = axisStateOwner;
    const {
        resolveMeristemCadenceInfluence,
        resolveLiveLateralReleaseFeasibility,
        resolveJuvenileShootOpportunity,
        createJunctionCadence,
    } = meristemCadenceOwner;
    const { resolveJointLateralJunction } = lateralJunctionField;
    const {
        tierFor,
        tierRoleFor,
        resolveRelativeDifferentiationPotential,
        resolveTierZeroStructuralStation,
    } = tierArchitectureOwner;

    function createOwner(dependencies) {
        const required = [
            'idFor',
            'heightBandFor',
            'nodeById',
            'createTerminalCluster',
            'resolveFutureBalanceField',
            'resolveCrownInteriorExposure',
            'createScaffoldFamilyGesture',
            'resolveCrownBirthOpportunity',
            'createChildEpisode',
            'segmentRunLength',
            'selectForkDirection',
            'createLineage',
            'addNode',
            'addSegment',
            'addFrontier',
            'activeSnapshot',
            'activeCorridorSnapshot',
            'registerLateralMeristemPotential',
            'commitLateralMeristemEmission',
            'shouldFork',
        ];
        const missing = required.filter((name) => (
            !dependencies || typeof dependencies[name] !== 'function'
        ));
        if (missing.length) {
            throw new Error(
                '[G15.4_TERMINAL] Missing owner dependencies: ' + missing.join(', '),
            );
        }
        const {
            idFor,
            heightBandFor,
            nodeById,
            createTerminalCluster,
            resolveFutureBalanceField,
            resolveCrownInteriorExposure,
            createScaffoldFamilyGesture,
            resolveCrownBirthOpportunity,
            createChildEpisode,
            segmentRunLength,
            selectForkDirection,
            createLineage,
            addNode,
            addSegment,
            addFrontier,
            activeSnapshot,
            activeCorridorSnapshot,
            registerLateralMeristemPotential,
            commitLateralMeristemEmission,
            shouldFork,
        } = dependencies;

        function segmentDirection(context, segment) {
            const start = nodeById(context, segment.fromNodeId)?.point;
            const end = nodeById(context, segment.toNodeId)?.point;
            if (!start || !end) return null;
            return normalize(subtract(end, start));
        }

        function resolveLiveParentState(context, meristem, continuation = null) {
            const lineage = context.lineageIndex.get(meristem.parentLineageId);
            if (!lineage) return null;
            const segments = lineage.segmentIds
                .map((segmentId) => context.segments.find(
                    (segment) => segment.id === segmentId,
                ))
                .filter(Boolean);
            if (!segments.length) return null;
            const active = [...context.activeFrontierIds]
                .map((frontierId) => context.frontierIndex.get(frontierId))
                .find((frontier) => frontier?.lineageId === meristem.parentLineageId);
            const family = context.frontiers.filter(
                (frontier) => frontier.lineageId === meristem.parentLineageId,
            );
            const latest = active || family.at(-1);
            const totalLength = segments.reduce(
                (total, segment) => total + segment.length,
                0,
            );
            const sourceIndex = segments.findIndex(
                (segment) => segment.id === meristem.sourceSegmentId,
            );
            const sourceLength = segments.slice(0, sourceIndex + 1).reduce(
                (total, segment) => total + segment.length,
                0,
            );
            const terminalHeading = segmentDirection(context, segments.at(-1))
                || meristem.parentHeading;
            return Object.freeze({
                active: Boolean(active),
                activeFrontierId: active?.id || null,
                heading: continuation?.heading || latest?.heading || terminalHeading,
                localHeading: continuation?.heading || meristem.parentHeading,
                radius: continuation?.radius || latest?.radius || segments.at(-1).endRadius,
                vigor: continuation?.vigor || latest?.vigor
                    || Math.min(meristem.sourceVigor, 0.58),
                resourceReserve: continuation?.resourceReserve
                    ?? latest?.resourceReserve
                    ?? 0.34,
                constructionReserve: continuation?.constructionReserve
                    ?? latest?.constructionReserve
                    ?? meristem.sourceConstructionReserve
                    ?? 0.34,
                developmentalCapacity: continuation?.developmentalCapacity
                    ?? latest?.developmentalCapacity
                    ?? meristem.sourceDevelopmentalCapacity
                    ?? 0.18,
                extensionCapacity: continuation?.extensionAllocation
                    ?? latest?.extensionAllocation
                    ?? meristem.sourceExtensionCapacity
                    ?? 0.24,
                supportCapacity: continuation?.supportAllocation
                    ?? latest?.supportAllocation
                    ?? meristem.sourceSupportCapacity
                    ?? 0.24,
                spatialExposure: continuation?.spatialExposure
                    ?? latest?.spatialExposure
                    ?? 0.48,
                developmentState: continuation?.developmentState
                    || latest?.developmentState
                    || null,
                totalLength,
                sourceLength,
                distalFraction: clamp(sourceLength / Math.max(1e-8, totalLength), 0, 1),
                segmentsAfterSource: Math.max(0, segments.length - sourceIndex - 1),
            });
        }

        function createLateralMeristem(
            context,
            frontier,
            node,
            segment,
            sequence,
            constructionState = {},
        ) {
            if (
                context.researchControls?.liveSecondaryAxes === false
                || frontier.completionFork
                || frontier.temporaryAxis
            ) return null;
            const nextAge = frontier.axisAge + 1;
            const lineage = context.lineageIndex.get(frontier.lineageId);
            const accumulatedArcLength = lineage.segmentIds.reduce((total, segmentId) => {
                const owned = context.segments.find((candidate) => candidate.id === segmentId);
                return total + (owned?.length || 0);
            }, 0);
            const parentCapacity = clamp(frontier.developmentalCapacity, 0.02, 1);
            const reserveCost = clamp(
                0.028 + (1 - Math.sqrt(parentCapacity)) * 0.018,
                0.028,
                0.046,
            );
            const constructionPortfolio = constructionState
                .constructionPortfolio || null;
            const releaseCapacity = Math.max(
                0,
                Number(constructionPortfolio?.lateralReleaseCapacity || 0),
            );
            const committedReleaseCount = Math.max(
                0,
                Number(constructionPortfolio?.lateralReleasesCommitted || 0),
            );
            if (committedReleaseCount >= releaseCapacity) return null;
            const inheritedArcTiming = constructionPortfolio?.lateralTimingMode
                === 'inherited_axis_family_arc_readiness';
            const physicalAxisTiming = constructionPortfolio?.lateralTimingMode === 'physical_axis_distance';
            const structuralReleaseReadiness = inheritedArcTiming
                ? resolveLiveLateralReleaseFeasibility(
                    frontier,
                    constructionPortfolio,
                )
                : null;
            const juvenileShootOpportunity = inheritedArcTiming
                ? resolveJuvenileShootOpportunity(
                    frontier,
                    constructionPortfolio,
                )
                : null;
            const temporaryAxis = Boolean(
                inheritedArcTiming
                && !structuralReleaseReadiness.eligible
                && juvenileShootOpportunity?.eligible,
            );
            if (
                inheritedArcTiming
                && !structuralReleaseReadiness.eligible
                && !temporaryAxis
            ) {
                return null;
            }
            // A fork and a lateral are separate graph transactions competing
            // for the same physical node. When the canonical fork predicate
            // is already executable after this internode, let that mature
            // apical transaction claim the node instead of letting a lateral
            // fire first merely because advance processing happens earlier.
            const structuralForkReady = inheritedArcTiming && shouldFork({
                ...frontier,
                axisAge: nextAge,
            });
            if (structuralForkReady && !temporaryAxis) return null;
            const releaseProgresses = constructionPortfolio
                ?.lateralReleaseProgresses || [];
            const targetProgress = inheritedArcTiming
                ? null
                : Number(releaseProgresses[committedReleaseCount] ?? 1);
            const remainingReleaseCount = Math.max(
                1,
                releaseCapacity - committedReleaseCount,
            );
            const availableLateralConstruction = Math.max(
                0,
                Number(constructionPortfolio?.lateralConstructionBudget || 0),
            );
            const constructionGrant = availableLateralConstruction
                / remainingReleaseCount;
            const lineageSegments = lineage.segmentIds
                .map((segmentId) => context.segments.find(
                    (candidate) => candidate.id === segmentId,
                ))
                .filter(Boolean);
            // A live lateral site belongs to the established middle run of the
            // parent. It is neither stamped at the fork junction nor attached
            // later to an already completed tip.
            if (nextAge < 2 || lineageSegments.length < 2) return null;
            const plannedInternodeCount = Math.max(
                4,
                Number(constructionPortfolio?.plannedInternodeCount || 4),
            );
            const plannedAxisProgress = clamp(
                Number(constructionPortfolio?.cursor || lineageSegments.length)
                    / plannedInternodeCount,
                0,
                1,
            );
            const spatialOpportunity = physicalAxisTiming
                ? zenG15AxisLateralOpportunity(constructionPortfolio, lineageSegments) : null;
            if (spatialOpportunity && !spatialOpportunity.ready) return null;
            if (
                !inheritedArcTiming
                && !physicalAxisTiming
                && plannedAxisProgress + 1e-8 < targetProgress
            ) return null;
            const previousDirection = lineageSegments.length > 1
                ? segmentDirection(context, lineageSegments.at(-2))
                : null;
            const currentDirection = segmentDirection(context, segment)
                || frontier.heading;
            const localCurve = previousDirection
                ? signedPlanarAngle(previousDirection, currentDirection)
                : 0;
            const inheritedSide = -Math.sign(
                frontier.nextTurnSign || frontier.episode.turnSign,
            ) || context.phenotype.asymmetrySign;
            const outsideCurveSide = Math.abs(localCurve) >= 0.025
                ? -Math.sign(localCurve)
                : 0;
            const alternatingSide = committedReleaseCount % 2 === 0
                ? inheritedSide
                : -inheritedSide;
            const phase = (
                Math.sin(
                    nextAge * 1.71
                        + frontier.temperament.resourceBias * 3.13
                        + frontier.temperament.clusterSlot * 1.27,
                ) + 1
            ) * 0.5;
            const curveAuthority = clamp(
                Math.abs(localCurve) / 0.11 * 0.55
                    + frontier.temperament.curvatureMemory * 0.1
                    + phase * 0.08,
                0,
                1,
            );
            const previousLateralSide = Math.sign(Number(
                constructionPortfolio?.lastLateralSide || 0,
            ));
            const previousLateralProgress = Number(
                constructionPortfolio?.lastLateralProgress,
            );
            const releaseGap = Number.isFinite(previousLateralProgress)
                ? Math.max(0, plannedAxisProgress - previousLateralProgress)
                : 1;
            const sameSideInhibition = previousLateralSide
                && outsideCurveSide === previousLateralSide
                ? Math.exp(-releaseGap / 0.34)
                : 0;
            // Curve, phyllotactic alternation, and future balance contribute
            // to one continuous side decision. An outside curve remains a
            // tendency, but a recently occupied side locally inhibits another
            // adjacent emission instead of being overridden by a hard rule.
            const outsideCurveWeight = outsideCurveSide
                ? curveAuthority * (1 - sameSideInhibition * 0.72)
                : 0;
            const alternationWeight = 0.34
                + (1 - curveAuthority) * 0.18
                + sameSideInhibition * 0.58;
            const balanceField = resolveFutureBalanceField(context, frontier);
            const balanceSignal = clamp(
                balanceField.pressureX / 0.16,
                -1,
                1,
            ) * 0.46 * (0.7 + phase * 0.3);
            const meristemCadenceInfluence = resolveMeristemCadenceInfluence(
                frontier,
                frontier.developmentState,
            );
            const cadenceSidePressure = meristemCadenceInfluence.occupiedSide
                * meristemCadenceInfluence.pressure
                * (0.54 + meristemCadenceInfluence.investment * 0.34);
            const crownInteriorExposure = resolveCrownInteriorExposure(
                context,
                frontier,
                node.point,
                sequence,
            );
            const interiorBridgeSide = crownInteriorExposure.bridgeDirection
                ? Math.sign(signedPlanarAngle(
                    currentDirection,
                    crownInteriorExposure.bridgeDirection,
                ))
                : 0;
            const interiorBridgeSidePressure = interiorBridgeSide
                * crownInteriorExposure.pressure * 0.38;
            const sideScore = outsideCurveSide * outsideCurveWeight
                + alternatingSide * alternationWeight
                + balanceSignal
                + interiorBridgeSidePressure
                - previousLateralSide * sameSideInhibition * 0.44
                - cadenceSidePressure;
            const side = Math.sign(sideScore) || alternatingSide;
            const outsideCurveAccepted = Boolean(outsideCurveSide)
                && side === outsideCurveSide
                && outsideCurveWeight >= alternationWeight * 0.72;
            const baseSide = outsideCurveAccepted
                ? outsideCurveSide
                : alternatingSide;
            const resourceShare = temporaryAxis
                ? clamp(0.115 + phase * 0.07, 0.11, 0.19)
                : clamp(0.16 + phase * 0.16, 0.14, 0.32);
            const meristem = {
                id: idFor(context, 'meristem'),
                semantics: LATERAL_MERISTEM_SEMANTICS,
                nodeId: node.id,
                sourceSegmentId: segment.id,
                sourceFrontierId: frontier.id,
                parentLineageId: frontier.lineageId,
                parentTier: frontier.tier,
                childTier: tierFor(frontier.axisOrder + 1),
                childAxisOrder: tierFor(frontier.axisOrder + 1),
                parentTierRole: tierRoleFor(frontier.axisOrder),
                childTierRole: tierRoleFor(frontier.axisOrder + 1),
                parentHeading: Object.freeze({ ...currentDirection }),
                parentEpisode: frontier.episode,
                parentTurnVelocity: frontier.turnVelocity,
                temperament: frontier.temperament,
                sourceRadius: segment.endRadius,
                sourceSegmentLength: segment.length,
                sourceVigor: frontier.vigor,
                sourceResourceReserve: frontier.resourceReserve,
                sourceConstructionReserve: frontier.constructionReserve,
                sourceDevelopmentalCapacity: rounded(parentCapacity),
                sourceExtensionCapacity: frontier.extensionAllocation,
                sourceSupportCapacity: frontier.supportAllocation,
                reserveCost: rounded(reserveCost),
                constructionGrant: rounded(constructionGrant),
                sourceSpatialExposure: frontier.spatialExposure,
                generationDepth: frontier.generationDepth,
                side,
                heightBand: heightBandFor(node.point),
                resourceShare: rounded(resourceShare),
                arcLength: rounded(accumulatedArcLength),
                plannedAxisProgress: rounded(plannedAxisProgress),
                preferredAxisProgress: targetProgress === null
                    ? null
                    : rounded(targetProgress),
                structuralReleaseReadiness,
                juvenileShootOpportunity,
                developmentalRole: temporaryAxis
                    ? 'juvenile_sacrifice_axis'
                    : 'permanent_scaffold_axis',
                temporaryAxis,
                releaseIndex: committedReleaseCount,
                releaseCapacity,
                localCurveRadians: rounded(localCurve),
                sideSource: outsideCurveAccepted
                    ? 'continuous_outside_curve_phyllotactic_field'
                    : 'continuous_phyllotactic_balance_field',
                balanceField,
                baseSide,
                balanceSignal: rounded(balanceSignal),
                curveAuthority: rounded(curveAuthority),
                outsideCurveWeight: rounded(outsideCurveWeight),
                alternationWeight: rounded(alternationWeight),
                previousLateralSide,
                releaseGap: rounded(releaseGap),
                ...(spatialOpportunity ? {spatialOpportunity} : {}),
                sameSideInhibition: rounded(sameSideInhibition),
                meristemCadenceInfluence,
                cadenceSidePressure: rounded(cadenceSidePressure),
                crownInteriorExposure,
                interiorBridgeSide,
                interiorBridgeSidePressure: rounded(interiorBridgeSidePressure),
                sideScore: rounded(sideScore),
                createdAtEvent: sequence,
                emittedAtEvent: null,
                emissionLineageId: null,
                status: 'registered',
            };
            context.lateralMeristems.push(meristem);
            context.lateralMeristemIndex.set(meristem.id, meristem);
            context.activeLateralMeristemIds.add(meristem.id);
            registerLateralMeristemPotential(context, meristem, sequence);
            return meristem;
        }


        function emitLateralAxis(
            context,
            meristem,
            sequence,
            proposal,
            options = {},
        ) {
            const originNode = nodeById(context, meristem.nodeId);
            const parentLineage = context.lineageIndex.get(meristem.parentLineageId);
            const sourceFrontier = context.frontierIndex.get(
                meristem.sourceFrontierId,
            );
            if (!originNode || !parentLineage || meristem.status !== 'registered') {
                throw new Error(
                    `[G15.4_SCHEDULER] Lateral meristem ${meristem.id} is not emittable.`,
                );
            }
            const meristemCompetition = commitLateralMeristemEmission(
                context,
                meristem,
                sequence,
                { coincidentContinuation: Boolean(options.embedded) },
            );
            const lineageResponse = createLateralLineageResponse(
                meristem.temperament.lineageResponse,
                meristem.side,
                meristem.resourceShare,
                (meristem.heightBand + 1) * 1.73 + meristem.createdAtEvent * 0.31,
            );
            const temperament = inheritTemperament(
                meristem.temperament,
                context.phenotype,
                meristem.resourceShare,
                meristem.childTier,
                context.rng,
                `temperament-${context.counters.lineage + 1}`,
                {
                    arity: 2,
                    specializationPolarity: meristem.side
                        * context.phenotype.asymmetrySign,
                    lineageResponse,
                },
            );
            const liveParent = resolveLiveParentState(
                context,
                meristem,
                options.continuation || null,
            );
            if (!liveParent) {
                throw new Error(
                    `[G15.4_SCHEDULER] Lateral meristem ${meristem.id} lost its parent axis.`,
                );
            }
            const azimuthDeflection = clamp(
                0.52
                    + (temperament.apertureBias - 0.9) * 0.18
                    + (context.phenotype.releaseAngle - 1) * 0.12
                    + liveParent.spatialExposure * 0.08
                    + Math.sin(
                        (meristem.heightBand + 1) * 1.73
                            + temperament.clusterSlot * 1.31,
                    ) * 0.09,
                0.46,
                0.88,
            );
            const fillWave = (
                Math.sin(
                    (meristem.createdAtEvent + 1) * 1.17
                        + meristem.heightBand * 2.03
                        + temperament.developmentalPhase * 3.31,
                ) + 1
            ) * 0.5;
            const fillDemand = Boolean(parentLineage.clusterId)
                ? fillWave * fillWave * (3 - 2 * fillWave)
                : fillWave * 0.24;
            const effectiveDeflection = clamp(
                azimuthDeflection + fillDemand * 0.18,
                0.46,
                0.98,
            );
            // Lateral sign must be visible in the crown growth plane. Rotating
            // only around world-up changed mostly Z depth for an already
            // leaning parent, so alternating sites rendered as a parallel
            // comb. First turn in the visible X/Y growth plane, then let
            // gravity establish the final elevation.
            const screenPlaneDirection = rotateGrowthPlane(
                liveParent.localHeading,
                meristem.side * effectiveDeflection,
            );
            const parentAzimuth = directionAzimuth(liveParent.localHeading);
            const parentElevation = directionElevation(liveParent.localHeading);
            const padElevationWave = Math.sin(
                (meristem.heightBand + 1) * 1.91
                    + temperament.resourceBias * 2.17,
            ) * 0.1 * context.phenotype.depthAffinity;
            const padReferenceElevation = 0.12 + (1 - fillDemand) * 0.09;
            const targetElevation = clamp(
                parentElevation * (0.36 - fillDemand * 0.16)
                    + padReferenceElevation
                        * (0.64 + fillDemand * 0.16)
                    + padElevationWave
                    + lineageResponse.axis_extent * 0.035,
                -0.035,
                0.56,
            );
            const targetAzimuth = directionAzimuth(screenPlaneDirection);
            const elevationDirection = directionFromAzimuthElevation(
                targetAzimuth,
                targetElevation,
            );
            // Visible deflection and gravity are simultaneous influences. The
            // previous spherical-coordinate rewrite replaced the former with
            // the latter; on a near-horizontal parent, a requested 30-40°
            // lateral turn could therefore collapse to 4-14°. Blend the two
            // vectors so gravity can flatten a branch without erasing its
            // phyllotactic departure from the parent.
            const gravityBlend = clamp(
                0.22 + fillDemand * 0.12,
                0.22,
                0.34,
            );
            const baseDirectionBeforeInteriorBridge = mixDirection(
                screenPlaneDirection,
                elevationDirection,
                gravityBlend,
            );
            let scaffoldFamilyGesture = createScaffoldFamilyGesture(
                context,
                {
                    axisOrder: meristem.childAxisOrder,
                    heading: baseDirectionBeforeInteriorBridge,
                    origin: originNode.point,
                    parentGesture:
                        sourceFrontier?.scaffoldFamilyGesture || null,
                    lineageKey:
                        `${meristem.parentLineageId}:${sequence}:${meristem.id}`,
                    parentLineageId: meristem.parentLineageId,
                    sequence,
                    temperament,
                },
            );
            const crownBirthOpportunity = resolveCrownBirthOpportunity({
                compositionPlan: context.compositionPlan,
                origin: originNode.point,
                baseDirection: baseDirectionBeforeInteriorBridge,
                childAxisOrder: meristem.childAxisOrder,
                familyGesture: scaffoldFamilyGesture,
                exposure: meristem.crownInteriorExposure,
            });
            const interiorBridgeBlend = crownBirthOpportunity.interiorBlend;
            let baseDirection = crownBirthOpportunity.directionAfter;
            const structuralStation = meristem.parentTier === 0
                && meristem.childTier === 1
                && !meristem.temporaryAxis
                ? resolveTierZeroStructuralStation(context, {
                    id: `lateral-station-parent-${meristem.id}`,
                    tier: meristem.parentTier,
                    axisOrder: meristem.parentTier,
                    heading: liveParent.localHeading,
                    temperament: meristem.temperament,
                    meristemCadence: sourceFrontier?.meristemCadence || null,
                }, {
                    routeKind: 'live_lateral',
                    origin: originNode.point,
                    parentHeading: liveParent.localHeading,
                    scaffoldDirection: baseDirection,
                    continuationDirection: options.continuation?.heading || null,
                    side: meristem.side,
                    stationOrdinal: sourceFrontier?.meristemCadence?.eventCount,
                    balanceField: resolveFutureBalanceField(
                        context,
                        sourceFrontier || null,
                    ),
                })
                : null;
            if (structuralStation) {
                baseDirection = structuralStation.scaffoldDirection;
            }
            const orientationPlan = Object.freeze({
                semantics: 'family_composed_gravity_visible_lateral_frame_v7',
                parentAzimuthRadians: rounded(parentAzimuth),
                targetAzimuthRadians: rounded(targetAzimuth),
                screenPlaneDeflectionRadians: rounded(
                    meristem.side * effectiveDeflection,
                ),
                parentElevationRadians: rounded(parentElevation),
                screenPlaneElevationRadians: rounded(
                    directionElevation(screenPlaneDirection),
                ),
                targetElevationRadians: rounded(targetElevation),
                realizedBaseElevationRadians: rounded(
                    directionElevation(baseDirection),
                ),
                gravityBlend: rounded(gravityBlend),
                padReferenceElevationRadians: rounded(padReferenceElevation),
                padElevationWaveRadians: rounded(padElevationWave),
                fillDemand: rounded(fillDemand),
                crownInteriorExposure: meristem.crownInteriorExposure,
                interiorBridgeBlend: rounded(interiorBridgeBlend),
                crownBirthOpportunity,
                scaffoldFamilyGesture,
                baseDirectionBeforeInteriorBridge: Object.freeze(
                    Object.fromEntries(Object.entries(
                        baseDirectionBeforeInteriorBridge,
                    ).map(([key, value]) => [key, rounded(value)])),
                ),
                structuralStation,
            });
            const parentProxy = {
                id: `lateral-parent-${meristem.id}`,
                nodeId: meristem.nodeId,
                lineageId: meristem.parentLineageId,
                tier: meristem.parentTier,
                axisOrder: meristem.parentTier,
                heading: liveParent.localHeading,
                turnVelocity: meristem.parentTurnVelocity,
                radius: liveParent.radius,
                vigor: liveParent.vigor,
                axisAge: 0,
                generationDepth: meristem.generationDepth,
                episode: meristem.parentEpisode,
                temperament: meristem.temperament,
                formSide: meristem.side,
                sag: { active: false, age: 0, recoveryAfter: 5 },
                terminalRamification: false,
                terminalReverseFill: false,
            };
            let cluster = null;
            const emissionDelay = sequence - meristem.createdAtEvent;
            const liveSupport = clamp(
                liveParent.resourceReserve * 0.42
                    + liveParent.vigor * 0.34
                    + liveParent.spatialExposure * 0.24,
                0.18,
                1.16,
            );
            const emissionShare = clamp(
                meristem.resourceShare
                    * (0.76 + liveSupport * 0.24)
                    * (1 - liveParent.distalFraction * 0.08),
                0.11,
                0.3,
            );
            const lateralDevelopmentalCapacity = clamp(
                liveParent.developmentalCapacity
                    * (0.3 + emissionShare * 1.9)
                    * (0.9 + liveParent.constructionReserve * 0.08)
                    * (1 - liveParent.distalFraction * 0.22),
                0.045,
                0.44,
            );
            const lateralGrowthCapacity = clamp(
                Math.sqrt(lateralDevelopmentalCapacity / 0.34),
                0.24,
                1,
            );
            const lateralExtensionCapacity = clamp(
                lateralGrowthCapacity * (0.72 + liveParent.extensionCapacity * 0.2),
                0.22,
                0.92,
            );
            const lateralConstructionGrant = meristem.constructionGrant;
            const provisionalStartRadius = meristem.sourceRadius * (
                meristem.childTier === 1
                    ? clamp(emissionShare ** (1 / 3) * 1.07, 0.5, 0.72)
                    : clamp(emissionShare ** (1 / 3) * 1.02, 0.44, 0.65)
            );
            const reiterationSample = context.rng.next();
            const relativeDifferentiation =
                resolveRelativeDifferentiationPotential(
                    context,
                    parentProxy,
                    {
                        tier: meristem.childTier,
                        axisOrder: meristem.childAxisOrder,
                        resourceShare: emissionShare,
                        extensionCapacity: lateralExtensionCapacity,
                        supportCapacity: clamp(
                            lateralGrowthCapacity
                                * (0.64 + liveParent.supportCapacity * 0.18),
                            0.14,
                            0.82,
                        ),
                        point: originNode.point,
                    },
                );
            const provisionalDevelopmentState = createChildDevelopmentState(
                context,
                {
                    ...parentProxy,
                    axisOrder: meristem.parentTier,
                    developmentState: liveParent.developmentState,
                },
                {
                    route: 'live_lateral_emission',
                    axisOrder: meristem.childAxisOrder,
                    developmentalCapacity: lateralDevelopmentalCapacity,
                    supportInvestment: clamp(
                        lateralGrowthCapacity
                            * (0.64 + liveParent.supportCapacity * 0.18),
                        0.14,
                        0.82,
                    ),
                    extensionDrive: lateralExtensionCapacity,
                    constructionGrant: lateralConstructionGrant,
                    centralAffinity: clamp(
                        0.5
                            + (1 - Math.abs(originNode.point.x)
                                / Math.max(90, context.form.spreadScale * 180))
                                * 0.24,
                        0.18,
                        0.74,
                    ),
                    spatialExposure: liveParent.spatialExposure,
                    temperament,
                    reiterationSample,
                    relativeDifferentiation,
                },
            );
            const constructionViability = clamp(
                (lateralConstructionGrant - 0.07) / 0.65,
                0,
                1,
            );
            const reiterationPropensity = clamp(
                (provisionalDevelopmentState.reiterationReadiness
                    / provisionalDevelopmentState.reiterationThreshold - 0.48) * 0.42
                    + constructionViability * 0.22
                    + liveSupport * 0.08
                    - provisionalDevelopmentState.terminalAffinity * 0.15,
                0.035,
                0.62,
            );
            // The sample changes developmental phase, not lifetime permission.
            // Keep a compact forecast for diagnostics and scheduling hints, but
            // let accumulated reiteration credit decide the eventual fork.
            const reiterationForecast = meristem.temporaryAxis
                ? 0
                : Number(reiterationPropensity >= 0.5);
            const terminalDevelopment = !meristem.temporaryAxis
                && provisionalDevelopmentState
                .terminalAffinity >= 0.56
                && provisionalDevelopmentState.reiterationCredit < 0.48;
            const junctionSpur = meristem.childAxisOrder === 2
                && !meristem.temporaryAxis
                && meristem.plannedAxisProgress <= 0.42
                && provisionalDevelopmentState.terminalAffinity >= 0.54;
            if (terminalDevelopment || junctionSpur) {
                cluster = createTerminalCluster(context, {
                    origin: originNode.point,
                    heading: baseDirection,
                    tier: meristem.childTier,
                    resourceShare: meristem.resourceShare,
                    temperament,
                    parentClusterId: parentLineage.clusterId,
                    parentLineageId: meristem.parentLineageId,
                    birthEvent: sequence,
                    familyGesture: scaffoldFamilyGesture,
                    parentGesture:
                        sourceFrontier?.scaffoldFamilyGesture || null,
                });
            }
            const previewEpisode = createChildEpisode(context, parentProxy, {
                tier: meristem.childTier,
                axisOrder: meristem.childAxisOrder,
                developmentState: provisionalDevelopmentState,
                radius: provisionalStartRadius,
                resourceShare: emissionShare,
                siblingShares: [1 - emissionShare, emissionShare],
                heading: baseDirection,
                offset: meristem.side * effectiveDeflection,
                formSide: meristem.side,
                temperament,
                birthEvent: sequence,
                cluster,
                origin: pointAt(
                    originNode.point,
                    baseDirection,
                    TIERS[meristem.childTier].meanLength,
                ),
                forkArchetype: 'live_lateral_meristem_emission',
                referenceHeading: liveParent.localHeading,
                horizontalRelease: false,
                terminalRamification: terminalDevelopment,
                terminalReverseFill: false,
                completionFork: false,
            });
            const lateralConstructionPortfolio = constructionAccount
                .createAxisConstructionPortfolio(context, {
                    tier: meristem.childTier,
                    generationDepth: meristem.generationDepth + 1,
                    origin: originNode.point,
                    familyConstructionGrant: lateralConstructionGrant,
                    birthJunctionKind: 'live_lateral_birth',
                    familyCadenceBirth:familyLateralBirth(context,meristem.childTier,resolveJointLateralJunction,{sourceRadius:liveParent.radius,parentAxisOrder:meristem.parentTier,parentHeading:liveParent.localHeading,childHeading:baseDirection,side:meristem.side,emissionShare,parentDevelopmentState:liveParent.developmentState,childDevelopmentState:provisionalDevelopmentState,referenceLength:TIERS[meristem.childTier].meanLength*context.preset.statureScale*temperament.lengthScale*previewEpisode.segmentLengthScale}),
                    birthJunctionInvestment: 1 - emissionShare,
                    anticipatesStructuralFork: !meristem.temporaryAxis
                        && reiterationPropensity >= 0.5,
                    reiterationCommitment: clamp(
                        provisionalDevelopmentState.reiterationCredit / 1.08,
                        0.12,
                        0.88,
                    ),
                    extensionCapacity: lateralExtensionCapacity,
                    plannedInternodeCount: junctionSpur
                        ? 2
                        : undefined,
                    minimumInternodeCount: junctionSpur ? 2 : undefined,
                    maximumInternodeCount: junctionSpur ? 2 : undefined,
                    lateralInvestmentScale: clamp(
                        0.76
                            + provisionalDevelopmentState.lateralCompetence * 0.6,
                        0.72,
                        1.28,
                    ),
                    developmentState: provisionalDevelopmentState,
                    temperament,
                });
            const lengthProxy = {
                tier: meristem.childTier,
                vigor: liveParent.vigor,
                axisAge: 0,
                axisStepLimit: TIERS[meristem.childTier].maximumAxisSteps,
                axisHardLimit: TIERS[meristem.childTier].maximumAxisSteps,
                generationDepth: meristem.generationDepth + 1,
                radius: provisionalStartRadius,
                point: originNode.point,
                temperament,
                cluster,
                constructionReserve:
                    lateralConstructionPortfolio.axisConstructionBudget,
                constructionPortfolio: lateralConstructionPortfolio,
                developmentalCapacity: lateralDevelopmentalCapacity,
                previousInternodeLength: meristem.sourceSegmentLength || 0,
                extensionAllocation: lateralExtensionCapacity,
                supportAllocation: clamp(
                    lateralGrowthCapacity
                        * (0.64 + liveParent.supportCapacity * 0.18),
                    0.14,
                    0.82,
                ),
                developmentState: provisionalDevelopmentState,
                maturationState: terminalDevelopment
                    ? 'terminal_pad_fill'
                    : 'active_extension',
            };
            const emissionLengthScale = clamp(
                0.76
                    + liveSupport * 0.18
                    + lateralGrowthCapacity * 0.12
                    - liveParent.distalFraction * 0.22
                    - Math.min(0.18, emissionDelay * 0.012),
                0.46,
                0.9,
            );
            const birthConstructionReceipt = constructionAccount
                .resolveInternodeConstruction(
                context,
                lengthProxy,
                previewEpisode,
                { birth: true, emergenceScale: emissionLengthScale },
            );
            const runLength = birthConstructionReceipt.realizedLength;
            const selected = selectForkDirection(
                context,
                parentProxy,
                originNode.point,
                baseDirection,
                runLength,
                provisionalStartRadius,
                meristem.childTier,
                [],
                cluster,
                emissionShare,
                temperament,
            );
            const realizedDirection = constrainDirectionToCone(
                selected.direction,
                liveParent.localHeading,
                1.35,
            );
            if (resolveZenG15AxisDevelopment(context.axisDevelopmentTreatment).frame) {
                scaffoldFamilyGesture = scope.ZenBonsaiTypedDevelopmentalSchedulerCrownComposition
                    .bindRealizedAxisFrame(scaffoldFamilyGesture, realizedDirection, context.compositionPlan);
                cluster = scope.ZenBonsaiTypedDevelopmentalSchedulerCrownState
                    .bindClusterBirthFrame(context, cluster, scaffoldFamilyGesture, originNode.point, realizedDirection, sequence);
            }
            const birthDevelopmentState = createChildDevelopmentState(
                context,
                {
                    ...parentProxy,
                    axisOrder: meristem.parentTier,
                    developmentState: liveParent.developmentState,
                },
                {
                    route: 'live_lateral_emission',
                    axisOrder: meristem.childAxisOrder,
                    developmentalCapacity: lateralDevelopmentalCapacity,
                    supportInvestment: lengthProxy.supportAllocation,
                    extensionDrive: lateralExtensionCapacity,
                    constructionGrant: lateralConstructionGrant,
                    centralAffinity: provisionalDevelopmentState.apicalContinuity,
                    spatialExposure: clamp(
                        1 / (1 + selected.corridorScore * 0.11),
                        0.2,
                        1,
                    ),
                    temperament,
                    reiterationSample,
                    birthLength: runLength,
                    birthConstructionCost:
                        birthConstructionReceipt.constructionCost,
                    plannedInternodeCount:
                        lateralConstructionPortfolio.plannedInternodeCount,
                    relativeDifferentiation,
                },
            );
            const junctionPlan = resolveJointLateralJunction(context, {
                sourceRadius: liveParent.radius,
                parentAxisOrder: meristem.parentTier,
                parentHeading: liveParent.localHeading,
                childHeading: realizedDirection,
                side: meristem.side,
                emissionShare,
                parentDevelopmentState: liveParent.developmentState,
                childDevelopmentState: birthDevelopmentState,
            });
            const startRadius = junctionPlan.lateralRadius;
            const realizedTarget = pointAt(
                originNode.point,
                realizedDirection,
                runLength,
            );
            const birthConstructionCost = birthConstructionReceipt.constructionCost;
            const lineage = createLineage(context, {
                parentLineageId: meristem.parentLineageId,
                decisionAddress:zenG15LateralAddress(context,meristem),
                tier: meristem.childTier,
                axisOrder: meristem.childAxisOrder,
                birthMode: 'live_lateral_emission',
                birthEvent: sequence,
                resourceShare: emissionShare,
                episode: previewEpisode,
                temperament,
                developmentState: birthDevelopmentState,
                cluster,
                developmentalRole: meristem.developmentalRole,
                temporaryAxis: meristem.temporaryAxis,
                scaffoldFamilyGesture,
            });
            const scaffoldFamilyDominanceClaim = context.researchControls
                .scaffoldFamilyDominance === false
                ? null
                : sourceFrontier?.scaffoldFamilyDominanceClaim
                    ? inheritScaffoldFamilyDominanceClaim(
                        sourceFrontier.scaffoldFamilyDominanceClaim,
                        {
                            carrierLineageId: lineage.id,
                            childAxisOrder: meristem.childAxisOrder,
                            carriedAtSequence: sequence,
                            throughFork: false,
                        },
                    )
                    : (meristem.parentTier === 1
                        && meristem.childAxisOrder === 2
                        ? createScaffoldFamilyDominanceClaim({
                        claimId:
                            `scaffold-dominance:${meristem.parentLineageId}:${sequence}:${lineage.id}`,
                        sourceKind: 'live_lateral_emission',
                        sourceSequence: sequence,
                        sourceNodeId: meristem.nodeId,
                        sourceScaffoldLineageId: meristem.parentLineageId,
                        subordinateRootLineageId: lineage.id,
                        carrierLineageId: lineage.id,
                        sourceAxisOrder: meristem.parentTier,
                        childAxisOrder: meristem.childAxisOrder,
                        sourceAreaFraction: junctionPlan.lateralAreaFraction,
                        sourceResourceShare: emissionShare,
                        sourceDeflectionRadians: angularDistance(
                            liveParent.localHeading,
                            realizedDirection,
                        ),
                            temporaryAxis: meristem.temporaryAxis,
                        })
                        : null);
            lineage.scaffoldFamilyDominanceClaim =
                scaffoldFamilyDominanceClaim;
            const createdNode = addNode(
                context,
                realizedTarget,
                meristem.nodeId,
                null,
                sequence,
            );
            const radiusProfile = resolveAxisRadiusProfile(birthDevelopmentState);
            const endRadius = Math.max(
                startRadius * radiusProfile.taper,
                Math.min(startRadius, radiusProfile.minimumRadius),
            );
            const segment = addSegment(context, {
                fromNodeId: meristem.nodeId,
                toNodeId: createdNode.id,
                lineageId: lineage.id,
                tier: meristem.childTier,
                axisOrder: meristem.childAxisOrder,
                birthMode: 'live_lateral_emission',
                startRadius,
                endRadius,
                length: runLength,
                resourceShare: emissionShare,
                episode: previewEpisode,
                birthEvent: sequence,
                clusterId: cluster?.id || null,
                developmentState: birthDevelopmentState,
                developmentalRole: meristem.developmentalRole,
                temporaryAxis: meristem.temporaryAxis,
                scaffoldFamilyDominanceClaim,
            });
            const node = Object.freeze({ ...createdNode, incomingSegmentId: segment.id });
            context.nodes[context.nodes.length - 1] = node;
            context.nodeIndex.set(node.id, node);
            lineage.segmentIds.push(segment.id);
            const sagActive = previewEpisode.gravityResponse > 0;
            const inheritedReachCharacter = temperament.axisReachScale * 0.62
                + temperament.axisExtentScale * 0.38
                + lineageResponse.axis_extent * 0.08;
            const temporaryAxisStepLimit = meristem.temporaryAxis
                ? 2 + Number(fillWave >= 0.48)
                : null;
            const axisStepLimit = temporaryAxisStepLimit
                || lateralConstructionPortfolio.plannedInternodeCount;
            const nextForkAge = axisStepLimit;
            const meristemCadence = createJunctionCadence(context, {
                kind: 'live_lateral_birth',
                sequence,
                lineageId: lineage.id,
                axisFamilyId: lineage.id,
                parentLineageId: meristem.parentLineageId,
                childHeading: realizedDirection,
                siblingHeading: junctionPlan.continuationHeading,
                siblingShare: 1 - emissionShare,
                birthLength: runLength,
                point: originNode.point,
                sourceRadius: liveParent.radius,
            });
            const frontier = addFrontier(context, {
                nodeId: node.id,
                parentFrontierId: meristem.sourceFrontierId,
                lineageId: lineage.id,
                tier: meristem.childTier,
                axisOrder: meristem.childAxisOrder,
                birthMode: 'live_lateral_emission',
                heading: realizedDirection,
                axisEntryHeading: realizedDirection,
                turnVelocity: previewEpisode.curvatureVelocity,
                radius: endRadius,
                vigor: clamp(
                    liveParent.vigor * (0.68 + emissionShare * 0.74),
                    0.34,
                    0.86,
                ),
                axisAge: 1,
                axisStepLimit,
                generationDepth: meristem.generationDepth + 1,
                reiterationForecast,
                reiterationReserve: birthDevelopmentState.reiterationReadiness,
                constructionReserve: Math.max(
                    0,
                    birthConstructionReceipt.reserveAfterConstruction,
                ),
                constructionPortfolio:
                    bindZenG15AxisDevelopment(context, birthConstructionReceipt.portfolioAfterConstruction,
                        {tier:meristem.childTier,radius:startRadius,referenceLength:runLength}),
                scaffoldFamilyGesture,
                scaffoldFamilyDominanceClaim,
                meristemCadence,
                previousInternodeLength: runLength,
                forkDeferralCount: 0,
                nextForkAge,
                episode: previewEpisode,
                episodeAge: 1,
                temperament,
                formSide: meristem.side,
                sag: {
                    active: sagActive,
                    age: 0,
                    recoveryAfter: context.rng.integer(4, 5),
                },
                readyAt: sequence + TIERS[meristem.childTier].scheduleDelay,
                nextTurnSign: previewEpisode.turnSign,
                successionTurnSign: -meristem.side,
                birthResourceShare: emissionShare,
                developmentalCapacity: lateralDevelopmentalCapacity,
                supportAllocation: lengthProxy.supportAllocation,
                extensionAllocation: lateralExtensionCapacity,
                reiterationPotential: meristem.temporaryAxis
                    ? 0.08
                    : clamp(
                        0.12
                            + birthDevelopmentState.reiterationReadiness * 0.68,
                        0.12,
                        0.82,
                    ),
                lateralMeristemReserve: meristem.temporaryAxis
                    ? 0
                    : clamp(
                        birthDevelopmentState.lateralCompetence * 0.14,
                        0,
                        0.14,
                    ),
                maturationState: terminalDevelopment
                    ? 'terminal_pad_fill'
                    : 'active_extension',
                restUntilEvent: sequence,
                regrowthPulseCount: 0,
                resourceReserve: clamp(
                    0.22 + lateralGrowthCapacity * 0.26 + liveSupport * 0.12,
                    0.28,
                    0.62,
                ),
                maintenanceDebt: 0,
                spatialExposure: clamp(1 / (1 + selected.corridorScore * 0.11), 0.2, 1),
                developmentState: birthDevelopmentState,
                cluster,
                horizontalRelease: false,
                completionFork: false,
                reservedAtEvent: sequence,
                developmentalRole: meristem.developmentalRole,
                temporaryAxis: meristem.temporaryAxis,
                temporaryAxisStepLimit,
            });
            const corridorId = context.frontierCorridorIndex.get(frontier.id);
            meristem.status = 'emitted';
            meristem.emittedAtEvent = sequence;
            meristem.emissionLineageId = lineage.id;
            context.activeLateralMeristemIds.delete(meristem.id);
            context.lateralEmissionCount += 1;
            context.nodeActivationCounts.set(
                meristem.nodeId,
                (context.nodeActivationCounts.get(meristem.nodeId) || 0) + 1,
            );
            context.developmentReceipts.push(Object.freeze({
                kind: 'live_lateral_axis_emission',
                sequence,
                meristemId: meristem.id,
                parentLineageId: meristem.parentLineageId,
                lineageId: lineage.id,
                registeredResourceShare: meristem.resourceShare,
                realizedResourceShare: rounded(emissionShare),
                emissionDelay,
                distalFraction: rounded(liveParent.distalFraction),
                requestedDeflectionRadians: rounded(effectiveDeflection),
                realizedParentAngleRadians: rounded(angularDistance(
                    liveParent.localHeading,
                    frontier.heading,
                )),
                emissionLengthScale: rounded(emissionLengthScale),
                developmentalCapacity: rounded(lateralDevelopmentalCapacity),
                growthCapacity: rounded(lateralGrowthCapacity),
                extensionCapacity: rounded(lateralExtensionCapacity),
                runLength: rounded(runLength),
                parentConstructionReserveAtActivation: rounded(
                    liveParent.constructionReserve,
                ),
                constructionFundingMode: 'parent_reserved_lateral_portfolio',
                constructionGrant: rounded(lateralConstructionGrant),
                birthConstructionCost: rounded(birthConstructionCost),
                constructionPortfolio: lateralConstructionPortfolio,
                developmentState: birthDevelopmentState,
                relativeDifferentiation,
                structuralStation,
                reiterationSample: rounded(reiterationSample),
                reiterationPropensity: rounded(reiterationPropensity),
                reiterationForecast,
                terminalDevelopment,
                junctionSpur,
                compositionRole: junctionSpur
                    ? 'mature_junction_short_spur'
                    : 'ordinary_family_axis',
                developmentalRole: meristem.developmentalRole,
                temporaryAxis: meristem.temporaryAxis,
                temporaryAxisStepLimit,
                crownInteriorExposure: meristem.crownInteriorExposure,
                interiorBridgeBlend: rounded(interiorBridgeBlend),
                scaffoldFamilyGesture,
                crownBirthOpportunity,
                scaffoldFamilyDominanceClaim,
                scaffoldFamilyDominance:
                    resolveScaffoldFamilyDominance(
                        scaffoldFamilyDominanceClaim,
                    ),
                juvenileShootOpportunity: meristem.juvenileShootOpportunity,
                junctionPlan,
                meristemCadence,
                axisStepLimit,
                developmentalRole: meristem.developmentalRole,
                temporaryAxis: meristem.temporaryAxis,
                temporaryAxisStepLimit,
            }));
            const embeddedReceipt = Object.freeze({
                meristemId: meristem.id,
                lineageId: lineage.id,
                nodeId: node.id,
                segmentId: segment.id,
                frontierId: frontier.id,
                corridorId: corridorId || null,
                orientationPlan,
                structuralStation,
                meristemCompetition,
                junctionPlan,
                meristemCadence,
                developmentState: birthDevelopmentState,
                reiterationForecast,
                axisStepLimit,
                scaffoldFamilyGesture,
                crownBirthOpportunity,
                scaffoldFamilyDominanceClaim,
                parentRelativeAngleDegrees: rounded(
                    angularDistance(liveParent.localHeading, frontier.heading)
                        * 180 / Math.PI,
                    3,
                ),
                groundVerticalAngleDegrees: rounded(
                    angularDistance({ x: 0, y: 1, z: 0 }, frontier.heading)
                        * 180 / Math.PI,
                    3,
                ),
            });
            if (options.embedded) return embeddedReceipt;
            context.events.push(Object.freeze({
                id: idFor(context, 'event'),
                sequence,
                kind: 'lateral_emit',
                proposalId: proposal?.id || null,
                consumedFrontierId: null,
                lateralMeristemId: meristem.id,
                originNodeId: meristem.nodeId,
                parentLineageId: meristem.parentLineageId,
                axisOrder: meristem.childAxisOrder,
                birthMode: 'live_lateral_emission',
                createdNodeIds: Object.freeze([node.id]),
                createdSegmentIds: Object.freeze([segment.id]),
                createdFrontierIds: Object.freeze([frontier.id]),
                createdLateralMeristemIds: Object.freeze([]),
                releasedCorridorIds: Object.freeze([]),
                createdCorridorIds: Object.freeze(corridorId ? [corridorId] : []),
                activeFrontierIdsAfter: activeSnapshot(context),
                activeCorridorIdsAfter: activeCorridorSnapshot(context),
                steering: Object.freeze({
                    semantics: LATERAL_MERISTEM_SEMANTICS,
                    parentHeading: liveParent.localHeading,
                    realizedHeading: frontier.heading,
                    referenceFrame: 'gravity_visible_growth_plane',
                    orientationPlan,
                    structuralStation,
                    meristemCompetition,
                    lineageResponse,
                    parentRelativeAngleDegrees: rounded(
                        angularDistance(liveParent.localHeading, frontier.heading)
                            * 180 / Math.PI,
                        3,
                    ),
                    groundVerticalAngleDegrees: rounded(
                        angularDistance({ x: 0, y: 1, z: 0 }, frontier.heading)
                            * 180 / Math.PI,
                        3,
                    ),
                    heightBand: meristem.heightBand,
                    side: meristem.side,
                    resourceShare: emissionShare,
                    registeredResourceShare: meristem.resourceShare,
                    clusterId: cluster?.id || null,
                    developmentalMode: meristem.temporaryAxis
                        ? 'temporary_juvenile_sacrifice_axis'
                        : 'sequential_lateral_axis',
                    developmentalRole: meristem.developmentalRole,
                    temporaryAxis: meristem.temporaryAxis,
                    reiterationForecast,
                    inheritedReachCharacter: rounded(inheritedReachCharacter),
                    terminalReverseFill: false,
                    fillWave: rounded(fillWave),
                    fillDemand: rounded(fillDemand),
                    crownInteriorExposure: meristem.crownInteriorExposure,
                    interiorBridgeBlend: rounded(interiorBridgeBlend),
                    scaffoldFamilyGesture,
                    crownBirthOpportunity,
                    effectiveDeflectionRadians: rounded(effectiveDeflection),
                    emissionDelay,
                    emissionLengthScale: rounded(emissionLengthScale),
                    liveParent,
                    axisStepLimit,
                    corridorConflictScore: rounded(selected.corridorScore),
                }),
            }));
            return embeddedReceipt;
        }


        return Object.freeze({
            createLateralMeristem,
            emitLateralAxis:(context,meristem,sequence,proposal,options={})=>withZenG15DecisionRandom(context,
                zenG15LateralAddress(context,meristem),'lateral-development',()=>emitLateralAxis(context,meristem,sequence,proposal,options)),
        });
    }

    scope.ZenBonsaiTypedDevelopmentalSchedulerTerminalRamification = Object.freeze({
        createOwner,
    });
}(zenPlumeKernelRealm));
