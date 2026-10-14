/**
 * BehaviorAggressionScorer
 *
 * Computes how "aggressive" and "meaningless" a behavior is relative to baseline.
 * Uses conditional gating + robust scoring to reduce false positives.
 */

import { CLSE_BASELINE_GRAINS } from '../../../platform/storage/clse/clseBaselineStorageContract.js';
import { PERSONAL_BASELINE_REFERENCE_MODES } from '../../../lib/personalBaselineContract.js';
import { buildCLSEBaselineObservation } from './BaselineManager.js';
import {
    requireCLSEDetectorReference,
    resolvePositiveZLift,
} from './clseRiskOnlyReference.js';
import {
    requireCanonicalCLSEDetectionPolicy,
    resolveCLSEDetectionThreshold,
    resolveCLSEPositiveZThresholdBand,
} from './clseDetectionPolicy.js';

const DEFAULT_CONFIG = Object.freeze({
    scroll: {
        minActiveMs: 2000,
        minEvents: 4,
        intensityRef: 1500, // px/sec ~ 15000 per 10s
        eventRateRef: 12,   // events/sec
        dirChangeRef: 0.35, // direction change ratio
        contentFeedRef: 2,  // feed items per 10s for "healthy" content flow
        contentNodeRef: 120, // nodes per 10s (weak evidence)
        shortDwellRef: 0.15, // short dwells/sec
        engagementRef: 2,
        zStart: 0.9,
        zEnd: 3.0,
        aggressiveThreshold: 0.6,
        minCoreScore: 0.45,
    },
    nav: {
        minActiveMs: 2000,
        minEvents: 2,
        rateRef: 0.5, // navs/sec (5 per 10s)
        backForwardRef: 0.4,
        sameSiteRef: 0.7,
        shortDwellRef: 0.2,
        engagementRef: 1,
        zStart: 0.9,
        zEnd: 2.8,
        aggressiveThreshold: 0.55,
        minCoreScore: 0.4,
    },
    tab: {
        minActiveMs: 2000,
        minEvents: 2,
        rateRef: 0.4, // switches/sec (4 per 10s)
        openTabsRef: 8,
        visibilityRef: 0.4,
        shortDwellRef: 0.25,
        engagementRef: 1,
        zStart: 0.9,
        zEnd: 2.8,
        aggressiveThreshold: 0.55,
        minCoreScore: 0.4,
    },
    media: {
        minActiveMs: 2000,
        minEvents: 2,
        seekRateRef: 0.2, // seeks/sec (2 per 10s)
        skimRatioRef: 1.5,
        engagementRef: 2,
        zStart: 0.9,
        zEnd: 2.8,
        aggressiveThreshold: 0.55,
        minCoreScore: 0.4,
    },
});

// A stable personal profile may only add bounded risk evidence. It never
// replaces, discounts, or vetoes the absolute product-risk score.
const MAX_ADAPTIVE_AGGRESSION_LIFT = 0.2;

function clamp01(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.min(1, Math.max(0, value));
}

function safeDiv(numerator, denominator) {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
    return numerator / denominator;
}

function logScore(value, ref) {
    if (!Number.isFinite(value) || !Number.isFinite(ref) || ref <= 0) return 0;
    return clamp01(Math.log1p(Math.max(0, value)) / Math.log1p(ref));
}

function weightedAverage(entries) {
    let sum = 0;
    let weightSum = 0;
    for (const entry of entries) {
        if (!entry) continue;
        const { value, weight } = entry;
        if (!Number.isFinite(value) || !Number.isFinite(weight) || weight <= 0) continue;
        sum += value * weight;
        weightSum += weight;
    }
    return weightSum > 0 ? sum / weightSum : 0;
}

