import { CLSE_CONSTANTS } from '../clseSchema.js';

// ============================================================
// RING BUFFER (10-second buckets in RAM)
// ============================================================

/**
 * Simple ring buffer for 10-second buckets
 * Provides increment/add/set/updateWelford methods for collectors
 */
export class RingBuffer10s {
    constructor(size = CLSE_CONSTANTS.RING_BUFFER_SIZE) {
        this.size = size;
        this.buckets = [];
        this.currentBucket = null;
        this.bucketStartTime = 0;
    }

    /**
     * Get or create the current 10-second bucket
     */
    _ensureBucket() {
        const now = Date.now();
        const bucketStart = Math.floor(now / CLSE_CONSTANTS.BUCKET_10S_MS) * CLSE_CONSTANTS.BUCKET_10S_MS;

        if (!this.currentBucket || this.bucketStartTime !== bucketStart) {
            // Save previous bucket to ring
            if (this.currentBucket) {
                this.buckets.push(this.currentBucket);
                if (this.buckets.length > this.size) {
                    this.buckets.shift();
                }
            }

            // Create new bucket
            this.currentBucket = this._createBucket(bucketStart);
            this.bucketStartTime = bucketStart;
        }

        return this.currentBucket;
    }

    _createBucket(tsStart) {
        return {
            ts_start: tsStart,
            duration_ms: CLSE_CONSTANTS.BUCKET_10S_MS,
            active_ms: 0,
            idle_ms: 0,
            tab_switch_count: 0,
            tab_open_count: 0,
            visibility_change_count: 0,
            nav_count: 0,
            back_forward_count: 0,
            same_site_jump_count: 0,
            cross_site_jump_count: 0,
            scroll_event_count: 0,
            scroll_abs_delta_sum: 0,
            scroll_dir_change_count: 0,
            scroll_velocity_mean: 0,
            scroll_velocity_var: 0,
            scroll_n: 0,
            content_add_count: 0,
            feed_item_add_count: 0,
            short_dwell_count: 0,
            media_seek_count: 0,
            media_rate_change_count: 0,
            media_pause_play_count: 0,
        };
    }

    /**
     * Increment a counter field by 1
     */
    increment(field) {
        const bucket = this._ensureBucket();
        if (typeof bucket[field] === 'number') {
            bucket[field] += 1;
        }
    }

    /**
     * Add a value to a counter field
     */
    add(field, value) {
        if (typeof value !== 'number' || !Number.isFinite(value)) return;
        const bucket = this._ensureBucket();
        if (typeof bucket[field] === 'number') {
            bucket[field] += value;
        }
    }

    /**
     * Set a field to a specific value (e.g., tab_open_count)
     */
    set(field, value) {
        if (typeof value !== 'number' || !Number.isFinite(value)) return;
        const bucket = this._ensureBucket();
        bucket[field] = value;
    }

    /**
     * Update Welford running mean/variance for a feature
     * @param {string} feature - Feature prefix (e.g., 'scroll')
     * @param {number} value - New sample value
     */
    updateWelford(feature, value) {
        if (typeof value !== 'number' || !Number.isFinite(value)) return;
        const bucket = this._ensureBucket();

        const nField = `${feature}_n`;
        const meanField = `${feature}_velocity_mean`;
        const varField = `${feature}_velocity_var`;

        if (typeof bucket[nField] !== 'number') return;

        const n = bucket[nField] + 1;
        const oldMean = bucket[meanField] || 0;
        const delta = value - oldMean;
        const newMean = oldMean + delta / n;
        const delta2 = value - newMean;
        const oldVar = bucket[varField] || 0;
        const newVar = oldVar + delta * delta2;

        bucket[nField] = n;
        bucket[meanField] = newMean;
        bucket[varField] = newVar; // Note: This is sum of squared differences, divide by n-1 for variance
    }

