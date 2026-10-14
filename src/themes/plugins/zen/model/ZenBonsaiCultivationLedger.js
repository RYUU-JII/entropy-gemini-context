import { normalizeZenBonsaiLifeState } from './ZenBonsaiLifeState.js';
import { ZEN_BONSAI_CULTIVATION_STAGES } from './ZenBonsaiCultivationPolicy.js';
import {
    ZEN_BONSAI_GROWTH_POLICY,
    ZEN_BONSAI_VITALITY_POLICY,
    normalizeZenBonsaiVitality,
    reconcileZenBonsaiVitality,
    resolveZenBonsaiVitalityPresentation,
} from './ZenBonsaiVitalityModel.js';

export const ZEN_BONSAI_CULTIVATION_LEDGER_SCHEMA_VERSION = 1;
export const ZEN_BONSAI_CULTIVATION_BASELINE_STATUS = Object.freeze({
    COLLECTING: 'collecting',
    READY: 'ready',
});

export const ZEN_BONSAI_CULTIVATION_ADAPTIVE_BASELINE_POLICY = Object.freeze({
    maxSampleDays: 28,
    recencyHalfLifeDays: 10,
    confidenceWeightTarget: 5.5,
    initialPriorWeight: 4.2,
    initialPriorHalfLifeWeight: 6.5,
    maxCenterStepPerDay: 0.055,
    aspirationMaxLift: 0.008,
    aspirationLiftRatio: 0.06,
});

export const ZEN_BONSAI_CULTIVATION_DAILY_CAPS = Object.freeze({
    growthUp: 0.1,
    growthDown: 0.08,
    vitalityUp: 0.08,
    vitalityDown: 0.1,
    stressUp: 0.12,
    stressDown: 0.1,
    bloomUp: 0.16,
    bloomDown: 0.18,
    drynessUp: 0.1,
    drynessDown: 0.08,
    branchSagUp: 0.12,
    branchSagDown: 0.1,
    windResponseUp: 0.12,
    windResponseDown: 0.12,
});

export const ZEN_BONSAI_STRUCTURAL_IMPRINT_POLICY = Object.freeze({
    schemaVersion: 1,
    initialCanopyReserve: 0.62,
    exposureHalfLifeDays: 14,
    stressHalfLifeDays: 21,
    recoveryHalfLifeDays: 21,
    volatilityHalfLifeDays: 14,
    maxCatchUpDays: 7,
    canopyPracticeGain: 0.035,
    canopyStrainLoss: 0.025,
    canopyRecoveryGain: 0.006,
});

export const ZEN_BONSAI_GROWTH_SEGMENT_POLICY = Object.freeze({
    schemaVersion: 1,
    maxSegments: Math.floor(
        ZEN_BONSAI_GROWTH_POLICY.maxScore / ZEN_BONSAI_GROWTH_POLICY.milestoneStep,
    ),
});

const MAX_BASELINE_SAMPLE_DAYS = ZEN_BONSAI_CULTIVATION_ADAPTIVE_BASELINE_POLICY.maxSampleDays;
const MAX_CAP_CATCHUP_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

const hasExactKeys = (value, expectedKeys) => {
    if (!isPlainObject(value)) return false;
    const actualKeys = Object.keys(value).sort();
    const canonicalKeys = [...expectedKeys].sort();
    return actualKeys.length === canonicalKeys.length
        && actualKeys.every((key, index) => key === canonicalKeys[index]);
};

const isDeepCanonicalEqual = (left, right) => {
    if (Object.is(left, right)) return true;
    if (Array.isArray(left) || Array.isArray(right)) {
        return Array.isArray(left)
            && Array.isArray(right)
            && left.length === right.length
            && left.every((entry, index) => isDeepCanonicalEqual(entry, right[index]));
    }
    if (!isPlainObject(left) || !isPlainObject(right)) return false;
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return leftKeys.length === rightKeys.length
        && leftKeys.every((key) => (
            Object.prototype.hasOwnProperty.call(right, key)
            && isDeepCanonicalEqual(left[key], right[key])
        ));
};

const requireOwnFields = (value, fields, code) => {
    const missingField = fields.find((field) => !Object.prototype.hasOwnProperty.call(value, field));
    if (missingField) {
        throw new Error(`${code}:${missingField}`);
    }
};

const clamp = (value, min = 0, max = 1) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return min;
    return Math.min(max, Math.max(min, numeric));
};

const clamp01 = (value) => clamp(value, 0, 1);

const toTimestamp = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : fallback;
};

const toDateKey = (value) => {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : '';
};

const toScore = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? clamp(numeric, 0, 100) : fallback;
};

const round = (value, digits = 4) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Number(numeric.toFixed(digits));
};

const isFiniteValue = (value) => (
    value !== null
    && value !== undefined
    && value !== ''
    && Number.isFinite(Number(value))
);

const toNullableRatio = (value) => {
    if (!isFiniteValue(value)) return null;
    const numeric = Number(value);
    return round(clamp01(numeric));
};

