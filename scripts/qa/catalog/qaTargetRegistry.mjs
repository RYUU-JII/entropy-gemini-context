import { DASHBOARD_CAPTURE_VIEWPORT_NAMES, DEFAULT_DASHBOARD_CAPTURE_VIEWPORT } from '../contracts/dashboardCaptureViewportContract.mjs';
import {
  listVisualSceneManifests,
} from '../../../src/apps/visual-harness/sceneCatalog.js';
import {
  ZEN_MAIN_CAPTURE_POND_EFFECT_PROFILE_VALUES,
  ZEN_MAIN_CAPTURE_BONSAI_STATES,
} from '../../../src/apps/dashboard/qa/zenMainCaptureProfileContract.js';
import {
  defineQaTarget,
  QA_LANES,
  QA_MODES,
} from '../contracts/qaTargetContract.mjs';
import {
  QA_HUMAN_SETUP_DEFAULT_SITE_ID,
  QA_HUMAN_SETUP_SITE_IDS,
} from './qaHumanSetupCatalog.mjs';

const OWNED_BROWSER_REQUIREMENTS = Object.freeze({
  authentication: 'none',
  extensionRuntime: 'required',
  rendering: 'headless_ok',
  webgl: 'optional',
  audio: 'muted',
  defaultPresentation: 'hidden',
  hiddenAllowed: true,
  documentVisibility: 'visible_required',
  targetActivation: 'active',
  osFocus: 'never',
});

const ATTACHED_BROWSER_REQUIREMENTS = Object.freeze({
  authentication: 'persistent',
  extensionRuntime: 'required',
  rendering: 'headed_required',
  webgl: 'optional',
  audio: 'muted',
  defaultPresentation: 'background',
  hiddenAllowed: false,
  documentVisibility: 'visible_required',
  targetActivation: 'active',
  osFocus: 'never',
});

const HUMAN_SETUP_BROWSER_REQUIREMENTS = Object.freeze({
  ...ATTACHED_BROWSER_REQUIREMENTS,
  defaultPresentation: 'foreground',
});

const HUMAN_SETUP_OPERATOR_HANDOFF_POLICY = Object.freeze({
  focus: 'operator_request_once',
  lifetime: 'until_explicit_cancel',
  cleanup: 'exact_owned_targets',
});

const HUMAN_SETUP_COMMON_PARAMETERS = Object.freeze({
  site: Object.freeze({
    type: 'enum',
    cliName: 'site',
    values: QA_HUMAN_SETUP_SITE_IDS,
    default: QA_HUMAN_SETUP_DEFAULT_SITE_ID,
  }),
  url: Object.freeze({
    type: 'string',
    cliName: 'url',
  }),
  rebuild: Object.freeze({
    type: 'boolean',
    cliName: 'rebuild',
    default: false,
  }),
});

const ATTACHED_BACKGROUND_OBSERVATION_REQUIREMENTS = Object.freeze({
  authentication: 'persistent',
  extensionRuntime: 'none',
  rendering: 'headed_required',
  webgl: 'optional',
  audio: 'muted',
  defaultPresentation: 'background',
  hiddenAllowed: false,
  documentVisibility: 'background_allowed',
  targetActivation: 'background',
  osFocus: 'never',
});

const OWNED_BACKGROUND_OBSERVATION_REQUIREMENTS = Object.freeze({
  authentication: 'none',
  extensionRuntime: 'none',
  rendering: 'headless_ok',
  webgl: 'optional',
  audio: 'muted',
  defaultPresentation: 'hidden',
  hiddenAllowed: true,
  documentVisibility: 'visible_required',
  targetActivation: 'active',
  osFocus: 'never',
});

const FEED_TARGETS = Object.freeze([
  ['feed/tiktok', 'TikTok Feed Horizon', 'tiktok', 'paged'],
  ['feed/youtube-shorts', 'YouTube Shorts Feed Horizon', 'youtube', 'paged'],
  ['feed/instagram-reels', 'Instagram Reels Feed Horizon', 'instagram', 'paged'],
  ['feed/x-home', 'X Home Feed Horizon', 'x', 'continuous'],
  ['feed/instagram-home', 'Instagram Home Feed Horizon', 'instagram-home', 'continuous'],
  ['feed/facebook-home', 'Facebook Home Feed Horizon', 'facebook', 'continuous'],
  ['feed/youtube-home', 'YouTube Home Feed Horizon', 'youtube-home', 'continuous'],
].map(([id, title, siteId, surfaceMode]) => defineQaTarget({
  id,
  title,
  family: 'feed',
  lane: QA_LANES.REAL_SITE,
  protocolId: 'feed_horizon',
  supportedModes: [QA_MODES.HUMAN, QA_MODES.AGENT],
  environmentId: 'authenticated',
  browserRequirements: ATTACHED_BROWSER_REQUIREMENTS,
  browserObservation: 'document',
  artifactId: 'dev_extension',
  resourceClaims: ['runtime:feed-horizon'],
  parameters: {
    ...(surfaceMode === 'paged' ? { requireVideo: {
      type: 'boolean', cliName: 'require-video', default: false,
    } } : {}),
    captureScreenshots: {
      type: 'boolean',
      cliName: 'capture-screenshots',
      default: false,
    },
    holdMs: {
      type: 'integer',
      cliName: 'hold-ms',
      minimum: 0,
      maximum: 30_000,
      default: 10_000,
    },
    dwellMs: {
      type: 'integer',
      cliName: 'dwell-ms',
      minimum: 900,
      maximum: 7_000,
      default: 1_350,
    },
    rebuild: {
      type: 'boolean',
      cliName: 'rebuild',
      default: false,
    },
    allowInitialWindowFocusOnce: {
      type: 'boolean',
      cliName: 'allow-initial-window-focus-once',
      default: false,
    },
  },
  protocolOptions: {
    siteId,
    surfaceMode,
  },
})));

// Same real presentation/outcome owners, with an explicitly manual admission.
// This target does not certify elapsed protected-site usage or natural timing.
const FEED_GESTURE_TARGETS = Object.freeze([
  defineQaTarget({
    id: 'feed/gesture/instagram-reels',
    title: 'Instagram Reels manual Gesture Gate and backward navigation',
    family: 'feed_gesture',
    lane: QA_LANES.REAL_SITE,
    protocolId: 'feed_horizon',
    supportedModes: [QA_MODES.AGENT],
    environmentId: 'authenticated',
    browserRequirements: ATTACHED_BROWSER_REQUIREMENTS,
    browserObservation: 'document',
    artifactId: 'dev_extension',
    resourceClaims: ['runtime:feed-horizon'],
    parameters: {
      requireVideo: { type: 'boolean', cliName: 'require-video', default: false },
      captureScreenshots: { type: 'boolean', cliName: 'capture-screenshots', default: false },
      holdMs: { type: 'integer', cliName: 'hold-ms', minimum: 0, maximum: 30_000, default: 10_000 },
      dwellMs: { type: 'integer', cliName: 'dwell-ms', minimum: 900, maximum: 7_000, default: 1_350 },
      rebuild: { type: 'boolean', cliName: 'rebuild', default: false },
    },
    protocolOptions: { siteId: 'instagram', surfaceMode: 'paged', gateMode: 'manual_handoff' },
  }),
]);

// The natural-gate family. Every other feed target drives the endpoint directly
// and reaches the boundary in a handful of advances, which exercises the terminus
// and asks the judge nothing -- so the sensing profile and the seam stage have no
// coverage on a real surface at all. These consume the feed at a human pace until
// the gate arms and lands on its own.
//
// A run takes minutes, because it must: the sensing floor and ceiling are
// wall-clock and nothing can compress them. Compressing the profile instead would
// only prove the horizon lands near a scaled expectation, which is a weaker claim
// than the one these targets exist to make.
const FEED_GATE_TARGETS = Object.freeze([
  ['feed/gate/tiktok', 'TikTok natural gate horizon', 'tiktok', 'paged'],
  ['feed/gate/x-home', 'X Home natural gate horizon', 'x', 'continuous'],
  ['feed/gate/instagram-home', 'Instagram Home natural gate horizon', 'instagram-home', 'continuous'],
].map(([id, title, siteId, surfaceMode]) => defineQaTarget({
  id,
  title,
  family: 'feed_gate',
  lane: QA_LANES.REAL_SITE,
  protocolId: 'feed_horizon',
  supportedModes: [QA_MODES.AGENT],
  environmentId: 'authenticated',
  browserRequirements: ATTACHED_BROWSER_REQUIREMENTS,
  artifactId: 'dev_extension',
  resourceClaims: ['runtime:feed-horizon'],
  parameters: {
    gateDriveMs: {
      type: 'integer',
      cliName: 'gate-drive-ms',
      // Long enough for the slowest band the profile allows (ceiling 600s) plus
      // the seam wait, so a run that times out is a real finding rather than an
      // impatient budget.
      minimum: 60_000,
      maximum: 900_000,
      default: 720_000,
    },
    dwellMs: {
      type: 'integer',
      cliName: 'dwell-ms',
      minimum: 900,
      maximum: 7_000,
      default: 1_350,
    },
    rebuild: {
      type: 'boolean',
      cliName: 'rebuild',
      default: false,
    },
    allowInitialWindowFocusOnce: {
      type: 'boolean',
      cliName: 'allow-initial-window-focus-once',
      default: false,
    },
  },
  protocolOptions: {
    siteId,
    surfaceMode,
  },
})));