    /**
     * Add a time range to a field, splitting accurately across 10-second bucket boundaries
     * @param {string} field - Field to accumulate (e.g. 'active_ms', 'idle_ms')
     * @param {number} startTs - Start timestamp in ms
     * @param {number} endTs - End timestamp in ms
     */
    addDuration(field, startTs, endTs) {
        if (
            typeof startTs !== 'number'
            || typeof endTs !== 'number'
            || !Number.isFinite(startTs)
            || !Number.isFinite(endTs)
            || startTs >= endTs
        ) {
            return;
        }

        const bucketSizeMs = CLSE_CONSTANTS.BUCKET_10S_MS;
        const requestedFirstBucketStart = Math.floor(startTs / bucketSizeMs) * bucketSizeMs;
        const lastBucketStart = Math.floor((endTs - 1) / bucketSizeMs) * bucketSizeMs;
        // A suspended MV3 worker may resume after hours. Buckets older than the
        // ring capacity would be shifted out anyway, so do not iterate through
        // thousands of intervals that cannot survive this mutation.
        const earliestRetainedBucketStart = lastBucketStart - (this.size * bucketSizeMs);
        const firstBucketStart = Math.max(requestedFirstBucketStart, earliestRetainedBucketStart);

        this._ensureBucket();

        for (let bStart = firstBucketStart; bStart <= lastBucketStart; bStart += bucketSizeMs) {
            const bEnd = bStart + bucketSizeMs;
            const overlapStart = Math.max(startTs, bStart);
            const overlapEnd = Math.min(endTs, bEnd);
            const overlapMs = Math.max(0, overlapEnd - overlapStart);
            if (overlapMs <= 0) continue;

            let targetBucket = null;
            if (this.currentBucket && this.bucketStartTime === bStart) {
                targetBucket = this.currentBucket;
            } else {
                targetBucket = this.buckets.find((b) => b.ts_start === bStart);
                if (!targetBucket && bStart > (this.bucketStartTime || 0)) {
                    if (this.currentBucket) {
                        this.buckets.push(this.currentBucket);
                        if (this.buckets.length > this.size) {
                            this.buckets.shift();
                        }
                    }
                    this.currentBucket = this._createBucket(bStart);
                    this.bucketStartTime = bStart;
                    targetBucket = this.currentBucket;
                } else if (!targetBucket) {
                    targetBucket = this._createBucket(bStart);
                    this.buckets.push(targetBucket);
                    this.buckets.sort((a, b) => a.ts_start - b.ts_start);
                    if (this.buckets.length > this.size) {
                        this.buckets.shift();
                    }
                }
            }

            if (targetBucket && typeof targetBucket[field] === 'number') {
                targetBucket[field] += overlapMs;
            }
        }
    }

    /**
     * Get recent buckets for rollup
     * @param {number} count - Number of buckets to retrieve
     */
    getRecentBuckets(count) {
        this._ensureBucket();
        const all = [...this.buckets];
        if (this.currentBucket) {
            all.push(this.currentBucket);
        }
        return all.slice(-count);
    }

    /**
     * Get bucket count
     */
    getBucketCount() {
        return this.buckets.length + (this.currentBucket ? 1 : 0);
    }

    /**
     * Serialize ring buffer to a snapshot object
     */
    serialize({ maxClosedBuckets = this.size } = {}) {
        if (
            !Number.isSafeInteger(maxClosedBuckets)
            || maxClosedBuckets < 0
            || maxClosedBuckets > this.size
        ) {
            throw new Error('CLSE_RING_BUFFER_CHECKPOINT_WINDOW_INVALID');
        }
        const closedBuckets = maxClosedBuckets === 0
            ? []
            : this.buckets.slice(-maxClosedBuckets);
        return {
            size: this.size,
            buckets: closedBuckets.map((b) => ({ ...b })),
            currentBucket: this.currentBucket ? { ...this.currentBucket } : null,
            bucketStartTime: this.bucketStartTime,
        };
    }

    /**
     * Hydrate ring buffer from a snapshot object
     */
    hydrate(snapshot) {
        if (!snapshot) return;
        if (typeof snapshot.size === 'number') this.size = snapshot.size;
        if (Array.isArray(snapshot.buckets)) {
            this.buckets = snapshot.buckets.map((b) => ({ ...b }));
        }
        if (snapshot.currentBucket) {
            this.currentBucket = { ...snapshot.currentBucket };
        } else {
            this.currentBucket = null;
        }
        if (typeof snapshot.bucketStartTime === 'number') {
            this.bucketStartTime = snapshot.bucketStartTime;
        }
    }
}
