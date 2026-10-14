// Shared by the event integrator and its authoring controls.
export const KOI_EVENT_MOTION_LIMITS = Object.freeze({
    spineStiffness: Object.freeze({ min: 0.6, max: 2.2 }),
    waveAmplitudeScale: Object.freeze({ min: 0.35, max: 6 }),
    coreSegment: Object.freeze({ min: 0.22, max: 0.48 }),
    wavelengthScale: Object.freeze({ min: 0.6, max: 6 }),
});

export const KOI_EVENT_TRAILING_WAVELENGTH_LIMITS = Object.freeze({ min: 0.6, max: 3.2 });

export const resolveKoiEventMotionRange = (model, key) => {
    if (!['event_fsm', 'event_fsm_life_v1', 'event_fsm_life_v2'].includes(model)) return undefined;
    if (key === 'wavelengthScale' && model !== 'event_fsm_life_v2') {
        return KOI_EVENT_TRAILING_WAVELENGTH_LIMITS;
    }
    return KOI_EVENT_MOTION_LIMITS[key];
};
