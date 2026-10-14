import {
    DEFAULT_ZEN_WATER_REFLECTION_ALGORITHM,
    ZEN_WATER_REFLECTION_ALGORITHMS,
} from '../../contracts/zenWaterReflectionAlgorithms.js';
import { DEFAULT_KOI_APPENDAGE_PROFILE } from './koiAppendageGeometryCore.js';

const KOI_RARITY_WEIGHT_TABLE = Object.freeze({
    common: 36,
    uncommon: 14,
    rare: 4,
    legendary: 1,
});

const resolvePaletteSpawnWeight = (palette) => {
    const rarityKey = typeof palette?.rarity === 'string'
        ? palette.rarity.toLowerCase()
        : 'common';
    const rarityWeight = KOI_RARITY_WEIGHT_TABLE[rarityKey] || KOI_RARITY_WEIGHT_TABLE.common;
    const spawnBiasValue = Number(palette?.spawnBias);
    const spawnBias = Number.isFinite(spawnBiasValue) && spawnBiasValue > 0
        ? spawnBiasValue
        : 1;
    return Math.max(0.0001, rarityWeight * spawnBias);
};

const normalizeRatio01 = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return Math.random();
    const fractional = numeric - Math.floor(numeric);
    return fractional < 0 ? fractional + 1 : fractional;
};