function applyRiskOnlyAdaptiveLift({
    normativeAggressiveScore,
    zScore,
    adaptiveEnabled,
    zStart,
    zEnd,
    detectionPolicy,
}) {
    const boundedNormativeScore = clamp01(normativeAggressiveScore);
    const scaledZBand = resolveCLSEPositiveZThresholdBand({
        zStart,
        zEnd,
        detectionPolicy,
    });
    const { adaptiveLift } = resolvePositiveZLift({
        referenceMode: adaptiveEnabled
            ? PERSONAL_BASELINE_REFERENCE_MODES.BOUNDED_ADAPTIVE
            : PERSONAL_BASELINE_REFERENCE_MODES.NORMATIVE_ONLY,
        zScores: [zScore],
        zStart: scaledZBand.zStart,
        zEnd: scaledZBand.zEnd,
        maxLift: MAX_ADAPTIVE_AGGRESSION_LIFT,
    });
    return {
        normativeAggressiveScore: boundedNormativeScore,
        adaptiveLift,
        aggressiveScore: clamp01(boundedNormativeScore + adaptiveLift),
    };
}

function resolveAggressiveDecision({
    aggressiveScore,
    combinedScore,
    config,
    detectionPolicy,
}) {
    const minCoreScore = resolveCLSEDetectionThreshold(
        config.minCoreScore,
        detectionPolicy,
    );
    const aggressiveThreshold = resolveCLSEDetectionThreshold(
        config.aggressiveThreshold,
        detectionPolicy,
    );
    return aggressiveScore >= minCoreScore && combinedScore >= aggressiveThreshold;
}

function getActiveSeconds(bucket) {
    const activeMs = Number(bucket?.active_ms) || 0;
    return Math.max(0, activeMs / 1000);
}

function buildResult({
    score = 0,
    aggressiveScore = 0,
    normativeAggressiveScore = 0,
    adaptiveLift = 0,
    meaninglessScore = 0,
    isAggressive = false,
    reasons = [],
    metrics = {},
    zScores = {},
    gate = {},
    reference,
}) {
    if (!reference) throw new Error('CLSE_AGGRESSION_REFERENCE_CONTEXT_REQUIRED');
    return {
        score: clamp01(score),
        aggressiveScore: clamp01(aggressiveScore),
        normativeAggressiveScore: clamp01(normativeAggressiveScore),
        adaptiveLift: clamp01(adaptiveLift),
        meaninglessScore: clamp01(meaninglessScore),
        isAggressive: !!isAggressive,
        reasons,
        metrics,
        zScores,
        gate,
        referenceMode: reference.referenceMode,
        baselineStatus: reference.baselineStatus,
        baselineGrain: reference.baselineGrain,
        baselineResetEpoch: reference.baselineResetEpoch,
    };
}