export const resolveZenBonsaiCultivationDateKey = (nowMs = Date.now()) => {
    const date = new Date(toTimestamp(nowMs, Date.now()));
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const diffDateKeys = (leftKey, rightKey) => {
    const left = toDateKey(leftKey);
    const right = toDateKey(rightKey);
    if (!left || !right || left === right) return 0;
    const leftMs = Date.parse(`${left}T00:00:00Z`);
    const rightMs = Date.parse(`${right}T00:00:00Z`);
    if (!Number.isFinite(leftMs) || !Number.isFinite(rightMs)) return 0;
    return Math.max(0, Math.round((rightMs - leftMs) / DAY_MS));
};

const addDateKeyDays = (dateKey, days = 0) => {
    const normalized = toDateKey(dateKey);
    if (!normalized) return '';
    const baseMs = Date.parse(`${normalized}T00:00:00Z`);
    if (!Number.isFinite(baseMs)) return '';
    return new Date(baseMs + ((Number(days) || 0) * DAY_MS)).toISOString().slice(0, 10);
};

const normalizeSample = (sample = null) => {
    if (!isPlainObject(sample)) {
        throw new Error('ZEN_BONSAI_CULTIVATION_LEDGER_SAMPLE_INVALID');
    }
    const reliability = Number(sample.reliability);
    return Object.freeze({
        dateKey: toDateKey(sample.dateKey),
        healthRatio: round(clamp01(sample.healthRatio)),
        growthScore: round(toScore(sample.growthScore)),
        evidenceDays: Math.max(0, Math.floor(Number(sample.evidenceDays) || 0)),
        reliability: Number.isFinite(reliability) ? round(clamp01(reliability)) : 0.72,
        siteSignature: typeof sample.siteSignature === 'string' ? sample.siteSignature.trim() : '',
        registeredSiteCount: Math.max(0, Math.floor(Number(sample.registeredSiteCount) || 0)),
        scoringMode: typeof sample.scoringMode === 'string' ? sample.scoringMode.trim() : '',
        scoreCoverageRatio: toNullableRatio(sample.scoreCoverageRatio),
        scoreDisplayReady: sample.scoreDisplayReady === true,
        updatedAtMs: toTimestamp(sample.updatedAtMs, 0),
    });
};

const normalizeSamples = (samples = {}) => {
    if (samples === undefined || samples === null) return Object.freeze({});
    if (!isPlainObject(samples)) {
        throw new Error('ZEN_BONSAI_CULTIVATION_LEDGER_SAMPLES_INVALID');
    }
    return Object.freeze(
        Object.entries(samples)
            .map(([key, sample]) => {
                const normalizedKey = toDateKey(key);
                if (!normalizedKey) return null;
                const normalizedSample = normalizeSample({
                    ...sample,
                    dateKey: sample?.dateKey || normalizedKey,
                });
                return [normalizedKey, normalizedSample];
            })
            .filter(Boolean)
            .sort(([left], [right]) => left.localeCompare(right))
            .slice(-MAX_BASELINE_SAMPLE_DAYS)
            .reduce((acc, [key, sample]) => {
                acc[key] = sample;
                return acc;
            }, {}),
    );
};

const normalizeAdaptiveBaseline = (adaptive = null) => {
    if (adaptive === undefined || adaptive === null) {
        return Object.freeze({
            effectiveHealthRatio: null,
            centerHealthRatio: null,
            targetHealthRatio: null,
            rollingHealthRatio: null,
            rollingGrowthScore: null,
            confidence: 0,
            sampleWeight: 0,
            sampleCount: 0,
            initialPriorWeight: ZEN_BONSAI_CULTIVATION_ADAPTIVE_BASELINE_POLICY.initialPriorWeight,
            improvementLift: 0,
            contextShift: 0,
            updatedAtMs: 0,
        });
    }
    if (!isPlainObject(adaptive)) {
        throw new Error('ZEN_BONSAI_CULTIVATION_LEDGER_ADAPTIVE_BASELINE_INVALID');
    }
    const centerHealthRatio = toNullableRatio(
        adaptive.centerHealthRatio,
    );
    const targetHealthRatio = toNullableRatio(
        adaptive.targetHealthRatio,
    );
    return Object.freeze({
        effectiveHealthRatio: toNullableRatio(adaptive.effectiveHealthRatio),
        centerHealthRatio,
        targetHealthRatio,
        rollingHealthRatio: toNullableRatio(adaptive.rollingHealthRatio),
        rollingGrowthScore: isFiniteValue(adaptive.rollingGrowthScore)
            ? round(toScore(adaptive.rollingGrowthScore))
            : null,
        confidence: round(clamp01(adaptive.confidence)),
        sampleWeight: round(Math.max(0, Number(adaptive.sampleWeight) || 0)),
        sampleCount: Math.max(0, Math.floor(Number(adaptive.sampleCount) || 0)),
        initialPriorWeight: round(Math.max(0, Number(adaptive.initialPriorWeight)
            || ZEN_BONSAI_CULTIVATION_ADAPTIVE_BASELINE_POLICY.initialPriorWeight)),
        improvementLift: round(Math.max(0, Number(adaptive.improvementLift) || 0)),
        contextShift: round(clamp01(adaptive.contextShift)),
        updatedAtMs: toTimestamp(adaptive.updatedAtMs, 0),
    });
};

const normalizeBaseline = (baseline = null) => {
    if (baseline === undefined || baseline === null) {
        return Object.freeze({
            status: ZEN_BONSAI_CULTIVATION_BASELINE_STATUS.COLLECTING,
            siteSignature: '',
            startedAtMs: 0,
            sealedAtMs: 0,
            healthRatio: null,
            initialPriorHealthRatio: null,
            growthScore: null,
            evidenceDays: 0,
            samples: Object.freeze({}),
            adaptive: normalizeAdaptiveBaseline(null),
        });
    }
    if (!isPlainObject(baseline)) {
        throw new Error('ZEN_BONSAI_CULTIVATION_LEDGER_BASELINE_INVALID');
    }
    const status = baseline.status === ZEN_BONSAI_CULTIVATION_BASELINE_STATUS.READY
        ? ZEN_BONSAI_CULTIVATION_BASELINE_STATUS.READY
        : ZEN_BONSAI_CULTIVATION_BASELINE_STATUS.COLLECTING;
    const samples = normalizeSamples(baseline.samples);
    const healthRatio = Number(baseline.initialPriorHealthRatio);
    const growthScore = Number(baseline.growthScore);
    if (status === ZEN_BONSAI_CULTIVATION_BASELINE_STATUS.READY && !Number.isFinite(healthRatio)) {
        throw new Error('ZEN_BONSAI_CULTIVATION_LEDGER_BASELINE_HEALTH_REQUIRED');
    }
    return Object.freeze({
        status,
        siteSignature: typeof baseline.siteSignature === 'string' ? baseline.siteSignature.trim() : '',
        startedAtMs: toTimestamp(baseline.startedAtMs, 0),
        sealedAtMs: status === ZEN_BONSAI_CULTIVATION_BASELINE_STATUS.READY
            ? toTimestamp(baseline.sealedAtMs, 0)
            : 0,
        healthRatio: status === ZEN_BONSAI_CULTIVATION_BASELINE_STATUS.READY && Number.isFinite(healthRatio)
            ? round(clamp(healthRatio, 0, 1))
            : null,
        initialPriorHealthRatio: status === ZEN_BONSAI_CULTIVATION_BASELINE_STATUS.READY && Number.isFinite(healthRatio)
            ? round(clamp(healthRatio, 0, 1))
            : null,
        growthScore: status === ZEN_BONSAI_CULTIVATION_BASELINE_STATUS.READY && Number.isFinite(growthScore)
            ? round(toScore(growthScore))
            : null,
        evidenceDays: Math.max(0, Math.floor(Number(baseline.evidenceDays) || 0)),
        samples,
        adaptive: normalizeAdaptiveBaseline(baseline.adaptive),
    });
};

const normalizeDailyCap = (dailyCap = null) => {
    if (dailyCap === undefined || dailyCap === null) {
        return Object.freeze({
            dateKey: '',
            anchorLifeState: null,
            lastCappedLifeState: null,
        });
    }
    if (!isPlainObject(dailyCap)) {
        throw new Error('ZEN_BONSAI_CULTIVATION_LEDGER_DAILY_CAP_INVALID');
    }
    return Object.freeze({
        dateKey: toDateKey(dailyCap.dateKey),
        anchorLifeState: dailyCap.anchorLifeState
            ? normalizeZenBonsaiLifeState(dailyCap.anchorLifeState)
            : null,
        lastCappedLifeState: dailyCap.lastCappedLifeState
            ? normalizeZenBonsaiLifeState(dailyCap.lastCappedLifeState)
            : null,
    });
};

const normalizeStructuralOutcome = (outcome = null, { dateKey = '' } = {}) => {
    if (!outcome || typeof outcome !== 'object' || Array.isArray(outcome)) return null;
    const value = Number(outcome.outcome);
    const adherence = Number(outcome.adherence);
    return Object.freeze({
        available: outcome.available === true,
        engaged: outcome.engaged === true,
        outcome: Number.isFinite(value) ? round(clamp(value, -1, 1)) : null,
        adherence: Number.isFinite(adherence) ? round(clamp(adherence, -1, 1)) : null,
        practice: round(clamp01(outcome.practice)),
        dateKey: toDateKey(outcome.dateKey) || toDateKey(dateKey),
    });
};

const normalizeStructuralRatio = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? round(clamp01(numeric)) : round(clamp01(fallback));
};

