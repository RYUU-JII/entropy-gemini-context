const clampNumber = (value, min, max, fallback = min) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
};

const roundNumber = (value, digits = 4, fallback = 0) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Number(numeric.toFixed(digits));
};

const toInteger = (value, fallback = 0) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(0, Math.floor(numeric));
};

const clamp01 = (value, fallback = 0) => clampNumber(value, 0, 1, fallback);

const smoothstep01 = (value) => {
    const t = clamp01(value);
    return t * t * (3 - (2 * t));
};

const smoothstepRange = (value, min, max) => {
    const span = Math.max(0.0001, Number(max) - Number(min));
    return smoothstep01((Number(value) - Number(min)) / span);
};

const mergeWithLifeCeiling = ({
    analysisValue = 0,
    lifeValue = 0,
    ceiling = 1,
} = {}) => {
    const life = clamp01(lifeValue);
    const cap = clamp01(Math.max(life, ceiling));
    return clamp01(Math.max(life, Math.min(clamp01(analysisValue), cap)));
};

const normalizeLifeState = (lifeState = null) => {
    if (!lifeState || typeof lifeState !== 'object') {
        return null;
    }
    const phase = typeof lifeState.phase === 'string' && lifeState.phase.trim()
        ? lifeState.phase.trim()
        : 'seedling';
    const vitality = clamp01(lifeState.vitality, 0.78);
    return {
        phase,
        growth: clamp01(lifeState.growth, phase === 'mature' ? 1 : 0.3),
        vitality,
        bloom: clamp01(lifeState.bloom, phase === 'mature' ? vitality : 0),
        dryness: clamp01(lifeState.dryness, 0),
        windResponse: clamp01(lifeState.windResponse, vitality),
        analysisConfidence: clamp01(lifeState.analysisConfidence, 0),
    };
};

const resolveLifeStageId = ({
    phase,
    budSignal,
    bloomCurve,
} = {}) => {
    if (bloomCurve >= 0.72) return 'full_bloom';
    if (bloomCurve >= 0.36 || budSignal >= 0.62) return 'pre_bloom';
    if (phase === 'juvenile') return 'juvenile_buds';
    if (phase === 'mature') return 'pre_bloom';
    return 'seedling_sprout';
};

export const normalizeZenBonsaiPondBioticSignal = (candidate = null) => {
    if (!candidate || typeof candidate !== 'object') {
        return null;
    }

    const updatedAtMs = Number(candidate.updatedAtMs ?? Date.now());
    return {
        engine: typeof candidate.engine === 'string' && candidate.engine.trim()
            ? candidate.engine.trim()
            : 'unknown',
        source: typeof candidate.source === 'string' && candidate.source.trim()
            ? candidate.source.trim()
            : 'unknown',
        stageId: typeof candidate.stageId === 'string' && candidate.stageId.trim()
            ? candidate.stageId.trim()
            : 'bloom',
        flowerCount: toInteger(candidate.flowers ?? candidate.flowerCount, 0),
        leafCount: toInteger(candidate.leaves ?? candidate.leafCount, 0),
        bloomRatio: roundNumber(clampNumber(candidate.bloomRatio, 0, 1, 0), 4, 0),
        canopyDensity: roundNumber(clampNumber(candidate.canopyDensity, 0, 1, 0.5), 4, 0.5),
        petalCapacity: roundNumber(clampNumber(candidate.petalCapacity, 0, 1, 0), 4, 0),
        petalFallLimit: roundNumber(clampNumber(candidate.petalFallLimit, 0, 1, 0), 4, 0),
        leafBudSignal: roundNumber(clampNumber(candidate.leafBudSignal, 0, 1, 0), 4, 0),
        budSignal: roundNumber(clampNumber(candidate.budSignal, 0, 1, 0), 4, 0),
        previewPetalRate: roundNumber(clampNumber(candidate.previewPetalRate, 0, 1, 0), 4, 0),
        rippleVitality: roundNumber(clampNumber(candidate.rippleVitality, 0, 1, 0), 4, 0),
        seasonSpanDays: Math.max(1, Math.min(14, Math.floor(Number(candidate.seasonSpanDays) || 7))),
        updatedAtMs: Number.isFinite(updatedAtMs) ? Math.floor(updatedAtMs) : Date.now(),
    };
};

