/**
 * LoadSpikeDetector - 10-second Burst/Spike Detection
 * 
 * Detects sudden bursts of cognitive load indicators:
 * - Rapid tab switching (>3 switches in 10s)
 * - Excessive navigation (>4 navigations in 10s)
 * - Scroll volatility spikes
 * 
 * Uses bounded personal-baseline lift only for a stable 10-second profile.
 * Sparse/forming profiles remain in an explicit normative-anchor-only mode.
 */

// Events emitted by this detector
export const SPIKE_EVENTS = {
    TAB_SPIKE: 'TAB_SPIKE',
    NAV_SPIKE: 'NAV_SPIKE',
    SCROLL_SPIKE: 'SCROLL_SPIKE',
    COMPOSITE_SPIKE: 'COMPOSITE_SPIKE',
};

export class LoadSpikeDetector {
    constructor() {
        this._listeners = new Set();
        this._lastSpikeAt = {};
        this._cooldownMs = 30000; // 30 seconds between same-type alerts
    }

    /**
     * Add a spike event listener
     * @param {Function} callback - (eventType, data) => void
     */
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
                console.warn('[CLSE:SpikeDetector] Listener error:', err);
            }
        }
    }

    /**
     * Analyze a 10-second bucket for spikes
     * @param {Object} bucket10s - 10-second bucket from ring buffer
     * @param {Object} aggressionScores - Precomputed same-bucket scorer results
     * @returns {Array<Object>} - Detected spike events
     */
    analyze(bucket10s, aggressionScores) {
        if (!bucket10s) return [];
        if (
            !aggressionScores
            || !aggressionScores.tab
            || !aggressionScores.nav
            || !aggressionScores.scroll
        ) {
            throw new Error('CLSE_SPIKE_AGGRESSION_SCORES_REQUIRED');
        }

        const spikes = [];
        const now = Date.now();

        // Check each indicator
        const tabSpike = this._checkTabSpike(bucket10s, now, aggressionScores.tab);
        if (tabSpike) spikes.push(tabSpike);

        const navSpike = this._checkNavSpike(bucket10s, now, aggressionScores.nav);
        if (navSpike) spikes.push(navSpike);

        const scrollSpike = this._checkScrollSpike(bucket10s, now, aggressionScores.scroll);
        if (scrollSpike) spikes.push(scrollSpike);

        // Check for composite spike (multiple indicators elevated)
        if (spikes.length >= 2) {
            const compositeSpike = {
                type: SPIKE_EVENTS.COMPOSITE_SPIKE,
                ts: now,
                bucket_ts: bucket10s.ts_start,
                components: spikes.map(s => s.type),
                severity: Math.min(1, spikes.reduce((sum, s) => sum + (s.severity || 0.5), 0) / 2),
            };
            spikes.push(compositeSpike);
            this._emit(SPIKE_EVENTS.COMPOSITE_SPIKE, compositeSpike);
        }

        return spikes;
    }

    _checkTabSpike(bucket, now, aggression) {
        const value = bucket.tab_switch_count || 0;

        // Check cooldown
        if (now - (this._lastSpikeAt[SPIKE_EVENTS.TAB_SPIKE] || 0) < this._cooldownMs) {
            return null;
        }

        const isSpike = aggression.isAggressive;
        const severity = aggression.score;

        if (isSpike) {
            this._lastSpikeAt[SPIKE_EVENTS.TAB_SPIKE] = now;
            const event = {
                type: SPIKE_EVENTS.TAB_SPIKE,
                ts: now,
                bucket_ts: bucket.ts_start,
                value,
                severity,
                aggression,
            };
            this._emit(SPIKE_EVENTS.TAB_SPIKE, event);
            return event;
        }

        return null;
    }

    _checkNavSpike(bucket, now, aggression) {
        const value = bucket.nav_count || 0;

        if (now - (this._lastSpikeAt[SPIKE_EVENTS.NAV_SPIKE] || 0) < this._cooldownMs) {
            return null;
        }

        const isSpike = aggression.isAggressive;
        const severity = aggression.score;

        if (isSpike) {
            this._lastSpikeAt[SPIKE_EVENTS.NAV_SPIKE] = now;
            const event = {
                type: SPIKE_EVENTS.NAV_SPIKE,
                ts: now,
                bucket_ts: bucket.ts_start,
                value,
                severity,
                aggression,
            };
            this._emit(SPIKE_EVENTS.NAV_SPIKE, event);
            return event;
        }

        return null;
    }

    _checkScrollSpike(bucket, now, aggression) {
        const value = bucket.scroll_abs_delta_sum || 0;

        if (now - (this._lastSpikeAt[SPIKE_EVENTS.SCROLL_SPIKE] || 0) < this._cooldownMs) {
            return null;
        }

        const isSpike = aggression.isAggressive;
        const severity = aggression.score;

        if (isSpike) {
            this._lastSpikeAt[SPIKE_EVENTS.SCROLL_SPIKE] = now;
            const event = {
                type: SPIKE_EVENTS.SCROLL_SPIKE,
                ts: now,
                bucket_ts: bucket.ts_start,
                value,
                severity,
                aggression,
            };
            this._emit(SPIKE_EVENTS.SCROLL_SPIKE, event);
            return event;
        }

        return null;
    }

    /**
     * Set cooldown between same-type alerts
     */
    setCooldown(ms) {
        this._cooldownMs = Math.max(5000, ms);
    }
}
