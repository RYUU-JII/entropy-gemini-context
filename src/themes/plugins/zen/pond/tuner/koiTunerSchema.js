import { WATER_PALETTE_OPTIONS } from '../world/pondPalettes.js';
import {
    DEFAULT_ZEN_WATER_REFLECTION_ALGORITHM,
    ZEN_WATER_REFLECTION_ALGORITHMS,
    ZEN_WATER_REFLECTION_ALGORITHM_OPTIONS,
} from '../contracts/zenWaterReflectionAlgorithms.js';

/* ─── Swim Model options ──────────────────────────────────── */

const SWIM_MODEL_OPTIONS = [
    { value: 'cpg_dynamics', label: '연속 파동 (CPG)' },
    { value: 'kinematic_hybrid', label: '키네매틱 하이브리드' },
    { value: 'event_fsm', label: '이벤트 FSM' },
    { value: 'event_fsm_life_v1', label: '이벤트 FSM + Life Intent' },
    { value: 'event_fsm_life_v2', label: 'Life Intent v2 (연속 척추)' },
];

const KOI_SWIM_MODELS = Object.freeze(SWIM_MODEL_OPTIONS.map((option) => option.value));
const EVENT_FSM_MODELS = Object.freeze(['event_fsm', 'event_fsm_life_v1', 'event_fsm_life_v2']);
const SEGMENTED_SPINE_MODELS = Object.freeze(['cpg_dynamics', 'kinematic_hybrid', 'event_fsm', 'event_fsm_life_v1']);

/* ─── Source-of-truth param definitions ───────────────────── */

