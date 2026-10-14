const TAU = Math.PI * 2;
const WEATHER_DAY_HOURS = 24;
const WEATHER_DAY_MS = WEATHER_DAY_HOURS * 60 * 60 * 1000;
const RAIN_GUARANTEE_BLOCK_DAYS = 5;
const MIDNIGHT_REGIME_BLEND_HOURS = 2;
const RAIN_CELL_SLOT_OCCUPANCY = 0.68;

export const ZEN_WEATHER_EVENT_DIRECTOR_VERSION = 2;

export const ZEN_WEATHER_REGIMES = Object.freeze({
    CLEAR: 'clear',
    VARIABLE: 'variable',
    OVERCAST: 'overcast',
    RAIN_FRONT: 'rain_front',
});

export const ZEN_WEATHER_EVENT_KINDS = Object.freeze({
    NONE: 'none',
    PASSING_SHOWER: 'passing_shower',
    STEADY_RAIN: 'steady_rain',
    SUNSHOWER: 'sunshower',
});

export const ZEN_WEATHER_EVENT_PHASES = Object.freeze({
    AMBIENT: 'ambient',
    CLOUD_BUILD: 'cloud_build',
    LULL: 'lull',
    DRIZZLE: 'drizzle',
    RAIN: 'rain',
    EASING: 'easing',
    AFTER_RAIN: 'after_rain',
});

const WEATHER_REGIME_PROFILES = Object.freeze({
    [ZEN_WEATHER_REGIMES.CLEAR]: Object.freeze({
        cloudTarget: 0.18,
        cloudSpread: 0.18,
    }),
    [ZEN_WEATHER_REGIMES.VARIABLE]: Object.freeze({
        cloudTarget: 0.46,
        cloudSpread: 0.28,
    }),
    [ZEN_WEATHER_REGIMES.OVERCAST]: Object.freeze({
        cloudTarget: 0.78,
        cloudSpread: 0.17,
    }),
    [ZEN_WEATHER_REGIMES.RAIN_FRONT]: Object.freeze({
        cloudTarget: 0.44,
        cloudSpread: 0.22,
    }),
});

const RAIN_FRONT_TEMPLATES = Object.freeze({
    [ZEN_WEATHER_EVENT_KINDS.PASSING_SHOWER]: Object.freeze({
        cloudBuildRange: Object.freeze([0.6, 1.5]),
        precipitationWindowRange: Object.freeze([2, 6]),
        afterRainRange: Object.freeze([1.2, 3]),
        rainCellCountRange: Object.freeze([1, 3]),
        rainCellDurationRange: Object.freeze([1 / 3, 1.5]),
        rainCellIntensityRange: Object.freeze([0.52, 0.82]),
        cloudPeak: 0.9,
        postRainCloud: 0.42,
        pulseAmount: 0.28,
        windFrontGain: 0.58,
        gustGain: 0.42,
        hazeGain: 0.52,
        steadyRain: false,
    }),
    [ZEN_WEATHER_EVENT_KINDS.STEADY_RAIN]: Object.freeze({
        cloudBuildRange: Object.freeze([1, 3]),
        precipitationWindowRange: Object.freeze([3, 12]),
        afterRainRange: Object.freeze([1.5, 4]),
        rainCellCountRange: Object.freeze([1, 1]),
        rainCellDurationRange: Object.freeze([3, 12]),
        rainCellIntensityRange: Object.freeze([0.5, 0.78]),
        cloudPeak: 0.97,
        postRainCloud: 0.58,
        pulseAmount: 0.14,
        windFrontGain: 0.66,
        gustGain: 0.34,
        hazeGain: 0.7,
        steadyRain: true,
    }),
    [ZEN_WEATHER_EVENT_KINDS.SUNSHOWER]: Object.freeze({
        cloudBuildRange: Object.freeze([0.25, 0.9]),
        precipitationWindowRange: Object.freeze([0.75, 2.25]),
        afterRainRange: Object.freeze([0.6, 1.6]),
        rainCellCountRange: Object.freeze([1, 2]),
        rainCellDurationRange: Object.freeze([0.25, 5 / 6]),
        rainCellIntensityRange: Object.freeze([0.34, 0.58]),
        cloudPeak: 0.48,
        postRainCloud: 0.22,
        pulseAmount: 0.22,
        windFrontGain: 0.34,
        gustGain: 0.28,
        hazeGain: 0.18,
        steadyRain: false,
    }),
});

