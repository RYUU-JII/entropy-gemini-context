/**
 * SustainedLoadDetector - Prolonged Elevated Load Detection
 * 
 * Detects when cognitive load indicators remain elevated over time:
 * - Multiple consecutive 60-second buckets above threshold
 * - Gradual escalation patterns
 * 
 * This is different from spike detection - it looks for
 * sustained patterns rather than sudden bursts.
 */

import { CLSE_BASELINE_GRAINS } from '../../../platform/storage/clse/clseBaselineStorageContract.js';
import { PERSONAL_BASELINE_REFERENCE_MODES } from '../../../lib/personalBaselineContract.js';
import {
    buildCLSEBaselineObservation,
    getBaselineManager,
} from './BaselineManager.js';
import {
    requireCLSEDetectorReference,
    resolvePositiveZLift,
} from './clseRiskOnlyReference.js';
import {
    requireCanonicalCLSEDetectionPolicy,
    resolveCLSEDetectionThreshold,
    resolveCLSEPositiveZThresholdBand,
} from './clseDetectionPolicy.js';

// Minimum consecutive windows for sustained load
const MIN_SUSTAINED_WINDOWS = 3; // 3 x 60s = 3 minutes
const MAX_SEVERITY_HISTORY = 30;
const ESCALATION_COOLDOWN_MS = 3 * 60 * 1000;
const SUSTAINED_Z_THRESHOLD = 1.8;
const SUSTAINED_Z_FULL_LIFT = 4;
const MAX_ADAPTIVE_SUSTAINED_LIFT = 0.25;
const SUSTAINED_FEATURES = Object.freeze([
    'tab_switch_rate',
    'nav_rate',
    'scroll_volatility',
]);
const SUSTAINED_NORMATIVE_THRESHOLDS = Object.freeze({
    tab_switch_rate: 0.2,
    nav_rate: 0.25,
    scroll_volatility: 1500,
});

// Events
export const SUSTAINED_EVENTS = {
    SUSTAINED_LOAD_START: 'SUSTAINED_LOAD_START',
    SUSTAINED_LOAD_END: 'SUSTAINED_LOAD_END',
    SUSTAINED_LOAD_ESCALATION: 'SUSTAINED_LOAD_ESCALATION',
};

function clamp01(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.min(1, Math.max(0, value));
}

function averageTop(values, count) {
    const selected = [...values].sort((a, b) => b - a).slice(0, count);
    if (selected.length === 0) return 0;
    return selected.reduce((sum, value) => sum + value, 0) / selected.length;
}

export class SustainedLoadDetector {
    constructor({
        baselineManager = getBaselineManager(),
        now = () => Date.now(),
    } = {}) {
        if (typeof now !== 'function') {
            throw new Error('CLSE_SUSTAINED_CLOCK_REQUIRED');
        }
        this.baselineManager = baselineManager;
        this.now = now;
        this._listeners = new Set();

        // State tracking
        this._elevatedWindowCount = 0;
        this._inSustainedLoad = false;
        this._sustainedLoadStartTs = null;
        this._lastAnalyzedTs = 0;
        this._severityHistory = [];
        this._lastEscalationAt = 0;
        this._lastEvaluation = null;
    }

    addListener(callback) {
        this._listeners.add(callback);
    }

    removeListener(callback) {
        this._listeners.delete(callback);
    }

    _emit(eventType, data) {
        for (const listener of this._listeners) {
            try {
                listener(eventType, data);
            } catch (err) {
                console.warn('[CLSE:SustainedDetector] Listener error:', err);
            }
        }
    }

    /**
     * Analyze a 60-second bucket for sustained load
     * @param {Object} bucket60s - 60-second bucket
     * @returns {Object|null} - Sustained load event or null
     */
    analyze(bucket60s, detectionPolicy) {
        if (!bucket60s) return null;
        const policy = requireCanonicalCLSEDetectionPolicy(detectionPolicy);

        // Prevent duplicate analysis
        if (bucket60s.ts_start <= this._lastAnalyzedTs) return null;

        const now = this.now();
        const observation = buildCLSEBaselineObservation(
            CLSE_BASELINE_GRAINS.BUCKET_60S,
            bucket60s,
        );
        const evaluation = this._evaluate(observation, policy);
        this._lastAnalyzedTs = bucket60s.ts_start;
        this._lastEvaluation = evaluation;

        if (evaluation.isElevated) {
            this._elevatedWindowCount++;
            this._severityHistory.push(evaluation.severity);
            if (this._severityHistory.length > MAX_SEVERITY_HISTORY) {
                this._severityHistory.shift();
            }

            // Check for sustained load start
            if (!this._inSustainedLoad && this._elevatedWindowCount >= MIN_SUSTAINED_WINDOWS) {
                this._inSustainedLoad = true;
                this._sustainedLoadStartTs = bucket60s.ts_start - (MIN_SUSTAINED_WINDOWS - 1) * 60000;

                const event = this._withReferenceDiagnostics({
                    type: SUSTAINED_EVENTS.SUSTAINED_LOAD_START,
                    ts: now,
                    started_at: this._sustainedLoadStartTs,
                    window_count: this._elevatedWindowCount,
                    severity: this._getAverageSeverity(),
                }, evaluation);
                this._emit(SUSTAINED_EVENTS.SUSTAINED_LOAD_START, event);
                return event;
            }

            // Check for escalation (severity increasing)
            if (
                this._inSustainedLoad
                && this._isEscalating()
                && now - this._lastEscalationAt >= ESCALATION_COOLDOWN_MS
            ) {
                this._lastEscalationAt = now;
                const event = this._withReferenceDiagnostics({
                    type: SUSTAINED_EVENTS.SUSTAINED_LOAD_ESCALATION,
                    ts: now,
                    duration_ms: now - this._sustainedLoadStartTs,
                    window_count: this._elevatedWindowCount,
                    severity: this._getAverageSeverity(),
                    trend: 'increasing',
                }, evaluation);
                this._emit(SUSTAINED_EVENTS.SUSTAINED_LOAD_ESCALATION, event);
                return event;
            }

        } else {
            // Load returned to normal
            if (this._inSustainedLoad) {
                const event = this._withReferenceDiagnostics({
                    type: SUSTAINED_EVENTS.SUSTAINED_LOAD_END,
                    ts: now,
                    started_at: this._sustainedLoadStartTs,
                    duration_ms: now - this._sustainedLoadStartTs,
                    window_count: this._elevatedWindowCount,
                    peak_severity: Math.max(...this._severityHistory, 0),
                }, evaluation);
                this._emit(SUSTAINED_EVENTS.SUSTAINED_LOAD_END, event);

                // Reset state
                this._reset();
                return event;
            }

            // Reset counter if not in sustained load
            this._elevatedWindowCount = Math.max(0, this._elevatedWindowCount - 1);
            if (this._severityHistory.length > 0) {
                this._severityHistory.shift();
            }
        }

        return null;
    }

