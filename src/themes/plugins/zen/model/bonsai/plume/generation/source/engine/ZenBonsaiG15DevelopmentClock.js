/** Product age in scheduler-event units, independent of the generated prefix. */
export const ZEN_G15_DEVELOPMENT_CLOCK = 'zen_g15_development_clock_v1';
const MIN_EVENTS = 2; // root emergence and its first visible shoot

function requireRange(value, min, max, name) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
        throw new Error(`ZEN_G15_CLOCK_${name}_INVALID`);
    }
    return value;
}

export function resolveZenG15DevelopmentClock(growth, maxEvents = 160) {
    requireRange(growth, 0, 1, 'GROWTH');
    requireRange(maxEvents, MIN_EVENTS, 240, 'BUDGET');
    if (!Number.isInteger(maxEvents)) throw new Error('ZEN_G15_CLOCK_BUDGET_INVALID');
    const continuousEvents = MIN_EVENTS + (maxEvents - MIN_EVENTS)
        * (growth * 0.85 + Math.pow(growth, 1.35) * 0.15);
    const completedEvents = Math.floor(continuousEvents);
    const subEventProgress = continuousEvents - completedEvents;
    return Object.freeze({
        contract: ZEN_G15_DEVELOPMENT_CLOCK,
        progress: growth,
        minEvents: MIN_EVENTS,
        maxEvents,
        continuousEvents,
        completedEvents,
        materializedEvents: Math.ceil(continuousEvents),
        activeEventSequence: subEventProgress > 0 ? completedEvents : null,
        subEventProgress,
    });
}

/** A settled prefix has no pending event, but its wood can continue to mature. */
export function resolveZenG15SceneClock(clock, eventCount, progressOverride) {
    if (clock?.contract !== ZEN_G15_DEVELOPMENT_CLOCK) {
        throw new Error('ZEN_G15_CLOCK_REQUIRED');
    }
    const canonical = resolveZenG15DevelopmentClock(clock.progress, clock.maxEvents);
    for (const key of Object.keys(canonical)) {
        if (canonical[key] !== clock[key]) throw new Error(`ZEN_G15_CLOCK_${key}_MISMATCH`);
    }
    requireRange(eventCount, MIN_EVENTS, clock.materializedEvents, 'EVENT_COUNT');
    if (!Number.isInteger(eventCount)) throw new Error('ZEN_G15_CLOCK_EVENT_COUNT_INVALID');
    const activeEventSequence = clock.activeEventSequence !== null
        && clock.activeEventSequence < eventCount ? clock.activeEventSequence : null;
    if (progressOverride !== undefined && activeEventSequence === null) {
        throw new Error('ZEN_G15_CLOCK_NO_ACTIVE_EVENT');
    }
    const subEventProgress = activeEventSequence === null ? 1
        : (progressOverride === undefined ? clock.subEventProgress
            : requireRange(progressOverride, 0, 1, 'FRACTION'));
    const eventTime = activeEventSequence === null ? clock.continuousEvents - 1
        : activeEventSequence - 1 + subEventProgress;
    return Object.freeze({
        contract: ZEN_G15_DEVELOPMENT_CLOCK,
        progress: clock.progress,
        eventTime,
        eventLimit: eventCount - 1,
        completedEventLimit: Math.min(eventCount - 1, Math.floor(eventTime)),
        maximumEvent: clock.maxEvents - 1,
        activeEventSequence,
        subEventProgress,
    });
}
