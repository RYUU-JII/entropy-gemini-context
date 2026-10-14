import {
  assertLandingMotionMode,
  assertLandingSoundMode,
  LANDING_MOTION_MODES,
  LANDING_SOUND_MODES,
  LANDING_STILLNESS_TARGET_MS,
  resolveLandingExperienceSnapshot,
  resolveLandingJourneyProjection,
} from './resolveLandingExperienceSnapshot.js';
import {
  LANDING_READING_PHASE_IDS,
  LANDING_READING_PHASES,
} from './landingJourneyContract.js';

const PASSIVE_EVENT_OPTIONS = Object.freeze({ passive: true });
const WIND_DECAY_MS = 720;
const SCROLL_PRESSURE_DECAY_MS = 920;
const SCROLL_PRESSURE_FLOOR_PER_SECOND = 0.035;
const SCROLL_PRESSURE_RANGE_PER_SECOND = 0.5;
const FURIN_SIGNAL_DURATION_MS = 1_400;
const FURIN_TRIGGER_PROGRESS = LANDING_READING_PHASES.find(
  ({ id }) => id === LANDING_READING_PHASE_IDS.REFLECTION,
)?.start;

if (!Number.isFinite(FURIN_TRIGGER_PROGRESS)) {
  throw new Error('LANDING_FURIN_TRIGGER_PROGRESS_REQUIRED');
}

function createControllerError(message, details = {}) {
  const error = new Error(message);
  error.code = 'LANDING_EXPERIENCE_CONTROLLER_INVALID';
  error.details = Object.freeze({ ...details });
  return error;
}

function assertFinite(value, field) {
  if (!Number.isFinite(value)) {
    throw createControllerError(
      `[LandingExperienceController] ${field} must be finite.`,
      { field, value },
    );
  }
  return value;
}

export function resolveLandingScrollProgress({ top, height, viewportHeight }) {
  assertFinite(top, 'journeyRect.top');
  assertFinite(height, 'journeyRect.height');
  assertFinite(viewportHeight, 'viewportHeight');
  if (viewportHeight <= 0) {
    throw createControllerError(
      '[LandingExperienceController] viewportHeight must be greater than zero.',
      { viewportHeight },
    );
  }
  if (height <= viewportHeight) {
    throw createControllerError(
      '[LandingExperienceController] journey height must exceed the viewport height.',
      { height, viewportHeight },
    );
  }

  return Math.min(1, Math.max(0, -top / (height - viewportHeight)));
}

function assertBrowserWindow(browserWindow) {
  const requiredFunctions = [
    'addEventListener',
    'removeEventListener',
    'requestAnimationFrame',
    'cancelAnimationFrame',
  ];
  if (!browserWindow || typeof browserWindow !== 'object') {
    throw createControllerError(
      '[LandingExperienceController] a browser window is required.',
      { browserWindowType: typeof browserWindow },
    );
  }
  requiredFunctions.forEach((field) => {
    if (typeof browserWindow[field] !== 'function') {
      throw createControllerError(
        `[LandingExperienceController] browserWindow.${field} must be a function.`,
        { field, valueType: typeof browserWindow[field] },
      );
    }
  });
  return browserWindow;
}

function assertJourneyElement(journeyElement) {
  if (!journeyElement || typeof journeyElement.getBoundingClientRect !== 'function') {
    throw createControllerError(
      '[LandingExperienceController] journeyElement must expose getBoundingClientRect().',
      { journeyElementType: typeof journeyElement },
    );
  }
  return journeyElement;
}