export const buildZenBonsaiPondBioticSignalSignature = (candidate = null) => {
    const signal = normalizeZenBonsaiPondBioticSignal(candidate);
    if (!signal) {
        return 'zen_bonsai_pond_biotic_signal:none';
    }
    return [
        signal.engine,
        signal.source,
        signal.stageId,
        signal.flowerCount,
        signal.leafCount,
        signal.bloomRatio,
        signal.canopyDensity,
        signal.petalCapacity,
        signal.petalFallLimit,
        signal.leafBudSignal,
        signal.budSignal,
        signal.previewPetalRate,
        signal.rippleVitality,
        signal.seasonSpanDays,
    ].join('|');
};

export const deriveZenBonsaiPondBioticSignalFromAnalysis = ({
    analysis = null,
    source = 'unknown',
    engine = 'unknown',
    stageId = 'bloom',
    seasonSpanDays = 7,
} = {}) => {
    if (!analysis || typeof analysis !== 'object') {
        return null;
    }

    const flowerCount = toInteger(analysis?.density?.flowers, 0);
    const leafCount = toInteger(analysis?.density?.leaves, 0);
    const foliageCount = Math.max(1, flowerCount + leafCount);
    const bloomRatio = clampNumber(
        analysis?.factors?.bloomRatio ?? (flowerCount / foliageCount),
        0,
        1,
        0,
    );
    const canopyDensity = clampNumber(analysis?.density?.ratio, 0, 1, 0.5);
    const flowerMass = clampNumber(flowerCount / 84, 0, 1, 0);
    const blossomPresence = clampNumber(
        (bloomRatio * 0.68)
        + (flowerMass * 0.24)
        + (canopyDensity * 0.08),
        0,
        1,
        0,
    );
    const petalCapacity = clampNumber(
        blossomPresence * (0.82 + canopyDensity * 0.18),
        0,
        1,
        0,
    );
    const petalFallLimit = clampNumber(
        petalCapacity * (0.78 + bloomRatio * 0.22),
        0,
        1,
        0,
    );

    return normalizeZenBonsaiPondBioticSignal({
        engine,
        source,
        stageId,
        flowers: flowerCount,
        leaves: leafCount,
        bloomRatio,
        canopyDensity,
        petalCapacity,
        petalFallLimit,
        seasonSpanDays,
        updatedAtMs: Date.now(),
    });
};

export const deriveZenBonsaiPondBioticSignalFromLifeState = ({
    lifeState = null,
    source = 'zen_bonsai_life_state',
    engine = 'life',
    seasonSpanDays = 7,
} = {}) => {
    const state = normalizeLifeState(lifeState);
    if (!state) {
        return null;
    }

    const growthCurve = smoothstep01(state.growth);
    const leafBudSignal = clamp01(
        smoothstepRange(state.growth, 0.24, 0.56)
        * (0.42 + state.vitality * 0.58)
        * (1 - state.dryness * 0.28),
    );
    const budSignal = clamp01(
        smoothstepRange(state.growth, 0.42, 0.82)
        * (0.34 + state.vitality * 0.66)
        * (1 - state.dryness * 0.42),
    );
    const bloomCurve = clamp01(
        smoothstep01(state.bloom)
        * (0.5 + state.vitality * 0.5)
        * (1 - state.dryness * 0.5),
    );
    const previewPetalRate = clampNumber(
        (smoothstepRange(state.growth, 0.26, 0.48) * 0.026)
        + (smoothstepRange(state.growth, 0.5, 0.78) * 0.026)
        + (budSignal * 0.068)
        + (state.phase === 'seedling'
            ? smoothstepRange(state.growth, 0.32, 0.62) * 0.008
            : 0.014),
        0,
        0.12,
        0,
    );
    const bloomPetalCapacity = clamp01(
        bloomCurve * (0.38 + state.vitality * 0.42 + growthCurve * 0.2),
    );
    const petalCapacity = clamp01(Math.max(
        previewPetalRate,
        bloomPetalCapacity,
    ));
    const petalFallLimit = clamp01(Math.max(
        previewPetalRate * (0.72 + state.windResponse * 0.32),
        bloomPetalCapacity * (0.54 + state.windResponse * 0.36),
    ));
    const bloomRatio = clamp01(Math.max(
        budSignal * 0.16,
        bloomCurve * (0.48 + state.vitality * 0.32),
    ));
    const canopyDensity = clamp01(
        0.2
        + (leafBudSignal * 0.32)
        + (budSignal * 0.18)
        + (bloomCurve * 0.24)
        + (state.growth * 0.18)
        - (state.dryness * 0.16),
    );
    const rippleVitality = clamp01(
        0.08
        + (leafBudSignal * 0.24)
        + (budSignal * 0.2)
        + (bloomCurve * 0.22)
        + (state.vitality * 0.12)
        - (state.dryness * 0.12),
    );

    return normalizeZenBonsaiPondBioticSignal({
        engine,
        source,
        stageId: resolveLifeStageId({
            phase: state.phase,
            budSignal,
            bloomCurve,
        }),
        flowers: Math.round((budSignal * 10) + (bloomCurve * 76)),
        leaves: Math.round(4 + (leafBudSignal * 28) + (state.growth * 18)),
        bloomRatio,
        canopyDensity,
        petalCapacity,
        petalFallLimit,
        leafBudSignal,
        budSignal,
        previewPetalRate,
        rippleVitality,
        seasonSpanDays,
        updatedAtMs: Date.now(),
    });
};

