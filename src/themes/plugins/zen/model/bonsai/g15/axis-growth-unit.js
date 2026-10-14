/**
 * Canonical growth-unit lifecycle for G15.4.
 *
 * A frontier is the live tip of one axis. A growth unit is the explicit flush
 * that authorizes that tip to construct internodes. Continuing an axis beyond
 * one completed portfolio therefore requires a new growth unit; it is never a
 * silent extension of the old one. This owner records lifecycle and relative
 * differentiation state only. Construction, cadence, resources, direction,
 * and graph mutation remain with their existing narrow owners.
 */
(function installTypedDevelopmentalGrowthUnit(scope) {
    'use strict';

    const tierArchitecture = scope
        .ZenBonsaiTypedDevelopmentalSchedulerTierArchitecture;
    if (!tierArchitecture) {
        throw new Error(
            '[G15.4_GROWTH_UNIT] Tier architecture owner must load first.',
        );
    }

    const GROWTH_UNIT_SEMANTICS =
        'explicit_apical_growth_unit_lifecycle_v1';
    const GROWTH_UNIT_RECEIPT_SEMANTICS =
        'explicit_apical_growth_unit_receipt_v1';
    const APICAL_DIFFERENTIATION_SEMANTICS =
        'scale_relative_apical_differentiation_state_v1';

    const clamp = (value, minimum, maximum) => Math.max(
        minimum,
        Math.min(maximum, value),
    );

    function finite(value, fallback = 0) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function rounded(value, precision = 8) {
        const power = 10 ** precision;
        const result = Math.round(finite(value) * power) / power;
        return Object.is(result, -0) ? 0 : result;
    }

    function frozenDifferentiation(value, tier, source) {
        if (
            value
            && value.semantics
                === tierArchitecture.RELATIVE_DIFFERENTIATION_SEMANTICS
        ) return Object.freeze({ ...value });
        if (source !== 'root_emergence' || tier !== 0) {
            throw new Error(
                '[G15.4_GROWTH_UNIT] Every non-root growth unit requires canonical relative differentiation.',
            );
        }
        return Object.freeze({
            semantics: tierArchitecture.RELATIVE_DIFFERENTIATION_SEMANTICS,
            tier,
            role: tierArchitecture.tierRoleFor(tier),
            potential: 0.82,
            relativeShare: 1,
            localScale: 1,
            extension: 0.5,
            support: 0.5,
            upperSupport: 0,
            architectureProfile: null,
            absoluteCapacityAuthority: false,
            origin: 'root_seed_state',
        });
    }

    function growthUnitId(spec, ordinal) {
        return `growth-unit:${String(spec.lineageId)}:${ordinal}:${Math.max(
            0,
            Math.round(finite(spec.createdAtSequence)),
        )}`;
    }

    function createGrowthUnit(spec = {}) {
        const tier = tierArchitecture.tierFor(spec.tier ?? spec.axisOrder);
        const portfolio = spec.constructionPortfolio;
        if (!portfolio || !Number.isFinite(Number(portfolio.plannedInternodeCount))) {
            throw new Error(
                '[G15.4_GROWTH_UNIT] A construction portfolio is required.',
            );
        }
        const ordinal = Math.max(0, Math.round(finite(spec.ordinal)));
        const differentiation = frozenDifferentiation(
            spec.relativeDifferentiation
                || spec.developmentState?.relativeDifferentiation,
            tier,
            spec.source,
        );
        const referenceLength = Math.max(
            1,
            finite(
                spec.referenceLength
                    ?? spec.previousInternodeLength
                    ?? 24,
                24,
            ),
        );
        const plannedInternodeCount = Math.max(
            1,
            Math.round(finite(portfolio.plannedInternodeCount, 1)),
        );
        const potential = clamp(finite(differentiation.potential), 0, 1);
        const differentiationThreshold = clamp(
            (tier === 0 ? 1.04 : (tier === 1 ? 0.86 : 0.72))
                - potential * (tier === 2 ? 0.18 : 0.12),
            tier === 0 ? 0.84 : (tier === 1 ? 0.64 : 0.5),
            1.08,
        );
        return Object.freeze({
            semantics: GROWTH_UNIT_SEMANTICS,
            id: growthUnitId(spec, ordinal),
            lineageId: String(spec.lineageId),
            ordinal,
            tier,
            role: tierArchitecture.tierRoleFor(tier),
            source: String(spec.source || 'axis_birth'),
            createdAtSequence: Math.max(
                0,
                Math.round(finite(spec.createdAtSequence)),
            ),
            startAxisAge: Math.max(0, Math.round(finite(spec.startAxisAge))),
            plannedInternodeCount,
            realizedInternodeCount: 0,
            realizedLength: 0,
            referenceLength: rounded(referenceLength),
            relativeDifferentiation: differentiation,
            differentiationCredit: rounded(clamp(
                finite(spec.initialDifferentiationCredit),
                0,
                2.4,
            )),
            differentiationThreshold: rounded(differentiationThreshold),
            pendingApicalIntentId: spec.pendingApicalIntentId || null,
            reservedDescendantConstruction: rounded(Math.max(
                0,
                finite(portfolio.descendantConstructionBudget),
            )),
            endpointFate: spec.endpointFate || 'apical_differentiation_pending',
        });
    }

    function validGrowthUnit(value) {
        return Boolean(
            value
            && value.semantics === GROWTH_UNIT_SEMANTICS
            && typeof value.id === 'string'
            && typeof value.lineageId === 'string'
            && Number.isInteger(value.ordinal)
            && value.ordinal >= 0
            && Number.isInteger(value.tier)
            && value.tier >= 0
            && value.tier <= 2
            && Number.isInteger(value.startAxisAge)
            && value.startAxisAge >= 0
            && Number.isInteger(value.plannedInternodeCount)
            && value.plannedInternodeCount >= 1
            && Number.isInteger(value.realizedInternodeCount)
            && value.realizedInternodeCount >= 0
            && Number.isFinite(value.realizedLength)
            && value.realizedLength >= 0
            && Number.isFinite(value.referenceLength)
            && value.referenceLength > 0
            && Number.isFinite(value.differentiationCredit)
            && value.differentiationCredit >= 0
            && value.differentiationCredit <= 2.4
            && Number.isFinite(value.differentiationThreshold)
            && value.differentiationThreshold > 0
            && Number.isFinite(value.reservedDescendantConstruction)
            && value.reservedDescendantConstruction >= 0
            && value.relativeDifferentiation?.semantics
                === tierArchitecture.RELATIVE_DIFFERENTIATION_SEMANTICS
            && value.relativeDifferentiation.tier === value.tier
            && (
                value.pendingApicalIntentId === null
                || typeof value.pendingApicalIntentId === 'string'
            )
            && typeof value.endpointFate === 'string'
            && value.endpointFate.length > 0
            && (
                !value.pendingApicalIntentId
                || value.endpointFate === 'apical_fork_pending'
            ),
        );
    }

    function requireGrowthUnit(value) {
        if (!validGrowthUnit(value)) {
            throw new Error('[G15.4_GROWTH_UNIT] Invalid canonical growth unit.');
        }
        return value;
    }

    function advanceGrowthUnit(unit, evidence = {}) {
        requireGrowthUnit(unit);
        const length = Math.max(0, finite(evidence.length));
        const potential = clamp(
            finite(unit.relativeDifferentiation?.potential),
            0,
            1,
        );
        const radiusScale = clamp(finite(evidence.radiusScale, 0.5), 0.08, 1.4);
        const lengthProgress = length / Math.max(1, unit.referenceLength);
        const creditGain = lengthProgress
            * (0.18 + potential * 0.34)
            * (0.72 + Math.sqrt(radiusScale) * 0.28);
        const branchCommitted = Boolean(evidence.branchCommitted);
        const creditAfterGrowth = clamp(
            unit.differentiationCredit + creditGain,
            0,
            2.4,
        );
        const pendingIntentSupplied = Object.prototype.hasOwnProperty.call(
            evidence,
            'pendingApicalIntentId',
        );
        const pendingApicalIntentId = pendingIntentSupplied
            ? evidence.pendingApicalIntentId
            : unit.pendingApicalIntentId;
        return Object.freeze({
            ...unit,
            realizedInternodeCount: unit.realizedInternodeCount + 1,
            realizedLength: rounded(unit.realizedLength + length),
            differentiationCredit: rounded(branchCommitted
                ? Math.max(0, creditAfterGrowth - unit.differentiationThreshold)
                : creditAfterGrowth),
            pendingApicalIntentId,
            reservedDescendantConstruction: rounded(Math.max(
                0,
                finite(
                    evidence.reservedDescendantConstruction,
                    unit.reservedDescendantConstruction,
                ),
            )),
            endpointFate: pendingApicalIntentId
                ? 'apical_fork_pending'
                : (unit.endpointFate === 'apical_fork_pending'
                    ? 'apical_differentiation_pending'
                    : unit.endpointFate),
        });
    }

    function bindApicalIntent(unit, intent, reservedConstruction) {
        requireGrowthUnit(unit);
        if (!intent?.id) return unit;
        return Object.freeze({
            ...unit,
            pendingApicalIntentId: intent.id,
            reservedDescendantConstruction: rounded(Math.max(
                unit.reservedDescendantConstruction,
                finite(reservedConstruction),
            )),
            endpointFate: 'apical_fork_pending',
        });
    }

    function renewGrowthUnit(unit, spec = {}) {
        requireGrowthUnit(unit);
        const portfolio = spec.constructionPortfolio;
        const pendingIntentSupplied = Object.prototype.hasOwnProperty.call(
            spec,
            'pendingApicalIntentId',
        );
        const pendingApicalIntentId = pendingIntentSupplied
            ? spec.pendingApicalIntentId
            : unit.pendingApicalIntentId;
        const next = createGrowthUnit({
            ...spec,
            lineageId: unit.lineageId,
            tier: unit.tier,
            ordinal: unit.ordinal + 1,
            source: spec.source || 'explicit_apical_flush_renewal',
            relativeDifferentiation: unit.relativeDifferentiation,
            initialDifferentiationCredit: unit.differentiationCredit,
            pendingApicalIntentId,
            endpointFate: pendingApicalIntentId
                ? 'apical_fork_pending'
                : 'apical_differentiation_pending',
            constructionPortfolio: portfolio,
        });
        return Object.freeze({
            ...next,
            reservedDescendantConstruction: rounded(Math.max(
                next.reservedDescendantConstruction,
                pendingApicalIntentId
                    ? unit.reservedDescendantConstruction
                    : 0,
            )),
        });
    }

    function resolveApicalDifferentiationState(frontier) {
        const unit = requireGrowthUnit(frontier.growthUnit);
        const state = frontier.developmentState || {};
        const portfolio = frontier.constructionPortfolio || {};
        const pending = frontier.pendingForkIntent || null;
        const reservedDescendantConstruction = Math.max(
            unit.reservedDescendantConstruction,
            finite(portfolio.descendantConstructionBudget),
        );
        const resourceReserve = Math.max(0, finite(frontier.resourceReserve));
        const effectiveForkResource = Math.max(
            resourceReserve,
            reservedDescendantConstruction,
        );
        const readiness = clamp(
            Math.max(
                unit.differentiationCredit
                    / Math.max(0.01, unit.differentiationThreshold),
                finite(state.reiterationCredit)
                    / Math.max(0.48, finite(state.reiterationThreshold, 0.68)),
            ),
            0,
            2.4,
        );
        const physicallySupported = Boolean(
            finite(frontier.vigor) >= 0.24
            && effectiveForkResource >= 0.11
            && Math.max(
                finite(frontier.constructionReserve),
                reservedDescendantConstruction,
            ) >= 0.025,
        );
        return Object.freeze({
            semantics: APICAL_DIFFERENTIATION_SEMANTICS,
            growthUnitId: unit.id,
            pendingIntentId: pending?.id || unit.pendingApicalIntentId || null,
            pending: Boolean(pending || unit.pendingApicalIntentId),
            readiness: rounded(readiness),
            ready: Boolean(readiness >= 1),
            resourceReserve: rounded(resourceReserve),
            reservedDescendantConstruction: rounded(
                reservedDescendantConstruction,
            ),
            effectiveForkResource: rounded(effectiveForkResource),
            physicallySupported,
            extensionMaySpendReservedDescendant: false,
            unresolvedApicalIntentMayTerminateSilently: false,
        });
    }

    function createReceipt(unit, phase, sequence, extra = {}) {
        requireGrowthUnit(unit);
        return Object.freeze({
            semantics: GROWTH_UNIT_RECEIPT_SEMANTICS,
            growthUnitId: unit.id,
            lineageId: unit.lineageId,
            ordinal: unit.ordinal,
            tier: unit.tier,
            phase,
            sequence: Math.max(0, Math.round(finite(sequence))),
            plannedInternodeCount: unit.plannedInternodeCount,
            realizedInternodeCount: unit.realizedInternodeCount,
            realizedLength: unit.realizedLength,
            differentiationCredit: unit.differentiationCredit,
            differentiationThreshold: unit.differentiationThreshold,
            pendingApicalIntentId: unit.pendingApicalIntentId,
            reservedDescendantConstruction:
                unit.reservedDescendantConstruction,
            endpointFate: unit.endpointFate,
            ...extra,
        });
    }

    scope.ZenBonsaiTypedDevelopmentalSchedulerGrowthUnit = Object.freeze({
        GROWTH_UNIT_SEMANTICS,
        GROWTH_UNIT_RECEIPT_SEMANTICS,
        APICAL_DIFFERENTIATION_SEMANTICS,
        createGrowthUnit,
        advanceGrowthUnit,
        bindApicalIntent,
        renewGrowthUnit,
        resolveApicalDifferentiationState,
        createReceipt,
        validGrowthUnit,
    });
}(globalThis));
