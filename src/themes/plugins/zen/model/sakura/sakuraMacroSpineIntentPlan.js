import {
    createStructuralPlanIdV1,
} from '../bonsai/generation/structuralPlanIdentityV1';
import {
    SAKURA_MACRO_LINEAGE_IDENTITY_DECIMALS,
    SAKURA_MACRO_LINEAGE_IDENTITY_QUANTUM,
    SAKURA_MACRO_SPINE_SHAPE_ID_NAMESPACE,
} from '../../contracts/SakuraMacroLineageIdentityContract.js';
import { normalizeAngle, shortestAngleDelta } from './sakuraAngleUtils';
import {
    createSakuraArticulatedBendEventV1,
    requireSakuraArticulatedBendEventV1,
    resolveSakuraArticulatedBendTurnDeltaV1,
    SAKURA_ARTICULATED_BEND_KINDS,
} from './sakuraArticulatedBendKernel';
import {
    createSakuraMacroSpineGuideV1,
    fitSakuraMacroSpineGuideC1V1,
    partitionSakuraMacroSpineShapeAtArcRangesV1,
    requireSakuraMacroSpineGuideV1,
    sampleSakuraMacroSpineShapeAtArcNorm,
} from './sakuraMacroSpineGuide';
import { clamp, lerp } from './sakuraMath';
import {
    requireSakuraSingleRootFormTrunkIntentConstraintV1,
} from './sakuraSingleRootFormCompositionAdapter';

export const SAKURA_MACRO_SPINE_INTENT_PLAN_VERSION = 1;
export const SAKURA_MACRO_SPINE_INTENT_PLAN_CONTRACT = (
    'zen_sakura_macro_spine_intent_plan_v1'
);
export const SAKURA_MACRO_SPINE_INTENT_PLANNER_ID = (
    'sakura_macro_spine_intent_bend_aware_v1'
);
export const SAKURA_MACRO_SPINE_INTENT_SHAPE_REPRESENTATION = (
    'bend_aware_role_constrained_piecewise_cubic_v1'
);
export const SAKURA_MACRO_SPINE_INTENT_ROLES = Object.freeze({
    REST: 'rest',
    FLOW: 'flow',
    SWEEP: 'sweep',
    SHOULDER_IN: 'shoulder_in',
    CORE: 'core',
    SHOULDER_OUT: 'shoulder_out',
    FIRST_SHOULDER_IN: 'first_shoulder_in',
    FIRST_CORE: 'first_core',
    FIRST_SHOULDER_OUT: 'first_shoulder_out',
    BRIDGE: 'bridge',
    SECOND_SHOULDER_IN: 'second_shoulder_in',
    SECOND_CORE: 'second_core',
    SECOND_SHOULDER_OUT: 'second_shoulder_out',
});
export const SAKURA_MACRO_SPINE_ACTIVE_LATENT_OWNER_TABLE = Object.freeze({
    trunk_curve_amp: 'bend_rhythm.curve_event_angle',
    trunk_curve_freq: 'bend_rhythm.curve_event_count_and_continuous_cadence',
    backbone_tilt_bias: 'posture.global_turn',
    backbone_sway: 'lateral_sweep.finite_support_turn',
    trunk_kink_prob: 'articulated_event.gate',
    trunk_kink_angle_deg: 'articulated_event.angle',
});

const PLAN_ID_NAMESPACE = 'sakura_macro_spine_intent_plan_v1';
const BEND_RHYTHM_POLICY_ID = 'sakura_nonperiodic_bend_rhythm_v1';
const LATERAL_SWEEP_POLICY_ID = 'sakura_backbone_lateral_sweep_v1';
const BEND_RHYTHM_START_ARC_NORM = 0.18;
const BEND_RHYTHM_END_ARC_NORM = 0.82;
const EPSILON = 1e-8;
const ROLE_SET = new Set(Object.values(SAKURA_MACRO_SPINE_INTENT_ROLES));
const ROLE_FLOW_WEIGHTS = Object.freeze({
    rest: 0.16,
    flow: 1,
    sweep: 0.54,
    shoulder_in: 0.38,
    core: 0.22,
    shoulder_out: 0.38,
    first_shoulder_in: 0.34,
    first_core: 0.2,
    first_shoulder_out: 0.34,
    bridge: 0.08,
    second_shoulder_in: 0.34,
    second_core: 0.2,
    second_shoulder_out: 0.34,
});
const ROLE_HANDLE_RATIOS = Object.freeze({
    rest: 0.36,
    flow: 0.32,
    sweep: 0.3,
    shoulder_in: 0.27,
    core: 0.18,
    shoulder_out: 0.27,
    first_shoulder_in: 0.26,
    first_core: 0.16,
    first_shoulder_out: 0.26,
    bridge: 0.34,
    second_shoulder_in: 0.26,
    second_core: 0.16,
    second_shoulder_out: 0.26,
});

const resolveCircularArcHandleRatio = (turnDeltaRad) => {
    const turn = clamp(Math.abs(Number(turnDeltaRad) || 0), 0, Math.PI);
    if (turn <= EPSILON) return 1 / 3;
    return clamp(
        ((2 / 3) * Math.tan(turn / 4)) / Math.sin(turn / 2),
        0.32,
        0.41,
    );
};

const resolveSpanHandleRatios = (span) => {
    const fallback = ROLE_HANDLE_RATIOS[span.role];
    if (!span.formPostureKind) {
        return { entry: fallback, exit: fallback };
    }
    if (
        span.role === SAKURA_MACRO_SPINE_INTENT_ROLES.CORE
        || span.role === SAKURA_MACRO_SPINE_INTENT_ROLES.FIRST_CORE
        || span.role === SAKURA_MACRO_SPINE_INTENT_ROLES.SECOND_CORE
    ) {
        return { entry: fallback, exit: fallback };
    }
    const circular = resolveCircularArcHandleRatio(span.turnDeltaRad);
    if (span.role === SAKURA_MACRO_SPINE_INTENT_ROLES.BRIDGE) {
        return { entry: 0.36, exit: 0.36 };
    }
    if (span.role.endsWith('shoulder_in')) {
        return {
            entry: clamp(circular * 1.04, 0.32, 0.42),
            exit: clamp(circular * 0.96, 0.32, 0.42),
        };
    }
    if (span.role.endsWith('shoulder_out')) {
        return {
            entry: clamp(circular * 0.96, 0.32, 0.42),
            exit: clamp(circular * 1.04, 0.32, 0.42),
        };
    }
    return { entry: circular, exit: circular };
};

