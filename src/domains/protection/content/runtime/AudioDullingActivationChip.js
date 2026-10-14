import { resolveRasterResolution } from '@/platform/rendering/renderBudgetContract.js';
import { readDevicePixelRatio } from '@/platform/rendering/devicePixelRatio.js';
import pageMediaActivityObserver from '../../../nudge/media/PageMediaActivityObserver.js';
import {
  projectPageMediaConsumptionEvidence,
} from '../../../nudge/media/mediaConsumptionEvidence.js';
import {
  evaluateSuikinkutsuInterventionCandidate,
} from '../../audioDulling/suikinkutsuInterventionCandidate.js';
import sharedInterventionAdmissionRuntime from '../../../nudge/runtime/interventionAdmissionClient.js';

const ROOT_ID = 'entropy-audio-dulling-activation-chip';
const DEFAULT_VIEWPORT_WIDTH = 184;
const DEFAULT_VIEWPORT_HEIGHT = 246;
const INVITATION_ANIMATION_MS = 2_380;
const INVITATION_FORMATION_MS = 680;
const INVITATION_FORMATION_VARIANCE_MS = 100;
const INVITATION_ABSORPTION_START = 0.83;
const INVITATION_SUCTION_START = 0.72;
const INVITATION_SINK_Y = -30;
const INVITATION_SINK_RIGHT_INSET_SCALE = 0.1;
const INVITATION_SINK_RIGHT_INSET_RANGE = Object.freeze([92, 196]);
const REDUCED_MOTION_ANIMATION_MS = 680;
const DEFAULT_INVITATION_WINDOW_MS = 10_000;
const ORIGIN_X_RANGE = Object.freeze([0.33, 0.58]);
const ORIGIN_Y_RANGE = Object.freeze([0.7, 0.8]);
const RADIUS_SCALE_RANGE = Object.freeze([0.92, 1.08]);
const CURVE_ENTRY_PULL_RANGE = Object.freeze([0.035, 0.075]);
const CURVE_ENTRY_RISE_RANGE = Object.freeze([0.34, 0.42]);
const CURVE_EXIT_X_RANGE = Object.freeze([0.68, 0.78]);
const CURVE_EXIT_Y_RANGE = Object.freeze([0.14, 0.22]);
let host = null;
let shadow = null;
let canvas = null;
let lastSignature = '';
let lastStatus = 'idle';
let activeRuntime = false;
let mediaActivityObserverOwner = pageMediaActivityObserver;
let mediaActivityUnsubscribe = null;
let mediaCandidateRecheckTimer = null;
let latestMediaEvidence = null;
let interventionAdmissionRuntimeOwner = sharedInterventionAdmissionRuntime;
let interventionAdmissionLease = null;
let interventionAdmissionPresented = false;
let interventionAdmissionUnsubscribe = null;
let animationFrameId = null;
let animationStartAt = 0;
let animationSeed = null;
let invitationTransport = null;
let invitationPresented = false;
let invitationArrived = false;
let invitationExpiryTimer = null;
let invitationWindowMs = DEFAULT_INVITATION_WINDOW_MS;
let revealDelayMs = 0;

function readAudioDullingEntry(filters = {}) {
  const entry = filters?.audioDulling;
  return entry && typeof entry === 'object' ? entry : null;
}

function shouldRender(filters = {}) {
  return readAudioDullingEntry(filters)?.isActive === true;
}

function getDocument() {
  return globalThis.document || null;
}

function getNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function getViewportMetrics() {
  const doc = getDocument();
  const view = doc?.defaultView || globalThis;
  const width = Math.max(
    1,
    Math.ceil(
      Number(view?.innerWidth)
      || Number(doc?.documentElement?.clientWidth)
      || DEFAULT_VIEWPORT_WIDTH,
    ),
  );
  const height = Math.max(
    1,
    Math.ceil(
      Number(view?.innerHeight)
      || Number(doc?.documentElement?.clientHeight)
      || DEFAULT_VIEWPORT_HEIGHT,
    ),
  );
  return { width, height };
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function sampleRange([minimum, maximum]) {
  return minimum + (maximum - minimum) * Math.random();
}

function sampleVariance(variance) {
  return (Math.random() * 2 - 1) * variance;
}

function easeInOutCubic(value) {
  const progress = clamp01(value);
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - clamp01(value), 3);
}