export function createLandingExperienceController({
  journeyElement,
  onSnapshot,
  browserWindow = globalThis.window,
  initialMotionMode = LANDING_MOTION_MODES.FULL,
  initialSoundMode = LANDING_SOUND_MODES.MUTED,
}) {
  const windowRef = assertBrowserWindow(browserWindow);
  const journeyRef = assertJourneyElement(journeyElement);
  if (typeof onSnapshot !== 'function') {
    throw createControllerError(
      '[LandingExperienceController] onSnapshot must be a function.',
      { onSnapshotType: typeof onSnapshot },
    );
  }

  let motionMode = assertLandingMotionMode(initialMotionMode);
  let soundMode = assertLandingSoundMode(initialSoundMode);
  let running = false;
  let destroyed = false;
  let frameRequestId = null;
  let lastFrameAt = null;
  let lastActivityAt = null;
  let pendingActivity = true;
  let lastPointerX = null;
  let windX = 0;
  let windStrength = 0;
  let scrollPressure = 0;
  let lastScrollProgress = null;
  let furinTriggered = false;
  let furinSignalStartedAt = null;
  let lastSnapshot = null;

  const requestFrame = () => {
    if (!running || frameRequestId !== null) return;
    frameRequestId = windowRef.requestAnimationFrame(renderFrame);
  };

  const markActivity = () => {
    pendingActivity = true;
    requestFrame();
  };

  const handleScroll = () => {
    markActivity();
  };

  const handleResize = () => {
    markActivity();
  };

  const handlePointerDown = () => {
    markActivity();
  };

  const handlePointerMove = (event) => {
    if (!Number.isFinite(event?.clientX)) return;
    markActivity();
    if (lastPointerX !== null && event.clientX !== lastPointerX) {
      const viewportWidth = assertFinite(windowRef.innerWidth, 'browserWindow.innerWidth');
      if (viewportWidth <= 0) {
        throw createControllerError(
          '[LandingExperienceController] browserWindow.innerWidth must be greater than zero.',
          { viewportWidth },
        );
      }
      const pointerDelta = event.clientX - lastPointerX;
      windX = Math.sign(pointerDelta);
      windStrength = Math.min(1, Math.abs(pointerDelta) / (viewportWidth * 0.08));
    }
    lastPointerX = event.clientX;
  };

  function renderFrame(timestamp) {
    frameRequestId = null;
    assertFinite(timestamp, 'animationFrame.timestamp');
    const frameDeltaMs = lastFrameAt === null ? 0 : Math.max(0, timestamp - lastFrameAt);
    lastFrameAt = timestamp;

    if (pendingActivity || lastActivityAt === null) {
      lastActivityAt = timestamp;
      pendingActivity = false;
    }
    if (windStrength > 0 && frameDeltaMs > 0) {
      windStrength *= Math.exp(-frameDeltaMs / WIND_DECAY_MS);
      if (windStrength < 0.0001) {
        windStrength = 0;
        windX = 0;
      }
    }

    const rect = journeyRef.getBoundingClientRect();
    const scrollProgress = resolveLandingScrollProgress({
      top: rect?.top,
      height: rect?.height,
      viewportHeight: windowRef.innerHeight,
    });
    if (lastScrollProgress !== null && frameDeltaMs > 0) {
      const progressPerSecond = Math.abs(scrollProgress - lastScrollProgress)
        / (frameDeltaMs / 1000);
      const instantaneousPressure = Math.min(1, Math.max(
        0,
        (progressPerSecond - SCROLL_PRESSURE_FLOOR_PER_SECOND)
          / SCROLL_PRESSURE_RANGE_PER_SECOND,
      ));
      scrollPressure = Math.max(
        instantaneousPressure,
        scrollPressure * Math.exp(-frameDeltaMs / SCROLL_PRESSURE_DECAY_MS),
      );
      if (scrollPressure < 0.0001) scrollPressure = 0;
    }
    lastScrollProgress = scrollProgress;

    const journeyProjection = resolveLandingJourneyProjection({
      scrollProgress,
      motionMode,
    });
    if (!furinTriggered && journeyProjection.globalProgress >= FURIN_TRIGGER_PROGRESS) {
      furinTriggered = true;
      furinSignalStartedAt = timestamp;
    }
    const furinSignalProgress = furinSignalStartedAt === null
      ? 0
      : Math.min(1, Math.max(0, (timestamp - furinSignalStartedAt) / FURIN_SIGNAL_DURATION_MS));
    const stillnessMs = Math.max(0, timestamp - lastActivityAt);

    lastSnapshot = resolveLandingExperienceSnapshot({
      scrollProgress,
      wind: { x: windX, strength: windStrength },
      stillnessMs,
      scrollPressure,
      furinTriggered,
      furinSignalProgress,
      motionMode,
      soundMode,
    });
    onSnapshot(lastSnapshot);

    const hasTransientProjection = motionMode === LANDING_MOTION_MODES.FULL && (
      windStrength > 0
      || scrollPressure > 0
      || stillnessMs < LANDING_STILLNESS_TARGET_MS
      || (furinSignalStartedAt !== null && furinSignalProgress < 1)
    );
    if (hasTransientProjection) requestFrame();
  }

  const addListeners = () => {
    windowRef.addEventListener('resize', handleResize, PASSIVE_EVENT_OPTIONS);
    windowRef.addEventListener('scroll', handleScroll, PASSIVE_EVENT_OPTIONS);
    windowRef.addEventListener('pointerdown', handlePointerDown, PASSIVE_EVENT_OPTIONS);
    windowRef.addEventListener('pointermove', handlePointerMove, PASSIVE_EVENT_OPTIONS);
  };

  const removeListeners = () => {
    windowRef.removeEventListener('resize', handleResize, PASSIVE_EVENT_OPTIONS);
    windowRef.removeEventListener('scroll', handleScroll, PASSIVE_EVENT_OPTIONS);
    windowRef.removeEventListener('pointerdown', handlePointerDown, PASSIVE_EVENT_OPTIONS);
    windowRef.removeEventListener('pointermove', handlePointerMove, PASSIVE_EVENT_OPTIONS);
  };

  const start = () => {
    if (destroyed) {
      throw createControllerError(
        '[LandingExperienceController] a destroyed controller cannot be restarted.',
      );
    }
    if (running) return;
    running = true;
    pendingActivity = true;
    addListeners();
    requestFrame();
  };

  const stop = () => {
    if (!running) return;
    running = false;
    removeListeners();
    if (frameRequestId !== null) {
      windowRef.cancelAnimationFrame(frameRequestId);
      frameRequestId = null;
    }
    lastFrameAt = null;
    lastActivityAt = null;
    lastPointerX = null;
    windX = 0;
    windStrength = 0;
    scrollPressure = 0;
    lastScrollProgress = null;
  };

  const setSessionValue = (field, value, assertValue) => {
    if (destroyed) {
      throw createControllerError(
        '[LandingExperienceController] a destroyed controller cannot accept session updates.',
        { field },
      );
    }
    const normalizedValue = assertValue(value);
    if (field === 'motionMode') motionMode = normalizedValue;
    if (field === 'soundMode') soundMode = normalizedValue;
    requestFrame();
  };

  return Object.freeze({
    start,
    stop,
    destroy() {
      if (destroyed) return;
      stop();
      destroyed = true;
    },
    requestFrame,
    setMotionMode(value) {
      setSessionValue('motionMode', value, assertLandingMotionMode);
    },
    setSoundMode(value) {
      setSessionValue('soundMode', value, assertLandingSoundMode);
    },
    getSnapshot() {
      return lastSnapshot;
    },
    isRunning() {
      return running;
    },
  });
}