const clamp = (value, min, max) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return min;
    return Math.min(max, Math.max(min, numeric));
};

const clamp01 = (value) => clamp(value, 0, 1);
const mix = (from, to, progress) => from + (to - from) * clamp01(progress);
const fract = (value) => value - Math.floor(value);

const smoothstep = (edge0, edge1, value) => {
    if (edge0 === edge1) return value < edge0 ? 0 : 1;
    const progress = clamp01((value - edge0) / (edge1 - edge0));
    return progress * progress * (3 - 2 * progress);
};

const hashUnit = (value) => {
    const sample = Math.sin(value * 127.1 + 311.7) * 43758.5453123;
    return fract(sample);
};

const noise1D = (value) => {
    const left = Math.floor(value);
    const progress = value - left;
    const eased = progress * progress * (3 - 2 * progress);
    return mix(hashUnit(left), hashUnit(left + 1), eased);
};

const positiveModulo = (value, divisor) => (
    ((value % divisor) + divisor) % divisor
);

const requireFiniteWeatherInput = (value, fieldName) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`ZEN_WEATHER_EVENT_TIME_INVALID:${fieldName}`);
    }
    return value;
};

const normalizeDayOfYear = (value) => (
    positiveModulo(Math.floor(value) - 1, 366) + 1
);

const resolveAdjacentCalendarDayOfYear = (dayIndex, offset) => {
    // dayIndex already encodes the authority's LOCAL calendar date at UTC
    // midnight. It is not the sampled instant's UTC date; retain that owner
    // while resolving Gregorian year/leap-day boundaries for adjacent fronts.
    const date = new Date((dayIndex + offset) * WEATHER_DAY_MS);
    if (!Number.isFinite(date.getTime())) {
        throw new Error('ZEN_WEATHER_EVENT_CALENDAR_INVALID:dayIndex');
    }
    const startOfYear = new Date(date);
    startOfYear.setUTCMonth(0, 1);
    return Math.floor((date.getTime() - startOfYear.getTime()) / WEATHER_DAY_MS) + 1;
};

const resolveSeasonalWetness = (dayOfYear) => {
    const day = normalizeDayOfYear(dayOfYear);
    const broadWetSeason = Math.sin((TAU * (day - 112)) / 366);
    const lateSummerPulse = Math.sin((TAU * 2 * (day - 154)) / 366);
    return clamp01(0.5 + broadWetSeason * 0.26 + lateSummerPulse * 0.08);
};

const resolveGuaranteedRainOffset = (blockIndex) => (
    Math.min(
        RAIN_GUARANTEE_BLOCK_DAYS - 1,
        Math.floor(
            hashUnit(blockIndex * 19.73 + 407.1)
            * RAIN_GUARANTEE_BLOCK_DAYS,
        ),
    )
);

const resolveRainEventKind = ({
    dayIndex,
    seasonalWetness,
}) => {
    const kindSignal = hashUnit(dayIndex * 2.117 + 811.9);
    const steadyChance = 0.22 + seasonalWetness * 0.2;
    const sunshowerChance = 0.1 + (1 - seasonalWetness) * 0.08;
    if (kindSignal < steadyChance) {
        return ZEN_WEATHER_EVENT_KINDS.STEADY_RAIN;
    }
    if (kindSignal < steadyChance + sunshowerChance) {
        return ZEN_WEATHER_EVENT_KINDS.SUNSHOWER;
    }
    return ZEN_WEATHER_EVENT_KINDS.PASSING_SHOWER;
};

const resolveDryRegime = ({
    dayIndex,
    seasonalWetness,
}) => {
    const regimeSignal = hashUnit(dayIndex * 1.731 + 229.4);
    const overcastChance = 0.14 + seasonalWetness * 0.16;
    if (regimeSignal < overcastChance) {
        return ZEN_WEATHER_REGIMES.OVERCAST;
    }
    if (regimeSignal < overcastChance + 0.34) {
        return ZEN_WEATHER_REGIMES.VARIABLE;
    }
    return ZEN_WEATHER_REGIMES.CLEAR;
};

const sampleDay = (dayIndex, salt) => (
    hashUnit(dayIndex * 3.191 + salt)
);