const FEED_RESEARCH_MATRIX_TARGETS = Object.freeze([
  defineQaTarget({
    id: 'feed/research/core-matrix',
    title: 'Cross-platform Feed consumption research matrix',
    family: 'feed_research',
    lane: QA_LANES.REAL_SITE,
    protocolId: 'feed_consumption_research',
    supportedModes: [QA_MODES.AGENT],
    environmentId: 'authenticated',
    browserRequirements: ATTACHED_BROWSER_REQUIREMENTS,
    artifactId: 'dev_extension',
    resourceClaims: ['runtime:feed-horizon'],
    parameters: {
      candidateThresholdPercent: {
        type: 'integer',
        cliName: 'candidate-threshold-percent',
        minimum: 55,
        maximum: 90,
        default: 78,
      },
      referenceDwellMs: {
        type: 'integer',
        cliName: 'reference-dwell-ms',
        minimum: 3_750,
        maximum: 6_250,
        default: 5_000,
      },
      featureProfile: {
        type: 'enum',
        cliName: 'feature-profile',
        values: ['feed_only'],
        default: 'feed_only',
      },
      allowInitialWindowFocusOnce: {
        type: 'boolean',
        cliName: 'allow-initial-window-focus-once',
        default: false,
      },
      rebuild: {
        type: 'boolean',
        cliName: 'rebuild',
        default: false,
      },
    },
    protocolOptions: {
      matrixId: 'cross_platform_core',
    },
  }),
  defineQaTarget({
    id: 'feed/research/x-completion',
    title: 'X Feed consumption completion matrix',
    family: 'feed_research',
    lane: QA_LANES.REAL_SITE,
    protocolId: 'feed_consumption_research',
    supportedModes: [QA_MODES.AGENT],
    environmentId: 'authenticated',
    browserRequirements: ATTACHED_BROWSER_REQUIREMENTS,
    artifactId: 'dev_extension',
    resourceClaims: ['runtime:feed-horizon'],
    parameters: {
      candidateThresholdPercent: {
        type: 'integer',
        cliName: 'candidate-threshold-percent',
        minimum: 55,
        maximum: 90,
        default: 78,
      },
      referenceDwellMs: {
        type: 'integer',
        cliName: 'reference-dwell-ms',
        minimum: 3_750,
        maximum: 6_250,
        default: 5_000,
      },
      featureProfile: {
        type: 'enum',
        cliName: 'feature-profile',
        values: ['feed_only'],
        default: 'feed_only',
      },
      allowInitialWindowFocusOnce: {
        type: 'boolean',
        cliName: 'allow-initial-window-focus-once',
        default: false,
      },
      rebuild: {
        type: 'boolean',
        cliName: 'rebuild',
        default: false,
      },
    },
    protocolOptions: {
      matrixId: 'x_completion',
      feedbackCanary: {
        siteId: 'tiktok',
        surfaceMode: 'paged',
        holdMs: 10_000,
        dwellMs: 1_350,
      },
    },
  }),
]);

const FEED_RESEARCH_TARGETS = Object.freeze([
  ['feed/research/tiktok', 'TikTok consumption research', 'tiktok', 'paged', 'tiktok'],
  ['feed/research/youtube-shorts', 'YouTube Shorts consumption research', 'youtube', 'paged', 'youtube'],
  ['feed/research/instagram-reels', 'Instagram Reels consumption research', 'instagram', 'paged', 'instagram'],
  ['feed/research/x-home', 'X Home consumption research', 'x', 'continuous', 'x'],
  ['feed/research/instagram-home', 'Instagram Home consumption research', 'instagram-home', 'continuous', 'instagram'],
  ['feed/research/facebook-home', 'Facebook Home consumption research', 'facebook', 'continuous', 'facebook'],
  ['feed/research/youtube-home', 'YouTube Home consumption research', 'youtube-home', 'continuous', 'youtube'],
].map(([id, title, siteId, surfaceMode, runtimeSiteId]) => defineQaTarget({
  id,
  title,
  family: 'feed_research',
  lane: QA_LANES.REAL_SITE,
  protocolId: 'feed_consumption_research',
  supportedModes: [QA_MODES.AGENT],
  environmentId: 'authenticated',
  browserRequirements: ATTACHED_BROWSER_REQUIREMENTS,
  artifactId: 'dev_extension',
  resourceClaims: ['runtime:feed-horizon'],
  parameters: {
    journey: {
      type: 'enum',
      cliName: 'journey',
      values: [
        'skim_forward',
        'steady_forward',
        'deliberate_watch',
        'burst_pause_burst',
        'revisit_deliberate',
      ],
      default: 'steady_forward',
    },
    candidateThresholdPercent: {
      type: 'integer',
      cliName: 'candidate-threshold-percent',
      minimum: 55,
      maximum: 90,
      default: 78,
    },
    referenceDwellMs: {
      type: 'integer',
      cliName: 'reference-dwell-ms',
      minimum: 3_750,
      maximum: 6_250,
      default: 5_000,
    },
    featureProfile: {
      type: 'enum',
      cliName: 'feature-profile',
      values: [
        'feed_only',
        'feed_social',
        'feed_video_skip',
        'feed_social_video_skip',
      ],
      default: 'feed_only',
    },
    allowInitialWindowFocusOnce: {
      type: 'boolean',
      cliName: 'allow-initial-window-focus-once',
      default: false,
    },
    rebuild: {
      type: 'boolean',
      cliName: 'rebuild',
      default: false,
    },
  },
  protocolOptions: {
    platform: id.slice('feed/research/'.length),
    siteId,
    runtimeSiteId,
    surfaceMode,
  },
})));

function visualTargetId(sceneId) {
  return sceneId.startsWith('gate/')
    ? `${sceneId}/render`
    : `visual/${sceneId}`;
}

const VISUAL_TARGETS = Object.freeze(
  listVisualSceneManifests().map((scene) => defineQaTarget({
    id: visualTargetId(scene.id),
    title: `${scene.title} render`,
    family: scene.id.startsWith('gate/') ? 'gate' : 'visual',
    lane: QA_LANES.RENDER,
    protocolId: 'visual_capture',
    supportedModes: [QA_MODES.AGENT],
    environmentId: 'visual',
    browserRequirements: {
      ...OWNED_BROWSER_REQUIREMENTS,
      extensionRuntime: 'none',
        webgl: ['zen/artifact-engine', 'zen/artifact-engine-retina', 'zen/artifact-collection', 'zen/artifact-collection-retina', 'zen/bonsai-first-bloom'].includes(scene.id) ? 'required' : 'optional',
    },
    artifactId: 'source_render',
    resourceClaims: ['runtime:visual-capture'],
    parameters: {},
    protocolOptions: {
      sceneId: scene.id,
    },
  })),
);

const CHERRY_PLUME_LIVE_TARGETS = Object.freeze([
  defineQaTarget({
    id: 'visual/zen/cherry-plume-live',
    title: 'Detached Cherry Plume Live: shared flowers, growth playback and Pixi reuse',
    family: 'visual',
    lane: QA_LANES.RENDER,
    protocolId: 'zen_cherry_plume_live',
    supportedModes: [QA_MODES.AGENT],
    environmentId: 'visual',
    browserRequirements: {
      ...OWNED_BACKGROUND_OBSERVATION_REQUIREMENTS,
      webgl: 'required',
    },
    artifactId: 'source_render',
    resourceClaims: ['runtime:visual-capture'],
    parameters: {
      source: { type: 'string', cliName: 'source', required: true },
      seed: { type: 'integer', cliName: 'seed', minimum: 1, maximum: 4294967295, default: 151 },
    },
    protocolOptions: {
      studyPath: 'scripts/dev/zen-bonsai-morphology-research/g15-4-typed-developmental-scheduler/current/research/cherry-plume-live',
      contract: 'zen_cherry_plume_live_qa_v7',
    },
  }),
]);

const RAIN_STREAKS_TARGETS = Object.freeze([
  defineQaTarget({
    id: 'visual/zen/rain-streaks',
    title: 'Detached Zen rain streak geometry and WebGL cost study',
    family: 'visual',
    lane: QA_LANES.RENDER,
    protocolId: 'zen_rain_streaks',
    supportedModes: [QA_MODES.AGENT],
    environmentId: 'visual',
    browserRequirements: {
      ...OWNED_BACKGROUND_OBSERVATION_REQUIREMENTS,
      webgl: 'required',
    },
    artifactId: 'source_render',
    resourceClaims: ['runtime:visual-capture'],
    parameters: {},
    protocolOptions: {
      entryPath: 'scripts/dev/zen-weather-motion-research/browser.mjs',
      contract: 'zen_rain_streaks_qa_v1',
    },
  }),
]);