export const normalizeZenBonsaiStructuralImprint = (structuralImprint = null) => {
    if (structuralImprint === undefined || structuralImprint === null) {
        return Object.freeze({
            schemaVersion: ZEN_BONSAI_STRUCTURAL_IMPRINT_POLICY.schemaVersion,
            exposureQuality: 0,
            stressWood: 0,
            recoveryWood: 0,
            volatility: 0,
            canopyReserve: ZEN_BONSAI_STRUCTURAL_IMPRINT_POLICY.initialCanopyReserve,
            lastUpdatedDateKey: '',
            lastEngagedOutcome: null,
            pendingDateKey: '',
            pendingOutcome: null,
            updatedAtMs: 0,
        });
    }
    if (!isPlainObject(structuralImprint)) {
        throw new Error('ZEN_BONSAI_CULTIVATION_LEDGER_STRUCTURAL_IMPRINT_INVALID');
    }
    if (structuralImprint.schemaVersion !== ZEN_BONSAI_STRUCTURAL_IMPRINT_POLICY.schemaVersion) {
        throw new Error('ZEN_BONSAI_CULTIVATION_LEDGER_STRUCTURAL_IMPRINT_VERSION_INVALID');
    }
    return Object.freeze({
        schemaVersion: ZEN_BONSAI_STRUCTURAL_IMPRINT_POLICY.schemaVersion,
        exposureQuality: normalizeStructuralRatio(structuralImprint.exposureQuality),
        stressWood: normalizeStructuralRatio(structuralImprint.stressWood),
        recoveryWood: normalizeStructuralRatio(structuralImprint.recoveryWood),
        volatility: normalizeStructuralRatio(structuralImprint.volatility),
        canopyReserve: normalizeStructuralRatio(
            structuralImprint.canopyReserve,
            ZEN_BONSAI_STRUCTURAL_IMPRINT_POLICY.initialCanopyReserve,
        ),
        lastUpdatedDateKey: toDateKey(structuralImprint.lastUpdatedDateKey),
        lastEngagedOutcome: normalizeStructuralOutcome(structuralImprint.lastEngagedOutcome),
        pendingDateKey: toDateKey(structuralImprint.pendingDateKey),
        pendingOutcome: normalizeStructuralOutcome(structuralImprint.pendingOutcome, {
            dateKey: structuralImprint.pendingDateKey,
        }),
        updatedAtMs: toTimestamp(structuralImprint.updatedAtMs, 0),
    });
};

const normalizeZenBonsaiGrowthSegment = (segment = null) => {
    if (!isPlainObject(segment)) {
        throw new Error('ZEN_BONSAI_CULTIVATION_LEDGER_GROWTH_SEGMENT_INVALID');
    }
    if (segment.schemaVersion !== ZEN_BONSAI_GROWTH_SEGMENT_POLICY.schemaVersion) {
        throw new Error('ZEN_BONSAI_CULTIVATION_LEDGER_GROWTH_SEGMENT_VERSION_INVALID');
    }
    const milestone = Math.max(0, Math.floor(Number(segment.milestone) || 0));
    const growthScore = Number.isFinite(Number(segment.growthScore))
        ? toScore(segment.growthScore)
        : toScore(milestone * ZEN_BONSAI_GROWTH_POLICY.milestoneStep);
    return Object.freeze({
        schemaVersion: ZEN_BONSAI_GROWTH_SEGMENT_POLICY.schemaVersion,
        id: typeof segment.id === 'string' && segment.id.trim()
            ? segment.id.trim()
            : `m${milestone}`,
        milestone,
        growthScore: round(growthScore, 2),
        dateKey: toDateKey(segment.dateKey),
        exposureQuality: normalizeStructuralRatio(segment.exposureQuality),
        stressWood: normalizeStructuralRatio(segment.stressWood),
        recoveryWood: normalizeStructuralRatio(segment.recoveryWood),
        volatility: normalizeStructuralRatio(segment.volatility),
        canopyReserve: normalizeStructuralRatio(
            segment.canopyReserve,
            ZEN_BONSAI_STRUCTURAL_IMPRINT_POLICY.initialCanopyReserve,
        ),
        healthH: normalizeStructuralRatio(segment.healthH, ZEN_BONSAI_VITALITY_POLICY.initialHealth),
        vitalityTier: typeof segment.vitalityTier === 'string' ? segment.vitalityTier.trim() : '',
        createdAtMs: toTimestamp(segment.createdAtMs, 0),
    });
};

export const normalizeZenBonsaiGrowthSegments = (growthSegments = null) => {
    if (growthSegments === undefined || growthSegments === null) {
        return Object.freeze([]);
    }
    if (!Array.isArray(growthSegments)) {
        throw new Error('ZEN_BONSAI_CULTIVATION_LEDGER_GROWTH_SEGMENTS_INVALID');
    }
    const source = growthSegments;
    const seen = new Set();
    return Object.freeze(source
        .map((segment) => normalizeZenBonsaiGrowthSegment(segment))
        .filter((segment) => {
            if (segment.milestone <= 0) return false;
            if (seen.has(segment.milestone)) return false;
            seen.add(segment.milestone);
            return true;
        })
        .sort((left, right) => left.milestone - right.milestone)
        .slice(-ZEN_BONSAI_GROWTH_SEGMENT_POLICY.maxSegments));
};

export const createDefaultZenBonsaiCultivationLedger = ({ nowMs = Date.now() } = {}) => {
    const timestamp = toTimestamp(nowMs, Date.now());
    return Object.freeze({
        schemaVersion: ZEN_BONSAI_CULTIVATION_LEDGER_SCHEMA_VERSION,
        createdAtMs: timestamp,
        updatedAtMs: timestamp,
        baseline: normalizeBaseline(null),
        dailyCap: normalizeDailyCap(null),
        vitality: normalizeZenBonsaiVitality(null),
        structuralImprint: normalizeZenBonsaiStructuralImprint(null),
        growthSegments: normalizeZenBonsaiGrowthSegments(null),
    });
};

