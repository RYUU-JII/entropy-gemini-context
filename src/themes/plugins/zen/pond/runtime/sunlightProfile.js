import { clamp as clampValue } from '../model/koi/koiMotion.js';

const toNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return numeric;
};

const clampNumber = (value, min, max, fallback = min) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
};

const clamp01 = (value, fallback = 0) => clampNumber(value, 0, 1, fallback);

const clampSunlightMultiplier = (value, fallback = 1) => clampNumber(value, 0, 2, fallback);

const clampSunlightScale = (value, fallback = 1, max = 2) => clampNumber(value, 0, max, fallback);

const clampDuration = (value, fallback = 1) => clampNumber(value, 0.1, 5, fallback);

export const SUNLIGHT_RESPONSE_RANGES = Object.freeze({
    sunlightIntensity: Object.freeze({ min: 0, max: 1.25, step: 0.01, fallback: 0.58 }),
    sunlightResponseExponent: Object.freeze({ min: 0.45, max: 2.6, step: 0.05, fallback: 1.05 }),
    sunlightSurfaceScale: Object.freeze({ min: 0, max: 2.8, step: 0.01, fallback: 1 }),
    sunlightCausticsScale: Object.freeze({ min: 0, max: 2.8, step: 0.01, fallback: 1 }),
    sunlightRippleScale: Object.freeze({ min: 0, max: 3.2, step: 0.01, fallback: 1 }),
    sunlightGlimmerScale: Object.freeze({ min: 0, max: 6, step: 0.01, fallback: 1 }),
    waterRippleScale: Object.freeze({ min: 1.0, max: 15.0, step: 0.1, fallback: 8.4 }),
    waterSpeedMultiplier: Object.freeze({ min: 0.1, max: 5.0, step: 0.1, fallback: 0.85 }),
    refractionScale: Object.freeze({ min: 0, max: 2.4, step: 0.01, fallback: 0.14 }),
    refractionDensity: Object.freeze({ min: 0.55, max: 2.4, step: 0.01, fallback: 1.0 }),
    refractionAnisotropy: Object.freeze({ min: 0, max: 1.0, step: 0.01, fallback: 0.35 }),
    refractionMicroScale: Object.freeze({ min: 0.5, max: 3.2, step: 0.01, fallback: 1.0 }),
    refractionJitter: Object.freeze({ min: 0, max: 2.5, step: 0.01, fallback: 1.0 }),
    waterRippleIrregularity: Object.freeze({ min: 0, max: 2.4, step: 0.01, fallback: 0.72 }),
    pondDepthStrength: Object.freeze({ min: 0, max: 2.4, step: 0.01, fallback: 0.6 }),
    surfaceHighlightOpacity: Object.freeze({ min: 0, max: 1.4, step: 0.01, fallback: 1.0 }),
    surfaceHighlightPrimaryMix: Object.freeze({ min: 0, max: 2.0, step: 0.01, fallback: 1.0 }),
    surfaceHighlightMicroMix: Object.freeze({ min: 0, max: 2.0, step: 0.01, fallback: 1.0 }),
    surfaceHighlightFlutterSpeed: Object.freeze({ min: 0.2, max: 3.0, step: 0.01, fallback: 1.0 }),
    seasonalLatitude: Object.freeze({ min: 12, max: 58, step: 0.1, fallback: 35.6 }),
    seasonalDaylightStrength: Object.freeze({ min: 0, max: 1.6, step: 0.01, fallback: 1.0 }),
});

