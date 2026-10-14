import {
  DEFAULT_ENV,
  DEFAULT_RUNTIME_TOGGLES,
  DEFAULT_WATER_PALETTE,
  ZEN_QUALITY_MODE_FULL,
} from './zenPondWorkerPolicy.js';
import { buildRuntimeEnvAuthoritySnapshot } from './zenPondWorkerEnvironment.js';
import { createEnvironmentRuntimeState } from './zenPondWorkerEnvironmentPresentation.js';
import { createZenPondRuntimeHealthState } from './zenPondWorkerRuntimeHealth.js';
import {
  createZenSurfaceDisturbanceTelemetryState,
} from '../../../runtime/surface/zenSurfaceDisturbance.js';
import {
  DEFAULT_ZEN_POND_VISUAL_PROFILE,
} from '../../../contracts/zenPondVisualProfile.js';

const createRef = (current) => ({ current });
const createWorldSyncCache = () => ({
  bathymetryFieldSignature: '',
  staticSceneSignature: '',
  ambientPopulationSignature: '',
  fishRosterSignature: '',
  hasBathymetryFieldSync: false,
  hasStaticSceneSync: false,
  hasAmbientPopulationSync: false,
  hasFishRosterSync: false,
});

export const createBackgroundHost = () => {
  let child = null;
  return {
    get firstChild() {
      return child;
    },
    appendChild(node) {
      child = node || null;
      return node;
    },
    removeChild(node) {
      if (child === node || !node) {
        child = null;
      }
      return node;
    },
  };
};

export const buildDefaultRuntimeParams = () => ({
  qualityMode: ZEN_QUALITY_MODE_FULL,
  targetFps: 60,
  waterEffectsEnabled: DEFAULT_RUNTIME_TOGGLES.waterEffectsEnabled === true,
  effectIntensityScale: 1,
  telemetry: {
    enabled: false,
    sampleIntervalMs: 2000,
  },
  envAuthority: buildRuntimeEnvAuthoritySnapshot(),
  env: { ...DEFAULT_ENV },
  waterPalette: { ...DEFAULT_WATER_PALETTE },
  toggles: { ...DEFAULT_RUNTIME_TOGGLES },
  optimization: null,
  tuning: {},
  visualProfile: DEFAULT_ZEN_POND_VISUAL_PROFILE,
});

export const buildDefaultRefs = () => ({
  fishRef: createRef([]),
  activityProfileByDomainRef: createRef(new Map()),
  dummyFishRef: createRef([]),
  surfaceDisturbancesRef: createRef([]),
  surfaceDisturbanceTelemetryRef: createRef(
    createZenSurfaceDisturbanceTelemetryState(),
  ),
  surfaceDisturbanceEventsRef: createRef([]),
  interactionStimuliRef: createRef([]),
  frameStateRef: createRef(null),
  bathymetryFieldRef: createRef(null),
  lilyPadsRef: createRef([]),
  waterLilyRef: createRef([]),
  zenIrisClustersRef: createRef([]),
  particlesRef: createRef([]),
  petalsRef: createRef([]),
  glimmersRef: createRef([]),
  rocksRef: createRef([]),
  mousePos: createRef({ x: -1000, y: -1000 }),
  commonEnvContextRef: createRef(null),
  sessionSaltRef: createRef(0),
  tuningRef: createRef({}),
  hoveredDomainRef: createRef(null),
  hoveredFishUidRef: createRef(null),
  lockedTargetRef: createRef(null),
  selectedFishUidRef: createRef(null),
  invitationRegistrationEntityIdRef: createRef(null),
  envStateRef: createRef({ ...DEFAULT_ENV }),
  waterPaletteRef: createRef({ ...DEFAULT_WATER_PALETTE }),
  rendererDebugTogglesRef: createRef({ ...DEFAULT_RUNTIME_TOGGLES }),
  animationEnabledRef: createRef(true),
  viewportSizeRef: createRef({ width: 0, height: 0 }),
});

export const createRuntimeState = () => ({
  started: false,
  active: true,
  canvas: null,
  width: 0,
  height: 0,
  viewportWidth: 0,
  viewportHeight: 0,
  dpr: 1,
  sceneGenerationKey: 'worker_scene',
  backgroundHost: null,
  runtimeParams: buildDefaultRuntimeParams(),
  qualityMode: ZEN_QUALITY_MODE_FULL,
  qualityProfile: null,
  qualitySignature: '',
  visualProfileSignature: '',
  runtimeStopLoop: null,
  pendingViewportReflow: false,
  pondComposition: null,
  sceneLayout: null,
  scene: null,
  refs: buildDefaultRefs(),
  environmentRuntime: createEnvironmentRuntimeState(),
  fishRosterPayload: [],
  requiredFirstFrameFishCount: 0,
  firstFrameAckDeferredCount: 0,
  firstFrameAckDeferredReason: null,
  fishAppearanceByDomain: new Map(),
  depthTextureCache: { key: '', canvas: null },
  worldSyncCache: createWorldSyncCache(),
  startedAtMs: 0,
  lastFrameAtMs: 0,
  presentationSceneCommitRequest: null,
  lastPresentationSceneCommitAck: null,
  lastSceneFrameMetrics: null,
  lastSceneFrameSpike: null,
  performanceSample: null,
  metrics: {
    viewportReflowCount: 0,
    sampleFrames: 0,
    totalDtMs: 0,
    maxDtMs: 0,
    over24: 0,
    over32: 0,
    over50: 0,
    over100: 0,
    sceneSessionSyncCount: 0,
    runtimeParamSyncCount: 0,
    fishRosterSyncCount: 0,
    ambientPopulationSyncCount: 0,
    staticSceneSyncCount: 0,
  },
  runtimeHealth: createZenPondRuntimeHealthState(),
  firstFrameAckEmitted: false,
  firstFrameAtMs: 0,
  firstRenderTickRecorded: false,
  firstFrameRuntimeLoopMounted: false,
  firstFrameRuntimeLoopFrameCount: 0,
  firstFrameLastRenderSource: '',
  lastInputClickPulseToken: 0,
  pendingInputClickLockDomain: null,
  petalLandingHistory: new Map(),
});

export {
  createWorldSyncCache,
};
