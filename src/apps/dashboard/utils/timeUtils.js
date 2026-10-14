export function clampHour(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(23, Math.floor(n)));
}

export function sumHourlyRange(hourly, startHour, endHour) {
    if (!Array.isArray(hourly)) return 0;
    let sum = 0;
    // Handle wrapping if endHour < startHour (though usually day logic handles it)
    // Here assuming simpler case or 0-23
    if (startHour <= endHour) {
        for (let h = startHour; h < endHour; h++) {
            sum += Number(hourly[h]) || 0;
        }
    } else {
        // wrap
        for (let h = startHour; h < 24; h++) {
            sum += Number(hourly[h]) || 0;
        }
        for (let h = 0; h < endHour; h++) {
            sum += Number(hourly[h]) || 0;
        }
    }
    return sum;
}

export function findFirstActiveHour(hourly, thresholdMs) {
    if (!Array.isArray(hourly)) return -1;
    const th = thresholdMs || 0;
    for (let h = 0; h < 24; h++) {
        if ((Number(hourly[h]) || 0) >= th) return h;
    }
    return -1;
}

export function findFirstActiveHourInWindow(hourly, startHour, endHour, thresholdMs) {
    if (!Array.isArray(hourly)) return null;
    const th = thresholdMs || 0;
    if (startHour <= endHour) {
        for (let h = startHour; h < endHour; h++) {
            if ((Number(hourly[h]) || 0) >= th) return h;
        }
    } else {
        for (let h = startHour; h < 24; h++) {
            if ((Number(hourly[h]) || 0) >= th) return h;
        }
        for (let h = 0; h < endHour; h++) {
            if ((Number(hourly[h]) || 0) >= th) return h;
        }
    }
    return null;
}

export function resolveWakeActivityHour(hourly, averageWakeHour, thresholdMs, windowHours) {
    const avg = averageWakeHour;
    if (!hourly) return avg;

    // Search window around average wake time
    // e.g., avg - 1 to avg + windowHours
    // Normalize hours
    const start = (avg - 1 + 24) % 24; // 1 hr before
    const end = (avg + windowHours) % 24;

    const found = findFirstActiveHourInWindow(hourly, start, end, thresholdMs);
    return found !== null ? found : avg;
}
