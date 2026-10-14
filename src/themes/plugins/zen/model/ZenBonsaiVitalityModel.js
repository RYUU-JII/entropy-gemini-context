// Bonsai vitality state laws — the stock/flow split of the redesigned habit
// model (docs/architecture/themes/zen/zen-bonsai-vitality-growth-spec.md).
//
// Health `H` is an asymmetric integrator over closed-day outcomes: damage
// lands within a day or two, full recovery takes 4 consecutive exemplary
// days, absence drifts toward a steady center. Growth `G` accrues only on
// engaged good days while healthy, pauses otherwise, and loses at most one
// milestone to extended neglect. Tuning must preserve the invariant table in
// spec §2.1 (mirrored verbatim in tests/themes/zenBonsaiVitalityModel.test.js).

export const ZEN_BONSAI_VITALITY_POLICY = Object.freeze({
    recoveryGain: 0.42,
    damageGain: 0.25,
    damageFloorTerm: 0.3,
    // Absence (no engagement data) settles toward the steady center in ~9
    // days from thriving; engaged-but-neutral days settle at half that rate,
    // so maintenance reads healthy-steady but thriving demands live tension.
    absenceDriftGain: 0.08,
    engagedNeutralDriftGain: 0.04,
    neutralCenter: 0.68,
    healthFloor: 0.12,
    initialHealth: 0.68,
    maxCatchUpDays: 7,
    recoveryOverlayMinDelta: 0.1,
});

export const ZEN_BONSAI_GROWTH_POLICY = Object.freeze({
    // Seven consecutive thriving practice days carry a new tree from its
    // established visual baseline to the full-form threshold (88 points).
    dailyGain: 12.6,
    practiceFloor: 0.5,
    healthGateStart: 0.5,
    healthGateFull: 0.85,
    diebackAfterDays: 10,
    diebackPerDay: 0.6,
    diebackEpisodeCap: 10,
    diebackEpisodeResetHealth: 0.65,
    lowHealthThreshold: 0.45,
    milestoneStep: 12,
    maxScore: 100,
});

export const ZEN_BONSAI_VITALITY_TIER = Object.freeze({
    THRIVING: 'thriving',
    STEADY: 'steady',
    STRAINED: 'strained',
    WITHERED: 'withered',
});

// Enter thresholds apply on the way down, exit thresholds on the way up, so a
// single mild slip cannot flap the presented tier (spec §3).
export const ZEN_BONSAI_VITALITY_TIER_THRESHOLDS = Object.freeze({
    thrivingEnter: 0.88,
    thrivingExit: 0.8,
    strainedEnter: 0.62,
    strainedExit: 0.68,
    witheredEnter: 0.42,
    witheredExit: 0.48,
});

// Discrete, silhouette-level looks per tier; only bloom interpolates within a
// tier (spec §5). Channels feed the existing vigor contract.
export const ZEN_BONSAI_TIER_VIGOR_PRESETS = Object.freeze({
    [ZEN_BONSAI_VITALITY_TIER.THRIVING]: Object.freeze({
        vitality: 0.95, stress: 0.04, bloomMin: 0.8, bloomMax: 1, dryness: 0.04, branchSag: 0.02, windResponse: 0.9,
    }),
    [ZEN_BONSAI_VITALITY_TIER.STEADY]: Object.freeze({
        vitality: 0.8, stress: 0.12, bloomMin: 0.35, bloomMax: 0.6, dryness: 0.12, branchSag: 0.06, windResponse: 0.78,
    }),
    [ZEN_BONSAI_VITALITY_TIER.STRAINED]: Object.freeze({
        vitality: 0.58, stress: 0.38, bloomMin: 0.08, bloomMax: 0.2, dryness: 0.42, branchSag: 0.3, windResponse: 0.6,
    }),
    [ZEN_BONSAI_VITALITY_TIER.WITHERED]: Object.freeze({
        vitality: 0.34, stress: 0.66, bloomMin: 0, bloomMax: 0, dryness: 0.7, branchSag: 0.55, windResponse: 0.42,
    }),
});