const BASE_PARAMS = {
    body: {
        structure: [
            { id: 'baseSize', label: 'Overall Size', min: 5, max: 25, step: 0.5, desc: '잉어의 전체적인 크기를 조절합니다.' },
            { id: 'historyLength', label: 'Segments (MD)', min: 10, max: 50, step: 1, desc: '척추의 마디 수입니다. 높을수록 더 부드럽고 긴 몸구조를 가집니다.' },
        ],
        head: [
            { id: 'headLen', label: 'Snout Length', min: 0.1, max: 0.6, step: 0.01, desc: '주둥이의 앞뒤 길이입니다.' },
            { id: 'headWidth', label: 'Head Width', min: 0.5, max: 1.7, step: 0.01, desc: '머리의 전체 상하폭입니다.' },
            { id: 'headMin', label: 'Nose Width', min: 0.05, max: 0.35, step: 0.01, desc: '코끝의 너비입니다. 낮을수록 뾰족한 주둥이가 됩니다.' },
            { id: 'eyeFB', label: 'Eye Position (F/B)', min: -1.5, max: 0.5, step: 0.05, desc: '눈이 머리 앞/뒤 어디에 위치할지 조절합니다.' },
            { id: 'eyeSP', label: 'Eye Spacing / Width', min: -1.0, max: 0.4, step: 0.05, desc: '눈 사이의 간격과 머리 옆면으로의 돌출 정도를 조절합니다.' },
        ],
        torso: [
            { id: 'shoulderMax', label: 'Shoulder Width', min: 0.3, max: 1.0, step: 0.01, desc: '머리 바로 뒤 어깨 부분의 최대 너비입니다.' },
            { id: 'shoulderPos', label: 'Shoulder Pos', min: 0.1, max: 0.45, step: 0.01, desc: '가장 넓은 어깨가 위치하는 몸통 지점입니다.' },
            { id: 'midWidth', label: 'Belly Width', min: 0.5, max: 1.1, step: 0.01, desc: '몸통 중간 부분의 너비입니다.' },
            { id: 'midPos', label: 'Belly Pos', min: 0.1, max: 0.6, step: 0.01, desc: '몸통 중앙점의 위치입니다.' },
        ],
        tail: [
            { id: 'tailWidth', label: 'Tail Base Width', min: 0.02, max: 0.22, step: 0.01, desc: '꼬리지느러미가 시작되는 미량부의 최소 너비입니다.' },
            { id: 'tailCurve', label: 'Tail Taper', min: 0.4, max: 2.0, step: 0.05, desc: '몸통에서 꼬리로 이어지는 곡선의 정도를 결정합니다.' },
        ],
    },
    physics: {
        locomotion: [
            {
                id: 'swimModel',
                label: 'Swim Model',
                type: 'select',
                options: SWIM_MODEL_OPTIONS,
                desc: '잉어 유영 코어 알고리즘입니다. Event FSM은 마디 추적 기반 유영, Life V1은 생활 행동 결합, Life V2는 연속 몸통 곡선, CPG는 연속 파동, Kinematic Hybrid는 꼬리 추진·곡률 중심 모델입니다.',
            },
            {
                id: 'compareSwimModels',
                label: 'Dual Model Compare',
                type: 'toggle',
                desc: 'Well Lab에서 아래 Compare A/B 모델을 좌우 동시 비교합니다.',
            },
            {
                id: 'compareModelA',
                label: 'Compare Model A',
                type: 'select',
                options: SWIM_MODEL_OPTIONS,
                desc: '좌측 비교 패널에 표시할 유영 모델입니다.',
            },
            {
                id: 'compareModelB',
                label: 'Compare Model B',
                type: 'select',
                options: SWIM_MODEL_OPTIONS,
                desc: '우측 비교 패널에 표시할 유영 모델입니다.',
            },
            { id: 'speed', label: 'Global Simulation Speed', min: 0.1, max: 2.5, step: 0.1, desc: '전체적인 움직임과 수영의 속도 배율입니다.' },
            { id: 'accelScale', label: 'Accel Force', min: 0.1, max: 4.0, step: 0.1, desc: '추진력의 세기입니다.' },
            { id: 'frictionScale', label: 'Inertia (Friction)', min: 0.95, max: 1.05, step: 0.001, desc: '관성 유지력입니다. 1에 가까울수록 오래 질주합니다.' },
        ],
        dynamics: [
            { id: 'coreSegment', label: 'Pivot Position', min: 0.0, max: 0.5, step: 0.01, desc: '몸통 파동이 시작되는 기점 마디입니다.' },
            { id: 'waveAmplitudeScale', label: 'Wag Amplitude', min: 0.2, max: 4.0, step: 0.1, desc: '꼬리를 흔드는 좌우폭입니다.' },
            { id: 'wavelengthScale', label: 'S-Curve Length', min: 1.0, max: 6.0, step: 0.1, desc: '몸통을 통과하는 파동의 길이(파장)입니다.' },
            { id: 'spineStiffness', label: 'Spine Stiffness', min: 0.1, max: 8.0, step: 0.1, desc: '척추의 뻣뻣함입니다. 높을수록 각 마디가 직선적으로 이어집니다.' },
            { id: 'swimSpeedScale', label: 'Tail Speed', min: 0.5, max: 8.0, step: 0.1, desc: '꼬리치는 기본 속도입니다.' },
            { id: 'eventHeadYawGain', label: 'Event Head Yaw', min: 0.2, max: 2.8, step: 0.05, desc: 'Event FSM의 머리 회전(요) 강도입니다.' },
            { id: 'eventHeadTurnLeadGain', label: 'Event Turn Lead', min: 0.0, max: 2.8, step: 0.05, desc: 'Event FSM에서 턴 시 머리 선행 각도 강도입니다.' },
            { id: 'eventHeadSwayGain', label: 'Event Head Sway', min: 0.2, max: 2.8, step: 0.05, desc: 'Event FSM 머리 좌우 흔들림 강도입니다.' },
            { id: 'eventHeadPivotFollow', label: 'Event Pivot Follow', min: 0.2, max: 2.8, step: 0.05, desc: 'Event FSM에서 머리-어깨 피벗 위치 추종 강도입니다.' },
            { id: 'eventEyeAnchorIndex', label: 'Event Eye Anchor', min: 1, max: 5, step: 1, desc: '눈 기준 마디 위치입니다. 낮출수록 코끝 회전이 더 직접적으로 보입니다.' },
        ],
        hybrid: [
            { id: 'hybridCurvatureGain', label: 'Curvature Gain', min: 0.2, max: 2.4, step: 0.05, desc: 'Kinematic Hybrid에서 턴 곡률 명령의 강도입니다.' },
            { id: 'hybridTurnResponse', label: 'Turn Response', min: 0.2, max: 2.2, step: 0.05, desc: 'Kinematic Hybrid 조향 응답 속도입니다.' },
            { id: 'hybridThrustGain', label: 'Tail Thrust Gain', min: 0.2, max: 2.6, step: 0.05, desc: 'Kinematic Hybrid 꼬리 스트로크 기반 추진력 증폭입니다.' },
            { id: 'hybridRearWaveGain', label: 'Rear Wave Gain', min: 0.2, max: 2.6, step: 0.05, desc: 'Kinematic Hybrid 후방 파동 증폭량입니다.' },
            { id: 'hybridCounterYawGain', label: 'Counter Yaw Gain', min: 0.1, max: 2.6, step: 0.05, desc: 'Kinematic Hybrid 머리/몸통 카운터 요 강도입니다.' },
            { id: 'hybridHeadSwayGain', label: 'Head Sway Gain', min: 0.2, max: 2.6, step: 0.05, desc: 'Kinematic Hybrid 머리 좌우 흔들림 가중치입니다.' },
        ],
        debug: [
            { id: 'debugOverlay', label: 'Debug HUD', type: 'toggle', desc: '선택한 잉어의 실시간 물리/파동 수치를 표시합니다.' },
            { id: 'debugVectors', label: 'Motion Vectors', type: 'toggle', desc: '조향/추진/속도 벡터를 직접 시각화합니다.' },
        ],
    },
    fins: {
        shape: [
            { id: 'pectoralSize', label: 'Main Size', min: 0.7, max: 2.0, step: 0.05, desc: '주 날개(가슴지느러미)의 크기 배율입니다.' },
            { id: 'pectoralAngle', label: 'Main Angle', min: -1.4, max: 1.8, step: 0.05, desc: '주 날개의 기본 펼침 각도입니다. 음수로 두면 접히는 각도를 크게 줄 수 있습니다.' },
            { id: 'pectoralPosShift', label: 'Main Shift F/B', min: -6, max: 4, step: 1, desc: '주 날개의 전후 위치 보정값(마디 수)입니다.' },
            { id: 'pectoralPosSide', label: 'Main Width Offset', min: 0.3, max: 1.0, step: 0.05, desc: '주 날개가 몸통에서 떨어지는 간격 배율입니다.' },
            { id: 'pectoralWidthScale', label: 'Fin Width Scale', min: 0.5, max: 2.0, step: 0.05, desc: '지느러미의 두께(폭) 배율입니다.' },
            { id: 'pectoralTipRoundness', label: 'Tip Roundness', min: 0.1, max: 2.0, step: 0.1, desc: '지느러미 끝부분의 둥근 정도입니다.' },
            { id: 'pectoralLeadingCurvature', label: 'Leading Edge Curve', min: -0.5, max: 0.5, step: 0.05, desc: '앞쪽 날개의 굴곡(볼록/오목) 정도입니다.' },
            { id: 'pectoralTrailingCurvature', label: 'Trailing Edge Curve', min: -0.5, max: 0.5, step: 0.05, desc: '뒤쪽 날개 엽의 부풀기 정도입니다.' },
            { id: 'ventralSize', label: 'Sub Size', min: 0.1, max: 1.4, step: 0.05, desc: '보조 날개(배지느러미)의 크기 배율입니다.' },
            { id: 'ventralAngle', label: 'Sub Angle', min: -1.4, max: 1.8, step: 0.05, desc: '보조 날개의 기본 펼침 각도입니다. 음수 쪽으로도 확장됩니다.' },
            { id: 'ventralPosShift', label: 'Sub Shift F/B', min: -6, max: 4, step: 1, desc: '보조 날개의 전후 위치 보정값(마디 수)입니다.' },
            { id: 'ventralPosSide', label: 'Sub Width Offset', min: 0.4, max: 1.4, step: 0.05, desc: '보조 날개가 몸통에서 떨어지는 간격 배율입니다.' },
            { id: 'tailFinSize', label: 'Tail Size', min: 0.45, max: 2.8, step: 0.05, desc: '꼬리지느러미 전체 길이/면적 배율입니다.' },
            { id: 'tailFinSpread', label: 'Tail Spread', min: 0.12, max: 1.2, step: 0.01, desc: '좌우로 벌어지는 각도(팬 형태)입니다.' },
            { id: 'tailFinNotchDepth', label: 'Tail Notch', min: 0.45, max: 0.95, step: 0.01, desc: '꼬리 중앙 홈 깊이입니다. 낮을수록 깊게 갈라집니다.' },
            { id: 'tailFinBaseWidth', label: 'Tail Base Width', min: 0.35, max: 2.0, step: 0.01, desc: '몸통과 연결되는 꼬리 기저 폭입니다.' },
            { id: 'tailFinRoundness', label: 'Tail Roundness', min: 0.35, max: 2.0, step: 0.01, desc: '꼬리 외곽 곡선의 둥근 정도입니다.' },
            { id: 'tailFinEdgeSharpness', label: 'Tail Edge Sharp', min: 0.4, max: 2.0, step: 0.01, desc: '꼬리 외곽의 날카로움/직선감입니다.' },
            { id: 'tailFinRootOffset', label: 'Tail Root Offset', min: 0.0, max: 0.55, step: 0.01, desc: '꼬리 루트가 몸통 뒤로 붙는 거리입니다.' },
            { id: 'tailFinVeinAlpha', label: 'Tail Vein Alpha', min: 0.0, max: 2.0, step: 0.01, desc: '꼬리지느러미 중앙/측면 맥 시인성입니다.' },
        ],
        motion: [
            { id: 'pectoralFlutterAmp', label: 'Flutter Amp', min: 0.05, max: 0.8, step: 0.01, desc: '주 날개의 파닥임 강도입니다.' },
            { id: 'pectoralFlutterSpeed', label: 'Flutter Spd', min: 0.1, max: 2.0, step: 0.05, desc: '주 날개의 파닥임 속도입니다.' },
            { id: 'pectoralTurnRateBoost', label: 'Drive Rate Boost', min: 0.0, max: 4.0, step: 0.05, desc: '회전 시 진행 방향 측 지느러미의 주파수 증폭량입니다.' },
            { id: 'pectoralOpposingRateMin', label: 'Opposing Rate Min', min: 0.05, max: 1.0, step: 0.01, desc: '회전 시 반대편 지느러미의 최소 주파수 비율입니다.' },
            { id: 'pectoralOpposingFold', label: 'Opposing Fold', min: 0.0, max: 1.4, step: 0.01, desc: '반대편 지느러미를 접는 강도입니다.' },
            { id: 'tailFinTurnSpreadGain', label: 'Tail Turn Spread', min: 0.0, max: 2.0, step: 0.01, desc: '회전 시 꼬리 벌어짐 추가 증폭량입니다.' },
        ],
    },
    env: {
        timeWeather: [
            {
                id: 'envCloudiness',
                label: '흐린 정도(원인)',
                min: 0,
                max: 1,
                step: 0.01,
                desc: '장면 밝기 원인값입니다. 높을수록 하늘이 흐려지고 전반 조도가 낮아집니다.',
            },
            {
                id: 'envRainIntensity',
                label: '강우 강도(원인)',
                min: 0,
                max: 1,
                step: 0.01,
                desc: 'Pond Lab의 고정 날씨 강우 원인값입니다. Main 현실 장면에서는 절차적 날씨가 이 값을 대신 소유합니다.',
            },
        ],
        waterDynamics: [
            {
                id: 'envWaterClarity',
                label: '수질 투명도(원인)',
                min: 0,
                max: 1,
                step: 0.01,
                desc: '상위 원인값입니다. 높을수록 수체 투과율과 바닥 시인성이 올라가고 탁도가 낮아집니다.',
            },
        ],
        waterReflection: [
            {
                id: 'waterReflectionAlgorithm',
                label: '수면 반사 알고리즘',
                type: 'select',
                options: ZEN_WATER_REFLECTION_ALGORITHM_OPTIONS,
                default: DEFAULT_ZEN_WATER_REFLECTION_ALGORITHM,
                desc: '수면 정본 필드를 기본으로 사용하고, 기존 윤슬 알고리즘은 실험실에서 명시적으로 비교합니다.',
            },
            {
                id: 'compareWaterReflectionAlgorithms',
                label: '반사 알고리즘 A/B',
                type: 'toggle',
                desc: 'Well Lab에서 아래 A/B 반사 알고리즘을 좌우 동시 비교합니다.',
            },
            {
                id: 'compareWaterReflectionAlgorithmA',
                label: '반사 알고리즘 A',
                type: 'select',
                options: ZEN_WATER_REFLECTION_ALGORITHM_OPTIONS,
                default: ZEN_WATER_REFLECTION_ALGORITHMS.LOOPED_CAUSTIC,
                desc: '좌측 비교 패널에 표시할 수면 반사 알고리즘입니다.',
            },
            {
                id: 'compareWaterReflectionAlgorithmB',
                label: '반사 알고리즘 B',
                type: 'select',
                options: ZEN_WATER_REFLECTION_ALGORITHM_OPTIONS,
                default: ZEN_WATER_REFLECTION_ALGORITHMS.LIMITED_WAVES,
                desc: '우측 비교 패널에 표시할 수면 반사 알고리즘입니다.',
            },
            {
                id: 'waterReflectionStability',
                label: '반사 안정화(전체)',
                min: 0,
                max: 1,
                step: 0.01,
                default: 0.72,
                desc: '분리 안정화의 기준값입니다. 기존 GGX 기본값은 런타임에서 0으로 유지됩니다.',
            },
            {
                id: 'waterReflectionSpatialStability',
                label: '반사 공간 안정화',
                min: 0,
                max: 1,
                step: 0.01,
                default: 0.58,
                desc: '로브 크기와 공간 좌표 흔들림을 안정화합니다. 높을수록 덩어리가 커지고 정돈됩니다.',
            },
            {
                id: 'waterReflectionDetailStability',
                label: '반사 디테일 안정화',
                min: 0,
                max: 1,
                step: 0.01,
                default: 0.44,
                desc: '고주파 분할과 미세 글린트 진폭을 안정화합니다. 낮을수록 빽빽한 작은 하이라이트가 살아납니다.',
            },
            {
                id: 'waterReflectionTemporalStability',
                label: '반사 시간 안정화',
                min: 0,
                max: 1,
                step: 0.01,
                default: 0.46,
                desc: '깜빡임과 시간 변화량을 안정화합니다. 낮을수록 하이라이트가 더 자주 생기고 사라집니다.',
            },
            {
                id: 'waterReflectionSoftKnee',
                label: '반사 소프트 니',
                min: 0,
                max: 1,
                step: 0.01,
                default: 0,
                desc: '강한 하이라이트가 갑자기 튀지 않도록 부드럽게 압축하는 톤 커브입니다.',
            },
        ],
        ecosystem: [
            { id: 'padDensity', label: '수련잎 밀도', min: 0, max: 40, step: 1, desc: '연못에 떠다니는 수련잎의 개수입니다.' },
            { id: 'flowerChance', label: '수련꽃 확률', min: 0.0, max: 1.0, step: 0.05, desc: '수련잎에서 수련꽃이 피어날 확률입니다.' },
            { id: 'particleDensity', label: '수중 부유물', min: 0, max: 100, step: 5, desc: '수중에 떠다니는 부유물의 양입니다.' },
            { id: 'pollenDensity', label: '윤슬/꽃가루', min: 0, max: 30, step: 1, desc: '수면 위에서 반짝이는 윤슬/꽃가루의 양입니다.' },
            { id: 'rockDensity', label: '수중 돌 밀도', min: 0.0, max: 2.0, step: 0.01, desc: '바닥 돌 오브젝트 생성 밀도입니다.' },
            { id: 'rockClusterBias', label: '돌 군집 성향', min: 0.0, max: 1.0, step: 0.01, desc: '낮을수록 분산, 높을수록 군집 배치가 강해집니다.' },
            { id: 'rockSizeVariance', label: '돌 크기 편차', min: 0.4, max: 1.9, step: 0.01, desc: '개별 돌의 크기 스케일 편차를 조절합니다.' },
            { id: 'rockToneVariance', label: '돌 색상 편차', min: 0.0, max: 2.0, step: 0.01, desc: '돌의 온도감/명도 편차를 조절해 단조로움을 줄입니다.' },
        ],
        waterTone: [
            { id: 'pondPaletteId', label: '연못 팔레트', type: 'select', options: WATER_PALETTE_OPTIONS, desc: '연못의 기본 색상 팔레트를 선택합니다. 라무네 소다 톤도 포함됩니다.' },
            { id: 'pondClarityBlend', label: '상태 반영 비율', min: 0.0, max: 1.0, step: 0.01, desc: '점수/상태 변화가 수색에 반영되는 비율입니다. 낮추면 고정 톤을 유지합니다.' },
            { id: 'temporalNightTintStrength', label: '야간 색감 강도', min: 0.8, max: 1.2, step: 0.01, desc: '야간 시간대 색감 강도만 조절합니다. 장면 밝기(lightAmount/cloudiness)에는 영향을 주지 않습니다.' },
        ],
    },
};