const DASHBOARD_CAPTURE_TARGETS = Object.freeze([
  defineQaTarget({
    id: 'dashboard/sites-stored-reading-refresh',
    title: 'Stored foreground stats and Sites reading continuity',
    family: 'dashboard', lane: QA_LANES.EXTENSION, protocolId: 'dashboard_sites_stored_reading',
    supportedModes: [QA_MODES.AGENT], environmentId: 'ephemeral', artifactId: 'dev_extension',
    browserRequirements: { ...OWNED_BROWSER_REQUIREMENTS, rendering: 'headed_required', webgl: 'required',
      defaultPresentation: 'foreground', hiddenAllowed: false },
    resourceClaims: ['runtime:dashboard-capture'],
    parameters: {
      allowInitialWindowFocusOnce: { type: 'boolean', cliName: 'allow-initial-window-focus-once', default: false },
      viewport: { type: 'enum', cliName: 'viewport', values: ['desktop-wide', 'portrait-narrow'], default: 'desktop-wide' },
      rebuild: { type: 'boolean', cliName: 'rebuild', default: false },
    },
    protocolOptions: { initialWindowPresentation: 'windows_agent_present_once' },
  }),
  defineQaTarget({
    id: 'dashboard/boot',
    title: 'Dashboard cold and warm boot diagnostics',
    family: 'dashboard',
    lane: QA_LANES.EXTENSION,
    protocolId: 'dashboard_capture',
    supportedModes: [QA_MODES.AGENT],
    environmentId: 'ephemeral',
    browserRequirements: {
      ...OWNED_BROWSER_REQUIREMENTS,
      webgl: 'required',
    },
    artifactId: 'dev_extension',
    resourceClaims: ['runtime:dashboard-capture'],
    parameters: {
      theme: {
        type: 'enum',
        cliName: 'theme',
        values: ['matrix', 'entropy', 'cyberpunk', 'clinical', 'scp', 'zen'],
        default: 'zen',
      },
      samples: {
        type: 'integer',
        cliName: 'samples',
        minimum: 1,
        maximum: 5,
        default: 3,
      },
      postRevealMs: { type: 'integer', cliName: 'post-reveal-ms', minimum: 1000, maximum: 120000, default: 1000 },
      environmentClock: { type: 'enum', cliName: 'environment-clock', values: ['fixed', 'realtime'], default: 'fixed' },
      gpuInfoCollection: {
        type: 'enum',
        cliName: 'gpu-info-collection',
        values: ['off', 'browser-default', 'dawn-eager'],
        default: 'off',
      },
      cpuProfile: {
        type: 'boolean',
        cliName: 'cpu-profile',
        default: false,
      },
      gpuTiming: {
        type: 'boolean',
        cliName: 'gpu-timing',
        default: false,
      },
      canopyPreparation: {
        type: 'enum',
        cliName: 'canopy-preparation',
        values: ['native', 'before-first-draw'],
        default: 'native',
      },
      interaction: {
        type: 'enum',
        cliName: 'interaction',
        values: ['none', 'immediate', 'warmup'],
        default: 'none',
      },
      renderTrace: {
        type: 'boolean',
        cliName: 'render-trace',
        default: false,
      },
      renderTraceProfile: {
        type: 'enum',
        cliName: 'render-trace-profile',
        values: ['rendering', 'gpu-startup'],
        default: 'rendering',
      },
      traceMode: {
        type: 'enum',
        cliName: 'trace',
        values: ['full', 'marks', 'off'],
        default: 'marks',
      },
      pondEffectProfile: {
        type: 'enum',
        cliName: 'pond-effects',
        values: ZEN_MAIN_CAPTURE_POND_EFFECT_PROFILE_VALUES,
        default: 'full',
      },
      rebuild: {
        type: 'boolean',
        cliName: 'rebuild',
        default: false,
      },
    },
    protocolOptions: {
      operation: 'boot_probe',
      captureHarness: 'dashboard-surface-v1',
      zenMainProfile: 'zen-main-v1',
      viewport: 'desktop-wide',
      samplePolicy: 'one_cold_then_warm_same_owned_browser',
      artifactPreparationPolicy:
        'prepare_built_artifact_in_fresh_owned_browser_before_measurement',
      fixturePolicy: 'dev_only_ephemeral_surface_with_declared_full_main_projection',
    },
  }),
  defineQaTarget({
    id: 'dashboard/capture',
    title: 'Dashboard surface runtime capture',
    family: 'dashboard',
    lane: QA_LANES.EXTENSION,
    protocolId: 'dashboard_capture',
    supportedModes: [QA_MODES.AGENT],
    environmentId: 'ephemeral',
    browserRequirements: {
      ...OWNED_BROWSER_REQUIREMENTS,
      webgl: 'required',
    },
    artifactId: 'dev_extension',
    resourceClaims: ['runtime:dashboard-capture'],
    parameters: {
      locale: { type: 'enum', cliName: 'locale', values: ['en', 'ko'] },
      settingsSection: {
        type: 'enum', cliName: 'settings-section', values: ['workspace', 'protection', 'permissions', 'safety'],
      },
      artifactJourney: {
        type: 'boolean',
        cliName: 'artifact-journey',
        default: false,
      },
      artifactRuntimeJourney: {
        type: 'boolean',
        cliName: 'artifact-runtime-journey',
        default: false,
      },
      artifactEntryJourney: {
        type: 'boolean',
        cliName: 'artifact-entry-journey',
        default: false,
      },
      artifactEntryFrom: {
        type: 'enum',
        cliName: 'artifact-entry-from',
        values: ['sites', 'main'],
        default: 'sites',
      },
      artifactStartupDiagnostics: {
        type: 'boolean',
        cliName: 'artifact-startup-diagnostics',
        default: false,
      },
      artifactUiDiagnostics: {
        type: 'boolean',
        cliName: 'artifact-ui-diagnostics',
        default: false,
      },
      artifactUiExperiment: {
        type: 'enum',
        cliName: 'artifact-ui-experiment',
        values: ['none', 'without-grain-filter', 'without-nav-backdrop', 'without-ground', 'warm-bitmap-sink'],
        default: 'none',
      },
      firstVisionJourney: {
        type: 'boolean',
        cliName: 'first-vision-journey',
        default: false,
      },
      developmentToolsJourney: {
        type: 'boolean',
        cliName: 'development-tools-journey',
        default: false,
      },
      bonsaiDebugJourney: {
        type: 'boolean', cliName: 'bonsai-debug-journey', default: false,
      },
      firstSiteJourney: {
        type: 'boolean',
        cliName: 'first-site-journey',
        default: false,
      },
      firstSiteUiDiagnostics: {
        type: 'boolean',
        cliName: 'first-site-ui-diagnostics',
        default: false,
      },
      mainReturnJourney: {
        type: 'boolean',
        cliName: 'main-return-journey',
        default: false,
      },
      mainReturnAwayMs: {
        type: 'integer',
        cliName: 'main-return-away-ms',
        minimum: 10_000,
        maximum: 600_000,
        default: 10_000,
      },
      pressureRailJourney: {
        type: 'boolean',
        cliName: 'pressure-rail-journey',
        default: false,
      },
      sitesScenario: {
        type: 'enum',
        cliName: 'sites-scenario',
        values: ['none', 'recording-refresh', 'intel-reading', 'observed-reading-refresh'],
        default: 'none',
      },
      viewport: {
        type: 'enum',
        cliName: 'viewport',
        values: DASHBOARD_CAPTURE_VIEWPORT_NAMES,
        default: DEFAULT_DASHBOARD_CAPTURE_VIEWPORT,
      },
      resizeTo: {
        type: 'enum',
        cliName: 'resize-to',
        values: DASHBOARD_CAPTURE_VIEWPORT_NAMES,
        required: false,
      },
      surface: {
        type: 'enum',
        cliName: 'surface',
        values: ['main', 'artifacts', 'sites', 'schedule', 'settings', 'pond-lab'],
        default: 'main',
      },
      theme: {
        type: 'enum',
        cliName: 'theme',
        values: ['matrix', 'entropy', 'cyberpunk', 'clinical', 'scp', 'zen'],
        default: 'zen',
      },
      koiState: {
        type: 'enum',
        cliName: 'koi-state',
        values: ['full', 'sparse', 'empty'],
        default: 'full',
      },
      bonsaiState: {
        type: 'enum',
        cliName: 'bonsai-state',
        values: Object.values(ZEN_MAIN_CAPTURE_BONSAI_STATES),
        default: 'full',
      },
      appearanceTime: {
        type: 'string',
        cliName: 'appearance-time',
        default: '12:00',
      },
      weather: {
        type: 'enum',
        cliName: 'weather',
        values: ['clear', 'overcast', 'rain'],
        default: 'clear',
      },
      pressureState: {
        type: 'enum',
        cliName: 'pressure-state',
        values: ['collecting', 'ready', 'no-pressure'],
        default: 'ready',
      },
      pondEffectProfile: {
        type: 'enum',
        cliName: 'pond-effects',
        values: ZEN_MAIN_CAPTURE_POND_EFFECT_PROFILE_VALUES,
        default: 'full',
      },
      settleMs: {
        type: 'integer',
        cliName: 'settle-ms',
        minimum: 0,
        maximum: 15_000,
        default: 800,
      },
      rebuild: {
        type: 'boolean',
        cliName: 'rebuild',
        default: false,
      },
    },
    protocolOptions: {
      operation: 'capture',
      captureHarness: 'dashboard-surface-v1',
      zenMainProfile: 'zen-main-v1',
      viewportPolicy: 'named_preset_with_optional_resize',
      fixturePolicy: 'dev_only_ephemeral_surface_with_optional_profile_projection',
    },
  }),
]);

const FAVICON_TARGETS = Object.freeze([
  defineQaTarget({
    id: 'assets/favicon', title: 'Favicon capture, reuse, invalidation and app surfaces',
    family: 'assets', lane: QA_LANES.EXTENSION, protocolId: 'favicon_cache',
    supportedModes: [QA_MODES.AGENT], environmentId: 'ephemeral', artifactId: 'dev_extension',
    browserRequirements: { ...OWNED_BROWSER_REQUIREMENTS, defaultPresentation: 'hidden' },
    resourceClaims: ['runtime:favicon-cache'],
    parameters: { rebuild: { type: 'boolean', cliName: 'rebuild', default: false } },
    protocolOptions: { fixturePolicy: 'owned_ephemeral_favicon',
        networkPolicy: 'exact_local_favicon_cache_no_egress', responseDeliveryPolicy: 'owned_native_response_delay' },
  }),
]);