const TIER_INTERPOLATION_RANGES = Object.freeze({
    [ZEN_BONSAI_VITALITY_TIER.WITHERED]: Object.freeze([0.12, 0.48]),
    [ZEN_BONSAI_VITALITY_TIER.STRAINED]: Object.freeze([0.42, 0.68]),
    [ZEN_BONSAI_VITALITY_TIER.STEADY]: Object.freeze([0.62, 0.88]),
    [ZEN_BONSAI_VITALITY_TIER.THRIVING]: Object.freeze([0.8, 1]),
});

export const ZEN_BONSAI_MICRO_FEEDBACK = Object.freeze({
    DEW: 'dew_glint',
    LEAF: 'leaf_fall',
});

const clamp = (value, min, max) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return min;
    return Math.min(max, Math.max(min, numeric));
};

const clamp01 = (value) => clamp(value, 0, 1);
const lerp = (a, b, t) => a + ((b - a) * clamp01(t));
const smoothstep01 = (value) => {
    const t = clamp01(value);
    return t * t * (3 - (2 * t));
};
const round = (value, digits = 4) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Number(numeric.toFixed(digits));
};

const TIER_VALUES = new Set(Object.values(ZEN_BONSAI_VITALITY_TIER));

const toDateKey = (value) => {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : '';
};

const DAY_MS = 24 * 60 * 60 * 1000;

const diffDateKeys = (leftKey, rightKey) => {
    const left = toDateKey(leftKey);
    const right = toDateKey(rightKey);
    if (!left || !right || left === right) return 0;
    const leftMs = Date.parse(`${left}T00:00:00Z`);
    const rightMs = Date.parse(`${right}T00:00:00Z`);
    if (!Number.isFinite(leftMs) || !Number.isFinite(rightMs)) return 0;
    return Math.round((rightMs - leftMs) / DAY_MS);
};

const normalizeOutcome = (outcome = null) => {
    if (!outcome || typeof outcome !== 'object') return null;
    const value = Number(outcome.outcome);
    return {
        available: outcome.available === true,
        engaged: outcome.engaged === true,
        outcome: Number.isFinite(value) ? clamp(value, -1, 1) : null,
        adherence: Number.isFinite(Number(outcome.adherence)) ? round(clamp(outcome.adherence, -1, 1)) : null,
        practice: round(clamp01(outcome.practice)),
    };
};

const isFiniteValue = (value) => (
    value !== null
    && value !== undefined
    && value !== ''
    && Number.isFinite(Number(value))
);

export const normalizeZenBonsaiVitality = (value = null) => {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const healthH = Number.isFinite(Number(source.healthH))
        ? clamp(source.healthH, ZEN_BONSAI_VITALITY_POLICY.healthFloor, 1)
        : ZEN_BONSAI_VITALITY_POLICY.initialHealth;
    const growthG = isFiniteValue(source.growthG)
        ? clamp(source.growthG, 0, ZEN_BONSAI_GROWTH_POLICY.maxScore)
        : null;
    const growthMilestone = growthG === null
        ? 0
        : Math.floor(growthG / ZEN_BONSAI_GROWTH_POLICY.milestoneStep);
    const tier = TIER_VALUES.has(source.tier) ? source.tier : ZEN_BONSAI_VITALITY_TIER.STEADY;
    const recoveryDeltas = (Array.isArray(source.recoveryDeltas) ? source.recoveryDeltas : [])
        .map((delta) => round(clamp(delta, -1, 1)))
        .slice(-2);
    return Object.freeze({
        healthH: round(healthH),
        growthG: growthG === null ? null : round(growthG, 2),
        tier,
        lastMilestone: Math.max(0, Math.floor(Number(source.lastMilestone) || 0), growthMilestone),
        milestoneEventDateKey: toDateKey(source.milestoneEventDateKey),
        lastClosedDateKey: toDateKey(source.lastClosedDateKey),
        lastClosedOutcome: normalizeOutcome(source.lastClosedOutcome),
        pendingDateKey: toDateKey(source.pendingDateKey),
        pendingOutcome: normalizeOutcome(source.pendingOutcome),
        consecutiveLowHealthDays: Math.max(0, Math.floor(Number(source.consecutiveLowHealthDays) || 0)),
        diebackEpisodeLoss: round(Math.max(0, Number(source.diebackEpisodeLoss) || 0), 2),
        recoveryDeltas: Object.freeze(recoveryDeltas),
        updatedAtMs: Math.max(0, Math.floor(Number(source.updatedAtMs) || 0)),
    });
};