export const normalizeZenBonsaiCultivationLedger = (value = null, {
    nowMs = Date.now(),
} = {}) => {
    if (value === undefined || value === null) {
        return createDefaultZenBonsaiCultivationLedger({ nowMs });
    }
    if (!isPlainObject(value)) {
        throw new Error('ZEN_BONSAI_CULTIVATION_LEDGER_INVALID');
    }
    if (value.schemaVersion !== ZEN_BONSAI_CULTIVATION_LEDGER_SCHEMA_VERSION) {
        throw new Error(
            `ZEN_BONSAI_CULTIVATION_LEDGER_VERSION_INVALID:${value.schemaVersion ?? 'missing'}`,
        );
    }
    const requiredFields = [
        'schemaVersion',
        'createdAtMs',
        'updatedAtMs',
        'baseline',
        'dailyCap',
        'vitality',
        'structuralImprint',
        'growthSegments',
    ];
    if (!hasExactKeys(value, requiredFields)) {
        const missingRequiredField = requiredFields.find(
            (field) => !Object.prototype.hasOwnProperty.call(value, field),
        );
        if (missingRequiredField) {
            throw new Error(`ZEN_BONSAI_CULTIVATION_LEDGER_FIELD_MISSING:${missingRequiredField}`);
        }
        throw new Error('ZEN_BONSAI_CULTIVATION_LEDGER_SHAPE_INVALID');
    }
    const missingField = requiredFields.find(
        (field) => !Object.prototype.hasOwnProperty.call(value, field),
    );
    if (missingField) {
        throw new Error(`ZEN_BONSAI_CULTIVATION_LEDGER_FIELD_MISSING:${missingField}`);
    }
    if (!isPlainObject(value.baseline)
        || !isPlainObject(value.dailyCap)
        || !isPlainObject(value.vitality)
        || !isPlainObject(value.structuralImprint)
        || !Array.isArray(value.growthSegments)) {
        throw new Error('ZEN_BONSAI_CULTIVATION_LEDGER_CONTRACT_INVALID');
    }
    requireOwnFields(value.baseline, [
        'status',
        'siteSignature',
        'startedAtMs',
        'sealedAtMs',
        'healthRatio',
        'initialPriorHealthRatio',
        'growthScore',
        'evidenceDays',
        'samples',
        'adaptive',
    ], 'ZEN_BONSAI_CULTIVATION_LEDGER_BASELINE_FIELD_MISSING');
    if (!isPlainObject(value.baseline.samples) || !isPlainObject(value.baseline.adaptive)) {
        throw new Error('ZEN_BONSAI_CULTIVATION_LEDGER_BASELINE_CONTRACT_INVALID');
    }
    requireOwnFields(value.baseline.adaptive, [
        'effectiveHealthRatio',
        'centerHealthRatio',
        'targetHealthRatio',
        'rollingHealthRatio',
        'rollingGrowthScore',
        'confidence',
        'sampleWeight',
        'sampleCount',
        'initialPriorWeight',
        'improvementLift',
        'contextShift',
        'updatedAtMs',
    ], 'ZEN_BONSAI_CULTIVATION_LEDGER_ADAPTIVE_FIELD_MISSING');
    Object.values(value.baseline.samples).forEach((sample) => {
        if (!isPlainObject(sample)) {
            throw new Error('ZEN_BONSAI_CULTIVATION_LEDGER_SAMPLE_INVALID');
        }
        requireOwnFields(sample, [
            'dateKey',
            'healthRatio',
            'growthScore',
            'evidenceDays',
            'reliability',
            'siteSignature',
            'registeredSiteCount',
            'scoringMode',
            'scoreCoverageRatio',
            'scoreDisplayReady',
            'updatedAtMs',
        ], 'ZEN_BONSAI_CULTIVATION_LEDGER_SAMPLE_FIELD_MISSING');
    });
    requireOwnFields(value.dailyCap, [
        'dateKey',
        'anchorLifeState',
        'lastCappedLifeState',
    ], 'ZEN_BONSAI_CULTIVATION_LEDGER_DAILY_CAP_FIELD_MISSING');
    requireOwnFields(value.vitality, [
        'healthH',
        'growthG',
        'tier',
        'lastMilestone',
        'milestoneEventDateKey',
        'lastClosedDateKey',
        'lastClosedOutcome',
        'pendingDateKey',
        'pendingOutcome',
        'consecutiveLowHealthDays',
        'diebackEpisodeLoss',
        'recoveryDeltas',
        'updatedAtMs',
    ], 'ZEN_BONSAI_CULTIVATION_LEDGER_VITALITY_FIELD_MISSING');
    requireOwnFields(value.structuralImprint, [
        'schemaVersion',
        'exposureQuality',
        'stressWood',
        'recoveryWood',
        'volatility',
        'canopyReserve',
        'lastUpdatedDateKey',
        'lastEngagedOutcome',
        'pendingDateKey',
        'pendingOutcome',
        'updatedAtMs',
    ], 'ZEN_BONSAI_CULTIVATION_LEDGER_STRUCTURAL_IMPRINT_FIELD_MISSING');
    value.growthSegments.forEach((segment) => {
        if (!isPlainObject(segment)) {
            throw new Error('ZEN_BONSAI_CULTIVATION_LEDGER_GROWTH_SEGMENT_INVALID');
        }
        requireOwnFields(segment, [
            'schemaVersion',
            'id',
            'milestone',
            'growthScore',
            'dateKey',
            'exposureQuality',
            'stressWood',
            'recoveryWood',
            'volatility',
            'canopyReserve',
            'healthH',
            'vitalityTier',
            'createdAtMs',
        ], 'ZEN_BONSAI_CULTIVATION_LEDGER_GROWTH_SEGMENT_FIELD_MISSING');
    });
    const createdAtMs = toTimestamp(value.createdAtMs, toTimestamp(nowMs, Date.now()));
    const updatedAtMs = Math.max(createdAtMs, toTimestamp(value.updatedAtMs, createdAtMs));
    const normalized = Object.freeze({
        schemaVersion: ZEN_BONSAI_CULTIVATION_LEDGER_SCHEMA_VERSION,
        createdAtMs,
        updatedAtMs,
        baseline: normalizeBaseline(value.baseline),
        dailyCap: normalizeDailyCap(value.dailyCap),
        vitality: normalizeZenBonsaiVitality(value.vitality),
        structuralImprint: normalizeZenBonsaiStructuralImprint(value.structuralImprint),
        growthSegments: normalizeZenBonsaiGrowthSegments(value.growthSegments),
    });
    if (!isDeepCanonicalEqual(value, normalized)) {
        throw new Error('ZEN_BONSAI_CULTIVATION_LEDGER_CONTRACT_INVALID');
    }
    return normalized;
};

const averageSamples = (samples = {}) => {
    const values = Object.values(samples);
    if (!values.length) {
        return {
            healthRatio: 1,
            growthScore: 0,
            evidenceDays: 0,
        };
    }
    const weighted = values.reduce((acc, sample) => {
        const weight = Math.max(0.08, clamp01(sample.reliability));
        acc.health += clamp01(sample.healthRatio) * weight;
        acc.growth += toScore(sample.growthScore) * weight;
        acc.weight += weight;
        return acc;
    }, { health: 0, growth: 0, weight: 0 });
    const divisor = weighted.weight > 0 ? weighted.weight : values.length;
    return {
        healthRatio: round(weighted.health / divisor),
        growthScore: round(weighted.growth / divisor),
        evidenceDays: Math.max(...values.map((sample) => Math.max(0, Number(sample.evidenceDays) || 0))),
    };
};

