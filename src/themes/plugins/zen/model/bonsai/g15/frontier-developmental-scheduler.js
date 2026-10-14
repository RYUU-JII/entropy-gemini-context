/**
 * G15.4 developmental proposal scheduler.
 *
 * This owner compares already-valid local frontier actions.
 * It owns proposal scoring and ordering only; it cannot create geometry,
 * change an axis outcome, or prescribe a fork shape.
 */
(function installTypedDevelopmentalProposalScheduler(scope) {
    'use strict';

    const programs = scope.ZenBonsaiTypedDevelopmentalSchedulerPrograms;
    if (!programs) {
        throw new Error(
            '[G15.4_SCHEDULER] developmental-programs.js must load first.',
        );
    }
    const {
        TIERS,
        SCHEDULER_SEMANTICS,
        clamp,
        pointAt,
        rounded,
        resolveCrownRadius,
        resolveRadialDistance,
    } = programs;
    const VISIBLE_SCAFFOLD_LIVENESS_MAXIMUM_SCORE_BOOST = 0.25;

    function createOwner(dependencies) {
        const required = [
            'idFor',
            'nodeById',
            'frontierById',
            'resolveCrownCompletionStatus',
            'clusterSaturation',
            'shouldFork',
            'terminationReason',
            'prepareForkIdentityIntent',
            'resolveVisibleScaffoldReleasePermission',
        ];
        const missing = required.filter((name) => (
            !dependencies || typeof dependencies[name] !== 'function'
        ));
        if (missing.length) {
            throw new Error(
                '[G15.4_SCHEDULER] Missing owner dependencies: ' + missing.join(', '),
            );
        }
        const {
            idFor,
            nodeById,
            frontierById,
            resolveCrownCompletionStatus,
            clusterSaturation,
            shouldFork,
            terminationReason,
            prepareForkIdentityIntent,
            resolveVisibleScaffoldReleasePermission,
        } = dependencies;

        function proposalCooldown(context, lineageId, sequence) {
            const previous = context.lineageLastSelectedAt.get(lineageId);
            if (previous === undefined) return 0;
            return clamp(1 - (sequence - previous) / 4, 0, 1);
        }

        function developmentalFamilyIdFor(context, lineageId) {
            let lineage = context.lineageIndex.get(lineageId);
            if (!lineage) return lineageId;
            while (lineage.parentLineageId) {
                const parent = context.lineageIndex.get(lineage.parentLineageId);
                if (!parent || !parent.parentLineageId) return lineage.id;
                lineage = parent;
            }
            return lineage.id;
        }

        function familyCooldown(context, familyId, sequence) {
            const previous = context.familyLastSelectedAt.get(familyId);
            if (previous === undefined) return 0;
            return clamp(1 - (sequence - previous) / 6, 0, 1);
        }

        function resolveCenterlineSelectionField(context, frontier) {
            const origin = nodeById(context, frontier.nodeId)?.point;
            if (!origin) return Object.freeze({ score: 0, radialPressure: 0 });
            const crownRadius = resolveCrownRadius(context);
            const extensionDrive = clamp(
                Number(frontier.developmentState?.extensionDrive ?? 0.5),
                0.2,
                1.2,
            );
            const probeLength = TIERS[frontier.tier].meanLength
                * context.preset.statureScale
                * (0.82 + extensionDrive * 0.18);
            const probe = pointAt(origin, frontier.heading, probeLength);
            const originRadius = resolveRadialDistance(origin);
            const probeRadius = resolveRadialDistance(probe);
            const centerlineGain = clamp(
                (originRadius - probeRadius) / Math.max(24, crownRadius),
                -0.5,
                0.5,
            );
            const radialPressure = clamp(
                originRadius / Math.max(24, crownRadius),
                0,
                1.4,
            );
            const outwardness = clamp(
                (probeRadius - originRadius) / probeLength,
                -1,
                1,
            );
            const verticalAffinity = clamp(frontier.heading.y, -1, 1);
            const continuityScale = clamp(
                0.12
                    + Number(frontier.developmentState?.apicalContinuity ?? 0.5)
                        * 0.88,
                0.12,
                1,
            );
            const score = centerlineGain * 4.4 * continuityScale
                + Math.max(0, verticalAffinity) * 0.36 * continuityScale
                - Math.max(0, outwardness) * radialPressure * 0.72
                    * continuityScale;
            return Object.freeze({
                score: rounded(score),
                originRadius: rounded(originRadius),
                probeRadius: rounded(probeRadius),
                centerlineGain: rounded(centerlineGain),
                radialPressure: rounded(radialPressure),
                outwardness: rounded(outwardness),
                verticalAffinity: rounded(verticalAffinity),
                crownRadius: rounded(crownRadius),
            });
        }

        function createProposal(context, spec) {
            return Object.freeze({
                id: idFor(context, 'proposal'),
                semantics: SCHEDULER_SEMANTICS,
                sequence: context.events.length,
                action: spec.action,
                score: rounded(spec.score),
                scoreBeforeLiveness: rounded(Number(
                    spec.scoreBeforeLiveness ?? spec.score ?? 0,
                )),
                visibleScaffoldLiveness:
                    spec.visibleScaffoldLiveness || null,
                visibleScaffoldLivenessPressure: rounded(Number(
                    spec.visibleScaffoldLivenessPressure || 0,
                )),
                visibleScaffoldLivenessScoreBoost: rounded(Number(
                    spec.visibleScaffoldLivenessScoreBoost || 0,
                )),
                targetId: spec.targetId,
                targetKind: spec.targetKind,
                frontier: spec.frontier || null,
                options: spec.options ? Object.freeze({ ...spec.options }) : null,
                developmentalFamilyId: spec.developmentalFamilyId || null,
                lineageCooldown: rounded(spec.lineageCooldown || 0),
                familyCooldown: rounded(spec.familyCooldown || 0),
                serviceAge: rounded(spec.serviceAge || 0),
                expectedServiceGap: rounded(spec.expectedServiceGap || 0),
                servicePressure: rounded(spec.servicePressure || 0),
                meristemEstablishmentLoad: rounded(
                    spec.meristemEstablishmentLoad || 0,
                ),
                upperEstablishmentPressure: rounded(
                    spec.upperEstablishmentPressure || 0,
                ),
                upperEstablishmentScoreBoost: rounded(
                    spec.upperEstablishmentScoreBoost || 0,
                ),
                centerlineSelectionInfluence: rounded(
                    spec.centerlineSelectionInfluence || 0,
                ),
                reasons: Object.freeze([...(spec.reasons || [])]),
            });
        }

        function buildDevelopmentalProposalQueue(context) {
            const sequence = context.events.length;
            const coverage = resolveCrownCompletionStatus(context);
            const proposals = [];
            const activeFrontiers = [...context.activeFrontierIds]
                .map((frontierId) => frontierById(context, frontierId))
                .filter(Boolean);
            const rawEstablishmentLoad = activeFrontiers.reduce(
                (total, candidate) => {
                    const portfolio = candidate.constructionPortfolio;
                    const planned = Math.max(
                        1,
                        Number(portfolio?.plannedInternodeCount
                            || candidate.axisStepLimit
                            || 1),
                    );
                    const progress = clamp(
                        Number(portfolio?.cursor ?? candidate.axisAge ?? 0)
                            / planned,
                        0,
                        1,
                    );
                    const youth = Math.exp(
                        -Math.max(0, Number(candidate.axisAge || 1) - 1) / 2.5,
                    );
                    return total + (1 - progress) * youth;
                },
                0,
            );
            // A live collection of newly initiated meristems is a real demand
            // on the growth economy. Its smooth logarithmic pressure lets
            // existing children establish before another mature axis creates
            // more competitors, without imposing a frontier quota or a fork
            // ban. Every proposal records the same contemporaneous load.
            const meristemEstablishmentLoad = clamp(
                Math.log1p(rawEstablishmentLoad) * 0.9,
                0,
                2.4,
            );
            activeFrontiers
                .forEach((frontier) => {
                    const cooldown = proposalCooldown(
                        context,
                        frontier.lineageId,
                        sequence,
                    );
                    const developmentalFamilyId = developmentalFamilyIdFor(
                        context,
                        frontier.lineageId,
                    );
                    const branchFamilyCooldown = familyCooldown(
                        context,
                        developmentalFamilyId,
                        sequence,
                    );
                    const lastSelectedAt = context.lineageLastSelectedAt.get(
                        frontier.lineageId,
                    );
                    const serviceAnchor = lastSelectedAt === undefined
                        ? Number(frontier.readyAt || 0)
                        : Math.max(
                            Number(frontier.readyAt || 0),
                            Number(lastSelectedAt),
                        );
                    const serviceAge = Math.max(0, sequence - serviceAnchor);
                    // Event order is an implementation detail, but without an
                    // ageing term it became a hidden biological outcome: a
                    // weak child born at event 26 could remain at one segment
                    // through event 160. Normalize by the live queue so normal
                    // family rotation costs nothing and genuinely unserved
                    // meristems accumulate a traceable, bounded service debt.
                    const expectedServiceGap = clamp(
                        context.activeFrontierIds.size * 0.62 + 2,
                        4,
                        16,
                    );
                    const plannedInternodes = Math.max(
                        1,
                        Number(
                            frontier.constructionPortfolio
                                ?.plannedInternodeCount
                                || frontier.axisStepLimit
                                || 1,
                        ),
                    );
                    const constructionProgress = clamp(
                        Number(frontier.constructionPortfolio?.cursor
                            ?? frontier.axisAge
                            ?? 0) / plannedInternodes,
                        0,
                        1,
                    );
                    const upperComplexityPressure = clamp(
                        Number(
                            frontier.constructionPortfolio
                                ?.architectureProfile
                                ?.upperComplexityPressure || 0,
                        ),
                        0,
                        1.4,
                    );
                    const upperEstablishmentPressure = clamp(
                        upperComplexityPressure
                            * (1 - constructionProgress)
                            * (frontier.axisOrder === 0 ? 0.24 : 1),
                        0,
                        1.4,
                    );
                    const upperEstablishmentScoreBoost =
                        upperEstablishmentPressure * 0.58;
                    const unservedCycles = Math.max(
                        0,
                        serviceAge / expectedServiceGap - 0.55,
                    );
                    const servicePressure = clamp(
                        unservedCycles
                            * (0.82 + (1 - constructionProgress) * 0.28),
                        0,
                        3.4,
                    );
                    const saturation = clusterSaturation(context, frontier.clusterId);
                    const centerlineField = resolveCenterlineSelectionField(
                        context,
                        frontier,
                    );
                    // Centerline affinity describes transport opportunity; it
                    // must not decide which family receives most of the finite
                    // event horizon. Keep a small timing influence while axis
                    // history and family recovery own the queue.
                    const centerlineSelectionInfluence = clamp(
                        centerlineField.score * 0.16,
                        -0.28,
                        0.28,
                    );
                    const restDebt = Math.max(0, frontier.restUntilEvent - sequence);
                    const maturationPenalty = frontier.maturationState
                        === 'resting_support_build'
                        ? Math.min(4.8, restDebt * 0.86)
                        : 0;
                    const readinessDebt = clamp(
                        (sequence - frontier.readyAt) / 4,
                        -1,
                        2,
                    );
                    const continuity = Number(
                        frontier.developmentState?.apicalContinuity ?? 0.5,
                    );
                    const extensionDrive = Number(
                        frontier.developmentState?.extensionDrive ?? 0.5,
                    );
                    const developmentalWeight = 1.75
                        + continuity * 0.62
                        + extensionDrive * 0.28;
                    const ordinaryAdvanceScore = developmentalWeight
                        + frontier.resourceReserve * 0.62
                        + frontier.extensionAllocation * 0.46
                        + frontier.reiterationPotential * 0.18
                        + centerlineSelectionInfluence
                        + frontier.spatialExposure * 0.3
                        + readinessDebt * 0.38
                        + servicePressure * 0.96
                        + upperEstablishmentScoreBoost
                        - maturationPenalty
                        - cooldown * 1.7
                        - branchFamilyCooldown * 1.35
                        - Math.max(0, saturation - 0.78) * 4.2;
                    const reason = terminationReason(context, frontier);
                    if (reason) {
                        proposals.push(createProposal(context, {
                            action: 'terminate_frontier',
                            targetId: frontier.id,
                            targetKind: 'frontier',
                            frontier,
                            score: coverage.settled ? 100 : 6.5 + saturation * 2,
                            options: { reason },
                            developmentalFamilyId,
                            lineageCooldown: cooldown,
                            familyCooldown: branchFamilyCooldown,
                            serviceAge,
                            expectedServiceGap,
                            servicePressure,
                            meristemEstablishmentLoad,
                            centerlineSelectionInfluence,
                            reasons: [reason, coverage.phase],
                        }));
                        return;
                    }
                    if (shouldFork(frontier)) {
                        const forkIntent = frontier.pendingForkIntent
                            || prepareForkIdentityIntent(
                                context,
                                frontier,
                                sequence,
                            );
                        const visibleScaffoldPermission =
                            resolveVisibleScaffoldReleasePermission(frontier);
                        const crownBaseCompetence =
                            visibleScaffoldPermission.crownBaseCompetence;
                        const crownFormationRequired = Boolean(
                            Number(frontier.axisOrder ?? frontier.tier ?? 0) === 0
                            && crownBaseCompetence?.applicable
                            && !crownBaseCompetence.crownBaseEstablished,
                        );
                        const crownBaseDeferred = Boolean(
                            crownFormationRequired
                            && !crownBaseCompetence?.eligible,
                        );
                        const permissionDeferred = Boolean(
                            forkIntent.visibleScaffoldReleasePlanned
                            && !visibleScaffoldPermission.eligible,
                        );
                        const forkDevelopmentDeferred = Boolean(
                            permissionDeferred || crownBaseDeferred,
                        );
                        const visibleScaffoldLiveness =
                            visibleScaffoldPermission.visibleScaffoldLiveness
                            || null;
                        const visibleScaffoldLivenessPressure = clamp(
                            Number(visibleScaffoldLiveness?.pressure || 0),
                            0,
                            1,
                        );
                        const forkScoreBeforeLiveness = 4.8
                            + Number(
                                frontier.developmentState?.reiterationCredit || 0,
                            ) * 0.34
                            + frontier.vigor * 0.62
                            + frontier.resourceReserve * 0.38
                            + frontier.reiterationPotential * 0.32
                            + centerlineSelectionInfluence
                            + readinessDebt * 0.34
                            + servicePressure * 0.96
                            + upperEstablishmentScoreBoost
                            - meristemEstablishmentLoad * 0.82
                            - maturationPenalty
                            - cooldown * 1.5
                            - branchFamilyCooldown * 1.25
                            - Math.max(0, saturation - 0.72) * 5.5;
                        // Permission can change the transaction executed at a
                        // due fork, but it does not erase the meristem's due
                        // state. Preserve that family's existing fork-service
                        // priority while it advances toward authorization;
                        // priority itself can never grant the permission.
                        // Only a granted visible fork receives the additional
                        // bounded, route-neutral liveness bonus.
                        const scoreBeforeLiveness = forkScoreBeforeLiveness;
                        const visibleScaffoldLivenessScoreBoost = Boolean(
                            forkIntent.visibleScaffoldReleasePlanned
                            && visibleScaffoldPermission.eligible,
                        )
                            ? visibleScaffoldLivenessPressure
                                * VISIBLE_SCAFFOLD_LIVENESS_MAXIMUM_SCORE_BOOST
                            : 0;
                        proposals.push(createProposal(context, {
                            action: forkDevelopmentDeferred
                                ? 'advance_frontier'
                                : 'fork_frontier',
                            targetId: frontier.id,
                            targetKind: 'frontier',
                            frontier,
                            score: scoreBeforeLiveness
                                + visibleScaffoldLivenessScoreBoost,
                            scoreBeforeLiveness,
                            visibleScaffoldLiveness,
                            visibleScaffoldLivenessPressure,
                            visibleScaffoldLivenessScoreBoost,
                            options: {
                                forkIntent,
                                visibleScaffoldPermission,
                                visibleScaffoldLiveness,
                                crownBaseCompetence,
                                crownFormationRequired,
                                crownBaseDeferred,
                                forkPermissionDeferred:
                                    forkDevelopmentDeferred,
                            },
                            developmentalFamilyId,
                            lineageCooldown: cooldown,
                            familyCooldown: branchFamilyCooldown,
                            serviceAge,
                            expectedServiceGap,
                            servicePressure,
                            meristemEstablishmentLoad,
                            upperEstablishmentPressure,
                            upperEstablishmentScoreBoost,
                            centerlineSelectionInfluence,
                            reasons: [
                                crownBaseDeferred
                                    ? 'juvenile_crown_base_competence_deferred'
                                    : (permissionDeferred
                                        ? 'visible_scaffold_permission_deferred'
                                        : 'local_axis_fork_due'),
                                forkDevelopmentDeferred
                                    ? 'fork_due_priority_while_development_defers_mutation'
                                    : (forkIntent.visibleScaffoldReleasePlanned
                                        ? 'fork_priority_after_permission_grant'
                                        : 'fork_priority_without_visible_scaffold_spend'),
                                'resource_law_owns_split_shape',
                                'visible_scaffold_permission_owns_order_transition_timing',
                                'global_completion_cannot_block_fork',
                                `tier:${frontier.tier}`,
                                `cluster_saturation:${rounded(saturation)}`,
                                `centerline_field:${centerlineField.score}`,
                                `centerline_selection:${rounded(centerlineSelectionInfluence)}`,
                                `developmental_family:${developmentalFamilyId}`,
                                `family_cooldown:${rounded(branchFamilyCooldown)}`,
                                `service_pressure:${rounded(servicePressure)}`,
                                `visible_scaffold_liveness:${rounded(visibleScaffoldLivenessPressure)}`,
                                `visible_scaffold_liveness_boost:${rounded(visibleScaffoldLivenessScoreBoost)}`,
                                `crown_base_progress:${rounded(crownBaseCompetence?.progress || 0)}`,
                                `establishment_load:${rounded(meristemEstablishmentLoad)}`,
                                `upper_establishment:${rounded(upperEstablishmentPressure)}`,
                                `maturation:${frontier.maturationState}`,
                            ],
                        }));
                        return;
                    }
                    proposals.push(createProposal(context, {
                        action: 'advance_frontier',
                        targetId: frontier.id,
                        targetKind: 'frontier',
                        frontier,
                        score: ordinaryAdvanceScore,
                        developmentalFamilyId,
                        lineageCooldown: cooldown,
                        familyCooldown: branchFamilyCooldown,
                        serviceAge,
                        expectedServiceGap,
                        servicePressure,
                        meristemEstablishmentLoad,
                        upperEstablishmentPressure,
                        upperEstablishmentScoreBoost,
                        centerlineSelectionInfluence,
                        reasons: [
                            'axis_extension',
                            `tier:${frontier.tier}`,
                            `cooldown:${rounded(cooldown)}`,
                            `centerline_field:${centerlineField.score}`,
                            `centerline_selection:${rounded(centerlineSelectionInfluence)}`,
                            `developmental_family:${developmentalFamilyId}`,
                            `family_cooldown:${rounded(branchFamilyCooldown)}`,
                            `service_pressure:${rounded(servicePressure)}`,
                            `establishment_load:${rounded(meristemEstablishmentLoad)}`,
                            `upper_establishment:${rounded(upperEstablishmentPressure)}`,
                            `maturation:${frontier.maturationState}`,
                        ],
                    }));
                });
            return Object.freeze(proposals.sort((left, right) => (
                right.score - left.score
                || left.id.localeCompare(right.id)
            )));
        }

        return Object.freeze({
            resolveCenterlineSelectionField,
            developmentalFamilyIdFor,
            buildDevelopmentalProposalQueue,
        });
    }

    scope.ZenBonsaiTypedDevelopmentalSchedulerProposalScheduler = Object.freeze({
        VISIBLE_SCAFFOLD_LIVENESS_MAXIMUM_SCORE_BOOST,
        createOwner,
    });
}(globalThis));