function easeInCubic(value) {
  return Math.pow(clamp01(value), 3);
}

function mix(start, end, progress) {
  return start + (end - start) * clamp01(progress);
}

function isReducedMotionPreferred() {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
}

function normalizeDuration(value, {
  fallbackMs,
  minimum,
  maximum,
}) {
  const numeric = Number(value);
  const resolved = Number.isFinite(numeric) ? Math.round(numeric) : fallbackMs;
  return Math.max(minimum, Math.min(maximum, resolved));
}

function scheduleAnimationFrame(callback) {
  if (typeof globalThis.requestAnimationFrame === 'function') {
    return globalThis.requestAnimationFrame(callback);
  }
  return globalThis.setTimeout?.(() => callback(getNow()), 16) ?? null;
}

function cancelScheduledAnimationFrame(frameId) {
  if (frameId === null || frameId === undefined) return;
  if (typeof globalThis.cancelAnimationFrame === 'function') {
    globalThis.cancelAnimationFrame(frameId);
  } else {
    globalThis.clearTimeout?.(frameId);
  }
}

function createStyles(doc) {
  const style = doc.createElement('style');
  style.textContent = `
    :host {
      all: initial;
      position: fixed;
      inset: 0;
      z-index: 2147483646;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      pointer-events: none;
      contain: strict;
    }

    canvas {
      display: block;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      filter:
        drop-shadow(0 26px 34px rgba(2, 8, 23, 0.34))
        drop-shadow(0 0 16px rgba(14, 116, 144, 0.14));
    }

    @media (prefers-reduced-motion: reduce) {
      canvas {
        filter: drop-shadow(0 12px 22px rgba(2, 8, 23, 0.18));
      }
    }
  `;
  return style;
}

function resizeCanvas() {
  if (!canvas) return null;
  const { width: viewportWidth, height: viewportHeight } = getViewportMetrics();
  const { effectivePixelRatio: dpr, pixelWidth: width, pixelHeight: height } = resolveRasterResolution({ cssWidth: viewportWidth, cssHeight: viewportHeight, devicePixelRatio: readDevicePixelRatio(),
            pixelRatioCap: 2, maxRenderPixels: 8_294_400 });
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  canvas.style.width = `${viewportWidth}px`;
  canvas.style.height = `${viewportHeight}px`;
  const context = canvas.getContext?.('2d') || null;
  context?.setTransform?.(dpr, 0, 0, dpr, 0, 0);
  return context;
}

function createAnimationSeed() {
  const { width, height } = getViewportMetrics();
  const baseRadius = Math.max(26, Math.min(44, Math.min(width, height) * 0.075));
  const radius = baseRadius * sampleRange(RADIUS_SCALE_RANGE);
  const horizontalMargin = Math.min(radius * 3, width * 0.5);
  const verticalMinimum = Math.min(radius * 3, height * 0.5);
  const verticalMaximum = Math.max(verticalMinimum, height - radius * 2.2);
  const formationDurationMs = INVITATION_FORMATION_MS
    + sampleVariance(INVITATION_FORMATION_VARIANCE_MS);
  return {
    width,
    height,
    radius,
    startX: Math.max(
      horizontalMargin,
      Math.min(width - horizontalMargin, width * sampleRange(ORIGIN_X_RANGE)),
    ),
    startY: Math.max(
      verticalMinimum,
      Math.min(verticalMaximum, height * sampleRange(ORIGIN_Y_RANGE)),
    ),
    sinkX: Math.max(
      18,
      width - Math.max(
        INVITATION_SINK_RIGHT_INSET_RANGE[0],
        Math.min(
          INVITATION_SINK_RIGHT_INSET_RANGE[1],
          width * INVITATION_SINK_RIGHT_INSET_SCALE,
        ),
      ),
    ),
    sinkY: INVITATION_SINK_Y,
    formationEnd: formationDurationMs / INVITATION_ANIMATION_MS,
    controlBX: width * sampleRange(CURVE_EXIT_X_RANGE),
    controlBY: height * sampleRange(CURVE_EXIT_Y_RANGE),
    curveEntryPull: width * sampleRange(CURVE_ENTRY_PULL_RANGE),
    curveEntryRise: height * sampleRange(CURVE_ENTRY_RISE_RANGE),
  };
}