function scoreScrollAggressionWithReference(
    bucket,
    baselineManager,
    options,
    detectionPolicy,
    reference,
    baselineObservation,
) {
    const config = { ...DEFAULT_CONFIG.scroll, ...(options.scroll || options) };
    const activeMs = Number(bucket?.active_ms) || 0;
    const eventCount = Number(bucket?.scroll_event_count) || 0;
    const gatePass = activeMs >= config.minActiveMs && eventCount >= config.minEvents;
    if (!gatePass) {
        return buildResult({
            gate: { activeMs, eventCount, pass: false },
            reasons: ['low_activity'],
            reference,
        });
    }

    const activeSeconds = Math.max(1, getActiveSeconds(bucket));
    const absDelta = Number(bucket?.scroll_abs_delta_sum) || 0;
    const dirChanges = Number(bucket?.scroll_dir_change_count) || 0;
    const intensity = absDelta / activeSeconds;
    const eventRate = eventCount / activeSeconds;
    const dirChangeRate = safeDiv(dirChanges, eventCount);

    const volatility = baselineObservation.values.scroll_volatility;
    const adaptiveEnabled = reference.referenceMode
        === PERSONAL_BASELINE_REFERENCE_MODES.BOUNDED_ADAPTIVE;
    const zVolatility = adaptiveEnabled
        ? baselineManager.getZScore(
            CLSE_BASELINE_GRAINS.BUCKET_10S,
            'scroll_volatility',
            volatility,
        )
        : 0;

    const intensityScore = logScore(intensity, config.intensityRef);
    const eventRateScore = logScore(eventRate, config.eventRateRef);
    const jitterScore = clamp01(dirChangeRate / config.dirChangeRef);
    const normativeAggressiveScore = weightedAverage([
        { value: intensityScore, weight: 0.55 },
        { value: eventRateScore, weight: 0.1 },
        { value: jitterScore, weight: 0.2 },
    ]);
    const aggression = applyRiskOnlyAdaptiveLift({
        normativeAggressiveScore,
        zScore: zVolatility,
        adaptiveEnabled,
        zStart: config.zStart,
        zEnd: config.zEnd,
        detectionPolicy,
    });

    const feedItems = Number(bucket?.feed_item_add_count) || 0;
    const contentNodes = Number(bucket?.content_add_count) || 0;
    const feedEvidence = clamp01(feedItems / config.contentFeedRef);
    const nodeEvidence = clamp01(contentNodes / config.contentNodeRef);
    const contentEvidence = Math.max(feedEvidence, nodeEvidence * 0.3);
    const contentScarcityScore = clamp01(1 - contentEvidence);

    const shortDwellCount = Number(bucket?.short_dwell_count) || 0;
    const shortDwellRate = shortDwellCount / activeSeconds;
    const shortDwellScore = logScore(shortDwellRate, config.shortDwellRef);

    const engagementCount = (Number(bucket?.media_pause_play_count) || 0)
        + (Number(bucket?.media_seek_count) || 0);
    const engagementRelief = clamp01(engagementCount / config.engagementRef);

    let meaninglessScore = weightedAverage([
        { value: contentScarcityScore, weight: 0.5 },
        { value: jitterScore, weight: 0.3 },
        { value: shortDwellScore, weight: 0.2 },
    ]);
    meaninglessScore = clamp01(meaninglessScore * (1 - 0.35 * engagementRelief));

    const combinedScore = clamp01(
        aggression.aggressiveScore * (0.6 + 0.4 * meaninglessScore),
    );
    const isAggressive = resolveAggressiveDecision({
        aggressiveScore: aggression.aggressiveScore,
        combinedScore,
        config,
        detectionPolicy,
    });

    return buildResult({
        score: combinedScore,
        aggressiveScore: aggression.aggressiveScore,
        normativeAggressiveScore: aggression.normativeAggressiveScore,
        adaptiveLift: aggression.adaptiveLift,
        meaninglessScore,
        isAggressive,
        metrics: {
            intensity,
            eventRate,
            dirChangeRate,
            volatility,
            feedItems,
            contentNodes,
            shortDwellRate,
            engagementCount,
        },
        zScores: {
            scroll_volatility: zVolatility,
        },
        gate: { activeMs, eventCount, pass: true },
        reasons: isAggressive ? ['scroll_aggressive'] : [],
        reference,
    });
}

