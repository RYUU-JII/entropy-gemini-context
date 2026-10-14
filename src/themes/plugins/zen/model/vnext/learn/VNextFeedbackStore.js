import {
    createZenThemeModelStateAdapter,
} from '@/themes/plugins/zen/state/ZenThemeModelState.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clamp01 = (value) => clamp(Number.isFinite(Number(value)) ? Number(value) : 0, 0, 1);
const toNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const round = (value, digits = 6) => Number((Number.isFinite(value) ? value : 0).toFixed(digits));

const MAX_VNEXT_TRIAL_RECORDS = 1600;
const DEFAULT_VNEXT_RELIABILITY = 0.24;
const DEFAULT_VOLUME_TARGET = 120;
const DAY_MS = 24 * 60 * 60 * 1000;

export const ZEN_VNEXT_AB_TRIALS_STORAGE_KEY = 'zen_vnext_ab_trials_v1';
export const ZEN_VNEXT_RELIABILITY_STORAGE_KEY = 'zen_vnext_reliability_state_v1';

const isPlainObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const hasFiniteNumericValue = (value) => (
    value !== null
    && value !== undefined
    && value !== ''
    && Number.isFinite(Number(value))
);

const toObject = (value) => (isPlainObject(value) ? value : {});
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

const sortedObjectEntries = (value = {}) => (
    Object.entries(toObject(value))
        .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
);

const normalizeCandidateSnapshot = (candidate = {}) => {
    const safe = toObject(candidate);
    const seed = hasFiniteNumericValue(safe.seed) ? Number(safe.seed) : null;
    const factorsRaw = toObject(safe.factors);
    const factors = sortedObjectEntries(factorsRaw).reduce((acc, [key, value]) => {
        acc[String(key)] = round(toNumber(value, 0), 6);
        return acc;
    }, {});
    return {
        seed: seed === null ? null : Math.floor(seed),
        factors,
    };
};

const serializeCandidateSnapshot = (snapshot = {}) => {
    const safe = normalizeCandidateSnapshot(snapshot);
    const factorToken = Object.entries(safe.factors)
        .map(([key, value]) => `${key}:${round(value, 4).toFixed(4)}`)
        .join(',');
    return `${safe.seed ?? 'null'}|${factorToken}`;
};

const resolvePairKey = (candidateA = {}, candidateB = {}) => {
    const left = serializeCandidateSnapshot(candidateA);
    const right = serializeCandidateSnapshot(candidateB);
    return [left, right].sort().join('::');
};

const normalizeContext = (context = {}) => {
    const safe = toObject(context);
    const roundId = hasFiniteNumericValue(safe.roundId)
        ? Math.max(1, Math.floor(Number(safe.roundId)))
        : null;
    const preparedAt = hasFiniteNumericValue(safe.preparedAt)
        ? Math.max(0, Math.floor(Number(safe.preparedAt)))
        : null;
    const reliabilityAtPrepare = hasFiniteNumericValue(safe.reliabilityAtPrepare)
        ? clamp01(Number(safe.reliabilityAtPrepare))
        : null;
    const modelSampleCountAtPrepare = hasFiniteNumericValue(safe.modelSampleCountAtPrepare)
        ? Math.max(0, Math.floor(Number(safe.modelSampleCountAtPrepare)))
        : null;
    const modelAccuracyAtPrepare = hasFiniteNumericValue(safe.modelAccuracyAtPrepare)
        ? clamp01(Number(safe.modelAccuracyAtPrepare))
        : null;
    return {
        mode: typeof safe.mode === 'string' ? safe.mode : 'vnext',
        presetId: typeof safe.presetId === 'string' ? safe.presetId : null,
        stage: typeof safe.stage === 'string' ? safe.stage : null,
        seed: hasFiniteNumericValue(safe.seed) ? Math.floor(Number(safe.seed)) : null,
        loopMode: safe.loopMode === 'auto' ? 'auto' : 'manual',
        episodeId: typeof safe.episodeId === 'string' && safe.episodeId.trim()
            ? safe.episodeId.trim()
            : null,
        roundId,
        preparedAt,
        reliabilityAtPrepare,
        modelSampleCountAtPrepare,
        modelAccuracyAtPrepare,
    };
};

const normalizeChoice = (value) => {
    const raw = String(value || 'A').trim().toUpperCase();
    return raw === 'B' ? 'B' : 'A';
};