function cubicPoint(start, controlA, controlB, end, progress) {
  const inverse = 1 - progress;
  return (
    inverse * inverse * inverse * start
    + 3 * inverse * inverse * progress * controlA
    + 3 * inverse * progress * progress * controlB
    + progress * progress * progress * end
  );
}

function resolveInvitationFrame(progress) {
  const seed = animationSeed || createAnimationSeed();
  const formationEnd = seed.formationEnd;
  const absorptionStart = INVITATION_ABSORPTION_START;
  if (progress < formationEnd) {
    const forming = easeOutCubic(progress / formationEnd);
    return {
      ...seed,
      ritualProgress: progress,
      stage: 'forming',
      stageProgress: forming,
      x: seed.startX,
      y: seed.startY - forming * seed.radius * 0.22,
      radius: seed.radius * (0.24 + forming * 0.76),
      alpha: Math.min(1, 0.18 + forming * 0.82),
      stretch: 0.92 + forming * 0.12,
    };
  }

  const travelProgress = clamp01(
    (progress - formationEnd) / (absorptionStart - formationEnd),
  );
  const travel = mix(
    easeInOutCubic(travelProgress),
    easeInCubic(travelProgress),
    0.38,
  );
  const controlAX = seed.startX - seed.curveEntryPull;
  const controlAY = seed.startY - seed.curveEntryRise;
  const x = cubicPoint(
    seed.startX,
    controlAX,
    seed.controlBX,
    seed.sinkX,
    travel,
  );
  const y = cubicPoint(
    seed.startY,
    controlAY,
    seed.controlBY,
    seed.sinkY,
    travel,
  );
  if (progress < absorptionStart) {
    return {
      ...seed,
      ritualProgress: progress,
      stage: 'rising',
      stageProgress: travelProgress,
      x,
      y,
      radius: seed.radius * (1 - travelProgress * 0.25),
      alpha: 1,
      stretch: 1.04 + Math.sin(travelProgress * Math.PI) * 0.28,
    };
  }

  const absorption = easeInCubic(
    (progress - absorptionStart) / (1 - absorptionStart),
  );
  return {
    ...seed,
    ritualProgress: progress,
    stage: 'absorbing',
    stageProgress: absorption,
    x: seed.sinkX,
    y: seed.sinkY + seed.radius * 0.45 * (1 - absorption),
    radius: seed.radius * 0.66 * (1 - absorption),
    alpha: 1 - absorption,
    stretch: 1.5 + absorption * 2.8,
  };
}

function drawEllipse(ctx, x, y, radiusX, radiusY, strokeStyle, lineWidth, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  if (typeof ctx.ellipse === 'function') {
    ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
  } else {
    ctx.arc(x, y, Math.max(radiusX, radiusY), 0, Math.PI * 2);
  }
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.restore();
}

function drawCondensationField(ctx, frame) {
  const forming = frame.stageProgress;
  const poolRadius = frame.radius * (1.1 + forming * 1.7);
  drawEllipse(
    ctx,
    frame.x,
    frame.startY + frame.radius * 0.7,
    poolRadius,
    Math.max(2, poolRadius * 0.17),
    'rgba(103, 232, 249, 0.7)',
    1.2,
    (1 - forming * 0.45) * 0.6,
  );
  drawEllipse(
    ctx,
    frame.x,
    frame.startY + frame.radius * 0.72,
    poolRadius * 0.66,
    Math.max(1.4, poolRadius * 0.1),
    'rgba(224, 242, 254, 0.86)',
    0.8,
    0.55,
  );
  const satelliteAlpha = Math.sin(forming * Math.PI) * 0.42;
  [
    [-1.35, 0.2, 0.11],
    [1.18, 0.38, 0.085],
    [-0.62, -0.72, 0.07],
    [0.72, -0.88, 0.06],
  ].forEach(([offsetX, offsetY, scale]) => {
    ctx.save();
    ctx.globalAlpha = satelliteAlpha;
    ctx.beginPath();
    ctx.arc(
      frame.x + frame.radius * offsetX,
      frame.y + frame.radius * offsetY,
      Math.max(1.4, frame.radius * scale),
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = 'rgba(207, 250, 254, 0.88)';
    ctx.fill();
    ctx.restore();
  });
}

function drawRisingTrail(ctx, frame) {
  if (frame.stage !== 'rising') return;
  const trail = Math.sin(frame.stageProgress * Math.PI);
  ctx.save();
  ctx.globalAlpha = trail * 0.26;
  ctx.beginPath();
  ctx.moveTo(frame.x, frame.y + frame.radius * 0.7);
  ctx.quadraticCurveTo(
    frame.x - frame.radius * 0.38,
    frame.y + frame.radius * 2.4,
    frame.x - frame.radius * 0.12,
    frame.y + frame.radius * 3.4,
  );
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.72)';
  ctx.lineWidth = Math.max(1, frame.radius * 0.055);
  ctx.stroke();
  ctx.restore();
}