const sampleRange = (range, sample) => (
    mix(range[0], range[1], sample)
);

const sampleIntegerRange = (range, sample) => (
    range[0] + Math.min(
        range[1] - range[0],
        Math.floor(sample * (range[1] - range[0] + 1)),
    )
);

const resolveRainCells = ({
    dayIndex,
    template,
    cloudBuildHours,
    precipitationWindowHours,
    rainCellCount,
}) => {
    if (template.steadyRain) {
        return Object.freeze([
            Object.freeze({
                index: 0,
                startOffsetHours: cloudBuildHours,
                durationHours: precipitationWindowHours,
                endOffsetHours: cloudBuildHours + precipitationWindowHours,
                peakIntensity: sampleRange(
                    template.rainCellIntensityRange,
                    sampleDay(dayIndex, 181.3),
                ),
                noiseSeed: sampleDay(dayIndex, 197.1) * 1000,
                steadyRain: true,
            }),
        ]);
    }

    const slotHours = precipitationWindowHours / rainCellCount;
    return Object.freeze(
        Array.from({ length: rainCellCount }, (_, index) => {
            const durationMax = Math.min(
                template.rainCellDurationRange[1],
                slotHours * RAIN_CELL_SLOT_OCCUPANCY,
            );
            const durationHours = sampleRange(
                [
                    template.rainCellDurationRange[0],
                    Math.max(template.rainCellDurationRange[0], durationMax),
                ],
                sampleDay(dayIndex, 211.7 + index * 17.3),
            );
            const slotStart = slotHours * index;
            const slackHours = Math.max(0, slotHours - durationHours);
            const localStart = index === rainCellCount - 1
                ? slotStart + slackHours
                : (
                    slotStart
                    + slackHours * sampleDay(dayIndex, 263.9 + index * 23.1)
                );
            const startOffsetHours = cloudBuildHours + localStart;
            return Object.freeze({
                index,
                startOffsetHours,
                durationHours,
                endOffsetHours: startOffsetHours + durationHours,
                peakIntensity: sampleRange(
                    template.rainCellIntensityRange,
                    sampleDay(dayIndex, 307.1 + index * 29.7),
                ),
                noiseSeed: sampleDay(dayIndex, 353.3 + index * 31.9) * 1000,
                steadyRain: false,
            });
        }),
    );
};

const resolveRainFrontProfile = ({
    dayIndex,
    eventKind,
}) => {
    const template = RAIN_FRONT_TEMPLATES[eventKind];
    if (!template) return null;

    const rainCellCount = sampleIntegerRange(
        template.rainCellCountRange,
        sampleDay(dayIndex, 103.7),
    );
    const minimumWindowHours = (
        rainCellCount
        * template.rainCellDurationRange[0]
        / RAIN_CELL_SLOT_OCCUPANCY
    );
    const cloudBuildHours = sampleRange(
        template.cloudBuildRange,
        sampleDay(dayIndex, 127.9),
    );
    const precipitationWindowHours = Math.max(
        minimumWindowHours,
        sampleRange(
            template.precipitationWindowRange,
            sampleDay(dayIndex, 149.3),
        ),
    );
    const afterRainHours = sampleRange(
        template.afterRainRange,
        sampleDay(dayIndex, 167.5),
    );
    const rainCells = resolveRainCells({
        dayIndex,
        template,
        cloudBuildHours,
        precipitationWindowHours,
        rainCellCount,
    });

    return Object.freeze({
        cloudBuildHours,
        precipitationWindowHours,
        afterRainHours,
        frontDurationHours: (
            cloudBuildHours
            + precipitationWindowHours
            + afterRainHours
        ),
        cloudPeak: template.cloudPeak,
        postRainCloud: template.postRainCloud,
        pulseAmount: template.pulseAmount,
        windFrontGain: template.windFrontGain,
        gustGain: template.gustGain,
        hazeGain: template.hazeGain,
        steadyRain: template.steadyRain,
        rainCells,
    });
};