const isObject = (value) => Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value),
);

const requireFiniteNumber = (value, field) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`ZEN_SAKURA_MACRO_SPINE_INTENT_NUMBER_INVALID:${field}`);
    }
    return value;
};

const roundIdentityNumber = (value) => Number(
    Number(value).toFixed(SAKURA_MACRO_LINEAGE_IDENTITY_DECIMALS),
);

const smoothstep01 = (value) => {
    const t = clamp(value, 0, 1);
    return t * t * (3 - (2 * t));
};

const sample = (structuralRandom, decisionType) => {
    if (typeof structuralRandom?.sample !== 'function') {
        throw new Error('ZEN_SAKURA_MACRO_SPINE_INTENT_RANDOM_REQUIRED');
    }
    const value = Number(structuralRandom.sample(decisionType));
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
        throw new Error(`ZEN_SAKURA_MACRO_SPINE_INTENT_RANDOM_INVALID:${decisionType}`);
    }
    return value;
};

const resolveArticulatedKind = ({ style, angleNorm, kindSample }) => {
    const compoundChance = clamp(
        0.06 + (style * 0.18) + (angleNorm * 0.26),
        0.06,
        0.46,
    );
    const sweepChance = clamp(
        0.28 + ((1 - style) * 0.2) + ((1 - angleNorm) * 0.16),
        0.28,
        0.64,
    );
    if (kindSample < compoundChance) return SAKURA_ARTICULATED_BEND_KINDS.COMPOUND;
    if (kindSample < compoundChance + sweepChance) {
        return SAKURA_ARTICULATED_BEND_KINDS.SWEEP;
    }
    return SAKURA_ARTICULATED_BEND_KINDS.KNUCKLE;
};

const resolveEventExtent = ({ kind, angleNorm, lockStrength }) => {
    const base = kind === SAKURA_ARTICULATED_BEND_KINDS.COMPOUND
        ? 0.34
        : (kind === SAKURA_ARTICULATED_BEND_KINDS.KNUCKLE ? 0.24 : 0.3);
    return clamp(
        base + (angleNorm * 0.06) + ((1 - lockStrength) * 0.04),
        0.2,
        0.42,
    );
};

const resolveBendRhythm = ({ trunkGeminiParams, hasKinkEvent }) => {
    const inputFrequency = clamp(Number(trunkGeminiParams?.waveFreq) || 0, 0, 6);
    const normalizedFrequency = inputFrequency / 6;
    const curveEventCount = 1
        + (normalizedFrequency >= 0.34 ? 1 : 0)
        + (normalizedFrequency >= 0.72 ? 1 : 0);
    const cadenceProgress = curveEventCount === 1
        ? clamp(normalizedFrequency / 0.34, 0, 1)
        : curveEventCount === 2
            ? clamp((normalizedFrequency - 0.34) / 0.38, 0, 1)
            : clamp((normalizedFrequency - 0.72) / 0.28, 0, 1);
    const articulatedEventCount = hasKinkEvent ? 1 : 0;
    return Object.freeze({
        version: 1,
        policyId: BEND_RHYTHM_POLICY_ID,
        sourceField: 'trunkGeminiParams.waveFreq',
        inputFrequency,
        normalizedFrequency,
        cadenceProgress,
        curveEventCount,
        articulatedEventCount,
        eventCount: curveEventCount + articulatedEventCount,
    });
};