const GATE_RUNTIME_TARGETS = Object.freeze([
  defineQaTarget({
    id: 'gate/detour-spread/runtime', title: 'Full-page Detour selected close and external budget resume',
    family: 'gate', lane: QA_LANES.EFFECT, protocolId: 'gate_detour_runtime',
    supportedModes: [QA_MODES.AGENT], environmentId: 'ephemeral', artifactId: 'dev_extension',
    browserRequirements: OWNED_BROWSER_REQUIREMENTS,
    resourceClaims: ['runtime:gate-interstitial'],
    parameters: { rebuild: { type: 'boolean', cliName: 'rebuild', default: false } },
    protocolOptions: { fixturePolicy: 'owned_ephemeral_detour_selection' },
  }),
  defineQaTarget({
    id: 'artifacts/tab-management', title: 'Native protected tab groups and manual organization continuity',
    family: 'artifacts', lane: QA_LANES.EXTENSION, protocolId: 'tab_management',
    supportedModes: [QA_MODES.AGENT], environmentId: 'ephemeral', artifactId: 'dev_extension',
    browserRequirements: { ...OWNED_BROWSER_REQUIREMENTS, defaultPresentation: 'hidden',
      documentVisibility: 'background_allowed', targetActivation: 'active' },
    resourceClaims: ['runtime:tab-management'],
    parameters: { rebuild: { type: 'boolean', cliName: 'rebuild', default: false } },
    protocolOptions: { fixturePolicy: 'owned_ephemeral_native_tab_groups', permissionPolicy: 'temporary_manifest_tab_groups' },
  }),
  defineQaTarget({
    id: 'artifacts/echo', title: 'Disposable Echo removals, pause and worker continuity',
    family: 'artifacts', lane: QA_LANES.EXTENSION, protocolId: 'echo_artifacts',
    supportedModes: [QA_MODES.AGENT], environmentId: 'ephemeral', artifactId: 'dev_extension',
    browserRequirements: { ...OWNED_BROWSER_REQUIREMENTS, defaultPresentation: 'hidden',
      documentVisibility: 'background_allowed', targetActivation: 'background' },
    resourceClaims: ['runtime:echo-artifacts'],
    parameters: { rebuild: { type: 'boolean', cliName: 'rebuild', default: false } },
    protocolOptions: { fixturePolicy: 'owned_ephemeral_echo_specimens',
      permissionPolicy: 'temporary_manifest_history_bookmarks', idlePolicy: 'real_five_minute_checkpoint' },
  }),
  ...[
    ['settings/concurrency', 'Two Dashboard settings intents and worker continuity', 'settings_concurrency'],
    ['settings/propagation', 'Real settings task delay, failure and owner replacement', 'settings_propagation'],
  ].map(([id, title, protocolId]) => defineQaTarget({
    id, title, family: 'settings', lane: QA_LANES.EXTENSION, protocolId,
    concurrency: 'isolated_functional',
    supportedModes: [QA_MODES.AGENT], environmentId: 'ephemeral', artifactId: 'dev_extension',
    browserRequirements: { ...OWNED_BROWSER_REQUIREMENTS, webgl: 'required' },
    resourceClaims: ['runtime:settings-command-validation'],
    parameters: {
      allowInitialWindowFocusOnce: { type: 'boolean', cliName: 'allow-initial-window-focus-once', default: false },
      theme: { type: 'enum', cliName: 'theme', values: ['zen'], default: 'zen' },
      rebuild: { type: 'boolean', cliName: 'rebuild', default: false },
    },
    protocolOptions: { initialWindowPresentation: 'windows_agent_present_once',
      fixturePolicy: 'owned_ephemeral_settings_validation' },
  })),
  defineQaTarget({
    id: 'settings/permissions', title: 'Native site permission denial and reapproval',
    family: 'settings', lane: QA_LANES.EXTENSION, protocolId: 'settings_permissions',
    supportedModes: [QA_MODES.HUMAN], environmentId: 'ephemeral', artifactId: 'dev_extension',
    browserRequirements: {
      ...OWNED_BROWSER_REQUIREMENTS, rendering: 'headed_required', webgl: 'required',
      defaultPresentation: 'foreground', hiddenAllowed: false,
    },
    resourceClaims: ['runtime:settings-command-validation'],
    parameters: {
      allowInitialWindowFocusOnce: { type: 'boolean', cliName: 'allow-initial-window-focus-once', default: false },
      theme: { type: 'enum', cliName: 'theme', values: ['zen'], default: 'zen' },
      rebuild: { type: 'boolean', cliName: 'rebuild', default: false },
    },
    protocolOptions: {
      initialWindowPresentation: 'windows_human_permission_present_once',
      fixturePolicy: 'owned_ephemeral_native_permissions',
      permissionPolicy: 'native_prompt_no_pregrant',
    },
  }),
  defineQaTarget({
    id: 'journey/protection', title: 'Sites, Popup and native video protection in one browser session',
    family: 'journey', lane: QA_LANES.EXTENSION, protocolId: 'integrated_protection',
    supportedModes: [QA_MODES.AGENT], environmentId: 'ephemeral', artifactId: 'dev_extension',
    browserRequirements: {
      ...OWNED_BROWSER_REQUIREMENTS, webgl: 'required',
    },
    resourceClaims: ['runtime:integrated-protection'],
    parameters: {
      allowInitialWindowFocusOnce: {
        type: 'boolean', cliName: 'allow-initial-window-focus-once', default: false,
      },
      theme: { type: 'enum', cliName: 'theme',
        values: ['matrix', 'entropy', 'cyberpunk', 'clinical', 'scp', 'zen'], default: 'zen' },
      rebuild: { type: 'boolean', cliName: 'rebuild', default: false },
    },
    protocolOptions: {
      journey: 'sites-popup-native-video-v1', browserLifecycle: 'one_owned_session',
      progressionPreparation: 'post_consent_development_day_five',
      initialWindowPresentation: 'windows_agent_present_once',
      popupSurface: 'real_document_in_owned_tab', permissionPolicy: 'pregranted_fixture_host',
    },
  }),
  defineQaTarget({
    id: 'video-skip/native-controls', title: 'Native video timeline input and repeated seek protection',
    concurrency: 'isolated_functional',
    family: 'video_skip', lane: QA_LANES.EFFECT, protocolId: 'native_video_skip',
    supportedModes: [QA_MODES.AGENT], environmentId: 'ephemeral',
    browserRequirements: OWNED_BROWSER_REQUIREMENTS, artifactId: 'dev_extension',
    resourceClaims: ['runtime:video-skip-control-surface'],
    parameters: {
      expectation: { type: 'enum', cliName: 'expectation', values: ['observe', 'protect'], default: 'protect' },
      rebuild: { type: 'boolean', cliName: 'rebuild', default: false },
    },
    protocolOptions: {},
  }),
  defineQaTarget({
    id: 'media/frame-hold', title: 'Cross-origin frame media hold and permission lifecycle',
    family: 'media', lane: QA_LANES.EFFECT, protocolId: 'media_frame_hold',
    supportedModes: [QA_MODES.AGENT], environmentId: 'ephemeral',
    browserRequirements: OWNED_BROWSER_REQUIREMENTS, artifactId: 'dev_extension',
    resourceClaims: ['runtime:sentinel-protocol'],
    parameters: { rebuild: { type: 'boolean', cliName: 'rebuild', default: false } },
    protocolOptions: {},
  }),
  defineQaTarget({
    id: 'qa/runtime-stability', title: 'Managed QA preparation and rebuild continuity',
    family: 'qa', lane: QA_LANES.EXTENSION, protocolId: 'runtime_stability',
    supportedModes: [QA_MODES.AGENT], environmentId: 'authenticated',
    browserRequirements: { ...ATTACHED_BROWSER_REQUIREMENTS, defaultPresentation: 'foreground' },
    browserObservation: 'document', artifactId: 'dev_extension',
    resourceClaims: ['runtime:gate-interstitial', 'runtime:feed-horizon', 'runtime:sentinel-protocol'],
    parameters: {
      rebuildDuringRun: { type: 'boolean', cliName: 'rebuild-during-run', default: false },
      rebuild: { type: 'boolean', cliName: 'rebuild', default: false },
      allowInitialWindowFocusOnce: { type: 'boolean', cliName: 'allow-initial-window-focus-once', default: false },
    }, protocolOptions: {},
  }),
  defineQaTarget({
    id: 'qa/extension-reload', title: 'Reload development extension and verify the live build',
    family: 'qa', lane: QA_LANES.EXTENSION, protocolId: 'extension_reload',
    supportedModes: [QA_MODES.AGENT], environmentId: 'authenticated',
    browserRequirements: { ...ATTACHED_BROWSER_REQUIREMENTS, defaultPresentation: 'foreground' },
    browserObservation: 'document', artifactId: 'dev_extension',
    resourceClaims: ['runtime:gate-interstitial', 'runtime:feed-horizon', 'runtime:sentinel-protocol'],
    parameters: {
      rebuild: { type: 'boolean', cliName: 'rebuild', default: false },
      allowInitialWindowFocusOnce: { type: 'boolean', cliName: 'allow-initial-window-focus-once', default: false },
    }, protocolOptions: { scope: 'artifact_activation_and_readiness_only' },
  }),
  defineQaTarget({
    id: 'maintenance/profile-reset', title: 'Erase approved invalid Entropy profile and verify fresh runtime',
    family: 'maintenance', lane: QA_LANES.EXTENSION, protocolId: 'profile_reset_maintenance',
    supportedModes: [QA_MODES.AGENT], environmentId: 'authenticated',
    browserRequirements: { ...ATTACHED_BROWSER_REQUIREMENTS, defaultPresentation: 'foreground' },
    browserObservation: 'document', artifactId: 'dev_extension',
    resourceClaims: ['runtime:gate-interstitial', 'runtime:feed-horizon', 'runtime:sentinel-protocol'],
    parameters: {
      confirmEraseEntropyData: { type: 'boolean', cliName: 'confirm-erase-entropy-data', default: false },
      rebuild: { type: 'boolean', cliName: 'rebuild', default: false },
      allowInitialWindowFocusOnce: { type: 'boolean', cliName: 'allow-initial-window-focus-once', default: false },
    }, protocolOptions: { scope: 'authorized_settings_contract_reset_and_runtime_readiness' },
  }),
  defineQaTarget({
    id: 'consumption/protected-sites', title: 'Protected-site automatic consumption journey',
    family: 'consumption', lane: QA_LANES.REAL_SITE, protocolId: 'protected_sites_journey',
    supportedModes: [QA_MODES.AGENT], environmentId: 'authenticated',
    browserRequirements: { ...ATTACHED_BROWSER_REQUIREMENTS, defaultPresentation: 'foreground' },
    browserObservation: { parameter: 'scope', values: { entry: 'document', journey: 'foreground' } },
    artifactId: 'dev_extension',
    resourceClaims: ['runtime:gate-interstitial', 'runtime:feed-horizon', 'runtime:sentinel-protocol'],
    parameters: { scope: { type: 'enum', cliName: 'scope', values: ['journey', 'entry'], default: 'journey' },
      verifyDeparture: { type: 'boolean', cliName: 'verify-departure', default: false },
      rebuild: { type: 'boolean', cliName: 'rebuild', default: false },
      allowInitialWindowFocusOnce: { type: 'boolean', cliName: 'allow-initial-window-focus-once', default: false } },
    protocolOptions: {},
  }),
  defineQaTarget({
    id: 'consumption/goal-ends', title: 'Real-site goal Horizon, Furin and scoped delivery lifecycle',
    concurrency: 'isolated_functional',
    family: 'consumption', lane: QA_LANES.REAL_SITE, protocolId: 'goal_ends_real_site',
    supportedModes: [QA_MODES.AGENT], environmentId: 'ephemeral',
    browserRequirements: { ...OWNED_BROWSER_REQUIREMENTS, rendering: 'headless_required' }, artifactId: 'dev_extension',
    resourceClaims: ['runtime:gate-interstitial', 'runtime:feed-horizon', 'runtime:sentinel-protocol'],
    parameters: {
      rebuild: { type: 'boolean', cliName: 'rebuild', default: false },
    },
    protocolOptions: {},
  }),
  defineQaTarget({
    id: 'intervention/goal-ends', title: 'Real-site goal delivery with controlled budget facts',
    concurrency: 'isolated_functional',
    family: 'intervention', lane: QA_LANES.EFFECT, protocolId: 'goal_ends_functional',
    supportedModes: [QA_MODES.AGENT], environmentId: 'ephemeral',
    browserRequirements: { ...OWNED_BROWSER_REQUIREMENTS, rendering: 'headless_required' }, artifactId: 'dev_extension',
    resourceClaims: ['runtime:gate-interstitial', 'runtime:feed-horizon', 'runtime:sentinel-protocol'],
    parameters: { rebuild: { type: 'boolean', cliName: 'rebuild', default: false } },
    protocolOptions: {},
  }),
  defineQaTarget({
    id: 'intervention/collision/runtime',
    concurrency: 'isolated_functional',
    title: 'Cross-intervention ownership and recovery',
    family: 'intervention', lane: QA_LANES.EFFECT, protocolId: 'intervention_collision',
    supportedModes: [QA_MODES.AGENT], environmentId: 'ephemeral',
    browserRequirements: OWNED_BROWSER_REQUIREMENTS, artifactId: 'dev_extension',
    resourceClaims: ['runtime:gate-interstitial', 'runtime:sentinel-protocol'],
    parameters: { rebuild: { type: 'boolean', cliName: 'rebuild', default: false } },
    protocolOptions: {},
  }),
  defineQaTarget({
    id: 'gate/entry-checkpoint/consumption',
    title: 'Observed consumption to entry checkpoint',
    family: 'gate',
    lane: QA_LANES.EFFECT,
    protocolId: 'consumption_entry',
    supportedModes: [QA_MODES.AGENT],
    environmentId: 'ephemeral',
    browserRequirements: { ...OWNED_BROWSER_REQUIREMENTS, rendering: 'headed_required',
      defaultPresentation: 'foreground', hiddenAllowed: false },
    artifactId: 'dev_extension',
    resourceClaims: ['runtime:gate-interstitial'],
    parameters: { allowInitialWindowFocusOnce: { type: 'boolean', cliName: 'allow-initial-window-focus-once', default: false }, rebuild: { type: 'boolean', cliName: 'rebuild', default: false } },
    protocolOptions: { initialWindowPresentation: 'windows_agent_present_once' },
  }),
  defineQaTarget({
    id: 'gate/entry-checkpoint/runtime',
    concurrency: 'isolated_functional',
    title: 'Gate entry checkpoint runtime',
    family: 'gate',
    lane: QA_LANES.EFFECT,
    protocolId: 'gate_runtime',
    supportedModes: [QA_MODES.AGENT],
    environmentId: 'ephemeral',
    browserRequirements: OWNED_BROWSER_REQUIREMENTS,
    artifactId: 'dev_extension',
    resourceClaims: ['runtime:gate-interstitial'],
    parameters: {
      allowInitialWindowFocusOnce: { type: 'boolean', cliName: 'allow-initial-window-focus-once', default: false },
      viewport: {
        type: 'enum', cliName: 'viewport', values: ['landscape', 'portrait', 'wide-short', 'compact-portrait'], default: 'landscape',
      },
      resizeTo: {
        type: 'enum', cliName: 'resize-to', values: ['none', 'landscape', 'portrait'], default: 'none',
      },
      auditLayout: { type: 'boolean', cliName: 'audit-layout', default: false },
      intensity: {
        type: 'enum', cliName: 'intensity', values: ['baseline', 'maximum'], default: 'baseline',
      },
      decision: { type: 'enum', cliName: 'decision', values: ['continue', 'leave'], default: 'continue' },
      input: {
        type: 'enum', cliName: 'input', values: ['keyboard', 'pointer'], default: 'keyboard',
      },
      recentUse: {
        type: 'enum', cliName: 'recent-use', values: ['empty', 'recorded'], default: 'empty',
      },
      holdMs: {
        type: 'integer',
        cliName: 'hold-ms',
        minimum: 0,
        maximum: 30_000,
        default: 0,
      },
      rebuild: {
        type: 'boolean',
        cliName: 'rebuild',
        default: false,
      },
    },
    protocolOptions: {
      initialWindowPresentation: 'windows_agent_present_once',
      gateKind: 'entryCheckpoint',
    },
  }),
]);