function scoreNavAggressionWithReference(
    bucket,
    baselineManager,
    options,
    detectionPolicy,
    reference,
    baselineObservation,
) {
    const config = { ...DEFAULT_CONFIG.nav, ...(options.nav || options) };
    const activeMs = Number(bucket?.active_ms) || 0;
    const navCount = Number(bucket?.nav_count) || 0;
    const gatePass = activeMs >= config.minActiveMs && navCount >= config.minEvents;
    if (!gatePass) {
        return buildResult({
            gate: { activeMs, navCount, pass: false },
            reasons: ['low_activity'],
            reference,
        });
    }

    const activeSeconds = Math.max(1, getActiveSeconds(bucket));
    const navRate = baselineObservation.values.nav_rate;
    const backForward = Number(bucket?.back_forward_count) || 0;
    const sameSite = Number(bucket?.same_site_jump_count) || 0;
    const backForwardRatio = safeDiv(backForward, navCount);
    const sameSiteRatio = safeDiv(sameSite, navCount);
    const shortDwellCount = Number(bucket?.short_dwell_count) || 0;
    const shortDwellRate = shortDwellCount / activeSeconds;
    const shortDwellScore = logScore(shortDwellRate, config.shortDwellRef);
    const engagementCount = Number(bucket?.media_pause_play_count) || 0;
    const engagementRelief = clamp01(engagementCount / config.engagementRef);

    const adaptiveEnabled = reference.referenceMode
        === PERSONAL_BASELINE_REFERENCE_MODES.BOUNDED_ADAPTIVE;
    const zNav = adaptiveEnabled
        ? baselineManager.getZScore(
            CLSE_BASELINE_GRAINS.BUCKET_10S,
            'nav_rate',
            navRate,
        )
        : 0;

    const rateScore = logScore(navRate, config.rateRef);
    const aggression = applyRiskOnlyAdaptiveLift({
        normativeAggressiveScore: rateScore,
        zScore: zNav,
        adaptiveEnabled,
        zStart: config.zStart,
        zEnd: config.zEnd,
        detectionPolicy,
    });

    const backForwardScore = clamp01(backForwardRatio / config.backForwardRef);
    const sameSiteScore = clamp01(sameSiteRatio / config.sameSiteRef);
    let meaninglessScore = weightedAverage([
        { value: backForwardScore, weight: 0.45 },
        { value: sameSiteScore, weight: 0.35 },
        { value: shortDwellScore, weight: 0.2 },
    ]);
    meaninglessScore = clamp01(meaninglessScore * (1 - 0.3 * engagementRelief));

    const combinedScore = clamp01(
        aggression.aggressiveScore * (0.7 + 0.3 * meaninglessScore),
    );
    const isAggressive = resolveAggressiveDecision({
        aggressiveScore: aggression.aggressiveScore,
        combinedScore,
        config,
        detectionPolicy,
    });

    return buildResult({
        score: combinedScore,
        aggressiveScore: aggression.aggressiveScore,
        normativeAggressiveScore: aggression.normativeAggressiveScore,
        adaptiveLift: aggression.adaptiveLift,
        meaninglessScore,
        isAggressive,
        metrics: {
            navRate,
            backForwardRatio,
            sameSiteRatio,
            shortDwellRate,
            engagementCount,
        },
        zScores: {
            nav_rate: zNav,
        },
        gate: { activeMs, navCount, pass: true },
        reasons: isAggressive ? ['nav_aggressive'] : [],
        reference,
    });
}

