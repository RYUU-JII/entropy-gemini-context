/**
 * LoopDetector - Compulsive Loop Pattern Detection
 * 
 * Detects repeated visits to the same page/site in short windows:
 * - Site-level loops (returning to same eTLD+1)
 * - Page-level loops (returning to same path bucket)
 * 
 * Uses HMAC-based keys to preserve privacy while enabling detection.
 */

import ClseRepository from '../../../platform/storage/clse/ClseRepository.js';
import { createLoopEvent } from '../clseSchema.js';
import { generateSiteKey, generatePageKey } from '../utils/hmacKey.js';

const clseRepository = ClseRepository.getInstance();

// Detection parameters
const LOOP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MIN_REPEAT_COUNT = 3; // 3 visits to same page in window
const SITE_MIN_REPEAT_COUNT = 5; // 5 visits to same site in window

// Events
export const LOOP_EVENTS = {
    PAGE_LOOP_DETECTED: 'PAGE_LOOP_DETECTED',
    SITE_LOOP_DETECTED: 'SITE_LOOP_DETECTED',
};

export class LoopDetector {
    constructor() {
        this._listeners = new Set();

        // Recent visit tracking (keyed visits in the detection window)
        this._recentPageVisits = new Map(); // pageKey -> timestamps[]
        this._recentSiteVisits = new Map(); // siteKey -> timestamps[]

        // Cooldown to prevent rapid-fire alerts
        this._lastPageAlert = new Map(); // pageKey -> timestamp
        this._lastSiteAlert = new Map(); // siteKey -> timestamp
        this._alertCooldownMs = 5 * 60 * 1000; // 5 minutes between alerts for same key
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
                console.warn('[CLSE:LoopDetector] Listener error:', err);
            }
        }
    }

    /**
     * Record a page visit and check for loops
     * @param {string} url - Full URL of the visited page
     * @returns {Object|null} - Loop event if detected
     */
    async recordVisit(url) {
        if (!url) return null;

        const now = Date.now();
        const siteKey = await generateSiteKey(url);
        const pageKey = await generatePageKey(url);

        if (!siteKey || !pageKey) return null;

        // Record page visit
        this._recordKey(this._recentPageVisits, pageKey, now);

        // Record site visit
        this._recordKey(this._recentSiteVisits, siteKey, now);

        // Check for page loop
        const pageLoop = await this._checkPageLoop(pageKey, siteKey, now);
        if (pageLoop) return pageLoop;

        // Check for site loop
        const siteLoop = await this._checkSiteLoop(siteKey, now);
        if (siteLoop) return siteLoop;

        return null;
    }

    _recordKey(map, key, ts) {
        if (!map.has(key)) {
            map.set(key, []);
        }
        map.get(key).push(ts);
    }

    async _checkPageLoop(pageKey, siteKey, now) {
        const visits = this._recentPageVisits.get(pageKey) || [];
        const recentVisits = visits.filter(ts => now - ts < LOOP_WINDOW_MS);

        // Update with filtered list
        this._recentPageVisits.set(pageKey, recentVisits);

        if (recentVisits.length < MIN_REPEAT_COUNT) return null;

        // Check cooldown
        const lastAlert = this._lastPageAlert.get(pageKey) || 0;
        if (now - lastAlert < this._alertCooldownMs) return null;

        this._lastPageAlert.set(pageKey, now);

        const event = createLoopEvent(
            now,
            siteKey,
            pageKey,
            recentVisits.length,
            LOOP_WINDOW_MS,
            LOOP_EVENTS.PAGE_LOOP_DETECTED,
        );

        // Persist to IndexedDB
        await clseRepository.addLoopEvent(event);

        this._emit(LOOP_EVENTS.PAGE_LOOP_DETECTED, event);
        console.debug('[CLSE:LoopDetector] Page loop detected:', pageKey, 'count:', recentVisits.length);

        return event;
    }

    async _checkSiteLoop(siteKey, now) {
        const visits = this._recentSiteVisits.get(siteKey) || [];
        const recentVisits = visits.filter(ts => now - ts < LOOP_WINDOW_MS);

        this._recentSiteVisits.set(siteKey, recentVisits);

        if (recentVisits.length < SITE_MIN_REPEAT_COUNT) return null;

        const lastAlert = this._lastSiteAlert.get(siteKey) || 0;
        if (now - lastAlert < this._alertCooldownMs) return null;

        this._lastSiteAlert.set(siteKey, now);

        const event = createLoopEvent(
            now,
            siteKey,
            null,
            recentVisits.length,
            LOOP_WINDOW_MS,
            LOOP_EVENTS.SITE_LOOP_DETECTED,
        );

        await clseRepository.addLoopEvent(event);

        this._emit(LOOP_EVENTS.SITE_LOOP_DETECTED, event);
        console.debug('[CLSE:LoopDetector] Site loop detected:', siteKey, 'count:', recentVisits.length);

        return event;
    }

    /**
     * Prune visits and cooldowns older than detection window
     * @param {number} now - Current timestamp in ms
     */
    prune(now = Date.now()) {
        const cutoff = now - LOOP_WINDOW_MS - 60000; // Extra minute buffer

        for (const [key, visits] of this._recentPageVisits) {
            const filtered = visits.filter(ts => ts > cutoff);
            if (filtered.length === 0) {
                this._recentPageVisits.delete(key);
            } else {
                this._recentPageVisits.set(key, filtered);
            }
        }

        for (const [key, visits] of this._recentSiteVisits) {
            const filtered = visits.filter(ts => ts > cutoff);
            if (filtered.length === 0) {
                this._recentSiteVisits.delete(key);
            } else {
                this._recentSiteVisits.set(key, filtered);
            }
        }

        // Cleanup old alert timestamps
        for (const [key, ts] of this._lastPageAlert) {
            if (now - ts > this._alertCooldownMs * 2) {
                this._lastPageAlert.delete(key);
            }
        }
        for (const [key, ts] of this._lastSiteAlert) {
            if (now - ts > this._alertCooldownMs * 2) {
                this._lastSiteAlert.delete(key);
            }
        }
    }

    /**
     * Get recent loop statistics
     */
    getStats() {
        return {
            trackedPages: this._recentPageVisits.size,
            trackedSites: this._recentSiteVisits.size,
        };
    }

    /**
     * Serialize loop detector window state
     */
    serialize() {
        return {
            recentPageVisits: Array.from(this._recentPageVisits.entries()),
            recentSiteVisits: Array.from(this._recentSiteVisits.entries()),
            lastPageAlert: Array.from(this._lastPageAlert.entries()),
            lastSiteAlert: Array.from(this._lastSiteAlert.entries()),
        };
    }

    /**
     * Hydrate loop detector window state from snapshot
     */
    hydrate(snapshot) {
        if (!snapshot) return;
        if (Array.isArray(snapshot.recentPageVisits)) {
            this._recentPageVisits = new Map(snapshot.recentPageVisits);
        }
        if (Array.isArray(snapshot.recentSiteVisits)) {
            this._recentSiteVisits = new Map(snapshot.recentSiteVisits);
        }
        if (Array.isArray(snapshot.lastPageAlert)) {
            this._lastPageAlert = new Map(snapshot.lastPageAlert);
        }
        if (Array.isArray(snapshot.lastSiteAlert)) {
            this._lastSiteAlert = new Map(snapshot.lastSiteAlert);
        }
    }
}