/* ─── Section header helper ───────────────────────────────── */

const createSectionHeader = (id, label) => ({
    id: `section_${id}`,
    type: 'section',
    label,
});

/* ─── Composed param lists (for groups) ───────────────────── */

const CONTROL_PANEL_TARGETS = Object.freeze([
    { id: 'world', modes: ['authoring', 'advanced', 'lab'], defaultMode: 'authoring' },
    { id: 'koi', modes: ['authoring', 'advanced', 'lab'], defaultMode: 'authoring' },
]);

const CONTROL_PANEL_MODES = Object.freeze([
    { id: 'authoring', badge: 'cause' },
    { id: 'advanced', badge: 'advanced' },
    { id: 'lab', badge: 'operational' },
]);

const withPath = (params, pathPrefix = '', meta = {}) => params.map((param) => {
    if (param?.type === 'section') return param;
    const path = param.path || (pathPrefix ? `${pathPrefix}.${param.id}` : param.id);
    return {
        ...param,
        path,
        ...meta,
    };
});

const withPhysicsPath = (params, meta = {}) => params.map((param) => {
    if (param?.type === 'section') return param;
    const path = param.path || (param.id === 'speed' ? 'speed' : `physics.${param.id}`);
    return {
        ...param,
        path,
        scope: path.startsWith('physics.') ? 'physics' : 'root',
        ...meta,
    };
});

