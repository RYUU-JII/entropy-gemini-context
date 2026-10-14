import {zenPlumeKernelRealm} from "../../kernelRealm.js";
/**
 * G15.4 bounded developmental-strategy field.
 *
 * A specimen samples a small number of explainable behavioral axes once. Each
 * axis reads the same normalized local coordinates, so a tendency may vary by
 * distance from the center/root, canopy height, branch order, thickness, or
 * axis maturity without proliferating one-off rules in morphology owners.
 *
 * Sampling is isolated from the growth RNG. Ablations therefore reuse exactly
 * the same phenotype and axis coefficients while changing only which strategy
 * axes are active.
 */
(function installTypedDevelopmentalStrategy(scope) {
    'use strict';

    const programs = scope.ZenBonsaiTypedDevelopmentalSchedulerPrograms;
    if (!programs) {
        throw new Error('[G15.4_STRATEGY] developmental-programs.js must load first.');
    }
    const {
        AxisRng,
        clamp,
        magnitude,
        resolveCrownRadius,
        resolveRadialDistance,
        rounded,
    } = programs;

    const STRATEGY_SEMANTICS = 'sparse_explainable_developmental_strategy_v4';
    const BASIS_SEMANTICS = 'shared_normalized_morphology_coordinates_v1';
    const REGIME_SEMANTICS = 'sparse_directed_developmental_regime_v3';
    const DEVELOPMENTAL_TRAJECTORY_SEMANTICS =
        'sampled_continuous_ontogenetic_trajectory_v1';
    const DEVELOPMENTAL_TRAJECTORY_IDS = Object.freeze([
        'resource_contrast',
        'fork_aperture',
        'internode_extension',
        'axis_persistence',
    ]);

    const BASIS_CATALOG = Object.freeze({
        center_proximity: Object.freeze({
            label: 'center proximity',
            hypothesis: 'Axes near the vertical center may receive a different steering response.',
        }),
        radial_exposure: Object.freeze({
            label: 'radial exposure',
            hypothesis: 'Exposed crown edges experience different light and space pressure.',
        }),
        root_proximity: Object.freeze({
            label: 'root proximity',
            hypothesis: 'Transport distance and developmental age change away from the root.',
        }),
        canopy_height: Object.freeze({
            label: 'canopy height',
            hypothesis: 'Canopy layers may express different fork and extension habits.',
        }),
        trunk_layer: Object.freeze({
            label: 'trunk layer',
            hypothesis: 'Order-zero axes may preserve a distinct structural temperament.',
        }),
        scaffold_layer: Object.freeze({
            label: 'scaffold layer',
            hypothesis: 'Order-one axes may specialize toward load support or lateral reach.',
        }),
        twig_layer: Object.freeze({
            label: 'twig layer',
            hypothesis: 'Terminal axes may favor compact, rapidly changing behavior.',
        }),
        thinness: Object.freeze({
            label: 'relative thinness',
            hypothesis: 'Mechanical response and extension opportunity vary with thickness.',
        }),
        axis_maturity: Object.freeze({
            label: 'axis maturity',
            hypothesis: 'A young axis and an axis near recommitment need not use the same rule strength.',
        }),
    });

    const STRATEGY_AXES = Object.freeze({
        fork_rhythm: Object.freeze({
            label: 'fork rhythm field',
            effect: 'fork_interval_scale',
            hypothesis: 'Fork opportunity changes continuously across developmental position.',
            effectStrength: 0.38,
            bases: Object.freeze([
                'root_proximity',
                'canopy_height',
                'axis_maturity',
                'trunk_layer',
                'scaffold_layer',
                'thinness',
            ]),
        }),
        aperture_field: Object.freeze({
            label: 'aperture field',
            effect: 'aperture_scale',
            hypothesis: 'Fork aperture responds to exposure, layer, height, and local load.',
            effectStrength: 0.24,
            bases: Object.freeze([
                'radial_exposure',
                'root_proximity',
                'canopy_height',
                'trunk_layer',
                'scaffold_layer',
                'twig_layer',
                'thinness',
            ]),
        }),
        curvature_field: Object.freeze({
            label: 'curvature field',
            effect: 'turn_scale',
            hypothesis: 'Episode curvature varies with center proximity, height, order, and maturity.',
            effectStrength: 0.3,
            bases: Object.freeze([
                'center_proximity',
                'root_proximity',
                'canopy_height',
                'trunk_layer',
                'scaffold_layer',
                'thinness',
                'axis_maturity',
            ]),
        }),
        allocation_coupling: Object.freeze({
            label: 'support-extension coupling',
            effect: 'allocation_decoupling',
            hypothesis: 'Thickness, immediate reach, and future branching need not rise together.',
            effectStrength: 0.42,
            bases: Object.freeze([
                'root_proximity',
                'canopy_height',
                'trunk_layer',
                'scaffold_layer',
                'twig_layer',
                'thinness',
                'axis_maturity',
            ]),
        }),
        extension_maturation: Object.freeze({
            label: 'extension maturation field',
            effect: 'distal_attenuation_scale',
            hypothesis: 'Internode extension matures along transport distance, height, and axis age.',
            effectStrength: 0.82,
            bases: Object.freeze([
                'root_proximity',
                'canopy_height',
                'axis_maturity',
                'trunk_layer',
                'scaffold_layer',
                'thinness',
            ]),
        }),
        lateral_investment: Object.freeze({
            label: 'lateral investment field',
            effect: 'lateral_investment_scale',
            hypothesis: 'Support and extension may accumulate in lateral axes instead of the axial crown.',
            effectStrength: 0.45,
            bases: Object.freeze([
                'radial_exposure',
                'root_proximity',
                'canopy_height',
                'trunk_layer',
                'scaffold_layer',
                'thinness',
                'axis_maturity',
            ]),
        }),
        succession_kink: Object.freeze({
            label: 'succession kink response',
            effect: 'succession_kink_bias',
            hypothesis: 'Accumulated axis history may express a sparse directional pulse without suppressing either fork child.',
            effectStrength: 0.72,
            bases: Object.freeze([
                'root_proximity',
                'canopy_height',
                'axis_maturity',
                'trunk_layer',
                'scaffold_layer',
                'thinness',
            ]),
        }),
    });

    const STRATEGY_AXIS_IDS = Object.freeze(Object.keys(STRATEGY_AXES));

    function hashText(value) {
        let hash = 2166136261;
        for (const character of String(value)) {
            hash ^= character.charCodeAt(0);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    function axisRng(seed, axisId) {
        return new AxisRng((seed ^ hashText(axisId) ^ 0x9e3779b9) >>> 0);
    }

    function signedMagnitude(rng, minimum, maximum) {
        return rng.sign() * rng.range(minimum, maximum);
    }

    const REGIME_COORDINATE_IDS = Object.freeze([
        'axialPersistence',
        'lateralInvestment',
        'apicalCompression',
        'renewalResponse',
        'curvaturePersistence',
    ]);

    // Couplings are deliberately one-hop projections from independently
    // sampled source coordinates. A resolved target never becomes the source
    // of another coupling, so this table cannot create a feedback loop or a
    // hidden axial -> lateral -> kink -> curvature cascade.
    const REGIME_COUPLING_CATALOG = Object.freeze([
        Object.freeze({
            id: 'axial_to_apical_support',
            source: 'axialPersistence',
            target: 'apicalCompression',
            coefficient: 0.24,
            hypothesis: 'Persistent axes tend to carry somewhat more apical compression.',
        }),
        Object.freeze({
            id: 'lateral_to_apical_release',
            source: 'lateralInvestment',
            target: 'apicalCompression',
            coefficient: -0.22,
            hypothesis: 'Lateral investment can relax apical compression.',
        }),
        Object.freeze({
            id: 'lateral_to_renewal_opportunity',
            source: 'lateralInvestment',
            target: 'renewalResponse',
            coefficient: 0.2,
            hypothesis: 'A laterally invested family presents more renewal opportunities.',
        }),
        Object.freeze({
            id: 'apical_to_renewal_pressure',
            source: 'apicalCompression',
            target: 'renewalResponse',
            coefficient: 0.18,
            hypothesis: 'Compressed apical growth can increase renewal pressure.',
        }),
        Object.freeze({
            id: 'renewal_to_curvature_memory',
            source: 'renewalResponse',
            target: 'curvaturePersistence',
            coefficient: 0.24,
            hypothesis: 'Renewal history can leave directional memory.',
        }),
        Object.freeze({
            id: 'axial_to_curvature_resistance',
            source: 'axialPersistence',
            target: 'curvaturePersistence',
            coefficient: -0.16,
            hypothesis: 'Strong axial persistence can resist rapid curvature change.',
        }),
    ]);

    function sampleDevelopmentalRegime(seed) {
        const rng = axisRng(seed, 'developmental_regime');
        const independent = Object.freeze(Object.fromEntries(
            REGIME_COORDINATE_IDS.map((id) => [id, rounded(rng.range(-1, 1))]),
        ));
        const shuffledCouplings = [...REGIME_COUPLING_CATALOG];
        for (let index = shuffledCouplings.length - 1; index > 0; index -= 1) {
            const swapIndex = rng.integer(0, index);
            const candidate = shuffledCouplings[index];
            shuffledCouplings[index] = shuffledCouplings[swapIndex];
            shuffledCouplings[swapIndex] = candidate;
        }
        const activeCouplingCount = rng.next() < 0.34 ? 3 : 2;
        const contributions = Object.fromEntries(
            REGIME_COORDINATE_IDS.map((id) => [id, 0]),
        );
        const activeCouplings = shuffledCouplings
            .slice(0, activeCouplingCount)
            .map((coupling) => {
                const gain = rng.range(0.72, 1.08);
                const contribution = independent[coupling.source]
                    * coupling.coefficient
                    * gain;
                contributions[coupling.target] += contribution;
                return Object.freeze({
                    ...coupling,
                    gain: rounded(gain),
                    sourceValue: independent[coupling.source],
                    contribution: rounded(contribution),
                });
            });
        const resolved = Object.freeze(Object.fromEntries(
            REGIME_COORDINATE_IDS.map((id) => [
                id,
                rounded(clamp(independent[id] + contributions[id], -1, 1)),
            ]),
        ));
        return Object.freeze({
            semantics: REGIME_SEMANTICS,
            dependencySemantics: 'independent_coordinates_plus_one_hop_sparse_couplings_v1',
            independent,
            activeCouplings: Object.freeze(activeCouplings),
            ...resolved,
        });
    }

    function sampleDevelopmentalTrajectories(seed, regime, overrides = {}, enabled = true) {
        const correlated = Object.freeze({
            resource_contrast: Object.freeze({
                intercept: regime.axialPersistence * 0.12,
                slope: regime.axialPersistence * 0.2,
                bend: regime.renewalResponse * 0.08,
            }),
            fork_aperture: Object.freeze({
                intercept: regime.lateralInvestment * 0.14,
                slope: regime.lateralInvestment * 0.18
                    - regime.axialPersistence * 0.12,
                bend: regime.curvaturePersistence * 0.1,
            }),
            internode_extension: Object.freeze({
                intercept: -regime.apicalCompression * 0.16,
                slope: -regime.apicalCompression * 0.28
                    + regime.axialPersistence * 0.1,
                bend: regime.renewalResponse * -0.08,
            }),
            axis_persistence: Object.freeze({
                intercept: regime.axialPersistence * 0.18
                    - regime.apicalCompression * 0.1,
                slope: regime.axialPersistence * 0.3
                    - regime.apicalCompression * 0.18,
                bend: regime.renewalResponse * 0.12,
            }),
        });
        const sampled = Object.fromEntries(DEVELOPMENTAL_TRAJECTORY_IDS.map((id) => {
            const rng = axisRng(seed, `developmental_trajectory:${id}`);
            const override = overrides[id] || {};
            const read = (key, sampledValue, minimum, maximum) => {
                const value = override[key] === undefined
                    ? sampledValue
                    : Number(override[key]);
                if (!Number.isFinite(value)) {
                    throw new TypeError(
                        `[G15.4_STRATEGY] trajectory ${id}.${key} must be finite.`,
                    );
                }
                return rounded(clamp(value, minimum, maximum));
            };
            const heightWeight = read('heightWeight', rng.range(0.38, 0.62), 0.2, 0.72);
            const generationWeight = read(
                'generationWeight',
                rng.range(0.17, 0.34),
                0.08,
                0.44,
            );
            const maturityWeight = read(
                'maturityWeight',
                rng.range(0.08, 0.18),
                0.04,
                0.26,
            );
            const transportWeight = rounded(Math.max(
                0.04,
                1 - heightWeight - generationWeight - maturityWeight,
            ));
            const totalWeight = heightWeight
                + generationWeight
                + maturityWeight
                + transportWeight;
            return [id, Object.freeze({
                id,
                semantics: DEVELOPMENTAL_TRAJECTORY_SEMANTICS,
                enabled,
                intercept: read(
                    'intercept',
                    correlated[id].intercept + rng.range(-0.28, 0.28),
                    -0.72,
                    0.72,
                ),
                slope: read(
                    'slope',
                    correlated[id].slope + rng.range(-0.82, 0.82),
                    -1,
                    1,
                ),
                bend: read(
                    'bend',
                    correlated[id].bend + rng.range(-0.5, 0.5),
                    -0.72,
                    0.72,
                ),
                heightWeight: rounded(heightWeight / totalWeight),
                generationWeight: rounded(generationWeight / totalWeight),
                maturityWeight: rounded(maturityWeight / totalWeight),
                transportWeight: rounded(transportWeight / totalWeight),
            })];
        }));
        return Object.freeze(sampled);
    }

    function sampleAxis(seed, axisId, override = {}) {
        const definition = STRATEGY_AXES[axisId];
        if (!definition) throw new RangeError(`[G15.4_STRATEGY] Unknown axis: ${axisId}`);
        const rng = axisRng(seed, axisId);
        const primaryIndex = rng.integer(0, definition.bases.length - 1);
        let secondaryIndex = rng.integer(0, definition.bases.length - 2);
        if (secondaryIndex >= primaryIndex) secondaryIndex += 1;
        const primaryBasis = String(override.primaryBasis || definition.bases[primaryIndex]);
        const secondaryBasis = String(override.secondaryBasis || definition.bases[secondaryIndex]);
        if (!definition.bases.includes(primaryBasis)) {
            throw new RangeError(
                `[G15.4_STRATEGY] ${primaryBasis} is not valid for ${axisId}.`,
            );
        }
        if (!definition.bases.includes(secondaryBasis) || secondaryBasis === primaryBasis) {
            throw new RangeError(
                `[G15.4_STRATEGY] ${secondaryBasis} is not a distinct secondary basis for ${axisId}.`,
            );
        }
        const amplitude = override.amplitude === undefined
            ? signedMagnitude(rng, 0.44, 0.94)
            : clamp(Number(override.amplitude), -1, 1);
        const secondaryMix = override.secondaryMix === undefined
            ? rng.range(0.18, 0.38)
            : clamp(Number(override.secondaryMix), 0, 0.48);
        const secondaryPolarity = override.secondaryPolarity === undefined
            ? rng.sign()
            : (Number(override.secondaryPolarity) < 0 ? -1 : 1);
        const offset = override.offset === undefined
            ? rng.range(-0.11, 0.11)
            : clamp(Number(override.offset), -0.3, 0.3);
        if (![amplitude, secondaryMix, secondaryPolarity, offset].every(Number.isFinite)) {
            throw new TypeError(`[G15.4_STRATEGY] ${axisId} overrides must be finite.`);
        }
        return Object.freeze({
            id: axisId,
            label: definition.label,
            hypothesis: definition.hypothesis,
            effect: definition.effect,
            primaryBasis,
            secondaryBasis,
            amplitude: rounded(amplitude),
            secondaryMix: rounded(secondaryMix),
            secondaryPolarity,
            offset: rounded(offset),
        });
    }

    function normalizeStrategyInput(input) {
        if (input === undefined || input === null || input === 'sampled') {
            return {
                mode: 'sampled',
                enabledAxes: STRATEGY_AXIS_IDS,
                overrides: {},
                trajectoryOverrides: {},
                trajectoriesEnabled: true,
            };
        }
        if (input === 'baseline') {
            return {
                mode: 'baseline',
                enabledAxes: [],
                overrides: {},
                trajectoryOverrides: {},
                trajectoriesEnabled: true,
            };
        }
        if (typeof input !== 'object' || Array.isArray(input)) {
            throw new TypeError('[G15.4_STRATEGY] strategy must be sampled, baseline, or an object.');
        }
        const mode = String(input.mode || 'sampled');
        if (!['sampled', 'baseline'].includes(mode)) {
            throw new RangeError(`[G15.4_STRATEGY] Unknown strategy mode: ${mode}`);
        }
        const enabledAxes = input.enabledAxes === undefined
            ? (mode === 'baseline' ? [] : STRATEGY_AXIS_IDS)
            : Array.from(input.enabledAxes, String);
        const unknown = enabledAxes.filter((axisId) => !STRATEGY_AXES[axisId]);
        if (unknown.length) {
            throw new RangeError(`[G15.4_STRATEGY] Unknown enabled axes: ${unknown.join(', ')}`);
        }
        return {
            mode,
            enabledAxes: [...new Set(enabledAxes)],
            overrides: input.overrides || {},
            trajectoryOverrides: input.trajectoryOverrides || {},
            trajectoriesEnabled: input.trajectoriesEnabled === undefined
                ? true
                : Boolean(input.trajectoriesEnabled),
            seed: input.seed,
        };
    }

    function createDevelopmentalStrategy(specimenSeed, input) {
        const normalized = normalizeStrategyInput(input);
        const strategySeed = normalized.seed === undefined
            ? specimenSeed
            : Number(normalized.seed);
        if (!Number.isSafeInteger(strategySeed)) {
            throw new TypeError('[G15.4_STRATEGY] strategy seed must be a safe integer.');
        }
        const enabled = new Set(normalized.enabledAxes);
        const regime = sampleDevelopmentalRegime(strategySeed);
        const developmentalTrajectories = sampleDevelopmentalTrajectories(
            strategySeed,
            regime,
            normalized.trajectoryOverrides,
            normalized.trajectoriesEnabled,
        );
        const axes = Object.freeze(Object.fromEntries(STRATEGY_AXIS_IDS.map((axisId) => [
            axisId,
            Object.freeze({
                ...sampleAxis(strategySeed, axisId, normalized.overrides[axisId]),
                enabled: enabled.has(axisId),
            }),
        ])));
        return Object.freeze({
            id: `strategy-${strategySeed}-${normalized.enabledAxes.join('+') || 'baseline'}`,
            semantics: STRATEGY_SEMANTICS,
            basisSemantics: BASIS_SEMANTICS,
            mode: normalized.mode,
            seed: strategySeed,
            regime,
            developmentalTrajectorySemantics: DEVELOPMENTAL_TRAJECTORY_SEMANTICS,
            developmentalTrajectories,
            enabledAxes: Object.freeze([...normalized.enabledAxes]),
            axes,
        });
    }

    function resolveStrategyCoordinates(context, frontier, point) {
        const origin = point
            || context.nodeIndex?.get(frontier?.nodeId)?.point
            || { x: 0, y: 0, z: 0 };
        const crownRadius = Math.max(24, resolveCrownRadius(context));
        const heightScale = Math.max(
            120,
            260
                * context.form.heightScale
                * context.preset.statureScale
                * context.phenotype.stature,
        );
        const rootScale = Math.hypot(crownRadius, heightScale);
        const radial = clamp(resolveRadialDistance(origin) / crownRadius, 0, 1);
        const rootDistance = clamp(magnitude(origin) / rootScale, 0, 1);
        const height = clamp(origin.y / heightScale, 0, 1);
        const rootRadius = Math.max(1, 18.5 * context.vigor);
        const thickness = clamp(Number(frontier?.radius ?? rootRadius) / rootRadius, 0, 1);
        const maturity = clamp(
            Number(frontier?.axisAge ?? 0)
                / Math.max(1, Number(frontier?.axisStepLimit ?? 1)),
            0,
            1,
        );
        const tier = clamp(Math.round(Number(frontier?.tier ?? 0)), 0, 2);
        return Object.freeze({
            point: Object.freeze({
                x: rounded(origin.x),
                y: rounded(origin.y),
                z: rounded(origin.z),
            }),
            radial: rounded(radial),
            rootDistance: rounded(rootDistance),
            height: rounded(height),
            thickness: rounded(thickness),
            maturity: rounded(maturity),
            tier,
        });
    }

    function basisValues(coordinates) {
        const tierValue = (target) => (coordinates.tier === target ? 1 : -0.35);
        return Object.freeze({
            center_proximity: rounded(1 - coordinates.radial * 2),
            radial_exposure: rounded(coordinates.radial * 2 - 1),
            root_proximity: rounded(1 - coordinates.rootDistance * 2),
            canopy_height: rounded(coordinates.height * 2 - 1),
            trunk_layer: tierValue(0),
            scaffold_layer: tierValue(1),
            twig_layer: tierValue(2),
            thinness: rounded(1 - coordinates.thickness * 2),
            axis_maturity: rounded(coordinates.maturity * 2 - 1),
        });
    }

    function neutralEffect(axisId) {
        if (axisId === 'allocation_coupling') {
            return Object.freeze({ allocationDecoupling: 0 });
        }
        if (axisId === 'extension_maturation') {
            return Object.freeze({ distalAttenuationScale: 1 });
        }
        if (axisId === 'lateral_investment') {
            return Object.freeze({ lateralInvestmentScale: 1 });
        }
        if (axisId === 'succession_kink') {
            return Object.freeze({ kinkProbabilityShift: 0, kinkTurnScale: 1 });
        }
        const key = axisId === 'fork_rhythm'
            ? 'forkIntervalScale'
            : (axisId === 'aperture_field' ? 'apertureScale' : 'turnScale');
        return Object.freeze({ [key]: 1 });
    }

    function resolveEffect(axisId, value) {
        const definition = STRATEGY_AXES[axisId];
        if (axisId === 'allocation_coupling') {
            return Object.freeze({
                allocationDecoupling: rounded(value * definition.effectStrength),
            });
        }
        if (axisId === 'extension_maturation') {
            return Object.freeze({
                distalAttenuationScale: rounded(Math.exp(value * definition.effectStrength)),
            });
        }
        if (axisId === 'lateral_investment') {
            return Object.freeze({
                lateralInvestmentScale: rounded(Math.exp(value * definition.effectStrength)),
            });
        }
        if (axisId === 'succession_kink') {
            return Object.freeze({
                kinkProbabilityShift: rounded(value * definition.effectStrength * 0.18),
                kinkTurnScale: rounded(Math.exp(value * definition.effectStrength * 0.28)),
            });
        }
        const key = axisId === 'fork_rhythm'
            ? 'forkIntervalScale'
            : (axisId === 'aperture_field' ? 'apertureScale' : 'turnScale');
        return Object.freeze({
            [key]: rounded(Math.exp(value * definition.effectStrength)),
        });
    }

    function evaluateStrategyAxis(context, axisId, frontier, point) {
        const axis = context.strategy?.axes?.[axisId];
        if (!axis) throw new Error(`[G15.4_STRATEGY] Context is missing axis ${axisId}.`);
        const coordinates = resolveStrategyCoordinates(context, frontier, point);
        const values = basisValues(coordinates);
        const lineageResponse = clamp(
            Number(frontier?.temperament?.lineageResponse?.[axisId] ?? 0),
            -1,
            1,
        );
        const regime = context.strategy.regime;
        const regimeProjection = {
            fork_rhythm: -regime.apicalCompression * 0.58
                + regime.axialPersistence * 0.42,
            aperture_field: regime.lateralInvestment * 0.72
                - regime.axialPersistence * 0.28,
            curvature_field: regime.curvaturePersistence * 0.7
                + regime.renewalResponse * 0.3,
            allocation_coupling: regime.lateralInvestment * 0.56
                - regime.axialPersistence * 0.44,
            extension_maturation: regime.apicalCompression * 0.64
                - regime.axialPersistence * 0.36,
            lateral_investment: regime.lateralInvestment,
            succession_kink: regime.renewalResponse,
        }[axisId] || 0;
        if (!axis.enabled) {
            return Object.freeze({
                semantics: STRATEGY_SEMANTICS,
                axisId,
                enabled: false,
                coordinates,
                primary: Object.freeze({ id: axis.primaryBasis, value: values[axis.primaryBasis] }),
                secondary: Object.freeze({ id: axis.secondaryBasis, value: values[axis.secondaryBasis] }),
                lineageResponse: rounded(lineageResponse),
                value: 0,
                effect: neutralEffect(axisId),
            });
        }
        const primaryWeight = 1 - axis.secondaryMix;
        const primaryContribution = values[axis.primaryBasis] * primaryWeight;
        const secondaryContribution = values[axis.secondaryBasis]
            * axis.secondaryMix
            * axis.secondaryPolarity;
        const fieldValue = axis.offset + axis.amplitude
            * (primaryContribution + secondaryContribution);
        const responseGain = 1 + lineageResponse * 0.18;
        const regimeContribution = regimeProjection * Math.abs(axis.amplitude) * 0.3;
        const raw = fieldValue * responseGain
            + lineageResponse * 0.22 * Math.abs(axis.amplitude)
            + regimeContribution;
        const value = clamp(raw, -1, 1);
        return Object.freeze({
            semantics: STRATEGY_SEMANTICS,
            axisId,
            enabled: true,
            coordinates,
            primary: Object.freeze({
                id: axis.primaryBasis,
                value: values[axis.primaryBasis],
                contribution: rounded(primaryContribution),
            }),
            secondary: Object.freeze({
                id: axis.secondaryBasis,
                value: values[axis.secondaryBasis],
                polarity: axis.secondaryPolarity,
                contribution: rounded(secondaryContribution),
            }),
            amplitude: axis.amplitude,
            offset: axis.offset,
            fieldValue: rounded(fieldValue),
            lineageResponse: rounded(lineageResponse),
            responseGain: rounded(responseGain),
            regimeProjection: rounded(regimeProjection),
            regimeContribution: rounded(regimeContribution),
            rawValue: rounded(raw),
            value: rounded(value),
            effect: resolveEffect(axisId, value),
        });
    }

    scope.ZenBonsaiTypedDevelopmentalSchedulerStrategy = Object.freeze({
        STRATEGY_SEMANTICS,
        BASIS_SEMANTICS,
        REGIME_SEMANTICS,
        DEVELOPMENTAL_TRAJECTORY_SEMANTICS,
        DEVELOPMENTAL_TRAJECTORY_IDS,
        BASIS_CATALOG,
        STRATEGY_AXES,
        STRATEGY_AXIS_IDS,
        createDevelopmentalStrategy,
        resolveStrategyCoordinates,
        evaluateStrategyAxis,
    });
}(zenPlumeKernelRealm));