export const SUNLIGHT_RESPONSE_PARAM_META = Object.freeze({
    sunlightIntensity: {
        label: '햇살 강도',
        desc: '시간대 광량 입력값의 절대 배율입니다.',
    },
    sunlightResponseExponent: {
        label: '햇빛 반응 곡선',
        desc: '직달광에 대한 수면 재질의 반응 곡선을 조절합니다.',
    },
    sunlightCausticsScale: {
        label: '물결 반사 반응',
        desc: '햇빛에 따라 반사광 세기가 얼마나 따라오게 할지 조절합니다.',
    },
    sunlightSurfaceScale: {
        label: '수면 반응',
        desc: '햇빛에 따라 수면 하이라이트 반응 강도를 조절합니다.',
    },
    sunlightRippleScale: {
        label: '파동 반응',
        desc: '햇빛에 따라 물결 모양/속도가 얼마나 따라오게 할지 조절합니다.',
    },
    sunlightGlimmerScale: {
        label: '윤슬 반응',
        desc: '햇빛에 따라 윤슬 개수 증가량을 조절합니다.',
    },
    waterRippleScale: {
        label: '물결 크기 스케일',
        desc: '햇빛 동기화 반응으로 물결의 크기 스케일을 조정합니다.',
    },
    waterSpeedMultiplier: {
        label: '물결 속도 배율',
        desc: '햇빛 동기화 반응으로 물결의 이동 속도를 조정합니다.',
    },
    pondDepthStrength: {
        label: '수심 깊이감',
        desc: '바닥의 수심 단차/명암 강도가 햇빛에 따라 변하는 정도를 조절합니다.',
    },
    waterRippleIrregularity: {
        label: '물결 불규칙성',
        desc: '햇빛에 따라 물결 흔들림의 불규칙도를 가중합니다.',
    },
    refractionScale: {
        label: '굴절 강도',
        desc: '수중 레이어 굴절(왜곡) 강도를 조절합니다.',
    },
    refractionDensity: {
        label: '굴절 밀도',
        desc: '굴절 패턴의 조밀도를 조절합니다. 높을수록 파형이 촘촘해집니다.',
    },
    refractionAnisotropy: {
        label: '굴절 결 방향성',
        desc: '굴절 패턴이 수류 방향으로 정렬되는 정도입니다. 낮을수록 등방성(무방향)에 가깝습니다.',
    },
    refractionMicroScale: {
        label: '굴절 미세도',
        desc: '굴절 패턴의 미세 파장을 조절합니다. 높을수록 더 잘게 쪼개집니다.',
    },
    refractionJitter: {
        label: '굴절 불안정성',
        desc: '표면 불안정 난류를 가중해 굴절 요동을 키웁니다.',
    },
    surfaceHighlightOpacity: {
        label: '수면 하이라이트',
        desc: '수면 반짝임 하이라이트의 강도를 햇빛에 맞춰 가중합니다.',
    },
    surfaceHighlightPrimaryMix: {
        label: '하이라이트 메인 비중',
        desc: '넓은 하이라이트 밴드(Primary)의 기여도를 조절합니다.',
    },
    surfaceHighlightMicroMix: {
        label: '하이라이트 미세 비중',
        desc: '잘게 쪼개진 미세 하이라이트 밴드(Micro)의 기여도를 조절합니다.',
    },
    surfaceHighlightFlutterSpeed: {
        label: '하이라이트 요동 속도',
        desc: '수면 하이라이트가 흔들리는 시간 주파수를 조절합니다.',
    },
    seasonalLatitude: {
        label: '계절 위도',
        desc: '실시간 일출/일몰 길이 계산에 사용할 가상 위도(도)입니다.',
    },
    seasonalDaylightStrength: {
        label: '계절 일장 반영',
        desc: '계절에 따른 낮 길이/태양 고도 변화를 얼마나 강하게 반영할지 조절합니다.',
    },
});

const SUNLIGHT_LIGHT_GROUP = Object.freeze([
    'sunlightIntensity',
    'sunlightResponseExponent',
    'sunlightCausticsScale',
    'sunlightSurfaceScale',
    'sunlightRippleScale',
    'sunlightGlimmerScale',
]);

const SUNLIGHT_FLOW_GROUP = Object.freeze([
    'waterRippleScale',
    'waterSpeedMultiplier',
    'waterRippleIrregularity',
    'refractionScale',
    'refractionDensity',
    'refractionAnisotropy',
    'refractionMicroScale',
    'refractionJitter',
    'pondDepthStrength',
]);

const SUNLIGHT_ATMOSPHERE_GROUP = Object.freeze([
    'surfaceHighlightOpacity',
    'surfaceHighlightPrimaryMix',
    'surfaceHighlightMicroMix',
    'surfaceHighlightFlutterSpeed',
]);

export const SUNLIGHT_RESPONSE_GROUPS = Object.freeze({
    light: SUNLIGHT_LIGHT_GROUP,
    flow: SUNLIGHT_FLOW_GROUP,
    atmosphere: SUNLIGHT_ATMOSPHERE_GROUP,
});