const pickById = (params, ids) => {
    const idSet = new Set(ids);
    return params.filter((param) => idSet.has(param.id));
};

const excludeById = (params, ids) => {
    const idSet = new Set(ids);
    return params.filter((param) => !idSet.has(param.id));
};

const KOI_FEEL_AUTHORING_PARAMS = withPath([
    {
        id: 'koiMotionGrace',
        path: 'koiMotionProfile.grace',
        label: 'Grace',
        min: 0,
        max: 1,
        step: 0.01,
        default: 0.62,
        projection: 'koiMotionProfile',
        desc: '전체 유영을 더 부드럽고 관성 있게 보이도록 투사합니다.',
    },
    {
        id: 'koiMotionAgility',
        path: 'koiMotionProfile.agility',
        label: 'Agility',
        min: 0,
        max: 1,
        step: 0.01,
        default: 0.48,
        projection: 'koiMotionProfile',
        desc: '방향 전환과 추진 반응성을 높입니다.',
    },
    {
        id: 'koiMotionTailDrive',
        path: 'koiMotionProfile.tailDrive',
        label: 'Tail Drive',
        min: 0,
        max: 1,
        step: 0.01,
        default: 0.58,
        projection: 'koiMotionProfile',
        desc: '꼬리 파동의 힘과 stroke 주파수를 함께 조정합니다.',
    },
    {
        id: 'koiMotionTurnSharpness',
        path: 'koiMotionProfile.turnSharpness',
        label: 'Turn Sharpness',
        min: 0,
        max: 1,
        step: 0.01,
        default: 0.46,
        projection: 'koiMotionProfile',
        desc: '머리 선행, 피벗 추종, 턴 권위를 함께 조정합니다.',
    },
], '', { target: 'koi', tier: 'authoring', semantic: 'koi_motion_profile' });