    _evaluate(observation, detectionPolicy) {
        const reference = requireCLSEDetectorReference(
            this.baselineManager,
            CLSE_BASELINE_GRAINS.BUCKET_60S,
        );
        if (!observation.eligible) {
            return {
                ...reference,
                isElevated: false,
                severity: 0,
                normativeElevated: false,
                adaptiveElevated: false,
                adaptiveLift: 0,
            };
        }

        const normativeScores = SUSTAINED_FEATURES.map((feature) => {
            const threshold = SUSTAINED_NORMATIVE_THRESHOLDS[feature];
            return clamp01(observation.values[feature] / (threshold * 2));
        });
        const normativeElevatedCount = SUSTAINED_FEATURES.filter((feature) => (
            observation.values[feature]
            >= resolveCLSEDetectionThreshold(
                SUSTAINED_NORMATIVE_THRESHOLDS[feature],
                detectionPolicy,
            )
        )).length;
        const normativeElevated = normativeElevatedCount >= 2;
        const normativeSeverity = averageTop(normativeScores, 2);

        let adaptiveElevated = false;
        let adaptiveLift = 0;
        if (reference.referenceMode === PERSONAL_BASELINE_REFERENCE_MODES.BOUNDED_ADAPTIVE) {
            const zThresholdBand = resolveCLSEPositiveZThresholdBand({
                zStart: SUSTAINED_Z_THRESHOLD,
                zEnd: SUSTAINED_Z_FULL_LIFT,
                detectionPolicy,
            });
            const zScores = SUSTAINED_FEATURES.map((feature) => (
                this.baselineManager.getZScore(
                    CLSE_BASELINE_GRAINS.BUCKET_60S,
                    feature,
                    observation.values[feature],
                )
            ));
            const adaptive = resolvePositiveZLift({
                referenceMode: reference.referenceMode,
                zScores,
                zStart: zThresholdBand.zStart,
                zEnd: zThresholdBand.zEnd,
                maxLift: MAX_ADAPTIVE_SUSTAINED_LIFT,
                evidenceCount: 2,
            });
            adaptiveElevated = adaptive.positiveEvidenceCount >= 2;
            adaptiveLift = adaptive.adaptiveLift;
        }

        return {
            ...reference,
            isElevated: normativeElevated || adaptiveElevated,
            severity: clamp01(normativeSeverity + adaptiveLift),
            normativeElevated,
            adaptiveElevated,
            adaptiveLift,
        };
    }

    _withReferenceDiagnostics(event, evaluation) {
        return {
            ...event,
            referenceMode: evaluation.referenceMode,
            baselineStatus: evaluation.baselineStatus,
            baselineGrain: evaluation.baselineGrain,
            baselineResetEpoch: evaluation.baselineResetEpoch,
            normativeElevated: evaluation.normativeElevated,
            adaptiveElevated: evaluation.adaptiveElevated,
            adaptiveLift: evaluation.adaptiveLift,
        };
    }

    _getAverageSeverity() {
        if (this._severityHistory.length === 0) return 0;
        return this._severityHistory.reduce((a, b) => a + b, 0) / this._severityHistory.length;
    }

    _isEscalating() {
        if (this._severityHistory.length < 3) return false;

        const recent = this._severityHistory.slice(-3);
        return recent[2] > recent[1] && recent[1] > recent[0];
    }

    _reset() {
        this._elevatedWindowCount = 0;
        this._inSustainedLoad = false;
        this._sustainedLoadStartTs = null;
        this._severityHistory = [];
        this._lastEscalationAt = 0;
    }

    /**
     * Get current state
     */
    getState() {
        const reference = this._lastEvaluation;
        return {
            inSustainedLoad: this._inSustainedLoad,
            elevatedWindowCount: this._elevatedWindowCount,
            startedAt: this._sustainedLoadStartTs,
            currentSeverity: this._getAverageSeverity(),
            referenceMode: reference ? reference.referenceMode : null,
            baselineStatus: reference ? reference.baselineStatus : null,
            baselineGrain: reference
                ? reference.baselineGrain
                : CLSE_BASELINE_GRAINS.BUCKET_60S,
            baselineResetEpoch: reference ? reference.baselineResetEpoch : null,
            normativeElevated: reference ? reference.normativeElevated : false,
            adaptiveElevated: reference ? reference.adaptiveElevated : false,
            adaptiveLift: reference ? reference.adaptiveLift : 0,
        };
    }
}