export const resolveZenBonsaiVitalityTier = (healthH, previousTier = ZEN_BONSAI_VITALITY_TIER.STEADY) => {
    const h = clamp(healthH, 0, 1);
    const t = ZEN_BONSAI_VITALITY_TIER_THRESHOLDS;
    const previous = TIER_VALUES.has(previousTier) ? previousTier : ZEN_BONSAI_VITALITY_TIER.STEADY;
    switch (previous) {
        case ZEN_BONSAI_VITALITY_TIER.THRIVING:
            if (h < t.witheredEnter) return ZEN_BONSAI_VITALITY_TIER.WITHERED;
            if (h < t.strainedEnter) return ZEN_BONSAI_VITALITY_TIER.STRAINED;
            if (h < t.thrivingExit) return ZEN_BONSAI_VITALITY_TIER.STEADY;
            return ZEN_BONSAI_VITALITY_TIER.THRIVING;
        case ZEN_BONSAI_VITALITY_TIER.STEADY:
            if (h < t.witheredEnter) return ZEN_BONSAI_VITALITY_TIER.WITHERED;
            if (h < t.strainedEnter) return ZEN_BONSAI_VITALITY_TIER.STRAINED;
            if (h >= t.thrivingEnter) return ZEN_BONSAI_VITALITY_TIER.THRIVING;
            return ZEN_BONSAI_VITALITY_TIER.STEADY;
        case ZEN_BONSAI_VITALITY_TIER.STRAINED:
            if (h < t.witheredEnter) return ZEN_BONSAI_VITALITY_TIER.WITHERED;
            if (h >= t.thrivingEnter) return ZEN_BONSAI_VITALITY_TIER.THRIVING;
            if (h >= t.strainedExit) return ZEN_BONSAI_VITALITY_TIER.STEADY;
            return ZEN_BONSAI_VITALITY_TIER.STRAINED;
        case ZEN_BONSAI_VITALITY_TIER.WITHERED:
        default:
            if (h >= t.thrivingEnter) return ZEN_BONSAI_VITALITY_TIER.THRIVING;
            if (h >= t.strainedExit) return ZEN_BONSAI_VITALITY_TIER.STEADY;
            if (h >= t.witheredExit) return ZEN_BONSAI_VITALITY_TIER.STRAINED;
            return ZEN_BONSAI_VITALITY_TIER.WITHERED;
    }
};

const advanceHealth = (healthH, outcome) => {
    const policy = ZEN_BONSAI_VITALITY_POLICY;
    const engagedOutcome = outcome?.engaged === true && Number.isFinite(outcome?.outcome)
        ? outcome.outcome
        : null;
    if (engagedOutcome === null) {
        return clamp(
            healthH + (policy.absenceDriftGain * (policy.neutralCenter - healthH)),
            policy.healthFloor,
            1,
        );
    }
    if (engagedOutcome > 0) {
        return clamp(
            healthH + (policy.recoveryGain * engagedOutcome * (1 - healthH)),
            policy.healthFloor,
            1,
        );
    }
    if (engagedOutcome < 0) {
        return clamp(
            healthH + (policy.damageGain * engagedOutcome * (policy.damageFloorTerm + healthH)),
            policy.healthFloor,
            1,
        );
    }
    return clamp(
        healthH + (policy.engagedNeutralDriftGain * (policy.neutralCenter - healthH)),
        policy.healthFloor,
        1,
    );
};