const createExplicitBendEvents = ({ gene, trunkGeminiParams, structuralRandom }) => {
    const kinkChance = clamp(Number(gene?.trunkKinkChance) || 0, 0, 1);
    const kinkAngleRad = clamp(
        Math.abs(Number(gene?.trunkKinkAngle) || 0),
        0,
        Math.PI * 0.48,
    );
    const style = clamp(Number(gene?.trunkStyle) || 0, 0, 1);
    const lockStrength = clamp(
        Number.isFinite(Number(gene?.trunkBackboneLockStrength))
            ? Number(gene.trunkBackboneLockStrength)
            : 0.62,
        0,
        1,
    );
    const gate = sample(structuralRandom, 'articulated_event_gate');
    const hasKinkEvent = kinkChance > 0 && kinkAngleRad > 0 && gate < kinkChance;
    const rhythm = resolveBendRhythm({ trunkGeminiParams, hasKinkEvent });
    const waveAmpNorm = clamp(
        Math.max(0, Number(trunkGeminiParams?.waveAmp) || 0) / 140,
        0,
        1,
    );
    const slotSpan = (
        BEND_RHYTHM_END_ARC_NORM - BEND_RHYTHM_START_ARC_NORM
    ) / rhythm.eventCount;
    const primaryIndex = Math.min(
        rhythm.eventCount - 1,
        Math.floor(sample(structuralRandom, 'articulated_primary_slot') * rhythm.eventCount),
    );
    const phaseDirection = Math.sign(Math.sin(Number(trunkGeminiParams?.phase) || 0))
        || (sample(structuralRandom, 'bend_rhythm_phase_direction') < 0.5 ? -1 : 1);
    const events = Array.from({ length: rhythm.eventCount }, (_, index) => {
        const isPrimaryKink = hasKinkEvent && index === primaryIndex;
        const angleNorm = kinkAngleRad / (Math.PI * 0.48);
        const kind = isPrimaryKink
            ? resolveArticulatedKind({
                style,
                angleNorm,
                kindSample: sample(structuralRandom, 'articulated_event_kind'),
            })
            : SAKURA_ARTICULATED_BEND_KINDS.SWEEP;
        const slotStart = BEND_RHYTHM_START_ARC_NORM + (slotSpan * index);
        const slotEnd = slotStart + slotSpan;
        const desiredExtent = isPrimaryKink
            ? resolveEventExtent({ kind, angleNorm, lockStrength })
            : slotSpan * (
                0.44
                + (sample(structuralRandom, `bend_rhythm_extent_${index}`) * 0.08)
                + (rhythm.cadenceProgress * 0.04)
            );
        const extentArcNorm = Math.min(slotSpan * 0.56, desiredExtent);
        const centerJitter = (
            sample(structuralRandom, `bend_rhythm_center_${index}`) - 0.5
        ) * slotSpan * 0.04;
        const curveCadenceShift = isPrimaryKink
            ? 0
            : (rhythm.cadenceProgress - 0.5)
                * slotSpan
                * 0.4
                * (index % 2 === 0 ? 1 : -1);
        const centerArcNorm = clamp(
            ((slotStart + slotEnd) / 2) + centerJitter + curveCadenceShift,
            slotStart + (extentArcNorm / 2),
            slotEnd - (extentArcNorm / 2),
        );
        const direction = sample(structuralRandom, `bend_rhythm_direction_${index}`) < 0.64
            ? phaseDirection
            : -phaseDirection;

        if (isPrimaryKink) {
            const angleScale = 0.78 + (sample(structuralRandom, 'articulated_event_scale') * 0.3);
            return createSakuraArticulatedBendEventV1({
                kind,
                centerArcNorm,
                extentArcNorm,
                angleRad: direction * kinkAngleRad * angleScale,
                skew: (sample(structuralRandom, 'articulated_event_skew') - 0.5) * 1.36,
                core: clamp(
                    0.42
                    + (style * 0.16)
                    + (sample(structuralRandom, 'articulated_event_core') * 0.18),
                    0.38,
                    0.78,
                ),
                secondary: 0.38
                    + (sample(structuralRandom, 'articulated_event_secondary') * 0.24),
                bridge: 0.1
                    + (sample(structuralRandom, 'articulated_event_bridge') * 0.14),
            });
        }

        return createSakuraArticulatedBendEventV1({
            kind,
            centerArcNorm,
            extentArcNorm,
            angleRad: direction * waveAmpNorm * (
                0.48 + (sample(structuralRandom, `bend_rhythm_angle_${index}`) * 0.24)
            ),
            skew: (sample(structuralRandom, `bend_rhythm_skew_${index}`) - 0.5) * 0.9,
            core: 0.5,
            secondary: 0.5,
            bridge: 0.16,
        });
    });
    return Object.freeze({ rhythm, events: Object.freeze(events) });
};

const createLateralSweep = ({ gene, structuralRandom }) => {
    const inputAmplitude = clamp(Number(gene?.trunkBackboneAmp) || 1, 0.4, 1.8);
    const normalizedAmplitude = clamp((inputAmplitude - 0.72) / 0.88, 0, 1);
    const extentArcNorm = 0.34
        + (sample(structuralRandom, 'lateral_sweep_extent') * 0.12);
    const centerArcNorm = clamp(
        0.43 + ((sample(structuralRandom, 'lateral_sweep_center') - 0.5) * 0.16),
        0.16 + (extentArcNorm / 2),
        0.84 - (extentArcNorm / 2),
    );
    const direction = sample(structuralRandom, 'lateral_sweep_direction') < 0.5 ? -1 : 1;
    return Object.freeze({
        version: 1,
        policyId: LATERAL_SWEEP_POLICY_ID,
        sourceField: 'gene.trunkBackboneAmp',
        inputAmplitude,
        normalizedAmplitude,
        supportStartArcNorm: centerArcNorm - (extentArcNorm / 2),
        supportEndArcNorm: centerArcNorm + (extentArcNorm / 2),
        angleRad: direction * normalizedAmplitude * 0.42,
    });
};

const resolveLateralSweepTurnDelta = ({ lateralSweep, startArcNorm, endArcNorm }) => {
    const supportSpan = Math.max(
        EPSILON,
        lateralSweep.supportEndArcNorm - lateralSweep.supportStartArcNorm,
    );
    const progressAt = (arcNorm) => smoothstep01(
        (arcNorm - lateralSweep.supportStartArcNorm) / supportSpan,
    );
    return lateralSweep.angleRad * (
        progressAt(endArcNorm) - progressAt(startArcNorm)
    );
};

const resolveBaseFlowTurn = ({ gene }) => {
    const tilt = clamp(Number(gene?.trunkBackboneTiltBias) || 0, -1, 1);
    const cascade = clamp((Math.abs(tilt) - 0.5) / 0.5, 0, 1);
    return tilt * lerp(0.42, 3.6, cascade);
};

const createFormPostureEvent = ({ constraint, angleRad }) => {
    if (constraint === null) return null;
    if (Math.abs(angleRad) > Math.PI + EPSILON) {
        throw new Error('ZEN_SAKURA_FORM_POSTURE_EVENT_ANGLE_UNREPRESENTABLE');
    }
    return createSakuraArticulatedBendEventV1({
        kind: constraint.postureEventKind,
        centerArcNorm: constraint.postureEventCenterArcNorm,
        extentArcNorm: constraint.postureEventExtentArcNorm,
        angleRad,
        skew: constraint.postureEventSkew,
        core: constraint.postureEventCore,
        secondary: constraint.postureEventSecondary,
        bridge: constraint.postureEventBridge,
    });
};