const SUNLIGHT_RENDER_SCALE = Object.freeze({
    sunlightMax: 1.28,
    sunlightSurfaceScale: 1.34,
    sunlightCausticsScale: 1.22,
    sunlightRippleScale: 1.26,
    sunlightGlimmerLift: 1.25,
});

const makeFxBundle = ({
    sunlightSurface,
    sunlightCaustics,
    sunlightRipple,
    sunlightSurfaceScale,
    sunlightCausticsScale,
    sunlightRippleScale,
    sunlightGlimmerScale,
    daylight,
    responseCurve,
}) => {
    const sunlightSurfaceFx = clampValue(sunlightSurface / SUNLIGHT_RENDER_SCALE.sunlightSurfaceScale, 0, 1);
    const sunlightCausticsFx = clampValue(sunlightCaustics / SUNLIGHT_RENDER_SCALE.sunlightCausticsScale, 0, 1);
    const sunlightRippleFx = clampValue(sunlightRipple / SUNLIGHT_RENDER_SCALE.sunlightRippleScale, 0, 1);
    const normalizedGlimmerScale = clampValue(
        sunlightGlimmerScale / SUNLIGHT_RESPONSE_RANGES.sunlightGlimmerScale.max,
        0,
        1,
    );

    const responseTone = clampValue(0.72 + responseCurve * 0.12, 0.72, 1.1);
    const normalizedSurfaceScale = clampValue(sunlightSurfaceScale / SUNLIGHT_RENDER_SCALE.sunlightSurfaceScale, 0, 2.1);
    const normalizedCausticsScale = clampValue(sunlightCausticsScale / SUNLIGHT_RENDER_SCALE.sunlightCausticsScale, 0, 2.1);
    const normalizedRippleScale = clampValue(sunlightRippleScale / SUNLIGHT_RENDER_SCALE.sunlightRippleScale, 0, 2.4);

    return {
        sunlightSurfaceFx,
        sunlightCausticsFx,
        sunlightRippleFx,
        godRayGain: clampValue(0.2 + responseCurve * 0.34 + daylight * 0.2, 0.16, 1.0) * responseTone,
        godRayDensity: clampValue(0.22 + responseCurve * 0.42 + normalizedSurfaceScale * 0.11, 0.18, 1.0),
        godRayFrequencyGain: clampValue(0.45 + responseCurve * 0.41 + normalizedSurfaceScale * 0.08, 0.45, 1.12),
        godRayPulse: clampValue(0.2 + daylight * 0.44 + responseCurve * 0.32, 0.2, 1.0),
        causticLayerGain: clampValue(0.2 + sunlightCausticsFx * 0.3 + sunlightSurfaceFx * 0.15, 0.2, 0.86),
        causticMicroGain: clampValue(0.18 + sunlightCausticsFx * 0.22 + daylight * 0.12, 0.18, 0.58),
        causticDensityGain: clampValue(
            0.22 + responseCurve * 0.45 + sunlightSurfaceFx * 0.18 + sunlightCausticsFx * 0.14,
            0.2,
            1.45,
        ),
        rippleMotionGain: clampValue(
            0.58 + responseCurve * 0.25 + sunlightRippleFx * 0.2 + normalizedGlimmerScale * 0.06,
            0.56,
            1.54,
        ),
        glimmerDensityGain: clampValue(
            0.24 + sunlightSurfaceFx * 0.52 + responseCurve * 0.56 + normalizedGlimmerScale * SUNLIGHT_RENDER_SCALE.sunlightGlimmerLift,
            0.24,
            2.8,
        ),
        surfaceHighlight: clampValue(0.28 + responseCurve * 0.24 + normalizedRippleScale * 0.08, 0.28, 0.78),
    };
};

const resolveRippleScale = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 8.4;
    return clampNumber(numeric, 1.0, 15.0);
};