const normalizeTrialRecord = (trial = {}) => {
    const safe = toObject(trial);
    const candidateA = normalizeCandidateSnapshot(safe.candidateA);
    const candidateB = normalizeCandidateSnapshot(safe.candidateB);
    const createdAt = Math.max(0, Math.floor(toNumber(safe.createdAt, Date.now())));
    const id = typeof safe.id === 'string' && safe.id.trim()
        ? safe.id.trim()
        : `vnext_trial_${createdAt}_${Math.floor(Math.random() * 1e6)}`;
    return {
        id,
        createdAt,
        chosen: normalizeChoice(safe.chosen),
        pairKey: typeof safe.pairKey === 'string' && safe.pairKey.trim()
            ? safe.pairKey.trim()
            : resolvePairKey(candidateA, candidateB),
        candidateA,
        candidateB,
        context: normalizeContext(safe.context),
    };
};

const normalizeTrialList = (value = []) => (
    (Array.isArray(value) ? value : [])
        .map((entry) => normalizeTrialRecord(entry))
        .sort((a, b) => Number(a.createdAt) - Number(b.createdAt))
);

const createModelStateAdapter = ({
    adapter = null,
    zenThemeModelState = null,
    modelStateStore = null,
} = {}) => {
    if (
        adapter
        && typeof adapter.get === 'function'
        && typeof adapter.getForBootstrap === 'function'
        && typeof adapter.set === 'function'
    ) {
        return adapter;
    }
    if (adapter) {
        throw new Error('ZEN_VNEXT_FEEDBACK_BOOTSTRAP_READER_REQUIRED');
    }
    return createZenThemeModelStateAdapter({
        zenThemeModelState,
        modelStateStore,
    });
};

export const createVNextABTrialRecord = ({
    candidateA = {},
    candidateB = {},
    chosen = 'A',
    context = {},
    createdAt = Date.now(),
    id = null,
} = {}) => normalizeTrialRecord({
    id,
    createdAt,
    chosen,
    pairKey: resolvePairKey(candidateA, candidateB),
    candidateA,
    candidateB,
    context,
});

export const estimateVNextReliabilityFromTrials = (trials = [], {
    nowMs = Date.now(),
    volumeTarget = DEFAULT_VOLUME_TARGET,
} = {}) => {
    const normalized = normalizeTrialList(trials);
    const sampleCount = normalized.length;
    if (!sampleCount) {
        return {
            value: DEFAULT_VNEXT_RELIABILITY,
            sampleCount: 0,
            pairCount: 0,
            repeatPairCount: 0,
            consistency: 0.5,
            volumeScore: 0,
            freshness: 0,
            updatedAt: Math.max(0, Math.floor(toNumber(nowMs, Date.now()))),
        };
    }

    const groupByPair = new Map();
    normalized.forEach((entry) => {
        const key = entry.pairKey || '';
        if (!groupByPair.has(key)) {
            groupByPair.set(key, []);
        }
        groupByPair.get(key).push(entry);
    });

    const groupList = [...groupByPair.values()];
    const repeatGroups = groupList.filter((group) => group.length >= 2);
    const consistency = repeatGroups.length
        ? repeatGroups.reduce((acc, group) => {
            const a = group.filter((entry) => entry.chosen === 'A').length;
            const b = group.length - a;
            return acc + (Math.max(a, b) / Math.max(1, group.length));
        }, 0) / repeatGroups.length
        : 0.5;
    const repeatCoverage = groupList.length ? (repeatGroups.length / groupList.length) : 0;
    const consistencyScore = clamp01((consistency * 0.8) + (repeatCoverage * 0.2));

    const volumeScore = clamp01(
        Math.log1p(sampleCount) / Math.log1p(Math.max(8, Math.floor(toNumber(volumeTarget, DEFAULT_VOLUME_TARGET)))),
    );
    const latestTimestamp = normalized.reduce((acc, entry) => (
        Math.max(acc, Math.floor(toNumber(entry.createdAt, 0)))
    ), 0);
    const ageDays = Math.max(0, (Math.floor(toNumber(nowMs, Date.now())) - latestTimestamp) / DAY_MS);
    const freshness = clamp01(1 - (ageDays / 30));

    const value = clamp01(
        (volumeScore * 0.7)
        + (consistencyScore * 0.25)
        + (freshness * 0.05),
    );
    return {
        value: round(value, 6),
        sampleCount,
        pairCount: groupList.length,
        repeatPairCount: repeatGroups.length,
        consistency: round(consistencyScore, 6),
        volumeScore: round(volumeScore, 6),
        freshness: round(freshness, 6),
        updatedAt: latestTimestamp || Math.max(0, Math.floor(toNumber(nowMs, Date.now()))),
    };
};

