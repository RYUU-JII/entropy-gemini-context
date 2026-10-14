import {zenPlumeKernelRealm} from "../../kernelRealm.js";
/**
 * G15.4 order-zero succession kink field.
 *
 * A kink is a sparse, child-specific directional pulse. It may shorten the
 * connector that carries an already selected order-zero succession, but it
 * cannot delete a sibling, transfer resource, change persistence, consume a
 * lateral opportunity, or alter fork cadence. Scaffold rhythm and resource
 * economy therefore remain independent owners.
 */
(function installTypedDevelopmentalSuccessionKinkField(scope) {
    'use strict';

    const programs = scope.ZenBonsaiTypedDevelopmentalSchedulerPrograms;
    const strategyOwner = scope.ZenBonsaiTypedDevelopmentalSchedulerStrategy;
    const architectureOwner = scope
        .ZenBonsaiTypedDevelopmentalSchedulerCrownArchitecture;
    if (!programs || !strategyOwner || !architectureOwner) {
        throw new Error(
            '[G15.4_KINK_FIELD] programs, developmental strategy, and crown architecture must load first.',
        );
    }

    const {
        SUCCESSION_KINK_SEMANTICS,
        clamp,
        normalize,
        rotateGrowthPlane,
        constrainDirectionToCone,
        angularDistance,
        signedPlanarAngle,
        resolveOrderZeroSupport,
        rounded,
    } = programs;
    const { evaluateStrategyAxis } = strategyOwner;
    const { resolveCrownArchitectureProfile } = architectureOwner;

    const SUCCESSION_KINK_STATE_SEMANTICS =
        'one_way_order_zero_succession_kink_history_v1';

    function createSuccessionKinkState(spec = {}) {
        return Object.freeze({
            semantics: SUCCESSION_KINK_STATE_SEMANTICS,
            lastSign: Math.sign(Number(spec.lastSign) || 0),
            arcSinceKink: rounded(Math.max(0, Number(spec.arcSinceKink) || 0)),
            forksSinceKink: Math.max(0, Math.round(Number(spec.forksSinceKink) || 0)),
            kinkCount: Math.max(0, Math.round(Number(spec.kinkCount) || 0)),
        });
    }

    function readSuccessionKinkState(frontier) {
        const state = frontier?.successionKinkState;
        if (!state) return createSuccessionKinkState();
        if (state.semantics !== SUCCESSION_KINK_STATE_SEMANTICS) {
            throw new Error('[G15.4_KINK_FIELD] Invalid succession kink state.');
        }
        return createSuccessionKinkState(state);
    }

    function advanceSuccessionKinkState(state, distance) {
        const current = state?.semantics === SUCCESSION_KINK_STATE_SEMANTICS
            ? state
            : createSuccessionKinkState();
        return createSuccessionKinkState({
            ...current,
            arcSinceKink: current.arcSinceKink + Math.max(0, Number(distance) || 0),
        });
    }

    function boundedMagnitude(value) {
        const magnitude = Math.abs(Number(value) || 0);
        return magnitude / (1 + magnitude);
    }

    function deterministicPhase(context, frontier, salt) {
        return (
            Math.sin(
                Number(context.seed || 0) * 0.002173
                    + Number(frontier.temperament?.developmentalPhase || 0) * 4.37
                    + Number(frontier.temperament?.clusterSlot || 0) * 2.11
                    + Number(frontier.generationDepth || 0) * 1.47
                    + Number(frontier.axisAge || 0) * 0.61
                    + salt,
            ) + 1
        ) * 0.5;
    }

    function resolveSuccessionKinkPlan(
        context,
        frontier,
        decisions,
        allocations,
        shares,
        completionFork = false,
        apertureRadians = 0,
    ) {
        const enabled = context.researchControls?.successionKink !== false;
        const candidates = decisions
            .map((decision, index) => ({ decision, index }))
            .filter(({ decision }) => (
                decision.orderRetained
                    && decision.axisOrder === frontier.axisOrder
                    && decision.axisOrder === 0
            ));
        const eligible = enabled
            && !completionFork
            && frontier.axisOrder === 0
            && decisions.length === 2
            && candidates.length > 0;
        const strategyField = evaluateStrategyAxis(
            context,
            'succession_kink',
            frontier,
        );
        const stateBefore = readSuccessionKinkState(frontier);
        const architectureProfile = resolveCrownArchitectureProfile(
            context,
            frontier,
        );
        const rankedCandidates = candidates
            .map(({ decision, index }) => ({
                index,
                score: Number(decision.identityResponsibility || 0) * 0.62
                    + Number(allocations[index]?.extensionShare || 0) * 0.2
                    + Number(shares[index] || 0) * 0.18,
            }))
            .sort((left, right) => right.score - left.score || left.index - right.index);
        const successorIndex = rankedCandidates[0]?.index ?? null;

        const development = frontier.developmentState || {};
        const historyPressure = clamp(
            clamp(Number(development.stressMemory || 0), 0, 1) * 0.28
                + boundedMagnitude(development.loadMoment) * 0.22
                + boundedMagnitude(development.transportBurden) * 0.13
                + boundedMagnitude(frontier.maintenanceDebt) * 0.17
                + clamp(Number(development.junctionCount || 0) / 4, 0, 1) * 0.1
                + clamp(
                    Number(frontier.axisAge || 0)
                        / Math.max(1, Number(frontier.axisStepLimit || 1)),
                    0,
                    1,
                ) * 0.1,
            0,
            1,
        );
        const inheritedResponse = clamp(
            Number(
                frontier.temperament?.successionKinkResponse
                    ?? context.phenotype.successionKinkPropensity
                    ?? 0.3,
            ),
            0,
            1,
        );
        const opportunity = clamp(
            inheritedResponse * 0.54
                + historyPressure * 0.28
                + clamp(0.5 + Number(strategyField.value || 0) * 0.5, 0, 1) * 0.18,
            0,
            1,
        );
        const arcCooldown = clamp(
            stateBefore.arcSinceKink / Math.max(36, Number(frontier.radius || 1) * 5.5),
            0,
            1,
        );
        const cooldown = stateBefore.kinkCount === 0
            ? 1
            : clamp(stateBefore.forksSinceKink * 0.58 + arcCooldown * 0.72, 0.12, 1);
        const chainWindow = stateBefore.lastSign !== 0
            && stateBefore.arcSinceKink <= Math.max(180, Number(frontier.radius || 1) * 14)
            ? 0.08
            : 0;
        const specimenBiasShift = clamp(
            (Number(context.phenotype.successionKinkBias || 0.16) - 0.2) * 0.5,
            -0.07,
            0.11,
        );
        const wideForkProgress = clamp(
            (Number(apertureRadians || 0) - 0.78) / 0.72,
            0,
            1,
        );
        const wideForkPressure = wideForkProgress * wideForkProgress
            * (3 - 2 * wideForkProgress);
        const probability = clamp(
            (0.09
                + opportunity * 0.27
                + strategyField.effect.kinkProbabilityShift
                + specimenBiasShift
                + chainWindow
                + wideForkPressure
                    * architectureProfile.successionReturn
                    * 0.1) * cooldown,
            0.025,
            0.56,
        );
        const phase = deterministicPhase(context, frontier, 0.73);
        const activated = eligible && phase < probability;

        const alternationPhase = deterministicPhase(context, frontier, 2.91);
        const inheritedSign = Math.sign(
            frontier.successionTurnSign
                || frontier.episode?.turnSign
                || frontier.nextTurnSign
                || context.phenotype.asymmetrySign
                || 1,
        ) || 1;
        const alternated = stateBefore.lastSign !== 0 && alternationPhase < 0.78;
        const turnSign = alternated ? -stateBefore.lastSign : inheritedSign;
        const counterTurnPhase = deterministicPhase(context, frontier, 7.91);
        const magnitudeCharacter = clamp(
            Number(
                frontier.temperament?.successionKinkMagnitude
                    ?? context.phenotype.successionKinkMagnitude
                    ?? 0.78,
            ),
            0.38,
            1.18,
        );
        const magnitudePhase = deterministicPhase(context, frontier, 4.37);
        const requestedTurnDegrees = clamp(
            (14.5
                + magnitudeCharacter * 10.5
                + historyPressure * 4.5
                + magnitudePhase * 3.5)
                * strategyField.effect.kinkTurnScale,
            13,
            32,
        );
        const connectorLengthScale = clamp(
            0.69 + deterministicPhase(context, frontier, 6.13) * 0.16,
            0.69,
            0.85,
        );

        return Object.freeze({
            semantics: SUCCESSION_KINK_SEMANTICS,
            stateSemantics: SUCCESSION_KINK_STATE_SEMANTICS,
            dependencySemantics:
                'past_order_zero_history_and_live_fork_aperture_to_one_selected_child_direction_only',
            enabled,
            eligible,
            activated,
            successorIndex,
            phase: rounded(phase),
            probability: rounded(probability),
            opportunity: rounded(opportunity),
            cooldown: rounded(cooldown),
            chainWindow: rounded(chainWindow),
            specimenBiasShift: rounded(specimenBiasShift),
            turnSign,
            alternated,
            alternationPhase: rounded(alternationPhase),
            apertureRadians: rounded(Number(apertureRadians || 0)),
            wideForkPressure: rounded(wideForkPressure),
            counterTurnPhase: rounded(counterTurnPhase),
            architectureProfile,
            requestedTurnRadians: rounded(
                turnSign * requestedTurnDegrees * Math.PI / 180,
            ),
            requestedTurnDegrees: rounded(turnSign * requestedTurnDegrees, 3),
            connectorLengthScale: rounded(connectorLengthScale),
            historyPressure: rounded(historyPressure),
            inheritedResponse: rounded(inheritedResponse),
            magnitudeCharacter: rounded(magnitudeCharacter),
            stateBefore,
            candidateScores: Object.freeze(rankedCandidates.map((candidate) => (
                Object.freeze({
                    index: candidate.index,
                    score: rounded(candidate.score),
                })
            ))),
            strategyField,
        });
    }

    function applySuccessionKinkDirection(
        context,
        frontier,
        child,
        plan,
    ) {
        const original = normalize(child.direction);
        if (!plan.activated) {
            return Object.freeze({
                direction: original,
                requestedDirection: original,
                requestedTurnRadians: 0,
                constrainedTurnRadians: 0,
                sampledTurnSign: plan.turnSign,
                appliedTurnSign: 0,
                counterTurnEligible: false,
                counterTurnSelected: false,
                counterTurnProbability: 0,
                support: resolveOrderZeroSupport(context),
            });
        }
        const originalTurnRadians = signedPlanarAngle(
            frontier.heading,
            original,
        );
        const counterTurnEligible = Math.abs(originalTurnRadians)
                >= 5 * Math.PI / 180
            && Number(plan.wideForkPressure || 0) > 0.04
            && Number(plan.architectureProfile?.successionReturn || 0) > 0;
        const counterTurnProbability = counterTurnEligible
            ? clamp(
                0.16
                    + Number(plan.wideForkPressure || 0) * 0.42
                    + Number(plan.architectureProfile.successionReturn || 0)
                        * 0.22,
                0,
                0.9,
            )
            : 0;
        const counterTurnSelected = counterTurnEligible
            && Number(plan.counterTurnPhase || 0) < counterTurnProbability;
        const appliedTurnSign = counterTurnSelected
            ? -Math.sign(originalTurnRadians)
            : Math.sign(Number(plan.requestedTurnRadians || plan.turnSign || 1));
        const requestedTurnRadians = Math.abs(
            Number(plan.requestedTurnRadians || 0),
        ) * (appliedTurnSign || 1);
        const requestedDirection = rotateGrowthPlane(
            original,
            requestedTurnRadians,
        );
        const support = resolveOrderZeroSupport(context);
        const direction = constrainSuccessionKinkDirection(
            context,
            frontier,
            requestedDirection,
        );
        let maximumLocalTurnRadians = Math.PI;
        if (support) {
            // Kink expression must remain inside the same local mechanical
            // continuation envelope as every other order-zero child. Visible
            // zigzag comes from sparse alternating pulses, not one unsafe turn.
            maximumLocalTurnRadians = support.continuationTurnRadians;
        }
        return Object.freeze({
            direction: normalize(direction),
            requestedDirection: Object.freeze({ ...requestedDirection }),
            requestedTurnRadians,
            originalTurnRadians: rounded(originalTurnRadians),
            sampledTurnSign: plan.turnSign,
            appliedTurnSign,
            counterTurnEligible,
            counterTurnSelected,
            counterTurnProbability: rounded(counterTurnProbability),
            constrainedTurnRadians: rounded(signedPlanarAngle(original, direction)),
            angularCorrectionRadians: rounded(angularDistance(requestedDirection, direction)),
            maximumLocalTurnRadians: rounded(maximumLocalTurnRadians),
            support,
        });
    }

    function constrainSuccessionKinkDirection(context, frontier, input) {
        const support = resolveOrderZeroSupport(context);
        let direction = normalize(input);
        if (!support) return direction;
        // Sibling reconciliation runs after the first kink projection and may
        // move the selected child again. The same hard mechanical envelope is
        // therefore reusable as the transaction's final projection boundary.
        for (let pass = 0; pass < 2; pass += 1) {
            direction = constrainDirectionToCone(
                direction,
                frontier.heading,
                support.continuationTurnRadians,
            );
            direction = constrainDirectionToCone(
                direction,
                { x: 0, y: 1, z: 0 },
                support.maximumLeanRadians,
            );
        }
        return normalize(direction);
    }

    function deriveChildSuccessionKinkState(
        parentState,
        plan,
        childIndex,
        birthLength,
        orderRetained,
    ) {
        const distance = Math.max(0, Number(birthLength) || 0);
        if (!orderRetained) {
            return createSuccessionKinkState({ arcSinceKink: distance });
        }
        if (childIndex !== plan.successorIndex) {
            // A co-retained sibling starts an independent history rather than
            // cloning the exact alternation phase of the selected succession.
            return createSuccessionKinkState({
                arcSinceKink: distance,
                forksSinceKink: 1,
            });
        }
        if (plan.activated) {
            return createSuccessionKinkState({
                lastSign: Math.sign(
                    Number(plan.realizedTurnSign ?? plan.turnSign),
                ),
                arcSinceKink: distance,
                forksSinceKink: 0,
                kinkCount: parentState.kinkCount + 1,
            });
        }
        return createSuccessionKinkState({
            lastSign: parentState.lastSign,
            arcSinceKink: parentState.arcSinceKink + distance,
            forksSinceKink: parentState.forksSinceKink + 1,
            kinkCount: parentState.kinkCount,
        });
    }

    scope.ZenBonsaiTypedDevelopmentalSchedulerSuccessionKinkField = Object.freeze({
        semantics: SUCCESSION_KINK_SEMANTICS,
        stateSemantics: SUCCESSION_KINK_STATE_SEMANTICS,
        SUCCESSION_KINK_STATE_SEMANTICS,
        createSuccessionKinkState,
        advanceSuccessionKinkState,
        resolveSuccessionKinkPlan,
        applySuccessionKinkDirection,
        constrainSuccessionKinkDirection,
        deriveChildSuccessionKinkState,
    });
}(zenPlumeKernelRealm));