const normalizeSunlightBoundaryInput = ({
    tuning = {},
    envState = null,
    intensityScale = 1,
} = {}) => {
    const sunlightIntensity = clampSunlightScale(
        toNumber(tuning?.sunlightIntensity, SUNLIGHT_RESPONSE_RANGES.sunlightIntensity.fallback),
        SUNLIGHT_RESPONSE_RANGES.sunlightIntensity.fallback,
        SUNLIGHT_RESPONSE_RANGES.sunlightIntensity.max,
    );
    const envLightIntensity = envState.directSunlight;
    const intensityScaleSafe = clampNumber(intensityScale, 0, 2, 1);
    const daylight = envState.daylight;
    const responseExponent = clampNumber(
        tuning?.sunlightResponseExponent,
        SUNLIGHT_RESPONSE_RANGES.sunlightResponseExponent.min,
        SUNLIGHT_RESPONSE_RANGES.sunlightResponseExponent.max,
        SUNLIGHT_RESPONSE_RANGES.sunlightResponseExponent.fallback,
    );
    const responseCurve = Math.pow(clamp01(envLightIntensity / 1.25), responseExponent);
    const sunlight = clampValue(
        sunlightIntensity * envLightIntensity * intensityScaleSafe,
        0,
        SUNLIGHT_RENDER_SCALE.sunlightMax,
    );
    return {
        sunlightIntensity,
        envLightIntensity,
        intensityScaleSafe,
        daylight,
        responseExponent,
        responseCurve,
        sunlight,
        sunlightSurfaceScale: clampSunlightScale(
            tuning?.sunlightSurfaceScale,
            SUNLIGHT_RESPONSE_RANGES.sunlightSurfaceScale.fallback,
            SUNLIGHT_RESPONSE_RANGES.sunlightSurfaceScale.max,
        ),
        sunlightCausticsScale: clampSunlightScale(
            tuning?.sunlightCausticsScale,
            SUNLIGHT_RESPONSE_RANGES.sunlightCausticsScale.fallback,
            SUNLIGHT_RESPONSE_RANGES.sunlightCausticsScale.max,
        ),
        sunlightRippleScale: clampSunlightScale(
            tuning?.sunlightRippleScale,
            SUNLIGHT_RESPONSE_RANGES.sunlightRippleScale.fallback,
            SUNLIGHT_RESPONSE_RANGES.sunlightRippleScale.max,
        ),
        sunlightGlimmerScale: clampSunlightScale(
            tuning?.sunlightGlimmerScale,
            SUNLIGHT_RESPONSE_RANGES.sunlightGlimmerScale.fallback,
            SUNLIGHT_RESPONSE_RANGES.sunlightGlimmerScale.max,
        ),
        refractionScale: clampSunlightScale(
            tuning?.refractionScale,
            SUNLIGHT_RESPONSE_RANGES.refractionScale.fallback,
            SUNLIGHT_RESPONSE_RANGES.refractionScale.max,
        ),
        refractionDensity: clampSunlightScale(
            tuning?.refractionDensity,
            SUNLIGHT_RESPONSE_RANGES.refractionDensity.fallback,
            SUNLIGHT_RESPONSE_RANGES.refractionDensity.max,
        ),
        refractionAnisotropy: clamp01(
            tuning?.refractionAnisotropy,
            SUNLIGHT_RESPONSE_RANGES.refractionAnisotropy.fallback,
        ),
        refractionMicroScale: clampSunlightScale(
            tuning?.refractionMicroScale,
            SUNLIGHT_RESPONSE_RANGES.refractionMicroScale.fallback,
            SUNLIGHT_RESPONSE_RANGES.refractionMicroScale.max,
        ),
        refractionJitter: clampSunlightScale(
            tuning?.refractionJitter,
            SUNLIGHT_RESPONSE_RANGES.refractionJitter.fallback,
            SUNLIGHT_RESPONSE_RANGES.refractionJitter.max,
        ),
        causticsIntensity: clampSunlightMultiplier(tuning?.causticsIntensity, 1),
        causticsOpacity: clamp01(toNumber(tuning?.causticsOpacity, 1), 1),
        waterSpeedMultiplier: clampDuration(tuning?.waterSpeedMultiplier, 0.85),
        waterRippleScale: resolveRippleScale(tuning?.waterRippleScale),
        waterRippleIrregularity: clampSunlightScale(
            tuning?.waterRippleIrregularity,
            SUNLIGHT_RESPONSE_RANGES.waterRippleIrregularity.fallback,
            SUNLIGHT_RESPONSE_RANGES.waterRippleIrregularity.max,
        ),
        pondDepthStrength: clampSunlightScale(
            tuning?.pondDepthStrength,
            SUNLIGHT_RESPONSE_RANGES.pondDepthStrength.fallback,
            SUNLIGHT_RESPONSE_RANGES.pondDepthStrength.max,
        ),
        surfaceHighlightOpacity: clampSunlightScale(
            tuning?.surfaceHighlightOpacity,
            SUNLIGHT_RESPONSE_RANGES.surfaceHighlightOpacity.fallback,
            SUNLIGHT_RESPONSE_RANGES.surfaceHighlightOpacity.max,
        ),
        surfaceHighlightPrimaryMix: clampSunlightScale(
            tuning?.surfaceHighlightPrimaryMix,
            SUNLIGHT_RESPONSE_RANGES.surfaceHighlightPrimaryMix.fallback,
            SUNLIGHT_RESPONSE_RANGES.surfaceHighlightPrimaryMix.max,
        ),
        surfaceHighlightMicroMix: clampSunlightScale(
            tuning?.surfaceHighlightMicroMix,
            SUNLIGHT_RESPONSE_RANGES.surfaceHighlightMicroMix.fallback,
            SUNLIGHT_RESPONSE_RANGES.surfaceHighlightMicroMix.max,
        ),
        surfaceHighlightFlutterSpeed: clampSunlightScale(
            tuning?.surfaceHighlightFlutterSpeed,
            SUNLIGHT_RESPONSE_RANGES.surfaceHighlightFlutterSpeed.fallback,
            SUNLIGHT_RESPONSE_RANGES.surfaceHighlightFlutterSpeed.max,
        ),
        seasonalLatitude: clampNumber(
            tuning?.seasonalLatitude,
            SUNLIGHT_RESPONSE_RANGES.seasonalLatitude.min,
            SUNLIGHT_RESPONSE_RANGES.seasonalLatitude.max,
            SUNLIGHT_RESPONSE_RANGES.seasonalLatitude.fallback,
        ),
        seasonalDaylightStrength: clampSunlightScale(
            tuning?.seasonalDaylightStrength,
            SUNLIGHT_RESPONSE_RANGES.seasonalDaylightStrength.fallback,
            SUNLIGHT_RESPONSE_RANGES.seasonalDaylightStrength.max,
        ),
    };
};