const PALETTES = {
    elegant: [
        // Gosanke
        { id: 'kohaku', name: 'Kohaku', group: 'gosanke', rarity: 'common', scaleType: 'wagoi', body: '#F8F7F2', pattern: '#E6471E', secondary: null, accent: '#B71C1C', fin: '#FFF4EE', tail: '#FFD6CC', style: 'patches', spawnBias: 1.4 },
        { id: 'sanke', name: 'Sanke', group: 'gosanke', rarity: 'common', scaleType: 'wagoi', body: '#F5F5F5', pattern: '#D32F2F', secondary: '#1F1F1F', accent: '#D32F2F', fin: '#FFFFFF', tail: '#FFCDD2', style: 'patches-spots', spawnBias: 1.2 },
        { id: 'showa', name: 'Showa', group: 'gosanke', rarity: 'common', scaleType: 'wagoi', body: '#2A2D31', pattern: '#D32F2F', secondary: '#F2F5F6', accent: '#F44336', fin: '#42464B', tail: '#D32F2F', style: 'patches-dual', spawnBias: 1.0 },

        // Utsurimono
        { id: 'shiro_utsuri', name: 'Shiro Utsuri', group: 'utsurimono', rarity: 'uncommon', scaleType: 'wagoi', body: '#1F1F1F', pattern: '#F8F8F8', secondary: null, accent: '#E0E0E0', fin: '#3A3A3A', tail: '#FAFAFA', style: 'patches-bold', spawnBias: 1.0 },
        { id: 'hi_utsuri', name: 'Hi Utsuri', group: 'utsurimono', rarity: 'uncommon', scaleType: 'wagoi', body: '#1F1F1F', pattern: '#E53935', secondary: null, accent: '#FF7043', fin: '#3A3A3A', tail: '#E53935', style: 'patches-bold', spawnBias: 0.85 },
        { id: 'ki_utsuri', name: 'Ki Utsuri', group: 'utsurimono', rarity: 'uncommon', scaleType: 'wagoi', body: '#1F1F1F', pattern: '#FFB300', secondary: null, accent: '#FFD54F', fin: '#3A3A3A', tail: '#FFB300', style: 'patches-bold', spawnBias: 0.8 },

        // Bekko
        { id: 'shiro_bekko', name: 'Shiro Bekko', group: 'bekko', rarity: 'uncommon', scaleType: 'wagoi', body: '#F9F9F9', pattern: '#212121', secondary: null, accent: '#424242', fin: '#FFFFFF', tail: '#ECEFF1', style: 'spots', spawnBias: 0.95 },
        { id: 'aka_bekko', name: 'Aka Bekko', group: 'bekko', rarity: 'uncommon', scaleType: 'wagoi', body: '#E65B3D', pattern: '#212121', secondary: null, accent: '#BF360C', fin: '#FF8A65', tail: '#FF7043', style: 'spots', spawnBias: 0.9 },
        { id: 'ki_bekko', name: 'Ki Bekko', group: 'bekko', rarity: 'uncommon', scaleType: 'wagoi', body: '#FFD54F', pattern: '#212121', secondary: null, accent: '#FFB300', fin: '#FFE082', tail: '#FFD54F', style: 'spots', spawnBias: 0.75 },

        // Asagi / Shusui
        { id: 'asagi', name: 'Asagi', group: 'asagi', rarity: 'common', scaleType: 'wagoi', body: '#8FA4AF', pattern: '#C8452E', secondary: '#4D6574', accent: '#A82A1A', fin: '#DFE7EC', tail: '#EE9A89', style: 'checkered', spawnBias: 0.95 },
        { id: 'shusui', name: 'Shusui', group: 'asagi', rarity: 'common', scaleType: 'doitsu', body: '#B2C2CB', pattern: '#F86A3E', secondary: '#607D8B', accent: '#BF360C', fin: '#D4DEE4', tail: '#FFAB91', style: 'lateral-stripe', spawnBias: 0.85 },

        // Koromo / Goshiki
        { id: 'ai_goromo', name: 'Ai Goromo', group: 'koromo', rarity: 'uncommon', scaleType: 'wagoi', body: '#F6F7F8', pattern: '#CF3C2A', secondary: '#40556B', accent: '#8D1D16', fin: '#EEF3F7', tail: '#FFCCBC', style: 'patches-dual', spawnBias: 0.9 },
        { id: 'goshiki', name: 'Goshiki', group: 'goshiki', rarity: 'uncommon', scaleType: 'wagoi', body: '#5D6973', pattern: '#C63B36', secondary: '#2E3D49', accent: '#E57373', fin: '#8FA0AA', tail: '#C8D1D7', style: 'patches-dual', spawnBias: 0.85 },

        // Tancho variants
        { id: 'tancho_kohaku', name: 'Tancho Kohaku', group: 'tancho', rarity: 'rare', scaleType: 'wagoi', body: '#FAFAFA', pattern: '#D32F2F', secondary: null, accent: '#FF1744', fin: '#FAFAFA', tail: '#FAFAFA', style: 'tancho', spawnBias: 1.2 },
        { id: 'tancho_sanke', name: 'Tancho Sanke', group: 'tancho', rarity: 'rare', scaleType: 'wagoi', body: '#F6F6F6', pattern: '#D32F2F', secondary: '#212121', accent: '#D32F2F', fin: '#FFFFFF', tail: '#E6E6E6', style: 'tancho-spots', spawnBias: 1.0 },
        { id: 'tancho_showa', name: 'Tancho Showa', group: 'tancho', rarity: 'rare', scaleType: 'wagoi', body: '#EFEFEF', pattern: '#D32F2F', secondary: '#232323', accent: '#B71C1C', fin: '#D8D8D8', tail: '#EF9A9A', style: 'tancho-dual', spawnBias: 0.9 },

        // Hikari
        { id: 'platinum_ogon', name: 'Platinum Ogon', group: 'hikari_muji', rarity: 'common', scaleType: 'wagoi', hikari: true, body: '#FFFFFF', pattern: null, secondary: null, accent: '#ECEFF1', fin: '#FFFFFF', tail: '#FFFFFF', style: 'solid', spawnBias: 0.75 },
        { id: 'yamabuki_ogon', name: 'Yamabuki Ogon', group: 'hikari_muji', rarity: 'common', scaleType: 'wagoi', hikari: true, body: '#FFECB3', pattern: null, secondary: null, accent: '#FFE082', fin: '#FFF8E1', tail: '#FFE082', style: 'solid', spawnBias: 0.85 },
        { id: 'kujaku', name: 'Kujaku', group: 'hikari_moyo', rarity: 'uncommon', scaleType: 'wagoi', hikari: true, body: '#F2F3F4', pattern: '#E56A31', secondary: '#516E7A', accent: '#8C2F1D', fin: '#F4E0C6', tail: '#EABF9A', style: 'checkered', spawnBias: 0.7 },
        { id: 'kikusui', name: 'Kikusui', group: 'hikari_moyo', rarity: 'uncommon', scaleType: 'doitsu', hikari: true, body: '#FFF9F0', pattern: '#F36B3F', secondary: null, accent: '#C43D19', fin: '#FFE7D1', tail: '#FFC8A8', style: 'patches', spawnBias: 0.65 },
        { id: 'kin_showa', name: 'Kin Showa', group: 'hikari_utsuri', rarity: 'rare', scaleType: 'wagoi', hikari: true, body: '#3A3A34', pattern: '#E83A2E', secondary: '#F7C24B', accent: '#FF8F00', fin: '#57564E', tail: '#F4511E', style: 'patches-dual', spawnBias: 0.7 },

        // Kawarimono / Mujimono
        { id: 'chagoi', name: 'Chagoi', group: 'kawarimono', rarity: 'common', scaleType: 'wagoi', body: '#8C6448', pattern: null, secondary: null, accent: '#6D4C41', fin: '#A2775B', tail: '#8C6448', style: 'solid', spawnBias: 0.95 },
        { id: 'soragoi', name: 'Soragoi', group: 'kawarimono', rarity: 'common', scaleType: 'wagoi', body: '#98A7B4', pattern: null, secondary: null, accent: '#78909C', fin: '#B0BEC5', tail: '#9FAEB9', style: 'solid', spawnBias: 0.9 },
        { id: 'kigoi', name: 'Kigoi', group: 'kawarimono', rarity: 'uncommon', scaleType: 'wagoi', body: '#FAD764', pattern: null, secondary: null, accent: '#FBC02D', fin: '#FFE082', tail: '#FAD764', style: 'solid', spawnBias: 0.75 },
        { id: 'benigoi', name: 'Benigoi', group: 'kawarimono', rarity: 'uncommon', scaleType: 'wagoi', body: '#FF7043', pattern: null, secondary: null, accent: '#D84315', fin: '#FF8A65', tail: '#FF7043', style: 'solid', spawnBias: 0.8 },

        // Scale-focused variants
        { id: 'ginrin_kohaku', name: 'Ginrin Kohaku', group: 'ginrin', rarity: 'rare', scaleType: 'wagoi', ginrin: true, body: '#F8F7F2', pattern: '#E64A19', secondary: null, accent: '#C62828', fin: '#FBE9E7', tail: '#FFCCBC', style: 'patches', spawnBias: 0.85 },
        { id: 'doitsu_kohaku', name: 'Doitsu Kohaku', group: 'doitsu', rarity: 'rare', scaleType: 'doitsu', body: '#F9F8F3', pattern: '#E64A19', secondary: null, accent: '#B71C1C', fin: '#FDEEE7', tail: '#FFD9CC', style: 'patches', spawnBias: 0.8 },
    ],
};