const AUDIO_DULLING_TARGETS = Object.freeze([
  defineQaTarget({
    id: 'audio/suikinkutsu',
    title: 'Suikinkutsu protected-tab audio resolution',
    family: 'audio',
    lane: QA_LANES.REAL_SITE,
    protocolId: 'audio_dulling',
    supportedModes: [QA_MODES.HUMAN, QA_MODES.AGENT],
    environmentId: 'authenticated',
    browserRequirements: {
      ...ATTACHED_BROWSER_REQUIREMENTS,
      audio: 'audible_required',
      osFocus: 'request_once',
    },
    artifactId: 'dev_extension',
    resourceClaims: ['runtime:audio-dulling'],
    parameters: {
      url: {
        type: 'string',
        cliName: 'url',
        default: 'https://www.youtube.com/shorts/',
      },
      revealDelayMs: {
        type: 'integer',
        cliName: 'reveal-delay-ms',
        minimum: 0,
        maximum: 60_000,
        default: 3_000,
      },
      invitationWindowMs: {
        type: 'integer',
        cliName: 'invitation-window-ms',
        minimum: 3_000,
        maximum: 30_000,
        default: 10_000,
      },
      intensityPercent: {
        type: 'integer',
        cliName: 'intensity-percent',
        minimum: 0,
        maximum: 100,
        default: 58,
      },
      rampMs: {
        type: 'integer',
        cliName: 'ramp-ms',
        minimum: 0,
        maximum: 90_000,
        default: 0,
      },
      baselineMs: {
        type: 'integer',
        cliName: 'baseline-ms',
        minimum: 0,
        maximum: 60_000,
        default: 4_000,
      },
      processedMs: {
        type: 'integer',
        cliName: 'processed-ms',
        minimum: 0,
        maximum: 120_000,
        default: 18_000,
      },
      recoveryMs: {
        type: 'integer',
        cliName: 'recovery-ms',
        minimum: 0,
        maximum: 60_000,
        default: 6_000,
      },
      timeoutMs: {
        type: 'integer',
        cliName: 'timeout-ms',
        minimum: 30_000,
        maximum: 600_000,
        default: 300_000,
      },
      rebuild: {
        type: 'boolean',
        cliName: 'rebuild',
        default: false,
      },
    },
    protocolOptions: {},
  }),
]);

const SENTINEL_RUNTIME_TARGETS = Object.freeze([
  ['sentinel/site-furin/runtime', 'Site Furin protected-tab runtime', 'site'],
  ['sentinel/global/runtime', 'Global Sentinel protected-tab runtime', 'global'],
].map(([id, title, protocolScope]) => defineQaTarget({
  id,
  title,
  family: 'sentinel',
  lane: QA_LANES.REAL_SITE,
  protocolId: 'sentinel_runtime',
  supportedModes: [QA_MODES.HUMAN, QA_MODES.AGENT],
  environmentId: 'authenticated',
  browserRequirements: ATTACHED_BROWSER_REQUIREMENTS,
  browserObservation: 'document',
  artifactId: 'dev_extension',
  resourceClaims: ['runtime:sentinel-protocol'],
  parameters: {
    ...(protocolScope === 'site' ? {
      deliveryForm: { type: 'enum', cliName: 'delivery-form', values: ['full', 'brief'], default: 'full' },
      exitChoice: { type: 'enum', cliName: 'exit-choice', values: ['continue', 'leave'], default: 'continue' },
    } : {}),
    url: {
      type: 'string',
      cliName: 'url',
      default: 'https://example.com/',
    },
    timeoutMs: {
      type: 'integer',
      cliName: 'timeout-ms',
      minimum: 10_000,
      maximum: 180_000,
      default: 60_000,
    },
    intensityPercent: {
      type: 'integer',
      cliName: 'intensity-percent',
      minimum: 0,
      maximum: 100,
      default: 88,
    },
    hudVisible: {
      type: 'boolean',
      cliName: 'hud-visible',
      default: true,
    },
    captureScreenshots: {
      type: 'boolean',
      cliName: 'capture-screenshots',
      default: false,
    },
    allowInitialWindowFocusOnce: {
      type: 'boolean',
      cliName: 'allow-initial-window-focus-once',
      default: false,
    },
    rebuild: {
      type: 'boolean',
      cliName: 'rebuild',
      default: false,
    },
  },
  protocolOptions: { protocolScope },
})));