function scoreTabAggressionWithReference(
    bucket,
    baselineManager,
    options,
    detectionPolicy,
    reference,
    baselineObservation,
) {
    const config = { ...DEFAULT_CONFIG.tab, ...(options.tab || options) };
    const activeMs = Number(bucket?.active_ms) || 0;
    const switchCount = Number(bucket?.tab_switch_count) || 0;
    const gatePass = activeMs >= config.minActiveMs && switchCount >= config.minEvents;
    if (!gatePass) {
        return buildResult({
            gate: { activeMs, switchCount, pass: false },
            reasons: ['low_activity'],
            reference,
        });
    }

    const activeSeconds = Math.max(1, getActiveSeconds(bucket));
    const switchRate = baselineObservation.values.tab_switch_rate;
    const openTabs = Number(bucket?.tab_open_count) || 0;
    const visibilityChanges = Number(bucket?.visibility_change_count) || 0;
    const visibilityRatio = safeDiv(visibilityChanges, switchCount);
    const shortDwellCount = Number(bucket?.short_dwell_count) || 0;
    const shortDwellRate = shortDwellCount / activeSeconds;
    const shortDwellScore = logScore(shortDwellRate, config.shortDwellRef);
    const engagementCount = Number(bucket?.media_pause_play_count) || 0;
    const engagementRelief = clamp01(engagementCount / config.engagementRef);

    const adaptiveEnabled = reference.referenceMode
        === PERSONAL_BASELINE_REFERENCE_MODES.BOUNDED_ADAPTIVE;
    const zSwitch = adaptiveEnabled
        ? baselineManager.getZScore(
            CLSE_BASELINE_GRAINS.BUCKET_10S,
            'tab_switch_rate',
            switchRate,
        )
        : 0;

    const rateScore = logScore(switchRate, config.rateRef);
    const aggression = applyRiskOnlyAdaptiveLift({
        normativeAggressiveScore: rateScore,
        zScore: zSwitch,
        adaptiveEnabled,
        zStart: config.zStart,
        zEnd: config.zEnd,
        detectionPolicy,
    });

    const openTabsScore = clamp01(safeDiv(openTabs, config.openTabsRef));
    const visibilityScore = clamp01(visibilityRatio / config.visibilityRef);
    let meaninglessScore = weightedAverage([
        { value: openTabsScore, weight: 0.45 },
        { value: visibilityScore, weight: 0.3 },
        { value: shortDwellScore, weight: 0.25 },
    ]);
    meaninglessScore = clamp01(meaninglessScore * (1 - 0.3 * engagementRelief));

    const combinedScore = clamp01(
        aggression.aggressiveScore * (0.7 + 0.3 * meaninglessScore),
    );
    const isAggressive = resolveAggressiveDecision({
        aggressiveScore: aggression.aggressiveScore,
        combinedScore,
        config,
        detectionPolicy,
    });

    return buildResult({
        score: combinedScore,
        aggressiveScore: aggression.aggressiveScore,
        normativeAggressiveScore: aggression.normativeAggressiveScore,
        adaptiveLift: aggression.adaptiveLift,
        meaninglessScore,
        isAggressive,
        metrics: {
            switchRate,
            openTabs,
            visibilityRatio,
            shortDwellRate,
            engagementCount,
        },
        zScores: {
            tab_switch_rate: zSwitch,
        },
        gate: { activeMs, switchCount, pass: true },
        reasons: isAggressive ? ['tab_aggressive'] : [],
        reference,
    });
}

function scoreMediaAggressionWithReference(
    bucket,
    baselineManager,
    options,
    detectionPolicy,
    reference,
    baselineObservation,
) {
    const config = { ...DEFAULT_CONFIG.media, ...(options.media || options) };
    const activeMs = Number(bucket?.active_ms) || 0;
    const seekCount = Number(bucket?.media_seek_count) || 0;
    const rateChangeCount = Number(bucket?.media_rate_change_count) || 0;
    const pausePlayCount = Number(bucket?.media_pause_play_count) || 0;
    const totalEvents = seekCount + rateChangeCount + pausePlayCount;
    const gatePass = activeMs >= config.minActiveMs && totalEvents >= config.minEvents;
    if (!gatePass) {
        return buildResult({
            gate: { activeMs, totalEvents, pass: false },
            reasons: ['low_activity'],
            reference,
        });
    }

    const seekRate = baselineObservation.values.seek_rate;
    const skimRatio = safeDiv(seekCount + rateChangeCount, pausePlayCount + 1);
    const engagementCount = Number(bucket?.media_pause_play_count) || 0;

    const adaptiveEnabled = reference.referenceMode
        === PERSONAL_BASELINE_REFERENCE_MODES.BOUNDED_ADAPTIVE;
    const zSeek = adaptiveEnabled
        ? baselineManager.getZScore(
            CLSE_BASELINE_GRAINS.BUCKET_10S,
            'seek_rate',
            seekRate,
        )
        : 0;

    const rateScore = logScore(seekRate, config.seekRateRef);
    const aggression = applyRiskOnlyAdaptiveLift({
        normativeAggressiveScore: rateScore,
        zScore: zSeek,
        adaptiveEnabled,
        zStart: config.zStart,
        zEnd: config.zEnd,
        detectionPolicy,
    });

    const skimScore = clamp01(skimRatio / config.skimRatioRef);
    const engagementRelief = clamp01(engagementCount / config.engagementRef);
    const meaninglessScore = clamp01(skimScore * (1 - 0.25 * engagementRelief));

    const combinedScore = clamp01(
        aggression.aggressiveScore * (0.7 + 0.3 * meaninglessScore),
    );
    const isAggressive = resolveAggressiveDecision({
        aggressiveScore: aggression.aggressiveScore,
        combinedScore,
        config,
        detectionPolicy,
    });

    return buildResult({
        score: combinedScore,
        aggressiveScore: aggression.aggressiveScore,
        normativeAggressiveScore: aggression.normativeAggressiveScore,
        adaptiveLift: aggression.adaptiveLift,
        meaninglessScore,
        isAggressive,
        metrics: {
            seekRate,
            skimRatio,
            engagementCount,
        },
        zScores: {
            seek_rate: zSeek,
        },
        gate: { activeMs, totalEvents, pass: true },
        reasons: isAggressive ? ['media_aggressive'] : [],
        reference,
    });
}