function drawBoundaryGlow(ctx, frame) {
  const anticipation = clamp01(
    (frame.ritualProgress - 0.68)
    / (INVITATION_ABSORPTION_START - 0.68),
  );
  if (anticipation <= 0) return;
  const contact = clamp01(
    (frame.ritualProgress - INVITATION_ABSORPTION_START)
    / (1 - INVITATION_ABSORPTION_START),
  );
  const strength = frame.ritualProgress < INVITATION_ABSORPTION_START
    ? easeInOutCubic(anticipation)
    : 1 - easeOutCubic(contact);
  if (strength <= 0.01) return;

  const span = frame.radius * mix(5.4, 2.8, contact);
  const glowHeight = Math.max(22, frame.radius * 1.45);
  const gradient = ctx.createRadialGradient?.(
    frame.sinkX,
    0,
    0,
    frame.sinkX,
    0,
    span,
  );
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = strength * 0.72;
  if (gradient) {
    gradient.addColorStop(0, 'rgba(224, 242, 254, 0.94)');
    gradient.addColorStop(0.18, 'rgba(103, 232, 249, 0.72)');
    gradient.addColorStop(0.52, 'rgba(14, 165, 233, 0.3)');
    gradient.addColorStop(1, 'rgba(8, 145, 178, 0)');
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = 'rgba(34, 211, 238, 0.28)';
  }
  ctx.fillRect(
    frame.sinkX - span,
    0,
    span * 2,
    glowHeight,
  );

  const meniscusSpan = span * mix(0.54, 0.28, contact);
  const meniscusDepth = frame.radius * 0.46 * strength;
  ctx.globalAlpha = strength * 0.82;
  ctx.beginPath();
  ctx.moveTo(frame.sinkX - meniscusSpan, 0.5);
  ctx.bezierCurveTo(
    frame.sinkX - meniscusSpan * 0.48,
    0.5,
    frame.sinkX - frame.radius * 0.52,
    meniscusDepth,
    frame.sinkX,
    meniscusDepth,
  );
  ctx.bezierCurveTo(
    frame.sinkX + frame.radius * 0.52,
    meniscusDepth,
    frame.sinkX + meniscusSpan * 0.48,
    0.5,
    frame.sinkX + meniscusSpan,
    0.5,
  );
  ctx.strokeStyle = 'rgba(165, 243, 252, 0.88)';
  ctx.lineWidth = Math.max(0.8, frame.radius * 0.035);
  ctx.stroke();
  ctx.restore();
}

function drawAbsorptionField(ctx, frame) {
  const suction = clamp01(
    (frame.ritualProgress - INVITATION_SUCTION_START)
    / (1 - INVITATION_SUCTION_START),
  );
  if (suction <= 0) return;
  [2.8, 2.05, 1.38].forEach((scale, index) => {
    const delayed = clamp01(
      (suction - index * 0.075) / (1 - index * 0.075),
    );
    const contraction = easeInOutCubic(delayed);
    const envelope = Math.sin(delayed * Math.PI);
    drawEllipse(
      ctx,
      frame.sinkX,
      Math.max(0.75, frame.radius * 0.12 * (1 - contraction)),
      frame.radius * scale * mix(1, 0.12, contraction),
      frame.radius * scale * 0.2 * mix(1, 0.24, contraction),
      index === 0
        ? 'rgba(224, 242, 254, 0.9)'
        : 'rgba(34, 211, 238, 0.58)',
      Math.max(0.65, 1.25 - index * 0.2),
      envelope * (0.62 - index * 0.1),
    );
  });
}

