import {zenPlumeKernelRealm} from "../../kernelRealm.js";
import { resolveZenG15DistalCrown } from './ZenBonsaiG15DistalCrown.js';
/**
 * G15.4 resource and fork-law owner.
 *
 * Allocation, arity, aperture, local-frame horizontal release, fork archetype,
 * and support-owned junction ledgers are resolved here. This owner is pure
 * with respect to graph state.
 */
(function installTypedDevelopmentalResourceForkLaw(scope) {
    'use strict';

    const programs = scope.ZenBonsaiTypedDevelopmentalSchedulerPrograms;
    const strategyOwner = scope.ZenBonsaiTypedDevelopmentalSchedulerStrategy;
    const trajectoryOwner = scope.ZenBonsaiTypedDevelopmentalSchedulerTrajectoryField;
    const architectureOwner = scope
        .ZenBonsaiTypedDevelopmentalSchedulerCrownArchitecture;
    if (!programs || !strategyOwner || !trajectoryOwner || !architectureOwner) {
        throw new Error(
            '[G15.4_FORK_LAW] programs, strategy, developmental trajectory, and crown architecture must load first.',
        );
    }
    const {
        clamp,
        sum,
        rotateGrowthPlane,
        dot,
        angularDistance,
        resolveOrderZeroSupport,
        signedPlanarAngle,
        rounded,
    } = programs;
    const { evaluateStrategyAxis } = strategyOwner;
    const { evaluateDevelopmentalTrajectory } = trajectoryOwner;
    const { resolveCrownArchitectureProfile } = architectureOwner;
    const RESOURCE_CONTRAST_DAMPING_SEMANTICS =
        'distal_resource_contrast_damping_v1';
    const FORK_FLOW_DIRECTION_SEMANTICS =
        'resource_independent_fork_flow_direction_v1';

    function resolveResourceContrastProfile(context, frontier) {
        const distalDominance = resolveZenG15DistalCrown(context.distalCrownTreatment).extension && frontier.tier === 0
            ? .24 * clamp((7-frontier.radius)/5,0,1) : 0;
        const architectureProfile = resolveCrownArchitectureProfile(
            context,
            frontier,
        );
        return Object.freeze({
            semantics: RESOURCE_CONTRAST_DAMPING_SEMANTICS,
            intrinsicAuthority: 'lineage_resource_field',
            architectureProfile,
            damping: rounded(clamp(
                Number(architectureProfile.resourceContrastDamping || 0) + distalDominance,
                0,
                0.42,
            )),
        });
    }
    function orderedShareVector(values, rng) {
        const copy = [...values];
        for (let index = copy.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(rng.next() * (index + 1));
            [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
        }
        const total = sum(copy);
        return Object.freeze(copy.map((value) => value / total));
    }

    /**
     * Local variation belongs to the lineage, not to a cohort-wide generation
     * clock. Children inherit and differentiate these continuous signals at a
     * fork, so two axes at the same depth need not repeat the same decision.
     * Generation remains available only through the sampled developmental
     * trajectory where its weight and direction vary per specimen.
     */
    function lineageDecisionPhase(frontier, frequency = 1, offset = 0) {
        const temperament = frontier.temperament;
        return temperament.developmentalPhase * 4.13 * frequency
            + temperament.forkContrastBias * 2.71
            + temperament.clusterSlot * 1.79
            + (temperament.lineageResponse?.handoff_phase || 0) * 2.37
            + offset;
    }

    function createResourceShares(context, frontier, arity) {
        const firstRootFork = frontier.generationDepth === 0;
        const tierBias = context.phenotype.tierResourceBias[frontier.tier];
        const familyBias = frontier.temperament.resourceBias;
        const lineageContrast = frontier.temperament.forkContrastBias;
        const hierarchyTendency = tierBias * 0.56 + familyBias * 0.44;
        const balanceTendency = clamp(
            frontier.temperament.balanceBias * 0.58
                + context.phenotype.balancedForkFrequency * 0.42,
            0,
            1,
        );
        const hierarchyPhase = Math.sin(lineageDecisionPhase(
            frontier,
            1.07,
            frontier.tier * 0.73 + familyBias * 4.1,
        ));
        const contrastTrajectory = evaluateDevelopmentalTrajectory(
            context,
            'resource_contrast',
            frontier,
        );
        let formShift = 0;
        if (firstRootFork) {
            if (context.form.firstShareMode === 'hierarchical_continuum') {
                formShift = -0.18 + context.phenotype.resourcePolarity * 0.52;
            }
            if (context.form.firstShareMode === 'balanced_continuum') formShift = -0.14;
            if (context.form.firstShareMode === 'strongly_eccentric_continuum') formShift = 0.58;
            if (context.form.firstShareMode === 'eccentric_continuum') formShift = 0.16;
            if (context.form.firstShareMode === 'multisplit_continuum') formShift = -0.1;
        }
        const rawContrast = (
            (hierarchyTendency * 0.58 + context.phenotype.resourceContrast * 0.42)
                * (1 - balanceTendency * (firstRootFork ? 0.48 : 0.34))
                + formShift
                // Contrast is a lineage temperament, not a fresh coin flip at
                // every node. Sibling axes inherit complementary phases so
                // their next forks do not recursively clone the same ratio.
                + lineageContrast * 0.34
                + hierarchyPhase * context.phenotype.resourceContrastSwing
                // Ontogenetic contrast is a sampled specimen trajectory. It
                // may rise, fall, remain stable, or bend through mid-crown;
                // generation depth no longer installs one universal trend.
                + contrastTrajectory.effect.resourceContrastShift
        );
        // Independent contrast fields used to add directly into a [0, 1]
        // clamp. A rising seed trajectory consequently made many unrelated
        // forks land on the identical 90:10 endpoint. Exponential compression
        // preserves the full hierarchy continuum and its ordering while only
        // approaching the extreme asymptotically.
        // A balance-favoring trajectory must approach equality continuously,
        // not collapse every lineage in that specimen onto the exact 50:50
        // endpoint. Softplus preserves a small local contrast, while an
        // independent lineage phase supplies family differentiation without
        // feeding the resulting share back into the trajectory.
        const contrastSoftness = 0.2;
        const positiveContrastDemand = contrastSoftness * Math.log1p(
            Math.exp(clamp(rawContrast / contrastSoftness, -24, 24)),
        );
        const localContrastDifferentiation = (
            0.018 + context.phenotype.lineageDifferentiation * 0.055
        ) * Math.abs(Math.sin(lineageDecisionPhase(
            frontier,
            1.71,
            frontier.temperament.clusterSlot * 2.03 + 2.47,
        )));
        const intrinsicContrast = 1 - Math.exp(
            -(positiveContrastDemand + localContrastDifferentiation) * 1.05,
        );
        const contrastProfile = resolveResourceContrastProfile(context, frontier);
        const effectiveContrast = intrinsicContrast
            * (1 - contrastProfile.damping);
        if (arity === 2) {
            const major = clamp(
                // Viability may still be strongly asymmetric. It no longer
                // answers support, extension, identity, and lifespan again:
                // child-development-budget.js composes those outcomes inside
                // the finite absolute capacity granted here.
                0.5 + effectiveContrast ** 1.12 * 0.4,
                0.5,
                0.9,
            );
            return orderedShareVector([major, 1 - major], context.rng);
        }
        const major = clamp(
            1 / 3 + effectiveContrast ** 1.12 * 0.18,
            1 / 3,
            0.52,
        );
        const remainder = 1 - major;
        const secondaryFraction = clamp(
            0.5 + hierarchyPhase * 0.065 + familyBias * 0.055,
            0.43,
            0.66,
        );
        const secondary = remainder * secondaryFraction;
        return orderedShareVector([major, secondary, remainder - secondary], context.rng);
    }

    function createCompletionShares(context, frontier) {
        return createResourceShares(context, frontier, 2);
    }

    function normalizeWeights(values, label) {
        const total = sum(values);
        if (!Number.isFinite(total) || total <= 1e-10) {
            throw new Error(`[G15.4_FORK_LAW] ${label} weights collapsed.`);
        }
        return values.map((value) => value / total);
    }

    function resolveForkFlowDirectionPlan(frontier, arity) {
        const lineageResponse = frontier.temperament?.lineageResponse || {};
        const phase = frontier.temperament.developmentalPhase * 5.17
            + frontier.temperament.clusterSlot * 1.73
            + Number(lineageResponse.handoff_phase || 0) * 2.31
            + Number(frontier.handoffRepeatCount || 0) * 1.07
            + Number(frontier.growthUnit?.ordinal || 0) * 0.83;
        const wave = Math.sin(phase);
        const continuity = clamp(
            Number(frontier.developmentState?.apicalContinuity || 0.5),
            0,
            1,
        );
        if (arity === 2) {
            const preferredIndex = wave >= 0 ? 0 : 1;
            const preferredWeight = clamp(
                0.54 + Math.abs(wave) * 0.085 + continuity * 0.035,
                0.52,
                0.68,
            );
            const weights = preferredIndex === 0
                ? [preferredWeight, 1 - preferredWeight]
                : [1 - preferredWeight, preferredWeight];
            return Object.freeze({
                semantics: FORK_FLOW_DIRECTION_SEMANTICS,
                weights: Object.freeze(weights.map((weight) => rounded(weight))),
                preferredIndex,
                lineagePhase: rounded(phase),
                lineageWave: rounded(wave),
                continuity: rounded(continuity),
                resourceShareAuthority: false,
            });
        }
        const rotation = ((Math.floor((phase / (2 * Math.PI)) * 3) % arity) + arity)
            % arity;
        const base = [0.42, 0.33, 0.25];
        const weights = new Array(arity).fill(1 / arity);
        base.slice(0, arity).forEach((weight, index) => {
            weights[(index + rotation) % arity] = weight;
        });
        const normalized = normalizeWeights(weights, 'fork flow direction');
        return Object.freeze({
            semantics: FORK_FLOW_DIRECTION_SEMANTICS,
            weights: Object.freeze(normalized.map((weight) => rounded(weight))),
            preferredIndex: normalized.indexOf(Math.max(...normalized)),
            lineagePhase: rounded(phase),
            lineageWave: rounded(wave),
            continuity: rounded(continuity),
            resourceShareAuthority: false,
        });
    }

    function resolveProjectedLoadAnglePlan(
        frontier,
        flowDirectionWeights,
        allocations,
        divergence,
        side,
        referenceHeading,
    ) {
        const preliminaryOffsets = flowDirectionWeights.length === 2
            ? binaryOffsets(flowDirectionWeights, divergence, side)
            : ternaryOffsets(flowDirectionWeights, divergence, side);
        const receipts = allocations.map((allocation, index) => {
            const heading = rotateGrowthPlane(referenceHeading, preliminaryOffsets[index]);
            const horizontalLever = Math.hypot(heading.x, heading.z);
            const extensionScale = allocation.extensionCapacity;
            const projectedLoad = allocation.supportBudget
                * (0.58 + extensionScale * 0.72);
            const loadMoment = projectedLoad * (0.24 + horizontalLever * 0.76);
            return {
                projectedLoad,
                loadMoment,
                horizontalLever,
                preliminaryOffset: preliminaryOffsets[index],
            };
        });
        const angleShares = normalizeWeights(receipts.map(
            (receipt) => receipt.loadMoment,
        ), 'projected load');
        return Object.freeze({
            angleShares: Object.freeze(angleShares.map(
                (share) => rounded(share),
            )),
            children: Object.freeze(receipts.map((receipt, index) => Object.freeze({
                projectedLoad: rounded(receipt.projectedLoad),
                projectedLoadMoment: rounded(receipt.loadMoment),
                horizontalLever: rounded(receipt.horizontalLever),
                preliminaryOffsetRadians: rounded(receipt.preliminaryOffset),
                angleShare: rounded(angleShares[index]),
            }))),
        });
    }

    function chooseForkArity(context, frontier) {
        if (frontier.generationDepth === 0) return context.form.firstArity;
        // Recursive axes bifurcate. Additional local density is expressed by
        // live lateral meristems along the run, not by stamping an unrelated
        // third child onto the terminal fork. Explicit multi-trunk forms may
        // still choose a ternary first emergence through `firstArity`.
        return 2;
    }

    function binaryOffsets(shares, divergence, side) {
        const majorIndex = shares[0] >= shares[1] ? 0 : 1;
        const minorIndex = majorIndex === 0 ? 1 : 0;
        const majorWeight = shares[majorIndex];
        const minorWeight = shares[minorIndex];
        const aperture = clamp(divergence, 0, 2.42);
        const majorAngle = Math.atan2(
            minorWeight * Math.sin(aperture),
            majorWeight + minorWeight * Math.cos(aperture),
        );
        const minorAngle = aperture - majorAngle;
        const raw = new Array(2).fill(0);
        raw[majorIndex] = side * majorAngle;
        raw[minorIndex] = -side * minorAngle;
        return Object.freeze(raw.map((offset) => clamp(offset, -1.52, 1.52)));
    }

    function ternaryOffsets(shares, divergence, side) {
        const ranked = shares
            .map((share, index) => ({ share, index }))
            .sort((left, right) => right.share - left.share || left.index - right.index);
        const raw = new Array(3).fill(0);
        raw[ranked[0].index] = 0;
        raw[ranked[1].index] = side * divergence * 0.48;
        raw[ranked[2].index] = -side * divergence * 0.52;
        const lateral = sum(raw.map((offset, index) => shares[index] * Math.sin(offset)));
        const forward = sum(raw.map((offset, index) => shares[index] * Math.cos(offset)));
        const correction = -Math.atan2(lateral, forward);
        return Object.freeze(raw.map((offset) => clamp(
            offset + correction,
            -1.42,
            1.42,
        )));
    }

    function resolveSupportedForkPlan(
        context,
        frontier,
        shares,
        decisions,
        divergence,
        side,
        referenceFrame,
    ) {
        const createOffsets = (aperture) => (
            shares.length === 2
                ? binaryOffsets(shares, aperture, side)
                : ternaryOffsets(shares, aperture, side)
        );
        const support = frontier.axisOrder === 0
            ? resolveOrderZeroSupport(context)
            : null;
        const orderZeroIndices = decisions
            .map((decision, index) => ({ decision, index }))
            .filter(({ decision }) => decision.axisOrder === 0)
            .map(({ index }) => index);
        if (!support || !orderZeroIndices.length) {
            return Object.freeze({
                offsets: createOffsets(divergence),
                apertureRadians: rounded(divergence),
                supportApplied: false,
                support,
            });
        }
        const codominant = orderZeroIndices.length > 1;
        const maximumTurn = codominant
            ? support.codominantTurnRadians
            : support.continuationTurnRadians;
        const maximumWorldLean = support.maximumLeanRadians - 2 * Math.PI / 180;
        // Support feasibility owns the final proposed aperture. Keeping an
        // aesthetic minimum here returned an infeasible "wide" proposal that
        // a later projector had to collapse. A naturally narrow supported fork
        // is preferable to contradictory receipts and post-hoc correction.
        const minimumAperture = 0;
        let aperture = divergence;
        let offsets = createOffsets(aperture);
        let supportApplied = false;
        for (let attempt = 0; attempt < 48; attempt += 1) {
            const feasible = orderZeroIndices.every((index) => {
                const heading = rotateGrowthPlane(
                    referenceFrame.heading,
                    offsets[index],
                );
                return angularDistance(frontier.heading, heading) <= maximumTurn + 1e-8
                    && angularDistance({ x: 0, y: 1, z: 0 }, heading)
                        <= maximumWorldLean + 1e-8;
            });
            if (feasible) break;
            const nextAperture = Math.max(minimumAperture, aperture * 0.92);
            if (Math.abs(nextAperture - aperture) <= 1e-8) break;
            aperture = nextAperture;
            offsets = createOffsets(aperture);
            supportApplied = true;
        }
        return Object.freeze({
            offsets,
            apertureRadians: rounded(aperture),
            supportApplied,
            support,
            codominant,
            maximumTurnRadians: rounded(maximumTurn),
            maximumWorldLeanRadians: rounded(maximumWorldLean),
        });
    }

    function resolveForkAperturePlan(context, frontier) {
        const firstRootFork = frontier.generationDepth === 0;
        const phase = (
            Math.sin(
                lineageDecisionPhase(
                    frontier,
                    0.83,
                    frontier.temperament.eccentricityExponent * 2.1
                        + frontier.temperament.resourceBias * 2.7,
                ),
            ) + 1
        ) * 0.5;
        const base = firstRootFork
            ? context.form.divergence[0]
                + (context.form.divergence[1] - context.form.divergence[0]) * phase
            : context.form.divergence[0] * 0.72
                + (context.form.divergence[1] - context.form.divergence[0]) * (0.34 + phase * 0.5);
        const orderScale = frontier.tier === 0
            ? 1
            : (frontier.tier === 1 ? 0.68 : 0.54);
        const minimum = frontier.tier === 0 ? 0.5 : (frontier.tier === 1 ? 0.38 : 0.3);
        const maximum = frontier.tier === 0 ? 2.3 : (frontier.tier === 1 ? 1.08 : 0.82);
        const strategyField = evaluateStrategyAxis(
            context,
            'aperture_field',
            frontier,
        );
        const developmentalTrajectory = evaluateDevelopmentalTrajectory(
            context,
            'fork_aperture',
            frontier,
        );
        const lineageAperture = frontier.temperament
            ?.lineageResponse?.aperture_field || 0;
        const baseAperture = clamp(
            base
                * context.phenotype.releaseAngle
                * frontier.temperament.apertureBias
                * context.preset.spreadScale ** 0.12
                * orderScale
                * Math.exp(lineageAperture * 0.16),
            minimum,
            maximum,
        );
        return Object.freeze({
            apertureRadians: clamp(
                baseAperture
                    * strategyField.effect.apertureScale
                    * developmentalTrajectory.effect.apertureScale,
                minimum,
                maximum,
            ),
            baseApertureRadians: rounded(baseAperture),
            strategyField,
            developmentalTrajectory,
        });
    }

    function resolveHorizontalReleasePlan(
        context,
        frontier,
        shares,
        decisions,
        forkSide,
        referenceFrame,
        force = false,
        completionPhase = false,
    ) {
        if (shares.length !== 2) return null;
        if (frontier.axisOrder !== 0 && !force) return null;
        const majorIndex = shares[0] >= shares[1] ? 0 : 1;
        const minorIndex = majorIndex === 0 ? 1 : 0;
        const majorShare = shares[majorIndex];
        const minorShare = shares[minorIndex];
        const releasedIndices = decisions
            .map((decision, index) => ({ decision, index }))
            .filter(({ decision }) => decision.orderTransition)
            .map(({ index }) => index);
        if (releasedIndices.length !== 1 && !force) return null;
        const releaseIndex = releasedIndices[0] ?? minorIndex;
        const continuationIndex = releaseIndex === 0 ? 1 : 0;
        const releaseShare = shares[releaseIndex];
        const continuationShare = shares[continuationIndex];
        const support = resolveOrderZeroSupport(context);
        const minimumDominance = support?.minimumHorizontalDominance ?? 0.66;
        const strongHierarchy = majorShare >= minimumDominance
            && minorShare / majorShare <= 0.52;
        const hierarchySignal = (
            Math.sin(
                lineageDecisionPhase(
                    frontier,
                    1.43,
                    frontier.temperament.horizontalScaffoldBias * 4.13
                        + frontier.temperament.clusterSlot * 1.77,
                ),
            ) + 1
        ) * 0.5;
        const lateralRegime = context.strategy?.regime?.lateralInvestment || 0;
        const releaseProbability = clamp(
            0.2
                + context.phenotype.horizontalScaffoldRate * 0.62
                + Math.max(0, lateralRegime) * 0.12
                + Math.max(
                    0,
                    frontier.temperament.lineageResponse?.lateral_investment || 0,
                ) * 0.08,
            0.24,
            0.78,
        );
        if (!strongHierarchy && hierarchySignal > releaseProbability && !force) {
            return null;
        }
        const stationElevationWave = Math.sin(
            lineageDecisionPhase(
                frontier,
                1.13,
                frontier.temperament.developmentalPhase * 2.73
                    + frontier.temperament.clusterSlot * 1.19,
            ),
        );
        const targetWorldVerticalAngleDegrees = clamp(
            70
                + Math.abs(continuationShare - releaseShare) * 18
                + context.phenotype.releaseAngle * 3.2
                + (hierarchySignal - 0.5) * 4
                + stationElevationWave * 8,
            62,
            93,
        );
        const intendedMinorSign = -Math.sign(
            forkSide || context.phenotype.asymmetrySign,
        );
        const candidates = [];
        [intendedMinorSign].forEach((minorSign) => {
            for (let degrees = 42; degrees <= 94; degrees += 2) {
                const heading = rotateGrowthPlane(
                    referenceFrame.heading,
                    minorSign * degrees * Math.PI / 180,
                );
                const forwardDot = dot(frontier.heading, heading);
                const worldAngle = angularDistance(
                    { x: 0, y: 1, z: 0 },
                    heading,
                ) * 180 / Math.PI;
                if (forwardDot < 0.12 || heading.y < -0.08 || worldAngle > 94) continue;
                candidates.push({
                    heading,
                    worldAngle,
                    minorSign,
                    score: Math.abs(worldAngle - targetWorldVerticalAngleDegrees)
                        + Math.abs(degrees - 72) * 0.04,
                });
            }
        });
        candidates.sort((left, right) => left.score - right.score);
        if (!candidates.length) return null;
        const minorHeading = candidates[0].heading;
        const realizedWorldAngle = angularDistance(
            { x: 0, y: 1, z: 0 },
            minorHeading,
        ) * 180 / Math.PI;
        if (
            dot(frontier.heading, minorHeading) < 0.12
            || realizedWorldAngle < 60
            || realizedWorldAngle > 94
        ) return null;
        const releaseOffset = clamp(
            signedPlanarAngle(referenceFrame.heading, minorHeading),
            -1.53,
            1.53,
        );
        const continuationOffset = Math.atan2(
            -releaseShare * Math.sin(releaseOffset),
            continuationShare + releaseShare * Math.cos(releaseOffset),
        );
        const continuationHeading = rotateGrowthPlane(
            referenceFrame.heading,
            continuationOffset,
        );
        if (
            decisions[continuationIndex].tier === 0
            && support
            && (
                angularDistance(frontier.heading, continuationHeading)
                    > support.continuationTurnRadians + 1e-8
                || angularDistance({ x: 0, y: 1, z: 0 }, continuationHeading)
                    > support.maximumLeanRadians - 2 * Math.PI / 180 + 1e-8
            )
        ) return null;
        const offsets = new Array(2).fill(0);
        offsets[releaseIndex] = releaseOffset;
        offsets[continuationIndex] = continuationOffset;
        return Object.freeze({
            semantics: 'field_sampled_visible_horizontal_release_v3',
            majorIndex,
            minorIndex,
            releaseIndex,
            continuationIndex,
            minorHeading: Object.freeze({ ...minorHeading }),
            offsets: Object.freeze(offsets.map((offset) => rounded(offset))),
            apertureRadians: rounded(Math.abs(
                releaseOffset - continuationOffset,
            )),
            targetWorldVerticalAngleDegrees: rounded(realizedWorldAngle, 3),
            forcedByCompletion: Boolean(force),
            strongHierarchy,
            releaseProbability: rounded(releaseProbability),
            completionPhase: Boolean(completionPhase),
            intendedMinorSign,
            realizedMinorSign: candidates[0].minorSign,
            stationElevationWave: rounded(stationElevationWave),
        });
    }

    function resolveForkArchetype(context, frontier, shares, decisions) {
        if (shares.length === 3) return 'terminal_multisplit';
        const strongestShare = Math.max(...shares);
        const contrast = strongestShare - Math.min(...shares);
        const retainedCount = decisions.filter(
            (decision) => decision.orderRetained,
        ).length;
        if (retainedCount === decisions.length) {
            return contrast <= 0.12
                ? 'codominant_bifurcation'
                : 'distributed_identity_bifurcation';
        }
        if (retainedCount > 0) return 'identity_transition_handoff';
        return 'identity_transition_bifurcation';
    }

    function resolveJunctionLedger(frontier, children, areaGain) {
        const allocationMode = 'absolute_capacity_support_area';
        const radiusWeights = children.map((child) => Math.sqrt(
            Math.max(
                1e-8,
                child.junctionSupportBudget ?? child.supportBudget,
            ),
        ));
        const squaredWeightTotal = sum(radiusWeights.map((weight) => weight ** 2));
        const radiusScale = frontier.radius * Math.sqrt(
            areaGain / squaredWeightTotal,
        );
        const radii = radiusWeights.map((weight) => radiusScale * weight);
        const realizedAreaTotal = sum(radii.map((radius) => radius ** 2));
        const realizedMassTotal = sum(radii.map((radius) => radius ** 3));
        return Object.freeze(children.map((child, index) => Object.freeze({
            growthShare: child.share,
            junctionAreaShare: radii[index] ** 2 / realizedAreaTotal,
            junctionMassShare: radii[index] ** 3 / realizedMassTotal,
            startRadius: radii[index],
            expectedExtent: child.expectedExtent,
            allocationMode,
        })));
    }


    scope.ZenBonsaiTypedDevelopmentalSchedulerResourceForkLaw = Object.freeze({
        RESOURCE_CONTRAST_DAMPING_SEMANTICS,
        FORK_FLOW_DIRECTION_SEMANTICS,
        orderedShareVector,
        createResourceShares,
        createCompletionShares,
        resolveResourceContrastProfile,
        resolveForkFlowDirectionPlan,
        resolveProjectedLoadAnglePlan,
        chooseForkArity,
        binaryOffsets,
        ternaryOffsets,
        resolveForkAperturePlan,
        resolveSupportedForkPlan,
        resolveHorizontalReleasePlan,
        resolveForkArchetype,
        resolveJunctionLedger,
    });
}(zenPlumeKernelRealm));
