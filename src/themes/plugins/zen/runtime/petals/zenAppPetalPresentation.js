// The scene conductor chooses presentation; the one app field owns all petals.
export const ZEN_APP_PETAL_PRESENTATIONS = Object.freeze({
    AMBIENT: Object.freeze({ mode: 'ambient', landingEnabled: true }),
    OPENING: Object.freeze({ mode: 'opening', landingEnabled: true }),
    COVERING: Object.freeze({ mode: 'opening', landingEnabled: false }),
    COVERED: Object.freeze({ mode: 'covered', landingEnabled: false }),
    UNCOVERING: Object.freeze({ mode: 'ambient', landingEnabled: false }),
});

export const ZEN_APP_PETAL_OPENING = Object.freeze({
    ratePerSecond: 3.6,
    maxSupplyDurationSec: 8,
    riseTimeSec: 0.7,
    settleTimeSec: 2,
});

export const requireZenAppPetalPresentation = (presentation) => {
    if (!presentation || !['ambient', 'opening', 'covered'].includes(presentation.mode)
        || typeof presentation.landingEnabled !== 'boolean'
        || (presentation.mode === 'covered' && presentation.landingEnabled)) {
        throw new Error('ZEN_APP_PETAL_PRESENTATION_INVALID');
    }
    return presentation;
};