const advanceGrowth = ({ growthG, healthH, outcome, consecutiveLowHealthDays, diebackEpisodeLoss }) => {
    const policy = ZEN_BONSAI_GROWTH_POLICY;
    if (growthG === null) {
        return { growthG, consecutiveLowHealthDays, diebackEpisodeLoss };
    }
    let nextGrowth = growthG;
    let lowDays = consecutiveLowHealthDays;
    let episodeLoss = diebackEpisodeLoss;
    if (healthH < policy.lowHealthThreshold) {
        lowDays += 1;
        if (lowDays > policy.diebackAfterDays && episodeLoss < policy.diebackEpisodeCap) {
            const loss = Math.min(policy.diebackPerDay, policy.diebackEpisodeCap - episodeLoss);
            nextGrowth = clamp(nextGrowth - loss, 0, policy.maxScore);
            episodeLoss = round(episodeLoss + loss, 2);
        }
    } else {
        lowDays = 0;
        if (healthH >= policy.diebackEpisodeResetHealth) {
            episodeLoss = 0;
        }
        const engagedOutcome = outcome?.engaged === true && Number.isFinite(outcome?.outcome)
            ? outcome.outcome
            : null;
        if (engagedOutcome !== null && engagedOutcome > 0) {
            const healthGate = smoothstep01(
                (healthH - policy.healthGateStart)
                / (policy.healthGateFull - policy.healthGateStart),
            );
            const practice = clamp01(outcome?.practice);
            const gain = policy.dailyGain
                * healthGate
                * (policy.practiceFloor + ((1 - policy.practiceFloor) * practice));
            nextGrowth = clamp(nextGrowth + gain, 0, policy.maxScore);
        }
    }
    return {
        growthG: round(nextGrowth, 2),
        consecutiveLowHealthDays: lowDays,
        diebackEpisodeLoss: episodeLoss,
    };
};

// Closes one day: applies the health law, growth law, tier hysteresis, and
// the 2-day recovery window. `outcome` null means a neutral (drift) day.
export const advanceZenBonsaiVitalityDay = (state, { outcome = null, dateKey = '' } = {}) => {
    const current = normalizeZenBonsaiVitality(state);
    const closedOutcome = normalizeOutcome(outcome);
    const nextHealth = advanceHealth(current.healthH, closedOutcome);
    const delta = round(nextHealth - current.healthH);
    const growthResult = advanceGrowth({
        growthG: current.growthG,
        healthH: nextHealth,
        outcome: closedOutcome,
        consecutiveLowHealthDays: current.consecutiveLowHealthDays,
        diebackEpisodeLoss: current.diebackEpisodeLoss,
    });
    const tier = resolveZenBonsaiVitalityTier(nextHealth, current.tier);
    const previousMilestone = current.lastMilestone;
    const milestone = growthResult.growthG === null
        ? previousMilestone
        : Math.floor(growthResult.growthG / ZEN_BONSAI_GROWTH_POLICY.milestoneStep);
    return normalizeZenBonsaiVitality({
        ...current,
        healthH: nextHealth,
        growthG: growthResult.growthG,
        tier,
        lastMilestone: Math.max(previousMilestone, milestone),
        milestoneEventDateKey: milestone > previousMilestone
            ? toDateKey(dateKey)
            : current.milestoneEventDateKey,
        lastClosedDateKey: toDateKey(dateKey) || current.lastClosedDateKey,
        lastClosedOutcome: closedOutcome,
        consecutiveLowHealthDays: growthResult.consecutiveLowHealthDays,
        diebackEpisodeLoss: growthResult.diebackEpisodeLoss,
        recoveryDeltas: [...current.recoveryDeltas, delta].slice(-2),
    });
};

