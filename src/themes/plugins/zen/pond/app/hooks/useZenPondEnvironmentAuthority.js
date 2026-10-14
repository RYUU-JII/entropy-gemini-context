import { useMemo } from 'react';

import {
    useZenWorldEnvironmentAuthority,
} from '../../../runtime/environment/useZenWorldEnvironmentAuthority.js';
import {
    buildZenWeatherAuthoritySnapshot,
    normalizeZenWeatherAuthority,
    ZEN_WEATHER_AUTHORITY_MODES,
} from '../../../runtime/environment/zenWorldWeatherAuthority.js';
import { projectZenPondTuningV1 } from '../../contracts/zenPondTuningContract.js';
import { selectZenEnvCause } from '../../runtime/core/zenCauseModel.js';

export const useZenPondEnvironmentAuthority = ({
    tuning,
    weatherAuthorityMode = ZEN_WEATHER_AUTHORITY_MODES.FIXED_LAB,
    weatherAuthority: requestedWeatherAuthority = null,
    ...authorityOptions
} = {}) => {
    const causeChannelTuning = useMemo(
        () => projectZenPondTuningV1(tuning),
        [tuning],
    );
    const envCause = useMemo(
        () => selectZenEnvCause(causeChannelTuning),
        [causeChannelTuning],
    );
    const weatherAuthority = useMemo(() => (
        requestedWeatherAuthority === null
            ? buildZenWeatherAuthoritySnapshot({
                mode: weatherAuthorityMode,
                fixedCloudCover: envCause.envCloudiness,
                fixedRainIntensity: envCause.envRainIntensity,
            })
            : normalizeZenWeatherAuthority(requestedWeatherAuthority)
    ), [
        envCause.envCloudiness,
        envCause.envRainIntensity,
        requestedWeatherAuthority,
        weatherAuthorityMode,
    ]);
    const authorityState = useZenWorldEnvironmentAuthority({
        ...authorityOptions,
        weatherAuthority,
    });
    return {
        ...authorityState,
        causeChannelTuning,
        envCause,
    };
};

export default useZenPondEnvironmentAuthority;