const HUMAN_SETUP_TARGETS = Object.freeze([
  ...[
    [
      'human/site-furin',
      'Human setup · Site Furin',
      'site_furin',
      'sentinel_protocol',
    ],
    [
      'human/global-furin',
      'Human setup · Global Furin',
      'global_sentinel',
      'sentinel_protocol',
    ],
  ].map(([id, title, featureId, productOwner]) => defineQaTarget({
    id,
    title,
    family: 'human',
    lane: QA_LANES.REAL_SITE,
    protocolId: 'human_setup',
    supportedModes: [QA_MODES.HUMAN],
    environmentId: 'authenticated',
    browserRequirements: HUMAN_SETUP_BROWSER_REQUIREMENTS,
    artifactId: 'dev_extension',
      resourceClaims: ['runtime:human-setup', 'runtime:sentinel-protocol'],
      parameters: {
        ...HUMAN_SETUP_COMMON_PARAMETERS,
        ...(featureId === 'site_furin' ? {
        } : {}),
        captureScreenshots: {
          type: 'boolean',
          cliName: 'capture-screenshots',
          default: false,
        },
      intensityPercent: {
        type: 'integer',
        cliName: 'intensity-percent',
        minimum: 0,
        maximum: 100,
        default: 88,
      },
      hudVisible: {
        type: 'boolean',
        cliName: 'hud-visible',
        default: false,
      },
    },
    operatorHandoffPolicy: HUMAN_SETUP_OPERATOR_HANDOFF_POLICY,
    protocolOptions: {
      featureId,
      productOwner,
      admissionMode: 'direct_realization',
    },
  })),
  defineQaTarget({
    id: 'human/shishi-odoshi',
    title: 'Human setup · Shishi-odoshi entry checkpoint',
    family: 'human',
    lane: QA_LANES.REAL_SITE,
    protocolId: 'human_setup',
    supportedModes: [QA_MODES.HUMAN],
    environmentId: 'authenticated',
    browserRequirements: HUMAN_SETUP_BROWSER_REQUIREMENTS,
    artifactId: 'dev_extension',
    resourceClaims: ['runtime:human-setup', 'runtime:gate-interstitial'],
    parameters: HUMAN_SETUP_COMMON_PARAMETERS,
    operatorHandoffPolicy: HUMAN_SETUP_OPERATOR_HANDOFF_POLICY,
    protocolOptions: {
      featureId: 'shishi_odoshi',
      productOwner: 'gate_interstitial',
      admissionMode: 'direct_realization',
    },
  }),
  defineQaTarget({
    id: 'human/enso-gate',
    title: 'Human setup · Enso Gate',
    family: 'human',
    lane: QA_LANES.REAL_SITE,
    protocolId: 'human_setup',
    supportedModes: [QA_MODES.HUMAN],
    environmentId: 'authenticated',
    browserRequirements: HUMAN_SETUP_BROWSER_REQUIREMENTS,
    artifactId: 'dev_extension',
    resourceClaims: ['runtime:human-setup', 'runtime:nudge-debugger'],
    parameters: HUMAN_SETUP_COMMON_PARAMETERS,
    operatorHandoffPolicy: HUMAN_SETUP_OPERATOR_HANDOFF_POLICY,
    protocolOptions: {
      featureId: 'enso_gate',
      productOwner: 'interaction_manager',
      admissionMode: 'debug_realization_without_detector_admission',
    },
  }),
  defineQaTarget({
    id: 'human/detour-spread-guard',
    title: 'Human setup · Detour spread guard',
    family: 'human',
    lane: QA_LANES.REAL_SITE,
    protocolId: 'human_setup',
    supportedModes: [QA_MODES.HUMAN],
    environmentId: 'authenticated',
    browserRequirements: HUMAN_SETUP_BROWSER_REQUIREMENTS,
    artifactId: 'dev_extension',
    resourceClaims: ['runtime:human-setup', 'runtime:gate-interstitial'],
    parameters: {
      ...HUMAN_SETUP_COMMON_PARAMETERS,
      maxProtectedTabs: {
        type: 'integer',
        cliName: 'max-protected-tabs',
        minimum: 1,
        maximum: 20,
        default: 1,
      },
      openTabCount: {
        type: 'integer',
        cliName: 'open-tab-count',
        minimum: 2,
        maximum: 25,
        default: 2,
      },
    },
    operatorHandoffPolicy: HUMAN_SETUP_OPERATOR_HANDOFF_POLICY,
    protocolOptions: {
      featureId: 'detour_spread_guard',
      productOwner: 'gate_interstitial',
      admissionMode: 'owned_tab_realization_without_detector_admission',
    },
  }),
]);

const VIDEO_SKIP_CONTROL_SURFACE_TARGETS = Object.freeze([
  [
    'video-skip/youtube-watch',
    'YouTube Watch VideoSkip control surface',
    'youtube',
    'watch',
    'https://www.youtube.com/watch?v=jNQXAC9IVRw',
  ],
  [
    'video-skip/youtube-shorts',
    'YouTube Shorts VideoSkip control surface',
    'youtube',
    'shorts',
    'https://www.youtube.com/shorts/',
  ],
  [
    'video-skip/x-video',
    'X VideoSkip control surface',
    'x',
    'video',
    'https://x.com/home',
  ],
  [
    'video-skip/instagram-feed',
    'Instagram Feed VideoSkip control surface',
    'instagram',
    'feed',
    'https://www.instagram.com/',
  ],
  [
    'video-skip/instagram-reels',
    'Instagram Reels VideoSkip control surface',
    'instagram',
    'reels',
    'https://www.instagram.com/reels/',
  ],
  [
    'video-skip/tiktok',
    'TikTok VideoSkip control surface',
    'tiktok',
    'feed',
    'https://www.tiktok.com/',
  ],
  [
    'video-skip/reddit',
    'Reddit VideoSkip control surface',
    'reddit',
    'feed',
    'https://www.reddit.com/r/popular/',
  ],
].map(([id, title, siteId, surface, targetUrl]) => defineQaTarget({
  id,
  title,
  family: 'video_skip',
  lane: QA_LANES.REAL_SITE,
  protocolId: 'video_skip_control_surface',
  supportedModes: [QA_MODES.AGENT],
  environmentId: 'authenticated',
  browserRequirements: ATTACHED_BROWSER_REQUIREMENTS,
  artifactId: 'dev_extension',
  resourceClaims: ['runtime:video-skip-control-surface'],
  parameters: {
    url: {
      type: 'string',
      cliName: 'url',
      default: targetUrl,
    },
    policy: {
      type: 'enum',
      cliName: 'policy',
      values: ['hard_block'],
      default: 'hard_block',
    },
    timeoutMs: {
      type: 'integer',
      cliName: 'timeout-ms',
      minimum: 10_000,
      maximum: 120_000,
      default: 45_000,
    },
    settleMs: {
      type: 'integer',
      cliName: 'settle-ms',
      minimum: 250,
      maximum: 3_000,
      default: 900,
    },
    allowInitialWindowFocusOnce: {
      type: 'boolean',
      cliName: 'allow-initial-window-focus-once',
      default: false,
    },
    rebuild: {
      type: 'boolean',
      cliName: 'rebuild',
      default: false,
    },
  },
  protocolOptions: {
    siteId,
    surface,
    activationPolicy: 'dev_only_exact_tab_session_no_settings_or_site_rule_writes',
  },
})));

const ATTACHED_REDDIT_SURFACE_TARGET = defineQaTarget({
  id: 'site/reddit-surface-attached',
  title: 'Managed-browser Reddit access and DOM opportunity observation',
  family: 'site',
  lane: QA_LANES.REAL_SITE,
  protocolId: 'site_runtime_attached',
  supportedModes: [QA_MODES.AGENT],
  environmentId: 'authenticated',
  browserRequirements: ATTACHED_BACKGROUND_OBSERVATION_REQUIREMENTS,
  artifactId: null,
  resourceClaims: ['runtime:site-e2e'],
  parameters: {},
  protocolOptions: {
    scope: 'managed_browser_reddit_access_and_dom_structural_opportunity_only',
    site: 'reddit',
    targetUrl: 'https://www.reddit.com/r/popular/',
    selectorScenarioIds: [
      'reddit-public-metrics',
      'reddit-media-targeting',
      'reddit-text-targeting',
    ],
    settingsAndSiteRulePolicy: 'zero_settings_and_site_rule_commands',
    existingTargetPolicy: 'unique_exact_route_attach_evaluate_detach',
  },
});

const YOUTUBE_SELECTOR_DRIFT_CORPUS_TARGETS = Object.freeze([
  defineQaTarget({
    id: 'site/youtube-selector-drift-corpus-public',
    title: 'YouTube selector-drift public independent corpus capture',
    family: 'site',
    lane: QA_LANES.REAL_SITE,
    protocolId: 'youtube_selector_drift_corpus',
    supportedModes: [QA_MODES.AGENT],
    environmentId: 'ephemeral',
    browserRequirements: OWNED_BACKGROUND_OBSERVATION_REQUIREMENTS,
    artifactId: null,
    resourceClaims: ['runtime:youtube-selector-drift-corpus'],
    parameters: {
      surface: {
        type: 'enum',
        cliName: 'surface',
        values: ['watch', 'shorts'],
        default: 'watch',
      },
      locale: {
        type: 'enum',
        cliName: 'locale',
        values: ['en', 'ko'],
        default: 'ko',
      },
    },
    protocolOptions: {
      scope: 'youtube_selector_drift_independent_candidate_corpus',
      collectionPolicy: 'read_only_bounded_redacted_human_review_required',
      productDetectorInfluence: false,
      profileWritePolicy: 'forbidden',
      existingTargetPolicy: 'unique_existing_route_attach_evaluate_detach',
    },
  }),
  defineQaTarget({
    id: 'site/youtube-selector-drift-corpus-authenticated',
    title: 'YouTube selector-drift authenticated independent corpus capture',
    family: 'site',
    lane: QA_LANES.REAL_SITE,
    protocolId: 'youtube_selector_drift_corpus',
    supportedModes: [QA_MODES.AGENT],
    environmentId: 'authenticated',
    browserRequirements: ATTACHED_BACKGROUND_OBSERVATION_REQUIREMENTS,
    artifactId: null,
    resourceClaims: ['runtime:youtube-selector-drift-corpus'],
    parameters: {
      surface: {
        type: 'enum',
        cliName: 'surface',
        values: ['watch', 'shorts'],
        default: 'watch',
      },
    },
    protocolOptions: {
      scope: 'youtube_selector_drift_independent_candidate_corpus',
      collectionPolicy: 'read_only_bounded_redacted_human_review_required',
      productDetectorInfluence: false,
      profileWritePolicy: 'forbidden',
      existingTargetPolicy: 'unique_existing_route_attach_evaluate_detach',
    },
  }),
]);