const createSpanSpecs = ({ events, lateralSweep, formPostureEvent }) => {
    const boundaries = [
        0,
        0.16,
        lateralSweep.supportStartArcNorm,
        lateralSweep.supportEndArcNorm,
        0.84,
        1,
    ];
    events.forEach((event) => {
        event.zones.forEach((zone) => {
            boundaries.push(zone.startArcNorm, zone.endArcNorm);
        });
    });
    formPostureEvent?.zones.forEach((zone) => {
        boundaries.push(zone.startArcNorm, zone.endArcNorm);
    });
    const ordered = boundaries
        .sort((left, right) => left - right)
        .filter((value, index, values) => (
            index === 0
            || Math.abs(value - values[index - 1])
                > SAKURA_MACRO_LINEAGE_IDENTITY_QUANTUM
        ));
    return ordered.slice(0, -1).map((startArcNorm, index) => {
        const endArcNorm = ordered[index + 1];
        const midpoint = (startArcNorm + endArcNorm) / 2;
        const eventMatch = events.map((event, eventIndex) => ({ event, eventIndex }))
            .find(({ event }) => event.zones.some((candidate) => (
                midpoint >= candidate.startArcNorm - EPSILON
                && midpoint <= candidate.endArcNorm + EPSILON
            ))) || null;
        const eventZoneIndex = eventMatch?.event.zones.findIndex((candidate) => (
            midpoint >= candidate.startArcNorm - EPSILON
            && midpoint <= candidate.endArcNorm + EPSILON
        )) ?? -1;
        const zone = eventZoneIndex >= 0
            ? eventMatch.event.zones[eventZoneIndex]
            : null;
        const formPostureZoneIndex = formPostureEvent?.zones.findIndex((candidate) => (
            midpoint >= candidate.startArcNorm - EPSILON
            && midpoint <= candidate.endArcNorm + EPSILON
        )) ?? -1;
        const formPostureZone = formPostureZoneIndex >= 0
            ? formPostureEvent.zones[formPostureZoneIndex]
            : null;
        const role = formPostureZone?.role || zone?.role || (
            endArcNorm <= 0.16 + EPSILON || startArcNorm >= 0.84 - EPSILON
                ? SAKURA_MACRO_SPINE_INTENT_ROLES.REST
                : SAKURA_MACRO_SPINE_INTENT_ROLES.FLOW
        );
        return {
            index,
            role,
            eventIndex: zone ? eventMatch.eventIndex : null,
            eventKind: zone ? eventMatch.event.kind : null,
            eventZoneIndex: zone ? eventZoneIndex : null,
            formPostureKind: formPostureZone ? formPostureEvent.kind : null,
            formPostureZoneIndex: formPostureZone ? formPostureZoneIndex : null,
            startArcNorm,
            endArcNorm,
            eventTurnDeltaRad: zone
                ? (formPostureEvent
                    ? resolveSakuraArticulatedBendTurnDeltaV1({
                        event: eventMatch.event,
                        arcStartNorm: startArcNorm,
                        arcEndNorm: endArcNorm,
                    })
                    : zone.angleRad)
                : 0,
            formPostureTurnDeltaRad: formPostureZone
                ? resolveSakuraArticulatedBendTurnDeltaV1({
                    event: formPostureEvent,
                    arcStartNorm: startArcNorm,
                    arcEndNorm: endArcNorm,
                })
                : 0,
            lateralSweepTurnDeltaRad: resolveLateralSweepTurnDelta({
                lateralSweep,
                startArcNorm,
                endArcNorm,
            }),
        };
    }).filter((span) => (
        span.endArcNorm - span.startArcNorm
        > SAKURA_MACRO_LINEAGE_IDENTITY_QUANTUM
    ));
};

const createPlanId = ({
    source,
    rootHeadingRad,
    totalArcNorm,
    rhythm,
    lateralSweep,
    formPostureEvent,
    spans,
    conditioning,
    formTrunkIntentConstraint,
}) => (
    createStructuralPlanIdV1(PLAN_ID_NAMESPACE, [
        SAKURA_MACRO_SPINE_INTENT_PLAN_VERSION,
        source,
        conditioning?.guideId || 'unconditioned',
        roundIdentityNumber(conditioning?.adherence || 0),
        formTrunkIntentConstraint?.contract || 'latent_posture',
        formTrunkIntentConstraint?.policyId || 'latent_posture',
        formTrunkIntentConstraint?.formCompositionPlanId || 'none',
        formTrunkIntentConstraint?.formId || 'none',
        formTrunkIntentConstraint?.posture || 'none',
        roundIdentityNumber(formTrunkIntentConstraint?.targetTotalTurnRad || 0),
        roundIdentityNumber(formTrunkIntentConstraint?.residualTotalTurnRad || 0),
        roundIdentityNumber(formTrunkIntentConstraint?.effectiveTotalTurnRad || 0),
        formPostureEvent?.kind || 'none',
        roundIdentityNumber(formPostureEvent?.centerArcNorm || 0),
        roundIdentityNumber(formPostureEvent?.extentArcNorm || 0),
        roundIdentityNumber(formPostureEvent?.angleRad || 0),
        roundIdentityNumber(rootHeadingRad),
        roundIdentityNumber(totalArcNorm),
        rhythm.policyId,
        roundIdentityNumber(rhythm.inputFrequency),
        rhythm.eventCount,
        lateralSweep.policyId,
        roundIdentityNumber(lateralSweep.inputAmplitude),
        roundIdentityNumber(lateralSweep.supportStartArcNorm),
        roundIdentityNumber(lateralSweep.supportEndArcNorm),
        roundIdentityNumber(lateralSweep.angleRad),
        ...spans.flatMap((span) => [
            span.index,
            span.role,
            span.eventIndex ?? -1,
            span.eventKind || 'none',
            span.eventZoneIndex ?? -1,
            span.formPostureKind || 'none',
            span.formPostureZoneIndex ?? -1,
            roundIdentityNumber(span.startArcNorm),
            roundIdentityNumber(span.endArcNorm),
            roundIdentityNumber(span.start.x),
            roundIdentityNumber(span.start.y),
            roundIdentityNumber(span.end.x),
            roundIdentityNumber(span.end.y),
            roundIdentityNumber(span.entryHeadingRad),
            roundIdentityNumber(span.exitHeadingRad),
        ]),
    ])
);