export const resolveZenDailyWeatherSchedule = ({
    dayIndex,
    dayOfYear,
} = {}) => {
    const normalizedDayIndex = Math.floor(
        requireFiniteWeatherInput(dayIndex, 'dayIndex'),
    );
    const normalizedDayOfYear = normalizeDayOfYear(
        requireFiniteWeatherInput(dayOfYear, 'dayOfYear'),
    );
    const blockIndex = Math.floor(
        normalizedDayIndex / RAIN_GUARANTEE_BLOCK_DAYS,
    );
    const dayInBlock = positiveModulo(
        normalizedDayIndex,
        RAIN_GUARANTEE_BLOCK_DAYS,
    );
    const seasonalWetness = resolveSeasonalWetness(normalizedDayOfYear);
    const guaranteedRainOffset = resolveGuaranteedRainOffset(blockIndex);
    const extraRainChance = 0.06 + seasonalWetness * 0.12;
    const rainEventScheduled = (
        dayInBlock === guaranteedRainOffset
        || sampleDay(normalizedDayIndex, 613.2) < extraRainChance
    );
    const eventKind = rainEventScheduled
        ? resolveRainEventKind({
            dayIndex: normalizedDayIndex,
            seasonalWetness,
        })
        : ZEN_WEATHER_EVENT_KINDS.NONE;
    const regime = rainEventScheduled
        ? ZEN_WEATHER_REGIMES.RAIN_FRONT
        : resolveDryRegime({
            dayIndex: normalizedDayIndex,
            seasonalWetness,
        });
    const profile = resolveRainFrontProfile({
        dayIndex: normalizedDayIndex,
        eventKind,
    });
    const startHour = profile
        ? sampleDay(normalizedDayIndex, 71.4) * WEATHER_DAY_HOURS
        : null;
    const startWeatherHour = profile
        ? normalizedDayIndex * WEATHER_DAY_HOURS + startHour
        : null;
    const endWeatherHour = profile
        ? startWeatherHour + profile.frontDurationHours
        : null;

    return Object.freeze({
        version: ZEN_WEATHER_EVENT_DIRECTOR_VERSION,
        dayIndex: normalizedDayIndex,
        dayOfYear: normalizedDayOfYear,
        regime,
        eventKind,
        eventId: profile
            ? `zen_weather_v2:${normalizedDayIndex}:${eventKind}`
            : '',
        rainEventScheduled,
        guaranteedRainDay: dayInBlock === guaranteedRainOffset,
        seasonalWetness,
        startHour,
        endHour: profile ? startHour + profile.frontDurationHours : null,
        startWeatherHour,
        endWeatherHour,
        profile,
    });
};

const resolveRegimeProfile = (regime) => {
    const profile = WEATHER_REGIME_PROFILES[regime];
    if (!profile) {
        throw new Error(`ZEN_WEATHER_REGIME_UNHANDLED:${String(regime)}`);
    }
    return profile;
};

const resolveTransitionedRegimeValue = ({
    key,
    time,
    previousSchedule,
    schedule,
    nextSchedule,
}) => {
    const previousValue = resolveRegimeProfile(previousSchedule.regime)[key];
    const currentValue = resolveRegimeProfile(schedule.regime)[key];
    const nextValue = resolveRegimeProfile(nextSchedule.regime)[key];
    if (time < MIDNIGHT_REGIME_BLEND_HOURS) {
        return mix(
            previousValue,
            currentValue,
            0.5 + smoothstep(0, MIDNIGHT_REGIME_BLEND_HOURS, time) * 0.5,
        );
    }
    if (time > WEATHER_DAY_HOURS - MIDNIGHT_REGIME_BLEND_HOURS) {
        return mix(
            currentValue,
            nextValue,
            smoothstep(
                WEATHER_DAY_HOURS - MIDNIGHT_REGIME_BLEND_HOURS,
                WEATHER_DAY_HOURS,
                time,
            ) * 0.5,
        );
    }
    return currentValue;
};

const resolveAmbientCloudCover = ({
    time,
    weatherHour,
    previousSchedule,
    schedule,
    nextSchedule,
}) => {
    const regimeTarget = resolveTransitionedRegimeValue({
        key: 'cloudTarget',
        time,
        previousSchedule,
        schedule,
        nextSchedule,
    });
    const cloudSpread = resolveTransitionedRegimeValue({
        key: 'cloudSpread',
        time,
        previousSchedule,
        schedule,
        nextSchedule,
    });
    const cloudMacro = noise1D(weatherHour * 0.006 + 13.7);
    const cloudTexture = noise1D(weatherHour * 0.041 + 91.3);
    return clamp(
        regimeTarget
        + (cloudMacro - 0.5) * cloudSpread
        + (cloudTexture - 0.5) * 0.08,
        0.04,
        0.94,
    );
};

