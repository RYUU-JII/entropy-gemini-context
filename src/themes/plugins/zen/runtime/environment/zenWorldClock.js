const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const CLOCK_TIME_ZONE_PARTS = Object.freeze(['year', 'month', 'day', 'hour', 'minute', 'second']);
const timeZoneDateTimeFormatterCache = new Map();

const toFiniteInt = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.trunc(numeric) : null;
};

const clampNumber = (value, min, max) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return min;
    return Math.min(max, Math.max(min, numeric));
};

const buildClockContextFromParts = ({
    year,
    month,
    day,
    hour,
    minute,
    second,
}) => {
    const yearInt = toFiniteInt(year);
    const monthInt = toFiniteInt(month);
    const dayInt = toFiniteInt(day);
    const hourInt = toFiniteInt(hour);
    const minuteInt = toFiniteInt(minute);
    const secondInt = toFiniteInt(second);
    if (
        yearInt === null
        || monthInt === null
        || dayInt === null
        || hourInt === null
        || minuteInt === null
        || secondInt === null
    ) {
        return null;
    }
    const calendarDayMs = Date.UTC(yearInt, monthInt - 1, dayInt);
    if (!Number.isFinite(calendarDayMs)) return null;
    const startOfYearMs = Date.UTC(yearInt, 0, 1);
    const dayOfYear = Math.max(1, Math.floor((calendarDayMs - startOfYearMs) / DAY_MS) + 1);
    const dayIndex = Math.floor(calendarDayMs / DAY_MS);
    const normalizedHour = hourInt >= 24 ? 0 : clampNumber(hourInt, 0, 23);
    const normalizedMinute = clampNumber(minuteInt, 0, 59);
    const normalizedSecond = clampNumber(secondInt, 0, 59);
    const hourDecimal = normalizedHour + normalizedMinute / 60 + normalizedSecond / 3600;
    return {
        hour: hourDecimal,
        year: yearInt,
        dayOfYear,
        dayIndex,
    };
};

const resolveCachedTimeZoneFormatter = (timeZone) => {
    if (!timeZone) return null;
    if (timeZoneDateTimeFormatterCache.has(timeZone)) {
        return timeZoneDateTimeFormatterCache.get(timeZone);
    }
    let formatter = null;
    try {
        formatter = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hour12: false,
            hourCycle: 'h23',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
        formatter.format(new Date());
    } catch (_) {
        throw new Error(`ZEN_WORLD_TIME_ZONE_INVALID:${timeZone}`);
    }
    timeZoneDateTimeFormatterCache.set(timeZone, formatter);
    return formatter;
};

const resolveTimeZoneClockContext = (date, timeZone) => {
    const formatter = resolveCachedTimeZoneFormatter(timeZone);
    if (!formatter) return null;

    const valuesByType = {};
    const parts = formatter.formatToParts(date);
    for (let i = 0; i < parts.length; i += 1) {
        const part = parts[i];
        if (!CLOCK_TIME_ZONE_PARTS.includes(part.type)) continue;
        valuesByType[part.type] = part.value;
    }
    return buildClockContextFromParts(valuesByType);
};

const resolveClockInputDate = (options) => {
    const rawNow = options && typeof options === 'object' ? options.now : null;
    if (rawNow instanceof Date && !Number.isNaN(rawNow.getTime())) {
        return new Date(rawNow.getTime());
    }
    if (typeof rawNow === 'number' && Number.isFinite(rawNow)) {
        const fromEpoch = new Date(rawNow);
        if (!Number.isNaN(fromEpoch.getTime())) return fromEpoch;
    }
    if (typeof rawNow === 'string' && rawNow.length > 0) {
        const fromString = new Date(rawNow);
        if (!Number.isNaN(fromString.getTime())) return fromString;
    }
    return new Date();
};

const resolveRequestedTimeZone = (options) => {
    if (typeof options === 'string') {
        const trimmed = options.trim();
        return trimmed.length > 0 ? trimmed : '';
    }
    if (options && typeof options === 'object' && typeof options.timeZone === 'string') {
        const trimmed = options.timeZone.trim();
        return trimmed.length > 0 ? trimmed : '';
    }
    return '';
};

export const getRealtimeClockContext = (options = null) => {
    const now = resolveClockInputDate(options);
    const requestedTimeZone = resolveRequestedTimeZone(options);
    const timeZoneContext = resolveTimeZoneClockContext(now, requestedTimeZone);
    if (timeZoneContext) {
        return {
            ...timeZoneContext,
            timestampMs: now.getTime(),
            timeZone: requestedTimeZone,
        };
    }

    const context = buildClockContextFromParts({
        year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate(),
        hour: now.getHours(), minute: now.getMinutes(), second: now.getSeconds(),
    });
    return {
        ...context,
        timestampMs: now.getTime(),
        timeZone: null,
    };
};

export const getRealtimeHour = (options = null) => {
    return getRealtimeClockContext(options).hour;
};

export const normalizeZenPresentationHour = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > 24) {
        throw new Error('ZEN_WORLD_PRESENTATION_HOUR_INVALID');
    }
    return numeric;
};

export const resolveZenLocalHourEpochMs = ({ timestampMs, hour, timeZone = '' }) => {
    if (!Number.isFinite(timestampMs)) throw new Error('ZEN_WORLD_PRESENTATION_TIMESTAMP_REQUIRED');
    const desiredHour = normalizeZenPresentationHour(hour);
    if (desiredHour === null) throw new Error('ZEN_WORLD_PRESENTATION_HOUR_REQUIRED');
    const source = getRealtimeClockContext({ now: timestampMs, timeZone });
    const localMidnight = Date.UTC(source.year, 0, source.dayOfYear);
    const desiredLocalEpoch = localMidnight + desiredHour * HOUR_MS;
    let epoch = timestampMs + (desiredHour - source.hour) * HOUR_MS;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const context = getRealtimeClockContext({ now: epoch, timeZone });
        const actualLocalEpoch = Date.UTC(context.year, 0, context.dayOfYear) + context.hour * HOUR_MS;
        const delta = desiredLocalEpoch - actualLocalEpoch;
        if (Math.abs(delta) < 1) return Math.floor(epoch / 1000) * 1000;
        epoch += delta;
    }
    throw new Error('ZEN_WORLD_PRESENTATION_LOCAL_TIME_NONEXISTENT');
};

export const resolveZenPresentationTimeContext = (
    timeContext,
    presentationHour = null,
) => {
    const hour = normalizeZenPresentationHour(presentationHour);
    if (hour === null) return timeContext;
    if (!timeContext || typeof timeContext !== 'object') {
        throw new Error('ZEN_WORLD_PRESENTATION_TIME_CONTEXT_REQUIRED');
    }
    const sourceHour = Number(timeContext.hour);
    const sourceTimestampMs = Number(timeContext.timestampMs);
    if (!Number.isFinite(sourceHour) || !Number.isFinite(sourceTimestampMs)) {
        throw new Error('ZEN_WORLD_PRESENTATION_TIME_CONTEXT_INVALID');
    }
    const timestampMs = resolveZenLocalHourEpochMs({
        timestampMs: sourceTimestampMs,
        hour,
        timeZone: typeof timeContext.timeZone === 'string' ? timeContext.timeZone : '',
    });
    return Object.freeze({
        ...getRealtimeClockContext({
            now: timestampMs,
            timeZone: typeof timeContext.timeZone === 'string' ? timeContext.timeZone : '',
        }),
        presentationHour: hour,
    });
};
