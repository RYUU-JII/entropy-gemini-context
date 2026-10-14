import { tRuntime } from '../../../../domains/settings/i18n/scheduleRuntime.js';

const DAY_KEYS = Object.freeze(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']);

export function getDayLabels() {
    return DAY_KEYS.map((dayKey) =>
        tRuntime(`schedule:days.${dayKey}`)
    );
}

export const DEFAULT_GEO = { lat: 37.5665, lon: 126.978, source: 'fallback' };
export const EXPORT_WINDOW_DAYS = 7;
export const GEO_MAX_AGE_MS = 6 * 60 * 60 * 1000;