const resolveRainCellState = ({
    cell,
    frontTime,
    weatherHour,
    pulseAmount,
}) => {
    const cellTime = frontTime - cell.startOffsetHours;
    if (cellTime < 0 || cellTime > cell.durationHours) return null;

    const progress = clamp01(cellTime / cell.durationHours);
    const rampIn = smoothstep(0, 0.2, progress);
    const rampOut = 1 - smoothstep(0.72, 1, progress);
    const envelope = rampIn * rampOut;
    const pulseNoise = noise1D(
        weatherHour * (cell.steadyRain ? 0.42 : 1.35)
        + cell.noiseSeed,
    );
    const steadyLull = cell.steadyRain
        ? mix(
            0.3,
            1,
            smoothstep(
                0.18,
                0.78,
                noise1D(weatherHour * 0.22 + cell.noiseSeed * 2.1),
            ),
        )
        : 1;
    const pulse = (
        1
        + (pulseNoise - 0.5) * pulseAmount * envelope
    );
    const rainIntensity = clamp01(
        cell.peakIntensity * envelope * steadyLull * pulse,
    );

    if (progress < 0.2) {
        return {
            phase: ZEN_WEATHER_EVENT_PHASES.DRIZZLE,
            phaseProgress: progress / 0.2,
            rainIntensity,
            postRainWeight: 0,
        };
    }
    if (progress > 0.72) {
        return {
            phase: ZEN_WEATHER_EVENT_PHASES.EASING,
            phaseProgress: (progress - 0.72) / 0.28,
            rainIntensity,
            postRainWeight: smoothstep(0.72, 1, progress),
        };
    }
    return {
        phase: ZEN_WEATHER_EVENT_PHASES.RAIN,
        phaseProgress: (progress - 0.2) / 0.52,
        rainIntensity,
        postRainWeight: 0,
    };
};

const resolveRecentRainTail = ({
    rainCells,
    frontTime,
}) => {
    let tail = 0;
    for (let index = 0; index < rainCells.length; index += 1) {
        const cell = rainCells[index];
        const cellTime = frontTime - cell.startOffsetHours;
        if (cellTime >= 0 && cellTime <= cell.durationHours) {
            tail = Math.max(
                tail,
                smoothstep(
                    0.72,
                    1,
                    cellTime / cell.durationHours,
                ),
            );
            continue;
        }
        if (cellTime > cell.durationHours) {
            tail = Math.max(
                tail,
                1 - smoothstep(
                    0,
                    1.25,
                    cellTime - cell.durationHours,
                ),
            );
        }
    }
    return clamp01(tail);
};

const createInactiveFrontState = ({
    schedule,
    eventProgress = 0,
}) => ({
    schedule,
    active: false,
    phase: ZEN_WEATHER_EVENT_PHASES.AMBIENT,
    phaseProgress: 0,
    eventProgress,
    cloudFrontWeight: 0,
    targetCloudCover: null,
    rainIntensity: 0,
    precipitationPotential: 0,
    windFrontWeight: 0,
    gustBoost: 0,
    hazeBoost: 0,
    postRainWeight: 0,
});