function drawReverseSplash(ctx, frame) {
  const contact = clamp01(
    (frame.ritualProgress - INVITATION_ABSORPTION_START)
    / (1 - INVITATION_ABSORPTION_START),
  );
  if (contact <= 0 || contact >= 0.96) return;
  const particles = [
    [-1.72, 0.62, 0.16, 0],
    [-1.02, 0.92, 0.12, 0.06],
    [-0.38, 0.68, 0.1, 0.12],
    [0.46, 0.82, 0.13, 0.03],
    [1.08, 0.58, 0.11, 0.1],
    [1.62, 0.38, 0.08, 0.16],
  ];
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  particles.forEach(([offsetX, offsetY, scale, delay]) => {
    const progress = clamp01((contact - delay) / (0.88 - delay));
    if (progress <= 0 || progress >= 1) return;
    const pull = easeInCubic(progress);
    const startX = frame.sinkX + frame.radius * offsetX;
    const startY = frame.radius * offsetY;
    const x = mix(startX, frame.sinkX, pull);
    const y = mix(startY, -frame.radius * 0.42, pull)
      - Math.sin(progress * Math.PI) * frame.radius * 0.28;
    const alpha = Math.sin(progress * Math.PI) * 0.82;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(
      x,
      y,
      Math.max(1.2, frame.radius * scale * mix(1, 0.48, pull)),
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = 'rgba(186, 230, 253, 0.92)';
    ctx.fill();
  });
  ctx.restore();
}

function drawWaterBody(ctx, frame) {
  if (frame.radius <= 0.2 || frame.alpha <= 0.01) return;
  const radius = frame.radius;
  const tail = radius * frame.stretch;
  ctx.save();
  ctx.globalAlpha = frame.alpha;
  ctx.shadowColor = 'rgba(14, 116, 144, 0.58)';
  ctx.shadowBlur = 14;
  const gradient = ctx.createRadialGradient?.(
    frame.x - radius * 0.32,
    frame.y - radius * 0.38,
    radius * 0.08,
    frame.x,
    frame.y,
    radius * 1.24,
  );
  if (gradient) {
    gradient.addColorStop(0, 'rgba(224, 247, 250, 0.98)');
    gradient.addColorStop(0.34, 'rgba(125, 211, 220, 0.96)');
    gradient.addColorStop(0.78, 'rgba(14, 165, 184, 0.82)');
    gradient.addColorStop(1, 'rgba(3, 78, 118, 0.56)');
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = 'rgba(70, 190, 205, 0.94)';
  }
  ctx.strokeStyle = 'rgba(186, 230, 235, 0.88)';
  ctx.lineWidth = Math.max(1, radius * 0.055);
  ctx.beginPath();
  ctx.moveTo(frame.x, frame.y - radius * 1.06);
  ctx.bezierCurveTo(
    frame.x + radius * 0.88,
    frame.y - radius * 0.92,
    frame.x + radius * 1.04,
    frame.y + radius * 0.42,
    frame.x + radius * 0.5,
    frame.y + radius * 0.82,
  );
  ctx.bezierCurveTo(
    frame.x + radius * 0.18,
    frame.y + radius * 1.06,
    frame.x + radius * 0.12,
    frame.y + tail,
    frame.x,
    frame.y + tail,
  );
  ctx.bezierCurveTo(
    frame.x - radius * 0.12,
    frame.y + tail,
    frame.x - radius * 0.18,
    frame.y + radius * 1.06,
    frame.x - radius * 0.5,
    frame.y + radius * 0.82,
  );
  ctx.bezierCurveTo(
    frame.x - radius * 1.04,
    frame.y + radius * 0.42,
    frame.x - radius * 0.88,
    frame.y - radius * 0.92,
    frame.x,
    frame.y - radius * 1.06,
  );
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = frame.alpha * 0.58;
  ctx.beginPath();
  ctx.arc(
    frame.x - radius * 0.26,
    frame.y - radius * 0.34,
    Math.max(2.4, radius * 0.17),
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = 'rgba(236, 254, 255, 0.72)';
  ctx.fill();
  ctx.restore();
}

function renderCanvas(now) {
  if (!canvas || !host?.isConnected || !animationSeed) return 1;
  const context = resizeCanvas();
  if (!context) return 1;
  const reducedMotion = isReducedMotionPreferred();
  const duration = reducedMotion
    ? REDUCED_MOTION_ANIMATION_MS
    : INVITATION_ANIMATION_MS;
  const progress = clamp01((now - animationStartAt) / duration);
  const frame = resolveInvitationFrame(progress);
  context.clearRect(0, 0, frame.width, frame.height);
  drawBoundaryGlow(context, frame);
  drawAbsorptionField(context, frame);
  drawReverseSplash(context, frame);
  if (frame.stage === 'forming') drawCondensationField(context, frame);
  if (!reducedMotion) drawRisingTrail(context, frame);
  drawWaterBody(context, frame);
  host.dataset.stage = frame.stage;
  return progress;
}

function stopAnimation() {
  cancelScheduledAnimationFrame(animationFrameId);
  animationFrameId = null;
  animationStartAt = 0;
}

function unmountHost() {
  stopAnimation();
  if (host?.parentNode) host.parentNode.removeChild(host);
  host = null;
  shadow = null;
  canvas = null;
  animationSeed = null;
}

function announceInvitationArrival() {
  if (
    invitationArrived
    || !activeRuntime
    || typeof invitationTransport !== 'function'
  ) {
    return;
  }
  invitationArrived = true;
  void Promise.resolve(invitationTransport('arrived'))
    .then(requireInvitationResponse)
    .catch((error) => {
      lastStatus = 'failed';
      console.error('[Suikinkutsu] Invitation arrival failed:', error);
    });
}

function tickAnimation(now) {
  const progress = renderCanvas(Number(now) || getNow());
  if (progress >= 1) {
    announceInvitationArrival();
    unmountHost();
    return;
  }
  animationFrameId = scheduleAnimationFrame(tickAnimation);
}

function startAnimation() {
  if (!canvas || animationFrameId !== null) return;
  animationSeed = createAnimationSeed();
  animationStartAt = getNow();
  renderCanvas(animationStartAt);
  animationFrameId = scheduleAnimationFrame(tickAnimation);
}

function ensureMounted() {
  const doc = getDocument();
  if (!doc?.documentElement) return false;
  if (host?.isConnected && canvas) return true;
  host = doc.getElementById(ROOT_ID) || doc.createElement('div');
  host.id = ROOT_ID;
  shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
  shadow.replaceChildren();
  shadow.appendChild(createStyles(doc));
  canvas = doc.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  shadow.appendChild(canvas);
  if (!host.isConnected) doc.documentElement.appendChild(host);
  resizeCanvas();
  return true;
}

function clearInvitationExpiry() {
  if (invitationExpiryTimer === null) return;
  globalThis.clearTimeout?.(invitationExpiryTimer);
  invitationExpiryTimer = null;
}

function requireInvitationResponse(response) {
  if (response?.success !== true) {
    throw new Error(
      response?.error || 'AUDIO_DULLING_QA_INVITATION_RESPONSE_INVALID',
    );
  }
  return response.result;
}

function expireInvitation() {
  invitationExpiryTimer = null;
  unmountHost();
  settleInterventionAdmission();
  if (typeof invitationTransport !== 'function') return;
  void Promise.resolve(invitationTransport('expired'))
    .then(requireInvitationResponse)
    .catch((error) => {
      console.error('[Suikinkutsu] Invitation expiry failed:', error);
    });
}

function presentInvitation() {
  if (invitationPresented || !activeRuntime) return;
  invitationPresented = true;
  stopMediaEvidenceSubscription();
  if (!ensureMounted()) {
    settleInterventionAdmission();
    return;
  }
  if (typeof invitationTransport !== 'function') {
    settleInterventionAdmission();
    unmountHost();
    return;
  }
  try {
    interventionAdmissionRuntimeOwner.present(interventionAdmissionLease, {
      now: Date.now(),
    });
    interventionAdmissionPresented = true;
  } catch (error) {
    settleInterventionAdmission();
    lastStatus = 'failed';
    unmountHost();
    throw error;
  }
  host.dataset.status = 'inviting';
  startAnimation();
  invitationExpiryTimer = globalThis.setTimeout?.(
    expireInvitation,
    invitationWindowMs,
  ) ?? null;
  void Promise.resolve(invitationTransport('presented'))
    .then(requireInvitationResponse)
    .catch((error) => {
      lastStatus = 'failed';
      clearInvitationExpiry();
      unmountHost();
      settleInterventionAdmission();
      console.error('[Suikinkutsu] Invitation presentation failed:', error);
    });
}

function resolveMediaActivityObserver(value) {
  if (
    !value
    || typeof value.subscribe !== 'function'
    || typeof value.getSnapshot !== 'function'
    || typeof value.reconcile !== 'function'
  ) {
    throw new Error('SUIKINKUTSU_MEDIA_ACTIVITY_OBSERVER_REQUIRED');
  }
  return value;
}

function resolveInterventionAdmissionRuntime(value) {
  if (
    !value
    || value.enabled !== true
    || typeof value.reserveCandidate !== 'function'
    || typeof value.present !== 'function'
    || typeof value.abort !== 'function'
    || typeof value.release !== 'function'
    || typeof value.bind !== 'function'
    || typeof value.getSnapshot !== 'function'
  ) {
    throw new Error('SUIKINKUTSU_INTERVENTION_ADMISSION_RUNTIME_REQUIRED');
  }
  return value;
}

function stopInterventionAdmissionRetry() {
  if (typeof interventionAdmissionUnsubscribe !== 'function') return;
  const unsubscribe = interventionAdmissionUnsubscribe;
  interventionAdmissionUnsubscribe = null;
  unsubscribe();
}

function settleInterventionAdmission() {
  stopInterventionAdmissionRetry();
  const lease = interventionAdmissionLease;
  if (!lease) return true;
  if (interventionAdmissionPresented) {
    interventionAdmissionRuntimeOwner.release(lease, { now: Date.now() });
  } else {
    interventionAdmissionRuntimeOwner.abort(lease, { now: Date.now() });
  }
  interventionAdmissionLease = null;
  interventionAdmissionPresented = false;
  return true;
}

function clearMediaCandidateRecheck() {
  if (mediaCandidateRecheckTimer === null) return;
  if (typeof globalThis.clearTimeout !== 'function') {
    throw new Error('SUIKINKUTSU_MEDIA_RECHECK_CLEAR_TIMER_REQUIRED');
  }
  globalThis.clearTimeout(mediaCandidateRecheckTimer);
  mediaCandidateRecheckTimer = null;
}

function stopMediaEvidenceSubscription() {
  clearMediaCandidateRecheck();
  if (typeof mediaActivityUnsubscribe === 'function') {
    const unsubscribe = mediaActivityUnsubscribe;
    mediaActivityUnsubscribe = null;
    unsubscribe();
  }
  latestMediaEvidence = null;
}

function scheduleMediaCandidateRecheck(notBefore) {
  clearMediaCandidateRecheck();
  const now = Date.now();
  const delayMs = Math.max(0, Math.round(Number(notBefore) - now));
  if (typeof globalThis.setTimeout !== 'function') {
    throw new Error('SUIKINKUTSU_MEDIA_RECHECK_TIMER_REQUIRED');
  }
  mediaCandidateRecheckTimer = globalThis.setTimeout(() => {
    mediaCandidateRecheckTimer = null;
    if (!activeRuntime || invitationPresented) return;
    reconcileMediaCandidate(mediaActivityObserverOwner.getSnapshot({ now: Date.now() }));
  }, delayMs);
}

function reconcileMediaCandidate(activitySnapshot = null) {
  if (!activeRuntime || invitationPresented) return null;
  clearMediaCandidateRecheck();
  const now = Date.now();
  const snapshot = activitySnapshot
    || mediaActivityObserverOwner.getSnapshot({ now });
  latestMediaEvidence = projectPageMediaConsumptionEvidence(snapshot, { now });
  const evaluation = evaluateSuikinkutsuInterventionCandidate({
    mediaEvidence: latestMediaEvidence,
    now,
    revealDelayMs,
  });
  if (evaluation.eligible) {
    const admission = interventionAdmissionRuntimeOwner.reserveCandidate(
      evaluation.candidate,
      {
        mediaEvidence: latestMediaEvidence,
        now,
      },
    );
    if (admission.accepted === true && admission.lease) {
      interventionAdmissionLease = admission.lease;
      interventionAdmissionUnsubscribe = interventionAdmissionRuntimeOwner.bind(admission.lease, () => {
        clearInvitationExpiry();
        unmountHost();
        settleInterventionAdmission();
      });
      presentInvitation();
      return Object.freeze({
        ...evaluation,
        admission,
      });
    }
    return Object.freeze({
      ...evaluation,
      admission,
    });
  }
  if (evaluation.reason === 'sustained_media_pending' && evaluation.notBefore > now) {
    scheduleMediaCandidateRecheck(evaluation.notBefore);
  }
  return evaluation;
}

function startMediaEvidenceSubscription() {
  if (mediaActivityUnsubscribe) {
    mediaActivityObserverOwner.reconcile({
      reason: 'suikinkutsu_runtime_update',
    });
    return;
  }
  const unsubscribe = mediaActivityObserverOwner.subscribe({
    debugLabel: 'AudioDullingActivationChip.media',
    emitCurrent: true,
    onSnapshot: (snapshot) => {
      reconcileMediaCandidate(snapshot);
    },
  });
  if (typeof unsubscribe !== 'function') {
    throw new Error('SUIKINKUTSU_MEDIA_ACTIVITY_UNSUBSCRIBE_REQUIRED');
  }
  if (!activeRuntime || invitationPresented) {
    unsubscribe();
    return;
  }
  mediaActivityUnsubscribe = unsubscribe;
}

function computeSignature(filters = {}, context = {}) {
  const entry = readAudioDullingEntry(filters);
  return JSON.stringify({
    active: entry?.isActive === true,
    level: entry?.value?.intensity ?? entry?.value?.wet ?? null,
    domainClassId: context?.domainClassId || null,
    invitationWindowMs: context?.invitationWindowMs ?? null,
    revealDelayMs: context?.revealDelayMs ?? null,
  });
}

const AudioDullingActivationChip = {
  update(filters = {}, context = {}) {
    if (!shouldRender(filters)) {
      this.remove();
      return;
    }
    const signature = computeSignature(filters, context);
    if (lastSignature && signature !== lastSignature) {
      this.remove();
    }
    const nextMediaActivityObserver = resolveMediaActivityObserver(
      Object.prototype.hasOwnProperty.call(context, 'mediaActivityObserver')
        ? context.mediaActivityObserver
        : pageMediaActivityObserver,
    );
    const nextInterventionAdmissionRuntime = resolveInterventionAdmissionRuntime(
      Object.prototype.hasOwnProperty.call(context, 'interventionAdmissionRuntime')
        ? context.interventionAdmissionRuntime
        : sharedInterventionAdmissionRuntime,
    );
    if (
      activeRuntime
      && interventionAdmissionRuntimeOwner !== nextInterventionAdmissionRuntime
    ) {
      this.remove();
    }
    if (
      mediaActivityObserverOwner !== nextMediaActivityObserver
      && mediaActivityUnsubscribe
    ) {
      stopMediaEvidenceSubscription();
    }
    mediaActivityObserverOwner = nextMediaActivityObserver;
    interventionAdmissionRuntimeOwner = nextInterventionAdmissionRuntime;
    activeRuntime = true;
    lastSignature = signature;
    invitationTransport = typeof context?.invitationTransport === 'function'
      ? context.invitationTransport
      : null;
    revealDelayMs = normalizeDuration(context?.revealDelayMs, {
      fallbackMs: 0,
      minimum: 0,
      maximum: 600_000,
    });
    invitationWindowMs = normalizeDuration(context?.invitationWindowMs, {
      fallbackMs: DEFAULT_INVITATION_WINDOW_MS,
      minimum: 3_000,
      maximum: 30_000,
    });
    startMediaEvidenceSubscription();
  },

  remove() {
    activeRuntime = false;
    invitationTransport = null;
    invitationPresented = false;
    invitationArrived = false;
    invitationWindowMs = DEFAULT_INVITATION_WINDOW_MS;
    revealDelayMs = 0;
    lastSignature = '';
    lastStatus = 'idle';
    clearInvitationExpiry();
    stopMediaEvidenceSubscription();
    settleInterventionAdmission();
    mediaActivityObserverOwner = pageMediaActivityObserver;
    interventionAdmissionRuntimeOwner = sharedInterventionAdmissionRuntime;
    unmountHost();
  },

  setRuntimeStatus(status) {
    lastStatus = typeof status === 'string' && status ? status : 'idle';
    if (lastStatus === 'capturing_processed' || lastStatus === 'failed') {
      clearInvitationExpiry();
      unmountHost();
      settleInterventionAdmission();
    }
  },

  getInterventionAdmissionDebugSnapshot({ now = Date.now() } = {}) {
    return Object.freeze({
      activeRuntime,
      invitationPresented,
      invitationArrived,
      lastStatus,
      mediaEvidence: latestMediaEvidence,
      admission: interventionAdmissionRuntimeOwner.getSnapshot(),

    });
  },
};

export default AudioDullingActivationChip;