const ENV_MASTER_PARAMS = withPath([
    ...BASE_PARAMS.env.timeWeather,
    ...BASE_PARAMS.env.waterDynamics,
], '', { target: 'world', tier: 'authoring' });

const ENV_ECOSYSTEM_PARAMS = withPath(BASE_PARAMS.env.ecosystem, '', { target: 'world', tier: 'authoring' });
const ENV_WATER_TONE_PARAMS = withPath(BASE_PARAMS.env.waterTone, '', { target: 'world', tier: 'authoring' });
const ENV_WATER_REFLECTION_PARAMS = withPath(
    excludeById(BASE_PARAMS.env.waterReflection, [
        'compareWaterReflectionAlgorithms',
        'compareWaterReflectionAlgorithmA',
        'compareWaterReflectionAlgorithmB',
    ]),
    '',
    { target: 'world', tier: 'advanced' },
);
const ENV_WATER_REFLECTION_COMPARE_PARAMS = withPath(
    pickById(BASE_PARAMS.env.waterReflection, [
        'compareWaterReflectionAlgorithms',
        'compareWaterReflectionAlgorithmA',
        'compareWaterReflectionAlgorithmB',
    ]),
    '',
    { target: 'world', tier: 'lab' },
);

const KOI_MODEL_PARAMS = withPhysicsPath(
    pickById(BASE_PARAMS.physics.locomotion, ['swimModel']),
    { target: 'koi', tier: 'authoring', semantic: 'koi_swim_model' },
);
const KOI_COMPARE_PARAMS = withPhysicsPath(
    pickById(BASE_PARAMS.physics.locomotion, ['compareSwimModels', 'compareModelA', 'compareModelB']),
    { target: 'koi', tier: 'lab', semantic: 'koi_swim_compare' },
);
const KOI_FORCE_PARAMS = withPhysicsPath(
    pickById(BASE_PARAMS.physics.locomotion, ['speed', 'accelScale', 'frictionScale']),
    { target: 'koi', tier: 'advanced', semantic: 'koi_locomotion_force' },
);
const KOI_RIG_PARAMS = [
    createSectionHeader('koi_rig_spine', 'Spine Rig'),
    ...withPath(pickById(BASE_PARAMS.body.structure, ['historyLength']), '', {
        target: 'koi',
        tier: 'advanced',
        semantic: 'spine_sample_resolution',
    }),
    ...withPhysicsPath(pickById(BASE_PARAMS.physics.dynamics, ['eventEyeAnchorIndex']), {
        target: 'koi',
        tier: 'advanced',
        semantic: 'koi_eye_render_anchor',
        appliesTo: EVENT_FSM_MODELS,
    }),
    createSectionHeader('koi_rig_segmented_solver', 'Segmented Solver'),
    ...withPhysicsPath(pickById(BASE_PARAMS.physics.dynamics, ['coreSegment']), {
        target: 'koi',
        tier: 'advanced',
        semantic: 'segmented_spine_pivot',
        appliesTo: SEGMENTED_SPINE_MODELS,
    }),
];
const KOI_MOTION_ADVANCED_PARAMS = [
    ...KOI_FORCE_PARAMS,
    ...withPhysicsPath(pickById(BASE_PARAMS.physics.dynamics, [
        'waveAmplitudeScale',
        'wavelengthScale',
        'spineStiffness',
        'swimSpeedScale',
    ]), {
        target: 'koi', tier: 'advanced', semantic: 'koi_body_wave', appliesTo: KOI_SWIM_MODELS,
    }),
    ...withPhysicsPath(pickById(BASE_PARAMS.physics.dynamics, [
        'eventHeadYawGain',
        'eventHeadTurnLeadGain',
        'eventHeadSwayGain',
        'eventHeadPivotFollow',
    ]), {
        target: 'koi',
        tier: 'advanced',
        semantic: 'koi_body_wave',
        appliesTo: EVENT_FSM_MODELS,
    }),
];
const KOI_HYBRID_PARAMS = withPhysicsPath(BASE_PARAMS.physics.hybrid, {
    target: 'koi',
    tier: 'advanced',
    semantic: 'kinematic_hybrid_solver',
    appliesTo: ['kinematic_hybrid'],
});
const KOI_DIAGNOSTIC_PARAMS = withPhysicsPath(BASE_PARAMS.physics.debug, {
    target: 'koi',
    tier: 'lab',
    semantic: 'koi_debug',
});
const KOI_LOOK_AUTHORING_PARAMS = [
    createSectionHeader('koi_look_body', 'Body Read'),
    ...withPath(pickById(BASE_PARAMS.body.structure, ['baseSize']), '', { target: 'koi', tier: 'authoring' }),
    ...withPath(pickById(BASE_PARAMS.body.head, ['headWidth']), '', { target: 'koi', tier: 'authoring' }),
    ...withPath(pickById(BASE_PARAMS.body.torso, ['shoulderMax', 'midWidth']), '', { target: 'koi', tier: 'authoring' }),
    createSectionHeader('koi_look_tail', 'Tail Read'),
    ...withPath(pickById(BASE_PARAMS.fins.shape, ['tailFinSize', 'tailFinSpread']), '', { target: 'koi', tier: 'authoring' }),
];
const KOI_SHAPE_ADVANCED_PARAMS = [
    createSectionHeader('body_structure', '골격'),
    ...withPath(pickById(BASE_PARAMS.body.structure, ['baseSize']), '', { target: 'koi', tier: 'advanced' }),
    createSectionHeader('body_head', '머리'),
    ...withPath(BASE_PARAMS.body.head, '', { target: 'koi', tier: 'advanced' }),
    createSectionHeader('body_torso', '몸통'),
    ...withPath(BASE_PARAMS.body.torso, '', { target: 'koi', tier: 'advanced' }),
    createSectionHeader('body_tail', '꼬리'),
    ...withPath(BASE_PARAMS.body.tail, '', { target: 'koi', tier: 'advanced' }),
];
const KOI_APPENDAGE_PARAMS = [
    createSectionHeader('fins_shape', '지느러미 형상'),
    ...withPath(BASE_PARAMS.fins.shape, '', { target: 'koi', tier: 'advanced' }),
    createSectionHeader('fins_motion', '지느러미 운동'),
    ...withPath(BASE_PARAMS.fins.motion, '', { target: 'koi', tier: 'advanced' }),
];