const parseSiteSignatureDomains = (siteSignature = '') => {
    if (typeof siteSignature !== 'string') return [];
    return siteSignature
        .split(',')
        .map((domain) => domain.trim().toLowerCase())
        .filter(Boolean);
};

const resolveSiteSignatureAffinity = (leftSignature = '', rightSignature = '') => {
    const left = parseSiteSignatureDomains(leftSignature);
    const right = parseSiteSignatureDomains(rightSignature);
    if (!left.length || !right.length) {
        const leftText = typeof leftSignature === 'string' ? leftSignature.trim() : '';
        const rightText = typeof rightSignature === 'string' ? rightSignature.trim() : '';
        if (!leftText || !rightText || leftText === rightText) return 1;
        return 0.46;
    }
    const leftSet = new Set(left);
    const rightSet = new Set(right);
    const union = new Set([...leftSet, ...rightSet]);
    let intersectionCount = 0;
    leftSet.forEach((domain) => {
        if (rightSet.has(domain)) intersectionCount += 1;
    });
    return union.size > 0 ? clamp01(intersectionCount / union.size) : 1;
};

const resolveSiteSignatureShift = (leftSignature = '', rightSignature = '') => (
    round(1 - resolveSiteSignatureAffinity(leftSignature, rightSignature))
);

const resolveAdaptiveSampleWeight = (sample, {
    dateKey = '',
    siteSignature = '',
} = {}) => {
    const recencyDays = diffDateKeys(sample.dateKey, dateKey);
    const recencyWeight = Math.pow(
        0.5,
        recencyDays / ZEN_BONSAI_CULTIVATION_ADAPTIVE_BASELINE_POLICY.recencyHalfLifeDays,
    );
    const siteAffinity = resolveSiteSignatureAffinity(sample.siteSignature, siteSignature);
    const siteWeight = 0.45 + (siteAffinity * 0.55);
    return Math.max(0, recencyWeight * clamp01(sample.reliability) * siteWeight);
};

const resolveAdaptiveBaseline = ({
    baseline,
    samples,
    siteSignature,
    previousSiteSignature,
    dateKey,
    nowMs,
} = {}) => {
    const initialPriorHealthRatio = Number(baseline?.initialPriorHealthRatio);
    if (
        baseline?.status !== ZEN_BONSAI_CULTIVATION_BASELINE_STATUS.READY
        || !Number.isFinite(initialPriorHealthRatio)
    ) {
        return normalizeAdaptiveBaseline(null);
    }

    const values = Object.values(normalizeSamples(samples));
    const weighted = values.reduce((acc, sample) => {
        const weight = resolveAdaptiveSampleWeight(sample, { dateKey, siteSignature });
        if (weight <= 0) return acc;
        acc.health += clamp01(sample.healthRatio) * weight;
        acc.growth += toScore(sample.growthScore) * weight;
        acc.weight += weight;
        acc.count += 1;
        return acc;
    }, { health: 0, growth: 0, weight: 0, count: 0 });

    if (weighted.weight <= 0) {
        return normalizeAdaptiveBaseline({
            effectiveHealthRatio: initialPriorHealthRatio,
            centerHealthRatio: initialPriorHealthRatio,
            targetHealthRatio: initialPriorHealthRatio,
            rollingHealthRatio: initialPriorHealthRatio,
            rollingGrowthScore: baseline.growthScore,
            confidence: 0,
            sampleWeight: 0,
            sampleCount: 0,
            initialPriorWeight: ZEN_BONSAI_CULTIVATION_ADAPTIVE_BASELINE_POLICY.initialPriorWeight,
            improvementLift: 0,
            contextShift: resolveSiteSignatureShift(previousSiteSignature, siteSignature),
            updatedAtMs: nowMs,
        });
    }

    const rollingHealthRatio = clamp01(weighted.health / weighted.weight);
    const rollingGrowthScore = clamp(weighted.growth / weighted.weight, 0, 100);
    const contextShift = resolveSiteSignatureShift(previousSiteSignature, siteSignature);
    const initialPriorWeight = ZEN_BONSAI_CULTIVATION_ADAPTIVE_BASELINE_POLICY.initialPriorWeight
        * Math.pow(
            0.5,
            weighted.weight / ZEN_BONSAI_CULTIVATION_ADAPTIVE_BASELINE_POLICY.initialPriorHalfLifeWeight,
        )
        * (1 + contextShift * 0.65);
    const rawCenterHealthRatio = clamp01(
        (
            (initialPriorHealthRatio * initialPriorWeight)
            + (rollingHealthRatio * weighted.weight)
        ) / Math.max(0.001, initialPriorWeight + weighted.weight),
    );
    const confidence = clamp01(
        (weighted.weight / (
            ZEN_BONSAI_CULTIVATION_ADAPTIVE_BASELINE_POLICY.confidenceWeightTarget
            + initialPriorWeight
        ))
        * (1 - contextShift * 0.35),
    );
    const previousAdaptive = normalizeAdaptiveBaseline(baseline.adaptive);
    const previousCenterHealthRatio = isFiniteValue(previousAdaptive.centerHealthRatio)
        ? previousAdaptive.centerHealthRatio
        : initialPriorHealthRatio;
    const elapsedDays = previousAdaptive.updatedAtMs > 0
        ? Math.max(1, Math.min(7, Math.ceil((nowMs - previousAdaptive.updatedAtMs) / DAY_MS)))
        : 1;
    const centerStepLimit = ZEN_BONSAI_CULTIVATION_ADAPTIVE_BASELINE_POLICY.maxCenterStepPerDay
        * elapsedDays
        * (0.55 + confidence * 0.45)
        * (1 - contextShift * 0.38);
    const centerHealthRatio = clamp(
        rawCenterHealthRatio,
        previousCenterHealthRatio - centerStepLimit,
        previousCenterHealthRatio + centerStepLimit,
    );
    const aspirationBase = Math.min(
        ZEN_BONSAI_CULTIVATION_ADAPTIVE_BASELINE_POLICY.aspirationMaxLift,
        (1 - centerHealthRatio)
            * ZEN_BONSAI_CULTIVATION_ADAPTIVE_BASELINE_POLICY.aspirationLiftRatio,
    );
    const improvementLift = aspirationBase * confidence * (1 - contextShift * 0.5);
    const targetHealthRatio = clamp01(centerHealthRatio + improvementLift);

    return normalizeAdaptiveBaseline({
        effectiveHealthRatio: targetHealthRatio,
        centerHealthRatio,
        targetHealthRatio,
        rollingHealthRatio,
        rollingGrowthScore,
        confidence,
        sampleWeight: weighted.weight,
        sampleCount: weighted.count,
        initialPriorWeight,
        improvementLift,
        contextShift,
        updatedAtMs: nowMs,
    });
};

