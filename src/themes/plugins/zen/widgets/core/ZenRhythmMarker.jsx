import React, { useMemo } from 'react';

import { useThemeAmbientPresentation } from '@/themes/core/presentation/ThemeAmbientPresentationContext.jsx';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { requireZenAmbientPresentation } from '../../api/environment.js';
import './ZenRhythmMarker.css';

const HOUR_COUNT = 24;
const MIN_PRESSURE_WINDOW_ACTIVE_DAYS = 3;
const PRESSURE_WINDOW_SHOULDER_RATIO = 0.25;
const MAX_PRESSURE_WINDOW_HOURS = 10;

function toNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeDomain(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeHour(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    const hour = Math.floor(numeric);
    return hour >= 0 && hour < HOUR_COUNT ? hour : null;
}

function resolveText(t, key, options = {}, fallback = '') {
    if (!t) return fallback;
    const value = t(key, options);
    return typeof value === 'string' && value && value !== key ? value : fallback;
}

function resolvePhaseLabel(t, phase) {
    switch (phase) {
        case 'dawn':
            return resolveText(t, 'target_protocol.rhythm_phase_dawn', {}, 'Dawn');
        case 'day':
            return resolveText(t, 'target_protocol.rhythm_phase_day', {}, 'Day');
        case 'dusk':
            return resolveText(t, 'target_protocol.rhythm_phase_dusk', {}, 'Dusk');
        case 'night':
            return resolveText(t, 'target_protocol.rhythm_phase_night', {}, 'Night');
        default:
            throw new Error(`ZEN_RHYTHM_PHASE_UNSUPPORTED:${String(phase)}`);
    }
}

function resolveClockDisplay(clockContext = null, phase = '') {
    const decimalHour = Math.max(0, toNumber(clockContext?.hour));
    const hour = Math.floor(decimalHour) % HOUR_COUNT;
    const minute = Math.min(59, Math.floor(
        ((decimalHour - Math.floor(decimalHour)) * 60) + 1e-6,
    ));
    return {
        label: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
        hour: String(hour).padStart(2, '0'),
        minute: String(minute).padStart(2, '0'),
        phase,
    };
}

function resolveDominantPressureWindow(valuesByHour, maxMs) {
    if (maxMs <= 0) return null;

    let peakHour = 0;
    for (let hour = 1; hour < HOUR_COUNT; hour += 1) {
        if (valuesByHour[hour] > valuesByHour[peakHour]) peakHour = hour;
    }

    const threshold = maxMs * PRESSURE_WINDOW_SHOULDER_RATIO;
    const includedHours = new Set([peakHour]);
    let startHour = peakHour;
    let endHour = peakHour;

    while (includedHours.size < HOUR_COUNT) {
        const previousHour = (startHour - 1 + HOUR_COUNT) % HOUR_COUNT;
        if (includedHours.has(previousHour) || valuesByHour[previousHour] < threshold) break;
        includedHours.add(previousHour);
        startHour = previousHour;
    }

    while (includedHours.size < HOUR_COUNT) {
        const nextHour = (endHour + 1) % HOUR_COUNT;
        if (includedHours.has(nextHour) || valuesByHour[nextHour] < threshold) break;
        includedHours.add(nextHour);
        endHour = nextHour;
    }

    if (includedHours.size > MAX_PRESSURE_WINDOW_HOURS) return null;

    return {
        startHour,
        endHour,
        peakHour,
        hourCount: includedHours.size,
        pressureMs: [...includedHours].reduce((sum, hour) => sum + valuesByHour[hour], 0),
    };
}

function formatHour(hour) {
    return String(hour).padStart(2, '0');
}

function resolveFormattedDate(timestampMs) {
    const date = Number.isFinite(Number(timestampMs)) ? new Date(Number(timestampMs)) : new Date();
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const dayName = days[date.getDay()];
    const monthName = months[date.getMonth()];
    const dayNum = date.getDate();
    return `${dayName}, ${monthName} ${dayNum}`;
}

export function resolveSelectedPressureTrace({
    pressureProfile = null,
    selectedLensDomain = '',
} = {}) {
    const selectedDomain = normalizeDomain(selectedLensDomain);
    const profileDomain = normalizeDomain(pressureProfile?.domain);
    const aligned = Boolean(selectedDomain) && profileDomain === selectedDomain;
    const valuesByHour = Array.from({ length: HOUR_COUNT }, () => 0);

    if (aligned) {
        for (const entry of Array.isArray(pressureProfile?.series) ? pressureProfile.series : []) {
            const hour = normalizeHour(entry?.hour);
            if (hour === null) continue;
            valuesByHour[hour] += Math.max(0, toNumber(entry?.targetPressureMs));
        }
    }

    const totalMs = valuesByHour.reduce((sum, value) => sum + value, 0);
    const maxMs = Math.max(0, ...valuesByHour);
    const activeDayCount = aligned
        ? Math.max(0, Math.floor(toNumber(pressureProfile?.evidence?.selectedActiveDayCount)))
        : 0;
    const window = activeDayCount >= MIN_PRESSURE_WINDOW_ACTIVE_DAYS
        ? resolveDominantPressureWindow(valuesByHour, maxMs)
        : null;
    const hasTrace = aligned && window !== null;

    return {
        selected: Boolean(selectedDomain),
        aligned,
        hasTrace,
        domain: selectedDomain,
        windowDays: Math.max(0, Math.floor(toNumber(pressureProfile?.windowDays))),
        activeDayCount,
        totalMs,
        maxMs,
        window,
    };
}

export default function ZenRhythmMarker({
    pressureProfile = null,
    selectedLensDomain = null,
    frameVariant = 'card',
    className = '',
}) {
    const { t } = useAppTranslation('main');
    const ambientPresentation = requireZenAmbientPresentation(useThemeAmbientPresentation());
    const usesSlabInscription = frameVariant === 'slab-inscription';
    const clock = resolveClockDisplay(ambientPresentation, ambientPresentation.phase);
    const pressureTrace = useMemo(() => resolveSelectedPressureTrace({
        pressureProfile,
        selectedLensDomain,
    }), [pressureProfile, selectedLensDomain]);
    const phaseLabel = resolvePhaseLabel(t, clock.phase);
    const formattedDate = useMemo(() => resolveFormattedDate(
        ambientPresentation.environmentIdentity?.sampledAtMs,
    ), [ambientPresentation.environmentIdentity?.sampledAtMs]);
    const pressureWindowLabel = pressureTrace.hasTrace
        ? pressureTrace.window.hourCount === 1
            ? resolveText(
                t,
                'target_protocol.rhythm_marker_pressure_hour',
                { hour: formatHour(pressureTrace.window.peakHour) },
                `Concentrated around ${formatHour(pressureTrace.window.peakHour)}:00`,
            )
            : resolveText(
                t,
                'target_protocol.rhythm_marker_pressure_window',
                {
                    start: formatHour(pressureTrace.window.startHour),
                    end: formatHour(pressureTrace.window.endHour),
                },
                `Concentrated ${formatHour(pressureTrace.window.startHour)}:00–${formatHour(pressureTrace.window.endHour)}:00`,
            )
        : '';
    const contextLabel = pressureTrace.selected
        ? [pressureTrace.domain, pressureWindowLabel].filter(Boolean).join(', ')
        : '';
    const traceState = !pressureTrace.selected
        ? 'ambient'
        : !pressureTrace.aligned
            ? 'pending'
            : pressureTrace.hasTrace
                ? 'visible'
                : 'empty';
    const ariaLabel = resolveText(
        t,
        'target_protocol.rhythm_marker_aria',
        {
            time: clock.label,
            phase: phaseLabel,
            context: contextLabel,
        },
        [clock.label, phaseLabel, contextLabel].filter(Boolean).join(', '),
    );

    return (
        <section
            data-testid="zen-rhythm-marker"
            data-interactive="false"
            data-frame-variant={frameVariant}
            data-rhythm-scope={pressureTrace.selected ? 'selected' : 'ambient'}
            data-trace-state={traceState}
            data-day-phase={clock.phase}
            data-ambient-source={ambientPresentation.source}
            aria-label={ariaLabel}
            className={`zen-rhythm-marker relative flex h-full min-h-0 w-full select-none items-center justify-between overflow-hidden ${usesSlabInscription ? 'rounded-none border-0 px-4 py-2' : 'rounded-[18px] border px-4 py-2.5'} ${className}`}
            style={usesSlabInscription
                ? {
                    color: 'var(--zen-rhythm-inscription-color, var(--color-on-surface))',
                    background: 'var(--zen-rhythm-inscription-background, transparent)',
                }
                : {
                    borderColor: 'color-mix(in srgb, var(--color-border) 52%, transparent)',
                    color: 'var(--color-on-surface)',
                    background: 'var(--zen-layer-l2-surface)',
                    boxShadow: '0 12px 28px -24px color-mix(in srgb, var(--zen-ambient-cast-shadow) 60%, transparent), inset 0 1px 0 color-mix(in srgb, var(--zen-ambient-layer-l2-top) 64%, transparent)',
                }}
        >
            {/* Left: Large Digital Clock */}
            <div className="zen-rhythm-marker__clock relative z-10 min-w-0 shrink-0">
                <time
                    dateTime={clock.label}
                    className="zen-rhythm-marker__time flex items-baseline text-[32px] font-semibold leading-none tracking-[-0.035em] text-[var(--color-on-surface)]"
                    style={{
                        fontFamily: usesSlabInscription
                            ? 'var(--font-theme-ui)'
                            : 'var(--font-theme-mono)',
                        fontVariantNumeric: 'tabular-nums',
                    }}
                    aria-label={clock.label}
                >
                    <span className="zen-rhythm-marker__hour">{clock.hour}</span>
                    <span aria-hidden="true" className="zen-rhythm-marker__separator">:</span>
                    <span className="zen-rhythm-marker__minute">{clock.minute}</span>
                </time>
            </div>

            {/* Right: Date & Day Phase */}
            <div className="zen-rhythm-marker__date-phase relative z-10 flex flex-col items-end justify-center gap-[3px] text-right">
                <span className="zen-rhythm-marker__date text-[var(--color-on-surface)]">
                    {formattedDate}
                </span>
                <div className="flex items-center gap-1.5">
                    <span className="zen-rhythm-marker__phase text-[var(--color-on-surface-muted)]">
                        {phaseLabel}
                    </span>
                </div>
            </div>

            {/* Accessibility & context storage for screen readers & tests */}
            {pressureTrace.selected ? (
                <div className="sr-only">
                    <span>{pressureTrace.domain}</span>
                    {pressureWindowLabel ? <span>{pressureWindowLabel}</span> : null}
                </div>
            ) : null}

            <span
                aria-hidden="true"
                className="zen-rhythm-marker__phase-wash pointer-events-none absolute inset-y-0 right-0 w-[42%] opacity-20"
                style={{
                    background: 'radial-gradient(ellipse at 80% 50%, var(--zen-ambient-rhythm-light) 0%, transparent 72%)',
                }}
            />
        </section>
    );
}
