/**
 * G15.4 Typed Developmental Scheduler graph mutation owner.
 *
 * Programs, terminal ramification, and completed-graph inspection live in
 * separate fail-loud owners. This file owns live context mutation, recursive
 * axis events, spatial reservations, and the developmental priority queue.
 */
(function installRecursiveAxisKernel(scope) {
    'use strict';

    const programs = scope.ZenBonsaiTypedDevelopmentalSchedulerPrograms;
    const developmentalStrategy = scope.ZenBonsaiTypedDevelopmentalSchedulerStrategy;
    const crownArchitecture = scope
        .ZenBonsaiTypedDevelopmentalSchedulerCrownArchitecture;
    const tierArchitecture = scope
        .ZenBonsaiTypedDevelopmentalSchedulerTierArchitecture;
    const crownComposition = scope
        .ZenBonsaiTypedDevelopmentalSchedulerCrownComposition;
    const growthUnitOwner = scope
        .ZenBonsaiTypedDevelopmentalSchedulerGrowthUnit;
    const graphInspector = scope.ZenBonsaiTypedDevelopmentalSchedulerGraphInspector;
    const resourceForkLaw = scope.ZenBonsaiTypedDevelopmentalSchedulerResourceForkLaw;
    const crownState = scope.ZenBonsaiTypedDevelopmentalSchedulerCrownState;
    const axisEpisodes = scope.ZenBonsaiTypedDevelopmentalSchedulerAxisEpisodes;
    const spatialField = scope.ZenBonsaiTypedDevelopmentalSchedulerSpatialField;
    const forkDevelopmentField = scope.ZenBonsaiTypedDevelopmentalSchedulerForkField;
    const forkDirectionProjector = scope
        .ZenBonsaiTypedDevelopmentalSchedulerForkDirectionProjector;
    const successionKinkField = scope
        .ZenBonsaiTypedDevelopmentalSchedulerSuccessionKinkField;
    const maturationField = scope
        .ZenBonsaiTypedDevelopmentalSchedulerMaturationField;
    const constructionAccount = scope
        .ZenBonsaiTypedDevelopmentalSchedulerConstructionAccount;
    const axisStateOwner = scope.ZenBonsaiTypedDevelopmentalSchedulerAxisState;
    const ontogenyOwner = scope.ZenBonsaiTypedDevelopmentalSchedulerOntogeny;
    const meristemCadenceOwner = scope
        .ZenBonsaiTypedDevelopmentalSchedulerMeristemCadence;
    const lateralJunctionField = scope
        .ZenBonsaiTypedDevelopmentalSchedulerLateralJunction;
    const forkTransaction = scope.ZenBonsaiTypedDevelopmentalSchedulerForkTransaction;
    const terminalRamification = scope
        .ZenBonsaiTypedDevelopmentalSchedulerTerminalRamification;
    const nodeMeristemField = scope
        .ZenBonsaiTypedDevelopmentalSchedulerNodeMeristemField;
    const proposalScheduler = scope
        .ZenBonsaiTypedDevelopmentalSchedulerProposalScheduler;
    if (
        !programs
        || !developmentalStrategy
        || !crownArchitecture
        || !tierArchitecture
        || !crownComposition
        || !growthUnitOwner
        || !graphInspector
        || !resourceForkLaw
        || !crownState
        || !axisEpisodes
        || !spatialField
        || !forkDevelopmentField
        || !forkDirectionProjector
        || !successionKinkField
        || !maturationField
        || !constructionAccount
        || !axisStateOwner
        || !ontogenyOwner
        || !meristemCadenceOwner
        || !lateralJunctionField
        || !forkTransaction
        || !terminalRamification
        || !nodeMeristemField
        || !proposalScheduler
    ) {
        throw new Error(
            '[G15.4_KERNEL] programs, strategy, crown architecture, tier architecture, crown composition, growth-unit, inspector, fork-law, crown, episodes, spatial, fork-field, fork-projector, maturation-field, construction-account, axis-state, ontogeny, meristem-cadence, lateral-junction, succession-kink, fork-transaction, terminal, node-meristem, and proposal-scheduler owners must load first.',
        );
    }
    const {
        CROWN_COMPOSITION_SEMANTICS,
        SCAFFOLD_FAMILY_GESTURE_SEMANTICS,
        CROWN_BIRTH_OPPORTUNITY_SEMANTICS,
        createScaffoldFamilyGesture,
        resolveCrownBirthOpportunity,
    } = crownComposition;
    const {
        VISIBLE_SCAFFOLD_LIVENESS_MAXIMUM_SCORE_BOOST,
    } = proposalScheduler;
    const {
        MODEL_ID,
        CONTRACT_ID,
        TIER_NAMES,
        AXIS_ORDER_NAMES,
        axisOrderNameFor,
        AXIS_ORDER_SEMANTICS,
        BIRTH_MODE_SEMANTICS,
        LINEAGE_RESPONSE_SEMANTICS,
        FORK_SEMANTICS,
        RESOURCE_SEMANTICS,
        ANGLE_SEMANTICS,
        EPISODE_SEMANTICS,
        PHENOTYPE_SEMANTICS,
        OCCUPANCY_SEMANTICS,
        RESOURCE_ECONOMY_SEMANTICS,
        CLUSTER_SEMANTICS,
        BALANCE_SEMANTICS,
        AXIS_SUCCESSION_SEMANTICS,
        ORDER_ZERO_SUPPORT_SEMANTICS,
        COMPLETION_SEMANTICS,
        LATERAL_MERISTEM_SEMANTICS,
        CROWN_INTERIOR_EXPOSURE_SEMANTICS,
        SCAFFOLD_FAMILY_DOMINANCE_SEMANTICS,
        SCHEDULER_SEMANTICS,
        AXIS_LIFECYCLE_SEMANTICS,
        FORK_POTENTIAL_SEMANTICS,
        SUCCESSION_KINK_SEMANTICS,
        clamp,
        add,
        subtract,
        scale,
        magnitude,
        distance,
        dot,
        normalize,
        mixDirection,
        pointAt,
        rotateGrowthPlane,
        tiltDepth,
        angularDistance,
        constrainDirectionToCone,
        resolveOrderZeroSupport,
        signedPlanarAngle,
        rounded,
        sum,
        resolveScaffoldFamilyDominance,
        AxisRng,
        PRESETS,
        FORM_PROGRAMS,
        TRAIT_PROGRAMS,
        TIERS,
        createPhenotype,
        createRootTemperament,
        inheritTemperament,
    } = programs;
    const {
        STRATEGY_SEMANTICS,
        BASIS_SEMANTICS,
        BASIS_CATALOG,
        STRATEGY_AXES,
        STRATEGY_AXIS_IDS,
        createDevelopmentalStrategy,
        evaluateStrategyAxis,
        REGIME_SEMANTICS,
        DEVELOPMENTAL_TRAJECTORY_SEMANTICS,
    } = developmentalStrategy;
    const {
        CROWN_ARCHITECTURE_CONTROL_SEMANTICS,
        CROWN_ARCHITECTURE_PROFILE_SEMANTICS,
        CONTROL_DEFINITIONS: CROWN_ARCHITECTURE_CONTROL_DEFINITIONS,
        resolveResearchControls,
        resolveArchitectureControls,
        resolveCrownArchitectureProfile,
    } = crownArchitecture;
    const {
        TIER_ARCHITECTURE_SEMANTICS,
        STRUCTURAL_STATION_SEMANTICS,
        STATION_TRAJECTORY_SEMANTICS,
        RELATIVE_DIFFERENTIATION_SEMANTICS,
        tierFor,
        tierRoleFor,
    } = tierArchitecture;
    const {
        GROWTH_UNIT_SEMANTICS,
        GROWTH_UNIT_RECEIPT_SEMANTICS,
        APICAL_DIFFERENTIATION_SEMANTICS,
        createGrowthUnit,
        advanceGrowthUnit,
        bindApicalIntent,
        renewGrowthUnit,
        resolveApicalDifferentiationState,
        createReceipt: createGrowthUnitReceipt,
        validGrowthUnit,
    } = growthUnitOwner;
    const { validateGraph, buildDiagnostics } = graphInspector;
    const {
        resolveExtensionMaturation,
        resolveAxisPersistencePlan,
        resolveSecondaryAxisMaturation,
    } = maturationField;
    const {
        constructionCost,
        canConstructInternode,
        createAxisConstructionPortfolio,
        creditAxisConstructionPortfolio,
        commitLateralConstructionPortfolio,
        reconcileAxisConstructionCommitments,
        renewAxisConstructionPortfolio,
        resolveInternodeConstruction,
    } = constructionAccount;
    const {
        RESOURCE_CONTRAST_DAMPING_SEMANTICS,
        FORK_FLOW_DIRECTION_SEMANTICS,
        binaryOffsets,
    } = resourceForkLaw;
    const {
        AXIS_DEVELOPMENT_STATE_SEMANTICS,
        createRootDevelopmentState,
        evolveAfterInternode,
        resolveReiterationReadiness,
        reiterationDue,
        resolveAxisRadiusProfile,
    } = axisStateOwner;
    const {
        MERISTEM_CADENCE_SEMANTICS,
        VISIBLE_SCAFFOLD_PERMISSION_SEMANTICS,
        VISIBLE_SCAFFOLD_LIVENESS_SEMANTICS,
        LIVE_LATERAL_FEASIBILITY_SEMANTICS,
        createRootCadence,
        advanceMeristemCadence,
        commitLateralCadence,
        commitJuvenileShootCadence,
        resolveVisibleScaffoldReleasePermission,
        resolveVisibleScaffoldLivenessPressure,
        resolveNextForkCadence,
    } = meristemCadenceOwner;
    const {
        ONTOGENY_SEMANTICS,
        CROWN_BASE_COMPETENCE_SEMANTICS,
        SECONDARY_WOOD_GROWTH_SEMANTICS,
        JUVENILE_SHOOT_OPPORTUNITY_SEMANTICS,
        JUVENILE_AXIS_RETIREMENT_SEMANTICS,
    } = ontogenyOwner;
    const { FORK_IDENTITY_INTENT_SEMANTICS } = forkTransaction;
    const { LATERAL_JUNCTION_SEMANTICS } = lateralJunctionField;
    const {
        SUCCESSION_KINK_STATE_SEMANTICS,
        createSuccessionKinkState,
        advanceSuccessionKinkState,
    } = successionKinkField;
    const {
        MERISTEM_SEMANTICS,
        registerLateralMeristemPotential,
        settleNodeForStructuralFork,
        commitLateralMeristemEmission,
        finalizeNodeMeristemSites,
    } = nodeMeristemField;
    function idFor(context, kind) {
        context.counters[kind] += 1;
        return `${kind}-${String(context.counters[kind]).padStart(4, '0')}`;
    }

    function activeSnapshot(context) {
        return Object.freeze([...context.activeFrontierIds].sort());
    }

    function activeCorridorSnapshot(context) {
        return Object.freeze([...context.activeCorridorIds].sort());
    }

    function nodeById(context, nodeId) {
        return context.nodeIndex.get(nodeId);
    }

    function frontierById(context, frontierId) {
        return context.frontierIndex.get(frontierId);
    }

    function createContext(options) {
        return {
            ...options,
            counters: {
                node: 0,
                segment: 0,
                frontier: 0,
                lineage: 0,
                episode: 0,
                event: 0,
                corridor: 0,
                cluster: 0,
                meristem: 0,
                proposal: 0,
            },
            nodes: [],
            segments: [],
            frontiers: [],
            lineages: [],
            events: [],
            occupancy: [],
            corridors: [],
            clusters: [],
            lateralMeristems: [],
            nodeMeristemSites: [],
            proposalReceipts: [],
            forkIdentityIntentReceipts: [],
            visibleScaffoldPermissionReceipts: [],
            juvenileAxisRetirements: [],
            strategyReceipts: [],
            developmentReceipts: [],
            growthUnitReceipts: [],
            familyResourceReceipts: [],
            rawSplits: [],
            activeFrontierIds: new Set(),
            activeCorridorIds: new Set(),
            nodeIndex: new Map(),
            frontierIndex: new Map(),
            lineageIndex: new Map(),
            familyResourceLedgers: new Map(),
            corridorIndex: new Map(),
            clusterIndex: new Map(),
            lateralMeristemIndex: new Map(),
            nodeMeristemSiteIndex: new Map(),
            activeLateralMeristemIds: new Set(),
            retiredLineageIds: new Set(),
            frontierCorridorIndex: new Map(),
            lineageLastSelectedAt: new Map(),
            familyLastSelectedAt: new Map(),
            nodeActivationCounts: new Map(),
            clusterSelectionCounts: new Map(),
            totalMass: 0,
            massMomentX: 0,
            massMomentZ: 0,
            silhouetteWeight: 0,
            silhouetteMomentX: 0,
            silhouetteMomentZ: 0,
            lastBalanceField: null,
            completionForkCount: 0,
            horizontalReleaseCount: 0,
            lateralEmissionCount: 0,
        };
    }

    function addNode(context, point, parentNodeId, incomingSegmentId, birthEvent) {
        const node = Object.freeze({
            id: idFor(context, 'node'),
            point: Object.freeze({
                x: rounded(point.x),
                y: rounded(point.y),
                z: rounded(point.z),
            }),
            parentNodeId,
            incomingSegmentId,
            birthEvent,
        });
        context.nodes.push(node);
        context.nodeIndex.set(node.id, node);
        return node;
    }

    function addSegment(context, spec) {
        if (!spec.birthMode) {
            throw new Error('[G15.4_KERNEL] Segment birthMode is required.');
        }
        const axisOrder = tierFor(spec.axisOrder ?? spec.tier);
        const scaffoldFamilyDominance = resolveScaffoldFamilyDominance(
            spec.scaffoldFamilyDominanceClaim,
        );
        const segment = Object.freeze({
            id: idFor(context, 'segment'),
            fromNodeId: spec.fromNodeId,
            toNodeId: spec.toNodeId,
            lineageId: spec.lineageId,
            tier: spec.tier,
            tierName: TIER_NAMES[spec.tier],
            axisOrder,
            axisOrderName: axisOrderNameFor(axisOrder),
            tierRole: tierRoleFor(axisOrder),
            birthMode: spec.birthMode,
            startRadius: rounded(spec.startRadius),
            endRadius: rounded(spec.endRadius),
            length: rounded(spec.length),
            resourceShare: rounded(spec.resourceShare),
            episodeId: spec.episode.id,
            episodeKind: spec.episode.kind,
            episodeArchetype: spec.episode.archetype,
            birthEvent: spec.birthEvent,
            registeredAtEvent: spec.birthEvent,
            clusterId: spec.clusterId || null,
            developmentStateRevision: spec.developmentState?.revision ?? null,
            developmentalRole: spec.developmentalRole || 'permanent_axis',
            temporaryAxis: Boolean(spec.temporaryAxis),
            scaffoldFamilyDominanceClaimId:
                scaffoldFamilyDominance?.claimId || null,
            scaffoldFamilyTerminalLoadScale:
                scaffoldFamilyDominance?.terminalLoadScale ?? 1,
        });
        context.segments.push(segment);
        const start = nodeById(context, segment.fromNodeId).point;
        const end = nodeById(context, segment.toNodeId).point;
        context.occupancy.push(Object.freeze({
            segmentId: segment.id,
            lineageId: segment.lineageId,
            start: Object.freeze({ ...start }),
            end: Object.freeze({ ...end }),
            radius: rounded((segment.startRadius + segment.endRadius) * 0.5),
            clusterId: segment.clusterId,
            registeredAtEvent: spec.birthEvent,
        }));
        registerSegmentMass(context, segment, start, end);
        return segment;
    }

    function createLineage(context, spec) {
        if (!spec.birthMode) {
            throw new Error('[G15.4_KERNEL] Lineage birthMode is required.');
        }
        const axisOrder = tierFor(spec.axisOrder ?? spec.tier);
        const lineage = {
            id: idFor(context, 'lineage'),
            parentLineageId: spec.parentLineageId,
            phenotypeId: context.phenotype.id,
            tier: spec.tier,
            tierName: TIER_NAMES[spec.tier],
            axisOrder,
            axisOrderName: axisOrderNameFor(axisOrder),
            tierRole: tierRoleFor(axisOrder),
            birthMode: spec.birthMode,
            birthEvent: spec.birthEvent,
            birthResourceShare: spec.resourceShare,
            birthEpisode: spec.episode,
            axisTemperament: spec.temperament,
            birthDevelopmentState: spec.developmentState || null,
            scaffoldFamilyGesture: spec.scaffoldFamilyGesture
                ? Object.freeze({ ...spec.scaffoldFamilyGesture })
                : null,
            scaffoldFamilyDominanceClaim: spec.scaffoldFamilyDominanceClaim
                ? Object.freeze({ ...spec.scaffoldFamilyDominanceClaim })
                : null,
            clusterId: spec.cluster?.id || null,
            segmentIds: [],
            endEvent: null,
            endKind: null,
            developmentalRole: spec.developmentalRole || 'permanent_axis',
            temporaryAxis: Boolean(spec.temporaryAxis),
        };
        context.lineages.push(lineage);
        context.lineageIndex.set(lineage.id, lineage);
        context.familyResourceLedgers.set(lineage.id, 0);
        return lineage;
    }

    function addFrontier(context, spec) {
        if (!spec.birthMode) {
            throw new Error('[G15.4_KERNEL] Frontier birthMode is required.');
        }
        if (
            !spec.developmentState
            || spec.developmentState.semantics !== AXIS_DEVELOPMENT_STATE_SEMANTICS
        ) {
            throw new Error(
                '[G15.4_KERNEL] Frontier canonical developmentState is required.',
            );
        }
        const axisOrder = tierFor(spec.axisOrder ?? spec.tier);
        const parentFrontier = spec.parentFrontierId
            ? context.frontierIndex.get(spec.parentFrontierId)
            : null;
        const scaffoldFamilyGesture = spec.scaffoldFamilyGesture
            || (
                parentFrontier
                && parentFrontier.lineageId === spec.lineageId
                && parentFrontier.scaffoldFamilyGesture
                    ? parentFrontier.scaffoldFamilyGesture
                    : createScaffoldFamilyGesture(context, {
                        axisOrder,
                        heading: spec.heading,
                        parentGesture:
                            parentFrontier?.scaffoldFamilyGesture || null,
                        lineageId: spec.lineageId,
                        lineageKey: spec.lineageId,
                        parentLineageId: parentFrontier?.lineageId || null,
                        sequence:
                            spec.reservedAtEvent ?? spec.birthEvent ?? 0,
                        temperament: spec.temperament,
                    })
            );
        const inheritedGrowthUnit = parentFrontier
            && parentFrontier.lineageId === spec.lineageId
            ? parentFrontier.growthUnit
            : null;
        const growthUnit = spec.growthUnit
            || inheritedGrowthUnit
            || createGrowthUnit({
                lineageId: spec.lineageId,
                tier: axisOrder,
                source: spec.birthMode || 'axis_birth',
                createdAtSequence: spec.reservedAtEvent ?? spec.birthEvent ?? 0,
                startAxisAge: Math.max(0, Number(spec.axisAge || 0) - 1),
                constructionPortfolio: spec.constructionPortfolio,
                developmentState: spec.developmentState,
                relativeDifferentiation:
                    spec.developmentState.relativeDifferentiation,
                referenceLength: spec.previousInternodeLength,
            });
        if (!validGrowthUnit(growthUnit)) {
            throw new Error('[G15.4_KERNEL] Frontier canonical growthUnit is required.');
        }
        if (!context.growthUnitReceipts.some((receipt) => (
            receipt.phase === 'created'
            && receipt.growthUnitId === growthUnit.id
        ))) {
            context.growthUnitReceipts.push(createGrowthUnitReceipt(
                growthUnit,
                'created',
                spec.reservedAtEvent ?? spec.birthEvent ?? 0,
                { source: growthUnit.source },
            ));
        }
        const frontier = Object.freeze({
            id: idFor(context, 'frontier'),
            nodeId: spec.nodeId,
            parentFrontierId: spec.parentFrontierId,
            lineageId: spec.lineageId,
            tier: spec.tier,
            tierName: TIER_NAMES[spec.tier],
            axisOrder,
            axisOrderName: axisOrderNameFor(axisOrder),
            tierRole: tierRoleFor(axisOrder),
            birthMode: spec.birthMode,
            heading: Object.freeze({ ...normalize(spec.heading) }),
            axisEntryHeading: Object.freeze({ ...normalize(
                spec.axisEntryHeading || spec.heading,
            ) }),
            turnVelocity: rounded(spec.turnVelocity),
            radius: rounded(spec.radius),
            vigor: rounded(spec.vigor),
            axisAge: spec.axisAge,
            axisStepLimit: spec.axisStepLimit ?? TIERS[spec.tier].maximumAxisSteps,
            axisHardLimit: spec.axisHardLimit
                ?? (spec.axisStepLimit ?? TIERS[spec.tier].maximumAxisSteps),
            generationDepth: spec.generationDepth,
            reiterationForecast: Number(spec.reiterationForecast || 0),
            reiterationReserve: rounded(
                spec.reiterationReserve
                    ?? spec.developmentState.reiterationCredit
                    ?? 0,
            ),
            constructionReserve: rounded(spec.constructionReserve ?? 0.8),
            constructionPortfolio: spec.constructionPortfolio
                ? Object.freeze({ ...spec.constructionPortfolio })
                : null,
            meristemCadence: spec.meristemCadence
                ? Object.freeze({ ...spec.meristemCadence })
                : null,
            pendingForkIntent: spec.pendingForkIntent
                ? Object.freeze({ ...spec.pendingForkIntent })
                : null,
            growthUnit,
            nodeSiteOccupiedByLateral: Boolean(
                spec.nodeSiteOccupiedByLateral,
            ),
            scaffoldFamilyGesture,
            scaffoldFamilyDominanceClaim: spec.scaffoldFamilyDominanceClaim
                ? Object.freeze({ ...spec.scaffoldFamilyDominanceClaim })
                : null,
            previousInternodeLength: rounded(spec.previousInternodeLength ?? 0),
            forkDeferralCount: spec.forkDeferralCount ?? 0,
            nextForkAge: spec.nextForkAge,
            episode: spec.episode,
            episodeAge: spec.episodeAge,
            temperament: spec.temperament,
            formSide: spec.formSide,
            sag: Object.freeze({ ...spec.sag }),
            readyAt: rounded(spec.readyAt),
            nextTurnSign: spec.nextTurnSign,
            successionTurnSign: spec.successionTurnSign ?? spec.nextTurnSign,
            successionKinkState: spec.successionKinkState
                ? Object.freeze({ ...spec.successionKinkState })
                : createSuccessionKinkState(),
            handoffRepeatCount: spec.handoffRepeatCount ?? 0,
            birthResourceShare: spec.birthResourceShare,
            developmentalCapacity: rounded(spec.developmentalCapacity ?? 1),
            supportAllocation: rounded(spec.supportAllocation ?? spec.birthResourceShare ?? 1),
            extensionAllocation: rounded(spec.extensionAllocation ?? spec.birthResourceShare ?? 1),
            reiterationPotential: rounded(spec.reiterationPotential ?? 1),
            lateralMeristemReserve: rounded(spec.lateralMeristemReserve ?? 0),
            maturationState: spec.maturationState || 'active_extension',
            restUntilEvent: rounded(spec.restUntilEvent ?? spec.readyAt),
            regrowthPulseCount: spec.regrowthPulseCount ?? 0,
            resourceReserve: rounded(spec.resourceReserve ?? 1),
            maintenanceDebt: rounded(spec.maintenanceDebt ?? 0),
            spatialExposure: rounded(spec.spatialExposure ?? 1),
            developmentState: Object.freeze({ ...spec.developmentState }),
            completionFork: Boolean(spec.completionFork),
            horizontalRelease: Boolean(spec.horizontalRelease),
            clusterId: spec.cluster?.id || null,
            cluster: spec.cluster ? Object.freeze({ ...spec.cluster }) : null,
            developmentalRole: spec.developmentalRole || 'permanent_axis',
            temporaryAxis: Boolean(spec.temporaryAxis),
            temporaryAxisStepLimit: spec.temporaryAxisStepLimit ?? null,
        });
        context.frontiers.push(frontier);
        context.frontierIndex.set(frontier.id, frontier);
        context.activeFrontierIds.add(frontier.id);
        reserveFrontierCorridor(
            context,
            frontier,
            spec.reservedAtEvent ?? spec.episode.birthEvent ?? 0,
        );
        return frontier;
    }

    function heightBandFor(point) {
        return Math.max(0, Math.floor(point.y / 72));
    }

    function createRoot(context) {
        const sequence = 0;
        const rootNode = addNode(
            context,
            { x: 0, y: 0, z: 0 },
            null,
            null,
            sequence,
        );
        const baseHeading = normalize(context.preset.initialHeading);
        const lean = context.phenotype.asymmetrySign
            * context.phenotype.asymmetry
            * 0.055;
        const heading = rotateGrowthPlane(baseHeading, lean);
        const temperament = createRootTemperament(context.phenotype, context.rng);
        const episode = createRootEpisode(context, heading);
        const firstForkPlan = resolveFirstForkPlan(context);
        const rootLateralField = evaluateStrategyAxis(
            context,
            'lateral_investment',
            {
                tier: 0,
                radius: 18.5 * context.vigor,
                axisAge: 0,
                axisStepLimit: TIERS[0].maximumAxisSteps,
                temperament,
            },
            rootNode.point,
        );
        const successionTurnSign = -Math.sign(heading.x)
            || -context.phenotype.asymmetrySign;
        const rootDevelopmentState = createRootDevelopmentState(context, {
            temperament,
        });
        const lineage = createLineage(context, {
            parentLineageId: null,
            tier: 0,
            axisOrder: 0,
            birthMode: 'root_emergence',
            birthEvent: sequence,
            resourceShare: 1,
            episode,
            temperament,
            developmentState: rootDevelopmentState,
        });
        const rootNextForkAge = clamp(
            context.form.kind === 'central_recursive_meander'
                ? Math.max(
                    Math.round(
                        firstForkPlan.continuousAge
                            * temperament.forkIntervalScale,
                    ),
                    episode.commitmentDuration,
                )
                : Math.round(
                    firstForkPlan.continuousAge * temperament.forkIntervalScale,
                ),
            3,
            7,
        );
        const rootFamilyConstructionGrant = context.phenotype.constructionEndowment
            * (3.1 + context.phenotype.complexityScale * 0.9)
            * clamp(
                Math.sqrt(context.phenotype.crownSegmentTarget / 51),
                0.86,
                1.24,
            );
        const rootReiterationForecast = 1;
        const rootConstructionPortfolio = createAxisConstructionPortfolio(
            context,
            {
                root: true,
                tier: 0,
                generationDepth: 0,
                origin: rootNode.point,
                familyConstructionGrant: rootFamilyConstructionGrant,
                plannedInternodeCount: rootNextForkAge,
                anticipatesStructuralFork: true,
                reiterationCommitment: 1,
                extensionCapacity: 1,
                lateralInvestmentScale:
                    rootLateralField.effect.lateralInvestmentScale,
                developmentState: rootDevelopmentState,
                temperament,
            },
        );
        const frontier = addFrontier(context, {
            nodeId: rootNode.id,
            parentFrontierId: null,
            lineageId: lineage.id,
            tier: 0,
            axisOrder: 0,
            birthMode: 'root_emergence',
            heading,
            axisEntryHeading: heading,
            turnVelocity: episode.curvatureVelocity,
            radius: 18.5 * context.vigor,
            vigor: context.vigor,
            axisAge: 0,
            axisStepLimit: rootConstructionPortfolio.plannedInternodeCount,
            axisHardLimit: rootConstructionPortfolio.plannedInternodeCount,
            generationDepth: 0,
            reiterationForecast: rootReiterationForecast,
            // Compatibility projection for diagnostic consumers. Structural
            // competence is owned by developmentState.reiterationCredit, not
            // by the old integer fork forecast.
            reiterationReserve: rootDevelopmentState.reiterationCredit,
            constructionReserve: rootConstructionPortfolio.axisConstructionBudget,
            constructionPortfolio: rootConstructionPortfolio,
            meristemCadence: createRootCadence({
                root: true,
                sequence,
                lineageId: lineage.id,
                axisFamilyId: lineage.id,
                formKind: context.form.kind,
                presetId: context.presetId,
                traitId: context.traitId,
                temperament,
                referenceLength: TIERS[0].meanLength
                    * rootConstructionPortfolio.plannedLengthScale,
                sourceRadius: 18.5 * context.vigor,
                lateralInvestmentScale:
                    rootLateralField.effect.lateralInvestmentScale,
                lateralTimingBias: context.phenotype.lateralTimingBias,
            }),
            forkDeferralCount: 0,
            nextForkAge: rootConstructionPortfolio.plannedInternodeCount,
            episode,
            episodeAge: 0,
            temperament,
            formSide: 0,
            sag: { active: false, age: 0, recoveryAfter: 5 },
            readyAt: 0,
            nextTurnSign: successionTurnSign,
            successionTurnSign,
            successionKinkState: createSuccessionKinkState(),
            handoffRepeatCount: 0,
            birthResourceShare: 1,
            developmentalCapacity: 1,
            supportAllocation: 1,
            extensionAllocation: 1,
            reiterationPotential: 1,
            lateralMeristemReserve: 0,
            maturationState: 'active_extension',
            restUntilEvent: 0,
            regrowthPulseCount: 0,
            resourceReserve: 1.18,
            maintenanceDebt: 0,
            spatialExposure: 1,
            developmentState: rootDevelopmentState,
            reservedAtEvent: sequence,
        });
        context.strategyReceipts.push(Object.freeze({
            kind: 'fork_schedule',
            sequence,
            frontierId: frontier.id,
            lineageId: lineage.id,
            baseAge: firstForkPlan.baseAge,
            strategyAdjustedAge: firstForkPlan.age,
            scheduledAge: frontier.nextForkAge,
            suppression: firstForkPlan.suppression,
            field: firstForkPlan.strategyField,
        }));
        const rootCorridorId = context.frontierCorridorIndex.get(frontier.id);
        context.events.push(Object.freeze({
            id: idFor(context, 'event'),
            sequence,
            kind: 'emerge',
            consumedFrontierId: null,
            createdNodeIds: Object.freeze([rootNode.id]),
            createdSegmentIds: Object.freeze([]),
            createdFrontierIds: Object.freeze([frontier.id]),
            releasedCorridorIds: Object.freeze([]),
            createdCorridorIds: Object.freeze(
                rootCorridorId ? [rootCorridorId] : [],
            ),
            activeFrontierIdsAfter: activeSnapshot(context),
            activeCorridorIdsAfter: activeCorridorSnapshot(context),
            note: 'one root axis frontier emerged with a prospective episode corridor',
        }));
    }

    function evolveHeading(context, frontier, episode) {
        const targetAngle = signedPlanarAngle(frontier.heading, episode.targetHeading);
        const turnMemory = frontier.turnVelocity
            * frontier.temperament.curvatureMemory
            * 0.54;
        const desiredTurn = targetAngle * 0.34 + turnMemory;
        const continuity = clamp(
            Number(frontier.developmentState?.apicalContinuity ?? 0.5),
            0,
            1,
        );
        const terminalAffinity = clamp(
            Number(frontier.developmentState?.terminalAffinity ?? 0.2),
            0,
            1,
        );
        const maximumTurn = (0.2
            + (1 - continuity) * 0.11
            + terminalAffinity * 0.045)
            * context.preset.turnScale
            * frontier.temperament.turnScale;
        const boundedTurn = clamp(desiredTurn, -maximumTurn, maximumTurn);
        let direction = rotateGrowthPlane(frontier.heading, boundedTurn);
        const newTurnVelocity = frontier.turnVelocity * 0.58 + boundedTurn * 0.42;
        let sag = frontier.sag;
        if (sag.active) {
            const nextSagAge = sag.age + 1;
            const gravityWeight = sagGravityWeight(
                nextSagAge,
                episode.gravityResponse,
            );
            if (nextSagAge <= sag.recoveryAfter) {
                direction = mixDirection(direction, { x: 0, y: -1, z: 0 }, gravityWeight);
            } else if (context.phenotype.recoveryTendency > 0.46) {
                direction = mixDirection(
                    direction,
                    { x: Math.sign(direction.x) * 0.36, y: 0.93, z: 0 },
                    0.07 + context.phenotype.recoveryTendency * 0.06,
                );
            }
            sag = Object.freeze({ ...sag, age: nextSagAge });
        }
        // Terminal clusters are oriented envelopes evaluated by the spatial
        // candidate field. They do not pull an established axis toward a
        // point on every internode; that repeated pursuit produced the sharp
        // corrective hooks removed in v39.
        const balanceField = resolveFutureBalanceField(context, frontier);
        const support = clamp(
            Number(frontier.developmentState?.supportInvestment ?? 0.5),
            0,
            1,
        );
        const balancePressureMagnitude = Math.hypot(
            balanceField.pressureX,
            balanceField.pressureZ,
        );
        const balanceAuthority = clamp(
            (0.018
                + support * 0.035
                + continuity * 0.018
                - terminalAffinity * 0.014)
                * (0.72 + balancePressureMagnitude * 7.2),
            0.012,
            0.14,
        );
        if (
            context.totalMass > 1
            && (Math.abs(balanceField.pressureX) > 1e-6
                || Math.abs(balanceField.pressureZ) > 1e-6)
        ) {
            const balanceTarget = normalize({
                x: direction.x + balanceField.pressureX * 2.1,
                y: direction.y,
                z: direction.z + balanceField.pressureZ * 1.7,
            });
            direction = mixDirection(direction, balanceTarget, balanceAuthority);
        }
        return {
            direction: stabilizeAxisIntent(context, frontier, direction),
            turnVelocity: newTurnVelocity,
            sag,
            balanceField,
            balanceAuthority: rounded(balanceAuthority),
        };
    }

    function segmentRunLength(context, frontier, episode, options = false) {
        const normalizedOptions = typeof options === 'boolean'
            ? { birth: options }
            : options;
        const origin = frontier.point
            || (frontier.nodeId ? nodeById(context, frontier.nodeId)?.point : null)
            || { x: 0, y: 0, z: 0 };
        return resolveInternodeConstruction(
            context,
            frontier,
            episode,
            { ...normalizedOptions, origin },
        ).realizedLength;
    }

    function settleResourceEconomy(
        context,
        frontier,
        corridorScore,
        runLength,
        constructionReceipt,
        sequence,
    ) {
        const origin = nodeById(context, frontier.nodeId)?.point
            || { x: 0, y: 0, z: 0 };
        const maturation = resolveExtensionMaturation(context, frontier, origin);
        const exposure = clamp(1 / (1 + corridorScore * 0.11), 0.14, 1);
        const relativeRadius = clamp(frontier.radius / 18.5, 0.08, 1.4);
        const supportInvestment = clamp(
            Number(frontier.developmentState?.supportInvestment ?? 0.5),
            0,
            1,
        );
        const transportBurden = clamp(
            Number(frontier.developmentState?.transportBurden || 0),
            0,
            1.8,
        );
        const maintenanceBase = 0.072 + supportInvestment * 0.068;
        const maintenance = maintenanceBase
            * (0.68 + relativeRadius ** 1.15)
            * (1 + frontier.axisAge * 0.03)
            * (
                1
                    + maturation.coordinates.transportDistance * 0.22
                    + transportBurden * 0.16
                    + Number(maturation.verticalTransportWork || 0) * 0.06
            );
        const income = frontier.vigor
            * (0.085 + frontier.extensionAllocation * 0.155)
            * (0.68 + exposure * 0.32)
            * clamp(1 - transportBurden * 0.075, 0.78, 1);
        const balance = income - maintenance;
        const realizedConstructionCost = constructionReceipt?.constructionCost
            ?? constructionCost(context, frontier, runLength);
        // Construction is paid from the same assimilate stream as maintenance,
        // but an exposed growing tip must not receive exactly zero longitudinal
        // reinvestment merely because the whole woody axis has become costly.
        // Open foliage contributes a larger fraction after maintenance while a
        // shaded axis still declines continuously through reserve and debt.
        const constructionMaintenanceShare = clamp(
            0.5 - exposure * 0.14,
            0.34,
            0.48,
        );
        const grossConstructionIncome = Math.max(
            0,
            income - maintenance * constructionMaintenanceShare,
        )
            * (0.34 + frontier.extensionAllocation * 0.42)
            * clamp(Number(maturation.extensionSupplyRatio || 1), 0.56, 1.12);
        const reserveAfterConstruction = constructionReceipt?.reserveAfterConstruction
            ?? Math.max(0, frontier.constructionReserve - realizedConstructionCost);
        const familyFlow = settleFamilyResourceFlow(
            context,
            frontier,
            grossConstructionIncome,
            reserveAfterConstruction,
            exposure,
            sequence,
        );
        const constructionIncome = familyFlow.retainedIncome
            + familyFlow.withdrawal;
        const constructionPortfolio = creditAxisConstructionPortfolio(
            constructionReceipt?.portfolioAfterConstruction
                || frontier.constructionPortfolio,
            constructionIncome,
        );
        const constructionReserve = clamp(
            reserveAfterConstruction
                + constructionIncome,
            0,
            2.1,
        );
        const resourceReserve = clamp(
            frontier.resourceReserve + balance + familyFlow.withdrawal * 0.12,
            0,
            1.9,
        );
        const reiterationReserve = clamp(
            Number(frontier.developmentState?.reiterationCredit || 0)
                + Math.max(0, balance) * frontier.reiterationPotential * 0.11
                - Math.max(0, -balance) * 0.08,
            0,
            2.2,
        );
        const stress = clamp(
            Math.max(0, -balance) / Math.max(maintenance, 0.01)
                + Math.max(0, 0.24 - resourceReserve) * 1.7,
            0,
            1,
        );
        const vigor = clamp(
            frontier.vigor * (0.987 - stress * 0.058)
                + exposure * 0.012
                - context.phenotype.resourceConservatism * 0.004,
            0.08,
            1.3,
        );
        return Object.freeze({
            income: rounded(income),
            maintenance: rounded(maintenance),
            balance: rounded(balance),
            resourceReserve: rounded(resourceReserve),
            maintenanceDebt: rounded(Math.max(
                0,
                frontier.maintenanceDebt * 0.84 - balance,
            )),
            stress: rounded(stress),
            exposure: rounded(exposure),
            vigor: rounded(vigor),
            reiterationReserve: rounded(reiterationReserve),
            constructionCost: rounded(realizedConstructionCost),
            constructionIncome: rounded(constructionIncome),
            grossConstructionIncome: rounded(grossConstructionIncome),
            constructionMaintenanceShare: rounded(constructionMaintenanceShare),
            constructionReserve: rounded(constructionReserve),
            constructionPortfolio,
            familyFlow,
            maturation,
        });
    }

    function settleFamilyResourceFlow(
        context,
        frontier,
        grossConstructionIncome,
        reserveAfterConstruction,
        exposure,
        sequence,
    ) {
        const lineage = context.lineageIndex.get(frontier.lineageId);
        if (!lineage) {
            throw new Error(
                `[G15.4_FAMILY_FLOW] Missing lineage ${frontier.lineageId}.`,
            );
        }
        const state = frontier.developmentState || {};
        const contributionRate = clamp(
            0.2
                + Number(state.lateralCompetence || 0) * 0.11
                + Number(state.reiterationReadiness || 0) * 0.045,
            0.18,
            0.4,
        );
        const contribution = grossConstructionIncome * contributionRate;
        const retainedIncome = Math.max(0, grossConstructionIncome - contribution);
        const ownPoolBefore = Number(
            context.familyResourceLedgers.get(lineage.id) || 0,
        );
        context.familyResourceLedgers.set(
            lineage.id,
            ownPoolBefore + contribution,
        );

        const parentPoolId = lineage.parentLineageId;
        const parentPoolBefore = parentPoolId
            ? Number(context.familyResourceLedgers.get(parentPoolId) || 0)
            : 0;
        const targetConstructionReserve = clamp(
            0.12
                + Number(state.supportInvestment || 0) * 0.24
                + Number(state.extensionDrive || 0) * 0.2
                + Number(state.reiterationCredit || 0) * 0.055,
            0.14,
            0.62,
        );
        const demand = Math.max(
            0,
            targetConstructionReserve - reserveAfterConstruction,
        ) * (0.18 + exposure * 0.24);
        const withdrawal = Math.min(parentPoolBefore, demand, 0.14);
        if (parentPoolId && withdrawal > 0) {
            context.familyResourceLedgers.set(
                parentPoolId,
                Math.max(0, parentPoolBefore - withdrawal),
            );
        }
        const receipt = Object.freeze({
            semantics: 'conserved_parent_lineage_assimilate_flow_v1',
            sequence,
            frontierId: frontier.id,
            lineageId: lineage.id,
            parentPoolId,
            contribution: rounded(contribution),
            retainedIncome: rounded(retainedIncome),
            withdrawal: rounded(withdrawal),
            netFlow: rounded(withdrawal - contribution),
            ownPoolBefore: rounded(ownPoolBefore),
            ownPoolAfter: rounded(ownPoolBefore + contribution),
            parentPoolBefore: rounded(parentPoolBefore),
            parentPoolAfter: rounded(Math.max(0, parentPoolBefore - withdrawal)),
            targetConstructionReserve: rounded(targetConstructionReserve),
            demand: rounded(demand),
        });
        context.familyResourceReceipts.push(receipt);
        return receipt;
    }

    function advanceEvent(context, frontier, sequence, options = {}) {
        const consumedGrowthUnit = frontier.growthUnit;
        const pendingForkIntent = options.forkIntent
            || frontier.pendingForkIntent
            || null;
        const forkDevelopmentDeferred = Boolean(
            options.forkPermissionDeferred
            && pendingForkIntent,
        );
        const forkPermissionDeferred = Boolean(
            forkDevelopmentDeferred
            && pendingForkIntent?.visibleScaffoldReleasePlanned,
        );
        const permissionDeferralReceipt = forkPermissionDeferred
            ? Object.freeze({
                ...options.visibleScaffoldPermission,
                id: `permission-${String(
                    context.visibleScaffoldPermissionReceipts.length + 1,
                ).padStart(4, '0')}`,
                sequence,
                phase: 'pre_mutation',
                candidateKind: 'structural_fork',
                frontierId: frontier.id,
                lineageId: frontier.lineageId,
                claimId: pendingForkIntent.cadenceClaimId,
                forkIntentId: pendingForkIntent.id,
                planHash: pendingForkIntent.planHash,
                plannedChildOrders:
                    pendingForkIntent.signature.childAxisOrders,
                required: true,
                decision: 'deferred',
                committed: false,
            })
            : null;
        if (permissionDeferralReceipt) {
            context.visibleScaffoldPermissionReceipts.push(
                permissionDeferralReceipt,
            );
        }
        const constructionPortfolioBeforePreAdvanceRenewal =
            frontier.constructionPortfolio || null;
        const portfolioCompleteBeforeAdvance = Boolean(
            pendingForkIntent
            && constructionPortfolioBeforePreAdvanceRenewal
            && Number(constructionPortfolioBeforePreAdvanceRenewal.cursor || 0)
                >= Number(
                    constructionPortfolioBeforePreAdvanceRenewal
                        .plannedInternodeCount || 0,
                ),
        );
        const preAdvanceConstructionRenewal = portfolioCompleteBeforeAdvance
            ? renewAxisConstructionPortfolio(
                context,
                frontier,
                frontier.developmentState,
                { preservePendingForkConstruction: true },
            )
            : null;
        if (portfolioCompleteBeforeAdvance && !preAdvanceConstructionRenewal) {
            context.forkIdentityIntentReceipts.push(Object.freeze({
                semantics: pendingForkIntent.semantics,
                phase: 'cancelled',
                sequence,
                forkIntentId: pendingForkIntent.id,
                planHash: pendingForkIntent.planHash,
                lineageId: frontier.lineageId,
                cadenceClaimId: pendingForkIntent.cadenceClaimId,
                reason: 'aborted_with_axis_construction_exhaustion',
            }));
            terminateEvent(
                context,
                frontier,
                sequence,
                'pending_fork_construction_exhausted',
            );
            return Object.freeze({
                effectiveAction: 'terminate_frontier',
                permissionReceipt: permissionDeferralReceipt,
                forkIntentAborted: true,
            });
        }
        if (preAdvanceConstructionRenewal) {
            const renewedAxisLimit = Number(frontier.axisAge || 0)
                + Number(preAdvanceConstructionRenewal.plannedInternodeCount || 0);
            const renewedGrowthUnit = renewGrowthUnit(frontier.growthUnit, {
                createdAtSequence: sequence,
                startAxisAge: frontier.axisAge,
                constructionPortfolio: preAdvanceConstructionRenewal,
                developmentState: frontier.developmentState,
                referenceLength: frontier.previousInternodeLength,
                pendingApicalIntentId: pendingForkIntent?.id || null,
                source: 'pre_advance_pending_apical_intent_renewal',
            });
            context.growthUnitReceipts.push(createGrowthUnitReceipt(
                consumedGrowthUnit,
                'completed',
                sequence,
                { endpointFate: 'apical_fork_pending' },
            ));
            context.growthUnitReceipts.push(createGrowthUnitReceipt(
                renewedGrowthUnit,
                'created',
                sequence,
                { source: renewedGrowthUnit.source },
            ));
            frontier = Object.freeze({
                ...frontier,
                constructionPortfolio: preAdvanceConstructionRenewal,
                growthUnit: renewedGrowthUnit,
                axisStepLimit: renewedAxisLimit,
                axisHardLimit: renewedAxisLimit,
            });
        }
        context.activeFrontierIds.delete(frontier.id);
        const releasedCorridorId = releaseFrontierCorridor(
            context,
            frontier.id,
            sequence,
        );
        const origin = nodeById(context, frontier.nodeId).point;
        const transitioned = frontier.episodeAge >= frontier.episode.commitmentDuration;
        const episode = transitioned
            ? recommitEpisode(context, frontier, sequence)
            : frontier.episode;
        const balanceField = episode.intentReceipt?.balanceField
            || resolveFutureBalanceField(context, frontier);
        const evolved = evolveHeading(context, frontier, episode);
        const constructionReceipt = resolveInternodeConstruction(
            context,
            frontier,
            episode,
            { origin, birth: false },
        );
        const runLength = constructionReceipt.realizedLength;
        const selected = selectAdvanceDirection(
            context,
            frontier,
            origin,
            evolved.direction,
            runLength,
            episode,
        );
        const resourceAccount = settleResourceEconomy(
            context,
            frontier,
            selected.corridorScore,
            runLength,
            constructionReceipt,
            sequence,
        );
        const evolvedDevelopmentState = evolveAfterInternode(
            context,
            frontier,
            {
                origin,
                target: selected.target,
                heading: selected.direction,
                runLength,
                constructionCost: resourceAccount.constructionCost,
                resourceBalance: resourceAccount.balance,
                stress: resourceAccount.stress,
                exposure: resourceAccount.exposure,
                transportPressure:
                    resourceAccount.maturation.coordinates.transportDistance,
                familyFlowNet: resourceAccount.familyFlow.netFlow,
            },
        );
        const nextVigor = resourceAccount.vigor * clamp(
            0.965 + frontier.temperament.vigorPersistence * 0.035,
            0.99,
            1,
        );
        const constructionProgress = clamp(
            (Number(frontier.constructionPortfolio?.cursor || 0) + 1)
                / Math.max(
                    1,
                    Number(frontier.constructionPortfolio?.plannedInternodeCount || 1),
                ),
            0,
            1,
        );
        const maturationProgress = constructionProgress ** 2;
        const radiusProfile = resolveAxisRadiusProfile(
            evolvedDevelopmentState,
        );
        const endRadius = Math.max(
            frontier.radius * (radiusProfile.taper
                - maturationProgress * radiusProfile.maturationPressure),
            Math.min(frontier.radius, radiusProfile.minimumRadius),
        );
        const createdNode = addNode(
            context,
            selected.target,
            frontier.nodeId,
            null,
            sequence,
        );
        const segment = addSegment(context, {
            fromNodeId: frontier.nodeId,
            toNodeId: createdNode.id,
            lineageId: frontier.lineageId,
            tier: frontier.tier,
            axisOrder: frontier.axisOrder,
            birthMode: frontier.birthMode,
            startRadius: frontier.radius,
            endRadius,
            length: runLength,
            resourceShare: frontier.birthResourceShare,
            episode,
            birthEvent: sequence,
            clusterId: frontier.clusterId,
            developmentState: evolvedDevelopmentState,
            developmentalRole: frontier.developmentalRole,
            temporaryAxis: frontier.temporaryAxis,
            scaffoldFamilyDominanceClaim:
                frontier.scaffoldFamilyDominanceClaim,
        });
        const node = Object.freeze({
            ...createdNode,
            incomingSegmentId: segment.id,
        });
        context.nodes[context.nodes.length - 1] = node;
        context.nodeIndex.set(node.id, node);
        const lineage = context.lineageIndex.get(frontier.lineageId);
        lineage.segmentIds.push(segment.id);
        // Structural cadence measures the physical path already constructed,
        // including this internode. Both a lateral release at this node and a
        // later fork therefore observe the same inherited axis-family clock.
        const advancedMeristemCadence = advanceMeristemCadence(
            frontier.meristemCadence,
            segment.length,
        );
        const cadenceAwareFrontier = {
            ...frontier,
            meristemCadence: advancedMeristemCadence,
        };
        const lateralMeristem = createLateralMeristem(
            context,
            {
                ...cadenceAwareFrontier,
                vigor: nextVigor,
                supportAllocation: evolvedDevelopmentState.supportInvestment,
                extensionAllocation: evolvedDevelopmentState.extensionDrive,
                reiterationPotential: clamp(
                    evolvedDevelopmentState.reiterationReadiness,
                    0.08,
                    1,
                ),
                resourceReserve: resourceAccount.resourceReserve,
                constructionReserve: resourceAccount.constructionReserve,
                spatialExposure: resourceAccount.exposure,
                developmentState: evolvedDevelopmentState,
            },
            node,
            segment,
            sequence,
            {
                constructionPortfolio: resourceAccount.constructionPortfolio,
            },
        );
        const postLateralConstructionPortfolio = lateralMeristem
            ? commitLateralConstructionPortfolio(
                resourceAccount.constructionPortfolio,
                lateralMeristem.constructionGrant || 0,
                {
                    side: lateralMeristem.side,
                    progress: lateralMeristem.plannedAxisProgress,
                },
            )
            : resourceAccount.constructionPortfolio;
        const resourceForkDeferred = forkOpportunityDue(frontier)
            && !shouldFork(frontier);
        const forkDeferred = resourceForkDeferred || forkDevelopmentDeferred;
        const nextForkDeferralCount = forkDeferred
            ? frontier.forkDeferralCount + 1
            : frontier.forkDeferralCount;
        // Deferral is an observation of temporary physical infeasibility. It
        // must not secretly delete future competence after an arbitrary count;
        // stress, transport and construction history already lower credit
        // continuously in the canonical development state.
        const abortDeferredMeristem = false;
        const nextReiterationForecast = frontier.reiterationForecast;
        const lateralEmission = lateralMeristem
            ? emitLateralAxis(
                context,
                lateralMeristem,
                sequence,
                null,
                {
                    embedded: true,
                    continuation: {
                        heading: selected.direction,
                        radius: endRadius,
                        vigor: nextVigor,
                        resourceReserve: resourceAccount.resourceReserve,
                        constructionReserve: resourceAccount.constructionReserve,
                        developmentalCapacity: frontier.developmentalCapacity,
                        supportAllocation:
                            evolvedDevelopmentState.supportInvestment,
                        extensionAllocation: evolvedDevelopmentState.extensionDrive,
                        spatialExposure: resourceAccount.exposure,
                        developmentState: evolvedDevelopmentState,
                    },
                },
            )
            : null;
        const committedDevelopmentState = lateralEmission?.junctionPlan
            ?.continuationDevelopmentState || evolvedDevelopmentState;
        const nextReiterationReserve = committedDevelopmentState
            .reiterationCredit;
        const committedHeading = lateralEmission?.junctionPlan
            ?.continuationHeading || selected.direction;
        const committedRadius = lateralEmission?.junctionPlan
            ?.continuationRadius || endRadius;
        const temporaryJuvenileEmission = Boolean(
            lateralEmission && lateralMeristem.temporaryAxis,
        );
        const committedMeristemCadence = lateralEmission
            ? (temporaryJuvenileEmission
                ? commitJuvenileShootCadence(cadenceAwareFrontier, {
                    sequence,
                    side: lateralMeristem.side,
                    lineageId: lateralEmission.lineageId,
                    resourceShare: lateralEmission.junctionPlan
                        ?.lateralAreaFraction ?? lateralMeristem.resourceShare,
                    sourceSegmentLength: segment.length,
                    sourceRadius: lateralEmission.junctionPlan?.sourceRadius
                        ?? segment.endRadius,
                })
                : commitLateralCadence(context, cadenceAwareFrontier, {
                    sequence,
                    side: lateralMeristem.side,
                    resourceShare: lateralEmission.junctionPlan
                        ?.lateralAreaFraction ?? lateralMeristem.resourceShare,
                    sourceSegmentLength: segment.length,
                    sourceRadius: lateralEmission.junctionPlan?.sourceRadius
                        ?? segment.endRadius,
                    developmentState: committedDevelopmentState,
                }))
            : advancedMeristemCadence;
        const liveLateralRequiresPermission = Boolean(
            lateralEmission
            && Number(frontier.axisOrder ?? frontier.tier ?? 1) === 0
            && !temporaryJuvenileEmission,
        );
        const observedLiveLateralPermission = lateralEmission
            ? lateralMeristem.structuralReleaseReadiness
                ?.visibleScaffoldPermission
                || resolveVisibleScaffoldReleasePermission(cadenceAwareFrontier)
            : null;
        const liveLateralPermission = liveLateralRequiresPermission
            ? observedLiveLateralPermission
            : null;
        if (liveLateralRequiresPermission && !liveLateralPermission?.eligible) {
            throw new Error(
                '[G15.4_KERNEL] Live lateral committed without a visible-scaffold permission.',
            );
        }
        const liveLateralPermissionReceipt = lateralEmission
            ? Object.freeze({
                ...observedLiveLateralPermission,
                id: `permission-${String(
                    context.visibleScaffoldPermissionReceipts.length + 1,
                ).padStart(4, '0')}`,
                sequence,
                phase: 'pre_mutation',
                candidateKind: 'live_lateral_emission',
                frontierId: frontier.id,
                lineageId: frontier.lineageId,
                claimId: liveLateralRequiresPermission
                    ? liveLateralPermission?.claimId || null
                    : null,
                observedClaimId: observedLiveLateralPermission?.claimId || null,
                forkIntentId: pendingForkIntent?.id || null,
                planHash: pendingForkIntent?.planHash || null,
                plannedChildOrders: Object.freeze([
                    Number(frontier.axisOrder ?? frontier.tier ?? 0) + 1,
                ]),
                required: liveLateralRequiresPermission,
                decision: liveLateralRequiresPermission
                    ? 'granted'
                    : (temporaryJuvenileEmission
                        ? 'not_required_temporary_juvenile_axis'
                        : 'not_required_non_order_zero_lateral'),
                committed: true,
                developmentalRole: lateralMeristem.developmentalRole,
                juvenileShootOpportunity:
                    lateralMeristem.juvenileShootOpportunity || null,
            })
            : null;
        if (liveLateralPermissionReceipt) {
            context.visibleScaffoldPermissionReceipts.push(
                liveLateralPermissionReceipt,
            );
        }
        const pendingIntentCancelledByLateral = Boolean(
            lateralEmission
            && pendingForkIntent
            && liveLateralRequiresPermission
            && pendingForkIntent.cadenceClaimId
                === liveLateralPermissionReceipt?.claimId,
        );
        if (pendingIntentCancelledByLateral) {
            context.forkIdentityIntentReceipts.push(Object.freeze({
                semantics: pendingForkIntent.semantics,
                phase: 'cancelled',
                sequence,
                forkIntentId: pendingForkIntent.id,
                planHash: pendingForkIntent.planHash,
                lineageId: frontier.lineageId,
                cadenceClaimId: pendingForkIntent.cadenceClaimId,
                reason: 'superseded_by_live_lateral_release',
            }));
        }
        const nextPendingForkIntent = pendingIntentCancelledByLateral
            ? null
            : pendingForkIntent;
        let advancedGrowthUnit = advanceGrowthUnit(frontier.growthUnit, {
            length: runLength,
            radiusScale: committedRadius / Math.max(1, 18.5 * context.vigor),
            branchCommitted: Boolean(
                lateralEmission && !temporaryJuvenileEmission,
            ),
            pendingApicalIntentId: nextPendingForkIntent?.id || null,
            reservedDescendantConstruction: Number(
                postLateralConstructionPortfolio
                    ?.descendantConstructionBudget || 0,
            ),
        });
        if (nextPendingForkIntent) {
            advancedGrowthUnit = bindApicalIntent(
                advancedGrowthUnit,
                nextPendingForkIntent,
                postLateralConstructionPortfolio
                    ?.descendantConstructionBudget,
            );
        }
        const proposedForkCadence = lateralEmission && !temporaryJuvenileEmission
            ? resolveNextForkCadence(
                frontier,
                committedMeristemCadence,
                postLateralConstructionPortfolio,
            )
            : null;
        const priorNextForkAge = Number(frontier.nextForkAge || 0);
        const priorClockNextForkAge = forkDeferred
            ? priorNextForkAge + 1
            : priorNextForkAge;
        // A live lateral commits a new visible-scaffold cadence, so its next
        // fork clock becomes the active clock. Taking max(old, new) retained
        // the pre-release birth schedule and silently discarded the sampled
        // post-lateral interval (seed 887: desired age 3 became old age 7).
        const postLateralCadenceOwnsClock = Boolean(
            proposedForkCadence?.active,
        );
        const cadenceNextForkAge = postLateralCadenceOwnsClock
            ? Number(proposedForkCadence.nextForkAge)
            : priorClockNextForkAge;
        const forkCadence = proposedForkCadence
            ? Object.freeze({
                ...proposedForkCadence,
                priorNextForkAge,
                cadenceNextForkAge: proposedForkCadence.active
                    ? Number(proposedForkCadence.nextForkAge)
                    : null,
                resolvedNextForkAge: cadenceNextForkAge,
                clockOwner: postLateralCadenceOwnsClock
                    ? 'post_lateral_visible_scaffold_cadence'
                    : 'prior_axis_schedule',
                resolution: postLateralCadenceOwnsClock
                    ? 'post_lateral_cadence_replaced_prior_schedule'
                    : (forkDeferred
                        ? 'prior_axis_clock_deferred'
                        : 'prior_axis_clock_retained'),
            })
            : null;
        const continuationCandidate = {
            ...frontier,
            axisAge: frontier.axisAge + 1,
            radius: committedRadius,
            vigor: nextVigor,
            reiterationForecast: nextReiterationForecast,
            nextForkAge: cadenceNextForkAge,
            resourceReserve: resourceAccount.resourceReserve,
            constructionReserve: resourceAccount.constructionReserve,
            constructionPortfolio: postLateralConstructionPortfolio,
            growthUnit: advancedGrowthUnit,
            nodeSiteOccupiedByLateral: Boolean(lateralEmission),
            meristemCadence: committedMeristemCadence,
            developmentalCapacity: frontier.developmentalCapacity,
            developmentState: committedDevelopmentState,
        };
        // A due meristem and an executable fork are different states. The old
        // boundary blocked portfolio renewal as soon as a fork became due,
        // even when its current resource account could not execute it. The
        // next scheduler turn then killed the axis solely because the prior
        // portfolio cursor was complete. Keep the axis growing from its own
        // history until the fork is physically executable or the continuation
        // account genuinely becomes non-viable.
        const continuationPermission = nextPendingForkIntent
            ?.visibleScaffoldReleasePlanned
            ? resolveVisibleScaffoldReleasePermission(continuationCandidate)
            : null;
        const executableFork = shouldFork(continuationCandidate)
            && (
                !nextPendingForkIntent?.visibleScaffoldReleasePlanned
                || continuationPermission?.eligible
            );
        const reconciledConstructionPortfolio = executableFork
            || nextPendingForkIntent
            ? postLateralConstructionPortfolio
            : reconcileAxisConstructionCommitments(
                postLateralConstructionPortfolio,
                committedDevelopmentState,
            );
        const renewalCandidate = {
            ...continuationCandidate,
            constructionPortfolio: reconciledConstructionPortfolio,
        };
        const renewedConstructionPortfolio = executableFork
            ? null
            : renewAxisConstructionPortfolio(
                context,
                renewalCandidate,
                committedDevelopmentState,
                {
                    preservePendingForkConstruction: Boolean(
                        nextPendingForkIntent,
                    ),
                },
            );
        const nextConstructionPortfolio = renewedConstructionPortfolio
            || reconciledConstructionPortfolio;
        const nextGrowthUnit = renewedConstructionPortfolio
            ? renewGrowthUnit(advancedGrowthUnit, {
                createdAtSequence: sequence,
                startAxisAge: frontier.axisAge + 1,
                constructionPortfolio: renewedConstructionPortfolio,
                developmentState: committedDevelopmentState,
                referenceLength: runLength,
                pendingApicalIntentId: nextPendingForkIntent?.id || null,
            })
            : advancedGrowthUnit;
        if (renewedConstructionPortfolio) {
            context.growthUnitReceipts.push(createGrowthUnitReceipt(
                advancedGrowthUnit,
                'completed',
                sequence,
                {
                    endpointFate: nextPendingForkIntent
                        ? 'apical_fork_pending'
                        : 'explicit_apical_flush_renewal',
                },
            ));
            context.growthUnitReceipts.push(createGrowthUnitReceipt(
                nextGrowthUnit,
                'created',
                sequence,
                { source: nextGrowthUnit.source },
            ));
        }
        const renewedAxisLimit = renewedConstructionPortfolio
            ? frontier.axisAge + 1
                + renewedConstructionPortfolio.plannedInternodeCount
            : frontier.axisStepLimit;
        const nextFrontier = addFrontier(context, {
            nodeId: node.id,
            parentFrontierId: frontier.id,
            lineageId: frontier.lineageId,
            tier: frontier.tier,
            axisOrder: frontier.axisOrder,
            birthMode: frontier.birthMode,
            heading: committedHeading,
            axisEntryHeading: frontier.axisEntryHeading,
            turnVelocity: evolved.turnVelocity,
            radius: committedRadius,
            // Resource economy already applies segment stress. Temperament is
            // persistence, not a second per-segment percentage loss; directly
            // multiplying by 0.78-0.98 caused exponential axis collapse and
            // made otherwise viable sibling families disappear by seed.
            vigor: nextVigor,
            axisAge: frontier.axisAge + 1,
            axisStepLimit: renewedAxisLimit,
            axisHardLimit: renewedAxisLimit,
            generationDepth: frontier.generationDepth,
            reiterationForecast: nextReiterationForecast,
            reiterationReserve: nextReiterationReserve,
            constructionReserve: resourceAccount.constructionReserve,
            constructionPortfolio: nextConstructionPortfolio,
            meristemCadence: committedMeristemCadence,
            pendingForkIntent: nextPendingForkIntent,
            growthUnit: nextGrowthUnit,
            nodeSiteOccupiedByLateral: Boolean(lateralEmission),
            scaffoldFamilyGesture: frontier.scaffoldFamilyGesture,
            scaffoldFamilyDominanceClaim:
                frontier.scaffoldFamilyDominanceClaim,
            previousInternodeLength: runLength,
            forkDeferralCount: nextForkDeferralCount,
            nextForkAge: cadenceNextForkAge,
            episode,
            episodeAge: transitioned ? 1 : frontier.episodeAge + 1,
            temperament: frontier.temperament,
            formSide: frontier.formSide,
            sag: evolved.sag,
            readyAt: sequence + TIERS[frontier.tier].scheduleDelay
                / Math.max(0.55, frontier.vigor),
            nextTurnSign: frontier.nextTurnSign,
            successionTurnSign: frontier.successionTurnSign,
            successionKinkState: advanceSuccessionKinkState(
                frontier.successionKinkState,
                runLength,
            ),
            handoffRepeatCount: frontier.handoffRepeatCount,
            birthResourceShare: frontier.birthResourceShare,
            developmentalCapacity: frontier.developmentalCapacity,
            supportAllocation: committedDevelopmentState.supportInvestment,
            extensionAllocation: committedDevelopmentState.extensionDrive,
            reiterationPotential: clamp(
                committedDevelopmentState.reiterationReadiness,
                0.08,
                1,
            ),
            lateralMeristemReserve: Math.max(
                0,
                frontier.lateralMeristemReserve - (lateralMeristem?.reserveCost || 0),
            ),
            maturationState: forkDeferred
                ? (abortDeferredMeristem
                    ? 'aborted_fork_continuation'
                    : 'deferred_fork_extension')
                : (frontier.maturationState === 'resting_support_build'
                    ? 'regrowing_extension'
                    : frontier.maturationState),
            restUntilEvent: frontier.restUntilEvent,
            regrowthPulseCount: frontier.regrowthPulseCount
                + (frontier.maturationState === 'resting_support_build' ? 1 : 0),
            resourceReserve: resourceAccount.resourceReserve,
            maintenanceDebt: resourceAccount.maintenanceDebt,
            spatialExposure: resourceAccount.exposure,
            developmentState: committedDevelopmentState,
            completionFork: frontier.completionFork,
            horizontalRelease: frontier.horizontalRelease,
            cluster: frontier.cluster,
            reservedAtEvent: sequence,
            developmentalRole: frontier.developmentalRole,
            temporaryAxis: frontier.temporaryAxis,
            temporaryAxisStepLimit: frontier.temporaryAxisStepLimit,
        });
        const createdCorridorId = context.frontierCorridorIndex.get(nextFrontier.id);
        context.developmentReceipts.push(Object.freeze({
            kind: 'extension_maturation',
            sequence,
            frontierId: frontier.id,
            lineageId: frontier.lineageId,
            tier: frontier.tier,
            requestedDistalAttenuationScale: resourceAccount.maturation
                .attenuationField.effect.distalAttenuationScale,
            requestedLateralInvestmentScale: resourceAccount.maturation
                .lateralField.effect.lateralInvestmentScale,
            realizedLengthScale: resourceAccount.maturation.lengthScale,
            distalPressure: resourceAccount.maturation.distalPressure,
            coordinates: resourceAccount.maturation.coordinates,
            enabled: resourceAccount.maturation.enabled,
            developmentalTrajectory: resourceAccount.maturation.developmentalTrajectory,
            extensionDemand: resourceAccount.maturation.extensionDemand,
            transportSupply: resourceAccount.maturation.transportSupply,
            extensionSupplyRatio:
                resourceAccount.maturation.extensionSupplyRatio,
            continuousBalanceField: evolved.balanceField || null,
            continuousBalanceAuthority: evolved.balanceAuthority ?? 0,
            scaffoldFamilyDominance: resolveScaffoldFamilyDominance(
                frontier.scaffoldFamilyDominanceClaim,
            ),
            reiterationReadiness: resolveReiterationReadiness(nextFrontier),
            growthUnitBefore: consumedGrowthUnit,
            growthUnitAfterInternode: advancedGrowthUnit,
            growthUnitCommitted: nextGrowthUnit,
            apicalDifferentiation: resolveApicalDifferentiationState(
                nextFrontier,
            ),
            constructionPortfolioRenewed: Boolean(
                preAdvanceConstructionRenewal
                || renewedConstructionPortfolio,
            ),
            constructionPortfolioRenewalPhase: preAdvanceConstructionRenewal
                ? 'pre_advance_pending_fork'
                : (renewedConstructionPortfolio
                    ? 'post_advance_continuation'
                    : null),
            growthCycleBefore: Number(
                constructionPortfolioBeforePreAdvanceRenewal?.growthCycle || 0,
            ),
            growthCycleAfter: Number(nextConstructionPortfolio?.growthCycle || 0),
            nextAxisStepLimit: renewedAxisLimit,
            constructionCost: resourceAccount.constructionCost,
            constructionIncome: resourceAccount.constructionIncome,
            constructionReserve: resourceAccount.constructionReserve,
            familyFlow: resourceAccount.familyFlow,
            constructionAccount: constructionReceipt,
            developmentStateBefore: frontier.developmentState,
            developmentStateAfterInternode: evolvedDevelopmentState,
            developmentStateCommitted: committedDevelopmentState,
            lateralJunction: lateralEmission?.junctionPlan || null,
            meristemCadence: committedMeristemCadence,
            forkCadence,
            priorNextForkAge,
            cadenceNextForkAge: forkCadence?.cadenceNextForkAge ?? null,
            resolvedNextForkAge: cadenceNextForkAge,
            forkClockOwner: forkCadence?.clockOwner || 'prior_axis_schedule',
            forkClockResolution: forkCadence?.resolution || (
                forkDeferred
                    ? 'prior_axis_clock_deferred'
                    : 'prior_axis_clock_retained'
            ),
            forkDeferred,
            forkDeferralKind: options.crownBaseDeferred
                ? 'juvenile_crown_base_competence'
                : (forkPermissionDeferred
                    ? 'visible_scaffold_permission'
                    : (resourceForkDeferred ? 'physical_resource' : null)),
            forkIdentityIntent: pendingForkIntent,
            visibleScaffoldPermission: permissionDeferralReceipt,
            crownBaseCompetence: options.crownBaseCompetence || null,
            liveLateralPermission: liveLateralPermissionReceipt,
            pendingIntentCancelledByLateral,
            preAdvanceConstructionPortfolioBefore:
                preAdvanceConstructionRenewal
                    ? constructionPortfolioBeforePreAdvanceRenewal
                    : null,
            preAdvanceConstructionRenewal,
            abortDeferredMeristem,
        }));
        if (forkDeferred) {
            context.developmentReceipts.push(Object.freeze({
                kind: 'fork_deferral',
                sequence,
                frontierId: frontier.id,
                lineageId: frontier.lineageId,
                tier: frontier.tier,
                priorDeferralCount: frontier.forkDeferralCount,
                nextDeferralCount: nextForkDeferralCount,
                abortedMeristem: abortDeferredMeristem,
                resourceReserve: resourceAccount.resourceReserve,
                reiterationReserve: rounded(nextReiterationReserve),
                constructionReserve: resourceAccount.constructionReserve,
                forkIntentId: pendingForkIntent?.id || null,
                planHash: pendingForkIntent?.planHash || null,
                cadenceClaimId: pendingForkIntent?.cadenceClaimId || null,
                permissionReceiptId: permissionDeferralReceipt?.id || null,
                crownBaseCompetence: options.crownBaseCompetence || null,
                reason: options.crownBaseDeferred
                    ? 'juvenile_crown_base_competence_deferred'
                    : (forkPermissionDeferred
                        ? 'visible_scaffold_permission_deferred'
                        : 'physical_fork_infeasible'),
            }));
        }
        context.events.push(Object.freeze({
            id: idFor(context, 'event'),
            sequence,
            kind: 'advance',
            consumedFrontierId: frontier.id,
            createdNodeIds: Object.freeze([
                node.id,
                ...(lateralEmission ? [lateralEmission.nodeId] : []),
            ]),
            createdSegmentIds: Object.freeze([
                segment.id,
                ...(lateralEmission ? [lateralEmission.segmentId] : []),
            ]),
            createdFrontierIds: Object.freeze([
                nextFrontier.id,
                ...(lateralEmission ? [lateralEmission.frontierId] : []),
            ]),
            createdLateralMeristemIds: Object.freeze(lateralMeristem ? [lateralMeristem.id] : []),
            releasedCorridorIds: Object.freeze(
                releasedCorridorId ? [releasedCorridorId] : [],
            ),
            createdCorridorIds: Object.freeze(
                [
                    ...(createdCorridorId ? [createdCorridorId] : []),
                    ...(lateralEmission?.corridorId
                        ? [lateralEmission.corridorId]
                        : []),
                ],
            ),
            activeFrontierIdsAfter: activeSnapshot(context),
            activeCorridorIdsAfter: activeCorridorSnapshot(context),
            steering: Object.freeze({
                episodeId: episode.id,
                episodeKind: episode.kind,
                episodeTransitioned: transitioned,
                previousHeading: frontier.heading,
                realizedHeading: nextFrontier.heading,
                boundedTurnRadians: rounded(angularDistance(
                    frontier.heading,
                    nextFrontier.heading,
                )),
                sagAge: nextFrontier.sag.age,
                balanceField,
                prospectiveHorizon: selected.corridorPreview.horizon,
                corridorConflictScore: rounded(selected.corridorScore),
                selectedDepth: rounded(selected.direction.z),
                resourceAccount,
                extensionMaturation: resourceAccount.maturation,
                lateralEmission,
                visibleScaffoldPermission: liveLateralPermissionReceipt,
                forkIdentityIntent: pendingForkIntent,
                pendingIntentCancelledByLateral,
                preAdvanceConstructionRenewal,
            }),
        }));
        return Object.freeze({
            effectiveAction: 'advance_frontier',
            permissionReceipt: permissionDeferralReceipt,
            liveLateralPermissionReceipt,
            pendingIntentCancelledByLateral,
        });
    }

    function terminateEvent(context, frontier, sequence, reason) {
        const pendingForkIntent = frontier.pendingForkIntent || null;
        if (
            pendingForkIntent
            && !context.forkIdentityIntentReceipts.some((receipt) => (
                receipt.phase === 'cancelled'
                && receipt.sequence === sequence
                && receipt.forkIntentId === pendingForkIntent.id
            ))
        ) {
            context.forkIdentityIntentReceipts.push(Object.freeze({
                semantics: pendingForkIntent.semantics,
                phase: 'cancelled',
                sequence,
                forkIntentId: pendingForkIntent.id,
                planHash: pendingForkIntent.planHash,
                lineageId: frontier.lineageId,
                cadenceClaimId: pendingForkIntent.cadenceClaimId,
                reason: `aborted_with_axis:${reason}`,
            }));
        }
        context.growthUnitReceipts.push(createGrowthUnitReceipt(
            frontier.growthUnit,
            'terminalized',
            sequence,
            {
                endpointFate: pendingForkIntent
                    ? 'apical_intent_resource_terminalization'
                    : reason,
                reason,
                forkIntentId: pendingForkIntent?.id || null,
            },
        ));
        context.activeFrontierIds.delete(frontier.id);
        const releasedCorridorId = releaseFrontierCorridor(
            context,
            frontier.id,
            sequence,
        );
        const lineage = context.lineageIndex.get(frontier.lineageId);
        lineage.endEvent = sequence;
        lineage.endKind = reason;
        let juvenileAxisRetirement = null;
        if (frontier.temporaryAxis) {
            const ownedSegments = lineage.segmentIds
                .map((segmentId) => context.segments.find(
                    (segment) => segment.id === segmentId,
                ))
                .filter(Boolean);
            const totalLength = ownedSegments.reduce(
                (total, segment) => total + Number(segment.length || 0),
                0,
            );
            ownedSegments.forEach((segment) => {
                const start = nodeById(context, segment.fromNodeId)?.point;
                const end = nodeById(context, segment.toNodeId)?.point;
                if (start && end) retireSegmentMass(context, segment, start, end);
            });
            context.retiredLineageIds.add(lineage.id);
            const sourceMeristem = context.lateralMeristems.find(
                (meristem) => meristem.emissionLineageId === lineage.id,
            );
            if (sourceMeristem) sourceMeristem.retiredAtEvent = sequence;
            juvenileAxisRetirement = Object.freeze({
                semantics: JUVENILE_AXIS_RETIREMENT_SEMANTICS,
                lineageId: lineage.id,
                parentLineageId: lineage.parentLineageId,
                sourceMeristemId: sourceMeristem?.id || null,
                emittedAtEvent: Number(lineage.birthEvent || 0),
                retiredAtEvent: sequence,
                reason,
                segmentIds: Object.freeze(ownedSegments.map(
                    (segment) => segment.id,
                )),
                realizedInternodeCount: ownedSegments.length,
                totalLength: rounded(totalLength),
                cambialContribution: rounded(clamp(
                    totalLength
                        * Number(lineage.birthResourceShare || 0.14) / 140,
                    0.035,
                    0.18,
                )),
            });
            context.juvenileAxisRetirements.push(juvenileAxisRetirement);
            context.developmentReceipts.push(Object.freeze({
                kind: 'juvenile_axis_training_retirement',
                sequence,
                ...juvenileAxisRetirement,
            }));
        }
        context.events.push(Object.freeze({
            id: idFor(context, 'event'),
            sequence,
            kind: 'terminate',
            consumedFrontierId: frontier.id,
            reason,
            juvenileAxisRetirement,
            forkIdentityIntent: pendingForkIntent,
            createdNodeIds: Object.freeze([]),
            createdSegmentIds: Object.freeze([]),
            createdFrontierIds: Object.freeze([]),
            releasedCorridorIds: Object.freeze(
                releasedCorridorId ? [releasedCorridorId] : [],
            ),
            createdCorridorIds: Object.freeze([]),
            activeFrontierIdsAfter: activeSnapshot(context),
            activeCorridorIdsAfter: activeCorridorSnapshot(context),
        }));
    }

    function clusterSaturation(context, clusterId) {
        if (!clusterId) return 0;
        const cluster = context.clusterIndex.get(clusterId);
        if (!cluster) return 0;
        const residents = context.segments.filter(
            (segment) => segment.clusterId === clusterId,
        ).length;
        return residents / Math.max(1, cluster.capacity);
    }

    function recordProposalReceipt(
        context,
        proposal,
        coverageBefore,
        executionReceipt = null,
    ) {
        const event = context.events.at(-1);
        const coverageAfter = resolveCrownCompletionStatus(context);
        const lineageId = proposal.frontier?.lineageId || null;
        if (lineageId) context.lineageLastSelectedAt.set(lineageId, event.sequence);
        if (proposal.developmentalFamilyId) {
            context.familyLastSelectedAt.set(
                proposal.developmentalFamilyId,
                event.sequence,
            );
        }
        const clusterId = proposal.frontier?.clusterId || null;
        if (clusterId) {
            context.clusterSelectionCounts.set(
                clusterId,
                (context.clusterSelectionCounts.get(clusterId) || 0) + 1,
            );
        }
        context.proposalReceipts.push(Object.freeze({
            id: `selection-${String(context.proposalReceipts.length + 1).padStart(4, '0')}`,
            semantics: SCHEDULER_SEMANTICS,
            sequence: event.sequence,
            eventId: event.id,
            selectedProposalId: proposal.id,
            action: proposal.action,
            effectiveAction: executionReceipt?.effectiveAction
                || proposal.action,
            targetId: proposal.targetId,
            score: proposal.score,
            scoreBeforeLiveness: proposal.scoreBeforeLiveness,
            visibleScaffoldLiveness: proposal.visibleScaffoldLiveness,
            visibleScaffoldLivenessPressure:
                proposal.visibleScaffoldLivenessPressure,
            visibleScaffoldLivenessScoreBoost:
                proposal.visibleScaffoldLivenessScoreBoost,
            developmentalFamilyId: proposal.developmentalFamilyId,
            lineageCooldown: proposal.lineageCooldown,
            familyCooldown: proposal.familyCooldown,
            serviceAge: proposal.serviceAge,
            expectedServiceGap: proposal.expectedServiceGap,
            servicePressure: proposal.servicePressure,
            meristemEstablishmentLoad: proposal.meristemEstablishmentLoad,
            upperEstablishmentPressure: proposal.upperEstablishmentPressure,
            upperEstablishmentScoreBoost:
                proposal.upperEstablishmentScoreBoost,
            centerlineSelectionInfluence:
                proposal.centerlineSelectionInfluence,
            reasons: proposal.reasons,
            forkIntentId: proposal.options?.forkIntent?.id || null,
            forkIntentPlanHash:
                proposal.options?.forkIntent?.planHash || null,
            visibleScaffoldPermissionDecision:
                proposal.options?.visibleScaffoldPermission?.decision || null,
            visibleScaffoldPermissionEligible:
                proposal.options?.visibleScaffoldPermission?.eligible ?? null,
            crownBaseCompetence:
                proposal.options?.crownBaseCompetence || null,
            crownFormationRequired: Boolean(
                proposal.options?.crownFormationRequired,
            ),
            crownBaseDeferred: Boolean(proposal.options?.crownBaseDeferred),
            coverageBefore: Object.freeze({
                phase: coverageBefore.phase,
                structuralCost: coverageBefore.structuralCost,
                orderZeroForkDeficit: coverageBefore.orderZeroForkDeficit,
                structuralReleaseDeficit: coverageBefore.structuralReleaseDeficit,
                attachmentDeficit: coverageBefore.attachmentDeficit,
                bandDeficit: coverageBefore.bandDeficit,
                terminalLobeDeficit: coverageBefore.terminalLobeDeficit,
                terminalRamificationDeficit: coverageBefore.terminalRamificationDeficit,
            }),
            coverageAfter: Object.freeze({
                phase: coverageAfter.phase,
                structuralCost: coverageAfter.structuralCost,
                orderZeroForkDeficit: coverageAfter.orderZeroForkDeficit,
                structuralReleaseDeficit: coverageAfter.structuralReleaseDeficit,
                attachmentDeficit: coverageAfter.attachmentDeficit,
                bandDeficit: coverageAfter.bandDeficit,
                terminalLobeDeficit: coverageAfter.terminalLobeDeficit,
                terminalRamificationDeficit: coverageAfter.terminalRamificationDeficit,
            }),
        }));
    }

    function forkOpportunityDue(frontier) {
        const state = frontier.developmentState;
        const apicalDifferentiation = resolveApicalDifferentiationState(frontier);
        const pendingIntent = Boolean(
            frontier.pendingForkIntent
            || frontier.growthUnit?.pendingApicalIntentId,
        );
        const portfolioComplete = Boolean(
            frontier.constructionPortfolio
            && frontier.constructionPortfolio.cursor
                >= frontier.constructionPortfolio.plannedInternodeCount,
        );
        const differentiatedAtGrowthUnitEndpoint = Boolean(
            portfolioComplete
            && apicalDifferentiation.ready
            && !frontier.nodeSiteOccupiedByLateral,
        );
        return frontier.axisAge >= 3
            && !frontier.nodeSiteOccupiedByLateral
            && (
                pendingIntent
                || differentiatedAtGrowthUnitEndpoint
                || reiterationDue(frontier)
            )
            && Number(state?.terminalAffinity || 0) < 0.76
            && Number(state?.stressMemory || 0) < 0.82
            && (
                pendingIntent
                || differentiatedAtGrowthUnitEndpoint
                || frontier.axisAge >= frontier.nextForkAge
            );
    }

    function shouldFork(frontier) {
        if (frontier.temporaryAxis) return false;
        const apicalDifferentiation = resolveApicalDifferentiationState(frontier);
        const continuity = Number(
            frontier.developmentState?.apicalContinuity || 0,
        );
        const support = Number(
            frontier.developmentState?.supportInvestment || 0,
        );
        const minimumVigor = clamp(0.3 - continuity * 0.035, 0.24, 0.3);
        const minimumReserve = clamp(0.18 - support * 0.05, 0.11, 0.18);
        return forkOpportunityDue(frontier)
            && frontier.vigor >= minimumVigor
            && apicalDifferentiation.effectiveForkResource >= minimumReserve
            && Math.max(
                frontier.constructionReserve,
                apicalDifferentiation.reservedDescendantConstruction,
            ) >= 0.025;
    }

    function terminationReason(context, frontier) {
        if (
            frontier.temporaryAxis
            && frontier.axisAge >= Number(frontier.temporaryAxisStepLimit || 2)
        ) return 'juvenile_axis_training_retirement';
        const radiusProfile = resolveAxisRadiusProfile(frontier.developmentState);
        if (
            frontier.clusterId
            && Number(frontier.developmentState?.terminalAffinity || 0) >= 0.48
            && clusterSaturation(context, frontier.clusterId) >= 1
            && frontier.axisAge >= 2
        ) return 'terminal_cluster_capacity';
        if (frontier.radius < radiusProfile.minimumRadius * 0.46) {
            return 'radius_exhausted';
        }
        if (frontier.vigor < 0.27) return 'vigor_exhausted';
        const apicalDifferentiation = resolveApicalDifferentiationState(frontier);
        if (apicalDifferentiation.pending) {
            return apicalDifferentiation.physicallySupported
                ? null
                : 'apical_intent_resource_exhausted';
        }
        const constructionPlanComplete = Boolean(
            frontier.constructionPortfolio
            && frontier.constructionPortfolio.cursor
                >= frontier.constructionPortfolio.plannedInternodeCount
        );
        if (constructionPlanComplete) {
            return shouldFork(frontier)
                ? null
                : 'axis_construction_plan_complete';
        }
        if (!canConstructInternode(context, frontier)) {
            return 'construction_capacity_exhausted';
        }
        const minimumCompetitionAge = frontier.sag.active ? 6 : 4;
        const support = clamp(
            Number(frontier.developmentState?.supportInvestment || 0),
            0,
            1,
        );
        const continuity = clamp(
            Number(frontier.developmentState?.apicalContinuity || 0),
            0,
            1,
        );
        const constructionExhausted = frontier.constructionReserve
            < 0.12 - support * 0.04;
        const reachedMaturationHorizon = frontier.axisAge >= frontier.axisStepLimit;
        const maintenanceExhausted = constructionExhausted
            && reachedMaturationHorizon
            && frontier.axisAge >= minimumCompetitionAge
            && frontier.resourceReserve < 0.5 - support * 0.28
            && frontier.maintenanceDebt > 0.08 + continuity * 0.12;
        if (maintenanceExhausted) return 'maintenance_competition';
        if (
            frontier.cluster
            && Number(frontier.developmentState?.terminalAffinity || 0) >= 0.48
            && !frontier.sag.active
            && Number(frontier.developmentState?.reiterationCredit || 0) < 0.72
            && frontier.axisAge >= (frontier.completionFork ? 3 : 2)
        ) {
            const point = nodeById(context, frontier.nodeId)?.point;
            if (point) {
                const fromCenter = subtract(point, frontier.cluster.center);
                const centerDistance = magnitude(fromCenter);
                if (
                    centerDistance >= frontier.cluster.radius * 1.48
                    && dot(frontier.heading, normalize(fromCenter)) > 0.08
                ) return 'terminal_cluster_envelope';
            }
        }
        if (
            frontier.axisAge >= frontier.axisHardLimit
            && !shouldFork(frontier)
        ) return 'axis_episode_complete';
        return null;
    }

    function finalizeLineages(context) {
        return Object.freeze(context.lineages.map((lineage) => Object.freeze({
            ...lineage,
            segmentIds: Object.freeze([...lineage.segmentIds]),
        })));
    }

    function finalizeCorridors(context) {
        return Object.freeze(context.corridors.map((corridor) => Object.freeze({
            ...corridor,
            points: Object.freeze(corridor.points.map((point) => Object.freeze({
                ...point,
            }))),
        })));
    }

    function finalizeClusters(context) {
        return Object.freeze(context.clusters.map((cluster) => Object.freeze({
            ...cluster,
            center: Object.freeze({ ...cluster.center }),
        })));
    }

    function finalizeLateralMeristems(context) {
        return Object.freeze(context.lateralMeristems.map((meristem) => Object.freeze({
            ...meristem,
            parentHeading: Object.freeze({ ...meristem.parentHeading }),
        })));
    }

    function finalizeSplits(context) {
        const reforkSequence = new Map();
        context.events.filter((event) => event.kind === 'fork').forEach((event) => {
            const consumed = frontierById(context, event.consumedFrontierId);
            if (consumed) reforkSequence.set(consumed.lineageId, event.sequence);
        });
        return Object.freeze(context.rawSplits.map((split) => Object.freeze({
            ...split,
            resourceShares: Object.freeze([...split.resourceShares]),
            growthAllocationShares: Object.freeze([...split.growthAllocationShares]),
            supportAllocationShares: Object.freeze([...split.supportAllocationShares]),
            reiterationAllocationShares: Object.freeze([
                ...split.reiterationAllocationShares,
            ]),
            angleShares: Object.freeze([...split.angleShares]),
            children: Object.freeze(split.children.map((child) => Object.freeze({
                ...child,
                laterReforked: reforkSequence.has(child.lineageId),
                laterReforkSequence: reforkSequence.get(child.lineageId) ?? null,
            }))),
        })));
    }

    const {
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
    } = crownState.createOwner({
        idFor,
        nodeById,
        frontierById,
        heightBandFor,
    });

    const {
        axisCoherenceCone,
        stabilizeAxisIntent,
        resolveEpisodeIntent,
        createEpisode,
        createRootEpisode,
        createChildEpisode,
        recommitEpisode,
        resolveFirstForkPlan,
        resolveFirstForkAge,
        resolveNextForkPlan,
        resolveNextForkAge,
    } = axisEpisodes.createOwner({
        idFor,
        nodeById,
        resolveFutureBalanceField,
        resolveCrownCompletionStatus,
        clusterTargetFor,
    });

    const {
        sagGravityWeight,
        prospectiveCorridorPreview,
        corridorConflictScore,
        reserveFrontierCorridor,
        releaseFrontierCorridor,
        occupancyScore,
        crownDepthEnvelopePenalty,
        selectAdvanceDirection,
    } = spatialField.createOwner({
        idFor,
        nodeById,
        stabilizeAxisIntent,
        clusterAttractionScore,
    });

    const {
        resolveForkReferenceFrame,
        selectForkDirection,
        resolveForkSidePlan,
        resolveNextHandoffPlan,
        resolveChildReiterationForecasts,
        resolveChildReiterationReserves,
        prospectiveExtent,
    } = forkDevelopmentField.createOwner({
        resolveFutureBalanceField,
        resolveCrownCompletionStatus,
        prospectiveCorridorPreview,
        occupancyScore,
        corridorConflictScore,
        crownDepthEnvelopePenalty,
        clusterAttractionScore,
    });

    const {
        projectForkDirections,
        constrainOrderZeroForkDirection,
        observeSiblingSeparation,
        reconcileSiblingSeparation,
    } = forkDirectionProjector;

    const {
        prepareForkIdentityIntent,
        reserveForkIdentityIntent,
        forkEvent,
    } = forkTransaction.createOwner({
        idFor,
        nodeById,
        resolveForkReferenceFrame,
        selectForkDirection,
        resolveForkSidePlan,
        resolveNextHandoffPlan,
        resolveChildReiterationForecasts,
        resolveChildReiterationReserves,
        prospectiveExtent,
        projectForkDirections,
        constrainOrderZeroForkDirection,
        observeSiblingSeparation,
        reconcileSiblingSeparation,
        prospectiveCorridorPreview,
        corridorConflictScore,
        releaseFrontierCorridor,
        resolveChildCluster,
        createChildEpisode,
        segmentRunLength,
        createLineage,
        addNode,
        addSegment,
        resolveNextForkPlan,
        resolveAxisPersistencePlan,
        resolveSecondaryAxisMaturation,
        addFrontier,
        activeSnapshot,
        activeCorridorSnapshot,
        settleNodeForStructuralFork,
        resolveFutureBalanceField,
        createScaffoldFamilyGesture,
        resolveCrownBirthOpportunity,
    });

    const {
        createLateralMeristem,
        emitLateralAxis,
    } = terminalRamification.createOwner({
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
        resolveNextForkAge,
        addFrontier,
        activeSnapshot,
        activeCorridorSnapshot,
        registerLateralMeristemPotential,
        commitLateralMeristemEmission,
        shouldFork,
    });

    const {
        buildDevelopmentalProposalQueue,
    } = proposalScheduler.createOwner({
        idFor,
        nodeById,
        frontierById,
        resolveCrownCompletionStatus,
        clusterSaturation,
        shouldFork,
        terminationReason,
        prepareForkIdentityIntent,
        resolveVisibleScaffoldReleasePermission,
    });

    function numericOption(options, key, fallback, minimum, maximum) {
        if (options[key] === undefined) return fallback;
        const value = Number(options[key]);
        if (!Number.isFinite(value)) {
            throw new TypeError(`[G15.4_MASS] ${key} must be finite.`);
        }
        return clamp(value, minimum, maximum);
    }

    function generate(options = {}) {
        const seed = Number(options.seed ?? 150031);
        if (!Number.isSafeInteger(seed)) {
            throw new TypeError('[G15.4_MASS] seed must be a safe integer.');
        }
        const presetId = String(options.preset || 'natural');
        const formId = String(options.form || 'central_recursive_meander');
        const traitId = String(options.trait || 'balanced_natural');
        const preset = PRESETS[presetId];
        const form = FORM_PROGRAMS[formId];
        const trait = TRAIT_PROGRAMS[traitId];
        if (!preset) throw new RangeError(`[G15.4_MASS] Unknown preset: ${presetId}`);
        if (!form) throw new RangeError(`[G15.4_MASS] Unknown form: ${formId}`);
        if (!trait) throw new RangeError(`[G15.4_MASS] Unknown trait: ${traitId}`);
        const density = numericOption(options, 'density', 1, 0.55, 1.4);
        const vigor = numericOption(options, 'vigor', 1, 0.72, 1.24);
        const corridorStrength = numericOption(
            options,
            'corridorStrength',
            1,
            0,
            1.35,
        );
        const presetEventBudget = Math.round(numericOption(
            options,
            'maximumEvents',
            160,
            32,
            240,
        ) * preset.eventScale);
        if (options.eventBudget !== undefined && (
            !Number.isInteger(options.eventBudget)
            || options.eventBudget < 2 || options.eventBudget > 240
        )) {
            throw new RangeError('[G15.4_MASS] eventBudget must be an integer from 2 to 240.');
        }
        const maximumEvents = options.eventBudget === undefined
            ? presetEventBudget : options.eventBudget;
        const rng = new AxisRng(seed);
        const phenotype = createPhenotype(seed, form, trait, rng);
        const strategy = createDevelopmentalStrategy(seed, options.strategy);
        const researchControls = resolveResearchControls(
            options.researchControls === undefined
                ? {}
                : options.researchControls,
        );
        const architectureControls = resolveArchitectureControls(
            options.architectureControls === undefined
                ? {}
                : options.architectureControls,
        );
        const forkAreaGain = numericOption(
            options,
            'forkAreaGain',
            phenotype.areaGain,
            1,
            1.08,
        );
        const context = createContext({
            seed,
            presetId,
            formId,
            traitId,
            preset,
            form,
            trait,
            density,
            vigor,
            corridorStrength,
            maximumEvents,
            rng,
            phenotype,
            strategy,
            researchControls,
            architectureControls,
            forkAreaGain,
        });
        createRoot(context);
        while (
            context.activeFrontierIds.size
            && context.events.length < maximumEvents
        ) {
            // Completion owns only the specimen-level stop decision. It may
            // neither extend, terminate, nor change the action of a local axis.
            if (resolveCrownCompletionStatus(context).settled) break;
            const queue = buildDevelopmentalProposalQueue(context);
            const proposal = queue[0];
            const sequence = context.events.length;
            if (!proposal) break;
            const coverageBefore = resolveCrownCompletionStatus(context);
            let selectedProposal = proposal;
            const proposedForkIntent = proposal.options?.forkIntent || null;
            if (proposedForkIntent) {
                const reservedForkIntent = reserveForkIdentityIntent(
                    context,
                    proposedForkIntent,
                    sequence,
                );
                if (!context.forkIdentityIntentReceipts.some((receipt) => (
                    receipt.phase === 'initiated'
                    && receipt.forkIntentId === reservedForkIntent.id
                ))) {
                    context.forkIdentityIntentReceipts.push(Object.freeze({
                        semantics: reservedForkIntent.semantics,
                        phase: 'initiated',
                        sequence,
                        forkIntentId: reservedForkIntent.id,
                        planHash: reservedForkIntent.planHash,
                        lineageId: reservedForkIntent.preparedAtLineageId,
                        preparedAtFrontierId:
                            reservedForkIntent.preparedAtFrontierId,
                        preparedAtAxisAge:
                            reservedForkIntent.preparedAtAxisAge,
                        cadenceClaimId: reservedForkIntent.cadenceClaimId,
                        visibleScaffoldReleasePlanned:
                            reservedForkIntent.visibleScaffoldReleasePlanned,
                        signature: reservedForkIntent.signature,
                        rngDrawCount: reservedForkIntent.rngDrawCount,
                    }));
                }
                selectedProposal = Object.freeze({
                    ...proposal,
                    options: Object.freeze({
                        ...proposal.options,
                        forkIntent: reservedForkIntent,
                    }),
                });
            }
            let executionReceipt = null;
            if (selectedProposal.action === 'fork_frontier') {
                forkEvent(
                    context,
                    selectedProposal.frontier,
                    sequence,
                    selectedProposal.options || {},
                );
                const committedIntent = selectedProposal.options?.forkIntent;
                context.growthUnitReceipts.push(createGrowthUnitReceipt(
                    selectedProposal.frontier.growthUnit,
                    'completed',
                    sequence,
                    {
                        endpointFate: 'apical_fork_committed',
                        forkIntentId: committedIntent?.id || null,
                    },
                ));
                if (committedIntent) {
                    context.forkIdentityIntentReceipts.push(Object.freeze({
                        semantics: committedIntent.semantics,
                        phase: 'committed',
                        sequence,
                        forkIntentId: committedIntent.id,
                        planHash: committedIntent.planHash,
                        lineageId: selectedProposal.frontier.lineageId,
                        cadenceClaimId: committedIntent.cadenceClaimId,
                        visibleScaffoldReleasePlanned:
                            committedIntent.visibleScaffoldReleasePlanned,
                    }));
                }
                executionReceipt = Object.freeze({
                    effectiveAction: 'fork_frontier',
                });
            } else if (selectedProposal.action === 'terminate_frontier') {
                terminateEvent(
                    context,
                    selectedProposal.frontier,
                    sequence,
                    selectedProposal.options.reason,
                );
                executionReceipt = Object.freeze({
                    effectiveAction: 'terminate_frontier',
                });
            } else if (selectedProposal.action === 'advance_frontier') {
                executionReceipt = advanceEvent(
                    context,
                    selectedProposal.frontier,
                    sequence,
                    selectedProposal.options || {},
                );
            } else {
                throw new Error(`[G15.4_SCHEDULER] Unknown proposal action: ${selectedProposal.action}`);
            }
            recordProposalReceipt(
                context,
                selectedProposal,
                coverageBefore,
                executionReceipt,
            );
        }
        const lineages = finalizeLineages(context);
        const corridors = finalizeCorridors(context);
        const clusters = finalizeClusters(context);
        const lateralMeristems = finalizeLateralMeristems(context);
        const nodeMeristemSites = finalizeNodeMeristemSites(context);
        const splits = finalizeSplits(context);
        const finalBalanceField = resolveFutureBalanceField(context);
        const completionStatus = resolveCrownCompletionStatus(context);
        const resolvedOrderZeroSupport = resolveOrderZeroSupport(context);
        const graph = {
            contract: Object.freeze({
                id: CONTRACT_ID,
                modelId: MODEL_ID,
                forkSemantics: FORK_SEMANTICS,
                resourceSemantics: RESOURCE_SEMANTICS,
                angleSemantics: ANGLE_SEMANTICS,
                episodeSemantics: EPISODE_SEMANTICS,
                phenotypeSemantics: PHENOTYPE_SEMANTICS,
                strategySemantics: STRATEGY_SEMANTICS,
                strategyBasisSemantics: BASIS_SEMANTICS,
                occupancySemantics: OCCUPANCY_SEMANTICS,
                resourceEconomySemantics: RESOURCE_ECONOMY_SEMANTICS,
                constructionAccountSemantics:
                    'soft_supply_demand_construction_account_v3',
                constructionPortfolioSemantics:
                    'phyllotactic_continuous_axis_portfolio_v10',
                axisDevelopmentStateSemantics: AXIS_DEVELOPMENT_STATE_SEMANTICS,
                ontogenySemantics: ONTOGENY_SEMANTICS,
                crownBaseCompetenceSemantics:
                    CROWN_BASE_COMPETENCE_SEMANTICS,
                secondaryWoodGrowthSemantics:
                    SECONDARY_WOOD_GROWTH_SEMANTICS,
                juvenileShootOpportunitySemantics:
                    JUVENILE_SHOOT_OPPORTUNITY_SEMANTICS,
                juvenileAxisRetirementSemantics:
                    JUVENILE_AXIS_RETIREMENT_SEMANTICS,
                meristemCadenceSemantics: MERISTEM_CADENCE_SEMANTICS,
                visibleScaffoldPermissionSemantics:
                    VISIBLE_SCAFFOLD_PERMISSION_SEMANTICS,
                visibleScaffoldLivenessSemantics:
                    VISIBLE_SCAFFOLD_LIVENESS_SEMANTICS,
                liveLateralFeasibilitySemantics:
                    LIVE_LATERAL_FEASIBILITY_SEMANTICS,
                growthUnitSemantics: GROWTH_UNIT_SEMANTICS,
                growthUnitReceiptSemantics: GROWTH_UNIT_RECEIPT_SEMANTICS,
                apicalDifferentiationSemantics:
                    APICAL_DIFFERENTIATION_SEMANTICS,
                visibleScaffoldLivenessMaximumScoreBoost:
                    VISIBLE_SCAFFOLD_LIVENESS_MAXIMUM_SCORE_BOOST,
                visibleScaffoldDeferredServicePolicy:
                    'preserve_due_fork_priority_while_permission_defers_mutation',
                forkIdentityIntentSemantics:
                    FORK_IDENTITY_INTENT_SEMANTICS,
                childDevelopmentBudgetSemantics:
                    'absolute_family_capacity_composition_v4',
                resourceContrastDampingSemantics:
                    RESOURCE_CONTRAST_DAMPING_SEMANTICS,
                forkFlowDirectionSemantics:
                    FORK_FLOW_DIRECTION_SEMANTICS,
                tierArchitectureSemantics: TIER_ARCHITECTURE_SEMANTICS,
                structuralStationSemantics: STRUCTURAL_STATION_SEMANTICS,
                scaffoldStationTrajectorySemantics:
                    STATION_TRAJECTORY_SEMANTICS,
                relativeDifferentiationSemantics:
                    RELATIVE_DIFFERENTIATION_SEMANTICS,
                crownArchitectureControlSemantics:
                    CROWN_ARCHITECTURE_CONTROL_SEMANTICS,
                crownArchitectureProfileSemantics:
                    CROWN_ARCHITECTURE_PROFILE_SEMANTICS,
                structuralReleaseCadenceOwnership:
                    'conserved_visible_order_zero_family_claim',
                structuralReleaseMutationOwners:
                    'visible_order_one_fork_or_live_lateral_commit_only',
                familyResourceFlowSemantics:
                    'conserved_parent_lineage_assimilate_flow_v1',
                lateralJunctionSemantics: LATERAL_JUNCTION_SEMANTICS,
                clusterSemantics: CLUSTER_SEMANTICS,
                balanceSemantics: BALANCE_SEMANTICS,
                crownInteriorExposureSemantics:
                    CROWN_INTERIOR_EXPOSURE_SEMANTICS,
                crownCompositionSemantics: CROWN_COMPOSITION_SEMANTICS,
                scaffoldFamilyGestureSemantics:
                    SCAFFOLD_FAMILY_GESTURE_SEMANTICS,
                crownBirthOpportunitySemantics:
                    CROWN_BIRTH_OPPORTUNITY_SEMANTICS,
                scaffoldFamilyDominanceSemantics:
                    SCAFFOLD_FAMILY_DOMINANCE_SEMANTICS,
                completionSemantics: COMPLETION_SEMANTICS,
                axisSuccessionSemantics: AXIS_SUCCESSION_SEMANTICS,
                orderZeroSupportSemantics: ORDER_ZERO_SUPPORT_SEMANTICS,
                orderZeroSupportMaximumLeanDegrees:
                    preset.orderZeroSupport?.maximumLeanDegrees ?? null,
                orderZeroSupportResolvedMaximumLeanDegrees:
                    resolvedOrderZeroSupport
                        ? rounded(
                            resolvedOrderZeroSupport.maximumLeanRadians
                                * 180 / Math.PI,
                            5,
                        )
                        : null,
                orderZeroSupportCodominantSpreadShiftDegrees:
                    resolvedOrderZeroSupport?.codominantSpreadShiftDegrees ?? null,
                orderZeroSupportContinuationTurnDegrees:
                    preset.orderZeroSupport?.continuationTurnDegrees ?? null,
                orderZeroSupportCodominantTurnDegrees:
                    preset.orderZeroSupport?.codominantTurnDegrees ?? null,
                orderZeroSupportMinimumHorizontalDominance:
                    preset.orderZeroSupport?.minimumHorizontalDominance ?? null,
                lateralMeristemSemantics: LATERAL_MERISTEM_SEMANTICS,
                schedulerSemantics: SCHEDULER_SEMANTICS,
                axisLifecycleSemantics: AXIS_LIFECYCLE_SEMANTICS,
                forkPotentialSemantics: FORK_POTENTIAL_SEMANTICS,
                successionKinkSemantics: SUCCESSION_KINK_SEMANTICS,
                successionKinkStateSemantics: SUCCESSION_KINK_STATE_SEMANTICS,
                strategyRegimeSemantics: REGIME_SEMANTICS,
                developmentalTrajectorySemantics: DEVELOPMENTAL_TRAJECTORY_SEMANTICS,
                nodeMeristemSemantics: MERISTEM_SEMANTICS,
                lineageResponseSemantics: LINEAGE_RESPONSE_SEMANTICS,
                axisOrderSemantics: AXIS_ORDER_SEMANTICS,
                axisOrderAuthority: 'role_authoritative_three_tier',
                developmentalFamilyScheduling:
                    'ageing_root_child_family_recovery_without_topology_outcome_authority',
                orderZeroSupportMode:
                    'preset_guard_with_seed_conditioned_codominant_spread',
                birthModeSemantics: BIRTH_MODE_SEMANTICS,
                topology: 'recursive_axis_tree',
                schedulerOwnsForkShape: false,
                schedulerOwnsAxisOutcome: false,
                completionAuthority: 'global_stop_only',
                structuralAxisBirth:
                    'atomic_fork_or_live_lateral_or_temporary_juvenile_emission',
                nodeGeometryAuthority:
                    'one_joint_area_moment_apical_lateral_transaction_per_node',
                lateralEmissionScope:
                    'inherited_arc_readiness_live_node_emission_with_descriptive_order',
                persistentCenterSpine: false,
                precomputedRoute: false,
                productEligible: false,
            }),
            seed,
            preset: presetId,
            form: formId,
            trait: traitId,
            density,
            vigor,
            corridorStrength,
            forkAreaGain,
            phenotype,
            specimenPhenotype: phenotype,
            strategy,
            researchControls,
            architectureControls,
            strategyReceipts: Object.freeze([...context.strategyReceipts]),
            developmentReceipts: Object.freeze([...context.developmentReceipts]),
            familyResourceReceipts: Object.freeze([
                ...context.familyResourceReceipts,
            ]),
            familyResourceLedgers: Object.freeze([
                ...context.familyResourceLedgers.entries(),
            ].map(([lineageId, constructionReserve]) => Object.freeze({
                lineageId,
                constructionReserve: rounded(constructionReserve),
            }))),
            nodes: Object.freeze(context.nodes),
            segments: Object.freeze(context.segments),
            frontiers: Object.freeze(context.frontiers),
            lineages,
            events: Object.freeze(context.events),
            occupancy: Object.freeze(context.occupancy),
            corridors,
            clusters,
            lateralMeristems,
            nodeMeristemSites,
            proposalReceipts: Object.freeze([...context.proposalReceipts]),
            forkIdentityIntentReceipts: Object.freeze([
                ...context.forkIdentityIntentReceipts,
            ]),
            visibleScaffoldPermissionReceipts: Object.freeze([
                ...context.visibleScaffoldPermissionReceipts,
            ]),
            growthUnitReceipts: Object.freeze([
                ...context.growthUnitReceipts,
            ]),
            juvenileAxisRetirements: Object.freeze([
                ...context.juvenileAxisRetirements,
            ]),
            splits,
            balanceField: finalBalanceField,
            completionStatus,
            tierNames: TIER_NAMES,
            axisOrderNames: AXIS_ORDER_NAMES,
        };
        const failures = validateGraph(graph);
        if (failures.length) {
            throw new Error(`[G15.4_MASS] Invalid recursive graph: ${failures.join(', ')}`);
        }
        const completed = {
            ...graph,
            diagnostics: buildDiagnostics(graph),
        };
        return Object.freeze(completed);
    }

    scope.ZenBonsaiTypedDevelopmentalSchedulerKernel = Object.freeze({
        modelId: MODEL_ID,
        contractId: CONTRACT_ID,
        presets: PRESETS,
        forms: FORM_PROGRAMS,
        traits: TRAIT_PROGRAMS,
        strategyAxes: STRATEGY_AXES,
        strategyBasis: BASIS_CATALOG,
        architectureControlDefinitions:
            CROWN_ARCHITECTURE_CONTROL_DEFINITIONS,
        tierNames: TIER_NAMES,
        axisOrderNames: AXIS_ORDER_NAMES,
        generate,
        validate: validateGraph,
        research: Object.freeze({
            strategyAxisIds: STRATEGY_AXIS_IDS,
            createDevelopmentalStrategy,
            angularDistance,
            resourceSemantics: RESOURCE_SEMANTICS,
            angleSemantics: ANGLE_SEMANTICS,
            episodeSemantics: EPISODE_SEMANTICS,
            occupancySemantics: OCCUPANCY_SEMANTICS,
            resourceEconomySemantics: RESOURCE_ECONOMY_SEMANTICS,
            axisDevelopmentStateSemantics: AXIS_DEVELOPMENT_STATE_SEMANTICS,
            ontogenySemantics: ONTOGENY_SEMANTICS,
            crownBaseCompetenceSemantics:
                CROWN_BASE_COMPETENCE_SEMANTICS,
            secondaryWoodGrowthSemantics:
                SECONDARY_WOOD_GROWTH_SEMANTICS,
            meristemCadenceSemantics: MERISTEM_CADENCE_SEMANTICS,
            visibleScaffoldPermissionSemantics:
                VISIBLE_SCAFFOLD_PERMISSION_SEMANTICS,
            visibleScaffoldLivenessSemantics:
                VISIBLE_SCAFFOLD_LIVENESS_SEMANTICS,
            liveLateralFeasibilitySemantics:
                LIVE_LATERAL_FEASIBILITY_SEMANTICS,
            visibleScaffoldLivenessMaximumScoreBoost:
                VISIBLE_SCAFFOLD_LIVENESS_MAXIMUM_SCORE_BOOST,
            visibleScaffoldDeferredServicePolicy:
                'preserve_due_fork_priority_while_permission_defers_mutation',
            resolveVisibleScaffoldLivenessPressure,
            forkIdentityIntentSemantics: FORK_IDENTITY_INTENT_SEMANTICS,
            childDevelopmentBudgetSemantics:
                'absolute_family_capacity_composition_v4',
            tierArchitectureSemantics: TIER_ARCHITECTURE_SEMANTICS,
            structuralStationSemantics: STRUCTURAL_STATION_SEMANTICS,
            scaffoldStationTrajectorySemantics:
                STATION_TRAJECTORY_SEMANTICS,
            relativeDifferentiationSemantics:
                RELATIVE_DIFFERENTIATION_SEMANTICS,
            crownArchitectureControlSemantics:
                CROWN_ARCHITECTURE_CONTROL_SEMANTICS,
            crownArchitectureProfileSemantics:
                CROWN_ARCHITECTURE_PROFILE_SEMANTICS,
            crownArchitectureControlDefinitions:
                CROWN_ARCHITECTURE_CONTROL_DEFINITIONS,
            resolveCrownArchitectureProfile,
            lateralJunctionSemantics: LATERAL_JUNCTION_SEMANTICS,
            clusterSemantics: CLUSTER_SEMANTICS,
            balanceSemantics: BALANCE_SEMANTICS,
            crownInteriorExposureSemantics:
                CROWN_INTERIOR_EXPOSURE_SEMANTICS,
            crownCompositionSemantics: CROWN_COMPOSITION_SEMANTICS,
            scaffoldFamilyGestureSemantics:
                SCAFFOLD_FAMILY_GESTURE_SEMANTICS,
            crownBirthOpportunitySemantics:
                CROWN_BIRTH_OPPORTUNITY_SEMANTICS,
            scaffoldFamilyDominanceSemantics:
                SCAFFOLD_FAMILY_DOMINANCE_SEMANTICS,
            resolveScaffoldFamilyDominance,
            resolveReiterationReadiness,
            completionSemantics: COMPLETION_SEMANTICS,
            axisSuccessionSemantics: AXIS_SUCCESSION_SEMANTICS,
            orderZeroSupportSemantics: ORDER_ZERO_SUPPORT_SEMANTICS,
            axisLifecycleSemantics: AXIS_LIFECYCLE_SEMANTICS,
            forkPotentialSemantics: FORK_POTENTIAL_SEMANTICS,
            nodeMeristemSemantics: MERISTEM_SEMANTICS,
            lineageResponseSemantics: LINEAGE_RESPONSE_SEMANTICS,
            axisOrderSemantics: AXIS_ORDER_SEMANTICS,
            birthModeSemantics: BIRTH_MODE_SEMANTICS,
            resolveChildReiterationForecasts,
            resolveChildReiterationReserves,
            resolveBinaryForkOffsets: binaryOffsets,
        }),
    });
}(globalThis));