const updateBaseline = ({
    baseline,
    cultivationState,
    siteSignature,
    dateKey,
    nowMs,
} = {}) => {
    if (!cultivationState || Number(cultivationState.registeredSiteCount) <= 0) {
        return normalizeBaseline(baseline);
    }

    const normalizedSiteSignature = typeof siteSignature === 'string' ? siteSignature.trim() : '';
    const previous = normalizeBaseline(baseline);
    const nextSiteSignature = normalizedSiteSignature || previous.siteSignature;
    const activeBaseline = {
        ...previous,
        siteSignature: nextSiteSignature,
        startedAtMs: previous.startedAtMs || toTimestamp(nowMs, Date.now()),
    };

    const evidenceDays = Math.max(0, Math.floor(Number(cultivationState.evidenceDays) || 0));
    const normalizedDateKey = toDateKey(dateKey);
    const sampleHealthRatio = Number.isFinite(Number(cultivationState.rawObservedHealthRatio))
        ? cultivationState.rawObservedHealthRatio
        : cultivationState.observedHealthRatio;
    const nextSamples = normalizedDateKey && evidenceDays > 0
        ? normalizeSamples({
            ...activeBaseline.samples,
            [normalizedDateKey]: {
                dateKey: normalizedDateKey,
                healthRatio: sampleHealthRatio,
                growthScore: cultivationState.growthScore,
                evidenceDays,
                reliability: cultivationState.sampleReliability,
                siteSignature: nextSiteSignature,
                registeredSiteCount: cultivationState.registeredSiteCount,
                scoringMode: cultivationState.scoringMode,
                scoreCoverageRatio: cultivationState.scoreCoverageRatio,
                scoreDisplayReady: cultivationState.scoreDisplayReady,
                updatedAtMs: nowMs,
            },
        })
        : activeBaseline.samples;

    const nextEvidenceDays = Math.max(activeBaseline.evidenceDays || 0, evidenceDays);
    const nextBaseline = (() => {
        if (activeBaseline.status === ZEN_BONSAI_CULTIVATION_BASELINE_STATUS.READY) {
            return normalizeBaseline({
                ...activeBaseline,
                evidenceDays: nextEvidenceDays,
                samples: nextSamples,
            });
        }
        if (nextEvidenceDays >= 7) {
            const averaged = averageSamples(nextSamples);
            return normalizeBaseline({
                ...activeBaseline,
                status: ZEN_BONSAI_CULTIVATION_BASELINE_STATUS.READY,
                sealedAtMs: nowMs,
                initialPriorHealthRatio: averaged.healthRatio,
                growthScore: averaged.growthScore,
                evidenceDays: nextEvidenceDays,
                samples: nextSamples,
            });
        }

        return normalizeBaseline({
            ...activeBaseline,
            evidenceDays: nextEvidenceDays,
            samples: nextSamples,
        });
    })();

    if (nextBaseline.status === ZEN_BONSAI_CULTIVATION_BASELINE_STATUS.READY) {
        const averaged = averageSamples(nextSamples);
        return normalizeBaseline({
            ...nextBaseline,
            growthScore: nextBaseline.growthScore ?? averaged.growthScore,
            samples: nextSamples,
            adaptive: resolveAdaptiveBaseline({
                baseline: nextBaseline,
                samples: nextSamples,
                siteSignature: nextSiteSignature,
                previousSiteSignature: previous.siteSignature,
                dateKey: normalizedDateKey,
                nowMs,
            }),
        });
    }

    return nextBaseline;
};

export const resolveZenBonsaiCultivationBaseline = (ledger = null) => {
    const normalized = normalizeZenBonsaiCultivationLedger(ledger);
    const baseline = normalized.baseline;
    if (baseline.status !== ZEN_BONSAI_CULTIVATION_BASELINE_STATUS.READY) {
        return null;
    }
    const effectiveHealthRatio = isFiniteValue(baseline.adaptive.effectiveHealthRatio)
        ? baseline.adaptive.effectiveHealthRatio
        : baseline.healthRatio;
    const centerHealthRatio = isFiniteValue(baseline.adaptive.centerHealthRatio)
        ? baseline.adaptive.centerHealthRatio
        : baseline.healthRatio;
    const targetHealthRatio = isFiniteValue(baseline.adaptive.targetHealthRatio)
        ? baseline.adaptive.targetHealthRatio
        : effectiveHealthRatio;
    return Object.freeze({
        healthRatio: effectiveHealthRatio,
        effectiveHealthRatio,
        initialPriorHealthRatio: baseline.initialPriorHealthRatio,
        sealedHealthRatio: baseline.initialPriorHealthRatio,
        centerHealthRatio,
        targetHealthRatio,
        adaptiveHealthRatio: baseline.adaptive.rollingHealthRatio,
        rollingHealthRatio: baseline.adaptive.rollingHealthRatio,
        adaptiveConfidence: baseline.adaptive.confidence,
        adaptiveSampleWeight: baseline.adaptive.sampleWeight,
        adaptiveSampleCount: baseline.adaptive.sampleCount,
        initialPriorWeight: baseline.adaptive.initialPriorWeight,
        improvementLift: baseline.adaptive.improvementLift,
        contextShift: baseline.adaptive.contextShift,
        growthScore: baseline.growthScore,
        evidenceDays: baseline.evidenceDays,
        calibratedAtMs: baseline.sealedAtMs,
    });
};

export const resolveZenBonsaiCultivationVitality = (ledger = null) => {
    const normalized = normalizeZenBonsaiCultivationLedger(ledger);
    return resolveZenBonsaiVitalityPresentation(normalized.vitality);
};

export const resolveZenBonsaiStructuralImprint = (ledger = null) => {
    const normalized = normalizeZenBonsaiCultivationLedger(ledger);
    return normalizeZenBonsaiStructuralImprint(normalized.structuralImprint);
};

export const resolveZenBonsaiGrowthSegments = (ledger = null) => {
    const normalized = normalizeZenBonsaiCultivationLedger(ledger);
    return normalizeZenBonsaiGrowthSegments(normalized.growthSegments);
};

const createZenBonsaiGrowthSegmentStamp = ({
    milestone,
    structuralImprint,
    vitality,
    dateKey,
    nowMs,
} = {}) => {
    const normalizedMilestone = Math.max(0, Math.floor(Number(milestone) || 0));
    const imprint = normalizeZenBonsaiStructuralImprint(structuralImprint);
    const vitalityState = normalizeZenBonsaiVitality(vitality);
    return normalizeZenBonsaiGrowthSegment({
        schemaVersion: ZEN_BONSAI_GROWTH_SEGMENT_POLICY.schemaVersion,
        id: `m${normalizedMilestone}`,
        milestone: normalizedMilestone,
        growthScore: normalizedMilestone * ZEN_BONSAI_GROWTH_POLICY.milestoneStep,
        dateKey,
        exposureQuality: imprint.exposureQuality,
        stressWood: imprint.stressWood,
        recoveryWood: imprint.recoveryWood,
        volatility: imprint.volatility,
        canopyReserve: imprint.canopyReserve,
        healthH: vitalityState.healthH,
        vitalityTier: vitalityState.tier,
        createdAtMs: nowMs,
    });
};