const SOCIAL_SELECTOR_DRIFT_CORPUS_TARGET = defineQaTarget({
  id: 'site/social-selector-drift-corpus-authenticated',
  title: 'X and Instagram selector-drift independent corpus capture',
  family: 'site',
  lane: QA_LANES.REAL_SITE,
  protocolId: 'social_selector_drift_corpus',
  supportedModes: [QA_MODES.AGENT],
  environmentId: 'authenticated',
  browserRequirements: ATTACHED_BACKGROUND_OBSERVATION_REQUIREMENTS,
  artifactId: null,
  resourceClaims: ['runtime:social-selector-drift-corpus'],
  parameters: {
    surface: {
      type: 'enum',
      cliName: 'surface',
      values: [
        'x_post',
        'instagram_feed',
        'instagram_reels',
        'instagram_profile_grid_dialog',
      ],
      default: 'x_post',
    },
    allowInitialWindowFocusOnce: {
      type: 'boolean',
      cliName: 'allow-initial-window-focus-once',
      default: false,
    },
  },
  protocolOptions: {
    scope: 'social_selector_drift_independent_candidate_corpus',
    collectionPolicy: 'read_only_bounded_redacted_human_review_required',
    productDetectorInfluence: false,
    profileWritePolicy: 'forbidden',
    targetPolicy: 'protocol_owned_exact_target_create_navigate_observe_close',
  },
});

