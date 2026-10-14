/**
 * G15.4 developmental programs and pure foundations.
 *
 * This owner contains immutable research programs, vector/math helpers,
 * deterministic RNG, phenotype sampling, authoritative tier roles, and temperament
 * inheritance. It has no graph mutation or scheduler authority.
 */
import { clamp, rounded } from './ZenBonsaiG15Math.js';

(function installTypedDevelopmentalPrograms(scope) {
    'use strict';

    const MODEL_ID = 'g15_4_typed_developmental_scheduler_v39';
    const CONTRACT_ID = 'standalone_bonsai_typed_developmental_scheduler_v39';
    const TIER_NAMES = Object.freeze([
        'structural_framework',
        'scaffold_family',
        'terminal_ramification',
    ]);
    const AXIS_ORDER_NAMES = Object.freeze(['order_0', 'order_1', 'order_2']);
    const AXIS_ORDER_SEMANTICS = 'role_authoritative_three_tier_axis_order_v1';
    const BIRTH_MODE_SEMANTICS = 'orthogonal_axis_birth_mode_v1';
    const NODE_MERISTEM_SEMANTICS = 'joint_apical_lateral_node_transaction_v3';
    const LINEAGE_RESPONSE_SEMANTICS = 'sibling_covariant_lineage_response_v1';
    const FORK_SEMANTICS = 'atomic_recursive_axis_succession_v3';
    const RESOURCE_SEMANTICS = 'continuous_axis_family_construction_portfolio_v18';
    const ANGLE_SEMANTICS = 'resource_independent_flow_load_moment_projection_v10';
    const EPISODE_SEMANTICS = 'axis_order_coherent_recursive_episode_v6';
    const PHENOTYPE_SEMANTICS = 'typed_developmental_scheduler_phenotype_v4';
    const OCCUPANCY_SEMANTICS = 'cluster_aware_prospective_corridor_reservations_v2';
    const RESOURCE_ECONOMY_SEMANTICS = 'history_evolved_axis_transport_economy_v9';
    const CLUSTER_SEMANTICS = 'family_oriented_terminal_envelope_slots_v5';
    const BALANCE_SEMANTICS = 'continuous_mass_silhouette_support_feedback_v3';
    const AXIS_SUCCESSION_SEMANTICS = 'lineage_phase_field_axis_handoff_v8';
    const ORDER_ZERO_SUPPORT_SEMANTICS = 'style_bounded_seed_conditioned_gravity_support_v2';
    const COMPLETION_SEMANTICS = 'growth_unit_quiescent_global_stop_v6';
    const LATERAL_MERISTEM_SEMANTICS = 'joint_live_lateral_meristem_emission_v8';
    const CROWN_INTERIOR_EXPOSURE_SEMANTICS =
        'causal_live_crown_interior_exposure_v2';
    const SCAFFOLD_FAMILY_DOMINANCE_SEMANTICS =
        'causal_scaffold_family_dominance_continuity_v1';
    const SCHEDULER_SEMANTICS = 'upper_establishment_family_recovery_priority_v13';
    const AXIS_LIFECYCLE_SEMANTICS = 'explicit_growth_unit_axis_lifecycle_v19';
    const FORK_POTENTIAL_SEMANTICS = 'growth_unit_endpoint_differentiation_v12';
    const SUCCESSION_KINK_SEMANTICS =
        'sparse_child_specific_order_zero_succession_kink_v2';

    const axisOrderNameFor = (axisOrder) => AXIS_ORDER_NAMES[
        Math.max(0, Math.min(2, Math.round(Number(axisOrder || 0))))
    ];

    const add = (left, right) => ({
        x: left.x + right.x,
        y: left.y + right.y,
        z: left.z + right.z,
    });
    const subtract = (left, right) => ({
        x: left.x - right.x,
        y: left.y - right.y,
        z: left.z - right.z,
    });
    const scale = (vector, amount) => ({
        x: vector.x * amount,
        y: vector.y * amount,
        z: vector.z * amount,
    });
    const magnitude = (vector) => Math.hypot(vector.x, vector.y, vector.z);
    const distance = (left, right) => magnitude(subtract(left, right));
    const dot = (left, right) => (
        left.x * right.x + left.y * right.y + left.z * right.z
    );
    const normalize = (vector) => {
        const amount = magnitude(vector);
        if (amount <= 1e-10) {
            throw new Error('[G15.4_MASS] Cannot normalize a zero vector.');
        }
        return scale(vector, 1 / amount);
    };
    const mixDirection = (left, right, weight) => normalize(add(
        scale(left, 1 - weight),
        scale(right, weight),
    ));
    const pointAt = (origin, direction, runLength) => add(
        origin,
        scale(direction, runLength),
    );
    const resolveCrownRadius = (context) => 82
        * context.form.spreadScale
        * context.preset.spreadScale
        * context.phenotype.crownSpread;
    const resolveRadialDistance = (point) => Math.hypot(point.x, point.z * 0.72);
    const rotateGrowthPlane = (direction, radians) => {
        const cosine = Math.cos(radians);
        const sine = Math.sin(radians);
        return normalize({
            x: direction.x * cosine + direction.y * sine,
            y: -direction.x * sine + direction.y * cosine,
            z: direction.z,
        });
    };
    const rotateWorldAzimuth = (direction, radians) => {
        const normalized = normalize(direction);
        const cosine = Math.cos(radians);
        const sine = Math.sin(radians);
        return normalize({
            x: normalized.x * cosine + normalized.z * sine,
            y: normalized.y,
            z: -normalized.x * sine + normalized.z * cosine,
        });
    };
    const directionFromAzimuthElevation = (azimuth, elevation) => {
        const horizontal = Math.cos(elevation);
        return normalize({
            x: Math.sin(azimuth) * horizontal,
            y: Math.sin(elevation),
            z: Math.cos(azimuth) * horizontal,
        });
    };
    const directionAzimuth = (direction) => {
        const normalized = normalize(direction);
        return Math.atan2(normalized.x, normalized.z);
    };
    const directionElevation = (direction) => Math.asin(clamp(
        normalize(direction).y,
        -1,
        1,
    ));
    const tiltDepth = (direction, amount) => normalize({
        x: direction.x,
        y: direction.y,
        z: direction.z + amount,
    });
    const angularDistance = (left, right) => Math.acos(clamp(
        dot(normalize(left), normalize(right)),
        -1,
        1,
    ));
    const constrainDirectionToCone = (direction, anchor, maximumAngle) => {
        const normalizedDirection = normalize(direction);
        const normalizedAnchor = normalize(anchor);
        const angle = angularDistance(normalizedAnchor, normalizedDirection);
        if (angle <= maximumAngle) return normalizedDirection;
        const sine = Math.sin(angle);
        if (Math.abs(sine) <= 1e-8) return normalizedAnchor;
        const progress = maximumAngle / angle;
        return normalize(add(
            scale(normalizedAnchor, Math.sin((1 - progress) * angle) / sine),
            scale(normalizedDirection, Math.sin(progress * angle) / sine),
        ));
    };
    const resolveOrderZeroSupport = (context) => {
        const support = context?.preset?.orderZeroSupport;
        if (!support) return null;
        // A co-dominant, high-spread phenotype can carry a broader pair of
        // structural axes without granting the same freedom to a lone heavy
        // continuation. This is a seed-level interaction between two fields,
        // not a separate umbrella preset or an after-the-fact silhouette rule.
        const codominantSpreadShiftDegrees = clamp(
            Math.max(0, Number(context?.phenotype?.crownSpread || 1) - 1) * 18
                + Math.max(
                    0,
                    Number(context?.phenotype?.balancedForkFrequency || 0.5) - 0.78,
                ) * 12,
            0,
            9,
        );
        return Object.freeze({
            semantics: ORDER_ZERO_SUPPORT_SEMANTICS,
            softLeanRadians: support.softLeanDegrees * Math.PI / 180,
            maximumLeanRadians: (
                support.maximumLeanDegrees + codominantSpreadShiftDegrees * 0.35
            ) * Math.PI / 180,
            continuationTurnRadians: support.continuationTurnDegrees * Math.PI / 180,
            codominantTurnRadians: (
                support.codominantTurnDegrees + codominantSpreadShiftDegrees
            ) * Math.PI / 180,
            minimumHorizontalDominance: support.minimumHorizontalDominance,
            codominantSpreadShiftDegrees: rounded(codominantSpreadShiftDegrees),
        });
    };
    const stabilizeOrderZeroHeading = (context, direction, marginRadians = 0) => {
        const support = resolveOrderZeroSupport(context);
        if (!support) return normalize(direction);
        return constrainDirectionToCone(
            direction,
            { x: 0, y: 1, z: 0 },
            Math.max(0.1, support.maximumLeanRadians - marginRadians),
        );
    };
    const signedPlanarAngle = (from, to) => {
        let angle = Math.atan2(to.x, to.y) - Math.atan2(from.x, from.y);
        while (angle > Math.PI) angle -= Math.PI * 2;
        while (angle < -Math.PI) angle += Math.PI * 2;
        return angle;
    };
    const sum = (values) => values.reduce((total, value) => total + value, 0);

    /**
     * Preserve the hierarchy established by an order-1 scaffold junction.
     *
     * This is deliberately not a maximum child size. A subordinate family may
     * keep extending and may remain highly exposed. What it may not do is
     * silently acquire the same recursive and reproductive authority as the
     * scaffold continuation after being born through a small, oblique
     * junction. A future pruning/damage owner may explicitly replace the
     * leader by changing replacementState with one of the named causal events.
     */
    function createScaffoldFamilyDominanceClaim(spec = {}) {
        const sourceAxisOrder = Math.max(
            0,
            Math.round(Number(spec.sourceAxisOrder || 0)),
        );
        const childAxisOrder = Math.max(
            0,
            Math.round(Number(spec.childAxisOrder || 0)),
        );
        if (
            sourceAxisOrder !== 1
            || childAxisOrder <= sourceAxisOrder
            || spec.temporaryAxis
        ) return null;
        const sourceAreaFraction = clamp(
            Number(spec.sourceAreaFraction || 0),
            0.02,
            0.49,
        );
        const sourceResourceShare = clamp(
            Number(spec.sourceResourceShare || sourceAreaFraction),
            0.02,
            0.49,
        );
        const sourceDeflectionRadians = clamp(
            Math.abs(Number(spec.sourceDeflectionRadians || 0)),
            0,
            Math.PI,
        );
        const areaSubordination = clamp(
            (0.34 - sourceAreaFraction) / 0.24,
            0,
            1,
        );
        const resourceSubordination = clamp(
            (0.42 - sourceResourceShare) / 0.28,
            0,
            1,
        );
        const deflectionSubordination = clamp(
            (sourceDeflectionRadians - 0.28) / 0.62,
            0,
            1,
        );
        const hierarchyStrength = clamp(
            areaSubordination * 0.48
                + resourceSubordination * 0.28
                + deflectionSubordination * 0.24,
            0,
            1,
        );
        return Object.freeze({
            semantics: SCAFFOLD_FAMILY_DOMINANCE_SEMANTICS,
            claimId: String(spec.claimId),
            sourceKind: String(spec.sourceKind),
            sourceSequence: Math.max(0, Math.round(Number(spec.sourceSequence || 0))),
            sourceNodeId: spec.sourceNodeId || null,
            sourceScaffoldLineageId: String(spec.sourceScaffoldLineageId),
            subordinateRootLineageId: String(spec.subordinateRootLineageId),
            carrierLineageId: String(
                spec.carrierLineageId || spec.subordinateRootLineageId,
            ),
            sourceAxisOrder,
            childAxisOrder,
            sourceAreaFraction: rounded(sourceAreaFraction),
            sourceResourceShare: rounded(sourceResourceShare),
            sourceDeflectionRadians: rounded(sourceDeflectionRadians),
            sourceForwardDot: rounded(Math.cos(sourceDeflectionRadians)),
            areaSubordination: rounded(areaSubordination),
            resourceSubordination: rounded(resourceSubordination),
            deflectionSubordination: rounded(deflectionSubordination),
            hierarchyStrength: rounded(hierarchyStrength),
            reiterationThresholdBoost: rounded(clamp(
                0.06 + hierarchyStrength * 0.19,
                0.06,
                0.25,
            )),
            terminalLoadScale: rounded(clamp(
                1 - hierarchyStrength * 0.22,
                0.78,
                1,
            )),
            replacementState: 'subordinate',
            replacementCause: null,
            explicitReplacementRequired: true,
            inheritedFromClaimId: spec.inheritedFromClaimId || null,
            carriedAtSequence: spec.carriedAtSequence ?? null,
            carriedThroughForkCount: Math.max(
                0,
                Math.round(Number(spec.carriedThroughForkCount || 0)),
            ),
            authority: 'branching_and_terminal_load_modulation_only',
            createsGeometry: false,
            createsConstruction: false,
        });
    }

    function inheritScaffoldFamilyDominanceClaim(claim, spec = {}) {
        if (
            !claim
            || claim.semantics !== SCAFFOLD_FAMILY_DOMINANCE_SEMANTICS
        ) return null;
        return Object.freeze({
            ...claim,
            carrierLineageId: String(spec.carrierLineageId),
            childAxisOrder: Math.max(
                claim.childAxisOrder,
                Math.round(Number(spec.childAxisOrder || claim.childAxisOrder)),
            ),
            inheritedFromClaimId: claim.claimId,
            carriedAtSequence: Math.max(
                0,
                Math.round(Number(spec.carriedAtSequence || 0)),
            ),
            carriedThroughForkCount: Number(claim.carriedThroughForkCount || 0)
                + Number(Boolean(spec.throughFork)),
        });
    }

    function resolveScaffoldFamilyDominance(claim) {
        if (
            !claim
            || claim.semantics !== SCAFFOLD_FAMILY_DOMINANCE_SEMANTICS
        ) return null;
        const replacementCauses = new Set([
            'apical_damage',
            'explicit_pruning',
            'leader_maintenance_failure',
        ]);
        const replacementActive = claim.replacementState === 'leader_replacement'
            && replacementCauses.has(claim.replacementCause);
        const pressure = replacementActive
            ? 0
            : clamp(Number(claim.hierarchyStrength || 0), 0, 1);
        return Object.freeze({
            semantics: SCAFFOLD_FAMILY_DOMINANCE_SEMANTICS,
            claimId: claim.claimId,
            carrierLineageId: claim.carrierLineageId,
            replacementState: claim.replacementState,
            replacementCause: claim.replacementCause,
            replacementActive,
            pressure: rounded(pressure),
            reiterationThresholdBoost: rounded(
                replacementActive
                    ? 0
                    : Number(claim.reiterationThresholdBoost || 0),
            ),
            terminalLoadScale: rounded(
                replacementActive ? 1 : Number(claim.terminalLoadScale || 1),
            ),
            decision: replacementActive
                ? 'causal_leader_replacement'
                : 'subordinate_scaffold_family_continuity',
        });
    }

    const LINEAGE_RESPONSE_KEYS = Object.freeze([
        'fork_rhythm',
        'aperture_field',
        'curvature_field',
        'allocation_coupling',
        'extension_maturation',
        'lateral_investment',
        'succession_kink',
        'lateral_competence',
        'axis_extent',
        'handoff_phase',
    ]);

    function freezeLineageResponse(values) {
        return Object.freeze({
            semantics: LINEAGE_RESPONSE_SEMANTICS,
            ...Object.fromEntries(LINEAGE_RESPONSE_KEYS.map((key) => [
                key,
                rounded(clamp(Number(values?.[key] ?? 0), -1, 1)),
            ])),
        });
    }

    function createRootLineageResponse(phenotype, rng) {
        const magnitudeScale = 0.06 + phenotype.lineageDifferentiation * 0.06;
        return freezeLineageResponse(Object.fromEntries(
            LINEAGE_RESPONSE_KEYS.map((key, index) => [
                key,
                rng.range(-magnitudeScale, magnitudeScale)
                    + Math.sin((index + 1) * 1.731) * magnitudeScale * 0.18,
            ]),
        ));
    }

    /**
     * Children inherit one correlated family field plus a centered sibling
     * contrast. The centered increment conserves the family tendency without
     * making two equal-resource children execute one cloned program.
     */
    function createSiblingLineageResponses(
        parentResponse,
        shares,
        specializationPolarities,
        phenotype,
        rng,
    ) {
        if (
            !Array.isArray(shares)
            || shares.length < 2
            || shares.length !== specializationPolarities.length
        ) {
            throw new TypeError(
                '[G15.4_LINEAGE] Sibling responses require aligned shares and polarities.',
            );
        }
        const meanShare = 1 / shares.length;
        const differentiation = phenotype.lineageDifferentiation;
        const rawByKey = Object.fromEntries(LINEAGE_RESPONSE_KEYS.map((key, keyIndex) => {
            const polarityWeight = 0.42 + (keyIndex % 3) * 0.09;
            const massWeight = keyIndex % 2 === 0 ? 0.28 : -0.22;
            const phase = (keyIndex + 1) * 1.917;
            const raw = shares.map((share, childIndex) => {
                const massDeviation = (share - meanShare) / Math.max(meanShare, 1e-8);
                const structured = specializationPolarities[childIndex]
                    * polarityWeight
                    * Math.sin(phase + childIndex * 0.41);
                return structured
                    + massDeviation * massWeight
                    + rng.range(-0.2, 0.2);
            });
            const average = sum(raw) / raw.length;
            return [key, raw.map((value) => value - average)];
        }));
        return Object.freeze(shares.map((_, childIndex) => freezeLineageResponse(
            Object.fromEntries(LINEAGE_RESPONSE_KEYS.map((key) => [
                key,
                Number(parentResponse?.[key] ?? 0) * 0.46
                    + rawByKey[key][childIndex] * differentiation * 0.78,
            ])),
        )));
    }

    function createLateralLineageResponse(parentResponse, side, resourceShare, phase) {
        const polarity = Math.sign(side) || 1;
        const resourceSignal = clamp((resourceShare - 0.14) / 0.08, -1, 1);
        return freezeLineageResponse(Object.fromEntries(
            LINEAGE_RESPONSE_KEYS.map((key, index) => [
                key,
                Number(parentResponse?.[key] ?? 0) * 0.54
                    + polarity * Math.sin(phase + (index + 1) * 1.37) * 0.32
                    + resourceSignal * (index % 2 === 0 ? 0.08 : -0.06),
            ]),
        ));
    }

    class AxisRng {
        constructor(seed) {
            this.state = (seed >>> 0) || 0x6d2b79f5;
        }

        next() {
            this.state = (this.state + 0x6d2b79f5) >>> 0;
            let value = this.state;
            value = Math.imul(value ^ (value >>> 15), value | 1);
            value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
            return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
        }

        range(minimum, maximum) {
            return minimum + (maximum - minimum) * this.next();
        }

        integer(minimum, maximum) {
            return Math.floor(this.range(minimum, maximum + 1));
        }

        sign() {
            return this.next() < 0.5 ? -1 : 1;
        }
    }

    const PRESETS = Object.freeze({
        natural: Object.freeze({
            label: 'Natural',
            initialHeading: Object.freeze({ x: 0.02, y: 0.999, z: 0.018 }),
            statureScale: 1,
            spreadScale: 1,
            turnScale: 1,
            densityScale: 1,
            eventScale: 1,
            wind: 0,
            orderZeroSupport: Object.freeze({
                softLeanDegrees: 28,
                maximumLeanDegrees: 48,
                continuationTurnDegrees: 22,
                codominantTurnDegrees: 34,
                minimumHorizontalDominance: 0.68,
            }),
        }),
        moyogi: Object.freeze({
            label: 'Moyogi',
            initialHeading: Object.freeze({ x: 0.07, y: 0.997, z: 0.02 }),
            statureScale: 1.02,
            spreadScale: 1,
            turnScale: 1.18,
            densityScale: 0.98,
            eventScale: 1,
            wind: 0.02,
            orderZeroSupport: Object.freeze({
                softLeanDegrees: 32,
                maximumLeanDegrees: 52,
                continuationTurnDegrees: 24,
                codominantTurnDegrees: 36,
                minimumHorizontalDominance: 0.68,
            }),
        }),
        bunjin: Object.freeze({
            label: 'Bunjin',
            initialHeading: Object.freeze({ x: 0.05, y: 0.998, z: 0.012 }),
            statureScale: 1.16,
            spreadScale: 0.78,
            turnScale: 0.88,
            densityScale: 0.66,
            eventScale: 0.76,
            wind: 0.04,
            orderZeroSupport: Object.freeze({
                softLeanDegrees: 35,
                maximumLeanDegrees: 56,
                continuationTurnDegrees: 24,
                codominantTurnDegrees: 36,
                minimumHorizontalDominance: 0.69,
            }),
        }),
        shakan: Object.freeze({
            label: 'Shakan',
            initialHeading: Object.freeze({ x: 0.24, y: 0.97, z: 0.018 }),
            statureScale: 0.96,
            spreadScale: 1.12,
            turnScale: 1.02,
            densityScale: 0.92,
            eventScale: 0.96,
            wind: 0.08,
            orderZeroSupport: Object.freeze({
                softLeanDegrees: 43,
                maximumLeanDegrees: 64,
                continuationTurnDegrees: 26,
                codominantTurnDegrees: 38,
                minimumHorizontalDominance: 0.68,
            }),
        }),
        sokan: Object.freeze({
            label: 'Sokan',
            initialHeading: Object.freeze({ x: -0.025, y: 0.999, z: 0.018 }),
            statureScale: 0.94,
            spreadScale: 1.14,
            turnScale: 0.94,
            densityScale: 0.9,
            eventScale: 1.04,
            wind: 0,
            orderZeroSupport: Object.freeze({
                softLeanDegrees: 30,
                maximumLeanDegrees: 50,
                continuationTurnDegrees: 22,
                codominantTurnDegrees: 34,
                minimumHorizontalDominance: 0.68,
            }),
        }),
        fukinagashi: Object.freeze({
            label: 'Fukinagashi',
            initialHeading: Object.freeze({ x: 0.15, y: 0.988, z: 0.012 }),
            statureScale: 0.92,
            spreadScale: 1.22,
            turnScale: 0.92,
            densityScale: 0.86,
            eventScale: 0.92,
            wind: 0.24,
            orderZeroSupport: Object.freeze({
                softLeanDegrees: 50,
                maximumLeanDegrees: 72,
                continuationTurnDegrees: 28,
                codominantTurnDegrees: 40,
                minimumHorizontalDominance: 0.7,
            }),
        }),
        kengai: Object.freeze({
            label: 'Kengai',
            initialHeading: Object.freeze({ x: 0.31, y: 0.95, z: 0.01 }),
            statureScale: 0.86,
            spreadScale: 1.18,
            turnScale: 1.04,
            densityScale: 0.78,
            eventScale: 0.86,
            wind: 0.12,
            orderZeroSupport: null,
        }),
    });

    const FORM_PROGRAMS = Object.freeze({
        central_recursive_meander: Object.freeze({
            label: 'Central recursive meander',
            description: 'Repeated trunk-order succession with correlated episode turns.',
            kind: 'central_recursive_meander',
            firstForkAge: Object.freeze([3, 6]),
            balancedBoost: 0.28,
            firstShareMode: 'hierarchical_continuum',
            firstArity: 2,
            divergence: Object.freeze([0.84, 1.56]),
            referenceVerticalWeight: 0.07,
            dominantSuccessionBoost: 0.18,
            episodeTurn: Object.freeze([0.42, 0.82]),
            spreadScale: 1,
            heightScale: 1.08,
            targetSegments: 52,
            targetTips: 10,
            targetGenerationDepth: 6,
            targetDepthSpan: 46,
            horizontalScaffoldRate: 0.32,
            massOffsetScale: 0.38,
            targetStructuralCost: 82,
            targetOrderZeroForks: 3,
            minimumOrderOneChildren: 1,
            targetScaffoldAttachments: 5,
            targetScaffoldBands: 4,
            targetTerminalLobes: 4,
            targetTerminalRamifications: 2,
            segmentBudget: Object.freeze([48, 58]),
        }),
        low_spread: Object.freeze({
            label: 'Low spread',
            description: 'A short bole births two co-dominant, outward-running trunks.',
            kind: 'low_spread',
            firstForkAge: Object.freeze([2, 3]),
            balancedBoost: 0.52,
            firstShareMode: 'balanced_continuum',
            firstArity: 2,
            divergence: Object.freeze([1.42, 2.12]),
            referenceVerticalWeight: 0.018,
            dominantSuccessionBoost: -0.18,
            episodeTurn: Object.freeze([0.18, 0.4]),
            spreadScale: 1.52,
            heightScale: 0.74,
            targetSegments: 80,
            targetTips: 16,
            targetGenerationDepth: 6,
            targetDepthSpan: 54,
            horizontalScaffoldRate: 0.48,
            massOffsetScale: 0.24,
            targetStructuralCost: 104,
            targetOrderZeroForks: 3,
            minimumOrderOneChildren: 1,
            targetScaffoldAttachments: 6,
            targetScaffoldBands: 3,
            targetTerminalLobes: 6,
            targetTerminalRamifications: 3,
            segmentBudget: Object.freeze([40, 52]),
        }),
        asymmetric_counterweight: Object.freeze({
            label: 'Asymmetric / counterweight',
            description: 'A long dominant axis and a living, recursively branching counterweight.',
            kind: 'asymmetric_counterweight',
            firstForkAge: Object.freeze([3, 4]),
            balancedBoost: -0.28,
            firstShareMode: 'strongly_eccentric_continuum',
            firstArity: 2,
            divergence: Object.freeze([0.96, 1.64]),
            referenceVerticalWeight: 0.035,
            dominantSuccessionBoost: 0.26,
            episodeTurn: Object.freeze([0.24, 0.52]),
            spreadScale: 1.3,
            heightScale: 0.94,
            targetSegments: 54,
            targetTips: 10,
            targetGenerationDepth: 6,
            targetDepthSpan: 52,
            horizontalScaffoldRate: 0.58,
            massOffsetScale: 1,
            targetStructuralCost: 88,
            targetOrderZeroForks: 3,
            minimumOrderOneChildren: 2,
            targetScaffoldAttachments: 5,
            targetScaffoldBands: 3,
            targetTerminalLobes: 4,
            targetTerminalRamifications: 2,
            segmentBudget: Object.freeze([42, 52]),
        }),
        weeping_release: Object.freeze({
            label: 'Weeping release',
            description: 'Scaffold axes release laterally, then accumulate sag over later segments.',
            kind: 'weeping_release',
            firstForkAge: Object.freeze([3, 4]),
            balancedBoost: -0.18,
            firstShareMode: 'eccentric_continuum',
            firstArity: 2,
            divergence: Object.freeze([1.16, 1.9]),
            referenceVerticalWeight: 0.025,
            dominantSuccessionBoost: 0.08,
            episodeTurn: Object.freeze([0.2, 0.48]),
            spreadScale: 1.34,
            heightScale: 0.9,
            targetSegments: 52,
            targetTips: 8,
            targetGenerationDepth: 6,
            targetDepthSpan: 58,
            horizontalScaffoldRate: 0.5,
            massOffsetScale: 0.52,
            targetStructuralCost: 88,
            targetOrderZeroForks: 2,
            minimumOrderOneChildren: 1,
            targetScaffoldAttachments: 5,
            targetScaffoldBands: 4,
            targetTerminalLobes: 4,
            targetTerminalRamifications: 2,
            segmentBudget: Object.freeze([34, 44]),
        }),
        terminal_multisplit: Object.freeze({
            label: 'Broom / terminal multi-split',
            description: 'A short bole resolves into three resource-ranked crown primaries.',
            kind: 'terminal_multisplit',
            firstForkAge: Object.freeze([3, 3]),
            balancedBoost: 0.44,
            firstShareMode: 'multisplit_continuum',
            firstArity: 3,
            divergence: Object.freeze([1.36, 2.04]),
            referenceVerticalWeight: 0.045,
            dominantSuccessionBoost: -0.12,
            episodeTurn: Object.freeze([0.18, 0.42]),
            spreadScale: 1.28,
            heightScale: 0.84,
            targetSegments: 68,
            targetTips: 12,
            targetGenerationDepth: 5,
            targetDepthSpan: 50,
            horizontalScaffoldRate: 0.36,
            massOffsetScale: 0.22,
            targetStructuralCost: 96,
            targetOrderZeroForks: 3,
            minimumOrderOneChildren: 1,
            targetScaffoldAttachments: 5,
            targetScaffoldBands: 3,
            targetTerminalLobes: 6,
            targetTerminalRamifications: 3,
            segmentBudget: Object.freeze([40, 50]),
        }),
    });

    const TRAIT_PROGRAMS = Object.freeze({
        balanced_natural: Object.freeze({
            label: 'Balanced natural',
            balancedShift: 0,
            contrastShift: 0,
            releaseShift: 0,
            curvatureShift: 0,
            recommitShift: 0,
            gravityShift: 0,
            ramificationShift: 0,
            areaGainShift: 0,
        }),
        deep_meander: Object.freeze({
            label: 'Deep meander',
            balancedShift: 0.04,
            contrastShift: 0.02,
            releaseShift: -0.02,
            curvatureShift: 0.2,
            recommitShift: 0.16,
            gravityShift: -0.05,
            ramificationShift: -0.06,
            areaGainShift: 0,
        }),
        codominant_forks: Object.freeze({
            label: 'Co-dominant forks',
            balancedShift: 0.24,
            contrastShift: -0.18,
            releaseShift: 0.12,
            curvatureShift: -0.04,
            recommitShift: 0.04,
            gravityShift: -0.02,
            ramificationShift: 0.08,
            areaGainShift: 0.018,
        }),
        weeping_temperament: Object.freeze({
            label: 'Weeping temperament',
            balancedShift: -0.05,
            contrastShift: 0.08,
            releaseShift: 0.18,
            curvatureShift: 0.02,
            recommitShift: -0.02,
            gravityShift: 0.3,
            ramificationShift: 0.02,
            areaGainShift: 0.006,
        }),
        fine_ramification: Object.freeze({
            label: 'Fine ramification',
            balancedShift: 0.08,
            contrastShift: 0.02,
            releaseShift: 0.02,
            curvatureShift: -0.06,
            recommitShift: 0.08,
            gravityShift: 0.02,
            ramificationShift: 0.26,
            areaGainShift: -0.006,
        }),
    });

    const TIERS = Object.freeze([
        Object.freeze({
            name: 'order_0_style_prior',
            meanLength: 42,
            lengthVariation: 0.22,
            maximumAxisSteps: 9,
            forkAge: Object.freeze([3, 5]),
            taper: 0.976,
            minimumRadius: 3.8,
            maximumTurn: 0.23,
            scheduleDelay: 0.86,
            depthVariation: 0.045,
            maintenanceBase: 0.14,
        }),
        Object.freeze({
            name: 'order_1_style_prior',
            meanLength: 42,
            lengthVariation: 0.25,
            maximumAxisSteps: 8,
            forkAge: Object.freeze([3, 5]),
            taper: 0.969,
            minimumRadius: 1.85,
            maximumTurn: 0.29,
            scheduleDelay: 1,
            depthVariation: 0.075,
            maintenanceBase: 0.105,
        }),
        Object.freeze({
            name: 'order_2_plus_style_prior',
            meanLength: 31,
            lengthVariation: 0.28,
            maximumAxisSteps: 6,
            forkAge: Object.freeze([2, 4]),
            taper: 0.956,
            minimumRadius: 0.78,
            maximumTurn: 0.36,
            scheduleDelay: 1.14,
            depthVariation: 0.11,
            maintenanceBase: 0.072,
        }),
    ]);

    const PHENOTYPE_COMBINATION_SIGNAL_IDS = Object.freeze([
        'crown_spread',
        'release_angle',
        'identity_permeability',
        'relay_frequency',
        'relay_magnitude',
        'lateral_initiation',
        'lateral_timing',
        'distal_economy',
    ]);

    function samplePhenotypeCombination(seed, sources) {
        // Keep combination sampling isolated from the graph-growth RNG. Adding
        // or removing an explainable phenotype hypothesis must not reshuffle
        // every later fork and spatial proposal in the same seed.
        const combinationRng = new AxisRng((seed ^ 0x7f4a7c15) >>> 0);
        const independent = Object.freeze(Object.fromEntries(
            PHENOTYPE_COMBINATION_SIGNAL_IDS.map((id) => [
                id,
                rounded(combinationRng.range(-1, 1)),
            ]),
        ));
        const catalog = [
            {
                id: 'spread_to_release_angle',
                source: 'spreadLatent',
                target: 'release_angle',
                coefficient: 0.24,
                hypothesis: 'A broad crown can, but need not, release at a wider angle.',
            },
            {
                id: 'spread_to_identity_permeability',
                source: 'spreadLatent',
                target: 'identity_permeability',
                coefficient: 0.16,
                hypothesis: 'A broad crown can support more than one continuation identity.',
            },
            {
                id: 'motion_to_relay_frequency',
                source: 'motionLatent',
                target: 'relay_frequency',
                coefficient: 0.2,
                hypothesis: 'Directional mobility can increase succession relay opportunities.',
            },
            {
                id: 'gravity_to_relay_magnitude',
                source: 'gravityLatent',
                target: 'relay_magnitude',
                coefficient: 0.18,
                hypothesis: 'Load response can enlarge an already selected relay bend.',
            },
            {
                id: 'tempo_to_lateral_initiation',
                source: 'tempoLatent',
                target: 'lateral_initiation',
                coefficient: 0.2,
                hypothesis: 'Fast developmental tempo can initiate more lateral sites.',
            },
            {
                id: 'tempo_to_lateral_timing',
                source: 'tempoLatent',
                target: 'lateral_timing',
                coefficient: -0.18,
                hypothesis: 'Fast tempo can shift lateral initiation earlier within an axis cycle.',
            },
            {
                id: 'stature_to_distal_economy',
                source: 'statureLatent',
                target: 'distal_economy',
                coefficient: -0.16,
                hypothesis: 'Tall construction can leave less distal economy.',
            },
            {
                id: 'hierarchy_to_identity_permeability',
                source: 'hierarchyLatent',
                target: 'identity_permeability',
                coefficient: -0.14,
                hypothesis: 'Strong hierarchy can reduce co-dominant identity permeability.',
            },
        ];
        for (let index = catalog.length - 1; index > 0; index -= 1) {
            const swapIndex = combinationRng.integer(0, index);
            const candidate = catalog[index];
            catalog[index] = catalog[swapIndex];
            catalog[swapIndex] = candidate;
        }
        const activeCouplingCount = combinationRng.next() < 0.38 ? 3 : 2;
        const contributions = Object.fromEntries(
            PHENOTYPE_COMBINATION_SIGNAL_IDS.map((id) => [id, 0]),
        );
        const activeCouplings = catalog.slice(0, activeCouplingCount).map((coupling) => {
            const gain = combinationRng.range(0.72, 1.08);
            const sourceValue = Number(sources[coupling.source] || 0);
            const contribution = sourceValue * coupling.coefficient * gain;
            contributions[coupling.target] += contribution;
            return Object.freeze({
                ...coupling,
                gain: rounded(gain),
                sourceValue: rounded(sourceValue),
                contribution: rounded(contribution),
            });
        });
        const signals = Object.freeze(Object.fromEntries(
            PHENOTYPE_COMBINATION_SIGNAL_IDS.map((id) => [
                id,
                rounded(clamp(independent[id] + contributions[id], -1, 1)),
            ]),
        ));
        return Object.freeze({
            semantics: 'independent_residuals_plus_one_hop_sparse_couplings_v1',
            independent,
            activeCouplings: Object.freeze(activeCouplings),
            signals,
        });
    }

    function createPhenotype(seed, form, trait, rng) {
        const statureLatent = rng.range(-1, 1);
        const spreadLatent = rng.range(-1, 1);
        const dominanceLatent = rng.range(-1, 1);
        const motionLatent = rng.range(-1, 1);
        const gravityLatent = rng.range(-1, 1);
        const asymmetryLatent = rng.range(-1, 1);
        const tempoLatent = rng.range(-1, 1);
        const hierarchyLatent = rng.range(-1, 1);
        const clusterLatent = rng.range(-1, 1);
        const phenotypeCombination = samplePhenotypeCombination(seed, {
            statureLatent,
            spreadLatent,
            dominanceLatent,
            motionLatent,
            gravityLatent,
            asymmetryLatent,
            tempoLatent,
            hierarchyLatent,
            clusterLatent,
        });
        const combination = phenotypeCombination.signals;
        const balancedForkFrequency = clamp(
            0.55
                - dominanceLatent * 0.16
                + spreadLatent * 0.1
                + form.balancedBoost
                + trait.balancedShift,
            0.08,
            0.96,
        );
        const resourceContrast = clamp(
            0.48
                + dominanceLatent * 0.22
                - balancedForkFrequency * 0.13
                + trait.contrastShift,
            0.04,
            0.92,
        );
        const gravityResponse = clamp(
            0.3 + (gravityLatent + 1) * 0.2 + trait.gravityShift,
            0.08,
            0.94,
        );
        const asymmetry = clamp(
            Math.abs(asymmetryLatent) * 0.72
                + Math.max(0, dominanceLatent) * 0.18,
            0.03,
            0.94,
        );
        return Object.freeze({
            id: `phenotype-${seed}`,
            label: asymmetry > 0.7
                ? 'asymmetric kinetic'
                : (gravityResponse > 0.68
                    ? 'gravity responsive'
                    : (balancedForkFrequency > 0.72
                        ? 'co-dominant spreading'
                        : 'recursive natural')),
            semantics: PHENOTYPE_SEMANTICS,
            combination: phenotypeCombination,
            stature: clamp(1 + statureLatent * 0.19, 0.78, 1.24),
            crownSpread: clamp(
                1 + spreadLatent * 0.21 + combination.crown_spread * 0.09,
                0.7,
                1.34,
            ),
            apicalDominance: clamp(
                0.56 + dominanceLatent * 0.22 - spreadLatent * 0.08,
                0.2,
                0.9,
            ),
            balancedForkFrequency,
            resourceContrast,
            resourceContrastSwing: clamp(
                0.1 + Math.abs(hierarchyLatent) * 0.08 + Math.abs(tempoLatent) * 0.025,
                0.09,
                0.2,
            ),
            resourcePolarity: clamp((hierarchyLatent + 1) * 0.5, 0, 1),
            targetMassOffsetX: clamp(
                asymmetryLatent
                    * (0.05 + asymmetry * 0.12)
                    * form.massOffsetScale,
                -0.18,
                0.18,
            ),
            verticalIntent: clamp(
                0.42 + gravityLatent * 0.1 - spreadLatent * 0.12,
                0.2,
                0.62,
            ),
            dominantAxisPersistence: clamp(
                0.46
                    + motionLatent * 0.14
                    + tempoLatent * 0.08
                    + form.dominantSuccessionBoost,
                0.12,
                0.9,
            ),
            turnSignPersistence: clamp(
                0.42 + motionLatent * 0.16 - tempoLatent * 0.06,
                0.16,
                0.76,
            ),
            releaseAngle: clamp(
                1
                    + spreadLatent * 0.11
                    + combination.release_angle * 0.14
                    + trait.releaseShift,
                0.72,
                1.34,
            ),
            identityPermeability: clamp(
                0.5 + combination.identity_permeability * 0.34,
                0.1,
                0.9,
            ),
            successionKinkPropensity: clamp(
                0.36 + combination.relay_frequency * 0.28,
                0.06,
                0.78,
            ),
            successionKinkMagnitude: clamp(
                0.78 + combination.relay_magnitude * 0.28,
                0.46,
                1.1,
            ),
            lateralInitiationBias: clamp(
                combination.lateral_initiation * 0.5,
                -0.5,
                0.5,
            ),
            lateralTimingBias: clamp(
                combination.lateral_timing * 0.5,
                -0.5,
                0.5,
            ),
            curvaturePersistence: clamp(
                0.72 + (motionLatent + 1) * 0.23 + trait.curvatureShift,
                0.56,
                1.34,
            ),
            episodeRecommitment: clamp(
                0.48 + tempoLatent * 0.18 + trait.recommitShift,
                0.18,
                0.9,
            ),
            gravityResponse,
            sagResponse: clamp(
                gravityResponse * 0.82 + Math.max(0, spreadLatent) * 0.12,
                0.08,
                0.94,
            ),
            recoveryTendency: clamp(
                0.55 - gravityLatent * 0.2 + motionLatent * 0.08,
                0.18,
                0.86,
            ),
            asymmetry,
            asymmetrySign: asymmetryLatent < 0 ? -1 : 1,
            ramificationTempo: clamp(
                0.5 + tempoLatent * 0.2 + trait.ramificationShift,
                0.16,
                0.92,
            ),
            crownSegmentTarget: Math.round(form.targetSegments * clamp(
                1
                    + tempoLatent * 0.045
                    + trait.ramificationShift * 0.08,
                0.9,
                1.1,
            )),
            crownTipTarget: Math.round(form.targetTips * clamp(
                1
                    + tempoLatent * 0.04
                    + trait.ramificationShift * 0.06,
                0.92,
                1.1,
            )),
            crownGenerationDepthTarget: form.targetGenerationDepth,
            crownDepthSpanTarget: form.targetDepthSpan * clamp(
                1 + spreadLatent * 0.08 + Math.abs(asymmetryLatent) * 0.035,
                0.88,
                1.12,
            ),
            horizontalScaffoldRate: clamp(
                form.horizontalScaffoldRate
                    + spreadLatent * 0.08
                    + trait.releaseShift * 0.08,
                0.16,
                0.72,
            ),
            completionBalanceStrength: clamp(
                0.3 + clusterLatent * 0.045 - asymmetry * 0.035,
                0.2,
                0.38,
            ),
            structuralCostTarget: form.targetStructuralCost * clamp(
                1 + tempoLatent * 0.055 + trait.ramificationShift * 0.05,
                0.9,
                1.1,
            ),
            orderZeroForkTarget: form.targetOrderZeroForks,
            minimumOrderOneChildren: form.minimumOrderOneChildren,
            scaffoldAttachmentTarget: Math.max(2, Math.round(
                form.targetScaffoldAttachments * clamp(
                    1 + tempoLatent * 0.05,
                    0.92,
                    1.08,
                ),
            )),
            scaffoldBandTarget: form.targetScaffoldBands,
            terminalLobeTarget: Math.max(3, Math.round(
                form.targetTerminalLobes * clamp(
                    1 + clusterLatent * 0.055,
                    0.92,
                    1.08,
                ),
            )),
            terminalRamificationTarget: form.targetTerminalRamifications,
            axisExtentVariance: clamp(
                0.16 + Math.abs(statureLatent) * 0.08 + Math.abs(tempoLatent) * 0.04,
                0.14,
                0.3,
            ),
            lineageDifferentiation: clamp(
                0.52
                    + Math.abs(hierarchyLatent) * 0.18
                    + Math.abs(asymmetryLatent) * 0.12
                    + Math.abs(tempoLatent) * 0.06,
                0.46,
                0.88,
            ),
            internodeRhythm: clamp(
                0.72 + (motionLatent + 1) * 0.26,
                0.7,
                1.24,
            ),
            lateralEmissionBias: clamp(
                0.5 + tempoLatent * 0.14 + spreadLatent * 0.1,
                0.24,
                0.82,
            ),
            secondaryAxisPersistence: clamp(
                0.52
                    + spreadLatent * 0.18
                    - dominanceLatent * 0.1
                    + tempoLatent * 0.08,
                0.24,
                0.88,
            ),
            // Construction endowment is a specimen-level developmental
            // condition, not a fixed rescue reserve. Its independent mixture
            // with stature, tempo, and spread lets otherwise similar fork
            // programs mature into compact or more extensively built trees.
            constructionEndowment: clamp(
                1.68
                    + tempoLatent * 0.2
                    + spreadLatent * 0.13
                    - statureLatent * 0.08
                    + hierarchyLatent * 0.07,
                1.36,
                2.08,
            ),
            distalAttenuation: clamp(
                0.46
                    + statureLatent * 0.1
                    - spreadLatent * 0.08
                    + tempoLatent * 0.12
                    - combination.distal_economy * 0.08,
                0.24,
                0.76,
            ),
            successionKinkBias: clamp(
                0.16
                    + Math.max(0, motionLatent) * 0.12
                    + tempoLatent * 0.08
                    + Math.abs(hierarchyLatent) * 0.06,
                0.06,
                0.42,
            ),
            attachmentFairness: clamp(
                0.7 + clusterLatent * 0.1 - asymmetry * 0.06,
                0.5,
                0.84,
            ),
            complexityScale: clamp(
                1 + tempoLatent * 0.06 + clusterLatent * 0.02,
                0.92,
                1.08,
            ),
            areaGain: clamp(
                1.035 + spreadLatent * 0.014 + trait.areaGainShift,
                1,
                1.08,
            ),
            corridorForesight: clamp(
                0.58 + tempoLatent * 0.12 + Math.max(0, spreadLatent) * 0.14,
                0.34,
                0.9,
            ),
            spatialReserve: clamp(
                0.54 + spreadLatent * 0.16 - asymmetry * 0.06,
                0.28,
                0.84,
            ),
            resourceConservatism: clamp(
                0.5 + dominanceLatent * 0.12 - tempoLatent * 0.1,
                0.24,
                0.78,
            ),
            depthAffinity: clamp(
                0.42 + Math.abs(asymmetryLatent) * 0.18 + spreadLatent * 0.08,
                0.24,
                0.72,
            ),
            eccentricityExponent: clamp(
                1.42
                    + Math.max(0, dominanceLatent) * 0.48
                    + Math.max(0, hierarchyLatent) * 0.26
                    + trait.contrastShift * 0.32,
                1.18,
                2.16,
            ),
            growthCapacityExponent: clamp(
                1.12 + dominanceLatent * 0.12 + hierarchyLatent * 0.08,
                0.96,
                1.34,
            ),
            biomassHorizonScale: clamp(
                0.9 + statureLatent * 0.08 + tempoLatent * 0.07,
                0.74,
                1.08,
            ),
            terminalClusterTightness: clamp(
                0.62
                    + clusterLatent * 0.17
                    + tempoLatent * 0.08
                    - spreadLatent * 0.06,
                0.34,
                0.9,
            ),
            clusterInheritance: clamp(
                0.78 + clusterLatent * 0.08 + motionLatent * 0.04,
                0.64,
                0.92,
            ),
            tierResourceBias: Object.freeze([
                clamp(0.54 + dominanceLatent * 0.18 + hierarchyLatent * 0.08, 0.3, 0.82),
                clamp(0.5 + dominanceLatent * 0.11 + hierarchyLatent * 0.13, 0.26, 0.78),
                clamp(0.46 + dominanceLatent * 0.06 + hierarchyLatent * 0.16, 0.2, 0.74),
            ]),
            tierClusterBias: Object.freeze([
                clamp(0.14 + clusterLatent * 0.05, 0.05, 0.24),
                clamp(0.58 + clusterLatent * 0.13, 0.34, 0.82),
                clamp(0.8 + clusterLatent * 0.1, 0.6, 0.96),
            ]),
            tierApertureBias: Object.freeze([
                clamp(0.94 + spreadLatent * 0.12, 0.76, 1.14),
                clamp(1.02 + spreadLatent * 0.16, 0.78, 1.24),
                clamp(0.9 + spreadLatent * 0.12 - clusterLatent * 0.08, 0.7, 1.16),
            ]),
        });
    }

    function createRootTemperament(phenotype, rng) {
        const developmentalPhase = rng.range(-0.24, 0.24);
        const lineageResponse = createRootLineageResponse(phenotype, rng);
        return Object.freeze({
            id: 'temperament-root',
            inheritanceWeight: 1,
            lineageResponse,
            lengthScale: clamp(phenotype.stature * rng.range(0.95, 1.05), 0.76, 1.28),
            axisExtentScale: clamp(
                1 + rng.range(-phenotype.axisExtentVariance, phenotype.axisExtentVariance),
                0.76,
                1.28,
            ),
            axisReachScale: clamp(1 + developmentalPhase * 0.08, 0.96, 1.04),
            developmentalPhase,
            forkContrastBias: clamp(
                (phenotype.resourcePolarity - 0.5) * 0.34,
                -0.18,
                0.18,
            ),
            internodeRhythm: clamp(
                phenotype.internodeRhythm * rng.range(0.94, 1.06),
                0.66,
                1.32,
            ),
            forkIntervalScale: clamp(1 + rng.range(-0.16, 0.16), 0.82, 1.18),
            turnScale: clamp(phenotype.curvaturePersistence * rng.range(0.92, 1.08), 0.58, 1.42),
            curvatureMemory: clamp(phenotype.curvaturePersistence, 0.58, 1.36),
            gravitySensitivity: clamp(phenotype.gravityResponse, 0.08, 0.96),
            recommitment: clamp(phenotype.episodeRecommitment, 0.16, 0.94),
            vigorPersistence: clamp(0.84 + phenotype.apicalDominance * 0.12, 0.84, 0.96),
            resourceBias: clamp(
                phenotype.tierResourceBias[0] * 0.82 + rng.range(0.04, 0.16),
                0.24,
                0.9,
            ),
            balanceBias: clamp(
                phenotype.balancedForkFrequency * 0.86 + rng.range(-0.08, 0.08),
                0.04,
                0.96,
            ),
            apertureBias: clamp(
                phenotype.tierApertureBias[0] + rng.range(-0.06, 0.06),
                0.68,
                1.28,
            ),
            dominantAxisPersistence: clamp(
                phenotype.dominantAxisPersistence + rng.range(-0.05, 0.05),
                0.08,
                0.94,
            ),
            identityPermeability: clamp(
                phenotype.identityPermeability + rng.range(-0.045, 0.045),
                0.06,
                0.94,
            ),
            successionKinkResponse: clamp(
                phenotype.successionKinkPropensity + rng.range(-0.045, 0.045),
                0.04,
                0.9,
            ),
            successionKinkMagnitude: clamp(
                phenotype.successionKinkMagnitude * rng.range(0.94, 1.06),
                0.4,
                1.16,
            ),
            turnSignPersistence: clamp(
                phenotype.turnSignPersistence + rng.range(-0.04, 0.04),
                0.12,
                0.82,
            ),
            horizontalScaffoldBias: clamp(
                phenotype.horizontalScaffoldRate + rng.range(-0.045, 0.045),
                0.1,
                0.78,
            ),
            eccentricityExponent: clamp(
                phenotype.eccentricityExponent + rng.range(-0.08, 0.08),
                1.12,
                2.22,
            ),
            clusterCompactness: clamp(
                phenotype.terminalClusterTightness + rng.range(-0.06, 0.06),
                0.28,
                0.94,
            ),
            clusterSlot: rng.range(-0.2, 0.2),
        });
    }

    function inheritTemperament(
        parent,
        phenotype,
        share,
        tier,
        rng,
        id,
        inheritanceContext,
    ) {
        if (
            !inheritanceContext
            || !Number.isInteger(inheritanceContext.arity)
            || inheritanceContext.arity < 2
            || inheritanceContext.arity > 3
            || !Number.isFinite(inheritanceContext.specializationPolarity)
        ) {
            throw new TypeError(
                '[G15.4_MASS] Temperament inheritance requires sibling allocation context.',
            );
        }
        const inheritanceWeight = clamp(
            0.62 + phenotype.curvaturePersistence * 0.13 + rng.range(-0.04, 0.04),
            0.58,
            0.84,
        );
        const meanShare = 1 / inheritanceContext.arity;
        const massDeviation = share >= meanShare
            ? (share - meanShare) / (1 - meanShare)
            : (share - meanShare) / meanShare;
        const amplifiedMassDeviation = Math.sign(massDeviation)
            * Math.abs(massDeviation) ** 0.72;
        const lineageResponse = freezeLineageResponse(
            inheritanceContext.lineageResponse || parent.lineageResponse,
        );
        const developmentalPhase = clamp(
            parent.developmentalPhase * 0.4
                + inheritanceContext.specializationPolarity
                    * phenotype.lineageDifferentiation * 0.46
                + amplifiedMassDeviation * 0.28
                + rng.range(-0.1, 0.1)
                    * (1 - phenotype.lineageDifferentiation * 0.35),
            -1,
            1,
        );
        const axisReachScale = clamp(
            1
                + amplifiedMassDeviation * 0.18
                + developmentalPhase * 0.14
                + (parent.axisReachScale - 1) * 0.3
                + rng.range(-0.03, 0.03),
            0.7,
            1.3,
        );
        const forkContrastBias = clamp(
            parent.forkContrastBias * 0.42
                + developmentalPhase * 0.4
                + rng.range(-0.1, 0.1),
            -0.48,
            0.48,
        );
        const blend = (parentValue, phenotypeValue, variation) => clamp(
            parentValue * inheritanceWeight
                + phenotypeValue * (1 - inheritanceWeight)
                + rng.range(-variation, variation),
            0.48,
            1.48,
        );
        return Object.freeze({
            id,
            inheritanceWeight,
            lineageResponse,
            lengthScale: blend(parent.lengthScale, phenotype.stature, 0.055),
            axisExtentScale: clamp(
                parent.axisExtentScale * inheritanceWeight
                    + (1 + rng.range(
                        -phenotype.axisExtentVariance,
                        phenotype.axisExtentVariance,
                    )) * (1 - inheritanceWeight)
                    + lineageResponse.axis_extent * 0.08,
                0.72,
                1.32,
            ),
            axisReachScale,
            developmentalPhase,
            forkContrastBias,
            internodeRhythm: clamp(
                parent.internodeRhythm * inheritanceWeight
                    + phenotype.internodeRhythm * (1 - inheritanceWeight)
                    + rng.range(-0.05, 0.05),
                0.62,
                1.36,
            ),
            forkIntervalScale: clamp(
                (parent.forkIntervalScale * inheritanceWeight
                    + (1 + rng.range(-0.18, 0.18)) * (1 - inheritanceWeight))
                    * Math.exp(lineageResponse.fork_rhythm * 0.1),
                0.78,
                1.24,
            ),
            turnScale: blend(parent.turnScale, phenotype.curvaturePersistence, 0.06),
            curvatureMemory: blend(
                parent.curvatureMemory,
                phenotype.curvaturePersistence,
                0.05,
            ),
            gravitySensitivity: clamp(
                parent.gravitySensitivity * inheritanceWeight
                    + phenotype.gravityResponse * (1 - inheritanceWeight)
                    + rng.range(-0.035, 0.035),
                0.06,
                0.98,
            ),
            recommitment: clamp(
                parent.recommitment * inheritanceWeight
                    + phenotype.episodeRecommitment * (1 - inheritanceWeight)
                    + rng.range(-0.04, 0.04),
                0.12,
                0.96,
            ),
            vigorPersistence: clamp(
                parent.vigorPersistence * 0.76 + (0.76 + share * 0.34) * 0.24,
                0.78,
                0.98,
            ),
            resourceBias: clamp(
                parent.resourceBias * inheritanceWeight
                    + phenotype.tierResourceBias[0] * (1 - inheritanceWeight)
                    + developmentalPhase * 0.13
                    + rng.range(-0.045, 0.045),
                0.18,
                0.94,
            ),
            balanceBias: clamp(
                parent.balanceBias * inheritanceWeight
                    + phenotype.balancedForkFrequency * (1 - inheritanceWeight)
                    - developmentalPhase * 0.11
                    + rng.range(-0.035, 0.035),
                0.03,
                0.97,
            ),
            apertureBias: clamp(
                parent.apertureBias * inheritanceWeight
                    + phenotype.tierApertureBias[tier] * (1 - inheritanceWeight)
                    + rng.range(-0.045, 0.045),
                0.62,
                1.34,
            ),
            dominantAxisPersistence: clamp(
                parent.dominantAxisPersistence * inheritanceWeight
                    + phenotype.dominantAxisPersistence * (1 - inheritanceWeight)
                    + rng.range(-0.035, 0.035),
                0.06,
                0.96,
            ),
            identityPermeability: clamp(
                Number(parent.identityPermeability ?? phenotype.identityPermeability)
                    * inheritanceWeight
                    + phenotype.identityPermeability * (1 - inheritanceWeight)
                    + lineageResponse.allocation_coupling * 0.045
                    + rng.range(-0.055, 0.055) * (1.06 - inheritanceWeight),
                0.04,
                0.96,
            ),
            successionKinkResponse: clamp(
                Number(parent.successionKinkResponse ?? phenotype.successionKinkPropensity)
                    * inheritanceWeight
                    + phenotype.successionKinkPropensity * (1 - inheritanceWeight)
                    + lineageResponse.curvature_field * 0.055
                    + rng.range(-0.055, 0.055) * (1.06 - inheritanceWeight),
                0.03,
                0.94,
            ),
            successionKinkMagnitude: clamp(
                Number(parent.successionKinkMagnitude ?? phenotype.successionKinkMagnitude)
                    * inheritanceWeight
                    + phenotype.successionKinkMagnitude * (1 - inheritanceWeight)
                    + rng.range(-0.045, 0.045),
                0.38,
                1.18,
            ),
            turnSignPersistence: clamp(
                parent.turnSignPersistence * inheritanceWeight
                    + phenotype.turnSignPersistence * (1 - inheritanceWeight)
                    + rng.range(-0.035, 0.035),
                0.08,
                0.86,
            ),
            horizontalScaffoldBias: clamp(
                parent.horizontalScaffoldBias * inheritanceWeight
                    + phenotype.horizontalScaffoldRate * (1 - inheritanceWeight)
                    + rng.range(-0.035, 0.035),
                0.08,
                0.82,
            ),
            eccentricityExponent: clamp(
                parent.eccentricityExponent * inheritanceWeight
                    + phenotype.eccentricityExponent * (1 - inheritanceWeight)
                    + rng.range(-0.045, 0.045),
                1.08,
                2.24,
            ),
            clusterCompactness: clamp(
                parent.clusterCompactness * phenotype.clusterInheritance
                    + phenotype.terminalClusterTightness
                        * (1 - phenotype.clusterInheritance)
                    + rng.range(-0.035, 0.035),
                0.26,
                0.96,
            ),
            clusterSlot: clamp(
                parent.clusterSlot * inheritanceWeight
                    + developmentalPhase * 0.42
                    + rng.range(-0.34, 0.34) * (1.12 - inheritanceWeight),
                -0.9,
                0.9,
            ),
        });
    }


    scope.ZenBonsaiTypedDevelopmentalSchedulerPrograms = Object.freeze({
        MODEL_ID,
        CONTRACT_ID,
        TIER_NAMES,
        AXIS_ORDER_NAMES,
        axisOrderNameFor,
        AXIS_ORDER_SEMANTICS,
        BIRTH_MODE_SEMANTICS,
        NODE_MERISTEM_SEMANTICS,
        LINEAGE_RESPONSE_SEMANTICS,
        LINEAGE_RESPONSE_KEYS,
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
        resolveCrownRadius,
        resolveRadialDistance,
        rotateGrowthPlane,
        rotateWorldAzimuth,
        directionFromAzimuthElevation,
        directionAzimuth,
        directionElevation,
        tiltDepth,
        angularDistance,
        constrainDirectionToCone,
        resolveOrderZeroSupport,
        stabilizeOrderZeroHeading,
        signedPlanarAngle,
        rounded,
        sum,
        createScaffoldFamilyDominanceClaim,
        inheritScaffoldFamilyDominanceClaim,
        resolveScaffoldFamilyDominance,
        AxisRng,
        PRESETS,
        FORM_PROGRAMS,
        TRAIT_PROGRAMS,
        TIERS,
        createPhenotype,
        createRootTemperament,
        createRootLineageResponse,
        createSiblingLineageResponses,
        createLateralLineageResponse,
        inheritTemperament,
    });
}(globalThis));
