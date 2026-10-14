export const ENV_SCENE_PRESETS = Object.freeze([
    Object.freeze({
        id: 'balanced',
        label: '균형',
        desc: '전역 시간 아래에서 흐림과 수질을 균형 설정합니다.',
        patch: Object.freeze({
            envCloudiness: 0.38,
            envRainIntensity: 0,
            envWaterClarity: 0.64,
        }),
    }),
    Object.freeze({
        id: 'clear',
        label: '맑음',
        desc: '전역 시간 아래에서 낮은 흐림과 높은 수질을 적용합니다.',
        patch: Object.freeze({
            envCloudiness: 0.15,
            envRainIntensity: 0,
            envWaterClarity: 0.76,
        }),
    }),
    Object.freeze({
        id: 'cloudy',
        label: '흐림',
        desc: '전역 시간 아래에서 높은 흐림과 높은 수질을 적용합니다.',
        patch: Object.freeze({
            envCloudiness: 0.82,
            envRainIntensity: 0,
            envWaterClarity: 0.76,
        }),
    }),
    Object.freeze({
        id: 'rain',
        label: '비',
        desc: '흐린 낮의 확산광과 조밀한 경량 강우 파문을 함께 확인합니다.',
        patch: Object.freeze({
            envCloudiness: 0.9,
            envRainIntensity: 0.72,
            envWaterClarity: 0.74,
        }),
    }),
    Object.freeze({
        id: 'clear_turbid',
        label: '맑고 탁함',
        desc: '전역 시간 아래에서 낮은 흐림과 낮은 수질을 적용합니다.',
        patch: Object.freeze({
            envCloudiness: 0.18,
            envRainIntensity: 0,
            envWaterClarity: 0.62,
        }),
    }),
    Object.freeze({
        id: 'cloudy_turbid',
        label: '흐리고 탁함',
        desc: '전역 시간 아래에서 높은 흐림과 낮은 수질을 적용합니다.',
        patch: Object.freeze({
            envCloudiness: 0.84,
            envRainIntensity: 0,
            envWaterClarity: 0.62,
        }),
    }),
]);

export const resolveEnvScenePresetById = (presetId) => {
    if (!presetId || typeof presetId !== 'string') return null;
    return ENV_SCENE_PRESETS.find((preset) => preset.id === presetId) || null;
};
