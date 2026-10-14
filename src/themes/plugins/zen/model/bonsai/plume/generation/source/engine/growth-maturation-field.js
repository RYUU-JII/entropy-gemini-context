import {zenPlumeKernelRealm} from "../../kernelRealm.js";
/**
 * G15.4 ontogenetic extension and secondary-axis maturation field.
 *
 * Segment length is resolved before geometry is committed. This owner keeps
 * transport distance, canopy height, axis age, and lateral investment in one
 * observable receipt instead of scattering late silhouette corrections.
 */
(function installTypedGrowthMaturationField(scope) {
    'use strict';

    const programs = scope.ZenBonsaiTypedDevelopmentalSchedulerPrograms;
    const strategy = scope.ZenBonsaiTypedDevelopmentalSchedulerStrategy;
    const trajectoryField = scope.ZenBonsaiTypedDevelopmentalSchedulerTrajectoryField;
    if (!programs || !strategy || !trajectoryField) {
        throw new Error(
            '[G15.4_MATURATION] programs, strategy, and trajectory field must load first.',
        );
    }
    const {
        clamp,
        magnitude,
        rounded,
    } = programs;
    const { evaluateStrategyAxis } = strategy;
    const { evaluateDevelopmentalTrajectory } = trajectoryField;

    const smoothstep = (minimum, maximum, value) => {
        const normalized = clamp((value - minimum) / (maximum - minimum), 0, 1);
        return normalized * normalized * (3 - 2 * normalized);
    };

    // A normalized negative power mean behaves like a differentiable minimum
    // while returning the shared value when demand and supply are equal. The
    // extension trajectory can therefore express character without multiplying
    // away the transport economy that must fund it.
    const softMinimum = (left, right, sharpness = 6) => (
        (2 / (
            Math.max(1e-6, left) ** -sharpness
                + Math.max(1e-6, right) ** -sharpness
        )) ** (1 / sharpness)
    );

    function resolveOntogeneticCoordinates(context, frontier, origin) {
        const heightScale = Math.max(
            120,
            260
                * context.form.heightScale
                * context.preset.statureScale
                * context.phenotype.stature,
        );
        const rootScale = Math.hypot(
            heightScale,
            82
                * context.form.spreadScale
                * context.preset.spreadScale
                * context.phenotype.crownSpread,
        );
        const height = clamp(origin.y / heightScale, 0, 1.35);
        const transportDistance = clamp(magnitude(origin) / rootScale, 0, 1.35);
        const axisMaturity = clamp(
            Number(frontier.axisAge || 0)
                / Math.max(1, Number(frontier.axisStepLimit || 1)),
            0,
            1,
        );
        const generationMaturity = clamp(
            Number(frontier.generationDepth || 0) / 6,
            0,
            1,
        );
        const progress = clamp(
            height * 0.3
                + transportDistance * 0.3
                + axisMaturity * 0.18
                + generationMaturity * 0.22,
            0,
            1.2,
        );
        return Object.freeze({
            height: rounded(height),
            transportDistance: rounded(transportDistance),
            axisMaturity: rounded(axisMaturity),
            generationMaturity: rounded(generationMaturity),
            progress: rounded(progress),
        });
    }

    function resolveExtensionMaturation(context, frontier, origin) {
        const coordinates = resolveOntogeneticCoordinates(context, frontier, origin);
        const attenuationField = evaluateStrategyAxis(
            context,
            'extension_maturation',
            frontier,
            origin,
        );
        const lateralField = evaluateStrategyAxis(
            context,
            'lateral_investment',
            frontier,
            origin,
        );
        const developmentalTrajectory = evaluateDevelopmentalTrajectory(
            context,
            'internode_extension',
            frontier,
            origin,
        );
        if (context.researchControls?.ontogeneticAttenuation === false) {
            return Object.freeze({
                enabled: false,
                coordinates,
                attenuationField,
                lateralField,
                developmentalTrajectory,
                distalPressure: 0,
                extensionDemand: developmentalTrajectory.effect.internodeScale,
                transportSupply: developmentalTrajectory.effect.internodeScale,
                extensionSupplyRatio: 1,
                lengthScale: developmentalTrajectory.effect.internodeScale,
            });
        }
        const lineageAttenuation = Math.exp(
            (frontier.temperament?.lineageResponse?.extension_maturation || 0) * 0.16,
        );
        const attenuationStrength = clamp(
            context.phenotype.distalAttenuation
                * attenuationField.effect.distalAttenuationScale
                * lineageAttenuation,
            0.12,
            1.35,
        );
        const distalPressure = smoothstep(0.28, 1.02, coordinates.progress);
        const lateralInvestment = clamp(
            lateralField.effect.lateralInvestmentScale
                * Math.exp(
                    (frontier.temperament?.lineageResponse?.lateral_investment || 0)
                        * 0.18,
                ),
            0.58,
            1.58,
        );
        const state = frontier.developmentState || {};
        const continuity = clamp(Number(state.apicalContinuity ?? 0.5), 0, 1);
        const extensionDrive = clamp(Number(state.extensionDrive ?? 0.5), 0, 1.2);
        const terminalAffinity = clamp(Number(state.terminalAffinity ?? 0.2), 0, 1);
        const exposureMemory = clamp(Number(state.exposureMemory ?? 0.6), 0, 1.2);
        const transportBurden = clamp(Number(state.transportBurden || 0), 0, 1.8);
        // Order no longer selects one of three length equations. Every axis
        // matures through the same field; its accumulated continuity,
        // extension investment, and terminal tendency establish the result.
        const persistence = 0.88
            + context.phenotype.secondaryAxisPersistence * 0.08
            + continuity * 0.06
            + extensionDrive * 0.04;
        const attenuation = distalPressure * clamp(
            attenuationStrength
                * (0.1 + (1 - continuity) * 0.07 + terminalAffinity * 0.04),
            0.06,
            0.24,
        );
        const trajectoryScale = developmentalTrajectory.effect.internodeScale;
        const extensionDemand = clamp(
            persistence
                * trajectoryScale
                * (0.96 + (lateralInvestment - 1) * 0.035),
            0.5,
            1.42,
        );
        const verticalTransportWork = Math.max(0, Number(frontier.heading?.y || 0))
            * coordinates.height;
        const transportSupply = clamp(
            1.08
                + exposureMemory * 0.075
                + supportInvestmentFor(state) * 0.045
                - attenuation
                - distalPressure * attenuationStrength * 0.1
                - transportBurden * 0.18
                - verticalTransportWork * 0.1,
            0.5,
            1.18,
        );
        const lengthScale = softMinimum(extensionDemand, transportSupply);
        return Object.freeze({
            enabled: true,
            coordinates,
            attenuationField,
            lateralField,
            developmentalTrajectory,
            attenuationStrength: rounded(attenuationStrength),
            distalPressure: rounded(distalPressure),
            lateralInvestment: rounded(lateralInvestment),
            extensionDemand: rounded(extensionDemand),
            transportSupply: rounded(transportSupply),
            extensionSupplyRatio: rounded(clamp(
                transportSupply / Math.max(1e-6, extensionDemand),
                0.3,
                1.8,
            )),
            verticalTransportWork: rounded(verticalTransportWork),
            lengthScale: rounded(clamp(lengthScale, 0.52, 1.22)),
        });
    }

    function supportInvestmentFor(state) {
        return clamp(Number(state.supportInvestment ?? 0.5), 0, 1.2);
    }

    function resolveAxisPersistencePlan(context, frontier, origin, softLimit) {
        const developmentalTrajectory = evaluateDevelopmentalTrajectory(
            context,
            'axis_persistence',
            frontier,
            origin,
        );
        const lineagePersistence = Math.exp(
            (frontier.temperament?.lineageResponse?.axis_extent || 0) * 0.14,
        );
        const persistenceScale = clamp(
            developmentalTrajectory.effect.persistenceScale
                * lineagePersistence
                * (0.88 + frontier.temperament.vigorPersistence * 0.18),
            0.58,
            1.58,
        );
        const continuity = clamp(
            Number(frontier.developmentState?.apicalContinuity ?? 0.5),
            0,
            1,
        );
        const support = clamp(
            Number(frontier.developmentState?.supportInvestment ?? 0.5),
            0,
            1,
        );
        const maximumAllowance = clamp(
            Math.round(1 + continuity * 3 + support * 2),
            1,
            6,
        );
        const minimumAllowance = continuity + support >= 0.5 ? 1 : 0;
        const thicknessCarry = clamp(
            (developmentalTrajectory.coordinates.thickness - 0.3) * 2.8
                * (0.55 + support * 0.45),
            0,
            1,
        );
        const extensionAllowance = clamp(
            Math.round(
                1.5
                    + (persistenceScale - 0.72) * 3.8
                    + thicknessCarry * 1.25,
            ),
            minimumAllowance,
            maximumAllowance,
        );
        return Object.freeze({
            developmentalTrajectory,
            persistenceScale: rounded(persistenceScale),
            softLimit,
            hardLimit: softLimit + extensionAllowance,
            extensionAllowance,
            thicknessCarry: rounded(thicknessCarry),
            constructionScale: rounded(clamp(Math.sqrt(persistenceScale), 0.76, 1.28)),
        });
    }

    function resolveSecondaryAxisMaturation(context, frontier, origin) {
        const field = evaluateStrategyAxis(
            context,
            'lateral_investment',
            frontier,
            origin,
        );
        const localInvestment = clamp(
            field.effect.lateralInvestmentScale
                * Math.exp(
                    (frontier.temperament?.lineageResponse?.lateral_investment || 0)
                        * 0.2,
                )
                * (0.86 + context.phenotype.secondaryAxisPersistence * 0.28),
            0.56,
            1.72,
        );
        const competence = clamp(
            Number(frontier.developmentState?.lateralCompetence ?? 0.35),
            0,
            1,
        );
        const stepAdjustment = Math.round(
            (localInvestment - 0.86) * (1.4 + competence * 1.7),
        );
        return Object.freeze({
            field,
            localInvestment: rounded(localInvestment),
            stepAdjustment: clamp(stepAdjustment, -1, 3),
        });
    }

    scope.ZenBonsaiTypedDevelopmentalSchedulerMaturationField = Object.freeze({
        resolveOntogeneticCoordinates,
        resolveExtensionMaturation,
        resolveAxisPersistencePlan,
        resolveSecondaryAxisMaturation,
    });
}(zenPlumeKernelRealm));