const freezePlan = ({
    source,
    rootHeadingRad,
    totalArcNorm,
    rhythm,
    lateralSweep,
    formPostureEvent = null,
    events,
    spans,
    conditioning = null,
    conditioningGuide = null,
    formTrunkIntentConstraint = null,
}) => {
    const resolvedFormTrunkIntentConstraint = formTrunkIntentConstraint === null
        ? null
        : requireSakuraSingleRootFormTrunkIntentConstraintV1(formTrunkIntentConstraint);
    const resolvedFormPostureEvent = formPostureEvent === null
        ? null
        : requireSakuraArticulatedBendEventV1(formPostureEvent);
    const frozenSpans = Object.freeze(spans.map((span, index) => Object.freeze({
        ...span,
        index,
        start: Object.freeze({ ...span.start }),
        end: Object.freeze({ ...span.end }),
    })));
    const planId = createPlanId({
        source,
        rootHeadingRad,
        totalArcNorm,
        rhythm,
        lateralSweep,
        formPostureEvent: resolvedFormPostureEvent,
        spans: frozenSpans,
        conditioning,
        formTrunkIntentConstraint: resolvedFormTrunkIntentConstraint,
    });
    return Object.freeze({
        version: SAKURA_MACRO_SPINE_INTENT_PLAN_VERSION,
        contract: SAKURA_MACRO_SPINE_INTENT_PLAN_CONTRACT,
        plannerId: SAKURA_MACRO_SPINE_INTENT_PLANNER_ID,
        coordinateSpace: 'root_local_target_height_y_down_v1',
        planId,
        source,
        rootHeadingRad,
        totalArcNorm,
        rhythm,
        lateralSweep,
        formPostureEvent: resolvedFormPostureEvent,
        conditioning: conditioning ? Object.freeze({ ...conditioning }) : null,
        conditioningGuide,
        formTrunkIntentConstraint: resolvedFormTrunkIntentConstraint,
        events: Object.freeze(events.map((event) => requireSakuraArticulatedBendEventV1(event))),
        spans: frozenSpans,
    });
};

export const createSakuraMacroSpineIntentPlanV1 = ({
    gene,
    trunkGeminiParams,
    rootHeadingRad,
    structuralRandom,
    formTrunkIntentConstraint = null,
} = {}) => {
    if (!isObject(gene)) throw new Error('ZEN_SAKURA_MACRO_SPINE_INTENT_GENE_REQUIRED');
    if (!isObject(trunkGeminiParams)) {
        throw new Error('ZEN_SAKURA_MACRO_SPINE_INTENT_GEMINI_PARAMS_REQUIRED');
    }
    const resolvedFormTrunkIntentConstraint = formTrunkIntentConstraint === null
        ? null
        : requireSakuraSingleRootFormTrunkIntentConstraintV1(formTrunkIntentConstraint);
    const rootHeading = requireFiniteNumber(rootHeadingRad, 'rootHeadingRad');
    const bendPlan = createExplicitBendEvents({ gene, trunkGeminiParams, structuralRandom });
    const lateralSweep = createLateralSweep({ gene, structuralRandom });
    const localIntentTurn = bendPlan.events.reduce((sum, event) => (
        sum + event.angleRad
    ), lateralSweep.angleRad);
    const formPostureEvent = resolvedFormTrunkIntentConstraint
        ? createFormPostureEvent({
            constraint: resolvedFormTrunkIntentConstraint,
            angleRad: resolvedFormTrunkIntentConstraint.effectiveTotalTurnRad
                - localIntentTurn,
        })
        : null;
    const spanSpecs = createSpanSpecs({
        events: bendPlan.events,
        lateralSweep,
        formPostureEvent,
    });
    const baseFlowTurn = resolvedFormTrunkIntentConstraint
        ? 0
        : resolveBaseFlowTurn({ gene });
    const tilt = clamp(Math.abs(Number(gene?.trunkBackboneTiltBias) || 0), 0, 1);
    const cascade = clamp((tilt - 0.5) / 0.5, 0, 1);
    const resolveFlowWeight = (span) => {
        const arcShare = span.endArcNorm - span.startArcNorm;
        const midpoint = (span.startArcNorm + span.endArcNorm) / 2;
        const earlyCascadeWeight = 1 + (cascade * 4.2 * ((1 - midpoint) ** 2));
        return arcShare * ROLE_FLOW_WEIGHTS[span.role] * earlyCascadeWeight;
    };
    const weightedArcTotal = spanSpecs.reduce((sum, span) => (
        sum + resolveFlowWeight(span)
    ), 0);
    const totalArcNorm = lerp(0.94, 1.12, clamp((tilt - 0.58) / 0.42, 0, 1));
    let heading = normalizeAngle(rootHeading);
    let point = { x: 0, y: 0 };
    const spans = spanSpecs.map((span) => {
        const arcShare = span.endArcNorm - span.startArcNorm;
        const baseTurnShare = baseFlowTurn
            * (resolveFlowWeight(span) / Math.max(EPSILON, weightedArcTotal));
        const turnDeltaRad = baseTurnShare
            + span.eventTurnDeltaRad
            + span.formPostureTurnDeltaRad
            + span.lateralSweepTurnDeltaRad;
        const entryHeadingRad = heading;
        const exitHeadingRad = normalizeAngle(entryHeadingRad + turnDeltaRad);
        const chordHeading = normalizeAngle(entryHeadingRad + (turnDeltaRad * 0.5));
        const chordLength = totalArcNorm * arcShare;
        const end = {
            x: point.x + (Math.cos(chordHeading) * chordLength),
            y: point.y + (Math.sin(chordHeading) * chordLength),
        };
        const resolved = {
            ...span,
            start: point,
            end,
            entryHeadingRad,
            exitHeadingRad,
            turnDeltaRad,
        };
        point = end;
        heading = exitHeadingRad;
        return resolved;
    });
    return freezePlan({
        source: 'procedural',
        rootHeadingRad: rootHeading,
        totalArcNorm,
        rhythm: bendPlan.rhythm,
        lateralSweep,
        formPostureEvent,
        events: bendPlan.events,
        spans,
        formTrunkIntentConstraint: resolvedFormTrunkIntentConstraint,
    });
};