export const resolveSunlightResponseProfile = ({
    tuning = {},
    envState = null,
    intensityScale = 1,
} = {}) => {
    const normalized = normalizeSunlightBoundaryInput({
        tuning,
        envState,
        intensityScale,
    });
    const {
        sunlightIntensity,
        envLightIntensity,
        intensityScaleSafe,
        daylight,
        responseExponent,
        responseCurve,
        sunlight,
        sunlightSurfaceScale,
        sunlightCausticsScale,
        sunlightRippleScale,
        sunlightGlimmerScale,
        refractionScale,
        refractionDensity,
        refractionAnisotropy,
        refractionMicroScale,
        refractionJitter,
        causticsIntensity,
        causticsOpacity,
        waterSpeedMultiplier,
        waterRippleScale,
        waterRippleIrregularity,
        pondDepthStrength,
        surfaceHighlightOpacity,
        surfaceHighlightPrimaryMix,
        surfaceHighlightMicroMix,
        surfaceHighlightFlutterSpeed,
        seasonalLatitude,
        seasonalDaylightStrength,
    } = normalized;

    const sunlightSurface = clampValue(sunlight * sunlightSurfaceScale, 0, 1.95);
    const sunlightCaustics = clampValue(
        sunlight * sunlightCausticsScale * causticsIntensity,
        0,
        1.95,
    );
    const causticStrength = clampValue(
        sunlightCaustics * causticsOpacity,
        0,
        1.95,
    );
    const sunlightRipple = clampValue(sunlight * sunlightRippleScale, 0, 1.95);

    const sunlightFx = makeFxBundle({
        sunlightSurface,
        sunlightCaustics,
        sunlightRipple,
        sunlightSurfaceScale,
        sunlightCausticsScale,
        sunlightRippleScale,
        sunlightGlimmerScale,
        daylight,
        responseCurve,
    });

    const normalizedRippleScale = clampValue(sunlightRippleScale / SUNLIGHT_RESPONSE_RANGES.sunlightRippleScale.max, 0, 1.2);
    const rippleTightnessScale = clampValue(0.72 + responseCurve * 0.23 + normalizedRippleScale * 0.08, 0.7, 1.35);
    const rippleMotionScale = clampValue(
        0.58 + responseCurve * 0.32 + normalizedRippleScale * 0.2 + (sunlightRipple / 2.0) * 0.12,
        0.58,
        1.62,
    );
    const surfaceGain = clampValue(
        0.62 + responseCurve * 0.22 + clamp01(sunlightSurface) * 0.2,
        0.54,
        1.38,
    );
    const causticResponseScale = clampValue(
        0.52 + responseCurve * 0.34 + sunlightFx.sunlightCausticsFx * 0.12,
        0.52,
        1.05,
    );
    const irregResponse = clampValue(0.8 + responseCurve * 0.14 + clamp01(sunlightRipple) * 0.1, 0.8, 1.14);
    const shimmerGain = clampValue(0.2 + daylight * 0.56 + responseCurve * 0.22, 0.2, 1.0);
    const refractionDrive = clampValue(
        refractionScale
            * (0.26 + responseCurve * 0.28 + (sunlightSurfaceScale - 1) * 0.08)
            * (0.58 + clamp01(daylight) * 0.22),
        0,
        0.82,
    );
    const surfaceSparkleDrive = clampValue(
        0.16 + clamp01(sunlightSurface) * 0.5 + responseCurve * 0.18,
        0.16,
        0.9,
    );
    const surfaceSheenGain = clampValue(
        surfaceHighlightOpacity
        * sunlightSurface
        * (0.6 + responseCurve * 0.4),
        0,
        1.35,
    );
    const surfaceSparkleGain = clampValue(
        surfaceHighlightOpacity * shimmerGain * sunlightSurface,
        0,
        1.25,
    );

    const responseProfile = Object.freeze({
        envLightIntensity,
        daylight,
        responseCurve,
        responseExponent,
        intensityScale: intensityScaleSafe,
    });
    const scaleProfile = Object.freeze({
        sunlightIntensity,
        sunlightSurfaceScale,
        sunlightCausticsScale,
        sunlightRippleScale,
        sunlightGlimmerScale,
        refractionScale,
        refractionDensity,
        refractionAnisotropy,
        refractionMicroScale,
        refractionJitter,
        causticsIntensity,
        causticsOpacity,
        waterSpeedMultiplier,
        waterRippleScale,
        waterRippleIrregularity,
        pondDepthStrength,
        surfaceHighlightOpacity,
        surfaceHighlightPrimaryMix,
        surfaceHighlightMicroMix,
        surfaceHighlightFlutterSpeed,
        seasonalLatitude,
        seasonalDaylightStrength,
    });
    const valueProfile = Object.freeze({
        sunlight,
        sunlightSurface,
        sunlightCaustics,
        sunlightRipple,
        causticStrength,
    });
    const couplingProfile = Object.freeze({
        rippleTightnessScale,
        rippleMotionScale,
        surfaceGain,
        irregResponse,
        causticResponseScale,
    });
    const renderProfile = Object.freeze({
        shimmerGain,
        refractionDrive,
        refractionDensity,
        refractionAnisotropy,
        surfaceSparkleDrive,
        surfaceSheenGain,
        surfaceSparkleGain,
        refractionMicroScale,
        refractionJitter,
        seasonalLatitude,
        seasonalDaylightStrength,
    });
    const lightLinked = Object.freeze({
        sunlight,
        daylight,
        responseCurve,
        sunlightSurface,
        sunlightCaustics,
        causticStrength,
        sunlightRipple,
        surfaceSheenGain,
        surfaceSparkleGain,
        causticResponseScale,
        godRayGain: sunlightFx.godRayGain,
        godRayDensity: sunlightFx.godRayDensity,
        godRayFrequencyGain: sunlightFx.godRayFrequencyGain,
        godRayPulse: sunlightFx.godRayPulse,
        causticLayerGain: sunlightFx.causticLayerGain,
        causticMicroGain: sunlightFx.causticMicroGain,
        causticDensityGain: sunlightFx.causticDensityGain,
        glimmerDensityGain: sunlightFx.glimmerDensityGain,
    });

    return {
        ...responseProfile,
        ...scaleProfile,
        ...valueProfile,
        ...couplingProfile,
        ...renderProfile,
        sunlightFx,
        lightLinked,
        responseProfile,
        scaleProfile,
        valueProfile,
        couplingProfile,
        renderProfile,
    };
};