const updateGrowthSegments = ({
    growthSegments,
    vitality,
    structuralImprint,
    dateKey,
    nowMs,
} = {}) => {
    const current = normalizeZenBonsaiGrowthSegments(growthSegments);
    const vitalityState = normalizeZenBonsaiVitality(vitality);
    const nextMilestone = Math.min(
        ZEN_BONSAI_GROWTH_SEGMENT_POLICY.maxSegments,
        Math.max(0, Math.floor(Number(vitalityState.lastMilestone) || 0)),
    );
    if (nextMilestone <= 0) {
        return current;
    }
    const existing = new Set(current.map((segment) => segment.milestone));
    const additions = [];
    for (let milestone = 1; milestone <= nextMilestone; milestone += 1) {
        if (!existing.has(milestone)) {
            additions.push(createZenBonsaiGrowthSegmentStamp({
                milestone,
                structuralImprint,
                vitality: vitalityState,
                dateKey: vitalityState.milestoneEventDateKey || dateKey,
                nowMs,
            }));
        }
    }
    if (!additions.length) {
        return current;
    }
    return normalizeZenBonsaiGrowthSegments([...current, ...additions]);
};

const capValue = (anchor, target, upCap, downCap, elapsedDays) => {
    const safeAnchor = clamp(anchor, 0, 1);
    const safeTarget = clamp(target, 0, 1);
    const days = Math.max(1, Math.min(MAX_CAP_CATCHUP_DAYS, Math.floor(Number(elapsedDays) || 1)));
    if (safeTarget >= safeAnchor) {
        return round(Math.min(safeTarget, safeAnchor + (upCap * days)));
    }
    return round(Math.max(safeTarget, safeAnchor - (downCap * days)));
};

const resolveCappedPhase = (rawLifeState, cappedLifeState) => {
    if (rawLifeState.phase === 'seedling' && cappedLifeState.growth <= 0.42) {
        return 'seedling';
    }
    if (rawLifeState.phase === 'mature' && cappedLifeState.growth >= 0.82) {
        return 'mature';
    }
    if (cappedLifeState.growth <= 0.38 && cappedLifeState.bloom <= 0.04) {
        return 'seedling';
    }
    return 'juvenile';
};

export const applyZenBonsaiDailyLifeStateCap = ({
    anchorLifeState = null,
    targetLifeState = null,
    elapsedDays = 1,
    caps = ZEN_BONSAI_CULTIVATION_DAILY_CAPS,
} = {}) => {
    const target = normalizeZenBonsaiLifeState(targetLifeState);
    if (!anchorLifeState) {
        return target;
    }
    const anchor = normalizeZenBonsaiLifeState(anchorLifeState);
    const capped = normalizeZenBonsaiLifeState({
        ...target,
        growth: capValue(anchor.growth, target.growth, caps.growthUp, caps.growthDown, elapsedDays),
        vitality: capValue(anchor.vitality, target.vitality, caps.vitalityUp, caps.vitalityDown, elapsedDays),
        stress: capValue(anchor.stress, target.stress, caps.stressUp, caps.stressDown, elapsedDays),
        bloom: capValue(anchor.bloom, target.bloom, caps.bloomUp, caps.bloomDown, elapsedDays),
        dryness: capValue(anchor.dryness, target.dryness, caps.drynessUp, caps.drynessDown, elapsedDays),
        branchSag: capValue(anchor.branchSag, target.branchSag, caps.branchSagUp, caps.branchSagDown, elapsedDays),
        windResponse: capValue(
            anchor.windResponse,
            target.windResponse,
            caps.windResponseUp,
            caps.windResponseDown,
            elapsedDays,
        ),
    });
    return normalizeZenBonsaiLifeState({
        ...capped,
        phase: resolveCappedPhase(target, capped),
        dataDays: target.dataDays,
        analysisConfidence: target.analysisConfidence,
    });
};

const updateDailyCap = ({
    dailyCap,
    targetLifeState,
    dateKey,
    structuralGrowthAuthoritative = false,
} = {}) => {
    const previous = normalizeDailyCap(dailyCap);
    const normalizedDateKey = toDateKey(dateKey);
    const target = normalizeZenBonsaiLifeState(targetLifeState);
    if (!normalizedDateKey) {
        return {
            dailyCap: previous,
            cappedLifeState: target,
        };
    }
    if (!previous.dateKey || !previous.lastCappedLifeState) {
        const nextDailyCap = normalizeDailyCap({
            dateKey: normalizedDateKey,
            anchorLifeState: target,
            lastCappedLifeState: target,
        });
        return {
            dailyCap: nextDailyCap,
            cappedLifeState: target,
        };
    }

    const dateChanged = previous.dateKey !== normalizedDateKey;
    const elapsedDays = dateChanged
        ? Math.max(1, diffDateKeys(previous.dateKey, normalizedDateKey))
        : 1;
    const anchorLifeState = dateChanged
        ? previous.lastCappedLifeState
        : previous.anchorLifeState;
    const dailyCappedLifeState = applyZenBonsaiDailyLifeStateCap({
        anchorLifeState,
        targetLifeState: target,
        elapsedDays,
    });
    const cappedLifeState = structuralGrowthAuthoritative
        ? normalizeZenBonsaiLifeState({
            ...dailyCappedLifeState,
            phase: target.phase,
            growth: target.growth,
            dataDays: target.dataDays,
            analysisConfidence: target.analysisConfidence,
        })
        : dailyCappedLifeState;
    const nextDailyCap = normalizeDailyCap({
        dateKey: normalizedDateKey,
        anchorLifeState,
        lastCappedLifeState: cappedLifeState,
    });
    return {
        dailyCap: nextDailyCap,
        cappedLifeState,
    };
};

const updateVitality = ({
    vitality,
    cultivationState,
    dailyOutcome,
    dateKey,
    nowMs,
} = {}) => {
    // The vitality integrator only runs once cultivation is past calibration:
    // during CALIBRATING the health stays locked at its neutral seed (spec §2).
    if (!cultivationState || cultivationState.stage !== ZEN_BONSAI_CULTIVATION_STAGES.CULTIVATING) {
        return normalizeZenBonsaiVitality(vitality);
    }
    return reconcileZenBonsaiVitality({
        vitality,
        dateKey,
        dailyOutcome,
        initialGrowthScore: cultivationState.growthScore,
        nowMs,
    });
};

const ewma = (current, target, halfLifeDays) => {
    const days = Math.max(1, Number(halfLifeDays) || 1);
    const gain = 1 - Math.pow(0.5, 1 / days);
    return round(clamp01(current + ((target - current) * gain)));
};