export const requireSakuraMacroSpineIntentPlanV1 = (plan) => {
    if (!isObject(plan)) throw new Error('ZEN_SAKURA_MACRO_SPINE_INTENT_PLAN_REQUIRED');
    if (
        plan.version !== SAKURA_MACRO_SPINE_INTENT_PLAN_VERSION
        || plan.contract !== SAKURA_MACRO_SPINE_INTENT_PLAN_CONTRACT
        || plan.plannerId !== SAKURA_MACRO_SPINE_INTENT_PLANNER_ID
    ) {
        throw new Error('ZEN_SAKURA_MACRO_SPINE_INTENT_PLAN_CONTRACT_INVALID');
    }
    if (!Array.isArray(plan.spans) || plan.spans.length < 3) {
        throw new Error('ZEN_SAKURA_MACRO_SPINE_INTENT_SPANS_INVALID');
    }
    if (!Array.isArray(plan.events)) {
        throw new Error('ZEN_SAKURA_MACRO_SPINE_INTENT_EVENTS_INVALID');
    }
    if (plan.formTrunkIntentConstraint !== null) {
        requireSakuraSingleRootFormTrunkIntentConstraintV1(
            plan.formTrunkIntentConstraint,
        );
        const postureEvent = requireSakuraArticulatedBendEventV1(
            plan.formPostureEvent,
        );
        const canonicalPostureEvent = createFormPostureEvent({
            constraint: plan.formTrunkIntentConstraint,
            angleRad: postureEvent.angleRad,
        });
        const localIntentTurn = plan.events.reduce((sum, event) => (
            sum + event.angleRad
        ), plan.lateralSweep.angleRad);
        if (
            JSON.stringify(postureEvent) !== JSON.stringify(canonicalPostureEvent)
            || Math.abs(
                postureEvent.angleRad
                + localIntentTurn
                - plan.formTrunkIntentConstraint.effectiveTotalTurnRad
            ) > EPSILON
        ) {
            throw new Error('ZEN_SAKURA_MACRO_SPINE_FORM_POSTURE_EVENT_INVALID');
        }
    } else if (plan.formPostureEvent !== null) {
        throw new Error('ZEN_SAKURA_MACRO_SPINE_FORM_POSTURE_EVENT_UNOWNED');
    }
    if (plan.conditioning === null) {
        if (plan.conditioningGuide !== null) {
            throw new Error('ZEN_SAKURA_MACRO_SPINE_INTENT_CONDITIONING_GUIDE_INVALID');
        }
    } else {
        const conditioningGuide = requireSakuraMacroSpineGuideV1(plan.conditioningGuide);
        if (
            conditioningGuide.guideId !== plan.conditioning.guideId
            || conditioningGuide.adherence !== plan.conditioning.adherence
        ) {
            throw new Error('ZEN_SAKURA_MACRO_SPINE_INTENT_CONDITIONING_GUIDE_INVALID');
        }
    }
    if (
        !isObject(plan.rhythm)
        || plan.rhythm.version !== 1
        || plan.rhythm.policyId !== BEND_RHYTHM_POLICY_ID
        || plan.rhythm.sourceField !== 'trunkGeminiParams.waveFreq'
        || !Number.isFinite(plan.rhythm.inputFrequency)
        || !Number.isFinite(plan.rhythm.normalizedFrequency)
        || Math.abs(
            plan.rhythm.normalizedFrequency - (plan.rhythm.inputFrequency / 6)
        ) > EPSILON
        || !Number.isFinite(plan.rhythm.cadenceProgress)
        || plan.rhythm.cadenceProgress < 0
        || plan.rhythm.cadenceProgress > 1
        || !Number.isSafeInteger(plan.rhythm.curveEventCount)
        || plan.rhythm.curveEventCount < 0
        || plan.rhythm.curveEventCount > 3
        || !Number.isSafeInteger(plan.rhythm.articulatedEventCount)
        || plan.rhythm.articulatedEventCount < 0
        || plan.rhythm.articulatedEventCount > 1
        || !Number.isSafeInteger(plan.rhythm.eventCount)
        || plan.rhythm.eventCount !== (
            plan.rhythm.curveEventCount + plan.rhythm.articulatedEventCount
        )
        || plan.rhythm.eventCount !== plan.events.length
    ) {
        throw new Error('ZEN_SAKURA_MACRO_SPINE_INTENT_RHYTHM_INVALID');
    }
    if (
        !isObject(plan.lateralSweep)
        || plan.lateralSweep.version !== 1
        || plan.lateralSweep.policyId !== LATERAL_SWEEP_POLICY_ID
        || plan.lateralSweep.sourceField !== 'gene.trunkBackboneAmp'
        || !Number.isFinite(plan.lateralSweep.inputAmplitude)
        || !Number.isFinite(plan.lateralSweep.normalizedAmplitude)
        || !Number.isFinite(plan.lateralSweep.supportStartArcNorm)
        || !Number.isFinite(plan.lateralSweep.supportEndArcNorm)
        || plan.lateralSweep.supportStartArcNorm < 0
        || plan.lateralSweep.supportEndArcNorm > 1
        || plan.lateralSweep.supportEndArcNorm
            <= plan.lateralSweep.supportStartArcNorm
        || !Number.isFinite(plan.lateralSweep.angleRad)
    ) {
        throw new Error('ZEN_SAKURA_MACRO_SPINE_INTENT_LATERAL_SWEEP_INVALID');
    }
    plan.events.forEach(requireSakuraArticulatedBendEventV1);
    plan.events.forEach((event, index) => {
        if (
            index > 0
            && event.supportStartArcNorm < plan.events[index - 1].supportEndArcNorm - EPSILON
        ) {
            throw new Error(`ZEN_SAKURA_MACRO_SPINE_INTENT_EVENT_OVERLAP:${index}`);
        }
    });
    plan.spans.forEach((span, index) => {
        if (
            span?.index !== index
            || !ROLE_SET.has(span?.role)
            || !Number.isFinite(span?.startArcNorm)
            || !Number.isFinite(span?.endArcNorm)
            || span.endArcNorm <= span.startArcNorm
            || (index === 0 && Math.abs(span.startArcNorm) > EPSILON)
            || (index > 0 && Math.abs(span.startArcNorm - plan.spans[index - 1].endArcNorm) > EPSILON)
            || !Number.isFinite(span?.start?.x)
            || !Number.isFinite(span?.start?.y)
            || !Number.isFinite(span?.end?.x)
            || !Number.isFinite(span?.end?.y)
            || !Number.isFinite(span?.entryHeadingRad)
            || !Number.isFinite(span?.exitHeadingRad)
            || !Number.isFinite(span?.turnDeltaRad)
            || !Number.isFinite(span?.eventTurnDeltaRad)
            || !Number.isFinite(span?.formPostureTurnDeltaRad)
            || !Number.isFinite(span?.lateralSweepTurnDeltaRad)
        ) {
            throw new Error(`ZEN_SAKURA_MACRO_SPINE_INTENT_SPAN_INVALID:${index}`);
        }
        if (span.eventIndex !== null) {
            const event = plan.events[span.eventIndex];
            const zone = event?.zones?.[span.eventZoneIndex];
            if (
                !Number.isSafeInteger(span.eventIndex)
                || !Number.isSafeInteger(span.eventZoneIndex)
                || span.eventKind !== event?.kind
                || (
                    span.formPostureZoneIndex === null
                    && span.role !== zone?.role
                )
                || span.startArcNorm
                    < zone.startArcNorm - SAKURA_MACRO_LINEAGE_IDENTITY_QUANTUM
                || span.endArcNorm
                    > zone.endArcNorm + SAKURA_MACRO_LINEAGE_IDENTITY_QUANTUM
            ) {
                throw new Error(`ZEN_SAKURA_MACRO_SPINE_INTENT_EVENT_SPAN_INVALID:${index}`);
            }
        } else if (span.eventKind !== null || span.eventZoneIndex !== null) {
            throw new Error(`ZEN_SAKURA_MACRO_SPINE_INTENT_EVENT_SPAN_INVALID:${index}`);
        }
        if (span.formPostureZoneIndex !== null) {
            const zone = plan.formPostureEvent?.zones?.[span.formPostureZoneIndex];
            if (
                !Number.isSafeInteger(span.formPostureZoneIndex)
                || span.formPostureKind !== plan.formPostureEvent?.kind
                || span.role !== zone?.role
                || span.startArcNorm
                    < zone.startArcNorm - SAKURA_MACRO_LINEAGE_IDENTITY_QUANTUM
                || span.endArcNorm
                    > zone.endArcNorm + SAKURA_MACRO_LINEAGE_IDENTITY_QUANTUM
            ) {
                throw new Error(
                    `ZEN_SAKURA_MACRO_SPINE_FORM_POSTURE_SPAN_INVALID:${index}`,
                );
            }
        } else if (span.formPostureKind !== null) {
            throw new Error(`ZEN_SAKURA_MACRO_SPINE_FORM_POSTURE_SPAN_INVALID:${index}`);
        }
        if (index > 0) {
            const previous = plan.spans[index - 1];
            if (
                Math.abs(span.start.x - previous.end.x) > EPSILON
                || Math.abs(span.start.y - previous.end.y) > EPSILON
                || Math.abs(shortestAngleDelta(previous.exitHeadingRad, span.entryHeadingRad)) > EPSILON
            ) {
                throw new Error(`ZEN_SAKURA_MACRO_SPINE_INTENT_CONTINUITY_INVALID:${index}`);
            }
        }
    });
    if (Math.abs(plan.spans.at(-1).endArcNorm - 1) > EPSILON) {
        throw new Error('ZEN_SAKURA_MACRO_SPINE_INTENT_ARC_INCOMPLETE');
    }
    if (
        plan.source === 'procedural'
        && plan.formTrunkIntentConstraint !== null
        && Math.abs(
            plan.spans.reduce((sum, span) => sum + span.turnDeltaRad, 0)
            - plan.formTrunkIntentConstraint.effectiveTotalTurnRad
        ) > EPSILON
    ) {
        throw new Error('ZEN_SAKURA_MACRO_SPINE_FORM_TOTAL_TURN_INVALID');
    }
    const expectedPlanId = createPlanId(plan);
    if (plan.planId !== expectedPlanId) {
        throw new Error('ZEN_SAKURA_MACRO_SPINE_INTENT_PLAN_ID_INVALID');
    }
    return plan;
};

