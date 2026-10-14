import { resolveZenAmbientPalette } from '../../runtime/environment/zenWorldMaterialPalette.js';
import { getZenArtifactColorTokens } from '../../../../core/tools/zenArtifactColorTokens.js';

const ZEN_LANDING_ARTIFACT_COLORS = Object.freeze({
  shoji: getZenArtifactColorTokens('lens'),
  shishi: getZenArtifactColorTokens('gate'),
  furin: getZenArtifactColorTokens('flare'),
});

const ZEN_LANDING_PHASES = Object.freeze([
  'threshold',
  'manifesto',
  'friction',
  'pause',
  'reflection',
  'invitation',
]);

const ZEN_LANDING_PHASE_SET = new Set(ZEN_LANDING_PHASES);
const ZEN_LANDING_MOTION_MODES = new Set(['full', 'reduced']);
const ZEN_LANDING_SOUND_MODES = new Set(['muted', 'enabled']);
const ZEN_LANDING_SHISHI_PHASES = new Set([
  'dormant',
  'filling',
  'striking',
  'releasing',
  'passed',
]);
const ZEN_LANDING_REDUCED_VISUAL_PROGRESS = Object.freeze({
  threshold: 0.04,
  manifesto: 0.18,
  friction: 0.35,
  pause: 0.43,
  reflection: 0.7,
  invitation: 0.96,
});

function fail(code, detail = '') {
  throw new Error(detail ? `${code}: ${detail}` : code);
}

function requireRecord(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('ZEN_LANDING_SNAPSHOT_INVALID_RECORD', path);
  }
  return value;
}

function requireFinite(value, path, minimum, maximum) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    fail('ZEN_LANDING_SNAPSHOT_INVALID_NUMBER', `${path} must be ${minimum}..${maximum}`);
  }
  return value;
}

function requireEnum(value, path, allowed) {
  if (!allowed.has(value)) {
    fail('ZEN_LANDING_SNAPSHOT_INVALID_ENUM', `${path}=${String(value)}`);
  }
  return value;
}