const resolveRainFrontState = ({
    schedule,
    weatherHour,
}) => {
    const profile = schedule.profile;
    if (!profile || !schedule.rainEventScheduled) {
        return createInactiveFrontState({ schedule });
    }
    if (
        weatherHour < schedule.startWeatherHour
        || weatherHour > schedule.endWeatherHour
    ) {
        return createInactiveFrontState({
            schedule,
            eventProgress: weatherHour > schedule.endWeatherHour ? 1 : 0,
        });
    }

    const frontTime = weatherHour - schedule.startWeatherHour;
    const eventProgress = clamp01(
        frontTime / profile.frontDurationHours,
    );
    const precipitationStart = profile.cloudBuildHours;
    const precipitationEnd = (
        precipitationStart
        + profile.precipitationWindowHours
    );

    if (frontTime < precipitationStart) {
        const phaseProgress = clamp01(frontTime / precipitationStart);
        const envelope = smoothstep(0, 1, phaseProgress);
        return {
            schedule,
            active: true,
            phase: ZEN_WEATHER_EVENT_PHASES.CLOUD_BUILD,
            phaseProgress,
            eventProgress,
            cloudFrontWeight: envelope,
            targetCloudCover: profile.cloudPeak,
            rainIntensity: 0,
            precipitationPotential: 0.55 * envelope,
            windFrontWeight: profile.windFrontGain * 0.82 * envelope,
            gustBoost: profile.gustGain * 0.45 * envelope,
            hazeBoost: profile.hazeGain * 0.76 * envelope,
            postRainWeight: 0,
        };
    }

    if (frontTime <= precipitationEnd) {
        let activeCellState = null;
        for (let index = 0; index < profile.rainCells.length; index += 1) {
            const candidate = resolveRainCellState({
                cell: profile.rainCells[index],
                frontTime,
                weatherHour,
                pulseAmount: profile.pulseAmount,
            });
            if (
                candidate
                && (
                    activeCellState === null
                    || candidate.rainIntensity > activeCellState.rainIntensity
                )
            ) {
                activeCellState = candidate;
            }
        }
        const rainIntensity = activeCellState?.rainIntensity || 0;
        const postRainWeight = Math.max(
            activeCellState?.postRainWeight || 0,
            resolveRecentRainTail({
                rainCells: profile.rainCells,
                frontTime,
            }),
        );
        return {
            schedule,
            active: true,
            phase: activeCellState?.phase || ZEN_WEATHER_EVENT_PHASES.LULL,
            phaseProgress: activeCellState?.phaseProgress ?? clamp01(
                (frontTime - precipitationStart)
                / profile.precipitationWindowHours,
            ),
            eventProgress,
            cloudFrontWeight: 1,
            targetCloudCover: profile.cloudPeak,
            rainIntensity,
            precipitationPotential: clamp01(0.55 + rainIntensity * 0.45),
            windFrontWeight: (
                profile.windFrontGain * (0.82 + rainIntensity * 0.18)
            ),
            gustBoost: profile.gustGain * (0.45 + rainIntensity * 0.55),
            hazeBoost: profile.hazeGain * (0.76 + rainIntensity * 0.24),
            postRainWeight,
        };
    }

    const phaseProgress = clamp01(
        (frontTime - precipitationEnd) / profile.afterRainHours,
    );
    const envelope = 1 - smoothstep(0, 1, phaseProgress);
    return {
        schedule,
        active: true,
        phase: ZEN_WEATHER_EVENT_PHASES.AFTER_RAIN,
        phaseProgress,
        eventProgress,
        cloudFrontWeight: envelope,
        targetCloudCover: mix(
            profile.cloudPeak,
            profile.postRainCloud,
            phaseProgress,
        ),
        rainIntensity: 0,
        precipitationPotential: 0.55 * envelope,
        windFrontWeight: profile.windFrontGain * 0.82 * envelope,
        gustBoost: profile.gustGain * 0.45 * envelope,
        hazeBoost: profile.hazeGain * 0.76 * envelope,
        postRainWeight: envelope,
    };
};

const resolveDominantFrontState = (states) => (
    states.reduce((dominant, candidate) => {
        if (!candidate.active) return dominant;
        if (!dominant) return candidate;
        const dominantScore = (
            dominant.rainIntensity * 4
            + dominant.cloudFrontWeight
            + dominant.postRainWeight * 0.2
        );
        const candidateScore = (
            candidate.rainIntensity * 4
            + candidate.cloudFrontWeight
            + candidate.postRainWeight * 0.2
        );
        return candidateScore > dominantScore ? candidate : dominant;
    }, null)
);