export const conditionSakuraMacroSpineIntentPlanV1 = ({ plan, guide } = {}) => {
    const resolvedPlan = requireSakuraMacroSpineIntentPlanV1(plan);
    const resolvedGuide = requireSakuraMacroSpineGuideV1(guide);
    const adherence = resolvedGuide.adherence;
    if (adherence <= 0) return resolvedPlan;
    const guideShape = fitSakuraMacroSpineGuideC1V1(resolvedGuide);
    const stationArcs = [
        resolvedPlan.spans[0].startArcNorm,
        ...resolvedPlan.spans.map((span) => span.endArcNorm),
    ];
    const originalPoints = [
        resolvedPlan.spans[0].start,
        ...resolvedPlan.spans.map((span) => span.end),
    ];
    const originalHeadings = [
        resolvedPlan.spans[0].entryHeadingRad,
        ...resolvedPlan.spans.map((span) => span.exitHeadingRad),
    ];
    const stations = stationArcs.map((arcNorm, index) => {
        const reference = sampleSakuraMacroSpineShapeAtArcNorm(guideShape, arcNorm);
        const point = {
            x: lerp(originalPoints[index].x, reference.x, adherence),
            y: lerp(originalPoints[index].y, reference.y, adherence),
        };
        if (index === 0) {
            point.x = 0;
            point.y = 0;
        }
        return {
            point,
            heading: normalizeAngle(
                originalHeadings[index]
                + (shortestAngleDelta(originalHeadings[index], reference.angle) * adherence),
            ),
        };
    });
    const spans = resolvedPlan.spans.map((span, index) => ({
        ...span,
        start: stations[index].point,
        end: stations[index + 1].point,
        entryHeadingRad: stations[index].heading,
        exitHeadingRad: stations[index + 1].heading,
        turnDeltaRad: shortestAngleDelta(stations[index].heading, stations[index + 1].heading),
    }));
    return freezePlan({
        source: 'conditioned',
        rootHeadingRad: stations[0].heading,
        totalArcNorm: resolvedPlan.totalArcNorm,
        rhythm: resolvedPlan.rhythm,
        lateralSweep: resolvedPlan.lateralSweep,
        formPostureEvent: resolvedPlan.formPostureEvent,
        events: resolvedPlan.events,
        spans,
        conditioning: {
            guideId: resolvedGuide.guideId,
            adherence,
        },
        conditioningGuide: resolvedGuide,
        formTrunkIntentConstraint: resolvedPlan.formTrunkIntentConstraint,
    });
};