function requireBoolean(value, path) {
  if (typeof value !== 'boolean') {
    fail('ZEN_LANDING_SNAPSHOT_INVALID_BOOLEAN', `${path}=${String(value)}`);
  }
  return value;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(value) {
  const t = clamp01(value);
  return t * t * (3 - (2 * t));
}

function enter(progress, start, end) {
  return smoothstep((progress - start) / (end - start));
}

function exit(progress, start, end) {
  return 1 - enter(progress, start, end);
}

function mix(left, right, amount) {
  return left + ((right - left) * amount);
}

function mixRgbCss(from, to, amount) {
  const t = clamp01(amount);
  const channels = from.map((channel, index) => Math.round(mix(channel, to[index], t)));
  return `rgb(${channels.join(' ')})`;
}

function parseHexRgb(value) {
  const match = /^#([\da-f]{6})$/iu.exec(value);
  if (!match) fail('ZEN_LANDING_AMBIENT_COLOR_INVALID', String(value));
  return [
    Number.parseInt(match[1].slice(0, 2), 16),
    Number.parseInt(match[1].slice(2, 4), 16),
    Number.parseInt(match[1].slice(4, 6), 16),
  ];
}

function gradeLandingRgb(rgb, gradeAmount) {
  const luminance = (rgb[0] * 0.299) + (rgb[1] * 0.587) + (rgb[2] * 0.114);
  const paperNeutral = [luminance * 1.015, luminance, luminance * 0.985];
  return mixRgbCss(rgb, paperNeutral, gradeAmount);
}

function gradeLandingColor(value, gradeAmount) {
  return gradeLandingRgb(parseHexRgb(value), gradeAmount);
}

function resolveLandingSkyColor(value, gradeAmount, twilightMute) {
  const twilightNeutral = [127, 145, 144];
  const source = parseHexRgb(value);
  const tempered = source.map((channel, index) => (
    mix(channel, twilightNeutral[index], twilightMute)
  ));
  return gradeLandingRgb(tempered, gradeAmount);
}

function resolveCanonicalPhase(source) {
  return requireEnum(source.phase, 'phase', ZEN_LANDING_PHASE_SET);
}

function resolveArtifactEffects(source) {
  const artifactEffects = requireRecord(source.artifactEffects, 'snapshot.artifactEffects');
  const shoji = requireRecord(artifactEffects.shoji, 'snapshot.artifactEffects.shoji');
  const furin = requireRecord(artifactEffects.furin, 'snapshot.artifactEffects.furin');
  return Object.freeze({
    shoji: Object.freeze({
      presence: requireFinite(shoji.presence, 'artifactEffects.shoji.presence', 0, 1),
      desaturation: requireFinite(
        shoji.desaturation,
        'artifactEffects.shoji.desaturation',
        0,
        1,
      ),
      tracking: requireFinite(shoji.tracking, 'artifactEffects.shoji.tracking', 0, 1),
      shuffle: requireFinite(shoji.shuffle, 'artifactEffects.shoji.shuffle', 0, 1),
    }),
    furin: Object.freeze({
      presence: requireFinite(furin.presence, 'artifactEffects.furin.presence', 0, 1),
      signalRecession: requireFinite(
        furin.signalRecession,
        'artifactEffects.furin.signalRecession',
        0,
        1,
      ),
      triggered: requireBoolean(furin.triggered, 'artifactEffects.furin.triggered'),
      signalProgress: requireFinite(
        furin.signalProgress,
        'artifactEffects.furin.signalProgress',
        0,
        1,
      ),
    }),
  });
}

function resolveShishiGate(source) {
  const gate = requireRecord(source.shishiGate, 'snapshot.shishiGate');
  return Object.freeze({
    phase: requireEnum(gate.phase, 'shishiGate.phase', ZEN_LANDING_SHISHI_PHASES),
    presence: requireFinite(gate.presence, 'shishiGate.presence', 0, 1),
    dwellProgress: requireFinite(gate.dwellProgress, 'shishiGate.dwellProgress', 0, 1),
    fillProgress: requireFinite(gate.fillProgress, 'shishiGate.fillProgress', 0, 1),
    strikeProgress: requireFinite(gate.strikeProgress, 'shishiGate.strikeProgress', 0, 1),
    releaseProgress: requireFinite(gate.releaseProgress, 'shishiGate.releaseProgress', 0, 1),
    holding: requireBoolean(gate.holding, 'shishiGate.holding'),
    passed: requireBoolean(gate.passed, 'shishiGate.passed'),
  });
}

export function requireZenLandingSnapshot(snapshot) {
  const source = requireRecord(snapshot, 'snapshot');
  const environment = requireRecord(source.environment, 'snapshot.environment');
  const wind = requireRecord(source.wind, 'snapshot.wind');
  const globalProgress = requireFinite(
    source.globalProgress,
    'globalProgress',
    0,
    1,
  );
  const phase = resolveCanonicalPhase(source);
  const phaseProgress = requireFinite(
    source.phaseProgress,
    'phaseProgress',
    0,
    1,
  );

  return Object.freeze({
    globalProgress,
    phase,
    phaseProgress,
    environment: Object.freeze({
      dawn: requireFinite(environment.dawn, 'environment.dawn', 0, 1),
      daylight: requireFinite(environment.daylight, 'environment.daylight', 0, 1),
      warmth: requireFinite(environment.warmth, 'environment.warmth', 0, 1),
      twilight: requireFinite(environment.twilight, 'environment.twilight', 0, 1),
      nightDepth: requireFinite(environment.nightDepth, 'environment.nightDepth', 0, 1),
    }),
    artifactEffects: resolveArtifactEffects(source),
    shishiGate: resolveShishiGate(source),
    wind: Object.freeze({
      x: requireFinite(wind.x, 'wind.x', -1, 1),
      strength: requireFinite(wind.strength, 'wind.strength', 0, 1),
    }),
    stillnessMs: requireFinite(source.stillnessMs, 'stillnessMs', 0, Number.MAX_SAFE_INTEGER),
    stillnessProgress: requireFinite(source.stillnessProgress, 'stillnessProgress', 0, 1),
    scrollPressure: requireFinite(source.scrollPressure, 'scrollPressure', 0, 1),
    motionMode: requireEnum(source.motionMode, 'motionMode', ZEN_LANDING_MOTION_MODES),
    soundMode: requireEnum(source.soundMode, 'soundMode', ZEN_LANDING_SOUND_MODES),
  });
}

function resolveShishiPresentation(gate, reducedMotion) {
  if (reducedMotion) {
    return Object.freeze({
      fill: 0,
      phase: gate.passed ? 'settled' : 'resting',
      tiltDeg: gate.passed ? 24 : -8,
    });
  }

  if (gate.phase === 'filling') {
    return Object.freeze({
      fill: gate.fillProgress,
      phase: 'filling',
      tiltDeg: mix(-8, -2, gate.fillProgress),
    });
  }
  if (gate.phase === 'striking' || gate.phase === 'releasing') {
    const release = Math.max(gate.strikeProgress, gate.releaseProgress);
    return Object.freeze({
      fill: gate.fillProgress,
      phase: 'tipping',
      tiltDeg: mix(-2, 24, release),
    });
  }
  return Object.freeze({
    fill: 0,
    phase: gate.passed ? 'settled' : 'resting',
    tiltDeg: gate.passed ? 24 : -8,
  });
}

export function resolveZenLandingPresentation(snapshot) {
  const state = requireZenLandingSnapshot(snapshot);
  const progress = state.motionMode === 'reduced'
    ? ZEN_LANDING_REDUCED_VISUAL_PROGRESS[state.phase]
    : state.globalProgress;
  const ambientPalette = resolveZenAmbientPalette({
    daylight: state.environment.daylight,
    nightDepth: state.environment.nightDepth,
    dawnWeight: state.environment.dawn,
    duskWeight: state.environment.twilight,
    warmth: state.environment.warmth,
    lowSun: clamp01(state.environment.dawn + state.environment.twilight),
    twilightWeight: state.environment.twilight,
    nightWeight: state.environment.nightDepth,
  });

  const gardenGrowth = enter(progress, 0, 0.94);
  const gardenRecovery = clamp01(0.12 + (gardenGrowth * 0.88));
  const gardenKoiProgress = enter(progress, 0.3, 0.88);
  const shojiGrade = state.artifactEffects.shoji.desaturation * 0.62;
  const nightInk = enter(state.environment.nightDepth, 0.12, 0.68);
  const twilightMute = enter(progress, 0.54, 0.64)
    * exit(progress, 0.80, 0.94)
    * 0.62;
  const shishi = resolveShishiPresentation(
    state.shishiGate,
    state.motionMode === 'reduced',
  );
  const furin = state.artifactEffects.furin;
  const furinResponseProgress = state.motionMode === 'reduced' && furin.triggered
    ? 0.42
    : furin.signalProgress;
  const furinStrikeRotation = furin.triggered && furin.signalProgress < 1
    ? Math.sin(furin.signalProgress * Math.PI) * 2.4
    : 0;
  const passedArtifactIds = [];
  if (progress >= 0.43) passedArtifactIds.push('shoji');
  if (state.shishiGate.passed) passedArtifactIds.push('shishi');
  if (furin.signalRecession >= 0.995) passedArtifactIds.push('furin');

  return Object.freeze({
    state,
    visualProgress: progress,
    thresholdProgress: state.phase === 'threshold'
      ? (state.motionMode === 'reduced' ? 0.5 : state.phaseProgress)
      : 1,
    palette: Object.freeze({
      skyTop: resolveLandingSkyColor(
        ambientPalette.bonsai.skyTop,
        shojiGrade * 0.5,
        twilightMute,
      ),
      skyBottom: resolveLandingSkyColor(
        ambientPalette.bonsai.skyLow,
        shojiGrade * 0.45,
        twilightMute,
      ),
      water: gradeLandingColor(ambientPalette.water[1], shojiGrade * 0.4),
      waterSpectrum: Object.freeze(ambientPalette.water.map((color, index) => (
        gradeLandingColor(color, shojiGrade * (0.34 + (index * 0.03)))
      ))),
      bankRear: gradeLandingColor(ambientPalette.terrain.atmosphereTop, shojiGrade * 0.5),
      bankNear: gradeLandingColor(ambientPalette.terrain.sandFront, shojiGrade * 0.46),
      mist: gradeLandingColor(ambientPalette.shell.top, shojiGrade * 0.4),
      shore: gradeLandingColor(ambientPalette.water[0], shojiGrade * 0.36),
      paper: gradeLandingColor(ambientPalette.shell.top, shojiGrade * 0.42),
      ink: mixRgbCss([39, 48, 43], [226, 229, 219], nightInk),
      copyInk: mixRgbCss([39, 48, 43], [236, 235, 228], enter(progress, 0.7, 0.84)),
      ember: mixRgbCss([151, 75, 61], [205, 135, 116], nightInk),
      lens: ZEN_LANDING_ARTIFACT_COLORS.shoji.artifact.color,
      gate: ZEN_LANDING_ARTIFACT_COLORS.shishi.artifact.color,
      flare: ZEN_LANDING_ARTIFACT_COLORS.furin.artifact.color,
    }),
    layers: Object.freeze({
      threshold: exit(progress, 0.075, 0.12),
      shoji: state.artifactEffects.shoji.presence * 0.82,
      furin: furin.presence * 0.72,
      shishi: state.shishiGate.presence * 0.82,
      bonsai: mix(0.64, 0.94, gardenGrowth),
      pond: 1,
      invitation: enter(progress, 0.82, 0.95),
    }),
    artifactEffects: state.artifactEffects,
    artifactTrace: Object.freeze({
      presence: enter(progress, 0.14, 0.24),
      passedIds: Object.freeze(passedArtifactIds),
      colors: Object.freeze({
        shoji: ZEN_LANDING_ARTIFACT_COLORS.shoji.navigation.active,
        shishi: ZEN_LANDING_ARTIFACT_COLORS.shishi.navigation.active,
        furin: ZEN_LANDING_ARTIFACT_COLORS.furin.navigation.active,
      }),
    }),
    shojiIntensity: Math.max(
      state.artifactEffects.shoji.desaturation,
      state.artifactEffects.shoji.tracking * 0.72,
    ),
    furinRotationDeg: state.motionMode === 'reduced'
      ? 0
      : (state.wind.x * state.wind.strength * 3.6) + furinStrikeRotation,
    furinSignalProgress: furin.signalProgress,
    furinResponseProgress,
    furinTriggered: furin.triggered,
    shishiFill: shishi.fill,
    shishiTiltDeg: shishi.tiltDeg,
    shishiPhase: shishi.phase,
    shishiCycleProgress: state.shishiGate.dwellProgress,
    shishiReleaseProgress: state.shishiGate.releaseProgress,
    gardenGrowth,
    gardenRecovery,
    gardenKoiProgress,
    pondStillness: state.motionMode === 'reduced' ? 1 : state.stillnessProgress,
    scrollPressure: state.motionMode === 'reduced' ? 0 : state.scrollPressure,
    petalPresence: state.motionMode === 'reduced'
      ? (gardenGrowth > 0.9 ? 0.32 : 0)
      : enter(progress, 0.8, 0.98) * 0.48,
  });
}

export { ZEN_LANDING_PHASES };
