import {zenPlumeKernelRealm} from "../../kernelRealm.js";
/**
 * G15.4 child developmental budget owner.
 *
 * A fork receives one finite family capacity from its parent. This owner
 * distributes that absolute capacity once, then expresses each child's
 * support/extension/reiteration character as a composition of its own budget.
 * Downstream owners may consume the receipt; they must not renormalize a child
 * against the strongest sibling to recreate growth capacity.
 */
(function installTypedDevelopmentalChildBudget(scope) {
    'use strict';

    const programs = scope.ZenBonsaiTypedDevelopmentalSchedulerPrograms;
    const strategyOwner = scope.ZenBonsaiTypedDevelopmentalSchedulerStrategy;
    const architectureOwner = scope
        .ZenBonsaiTypedDevelopmentalSchedulerCrownArchitecture;
    const tierArchitectureOwner = scope
        .ZenBonsaiTypedDevelopmentalSchedulerTierArchitecture;
    if (
        !programs
        || !strategyOwner
        || !architectureOwner
        || !tierArchitectureOwner
    ) {
        throw new Error(
            '[G15.4_CHILD_BUDGET] programs, developmental strategy, crown architecture, and tier architecture must load first.',
        );
    }

    const {
        TIER_NAMES,
        axisOrderNameFor,
        clamp,
        sum,
        rounded,
    } = programs;
    const { evaluateStrategyAxis } = strategyOwner;
    const { resolveCrownArchitectureProfile } = architectureOwner;
    const {
        resolveChildTierRoles,
        resolveRelativeDifferentiationPotential,
        tierRoleFor,
    } = tierArchitectureOwner;

    function normalize(values, label) {
        const total = sum(values);
        if (!Number.isFinite(total) || total <= 1e-10) {
            throw new Error(`[G15.4_CHILD_BUDGET] ${label} budget collapsed.`);
        }
        return values.map((value) => value / total);
    }

    function childPhase(frontier, index, share, offset = 0) {
        return frontier.temperament.developmentalPhase * 4.07
            + frontier.temperament.forkContrastBias * 2.53
            + frontier.temperament.clusterSlot * 1.61
            + (frontier.temperament.lineageResponse?.allocation_coupling || 0) * 2.19
            + index * 2.399
            + share * 4.83
            + offset;
    }

    function resolveFamilyCapacity(frontier, architectureProfile) {
        const parentCapacity = clamp(
            Number(frontier.developmentalCapacity ?? 1),
            0.02,
            1,
        );
        const constructionCondition = clamp(
            Number(frontier.constructionReserve || 0) / 1.2,
            0,
            1,
        );
        const resourceCondition = clamp(
            Number(frontier.resourceReserve || 0) / 1.4,
            0,
            1,
        );
        const vigorCondition = clamp(Number(frontier.vigor || 0), 0, 1);
        const retention = clamp(
            0.74
                + constructionCondition * 0.08
                + resourceCondition * 0.05
                + vigorCondition * 0.05
                + Number(
                    architectureProfile.familyCapacityRetentionShift || 0,
                ),
            0.72,
            0.95,
        );
        return Object.freeze({
            parentCapacity: rounded(parentCapacity),
            constructionCondition: rounded(constructionCondition),
            resourceCondition: rounded(resourceCondition),
            vigorCondition: rounded(vigorCondition),
            architectureRetentionShift: rounded(Number(
                architectureProfile.familyCapacityRetentionShift || 0,
            )),
            retention: rounded(retention),
            distributableCapacity: rounded(parentCapacity * retention),
        });
    }

    function resolveIdentityDecisions(context, frontier, shares, capacityDrafts) {
        const strongest = Math.max(...shares);
        const weakest = Math.min(...shares);
        const contrast = strongest - weakest;
        const balance = clamp(1 - contrast / Math.max(0.18, strongest), 0, 1);
        const persistence = clamp(
            frontier.temperament.dominantAxisPersistence,
            0,
            1,
        );
        const identityPermeability = clamp(
            Number(
                frontier.temperament.identityPermeability
                    ?? context.phenotype.identityPermeability
                    ?? 0.5,
            ),
            0,
            1,
        );
        const familyWave = Math.sin(childPhase(frontier, 0, strongest, 0.73));
        const familyIdentityBudget = clamp(
            0.88
                // A genuinely co-dominant resource family can preserve two
                // continuation identities. The previous budget sat just below
                // that possibility for most near-even first forks, making an
                // order-0/order-1 handoff structurally inevitable even when
                // neither child was dominant.
                + balance * 0.3
                + (persistence - 0.5) * 0.12
                + familyWave * 0.06,
            0.78,
            1.24,
        );
        const affinities = capacityDrafts.map((draft, index) => {
            const lineageWave = Math.sin(childPhase(
                frontier,
                index,
                shares[index],
                1.37,
            ));
            return Math.max(1e-8,
                // Lineage phase differentiates siblings but no longer owns
                // enough authority to erase a genuinely balanced capacity
                // family before identity permeability is evaluated.
                draft.absoluteCapacity * (0.62 + lineageWave * 0.08)
                    + draft.supportBudget * 0.28
                    + shares[index] * 0.1,
            );
        });
        const affinityShares = normalize(affinities, 'identity affinity');
        const responsibilities = capacityDrafts.map((draft, index) => clamp(
                affinityShares[index] * familyIdentityBudget,
                0.02,
                0.98,
        ));
        const thresholdPhase = Math.sin(childPhase(
            frontier,
            0,
            strongest,
            3.91,
        ));
        const lineageIdentityResponse = clamp(
            Number(
                frontier.temperament?.lineageResponse?.allocation_coupling || 0,
            ),
            -1,
            1,
        );
        // The discrete axis-order label remains a compatibility projection,
        // but its boundary now belongs to a recorded family property instead
        // of a universal 0.5 cliff. Resource balance, inherited permeability,
        // and parental persistence contribute once and are not fed back from
        // the resulting child orders.
        const identityThreshold = clamp(
            0.585
                // Permeability is the seed/family-scale owner of whether a
                // co-dominant fork may preserve two continuation identities.
                // Local phase still differentiates individual junctions, but
                // it must not drown the inherited family tendency.
                - (identityPermeability - 0.5) * 0.26
                + thresholdPhase * 0.045
                + lineageIdentityResponse * 0.035
                + (persistence - 0.5) * 0.02,
            0.44,
            0.7,
        );
        const rolePlan = resolveChildTierRoles(
            context,
            frontier,
            capacityDrafts.map((draft, index) => ({
                retentionPotential: responsibilities[index],
                identityThreshold,
                resourceShare: shares[index],
                absoluteCapacity: draft.absoluteCapacity,
            })),
        );
        return capacityDrafts.map((draft, index) => {
            const retentionPotential = responsibilities[index];
            const parentAxisOrder = rolePlan.parentTier;
            const tier = rolePlan.childTiers[index];
            const axisOrder = tier;
            const retained = tier === parentAxisOrder;
            const differentiation = resolveRelativeDifferentiationPotential(
                context,
                frontier,
                {
                    tier,
                    axisOrder,
                    resourceShare: shares[index],
                    extensionCapacity: draft.extensionCapacity,
                    supportCapacity: draft.supportCapacity,
                },
            );
            const identitySignal = Object.freeze({
                semantics: 'continuous_family_axis_responsibility_v3',
                familyIdentityBudget: rounded(familyIdentityBudget),
                affinityShare: rounded(affinityShares[index]),
                retentionPotential: rounded(retentionPotential),
                identityResponsibility: rounded(retentionPotential),
                identityThreshold: rounded(identityThreshold),
                identityPermeability: rounded(identityPermeability),
                thresholdPhase: rounded(thresholdPhase),
                lineageIdentityResponse: rounded(lineageIdentityResponse),
                balance: rounded(balance),
                resourceContrast: rounded(contrast),
                parentAxisOrder,
                axisOrder,
                parentTierRole: rolePlan.parentRole,
                tierRole: tierRoleFor(tier),
                familyOutcome: rolePlan.familyOutcome,
                tierArchitectureSemantics: rolePlan.semantics,
                relativeDifferentiation: differentiation,
            });
            return Object.freeze({
                tier,
                tierName: TIER_NAMES[tier],
                axisOrder,
                axisOrderName: axisOrderNameFor(axisOrder),
                tierRole: tierRoleFor(tier),
                familyOutcome: rolePlan.familyOutcome,
                tierArchitecture: rolePlan,
                relativeDifferentiation: differentiation,
                orderRetained: retained,
                orderTransition: !retained,
                resourceShare: shares[index],
                resourceRank: shares.filter(
                    (candidate) => candidate > shares[index] + 1e-10,
                ).length,
                retentionPotential: rounded(retentionPotential),
                identityResponsibility: rounded(retentionPotential),
                identityThreshold: rounded(identityThreshold),
                identitySignal,
                reason: retained
                    ? 'role_authoritative_family_retention'
                    : 'role_authoritative_family_transition',
            });
        });
    }

    function createChildDevelopmentBudget(context, frontier, shares, options = {}) {
        if (![2, 3].includes(shares.length)) {
            throw new RangeError('[G15.4_CHILD_BUDGET] Fork budget requires two or three shares.');
        }
        const totalShare = sum(shares);
        if (
            !Number.isFinite(totalShare)
            || shares.some((share) => !Number.isFinite(share) || share <= 0)
        ) {
            throw new TypeError('[G15.4_CHILD_BUDGET] Resource shares must be finite and positive.');
        }
        const normalizedShares = shares.map((share) => share / totalShare);
        const architectureProfile = resolveCrownArchitectureProfile(
            context,
            frontier,
        );
        const family = resolveFamilyCapacity(frontier, architectureProfile);
        const strategyField = evaluateStrategyAxis(
            context,
            'allocation_coupling',
            frontier,
        );
        const lateralField = evaluateStrategyAxis(
            context,
            'lateral_investment',
            frontier,
        );
        const lineageCoupling = frontier.temperament
            ?.lineageResponse?.allocation_coupling || 0;
        const specializationAuthority = clamp(
            0.18
                + Math.abs(strategyField.effect.allocationDecoupling) * 0.22
                + Math.abs(lineageCoupling) * 0.1,
            0.16,
            0.46,
        );
        const specializationSignals = normalizedShares.map((share, index) => (
            Math.sin(childPhase(frontier, index, share, 2.11))
        ));
        const specializationCenter = sum(specializationSignals)
            / specializationSignals.length;
        const capacityDrafts = normalizedShares.map((share, index) => {
            const absoluteCapacity = family.distributableCapacity * share;
            const specialization = clamp(
                (specializationSignals[index] - specializationCenter)
                    * specializationAuthority * 1.18
                    + lineageCoupling * 0.08,
                -0.34,
                0.34,
            );
            const futureWave = (
                Math.sin(childPhase(frontier, index, share, -1.07)) + 1
            ) * 0.5;
            const reiterationFraction = clamp(
                0.16
                    + futureWave * 0.12
                    + context.phenotype.ramificationTempo * 0.035
                    + architectureProfile.reiterationFractionShift,
                0.14,
                0.37,
            );
            const activeFraction = 1 - reiterationFraction;
            const supportRatio = clamp(0.5 + specialization, 0.18, 0.82);
            const supportFraction = activeFraction * supportRatio;
            const extensionFraction = activeFraction * (1 - supportRatio);
            const supportBudget = absoluteCapacity * supportFraction;
            const extensionBudget = absoluteCapacity * extensionFraction;
            const reiterationBudget = absoluteCapacity * reiterationFraction;
            const growthCapacity = clamp(
                Math.sqrt(absoluteCapacity / 0.72),
                0.08,
                1,
            );
            const extensionCapacity = clamp(
                growthCapacity * (0.58 + extensionFraction * 0.9),
                0.08,
                1,
            );
            const supportCapacity = clamp(
                growthCapacity * (0.58 + supportFraction * 0.9),
                0.08,
                1,
            );
            return {
                absoluteCapacity,
                supportBudget,
                extensionBudget,
                reiterationBudget,
                supportFraction,
                extensionFraction,
                reiterationFraction,
                growthCapacity,
                extensionCapacity,
                supportCapacity,
                specialization,
            };
        });
        const currentIdentityDecisions = resolveIdentityDecisions(
            context,
            frontier,
            normalizedShares,
            capacityDrafts,
        );
        const preparedIdentityDecisions = options.preparedIdentityDecisions || null;
        if (
            preparedIdentityDecisions
            && (
                !Array.isArray(preparedIdentityDecisions)
                || preparedIdentityDecisions.length !== normalizedShares.length
                || preparedIdentityDecisions.some((decision, index) => (
                    !decision
                    || Math.abs(
                        Number(decision.resourceShare)
                            - Number(normalizedShares[index]),
                    ) > 1e-8
                    || Number(decision.identitySignal?.parentAxisOrder)
                        !== Number(frontier.axisOrder ?? frontier.tier ?? 0)
                ))
            )
        ) {
            throw new Error(
                '[G15.4_CHILD_BUDGET] Prepared fork identity does not belong to the current axis family.',
            );
        }
        // A delayed fork keeps the topology decision made when its meristem was
        // first selected, while absolute capacity and construction settle from
        // the live commit-time resource account. This avoids cadence-driven
        // rejection sampling without freezing stale geometry or funding.
        const decisions = preparedIdentityDecisions
            ? Object.freeze([...preparedIdentityDecisions])
            : currentIdentityDecisions;
        const compositionalSupportShares = normalize(
            capacityDrafts.map((draft) => draft.supportBudget),
            'support',
        );
        // Support/extension specialization may differentiate siblings, but it
        // must not silently invert an otherwise co-dominant family into one
        // massive central axis and one hairline lateral. Total resource share
        // remains the covariance anchor; the sampled coupling field controls
        // how far visible support may depart from it.
        const supportDecouplingAuthority = clamp(
            0.22
                + Math.abs(strategyField.effect.allocationDecoupling) * 0.56
                + context.phenotype.asymmetry * 0.16,
            0.22,
            0.62,
        );
        const supportShares = normalize(
            compositionalSupportShares.map((share, index) => (
                normalizedShares[index] * (1 - supportDecouplingAuthority)
                    + share * supportDecouplingAuthority
            )),
            'resource-anchored support',
        );
        const totalSupportBudget = sum(capacityDrafts.map(
            (draft) => draft.supportBudget,
        ));
        const extensionShares = normalize(
            capacityDrafts.map((draft) => draft.extensionBudget),
            'extension',
        );
        const reiterationShares = normalize(
            capacityDrafts.map((draft) => draft.reiterationBudget),
            'reiteration',
        );
        // Construction is recursively pre-allocated. The current axis owns a
        // longitudinal portfolio and a separate descendant commitment; a
        // later fork cannot depend on whatever happens to remain after the
        // final parent internode. Unspent longitudinal stock may accompany the
        // descendant commitment, but it is no longer its sole source.
        const portfolio = frontier.constructionPortfolio || null;
        const descendantCommitment = Math.max(
            0,
            Number(portfolio?.descendantConstructionBudget || 0),
        );
        const unusedLateralCommitment = Math.max(
            0,
            Number(portfolio?.lateralConstructionBudget || 0),
        );
        const longitudinalSurplus = Math.max(
            0,
            Number(frontier.constructionReserve || 0),
        );
        const sourceFamilyConstruction = portfolio
            ? descendantCommitment
                + unusedLateralCommitment
                + longitudinalSurplus * 0.72
            : longitudinalSurplus;
        const constructionPool = Math.max(
            0,
            sourceFamilyConstruction,
        ) * clamp(0.88 + family.resourceCondition * 0.06, 0.88, 0.94);
        const constructionShares = normalize(
            capacityDrafts.map((draft, index) => (
                normalizedShares[index] ** 0.72
                    * (0.8 + draft.extensionFraction * 0.4)
            )),
            'construction',
        );
        const children = capacityDrafts.map((draft, index) => {
            const supportToExtension = draft.supportBudget
                / Math.max(1e-8, draft.extensionBudget);
            return Object.freeze({
                resourceShare: rounded(normalizedShares[index]),
                absoluteCapacity: rounded(draft.absoluteCapacity),
                growthCapacity: rounded(draft.growthCapacity),
                extensionCapacity: rounded(draft.extensionCapacity),
                supportCapacity: rounded(draft.supportCapacity),
                supportBudget: rounded(draft.supportBudget),
                junctionSupportBudget: rounded(
                    totalSupportBudget * supportShares[index],
                ),
                extensionBudget: rounded(draft.extensionBudget),
                reiterationBudget: rounded(draft.reiterationBudget),
                supportFraction: rounded(draft.supportFraction),
                extensionFraction: rounded(draft.extensionFraction),
                reiterationFraction: rounded(draft.reiterationFraction),
                supportShare: rounded(supportShares[index]),
                compositionalSupportShare: rounded(
                    compositionalSupportShares[index],
                ),
                extensionShare: rounded(extensionShares[index]),
                reiterationShare: rounded(reiterationShares[index]),
                constructionShare: rounded(constructionShares[index]),
                constructionGrant: rounded(
                    constructionPool * constructionShares[index],
                ),
                supportToExtension: rounded(supportToExtension),
                character: supportToExtension >= 1.22
                    ? 'support_biased'
                    : (supportToExtension <= 0.82 ? 'extension_biased' : 'balanced_investment'),
                specialization: rounded(draft.specialization),
                decision: decisions[index],
                signedDecoupling: rounded(strategyField.effect.allocationDecoupling),
                supportDecouplingAuthority: rounded(
                    supportDecouplingAuthority,
                ),
                lateralInvestmentScale: rounded(
                    lateralField.effect.lateralInvestmentScale,
                ),
                strategyField,
                lateralStrategyField: lateralField,
                architectureProfile,
                relativeDifferentiation: decisions[index]
                    .relativeDifferentiation,
                tierRole: decisions[index].tierRole,
                familyOutcome: decisions[index].familyOutcome,
                semantics: 'absolute_family_capacity_composition_v4',
            });
        });
        const allocatedCapacity = sum(children.map((child) => child.absoluteCapacity));
        return Object.freeze({
            semantics: 'absolute_family_capacity_composition_v4',
            family,
            architectureProfile,
            allocatedCapacity: rounded(allocatedCapacity),
            sourceConstructionReserve: rounded(Math.max(
                0,
                Number(frontier.constructionReserve || 0),
            )),
            sourceDescendantCommitment: rounded(descendantCommitment),
            sourceUnusedLateralCommitment: rounded(unusedLateralCommitment),
            sourceLongitudinalSurplus: rounded(longitudinalSurplus),
            sourceFamilyConstruction: rounded(sourceFamilyConstruction),
            constructionPool: rounded(constructionPool),
            allocatedConstruction: rounded(sum(children.map(
                (child) => child.constructionGrant,
            ))),
            unallocatedConstruction: rounded(Math.max(
                0,
                sourceFamilyConstruction - constructionPool,
            )),
            unallocatedCapacity: rounded(Math.max(
                0,
                family.parentCapacity - allocatedCapacity,
            )),
            decisions: Object.freeze(decisions),
            tierArchitecture: decisions[0]?.tierArchitecture || null,
            currentIdentityDecisions: Object.freeze(currentIdentityDecisions),
            identityDecisionSource: preparedIdentityDecisions
                ? 'prepared_fork_identity_intent'
                : 'live_family_capacity',
            children: Object.freeze(children),
            strategyField,
            lateralField,
        });
    }

    scope.ZenBonsaiTypedDevelopmentalSchedulerChildBudget = Object.freeze({
        createChildDevelopmentBudget,
    });
}(zenPlumeKernelRealm));