export const advanceZenBonsaiStructuralImprintDay = (
    structuralImprint,
    { outcome = null, dateKey = '' } = {},
) => {
    const current = normalizeZenBonsaiStructuralImprint(structuralImprint);
    const closedOutcome = normalizeStructuralOutcome(outcome, { dateKey });
    const meaningfulExposure = closedOutcome?.available === true && closedOutcome.engaged === true;
    const hasEngagedOutcome = meaningfulExposure && Number.isFinite(Number(closedOutcome?.outcome));
    const d = hasEngagedOutcome ? clamp(closedOutcome.outcome, -1, 1) : 0;
    const practice = meaningfulExposure ? clamp01(closedOutcome?.practice) : 0;
    const strainPulse = hasEngagedOutcome ? Math.max(0, -d) : 0;
    const practicePulse = hasEngagedOutcome
        ? Math.max(0, d) * (0.5 + (0.5 * practice))
        : 0;
    const previousEngagedD = Number(current.lastEngagedOutcome?.outcome);
    const hasPreviousEngagedOutcome = Number.isFinite(previousEngagedD);
    const recoveryPulse = hasEngagedOutcome
        && hasPreviousEngagedOutcome
        && previousEngagedD < 0
        && d > 0
        ? practicePulse
        : 0;
    const volatilityPulse = hasEngagedOutcome && hasPreviousEngagedOutcome
        ? clamp01(Math.abs(d - previousEngagedD) / 2)
        : 0;
    const policy = ZEN_BONSAI_STRUCTURAL_IMPRINT_POLICY;
    const normalizedDateKey = toDateKey(dateKey);

    return normalizeZenBonsaiStructuralImprint({
        ...current,
        exposureQuality: ewma(current.exposureQuality, meaningfulExposure ? 1 : 0, policy.exposureHalfLifeDays),
        stressWood: ewma(current.stressWood, strainPulse, policy.stressHalfLifeDays),
        recoveryWood: ewma(current.recoveryWood, recoveryPulse, policy.recoveryHalfLifeDays),
        volatility: ewma(current.volatility, volatilityPulse, policy.volatilityHalfLifeDays),
        canopyReserve: round(clamp01(
            current.canopyReserve
            + (policy.canopyPracticeGain * practicePulse)
            - (policy.canopyStrainLoss * strainPulse)
            + (policy.canopyRecoveryGain * recoveryPulse),
        )),
        lastUpdatedDateKey: normalizedDateKey || current.lastUpdatedDateKey,
        lastEngagedOutcome: hasEngagedOutcome
            ? normalizeStructuralOutcome(closedOutcome, { dateKey: normalizedDateKey })
            : current.lastEngagedOutcome,
    });
};

const updateStructuralImprint = ({
    structuralImprint,
    cultivationState,
    dailyOutcome,
    dateKey,
    nowMs,
} = {}) => {
    let state = normalizeZenBonsaiStructuralImprint(structuralImprint);
    const todayKey = toDateKey(dateKey);
    if (!todayKey) {
        return state;
    }

    const evidenceDays = Math.max(0, Math.floor(Number(cultivationState?.evidenceDays) || 0));
    const canStampStructure = cultivationState?.stage === ZEN_BONSAI_CULTIVATION_STAGES.CULTIVATING
        && evidenceDays > 7;
    if (!canStampStructure) {
        return normalizeZenBonsaiStructuralImprint({
            ...state,
            updatedAtMs: toTimestamp(nowMs, Date.now()),
        });
    }

    if (state.pendingDateKey && diffDateKeys(state.pendingDateKey, todayKey) > 0) {
        const gapDays = diffDateKeys(state.pendingDateKey, todayKey);
        const pendingDateKey = state.pendingDateKey;
        state = advanceZenBonsaiStructuralImprintDay(state, {
            outcome: state.pendingOutcome,
            dateKey: pendingDateKey,
        });
        const missedDays = Math.min(
            Math.max(0, gapDays - 1),
            ZEN_BONSAI_STRUCTURAL_IMPRINT_POLICY.maxCatchUpDays,
        );
        for (let missed = 1; missed <= missedDays; missed += 1) {
            state = advanceZenBonsaiStructuralImprintDay(state, {
                outcome: null,
                dateKey: addDateKeyDays(pendingDateKey, missed),
            });
        }
    }

    return normalizeZenBonsaiStructuralImprint({
        ...state,
        pendingDateKey: todayKey,
        pendingOutcome: normalizeStructuralOutcome(dailyOutcome, { dateKey: todayKey }),
        updatedAtMs: toTimestamp(nowMs, Date.now()),
    });
};

export const reconcileZenBonsaiCultivationLedger = ({
    previousLedger = null,
    cultivationState = null,
    targetLifeState = null,
    siteSignature = '',
    dailyOutcome = null,
    nowMs = Date.now(),
    dateKey = resolveZenBonsaiCultivationDateKey(nowMs),
} = {}) => {
    const current = normalizeZenBonsaiCultivationLedger(previousLedger, { nowMs });
    const timestamp = toTimestamp(nowMs, Date.now());
    const baseline = updateBaseline({
        baseline: current.baseline,
        cultivationState,
        siteSignature,
        dateKey,
        nowMs: timestamp,
    });
    const vitality = updateVitality({
        vitality: current.vitality,
        cultivationState,
        dailyOutcome,
        dateKey,
        nowMs: timestamp,
    });
    const structuralImprint = updateStructuralImprint({
        structuralImprint: current.structuralImprint,
        cultivationState,
        dailyOutcome,
        dateKey,
        nowMs: timestamp,
    });
    const growthSegments = updateGrowthSegments({
        growthSegments: current.growthSegments,
        vitality,
        structuralImprint,
        dateKey,
        nowMs: timestamp,
    });
    const {
        dailyCap,
        cappedLifeState,
    } = updateDailyCap({
        dailyCap: current.dailyCap,
        targetLifeState,
        dateKey,
        structuralGrowthAuthoritative: cultivationState?.releaseDriven === true,
    });

    return Object.freeze({
        ledger: Object.freeze({
            ...current,
            updatedAtMs: timestamp,
            baseline,
            dailyCap,
            vitality,
            structuralImprint,
            growthSegments,
        }),
        cappedLifeState,
        baseline: resolveZenBonsaiCultivationBaseline({
            ...current,
            baseline,
            dailyCap,
            vitality,
            structuralImprint,
            growthSegments,
        }),
        vitality: resolveZenBonsaiVitalityPresentation(vitality),
        structuralImprint: resolveZenBonsaiStructuralImprint({
            ...current,
            baseline,
            dailyCap,
            vitality,
            structuralImprint,
            growthSegments,
        }),
        growthSegments: resolveZenBonsaiGrowthSegments({
            ...current,
            baseline,
            dailyCap,
            vitality,
            structuralImprint,
            growthSegments,
        }),
    });
};

export default reconcileZenBonsaiCultivationLedger;