export function scoreScrollAggression(
    bucket,
    baselineManager,
    detectionPolicy,
    options = {},
) {
    const policy = requireCanonicalCLSEDetectionPolicy(detectionPolicy);
    return scoreScrollAggressionWithReference(
        bucket,
        baselineManager,
        options,
        policy,
        requireCLSEDetectorReference(baselineManager, CLSE_BASELINE_GRAINS.BUCKET_10S),
        buildCLSEBaselineObservation(CLSE_BASELINE_GRAINS.BUCKET_10S, bucket),
    );
}

export function scoreNavAggression(
    bucket,
    baselineManager,
    detectionPolicy,
    options = {},
) {
    const policy = requireCanonicalCLSEDetectionPolicy(detectionPolicy);
    return scoreNavAggressionWithReference(
        bucket,
        baselineManager,
        options,
        policy,
        requireCLSEDetectorReference(baselineManager, CLSE_BASELINE_GRAINS.BUCKET_10S),
        buildCLSEBaselineObservation(CLSE_BASELINE_GRAINS.BUCKET_10S, bucket),
    );
}

export function scoreTabAggression(
    bucket,
    baselineManager,
    detectionPolicy,
    options = {},
) {
    const policy = requireCanonicalCLSEDetectionPolicy(detectionPolicy);
    return scoreTabAggressionWithReference(
        bucket,
        baselineManager,
        options,
        policy,
        requireCLSEDetectorReference(baselineManager, CLSE_BASELINE_GRAINS.BUCKET_10S),
        buildCLSEBaselineObservation(CLSE_BASELINE_GRAINS.BUCKET_10S, bucket),
    );
}

export function scoreMediaAggression(
    bucket,
    baselineManager,
    detectionPolicy,
    options = {},
) {
    const policy = requireCanonicalCLSEDetectionPolicy(detectionPolicy);
    return scoreMediaAggressionWithReference(
        bucket,
        baselineManager,
        options,
        policy,
        requireCLSEDetectorReference(baselineManager, CLSE_BASELINE_GRAINS.BUCKET_10S),
        buildCLSEBaselineObservation(CLSE_BASELINE_GRAINS.BUCKET_10S, bucket),
    );
}

export function scoreCLSEBucketAggression(
    bucket,
    baselineManager,
    detectionPolicy,
    options = {},
) {
    const policy = requireCanonicalCLSEDetectionPolicy(detectionPolicy);
    const reference = requireCLSEDetectorReference(
        baselineManager,
        CLSE_BASELINE_GRAINS.BUCKET_10S,
    );
    const baselineObservation = buildCLSEBaselineObservation(
        CLSE_BASELINE_GRAINS.BUCKET_10S,
        bucket,
    );
    return {
        scroll: scoreScrollAggressionWithReference(
            bucket, baselineManager, options, policy, reference, baselineObservation,
        ),
        nav: scoreNavAggressionWithReference(
            bucket, baselineManager, options, policy, reference, baselineObservation,
        ),
        tab: scoreTabAggressionWithReference(
            bucket, baselineManager, options, policy, reference, baselineObservation,
        ),
        media: scoreMediaAggressionWithReference(
            bucket, baselineManager, options, policy, reference, baselineObservation,
        ),
    };
}
