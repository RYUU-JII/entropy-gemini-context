import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useThemeTemporalAuthority } from '@/themes/core/presentation/ThemeTemporalAuthorityContext.jsx';
import {
    ZEN_TEMPORAL_AUTHORITY_MODES,
    requireZenTemporalAuthority,
} from './zenTemporalAuthority.js';
import {
    DEFAULT_ZEN_WORLD_ID,
    ZEN_WORLD_ENVIRONMENT_CLOCK_MODES,
    buildZenWorldEnvironmentAuthority,
} from './zenWorldEnvironmentAuthority.js';
import {
    resolveZenRealtimeClockContext,
    resolveZenRealtimeSyncIntervalMs,
} from './zenWorldEnvironmentKernel.js';
import { resolveZenSolarContext } from './zenWorldSolarContext.js';
import {
    normalizeZenPresentationHour,
    resolveZenPresentationTimeContext,
} from './zenWorldClock.js';

const TIME_CONTEXT_BUCKET_SECONDS = 10;
const WORKER_CLOCK_CONTEXT_POLL_MS = 10 * 60 * 1000;

const buildTimeContextSignature = (context = null, bucketSeconds = TIME_CONTEXT_BUCKET_SECONDS) => {
    const safeBucketSeconds = Math.max(1, Math.round(Number(bucketSeconds) || TIME_CONTEXT_BUCKET_SECONDS));
    const hour = Number(context?.hour);
    const hourBucket = Number.isFinite(hour)
        ? Math.floor((((hour % 24) + 24) % 24) * 3600 / safeBucketSeconds)
        : 0;
    return [
        Math.floor(Number(context?.year) || 0),
        Math.floor(Number(context?.dayOfYear) || 0),
        Math.floor(Number(context?.dayIndex) || 0),
        hourBucket,
    ].join('|');
};

const buildDayContextSignature = (context = null) => ([
    Math.floor(Number(context?.year) || 0),
    Math.floor(Number(context?.dayOfYear) || 0),
    Math.floor(Number(context?.dayIndex) || 0),
].join('|'));

export const useZenWorldEnvironmentAuthority = ({
    worldId = null,
    solarLocationProfile,
    realtimeClockOwner = 'react',
    timeContextBucketSeconds = TIME_CONTEXT_BUCKET_SECONDS,
    minimumRealtimeSyncIntervalMs = null,
    presentationHour = null,
    weatherAuthority,
}) => {
    const themeTemporalAuthority = useThemeTemporalAuthority();
    const { solarCoordinates, solarTimeZone } = useMemo(
        () => resolveZenSolarContext(solarLocationProfile),
        [solarLocationProfile],
    );
    const resolvedWorldId = worldId || solarCoordinates?.worldId || DEFAULT_ZEN_WORLD_ID;
    const normalizedPresentationHour = useMemo(
        () => normalizeZenPresentationHour(presentationHour),
        [presentationHour],
    );
    const temporalAuthority = useMemo(
        () => requireZenTemporalAuthority(themeTemporalAuthority),
        [themeTemporalAuthority],
    );
    const usesFixedTemporalAuthority = (
        normalizedPresentationHour !== null
        || temporalAuthority.mode === ZEN_TEMPORAL_AUTHORITY_MODES.FIXED
    );
    const resolveRealtimeContext = useCallback(
        () => {
            const baseContext = temporalAuthority.mode === ZEN_TEMPORAL_AUTHORITY_MODES.FIXED
                ? resolveZenRealtimeClockContext(solarTimeZone, {
                    now: temporalAuthority.fixedEpochMs,
                })
                : resolveZenRealtimeClockContext(solarTimeZone);
            return resolveZenPresentationTimeContext(
                baseContext,
                normalizedPresentationHour,
            );
        },
        [normalizedPresentationHour, solarTimeZone, temporalAuthority],
    );

    const [timeContext, setTimeContext] = useState(() => resolveRealtimeContext());

    useEffect(() => {
        if (usesFixedTemporalAuthority) {
            setTimeContext(resolveRealtimeContext());
            return undefined;
        }

        let timerId = 0;
        let unmounted = false;
        const resolveDocumentVisible = () => {
            if (typeof document === 'undefined') return true;
            return document.hidden !== true && document.visibilityState !== 'hidden';
        };
        const clearTimer = () => {
            if (!timerId) return;
            clearTimeout(timerId);
            timerId = 0;
        };
        const scheduleNextTick = (context) => {
            const baseIntervalMs = realtimeClockOwner === 'worker'
                ? WORKER_CLOCK_CONTEXT_POLL_MS
                : resolveZenRealtimeSyncIntervalMs({
                    timeContext: context,
                    documentVisible: resolveDocumentVisible(),
                    solarSyncEnabled: true,
                });
            const minimumIntervalMs = Number(minimumRealtimeSyncIntervalMs);
            const intervalMs = Number.isFinite(minimumIntervalMs) && minimumIntervalMs > 0
                ? Math.max(baseIntervalMs, Math.floor(minimumIntervalMs))
                : baseIntervalMs;
            timerId = setTimeout(() => {
                timerId = 0;
                runTick();
            }, intervalMs);
        };
        const runTick = () => {
            if (unmounted) return;
            const context = resolveRealtimeContext();
            setTimeContext((prev) => {
                const useTimeSignature = (
                    realtimeClockOwner !== 'worker'
                    || normalizedPresentationHour !== null
                    || Number.isFinite(Number(prev?.presentationHour))
                );
                const buildSignature = useTimeSignature
                    ? (value) => buildTimeContextSignature(value, timeContextBucketSeconds)
                    : buildDayContextSignature;
                return buildSignature(prev) === buildSignature(context) ? prev : context;
            });
            scheduleNextTick(context);
        };
        const handleVisibilityChange = () => {
            if (unmounted) return;
            clearTimer();
            runTick();
        };
        runTick();
        if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
            document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true });
        }
        return () => {
            unmounted = true;
            clearTimer();
            if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
                document.removeEventListener('visibilitychange', handleVisibilityChange);
            }
        };
    }, [
        minimumRealtimeSyncIntervalMs,
        normalizedPresentationHour,
        realtimeClockOwner,
        resolveRealtimeContext,
        timeContextBucketSeconds,
        usesFixedTemporalAuthority,
    ]);

    const envAuthority = useMemo(() => (
        buildZenWorldEnvironmentAuthority({
            worldId: resolvedWorldId,
            timeContext,
            solarCoordinates,
            solarTimeZone,
            clockMode: usesFixedTemporalAuthority
                ? ZEN_WORLD_ENVIRONMENT_CLOCK_MODES.FIXED
                : ZEN_WORLD_ENVIRONMENT_CLOCK_MODES.REALTIME,
            weatherAuthority,
        })
    ), [
        timeContext,
        resolvedWorldId,
        solarCoordinates,
        solarTimeZone,
        usesFixedTemporalAuthority,
        weatherAuthority,
    ]);
    const envAuthorityRef = useRef(envAuthority);
    envAuthorityRef.current = envAuthority;
    const envRuntimeConfigSignature = useMemo(() => ([
        envAuthority.authoritySignature,
        temporalAuthority.signature,
        realtimeClockOwner === 'worker' ? 'worker_clock' : 'react_clock',
    ].join('|')), [
        envAuthority.authoritySignature,
        realtimeClockOwner,
        temporalAuthority.signature,
    ]);
    return {
        envAuthority,
        envAuthorityRef,
        envRuntimeConfigSignature,
        solarCoordinates,
        solarTimeZone,
        temporalAuthority,
        timeContext,
    };
};

export default useZenWorldEnvironmentAuthority;
