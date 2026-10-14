/**
 * G15.4 atomic fork transaction owner.
 *
 * One fork consumes one live frontier and atomically commits an already
 * proposed and projected two/three-child developmental event. It owns graph
 * mutation and receipts, not fork-field policy or direction projection.
 */
(function installTypedDevelopmentalForkTransaction(scope) {
    'use strict';

    const programs = scope.ZenBonsaiTypedDevelopmentalSchedulerPrograms;
    const forkLaw = scope.ZenBonsaiTypedDevelopmentalSchedulerResourceForkLaw;
    const childBudgetOwner = scope.ZenBonsaiTypedDevelopmentalSchedulerChildBudget;
    const successionKinkField = scope
        .ZenBonsaiTypedDevelopmentalSchedulerSuccessionKinkField;
    const trajectoryField = scope.ZenBonsaiTypedDevelopmentalSchedulerTrajectoryField;
    const constructionAccount = scope
        .ZenBonsaiTypedDevelopmentalSchedulerConstructionAccount;
    const axisStateOwner = scope.ZenBonsaiTypedDevelopmentalSchedulerAxisState;
    const meristemCadenceOwner = scope
        .ZenBonsaiTypedDevelopmentalSchedulerMeristemCadence;
    const tierArchitectureOwner = scope
        .ZenBonsaiTypedDevelopmentalSchedulerTierArchitecture;
    if (
        !programs
        || !forkLaw
        || !childBudgetOwner
        || !successionKinkField
        || !trajectoryField
        || !constructionAccount
        || !axisStateOwner
        || !meristemCadenceOwner
        || !tierArchitectureOwner
    ) {
        throw new Error(
            '[G15.4_FORK] programs, fork-law, child-budget, construction-account, axis-state, meristem-cadence, tier-architecture, succession-kink, and trajectory owners must load first.',
        );
    }
    const {
        AxisRng,
        TIER_NAMES,
        TIERS,
        ANGLE_SEMANTICS,
        clamp,
        add,
        subtract,
        scale,
        distance,
        dot,
        normalize,
        pointAt,
        rotateGrowthPlane,
        tiltDepth,
        angularDistance,
        signedPlanarAngle,
        rounded,
        inheritTemperament,
        createSiblingLineageResponses,
        resolveCrownRadius,
        resolveRadialDistance,
        createScaffoldFamilyDominanceClaim,
        inheritScaffoldFamilyDominanceClaim,
        resolveScaffoldFamilyDominance,
    } = programs;
    const {
        RESOURCE_CONTRAST_DAMPING_SEMANTICS,
        FORK_FLOW_DIRECTION_SEMANTICS,
        createResourceShares,
        createCompletionShares,
        resolveResourceContrastProfile,
        resolveForkFlowDirectionPlan,
        resolveProjectedLoadAnglePlan,
        chooseForkArity,
        resolveForkAperturePlan,
        resolveSupportedForkPlan,
        resolveHorizontalReleasePlan,
        resolveForkArchetype,
        resolveJunctionLedger,
    } = forkLaw;
    const { createChildDevelopmentBudget } = childBudgetOwner;
    const {
        resolveSuccessionKinkPlan,
        applySuccessionKinkDirection,
        constrainSuccessionKinkDirection,
        deriveChildSuccessionKinkState,
    } = successionKinkField;
    const { evaluateDevelopmentalTrajectory } = trajectoryField;
    const {
        createAxisConstructionPortfolio,
        resolveInternodeConstruction,
    } = constructionAccount;
    const {
        createChildDevelopmentState,
        resolveAxisRadiusProfile,
    } = axisStateOwner;
    const {
        createJunctionCadence,
        resolveVisibleScaffoldReleasePermission,
        resolveCrownBaseCompetence,
    } = meristemCadenceOwner;
    const { resolveTierZeroStructuralStation } = tierArchitectureOwner;

    const FORK_IDENTITY_INTENT_SEMANTICS =
        'immutable_fork_identity_intent_v2';

    function hashText(value) {
        const source = String(value);
        let hash = 2166136261;
        for (let index = 0; index < source.length; index += 1) {
            hash ^= source.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(16).padStart(8, '0');
    }

    function identitySignature(frontier, shares, decisions, completionFork) {
        return Object.freeze({
            parentAxisOrder: Number(frontier.axisOrder ?? frontier.tier ?? 0),
            arity: shares.length,
            orderedResourceShares: Object.freeze(shares.map(
                (share) => rounded(share),
            )),
            childAxisOrders: Object.freeze(decisions.map(
                (decision) => Number(decision.axisOrder),
            )),
            orderRetention: Object.freeze(decisions.map(
                (decision) => Boolean(decision.orderRetained),
            )),
            identityResponsibilities: Object.freeze(decisions.map(
                (decision) => rounded(decision.identityResponsibility),
            )),
            identityThresholds: Object.freeze(decisions.map(
                (decision) => rounded(decision.identityThreshold),
            )),
            completionFork: Boolean(completionFork),
        });
    }

    function prepareForkIdentityIntent(context, frontier, sequence, options = {}) {
        const completionFork = Boolean(options.completionFork);
        const arity = options.arity
            ?? (completionFork ? 2 : chooseForkArity(context, frontier));
        const rngStateBefore = Number(context.rng?.state >>> 0);
        const rngSamples = [];
        // AxisRng treats constructor seed 0 as a request for its default seed.
        // A preview is an exact state clone, so assign the captured uint32 state
        // explicitly and keep even the rare zero state replayable.
        const previewRng = new AxisRng(1);
        previewRng.state = rngStateBefore;
        const previewContext = {
            ...context,
            rng: {
                next() {
                    const sample = previewRng.next();
                    rngSamples.push(sample);
                    return sample;
                },
            },
        };
        const shares = options.shares
            ? Object.freeze([...options.shares])
            : (completionFork
                ? createCompletionShares(previewContext, frontier)
                : createResourceShares(previewContext, frontier, arity));
        const resourceContrastProfile = resolveResourceContrastProfile(
            context,
            frontier,
        );
        const flowDirectionPlan = resolveForkFlowDirectionPlan(
            frontier,
            arity,
        );
        const preparedBudget = createChildDevelopmentBudget(
            context,
            frontier,
            shares,
        );
        const decisions = Object.freeze([...preparedBudget.decisions]);
        const signature = identitySignature(
            frontier,
            shares,
            decisions,
            completionFork,
        );
        const parentAxisOrder = Number(frontier.axisOrder ?? frontier.tier ?? 0);
        const visibleScaffoldReleasePlanned = parentAxisOrder === 0
            && decisions.some((decision) => Number(decision.axisOrder) > 0);
        const cadenceClaimId = visibleScaffoldReleasePlanned
            ? frontier.meristemCadence?.claimId ?? null
            : null;
        const planHash = `fork-plan-${hashText(JSON.stringify({
            lineageId: frontier.lineageId,
            cadenceClaimId,
            signature,
            resourceContrastDamping: resourceContrastProfile.damping,
            flowDirectionWeights: flowDirectionPlan.weights,
        }))}`;
        return Object.freeze({
            semantics: FORK_IDENTITY_INTENT_SEMANTICS,
            id: `fork-intent:${frontier.lineageId}:${sequence}:${planHash}`,
            planHash,
            phase: 'prepared_before_graph_mutation',
            preparedAtSequence: Number(sequence),
            preparedAtFrontierId: frontier.id,
            preparedAtLineageId: frontier.lineageId,
            preparedAtAxisAge: Number(frontier.axisAge || 0),
            parentAxisOrder,
            arity,
            orderedResourceShares: shares,
            resourceContrastProfile,
            flowDirectionPlan,
            identityDecisions: decisions,
            signature,
            visibleScaffoldReleasePlanned,
            cadenceClaimId,
            rngStateBefore,
            rngSamples: Object.freeze(rngSamples),
            rngDrawCount: rngSamples.length,
            rngReserved: rngSamples.length === 0,
            reservedAtSequence: rngSamples.length === 0 ? Number(sequence) : null,
            completionFork,
            explicitShares: Boolean(options.shares),
            preparedFamilyCapacity: preparedBudget.family,
            preparedAllocatedCapacity: preparedBudget.allocatedCapacity,
        });
    }

    function reserveForkIdentityIntent(context, intent, sequence) {
        if (intent?.semantics !== FORK_IDENTITY_INTENT_SEMANTICS) {
            throw new Error('[G15.4_FORK] A canonical fork identity intent is required.');
        }
        if (intent.rngReserved) return intent;
        if (Number(context.rng?.state >>> 0) !== intent.rngStateBefore) {
            throw new Error(
                '[G15.4_FORK] Fork identity RNG reservation no longer matches the selected proposal.',
            );
        }
        intent.rngSamples.forEach((expected) => {
            const realized = context.rng.next();
            if (Math.abs(realized - expected) > 1e-15) {
                throw new Error('[G15.4_FORK] Fork identity RNG sample drifted.');
            }
        });
        return Object.freeze({
            ...intent,
            rngReserved: true,
            reservedAtSequence: Number(sequence),
        });
    }

    function createOwner(dependencies) {
        const required = [
            'idFor',
            'nodeById',
            'resolveForkReferenceFrame',
            'selectForkDirection',
            'resolveForkSidePlan',
            'resolveNextHandoffPlan',
            'resolveChildReiterationForecasts',
            'resolveChildReiterationReserves',
            'prospectiveExtent',
            'projectForkDirections',
            'constrainOrderZeroForkDirection',
            'observeSiblingSeparation',
            'reconcileSiblingSeparation',
            'prospectiveCorridorPreview',
            'corridorConflictScore',
            'releaseFrontierCorridor',
            'resolveChildCluster',
            'createChildEpisode',
            'segmentRunLength',
            'createLineage',
            'addNode',
            'addSegment',
            'resolveNextForkPlan',
            'resolveAxisPersistencePlan',
            'resolveSecondaryAxisMaturation',
            'addFrontier',
            'activeSnapshot',
            'activeCorridorSnapshot',
            'settleNodeForStructuralFork',
            'resolveFutureBalanceField',
            'createScaffoldFamilyGesture',
            'resolveCrownBirthOpportunity',
        ];
        const missing = required.filter((name) => (
            !dependencies || typeof dependencies[name] !== 'function'
        ));
        if (missing.length) {
            throw new Error('[G15.4_FORK] Missing owner dependencies: ' + missing.join(', '));
        }
        const {
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
        } = dependencies;
        function roleForDecision(decision) {
            return decision.orderTransition
                ? 'developmental_order_transition'
                : 'developmental_order_retention';
        }

        function forkEvent(context, frontier, sequence, options = {}) {
            const forkIntent = options.forkIntent;
            if (
                forkIntent?.semantics !== FORK_IDENTITY_INTENT_SEMANTICS
                || !forkIntent.rngReserved
                || forkIntent.preparedAtLineageId !== frontier.lineageId
                || Number(forkIntent.parentAxisOrder)
                    !== Number(frontier.axisOrder ?? frontier.tier ?? 0)
            ) {
                throw new Error(
                    '[G15.4_FORK] Fork commit requires a reserved identity intent owned by the current axis family.',
                );
            }
            const completionFork = Boolean(options.completionFork);
            if (completionFork !== forkIntent.completionFork) {
                throw new Error('[G15.4_FORK] Fork completion mode drifted after intent preparation.');
            }
            const commonPermission = resolveVisibleScaffoldReleasePermission(frontier);
            const crownBaseCompetence = resolveCrownBaseCompetence(frontier);
            const crownFormationRequired = Number(
                frontier.axisOrder ?? frontier.tier ?? 0,
            ) === 0
                && crownBaseCompetence.applicable
                && !crownBaseCompetence.crownBaseEstablished;
            if (crownFormationRequired && !crownBaseCompetence.eligible) {
                throw new Error(
                    '[G15.4_FORK] Root-family crown formation attempted before juvenile bole competence.',
                );
            }
            if (forkIntent.visibleScaffoldReleasePlanned) {
                if (
                    !commonPermission.eligible
                    || !forkIntent.cadenceClaimId
                    || commonPermission.claimId !== forkIntent.cadenceClaimId
                ) {
                    throw new Error(
                        '[G15.4_FORK] Visible scaffold fork commit attempted without its pre-mutation cadence permission.',
                    );
                }
            }
            const childDevelopmentBudget = createChildDevelopmentBudget(
                context,
                frontier,
                forkIntent.orderedResourceShares,
                { preparedIdentityDecisions: forkIntent.identityDecisions },
            );
            const decisions = childDevelopmentBudget.decisions;
            const realizedSignature = identitySignature(
                frontier,
                forkIntent.orderedResourceShares,
                decisions,
                completionFork,
            );
            if (JSON.stringify(realizedSignature) !== JSON.stringify(forkIntent.signature)) {
                throw new Error('[G15.4_FORK] Fork identity intent rerolled before commit.');
            }
            const visibleScaffoldPermission = Object.freeze({
                ...commonPermission,
                id: `permission-${String(
                    context.visibleScaffoldPermissionReceipts.length + 1,
                ).padStart(4, '0')}`,
                sequence,
                phase: 'pre_mutation',
                candidateKind: 'structural_fork',
                frontierId: frontier.id,
                lineageId: frontier.lineageId,
                forkIntentId: forkIntent.id,
                planHash: forkIntent.planHash,
                plannedChildOrders: forkIntent.signature.childAxisOrders,
                crownBaseCompetence,
                crownFormationRequired,
                required: forkIntent.visibleScaffoldReleasePlanned,
                decision: forkIntent.visibleScaffoldReleasePlanned
                    ? 'granted'
                    : (forkIntent.parentAxisOrder === 0
                        ? 'not_required_order_zero_succession'
                        : 'not_required_non_order_zero_fork'),
                committed: true,
            });
            const originNode = nodeById(context, frontier.nodeId);
            const origin = originNode.point;
            const meristemCompetition = settleNodeForStructuralFork(
                context,
                frontier.nodeId,
                frontier.id,
                sequence,
            );
            context.activeFrontierIds.delete(frontier.id);
            const releasedCorridorId = releaseFrontierCorridor(
                context,
                frontier.id,
                sequence,
            );
            const resourceContrastTrajectory = evaluateDevelopmentalTrajectory(
                context,
                'resource_contrast',
                frontier,
                origin,
            );
            const resourceContrastProfile = forkIntent.resourceContrastProfile;
            if (
                resourceContrastProfile?.semantics
                    !== RESOURCE_CONTRAST_DAMPING_SEMANTICS
            ) {
                throw new Error(
                    '[G15.4_FORK] Fork intent lost its prepared resource contrast profile.',
                );
            }
            const arity = forkIntent.arity;
            const shares = forkIntent.orderedResourceShares;
            const resourceShareReceipt = Object.freeze({
                semantics: 'continuous_soft_balanced_lineage_share_v1',
                source: 'prepared_fork_identity_intent',
                shares,
                realizedContrast: rounded(
                    Math.max(...shares) - Math.min(...shares),
                ),
                tierResourceBias: rounded(
                    context.phenotype.tierResourceBias[frontier.tier],
                ),
                familyResourceBias: rounded(frontier.temperament.resourceBias),
                familyBalanceBias: rounded(frontier.temperament.balanceBias),
                lineageContrast: rounded(frontier.temperament.forkContrastBias),
                developmentalTrajectory: resourceContrastTrajectory,
                architectureProfile: resourceContrastProfile.architectureProfile,
                distalContrastDamping: resourceContrastProfile.damping,
                forkIntentId: forkIntent.id,
                forkIntentPlanHash: forkIntent.planHash,
                note: 'Balance approaches equality continuously; no exact-equality clamp owns the fork.',
            });
            const developmentalAllocations = childDevelopmentBudget.children;
            const axisIdentitySignals = Object.freeze(decisions.map(
                (decision) => decision.identitySignal,
            ));
            const forkSidePlan = resolveForkSidePlan(
                context,
                frontier,
                shares,
                decisions,
                options.forkSide,
            );
            const forkSide = forkSidePlan.side;
            const nextHandoffPlan = resolveNextHandoffPlan(frontier, forkSide);
            const forkArchetype = options.archetype
                ?? (completionFork
                    ? 'terminal_completion_split'
                    : resolveForkArchetype(
                        context,
                        frontier,
                        shares,
                        decisions,
                    ));
            const referenceFrame = resolveForkReferenceFrame(
                context,
                frontier,
                shares,
                forkSide,
                forkArchetype,
            );
            const horizontalRelease = resolveHorizontalReleasePlan(
                context,
                frontier,
                shares,
                decisions,
                forkSide,
                referenceFrame,
                Boolean(options.forceHorizontalRelease) || (completionFork
                    && context.horizontalReleaseCount < (
                        context.phenotype.crownTipTarget >= 14 ? 2 : 1
                    )),
                completionFork,
            );
            const aperturePlan = resolveForkAperturePlan(context, frontier);
            const requestedDivergence = horizontalRelease?.apertureRadians
                ?? aperturePlan.apertureRadians;
            const flowDirectionPlan = forkIntent.flowDirectionPlan;
            if (
                flowDirectionPlan?.semantics
                    !== FORK_FLOW_DIRECTION_SEMANTICS
                || flowDirectionPlan.weights?.length !== shares.length
            ) {
                throw new Error(
                    '[G15.4_FORK] Fork intent lost its prepared flow-direction plan.',
                );
            }
            const flowDirectionWeights = flowDirectionPlan.weights;
            const projectedLoadPlan = resolveProjectedLoadAnglePlan(
                frontier,
                flowDirectionWeights,
                developmentalAllocations,
                requestedDivergence,
                forkSide,
                referenceFrame.heading,
            );
            const angleShares = projectedLoadPlan.angleShares;
            const supportedForkPlan = horizontalRelease
                ? Object.freeze({
                    offsets: horizontalRelease.offsets,
                    apertureRadians: horizontalRelease.apertureRadians,
                    supportApplied: false,
                    horizontalRelease: true,
                })
                : resolveSupportedForkPlan(
                    context,
                    frontier,
                    flowDirectionWeights,
                    decisions,
                    requestedDivergence,
                    forkSide,
                    referenceFrame,
                );
            const divergence = supportedForkPlan.apertureRadians;
            const offsets = supportedForkPlan.offsets;
            const continuationKinkCandidate = resolveSuccessionKinkPlan(
                context,
                frontier,
                decisions,
                developmentalAllocations,
                shares,
                completionFork,
                divergence,
            );
            const hasTierZeroStationTransition = Number(
                frontier.axisOrder ?? frontier.tier ?? 0,
            ) === 0
                && decisions.some((decision) => decision.axisOrder === 0)
                && decisions.some((decision) => decision.axisOrder === 1);
            const successionKinkPlan = hasTierZeroStationTransition
                ? Object.freeze({
                    ...continuationKinkCandidate,
                    activated: false,
                    successorIndex: decisions.findIndex(
                        (decision) => decision.axisOrder === 0,
                    ),
                    reason: 'tier_zero_station_frame_owns_succession_return',
                    suppressedCandidateActivated:
                        continuationKinkCandidate.activated,
                })
                : continuationKinkCandidate;
            if (completionFork) context.completionForkCount += 1;
            if (horizontalRelease) context.horizontalReleaseCount += 1;
            const areaGain = context.forkAreaGain;
            const strongestShare = Math.max(...shares);
            const strongestFlowDirectionWeight = Math.max(
                ...flowDirectionWeights,
            );
            const rankedChildIndices = shares
                .map((share, index) => ({ share, index }))
                .sort((left, right) => right.share - left.share || left.index - right.index)
                .map((entry) => entry.index);
            const specializationPolarities = decisions.map((decision, childIndex) => {
                const resourceRank = rankedChildIndices.indexOf(childIndex);
                if (shares.length === 2) {
                    if (Math.abs(shares[0] - shares[1]) > 0.035) {
                        return resourceRank === 0 ? 1 : -1;
                    }
                    return Math.sign(offsets[childIndex])
                        * context.phenotype.asymmetrySign
                        || (resourceRank === 0 ? 1 : -1);
                }
                if (resourceRank === 0) return 1;
                if (resourceRank === shares.length - 1) return -1;
                return Math.sign(offsets[childIndex])
                    * context.phenotype.asymmetrySign
                    || -context.phenotype.asymmetrySign;
            });
            const lineageResponses = createSiblingLineageResponses(
                frontier.temperament.lineageResponse,
                shares,
                specializationPolarities,
                context.phenotype,
                context.rng,
            );
            // A child must know whether it actually owns another meristem
            // before its construction portfolio is divided. The previous
            // ordering guessed from parent tier identity, then assigned the
            // real fork budgets hundreds of lines later. That stranded future
            // construction in children that could never fork and left real
            // successors without a descendant commitment.
            const preliminaryReiterationPotentials = developmentalAllocations.map(
                (allocation, index) => clamp(
                    allocation.reiterationShare * 0.58
                        + allocation.extensionShare * 0.22
                        + allocation.supportShare * 0.12
                        + (lineageResponses[index]?.axis_extent || 0) * 0.08,
                    0.04,
                    0.96,
                ),
            );
            const plannedChildReiterationForecasts = completionFork
                ? Object.freeze(new Array(shares.length).fill(0))
                : resolveChildReiterationForecasts(
                    context,
                    frontier,
                    decisions,
                    developmentalAllocations,
                    preliminaryReiterationPotentials,
                    lineageResponses,
                );
            const plannedChildReiterationReserves = completionFork
                ? Object.freeze(new Array(shares.length).fill(0))
                : resolveChildReiterationReserves(
                    frontier,
                    decisions,
                    developmentalAllocations,
                    preliminaryReiterationPotentials,
                    lineageResponses,
                );
            const childPlans = decisions.map((decision, childIndex) => {
                const share = shares[childIndex];
                const flowDirectionWeight = flowDirectionWeights[childIndex];
                const allocation = developmentalAllocations[childIndex];
                const tier = decision.tier;
                const shareRatio = share / strongestShare;
                const growthCapacity = allocation.growthCapacity
                    ** context.phenotype.growthCapacityExponent;
                const extensionCapacity = allocation.extensionCapacity
                    ** context.phenotype.growthCapacityExponent;
                const resourceRank = rankedChildIndices.indexOf(childIndex);
                const releasedOrder = decision.orderTransition;
                const specializationPolarity = specializationPolarities[childIndex];
                const temperament = inheritTemperament(
                    frontier.temperament,
                    context.phenotype,
                    share,
                    tier,
                    context.rng,
                    `temperament-${context.counters.lineage + childIndex + 1}`,
                    {
                        arity: shares.length,
                        specializationPolarity,
                        lineageResponse: lineageResponses[childIndex],
                    },
                );
                const proxy = {
                    tier,
                    vigor: frontier.vigor * (0.78 + growthCapacity * 0.22),
                    temperament,
                    point: origin,
                    radius: frontier.radius,
                    axisAge: 1,
                    axisStepLimit: TIERS[tier].maximumAxisSteps,
                    axisHardLimit: TIERS[tier].maximumAxisSteps,
                    generationDepth: frontier.generationDepth + 1,
                    // This first pass asks only for developmental character.
                    // The actual length is resolved after junction radius is
                    // known and a full axis portfolio has been created.
                    constructionReserve: 1e6,
                    developmentalCapacity: allocation.absoluteCapacity,
                    previousInternodeLength: frontier.previousInternodeLength,
                    extensionAllocation: allocation.extensionCapacity,
                    supportAllocation: allocation.supportCapacity,
                    maturationState: 'active_extension',
                };
                const emergenceWave = (
                    Math.sin(
                        temperament.developmentalPhase * 3.73
                            + temperament.forkContrastBias * 2.11
                            + temperament.resourceBias * 1.31
                            + temperament.clusterSlot * 1.07,
                    ) + 1
                ) * 0.5;
                const baseEmergenceScale = releasedOrder
                    ? clamp(
                        0.5
                            + extensionCapacity * 0.38
                            + emergenceWave * 0.12,
                        0.52,
                        1,
                    )
                    : clamp(0.82 + extensionCapacity * 0.24, 0.82, 1.06);
                const kinkConnectorScale = successionKinkPlan.activated
                    && successionKinkPlan.successorIndex === childIndex
                    ? successionKinkPlan.connectorLengthScale
                    : 1;
                const emergenceScale = baseEmergenceScale * kinkConnectorScale;
                const lengthEpisode = {
                    segmentLengthScale: (
                        completionFork
                            ? 1.04
                            : (decision.orderRetained ? 0.98 : 0.94)
                    )
                        * (0.82 + extensionCapacity * 0.2),
                };
                const requestedBirthLength = segmentRunLength(
                    context,
                    proxy,
                    lengthEpisode,
                    { birth: true, emergenceScale },
                );
                const plannedReiterationReserve = plannedChildReiterationReserves[
                    childIndex
                ];
                const plannedReiterationForecast =
                    plannedChildReiterationForecasts[childIndex];
                const reiterationSample = context.rng.next();
                const axisOrder = decision.axisOrder;
                const developmentState = createChildDevelopmentState(
                    context,
                    frontier,
                    {
                        route: 'structural_fork',
                        tier,
                        axisOrder,
                        birthMode: releasedOrder
                            ? 'resource_release_fork'
                            : 'recursive_fork',
                        retentionPotential: decision.retentionPotential,
                        supportInvestment: allocation.supportCapacity,
                        extensionDrive: extensionCapacity,
                        reiterationPotential:
                            preliminaryReiterationPotentials[childIndex],
                        reiterationReadiness: plannedReiterationReserve,
                        reiterationSample,
                        relativeDifferentiation:
                            allocation.relativeDifferentiation,
                        temperament,
                        birthLength: requestedBirthLength,
                        spatialExposure: frontier.spatialExposure,
                    },
                );
                const plan = {
                    share,
                    flowDirectionWeight,
                    decision,
                    tier,
                    axisOrder,
                    shareRatio,
                    absoluteCapacity: allocation.absoluteCapacity,
                    growthCapacity,
                    extensionCapacity,
                    supportCapacity: allocation.supportCapacity,
                    supportBudget: allocation.supportBudget,
                    junctionSupportBudget: allocation.junctionSupportBudget,
                    extensionBudget: allocation.extensionBudget,
                    reiterationBudget: allocation.reiterationBudget,
                    constructionGrant: allocation.constructionGrant,
                    constructionShare: allocation.constructionShare,
                    supportShare: allocation.supportShare,
                    extensionShare: allocation.extensionShare,
                    reiterationShare: allocation.reiterationShare,
                    allocationCharacter: allocation.character,
                    supportToExtension: allocation.supportToExtension,
                    lateralInvestmentScale: allocation.lateralInvestmentScale,
                    lateralStrategyField: allocation.lateralStrategyField,
                    signedDecoupling: allocation.signedDecoupling,
                    relativeDifferentiation:
                        allocation.relativeDifferentiation,
                    temperament,
                    developmentState,
                    reiterationSample,
                    reiterationForecast: plannedReiterationForecast,
                    reiterationReserve: plannedReiterationReserve,
                    preliminaryReiterationPotential:
                        preliminaryReiterationPotentials[childIndex],
                    requestedBirthLength,
                    lengthEpisode,
                    emergenceScale,
                    emergenceWave,
                };
                return plan;
            });
            const allocationLedger = resolveJunctionLedger(
                frontier,
                childPlans,
                areaGain,
            );
            const provisional = [];
            const siblingTargets = [];
            childPlans.forEach((plan, childIndex) => {
                const allocation = allocationLedger[childIndex];
                const {
                    share,
                    flowDirectionWeight,
                    decision,
                    tier,
                    temperament,
                    shareRatio,
                    absoluteCapacity,
                    growthCapacity,
                    extensionCapacity,
                    supportCapacity,
                    supportBudget,
                    junctionSupportBudget,
                    extensionBudget,
                    reiterationBudget,
                    constructionGrant,
                    constructionShare,
                    requestedBirthLength,
                    lengthEpisode,
                } = plan;
                const startRadius = allocation.startRadius;
                const reiterationCommitment = clamp(
                    reiterationBudget / Math.max(0.02, absoluteCapacity),
                    0,
                    1,
                );
                const anticipatesStructuralFork = !completionFork
                    && reiterationCommitment >= 0.62;
                const forkAgePlan = resolveNextForkPlan(
                    context,
                    tier,
                    false,
                    temperament,
                    {
                        point: origin,
                        radius: startRadius,
                        axisAge: 1,
                        axisStepLimit: TIERS[tier].maximumAxisSteps,
                    },
                );
                const constructionPortfolio = createAxisConstructionPortfolio(
                    context,
                    {
                        tier,
                        generationDepth: frontier.generationDepth + 1,
                        origin,
                        familyConstructionGrant: constructionGrant,
                        anticipatesStructuralFork,
                        reiterationCommitment,
                        extensionCapacity,
                        plannedInternodeCount: anticipatesStructuralFork
                            ? forkAgePlan.age
                            : undefined,
                        forkIntervalScale: temperament.forkIntervalScale
                            * Math.exp(
                                (temperament.lineageResponse?.fork_rhythm || 0)
                                    * 0.16,
                            ),
                        lateralInvestmentScale: plan.lateralInvestmentScale,
                        developmentState: plan.developmentState,
                        temperament,
                    },
                );
                const lengthProxy = {
                    tier,
                    vigor: frontier.vigor * (0.78 + growthCapacity * 0.22),
                    temperament,
                    point: origin,
                    radius: startRadius,
                    axisAge: 0,
                    axisStepLimit: constructionPortfolio.plannedInternodeCount,
                    axisHardLimit: constructionPortfolio.plannedInternodeCount,
                    generationDepth: frontier.generationDepth + 1,
                    constructionReserve:
                        constructionPortfolio.axisConstructionBudget,
                    constructionPortfolio,
                    developmentalCapacity: absoluteCapacity,
                    previousInternodeLength: frontier.previousInternodeLength,
                    extensionAllocation: extensionCapacity,
                    supportAllocation: supportCapacity,
                    developmentState: plan.developmentState,
                    maturationState: 'active_extension',
                };
                const birthConstructionReceipt = resolveInternodeConstruction(
                    context,
                    lengthProxy,
                    lengthEpisode,
                    { birth: true, emergenceScale: plan.emergenceScale },
                );
                const runLength = birthConstructionReceipt.realizedLength;
                const birthDevelopmentState = createChildDevelopmentState(
                    context,
                    frontier,
                    {
                        route: 'structural_fork',
                        tier,
                        axisOrder: plan.axisOrder,
                        birthMode: plan.decision.orderTransition
                            ? 'resource_release_fork'
                            : 'recursive_fork',
                        retentionPotential: plan.decision.retentionPotential,
                        supportInvestment: supportCapacity,
                        extensionDrive: extensionCapacity,
                        reiterationPotential: plan.preliminaryReiterationPotential,
                        reiterationReadiness: plan.reiterationReserve,
                        reiterationSample: plan.reiterationSample,
                        relativeDifferentiation:
                            plan.relativeDifferentiation,
                        temperament,
                        birthLength: runLength,
                        birthConstructionCost:
                            birthConstructionReceipt.constructionCost,
                        plannedInternodeCount:
                            constructionPortfolio.plannedInternodeCount,
                        spatialExposure: frontier.spatialExposure,
                    },
                );
                const baseDirection = tiltDepth(
                    rotateGrowthPlane(referenceFrame.heading, offsets[childIndex]),
                    Math.sin(
                        temperament.developmentalPhase * 3.61
                            + temperament.forkContrastBias * 1.83
                            + temperament.clusterSlot * 1.37
                            + childIndex * 2.23
                            + temperament.resourceBias * 3.7,
                    ) * (tier === 0 ? 0 : TIERS[tier].depthVariation),
                );
                const scaffoldFamilyGesture = plan.axisOrder > 0
                    ? createScaffoldFamilyGesture(context, {
                        axisOrder: plan.axisOrder,
                        heading: baseDirection,
                        parentGesture:
                            frontier.scaffoldFamilyGesture || null,
                        lineageKey:
                            `${frontier.lineageId}:${sequence}:${childIndex}`,
                        parentLineageId: frontier.lineageId,
                        sequence,
                        childIndex,
                        temperament,
                    })
                    : null;
                const cluster = resolveChildCluster(context, frontier, {
                    origin,
                    heading: baseDirection,
                    tier,
                    axisOrder: plan.axisOrder,
                    resourceShare: share,
                    temperament,
                    developmentState: birthDevelopmentState,
                    birthEvent: sequence,
                    familyGesture: scaffoldFamilyGesture,
                });
                const selected = selectForkDirection(
                    context,
                    frontier,
                    origin,
                    baseDirection,
                    runLength,
                    startRadius,
                    tier,
                    siblingTargets,
                    cluster,
                    flowDirectionWeight
                        / Math.max(1e-8, strongestFlowDirectionWeight),
                    temperament,
                    tier === 0 && Number.isFinite(supportedForkPlan.maximumTurnRadians)
                        ? {
                            maximumTurnRadians: supportedForkPlan.maximumTurnRadians,
                            maximumWorldLeanRadians:
                                supportedForkPlan.maximumWorldLeanRadians,
                        }
                        : null,
                );
                siblingTargets.push(selected);
                provisional.push({
                    share,
                    flowDirectionWeight,
                    decision: plan.decision,
                    tier,
                    axisOrder: plan.axisOrder,
                    startRadius,
                    temperament,
                    developmentState: birthDevelopmentState,
                    baseDirection,
                    direction: selected.direction,
                    target: selected.target,
                    runLength,
                    offset: offsets[childIndex],
                    corridorPreview: selected.corridorPreview,
                    corridorScore: selected.corridorScore,
                    depthDelta: selected.depthDelta,
                    cluster,
                    scaffoldFamilyGesture,
                    shareRatio,
                    absoluteCapacity,
                    growthCapacity,
                    extensionCapacity,
                    supportCapacity,
                    supportBudget,
                    junctionSupportBudget,
                    extensionBudget,
                    reiterationBudget,
                    constructionGrant,
                    constructionShare,
                    constructionPortfolio,
                    forkAgePlan,
                    birthConstructionReceipt,
                    requestedBirthLength,
                    supportShare: plan.supportShare,
                    extensionShare: plan.extensionShare,
                    reiterationShare: plan.reiterationShare,
                    allocationCharacter: plan.allocationCharacter,
                    supportToExtension: plan.supportToExtension,
                    lateralInvestmentScale: plan.lateralInvestmentScale,
                    lateralStrategyField: plan.lateralStrategyField,
                    signedDecoupling: plan.signedDecoupling,
                    relativeDifferentiation:
                        plan.relativeDifferentiation,
                    reiterationForecast: plan.reiterationForecast,
                    plannedReiterationReserve: plan.reiterationReserve,
                    preliminaryReiterationPotential:
                        plan.preliminaryReiterationPotential,
                    projectedLoad: projectedLoadPlan.children[childIndex].projectedLoad,
                    projectedLoadMoment:
                        projectedLoadPlan.children[childIndex].projectedLoadMoment,
                    angleShare: projectedLoadPlan.children[childIndex].angleShare,
                    junctionAreaShare: allocation.junctionAreaShare,
                    junctionMassShare: allocation.junctionMassShare,
                    allocationMode: allocation.allocationMode,
                    emergenceScale: plan.emergenceScale,
                    emergenceWave: plan.emergenceWave,
                    horizontalRelease: horizontalRelease?.minorIndex === childIndex,
                    formSide: Math.sign(selected.direction.x)
                        || Math.sign(offsets[childIndex])
                        || frontier.formSide
                        || context.phenotype.asymmetrySign,
                });
            });

            const projection = projectForkDirections(
                context,
                frontier,
                origin,
                referenceFrame,
                provisional,
                horizontalRelease,
            );
            const {
                rigidFrameCorrection,
                rigidDepthCorrection,
                siblingSeparationPlan: projectedSiblingSeparationPlan,
            } = projection;
            let siblingSeparationPlan = projectedSiblingSeparationPlan;
            const structuralScaffoldIndex = Number(
                frontier.axisOrder ?? frontier.tier ?? 0,
            ) === 0
                ? provisional.findIndex((child) => child.axisOrder === 1)
                : -1;
            const structuralContinuationIndex = structuralScaffoldIndex >= 0
                ? provisional.findIndex((child) => child.axisOrder === 0)
                : -1;
            const structuralStation = structuralScaffoldIndex >= 0
                && structuralContinuationIndex >= 0
                ? resolveTierZeroStructuralStation(context, frontier, {
                    routeKind: 'structural_fork',
                    origin,
                    parentHeading: frontier.heading,
                    scaffoldDirection:
                        provisional[structuralScaffoldIndex].direction,
                    continuationDirection:
                        provisional[structuralContinuationIndex].direction,
                    side: Math.sign(signedPlanarAngle(
                        frontier.heading,
                        provisional[structuralScaffoldIndex].direction,
                    )),
                    stationOrdinal: frontier.meristemCadence?.eventCount,
                    balanceField: resolveFutureBalanceField(context, frontier),
                })
                : null;
            if (structuralStation) {
                provisional[structuralScaffoldIndex].direction =
                    structuralStation.scaffoldDirection;
                const constrainedContinuation =
                    constrainOrderZeroForkDirection(
                        context,
                        frontier,
                        structuralStation.continuationDirection,
                        false,
                    );
                provisional[structuralContinuationIndex].direction =
                    constrainedContinuation.direction;
                provisional[structuralContinuationIndex]
                    .orderZeroSupportCorrectionRadians =
                    constrainedContinuation.correctionRadians;
                provisional[structuralScaffoldIndex].structuralStation =
                    structuralStation;
                provisional[structuralContinuationIndex].structuralStation =
                    structuralStation;
                provisional[structuralContinuationIndex].successionKinkRole =
                    'station_frame_probabilistic_succession_return';
                siblingSeparationPlan = reconcileSiblingSeparation(
                    context,
                    frontier,
                    referenceFrame,
                    provisional,
                    divergence,
                );
            }
            let crownCompositionApplied = false;
            provisional.forEach((child, childIndex) => {
                if (child.axisOrder <= 0) return;
                child.crownBirthOpportunity = resolveCrownBirthOpportunity({
                    baseDirection: child.direction,
                    childAxisOrder: child.axisOrder,
                    familyGesture: child.scaffoldFamilyGesture,
                    exposure: null,
                });
                child.direction = child.crownBirthOpportunity.directionAfter;
                crownCompositionApplied = true;
            });
            if (crownCompositionApplied) {
                siblingSeparationPlan = reconcileSiblingSeparation(
                    context,
                    frontier,
                    referenceFrame,
                    provisional,
                    divergence,
                );
            }
            const crownRadius = resolveCrownRadius(context);
            const originRadius = resolveRadialDistance(origin);
            const fieldPotentials = provisional.map((child) => {
                const target = pointAt(origin, child.direction, child.runLength);
                const targetRadius = resolveRadialDistance(target);
                const centerlineGain = clamp(
                    (originRadius - targetRadius) / Math.max(24, crownRadius),
                    -0.45,
                    0.45,
                );
                const verticalAffinity = clamp(child.direction.y, -1, 1);
                const potential = clamp(
                    child.reiterationShare
                        + centerlineGain * (child.tier === 0 ? 0.78 : 0.34)
                        + Math.max(0, verticalAffinity) * (child.tier === 0 ? 0.08 : 0.025),
                    0.04,
                    0.96,
                );
                child.centerlineField = Object.freeze({
                    originRadius: rounded(originRadius),
                    targetRadius: rounded(targetRadius),
                    centerlineGain: rounded(centerlineGain),
                    verticalAffinity: rounded(verticalAffinity),
                    crownRadius: rounded(crownRadius),
                    potential: rounded(potential),
                });
                return potential;
            });
            provisional.forEach((child, index) => {
                child.reiterationReserve = child.plannedReiterationReserve;
                child.reiterationPotential = fieldPotentials[index];
                child.maturationState = child.tier === 1
                    && child.supportToExtension >= 1.18
                    && child.reiterationPotential >= 0.22
                    ? 'resting_support_build'
                    : 'active_extension';
            });
            let successionKinkApplication = null;
            if (successionKinkPlan.activated) {
                const successor = provisional[successionKinkPlan.successorIndex];
                const directionBefore = Object.freeze({ ...successor.direction });
                const application = applySuccessionKinkDirection(
                    context,
                    frontier,
                    successor,
                    successionKinkPlan,
                );
                successor.direction = application.direction;
                successor.successionKinkRole = 'kinked_order_zero_succession';
                successionKinkApplication = {
                    ...application,
                    directionBefore,
                };
                siblingSeparationPlan = reconcileSiblingSeparation(
                    context,
                    frontier,
                    referenceFrame,
                    provisional,
                    divergence,
                );
                successor.direction = constrainSuccessionKinkDirection(
                    context,
                    frontier,
                    successor.direction,
                );
                const finalSeparationObservation = observeSiblingSeparation(
                    referenceFrame,
                    provisional,
                    divergence,
                );
                siblingSeparationPlan = Object.freeze({
                    ...siblingSeparationPlan,
                    afterSeparationRadians:
                        finalSeparationObservation.afterSeparationRadians,
                    retainedRatio: finalSeparationObservation.retainedRatio,
                    childCorrectionRadians:
                        finalSeparationObservation.childCorrectionRadians,
                    wideProposalScreenCollapse:
                        finalSeparationObservation.wideProposalScreenCollapse,
                    postSuccessionKinkObservation: finalSeparationObservation,
                });
            }
            provisional.forEach((child) => {
                child.expectedExtent = prospectiveExtent(context, child);
                child.successionKinkRole ||= 'ordinary_fork_child';
            });
            const kinkedChild = successionKinkPlan.activated
                ? provisional[successionKinkPlan.successorIndex]
                : null;
            const realizedKinkRadians = kinkedChild && successionKinkApplication
                ? signedPlanarAngle(
                    successionKinkApplication.directionBefore,
                    kinkedChild.direction,
                )
                : 0;
            const successionKink = Object.freeze({
                ...successionKinkPlan,
                realizedTurnRadians: rounded(realizedKinkRadians),
                realizedTurnDegrees: rounded(realizedKinkRadians * 180 / Math.PI, 3),
                realizedTurnSign: Math.sign(realizedKinkRadians),
                retainedTurnRatio: successionKinkPlan.activated
                    ? rounded(clamp(
                        Math.abs(realizedKinkRadians)
                            / Math.max(1e-8, Math.abs(successionKinkPlan.requestedTurnRadians)),
                        0,
                        1.5,
                    ))
                    : 0,
                application: successionKinkApplication
                    ? Object.freeze({ ...successionKinkApplication })
                    : null,
                crossSiblingResourceTransfer: false,
                reiterationForecastMutation: false,
                childPersistenceMutation: false,
                forkCadenceMutation: false,
                lateralOpportunityMutation: false,
            });
            provisional.forEach((child, index) => {
                child.target = pointAt(origin, child.direction, child.runLength);
                child.corridorPreview = prospectiveCorridorPreview(context, {
                    origin,
                    direction: child.direction,
                    runLength: child.runLength,
                    radius: child.startRadius,
                    tier: child.tier,
                    episode: frontier.episode,
                    episodeAge: 0,
                    sag: { active: false, age: 0 },
                    clusterId: child.cluster?.id || null,
                });
                child.corridorScore = corridorConflictScore(
                    context,
                    child.corridorPreview,
                    provisional
                        .filter((_, siblingIndex) => siblingIndex !== index)
                        .map((sibling) => sibling.corridorPreview),
                );
                siblingTargets[index] = {
                    ...siblingTargets[index],
                    direction: child.direction,
                    target: child.target,
                    corridorPreview: child.corridorPreview,
                    corridorScore: child.corridorScore,
                };
            });

            const createdNodeIds = [];
            const createdSegmentIds = [];
            const createdFrontierIds = [];
            const createdCorridorIds = [];
            const childReceipts = [];
            const parentAxisOrder = Number(frontier.axisOrder ?? frontier.tier ?? 0);
            const retainedOrderZeroChildren = provisional
                .map((child, index) => ({ child, index }))
                .filter(({ child }) => (
                    parentAxisOrder === 0
                    && child.decision.orderRetained
                    && child.axisOrder === 0
                ));
            const visibleScaffoldReleaseCommitted = parentAxisOrder === 0
                && provisional.some((child) => child.axisOrder > 0);
            const crownFormationCommitted = parentAxisOrder === 0
                && crownBaseCompetence.applicable
                && crownBaseCompetence.eligible
                && !crownBaseCompetence.crownBaseEstablished;
            // A co-retained fork may create several order-zero families, but
            // the parent's accumulated visible-release claim is one conserved
            // historical quantity. Give that claim to the child carrying the
            // greatest axis responsibility; siblings begin a new local phase.
            const inheritedCadenceClaimIndex = !visibleScaffoldReleaseCommitted
                && retainedOrderZeroChildren.length > 1
                ? [...retainedOrderZeroChildren].sort((left, right) => (
                    Number(right.child.decision.identityResponsibility || 0)
                        - Number(left.child.decision.identityResponsibility || 0)
                    || right.child.growthCapacity - left.child.growthCapacity
                    || left.index - right.index
                ))[0].index
                : retainedOrderZeroChildren[0]?.index ?? null;
            provisional.forEach((child, childIndex) => {
                const role = roleForDecision(child.decision);
                const birthMode = child.decision.orderTransition
                    ? 'resource_release_fork'
                    : 'recursive_fork';
                const childHandoffPlan = resolveNextHandoffPlan(
                    frontier,
                    forkSide,
                    child.temperament.lineageResponse,
                );
                child.handoffPlan = childHandoffPlan;
                const sagActive = child.decision.orderTransition && (
                    context.form.kind === 'weeping_release'
                    || context.traitId === 'weeping_temperament'
                    || context.phenotype.sagResponse > 0.7
                );
                const childEpisode = createChildEpisode(context, frontier, {
                    tier: child.tier,
                    axisOrder: child.axisOrder,
                    developmentState: child.developmentState,
                    radius: child.startRadius,
                    resourceShare: child.share,
                    extensionAllocation: child.extensionShare,
                    siblingShares: shares,
                    heading: child.direction,
                    offset: child.offset,
                    formSide: child.formSide,
                    temperament: child.temperament,
                    birthEvent: sequence,
                    cluster: child.cluster,
                    origin: child.target,
                    forkArchetype,
                    referenceHeading: referenceFrame.heading,
                    horizontalRelease: child.horizontalRelease,
                    completionFork,
                    successionKinkRole: child.successionKinkRole,
                });
                const lineage = createLineage(context, {
                    parentLineageId: frontier.lineageId,
                    tier: child.tier,
                    axisOrder: child.axisOrder,
                    birthMode,
                    birthEvent: sequence,
                    resourceShare: child.share,
                    episode: childEpisode,
                    temperament: child.temperament,
                    developmentState: child.developmentState,
                    cluster: child.cluster,
                    scaffoldFamilyGesture: child.scaffoldFamilyGesture,
                });
                const scaffoldFamilyDominanceClaim = context.researchControls
                    .scaffoldFamilyDominance === false
                    ? null
                    : frontier.scaffoldFamilyDominanceClaim
                        ? inheritScaffoldFamilyDominanceClaim(
                            frontier.scaffoldFamilyDominanceClaim,
                            {
                                carrierLineageId: lineage.id,
                                childAxisOrder: child.axisOrder,
                                carriedAtSequence: sequence,
                                throughFork: true,
                            },
                        )
                        : createScaffoldFamilyDominanceClaim({
                            claimId:
                                `scaffold-dominance:${frontier.lineageId}:${sequence}:${lineage.id}`,
                            sourceKind: 'structural_fork',
                            sourceSequence: sequence,
                            sourceNodeId: frontier.nodeId,
                            sourceScaffoldLineageId: frontier.lineageId,
                            subordinateRootLineageId: lineage.id,
                            carrierLineageId: lineage.id,
                            sourceAxisOrder: parentAxisOrder,
                            childAxisOrder: child.axisOrder,
                            sourceAreaFraction: child.junctionAreaShare,
                            sourceResourceShare: child.share,
                            sourceDeflectionRadians: angularDistance(
                                frontier.heading,
                                child.direction,
                            ),
                            temporaryAxis: false,
                        });
                lineage.scaffoldFamilyDominanceClaim =
                    scaffoldFamilyDominanceClaim;
                const node = addNode(
                    context,
                    child.target,
                    frontier.nodeId,
                    null,
                    sequence,
                );
                const radiusProfile = resolveAxisRadiusProfile(
                    child.developmentState,
                );
                const forkTaperScale = Math.min(0.986, radiusProfile.taper + 0.012);
                const endRadius = Math.max(
                    child.startRadius * forkTaperScale,
                    Math.min(child.startRadius, radiusProfile.minimumRadius),
                );
                const segment = addSegment(context, {
                    fromNodeId: frontier.nodeId,
                    toNodeId: node.id,
                    lineageId: lineage.id,
                    tier: child.tier,
                    axisOrder: child.axisOrder,
                    startRadius: child.startRadius,
                    endRadius,
                    length: child.runLength,
                    resourceShare: child.share,
                    episode: childEpisode,
                    birthEvent: sequence,
                    clusterId: child.cluster?.id || null,
                    birthMode,
                    developmentState: child.developmentState,
                    scaffoldFamilyDominanceClaim,
                });
                const patchedNode = Object.freeze({ ...node, incomingSegmentId: segment.id });
                context.nodes[context.nodes.length - 1] = patchedNode;
                context.nodeIndex.set(patchedNode.id, patchedNode);
                lineage.segmentIds.push(segment.id);
                const inheritedChildVigor = frontier.vigor * clamp(
                    0.64 + child.growthCapacity * 0.36,
                    0.62,
                    1,
                );
                const minimumViableVigor = child.tier === 0
                    ? 0.31
                    : (child.tier === 1 ? 0.36 : 0.32);
                const childVigor = completionFork
                    ? Math.max(0.58, inheritedChildVigor)
                    : Math.max(minimumViableVigor, inheritedChildVigor);
                const inheritedResourceReserve = clamp(
                    frontier.resourceReserve
                        * (0.38 + child.growthCapacity * 0.62),
                    0.22,
                    1.9,
                );
                const minimumViableReserve = child.tier === 0
                    ? 0.32
                    : (child.tier === 1 ? 0.4 : 0.34);
                const childResourceReserve = completionFork
                    ? Math.max(0.66, inheritedResourceReserve)
                    : Math.max(minimumViableReserve, inheritedResourceReserve);
                const reiterationForecast = child.reiterationForecast;
                const birthConstructionCost = child.birthConstructionReceipt
                    .constructionCost;
                const constructionReserve = child.birthConstructionReceipt
                    .reserveAfterConstruction;
                const constructionPortfolio = child.birthConstructionReceipt
                    .portfolioAfterConstruction;
                // Fork cadence now follows the axis portfolio established at
                // birth. A shortage cannot accelerate a scheduled fork or be
                // externalized as two microscopic children.
                const portfolioForkAge = constructionPortfolio
                    .plannedInternodeCount;
                const nextForkAge = portfolioForkAge;
                const baseAxisStepLimit = portfolioForkAge;
                const axisStepLimit = baseAxisStepLimit;
                const axisHardLimit = axisStepLimit;
                const occupiedSibling = provisional
                    .filter((_, siblingIndex) => siblingIndex !== childIndex)
                    .sort((left, right) => right.share - left.share)[0] || null;
                const retainsAxisFamilyCadence = child.decision.orderRetained && (
                    parentAxisOrder !== 0
                    || visibleScaffoldReleaseCommitted
                    || retainedOrderZeroChildren.length <= 1
                    || childIndex === inheritedCadenceClaimIndex
                );
                const cadenceInheritanceRole = parentAxisOrder !== 0
                    ? 'local_recursive_axis_history'
                    : (visibleScaffoldReleaseCommitted
                        ? 'visible_scaffold_release_commit'
                        : (childIndex === inheritedCadenceClaimIndex
                            ? 'carried_unspent_visible_release_claim'
                            : 'new_codominant_axis_family_phase'));
                const cadenceReleaseCommitted = parentAxisOrder === 0
                    ? visibleScaffoldReleaseCommitted
                    : true;
                const meristemCadence = occupiedSibling
                    ? createJunctionCadence(context, {
                        kind: parentAxisOrder !== 0
                            ? 'local_recursive_fork_birth'
                            : (visibleScaffoldReleaseCommitted
                                ? 'visible_scaffold_fork_birth'
                                : 'axis_succession_birth'),
                        sequence,
                        lineageId: lineage.id,
                        axisFamilyId: lineage.id,
                        temperament: child.temperament,
                        childHeading: child.direction,
                        siblingHeading: occupiedSibling.direction,
                        siblingShare: occupiedSibling.share,
                        birthLength: child.runLength,
                        point: origin,
                        sourceRadius: frontier.radius,
                        lateralInvestmentScale: child.lateralInvestmentScale,
                        lateralTimingBias: context.phenotype.lateralTimingBias,
                        inheritedCadence: retainsAxisFamilyCadence
                            ? frontier.meristemCadence
                            : null,
                        inheritedOntogeny:
                            frontier.meristemCadence?.ontogeny || null,
                        inheritAxisFamily: retainsAxisFamilyCadence,
                        releaseCommitted: cadenceReleaseCommitted,
                        crownFormationCommitted,
                        inheritanceRole: cadenceInheritanceRole,
                    })
                    : null;
                const restDelay = child.maturationState === 'resting_support_build'
                    ? clamp(
                        1.8 + (child.supportToExtension - 1) * 2.4,
                        2,
                        4.8,
                    )
                    : 0;
                const childSuccessionKinkState = deriveChildSuccessionKinkState(
                    successionKink.stateBefore,
                    successionKink,
                    childIndex,
                    child.runLength,
                    child.decision.orderRetained,
                );
                const childFrontier = addFrontier(context, {
                    nodeId: patchedNode.id,
                    parentFrontierId: frontier.id,
                    lineageId: lineage.id,
                    tier: child.tier,
                    axisOrder: child.axisOrder,
                    heading: child.direction,
                    axisEntryHeading: child.direction,
                    turnVelocity: childEpisode.curvatureVelocity,
                    radius: endRadius,
                    vigor: childVigor,
                    axisAge: 1,
                    axisStepLimit,
                    axisHardLimit,
                    generationDepth: frontier.generationDepth + 1,
                    reiterationForecast,
                    reiterationReserve: child.reiterationReserve,
                    constructionReserve,
                    constructionPortfolio,
                    meristemCadence,
                    scaffoldFamilyGesture: child.scaffoldFamilyGesture,
                    scaffoldFamilyDominanceClaim,
                    previousInternodeLength: child.runLength,
                    forkDeferralCount: 0,
                    nextForkAge,
                    episode: childEpisode,
                    episodeAge: 1,
                    temperament: child.temperament,
                    formSide: child.formSide,
                    sag: {
                        active: sagActive,
                        age: 0,
                        recoveryAfter: context.rng.integer(4, 5),
                    },
                    readyAt: sequence + TIERS[child.tier].scheduleDelay
                        / Math.max(0.5, childVigor)
                        + (child.decision.orderTransition
                            ? 1.2 + (1 - child.shareRatio) * 1.8
                            : 0)
                        + restDelay,
                    // The family supplies one base phase, while the persistent
                    // lineage response decides whether this child repeats or
                    // alternates it. Siblings therefore remain correlated but
                    // no longer execute one shared cadence program.
                    nextTurnSign: childHandoffPlan.sign,
                    successionTurnSign: childHandoffPlan.sign,
                    successionKinkState: childSuccessionKinkState,
                    handoffRepeatCount: childHandoffPlan.repeatCount,
                    birthResourceShare: child.share,
                    developmentalCapacity: clamp(
                        child.absoluteCapacity,
                        0.02,
                        1,
                    ),
                    supportAllocation: child.supportCapacity,
                    extensionAllocation: clamp(
                        child.extensionCapacity,
                        0.04,
                        1,
                    ),
                    reiterationPotential: child.reiterationPotential,
                    lateralMeristemReserve: child.tier === 1
                        ? clamp(
                            child.reiterationBudget * 1.1
                                + child.absoluteCapacity * 0.025,
                            0,
                            0.18,
                        )
                        : 0,
                    maturationState: child.maturationState,
                    restUntilEvent: sequence + restDelay,
                    regrowthPulseCount: 0,
                    resourceReserve: childResourceReserve,
                    maintenanceDebt: frontier.maintenanceDebt * (1 - child.share) * 0.32,
                    spatialExposure: clamp(
                        1 / (1 + child.corridorScore * 0.11),
                        0.14,
                        1,
                    ),
                    developmentState: child.developmentState,
                    cluster: child.cluster,
                    horizontalRelease: child.horizontalRelease,
                    completionFork,
                    birthMode,
                    reservedAtEvent: sequence,
                });
                context.strategyReceipts.push(Object.freeze({
                    kind: 'fork_schedule',
                    sequence,
                    frontierId: childFrontier.id,
                    lineageId: lineage.id,
                    baseAge: child.forkAgePlan.baseAge,
                    strategyAdjustedAge: child.forkAgePlan.age,
                    scheduledAge: childFrontier.nextForkAge,
                    suppression: child.forkAgePlan.suppression,
                    field: child.forkAgePlan.strategyField,
                    forecastAtBirth: Boolean(reiterationForecast > 0),
                }));
                createdNodeIds.push(patchedNode.id);
                createdSegmentIds.push(segment.id);
                createdFrontierIds.push(childFrontier.id);
                createdCorridorIds.push(
                    context.frontierCorridorIndex.get(childFrontier.id),
                );
                childReceipts.push({
                    lineageId: lineage.id,
                    frontierId: childFrontier.id,
                    resourceShare: rounded(child.share),
                    resourceRank: child.decision.resourceRank,
                    tier: child.tier,
                    tierName: TIER_NAMES[child.tier],
                    axisOrder: child.axisOrder,
                    birthMode,
                    tierReason: child.decision.reason,
                    axisRetentionPotential: rounded(
                        child.decision.retentionPotential,
                    ),
                    axisIdentity: child.decision.identitySignal,
                    tierRole: child.decision.tierRole,
                    familyOutcome: child.decision.familyOutcome,
                    relativeDifferentiation:
                        child.relativeDifferentiation,
                    role,
                    startAngleDegrees: rounded(
                        angularDistance(frontier.heading, child.direction) * 180 / Math.PI,
                        3,
                    ),
                    referenceAngleDegrees: rounded(
                        angularDistance(referenceFrame.heading, child.direction) * 180 / Math.PI,
                        3,
                    ),
                    signedStartAngleDegrees: rounded(
                        signedPlanarAngle(frontier.heading, child.direction) * 180 / Math.PI,
                        3,
                    ),
                    initialForwardDot: rounded(dot(frontier.heading, child.direction)),
                    groundVerticalAngleDegrees: rounded(
                        angularDistance({ x: 0, y: 1, z: 0 }, child.direction)
                            * 180 / Math.PI,
                        3,
                    ),
                    episodeId: childEpisode.id,
                    episodeKind: childEpisode.kind,
                    laterReforked: false,
                    sagActive,
                    corridorHorizon: child.corridorPreview.horizon,
                    corridorConflictScore: rounded(child.corridorScore),
                    resourceReserve: rounded(childResourceReserve),
                    reiterationForecast,
                    reiterationReserve: rounded(child.reiterationReserve),
                    axisStepLimit: childFrontier.axisStepLimit,
                    axisHardLimit: childFrontier.axisHardLimit,
                    constructionReserve: rounded(childFrontier.constructionReserve),
                    sourceConstructionGrant: rounded(child.constructionGrant),
                    birthConstructionCost: rounded(birthConstructionCost),
                    requestedBirthLength: rounded(child.requestedBirthLength),
                    realizedBirthLength: rounded(child.runLength),
                    constructionPortfolio,
                    meristemCadence,
                    scaffoldFamilyGesture: child.scaffoldFamilyGesture,
                    crownBirthOpportunity: child.crownBirthOpportunity || null,
                    scaffoldFamilyDominanceClaim,
                    scaffoldFamilyDominance:
                        resolveScaffoldFamilyDominance(
                            scaffoldFamilyDominanceClaim,
                        ),
                    persistencePlan: Object.freeze({
                        semantics: 'portfolio_owned_axis_horizon_v1',
                        plannedInternodeCount: axisStepLimit,
                        forkRhythmScale: constructionPortfolio.forkRhythmScale,
                        lateralHorizonScale:
                            constructionPortfolio.lateralHorizonScale,
                    }),
                    initialDepth: rounded(child.direction.z),
                    clusterId: child.cluster?.id || null,
                    clusterCompactness: child.cluster?.compactness ?? null,
                    absoluteDevelopmentalCapacity: rounded(child.absoluteCapacity),
                    growthCapacity: rounded(child.growthCapacity),
                    extensionCapacity: rounded(child.extensionCapacity),
                    supportCapacity: rounded(child.supportCapacity),
                    supportBudget: rounded(child.supportBudget),
                    extensionBudget: rounded(child.extensionBudget),
                    reiterationBudget: rounded(child.reiterationBudget),
                    supportAllocation: rounded(child.supportShare),
                    extensionAllocation: rounded(child.extensionShare),
                    reiterationAllocation: rounded(child.reiterationShare),
                    reiterationPotential: rounded(child.reiterationPotential),
                    allocationCharacter: child.allocationCharacter,
                    supportToExtension: rounded(child.supportToExtension),
                    maturationState: child.maturationState,
                    successionKinkRole: child.successionKinkRole,
                    successionKinkState: childSuccessionKinkState,
                    secondaryMaturation: Object.freeze({
                        semantics: 'portfolio_applied_lateral_horizon_v1',
                        localInvestment:
                            constructionPortfolio.lateralInvestmentScale,
                        horizonScale:
                            constructionPortfolio.lateralHorizonScale,
                    }),
                    restDelay: rounded(restDelay),
                    axisReachScale: rounded(child.temperament.axisReachScale),
                    developmentalPhase: rounded(child.temperament.developmentalPhase),
                    forkContrastBias: rounded(child.temperament.forkContrastBias),
                    lineageResponse: child.temperament.lineageResponse,
                    successionTurnSign: childHandoffPlan.sign,
                    handoffRepeated: childHandoffPlan.repeated,
                    handoffRhythmSignal: childHandoffPlan.rhythmSignal,
                    handoffLineagePhase: childHandoffPlan.lineagePhase,
                    junctionAreaShare: rounded(child.junctionAreaShare),
                    expectedExtent: rounded(child.expectedExtent),
                    junctionMassShare: rounded(child.junctionMassShare),
                    junctionAllocationMode: child.allocationMode,
                    angleShare: rounded(child.angleShare),
                    flowDirectionWeight: rounded(child.flowDirectionWeight),
                    projectedLoad: rounded(child.projectedLoad),
                    projectedLoadMoment: rounded(child.projectedLoadMoment),
                    centerlineField: child.centerlineField,
                    radialConstraint: child.radialConstraint,
                    lateralGravityFrame: child.lateralGravityFrame,
                    structuralStation: child.structuralStation || null,
                    emergenceScale: rounded(child.emergenceScale),
                    forkArchetype,
                    horizontalRelease: child.horizontalRelease,
                    completionFork,
                    orderZeroSupportCorrectionRadians: rounded(
                        child.orderZeroSupportCorrectionRadians || 0,
                    ),
                    forkRhythmField: child.forkAgePlan.strategyField,
                    baseNextForkAge: child.forkAgePlan.baseAge,
                    resourceScheduledNextForkAge: nextForkAge,
                    portfolioForkAge,
                    scheduledNextForkAge: nextForkAge,
                    forkRhythmSuppression: child.forkAgePlan.suppression,
                });
            });
            const parentLineage = context.lineageIndex.get(frontier.lineageId);
            parentLineage.endEvent = sequence;
            parentLineage.endKind = 'fork';
            const weightedDirection = normalize(childReceipts.reduce(
                (vector, child, index) => add(
                    vector,
                    scale(provisional[index].direction, child.angleShare),
                ),
                { x: 0, y: 0, z: 0 },
            ));
            const resourceWeightedDirection = normalize(childReceipts.reduce(
                (vector, child, index) => add(
                    vector,
                    scale(provisional[index].direction, child.resourceShare),
                ),
                { x: 0, y: 0, z: 0 },
            ));
            const flowWeightedDirection = normalize(childReceipts.reduce(
                (vector, child, index) => add(
                    vector,
                    scale(
                        provisional[index].direction,
                        child.flowDirectionWeight,
                    ),
                ),
                { x: 0, y: 0, z: 0 },
            ));
            const splitReceipt = {
                id: `split-${String(context.rawSplits.length + 1).padStart(4, '0')}`,
                sequence,
                originNodeId: frontier.nodeId,
                parentFrontierId: frontier.id,
                parentLineageId: frontier.lineageId,
                parentTier: frontier.tier,
                forkIdentityIntent: forkIntent,
                visibleScaffoldPermission,
                parentHeading: frontier.heading,
                resourceShares: shares,
                resourceShareReceipt,
                flowDirectionPlan,
                axisIdentitySignals,
                childDevelopmentBudget,
                tierArchitecture: childDevelopmentBudget.tierArchitecture,
                structuralStation,
                growthAllocationShares: Object.freeze(childReceipts.map(
                    (child) => child.extensionAllocation,
                )),
                supportAllocationShares: Object.freeze(childReceipts.map(
                    (child) => child.supportAllocation,
                )),
                reiterationAllocationShares: Object.freeze(childReceipts.map(
                    (child) => child.reiterationAllocation,
                )),
                angleShares: Object.freeze(childReceipts.map(
                    (child) => child.angleShare,
                )),
                junctionAreaShares: Object.freeze(childReceipts.map(
                    (child) => child.junctionAreaShare,
                )),
                junctionMassShares: Object.freeze(childReceipts.map(
                    (child) => child.junctionMassShare,
                )),
                areaGain: rounded(areaGain),
                children: childReceipts,
                divergenceRadians: rounded(divergence),
                apertureRadians: rounded(divergence),
                angleSemantics: ANGLE_SEMANTICS,
                referenceFrame,
                rigidFrameCorrectionRadians: rounded(rigidFrameCorrection),
                rigidDepthCorrection: rounded(rigidDepthCorrection),
                grammar: forkArchetype,
                completionFork,
                horizontalRelease,
                forkSidePlan,
                nextHandoffPlan,
                supportedForkPlan,
                siblingSeparationPlan,
                projectedLoadPlan,
                successionKink,
                resourceContrastTrajectory,
                apertureStrategy: Object.freeze({
                    field: aperturePlan.strategyField,
                    developmentalTrajectory: aperturePlan.developmentalTrajectory,
                    baseApertureRadians: aperturePlan.baseApertureRadians,
                    requestedApertureRadians: rounded(requestedDivergence),
                    applied: !horizontalRelease,
                    suppression: horizontalRelease ? 'world_horizontal_release' : null,
                }),
                allocationStrategy: developmentalAllocations[0]?.strategyField || null,
                meristemCompetition,
                weightedMeanAngleDegrees: rounded(
                    angularDistance(referenceFrame.heading, weightedDirection) * 180 / Math.PI,
                    3,
                ),
                weightedMeanParentAngleDegrees: rounded(
                    angularDistance(frontier.heading, weightedDirection) * 180 / Math.PI,
                    3,
                ),
                resourceWeightedMeanAngleDegrees: rounded(
                    angularDistance(referenceFrame.heading, resourceWeightedDirection)
                        * 180 / Math.PI,
                    3,
                ),
                flowWeightedMeanAngleDegrees: rounded(
                    angularDistance(referenceFrame.heading, flowWeightedDirection)
                        * 180 / Math.PI,
                    3,
                ),
            };
            context.visibleScaffoldPermissionReceipts.push(
                visibleScaffoldPermission,
            );
            context.rawSplits.push(splitReceipt);
            context.developmentReceipts.push(Object.freeze({
                kind: 'fork_field_survival',
                sequence,
                frontierId: frontier.id,
                lineageId: frontier.lineageId,
                forkIdentityIntent: forkIntent,
                visibleScaffoldPermission,
                requestedApertureRadians: rounded(requestedDivergence),
                realizedApertureRadians: rounded(divergence),
                supportProjectionApplied: Boolean(supportedForkPlan.supportApplied),
                radialProjectionApplied: provisional.some(
                    (child) => child.radialConstraint?.applied,
                ),
                allocationDecoupling: developmentalAllocations[0]?.signedDecoupling || 0,
                lateralInvestmentScale: developmentalAllocations[0]
                    ?.lateralInvestmentScale || 1,
                childReiterationReserves: Object.freeze(provisional.map(
                    (child) => rounded(child.reiterationReserve),
                )),
                childDevelopmentBudget,
                resourceContrastTrajectory,
                resourceShareReceipt,
                flowDirectionPlan,
                apertureTrajectory: aperturePlan.developmentalTrajectory,
                siblingSeparationPlan,
                successionKink,
                tierArchitecture: childDevelopmentBudget.tierArchitecture,
                structuralStation,
            }));
            context.events.push(Object.freeze({
                id: idFor(context, 'event'),
                sequence,
                kind: 'fork',
                completionFork,
                consumedFrontierId: frontier.id,
                originNodeId: frontier.nodeId,
                forkIdentityIntent: forkIntent,
                visibleScaffoldPermission,
                splitArity: arity,
                resourceShares: shares,
                resourceShareReceipt,
                flowDirectionPlan,
                axisIdentitySignals,
                childDevelopmentBudget,
                growthAllocationShares: splitReceipt.growthAllocationShares,
                supportAllocationShares: splitReceipt.supportAllocationShares,
                reiterationAllocationShares: splitReceipt.reiterationAllocationShares,
                angleShares: splitReceipt.angleShares,
                junctionAreaShares: splitReceipt.junctionAreaShares,
                junctionMassShares: splitReceipt.junctionMassShares,
                areaGain: rounded(areaGain),
                tierDecisions: Object.freeze(decisions),
                suppressedLateralMeristemIds:
                    meristemCompetition.suppressedLateralMeristemIds,
                createdNodeIds: Object.freeze(createdNodeIds),
                createdSegmentIds: Object.freeze(createdSegmentIds),
                createdFrontierIds: Object.freeze(createdFrontierIds),
                releasedCorridorIds: Object.freeze(
                    releasedCorridorId ? [releasedCorridorId] : [],
                ),
                createdCorridorIds: Object.freeze(createdCorridorIds.filter(Boolean)),
                activeFrontierIdsAfter: activeSnapshot(context),
                activeCorridorIdsAfter: activeCorridorSnapshot(context),
                steering: Object.freeze({
                    divergenceRadians: rounded(divergence),
                    apertureRadians: rounded(divergence),
                    forkArchetype,
                    completionFork,
                    horizontalRelease,
                    forkSidePlan,
                    nextHandoffPlan,
                    childHandoffPlans: Object.freeze(provisional.map(
                        (child) => child.handoffPlan,
                    )),
                    successionKink,
                    structuralStation,
                    meristemCompetition,
                    supportedForkPlan,
                    siblingSeparationPlan,
                    referenceFrame,
                    childStartAngleDegrees: Object.freeze(childReceipts.map(
                        (child) => child.startAngleDegrees,
                    )),
                    weightedMeanAngleDegrees: splitReceipt.weightedMeanAngleDegrees,
                    weightedMeanParentAngleDegrees: splitReceipt.weightedMeanParentAngleDegrees,
                    rigidDepthCorrection: rounded(rigidDepthCorrection),
                    balanceField: referenceFrame.balanceField,
                    corridorHorizons: Object.freeze(provisional.map(
                        (child) => child.corridorPreview.horizon,
                    )),
                    corridorConflictScores: Object.freeze(provisional.map(
                        (child) => rounded(child.corridorScore),
                    )),
                    childDepths: Object.freeze(provisional.map(
                        (child) => rounded(child.direction.z),
                    )),
                }),
            }));
        }


        return Object.freeze({
            roleForDecision,
            prepareForkIdentityIntent,
            reserveForkIdentityIntent,
            forkEvent,
        });
    }

    scope.ZenBonsaiTypedDevelopmentalSchedulerForkTransaction = Object.freeze({
        FORK_IDENTITY_INTENT_SEMANTICS,
        createOwner,
    });
}(globalThis));
