import { useMemo, useRef } from 'react';

import {
    projectZenBonsaiEnvironment,
} from './zenBonsaiEnvironmentProjection.js';
import {
    sampleZenWorldEnvironment,
} from './zenWorldEnvironmentKernel.js';
import {
    buildZenWeatherAuthoritySnapshot,
    normalizeZenWeatherAuthority,
    ZEN_WEATHER_AUTHORITY_MODES,
} from './zenWorldWeatherAuthority.js';
import {
    useZenWorldEnvironmentAuthority,
} from './useZenWorldEnvironmentAuthority.js';

export const useZenBonsaiEnvironmentState = ({
    weatherAuthorityMode = ZEN_WEATHER_AUTHORITY_MODES.FIXED_LAB,
    weatherAuthority: requestedWeatherAuthority = null,
    ...authorityOptions
} = {}) => {
    const weatherAuthority = useMemo(() => (
        requestedWeatherAuthority === null
            ? buildZenWeatherAuthoritySnapshot({ mode: weatherAuthorityMode })
            : normalizeZenWeatherAuthority(requestedWeatherAuthority)
    ), [requestedWeatherAuthority, weatherAuthorityMode]);
    const authorityState = useZenWorldEnvironmentAuthority({
        ...authorityOptions,
        weatherAuthority,
    });
    const { envAuthority, timeContext } = authorityState;
    const worldSnapshot = useMemo(() => sampleZenWorldEnvironment({
        authority: envAuthority,
        now: timeContext.timestampMs,
    }), [envAuthority, timeContext.timestampMs]);
    const projection = useMemo(
        () => projectZenBonsaiEnvironment(worldSnapshot),
        [worldSnapshot],
    );
    const envState = projection.dynamicTarget;
    const envStateRef = useRef(envState);
    envStateRef.current = envState;
    const environmentBundle = useMemo(() => Object.freeze({
        worldSnapshot,
        projection,
        envAuthority: worldSnapshot.authority,
        timeContext: worldSnapshot.timeContext,
        solarState: worldSnapshot.solar.state,
        envState,
    }), [envState, projection, worldSnapshot]);

    return {
        ...authorityState,
        environmentBundle,
        envState,
        envStateRef,
    };
};

export default useZenBonsaiEnvironmentState;