const pickElegantPaletteIndexByRatio = (ratio = Math.random(), options = {}) => {
    const pool = Array.isArray(PALETTES?.elegant) ? PALETTES.elegant : [];
    if (pool.length === 0) return 0;

    const excludeValue = Number(options?.excludeIndex);
    const excludeIndex = Number.isFinite(excludeValue)
        ? Math.max(0, Math.min(pool.length - 1, Math.floor(excludeValue)))
        : null;

    let cumulative = 0;
    const weightedIndices = [];
    for (let index = 0; index < pool.length; index += 1) {
        if (excludeIndex !== null && index === excludeIndex) continue;
        const weight = resolvePaletteSpawnWeight(pool[index]);
        if (weight <= 0) continue;
        cumulative += weight;
        weightedIndices.push({ index, cumulative });
    }

    if (weightedIndices.length === 0) {
        return excludeIndex === null ? 0 : excludeIndex;
    }

    const target = normalizeRatio01(ratio) * cumulative;
    for (let i = 0; i < weightedIndices.length; i += 1) {
        if (target <= weightedIndices[i].cumulative) return weightedIndices[i].index;
    }
    return weightedIndices[weightedIndices.length - 1].index;
};

const DEFAULT_KOI_TUNING = {
    // Global
    speed: 1.3,
    baseSize: 15,
    historyLength: 31,
    headLen: 0.1,
    headWidth: 0.99,
    headMin: 0.22,
    shoulderMax: 0.85,
    shoulderPos: 0.31,
    midWidth: 0.75,
    midPos: 0.52,
    tailWidth: 0.12,
    tailCurve: 1.15,

    // Fins
    ...DEFAULT_KOI_APPENDAGE_PROFILE,
    pectoralFlutterAmp: 0.34,
    pectoralFlutterSpeed: 1.22,
    pectoralStrokePreloadPhase: 0.08,
    pectoralStrokePowerEndPhase: 0.38,
    pectoralStrokeRecoveryEndPhase: 0.76,
    pectoralStrokeOvershootPhase: 0.9,
    pectoralStrokePreloadDepth: 0.22,
    pectoralStrokeOvershootAmp: 0.18,
    pectoralTurnThreshold: 0.0012,
    pectoralTurnRateRef: 0.064,
    pectoralTurnRateBoost: 2.25,
    pectoralOpposingRateMin: 0.52,
    pectoralDriveAmpBoost: 0.95,
    pectoralOpposingAmpMin: 0.5,
    pectoralDriveSweep: 0.24,
    pectoralOpposingFold: 0.56,
    pectoralOpposingRecoveryFeather: 0.24,
    // Nature (Environment)
    // 13 pads covered only ~11% of the surface and yielded ~4 blooms, which
    // read as an empty pond. Koi render below the lilyPads layer, so pad
    // coverage costs them no swimming room - it occludes and adds depth.
    padDensity: 32,
    flowerChance: 0.35,
    particleDensity: 55,
    pollenDensity: 30,
    rockDensity: 0.72,
    rockClusterBias: 0.46,
    rockSizeVariance: 0.86,
    rockToneVariance: 0.34,
    pondPaletteId: 'zen_garden',
    pondClarityBlend: 0.55,
    temporalNightTintStrength: 1.0,
    // Visuals (Moved to Head/Nature in UI)
    eyeFB: -0.5,
    eyeSP: -0.3,
    koiMotionProfile: {
        grace: 0.62,
        agility: 0.48,
        tailDrive: 0.58,
        turnSharpness: 0.46,
    },
    // Cause-driven environment drivers (authoring controls).
    envCloudiness: 0.38,
    envRainIntensity: 0,
    envWaterClarity: 0.64,
    waterReflectionAlgorithm: DEFAULT_ZEN_WATER_REFLECTION_ALGORITHM,
    compareWaterReflectionAlgorithms: false,
    compareWaterReflectionAlgorithmA: ZEN_WATER_REFLECTION_ALGORITHMS.LOOPED_CAUSTIC,
    compareWaterReflectionAlgorithmB: ZEN_WATER_REFLECTION_ALGORITHMS.LIMITED_WAVES,
    waterReflectionStability: 0.72,
    waterReflectionSpatialStability: 0.58,
    waterReflectionDetailStability: 0.44,
    waterReflectionTemporalStability: 0.46,
    waterReflectionSoftKnee: 0,

    // Physics (Existing & Enhanced)
    physics: {
        swimModel: 'event_fsm_life_v1',
        compareSwimModels: false,
        compareModelA: 'event_fsm',
        compareModelB: 'event_fsm_life_v2',
        coreSegment: 0.5,
        waveAmplitudeScale: 3.2,
        wavelengthScale: 6.0,
        spineStiffness: 4.0,
        swimSpeedScale: 3.6,
        accelScale: 2.5,
        frictionScale: 1.05,
        hybridCurvatureGain: 1.05,
        hybridTurnResponse: 1.12,
        hybridThrustGain: 1.12,
        hybridRearWaveGain: 1.35,
        hybridCounterYawGain: 1.15,
        hybridHeadSwayGain: 1.2,
        eventHeadYawGain: 2.8,
        eventHeadTurnLeadGain: 2.8,
        eventHeadSwayGain: 2.8,
        eventHeadPivotFollow: 2.8,
        eventEyeAnchorIndex: 3,
        aiWaveScale: 0.46,
        aiHeadingCadence: 2,
        flowSampleCadence: 2,
        debugOverlay: false,
        debugVectors: false,
    }
};
const PHYSICS_PROPS = {
    baseCruiseThrottle: 0.65, // 0.58 -> 0.65 상향
    minCruiseThrottle: 0.42,
    burstThrottle: 1.1,
    throttleRise: 0.28, // 반응성 향상
    throttleFall: 0.15,
    forwardBaseForce: 0.72,
    throttleForce: 4.5, // 2.85 -> 4.5 상향
    burstExtraForce: 0.95,
    brakeForce: 1.6,
    yawDamping: 0.82,
    yawRateMax: 0.072,
    yawRateBoost: 0.032,
    beatTurnImpulse: 0.18, // 조향 타격감 강화
    beatTurnDecay: 0.18,
    manualTurnStrokeFrames: 6,
    manualTurnStrokeFramesBoost: 3,
    manualTurnHold: 0.012,
    aiTurnDeadbandEnter: 0.09,
    aiTurnDeadbandExit: 0.06,
    aiTurnAccumGain: 0.085,
    aiTurnAccumDecay: 0.06,
    aiTurnCommitMin: 8,
    aiTurnCommitMax: 14,
    aiTurnRefractoryMin: 26,
    aiTurnRefractoryMax: 46,
    aiTurnCruiseBlend: 0.02,
    aiTurnEnergyDecay: 0.0018,
    aiTurnEnergyGate: 0.42,
    aiTurnImpulseStep: 0.05,
    flowBaseWeight: 0.32,
    // [수정] C-턴 쿨다운 대폭 감소 (Phase 6): 5~10초 사이로 조정
    cTurnCooldownMin: 300,
    cTurnCooldownMax: 600,
};
export {
    PALETTES,
    KOI_RARITY_WEIGHT_TABLE,
    resolvePaletteSpawnWeight,
    pickElegantPaletteIndexByRatio,
    DEFAULT_KOI_TUNING,
    PHYSICS_PROPS,
};