export const mergeZenBonsaiPondBioticSignals = ({
    analysisSignal = null,
    lifeSignal = null,
    source = 'zen_bonsai_pond_biotic',
    engine = 'combined',
} = {}) => {
    const analysis = normalizeZenBonsaiPondBioticSignal(analysisSignal);
    const life = normalizeZenBonsaiPondBioticSignal(lifeSignal);
    if (!analysis && !life) {
        return null;
    }
    if (!analysis) {
        return life;
    }
    if (!life) {
        return analysis;
    }

    const lifePetalCeiling = clamp01(
        life.petalCapacity
        + 0.055
        + life.previewPetalRate * 0.58
        + life.budSignal * 0.08
        + life.bloomRatio * 0.08,
    );
    const lifeFallCeiling = clamp01(
        life.petalFallLimit
        + 0.045
        + life.previewPetalRate * 0.42
        + life.budSignal * 0.07
        + life.bloomRatio * 0.06,
    );
    const lifeBloomCeiling = clamp01(
        life.bloomRatio
        + 0.04
        + life.budSignal * 0.12
        + life.previewPetalRate * 0.2,
    );

    return normalizeZenBonsaiPondBioticSignal({
        engine,
        source,
        stageId: life.stageId,
        flowerCount: Math.max(analysis.flowerCount, life.flowerCount),
        leafCount: Math.max(analysis.leafCount, life.leafCount),
        bloomRatio: mergeWithLifeCeiling({
            analysisValue: analysis.bloomRatio,
            lifeValue: life.bloomRatio,
            ceiling: lifeBloomCeiling,
        }),
        canopyDensity: Math.max(analysis.canopyDensity, life.canopyDensity),
        petalCapacity: mergeWithLifeCeiling({
            analysisValue: analysis.petalCapacity,
            lifeValue: life.petalCapacity,
            ceiling: lifePetalCeiling,
        }),
        petalFallLimit: mergeWithLifeCeiling({
            analysisValue: analysis.petalFallLimit,
            lifeValue: life.petalFallLimit,
            ceiling: lifeFallCeiling,
        }),
        leafBudSignal: Math.max(analysis.leafBudSignal, life.leafBudSignal),
        budSignal: Math.max(analysis.budSignal, life.budSignal),
        previewPetalRate: Math.max(analysis.previewPetalRate, life.previewPetalRate),
        rippleVitality: Math.max(analysis.rippleVitality, life.rippleVitality),
        seasonSpanDays: Math.max(analysis.seasonSpanDays, life.seasonSpanDays),
        updatedAtMs: Date.now(),
    });
};

export const applyZenBonsaiLifeToPondBioticSignal = (signal = null, lifeState = null) => {
    if (!lifeState || typeof lifeState !== 'object') {
        return signal;
    }
    return mergeZenBonsaiPondBioticSignals({
        analysisSignal: signal,
        lifeSignal: deriveZenBonsaiPondBioticSignalFromLifeState({
            lifeState,
            source: 'zen_bonsai_life_biotic_floor',
            engine: 'life',
        }),
        source: 'zen_bonsai_life_biotic_adjusted',
        engine: signal ? 'analysis_life' : 'life',
    });
};

export const resolveZenBonsaiPondBioticSignal = ({
    analysis = null,
    lifeState = null,
    source = 'zen_bonsai_workspace',
    engine = 'classic',
    stageId = 'bloom',
    seasonSpanDays = 7,
} = {}) => {
    const analysisSignal = deriveZenBonsaiPondBioticSignalFromAnalysis({
        analysis,
        source,
        engine,
        stageId,
        seasonSpanDays,
    });
    const lifeSignal = deriveZenBonsaiPondBioticSignalFromLifeState({
        lifeState,
        source: `${source}_life_state`,
        engine,
        seasonSpanDays,
    });
    return mergeZenBonsaiPondBioticSignals({
        analysisSignal,
        lifeSignal,
        source,
        engine,
    });
};
