import { normalizeDays } from './scheduleModel.js';
import { getDayLabels } from './constants.js';
import { getLocalDateStr } from '../../../../lib/index.js';
import { tRuntime } from '../../../../domains/settings/i18n/scheduleRuntime.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export function formatDays(days) {
    const normalized = normalizeDays(days);
    const daySet = new Set(normalized);
    if (daySet.size === 7) return tRuntime('schedule:presets.all');
    if ([1, 2, 3, 4, 5].every((day) => daySet.has(day)) && daySet.size === 5) {
        return tRuntime('schedule:presets.weekday');
    }
    if (daySet.has(0) && daySet.has(6) && daySet.size === 2) {
        return tRuntime('schedule:presets.weekend');
    }
    const labels = getDayLabels();
    return normalized.map((day) => labels[day]).join(' · ');
}

export function buildDurationCopyDescriptor(totalMinutes) {
    const safe = Math.max(0, Math.round(totalMinutes || 0));
    const hours = Math.floor(safe / 60);
    const minutes = safe % 60;
    if (hours > 0 && minutes > 0) {
        return { key: 'schedule:duration.hours_minutes', params: { hours, minutes } };
    }
    if (hours > 0) {
        return { key: 'schedule:duration.hours', params: { hours } };
    }
    return { key: 'schedule:duration.minutes', params: { minutes } };
}

export function formatDuration(totalMinutes) {
    const { key, params } = buildDurationCopyDescriptor(totalMinutes);
    return tRuntime(key, params);
}

export function getRecentDateStrs(windowDays) {
    const days = Math.max(1, Number(windowDays) || 1);
    const dateStrs = [];
    for (let offset = 0; offset < days; offset += 1) {
        dateStrs.push(getLocalDateStr(Date.now() - DAY_MS * offset));
    }
    return dateStrs.reverse();
}