export const resolveZenWeatherEventState = ({
    time,
    dayIndex,
    dayOfYear,
} = {}) => {
    const normalizedTime = positiveModulo(
        requireFiniteWeatherInput(time, 'time'),
        WEATHER_DAY_HOURS,
    );
    const normalizedDayIndex = Math.floor(
        requireFiniteWeatherInput(dayIndex, 'dayIndex'),
    );
    const normalizedDayOfYear = normalizeDayOfYear(
        requireFiniteWeatherInput(dayOfYear, 'dayOfYear'),
    );
    const weatherHour = normalizedDayIndex * WEATHER_DAY_HOURS + normalizedTime;
    const schedule = resolveZenDailyWeatherSchedule({
        dayIndex: normalizedDayIndex,
        dayOfYear: normalizedDayOfYear,
    });
    const previousSchedule = resolveZenDailyWeatherSchedule({
        dayIndex: normalizedDayIndex - 1,
        dayOfYear: resolveAdjacentCalendarDayOfYear(normalizedDayIndex, -1),
    });
    const nextSchedule = resolveZenDailyWeatherSchedule({
        dayIndex: normalizedDayIndex + 1,
        dayOfYear: resolveAdjacentCalendarDayOfYear(normalizedDayIndex, 1),
    });
    const ambientCloudCover = resolveAmbientCloudCover({
        time: normalizedTime,
        weatherHour,
        previousSchedule,
        schedule,
        nextSchedule,
    });
    const frontStates = [
        resolveRainFrontState({
            schedule: previousSchedule,
            weatherHour,
        }),
        resolveRainFrontState({
            schedule,
            weatherHour,
        }),
    ];
    const activeFrontStates = frontStates.filter((state) => state.active);
    const dominantFrontState = resolveDominantFrontState(frontStates);
    const presentationSchedule = dominantFrontState?.schedule
        || (schedule.rainEventScheduled ? schedule : null);
    let cloudCover = ambientCloudCover;
    let rainIntensity = 0;
    let precipitationPotential = 0;
    let weatherFrontWeight = 0;
    let weatherGustBoost = 0;
    let weatherHazeBoost = 0;
    let postRainWeight = 0;

    activeFrontStates.forEach((state) => {
        if (state.targetCloudCover !== null) {
            cloudCover = Math.max(
                cloudCover,
                mix(
                    ambientCloudCover,
                    state.targetCloudCover,
                    state.cloudFrontWeight,
                ),
            );
        }
        rainIntensity = Math.max(rainIntensity, state.rainIntensity);
        precipitationPotential = Math.max(
            precipitationPotential,
            state.precipitationPotential,
        );
        weatherFrontWeight = Math.max(
            weatherFrontWeight,
            state.windFrontWeight,
        );
        weatherGustBoost = Math.max(
            weatherGustBoost,
            state.gustBoost,
        );
        weatherHazeBoost = Math.max(
            weatherHazeBoost,
            state.hazeBoost,
        );
        postRainWeight = Math.max(
            postRainWeight,
            state.postRainWeight,
        );
    });

    const overcastWeight = smoothstep(0.56, 0.82, cloudCover);
    const normalizedRainIntensity = clamp01(rainIntensity);
    const weatherKind = normalizedRainIntensity >= 0.08
        ? 'rain'
        : (overcastWeight >= 0.5 ? 'overcast' : 'clear');

    return Object.freeze({
        version: ZEN_WEATHER_EVENT_DIRECTOR_VERSION,
        weatherHour,
        weatherRegime: dominantFrontState
            ? ZEN_WEATHER_REGIMES.RAIN_FRONT
            : schedule.regime,
        weatherKind,
        cloudCover,
        overcastWeight,
        rainIntensity: normalizedRainIntensity,
        precipitationPotential: clamp01(precipitationPotential),
        weatherEventScheduled: presentationSchedule !== null,
        weatherEventActive: dominantFrontState !== null,
        weatherEventId: presentationSchedule?.eventId || '',
        weatherEventKind: presentationSchedule?.eventKind
            || ZEN_WEATHER_EVENT_KINDS.NONE,
        weatherEventPhase: dominantFrontState?.phase
            || ZEN_WEATHER_EVENT_PHASES.AMBIENT,
        weatherEventProgress: dominantFrontState?.eventProgress
            ?? (
                presentationSchedule
                    && weatherHour > presentationSchedule.endWeatherHour
                    ? 1
                    : 0
            ),
        weatherEventPhaseProgress: dominantFrontState?.phaseProgress || 0,
        weatherEventStartHour: presentationSchedule?.startHour ?? null,
        weatherEventEndHour: presentationSchedule?.endHour ?? null,
        weatherFrontWeight: clamp01(weatherFrontWeight),
        weatherGustBoost: clamp01(weatherGustBoost),
        weatherHazeBoost: clamp01(weatherHazeBoost),
        postRainWeight: clamp01(postRainWeight),
        guaranteedRainDay: presentationSchedule?.guaranteedRainDay === true,
        seasonalWetness: presentationSchedule?.seasonalWetness
            ?? schedule.seasonalWetness,
    });
};
