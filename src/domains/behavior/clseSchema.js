import { STORAGE_RETENTION_DAYS } from '../../platform/storage/retention/storageRetentionPolicy.js';

/**
 * Cognitive Load Sensing Engine - Schema Definitions
 * 
 * Type definitions for CLSE data structures:
 * - 10s/60s/5min bucket records
 * - Loop detection events
 * - Baseline parameters
 */

// ============================================================
// STORE NAMES
// ============================================================
export const CLSE_STORES = {
    BUCKETS_60S: 'clse_buckets_60s',
    BUCKETS_5MIN: 'clse_buckets_5min',
    LOOP_EVENTS: 'clse_loop_events',
    BASELINE: 'clse_baseline',
};

// ============================================================
// 10-SECOND BUCKET (RAM Ring Buffer - not persisted directly)
// ============================================================
/**
 * @typedef {Object} Bucket10s
 * @property {number} ts_start - Bucket start timestamp (ms)
 * @property {number} duration_ms - Always 10000
 * @property {number} active_ms - Active time in bucket
 * @property {number} idle_ms - Idle time in bucket
 * 
 * @property {number} tab_switch_count - Tab switches
 * @property {number} tab_open_count - Open tabs at end of bucket
 * @property {number} visibility_change_count - Visibility changes
 * 
 * @property {number} nav_count - Navigation events
 * @property {number} back_forward_count - Back/forward navigations
 * @property {number} same_site_jump_count - Same-site navigations
 * @property {number} cross_site_jump_count - Cross-site navigations
 * 
 * @property {number} scroll_event_count - Scroll events
 * @property {number} scroll_abs_delta_sum - Absolute scroll delta sum
 * @property {number} scroll_dir_change_count - Direction changes
 * @property {number} scroll_velocity_mean - Mean scroll velocity
 * @property {number} scroll_velocity_var - Scroll velocity variance (Welford)
 * @property {number} scroll_n - Sample count for Welford (internal)
 * 
 * @property {number} content_add_count - Added DOM nodes (coarse)
 * @property {number} feed_item_add_count - Added feed items (best-effort)
 * @property {number} short_dwell_count - Short dwell events (tab bounces)
 * 
 * @property {number} media_seek_count - Media seek events
 * @property {number} media_rate_change_count - Playback rate changes
 * @property {number} media_pause_play_count - Pause/play toggles
 */

