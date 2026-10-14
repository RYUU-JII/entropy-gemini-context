/**
 * The one projection of the world's sky onto the Home sky panel, shared by
 * every celestial body and by the light it casts on the panel. The panel is an
 * elevation view facing south, read from ground (bottom) to open sky (top):
 * east is left, west is right, as on the pond's map. It consumes astronomical
 * altitude and azimuth only, never a rotated screen-light vector, so a change
 * to another surface's axes cannot move the panel's sun or moon.
 */

const DEG = Math.PI / 180;

export const ZEN_SKY_PANEL_PROJECTION = Object.freeze({
    // Altitude 0 sits just behind the garden bed's rear edge.
    horizonFraction: 0.9,
    zenithFraction: 0.04,
    azimuthHalfSpanRadians: 120 * DEG,
});

function requireBody(body) {
    const { altitudeRadians, azimuthSouthRadians } = body || {};
    if (!Number.isFinite(altitudeRadians) || !Number.isFinite(azimuthSouthRadians)) {
        throw new Error('ZEN_SKY_PANEL_BODY_INVALID');
    }
    return { altitude: altitudeRadians, azimuth: Math.atan2(Math.sin(azimuthSouthRadians), Math.cos(azimuthSouthRadians)) };
}

/**
 * A body's place on the panel as fractions of the sky viewport. Values leave
 * [0, 1] when the body is below the horizon or outside the panel's span.
 */
export function projectZenSkyPanelPoint(body) {
    const { altitude, azimuth } = requireBody(body);
    const { horizonFraction, zenithFraction, azimuthHalfSpanRadians } = ZEN_SKY_PANEL_PROJECTION;
    return Object.freeze({
        u: 0.5 + azimuth / (2 * azimuthHalfSpanRadians),
        v: horizonFraction - (horizonFraction - zenithFraction) * Math.min(1, altitude / (90 * DEG)),
    });
}

/**
 * The in-panel direction toward a body for elevation-view shading: x is its
 * east-west component (west positive), y its height (up negative). It is not
 * normalized: a body near due south or overhead lights the panel from in front
 * and so has little sideways component.
 */
export function resolveZenSkyPanelLightDirection(body) {
    const { altitude, azimuth } = requireBody(body);
    return Object.freeze({ x: Math.sin(azimuth) * Math.cos(altitude), y: -Math.sin(altitude) });
}

/** The world's sun and moon as projection bodies. */
export function resolveZenSkyPanelSun(environment) {
    return { altitudeRadians: environment?.solarAltitudeRadians, azimuthSouthRadians: environment?.sunAzimuthSouthRadians };
}

export function resolveZenSkyPanelMoon(environment) {
    return { altitudeRadians: environment?.moonAltitudeRadians, azimuthSouthRadians: environment?.moonAzimuthSouthRadians };
}