const KOI_MOTION_PARAMS = [
    ...KOI_MODEL_PARAMS,
    ...KOI_COMPARE_PARAMS,
    ...KOI_RIG_PARAMS,
    ...KOI_MOTION_ADVANCED_PARAMS,
    ...KOI_HYBRID_PARAMS,
    ...KOI_DIAGNOSTIC_PARAMS,
];

/* ─── Control Groups ──────────────────────────────────────── */
// Bottom-up control domains. Higher-level authoring recipes should be layered
// above these primitives instead of replacing or duplicating them.
// badge: 'cause' | 'operational' | 'creature' | 'advanced'

const CONTROL_GROUPS = [
    {
        id: 'environment',
        icon: '◐',
        label: '환경',
        badge: 'cause',
        target: 'world',
        modes: ['authoring'],
        defaultOpen: true,
        flowHint: {
            cause: '전역 시간과 흐림/수질 원인을 함께 해석',
            channel: 'zenCauseModel + zenEnvCore',
            result: '장면 밝기 + 물 매질 상태',
        },
        params: ENV_MASTER_PARAMS,
    },
    {
        id: 'ecosystem',
        icon: '✿',
        label: '생태계',
        badge: 'operational',
        target: 'world',
        modes: ['authoring'],
        defaultOpen: false,
        flowHint: {
            cause: '수련·낙화·부유물의 직접 입력',
            channel: 'biotic/effect consumers',
            result: '수련잎·낙화·부유물 배치',
        },
        params: ENV_ECOSYSTEM_PARAMS,
    },
    {
        id: 'waterTone',
        icon: '◒',
        label: '수색·팔레트',
        badge: 'operational',
        target: 'world',
        modes: ['authoring'],
        defaultOpen: false,
        flowHint: {
            cause: '팔레트와 상태 반영 비율의 직접 입력',
            channel: 'water medium + temporal tint consumers',
            result: '팔레트·상태 반영 비율',
        },
        params: ENV_WATER_TONE_PARAMS,
    },
    {
        id: 'waterReflection',
        icon: '✧',
        label: '수면 반사',
        badge: 'operational',
        target: 'world',
        modes: ['advanced'],
        defaultOpen: false,
        flowHint: {
            role: 'result',
            channel: 'surface/static lighting uniforms',
            result: '윤슬 안정화·반사 알고리즘',
        },
        params: ENV_WATER_REFLECTION_PARAMS,
    },
    {
        id: 'channels',
        icon: '▤',
        label: '채널 모니터',
        badge: 'operational',
        target: 'world',
        modes: ['lab'],
        defaultOpen: true,
        flowHint: {
            role: 'monitor',
            channel: 'resolved frame channels',
            result: '원인 변경 시 하위값 실시간 확인',
        },
        params: [],
    },
    {
        id: 'waterReflectionLab',
        icon: '⟷',
        label: '수면 반사 비교',
        badge: 'operational',
        target: 'world',
        modes: ['lab'],
        defaultOpen: false,
        flowHint: {
            role: 'lab',
            channel: 'surface result branch',
            result: '수면 반사 알고리즘 A/B 비교',
        },
        params: ENV_WATER_REFLECTION_COMPARE_PARAMS,
    },
    {
        id: 'koiModel',
        icon: '⌁',
        label: '잉어 모델',
        badge: 'creature',
        target: 'koi',
        modes: ['authoring'],
        defaultOpen: true,
        flowHint: {
            role: 'model',
            result: '선택한 유영 모델이 아래 컨트롤의 적용 범위를 결정',
        },
        params: KOI_MODEL_PARAMS,
    },
    {
        id: 'koiFeel',
        icon: '≈',
        label: '잉어 느낌',
        badge: 'creature',
        target: 'koi',
        modes: ['authoring'],
        defaultOpen: false,
        flowHint: {
            cause: '고수준 유영 감각',
            channel: 'koiMotionProfile → model-aware projection',
            result: '저수준 물리/파동값을 함께 조정',
        },
        params: KOI_FEEL_AUTHORING_PARAMS,
    },
    {
        id: 'koiLook',
        icon: '◌',
        label: '잉어 외형',
        badge: 'creature',
        target: 'koi',
        modes: ['authoring'],
        defaultOpen: false,
        flowHint: {
            role: 'creature',
            result: '체형과 꼬리 인상의 빠른 조정',
        },
        params: KOI_LOOK_AUTHORING_PARAMS,
    },
    {
        id: 'koiBody',
        icon: '◎',
        label: '잉어 몸체',
        badge: 'creature',
        target: 'koi',
        modes: ['advanced'],
        defaultOpen: false,
        flowHint: {
            role: 'creature',
            result: '실루엣/머리/몸통/꼬리 형상',
        },
        params: KOI_SHAPE_ADVANCED_PARAMS,
    },
    {
        id: 'koiRig',
        icon: '⌇',
        label: '잉어 리그',
        badge: 'advanced',
        target: 'koi',
        modes: ['advanced'],
        defaultOpen: false,
        flowHint: {
            role: 'rig',
            result: 'spine 샘플·렌더 앵커·segmented 피벗',
        },
        params: KOI_RIG_PARAMS,
    },
    {
        id: 'koiSwim',
        icon: '∿',
        label: '잉어 유영',
        badge: 'advanced',
        target: 'koi',
        modes: ['advanced'],
        defaultOpen: false,
        flowHint: {
            role: 'model',
            result: '추진·관성·몸체 파동의 저수준 조정',
        },
        params: KOI_MOTION_ADVANCED_PARAMS,
    },
    {
        id: 'koiAppendages',
        icon: '⋔',
        label: '잉어 지느러미',
        badge: 'advanced',
        target: 'koi',
        modes: ['advanced'],
        defaultOpen: false,
        flowHint: {
            role: 'appendage',
            result: '지느러미/꼬리 형상과 보조 운동',
        },
        params: KOI_APPENDAGE_PARAMS,
    },
    {
        id: 'koiHybrid',
        icon: '◇',
        label: '하이브리드 코어',
        badge: 'advanced',
        target: 'koi',
        modes: ['advanced'],
        appliesTo: ['kinematic_hybrid'],
        defaultOpen: false,
        flowHint: {
            role: 'model-specific',
            result: 'Kinematic Hybrid 전용 solver gain',
        },
        params: KOI_HYBRID_PARAMS,
    },
    {
        id: 'koiCompare',
        icon: '⟷',
        label: '잉어 비교',
        badge: 'operational',
        target: 'koi',
        modes: ['lab'],
        defaultOpen: true,
        flowHint: {
            role: 'lab',
            result: '유영 모델 A/B 비교',
        },
        params: KOI_COMPARE_PARAMS,
    },
    {
        id: 'koiDiagnostics',
        icon: '▥',
        label: '잉어 진단',
        badge: 'operational',
        target: 'koi',
        modes: ['lab'],
        defaultOpen: false,
        flowHint: {
            role: 'diagnostics',
            result: 'HUD·벡터·모델 상태 확인',
        },
        params: KOI_DIAGNOSTIC_PARAMS,
    },
];