const LEGACY_ENGINE_TARGETS = Object.freeze([
  defineQaTarget({
    id: 'site/scroll-runtime',
    title: 'Scroll runtime contract, contention, or benchmark',
    family: 'site',
    lane: QA_LANES.REAL_SITE,
    protocolId: 'site_runtime',
    supportedModes: [QA_MODES.AGENT],
    environmentId: 'ephemeral',
    browserRequirements: OWNED_BROWSER_REQUIREMENTS,
    artifactId: null,
    resourceClaims: [
      'artifact:dev_extension',
      'artifact:public_extension',
      'runtime:site-e2e',
    ],
    parameters: {
      measurement: {
        type: 'enum',
        cliName: 'measurement',
        values: ['contract', 'contention', 'benchmark'],
        default: 'contention',
      },
      samples: {
        type: 'integer',
        cliName: 'samples',
        minimum: 1,
        maximum: 10,
        default: 3,
      },
      rebuild: {
        type: 'boolean',
        cliName: 'rebuild',
        default: false,
      },
    },
    protocolOptions: {
      artifactOwnership: 'site_runtime_lane',
      suite: 'runtime-contention',
      measurementProfiles: {
        contract: { lane: 'diagnostic', fixedRepeat: 1 },
        contention: { lane: 'diagnostic', minimumSamples: 1 },
        benchmark: { lane: 'diagnostic', minimumSamples: 3 },
      },
    },
  }),
  defineQaTarget({
    id: 'site/feed-runtime',
    title: 'Real-feed runtime contention attribution',
    family: 'site',
    lane: QA_LANES.REAL_SITE,
    protocolId: 'site_runtime',
    supportedModes: [QA_MODES.AGENT],
    environmentId: 'ephemeral',
    browserRequirements: OWNED_BROWSER_REQUIREMENTS,
    artifactId: null,
    resourceClaims: [
      'artifact:dev_extension',
      'artifact:public_extension',
      'runtime:site-e2e',
    ],
    parameters: {
      site: {
        type: 'enum',
        cliName: 'site',
        values: ['youtube', 'tiktok'],
        default: 'youtube',
      },
      measurement: {
        type: 'enum',
        cliName: 'measurement',
        values: ['contention'],
        default: 'contention',
      },
      feature: {
        type: 'enum',
        cliName: 'feature',
        values: ['combined', 'scroll', 'visual', 'text'],
        default: 'combined',
      },
      samples: {
        type: 'integer',
        cliName: 'samples',
        minimum: 1,
        maximum: 10,
        default: 3,
      },
      profile: {
        type: 'string',
        cliName: 'profile',
        absolutePath: true,
      },
      rebuild: {
        type: 'boolean',
        cliName: 'rebuild',
        default: false,
      },
    },
    protocolOptions: {
      artifactOwnership: 'site_runtime_lane',
      suite: 'feed-runtime-public',
      siteSelection: true,
      measurementProfiles: {
        contention: { lane: 'both', minimumSamples: 1 },
      },
      featureGroups: {
        combined: 'real-feed-runtime-combined',
        scroll: 'real-feed-runtime-scroll',
        visual: 'real-feed-runtime-visual',
        text: 'real-feed-runtime-text',
      },
    },
  }),
  defineQaTarget({
    id: 'site/youtube-watch-runtime',
    title: 'YouTube Watch comment-load runtime attribution',
    family: 'site',
    lane: QA_LANES.REAL_SITE,
    protocolId: 'site_runtime',
    supportedModes: [QA_MODES.AGENT],
    environmentId: 'ephemeral',
    browserRequirements: OWNED_BROWSER_REQUIREMENTS,
    artifactId: null,
    resourceClaims: [
      'artifact:dev_extension',
      'artifact:public_extension',
      'runtime:site-e2e',
    ],
    parameters: {
      site: {
        type: 'enum',
        cliName: 'site',
        values: ['youtube'],
        default: 'youtube',
      },
      measurement: {
        type: 'enum',
        cliName: 'measurement',
        values: ['contention'],
        default: 'contention',
      },
      feature: {
        type: 'enum',
        cliName: 'feature',
        values: ['combined', 'matrix', 'scroll', 'visual', 'text', 'social'],
        default: 'combined',
      },
      samples: {
        type: 'integer',
        cliName: 'samples',
        minimum: 1,
        maximum: 10,
        default: 3,
      },
      rebuild: {
        type: 'boolean',
        cliName: 'rebuild',
        default: false,
      },
    },
    protocolOptions: {
      artifactOwnership: 'site_runtime_lane',
      suite: 'watch-runtime-public',
      siteSelection: true,
      measurementProfiles: {
        contention: { lane: 'both', minimumSamples: 1 },
      },
      featureGroups: {
        combined: 'watch-runtime-combined',
        matrix: null,
        scroll: 'watch-runtime-scroll',
        visual: 'watch-runtime-visual',
        text: 'watch-runtime-text',
        social: 'watch-runtime-social',
      },
    },
  }),
  defineQaTarget({
    id: 'site/youtube-selector-drift',
    title: 'YouTube selector-drift recovery observation',
    family: 'site',
    lane: QA_LANES.REAL_SITE,
    protocolId: 'site_runtime',
    supportedModes: [QA_MODES.AGENT],
    environmentId: 'ephemeral',
    browserRequirements: OWNED_BROWSER_REQUIREMENTS,
    artifactId: null,
    resourceClaims: [
      'artifact:dev_extension',
      'artifact:public_extension',
      'runtime:site-e2e',
    ],
    parameters: {
      site: {
        type: 'enum',
        cliName: 'site',
        values: ['youtube'],
        default: 'youtube',
      },
      lane: {
        type: 'enum',
        cliName: 'lane',
        values: ['diagnostic'],
        default: 'diagnostic',
      },
      feature: {
        type: 'enum',
        cliName: 'feature',
        values: ['social'],
        default: 'social',
      },
      repeat: {
        type: 'integer',
        cliName: 'repeat',
        minimum: 3,
        maximum: 20,
        default: 3,
      },
      rebuild: {
        type: 'boolean',
        cliName: 'rebuild',
        default: false,
      },
    },
    protocolOptions: {
      artifactOwnership: 'site_runtime_lane',
      suite: 'release-core',
      siteSelection: true,
      repeatIsolation: 'fresh_disposable_browser',
      featureGroups: {
        social: 'video-shortform-social',
      },
    },
  }),
  defineQaTarget({
    id: 'site/tiktok-feed-flow',
    title: 'TikTok FeedFlow exact-match acceptance',
    family: 'site',
    lane: QA_LANES.REAL_SITE,
    protocolId: 'site_runtime',
    supportedModes: [QA_MODES.AGENT],
    environmentId: 'ephemeral',
    browserRequirements: OWNED_BROWSER_REQUIREMENTS,
    artifactId: null,
    resourceClaims: [
      'artifact:dev_extension',
      'artifact:public_extension',
      'runtime:site-e2e',
    ],
    parameters: {
      site: {
        type: 'enum',
        cliName: 'site',
        values: ['tiktok'],
        default: 'tiktok',
      },
      lane: {
        type: 'enum',
        cliName: 'lane',
        values: ['diagnostic'],
        default: 'diagnostic',
      },
      repeat: {
        type: 'integer',
        cliName: 'repeat',
        minimum: 1,
        maximum: 20,
        default: 3,
      },
      rebuild: {
        type: 'boolean',
        cliName: 'rebuild',
        default: false,
      },
    },
    protocolOptions: {
      artifactOwnership: 'site_runtime_lane',
      suite: 'release-core',
      siteSelection: true,
      repeatIsolation: 'fresh_disposable_browser',
      reportAcceptance: {
        kind: 'feed_consumption_exact_match',
        minimumOpportunityCountPerRun: 2,
        scenarioId: 'tiktok-public-feed',
      },
    },
  }),
  defineQaTarget({
    id: 'site/youtube-media-removal-cost',
    title: 'YouTube Visual removal workload and sampled owner costs',
    family: 'site',
    lane: QA_LANES.REAL_SITE,
    protocolId: 'site_runtime',
    supportedModes: [QA_MODES.AGENT],
    environmentId: 'ephemeral',
    browserRequirements: OWNED_BROWSER_REQUIREMENTS,
    artifactId: null,
    resourceClaims: ['artifact:dev_extension', 'artifact:public_extension', 'runtime:site-e2e'],
    parameters: {
      site: { type: 'enum', cliName: 'site', values: ['youtube'], default: 'youtube' },
      feature: { type: 'enum', cliName: 'feature', values: ['media'], default: 'media' },
      measurement: { type: 'enum', cliName: 'measurement', values: ['contention'], default: 'contention' },
      samples: { type: 'integer', cliName: 'samples', minimum: 1, maximum: 3, default: 3 },
      rebuild: { type: 'boolean', cliName: 'rebuild', default: false },
    },
    protocolOptions: {
      artifactOwnership: 'site_runtime_lane', suite: 'targeting-core', siteSelection: true,
      repeatIsolation: 'fresh_disposable_browser',
      featureGroups: { media: 'basic-media-targeting' },
      measurementProfiles: { contention: { lane: 'diagnostic', minimumSamples: 1 } },
    },
  }),
  defineQaTarget({
    id: 'site/youtube-media-membership',
    title: 'YouTube media candidate revocation and additive filter ownership',
    family: 'site',
    lane: QA_LANES.REAL_SITE,
    protocolId: 'site_runtime',
    supportedModes: [QA_MODES.AGENT],
    environmentId: 'ephemeral',
    browserRequirements: OWNED_BROWSER_REQUIREMENTS,
    artifactId: null,
    resourceClaims: ['artifact:dev_extension', 'artifact:public_extension', 'runtime:site-e2e'],
    parameters: {
      site: { type: 'enum', cliName: 'site', values: ['youtube'], default: 'youtube' },
      feature: { type: 'enum', cliName: 'feature', values: ['media'], default: 'media' },
      lane: { type: 'enum', cliName: 'lane', values: ['diagnostic', 'release'], default: 'diagnostic' },
      repeat: { type: 'integer', cliName: 'repeat', minimum: 1, maximum: 3, default: 1 },
      rebuild: { type: 'boolean', cliName: 'rebuild', default: false },
    },
    protocolOptions: {
      artifactOwnership: 'site_runtime_lane',
      suite: 'targeting-core',
      siteSelection: true,
      featureGroups: { media: 'basic-media-targeting' },
    },
  }),
  defineQaTarget({
    id: 'site/youtube-root-visual-continuity',
    title: 'YouTube SPA root-visual compositor continuity',
    family: 'site',
    lane: QA_LANES.REAL_SITE,
    protocolId: 'site_runtime',
    supportedModes: [QA_MODES.AGENT],
    environmentId: 'ephemeral',
    browserRequirements: OWNED_BROWSER_REQUIREMENTS,
    artifactId: null,
    resourceClaims: [
      'artifact:dev_extension',
      'artifact:public_extension',
      'runtime:site-e2e',
    ],
    parameters: {
      site: {
        type: 'enum',
        cliName: 'site',
        values: ['youtube'],
        default: 'youtube',
      },
      measurement: {
        type: 'enum',
        cliName: 'measurement',
        values: ['contract'],
        default: 'contract',
      },
      rebuild: {
        type: 'boolean',
        cliName: 'rebuild',
        default: false,
      },
    },
    protocolOptions: {
      artifactOwnership: 'site_runtime_lane',
      suite: 'root-visual-continuity',
      siteSelection: true,
      measurementProfiles: {
        contract: { lane: 'release', fixedRepeat: 1 },
      },
    },
  }),
  defineQaTarget({
    id: 'site/release-core',
    title: 'Public real-site release core',
    family: 'site',
    lane: QA_LANES.REAL_SITE,
    protocolId: 'site_runtime',
    supportedModes: [QA_MODES.AGENT],
    environmentId: 'ephemeral',
    browserRequirements: OWNED_BROWSER_REQUIREMENTS,
    artifactId: null,
    resourceClaims: [
      'artifact:dev_extension',
      'artifact:public_extension',
      'runtime:site-e2e',
    ],
    parameters: {
      lane: {
        type: 'enum',
        cliName: 'lane',
        values: ['diagnostic', 'release', 'both'],
        default: 'both',
      },
      repeat: {
        type: 'integer',
        cliName: 'repeat',
        minimum: 1,
        maximum: 20,
        default: 1,
      },
      rebuild: {
        type: 'boolean',
        cliName: 'rebuild',
        default: false,
      },
    },
    protocolOptions: {
      artifactOwnership: 'site_runtime_lane',
      suite: 'release-core',
    },
  }),
  defineQaTarget({
    id: 'site/targeting-core',
    title: 'Public real-site targeting core',
    family: 'site',
    lane: QA_LANES.REAL_SITE,
    protocolId: 'site_runtime',
    supportedModes: [QA_MODES.AGENT],
    environmentId: 'ephemeral',
    browserRequirements: OWNED_BROWSER_REQUIREMENTS,
    artifactId: null,
    resourceClaims: [
      'artifact:dev_extension',
      'artifact:public_extension',
      'runtime:site-e2e',
    ],
    parameters: {
      lane: {
        type: 'enum',
        cliName: 'lane',
        values: ['diagnostic', 'release', 'both'],
        default: 'both',
      },
      repeat: {
        type: 'integer',
        cliName: 'repeat',
        minimum: 1,
        maximum: 20,
        default: 1,
      },
      rebuild: {
        type: 'boolean',
        cliName: 'rebuild',
        default: false,
      },
    },
    protocolOptions: {
      artifactOwnership: 'site_runtime_lane',
      suite: 'targeting-core',
    },
  }),
  defineQaTarget({
    id: 'lifecycle/mv3',
    title: 'MV3 runtime lifecycle',
    family: 'lifecycle',
    lane: QA_LANES.EXTENSION,
    protocolId: 'command',
    supportedModes: [QA_MODES.AGENT],
    environmentId: 'ephemeral',
    browserRequirements: OWNED_BROWSER_REQUIREMENTS,
    artifactId: 'public_extension',
    resourceClaims: ['runtime:mv3-lifecycle'],
    parameters: {},
    protocolOptions: {
      script: 'scripts/e2e/mv3LifecycleE2E.mjs',
      reportArgument: '--report-dir',
      artifactArgument: '--dist',
      reportContract: {
        filePrefix: 'cws-runtime-',
        schemaVersion: 3,
        outcomeField: 'status',
        passValue: 'passed',
        failValue: 'failed',
      },
    },
  }),
  defineQaTarget({
    id: 'lifecycle/data',
    title: 'MV3 data lifecycle',
    family: 'lifecycle',
    lane: QA_LANES.EXTENSION,
    protocolId: 'command',
    supportedModes: [QA_MODES.AGENT],
    environmentId: 'ephemeral',
    browserRequirements: OWNED_BROWSER_REQUIREMENTS,
    artifactId: 'public_extension',
    resourceClaims: ['runtime:mv3-data-lifecycle'],
    parameters: {},
    protocolOptions: {
      script: 'scripts/e2e/mv3DataLifecycleE2E.mjs',
      reportArgument: '--report-dir',
      artifactArgument: '--dist',
      reportContract: {
        filePrefix: 'mv3-data-lifecycle-',
        schemaVersion: 1,
        outcomeField: 'passed',
        passValue: true,
        failValue: false,
      },
    },
  }),
  defineQaTarget({
    id: 'release/lifecycle',
    title: 'Release lifecycle matrix',
    family: 'release',
    lane: QA_LANES.RELEASE,
    protocolId: 'command',
    supportedModes: [QA_MODES.AGENT],
    environmentId: 'release',
    browserRequirements: OWNED_BROWSER_REQUIREMENTS,
    artifactId: 'public_extension',
    resourceClaims: ['runtime:release-lifecycle'],
    parameters: {
      sourceOnly: {
        type: 'boolean',
        cliName: 'source-only',
        default: false,
      },
    },
    protocolOptions: {
      script: 'scripts/e2e/releaseLifecycleMatrix.mjs',
      reportArgument: '--report-dir',
      artifactArgument: '--dist',
      reportContract: {
        filePrefix: 'release-lifecycle-matrix-',
        schemaVersion: 1,
        outcomeField: 'passed',
        passValue: true,
        failValue: false,
      },
    },
  }),
]);

const TARGETS = Object.freeze([
  ...FEED_TARGETS,
  ...FEED_GATE_TARGETS,
  ...FEED_GESTURE_TARGETS,
  ...FEED_RESEARCH_TARGETS,
  ...FEED_RESEARCH_MATRIX_TARGETS,
  ...VISUAL_TARGETS,
  ...CHERRY_PLUME_LIVE_TARGETS,
  ...RAIN_STREAKS_TARGETS,
  ...DASHBOARD_CAPTURE_TARGETS,
  ...FAVICON_TARGETS,
  ...GATE_RUNTIME_TARGETS,
  ...AUDIO_DULLING_TARGETS,
  ...SENTINEL_RUNTIME_TARGETS,
  ...HUMAN_SETUP_TARGETS,
  ...VIDEO_SKIP_CONTROL_SURFACE_TARGETS,
  ATTACHED_REDDIT_SURFACE_TARGET,
  ...YOUTUBE_SELECTOR_DRIFT_CORPUS_TARGETS,
  SOCIAL_SELECTOR_DRIFT_CORPUS_TARGET,
  ...LEGACY_ENGINE_TARGETS,
]);

const TARGET_BY_ID = (() => {
  const registry = new Map();
  TARGETS.forEach((target) => {
    if (registry.has(target.id)) {
      throw new Error(`QA_TARGET_DUPLICATE:${target.id}`);
    }
    registry.set(target.id, target);
  });
  return registry;
})();

export function listQaTargets() {
  return [...TARGETS];
}

export function getQaTarget(targetId) {
  const normalized = typeof targetId === 'string' ? targetId.trim() : '';
  const target = TARGET_BY_ID.get(normalized);
  if (!target) throw new Error(`QA_TARGET_UNKNOWN:${normalized || 'missing'}`);
  return target;
}