export const createSakuraMacroSpineIntentDiagnosticGuideV1 = (plan) => {
    const resolved = requireSakuraMacroSpineIntentPlanV1(plan);
    if (resolved.conditioning?.adherence === 1) {
        return resolved.conditioningGuide;
    }
    const anchorCount = Math.min(7, Math.max(3, resolved.spans.length));
    const selected = Array.from({ length: anchorCount }, (_, index) => {
        const arcNorm = index / (anchorCount - 1);
        const span = resolved.spans.find((candidate) => (
            arcNorm <= candidate.endArcNorm + EPSILON
        )) || resolved.spans.at(-1);
        const localT = clamp(
            (arcNorm - span.startArcNorm)
                / Math.max(EPSILON, span.endArcNorm - span.startArcNorm),
            0,
            1,
        );
        return {
            x: lerp(span.start.x, span.end.x, localT),
            y: lerp(span.start.y, span.end.y, localT),
        };
    });
    return createSakuraMacroSpineGuideV1({
        anchors: selected,
        adherence: resolved.conditioning?.adherence || 0,
        source: resolved.source === 'conditioned' ? 'blended' : 'procedural',
    });
};

const createIntentShapeId = (plan, segments) => createStructuralPlanIdV1(
    SAKURA_MACRO_SPINE_SHAPE_ID_NAMESPACE,
    [
        SAKURA_MACRO_SPINE_INTENT_SHAPE_REPRESENTATION,
        plan.planId,
        ...segments.flatMap((segment) => [
            segment.intentRole,
            segment.intentEventIndex ?? -1,
            segment.intentEventKind || 'none',
            segment.intentFormPostureKind || 'none',
            segment.intentFormPostureZoneIndex ?? -1,
            roundIdentityNumber(segment.startX),
            roundIdentityNumber(segment.startY),
            roundIdentityNumber(segment.cp1X),
            roundIdentityNumber(segment.cp1Y),
            roundIdentityNumber(segment.cp2X),
            roundIdentityNumber(segment.cp2Y),
            roundIdentityNumber(segment.endX),
            roundIdentityNumber(segment.endY),
        ]),
    ],
);

export const fitSakuraMacroSpineIntentPlanV1 = (plan) => {
    const resolved = requireSakuraMacroSpineIntentPlanV1(plan);
    const createTaggedSegment = ({ span, index, geometry, shapeArcStartNorm, shapeArcEndNorm }) => (
        Object.freeze({
            index,
            intentPlanId: resolved.planId,
            intentRole: span.role,
            intentEventIndex: span.eventIndex,
            intentEventKind: span.eventKind,
            intentEventZoneIndex: span.eventZoneIndex,
            intentFormPostureKind: span.formPostureKind,
            intentFormPostureZoneIndex: span.formPostureZoneIndex,
            intentArcStartNorm: span.startArcNorm,
            intentArcEndNorm: span.endArcNorm,
            shapeArcStartNorm,
            shapeArcEndNorm,
            ...geometry,
        })
    );
    const segments = resolved.conditioning?.adherence === 1
        ? partitionSakuraMacroSpineShapeAtArcRangesV1(
            fitSakuraMacroSpineGuideC1V1(resolved.conditioningGuide),
            resolved.spans,
        ).map((piece, index) => createTaggedSegment({
            span: resolved.spans[piece.rangeIndex],
            index,
            geometry: piece.geometry,
            shapeArcStartNorm: piece.arcStartNorm,
            shapeArcEndNorm: piece.arcEndNorm,
        }))
        : resolved.spans.map((span, index) => {
        const chordLength = Math.hypot(
            span.end.x - span.start.x,
            span.end.y - span.start.y,
        );
        const handleRatios = resolveSpanHandleRatios(span);
        const entryHandleLength = chordLength * handleRatios.entry;
        const exitHandleLength = chordLength * handleRatios.exit;
        return createTaggedSegment({
            span,
            index,
            shapeArcStartNorm: span.startArcNorm,
            shapeArcEndNorm: span.endArcNorm,
            geometry: {
                startX: span.start.x,
                startY: span.start.y,
                cp1X: span.start.x + (Math.cos(span.entryHeadingRad) * entryHandleLength),
                cp1Y: span.start.y + (Math.sin(span.entryHeadingRad) * entryHandleLength),
                cp2X: span.end.x - (Math.cos(span.exitHeadingRad) * exitHandleLength),
                cp2Y: span.end.y - (Math.sin(span.exitHeadingRad) * exitHandleLength),
                endX: span.end.x,
                endY: span.end.y,
            },
        });
    });
    const diagnosticGuide = createSakuraMacroSpineIntentDiagnosticGuideV1(resolved);
    return Object.freeze({
        version: 1,
        representation: SAKURA_MACRO_SPINE_INTENT_SHAPE_REPRESENTATION,
        coordinateSpace: resolved.coordinateSpace,
        guideId: diagnosticGuide.guideId,
        intentPlanId: resolved.planId,
        intentPlannerId: resolved.plannerId,
        intentSpans: resolved.spans,
        intentEvents: resolved.events,
        intentLateralSweep: resolved.lateralSweep,
        intentFormPostureEvent: resolved.formPostureEvent,
        shapeId: createIntentShapeId(resolved, segments),
        segments: Object.freeze(segments),
    });
};