/* ─── Badge metadata ──────────────────────────────────────── */

const BADGE_META = {
    cause: { label: '원인', color: 'blue' },
    operational: { label: '운영', color: 'green' },
    creature: { label: '생물', color: 'amber' },
    advanced: { label: '고급', color: 'slate' },
};

/* ─── Flat param indexes (unchanged API) ──────────────────── */

const KOI_MOTION_PARAM_ID_SET = new Set(KOI_MOTION_PARAMS.map((param) => param.id));

const FLAT_ALL_PARAMS = CONTROL_GROUPS
    .flatMap((group) => group.params || [])
    .filter((param) => param?.type !== 'section')
    .filter((param, index, params) => params.findIndex((entry) => entry.id === param.id) === index);

const FLAT_PHYSICS_PARAMS = FLAT_ALL_PARAMS.filter(
    (param) => param?.path?.startsWith('physics.') || KOI_MOTION_PARAM_ID_SET.has(param.id) || param?.scope === 'physics',
);

/* ─── Exports ─────────────────────────────────────────────── */

export {
    CONTROL_PANEL_TARGETS,
    CONTROL_PANEL_MODES,
    CONTROL_GROUPS,
    BADGE_META,
    FLAT_PHYSICS_PARAMS,
    FLAT_ALL_PARAMS,
};