// Reconciliation entry point: closes the pending day when the date advanced,
// applies capped neutral drift for fully missed days, seeds growth from the
// current cultivation score on first activation, and records today's provisional
// outcome. Idempotent for repeated intraday calls.
export const reconcileZenBonsaiVitality = ({
    vitality = null,
    dateKey = '',
    dailyOutcome = null,
    initialGrowthScore = null,
    nowMs = Date.now(),
} = {}) => {
    let state = normalizeZenBonsaiVitality(vitality);
    const todayKey = toDateKey(dateKey);
    if (!todayKey) {
        return state;
    }
    if (state.growthG === null && Number.isFinite(Number(initialGrowthScore))) {
        state = normalizeZenBonsaiVitality({
            ...state,
            growthG: clamp(initialGrowthScore, 0, ZEN_BONSAI_GROWTH_POLICY.maxScore),
            lastMilestone: Math.floor(
                clamp(initialGrowthScore, 0, ZEN_BONSAI_GROWTH_POLICY.maxScore)
                / ZEN_BONSAI_GROWTH_POLICY.milestoneStep,
            ),
        });
    }
    if (state.pendingDateKey && diffDateKeys(state.pendingDateKey, todayKey) > 0) {
        const gapDays = diffDateKeys(state.pendingDateKey, todayKey);
        state = advanceZenBonsaiVitalityDay(state, {
            outcome: state.pendingOutcome,
            dateKey: state.pendingDateKey,
        });
        const missedDays = Math.min(
            Math.max(0, gapDays - 1),
            ZEN_BONSAI_VITALITY_POLICY.maxCatchUpDays,
        );
        for (let missed = 0; missed < missedDays; missed += 1) {
            state = advanceZenBonsaiVitalityDay(state, { outcome: null, dateKey: '' });
        }
    }
    return normalizeZenBonsaiVitality({
        ...state,
        pendingDateKey: todayKey,
        pendingOutcome: normalizeOutcome(dailyOutcome),
        updatedAtMs: Math.max(0, Math.floor(Number(nowMs) || 0)),
    });
};

export const resolveZenBonsaiVitalityPresentation = (vitality = null) => {
    const state = normalizeZenBonsaiVitality(vitality);
    const active = state.growthG !== null;
    const recoveryDelta = state.recoveryDeltas.reduce((acc, delta) => acc + delta, 0);
    const recoveryOverlay = active
        && recoveryDelta >= ZEN_BONSAI_VITALITY_POLICY.recoveryOverlayMinDelta
        && (
            state.tier === ZEN_BONSAI_VITALITY_TIER.STRAINED
            || state.tier === ZEN_BONSAI_VITALITY_TIER.WITHERED
        );
    const closedOutcome = state.lastClosedOutcome;
    const microFeedback = (() => {
        if (!active || !closedOutcome?.engaged || !Number.isFinite(closedOutcome?.outcome)) return null;
        if (closedOutcome.outcome > 0) return ZEN_BONSAI_MICRO_FEEDBACK.DEW;
        if (closedOutcome.outcome < 0) return ZEN_BONSAI_MICRO_FEEDBACK.LEAF;
        return null;
    })();
    return Object.freeze({
        active,
        healthH: state.healthH,
        tier: state.tier,
        growthScore: state.growthG,
        lastMilestone: state.lastMilestone,
        milestoneStep: ZEN_BONSAI_GROWTH_POLICY.milestoneStep,
        milestoneEventDateKey: state.milestoneEventDateKey,
        recoveryOverlay,
        recoveryDelta: round(recoveryDelta),
        microFeedback,
        lastClosedDateKey: state.lastClosedDateKey,
    });
};

export const resolveZenBonsaiTierVigor = (tier, healthH, {
    recoveryOverlay = false,
} = {}) => {
    const safeTier = TIER_VALUES.has(tier) ? tier : ZEN_BONSAI_VITALITY_TIER.STEADY;
    const preset = ZEN_BONSAI_TIER_VIGOR_PRESETS[safeTier];
    const [low, high] = TIER_INTERPOLATION_RANGES[safeTier];
    const position = clamp01((clamp(healthH, 0, 1) - low) / Math.max(1e-6, high - low));
    return Object.freeze({
        vitality: round(preset.vitality),
        stress: round(preset.stress),
        bloom: round(lerp(preset.bloomMin, preset.bloomMax, position)),
        dryness: round(preset.dryness),
        branchSag: round(preset.branchSag),
        windResponse: round(clamp01(preset.windResponse + (recoveryOverlay ? 0.06 : 0))),
    });
};

export default reconcileZenBonsaiVitality;
