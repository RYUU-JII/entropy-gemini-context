import { clamp as clampValue } from '../../model/koi/koiMotion.js';
import {
    assertZenSurfaceDisturbanceRuntimeRefs,
    pushZenSurfaceDisturbance,
} from '../surface/zenSurfaceDisturbance.js';
import {
    isZenPondWorldSimulationEnabled,
    resolveZenPondWorldPolicy,
} from '../core/zenPondWorldProfile.js';

export const createZenSurfaceDisturbanceSystem = ({
    width,
    height,
    surfaceDisturbancesRef,
    surfaceDisturbanceEventsRef,
    surfaceDisturbanceTelemetryRef,
    rendererDebugTogglesRef,
    frameStateRef,
} = {}) => {
    if (!surfaceDisturbancesRef || !Array.isArray(surfaceDisturbancesRef.current)) {
        throw new Error('ZEN_SURFACE_DISTURBANCE_REF_MISSING');
    }
    if (!surfaceDisturbanceEventsRef || !Array.isArray(surfaceDisturbanceEventsRef.current)) {
        throw new Error('ZEN_SURFACE_DISTURBANCE_EVENT_REF_MISSING');
    }
    assertZenSurfaceDisturbanceRuntimeRefs({
        rendererDebugTogglesRef,
        surfaceDisturbanceTelemetryRef,
    });
    let sceneWidth = Number(width);
    let sceneHeight = Number(height);
    if (!Number.isFinite(sceneWidth) || sceneWidth <= 0 || !Number.isFinite(sceneHeight) || sceneHeight <= 0) {
        throw new Error('ZEN_SURFACE_DISTURBANCE_SCENE_SIZE_INVALID');
    }
    return {
        setWorldSize: (nextWidth, nextHeight) => { sceneWidth = nextWidth; sceneHeight = nextHeight; },
        step: () => {
            const events = surfaceDisturbanceEventsRef.current;
            if (events.length === 0) return;
            const worldPolicy = resolveZenPondWorldPolicy(frameStateRef?.current?.worldPolicy);
            if (!isZenPondWorldSimulationEnabled(worldPolicy, 'waterMotion')) {
                events.length = 0;
                surfaceDisturbancesRef.current.length = 0;
                return;
            }
            for (let i = 0; i < events.length; i += 1) {
                const event = events[i];
                const x = Number(event?.x);
                const y = Number(event?.y);
                if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
                if (x < 0 || y < 0 || x > sceneWidth || y > sceneHeight) continue;
                pushZenSurfaceDisturbance(surfaceDisturbancesRef, {
                    x,
                    y,
                    impulse: clampValue(Number(event?.impulse ?? 1.2), 0.2, 3),
                    source: event?.source,
                    ...(Object.hasOwn(event, 'selectionCue') ? { selectionCue: event.selectionCue } : {}),
                }, {
                    rendererDebugToggles:
                        rendererDebugTogglesRef.current,
                    surfaceDisturbanceTelemetryRef,
                });
            }
            events.length = 0;
        },
    };
};