export function createBucket10s(tsStart) {
    return {
        ts_start: tsStart,
        duration_ms: 10000,
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

// ============================================================
// 60-SECOND BUCKET (Persisted to IndexedDB)
// ============================================================
/**
 * @typedef {Object} Bucket60s
 * @property {number} ts_start - Bucket start timestamp (ms)
 * @property {number} duration_ms - Always 60000
 * @property {number} active_ms - Active time in bucket
 * @property {number} idle_ms - Idle time in bucket
 * 
 * @property {number} tab_switch_count - Total tab switches
 * @property {number} tab_open_count_avg - Average open tabs
 * @property {number} visibility_change_count - Visibility changes
 * 
 * @property {number} nav_count - Total navigations
 * @property {number} back_forward_count - Back/forward navigations
 * @property {number} same_site_jump_count - Same-site navigations
 * @property {number} cross_site_jump_count - Cross-site navigations
 * 
 * @property {number} scroll_event_count - Total scroll events
 * @property {number} scroll_abs_delta_sum - Total absolute scroll delta
 * @property {number} scroll_dir_change_count - Direction changes
 * @property {number} scroll_velocity_mean - Mean scroll velocity
 * @property {number} scroll_velocity_var - Scroll velocity variance
 * @property {number} content_add_count - Added DOM nodes (coarse)
 * @property {number} feed_item_add_count - Added feed items (best-effort)
 * @property {number} short_dwell_count - Short dwell events (tab bounces)
 * 
 * @property {number} media_seek_count - Media seek events
 * @property {number} media_rate_change_count - Playback rate changes
 * @property {number} media_pause_play_count - Pause/play toggles
 * 
 * @property {number} peak_10s_tab_switch - Peak 10s tab switches
 * @property {number} peak_10s_nav - Peak 10s navigations
 * @property {number} peak_10s_scroll_abs_delta - Peak 10s scroll delta
 */

export function createBucket60s(tsStart) {
    return {
        ts_start: tsStart,
        duration_ms: 60000,
        active_ms: 0,
        idle_ms: 0,

        tab_switch_count: 0,
        tab_open_count_avg: 0,
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
        content_add_count: 0,
        feed_item_add_count: 0,
        short_dwell_count: 0,

        media_seek_count: 0,
        media_rate_change_count: 0,
        media_pause_play_count: 0,

        // Peak values from 10s buckets (for burst detection)
        peak_10s_tab_switch: 0,
        peak_10s_nav: 0,
        peak_10s_scroll_abs_delta: 0,
    };
}

// ============================================================
// 5-MINUTE BUCKET (Persisted to IndexedDB)
// ============================================================
/**
 * @typedef {Object} Bucket5min
 * @property {number} ts_start - Bucket start timestamp (ms)
 * @property {number} duration_ms - Always 300000
 * @property {number} active_ms - Active time in bucket
 * @property {number} idle_ms - Idle time in bucket
 * 
 * @property {number} tab_switch_rate_mean - Mean tab switch rate (per active second)
 * @property {number} nav_rate_mean - Mean nav rate
 * @property {number} scroll_volatility_mean - Mean scroll volatility index
 * @property {number} seek_rate_mean - Mean media seek rate
 * 
 * @property {number} peak_60s_load_index - Peak 60s composite load index
 * @property {number} time_in_load_spike_ms - Time spent in spike state
 * @property {number} time_in_sustained_load_ms - Time in sustained load
 * @property {number} loop_detected_count - Loop detections in this window
 */

export function createBucket5min(tsStart) {
    return {
        ts_start: tsStart,
        duration_ms: 300000,
        active_ms: 0,
        idle_ms: 0,

        tab_switch_rate_mean: 0,
        nav_rate_mean: 0,
        scroll_volatility_mean: 0,
        seek_rate_mean: 0,

        peak_60s_load_index: 0,
        time_in_load_spike_ms: 0,
        time_in_sustained_load_ms: 0,
        loop_detected_count: 0,
    };
}

// ============================================================
// LOOP DETECTION EVENT
// ============================================================
/**
 * @typedef {Object} LoopEvent
 * @property {number} ts - Detection timestamp
 * @property {string} event - Always 'LOOP_DETECTED'
 * @property {string} site_key - HMAC(secret, eTLD+1)
 * @property {string} page_key - HMAC(secret, eTLD+1 + coarse_path)
 * @property {number} repeat_count - Repeat visits in window
 * @property {number} window_ms - Detection window size
 */

export function createLoopEvent(ts, siteKey, pageKey, repeatCount, windowMs, type) {
    return {
        ts,
        event: 'LOOP_DETECTED',
        type,
        site_key: siteKey,
        page_key: pageKey,
        repeat_count: repeatCount,
        window_ms: windowMs,
    };
}

// ============================================================
// CONSTANTS
// ============================================================
export const CLSE_CONSTANTS = {
    BUCKET_10S_MS: 10000,
    BUCKET_60S_MS: 60000,
    BUCKET_5MIN_MS: 300000,

    RING_BUFFER_SIZE: 18, // ~3 minutes of 10s buckets

    // Feature flag key
    FEATURE_FLAG_KEY: 'clse_enabled',
    SENSITIVITY_SCALE_KEY: 'clse_sensitivity_scale',
    SENSITIVITY_SCALE_MIN: 0.7,
    SENSITIVITY_SCALE_MAX: 1.5,
    SENSITIVITY_SCALE_DEFAULT: 1,
    ALERT_COOLDOWN_DEFAULT_MS: 2 * 60 * 1000,
    ALERT_COOLDOWN_MIN_MS: 30 * 1000,
    ALERT_COOLDOWN_MAX_MS: 10 * 60 * 1000,

    // Retention
    RETENTION_DAYS: STORAGE_RETENTION_DAYS.CLSE_DIAGNOSTICS,
    RETENTION_60S_DAYS: STORAGE_RETENTION_DAYS.CLSE_60S_BUCKETS,
    RETENTION_5MIN_DAYS: STORAGE_RETENTION_DAYS.CLSE_5MIN_BUCKETS,
    RETENTION_DAILY_SUMMARY_DAYS: STORAGE_RETENTION_DAYS.CLSE_DAILY_SUMMARIES,
};