export class VNextFeedbackStore {
    constructor({
        adapter = null,
        zenThemeModelState = null,
        modelStateStore = null,
        maxTrialRecords = MAX_VNEXT_TRIAL_RECORDS,
    } = {}) {
        this.adapter = createModelStateAdapter({
            adapter,
            zenThemeModelState,
            modelStateStore,
        });
        this.maxTrialRecords = Math.max(40, Math.floor(toNumber(maxTrialRecords, MAX_VNEXT_TRIAL_RECORDS)));
    }

    async listTrials() {
        const raw = await this.adapter.getForBootstrap(ZEN_VNEXT_AB_TRIALS_STORAGE_KEY);
        if (raw === null) {
            await this.adapter.set(ZEN_VNEXT_AB_TRIALS_STORAGE_KEY, []);
            return [];
        }
        const normalized = normalizeTrialList(raw);
        if (!isDeepCanonicalEqual(raw, normalized)) {
            throw new Error('ZEN_VNEXT_AB_TRIALS_STATE_INVALID');
        }
        return normalized;
    }

    async getReliabilityState() {
        const raw = await this.adapter.getForBootstrap(ZEN_VNEXT_RELIABILITY_STORAGE_KEY);
        if (raw === null) {
            const trials = await this.listTrials();
            const initial = estimateVNextReliabilityFromTrials(trials, {
                nowMs: Date.now(),
            });
            await this.adapter.set(ZEN_VNEXT_RELIABILITY_STORAGE_KEY, initial);
            return initial;
        }
        if (!isPlainObject(raw)) throw new Error('ZEN_VNEXT_RELIABILITY_STATE_INVALID');
        const normalized = {
            value: clamp01(raw.value),
            sampleCount: Math.max(0, Math.floor(toNumber(raw.sampleCount, 0))),
            pairCount: Math.max(0, Math.floor(toNumber(raw.pairCount, 0))),
            repeatPairCount: Math.max(0, Math.floor(toNumber(raw.repeatPairCount, 0))),
            consistency: clamp01(raw.consistency),
            volumeScore: clamp01(raw.volumeScore),
            freshness: clamp01(raw.freshness),
            updatedAt: Math.max(0, Math.floor(toNumber(raw.updatedAt, Date.now()))),
        };
        if (!isDeepCanonicalEqual(raw, normalized)) {
            throw new Error('ZEN_VNEXT_RELIABILITY_STATE_INVALID');
        }
        return normalized;
    }

    async appendTrial(input = {}) {
        const record = normalizeTrialRecord(input);
        const current = await this.listTrials();
        current.push(record);
        const trimmed = current.slice(-this.maxTrialRecords);
        await this.adapter.set(ZEN_VNEXT_AB_TRIALS_STORAGE_KEY, trimmed);
        const reliability = estimateVNextReliabilityFromTrials(trimmed, {
            nowMs: Date.now(),
        });
        await this.adapter.set(ZEN_VNEXT_RELIABILITY_STORAGE_KEY, reliability);
        return {
            trial: record,
            trialCount: trimmed.length,
            reliability,
        };
    }

    async replaceTrials(trials = []) {
        const normalized = normalizeTrialList(trials);
        const trimmed = normalized.slice(-this.maxTrialRecords);
        await this.adapter.set(ZEN_VNEXT_AB_TRIALS_STORAGE_KEY, trimmed);
        const reliability = estimateVNextReliabilityFromTrials(trimmed, {
            nowMs: Date.now(),
        });
        await this.adapter.set(ZEN_VNEXT_RELIABILITY_STORAGE_KEY, reliability);
        return {
            trials: trimmed,
            trialCount: trimmed.length,
            reliability,
        };
    }

    async recomputeReliability() {
        const trials = await this.listTrials();
        const reliability = estimateVNextReliabilityFromTrials(trials, {
            nowMs: Date.now(),
        });
        await this.adapter.set(ZEN_VNEXT_RELIABILITY_STORAGE_KEY, reliability);
        return reliability;
    }

    async clearAll() {
        await this.adapter.set(ZEN_VNEXT_AB_TRIALS_STORAGE_KEY, []);
        const reliability = estimateVNextReliabilityFromTrials([], {
            nowMs: Date.now(),
        });
        await this.adapter.set(ZEN_VNEXT_RELIABILITY_STORAGE_KEY, reliability);
        return reliability;
    }

    async exportSnapshot() {
        const trials = await this.listTrials();
        const reliability = await this.getReliabilityState();
        return {
            trials,
            reliability,
        };
    }
}

export const createVNextFeedbackStore = (options = {}) => new VNextFeedbackStore(options);
