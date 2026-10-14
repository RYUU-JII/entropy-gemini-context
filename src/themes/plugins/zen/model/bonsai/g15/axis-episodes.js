/**
 * G15.4 axis episode owner.
 *
 * Heading intent, correlated episode commitment, recommitment, and bounded
 * axis lifespan are resolved here. This owner does not mutate graph topology.
 */
(function installTypedDevelopmentalAxisEpisodes(scope) {
    'use strict';

    const programs = scope.ZenBonsaiTypedDevelopmentalSchedulerPrograms;
    const strategyOwner = scope.ZenBonsaiTypedDevelopmentalSchedulerStrategy;
    if (!programs || !strategyOwner) {
        throw new Error(
            '[G15.4_EPISODE] developmental-programs.js and developmental-strategy.js must load first.',
        );
    }
    const {
        PRESETS,
        TIERS,
        EPISODE_SEMANTICS,
        AXIS_SUCCESSION_SEMANTICS,
        clamp,
        subtract,
        distance,
        dot,
        normalize,
        mixDirection,
        rotateGrowthPlane,
        tiltDepth,
        constrainDirectionToCone,
        stabilizeOrderZeroHeading,
        rounded,
    } = programs;
    const { evaluateStrategyAxis } = strategyOwner;

    function createOwner(dependencies) {
        const required = [
            'idFor',
            'nodeById',
            'resolveFutureBalanceField',
            'resolveCrownCompletionStatus',
            'clusterTargetFor',
        ];
        const missing = required.filter((name) => (
            !dependencies || typeof dependencies[name] !== 'function'
        ));
        if (missing.length) {
            throw new Error('[G15.4_EPISODE] Missing owner dependencies: ' + missing.join(', '));
        }
        const {
            idFor,
            nodeById,
            resolveFutureBalanceField,
            resolveCrownCompletionStatus,
            clusterTargetFor,
        } = dependencies;
        function axisCoherenceCone(frontier) {
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
            if (frontier.horizontalRelease) return 0.82 + continuity * 0.22;
            return clamp(0.72 + continuity * 0.72 - terminal * 0.16, 0.62, Math.PI);
        }
    
        function stabilizeAxisIntent(context, frontier, direction) {
            if (
                frontier.axisOrder === 0
                && !frontier.sag?.active
            ) {
                return stabilizeOrderZeroHeading(context, direction);
            }
            if (
                frontier.sag?.active
                || !frontier.axisEntryHeading
            ) return normalize(direction);
            let stabilized = constrainDirectionToCone(
                direction,
                frontier.axisEntryHeading,
                axisCoherenceCone(frontier),
            );
            if (frontier.horizontalRelease && stabilized.y < -0.06) {
                stabilized = normalize({
                    x: stabilized.x,
                    y: -0.06,
                    z: stabilized.z,
                });
            }
            return stabilized;
        }
    
        function resolveEpisodeIntent(context, frontier, turnSign, turnAmount, intentKind = 'recommit') {
            const { form, phenotype, preset, rng } = context;
            const strategyPoint = frontier.nodeId
                ? nodeById(context, frontier.nodeId)?.point
                : { x: 0, y: 0, z: 0 };
            const curvatureField = evaluateStrategyAxis(
                context,
                'curvature_field',
                frontier,
                strategyPoint,
            );
            const lineageCurvature = frontier.temperament
                ?.lineageResponse?.curvature_field || 0;
            const effectiveTurnAmount = turnAmount
                * curvatureField.effect.turnScale
                * Math.exp(lineageCurvature * 0.1);
            let target = rotateGrowthPlane(
                frontier.heading,
                turnSign * effectiveTurnAmount,
            );
            const side = frontier.formSide
                || Math.sign(frontier.heading.x)
                || phenotype.asymmetrySign;
            const continuity = clamp(
                Number(frontier.developmentState?.apicalContinuity ?? 0.5),
                0,
                1,
            );
            if (form.kind === 'low_spread' && continuity >= 0.28) {
                const outward = normalize({
                    x: side * 0.94,
                    y: 0.38 - continuity * 0.06,
                    z: target.z,
                });
                target = mixDirection(target, outward, 0.32);
            } else if (form.kind === 'asymmetric_counterweight') {
                const desiredSide = side || phenotype.asymmetrySign;
                target = mixDirection(target, normalize({
                    x: desiredSide * (0.84 - continuity * 0.16),
                    y: 0.44 + continuity * 0.3,
                    z: target.z,
                }), 0.16 + phenotype.asymmetry * 0.1);
            } else if (form.kind === 'terminal_multisplit') {
                target = mixDirection(target, normalize({
                    x: side * (0.72 - continuity * 0.2),
                    y: 0.84,
                    z: target.z,
                }), 0.2);
            }
            const verticalWeight = form.referenceVerticalWeight
                * phenotype.verticalIntent
                * (0.28 + continuity * 0.72)
                * (intentKind === 'recovery' ? 1.8 : 1);
            if (preset !== PRESETS.kengai && verticalWeight > 0) {
                target = mixDirection(target, { x: 0, y: 1, z: 0 }, verticalWeight);
            }
            const windTarget = normalize({ x: preset.wind, y: 1, z: 0 });
            const windWeight = Math.min(0.12, Math.abs(preset.wind) * 0.3);
            if (windWeight > 0) target = mixDirection(target, windTarget, windWeight);
            const balanceField = resolveFutureBalanceField(
                context,
                frontier.nodeId ? frontier : null,
            );
            const completionStatus = resolveCrownCompletionStatus(context);
            const balanceApplied = completionStatus.phase === 'structural_completion'
                && intentKind !== 'root';
            if (balanceApplied) {
                const balanceTarget = normalize({
                    x: target.x + balanceField.pressureX * 1.8,
                    y: target.y,
                    z: target.z + balanceField.pressureZ * 1.5,
                });
                target = mixDirection(
                    target,
                    balanceTarget,
                    phenotype.completionBalanceStrength,
                );
            }
            target = tiltDepth(
                target,
                rng.range(-1, 1) * (
                    0.035
                        + (1 - continuity) * 0.055
                        + Number(frontier.developmentState?.terminalAffinity || 0)
                            * 0.025
                ),
            );
            if (frontier.cluster) {
                const origin = nodeById(context, frontier.nodeId)?.point;
                const familyTarget = clusterTargetFor(frontier);
                if (origin && familyTarget && distance(origin, familyTarget) > frontier.cluster.radius * 0.22) {
                    const clusterHeading = normalize(subtract(familyTarget, origin));
                    if (dot(frontier.heading, clusterHeading) <= 0.06) {
                        return Object.freeze({
                            heading: stabilizeAxisIntent(context, frontier, target),
                            balanceField,
                            balanceApplied,
                            completionStatus,
                            intentKind,
                            verticalWeight: rounded(verticalWeight),
                            strategyField: curvatureField,
                        });
                    }
                    target = mixDirection(
                        target,
                        clusterHeading,
                        0.08 + frontier.cluster.compactness * 0.08,
                    );
                }
            }
            return Object.freeze({
                heading: stabilizeAxisIntent(context, frontier, target),
                balanceField,
                balanceApplied,
                completionStatus,
                intentKind,
                verticalWeight: rounded(verticalWeight),
                strategyField: curvatureField,
            });
        }
    
        function createEpisode(context, spec) {
            const durationBias = context.phenotype.episodeRecommitment;
            const commitmentDuration = clamp(
                spec.commitmentDuration
                    ?? context.rng.integer(durationBias > 0.66 ? 2 : 3, durationBias > 0.66 ? 4 : 5),
                2,
                5,
            );
            return Object.freeze({
                id: idFor(context, 'episode'),
                semantics: EPISODE_SEMANTICS,
                kind: spec.kind,
                archetype: spec.archetype || 'extension',
                targetHeading: Object.freeze({ ...normalize(spec.targetHeading) }),
                headingCone: rounded(spec.headingCone ?? 0.18),
                bendPlane: Object.freeze({
                    x: rounded(spec.bendPlane?.x ?? 0),
                    y: rounded(spec.bendPlane?.y ?? 0),
                    z: rounded(spec.bendPlane?.z ?? 1),
                }),
                turnSign: spec.turnSign,
                turnPersistence: rounded(spec.turnPersistence),
                commitmentDuration,
                segmentLengthScale: rounded(spec.segmentLengthScale ?? 1),
                curvatureVelocity: rounded(spec.curvatureVelocity),
                gravityResponse: rounded(spec.gravityResponse),
                afterCommitment: spec.afterCommitment || 'recommit',
                parentEpisodeId: spec.parentEpisodeId || null,
                birthEvent: spec.birthEvent,
                intentReceipt: spec.intentReceipt || null,
            });
        }
    
        function createRootEpisode(context, heading) {
            const turnSign = context.phenotype.asymmetrySign;
            const turnAmount = context.rng.range(
                context.form.episodeTurn[0],
                context.form.episodeTurn[1],
            ) * 0.4;
            const proxy = {
                heading,
                tier: 0,
                formSide: 0,
            };
            const intent = resolveEpisodeIntent(context, proxy, turnSign, turnAmount, 'root');
            return createEpisode(context, {
                kind: 'root_extension_commit',
                archetype: 'extension',
                targetHeading: intent.heading,
                turnSign,
                turnPersistence: context.phenotype.curvaturePersistence,
                curvatureVelocity: turnSign * context.rng.range(0.02, 0.055),
                gravityResponse: 0,
                birthEvent: 0,
                intentReceipt: intent,
            });
        }
    
        function createChildEpisode(context, parent, spec) {
            const lateralRelease = Number(spec.axisOrder ?? spec.tier)
                > Number(parent.axisOrder ?? parent.tier);
            const strongestShare = Math.max(...spec.siblingShares);
            const isMajor = Math.abs(spec.resourceShare - strongestShare) <= 1e-10;
            const gravityOwned = lateralRelease && (
                context.form.kind === 'weeping_release'
                || context.traitId === 'weeping_temperament'
                || context.phenotype.sagResponse > 0.7
            );
            const identityRetained = Number(spec.axisOrder ?? spec.tier)
                === Number(parent.axisOrder ?? parent.tier);
            let kind = identityRetained
                ? 'recursive_identity_commit'
                : 'identity_transition_commit';
            if (
                spec.forkArchetype === 'identity_transition_handoff'
                && identityRetained
            ) {
                kind = 'identity_retention_commit';
            } else if (spec.forkArchetype === 'momentum_continuation' && isMajor) {
                kind = 'momentum_continuation_commit';
            }
            if (gravityOwned) kind = 'lateral_release_then_sag';
            if (context.form.kind === 'low_spread' && spec.tier === 0) {
                kind = 'codominant_outward_reach';
            } else if (
                context.form.kind === 'asymmetric_counterweight'
                && spec.resourceShare < Math.max(...spec.siblingShares)
            ) {
                kind = 'living_counterweight_reach';
            } else if (context.form.kind === 'terminal_multisplit') {
                kind = 'terminal_fan_commit';
            }
            if (
                spec.cluster
                && spec.tier >= 1
                && !gravityOwned
                && kind === 'identity_transition_commit'
            ) {
                kind = 'terminal_cluster_commit';
            }
            if (spec.completionFork && !gravityOwned) kind = 'crown_completion_commit';
            if (spec.horizontalRelease && !gravityOwned) {
                kind = 'horizontal_scaffold_commit';
            }
            if (spec.successionKinkRole === 'kinked_order_zero_succession') {
                kind = 'succession_kink_commit';
            }
            const outwardTurnSign = Math.sign(Number(spec.offset))
                || -parent.episode.turnSign;
            // Complementary lineage phases prevent both siblings from tracing
            // the same episode with opposite signs. One may continue opening
            // while the other settles into a quieter, more parallel run.
            const turnSign = spec.temperament.developmentalPhase >= 0
                ? outwardTurnSign
                : -outwardTurnSign;
            const identityContinuation = identityRetained && (
                spec.forkArchetype === 'identity_transition_handoff'
                || (spec.forkArchetype === 'momentum_continuation' && isMajor)
            );
            const continuationDeflectionScale = identityContinuation
                ? clamp((1 - spec.extensionAllocation) * 1.35, 0.2, 0.82)
                : 1;
            const curvatureField = evaluateStrategyAxis(
                context,
                'curvature_field',
                {
                    nodeId: null,
                    tier: spec.tier,
                    radius: spec.radius,
                    axisAge: 1,
                    axisStepLimit: TIERS[spec.tier].maximumAxisSteps,
                    temperament: spec.temperament,
                    developmentState: spec.developmentState,
                },
                spec.origin,
            );
            const lineageCurvature = spec.temperament
                ?.lineageResponse?.curvature_field || 0;
            const targetTurn = context.rng.range(0.035, 0.13)
                * context.phenotype.curvaturePersistence
                * continuationDeflectionScale
                * curvatureField.effect.turnScale
                * Math.exp(lineageCurvature * 0.1);
            let targetHeading = rotateGrowthPlane(spec.heading, turnSign * targetTurn);
            if (identityContinuation && spec.referenceHeading) {
                targetHeading = mixDirection(
                    targetHeading,
                    spec.referenceHeading,
                    0.13,
                );
            }
            if (
                identityContinuation
                && spec.tier === 0
                && context.form.kind === 'central_recursive_meander'
            ) {
                targetHeading = mixDirection(
                    targetHeading,
                    { x: 0, y: 1, z: 0 },
                    clamp((1 - spec.extensionAllocation) * 0.2, 0.02, 0.12),
                );
            }
            if (lateralRelease && !gravityOwned && !spec.terminalRamification) {
                const releaseSide = Math.sign(spec.heading.x) || turnSign;
                targetHeading = mixDirection(targetHeading, normalize({
                    x: releaseSide * 0.94,
                    y: context.form.kind === 'low_spread' ? 0.26 : 0.38,
                    z: targetHeading.z,
                }), 0.14);
            }
            if (kind === 'codominant_outward_reach') {
                targetHeading = mixDirection(targetHeading, normalize({
                    x: (spec.formSide || turnSign) * 0.96,
                    y: 0.3,
                    z: targetHeading.z,
                }), 0.34);
            }
            if (spec.cluster && spec.origin && !gravityOwned) {
                const clusterHeading = normalize(subtract(spec.cluster.center, spec.origin));
                targetHeading = mixDirection(
                    targetHeading,
                    clusterHeading,
                    0.1 + spec.cluster.compactness * 0.09,
                );
            }
            if (spec.horizontalRelease) {
                const horizontalSide = Math.sign(spec.heading.x) || turnSign;
                targetHeading = mixDirection(targetHeading, normalize({
                    x: horizontalSide * 0.996,
                    y: 0.09,
                    z: targetHeading.z * 0.42,
                }), gravityOwned ? 0.32 : 0.22);
            }
            if (spec.terminalRamification) {
                targetHeading = constrainDirectionToCone(
                    targetHeading,
                    spec.heading,
                    0.26,
                );
            }
            if (spec.successionKinkRole === 'kinked_order_zero_succession') {
                // The kink direction has already passed the hard world-up and
                // sibling-separation projection. Do not blend it back toward
                // the parent reference or vertical during episode creation.
                targetHeading = spec.heading;
            }
            let archetype = lateralRelease ? 'deflection' : 'extension';
            if (kind === 'identity_retention_commit') archetype = 'identity_handoff';
            if (spec.completionFork) archetype = 'crown_completion';
            if (spec.horizontalRelease) archetype = 'world_horizontal_release';
            if (spec.terminalRamification) archetype = 'terminal_ramification';
            if (gravityOwned) archetype = 'gravity_release';
            if (spec.successionKinkRole === 'kinked_order_zero_succession') {
                archetype = 'succession_kink';
            }
            return createEpisode(context, {
                kind,
                archetype,
                targetHeading,
                turnSign,
                turnPersistence: clamp(
                    parent.episode.turnPersistence * 0.7
                        + context.phenotype.curvaturePersistence * 0.3,
                    0.56,
                    1.36,
                ),
                commitmentDuration: spec.successionKinkRole
                    === 'kinked_order_zero_succession'
                    ? 2
                    : (gravityOwned
                    ? 5
                    : (spec.terminalRamification
                        ? 3
                        : (spec.horizontalRelease
                            ? 4
                            : (spec.completionFork ? 3 : undefined)))),
                segmentLengthScale: spec.completionFork
                    ? 1.04
                    : (lateralRelease ? 0.96 : 1.02),
                curvatureVelocity: identityContinuation
                    ? parent.turnVelocity * 0.24
                        + turnSign * context.rng.range(0.004, 0.014)
                    : parent.turnVelocity * (
                        0.28
                            + Number(spec.developmentState?.apicalContinuity || 0)
                                * 0.22
                    )
                        + turnSign * context.rng.range(
                            0.006
                                + Number(spec.developmentState?.apicalContinuity || 0)
                                    * 0.006,
                            0.022
                                + Number(spec.developmentState?.apicalContinuity || 0)
                                    * 0.018,
                        ),
                gravityResponse: gravityOwned
                    ? clamp(
                        context.phenotype.sagResponse
                            * spec.temperament.gravitySensitivity,
                        0.42,
                        0.96,
                    )
                    : 0,
                parentEpisodeId: parent.episode.id,
                birthEvent: spec.birthEvent,
                intentReceipt: Object.freeze({
                    semantics: AXIS_SUCCESSION_SEMANTICS,
                    forkArchetype: spec.forkArchetype,
                    isMajor,
                    referenceHeading: spec.referenceHeading || null,
                    horizontalRelease: Boolean(spec.horizontalRelease),
                    terminalRamification: Boolean(spec.terminalRamification),
                    completionFork: Boolean(spec.completionFork),
                    successionKinkRole: spec.successionKinkRole || null,
                    strategyField: curvatureField,
                }),
            });
        }
    
        function recommitEpisode(context, frontier, sequence) {
            const alternationChance = clamp(
                1 - frontier.temperament.turnSignPersistence
                    + (context.form.kind === 'central_recursive_meander' ? 0.16 : 0.02),
                0.18,
                0.88,
            );
            const turnSign = context.rng.next() < alternationChance
                ? -frontier.episode.turnSign
                : frontier.episode.turnSign;
            const roll = context.rng.next();
            let archetype = 'deflection';
            if (frontier.sag.active && frontier.sag.age >= frontier.sag.recoveryAfter) {
                archetype = 'recovery';
            } else if (
                frontier.resourceReserve < 0.42
                || frontier.maintenanceDebt > 0.14
                || frontier.spatialExposure < 0.34
            ) {
                archetype = 'compression';
            } else if (roll < 0.34 + frontier.temperament.recommitment * 0.22) {
                archetype = 'extension';
            } else if (roll > 0.88) {
                archetype = 'recovery';
            }
            const [minimumTurn, maximumTurn] = context.form.episodeTurn;
            const archetypeTurnScale = archetype === 'extension'
                ? 0.48
                : (archetype === 'recovery' ? 0.62 : (archetype === 'compression' ? 0.38 : 1));
            const axisOrderTurnScale = clamp(
                0.36
                    + Number(frontier.developmentState?.apicalContinuity ?? 0.5)
                        * 0.64,
                0.36,
                1,
            );
            const turnAmount = context.rng.range(minimumTurn, maximumTurn)
                * context.preset.turnScale
                * frontier.temperament.turnScale
                * archetypeTurnScale
                * axisOrderTurnScale;
            const intent = resolveEpisodeIntent(
                context,
                frontier,
                turnSign,
                turnAmount,
                archetype,
            );
            let targetHeading = intent.heading;
            if (archetype === 'extension') {
                targetHeading = mixDirection(frontier.heading, targetHeading, 0.42);
            } else if (archetype === 'compression') {
                targetHeading = mixDirection(frontier.heading, targetHeading, 0.3);
            }
            targetHeading = stabilizeAxisIntent(context, frontier, targetHeading);
            const sagStillActive = frontier.sag.active
                && frontier.sag.age < frontier.sag.recoveryAfter;
            return createEpisode(context, {
                kind: sagStillActive ? 'sag_commit' : 'episode_recommit',
                archetype: sagStillActive ? 'gravity_release' : archetype,
                targetHeading,
                turnSign,
                turnPersistence: frontier.temperament.curvatureMemory,
                curvatureVelocity: frontier.turnVelocity * (
                    0.3
                        + Number(frontier.developmentState?.apicalContinuity || 0)
                            * 0.18
                )
                    + turnSign * context.rng.range(
                        0.008
                            + Number(frontier.developmentState?.apicalContinuity || 0)
                                * 0.017,
                        0.026
                            + Number(frontier.developmentState?.apicalContinuity || 0)
                                * 0.044,
                    ),
                gravityResponse: sagStillActive
                    ? frontier.episode.gravityResponse
                    : 0,
                commitmentDuration: archetype === 'compression'
                    ? 2
                    : (archetype === 'extension' ? 4 : undefined),
                segmentLengthScale: archetype === 'compression'
                    ? 0.76
                    : (archetype === 'extension' ? 1.08 : 1),
                parentEpisodeId: frontier.episode.id,
                birthEvent: sequence,
                intentReceipt: intent,
            });
        }
    
        function resolveFirstForkPlan(context) {
            const [minimum, maximum] = context.form.firstForkAge;
            const tempoShift = context.phenotype.ramificationTempo > 0.66 ? -1 : 0;
            const densityShift = context.density > 1.12
                ? -1
                : (context.density < 0.82 ? 1 : 0);
            const baseAge = clamp(
                context.rng.integer(minimum, maximum) + tempoShift + densityShift,
                2,
                6,
            );
            const strategyField = evaluateStrategyAxis(
                context,
                'fork_rhythm',
                {
                    tier: 0,
                    radius: 18.5 * context.vigor,
                    axisAge: 0,
                    axisStepLimit: TIERS[0].maximumAxisSteps,
                },
                { x: 0, y: 0, z: 0 },
            );
            const continuousAge = clamp(
                baseAge * strategyField.effect.forkIntervalScale,
                2,
                6,
            );
            return Object.freeze({
                age: Math.round(continuousAge),
                continuousAge: rounded(continuousAge),
                baseAge,
                strategyField,
                suppression: null,
            });
        }

        function resolveFirstForkAge(context) {
            return resolveFirstForkPlan(context).age;
        }
    
        function resolveNextForkPlan(
            context,
            tier,
            sagActive = false,
            temperament = null,
            site = {},
        ) {
            const config = TIERS[tier];
            const strategyField = evaluateStrategyAxis(
                context,
                'fork_rhythm',
                {
                    tier,
                    radius: site.radius,
                    axisAge: site.axisAge ?? 1,
                    axisStepLimit: site.axisStepLimit ?? config.maximumAxisSteps,
                    temperament,
                },
                site.point,
            );
            if (sagActive) {
                return Object.freeze({
                    age: 6,
                    baseAge: 6,
                    strategyField,
                    suppression: 'sag_commitment',
                });
            }
            const tempo = context.phenotype.ramificationTempo;
            const shift = tempo > 0.72 ? -1 : (tempo < 0.32 ? 1 : 0);
            const densityShift = context.density > 1.12
                ? -1
                : (context.density < 0.82 ? 1 : 0);
            const intervalScale = (temperament?.forkIntervalScale ?? 1)
                * clamp(
                    1 + ((temperament?.axisReachScale ?? 1) - 1) * 0.34,
                    0.86,
                    1.14,
                )
                * Math.exp(
                    (temperament?.lineageResponse?.fork_rhythm || 0) * 0.16,
                );
            const baseAge = clamp(
                Math.round(context.rng.integer(config.forkAge[0], config.forkAge[1])
                    * intervalScale)
                    + shift
                    + densityShift,
                2,
                tier === 0 ? 6 : 5,
            );
            return Object.freeze({
                age: clamp(
                    Math.round(baseAge * strategyField.effect.forkIntervalScale),
                    2,
                    tier === 0 ? 6 : 5,
                ),
                baseAge,
                strategyField,
                suppression: null,
            });
        }

        function resolveNextForkAge(
            context,
            tier,
            sagActive = false,
            temperament = null,
            site = {},
        ) {
            return resolveNextForkPlan(context, tier, sagActive, temperament, site).age;
        }
    
        return Object.freeze({
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
        });
    }

    scope.ZenBonsaiTypedDevelopmentalSchedulerAxisEpisodes = Object.freeze({
        createOwner,
    });
}(globalThis));
