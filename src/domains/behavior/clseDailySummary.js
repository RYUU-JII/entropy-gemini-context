import { getLocalDateStr } from '../../lib/index.js';
import { CLSE_CONSTANTS } from './clseSchema.js';

export function getCLSECalendarDayStart(ts) {
    const date = new Date(ts);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

function nextCalendarDayStart(ts) {
    const date = new Date(ts);
    date.setDate(date.getDate() + 1);
    return date.getTime();
}

export function getCLSEDailySummaryCompletionBoundary(now) {
    if (!Number.isSafeInteger(now) || now <= 0) {
        throw new Error('CLSE_DAILY_SUMMARY_TIMESTAMP_INVALID');
    }
    // Rolling 5min buckets retain yesterday's start until 00:04. Let those
    // windows close before completing the calendar day that owns their start.
    return getCLSECalendarDayStart(now - CLSE_CONSTANTS.BUCKET_5MIN_MS);
}

function buildCLSEDailySummary({ dateStr, buckets60s, buckets5min, updatedAt }) {
    const summary = {
        dateStr,
        schemaVersion: 1,
        source: 'clse_rollup_v1',
        bucket60sCount: buckets60s.length,
        bucket5minCount: buckets5min.length,
        totals: {
            activeMs: 0,
            idleMs: 0,
            tabSwitchCount: 0,
            navCount: 0,
            scrollEventCount: 0,
            scrollAbsDeltaSum: 0,
            mediaSeekCount: 0,
            loopDetectedCount: 0,
            loadSpikeMs: 0,
            sustainedLoadMs: 0,
        },
        rates: {
            tabSwitchPerActiveMin: 0,
            navPerActiveMin: 0,
            mediaSeekPerActiveMin: 0,
        },
        updatedAt,
    };

    for (const bucket of buckets60s) {
        summary.totals.activeMs += bucket.active_ms;
        summary.totals.idleMs += bucket.idle_ms;
        summary.totals.tabSwitchCount += bucket.tab_switch_count;
        summary.totals.navCount += bucket.nav_count;
        summary.totals.scrollEventCount += bucket.scroll_event_count;
        summary.totals.scrollAbsDeltaSum += bucket.scroll_abs_delta_sum;
        summary.totals.mediaSeekCount += bucket.media_seek_count;
    }
    for (const bucket of buckets5min) {
        summary.totals.loopDetectedCount += bucket.loop_detected_count;
        summary.totals.loadSpikeMs += bucket.time_in_load_spike_ms;
        summary.totals.sustainedLoadMs += bucket.time_in_sustained_load_ms;
    }

    const activeMinutes = summary.totals.activeMs / 60_000;
    if (activeMinutes > 0) {
        summary.rates.tabSwitchPerActiveMin = summary.totals.tabSwitchCount / activeMinutes;
        summary.rates.navPerActiveMin = summary.totals.navCount / activeMinutes;
        summary.rates.mediaSeekPerActiveMin = summary.totals.mediaSeekCount / activeMinutes;
    }
    return summary;
}

/** Called inside the service's admitted storage FIFO, before source retention. */
export async function completeCLSEDailySummaries({ repository, now }) {
    const completedBefore = getCLSEDailySummaryCompletionBoundary(now);
    const retainedAfter = getCLSECalendarDayStart(
        now - CLSE_CONSTANTS.RETENTION_DAILY_SUMMARY_DAYS * 86_400_000,
    );
    const firstBucket = await repository.getFirstBucket60s({
        startTs: retainedAfter,
        endTs: completedBefore - 1,
    });
    if (firstBucket === null) return completedBefore;

    const firstDayStart = getCLSECalendarDayStart(firstBucket.ts_start);
    const completedRows = await repository.getDailySummaries({
        startDateStr: getLocalDateStr(firstDayStart),
        endDateStr: getLocalDateStr(completedBefore - 1),
    });
    const completedDates = new Set(completedRows.map((row) => row.dateStr));
    let dayStart = firstDayStart;
    let candidate = firstBucket;
    while (dayStart < completedBefore) {
        if (completedDates.has(getLocalDateStr(dayStart))) {
            dayStart = nextCalendarDayStart(dayStart);
            continue;
        }
        if (candidate.ts_start < dayStart) {
            candidate = await repository.getFirstBucket60s({
                startTs: dayStart,
                endTs: completedBefore - 1,
            });
            // A successful empty source query means there are no observed
            // days left. It must not manufacture zero-valued history.
            if (candidate === null) break;
            dayStart = getCLSECalendarDayStart(candidate.ts_start);
            if (completedDates.has(getLocalDateStr(dayStart))) continue;
        }

        const nextDayStart = nextCalendarDayStart(dayStart);
        const range = { startTs: dayStart, endTs: nextDayStart - 1 };
        const [buckets60s, buckets5min] = await Promise.all([
            repository.getBuckets60s(range),
            repository.getBuckets5min(range),
        ]);
        if (buckets60s.length === 0) {
            throw new Error('CLSE_DAILY_SUMMARY_SOURCE_CHANGED');
        }
        // The existing typed row is also the durable completion marker. A
        // worker restart skips committed dates and retries an uncommitted date.
        await repository.addDailySummary(buildCLSEDailySummary({
            dateStr: getLocalDateStr(dayStart),
            buckets60s,
            buckets5min,
            updatedAt: now,
        }));
        dayStart = nextDayStart;
    }
    return completedBefore;
}
