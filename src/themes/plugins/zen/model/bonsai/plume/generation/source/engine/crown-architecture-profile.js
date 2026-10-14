import {zenPlumeKernelRealm} from "../../kernelRealm.js";
/**
 * G15.4 continuous crown-architecture profile.
 *
 * The controls in this owner are research inputs, not silhouette targets.
 * They change how one live axis interprets its existing height, transport,
 * order, and maturation coordinates. Each downstream owner receives one
 * bounded effect and keeps its original authority:
 *
 * - cadence may shorten a future order-zero scaffold interval;
 * - construction may retain more already-owned capacity for upper descendants;
 * - crown-interior support may steer an already-funded lateral more strongly;
 * - succession may turn one already-selected continuation back across its
 *   incoming heading.
 *
 * No effect reads a completed graph, screen-space hole, target branch count,
 * or named trunk/scaffold role.
 */
(function installTypedCrownArchitectureProfile(scope) {
    'use strict';

    const programs = scope.ZenBonsaiTypedDevelopmentalSchedulerPrograms;
    const strategyOwner = scope.ZenBonsaiTypedDevelopmentalSchedulerStrategy;
    if (!programs || !strategyOwner) {
        throw new Error(
            '[G15.4_ARCHITECTURE] programs and developmental strategy must load first.',
        );
    }

    const { clamp, rounded } = programs;
    const { resolveStrategyCoordinates } = strategyOwner;

    const CROWN_ARCHITECTURE_CONTROL_SEMANTICS =
        'bounded_crown_architecture_research_controls_v2';
    const CROWN_ARCHITECTURE_PROFILE_SEMANTICS =
        'continuous_local_crown_architecture_profile_v2';

    const CONTROL_DEFINITIONS = Object.freeze({
        upperCrownComplexity: Object.freeze({
            label: 'Upper crown complexity',
            minimum: 0,
            maximum: 1.4,
            defaultValue: 0.68,
            step: 0.05,
        }),
        scaffoldStationCompression: Object.freeze({
            label: 'Distal scaffold compression',
            minimum: 0,
            maximum: 1.4,
            defaultValue: 0.72,
            step: 0.05,
        }),
        crownInteriorContinuity: Object.freeze({
            label: 'Crown interior continuity',
            minimum: 0,
            maximum: 1.5,
            defaultValue: 1.1,
            step: 0.05,
        }),
        successionReturn: Object.freeze({
            label: 'Succession return / zigzag',
            minimum: 0,
            maximum: 1.5,
            defaultValue: 0.66,
            step: 0.05,
        }),
    });

    function readBoolean(input, key, fallback = true) {
        if (input[key] === undefined) return fallback;
        if (typeof input[key] !== 'boolean') {
            throw new TypeError(`[G15.4_RESEARCH] ${key} must be boolean.`);
        }
        return input[key];
    }

    function resolveResearchControls(input = {}) {
        if (typeof input !== 'object' || input === null || Array.isArray(input)) {
            throw new TypeError('[G15.4_RESEARCH] researchControls must be an object.');
        }
        return Object.freeze({
            liveSecondaryAxes: readBoolean(input, 'liveSecondaryAxes'),
            ontogeneticAttenuation: readBoolean(input, 'ontogeneticAttenuation'),
            successionKink: readBoolean(input, 'successionKink'),
            developmentalTrajectories: readBoolean(
                input,
                'developmentalTrajectories',
            ),
            scaffoldFamilyDominance: readBoolean(
                input,
                'scaffoldFamilyDominance',
            ),
        });
    }

    function resolveArchitectureControls(input = {}) {
        if (typeof input !== 'object' || input === null || Array.isArray(input)) {
            throw new TypeError(
                '[G15.4_ARCHITECTURE] architectureControls must be an object.',
            );
        }
        const values = Object.fromEntries(Object.entries(CONTROL_DEFINITIONS).map(([
            key,
            definition,
        ]) => {
            const source = input[key] === undefined
                ? definition.defaultValue
                : Number(input[key]);
            if (!Number.isFinite(source)) {
                throw new TypeError(
                    `[G15.4_ARCHITECTURE] ${key} must be finite.`,
                );
            }
            return [key, rounded(clamp(
                source,
                definition.minimum,
                definition.maximum,
            ))];
        }));
        return Object.freeze({
            semantics: CROWN_ARCHITECTURE_CONTROL_SEMANTICS,
            ...values,
        });
    }

    function smoothstep(minimum, maximum, value) {
        const progress = clamp(
            (Number(value || 0) - minimum) / Math.max(1e-8, maximum - minimum),
            0,
            1,
        );
        return progress * progress * (3 - 2 * progress);
    }

    function resolveCrownArchitectureProfile(context, frontier = {}, point = null) {
        const controls = context.architectureControls;
        if (
            !controls
            || controls.semantics !== CROWN_ARCHITECTURE_CONTROL_SEMANTICS
        ) {
            throw new Error(
                '[G15.4_ARCHITECTURE] Context is missing canonical architecture controls.',
            );
        }
        const coordinates = resolveStrategyCoordinates(context, frontier, point);
        const axisOrder = Math.max(
            0,
            Math.round(Number(frontier.axisOrder ?? frontier.tier ?? 0)),
        );
        const upperProgress = smoothstep(0.34, 0.96, coordinates.height);
        const transportProgress = smoothstep(0.3, 0.94, coordinates.rootDistance);
        const crownProgress = clamp(
            upperProgress * 0.72 + transportProgress * 0.28,
            0,
            1,
        );
        const branchLayerWeight = axisOrder === 0
            ? 0.64
            : (axisOrder === 1 ? 1 : 0.82);
        const upperComplexityPressure = clamp(
            controls.upperCrownComplexity
                * crownProgress
                * branchLayerWeight,
            0,
            1.4,
        );
        const scaffoldStationScale = clamp(
            1 - controls.scaffoldStationCompression
                * upperProgress
                * 0.2,
            0.72,
            1,
        );
        return Object.freeze({
            semantics: CROWN_ARCHITECTURE_PROFILE_SEMANTICS,
            controlSemantics: CROWN_ARCHITECTURE_CONTROL_SEMANTICS,
            coordinates,
            axisOrder,
            upperProgress: rounded(upperProgress),
            transportProgress: rounded(transportProgress),
            crownProgress: rounded(crownProgress),
            branchLayerWeight: rounded(branchLayerWeight),
            upperComplexityPressure: rounded(upperComplexityPressure),
            familyCapacityRetentionShift: rounded(clamp(
                upperComplexityPressure * 0.045,
                0,
                0.063,
            )),
            reiterationFractionShift: rounded(clamp(
                upperComplexityPressure * 0.04,
                0,
                0.056,
            )),
            descendantConstructionShift: rounded(clamp(
                upperComplexityPressure * 0.05,
                0,
                0.07,
            )),
            lateralOpportunityShift: rounded(clamp(
                upperComplexityPressure * 0.17,
                0,
                0.238,
            )),
            resourceContrastDamping: rounded(clamp(
                upperComplexityPressure * 0.3,
                0,
                0.42,
            )),
            scaffoldStationScale: rounded(scaffoldStationScale),
            crownInteriorContinuity: controls.crownInteriorContinuity,
            successionReturn: controls.successionReturn,
            authority: 'bounded_local_effects_only',
        });
    }

    function validArchitectureControls(value) {
        if (
            value?.semantics !== CROWN_ARCHITECTURE_CONTROL_SEMANTICS
        ) return false;
        return Object.entries(CONTROL_DEFINITIONS).every(([key, definition]) => (
            Number.isFinite(value[key])
                && value[key] >= definition.minimum
                && value[key] <= definition.maximum
        ));
    }

    function validCrownArchitectureProfile(value) {
        const coordinates = value?.coordinates;
        return value?.semantics === CROWN_ARCHITECTURE_PROFILE_SEMANTICS
            && value.controlSemantics === CROWN_ARCHITECTURE_CONTROL_SEMANTICS
            && Number.isInteger(value.axisOrder)
            && value.axisOrder >= 0
            && coordinates
            && ['radial', 'rootDistance', 'height', 'thickness', 'maturity']
                .every((key) => (
                    Number.isFinite(coordinates[key])
                    && coordinates[key] >= 0
                    && coordinates[key] <= 1
                ))
            && Number.isInteger(coordinates.tier)
            && coordinates.tier >= 0
            && coordinates.tier <= 2
            && coordinates.point
            && ['x', 'y', 'z'].every(
                (key) => Number.isFinite(coordinates.point[key]),
            )
            && [
                'upperProgress',
                'transportProgress',
                'crownProgress',
                'branchLayerWeight',
                'upperComplexityPressure',
                'familyCapacityRetentionShift',
                'reiterationFractionShift',
                'descendantConstructionShift',
                'lateralOpportunityShift',
                'resourceContrastDamping',
                'scaffoldStationScale',
                'crownInteriorContinuity',
                'successionReturn',
            ].every((key) => Number.isFinite(value[key]))
            && value.upperProgress >= 0
            && value.upperProgress <= 1
            && value.transportProgress >= 0
            && value.transportProgress <= 1
            && value.crownProgress >= 0
            && value.crownProgress <= 1
            && value.upperComplexityPressure >= 0
            && value.upperComplexityPressure <= 1.4
            && value.familyCapacityRetentionShift >= 0
            && value.familyCapacityRetentionShift <= 0.063
            && value.reiterationFractionShift >= 0
            && value.reiterationFractionShift <= 0.056
            && value.descendantConstructionShift >= 0
            && value.descendantConstructionShift <= 0.07
            && value.lateralOpportunityShift >= 0
            && value.lateralOpportunityShift <= 0.238
            && value.resourceContrastDamping >= 0
            && value.resourceContrastDamping <= 0.42
            && value.scaffoldStationScale >= 0.72
            && value.scaffoldStationScale <= 1
            && value.crownInteriorContinuity >= 0
            && value.crownInteriorContinuity <= 1.5
            && value.successionReturn >= 0
            && value.successionReturn <= 1.5
            && value.authority === 'bounded_local_effects_only';
    }

    function architectureProfileMatchesControls(controls, value) {
        if (
            !validArchitectureControls(controls)
            || !validCrownArchitectureProfile(value)
        ) return false;
        const upperProgress = smoothstep(0.34, 0.96, value.coordinates.height);
        const transportProgress = smoothstep(
            0.3,
            0.94,
            value.coordinates.rootDistance,
        );
        const crownProgress = clamp(
            upperProgress * 0.72 + transportProgress * 0.28,
            0,
            1,
        );
        const branchLayerWeight = value.axisOrder === 0
            ? 0.64
            : (value.axisOrder === 1 ? 1 : 0.82);
        const upperComplexityPressure = clamp(
            controls.upperCrownComplexity
                * crownProgress
                * branchLayerWeight,
            0,
            1.4,
        );
        const expected = {
            upperProgress,
            transportProgress,
            crownProgress,
            branchLayerWeight,
            upperComplexityPressure,
            familyCapacityRetentionShift: clamp(
                upperComplexityPressure * 0.045,
                0,
                0.063,
            ),
            reiterationFractionShift: clamp(
                upperComplexityPressure * 0.04,
                0,
                0.056,
            ),
            descendantConstructionShift: clamp(
                upperComplexityPressure * 0.05,
                0,
                0.07,
            ),
            lateralOpportunityShift: clamp(
                upperComplexityPressure * 0.17,
                0,
                0.238,
            ),
            resourceContrastDamping: clamp(
                upperComplexityPressure * 0.3,
                0,
                0.42,
            ),
            scaffoldStationScale: clamp(
                1 - controls.scaffoldStationCompression
                    * upperProgress
                    * 0.2,
                0.72,
                1,
            ),
            crownInteriorContinuity: controls.crownInteriorContinuity,
            successionReturn: controls.successionReturn,
        };
        return Object.entries(expected).every(([key, expectedValue]) => (
            Math.abs(value[key] - rounded(expectedValue)) <= 2e-7
        ));
    }

    scope.ZenBonsaiTypedDevelopmentalSchedulerCrownArchitecture = Object.freeze({
        CROWN_ARCHITECTURE_CONTROL_SEMANTICS,
        CROWN_ARCHITECTURE_PROFILE_SEMANTICS,
        CONTROL_DEFINITIONS,
        resolveResearchControls,
        resolveArchitectureControls,
        resolveCrownArchitectureProfile,
        validArchitectureControls,
        validCrownArchitectureProfile,
        architectureProfileMatchesControls,
    });
}(zenPlumeKernelRealm));
