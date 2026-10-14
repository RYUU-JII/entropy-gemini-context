export const ZEN_VISUAL_TARGET_TOLERANCES = Object.freeze({
    sceneBrightness: 0.012,
    bottomVisibility: 0.0001,
    causticStrength: 0.012,
    surfaceSheenGain: 0.02,
    surfaceSparkleGain: 0.02,
    yoonseulIntensity: 0.03,
    yoonseulOpacity: 0.08,
    yoonseulFocus: 0.03,
    surfaceRoughness: 0.03,
    lightColorChannel: 8,
    lightColorAlpha: 0.02,
});

// Baseline captured from the canonical surface-field presentation model:
// causes(lightAmount <- time, cloudiness, waterTurbidity <- 1 - clarity).
// Timestamp reference: 2026-07-11.
export const ZEN_VISUAL_TARGET_TABLE = Object.freeze([
    Object.freeze({
        id: 'noon_clear',
        label: '정오 맑음',
        causes: Object.freeze({
            manualHour: 12.0,
            envCloudiness: 0.15,
            envWaterClarity: 0.72,
        }),
        expected: Object.freeze({
            sceneBrightness: 0.853118,
            bottomVisibility: 0.72,
            causticStrength: 0.614245,
            surfaceSheenGain: 0.428479,
            surfaceSparkleGain: 0.300253,
            yoonseulIntensity: 0.799226,
            yoonseulOpacity: 0.915769,
            yoonseulFocus: 0.677592,
            surfaceRoughness: 0.407823,
            lightColor: 'rgba(255, 250, 230, 1.00)',
        }),
    }),
    Object.freeze({
        id: 'noon_cloudy',
        label: '정오 흐림',
        causes: Object.freeze({
            manualHour: 12.0,
            envCloudiness: 0.82,
            envWaterClarity: 0.72,
        }),
        expected: Object.freeze({
            sceneBrightness: 0.395471,
            bottomVisibility: 0.72,
            causticStrength: 0.284739,
            surfaceSheenGain: 0.198762,
            surfaceSparkleGain: 0.154605,
            yoonseulIntensity: 0.162458,
            yoonseulOpacity: 0.187292,
            yoonseulFocus: 0.306912,
            surfaceRoughness: 0.531661,
            lightColor: 'rgba(255, 250, 230, 1.00)',
        }),
    }),
    Object.freeze({
        id: 'night_clear',
        label: '야간 맑음',
        causes: Object.freeze({
            manualHour: 22.0,
            envCloudiness: 0.15,
            envWaterClarity: 0.72,
        }),
        expected: Object.freeze({
            sceneBrightness: 0.038108,
            bottomVisibility: 0.72,
            causticStrength: 0.027438,
            surfaceSheenGain: 0.167779,
            surfaceSparkleGain: 0.10177,
            yoonseulIntensity: 0.046492,
            yoonseulOpacity: 0.01559,
            yoonseulFocus: 0.180881,
            surfaceRoughness: 0.385726,
            lightColor: 'rgba(180, 191, 230, 1.00)',
        }),
    }),
    Object.freeze({
        id: 'night_cloudy',
        label: '야간 흐림',
        causes: Object.freeze({
            manualHour: 22.0,
            envCloudiness: 0.82,
            envWaterClarity: 0.72,
        }),
        expected: Object.freeze({
            sceneBrightness: 0.015184,
            bottomVisibility: 0.72,
            causticStrength: 0.010933,
            surfaceSheenGain: 0.08695,
            surfaceSparkleGain: 0.057733,
            yoonseulIntensity: 0.033147,
            yoonseulOpacity: 0,
            yoonseulFocus: 0.144111,
            surfaceRoughness: 0.509564,
            lightColor: 'rgba(180, 191, 230, 1.00)',
        }),
    }),
]);
