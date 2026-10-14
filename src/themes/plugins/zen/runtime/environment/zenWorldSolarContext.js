import { resolveSolarCoordinatesFromProfile } from '@/domains/settings/config/solarLocation.js';

// Document-side settings input. Workers receive the resulting coordinates and
// timezone through the world authority, without admitting the location catalog.
export const resolveZenSolarContext = (solarLocationProfile = null) => {
    const solarCoordinates = resolveSolarCoordinatesFromProfile(solarLocationProfile);
    const solarTimeZone = solarCoordinates.timezone === ''
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : solarCoordinates.timezone;
    if (typeof solarTimeZone !== 'string' || !solarTimeZone) throw new Error('ZEN_WORLD_TIME_ZONE_REQUIRED');
    return { solarCoordinates, solarTimeZone };
};
